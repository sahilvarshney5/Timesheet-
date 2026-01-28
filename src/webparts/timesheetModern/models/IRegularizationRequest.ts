export interface IRegularizationRequest {
  id?: number;
  employeeId: string;
  employeeName: string;
  requestType: 'day_based' | 'time_based';
  category: 'late_coming' | 'early_going' | 'missed_punch' | 'work_from_home' | 'on_duty';
  fromDate: string;
  toDate: string;
  startTime?: string;
  endTime?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected'; // ADDED: Missing status property
  submittedOn: string;
  approvedBy?: string;
  approvedOn?: string;
  managerComment?: string;
  
  // Legacy/deprecated properties for backwards compatibility
  attendanceDate?: string;
  requestedInTime?: string;
  requestedOutTime?: string;
}