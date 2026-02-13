import * as React from 'react';
import styles from './TimesheetModern.module.scss';
import { SPHttpClient, MSGraphClientV3 } from '@microsoft/sp-http';
import { ApprovalService } from '../services/ApprovalService';
import { UserService } from '../services/UserService';
import { AttendanceService } from '../services/AttendanceService';
import { IApprovalQueueItem, IEmployeeMaster, IRegularizationRequest } from '../models';
import { getListInternalName, getColumnInternalName } from '../config/SharePointConfig';
import { HttpClientService } from '../services/HttpClientService';

export interface IApprovalViewProps {
  onViewChange: (viewName: string) => void;
  spHttpClient: SPHttpClient;
  siteUrl: string;
  currentUserDisplayName: string;
  employeeMaster: IEmployeeMaster;
  userRole: 'Admin' | 'Manager' | 'Member';
  graphClient?: MSGraphClientV3;
}

const ApprovalView: React.FC<IApprovalViewProps> = (props) => {
  const { spHttpClient, siteUrl } = props;

  // Services
  const approvalService = React.useMemo(
    () => new ApprovalService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  const httpService = React.useMemo(
    () => new HttpClientService(spHttpClient, siteUrl),
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
  const [viewModalOpen, setViewModalOpen] = React.useState<boolean>(false);
  const [viewingRequest, setViewingRequest] = React.useState<IRegularizationRequest | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = React.useState<string>('');
  const [approveModalOpen, setApproveModalOpen] = React.useState<boolean>(false);
  const [rejectModalOpen, setRejectModalOpen] = React.useState<boolean>(false);
  const [actioningRequest, setActioningRequest] = React.useState<IRegularizationRequest | null>(null);
  const [rejectComment, setRejectComment] = React.useState<string>('');
  const [approveComment, setApproveComment] = React.useState<string>('');
  const [timesheetApprovals, setTimesheetApprovals] = React.useState<IApprovalQueueItem[]>([]);
  const [viewDetailsModalOpen, setViewDetailsModalOpen] = React.useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = React.useState<IRegularizationRequest | null>(null);
  const [punchData, setPunchData] = React.useState<any>(null);

  const handleCloseViewModal = (): void => {
    setViewDetailsModalOpen(false);
    setSelectedRequest(null);
    setPunchData(null);
  };

  // Fetch current user email
  React.useEffect(() => {
    const fetchCurrentUserEmail = async (): Promise<void> => {
      try {
        const userService = new UserService(spHttpClient, siteUrl, props.graphClient);
        const currentUser = await userService.getCurrentUser();
        setCurrentUserEmail(currentUser.Email);
      } catch (error) {
        // Silent fail
      }
    };

    void fetchCurrentUserEmail();
  }, [spHttpClient, siteUrl, props.graphClient]);

  const loadPendingRequests = React.useCallback(async (): Promise<void> => {
    try {
      const approvalItems = await approvalService.getPendingApprovals(currentUserEmail);

      // FIX: Convert IApprovalQueueItem[] to IRegularizationRequest[]
      const regularizationRequests: IRegularizationRequest[] = approvalItems.map(req => ({
        id: req.requestId,
        employeeId: req.employeeName,
        employeeName: req.employeeName,
        requestType: req.requestType === 'Timesheet' ? 'day_based' : 'day_based',
        category: 'late_coming' as const,
        fromDate: req.dateRange,
        toDate: req.dateRange,
        reason: '',
        status: 'pending',
        submittedOn: new Date().toISOString().split('T')[0],
        dateRange: req.dateRange
      }));

      setPendingRequests(regularizationRequests);

    } catch (err) {
      throw err;
    }
  }, [approvalService, currentUserEmail]);

  const loadApprovalHistory = React.useCallback(async (): Promise<void> => {
    try {
      // FIX: getApprovalHistory returns IApprovalQueueItem[], need to convert
      const historyItems = await approvalService.getApprovalHistory(currentUserEmail);
      
      const regularizationHistory: IRegularizationRequest[] = historyItems.map(item => ({
        id: item.requestId,
        employeeId: item.employeeName,
        employeeName: item.employeeName,
        requestType: item.requestType === 'Timesheet' ? 'day_based' : 'day_based',
        category: 'late_coming' as const,
        fromDate: item.dateRange,
        toDate: item.dateRange,
        reason: '',
        status: item.status.toLowerCase() as 'pending' | 'approved' | 'rejected',
        submittedOn: new Date().toISOString().split('T')[0],
        dateRange: item.dateRange
      }));

      setApprovalHistory(regularizationHistory);

    } catch (err) {
      throw err;
    }
  }, [approvalService, currentUserEmail]);

  const loadTimesheetApprovals = React.useCallback(async (): Promise<void> => {
    try {
      const timesheets = await approvalService.getPendingTimesheetApprovals(currentUserEmail);
      setTimesheetApprovals(timesheets);
    } catch (err) {
      // Silent fail
    }
  }, [approvalService, currentUserEmail]);

  const checkPermissionsAndLoadData = React.useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const isManagerOrAdmin = props.userRole === 'Manager' || props.userRole === 'Admin';
      setIsManager(isManagerOrAdmin);

      if (!isManagerOrAdmin) {
        setError('You do not have manager privileges to view the approval queue.');
        return;
      }

      await Promise.all([
        loadPendingRequests(),
        loadApprovalHistory(),
        loadTimesheetApprovals()
      ]);

    } catch (err) {
      setError('Failed to load approval data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [props.userRole, loadPendingRequests, loadApprovalHistory, loadTimesheetApprovals]);

  React.useEffect(() => {
      if (!currentUserEmail) return;

    void checkPermissionsAndLoadData();
  }, [currentUserEmail]);

  const handleTabChange = (tabName: string): void => {
    setActiveTab(tabName);
  };

  const formatDateRange = (fromDate: string, toDate: string): string => {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    
    if (fromDate === toDate) {
      return from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    return `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const handleApprove = (request: IRegularizationRequest): void => {
    setActioningRequest(request);
    setApproveModalOpen(true);
  };

  const confirmApprove = async (): Promise<void> => {
    if (!actioningRequest) return;
    
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
      alert('Failed to approve request. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = (request: IRegularizationRequest): void => {
    setActioningRequest(request);
    setRejectComment('');
    setRejectModalOpen(true);
  };

  const handleView = (request: IRegularizationRequest): void => {
    setViewingRequest(request);
    setViewModalOpen(true);
  };

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
      alert('Request rejected.');

    } catch (err) {
      alert('Failed to reject request. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // FIX: Import AttendanceService at top
  const handleViewRegularization = async (request: IRegularizationRequest): Promise<void> => {
    setSelectedRequest(request);
    setViewDetailsModalOpen(true);
    
    try {
      const attendanceService = new AttendanceService(spHttpClient, siteUrl);
      const punch = await attendanceService.getPunchData(
        request.employeeId,
        request.fromDate,
        request.fromDate
      );
      if (punch && punch.length > 0) {
        setPunchData(punch[0]);
      }
    } catch (error) {
      // Silent fail
    }
  };

  // FIX: Remove 'timesheet' check (not in union type)
  const handleApproveClick = (request: IRegularizationRequest): void => {
    setActioningRequest(request);
    setApproveModalOpen(true);
  };

  const handleRejectClick = (request: IRegularizationRequest): void => {
    setActioningRequest(request);
    setRejectComment('');
    setRejectModalOpen(true);
  };

  const handleViewClick = (request: IRegularizationRequest): void => {
    void handleViewRegularization(request);
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

  // FIX: Add allPendingRequests with proper type
  const allPendingRequests = React.useMemo(() => {
    const requestsWithDate = pendingRequests.map(req => ({
      ...req,
      submittedOn: req.submittedOn || new Date().toISOString().split('T')[0]
    }));

    return [...requestsWithDate].sort((a, b) => {
      const dateA = new Date(a.submittedOn || '').getTime();
      const dateB = new Date(b.submittedOn || '').getTime();
      return dateB - dateA;
    });
  }, [pendingRequests]);

  if (isLoading) {
    return (
      <div className={styles.viewContainer}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Loading...</div>
          <div style={{ color: 'var(--text-secondary)' }}>Please wait while we load approval data</div>
        </div>
      </div>
    );
  }

  if (error || !isManager) {
    return (
      <div className={styles.viewContainer}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--danger)' }}>Access Denied</div>
          <div style={{ color: 'var(--text-secondary)' }}>{error || 'You do not have permission to view this page.'}</div>
        </div>
      </div>
    );
  }

  // FIX: Helper function for dynamic badge classes
  const getBadgeClass = (status: string): string => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'pending') return styles.badgePending || '';
    if (statusLower === 'approved') return styles.badgeApproved || '';
    if (statusLower === 'rejected') return styles.badgeRejected || '';
    return '';
  };

  return (
    <div className={styles.viewContainer}>
      <div className={styles.viewContainer}>
        <div className={styles.dashboardHeader}>
          <h1>Approval Queue</h1>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleRefresh}>
            Refresh
          </button>
        </div>

        <div className={styles.approvalTabs}>
          <button
            className={`${styles.approvalTab} ${activeTab === 'pending' ? styles.active : ''}`}
            onClick={() => handleTabChange('pending')}
          >
            Pending Requests ({allPendingRequests.length})
          </button>
          <button
            className={`${styles.approvalTab} ${activeTab === 'history' ? styles.active : ''}`}
            onClick={() => handleTabChange('history')}
          >
            History ({approvalHistory.length})
          </button>
        </div>

        {/* Pending Tab */}
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allPendingRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      No pending approval requests.
                    </td>
                  </tr>
                ) : (
                  allPendingRequests.map((request: IRegularizationRequest, index: number) => {
                    return (
                      <tr key={request.id || index}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{request.employeeName}</div>
                          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>{request.employeeId}</div>
                        </td>
                        <td>{request.fromDate}</td>
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
                              onClick={() => handleViewClick(request)}
                              disabled={isProcessing}
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* History Tab */}
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
                  approvalHistory.map((request: IRegularizationRequest, index: number) => (
                    <tr key={request.id || index}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{request.employeeName}</div>
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>{request.employeeId}</div>
                      </td>
                      <td>{request.fromDate}</td>
                      <td>{request.requestType === 'time_based' ? 'Time-based' : 'Day-based'}</td>
                      <td>{formatCategoryText(request.category)}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${request.status === 'approved' ? styles.statusApproved : styles.statusRejected}`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </td>
                      <td>{request.approvedOn ? new Date(request.approvedOn).toLocaleDateString() : '-'}</td>
                      <td>
                        <button
                          className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                          onClick={() => handleViewClick(request)}
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

        {/* View Details Modal */}
        {viewDetailsModalOpen && selectedRequest && (
          <div className={styles.modalOverlay} onClick={handleCloseViewModal}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>Request Details</h2>
                <button className={styles.modalClose} onClick={handleCloseViewModal}>×</button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.detailsGrid}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Employee:</span>
                    <span className={styles.detailValue}>{selectedRequest.employeeName}</span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Request Type:</span>
                    <span className={styles.detailValue}>
                      {selectedRequest.requestType === 'day_based' ? 'Day Based' : 'Time Based'}
                    </span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Date Range:</span>
                    <span className={styles.detailValue}>
                      {formatDateRange(selectedRequest.fromDate, selectedRequest.toDate)}
                    </span>
                  </div>

                  {selectedRequest.startTime && selectedRequest.endTime && (
                    <>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Expected In:</span>
                        <span className={styles.detailValue}>{selectedRequest.startTime}</span>
                      </div>

                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Expected Out:</span>
                        <span className={styles.detailValue}>{selectedRequest.endTime}</span>
                      </div>
                    </>
                  )}

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Status:</span>
                    {/* FIX: Use helper function for dynamic badge class */}
                    <span className={`${styles.badge} ${getBadgeClass(selectedRequest.status)}`}>
                      {selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                    </span>
                  </div>

                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Submitted On:</span>
                    <span className={styles.detailValue}>
                      {new Date(selectedRequest.submittedOn).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>

                  {(selectedRequest.status === 'approved' || selectedRequest.status === 'rejected') && (
                    <>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>
                          {selectedRequest.status === 'approved' ? 'Approved By:' : 'Rejected By:'}
                        </span>
                        <span className={styles.detailValue}>{selectedRequest.approvedBy || 'N/A'}</span>
                      </div>

                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>
                          {selectedRequest.status === 'approved' ? 'Approved On:' : 'Rejected On:'}
                        </span>
                        <span className={styles.detailValue}>
                          {selectedRequest.approvedOn 
                            ? new Date(selectedRequest.approvedOn).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })
                            : 'N/A'
                          }
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className={styles.detailItem} style={{ marginTop: '1rem' }}>
                  <span className={styles.detailLabel}>Reason:</span>
                  <div className={styles.reasonBox}>
                    {selectedRequest.reason}
                  </div>
                </div>

                {selectedRequest.managerComment && (
                  <div className={styles.detailItem} style={{ marginTop: '1rem' }}>
                    <span className={styles.detailLabel}>Manager Comments:</span>
                    <div className={styles.commentBox}>
                      {selectedRequest.managerComment}
                    </div>
                  </div>
                )}

                {punchData && (
                  <div className={styles.detailItem} style={{ marginTop: '1rem' }}>
                    <span className={styles.detailLabel}>Punch Data:</span>
                    <div className={styles.punchDataBox}>
                      <div><strong>First Punch In:</strong> {punchData.FirstPunchIn || 'N/A'}</div>
                      <div><strong>Last Punch Out:</strong> {punchData.LastPunchOut || 'N/A'}</div>
                      <div><strong>Total Hours:</strong> {punchData.TotalHours || 'N/A'}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleCloseViewModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Approve Modal */}
        {approveModalOpen && actioningRequest && (
          <div className={styles.modalOverlay} onClick={() => setApproveModalOpen(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>Approve Request</h2>
                <button className={styles.modalClose} onClick={() => setApproveModalOpen(false)}>×</button>
              </div>

              <div className={styles.modalBody}>
                <p>
                  Are you sure you want to approve this request for <strong>{actioningRequest.employeeName}</strong>?
                </p>
                <div style={{ marginTop: '1rem' }}>
                  <label htmlFor="approveComment">Remarks (Required):</label>
                  <textarea
                    id="approveComment"
                    className={styles.formTextarea}
                    value={approveComment}
                    onChange={(e) => setApproveComment(e.target.value)}
                    placeholder="Enter your remarks..."
                    rows={3}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  className={`${styles.btn} ${styles.btnSuccess}`}
                  onClick={confirmApprove}
                  disabled={isProcessing}
                >
                  Confirm Approval
                </button>
                <button
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() => setApproveModalOpen(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {rejectModalOpen && actioningRequest && (
          <div className={styles.modalOverlay} onClick={() => setRejectModalOpen(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>Reject Request</h2>
                <button className={styles.modalClose} onClick={() => setRejectModalOpen(false)}>×</button>
              </div>

              <div className={styles.modalBody}>
                <p>
                  Are you sure you want to reject this request for <strong>{actioningRequest.employeeName}</strong>?
                </p>
                <div style={{ marginTop: '1rem' }}>
                  <label htmlFor="rejectComment">Reason for Rejection (Required):</label>
                  <textarea
                    id="rejectComment"
                    className={styles.formTextarea}
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                    placeholder="Enter reason for rejection..."
                    rows={3}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  className={`${styles.btn} ${styles.btnDanger}`}
                  onClick={confirmReject}
                  disabled={isProcessing}
                >
                  Confirm Rejection
                </button>
                <button
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() => setRejectModalOpen(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApprovalView;