// Naira only — the locked money model forbids dollar pricing for this market.
// Amounts are stored in kobo (minor units), so divide by 100.
const currencyFormatter = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });

export function formatCents(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

export function formatPercent(value: number | null, digits = 1): string {
  return value === null ? "—" : `${value.toFixed(digits)}%`;
}

export function formatRatio(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}:1`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}
