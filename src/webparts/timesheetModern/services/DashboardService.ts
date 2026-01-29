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
      
      // Get current date ranges
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;

      // Get first day of current month
      const monthStart = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
      const monthEnd = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

      // Get current week start (Monday)
      const weekStart = this.getWeekStart(today).toISOString().split('T')[0];
      const weekEnd = this.getWeekEnd(today).toISOString().split('T')[0];

      // Fetch all stats in parallel
      const [
        attendanceStats,
        leaveDaysLeft,
        pendingApprovals,
        regularizations
      ] = await Promise.all([
        this.attendanceService.getAttendanceStatistics(employeeId, monthStart, monthEnd),
        this.leaveService.getTotalLeaveDaysLeft(employeeId), // FIXED: Use LeaveService
        permissions.isManager ? this.approvalService.getPendingApprovals() : Promise.resolve([]),
        this.approvalService.getEmployeeRegularizations(employeeId)
      ]);

      // Calculate hours this week
      const weekPunchData = await this.attendanceService.getPunchData(employeeId, weekStart, weekEnd);
      const hoursThisWeek = weekPunchData.reduce((sum, punch) => sum + (punch.TotalHours || 0), 0);

      // Count pending regularizations
      const pendingRegularizations = regularizations.filter(r => r.status === 'pending').length;

      // Count pending timesheet entries (days without timesheet in current week)
      const weekDays = this.getWeekDays(today);
      const pendingTimesheetEntries = 0;
      
      for (const day of weekDays) {
        const dayString = day.toISOString().split('T')[0];
        const dayOfWeek = day.getDay();
        
        // Skip weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;
        
        // Check if day has timesheet entries
        // TODO: Implement actual check from TimesheetService
        // For now, count days without entries
      }

      return {
        daysPresent: attendanceStats.daysPresent,
        hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
        leaveDaysLeft: leaveDaysLeft, // FIXED: Use actual leave balance
        pendingApprovals: pendingApprovals.length,
        pendingTimesheetEntries: pendingTimesheetEntries,
        pendingRegularizations: pendingRegularizations
      };

    } catch (error) {
      console.error('[DashboardService] Error getting dashboard stats:', error);
      
      // Return default stats on error
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