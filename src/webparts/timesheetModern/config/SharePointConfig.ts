// SharePointConfig.ts - UPDATED with EmployeeMaster
// Centralized configuration for SharePoint lists and columns

export interface IListConfig {
  displayName: string;
  internalName: string;
}

export interface IColumnConfig {
  displayName: string;
  internalName: string;
}

export interface ISharePointConfig {
  lists: {
    employeeMaster: IListConfig;
    punchData: IListConfig;
    leaveData: IListConfig;
    timesheetHeader: IListConfig;
    timesheetLines: IListConfig;
    attendanceRegularization: IListConfig;
    projectTaskMaster: IListConfig;
  };
  columns: {
    [listName: string]: {
      [columnDisplayName: string]: IColumnConfig;
    };
  };
  groups: {
    employees: string;
    managers: string;
    admins: string;
  };
}

// Main configuration object
export const SharePointConfig: ISharePointConfig = {
  lists: {
    // NEW: Employee Master List
    employeeMaster: {
      displayName: 'Employee Master',
      internalName: 'EmployeeMasterData' // TODO: Verify this matches your SharePoint list internal name
    },
    punchData: {
      displayName: 'Punch Data',
      internalName: 'PunchData'
    },
    leaveData: {
      displayName: 'Leave Data',
      internalName: 'LeaveData'
    },
    timesheetHeader: {
      displayName: 'Timesheet Header',
      internalName: 'TimesheetHeader'
    },
    timesheetLines: {
      displayName: 'Timesheet Lines',
      internalName: 'TimesheetLines'
    },
    attendanceRegularization: {
      displayName: 'Attendance Regularization',
      internalName: 'AttendanceRegularization'
    },
    projectTaskMaster: {
      displayName: 'Project Task Master',
      internalName: 'ProjectTaskMaster'
    }
  },
  columns: {
    // EmployeeMaster columns
    EmployeeMaster: {
      EmployeeID: {
        displayName: 'Employee ID',
        internalName: 'Title' // TODO: Verify - this is the R0398 format ID
      },
      Employee: {
        displayName: 'Employee',
        internalName: 'Employee' // TODO: Verify - this is the Person or Group field
      },
      Email: {
        displayName: 'Email',
        internalName: 'Email'
      },
      Department: {
        displayName: 'Department',
        internalName: 'Department'
      },
      Manager: {
        displayName: 'Manager',
        internalName: 'Manager' // Person or Group field
      },
      Active: {
        displayName: 'Active',
        internalName: 'Active' // Yes/No field
      }
    },
    // PunchData columns
    PunchData: {
      EmployeeID: {
        displayName: 'Employee ID',
        internalName: 'EmployeeID'
      },
      AttendanceDate: {
        displayName: 'Attendance Date',
        internalName: 'AttendanceDate'
      },
      FirstPunchIn: {
        displayName: 'First Punch In',
        internalName: 'FirstPunchIn'
      },
      LastPunchOut: {
        displayName: 'Last Punch Out',
        internalName: 'LastPunchOut'
      },
      TotalHours: {
        displayName: 'Total Hours',
        internalName: 'TotalHours'
      },
      Status: {
        displayName: 'Status',
        internalName: 'Status'
      },
      Source: {
        displayName: 'Source',
        internalName: 'Source'
      }
    },
    // LeaveData columns
    LeaveData: {
      EmployeeID: {
        displayName: 'Employee ID',
        internalName: 'EmployeeID'
      },
      LeaveType: {
        displayName: 'Leave Type',
        internalName: 'LeaveType'
      },
      StartDate: {
        displayName: 'Start Date',
        internalName: 'StartDate'
      },
      EndDate: {
        displayName: 'End Date',
        internalName: 'EndDate'
      },
      LeaveDuration: {
        displayName: 'Leave Duration',
        internalName: 'LeaveDuration'
      },
      Status: {
        displayName: 'Status',
        internalName: 'Status'
      },
      ColorCode: {
        displayName: 'Color Code',
        internalName: 'ColorCode'
      }
    },
    // TimesheetHeader columns
    TimesheetHeader: {
      TimesheetID: {
        displayName: 'Timesheet ID',
        internalName: 'ID'
      },
      EmployeeID: {
        displayName: 'Employee ID',
        internalName: 'EmployeeID'
      },
      WeekStartDate: {
        displayName: 'Week Start Date',
        internalName: 'WeekStartDate'
      },
      Status: {
        displayName: 'Status',
        internalName: 'Status'
      },
      SubmissionDate: {
        displayName: 'Submission Date',
        internalName: 'SubmissionDate'
      },
      LockedBy: {
        displayName: 'Locked By',
        internalName: 'LockedBy'
      }
    },
    // TimesheetLines columns
    TimesheetLines: {
      TimesheetID: {
        displayName: 'Timesheet ID',
        internalName: 'TimesheetID'
      },
      WorkDate: {
        displayName: 'Work Date',
        internalName: 'WorkDate'
      },
      ProjectNo: {
        displayName: 'Project No',
        internalName: 'ProjectNo'
      },
      TaskNo: {
        displayName: 'Task No',
        internalName: 'TaskNo'
      },
      BLA_No: {
        displayName: 'BLA No',
        internalName: 'BLA_x005f_No'
      },
      HoursBooked: {
        displayName: 'Hours Booked',
        internalName: 'HoursBooked'
      },
      Description: {
        displayName: 'Description',
        internalName: 'Description'
      }
    },
    // AttendanceRegularization columns
    AttendanceRegularization: {
      EmployeeID: {
        displayName: 'Employee ID',
        internalName: 'EmployeeID'
      },
      RequestType: {
        displayName: 'Request Type',
        internalName: 'RequestType'
      },
      StartDate: {
        displayName: 'Start Date',
        internalName: 'StartDate'
      },
      EndDate: {
        displayName: 'End Date',
        internalName: 'EndDate'
      },
      ExpectedIn: {
        displayName: 'Expected In',
        internalName: 'ExpectedIn'
      },
      ExpectedOut: {
        displayName: 'Expected Out',
        internalName: 'ExpectedOut'
      },
      Reason: {
        displayName: 'Reason',
        internalName: 'Reason'
      },
      Status: {
        displayName: 'Status',
        internalName: 'Status'
      },
      ManagerComment: {
        displayName: 'Manager Comment',
        internalName: 'ManagerComment'
      }
    },
    // ProjectTaskMaster columns
    ProjectTaskMaster: {
      ProjectNo: {
        displayName: 'Project No',
        internalName: 'ProjectNo'
      },
      ProjectName: {
        displayName: 'Project Name',
        internalName: 'ProjectName'
      },
      TaskNo: {
        displayName: 'Task No',
        internalName: 'TaskNo'
      },
      TaskName: {
        displayName: 'Task Name',
        internalName: 'TaskName'
      },
      ResourceID: {
        displayName: 'Resource ID',
        internalName: 'ResourceID'
      },
      TaskStatus: {
        displayName: 'Task Status',
        internalName: 'TaskStatus'
      },
      BookingEnabled: {
        displayName: 'Booking Enabled',
        internalName: 'BookingEnabled'
      }
    }
  },
  groups: {
    employees: 'Timesheet_Employees',
    managers: 'Timesheet_Managers',
    admins: 'Timesheet_Admins'
  }
};

// Helper function to get list internal name
export const getListInternalName = (listKey: keyof typeof SharePointConfig.lists): string => {
  return SharePointConfig.lists[listKey].internalName;
};

// Helper function to get column internal name
export const getColumnInternalName = (listName: string, columnKey: string): string => {
  const listColumns = SharePointConfig.columns[listName];
  if (!listColumns || !listColumns[columnKey]) {
    console.warn(`Column ${columnKey} not found in list ${listName}. Using display name as fallback.`);
    return columnKey;
  }
  return listColumns[columnKey].internalName;
};

// OData query helpers for threshold-safe queries
export const ODataHelpers = {
  DEFAULT_PAGE_SIZE: 1000,
  
  buildSelectQuery: (columns: string[]): string => {
    return `$select=${columns.join(',')}`;
  },
  
  buildFilterQuery: (filters: string[]): string => {
    return filters.length > 0 ? `$filter=${filters.join(' and ')}` : '';
  },
  
  buildOrderByQuery: (orderBy: string, ascending: boolean = true): string => {
    return `$orderby=${orderBy} ${ascending ? 'asc' : 'desc'}`;
  },
  
  buildTopQuery: (top: number = 1000): string => {
    return `$top=${Math.min(top, 5000)}`;
  },
  
  buildExpandQuery: (expandColumns: string[]): string => {
    return expandColumns.length > 0 ? `$expand=${expandColumns.join(',')}` : '';
  }
};