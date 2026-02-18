import * as React from 'react';
import styles from './TimesheetModern.module.scss';

export interface ITopNavProps {
  userDisplayName: string;
  userInitials: string;
  onViewChange: (viewName: string) => void;
  context?: import('@microsoft/sp-webpart-base').WebPartContext;
}

const TopNav: React.FC<ITopNavProps> = (props) => {
  const { userDisplayName, userInitials, onViewChange } = props;

  const handleDashboardClick = (): void => {
    onViewChange('dashboard');
  };

  return (
    <nav className={styles.topNav}>
      <div className={styles.logo} onClick={handleDashboardClick}>
        <div className={styles.logoIcon}>
          <img 
            src="https://www.fichtner.co.in/typo3conf/ext/fichtner_sub_india/Resources/Public/Images/logo.svg" 
            alt="Fichtner India Logo"
          />
        </div>
      </div>
      
      <div className={styles.topNavRight}>
        <div className={styles.userProfile} onClick={handleDashboardClick}>
          <div className={styles.userAvatar}>
            {userInitials}
          </div>
          <div className={styles.userName}>
            {userDisplayName}
          </div>
          {props.context && (
  <button
    onClick={() => {
      window.location.href = `${props.context!.pageContext.web.absoluteUrl}/_layouts/15/signout.aspx`;
    }}
    style={{
      marginLeft: '12px',
      padding: '6px 14px',
      background: 'transparent',
      border: '1px solid var(--border-color, #ccc)',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '13px',
      color: 'var(--text-secondary, #666)',
      whiteSpace: 'nowrap'
    }}
  >
    Sign Out
  </button>
)}
        </div>
      </div>
    </nav>
  );
};

export default TopNav;