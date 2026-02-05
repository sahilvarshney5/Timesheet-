// services/ApprovalService.ts
// FIXED VERSION - All errors resolved
// Service for approval-related SharePoint operations
// Handles AttendanceRegularization list for manager approvals

import { SPHttpClient } from '@microsoft/sp-http';
import { HttpClientService } from './HttpClientService';
import { SharePointConfig, getListInternalName, getColumnInternalName } from '../config/SharePointConfig';
import { IAttendanceRegularization, IApprovalQueueItem, IRegularizationRequest } from '../models';

/**
 * Extended interface for AttendanceRegularization with Author/Editor lookup fields
 * These fields come from $expand in REST calls
 */
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


// ✅ ADD THIS FUNCTION HERE:
/**
 * Fetch unique Status values from BC Integration Log
 * Uses spHttpClient (following project rules - no PnPjs)
 */
const fetchRegularizationCategories = React.useCallback(async (): Promise<void> => {
  try {
    setIsLoadingStatuses(true);
    
    // Fetch Status column from BC Integration Log
    const endpoint = `${siteUrl}/_api/web/lists/getbytitle('BC Integration Log')/items?$select=Status&$top=5000`;
    
    const response = await spHttpClient.get(
      endpoint,
      SPHttpClient.configurations.v1
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extract unique Status values
    const uniqueStatuses = Array.from(
      new Set(
        data.value
          .map((item: any) => item.Status)
          .filter((status: string) => status && status.trim() !== '') // Remove null/undefined/empty
      )
    ) as string[];
    
    // Convert to dropdown options format
    const options = uniqueStatuses.map(status => ({
      key: status.toLowerCase().replace(/\s+/g, '_'), // Convert to snake_case for key
      text: status // Display original text
    }));
    
    setStatusOptions(options);
    
    console.log(`[RegularizationView] Loaded ${options.length} unique categories from BC Integration Log`);
    
  } catch (err) {
    console.error('[RegularizationView] Error fetching regularization categories:', err);
    
    // Fallback to hardcoded options if API fails
    setStatusOptions([
      { key: 'late_coming', text: 'Late Coming' },
      { key: 'early_going', text: 'Early Going' },
      { key: 'missed_punch', text: 'Missed Punch' },
      { key: 'work_from_home', text: 'Work From Home' },
      { key: 'on_duty', text: 'On Duty' }
    ]);
    
    console.warn('[RegularizationView] Using fallback categories due to error');
  } finally {
    setIsLoadingStatuses(false);
  }
}, [spHttpClient, siteUrl]);
/**
 * Recall a regularization request (move back to Pending)
 * @param requestId Request ID
 */
public async recallRegularization(requestId: number): Promise<void> {
  try {
    const listName = getListInternalName('attendanceRegularization');
    
    const itemData: any = {
      [getColumnInternalName('AttendanceRegularization', 'Status')]: 'Pending',
      [getColumnInternalName('AttendanceRegularization', 'ManagerComment')]: '' // Clear comment
    };
    
    await this.httpService.updateListItem(listName, requestId, itemData);
    
    console.log(`[ApprovalService] Recalled request ${requestId} to Pending status`);
    
  } catch (error) {
    console.error('[ApprovalService] Error recalling request:', error);
    throw error;
  }
}

  /**
   * Get pending regularization requests for approval
   * @param managerId Manager ID (optional, for filtering by manager)
   */
  public async getPendingApprovals(managerId?: string): Promise<IApprovalQueueItem[]> {
    try {
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
      
      // Call httpService.getListItems with expanded Author field
      const items = await this.httpService.getListItems<IAttendanceRegularizationExpanded>(
        listName,
        selectFields,
        filterQuery,
        orderBy,
        1000,
        expandFields
      );
      
      // Transform to approval queue items with proper field mapping
      const approvalItems: IApprovalQueueItem[] = items.map(item => {
        // Format date range
        const fromDate = item.SubmittedDate || '';
        const toDate = item.ApprovedDate || fromDate;
        const dateRange = this.formatDateRange(fromDate, toDate);
        
        return {
          requestId: item.Id!, // FIXED: Use requestId instead of id
          employeeName: item.Author?.Title || 'Unknown',
          requestType: item.RequestType === 'Day' ? 'Timesheet' : 'Regularization', // FIXED: Map to correct type
          dateRange: dateRange, // FIXED: Add dateRange field
          status: 'Pending'
        };
      });
      
      return approvalItems;
      
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
      const listName = getListInternalName('attendanceRegularization');
      
      const statusCol = getColumnInternalName('AttendanceRegularization', 'Status');
      
      // Build filter for approved/rejected status
      let filterQuery = `$filter=(${statusCol} eq 'Approved' or ${statusCol} eq 'Rejected')`;
      
      // Add date range filter if provided
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
      
      // FIXED: Proper call to httpService.getListItems (removed TODO comment)
      const items = await this.httpService.getListItems<IAttendanceRegularizationExpanded>(
        listName,
        selectFields,
        filterQuery,
        orderBy,
        1000,
        expandFields
      );
      
      // Transform to regularization requests with proper field mapping
      const requests: IRegularizationRequest[] = items.map(item => ({
        id: item.Id,
        employeeId: item.EmployeeID || '', // FIXED: Provide default empty string
        employeeName: item.Author?.Title || 'Unknown',
        requestType: item.RequestType === 'Day' ? 'day_based' : 'time_based',
        category: this.mapCategoryFromReason(item.Reason || ''),
        fromDate: item.StartDate || '',
        toDate: item.EndDate || item.StartDate || '',
        startTime: item.ExpectedIn,
        endTime: item.ExpectedOut,
        reason: item.Reason || '',
        status: item.Status === 'Approved' ? 'approved' : 'rejected',
        submittedOn: item.Created || '',
        approvedBy: item.Editor?.Title, // FIXED: Use Editor instead of ManagerComment
        approvedOn: item.Modified,
        managerComment: item.ManagerComments // FIXED: Use ManagerComments (plural)
      }));
      
      return requests;
      
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
      
      // Call httpService.getListItems with expanded Editor field
      const items = await this.httpService.getListItems<IAttendanceRegularizationExpanded>(
        listName,
        selectFields,
        filterQuery,
        orderBy,
        1000,
        expandFields
      );
      
      // Transform to regularization requests with proper field mapping
      const requests: IRegularizationRequest[] = items.map(item => ({
        id: item.Id,
        employeeId: item.EmployeeID || '', // FIXED: Provide default empty string
        employeeName: 'Current User', // TODO: Get from context
        requestType: item.RequestType === 'Day' ? 'day_based' : 'time_based',
        category: this.mapCategoryFromReason(item.Reason || ''),
        fromDate: item.SubmittedDate || '',
        toDate: item.ApprovedDate || item.SubmittedDate || '',
        startTime: item.ExpectedIn,
        endTime: item.ExpectedOut,
        reason: item.Reason || '',
        status: item.Status.toLowerCase() as 'pending' | 'approved' | 'rejected',
        submittedOn: item.Created || '',
        approvedBy: item.Editor?.Title, // FIXED: Use Editor instead of Editor.Title directly
        approvedOn: item.Modified,
        managerComment: item.ManagerComments // FIXED: Use ManagerComments (plural)
      }));
      
      return requests;
      
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
      const listName = getListInternalName('attendanceRegularization');
      
      const itemData: any = {
        [getColumnInternalName('AttendanceRegularization', 'Status')]: 'Approved'
      };
      
      if (managerComment) {
        itemData[getColumnInternalName('AttendanceRegularization', 'ManagerComment')] = managerComment;
      }
      
      // Call httpService.updateListItem
      await this.httpService.updateListItem(listName, requestId, itemData);
      
      console.log(`[ApprovalService] Approved request ${requestId}`);
      
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
      const listName = getListInternalName('attendanceRegularization');
      
      const itemData: any = {
        [getColumnInternalName('AttendanceRegularization', 'Status')]: 'Rejected'
      };
      
      if (managerComment) {
        itemData[getColumnInternalName('AttendanceRegularization', 'ManagerComment')] = managerComment;
      }
      
      // Call httpService.updateListItem
      await this.httpService.updateListItem(listName, requestId, itemData);
      
      console.log(`[ApprovalService] Rejected request ${requestId}`);
      
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
      
      // Call httpService.createListItem
      const newRequest = await this.httpService.createListItem<IAttendanceRegularization>(
        listName,
        itemData
      );
      
      console.log(`[ApprovalService] Created new regularization request with ID: ${newRequest.Id}`);
      
      return newRequest;
      
    } catch (error) {
      console.error('[ApprovalService] Error submitting regularization request:', error);
      throw error;
    }
  }

  /**
   * Helper method to format date range for display
   */
  private formatDateRange(fromDate: string, toDate: string): string {
    if (!fromDate) return '';
    
    const from = new Date(fromDate);
    const to = new Date(toDate);
    
    if (fromDate === toDate) {
      return from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    return `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
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