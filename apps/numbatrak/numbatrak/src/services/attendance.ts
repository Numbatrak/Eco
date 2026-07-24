"use client";

import { apiRequest } from "../lib/apiClient";

export interface AttendanceSettings {
  id: string;
  enabled: boolean;
  auto_close_window_minutes: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface AttendanceEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  status: "open" | "closed";
  closed_at: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AttendanceRecord {
  id: string;
  event_id: string;
  staff_id: string;
  staff_name: string | null;
  status: "present" | "late" | "absent" | "exempt";
  marked_at: string | null;
  exempt_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AttendanceEventDetail extends AttendanceEvent {
  records: AttendanceRecord[];
}

interface SettingsDto {
  id: string;
  enabled: boolean;
  autoCloseWindowMinutes: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface EventDto {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  status: string;
  closedAt: string | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface RecordDto {
  id: string;
  eventId: string;
  staffId: string;
  staffName: string | null;
  status: string;
  markedAt: string | null;
  exemptReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function settingsFromDto(dto: SettingsDto): AttendanceSettings {
  return {
    id: dto.id,
    enabled: dto.enabled,
    auto_close_window_minutes: dto.autoCloseWindowMinutes,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

function eventFromDto(dto: EventDto): AttendanceEvent {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description,
    event_date: dto.eventDate,
    status: dto.status as AttendanceEvent["status"],
    closed_at: dto.closedAt,
    created_by: dto.createdBy,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

function recordFromDto(dto: RecordDto): AttendanceRecord {
  return {
    id: dto.id,
    event_id: dto.eventId,
    staff_id: dto.staffId,
    staff_name: dto.staffName,
    status: dto.status as AttendanceRecord["status"],
    marked_at: dto.markedAt,
    exempt_reason: dto.exemptReason,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

export async function fetchAttendanceSettings(): Promise<AttendanceSettings> {
  const dto = await apiRequest<SettingsDto>("/org/numbatrak/attendance/settings");
  return settingsFromDto(dto);
}

export async function updateAttendanceSettings(input: {
  enabled?: boolean;
  autoCloseWindowMinutes?: number;
}): Promise<AttendanceSettings> {
  const dto = await apiRequest<SettingsDto>("/org/numbatrak/attendance/settings", {
    method: "PATCH",
    body: input,
  });
  return settingsFromDto(dto);
}

export async function fetchAttendanceEvents(): Promise<AttendanceEvent[]> {
  const { events } = await apiRequest<{ events: EventDto[] }>("/org/numbatrak/attendance/events");
  return events.map(eventFromDto);
}

export async function createAttendanceEvent(input: {
  title: string;
  description?: string | null;
  eventDate: string;
}): Promise<AttendanceEvent> {
  const dto = await apiRequest<EventDto>("/org/numbatrak/attendance/events", {
    method: "POST",
    body: input,
  });
  return eventFromDto(dto);
}

export async function fetchAttendanceEventDetail(eventId: string): Promise<AttendanceEventDetail> {
  const dto = await apiRequest<EventDto & { records: RecordDto[] }>(
    `/org/numbatrak/attendance/events/${eventId}`,
  );
  return {
    ...eventFromDto(dto),
    records: dto.records.map(recordFromDto),
  };
}

export async function markAttendance(
  eventId: string,
  staffId: string,
  status: "present" | "late" | "absent",
): Promise<AttendanceRecord> {
  const dto = await apiRequest<RecordDto>(`/org/numbatrak/attendance/events/${eventId}/mark`, {
    method: "POST",
    body: { staffId, status },
  });
  return recordFromDto(dto);
}

export async function exemptFromAttendance(
  eventId: string,
  staffId: string,
  exemptReason: string,
): Promise<AttendanceRecord> {
  const dto = await apiRequest<RecordDto>(`/org/numbatrak/attendance/events/${eventId}/exempt`, {
    method: "POST",
    body: { staffId, exemptReason },
  });
  return recordFromDto(dto);
}

export async function closeAttendanceEvent(eventId: string): Promise<AttendanceEvent> {
  const dto = await apiRequest<EventDto>(`/org/numbatrak/attendance/events/${eventId}/close`, {
    method: "POST",
  });
  return eventFromDto(dto);
}
