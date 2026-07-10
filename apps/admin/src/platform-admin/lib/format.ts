const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatCents(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}
