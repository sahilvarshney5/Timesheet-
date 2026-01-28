import { ITimesheetDay } from './ITimesheetDay';

export interface ITimesheetWeek {
  weekStartDate: string;
  weekEndDate: string;
  days: ITimesheetDay[];
  totalHours: number;
}
