import * as React from 'react';
import styles from './TimesheetModern.module.scss';
import { SPHttpClient } from '@microsoft/sp-http';
import { ApprovalService } from '../services/ApprovalService';
import { UserService } from '../services/UserService';
import { IApprovalQueueItem, IEmployeeMaster, IRegularizationRequest } from '../models';

export interface IApprovalViewProps {
  onViewChange: (viewName: string) => void;
  spHttpClient: SPHttpClient;
  siteUrl: string;
  currentUserDisplayName: string;
    employeeMaster: IEmployeeMaster;  // NEW
  userRole: 'Admin' | 'Manager' | 'Member';  // NEW
}

const ApprovalView: React.FC<IApprovalViewProps> = (props) => {
  const {  spHttpClient, siteUrl } = props;

  // Services
  const approvalService = React.useMemo(
    () => new ApprovalService(spHttpClient, siteUrl),
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
 // ADD new state for view modal
const [viewModalOpen, setViewModalOpen] = React.useState<boolean>(false);
const [viewingRequest, setViewingRequest] = React.useState<IRegularizationRequest | null>(null);

 // ADD new states
 const [approveModalOpen, setApproveModalOpen] = React.useState<boolean>(false);
 const [rejectModalOpen, setRejectModalOpen] = React.useState<boolean>(false);
 const [actioningRequest, setActioningRequest] = React.useState<IRegularizationRequest | null>(null);
 const [rejectComment, setRejectComment] = React.useState<string>('');
 const [approveComment, setApproveComment] = React.useState<string>('');

  const loadPendingRequests = React.useCallback(async (): Promise<void> => {
  try {
    // Get pending approvals (filtered by manager if needed)
    const requests = await approvalService.getPendingApprovals();
    
    // Convert to IRegularizationRequest format
    const regularizationRequests: IRegularizationRequest[] = requests.map(req => ({
      id: req.requestId,
      employeeId: req.employeeName,
      employeeName: req.employeeName,
      requestType: req.requestType === 'Timesheet' ? 'day_based' : 'day_based',
      category: 'late_coming' as any,
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
},[approvalService]);
  const loadApprovalHistory = React.useCallback(async (): Promise<void> => {
    try {
      const history = await approvalService.getApprovalHistory();
      setApprovalHistory(history);
      console.log(`[ApprovalView] Loaded ${history.length} approval history items`);

    } catch (err) {
      console.error('[ApprovalView] Error loading approval history:', err);
      throw err;
    }
  },[approvalService]);

 const checkPermissionsAndLoadData = React.useCallback(async (): Promise<void> => {
  try {
    setIsLoading(true);
    setError(null);

    // Check user role from props
    const isManagerOrAdmin = props.userRole === 'Manager' || props.userRole === 'Admin';
    setIsManager(isManagerOrAdmin);

    if (!isManagerOrAdmin) {
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
},[props.userRole, loadPendingRequests, loadApprovalHistory]);
 // Load data on mount
  React.useEffect(() => {
   void checkPermissionsAndLoadData();
  }, []);


  const handleTabChange = (tabName: string): void => {
    setActiveTab(tabName);
  };

 // REPLACE handleApprove
const handleApprove = (request: IRegularizationRequest): void => {
  setActioningRequest(request);
  setApproveModalOpen(true);
};
const formatDateRange = (fromDate: string, toDate: string): string => {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    
    if (fromDate === toDate) {
      return from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    return `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };
// ADD confirm approve handler
const confirmApprove = async (): Promise<void> => {
  if (!actioningRequest) return;
    // ✅ FIX: Make remarks mandatory
  if (!approveComment.trim()) {
    alert('Please provide remarks for approval');
    return;
  }
  try {
    setIsProcessing(true);

    await approvalService.approveRequest(actioningRequest.id!);

    await Promise.all([
      loadPendingRequests(),
      loadApprovalHistory()
    ]);

    setApproveModalOpen(false);
    setActioningRequest(null);
    setApproveComment('');
    alert(`✓ Request approved successfully!\n\nEmployee: ${actioningRequest.employeeName}\nDate: ${formatDateRange(actioningRequest.fromDate, actioningRequest.toDate)}`);

  } catch (err) {
    console.error('[ApprovalView] Error approving request:', err);
    alert('Failed to approve request. Please try again.');
  } finally {
    setIsProcessing(false);
  }
};


// REPLACE handleReject
const handleReject = (request: IRegularizationRequest): void => {
  setActioningRequest(request);
  setRejectComment('');
  setRejectModalOpen(true);
};

 // REPLACE handleView function
const handleView = (request: IRegularizationRequest): void => {
  setViewingRequest(request);
  setViewModalOpen(true);
};
// ADD confirm reject handler
const confirmReject = async (): Promise<void> => {
  if (!actioningRequest) return;
  
  if (!rejectComment.trim()) {
    alert('Please provide a reason for rejection');
    return;
  }
  
  try {
    setIsProcessing(true);

    await approvalService.rejectRequest(actioningRequest.id!, rejectComment);

    await Promise.all([
      loadPendingRequests(),
      loadApprovalHistory()
    ]);

    setRejectModalOpen(false);
    setActioningRequest(null);
    setRejectComment('');
    
    alert(`✓ Request rejected successfully!\n\nEmployee: ${actioningRequest.employeeName}\nReason: ${rejectComment}`);

  } catch (err) {
    console.error('[ApprovalView] Error rejecting request:', err);
    alert('Failed to reject request. Please try again.');
  } finally {
    setIsProcessing(false);
  }
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
    onClick={() => handleApprove(request)}
    disabled={isProcessing}
  >
    ✓ Approve
  </button>
  <button 
    className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
    onClick={() => handleReject(request)}
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
            {/* // ADD JSX for custom modal (at end of component, before closing tag) */}
{/* View Request Modal */}
{viewModalOpen && viewingRequest && (
  <div className={styles.modal} style={{ display: 'flex' }}>
    <div className={styles.modalContent}>
      <div className={styles.modalHeader}>
        <h3>Regularization Request Details</h3>
        <button className={styles.closeBtn} onClick={() => setViewModalOpen(false)}>×</button>
      </div>
      
      <div className={styles.modalBody}>
        <div className={styles.detailRow}>
          <div className={styles.detailLabel}>Employee:</div>
          <div className={styles.detailValue}>
            {viewingRequest.employeeName} ({viewingRequest.employeeId})
          </div>
        </div>
        
        <div className={styles.detailRow}>
          <div className={styles.detailLabel}>Type:</div>
          <div className={styles.detailValue}>
            {viewingRequest.requestType === 'time_based' ? 'Time-based' : 'Day-based'}
          </div>
        </div>
        
        <div className={styles.detailRow}>
          <div className={styles.detailLabel}>Date Range:</div>
          <div className={styles.detailValue}>
            {formatDateRange(viewingRequest.fromDate, viewingRequest.toDate)}
          </div>
        </div>
        
        <div className={styles.detailRow}>
          <div className={styles.detailLabel}>Category:</div>
          <div className={styles.detailValue}>
            {formatCategoryText(viewingRequest.category)}
          </div>
        </div>
        
        {viewingRequest.requestType === 'time_based' && viewingRequest.startTime && viewingRequest.endTime && (
          <div className={styles.detailRow}>
            <div className={styles.detailLabel}>Time:</div>
            <div className={styles.detailValue}>
              {viewingRequest.startTime} to {viewingRequest.endTime}
            </div>
          </div>
        )}
        
        <div className={styles.detailRow}>
          <div className={styles.detailLabel}>Reason:</div>
          <div className={styles.detailValue}>
            {viewingRequest.reason}
          </div>
        </div>
        
        <div className={styles.detailRow}>
          <div className={styles.detailLabel}>Status:</div>
          <div className={styles.detailValue}>
            <span className={`${styles.statusBadge} ${
              viewingRequest.status === 'pending' ? styles.statusPending :
              viewingRequest.status === 'approved' ? styles.statusApproved :
              styles.statusRejected
            }`}>
              {viewingRequest.status.charAt(0).toUpperCase() + viewingRequest.status.slice(1)}
            </span>
          </div>
        </div>
        
        <div className={styles.detailRow}>
          <div className={styles.detailLabel}>Submitted On:</div>
          <div className={styles.detailValue}>
            {new Date(viewingRequest.submittedOn).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
        </div>
        
        {viewingRequest.status !== 'pending' && (
          <>
            {viewingRequest.approvedBy && (
              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Actioned By:</div>
                <div className={styles.detailValue}>{viewingRequest.approvedBy}</div>
              </div>
            )}
            
            {viewingRequest.approvedOn && (
              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Actioned On:</div>
                <div className={styles.detailValue}>
                  {new Date(viewingRequest.approvedOn).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
            )}
            
            {viewingRequest.managerComment && (
              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Manager Comment:</div>
                <div className={styles.detailValue}>{viewingRequest.managerComment}</div>
              </div>
            )}
          </>
        )}
      </div>
      
      <div className={styles.modalFooter}>
        <button 
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => setViewModalOpen(false)}
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}

{/* Approve Confirmation Modal */}
{approveModalOpen && actioningRequest && (
  <div className={styles.modal} style={{ display: 'flex' }}>
    <div className={styles.modalContent}>
      <div className={styles.modalHeader}>
        <h3>Approve Regularization Request</h3>
        <button className={styles.closeBtn} onClick={() => setApproveModalOpen(false)}>×</button>
      </div>
      
      <div className={styles.modalBody}>
        <p style={{ marginBottom: '1rem' }}>
          Are you sure you want to approve this regularization request?
        </p>
        
        <div className={styles.detailRow}>
          <div className={styles.detailLabel}>Employee:</div>
          <div className={styles.detailValue}>
            {actioningRequest.employeeName} ({actioningRequest.employeeId})
          </div>
        </div>
        
        <div className={styles.detailRow}>
          <div className={styles.detailLabel}>Date Range:</div>
          <div className={styles.detailValue}>
            {formatDateRange(actioningRequest.fromDate, actioningRequest.toDate)}
          </div>
        </div>
        
        <div className={styles.detailRow}>
          <div className={styles.detailLabel}>Category:</div>
          <div className={styles.detailValue}>
            {formatCategoryText(actioningRequest.category)}
          </div>
        </div>
      </div>
      <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
  <label className={styles.formLabel}>Approval Remarks *</label>
  <textarea 
    className={styles.formTextarea}
    placeholder="Enter remarks for approval..."
    value={approveComment}
    onChange={(e) => setApproveComment(e.target.value)}
    rows={3}
    required
  />
</div>
      
      <div className={styles.modalFooter}>
        <button 
          className={`${styles.btn} ${styles.btnOutline}`}
          onClick={() => setApproveModalOpen(false)}
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button 
          className={`${styles.btn} ${styles.btnSuccess}`}
          onClick={() => { confirmApprove().catch(console.error); }}
          disabled={isProcessing}
        >
          {isProcessing ? 'Approving...' : '✓ Confirm Approval'}
        </button>
      </div>
    </div>
  </div>
)}

{/* Reject Modal with Comments */}
{rejectModalOpen && actioningRequest && (
  <div className={styles.modal} style={{ display: 'flex' }}>
    <div className={styles.modalContent}>
      <div className={styles.modalHeader}>
        <h3>Reject Regularization Request</h3>
        <button className={styles.closeBtn} onClick={() => setRejectModalOpen(false)}>×</button>
      </div>
      
      <div className={styles.modalBody}>
        <p style={{ marginBottom: '1rem' }}>
          Please provide a reason for rejecting this request:
        </p>
        
        <div className={styles.detailRow}>
          <div className={styles.detailLabel}>Employee:</div>
          <div className={styles.detailValue}>
            {actioningRequest.employeeName} ({actioningRequest.employeeId})
          </div>
        </div>
        
        <div className={styles.detailRow}>
          <div className={styles.detailLabel}>Date Range:</div>
          <div className={styles.detailValue}>
            {formatDateRange(actioningRequest.fromDate, actioningRequest.toDate)}
          </div>
        </div>
        
        <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
          <label className={styles.formLabel}>Reason for Rejection *</label>
          <textarea 
            className={styles.formTextarea}
            placeholder="Enter reason for rejection..."
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            rows={4}
            required
          />
        </div>
      </div>
      
      <div className={styles.modalFooter}>
        <button 
          className={`${styles.btn} ${styles.btnOutline}`}
          onClick={() => setRejectModalOpen(false)}
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button 
          className={`${styles.btn} ${styles.btnDanger}`}
          onClick={() => { confirmReject().catch(console.error); }}
          disabled={isProcessing || !rejectComment.trim()}
        >
          {isProcessing ? 'Rejecting...' : '✗ Confirm Rejection'}
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default ApprovalView;