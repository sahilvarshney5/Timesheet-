// services/DashboardService.ts
// Service for dashboard statistics and summary data

import { SPHttpClient } from '@microsoft/sp-http';
import { AttendanceService } from './AttendanceService';
import { TimesheetService } from './TimesheetService';
import { ApprovalService } from './ApprovalService';
import { UserService } from './UserService';
import { LeaveService } from './LeaveService';

export interface IDashboardStats {
  daysPresent: number;
  hoursThisWeek: number;
  leaveDaysLeft: number;
  pendingApprovals: number;
  pendingTimesheetEntries: number;
  pendingRegularizations: number;
}

export class DashboardService {
  private attendanceService: AttendanceService;
  private timesheetService: TimesheetService;
  private approvalService: ApprovalService;
  private userService: UserService;
  private leaveService: LeaveService;

  constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    this.attendanceService = new AttendanceService(spHttpClient, siteUrl);
    this.timesheetService = new TimesheetService(spHttpClient, siteUrl);
    this.approvalService = new ApprovalService(spHttpClient, siteUrl);
    this.userService = new UserService(spHttpClient, siteUrl);
    this.leaveService = new LeaveService(spHttpClient, siteUrl);
  }

  /**
   * Get dashboard statistics for current user
   */
  public async getDashboardStats(): Promise<IDashboardStats> {
  try {
    const user = await this.userService.getCurrentUser();
    const permissions = await this.userService.getUserPermissions();
    const employeeId = user.Id.toString() || '';
    
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    // Get first day of current month
    const monthStart = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
    const monthEnd = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

    // Get current week start (Monday)
    const weekStart = this.getWeekStart(today).toISOString().split('T')[0];
    const weekEnd = this.getWeekEnd(today).toISOString().split('T')[0];

    // ✅ FIX: Get actual attendance data
    const attendanceStats = await this.attendanceService.getAttendanceStatistics(employeeId, monthStart, monthEnd);
    
    // ✅ FIX: Get actual timesheet hours for current week
    const weekPunchData = await this.attendanceService.getPunchData(employeeId, weekStart, weekEnd);
    
    // ✅ FIX: Calculate actual present days from punch data
    const daysPresent = weekPunchData.filter(punch => 
      punch.Status === 'Synced' || punch.FirstPunchIn
    ).length;
    
    // ✅ FIX: Calculate actual hours from timesheet
    const timesheetHeader = await this.timesheetService.getTimesheetHeader(employeeId, weekStart,weekEnd);
    let hoursThisWeek = 0;
    
    if (timesheetHeader) {
      const lines = await this.timesheetService.getTimesheetLines(timesheetHeader.Id!);
      hoursThisWeek = lines.reduce((sum, line) => sum + (line.HoursBooked || line.Hours || 0), 0);
    }
    
    // ✅ FIX: Get actual leave balance
    const leaveDaysLeft = await this.leaveService.getTotalLeaveDaysLeft(employeeId);
    
    // ✅ FIX: Get actual pending approvals
    const pendingApprovals = permissions.isManager 
      ? await this.approvalService.getPendingApprovals() 
      : [];
    
    // ✅ FIX: Get actual regularizations for current month
    const regularizations = await this.approvalService.getEmployeeRegularizations(employeeId);
    const thisMonthRegularizations = regularizations.filter(reg => {
      const submittedDate = new Date(reg.submittedOn);
      return submittedDate.getMonth() === (currentMonth - 1) && 
             submittedDate.getFullYear() === currentYear;
    });
    
    const pendingRegularizations = regularizations.filter(r => r.status === 'pending').length;

    // ✅ FIX: Calculate pending timesheet entries (days without full hours)
    let pendingTimesheetEntries = 0;
    for (const punch of weekPunchData) {
      const dayOfWeek = new Date(punch.AttendanceDate).getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends
      
      const dayLines = timesheetHeader ? 
        (await this.timesheetService.getTimesheetLines(timesheetHeader.Id!))
          .filter(line => line.WorkDate === punch.AttendanceDate || line.EntryDate === punch.AttendanceDate) 
        : [];
      
      const loggedHours = dayLines.reduce((sum, line) => sum + (line.HoursBooked || line.Hours || 0), 0);
      const availableHours = punch.TotalHours || 0;
      
      if (loggedHours < availableHours) {
        pendingTimesheetEntries++;
      }
    }

    return {
      daysPresent: daysPresent,
      hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
      leaveDaysLeft: leaveDaysLeft,
      pendingApprovals: pendingApprovals.length,
      pendingTimesheetEntries: pendingTimesheetEntries,
      pendingRegularizations: thisMonthRegularizations.length
    };

  } catch (error) {
    console.error('[DashboardService] Error getting dashboard stats:', error);
    
    return {
      daysPresent: 0,
      hoursThisWeek: 0,
      leaveDaysLeft: 0,
      pendingApprovals: 0,
      pendingTimesheetEntries: 0,
      pendingRegularizations: 0
    };
  }
}

  /**
   * Get start of week (Monday)
   */
  private getWeekStart(date: Date): Date {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    return new Date(date.setDate(diff));
  }

  /**
   * Get end of week (Sunday)
   */
  private getWeekEnd(date: Date): Date {
    const weekStart = this.getWeekStart(new Date(date));
    return new Date(weekStart.setDate(weekStart.getDate() + 6));
  }

  /**
   * Get all days in current week
   */
  private getWeekDays(date: Date): Date[] {
    const weekStart = this.getWeekStart(new Date(date));
    const days: Date[] = [];
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    
    return days;
  }
}