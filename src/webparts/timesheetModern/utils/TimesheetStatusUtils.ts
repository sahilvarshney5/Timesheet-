// // ============================================================================
// // TIMESHEET FILL STATUS CALCULATOR
// // Location: src/webparts/timesheetModern/utils/TimesheetStatusUtils.ts
// // ============================================================================

import { ITimesheetLines } from '../models';
import styles from '../components/TimesheetModern.module.scss';
export interface ITimesheetFillStatus {
  status: 'FULL' | 'PARTIAL' | 'NOT_FILLED';
  totalFilledHours: number;
  expectedDailyHours: number;
  percentage: number;
}

/**
 * Calculate timesheet fill status for a specific date
 * @param date Date string in YYYY-MM-DD format
 * @param timesheetLines Array of timesheet line items
 * @param expectedDailyHours Expected working hours for the day (default 8)
 * @returns Timesheet fill status object
 */
export function getTimesheetFillStatus(
  date: string,
  timesheetLines: ITimesheetLines[],
  expectedDailyHours: number = 8
): ITimesheetFillStatus {
  
  // Filter timesheet lines for the given date
  const dayLines = timesheetLines.filter(line => {
    const lineDate = line.WorkDate || line.EntryDate || '';
    return lineDate === date;
  });
  
  // Sum hours from all entries for this date
  const totalFilledHours = dayLines.reduce((sum, line) => {
    const hours = line.HoursBooked || line.Hours || 0;
    return sum + Number(hours);
  }, 0);
  
  // Calculate percentage
  const percentage = expectedDailyHours > 0 
    ? Math.min(100, (totalFilledHours / expectedDailyHours) * 100)
    : 0;
  
  // Determine status
  let status: 'FULL' | 'PARTIAL' | 'NOT_FILLED';
  
  if (totalFilledHours >= expectedDailyHours) {
    status = 'FULL';
  } else if (totalFilledHours > 0) {
    status = 'PARTIAL';
  } else {
    status = 'NOT_FILLED';
  }
  
  return {
    status,
    totalFilledHours,
    expectedDailyHours,
    percentage
  };
}

/**
 * Get CSS class for timesheet progress bar based on status
 * @param status Fill status
 * @returns CSS class name
 */
export function getTimesheetProgressClass(status: 'FULL' | 'PARTIAL' | 'NOT_FILLED'): string {
  const statusMap = {
    'FULL': styles.filled,        // Green
    'PARTIAL': styles.partial,    // Orange
    'NOT_FILLED': styles.notFilled // Grey
  };
  return statusMap[status];
}

