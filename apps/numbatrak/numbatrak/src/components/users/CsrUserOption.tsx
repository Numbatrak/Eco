import { getDisplayName } from "../../utils/userDisplay";

type CsrUserOptionProps = {
  full_name?: string | null;
  email?: string | null;
  nameFallback?: string;
};

/** Two-line CSR label: name on top, email below. */
export function CsrUserOption({
  full_name,
  email,
  nameFallback = "Unnamed CSR",
}: CsrUserOptionProps) {
  const displayName = getDisplayName({ full_name, email }, nameFallback);

  return (
    <span className="flex flex-col items-start gap-0.5 py-0.5 text-left">
      <span className="text-sm font-medium leading-tight">{displayName}</span>
      {email && (
        <span className="text-xs text-muted-foreground leading-tight">
          {email}
        </span>
      )}
    </span>
  );
}
