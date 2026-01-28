import * as React from 'react';
import styles from './TimesheetModern.module.scss';
import { SPHttpClient } from '@microsoft/sp-http';
import { ApprovalService } from '../services/ApprovalService';
import { UserService } from '../services/UserService';
import { IApprovalQueueItem, IRegularizationRequest } from '../models';

export interface IApprovalViewProps {
  onViewChange: (viewName: string) => void;
  spHttpClient: SPHttpClient;
  siteUrl: string;
  currentUserDisplayName: string;
}

const ApprovalView: React.FC<IApprovalViewProps> = (props) => {
  const { onViewChange, spHttpClient, siteUrl } = props;

  // Services
  const approvalService = React.useMemo(
    () => new ApprovalService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  const userService = React.useMemo(
    () => new UserService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  // State
  const [activeTab, setActiveTab] = React.useState<string>('pending');
  const [pendingRequests, setPendingRequests] = React.useState<IRegularizationRequest[]>([]);
  const [approvalHistory, setApprovalHistory] = React.useState<IRegularizationRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isManager, setIsManager] = React.useState<boolean>(false);

  // Load data on mount
  React.useEffect(() => {
    checkPermissionsAndLoadData();
  }, []);

  const checkPermissionsAndLoadData = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if user is manager
      const permissions = await userService.getUserPermissions();
      setIsManager(permissions.isManager || permissions.isAdmin);

      if (!permissions.isManager && !permissions.isAdmin) {
        setError('You do not have manager privileges to view the approval queue.');
        return;
      }

      // Load both tabs in parallel
      await Promise.all([
        loadPendingRequests(),
        loadApprovalHistory()
      ]);

    } catch (err) {
      console.error('[ApprovalView] Error checking permissions and loading data:', err);
      setError('Failed to load approval data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPendingRequests = async (): Promise<void> => {
    try {
      const requests = await approvalService.getPendingApprovals();
      
      // Transform to regularization requests format
      const regularizationRequests: IRegularizationRequest[] = requests.map(req => ({
        id: req.requestId,
        employeeId: req.employeeName, // Using name as ID for display
        employeeName: req.employeeName,
        requestType: req.requestType === 'Timesheet' ? 'day_based' : 'day_based',
        category: 'late_coming' as any, // Default category
        fromDate: req.dateRange,
        toDate: req.dateRange,
        reason: '',
        status: 'pending',
        submittedOn: new Date().toISOString().split('T')[0]
      }));
      
      setPendingRequests(regularizationRequests);
      console.log(`[ApprovalView] Loaded ${regularizationRequests.length} pending requests`);

    } catch (err) {
      console.error('[ApprovalView] Error loading pending requests:', err);
      throw err;
    }
  };

  const loadApprovalHistory = async (): Promise<void> => {
    try {
      const history = await approvalService.getApprovalHistory();
      setApprovalHistory(history);
      console.log(`[ApprovalView] Loaded ${history.length} approval history items`);

    } catch (err) {
      console.error('[ApprovalView] Error loading approval history:', err);
      throw err;
    }
  };

  const handleTabChange = (tabName: string): void => {
    setActiveTab(tabName);
  };

  const handleApprove = async (requestId: number): Promise<void> => {
    if (!confirm('Are you sure you want to approve this regularization request?')) {
      return;
    }

    try {
      setIsProcessing(true);

      // Approve in SharePoint
      await approvalService.approveRequest(requestId);

      // Remove from pending list
      const approvedRequest = pendingRequests.find(req => req.id === requestId);
      setPendingRequests(prev => prev.filter(req => req.id !== requestId));

      // Add to history
      if (approvedRequest) {
        const historyItem: IRegularizationRequest = {
          ...approvedRequest,
          status: 'approved',
          approvedBy: 'Current Manager',
          approvedOn: new Date().toISOString().split('T')[0]
        };
        setApprovalHistory(prev => [historyItem, ...prev]);
      }

      alert('Request approved successfully.');

    } catch (err) {
      console.error('[ApprovalView] Error approving request:', err);
      alert('Failed to approve request. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (requestId: number): Promise<void> => {
    const comment = prompt('Please provide a reason for rejection (optional):');
    
    if (comment === null) {
      return; // User cancelled
    }

    try {
      setIsProcessing(true);

      // Reject in SharePoint
      await approvalService.rejectRequest(requestId, comment || undefined);

      // Remove from pending list
      const rejectedRequest = pendingRequests.find(req => req.id === requestId);
      setPendingRequests(prev => prev.filter(req => req.id !== requestId));

      // Add to history
      if (rejectedRequest) {
        const historyItem: IRegularizationRequest = {
          ...rejectedRequest,
          status: 'rejected',
          approvedBy: 'Current Manager',
          approvedOn: new Date().toISOString().split('T')[0],
          managerComment: comment || undefined
        };
        setApprovalHistory(prev => [historyItem, ...prev]);
      }

      alert('Request rejected successfully.');

    } catch (err) {
      console.error('[ApprovalView] Error rejecting request:', err);
      alert('Failed to reject request. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleView = (request: IRegularizationRequest): void => {
    const fromDate = new Date(request.fromDate);
    const toDate = new Date(request.toDate);
    const submittedDate = new Date(request.submittedOn);
    
    let message = `Regularization Request for Approval:\n\n`;
    message += `Employee: ${request.employeeName} (${request.employeeId})\n`;
    message += `Type: ${request.requestType === 'time_based' ? 'Time-based' : 'Day-based'}\n`;
    message += `Date Range: ${fromDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
    
    if (request.fromDate !== request.toDate) {
      message += ` to ${toDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`;
    } else {
      message += '\n';
    }
    
    const categoryText = request.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    message += `Category: ${categoryText}\n`;
    message += `Submitted On: ${submittedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`;
    
    if (request.requestType === 'time_based' && request.startTime && request.endTime) {
      message += `Time: ${request.startTime} to ${request.endTime}\n`;
    }
    
    if (request.reason) {
      message += `Reason: ${request.reason}\n`;
    }
    
    if (request.status !== 'pending') {
      message += `\nStatus: ${request.status.charAt(0).toUpperCase() + request.status.slice(1)}\n`;
      
      if (request.approvedBy) {
        message += `Actioned By: ${request.approvedBy}\n`;
      }
      
      if (request.approvedOn) {
        const actionDate = new Date(request.approvedOn);
        message += `Actioned On: ${actionDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`;
      }
      
      if (request.managerComment) {
        message += `Manager Comment: ${request.managerComment}\n`;
      }
    }
    
    alert(message);
  };

  const handleRefresh = async (): Promise<void> => {
    if (activeTab === 'pending') {
      await loadPendingRequests();
    } else {
      await loadApprovalHistory();
    }
  };

  const formatCategoryText = (category: string): string => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDateRange = (fromDate: string, toDate: string): string => {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    
    if (fromDate === toDate) {
      return from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    return `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  if (isLoading) {
    return (
      <div className={styles.viewContainer}>
        <div className={styles.dashboardHeader}>
          <h1>Approval Queue</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !isManager) {
    return (
      <div className={styles.viewContainer}>
        <div className={styles.dashboardHeader}>
          <h1>Access Denied</h1>
          <p>{error || 'You do not have manager privileges to view the approval queue.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.viewContainer}>
      <div className={styles.dashboardHeader}>
        <h1>Approval Queue</h1>
        <p>Review and approve regularization requests from team members</p>
      </div>
      
      {/* Approval Tabs */}
      <div className={styles.approvalTabs}>
        <button 
          className={`${styles.approvalTab} ${activeTab === 'pending' ? styles.active : ''}`}
          onClick={() => handleTabChange('pending')}
          disabled={isProcessing}
        >
          Pending Requests ({pendingRequests.length})
        </button>
        <button 
          className={`${styles.approvalTab} ${activeTab === 'history' ? styles.active : ''}`}
          onClick={() => handleTabChange('history')}
          disabled={isProcessing}
        >
          Approval History ({approvalHistory.length})
        </button>
      </div>
      
      {/* Pending Requests Tab */}
      <div className={`${styles.approvalTabContent} ${activeTab === 'pending' ? styles.active : ''}`}>
        <div className={styles.approvalTable}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date Range</th>
                <th>Type</th>
                <th>Category</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No pending approval requests.
                  </td>
                </tr>
              ) : (
                pendingRequests.map(request => (
                  <tr key={request.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{request.employeeName}</div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>{request.employeeId}</div>
                    </td>
                    <td>{formatDateRange(request.fromDate, request.toDate)}</td>
                    <td>{request.requestType === 'time_based' ? 'Time-based' : 'Day-based'}</td>
                    <td>{formatCategoryText(request.category)}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles.statusPending}`}>
                        Pending
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button 
                          className={`${styles.btn} ${styles.btnSuccess} ${styles.btnSmall}`}
                          onClick={() => handleApprove(request.id!)}
                          disabled={isProcessing}
                        >
                          ✓ Approve
                        </button>
                        <button 
                          className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                          onClick={() => handleReject(request.id!)}
                          disabled={isProcessing}
                        >
                          ✗ Reject
                        </button>
                        <button 
                          className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                          onClick={() => handleView(request)}
                          disabled={isProcessing}
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Approval History Tab */}
      <div className={`${styles.approvalTabContent} ${activeTab === 'history' ? styles.active : ''}`}>
        <div className={styles.approvalTable}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date Range</th>
                <th>Type</th>
                <th>Category</th>
                <th>Status</th>
                <th>Action Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {approvalHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No approval history found.
                  </td>
                </tr>
              ) : (
                approvalHistory.map(request => (
                  <tr key={request.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{request.employeeName}</div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>{request.employeeId}</div>
                    </td>
                    <td>{formatDateRange(request.fromDate, request.toDate)}</td>
                    <td>{request.requestType === 'time_based' ? 'Time-based' : 'Day-based'}</td>
                    <td>{formatCategoryText(request.category)}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${
                        request.status === 'approved' ? styles.statusApproved : styles.statusRejected
                      }`}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                    </td>
                    <td>
                      {request.approvedOn && new Date(request.approvedOn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td>
                      <button 
                        className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                        onClick={() => handleView(request)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ApprovalView;