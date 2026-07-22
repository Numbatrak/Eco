// Verbatim server-side port of src/utils/workHours.ts's calculateWorkHoursMinutes
// (9am-5pm Mon-Fri SLA math) - can't import frontend code from apps/api.

function isWeekday(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek !== 0 && dayOfWeek !== 6;
}

export function calculateWorkHoursMinutes(startTime: Date, endTime: Date): number {
  if (endTime < startTime) return 0;

  let totalMinutes = 0;
  const currentDate = new Date(startTime);
  currentDate.setHours(0, 0, 0, 0);

  const endDate = new Date(endTime);
  endDate.setHours(23, 59, 59, 999);

  while (currentDate <= endDate) {
    if (isWeekday(currentDate)) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(9, 0, 0, 0);

      const dayEnd = new Date(currentDate);
      dayEnd.setHours(17, 0, 0, 0);

      const effectiveStart = startTime > dayStart ? startTime : dayStart;
      const effectiveEnd = endTime < dayEnd ? endTime : dayEnd;

      if (effectiveStart < effectiveEnd) {
        const diffMs = effectiveEnd.getTime() - effectiveStart.getTime();
        totalMinutes += Math.floor(diffMs / (1000 * 60));
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
    currentDate.setHours(0, 0, 0, 0);
  }

  return totalMinutes;
}
