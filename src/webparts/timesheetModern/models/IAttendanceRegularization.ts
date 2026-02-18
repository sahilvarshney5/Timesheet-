import { IBaseModel } from './IBaseModel';

export interface IAttendanceRegularization extends IBaseModel {
  /* Canonical */
  EmployeeId: number;
  AttendanceDate: string;
  Reason: string;
  Status: 'Pending' | 'Approved' | 'Rejected'|'Draft';

  /* Optional request times */
  RequestedInTime?: string;
  RequestedOutTime?: string;

  /* ===============================
     Source-system / SP internal names
     =============================== */

  EmployeeID?: string; // SP internal alias
  RequestType?: string; // Timesheet / Regularization
  StartDate?: string;
  EndDate?: string;
  SubmittedDate?: string;
  ApprovedDate?: string;
  ExpectedIn?: string;
  ExpectedOut?: string;

  ManagerComments?: string;
  RequestID?: string; // ADDED: For consistency with SharePoint column
  ManagerEmail?: string; // ADDED: To store manager's email for notifications
  FootPrint?:string
}
