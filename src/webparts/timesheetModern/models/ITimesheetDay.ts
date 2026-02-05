import { ITimesheetEntry } from './ITimesheetEntry';

export interface ITimesheetDay {
  Id:number; // Unique identifier for the day, e.g., "2024-09-01"
  /* Calendar */
  date: string;
  dayNumber?: number;
  isWeekend: boolean;
  isHoliday: boolean;
  isLeave: boolean;
  status?: string;
  leaveType?: string;
  isToday: boolean;

  /* Punch */
  firstPunchIn?: string;
  lastPunchOut?: string;
  totalHours?: number;
  availableHours: number;

  /* Timesheet */
  timesheetHours: number;
  timesheetProgress: {
    percentage: number;
    status: 'notFilled' | 'partial' | 'completed';
  };

  /* REQUIRED */
  entries: ITimesheetEntry[];
}
