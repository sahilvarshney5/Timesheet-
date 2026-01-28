// services/ApprovalService.ts
// Service for approval-related SharePoint operations
// Handles AttendanceRegularization list for manager approvals

import { SPHttpClient } from '@microsoft/sp-http';
import { HttpClientService } from './HttpClientService';
import { SharePointConfig, getListInternalName, getColumnInternalName } from '../config/SharePointConfig';
import { IAttendanceRegularization, IApprovalQueueItem, IRegularizationRequest } from '../models';

export class ApprovalService {
  private httpService: HttpClientService;

  constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    this.httpService = new HttpClientService(spHttpClient, siteUrl);
  }

  /**
   * Get pending regularization requests for approval
   * @param managerId Manager ID (optional, for filtering by manager)
   */
  public async getPendingApprovals(managerId?: string): Promise<IApprovalQueueItem[]> {
    try {
      // TODO: Implement REST call to AttendanceRegularization list
      const listName = getListInternalName('attendanceRegularization');
      
      const statusCol = getColumnInternalName('AttendanceRegularization', 'Status');
      
      // Build filter for pending status
      let filterQuery = `$filter=${statusCol} eq 'Pending'`;
      
      // TODO: Add manager filter if needed
      // This would require a Manager column or lookup to employee-manager mapping
      
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
        'Created',
        'Modified',
        'Author/Title',
        'Author/EMail'
      ];
      
      const expandFields = ['Author'];
      const orderBy = 'Created';
      
      // TODO: Call httpService.getListItems
      // const items = await this.httpService.getListItems<IAttendanceRegularization>(
      //   listName,
      //   selectFields,
      //   filterQuery,
      //   orderBy,
      //   1000,
      //   expandFields
      // );
      
      // // Transform to approval queue items
      // const approvalItems: IApprovalQueueItem[] = items.map(item => ({
      //   id: item.Id,
      //   employeeId: item.EmployeeID,
      //   employeeName: item.Author?.Title || 'Unknown',
      //   requestType: item.RequestType === 'Day' ? 'day_based' : 'time_based',
      //   category: this.mapCategoryFromReason(item.Reason), // TODO: Store category explicitly
      //   fromDate: item.StartDate,
      //   toDate: item.EndDate || item.StartDate,
      //   startTime: item.ExpectedIn,
      //   endTime: item.ExpectedOut,
      //   reason: item.Reason,
      //   status: 'pending',
      //   submittedOn: item.Created || '',
      //   canApprove: true,
      //   canReject: true
      // }));
      
      // return approvalItems;
      
      // PLACEHOLDER: Return empty array until implemented
      console.log(`[ApprovalService] getPendingApprovals for manager ${managerId || 'all'}`);
      return [];
      
    } catch (error) {
      console.error('[ApprovalService] Error getting pending approvals:', error);
      throw error;
    }
  }

  /**
   * Get approval history (approved/rejected requests)
   * @param managerId Manager ID (optional)
   * @param startDate Start date (optional)
   * @param endDate End date (optional)
   */
  public async getApprovalHistory(
    managerId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<IRegularizationRequest[]> {
    try {
      // TODO: Implement REST call to AttendanceRegularization list
      const listName = getListInternalName('attendanceRegularization');
      
      const statusCol = getColumnInternalName('AttendanceRegularization', 'Status');
      
      // Build filter for approved/rejected status
      let filterQuery = `$filter=(${statusCol} eq 'Approved' or ${statusCol} eq 'Rejected')`;
      
      // TODO: Add date range filter if provided
      if (startDate && endDate) {
        const createdCol = 'Created';
        filterQuery += ` and ${createdCol} ge '${startDate}' and ${createdCol} le '${endDate}'`;
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
        'Created',
        'Modified',
        'Author/Title',
        'Author/EMail',
        'Editor/Title',
        'Editor/EMail'
      ];
      
      const expandFields = ['Author', 'Editor'];
      const orderBy = 'Modified'; // Order by last modified
      
      // TODO: Call httpService.getListItems
      // const items = await this.httpService.getListItems<IAttendanceRegularization>(
      //   listName,
      //   selectFields,
      //   filterQuery,
      //   orderBy,
      //   1000,
      //   expandFields
      // );
      
      // // Transform to regularization requests
      // const requests: IRegularizationRequest[] = items.map(item => ({
      //   id: item.Id,
      //   employeeId: item.EmployeeID,
      //   employeeName: item.Author?.Title || 'Unknown',
      //   requestType: item.RequestType === 'Day' ? 'day_based' : 'time_based',
      //   category: this.mapCategoryFromReason(item.Reason),
      //   fromDate: item.StartDate,
      //   toDate: item.EndDate || item.StartDate,
      //   startTime: item.ExpectedIn,
      //   endTime: item.ExpectedOut,
      //   reason: item.Reason,
      //   status: item.Status === 'Approved' ? 'approved' : 'rejected',
      //   submittedOn: item.Created || '',
      //   approvedBy: item.Editor?.Title,
      //   approvedOn: item.Modified,
      //   managerComment: item.ManagerComment
      // }));
      
      // return requests;
      
      // PLACEHOLDER: Return empty array until implemented
      console.log(`[ApprovalService] getApprovalHistory for manager ${managerId || 'all'}`);
      return [];
      
    } catch (error) {
      console.error('[ApprovalService] Error getting approval history:', error);
      throw error;
    }
  }

  /**
   * Get regularization requests for a specific employee
   * @param employeeId Employee ID
   */
  public async getEmployeeRegularizations(employeeId: string): Promise<IRegularizationRequest[]> {
    try {
      // TODO: Implement REST call to AttendanceRegularization list
      const listName = getListInternalName('attendanceRegularization');
      
      const empIdCol = getColumnInternalName('AttendanceRegularization', 'EmployeeID');
      const filterQuery = `$filter=${empIdCol} eq '${employeeId}'`;
      
      const selectFields = [
        'Id',
        empIdCol,
        getColumnInternalName('AttendanceRegularization', 'RequestType'),
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
      
      // TODO: Call httpService.getListItems
      // const items = await this.httpService.getListItems<IAttendanceRegularization>(
      //   listName,
      //   selectFields,
      //   filterQuery,
      //   orderBy,
      //   1000,
      //   expandFields
      // );
      
      // // Transform to regularization requests
      // const requests: IRegularizationRequest[] = items.map(item => ({
      //   id: item.Id,
      //   employeeId: item.EmployeeID,
      //   employeeName: 'Current User', // TODO: Get from context
      //   requestType: item.RequestType === 'Day' ? 'day_based' : 'time_based',
      //   category: this.mapCategoryFromReason(item.Reason),
      //   fromDate: item.StartDate,
      //   toDate: item.EndDate || item.StartDate,
      //   startTime: item.ExpectedIn,
      //   endTime: item.ExpectedOut,
      //   reason: item.Reason,
      //   status: item.Status.toLowerCase() as 'pending' | 'approved' | 'rejected',
      //   submittedOn: item.Created || '',
      //   approvedBy: item.Editor?.Title,
      //   approvedOn: item.Modified,
      //   managerComment: item.ManagerComment
      // }));
      
      // return requests;
      
      // PLACEHOLDER: Return empty array until implemented
      console.log(`[ApprovalService] getEmployeeRegularizations for ${employeeId}`);
      return [];
      
    } catch (error) {
      console.error('[ApprovalService] Error getting employee regularizations:', error);
      throw error;
    }
  }

  /**
   * Approve a regularization request
   * @param requestId Request ID
   * @param managerComment Manager comment (optional)
   */
  public async approveRequest(requestId: number, managerComment?: string): Promise<void> {
    try {
      // TODO: Implement REST MERGE to update status
      const listName = getListInternalName('attendanceRegularization');
      
      const itemData: any = {
        [getColumnInternalName('AttendanceRegularization', 'Status')]: 'Approved'
      };
      
      if (managerComment) {
        itemData[getColumnInternalName('AttendanceRegularization', 'ManagerComment')] = managerComment;
      }
      
      // TODO: Call httpService.updateListItem
      // await this.httpService.updateListItem(listName, requestId, itemData);
      
      // PLACEHOLDER: Log until implemented
      console.log(`[ApprovalService] approveRequest ${requestId}`, managerComment);
      
    } catch (error) {
      console.error('[ApprovalService] Error approving request:', error);
      throw error;
    }
  }

  /**
   * Reject a regularization request
   * @param requestId Request ID
   * @param managerComment Manager comment (optional)
   */
  public async rejectRequest(requestId: number, managerComment?: string): Promise<void> {
    try {
      // TODO: Implement REST MERGE to update status
      const listName = getListInternalName('attendanceRegularization');
      
      const itemData: any = {
        [getColumnInternalName('AttendanceRegularization', 'Status')]: 'Rejected'
      };
      
      if (managerComment) {
        itemData[getColumnInternalName('AttendanceRegularization', 'ManagerComment')] = managerComment;
      }
      
      // TODO: Call httpService.updateListItem
      // await this.httpService.updateListItem(listName, requestId, itemData);
      
      // PLACEHOLDER: Log until implemented
      console.log(`[ApprovalService] rejectRequest ${requestId}`, managerComment);
      
    } catch (error) {
      console.error('[ApprovalService] Error rejecting request:', error);
      throw error;
    }
  }

  /**
   * Submit a new regularization request
   * @param request Regularization request data
   */
  public async submitRegularizationRequest(request: Partial<IAttendanceRegularization>): Promise<IAttendanceRegularization> {
    try {
      // TODO: Implement REST POST to create new request
      const listName = getListInternalName('attendanceRegularization');
      
      const itemData = {
        [getColumnInternalName('AttendanceRegularization', 'EmployeeID')]: request.EmployeeID,
        [getColumnInternalName('AttendanceRegularization', 'RequestType')]: request.RequestType,
        [getColumnInternalName('AttendanceRegularization', 'StartDate')]: request.StartDate,
        [getColumnInternalName('AttendanceRegularization', 'EndDate')]: request.EndDate || request.StartDate,
        [getColumnInternalName('AttendanceRegularization', 'ExpectedIn')]: request.ExpectedIn || null,
        [getColumnInternalName('AttendanceRegularization', 'ExpectedOut')]: request.ExpectedOut || null,
        [getColumnInternalName('AttendanceRegularization', 'Reason')]: request.Reason,
        [getColumnInternalName('AttendanceRegularization', 'Status')]: 'Pending'
      };
      
      // TODO: Call httpService.createListItem
      // const newRequest = await this.httpService.createListItem<IAttendanceRegularization>(
      //   listName,
      //   itemData
      // );
      
      // return newRequest;
      
      // PLACEHOLDER: Return mock data until implemented
      console.log(`[ApprovalService] submitRegularizationRequest`, request);
      return {
        Id: -1,
        ...request,
        Status: 'Pending'
      } as IAttendanceRegularization;
      
    } catch (error) {
      console.error('[ApprovalService] Error submitting regularization request:', error);
      throw error;
    }
  }

  /**
   * Helper method to map reason to category
   * TODO: Store category as a separate field in SharePoint list
   */
  private mapCategoryFromReason(reason: string): 'late_coming' | 'early_going' | 'missed_punch' | 'work_from_home' | 'on_duty' {
    const lowerReason = reason.toLowerCase();
    
    if (lowerReason.includes('late')) return 'late_coming';
    if (lowerReason.includes('early')) return 'early_going';
    if (lowerReason.includes('punch') || lowerReason.includes('forgot')) return 'missed_punch';
    if (lowerReason.includes('wfh') || lowerReason.includes('work from home')) return 'work_from_home';
    if (lowerReason.includes('duty') || lowerReason.includes('site')) return 'on_duty';
    
    return 'missed_punch'; // Default
  }
}