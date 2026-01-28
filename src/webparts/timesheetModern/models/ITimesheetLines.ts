import { IBaseModel } from './IBaseModel';

export interface ITimesheetLines extends IBaseModel {
  /* Canonical */
  TimesheetHeaderId: number;
  WorkDate: string;
  ProjectId: number;
  TaskId: number;
  Hours: number;
  Comments?: string;

  /* ===============================
     SharePoint / BC internal aliases
     =============================== */

  TimesheetID?: number;
  ProjectNo?: string;
  TaskNo?: string;
  BLA_No?: string;

  HoursBooked?: number;
  Description?: string;
}
