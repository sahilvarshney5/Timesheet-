// services/UserService.ts
// Service for user-related operations
// Handles current user info and user lookups

import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { HttpClientService } from './HttpClientService';
import { IUserInfo } from '../models';

export class UserService {
  private httpService: HttpClientService;
  private spHttpClient: SPHttpClient;
  private siteUrl: string;

  constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    this.httpService = new HttpClientService(spHttpClient, siteUrl);
    this.spHttpClient = spHttpClient;
    this.siteUrl = siteUrl;
  }

  /**
   * Get current user information
   */
  public async getCurrentUser(): Promise<IUserInfo> {
    try {
      const endpoint = `${this.siteUrl}/_api/web/currentuser`;
      
      const response: SPHttpClientResponse = await this.spHttpClient.get(
        endpoint,
        SPHttpClient.configurations.v1 // FIXED: Access static property correctly
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
      console.error('[UserService] Error getting current user:', error);
      throw error;
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
        SPHttpClient.configurations.v1 // FIXED: Access static property correctly
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
      console.error(`[UserService] Error getting user ${userId}:`, error);
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
        SPHttpClient.configurations.v1 // FIXED: Access static property correctly
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
      console.error(`[UserService] Error getting user by email ${email}:`, error);
      throw error;
    }
  }

  /**
   * Get user's manager (if available from User Profile Service)
   * @param loginName User login name
   */
  public async getUserManager(loginName: string): Promise<IUserInfo | null> {
    try {
      // Note: This requires User Profile Service to be configured
      const endpoint = `${this.siteUrl}/_api/SP.UserProfiles.PeopleManager/GetPropertiesFor(accountName=@v)?@v='${encodeURIComponent(loginName)}'`;
      
      const response: SPHttpClientResponse = await this.spHttpClient.get(
        endpoint,
        SPHttpClient.configurations.v1 // FIXED: Access static property correctly
      );
      
      if (!response.ok) {
        console.warn(`[UserService] Could not get manager for ${loginName}: ${response.statusText}`);
        return null;
      }
      
      const data = await response.json();
      
      // Extract manager from extended properties
      const managerProperty = data.UserProfileProperties?.find(
        (prop: any) => prop.Key === 'Manager'
      );
      
      if (!managerProperty || !managerProperty.Value) {
        return null;
      }
      
      // Get manager details
      return await this.getUserByEmail(managerProperty.Value);
      
    } catch (error) {
      console.error(`[UserService] Error getting manager for ${loginName}:`, error);
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
        SPHttpClient.configurations.v1 // FIXED: Access static property correctly
      );
      
      if (!response.ok) {
        throw new Error(`Failed to check group membership: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return data.value && data.value.length > 0;
      
    } catch (error) {
      console.error(`[UserService] Error checking group membership for ${groupName}:`, error);
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
        SPHttpClient.configurations.v1 // FIXED: Access static property correctly
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
      console.error(`[UserService] Error getting users in group ${groupName}:`, error);
      throw error;
    }
  }
}