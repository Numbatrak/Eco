/** Parse abandoned-cart selected_items (JSON array, CSV, or plain text). */
export function parseSelectedItems(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];

  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
    if (parsed && typeof parsed === "object") {
      return Object.values(parsed)
        .map((item) => String(item).trim())
        .filter(Boolean);
    }
  } catch {
    // fall through
  }

  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [trimmed];
}
