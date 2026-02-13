// services/UserService.ts
// ENHANCED VERSION - Added Microsoft Graph support for manager email
// Service for user-related operations
// Handles current user info and user lookups

import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { HttpClientService } from './HttpClientService';
import { IUserInfo } from '../models';
import { MSGraphClientV3 } from '@microsoft/sp-http';

export interface IUserPermissions {
  isManager: boolean;
  isAdmin: boolean;
  isMember: boolean;
}

export class UserService {
  private httpService: HttpClientService;
  private spHttpClient: SPHttpClient;
  private siteUrl: string;
  private graphClient: MSGraphClientV3 | null;

  constructor(spHttpClient: SPHttpClient, siteUrl: string, graphClient?: MSGraphClientV3) {
    this.httpService = new HttpClientService(spHttpClient, siteUrl);
    this.spHttpClient = spHttpClient;
    this.siteUrl = siteUrl;
    this.graphClient = graphClient || null;
  }

  /**
   * Get current user information
   */
  public async getCurrentUser(): Promise<IUserInfo> {
    try {
      const endpoint = `${this.siteUrl}/_api/web/currentuser`;
      
      const response: SPHttpClientResponse = await this.spHttpClient.get(
        endpoint,
        SPHttpClient.configurations.v1
      );
      
      if (!response.ok) {
        throw new Error(`Failed to get current user: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        Id: data.Id,
        DisplayName: data.Title,
        Email: data.Email,
        EmployeeCode: data.EmployeeCode || undefined
      };
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * NEW: Get current user's manager email using Microsoft Graph
   * Returns manager email or empty string if not found
   */
  public async getCurrentUserManagerEmail(): Promise<string> {
    try {
      if (!this.graphClient) {
        return '';
      }

      const manager: any = await this.graphClient
        .api('/me/manager')
        .select('mail,userPrincipalName')
        .get();

      return manager?.mail || manager?.userPrincipalName || '';

    } catch (error) {
      return '';
    }
  }

  /**
   * Get user permissions (isManager, isAdmin, isMember)
   */
  public async getUserPermissions(): Promise<IUserPermissions> {
    try {
      const [isManager, isAdmin] = await Promise.all([
        this.isUserInGroup('Timesheet_Managers'),
        this.isUserInGroup('Timesheet_Admins')
      ]);

      return {
        isManager: isManager || isAdmin,
        isAdmin: isAdmin,
        isMember: !isAdmin && !isManager
      };
      
    } catch (error) {
      return {
        isManager: false,
        isAdmin: false,
        isMember: true
      };
    }
  }

  /**
   * Get user role as a simple string (Admin, Manager, or Member)
   */
  public async getUserRole(): Promise<'Admin' | 'Manager' | 'Member'> {
    try {
      const permissions = await this.getUserPermissions();
      
      if (permissions.isAdmin) {
        return 'Admin';
      } else if (permissions.isManager) {
        return 'Manager';
      } else {
        return 'Member';
      }
      
    } catch (error) {
      return 'Member';
    }
  }

  /**
   * Get user by ID
   * @param userId User ID
   */
  public async getUserById(userId: number): Promise<IUserInfo | null> {
    try {
      const endpoint = `${this.siteUrl}/_api/web/getuserbyid(${userId})`;
      
      const response: SPHttpClientResponse = await this.spHttpClient.get(
        endpoint,
        SPHttpClient.configurations.v1
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to get user ${userId}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        Id: data.Id,
        DisplayName: data.Title,
        Email: data.Email,
        EmployeeCode: data.EmployeeCode || undefined
      };
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user by email
   * @param email User email
   */
  public async getUserByEmail(email: string): Promise<IUserInfo | null> {
    try {
      const endpoint = `${this.siteUrl}/_api/web/siteusers?$filter=Email eq '${encodeURIComponent(email)}'`;
      
      const response: SPHttpClientResponse = await this.spHttpClient.get(
        endpoint,
        SPHttpClient.configurations.v1
      );
      
      if (!response.ok) {
        throw new Error(`Failed to get user by email ${email}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.value || data.value.length === 0) {
        return null;
      }
      
      const user = data.value[0];
      
      return {
        Id: user.Id,
        DisplayName: user.Title,
        Email: user.Email,
        EmployeeCode: user.EmployeeCode || undefined
      };
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user's manager (if available from User Profile Service)
   * @param loginName User login name
   */
  public async getUserManager(loginName: string): Promise<IUserInfo | null> {
    try {
      const endpoint = `${this.siteUrl}/_api/SP.UserProfiles.PeopleManager/GetPropertiesFor(accountName=@v)?@v='${encodeURIComponent(loginName)}'`;
      
      const response: SPHttpClientResponse = await this.spHttpClient.get(
        endpoint,
        SPHttpClient.configurations.v1
      );
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      
      const managerProperty = data.UserProfileProperties?.find(
        (prop: any) => prop.Key === 'Manager'
      );
      
      if (!managerProperty || !managerProperty.Value) {
        return null;
      }
      
      return await this.getUserByEmail(managerProperty.Value);
      
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if current user is in a specific SharePoint group
   * @param groupName SharePoint group name
   */
  public async isUserInGroup(groupName: string): Promise<boolean> {
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
      return false;
    }
  }

  /**
   * Get all users in a SharePoint group
   * @param groupName SharePoint group name
   */
  public async getUsersInGroup(groupName: string): Promise<IUserInfo[]> {
    try {
      const endpoint = `${this.siteUrl}/_api/web/sitegroups/getbyname('${encodeURIComponent(groupName)}')/users`;
      
      const response: SPHttpClientResponse = await this.spHttpClient.get(
        endpoint,
        SPHttpClient.configurations.v1
      );
      
      if (!response.ok) {
        throw new Error(`Failed to get users in group ${groupName}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return data.value.map((user: any) => ({
        Id: user.Id,
        DisplayName: user.Title,
        Email: user.Email,
        EmployeeCode: user.EmployeeCode || undefined
      }));
      
    } catch (error) {
      throw error;
    }
  }
}