export interface IApprovalQueueItem {
  requestId: number;
  employeeName: string;
  requestType: 'Timesheet' | 'Regularization';
  dateRange: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?:string;
  approvedOn?:string;
  fromDate?:string;
  todate?:string;
  Category?:string;
  reason?:string;
}
