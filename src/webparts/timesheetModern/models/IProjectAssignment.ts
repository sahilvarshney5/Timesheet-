// src/webparts/timesheetModern/models/IProjectAssignment.ts
// Interface for Project Assignment list items

import { IBaseModel } from './IBaseModel';

export interface IProjectAssignment extends IBaseModel {
  /* Canonical Properties */
  ResourceID: string;           // Employee Resource ID (e.g., R0398)
  ProjectNumber: string;        // Project identifier
  ProjectName: string;          // Project name
  TaskNumber: string;           // Task identifier
  TaskName: string;             // Task description
  TaskStatus: string;           // Task status
  ValidFrom: string;            // Start date (ISO format)
  ValidTo: string;              // End date (ISO format)
  BookingEnabled: boolean;      // Whether timesheet booking is allowed
  Description: string;          // Task details
  ProjectID: string;            // Additional project identifier
  JobTaskType: string;          // Type of task (Development, Testing, etc.)
  DurationTask: string;         // Default duration in hours (stored as string)
}

export interface ITaskTypeOption {
  taskType: string;             // Job Task Type name
  duration: number;             // Duration in hours (parsed from DurationTask)
  projectNumber: string;        // Associated project
  taskNumber: string;           // Associated task
}