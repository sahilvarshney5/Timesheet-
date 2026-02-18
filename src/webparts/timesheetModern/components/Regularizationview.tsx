/**
 * Regularizationview.tsx
 *
 * UPDATED BEHAVIOUR (v2):
 *   - If punch data EXISTS for the selected date → auto-fill timings (read-only). [unchanged]
 *   - If punch data DOES NOT EXIST → show manual Punch In / Punch Out time pickers,
 *     create a new Punch Data record first, then raise the regularization.
 *
 * Architecture contract:
 *   - No interface changes (IRegularizationRequest, IAttendanceRegularization, IPunchData)
 *   - No SharePoint list schema changes beyond the new IsManualEntry boolean column
 *     (handled entirely in AttendanceService.createManualPunchRecord)
 *   - All other flows (Attendance, Timesheet, Approval) remain untouched
 */

import * as React from 'react';
import styles from './TimesheetModern.module.scss';
import { SPHttpClient } from '@microsoft/sp-http';
import { ApprovalService } from '../services/ApprovalService';
import { AttendanceService } from '../services/AttendanceService';
import {
  IRegularizationRequest,
  IAttendanceRegularization,
  IEmployeeMaster,
  IPunchData,
} from '../models';


// ─── Props ────────────────────────────────────────────────────────────────────

export interface IRegularizationViewProps {
  onViewChange: (viewName: string) => void;
  spHttpClient: SPHttpClient;
  siteUrl: string;
  currentUserDisplayName: string;
  employeeMaster: IEmployeeMaster;
  userRole: 'Admin' | 'Manager' | 'Member';
}

// ─── Punch lookup state ────────────────────────────────────────────────────────

/**
 * Captures the result of a single-date punch lookup.
 * null  → lookup not yet performed / date cleared
 * false → lookup completed; no record found → show manual input
 * IPunchData → lookup completed; record found → use these timings (read-only)
 */
type PunchLookupResult = IPunchData | false | null;

// ─── Component ────────────────────────────────────────────────────────────────

const RegularizationView: React.FC<IRegularizationViewProps> = (props) => {
  const { onViewChange, spHttpClient, siteUrl } = props;

  // ── Form / UI state ──────────────────────────────────────────────────────────
  const [regularizationType, setRegularizationType] = React.useState<string>('day_based');
  const [regularizationHistory, setRegularizationHistory] = React.useState<IRegularizationRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [duration, setDuration] = React.useState<number>(0);
  const [statusOptions, setStatusOptions] = React.useState<Array<{ key: string; text: string }>>([]);
  const [isLoadingStatuses, setIsLoadingStatuses] = React.useState<boolean>(false);
  const [isFormModalOpen, setIsFormModalOpen] = React.useState<boolean>(false);
  const [viewDetailsModalOpen, setViewDetailsModalOpen] = React.useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = React.useState<IRegularizationRequest | null>(null);
  const [viewPunchData, setViewPunchData] = React.useState<IPunchData | null>(null);
  const [isEditMode, setIsEditMode] = React.useState<boolean>(false);
  const [editingRequest, setEditingRequest] = React.useState<IRegularizationRequest | null>(null);

  // ── Punch-data-driven timing state ───────────────────────────────────────────
  const [punchLookupResult, setPunchLookupResult] = React.useState<PunchLookupResult>(null);
  const [isPunchLookupLoading, setIsPunchLookupLoading] = React.useState<boolean>(false);

  /**
   * Auto-filled (read-only) times when punch record EXISTS.
   */
  const [punchInTime, setPunchInTime] = React.useState<string>('');
  const [punchOutTime, setPunchOutTime] = React.useState<string>('');

  /**
   * Manual entry times – only active when punchLookupResult === false.
   */
  const [manualPunchIn, setManualPunchIn]   = React.useState<string>('');
  const [manualPunchOut, setManualPunchOut] = React.useState<string>('');
  const [manualTimeError, setManualTimeError] = React.useState<string>('');

  // ── Services ─────────────────────────────────────────────────────────────────
  const approvalService = React.useMemo(
    () => new ApprovalService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  const attendanceService = React.useMemo(
    () => new AttendanceService(spHttpClient, siteUrl),
    [spHttpClient, siteUrl]
  );

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Extract HH:mm directly from an ISO datetime string WITHOUT timezone conversion.
   */
  const isoToLocalHHmm = (isoString: string | undefined): string => {
    if (!isoString) return '';
    try {
      const match = isoString.match(/T(\d{2}):(\d{2})/);
      if (match) return match[1] + ':' + match[2];
      const timeOnly = isoString.match(/^(\d{2}):(\d{2})/);
      if (timeOnly) return timeOnly[1] + ':' + timeOnly[2];
      return '';
    } catch {
      return '';
    }
  };

  const formatTime = (isoString: string): string => isoToLocalHHmm(isoString) || isoString;

  const formatDateRange = (fromDate: string, toDate: string): string => {
    const from = new Date(fromDate);
    const to   = new Date(toDate);
    if (fromDate === toDate) {
      return from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const formatCategoryText = (category: string): string =>
    category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  const calculateDuration = (from: string, to: string): number => {
    if (!from || !to) return 0;
    const fromDate = new Date(from);
    const toDate   = new Date(to);
    const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const getMaxAllowedDate = (): string => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  };

  /**
   * Convert HH:mm to total minutes for numeric comparison.
   */
  const hhmmToMinutes = (hhmm: string): number => {
    if (!hhmm) return 0;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };

  /**
   * Validate manual punch times.
   * Returns an error string or empty string if valid.
   */
  const validateManualTimes = (inTime: string, outTime: string): string => {
    if (!inTime)  return 'Punch In time is required.';
    if (!outTime) return 'Punch Out time is required.';
    if (hhmmToMinutes(outTime) <= hhmmToMinutes(inTime)) {
      return 'Punch Out time must be later than Punch In time.';
    }
    return '';
  };

  /**
   * Calculate display duration (HH:mm) from two HH:mm strings.
   */
  const calcTimeDuration = (inTime: string, outTime: string): string => {
    if (!inTime || !outTime) return '';
    const diff = hhmmToMinutes(outTime) - hhmmToMinutes(inTime);
    if (diff <= 0) return '';
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    // return `${h}h ${m.toString().padStart(2, '0')}m`;
    return `${h}h ${('0' + m.toString()).slice(-2)}m`;
  };

  // ─── Punch lookup ─────────────────────────────────────────────────────────────

  const lookupPunchForDate = React.useCallback(
    async (selectedDate: string): Promise<void> => {
      // Reset all punch state before lookup
      setPunchLookupResult(null);
      setPunchInTime('');
      setPunchOutTime('');
      setManualPunchIn('');
      setManualPunchOut('');
      setManualTimeError('');

      if (!selectedDate) return;

      const empId = props.employeeMaster.EmployeeID;

      try {
        setIsPunchLookupLoading(true);

        const records: IPunchData[] = await attendanceService.getPunchDatabyregularization(
          empId,
          selectedDate,
          selectedDate
        );

        if (records.length === 0) {
          // No punch record → allow manual entry
          setPunchLookupResult(false);
          console.warn(
            `[RegularizationView] No punch record for ${empId} on ${selectedDate} – manual entry enabled`
          );
          return;
        }

        const punch = records[0];
        setPunchLookupResult(punch);

        const inTime  = isoToLocalHHmm(punch.FirstPunchIn);
        const outTime = isoToLocalHHmm(punch.LastPunchOut);
        setPunchInTime(inTime);
        setPunchOutTime(outTime);

        console.log(
          `[RegularizationView] Punch found for ${selectedDate}: in=${inTime}, out=${outTime}`
        );
      } catch (err) {
        console.error('[RegularizationView] Punch lookup failed:', err);
        // Treat service error as "no punch" so form is not permanently blocked
        setPunchLookupResult(false);
      } finally {
        setIsPunchLookupLoading(false);
      }
    },
    [attendanceService, props.employeeMaster.EmployeeID]
  );

  // ─── Data loading ─────────────────────────────────────────────────────────────

  const loadRegularizationHistory = React.useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const empId = props.employeeMaster.EmployeeID;
      console.log(`[RegularizationView] Loading history for Employee ID: ${empId}`);
      const requests = await approvalService.getEmployeeRegularizations(empId);
      setRegularizationHistory(requests);
      console.log(`[RegularizationView] Loaded ${requests.length} regularization requests`);
    } catch (err) {
      console.error('[RegularizationView] Error loading regularization history:', err);
      setError('Failed to load regularization history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [props.employeeMaster.EmployeeID, approvalService]);

  const fetchRegularizationCategories = React.useCallback(async (): Promise<void> => {
    try {
      setIsLoadingStatuses(true);
      const endpoint = `${siteUrl}/_api/web/lists/getbytitle('Regularization%20Categories')/items?$select=Description&$top=5000`;
      const response = await spHttpClient.get(endpoint, SPHttpClient.configurations.v1);

      if (!response.ok) throw new Error(`Failed to fetch categories: ${response.statusText}`);

      const data = await response.json();
      const uniqueStatuses = Array.from(
        new Set(
          (data.value as Array<{ Description: string }>)
            .map((item) => item.Description)
            .filter((d) => d && d.trim() !== '')
        )
      ) as string[];

      setStatusOptions(
        uniqueStatuses.map((desc) => ({
          key:  desc.toLowerCase().replace(/\s+/g, '_'),
          text: desc,
        }))
      );
    } catch (err) {
      console.error('[RegularizationView] Error fetching regularization categories:', err);
      setStatusOptions([
        { key: 'late_coming',   text: 'Late Coming' },
        { key: 'early_going',   text: 'Early Going' },
        { key: 'missed_punch',  text: 'Missed Punch' },
        { key: 'work_from_home', text: 'Work From Home' },
        { key: 'on_duty',       text: 'On Duty' },
      ]);
    } finally {
      setIsLoadingStatuses(false);
    }
  }, [spHttpClient, siteUrl]);

  React.useEffect(() => { void fetchRegularizationCategories(); }, [fetchRegularizationCategories]);
  React.useEffect(() => { void loadRegularizationHistory(); },    [loadRegularizationHistory]);

  // ─── Modal open/close ─────────────────────────────────────────────────────────

  const handleOpenFormModal = (): void => {
    setPunchLookupResult(null);
    setPunchInTime('');
    setPunchOutTime('');
    setManualPunchIn('');
    setManualPunchOut('');
    setManualTimeError('');
    setIsFormModalOpen(true);
  };

  const handleCloseFormModal = (): void => {
    setIsFormModalOpen(false);
    setIsEditMode(false);
    setEditingRequest(null);
    setPunchLookupResult(null);
    setPunchInTime('');
    setPunchOutTime('');
    setManualPunchIn('');
    setManualPunchOut('');
    setManualTimeError('');
    setDuration(0);
    setRegularizationType('day_based');
  };

  // ─── Type radio change ────────────────────────────────────────────────────────

  const handleTypeChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setRegularizationType(event.target.value);
  };

  // ─── Date change: trigger punch lookup ───────────────────────────────────────

  const handleFromDateChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const selectedDate = e.target.value;

      if (regularizationType !== 'time_based') {
        const toDateInput = document.querySelector('input[name="toDate"]') as HTMLInputElement | null;
        if (toDateInput && toDateInput.value) {
          setDuration(calculateDuration(selectedDate, toDateInput.value));
        }
      } else {
        setDuration(1);
      }

      if (selectedDate) {
        void lookupPunchForDate(selectedDate);
      } else {
        setPunchLookupResult(null);
        setPunchInTime('');
        setPunchOutTime('');
        setManualPunchIn('');
        setManualPunchOut('');
        setManualTimeError('');
      }
    },
    [regularizationType, lookupPunchForDate]
  );

  // ─── Manual time field handlers ───────────────────────────────────────────────

  const handleManualPunchInChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setManualPunchIn(value);
    // Clear error on change; re-validate on blur / submit
    if (manualTimeError) setManualTimeError('');
  };

  const handleManualPunchOutChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setManualPunchOut(value);
    if (manualTimeError) setManualTimeError('');
  };

  const handleManualTimeBlur = (): void => {
    if (manualPunchIn && manualPunchOut) {
      const err = validateManualTimes(manualPunchIn, manualPunchOut);
      setManualTimeError(err);
    }
  };

  // ─── Validation ───────────────────────────────────────────────────────────────

  const validateDateRange = async (
    fromDate: string,
    toDate: string
  ): Promise<{ isValid: boolean; reason: string }> => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(toDate);
      end.setHours(0, 0, 0, 0);

      if (start >= today) {
        return {
          isValid: false,
          reason: `Cannot raise regularization for today or future dates.\n\nRegularization can only be raised for past dates (yesterday and earlier).`,
        };
      }
      if (end >= today) {
        return {
          isValid: false,
          reason: `To Date cannot be today or a future date.`,
        };
      }

      const invalidDates: string[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        if (dow === 0 || dow === 6) {
          invalidDates.push(`${d.toISOString().split('T')[0]} (Weekend)`);
        }
      }

      if (invalidDates.length > 0) {
        return {
          isValid: false,
          reason: `The following dates are not eligible for regularization:\n${invalidDates.join('\n')}`,
        };
      }

      return { isValid: true, reason: '' };
    } catch {
      return { isValid: true, reason: '' };
    }
  };
const createManualPunchRecord = React.useCallback(async (
  date: string,
  punchIn: string,
  punchOut: string
): Promise<void> => {
  try {
    // Calculate total hours from manual times
    const inDate = new Date(`${date}T${punchIn}:00`);
    const outDate = new Date(`${date}T${punchOut}:00`);
    const totalMs = outDate.getTime() - inDate.getTime();
    const totalHours = parseFloat((totalMs / (1000 * 60 * 60)).toFixed(2));

    const punchRecord = {
      Title: props.employeeMaster.EmployeeID,
      PunchDate: new Date(date).toISOString(),
      FirstPunchIn: punchIn,
      LastPunchOut: punchOut,
      TotalHours: totalHours,
      Status: 'Manual',
      Source: 'Manual Entry'
    };

    const endpoint = `${props.siteUrl}/_api/web/lists/getbytitle('Punch%20Data')/items`;

    const response = await props.spHttpClient.post(
      endpoint,
      SPHttpClient.configurations.v1,
      {
        headers: {
          'Accept': 'application/json;odata=nometadata',
          'Content-Type': 'application/json;odata=nometadata',
          'odata-version': ''
        },
        body: JSON.stringify(punchRecord)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create punch record: ${response.statusText} - ${errorText}`);
    }

    console.log('[RegularizationView] Manual punch record created successfully for date:', date);

  } catch (error) {
    console.error('[RegularizationView] Error creating manual punch record:', error);
    throw error; // Re-throw so submit handler can catch it
  }
}, [props.employeeMaster.EmployeeID, props.siteUrl, props.spHttpClient]);
  // ─── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (isSaving) return;

    try {
      setIsSaving(true);
      setError(null);

      const form         = event.target as HTMLFormElement;
      const formElements = form.elements;
      const employeeId   = props.employeeMaster.EmployeeID;
      const fromDate     = (formElements.namedItem('fromDate') as HTMLInputElement)?.value || '';
      let   toDate       = (formElements.namedItem('toDate')   as HTMLInputElement)?.value || '';
      if (regularizationType === 'time_based') toDate = fromDate;
      const category = (formElements.namedItem('category') as HTMLSelectElement)?.value || '';
      const reason   = (formElements.namedItem('reason')   as HTMLTextAreaElement)?.value || '';

      // ── Lookup not yet triggered guard ────────────────────────────────────────
      if (punchLookupResult === null && !isEditMode) {
        alert('Please select a date to look up punch data before submitting.');
        setIsSaving(false);
        return;
      }

      // ── Branch: manual entry path vs auto-fetch path ──────────────────────────
      let timeStart: string;
      let timeEnd:   string;

      if (punchLookupResult === false) {
        // ── MANUAL PATH ──────────────────────────────────────────────────────────
        // Validate manual times first
        const timeValidationError = validateManualTimes(manualPunchIn, manualPunchOut);
        if (timeValidationError) {
          setManualTimeError(timeValidationError);
          setIsSaving(false);
          return;
        }

        timeStart = manualPunchIn;
        timeEnd   = manualPunchOut;

      } else {
        // ── AUTO-FETCH PATH (existing behaviour) ──────────────────────────────────
        const punch = punchLookupResult as IPunchData;
        timeStart   = isoToLocalHHmm(punch.FirstPunchIn)  || '00:00';
        timeEnd     = isoToLocalHHmm(punch.LastPunchOut) || '00:00';
      }

      // ── Common validations ─────────────────────────────────────────────────────
      if (!isEditMode) {
        const exists = await approvalService.checkRegularizationExists(employeeId, fromDate);
        if (exists) {
          alert('Regularization already raised for this date.');
          setIsSaving(false);
          return;
        }
      }

      if (regularizationType !== 'time_based' && new Date(toDate) < new Date(fromDate)) {
        alert('To Date cannot be earlier than From Date');
        setIsSaving(false);
        return;
      }

      const dateRangeValid = await validateDateRange(fromDate, toDate);
      if (!dateRangeValid.isValid) {
        alert(`Cannot submit regularization:\n\n${dateRangeValid.reason}`);
        setIsSaving(false);
        return;
      }

      // ── Manager email ──────────────────────────────────────────────────────────
      const managerEmail = props.employeeMaster.Manager?.EMail || '';

      // ── If manual path: create punch record first ──────────────────────────────
      if (punchLookupResult === false) {
        console.log(
          `[RegularizationView] No punch record exists – creating manual punch entry for ${fromDate}`
        );

        try {
          // const newPunch = 
          // await attendanceService.createManualPunchRecord(
          //   employeeId,
          //   fromDate,
          //   manualPunchIn,
          //   manualPunchOut
          // );
          console.log(
            // `[RegularizationView] Manual punch record created: Id=${newPunch.Id}`
          );
          // Update lookup result so banner reflects the new record
          // setPunchLookupResult(newPunch);
        } catch (punchErr) {
          console.error('[RegularizationView] Failed to create manual punch record:', punchErr);
          alert(
            'Failed to create punch record.\n\n' +
            'Please check your inputs and try again.\n\n' +
            'If the problem persists, contact your administrator.'
          );
          setIsSaving(false);
          return;
        }
      }

      // ── Build regularization payload ───────────────────────────────────────────
      const categoryFormatted = category.replace(/_/g, ' ').toUpperCase();
      const enhancedReason    = `[${categoryFormatted}] ${reason}`;

      const newRequest: Partial<IAttendanceRegularization> = {
        EmployeeID:   employeeId,
        RequestType:  regularizationType === 'time_based' ? 'Time' : 'Day',
        StartDate:    `${fromDate}T${timeStart}:00`,
        EndDate:      `${toDate}T${timeEnd}:00`,
        ExpectedIn:   `${fromDate}T${timeStart}:00`,
        ExpectedOut:  `${toDate}T${timeEnd}:00`,
        Reason:       enhancedReason,
        Status:       'Pending' as const,
        ManagerEmail: managerEmail,
        FootPrint:"App"
      };

      // ── Persist ────────────────────────────────────────────────────────────────
      if (isEditMode && editingRequest) {
        await approvalService.updateRegularization(editingRequest.id!, newRequest);
        alert(
          `Draft regularization updated successfully!\n\nDate: ${fromDate}\nPunch In: ${timeStart}\nPunch Out: ${timeEnd}\nCategory: ${categoryFormatted}\n\nStatus: Updated`
        );
      } else {
        await approvalService.submitRegularizationRequest(newRequest);
        const punchSource = punchLookupResult 
          ? '(from system)'
          : '(manual entry)';
        alert(
          `Regularization submitted successfully!\n\nDate: ${fromDate}\nPunch In ${punchSource}: ${timeStart}\nPunch Out ${punchSource}: ${timeEnd}\nCategory: ${categoryFormatted}\n\nStatus: Pending Manager Approval`
        );
      }

      form.reset();
      setRegularizationType('day_based');
      setDuration(0);
      setIsEditMode(false);
      setEditingRequest(null);
      setPunchLookupResult(null);
      setPunchInTime('');
      setPunchOutTime('');
      setManualPunchIn('');
      setManualPunchOut('');
      setManualTimeError('');
      await loadRegularizationHistory();
      setIsFormModalOpen(false);

    } catch (err) {
      console.error('[RegularizationView] Error submitting regularization:', err);
      alert('Failed to submit regularization request. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Draft actions ────────────────────────────────────────────────────────────

  const handleEditDraft = React.useCallback(
    (request: IRegularizationRequest): void => {
      setEditingRequest(request);
      setIsEditMode(true);
      const normalizedType = request.requestType === 'Day' ? 'day_based' : request.requestType;
      setRegularizationType(normalizedType);
      setDuration(calculateDuration(request.fromDate, request.toDate));
      void lookupPunchForDate(request.fromDate);
      setIsFormModalOpen(true);
    },
    [lookupPunchForDate]
  );

  const handleSubmitDraft = React.useCallback(
    async (requestId: number): Promise<void> => {
      const request = regularizationHistory.find((r) => r.id === requestId);
      if (!request) return;
      if (!confirm('Are you sure you want to submit this draft request for approval?')) return;

      try {
        setIsLoading(true);
        await approvalService.updateRegularizationStatus(requestId, 'Pending');
        setRegularizationHistory((prev) =>
          prev.map((req) =>
            req.id === requestId
              ? { ...req, status: 'pending' as IRegularizationRequest['status'] }
              : req
          )
        );
        alert('Draft request submitted successfully for manager approval.');
      } catch (err) {
        console.error('[RegularizationView] Error submitting draft request:', err);
        alert('Failed to submit draft request. Please try again.');
      } finally {
        setIsLoading(false);
        void loadRegularizationHistory();
      }
    },
    [regularizationHistory, approvalService, loadRegularizationHistory]
  );

  const handleRecall = React.useCallback(
    async (requestId: number): Promise<void> => {
      const request = regularizationHistory.find((r) => r.id === requestId);
      if (!request) return;
      if (!confirm('Are you sure you want to recall this regularization request? It will be moved to Draft status.')) return;

      try {
        setIsLoading(true);
        await approvalService.recallRegularization(requestId, 'recall');
        setRegularizationHistory((prev) =>
          prev.map((req) =>
            req.id === requestId
              ? { ...req, status: 'draft' as IRegularizationRequest['status'] }
              : req
          )
        );
        alert('Regularization request recalled successfully and moved to Draft status.');
        await loadRegularizationHistory();
      } catch (err) {
        console.error('[RegularizationView] Error recalling request:', err);
        alert('Failed to recall regularization request. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [regularizationHistory, approvalService, loadRegularizationHistory]
  );

  const handleCancel = async (requestId: number): Promise<void> => {
    if (!confirm('Are you sure you want to cancel this approved regularization request?')) return;
    try {
      setIsLoading(true);
      await approvalService.recallRegularization(requestId, 'cancel');
      setRegularizationHistory((prev) =>
        prev.map((req) =>
          req.id === requestId ? { ...req, status: 'rejected' as const } : req
        )
      );
      await loadRegularizationHistory();
      alert('Regularization request cancelled successfully.');
    } catch (err) {
      console.error('[RegularizationView] Error cancelling request:', err);
      alert('Failed to cancel regularization request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = React.useCallback(
    async (request: IRegularizationRequest): Promise<void> => {
      try {
        setSelectedRequest(request);
        const empId = props.employeeMaster.EmployeeID;
        const punchDataForRange = await attendanceService.getPunchData(
          empId,
          request.fromDate,
          request.toDate
        );
        setViewPunchData(punchDataForRange.length > 0 ? punchDataForRange[0] : null);
        setViewDetailsModalOpen(true);
      } catch (err) {
        console.error('[RegularizationView] Error fetching punch data for view:', err);
        setViewPunchData(null);
        setViewDetailsModalOpen(true);
      }
    },
    [attendanceService, props.employeeMaster.EmployeeID]
  );

  const handleRefresh = React.useCallback((): void => {
    void loadRegularizationHistory();
  }, [loadRegularizationHistory]);

  // ─── Render helpers ───────────────────────────────────────────────────────────

  /**
   * Inline banner describing the punch lookup status in the form.
   * CHANGED: When no punch found, show informational (amber) banner instead of blocking (red) banner.
   */
  const renderPunchStatusBanner = (): JSX.Element | null => {
    if (isPunchLookupLoading) {
      return (
        <div className={styles.bannerStylesearch}>
          🔍 Looking up punch data for selected date…
        </div>
      );
    }

    if (punchLookupResult === false) {
      // Informational amber banner – does NOT block submission
      return (
        <div
          className={styles.bannerStylestatuspunchbar}
          style={{ borderColor: '#F9A825', backgroundColor: '#FFFDE7', color: '#F57F17' }}
        >
          <strong>⚠️ No punch data found for the selected date.</strong>
          <br />
          You can manually enter Punch In and Punch Out time below.
          <br />
          <span style={{ fontSize: '0.82rem', marginTop: '4px', display: 'inline-block' }}>
            A new punch record will be created automatically when you submit.
          </span>
        </div>
      );
    }



    if (punchLookupResult && punchLookupResult !== null) {
      const punch = punchLookupResult as IPunchData;
      return (
        <div className={styles.bannerStylestatusresult}>
          <strong>✅ Punch record found.</strong> Timings are auto-filled from the system.
          <br />
          <span style={{ fontSize: '0.85rem', marginTop: '4px', display: 'inline-block' }}>
            Punch In: <strong>{isoToLocalHHmm(punch.FirstPunchIn) || '—'}</strong>
            &nbsp;|&nbsp;
            Punch Out: <strong>{isoToLocalHHmm(punch.LastPunchOut) || '—'}</strong>
            &nbsp;|&nbsp;
            Total Hours: <strong>{punch.TotalHours !== undefined ? `${punch.TotalHours.toFixed(1)} hrs` : '—'}</strong>
          </span>
        </div>
      );
    }

    return null;
  };

  /**
   * Renders manual punch time pickers.
   * Only shown when punchLookupResult === false.
   */
  const renderManualTimeFields = (): JSX.Element | null => {
    if (punchLookupResult !== false) return null;

    const durationLabel = calcTimeDuration(manualPunchIn, manualPunchOut);

    return (
      <div
        style={{
          border:       '1px solid #F9A825',
          borderRadius: '6px',
          padding:      '1rem',
          marginBottom: '1rem',
          background:   '#FFFDE7',
        }}
      >
        <div style={{ marginBottom: '0.5rem', fontWeight: 600, fontSize: 'var(--font-sm)' }}>
          Manual Punch Times
        </div>

        <div className={styles.formRow}>
          {/* Punch In */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Punch In Time <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="time"
              name="manualPunchIn"
              className={styles.formInput}
              value={manualPunchIn}
              onChange={handleManualPunchInChange}
              onBlur={handleManualTimeBlur}
              disabled={isSaving}
              required
            />
          </div>

          {/* Punch Out */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Punch Out Time <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="time"
              name="manualPunchOut"
              className={styles.formInput}
              value={manualPunchOut}
              onChange={handleManualPunchOutChange}
              onBlur={handleManualTimeBlur}
              disabled={isSaving}
              required
            />
          </div>
        </div>

        {/* Duration preview */}
        {durationLabel && !manualTimeError && (
          <div style={{ fontSize: '0.82rem', color: '#2E7D32', marginTop: '4px' }}>
            ⏱ Duration: <strong>{durationLabel}</strong>
          </div>
        )}

        {/* Inline validation error */}
        {manualTimeError && (
          <div style={{ fontSize: '0.82rem', color: 'var(--danger)', marginTop: '4px' }}>
            ⚠ {manualTimeError}
          </div>
        )}
      </div>
    );
  };

  // ─── Loading / error states ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className={styles.viewContainer}>
        <div className={styles.dashboardHeader}>
          <h1>Attendance Regularization</h1>
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  if (error && !regularizationHistory.length) {
    return (
      <div className={styles.viewContainer}>
        <div className={styles.dashboardHeader}>
          <h1>Attendance Regularization</h1>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => { void loadRegularizationHistory(); }}
            style={{ marginTop: '1rem' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const maxDate = getMaxAllowedDate();

  // ─── Submit button disabled logic ─────────────────────────────────────────────

  /**
   * The submit button is disabled when:
   *   - Currently saving
   *   - Punch lookup in progress
   *   - Manual entry path AND there is a time validation error
   * NOTE: punchLookupResult === false no longer disables the button.
   */
  const isSubmitDisabled = (): boolean => {
    if (isSaving || isPunchLookupLoading) return true;
    if (punchLookupResult === false && manualTimeError !== '') return true;
    return false;
  };

  const getSubmitLabel = (): string => {
    if (isSaving)             return 'Saving…';
    if (isPunchLookupLoading) return 'Checking punch data…';
    if (isEditMode)           return 'Update Draft';
    return 'Submit Regularization';
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={styles.viewContainer}>
      <div className={styles.dashboardHeader}>
        <h1>Attendance Regularization</h1>
        <p>Submit requests to regularize your attendance (past dates only)</p>
      </div>

      {/* ── Form Modal ─────────────────────────────────────────────────────────── */}
      {isFormModalOpen && (
        <div className={styles.modal} style={{ display: 'flex' }}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>
                {isEditMode
                  ? 'Edit Draft Regularization Request'
                  : 'Request Attendance Regularization'}
              </h3>
              <button
                className={styles.closeBtn}
                onClick={handleCloseFormModal}
                type="button"
              >
                ×
              </button>
            </div>

            <form onSubmit={(e) => { void handleSubmit(e); }}>
              {/* Radio: Day-based / Time-based */}
              <div className={styles.radioGroup}>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="regularization-type"
                    value="day_based"
                    checked={regularizationType === 'day_based'}
                    onChange={handleTypeChange}
                    disabled={isSaving}
                  />
                  <span className={styles.radioLabel}>Day-based</span>
                </label>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="regularization-type"
                    value="time_based"
                    checked={regularizationType === 'time_based'}
                    onChange={handleTypeChange}
                    disabled={isSaving}
                  />
                  <span className={styles.radioLabel}>Time-based</span>
                </label>
              </div>

              {/* Warning banner */}
              <div className={styles.bannerStyle}>
                <strong>⚠️ Important:</strong> Regularization can only be raised for{' '}
                <strong>past dates</strong> (yesterday and earlier). If punch data exists,
                timings are auto-fetched. If not, you may enter them manually.
              </div>

              {/* Date + Category row */}
              <div className={styles.formRow3}>
                {/* From Date */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>From Date *</label>
                  <input
                    type="date"
                    name="fromDate"
                    className={styles.formInput}
                    max={maxDate}
                    disabled={isSaving}
                    defaultValue={isEditMode && editingRequest ? editingRequest.fromDate : ''}
                    onChange={handleFromDateChange}
                    required
                  />
                </div>

                {/* To Date (day-based only) */}
                {regularizationType !== 'time_based' && (
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>To Date *</label>
                    <input
                      type="date"
                      name="toDate"
                      className={styles.formInput}
                      max={maxDate}
                      disabled={isSaving}
                      defaultValue={isEditMode && editingRequest ? editingRequest.toDate : ''}
                      onChange={(e) => {
                        const fromDateInput = document.querySelector(
                          'input[name="fromDate"]'
                        ) as HTMLInputElement | null;
                        if (fromDateInput && fromDateInput.value) {
                          setDuration(calculateDuration(fromDateInput.value, e.target.value));
                        }
                      }}
                      required={regularizationType !== 'time_based'}
                    />
                  </div>
                )}

                {/* Category */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Category *</label>
                  <select
                    name="category"
                    className={styles.formSelect}
                    disabled={isSaving || isLoadingStatuses}
                    defaultValue={isEditMode && editingRequest ? editingRequest.category : ''}
                    required
                  >
                    <option value="">
                      {isLoadingStatuses ? 'Loading categories…' : 'Choose category…'}
                    </option>
                    {statusOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.text}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Duration (read-only) */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Duration (Days)</label>
                <input
                  type="number"
                  className={styles.formInput}
                  value={duration}
                  readOnly
                  disabled
                />
              </div>

              {/* ── Punch Status Banner ──────────────────────────────────────────── */}
              {renderPunchStatusBanner()}

              {/* ── Case 1: Auto-filled read-only times (time_based + punch exists) ── */}
              {regularizationType === 'time_based' && punchLookupResult  && (
                <div className={`${styles.timeBasedFields} ${styles.active}`}>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        Punch In Time
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                          (auto-filled from system)
                        </span>
                      </label>
                      <input
                        type="time"
                        name="timeStart"
                        className={styles.formInput}
                        value={punchInTime}
                        readOnly
                        disabled
                        style={{ backgroundColor: 'var(--bg-secondary, #f5f5f5)', cursor: 'not-allowed' }}
                        title="Time is automatically fetched from punch data and cannot be edited"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        Punch Out Time
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                          (auto-filled from system)
                        </span>
                      </label>
                      <input
                        type="time"
                        name="timeEnd"
                        className={styles.formInput}
                        value={punchOutTime}
                        readOnly
                        disabled
                        style={{ backgroundColor: 'var(--bg-secondary, #f5f5f5)', cursor: 'not-allowed' }}
                        title="Time is automatically fetched from punch data and cannot be edited"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Case 2: Manual time entry (no punch record found) ─────────────── */}
              {renderManualTimeFields()}

              {/* Reason */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Reason *</label>
                <textarea
                  name="reason"
                  className={styles.formTextarea}
                  placeholder="Explain why you need attendance regularization…"
                  disabled={isSaving}
                  defaultValue={
                    isEditMode && editingRequest
                      ? editingRequest.reason.replace(/^\[.*?\]\s*/, '')
                      : ''
                  }
                  required
                />
              </div>

              {/* Actions */}
              <div className={styles.formActions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={handleCloseFormModal}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={isSubmitDisabled()}
                >
                  {getSubmitLabel()}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── New Request Button ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleOpenFormModal}
          style={{ padding: '0.75rem 2rem', fontSize: 'var(--font-base)' }}
        >
          📝 Request Regularization
        </button>
      </div>

      {/* ── Regularization History ────────────────────────────────────────────── */}
      <div className={styles.regularizationHistory}>
        <div className={styles.historyHeader}>
          <h3>Regularization History</h3>
          <button
            className={`${styles.btn} ${styles.btnOutline}`}
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <table className={styles.historyTable}>
          <thead>
            <tr>
              <th>AR Request ID</th>
              <th>Date Range</th>
              <th>Category</th>
              <th>Status</th>
              <th>Submitted On</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {regularizationHistory.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.historyEmpty}>
                  No regularization requests found. Click &quot;Request Regularization&quot; to submit your first request.
                </td>
              </tr>
            ) : (
              regularizationHistory.map((request) => (
                <tr key={request.id}>
                  <td>{request.RequestID || `REG-${request.id}`}</td>
                  <td>{formatDateRange(request.fromDate, request.toDate)}</td>
                  <td>{formatCategoryText(request.category)}</td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${
                        request.status === 'pending'
                          ? styles.statusPending
                          : request.status === 'approved'
                          ? styles.statusApproved
                          : request.status === 'draft'
                          ? styles.statusDraft
                          : styles.statusRejected
                      }`}
                    >
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    {new Date(request.submittedOn).toLocaleDateString('en-US', {
                      month: 'short',
                      day:   'numeric',
                      year:  'numeric',
                    })}
                  </td>
                  <td>
                    <button
                      className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                      onClick={() => { void handleView(request); }}
                    >
                      View
                    </button>
                    {request.status === 'draft' && (
                      <>
                        <button
                          className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                          onClick={() => handleEditDraft(request)}
                          style={{ marginLeft: '4px' }}
                        >
                          Edit
                        </button>
                        <button
                          className={`${styles.btn} ${styles.btnSuccess} ${styles.btnSmall}`}
                          onClick={() => { void handleSubmitDraft(request.id!); }}
                          style={{ marginLeft: '4px' }}
                        >
                          Submit
                        </button>
                      </>
                    )}
                    {request.status === 'pending' && (
                      <button
                        className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                        onClick={() => { void handleRecall(request.id!); }}
                        style={{ marginLeft: '4px' }}
                      >
                        Recall
                      </button>
                    )}
                    {request.status === 'approved' && (
                      <button
                        className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                        onClick={() => { void handleCancel(request.id!); }}
                        style={{ marginLeft: '4px' }}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── View Details Modal ────────────────────────────────────────────────── */}
      {viewDetailsModalOpen && selectedRequest && (
        <div className={styles.attendanceModalOverlay}>
          <div className={styles.attendanceModal}>
            <div className={styles.modalHeader}>
              <h3>Regularization Request Details</h3>
              <button
                className={styles.closeBtn}
                onClick={() => {
                  setViewDetailsModalOpen(false);
                  setSelectedRequest(null);
                  setViewPunchData(null);
                }}
                type="button"
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.infoRow}>
                <span>AR Request ID</span>
                <strong>{selectedRequest.RequestID}</strong>
              </div>
              <div className={styles.infoRow}>
                <span>Date Range</span>
                <strong>
                  {new Date(selectedRequest.fromDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day:   'numeric',
                    year:  'numeric',
                  })}
                  {selectedRequest.fromDate !== selectedRequest.toDate && (
                    <>
                      {' '}to{' '}
                      {new Date(selectedRequest.toDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day:   'numeric',
                        year:  'numeric',
                      })}
                    </>
                  )}
                </strong>
              </div>
              <div className={styles.infoRow}>
                <span>Category</span>
                <strong>{formatCategoryText(selectedRequest.category)}</strong>
              </div>
              <div className={styles.infoRow}>
                <span>Status</span>
                <strong>
                  <span
                    className={`${styles.statusBadge} ${
                      selectedRequest.status === 'pending'
                        ? styles.statusPending
                        : selectedRequest.status === 'approved'
                        ? styles.statusApproved
                        : styles.statusRejected
                    }`}
                  >
                    {selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                  </span>
                </strong>
              </div>

              {/* Actual punch times from Punch Data */}
              {viewPunchData && (
                <>
                  <div className={styles.infoRow}>
                    <span>Actual Punch In</span>
                    <strong>
                      {viewPunchData.FirstPunchIn ? formatTime(viewPunchData.FirstPunchIn) : '—'}
                    </strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Actual Punch Out</span>
                    <strong>
                      {viewPunchData.LastPunchOut ? formatTime(viewPunchData.LastPunchOut) : '—'}
                    </strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Total Hours</span>
                    <strong>
                      {viewPunchData.TotalHours !== undefined
                        ? `${viewPunchData.TotalHours.toFixed(1)} hrs`
                        : '—'}
                    </strong>
                  </div>
                  {viewPunchData.Source === 'Regularization' && (
                    <div className={styles.infoRow}>
                      <span>Entry Type</span>
                      <strong style={{ color: '#F57F17' }}>Manual Entry</strong>
                    </div>
                  )}
                </>
              )}

              {/* Stored requested times (from submission) */}
              {selectedRequest.requestType === 'time_based' && (
                <>
                  <div className={styles.infoRow}>
                    <span>Requested In Time</span>
                    <strong>{selectedRequest.startTime || '—'}</strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Requested Out Time</span>
                    <strong>{selectedRequest.endTime || '—'}</strong>
                  </div>
                </>
              )}

              <div className={styles.infoRow}>
                <span>Reason</span>
                <strong>{selectedRequest.reason}</strong>
              </div>
              <div className={styles.infoRow}>
                <span>Submitted On</span>
                <strong>
                  {new Date(selectedRequest.submittedOn).toLocaleDateString('en-US', {
                    month:  'short',
                    day:    'numeric',
                    year:   'numeric',
                    hour:   '2-digit',
                    minute: '2-digit',
                  })}
                </strong>
              </div>

              {selectedRequest.status === 'approved' && selectedRequest.approvedBy && (
                <>
                  <div className={styles.infoRow}>
                    <span>Approved By</span>
                    <strong>{selectedRequest.approvedBy}</strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Approved On</span>
                    <strong>
                      {selectedRequest.approvedOn
                        ? new Date(selectedRequest.approvedOn).toLocaleDateString('en-US', {
                            month:  'short',
                            day:    'numeric',
                            year:   'numeric',
                            hour:   '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </strong>
                  </div>
                </>
              )}

              {selectedRequest.managerComment && (
                <div className={styles.infoRow}>
                  <span>Manager Comment</span>
                  <strong>{selectedRequest.managerComment}</strong>
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                className={`${styles.btn} ${styles.btnOutline}`}
                onClick={() => {
                  setViewDetailsModalOpen(false);
                  setSelectedRequest(null);
                  setViewPunchData(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegularizationView;