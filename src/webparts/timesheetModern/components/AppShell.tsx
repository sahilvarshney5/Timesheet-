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
  navigationData?: any; // Optional navigation context for passing data between views
}

/**
 * Enforce env=WebView parameter in URL for Timesheet.aspx page
 * This ensures consistent behavior across all timesheet page loads
 */
const enforceWebViewUrl = async (): Promise<void> => {
  try {
    const url = new URL(window.location.href);

    // ✅ Check page name - only enforce on Timesheet.aspx
    const isTimesheetPage = url.pathname.toLowerCase().indexOf("timesheet.aspx") !== -1;

    if (!isTimesheetPage) {
      console.log("[AppShell] Not on Timesheet.aspx, skipping URL enforcement");
      return;
    }

    // ✅ Read query params safely
    const hasEnvParam = url.searchParams.has("env");
    const hasSkipParam = url.searchParams.has("skipEnv"); // bypass param

    // ❌ Skip enforcement if bypass param exists
    if (hasSkipParam) {
      console.log("[AppShell] skipEnv parameter present, bypassing URL enforcement");
      return;
    }

    // ✅ env already exists → do nothing
    if (hasEnvParam) {
      console.log("[AppShell] env parameter already present:", url.searchParams.get("env"));
      return;
    }

    // ❌ env missing → add it once
    url.searchParams.set("env", "WebView");

    console.warn("[AppShell] env=WebView missing, redirecting to:", url.toString());
    window.location.replace(url.toString());

  } catch (error) {
    console.error("[AppShell] URL enforcement failed:", error);
  }
};

const AppShell: React.FC<ITimesheetModernProps> = (props) => {
  const { 
    currentUserDisplayName, 
    httpClient, 
    siteUrl 
  } = props;

  const [state, setState] = React.useState<IAppShellState>({
    activeView: 'dashboard',
    sidebarHidden: false,
    employeeMaster: null,
    isLoading: true,
    error: null,
    userRole: 'Member',
    navigationData: undefined
  });
  // Employee Service
  const employeeService = React.useMemo(
    () => new EmployeeService(httpClient, siteUrl),
    [httpClient, siteUrl]
  );
  // ============================================================================
  // URL ENFORCEMENT - Run on mount
  // ============================================================================
  React.useEffect(() => {
    // Enforce URL parameter on mount
    enforceWebViewUrl().catch(err => {
      console.error('[AppShell] URL enforcement error:', err);
      // Don't block app initialization on URL enforcement errors
    });
  }, []); // Run only once on mount

  // ============================================================================
  // GLOBAL CSS OVERRIDE - Remove SharePoint Chrome
  // ============================================================================
  React.useEffect(() => {
    // Inject global CSS to remove SharePoint chrome
    const styleId = 'spfx-chrome-remover';
    
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        #SuiteNavWrapper,
        #suiteBarLeft,
        #suiteBar,
        .ms-HubNav,
        div[data-automation-id="pageHeader"],
        .ms-CommandBar,
        #DeltaPlaceHolderPageTitleInTitleArea,
        footer,
        .ms-footer {
          display: none !important;
          height: 0 !important;
          visibility: hidden !important;
        }
        
        #workbenchPageContent,
        .SPPageChrome,
        .SPCanvas,
        .CanvasZone,
        .CanvasSection,
        div[data-automation-id="CanvasControl"],
        div[data-sp-webpart] {
          padding: 0 !important;
          margin: 0 !important;
        }
        
        html, body {
          margin: 0 !important;
          padding: 0 !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []); // Run once on mount

  // ============================================================================
  // EMPLOYEE MASTER LOADING
  // ============================================================================
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

  // Load employee master on mount - THIS IS CRITICAL
  React.useEffect(() => {
    void loadEmployeeMaster();
  }, [loadEmployeeMaster]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  const handleViewChange = React.useCallback((viewName: string, data?: any): void => {
    setState(prev => ({
      ...prev,
      activeView: viewName,
      navigationData: data // Store navigation data for passing context between views
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

  // ============================================================================
  // RENDER VIEW CONTENT
  // ============================================================================
  const renderView = (): JSX.Element => {
    // Common props for all views
    const viewProps = {
      onViewChange: handleViewChange,
      spHttpClient: httpClient,
      siteUrl: siteUrl,
      currentUserDisplayName: currentUserDisplayName,
      employeeMaster: state.employeeMaster!,
      userRole: state.userRole,
    };

    switch (state.activeView) {
      case 'dashboard':
        return <DashboardView {...viewProps} />;
      case 'attendance':
        return <AttendanceView {...viewProps} />;
      case 'timesheet':
        return <TimesheetView {...viewProps} navigationData={state.navigationData} />;
      case 'regularize':
        return <RegularizationView {...viewProps} />;
      case 'approval':
        return <ApprovalView {...viewProps} />;
      default:
        return <DashboardView {...viewProps} />;
    }
  };

  // ============================================================================
  // RENDER LOADING STATE
  // ============================================================================
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

  // ============================================================================
  // RENDER ERROR STATE
  // ============================================================================
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

  // ============================================================================
  // RENDER MAIN APPLICATION
  // ============================================================================
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