import * as React from 'react';
import type { ITimesheetModernProps } from './ITimesheetModernProps';
import TopNav from './TopNav';
import Sidebar from './Sidebar';
import DashboardView from './Dashboardview ';
import AttendanceView from './Attendanceview';
import TimesheetView from './Timesheetview';
import RegularizationView from './Regularizationview';
import ApprovalView from './Approvalview';
import styles from './TimesheetModern.module.scss';

export interface IAppShellState {
  activeView: string;
  sidebarHidden: boolean;
}

const AppShell: React.FC<ITimesheetModernProps> = (props) => {
  const { currentUserDisplayName } = props;

  const [state, setState] = React.useState<IAppShellState>({
    activeView: 'dashboard',
    sidebarHidden: false
  });

  const handleViewChange = React.useCallback((viewName: string): void => {
    setState(prev => ({
      ...prev,
      activeView: viewName
    }));
  }, []);

  const toggleSidebar = React.useCallback((): void => {
    setState(prev => ({
      ...prev,
      sidebarHidden: !prev.sidebarHidden
    }));
  }, []);

  const getUserInitials = React.useCallback((name: string): string => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, []);

  // Render the appropriate view component based on activeView
  const renderView = (): JSX.Element => {
    switch (state.activeView) {
      case 'dashboard':
        return <DashboardView onViewChange={handleViewChange} />;
      case 'attendance':
        return <AttendanceView onViewChange={handleViewChange} />;
      case 'timesheet':
        return <TimesheetView onViewChange={handleViewChange} />;
      case 'regularize':
        return <RegularizationView onViewChange={handleViewChange} />;
      case 'approval':
        return <ApprovalView onViewChange={handleViewChange} />;
      default:
        return <DashboardView onViewChange={handleViewChange} />;
    }
  };

  return (
    <div className={styles.timesheetModern}>
      <TopNav 
        userDisplayName={currentUserDisplayName}
        userInitials={getUserInitials(currentUserDisplayName)}
        onViewChange={handleViewChange}
      />
      
      <Sidebar 
        activeView={state.activeView}
        onViewChange={handleViewChange}
        isHidden={state.sidebarHidden}
      />
      
      <main className={`${styles.mainContent} ${state.sidebarHidden ? styles.fullWidth : ''}`}>
        {renderView()}
      </main>
    </div>
  );
};

export default AppShell;