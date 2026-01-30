import { IBaseModel } from './IBaseModel';

export interface ILeaveData extends IBaseModel {
  EmployeeId: number;
  LeaveType: string;
  StartDate: string;
  EndDate: string;
  TotalDays: number;         // 0.5, 1, 2, 3, etc.
  LeaveDuration: string;     // Full Day, Half Day
  Status: 'Pending' | 'Approved' | 'Rejected';
  IsHalfDay?: boolean;
  /* Optional Fields */
  HRMSLeaveID?: string;      // HRMS-2025-001
  AppliedDate?: string;      // ISO format
  ApprovedDate?: string;     // ISO format
  Reason?: string;           // Leave reason
  ColorCode?: string;        // #FFCDD2, #C8E6C9, #BBDEFB
  
  /* Person or Group Lookup Fields */
  Employee?: {
    Id: number;
    Title: string;
    EMail: string;
  };
  
  ApprovedBy?: {
    Id: number;
    Title: string;
    EMail: string;
  };
}
