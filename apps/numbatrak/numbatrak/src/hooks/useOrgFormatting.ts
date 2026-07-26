import { useOrganization } from "../contexts/OrganizationContext";
import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from "../constants/profileOptions";
import { formatCurrency } from "../utils/currency";

/** Org-scoped currency/timezone helpers for display formatting. */
export function useOrgFormatting() {
  const { currentOrganization } = useOrganization();
  const currency = currentOrganization?.currency ?? DEFAULT_CURRENCY;
  const timezone = currentOrganization?.timezone ?? DEFAULT_TIMEZONE;

  return {
    currency,
    timezone,
    formatMoney: (
      value: number | null | undefined,
      options?: { decimals?: number; fallback?: string }
    ) => formatCurrency(value, currency, options),
  };
}
