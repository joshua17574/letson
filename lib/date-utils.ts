// lib/date-utils.ts
//
// The business operates in the Philippines (Asia/Manila, fixed UTC+8, no
// daylight saving). Deployment servers commonly run in UTC, where
// `new Date(y, m, d)` produces day boundaries that are off by 8 hours for
// Philippine users. These helpers compute Manila calendar boundaries
// regardless of the server's timezone.
//
// Note on stored date-only fields (saleDate, slicingDate, deliveryDate,
// expenseDate): they are parsed from "YYYY-MM-DD" strings into UTC midnight.
// UTC midnight of calendar day D always falls inside the Manila day D range
// [D-1T16:00Z, DT16:00Z), so these boundaries work correctly for both true
// timestamps (createdAt) and date-only fields.

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Year/month/day of the given instant as seen on a Manila calendar. */
function manilaCalendarParts(date: Date) {
  const shifted = new Date(date.getTime() + MANILA_OFFSET_MS);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

/** Instant at which the Manila calendar day containing `date` begins. */
export function startOfDayManila(date: Date = new Date()) {
  const { year, month, day } = manilaCalendarParts(date);
  return new Date(Date.UTC(year, month, day) - MANILA_OFFSET_MS);
}

/** Instant at which the Manila calendar month containing `date` begins. */
export function startOfMonthManila(date: Date = new Date()) {
  const { year, month } = manilaCalendarParts(date);
  return new Date(Date.UTC(year, month, 1) - MANILA_OFFSET_MS);
}

/** Instant at which the next Manila calendar month begins. */
export function startOfNextMonthManila(date: Date = new Date()) {
  const { year, month } = manilaCalendarParts(date);
  return new Date(Date.UTC(year, month + 1, 1) - MANILA_OFFSET_MS);
}

/** Adds whole days to an instant (timezone-agnostic). */
export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** "YYYY-MM-DD" for the Manila calendar day containing `date`. */
export function manilaDateString(date: Date = new Date()) {
  const { year, month, day } = manilaCalendarParts(date);
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}
