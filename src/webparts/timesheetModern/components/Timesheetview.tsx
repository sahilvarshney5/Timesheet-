// Timesheetview.tsx
// FIXED: Replaced Array.includes() with ES5-compatible indexOf()
// All date comparisons now use normalized YYYY-MM-DD format

import * as React from 'react';
import styles from './TimesheetModern.module.scss';
import { SPHttpClient } from '@microsoft/sp-http';
import { TimesheetService } from '../services/TimesheetService';
import { IEmployeeMaster } from '../models';
import { 
  normalizeDateToString, 
  formatDateForDisplay, 
  isToday as checkIsToday,
  getWeekDays,
  getWeekStartDate,
  getTodayString
} from '../utils/DateUtils';

interface ITimesheetEntry {
  id: number;
  date: string; // ✅ Always normalized to YYYY-MM-DD
  project: string;
  hours: number;
  taskType: string;
  description: string;
}

export interface ITimesheetViewProps {
  onViewChange: (viewName: string) => void;
  spHttpClient: SPHttpClient;
  siteUrl: string;
  currentUserDisplayName: string;
  employeeMaster: IEmployeeMaster;
  userRole: 'Admin' | 'Manager' | 'Member';
    navigationData?: { selectedDate?: string }; // NEW

}

const TimesheetView: React.FC<ITimesheetViewProps> = (props) => {
  const { spHttpClient, siteUrl } = props;


  // Services
  const timesheetService = React.useMemo(
    () => new TimesheetService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  // State management
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);
  const [entries, setEntries] = React.useState<ITimesheetEntry[]>([]);
  const [editingEntry, setEditingEntry] = React.useState<ITimesheetEntry | null>(null);
  const [currentWeekOffset, setCurrentWeekOffset] = React.useState<number>(0);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [clipboard, setClipboard] = React.useState<ITimesheetEntry | null>(null);

  // Form state
  const [formData, setFormData] = React.useState({
    date: '',
    project: '',
    hours: 0,
    taskType: 'Development',
    description: ''
  });

  // ADD copy handler
const handleCopyEntry = (entry: ITimesheetEntry): void => {
  setClipboard(entry);
  alert(`Entry copied: ${entry.hours}h for ${entry.project}\n\nClick "Paste" on any day to create a copy.`);
};

// ADD paste handler
const handlePasteEntry = async (targetDate: string): Promise<void> => {
  if (!clipboard) {
    alert('No entry copied. Please copy an entry first.');
    return;
  }
  
  const normalizedDate = normalizeDateToString(targetDate);
  
  // Validate target date
  const validation = await validateTimesheetDate(normalizedDate);
  
  if (!validation.isValid) {
    alert(`Cannot paste to this date:\n${validation.message}`);
    return;
  }
  
  try {
    setIsLoading(true);
    
    const empId = props.employeeMaster.EmployeeID;
    const weekDays = getCurrentWeekDays();
    const startDate = weekDays[0];
    
    let timesheetHeader = await timesheetService.getTimesheetHeader(empId, startDate);
    
    if (!timesheetHeader) {
      timesheetHeader = await timesheetService.createTimesheetHeader(empId, startDate);
    }
    
    // Create new entry with copied data
    await timesheetService.createTimesheetLine({
      TimesheetID: timesheetHeader.Id,
      WorkDate: normalizedDate,
      ProjectNo: clipboard.project,
      TaskNo: '',
      HoursBooked: clipboard.hours,
      Description: clipboard.description
    });
    
    alert(`Entry pasted successfully!\n${clipboard.hours}h for ${clipboard.project} on ${formatDateDisplay(normalizedDate)}`);
    
    await loadTimesheetData();
    
  } catch (error) {
    console.error('[TimesheetView] Error pasting entry:', error);
    alert('Error pasting entry. Please try again.');
  } finally {
    setIsLoading(false);
  }
};

  // Calculate initial week offset based on selected date
React.useEffect(() => {
  if (props.navigationData?.selectedDate) {
    const selectedDate = new Date(props.navigationData.selectedDate);
    const today = new Date();
    const diffTime = selectedDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const weekOffset = Math.floor(diffDays / 7);
    
    setCurrentWeekOffset(weekOffset);
  }
}, [props.navigationData]);
  // ✅ FIXED: Get current week days based on offset with normalized dates
  const getCurrentWeekDays = React.useCallback((): string[] => {
    const today = new Date();
    const adjustedDate = new Date(today);
    adjustedDate.setDate(today.getDate() + (currentWeekOffset * 7));
    
    // ✅ Use DateUtils function which returns normalized dates
    return getWeekDays(adjustedDate);
  }, [currentWeekOffset]);

  const loadTimesheetData = React.useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      // Get week dates (already normalized by getCurrentWeekDays)
      const weekDays = getCurrentWeekDays();
      const startDate = weekDays[0];
      const endDate = weekDays[weekDays.length - 1];
      
      const empId = props.employeeMaster.EmployeeID;
      
      console.log(`[TimesheetView] Loading timesheet for Employee ID: ${empId}, Week: ${startDate} to ${endDate}`);
      
      // Check if timesheet header exists for this week
      let timesheetHeader = await timesheetService.getTimesheetHeader(empId, startDate);
      
      if (!timesheetHeader) {
        timesheetHeader = await timesheetService.createTimesheetHeader(empId, startDate);
        console.log(`[TimesheetView] Created new timesheet header with ID: ${timesheetHeader.Id}`);
      }
      
      // Load timesheet lines for this header
      const lines = await timesheetService.getTimesheetLines(timesheetHeader.Id!);
      
      // ✅ CRITICAL: Convert to ITimesheetEntry format with normalized dates
      // The dates from TimesheetService are already normalized
      const convertedEntries: ITimesheetEntry[] = lines.map(line => ({
        id: line.Id!,
        date: line.WorkDate || line.EntryDate || '', // Already normalized by service
        project: line.ProjectNo || line.ProjectNumber || '',
        hours: line.HoursBooked || line.Hours || 0,
        taskType: 'Development', // Default
        description: line.Description || line.Comments || ''
      }));
      
      setEntries(convertedEntries);
      
      console.log(`[TimesheetView] Loaded ${convertedEntries.length} timesheet entries with normalized dates`);
      
    } catch (error) {
      console.error('[TimesheetView] Error loading timesheet data:', error);
      alert('Failed to load timesheet data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [getCurrentWeekDays, props.employeeMaster.EmployeeID, timesheetService]);

  // Load timesheet data when week changes
  React.useEffect(() => {
    loadTimesheetData().catch(err => {
      console.error('[TimesheetView] Effect error:', err);
    });
  }, [currentWeekOffset, loadTimesheetData]);

  // Get week range display text
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

  // Change week
  const handleChangeWeek = (direction: number): void => {
    setCurrentWeekOffset(prev => prev + direction);
  };

  // ADD new validation function at the top
const validateTimesheetDate = async (date: string): Promise<{ isValid: boolean; message: string }> => {
  const normalizedDate = normalizeDateToString(date);
  
  // Check if weekend
  if (isWeekend(normalizedDate)) {
    return {
      isValid: false,
      message: 'Cannot add timesheet entry for weekends (Saturday/Sunday)'
    };
  }
  
  // Check attendance status
  const empId = props.employeeMaster.EmployeeID;
  const yearMonth = normalizedDate.substring(0, 7); // YYYY-MM
  const year = parseInt(yearMonth.substring(0, 4));
  const month = parseInt(yearMonth.substring(5, 7));
  
  // Get attendance service (add to props or create instance)
  const attendanceService = new AttendanceService(props.spHttpClient, props.siteUrl);
  const calendar = await attendanceService.buildCalendarForMonth(empId, year, month);
  
  const dayData = calendar.find(day => day.date === normalizedDate);
  
  if (!dayData) {
    return { isValid: true, message: '' };
  }
  
  if (dayData.status === 'absent') {
    return {
      isValid: false,
      message: 'You are absent, you cannot fill timesheet for this day'
    };
  }
  
  if (dayData.status === 'leave') {
    return {
      isValid: false,
      message: 'You are on leave for this day, timesheet entry not allowed'
    };
  }
  
  if (dayData.status === 'holiday') {
    return {
      isValid: false,
      message: 'Cannot add timesheet entry for holidays'
    };
  }
  
  return { isValid: true, message: '' };
};


  // Open modal for new entry
  const handleAddEntry = async (date?: string): Promise<void> => {
    // setEditingEntry(null);
    
    // ✅ FIXED: Normalize date parameter
    const weekDays = getCurrentWeekDays();
    const normalizedDate = date ? normalizeDateToString(date) : weekDays[0];


  // ✅ NEW: Validate before opening modal
  const validation = await validateTimesheetDate(normalizedDate);
  
  if (!validation.isValid) {
    alert(validation.message);
    return;
  }
    
    setFormData({
      date: normalizedDate,
      project: '',
      hours: 0,
      taskType: 'Development',
      description: ''
    });
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleEditEntry = (entry: ITimesheetEntry): void => {
    setEditingEntry(entry);
    // ✅ Entry date is already normalized
    setFormData({
      date: entry.date,
      project: entry.project,
      hours: entry.hours,
      taskType: entry.taskType,
      description: entry.description
    });
    setIsModalOpen(true);
  };

  // Close modal
  const handleCloseModal = (): void => {
    setIsModalOpen(false);
    setEditingEntry(null);
    setFormData({
      date: '',
      project: '',
      hours: 0,
      taskType: 'Development',
      description: ''
    });
  };

  // Form input change
  const handleInputChange = (field: string, value: unknown): void => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Submit form
  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    
    try {
      setIsLoading(true);
      
      // ✅ CRITICAL: Normalize date before saving
      const normalizedDate = normalizeDateToString(formData.date);
       // ✅ NEW: Validate before saving
    const validation = await validateTimesheetDate(normalizedDate);
    
    if (!validation.isValid) {
      alert(validation.message);
      setIsLoading(false);
      return;
    }
      const empId = props.employeeMaster.EmployeeID;
      
      // Get or create timesheet header
      const weekDays = getCurrentWeekDays();
      const startDate = weekDays[0];
      
      let timesheetHeader = await timesheetService.getTimesheetHeader(empId, startDate);
      
      if (!timesheetHeader) {
        timesheetHeader = await timesheetService.createTimesheetHeader(empId, startDate);
      }
      
      if (editingEntry) {
        // Update existing entry in SharePoint with normalized date
        await timesheetService.updateTimesheetLine(editingEntry.id, {
          WorkDate: normalizedDate,
          ProjectNo: formData.project,
          HoursBooked: formData.hours,
          Description: formData.description
        });
        
      alert(`✓ Entry updated successfully!\n${formData.hours}h for ${formData.project}\n\nYou can continue adding more entries or close this window.`);
      } else {
        // Create new entry in SharePoint with normalized date
        await timesheetService.createTimesheetLine({
          TimesheetID: timesheetHeader.Id,
          WorkDate: normalizedDate,
          ProjectNo: formData.project,
          TaskNo: '', // TODO: Add task selection
          HoursBooked: formData.hours,
          Description: formData.description
        });
        
      alert(`✓ Entry added successfully!\n${formData.hours}h for ${formData.project}\n\nYou can continue adding more entries or close this window.`);
      }
      
      await loadTimesheetData();
      // handleCloseModal();

      setEditingEntry(null);
    setFormData({
      date: normalizedDate, // Keep same date for convenience
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

  // Delete entry
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

  // Submit timesheet
  const handleSubmitTimesheet = async (): Promise<void> => {
    const weekDays = getCurrentWeekDays();
    // ✅ FIXED: Replace Array.includes() with ES5-compatible indexOf()
    const weekEntries = entries.filter(entry => weekDays.indexOf(entry.date) !== -1);
    
    if (weekEntries.length === 0) {
      alert('Please add at least one timesheet entry before submitting.');
      return;
    }
    
    const totalHours = weekEntries.reduce((sum, entry) => sum + entry.hours, 0);
    
    if (confirm(`Submit timesheet for approval?\n\nTotal Hours: ${totalHours.toFixed(1)}\nEntries: ${weekEntries.length}\n\nYour timesheet will be sent for approval.`)) {
      try {
        setIsLoading(true);
        
        const empId = props.employeeMaster.EmployeeID;
        const startDate = weekDays[0];
        
        const timesheetHeader = await timesheetService.getTimesheetHeader(empId, startDate);
        
        if (!timesheetHeader) {
          throw new Error('Timesheet header not found');
        }
        
        await timesheetService.submitTimesheet(timesheetHeader.Id!);
        
        alert(`Timesheet submitted successfully!\n\nTotal Hours: ${totalHours.toFixed(1)}\nEntries: ${weekEntries.length}\n\nYour timesheet has been sent for approval.`);
        
        await loadTimesheetData();
        
      } catch (error) {
        console.error('[TimesheetView] Error submitting timesheet:', error);
        alert('Error submitting timesheet. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Calculate totals for current week
  const calculateWeekTotals = (): { totalHours: number; daysWithEntries: number; totalDays: number } => {
    const weekDays = getCurrentWeekDays();
    // ✅ FIXED: Replace Array.includes() with ES5-compatible indexOf()
    const weekEntries = entries.filter(entry => weekDays.indexOf(entry.date) !== -1);
    
    const totalHours = weekEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const daysWithEntries = new Set(weekEntries.map(e => e.date)).size;
    
    return { totalHours, daysWithEntries, totalDays: weekDays.length };
  };

  // ✅ FIXED: Get entries for a specific date (date comparison now works)
  const getEntriesForDate = React.useCallback((date: string): ITimesheetEntry[] => {
    // ✅ Normalize input date for comparison
    const normalizedDate = normalizeDateToString(date);
    // ✅ Entry dates are already normalized, so direct comparison works
    return entries.filter(entry => entry.date === normalizedDate);
  }, [entries]);

  // ✅ FIXED: Calculate total hours for a date
  const getTotalHoursForDate = React.useCallback((date: string): number => {
    return getEntriesForDate(date).reduce((sum, entry) => sum + entry.hours, 0);
  }, [getEntriesForDate]);

  // ✅ FIXED: Format date for display using DateUtils
  const formatDateDisplay = (dateString: string): string => {
    return formatDateForDisplay(dateString);
  };

  // ✅ FIXED: Check if date is today using DateUtils
  const isToday = (dateString: string): boolean => {
    return checkIsToday(dateString);
  };

  const { totalHours, daysWithEntries, totalDays } = calculateWeekTotals();
  const weekDays = getCurrentWeekDays();
  const weekRangeText = getWeekRangeText();

  return (
    <div className={styles.viewContainer}>
      <div className={styles.dashboardHeader}>
        <h1>Timesheet Entries</h1>
        <p>Log your daily work hours and project allocations</p>
      </div>
      
      <div className={styles.timesheetContainer}>
        {/* Week Navigation */}
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
              <span>Available Hours:</span>
              <span>9</span>/9
            </div>
            <button 
              className={`${styles.btn} ${styles.btnPurple}`}
              onClick={() => handleAddEntry()}
            >
              + Add Entry
            </button>
          </div>
        </div>
        
        {/* Timesheet Grid */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            Loading timesheet data...
          </div>
        ) : (
          <div className={styles.timesheetGrid}>
            {weekDays.map((date) => {
              const dateEntries = getEntriesForDate(date);
              const dateTotalHours = getTotalHoursForDate(date);
              const isTodayDate = isToday(date);

               // ✅ NEW: Check if day allows timesheet
  const isWeekendDate = isWeekend(date);
  const dayStatus = getDayStatus(date); // Create helper function
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
                        {formatDateDisplay(date)} {isTodayDate && '(Today)'} (Present)
                      </div>
                      <span className={`${styles.dayStatusBadge} ${styles.pending}`}>
                        Pending
                      </span>
                    </div>
                    <div className={styles.dayTotal}>
                      {dateTotalHours.toFixed(1)}h / 8.0h
                    </div>
                  </div>
                  
                  <div className={styles.timesheetEntries}>
                    {dateEntries.map(entry => (
                      <div key={entry.id} className={styles.timesheetEntry}>
                        <div className={styles.entryHeader}>
                          <div className={styles.projectName}>{entry.project}</div>
                          <div className={styles.entryHours}>{entry.hours}h</div>
                        </div>
                        <div className={styles.entryDescription}>
                          {entry.description}
                        </div>
                        <div className={styles.entryActions}>
                           <button 
    className={`${styles.entryActionBtn} ${styles.copyBtn}`}
    onClick={() => handleCopyEntry(entry)}
  >
    <span>📋</span> Copy
  </button>
                          <button 
                            className={`${styles.entryActionBtn} ${styles.editBtn}`}
                            onClick={() => handleEditEntry(entry)}
                          >
                            <span>✏️</span> Edit
                          </button>
                          <button 
                            className={`${styles.entryActionBtn} ${styles.deleteBtn}`}
                            onClick={() => { handleDeleteEntry(entry.id).catch(console.error); }}
                          >
                            <span>🗑️</span> Delete
                          </button>
                        </div>

// ADD paste button to day header (only if clipboard has data)
{clipboard && canAddTimesheet && (
  <button 
    className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
    onClick={() => { handlePasteEntry(date).catch(console.error); }}
    style={{ marginLeft: '0.5rem' }}
  >
    📋 Paste
  </button>
)}
                      </div>
                    ))}
                  </div>
                  {canAddTimesheet ? (
                  <button 
                    className={styles.addEntryBtn}
                    onClick={() => handleAddEntry(date)}
                  >
                    + Add Entry for {formatDateDisplay(date)} ({(8.0 - dateTotalHours).toFixed(1)}h available)
                  </button>
                  ): (
        <div className={styles.disabledMessage}>
          {isWeekendDate && 'Week Off - No timesheet entry allowed'}
          {dayStatus === 'absent' && 'You are absent, you cannot fill timesheet'}
          {dayStatus === 'leave' && 'You are on leave for this day'}
          {dayStatus === 'holiday' && 'Holiday - No timesheet entry allowed'}
        </div>
      )}
                </div>
              );
            })}
          </div>
        )}

        {/* Submit Timesheet Button */}
        <button 
          className={styles.submitTimesheetBtn}
          onClick={() => { handleSubmitTimesheet().catch(console.error); }}
          disabled={isLoading}
        >
          <span>✓</span> Submit Timesheet
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

      {/* Modal for Add/Edit Entry */}
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
                  onChange={(e) => handleInputChange('date', e.target.value)}
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
                  <option value="Project Alpha">Project Alpha</option>
                  <option value="Project Beta">Project Beta</option>
                  <option value="Project Gamma">Project Gamma</option>
                  <option value="Project Delta">Project Delta</option>
                  <option value="Internal">Internal</option>
                </select>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Hours * (Max 9 per day)</label>
                  <input 
                    type="number" 
                    className={styles.formInput}
                    min="0.5"
                    max="9"
                    step="0.5"
                    placeholder="0.0"
                    value={formData.hours || ''}
                    onChange={(e) => handleInputChange('hours', parseFloat(e.target.value))}
                    required
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Task Type</label>
                  <select 
                    className={styles.formSelect}
                    value={formData.taskType}
                    onChange={(e) => handleInputChange('taskType', e.target.value)}
                  >
                    <option value="Development">Development</option>
                    <option value="Testing">Testing</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Planning">Planning</option>
                    <option value="Documentation">Documentation</option>
                  </select>
                </div>
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Description *</label>
                <textarea 
                  className={styles.formTextarea}
                  placeholder="Describe the work you did..."
                  rows={3}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  required
                />
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