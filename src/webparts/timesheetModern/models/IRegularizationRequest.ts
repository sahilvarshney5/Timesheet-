export interface IRegularizationRequest {
  id?: number;
  employeeId: string; // CHANGED from Number to string
  employeeName: string;
  requestType: 'day_based' | 'time_based' | 'Day';
  category?: string; // FIXED: Made optional (string | undefined) to match SP mapping
  fromDate: string;
  toDate: string;
  startTime?: string;
  endTime?: string;
  reason?: string; // FIXED: Made optional (string | undefined) to match SP mapping
  status: 'pending' | 'approved' | 'rejected' | 'draft';
  submittedOn: string;
  approvedBy?: string;
  approvedOn?: string;
  managerComment?: string;
  dateRange?: string;
  // Legacy/deprecated properties for backwards compatibility
  attendanceDate?: string;
  requestedInTime?: string;
  requestedOutTime?: string;
  RequestID?: string;
}