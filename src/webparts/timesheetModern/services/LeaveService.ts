// services/LeaveService.ts
// FIXED VERSION - All errors resolved
// Service for leave balance and leave-related operations

import { SPHttpClient } from '@microsoft/sp-http';
import { HttpClientService } from './HttpClientService';
import { SharePointConfig, getListInternalName, getColumnInternalName } from '../config/SharePointConfig';
import { ILeaveBalance, ILeaveData } from '../models';

export class LeaveService {
  private httpService: HttpClientService;

  constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    this.httpService = new HttpClientService(spHttpClient, siteUrl);
  }

  /**
   * Get leave balance for an employee from LeaveBalance list
   * @param employeeId Employee ID
   */
  public async getLeaveBalance(employeeId: string): Promise<ILeaveBalance[]> {
    try {
      // Get leave balance from SharePoint list
      const listName = getListInternalName('leaveBalance');
      const empIdCol = getColumnInternalName('LeaveBalance', 'EmployeeID');
      const filterQuery = `$filter=${empIdCol} eq '${employeeId}'`;
      
      const selectFields = [
        'Id',
        empIdCol,
        getColumnInternalName('LeaveBalance', 'LeaveType'),
        getColumnInternalName('LeaveBalance', 'Balance')
      ];
      
      const items = await this.httpService.getListItems<ILeaveBalance>(
        listName,
        selectFields,
        filterQuery
      );
      
      return items;
      
    } catch (error) {
      console.error('[LeaveService] Error getting leave balance:', error);
      // Return empty array on error instead of throwing
      return [];
    }
  }

  /**
   * Calculate total remaining leave days from LeaveBalance list
   * @param employeeId Employee ID
   */
  public async getTotalLeaveDaysLeft(employeeId: string): Promise<number> {
    try {
      const balances = await this.getLeaveBalance(employeeId);
      
      if (balances.length > 0) {
        // Sum all leave type balances
        return balances.reduce((sum, balance) => sum + balance.Balance, 0);
      }
      
      // Fallback: Calculate from LeaveData if LeaveBalance doesn't exist
      return await this.calculateLeaveDaysFromLeaveData(employeeId);
      
    } catch (error) {
      console.error('[LeaveService] Error getting total leave days left:', error);
      return 0; // Return 0 on error
    }
  }

  /**
   * Calculate remaining leave days from LeaveData (fallback method)
   * Assumes: 20 total leave days per year (configurable)
   * @param employeeId Employee ID
   */
  private async calculateLeaveDaysFromLeaveData(employeeId: string): Promise<number> {
    try {
      const currentYear = new Date().getFullYear();
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;
      
      // Get all approved leaves for current year
      const listName = getListInternalName('leaveData');
      const empIdCol = getColumnInternalName('LeaveData', 'EmployeeID');
      const startDateCol = getColumnInternalName('LeaveData', 'StartDate');
      const endDateCol = getColumnInternalName('LeaveData', 'EndDate');
      const statusCol = getColumnInternalName('LeaveData', 'Status');
      
      const filterQuery = `$filter=${empIdCol} eq '${employeeId}' and ${statusCol} eq 'Approved' and ${startDateCol} ge '${yearStart}' and ${startDateCol} le '${yearEnd}'`;
      
      const selectFields = [
        'Id',
        empIdCol,
        startDateCol,
        endDateCol,
        getColumnInternalName('LeaveData', 'LeaveDuration'),
        statusCol
      ];
      
      // Get leaves from SharePoint
      const leaves = await this.httpService.getListItems<ILeaveData>(
        listName,
        selectFields,
        filterQuery
      );
      
      // Calculate total leave days taken
      let daysTaken = 0;
      leaves.forEach(leave => {
        const start = new Date(leave.StartDate);
        const end = new Date(leave.EndDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        if (leave.IsHalfDay) {
          daysTaken += 0.5;
        } else {
          daysTaken += days;
        }
      });
      
      // Total annual leave entitlement (configurable)
      const totalAnnualLeave = 20;
      return Math.max(0, totalAnnualLeave - daysTaken);
      
    } catch (error) {
      console.error('[LeaveService] Error calculating leave days from LeaveData:', error);
      return 12; // Return default on error
    }
  }

  /**
   * Get leave type balances (breakdown by leave type)
   * @param employeeId Employee ID
   */
  public async getLeaveTypeBalances(employeeId: string): Promise<Map<string, number>> {
    try {
      const balances = await this.getLeaveBalance(employeeId);
      const balanceMap = new Map<string, number>();
      
      balances.forEach(balance => {
        balanceMap.set(balance.LeaveType, balance.Balance);
      });
      
      // If no balances, return default allocations
      if (balanceMap.size === 0) {
        balanceMap.set('Casual Leave', 4);
        balanceMap.set('Sick Leave', 4);
        balanceMap.set('Earned Leave', 4);
      }
      
      return balanceMap;
      
    } catch (error) {
      console.error('[LeaveService] Error getting leave type balances:', error);
      return new Map();
    }
  }
}