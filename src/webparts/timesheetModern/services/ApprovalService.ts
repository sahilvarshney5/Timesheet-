// services/ApprovalService.ts
// ENHANCED VERSION - Added manager email filtering and timesheet entries support
// Service for approval-related SharePoint operations

import { SPHttpClient } from '@microsoft/sp-http';
import { HttpClientService } from './HttpClientService';
import { SharePointConfig, getListInternalName, getColumnInternalName } from '../config/SharePointConfig';
import { IAttendanceRegularization, IApprovalQueueItem, IRegularizationRequest, ITimesheetHeader } from '../models';

interface IAttendanceRegularizationExpanded extends IAttendanceRegularization {
  Author?: {
    Id: number;
    Title: string;
    EMail: string;
  };
  Editor?: {
    Id: number;
    Title: string;
    EMail: string;
  };
}

export class ApprovalService {
  private httpService: HttpClientService;

  constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    this.httpService = new HttpClientService(spHttpClient, siteUrl);
  }

  private async getReporteeEmployeeIds(): Promise<string[]> {
    try {
      const currentUser = await this.httpService.getCurrentUser();
      const currentUserEmail = currentUser.Email;
      
      const listName = getListInternalName('employeeMaster');
      const employeeIDCol = getColumnInternalName('EmployeeMaster', 'EmployeeID');
      const managerCol = getColumnInternalName('EmployeeMaster', 'Manager');
      
      const filterQuery = `$filter=${managerCol}/EMail eq '${currentUserEmail}'`;
      const selectFields = ['Id', employeeIDCol, `${managerCol}/EMail`];
      const expandFields = [managerCol];
      
      const items = await this.httpService.getListItems<any>(
        listName,
        selectFields,
        filterQuery,
        undefined,
        5000,
        expandFields
      );
      
      return items.map((item: any) => item[employeeIDCol]);
      
    } catch (error) {
      return [];
    }
  }

  public async updateRegularizationStatus(requestId: number, newStatus: string): Promise<void> {
    try {
      const listName = getListInternalName('attendanceRegularization');
      
      const updateData = {
        Status: newStatus
      };
      
      await this.httpService.updateListItem(
        listName,
        requestId,
        updateData
      );
    } catch (error) {
      throw error;
    }
  }

  public async updateRegularization(
    requestId: number, 
    requestData: Partial<IAttendanceRegularization>
  ): Promise<void> {
    try {
      const listName = getListInternalName('attendanceRegularization');
      
      await this.httpService.updateListItem(
        listName,
        requestId,
        requestData
      );
    } catch (error) {
      throw error;
    }
  }

  public async recallRegularization(requestId: number, action: string): Promise<void> {
    try {
      const listName = getListInternalName('attendanceRegularization');

      let actionStatus = '';
      if (action === 'recall') {
        actionStatus = 'Draft';
      } else if (action === 'cancel') {
        actionStatus = 'Cancelled';
      }
      const itemData: any = {
        [getColumnInternalName('AttendanceRegularization', 'Status')]: actionStatus,
        [getColumnInternalName('AttendanceRegularization', 'ManagerComment')]: ''
      };

      await this.httpService.updateListItem(listName, requestId, itemData);

    } catch (error) {
      throw error;
    }
  }

  /**
   * ENHANCED: Get pending regularization requests filtered by manager email
   */
  public async getPendingApprovals(managerEmail?: string): Promise<IApprovalQueueItem[]> {
    try {
      const listName = getListInternalName('attendanceRegularization');
      const statusCol = getColumnInternalName('AttendanceRegularization', 'Status');

      let filterQuery = `$filter=${statusCol} eq 'Pending'`;

      if (managerEmail) {
        filterQuery += ` and ManagerEmail eq '${managerEmail}'`;
      }

      const selectFields = [
        'Id',
        getColumnInternalName('AttendanceRegularization', 'EmployeeID'),
        getColumnInternalName('AttendanceRegularization', 'RequestType'),
        getColumnInternalName('AttendanceRegularization', 'StartDate'),
        getColumnInternalName('AttendanceRegularization', 'EndDate'),
        getColumnInternalName('AttendanceRegularization', 'ExpectedIn'),
        getColumnInternalName('AttendanceRegularization', 'ExpectedOut'),
        getColumnInternalName('AttendanceRegularization', 'Reason'),
        statusCol,
        getColumnInternalName('AttendanceRegularization', 'ManagerComment'),
        'ManagerEmail',
        'Created',
        'Modified',
        'Author/Title',
        'Author/EMail'
      ];

      const expandFields = ['Author'];
      const orderBy = 'Created';

      const items = await this.httpService.getListItems<IAttendanceRegularizationExpanded>(
        listName,
        selectFields,
        filterQuery,
        orderBy,
        1000,
        expandFields
      );

      const approvalItems: IApprovalQueueItem[] = items.map(item => {
        const fromDate = item.SubmittedDate || '';
        const toDate = item.ApprovedDate || fromDate;
        const dateRange = this.formatDateRange(fromDate, toDate);

        return {
          requestId: item.Id!,
          employeeName: item.Author?.Title || 'Unknown',
          requestType: item.RequestType === 'Day' ? 'Timesheet' : 'Regularization',
          dateRange: dateRange,
          status: 'Pending'
        };
      });

      return approvalItems;

    } catch (error) {
      throw error;
    }
  }

  /**
   * NEW: Get pending timesheet entries for approval filtered by manager email
   */
  public async getPendingTimesheetApprovals(managerEmail?: string): Promise<IApprovalQueueItem[]> {
    try {
      const listName = getListInternalName('timesheetHeader');
      const statusCol = getColumnInternalName('TimesheetHeader', 'Status');

      let filterQuery = `$filter=${statusCol} eq 'Submitted'`;

      if (managerEmail) {
        filterQuery += ` and ManagerEmail eq '${managerEmail}'`;
      }

      const selectFields = [
        'Id',
        getColumnInternalName('TimesheetHeader', 'EmployeeID'),
        getColumnInternalName('TimesheetHeader', 'WeekStartDate'),
        statusCol,
        getColumnInternalName('TimesheetHeader', 'SubmissionDate'),
        'ManagerEmail',
        'Created',
        'Author/Title',
        'Author/EMail'
      ];

      const expandFields = ['Author'];
      const orderBy = getColumnInternalName('TimesheetHeader', 'SubmissionDate');

      const items = await this.httpService.getListItems<any>(
        listName,
        selectFields,
        filterQuery,
        orderBy,
        1000,
        expandFields
      );

      const approvalItems: IApprovalQueueItem[] = items.map((item: any) => {
        const weekStart = new Date(item.WeekStartDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        const dateRange = this.formatDateRange(
          weekStart.toISOString().split('T')[0],
          weekEnd.toISOString().split('T')[0]
        );

        return {
          requestId: item.Id,
          employeeName: item.Author?.Title || 'Unknown',
          requestType: 'Timesheet',
          dateRange: dateRange,
          status: 'Pending'
        };
      });

      return approvalItems;

    } catch (error) {
      return [];
    }
  }

  /**
   * ENHANCED: Get approval history filtered by manager email
   */
  public async getApprovalHistory(
    managerEmail?: string,
    startDate?: string,
    endDate?: string
  ): Promise<IApprovalQueueItem[]> {
    try {
      const listName = getListInternalName('attendanceRegularization');
      const statusCol = getColumnInternalName('AttendanceRegularization', 'Status');

      const filters: string[] = [`(${statusCol} eq 'Approved' or ${statusCol} eq 'Rejected')`];

      if (managerEmail) {
        filters.push(`ManagerEmail eq '${managerEmail}'`);
      }

      if (startDate && endDate) {
        const dateCol = getColumnInternalName('AttendanceRegularization', 'StartDate');
        filters.push(`${dateCol} ge '${startDate}' and ${dateCol} le '${endDate}'`);
      }

      const filterQuery = `$filter=${filters.join(' and ')}`;

      const selectFields = [
        'Id',
        getColumnInternalName('AttendanceRegularization', 'EmployeeID'),
        getColumnInternalName('AttendanceRegularization', 'RequestType'),
        getColumnInternalName('AttendanceRegularization', 'StartDate'),
        getColumnInternalName('AttendanceRegularization', 'EndDate'),
        getColumnInternalName('AttendanceRegularization', 'Reason'),
        statusCol,
        getColumnInternalName('AttendanceRegularization', 'ManagerComment'),
        'ManagerEmail',
        'Created',
        'Modified',
        'Author/Title',
        'Editor/Title'
      ];

      const expandFields = ['Author', 'Editor'];
      const orderBy = 'Modified';

      const items = await this.httpService.getListItems<IAttendanceRegularizationExpanded>(
        listName,
        selectFields,
        filterQuery,
        orderBy,
        1000,
        expandFields
      );

      const historyItems: IApprovalQueueItem[] = items.map(item => {
        const fromDate = item.SubmittedDate || '';
        const toDate = item.ApprovedDate || fromDate;
        const dateRange = this.formatDateRange(fromDate, toDate);

        return {
          requestId: item.Id!,
          employeeName: item.Author?.Title || 'Unknown',
          requestType: item.RequestType === 'Day' ? 'Timesheet' : 'Regularization',
          dateRange: dateRange,
          status: item.Status as 'Approved' | 'Rejected'
        };
      });

      return historyItems;

    } catch (error) {
      throw error;
    }
  }

  public async getEmployeeRegularizations(employeeId: string): Promise<IRegularizationRequest[]> {
    try {
      const listName = getListInternalName('attendanceRegularization');

      const empIdCol = getColumnInternalName('AttendanceRegularization', 'EmployeeID');
      const filterQuery = `$filter=${empIdCol} eq '${employeeId}'`;

      const selectFields = [
        'Id',
        empIdCol,
        getColumnInternalName('AttendanceRegularization', 'RequestType'),
        getColumnInternalName('AttendanceRegularization', 'RequestID'),
        getColumnInternalName('AttendanceRegularization', 'StartDate'),
        getColumnInternalName('AttendanceRegularization', 'EndDate'),
        getColumnInternalName('AttendanceRegularization', 'ExpectedIn'),
        getColumnInternalName('AttendanceRegularization', 'ExpectedOut'),
        getColumnInternalName('AttendanceRegularization', 'Reason'),
        getColumnInternalName('AttendanceRegularization', 'Status'),
        getColumnInternalName('AttendanceRegularization', 'ManagerComment'),
        'Created',
        'Modified',
        'Editor/Title'
      ];

      const expandFields = ['Editor'];
      const orderBy = 'Created';

      const items = await this.httpService.getListItems<IAttendanceRegularizationExpanded>(
        listName,
        selectFields,
        filterQuery,
        orderBy,
        1000,
        expandFields
      );

      const requests: IRegularizationRequest[] = items.map(item => ({
        id: item.Id,
        RequestID: item.RequestID || '',
        employeeId: item.EmployeeID || '',
        employeeName: 'Current User',
        requestType: item.RequestType === 'Day' ? 'day_based' : 'time_based',
        category: this.mapCategoryFromReason(item.Reason || ''),
        fromDate: item.SubmittedDate || '',
        toDate: item.ApprovedDate || item.SubmittedDate || '',
        startTime: item.ExpectedIn,
        endTime: item.ExpectedOut,
        reason: item.Reason || '',
        status: item.Status.toLowerCase() as 'pending' | 'approved' | 'rejected',
        submittedOn: item.Created || '',
        approvedBy: item.Editor?.Title,
        approvedOn: item.Modified,
        managerComment: item.ManagerComments
      }));

      return requests;

    } catch (error) {
      throw error;
    }
  }

  public async approveRequest(requestId: number, managerComment?: string): Promise<void> {
    try {
      const listName = getListInternalName('attendanceRegularization');

      const itemData: any = {
        [getColumnInternalName('AttendanceRegularization', 'Status')]: 'Approved'
      };

      if (managerComment) {
        itemData[getColumnInternalName('AttendanceRegularization', 'ManagerComment')] = managerComment;
      }

      await this.httpService.updateListItem(listName, requestId, itemData);

    } catch (error) {
      throw error;
    }
  }

  public async rejectRequest(requestId: number, managerComment?: string): Promise<void> {
    try {
      const listName = getListInternalName('attendanceRegularization');

      const itemData: any = {
        [getColumnInternalName('AttendanceRegularization', 'Status')]: 'Rejected'
      };

      if (managerComment) {
        itemData[getColumnInternalName('AttendanceRegularization', 'ManagerComment')] = managerComment;
      }

      await this.httpService.updateListItem(listName, requestId, itemData);

    } catch (error) {
      throw error;
    }
  }

  /**
   * ENHANCED: Submit regularization request with manager email
   */
  public async submitRegularizationRequest(
    request: Partial<IAttendanceRegularization>,
    managerEmail?: string
  ): Promise<IAttendanceRegularization> {
    try {
      const listName = getListInternalName('attendanceRegularization');

      const itemData: any = {
        [getColumnInternalName('AttendanceRegularization', 'EmployeeID')]: request.EmployeeID,
        [getColumnInternalName('AttendanceRegularization', 'RequestType')]: request.RequestType,
        [getColumnInternalName('AttendanceRegularization', 'StartDate')]: request.StartDate,
        [getColumnInternalName('AttendanceRegularization', 'EndDate')]: request.EndDate || request.StartDate,
        [getColumnInternalName('AttendanceRegularization', 'ExpectedIn')]: request.ExpectedIn || null,
        [getColumnInternalName('AttendanceRegularization', 'ExpectedOut')]: request.ExpectedOut || null,
        [getColumnInternalName('AttendanceRegularization', 'Reason')]: request.Reason,
        [getColumnInternalName('AttendanceRegularization', 'Status')]: 'Pending',
         [getColumnInternalName('AttendanceRegularization', 'FootPrint')]: 'App'
      };

      if (managerEmail) {
        itemData.ManagerEmail = managerEmail;
      }

      const newRequest = await this.httpService.createListItem<IAttendanceRegularization>(
        listName,
        itemData
      );

      return newRequest;

    } catch (error) {
      throw error;
    }
  }

  private formatDateRange(fromDate: string, toDate: string): string {
    if (!fromDate) return '';

    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (fromDate === toDate) {
      return from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    return `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  private mapCategoryFromReason(reason: string): 'late_coming' | 'early_going' | 'missed_punch' | 'work_from_home' | 'on_duty' {
    const lowerReason = reason.toLowerCase();

    if (lowerReason.includes('late')) return 'late_coming';
    if (lowerReason.includes('early')) return 'early_going';
    if (lowerReason.includes('punch') || lowerReason.includes('forgot')) return 'missed_punch';
    if (lowerReason.includes('wfh') || lowerReason.includes('work from home')) return 'work_from_home';
    if (lowerReason.includes('duty') || lowerReason.includes('site')) return 'on_duty';

    return 'missed_punch';
  }

  public async checkRegularizationExists(
    employeeId: string,
    fromDate: string
  ): Promise<boolean> {

    const startDate = new Date(fromDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(fromDate);
    endDate.setHours(23, 59, 59, 999);
    const listName = getListInternalName('attendanceRegularization');
    const selectedDate = new Date(fromDate);
    selectedDate.setHours(12, 0, 0, 0);
    const dayStart = new Date(fromDate);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(fromDate);
    dayEnd.setHours(23, 59, 59, 999);

    const filterQuery = `
  ${getColumnInternalName('AttendanceRegularization', 'EmployeeID')} eq '${employeeId}'
  and ${getColumnInternalName('AttendanceRegularization', 'Status')} ne 'Rejected'
  and ${getColumnInternalName('AttendanceRegularization', 'StartDate')} ge datetime'${dayStart.toISOString()}'
  and ${getColumnInternalName('AttendanceRegularization', 'StartDate')} le datetime'${dayEnd.toISOString()}'
`;

    const selectFields = ['Id', getColumnInternalName('AttendanceRegularization', 'EmployeeID'), getColumnInternalName('AttendanceRegularization', 'Status'), getColumnInternalName('AttendanceRegularization', 'StartDate'), getColumnInternalName('AttendanceRegularization', 'EndDate')];

    const response = await this.httpService.getListItems(
      listName,
      selectFields,
      `$filter=${filterQuery}`
    );

    return Array.isArray(response) && response.length > 0;
  }
}