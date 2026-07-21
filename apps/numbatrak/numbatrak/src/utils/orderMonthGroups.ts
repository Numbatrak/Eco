import { FormResponseWithItems } from "../types/formResponse";

export type OrderMonthGroup = {
  key: string;
  label: string;
  items: FormResponseWithItems[];
};

/** Group orders by calendar month (newest month first). */
export function groupOrdersByMonth(
  orders: FormResponseWithItems[]
): OrderMonthGroup[] {
  const byMonth = new Map<string, FormResponseWithItems[]>();

  for (const order of orders) {
    const d = order.created_at ? new Date(order.created_at) : new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const list = byMonth.get(key) ?? [];
    list.push(order);
    byMonth.set(key, list);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => ({
      key,
      label: formatMonthHeader(key, items[0]?.created_at),
      items,
    }));
}

function formatMonthHeader(
  key: string,
  sampleDate?: string | null
): string {
  const [y, m] = key.split("-").map(Number);
  const date = sampleDate ? new Date(sampleDate) : new Date(y, m - 1, 1);
  return date
    .toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    .toUpperCase();
}
