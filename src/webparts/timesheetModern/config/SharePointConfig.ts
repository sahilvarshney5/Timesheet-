// SharePointConfig.ts - UPDATED with Project Assignment list
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
    leaveBalance: IListConfig;
    timesheetHeader: IListConfig;
    timesheetLines: IListConfig;
    attendanceRegularization: IListConfig;
    projectTaskMaster: IListConfig;
    projectAssignment: IListConfig; // NEW: Project Assignment list
    defaultPunchTimes:IListConfig;
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
    // Employee Master List
    employeeMaster: {
      displayName: 'Employee Master',
      internalName: 'EmployeeMasterData'
    },
    punchData: {
      displayName: 'Punch Data',
      internalName: 'Punch Data'
    },
    leaveData: {
      displayName: 'Leave Data',
      internalName: 'Leave Data'
    },
    leaveBalance: {
      displayName: 'Leave Balance',
      internalName: 'Leave Balance'
    },
    timesheetHeader: {
      displayName: 'Timesheet Header',
      internalName: 'Timesheet Header'
    },
    timesheetLines: {
      displayName: 'Timesheet Lines',
      internalName: 'Timesheet Lines'
    },
    attendanceRegularization: {
      displayName: 'Attendance Regularization',
      internalName: 'Attendance Regularization'
    },
    projectTaskMaster: {
      displayName: 'Project Task Master',
      internalName: 'Project%20Task%20Master'
    },
    // NEW: Project Assignment List
    projectAssignment: {
      displayName: 'Project Assignment',
      internalName: 'Project%20Task%20Master'
    },
    defaultPunchTimes: {
    displayName: 'Default Punch Times',
    internalName: 'Default%20Punch%20Times'
  }
  },
  columns: {
    // EmployeeMaster columns
    EmployeeMaster: {
      EmployeeID: {
        displayName: 'Employee ID',
        internalName: 'Title'
      },
      Employee: {
        displayName: 'Employee',
        internalName: 'Employee'
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
        internalName: 'Manager'
      },
      Active: {
        displayName: 'Active',
        internalName: 'Active'
      }
    },
    // PunchData columns
    PunchData: {
      EmployeeID: {
        displayName: 'Employee ID',
        internalName: 'Title'
      },
      AttendanceDate: {
        displayName: 'Attendance Date',
        internalName: 'PunchDate'
      },
      PunchIn: {
        displayName: 'Punch In',
        internalName: 'PunchIn'
      },
      PunchOut: {
        displayName: 'Punch Out',
        internalName: 'PunchOut'
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
      },
      AvailableHours: {
        displayName: 'Available Hours',
        internalName: 'AvailableHours'
      }
    },
    // LeaveData columns
    LeaveData: {
      EmployeeID: {
        displayName: 'Employee ID',
        internalName: 'Title'
      },
      Employee: {
        displayName: 'Employee',
        internalName: 'Employee'
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
      HRMSLeaveID: {
        displayName: 'HRMS Leave ID',
        internalName: 'HRMSLeaveID'
      },
      AppliedDate: {
        displayName: 'Applied Date',
        internalName: 'AppliedDate'
      },
      ApprovedDate: {
        displayName: 'Approved Date',
        internalName: 'ApprovedDate'
      },
      ColorCode: {
        displayName: 'Color Code',
        internalName: 'ColorCode'
      },
      Reason: {
        displayName: 'Reason',
        internalName: 'Reason'
      },
      ApprovedBy: {
        displayName: 'Approved By',
        internalName: 'ApprovedBy'
      }
    },
    // LeaveBalance columns
    LeaveBalance: {
      EmployeeID: {
        displayName: 'Employee ID',
        internalName: 'Title'
      },
      LeaveType: {
        displayName: 'Leave Type',
        internalName: 'LeaveType'
      },
      Balance: {
        displayName: 'Balance',
        internalName: 'Allocated'
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
        internalName: 'Title'
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
      },
      ManagerEmail: {
    displayName: 'Manager Email',
    internalName: 'ManagerEmail'
  }

    },
    // TimesheetLines columns
    TimesheetLines: {
      TimesheetID: {
        displayName: 'Timesheet ID',
        internalName: 'TimesheetHeaderId'
      },
      WorkDate: {
        displayName: 'Work Date',
        internalName: 'EntryDate'
      },
      ProjectNo: {
        displayName: 'Project No',
        internalName: 'ProjectNumber'
      },
      TaskNo: {
        displayName: 'Task No',
        internalName: 'Title'
      },
      BLA_No: {
        displayName: 'BLA No',
        internalName: 'BLANumber'
      },
      HoursBooked: {
        displayName: 'Hours Booked',
        internalName: 'HoursBooked'
      },
      Description: {
        displayName: 'Description',
        internalName: 'Description'
      },
      TaskName: {
        displayName: 'Task Name',
        internalName: 'TaskName'
      }
    },
    // AttendanceRegularization columns
    AttendanceRegularization: {
      EmployeeID: {
        displayName: 'Employee ID',
        internalName: 'Title'
      },
         RequestID: {
        displayName: 'Request ID',
        internalName: 'RequestID'
      },
      RequestType: {
        displayName: 'Request Type',
        internalName: 'RegularizationType'
      },
      StartDate: {
        displayName: 'Start Date',
        internalName: 'SubmittedDate'
      },
      EndDate: {
        displayName: 'End Date',
        internalName: 'ApprovedDate'
      },
      ExpectedIn: {
        displayName: 'Expected In',
        internalName: 'ExpectedInTime'
      },
      ExpectedOut: {
        displayName: 'Expected Out',
        internalName: 'ExpectedOutTime'
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
        internalName: 'ManagerComments'
      },
      ManagerEmail: {
    displayName: 'Manager Email',
    internalName: 'ManagerEmail'
  },
  FootPrint:{
    displayName:'Foot Print',
    internalName:'FootPrint'
  }
    },
    // ProjectTaskMaster columns
    ProjectTaskMaster: {
      ResourceID: {
        displayName: 'Resource ID',
        internalName: 'Title'
      },
      ProjectNo: {
        displayName: 'Project Number',
        internalName: 'ProjectNumber'
      },
      ProjectName: {
        displayName: 'Project Name',
        internalName: 'ProjectName'
      },
      TaskNo: {
        displayName: 'Task Number',
        internalName: 'TaskNumber'
      },
      TaskName: {
        displayName: 'Task Name',
        internalName: 'TaskName'
      },
      ValidFrom: {
        displayName: 'Valid From',
        internalName: 'ValidFrom'
      },
      ValidTo: {
        displayName: 'Valid To',
        internalName: 'ValidTo'
      },
      BookingEnabled: {
        displayName: 'Booking Enabled',
        internalName: 'IsActive'
      },
      BCResourceNo: {
        displayName: 'BC Resource No',
        internalName: 'BCResourceNo'
      },
      TaskStatus: {
        displayName: 'Task Status',
        internalName: 'TaskStatus'
      },
      Description: {
        displayName: 'Description',
        internalName: 'Description'
      },
      ProjectID: {
        displayName: 'ProjectID',
        internalName: 'ProjectID'
      },
      JobTaskType: {
        displayName: 'Job Task Type',
        internalName: 'JobTaskType'
      }
    },
    // NEW: ProjectAssignment columns
    ProjectAssignment: {
      ResourceID: {
        displayName: 'Resource ID',
        internalName: 'Title'
      },
      ProjectNumber: {
        displayName: 'Project Number',
        internalName: 'ProjectNumber'
      },
      ProjectName: {
        displayName: 'Project Name',
        internalName: 'ProjectName'
      },
      TaskNumber: {
        displayName: 'Task Number',
        internalName: 'TaskNumber'
      },
      TaskName: {
        displayName: 'Task Name',
        internalName: 'TaskName'
      },
      TaskStatus: {
        displayName: 'Task Status',
        internalName: 'TaskStatus'
      },
      ValidFrom: {
        displayName: 'Valid From',
        internalName: 'ValidFrom'
      },
      ValidTo: {
        displayName: 'Valid To',
        internalName: 'ValidTo'
      },
      BookingEnabled: {
        displayName: 'Booking Enabled',
        internalName: 'IsActive'
      },
      Description: {
        displayName: 'Description',
        internalName: 'Description'
      },
      ProjectID: {
        displayName: 'Project ID',
        internalName: 'ProjectID'
      },
      JobTaskType: {
        displayName: 'Job Task Type',
        internalName: 'JobTaskType'
      },
      DurationTask: {
        displayName: 'Duration of task',
        internalName: 'DurationTask'
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