import * as React from 'react';
import styles from './TimesheetModern.module.scss';
import { DashboardService, IDashboardStats } from '../services/DashboardService';
import { ApprovalService } from '../services/ApprovalService';
import { SPHttpClient } from '@microsoft/sp-http';
import { IEmployeeMaster } from '../models';

export interface IDashboardViewProps {
  onViewChange: (viewName: string) => void;
  spHttpClient: SPHttpClient;
  siteUrl: string;
  currentUserDisplayName: string;
  employeeMaster: IEmployeeMaster;
  userRole: 'Admin' | 'Manager' | 'Member';
}

const DashboardView: React.FC<IDashboardViewProps> = (props) => {
  const { onViewChange, spHttpClient, siteUrl, currentUserDisplayName } = props;

  const [stats, setStats] = React.useState<IDashboardStats>({
    daysPresent: 0,
    hoursThisWeek: 0,
    leaveDaysLeft: 0,
    pendingApprovals: 0,
    pendingTimesheetEntries: 0,
    pendingRegularizations: 0
  });
  
  const [regularizationStats, setRegularizationStats] = React.useState({
    totalThisMonth: 0,
    pendingCount: 0,
    approvedCount: 0
  });

  const [userRole, setUserRole] = React.useState<'Admin' | 'Manager' | 'Member'>('Member');
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const dashboardService = React.useMemo(
    () => new DashboardService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  const approvalService = React.useMemo(
    () => new ApprovalService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  const loadDashboardData = React.useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const empId = props.employeeMaster.EmployeeID;
      const currentUserRole = props.userRole;

      const dashboardStats = await dashboardService.getDashboardStats();

      const regularizations = await approvalService.getEmployeeRegularizations(empId);
      
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      
      const thisMonthRegularizations = regularizations.filter(reg => {
        const submittedDate = new Date(reg.submittedOn);
        return submittedDate.getMonth() === currentMonth && submittedDate.getFullYear() === currentYear;
      });
      
      const pendingRegularizations = regularizations.filter(reg => reg.status === 'pending');
      const approvedRegularizations = regularizations.filter(reg => reg.status === 'approved');

      setUserRole(currentUserRole);
      setStats(dashboardStats);
      setRegularizationStats({
        totalThisMonth: thisMonthRegularizations.length,
        pendingCount: pendingRegularizations.length,
        approvedCount: approvedRegularizations.length
      });

    } catch (err) {
      console.error('[DashboardView] Error loading dashboard data:', err);
      setError('Failed to load dashboard data. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  }, [props.employeeMaster.EmployeeID, props.userRole, dashboardService, approvalService]);

  React.useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  if (isLoading) {
    return (
      <div className={styles.viewContainer}>
        <div className={styles.welcomeContainer}>
          <div className={styles.welcomeHeader}>
            <h1>Loading...</h1>
            <p>Please wait while we load your dashboard</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.viewContainer}>
        <div className={styles.welcomeContainer}>
          <div className={styles.welcomeHeader}>
            <h1>Error</h1>
            <p>{error}</p>
            <button 
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => { loadDashboardData().catch(console.error); }}
              style={{ marginTop: '1rem' }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.viewContainer}>
      <div className={styles.welcomeContainer}>
        <div className={styles.welcomeHeader}>
          <h1>Welcome back, {currentUserDisplayName}!</h1>
          <p>
            Role: <strong>{userRole}</strong> | 
            Here's everything you need to manage your work and attendance in one place
          </p>
          <div className={styles.welcomeStats}>
            <div className={styles.welcomeStat}>
              <div className={styles.welcomeStatValue}>{stats.daysPresent}</div>
              <div className={styles.welcomeStatLabel}>Days Present</div>
            </div>
            <div className={styles.welcomeStat}>
              <div className={styles.welcomeStatValue}>{stats.hoursThisWeek}</div>
              <div className={styles.welcomeStatLabel}>Hours This Week</div>
            </div>
            <div className={styles.welcomeStat}>
              <div className={styles.welcomeStatValue}>{regularizationStats.totalThisMonth}</div>
              <div className={styles.welcomeStatLabel}>Regularization This Month</div>
            </div>
            {(userRole === 'Admin' || userRole === 'Manager') && (
              <div className={styles.welcomeStat}>
                <div className={styles.welcomeStatValue}>{stats.pendingApprovals}</div>
                <div className={styles.welcomeStatLabel}>Pending Approvals</div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.actionGrid}>
          <div className={`${styles.actionCard} ${styles.attendance}`} onClick={() => onViewChange('attendance')}>
            <div className={styles.actionIcon}>📅</div>
            <div className={styles.actionTitle}>Attendance</div>
            <div className={styles.actionDesc}>View your attendance records and biometric details</div>
            <div className={styles.actionStats}>
              <div className={styles.actionStat}>
                <div className={styles.actionStatValue}>{stats.daysPresent}</div>
                <div className={styles.actionStatLabel}>Days Present</div>
              </div>
              <div className={styles.actionStat}>
                <div className={styles.actionStatValue}>{regularizationStats.pendingCount}</div>
                <div className={styles.actionStatLabel}>Pending AR</div>
              </div>
            </div>
          </div>

          <div className={`${styles.actionCard} ${styles.timesheet}`} onClick={() => onViewChange('timesheet')}>
            <div className={styles.actionIcon}>⏱️</div>
            <div className={styles.actionTitle}>Timesheet Entries</div>
            <div className={styles.actionDesc}>Log daily work hours and manage project time allocations</div>
            <div className={styles.actionStats}>
              <div className={styles.actionStat}>
                <div className={styles.actionStatValue}>{stats.hoursThisWeek}</div>
                <div className={styles.actionStatLabel}>Hours This Week</div>
              </div>
              <div className={styles.actionStat}>
                <div className={styles.actionStatValue}>{stats.pendingTimesheetEntries}</div>
                <div className={styles.actionStatLabel}>Pending Entries</div>
              </div>
            </div>
          </div>

          <div className={`${styles.actionCard} ${styles.rationalize}`} onClick={() => onViewChange('regularize')}>
            <div className={styles.actionIcon}>📝</div>
            <div className={styles.actionTitle}>Attendance Regularization</div>
            <div className={styles.actionDesc}>Submit requests to regularize missing or incorrect attendance</div>
            <div className={styles.actionStats}>
              <div className={styles.actionStat}>
                <div className={styles.actionStatValue}>{regularizationStats.totalThisMonth}</div>
                <div className={styles.actionStatLabel}>This Month</div>
              </div>
              <div className={styles.actionStat}>
                <div className={styles.actionStatValue}>{regularizationStats.pendingCount}</div>
                <div className={styles.actionStatLabel}>Pending</div>
              </div>
            </div>
          </div>

          {(userRole === 'Admin' || userRole === 'Manager') && (
            <div className={`${styles.actionCard} ${styles.approval}`} onClick={() => onViewChange('approval')}>
              <div className={styles.actionIcon}>✓</div>
              <div className={styles.actionTitle}>Approval Queue</div>
              <div className={styles.actionDesc}>Review and approve requests from your team members</div>
              <div className={styles.actionStats}>
                <div className={styles.actionStat}>
                  <div className={styles.actionStatValue}>{stats.pendingApprovals}</div>
                  <div className={styles.actionStatLabel}>Pending</div>
                </div>
                <div className={styles.actionStat}>
                  <div className={styles.actionStatValue}>-</div>
                  <div className={styles.actionStatLabel}>This Month</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardView;