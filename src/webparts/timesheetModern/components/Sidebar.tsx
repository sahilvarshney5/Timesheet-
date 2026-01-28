import * as React from 'react';
import styles from './TimesheetModern.module.scss';

export interface ISidebarProps {
  activeView: string;
  isHidden: boolean;
  onViewChange: (viewName: string) => void;
}

interface IMenuItem {
  id: string;
  label: string;
  icon: string;
}

const Sidebar: React.FC<ISidebarProps> = (props) => {
  const { activeView, isHidden, onViewChange } = props;

  const menuItems: IMenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'attendance', label: 'My Attendance', icon: '📅' },
    { id: 'timesheet', label: 'Timesheet Entries', icon: '⏱️' },
    { id: 'regularize', label: 'Regularization', icon: '📝' },
    { id: 'approval', label: 'Approval', icon: '✓' }
  ];

  const handleMenuItemClick = (viewName: string): void => {
    onViewChange(viewName);
  };

  return (
    <aside 
      className={`${styles.sidebar} ${isHidden ? styles.hidden : ''}`}
      id="sidebar"
    >
      <div className={styles.sidebarSection}>
        <div className={styles.sidebarTitle}>Navigation</div>
        <ul className={styles.sidebarMenu}>
          {menuItems.map(item => (
            <li key={item.id} className={styles.sidebarItem}>
              <a
                className={`${styles.sidebarLink} ${activeView === item.id ? styles.active : ''}`}
                onClick={() => handleMenuItemClick(item.id)}
              >
                <span className={styles.sidebarIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;