import { useCallback, useEffect, useState } from "react";
import { PageLayout } from "../layout/PageLayout";
import { useOrganization } from "../../contexts/OrganizationContext";
import { usePermissions } from "../../hooks/usePermissions";
import {
  fetchAttendanceSettings,
  updateAttendanceSettings,
  fetchAttendanceEvents,
  createAttendanceEvent,
  fetchAttendanceEventDetail,
  markAttendance,
  exemptFromAttendance,
  closeAttendanceEvent,
  type AttendanceSettings,
  type AttendanceEvent,
  type AttendanceEventDetail,
} from "../../services/attendance";
import { Calendar, Plus, Lock, UserCheck, Clock, XCircle, Shield } from "lucide-react";

export function AttendancePage() {
  const { currentOrganization } = useOrganization();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("attendance", "canUpdate");

  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<AttendanceEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 16));

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const [s, e] = await Promise.all([fetchAttendanceSettings(), fetchAttendanceEvents()]);
      setSettings(s);
      setEvents(e);
    } catch (err) {
      console.error("Failed to load attendance data", err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => { void load(); }, [load]);

  const handleToggle = async () => {
    if (!settings) return;
    const updated = await updateAttendanceSettings({ enabled: !settings.enabled });
    setSettings(updated);
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await createAttendanceEvent({ title: newTitle.trim(), description: newDescription.trim() || null, eventDate: new Date(newDate).toISOString() });
    setShowCreate(false);
    setNewTitle("");
    setNewDescription("");
    void load();
  };

  const handleSelectEvent = async (eventId: string) => {
    try {
      const detail = await fetchAttendanceEventDetail(eventId);
      setSelectedEvent(detail);
    } catch (err) {
      console.error("Failed to load event detail", err);
    }
  };

  const handleMark = async (staffId: string, status: "present" | "late" | "absent") => {
    if (!selectedEvent) return;
    await markAttendance(selectedEvent.id, staffId, status);
    await handleSelectEvent(selectedEvent.id);
  };

  const handleExempt = async (staffId: string) => {
    if (!selectedEvent) return;
    const reason = prompt("Exempt reason:");
    if (!reason) return;
    await exemptFromAttendance(selectedEvent.id, staffId, reason);
    await handleSelectEvent(selectedEvent.id);
  };

  const handleClose = async (eventId: string) => {
    await closeAttendanceEvent(eventId);
    setSelectedEvent(null);
    void load();
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="text-muted-foreground">Loading...</div>
      </PageLayout>
    );
  }

  if (settings && !settings.enabled) {
    return (
      <PageLayout>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Attendance</h1>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground" />
          <p className="text-muted-foreground">Attendance tracking is disabled for this organization.</p>
          {canManage && (
            <button
              onClick={handleToggle}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              Enable Attendance
            </button>
          )}
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Attendance</h1>
        <div className="flex items-center gap-3">
          {canManage && (
            <>
              <button
                onClick={handleToggle}
                className="px-3 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                Disable Module
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                New Event
              </button>
            </>
          )}
        </div>
      </div>

      {settings && (
        <div className="text-sm text-muted-foreground">
          Auto-close window: {settings.auto_close_window_minutes} minutes
        </div>
      )}

      {showCreate && (
        <div className="p-4 rounded-lg border border-border bg-card space-y-3">
          <h3 className="font-medium text-foreground">Create Attendance Event</h3>
          <input
            type="text"
            placeholder="Event title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
          />
          <input
            type="datetime-local"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {selectedEvent ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-sm text-primary hover:underline mb-2"
              >
                Back to events
              </button>
              <h2 className="text-lg font-medium text-foreground">{selectedEvent.title}</h2>
              <p className="text-sm text-muted-foreground">
                {new Date(selectedEvent.event_date).toLocaleString()} - {selectedEvent.status === "open" ? "Open" : "Closed"}
              </p>
            </div>
            {canManage && selectedEvent.status === "open" && (
              <button
                onClick={() => handleClose(selectedEvent.id)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm hover:bg-muted"
              >
                <Lock className="w-4 h-4" />
                Close Event
              </button>
            )}
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Staff</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Marked At</th>
                  {canManage && selectedEvent.status === "open" && (
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {selectedEvent.records.map((record) => (
                  <tr key={record.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{record.staff_name ?? record.staff_id}</td>
                    <td className="px-4 py-3 text-center">
                      <AttendanceStatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {record.marked_at ? new Date(record.marked_at).toLocaleString() : "-"}
                    </td>
                    {canManage && selectedEvent.status === "open" && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleMark(record.staff_id, "present")} className="p-1 rounded hover:bg-muted" title="Present">
                            <UserCheck className="w-4 h-4 text-green-600" />
                          </button>
                          <button onClick={() => handleMark(record.staff_id, "late")} className="p-1 rounded hover:bg-muted" title="Late">
                            <Clock className="w-4 h-4 text-yellow-500" />
                          </button>
                          <button onClick={() => handleMark(record.staff_id, "absent")} className="p-1 rounded hover:bg-muted" title="Absent">
                            <XCircle className="w-4 h-4 text-destructive" />
                          </button>
                          <button onClick={() => handleExempt(record.staff_id)} className="p-1 rounded hover:bg-muted" title="Exempt">
                            <Shield className="w-4 h-4 text-blue-500" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedEvent.records.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">No attendance records yet.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {events.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border border-border rounded-lg">
              No attendance events yet.
            </div>
          ) : (
            events.map((event) => (
              <button
                key={event.id}
                onClick={() => handleSelectEvent(event.id)}
                className="w-full text-left p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-foreground">{event.title}</div>
                    {event.description && (
                      <div className="text-sm text-muted-foreground mt-1">{event.description}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(event.event_date).toLocaleString()}
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    event.status === "open"
                      ? "text-green-600 bg-green-100 dark:bg-green-900/30"
                      : "text-muted-foreground bg-muted"
                  }`}>
                    {event.status === "open" ? "Open" : "Closed"}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </PageLayout>
  );
}

function AttendanceStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    present: "text-green-600 bg-green-100 dark:bg-green-900/30",
    late: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30",
    absent: "text-red-600 bg-red-100 dark:bg-red-900/30",
    exempt: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
  };
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-1 rounded-full ${styles[status] ?? "text-muted-foreground bg-muted"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
