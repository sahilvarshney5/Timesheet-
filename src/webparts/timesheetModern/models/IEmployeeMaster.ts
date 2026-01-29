import { IBaseModel } from './IBaseModel';

/**
 * Employee Master Model
 * Represents the employee master data from SharePoint
 * Links SharePoint User (Person or Group) to Employee ID (e.g., R0398)
 */
export interface IEmployeeMaster extends IBaseModel {
  /* Canonical Properties */
  EmployeeID: string;          // e.g., "R0398" - Unique identifier
  EmployeeUserId?: number;      // SharePoint User ID from Employee field
  EmployeeEmail?: string;       // Employee email address
  EmployeeDisplayName?: string; // Employee display name
  Department?: string;          // Department name
  ManagerUserId?: number;       // SharePoint User ID of manager
  ManagerEmail?: string;        // Manager email address
  IsActive: boolean;            // Whether employee is active
  
  /* SharePoint Person/Group Field Expansion */
  Employee?: {
    Id: number;
    Title: string;
    EMail: string;
  };
  
  Manager?: {
    Id: number;
    Title: string;
    EMail: string;
  };
}