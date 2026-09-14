import { numbatrakUnifiedExpenses, numbatrakRemittanceLines, type Database } from "@platform/db";
import type { NumbatrakRemittanceLine } from "@platform/shared-types";
import { computeExpectedRemittance, computeRemittanceLineStatus, fetchRemittanceLines } from "./remittance.js";

export async function addNetOff(
  db: Database,
  organizationId: string,
  agentId: number,
  remittanceDate: string,
  amount: number,
  userId: string,
  note: string | null | undefined,
  subcategory: string | undefined,
): Promise<NumbatrakRemittanceLine> {
  if (amount <= 0) throw new Error("Net-off amount must be positive.");

  const lines = await fetchRemittanceLines(db, organizationId);
  const line = lines.find((l) => l.agentId === agentId && l.remittanceDate === remittanceDate);
  if (!line) throw new Error("No remittance line found for that agent/date.");

  const newNetOff = line.netOffAmount + amount;
  const expectedRemittance = computeExpectedRemittance({
    totalDeliveredValue: line.totalDeliveredValue,
    totalDeliveryFees: line.totalDeliveryFees,
    netOffAmount: newNetOff,
  });

  const [expense] = await db
    .insert(numbatrakUnifiedExpenses)
    .values({
      organizationId,
      scope: "agent",
      category: "operational",
      subcategory: subcategory?.trim() || "agent_remittance_net_off",
      amount: String(amount),
      agentId,
      note: note?.trim() || `Net-off on remittance ${line.agentName} ${line.remittanceDate}`,
      occurredAt: remittanceDate,
      createdBy: userId,
      sourceType: "remittance_net_off",
      sourceId: `${line.id ?? line.lineKey}:${newNetOff}`,
    })
    .onConflictDoNothing()
    .returning();

  const status = computeRemittanceLineStatus({ expectedRemittance, actualAmount: line.actualAmount });
  const now = new Date();

  await db
    .insert(numbatrakRemittanceLines)
    .values({
      organizationId,
      agentId,
      remittanceDate,
      totalDeliveredValue: String(line.totalDeliveredValue),
      totalDeliveryFees: String(line.totalDeliveryFees),
      netOffAmount: String(newNetOff),
      expectedRemittance: String(expectedRemittance),
      actualAmount: line.actualAmount != null ? String(line.actualAmount) : null,
      status,
      netOffExpenseId: expense?.id ?? null,
      notes: line.notes,
    })
    .onConflictDoUpdate({
      target: [
        numbatrakRemittanceLines.organizationId,
        numbatrakRemittanceLines.agentId,
        numbatrakRemittanceLines.remittanceDate,
      ],
      set: {
        netOffAmount: String(newNetOff),
        expectedRemittance: String(expectedRemittance),
        status,
        netOffExpenseId: expense?.id,
        updatedAt: now,
      },
    });

  return {
    ...line,
    netOffAmount: newNetOff,
    expectedRemittance,
    status,
    netOffExpenseId: expense?.id ?? line.netOffExpenseId,
    shortfall: line.actualAmount != null && status === "short" ? Math.max(0, expectedRemittance - line.actualAmount) : 0,
  };
}
