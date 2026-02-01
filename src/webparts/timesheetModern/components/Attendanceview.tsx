import * as React from 'react';
import styles from './TimesheetModern.module.scss';
import { SPHttpClient } from '@microsoft/sp-http';
import { AttendanceService } from '../services/AttendanceService';
import { IEmployeeMaster, ITimesheetDay } from '../models';

export interface IAttendanceViewProps {
  onViewChange: (viewName: string) => void;
  spHttpClient: SPHttpClient;
  siteUrl: string;
  currentUserDisplayName: string;
  employeeMaster: IEmployeeMaster;
  userRole: 'Admin' | 'Manager' | 'Member';
}

const AttendanceView: React.FC<IAttendanceViewProps> = (props) => {
  const { onViewChange, spHttpClient, siteUrl } = props;

  // Services
  const attendanceService = React.useMemo(
    () => new AttendanceService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  // State
  const [currentMonth, setCurrentMonth] = React.useState<number>(new Date().getMonth());
  const [currentYear, setCurrentYear] = React.useState<number>(new Date().getFullYear());
  const [calendarDays, setCalendarDays] = React.useState<ITimesheetDay[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = React.useState<boolean>(true);
const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);

  // Monthly counts state
  const [monthlyCounts, setMonthlyCounts] = React.useState({
    present: 0,
    leave: 0,
    absent: 0,
    weekend: 0,
    holiday: 0,
    timesheetFilled: 0, // NEW
    timesheetPartial: 0, // NEW
    timesheetNotFilled: 0 // NEW
  });

  // ============================================================================
  // HELPER FUNCTIONS - DEFINED FIRST BEFORE USAGE
  // ============================================================================

  const getMonthName = (month: number): string => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[month];
  };

  const getStatusText = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      'present': 'Present',
      'absent': 'Absent',
      'holiday': 'Holiday',
      'leave': 'On Leave',
      'weekend': 'Weekend'
    };
    return statusMap[status] || status;
  };

  const getLeaveTypeName = (leaveType: string): string => {
    const leaveTypeMap: { [key: string]: string } = {
      'sick': 'Sick Leave',
      'casual': 'Casual Leave',
      'earned': 'Earned Leave'
    };
    return leaveTypeMap[leaveType] || leaveType;
  };

  const getTimesheetStatusText = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      'completed': 'Fully Filled',
      'partial': 'Partially Filled',
      'notFilled': 'Not Filled'
    };
    return statusMap[status] || status;
  };

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

  const getDayStatusClass = (status: string | undefined): string => {
    if (!status) return '';

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

  const getProgressClass = (status: 'notFilled' | 'partial' | 'completed'): string => {
    const progressMap = {
      'notFilled': styles.notFilled,
      'partial': styles.partial,
      'completed': styles.filled
    };
    return progressMap[status];
  };

  const getLeaveIndicatorClass = (leaveType: string): string => {
    const leaveMap: { [key: string]: string } = {
      'sick': styles.sickLeaveIndicator,
      'casual': styles.casualLeaveIndicator,
      'earned': styles.earnedLeaveIndicator
    };
    return leaveMap[leaveType] || '';
  };

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

  // Calculate monthly counts
  const calculateMonthlyCounts = React.useCallback((): void => {
    const counts = {
      present: 0,
      leave: 0,
      absent: 0,
      weekend: 0,
      holiday: 0,
      timesheetFilled: 0, // NEW
      timesheetPartial: 0, // NEW
      timesheetNotFilled: 0 // NEW
    };

    calendarDays.forEach(day => {
      if (day.status === 'present') counts.present++;
      else if (day.status === 'leave') counts.leave++;
      else if (day.status === 'absent') counts.absent++;
      else if (day.status === 'weekend') counts.weekend++;
      else if (day.status === 'holiday') counts.holiday++;

      // NEW: Timesheet progress counts (only for working days)
      if (day.status === 'present' && day.availableHours > 0) {
        if (day.timesheetProgress.status === 'completed') {
          counts.timesheetFilled++;
        } else if (day.timesheetProgress.status === 'partial') {
          counts.timesheetPartial++;
        } else if (day.timesheetProgress.status === 'notFilled') {
          counts.timesheetNotFilled++;
        }
      }
    });

    setMonthlyCounts(counts);
  }, [calendarDays]);

  // ============================================================================
  // DATA LOADING FUNCTIONS
  // ============================================================================

  const loadCalendarData = React.useCallback(async (isRefresh = false): Promise<void> => {
    try {
       if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsInitialLoad(true);
    }
      setIsLoading(true);
      setError(null);

      const empId = props.employeeMaster.EmployeeID;

      console.log(`[AttendanceView] Loading calendar for Employee ID: ${empId}`);

      const calendar = await attendanceService.buildCalendarForMonth(
        empId,
        currentYear,
        currentMonth + 1
      );

      setCalendarDays(calendar);
      console.log(`[AttendanceView] Loaded ${calendar.length} calendar days for ${getMonthName(currentMonth)} ${currentYear}`);

    } catch (err) {
      console.error('[AttendanceView] Error loading calendar data:', err);
      setError('Failed to load calendar data. Please try again.');
    } finally {
  setIsInitialLoad(false);
    setIsRefreshing(false);  
  setIsLoading(false);  }
  }, [props.employeeMaster.EmployeeID, attendanceService, currentYear, currentMonth]);

  const handleDownloadReport = async (): Promise<void> => {
    try {
      setIsLoading(true);

      await attendanceService.downloadAttendanceReport(
        props.employeeMaster.EmployeeID,
        currentYear,
        currentMonth + 1
      );

      alert('Attendance report downloaded successfully!');

    } catch (err) {
      console.error('[AttendanceView] Error downloading report:', err);
      alert('Failed to download attendance report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

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

  const handleDayClick = (day: ITimesheetDay): void => {
    if (day.status === 'empty') return;

    const date = new Date(day.date);
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let message = `Details for ${formattedDate}:\n\n`;
    message += `Status: ${getStatusText(day.status || '')}\n`;

    if (day.firstPunchIn) {
      message += `First Punch In: ${formatTime(day.firstPunchIn)}\n`;
    }

    if (day.lastPunchOut) {
      message += `Last Punch Out: ${formatTime(day.lastPunchOut)}\n`;
    }

    if (day.totalHours && day.totalHours > 0) {
      message += `Total Hours: ${day.totalHours.toFixed(1)}\n`;
    }

    if (day.leaveType) {
      message += `Leave Type: ${getLeaveTypeName(day.leaveType)}\n`;
    }

    const timesheetStatus = getTimesheetStatusText(day.timesheetProgress.status);
    message += `\nTimesheet Status: ${timesheetStatus}\n`;

    if (day.timesheetHours > 0) {
      message += `Timesheet Hours: ${day.timesheetHours.toFixed(1)}/${day.availableHours.toFixed(1)}\n`;
    }

    // Only prompt for timesheet if present and not completed
    if (day.status === 'present' && day.timesheetProgress.status !== 'completed') {
      message += `\nWould you like to fill timesheet for this day?`;

      if (confirm(message)) {
        // Navigate to timesheet view (simple navigation without data passing)
        onViewChange('timesheet');
      }
    } else {
      alert(message);
    }
  };

  // ============================================================================
  // CALENDAR GRID GENERATOR
  // ============================================================================

  const generateCalendarGrid = (): JSX.Element[] => {
    const grid: JSX.Element[] = [];

    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
      grid.push(
        <div key={`header-${day}`} className={styles.calendarDayHeader}>
          {day}
        </div>
      );
    });

    if (calendarDays.length > 0) {
      const firstDay = new Date(calendarDays[0].date);
      let startDay = firstDay.getDay();
      // Fix: Monday = 0, Sunday = 6
      startDay = startDay === 0 ? 6 : startDay - 1;

      for (let i = 0; i < startDay; i++) {
        grid.push(
          <div
            key={`empty-${i}`}
            className={`${styles.calendarDay} ${getDayStatusClass('empty')}`}
          />
        );
      }
    }

    calendarDays.forEach((day, index) => {
      const dayNumber = new Date(day.date).getDate();

      grid.push(
        <div
          key={`day-${index}`}
          className={`${styles.calendarDay} ${getDayStatusClass(day.status)} ${day.isToday ? styles.today : ''}`}
          onClick={() => handleDayClick(day)}
        >
          <div className={styles.dayTopSection}>
            <div className={styles.dayNumber}>{dayNumber}</div>
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

          {day.status === 'present' && day.availableHours > 0 && (
            <div className={styles.timesheetProgressBar}>
              <div
                className={`${styles.timesheetProgressFill} ${getProgressClass(day.timesheetProgress.status)}`}
                style={{ width: `${day.timesheetProgress.percentage}%` }}
              />
            </div>
          )}

          {day.leaveType && !day.isWeekend && (
            <div className={`${styles.leaveIndicator} ${getLeaveIndicatorClass(day.leaveType)}`}>
              {day.leaveType === 'sick' && 'Sick'}
              {day.leaveType === 'casual' && 'Casual'}
              {day.leaveType === 'earned' && 'Earned'}
            </div>
          )}
        </div>
      );
    });

    return grid;
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================

  React.useEffect(() => {
    loadCalendarData().catch(err => {
      console.error('[AttendanceView] Effect error:', err);
    });
  }, [currentMonth, currentYear]);

  // Refresh button
const handleRefresh = async (): Promise<void> => {
  await loadCalendarData(true);
};
  // Calculate counts when calendar changes
  React.useEffect(() => {
    calculateMonthlyCounts();
  }, [calendarDays, calculateMonthlyCounts]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isInitialLoad) {
    return (
      <div className={styles.viewContainer}>
        <div className={styles.dashboardHeader}>
          <h1>My Attendance</h1>
          <p>Loading ...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.viewContainer}>
        <div className={styles.dashboardHeader}>
          <h1>My Attendance</h1>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => { loadCalendarData().catch(console.error); }}
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
        <h1>My Attendance</h1>
        <p>Track your daily attendance and biometric records</p>
      </div>
          {isRefreshing && <div>Refreshing...</div>}


      <div className={styles.calendarContainer}>
        <div className={styles.calendarHeader}>
          <div className={styles.calendarNav}>
            <button
              className={styles.navBtn}
              onClick={() => handleMonthChange(-1)}
              disabled={isLoading}
            >
              ←
            </button>
            <div className={styles.calendarMonth}>
              {getMonthName(currentMonth)} {currentYear}
            </div>
            <button
              className={styles.navBtn}
              onClick={() => handleMonthChange(1)}
              disabled={isLoading}
            >
              →
            </button>
          </div>
          <div className={styles.calendarActions}>
            <button
              className={`${styles.btn} ${styles.btnOutline}`}
              onClick={() => { handleDownloadReport().catch(console.error); }}
              disabled={isLoading}
            >
              Download Report
            </button>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => onViewChange('regularize')}
              disabled={isLoading}
            >
              Request Regularization
            </button>
          </div>
        </div>

        {/* Legend with counts at top */}
        <div className={styles.calendarLegend} style={{ marginBottom: '1rem', marginTop: 0 }}>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('present')}`}>
              <span className={styles.legendCount}>{monthlyCounts.present}</span>
            </div>
            <span>Present</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('absent')}`}>
              <span className={styles.legendCount}>{monthlyCounts.absent}</span>
            </div>
            <span>Absent</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('holiday')}`} >
              <span className={styles.legendCount}>{monthlyCounts.holiday}</span>
            </div>
            <span>Holiday</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('leave')}`}>
              <span className={styles.legendCount}>{monthlyCounts.leave}</span>
            </div>
            <span>On Leave</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('weekend')}`}>
              <span className={styles.legendCount}>{monthlyCounts.weekend}</span>
            </div>
            <span>Weekend</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('progressFilled')}`} >
              <span className={styles.legendCount}>{monthlyCounts.timesheetFilled}</span>
            </div>
            <span>Timesheet: Filled</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('progressPartial')}`} >
              <span className={styles.legendCount}>{monthlyCounts.timesheetPartial}</span>
            </div>

            <span>Timesheet: Partial</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('progressNotFilled')}`} >
              <span className={styles.legendCount}>{monthlyCounts.timesheetNotFilled}</span>
            </div>
            <span>Timesheet: Not Filled</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className={styles.calendarGrid}>
          {generateCalendarGrid()}
        </div>
      </div>
    </div>
  );
};

export default AttendanceView;