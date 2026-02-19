import { IBaseModel } from './IBaseModel';

export interface IPunchData extends IBaseModel {
  /* Canonical */
  EmployeeId: number;
  AttendanceDate: string;

  PunchIn?: string;
  PunchOut?: string;
  TotalHours?: number;

  /* Source / integration fields */
  Status?: string; // Present / Absent / Leave
  Source?: string;
  /* SharePoint internal fields (aliases) */
  PunchDate?: string; // Internal name for AttendanceDate (used for date comparison)
  Title?: string; // Employee ID in SharePoint
}