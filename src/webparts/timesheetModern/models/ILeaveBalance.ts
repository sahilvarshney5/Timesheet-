import { IBaseModel } from './IBaseModel';

export interface ILeaveBalance extends IBaseModel {
  EmployeeId: number;
  LeaveType: string;
  Balance: number;
}
