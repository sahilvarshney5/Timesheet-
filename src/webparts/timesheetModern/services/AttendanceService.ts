// services/AttendanceService.ts
// Service for attendance-related SharePoint operations
// Handles PunchData and LeaveData lists

import { SPHttpClient } from '@microsoft/sp-http';
import { HttpClientService } from './HttpClientService';
import { SharePointConfig, getListInternalName, getColumnInternalName, ODataHelpers } from '../config/SharePointConfig';
import { IPunchData, ILeaveData, ICalendarDay, ITimesheetDay } from '../models';

export class AttendanceService {
  private httpService: HttpClientService;

  constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    this.httpService = new HttpClientService(spHttpClient, siteUrl);
  }

  /**
   * Get punch data for a specific employee and date range
   * @param employeeId Employee ID
   * @param startDate Start date (ISO format)
   * @param endDate End date (ISO format)
   */
  public async getPunchData(employeeId: number, startDate: string, endDate: string): Promise<IPunchData[]> {
    try {
      // TODO: Implement REST call to PunchData list
      const listName = getListInternalName('punchData');
      
      const empIdCol = getColumnInternalName('PunchData', 'EmployeeID');
      const dateCol = getColumnInternalName('PunchData', 'AttendanceDate');
      
      // Build filter for employee and date range
      const filterQuery = `$filter=${empIdCol} eq '${employeeId}' and ${dateCol} ge '${startDate}' and ${dateCol} le '${endDate}'`;
      
      const selectFields = [
        'Id',
        empIdCol,
        dateCol,
        getColumnInternalName('PunchData', 'FirstPunchIn'),
        getColumnInternalName('PunchData', 'LastPunchOut'),
        getColumnInternalName('PunchData', 'TotalHours'),
        getColumnInternalName('PunchData', 'Status'),
        getColumnInternalName('PunchData', 'Source')
      ];
      
      const orderBy = dateCol;
      
      // TODO: Call httpService.getListItems
      // const items = await this.httpService.getListItems<IPunchData>(
      //   listName,
      //   selectFields,
      //   filterQuery,
      //   orderBy,
      //   ODataHelpers.DEFAULT_PAGE_SIZE
      // );
      
      // return items;
      
      // PLACEHOLDER: Return empty array until implemented
      console.log(`[AttendanceService] getPunchData for ${employeeId}, ${startDate} to ${endDate}`);
      return [];
      
    } catch (error) {
      console.error('[AttendanceService] Error getting punch data:', error);
      throw error;
    }
  }

  /**
   * Get punch data for a specific employee and month (threshold-safe)
   * @param employeeId Employee ID
   * @param year Year
   * @param month Month (1-12)
   */
  public async getPunchDataForMonth(employeeId: number, year: number, month: number): Promise<IPunchData[]> {
    try {
      // Calculate first and last day of month
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      
      return await this.getPunchData(employeeId, startDate, endDate);
      
    } catch (error) {
      console.error('[AttendanceService] Error getting punch data for month:', error);
      throw error;
    }
  }

  /**
   * Get leave data for a specific employee and date range
   * @param employeeId Employee ID
   * @param startDate Start date (ISO format)
   * @param endDate End date (ISO format)
   */
  public async getLeaveData(employeeId: string, startDate: string, endDate: string): Promise<ILeaveData[]> {
    try {
      // TODO: Implement REST call to LeaveData list
      const listName = getListInternalName('leaveData');
      
      const empIdCol = getColumnInternalName('LeaveData', 'EmployeeID');
      const startDateCol = getColumnInternalName('LeaveData', 'StartDate');
      const endDateCol = getColumnInternalName('LeaveData', 'EndDate');
      
      // Build filter for employee and overlapping date range
      // Leave overlaps if: LeaveStart <= EndDate AND LeaveEnd >= StartDate
      const filterQuery = `$filter=${empIdCol} eq '${employeeId}' and ${startDateCol} le '${endDate}' and ${endDateCol} ge '${startDate}'`;
      
      const selectFields = [
        'Id',
        empIdCol,
        getColumnInternalName('LeaveData', 'LeaveType'),
        startDateCol,
        endDateCol,
        getColumnInternalName('LeaveData', 'LeaveDuration'),
        getColumnInternalName('LeaveData', 'Status'),
        getColumnInternalName('LeaveData', 'ColorCode')
      ];
      
      const orderBy = startDateCol;
      
      // TODO: Call httpService.getListItems
      // const items = await this.httpService.getListItems<ILeaveData>(
      //   listName,
      //   selectFields,
      //   filterQuery,
      //   orderBy
      // );
      
      // // Filter to only approved leaves
      // return items.filter(leave => leave.Status === 'Approved');
      
      // PLACEHOLDER: Return empty array until implemented
      console.log(`[AttendanceService] getLeaveData for ${employeeId}, ${startDate} to ${endDate}`);
      return [];
      
    } catch (error) {
      console.error('[AttendanceService] Error getting leave data:', error);
      throw error;
    }
  }

  /**
   * Get leave data for a specific employee and month
   * @param employeeId Employee ID
   * @param year Year
   * @param month Month (1-12)
   */
  public async getLeaveDataForMonth(employeeId: string, year: number, month: number): Promise<ILeaveData[]> {
    try {
      // Calculate first and last day of month
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];
      
      return await this.getLeaveData(employeeId, startDate, endDate);
      
    } catch (error) {
      console.error('[AttendanceService] Error getting leave data for month:', error);
      throw error;
    }
  }

  /**
   * Build calendar data for a month
   * @param employeeId Employee ID
   * @param year Year
   * @param month Month (1-12)
   */
  public async buildCalendarForMonth(employeeId: string, year: number, month: number): Promise<ITimesheetDay[]> {
    try {
      // TODO: Implement calendar building logic
      // 1. Get punch data for month
      // 2. Get leave data for month
      // 3. Get timesheet data for month (from TimesheetService)
      // 4. Merge all data to build calendar days
      
      const punchData = await this.getPunchDataForMonth(employeeId, year, month);
      const leaveData = await this.getLeaveDataForMonth(employeeId, year, month);
      
      // Build calendar days
      const calendarDays: ITimesheetDay[] = [];
      const daysInMonth = new Date(year, month, 0).getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateString = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay();
        
        // Determine status
        let status: 'present' | 'absent' | 'holiday' | 'leave' | 'weekend' | 'empty' = 'present';
        let leaveType: 'sick' | 'casual' | 'earned' | undefined = undefined;
        
        // Check if weekend
        const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
        if (isWeekendDay) {
          status = 'weekend';
        }
        
        // Check if on leave
        const dayLeave = leaveData.find(leave => {
          const leaveStart = new Date(leave.StartDate);
          const leaveEnd = new Date(leave.EndDate);
          return date >= leaveStart && date <= leaveEnd;
        });
        
        const isLeaveDay = !!dayLeave;
        if (dayLeave) {
          status = 'leave';
          // Map leave type
          if (dayLeave.LeaveType.includes('Sick')) leaveType = 'sick';
          else if (dayLeave.LeaveType.includes('Casual')) leaveType = 'casual';
          else if (dayLeave.LeaveType.includes('Earned')) leaveType = 'earned';
        }
        
        // Check if holiday
        const isHolidayDay = false; // TODO: Add holiday logic
        if (isHolidayDay) {
          status = 'holiday';
        }
        
        // Find punch data for this day
        const dayPunch = punchData.find(punch => punch.AttendanceDate === dateString);
        
        // Check if today
        const today = new Date();
        const isToday = date.getDate() === today.getDate() && 
                       date.getMonth() === today.getMonth() && 
                       date.getFullYear() === today.getFullYear();
        
        // FIXED: Include all required properties from ITimesheetDay interface
        calendarDays.push({
          date: dateString,
          dayNumber: day,
          status: status,
          leaveType: leaveType,
          firstPunchIn: dayPunch?.FirstPunchIn,
          lastPunchOut: dayPunch?.LastPunchOut,
          totalHours: dayPunch?.TotalHours,
          availableHours: dayPunch?.TotalHours || 0,
          timesheetHours: 0, // TODO: Get from TimesheetService
          timesheetProgress: {
            percentage: 0,
            status: 'notFilled'
          },
          isToday: isToday,
          // ADDED: Required properties from ITimesheetDay interface
          isWeekend: isWeekendDay,
          isHoliday: isHolidayDay,
          isLeave: isLeaveDay,
          entries: [] // TODO: Load actual timesheet entries from TimesheetService
        });
      }
      
      return calendarDays;
      
    } catch (error) {
      console.error('[AttendanceService] Error building calendar:', error);
      throw error;
    }
  }

  /**
   * Get attendance statistics for an employee
   * @param employeeId Employee ID
   * @param startDate Start date (ISO format)
   * @param endDate End date (ISO format)
   */
  public async getAttendanceStatistics(
    employeeId: Number,
    startDate: string,
    endDate: string
  ): Promise<{ daysPresent: number; daysAbsent: number; totalHours: number }> {
    try {
      // TODO: Implement statistics calculation
      const punchData = await this.getPunchData(employeeId, startDate, endDate);
      
      const daysPresent = punchData.filter(punch => punch.Status === 'Synced').length;
      const daysAbsent = 0; // TODO: Calculate based on business days minus present days
      const totalHours = punchData.reduce((sum, punch) => sum + (punch.TotalHours || 0), 0);
      
      return {
        daysPresent,
        daysAbsent,
        totalHours
      };
      
    } catch (error) {
      console.error('[AttendanceService] Error getting attendance statistics:', error);
      throw error;
    }
  }
}