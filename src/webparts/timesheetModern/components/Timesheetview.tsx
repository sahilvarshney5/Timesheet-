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
import { IEmployeeMaster, ITimesheetHeader } from '../models';
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
  const MAX_DAILY_HOURS = 8;
  const MAX_WEEKLY_HOURS = 40; // Configurable

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
  // ============================================================================
  // VALIDATION HELPERS - 8 HOUR DAILY LIMIT
  // ============================================================================

  /**
   * Convert hours to minutes
   */
  const convertToMinutes = (hours: number): number => {
    return Math.round(hours * 60);
  };

  /**
   * Calculate total minutes for a specific date
   */
  const getTotalMinutesForDate = (date: string, excludeEntryId?: number): number => {
    return entries
      .filter(e => e.date === date && e.id !== excludeEntryId)
      .reduce((total, e) => total + convertToMinutes(e.hours), 0);
  };

  /**
   * Get remaining minutes available for a date
   */
  const getRemainingMinutes = (date: string, excludeEntryId?: number): number => {
    const used = getTotalMinutesForDate(date, excludeEntryId);
    return Math.max(0, 480 - used); // 480 minutes = 8 hours
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

  // FIXED: Helper function to get day status
  const getDayStatus = (dateString: string): 'present' | 'absent' | 'leave' | 'holiday' | 'weekend' | null => {
    // This is a simplified version - in real implementation, fetch from attendance data
    if (isWeekend(dateString)) {
      return 'weekend';
    }
    // Default to present for now - should fetch actual status from attendance service
    return 'present';
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

    // Simplified validation - in production, check actual attendance
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
  
  // VALIDATION: Hours limit check
  if (field === 'hours') {
    const newMinutes = convertToMinutes(value as number);
    const currentDate = formData.date;
    
    if (currentDate) {
      const usedMinutes = getTotalMinutesForDate(currentDate, editingEntry?.id);
      const totalMinutes = usedMinutes + newMinutes;
      
      // Block if exceeds 480 minutes (8 hours)
      if (totalMinutes > 480) {
        console.log('[Validation] Cannot exceed 8 hours per day');
        return; // Block the change
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

      // 2. Check 8-hour limit
      const newMinutes = convertToMinutes(formData.hours);
      const usedMinutes = getTotalMinutesForDate(normalizedDate, editingEntry?.id);
      const totalMinutes = usedMinutes + newMinutes;

      if (totalMinutes > 480) {
        console.log('[Validation] Save blocked: Exceeds 8 hour daily limit');
        alert('Cannot save entry: Exceeds 8 hour limit for the day.');
        setIsLoading(false);
        return; // Block save - DO NOT call API
      }



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

    // VALIDATION: Check 8-hour limit for target date
    const pasteMinutes = convertToMinutes(clipboard.hours);
    const usedMinutes = getTotalMinutesForDate(normalizedDate);
    const totalMinutes = usedMinutes + pasteMinutes;

    if (totalMinutes > 480) {
      console.log('[Validation] Paste blocked: Would exceed 8 hour limit');
      return; // Block paste - no state update
    }

    const validation = await validateTimesheetDate(normalizedDate);

    if (!validation.isValid) {
      alert(`Cannot paste to this date:\n${validation.message}`);
      return;
    }

    // ✅ FIX: Check if paste would exceed available hours
    const existingEntries = entries.filter(e => e.date === normalizedDate);
    const existingHours = existingEntries.reduce((sum, e) => sum + e.hours, 0);
    const newTotalHours = existingHours + clipboard.hours;

    // ✅ FIX: Get available hours from punch data via service
    let availableHours = 0;
    try {
      const empId = props.employeeMaster.EmployeeID;
      const punchData = await attendanceService.getPunchData(empId, normalizedDate, normalizedDate);
      availableHours = punchData.length > 0 ? (punchData[0].TotalHours || 0) : 0;
    } catch (error) {
      console.error(`[TimesheetView] Error getting punch data for ${normalizedDate}:`, error);
      availableHours = MAX_DAILY_HOURS; // Fallback to max daily hours
    }

    // ✅ FIX: Block paste if exceeds
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
  // const handleSubmitTimesheet = async (): Promise<void> => {
  //   try {
  //     setIsLoading(true);

  //     if (!currentTimesheetHeader || !currentTimesheetHeader.Id) {
  //       alert('No timesheet header found. Please create a timesheet first.');
  //       return;
  //     }

  //     // FIXED: Get manager email using graphClient from props
  //     let managerEmail = '';
  //     if (props.graphClient) {
  //       try {
  //         const userService = new UserService(spHttpClient, siteUrl, props.graphClient);
  //         managerEmail = await userService.getCurrentUserManagerEmail();
  //       } catch (error) {
  //         // Silent fail - submission will continue without manager email
  //       }
  //     }

  //     // Submit timesheet with manager email
  //     await timesheetService.submitTimesheetWithManagerEmail(
  //       currentTimesheetHeader.Id,
  //       managerEmail
  //     );

  //     alert('Timesheet submitted successfully for approval!');

  //     // Reload timesheet data
  //     await loadTimesheetData();

  //   } catch (error) {
  //     alert('Failed to submit timesheet. Please try again.');
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

// const handleSubmitTimesheet = async (): Promise<void> => {
//   try {
//     setIsLoading(true);

//     // ✅ STEP 1: Calculate current week dates
//     const weekDays = getCurrentWeekDays();
//     const weekStartDate = weekDays[0]; // Monday
//     const weekEndDate = weekDays[6];   // Sunday

//     console.log('[TimesheetView] Submit - Week:', weekStartDate, 'to', weekEndDate);

//     // ✅ STEP 2: Get manager email (optional)
//     let managerEmail = '';
//     if (props.graphClient) {
//       try {
//         const userService = new UserService(spHttpClient, siteUrl, props.graphClient);
//         managerEmail = await userService.getCurrentUserManagerEmail();
//         console.log('[TimesheetView] Manager email:', managerEmail);
//       } catch (error) {
//         console.warn('[TimesheetView] Could not fetch manager email:', error);
//         // Silent fail - submission will continue without manager email
//       }
//     }

//     // ✅ STEP 3: Submit timesheet (NEW API with 5 parameters)
//     // This will auto-create header if it doesn't exist
//     await timesheetService.submitTimesheet(
//       currentTimesheetHeader?.Id,        // Optional: existing header ID (undefined if no header)
//       props.employeeMaster.EmployeeID,   // Required: employee ID
//       weekStartDate,                     // Required: week start (Monday)
//       weekEndDate,                       // Required: week end (Sunday)
//       managerEmail || undefined          // Optional: manager email
//     );

//     alert('Timesheet submitted successfully for approval!');

//     // ✅ STEP 4: Reload timesheet data to reflect new status
//     await loadTimesheetData();

//   } catch (error) {
//     console.error('[TimesheetView] Submit error:', error);
//     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//     alert(`Failed to submit timesheet: ${errorMessage}`);
//   } finally {
//     setIsLoading(false);
//   }
// };

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

    // Calculate available hours (working days only)
    const workingDays = weekDays.filter(date => {
      const dayStatus = getDayStatus(date);
      return dayStatus === 'present'; // Only count present days
    });
    const availableHours = workingDays.length * MAX_DAILY_HOURS;
    // ✅ NEW: Check if weekly requirement is met
    const REQUIRED_WEEKLY_HOURS = 40;
    const isWeekComplete = totalHours >= REQUIRED_WEEKLY_HOURS;

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
            <p>Log hours worked on each project daily (Max 9 hours per day)</p>
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

                return (
                  <div
                    key={date}
                    className={`${styles.timesheetDay} ${isTodayDate ? styles.todayHighlight : ''} ${!canAddTimesheet ? styles.disabledDay : ''}`}
                  >
                    <div className={styles.timesheetDayHeader}>
                      <div className={styles.dayInfo}>
                        <div className={styles.dayDate}>
                          {formatDateForDisplay(date)} {isTodayDate && '(Today)'} (Present)
                        </div>
                        <span className={`${styles.dayStatusBadge} ${styles.pending}`}>
                          Pending
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
                        disabled={
                          isReadOnly() ||
                          getTotalMinutesForDate(date) >= 480 // DISABLE if 8 hours reached
                        }

                      >
                        + Add Entry for {formatDateForDisplay(date)} ({(8.0 - dateTotalHours).toFixed(1)}h available)
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
            !totals.isWeekComplete || // ✅ NEW: Less than 45 hours
            isLoading
          } // DISABLE if already submitted
        >
          {timesheetStatus === 'Submitted'
            ? '✓ Submitted'
            : totals.isWeekComplete
              ? '✓ Submit Timesheet'
                : `⏳ ${totals.totalHours.toFixed(1)}`

              // : `⏳ ${totals.totalHours.toFixed(1)} / 40 hours (${(40 - totals.totalHours).toFixed(1)}h remaining)`
          }
          {/* {timesheetStatus === 'Submitted' ? '✓ Submitted' : '✓ Submit Timesheet'} */}
        </button>
        {/* ✅ NEW: Warning message if incomplete */}
        {/* {!totals.isWeekComplete && totals.totalHours > 0 && (
          <div style={{
            textAlign: 'center',
            color: 'var(--danger)',
            fontSize: 'var(--font-sm)',
            marginTop: '0.5rem'
          }}>
            Please fill at least 40 hours before submitting timesheet
          </div>
        )} */}
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
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Hours * (Max 8 per day)</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    min="0.5"
                    max="8"
                    step="0.5"
                    placeholder="0.0"
                    value={formData.hours || ''}
                    onChange={(e) => handleInputChange('hours', parseFloat(e.target.value))}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
  <label className={styles.formLabel}>Milestone</label>
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

              {/* <div className={styles.formGroup}>
                <label className={styles.formLabel}>Description *</label>
                <textarea 
                  className={styles.formTextarea}
                  placeholder="Describe the work you did..."
                  rows={3}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  required
                />
              </div> */}

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