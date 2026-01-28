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
      // const items = await this.httpService.getListItems<ITimesheetHeader>(
      //   listName,
      //   selectFields,
      //   filterQuery
      // );
      
      // return items.length > 0 ? items[0] : null;
      
      // PLACEHOLDER: Return null until implemented
      console.log(`[TimesheetService] getTimesheetHeader for ${employeeId}, week ${weekStartDate}`);
      return null;
      
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
        timesheetIdCol,
        getColumnInternalName('TimesheetLines', 'WorkDate'),
        getColumnInternalName('TimesheetLines', 'ProjectNo'),
        getColumnInternalName('TimesheetLines', 'TaskNo'),
        getColumnInternalName('TimesheetLines', 'BLA_No'),
        getColumnInternalName('TimesheetLines', 'HoursBooked'),
        getColumnInternalName('TimesheetLines', 'Description')
      ];
      
      const orderBy = getColumnInternalName('TimesheetLines', 'WorkDate');
      
      // TODO: Call httpService.getListItems
      // const items = await this.httpService.getListItems<ITimesheetLines>(
      //   listName,
      //   selectFields,
      //   filterQuery,
      //   orderBy
      // );
      
      // return items;
      
      // PLACEHOLDER: Return empty array until implemented
      console.log(`[TimesheetService] getTimesheetLines for timesheet ${timesheetId}`);
      return [];
      
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
      // const newHeader = await this.httpService.createListItem<ITimesheetHeader>(
      //   listName,
      //   itemData
      // );
      
      // return newHeader;
      
      // PLACEHOLDER: Return mock data until implemented
      console.log(`[TimesheetService] createTimesheetHeader for ${employeeId}, week ${weekStartDate}`);
    
      const header: ITimesheetHeader = {
  Id: -1,
  EmployeeId: Number(employeeId),
  WeekStartDate: weekStartDate,
  WeekEndDate: '', // TODO: calculate week end if missing
  Status: 'Draft'
};
return header as ITimesheetHeader;

      
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
      // TODO: Implement REST POST to TimesheetLines list
      const listName = getListInternalName('timesheetLines');
      
      const itemData = {
        [getColumnInternalName('TimesheetLines', 'TimesheetID')]: timesheetLine.TimesheetID,
        [getColumnInternalName('TimesheetLines', 'WorkDate')]: timesheetLine.WorkDate,
        [getColumnInternalName('TimesheetLines', 'ProjectNo')]: timesheetLine.ProjectNo,
        [getColumnInternalName('TimesheetLines', 'TaskNo')]: timesheetLine.TaskNo,
        [getColumnInternalName('TimesheetLines', 'BLA_No')]: timesheetLine.BLA_No || '',
        [getColumnInternalName('TimesheetLines', 'HoursBooked')]: timesheetLine.HoursBooked,
        [getColumnInternalName('TimesheetLines', 'Description')]: timesheetLine.Description || ''
      };
      
      // TODO: Call httpService.createListItem
      // const newLine = await this.httpService.createListItem<ITimesheetLines>(
      //   listName,
      //   itemData
      // );
      
      // return newLine;
      
      // PLACEHOLDER: Return mock data until implemented
      console.log(`[TimesheetService] createTimesheetLine`, timesheetLine);
      return {
        Id: -1,
        ...timesheetLine
      } as ITimesheetLines;
      
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
      // TODO: Implement REST MERGE to TimesheetLines list
      const listName = getListInternalName('timesheetLines');
      
      const itemData: any = {};
      
      if (timesheetLine.WorkDate) {
        itemData[getColumnInternalName('TimesheetLines', 'WorkDate')] = timesheetLine.WorkDate;
      }
      if (timesheetLine.ProjectNo) {
        itemData[getColumnInternalName('TimesheetLines', 'ProjectNo')] = timesheetLine.ProjectNo;
      }
      if (timesheetLine.TaskNo) {
        itemData[getColumnInternalName('TimesheetLines', 'TaskNo')] = timesheetLine.TaskNo;
      }
      if (timesheetLine.BLA_No !== undefined) {
        itemData[getColumnInternalName('TimesheetLines', 'BLA_No')] = timesheetLine.BLA_No;
      }
      if (timesheetLine.HoursBooked !== undefined) {
        itemData[getColumnInternalName('TimesheetLines', 'HoursBooked')] = timesheetLine.HoursBooked;
      }
      if (timesheetLine.Description !== undefined) {
        itemData[getColumnInternalName('TimesheetLines', 'Description')] = timesheetLine.Description;
      }
      
      // TODO: Call httpService.updateListItem
      // const updatedLine = await this.httpService.updateListItem<ITimesheetLines>(
      //   listName,
      //   lineId,
      //   itemData
      // );
      
      // return updatedLine;
      
      // PLACEHOLDER: Return mock data until implemented
      console.log(`[TimesheetService] updateTimesheetLine ${lineId}`, timesheetLine);
      return {
        Id: lineId,
        ...timesheetLine
      } as ITimesheetLines;
      
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
      // await this.httpService.deleteListItem(listName, lineId);
      
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
      // await this.httpService.updateListItem(listName, timesheetId, itemData);
      
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
      
      const totalHours = lines.reduce((sum, line) => sum + line.HoursBooked, 0);
      
      return totalHours;
      
    } catch (error) {
      console.error('[TimesheetService] Error calculating total hours:', error);
      throw error;
    }
  }
}