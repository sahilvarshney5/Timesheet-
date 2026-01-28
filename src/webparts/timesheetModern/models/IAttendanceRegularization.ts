import { IBaseModel } from './IBaseModel';

export interface IAttendanceRegularization extends IBaseModel {
  /* Canonical */
  EmployeeId: number;
  AttendanceDate: string;
  Reason: string;
  Status: 'Pending' | 'Approved' | 'Rejected';

  /* Optional request times */
  RequestedInTime?: string;
  RequestedOutTime?: string;

  /* ===============================
     Source-system / SP internal names
     =============================== */

  EmployeeID?: number; // SP internal alias
  RequestType?: string; // Timesheet / Regularization
  StartDate?: string;
  EndDate?: string;
  ExpectedIn?: string;
  ExpectedOut?: string;

  ManagerComments?: string;
}
