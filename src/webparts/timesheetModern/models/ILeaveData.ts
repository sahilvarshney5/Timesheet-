import { IBaseModel } from './IBaseModel';

export interface ILeaveData extends IBaseModel {
  EmployeeId: number;
  LeaveType: string;
  StartDate: string;
  EndDate: string;
  IsHalfDay?: boolean;
  Status: 'Approved' | 'Cancelled';
}
