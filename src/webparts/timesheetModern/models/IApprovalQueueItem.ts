export interface IApprovalQueueItem {
  requestId: number;
  employeeName: string;
  requestType: 'Timesheet' | 'Regularization';
  dateRange: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}
