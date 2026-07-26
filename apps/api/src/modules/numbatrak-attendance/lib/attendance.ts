import { and, eq, sql, desc } from "drizzle-orm";
import {
  numbatrakAttendanceSettings,
  numbatrakAttendanceEvents,
  numbatrakAttendanceRecords,
  numbatrakStaff,
  user,
  type Database,
} from "@platform/db";
import type {
  NumbatrakAttendanceSettings,
  NumbatrakAttendanceEvent,
  NumbatrakAttendanceEventDetail,
  NumbatrakAttendanceRecord,
} from "@platform/shared-types";

type SettingsRow = typeof numbatrakAttendanceSettings.$inferSelect;
type EventRow = typeof numbatrakAttendanceEvents.$inferSelect;
type RecordRow = typeof numbatrakAttendanceRecords.$inferSelect;

function serializeSettings(row: SettingsRow): NumbatrakAttendanceSettings {
  return {
    id: row.id,
    enabled: row.enabled,
    autoCloseWindowMinutes: row.autoCloseWindowMinutes,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeEvent(row: EventRow): NumbatrakAttendanceEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eventDate: row.eventDate?.toISOString() ?? "",
    status: row.status as "open" | "closed",
    closedAt: row.closedAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeRecord(row: RecordRow, staffName: string | null): NumbatrakAttendanceRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    staffId: row.staffId,
    staffName,
    status: row.status as NumbatrakAttendanceRecord["status"],
    markedAt: row.markedAt?.toISOString() ?? null,
    exemptReason: row.exemptReason,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export async function getOrCreateSettings(db: Database, organizationId: string): Promise<NumbatrakAttendanceSettings> {
  const [existing] = await db
    .select()
    .from(numbatrakAttendanceSettings)
    .where(eq(numbatrakAttendanceSettings.organizationId, organizationId))
    .limit(1);

  if (existing) return serializeSettings(existing);

  const [row] = await db
    .insert(numbatrakAttendanceSettings)
    .values({ organizationId })
    .returning();
  return serializeSettings(row!);
}

export async function updateSettings(
  db: Database,
  organizationId: string,
  input: { enabled?: boolean; autoCloseWindowMinutes?: number },
): Promise<NumbatrakAttendanceSettings> {
  const current = await getOrCreateSettings(db, organizationId);
  const values: Partial<typeof numbatrakAttendanceSettings.$inferInsert> = { updatedAt: new Date() };
  if (input.enabled !== undefined) values.enabled = input.enabled;
  if (input.autoCloseWindowMinutes !== undefined) values.autoCloseWindowMinutes = input.autoCloseWindowMinutes;

  const [row] = await db
    .update(numbatrakAttendanceSettings)
    .set(values)
    .where(eq(numbatrakAttendanceSettings.id, current.id))
    .returning();
  return serializeSettings(row!);
}

export async function listEvents(db: Database, organizationId: string): Promise<NumbatrakAttendanceEvent[]> {
  const rows = await db
    .select()
    .from(numbatrakAttendanceEvents)
    .where(eq(numbatrakAttendanceEvents.organizationId, organizationId))
    .orderBy(desc(numbatrakAttendanceEvents.eventDate));
  return rows.map(serializeEvent);
}

export async function createEvent(
  db: Database,
  organizationId: string,
  input: { title: string; description?: string | null; eventDate: string },
  createdBy: string,
): Promise<NumbatrakAttendanceEvent> {
  const [row] = await db
    .insert(numbatrakAttendanceEvents)
    .values({
      organizationId,
      title: input.title,
      description: input.description ?? null,
      eventDate: new Date(input.eventDate),
      createdBy,
    })
    .returning();
  return serializeEvent(row!);
}

export async function getEventDetail(
  db: Database,
  organizationId: string,
  eventId: string,
): Promise<NumbatrakAttendanceEventDetail | null> {
  const [event] = await db
    .select()
    .from(numbatrakAttendanceEvents)
    .where(and(eq(numbatrakAttendanceEvents.id, eventId), eq(numbatrakAttendanceEvents.organizationId, organizationId)))
    .limit(1);
  if (!event) return null;

  const recordRows = await db
    .select({ record: numbatrakAttendanceRecords, userName: user.name })
    .from(numbatrakAttendanceRecords)
    .innerJoin(numbatrakStaff, eq(numbatrakAttendanceRecords.staffId, numbatrakStaff.id))
    .innerJoin(user, eq(numbatrakStaff.userId, user.id))
    .where(eq(numbatrakAttendanceRecords.eventId, eventId));

  return {
    ...serializeEvent(event),
    records: recordRows.map((r) => serializeRecord(r.record, r.userName)),
  };
}

export async function markAttendance(
  db: Database,
  eventId: string,
  staffId: string,
  status: string,
  markedBy: string,
): Promise<NumbatrakAttendanceRecord> {
  const [existing] = await db
    .select()
    .from(numbatrakAttendanceRecords)
    .where(and(eq(numbatrakAttendanceRecords.eventId, eventId), eq(numbatrakAttendanceRecords.staffId, staffId)))
    .limit(1);

  if (existing) {
    const [row] = await db
      .update(numbatrakAttendanceRecords)
      .set({ status, markedAt: new Date(), markedBy, updatedAt: new Date() })
      .where(eq(numbatrakAttendanceRecords.id, existing.id))
      .returning();
    return serializeRecord(row!, null);
  }

  const [row] = await db
    .insert(numbatrakAttendanceRecords)
    .values({ eventId, staffId, status, markedAt: new Date(), markedBy })
    .returning();
  return serializeRecord(row!, null);
}

export async function exemptStaff(
  db: Database,
  eventId: string,
  staffId: string,
  exemptReason: string,
  markedBy: string,
): Promise<NumbatrakAttendanceRecord> {
  const [existing] = await db
    .select()
    .from(numbatrakAttendanceRecords)
    .where(and(eq(numbatrakAttendanceRecords.eventId, eventId), eq(numbatrakAttendanceRecords.staffId, staffId)))
    .limit(1);

  if (existing) {
    const [row] = await db
      .update(numbatrakAttendanceRecords)
      .set({ status: "exempt", exemptReason, markedBy, updatedAt: new Date() })
      .where(eq(numbatrakAttendanceRecords.id, existing.id))
      .returning();
    return serializeRecord(row!, null);
  }

  const [row] = await db
    .insert(numbatrakAttendanceRecords)
    .values({ eventId, staffId, status: "exempt", exemptReason, markedBy })
    .returning();
  return serializeRecord(row!, null);
}

export async function closeEvent(
  db: Database,
  organizationId: string,
  eventId: string,
): Promise<NumbatrakAttendanceEvent | null> {
  return db.transaction(async (tx) => {
    const [event] = await tx
      .select()
      .from(numbatrakAttendanceEvents)
      .where(and(eq(numbatrakAttendanceEvents.id, eventId), eq(numbatrakAttendanceEvents.organizationId, organizationId)))
      .limit(1);
    if (!event || event.status === "closed") return event ? serializeEvent(event) : null;

    const activeStaff = await tx
      .select({ id: numbatrakStaff.id })
      .from(numbatrakStaff)
      .where(and(eq(numbatrakStaff.organizationId, organizationId), eq(numbatrakStaff.active, true)));

    const existingRecords = await tx
      .select({ staffId: numbatrakAttendanceRecords.staffId })
      .from(numbatrakAttendanceRecords)
      .where(eq(numbatrakAttendanceRecords.eventId, eventId));

    const markedStaffIds = new Set(existingRecords.map((r) => r.staffId));

    const unmarked = activeStaff.filter((s) => !markedStaffIds.has(s.id));
    if (unmarked.length > 0) {
      await tx.insert(numbatrakAttendanceRecords).values(
        unmarked.map((s) => ({ eventId, staffId: s.id, status: "absent" })),
      );
    }

    const [row] = await tx
      .update(numbatrakAttendanceEvents)
      .set({ status: "closed", closedAt: new Date(), updatedAt: new Date() })
      .where(eq(numbatrakAttendanceEvents.id, eventId))
      .returning();
    return serializeEvent(row!);
  });
}
