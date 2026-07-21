/** Columns guaranteed on user_profiles before avatar migration. */
export const USER_PROFILE_BASE_COLUMNS =
  "id, email, full_name, role, email_verified, created_at, updated_at" as const;

export const USER_PROFILE_COLUMNS_WITH_AVATAR =
  `${USER_PROFILE_BASE_COLUMNS}, avatar_url` as const;

export const USER_PROFILE_COLUMNS_EXTENDED =
  `${USER_PROFILE_COLUMNS_WITH_AVATAR}, phone, whatsapp_number, timezone` as const;

/** PostgREST / Postgres errors when avatar_url column is not migrated yet. */
export function isMissingAvatarColumnError(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  const msg = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    msg.includes("avatar_url") ||
    msg.includes("column") && msg.includes("does not exist")
  );
}
