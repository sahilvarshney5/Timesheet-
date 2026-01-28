import * as React from 'react';
import styles from './TimesheetModern.module.scss';

export interface IRegularizationViewProps {
  onViewChange: (viewName: string) => void;
}

interface IRegularizationRequest {
  id: number;
  fromDate: string;
  toDate: string;
  type: 'day_based' | 'time_based';
  category: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedOn: string;
  reason: string;
  timeStart?: string;
  timeEnd?: string;
}

const RegularizationView: React.FC<IRegularizationViewProps> = (props) => {
  const { onViewChange } = props;
  
  const [regularizationType, setRegularizationType] = React.useState<string>('day_based');
  const [history, setHistory] = React.useState<IRegularizationRequest[]>([
    {
      id: 1,
      fromDate: '2025-01-15',
      toDate: '2025-01-15',
      type: 'day_based',
      category: 'late_coming',
      status: 'pending',
      submittedOn: '2025-01-14',
      reason: 'Traffic delay due to road construction'
    },
    {
      id: 2,
      fromDate: '2025-01-10',
      toDate: '2025-01-10',
      type: 'day_based',
      category: 'work_from_home',
      status: 'approved',
      submittedOn: '2025-01-09',
      reason: 'Working from home due to personal reasons'
    },
    {
      id: 3,
      fromDate: '2025-01-05',
      toDate: '2025-01-05',
      type: 'day_based',
      category: 'missed_punch',
      status: 'rejected',
      submittedOn: '2025-01-04',
      reason: 'Forgot to punch out after working hours'
    }
  ]);

  const handleTypeChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setRegularizationType(event.target.value);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    
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
      return;
    }
    
    if (regularizationType === 'time_based' && (!timeStart || !timeEnd)) {
      alert('Please fill in all time-based fields.');
      return;
    }
    
    if (regularizationType === 'time_based' && timeStart >= timeEnd) {
      alert('End Time must be after Start Time.');
      return;
    }
    
    // Create new request
    const newRequest: IRegularizationRequest = {
      id: Date.now(),
      fromDate: fromDate,
      toDate: toDate,
      type: regularizationType as 'day_based' | 'time_based',
      category: category,
      status: 'pending',
      submittedOn: new Date().toISOString().split('T')[0],
      reason: reason,
      timeStart: regularizationType === 'time_based' ? timeStart : undefined,
      timeEnd: regularizationType === 'time_based' ? timeEnd : undefined
    };
    
    setHistory(prev => [newRequest, ...prev]);
    
    // Format category for display
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
  };

  const handleView = (request: IRegularizationRequest): void => {
    const fromDate = new Date(request.fromDate);
    const toDate = new Date(request.toDate);
    const submittedDate = new Date(request.submittedOn);
    
    let message = `Regularization Request Details:\n\n`;
    message += `ID: ${request.id}\n`;
    message += `Type: ${request.type === 'time_based' ? 'Time-based' : 'Day-based'}\n`;
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
    
    if (request.type === 'time_based' && request.timeStart && request.timeEnd) {
      message += `Time: ${request.timeStart} to ${request.timeEnd}\n`;
    }
    
    message += `Reason: ${request.reason}\n`;
    
    alert(message);
  };

  const handleRecall = (requestId: number): void => {
    if (confirm('Are you sure you want to recall this pending regularization request?')) {
      setHistory(prev => prev.filter(req => req.id !== requestId));
      alert('Regularization request recalled successfully.');
    }
  };

  const handleCancel = (requestId: number): void => {
    if (confirm('Are you sure you want to cancel this approved regularization request?')) {
      setHistory(prev => prev.map(req => 
        req.id === requestId 
          ? { ...req, status: 'rejected' as const }
          : req
      ));
      alert('Regularization request cancelled successfully.');
    }
  };

  const handleRefresh = (): void => {
    // In production, this would fetch from SharePoint
    alert('History refreshed.');
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
                required  
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Category *</label>
              <select name="category" className={styles.formSelect} required >
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
                  required={regularizationType === 'time_based'}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>End Time *</label>
                <input 
                  type="time" 
                  name="timeEnd"
                  className={styles.formInput}
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
              required 
            ></textarea>
          </div>
          
          <div className={styles.formActions}>
            <button 
              type="button" 
              className={`${styles.btn} ${styles.btnOutline}`}
              onClick={() => onViewChange('dashboard')}
            >
              Cancel
            </button>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
              Submit Request
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
          >
            Refresh
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
                          onClick={() => handleRecall(request.id)}
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
                          onClick={() => handleCancel(request.id)}
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