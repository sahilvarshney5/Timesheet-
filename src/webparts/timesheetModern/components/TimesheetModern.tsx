import * as React from 'react';
import type { ITimesheetModernProps } from './ITimesheetModernProps';
import AppShell from './AppShell';

const TimesheetModern: React.FC<ITimesheetModernProps> = (props) => {
  return <AppShell {...props} />;
};

export default TimesheetModern;