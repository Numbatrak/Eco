// Server-side port of src/utils/orderNotes.ts, kept verbatim (same stamp
// format the source frontend already displays/expects).

export function appendOrderNote(existing: string | null | undefined, note: string): string {
  const trimmed = note.trim();
  if (!trimmed) return existing?.trim() ?? "";

  const stamp = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const line = `[${stamp}] ${trimmed}`;
  const base = existing?.trim();
  return base ? `${base}\n${line}` : line;
}

/** Stamp notes when content changed (not when clearing). Returns undefined = no change. */
export function mergeOrderNotesOnSave(
  previous: string | null | undefined,
  next: string | null | undefined,
): string | undefined {
  const prev = (previous ?? "").trim();
  const nxt = (next ?? "").trim();
  if (nxt === prev) return undefined;
  if (!nxt) return "";
  if (!prev) return appendOrderNote(null, nxt);
  if (nxt.startsWith(prev)) {
    const added = nxt.slice(prev.length).trim();
    if (added) return appendOrderNote(prev, added);
  }
  return appendOrderNote(null, nxt);
}
