/**
 * Utility functions for calculating work hours (9 AM - 5 PM, Monday-Friday)
 */

/**
 * Check if a date is within work hours (9 AM - 5 PM, Monday-Friday)
 */
export function isWorkHours(date: Date): boolean {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false; // Weekend
  }

  const hours = date.getHours();
  return hours >= 9 && hours < 17; // 9 AM to 5 PM
}

/**
 * Check if a date is a weekday (Monday-Friday)
 */
export function isWeekday(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek !== 0 && dayOfWeek !== 6;
}

/**
 * Get the start of work hours for a given date (9 AM)
 */
export function getWorkDayStart(date: Date): Date {
  const start = new Date(date);
  start.setHours(9, 0, 0, 0);
  return start;
}

/**
 * Get the end of work hours for a given date (5 PM)
 */
export function getWorkDayEnd(date: Date): Date {
  const end = new Date(date);
  end.setHours(17, 0, 0, 0);
  return end;
}

/**
 * Calculate work hours (in minutes) between two dates
 * Only counts time between 9 AM - 5 PM on weekdays
 */
export function calculateWorkHoursMinutes(
  startTime: Date,
  endTime: Date
): number {
  if (endTime < startTime) {
    return 0;
  }

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
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        totalMinutes += diffMinutes;
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
    currentDate.setHours(0, 0, 0, 0);
  }

  return totalMinutes;
}

/**
 * Check if response time meets SLA (1 hour during work hours)
 */
export function meetsSLA(responseTimeMinutes: number | null): boolean {
  if (responseTimeMinutes === null) return false;
  return responseTimeMinutes <= 60; // 1 hour = 60 minutes
}

/**
 * Format work hours minutes to human-readable string
 */
export function formatWorkHours(minutes: number | null): string {
  if (minutes === null) return "N/A";

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}

/**
 * Get next work day start (9 AM) from a given date
 */
export function getNextWorkDayStart(date: Date): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);

  // Skip weekends
  while (!isWeekday(next)) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}






