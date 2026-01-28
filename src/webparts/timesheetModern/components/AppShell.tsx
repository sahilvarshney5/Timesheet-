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
  const { 
    currentUserDisplayName, 
    httpClient, 
    siteUrl 
  } = props;

  const [state, setState] = React.useState<IAppShellState>({
    activeView: 'dashboard',
    sidebarHidden: false
  });

  const handleViewChange = React.useCallback((viewName: string): void => {
    setState(prev => ({
      ...prev,
      activeView: viewName
    }));
    
    // Scroll to top when changing views
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    // Common props for all views
    const viewProps = {
      onViewChange: handleViewChange,
      spHttpClient: httpClient,
      siteUrl: siteUrl,
      currentUserDisplayName: currentUserDisplayName
    };

    switch (state.activeView) {
      case 'dashboard':
        return <DashboardView {...viewProps} />;
      case 'attendance':
        return <AttendanceView {...viewProps} />;
      case 'timesheet':
        return <TimesheetView {...viewProps} />;
      case 'regularize':
        return <RegularizationView {...viewProps} />;
      case 'approval':
        return <ApprovalView {...viewProps} />;
      default:
        return <DashboardView {...viewProps} />;
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