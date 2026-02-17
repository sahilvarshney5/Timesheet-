/**
 * Regularizationview.tsx
 *
 * BUSINESS RULE ENFORCED:
 *   Regularization timing MUST be sourced exclusively from Punch Data.
 *   Manual time input is DISABLED. If no punch record exists for the
 *   selected date the form blocks submission and shows a clear message.
 *
 * Architecture contract:
 *   - No interface changes (IRegularizationRequest, IAttendanceRegularization, IPunchData)
 *   - No SharePoint list schema changes
 *   - AttendanceService.getPunchByDate() is the ONLY source of truth for timings
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
 * false → lookup completed; no record found
 * IPunchData → lookup completed; record found
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
  /**
   * punchLookupResult: result of the punch query for the currently-selected fromDate.
   *   null  = no lookup done yet (fresh form)
   *   false = lookup done, no punch record found → BLOCK submission
   *   IPunchData = lookup done, record found → use these timings
   */
  const [punchLookupResult, setPunchLookupResult] = React.useState<PunchLookupResult>(null);
  const [isPunchLookupLoading, setIsPunchLookupLoading] = React.useState<boolean>(false);

  /**
   * Derived: timings extracted from the punch record (HH:mm strings for display).
   * These are NEVER edited by the user; they are read-only display values.
   */
  const [punchInTime, setPunchInTime] = React.useState<string>('');
  const [punchOutTime, setPunchOutTime] = React.useState<string>('');

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
   *
   * Problem: new Date("2026-02-10T08:00:00Z") shifts the time to local timezone
   *          e.g. 08:00 UTC → 13:30 IST, so getHours() returns 13 instead of 8.
   *
   * Solution: Regex-extract the time segment straight from the string.
   *   "2026-02-10T08:00:00Z"  → "08:00"
   *   "2026-02-10T08:00:00"   → "08:00"
   *   "2026-02-10T08:00"      → "08:00"
   */
  const isoToLocalHHmm = (isoString: string | undefined): string => {
    if (!isoString) return '';
    try {
      // Match the HH:mm portion that comes immediately after the 'T' separator
      const match = isoString.match(/T(\d{2}):(\d{2})/);
      if (match) {
        return match[1] + ':' + match[2]; // e.g. "08:00"
      }
      // Fallback: plain "HH:mm" or "HH:mm:ss" with no date part
      const timeOnly = isoString.match(/^(\d{2}):(\d{2})/);
      if (timeOnly) {
        return timeOnly[1] + ':' + timeOnly[2];
      }
      return '';
    } catch {
      return '';
    }
  };

  /** Format ISO datetime for display (HH:mm). */
  const formatTime = (isoString: string): string => isoToLocalHHmm(isoString) || isoString;

  /** Format date range label in history table. */
  const formatDateRange = (fromDate: string, toDate: string): string => {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (fromDate === toDate) {
      return from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  /** Convert category key to display text. */
  const formatCategoryText = (category: string): string =>
    category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  /** Calculate duration in whole days between two date strings (inclusive). */
  const calculateDuration = (from: string, to: string): number => {
    if (!from || !to) return 0;
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  /** Yesterday's date string (YYYY-MM-DD) – maximum allowed date for regularization. */
  const getMaxAllowedDate = (): string => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  };

  // ─── Punch lookup (core new behaviour) ───────────────────────────────────────

  /**
   * Fetch the punch record for a specific date.
   * This is the SOLE source of timing data. Called whenever fromDate changes.
   *
   * Side-effects:
   *   • setPunchLookupResult(record | false)
   *   • setPunchInTime / setPunchOutTime from the record's FirstPunchIn / LastPunchOut
   */
  const lookupPunchForDate = React.useCallback(
    async (selectedDate: string): Promise<void> => {
      // Reset state before lookup
      setPunchLookupResult(null);
      setPunchInTime('');
      setPunchOutTime('');

      if (!selectedDate) return;

      const empId = props.employeeMaster.EmployeeID;

      try {
        setIsPunchLookupLoading(true);

        // Fetch punch records for the single selected date.
        // getPunchData accepts startDate + endDate; passing the same date gives
        // a single-day query without needing a new service method.
        const records: IPunchData[] = await attendanceService.getPunchData(
          empId,
          selectedDate,
          selectedDate
        );

        if (records.length === 0) {
          // No punch record → block submission
          setPunchLookupResult(false);
          console.warn(
            `[RegularizationView] No punch record found for ${empId} on ${selectedDate}`
          );
          return;
        }

        // Use the first (and typically only) record
        const punch = records[0];
        setPunchLookupResult(punch);

        // Derive HH:mm strings from the punch timings
        const inTime = isoToLocalHHmm(punch.FirstPunchIn);
        const outTime = isoToLocalHHmm(punch.LastPunchOut);

        setPunchInTime(inTime);
        setPunchOutTime(outTime);

        console.log(
          `[RegularizationView] Punch found for ${selectedDate}: in=${inTime}, out=${outTime}`
        );
      } catch (err) {
        // On service error: treat as "no punch" to avoid silent data corruption
        console.error('[RegularizationView] Punch lookup failed:', err);
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
          key: desc.toLowerCase().replace(/\s+/g, '_'),
          text: desc,
        }))
      );
    } catch (err) {
      console.error('[RegularizationView] Error fetching regularization categories:', err);
      setStatusOptions([
        { key: 'late_coming', text: 'Late Coming' },
        { key: 'early_going', text: 'Early Going' },
        { key: 'missed_punch', text: 'Missed Punch' },
        { key: 'work_from_home', text: 'Work From Home' },
        { key: 'on_duty', text: 'On Duty' },
      ]);
    } finally {
      setIsLoadingStatuses(false);
    }
  }, [spHttpClient, siteUrl]);

  React.useEffect(() => {
    void fetchRegularizationCategories();
  }, [fetchRegularizationCategories]);

  React.useEffect(() => {
    void loadRegularizationHistory();
  }, [loadRegularizationHistory]);

  // ─── Modal open/close ─────────────────────────────────────────────────────────

  const handleOpenFormModal = (): void => {
    // Reset punch state for a fresh form
    setPunchLookupResult(null);
    setPunchInTime('');
    setPunchOutTime('');
    setIsFormModalOpen(true);
  };

  const handleCloseFormModal = (): void => {
    setIsFormModalOpen(false);
    setIsEditMode(false);
    setEditingRequest(null);
    setPunchLookupResult(null);
    setPunchInTime('');
    setPunchOutTime('');
    setDuration(0);
    setRegularizationType('day_based');
  };

  // ─── Type radio change ────────────────────────────────────────────────────────

  const handleTypeChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setRegularizationType(event.target.value);
  };

  // ─── Date change: trigger punch lookup ───────────────────────────────────────

  /**
   * Called whenever the "From Date" input changes.
   * Triggers punch lookup → populates read-only time fields.
   */
  const handleFromDateChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const selectedDate = e.target.value;

      // Duration calculation for day-based
      if (regularizationType !== 'time_based') {
        const toDateInput = document.querySelector('input[name="toDate"]') as HTMLInputElement | null;
        if (toDateInput && toDateInput.value) {
          setDuration(calculateDuration(selectedDate, toDateInput.value));
        }
      } else {
        setDuration(1);
      }

      // ── CORE: fetch punch record for the chosen date ─────────────────────────
      if (selectedDate) {
        void lookupPunchForDate(selectedDate);
      } else {
        setPunchLookupResult(null);
        setPunchInTime('');
        setPunchOutTime('');
      }
    },
    [regularizationType, lookupPunchForDate]
  );

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
      return { isValid: true, reason: '' }; // fail-open on unexpected errors
    }
  };

  // ─── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (isSaving) return;

    try {
      setIsSaving(true);
      setError(null);

      const form = event.target as HTMLFormElement;
      const formElements = form.elements;
      const employeeId = props.employeeMaster.EmployeeID;
      const fromDate = (formElements.namedItem('fromDate') as HTMLInputElement)?.value || '';
      let toDate = (formElements.namedItem('toDate') as HTMLInputElement)?.value || '';
      if (regularizationType === 'time_based') toDate = fromDate;
      const category = (formElements.namedItem('category') as HTMLSelectElement)?.value || '';
      const reason = (formElements.namedItem('reason') as HTMLTextAreaElement)?.value || '';

      // ── BUSINESS RULE: Punch data MUST exist for the selected date ─────────────
      if (punchLookupResult === false) {
        alert(
          'No punch data found for the selected date.\n\nRegularization cannot be raised without an existing punch record.'
        );
        setIsSaving(false);
        return;
      }

      if (punchLookupResult === null && !isEditMode) {
        // Lookup not triggered yet (user bypassed date change somehow)
        alert('Please select a date to look up punch data before submitting.');
        setIsSaving(false);
        return;
      }

      // ── BUSINESS RULE: Use ONLY punch timings – never form input ──────────────
      const punch = punchLookupResult as IPunchData;
      const timeStart = isoToLocalHHmm(punch.FirstPunchIn) || '00:00';
      const timeEnd = isoToLocalHHmm(punch.LastPunchOut) || '00:00';

      // ── VALIDATION: date range ─────────────────────────────────────────────────
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

      // ── Manager email: sourced exclusively from EmployeeMaster ────────────────
      // Graph API call removed — ManagerEmail is maintained in the EmployeeMaster
      // SharePoint list, keeping manager resolution consistent across all pages.
      const managerEmail = props.employeeMaster.Manager?.EMail || '';

      // ── Build payload ──────────────────────────────────────────────────────────
      const categoryFormatted = category.replace(/_/g, ' ').toUpperCase();
      const enhancedReason = `[${categoryFormatted}] ${reason}`;

      /**
       * StartDate / EndDate and ExpectedIn / ExpectedOut are set from
       * PunchData.FirstPunchIn / PunchData.LastPunchOut ONLY.
       * The SharePoint schema is unchanged; we simply populate it from
       * the correct source (Punch Data) instead of user input.
       */
      const newRequest: Partial<IAttendanceRegularization> = {
        EmployeeID: employeeId,
        RequestType: regularizationType === 'time_based' ? 'Time' : 'Day',
        StartDate: `${fromDate}T${timeStart}:00`,
        EndDate: `${toDate}T${timeEnd}:00`,
        ExpectedIn: `${fromDate}T${timeStart}:00`,
        ExpectedOut: `${toDate}T${timeEnd}:00`,
        Reason: enhancedReason,
        Status: 'Pending' as const,
        ManagerEmail: managerEmail,
      };

      // ── Persist ────────────────────────────────────────────────────────────────
      if (isEditMode && editingRequest) {
        await approvalService.updateRegularization(editingRequest.id!, newRequest);
        alert(
          `Draft regularization updated successfully!\n\nDate: ${fromDate}\nPunch In: ${timeStart}\nPunch Out: ${timeEnd}\nCategory: ${categoryFormatted}\n\nStatus: Updated`
        );
      } else {
        await approvalService.submitRegularizationRequest(newRequest);
        alert(
          `Regularization submitted successfully!\n\nDate: ${fromDate}\nPunch In (from system): ${timeStart}\nPunch Out (from system): ${timeEnd}\nCategory: ${categoryFormatted}\n\nStatus: Pending Manager Approval`
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
      setRegularizationType(request.requestType);
      setDuration(calculateDuration(request.fromDate, request.toDate));
      // Re-lookup punch for the draft's date so timings stay current
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
            req.id === requestId ? { ...req, status: 'pending' as IRegularizationRequest['status'] } : req
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
            req.id === requestId ? { ...req, status: 'draft' as IRegularizationRequest['status'] } : req
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

  /** Inline banner describing the punch lookup status in the form. */
  const renderPunchStatusBanner = (): JSX.Element | null => {
    if (isPunchLookupLoading) {
      return (
        <div className={styles.bannerStylesearch}>
          🔍 Looking up punch data for selected date…
        </div>
      );
    }

    if (punchLookupResult === false) {
      return (
        <div className={styles.bannerStylestatuspunchbar}>
          {/* style={bannerStyle('#FFEBEE', '#C62828', '#C62828')} */}
          <strong>⚠️ No punch data found for the selected date.</strong>
          <br />
          Regularization cannot be raised without an existing punch record.
          Please select a date on which you have a punch entry.
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

  // const bannerStyle = (bg: string, color: string, borderColor: string): React.CSSProperties => ({
  //   background: bg,
  //   border: `1px solid ${borderColor}`,
  //   borderRadius: '6px',
  //   padding: '0.75rem',
  //   marginBottom: '1rem',
  //   fontSize: 'var(--font-sm)',
  //   color,
  //   lineHeight: 1.5,
  // });

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
                    checked={
                      isEditMode && editingRequest
                        ? editingRequest.requestType === 'day_based' ||
                          editingRequest.requestType === 'Day'
                        : regularizationType === 'day_based'
                    }
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
                    checked={
                      isEditMode && editingRequest
                        ? editingRequest.requestType === 'time_based'
                        : regularizationType === 'time_based'
                    }
                    onChange={handleTypeChange}
                    disabled={isSaving}
                  />
                  <span className={styles.radioLabel}>Time-based</span>
                </label>
              </div>

              {/* Warning: past dates only */}
              <div className={styles.bannerStyle}>
                <strong>⚠️ Important:</strong> Regularization can only be raised for{' '}
                <strong>past dates</strong> (yesterday and earlier). Punch data must
                exist for the selected date — timings are auto-fetched from the system.
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

              {/* ── Read-only Punch Timings (time_based mode only) ────────────────
                   These fields show the system-fetched values.
                   They are ALWAYS disabled – no user can edit them.              */}
              {regularizationType === 'time_based' && (
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
                  disabled={
                    isSaving ||
                    isPunchLookupLoading ||
                    punchLookupResult === false // block if no punch record
                  }
                >
                  {isSaving
                    ? 'Saving…'
                    : isPunchLookupLoading
                    ? 'Checking punch data…'
                    : isEditMode
                    ? 'Update Draft'
                    : 'Submit Regularization'}
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
                  No regularization requests submitted yet.
                </td>
              </tr>
            ) : (
              regularizationHistory.map((request) => (
                <tr key={request.id}>
                  <td>{request.RequestID}</td>
                  <td>{formatDateRange(request.fromDate, request.toDate)}</td>
                  <td>{formatCategoryText(request.category)}</td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${
                        request.status === 'pending'
                          ? styles.statusPending
                          : request.status === 'approved'
                          ? styles.statusApproved
                          : styles.statusRejected
                      }`}
                    >
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    {new Date(request.submittedOn).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td style={{ display: 'flex', gap: '5px' }}>
                    <button
                      className={`${styles.btn} ${styles.btnOutline} ${styles.btnSmall}`}
                      onClick={() => { void handleView(request); }}
                    >
                      View
                    </button>
                    {request.status === 'pending' && (
                      <button
                        className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                        onClick={() => { void handleRecall(request.id!); }}
                      >
                        Recall
                      </button>
                    )}
                    {request.status === 'draft' && (
                      <>
                        <button
                          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                          onClick={() => handleEditDraft(request)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className={`${styles.btn} ${styles.btnSuccess} ${styles.btnSmall}`}
                          onClick={() => { void handleSubmitDraft(request.id!); }}
                        >
                          Submit
                        </button>
                      </>
                    )}
                    {request.status === 'approved' && (
                      <button
                        className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                        onClick={() => { void handleCancel(request.id!); }}
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
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  {selectedRequest.fromDate !== selectedRequest.toDate && (
                    <>
                      {' '}to{' '}
                      {new Date(selectedRequest.toDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
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
                    {selectedRequest.status.charAt(0).toUpperCase() +
                      selectedRequest.status.slice(1)}
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
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </strong>
              </div>

              {selectedRequest.approvedBy && (
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
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
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