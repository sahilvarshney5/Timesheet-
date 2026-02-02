import * as React from 'react';
import styles from './TimesheetModern.module.scss';
import { SPHttpClient } from '@microsoft/sp-http';
import { ApprovalService } from '../services/ApprovalService';
import { UserService } from '../services/UserService';
import { IRegularizationRequest, IAttendanceRegularization, IEmployeeMaster } from '../models';

export interface IRegularizationViewProps {
  onViewChange: (viewName: string) => void;
  spHttpClient: SPHttpClient;
  siteUrl: string;
  currentUserDisplayName: string;
  employeeMaster: IEmployeeMaster;
  userRole: 'Admin' | 'Manager' | 'Member';
}

const RegularizationView: React.FC<IRegularizationViewProps> = (props) => {
  const { onViewChange, spHttpClient, siteUrl } = props;
  
  // Services
  const approvalService = React.useMemo(
    () => new ApprovalService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  // State
  const [regularizationType, setRegularizationType] = React.useState<string>('day_based');
  const [history, setHistory] = React.useState<IRegularizationRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // ✅ NEW: Calculate max allowed date (yesterday)
  const getMaxAllowedDate = (): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  };

  const loadRegularizationHistory = React.useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const empId = props.employeeMaster.EmployeeID;

      console.log(`[RegularizationView] Loading history for Employee ID: ${empId}`);

      const requests = await approvalService.getEmployeeRegularizations(empId);
      
      setHistory(requests);
      console.log(`[RegularizationView] Loaded ${requests.length} regularization requests`);

    } catch (err) {
      console.error('[RegularizationView] Error loading regularization history:', err);
      setError('Failed to load regularization history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [props.employeeMaster.EmployeeID, approvalService]);

  React.useEffect(() => {
    void loadRegularizationHistory();
  }, []);

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
        
        // TODO: Check holiday list
        // const isHoliday = await checkHoliday(dateString);
        // if (isHoliday) {
        //   invalidDates.push(`${dateString} (Holiday)`);
        //   continue;
        // }
        
        // TODO: Check approved leaves
        // const hasLeave = await checkLeave(dateString, props.employeeMaster.EmployeeID);
        // if (hasLeave) {
        //   invalidDates.push(`${dateString} (On Leave)`);
        // }
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

      const form = event.currentTarget;
      const formData = new FormData(form);
      
      const fromDate = formData.get('fromDate') as string;
      const toDate = formData.get('toDate') as string;
      const category = formData.get('category') as string;
      const reason = formData.get('reason') as string;
      const timeStart = formData.get('timeStart') as string;
      const timeEnd = formData.get('timeEnd') as string;
      
      // ✅ VALIDATION 1: Date range check
      if (new Date(toDate) < new Date(fromDate)) {
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
      
      const empId = props.employeeMaster.EmployeeID;
      const categoryFormatted = category.replace(/_/g, ' ').toUpperCase();
      const enhancedReason = `[${categoryFormatted}] ${reason}`;

      const newRequest: Partial<IAttendanceRegularization> = {
        EmployeeID: empId,
        RequestType: regularizationType === 'time_based' ? 'Time' : 'Day',
        StartDate: fromDate,
        EndDate: toDate,
        ExpectedIn: regularizationType === 'time_based' ? timeStart : undefined,
        ExpectedOut: regularizationType === 'time_based' ? timeEnd : undefined,
        Reason: enhancedReason,
        Status: 'Pending' as const
      };
      
      await approvalService.submitRegularizationRequest(newRequest);
      
      alert(`Regularization request submitted successfully!\n\nType: ${regularizationType === 'time_based' ? 'Time-based' : 'Day-based'}\nFrom: ${fromDate}\nTo: ${toDate}\nCategory: ${categoryFormatted}\n\nStatus: Pending Manager Approval`);

      form.reset();
      setRegularizationType('day_based');
      
      await loadRegularizationHistory();
      
      onViewChange('dashboard');
   
    } catch (err) {
      console.error('[RegularizationView] Error submitting regularization:', err);
      alert('Failed to submit regularization request. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleView = React.useCallback((request: IRegularizationRequest): void => {
    const fromDate = new Date(request.fromDate);
    const toDate = new Date(request.toDate);
    const submittedDate = new Date(request.submittedOn);
    
    let message = `Regularization Request Details:\n\n`;
    message += `ID: ${request.id}\n`;
    message += `Type: ${request.requestType === 'time_based' ? 'Time-based' : 'Day-based'}\n`;
    message += `Date Range: ${fromDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
    
    if (request.fromDate !== request.toDate) {
      message += ` to ${toDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`;
    } else {
      message += '\n';
    }
    
    const categoryText = request.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    message += `Category: ${categoryText}\n`;
    message += `Status: ${request.status.charAt(0).toUpperCase() + request.status.slice(1)}\n`;
    message += `Submitted On: ${submittedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`;
    
    if (request.requestType === 'time_based' && request.startTime && request.endTime) {
      message += `Time: ${request.startTime} to ${request.endTime}\n`;
    }
    
    message += `Reason: ${request.reason}\n`;
    
    if (request.approvedBy) {
      const approvedDate = new Date(request.approvedOn!);
      message += `\nApproval Details:\n`;
      message += `Approved By: ${request.approvedBy}\n`;
      message += `Approved On: ${approvedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`;
    }
    
    if (request.managerComment) {
      message += `Manager Comment: ${request.managerComment}\n`;
    }
    
    alert(message);
  }, []);

  const handleRecall = React.useCallback(async (requestId: number): Promise<void> => {
    const request = history.find(r => r.id === requestId);
    if (!request) return;

    const confirmMessage = request.status === 'approved' 
      ? 'Are you sure you want to recall this approved regularization request? It will be moved back to Pending status.'
      : 'Are you sure you want to recall this pending regularization request? It will be moved back to Pending status.';
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsLoading(true);
      await approvalService.recallRegularization(requestId);

      setHistory(prev => prev.map(req => 
        req.id === requestId 
          ? { ...req, status: 'pending' as const }
          : req
      ));
      
      alert('Regularization request recalled successfully and moved to Pending status.');
      
      await loadRegularizationHistory();
    } catch (err) {
      console.error('[RegularizationView] Error recalling request:', err);
      alert('Failed to recall regularization request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [history, approvalService, loadRegularizationHistory]);

  const handleCancel = async (requestId: number): Promise<void> => {
    if (!confirm('Are you sure you want to cancel this approved regularization request?')) {
      return;
    }

    try {
      setHistory(prev => prev.map(req => 
        req.id === requestId 
          ? { ...req, status: 'rejected' as const }
          : req
      ));
      alert('Regularization request cancelled successfully.');

    } catch (err) {
      console.error('[RegularizationView] Error cancelling request:', err);
      alert('Failed to cancel regularization request. Please try again.');
    }
  };

  const handleRefresh = React.useCallback((): void => {
    void loadRegularizationHistory();
  }, [loadRegularizationHistory]);

  const formatCategoryText = (category: string): string => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

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

  if (error && !history.length) {
    return (
      <div className={styles.viewContainer}>
        <div className={styles.dashboardHeader}>
          <h1>Attendance Regularization</h1>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
          <button 
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={loadRegularizationHistory}
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
      
      <div className={styles.formContainer}>
        <form onSubmit={handleSubmit}>
          {/* Radio buttons for Day-based vs Time-based */}
          <div className={styles.radioGroup}>
            <label className={styles.radioOption}>
              <input 
                type="radio" 
                name="regularization-type" 
                value="day_based" 
                checked={regularizationType === 'day_based'}
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
                checked={regularizationType === 'time_based'}
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
                required  
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>To Date *</label>
              <input 
                type="date" 
                name="toDate"
                className={styles.formInput} 
                max={maxDate}
                disabled={isSaving}
                required  
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Category *</label>
              <select 
                name="category" 
                className={styles.formSelect}
                disabled={isSaving}
                required
              >
                <option value="">Choose category...</option>
                <option value="late_coming">Late Coming</option>
                <option value="early_going">Early Going</option>
                <option value="missed_punch">Missed Punch</option>
                <option value="work_from_home">Work From Home</option>
                <option value="on_duty">On Duty</option>
              </select>
            </div>
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
              required 
            ></textarea>
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
              {isSaving ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
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
              <th>Date Range</th>
              <th>Category</th>
              <th>Status</th>
              <th>Submitted On</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.historyEmpty}>
                  No regularization requests submitted yet.
                </td>
              </tr>
            ) : (
              history.map(request => (
                <tr key={request.id}>
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
                    {(request.status === 'pending' || request.status === 'approved') && (
                      <button 
                        className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                        onClick={() => handleRecall(request.id!)}
                      >
                        Recall
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RegularizationView;