// services/TimesheetService.ts
// Service for timesheet-related SharePoint operations
// Handles TimesheetHeader and TimesheetLines lists

import { SPHttpClient } from '@microsoft/sp-http';
import { HttpClientService } from './HttpClientService';
import { SharePointConfig, getListInternalName, getColumnInternalName } from '../config/SharePointConfig';
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
 * Map SharePoint response to canonical ITimesheetLines format
 * Handles both SharePoint column names and canonical property names
 */
private mapToTimesheetLine(spItem: any): ITimesheetLines {
  return {
    // SharePoint metadata
    Id: spItem.Id || spItem.ID,
    Created: spItem.Created,
    Modified: spItem.Modified,
    
    // Canonical properties (normalized)
    TimesheetHeaderId: spItem.TimesheetHeaderId || spItem.TimesheetID,
    WorkDate: spItem.EntryDate || spItem.WorkDate, // ✅ Map EntryDate → WorkDate
    ProjectId: undefined, // Not available in current schema
    TaskId: undefined,    // Not available in current schema
    Hours: spItem.HoursBooked || spItem.Hours,
    Comments: spItem.Description || spItem.Comments,
    
    // SharePoint internal names (as-is)
    TimesheetID: spItem.TimesheetHeaderId || spItem.TimesheetID,
    EntryDate: spItem.EntryDate,
    ProjectNumber: spItem.ProjectNumber, // ✅ Actual SharePoint field
    Title: spItem.Title,
    BLANumber: spItem.BLANumber,
    HoursBooked: spItem.HoursBooked,
    Description: spItem.Description,
    
    // Legacy aliases
    ProjectNo: spItem.ProjectNumber, // ✅ Map ProjectNumber → ProjectNo
    TaskNo: spItem.Title,
    BLA_No: spItem.BLANumber
  };
}

  /**
   * Get timesheet header for a specific week and employee
   * @param employeeId Employee ID
   * @param weekStartDate Week start date (Monday, ISO format)
   */
  public async getTimesheetHeader(employeeId: string, weekStartDate: string): Promise<ITimesheetHeader | null> {
    try {
      // TODO: Implement REST call to TimesheetHeader list
      const listName = getListInternalName('timesheetHeader');
      
      // Build filter for employee and week
      const empIdCol = getColumnInternalName('TimesheetHeader', 'EmployeeID');
      const weekStartCol = getColumnInternalName('TimesheetHeader', 'WeekStartDate');
      
      const filterQuery = `$filter=${empIdCol} eq '${employeeId}' and ${weekStartCol} eq '${weekStartDate}'`;
      
      const selectFields = [
        'Id',
        empIdCol,
        weekStartCol,
        getColumnInternalName('TimesheetHeader', 'Status'),
        getColumnInternalName('TimesheetHeader', 'SubmissionDate'),
        'Created',
        'Modified'
      ];
      
      // TODO: Call httpService.getListItems
      const items = await this.httpService.getListItems<ITimesheetHeader>(
        listName,
        selectFields,
        filterQuery
      );
      
      return items.length > 0 ? items[0] : null;
      
      // PLACEHOLDER: Return null until implemented
      // console.log(`[TimesheetService] getTimesheetHeader for ${employeeId}, week ${weekStartDate}`);
      // return null;
      
    } catch (error) {
      console.error('[TimesheetService] Error getting timesheet header:', error);
      throw error;
    }
  }

  /**
   * Get timesheet lines for a specific timesheet header
   * @param timesheetId Timesheet header ID
   */
  public async getTimesheetLines(timesheetId: number): Promise<ITimesheetLines[]> {
    try {
      // TODO: Implement REST call to TimesheetLines list
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
         'Created',
      'Modified'
      ];
      
      const orderBy = getColumnInternalName('TimesheetLines', 'WorkDate');
      
      // TODO: Call httpService.getListItems
         // Get raw items from SharePoint
    const rawItems = await this.httpService.getListItems<any>(
      listName,
      selectFields,
      filterQuery,
      orderBy
    );
    
    // ✅ CRITICAL: Map SharePoint data to canonical format
    const mappedItems = rawItems.map(item => this.mapToTimesheetLine(item));
      
      // PLACEHOLDER: Return empty array until implemented
      // console.log(`[TimesheetService] getTimesheetLines for timesheet ${timesheetId}`);
      // return [];
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
      // TODO: Implement REST call with date range filter
      // Note: This requires joining with TimesheetHeader or filtering by dates directly
      
      // PLACEHOLDER: Return empty array until implemented
      console.log(`[TimesheetService] getTimesheetLinesByDateRange for ${employeeId}, ${startDate} to ${endDate}`);
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
      // TODO: Implement REST POST to TimesheetHeader list
      const listName = getListInternalName('timesheetHeader');
      
      const itemData = {
        [getColumnInternalName('TimesheetHeader', 'EmployeeID')]: employeeId,
        [getColumnInternalName('TimesheetHeader', 'WeekStartDate')]: weekStartDate,
        [getColumnInternalName('TimesheetHeader', 'Status')]: 'Draft'
      };
      
      // TODO: Call httpService.createListItem
      const newHeader = await this.httpService.createListItem<ITimesheetHeader>(
        listName,
        itemData
      );
      
      return newHeader;
      
      // PLACEHOLDER: Return mock data until implemented
      // console.log(`[TimesheetService] createTimesheetHeader for ${employeeId}, week ${weekStartDate}`);
    
      // const header: ITimesheetHeader = {
      //   Id: -1,
      //   EmployeeId: Number(employeeId),
      //   WeekStartDate: weekStartDate,
      //   WeekEndDate: '', // TODO: calculate week end if missing
      //   Status: 'Draft'
      // };
      // return header as ITimesheetHeader;
      
    } catch (error) {
      console.error('[TimesheetService] Error creating timesheet header:', error);
      throw error;
    }
  }

  /**
   * Create a new timesheet line
   * @param timesheetLine Timesheet line data
   */
  public async createTimesheetLine(timesheetLine: Partial<ITimesheetLines>): Promise<ITimesheetLines> {
  try {
    const listName = getListInternalName('timesheetLines');
    
    // ✅ FIXED: Use actual SharePoint column names
    const itemData = {
      [getColumnInternalName('TimesheetLines', 'TimesheetID')]: timesheetLine.TimesheetID || timesheetLine.TimesheetHeaderId,
      [getColumnInternalName('TimesheetLines', 'WorkDate')]: timesheetLine.WorkDate || timesheetLine.EntryDate,
      [getColumnInternalName('TimesheetLines', 'ProjectNo')]: timesheetLine.ProjectNo || timesheetLine.ProjectNumber,
      [getColumnInternalName('TimesheetLines', 'TaskNo')]: timesheetLine.TaskNo || timesheetLine.Title || '',
      [getColumnInternalName('TimesheetLines', 'BLA_No')]: timesheetLine.BLA_No || timesheetLine.BLANumber || '',
      [getColumnInternalName('TimesheetLines', 'HoursBooked')]: timesheetLine.HoursBooked || timesheetLine.Hours,
      [getColumnInternalName('TimesheetLines', 'Description')]: timesheetLine.Description || timesheetLine.Comments || ''
    };
    
    const createdItem = await this.httpService.createListItem<any>(
      listName,
      itemData
    );
    
    // ✅ CRITICAL: Fetch complete item and map it
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
      
      // ✅ Map to canonical format
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
   * @param lineId Line ID
   * @param timesheetLine Updated timesheet line data
   */
 public async updateTimesheetLine(lineId: number, timesheetLine: Partial<ITimesheetLines>): Promise<ITimesheetLines> {
  try {
    const listName = getListInternalName('timesheetLines');
    
    const itemData: any = {};
    
    // ✅ Only update provided fields, use actual SharePoint column names
    if (timesheetLine.WorkDate || timesheetLine.EntryDate) {
      itemData[getColumnInternalName('TimesheetLines', 'WorkDate')] = timesheetLine.WorkDate || timesheetLine.EntryDate;
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
    
    await this.httpService.updateListItem<any>(
      listName,
      lineId,
      itemData
    );
    
    // ✅ Fetch updated item and map
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
      // TODO: Implement REST DELETE to TimesheetLines list
      const listName = getListInternalName('timesheetLines');
      
      // TODO: Call httpService.deleteListItem
      await this.httpService.deleteListItem(listName, lineId);
      
      // PLACEHOLDER: Log until implemented
      console.log(`[TimesheetService] deleteTimesheetLine ${lineId}`);
      
    } catch (error) {
      console.error('[TimesheetService] Error deleting timesheet line:', error);
      throw error;
    }
  }

  /**
   * Submit timesheet for approval
   * @param timesheetId Timesheet header ID
   */
  public async submitTimesheet(timesheetId: number): Promise<void> {
    try {
      // TODO: Implement REST MERGE to update status to 'Submitted'
      const listName = getListInternalName('timesheetHeader');
      
      const itemData = {
        [getColumnInternalName('TimesheetHeader', 'Status')]: 'Submitted',
        [getColumnInternalName('TimesheetHeader', 'SubmissionDate')]: new Date().toISOString()
      };
      
      // TODO: Call httpService.updateListItem
      await this.httpService.updateListItem(listName, timesheetId, itemData);
      
      // PLACEHOLDER: Log until implemented
      console.log(`[TimesheetService] submitTimesheet ${timesheetId}`);
      
    } catch (error) {
      console.error('[TimesheetService] Error submitting timesheet:', error);
      throw error;
    }
  }

  /**
   * Calculate total hours for a timesheet
   * @param timesheetId Timesheet header ID
   */
  public async calculateTotalHours(timesheetId: number): Promise<number> {
    try {
      // TODO: Implement calculation from TimesheetLines
      const lines = await this.getTimesheetLines(timesheetId);
      
      // FIXED: Handle potentially undefined HoursBooked values
      const totalHours = lines.reduce((sum, line) => {
        // Use nullish coalescing to provide default value of 0 if HoursBooked is undefined
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