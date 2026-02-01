// src/webparts/timesheetModern/config/WorkWeekConfig.ts

export interface IWorkWeekConfig {
  weekendDays: number[]; // 0 = Sunday, 6 = Saturday
  workingDays: number[];
}

export const WorkWeekConfig: IWorkWeekConfig = {
  // Default: Saturday (6) and Sunday (0) are weekends
  weekendDays: [0, 1], //[0, 6], 
  workingDays: [6, 2, 3, 4, 5],//[1, 2, 3, 4, 5] // Monday to Friday
};

// AFTER
export const isWeekendDay = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  return WorkWeekConfig.weekendDays.indexOf(dateObj.getDay()) !== -1;
};