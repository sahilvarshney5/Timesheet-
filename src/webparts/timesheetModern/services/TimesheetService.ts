// services/TimesheetService.ts
// FIXED: Added date normalization to handle ISO format dates from SharePoint
// Service for timesheet-related SharePoint operations
// Handles TimesheetHeader and TimesheetLines lists

import { SPHttpClient } from '@microsoft/sp-http';
import { HttpClientService } from './HttpClientService';
import { SharePointConfig, getListInternalName, getColumnInternalName } from '../config/SharePointConfig';
import { normalizeDateToString } from '../utils/DateUtils';
import {
  ITimesheetHeader,
  ITimesheetLines,
  ITimesheetWeek,
  ITimesheetDay,
  ITimesheetEntry
} from '../models';

export class TimesheetService {
  private httpService: HttpClientService;

  constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    this.httpService = new HttpClientService(spHttpClient, siteUrl);
  }
  

  /**
 * PRODUCTION FIX: Get or create timesheet header (idempotent)
 * 
 * This method ensures a header exists before submission.
 * It prevents duplicate headers and handles race conditions.
 * 
 * @param employeeId Employee ID
 * @param weekStartDate Week start date (Monday, YYYY-MM-DD or ISO format)
 * @param weekEndDate Week end date (Sunday, YYYY-MM-DD or ISO format)
 * @param managerEmail Optional manager email
 * @returns Timesheet header (existing or newly created)
 */
public async getOrCreateTimesheetHeader(
  employeeId: string,
  weekStartDate: string,
  weekEndDate: string,
  managerEmail?: string
): Promise<ITimesheetHeader> {
  try {
    console.log(`[TimesheetService] getOrCreateTimesheetHeader - Employee: ${employeeId}, Week: ${weekStartDate} to ${weekEndDate}`);

    // ✅ STEP 1: Try to fetch existing headers (returns ITimesheetHeader[])
    const existingHeaders = await this.getTimesheetHeader(employeeId, weekStartDate, weekEndDate);

    // ✅ FIX: getTimesheetHeader returns ITimesheetHeader[] - take the first element safely.
    //         Previous code did `return [existingHeader]` which produced ITimesheetHeader[][]
    //         and broke the Promise<ITimesheetHeader> return contract.
    if (existingHeaders && existingHeaders.length > 0) {
      const first = existingHeaders[0];
      console.log(`[TimesheetService] Found existing header - ID: ${first.Id}`);
      return first; // ✅ Single ITimesheetHeader, not wrapped in another array
    }

    // ✅ STEP 2: No header found - create new one
    console.warn(`[TimesheetService] No header found for week ${weekStartDate}. Creating new header...`);

    const normalizedWeekStart = normalizeDateToString(weekStartDate);
    const normalizedWeekEnd   = normalizeDateToString(weekEndDate);

    const listName = getListInternalName('timesheetHeader');

    const itemData: Record<string, string> = {
      [getColumnInternalName('TimesheetHeader', 'EmployeeID')]:    employeeId,
      [getColumnInternalName('TimesheetHeader', 'WeekStartDate')]: normalizedWeekStart,
      [getColumnInternalName('TimesheetHeader', 'Status')]:        'Draft'
    };

    if (managerEmail) {
      itemData['ManagerEmail'] = managerEmail;
    }

    // ✅ STEP 3: Create header in SharePoint
    const newHeader = await this.httpService.createListItem<ITimesheetHeader>(
      listName,
      itemData
    );

    console.log(`[TimesheetService] ✅ Created new timesheet header - ID: ${newHeader.Id}`);

    // ✅ STEP 4: Verify creation (handles race conditions)
    const verifiedHeaders = await this.getTimesheetHeader(employeeId, weekStartDate, weekEndDate);

    if (!verifiedHeaders || verifiedHeaders.length === 0) {
      throw new Error('Failed to verify newly created timesheet header');
    }

    return verifiedHeaders[0]; // ✅ Return single ITimesheetHeader

  } catch (error) {
    console.error('[TimesheetService] ❌ Error in getOrCreateTimesheetHeader:', {
      employeeId,
      weekStartDate,
      weekEndDate,
      error: error instanceof Error ? error.message : error
    });

    // ✅ Duplicate header race-condition recovery
    if (error instanceof Error && error.message.includes('duplicate')) {
      console.warn('[TimesheetService] Duplicate header detected (race condition). Fetching existing...');
      const retryHeaders = await this.getTimesheetHeader(employeeId, weekStartDate, weekEndDate);
      if (retryHeaders && retryHeaders.length > 0) {
        return retryHeaders[0]; // ✅ Return single ITimesheetHeader
      }
    }

    throw error;
  }
}

/**
 * Convenience wrapper: returns a single header or null.
 * Use this in any caller that expects exactly one header (UI, submit flow, etc.).
 * Internally calls getTimesheetHeader() and takes the first element safely.
 *
 * @param employeeId   Employee ID
 * @param weekStartDate Week start date (YYYY-MM-DD or ISO)
 * @param weekEndDate   Week end date   (YYYY-MM-DD or ISO)
 */
public async getSingleTimesheetHeader(
  employeeId: string,
  weekStartDate: string,
  weekEndDate: string
): Promise<ITimesheetHeader | null> {
  const headers = await this.getTimesheetHeader(employeeId, weekStartDate, weekEndDate);
  if (!headers || headers.length === 0) {
    return null;
  }
  return headers[0];
}

  // TimesheetService.ts - ENHANCEMENT PATCH
// Add this method to TimesheetService class to support manager email

/**
 * ENHANCED: Submit timesheet for approval with manager email
 * @param timesheetId Timesheet header ID
 * @param managerEmail Manager email address
 */
public async submitTimesheetWithManagerEmail(timesheetId: number, managerEmail?: string): Promise<void> {
  try {
    const listName = getListInternalName('timesheetHeader');
    
    const itemData: any = {
      [getColumnInternalName('TimesheetHeader', 'Status')]: 'Submitted',
      [getColumnInternalName('TimesheetHeader', 'SubmissionDate')]: new Date().toISOString()
    };

    if (managerEmail) {
      itemData.ManagerEmail = managerEmail;
    }
    
    await this.httpService.updateListItem(listName, timesheetId, itemData);
    
  } catch (error) {
    throw error;
  }
}

// ALSO UPDATE: Modify createTimesheetHeader to accept optional managerEmail parameter
/**
 * ENHANCED: Create a new timesheet header with manager email
 * @param employeeId Employee ID
 * @param weekStartDate Week start date (Monday, ISO format)
 * @param managerEmail Optional manager email
 */
public async createTimesheetHeaderWithManagerEmail(
  employeeId: string, 
  weekStartDate: string,
  managerEmail?: string
): Promise<ITimesheetHeader> {
  try {
    const normalizedWeekStart = normalizeDateToString(weekStartDate);
    
    const listName = getListInternalName('timesheetHeader');
    
    const itemData: any = {
      [getColumnInternalName('TimesheetHeader', 'EmployeeID')]: employeeId,
      [getColumnInternalName('TimesheetHeader', 'WeekStartDate')]: normalizedWeekStart,
      [getColumnInternalName('TimesheetHeader', 'Status')]: 'Draft'
    };

    if (managerEmail) {
      itemData.ManagerEmail = managerEmail;
    }
    
    const newHeader = await this.httpService.createListItem<ITimesheetHeader>(
      listName,
      itemData
    );
    
    return newHeader;
    
  } catch (error) {
    throw error;
  }
}
  /**
   * Map SharePoint response to canonical ITimesheetLines format
   * FIXED: Normalizes all date fields to YYYY-MM-DD format
   * Handles both SharePoint column names and canonical property names
   */
  private mapToTimesheetLine(spItem: any): ITimesheetLines {
    // ✅ CRITICAL: Normalize date fields from ISO format to YYYY-MM-DD
    const workDate = normalizeDateToString(spItem.EntryDate || spItem.WorkDate);
    
    return {
      // SharePoint metadata
      Id: spItem.Id || spItem.ID,
      Created: spItem.Created,
      Modified: spItem.Modified,
      
      // Canonical properties (normalized)
      TimesheetHeaderId: spItem.TimesheetHeaderId || spItem.TimesheetID,
      WorkDate: workDate, // ✅ NORMALIZED DATE
      ProjectId: 0, // Not available in current schema
      TaskId: 0,    // Not available in current schema
      Hours: spItem.HoursBooked || spItem.Hours,
      Comments: spItem.Description || spItem.Comments,
      TaskName:spItem.TaskName,
      // SharePoint internal names (as-is)
      TimesheetID: spItem.TimesheetHeaderId || spItem.TimesheetID,
      EntryDate: workDate, // ✅ NORMALIZED DATE
      ProjectNumber: spItem.ProjectNumber,
      Title: spItem.Title,
      BLANumber: spItem.BLANumber,
      HoursBooked: spItem.HoursBooked,
      Description: spItem.Description,
      
      // Legacy aliases
      ProjectNo: spItem.ProjectNumber,
      TaskNo: spItem.Title,
      BLA_No: spItem.BLANumber
    };
  }

  /**
   * Get timesheet header for a specific week and employee
   * @param employeeId Employee ID
   * @param weekStartDate Week start date (Monday, ISO format)
   * @param weekEndDate Week end date (Sunday, ISO format)
   */
  public async getTimesheetHeader(employeeId: string, weekStartDate: string,weekEndDate:string): Promise<ITimesheetHeader[] | null> {
    try {
      // ✅ Normalize input date
      const normalizedWeekStart = normalizeDateToString(weekStartDate);
      const normalizedWeekEnd = normalizeDateToString(weekEndDate);
      
      const listName = getListInternalName('timesheetHeader');
      
      // Build filter for employee and week
      const empIdCol = getColumnInternalName('TimesheetHeader', 'EmployeeID');
      const weekStartCol = getColumnInternalName('TimesheetHeader', 'WeekStartDate');
      
      const filterQuery = `$filter=${empIdCol} eq '${employeeId}' and ${weekStartCol} ge '${normalizedWeekStart}' and ${weekStartCol} le '${normalizedWeekEnd}'`;
      
      const selectFields = [
        'Id',
        empIdCol,
        weekStartCol,
        getColumnInternalName('TimesheetHeader', 'Status'),
        getColumnInternalName('TimesheetHeader', 'SubmissionDate'),
        'Created',
        'Modified'
      ];
      
      const items = await this.httpService.getListItems<ITimesheetHeader>(
        listName,
        selectFields,
        filterQuery
      );
      
      // return items.length > 0 ? items[0] : null;
       // ✅ CASE 1: No headers found
    if (items.length === 0) {
      console.log(`[TimesheetService] No header found for ${employeeId}, week ${normalizedWeekStart}`);
      return [];
    }
    
    // ✅ CASE 2: Single header found (expected scenario)
    if (items.length === 1) {
      console.log(`[TimesheetService] Found header ID: ${items[0].Id}, Status: ${items[0].Status}`);
      return [this.maptotimesheetdata(items[0])];
    }
    
    // ✅ CASE 3: Multiple headers found (DUPLICATE SCENARIO)
    console.warn(`[TimesheetService] ⚠️ DUPLICATE HEADERS DETECTED!`);
    console.warn(`[TimesheetService] Found ${items.length} headers for ${employeeId}, week ${normalizedWeekStart}`);
    console.warn(`[TimesheetService] Header IDs:`, items.map(h => `${h.Id} (${h.Status})`).join(', '));
    
    // ✅ Priority logic for selecting the "best" header:
    
    // // Priority 1: Prefer Draft status (can be edited)
    // const draftHeaders = items.filter(h => h.Status === 'Draft');
    // if (draftHeaders.length > 0) {
    //   console.warn(`[TimesheetService] → Selecting Draft header ID: ${draftHeaders[0].Id}`);
    //   return draftHeaders[0]; // Most recent draft
    // }
    
    // Priority 2: Prefer Submitted over Approved (might need changes)
    const submittedHeaders = items.filter(h => h.Status === 'Submitted');
    // let data = []
    
    
    if (submittedHeaders.length>0) {
      console.warn(`[TimesheetService] → Selecting Submitted header ID: ${submittedHeaders[0].Id}`);
      return submittedHeaders.map(data=>
        this.maptotimesheetdata(data)
      );
    }
    
    // Priority 3: Return most recent (already ordered by Created desc)
    console.warn(`[TimesheetService] → Selecting most recent header ID: ${items[0].Id}`);

      return items.map(h =>
        this.maptotimesheetdata(h)
      );      
    } catch (error) {
      console.error('[TimesheetService] Error getting timesheet header:', error);
      throw error;
    }
  }
private maptotimesheetdata(spItem: any): ITimesheetHeader {
    return {
      // SharePoint metadata
      Id:spItem.Id,
      EmployeeId:spItem.Title,
      WeekStartDate:spItem.WeekStartDate,
      WeekEndDate:spItem.WeekStartDate,
      Status:spItem.Status
    };
  }

  /**
   * Get timesheet lines for a specific timesheet header
   * FIXED: Returns normalized dates in YYYY-MM-DD format
   * @param timesheetId Timesheet header ID
   */
  public async getTimesheetLines(timesheetId: number): Promise<ITimesheetLines[]> {
    try {
      const listName = getListInternalName('timesheetLines');
      
      const timesheetIdCol = getColumnInternalName('TimesheetLines', 'TimesheetID');
      const filterQuery = `$filter=${timesheetIdCol} eq ${timesheetId}`;
      
      const selectFields = [
        'Id',
        'ID',
        timesheetIdCol,
        getColumnInternalName('TimesheetLines', 'WorkDate'),
        getColumnInternalName('TimesheetLines', 'ProjectNo'),
        getColumnInternalName('TimesheetLines', 'TaskNo'),
        getColumnInternalName('TimesheetLines', 'BLA_No'),
        getColumnInternalName('TimesheetLines', 'HoursBooked'),
        getColumnInternalName('TimesheetLines', 'Description'),
        getColumnInternalName('TimesheetLines', 'TaskName'),
        'Created',
        'Modified'
      ];
      
      const orderBy = getColumnInternalName('TimesheetLines', 'WorkDate');
      
      // Get raw items from SharePoint
      const rawItems = await this.httpService.getListItems<any>(
        listName,
        selectFields,
        filterQuery,
        orderBy
      );
      
      // ✅ CRITICAL: Map SharePoint data to canonical format with normalized dates
      const mappedItems = rawItems.map(item => this.mapToTimesheetLine(item));
      
      console.log(`[TimesheetService] Loaded ${mappedItems.length} timesheet lines (dates normalized)`);
      return mappedItems;

    } catch (error) {
      console.error('[TimesheetService] Error getting timesheet lines:', error);
      throw error;
    }
  }

  /**
   * Get timesheet lines for a specific employee and date range
   * @param employeeId Employee ID
   * @param startDate Start date (ISO format)
   * @param endDate End date (ISO format)
   */
  public async getTimesheetLinesByDateRange(
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<ITimesheetLines[]> {
    try {
      // ✅ Normalize input dates
      const normalizedStart = normalizeDateToString(startDate);
      const normalizedEnd = normalizeDateToString(endDate);
      
      // TODO: Implement REST call with date range filter
      // Note: This requires joining with TimesheetHeader or filtering by dates directly
      
      console.log(`[TimesheetService] getTimesheetLinesByDateRange for ${employeeId}, ${normalizedStart} to ${normalizedEnd}`);
      return [];
      
    } catch (error) {
      console.error('[TimesheetService] Error getting timesheet lines by date range:', error);
      throw error;
    }
  }

  /**
   * Create a new timesheet header
   * @param employeeId Employee ID
   * @param weekStartDate Week start date (Monday, ISO format)
   */
  public async createTimesheetHeader(employeeId: string, weekStartDate: string): Promise<ITimesheetHeader> {
    try {
      // ✅ Normalize input date
      const normalizedWeekStart = normalizeDateToString(weekStartDate);
      
      const listName = getListInternalName('timesheetHeader');
      
      const itemData = {
        [getColumnInternalName('TimesheetHeader', 'EmployeeID')]: employeeId,
        [getColumnInternalName('TimesheetHeader', 'WeekStartDate')]: normalizedWeekStart,
        [getColumnInternalName('TimesheetHeader', 'Status')]: 'Draft'
      };
      
      const newHeader = await this.httpService.createListItem<ITimesheetHeader>(
        listName,
        itemData
      );
      
      return newHeader;
      
    } catch (error) {
      console.error('[TimesheetService] Error creating timesheet header:', error);
      throw error;
    }
  }

  /**
   * Create a new timesheet line
   * FIXED: Normalizes date before saving to SharePoint
   * @param timesheetLine Timesheet line data
   */
  public async createTimesheetLine(timesheetLine: Partial<ITimesheetLines>): Promise<ITimesheetLines> {
    try {
      const listName = getListInternalName('timesheetLines');
      
      // ✅ CRITICAL: Normalize date before saving
      const normalizedWorkDate = normalizeDateToString(
        timesheetLine.WorkDate || timesheetLine.EntryDate
      );
      
      // ✅ FIXED: Use actual SharePoint column names with normalized date
      const itemData = {
        [getColumnInternalName('TimesheetLines', 'TimesheetID')]: timesheetLine.TimesheetID || timesheetLine.TimesheetHeaderId,
        [getColumnInternalName('TimesheetLines', 'WorkDate')]: normalizedWorkDate,
        [getColumnInternalName('TimesheetLines', 'ProjectNo')]: timesheetLine.ProjectNo || timesheetLine.ProjectNumber,
        [getColumnInternalName('TimesheetLines', 'TaskNo')]: timesheetLine.TaskNo || timesheetLine.Title || '',
        [getColumnInternalName('TimesheetLines', 'BLA_No')]: timesheetLine.BLA_No || timesheetLine.BLANumber || '',
        [getColumnInternalName('TimesheetLines', 'HoursBooked')]: timesheetLine.HoursBooked || timesheetLine.Hours,
        [getColumnInternalName('TimesheetLines', 'Description')]: timesheetLine.Description || timesheetLine.Comments || '',
        [getColumnInternalName('TimesheetLines', 'TaskName')]: timesheetLine.TaskName || timesheetLine.Comments || ''
      };
      
      const createdItem = await this.httpService.createListItem<any>(
        listName,
        itemData
      );
      
      // ✅ CRITICAL: Fetch complete item and map it with normalized dates
      if (createdItem && createdItem.Id) {
        const selectFields = [
          'Id',
          'ID',
          getColumnInternalName('TimesheetLines', 'TimesheetID'),
          getColumnInternalName('TimesheetLines', 'WorkDate'),
          getColumnInternalName('TimesheetLines', 'ProjectNo'),
          getColumnInternalName('TimesheetLines', 'TaskNo'),
          getColumnInternalName('TimesheetLines', 'BLA_No'),
          getColumnInternalName('TimesheetLines', 'HoursBooked'),
          getColumnInternalName('TimesheetLines', 'Description'),
          'Created',
          'Modified'
        ];
        
        const completeItem = await this.httpService.getListItemById<any>(
          listName,
          createdItem.Id,
          selectFields
        );
        
        // ✅ Map to canonical format with normalized dates
        return this.mapToTimesheetLine(completeItem);
      }
      
      return this.mapToTimesheetLine(createdItem);
      
    } catch (error) {
      console.error('[TimesheetService] Error creating timesheet line:', error);
      throw error;
    }
  }

  /**
   * Update an existing timesheet line
   * FIXED: Normalizes date before updating
   * @param lineId Line ID
   * @param timesheetLine Updated timesheet line data
   */
  public async updateTimesheetLine(lineId: number, timesheetLine: Partial<ITimesheetLines>): Promise<ITimesheetLines> {
    try {
      const listName = getListInternalName('timesheetLines');
      
      const itemData: any = {};
      
      // ✅ Only update provided fields, use actual SharePoint column names
      if (timesheetLine.WorkDate || timesheetLine.EntryDate) {
        // ✅ CRITICAL: Normalize date before update
        const normalizedDate = normalizeDateToString(timesheetLine.WorkDate || timesheetLine.EntryDate);
        itemData[getColumnInternalName('TimesheetLines', 'WorkDate')] = normalizedDate;
      }
      if (timesheetLine.ProjectNo || timesheetLine.ProjectNumber) {
        itemData[getColumnInternalName('TimesheetLines', 'ProjectNo')] = timesheetLine.ProjectNo || timesheetLine.ProjectNumber;
      }
      if (timesheetLine.TaskNo || timesheetLine.Title !== undefined) {
        itemData[getColumnInternalName('TimesheetLines', 'TaskNo')] = timesheetLine.TaskNo || timesheetLine.Title;
      }
      if (timesheetLine.BLA_No || timesheetLine.BLANumber !== undefined) {
        itemData[getColumnInternalName('TimesheetLines', 'BLA_No')] = timesheetLine.BLA_No || timesheetLine.BLANumber;
      }
      if (timesheetLine.HoursBooked !== undefined || timesheetLine.Hours !== undefined) {
        itemData[getColumnInternalName('TimesheetLines', 'HoursBooked')] = timesheetLine.HoursBooked || timesheetLine.Hours;
      }
      if (timesheetLine.Description !== undefined || timesheetLine.Comments !== undefined) {
        itemData[getColumnInternalName('TimesheetLines', 'Description')] = timesheetLine.Description || timesheetLine.Comments;
      }
       if (timesheetLine.TaskName !== undefined || timesheetLine.TaskName !== undefined) {
        itemData[getColumnInternalName('TimesheetLines', 'TaskName')] = timesheetLine.TaskName || timesheetLine.TaskName;
      }
      
      await this.httpService.updateListItem<any>(
        listName,
        lineId,
        itemData
      );
      
      // ✅ Fetch updated item and map with normalized dates
      const selectFields = [
        'Id',
        'ID',
        getColumnInternalName('TimesheetLines', 'TimesheetID'),
        getColumnInternalName('TimesheetLines', 'WorkDate'),
        getColumnInternalName('TimesheetLines', 'ProjectNo'),
        getColumnInternalName('TimesheetLines', 'TaskNo'),
        getColumnInternalName('TimesheetLines', 'BLA_No'),
        getColumnInternalName('TimesheetLines', 'HoursBooked'),
        getColumnInternalName('TimesheetLines', 'Description'),
        getColumnInternalName('TimesheetLines', 'TaskName'),
        'Created',
        'Modified'
      ];
      
      const updatedItem = await this.httpService.getListItemById<any>(
        listName,
        lineId,
        selectFields
      );
      
      return this.mapToTimesheetLine(updatedItem!);
      
    } catch (error) {
      console.error('[TimesheetService] Error updating timesheet line:', error);
      throw error;
    }
  }
  
  /**
   * Delete a timesheet line
   * @param lineId Line ID
   */
  public async deleteTimesheetLine(lineId: number): Promise<void> {
    try {
      const listName = getListInternalName('timesheetLines');
      await this.httpService.deleteListItem(listName, lineId);
      console.log(`[TimesheetService] deleteTimesheetLine ${lineId}`);
      
    } catch (error) {
      console.error('[TimesheetService] Error deleting timesheet line:', error);
      throw error;
    }
  }

 /**
 * ENHANCED: Submit timesheet for approval (with auto-header creation)
 * 
 * Enhanced version that ensures header exists before submission.
 * Prevents "No timesheet header found" error.
 * 
 * BACKWARD COMPATIBLE: Can be called with just timesheetId (old way)
 * or with all parameters (new way with auto-create)
 * 
 * @param timesheetId Timesheet header ID (optional if other params provided)
 * @param employeeId Employee ID (required if timesheetId not provided)
 * @param weekStartDate Week start date (required if timesheetId not provided)
 * @param weekEndDate Week end date (required if timesheetId not provided)
 * @param managerEmail Optional manager email
 */
public async submitTimesheet(
  timesheetId?: number,
  employeeId?: string,
  weekStartDate?: string,
  weekEndDate?: string,
  managerEmail?: string
): Promise<void> {
  try {
    let headerIdToSubmit: number;
    
    // ✅ SCENARIO 1: Header ID provided directly (backward compatible)
    if (timesheetId) {
      console.log(`[TimesheetService] Submitting timesheet with provided ID: ${timesheetId}`);
      headerIdToSubmit = timesheetId;
    }
    // ✅ SCENARIO 2: No header ID - fetch or create (NEW LOGIC)
    else if (employeeId && weekStartDate && weekEndDate) {
      console.log(`[TimesheetService] No header ID provided. Fetching/creating header...`);
      
      // ✅ CRITICAL: Get or create header (idempotent operation)
      const header = await this.getOrCreateTimesheetHeader(
        employeeId,
        weekStartDate,
        weekEndDate,
        managerEmail
      );
      
      if (!header || !header.Id) {
        throw new Error('Failed to get or create timesheet header');
      }
      
      headerIdToSubmit = header.Id;
      console.log(`[TimesheetService] Using header ID: ${headerIdToSubmit}`);
    }
    // ✅ SCENARIO 3: Invalid parameters
    else {
      throw new Error(
        'Invalid parameters: Either provide timesheetId OR (employeeId, weekStartDate, weekEndDate)'
      );
    }
    
    // ✅ Validate header exists before submission
    const listName = getListInternalName('timesheetHeader');
    const headerToSubmit = await this.httpService.getListItemById<ITimesheetHeader>(
      listName,
      headerIdToSubmit
    );
    
    if (!headerToSubmit) {
      throw new Error(`Timesheet header ${headerIdToSubmit} not found`);
    }
    
    // ✅ Check if already submitted/approved
    if (headerToSubmit.Status === 'Submitted') {
      console.warn(`[TimesheetService] Timesheet ${headerIdToSubmit} already submitted`);
      return; // Idempotent - don't fail if already submitted
    }
    
    if (headerToSubmit.Status === 'Approved') {
      throw new Error('Cannot submit an already approved timesheet');
    }
    
    // ✅ Build update data
    const itemData: any = {
      [getColumnInternalName('TimesheetHeader', 'Status')]: 'Submitted',
      [getColumnInternalName('TimesheetHeader', 'SubmissionDate')]: new Date().toISOString()
    };
    
    // ✅ Add manager email if provided
    if (managerEmail) {
      itemData.ManagerEmail = managerEmail;
    }
    
    // ✅ Submit the timesheet
    await this.httpService.updateListItem(listName, headerIdToSubmit, itemData);
    
    console.log(`[TimesheetService] ✅ Successfully submitted timesheet ${headerIdToSubmit}`);
    
  } catch (error) {
    // ✅ Enhanced error logging
    console.error('[TimesheetService] ❌ Error submitting timesheet:', {
      timesheetId,
      employeeId,
      weekStartDate,
      weekEndDate,
      error: error instanceof Error ? error.message : error
    });
    
    throw error;
  }
}

  /**
   * Calculate total hours for a timesheet
   * @param timesheetId Timesheet header ID
   */
  public async calculateTotalHours(timesheetId: number): Promise<number> {
    try {
      const lines = await this.getTimesheetLines(timesheetId);
      
      const totalHours = lines.reduce((sum, line) => {
        const hours = line.HoursBooked ?? 0;
        return sum + hours;
      }, 0);
      
      return totalHours;
      
    } catch (error) {
      console.error('[TimesheetService] Error calculating total hours:', error);
      throw error;
    }
  }
}