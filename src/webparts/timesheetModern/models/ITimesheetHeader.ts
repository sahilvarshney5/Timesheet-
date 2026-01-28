import { IBaseModel } from './IBaseModel';

export interface ITimesheetHeader extends IBaseModel {
  /* Canonical */
  EmployeeId: number;
  WeekStartDate: string;
  WeekEndDate: string;
  Status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  TotalHours?: number;

  /* Source aliases */
  EmployeeID?: number; // SP internal
}
