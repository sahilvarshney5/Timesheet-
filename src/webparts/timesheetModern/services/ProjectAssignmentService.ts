// src/webparts/timesheetModern/services/ProjectAssignmentService.ts
// ENHANCED: Added ProjectStatus="All" hide logic
//
// NEW BEHAVIOUR (additive — zero impact on existing callers):
//   • getHiddenProjectNames()       → fetches all ProjectName values where
//                                      ProjectStatus = "All" (single API call, cached)
//   • getFilteredProjectAssignments() → entry-point for the Add-Entry modal dropdown;
//                                        excludes hidden projects from both the project
//                                        list AND the milestone/activity list
//   • All existing public methods (getActiveProjectAssignments, getMilestonesForDate,
//     filterAssignmentsByDate, getTaskTypeOptionsForProject, getDurationForTaskType,
//     getAllTaskTypes) are UNCHANGED in signature and behaviour.
//
// ✅ EXISTING FUNCTIONALITY PRESERVED — only filtering enhanced
// ✅ NO IMPACT on Approval / Dashboard / Attendance modules

import { SPHttpClient } from '@microsoft/sp-http';
import { HttpClientService } from '../services/HttpClientService';
import { getListInternalName, getColumnInternalName } from '../config/SharePointConfig';

// ─── Interfaces ──────────────────────────────────────────────────────────────

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
  JobTaskType: string;
  DurationTask: string;
  ProjectType?: string;       // "Billable" | "Non-Billable" | other
  ProjectStatus?: string;     // "All" = hidden from UI; NULL/empty = active
  WorkStatus?: string;        // "on_x0020_hold" = hold (excluded)
  TaskStDate?: string;        // Task Start Date  (Non-Billable date gate)
  TaskEdDate?: string;        // Task End Date    (Non-Billable date gate)
  ResourceStDate?: string;    // Resource Start Date (Billable date gate)
  ResourceEdDate?: string;    // Resource End Date   (Billable date gate)
}

export interface ITaskTypeOption {
  taskType: string;
  duration: number;
  projectNumber: string;
  taskNumber: string;
}

/**
 * Result shape returned by getFilteredProjectAssignments.
 * The modal only needs to know the unique project names for the Project dropdown
 * and the full assignment rows for the Milestone/Activity dropdown.
 */
export interface IFilteredAssignmentResult {
  /** Unique project names visible in the Project dropdown (hidden projects excluded). */
  visibleProjectNames: string[];
  /** Full assignment rows with hidden projects already removed (used for milestone dropdown). */
  assignments: IProjectAssignment[];
  /** Project names that were suppressed because ProjectStatus = "All". */
  hiddenProjectNames: string[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ProjectAssignmentService {
  private httpService: HttpClientService;

  /**
   * In-memory cache for hidden project names (ProjectStatus = "All").
   * Populated on the first call to getHiddenProjectNames() and reused
   * for the lifetime of the service instance (typically one page load).
   * Set to null to indicate "not yet fetched".
   */
  private _hiddenProjectNamesCache: string[] | null = null;

  constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    this.httpService = new HttpClientService(spHttpClient, siteUrl);
  }

  // ============================================================================
  // PRIVATE HELPER — normalize any date-ish value to "YYYY-MM-DD" string
  // ============================================================================
  private normalizeDateStr(value: string | null | undefined): string {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (value.indexOf('T') !== -1) {
      const part = value.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
    }
    if (value.indexOf(' ') !== -1) {
      const part = value.split(' ')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const y    = d.getFullYear();
    const mNum = d.getMonth() + 1;
    const dyNum = d.getDate();
    const m  = mNum  < 10 ? '0' + mNum  : '' + mNum;
    const dy = dyNum < 10 ? '0' + dyNum : '' + dyNum;
    return `${y}-${m}-${dy}`;
  }

  // ============================================================================
  // PRIVATE HELPER — Apply global + date-based milestone filter
  //
  // Global conditions (all records):
  //   1. ProjectStatus must be NULL/empty  (active projects only)
  //      NOTE: "All" records are stripped out by getFilteredProjectAssignments
  //            BEFORE this method is called, so the check here acts as a
  //            safety net for any other non-empty ProjectStatus values.
  //   2. WorkStatus must NOT be 'on_x0020_hold' / 'hold'
  //   3. BookingEnabled must be TRUE
  //
  // Date-based conditions (only when selectedDate is provided):
  //   • Billable     → ResourceStDate / ResourceEdDate
  //   • Non-Billable → TaskStDate / TaskEdDate
  // ============================================================================
  private applyMilestoneFilter(
    assignments: IProjectAssignment[],
    selectedDate?: string
  ): IProjectAssignment[] {
    const normalizedSelected = selectedDate
      ? this.normalizeDateStr(selectedDate)
      : null;

    return assignments.filter(item => {
      // ── GLOBAL 1: ProjectStatus must be NULL/empty ───────────────────────
      const projectStatus = item.ProjectStatus ?? '';
      if (projectStatus.trim() !== '') {
        return false;
      }

      // ── GLOBAL 2: WorkStatus must NOT be hold ───────────────────────────
      const workStatus = (item.WorkStatus ?? '').toLowerCase();
      if (workStatus === 'on_x0020_hold' || workStatus === 'hold') {
        return false;
      }

      // ── GLOBAL 3: BookingEnabled must be TRUE ────────────────────────────
      if (!item.BookingEnabled) {
        return false;
      }

      // ── DATE-BASED FILTER ────────────────────────────────────────────────
      if (normalizedSelected) {
        const projectType = (item.ProjectType ?? '').trim().toLowerCase();

        if (projectType === 'billable') {
          const resourceStart = this.normalizeDateStr(item.ResourceStDate);
          const resourceEnd   = this.normalizeDateStr(item.ResourceEdDate);
          if (resourceStart && normalizedSelected < resourceStart) return false;
          if (resourceEnd   && normalizedSelected > resourceEnd)   return false;
        } else {
          const taskStart = this.normalizeDateStr(item.TaskStDate);
          const taskEnd   = this.normalizeDateStr(item.TaskEdDate);
          if (taskStart && normalizedSelected < taskStart) return false;
          if (taskEnd   && normalizedSelected > taskEnd)   return false;
        }
      }

      return true;
    });
  }

  // ============================================================================
  // NEW PUBLIC: Fetch project names where ProjectStatus = "All"
  //
  // Strategy
  // ────────
  // A single OData call fetches ONLY the ProjectName column filtered by
  // ProjectStatus eq 'All'.  This is much cheaper than fetching all columns
  // for all records.  Results are de-duplicated and cached in memory so that
  // subsequent calls within the same session are instant.
  //
  // Returns [] on any error so callers are never blocked.
  // ============================================================================
  public async getHiddenProjectNames(): Promise<string[]> {
    // Return cached result immediately if available
    if (this._hiddenProjectNamesCache !== null) {
      return this._hiddenProjectNamesCache;
    }

    try {
      const listName        = getListInternalName('projectAssignment');
      const projectNameCol  = getColumnInternalName('ProjectAssignment', 'ProjectName');
      const projectStatusCol = getColumnInternalName('ProjectAssignment', 'ProjectStatus');

      // Fetch only the two columns we need, filtered server-side
      const filterQuery = `$filter=${projectStatusCol} eq 'All'`;
      const selectFields = [projectNameCol];

      const items = await this.httpService.getListItems<{ ProjectName?: string; [key: string]: any }>(
        listName,
        selectFields,
        filterQuery,
        undefined,   // no orderBy needed
        5000         // fetch up to 5 000 rows (safe upper bound)
      );

      // De-duplicate: multiple rows can share the same ProjectName
      const nameSet = new Set<string>();
      items.forEach(item => {
        const name = (item[projectNameCol] || item['ProjectName'] || '').trim();
        if (name) nameSet.add(name);
      });

      this._hiddenProjectNamesCache = Array.from(nameSet);

      console.log(
        `[ProjectAssignmentService] getHiddenProjectNames: ` +
        `${this._hiddenProjectNamesCache.length} hidden project(s) found → `,
        this._hiddenProjectNamesCache
      );

      return this._hiddenProjectNamesCache;

    } catch (error) {
      console.error(
        '[ProjectAssignmentService] Error fetching hidden project names:',
        error
      );
      // Cache empty array so we don't keep retrying on every keystroke
      this._hiddenProjectNamesCache = [];
      return [];
    }
  }

  // ============================================================================
  // NEW PUBLIC: Get filtered assignments for the Add-Entry modal
  //
  // This is the ONLY method the modal's Project dropdown and Milestone dropdown
  // should call.  It:
  //   1. Fetches hidden project names (ProjectStatus = "All") — cached after
  //      the first call, so parallel calls within the same modal session are free.
  //   2. Fetches all active assignments for the resource.
  //   3. Removes any assignment whose ProjectName is in the hidden list.
  //   4. Optionally applies the date-based milestone filter (pass selectedDate
  //      when the user has already chosen a date in the modal).
  //   5. Returns a typed result object with:
  //        • visibleProjectNames  — distinct names for the Project <select>
  //        • assignments          — filtered rows for the Milestone <select>
  //        • hiddenProjectNames   — for debug / audit logging
  //
  // Concurrency: steps 1 and 2 are fired in parallel with Promise.all so that
  // both network requests are in-flight simultaneously.
  // ============================================================================
  public async getFilteredProjectAssignments(
    resourceId: string,
    selectedDate?: string
  ): Promise<IFilteredAssignmentResult> {
    try {
      // ── STEP 1 & 2: Parallel fetch ─────────────────────────────────────────
      const [hiddenProjectNames, allAssignments] = await Promise.all([
        this.getHiddenProjectNames(),
        this.getActiveProjectAssignments(resourceId)
      ]);

      // Build a fast O(1) lookup set from the hidden names array
      const hiddenSet = new Set<string>(
        hiddenProjectNames.map(name => name.trim().toLowerCase())
      );

      // ── STEP 3: Strip hidden projects ──────────────────────────────────────
      const visibleAssignments = allAssignments.filter(a => {
        const name = (a.ProjectName || '').trim().toLowerCase();
        return !hiddenSet.has(name);
      });

      // ── STEP 4: Apply date-based milestone filter (if date provided) ────────
      // applyMilestoneFilter also enforces BookingEnabled / WorkStatus globally.
      const filteredAssignments = this.applyMilestoneFilter(visibleAssignments, selectedDate);

      // ── STEP 5: Build unique project name list for the dropdown ─────────────
      const projectNameSet = new Set<string>();
      filteredAssignments.forEach(a => {
        if (a.ProjectName) projectNameSet.add(a.ProjectName);
      });
      const visibleProjectNames = Array.from(projectNameSet).sort();

      console.log(
        `[ProjectAssignmentService] getFilteredProjectAssignments(${resourceId}, ${selectedDate ?? 'no-date'}): ` +
        `${allAssignments.length} total → ${filteredAssignments.length} visible ` +
        `(${hiddenProjectNames.length} project(s) hidden)`
      );

      return {
        visibleProjectNames,
        assignments: filteredAssignments,
        hiddenProjectNames
      };

    } catch (error) {
      console.error(
        '[ProjectAssignmentService] Error in getFilteredProjectAssignments:',
        error
      );
      return {
        visibleProjectNames: [],
        assignments: [],
        hiddenProjectNames: []
      };
    }
  }

  // ============================================================================
  // NEW PUBLIC: Invalidate the hidden-projects cache
  //
  // Call this if you suspect the SharePoint list has been updated at runtime
  // (e.g. an admin changed ProjectStatus values) and you need fresh data.
  // ============================================================================
  public clearHiddenProjectsCache(): void {
    this._hiddenProjectNamesCache = null;
    console.log('[ProjectAssignmentService] Hidden project names cache cleared.');
  }

  // ============================================================================
  // EXISTING: Get active project assignments for a resource
  // ✅ UNCHANGED — existing callers (Dashboard, copy-paste, etc.) unaffected
  // ============================================================================
  public async getActiveProjectAssignments(resourceId: string): Promise<IProjectAssignment[]> {
    try {
      const listName = getListInternalName('projectAssignment');
      const today = new Date().toISOString().split('T')[0];

      const filterQuery =
        `$filter=${getColumnInternalName('ProjectAssignment', 'ResourceID')} eq '${resourceId}' ` +
        `and ${getColumnInternalName('ProjectAssignment', 'BookingEnabled')} eq 1 ` +

        // Resource Date Validation
        `and ${getColumnInternalName('ProjectAssignment', 'ResourceStDate')} le '${today}' ` +
        `and (` +
        `${getColumnInternalName('ProjectAssignment', 'ResourceEdDate')} ge '${today}' ` +
        `or ${getColumnInternalName('ProjectAssignment', 'ResourceEdDate')} eq null` +
        `) ` +

        // Task Date Validation
        `and ${getColumnInternalName('ProjectAssignment', 'TaskStDate')} le '${today}' ` +
        `and (` +
        `${getColumnInternalName('ProjectAssignment', 'TaskEdDate')} ge '${today}' ` +
        `or ${getColumnInternalName('ProjectAssignment', 'TaskEdDate')} eq null` +
        `)`;

      const coreSelectFields = [
        'Id',
        getColumnInternalName('ProjectAssignment', 'ResourceID'),
        getColumnInternalName('ProjectAssignment', 'ProjectNumber'),
        getColumnInternalName('ProjectAssignment', 'ProjectName'),
        getColumnInternalName('ProjectAssignment', 'TaskNumber'),
        getColumnInternalName('ProjectAssignment', 'TaskName'),
        getColumnInternalName('ProjectAssignment', 'TaskStatus'),
        getColumnInternalName('ProjectAssignment', 'ValidFrom'),
        getColumnInternalName('ProjectAssignment', 'ValidTo'),
        getColumnInternalName('ProjectAssignment', 'BookingEnabled'),
        getColumnInternalName('ProjectAssignment', 'Description'),
        getColumnInternalName('ProjectAssignment', 'ProjectID'),
        getColumnInternalName('ProjectAssignment', 'JobTaskType'),
        getColumnInternalName('ProjectAssignment', 'DurationTask'),
        getColumnInternalName('ProjectAssignment', 'WorkStatus'),
        getColumnInternalName('ProjectAssignment', 'ProjectType'),
        getColumnInternalName('ProjectAssignment', 'ResourceStDate'),
        getColumnInternalName('ProjectAssignment', 'ResourceEdDate'),
        getColumnInternalName('ProjectAssignment', 'TaskStDate'),
        getColumnInternalName('ProjectAssignment', 'TaskEdDate'),
        getColumnInternalName('ProjectAssignment', 'ProjectStatus')
      ];

      let items: IProjectAssignment[];

      try {
        items = await this.httpService.getListItems<IProjectAssignment>(
          listName,
          coreSelectFields,
          filterQuery,
          'ProjectName'
        );
        console.log(
          `[ProjectAssignmentService] Loaded ${items.length} assignments for ${resourceId}`
        );
      } catch (extError) {
        console.warn(
          '[ProjectAssignmentService] Extended column fetch failed — falling back to core columns.',
          extError
        );
        items = await this.httpService.getListItems<IProjectAssignment>(
          listName,
          coreSelectFields,
          filterQuery,
          'ProjectName'
        );
        console.log(
          `[ProjectAssignmentService] Loaded ${items.length} assignments (fallback) for ${resourceId}`
        );
      }

      return items;

    } catch (error) {
      console.error(
        '[ProjectAssignmentService] Error getting active project assignments:',
        error
      );
      return [];
    }
  }

  // ============================================================================
  // EXISTING: Get milestones filtered by selected timesheet date
  // ✅ UNCHANGED — signature and return type preserved
  // ============================================================================
  public async getMilestonesForDate(
    resourceId: string,
    selectedDate?: string
  ): Promise<IProjectAssignment[]> {
    try {
      const allAssignments = await this.getActiveProjectAssignments(resourceId);
      const filtered = this.applyMilestoneFilter(allAssignments, selectedDate);

      console.log(
        `[ProjectAssignmentService] getMilestonesForDate(${selectedDate ?? 'no-date'}): ` +
        `${allAssignments.length} total → ${filtered.length} after filter`
      );

      return filtered;

    } catch (error) {
      console.error(
        '[ProjectAssignmentService] Error in getMilestonesForDate:',
        error
      );
      return [];
    }
  }

  // ============================================================================
  // EXISTING: Filter an already-loaded assignment list by date
  // ✅ UNCHANGED
  // ============================================================================
  public filterAssignmentsByDate(
    assignments: IProjectAssignment[],
    selectedDate: string
  ): IProjectAssignment[] {
    return this.applyMilestoneFilter(assignments, selectedDate);
  }

  // ============================================================================
  // EXISTING: Get task type options for a specific project
  // ✅ UNCHANGED
  // ============================================================================
  public async getTaskTypeOptionsForProject(
    resourceId: string,
    projectNumber: string
  ): Promise<ITaskTypeOption[]> {
    try {
      const allAssignments = await this.getActiveProjectAssignments(resourceId);

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
      console.log(
        `[ProjectAssignmentService] Found ${options.length} task type options for project ${projectNumber}`
      );
      return options;

    } catch (error) {
      console.error(
        '[ProjectAssignmentService] Error getting task type options:',
        error
      );
      return [];
    }
  }

  // ============================================================================
  // EXISTING: Get duration for a specific task type in a project
  // ✅ UNCHANGED
  // ============================================================================
  public async getDurationForTaskType(
    resourceId: string,
    projectNumber: string,
    taskType: string
  ): Promise<number> {
    try {
      const allAssignments = await this.getActiveProjectAssignments(resourceId);

      const assignment = allAssignments.find(
        a => a.ProjectNumber === projectNumber && a.JobTaskType === taskType
      );

      if (assignment) {
        const duration = parseFloat(assignment.DurationTask) || 0;
        console.log(
          `[ProjectAssignmentService] Duration for ${taskType} in ${projectNumber}: ${duration}h`
        );
        return duration;
      }

      console.warn(
        `[ProjectAssignmentService] No duration found for ${taskType} in ${projectNumber}`
      );
      return 0;

    } catch (error) {
      console.error(
        '[ProjectAssignmentService] Error getting duration for task type:',
        error
      );
      return 0;
    }
  }

  // ============================================================================
  // EXISTING: Get all unique task types for a resource across all projects
  // ✅ UNCHANGED
  // ============================================================================
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
      console.log(
        `[ProjectAssignmentService] Found ${uniqueTaskTypes.length} unique task types`
      );
      return uniqueTaskTypes;

    } catch (error) {
      console.error(
        '[ProjectAssignmentService] Error getting all task types:',
        error
      );
      return [];
    }
  }
}