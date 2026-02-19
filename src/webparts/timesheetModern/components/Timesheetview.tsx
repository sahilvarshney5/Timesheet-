// // ============================================================================
// // FIXED: Past dates now enabled for timesheet entry
// // CHANGE: isDateDisabled function now ONLY blocks future dates
// // ============================================================================

// // Find this function around line 548 in Timesheetview.tsx and REPLACE it:

// /**
//  * Check if a date should be disabled in the date picker
//  * Rule: Only FUTURE dates are disabled (past + today = enabled)
//  * 
//  * ✅ FIXED: This function was incorrectly blocking past dates
//  * ✅ NOW: Only blocks dates AFTER today (future dates only)
//  */
// const isDateDisabled = (date: Date | null | undefined): boolean => {
//   if (!date) return false;

//   // ✅ FIX: Get today at midnight (ignore time)
//   const today = new Date();
//   today.setHours(0, 0, 0, 0);

//   // ✅ FIX: Get comparison date at midnight
//   const checkDate = new Date(date);
//   checkDate.setHours(0, 0, 0, 0);

//   // ✅ FIX: ONLY disable if date is AFTER today (future dates only)
//   // CHANGED FROM: checkDate !== today (was blocking past dates)
//   // CHANGED TO: checkDate > today (only blocks future)
//   return checkDate > today;
// };

// // ============================================================================
// // ALSO FIX: Date input onChange handler (around line 555)
// // ============================================================================

// // REPLACE the date input onChange handler in the modal form:

// <input 
//   type="date" 
//   className={styles.formInput}
//   value={formData.date}
//   max={getTodayString()} // ✅ This is correct - prevents future selection in native picker
//   onChange={(e) => {
//     const selectedDate = new Date(e.target.value + 'T00:00:00');

//     // ✅ FIX: Only validate FUTURE dates, allow past dates
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);

//     const checkDate = new Date(selectedDate);
//     checkDate.setHours(0, 0, 0, 0);

//     // ✅ CHANGED: Only block if AFTER today (not equal to today)
//     if (checkDate > today) {
//       alert('Cannot select future dates. Please select today or a past date.');
//       return;
//     }

//     // ✅ Allow: today OR past dates
//     handleInputChange('date', e.target.value);
//   }}
//   required
// />

// // ============================================================================
// // VALIDATION SUMMARY
// // ============================================================================

// /**
//  * Date Validation Logic (CORRECTED):
//  * 
//  * ✅ PAST DATES → Allowed (can fill timesheet)
//  * ✅ TODAY → Allowed (can fill timesheet)
//  * ❌ FUTURE DATES → Blocked (cannot fill timesheet)
//  * 
//  * Implementation:
//  * 1. isDateDisabled(date) → returns true ONLY if date > today
//  * 2. max={getTodayString()} → native HTML5 date picker limit
//  * 3. onChange validation → alert if user tries to select future date
//  */


// Timesheetview.tsx
// FIXED: Added missing helper functions (isWeekend, getDayStatus)
// All date comparisons now use normalized YYYY-MM-DD format

import * as React from 'react';
import styles from './TimesheetModern.module.scss';
import { SPHttpClient } from '@microsoft/sp-http';
import { TimesheetService } from '../services/TimesheetService';
import { ProjectTaskService, IProjectTask } from '../services/ProjectTaskService';
import { ProjectAssignmentService, IProjectAssignment, ITaskTypeOption } from '../services/ProjectAssignmentService'; // FIXED: Import added
import { AttendanceService } from '../services/AttendanceService'; // FIXED: Import added
import { HolidayService } from '../services/HolidayService'; // Holiday blocking
import { IEmployeeMaster, ITimesheetHeader, IPunchData } from '../models';
import {
  normalizeDateToString,
  formatDateForDisplay,
  isToday as checkIsToday,
  getWeekDays,
  getTodayString,
  // START: 30 days restriction
  getMinAllowedDate,
  isOlderThan30Days
  // END: 30 days restriction
} from '../utils/DateUtils';


interface ITimesheetEntry {
  id: number;
  date: string; // Always normalized to YYYY-MM-DD
  project: string; // Project Number (e.g., "PRJ001")
  projectName: string; // NEW: Project Name for display
  hours: number;
  taskType: string; // Task/Milestone name
  taskNumber: string; // NEW: Task Number
  description: string;
}

export interface ITimesheetViewProps {
  onViewChange: (viewName: string, data?: any) => void;
  spHttpClient: SPHttpClient;
  siteUrl: string;
  currentUserDisplayName: string;
  employeeMaster: IEmployeeMaster;
  userRole: 'Admin' | 'Manager' | 'Member';
  navigationData?: any; // Optional navigation context for passing data between views
}


const TimesheetView: React.FC<ITimesheetViewProps> = (props) => {
  const { spHttpClient, siteUrl } = props;

  // OLD LOGIC COMMENTED – Replaced with TotalHours logic
  // const MAX_DAILY_HOURS = 8;

  // ============================================================================
  // REQUIREMENT 2: Dynamic daily limit from Punch Data TotalHours
  // MAX_DAILY_HOURS is now used only as a fallback when punch data is unavailable
  // ============================================================================
  const MAX_DAILY_HOURS_FALLBACK = 8; // Fallback only – used when no punch data found

  const MAX_WEEKLY_HOURS = 40; // Kept for reference – no longer used for blocking (REQ 3)

  // Services
  const timesheetService = React.useMemo(
    () => new TimesheetService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  const projectAssignmentService = React.useMemo(
    () => new ProjectAssignmentService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  // FIXED: Add attendance service for validation
  const attendanceService = React.useMemo(
    () => new AttendanceService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  const holidayService = React.useMemo(
    () => new HolidayService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );
  // Add service and state
  const projectTaskService = React.useMemo(
    () => new ProjectTaskService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  const [activeProjects, setActiveProjects] = React.useState<IProjectTask[]>([]);
  // State management
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);
  const [entries, setEntries] = React.useState<ITimesheetEntry[]>([]);
  const [editingEntry, setEditingEntry] = React.useState<ITimesheetEntry | null>(null);
  const [currentWeekOffset, setCurrentWeekOffset] = React.useState<number>(0);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [clipboard, setClipboard] = React.useState<ITimesheetEntry | null>(null);
  // In Timesheetview.tsx

  const [timesheetStatus, setTimesheetStatus] = React.useState<'Draft' | 'Submitted' | 'Approved'>('Draft');
  const [activeProjectstype, setActiveProjectstype] = React.useState<IProjectAssignment[]>([]);
  const [availableTaskTypes, setAvailableTaskTypes] = React.useState<ITaskTypeOption[]>([]);
  const [selectedProjectNumber, setSelectedProjectNumber] = React.useState<string>('');
  const [currentTimesheetHeader, setCurrentTimesheetHeader] = React.useState<ITimesheetHeader | null>(null);
  // Form state
  const [formData, setFormData] = React.useState({
    date: '',
    project: '',
    hours: 0,
    taskType: 'Development',
    description: ''
  });
const [filteredMilestones, setFilteredMilestones] = React.useState<IProjectAssignment[]>([]);
  // ✅ Real attendance status map for the current week: date (YYYY-MM-DD) → status
  const [weekAttendanceMap, setWeekAttendanceMap] = React.useState<Map<string, 'present' | 'absent' | 'leave' | 'holiday' | 'weekend'>>(new Map());

  // ============================================================================
  // REQUIREMENT 2 & 3: Punch hours map – date (YYYY-MM-DD) → TotalHours from Punch Data
  // This replaces the fixed 8-hour daily cap with actual punch hours per day.
  // ============================================================================
  const [weekPunchHoursMap, setWeekPunchHoursMap] = React.useState<Map<string, number>>(new Map());

  // ============================================================================
  // VALIDATION HELPERS
  // ============================================================================

  /**
   * Convert hours to minutes (kept for backward compatibility with paste/copy checks)
   * ISSUE 2 FIX: Use Math.round to avoid floating point drift, but all NEW validations
   * below use parseFloat-based decimal comparison directly (not minute integers).
   */
  const convertToMinutes = (hours: number): number => {
    return Math.round(hours * 60);
  };

  /**
   * ISSUE 2 FIX: Calculate total hours (as decimal float) for a specific date.
   * OLD LOGIC COMMENTED – Previously used convertToMinutes (integer math) which
   * lost precision for small decimals like 0.1, 0.2, 0.3.
   * OLD: return entries.filter(...).reduce((total, e) => total + convertToMinutes(e.hours), 0);
   * ✅ NEW: Sum raw parseFloat hours directly to preserve decimal precision.
   */
  const getTotalHoursForDateDecimal = (date: string, excludeEntryId?: number): number => {
    return entries
      .filter(e => e.date === date && e.id !== excludeEntryId)
      .reduce((total, e) => {
        const h = parseFloat(String(e.hours)) || 0;
        return Math.round((total + h) * 100) / 100; // Round to 2dp to avoid float drift
      }, 0);
  };

  /**
   * Keep getTotalMinutesForDate for any legacy internal use (copy/paste block checks).
   * Not used for primary validation anymore (see handleInputChange and handleSubmit).
   */
  const getTotalMinutesForDate = (date: string, excludeEntryId?: number): number => {
    return entries
      .filter(e => e.date === date && e.id !== excludeEntryId)
      .reduce((total, e) => total + convertToMinutes(e.hours), 0);
  };

  // ============================================================================
  // REQUIREMENT 2: Get daily limit in MINUTES from Punch Data TotalHours
  // OLD LOGIC COMMENTED – Replaced with TotalHours logic
  // const getRemainingMinutes = (date: string, excludeEntryId?: number): number => {
  //   const used = getTotalMinutesForDate(date, excludeEntryId);
  //   return Math.max(0, 480 - used); // 480 minutes = 8 hours (FIXED 8h cap – OLD)
  // };
  // ============================================================================

  /**
   * REQUIREMENT 2: Get daily limit in HOURS (decimal) using Punch Data TotalHours.
   * ISSUE 2 FIX: Renamed from getDailyLimitMinutes to getDailyLimitHours to use
   * decimal float comparison directly. This prevents precision loss for small decimals.
   * Falls back to MAX_DAILY_HOURS_FALLBACK (8h) when no punch data is available.
   */
  const getDailyLimitHours = (date: string): number => {
    const punchHours = weekPunchHoursMap.get(date);
    if (punchHours !== undefined && punchHours > 0) {
      return parseFloat(punchHours.toFixed(2)); // Punch Data TotalHours as decimal
    }
    // Fallback: no punch record found for this date
    return MAX_DAILY_HOURS_FALLBACK;
  };

  /**
   * ISSUE 2 FIX: getDailyLimitMinutes kept for UI display helpers and legacy references.
   * Uses getDailyLimitHours internally.
   */
  const getDailyLimitMinutes = (date: string): number => {
    return Math.round(getDailyLimitHours(date) * 60);
  };

  /**
   * REQUIREMENT 2: Get remaining hours available for a date based on TotalHours.
   * ISSUE 2 FIX: Uses decimal hour comparison (not integer minutes) to preserve precision.
   */
  const getRemainingHours = (date: string, excludeEntryId?: number): number => {
    const used = getTotalHoursForDateDecimal(date, excludeEntryId);
    const limitHours = getDailyLimitHours(date);
    return Math.max(0, Math.round((limitHours - used) * 100) / 100);
  };

  /**
   * REQUIREMENT 2: Get remaining minutes available for a date based on TotalHours.
   * Kept for backward compatibility with progress bar / button disable checks.
   */
  const getRemainingMinutes = (date: string, excludeEntryId?: number): number => {
    const used = getTotalMinutesForDate(date, excludeEntryId);
    const limitMinutes = getDailyLimitMinutes(date);
    return Math.max(0, limitMinutes - used);
  };

  /**
   * Check if date is in the future
   */
  const isFutureDate = (dateString: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkDate = new Date(dateString + 'T00:00:00');
    checkDate.setHours(0, 0, 0, 0);

    return checkDate > today;
  };

  // Load projects on mount
  React.useEffect(() => {
    const loadProjects = async (): Promise<void> => {
      try {
        const projects = await projectTaskService.getActiveProjects(
          props.employeeMaster.EmployeeID
        );
        // ✅ DEDUPLICATION: Remove duplicate projects based on ProjectID
        const uniqueProjects = Array.from(
          new Map(projects.map(p => [p.ProjectID || p.ProjectNumber, p])).values()
        );
        setActiveProjects(uniqueProjects);
      } catch (error) {
        console.error('[TimesheetView] Error loading projects:', error);
      }
    };

    loadProjects().catch(console.error);
  }, [props.employeeMaster.EmployeeID]);
  React.useEffect(() => {
    const loadProjectAssignments = async () => {
      const projects = await projectAssignmentService.getActiveProjectAssignments(
        props.employeeMaster.EmployeeID
      );
      setActiveProjectstype(projects);
    };
    void loadProjectAssignments();
  }, [props.employeeMaster.EmployeeID]);
  // ============================================================================
  // HELPER FUNCTIONS - DEFINED FIRST
  // ============================================================================

  // FIXED: Helper function to check if date is weekend
  const isWeekend = (dateString: string): boolean => {
    const date = new Date(dateString + 'T00:00:00');
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
  };

  // Real getDayStatus - reads from loaded attendance map for the week
  const getDayStatus = (dateString: string): 'present' | 'absent' | 'leave' | 'holiday' | 'weekend' | null => {
    if (isWeekend(dateString)) {
      return 'weekend';
    }
    // Return real status from attendance map if loaded
    const mappedStatus = weekAttendanceMap.get(dateString);
    if (mappedStatus) {
      return mappedStatus;
    }
    // For future/unknown dates default to null (not blocking)
    if (isFutureDate(dateString)) {
      return null;
    }
    // Past working day with no punch record → absent
    return 'absent';
  };

  const getCurrentWeekDays = React.useCallback((): string[] => {
    const today = new Date();
    const adjustedDate = new Date(today);
    adjustedDate.setDate(today.getDate() + (currentWeekOffset * 7));

    return getWeekDays(adjustedDate);
  }, [currentWeekOffset]);
  const handleProjectChange = async (projectNumber: string) => {
    setSelectedProjectNumber(projectNumber);

    if (projectNumber) {
      const taskTypes = await projectAssignmentService.getTaskTypeOptionsForProject(
        props.employeeMaster.EmployeeID,
        projectNumber
      );
      setAvailableTaskTypes(taskTypes);
    }
  };

  const handleTaskTypeChange = (taskType: string) => {
    const selectedTask = availableTaskTypes.find(t => t.taskType === taskType);

    if (selectedTask) {
      setFormData(prev => ({
        ...prev,
        taskType: taskType,
        hours: selectedTask.duration  // ✅ Auto-populate!
      }));
    }
  };
  const loadTimesheetData = React.useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);

      const weekDays = getCurrentWeekDays();
      const startDate = weekDays[0];
      const endDate = weekDays[6];
      const empId = props.employeeMaster.EmployeeID;

      console.log(`[TimesheetView] Loading timesheet for Employee ID: ${empId}, Week: ${startDate} to ${endDate}`);

      // getTimesheetHeader returns ITimesheetHeader[] — take the first element safely.
      const loadHeaders = await timesheetService.getTimesheetHeader(empId, startDate, endDate);
      let timesheetHeader: ITimesheetHeader | null =
        loadHeaders && loadHeaders.length > 0 ? loadHeaders[0] : null;

      // Access .Status only after null-check (fixes TS2339 on ITimesheetHeader[])
      if (timesheetHeader) {
        setTimesheetStatus(timesheetHeader.Status as 'Draft' | 'Submitted' | 'Approved');
      }

      // No header found — create one (returns single ITimesheetHeader)
      if (!timesheetHeader) {
        timesheetHeader = await timesheetService.createTimesheetHeader(empId, startDate);
        console.log(`[TimesheetView] Created new timesheet header with ID: ${timesheetHeader.Id}`);
      }

      // Store in state — type is now ITimesheetHeader | null, matching useState type (fixes TS2345)
      setCurrentTimesheetHeader(timesheetHeader);

      // Null + undefined guard before accessing .Id (fixes TS18047, TS2339)
      if (!timesheetHeader || timesheetHeader.Id === undefined) {
        throw new Error('[TimesheetView] loadTimesheetData: Timesheet header missing Id');
      }

      const lines = await timesheetService.getTimesheetLines(timesheetHeader.Id);

      // Map lines to entries with project names
      const convertedEntries: ITimesheetEntry[] = await Promise.all(
        lines.map(async (line) => {
          const projectNumber = line.ProjectNo || line.ProjectNumber || '';
          const taskNumber = line.TaskNo || '';

          // Find project name from active projects
          const project = activeProjects.find(p => p.ProjectNumber === projectNumber);
          const projectName = project ? project.ProjectName : projectNumber;

          // Find task name from active project assignments
          const taskAssignment = activeProjectstype.find(
            t => t.ProjectNumber === projectNumber && t.TaskNumber === taskNumber
          );
          const taskName = taskAssignment ? taskAssignment.TaskName : taskNumber;

          return {
            id: line.Id!,
            date: line.WorkDate || line.EntryDate || '',
            project: projectNumber,
            projectName: projectName,
            hours: line.HoursBooked || line.Hours || 0,
            taskType: line.TaskName,
            taskNumber: taskNumber,
            description: line.Description || line.Comments || ''
          };
        })
      );

      setEntries(convertedEntries);

      // ✅ Load real attendance status for every day in this week
      try {
        const [punchRecords, leaveRecords, holidayRecords] = await Promise.all([
          attendanceService.getPunchData(empId, startDate, endDate),
          attendanceService.getLeaveData(empId, startDate, endDate),
          holidayService.getActiveHolidays()
        ]);

        // Build holiday date set (normalize to YYYY-MM-DD)
        const holidayDateSet = new Set<string>();
        holidayRecords.forEach(h => {
          const d = h.HolidayDate ? h.HolidayDate.split('T')[0] : '';
          if (d) holidayDateSet.add(d);
        });

        const attendanceMap = new Map<string, 'present' | 'absent' | 'leave' | 'holiday' | 'weekend'>();

        // Step 1: Mark all weekdays as absent by default
        weekDays.forEach(dateStr => {
          if (!isWeekend(dateStr) && !isFutureDate(dateStr)) {
            attendanceMap.set(dateStr, 'absent');
          }
        });

        // Step 2: Mark present days from punch data (use PunchDate for date matching)
        punchRecords.forEach(punch => {
          const punchDateStr = punch.PunchDate
            ? punch.PunchDate.split('T')[0]
            : punch.AttendanceDate;
          if (punchDateStr && (punch.PunchIn || punch.Status === 'Synced')) {
            attendanceMap.set(punchDateStr, 'present');
          }
        });

        // Step 3: Mark leave days — compare YYYY-MM-DD strings to avoid timezone mutation bugs
        leaveRecords.forEach(leave => {
          const leaveStartStr = leave.StartDate ? leave.StartDate.split('T')[0] : '';
          const leaveEndStr = leave.EndDate ? leave.EndDate.split('T')[0] : '';
          weekDays.forEach(dateStr => {
            if (dateStr >= leaveStartStr && dateStr <= leaveEndStr && leave.Status !== 'Rejected') {
              attendanceMap.set(dateStr, 'leave');
            }
          });
        });

        // Step 4: Mark holidays LAST — holidays override everything (present, leave, absent)
        weekDays.forEach(dateStr => {
          if (holidayDateSet.has(dateStr)) {
            attendanceMap.set(dateStr, 'holiday');
          }
        });

        setWeekAttendanceMap(attendanceMap);
        console.log('[TimesheetView] Attendance map loaded, entries:', attendanceMap.size);

        // ====================================================================
        // REQUIREMENT 2 & 3: Build punch hours map from Punch Data TotalHours.
        // Maps each date → TotalHours fetched from Punch Data list.
        // This replaces the fixed 8-hour daily cap per day.
        // OLD LOGIC COMMENTED – Replaced with TotalHours logic
        // (Previously no per-day punch hours map existed; daily cap was hardcoded to 8h)
        // ====================================================================
        const punchHoursMap = new Map<string, number>();
        punchRecords.forEach((punch: IPunchData) => {
          // Normalize date to YYYY-MM-DD for reliable key matching
          const punchDateStr = punch.PunchDate
            ? punch.PunchDate.split('T')[0]
            : punch.AttendanceDate;
          if (punchDateStr) {
            // Use TotalHours from Punch Data; default to 0 if absent/null
            const totalHours = (punch.TotalHours !== undefined && punch.TotalHours !== null)
              ? punch.TotalHours
              : 0;
            punchHoursMap.set(punchDateStr, totalHours);
          }
        });
        setWeekPunchHoursMap(punchHoursMap);
        console.log('[TimesheetView] Punch hours map built, entries:', punchHoursMap.size);
        // ====================================================================
        // END REQUIREMENT 2 & 3 punch hours map
        // ====================================================================

      } catch (attendanceErr) {
        console.warn('[TimesheetView] Could not load attendance data for status check:', attendanceErr);
        // Non-fatal: keep existing map (does not break timesheet loading)
      }

      console.log(`[TimesheetView] Loaded ${convertedEntries.length} timesheet entries`);

    } catch (error) {
      console.error('[TimesheetView] Error loading timesheet data:', error);
      alert('Failed to load timesheet data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [getCurrentWeekDays, props.employeeMaster.EmployeeID, timesheetService]);

  React.useEffect(() => {
    loadTimesheetData().catch(err => {
      console.error('[TimesheetView] Effect error:', err);
    });
  }, [currentWeekOffset, loadTimesheetData]);

  const getWeekRangeText = (): string => {
    const weekDays = getCurrentWeekDays();
    const startDate = new Date(weekDays[0] + 'T00:00:00');
    const endDate = new Date(weekDays[6] + 'T00:00:00');

    const options = { month: 'short', day: 'numeric' } as const;
    const startStr = startDate.toLocaleDateString('en-US', options);
    const endStr = endDate.toLocaleDateString('en-US', options);

    let weekText = `Week of ${startStr}-${endStr}, ${startDate.getFullYear()}`;

    if (currentWeekOffset < 0) {
      weekText += ` (Previous Week)`;
    } else if (currentWeekOffset > 0) {
      weekText += ` (Future Week)`;
    } else {
      weekText += ` (Current Week)`;
    }

    return weekText;
  };
  // Helper function
  const isReadOnly = (): boolean => {
    return timesheetStatus === 'Submitted' || timesheetStatus === 'Approved';
  };

  const handleChangeWeek = (direction: number): void => {
    setWeekAttendanceMap(new Map()); // clear stale attendance data before loading new week
    // ====================================================================
    // REQUIREMENT 2 & 3: Clear punch hours map when changing week
    // ====================================================================
    setWeekPunchHoursMap(new Map());
    setCurrentWeekOffset(prev => prev + direction);
  };

  const validateTimesheetDate = async (date: string): Promise<{ isValid: boolean; message: string }> => {
    const normalizedDate = normalizeDateToString(date);

    if (isWeekend(normalizedDate)) {
      return {
        isValid: false,
        message: 'Cannot add timesheet entry for weekends (Saturday/Sunday)'
      };
    }

    // Check real attendance status from loaded map
    const dayStatus = getDayStatus(normalizedDate);

    if (dayStatus === 'absent') {
      return {
        isValid: false,
        message: 'You are absent, you cannot fill timesheet for this day'
      };
    }

    if (dayStatus === 'leave') {
      return {
        isValid: false,
        message: 'You are on leave for this day, timesheet entry not allowed'
      };
    }

    if (dayStatus === 'holiday') {
      return {
        isValid: false,
        message: 'Cannot add timesheet entry for holidays'
      };
    }

    return { isValid: true, message: '' };
  };

  const handleAddEntry = async (date?: string): Promise<void> => {
  
  const weekDays = getCurrentWeekDays();
  const normalizedDate = date ? normalizeDateToString(date) : weekDays[0];

  // ✅ FIX: Block future dates (silently)
  const today = getTodayString();
  if (normalizedDate > today) {
    return; // Silently block - no alert
  }
  const validation = await validateTimesheetDate(normalizedDate);

  if (!validation.isValid) {
    alert(validation.message);
    return;
  }

  // ✅ RESET: Clear filtered milestones on modal open
  setFilteredMilestones([]);
  setAvailableTaskTypes([]);

  setFormData({
    date: normalizedDate,
    project: '',
    hours: 0,
    taskType: '', // ✅ CHANGED: Start with empty milestone
    description: ''
  });
  setIsModalOpen(true);
};

 const handleEditEntry = (entry: ITimesheetEntry): void => {
  setEditingEntry(entry);
  
  // ✅ FILTER MILESTONES: Pre-populate filtered milestones for editing
  if (entry.project) {
    const filteredTasks = activeProjectstype.filter(
      task => task.ProjectNumber === entry.project
    );
    setFilteredMilestones(filteredTasks);
    
    setAvailableTaskTypes(filteredTasks.map(task => ({
      taskType: task.TaskName,
      duration: parseFloat(task.DurationTask || '0'),
      projectNumber: task.ProjectNumber,
      taskNumber: task.TaskNumber
    })));
  } else {
    setFilteredMilestones([]);
    setAvailableTaskTypes([]);
  }
  
  setFormData({
    date: entry.date,
    project: entry.project,
    hours: entry.hours,
    taskType: entry.taskType,
    description: entry.description
  });
  setIsModalOpen(true);
};

const handleCloseModal = (): void => {
  setIsModalOpen(false);
  setEditingEntry(null);
  
  // ✅ RESET: Clear filtered milestones on modal close
  setFilteredMilestones([]);
  setAvailableTaskTypes([]);
  
  setFormData({
    date: '',
    project: '',
    hours: 0,
    taskType: '', // ✅ CHANGED: Clear milestone
    description: ''
  });
};

  const handleInputChange = (field: string, value: unknown): void => {
  // VALIDATION: Future date check (NO ALERT - just block)
  if (field === 'date' && typeof value === 'string' && isFutureDate(value)) {
    return; // Silently block future dates
  }
  
  // NEW: Project change - filter milestones
if (field === 'project' && typeof value === 'string') {
  setSelectedProjectNumber(value);
  
  // ✅ FILTER MILESTONES: Only show milestones for selected project
  if (value) {
    const filteredTasks = activeProjectstype.filter(
      task => task.ProjectNumber === value
    );
    
    // ✅ UPDATE: Set filtered milestones state
    setFilteredMilestones(filteredTasks);
    
    setAvailableTaskTypes(filteredTasks.map(task => ({
      taskType: task.TaskName,
      duration: parseFloat(task.DurationTask || '0'),
      projectNumber: task.ProjectNumber,
      taskNumber: task.TaskNumber
    })));
    
    // Reset taskType when project changes
    setFormData(prev => ({
      ...prev,
      project: value,
      taskType: '', // Reset task selection
      hours: 0 // Reset hours
    }));
    return;
  } else {
    // ✅ CLEAR: No project selected → clear filtered milestones
    setFilteredMilestones([]);
    setAvailableTaskTypes([]);
  }
}
  
  // NEW: Task type change - auto-populate hours
  if (field === 'taskType' && typeof value === 'string') {
    const selectedTask = availableTaskTypes.find(t => t.taskType === value);
    
    if (selectedTask) {
      setFormData(prev => ({
        ...prev,
        taskType: value,
        hours: selectedTask.duration // Auto-populate duration
      }));
      return;
    }
  }
  
  // ============================================================================
  // REQUIREMENT 2: Validate hours against Punch Data TotalHours (not fixed 8h)
  // OLD LOGIC COMMENTED – Replaced with TotalHours logic
  // if (field === 'hours') {
  //   const newMinutes = convertToMinutes(value as number);
  //   const currentDate = formData.date;
  //   if (currentDate) {
  //     const usedMinutes = getTotalMinutesForDate(currentDate, editingEntry?.id);
  //     const totalMinutes = usedMinutes + newMinutes;
  //     // Block if exceeds 480 minutes (8 hours) – OLD FIXED 8H CAP
  //     if (totalMinutes > 480) {
  //       console.log('[Validation] Cannot exceed 8 hours per day');
  //       return; // Block the change
  //     }
  //   }
  // }
  // ============================================================================
  // ISSUE 2 FIX: Use decimal float comparison (not integer minutes) so that
  // small decimals like 0.1, 0.2, 0.3 are correctly validated.
  // OLD LOGIC COMMENTED – Previously used convertToMinutes() which lost precision:
  // const newMinutes = convertToMinutes(value as number);   // ❌ OLD – integer rounding
  // const usedMinutes = getTotalMinutesForDate(...);        // ❌ OLD – integer sum
  // const totalMinutes = usedMinutes + newMinutes;          // ❌ OLD – compared as integers
  // ✅ NEW: All math is parseFloat-based decimal arithmetic.
  if (field === 'hours') {
    // ISSUE 2 FIX: parseFloat preserves decimal precision (0.1, 0.2, 0.3 all valid)
    const newHours = parseFloat(String(value)) || 0;
    const currentDate = formData.date;

    if (currentDate && newHours > 0) {
      const usedHours = getTotalHoursForDateDecimal(currentDate, editingEntry?.id);
      const totalHours = Math.round((usedHours + newHours) * 100) / 100;
      const limitHours = getDailyLimitHours(currentDate); // TotalHours from Punch Data

      if (totalHours > limitHours) {
        const remaining = Math.round((limitHours - usedHours) * 100) / 100;
        console.log(`[Validation] Cannot exceed Punch Hours (${limitHours.toFixed(2)}h) per day. Remaining: ${remaining.toFixed(2)}h`);
        return; // Block the change silently – alert shown on submit
      }
    }
  }
  
  setFormData(prev => ({
    ...prev,
    [field]: value
  }));
};

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();

    try {
      setIsLoading(true);

      const normalizedDate = normalizeDateToString(formData.date);

      // VALIDATION: Final safety check before save
      // 1. Check future date
      if (isFutureDate(normalizedDate)) {
        setIsLoading(false);
        return; // Silently block
      }
      if (isOlderThan30Days(formData.date)) {
        alert('Cannot create timesheet entry for dates older than 30 days. Please select a date within the last 30 days.');
        return;
      }

      // ====================================================================
      // REQUIREMENT 2: Validate against Punch Data TotalHours (not fixed 8h)
      // OLD LOGIC COMMENTED – Replaced with TotalHours logic
      // // 2. Check 8-hour limit
      // const newMinutes = convertToMinutes(formData.hours);
      // const usedMinutes = getTotalMinutesForDate(normalizedDate, editingEntry?.id);
      // const totalMinutes = usedMinutes + newMinutes;
      // if (totalMinutes > 480) {
      //   console.log('[Validation] Save blocked: Exceeds 8 hour daily limit');
      //   alert('Cannot save entry: Exceeds 8 hour limit for the day.');
      //   setIsLoading(false);
      //   return; // Block save - DO NOT call API
      // }
      // ====================================================================
      // ISSUE 2 FIX: Use decimal float comparison so that small values like
      // 0.1, 0.2, 0.3 are accepted and only blocked when total > punchTotalHours.
      // OLD LOGIC COMMENTED – Previously: convertToMinutes() caused integer rounding:
      // const newMinutes = convertToMinutes(formData.hours);   // ❌ OLD – integer math
      // const limitMinutes = getDailyLimitMinutes(normalizedDate);  // ❌ OLD – integer limit
      // ✅ NEW: All comparison in parseFloat decimal hours.
      const newHours = parseFloat(String(formData.hours)) || 0;
      const usedHours = getTotalHoursForDateDecimal(normalizedDate, editingEntry?.id);
      const totalHours = Math.round((usedHours + newHours) * 100) / 100;
      const limitHours = getDailyLimitHours(normalizedDate); // Punch Data TotalHours

      if (totalHours > limitHours) {
        console.log(`[Validation] Save blocked: Exceeds Punch Hours (${limitHours.toFixed(2)}h) for the day`);
        // REQUIREMENT 2: Show validation message with actual TotalHours from Punch Data
        alert(`You cannot enter more than your Punch Hours (${limitHours.toFixed(2)}h) for this day.`);
        setIsLoading(false);
        return; // Block save - DO NOT call API
      }
      // ====================================================================
      // END REQUIREMENT 2 validation
      // ====================================================================

      const validation = await validateTimesheetDate(normalizedDate);

      if (!validation.isValid) {
        alert(validation.message);
        setIsLoading(false);
        return;
      }

      const empId = props.employeeMaster.EmployeeID;
      const weekDays = getCurrentWeekDays();
      const startDate = weekDays[0];
      const endDate = weekDays[6];

      // getTimesheetHeader returns ITimesheetHeader[] — take the first element safely.
      const submitHeaders = await timesheetService.getTimesheetHeader(empId, startDate, endDate);
      let timesheetHeader: ITimesheetHeader | null =
        submitHeaders && submitHeaders.length > 0 ? submitHeaders[0] : null;

      // No header found — create one (returns single ITimesheetHeader, fixes TS2740)
      if (!timesheetHeader) {
        timesheetHeader = await timesheetService.createTimesheetHeader(empId, startDate);
      }

      // Null + undefined guard before accessing .Id (fixes TS18047, TS2339)
      if (!timesheetHeader || timesheetHeader.Id === undefined) {
        throw new Error('[TimesheetView] handleSubmit: Timesheet header missing Id');
      }

      if (editingEntry) {
        await timesheetService.updateTimesheetLine(editingEntry.id, {
          WorkDate: normalizedDate,
          ProjectNo: formData.project,
          HoursBooked: formData.hours,
          Description: formData.description,
          TaskName: formData.taskType
        });

        alert(`✓ Entry updated successfully!\n${formData.hours}h for ${formData.project}`);
      } else {
        await timesheetService.createTimesheetLine({
          TimesheetID: timesheetHeader.Id,
          WorkDate: normalizedDate,
          ProjectNo: formData.project,
          TaskNo: '',
          HoursBooked: formData.hours,
          Description: formData.description,
          TaskName: formData.taskType
        });

        alert(`✓ Entry added successfully!\n${formData.hours}h for ${formData.project}`);
      }

      await loadTimesheetData();

      setEditingEntry(null);
      setFormData({
        date: normalizedDate,
        project: '',
        hours: 0,
        taskType: 'Development',
        description: ''
      });

    } catch (error) {
      console.error('[TimesheetView] Error saving entry:', error);
      alert('Error saving timesheet entry. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEntry = async (entryId: number): Promise<void> => {
    if (confirm('Are you sure you want to delete this timesheet entry?')) {
      try {
        setIsLoading(true);

        const deletedEntry = entries.find(e => e.id === entryId);

        await timesheetService.deleteTimesheetLine(entryId);
        setEntries(prev => prev.filter(e => e.id !== entryId));

        if (deletedEntry) {
          alert(`Timesheet entry deleted: ${deletedEntry.hours} hours for ${deletedEntry.project}`);
        }

      } catch (error) {
        console.error('[TimesheetView] Error deleting entry:', error);
        alert('Error deleting timesheet entry. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCopyEntry = (entry: ITimesheetEntry): void => {
    setClipboard(entry);
    alert(`Entry copied: ${entry.hours}h for ${entry.project}\n\nClick "Paste" on any day to create a copy.`);
  };
  /**
   * Check if a date should be disabled in the date picker
   * Rule: Only FUTURE dates are disabled (past + today = enabled)
   */
  const isDateDisabled = (date: Date | null | undefined): boolean => {
    if (!date) return false;

    // Get today at midnight (ignore time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get comparison date at midnight
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    // ✅ FIXED: Disable ONLY if date is AFTER today (future dates)
    // Past dates and today are ENABLED
    return checkDate > today;
  };


  const handlePasteEntry = async (targetDate: string): Promise<void> => {
    if (!clipboard) {
      alert('No entry copied. Please copy an entry first.');
      return;
    }

    const normalizedDate = normalizeDateToString(targetDate);

    // VALIDATION: Check future date (NO ALERT)
    if (isFutureDate(normalizedDate)) {
      return; // Silently block paste to future dates
    }

    // ====================================================================
    // REQUIREMENT 2: Validate paste against Punch Data TotalHours (not fixed 8h)
    // OLD LOGIC COMMENTED – Replaced with TotalHours logic
    // const pasteMinutes = convertToMinutes(clipboard.hours);
    // const usedMinutes = getTotalMinutesForDate(normalizedDate);
    // const totalMinutes = usedMinutes + pasteMinutes;
    // if (totalMinutes > 480) {
    //   console.log('[Validation] Paste blocked: Would exceed 8 hour limit');
    //   return; // Block paste - no state update
    // }
    // ====================================================================
    const pasteMinutes = convertToMinutes(clipboard.hours);
    const usedMinutes = getTotalMinutesForDate(normalizedDate);
    const totalMinutes = usedMinutes + pasteMinutes;
    const limitMinutes = getDailyLimitMinutes(normalizedDate); // TotalHours from Punch Data

    if (totalMinutes > limitMinutes) {
      const limitHours = (limitMinutes / 60).toFixed(1);
      console.log(`[Validation] Paste blocked: Would exceed Punch Hours (${limitHours}h)`);
      alert(`You cannot enter more than your Punch Hours (${limitHours}h) for this day.`);
      return; // Block paste
    }
    // ====================================================================
    // END REQUIREMENT 2 paste validation
    // ====================================================================

    const validation = await validateTimesheetDate(normalizedDate);

    if (!validation.isValid) {
      alert(`Cannot paste to this date:\n${validation.message}`);
      return;
    }

    // ✅ FIX: Check if paste would exceed available hours (using punch data)
    const existingEntries = entries.filter(e => e.date === normalizedDate);
    const existingHours = existingEntries.reduce((sum, e) => sum + e.hours, 0);
    const newTotalHours = existingHours + clipboard.hours;

    // ✅ FIX: Get available hours from punch hours map (already loaded)
    const availableHours = weekPunchHoursMap.get(normalizedDate) || 0;

    // ✅ FIX: Block paste if exceeds punch hours
    if (newTotalHours > availableHours && availableHours > 0) {
      alert(
        `Cannot paste entry!\n\n` +
        `Current hours: ${existingHours.toFixed(1)}h\n` +
        `Paste hours: ${clipboard.hours.toFixed(1)}h\n` +
        `Total would be: ${newTotalHours.toFixed(1)}h\n\n` +
        `Available hours: ${availableHours.toFixed(1)}h\n\n` +
        `Exceeds limit by ${(newTotalHours - availableHours).toFixed(1)}h`
      );
      return;
    }

    try {
      setIsLoading(true);

      const empId = props.employeeMaster.EmployeeID;
      const weekDays = getCurrentWeekDays();
      const startDate = weekDays[0];
      const endDate = weekDays[6];

      // getTimesheetHeader returns ITimesheetHeader[] — take the first element safely.
      const pasteHeaders = await timesheetService.getTimesheetHeader(empId, startDate, endDate);
      let timesheetHeader: ITimesheetHeader | null =
        pasteHeaders && pasteHeaders.length > 0 ? pasteHeaders[0] : null;

      // No header found — create one (returns single ITimesheetHeader, fixes TS2740)
      if (!timesheetHeader) {
        timesheetHeader = await timesheetService.createTimesheetHeader(empId, startDate);
      }

      // Null + undefined guard before accessing .Id (fixes TS18047, TS2339)
      if (!timesheetHeader || timesheetHeader.Id === undefined) {
        throw new Error('[TimesheetView] handlePasteEntry: Timesheet header missing Id');
      }

      await timesheetService.createTimesheetLine({
        TimesheetID: timesheetHeader.Id,
        WorkDate: normalizedDate,
        ProjectNo: clipboard.project,
        TaskNo: '',
        HoursBooked: clipboard.hours,
        Description: clipboard.description
      });

      alert(`Entry pasted successfully!\n${clipboard.hours}h for ${clipboard.project} on ${formatDateForDisplay(normalizedDate)}`);

      await loadTimesheetData();

    } catch (error) {
      console.error('[TimesheetView] Error pasting entry:', error);
      alert('Error pasting entry. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  const LoadtimeData = async (taskType: string): Promise<void> => {
    const value = Number(
      activeProjectstype.find(p => p.TaskName === taskType)?.DurationTask ?? 0
    );

    setFormData(prev => ({
      ...prev,
      hours: value
    }));
  };

  // In Timesheetview.tsx, add clear clipboard function

  const handleClearPaste = (): void => {
    if (clipboard) {
      if (confirm('Clear copied entry? This will stop paste operations.')) {
        setClipboard(null);
        alert('Clipboard cleared successfully.');
      }
    } else {
      alert('No entry copied to clipboard.');
    }
  };

const handleSubmitTimesheet = async (): Promise<void> => {
  try {
    setIsLoading(true);

    const weekDays = getCurrentWeekDays();
    const weekStartDate = weekDays[0];
    const weekEndDate = weekDays[6];
    const empId = props.employeeMaster.EmployeeID;

    // Get or create header
    const header = await timesheetService.getOrCreateTimesheetHeader(
      empId,
      weekStartDate,
      weekEndDate
    );

    if (!header?.Id) {
      throw new Error('Failed to get or create timesheet header');
    }

    setCurrentTimesheetHeader(header);

    // Get manager email: sourced exclusively from EmployeeMaster
    // Graph API call removed — ManagerEmail is maintained in the EmployeeMaster
    // SharePoint list, keeping manager resolution consistent across all pages.
    const managerEmail = props.employeeMaster.Manager?.EMail || '';

    // Submit with 5 parameters
    await timesheetService.submitTimesheet(
      header.Id,
      empId,
      weekStartDate,
      weekEndDate,
      managerEmail || undefined
    );

    alert('Timesheet submitted successfully for approval!');
    await loadTimesheetData();

  } catch (error) {
    console.error('[TimesheetView] Submit error:', error);
    alert(`Failed to submit: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    setIsLoading(false);
  }
};

  const calculateWeekTotals = (): {
    totalHours: number;
    availableHours: number;
    daysWithEntries: number;
    totalDays: number;
    isWeekComplete: boolean; // ✅ NEW
  } => {
    const weekDays = getCurrentWeekDays();
    const weekEntries = entries.filter(entry => weekDays.indexOf(entry.date) !== -1);

    const totalHours = weekEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const daysWithEntries = new Set(weekEntries.map(e => e.date)).size;

    // ====================================================================
    // REQUIREMENT 3: Remove weekly 40h block – validate per-day only.
    // Calculate available hours from punch data TotalHours per day.
    // Skip Holiday, Leave, Weekend days from available hours calculation.
    //
    // OLD LOGIC COMMENTED – Replaced with TotalHours logic
    // // Calculate available hours (present working days only)
    // const workingDays = weekDays.filter(date => {
    //   const dayStatus = getDayStatus(date);
    //   return dayStatus === 'present'; // Only count present days
    // });
    // const availableHours = workingDays.length * MAX_DAILY_HOURS; // FIXED 8h × days – OLD
    // const REQUIRED_WEEKLY_HOURS = availableHours; // dynamic, not hardcoded 40
    // const isWeekComplete = availableHours === 0 || totalHours >= REQUIRED_WEEKLY_HOURS;
    // ====================================================================

    // REQUIREMENT 3: Sum actual TotalHours from Punch Data for present days only.
    // Holiday/Leave/Weekend days are skipped – no validation against fixed 40h.
    let availableHours = 0;
    weekDays.forEach(date => {
      const dayStatus = getDayStatus(date);
      // Skip non-working days: Holiday, Leave, Weekend, Absent, Future
      if (dayStatus !== 'present') return;

      const punchHours = weekPunchHoursMap.get(date);
      if (punchHours !== undefined && punchHours > 0) {
        availableHours += punchHours; // Sum actual TotalHours from Punch Data
      } else {
        // Fallback: no punch record for a present day → use fallback
        availableHours += MAX_DAILY_HOURS_FALLBACK;
      }
    });

    // REQUIREMENT 3: Week is complete when logged hours >= available punch hours
    // No longer blocked by fixed 40h/week limit
    const isWeekComplete = availableHours === 0 || totalHours >= availableHours;
    // ====================================================================
    // END REQUIREMENT 3
    // ====================================================================

    return {
      totalHours,
      availableHours,
      daysWithEntries,
      totalDays: weekDays.length,
      isWeekComplete
    };
  };
  const totals = calculateWeekTotals();

  const { totalHours, availableHours, daysWithEntries, totalDays, isWeekComplete } = totals;

  const getEntriesForDate = React.useCallback((date: string): ITimesheetEntry[] => {
    const normalizedDate = normalizeDateToString(date);
    return entries.filter(entry => entry.date === normalizedDate);
  }, [entries]);

  const getTotalHoursForDate = React.useCallback((date: string): number => {
    return getEntriesForDate(date).reduce((sum, entry) => sum + entry.hours, 0);
  }, [getEntriesForDate]);

  const isToday = (dateString: string): boolean => {
    return checkIsToday(dateString);
  };

  const weekDays = getCurrentWeekDays();
  const weekRangeText = getWeekRangeText();

  return (
    <div className={styles.viewContainer}>
      <div className={styles.dashboardHeader}>
        <h1>Timesheet Entries</h1>
        <p>Log your daily work hours and project allocations</p>
      </div>

      <div className={styles.timesheetContainer}>
        <div className={styles.weekNavigation}>
          <button
            className={styles.weekNavBtn}
            onClick={() => handleChangeWeek(-1)}
          >
            ← Previous Week
          </button>
          <div className={styles.weekDisplay}>{weekRangeText}</div>
          <button
            className={styles.weekNavBtn}
            onClick={() => handleChangeWeek(1)}
          >
            Next Week →
          </button>
        </div>

        <div className={styles.timesheetHeader}>
          <div>
            <h3>{weekRangeText}</h3>
            <p>Log hours worked on each project daily (Limit based on your Punch Hours)</p>
          </div>
          <div className={styles.timesheetActions}>
            <div className={styles.availableHoursDisplay}>
              <span>Weekly Hours:</span>
              <span>{totalHours.toFixed(1)}</span>
            </div>
            <button
              className={`${styles.btn} ${styles.btnPurple}`}
              onClick={() => { handleAddEntry().catch(console.error); }}
              disabled={isReadOnly() || isOlderThan30Days(weekDays[0])}
              title={isOlderThan30Days(weekDays[0]) ? 'Cannot add entries for dates older than 30 days' : ''}
            >
              + Add Entry
            </button>
            {/* Add after "Add Entry" button */}
            {clipboard && (
              <button
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={handleClearPaste}
              >
                🗑️ Clear Paste
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            Loading timesheet data...
          </div>
        ) : (
          <div className={styles.timesheetGrid}>
            {weekDays
              .filter(date => new Date(date + 'T00:00:00') <= new Date(new Date().toDateString()))
              .map((date) => {
                const dateEntries = getEntriesForDate(date);
                const dateTotalHours = getTotalHoursForDate(date);
                const isTodayDate = isToday(date);
                const isWeekendDate = isWeekend(date);
                const dayStatus = getDayStatus(date);
                const canAddTimesheet = !isWeekendDate &&
                  dayStatus !== 'absent' &&
                  dayStatus !== 'leave' &&
                  dayStatus !== 'holiday';

                // ====================================================================
                // REQUIREMENT 2 & 3: Get punch hours for this day from Punch Data.
                // Used to display available hours in UI and enforce daily limit.
                // OLD LOGIC COMMENTED – Replaced with TotalHours logic
                // const dayAvailableHours = 8.0; // FIXED 8h – OLD
                // ====================================================================
                const dayPunchHours = weekPunchHoursMap.get(date);
                const dayAvailableHours = (dayPunchHours !== undefined && dayPunchHours > 0)
                  ? dayPunchHours
                  : MAX_DAILY_HOURS_FALLBACK;
                // ====================================================================
                // END REQUIREMENT 2 & 3 day punch hours
                // ====================================================================

                // ====================================================================
                // REQUIREMENT 2: Disable "Add Entry" button when punch hours are full.
                // OLD LOGIC COMMENTED – Replaced with TotalHours logic
                // disabled={isReadOnly() || getTotalMinutesForDate(date) >= 480}
                // ====================================================================
                const dailyLimitMinutes = getDailyLimitMinutes(date); // TotalHours-based limit
                const isEntryButtonDisabled = isReadOnly() ||
                  getTotalMinutesForDate(date) >= dailyLimitMinutes;
                // ====================================================================

                return (
                  <div
                    key={date}
                    className={`${styles.timesheetDay} ${isTodayDate ? styles.todayHighlight : ''} ${!canAddTimesheet ? styles.disabledDay : ''}`}
                  >
                    <div className={styles.timesheetDayHeader}>
                      <div className={styles.dayInfo}>
                        <div className={styles.dayDate}>
                          {formatDateForDisplay(date)} {isTodayDate && '(Today)'} ({
                            dayStatus === 'present' ? 'Present' :
                            dayStatus === 'absent' ? 'Absent' :
                            dayStatus === 'leave' ? 'On Leave' :
                            dayStatus === 'holiday' ? 'Holiday' :
                            dayStatus === 'weekend' ? 'Weekend' : 'Present'
                          })
                        </div>
                        <span className={`${styles.dayStatusBadge} ${timesheetStatus === 'Submitted' || timesheetStatus === 'Approved' ? styles.submitted : styles.pending}`}>
                          {timesheetStatus === 'Submitted' ? 'Submitted' : timesheetStatus === 'Approved' ? 'Approved' : 'Pending'}
                        </span>
                      </div>
                      <div className={styles.dayTotal}>
                        {dateTotalHours.toFixed(1)}h
                      </div>
                    </div>

                    <div className={styles.timesheetEntries}>
                      {dateEntries.map(entry => (
                        <div key={entry.id} className={styles.timesheetEntry}>
                          <div className={styles.entryHeader}>
                            <div className={styles.projectInfo}>
                              <div className={styles.projectName}>{entry.projectName}</div>
                              <div className={styles.projectNumber}>({entry.project})</div>
                            </div>
                            <div className={styles.entryHours}>{entry.hours}h</div>
                          </div>
                          <div className={styles.entryMilestone}>
                            <span className={styles.milestoneLabel}>Milestone:</span> {entry.taskType}
                          </div>
                          {entry.description && (
                            <div className={styles.entryDescription}>
                              {entry.description}
                            </div>
                          )}
                          <div className={styles.entryActions}>
                            <button
                              className={`${styles.entryActionBtn} ${styles.copyBtn}`}
                              onClick={() => handleCopyEntry(entry)}
                              disabled={isReadOnly()} // DISABLE if submitted

                            >
                              <span>📋</span> Copy
                            </button>
                            <button
                              className={`${styles.entryActionBtn} ${styles.editBtn}`}
                              onClick={() => handleEditEntry(entry)}
                              disabled={isReadOnly()} // DISABLE if submitted

                            >
                              <span>✏️</span> Edit
                            </button>
                            <button
                              className={`${styles.entryActionBtn} ${styles.deleteBtn}`}
                              onClick={() => { handleDeleteEntry(entry.id).catch(console.error); }}
                              disabled={isReadOnly()} // DISABLE if submitted

                            >
                              <span>🗑️</span> Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {clipboard && canAddTimesheet && !isOlderThan30Days(date) && (
                      <button
                        className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                        onClick={() => { handlePasteEntry(date).catch(console.error); }}
                        style={{ marginLeft: '0.5rem', marginBottom: '0.5rem' }}
                      >
                        📋 Paste
                      </button>
                    )}

                    {canAddTimesheet && !isOlderThan30Days(date) ? (
                      <button
                        className={styles.addEntryBtn}
                        onClick={() => { handleAddEntry(date).catch(console.error); }}
                        // REQUIREMENT 2: Disable when punch hours are exhausted (not fixed 480min)
                        disabled={isEntryButtonDisabled}
                      >
                        {/* REQUIREMENT 2: Show available hours from Punch Data, not fixed 8h */}
                        + Add Entry for {formatDateForDisplay(date)} ({(dayAvailableHours - dateTotalHours).toFixed(1)}h available)
                      </button>
                    ) : (
                      <div className={styles.disabledMessage}>
                        {isWeekendDate && 'Week Off - No timesheet entry allowed'}
                        {dayStatus === 'absent' && 'You are absent, you cannot fill timesheet'}
                        {dayStatus === 'leave' && 'You are on leave for this day'}
                        {dayStatus === 'holiday' && 'Holiday - No timesheet entry allowed'}
                        {/* START: 30 days restriction */}
                        {!isWeekendDate && dayStatus === 'present' && isOlderThan30Days(date) && 'Date is older than 30 days - Cannot add timesheet entry'}
                        {/* END: 30 days restriction */}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        <button
          className={styles.submitTimesheetBtn}
          onClick={() => { handleSubmitTimesheet().catch(console.error); }}
          disabled={
            isReadOnly() || // Already submitted
            !totals.isWeekComplete || // ✅ NEW: Less than available punch hours
            isLoading
          } // DISABLE if already submitted
        >
          {timesheetStatus === 'Submitted'
            ? '✓ Submitted'
            : totals.isWeekComplete
              ? '✓ Submit Timesheet'
              : `⏳ ${totals.totalHours.toFixed(1)} / ${totals.availableHours.toFixed(1)}h`
          }
        </button>
      </div>

      <div className={styles.timesheetSummary}>
        <div className={styles.summaryItem}>
          <div className={styles.summaryValue}>{totalHours.toFixed(1)}</div>
          <div className={styles.summaryLabel}>Total Hours</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryValue}>{daysWithEntries}/{totalDays}</div>
          <div className={styles.summaryLabel}>Days Submitted</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryValue}>{totalHours.toFixed(1)}</div>
          <div className={styles.summaryLabel}>Project Hours</div>
        </div>
      </div>

      {isModalOpen && (
        <div className={styles.modal} style={{ display: 'flex' }}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>{editingEntry ? 'Edit Timesheet Entry' : 'Add Timesheet Entry'}</h3>
              <button className={styles.closeBtn} onClick={handleCloseModal}>×</button>
            </div>

            <form className={styles.timesheetForm} onSubmit={(e) => { handleSubmit(e).catch(console.error); }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Date *</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={formData.date}
                  max={getTodayString()} // ✅ Prevent future dates in native date picker
                  // START: 30 days restriction
                  min={getMinAllowedDate()} // ✅ NEW: Prevent dates older than 30 days
                  // END: 30 days restriction
                  onChange={(e) => {
                    const selectedDate = new Date(e.target.value + 'T00:00:00');
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    const checkDate = new Date(selectedDate);
                    checkDate.setHours(0, 0, 0, 0);

                    // ✅ Block future dates
                    if (checkDate > today) {
                      return; // Silently block - no alert
                    }

                    // START: 30 days restriction
                    // ✅ NEW: Block dates older than 30 days
                    if (isOlderThan30Days(e.target.value)) {
                      alert('Cannot select dates older than 30 days. Please select a date within the last 30 days.');
                      return;
                    }
                    // END: 30 days restriction

                    handleInputChange('date', e.target.value);

                  }}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Project *</label>
                <select
                  className={styles.formSelect}
                  value={formData.project}
                  onChange={(e) => handleInputChange('project', e.target.value)}
                  required
                >
                  <option value="">Select Project...</option>
                  {activeProjects.map(proj => (
                    <option
                      key={proj.Id}
                      value={proj.ProjectNumber}
                    >
                      {proj.ProjectName} ({proj.ProjectNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formRow}>
              <div className={styles.formGroup}>\
                  {/*
                    REQUIREMENT 2 / ISSUE 2 FIX: Hours input allows decimal values.
                    OLD LOGIC COMMENTED – Replaced with decimal-safe settings:
                    <label className={styles.formLabel}>Hours * (Max 8 per day)</label>
                    OLD: min="0.5"  ← blocked 0.1, 0.2, 0.3 etc.
                    OLD: step="0.5" ← forced increments of 0.5 only
                    OLD: max="8"    ← hardcoded 8h cap
                    ✅ NEW:
                    min="0.01"  → allows 0.1, 0.2, 0.3 and any decimal
                    step="0.01" → allows up to 2 decimal places
                    max → from getDailyLimitHours (Punch Data TotalHours)
                    value stored via parseFloat (not parseInt or Math.floor)
                  */}
                  <label className={styles.formLabel}>
                    Hours * (Max: {formData.date
                      ? getRemainingHours(formData.date, editingEntry?.id).toFixed(2)
                      : '-'}h remaining)
                  </label>
                  <input
                    type="number"
                    className={styles.formInput}
                    min="0.01"
                    // REQUIREMENT 2 / ISSUE 2 FIX: Max from Punch Data TotalHours (not hardcoded 8)
                    // OLD LOGIC COMMENTED – max="8" (fixed 8h cap – replaced)
                    max={formData.date
                      ? getRemainingHours(formData.date, editingEntry?.id).toFixed(2)
                      : MAX_DAILY_HOURS_FALLBACK}
                    step="0.01"
                    placeholder="0.0"
                    value={formData.hours || ''}
                    onChange={(e) => handleInputChange('hours', parseFloat(e.target.value))}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
  <label className={styles.formLabel}>Milestone/Activity</label>
  <select
    className={styles.formSelect}
    value={formData.taskType}
    onChange={(e) => {
      handleInputChange('taskType', e.target.value);
      void LoadtimeData(e.target.value);
    }}
    disabled={!formData.project} // ✅ DISABLE if no project selected
  >
    <option value="">
      {!formData.project 
        ? 'Select a project first...' 
        : filteredMilestones.length === 0 
          ? 'No milestones available' 
          : 'Select Milestone...'
      }
    </option>
    {filteredMilestones.map(task => (
      <option key={`${task.ProjectNumber}-${task.TaskNumber}-${task.TaskName}`} value={task.TaskName}>
        {task.TaskName}
      </option>
    ))}
  </select>
</div>
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={handleCloseModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  {editingEntry ? 'Update Entry' : 'Add Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimesheetView;