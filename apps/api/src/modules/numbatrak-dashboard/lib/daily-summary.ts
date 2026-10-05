import type { FastifyBaseLogger } from "fastify";
import { eq } from "drizzle-orm";
import { numbatrakCustomerOrders, organization, type Database } from "@platform/db";
import { fetchDashboardSummary } from "./summary.js";
import { sendEmail } from "../../auth/lib/email.js";
import { findOrgOwnerEmail } from "../../../lib/org-owner.js";
import { getOrCreateNotificationSettings } from "./notification-settings.js";
import { getLowStockCells, type LowStockCell } from "../../numbatrak-inventory/lib/movements.js";

/** Comma-separated additional recipients -> a clean list of non-empty, trimmed addresses. */
function parseAdditionalRecipients(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
}

const WAT_OFFSET_MS = 60 * 60 * 1000; // WAT is UTC+1, no DST

/** The most recent full calendar day in WAT, as [start, end] ISO instants - independent of exactly when the cron fires. */
function yesterdayWatRange(now: Date): { dateFrom: string; dateTo: string; label: string } {
  const watNow = new Date(now.getTime() + WAT_OFFSET_MS);
  const y = watNow.getUTCFullYear();
  const m = watNow.getUTCMonth();
  const d = watNow.getUTCDate() - 1;

  const startUtcMs = Date.UTC(y, m, d) - WAT_OFFSET_MS;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000 - 1;

  return {
    dateFrom: new Date(startUtcMs).toISOString(),
    dateTo: new Date(endUtcMs).toISOString(),
    label: new Date(startUtcMs + WAT_OFFSET_MS).toISOString().slice(0, 10),
  };
}

function formatCurrency(value: number): string {
  return `₦${Math.round(value).toLocaleString("en-NG")}`;
}

function buildLowStockSection(cells: LowStockCell[]): string {
  if (cells.length === 0) return "";
  const rows = cells
    .map(
      (c) =>
        `<tr><td style="padding:4px 12px 4px 0;">${c.productName}${c.variantName ? ` (${c.variantName})` : ""} — ${c.agentName}</td><td style="padding:4px 0;font-weight:600;color:#b45309;">${c.quantityOnHand} on hand (threshold ${c.threshold})</td></tr>`,
    )
    .join("");
  return `
    <h3 style="margin:20px 0 4px;">Low stock</h3>
    <table cellspacing="0" cellpadding="0">${rows}</table>
  `;
}

function buildEmailBody(
  orgName: string,
  label: string,
  summary: Awaited<ReturnType<typeof fetchDashboardSummary>>,
  lowStockCells: LowStockCell[],
): string {
  const m = summary.businessMetrics;
  const l = summary.lossMetrics;
  const row = (name: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">${name}</td><td style="padding:4px 0;font-weight:600;">${value}</td></tr>`;

  return `
    <h2 style="margin:0 0 4px;">${orgName} — Daily Summary</h2>
    <p style="margin:0 0 16px;color:#6b7280;">${label}</p>
    <table cellspacing="0" cellpadding="0">
      ${row("Orders generated", String(m.totalOrdersGenerated))}
      ${row("Orders delivered", String(m.totalOrdersDelivered))}
      ${row("Delivery rate", `${m.deliveryRate.toFixed(1)}%`)}
      ${row("Sales (delivered)", formatCurrency(m.totalDeliveredSales))}
      ${row("Profit", formatCurrency(m.totalProfit))}
      ${row("Ad spend", formatCurrency(m.adSpend))}
      ${row("Net profit after expenses", formatCurrency(m.netProfitAfterAllExpenses))}
      ${row("Undelivered orders", String(l.undeliveredCount))}
      ${row("Would-be sales (undelivered)", formatCurrency(l.wouldBeSales))}
    </table>
    ${buildLowStockSection(lowStockCells)}
  `.trim();
}

export interface DailySummaryResult {
  sent: string[];
  skipped: string[];
}

/**
 * Sends every active organization's owner (plus any additional recipients
 * configured in numbatrak_notification_settings) a summary of the previous
 * WAT calendar day's order/delivery/profit numbers. Always sends, even on a
 * zero-order day - a quiet day is itself a signal worth surfacing, not
 * something to suppress - unless the org has opted out via
 * dailySummaryEnabled. "Active" = has ever placed a numbatrak order; orgs
 * that never touched the feature don't get a report at all.
 */
export async function runDailySummaryEmails(db: Database, log: FastifyBaseLogger): Promise<DailySummaryResult> {
  const { dateFrom, dateTo, label } = yesterdayWatRange(new Date());

  const orgRows = await db
    .selectDistinct({ organizationId: numbatrakCustomerOrders.organizationId })
    .from(numbatrakCustomerOrders);

  const sent: string[] = [];
  const skipped: string[] = [];

  for (const { organizationId } of orgRows) {
    try {
      const notificationSettings = await getOrCreateNotificationSettings(db, organizationId);
      if (!notificationSettings.dailySummaryEnabled) {
        skipped.push(organizationId);
        continue;
      }

      const email = await findOrgOwnerEmail(db, organizationId);
      if (!email) {
        log.warn({ organizationId }, "daily-summary: no owner email found, skipping");
        skipped.push(organizationId);
        continue;
      }
      const recipients = [email, ...parseAdditionalRecipients(notificationSettings.additionalRecipients)];

      const [org] = await db.select({ name: organization.name }).from(organization).where(eq(organization.id, organizationId)).limit(1);
      const summary = await fetchDashboardSummary(db, organizationId, { dateFrom, dateTo });
      const lowStockCells = await getLowStockCells(db, organizationId);
      const body = buildEmailBody(org?.name ?? "Your business", label, summary, lowStockCells);
      for (const recipient of recipients) {
        await sendEmail(log, { to: recipient, subject: `Daily summary — ${label}`, body });
      }
      sent.push(organizationId);
    } catch (err) {
      log.error({ err, organizationId }, "daily-summary: failed to send for org");
      skipped.push(organizationId);
    }
  }

  return { sent, skipped };
}
