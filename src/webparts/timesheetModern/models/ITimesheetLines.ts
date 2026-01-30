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
   EntryDate?: string;          // ✅ ACTUAL SharePoint column name
  ProjectNumber?: string;      // ✅ ACTUAL SharePoint column name
    Title?: string;              // ✅ Task Number (SharePoint default)
 BLANumber?: string;          // ✅ BLA Number
  ProjectNo?: string;
  TaskNo?: string;
  BLA_No?: string;

  HoursBooked?: number;
  Description?: string;
}
