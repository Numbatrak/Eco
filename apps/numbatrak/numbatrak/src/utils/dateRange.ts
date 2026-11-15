export type DateFilterType =
  | "all"
  | "today"
  // Rolling windows. Unlike "this_week"/"this_month" these are unambiguous -
  // they don't depend on which day the week starts or how far into the month
  // you are, so period-over-period comparison is like-for-like.
  | "last_7_days"
  | "last_30_days"
  | "this_week"
  | "this_month"
  | "custom";

export interface DateFilter {
  type: DateFilterType;
  startDate?: string;
  endDate?: string;
}

/** Resolve a UI date filter to ISO bounds (inclusive end-of-day). */
export function resolveDateRange(dateFilter?: DateFilter): {
  startDate?: string;
  endDate?: string;
} {
  if (!dateFilter || dateFilter.type === "all") {
    return {};
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let startDate: string | undefined;
  let endDate: string | undefined;

  switch (dateFilter.type) {
    case "today":
      startDate = today.toISOString();
      endDate = new Date(
        today.getTime() + 24 * 60 * 60 * 1000 - 1
      ).toISOString();
      break;
    case "last_7_days":
    case "last_30_days": {
      const days = dateFilter.type === "last_7_days" ? 7 : 30;
      // Inclusive of today, so "7d" spans today plus the six days before it.
      const start = new Date(today);
      start.setDate(today.getDate() - (days - 1));
      start.setHours(0, 0, 0, 0);
      startDate = start.toISOString();
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
      break;
    }
    case "this_week": {
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);
      startDate = startOfWeek.toISOString();
      endDate = new Date(
        today.getTime() + 24 * 60 * 60 * 1000 - 1
      ).toISOString();
      break;
    }
    case "this_month": {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      startDate = startOfMonth.toISOString();
      endDate = new Date(
        today.getTime() + 24 * 60 * 60 * 1000 - 1
      ).toISOString();
      break;
    }
    case "custom":
      if (dateFilter.startDate) {
        const customStart = new Date(dateFilter.startDate);
        customStart.setHours(0, 0, 0, 0);
        startDate = customStart.toISOString();
      }
      if (dateFilter.endDate) {
        const customEnd = new Date(dateFilter.endDate);
        customEnd.setHours(23, 59, 59, 999);
        endDate = customEnd.toISOString();
      }
      break;
  }

  return { startDate, endDate };
}

export function withinDateRange(
  dateToCheck: string | null | undefined,
  startDate?: string,
  endDate?: string
): boolean {
  if (!dateToCheck) return false;
  const d = new Date(dateToCheck);
  if (startDate && d < new Date(startDate)) return false;
  if (endDate && d > new Date(endDate)) return false;
  return true;
}
