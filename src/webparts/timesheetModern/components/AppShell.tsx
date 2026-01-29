import * as React from 'react';
import type { ITimesheetModernProps } from './ITimesheetModernProps';
import TopNav from './TopNav';
import Sidebar from './Sidebar';
import DashboardView from './Dashboardview';
import AttendanceView from './Attendanceview';
import TimesheetView from './Timesheetview';
import RegularizationView from './Regularizationview';
import ApprovalView from './Approvalview';
import styles from './TimesheetModern.module.scss';
import { EmployeeService } from '../services/EmployeeService';
import { IEmployeeMaster } from '../models/IEmployeeMaster';

export interface IAppShellState {
  activeView: string;
  sidebarHidden: boolean;
  employeeMaster: IEmployeeMaster | null;
  isLoading: boolean;
  error: string | null;
  userRole: 'Admin' | 'Manager' | 'Member';
}

const AppShell: React.FC<ITimesheetModernProps> = (props) => {
  const { 
    currentUserDisplayName, 
    httpClient, 
    siteUrl 
  } = props;

  const [state, setState] = React.useState<IAppShellState>({
    activeView: 'dashboard',
    sidebarHidden: false,
    employeeMaster: undefined,
    isLoading: true,
    error: undefined,
    userRole: 'Member'
  });

  // Employee Service
 

  // Load employee master on mount - THIS IS CRITICAL
  React.useEffect(() => {
    loadEmployeeMaster();
  }, []);
 const employeeService = React.useMemo(
    () => new EmployeeService(httpClient, siteUrl),
    [httpClient, siteUrl]
  );
  const loadEmployeeMaster = React.useCallback(async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      console.log('[AppShell] Loading employee master data...');

      // Fetch employee master for current user
      const employeeMaster = await employeeService.getCurrentEmployeeMaster();

      if (!employeeMaster) {
        throw new Error('Employee master record not found. Please contact your administrator.');
      }

      if (!employeeMaster.IsActive) {
        throw new Error('Your employee account is inactive. Please contact your administrator.');
      }

      // Check user role
      const [isAdmin, isManager] = await Promise.all([
        employeeService.isCurrentUserAdmin(),
        employeeService.isCurrentUserManager()
      ]);

      const userRole: 'Admin' | 'Manager' | 'Member' = 
        isAdmin ? 'Admin' : 
        isManager ? 'Manager' : 
        'Member';

      setState(prev => ({
        ...prev,
        employeeMaster,
        userRole,
        isLoading: false,
        error: null
      }));

      console.log(`[AppShell] Employee master loaded successfully - ID: ${employeeMaster.EmployeeID}, Role: ${userRole}`);

    } catch (err) {
      console.error('[AppShell] Error loading employee master:', err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load employee data'
      }));
    }
  }, [employeeService]);

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

  // Render loading state
  if (state.isLoading) {
    return (
      <div className={styles.timesheetModern}>
        <TopNav 
          userDisplayName={currentUserDisplayName}
          userInitials={getUserInitials(currentUserDisplayName)}
          onViewChange={handleViewChange}
        />
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: 'calc(100vh - 48px)',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>Loading your employee data...</div>
          <div style={{ color: 'var(--text-secondary)' }}>Please wait while we verify your credentials</div>
        </div>
      </div>
    );
  }

  // Render error state
  if (state.error || !state.employeeMaster) {
    return (
      <div className={styles.timesheetModern}>
        <TopNav 
          userDisplayName={currentUserDisplayName}
          userInitials={getUserInitials(currentUserDisplayName)}
          onViewChange={handleViewChange}
        />
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: 'calc(100vh - 48px)',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--danger)' }}>
            Access Denied
          </div>
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '500px' }}>
            {state.error || 'Employee master record not found. Please contact your administrator.'}
          </div>
          <button 
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={loadEmployeeMaster}
            style={{ marginTop: '1rem' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render the appropriate view component based on activeView
  const renderView = (): JSX.Element => {
    // Common props for all views - NOW INCLUDING EMPLOYEE MASTER
    const viewProps = {
      onViewChange: handleViewChange,
      spHttpClient: httpClient,
      siteUrl: siteUrl,
      currentUserDisplayName: currentUserDisplayName,
      employeeMaster: state.employeeMaster!,
      userRole: state.userRole
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
        userDisplayName={state.employeeMaster.EmployeeDisplayName || currentUserDisplayName}
        userInitials={getUserInitials(state.employeeMaster.EmployeeDisplayName || currentUserDisplayName)}
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