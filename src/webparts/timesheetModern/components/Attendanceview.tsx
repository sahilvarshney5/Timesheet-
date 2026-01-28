import * as React from 'react';
import styles from './TimesheetModern.module.scss';
import { AttendanceService } from '../services/AttendanceService';
import { UserService } from '../services/UserService';
import { ITimesheetDay } from '../models';
import { SPHttpClient } from '@microsoft/sp-http';

export interface IAttendanceViewProps {
  onViewChange: (viewName: string) => void;
  spHttpClient: SPHttpClient;
  siteUrl: string;
  currentUserDisplayName: string;
}

const AttendanceView: React.FC<IAttendanceViewProps> = (props) => {
  const { onViewChange, spHttpClient, siteUrl } = props;

  // State
  const [calendarDays, setCalendarDays] = React.useState<ITimesheetDay[]>([]);
  const [currentMonth, setCurrentMonth] = React.useState<number>(new Date().getMonth());
  const [currentYear, setCurrentYear] = React.useState<number>(new Date().getFullYear());
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  // Services
  const attendanceService = React.useMemo(
    () => new AttendanceService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  const userService = React.useMemo(
    () => new UserService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  // Load calendar data on mount and when month changes
  React.useEffect(() => {
    loadCalendarData();
  }, [currentMonth, currentYear]);

  const loadCalendarData = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const user = await userService.getCurrentUser();
      const employeeId = user.EmployeeCode || user.Id.toString();

      // Build calendar for current month
      const calendar = await attendanceService.buildCalendarForMonth(
        employeeId,
        currentYear,
        currentMonth + 1 // Month is 0-indexed in JS, 1-indexed in service
      );

      setCalendarDays(calendar);

    } catch (err) {
      console.error('[AttendanceView] Error loading calendar data:', err);
      setError('Failed to load attendance data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMonthChange = (direction: number): void => {
    let newMonth = currentMonth + direction;
    let newYear = currentYear;

    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }

    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  const getMonthName = (): string => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[currentMonth]} ${currentYear}`;
  };

  const formatTime = (dateTime?: string): string => {
    if (!dateTime) return '';
    const date = new Date(dateTime);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const renderCalendarDay = (day: ITimesheetDay): JSX.Element => {
    const dayClasses = [styles.calendarDay];
    
    if (day.status) {
      dayClasses.push(styles[day.status]);
    }
    
    if (day.isToday) {
      dayClasses.push(styles.today);
    }

    // Get progress status for timesheet
    const progressClass = styles[day.timesheetProgress.status];

    return (
      <div key={day.date} className={dayClasses.join(' ')}>
        <div className={styles.dayTopSection}>
          <div className={styles.dayNumber}>{day.dayNumber}</div>
          <div className={styles.dayStatus}>
            {day.status === 'present' && 'P'}
            {day.status === 'absent' && 'A'}
            {day.status === 'holiday' && 'H'}
            {day.status === 'leave' && 'L'}
            {day.status === 'weekend' && 'W'}
          </div>
        </div>

        {day.status === 'present' && day.availableHours > 0 && (
          <div className={styles.dayTotalHours}>
            {day.timesheetHours.toFixed(1)}h / {day.availableHours.toFixed(1)}h
          </div>
        )}

        {day.firstPunchIn && day.lastPunchOut && (
          <div className={styles.dayTime}>
            {formatTime(day.firstPunchIn)}-{formatTime(day.lastPunchOut)}
          </div>
        )}

        {day.leaveType && day.status === 'leave' && !day.isWeekend && (
          <div className={`${styles.leaveIndicator} ${styles[`${day.leaveType}LeaveIndicator`]}`}>
            {day.leaveType === 'sick' && 'Sick'}
            {day.leaveType === 'casual' && 'Casual'}
            {day.leaveType === 'earned' && 'Earned'}
          </div>
        )}

        {day.status === 'present' && day.availableHours > 0 && (
          <div className={styles.timesheetProgressBar}>
            <div 
              className={`${styles.timesheetProgressFill} ${progressClass}`}
              style={{ width: `${day.timesheetProgress.percentage}%` }}
            />
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={styles.viewContainer}>
        <div className={styles.dashboardHeader}>
          <h1>My Attendance</h1>
          <p>Loading attendance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.viewContainer}>
        <div className={styles.dashboardHeader}>
          <h1>My Attendance</h1>
          <p>{error}</p>
          <button 
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={loadCalendarData}
            style={{ marginTop: '1rem' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Calculate first day offset for calendar grid
  const firstDay = calendarDays.length > 0 ? new Date(calendarDays[0].date).getDay() : 0;
  const firstDayOffset = firstDay === 0 ? 6 : firstDay - 1; // Convert Sunday=0 to Monday=0

  return (
    <div className={styles.viewContainer}>
      <div className={styles.dashboardHeader}>
        <h1>My Attendance</h1>
        <p>Track your daily attendance and biometric records</p>
      </div>
      
      <div className={styles.calendarContainer}>
        <div className={styles.calendarHeader}>
          <div className={styles.calendarNav}>
            <button className={styles.navBtn} onClick={() => handleMonthChange(-1)}>←</button>
            <div className={styles.calendarMonth}>{getMonthName()}</div>
            <button className={styles.navBtn} onClick={() => handleMonthChange(1)}>→</button>
          </div>
          <div className={styles.calendarActions}>
            <button className={`${styles.btn} ${styles.btnOutline}`}>Download Report</button>
            <button 
              className={`${styles.btn} ${styles.btnPrimary}`} 
              onClick={() => onViewChange('regularize')}
            >
              Request Regularization
            </button>
          </div>
        </div>
        
        <div className={styles.calendarGrid}>
          {/* Day Headers */}
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className={styles.calendarDayHeader}>{day}</div>
          ))}
          
          {/* Empty cells for first week padding */}
          {Array.from({ length: firstDayOffset }, (_, i) => (
            <div key={`empty-${i}`} className={`${styles.calendarDay} ${styles.empty}`}></div>
          ))}
          
          {/* Calendar days */}
          {calendarDays.map(day => renderCalendarDay(day))}
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