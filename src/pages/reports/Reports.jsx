import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useModuleStore } from "../../store/useModuleStore";
import { useEmployeeStore } from "../../store/useEmployeeStore";
import { useAttendanceStore } from "../../store/useAttendanceStore";
import { useGatePassStore } from "../../store/useGatePassStore";
import { useAdvanceLoanStore } from "../../store/useAdvanceLoanStore";
import PageLoader from "../../components/ui/PageLoader";
import PageHeader from "../../components/shared/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import toast from "react-hot-toast";
import { AlertCircle, BarChart3, ChevronDown, FileText, User } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, getTotalSalary } from "../../utils/helpers";
import "./Reports.scss";

const reportTypes = [
  { id: "payslip", label: "Payslip", icon: FileText },
  { id: "payroll", label: "Payroll", icon: BarChart3 },
  { id: "test-attendance-raw", label: "Test Attendance Raw", icon: BarChart3 },
  { id: "missing", label: "Missing Salary", icon: AlertCircle },
  { id: "cr", label: "Employee CR", icon: User },
];

const ATTENDANCE_API_URL = 'http://localhost:5001/api/attendance';

function downloadFile({ filename, content, mimeType }) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCSV(rows = []) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];
  return lines.join("\n");
}

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState("payslip");
  const [empCode, setEmpCode] = useState("");
  const [empSearch, setEmpSearch] = useState("");
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [apiAttendance, setApiAttendance] = useState([]);
  const [rawPunchRows, setRawPunchRows] = useState([]);
  const [hrManualTimes, setHrManualTimes] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [selectedShift, setSelectedShift] = useState("All");
  const [payslipView, setPayslipView] = useState("concentrated");
  const [payrollTab, setPayrollTab] = useState("detailed");
  const { setModule } = useModuleStore();
  const { employees, fetchEmployees } = useEmployeeStore();
  const { attendanceRecords, fetchAttendance } = useAttendanceStore();
  const { gatepasses, fetchGatepasses } = useGatePassStore();
  const { records: advanceLoans, fetchAdvanceLoans } = useAdvanceLoanStore();
  const employeeSearchRef = useRef(null);
  const apiAttendanceReqRef = useRef(0);
  const rawPunchReqRef = useRef(0);

  useEffect(() => {
    setModule("employee");
    Promise.all([fetchEmployees(), fetchAttendance(), fetchGatepasses(), fetchAdvanceLoans()]).then(() => setLoading(false));
  }, [setModule, fetchEmployees, fetchAttendance, fetchGatepasses, fetchAdvanceLoans]);

  const normalizeEmpCode = useCallback((value) =>
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ''), []);

  const emp = useMemo(() => {
    if (!employees || !empCode) return null;
    const target = normalizeEmpCode(empCode);
    return employees.find((e) => normalizeEmpCode(e.empCode) === target);
  }, [employees, empCode, normalizeEmpCode]);

  const filteredEmployees = useMemo(() => {
    const q = String(empSearch || '').trim().toLowerCase();
    if (!q) return employees || [];
    return (employees || []).filter((e) => {
      const fullName = `${e.firstName || ''} ${e.lastName || ''}`.trim().toLowerCase();
      const code = String(e.empCode || '').toLowerCase();
      return fullName.includes(q) || code.includes(q);
    });
  }, [employees, empSearch]);

  const selectedEmpCode = useMemo(
    () => String(emp?.empCode || empCode || '').trim(),
    [emp?.empCode, empCode]
  );

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!employeeSearchRef.current) return;
      if (!employeeSearchRef.current.contains(event.target)) {
        setEmployeeDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const selectEmployee = useCallback((selected) => {
    const code = String(selected?.empCode || '').trim();
    const fullName = `${selected?.firstName || ''} ${selected?.lastName || ''}`.trim();
    setEmpCode(code);
    setEmpSearch(`${fullName} (${code || '-'})`);
    setEmployeeDropdownOpen(false);
  }, []);

  const toApiDate = useCallback((dateObj) => {
    const yearStr = String(dateObj.getFullYear());
    const monthStr = String(dateObj.getMonth() + 1).padStart(2, "0");
    const dayStr = String(dateObj.getDate()).padStart(2, "0");
    return `${yearStr}/${monthStr}/${dayStr}`;
  }, []);

  const toRosterDateTime = useCallback((dateStr, timeStr) => {
    if (!timeStr || timeStr === 'OFF') return null;
    return new Date(`${dateStr}T${timeStr}:00`);
  }, []);

  const normalizePayrollStatus = useCallback((statusRaw) => {
    const status = String(statusRaw || '').toLowerCase();
    if (status === 'festival' || status === 'holiday') return 'holiday_avail';
    if (status === 'off') return 'off_avail';
    return status;
  }, []);

  const normalizeWaiveDeductionFlag = useCallback((value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return ['true', '1', 'yes', 'y', 'on'].includes(normalized);
    }
    return false;
  }, []);

  const getRosterForDate = useCallback((dateStr) => {
    if (!emp?.dutyRoster || !Array.isArray(emp.dutyRoster)) return null;
    const dayIndex = new Date(dateStr).getDay();
    const map = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayKey = map[dayIndex];
    return emp.dutyRoster.find((d) => d.day === dayKey) || null;
  }, [emp]);

  const isRosterOff = useCallback((dateStr) => {
    const roster = getRosterForDate(dateStr);
    if (!roster) return false;
    if (roster.hours !== undefined && Number(roster.hours) === 0) return true;
    if (roster.timeIn === 'OFF' || roster.timeOut === 'OFF') return true;
    return false;
  }, [getRosterForDate]);

  const getStandardDutyMinutes = useCallback(() => {
    const rosterDays = Array.isArray(emp?.dutyRoster) ? emp.dutyRoster : [];
    if (!rosterDays.length) return 8 * 60;

    for (const roster of rosterDays) {
      if (roster?.hours !== undefined && Number(roster.hours) > 0) {
        return Number(roster.hours) * 60;
      }
    }

    for (const roster of rosterDays) {
      if (roster?.timeIn && roster?.timeOut && roster.timeIn !== 'OFF' && roster.timeOut !== 'OFF') {
        const diff = (new Date(`1970-01-01T${roster.timeOut}`) - new Date(`1970-01-01T${roster.timeIn}`)) / 60000;
        const mins = diff > 0 ? diff : diff + (24 * 60);
        if (mins > 0) return mins;
      }
    }

    return 8 * 60;
  }, [emp]);

  // ─── Roster se scheduled minutes nikalo (night shift ke liye) ──────────────
  const getRosterScheduledMinutes = useCallback((dateStr) => {
    const roster = getRosterForDate(dateStr);
    if (!roster) return getStandardDutyMinutes();
    if (roster.hours !== undefined && Number(roster.hours) > 0) {
      return Number(roster.hours) * 60;
    }
    if (roster.timeIn && roster.timeOut && roster.timeIn !== 'OFF' && roster.timeOut !== 'OFF') {
      const diff = (new Date(`1970-01-01T${roster.timeOut}`) - new Date(`1970-01-01T${roster.timeIn}`)) / 60000;
      // Night shift: timeOut < timeIn toh +24 hrs
      return diff > 0 ? diff : diff + (24 * 60);
    }
    return getStandardDutyMinutes();
  }, [getRosterForDate, getStandardDutyMinutes]);

  const empAttendance = useMemo(() => {
    if (!emp || !attendanceRecords) return [];
    return attendanceRecords.filter((record) => {
      const recDate = new Date(record.date);
      return (
        record.employeeId === emp.id &&
        recDate.getMonth() + 1 === parseInt(month, 10) &&
        recDate.getFullYear() === parseInt(year, 10)
      );
    });
  }, [emp, attendanceRecords, month, year]);

  useEffect(() => {
    if (!emp || !month || !year) return;
    const reqId = ++apiAttendanceReqRef.current;
    const controller = new AbortController();

    const fetchApiAttendance = async () => {

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      // Avoid showing previous month rows while new month is loading
      setApiAttendance([]);

      try {
        const res = await fetch('http://localhost:5001/api/attendance/test-pairing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            startDate: `${year}-${month}-01`,
            endDate: `${year}-${month}-${String(endDate.getDate()).padStart(2, '0')}`,
            employeeId: emp.empCode
          })
        });
        const json = await res.json();
        if (controller.signal.aborted || reqId !== apiAttendanceReqRef.current) return;

        if (emp?.dutyRoster?.some(r => r.shift1 && r.shift2)) {
          try {
            const hrRes = await fetch(`http://localhost:5001/api/attendance/manual-times?empCode=${emp.empCode}&month=${month}&year=${year}`, {
              signal: controller.signal,
            });
            if (hrRes.ok) {
              const hrJson = await hrRes.json();
              if (controller.signal.aborted || reqId !== apiAttendanceReqRef.current) return;
              setHrManualTimes(Array.isArray(hrJson.data) ? hrJson.data : []);
            }
          } catch(e) {
            if (controller.signal.aborted) return;
            console.error('HR fetch err', e);
            setHrManualTimes([]);
          }
        }

        if (Array.isArray(json.data)) {
          const raw = json.data;
          const daysInMonth = endDate.getDate();
          const toDateKey = (value) => {
            if (!value) return "";
            const s = String(value);
            const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
            if (iso) return iso[1];
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) return "";
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
          };

          const mapped = Array.from({ length: daysInMonth }, (_, i) => {
            const dateStr = `${year}-${month}-${String(i + 1).padStart(2, '0')}`;
            const matchedRows = raw.filter((r) =>
              toDateKey(r.logicalDate) === dateStr ||
              toDateKey(r.date) === dateStr ||
              toDateKey(r.timeIn) === dateStr
            );

            const roster = getRosterForDate(dateStr);
            const scheduledIn  = toRosterDateTime(dateStr, roster?.timeIn  || '08:00');
            const scheduledOut = toRosterDateTime(dateStr, roster?.timeOut || '16:00');

            if (scheduledIn && scheduledOut && scheduledOut < scheduledIn) {
              scheduledOut.setDate(scheduledOut.getDate() + 1);
            }

            const inCandidates = matchedRows
              .map((r) => (r?.timeIn ? new Date(r.timeIn) : null))
              .filter((d) => d && !Number.isNaN(d.getTime()))
              .sort((a, b) => a - b);

            const outCandidates = matchedRows
              .map((r) => (r?.timeOut ? new Date(r.timeOut) : null))
              .filter((d) => d && !Number.isNaN(d.getTime()))
              .sort((a, b) => a - b);

            const pickClosestToSchedule = (candidates, scheduleTime, { beforeMinutes = 0, afterMinutes = 0 } = {}) => {
              if (!Array.isArray(candidates) || candidates.length === 0) return null;
              if (!scheduleTime) return candidates[0] || null;

              const scheduleMs = new Date(scheduleTime).getTime();
              const winStart = scheduleMs - (Math.max(0, beforeMinutes) * 60000);
              const winEnd = scheduleMs + (Math.max(0, afterMinutes) * 60000);

              const inWindow = candidates.filter((d) => {
                const t = new Date(d).getTime();
                return t >= winStart && t <= winEnd;
              });

              const pool = inWindow.length ? inWindow : candidates;
              return pool.reduce((best, curr) => {
                if (!best) return curr;
                const bestDiff = Math.abs(new Date(best).getTime() - scheduleMs);
                const currDiff = Math.abs(new Date(curr).getTime() - scheduleMs);
                return currDiff < bestDiff ? curr : best;
              }, null);
            };

            const inTime = pickClosestToSchedule(inCandidates, scheduledIn, { beforeMinutes: 180, afterMinutes: 240 }) || null;

            const outPool = outCandidates.filter((d) => {
              if (!inTime) return true;
              return new Date(d).getTime() >= new Date(inTime).getTime();
            });
            const outTime = (pickClosestToSchedule(outPool, scheduledOut, { beforeMinutes: 240, afterMinutes: 480 })
              || (outPool.length > 0 ? outPool[outPool.length - 1] : null)
              || null);
            const summedWorkedMinutes = matchedRows.reduce((sum, r) => {
              const v = Number(r?.workedMinutes);
              if (!Number.isFinite(v)) return sum;
              return sum + Math.max(0, Math.round(v));
            }, 0);

            const workedMinutes = summedWorkedMinutes > 0
              ? summedWorkedMinutes
              : ((inTime && outTime) ? Math.max(0, Math.round((new Date(outTime) - new Date(inTime)) / 60000)) : 0);

            // ─── FIX 1: Night shift crossing — actualOut next day ho sakta hai ──
            // Backend already ISO dates deta hai, lekin agar inTime > outTime ho
            // toh outTime next day ka hai
            let fixedOutTime = outTime;
            if (inTime && outTime && outTime < inTime) {
              fixedOutTime = new Date(outTime);
              fixedOutTime.setDate(fixedOutTime.getDate() + 1);
            }

            const isOff    = isRosterOff(dateStr);
            const isFuture = new Date(`${dateStr}T23:59:59`) > new Date();
            const dutyType = String(emp?.dutyType || '').toLowerCase();
            const isAlternativeDuty = dutyType === 'alternative' || dutyType === 'alternate';

            // ─── FIX 2: DB ka status priority pe hona chahiye ─────────────────
            // Pehle: status = isFuture ? 'Future' : (isOff ? 'Off' : (inTime ? 'Present' : 'Absent'))
            // Masla: DB mein agar 'missed_out', 'leave', 'off_not_avail' etc. save hai
            //        toh woh ignore ho raha tha
            // Fix: DB ka status use karo — sirf Future/Off override karo
            let resolvedStatus;
            if (isFuture) {
              resolvedStatus = 'Future';
            } else if (isAlternativeDuty && isOff && !inTime) {
              resolvedStatus = 'leave';
            } else if (matchedRows.some((r) => r?.status && r.status !== 'present')) {
              // DB se jo bhi non-present status aaya — wahi use karo
              const nonPresent = matchedRows.find((r) => r?.status && r.status !== 'present');
              resolvedStatus = nonPresent?.status || 'present';
            } else if (isOff && !inTime) {
              // Off day aur koi punch bhi nahi = off_avail
              resolvedStatus = 'off_avail';
            } else if (isOff && inTime) {
              // Off day par aaya = off_not_avail
              resolvedStatus = 'off_not_avail';
            } else if (!inTime) {
              resolvedStatus = 'leave';
            } else {
              resolvedStatus = 'present';
            }

            return {
              date:         new Date(dateStr),
              scheduledIn,
              scheduledOut,
              actualIn:     inTime,
              actualOut:    fixedOutTime,
              workedMinutes,
              // ─── FIX 3: rosterScheduledMinutes attach karo ─────────────────
              // DB records mein scheduledIn/Out null hote hain (syncAttendance ne save nahi kiye)
              // getScheduledMinutes default 8*60 deta hai — night 12hr shift ke liye galat
              rosterScheduledMinutes: getRosterScheduledMinutes(dateStr),
              status: resolvedStatus,
            };
          });

          const toMinuteToken = (value) => {
            if (!value) return '';
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) return '';
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          };

          for (let i = 1; i < mapped.length; i += 1) {
            const prev = mapped[i - 1];
            const curr = mapped[i];
            if (!prev || !curr) continue;

            const currHasGhostInOnly = Boolean(curr.actualIn) && !curr.actualOut && Math.max(0, Number(curr.workedMinutes) || 0) === 0;
            const looksLikePrevShiftOut = currHasGhostInOnly
              && Boolean(prev.actualOut)
              && toMinuteToken(curr.actualIn) === toMinuteToken(prev.actualOut);

            if (!looksLikePrevShiftOut) continue;

            curr.actualIn = null;
            curr.actualOut = null;
            curr.workedMinutes = 0;

            const currDateStr = new Date(curr.date).toISOString().split('T')[0];
            const currIsFuture = new Date(`${currDateStr}T23:59:59`) > new Date();
            const currIsOff = isRosterOff(currDateStr);
            const dutyType = String(emp?.dutyType || '').toLowerCase();
            const isAlternativeDuty = dutyType === 'alternative' || dutyType === 'alternate';

            if (currIsFuture) curr.status = 'Future';
            else if (isAlternativeDuty && currIsOff) curr.status = 'leave';
            else if (currIsOff) curr.status = 'off_avail';
            else curr.status = 'leave';
          }

          if (!controller.signal.aborted && reqId === apiAttendanceReqRef.current) {
            setApiAttendance(mapped);
          }
        } else {
          if (!controller.signal.aborted && reqId === apiAttendanceReqRef.current) {
            setApiAttendance([]);
          }
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        setApiAttendance([]);
      }

    };

    fetchApiAttendance();
    return () => {
      controller.abort();
    };
  }, [emp, month, year, getRosterForDate, toRosterDateTime, isRosterOff, getRosterScheduledMinutes]);

  useEffect(() => {
    if (!month || !year) return;
    const reqId = ++rawPunchReqRef.current;
    const controller = new AbortController();

    const fetchRawPunchRows = async () => {

      const shouldFetchForRawTab = activeReport === "test-attendance-raw";
      const shouldFetchForPayslip = activeReport === "payslip" && Boolean(selectedEmpCode);
      if (!shouldFetchForRawTab && !shouldFetchForPayslip) return;

      setRawPunchRows([]);

      try {
        const endDate = new Date(Number(year), Number(month), 0).getDate();
        const res = await fetch('http://localhost:5001/api/attendance/test-raw-punches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            startDate: `${year}-${month}-01`,
            endDate: `${year}-${month}-${String(endDate).padStart(2, '0')}`,
            employeeId: selectedEmpCode || undefined,
          }),
        });

        const json = await res.json();
        if (controller.signal.aborted || reqId !== rawPunchReqRef.current) return;
        setRawPunchRows(Array.isArray(json?.data) ? json.data : []);
      } catch (e) {
        if (controller.signal.aborted) return;
        setRawPunchRows([]);
      }

    };

    fetchRawPunchRows();
    return () => {
      controller.abort();
    };
  }, [activeReport, selectedEmpCode, month, year]);

  useEffect(() => {
    if (!month || !year) {
      setOverrides([]);
      return;
    }

    const controller = new AbortController();

    const fetchOverrides = async () => {
      try {
        const res = await fetch(`${ATTENDANCE_API_URL}/overrides?month=${month}&year=${year}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (controller.signal.aborted) return;
        setOverrides(Array.isArray(json?.data) ? json.data : []);
      } catch {
        if (controller.signal.aborted) return;
        setOverrides([]);
      }
    };

    fetchOverrides();
    return () => controller.abort();
  }, [month, year]);

  const basic      = Number(emp?.basicSalary) || 0;
  const allowances = emp?.allowances || [];
  const totalAllow = allowances.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const baseTotalSal = basic + totalAllow;

  const effectiveAttendance = apiAttendance.length ? apiAttendance : empAttendance;

  const gatepassMinutes = useMemo(() => {
    if (!emp) return 0;
    return gatepasses
      .filter((g) => g.employeeId === emp.id)
      .filter((g) => String(g.nature || '').toLowerCase() === 'personal')
      .filter((g) => {
        const d = new Date(g.issuedAt || g.outAt);
        return d.getMonth() + 1 === parseInt(month, 10) && d.getFullYear() === parseInt(year, 10);
      })
      .reduce((sum, g) => {
        const outAt = new Date(g.issuedAt || g.outAt);
        const inAt  = g.validTill || g.inAt ? new Date(g.validTill || g.inAt) : new Date();
        if (Number.isNaN(outAt.getTime()) || Number.isNaN(inAt.getTime())) return sum;
        return sum + Math.max(0, Math.round((inAt - outAt) / 60000));
      }, 0);
  }, [emp, gatepasses, month, year]);

  const effectiveAttendanceWithOverrides = useMemo(() => {
    if (!emp?.empCode) return effectiveAttendance;
    const targetCode = normalizeEmpCode(emp.empCode);
    const toDateKey = (value) => {
      if (!value) return '';
      const s = String(value).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const pref = s.match(/^(\d{4}-\d{2}-\d{2})/);
      if (pref) return pref[1];
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return '';
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    // Find all overrides for this employee on each date
    const result = [];
    
    // Step 1: Collect dates that exist in API attendance
    const existingDates = new Set(
      effectiveAttendance.map((r) => toDateKey(r.date)).filter(Boolean)
    );
    
    // Step 2: Process existing attendance records with their overrides
    effectiveAttendance.forEach((record) => {
      const dateStr = toDateKey(record.date);
      const dateOverrides = overrides.filter((o) => 
        normalizeEmpCode(o.empCode) === targetCode && toDateKey(o.dateIn || o.date) === dateStr
      );

      if (dateOverrides.length === 0) {
        // No override, use original record
        let modifiedRecord = { ...record };
        
        // Night crossing check
        if (modifiedRecord.actualIn && modifiedRecord.actualOut) {
          const inMs = new Date(modifiedRecord.actualIn).getTime();
          const outMs = new Date(modifiedRecord.actualOut).getTime();
          if (outMs < inMs) {
            const fixedOut = new Date(modifiedRecord.actualOut);
            fixedOut.setDate(fixedOut.getDate() + 1);
            modifiedRecord.actualOut = fixedOut;
          }
        }

        // Split shift logic
        const roster = getRosterForDate(dateStr);
        if (roster?.splitShift) {
          if (selectedShift === "Shift 1") {
            const shift1EndLimit = toRosterDateTime(dateStr, roster.shift1End || '15:00');
            if (!modifiedRecord.actualOut || (modifiedRecord.actualOut && shift1EndLimit && modifiedRecord.actualOut > shift1EndLimit)) {
              modifiedRecord.actualOut = shift1EndLimit;
            }
          } else if (selectedShift === "Shift 2") {
            const shift2StartLimit = toRosterDateTime(dateStr, roster.shift2Start || '15:00');
            if (!modifiedRecord.actualIn || (modifiedRecord.actualIn && shift2StartLimit && modifiedRecord.actualIn < shift2StartLimit)) {
              modifiedRecord.actualIn = shift2StartLimit;
            }
          }
        }

  result.push({ ...modifiedRecord, fromOverride: false });
      } else {
        // Multiple overrides for same date (split shifts)
        dateOverrides.forEach((override) => {
          const overrideManualDeduction = Number(override.manualDeduction);
          const roster = getRosterForDate(dateStr);
          const isOffDay = Boolean(
            roster && (
              (roster.hours !== undefined && Number(roster.hours) === 0) ||
              roster.timeIn === 'OFF' ||
              roster.timeOut === 'OFF'
            )
          );

          let modifiedRecord = {
            ...record,
            actualIn: override.timeIn ? new Date(`${dateStr}T${override.timeIn}`) : record.actualIn,
            actualOut: override.timeOut ? new Date(`${dateStr}T${override.timeOut}`) : record.actualOut,
            status: override.status || record.status,
            manualDeduction: Number.isFinite(overrideManualDeduction) ? overrideManualDeduction : null,
            waiveDeduction: normalizeWaiveDeductionFlag(override.waiveDeduction),
            fromOverride: true,
          };

          // Night crossing check after override
          if (modifiedRecord.actualIn && modifiedRecord.actualOut) {
            const inMs = new Date(modifiedRecord.actualIn).getTime();
            const outMs = new Date(modifiedRecord.actualOut).getTime();
            if (outMs < inMs) {
              const fixedOut = new Date(modifiedRecord.actualOut);
              fixedOut.setDate(fixedOut.getDate() + 1);
              modifiedRecord.actualOut = fixedOut;
            }
          }

          if (!override.status && modifiedRecord.actualIn && modifiedRecord.actualOut) {
            modifiedRecord.status = isOffDay ? 'off_not_avail' : 'present';
          }

          if (modifiedRecord.actualIn && modifiedRecord.actualOut) {
            const inMs = new Date(modifiedRecord.actualIn).getTime();
            const outMs = new Date(modifiedRecord.actualOut).getTime();
            if (Number.isFinite(inMs) && Number.isFinite(outMs)) {
              modifiedRecord.workedMinutes = Math.max(0, Math.round((outMs - inMs) / 60000));
            }
          }

          result.push(modifiedRecord);
        });
      }
    });

    // Step 3: Add manual-only overrides (dates not in API attendance)
    // Filter by selected month/year
    const manualOnlyOverrides = overrides.filter((o) => {
      if (normalizeEmpCode(o.empCode) !== targetCode) return false;
      const overrideDateKey = toDateKey(o.dateIn || o.date);
      if (!overrideDateKey) return false;
      if (existingDates.has(overrideDateKey)) return false;
      
      // Check if override date is in selected month/year
      const [overrideYear, overrideMonth] = overrideDateKey.split('-');
      
      return overrideMonth === month && overrideYear === year;
    });

    manualOnlyOverrides.forEach((override) => {
      const dateStr = toDateKey(override.dateIn || override.date);
      if (!dateStr) return;
      const roster = getRosterForDate(dateStr);
      const overrideManualDeduction = Number(override.manualDeduction);
      const isOffDay = Boolean(
        roster && (
          (roster.hours !== undefined && Number(roster.hours) === 0) ||
          roster.timeIn === 'OFF' ||
          roster.timeOut === 'OFF'
        )
      );
      
      const scheduledInTime = toRosterDateTime(dateStr, roster?.timeIn || '08:00');
      const scheduledOutTime = toRosterDateTime(dateStr, roster?.timeOut || '16:00');
      
      // Calculate scheduled minutes inline
      let rosterScheduledMinutes = 8 * 60; // default
      if (scheduledInTime && scheduledOutTime) {
        const diff = (new Date(scheduledOutTime) - new Date(scheduledInTime)) / 60000;
        if (diff > 0) rosterScheduledMinutes = Math.round(diff);
      }
      
      const manualRecord = {
        date: new Date(dateStr),
        scheduledIn: scheduledInTime,
        scheduledOut: scheduledOutTime,
        actualIn: override.timeIn ? new Date(`${dateStr}T${override.timeIn}`) : null,
        actualOut: override.timeOut ? new Date(`${dateStr}T${override.timeOut}`) : null,
        status: override.status || (isOffDay ? 'off_not_avail' : 'present'),
        rosterScheduledMinutes: rosterScheduledMinutes,
        manualDeduction: Number.isFinite(overrideManualDeduction) ? overrideManualDeduction : null,
        waiveDeduction: normalizeWaiveDeductionFlag(override.waiveDeduction),
        fromOverride: true,
      };

      // Night crossing check for manual entries
      if (manualRecord.actualIn && manualRecord.actualOut) {
        const inMs = new Date(manualRecord.actualIn).getTime();
        const outMs = new Date(manualRecord.actualOut).getTime();
        if (outMs < inMs) {
          const fixedOut = new Date(manualRecord.actualOut);
          fixedOut.setDate(fixedOut.getDate() + 1);
          manualRecord.actualOut = fixedOut;
        }
      }

      if (manualRecord.actualIn && manualRecord.actualOut) {
        const inMs = new Date(manualRecord.actualIn).getTime();
        const outMs = new Date(manualRecord.actualOut).getTime();
        if (Number.isFinite(inMs) && Number.isFinite(outMs)) {
          manualRecord.workedMinutes = Math.max(0, Math.round((outMs - inMs) / 60000));
        }
      }

      result.push(manualRecord);
    });

    // Sort all results by date
    return result.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA - dateB;
    });
  }, [effectiveAttendance, emp, normalizeEmpCode, overrides, getRosterForDate, selectedShift, toRosterDateTime, month, year, normalizeWaiveDeductionFlag]);

  const minutesBetween = useCallback((start, end) => {
    if (!start || !end) return 0;
    const diff = (new Date(end) - new Date(start)) / 60000;
    return diff > 0 ? Math.round(diff) : 0;
  }, []);

  // ─── FIX 5: getScheduledMinutes — rosterScheduledMinutes ko priority do ───
  // Pehle sirf scheduledIn/scheduledOut dekhta tha, jo DB records mein null hote hain
  // Ab rosterScheduledMinutes bhi dekhta hai jo fetchApiAttendance mein attach kiya
  const getScheduledMinutes = useCallback((record) => {
    // Roster ka explicit scheduled minutes (especially roster.hours) authoritative hai
    if (record.rosterScheduledMinutes && record.rosterScheduledMinutes > 0) {
      return record.rosterScheduledMinutes;
    }

    if (record.scheduledIn && record.scheduledOut) {
      return minutesBetween(record.scheduledIn, record.scheduledOut);
    }

    return 8 * 60; // last fallback
  }, [minutesBetween]);

  const getTieredPenaltyMinutes = useCallback((minutes) => {
    const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
    if (safeMinutes <= 10) return 0;
    return safeMinutes - 10;
  }, []);

  const getTimingPenaltyMinutes = useCallback((record) => {
  if (normalizeWaiveDeductionFlag(record?.waiveDeduction)) return 0;
    const status = normalizePayrollStatus(record.status);
    if (['holiday_avail', 'off_avail', 'holiday_not_avail', 'off_not_avail', 'future', 'absent', 'leave', 'leave_with_pay', 'missed_out'].includes(status)) {
      return 0;
    }

    if (!record.scheduledIn || !record.scheduledOut || !record.actualIn || !record.actualOut) return 0;

    const scheduledIn = new Date(record.scheduledIn);
    const scheduledOut = new Date(record.scheduledOut);
    const actualIn = new Date(record.actualIn);
    const actualOut = new Date(record.actualOut);

    const lateInMinutes = actualIn > scheduledIn ? minutesBetween(scheduledIn, actualIn) : 0;
    const earlyOutMinutes = actualOut < scheduledOut ? minutesBetween(actualOut, scheduledOut) : 0;

    const totalDeviationMinutes = lateInMinutes + earlyOutMinutes;
    return getTieredPenaltyMinutes(totalDeviationMinutes);
  }, [getTieredPenaltyMinutes, minutesBetween, normalizePayrollStatus, normalizeWaiveDeductionFlag]);

  const getLateMinutes = useCallback((record) => {
    const status = normalizePayrollStatus(record.status);
    if (['holiday_avail', 'off_avail', 'holiday_not_avail', 'off_not_avail', 'future', 'absent', 'leave', 'leave_with_pay', 'missed_out'].includes(status)) return 0;
    return typeof record.lateMinutes === 'number'
      ? record.lateMinutes
      : (record.actualIn && record.scheduledIn && new Date(record.actualIn) > new Date(record.scheduledIn)
        ? minutesBetween(record.scheduledIn, record.actualIn)
        : 0);
  }, [minutesBetween, normalizePayrollStatus]);

  // ─── FIX 6: getOvertimeMinutes — sirf scheduled se zyada waqt OT hai ──────
  const getOvertimeMinutes = useCallback((record) => {
    const status = normalizePayrollStatus(record.status);
    if (status === 'future') return 0;
    if (typeof record.overtimeMinutes === 'number') return record.overtimeMinutes;

    const workedFromRecord = Number(record?.workedMinutes);
    const workedMins = Number.isFinite(workedFromRecord)
      ? Math.max(0, Math.round(workedFromRecord))
      : ((record.actualIn && record.actualOut) ? minutesBetween(record.actualIn, record.actualOut) : 0);

    const isWorkedExtra = ['holiday_not_avail', 'off_not_avail'].includes(status);
    const isAvailOff    = ['holiday_avail', 'off_avail', 'leave_with_pay', 'leave', 'absent', 'missed_out'].includes(status);

    if (isWorkedExtra) {
      return workedMins;
    }
    if (isAvailOff) return 0;

    // Normal present — sirf scheduled se zyada time OT
    const scheduledMins = getScheduledMinutes(record);

    return workedMins > scheduledMins ? workedMins - scheduledMins : 0;
  }, [minutesBetween, normalizePayrollStatus, getScheduledMinutes]);

  const getWorkedMinutes = useCallback((record) => {
    const workedFromRecord = Number(record?.workedMinutes);
    if (Number.isFinite(workedFromRecord)) return Math.max(0, Math.round(workedFromRecord));
    if (!record.actualIn || !record.actualOut) return 0;
    return minutesBetween(record.actualIn, record.actualOut);
  }, [minutesBetween]);

  const overtimeMinutesByRecord = useMemo(() => {
    const map = new WeakMap();
    if (!Array.isArray(effectiveAttendanceWithOverrides) || effectiveAttendanceWithOverrides.length === 0) {
      return map;
    }

    const groups = new Map();
    effectiveAttendanceWithOverrides.forEach((record) => {
      const dateKey = new Date(record.date).toISOString().split('T')[0];
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey).push(record);
    });

    groups.forEach((records) => {
      const sorted = records.slice().sort((a, b) => {
        const aIn = a.actualIn ? new Date(a.actualIn).getTime() : Number.POSITIVE_INFINITY;
        const bIn = b.actualIn ? new Date(b.actualIn).getTime() : Number.POSITIVE_INFINITY;
        if (aIn !== bIn) return aIn - bIn;
        const aOut = a.actualOut ? new Date(a.actualOut).getTime() : Number.POSITIVE_INFINITY;
        const bOut = b.actualOut ? new Date(b.actualOut).getTime() : Number.POSITIVE_INFINITY;
        return aOut - bOut;
      });

      const scheduledForDay = sorted.reduce((maxVal, rec) => {
        const s = Math.max(0, Math.round(getScheduledMinutes(rec) || 0));
        return Math.max(maxVal, s);
      }, 0);

      let remainingDutyMinutes = scheduledForDay;

      sorted.forEach((record) => {
        const status = normalizePayrollStatus(record.status);
        const workedMins = getWorkedMinutes(record);

        if (status === 'future') {
          map.set(record, 0);
          return;
        }

        const isWorkedExtra = ['holiday_not_avail', 'off_not_avail'].includes(status);
        const isAvailOff = ['holiday_avail', 'off_avail', 'leave_with_pay', 'leave', 'absent', 'missed_out'].includes(status);

        if (isWorkedExtra) {
          map.set(record, workedMins);
          return;
        }

        if (isAvailOff || workedMins <= 0) {
          map.set(record, 0);
          return;
        }

        const dutyCoveredByRow = Math.min(remainingDutyMinutes, workedMins);
        const rowOvertime = Math.max(0, workedMins - dutyCoveredByRow);
        remainingDutyMinutes = Math.max(0, remainingDutyMinutes - dutyCoveredByRow);
        map.set(record, rowOvertime);
      });
    });

    return map;
  }, [effectiveAttendanceWithOverrides, getScheduledMinutes, normalizePayrollStatus, getWorkedMinutes]);

  const getAllocatedOvertimeMinutes = useCallback((record) => {
    if (overtimeMinutesByRecord.has(record)) {
      return overtimeMinutesByRecord.get(record) || 0;
    }
    return getOvertimeMinutes(record);
  }, [overtimeMinutesByRecord, getOvertimeMinutes]);

  const hasManualDeduction = useCallback((record) => {
    const value = Number(record?.manualDeduction);
    return Number.isFinite(value) && value > 0;
  }, []);

  const shouldSkipAutoDeduction = useCallback((record) => (
    normalizeWaiveDeductionFlag(record?.waiveDeduction) || hasManualDeduction(record)
  ), [hasManualDeduction, normalizeWaiveDeductionFlag]);

  const totalAbsents = effectiveAttendanceWithOverrides.filter((r) => {
    if (shouldSkipAutoDeduction(r)) return false;
    const status = normalizePayrollStatus(r.status);
    if (status !== 'absent') return false;
    const dateStr = new Date(r.date).toISOString().split('T')[0];
    if (new Date(`${dateStr}T23:59:59`) > new Date()) return false;
    return !isRosterOff(dateStr);
  }).length;

  // ─── FIX 7: missed_out = sirf timeIn hai, timeOut missing ─────────────────
  // Yeh absent nahi — deduction partial hona chahiye ya HR decide kare
  // Filhaal missed_out ko absent ki tarah treat karo (1x per day, not 2x)
  const totalMissedOut = effectiveAttendanceWithOverrides.filter((r) => {
    if (shouldSkipAutoDeduction(r)) return false;
    const status = normalizePayrollStatus(r.status);
    return status === 'missed_out';
  }).length;

  const totalLeaves = effectiveAttendanceWithOverrides.filter((r) => {
    if (shouldSkipAutoDeduction(r)) return false;
    const status = normalizePayrollStatus(r.status);
    if (status !== 'leave') return false;
    const dateStr = new Date(r.date).toISOString().split('T')[0];
    if (new Date(`${dateStr}T23:59:59`) > new Date()) return false;
    return true;
  }).length;

  const isLateDeductionEnabled = emp?.late === true;
  const totalLates   = isLateDeductionEnabled
    ? effectiveAttendanceWithOverrides.reduce((sum, r) => sum + (shouldSkipAutoDeduction(r) ? 0 : getTimingPenaltyMinutes(r)), 0)
    : 0;
  const totalOvertime = effectiveAttendanceWithOverrides.reduce((sum, r) => sum + getAllocatedOvertimeMinutes(r), 0);

  const daysInSelectedMonth = new Date(year, month, 0).getDate();
  const monthCheckNow = new Date();
  const selectedMonthStart = new Date(Number(year), Number(month) - 1, 1);
  const currentMonthStart = new Date(monthCheckNow.getFullYear(), monthCheckNow.getMonth(), 1);
  const isSelectedMonthFuture = selectedMonthStart > currentMonthStart;
  const effectiveBaseTotalSal = isSelectedMonthFuture ? 0 : baseTotalSal;
  
  // ─── Alternative Shift Logic: double per-day salary ───────────────────────
  // Employee jo alternate days aata hai (Mon, Wed, Fri...) uski salary 2x hogi
  const isAlternativeShift = emp?.dutyType?.toLowerCase() === 'alternative';
  const basePerDayRate = effectiveBaseTotalSal > 0 ? (effectiveBaseTotalSal / daysInSelectedMonth) : 0;
  const perDayRate = isAlternativeShift ? (basePerDayRate * 2) : basePerDayRate;

  const absentDeduction   = totalAbsents * (perDayRate * 2);
  const missedOutDeduction = totalMissedOut * perDayRate; // 1x deduction for missed punch
  const leaveDeduction    = 0;

  const lateDeduction = isLateDeductionEnabled
    ? effectiveAttendanceWithOverrides.reduce((sum, r) => {
      if (shouldSkipAutoDeduction(r)) return sum;
      const scheduledMinutes = getScheduledMinutes(r);
      if (scheduledMinutes <= 0) return sum;

      const timingPenaltyMinutes = getTimingPenaltyMinutes(r);
      if (timingPenaltyMinutes <= 0) return sum;

      const perMinuteRate = perDayRate / scheduledMinutes;
      return sum + Math.round(timingPenaltyMinutes * perMinuteRate);
    }, 0)
    : 0;

  const manualDeductionTotal = effectiveAttendanceWithOverrides.reduce((sum, r) => {
    if (normalizeWaiveDeductionFlag(r?.waiveDeduction)) return sum;
    if (!hasManualDeduction(r)) return sum;
    return sum + Math.max(0, Number(r.manualDeduction) || 0);
  }, 0);

  const gatepassDeduction  = Math.round(gatepassMinutes * (perDayRate / (8 * 60)));
  const currentMonthKey    = `${year}-${month}`;

  const isSameEmployee = (recordEmployeeId, selectedEmployeeId) =>
    String(recordEmployeeId ?? '') === String(selectedEmployeeId ?? '');

  const isOpenLoanStatus = (status) => {
    const closed = ['closed', 'completed', 'settled', 'cancelled', 'canceled'];
    return !closed.includes(String(status || '').toLowerCase());
  };

  const activeEmployeeLoans = advanceLoans
    .filter((a) => isSameEmployee(a.employeeId, emp?.id) && isOpenLoanStatus(a.status));

  const advanceDeduction = Math.round(activeEmployeeLoans
    .filter((a) => String(a.type || '').toLowerCase() === 'advance')
    .reduce((sum, a) => {
      const entry = (a.schedule || []).find((s) => s.month === currentMonthKey);
      return sum + (Number(entry?.amount) || 0);
    }, 0));

  const loanDeduction = Math.round(activeEmployeeLoans
    .filter((a) => String(a.type || '').toLowerCase() === 'loan')
    .reduce((sum, a) => {
      const entry = (a.schedule || []).find((s) => s.month === currentMonthKey);
      return sum + (Number(entry?.amount) || 0);
    }, 0));

  const loanRemainingBalance = Math.round(activeEmployeeLoans
    .filter((a) => String(a.type || '').toLowerCase() === 'loan')
    .reduce((sum, a) => {
      const principal = Number(a.amount) || 0;
      const paidTillMonth = (a.schedule || [])
        .filter((s) => String(s.month || '') <= currentMonthKey)
        .reduce((subtotal, s) => subtotal + (Number(s.amount) || 0), 0);

      return sum + Math.max(0, principal - paidTillMonth);
    }, 0));

  const shortLeaveRecords = (() => {
    try { return JSON.parse(localStorage.getItem('shortLeaveRecords')) || []; }
    catch { return []; }
  })();

  const getRosterMinutesForDate = (dateStr) => {
    const roster = getRosterForDate(dateStr);
    if (!roster) return 8 * 60;
    if (roster.hours !== undefined && Number(roster.hours) > 0) return Number(roster.hours) * 60;
    if (roster.timeIn && roster.timeOut && roster.timeIn !== 'OFF' && roster.timeOut !== 'OFF') {
      const diff = (new Date(`1970-01-01T${roster.timeOut}`) - new Date(`1970-01-01T${roster.timeIn}`)) / 60000;
      return diff > 0 ? diff : 8 * 60;
    }
    return 8 * 60;
  };

  const shortLeaveMinutes = shortLeaveRecords
    .filter((s) => s.empCode === emp?.empCode)
    .filter((s) => {
      const d = new Date(s.date);
      return d.getMonth() + 1 === parseInt(month, 10) && d.getFullYear() === parseInt(year, 10);
    })
    .reduce((sum, s) => {
      if (!s.timeOut || !s.timeIn) return sum;
      const outAt = new Date(`${s.date}T${s.timeOut}`);
      const inAt  = new Date(`${s.date}T${s.timeIn}`);
      if (Number.isNaN(outAt.getTime()) || Number.isNaN(inAt.getTime())) return sum;
      return sum + Math.max(0, Math.round((inAt - outAt) / 60000));
    }, 0);

  const shortLeaveDeduction = Math.round(shortLeaveRecords
    .filter((s) => s.empCode === emp?.empCode)
    .filter((s) => {
      const d = new Date(s.date);
      return d.getMonth() + 1 === parseInt(month, 10) && d.getFullYear() === parseInt(year, 10);
    })
    .reduce((sum, s) => {
      if (!s.timeOut || !s.timeIn) return sum;
      const outAt = new Date(`${s.date}T${s.timeOut}`);
      const inAt  = new Date(`${s.date}T${s.timeIn}`);
      if (Number.isNaN(outAt.getTime()) || Number.isNaN(inAt.getTime())) return sum;
      const mins         = Math.max(0, Math.round((inAt - outAt) / 60000));
      const rosterMins   = getRosterMinutesForDate(s.date);
      const perMinute    = rosterMins > 0 ? perDayRate / rosterMins : 0;
      return sum + (mins * perMinute);
    }, 0));

  const totalDeductions = Math.round(
    absentDeduction + missedOutDeduction + leaveDeduction + lateDeduction +
    (manualDeductionTotal || 0) + (gatepassDeduction || 0) + (advanceDeduction || 0) + (loanDeduction || 0) + (shortLeaveDeduction || 0)
  );

  const overtimeAddition = Math.round(effectiveAttendanceWithOverrides.reduce((sum, r) => {
    const scheduledMinutes = getScheduledMinutes(r);
    const perMinuteRate    = scheduledMinutes > 0 ? (perDayRate / scheduledMinutes) : 0;
    return sum + (getAllocatedOvertimeMinutes(r) * perMinuteRate);
  }, 0));

  const offDayBonus = 0;

  const getDualShiftData = useCallback((_dateStr, _apiPunches, _hrTimes) => {
    return { error: 'Not fully integrated, please provide precise dual-shift rules here.' };
  }, []);

  const rawPunchTimesByDate = useMemo(() => {
    if (!emp?.empCode || !rawPunchRows.length) return new Map();

    const targetCode = normalizeEmpCode(emp.empCode);
    const map = new Map();

    rawPunchRows.forEach((row) => {
      if (normalizeEmpCode(row.empCode) !== targetCode) return;
      if (!row.punchDate) return;

      const punches = Array.from({ length: 12 }, (_, i) => row[`Punch${i + 1}`])
        .map((v) => String(v || '').trim())
        .filter((v) => /^\d{2}:\d{2}$/.test(v));

      map.set(String(row.punchDate), punches);
    });

    return map;
  }, [emp?.empCode, normalizeEmpCode, rawPunchRows]);

  const detailedAttendanceRows = useMemo(() => {
    const workedHoursFromPair = (inTime, outTime) => {
      const inMatch = String(inTime || '').match(/^(\d{1,2}):(\d{2})$/);
      const outMatch = String(outTime || '').match(/^(\d{1,2}):(\d{2})$/);
      if (!inMatch || !outMatch) return '0.00';

      const inMinutes = (Number(inMatch[1]) * 60) + Number(inMatch[2]);
      const outMinutes = (Number(outMatch[1]) * 60) + Number(outMatch[2]);
      let diff = outMinutes - inMinutes;
      if (diff < 0) diff += 24 * 60; // overnight safety

      return (diff / 60).toFixed(2);
    };

    const workedMinutesFromPair = (inTime, outTime) => {
      const inMatch = String(inTime || '').match(/^(\d{1,2}):(\d{2})$/);
      const outMatch = String(outTime || '').match(/^(\d{1,2}):(\d{2})$/);
      if (!inMatch || !outMatch) return 0;

      const inMinutes = (Number(inMatch[1]) * 60) + Number(inMatch[2]);
      const outMinutes = (Number(outMatch[1]) * 60) + Number(outMatch[2]);
      let diff = outMinutes - inMinutes;
      if (diff < 0) diff += 24 * 60;
      return Math.max(0, diff);
    };

    if (effectiveAttendanceWithOverrides.length > 0) {
      const sortedAttendance = effectiveAttendanceWithOverrides
        .slice()
        .sort((a, b) => {
          const aDate = new Date(a.date).toISOString().split('T')[0];
          const bDate = new Date(b.date).toISOString().split('T')[0];
          if (aDate !== bDate) return aDate.localeCompare(bDate);

          const aIn = a.actualIn ? new Date(a.actualIn).getTime() : Number.POSITIVE_INFINITY;
          const bIn = b.actualIn ? new Date(b.actualIn).getTime() : Number.POSITIVE_INFINITY;
          if (aIn !== bIn) return aIn - bIn;

          const aOut = a.actualOut ? new Date(a.actualOut).getTime() : Number.POSITIVE_INFINITY;
          const bOut = b.actualOut ? new Date(b.actualOut).getTime() : Number.POSITIVE_INFINITY;
          return aOut - bOut;
        });

      const scheduledByDate = new Map();
      sortedAttendance.forEach((rec) => {
        const dateKey = new Date(rec.date).toISOString().split('T')[0];
        const scheduled = Math.max(0, Math.round(getScheduledMinutes(rec) || 0));
        const prev = scheduledByDate.get(dateKey) || 0;
        scheduledByDate.set(dateKey, Math.max(prev, scheduled));
      });

      const dayStateMap = new Map();

      return sortedAttendance.flatMap((record) => {
        const d      = new Date(record.date);
        const dayStr = d.toISOString().split('T')[0];

        if (!dayStateMap.has(dayStr)) {
          dayStateMap.set(dayStr, {
            remainingDutyMinutes: scheduledByDate.get(dayStr) || 0,
            deductionApplied: false,
          });
        }
        const dayState = dayStateMap.get(dayStr);

    const offDay       = isRosterOff(dayStr);
        const isFuture     = new Date(`${dayStr}T23:59:59`) > new Date();
        const actStatus    = normalizePayrollStatus(record.status);
    const hasManualPresentOverride = Boolean(record?.fromOverride) && actStatus === 'present';
    const effectiveOffDay = offDay && !hasManualPresentOverride;
        const isAvailOff   = ['holiday_avail', 'off_avail', 'leave_with_pay'].includes(actStatus);
        const isWorkedExtra = ['holiday_not_avail', 'off_not_avail'].includes(actStatus);
    const isMissedOut  = actStatus === 'missed_out';

        let tIn = "--"; let tOut = "--";
        if (record.actualIn)  tIn  = new Date(record.actualIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        if (record.actualOut) tOut = new Date(record.actualOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

        const scheduledMinutes = getScheduledMinutes(record);
  const lateMinutes      = effectiveOffDay || isFuture || isAvailOff || isWorkedExtra || isMissedOut || !isLateDeductionEnabled ? 0 : getTimingPenaltyMinutes(record);
  const overtimeMinutes  = isFuture ? 0 : getAllocatedOvertimeMinutes(record);
        const overtimeRateMinutes = isWorkedExtra
          ? Math.max(1, getRosterScheduledMinutes(dayStr))
          : scheduledMinutes;
        const perMinuteRate    = overtimeRateMinutes > 0 ? (perDayRate / overtimeRateMinutes) : 0;

        const workedMinutes = record.actualIn && record.actualOut
          ? Math.max(0, Math.round((new Date(record.actualOut) - new Date(record.actualIn)) / 60000))
          : 0;

        const isEligibleForDutyAllocation =
          !isFuture &&
          !isAvailOff &&
          !isWorkedExtra &&
          !effectiveOffDay &&
          actStatus !== 'absent' &&
          actStatus !== 'leave' &&
          actStatus !== 'missed_out';

        const rowDutyMinutes = isEligibleForDutyAllocation
          ? Math.min(workedMinutes, Math.max(0, dayState.remainingDutyMinutes))
          : 0;

        if (isEligibleForDutyAllocation) {
          dayState.remainingDutyMinutes = Math.max(0, dayState.remainingDutyMinutes - rowDutyMinutes);
        }

        const isLate      = lateMinutes > 0 ? "Y" : "N";
        const otHrs       = overtimeMinutes ? (overtimeMinutes / 60).toFixed(2) : "0.00";

        const isPayablePresentRow =
          !isFuture &&
          !isAvailOff &&
          !isWorkedExtra &&
          !effectiveOffDay &&
          actStatus !== 'absent' &&
          actStatus !== 'leave' &&
          actStatus !== 'missed_out' &&
          scheduledMinutes > 0;

        const baseWorkedMinutes = isPayablePresentRow
          ? rowDutyMinutes
          : Math.max(0, workedMinutes - overtimeMinutes);
        const proratedGross = Math.round(Math.min(perDayRate, Math.max(0, baseWorkedMinutes * perMinuteRate)));

        const grossPerDay = (isFuture || actStatus === 'leave')
          ? 0
          : (isPayablePresentRow ? proratedGross : Math.round(perDayRate));

        const wrkHrsRaw     = workedMinutes / 60;
        const wrkHrsRounded = isFuture ? 0 : parseFloat(wrkHrsRaw.toFixed(1));
        const wrkHrsDisplay = isFuture ? "0.00" : wrkHrsRounded.toFixed(2);

  const currLateDed = (!isLateDeductionEnabled || isAvailOff || isWorkedExtra || effectiveOffDay || isFuture || actStatus === 'absent' || actStatus === 'leave' || isMissedOut)
          ? 0
          : Math.round(lateMinutes * perMinuteRate);

        let dailyDeduction = 0;
        if (actStatus === 'absent')      dailyDeduction = perDayRate * 2;
  else if (actStatus === 'leave')  dailyDeduction = 0;
        else if (isMissedOut)            dailyDeduction = perDayRate; // 1x for missing punch

        const computedDeduction = (isAvailOff || isWorkedExtra || effectiveOffDay || isFuture)
          ? 0
          : Math.round(dailyDeduction + currLateDed);

        const rowDeduction = normalizeWaiveDeductionFlag(record?.waiveDeduction)
          ? 0
          : (hasManualDeduction(record) ? Math.max(0, Math.round(Number(record.manualDeduction) || 0)) : computedDeduction);

        const ded = (!dayState.deductionApplied && rowDeduction > 0)
          ? rowDeduction
          : 0;

        if (ded > 0) {
          dayState.deductionApplied = true;
        }

        const otVal = Math.round(overtimeMinutes * perMinuteRate);

        // ─── Status display — missed_out clearly dikhao ────────────────────
        let displayStatus;
        if (isFuture)          displayStatus = "Future";
        else if (isAvailOff || isWorkedExtra) displayStatus = actStatus;
  else if (effectiveOffDay)       displayStatus = "Off";
        else if (isMissedOut)  displayStatus = "Missed Punch";
        else                   displayStatus = actStatus || "present";

        const shouldHideDutyHours =
          isFuture ||
          actStatus === 'absent' ||
          actStatus === 'leave' ||
          isMissedOut ||
          isAvailOff ||
          (effectiveOffDay && !isWorkedExtra);

        const baseRow = {
          date:    dayStr,
          timeIn:  tIn,
          timeOut: tOut,
          dutyHrs: shouldHideDutyHours
            ? "0.00"
            : (rowDutyMinutes / 60).toFixed(2),
          wrkHrs:  wrkHrsDisplay,
          ot:      isFuture ? "0.00" : otHrs,
          otAmt:   String(Math.max(0, otVal)),
          late:    (isAvailOff || isWorkedExtra || effectiveOffDay || isFuture || actStatus === 'absent' || actStatus === 'leave' || isMissedOut) ? "N" : isLate,
          status:  displayStatus,
          salary:  String(grossPerDay),
          ded:     String(ded),
          total:   String(Math.max(0, grossPerDay - ded + otVal)),
        };

        const useRawPunchBreakdown = !record?.fromOverride;
        const rawPunches = useRawPunchBreakdown ? (rawPunchTimesByDate.get(dayStr) || []) : [];
        const hasComputedIn = tIn && tIn !== '--';
        const hasComputedOut = tOut && tOut !== '--';
        const displayBaseIn = hasComputedIn
          ? tIn
          : ((useRawPunchBreakdown && rawPunches.length >= 1) ? rawPunches[0] : '--');
        const displayBaseOut = hasComputedOut
          ? tOut
          : ((useRawPunchBreakdown && rawPunches.length >= 2) ? rawPunches[1] : '--');
        const displayBaseWrkHrs = workedHoursFromPair(displayBaseIn, displayBaseOut);
        if (!useRawPunchBreakdown || rawPunches.length <= 2) {
          return [{
            ...baseRow,
            timeIn: displayBaseIn,
            timeOut: displayBaseOut,
            wrkHrs: displayBaseWrkHrs,
          }];
        }

        const extraRows = [];
        for (let i = 2; i < rawPunches.length; i += 2) {
          const extraIn = rawPunches[i] || '--';
          const extraOut = rawPunches[i + 1] || '--';
          const extraWorkedMinutes = workedMinutesFromPair(extraIn, extraOut);

          let extraDutyMinutes = 0;
          let extraOvertimeMinutes = 0;

          if (!isFuture && !isAvailOff && !offDay && actStatus !== 'absent' && actStatus !== 'leave' && actStatus !== 'missed_out') {
            if (isWorkedExtra) {
              extraOvertimeMinutes = extraWorkedMinutes;
            } else {
              extraDutyMinutes = Math.min(extraWorkedMinutes, Math.max(0, dayState.remainingDutyMinutes));
              dayState.remainingDutyMinutes = Math.max(0, dayState.remainingDutyMinutes - extraDutyMinutes);
              extraOvertimeMinutes = Math.max(0, extraWorkedMinutes - extraDutyMinutes);
            }
          }

          const extraGross = Math.round(Math.min(perDayRate, Math.max(0, extraDutyMinutes * perMinuteRate)));
          const extraOtVal = Math.round(Math.max(0, extraOvertimeMinutes * perMinuteRate));
          const extraTotal = Math.max(0, extraGross + extraOtVal);

          extraRows.push({
            date: dayStr,
            timeIn: extraIn,
            timeOut: extraOut,
            dutyHrs: shouldHideDutyHours ? '0.00' : (extraDutyMinutes / 60).toFixed(2),
            wrkHrs: workedHoursFromPair(extraIn, extraOut),
            ot: isFuture ? '0.00' : (extraOvertimeMinutes / 60).toFixed(2),
            otAmt: String(extraOtVal),
            late: 'N',
            status: displayStatus,
            salary: String(extraTotal),
            ded: '0',
            total: String(extraTotal),
          });
        }

        return [{
          ...baseRow,
          timeIn: displayBaseIn,
          timeOut: displayBaseOut,
          wrkHrs: displayBaseWrkHrs,
        }, ...extraRows];
      }).sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        if (byDate !== 0) return byDate;

        const toMinutes = (timeValue) => {
          const m = String(timeValue || '').match(/^(\d{1,2}):(\d{2})$/);
          if (!m) return Number.POSITIVE_INFINITY; // '--' ya invalid values last mein
          return (Number(m[1]) * 60) + Number(m[2]);
        };

        return toMinutes(a.timeIn) - toMinutes(b.timeIn);
      });
    }

    const fallbackPerMinute = perDayRate > 0 ? (perDayRate / (8 * 60)) : 0;
    return Array.from({ length: 10 }, (_, i) => ({
      date:    `${year}-${month}-${String(i + 1).padStart(2, "0")}`,
      timeIn:  i % 6 === 0 ? "--" : "08:00",
      timeOut: i % 6 === 0 ? "--" : "16:00",
      dutyHrs: i % 6 === 0 ? "0.00" : "8.00",
      wrkHrs:  i % 6 === 0 ? "0.00" : "8.00",
      ot:      i % 4 === 0 ? "1.00" : "0.00",
      late:    i % 5 === 0 ? "Y" : "N",
      status:  i % 6 === 0 ? "Absent" : i % 5 === 0 ? "Late" : "Duty",
      salary:  i % 6 === 0 ? "0" : Math.round(perDayRate).toString(),
      ded:     i % 5 === 0 ? Math.round(15 * fallbackPerMinute).toString() : "0",
      total:   i % 6 === 0 ? "0" : Math.round(perDayRate).toString(),
    }));
  }, [effectiveAttendanceWithOverrides, month, year, perDayRate, getScheduledMinutes, getTimingPenaltyMinutes, getAllocatedOvertimeMinutes, isRosterOff, normalizePayrollStatus, rawPunchTimesByDate, hasManualDeduction, isLateDeductionEnabled, normalizeWaiveDeductionFlag]);

  const calculatedSalaryFromRows = useMemo(() => {
    return detailedAttendanceRows.reduce((sum, row) => {
      const amount = Number(row?.salary);
      if (!Number.isFinite(amount)) return sum;
      return sum + Math.max(0, Math.round(amount));
    }, 0);
  }, [detailedAttendanceRows]);

  const finalSal = emp
    ? Math.max(0, Math.round(calculatedSalaryFromRows + overtimeAddition - totalDeductions))
    : 0;
  const totalSal = finalSal;

  const missingSalaryRows = useMemo(() => {
    return employees.slice(0, 20).map((e, i) => ({
      code:    e.empCode,
      name:    `${e.firstName} ${e.lastName}`,
      active:  e.status === "Active" ? "Y" : "N",
      ot:      i % 3 === 0 ? "Y" : "N",
      month:   `${year}-${month}`,
      amount:  `PKR ${(isSelectedMonthFuture ? 0 : getTotalSalary(e.basicSalary, e.allowances || [])).toLocaleString()}`,
      flag:    i % 4 === 0 ? "Y" : "N",
      voucher: i % 2 === 0 ? `V-${String(1000 + i)}` : "",
    }));
  }, [employees, month, year, isSelectedMonthFuture]);

  const payrollDetailedRows = useMemo(() => {
    return detailedAttendanceRows.map((r, idx) => ({
      empCode: emp?.empCode || "-",
      dutyDt:  r.date,
      timeIn:  r.timeIn,
      timeOut: r.timeOut,
      dutySts: r.status,
      late:    r.late,
      dutyHrs: r.dutyHrs,
      wrkDays: idx === 0 ? '28' : '12',
      ot:      r.ot,
      perDay:  r.status === 'Future' ? '0' : Math.round(perDayRate).toString(),
      salary:  (() => {
        const salaryNum = Number(r.salary);
        const totalNum = Number(r.total);
        if (Number.isFinite(salaryNum) && salaryNum > 0) return String(Math.round(salaryNum));
        if (Number.isFinite(totalNum) && totalNum > 0) return String(Math.round(totalNum));
        return String(Math.max(0, Math.round(salaryNum || 0)));
      })(),
      otAmt:   r.status === 'Future' ? '0' : String(Math.max(0, Math.round(parseFloat(r.total || '0') - parseFloat(r.salary || '0') + parseFloat(r.ded || '0')))),
      ded:     r.ded,
      total:   r.total,
    }));
  }, [detailedAttendanceRows, emp, perDayRate]);

  const payrollConsolidatedRows = useMemo(() => {
    return employees.slice(0, 12).map((e) => ({
      code:      e.empCode,
      name:      `${e.firstName} ${e.lastName}`,
      netSalary: `PKR ${(isSelectedMonthFuture ? 0 : getTotalSalary(e.basicSalary, e.allowances || [])).toLocaleString()}`,
    }));
  }, [employees, isSelectedMonthFuture]);

  const exportMeta = {
    address:   "C 1-4 Survery # 675 Jaffar e Tayyar Society Malir, Karachi, Pakistan, 75210",phone:"021-34508390",whatsapp:  "+92 334 2225746",};

  const addPdfHeader = (pdf, title) => {
    const margin    = 40;
    const pageWidth = pdf.internal.pageSize.getWidth();
    pdf.setFontSize(14);
    pdf.text("Darul Shifa Imam Khomeini", pageWidth / 2, 40, { align: "center" });
    pdf.setFontSize(11);
    if (title !== "Detailed Payslip" && title !== "Payslip Report") {
      pdf.text(title, margin, 120);
    }
    return 140;
  };

  const addPdfFooter = (pdf) => {
    const margin    = 40;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const footerY   = pdf.internal.pageSize.getHeight() - 40;
    pdf.setFontSize(8);
    pdf.text(exportMeta.address, margin, footerY, { maxWidth: pageWidth - margin * 2 });
    pdf.text(`Tel: ${exportMeta.phone} | WhatsApp: ${exportMeta.whatsapp}`, margin, footerY + 12);
  };

  const createUrduTextImage = (text) => {
    const canvas = document.createElement("canvas");
    const ctx    = canvas.getContext("2d");
    const scale  = 2;
    canvas.width  = 1100 * scale;
    canvas.height = 50 * scale;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.fillStyle    = "#000000";
    ctx.font         = 'bold 16px Arial, Helvetica, "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", sans-serif';
    ctx.textAlign    = "right";
    ctx.textBaseline = "top";
    ctx.fillText(text, 1080, 10);
    return canvas.toDataURL("image/png");
  };

  const addPdfSignatures = (pdf, options = {}) => {
    const { forceFirstPage = false, fixedBaseY = null } = options;
    const margin     = 40;
    const pageWidth  = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let baseY = fixedBaseY ?? ((pdf.lastAutoTable?.finalY || 140) + 40);

    if (forceFirstPage) {
      pdf.setPage(1);
      baseY = fixedBaseY ?? (pageHeight - 165);
    } else if (baseY + 120 > pageHeight - 50) {
      pdf.addPage();
      baseY = 60;
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(forceFirstPage ? 9 : 10);
    pdf.text("I confirm that the salary generated is correct and I have no objections. Please pay my salary.", margin, baseY);

    const declaration = "میں تصدیق کرتا / کرتی ہوں کہ بنائی گئی تنخواہ درست ہے اور مجھے اس پر کوئی اعتراض نہیں ہے۔ برائے مہربانی میری اوپر بنائی گئی تنخواہ ادا کر دی جائے۔";
    const urduImage   = createUrduTextImage(declaration);
    pdf.addImage(urduImage, "PNG", margin - 20, baseY + 9, pageWidth - margin * 2, 25);

    const y        = baseY + (forceFirstPage ? 72 : 80);
    const colWidth = (pageWidth - margin * 2) / 3;
  const employeeSignatureLabel = `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() || "Employee";
  const labels   = ["Prepared By", "Administrator", employeeSignatureLabel];
    pdf.setLineWidth(0.5);
    labels.forEach((label, index) => {
      const x = margin + index * colWidth;
      pdf.line(x, y, x + colWidth - 12, y);
      pdf.setFontSize(forceFirstPage ? 9 : 10);
      pdf.text(label, x + 4, y + 15);
    });
  };

  const exportReportPdf = async (scope, { autoPrint = false } = {}) => {
    const isConcentratedPayslip = scope === "payslip";
    const pdf      = new jsPDF("p", "pt", isConcentratedPayslip ? "a5" : "a4");
    let startY     = 140;

    const titleMap = {
      payslip:               "Payslip Report",
      "payslip-detailed":    "Detailed Payslip",
      "payroll-detailed":    "Payroll Detailed",
      "payroll-consolidated":"Payroll Consolidated",
      "salary-register":     "Salary Register",
      missing:               "Missing Salary",
      cr:                    "Employee CR",
    };

    if (isConcentratedPayslip) {
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const labelX = margin;
      const stdX = pageWidth * 0.45;
      const monthX = pageWidth * 0.74;
      let y = 30;

      const drawSectionHeader = (left, middle, right) => {
        pdf.setTextColor(104, 122, 148);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text(left, labelX, y);
        if (middle) pdf.text(middle, stdX, y);
        if (right) pdf.text(right, monthX, y);
        y += 24;
      };

      const drawRow = (label, stdAmount, monthAmount, { bold = false } = {}) => {
        pdf.setTextColor(31, 41, 55);
        pdf.setFont("helvetica", bold ? "bold" : "normal");
        pdf.setFontSize(bold ? 11 : 10);
        pdf.text(String(label || "-"), labelX, y);
        if (stdAmount !== null && stdAmount !== undefined && stdAmount !== "") {
          pdf.text(String(stdAmount), stdX, y);
        }
        if (monthAmount !== null && monthAmount !== undefined && monthAmount !== "") {
          pdf.text(String(monthAmount), monthX, y);
        }
        y += bold ? 22 : 20;
      };

      const paymentRows = [
        { label: "Basic", std: basic.toLocaleString(), month: basic.toLocaleString() },
        ...(allowances || []).map((a) => ({
          label: String(a.type || "Other"),
          std: Number(a.amount || 0).toLocaleString(),
          month: Number(a.amount || 0).toLocaleString(),
        })),
      ];

      const deductionRows = [
        { label: `Absents x2 (${totalAbsents} days)`, amount: Math.round(absentDeduction).toLocaleString() },
        ...(totalMissedOut > 0 ? [{ label: `Missing Punch (${totalMissedOut} days)`, amount: Math.round(missedOutDeduction).toLocaleString() }] : []),
  ...(totalLeaves > 0 ? [{ label: `Leaves (${totalLeaves} days)`, amount: Math.round(leaveDeduction).toLocaleString() }] : []),
        { label: `Late Arrivals (${totalLates} mins)`, amount: Math.round(lateDeduction).toLocaleString() },
        { label: "Advance", amount: advanceDeduction.toLocaleString() },
        { label: "Loan (This Month)", amount: loanDeduction.toLocaleString() },
        { label: "Loan Remaining", amount: loanRemainingBalance.toLocaleString() },
        { label: `Gate Pass (Personal) (${gatepassMinutes} mins)`, amount: gatepassDeduction.toLocaleString() },
        { label: `Short Leave (${shortLeaveMinutes} mins)`, amount: shortLeaveDeduction.toLocaleString() },
      ];

      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(31, 41, 55);
      pdf.setFontSize(12);
      pdf.text(`${emp?.empCode || "-"} | ${emp?.firstName || ""} ${emp?.lastName || ""} | ${emp?.designation || "-"}`.trim(), margin, y);
      y += 20;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.text(`Pay Slip for the Month of: ${month}/${year}`, margin, y);
      y += 17;
      pdf.text(`Appointment: ${formatDate(emp?.appointmentDate)}`, margin, y);

      y += 24;
      drawSectionHeader("PAYMENTS", "STD AMOUNT", "THIS MONTH");
      paymentRows.forEach((row) => drawRow(row.label, row.std, row.month));
      drawRow("Total Payments", "", totalSal.toLocaleString(), { bold: true });

      y += 14;
      drawSectionHeader("DEDUCTIONS", "", "");
      deductionRows.forEach((row) => drawRow(row.label, "", row.amount));
      drawRow("Total Deductions", "", totalDeductions.toLocaleString());

      y += 10;
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(37, 99, 235);
      pdf.setFontSize(16);
      pdf.text(`NET SALARY: PKR ${totalSal.toLocaleString()}`, margin, y);

      y += 20;
      pdf.setTextColor(104, 122, 148);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(`Amount in words: ${totalSal.toLocaleString()} Only`, margin, y);

      if (overtimeAddition > 0) {
        y += 16;
        pdf.setTextColor(22, 128, 49);
        pdf.setFontSize(8);
        pdf.text(`Includes Overtime Bonus: PKR ${overtimeAddition.toLocaleString()} (${Math.round(totalOvertime / 60)} hrs)`, margin, y);
      }

      const signY = pageHeight - 38;
      const signGap = (pageWidth - margin * 2) / 3;
      const signLabels = ["Prepared By", "Administrator", "Receiver"];
      pdf.setDrawColor(203, 213, 225);
      pdf.setTextColor(104, 122, 148);
      pdf.setFontSize(8);

      signLabels.forEach((label, index) => {
        const x = margin + (index * signGap);
        pdf.line(x, signY - 12, x + signGap - 10, signY - 12);
        pdf.text(label, x + 6, signY + 2);
      });

      if (autoPrint) {
        pdf.autoPrint();
        window.open(pdf.output("bloburl"), "_blank");
        return;
      }

      pdf.save(`${scope}-${year}-${month}.pdf`);
      return;
    }

    startY = addPdfHeader(pdf, titleMap[scope] || "Report");

    if (scope === "payslip" || scope === "payslip-detailed") {
      const pageWidth = pdf.internal.pageSize.getWidth();
      const headerTopY = 78;
      const standardDutyMinutes = Math.max(1, Math.round(getStandardDutyMinutes() || (8 * 60)));
      const standardDutyHours = Number((standardDutyMinutes / 60).toFixed(2));
      pdf.setFontSize(8);
      const doj = emp?.appointmentDate ? new Date(emp.appointmentDate).toISOString().split('T')[0].split('-').reverse().join('-') : '-';
      pdf.text(`DOJ: ${doj}`, 40, headerTopY);
      pdf.setFontSize(12);
      pdf.text("Detailed Payslip", 40, headerTopY + 18, { fontStyle: "bold" });
      pdf.setFontSize(10);
      pdf.text(new Date().toISOString().split('T')[0].split('-').reverse().join('-'), 130, headerTopY + 18);
      const empTitle = `${emp?.firstName || ""} ${emp?.lastName || ""}`.trim().toUpperCase() + ` - ${emp?.empCode || "-"}`;
      pdf.text(empTitle, pageWidth / 2, headerTopY, { align: "center", fontStyle: "bold" });
      pdf.setFontSize(9);
      pdf.text(emp?.designation || "-", pageWidth / 2, headerTopY + 14, { align: "center" });
      const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      pdf.text(`${monthNames[parseInt(month)]} ${year}`, pageWidth / 2, headerTopY + 28, { align: "center", fontStyle: "bold" });
    pdf.setFontSize(10);
    pdf.text(`DUTY HOURS: ${standardDutyHours.toFixed(2)}`, pageWidth - 40, headerTopY, { align: "right" });
    const perHourSal = (effectiveBaseTotalSal / (new Date(year, month, 0).getDate() * standardDutyHours)).toFixed(2);
      pdf.text(`PERHOUR SALARY: ${perHourSal}`, pageWidth - 40, headerTopY + 18, { align: "right" });
      pdf.setFontSize(22); pdf.setTextColor(200);
      pdf.text("ONLY FOR REPORTING", pageWidth / 2, headerTopY + 40, { align: "center" });
      pdf.setTextColor(0);
      pdf.setFontSize(9);
      const summaryTopY = headerTopY + 58;
      const rightColX = pageWidth - 205;
      pdf.text(`CURRENT MONTH SALARY`, 40, summaryTopY, { fontStyle: "bold" });
  pdf.text(`TOTAL : ${effectiveBaseTotalSal.toLocaleString()}`, 40, summaryTopY + 15);
      pdf.text(`CURRUENT SALARY : ${totalSal.toLocaleString()}`, 40, summaryTopY + 30);
      pdf.text(`CURRUENT OVER TIME : ${overtimeAddition.toLocaleString()}`, 40, summaryTopY + 45);
      pdf.text(`DAILY DED : ${totalDeductions.toLocaleString()}`, 40, summaryTopY + 60);
      pdf.text(`ADVANCE DED (MONTH) : ${advanceDeduction.toLocaleString()}`, 40, summaryTopY + 75);
      pdf.text(`LOAN DED (MONTH) : ${loanDeduction.toLocaleString()}`, 40, summaryTopY + 90);
      pdf.text(`LOAN REMAINING : ${loanRemainingBalance.toLocaleString()}`, 40, summaryTopY + 105);
      pdf.text(`CURR. MONTH DEDUCTION`, rightColX, summaryTopY, { fontStyle: "bold" });
      pdf.text(`TOTAL : ${totalDeductions.toLocaleString()}`, rightColX, summaryTopY + 15);
      pdf.text(`ADV+LOAN : ${(advanceDeduction + loanDeduction).toLocaleString()}`, rightColX, summaryTopY + 30);
      // pdf.text(`NET SALARY`, rightColX, summaryTopY + 34, { fontStyle: "bold" });
      pdf.text(`NET SALARY : ${totalSal.toLocaleString()}`, rightColX, summaryTopY + 49);

      const dynamicAllowanceRows = (emp?.allowances || [])
        .map((a) => {
          const amount = Number(String(a?.amount ?? 0).replace(/,/g, "")) || 0;
          return { label: (a?.type || "Allowance").toUpperCase(), amount };
        })
        .filter((a) => a.amount > 0);

      const allowanceInlineParts = [
        { label: "BASIC", amount: basic },
        ...dynamicAllowanceRows,
  { label: "TOTAL", amount: effectiveBaseTotalSal },
      ];
      const allowanceLineRaw = allowanceInlineParts
        .map((p) => `${p.label}: ${Number(p.amount || 0).toLocaleString()}`)
        .join("   |   ");
      const allowanceLine = allowanceLineRaw.length > 130 ? `${allowanceLineRaw.slice(0, 127)}...` : allowanceLineRaw;

  const allowanceLineY = summaryTopY + 118;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text(allowanceLine, 40, allowanceLineY);
      pdf.setFont("helvetica", "normal");

      const isPayslipScope = scope === "payslip" || scope === "payslip-detailed";
      const toNumber = (value) => {
        const parsed = Number(String(value ?? "0").replace(/[^0-9.-]/g, ""));
        return Number.isFinite(parsed) ? parsed : 0;
      };

      const wrdDays = new Date(year, month, 0).getDate();
      const perDayAmount = Math.round(effectiveBaseTotalSal / wrdDays).toString();
      const tableRows = detailedAttendanceRows.map((r) => {
        const otAmnt = String(Math.max(0, Math.round(Number(r.otAmt) || 0)));
        return [r.date, r.timeIn, r.timeOut, r.status, r.late, r.dutyHrs, wrdDays, r.wrkHrs, r.ot, perDayAmount, r.salary, otAmnt, r.ded, r.total];
      });

      const totals = tableRows.reduce((acc, row) => {
        acc.dutyHrs += toNumber(row[5]);
        acc.wrkHrs += toNumber(row[7]);
        acc.otHrs += toNumber(row[8]);
        acc.salary += toNumber(row[10]);
        acc.otAmt += toNumber(row[11]);
        acc.ded += toNumber(row[12]);
        acc.total += toNumber(row[13]);
        return acc;
      }, { dutyHrs: 0, wrkHrs: 0, otHrs: 0, salary: 0, otAmt: 0, ded: 0, total: 0 });

      const totalsRow = [
        "TOTAL",
        "",
        "",
        "",
        "",
        totals.dutyHrs.toFixed(2),
        "",
        totals.wrkHrs.toFixed(2),
        totals.otHrs.toFixed(2),
        "",
        Math.round(totals.salary).toString(),
        Math.round(totals.otAmt).toString(),
        Math.round(totals.ded).toString(),
        Math.round(totals.total).toString(),
      ];

      autoTable(pdf, {
        startY: allowanceLineY + 16,
        head: [["DUTY DT", "TM IN", "TIME OUT", "DUTY STS", "LATE", "Dty Hrs", "Wrk Days", "WRK HRS", "O.T", "PER DAY", "SALARY", "O.T AMT", "DED", "TOTAL"]],
        body: [...tableRows, totalsRow],
        styles: {
          fontSize: isPayslipScope ? 6 : 7,
          cellPadding: isPayslipScope ? 1 : 2,
          halign: 'center',
          lineWidth: 0.1,
        },
        headStyles: { fillColor: [255, 255, 255], textColor: [0,0,0], fontStyle: "bold" },
        columnStyles: { 0: { halign: 'left' } },
        margin: isPayslipScope ? { left: 28, right: 28, bottom: 172 } : undefined,
      });
    }

    if (scope === "payroll-detailed") {
      autoTable(pdf, {
        startY,
        head: [["Emp ID", "Duty Dt", "Time In", "Time Out", "Duty Sts", "Late", "Duty Hrs", "Wrk Days", "OT", "Per Day", "Salary", "OT Amt", "Ded", "Total"]],
        body: payrollDetailedRows.map((r) => [r.empCode, r.dutyDt, r.timeIn, r.timeOut, r.dutySts, r.late, r.dutyHrs, r.wrkDays, r.ot, r.perDay, r.salary, r.otAmt, r.ded, r.total]),
        styles: { fontSize: 7 }, headStyles: { fillColor: [37, 99, 235] },
      });
    }

    if (scope === "payroll-consolidated") {
      autoTable(pdf, {
        startY,
        head: [["Code", "Name", "Net Salary"]],
        body: payrollConsolidatedRows.map((r) => [r.code, r.name, r.netSalary]),
        styles: { fontSize: 9 }, headStyles: { fillColor: [37, 99, 235] },
      });
    }

    if (scope === "salary-register") {
      autoTable(pdf, {
        startY,
        head: [["Code", "Name", "Amount"]],
        body: salaryRegisterRows.map((r) => [r.code, r.name, r.amount]),
        styles: { fontSize: 9 }, headStyles: { fillColor: [37, 99, 235] },
      });
    }

    if (scope === "missing") {
      autoTable(pdf, {
        startY,
        head: [["Code", "Name", "Active", "OT", "Month", "Amount", "Flag", "Voucher"]],
        body: missingSalaryRows.map((r) => [r.code, r.name, r.active, r.ot, r.month, r.amount, r.flag, r.voucher || "-"]),
        styles: { fontSize: 8 }, headStyles: { fillColor: [37, 99, 235] },
      });
    }

    if (scope === "cr") {
      autoTable(pdf, {
        startY,
        head: [["Field", "Value", "Field", "Value"]],
        body: [
          ["Employee ID", emp?.empCode || "-", "Employee Name", `${emp?.firstName || ""} ${emp?.lastName || ""}`.trim() || "-"],
          ["Father Name", emp?.fatherName || "-", "CNIC", emp?.nic || "-"],
          ["Department", emp?.department || "-", "Designation", emp?.designation || "-"],
          ["Date of Joining", formatDate(emp?.joiningDate), "Employment Status", emp?.status || "-"],
        ],
        styles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: "bold" }, 2: { fontStyle: "bold" } },
        headStyles: { fillColor: [37, 99, 235] },
      });
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 16,
        head: [["Working Days", "Late", "Short Leave", "Gate Pass", "Overtime", "Net Salary"]],
        body: [["26", "2", "1", "1", "4", `PKR ${totalSal.toLocaleString()}`]],
        styles: { fontSize: 9 }, headStyles: { fillColor: [59, 130, 246] },
      });
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 16,
        head: [["Criteria", "Rating", "Remarks"]],
        body: [["Punctuality", "4", "Very Good"], ["Work Quality", "4", "Consistent"], ["Team Work", "5", "Excellent"]],
        styles: { fontSize: 9 }, headStyles: { fillColor: [37, 99, 235] },
      });
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 16,
        head: [["Date", "Action Type", "Reason"]],
        body: [["-", "-", "-"]],
        styles: { fontSize: 9 }, headStyles: { fillColor: [30, 64, 175] },
      });
    }

    const keepOnFirstPage = scope === "payslip" || scope === "payslip-detailed";
    addPdfSignatures(pdf, {
      forceFirstPage: keepOnFirstPage,
      fixedBaseY: keepOnFirstPage ? (pdf.internal.pageSize.getHeight() - 165) : null,
    });
    addPdfFooter(pdf);

    if (autoPrint) {
      pdf.autoPrint();
      window.open(pdf.output("bloburl"), "_blank");
      return;
    }
    pdf.save(`${scope}-${year}-${month}.pdf`);
  };

  const salaryRegisterRows = useMemo(() => {
    return employees.map((e) => ({
      code:   e.empCode,
      name:   `${e.firstName} ${e.lastName}`,
      amount: `PKR ${getTotalSalary(e.basicSalary, e.allowances || []).toLocaleString()}`,
    }));
  }, [employees]);

  const handleExport = (type, scope) => {
    try {
      if (type === "pdf" || type === "print") {
        const pdfScope = scope === "payslip" && payslipView === "detailed" ? "payslip-detailed" : scope;
        exportReportPdf(pdfScope, { autoPrint: type === "print" });
        return;
      }
      let rows = [];
      if (scope === "missing")              rows = missingSalaryRows;
  if (scope === "test-attendance-raw")  rows = rawPunchRows;
      if (scope === "payroll-detailed")     rows = payrollDetailedRows;
      if (scope === "payroll-consolidated") rows = payrollConsolidatedRows;
      if (scope === "salary-register")      rows = salaryRegisterRows;
      if (scope === "payslip") {
        rows = [
          { field: "Emp Code",    value: emp?.empCode },
          { field: "Name",        value: `${emp?.firstName} ${emp?.lastName}` },
          { field: "Designation", value: emp?.designation },
          { field: "Month",       value: `${year}-${month}` },
          { field: "Basic Salary",value: basic },
          { field: "Allowances",  value: totalAllow },
          { field: "Net Salary",  value: totalSal },
        ];
      }
      if (scope === "cr") {
        rows = [
          { field: "Emp Code",  value: emp?.empCode },
          { field: "Employee",  value: `${emp?.firstName} ${emp?.lastName}` },
          { field: "Department",value: emp?.department },
          { field: "Designation",value: emp?.designation },
        ];
      }
      if (type === "excel") {
        downloadFile({ filename: `${scope}-${year}-${month}.csv`, content: toCSV(rows), mimeType: "text/csv;charset=utf-8" });
        toast.success("Excel (CSV) downloaded");
      }
    } catch {
      toast.error("Export failed (dummy)");
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="reports-page">
      <PageHeader
        breadcrumbs={[{ link: "/employee-module", label: "Dashboard" }, { label: "Reports" }]}
        title="Reports"
      />

      <div className="report-types print-hidden">
        {reportTypes.map((r) => (
          <Card key={r.id} className={`report-type-card ${activeReport === r.id ? "active" : ""}`}>
            <button onClick={() => setActiveReport(r.id)} className="report-type-btn" type="button">
              <r.icon className="w-8 h-8" />
              <span>{r.label}</span>
            </button>
          </Card>
        ))}
      </div>

      {activeReport === "payslip" && (
        <Card>
          <div className="report-head">
            <h3>Payslip Report</h3>
            <div className="export-actions print-hidden">
              <Button label="Excel" variant="outline" onClick={() => handleExport("excel", "payslip")} />
              <Button label="PDF"   variant="outline" onClick={() => handleExport("pdf",   "payslip")} />
              <Button label="Print" variant="outline" onClick={() => handleExport("print", "payslip")} />
            </div>
          </div>

          <div className="filters-row print-hidden">
            <div className="relative w-full sm:w-[30rem] md:w-[34rem]" ref={employeeSearchRef}>
              <Input
                label="Search Employee"
                value={empSearch}
                onFocus={() => setEmployeeDropdownOpen(true)}
                onChange={(e) => {
                  setEmpSearch(e.target.value);
                  setEmpCode('');
                  setEmployeeDropdownOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredEmployees[0]) selectEmployee(filteredEmployees[0]);
                  }
                }}
                placeholder="Type name or code"
                className="w-full"
                style={{ paddingRight: "2.5rem" }}
              />

              <button
                type="button"
                className="absolute right-3 top-[2.35rem] -translate-y-1/2 text-slate-500 hover:text-slate-700"
                onClick={() => setEmployeeDropdownOpen((prev) => !prev)}
                aria-label="Toggle employee dropdown"
              >
                <ChevronDown className="h-4 w-4" />
              </button>

              {employeeDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full min-w-[18rem] max-h-60 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
                  {filteredEmployees.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-500">No employee found</div>
                  ) : (
                    filteredEmployees.map((employee) => {
                      const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
                      return (
                        <button
                          key={employee.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          onClick={() => selectEmployee(employee)}
                        >
                          <span className="font-medium text-slate-800">{fullName || '-'}</span>
                          <span className="ml-2 text-slate-500">({employee.empCode || '-'})</span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="filter-select">
              {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="filter-select">
              {[String(now.getFullYear()), String(now.getFullYear() - 1), String(now.getFullYear() - 2)].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            {emp?.dutyRoster?.some((d) => d.splitShift) && (
              <select value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)}
                className="filter-select" style={{ borderColor: '#3b82f6', borderWidth: '2px' }}>
                <option value="All">All Shifts</option>
                <option value="Shift 1">Shift 1 Only</option>
                <option value="Shift 2">Shift 2 Only</option>
              </select>
            )}
            <div className="pill-group">
              <button type="button" className={`pill ${payslipView === "concentrated" ? "active" : ""}`} onClick={() => setPayslipView("concentrated")}>Concentrated</button>
              <button type="button" className={`pill ${payslipView === "detailed" ? "active" : ""}`} onClick={() => setPayslipView("detailed")}>Detailed</button>
            </div>
            <Button label="Print" variant="outline" onClick={() => handleExport("print", "payslip")} />
          </div>

          {payslipView === "concentrated" ? (
            <div className="payslip-preview print-area">
              <div className="payslip-header">
                <p><strong>{emp?.empCode}</strong>  {emp?.firstName} {emp?.lastName}  {emp?.designation}</p>
                <p>Pay Slip for the Month of: <strong>{month}/{year}</strong></p>
                <p>Appointment: {formatDate(emp?.appointmentDate)}</p>
              </div>
              <div className="payslip-body">
                <table className="payslip-table">
                  <thead><tr><th>Payments</th><th>Std Amount</th><th>This Month</th></tr></thead>
                  <tbody>
                    <tr><td>Basic</td><td>{basic.toLocaleString()}</td><td>{basic.toLocaleString()}</td></tr>
                    {allowances.map((a) => (
                      <tr key={a.type}><td>{a.type}</td><td>{a.amount?.toLocaleString()}</td><td>{a.amount?.toLocaleString()}</td></tr>
                    ))}
                    <tr><td><strong>Total Payments</strong></td><td></td><td><strong>{totalSal.toLocaleString()}</strong></td></tr>
                  </tbody>
                </table>
                <table className="payslip-table">
                  <thead><tr><th>Deductions</th><th></th><th></th></tr></thead>
                  <tbody>
                    <tr><td>Absents x2 ({totalAbsents} days)</td><td></td><td>{Math.round(absentDeduction).toLocaleString()}</td></tr>
                    {totalMissedOut > 0 && (
                      <tr><td>Missing Punch ({totalMissedOut} days)</td><td></td><td>{Math.round(missedOutDeduction).toLocaleString()}</td></tr>
                    )}
                    {totalLeaves > 0 && (
                      <tr><td>Leaves ({totalLeaves} days)</td><td></td><td>{Math.round(leaveDeduction).toLocaleString()}</td></tr>
                    )}
                    <tr><td>Late Arrivals ({totalLates} mins)</td><td></td><td>{Math.round(lateDeduction).toLocaleString()}</td></tr>
                    <tr><td>Advance</td><td></td><td>{advanceDeduction.toLocaleString()}</td></tr>
                    <tr><td>Loan (This Month)</td><td></td><td>{loanDeduction.toLocaleString()}</td></tr>
                    <tr><td>Loan Remaining</td><td></td><td>{loanRemainingBalance.toLocaleString()}</td></tr>
                    <tr><td>Gate Pass (Personal) ({gatepassMinutes} mins)</td><td></td><td>{gatepassDeduction.toLocaleString()}</td></tr>
                    <tr><td>Short Leave ({shortLeaveMinutes} mins)</td><td></td><td>{shortLeaveDeduction.toLocaleString()}</td></tr>
                    <tr><td>Total Deductions</td><td></td><td>{totalDeductions.toLocaleString()}</td></tr>
                  </tbody>
                </table>
                <div className="net-salary"><strong>NET SALARY: PKR {totalSal.toLocaleString()}</strong></div>
                <p className="amount-words">Amount in words: {totalSal.toLocaleString()} Only</p>
                {overtimeAddition > 0 && (
                  <p className="amount-words" style={{ color: 'green', marginTop: '5px' }}>
                    Includes Overtime Bonus: PKR {overtimeAddition.toLocaleString()} ({Math.round(totalOvertime / 60)} hrs)
                  </p>
                )}
                <div className="sign-row">
                  <div className="sign"><span>Prepared By</span></div>
                  <div className="sign"><span>Administrator</span></div>
                  <div className="sign"><span>Receiver</span></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="payslip-detailed print-area">
              <div className="sheet-header">
                <div>
                  <h4>Detailed Payroll / Payslip</h4>
                  <p className="muted">Employee: <strong>{emp?.empCode}</strong> — {emp?.firstName} {emp?.lastName}</p>
                  <p className="muted">Month: <strong>{month}/{year}</strong></p>
                </div>
                <div className="sheet-summary">
                  <div className="summary-box"><span className="muted">Current Month Salary</span><strong>PKR {Math.round(calculatedSalaryFromRows).toLocaleString()}</strong></div>
                  <div className="summary-box"><span className="muted">Current Month Deduction</span><strong>PKR {totalDeductions.toLocaleString()}</strong></div>
                  <div className="summary-box"><span className="muted">Loan Remaining</span><strong>PKR {loanRemainingBalance.toLocaleString()}</strong></div>
                  <div className="summary-box"><span className="muted">Net Salary</span><strong>PKR {totalSal.toLocaleString()}</strong></div>
                </div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Time In</th><th>Time Out</th><th>Duty Hrs</th>
                      <th>Wrk Hrs</th><th>Late</th><th>OT</th><th>Status</th>
                      <th>OT Amount</th><th>Salary</th><th>Ded</th><th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailedAttendanceRows.length === 0 ? (
                      <tr className="empty-row">
                        <td colSpan={12}>Selected month ke liye detailed attendance data available nahi hai.</td>
                      </tr>
                    ) : (
                      detailedAttendanceRows.map((r, idx) => (
                        <tr key={`${r.date}-${r.timeIn}-${r.timeOut}-${idx}`}>
                          <td>{r.date}</td><td>{r.timeIn}</td><td>{r.timeOut}</td>
                          <td>{r.dutyHrs}</td><td>{r.wrkHrs}</td><td>{r.late}</td>
                          <td>{r.ot}</td><td>{r.status}</td><td>{Math.max(0, Math.round(Number(r.otAmt) || 0))}</td><td>{(() => {
                            const salaryNum = Number(r.salary);
                            const totalNum = Number(r.total);
                            if (Number.isFinite(salaryNum) && salaryNum > 0) return String(Math.round(salaryNum));
                            if (Number.isFinite(totalNum) && totalNum > 0) return String(Math.round(totalNum));
                            return String(Math.max(0, Math.round(salaryNum || 0)));
                          })()}</td>
                          <td>{r.ded}</td><td>{r.total}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="sheet-totals">
                <div className="totals-grid">
                  <div className="totals-item"><span className="muted">Total Salary</span><strong>PKR {Math.round(calculatedSalaryFromRows).toLocaleString()}</strong></div>
                  <div className="totals-item"><span className="muted">Total Deduction</span><strong>PKR {totalDeductions.toLocaleString()}</strong></div>
                  <div className="totals-item"><span className="muted">Advance Deduction (This Month)</span><strong>PKR {advanceDeduction.toLocaleString()}</strong></div>
                  <div className="totals-item"><span className="muted">Loan Deduction (This Month)</span><strong>PKR {loanDeduction.toLocaleString()}</strong></div>
                  <div className="totals-item"><span className="muted">Loan Remaining</span><strong>PKR {loanRemainingBalance.toLocaleString()}</strong></div>
                  <div className="totals-item"><span className="muted">Total Overtime Bonus</span><strong>PKR {overtimeAddition.toLocaleString()}</strong></div>
                  <div className="totals-item"><span className="muted">Net Salary</span><strong>PKR {totalSal.toLocaleString()}</strong></div>
                </div>
              </div>
              <div className="sign-row">
                <div className="sign"><span>Accountant</span></div>
                <div className="sign"><span>Administrator</span></div>
                <div className="sign"><span>Employee</span></div>
              </div>
            </div>
          )}
        </Card>
      )}

      {activeReport === "payroll" && (
        <Card>
          <div className="report-head">
            <h3>Payroll Report</h3>
            <div className="export-actions print-hidden">
              <Button label="Excel" variant="outline" onClick={() => handleExport("excel", payrollTab === "detailed" ? "payroll-detailed" : payrollTab === "consolidated" ? "payroll-consolidated" : "salary-register")} />
              <Button label="PDF"   variant="outline" onClick={() => handleExport("pdf",   payrollTab === "detailed" ? "payroll-detailed" : payrollTab === "consolidated" ? "payroll-consolidated" : "salary-register")} />
              <Button label="Print" variant="outline" onClick={() => handleExport("print", payrollTab === "detailed" ? "payroll-detailed" : payrollTab === "consolidated" ? "payroll-consolidated" : "salary-register")} />
            </div>
          </div>
          <div className="filters-row print-hidden">
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="filter-select">
              {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="filter-select">
              <option value="2026">2026</option><option value="2025">2025</option><option value="2024">2024</option>
            </select>
            <select className="filter-select"><option>All Departments</option></select>
          </div>
          <div className="subtabs print-hidden">
            <button type="button" className={payrollTab === "detailed"     ? "active" : ""} onClick={() => setPayrollTab("detailed")}>Detailed Payroll</button>
            <button type="button" className={payrollTab === "consolidated" ? "active" : ""} onClick={() => setPayrollTab("consolidated")}>Consolidated Payroll</button>
            <button type="button" className={payrollTab === "register"     ? "active" : ""} onClick={() => setPayrollTab("register")}>Salary Register</button>
          </div>
          {payrollTab === "detailed" && (
            <div className="print-area">
              <div className="paper-sheet">
                <div className="paper-top">
                  <div className="paper-meta">
                    <p className="muted">Date: {new Date().toISOString().slice(0, 10)}</p>
                    <h4 className="paper-title">{emp?.firstName} {emp?.lastName} — <span className="muted">{emp?.empCode}</span></h4>
                    <p className="muted">{emp?.designation || 'Employee'} • {emp?.department || 'Department'}</p>
                    <p className="muted">Month: <strong>{month}/{year}</strong></p>
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="rep-table small-print">
                    <thead>
                      <tr>
                        <th>Emp Code</th><th>Duty Date</th><th>Time In</th><th>Time Out</th>
                        <th>Duty Sts</th><th>Late</th><th>Duty Hrs</th><th>Wrk Hrs</th>
                        <th>Wrk Days</th><th>O.T</th><th>Per Day</th><th>Salary</th>
                        <th>O.T</th><th>Ded</th><th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollDetailedRows.map((r, idx) => (
                        <tr key={`${r.empCode}-${r.dutyDt}-${r.timeIn}-${r.timeOut}-${idx}`}>
                          <td>{r.empCode}</td><td>{r.dutyDt}</td><td>{r.timeIn}</td><td>{r.timeOut}</td>
                          <td>{r.dutySts}</td><td>{r.late}</td><td>{r.dutyHrs}</td><td>{r.wrkHrs}</td>
                          <td>{r.wrkDays}</td><td>{r.ot}</td><td>{r.perDay}</td><td>{r.salary}</td>
                          <td>{r.otAmt}</td><td>{r.ded}</td><td>{r.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="paper-footer">
                  <div className="sign-row">
                    <div className="sign"><span>Accountant</span></div>
                    <div className="sign"><span>Administrator</span></div>
                    <div className="sign"><span>Employee</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {payrollTab === "consolidated" && (
            <div className="table-wrap print-area">
              <h4 className="section-title">Consolidated Payroll</h4>
              <table className="data-table">
                <thead><tr><th>Emp Code</th><th>Name</th><th>Net Salary</th></tr></thead>
                <tbody>{payrollConsolidatedRows.map((r) => (<tr key={r.code}><td>{r.code}</td><td>{r.name}</td><td>{r.netSalary}</td></tr>))}</tbody>
              </table>
            </div>
          )}
          {payrollTab === "register" && (
            <div className="table-wrap print-area">
              <h4 className="section-title">Salary Register</h4>
              <table className="data-table">
                <thead><tr><th>Emp Code</th><th>Name</th><th>Amount</th></tr></thead>
                <tbody>{salaryRegisterRows.map((r) => (<tr key={r.code}><td>{r.code}</td><td>{r.name}</td><td>{r.amount}</td></tr>))}</tbody>
              </table>
              <div className="sheet-footer muted">Total employees: {salaryRegisterRows.length}</div>
            </div>
          )}
        </Card>
      )}

      {activeReport === "test-attendance-raw" && (
        <Card>
          <div className="report-head">
            <h3>Test Attendance Raw (Machine Punches)</h3>
            <div className="export-actions print-hidden">
              <Button label="Excel" variant="outline" onClick={() => handleExport("excel", "test-attendance-raw")} />
            </div>
          </div>

          <div className="filters-row print-hidden">
            <Input
              label="Emp Code" value={empCode}
              onChange={(e) => setEmpCode(e.target.value)}
              placeholder="EMP-001 or 104" className="w-full sm:w-72"
            />
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="filter-select">
              {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="filter-select">
              {[String(now.getFullYear()), String(now.getFullYear() - 1), String(now.getFullYear() - 2)].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="table-wrap print-area">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Emp Code</th>
                  <th>Name</th>
                  <th>Punch Date</th>
                  {Array.from({ length: 12 }, (_, i) => (
                    <th key={`punch-head-${i + 1}`}>{`Punch${i + 1}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawPunchRows.map((row, idx) => (
                  <tr key={`${row.empCode}-${row.punchDate}-${idx}`}>
                    <td>{row.empCode}</td>
                    <td>{row.name}</td>
                    <td>{row.punchDate}</td>
                    {Array.from({ length: 12 }, (_, i) => (
                      <td key={`punch-cell-${row.empCode}-${row.punchDate}-${i + 1}`}>{row[`Punch${i + 1}`] || ""}</td>
                    ))}
                  </tr>
                ))}
                {!rawPunchRows.length && (
                  <tr>
                    <td colSpan={15} className="muted" style={{ textAlign: "center" }}>
                      No raw machine punches found for selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeReport === "missing" && (
        <Card>
          <div className="report-head">
            <h3>Missing Salary Report</h3>
            <div className="export-actions print-hidden">
              <Button label="Excel" variant="outline" onClick={() => handleExport("excel", "missing")} />
              <Button label="PDF"   variant="outline" onClick={() => handleExport("pdf",   "missing")} />
              <Button label="Print" variant="outline" onClick={() => handleExport("print", "missing")} />
            </div>
          </div>
          <div className="filters-row print-hidden">
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="filter-select">
              {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="filter-select">
              <option value="2026">2026</option><option value="2025">2025</option><option value="2024">2024</option>
            </select>
          </div>
          <div className="table-wrap print-area">
            <table className="data-table">
              <thead><tr><th>Code</th><th>Name</th><th>Active</th><th>OT</th><th>Month</th><th>Amount</th><th>Flag</th><th>Voucher</th></tr></thead>
              <tbody>
                {missingSalaryRows.map((r) => (
                  <tr key={r.code}><td>{r.code}</td><td>{r.name}</td><td>{r.active}</td><td>{r.ot}</td><td>{r.month}</td><td>{r.amount}</td><td>{r.flag}</td><td>{r.voucher || "-"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeReport === "cr" && (
        <Card>
          <div className="report-head">
            <h3>Employee CR Report</h3>
            <div className="export-actions print-hidden">
              <Button label="Excel" variant="outline" onClick={() => handleExport("excel", "cr")} />
              <Button label="PDF"   variant="outline" onClick={() => handleExport("pdf",   "cr")} />
              <Button label="Print" variant="outline" onClick={() => handleExport("print", "cr")} />
            </div>
          </div>
          <div className="filters-row print-hidden">
            <div className="relative w-full sm:w-[30rem] md:w-[34rem]" ref={employeeSearchRef}>
              <Input
                label="Search Employee"
                value={empSearch}
                onFocus={() => setEmployeeDropdownOpen(true)}
                onChange={(e) => {
                  setEmpSearch(e.target.value);
                  setEmpCode('');
                  setEmployeeDropdownOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredEmployees[0]) selectEmployee(filteredEmployees[0]);
                  }
                }}
                placeholder="Type name or code"
                className="w-full"
                style={{ paddingRight: "2.5rem" }}
              />

              <button
                type="button"
                className="absolute right-3 top-[2.35rem] -translate-y-1/2 text-slate-500 hover:text-slate-700"
                onClick={() => setEmployeeDropdownOpen((prev) => !prev)}
                aria-label="Toggle employee dropdown"
              >
                <ChevronDown className="h-4 w-4" />
              </button>

              {employeeDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full min-w-[18rem] max-h-60 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
                  {filteredEmployees.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-500">No employee found</div>
                  ) : (
                    filteredEmployees.map((employee) => {
                      const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
                      return (
                        <button
                          key={employee.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          onClick={() => selectEmployee(employee)}
                        >
                          <span className="font-medium text-slate-800">{fullName || '-'}</span>
                          <span className="ml-2 text-slate-500">({employee.empCode || '-'})</span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            <Button label="Print" variant="outline" onClick={() => handleExport("print", "cr")} />
          </div>
          <div className="cr-sheet print-area">
            <div className="cr-title">
              <h4>Employee Confidential Report (CR)</h4>
              <p className="muted">Printable form — UI only</p>
            </div>
            <div className="cr-section">
              <h5>1. Employee Basic Information</h5>
              <table className="form-table">
                <tbody>
                  <tr><td>Employee ID</td><td>{emp?.empCode}</td><td>Employee Name</td><td>{emp?.firstName} {emp?.lastName}</td></tr>
                  <tr><td>Father Name</td><td>{emp?.fatherName || "-"}</td><td>CNIC</td><td>{emp?.nic || "-"}</td></tr>
                  <tr><td>Department</td><td>{emp?.department || "-"}</td><td>Designation</td><td>{emp?.designation || "-"}</td></tr>
                  <tr><td>Date of Joining</td><td>{formatDate(emp?.joiningDate)}</td><td>Employment Status</td><td>{emp?.status || "-"}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="cr-section">
              <h5>2. Salary Increment History</h5>
              <table className="data-table">
                <thead><tr><th>Date</th><th>Previous Salary</th><th>New Salary</th><th>Approved By</th></tr></thead>
                <tbody>
                  <tr><td>2024-01-01</td><td>PKR 50,000</td><td>PKR 55,000</td><td>HR Manager</td></tr>
                  <tr><td>2025-01-01</td><td>PKR 55,000</td><td>PKR 60,000</td><td>Administrator</td></tr>
                </tbody>
              </table>
            </div>
            <div className="cr-section">
              <h5>3. Attendance & Salary Summary</h5>
              <table className="form-table">
                <tbody>
                  <tr><td>Working Days</td><td>26</td><td>Late</td><td>2</td></tr>
                  <tr><td>Short Leave</td><td>1</td><td>Gate Pass</td><td>1</td></tr>
                  <tr><td>Overtime (Hours)</td><td>4</td><td>Net Salary</td><td>PKR {totalSal.toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="cr-grid">
              <div className="cr-section">
                <h5>4. Performance (1–5 scale)</h5>
                <table className="data-table">
                  <thead><tr><th>Criteria</th><th>Rating</th><th>Remarks</th></tr></thead>
                  <tbody>
                    <tr><td>Punctuality</td><td>4</td><td>Very Good</td></tr>
                    <tr><td>Work Quality</td><td>4</td><td>Consistent</td></tr>
                    <tr><td>Team Work</td><td>5</td><td>Excellent</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="cr-section">
                <h5>5. Disciplinary Actions / Warnings</h5>
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Action Type</th><th>Reason</th></tr></thead>
                  <tbody><tr><td>-</td><td>-</td><td>-</td></tr></tbody>
                </table>
              </div>
            </div>
            <div className="cr-section">
              <h5>6. Final Approval</h5>
              <table className="data-table">
                <thead><tr><th>Name</th><th>Signature</th><th>Date</th></tr></thead>
                <tbody>
                  <tr><td>Reporting Manager</td><td></td><td></td></tr>
                  <tr><td>HR Manager</td><td></td><td></td></tr>
                  <tr><td>Admin Approval</td><td></td><td></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}