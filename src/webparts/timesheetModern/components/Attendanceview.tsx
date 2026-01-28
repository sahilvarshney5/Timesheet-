import * as React from 'react';
import styles from './TimesheetModern.module.scss';

export interface IAttendanceViewProps {
  onViewChange: (viewName: string) => void;
}

const AttendanceView: React.FC<IAttendanceViewProps> = (props) => {
  const { onViewChange } = props;

  // TODO: Replace with actual data from SharePoint service
  const daysInMonth = 31;

  // Helper function to safely get CSS class names
  const getStatusClass = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      'present': styles.present,
      'absent': styles.absent,
      'holiday': styles.holiday,
      'leave': styles.leave,
      'weekend': styles.weekend,
      'empty': styles.empty
    };
    return statusMap[status] || '';
  };

  // Helper function to get progress status class
  const getProgressClass = (status: 'notFilled' | 'partial' | 'completed'): string => {
    const progressMap = {
      'notFilled': styles.notFilled,
      'partial': styles.partial,
      'completed': styles.filled // 'completed' maps to 'filled' class
    };
    return progressMap[status];
  };

  // Helper function to get leave indicator class
  const getLeaveIndicatorClass = (leaveType: string): string => {
    const leaveMap: { [key: string]: string } = {
      'sick': styles.sickLeaveIndicator,
      'casual': styles.casualLeaveIndicator,
      'earned': styles.earnedLeaveIndicator
    };
    return leaveMap[leaveType] || '';
  };

  // Helper function to get legend color class
  const getLegendColorClass = (type: string): string => {
    const legendMap: { [key: string]: string } = {
      'present': styles.present,
      'absent': styles.absent,
      'holiday': styles.holiday,
      'leave': styles.leave,
      'weekend': styles.weekend,
      'sickLeave': styles.sickLeave,
      'casualLeave': styles.casualLeave,
      'earnedLeave': styles.earnedLeave,
      'progressFilled': styles.progressFilled,
      'progressPartial': styles.progressPartial,
      'progressNotFilled': styles.progressNotFilled
    };
    return legendMap[type] || '';
  };

  return (
    <div className={styles.viewContainer}>
      <div className={styles.dashboardHeader}>
        <h1>My Attendance</h1>
        <p>Track your daily attendance and biometric records</p>
      </div>
      
      <div className={styles.calendarContainer}>
        <div className={styles.calendarHeader}>
          <div className={styles.calendarNav}>
            <button className={styles.navBtn}>←</button>
            <div className={styles.calendarMonth}>January 2025</div>
            <button className={styles.navBtn}>→</button>
          </div>
          <div className={styles.calendarActions}>
            <button className={`${styles.btn} ${styles.btnOutline}`}>Download Report</button>
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
            <div key={`empty-${i}`} className={`${styles.calendarDay} ${getStatusClass('empty')}`}></div>
          ))}
          
          {/* Calendar days - using static data for now */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
            <div key={day} className={`${styles.calendarDay} ${getStatusClass('present')}`}>
              <div className={styles.dayTopSection}>
                <div className={styles.dayNumber}>{day}</div>
                <div className={styles.dayStatus}>P</div>
              </div>
              <div className={styles.dayTotalHours}>8.0h / 8.0h</div>
              <div className={styles.dayTime}>9:00-18:00</div>
              <div className={styles.timesheetProgressBar}>
                <div 
                  className={`${styles.timesheetProgressFill} ${getProgressClass('completed')}`} 
                  style={{ width: '100%' }}
                ></div>
              </div>
            </div>
          ))}
        </div>
        
        <div className={styles.calendarLegend}>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('present')}`}></div>
            <span>Present</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('absent')}`}></div>
            <span>Absent</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('holiday')}`}></div>
            <span>Holiday</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('leave')}`}></div>
            <span>On Leave</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('weekend')}`}></div>
            <span>Weekend</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('progressFilled')}`}></div>
            <span>Timesheet: Filled</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('progressPartial')}`}></div>
            <span>Timesheet: Partial</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('progressNotFilled')}`}></div>
            <span>Timesheet: Not Filled</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceView;