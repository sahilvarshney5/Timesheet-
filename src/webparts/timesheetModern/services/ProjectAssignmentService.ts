// src/webparts/timesheetModern/services/ProjectAssignmentService.ts
// FIXED VERSION - Corrected column key references
// Service for Project Assignment list operations
// Handles fetching projects with Job Task Types and Duration

import { SPHttpClient } from '@microsoft/sp-http';
import { HttpClientService } from '../services/HttpClientService';
import { getListInternalName, getColumnInternalName } from '../config/SharePointConfig';

export interface IProjectAssignment {
  Id: number;
  ResourceID: string;
  ProjectNumber: string;
  ProjectName: string;
  TaskNumber: string;
  TaskName: string;
  TaskStatus: string;
  ValidFrom: string;
  ValidTo: string;
  BookingEnabled: boolean;
  Description: string;
  ProjectID: string;
  JobTaskType: string;        // NEW: Job Task Type (choice field)
  DurationTask: string;        // NEW: Duration of task in hours
}

export interface ITaskTypeOption {
  taskType: string;
  duration: number;
  projectNumber: string;
  taskNumber: string;
}

export class ProjectAssignmentService {
  private httpService: HttpClientService;

  constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    this.httpService = new HttpClientService(spHttpClient, siteUrl);
  }

  /**
   * Get active project assignments for a specific resource
   * @param resourceId Employee Resource ID (e.g., R0398)
   */
  public async getActiveProjectAssignments(resourceId: string): Promise<IProjectAssignment[]> {
    try {
      const listName = getListInternalName('projectAssignment');
      const today = new Date().toISOString().split('T')[0];

      // Build filter: Active + resource match + started + not ended (or open-ended)
      const filterQuery =
        `$filter=${getColumnInternalName('ProjectAssignment', 'ResourceID')} eq '${resourceId}' ` +
        `and ${getColumnInternalName('ProjectAssignment', 'BookingEnabled')} eq 1 ` +
        // `and ${getColumnInternalName('ProjectAssignment', 'ValidFrom')} le '${today}' ` +
        `and (` +
        `${getColumnInternalName('ProjectAssignment', 'ValidTo')} ge '${today}' ` +
        `or ${getColumnInternalName('ProjectAssignment', 'ValidTo')} eq null` +
        `)`;
      
      // ✅ FIX: Use correct column keys (without spaces) that match SharePointConfig
      const selectFields = [
        'Id',
        getColumnInternalName('ProjectAssignment', 'ResourceID'),        // was 'Title'
        getColumnInternalName('ProjectAssignment', 'ProjectNumber'),     // was 'Project Number'
        getColumnInternalName('ProjectAssignment', 'ProjectName'),       // was 'Project Name'
        getColumnInternalName('ProjectAssignment', 'TaskNumber'),        // was 'Task Number'
        getColumnInternalName('ProjectAssignment', 'TaskName'),          // was 'Task Name'
        getColumnInternalName('ProjectAssignment', 'TaskStatus'),        // was 'Task Status'
        getColumnInternalName('ProjectAssignment', 'ValidFrom'),         // was 'Valid From'
        getColumnInternalName('ProjectAssignment', 'ValidTo'),           // was 'Valid To'
        getColumnInternalName('ProjectAssignment', 'BookingEnabled'),    // was 'Booking Enabled'
        getColumnInternalName('ProjectAssignment', 'Description'),
        getColumnInternalName('ProjectAssignment', 'ProjectID'),         // was 'Project ID'
        getColumnInternalName('ProjectAssignment', 'JobTaskType'),       // was 'Job Task Type'
        getColumnInternalName('ProjectAssignment', 'DurationTask')       // was 'Duration of task'
      ];
      
      const items = await this.httpService.getListItems<IProjectAssignment>(
        listName,
        selectFields,
        filterQuery,
        'ProjectName'
      );
      
      console.log(`[ProjectAssignmentService] Loaded ${items.length} active project assignments for ${resourceId}`);
      return items;
      
    } catch (error) {
      console.error('[ProjectAssignmentService] Error getting active project assignments:', error);
      throw error;
    }
  }

  /**
   * Get task type options for a specific project
   * Returns unique task types with their durations
   * @param projectNumber Project number to filter by
   */
  public async getTaskTypeOptionsForProject(
    resourceId: string,
    projectNumber: string
  ): Promise<ITaskTypeOption[]> {
    try {
      const allAssignments = await this.getActiveProjectAssignments(resourceId);
      
      // Filter by project number and extract task type options
      const taskTypeMap = new Map<string, ITaskTypeOption>();
      
      allAssignments
        .filter(assignment => assignment.ProjectNumber === projectNumber)
        .forEach(assignment => {
          const key = `${assignment.JobTaskType}-${assignment.TaskNumber}`;
          
          if (!taskTypeMap.has(key)) {
            taskTypeMap.set(key, {
              taskType: assignment.JobTaskType,
              duration: parseFloat(assignment.DurationTask) || 0,
              projectNumber: assignment.ProjectNumber,
              taskNumber: assignment.TaskNumber
            });
          }
        });
      
      const options = Array.from(taskTypeMap.values());
      console.log(`[ProjectAssignmentService] Found ${options.length} task type options for project ${projectNumber}`);
      
      return options;
      
    } catch (error) {
      console.error('[ProjectAssignmentService] Error getting task type options:', error);
      return [];
    }
  }

  /**
   * Get duration for a specific task type in a project
   * @param resourceId Employee Resource ID
   * @param projectNumber Project number
   * @param taskType Job Task Type
   * @returns Duration in hours
   */
  public async getDurationForTaskType(
    resourceId: string,
    projectNumber: string,
    taskType: string
  ): Promise<number> {
    try {
      const allAssignments = await this.getActiveProjectAssignments(resourceId);
      
      // Find matching assignment
      const assignment = allAssignments.find(
        a => a.ProjectNumber === projectNumber && a.JobTaskType === taskType
      );
      
      if (assignment) {
        const duration = parseFloat(assignment.DurationTask) || 0;
        console.log(`[ProjectAssignmentService] Duration for ${taskType} in ${projectNumber}: ${duration}h`);
        return duration;
      }
      
      console.warn(`[ProjectAssignmentService] No duration found for ${taskType} in ${projectNumber}`);
      return 0;
      
    } catch (error) {
      console.error('[ProjectAssignmentService] Error getting duration for task type:', error);
      return 0;
    }
  }

  /**
   * Get all unique task types for a resource across all projects
   * @param resourceId Employee Resource ID
   */
  public async getAllTaskTypes(resourceId: string): Promise<string[]> {
    try {
      const allAssignments = await this.getActiveProjectAssignments(resourceId);
      
      const taskTypes = new Set<string>();
      allAssignments.forEach(assignment => {
        if (assignment.JobTaskType) {
          taskTypes.add(assignment.JobTaskType);
        }
      });
      
      const uniqueTaskTypes = Array.from(taskTypes).sort();
      console.log(`[ProjectAssignmentService] Found ${uniqueTaskTypes.length} unique task types`);
      
      return uniqueTaskTypes;
      
    } catch (error) {
      console.error('[ProjectAssignmentService] Error getting all task types:', error);
      return [];
    }
  }
}