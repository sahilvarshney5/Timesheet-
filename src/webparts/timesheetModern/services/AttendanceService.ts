// services/AttendanceService.ts
// Service for attendance-related SharePoint operations
// Handles PunchData and LeaveData lists

import { SPHttpClient } from '@microsoft/sp-http';
import { HttpClientService } from './HttpClientService';
import { SharePointConfig, getListInternalName, getColumnInternalName, ODataHelpers } from '../config/SharePointConfig';
import { IPunchData, ILeaveData, ICalendarDay, ITimesheetDay, ITimesheetLines } from '../models';
import { isWeekendDay as configIsWeekend } from '../config/WorkWeekConfig';
// ✅ FIXED: Import required date utilities
import { 
  normalizeDateToString, 
  formatDateForDisplay, 
  isToday as checkIsToday,
  createLocalDate,
  getTodayLocal,
  isSameDay,
  convertSharePointDate 
} from '../utils/DateUtils';
import { getTimesheetFillStatus } from '../utils/TimesheetStatusUtils';

export class AttendanceService {
  private httpService: HttpClientService;

  constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    this.httpService = new HttpClientService(spHttpClient, siteUrl);
  }

  // ============================================================================
// INTEGRATION EXAMPLE IN AttendanceService
// Location: src/webparts/timesheetModern/services/AttendanceService.ts
// ============================================================================

// Add method to AttendanceService class

/**
 * Build calendar with timesheet fill status
 */
public async buildCalendarWithTimesheetStatus(
  employeeId: string, 
  year: number, 
  month: number,
  timesheetLines: ITimesheetLines[]
): Promise<ITimesheetDay[]> {
  
  const calendar = await this.buildCalendarForMonth(employeeId, year, month);
  
  // Enhance each day with timesheet fill status
  return calendar.map(day => {
    const fillStatus = getTimesheetFillStatus(
      day.date,
      timesheetLines,
      day.availableHours || 8
    );
    
    return {
      ...day,
      timesheetHours: fillStatus.totalFilledHours,
      timesheetProgress: {
        percentage: fillStatus.percentage,
        status: fillStatus.status === 'FULL' ? 'completed' 
              : fillStatus.status === 'PARTIAL' ? 'partial' 
              : 'notFilled'
      }
    };
  });
}
  /**
 * Determine attendance status for a given date
 * @param punchData Punch record for the date (or null)
 * @param leaveData Leave record for the date (or null)
 * @param isWeekend Whether date is weekend
 * @param isHoliday Whether date is holiday
 * @param isFuture Whether date is in future
 * @returns Attendance status
 */
public getAttendanceStatus(
  punchData: IPunchData | null,
  leaveData: ILeaveData | null,
  isWeekend: boolean,
  isHoliday: boolean,
  isFuture: boolean
): 'present' | 'absent' | 'leave' | 'holiday' | 'weekend' | 'future' | null {
  
  // Rule 1: Future dates
  if (isFuture) {
    return 'future';
  }
  
  // Rule 2: Weekends
  if (isWeekend) {
    return 'weekend';
  }
  
  // Rule 3: Holidays
  if (isHoliday) {
    return 'holiday';
  }
  
  // Rule 4: Leave (any non-rejected status - Approved, Availed, etc.)
  if (leaveData && leaveData.Status !== 'Rejected' && leaveData.Status !== 'Pending') {
    return 'leave';
  }
  
  // Rule 5: Present (ONLY if punch data exists)
  if (punchData && (punchData.PunchIn || punchData.Status === 'Synced')) {
    return 'present';
  }
  
  // Rule 6: Absent (past working day with no punch)
  // Only mark absent if it's a past working day
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const checkDate = new Date(punchData?.AttendanceDate || '');
  checkDate.setHours(0, 0, 0, 0);
  
  if (checkDate < today) {
    return 'absent';
  }
  
  // Rule 7: Default (no data, not future)
  return null;
}
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
   */
  private mapToPunchData(spItem: any): IPunchData {
    const rawDate = spItem.PunchDate || spItem.AttendanceDate;
    const normalizedDate = this.normalizeToDateString(rawDate);
    
    return {
      Id: spItem.Id || spItem.ID,
      EmployeeId: 0,
      AttendanceDate: normalizedDate,
      PunchIn: spItem.PunchIn,
      PunchOut: spItem.PunchOut,
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
   */
  public async getPunchData(employeeId: string, startDate: string, endDate: string): Promise<IPunchData[]> {
    try {
      const listName = getListInternalName('punchData');
      
      const empIdCol = getColumnInternalName('PunchData', 'EmployeeID');
      const dateCol = getColumnInternalName('PunchData', 'AttendanceDate'); // PunchDate internal name
      
      const filterQuery = `$filter=${empIdCol} eq '${employeeId}' and ${dateCol} ge '${startDate}' and ${dateCol} le '${endDate}'`;
      
      const selectFields = [
        'Id',
        'ID',
        empIdCol,
        dateCol,
        getColumnInternalName('PunchData', 'PunchIn'),
        getColumnInternalName('PunchData', 'PunchOut'),
        getColumnInternalName('PunchData', 'TotalHours'),
        getColumnInternalName('PunchData', 'Status'),
        getColumnInternalName('PunchData', 'Source'),
        'Created',
        'Modified'
      ];
      
      const orderBy = dateCol;
      
      const rawItems = await this.httpService.getListItems<IPunchData>(
        listName,
        selectFields,
        filterQuery,
        orderBy,
        ODataHelpers.DEFAULT_PAGE_SIZE
      );
      
      const items = rawItems.map(item => this.mapToPunchData(item));
      console.log(`[AttendanceService] Loaded ${items.length} punch records for ${employeeId}`);
      
      return items;
      
    } catch (error) {
      console.error('[AttendanceService] Error getting punch data:', error);
      throw error;
    }
  }
 /**
   * Get punch data for a specific employee and date range
   */
  public async getPunchDatabyregularization(employeeId: string, startDate: string, endDate: string): Promise<IPunchData[]> {
    try {
      const listName = getListInternalName('punchData');
      
      const empIdCol = getColumnInternalName('PunchData', 'EmployeeID');
      const dateCol = getColumnInternalName('PunchData', 'AttendanceDate'); // PunchDate internal name
      
      const filterQuery = `$filter=${empIdCol} eq '${employeeId}' and ${dateCol} ge '${startDate}T00:00:00' and ${dateCol} le '${endDate}T23:59:59'`;
      
      const selectFields = [
        'Id',
        'ID',
        empIdCol,
        dateCol,
        getColumnInternalName('PunchData', 'PunchIn'),
        getColumnInternalName('PunchData', 'PunchOut'),
        getColumnInternalName('PunchData', 'TotalHours'),
        getColumnInternalName('PunchData', 'Status'),
        getColumnInternalName('PunchData', 'Source'),
        'Created',
        'Modified'
      ];
      
      const orderBy = dateCol;
      
      const rawItems = await this.httpService.getListItems<IPunchData>(
        listName,
        selectFields,
        filterQuery,
        orderBy,
        ODataHelpers.DEFAULT_PAGE_SIZE
      );
      
      const items = rawItems.map(item => this.mapToPunchData(item));
      console.log(`[AttendanceService] Loaded ${items.length} punch records for ${employeeId}`);
      
      return items;
      
    } catch (error) {
      console.error('[AttendanceService] Error getting punch data:', error);
      throw error;
    }
  }
  /**
   * Get punch data for a specific employee and month
   */
  public async getPunchDataForMonth(employeeId: string, year: number, month: number): Promise<IPunchData[]> {
    try {
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
   */
  public async getLeaveData(employeeId: string, startDate: string, endDate: string): Promise<ILeaveData[]> {
    try {
      const listName = getListInternalName('leaveData');
      
      const empIdCol = getColumnInternalName('LeaveData', 'EmployeeID');
      const startDateCol = getColumnInternalName('LeaveData', 'StartDate');
      const endDateCol = getColumnInternalName('LeaveData', 'EndDate');
      const statusCol = getColumnInternalName('LeaveData', 'Status');

      // Fetch all leave records for the date range (no status filter in OData)
      // We filter client-side to accept 'Approved', 'Availed', and any non-Rejected status
      // because HRMS sync may use different status values (e.g. 'Availed', 'Approved by HR')
      const filterQuery = `$filter=${empIdCol} eq '${employeeId}' and ${startDateCol} le '${endDate}' and ${endDateCol} ge '${startDate}' and ${statusCol} ne 'Rejected'`;
      
      const selectFields = [
        'Id',
        empIdCol,
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
   */
  public async getLeaveDataForMonth(employeeId: string, year: number, month: number): Promise<ILeaveData[]> {
    try {
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
   * ✅ FIXED: Corrected variable names and date handling
   */
  public async buildCalendarForMonth(employeeId: string, year: number, month: number): Promise<ITimesheetDay[]> {
    try {
      const punchData = await this.getPunchDataForMonth(employeeId, year, month);
      const leaveData = await this.getLeaveDataForMonth(employeeId, year, month);
      console.log(`[AttendanceService] Building calendar - Punch: ${punchData.length}, Leave: ${leaveData.length}`);

      const calendarDays: ITimesheetDay[] = [];
      const daysInMonth = new Date(year, month, 0).getDate();
      
      // ✅ FIXED: Use proper loop with year/month variables from function parameters
      for (let day = 1; day <= daysInMonth; day++) {
        // ✅ FIXED: Use year and month parameters, not undefined variables
        const date = createLocalDate(year, month - 1, day); // month-1 because createLocalDate expects 0-based month
        const dateString = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay();
        
        // ✅ FIXED: Use imported isSameDay and getTodayLocal
        const todayLocal = getTodayLocal();
        const isTodayCheck = isSameDay(date, todayLocal);
        
        // Determine status
        let status: 'present' | 'absent' | 'holiday' | 'leave' | 'weekend' | 'empty' = 'absent';
        let leaveType: 'sick' | 'casual' | 'earned' | undefined = undefined;
        
        // Check if weekend using imported config function
        const isWeekendDay = configIsWeekend(date);
        if (isWeekendDay) {
          status = 'weekend';
        }
        
        // Holiday check (TODO: Implement holiday list)
        const isHolidayDay = false;
        if (isHolidayDay) {
          status = 'holiday';
        }
        
        // Check if on leave — compare YYYY-MM-DD strings to avoid timezone/mutation bugs
        const dayLeave = leaveData.find(leave => {
          // Extract date-only part from ISO strings (handles both "2026-02-10" and "2026-02-10T08:00:00Z")
          const leaveStartStr = leave.StartDate ? leave.StartDate.split('T')[0] : '';
          const leaveEndStr = leave.EndDate ? leave.EndDate.split('T')[0] : '';
          return dateString >= leaveStartStr && dateString <= leaveEndStr;
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
        
        // Find punch data using PunchDate for reliable date matching
        const dayPunch = punchData.find(punch => {
          const punchDateStr = punch.PunchDate
            ? normalizeDateToString(punch.PunchDate)
            : punch.AttendanceDate;
          return punchDateStr === dateString;
        });
        if (dayPunch && !isWeekendDay && !isHolidayDay && !dayLeave) {
          status = 'present';
        }
        
        calendarDays.push({
          Id:dayPunch?.Id || 0,
          date: dateString,
          dayNumber: day,
          status: status,
          leaveType: leaveType,
          firstPunchIn: dayPunch?.PunchIn,
          lastPunchOut: dayPunch?.PunchOut,
          totalHours: dayPunch?.TotalHours,
          availableHours: dayPunch?.TotalHours || 0,
          timesheetHours: 0,
          timesheetProgress: {
            percentage: 0,
            status: 'notFilled'
          },
          isToday: isTodayCheck,
          isWeekend: isWeekendDay,
          isHoliday: isHolidayDay,
          isLeave: isLeaveDay,
          entries: []
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
   */
  public async getAttendanceStatistics(
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<{ daysPresent: number; daysAbsent: number; totalHours: number }> {
    try {
      const punchData = await this.getPunchData(employeeId, startDate, endDate);
      
      const daysPresent = punchData.filter(punch => punch.Status === 'Synced').length;
      const daysAbsent = 0;
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
   */
  public async downloadAttendanceReport(
    employeeId: string,
    year: number,
    month: number
  ): Promise<void> {
    try {
      const [punchData, leaveData] = await Promise.all([
        this.getPunchDataForMonth(employeeId, year, month),
        this.getLeaveDataForMonth(employeeId, year, month)
      ]);

      const calendarDays = await this.buildCalendarForMonth(employeeId, year, month);

      const csvRows: string[] = [];
      csvRows.push('Date,Day,Status,First Punch In,Last Punch Out,Total Hours,Timesheet Hours,Leave Type');

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
  // ============================================================================
// ATTENDANCESERVICE PATCH
// Add this method INSIDE the AttendanceService class in AttendanceService.ts
// Placement: after the existing getPunchDataForMonth() method (~line 233)
// ============================================================================

/**
 * Get the punch record for a specific employee on a single date.
 *
 * Used exclusively by RegularizationView to enforce the business rule:
 *   "Regularization timings MUST come from Punch Data, never from user input."
 *
 * @param employeeId  Employee ID string (e.g. "R0398")
 * @param date        Date string in YYYY-MM-DD format
 * @returns           The matching IPunchData record, or null if none found
 *
 * Architecture note:
 *   This is a thin convenience wrapper around getPunchData().
 *   It passes the same date for both startDate and endDate to constrain
 *   the SharePoint OData query to a single day, then returns the first
 *   (and ordinarily only) matching record.
 *   No new SharePoint list queries, no new columns, no schema impact.
 */
public async getPunchByDate(
  employeeId: string,
  date: string
): Promise<IPunchData | null> {
  try {
    const records: IPunchData[] = await this.getPunchData(
      employeeId,
      date,   // startDate = selected date
      date    // endDate   = same date → single-day filter
    );

    if (records.length === 0) {
      console.warn(
        `[AttendanceService] No punch record found for employee ${employeeId} on ${date}`
      );
      return null;
    }

    const record = records[0];
    console.log(
      `[AttendanceService] Punch found for ${employeeId} on ${date}: ` +
      `in=${record.PunchIn ?? 'N/A'}, out=${record.PunchOut ?? 'N/A'}`
    );

    return record;
  } catch (error) {
    console.error(
      `[AttendanceService] Error in getPunchByDate for ${employeeId} on ${date}:`,
      error
    );
    // Re-throw so RegularizationView can handle it explicitly
    throw error;
  }
}
}