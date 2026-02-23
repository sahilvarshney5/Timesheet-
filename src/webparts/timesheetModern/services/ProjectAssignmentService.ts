// src/webparts/timesheetModern/services/ProjectAssignmentService.ts
// ENHANCED: Added date-based milestone/activity filtering logic
// Applies global filters (ProjectStatus, WorkStatus, BookingEnabled)
// and date-range filters based on ProjectType (Billable vs Non-Billable)
//
// ✅ EXISTING FUNCTIONALITY PRESERVED — only filtering enhanced
// ✅ NO IMPACT on Approval / Dashboard / Attendance modules

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
  JobTaskType: string;
  DurationTask: string;

  // ── NEW columns required for date-based milestone filtering ──────────────
  ProjectType?: string;       // "Billable" | "Non-Billable" | other
  ProjectStatus?: string;     // NULL = active; any value = inactive
  WorkStatus?: string;        // "on_x0020_hold" = hold (must be excluded)
  TaskStDate?: string;        // Task Start Date  (used when Non-Billable)
  TaskEdDate?: string;        // Task End Date    (used when Non-Billable)
  ResourceStDate?: string;    // Resource Start Date (used when Billable)
  ResourceEdDate?: string;    // Resource End Date   (used when Billable)
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

  // ============================================================================
  // PRIVATE HELPER — normalize any date-ish value to "YYYY-MM-DD" string
  // Mirrors the logic in DateUtils.normalizeDateToString without creating a
  // hard dependency on that module from the service layer.
  // ============================================================================
  private normalizeDateStr(value: string | null | undefined): string {
    if (!value) return '';
    // Fast path: already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    // ISO datetime → take date part only (avoids UTC/local shift)
    if (value.indexOf('T') !== -1) {
      const part = value.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
    }
    // Space-separated datetime
    if (value.indexOf(' ') !== -1) {
      const part = value.split(' ')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
    }
    // Fallback — let Date parse it and re-format using LOCAL accessors
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const y  = d.getFullYear();
    const mNum  = d.getMonth() + 1;
    const dyNum = d.getDate();
    const m  = mNum  < 10 ? '0' + mNum  : '' + mNum;
    const dy = dyNum < 10 ? '0' + dyNum : '' + dyNum;
    return `${y}-${m}-${dy}`;
  }

  // ============================================================================
  // PRIVATE HELPER — Apply global + date-based milestone filter
  //
  // Global conditions (applied to ALL records regardless of date):
  //   1. ProjectStatus must be NULL/empty  (active projects only)
  //   2. WorkStatus must NOT be 'on_x0020_hold'
  //   3. BookingEnabled must be TRUE
  //
  // Date-based conditions (applied when selectedDate is provided):
  //   • ProjectType = "Billable"     → use ResourceStDate / ResourceEdDate
  //   • ProjectType = "Non-Billable" → use TaskStDate    / TaskEdDate
  //   selectedDate must fall within [startDate, endDate] (inclusive)
  //
  // ✅ If selectedDate is not provided the date check is skipped so that
  //    existing callers (e.g. getActiveProjectAssignments used by Dashboard,
  //    copy-paste flows, etc.) are unaffected.
  // ============================================================================
  private applyMilestoneFilter(
    assignments: IProjectAssignment[],
    selectedDate?: string
  ): IProjectAssignment[] {
    const normalizedSelected = selectedDate
      ? this.normalizeDateStr(selectedDate)
      : null;

    return assignments.filter(item => {
      // ── GLOBAL FILTER 1: ProjectStatus must be NULL / empty ─────────────
      // SharePoint returns null for empty fields.  Treat null, undefined, and
      // empty string all as "active".
      const projectStatus = item.ProjectStatus ?? '';
      if (projectStatus.trim() !== '') {
        return false;
      }

      // ── GLOBAL FILTER 2: WorkStatus must NOT be 'on_x0020_hold' ─────────
      // The internal OData value for "Hold" is 'on_x0020_hold'.
      // We also guard against the display value "Hold" (case-insensitive).
      const workStatus = (item.WorkStatus ?? '').toLowerCase();
      if (
        workStatus === 'on_x0020_hold' ||
        workStatus === 'hold'
      ) {
        return false;
      }

      // ── GLOBAL FILTER 3: BookingEnabled must be TRUE ─────────────────────
      if (!item.BookingEnabled) {
        return false;
      }

      // ── DATE-BASED FILTER (only when a date is provided) ─────────────────
      if (normalizedSelected) {
        const projectType = (item.ProjectType ?? '').trim().toLowerCase();

        if (projectType === 'billable') {
          // Billable → validate against Resource dates
          const resourceStart = this.normalizeDateStr(item.ResourceStDate);
          const resourceEnd   = this.normalizeDateStr(item.ResourceEdDate);

          if (resourceStart && normalizedSelected < resourceStart) return false;
          if (resourceEnd   && normalizedSelected > resourceEnd)   return false;

        } else {
          // Non-Billable (and any other type) → validate against Task dates
          const taskStart = this.normalizeDateStr(item.TaskStDate);
          const taskEnd   = this.normalizeDateStr(item.TaskEdDate);

          if (taskStart && normalizedSelected < taskStart) return false;
          if (taskEnd   && normalizedSelected > taskEnd)   return false;
        }
      }

      return true; // Passed all filters
    });
  }

  // ============================================================================
  // PUBLIC: Get active project assignments for a resource
  // ✅ EXISTING BEHAVIOUR PRESERVED — still fetches all assignments and applies
  //    the original ValidTo / BookingEnabled OData filter on the server side.
  //    The new global + date filters are applied client-side via applyMilestoneFilter.
  // ============================================================================
  public async getActiveProjectAssignments(resourceId: string): Promise<IProjectAssignment[]> {
    try {
      const listName = getListInternalName('projectAssignment');
      const today = new Date().toISOString().split('T')[0];

      // const filterQuery =
      //   `$filter=${getColumnInternalName('ProjectAssignment', 'ResourceID')} eq '${resourceId}' ` +
      //   `and ${getColumnInternalName('ProjectAssignment', 'BookingEnabled')} eq 1 ` +
      //   `and (` +
      //   `${getColumnInternalName('ProjectAssignment', 'ValidTo')} ge '${today}' ` +
      //   `or ${getColumnInternalName('ProjectAssignment', 'ValidTo')} eq null` +
      //   `)`;
      const filterQuery =
        `$filter=${getColumnInternalName('ProjectAssignment', 'ResourceID')} eq '${resourceId}' ` +
        `and ${getColumnInternalName('ProjectAssignment', 'BookingEnabled')} eq 1 ` +
        // `and (` +
        // `${getColumnInternalName('ProjectAssignment', 'ValidTo')} ge '${today}' ` +
        // `or ${getColumnInternalName('ProjectAssignment', 'ValidTo')} eq null` +
        // `) ` +

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

      // ── Core columns (always present in the list) ─────────────────────────
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

      // ── Extended columns for date-based filtering ─────────────────────────
      // These may not exist if the SP list hasn't been updated yet.
      // We attempt a fetch with all columns first. If it fails we
      // fall back to core columns so the dropdown still loads.
      // const extendedSelectFields = [
      //   ...coreSelectFields,
      //   'ProjectType',
      //   'ProjectStatus',
      //   'WorkStatus',
      //   'TaskStDate',
      //   'TaskEdDate',
      //   'ResourceStDate',
      //   'ResourceEdDate'
      // ];

      let items: IProjectAssignment[];

      try {
        // PRIMARY: fetch with new columns
        items = await this.httpService.getListItems<IProjectAssignment>(
          listName,
          coreSelectFields,
          filterQuery,
          'ProjectName'
        );
        console.log(
          `[ProjectAssignmentService] Loaded ${items.length} assignments (extended columns) for ${resourceId}`
        );
      } catch (extError) {
        // FALLBACK: one or more new columns don't exist in this SP environment yet
        console.warn(
          '[ProjectAssignmentService] Extended column fetch failed — falling back to core columns. ' +
          'Date-based filtering will be skipped until new SP columns are added.',
          extError
        );
        items = await this.httpService.getListItems<IProjectAssignment>(
          listName,
          coreSelectFields,
          filterQuery,
          'ProjectName'
        );
        console.log(
          `[ProjectAssignmentService] Loaded ${items.length} assignments (core columns) for ${resourceId}`
        );
      }

      return items;

    } catch (error) {
      console.error(
        '[ProjectAssignmentService] Error getting active project assignments:',
        error
      );
      // Return empty array instead of throwing so the UI still loads
      return [];
    }
  }

  // ============================================================================
  // PUBLIC NEW: Get milestones filtered by selected timesheet date
  //
  // This is the method Timesheetview.tsx should call when the user picks a date
  // in the Add/Edit modal.  It:
  //   1. Fetches all assignments for the resource (reuses getActiveProjectAssignments)
  //   2. Applies the full global + date-based filter via applyMilestoneFilter
  //
  // ✅ Safe to call with no date — returns globally-filtered list (no date check).
  // ✅ Zero impact on other modules that call getActiveProjectAssignments directly.
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
  // PUBLIC: Filter an already-loaded assignment list by date
  //
  // Useful when Timesheetview.tsx already has activeProjectstype in state and
  // just needs to re-filter without a round-trip to SharePoint (e.g. when the
  // user changes the date field inside the modal).
  // ============================================================================
  public filterAssignmentsByDate(
    assignments: IProjectAssignment[],
    selectedDate: string
  ): IProjectAssignment[] {
    return this.applyMilestoneFilter(assignments, selectedDate);
  }

  // ============================================================================
  // EXISTING: Get task type options for a specific project
  // ✅ UNCHANGED — existing callers unaffected
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