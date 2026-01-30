import { IBaseModel } from './IBaseModel';

export interface IPunchData extends IBaseModel {
  /* Canonical */
  EmployeeId: number;
  AttendanceDate: string;

  FirstPunchIn?: string;
  LastPunchOut?: string;
  TotalHours?: number;

  /* Source / integration fields */
  Status?: string; // Present / Absent / Leave
  Source?: string;
   /* SharePoint internal fields (aliases) */
  PunchDate?: string; // Internal name for AttendanceDate
  Title?: string; // Employee ID in SharePoint
}
