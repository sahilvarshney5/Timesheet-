import * as React from 'react';
import styles from './TimesheetModern.module.scss';

export interface IAttendanceViewProps {
  onViewChange: (viewName: string) => void;
}

const AttendanceView: React.FC<IAttendanceViewProps> = (props) => {
  const { onViewChange } = props;

  // TODO: Replace with actual data from SharePoint service
  const daysInMonth = 31;

  return (
    <div className={styles.viewContainer}>
      <div className={styles.dashboardHeader}>
        <h1>My Attendance</h1>
        <p>Track your daily attendance and biometric records</p>
      </div>
      
      <div className={styles.calendarContainer}>
        <div className={styles.calendarHeader}>
          <div className={styles.calendarNav}>
            <button className={styles.navBtn} >←</button>
            <div className={styles.calendarMonth}>January 2025</div>
            <button className={styles.navBtn} >→</button>
          </div>
          <div className={styles.calendarActions}>
            <button className={`${styles.btn} ${styles.btnOutline}`} >Download Report</button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => onViewChange('regularize')}>
              Request Regularization
            </button>
          </div>
        </div>
        
        <div className={styles.calendarGrid}>
          {/* Day Headers */}
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className={styles.calendarDayHeader}>{day}</div>
          ))}
          
          {/* Empty cells for padding */}
          {[1, 2, 3].map(i => (
            <div key={`empty-${i}`} className={`${styles.calendarDay} ${styles.empty}`}></div>
          ))}
          
          {/* Calendar days - using static data for now */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
            <div key={day} className={`${styles.calendarDay} ${styles.present}`}>
              <div className={styles.dayTopSection}>
                <div className={styles.dayNumber}>{day}</div>
                <div className={styles.dayStatus}>P</div>
              </div>
              <div className={styles.dayTotalHours}>8.0h / 8.0h</div>
              <div className={styles.dayTime}>9:00-18:00</div>
              <div className={styles.timesheetProgressBar}>
                <div className={`${styles.timesheetProgressFill} ${styles.filled}`} style={{ width: '100%' }}></div>
              </div>
            </div>
          ))}
        </div>
        
        <div className={styles.calendarLegend}>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.present}`}></div>
            <span>Present</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.absent}`}></div>
            <span>Absent</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.holiday}`}></div>
            <span>Holiday</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.leave}`}></div>
            <span>On Leave</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.weekend}`}></div>
            <span>Weekend</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.progressFilled}`}></div>
            <span>Timesheet: Filled</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.progressPartial}`}></div>
            <span>Timesheet: Partial</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${styles.progressNotFilled}`}></div>
            <span>Timesheet: Not Filled</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceView;