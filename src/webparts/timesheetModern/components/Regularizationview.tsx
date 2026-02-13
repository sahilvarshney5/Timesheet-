import * as React from 'react';
import styles from './TimesheetModern.module.scss';
import { SPHttpClient } from '@microsoft/sp-http';
import { ApprovalService } from '../services/ApprovalService';
import { AttendanceService } from '../services/AttendanceService';
import { IRegularizationRequest, IAttendanceRegularization, IEmployeeMaster } from '../models';
import { MSGraphClientV3 } from '@microsoft/sp-http';
import { UserService } from '../services/UserService';
export interface IRegularizationViewProps {
  onViewChange: (viewName: string) => void;
  spHttpClient: SPHttpClient;
  siteUrl: string;
  currentUserDisplayName: string;
  employeeMaster: IEmployeeMaster;
  userRole: 'Admin' | 'Manager' | 'Member';
  graphClient?: MSGraphClientV3;  // ADD THIS

}

const RegularizationView: React.FC<IRegularizationViewProps> = (props) => {
  const { onViewChange, spHttpClient, siteUrl } = props;
  
  // ✅ FIX: Add ALL missing state variables
  const [regularizationType, setRegularizationType] = React.useState<string>('day_based');
  const [regularizationHistory, setRegularizationHistory] = React.useState<IRegularizationRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [duration, setDuration] = React.useState<number>(0);
// ✅ ADD THESE NEW LINES:
const [statusOptions, setStatusOptions] = React.useState<Array<{ key: string; text: string }>>([]);
const [isLoadingStatuses, setIsLoadingStatuses] = React.useState<boolean>(false);
// Add this state variable after existing states
const [isFormModalOpen, setIsFormModalOpen] = React.useState<boolean>(false);
const [viewDetailsModalOpen, setViewDetailsModalOpen] = React.useState<boolean>(false);
const [selectedRequest, setSelectedRequest] = React.useState<IRegularizationRequest | null>(null);
const [punchData, setPunchData] = React.useState<any>(null);
// ADDED: State for editing draft requests
const [isEditMode, setIsEditMode] = React.useState<boolean>(false);
const [editingRequest, setEditingRequest] = React.useState<IRegularizationRequest | null>(null);
  // ✅ FIX: Initialize approvalService from props
  const approvalService = React.useMemo(
    () => new ApprovalService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  const attendanceService = React.useMemo(
    () => new AttendanceService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  // ✅ FIX: Move calculateDuration INSIDE component BEFORE it's used
  const calculateDuration = (from: string, to: string): number => {
    if (!from || !to) return 0;
    
    const fromDate = new Date(from);
    const toDate = new Date(to);
    
    const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    return diffDays;
  };

  // ✅ Calculate max allowed date (yesterday)
  const getMaxAllowedDate = (): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  };
  // Add this handler after existing handlers
const handleOpenFormModal = (): void => {
  setIsFormModalOpen(true);
};

const handleCloseFormModal = (): void => {
  setIsFormModalOpen(false);
    setIsEditMode(false);
  setEditingRequest(null);
};
  const loadRegularizationHistory = React.useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const empId = props.employeeMaster.EmployeeID;

      console.log(`[RegularizationView] Loading history for Employee ID: ${empId}`);

      const requests = await approvalService.getEmployeeRegularizations(empId);
      
      setRegularizationHistory(requests);
      console.log(`[RegularizationView] Loaded ${requests.length} regularization requests`);

    } catch (err) {
      console.error('[RegularizationView] Error loading regularization history:', err);
      setError('Failed to load regularization history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [props.employeeMaster.EmployeeID, approvalService]);
// ADDED: Handle editing a draft request
const handleEditDraft = React.useCallback((request: IRegularizationRequest): void => {
  // Set edit mode and populate form with existing data
  setEditingRequest(request);
  setIsEditMode(true);
  
  // Set regularization type
  setRegularizationType(request.requestType);
  
  // Calculate duration
  const dur = calculateDuration(request.fromDate, request.toDate);
  setDuration(dur);
  
  // Open form modal
  setIsFormModalOpen(true);
}, [calculateDuration]);

// ADDED: Handle submitting a draft request (change status from Draft to Pending)
// ADDED: Handle submitting a draft request (change status from Draft to Pending)
const handleSubmitDraft = React.useCallback(async (requestId: number): Promise<void> => {
  const request = regularizationHistory.find((r: IRegularizationRequest) => r.id === requestId);
  if (!request) return;

  const confirmMessage = 'Are you sure you want to submit this draft request for approval?';
  
  if (!confirm(confirmMessage)) {
    return;
  }

  try {
    setIsLoading(true);
    
    // Update status from Draft to Pending
    await approvalService.updateRegularizationStatus(requestId, 'Pending');

    // Update frontend state immediately
    setRegularizationHistory((prev: IRegularizationRequest[]) => prev.map((req: IRegularizationRequest) => 
      req.id === requestId 
        ? { ...req, status: 'pending' as any }
        : req
    ));
    
    alert('Draft request submitted successfully for manager approval.');
    
  } catch (err) {
    console.error('[RegularizationView] Error submitting draft request:', err);
    alert('Failed to submit draft request. Please try again.');
  } finally {
    setIsLoading(false);
    // FIXED: Call loadRegularizationHistory here instead of in dependency array
    void loadRegularizationHistory();
  }
}, [regularizationHistory, approvalService]);  // FIXED: Removed loadRegularizationHistory from dependencies
  // ✅ ADD THIS FUNCTION inside RegularizationView component:
/**
 * Fetch unique Status values from BC Integration Log
 * Uses spHttpClient (following project rules - no PnPjs)
 */
const fetchRegularizationCategories = React.useCallback(async (): Promise<void> => {
  try {
    setIsLoadingStatuses(true);
    
    // Fetch Status column from BC Integration Log
    const endpoint = `${siteUrl}/_api/web/lists/getbytitle('Regularization%20Categories')/items?$select=Description&$top=5000`;
    // $filter=UserId eq '${props.employeeMaster.UserId}'
    
    const response = await spHttpClient.get(
      endpoint,
      SPHttpClient.configurations.v1
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extract unique Status values
    const uniqueStatuses = Array.from(
      new Set(
        data.value
          .map((item: any) => item.Description)
          .filter((Description: string) => Description && Description.trim() !== '') // Remove null/undefined/empty
      )
    ) as string[];
    
    // Convert to dropdown options format
    const options = uniqueStatuses.map(Description => ({
      key: Description.toLowerCase().replace(/\s+/g, '_'), // Convert to snake_case for key
      text: Description // Display original text
    }));
    
    setStatusOptions(options);
    
    console.log(`[RegularizationView] Loaded ${options.length} unique categories from BC Integration Log`);
    
  } catch (err) {
    console.error('[RegularizationView] Error fetching regularization categories:', err);
    
    // Fallback to hardcoded options if API fails
    setStatusOptions([
      { key: 'late_coming', text: 'Late Coming' },
      { key: 'early_going', text: 'Early Going' },
      { key: 'missed_punch', text: 'Missed Punch' },
      { key: 'work_from_home', text: 'Work From Home' },
      { key: 'on_duty', text: 'On Duty' }
    ]);
    
    console.warn('[RegularizationView] Using fallback categories due to error');
  } finally {
    setIsLoadingStatuses(false);
  }
}, [spHttpClient, siteUrl]);

// ✅ ADD THIS useEffect AFTER existing useEffect for loadRegularizationHistory:
React.useEffect(() => {
  void fetchRegularizationCategories();
}, [fetchRegularizationCategories]);



  React.useEffect(() => {
    void loadRegularizationHistory();
  }, [loadRegularizationHistory]);

  const handleTypeChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setRegularizationType(event.target.value);
  };

  /**
   * ✅ ENHANCED: Validate date range for regularization
   * Prevent weekends, holidays, leave days, FUTURE dates, and TODAY
   */
  const validateDateRange = async (fromDate: string, toDate: string): Promise<{ isValid: boolean; reason: string }> => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(toDate);
      end.setHours(0, 0, 0, 0);
      
      const invalidDates: string[] = [];
      
      // ✅ CHECK 1: Prevent FUTURE dates
      if (start >= today) {
        return {
          isValid: false,
          reason: `Cannot raise regularization for today or future dates.\n\nFrom Date: ${fromDate}\n\nRegularization can only be raised for past dates (yesterday and earlier).`
        };
      }
      
      if (end >= today) {
        return {
          isValid: false,
          reason: `Cannot raise regularization for today or future dates.\n\nTo Date: ${toDate}\n\nRegularization can only be raised for past dates (yesterday and earlier).`
        };
      }
      
      // ✅ CHECK 2: Loop through date range for other validations
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateString = d.toISOString().split('T')[0];
        const dayOfWeek = d.getDay();
        
        // Check weekend
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          invalidDates.push(`${dateString} (Weekend)`);
          continue;
        }
      }
      
      if (invalidDates.length > 0) {
        return {
          isValid: false,
          reason: `The following dates are not eligible for regularization:\n${invalidDates.join('\n')}`
        };
      }
      
      return { isValid: true, reason: '' };
      
    } catch (error) {
      console.error('[RegularizationView] Validation error:', error);
      return { isValid: true, reason: '' }; // Allow on error (fail-safe)
    }
  };

const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
  event.preventDefault();
  
  if (isSaving) return;
  
  try {
    setIsSaving(true);
    setError(null);

    // FIX: Use event.target and cast it properly to HTMLFormElement
    // event.currentTarget can sometimes lose its type in nested React components
    const form = event.target as HTMLFormElement;
    
    // Alternative approach: Access form elements directly without FormData
    const formElements = form.elements;
    const employeeId = props.employeeMaster.EmployeeID;
    const fromDate = (formElements.namedItem('fromDate') as HTMLInputElement)?.value || '';
    
    // UPDATED: Auto-set toDate = fromDate for time_based regularization
    let toDate = (formElements.namedItem('toDate') as HTMLInputElement)?.value || '';
    if (regularizationType === 'time_based') {
      toDate = fromDate;
    }
    
    const category = (formElements.namedItem('category') as HTMLSelectElement)?.value || '';
    const reason = (formElements.namedItem('reason') as HTMLTextAreaElement)?.value || '';
    let timeStart = (formElements.namedItem('timeStart') as HTMLInputElement)?.value || '';
    let timeEnd = (formElements.namedItem('timeEnd') as HTMLInputElement)?.value || '';

    // UPDATED: Skip duplicate check when editing
    if (!isEditMode) {
      const exists = await approvalService.checkRegularizationExists(
        employeeId,
        fromDate
      );

      if (exists) {
        alert("Regularization already raised for this date.");
        setIsSaving(false);
        return;
      }
    }
    
    // ✅ VALIDATION 1: Date range check
    if (regularizationType !== 'time_based' && new Date(toDate) < new Date(fromDate)) {
      alert('To Date cannot be earlier than From Date');
      setIsSaving(false);
      return;
    }
    
    // ✅ VALIDATION 2: Check for weekends/holidays/leaves/FUTURE/TODAY
    const dateRangeValid = await validateDateRange(fromDate, toDate);
    if (!dateRangeValid.isValid) {
      alert(`Cannot submit regularization:\n\n${dateRangeValid.reason}`);
      setIsSaving(false);
      return;
    }
    
    // ✅ VALIDATION 3: Time-based checks
    if (regularizationType === 'time_based' && (!timeStart || !timeEnd)) {
      alert('Please fill in all time-based fields.');
      setIsSaving(false);
      return;
    }
    
    if (regularizationType === 'time_based' && timeStart >= timeEnd) {
      alert('End Time must be after Start Time.');
      setIsSaving(false);
      return;
    }
    
    if(regularizationType == 'day_based'){
      timeStart = '08:00';
      timeEnd = '17:00';
    }
    // FIXED: Get manager email using graphClient from props
    let managerEmail = '';
    if (props.graphClient) {
      try {
        const userService = new UserService(spHttpClient, siteUrl, props.graphClient);
        managerEmail = await userService.getCurrentUserManagerEmail();
      } catch (error) {
        // Silent fail - submission will continue without manager email
      }
    }

    const empId = props.employeeMaster.EmployeeID;
    const categoryFormatted = category.replace(/_/g, ' ').toUpperCase();
    const enhancedReason = `[${categoryFormatted}] ${reason}`;

    const newRequest: Partial<IAttendanceRegularization> = {
      EmployeeID: empId,
      RequestType: regularizationType === 'time_based' ? 'Time' : 'Day',
      StartDate: `${fromDate}T${timeStart}:00`,
      EndDate: `${toDate}T${timeEnd}:00`,
      ExpectedIn: `${fromDate}T${timeStart}:00`,
      ExpectedOut: `${toDate}T${timeEnd}:00`,
      Reason: enhancedReason,
      Status: 'Pending' as const,  // FIXED: Use 'Pending' instead of 'Draft'
      ManagerEmail:managerEmail
    };
    
    // ADDED: Check if editing or creating new
    if (isEditMode && editingRequest) {
      // Update existing draft request
      await approvalService.updateRegularization(editingRequest.id!, newRequest);
      alert(`Draft regularization updated successfully!\n\nType: ${regularizationType === 'time_based' ? 'Time-based' : 'Day-based'}\nFrom: ${fromDate}\nTo: ${toDate}\nCategory: ${categoryFormatted}\n\nStatus: Updated`);
    } else {
      // Create new request
      await approvalService.submitRegularizationRequest(newRequest);
      alert(`Regularization request submitted successfully!\n\nType: ${regularizationType === 'time_based' ? 'Time-based' : 'Day-based'}\nFrom: ${fromDate}\nTo: ${toDate}\nCategory: ${categoryFormatted}\n\nStatus: Pending Manager Approval`);
    }

    form.reset();
    setRegularizationType('day_based');
    setDuration(0);
    setIsEditMode(false);
    setEditingRequest(null);
    
    await loadRegularizationHistory();
    setIsFormModalOpen(false);
 
  } catch (err) {
    console.error('[RegularizationView] Error submitting regularization:', err);
    alert('Failed to submit regularization request. Please try again.');
  } finally {
    setIsSaving(false);
  }
};
  // Helper function to format time
  const formatTime = (timeString: string): string => {
    if (!timeString) return '';
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return timeString;
    }
  };

  // Helper function to format category text
  const formatCategoryText = (category: string): string => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleView = React.useCallback(async (request: IRegularizationRequest): Promise<void> => {
    try {
      setSelectedRequest(request);
      
      // Fetch punch data for the date range
      const empId = props.employeeMaster.EmployeeID;
      const punchDataForRange = await attendanceService.getPunchData(
        empId,
        request.fromDate,
        request.toDate
      );
      
      setPunchData(punchDataForRange.length > 0 ? punchDataForRange[0] : null);
      setViewDetailsModalOpen(true);
    } catch (error) {
      console.error('[RegularizationView] Error fetching punch data:', error);
      setPunchData(null);
      setViewDetailsModalOpen(true);
    }
  }, [attendanceService, props.employeeMaster.EmployeeID]);

  const handleRecall = React.useCallback(async (requestId: number): Promise<void> => {
    const request = regularizationHistory.find((r: IRegularizationRequest) => r.id === requestId);
    if (!request) return;

      const confirmMessage = 'Are you sure you want to recall this regularization request? It will be moved to Draft status.';

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsLoading(true);
      await approvalService.recallRegularization(requestId, 'recall');

      setRegularizationHistory((prev: IRegularizationRequest[]) => prev.map((req: IRegularizationRequest) => 
        req.id === requestId 
          ? { ...req, status: 'Draft' as any }
          : req
      ));
      
      alert('Regularization request recalled successfully and moved to Draft status.');
      
      await loadRegularizationHistory();
    } catch (err) {
      console.error('[RegularizationView] Error recalling request:', err);
      alert('Failed to recall regularization request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [regularizationHistory, approvalService, loadRegularizationHistory]);

  const handleCancel = async (requestId: number): Promise<void> => {
    if (!confirm('Are you sure you want to cancel this approved regularization request?')) {
      return;
    }

    try {
            setIsLoading(true);

            await approvalService.recallRegularization(requestId, 'recall');

      setRegularizationHistory((prev: IRegularizationRequest[]) => prev.map((req: IRegularizationRequest) => 
        req.id === requestId 
          ? { ...req, status: 'rejected' as const }
          : req
      ));
            await loadRegularizationHistory();

      alert('Regularization request cancelled successfully.');

    } catch (err) {
      console.error('[RegularizationView] Error cancelling request:', err);
      alert('Failed to cancel regularization request. Please try again.');
    }finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = React.useCallback((): void => {
    void loadRegularizationHistory();
  }, [loadRegularizationHistory]);

  const formatDateRange = (fromDate: string, toDate: string): string => {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    
    if (fromDate === toDate) {
      return from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    return `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  if (isLoading) {
    return (
      <div className={styles.viewContainer}>
        <div className={styles.dashboardHeader}>
          <h1>Attendance Regularization</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !regularizationHistory.length) {
    return (
      <div className={styles.viewContainer}>
        <div className={styles.dashboardHeader}>
          <h1>Attendance Regularization</h1>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
          <button 
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => { loadRegularizationHistory().catch(console.error); }}
            style={{ marginTop: '1rem' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ✅ Calculate max date (yesterday)
  const maxDate = getMaxAllowedDate();

  return (
    <div className={styles.viewContainer}>
      <div className={styles.dashboardHeader}>
        <h1>Attendance Regularization</h1>
        <p>Submit requests to regularize your attendance (past dates only)</p>
      </div>
      {/* ✅ NEW: Regularization Form Modal */}
{isFormModalOpen && (
  <div className={styles.modal} style={{ display: 'flex' }}>
    <div className={styles.modalContent}>
      <div className={styles.modalHeader}>
  <h3>{isEditMode ? 'Edit Draft Regularization Request' : 'Request Attendance Regularization'}</h3>
        <button 
          className={styles.closeBtn} 
          onClick={handleCloseFormModal}
          type="button"
        >
          ×
        </button>
      </div>
      
      
      {/* <div className={styles.formContainer}> */}
        <form onSubmit={handleSubmit}>
          {/* Radio buttons for Day-based vs Time-based */}
          <div className={styles.radioGroup}>
            <label className={styles.radioOption}>
              <input 
                type="radio" 
                name="regularization-type" 
                value="day_based" 
                checked={isEditMode && editingRequest ? (editingRequest.requestType === 'day_based' || editingRequest.requestType === 'Day') : regularizationType === 'day_based'}
                // defaultValue={isEditMode && editingRequest ? editingRequest.toDate : ''}
                onChange={handleTypeChange}
                disabled={isSaving}
              />
              <span className={styles.radioLabel}>Day-based</span>
            </label>
            <label className={styles.radioOption}>
              <input 
                type="radio" 
                name="regularization-type" 
                value="time_based"
                checked={isEditMode && editingRequest ? editingRequest.requestType === 'time_based' : regularizationType === 'time_based'}
                onChange={handleTypeChange}
                disabled={isSaving}
              />
              <span className={styles.radioLabel}>Time-based</span>
            </label>
          </div>
          
          {/* ✅ WARNING MESSAGE */}
          <div style={{ 
            background: '#FFF3E0', 
            border: '1px solid #FFA726', 
            borderRadius: '6px', 
            padding: '0.75rem', 
            marginBottom: '1rem',
            fontSize: 'var(--font-sm)',
            color: '#E65100'
          }}>
            <strong>⚠️ Important:</strong> Regularization can only be raised for <strong>past dates</strong> (yesterday and earlier). You cannot raise regularization for today or future dates.
          </div>
          
          <div className={styles.formRow3}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>From Date *</label>
              <input 
                type="date" 
                name="fromDate"
                className={styles.formInput} 
                max={maxDate}
                disabled={isSaving}
                    defaultValue={isEditMode && editingRequest ? editingRequest.fromDate : ''}

                onChange={(e) => {
                 if (regularizationType !== 'time_based') {
      const toDateInput = document.querySelector('input[name="toDate"]') as HTMLInputElement;
      if (toDateInput && toDateInput.value) {
        setDuration(calculateDuration(e.target.value, toDateInput.value));
      }
    } else {
      // ADDED: For time_based, duration is always 1 day
      setDuration(1);
    }
                }}
                required  
              />
            </div>
            {regularizationType !== 'time_based' && (

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>To Date *</label>
              <input 
                type="date" 
                name="toDate"
                className={styles.formInput} 
                max={maxDate}
                disabled={isSaving}
                      defaultValue={isEditMode && editingRequest ? editingRequest.toDate : ''}

                onChange={(e) => {
                  const fromDateInput = document.querySelector('input[name="fromDate"]') as HTMLInputElement;
                  if (fromDateInput && fromDateInput.value) {
                    setDuration(calculateDuration(fromDateInput.value, e.target.value));
                  }
                }}
                required={regularizationType !== 'time_based'}  
              />
            </div>
           )} 
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Category *</label>
              <select 
                name="category" 
                className={styles.formSelect}
                disabled={isSaving || isLoadingStatuses}
                    defaultValue={isEditMode && editingRequest ? editingRequest.category : ''}

                required
              >
                {/* <option value="">Choose category...</option>
                <option value="late_coming">Late Coming</option>
                <option value="early_going">Early Going</option>
                <option value="missed_punch">Missed Punch</option>
                <option value="work_from_home">Work From Home</option>
                <option value="on_duty">On Duty</option> */}
                <option value="">
                  {isLoadingStatuses ? 'Loading categories...' : 'Choose category...'}
                </option>
                {statusOptions.map(option => (
                  <option key={option.key} value={option.key}>
                    {option.text}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ✅ Duration field */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Duration (Days)</label>
            <input 
              type="number" 
              className={styles.formInput}
              value={duration}
              readOnly
              disabled
            />
          </div>
          
          {/* Time-based regularization fields */}
          <div className={`${styles.timeBasedFields} ${regularizationType === 'time_based' ? styles.active : ''}`}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Start Time *</label>
                <input 
                  type="time" 
                  name="timeStart"
                  className={styles.formInput}
                  disabled={isSaving}
                          defaultValue={isEditMode && editingRequest ? editingRequest.startTime : ''}

                  required={regularizationType === 'time_based'}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>End Time *</label>
                <input 
                  type="time" 
                  name="timeEnd"
                  className={styles.formInput}
                  disabled={isSaving}
                          defaultValue={isEditMode && editingRequest ? editingRequest.endTime : ''}

                  required={regularizationType === 'time_based'}
                />
              </div>
            </div>
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Reason *</label>
            <textarea 
              name="reason"
              className={styles.formTextarea} 
              placeholder="Explain why you need attendance regularization..." 
              disabled={isSaving}
                  defaultValue={isEditMode && editingRequest ? editingRequest.reason.replace(/^\[.*?\]\s*/, '') : ''}

              required 
            />
          </div>
          
          <div className={styles.formActions}>
            <button 
              type="button" 
              className={`${styles.btn} ${styles.btnOutline}`}
              onClick={() => onViewChange('dashboard')}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={isSaving}
            >
  {isSaving ? 'Saving...' : (isEditMode ? 'Update Draft' : 'Save as Draft')}
            </button>
          </div>
        </form>
        </div>
        </div>
)}
      {/* </div> */}
       {/* ✅ NEW: Request Regularization Button Section */}
    <div style={{ 
      marginBottom: '1.5rem', 
      display: 'flex', 
      justifyContent: 'center' 
    }}>
      <button 
        className={`${styles.btn} ${styles.btnPrimary}`}
        onClick={handleOpenFormModal}
        style={{ padding: '0.75rem 2rem', fontSize: 'var(--font-base)' }}
      >
        📝 Request Regularization
      </button>
    </div>
      {/* Regularization History */}
      <div className={styles.regularizationHistory}>
        <div className={styles.historyHeader}>
          <h3>Regularization History</h3>
          <button 
            className={`${styles.btn} ${styles.btnOutline}`}
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        
        <table className={styles.historyTable}>
          <thead>
            <tr>
              <th>AR request ID</th>
              <th>Date Range</th>
              <th>Category</th>
              <th>Status</th>
              <th>Submitted On</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {regularizationHistory.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.historyEmpty}>
                  No regularization requests submitted yet.
                </td>
              </tr>
            ) : (
              regularizationHistory.map(request => (
                <tr key={request.id}>
                  <td>{request.RequestID}</td>
                  <td>{formatDateRange(request.fromDate, request.toDate)}</td>
                  <td>{formatCategoryText(request.category)}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${
                      request.status === 'pending' ? styles.statusPending :
                      request.status === 'approved' ? styles.statusApproved :
                      styles.statusRejected
                    }`}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                  </td>
                  <td>{new Date(request.submittedOn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td>
                    <button 
                      className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                      onClick={() => handleView(request)}
                    >
                      View
                    </button>
                    {request.status === 'pending' && (
                      <button 
                        className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                        onClick={() => { handleRecall(request.id!).catch(console.error); }}
                      >
                        Recall
                      </button>
                    )}
                    {/* ADDED: Show Edit + Submit buttons for draft status */}
                    {request.status === 'draft' && (
                      <>
                        <button
                          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                          
                                    onClick={() => handleEditDraft(request)}

                            // TODO: Open edit form with pre-filled data
                            // console.log('Edit request:', request);
                          
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className={`${styles.btn} ${styles.btnSuccess} ${styles.btnSmall}`}
                                 onClick={() => { handleSubmitDraft(request.id!).catch(console.error); }}

                        >
                          Submit
                        </button>
                      </>
                    )}
                    {request.status === 'approved' &&(
                       <button 
                        className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                        onClick={() => { handleCancel(request.id!).catch(console.error); }}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* View Details Modal */}
      {viewDetailsModalOpen && selectedRequest && (
        <div className={styles.attendanceModalOverlay}>
          <div className={styles.attendanceModal}>
            <div className={styles.modalHeader}>
            <h3>Regularization Request Details</h3>

            
 {/* ADDED: Close button in header */}
        <button
          className={styles.closeBtn}
          onClick={() => {
            setViewDetailsModalOpen(false);
            setSelectedRequest(null);
            setPunchData(null);
          }}
          type="button"
        >
          ×
        </button>
      </div>
            <div className={styles.modalBody}>
              <div className={styles.infoRow}>
                <span>Request ID</span>
                <strong>#{selectedRequest.id}</strong>
              </div>

              <div className={styles.infoRow}>
                <span>Date Range</span>
                <strong>
                  {new Date(selectedRequest.fromDate).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                  {selectedRequest.fromDate !== selectedRequest.toDate && (
                    <> to {new Date(selectedRequest.toDate).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}</>
                  )}
                </strong>
              </div>

              <div className={styles.infoRow}>
                <span>Category</span>
                <strong>{formatCategoryText(selectedRequest.category)}</strong>
              </div>

              <div className={styles.infoRow}>
                <span>Status</span>
                <strong>
                  <span className={`${styles.statusBadge} ${
                    selectedRequest.status === 'pending' ? styles.statusPending :
                    selectedRequest.status === 'approved' ? styles.statusApproved :
                    styles.statusRejected
                  }`}>
                    {selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                  </span>
                </strong>
              </div>

              {/* Show Actual Punch Times if available */}
              {punchData && (
                <>
                  <div className={styles.infoRow}>
                    <span>Actual Punch In</span>
                    <strong>
                      {punchData.FirstPunchIn 
                        ? formatTime(punchData.FirstPunchIn) 
                        : '-'}
                    </strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Actual Punch Out</span>
                    <strong>
                      {punchData.LastPunchOut 
                        ? formatTime(punchData.LastPunchOut) 
                        : '-'}
                    </strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Total Hours</span>
                    <strong>
                      {punchData.TotalHours 
                        ? punchData.TotalHours.toFixed(1) + ' hrs'
                        : '-'}
                    </strong>
                  </div>
                </>
              )}

              {/* Show Requested Times for time-based regularization */}
              {selectedRequest.requestType === 'time_based' && (
                <>
                  <div className={styles.infoRow}>
                    <span>Requested In Time</span>
                    <strong>{selectedRequest.startTime || '-'}</strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Requested Out Time</span>
                    <strong>{selectedRequest.endTime || '-'}</strong>
                  </div>
                </>
              )}

              <div className={styles.infoRow}>
                <span>Reason</span>
                <strong>{selectedRequest.reason}</strong>
              </div>

              <div className={styles.infoRow}>
                <span>Submitted On</span>
                <strong>
                  {new Date(selectedRequest.submittedOn).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </strong>
              </div>

              {selectedRequest.approvedBy && (
                <>
                  <div className={styles.infoRow}>
                    <span>Approved By</span>
                    <strong>{selectedRequest.approvedBy}</strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Approved On</span>
                    <strong>
                      {selectedRequest.approvedOn && new Date(selectedRequest.approvedOn).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </strong>
                  </div>
                </>
              )}

              {selectedRequest.managerComment && (
                <div className={styles.infoRow}>
                  <span>Manager Comment</span>
                  <strong>{selectedRequest.managerComment}</strong>
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                className={`${styles.btn} ${styles.btnOutline}`}
                onClick={() => {
                  setViewDetailsModalOpen(false);
                  setSelectedRequest(null);
                  setPunchData(null);
                  
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegularizationView;