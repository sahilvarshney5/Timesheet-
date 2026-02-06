// ============================================================================
// ATTENDANCEVIEW.TSX - UPDATED WITH TIMESHEET FILL STATUS
// ============================================================================
// This file integrates the timesheet fill status calculation into the calendar
// It fetches timesheet lines and shows color-coded progress bars based on fill percentage
// ============================================================================

import * as React from 'react';
import styles from './TimesheetModern.module.scss';
import { SPHttpClient } from '@microsoft/sp-http';
import { AttendanceService } from '../services/AttendanceService';
import { TimesheetService } from '../services/TimesheetService';
import { ApprovalService } from '../services/ApprovalService';
import { IEmployeeMaster, ITimesheetDay, ITimesheetLines } from '../models';
import { getTimesheetFillStatus } from '../utils/TimesheetStatusUtils';
import { HolidayService, IHolidayMaster } from '../services/HolidayService';
export interface IAttendanceViewProps {
  onViewChange: (viewName: string, data?: any) => void;
  spHttpClient: SPHttpClient;
  siteUrl: string;
  currentUserDisplayName: string;
  employeeMaster: IEmployeeMaster;
  userRole: 'Admin' | 'Manager' | 'Member';
}

interface IHoliday {
  date: string;
  name: string;
}

// const HOLIDAYS: IHoliday[] = [
//   { date: '2026-01-14', name: 'Lohri' },
//   { date: '2026-01-15', name: 'Makar Sankranti' },
//   { date: '2026-01-26', name: 'Republic Day' },
//   { date: '2026-03-05', name: 'Holi' },
//   { date: '2026-03-06', name: 'Holi' }
// ];

const createLocalDate = (year: number, month: number, day: number): Date => {
  return new Date(year, month, day, 0, 0, 0, 0);
};

const getTodayLocal = (): Date => {
  const now = new Date();
  return createLocalDate(now.getFullYear(), now.getMonth(), now.getDate());
};

const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
};

const isDateBefore = (date1: Date, date2: Date): boolean => {
  const d1 = createLocalDate(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = createLocalDate(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return d1 < d2;
};

const isTodayDate = (date: Date): boolean => {
  return isSameDay(date, getTodayLocal());
};

const isDateAfter = (date1: Date, date2: Date): boolean => {
  const d1 = createLocalDate(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = createLocalDate(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return d1 > d2;
};

const formatDateForDisplay = (date: Date, options?: Intl.DateTimeFormatOptions): string => {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...options
  };
  return date.toLocaleDateString('en-US', defaultOptions);
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
    'weekend': 'Weekend',
    'future': 'Future Date',
    'regularized': 'Regularized'
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

const AttendanceView: React.FC<IAttendanceViewProps> = (props) => {
  const { onViewChange, spHttpClient, siteUrl } = props;

  const attendanceService = React.useMemo(
    () => new AttendanceService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  const timesheetService = React.useMemo(
    () => new TimesheetService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  const approvalService = React.useMemo(
    () => new ApprovalService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  const [currentMonth, setCurrentMonth] = React.useState<number>(new Date().getMonth());
  const [currentYear, setCurrentYear] = React.useState<number>(new Date().getFullYear());
  const [calendarDays, setCalendarDays] = React.useState<ITimesheetDay[]>([]);
  const [regularizedDates, setRegularizedDates] = React.useState<Set<string>>(new Set());
  const [timesheetLines, setTimesheetLines] = React.useState<ITimesheetLines[]>([]); // ✅ NEW: Store timesheet data
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = React.useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  const [showPopup, setShowPopup] = React.useState(false);
const [selectedDay, setSelectedDay] = React.useState<any>(null);
const isLoadingRef = React.useRef(false);

const [holidayDates, setHolidayDates] = React.useState<Map<string, string>>(new Map());
  const [monthlyCounts, setMonthlyCounts] = React.useState({
    present: 0,
    leave: 0,
    absent: 0,
    weekend: 0,
    holiday: 0,
    future: 0,
    regularized: 0,
    timesheetFilled: 0,
    timesheetPartial: 0,
    timesheetNotFilled: 0
  });

  const holidayService = React.useMemo(
  () => new HolidayService(spHttpClient, siteUrl),
  [spHttpClient, siteUrl]
);
const normalizeDateString = (dateString: string): string => {
  return dateString.split('T')[0]; // Returns YYYY-MM-DD
};
const isHoliday = React.useCallback((date: string): IHoliday | null => {
  const dateStr = normalizeDateString(date);
  const holidayName = holidayDates.get(dateStr);
  
  if (holidayName) {
    return { date: dateStr, name: holidayName };
  }
  
  return null;
}, [holidayDates]);
const loadHolidaysForMonth = React.useCallback(
  async (year: number, month: number): Promise<Map<string, string>> => {
    try {
      const holidays = await holidayService.getHolidaysForMonth(year, month);

      const holidayMap = new Map<string, string>();
      holidays.forEach((holiday: IHolidayMaster) => {
        const normalizedDate = normalizeDateString(holiday.HolidayDate);
        holidayMap.set(normalizedDate, holiday.Title);
      });

      // keep state for UI / tooltip usage
      setHolidayDates(holidayMap);

      return holidayMap; // ✅ KEY FIX
    } catch (error) {
      console.error('[AttendanceView] Error loading holidays:', error);
      setHolidayDates(new Map());
      return new Map();
    }
  },
  [holidayService]
);
  const onDayClick = (dayData: any) => {
  setSelectedDay(dayData);
  setShowPopup(true);
};

  // ✅ NEW: Load timesheet lines for the month
  const getTimesheetLinesForMonth = React.useCallback(async (year: number, month: number): Promise<ITimesheetLines[]> => {
    try {
      const empId = props.employeeMaster.EmployeeID;
      const startDate = createLocalDate(year, month, 1);
      const endDate = createLocalDate(year, month + 1, 0);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Get or create timesheet header for this week/month
      let timesheetHeader = await timesheetService.getTimesheetHeader(empId, startDateStr, endDateStr);

      if (!timesheetHeader) {
        console.log(`[AttendanceView] No timesheet header found for ${empId} at ${startDateStr}`);
        return [];
      }

      const lines = await timesheetService.getTimesheetLines(timesheetHeader.Id!);
      
      console.log(`[AttendanceView] Loaded ${lines.length} timesheet lines for month ${month + 1}/${year}`);
      
      return lines;
    } catch (error) {
      console.error('[AttendanceView] Error getting timesheet lines:', error);
      return [];
    }
  }, [props.employeeMaster.EmployeeID, timesheetService]);

  const getRegularizedDatesForMonth = React.useCallback(async (): Promise<Set<string>> => {
    try {
      const empId = props.employeeMaster.EmployeeID;
      const regularizations = await approvalService.getEmployeeRegularizations(empId);
      
      const approvedDates = new Set<string>();
      regularizations.forEach(reg => {
        if (reg.status === 'approved' || reg.status === 'pending') {
          const fromDate = new Date(reg.fromDate);
          const toDate = new Date(reg.toDate);
          
          const currentDate = new Date(fromDate);
          while (currentDate <= toDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            approvedDates.add(dateStr);
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
      });
      
      return approvedDates;
    } catch (error) {
      console.error('[AttendanceView] Error getting regularized dates:', error);
      return new Set();
    }
  }, [props.employeeMaster.EmployeeID, approvalService]);

  const loadCalendarData = React.useCallback(async (isRefresh: boolean = false): Promise<void> => {
     // ✅ Prevent duplicate calls
  if (isLoadingRef.current) {
    console.log('[AttendanceView] Already loading, skipping duplicate call');
    return;
  }
  isLoadingRef.current = true;
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsInitialLoad(true);
      }
      setIsLoading(true);
      setError(null);

      const empId = props.employeeMaster.EmployeeID;
    const holidayMap = await loadHolidaysForMonth(currentYear, currentMonth);
      // ✅ PARALLEL LOADING: Fetch all data at once
      const [calendar, timesheetLinesData, regularizedDatesSet] = await Promise.all([
        attendanceService.buildCalendarForMonth(empId, currentYear, currentMonth + 1),
        getTimesheetLinesForMonth(currentYear, currentMonth),
        getRegularizedDatesForMonth()
      ]);

      // ✅ STORE TIMESHEET LINES IN STATE
      setTimesheetLines(timesheetLinesData);
      setRegularizedDates(regularizedDatesSet);

      const todayLocal = getTodayLocal();

      // ✅ ENHANCED CALENDAR: Calculate timesheet fill status for each day
      const enhancedCalendar = calendar.map(day => {
        const [year, month, dayNum] = day.date.split('-').map(Number);
        const dayDate = createLocalDate(year, month - 1, dayNum);
        
        let finalStatus = day.status;
        let finalLeaveType = day.leaveType;

        const holidayName = holidayMap.get(day.date);
      const isHolidayDay = !!holidayName;

        // const holiday = isHoliday(day.date);
        const isRegularized = regularizedDatesSet.has(day.date);
        const isFuture = isDateAfter(dayDate, todayLocal);
        const isPast = isDateBefore(dayDate, todayLocal);
        const isCurrentDay = isTodayDate(dayDate);
        const todayStr = dayDate.toISOString().split('T')[0];

        if (isHolidayDay) {
          finalStatus = 'holiday';
          finalLeaveType = undefined;
        } else if (day.status === 'weekend') {
          finalStatus = 'weekend';
        } else if (day.status === 'leave') {
          finalStatus = 'leave';
          finalLeaveType = day.leaveType;
        } else if (isRegularized) {
          finalStatus = 'regularized';
        } else if (day.status === 'present') {
          finalStatus = 'present';
        } else if (isCurrentDay && calendar.some(d => d.date === todayStr && d.firstPunchIn)) {
          finalStatus = 'present';
        } else if (isPast) {
          finalStatus = 'absent';
        } else if (isFuture) {
          finalStatus = 'future';
        }

        // ✅ CALCULATE TIMESHEET FILL STATUS
        const fillStatus = getTimesheetFillStatus(
          day.date,
          timesheetLinesData,
          day.availableHours || 8
        );

        let timesheetStatus: 'notFilled' | 'partial' | 'completed' = 'notFilled';
        let timesheetPercentage = 0;

        if ((finalStatus === 'present' || finalStatus === 'regularized') && fillStatus.expectedDailyHours > 0) {
          if (fillStatus.status === 'FULL') {
            timesheetStatus = 'completed';
            timesheetPercentage = 100;
          } else if (fillStatus.status === 'PARTIAL') {
            timesheetStatus = 'partial';
            timesheetPercentage = fillStatus.percentage;
          } else {
            timesheetStatus = 'notFilled';
            timesheetPercentage = 0;
          }
        }

        return {
          ...day,
          status: finalStatus,
          leaveType: finalLeaveType,
          timesheetHours: fillStatus.totalFilledHours,
          timesheetProgress: {
            percentage: timesheetPercentage,
            status: timesheetStatus
          }
        };
      });

      setCalendarDays(enhancedCalendar);

    } catch (err) {
      console.error('[AttendanceView] Error loading calendar data:', err);
      setError('Failed to load calendar data. Please try again.');
    } finally {
      setIsInitialLoad(false);
      setIsRefreshing(false);
      setIsLoading(false);
          isLoadingRef.current = false;

    }
  }, [props.employeeMaster.EmployeeID, attendanceService, currentYear, currentMonth, getTimesheetLinesForMonth, getRegularizedDatesForMonth,loadHolidaysForMonth]);

  const calculateMonthlyCounts = React.useCallback((): void => {
    const counts = {
      present: 0,
      leave: 0,
      absent: 0,
      weekend: 0,
      holiday: 0,
      future: 0,
      regularized: 0,
      timesheetFilled: 0,
      timesheetPartial: 0,
      timesheetNotFilled: 0
    };

    calendarDays.forEach(day => {
      if (day.status === 'present') counts.present++;
      else if (day.status === 'leave') counts.leave++;
      else if (day.status === 'absent') counts.absent++;
      else if (day.status === 'weekend') counts.weekend++;
      else if (day.status === 'holiday') counts.holiday++;
      else if (day.status === 'future') counts.future++;
      else if (day.status === 'regularized') counts.regularized++;

      if ((day.status === 'present' || day.status === 'regularized') && day.availableHours > 0) {
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

  const handleMonthChange = React.useCallback((direction: number): void => {
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
  }, [currentMonth, currentYear]);

  const handleDownloadReport = React.useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      await attendanceService.downloadAttendanceReport(props.employeeMaster.EmployeeID, currentYear, currentMonth + 1);
      alert('Attendance report downloaded successfully!');
    } catch (err) {
      console.error('[AttendanceView] Error downloading report:', err);
      alert('Failed to download attendance report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [attendanceService, props.employeeMaster.EmployeeID, currentYear, currentMonth]);

  const handleRefresh = React.useCallback(async (): Promise<void> => {
    await loadCalendarData();
  }, [loadCalendarData]);

  const handleDayClick = React.useCallback((day: ITimesheetDay): void => {
    if (day.status === 'empty' || day.status === 'future') return;

    const dayDate = createLocalDate(
      parseInt(day.date.split('-')[0]),
      parseInt(day.date.split('-')[1]) - 1,
      parseInt(day.date.split('-')[2])
    );

    const formattedDate = formatDateForDisplay(dayDate, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const holiday = isHoliday(day.date);
    const isRegularized = regularizedDates.has(day.date);
onDayClick(day);

    // let message = `Details for ${formattedDate}:\n\n`;
    
    // if (holiday) {
    //   message += `Holiday: ${holiday.name}\n\n`;
    // }
    
    // message += `Status: ${getStatusText(day.status || '')}\n`;

    // if (isRegularized) {
    //   message += `Regularization: Raised\n`;
    // }

    // if (day.status === 'present' || day.status === 'regularized') {
    //   if (day.firstPunchIn) {
    //     message += `First Punch In: ${formatTime(day.firstPunchIn)}\n`;
    //   }

    //   if (day.lastPunchOut) {
    //     message += `Last Punch Out: ${formatTime(day.lastPunchOut)}\n`;
    //   }

    //   if (day.availableHours > 0) {
    //     message += `Available Hours: ${day.availableHours.toFixed(1)}\n`;
    //   }
    // }

    // if (day.totalHours && day.totalHours > 0) {
    //   message += `Total Hours: ${day.totalHours.toFixed(1)}\n`;
    // }

    // if (day.leaveType) {
    //   message += `Leave Type: ${getLeaveTypeName(day.leaveType)}\n`;
    // }

    // const timesheetStatus = getTimesheetStatusText(day.timesheetProgress.status);
    // message += `\nTimesheet Status: ${timesheetStatus}\n`;

    // if (day.timesheetHours > 0) {
    //   message += `Timesheet Hours: ${day.timesheetHours.toFixed(1)}/${day.availableHours.toFixed(1)}\n`;
    // }

    // if (day.status === 'present' || day.status === 'regularized') {
    //   message += `\n\nActions:\n`;
    //   message += `1. Create Timesheet Entry\n`;
    //   message += `2. Request Regularization\n\n`;
    //   message += `What would you like to do?`;

    //   const action = prompt(message + "\n\nType '1' for Timesheet or '2' for Regularization:");
      
    //   if (action === '1') {
    //     onViewChange('timesheet', { date: day.date });
    //   } else if (action === '2') {
    //     onViewChange('regularize', { date: day.date });
    //   }
    // } else {
    //   alert(message);
    // }
  }, [onViewChange, isHoliday, regularizedDates]);

  const getDayStatusClass = React.useCallback((status: string | undefined, timesheetStatus?: string, isRegularized?: boolean): string => {
    if (!status) return '';

    if (status === 'regularized') {
      return `${styles.present} ${styles.regularized}`;
    }

    if (status === 'present') {
      if (timesheetStatus === 'completed') {
        return `${styles.present} ${styles.progressFilled}`;
      } else if (timesheetStatus === 'partial') {
        return `${styles.present} ${styles.progressPartial}`;
      } else {
        return `${styles.present} ${styles.progressNotFilled}`;
      }
    }

    const statusMap: { [key: string]: string } = {
      'absent': styles.absent,
      'holiday': styles.holiday,
      'leave': styles.leave,
      'weekend': styles.weekend,
      'empty': styles.empty,
      'future': styles.weekend
    };
    return statusMap[status] || '';
  }, []);

  const getProgressClass = React.useCallback((status: 'notFilled' | 'partial' | 'completed'): string => {
    const progressMap = {
      'notFilled': styles.notFilled,
      'partial': styles.partial,
      'completed': styles.filled
    };
    return progressMap[status];
  }, []);

  const getLeaveIndicatorClass = React.useCallback((leaveType: string): string => {
    const leaveMap: { [key: string]: string } = {
      'sick': styles.sickLeaveIndicator,
      'casual': styles.casualLeaveIndicator,
      'earned': styles.earnedLeaveIndicator
    };
    return leaveMap[leaveType] || '';
  }, []);

  const getLegendColorClass = React.useCallback((type: string): string => {
    const legendMap: { [key: string]: string } = {
      'present': styles.present,
      'absent': styles.absent,
      'holiday': styles.holiday,
      'leave': styles.leave,
      'weekend': styles.weekend,
      'regularized': styles.regularized,
      'sickLeave': styles.sickLeave,
      'casualLeave': styles.casualLeave,
      'earnedLeave': styles.earnedLeave,
      'progressFilled': styles.progressFilled,
      'progressPartial': styles.progressPartial,
      'progressNotFilled': styles.progressNotFilled
    };
    return legendMap[type] || '';
  }, []);

  const generateCalendarGrid = React.useCallback((): JSX.Element[] => {
    const grid: JSX.Element[] = [];

    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
      grid.push(
        <div key={`header-${day}`} className={styles.calendarDayHeader}>
          {day}
        </div>
      );
    });

    if (calendarDays.length > 0) {
      const firstDayString = calendarDays[0].date;
      const [year, month, day] = firstDayString.split('-').map(Number);
      const firstDay = createLocalDate(year, month - 1, day);
      
      let startDay = firstDay.getDay();
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
      const [year, month, dayNum] = day.date.split('-').map(Number);
      const dayDate = createLocalDate(year, month - 1, dayNum);
      const dayNumber = dayDate.getDate();
      const isTodayCheck = isTodayDate(dayDate);
      const holiday = isHoliday(day.date);
      const isRegularized = regularizedDates.has(day.date);

      // ✅ CALCULATE FILL STATUS FOR THIS DAY
      const fillStatus = getTimesheetFillStatus(
        day.date,
        timesheetLines,
        day.availableHours || 8
      );

      // ✅ DETERMINE PROGRESS BAR COLOR
      let progressClass = styles.notFilled; // Default YELLOW
      if (fillStatus.status === 'FULL') {
        progressClass = styles.filled; // GREEN
      } else if (fillStatus.status === 'PARTIAL') {
        progressClass = styles.partial; // ORANGE
      }

      grid.push(
        <div
          key={`day-${index}`}
          className={`${styles.calendarDay} ${getDayStatusClass(day.status, day.timesheetProgress.status, isRegularized)} ${isTodayCheck ? styles.today : ''}`}
          onClick={() => handleDayClick(day)}
          title={holiday ? holiday.name : ''}
        >
          <div className={styles.dayTopSection}>
            <div className={styles.dayNumber}>{dayNumber}</div>
            <div className={styles.dayStatus}>
              {day.status === 'present' && !isRegularized && 'P'}
              {day.status === 'regularized' && 'R'}
              {day.status === 'absent' && 'A'}
              {day.status === 'holiday' && 'H'}
              {day.status === 'leave' && 'L'}
              {day.status === 'weekend' && 'W'}
              {day.status === 'future' && '-'}
            </div>
          </div>

          {/* ✅ SHOW HOURS ONLY IF EXPECTED HOURS > 0 */}
          {fillStatus.expectedDailyHours > 0 && (
            <div className={styles.dayTotalHours}>
              {fillStatus.totalFilledHours.toFixed(1)}h / {fillStatus.expectedDailyHours.toFixed(1)}h
            </div>
          )}

          {day.firstPunchIn && day.lastPunchOut && (
            <div className={styles.dayTime}>
              {formatTime(day.firstPunchIn)}-{formatTime(day.lastPunchOut)}
            </div>
          )}

          {/* ✅ PROGRESS BAR - ALWAYS RENDER IF EXPECTED HOURS > 0 */}
          {fillStatus.expectedDailyHours > 0 && (
            <div className={styles.timesheetProgressBar}>
              <div
                className={`${styles.timesheetProgressFill} ${progressClass}`}
                style={{ width: `${fillStatus.percentage}%` }}
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
  }, [calendarDays, timesheetLines, isHoliday, regularizedDates, getDayStatusClass, handleDayClick, getLeaveIndicatorClass]);

  // ✅ Effect 1: Load holidays
React.useEffect(() => {
  loadHolidaysForMonth(currentYear, currentMonth).catch(err => {
    console.error('[AttendanceView] Error loading holidays:', err);
  });
}, [currentMonth, currentYear, loadHolidaysForMonth]);

// ✅ Effect 2: Load calendar (runs independently)
React.useEffect(() => {
  loadCalendarData().catch(err => {
    console.error('[AttendanceView] Effect error:', err);
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentMonth, currentYear]); // ✅ ONLY month/year, NOT loadCalendarData

  React.useEffect(() => {
    calculateMonthlyCounts();
  }, [calendarDays, calculateMonthlyCounts]);

  if (isInitialLoad) {
    return (
      <div className={styles.viewContainer}>
        <div className={styles.dashboardHeader}>
          <h1>My Attendance</h1>
          <p>Loading...</p>
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
        <div className={styles.calendarNavigation}>
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

        <div className={styles.calendarLegend} style={{ marginBottom: '1rem', marginTop: 0 }}>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('present')}`}>
              <span className={styles.legendCount}>{monthlyCounts.present}</span>
            </div>
            <span className={styles.legendlabel}>Present</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('regularized')}`}>
              <span className={styles.legendCount}>{monthlyCounts.regularized}</span>
            </div>
            <span className={styles.legendlabel}>Regularized</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('absent')}`}>
              <span className={styles.legendCount}>{monthlyCounts.absent}</span>
            </div>
            <span className={styles.legendlabel}>Absent</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('holiday')}`}>
              <span className={styles.legendCount}>{monthlyCounts.holiday}</span>
            </div>
            <span className={styles.legendlabel}>Holiday</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('leave')}`}>
              <span className={styles.legendCount}>{monthlyCounts.leave}</span>
            </div>
            <span className={styles.legendlabel}>On Leave</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('weekend')}`}>
              <span className={styles.legendCount}>{monthlyCounts.weekend}</span>
            </div>
            <span className={styles.legendlabel}>Weekend</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('progressFilled')}`}>
              <span className={styles.legendCount}>{monthlyCounts.timesheetFilled}</span>
            </div>
            <span className={styles.legendlabel}>Timesheet: Filled</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('progressPartial')}`}>
              <span className={styles.legendCount}>{monthlyCounts.timesheetPartial}</span>
            </div>
            <span className={styles.legendlabel}>Timesheet: Partial</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendColor} ${getLegendColorClass('progressNotFilled')}`}>
              <span className={styles.legendCount}>{monthlyCounts.timesheetNotFilled}</span>
            </div>
            <span className={styles.legendlabel}>Timesheet: Not Filled</span>
          </div>
        </div>

        <div className={styles.calendarGrid}>
          {generateCalendarGrid()}
        </div>
      </div>

      {showPopup && selectedDay && (
  <div className={styles.attendanceModalOverlay}>
    <div className={styles.attendanceModal}>

      <div className={styles.modalHeader}>
        {selectedDay.displayDate}
      </div>

      <div className={styles.modalBody}>
        <div className={styles.infoRow}>
          <span>Status</span>
          <strong>{selectedDay.status}</strong>
        </div>

        <div className={styles.infoRow}>
          <span>Timesheet</span>
          <strong>{selectedDay.timesheetStatus}</strong>
        </div>

        <div className={styles.infoRow}>
          <span>Logged Hours</span>
          <strong>
            {selectedDay.loggedHours} / {selectedDay.expectedHours}
          </strong>
        </div>
      </div>

      <div className={styles.modalActions}>
        <button
          className={styles.primaryBtn}
          onClick={() => {
            setShowPopup(false);
        onViewChange('timesheet', { date: selectedDay.date });
          }}
        >
           📄 Create Timesheet Entry
        </button>

        <button
          className={styles.warningBtn}
          onClick={() => {
            setShowPopup(false);
            onViewChange('regularize', { date: selectedDay.date });
          }}
        >
        📝 Request Regularization
        </button>

        <button
          className={styles.cancelBtn}
          onClick={() => setShowPopup(false)}
        >
          Cancel
        </button>
      </div>

    </div>
  </div>
)}

    </div>
  );
};

export default AttendanceView;