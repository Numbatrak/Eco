import type { FastifyInstance } from "fastify";
import { whatsappConnectRequestSchema, type WhatsappSettingsResponse } from "@platform/shared-types";
import {
  findWhatsappSettings,
  serializeWhatsappSettings,
  upsertWhatsappSettings,
  deleteWhatsappSettings,
} from "../lib/whatsapp-settings-store.js";

const META_API_VERSION = "v21.0";

export default async function whatsappRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/whatsapp-settings",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const row = await findWhatsappSettings(db, request.activeOrganizationId!);
      const response: WhatsappSettingsResponse = serializeWhatsappSettings(row);
      return reply.send(response);
    },
  );

  /**
   * Exchange the authorization code from Meta's Embedded Signup for an access
   * token, fetch phone number details, register the phone for Cloud API,
   * subscribe to webhooks, and persist everything per-tenant.
   */
  app.post(
    "/org/whatsapp/connect",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const body = whatsappConnectRequestSchema.parse(request.body);
      const db = app.getDb();

      const metaAppId = process.env.META_APP_ID;
      const metaAppSecret = process.env.META_APP_SECRET;
      if (!metaAppId || !metaAppSecret) {
        return reply.code(503).send({
          error: "whatsapp_not_configured",
          message: "WhatsApp Embedded Signup is not configured on this platform.",
        });
      }

      // Step 1: Exchange the short-lived code for an access token.
      const tokenUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`);
      tokenUrl.searchParams.set("client_id", metaAppId);
      tokenUrl.searchParams.set("client_secret", metaAppSecret);
      tokenUrl.searchParams.set("code", body.code);

      const tokenRes = await fetch(tokenUrl.toString());
      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        request.log.error({ status: tokenRes.status, errBody }, "Meta token exchange failed");
        return reply.code(502).send({
          error: "token_exchange_failed",
          message: "Failed to exchange authorization code with Meta.",
        });
      }
      const tokenData = (await tokenRes.json()) as { access_token: string };
      const accessToken = tokenData.access_token;

      // Step 2: Fetch phone number details (display name, actual number).
      let phoneNumber: string | undefined;
      let displayName: string | undefined;
      try {
        const phoneRes = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${body.phoneNumberId}?fields=display_phone_number,verified_name`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (phoneRes.ok) {
          const phoneData = (await phoneRes.json()) as {
            display_phone_number?: string;
            verified_name?: string;
          };
          phoneNumber = phoneData.display_phone_number;
          displayName = phoneData.verified_name;
        }
      } catch (err) {
        request.log.warn({ err }, "Failed to fetch phone number details (non-fatal)");
      }

      // Step 3: Register the phone number for Cloud API.
      try {
        const registerRes = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${body.phoneNumberId}/register`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ messaging_product: "whatsapp", pin: "000000" }),
          },
        );
        if (!registerRes.ok) {
          const errBody = await registerRes.text();
          request.log.warn({ status: registerRes.status, errBody }, "Phone registration failed (may already be registered)");
        }
      } catch (err) {
        request.log.warn({ err }, "Phone registration request failed (non-fatal)");
      }

      // Step 4: Subscribe the app to the WABA's webhooks.
      try {
        const subRes = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${body.wabaId}/subscribed_apps`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        if (!subRes.ok) {
          const errBody = await subRes.text();
          request.log.warn({ status: subRes.status, errBody }, "Webhook subscription failed (non-fatal)");
        }
      } catch (err) {
        request.log.warn({ err }, "Webhook subscription request failed (non-fatal)");
      }

      // Step 5: Persist credentials.
      await upsertWhatsappSettings(db, request.activeOrganizationId!, {
        wabaId: body.wabaId,
        phoneNumberId: body.phoneNumberId,
        phoneNumber,
        displayName,
        accessToken,
      });

      const row = await findWhatsappSettings(db, request.activeOrganizationId!);
      return reply.send(serializeWhatsappSettings(row));
    },
  );

  app.delete(
    "/org/whatsapp/disconnect",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      await deleteWhatsappSettings(db, request.activeOrganizationId!);
      return reply.send({ success: true });
    },
  );
}
