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
}
