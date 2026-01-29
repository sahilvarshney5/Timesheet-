// services/EmployeeService.ts
// Service for Employee Master operations
// Handles mapping between SharePoint User and Employee ID (e.g., R0398)

import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { HttpClientService } from './HttpClientService';
import { SharePointConfig, getListInternalName, getColumnInternalName } from '../config/SharePointConfig';
import { IEmployeeMaster } from '../models/IEmployeeMaster';

export class EmployeeService {
  private httpService: HttpClientService;
  private spHttpClient: SPHttpClient;
  private siteUrl: string;
  private employeeCache: Map<number, IEmployeeMaster>;

  constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    this.httpService = new HttpClientService(spHttpClient, siteUrl);
    this.spHttpClient = spHttpClient;
    this.siteUrl = siteUrl;
    this.employeeCache = new Map();
  }

  /**
   * Get current employee master record by SharePoint user
   * This is the PRIMARY method to call on app load
   */
  public async getCurrentEmployeeMaster(): Promise<IEmployeeMaster | null> {
    try {
      // Get current SharePoint user
      const currentUserEndpoint = `${this.siteUrl}/_api/web/currentuser`;
      
      const userResponse: SPHttpClientResponse = await this.spHttpClient.get(
        currentUserEndpoint,
        SPHttpClient.configurations.v1
      );
      
      if (!userResponse.ok) {
        throw new Error(`Failed to get current user: ${userResponse.statusText}`);
      }
      
      const currentUser = await userResponse.json();
      const currentUserId = currentUser.Id;
      const currentUserEmail = currentUser.Email;
      
      console.log(`[EmployeeService] Current User - ID: ${currentUserId}, Email: ${currentUserEmail}`);
      
      // Check cache first
      if (this.employeeCache.has(currentUserId)) {
        console.log(`[EmployeeService] Returning cached employee master for user ${currentUserId}`);
        return this.employeeCache.get(currentUserId)!;
      }
      
      // Fetch from Employee Master list
      const listName = getListInternalName('employeeMaster');
      const employeeCol = getColumnInternalName('EmployeeMaster', 'Employee');
      const employeeIDCol = getColumnInternalName('EmployeeMaster', 'EmployeeID');
      const emailCol = getColumnInternalName('EmployeeMaster', 'Email');
      const deptCol = getColumnInternalName('EmployeeMaster', 'Department');
      const managerCol = getColumnInternalName('EmployeeMaster', 'Manager');
      const activeCol = getColumnInternalName('EmployeeMaster', 'Active');
      
      // Query by Employee/Id (Person or Group field)
      const filterQuery = `$filter=${employeeCol}/Id eq ${currentUserId}`;
      
      const selectFields = [
        'Id',
        employeeIDCol,
        emailCol,
        deptCol,
        activeCol,
        `${employeeCol}/Id`,
        `${employeeCol}/Title`,
        `${employeeCol}/EMail`,
        `${managerCol}/Id`,
        `${managerCol}/Title`,
        `${managerCol}/EMail`
      ];
      
      const expandFields = [employeeCol, managerCol];
      
      const endpoint = `${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/items?${filterQuery}&$select=${selectFields.join(',')}&$expand=${expandFields.join(',')}`;
      
      console.log(`[EmployeeService] Fetching employee master from: ${endpoint}`);
      
      const response: SPHttpClientResponse = await this.spHttpClient.get(
        endpoint,
        SPHttpClient.configurations.v1
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch employee master: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.value || data.value.length === 0) {
        console.warn(`[EmployeeService] No employee master record found for user ${currentUserId}`);
        return null;
      }
      
      const item = data.value[0];
      
      // Map to IEmployeeMaster
      const employeeMaster: IEmployeeMaster = {
        Id: item.Id,
        EmployeeID: item[employeeIDCol],
        EmployeeUserId: item[employeeCol]?.Id,
        EmployeeEmail: item[employeeCol]?.EMail || item[emailCol],
        EmployeeDisplayName: item[employeeCol]?.Title,
        Department: item[deptCol],
        ManagerUserId: item[managerCol]?.Id,
        ManagerEmail: item[managerCol]?.EMail,
        IsActive: item[activeCol] === true,
        Employee: item[employeeCol] ? {
          Id: item[employeeCol].Id,
          Title: item[employeeCol].Title,
          EMail: item[employeeCol].EMail
        } : undefined,
        Manager: item[managerCol] ? {
          Id: item[managerCol].Id,
          Title: item[managerCol].Title,
          EMail: item[managerCol].EMail
        } : undefined,
        Created: item.Created,
        Modified: item.Modified
      };
      
      // Cache the result
      this.employeeCache.set(currentUserId, employeeMaster);
      
      console.log(`[EmployeeService] Found employee master - ID: ${employeeMaster.EmployeeID}, Name: ${employeeMaster.EmployeeDisplayName}`);
      
      return employeeMaster;
      
    } catch (error) {
      console.error('[EmployeeService] Error getting current employee master:', error);
      throw error;
    }
  }

  /**
   * Get employee master by Employee ID (e.g., R0398)
   * @param employeeId Employee ID string (e.g., "R0398")
   */
  public async getEmployeeMasterByEmployeeId(employeeId: string): Promise<IEmployeeMaster | null> {
    try {
      const listName = getListInternalName('employeeMaster');
      const employeeIDCol = getColumnInternalName('EmployeeMaster', 'EmployeeID');
      const employeeCol = getColumnInternalName('EmployeeMaster', 'Employee');
      const emailCol = getColumnInternalName('EmployeeMaster', 'Email');
      const deptCol = getColumnInternalName('EmployeeMaster', 'Department');
      const managerCol = getColumnInternalName('EmployeeMaster', 'Manager');
      const activeCol = getColumnInternalName('EmployeeMaster', 'Active');
      
      const filterQuery = `$filter=${employeeIDCol} eq '${employeeId}'`;
      
      const selectFields = [
        'Id',
        employeeIDCol,
        emailCol,
        deptCol,
        activeCol,
        `${employeeCol}/Id`,
        `${employeeCol}/Title`,
        `${employeeCol}/EMail`,
        `${managerCol}/Id`,
        `${managerCol}/Title`,
        `${managerCol}/EMail`
      ];
      
      const expandFields = [employeeCol, managerCol];
      
      const endpoint = `${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/items?${filterQuery}&$select=${selectFields.join(',')}&$expand=${expandFields.join(',')}`;
      
      const response: SPHttpClientResponse = await this.spHttpClient.get(
        endpoint,
        SPHttpClient.configurations.v1
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch employee master by ID: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.value || data.value.length === 0) {
        return null;
      }
      
      const item = data.value[0];
      
      const employeeMaster: IEmployeeMaster = {
        Id: item.Id,
        EmployeeID: item[employeeIDCol],
        EmployeeUserId: item[employeeCol]?.Id,
        EmployeeEmail: item[employeeCol]?.EMail || item[emailCol],
        EmployeeDisplayName: item[employeeCol]?.Title,
        Department: item[deptCol],
        ManagerUserId: item[managerCol]?.Id,
        ManagerEmail: item[managerCol]?.EMail,
        IsActive: item[activeCol] === true,
        Employee: item[employeeCol] ? {
          Id: item[employeeCol].Id,
          Title: item[employeeCol].Title,
          EMail: item[employeeCol].EMail
        } : undefined,
        Manager: item[managerCol] ? {
          Id: item[managerCol].Id,
          Title: item[managerCol].Title,
          EMail: item[managerCol].EMail
        } : undefined,
        Created: item.Created,
        Modified: item.Modified
      };
      
      return employeeMaster;
      
    } catch (error) {
      console.error(`[EmployeeService] Error getting employee master by ID ${employeeId}:`, error);
      throw error;
    }
  }

  /**
   * Get employee master by SharePoint User ID
   * @param userId SharePoint User ID
   */
  public async getEmployeeMasterByUserId(userId: number): Promise<IEmployeeMaster | null> {
    try {
      // Check cache first
      if (this.employeeCache.has(userId)) {
        return this.employeeCache.get(userId)!;
      }
      
      const listName = getListInternalName('employeeMaster');
      const employeeCol = getColumnInternalName('EmployeeMaster', 'Employee');
      const employeeIDCol = getColumnInternalName('EmployeeMaster', 'EmployeeID');
      const emailCol = getColumnInternalName('EmployeeMaster', 'Email');
      const deptCol = getColumnInternalName('EmployeeMaster', 'Department');
      const managerCol = getColumnInternalName('EmployeeMaster', 'Manager');
      const activeCol = getColumnInternalName('EmployeeMaster', 'Active');
      
      const filterQuery = `$filter=${employeeCol}/Id eq ${userId}`;
      
      const selectFields = [
        'Id',
        employeeIDCol,
        emailCol,
        deptCol,
        activeCol,
        `${employeeCol}/Id`,
        `${employeeCol}/Title`,
        `${employeeCol}/EMail`,
        `${managerCol}/Id`,
        `${managerCol}/Title`,
        `${managerCol}/EMail`
      ];
      
      const expandFields = [employeeCol, managerCol];
      
      const endpoint = `${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/items?${filterQuery}&$select=${selectFields.join(',')}&$expand=${expandFields.join(',')}`;
      
      const response: SPHttpClientResponse = await this.spHttpClient.get(
        endpoint,
        SPHttpClient.configurations.v1
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch employee master by user ID: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.value || data.value.length === 0) {
        return null;
      }
      
      const item = data.value[0];
      
      const employeeMaster: IEmployeeMaster = {
        Id: item.Id,
        EmployeeID: item[employeeIDCol],
        EmployeeUserId: item[employeeCol]?.Id,
        EmployeeEmail: item[employeeCol]?.EMail || item[emailCol],
        EmployeeDisplayName: item[employeeCol]?.Title,
        Department: item[deptCol],
        ManagerUserId: item[managerCol]?.Id,
        ManagerEmail: item[managerCol]?.EMail,
        IsActive: item[activeCol] === true,
        Employee: item[employeeCol] ? {
          Id: item[employeeCol].Id,
          Title: item[employeeCol].Title,
          EMail: item[employeeCol].EMail
        } : undefined,
        Manager: item[managerCol] ? {
          Id: item[managerCol].Id,
          Title: item[managerCol].Title,
          EMail: item[managerCol].EMail
        } : undefined,
        Created: item.Created,
        Modified: item.Modified
      };
      
      // Cache the result
      this.employeeCache.set(userId, employeeMaster);
      
      return employeeMaster;
      
    } catch (error) {
      console.error(`[EmployeeService] Error getting employee master by user ID ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if current user is a manager
   * Checks if user belongs to Timesheet_Managers or Timesheet_Admins group
   */
  public async isCurrentUserManager(): Promise<boolean> {
    try {
      const groups = SharePointConfig.groups;
      
      // Check Managers group
      const isManager = await this.isUserInGroup(groups.managers);
      if (isManager) return true;
      
      // Check Admins group (admins are also managers)
      const isAdmin = await this.isUserInGroup(groups.admins);
      return isAdmin;
      
    } catch (error) {
      console.error('[EmployeeService] Error checking if user is manager:', error);
      return false;
    }
  }

  /**
   * Check if current user is an admin
   */
  public async isCurrentUserAdmin(): Promise<boolean> {
    try {
      const groups = SharePointConfig.groups;
      return await this.isUserInGroup(groups.admins);
      
    } catch (error) {
      console.error('[EmployeeService] Error checking if user is admin:', error);
      return false;
    }
  }

  /**
   * Check if current user is in a specific SharePoint group
   */
  private async isUserInGroup(groupName: string): Promise<boolean> {
    try {
      const endpoint = `${this.siteUrl}/_api/web/currentuser/groups?$filter=Title eq '${encodeURIComponent(groupName)}'`;
      
      const response: SPHttpClientResponse = await this.spHttpClient.get(
        endpoint,
        SPHttpClient.configurations.v1
      );
      
      if (!response.ok) {
        throw new Error(`Failed to check group membership: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.value && data.value.length > 0;
      
    } catch (error) {
      console.error(`[EmployeeService] Error checking group membership for ${groupName}:`, error);
      return false;
    }
  }

  /**
   * Clear employee cache
   */
  public clearCache(): void {
    this.employeeCache.clear();
  }
}