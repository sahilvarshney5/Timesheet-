import * as React from 'react';
import styles from './TimesheetModern.module.scss';

export interface ITimesheetViewProps {
  onViewChange: (viewName: string) => void;
}

const TimesheetView: React.FC<ITimesheetViewProps> = (props) => {
  const { onViewChange } = props;

  // TODO: Replace with actual data from SharePoint service

  return (
    <div className={styles.viewContainer}>
      <div className={styles.dashboardHeader}>
        <h1>Timesheet Entries</h1>
        <p>Log your daily work hours and project allocations</p>
      </div>
      
      <div className={styles.timesheetContainer}>
        {/* Week Navigation */}
        <div className={styles.weekNavigation}>
          <button className={styles.weekNavBtn} >← Previous Week</button>
          <div className={styles.weekDisplay}>Week of Jan 20-26, 2025</div>
          <button className={styles.weekNavBtn} >Next Week →</button>
        </div>
        
        <div className={styles.timesheetHeader}>
          <div>
            <h3>Week of Jan 20-26, 2025</h3>
            <p>Log hours worked on each project daily (Max 9 hours per day)</p>
          </div>
          <div className={styles.timesheetActions}>
            <div className={styles.availableHoursDisplay}>
              <span>Available Hours:</span>
              <span>9</span>/9
            </div>
            <button className={`${styles.btn} ${styles.btnPurple}`} >+ Add Entry</button>
          </div>
        </div>
        
        {/* Timesheet Grid */}
        <div className={styles.timesheetGrid}>
          {/* Monday - Today with entries */}
          <div className={`${styles.timesheetDay} ${styles.todayHighlight}`}>
            <div className={styles.timesheetDayHeader}>
              <div className={styles.dayInfo}>
                <div className={styles.dayDate}>Mon, Jan 20 (Today) (Present)</div>
                <span className={`${styles.dayStatusBadge} ${styles.pending}`}>Pending</span>
              </div>
              <div className={styles.dayTotal}>7.0h / 7.0h</div>
            </div>
            
            <div className={styles.timesheetEntries}>
              <div className={styles.timesheetEntry}>
                <div className={styles.entryHeader}>
                  <div className={styles.projectName}>Project Alpha</div>
                  <div className={styles.entryHours}>3.5h</div>
                </div>
                <div className={styles.entryDescription}>
                  Implemented user authentication module with React hooks
                </div>
                <div className={styles.entryActions}>
                  <button className={`${styles.entryActionBtn} ${styles.editBtn}`} >
                    <span>✏️</span> Edit
                  </button>
                  <button className={`${styles.entryActionBtn} ${styles.deleteBtn}`} >
                    <span>🗑️</span> Delete
                  </button>
                </div>
              </div>
              
              <div className={styles.timesheetEntry}>
                <div className={styles.entryHeader}>
                  <div className={styles.projectName}>Project Beta</div>
                  <div className={styles.entryHours}>2.0h</div>
                </div>
                <div className={styles.entryDescription}>
                  Weekly sprint planning and team sync
                </div>
                <div className={styles.entryActions}>
                  <button className={`${styles.entryActionBtn} ${styles.editBtn}`} >
                    <span>✏️</span> Edit
                  </button>
                  <button className={`${styles.entryActionBtn} ${styles.deleteBtn}`} >
                    <span>🗑️</span> Delete
                  </button>
                </div>
              </div>
            </div>
            
            <button className={styles.addEntryBtn} >
              + Add Entry for Mon, Jan 20 (2.0h available)
            </button>
          </div>
          
          {/* Tuesday - No entries */}
          <div className={styles.timesheetDay}>
            <div className={styles.timesheetDayHeader}>
              <div className={styles.dayInfo}>
                <div className={styles.dayDate}>Tue, Jan 21 (Present)</div>
                <span className={`${styles.dayStatusBadge} ${styles.pending}`}>Pending</span>
              </div>
              <div className={styles.dayTotal}>0.0h / 8.0h</div>
            </div>
            
            <div className={styles.timesheetEntries}></div>
            
            <button className={styles.addEntryBtn} >
              + Add Entry for Tue, Jan 21 (8.0h available)
            </button>
          </div>

          {/* Wednesday - No entries */}
          <div className={styles.timesheetDay}>
            <div className={styles.timesheetDayHeader}>
              <div className={styles.dayInfo}>
                <div className={styles.dayDate}>Wed, Jan 22 (Present)</div>
                <span className={`${styles.dayStatusBadge} ${styles.pending}`}>Pending</span>
              </div>
              <div className={styles.dayTotal}>0.0h / 8.0h</div>
            </div>
            
            <div className={styles.timesheetEntries}></div>
            
            <button className={styles.addEntryBtn} >
              + Add Entry for Wed, Jan 22 (8.0h available)
            </button>
          </div>
        </div>

        {/* Submit Timesheet Button */}
        <button className={styles.submitTimesheetBtn} >
          <span>✓</span> Submit Timesheet
        </button>
      </div>
      
      <div className={styles.timesheetSummary}>
        <div className={styles.summaryItem}>
          <div className={styles.summaryValue}>7.0</div>
          <div className={styles.summaryLabel}>Total Hours</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryValue}>1/7</div>
          <div className={styles.summaryLabel}>Days Submitted</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryValue}>7.0</div>
          <div className={styles.summaryLabel}>Project Hours</div>
        </div>
      </div>
    </div>
  );
};

export default TimesheetView;