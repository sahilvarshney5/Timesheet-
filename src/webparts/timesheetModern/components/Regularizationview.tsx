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
   employeeMaster: IEmployeeMaster;  // NEW
  userRole: 'Admin' | 'Manager' | 'Member';  // NEW
}

const RegularizationView: React.FC<IRegularizationViewProps> = (props) => {
  const { onViewChange, spHttpClient, siteUrl, currentUserDisplayName } = props;
  
  // Services
  const approvalService = React.useMemo(
    () => new ApprovalService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  const userService = React.useMemo(
    () => new UserService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  // State
  const [regularizationType, setRegularizationType] = React.useState<string>('day_based');
  const [history, setHistory] = React.useState<IRegularizationRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [employeeId, setEmployeeId] = React.useState<string>('');

  // Load data on mount
  React.useEffect(() => {
    loadRegularizationHistory();
  }, []);

 const loadRegularizationHistory = async (): Promise<void> => {
  try {
    setIsLoading(true);
    setError(null);

    // Get Employee ID from props
    const empId = props.employeeMaster.EmployeeID;

    console.log(`[RegularizationView] Loading history for Employee ID: ${empId}`);

    // Load regularization history from SharePoint
    const requests = await approvalService.getEmployeeRegularizations(empId);
    
    setHistory(requests);
    console.log(`[RegularizationView] Loaded ${requests.length} regularization requests`);

  } catch (err) {
    console.error('[RegularizationView] Error loading regularization history:', err);
    setError('Failed to load regularization history. Please try again.');
  } finally {
    setIsLoading(false);
  }
};

  const handleTypeChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setRegularizationType(event.target.value);
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
    
    // Validation
    if (new Date(toDate) < new Date(fromDate)) {
      alert('To Date cannot be earlier than From Date');
      setIsSaving(false);
      return;
    }
    
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
    
    // Get Employee ID from props
    const empId = props.employeeMaster.EmployeeID;
    
    // Create request object
    const newRequest: Partial<IAttendanceRegularization> = {
      EmployeeID: empId,  // Use Employee ID (R0398)
      RequestType: regularizationType === 'time_based' ? 'Time' : 'Day',
      StartDate: fromDate,
      EndDate: toDate,
      ExpectedIn: regularizationType === 'time_based' ? timeStart : undefined,
      ExpectedOut: regularizationType === 'time_based' ? timeEnd : undefined,
      Reason: `${category.replace(/_/g, ' ').toUpperCase()}: ${reason}`,
      Status: 'Pending' as 'Pending'
    };
    
    // Submit to SharePoint
    const createdRequest = await approvalService.submitRegularizationRequest(newRequest);
    
    // Add to local history
    const displayRequest: IRegularizationRequest = {
      id: createdRequest.Id,
      employeeId: empId,
      employeeName: props.employeeMaster.EmployeeDisplayName || props.currentUserDisplayName,
      requestType: regularizationType as 'day_based' | 'time_based',
      category: category as any,
      fromDate: fromDate,
      toDate: toDate,
      startTime: regularizationType === 'time_based' ? timeStart : undefined,
      endTime: regularizationType === 'time_based' ? timeEnd : undefined,
      reason: reason,
      status: 'pending',
      submittedOn: new Date().toISOString().split('T')[0]
    };
    
    setHistory(prev => [displayRequest, ...prev]);
    
    const categoryText = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    let successMessage = `Regularization request submitted successfully!\n\n`;
    successMessage += `Type: ${regularizationType === 'time_based' ? 'Time-based' : 'Day-based'}\n`;
    successMessage += `From: ${fromDate}\n`;
    successMessage += `To: ${toDate}\n`;
    successMessage += `Category: ${categoryText}\n`;
    
    if (regularizationType === 'time_based') {
      successMessage += `Time: ${timeStart} to ${timeEnd}\n`;
    }
    
    successMessage += `Reason: ${reason}\n`;
    successMessage += `Status: Pending Approval\n`;
    successMessage += `Note: Your manager will review and approve this request.`;
    
    alert(successMessage);
    
    // Reset form
    form.reset();
    setRegularizationType('day_based');
    
    // Navigate to dashboard
    onViewChange('dashboard');

  } catch (err) {
    console.error('[RegularizationView] Error submitting regularization:', err);
    alert('Failed to submit regularization request. Please try again.');
  } finally {
    setIsSaving(false);
  }
};

  const handleView = (request: IRegularizationRequest): void => {
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
  };

  const handleRecall = async (requestId: number): Promise<void> => {
    if (!confirm('Are you sure you want to recall this pending regularization request?')) {
      return;
    }

    try {
      // TODO: Implement recall/delete functionality in SharePoint
      // For now, just remove from local state
      setHistory(prev => prev.filter(req => req.id !== requestId));
      alert('Regularization request recalled successfully.');
      
      // In production, you would call:
      // await approvalService.deleteRegularizationRequest(requestId);

    } catch (err) {
      console.error('[RegularizationView] Error recalling request:', err);
      alert('Failed to recall regularization request. Please try again.');
    }
  };

  const handleCancel = async (requestId: number): Promise<void> => {
    if (!confirm('Are you sure you want to cancel this approved regularization request?')) {
      return;
    }

    try {
      // TODO: Implement cancel functionality
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

  const handleRefresh = (): void => {
    loadRegularizationHistory();
  };

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

  return (
    <div className={styles.viewContainer}>
      <div className={styles.dashboardHeader}>
        <h1>Attendance Regularization</h1>
        <p>Submit requests to regularize your attendance</p>
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
          
          <div className={styles.formRow3}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>From Date *</label>
              <input 
                type="date" 
                name="fromDate"
                className={styles.formInput} 
                defaultValue={new Date().toISOString().split('T')[0]}
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
                defaultValue={new Date().toISOString().split('T')[0]}
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
                    {request.status === 'pending' && (
                      <>
                        <button 
                          className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                          onClick={() => handleView(request)}
                        >
                          View
                        </button>
                        <button 
                          className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                          onClick={() => handleRecall(request.id!)}
                        >
                          Recall
                        </button>
                      </>
                    )}
                    {request.status === 'approved' && (
                      <>
                        <button 
                          className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                          onClick={() => handleView(request)}
                        >
                          View
                        </button>
                        <button 
                          className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                          onClick={() => handleCancel(request.id!)}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {request.status === 'rejected' && (
                      <button 
                        className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                        onClick={() => handleView(request)}
                      >
                        View
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