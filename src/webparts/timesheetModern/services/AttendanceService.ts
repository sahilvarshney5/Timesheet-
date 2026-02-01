// services/AttendanceService.ts
// Service for attendance-related SharePoint operations
// Handles PunchData and LeaveData lists

import { SPHttpClient } from '@microsoft/sp-http';
import { HttpClientService } from './HttpClientService';
import { SharePointConfig, getListInternalName, getColumnInternalName, ODataHelpers } from '../config/SharePointConfig';
import { IPunchData, ILeaveData, ICalendarDay, ITimesheetDay } from '../models';
import { isWeekendDay as configIsWeekend } from '../config/WorkWeekConfig';
// Should already have this (verify):
import { normalizeDateToString, formatDateForDisplay, isToday as checkIsToday ,createLocalDate,getTodayLocal,isSameDay,convertSharePointDate } from '../utils/DateUtils';
export class AttendanceService {
  private httpService: HttpClientService;

  constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    this.httpService = new HttpClientService(spHttpClient, siteUrl);
  }
  // services/AttendanceService.ts

// services/AttendanceService.ts

/**
 * Normalize ISO date to YYYY-MM-DD format (ES5-compatible, timezone-safe)
 */
private normalizeToDateString(isoDateString: string): string {
  if (!isoDateString) return '';
  
  try {
    const date = new Date(isoDateString);
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // ES5-compatible padding
    const monthStr = month < 10 ? '0' + month : '' + month;
    const dayStr = day < 10 ? '0' + day : '' + day;
    
    return `${year}-${monthStr}-${dayStr}`;
  } catch (error) {
    console.error('[AttendanceService] Error normalizing date:', isoDateString, error);
    return '';
  }
}

/**
 * Map SharePoint response to IPunchData canonical format
 * CRITICAL: SharePoint returns PunchDate, we need AttendanceDate
 */
private mapToPunchData(spItem: any): IPunchData {
  // FIXED: Normalize date to YYYY-MM-DD format
  const rawDate = spItem.PunchDate || spItem.AttendanceDate;
  const normalizedDate = this.normalizeToDateString(rawDate);
  
  return {
    Id: spItem.Id || spItem.ID,
    EmployeeId: 0,
    AttendanceDate: normalizedDate, // ✅ NOW IN YYYY-MM-DD FORMAT
    FirstPunchIn: spItem.FirstPunchIn,
    LastPunchOut: spItem.LastPunchOut,
    TotalHours: spItem.TotalHours,
    Status: spItem.Status,
    Source: spItem.Source,
    Created: spItem.Created,
    Modified: spItem.Modified,
    PunchDate: spItem.PunchDate,
    Title: spItem.Title
  };
}
  /**
   * Get punch data for a specific employee and date range
   * @param employeeId Employee ID
   * @param startDate Start date (ISO format)
   * @param endDate End date (ISO format)
   */
  public async getPunchData(employeeId: string, startDate: string, endDate: string): Promise<IPunchData[]> {
    try {
      const listName = getListInternalName('punchData');
      
      const empIdCol = getColumnInternalName('PunchData', 'EmployeeID');
      const dateCol = getColumnInternalName('PunchData', 'AttendanceDate');
      
      // Build filter for employee and date range
      const filterQuery = `$filter=${empIdCol} eq '${employeeId}' and ${dateCol} ge '${startDate}' and ${dateCol} le '${endDate}'`;
      
      const selectFields = [
        'Id',
        'ID', // Sometimes SharePoint returns ID instead of Id
        empIdCol,
        dateCol,
        getColumnInternalName('PunchData', 'FirstPunchIn'),
        getColumnInternalName('PunchData', 'LastPunchOut'),
        getColumnInternalName('PunchData', 'TotalHours'),
        getColumnInternalName('PunchData', 'Status'),
        getColumnInternalName('PunchData', 'Source'),
        'Created',
        'Modified'
      ];
      
      const orderBy = dateCol;
      
      // Call httpService.getListItems
      const rawItems = await this.httpService.getListItems<IPunchData>(
        listName,
        selectFields,
        filterQuery,
        orderBy,
        ODataHelpers.DEFAULT_PAGE_SIZE
      );
      
      const items = rawItems.map(item => this.mapToPunchData(item));
      console.log(`[AttendanceService] Loaded ${items.length} punch records for ${employeeId}`);
      
      // ✅ FIXED: Added explicit return statement
      return items;
      
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
  public async getPunchDataForMonth(employeeId: string, year: number, month: number): Promise<IPunchData[]> {
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
      const listName = getListInternalName('leaveData');
      
      const empIdCol = getColumnInternalName('LeaveData', 'EmployeeID');
      const startDateCol = getColumnInternalName('LeaveData', 'StartDate');
      const endDateCol = getColumnInternalName('LeaveData', 'EndDate');
      const statusCol = getColumnInternalName('LeaveData', 'Status');

      // Build filter for employee and overlapping date range
      // Leave overlaps if: LeaveStart <= EndDate AND LeaveEnd >= StartDate
      const filterQuery = `$filter=${empIdCol} eq '${employeeId}' and ${startDateCol} le '${endDate}' and ${endDateCol} ge '${startDate}' and ${statusCol} eq 'Approved'`;
      
      const selectFields = [
        'Id',
        empIdCol,  // Title (Employee ID)
        getColumnInternalName('LeaveData', 'LeaveType'),
        startDateCol,
        endDateCol,
        getColumnInternalName('LeaveData', 'TotalDays'),
        getColumnInternalName('LeaveData', 'LeaveDuration'),
        statusCol,
        getColumnInternalName('LeaveData', 'HRMSLeaveID'),
        getColumnInternalName('LeaveData', 'AppliedDate'),
        getColumnInternalName('LeaveData', 'ApprovedDate'),
        getColumnInternalName('LeaveData', 'Reason'),
        getColumnInternalName('LeaveData', 'ColorCode'),
        'Employee/Id',
        'Employee/Title',
        'Employee/EMail',
        'ApprovedBy/Id',
        'ApprovedBy/Title',
        'ApprovedBy/EMail'
      ];
      const expandFields = ['Employee', 'ApprovedBy'];

      const orderBy = startDateCol;
      
      const items = await this.httpService.getListItems<ILeaveData>(
        listName,
        selectFields,
        filterQuery,
        orderBy,
        1000,
        expandFields
      );
      console.log(`[AttendanceService] Loaded ${items.length} approved leaves for ${employeeId}`);

      return items;
      
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
      const punchData = await this.getPunchDataForMonth(employeeId, year, month);
      const leaveData = await this.getLeaveDataForMonth(employeeId, year, month);
      console.log(`[AttendanceService] Building calendar - Punch: ${punchData.length}, Leave: ${leaveData.length}`);

      // Build calendar days
      const calendarDays: ITimesheetDay[] = [];
      const daysInMonth = new Date(year, month, 0).getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
  const date = createLocalDate(currentYear, currentMonth, day); // ✅ Use utility
        const dateString = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay();
  const dayNumber = new Date(day.date).getDate();

          const isTodayCheck = isTodayDate(date);

        
        // Determine status
        let status: 'present' | 'absent' | 'holiday' | 'leave' | 'weekend' | 'empty' = 'absent';
        let leaveType: 'sick' | 'casual' | 'earned' | undefined = undefined;
        
        // Check if weekend
const isWeekendDay = configIsWeekend(date); // ✅ Use imported function
        if (isWeekendDay) {
          status = 'weekend';
        }
        
        // Holiday (override weekend if it's a holiday)
        const isHolidayDay = false; // TODO: Implement holiday check
        if (isHolidayDay) {
          status = 'holiday';
        }
        
        // Check if on leave
        const dayLeave = leaveData.find(leave => {
          const leaveStart = new Date(leave.StartDate);
          const leaveEnd = new Date(leave.EndDate);
          leaveStart.setHours(0, 0, 0, 0);
          leaveEnd.setHours(23, 59, 59, 999);
          date.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues

          return date >= leaveStart && date <= leaveEnd;
        });

        const isLeaveDay = !!dayLeave;
        if (dayLeave) {
          status = 'leave';
          // Map leave type
          if (dayLeave.LeaveType.includes('Medical')) leaveType = 'sick';
          else if (dayLeave.LeaveType.includes('Casual')) leaveType = 'casual';
          else if (dayLeave.LeaveType.includes('Maternity')) leaveType = 'casual';
          else if (dayLeave.LeaveType.includes('Paternity')) leaveType = 'casual';
          else if (dayLeave.LeaveType.includes('Annual')) leaveType = 'casual';
          else if (dayLeave.LeaveType.includes('Comp Off')) leaveType = 'casual';
        }
        
        // Find punch data using AttendanceDate
        const dayPunch = punchData.find(punch => punch.AttendanceDate === dateString);
        if (dayPunch && !isWeekendDay && !isHolidayDay && !dayLeave) {
          status = 'present';
        }
        
        // Check if today
        const today = new Date();
        const isToday = date.getDate() === today.getDate() && 
                       date.getMonth() === today.getMonth() && 
                       date.getFullYear() === today.getFullYear();
        
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
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<{ daysPresent: number; daysAbsent: number; totalHours: number }> {
    try {
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

  /**
   * Generate attendance report CSV for download
   * @param employeeId Employee ID
   * @param year Year
   * @param month Month (1-12)
   */
  public async downloadAttendanceReport(
    employeeId: string,
    year: number,
    month: number
  ): Promise<void> {
    try {
      // Get punch data and leave data for month
      const [punchData, leaveData] = await Promise.all([
        this.getPunchDataForMonth(employeeId, year, month),
        this.getLeaveDataForMonth(employeeId, year, month)
      ]);

      // Build calendar for the month
      const calendarDays = await this.buildCalendarForMonth(employeeId, year, month);

      // Generate CSV content
      const csvRows: string[] = [];
      
      // Header
      csvRows.push('Date,Day,Status,First Punch In,Last Punch Out,Total Hours,Timesheet Hours,Leave Type');

      // Data rows
      calendarDays.forEach(day => {
        const date = new Date(day.date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateStr = date.toLocaleDateString('en-US');
        
        const status = this.getStatusText(day.status || '');
        const firstPunchIn = day.firstPunchIn ? this.formatTimeForCsv(day.firstPunchIn) : '';
        const lastPunchOut = day.lastPunchOut ? this.formatTimeForCsv(day.lastPunchOut) : '';
        const totalHours = day.totalHours ? day.totalHours.toFixed(2) : '0.00';
        const timesheetHours = day.timesheetHours ? day.timesheetHours.toFixed(2) : '0.00';
        const leaveType = day.leaveType || '';

        csvRows.push(`${dateStr},${dayName},${status},${firstPunchIn},${lastPunchOut},${totalHours},${timesheetHours},${leaveType}`);
      });

      // Create CSV file and download
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Attendance_Report_${employeeId}_${year}_${month}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log(`[AttendanceService] Downloaded attendance report for ${employeeId}, ${month}/${year}`);

    } catch (error) {
      console.error('[AttendanceService] Error downloading attendance report:', error);
      throw error;
    }
  }

  private getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'present': 'Present',
      'absent': 'Absent',
      'holiday': 'Holiday',
      'leave': 'On Leave',
      'weekend': 'Weekend',
      'empty': ''
    };
    return statusMap[status] || status;
  }

  private formatTimeForCsv(timeString: string): string {
    if (!timeString) return '';
    
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch {
      return timeString;
    }
  }
}