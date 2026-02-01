// src/webparts/timesheetModern/services/ProjectTaskService.ts

import { SPHttpClient } from '@microsoft/sp-http';
import { HttpClientService } from './HttpClientService';
import { getListInternalName, getColumnInternalName } from '../config/SharePointConfig';

export interface IProjectTask {
  Id: number;
  ResourceID: string;
  ProjectNumber: string;
  ProjectName: string;
  TaskNumber: string;
  TaskName: string;
  ValidFrom: string;
  ValidTo: string;
  IsActive: boolean;
  BCResourceNo: string;
  TaskStatus: string;
  Description: string;
  ProjectID: string;
  JobTaskType: string;
}

export class ProjectTaskService {
  private httpService: HttpClientService;

  constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    this.httpService = new HttpClientService(spHttpClient, siteUrl);
  }

  /**
   * Get active projects for current user within valid date range
   * @param resourceId Employee Resource ID (e.g., R0398)
   */
  public async getActiveProjects(resourceId: string): Promise<IProjectTask[]> {
    try {
      const listName = getListInternalName('projectTaskMaster');
      const today = new Date().toISOString().split('T')[0];
      
      // Build filter: IsActive=true AND ResourceID=user AND date within range
      const filterQuery = `$filter=${getColumnInternalName('ProjectTaskMaster', 'ResourceID')} eq '${resourceId}' ` +
                         `and ${getColumnInternalName('ProjectTaskMaster', 'BookingEnabled')} eq 1 ` +
                         `and ${getColumnInternalName('ProjectTaskMaster', 'ValidFrom')} ge '${today}' `;
                        //  `and ${getColumnInternalName('ProjectTaskMaster', 'ValidTo')} ge '${today}'`;
      
      const selectFields = [
        'Id',
        getColumnInternalName('ProjectTaskMaster', 'ResourceID'),
        getColumnInternalName('ProjectTaskMaster', 'ProjectNo'),
        getColumnInternalName('ProjectTaskMaster', 'ProjectName'),
        getColumnInternalName('ProjectTaskMaster', 'TaskNo'),
        getColumnInternalName('ProjectTaskMaster', 'TaskName'),
        getColumnInternalName('ProjectTaskMaster', 'ValidFrom'),
        getColumnInternalName('ProjectTaskMaster', 'ValidTo'),
        getColumnInternalName('ProjectTaskMaster', 'BookingEnabled'),
        getColumnInternalName('ProjectTaskMaster', 'BCResourceNo'),
        getColumnInternalName('ProjectTaskMaster', 'TaskStatus'),
        getColumnInternalName('ProjectTaskMaster', 'Description'),
        getColumnInternalName('ProjectTaskMaster', 'ProjectID'),
        getColumnInternalName('ProjectTaskMaster', 'JobTaskType')
      ];
      
      const items = await this.httpService.getListItems<IProjectTask>(
        listName,
        selectFields,
        filterQuery,
        'ProjectName'
      );
      
      console.log(`[ProjectTaskService] Loaded ${items.length} active projects for ${resourceId}`);
      return items;
      
    } catch (error) {
      console.error('[ProjectTaskService] Error getting active projects:', error);
      throw error;
    }
  }
}