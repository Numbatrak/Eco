import type { FastifyBaseLogger } from "fastify";
import type { Database } from "@platform/db";
import { findWhatsappSettings } from "../modules/whatsapp/lib/whatsapp-settings-store.js";
import { decryptSecret } from "./encryption.js";

/**
 * WhatsApp Cloud API client for sending template messages using per-tenant
 * credentials stored via the Embedded Signup flow.
 *
 * Each tenant connects their own WhatsApp Business Account, and messages are
 * sent from the tenant's phone number using their access token.
 */

const API_VERSION = "v21.0";

export interface SendWhatsAppTemplateParams {
  /** Recipient phone in E.164 format, e.g. "+2348012345678" */
  to: string;
  /** Name of the approved message template */
  templateName: string;
  /** Language code, e.g. "en_US" */
  languageCode?: string;
  /** Positional body parameters for the template's {{1}}, {{2}}, etc. */
  bodyParameters?: string[];
}

export async function sendWhatsAppTemplate(
  db: Database,
  tenantId: string,
  logger: FastifyBaseLogger,
  params: SendWhatsAppTemplateParams,
): Promise<void> {
  const settings = await findWhatsappSettings(db, tenantId);

  if (!settings?.enabled || !settings.accessTokenEncrypted) {
    logger.info(
      { to: params.to, template: params.templateName, tenantId },
      "sendWhatsApp (skip): tenant has no WhatsApp connected or not enabled",
    );
    return;
  }

  const token = decryptSecret(settings.accessTokenEncrypted);
  const url = `https://graph.facebook.com/${API_VERSION}/${settings.phoneNumberId}/messages`;

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: params.to.replace(/[^0-9]/g, ""),
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.languageCode ?? "en_US" },
      ...(params.bodyParameters &&
        params.bodyParameters.length > 0 && {
          components: [
            {
              type: "body",
              parameters: params.bodyParameters.map((text) => ({
                type: "text",
                text,
              })),
            },
          ],
        }),
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    logger.error(
      { to: params.to, status: res.status, errBody, tenantId },
      "WhatsApp send failed",
    );
    throw new Error(`WhatsApp API error ${res.status}: ${errBody}`);
  }

  const data = (await res.json()) as { messages?: { id: string }[] };
  logger.info(
    { to: params.to, template: params.templateName, waMessageId: data.messages?.[0]?.id, tenantId },
    "WhatsApp message sent",
  );
}

/**
 * Convenience: send the order-confirmation template.
 *
 * The template "order_confirmation" must be pre-approved in Meta Business
 * Manager with body parameters: {{1}} customer name, {{2}} order number,
 * {{3}} amount (e.g. "NGN 5,000.00").
 */
export async function sendOrderConfirmationWhatsApp(
  db: Database,
  tenantId: string,
  logger: FastifyBaseLogger,
  params: {
    customerPhone: string;
    customerName: string;
    orderNumber: string;
    amount: string;
    currency: string;
  },
): Promise<void> {
  await sendWhatsAppTemplate(db, tenantId, logger, {
    to: params.customerPhone,
    templateName: "order_confirmation",
    bodyParameters: [
      params.customerName,
      params.orderNumber,
      `${params.currency} ${params.amount}`,
    ],
  });
}
