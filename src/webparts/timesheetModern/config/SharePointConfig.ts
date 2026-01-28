// SharePointConfig.ts
// Centralized configuration for SharePoint lists and columns
// TODO: Update internal names if they differ in your tenant

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
}

// Main configuration object
export const SharePointConfig: ISharePointConfig = {
  lists: {
    punchData: {
      displayName: 'Punch Data',
      internalName: 'PunchData' // TODO: Verify this matches your SharePoint list internal name
    },
    leaveData: {
      displayName: 'Leave Data',
      internalName: 'LeaveData' // TODO: Verify this matches your SharePoint list internal name
    },
    timesheetHeader: {
      displayName: 'Timesheet Header',
      internalName: 'TimesheetHeader' // TODO: Verify this matches your SharePoint list internal name
    },
    timesheetLines: {
      displayName: 'Timesheet Lines',
      internalName: 'TimesheetLines' // TODO: Verify this matches your SharePoint list internal name
    },
    attendanceRegularization: {
      displayName: 'Attendance Regularization',
      internalName: 'AttendanceRegularization' // TODO: Verify this matches your SharePoint list internal name
    },
    projectTaskMaster: {
      displayName: 'Project Task Master',
      internalName: 'ProjectTaskMaster' // TODO: Verify this matches your SharePoint list internal name
    }
  },
  columns: {
    // PunchData columns
    PunchData: {
      EmployeeID: {
        displayName: 'Employee ID',
        internalName: 'EmployeeID' // TODO: Verify internal name
      },
      AttendanceDate: {
        displayName: 'Attendance Date',
        internalName: 'AttendanceDate' // TODO: Verify internal name
      },
      FirstPunchIn: {
        displayName: 'First Punch In',
        internalName: 'FirstPunchIn' // TODO: Verify internal name
      },
      LastPunchOut: {
        displayName: 'Last Punch Out',
        internalName: 'LastPunchOut' // TODO: Verify internal name
      },
      TotalHours: {
        displayName: 'Total Hours',
        internalName: 'TotalHours' // TODO: Verify internal name
      },
      Status: {
        displayName: 'Status',
        internalName: 'Status' // TODO: Verify internal name
      },
      Source: {
        displayName: 'Source',
        internalName: 'Source' // TODO: Verify internal name
      }
    },
    // LeaveData columns
    LeaveData: {
      EmployeeID: {
        displayName: 'Employee ID',
        internalName: 'EmployeeID' // TODO: Verify internal name
      },
      LeaveType: {
        displayName: 'Leave Type',
        internalName: 'LeaveType' // TODO: Verify internal name
      },
      StartDate: {
        displayName: 'Start Date',
        internalName: 'StartDate' // TODO: Verify internal name
      },
      EndDate: {
        displayName: 'End Date',
        internalName: 'EndDate' // TODO: Verify internal name
      },
      LeaveDuration: {
        displayName: 'Leave Duration',
        internalName: 'LeaveDuration' // TODO: Verify internal name
      },
      Status: {
        displayName: 'Status',
        internalName: 'Status' // TODO: Verify internal name
      },
      ColorCode: {
        displayName: 'Color Code',
        internalName: 'ColorCode' // TODO: Verify internal name
      }
    },
    // TimesheetHeader columns
    TimesheetHeader: {
      TimesheetID: {
        displayName: 'Timesheet ID',
        internalName: 'ID' // Standard SharePoint ID column
      },
      EmployeeID: {
        displayName: 'Employee ID',
        internalName: 'EmployeeID' // TODO: Verify internal name
      },
      WeekStartDate: {
        displayName: 'Week Start Date',
        internalName: 'WeekStartDate' // TODO: Verify internal name
      },
      Status: {
        displayName: 'Status',
        internalName: 'Status' // TODO: Verify internal name
      },
      SubmissionDate: {
        displayName: 'Submission Date',
        internalName: 'SubmissionDate' // TODO: Verify internal name
      },
      LockedBy: {
        displayName: 'Locked By',
        internalName: 'LockedBy' // TODO: Verify internal name
      }
    },
    // TimesheetLines columns
    TimesheetLines: {
      TimesheetID: {
        displayName: 'Timesheet ID',
        internalName: 'TimesheetID' // TODO: Verify internal name (Lookup column)
      },
      WorkDate: {
        displayName: 'Work Date',
        internalName: 'WorkDate' // TODO: Verify internal name
      },
      ProjectNo: {
        displayName: 'Project No',
        internalName: 'ProjectNo' // TODO: Verify internal name
      },
      TaskNo: {
        displayName: 'Task No',
        internalName: 'TaskNo' // TODO: Verify internal name
      },
      BLA_No: {
        displayName: 'BLA No',
        internalName: 'BLA_x005f_No' // TODO: Verify internal name (underscore encoding)
      },
      HoursBooked: {
        displayName: 'Hours Booked',
        internalName: 'HoursBooked' // TODO: Verify internal name
      },
      Description: {
        displayName: 'Description',
        internalName: 'Description' // TODO: Verify internal name
      }
    },
    // AttendanceRegularization columns
    AttendanceRegularization: {
      EmployeeID: {
        displayName: 'Employee ID',
        internalName: 'EmployeeID' // TODO: Verify internal name
      },
      RequestType: {
        displayName: 'Request Type',
        internalName: 'RequestType' // TODO: Verify internal name
      },
      StartDate: {
        displayName: 'Start Date',
        internalName: 'StartDate' // TODO: Verify internal name
      },
      EndDate: {
        displayName: 'End Date',
        internalName: 'EndDate' // TODO: Verify internal name
      },
      ExpectedIn: {
        displayName: 'Expected In',
        internalName: 'ExpectedIn' // TODO: Verify internal name
      },
      ExpectedOut: {
        displayName: 'Expected Out',
        internalName: 'ExpectedOut' // TODO: Verify internal name
      },
      Reason: {
        displayName: 'Reason',
        internalName: 'Reason' // TODO: Verify internal name
      },
      Status: {
        displayName: 'Status',
        internalName: 'Status' // TODO: Verify internal name
      },
      ManagerComment: {
        displayName: 'Manager Comment',
        internalName: 'ManagerComment' // TODO: Verify internal name
      }
    },
    // ProjectTaskMaster columns
    ProjectTaskMaster: {
      ProjectNo: {
        displayName: 'Project No',
        internalName: 'ProjectNo' // TODO: Verify internal name
      },
      ProjectName: {
        displayName: 'Project Name',
        internalName: 'ProjectName' // TODO: Verify internal name
      },
      TaskNo: {
        displayName: 'Task No',
        internalName: 'TaskNo' // TODO: Verify internal name
      },
      TaskName: {
        displayName: 'Task Name',
        internalName: 'TaskName' // TODO: Verify internal name
      },
      ResourceID: {
        displayName: 'Resource ID',
        internalName: 'ResourceID' // TODO: Verify internal name
      },
      TaskStatus: {
        displayName: 'Task Status',
        internalName: 'TaskStatus' // TODO: Verify internal name
      },
      BookingEnabled: {
        displayName: 'Booking Enabled',
        internalName: 'BookingEnabled' // TODO: Verify internal name
      }
    }
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
  // Maximum items per page (stay under 5000 threshold)
  DEFAULT_PAGE_SIZE: 1000,
  
  // Standard select query builder
  buildSelectQuery: (columns: string[]): string => {
    return `$select=${columns.join(',')}`;
  },
  
  // Standard filter query builder
  buildFilterQuery: (filters: string[]): string => {
    return filters.length > 0 ? `$filter=${filters.join(' and ')}` : '';
  },
  
  // Standard orderby query builder
  buildOrderByQuery: (orderBy: string, ascending: boolean = true): string => {
    return `$orderby=${orderBy} ${ascending ? 'asc' : 'desc'}`;
  },
  
  // Pagination query
  buildTopQuery: (top: number = 1000): string => {
    return `$top=${Math.min(top, 5000)}`;
  },
  
  // Expand lookup columns
  buildExpandQuery: (expandColumns: string[]): string => {
    return expandColumns.length > 0 ? `$expand=${expandColumns.join(',')}` : '';
  }
};