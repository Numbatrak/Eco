/** Detect whether a stored "name" is really an email (legacy signup backfill). */
export function isEmailLikeName(
  value: string | null | undefined,
  email?: string | null
): boolean {
  if (!value?.trim()) return true;
  const trimmed = value.trim();
  if (email && trimmed.toLowerCase() === email.trim().toLowerCase()) {
    return true;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/** First + last name joined with a single space; empty parts omitted. */
export function composeFullName(
  firstName: string,
  lastName: string
): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

/** Split a full name into first / last (first token vs remainder). */
export function splitFullName(fullName: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  if (!fullName?.trim() || isEmailLikeName(fullName)) {
    return { firstName: "", lastName: "" };
  }
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export type UserNameFields = {
  full_name?: string | null;
  email?: string | null;
};

/** Human-readable display name; never returns a raw email as the name. */
export function getDisplayName(
  profile: UserNameFields,
  fallback = "Unnamed user"
): string {
  const { full_name, email } = profile;
  if (full_name?.trim() && !isEmailLikeName(full_name, email)) {
    return full_name.trim();
  }
  return fallback;
}

/** Label for CSR selects and filter chips: "First Last" or fallback, always distinct from email. */
export function formatCsrSelectLabel(profile: UserNameFields): string {
  const name = getDisplayName(profile, "Unnamed CSR");
  const email = profile.email?.trim();
  if (email) {
    return `${name} · ${email}`;
  }
  return name;
}

/** Up to two initials from a display name. */
export function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
