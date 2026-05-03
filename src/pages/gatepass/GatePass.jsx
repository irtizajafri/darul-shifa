import { useState, useEffect, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { useModuleStore } from '../../store/useModuleStore';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import { useGatePassStore } from '../../store/useGatePassStore';
import PageLoader from '../../components/ui/PageLoader';
import PageHeader from '../../components/shared/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../../assets/logo.jpg';
import './GatePass.scss';

export default function GatePass() {
  const now = new Date();
  const defaultDate = now.toISOString().slice(0, 10);
  const defaultTime = now.toTimeString().slice(0, 5);

  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [returnModal, setReturnModal] = useState(null);
  const [viewModal, setViewModal] = useState(null);
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [filterEmp, setFilterEmp] = useState('');
  const [filterType, setFilterType] = useState('');
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const { setModule } = useModuleStore();
  const { employees, fetchEmployees } = useEmployeeStore();
  const { gatepasses, fetchGatepasses, createGatepass, closeGatepass } = useGatePassStore();
  const employeeDropdownRef = useRef(null);

  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      date: defaultDate,
      timeOut: defaultTime,
      nature: 'Personal'
    }
  });
  const {
    register: registerReturn,
    handleSubmit: handleReturnSubmit,
    setValue: setReturnValue
  } = useForm();
  const nature = watch('nature', 'Personal');
  const empCodeVal = watch('empCode');
  const selectedEmployee = employees.find((e) => String(e.empCode) === String(empCodeVal));
  const filteredEmployees = useMemo(() => {
    const q = String(employeeQuery || '').trim().toLowerCase();
    if (!q) return employees || [];
    return (employees || []).filter((e) => {
      const code = String(e.empCode || '').toLowerCase();
      const fullName = `${e.firstName || ''} ${e.lastName || ''}`.trim().toLowerCase();
      return code.includes(q) || fullName.includes(q);
    });
  }, [employees, employeeQuery]);
  const getRosterHours = (employee, issuedAt) => {
    if (!employee?.dutyRoster || !issuedAt) return 8;
    const dayIndex = new Date(issuedAt).getDay();
    const map = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayKey = map[dayIndex];
    const roster = employee.dutyRoster.find((d) => d.day === dayKey);
    if (roster?.hours) return Number(roster.hours) || 8;
    if (roster?.timeIn && roster?.timeOut && roster.timeIn !== 'OFF' && roster.timeOut !== 'OFF') {
      const diff = (new Date(`1970-01-01T${roster.timeOut}`) - new Date(`1970-01-01T${roster.timeIn}`)) / 3600000;
      return diff > 0 ? diff : 8;
    }
    return 8;
  };
  const getPerMinuteRate = (employee, issuedAt) => {
    if (!employee) return 0;
    const basicSalary = Number(employee.basicSalary ?? employee.salaryMonthly ?? 0);
    const allowances = employee.allowances || [];
    const totalAllow = allowances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const monthlyTotal = basicSalary + totalAllow;
    const perDay = monthlyTotal / 30;
    const rosterHours = getRosterHours(employee, issuedAt);
    return perDay / (rosterHours * 60);
  };
  const getGatepassMinutes = (pass) => {
    if (!pass?.issuedAt) return 0;
    const outAt = new Date(pass.issuedAt);
    const inAt = pass.validTill ? new Date(pass.validTill) : new Date();
    if (Number.isNaN(outAt.getTime()) || Number.isNaN(inAt.getTime())) return 0;
    return Math.max(0, Math.round((inAt - outAt) / 60000));
  };

  const exportMeta = {
    address: 'C 1-4 Survery # 675 Jaffar e Tayyar Society Malir, Karachi, Pakistan, 75210',
    phone: '021-34508390',
    whatsapp: '+92 334 2225746'
  };

  const formatTime = (value) => {
    if (!value) return '-';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (value) => (value ? String(value).slice(0, 10) : '-');

  const buildGatepassPdf = async ({
    title,
    passNo,
    empCode,
    empName,
    date,
    timeOut,
    timeIn,
    nature: passNature,
    purpose,
    permissionBy,
    minutesOut,
    perMinute,
    deduction,
    status
  }) => {
    const pdf = new jsPDF('p', 'pt', 'a6');
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

    const logoDataUrl = await loadImageDataUrl(logo);

    const margin = 20;
    const pageWidth = pdf.internal.pageSize.getWidth();

    if (logoDataUrl) {
      pdf.addImage(logoDataUrl, 'PNG', margin, 12, 45, 45);
    }

  pdf.setFontSize(11);
  pdf.text('Darul Shifa Imam Khomeini', margin + 55, 26);
  pdf.setFontSize(8);
  pdf.text(exportMeta.address, margin + 55, 40, { maxWidth: pageWidth - margin * 2 - 55 });
  pdf.text(`Tel: ${exportMeta.phone}`, margin + 55, 60);
  pdf.text(`WhatsApp: ${exportMeta.whatsapp}`, margin + 55, 72);
  pdf.setFontSize(10);
  pdf.text(title, margin, 92);

    autoTable(pdf, {
  startY: 102,
      head: [['Field', 'Value']],
      body: [
        ['Pass #', passNo || '-'],
        ['Employee', empCode && empName ? `${empCode} - ${empName}` : empCode || empName || '-'],
        ['Date', date || '-'],
        ['Time Out', timeOut || '-'],
        ['Time In', timeIn || '-'],
        ['Nature', passNature || '-'],
        ['Purpose', purpose || '-'],
        ['Permission By', permissionBy || '-'],
        ['Minutes Out', minutesOut ?? '-'],
        ['Per Minute', perMinute ?? '-'],
        ['Deduction', deduction ?? '-'],
        ['Status', status || '-']
      ],
      styles: { fontSize: 8 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
      headStyles: { fillColor: [37, 99, 235] }
    });

    const footerY = pdf.internal.pageSize.getHeight() - 26;
    pdf.setFontSize(7);
    pdf.text(exportMeta.address, margin, footerY, { maxWidth: pageWidth - margin * 2 });
    pdf.text(`Tel: ${exportMeta.phone} | WhatsApp: ${exportMeta.whatsapp}`, margin, footerY + 10);

    pdf.save(`gatepass-${passNo || 'draft'}.pdf`);
  };

  const handlePrintDraft = async (formData) => {
    if (!selectedEmployee) {
      toast.error('Employee not found');
      return;
    }
    await buildGatepassPdf({
      title: 'Gate Pass (Out)',
      passNo: 'DRAFT',
      empCode: selectedEmployee.empCode,
      empName: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
      date: formatDate(formData.date || defaultDate),
      timeOut: formData.timeOut || defaultTime,
      timeIn: '-',
      nature: formData.nature,
      purpose: formData.purpose,
      permissionBy: formData.permissionBy,
      minutesOut: '- -',
      perMinute: '- -',
      deduction: '- -',
      status: 'Active'
    });
    toast.success('Gate pass PDF generated');
  };

  const handlePrintView = async (pass) => {
    if (!pass) return;
    const minutesOut = getGatepassMinutes(pass);
    const perMinute = getPerMinuteRate(pass.employee, pass.issuedAt);
    await buildGatepassPdf({
      title: 'Gate Pass (In)',
      passNo: `GP-${pass.id}`,
      empCode: pass.employee?.empCode,
      empName: `${pass.employee?.firstName || ''} ${pass.employee?.lastName || ''}`.trim(),
      date: formatDate(pass.issuedAt),
      timeOut: formatTime(pass.issuedAt),
      timeIn: pass.validTill ? formatTime(pass.validTill) : '-',
      nature: pass.nature,
      purpose: pass.purpose || pass.reason,
      permissionBy: pass.permissionBy,
      minutesOut: minutesOut,
      perMinute: perMinute ? perMinute.toFixed(2) : '-',
      deduction: perMinute ? Math.round(minutesOut * perMinute).toLocaleString() : '-',
      status: pass.status
    });
    toast.success('Gate pass PDF generated');
  };

  useEffect(() => {
    setModule('employee');
    Promise.all([fetchEmployees(), fetchGatepasses()]).then(() => setLoading(false));
  }, [setModule, fetchEmployees, fetchGatepasses]);

  useEffect(() => {
    if (returnModal) {
      const fresh = new Date();
      setReturnValue('returnDate', fresh.toISOString().slice(0, 10));
      setReturnValue('returnTime', fresh.toTimeString().slice(0, 5));
    }
  }, [returnModal, setReturnValue]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!employeeDropdownRef.current) return;
      if (!employeeDropdownRef.current.contains(event.target)) {
        setEmployeeDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const findEmployeeByExactQuery = (queryText) => {
    const q = String(queryText || '').trim().toLowerCase();
    if (!q) return null;
    return (employees || []).find((e) => {
      const code = String(e.empCode || '').trim().toLowerCase();
      const fullName = `${e.firstName || ''} ${e.lastName || ''}`.trim().toLowerCase();
      return q === code || q === fullName;
    }) || null;
  };

  const selectEmployee = (employee) => {
    if (!employee) return;
    const code = String(employee.empCode || '').trim();
    const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
    setValue('empCode', code, { shouldValidate: true, shouldDirty: true });
    setEmployeeQuery(`${fullName} (${code})`);
    setEmployeeDropdownOpen(false);
  };

  const handleEmployeeInputBlur = () => {
    if (selectedEmployee) return;
    const exact = findEmployeeByExactQuery(employeeQuery);
    if (exact) selectEmployee(exact);
  };

  const onSave = async (data) => {
    const target = employees.find((e) => String(e.empCode) === String(data.empCode));
    if (!target) {
      toast.error('Employee not found');
      return;
    }
    try {
      const issuedAt = new Date();
      await createGatepass({
        employeeId: target.id,
        nature: data.nature,
        reason: data.reason,
        purpose: data.purpose,
        permissionBy: data.permissionBy,
        issuedAt
      });
      toast.success('Gate pass created');
      setModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'Failed to create gate pass');
    }
  };

  const onCloseGatepass = async (data) => {
    if (!returnModal) return;
    try {
      const date = data.returnDate || defaultDate;
      const time = data.returnTime || defaultTime;
      const inAt = new Date(`${date}T${time}`);
      await closeGatepass(returnModal.id, { inAt });
      toast.success('Gate pass closed');
      setReturnModal(null);
    } catch (err) {
      toast.error(err.message || 'Failed to close gate pass');
    }
  };

  const filteredData = gatepasses.filter((g) => {
    const dateKey = g.issuedAt ? g.issuedAt.slice(0, 10) : '';
    const matchDate = !selectedDate || dateKey === selectedDate;
    const matchEmp = !filterEmp || String(g.employee?.empCode || '').includes(filterEmp);
    const matchType = !filterType || String(g.nature || '').toLowerCase() === filterType.toLowerCase();
    return matchDate && matchEmp && matchType;
  });

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

  if (loading) return <PageLoader />;

  return (
    <div className="gatepass-page">
      <PageHeader
        breadcrumbs={[
          { link: '/employee-module', label: 'Dashboard' },
          { label: 'Gate Pass' },
        ]}
        title="Gate Pass"
        actionLabel="+ New Gate Pass"
        onAction={() => {
          const fresh = new Date();
          setValue('date', fresh.toISOString().slice(0, 10));
          setValue('timeOut', fresh.toTimeString().slice(0, 5));
          setValue('empCode', '');
          setEmployeeQuery('');
          setEmployeeDropdownOpen(false);
          setModalOpen(true);
        }}
      />
      <div className="filters-row">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => {
            setSelectedDate(e.target.value);
          }}
          className="filter-input"
        />
        <input
          type="text"
          placeholder="Employee"
          value={filterEmp}
          onChange={(e) => setFilterEmp(e.target.value)}
          className="filter-input"
        />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="filter-select">
          <option value="">All Types</option>
          <option value="personal">Personal</option>
          <option value="office">Office</option>
        </select>
      </div>
      <div className="date-scroll">
        {dateOptions.map((dateValue) => (
          <button
            key={dateValue}
            type="button"
            className={`date-pill ${selectedDate === dateValue ? 'active' : ''}`}
            onClick={() => {
              setSelectedDate(dateValue);
            }}
          >
            <span className="date-day">{format(new Date(dateValue), 'dd')}</span>
            <span className="date-week">{format(new Date(dateValue), 'EEE')}</span>
          </button>
        ))}
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-pass">Pass #</th>
                <th className="col-code">Code</th>
                <th>Name</th>
                <th className="col-date">Date</th>
                <th className="col-out">Out</th>
                <th className="col-in">In</th>
                <th>Nature</th>
                <th className="col-purpose">Purpose</th>
                <th className="col-status">Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((g) => (
                <tr key={g.id}>
                  <td className="col-pass">{`GP-${g.id}`}</td>
                  <td className="col-code">{g.employee?.empCode || '-'}</td>
                  <td>{g.employee?.firstName} {g.employee?.lastName}</td>
                  <td className="col-date">{g.issuedAt ? g.issuedAt.slice(0, 10) : '-'}</td>
                  <td className="col-out">{g.issuedAt ? new Date(g.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td className="col-in">{g.validTill ? new Date(g.validTill).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td>
                    <Badge label={g.nature} variant={g.nature === 'Office' ? 'info' : 'default'} />
                  </td>
                  <td className="col-purpose">{g.purpose || g.reason || '-'}</td>
                  <td className="col-status">
                    <Badge label={g.status} variant={g.status === 'active' ? 'success' : 'default'} />
                  </td>
                  <td>
                    {g.status === 'active' ? (
                      <button className="action-btn" onClick={() => setReturnModal(g)}>
                        Mark Return
                      </button>
                    ) : (
                      <button className="action-btn" onClick={() => setViewModal(g)}>
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Gate Pass"
        size="lg"
      >
        <form onSubmit={handleSubmit(onSave)}>
          <div className="form-group">
            <label>Employee (Code or Name)</label>
            <div className="employee-picker" ref={employeeDropdownRef}>
              <input
                type="text"
                className="form-input"
                placeholder="Type employee code or name"
                value={employeeQuery}
                onChange={(e) => {
                  setEmployeeQuery(e.target.value);
                  setEmployeeDropdownOpen(true);
                  setValue('empCode', '', { shouldValidate: true, shouldDirty: true });
                }}
                onFocus={() => setEmployeeDropdownOpen(true)}
                onBlur={handleEmployeeInputBlur}
              />
              <input type="hidden" {...register('empCode', { required: true })} />
              {employeeDropdownOpen && (
                <div className="employee-dropdown">
                  {filteredEmployees.length === 0 ? (
                    <div className="employee-empty">No employee found</div>
                  ) : (
                    filteredEmployees.map((employee) => (
                      <button
                        key={employee.id}
                        type="button"
                        className="employee-option"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectEmployee(employee)}
                      >
                        <span>{employee.firstName} {employee.lastName}</span>
                        <small>{employee.empCode}</small>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="form-group">
            <label>Name (auto-fill)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Select employee first"
              value={selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : ''}
              readOnly
            />
          </div>
          <div className="form-group">
            <label>Nature</label>
            <div className="radio-group">
              <label><input type="radio" value="Personal" {...register('nature')} /> Personal</label>
              <label><input type="radio" value="Office" {...register('nature')} /> Office</label>
            </div>
            <p className="form-hint">
              {nature === 'Personal' ? 'Personal → Salary will be deducted' : 'Office → No deduction'}
            </p>
          </div>
          <Input label="Permission By" {...register('permissionBy', { required: true })} />
          <div className="form-row">
            <Input label="Date" type="date" {...register('date')} readOnly />
            <Input label="Time Out" type="time" {...register('timeOut')} readOnly />
            <Input label="Time In" type="time" {...register('timeIn')} readOnly />
          </div>
          <div className="form-group">
            <label>Purpose *</label>
            <textarea {...register('purpose', { required: true })} className="form-textarea" rows={3} />
          </div>
          <div className="modal-actions">
            <Button type="button" label="Close" variant="ghost" onClick={() => setModalOpen(false)} />
            <Button type="button" label="Print" variant="outline" onClick={handleSubmit(handlePrintDraft)} />
            <Button type="submit" label="Save" />
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={!!returnModal}
        onClose={() => setReturnModal(null)}
        title="Mark Return"
        size="md"
      >
        {returnModal && (
          <form onSubmit={handleReturnSubmit(onCloseGatepass)}>
            <div className="form-row">
              <Input label="Return Date" type="date" {...registerReturn('returnDate')} />
              <Input label="Return Time" type="time" {...registerReturn('returnTime')} />
            </div>
            <div className="modal-actions">
              <Button type="button" label="Cancel" variant="ghost" onClick={() => setReturnModal(null)} />
              <Button type="submit" label="Close Gate Pass" />
            </div>
          </form>
        )}
      </Modal>
      <Modal
        isOpen={!!viewModal}
        onClose={() => setViewModal(null)}
        title="Gate Pass Details"
        size="md"
      >
        {viewModal && (
          <div className="view-grid">
            <p><strong>Pass #:</strong> {`GP-${viewModal.id}`}</p>
            <p><strong>Employee:</strong> {viewModal.employee?.empCode} - {viewModal.employee?.firstName} {viewModal.employee?.lastName}</p>
            <p><strong>Date:</strong> {viewModal.issuedAt ? viewModal.issuedAt.slice(0, 10) : '-'}</p>
            <p><strong>Out:</strong> {viewModal.issuedAt ? new Date(viewModal.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
            <p><strong>In:</strong> {viewModal.validTill ? new Date(viewModal.validTill).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
            <p><strong>Nature:</strong> {viewModal.nature || '-'}</p>
            <p><strong>Purpose:</strong> {viewModal.purpose || viewModal.reason || '-'}</p>
            <p><strong>Minutes Out:</strong> {getGatepassMinutes(viewModal)}</p>
            <p><strong>Per Minute:</strong> {getPerMinuteRate(viewModal.employee, viewModal.issuedAt).toFixed(2)}</p>
            <p><strong>Deduction:</strong> {Math.round(getGatepassMinutes(viewModal) * getPerMinuteRate(viewModal.employee, viewModal.issuedAt)).toLocaleString()}</p>
            <p><strong>Status:</strong> {viewModal.status}</p>
            <div className="modal-actions">
              <Button type="button" label="Close" variant="ghost" onClick={() => setViewModal(null)} />
              <Button type="button" label="Print" variant="outline" onClick={() => handlePrintView(viewModal)} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
