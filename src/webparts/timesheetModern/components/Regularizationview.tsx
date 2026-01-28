import * as React from 'react';
import styles from './TimesheetModern.module.scss';

export interface IRegularizationViewProps {
  onViewChange: (viewName: string) => void;
}

const RegularizationView: React.FC<IRegularizationViewProps> = (props) => {
  const { onViewChange } = props;
  const [regularizationType, setRegularizationType] = React.useState<string>('day_based');

  const handleTypeChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setRegularizationType(event.target.value);
  };

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    // TODO: Implement form submission to SharePoint
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
              <input type="date" className={styles.formInput} required disabled />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>To Date *</label>
              <input type="date" className={styles.formInput} required disabled />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Category *</label>
              <select className={styles.formSelect} required disabled>
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
                <input type="time" className={styles.formInput} disabled />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>End Time *</label>
                <input type="time" className={styles.formInput} disabled />
              </div>
            </div>
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Reason *</label>
            <textarea 
              className={styles.formTextarea} 
              placeholder="Explain why you need attendance regularization..." 
              required 
              disabled
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
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled>
              Submit Request
            </button>
          </div>
        </form>
      </div>
      
      {/* Regularization History */}
      <div className={styles.regularizationHistory}>
        <div className={styles.historyHeader}>
          <h3>Regularization History</h3>
          <button className={`${styles.btn} ${styles.btnOutline}`} disabled>Refresh</button>
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
            <tr>
              <td>Jan 15, 2025</td>
              <td>Late Coming</td>
              <td><span className={`${styles.statusBadge} ${styles.statusPending}`}>Pending</span></td>
              <td>Jan 14, 2025</td>
              <td>
                <button className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`} disabled>View</button>
                <button className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`} disabled>Recall</button>
              </td>
            </tr>
            <tr>
              <td>Jan 10, 2025</td>
              <td>Work From Home</td>
              <td><span className={`${styles.statusBadge} ${styles.statusApproved}`}>Approved</span></td>
              <td>Jan 9, 2025</td>
              <td>
                <button className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`} disabled>View</button>
                <button className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`} disabled>Cancel</button>
              </td>
            </tr>
            <tr>
              <td>Jan 5, 2025</td>
              <td>Missed Punch</td>
              <td><span className={`${styles.statusBadge} ${styles.statusRejected}`}>Rejected</span></td>
              <td>Jan 4, 2025</td>
              <td>
                <button className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`} disabled>View</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RegularizationView;