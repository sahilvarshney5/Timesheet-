import * as React from 'react';
import styles from './TimesheetModern.module.scss';

export interface IApprovalViewProps {
  onViewChange: (viewName: string) => void;
}

const ApprovalView: React.FC<IApprovalViewProps> = (props) => {
  const { onViewChange } = props;
  const [activeTab, setActiveTab] = React.useState<string>('pending');

  const handleTabChange = (tabName: string): void => {
    setActiveTab(tabName);
  };

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
        >
          Pending Requests
        </button>
        <button 
          className={`${styles.approvalTab} ${activeTab === 'history' ? styles.active : ''}`}
          onClick={() => handleTabChange('history')}
        >
          Approval History
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
              <tr>
                <td>
                  <div style={{ fontWeight: 600 }}>John Doe</div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>EMP001</div>
                </td>
                <td>Jan 15, 2025</td>
                <td>Day-based</td>
                <td>Late Coming</td>
                <td><span className={`${styles.statusBadge} ${styles.statusPending}`}>Pending</span></td>
                <td>
                  <div className={styles.actionButtons}>
                    <button className={`${styles.btn} ${styles.btnSuccess} ${styles.btnSmall}`} >
                      ✓ Approve
                    </button>
                    <button className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`} >
                      ✗ Reject
                    </button>
                    <button className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`} >
                      View
                    </button>
                  </div>
                </td>
              </tr>
              <tr>
                <td>
                  <div style={{ fontWeight: 600 }}>Robert Johnson</div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>EMP003</div>
                </td>
                <td>Jan 12, 2025</td>
                <td>Day-based</td>
                <td>On Duty</td>
                <td><span className={`${styles.statusBadge} ${styles.statusPending}`}>Pending</span></td>
                <td>
                  <div className={styles.actionButtons}>
                    <button className={`${styles.btn} ${styles.btnSuccess} ${styles.btnSmall}`} >
                      ✓ Approve
                    </button>
                    <button className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`} >
                      ✗ Reject
                    </button>
                    <button className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`} >
                      View
                    </button>
                  </div>
                </td>
              </tr>
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
              <tr>
                <td>
                  <div style={{ fontWeight: 600 }}>Alice Smith</div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>EMP002</div>
                </td>
                <td>Jan 8, 2025</td>
                <td>Time-based</td>
                <td>Late Coming</td>
                <td><span className={`${styles.statusBadge} ${styles.statusApproved}`}>Approved</span></td>
                <td>Jan 8, 2025</td>
                <td>
                  <button className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`} >
                    View
                  </button>
                </td>
              </tr>
              <tr>
                <td>
                  <div style={{ fontWeight: 600 }}>Sarah Williams</div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>EMP004</div>
                </td>
                <td>Jan 3, 2025</td>
                <td>Time-based</td>
                <td>Early Going</td>
                <td><span className={`${styles.statusBadge} ${styles.statusRejected}`}>Rejected</span></td>
                <td>Jan 3, 2025</td>
                <td>
                  <button className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`} >
                    View
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ApprovalView;