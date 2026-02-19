// utils/DateUtils.ts
// Centralized date utility functions for consistent date handling
// Fixes ISO date format inconsistencies from SharePoint
import { isWeekendDay as configIsWeekend } from '../config/WorkWeekConfig';


// ============================================================================
// ADDITIONAL UTILITIES FOR CALENDAR DATE HANDLING
// Add these to the END of the existing DateUtils.ts file
// ============================================================================

/**
 * Create a local date at midnight (no timezone shift)
 * Use this for calendar date creation instead of new Date(dateString)
 * @param year Full year (e.g., 2026)
 * @param month Month (0-11, where 0=January)
 * @param day Day of month (1-31)
 */
export function createLocalDate(year: number, month: number, day: number): Date {
  return new Date(year, month, day, 0, 0, 0, 0);
}

/**
 * Parse YYYY-MM-DD string safely to local midnight
 * Use this when parsing date strings from SharePoint
 * @param dateString Date in YYYY-MM-DD format
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return createLocalDate(year, month - 1, day); // month-1 because string is 1-based
}

/**
 * Get today at local midnight (for comparison)
 * Better alternative to getTodayString() when working with Date objects
 */
export function getTodayLocal(): Date {
  const now = new Date();
  return createLocalDate(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Check if two dates are the same day (ignoring time)
 * More reliable than comparing date strings
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

/**
 * Check if date is today (Date object version)
 * Complements the existing isToday() which uses strings
 */
export function isTodayDate(date: Date): boolean {
  return isSameDay(date, getTodayLocal());
}

/**
 * Convert SharePoint ISO date to local date
 * SharePoint returns: "2026-02-01T00:00:00Z" or "2026-02-01T00:00:00"
 */
export function convertSharePointDate(isoString: string | null | undefined): Date | null {
  if (!isoString) return null;
  
  // Extract date part only to avoid timezone issues
  const dateOnly = isoString.split('T')[0]; // "2026-02-01"
  return parseLocalDate(dateOnly);
}
/**
 * Normalize any date input to YYYY-MM-DD format — TIMEZONE SAFE.
 *
 * ROOT CAUSE OF DATE-SHIFT BUG (now fixed here):
 *   SharePoint returns DateTime columns as UTC ISO strings, e.g.:
 *     "2026-02-17T18:30:00Z"  ← UTC time of the biometric sync event
 *   The OLD implementation passed this string to new Date(), which the
 *   browser parses as UTC and immediately converts to the local timezone.
 *   In IST (+5:30): 18:30 UTC on the 17th = 00:00 IST on the 18th.
 *   Calling .getDate() on that Date object returned 18 instead of 17.
 *   Every caller that received this result stored the WRONG date key,
 *   causing punch records for the 17th to be attributed to the 18th cell.
 *
 * THE FIX — for string inputs:
 *   SharePoint always encodes the calendar date in the YYYY-MM-DD prefix
 *   of its ISO datetime strings, before the 'T'.  We read those characters
 *   directly from the string without creating a Date object at all.
 *   No timezone conversion, no drift, no +1/-1 day shift possible.
 *   This is identical to how TimesheetView already handles dates (string
 *   comparison only), which is why Timesheet shows 17 and Attendance showed 18.
 *
 * THE FIX — for Date object inputs:
 *   Date objects have no timezone representation — they store UTC milliseconds.
 *   We always read them with LOCAL accessors (.getFullYear / .getMonth / .getDate)
 *   which return the value in the browser's local timezone, NOT toISOString()
 *   which converts back to UTC and would re-introduce the shift.
 *
 * @param dateInput  SharePoint ISO string, plain YYYY-MM-DD string, Date object,
 *                   or null / undefined
 * @returns          Normalized YYYY-MM-DD string, or '' if input is invalid
 */
export function normalizeDateToString(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';

  try {
    if (typeof dateInput === 'string') {

      // ── FAST PATH 1: already bare YYYY-MM-DD ────────────────────────────────
      // e.g. "2026-02-17"  →  return as-is, no parsing needed
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        return dateInput;
      }

      // ── FAST PATH 2: ISO datetime with 'T' separator ────────────────────────
      // e.g. "2026-02-17T18:30:00Z"        →  "2026-02-17"  ✅
      //      "2026-02-17T00:00:00.0000000"  →  "2026-02-17"  ✅
      //      "2026-02-17T18:30:00+05:30"    →  "2026-02-17"  ✅
      //
      // OLD UTC DATE LOGIC COMMENTED – caused +1 day shift in IST (+5:30):
      // date = new Date(dateInput);        // ← browser converts UTC → local
      // const day = date.getDate();        // ← returns LOCAL day (shifted!) ❌
      if (dateInput.indexOf('T') !== -1) {
        const datePart = dateInput.split('T')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          return datePart; // ✅ pure string slice — zero Date objects, zero timezone
        }
      }

      // ── FAST PATH 3: space-separated datetime ───────────────────────────────
      // e.g. "2026-02-17 18:30:00"  →  "2026-02-17"  ✅
      if (dateInput.indexOf(' ') !== -1) {
        const datePart = dateInput.split(' ')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          return datePart; // ✅ pure string slice
        }
      }

      // ── LAST RESORT: non-standard string format ─────────────────────────────
      // Only reached for formats like "Feb 17, 2026" etc.
      // Use LOCAL accessors — never toISOString() — to avoid re-introducing the shift.
      const fallback = new Date(dateInput);
      if (isNaN(fallback.getTime())) {
        console.warn('[DateUtils] normalizeDateToString: Invalid date string:', dateInput);
        return '';
      }
      const fy = fallback.getFullYear();
      const fm = fallback.getMonth() + 1;  // LOCAL month
      const fd = fallback.getDate();        // LOCAL day ← safe; no UTC conversion
      const fmStr = fm < 10 ? '0' + fm : '' + fm;
      const fdStr = fd < 10 ? '0' + fd : '' + fd;
      return `${fy}-${fmStr}-${fdStr}`;

    } else {
      // ── Date object input ────────────────────────────────────────────────────
      // Use LOCAL accessors, never toISOString() which converts back to UTC.
      // OLD UTC DATE LOGIC COMMENTED:
      // return dateInput.toISOString().split('T')[0]; // ❌ UTC shift in IST
      const d = dateInput as Date;
      if (isNaN(d.getTime())) {
        console.warn('[DateUtils] normalizeDateToString: Invalid Date object');
        return '';
      }
      const year  = d.getFullYear();
      const month = d.getMonth() + 1; // LOCAL month
      const day   = d.getDate();      // LOCAL day ← safe
      const mStr  = month < 10 ? '0' + month : '' + month;
      const dStr  = day   < 10 ? '0' + day   : '' + day;
      return `${year}-${mStr}-${dStr}`;
    }

  } catch (error) {
    console.error('[DateUtils] normalizeDateToString: Error:', dateInput, error);
    return '';
  }
}
/**
 * Check if date is weekend (Saturday or Sunday)
 * Uses configurable WorkWeekConfig
 */
export function isWeekend(dateInput: string | Date | null | undefined): boolean {
  if (!dateInput) return false;
  
  const normalized = normalizeDateToString(dateInput);
  if (!normalized) return false;
  
  return configIsWeekend(normalized); // Use config
}

/**
 * Compare two dates for equality (ignoring time)
 * @param date1 First date
 * @param date2 Second date
 * @returns True if dates are equal (same year, month, day)
 */
export function areDatesEqual(
  date1: string | Date | null | undefined,
  date2: string | Date | null | undefined
): boolean {
  const normalized1 = normalizeDateToString(date1);
  const normalized2 = normalizeDateToString(date2);
  
  if (!normalized1 || !normalized2) return false;
  
  return normalized1 === normalized2;
}

/**
 * Format date for display
 * @param dateInput Date string or Date object
 * @param options Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatDateForDisplay(
  dateInput: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '';
  
  try {
    const normalized = normalizeDateToString(dateInput);
    if (!normalized) return '';
    
    const date = new Date(normalized + 'T00:00:00'); // Add time to avoid timezone issues
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      ...options
    };
    
    return date.toLocaleDateString('en-US', defaultOptions);
  } catch (error) {
    console.error('[DateUtils] Error formatting date:', dateInput, error);
    return '';
  }
}

/**
 * Get today's date in YYYY-MM-DD format
 * @returns Today's date string
 */
export function getTodayString(): string {
  const today = new Date();
  return normalizeDateToString(today);
}

/**
 * Check if a date is today
 * @param dateInput Date to check
 * @returns True if date is today
 */
export function isToday(dateInput: string | Date | null | undefined): boolean {
  return areDatesEqual(dateInput, new Date());
}

/**
 * Get week start date (Monday) for a given date
 * @param dateInput Date input
 * @returns Monday of the week in YYYY-MM-DD format
 */
export function getWeekStartDate(dateInput: string | Date): string {
  const normalized = normalizeDateToString(dateInput);
  if (!normalized) return '';
  
  const date = new Date(normalized + 'T00:00:00');
  const dayOfWeek = date.getDay();
  const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Sunday
  
  date.setDate(diff);
  return normalizeDateToString(date);
}

/**
 * Get week end date (Sunday) for a given date
 * @param dateInput Date input
 * @returns Sunday of the week in YYYY-MM-DD format
 */
export function getWeekEndDate(dateInput: string | Date): string {
  const weekStart = getWeekStartDate(dateInput);
  if (!weekStart) return '';
  
  const date = new Date(weekStart + 'T00:00:00');
  date.setDate(date.getDate() + 6);
  
  return normalizeDateToString(date);
}

/**
 * Get all days in a week (Monday to Sunday)
 * @param dateInput Any date in the week
 * @returns Array of 7 date strings (Monday to Sunday)
 */
export function getWeekDays(dateInput: string | Date): string[] {
  const weekStart = getWeekStartDate(dateInput);
  if (!weekStart) return [];
  
  const days: string[] = [];
  const startDate = new Date(weekStart + 'T00:00:00');
  
  for (let i = 0; i < 7; i++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    days.push(normalizeDateToString(day));
  }
  
  return days;
}

// /**
//  * Check if date is weekend (Saturday or Sunday)
//  * @param dateInput Date to check
//  * @returns True if weekend
//  */
// export function isWeekend(dateInput: string | Date | null | undefined): boolean {
//   if (!dateInput) return false;
  
//   const normalized = normalizeDateToString(dateInput);
//   if (!normalized) return false;
  
//   const date = new Date(normalized + 'T00:00:00');
//   const dayOfWeek = date.getDay();
  
//   return dayOfWeek === 0 || dayOfWeek === 6;
// }

/**
 * Add days to a date
 * @param dateInput Starting date
 * @param days Number of days to add (can be negative)
 * @returns New date string in YYYY-MM-DD format
 */
export function addDays(dateInput: string | Date, days: number): string {
  const normalized = normalizeDateToString(dateInput);
  if (!normalized) return '';
  
  const date = new Date(normalized + 'T00:00:00');
  date.setDate(date.getDate() + days);
  
  return normalizeDateToString(date);
}

/**
 * Get month start date
 * @param year Year
 * @param month Month (1-12)
 * @returns First day of month in YYYY-MM-DD format
 */
export function getMonthStartDate(year: number, month: number): string {
  return normalizeDateToString(new Date(year, month - 1, 1));
}

/**
 * Get month end date
 * @param year Year
 * @param month Month (1-12)
 * @returns Last day of month in YYYY-MM-DD format
 */
export function getMonthEndDate(year: number, month: number): string {
  return normalizeDateToString(new Date(year, month, 0));
}

// START: 30 days restriction
/**
 * Get the minimum allowed date (30 days before today)
 * Used for timesheet entry validation
 * @returns Date string 30 days before today in YYYY-MM-DD format
 */
export function getMinAllowedDate(): string {
  return addDays(getTodayString(), -30);
}

/**
 * Check if a date is older than 30 days from today
 * @param dateInput Date to check
 * @returns True if date is older than 30 days
 */
export function isOlderThan30Days(dateInput: string | Date | null | undefined): boolean {
  if (!dateInput) return false;
  
  const normalized = normalizeDateToString(dateInput);
  if (!normalized) return false;
  
  const minDate = getMinAllowedDate();
  
  // Compare strings directly (YYYY-MM-DD format)
  return normalized < minDate;
}
// END: 30 days restriction