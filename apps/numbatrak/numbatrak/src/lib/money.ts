/** Money is always integer cents in the storefront's data model - this is the only place cents become a display string. */
export function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}
