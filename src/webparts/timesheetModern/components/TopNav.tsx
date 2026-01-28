import * as React from 'react';
import styles from './TimesheetModern.module.scss';

export interface ITopNavProps {
  userDisplayName: string;
  userInitials: string;
  onViewChange: (viewName: string) => void;
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
        </div>
      </div>
    </nav>
  );
};

export default TopNav;