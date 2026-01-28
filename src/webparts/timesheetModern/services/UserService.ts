// services/UserService.ts
// Service for user-related SharePoint operations
// Handles current user info and permission checking

import { SPHttpClient } from '@microsoft/sp-http';
import { HttpClientService } from './HttpClientService';
import { SharePointConfig } from '../config/SharePointConfig';
import { IUserInfo } from '../models';

export interface IUserPermissions {
  isAdmin: boolean;
  isManager: boolean;
  isMember: boolean;
  employeeId?: string;
}

export class UserService {
  private httpService: HttpClientService;
  private currentUserInfo: IUserInfo | null = null;
  private userPermissions: IUserPermissions | null = null;

  constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    this.httpService = new HttpClientService(spHttpClient, siteUrl);
  }

  /**
   * Get current user information
   */
  public async getCurrentUser(): Promise<IUserInfo> {
    try {
      if (this.currentUserInfo) {
        return this.currentUserInfo;
      }

      const userData = await this.httpService.getCurrentUser();
      
      this.currentUserInfo = {
        Id: userData.Id,
        DisplayName: userData.Title,
        Email: userData.Email,
        EmployeeCode: userData.EmployeeCode || this.extractEmployeeCode(userData.Email)
      };

      return this.currentUserInfo;
      
    } catch (error) {
      console.error('[UserService] Error getting current user:', error);
      throw error;
    }
  }

  /**
   * Get user permissions (Admin, Manager, or Member)
   */
  public async getUserPermissions(): Promise<IUserPermissions> {
    try {
      if (this.userPermissions) {
        return this.userPermissions;
      }

      const user = await this.getCurrentUser();
      
      // Check SharePoint groups
      const isAdmin = await this.isUserInGroup(user.Email, 'Timesheet-Admins');
      const isManager = await this.isUserInGroup(user.Email, 'Timesheet-Managers');
      const isMember = await this.isUserInGroup(user.Email, 'Timesheet-Employees');

      this.userPermissions = {
        isAdmin,
        isManager,
        isMember,
        employeeId: user.EmployeeCode
      };

      return this.userPermissions;
      
    } catch (error) {
      console.error('[UserService] Error getting user permissions:', error);
      // Default to member if error
      return {
        isAdmin: false,
        isManager: false,
        isMember: true,
        employeeId: undefined
      };
    }
  }

  /**
   * Check if user is in a specific SharePoint group
   * @param userEmail User email
   * @param groupName SharePoint group name
   */
  private async isUserInGroup(userEmail: string, groupName: string): Promise<boolean> {
    try {
      const endpoint = `${this.httpService['siteUrl']}/_api/web/sitegroups/getbyname('${groupName}')/users?$filter=Email eq '${userEmail}'`;
      
      const response = await this.httpService['spHttpClient'].get(
        endpoint,
        this.httpService['spHttpClient'].configurations.v1
      );
      
      if (!response.ok) {
        console.warn(`[UserService] Failed to check group ${groupName} for user ${userEmail}`);
        return false;
      }
      
      const data = await response.json();
      return data.value && data.value.length > 0;
      
    } catch (error) {
      console.error(`[UserService] Error checking group ${groupName}:`, error);
      return false;
    }
  }

  /**
   * Extract employee code from email
   * @param email User email
   */
  private extractEmployeeCode(email: string): string {
    // Try to extract from email prefix
    // Example: emp001@company.com -> EMP001
    const prefix = email.split('@')[0];
    return prefix.toUpperCase();
  }

  /**
   * Get user display role
   */
  public async getUserRole(): Promise<'Admin' | 'Manager' | 'Member'> {
    const permissions = await this.getUserPermissions();
    
    if (permissions.isAdmin) return 'Admin';
    if (permissions.isManager) return 'Manager';
    return 'Member';
  }
}