import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useModuleStore } from '../../store/useModuleStore';
import { useAttendanceStore } from '../../store/useAttendanceStore';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import PageLoader from '../../components/ui/PageLoader';
import PageHeader from '../../components/shared/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../../assets/logo.jpg';
import { format } from 'date-fns';
import './AttendanceList.scss';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'holiday_not_avail', label: 'Holiday Not Avail' },
  { value: 'holiday_avail', label: 'Holiday Avail' },
  { value: 'off_avail', label: 'Off Avail' },
  { value: 'off_not_avail', label: 'Off Not Avail' },
  { value: 'leave', label: 'Leave' },
  { value: 'leave_with_pay', label: 'Leave With Pay' },
];

const toStatusLabel = (status) => {
  const key = String(status || '').toLowerCase();
  const opt = STATUS_OPTIONS.find((o) => o.value === key);
  if (opt) return opt.label;
  if (!key) return 'Present';
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const toStatusVariant = (status) => {
  const key = String(status || '').toLowerCase();
  if (key === 'present' || key === 'leave_with_pay' || key === 'holiday_avail' || key === 'off_avail') return 'success';
  if (key === 'absent' || key === 'leave') return 'danger';
  if (key === 'holiday_not_avail' || key === 'off_not_avail') return 'info';
  return 'warning';
};

const toDateOnly = (value) => {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const ymdPrefix = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (ymdPrefix) return ymdPrefix[1];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const timeToMinutes = (value) => {
  if (!value) return null;
  const t = String(value).slice(0, 5);
  const [hh, mm] = t.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
};

const normalize24HourTime = (value) => {
  if (!value || value === '-') return '';
  let raw = String(value).trim().replace(/\(\+\d+d\)/gi, '').trim();

  if (!raw) return '';

  const hhmmOrHhmm = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hhmmOrHhmm) {
    const hh = Number(hhmmOrHhmm[1]);
    const mm = Number(hhmmOrHhmm[2]);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
  }

  const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (ampm) {
    let hh = Number(ampm[1]);
    const mm = Number(ampm[2]);
    const meridiem = ampm[3].toUpperCase();
    if (hh < 1 || hh > 12 || mm < 0 || mm > 59) return '';
    if (meridiem === 'PM' && hh < 12) hh += 12;
    if (meridiem === 'AM' && hh === 12) hh = 0;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  const datePartCandidate = raw.includes('T')
    ? raw.split('T')[1]
    : (raw.includes(' ') && raw.split(' ').pop().includes(':') ? raw.split(' ').pop() : '');
  if (datePartCandidate) {
    return normalize24HourTime(datePartCandidate);
  }

  return '';
};

const inferDateOut = ({ dateIn, dateOut, timeIn, timeOut }) => {
  const inDate = toDateOnly(dateIn);
  const outDate = toDateOnly(dateOut);
  if (outDate) return outDate;
  if (!inDate) return '';

  const inM = timeToMinutes(timeIn);
  const outM = timeToMinutes(timeOut);
  if (inM == null || outM == null) return inDate;

  // Overnight case: e.g. 21:00 -> 09:00 means checkout on next day
  if (outM <= inM) {
    const d = new Date(`${inDate}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  return inDate;
};

export default function AttendanceList() {
  const today = new Date();
  const defaultApiDate = today.toISOString().slice(0, 10);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [editModal, setEditModal] = useState(null);
  const [editRows, setEditRows] = useState([]); // Multiple rows for split shifts
  const [addModal, setAddModal] = useState(false);
  const [overrides, setOverrides] = useState([]);
  const [apiDateUi, setApiDateUi] = useState(defaultApiDate);
  const [selectedDate, setSelectedDate] = useState(defaultApiDate);
  const [apiStaffId, setApiStaffId] = useState('');
  const [apiRows, setApiRows] = useState([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [searchName, setSearchName] = useState('');
  const { setModule } = useModuleStore();
  const { attendanceRecords, fetchAttendance } = useAttendanceStore();
  const { employees, fetchEmployees } = useEmployeeStore();

  const [monthlyEmpCode, setMonthlyEmpCode] = useState('');
  const [monthlyMonth, setMonthlyMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [monthlyYear, setMonthlyYear] = useState(String(new Date().getFullYear()));
  const [monthlyApiData, setMonthlyApiData] = useState([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  const fetchMonthlyApiData = async () => {
    if (!monthlyEmpCode) return alert("Please enter Employee Code");
    setMonthlyLoading(true);
    try {
      const mm = monthlyMonth.padStart(2, '0');
      const startDate = `${monthlyYear}/${mm}/01`;
      const yyyyNum = parseInt(monthlyYear);
      const mmNum = parseInt(mm);
      const nextEndDate = new Date(yyyyNum, mmNum, 1);
      const endDateStr = `${nextEndDate.getFullYear()}/${String(nextEndDate.getMonth() + 1).padStart(2,'0')}/01`;

      const res = await fetch('http://localhost:5001/api/attendance/external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Dates: startDate, DatesTo: endDateStr })
      });
      const json = await res.json();
      
      if (json.status === 200 && Array.isArray(json.data)) {
          const target = monthlyEmpCode.toLowerCase().replace(/[^a-z0-9]/g, '');
          const filtered = json.data.filter(row => {
            const id = String(row.enrollid || row.enrollId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return id === target;
          });

          const allPunches = [];
          filtered.forEach((row) => {
            const d = String(row.arrive_date || row.date || '').split(' ')[0];
            let t = String(row.arrive_time || row.time_in || '').trim();
            if (t.includes(' ')) t = t.split(' ').pop();
            t = normalize24HourTime(t);
            if (d && t) {
              const dt = new Date(`${d}T${t}`);
              if (!Number.isNaN(dt.getTime())) {
                allPunches.push(dt);
              }
            }
          });

          allPunches.sort((a, b) => a.getTime() - b.getTime());

          const pairs = [];
          let currentIn = null;
          for (let p of allPunches) {
            if (!currentIn) {
              currentIn = p;
            } else {
              const diffHours = (p.getTime() - currentIn.getTime()) / 3600000;
              if (diffHours < 0.2) {
                // Ignore double tap
              } else if (diffHours <= 16) {
                pairs.push({ inTemp: currentIn, outTemp: p });
                currentIn = null;
              } else {
                pairs.push({ inTemp: currentIn, outTemp: null });
                currentIn = p;
              }
            }
          }
          if (currentIn) {
            pairs.push({ inTemp: currentIn, outTemp: null });
          }

          const tableData = pairs.map((p, i) => {
            return {
              date: p.inTemp ? p.inTemp.toISOString().split('T')[0] : '-',
              timeIn: p.inTemp ? format(p.inTemp, 'dd-MM-yyyy HH:mm') : '-',
              timeOut: p.outTemp ? format(p.outTemp, 'dd-MM-yyyy HH:mm') : 'Missed OUT',
              allPunches: `Shift #${i + 1}`,
            };
          });

          setMonthlyApiData(tableData);
          if(tableData.length === 0) alert("No records found for this month");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to fetch API");
    }
    setMonthlyLoading(false);
  };

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm();

  const register24Hour = (fieldName) => register(fieldName, {
    setValueAs: (v) => normalize24HourTime(v),
    validate: (v) => !v || /^([01]\d|2[0-3]):([0-5]\d)$/.test(v) || 'Use 24-hour HH:mm'
  });

  const OVERRIDE_KEY = 'attendanceOverrides';
  const loadOverrides = () => {
    try {
      return JSON.parse(localStorage.getItem(OVERRIDE_KEY)) || [];
    } catch {
      return [];
    }
  };
  const saveOverrides = (next) => {
    setOverrides(next);
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(next));
  };

  const toInputTimeValue = (value) => {
    return normalize24HourTime(value);
  };

  const addModalWaiveDeduction = watch('waiveDeduction');

  useEffect(() => {
    setModule('employee');
    fetchEmployees();
    fetchAttendance().then(() => setLoading(false));
    setOverrides(loadOverrides());
  }, [setModule]);

  useEffect(() => {
    if (!editModal) {
      setEditRows([]);
      return;
    }
    
  const modalDate = toDateOnly(editModal.dateIn || editModal.date || editModal.dateOut);
  const modalEmpCode = String(editModal.empCode || '').trim();
    
    // Find ALL overrides for this employee on this date
    const savedOverrides = overrides.filter((o) => 
      String(o.empCode || '').trim() === modalEmpCode && 
      toDateOnly(o.dateIn || o.date) === modalDate
    );
    
    if (savedOverrides.length > 0) {
      // Load all saved overrides into editRows
      setEditRows(savedOverrides.map(override => ({
        id: override.id || `existing-${Date.now()}-${Math.random()}`,
        dateIn: override.dateIn || override.date || modalDate,
        dateOut: override.dateOut || override.date || modalDate,
        timeIn: toInputTimeValue(override.timeIn),
        timeOut: toInputTimeValue(override.timeOut),
        status: override.status || 'present',
        manualWrkHrs: override.manualWrkHrs || '',
        manualOvertime: override.manualOvertime || '',
        manualDeduction: override.manualDeduction || '',
        manualTotal: override.manualTotal || '',
        waiveDeduction: Boolean(override.waiveDeduction),
        isManual: true, // All saved overrides can be edited/deleted
      })));
    } else {
      // No overrides found, initialize with original row from editModal
      setEditRows([{
        id: `initial-${Date.now()}`,
        dateIn: editModal.dateIn || editModal.date || '',
        dateOut: editModal.dateOut || editModal.date || '',
        timeIn: toInputTimeValue(editModal.timeIn),
        timeOut: toInputTimeValue(editModal.timeOut),
        status: editModal.status || 'present',
        manualWrkHrs: editModal.manualWrkHrs || '',
        manualOvertime: editModal.manualOvertime || '',
        manualDeduction: editModal.manualDeduction || '',
        manualTotal: editModal.manualTotal || '',
        waiveDeduction: Boolean(editModal.waiveDeduction),
        isManual: false, // Original row
      }]);
    }
    
    reset({
      employee: employees.find((e) => String(e.empCode) === String(editModal.empCode))?.id || '',
      dateIn: editModal.dateIn || editModal.date || '',
      dateOut: editModal.dateOut || editModal.date || '',
      timeIn: toInputTimeValue(editModal.timeIn),
      timeOut: toInputTimeValue(editModal.timeOut),
      status: editModal.status || 'present',
      manualWrkHrs: editModal.manualWrkHrs || '',
      manualOvertime: editModal.manualOvertime || '',
      manualDeduction: editModal.manualDeduction || '',
      manualTotal: editModal.manualTotal || '',
      waiveDeduction: Boolean(editModal.waiveDeduction),
    });
  }, [editModal, employees, reset, overrides]);

  const exportMeta = {
    address: 'C 1-4 Survery # 675 Jaffar e Tayyar Society Malir, Karachi, Pakistan, 75210',
    phone: '021-34508390',
    whatsapp: '+92 334 2225746'
  };

  const toCSV = (rows = []) => {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
      return s;
    };
    const lines = [
      headers.map(escape).join(','),
      ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))
    ];
    return lines.join('\n');
  };

  const downloadFile = ({ filename, content, mimeType }) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const buildExportRows = () => (
    filteredApiRows.map((row) => {
      const enrollId = String(row.enrollid || row.enrollId || '').trim();
      const match = employees.find((e) => String(e.empCode) === enrollId);
      return {
        code: enrollId || '-',
        name: match ? `${match.firstName} ${match.lastName}` : '-',
        date: row.arrive_date || row.date || '-',
        timeIn: row.arrive_time || row.time_in || '-',
        timeOut: row.depart_time || row.time_out || '-',
        status: 'Present'
      };
    })
  );

  const handleExportExcel = () => {
    const rows = buildExportRows();
    if (!rows.length) {
      toast.error('No attendance records to export');
      return;
    }
    const dateTag = apiDateUi || 'attendance';
    downloadFile({
      filename: `attendance-${dateTag}.csv`,
      content: toCSV(rows),
      mimeType: 'text/csv;charset=utf-8'
    });
    toast.success('Excel (CSV) exported');
  };

  const handleExportPdf = async () => {
    const rows = buildExportRows();
    if (!rows.length) {
      toast.error('No attendance records to export');
      return;
    }

    const pdf = new jsPDF('p', 'pt', 'a4');
    const img = new Image();
    img.src = logo;

    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 40;

    if (img.complete && img.naturalWidth) {
      pdf.addImage(img, 'JPEG', margin, 20, 60, 60);
    }

    pdf.setFontSize(14);
    pdf.text('Darul Shifa Imam Khomeini', margin + 80, 40);
    pdf.setFontSize(9);
    pdf.text(exportMeta.address, margin + 80, 58, { maxWidth: pageWidth - margin * 2 - 80 });
    pdf.text(`Tel: ${exportMeta.phone}`, margin + 80, 74);
    pdf.text(`WhatsApp: ${exportMeta.whatsapp}`, margin + 80, 90);
    pdf.setFontSize(10);
    pdf.text(`Attendance Report: ${apiDateUi || ''}`, margin, 120);

    autoTable(pdf, {
      startY: 140,
      head: [['Code', 'Name', 'Date', 'Time In', 'Time Out', 'Status']],
      body: rows.map((r) => [r.code, r.name, r.date, r.timeIn, r.timeOut, r.status]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] }
    });

    const footerY = pdf.internal.pageSize.getHeight() - 40;
    pdf.setFontSize(8);
    pdf.text(exportMeta.address, margin, footerY, { maxWidth: pageWidth - margin * 2 });
    pdf.text(`Tel: ${exportMeta.phone} | WhatsApp: ${exportMeta.whatsapp}`, margin, footerY + 12);

    pdf.save(`attendance-${apiDateUi || 'report'}.pdf`);
    toast.success('PDF exported');
  };

  const toApiDate = (dateValue) => {
    if (!dateValue) return '';
    const [year, month, day] = dateValue.split('-');
    return `${year}/${month}/${day}`;
  };

  const handleApiFetch = async (dateValue) => {
    if (!dateValue) {
      setApiRows([]);
      return;
    }
    setApiLoading(true);
    setApiError('');
    const apiDateObj = new Date(dateValue);
    
    const startDateObj = new Date(apiDateObj);
    startDateObj.setDate(startDateObj.getDate() - 1);
    
    const endDateObj = new Date(apiDateObj);
    endDateObj.setDate(endDateObj.getDate() + 1);

    const apiDateFrom = toApiDate(startDateObj.toISOString().split('T')[0]);
    const apiDateTo = toApiDate(endDateObj.toISOString().split('T')[0]);

    try {
      const res = await fetch('http://localhost:5001/api/attendance/external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Dates: apiDateFrom, DatesTo: apiDateTo })
      });
      const json = await res.json();
      if (json.status === 200 && Array.isArray(json.data)) {
        setApiRows(json.data);
      } else {
        setApiRows([]);
        setApiError(json.message || 'No data found');
      }
    } catch (err) {
      setApiError(`API error: ${err.message}`);
    } finally {
      setApiLoading(false);
    }
  };

  useEffect(() => {
    handleApiFetch(apiDateUi);
  }, [apiDateUi]);

  const normalizedStaffId = apiStaffId.trim();
  const filteredApiRows = useMemo(() => {
    let filtered = normalizedStaffId
      ? apiRows.filter((row) => String(row.enrollid || row.enrollId || '').trim() === normalizedStaffId)
      : apiRows;
    
    // Daily View must follow apiDateUi date selection
    const targetDate = toDateOnly(apiDateUi || selectedDate);
    if (targetDate) {
      filtered = filtered.filter((row) => {
        const rowDate = toDateOnly(row.arrive_date || row.date);
        return rowDate === targetDate;
      });
    }
    
    return filtered;
  }, [apiRows, normalizedStaffId, apiDateUi, selectedDate]);

  const upsertOverride = (payload) => {
    const dateIn = toDateOnly(payload.dateIn || payload.date || payload.dateOut);
    const dateOut = inferDateOut({
      dateIn,
      dateOut: payload.dateOut,
      timeIn: payload.timeIn,
      timeOut: payload.timeOut
    });
    if (!payload.empCode || !dateIn) return;
    
    // If payload has an ID, replace that specific record
    // Otherwise, allow multiple entries for same date (split shifts)
    const next = overrides.filter((o) => {
      // If we're updating an existing override (has matching ID), remove it
      if (payload.id && o.id === payload.id) {
        return false;
      }
      // Keep all other overrides (even if same empCode + date)
      return true;
    });
    
    next.unshift({
      id: payload.id || `${Date.now()}-${Math.random()}`,
      empCode: payload.empCode,
      date: dateIn, // backward compatibility for old consumers
      dateIn,
      dateOut,
      timeIn: payload.timeIn || '',
      timeOut: payload.timeOut || '',
      status: payload.status || 'present',
      manualWrkHrs: payload.manualWrkHrs,
      manualOvertime: payload.manualOvertime,
      manualDeduction: payload.manualDeduction,
      manualTotal: payload.manualTotal,
      waiveDeduction: Boolean(payload.waiveDeduction),
    });
    saveOverrides(next);
  };

  const onEditSave = (data) => {
    const emp = employees.find((e) => String(e.id) === String(data.employee));
    if (!emp) {
      toast.error('Employee not found');
      return;
    }

    const modalDate = toDateOnly(editModal?.dateIn || editModal?.date || editModal?.dateOut);
    const normalizedRows = editRows
      .map((row, idx) => {
        const dateIn = toDateOnly(row.dateIn || row.date || modalDate);
        if (!dateIn) return null;

        const timeIn = normalize24HourTime(row.timeIn);
        const timeOut = normalize24HourTime(row.timeOut);
        const dateOut = inferDateOut({
          dateIn,
          dateOut: row.dateOut,
          timeIn,
          timeOut,
        });

        const existingId = String(row.id || '');
        const id = existingId && !existingId.startsWith('initial-')
          ? existingId
          : `${Date.now()}-${idx}-${Math.random()}`;

        return {
          id,
          empCode: emp.empCode,
          date: dateIn,
          dateIn,
          dateOut,
          timeIn: timeIn || '',
          timeOut: timeOut || '',
          status: row.status || 'present',
          manualWrkHrs: row.manualWrkHrs ? parseFloat(row.manualWrkHrs) : null,
          manualOvertime: row.manualOvertime ? parseFloat(row.manualOvertime) : null,
          manualDeduction: row.waiveDeduction ? null : (row.manualDeduction ? parseFloat(row.manualDeduction) : null),
          manualTotal: row.manualTotal ? parseFloat(row.manualTotal) : null,
          waiveDeduction: Boolean(row.waiveDeduction),
        };
      })
      .filter(Boolean);

    if (!normalizedRows.length) {
      toast.error('At least one valid row is required');
      return;
    }

    const datesToReplace = new Set(normalizedRows.map((r) => toDateOnly(r.dateIn || r.date)));
    if (modalDate) datesToReplace.add(modalDate);

    const retained = overrides.filter((o) => {
      const sameEmp = String(o.empCode || '').trim() === String(emp.empCode || '').trim();
      const oDate = toDateOnly(o.dateIn || o.date);
      return !(sameEmp && datesToReplace.has(oDate));
    });

    saveOverrides([...normalizedRows, ...retained]);
    
    toast.success(`${editRows.length} attendance row(s) updated`);
    setEditModal(null);
    setEditRows([]);
    reset();
  };

  const onAddSave = (data) => {
    const emp = employees.find((e) => String(e.id) === String(data.employee));
    if (!emp) {
      toast.error('Employee not found');
      return;
    }
    upsertOverride({
      empCode: emp.empCode,
      dateIn: data.dateIn,
      dateOut: data.dateOut,
      timeIn: data.timeIn,
      timeOut: data.timeOut,
      status: data.status,
      manualWrkHrs: data.manualWrkHrs ? parseFloat(data.manualWrkHrs) : null,
      manualOvertime: data.manualOvertime ? parseFloat(data.manualOvertime) : null,
      manualDeduction: data.waiveDeduction ? null : (data.manualDeduction ? parseFloat(data.manualDeduction) : null),
      waiveDeduction: Boolean(data.waiveDeduction),
    });
    toast.success('Manual entry added');
    setAddModal(false);
    reset();
  };

  const getOverride = (empCode, date) => overrides.find((o) => String(o.empCode) === String(empCode) && toDateOnly(o.dateIn || o.date) === date);
  const apiTimesByEmp = useMemo(() => {
    const map = {};
    const selected = toDateOnly(selectedDate);
    apiRows.forEach((row) => {
      const enrollId = String(row.enrollid || row.enrollId || '').trim();
      if (!enrollId) return;
      const dateKey = toDateOnly(row.arrive_date || row.date);
      if (selected && dateKey && dateKey !== selected) return;
      let timeVal = String(row.arrive_time || row.time_in || '').trim();
      if (timeVal.includes(' ')) {
        timeVal = timeVal.split(' ').pop();
      }
      if (!timeVal) return;
      if (!map[enrollId]) map[enrollId] = [];
      map[enrollId].push(timeVal);
    });
    return Object.entries(map).reduce((acc, [empCode, times]) => {
      const sorted = times.slice().sort();
      acc[empCode] = {
        timeIn: sorted[0] || '',
        timeOut: sorted.length > 1 ? sorted[sorted.length - 1] : ''
      };
      return acc;
    }, {});
  }, [apiRows, selectedDate]);

  const getApiTimes = (empCode) => {
    const raw = apiTimesByEmp[empCode];
    if (!raw) return { timeIn: '', timeOut: '', hasData: false };
    const toDisplay = (value) => {
      if (!value || !selectedDate) return '';
      const dt = new Date(`${selectedDate}T${value}`);
      if (Number.isNaN(dt.getTime())) return value;
      return format(dt, 'HH:mm');
    };
    return {
      timeIn: toDisplay(raw.timeIn),
      timeOut: toDisplay(raw.timeOut),
      hasData: Boolean(raw.timeIn || raw.timeOut)
    };
  };
  const combinedRecords = (() => {
    const normalizeCode = (v) => String(v ?? '').trim();
  const selectedDateOnly = toDateOnly(selectedDate);

    const attendanceByEmpDate = attendanceRecords.reduce((acc, record) => {
      const dateValue = toDateOnly(record.date);
      const empCode = normalizeCode(record.employee?.empCode);
      if (!empCode || !dateValue) return acc;
      const key = `${empCode}-${dateValue}`;
      acc[key] = record;
      return acc;
    }, {});

    // Strictly keep overrides of selected date only (fixes random date leakage)
    const overridesForSelectedDate = overrides.filter((o) =>
      toDateOnly(o.dateIn || o.date) === selectedDateOnly
    );

    const overridesByEmp = overridesForSelectedDate.reduce((acc, o) => {
      const code = normalizeCode(o.empCode);
      if (!code) return acc;
      if (!acc[code]) acc[code] = [];
      acc[code].push(o);
      return acc;
    }, {});

    const base = employees.flatMap((emp) => {
      const empCode = normalizeCode(emp.empCode);
      const dateValue = selectedDateOnly || '';
      const key = `${empCode}-${dateValue}`;
      const record = attendanceByEmpDate[key];
      const apiTimes = getApiTimes(emp.empCode);
      const empOverrides = overridesByEmp[empCode] || [];

      // If there are one or more saved overrides for selected date, show them all.
      if (empOverrides.length > 0) {
        return empOverrides.map((o, idx) => {
          const dateInVal = toDateOnly(o.dateIn || o.date) || dateValue;
          const timeInVal = o.timeIn || '-';
          const timeOutVal = String(o.timeOut || '-').replace(' (+1d)', '');
          const dateOutVal = toDateOnly(o.dateOut) || inferDateOut({
            dateIn: selectedDateOnly || dateInVal,
            dateOut: '',
            timeIn: timeInVal,
            timeOut: timeOutVal,
          });

          return {
            key: `override-${o.id || `${empCode}-${dateInVal}-${idx}`}`,
            empCode: emp.empCode,
            name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
            date: selectedDateOnly || dateInVal,
            actualDateOut: dateOutVal || dateInVal,
            timeIn: timeInVal,
            timeOut: timeOutVal,
            status: o.status || 'present',
          };
        });
      }

      // Otherwise fallback to DB/API for selected date.
      const parsedIn = record?.actualIn ? new Date(record.actualIn) : null;
      const parsedOut = record?.actualOut ? new Date(record.actualOut) : null;

      const timeInVal = parsedIn ? format(parsedIn, 'HH:mm') : (apiTimes.timeIn || '');
      let timeOutVal = parsedOut ? format(parsedOut, 'HH:mm') : (apiTimes.timeOut || '');
      timeOutVal = String(timeOutVal || '').replace(' (+1d)', '');

      let dateOutVal = inferDateOut({ dateIn: dateValue, dateOut: '', timeIn: timeInVal, timeOut: timeOutVal });

      return [{
        key: `row-${empCode}-${dateValue}`,
        empCode: emp.empCode,
        name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
        date: dateValue,
        actualDateOut: dateOutVal || dateValue,
        timeIn: timeInVal || '-',
        timeOut: timeOutVal || '-',
        status: record?.status || (apiTimes.hasData ? 'present' : 'absent')
      }];
    });

    // Overrides whose empCode is not present in employee list (still only selected date)
    const extra = overridesForSelectedDate
      .filter((o) => !employees.some((emp) => normalizeCode(emp.empCode) === normalizeCode(o.empCode)))
      .map((o) => {
        const dateInVal = toDateOnly(o.dateIn || o.date) || selectedDateOnly;
        const dateOutVal = toDateOnly(o.dateOut) || dateInVal;
        const outTime = String(o.timeOut || '-').replace(' (+1d)', '');
        return {
          key: `override-extra-${o.id}`,
          empCode: o.empCode,
          name: '-',
          date: selectedDateOnly || dateInVal,
          actualDateOut: dateOutVal,
          timeIn: o.timeIn || '-',
          timeOut: outTime,
          status: o.status || 'present'
        };
      });

    // Final hard guard: never allow rows outside selected date in All Records
    return [...extra, ...base].filter((row) => {
      if (!selectedDateOnly) return true;
      return toDateOnly(row.date) === selectedDateOnly;
    });
  })();

  const dateOptions = useMemo(() => {
    if (!selectedDate) return [];
    const base = new Date(selectedDate);
    const year = base.getFullYear();
    const month = base.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return d.toISOString().slice(0, 10);
    });
  }, [selectedDate]);

  const filteredRecords = useMemo(() => {
    let result = combinedRecords;
    if (selectedDate) {
      const selected = toDateOnly(selectedDate);
      result = result.filter((row) => toDateOnly(row.date) === selected);
    }
    if (searchName) {
      const q = searchName.toLowerCase();
      result = result.filter(
        (row) =>
          (row.name || '').toLowerCase().includes(q) ||
          String(row.empCode || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [combinedRecords, selectedDate, searchName]);

  if (loading) return <PageLoader />;

  return (
    <div className="attendance-page">
      <PageHeader
        breadcrumbs={[
          { link: '/employee-module', label: 'Dashboard' },
          { label: 'Attendance' },
        ]}
        title="Attendance"
      />
      <div className="tabs">
        <button className={activeTab === 0 ? 'active' : ''} onClick={() => setActiveTab(0)}>
          Daily View
        </button>
        <button className={activeTab === 1 ? 'active' : ''} onClick={() => setActiveTab(1)}>
          All Records
        </button>
        <button className={activeTab === 2 ? 'active' : ''} onClick={() => setActiveTab(2)}>
          Monthly API Logs
        </button>
      </div>

      {activeTab === 0 && (
        <Card>
          <div className="info-banner blue flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <p>Daily attendance records (live API)</p>
          </div>
          <div className="filters-row mt-4">
            <input
              type="date"
              className="filter-input"
              value={apiDateUi}
              onChange={(e) => setApiDateUi(e.target.value)}
            />
            <input
              type="text"
              placeholder="Staff ID"
              className="filter-input"
              value={apiStaffId}
              onChange={(e) => setApiStaffId(e.target.value)}
            />
            <Button label="Excel" icon={Download} variant="outline" onClick={handleExportExcel} />
            <Button label="PDF" icon={Download} variant="primary" onClick={handleExportPdf} />
          </div>
          {apiError && <p className="text-red-500 mt-3">{apiError}</p>}
          <div className="overflow-x-auto mt-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Date</th>
                  <th>In</th>
                  <th>Out</th>
                  <th>Late (Min)</th>
                  <th>OT (Min)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {apiLoading ? (
                  <tr><td colSpan="8" className="text-center py-4">Loading...</td></tr>
                ) : filteredApiRows.length === 0 ? (
                  <tr><td colSpan="8" className="text-center py-4">No attendance records found.</td></tr>
                ) : (
                  filteredApiRows.map((row, idx) => {
                    const enrollId = String(row.enrollid || row.enrollId || '');
                    const match = employees.find((e) => String(e.empCode) === enrollId);
                    return (
                      <tr key={`api-row-${idx}`}>
                        <td>{enrollId || '-'}</td>
                        <td>{match ? `${match.firstName} ${match.lastName}` : '-'}</td>
                        <td>{row.arrive_date || row.date || '-'}</td>
                        <td>{row.arrive_time || row.time_in || '-'}</td>
                        <td>{row.depart_time || row.time_out || '-'}</td>
                        <td>-</td>
                        <td>-</td>
                        <td>
                          <Badge label="Present" variant="success" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 1 && (
        <Card>
          <div className="info-banner amber">
            <p>Editable attendance and manual entries (salary will use edited rows)</p>
          </div>
          <div className="filters-row">
            <input
              type="date"
              className="filter-input"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setApiDateUi(e.target.value);
              }}
            />
            <input
              type="text"
              placeholder="Search by name or code..."
              className="filter-input"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
            <Button label="+ Add Manual Entry" onClick={() => setAddModal(true)} />
          </div>
          <div className="date-scroll">
            {dateOptions.map((dateValue) => (
              <button
                key={dateValue}
                type="button"
                className={`date-pill ${selectedDate === dateValue ? 'active' : ''}`}
                onClick={() => {
                  setSelectedDate(dateValue);
                  setApiDateUi(dateValue);
                }}
              >
                <span className="date-day">{format(new Date(dateValue), 'dd')}</span>
                <span className="date-week">{format(new Date(dateValue), 'EEE')}</span>
              </button>
            ))}
          </div>
          <div className="overflow-x-auto mt-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Time IN</th>
                  <th>Time OUT</th>
                  <th>Status</th>
                  <th>Edit</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((row) => (
                  <tr key={row.key}>
                    <td>{row.empCode || '-'}</td>
                    <td>{row.name}</td>
                    <td>
                      {row.date ? format(new Date(row.date), 'dd MMM yyyy') : '-'}
                      {row.timeIn !== '-' && <span className="ml-2 font-semibold"> {row.timeIn}</span>}
                    </td>
                    <td>
                      {row.actualDateOut ? format(new Date(row.actualDateOut), 'dd MMM yyyy') : '-'}
                      {row.timeOut !== '-' && <span className="ml-2 font-semibold"> {row.timeOut}</span>}
                    </td>
                    <td>
                      <Badge
                        label={toStatusLabel(row.status)}
                        variant={toStatusVariant(row.status)}
                      />
                    </td>
                    <td>
                      <button className="edit-btn" onClick={() => setEditModal(row)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 2 && (
        <Card>
          <div className="info-banner blue flex justify-between items-center">
            <p>Monthly API Logs - Check all live punches directly from the machine</p>
          </div>
          <div className="filters-row mt-4">
            <input
              type="text"
              placeholder="Staff ID (e.g. 251)"
              className="filter-input"
              value={monthlyEmpCode}
              onChange={(e) => setMonthlyEmpCode(e.target.value)}
            />
            <select className="filter-input" value={monthlyMonth} onChange={(e) => setMonthlyMonth(e.target.value)}>
              {["01","02","03","04","05","06","07","08","09","10","11","12"].map(m => (
                <option key={m} value={m}>{new Date(2000, parseInt(m)-1, 1).toLocaleString('default', { month: 'long' })} ({m})</option>
              ))}
            </select>
            <select className="filter-input" value={monthlyYear} onChange={(e) => setMonthlyYear(e.target.value)}>
              {['2025', '2026', '2027'].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <Button onClick={fetchMonthlyApiData} disabled={monthlyLoading} label={monthlyLoading ? "Fetching..." : "Get Live Data"} variant="primary" />
          </div>
          <div className="overflow-x-auto mt-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date (API)</th>
                  <th>First Punch (IN)</th>
                  <th>Last Punch (OUT)</th>
                  <th>All Raw Punches (Trace)</th>
                </tr>
              </thead>
              <tbody>
                {monthlyApiData.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-4">{monthlyLoading ? "Loading..." : "No Data"}</td></tr>
                ) : monthlyApiData.map((row, i) => (
                  <tr key={i}>
                    <td className="font-semibold">{row.date}</td>
                    <td className="text-green-600 font-bold">{row.timeIn}</td>
                    <td className="text-red-500 font-bold">{row.timeOut}</td>
                    <td className="text-gray-500 text-sm">{row.allPunches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}


      <Modal isOpen={!!editModal} onClose={() => setEditModal(null)} title="Edit Attendance" size="lg">
        {editModal && (
          <form onSubmit={handleSubmit(onEditSave)}>
            <div className="form-group">
              <label>Employee</label>
              <select {...register('employee')} className="form-select">
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.empCode} - {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Multiple Rows for Split Shifts */}
            {editRows.map((row, index) => {
              return (
              <div key={row.id} className="mb-4 p-4 border rounded bg-gray-50">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold">Row {index + 1}</h4>
                  {(editRows.length > 1 && row.isManual) && (
                    <Button 
                      type="button" 
                      label="Delete" 
                      variant="ghost" 
                      onClick={() => {
                        setEditRows(prev => prev.filter(r => r.id !== row.id));
                      }} 
                    />
                  )}
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Date IN</label>
                    <input
                      type="date"
                      className="form-input"
                      value={row.dateIn}
                      onChange={(e) => {
                        const updated = editRows.map((r, i) => 
                          i === index ? { ...r, dateIn: e.target.value } : r
                        );
                        setEditRows(updated);
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Time IN (24hr)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="21:00"
                      maxLength={5}
                      className="form-input"
                      value={row.timeIn}
                      onChange={(e) => {
                        const updated = editRows.map((r, i) => 
                          i === index ? { ...r, timeIn: e.target.value } : r
                        );
                        setEditRows(updated);
                      }}
                      onBlur={(e) => {
                        const updated = editRows.map((r, i) => 
                          i === index ? { ...r, timeIn: normalize24HourTime(e.target.value) } : r
                        );
                        setEditRows(updated);
                      }}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Date OUT</label>
                    <input
                      type="date"
                      className="form-input"
                      value={row.dateOut}
                      onChange={(e) => {
                        const updated = editRows.map((r, i) => 
                          i === index ? { ...r, dateOut: e.target.value } : r
                        );
                        setEditRows(updated);
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Time OUT (24hr)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="09:00"
                      maxLength={5}
                      className="form-input"
                      value={row.timeOut}
                      onChange={(e) => {
                        const updated = editRows.map((r, i) => 
                          i === index ? { ...r, timeOut: e.target.value } : r
                        );
                        setEditRows(updated);
                      }}
                      onBlur={(e) => {
                        const updated = editRows.map((r, i) => 
                          i === index ? { ...r, timeOut: normalize24HourTime(e.target.value) } : r
                        );
                        setEditRows(updated);
                      }}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select 
                    className="form-select"
                    value={row.status}
                    onChange={(e) => {
                      const updated = editRows.map((r, i) => 
                        i === index ? { ...r, status: e.target.value } : r
                      );
                      setEditRows(updated);
                    }}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  {/* <div className="form-group">
                    <label>Work Hrs (Manual)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-input"
                      value={row.manualWrkHrs}
                      onChange={(e) => {
                        const updated = editRows.map((r, i) => 
                          i === index ? { ...r, manualWrkHrs: e.target.value } : r
                        );
                        setEditRows(updated);
                      }}
                      placeholder="e.g. 8"
                    />
                  </div> */}
                  {/* <div className="form-group">
                    <label>Overtime Hrs (Manual)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-input"
                      value={row.manualOvertime}
                      onChange={(e) => {
                        const updated = editRows.map((r, i) => 
                          i === index ? { ...r, manualOvertime: e.target.value } : r
                        );
                        setEditRows(updated);
                      }}
                      placeholder="e.g. 2.5"
                    />
                  </div> */}
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '28px' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(row.waiveDeduction)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const updated = editRows.map((r, i) =>
                          i === index
                            ? { ...r, waiveDeduction: checked, manualDeduction: checked ? '' : r.manualDeduction }
                            : r
                        );
                        setEditRows(updated);
                      }}
                    />
                    <label style={{ margin: 0 }}>Waive Deduction</label>
                  </div>
                </div>
                <div className="form-row">
                  {/* <div className="form-group">
                    <label>Deduction (Rs)</label>
                    <input
                      type="number"
                      step="1"
                      className="form-input"
                      value={row.manualDeduction}
                      disabled={Boolean(row.waiveDeduction)}
                      onChange={(e) => {
                        const updated = editRows.map((r, i) => 
                          i === index ? { ...r, manualDeduction: e.target.value } : r
                        );
                        setEditRows(updated);
                      }}
                      placeholder="e.g. 500"
                    />
                  </div> */}
                  {/* <div className="form-group">
                    <label>Total Amount (Rs)</label>
                    <input
                      type="number"
                      step="1"
                      className="form-input"
                      value={row.manualTotal}
                      onChange={(e) => {
                        const updated = editRows.map((r, i) => 
                          i === index ? { ...r, manualTotal: e.target.value } : r
                        );
                        setEditRows(updated);
                      }}
                      placeholder="Editable Total"
                    />
                  </div> */}
                </div>
              </div>
              );
            })}
            
            {/* Add New Row Button */}
            {/* <div className="mb-4">
              <Button 
                type="button" 
                label="+ Add New Row (Split Shift)" 
                variant="outline" 
                onClick={() => {
                  const newRow = {
                    id: `${Date.now()}-${Math.random()}`,
                    dateIn: editRows[0]?.dateIn || '',
                    dateOut: editRows[0]?.dateOut || '',
                    timeIn: '',
                    timeOut: '',
                    status: 'present',
                    manualWrkHrs: '',
                    manualOvertime: '',
                    manualDeduction: '',
                    manualTotal: '',
                    isManual: true,
                  };
                  setEditRows(prev => [...prev.map(r => ({ ...r })), newRow]);
                }}
              />
            </div>
             */}
            <div className="modal-actions">
              <Button type="button" label="Cancel" variant="ghost" onClick={() => setEditModal(null)} />
              <Button type="submit" label="Save " />
            </div>
          </form>
        )}
      </Modal>
      <Modal isOpen={addModal} onClose={() => setAddModal(false)} title="Add Manual Entry" size="md">
        <form onSubmit={handleSubmit(onAddSave)}>
          <div className="form-group">
            <label>Employee</label>
            <select {...register('employee')} className="form-select">
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.empCode} - {e.firstName} {e.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <Input label="Date" type="date" {...register('dateIn')} />
            <Input label="Date OUT" type="date" {...register('dateOut')} />
          </div>
          <div className="form-row">
            <Input
              label="Time IN (24hr)"
              type="text"
              inputMode="numeric"
              placeholder="21:00"
              maxLength={5}
              {...register24Hour('timeIn')}
              error={errors.timeIn?.message}
            />
            <Input
              label="Time OUT (24hr)"
              type="text"
              inputMode="numeric"
              placeholder="09:00"
              maxLength={5}
              {...register24Hour('timeOut')}
              error={errors.timeOut?.message}
            />
            <Input label="Status" type="text" value="" style={{ display: 'none' }} readOnly />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select {...register('status')} className="form-select">
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            {/* <Input label="Work Hrs (Manual)" type="number" step="0.1" {...register('manualWrkHrs')} placeholder="e.g. 8" />
            <Input label="Overtime Hrs (Manual)" type="number" step="0.1" {...register('manualOvertime')} placeholder="e.g. 2.5" /> */}
          </div>
          <div className="form-row">
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <input type="checkbox" {...register('waiveDeduction')} />
              <label style={{ margin: 0 }}>Waive Deduction</label>
            </div>
          </div>
          <div className="form-row">
            <Input label="Deduction (Rs)" type="number" step="1" {...register('manualDeduction')} placeholder="e.g. 500" disabled={Boolean(addModalWaiveDeduction)} />
          </div>
          <div className="modal-actions">
            <Button type="button" label="Cancel" variant="ghost" onClick={() => setAddModal(false)} />
            <Button type="submit" label="Save" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
