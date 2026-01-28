import * as React from 'react';
import styles from './TimesheetModern.module.scss';

export interface IDashboardViewProps {
  onViewChange: (viewName: string) => void;
}

const DashboardView: React.FC<IDashboardViewProps> = (props) => {
  const { onViewChange } = props;

  return (
    <div className={styles.viewContainer}>
      <div className={styles.welcomeContainer}>
        <div className={styles.welcomeHeader}>
          <h1>Welcome back, Admin!</h1>
          <p>Here's everything you need to manage your work and attendance in one place</p>
          <div className={styles.welcomeStats}>
            <div className={styles.welcomeStat}>
              <div className={styles.welcomeStatValue}>22</div>
              <div className={styles.welcomeStatLabel}>Days Present</div>
            </div>
            <div className={styles.welcomeStat}>
              <div className={styles.welcomeStatValue}>38.5</div>
              <div className={styles.welcomeStatLabel}>Hours This Week</div>
            </div>
            <div className={styles.welcomeStat}>
              <div className={styles.welcomeStatValue}>12</div>
              <div className={styles.welcomeStatLabel}>Leave Days Left</div>
            </div>
            <div className={styles.welcomeStat}>
              <div className={styles.welcomeStatValue}>3</div>
              <div className={styles.welcomeStatLabel}>Pending Approvals</div>
            </div>
          </div>
        </div>

        <div className={styles.actionGrid}>
          {/* Attendance Card */}
          <div className={`${styles.actionCard} ${styles.attendance}`} onClick={() => onViewChange('attendance')}>
            <div className={styles.actionIcon}>📅</div>
            <div className={styles.actionTitle}>Attendance</div>
            <div className={styles.actionDesc}>View your attendance records and biometric details</div>
            <div className={styles.actionStats}>
              <div className={styles.actionStat}>
                <div className={styles.actionStatValue}>22</div>
                <div className={styles.actionStatLabel}>Days Present</div>
              </div>
              <div className={styles.actionStat}>
                <div className={styles.actionStatValue}>1</div>
                <div className={styles.actionStatLabel}>Pending AR</div>
              </div>
            </div>
          </div>

          {/* Timesheet Card */}
          <div className={`${styles.actionCard} ${styles.timesheet}`} onClick={() => onViewChange('timesheet')}>
            <div className={styles.actionIcon}>⏱️</div>
            <div className={styles.actionTitle}>Timesheet Entries</div>
            <div className={styles.actionDesc}>Log daily work hours and manage project time allocations</div>
            <div className={styles.actionStats}>
              <div className={styles.actionStat}>
                <div className={styles.actionStatValue}>42.5</div>
                <div className={styles.actionStatLabel}>Hours This Week</div>
              </div>
              <div className={styles.actionStat}>
                <div className={styles.actionStatValue}>3</div>
                <div className={styles.actionStatLabel}>Pending Entries</div>
              </div>
            </div>
          </div>

          {/* Regularization Card */}
          <div className={`${styles.actionCard} ${styles.rationalize}`} onClick={() => onViewChange('regularize')}>
            <div className={styles.actionIcon}>📝</div>
            <div className={styles.actionTitle}>Attendance Regularization</div>
            <div className={styles.actionDesc}>Submit requests to regularize missing or incorrect attendance</div>
            <div className={styles.actionStats}>
              <div className={styles.actionStat}>
                <div className={styles.actionStatValue}>2</div>
                <div className={styles.actionStatLabel}>This Month</div>
              </div>
              <div className={styles.actionStat}>
                <div className={styles.actionStatValue}>1</div>
                <div className={styles.actionStatLabel}>Pending</div>
              </div>
            </div>
          </div>

          {/* Approval Card */}
          <div className={`${styles.actionCard} ${styles.approval}`} onClick={() => onViewChange('approval')}>
            <div className={styles.actionIcon}>✓</div>
            <div className={styles.actionTitle}>Approval Queue</div>
            <div className={styles.actionDesc}>Review and approve requests from your team members</div>
            <div className={styles.actionStats}>
              <div className={styles.actionStat}>
                <div className={styles.actionStatValue}>3</div>
                <div className={styles.actionStatLabel}>Pending</div>
              </div>
              <div className={styles.actionStat}>
                <div className={styles.actionStatValue}>12</div>
                <div className={styles.actionStatLabel}>This Month</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;