export function formatDeliveryRate(rate: number | null | undefined): string {
  if (rate == null || Number.isNaN(rate)) return "—";
  return `${rate.toFixed(1)}%`;
}
