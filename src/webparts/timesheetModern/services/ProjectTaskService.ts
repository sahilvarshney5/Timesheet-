// src/webparts/timesheetModern/services/ProjectTaskService.ts
// ENHANCED: Added ProjectStatus="All" hide logic (mirrors ProjectAssignmentService pattern)
//
// NEW BEHAVIOUR (additive — zero impact on existing callers):
//   • _hiddenProjectNamesCache        → in-memory cache, populated once per instance
//   • getHiddenProjectNames()         → fetches ProjectName where ProjectStatus = "All"
//   • getActiveProjects()             → EXISTING method, now strips hidden projects
//                                       before returning; signature UNCHANGED
//   • clearHiddenProjectsCache()      → manual cache invalidation (admin use)
//
// ✅ All existing callers of getActiveProjects() continue to work without changes.

import { SPHttpClient } from '@microsoft/sp-http';
import { HttpClientService } from './HttpClientService';
import { getListInternalName, getColumnInternalName } from '../config/SharePointConfig';

// ─── Interfaces ───────────────────────────────────────────────────────────────

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
  /** Added so the hide-logic can read the value when it is fetched. */
  ProjectStatus?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ProjectTaskService {
  private httpService: HttpClientService;

  /**
   * In-memory cache for hidden project names (ProjectStatus = "All").
   * null = not yet fetched; string[] = fetched (may be empty).
   */
  private _hiddenProjectNamesCache: string[] | null = null;

  constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    this.httpService = new HttpClientService(spHttpClient, siteUrl);
  }

  // ============================================================================
  // NEW: Fetch project names where ProjectStatus = "All"
  //
  // • Single lightweight OData call — only ProjectName column is selected.
  // • Results are de-duplicated and cached for the lifetime of this instance.
  // • Returns [] on any error so callers are never blocked.
  // ============================================================================
  public async getHiddenProjectNames(): Promise<string[]> {
    // Return cached result immediately if available
    if (this._hiddenProjectNamesCache !== null) {
      return this._hiddenProjectNamesCache;
    }

    try {
      const listName         = getListInternalName('projectTaskMaster');
      const projectNameCol   = getColumnInternalName('ProjectTaskMaster', 'ProjectName');
      const projectStatusCol = getColumnInternalName('ProjectTaskMaster', 'ProjectStatus');

      const filterQuery  = `$filter=${projectStatusCol} eq 'All'`;
      const selectFields = [projectNameCol];

      const items = await this.httpService.getListItems<{ [key: string]: any }>(
        listName,
        selectFields,
        filterQuery,
        undefined, // no orderBy needed
        5000       // safe upper bound
      );

      // De-duplicate: multiple rows can share the same ProjectName
      const nameSet = new Set<string>();
      items.forEach(item => {
        const name = (item[projectNameCol] || item['ProjectName'] || '').trim();
        if (name) nameSet.add(name);
      });

      this._hiddenProjectNamesCache = Array.from(nameSet);

      console.log(
        `[ProjectTaskService] getHiddenProjectNames: ` +
        `${this._hiddenProjectNamesCache.length} hidden project(s) →`,
        this._hiddenProjectNamesCache
      );

      return this._hiddenProjectNamesCache;

    } catch (error) {
      console.error('[ProjectTaskService] Error fetching hidden project names:', error);
      // Cache empty array so we don't retry on every dropdown open
      this._hiddenProjectNamesCache = [];
      return [];
    }
  }

  // ============================================================================
  // NEW: Invalidate the hidden-projects cache
  // Call this if an admin changes ProjectStatus values at runtime.
  // ============================================================================
  public clearHiddenProjectsCache(): void {
    this._hiddenProjectNamesCache = null;
    console.log('[ProjectTaskService] Hidden project names cache cleared.');
  }

  // ============================================================================
  // EXISTING: Get active projects for current user within valid date range
  //
  // CHANGE: Hidden projects (ProjectStatus = "All") are now stripped from the
  //         result before returning.  The OData filter and select fields are
  //         otherwise identical to the original implementation.
  //
  // @param resourceId  Employee Resource ID (e.g., R0398)
  // ============================================================================
  public async getActiveProjects(resourceId: string): Promise<IProjectTask[]> {
    try {
      const listName = getListInternalName('projectTaskMaster');
      const today    = new Date().toISOString().split('T')[0];

      // ── OData filter (unchanged from original) ────────────────────────────
      const filterQuery =
        `$filter=${getColumnInternalName('ProjectTaskMaster', 'ResourceID')} eq '${resourceId}' ` +
        `and ${getColumnInternalName('ProjectTaskMaster', 'BookingEnabled')} eq 1 ` +
        `and (` +
        `${getColumnInternalName('ProjectTaskMaster', 'ValidTo')} ge '${today}' ` +
        `or ${getColumnInternalName('ProjectTaskMaster', 'ValidTo')} eq null` +
        `)`;

      // ── Select fields (ProjectStatus added so client-side filter can read it)
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
        getColumnInternalName('ProjectTaskMaster', 'JobTaskType'),
        getColumnInternalName('ProjectTaskMaster', 'ProjectStatus') // NEW — needed for hide logic
      ];

      // ── Fire SP fetch and hidden-name lookup in parallel ──────────────────
      const [items, hiddenProjectNames] = await Promise.all([
        this.httpService.getListItems<IProjectTask>(
          listName,
          selectFields,
          filterQuery,
          'ProjectName'
        ),
        this.getHiddenProjectNames()
      ]);

      console.log(`[ProjectTaskService] Fetched ${items.length} raw projects for ${resourceId}`);

      // ── Strip hidden projects (ProjectStatus = "All") ─────────────────────
      if (hiddenProjectNames.length === 0) {
        // Fast path: nothing is hidden
        return items;
      }

      const hiddenSet = new Set<string>(
        hiddenProjectNames.map(name => name.trim().toLowerCase())
      );

      const visible = items.filter(item => {
        const name = (item.ProjectName || '').trim().toLowerCase();
        return !hiddenSet.has(name);
      });

      console.log(
        `[ProjectTaskService] getActiveProjects(${resourceId}): ` +
        `${items.length} fetched → ${visible.length} visible ` +
        `(${items.length - visible.length} hidden by ProjectStatus="All")`
      );

      return visible;

    } catch (error) {
      console.error('[ProjectTaskService] Error getting active projects:', error);
      throw error;
    }
  }
}