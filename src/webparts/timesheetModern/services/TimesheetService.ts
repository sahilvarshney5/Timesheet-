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
  public async getTimesheetHeader(employeeId: string, weekStartDate: string,weekEndDate:string): Promise<ITimesheetHeader | null> {
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
      
      return items.length > 0 ? items[0] : null;
      
    } catch (error) {
      console.error('[TimesheetService] Error getting timesheet header:', error);
      throw error;
    }
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
        [getColumnInternalName('TimesheetLines', 'Description')]: timesheetLine.Description || timesheetLine.Comments || ''
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
   * Submit timesheet for approval
   * @param timesheetId Timesheet header ID
   */
  public async submitTimesheet(timesheetId: number): Promise<void> {
    try {
      const listName = getListInternalName('timesheetHeader');
      
      const itemData = {
        [getColumnInternalName('TimesheetHeader', 'Status')]: 'Submitted',
        [getColumnInternalName('TimesheetHeader', 'SubmissionDate')]: new Date().toISOString()
      };
      
      await this.httpService.updateListItem(listName, timesheetId, itemData);
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