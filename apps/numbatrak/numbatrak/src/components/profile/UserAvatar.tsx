import { User } from "lucide-react";
import { getDisplayName, getUserInitials } from "../../utils/userDisplay";
import type { UserNameFields } from "../../utils/userDisplay";

type UserAvatarProps = {
  profile?: UserNameFields & { avatar_url?: string | null };
  size?: number;
  className?: string;
};

export function UserAvatar({
  profile,
  size = 32,
  className = "",
}: UserAvatarProps) {
  const displayName = getDisplayName(
    profile ?? {},
    profile?.email?.split("@")[0] ?? "User"
  );
  const avatarUrl = profile?.avatar_url;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName}
        className={`rounded-full border border-border object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const initials = getUserInitials(displayName);
  const showInitials = initials !== "?" && displayName !== "Unnamed user";

  if (showInitials) {
    return (
      <div
        className={`rounded-full border border-border bg-primary/15 text-primary flex items-center justify-center font-semibold shrink-0 ${className}`}
        style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
        aria-hidden
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`rounded-full border border-border bg-muted flex items-center justify-center text-muted-foreground shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <User style={{ width: size * 0.55, height: size * 0.55 }} />
    </div>
  );
}
