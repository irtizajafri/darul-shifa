import { useCallback, useEffect, useMemo, useState } from "react";
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
import { AlertCircle, BarChart3, FileText, User } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "../../assets/logo.jpg";
import { formatDate, getTotalSalary } from "../../utils/helpers";
import "./Reports.scss";

const reportTypes = [
  { id: "payslip", label: "Payslip", icon: FileText },
  { id: "payroll", label: "Payroll", icon: BarChart3 },
  { id: "missing", label: "Missing Salary", icon: AlertCircle },
  { id: "cr", label: "Employee CR", icon: User },
];

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
  const [apiAttendance, setApiAttendance] = useState([]);
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [payslipView, setPayslipView] = useState("concentrated"); // concentrated | detailed
  const [payrollTab, setPayrollTab] = useState("detailed"); // detailed | consolidated | register
  const { setModule } = useModuleStore();
  const { employees, fetchEmployees } = useEmployeeStore();
  const { attendanceRecords, fetchAttendance } = useAttendanceStore();
  const { gatepasses, fetchGatepasses } = useGatePassStore();
  const { records: advanceLoans, fetchAdvanceLoans } = useAdvanceLoanStore();

  useEffect(() => {
    setModule("employee");
    Promise.all([fetchEmployees(), fetchAttendance(), fetchGatepasses(), fetchAdvanceLoans()]).then(() => setLoading(false));
  }, [setModule, fetchEmployees, fetchAttendance, fetchGatepasses, fetchAdvanceLoans]);

  const normalizeEmpCode = useCallback((value) =>
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ''), []);

  // Find the exact employee from the real database matching empCode
  const emp = useMemo(() => {
    if (!employees || !empCode) return null;
    const target = normalizeEmpCode(empCode);
    return employees.find((e) => normalizeEmpCode(e.empCode) === target);
  }, [employees, empCode, normalizeEmpCode]);

  const applyEmpSearch = () => {
    setEmpCode(empSearch.trim());
  };

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

  useEffect(() => {
    const fetchApiAttendance = async () => {
      if (!emp?.empCode) {
        setApiAttendance([]);
        return;
      }
      try {
        const startDate = new Date(`${year}-${month}-01T00:00:00`);
        const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        const res = await fetch('http://localhost:5001/api/attendance/external', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Dates: toApiDate(startDate), DatesTo: toApiDate(endDate) })
        });
        const json = await res.json();
        if (json.status === 200 && Array.isArray(json.data)) {
          const target = normalizeEmpCode(emp.empCode);
          const raw = json.data.filter((row) => normalizeEmpCode(row.enrollid || row.enrollId) === target);
          const byDate = raw.reduce((acc, row) => {
            const dateKey = String(row.arrive_date || row.date || '').split(' ')[0];
            if (!dateKey) return acc;
            let timeVal = String(row.arrive_time || row.time_in || '').trim();
            if (timeVal.includes(' ')) {
              timeVal = timeVal.split(' ').pop();
            }
            if (!acc[dateKey]) acc[dateKey] = [];
            if (timeVal) acc[dateKey].push(timeVal);
            return acc;
          }, {});

          const daysInMonth = endDate.getDate();
          const mapped = Array.from({ length: daysInMonth }, (_, i) => {
            const dateStr = `${year}-${month}-${String(i + 1).padStart(2, '0')}`;
            const punches = byDate[dateStr] || [];
            const sorted = punches.slice().sort();
            const inTime = sorted[0] || null;
            const outTime = sorted.length > 1 ? sorted[sorted.length - 1] : null;
            const roster = getRosterForDate(dateStr);
            const scheduledIn = toRosterDateTime(dateStr, roster?.timeIn || '08:00');
            const scheduledOut = toRosterDateTime(dateStr, roster?.timeOut || '16:00');
            const actualIn = inTime ? new Date(`${dateStr}T${inTime}`) : null;
            const actualOut = outTime ? new Date(`${dateStr}T${outTime}`) : null;
            const isOff = isRosterOff(dateStr);
            const isFuture = new Date(`${dateStr}T23:59:59`) > new Date();

            return {
              date: new Date(dateStr),
              scheduledIn,
              scheduledOut,
              actualIn,
              actualOut,
              status: isFuture ? 'Future' : (isOff ? 'Off' : (punches.length ? 'Present' : 'Absent')),
            };
          });
          setApiAttendance(mapped);
        } else {
          setApiAttendance([]);
        }
      } catch {
        setApiAttendance([]);
      }
    };

    fetchApiAttendance();
  }, [emp?.empCode, month, year, toApiDate, normalizeEmpCode, getRosterForDate, toRosterDateTime, isRosterOff]);

  // Connect real math to real employee
  const basic = Number(emp?.basicSalary) || 0;
  const allowances = emp?.allowances || [];
  const totalAllow = allowances.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const baseTotalSal = basic + totalAllow; // Base Salary + Allowances completely raw

  // Filter Attendance for this specific month & year!
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

  const effectiveAttendance = empAttendance.length ? empAttendance : apiAttendance;

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
        const inAt = g.validTill || g.inAt ? new Date(g.validTill || g.inAt) : new Date();
        if (Number.isNaN(outAt.getTime()) || Number.isNaN(inAt.getTime())) return sum;
        const minutes = Math.max(0, Math.round((inAt - outAt) / 60000));
        return sum + minutes;
      }, 0);
  }, [emp, gatepasses, month, year]);

  const overrides = (() => {
    try {
      return JSON.parse(localStorage.getItem('attendanceOverrides')) || [];
    } catch {
      return [];
    }
  })();

  const effectiveAttendanceWithOverrides = useMemo(() => {
    if (!emp?.empCode) return effectiveAttendance;
    const targetCode = normalizeEmpCode(emp.empCode);
    return effectiveAttendance.map((record) => {
      const dateStr = new Date(record.date).toISOString().split('T')[0];
      const override = overrides.find((o) => normalizeEmpCode(o.empCode) === targetCode && o.date === dateStr);
      if (!override) return record;
      return {
        ...record,
        actualIn: override.timeIn ? new Date(`${dateStr}T${override.timeIn}`) : record.actualIn,
        actualOut: override.timeOut ? new Date(`${dateStr}T${override.timeOut}`) : record.actualOut,
        status: override.status || record.status
      };
    });
  }, [effectiveAttendance, emp, normalizeEmpCode, overrides]);

  // Dynamic calculations specifically for this employee's month
  const graceMinutes = 10;
  const minutesBetween = useCallback((start, end) => {
    if (!start || !end) return 0;
    const diff = (new Date(end) - new Date(start)) / 60000;
    return diff > 0 ? Math.round(diff) : 0;
  }, []);
  const getScheduledMinutes = useCallback((record) => {
    if (record.scheduledIn && record.scheduledOut) {
      return minutesBetween(record.scheduledIn, record.scheduledOut);
    }
    return 8 * 60;
  }, [minutesBetween]);
  const getLateMinutes = useCallback((record) => {
    const status = record.status?.toLowerCase();
    if (['holiday', 'festival', 'off', 'future'].includes(status)) return 0;
    const raw = typeof record.lateMinutes === 'number'
      ? record.lateMinutes
      : (record.actualIn && record.scheduledIn && new Date(record.actualIn) > new Date(record.scheduledIn)
        ? minutesBetween(record.scheduledIn, record.actualIn)
        : 0);
    return Math.max(raw - graceMinutes, 0);
  }, [graceMinutes, minutesBetween]);
  const getOvertimeMinutes = useCallback((record) => {
    const status = record.status?.toLowerCase();
    if (['holiday', 'festival', 'off', 'future'].includes(status)) return 0;
    if (typeof record.overtimeMinutes === 'number') return record.overtimeMinutes;
    if (record.actualOut && record.scheduledOut && new Date(record.actualOut) > new Date(record.scheduledOut)) {
      return minutesBetween(record.scheduledOut, record.actualOut);
    }
    return 0;
  }, [minutesBetween]);
  const getWorkedMinutes = useCallback((record) => {
    if (!record.actualIn || !record.actualOut) return 0;
    return minutesBetween(record.actualIn, record.actualOut);
  }, [minutesBetween]);

  const totalAbsents = effectiveAttendanceWithOverrides.filter((r) => {
    const status = r.status?.toLowerCase();
    if (status !== 'absent') return false;
    const dateStr = new Date(r.date).toISOString().split('T')[0];
    if (new Date(`${dateStr}T23:59:59`) > new Date()) return false;
    return !isRosterOff(dateStr);
  }).length;
  const totalLates = effectiveAttendanceWithOverrides.reduce((sum, r) => sum + getLateMinutes(r), 0);
  const totalOvertime = effectiveAttendanceWithOverrides.reduce((sum, r) => sum + getOvertimeMinutes(r), 0);

  const perDayRate = baseTotalSal > 0 ? (baseTotalSal / 30) : 0;

  // Financial Cuts & Additions based on Attendance
  const absentDeduction = totalAbsents * perDayRate;
  const lateDeduction = effectiveAttendanceWithOverrides.reduce((sum, r) => {
    const scheduledMinutes = getScheduledMinutes(r);
    const perMinuteRate = scheduledMinutes > 0 ? perDayRate / scheduledMinutes : 0;
    return sum + (getLateMinutes(r) * perMinuteRate);
  }, 0);
  const gatepassDeduction = Math.round((gatepassMinutes * (perDayRate / (8 * 60))));
  const currentMonthKey = `${year}-${month}`;
  const advanceDeduction = Math.round(advanceLoans
    .filter((a) => a.employeeId === emp?.id && String(a.status || '').toLowerCase() === 'active')
    .filter((a) => String(a.type || '').toLowerCase() === 'advance')
    .reduce((sum, a) => {
      const schedule = a.schedule || [];
      const entry = schedule.find((s) => s.month === currentMonthKey);
      return sum + (Number(entry?.amount) || 0);
    }, 0));
  const loanDeduction = Math.round(advanceLoans
    .filter((a) => a.employeeId === emp?.id && String(a.status || '').toLowerCase() === 'active')
    .filter((a) => String(a.type || '').toLowerCase() === 'loan')
    .reduce((sum, a) => {
      const schedule = a.schedule || [];
      const entry = schedule.find((s) => s.month === currentMonthKey);
      return sum + (Number(entry?.amount) || 0);
    }, 0));
  const shortLeaveRecords = (() => {
    try {
      return JSON.parse(localStorage.getItem('shortLeaveRecords')) || [];
    } catch {
      return [];
    }
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
      const inAt = new Date(`${s.date}T${s.timeIn}`);
      if (Number.isNaN(outAt.getTime()) || Number.isNaN(inAt.getTime())) return sum;
      const mins = Math.max(0, Math.round((inAt - outAt) / 60000));
      return sum + mins;
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
      const inAt = new Date(`${s.date}T${s.timeIn}`);
      if (Number.isNaN(outAt.getTime()) || Number.isNaN(inAt.getTime())) return sum;
      const mins = Math.max(0, Math.round((inAt - outAt) / 60000));
      const rosterMinutes = getRosterMinutesForDate(s.date);
      const perMinute = rosterMinutes > 0 ? perDayRate / rosterMinutes : 0;
      return sum + (mins * perMinute);
    }, 0));

  const totalDeductions = Math.round(absentDeduction + lateDeduction + gatepassDeduction + advanceDeduction + loanDeduction + shortLeaveDeduction);
  const overtimeAddition = Math.round(effectiveAttendanceWithOverrides.reduce((sum, r) => {
    const scheduledMinutes = getScheduledMinutes(r);
    const perMinuteRate = scheduledMinutes > 0 ? perDayRate / scheduledMinutes : 0;
    return sum + (getOvertimeMinutes(r) * perMinuteRate);
  }, 0));

  const offDayBonus = Math.round(effectiveAttendanceWithOverrides.reduce((sum, r) => {
    const dateStr = new Date(r.date).toISOString().split('T')[0];
    if (!isRosterOff(dateStr)) return sum;
    const workedMinutes = getWorkedMinutes(r);
    if (workedMinutes <= 0) return sum;
    const scheduledMinutes = getScheduledMinutes(r);
    const perMinuteRate = scheduledMinutes > 0 ? perDayRate / scheduledMinutes : 0;
    return sum + perDayRate + (workedMinutes * perMinuteRate);
  }, 0));

  // Final Generated Net Salary specifically tailored for this slip!
  const finalSal = emp ? Math.max(0, Math.round(baseTotalSal - totalDeductions + overtimeAddition + offDayBonus)) : 0;
  const totalSal = finalSal;


  const detailedAttendanceRows = useMemo(() => {
    // If we have actual DB records, map them instead of fake dummy data
    if (effectiveAttendanceWithOverrides.length > 0) {
      return effectiveAttendanceWithOverrides.map((record) => {
        const d = new Date(record.date);
        const dayStr = d.toISOString().split('T')[0];
  const offDay = isRosterOff(dayStr);
  const isFuture = new Date(`${dayStr}T23:59:59`) > new Date();
  const isHoliday = ['holiday', 'festival'].includes(record.status?.toLowerCase());
        
        let tIn = "--"; let tOut = "--";
        if (record.actualIn) {
          tIn = new Date(record.actualIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        }
        if (record.actualOut) {
          tOut = new Date(record.actualOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        }
        
  const scheduledMinutes = getScheduledMinutes(record);
  const lateMinutes = offDay || isFuture || isHoliday ? 0 : getLateMinutes(record);
  const overtimeMinutes = offDay || isFuture || isHoliday ? 0 : getOvertimeMinutes(record);
  const perMinuteRate = scheduledMinutes > 0 ? (perDayRate / scheduledMinutes) : 0;
  const workedMinutes = record.actualIn && record.actualOut
    ? Math.max(0, Math.round((new Date(record.actualOut) - new Date(record.actualIn)) / 60000))
    : 0;
  const offDayExtra = offDay && workedMinutes > 0 ? Math.round(workedMinutes * perMinuteRate) : 0;

  const isLate = lateMinutes > 0 ? "Y" : "N";
  const otHrs = overtimeMinutes ? (overtimeMinutes / 60).toFixed(2) : "0.00";
        
        // Per-day calculation visualization for layout
        const grossPerDay = Math.round(perDayRate);
        const ded = offDay || isFuture || isHoliday
          ? 0
          : Math.round((record.status?.toLowerCase() === 'absent' ? perDayRate : 0) + (lateMinutes * perMinuteRate));
  const otVal = Math.round(overtimeMinutes * perMinuteRate);

        return {
          date: dayStr,
          timeIn: tIn,
          timeOut: tOut,
          dutyHrs: offDay && workedMinutes > 0 ? (workedMinutes / 60).toFixed(2) : (offDay || isFuture || isHoliday ? "0.00" : (record.status?.toLowerCase() === 'absent' ? "0.00" : (scheduledMinutes / 60).toFixed(2))),
          ot: offDay || isFuture || isHoliday ? "0.00" : otHrs,
          late: offDay || isFuture || isHoliday ? "N" : isLate,
          status: isFuture ? "Future" : (offDay ? "Off" : (isHoliday ? record.status : (record.status || "Present"))),
          salary: String(grossPerDay),
          ded: String(ded),
          total: String(Math.max(0, grossPerDay - ded + otVal + offDayExtra)),
        };
      }).sort((a,b) => a.date.localeCompare(b.date)); // Sort chronologically
    }
    
    // Fallback if no records found yet
    const fallbackPerMinute = perDayRate > 0 ? (perDayRate / (8 * 60)) : 0;
    return Array.from({ length: 10 }, (_, i) => ({
      date: `${year}-${month}-${String(i + 1).padStart(2, "0")}`,
      timeIn: i % 6 === 0 ? "--" : "08:00",
      timeOut: i % 6 === 0 ? "--" : "16:00",
      dutyHrs: i % 6 === 0 ? "0.00" : "8.00",
      ot: i % 4 === 0 ? "1.00" : "0.00",
      late: i % 5 === 0 ? "Y" : "N",
      status: i % 6 === 0 ? "Absent" : i % 5 === 0 ? "Late" : "Duty",
      salary: i % 6 === 0 ? "0" : Math.round(perDayRate).toString(),
      ded: i % 5 === 0 ? Math.round(15 * fallbackPerMinute).toString() : "0",
      total: i % 6 === 0 ? "0" : Math.round(perDayRate).toString(),
    }));
  }, [effectiveAttendanceWithOverrides, month, year, perDayRate, getScheduledMinutes, getLateMinutes, getOvertimeMinutes, isRosterOff]);

  const missingSalaryRows = useMemo(() => {
    return employees.slice(0, 20).map((e, i) => ({
      code: e.empCode,
      name: `${e.firstName} ${e.lastName}`,
      active: e.status === "Active" ? "Y" : "N",
      ot: i % 3 === 0 ? "Y" : "N",
      month: `${year}-${month}`,
      amount: `PKR ${getTotalSalary(e.basicSalary, e.allowances || []).toLocaleString()}`,
      flag: i % 4 === 0 ? "Y" : "N",
      voucher: i % 2 === 0 ? `V-${String(1000 + i)}` : "",
    }));
  }, [employees, month, year]);

  const payrollDetailedRows = useMemo(() => {
    // UI-only: mimic paper-like detailed payroll grid
    return detailedAttendanceRows.map((r, idx) => ({
      empCode: emp?.empCode || "-",
      dutyDt: r.date,
      timeIn: r.timeIn,
      timeOut: r.timeOut,
      dutySts: r.status,
      late: r.late,
      dutyHrs: r.dutyHrs,
      wrkDays: idx === 0 ? '28' : '12',
      ot: r.ot,
      perDay: '893',
      salary: r.salary,
      otAmt: idx % 4 === 0 ? '15' : '0',
      ded: r.ded,
      total: r.total,
    }));
  }, [detailedAttendanceRows, emp]);

  const payrollConsolidatedRows = useMemo(() => {
    return employees.slice(0, 12).map((e) => ({
      code: e.empCode,
      name: `${e.firstName} ${e.lastName}`,
      netSalary: `PKR ${getTotalSalary(e.basicSalary, e.allowances || []).toLocaleString()}`,
    }));
  }, [employees]);

  const exportMeta = {
    address: "C 1-4 Survery # 675 Jaffar e Tayyar Society Malir, Karachi, Pakistan, 75210",
    phone: "021-34508390",
    whatsapp: "+92 334 2225746",
  };

  const loadImageDataUrl = async (src) => {
    if (!src) return null;
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const addPdfHeader = (pdf, title, logoData) => {
    const margin = 40;
    const pageWidth = pdf.internal.pageSize.getWidth();
    if (logoData) {
      pdf.addImage(logoData, "PNG", margin, 18, 60, 60);
    }
    pdf.setFontSize(14);
    pdf.text("Darul Shifa Imam Khomeini", margin + 80, 40);
    pdf.setFontSize(9);
    pdf.text(exportMeta.address, margin + 80, 58, { maxWidth: pageWidth - margin * 2 - 80 });
    pdf.text(`Tel: ${exportMeta.phone}`, margin + 80, 74);
    pdf.text(`WhatsApp: ${exportMeta.whatsapp}`, margin + 80, 90);
    pdf.setFontSize(11);
    pdf.text(title, margin, 120);
    return 140;
  };

  const addPdfFooter = (pdf) => {
    const margin = 40;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const footerY = pdf.internal.pageSize.getHeight() - 40;
    pdf.setFontSize(8);
    pdf.text(exportMeta.address, margin, footerY, { maxWidth: pageWidth - margin * 2 });
    pdf.text(`Tel: ${exportMeta.phone} | WhatsApp: ${exportMeta.whatsapp}`, margin, footerY + 12);
  };

  const addPdfSignatures = (pdf) => {
    const margin = 40;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const baseY = (pdf.lastAutoTable?.finalY || 140) + 30;
    const y = Math.min(baseY, pageHeight - 80);
    const colWidth = (pageWidth - margin * 2) / 3;
    const labels = ["Prepared By", "Administrator", "Employee"];
    pdf.setLineWidth(0.5);
    labels.forEach((label, index) => {
      const x = margin + index * colWidth;
      pdf.line(x, y, x + colWidth - 12, y);
      pdf.setFontSize(8);
      pdf.text(label, x + 4, y + 12);
    });
  };

  const exportReportPdf = async (scope, { autoPrint = false } = {}) => {
    const pdf = new jsPDF("p", "pt", "a4");
    const logoData = await loadImageDataUrl(logo);
    let startY = 140;

    const titleMap = {
      payslip: "Payslip Report",
      "payslip-detailed": "Detailed Payslip",
      "payroll-detailed": "Payroll Detailed",
      "payroll-consolidated": "Payroll Consolidated",
      "salary-register": "Salary Register",
      missing: "Missing Salary",
      cr: "Employee CR",
    };

    startY = addPdfHeader(pdf, titleMap[scope] || "Report", logoData);

    if (scope === "payslip" || scope === "payslip-detailed") {
      const summaryRows = [
        ["Emp Code", emp?.empCode || "-", "Month", `${year}-${month}`],
        ["Name", `${emp?.firstName || ""} ${emp?.lastName || ""}`.trim() || "-", "Designation", emp?.designation || "-"],
        ["Department", emp?.department || "-", "Status", emp?.status || "-"],
      ];
      autoTable(pdf, {
        startY,
        head: [["Field", "Value", "Field", "Value"]],
        body: summaryRows,
        styles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: "bold" }, 2: { fontStyle: "bold" } },
        headStyles: { fillColor: [37, 99, 235] },
      });

      const earningsRows = [
        ["Basic Salary", basic.toLocaleString()],
        ["Allowances", totalAllow.toLocaleString()],
        ["Off Day Bonus", offDayBonus.toLocaleString()],
        ["Overtime Addition", overtimeAddition.toLocaleString()],
      ];
      const deductionsRows = [
        ["Absent", Math.round(absentDeduction).toLocaleString()],
        ["Late", Math.round(lateDeduction).toLocaleString()],
        ["Gate Pass", gatepassDeduction.toLocaleString()],
        ["Advance", advanceDeduction.toLocaleString()],
        ["Loan", loanDeduction.toLocaleString()],
        ["Short Leave", shortLeaveDeduction.toLocaleString()],
        ["Total Deduction", totalDeductions.toLocaleString()],
      ];

      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 14,
        head: [["Earnings", "Amount"]],
        body: earningsRows,
        styles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: "bold" } },
        headStyles: { fillColor: [59, 130, 246] },
      });

      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 12,
        head: [["Deductions", "Amount"]],
        body: deductionsRows,
        styles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: "bold" } },
        headStyles: { fillColor: [30, 64, 175] },
      });

      pdf.setFontSize(11);
      pdf.text(`Net Salary: PKR ${totalSal.toLocaleString()}`, 40, pdf.lastAutoTable.finalY + 24);

      if (scope === "payslip-detailed") {
        autoTable(pdf, {
          startY: pdf.lastAutoTable.finalY + 36,
          head: [["Date", "In", "Out", "Status", "Late", "OT", "Ded", "Total"]],
          body: detailedAttendanceRows.map((r) => [r.date, r.timeIn, r.timeOut, r.status, r.late, r.ot, r.ded, r.total]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [37, 99, 235] },
        });
      }
    }

    if (scope === "payroll-detailed") {
      autoTable(pdf, {
        startY,
        head: [["Emp ID", "Duty Dt", "Time In", "Time Out", "Duty Sts", "Late", "Duty Hrs", "Wrk Days", "OT", "Per Day", "Salary", "OT Amt", "Ded", "Total"]],
        body: payrollDetailedRows.map((r) => [r.empCode, r.dutyDt, r.timeIn, r.timeOut, r.dutySts, r.late, r.dutyHrs, r.wrkDays, r.ot, r.perDay, r.salary, r.otAmt, r.ded, r.total]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [37, 99, 235] },
      });
    }

    if (scope === "payroll-consolidated") {
      autoTable(pdf, {
        startY,
        head: [["Code", "Name", "Net Salary"]],
        body: payrollConsolidatedRows.map((r) => [r.code, r.name, r.netSalary]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [37, 99, 235] },
      });
    }

    if (scope === "salary-register") {
      autoTable(pdf, {
        startY,
        head: [["Code", "Name", "Amount"]],
        body: salaryRegisterRows.map((r) => [r.code, r.name, r.amount]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [37, 99, 235] },
      });
    }

    if (scope === "missing") {
      autoTable(pdf, {
        startY,
        head: [["Code", "Name", "Active", "OT", "Month", "Amount", "Flag", "Voucher"]],
        body: missingSalaryRows.map((r) => [r.code, r.name, r.active, r.ot, r.month, r.amount, r.flag, r.voucher || "-"]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [37, 99, 235] },
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
        head: [["Date", "Previous Salary", "New Salary", "Approved By"]],
        body: [
          ["-", "0", "0", "-"],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [30, 64, 175] },
      });

      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 16,
        head: [["Working Days", "Late", "Short Leave", "Gate Pass", "Overtime", "Net Salary"]],
        body: [["26", "2", "1", "1", "4", `PKR ${totalSal.toLocaleString()}`]],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
      });

      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 16,
        head: [["Criteria", "Rating", "Remarks"]],
        body: [
          ["Punctuality", "4", "Very Good"],
          ["Work Quality", "4", "Consistent"],
          ["Team Work", "5", "Excellent"],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [37, 99, 235] },
      });

      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 16,
        head: [["Date", "Action Type", "Reason"]],
        body: [["-", "-", "-"]],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [30, 64, 175] },
      });
    }

  addPdfSignatures(pdf);
  addPdfFooter(pdf);

    if (autoPrint) {
      pdf.autoPrint();
      const url = pdf.output("bloburl");
      window.open(url, "_blank");
      return;
    }

    pdf.save(`${scope}-${year}-${month}.pdf`);
  };

  const salaryRegisterRows = useMemo(() => {
    return employees.slice(0, 15).map((e) => ({
      code: e.empCode,
      name: `${e.firstName} ${e.lastName}`,
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
      if (scope === "missing") rows = missingSalaryRows;
      if (scope === "payroll-detailed") rows = payrollDetailedRows;
      if (scope === "payroll-consolidated") rows = payrollConsolidatedRows;
      if (scope === "salary-register") rows = salaryRegisterRows;
      if (scope === "payslip") {
        rows = [
          { field: "Emp Code", value: emp?.empCode },
          { field: "Name", value: `${emp?.firstName} ${emp?.lastName}` },
          { field: "Designation", value: emp?.designation },
          { field: "Month", value: `${year}-${month}` },
          { field: "Basic Salary", value: basic },
          { field: "Allowances", value: totalAllow },
          { field: "Net Salary", value: totalSal },
        ];
      }
      if (scope === "cr") {
        rows = [
          { field: "Emp Code", value: emp?.empCode },
          { field: "Employee", value: `${emp?.firstName} ${emp?.lastName}` },
          { field: "Department", value: emp?.department },
          { field: "Designation", value: emp?.designation },
        ];
      }

      if (type === "excel") {
        downloadFile({
          filename: `${scope}-${year}-${month}.csv`,
          content: toCSV(rows),
          mimeType: "text/csv;charset=utf-8",
        });
        toast.success("Excel (CSV) downloaded");
        return;
      }

    } catch {
      toast.error("Export failed (dummy)");
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="reports-page">
      <PageHeader
        breadcrumbs={[
          { link: "/employee-module", label: "Dashboard" },
          { label: "Reports" },
        ]}
        title="Reports"
      />

      <div className="report-types print-hidden">
        {reportTypes.map((r) => (
          <Card
            key={r.id}
            className={`report-type-card ${activeReport === r.id ? "active" : ""}`}
          >
            <button
              onClick={() => setActiveReport(r.id)}
              className="report-type-btn"
              type="button"
            >
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
              <Button label="PDF" variant="outline" onClick={() => handleExport("pdf", "payslip")} />
              <Button label="Print" variant="outline" onClick={() => handleExport("print", "payslip")} />
            </div>
          </div>

          <div className="filters-row print-hidden">
            <Input
              label="Emp Code"
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyEmpSearch();
              }}
              placeholder="EMP-001 or 251"
              className="w-full sm:w-72"
            />
            <Button label="Search" variant="outline" onClick={applyEmpSearch} />
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="filter-select">
              {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="filter-select">
              {[String(now.getFullYear()), String(now.getFullYear() - 1), String(now.getFullYear() - 2)].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <div className="pill-group">
              <button
                type="button"
                className={`pill ${payslipView === "concentrated" ? "active" : ""}`}
                onClick={() => setPayslipView("concentrated")}
              >
                Concentrated
              </button>
              <button
                type="button"
                className={`pill ${payslipView === "detailed" ? "active" : ""}`}
                onClick={() => setPayslipView("detailed")}
              >
                Detailed
              </button>
            </div>
            <Button label="Print" variant="outline" onClick={() => handleExport("print", "payslip")} />
          </div>

          {payslipView === "concentrated" ? (
            <div className="payslip-preview print-area">
              <div className="payslip-header">
                <p>
                  <strong>{emp?.empCode}</strong> | {emp?.firstName} {emp?.lastName} |{" "}
                  {emp?.designation}
                </p>
                <p>
                  Pay Slip for the Month of: <strong>{month}/{year}</strong>
                </p>
                <p>Appointment: {formatDate(emp?.appointmentDate)}</p>
              </div>

              <div className="payslip-body">
                <table className="payslip-table">
                  <thead>
                    <tr>
                      <th>Payments</th>
                      <th>Std Amount</th>
                      <th>This Month</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Basic</td>
                      <td>{basic.toLocaleString()}</td>
                      <td>{basic.toLocaleString()}</td>
                    </tr>
                    {allowances.map((a) => (
                      <tr key={a.type}>
                        <td>{a.type}</td>
                        <td>{a.amount?.toLocaleString()}</td>
                        <td>{a.amount?.toLocaleString()}</td>
                      </tr>
                    ))}
                    {offDayBonus > 0 && (
                      <tr>
                        <td>Off Day Bonus</td>
                        <td>{offDayBonus.toLocaleString()}</td>
                        <td>{offDayBonus.toLocaleString()}</td>
                      </tr>
                    )}
                    <tr>
                      <td>
                        <strong>Total Payments</strong>
                      </td>
                      <td></td>
                      <td>
                        <strong>{totalSal.toLocaleString()}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table className="payslip-table">
                  <thead>
                    <tr>
                      <th>Deductions</th>
                      <th></th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Absents ({totalAbsents} days)</td>
                      <td></td>
                      <td>{Math.round(absentDeduction).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td>Late Arrivals ({totalLates} mins)</td>
                      <td></td>
                      <td>{Math.round(lateDeduction).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td>Advance</td>
                      <td></td>
                      <td>{advanceDeduction.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td>Loan</td>
                      <td></td>
                      <td>{loanDeduction.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td>Gate Pass (Personal) ({gatepassMinutes} mins)</td>
                      <td></td>
                      <td>{gatepassDeduction.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td>Short Leave ({shortLeaveMinutes} mins)</td>
                      <td></td>
                      <td>{shortLeaveDeduction.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td>Total Deductions</td>
                      <td></td>
                      <td>{totalDeductions.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="net-salary">
                  <strong>NET SALARY: PKR {totalSal.toLocaleString()}</strong>
                </div>
                <p className="amount-words">Amount in words: {totalSal.toLocaleString()} Only</p>
                
                {overtimeAddition > 0 && (
                  <p className="amount-words" style={{color: 'green', marginTop: '5px'}}>
                    Includes Overtime Bonus: PKR {overtimeAddition.toLocaleString()} ({Math.round(totalOvertime/60)} hrs)
                  </p>
                )}

                <div className="sign-row">
                  <div className="sign">
                    <span>Prepared By</span>
                  </div>
                  <div className="sign">
                    <span>Administrator</span>
                  </div>
                  <div className="sign">
                    <span>Receiver</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="payslip-detailed print-area">
              <div className="sheet-header">
                <div>
                  <h4>Detailed Payroll / Payslip</h4>
                  <p className="muted">
                    Employee: <strong>{emp?.empCode}</strong> — {emp?.firstName} {emp?.lastName}
                  </p>
                  <p className="muted">
                    Month: <strong>{month}/{year}</strong>
                  </p>
                </div>
                <div className="sheet-summary">
                  <div className="summary-box">
                    <span className="muted">Current Month Salary</span>
                    <strong>PKR {Math.round(baseTotalSal).toLocaleString()}</strong>
                  </div>
                  <div className="summary-box">
                    <span className="muted">Current Month Deduction</span>
                    <strong>PKR {totalDeductions.toLocaleString()}</strong>
                  </div>
                  <div className="summary-box">
                    <span className="muted">Net Salary</span>
                    <strong>PKR {totalSal.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time In</th>
                      <th>Time Out</th>
                      <th>Duty Hrs</th>
                      <th>Late</th>
                      <th>OT</th>
                      <th>Status</th>
                      <th>Salary</th>
                      <th>Ded</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailedAttendanceRows.map((r) => (
                      <tr key={r.date}>
                        <td>{r.date}</td>
                        <td>{r.timeIn}</td>
                        <td>{r.timeOut}</td>
                        <td>{r.dutyHrs}</td>
                        <td>{r.late}</td>
                        <td>{r.ot}</td>
                        <td>{r.status}</td>
                        <td>{r.salary}</td>
                        <td>{r.ded}</td>
                        <td>{r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="sheet-totals">
                <div className="totals-grid">
                  <div className="totals-item">
                    <span className="muted">Total Salary</span>
                    <strong>PKR {Math.round(baseTotalSal).toLocaleString()}</strong>
                  </div>
                  <div className="totals-item">
                    <span className="muted">Total Deduction</span>
                    <strong>PKR {totalDeductions.toLocaleString()}</strong>
                  </div>
                  <div className="totals-item">
                    <span className="muted">Total Overtime Bonus</span>
                    <strong>PKR {overtimeAddition.toLocaleString()}</strong>
                  </div>
                  <div className="totals-item">
                    <span className="muted">Net Salary</span>
                    <strong>PKR {totalSal.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              <div className="sign-row">
                <div className="sign">
                  <span>Accountant</span>
                </div>
                <div className="sign">
                  <span>Administrator</span>
                </div>
                <div className="sign">
                  <span>Employee</span>
                </div>
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
              <Button
                label="Excel"
                variant="outline"
                onClick={() =>
                  handleExport(
                    "excel",
                    payrollTab === "detailed"
                      ? "payroll-detailed"
                      : payrollTab === "consolidated"
                      ? "payroll-consolidated"
                      : "salary-register"
                  )
                }
              />
              <Button
                label="PDF"
                variant="outline"
                onClick={() =>
                  handleExport(
                    "pdf",
                    payrollTab === "detailed"
                      ? "payroll-detailed"
                      : payrollTab === "consolidated"
                      ? "payroll-consolidated"
                      : "salary-register"
                  )
                }
              />
              <Button
                label="Print"
                variant="outline"
                onClick={() =>
                  handleExport(
                    "print",
                    payrollTab === "detailed"
                      ? "payroll-detailed"
                      : payrollTab === "consolidated"
                      ? "payroll-consolidated"
                      : "salary-register"
                  )
                }
              />
            </div>
          </div>

          <div className="filters-row print-hidden">
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="filter-select">
              {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="filter-select">
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
            <select className="filter-select">
              <option>All Departments</option>
            </select>
          </div>

          <div className="subtabs print-hidden">
            <button
              type="button"
              className={payrollTab === "detailed" ? "active" : ""}
              onClick={() => setPayrollTab("detailed")}
            >
              Detailed Payroll
            </button>
            <button
              type="button"
              className={payrollTab === "consolidated" ? "active" : ""}
              onClick={() => setPayrollTab("consolidated")}
            >
              Consolidated Payroll
            </button>
            <button
              type="button"
              className={payrollTab === "register" ? "active" : ""}
              onClick={() => setPayrollTab("register")}
            >
              Salary Register
            </button>
          </div>

          {payrollTab === "detailed" && (
            <div className="print-area">
              <div className="paper-sheet">
                <div className="paper-top">
                  <div className="paper-meta">
                    <p className="muted">Date: {new Date().toISOString().slice(0, 10)}</p>
                    <h4 className="paper-title">
                      {emp?.firstName} {emp?.lastName} — <span className="muted">{emp?.empCode}</span>
                    </h4>
                    <p className="muted">{emp?.designation || 'Employee'} • {emp?.department || 'Department'}</p>
                    <p className="muted">
                      Month: <strong>{month}/{year}</strong>
                    </p>
                  </div>
                  <div className="paper-boxes">
                    <div className="paper-box">
                      <span className="muted">Current Month Salary</span>
                      <strong>PKR {totalSal.toLocaleString()}</strong>
                    </div>
                    <div className="paper-box">
                      <span className="muted">Curr. Month Deduction</span>
                      <strong>PKR 0</strong>
                    </div>
                    <div className="paper-box">
                      <span className="muted">Net Salary</span>
                      <strong>PKR {totalSal.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Emp ID</th>
                        <th>Duty Dt</th>
                        <th>Time In</th>
                        <th>Time Out</th>
                        <th>Duty Sts</th>
                        <th>Late</th>
                        <th>Duty Hrs</th>
                        <th>Wrk Days</th>
                        <th>O.T</th>
                        <th>Per Day</th>
                        <th>Salary</th>
                        <th>O.T</th>
                        <th>Ded</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollDetailedRows.map((r) => (
                        <tr key={r.dutyDt}>
                          <td>{r.empCode}</td>
                          <td>{r.dutyDt}</td>
                          <td>{r.timeIn}</td>
                          <td>{r.timeOut}</td>
                          <td>{r.dutySts}</td>
                          <td>{r.late}</td>
                          <td>{r.dutyHrs}</td>
                          <td>{r.wrkDays}</td>
                          <td>{r.ot}</td>
                          <td>{r.perDay}</td>
                          <td>{r.salary}</td>
                          <td>{r.otAmt}</td>
                          <td>{r.ded}</td>
                          <td>{r.total}</td>
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
              <h4 className="section-title">Consolidated Payroll (3 columns)</h4>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Emp Code</th>
                    <th>Name</th>
                    <th>Net Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollConsolidatedRows.map((r) => (
                    <tr key={r.code}>
                      <td>{r.code}</td>
                      <td>{r.name}</td>
                      <td>{r.netSalary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {payrollTab === "register" && (
            <div className="table-wrap print-area">
              <h4 className="section-title">Salary Register (3 columns)</h4>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Emp Code</th>
                    <th>Name</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryRegisterRows.map((r) => (
                    <tr key={r.code}>
                      <td>{r.code}</td>
                      <td>{r.name}</td>
                      <td>{r.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="sheet-footer muted">Total employees: {salaryRegisterRows.length}</div>
            </div>
          )}
        </Card>
      )}

      {activeReport === "missing" && (
        <Card>
          <div className="report-head">
            <h3>Missing Salary Report</h3>
            <div className="export-actions print-hidden">
              <Button label="Excel" variant="outline" onClick={() => handleExport("excel", "missing")} />
              <Button label="PDF" variant="outline" onClick={() => handleExport("pdf", "missing")} />
              <Button label="Print" variant="outline" onClick={() => handleExport("print", "missing")} />
            </div>
          </div>

          <div className="filters-row print-hidden">
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="filter-select">
              {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="filter-select">
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>

          <div className="table-wrap print-area">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Active</th>
                  <th>OT</th>
                  <th>Month</th>
                  <th>Amount</th>
                  <th>Flag</th>
                  <th>Voucher</th>
                </tr>
              </thead>
              <tbody>
                {missingSalaryRows.map((r) => (
                  <tr key={r.code}>
                    <td>{r.code}</td>
                    <td>{r.name}</td>
                    <td>{r.active}</td>
                    <td>{r.ot}</td>
                    <td>{r.month}</td>
                    <td>{r.amount}</td>
                    <td>{r.flag}</td>
                    <td>{r.voucher || "-"}</td>
                  </tr>
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
              <Button label="PDF" variant="outline" onClick={() => handleExport("pdf", "cr")} />
              <Button label="Print" variant="outline" onClick={() => handleExport("print", "cr")} />
            </div>
          </div>

          <div className="filters-row print-hidden">
            <Input
              label="Search by Emp Code"
              value={empCode}
              onChange={(e) => setEmpCode(e.target.value)}
              placeholder="EMP-001"
              className="w-full sm:w-72"
            />
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
                  <tr>
                    <td>Employee ID</td>
                    <td>{emp?.empCode}</td>
                    <td>Employee Name</td>
                    <td>{emp?.firstName} {emp?.lastName}</td>
                  </tr>
                  <tr>
                    <td>Father Name</td>
                    <td>{emp?.fatherName || "-"}</td>
                    <td>CNIC</td>
                    <td>{emp?.nic || "-"}</td>
                  </tr>
                  <tr>
                    <td>Department</td>
                    <td>{emp?.department || "-"}</td>
                    <td>Designation</td>
                    <td>{emp?.designation || "-"}</td>
                  </tr>
                  <tr>
                    <td>Date of Joining</td>
                    <td>{formatDate(emp?.joiningDate)}</td>
                    <td>Employment Status</td>
                    <td>{emp?.status || "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="cr-section">
              <h5>2. Salary Increment History</h5>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Previous Salary</th>
                    <th>New Salary</th>
                    <th>Approved By</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>2024-01-01</td>
                    <td>PKR 50,000</td>
                    <td>PKR 55,000</td>
                    <td>HR Manager</td>
                  </tr>
                  <tr>
                    <td>2025-01-01</td>
                    <td>PKR 55,000</td>
                    <td>PKR 60,000</td>
                    <td>Administrator</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="cr-section">
              <h5>3. Attendance & Salary Summary</h5>
              <table className="form-table">
                <tbody>
                  <tr>
                    <td>Working Days</td>
                    <td>26</td>
                    <td>Late</td>
                    <td>2</td>
                  </tr>
                  <tr>
                    <td>Short Leave</td>
                    <td>1</td>
                    <td>Gate Pass</td>
                    <td>1</td>
                  </tr>
                  <tr>
                    <td>Overtime (Hours)</td>
                    <td>4</td>
                    <td>Net Salary</td>
                    <td>PKR {totalSal.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="cr-grid">
              <div className="cr-section">
                <h5>4. Performance (1–5 scale)</h5>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Criteria</th>
                      <th>Rating</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Punctuality</td>
                      <td>4</td>
                      <td>Very Good</td>
                    </tr>
                    <tr>
                      <td>Work Quality</td>
                      <td>4</td>
                      <td>Consistent</td>
                    </tr>
                    <tr>
                      <td>Team Work</td>
                      <td>5</td>
                      <td>Excellent</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="cr-section">
                <h5>5. Disciplinary Actions / Warnings</h5>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Action Type</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>-</td>
                      <td>-</td>
                      <td>-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="cr-section">
              <h5>6. Final Approval</h5>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Signature</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Reporting Manager</td>
                    <td></td>
                    <td></td>
                  </tr>
                  <tr>
                    <td>HR Manager</td>
                    <td></td>
                    <td></td>
                  </tr>
                  <tr>
                    <td>Admin Approval</td>
                    <td></td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
