import { useRef, useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useModuleStore } from '../../store/useModuleStore';
import { departments, allowanceTypes } from '../../utils/dummyData';
import { getTotalSalary } from '../../utils/helpers';
import PageLoader from '../../components/ui/PageLoader';
import PageHeader from '../../components/shared/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import toast from 'react-hot-toast';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import { BadgeCheck, Building2, Camera, CalendarClock, User } from 'lucide-react';
import './AddEmployee.scss';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EMPLOYEE_META_API = 'http://localhost:5001/api/employees';

const normalizeText = (value) => String(value || '').trim();

const normalizeDutyType = (value) => {
  const v = String(value || '').toLowerCase();
  if (v === 'alternate') return 'alternative';
  if (v === 'alternative' || v === 'night' || v === 'split' || v === 'normal') return v;
  return 'normal';
};

const toHoursFromRange = (timeIn, timeOut) => {
  const inMatch = String(timeIn || '').match(/^(\d{2}):(\d{2})$/);
  const outMatch = String(timeOut || '').match(/^(\d{2}):(\d{2})$/);
  if (!inMatch || !outMatch) return 8;

  const inMinutes = Number(inMatch[1]) * 60 + Number(inMatch[2]);
  const outMinutes = Number(outMatch[1]) * 60 + Number(outMatch[2]);
  let diff = outMinutes - inMinutes;
  if (diff <= 0) diff += 24 * 60;
  return Number((diff / 60).toFixed(1));
};

export default function AddEmployee({ edit }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [allowanceTypeOptions, setAllowanceTypeOptions] = useState(() => allowanceTypes || []);
  const [newAllowanceHead, setNewAllowanceHead] = useState('');
  const [departmentRecords, setDepartmentRecords] = useState([]);
  const [designationRecordsByDepartmentId, setDesignationRecordsByDepartmentId] = useState({});
  const [mastersLoading, setMastersLoading] = useState(false);
  const [newDepartmentHead, setNewDepartmentHead] = useState('');
  const [newDesignationHead, setNewDesignationHead] = useState('');
  const { id } = useParams();
  const { setModule } = useModuleStore();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const signatureInputRef = useRef(null);
  const cnicFrontInputRef = useRef(null);
  const cnicBackInputRef = useRef(null);

  const { getEmployeeById, getNextEmpCode, addEmployee, updateEmployee } =
    useEmployeeStore();

  const existing = edit && id ? getEmployeeById(id) : null;
  const normalizeRoster = (rows = []) => {
    const byDay = Object.fromEntries((rows || []).map((r) => [r.day, r]));
    return DAYS.map((d, i) => {
      const row = byDay[d] || {};
      return {
        day: d,
        nightShift: Boolean(row.nightShift),
        timeIn: row.timeIn ?? (i < 6 ? '08:00' : 'OFF'),
        timeOut: row.timeOut ?? (i < 6 ? '16:00' : 'OFF'),
        hours: Number.isFinite(Number(row.hours)) ? Number(row.hours) : (i < 6 ? 8 : 0),
        splitShift: Boolean(row.splitShift),
        shift1End: row.shift1End || '15:00',
        shift2Start: row.shift2Start || '16:00',
        shift1Hours: Number.isFinite(Number(row.shift1Hours)) ? Number(row.shift1Hours) : 4,
        shift2Hours: Number.isFinite(Number(row.shift2Hours)) ? Number(row.shift2Hours) : 4,
      };
    });
  };

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: existing
      ? {
          ...existing,
          allowances: existing.allowances || [],
          photo: existing.photo || null,
          signature: existing.signature || null,
          dutyType: normalizeDutyType(existing.dutyType),
          dutyRoster: normalizeRoster(existing.dutyRoster || []),
          isNightShift: existing.isNightShift || false,
          cnicFrontDoc: existing.cnicFrontDoc || null,
          cnicBackDoc: existing.cnicBackDoc || null,
          cnicExpiryDate: existing.cnicExpiryDate || '',
          hasEobi: Boolean(existing.hasEobi),
          hasSocialSecurity: Boolean(existing.hasSocialSecurity),
          hasHealthCard: Boolean(existing.hasHealthCard),
          hasOtherBenefit: Boolean(existing.hasOtherBenefit),
          otherBenefitText: existing.otherBenefitText || '',
          eobiContribution: Number(existing.eobiContribution || 0),
          socialSecurityContribution: Number(existing.socialSecurityContribution || 0),
          healthCardContribution: Number(existing.healthCardContribution || 0),
          otherBenefitContribution: Number(existing.otherBenefitContribution || 0),
          alternativeTimeIn:
            normalizeRoster(existing.dutyRoster || []).find((r) => r.timeIn !== 'OFF' && r.timeOut !== 'OFF')?.timeIn ||
            (existing.isNightShift ? '21:00' : '08:00'),
          alternativeTimeOut:
            normalizeRoster(existing.dutyRoster || []).find((r) => r.timeIn !== 'OFF' && r.timeOut !== 'OFF')?.timeOut ||
            (existing.isNightShift ? '09:00' : '16:00'),
        }
      : {
          empCode: getNextEmpCode(),
          allowances: [],
          photo: null,
          signature: null,
          dutyType: 'normal',
          dutyRoster: normalizeRoster([]),
          isNightShift: false,
          cnicFrontDoc: null,
          cnicBackDoc: null,
          cnicExpiryDate: '',
          hasEobi: false,
          hasSocialSecurity: false,
          hasHealthCard: false,
          hasOtherBenefit: false,
          otherBenefitText: '',
          eobiContribution: 0,
          socialSecurityContribution: 0,
          healthCardContribution: 0,
          otherBenefitContribution: 0,
          alternativeTimeIn: '08:00',
          alternativeTimeOut: '16:00',
        },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'allowances' });
  const { fields: rosterFields } = useFieldArray({ control, name: 'dutyRoster' });

  const basicSalary = watch('basicSalary') || 0;
  const allowances = watch('allowances') || [];
  const dutyType = normalizeDutyType(watch('dutyType'));
  const selectedDepartment = normalizeText(watch('department'));
  const selectedDesignation = normalizeText(watch('designation'));
  const selectedDepartmentRecord = departmentRecords.find(
    (dept) => normalizeText(dept?.name).toLowerCase() === selectedDepartment.toLowerCase()
  ) || null;
  const selectedDepartmentDesignations = selectedDepartmentRecord
    ? (designationRecordsByDepartmentId[selectedDepartmentRecord.id] || [])
    : [];
  const departmentOptions = Array.from(
    new Set([
      ...(departments || []),
      ...departmentRecords.map((dept) => dept.name),
      ...(existing?.department ? [existing.department] : []),
    ].map((item) => normalizeText(item)).filter(Boolean))
  );
  const designationOptionsForSelectedDepartment = Array.from(
    new Set([
      ...selectedDepartmentDesignations.map((item) => normalizeText(item.name)),
      ...(selectedDepartment && existing?.department === selectedDepartment && existing?.designation
        ? [existing.designation]
        : []),
      ...(selectedDepartment && existing?.department === selectedDepartment && existing?.role
        ? [existing.role]
        : []),
    ].filter(Boolean))
  );
  const isSplitDuty = dutyType === 'split';
  const nightShiftReg = register('isNightShift');
  const totalSalary = getTotalSalary(basicSalary, allowances);
  const photo = watch('photo');
  const signature = watch('signature');
  const cnicFrontDoc = watch('cnicFrontDoc');
  const cnicBackDoc = watch('cnicBackDoc');
  const hasOtherBenefit = watch('hasOtherBenefit');

  const readApiData = async (response) => {
    const json = await response.json().catch(() => null);
    if (!response.ok || json?.ok === false) {
      throw new Error(json?.message || 'Request failed');
    }
    return json?.data;
  };

  const loadDepartments = async () => {
    const res = await fetch(`${EMPLOYEE_META_API}/departments`);
    const data = await readApiData(res);
    setDepartmentRecords(Array.isArray(data) ? data : []);
    return Array.isArray(data) ? data : [];
  };

  const loadDesignationsByDepartment = async (departmentId) => {
    if (!departmentId) return [];
    const res = await fetch(`${EMPLOYEE_META_API}/departments/${departmentId}/designations`);
    const data = await readApiData(res);
    const rows = Array.isArray(data) ? data : [];

    setDesignationRecordsByDepartmentId((prev) => ({
      ...prev,
      [departmentId]: rows,
    }));

    return rows;
  };

  useEffect(() => {
    setModule('employee');
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, [setModule]);

  useEffect(() => {
    let cancelled = false;

    const initMasters = async () => {
      setMastersLoading(true);
      try {
        const rows = await loadDepartments();
        if (!cancelled && rows.length) {
          await Promise.all(rows.map((dept) => loadDesignationsByDepartment(dept.id)));
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error?.message || 'Failed to load department/designation heads');
        }
      } finally {
        if (!cancelled) setMastersLoading(false);
      }
    };

    initMasters();
    return () => {
      cancelled = true;
    };
  }, []);

  // Ensure `photo` is registered so it is included in submit payload.
  useEffect(() => {
    register('photo');
    register('signature');
    register('cnicFrontDoc');
    register('cnicBackDoc');
  }, [register]);

  useEffect(() => {
    if (!hasOtherBenefit) {
      setValue('otherBenefitText', '');
      setValue('otherBenefitContribution', 0);
    }
  }, [hasOtherBenefit, setValue]);

  useEffect(() => {
    if (!existing) return;

    const existingDepartment = normalizeText(existing.department);
    const existingDesignation = normalizeText(existing.designation || existing.role);

    if (existingDepartment) {
      setDepartmentRecords((prev) => {
        const found = prev.some((item) => normalizeText(item.name).toLowerCase() === existingDepartment.toLowerCase());
        if (found) return prev;
        return [...prev, { id: `legacy-${existingDepartment}`, name: existingDepartment }];
      });
    }

    if (existingDepartment && existingDesignation) {
      setDesignationRecordsByDepartmentId((prev) => {
        const departmentId = selectedDepartmentRecord?.id || `legacy-${existingDepartment}`;
        const current = Array.isArray(prev[departmentId]) ? prev[departmentId] : [];
        const alreadyPresent = current.some(
          (item) => normalizeText(item?.name).toLowerCase() === existingDesignation.toLowerCase()
        );
        if (alreadyPresent) return prev;
        return {
          ...prev,
          [departmentId]: [...current, { id: `legacy-${existingDesignation}`, name: existingDesignation }],
        };
      });
    }
  }, [existing, selectedDepartmentRecord]);

  useEffect(() => {
    if (!selectedDepartmentRecord?.id) return;
    if (designationRecordsByDepartmentId[selectedDepartmentRecord.id]) return;

    loadDesignationsByDepartment(selectedDepartmentRecord.id).catch(() => {
      // already handled in action toasts
    });
  }, [selectedDepartmentRecord, designationRecordsByDepartmentId]);

  useEffect(() => {
    if (!selectedDepartment) return;
    if (!selectedDesignation) return;
    const allowed = designationOptionsForSelectedDepartment;
    if (!allowed.includes(selectedDesignation)) {
      setValue('designation', '');
    }
  }, [selectedDepartment, selectedDesignation, designationOptionsForSelectedDepartment, setValue]);

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      let payload = {
        ...data,
        dutyType: normalizeDutyType(data.dutyType),
      };

      if (payload.dutyType === 'alternative') {
        const altIn = payload.alternativeTimeIn || (payload.isNightShift ? '21:00' : '08:00');
        const altOut = payload.alternativeTimeOut || (payload.isNightShift ? '09:00' : '16:00');
        const hrs = toHoursFromRange(altIn, altOut);

        payload = {
          ...payload,
          dutyRoster: DAYS.map((day, index) => {
            const isOnDay = index % 2 === 0;
            return {
              day,
              splitShift: false,
              shift1End: '15:00',
              shift2Start: '16:00',
              shift1Hours: 0,
              shift2Hours: 0,
              timeIn: isOnDay ? altIn : 'OFF',
              timeOut: isOnDay ? altOut : 'OFF',
              hours: isOnDay ? hrs : 0,
            };
          }),
        };
      }

      if (edit && id) {
        await updateEmployee(id, payload);
        toast.success('Employee updated successfully');
      } else {
        await addEmployee(payload);
        toast.success('Employee added successfully');
      }
      navigate('/employees');
    } catch (error) {
      toast.error(error?.message || 'Failed to save employee data.');
    } finally {
      setSaving(false);
    }
  };

  const onPhotoPick = async (file) => {
    if (!file) return;
    const isAllowed =
      file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/jpg';
    if (!isAllowed) {
      toast.error('Only JPG/PNG allowed');
      return;
    }
    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error('Max file size is 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setValue('photo', reader.result, { shouldDirty: true, shouldValidate: false });
      toast.success('Profile picture selected');
    };
    reader.readAsDataURL(file);
  };

  const onSignaturePick = async (file) => {
    if (!file) return;
    const isAllowed =
      file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/jpg';
    if (!isAllowed) {
      toast.error('Only JPG/PNG allowed');
      return;
    }
    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error('Max file size is 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setValue('signature', reader.result, { shouldDirty: true, shouldValidate: false });
      toast.success('Signature selected');
    };
    reader.readAsDataURL(file);
  };

  const onCnicDocPick = async (file, fieldName, successLabel) => {
    if (!file) return;
    const isAllowed =
      file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/jpg' || file.type === 'application/pdf';
    if (!isAllowed) {
      toast.error('Only JPG/PNG/PDF allowed');
      return;
    }
    const maxBytes = 4 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error('Max file size is 4MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setValue(fieldName, reader.result, { shouldDirty: true, shouldValidate: false });
      toast.success(`${successLabel} selected`);
    };
    reader.readAsDataURL(file);
  };

  const addAllowanceHead = () => {
    const head = String(newAllowanceHead || '').trim();
    if (!head) {
      toast.error('Please enter allowance head name');
      return;
    }

    const exists = allowanceTypeOptions.some(
      (t) => String(t).trim().toLowerCase() === head.toLowerCase()
    );
    if (exists) {
      toast.error('Allowance head already exists');
      return;
    }

    setAllowanceTypeOptions((prev) => [...prev, head]);
    setNewAllowanceHead('');
    toast.success('Allowance head added');
  };

  const addDepartmentHead = () => {
    const run = async () => {
      const head = normalizeText(newDepartmentHead);
      if (!head) {
        toast.error('Please enter department name');
        return;
      }

      const created = await readApiData(await fetch(`${EMPLOYEE_META_API}/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: head }),
      }));

      setDepartmentRecords((prev) => [...prev, created]);
      setDesignationRecordsByDepartmentId((prev) => ({
        ...prev,
        [created.id]: prev[created.id] || [],
      }));
      setValue('department', created.name, { shouldDirty: true });
      setValue('designation', '', { shouldDirty: true });
      setNewDepartmentHead('');
      toast.success('Department head added');
    };

    run().catch((error) => {
      toast.error(error?.message || 'Failed to add department');
    });
  };

  const addDesignationHead = () => {
    const run = async () => {
      const title = normalizeText(newDesignationHead);
      if (!selectedDepartmentRecord?.id) {
        toast.error('Select department first');
        return;
      }
      if (!title) {
        toast.error('Please enter designation name');
        return;
      }

      const created = await readApiData(await fetch(`${EMPLOYEE_META_API}/designations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: selectedDepartmentRecord.id,
          name: title,
        }),
      }));

      setDesignationRecordsByDepartmentId((prev) => {
        const current = Array.isArray(prev[selectedDepartmentRecord.id])
          ? prev[selectedDepartmentRecord.id]
          : [];

        return {
          ...prev,
          [selectedDepartmentRecord.id]: [...current, { id: created.id, name: created.name }],
        };
      });

      setValue('designation', created.name, { shouldDirty: true });
      setNewDesignationHead('');
      toast.success('Designation head added');
    };

    run().catch((error) => {
      toast.error(error?.message || 'Failed to add designation');
    });
  };

  const deleteDesignationHead = () => {
    const run = async () => {
      if (!selectedDepartmentRecord?.id) {
        toast.error('Select department first');
        return;
      }
      if (!selectedDesignation) {
        toast.error('Select designation to delete');
        return;
      }

      const target = selectedDepartmentDesignations.find(
        (item) => normalizeText(item?.name).toLowerCase() === selectedDesignation.toLowerCase()
      );
      if (!target?.id || String(target.id).startsWith('legacy-')) {
        toast.error('Only saved designation can be deleted');
        return;
      }

      const ok = window.confirm(`Delete designation "${selectedDesignation}" from ${selectedDepartment}?`);
      if (!ok) return;

      await readApiData(await fetch(`${EMPLOYEE_META_API}/designations/${target.id}`, {
        method: 'DELETE',
      }));

      setDesignationRecordsByDepartmentId((prev) => {
        const current = Array.isArray(prev[selectedDepartmentRecord.id]) ? prev[selectedDepartmentRecord.id] : [];
        return {
          ...prev,
          [selectedDepartmentRecord.id]: current.filter((item) => item.id !== target.id),
        };
      });

      setValue('designation', '', { shouldDirty: true });
      toast.success('Designation removed');
    };

    run().catch((error) => {
      toast.error(error?.message || 'Failed to delete designation');
    });
  };

  const deleteDepartmentHead = () => {
    const run = async () => {
      if (!selectedDepartmentRecord?.id || String(selectedDepartmentRecord.id).startsWith('legacy-')) {
        toast.error('Select saved department to delete');
        return;
      }

      const ok = window.confirm(`Delete department "${selectedDepartment}" and its linked designations?`);
      if (!ok) return;

      await readApiData(await fetch(`${EMPLOYEE_META_API}/departments/${selectedDepartmentRecord.id}`, {
        method: 'DELETE',
      }));

      setDepartmentRecords((prev) => prev.filter((item) => item.id !== selectedDepartmentRecord.id));
      setDesignationRecordsByDepartmentId((prev) => {
        const next = { ...prev };
        delete next[selectedDepartmentRecord.id];
        return next;
      });
      setValue('department', '', { shouldDirty: true });
      setValue('designation', '', { shouldDirty: true });
      toast.success('Department removed');
    };

    run().catch((error) => {
      toast.error(error?.message || 'Failed to delete department');
    });
  };

  const tabs = [
    { label: 'Personal', icon: User },
    { label: 'Company', icon: Building2 },
    { label: 'Duty Roster', icon: CalendarClock },
    { label: 'Other', icon: BadgeCheck },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="add-employee-page">
      <PageHeader
        breadcrumbs={[
          { link: '/employee-module', label: 'Dashboard' },
          { link: '/employees', label: 'Employees' },
          { label: edit ? 'Edit Employee' : 'Add Employee' },
        ]}
        title={edit ? 'Edit Employee' : 'Add Employee'}
      />
      <div className="tab-progress">
        {tabs.map((t, i) => (
          <div
            key={t.label}
            className={`tab-step ${activeTab >= i ? 'active' : ''} ${activeTab === i ? 'current' : ''}`}
          >
            <span className="step-num">{i + 1}</span>
            <span className="step-label">
              <t.icon className="w-4 h-4" />
              {t.label}
            </span>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
          }
        }}
      >
        {/* Ensures photo is always part of submit payload */}
        <input type="hidden" {...register('photo')} />
    <input type="hidden" {...register('signature')} />
    <input type="hidden" {...register('cnicFrontDoc')} />
    <input type="hidden" {...register('cnicBackDoc')} />
        {activeTab === 0 && (
          <Card title="Personal Information" className="form-card">
            <div className="form-grid">
              <Input label="Employee Code" {...register('empCode', { required: true })} error={errors.empCode?.message} />
              <Input label="First Name" {...register('firstName', { required: 'Required' })} error={errors.firstName?.message} />
              <Input label="Middle Name" {...register('middleName')} />
              <Input label="Last Name" {...register('lastName', { required: 'Required' })} error={errors.lastName?.message} />
              <Input label="Father Name" {...register('fatherName', { required: 'Required' })} error={errors.fatherName?.message} />
              <Input label="Date of Birth" type="date" {...register('dob')} />
              <div>
                <label className="block text-sm font-medium mb-1">Gender *</label>
                <select {...register('gender', { required: true })} className="form-select">
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Marital Status</label>
                <select {...register('maritalStatus')} className="form-select">
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Divorced">Divorced</option>
                </select>
              </div>
              <Input label="Spouse Name" {...register('spouseName')} />
              <Input
                label="NIC"
                placeholder="00000-0000000-0"
                {...register('nic', {
                  required: 'Required',
                  pattern: { value: /^\d{5}-\d{7}-\d$/, message: 'Format: 00000-0000000-0' },
                })}
                error={errors.nic?.message}
              />
              <Input label="CNIC Expiry Date" type="date" {...register('cnicExpiryDate')} />
              <Input label="Birth Place" {...register('birthPlace')} />
              <Input label="Beneficiary Name" {...register('beneficiaryName')} />
              <div>
                <label className="block text-sm font-medium mb-1">Beneficiary Relation</label>
                <select {...register('beneficiaryRelation')} className="form-select">
                  <option value="Spouse">Spouse</option>
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <Input label="Address" {...register('address', { required: 'Required' })} error={errors.address?.message} />
              <Input label="City" {...register('city', { required: 'Required' })} error={errors.city?.message} />
              <Input label="Phone" {...register('phone', { required: 'Required' })} error={errors.phone?.message} />
              <Input label="Email" type="email" {...register('email')} />
              <div>
                <label className="block text-sm font-medium mb-1">CNIC Front Upload</label>
                <div className="doc-upload-row">
                  <input
                    ref={cnicFrontInputRef}
                    type="file"
                    accept="image/png,image/jpeg,application/pdf"
                    className="sr-only"
                    onChange={(e) => onCnicDocPick(e.target.files?.[0], 'cnicFrontDoc', 'CNIC Front')}
                  />
                  <Button
                    type="button"
                    label={cnicFrontDoc ? 'Replace Front' : 'Upload Front'}
                    size="sm"
                    variant="outline"
                    onClick={() => cnicFrontInputRef.current?.click()}
                  />
                  {cnicFrontDoc && (
                    <Button
                      type="button"
                      label="Remove"
                      size="sm"
                      variant="ghost"
                      onClick={() => setValue('cnicFrontDoc', null, { shouldDirty: true })}
                    />
                  )}
                </div>
                <small className="text-slate-500">{cnicFrontDoc ? 'Front document attached' : 'JPG/PNG/PDF, max 4MB'}</small>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">CNIC Back Upload</label>
                <div className="doc-upload-row">
                  <input
                    ref={cnicBackInputRef}
                    type="file"
                    accept="image/png,image/jpeg,application/pdf"
                    className="sr-only"
                    onChange={(e) => onCnicDocPick(e.target.files?.[0], 'cnicBackDoc', 'CNIC Back')}
                  />
                  <Button
                    type="button"
                    label={cnicBackDoc ? 'Replace Back' : 'Upload Back'}
                    size="sm"
                    variant="outline"
                    onClick={() => cnicBackInputRef.current?.click()}
                  />
                  {cnicBackDoc && (
                    <Button
                      type="button"
                      label="Remove"
                      size="sm"
                      variant="ghost"
                      onClick={() => setValue('cnicBackDoc', null, { shouldDirty: true })}
                    />
                  )}
                </div>
                <small className="text-slate-500">{cnicBackDoc ? 'Back document attached' : 'JPG/PNG/PDF, max 4MB'}</small>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Reference 1</label>
                <textarea {...register('reference1')} className="form-textarea" rows={2} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Reference 2</label>
                <textarea {...register('reference2')} className="form-textarea" rows={2} />
              </div>
            </div>
          </Card>
        )}
        {activeTab === 1 && (
          <Card title="Company Information" className="form-card">
            <div className="form-grid">
              <div>
                <label className="block text-sm font-medium mb-1">Designation *</label>
                <select {...register('designation', { required: true })} className="form-select">
                  <option value="">Select</option>
                  {designationOptionsForSelectedDepartment.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <div className="head-adder-row">
                  <input
                    type="text"
                    className="form-input"
                    placeholder={selectedDepartment ? `Add designation for ${selectedDepartment}` : 'Select department first'}
                    value={newDesignationHead}
                    onChange={(e) => setNewDesignationHead(e.target.value)}
                    disabled={!selectedDepartment}
                  />
                  <Button
                    type="button"
                    label="+ Add Designation"
                    size="sm"
                    variant="outline"
                    onClick={addDesignationHead}
                    disabled={!selectedDepartment || mastersLoading}
                  />
                  <Button
                    type="button"
                    label="Delete"
                    size="sm"
                    variant="danger"
                    onClick={deleteDesignationHead}
                    disabled={!selectedDepartment || !selectedDesignation || mastersLoading}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Department *</label>
                <select {...register('department', { required: true })} className="form-select">
                  <option value="">Select</option>
                  {departmentOptions.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <div className="head-adder-row">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Add new department"
                    value={newDepartmentHead}
                    onChange={(e) => setNewDepartmentHead(e.target.value)}
                  />
                  <Button
                    type="button"
                    label="+ Add Department"
                    size="sm"
                    variant="outline"
                    onClick={addDepartmentHead}
                    disabled={mastersLoading}
                  />
                  <Button
                    type="button"
                    label="Delete"
                    size="sm"
                    variant="danger"
                    onClick={deleteDepartmentHead}
                    disabled={!selectedDepartment || mastersLoading}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status *</label>
                <select {...register('status', { required: true })} className="form-select">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <Input label="Appointment Date" type="date" {...register('appointmentDate', { required: true })} />
              <div>
                <label className="block text-sm font-medium mb-1">Weekly Holiday</label>
                <select {...register('weeklyHoliday')} className="form-select">
                  <option value="Sunday">Sunday</option>
                  <option value="Saturday">Saturday</option>
                  <option value="Friday">Friday</option>
                </select>
              </div>
              <div className="col-span-2 flex gap-4">
                <label><input type="checkbox" {...register('late')} /> Late</label>
                <label><input type="checkbox" {...register('short')} /> Short</label>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Monthly Working Days</label>
                <div className="flex gap-4">
                  <label><input type="radio" value="fixed" {...register('workingDays')} /> Fixed</label>
                  <label><input type="radio" value="specified" {...register('workingDays')} /> Specified</label>
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Disbursement Through</label>
                <div className="flex gap-4">
                  <label><input type="radio" value="Cash" {...register('disbursement')} /> Cash</label>
                  <label><input type="radio" value="Bank" {...register('disbursement')} /> Bank</label>
                  <label><input type="radio" value="Cheque" {...register('disbursement')} /> Cheque</label>
                </div>
              </div>
              <Input label="Basic Salary" type="number" {...register('basicSalary', { required: true, valueAsNumber: true })} error={errors.basicSalary?.message} />
              <div className="col-span-2 allowance-section">
                <div className="flex justify-between items-center mb-2">
                  <label className="font-medium">Allowances</label>
                  <Button
                    type="button"
                    label="+ Add Allowance"
                    size="sm"
                    variant="outline"
                    onClick={() => append({ type: '', amount: 0 })}
                  />
                </div>
                <div className="allowance-head-adder mb-2">
                  <input
                    type="text"
                    className="form-input allowance-head-create-input"
                    placeholder="Add new allowance head (e.g. House Rent)"
                    value={newAllowanceHead}
                    onChange={(e) => setNewAllowanceHead(e.target.value)}
                  />
                  <Button
                    type="button"
                    label="+ Add Head"
                    size="sm"
                    variant="outline"
                    onClick={addAllowanceHead}
                  />
                </div>
                <div className="space-y-2">
                  <datalist id="allowanceList">
                    {allowanceTypeOptions.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                  {fields.map((f, i) => (
                    <div key={f.id} className="allowance-row">
                      <input
                        type="text"
                        list="allowanceList"
                        {...register(`allowances.${i}.type`)}
                        className="form-input allowance-type-input"
                        placeholder="Allowance Name (e.g. Dearness, Fuel)"
                      />
                      <input
                        type="number"
                        {...register(`allowances.${i}.amount`, { valueAsNumber: true })}
                        className="form-input allowance-amount-input"
                        placeholder="Amount"
                      />
                      <button type="button" onClick={() => remove(i)} className="text-danger">✕</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="col-span-2 p-4 bg-[#EFF6FF] rounded-lg">
                <strong>Total Salary: PKR {totalSalary.toLocaleString()}</strong>
              </div>
            </div>
          </Card>
        )}
        {activeTab === 2 && (
          <Card title="Duty Roster" className="form-card">
            <div className="mb-4 flex gap-4">
              <label><input type="radio" value="normal" {...register('dutyType')} /> Normal Duty</label>
              <label><input type="radio" value="night" {...register('dutyType')} /> Night Shift</label>
              {/* <label><input type="radio" value="split" {...register('dutyType')} /> Split Shifts</label> */}
              <label><input type="radio" value="alternative" {...register('dutyType')} /> Alternative Shift</label>
            </div>
            
            {/* Alternative Shift Instructions */}
            {dutyType === 'alternative' && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Alternative Shift:</strong> Roster table hide rahegi. Sirf timings set karein — system ON/OFF
                  alternate days khud calculate karega.
                </p>
                
                {/* Night Shift Checkbox */}
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isNightShift"
                    {...nightShiftReg}
                    className="w-4 h-4"
                    onChange={(e) => {
                      nightShiftReg.onChange(e);
                      if (e.target.checked) {
                        setValue('alternativeTimeIn', '21:00');
                        setValue('alternativeTimeOut', '09:00');
                      } else {
                        setValue('alternativeTimeIn', '08:00');
                        setValue('alternativeTimeOut', '16:00');
                      }
                    }}
                  />
                  <label htmlFor="isNightShift" className="text-sm font-medium text-gray-700">
                    Night Shift Enable (Alternative + Night engine)
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Time In</label>
                    <input
                      type="time"
                      {...register('alternativeTimeIn')}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Time Out</label>
                    <input
                      type="time"
                      {...register('alternativeTimeOut')}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {dutyType !== 'alternative' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Day</th>
                    {isSplitDuty ? (
                      <>
                        <th>Split Shift</th>
                        <th>Shift 1 In</th>
                        <th>Shift 1 Out</th>
                        <th>Shift 1 Hrs</th>
                        <th>Shift 2 In</th>
                        <th>Shift 2 Out</th>
                        <th>Shift 2 Hrs</th>
                        <th>Total Hrs</th>
                      </>
                    ) : (
                      <>
                        <th>Time In</th>
                        <th>Time Out</th>
                        <th>Hours</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rosterFields.map((f, i) => (
                    <tr key={f.id}>
                      <td>{watch(`dutyRoster.${i}.day`)}</td>
                      {isSplitDuty ? (
                        <>
                          <td>
                            <input
                              type="checkbox"
                              {...register(`dutyRoster.${i}.splitShift`)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              {...register(`dutyRoster.${i}.timeIn`)}
                              className="form-input w-24"
                              placeholder="08:00 or OFF"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              {...register(`dutyRoster.${i}.shift1End`)}
                              className="form-input w-24"
                              placeholder="15:00"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              {...register(`dutyRoster.${i}.shift1Hours`, { valueAsNumber: true })}
                              className="form-input w-16"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              {...register(`dutyRoster.${i}.shift2Start`)}
                              className="form-input w-24"
                              placeholder="16:00"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              {...register(`dutyRoster.${i}.timeOut`)}
                              className="form-input w-24"
                              placeholder="23:00 or OFF"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              {...register(`dutyRoster.${i}.shift2Hours`, { valueAsNumber: true })}
                              className="form-input w-16"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              {...register(`dutyRoster.${i}.hours`, { valueAsNumber: true })}
                              className="form-input w-16"
                              placeholder="8"
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            <input
                              type="text"
                              {...register(`dutyRoster.${i}.timeIn`)}
                              className="form-input w-24"
                              placeholder="08:00 or OFF"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              {...register(`dutyRoster.${i}.timeOut`)}
                              className="form-input w-24"
                              placeholder="16:00 or OFF"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              {...register(`dutyRoster.${i}.hours`, { valueAsNumber: true })}
                              className="form-input w-16"
                              placeholder="8"
                            />
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </Card>
        )}
        {activeTab === 3 && (
          <Card title="Other Details" className="form-card">
            <div className="form-grid">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Profile Picture</label>
                <div
                  className="border-2 border-dashed border-[#E2E8F0] rounded-lg p-6 text-center text-[#64748B] cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    onPhotoPick(e.dataTransfer.files?.[0]);
                  }}
                >
                  {/* Keep file input *not* display:none so Safari allows programmatic click */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="sr-only"
                    onChange={(e) => onPhotoPick(e.target.files?.[0])}
                  />
                  {photo ? (
                    <div className="flex flex-col items-center gap-3">
                      <img
                        src={photo}
                        alt="Preview"
                        className="w-28 h-28 rounded-full object-cover border border-[#E2E8F0]"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          label="Change"
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                        />
                        <Button
                          type="button"
                          label="Remove"
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setValue('photo', null);
                          }}
                        />
                      </div>
                      <p className="text-xs text-[#64748B]">jpg/png, max 2MB</p>
                    </div>
                  ) : (
                    <div>
                      <div className="mx-auto w-12 h-12 rounded-full bg-[#2563EB]/10 flex items-center justify-center mb-3">
                        <Camera className="w-6 h-6 text-[#2563EB]" />
                      </div>
                      <p className="font-medium text-[#0F172A]">Drag & drop or click to upload</p>
                      <p className="text-sm">jpg/png, max 2MB</p>
                    </div>
                  )}
                </div>
              </div>
              <Input label="Emergency Contact Name" {...register('emergencyContact')} />
              <Input label="Emergency Contact Phone" {...register('emergencyPhone')} />
              <Input label="Emergency Relation" {...register('emergencyRelation')} />
              <Input label="Bank Name" {...register('bankName')} />
              <Input label="Bank Account Number/IBAN" {...register('bankAccountNumber')} />
              <Input label="Account Title" {...register('accountTitle')} />

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">Employee Benefits / Enrollment</label>
                <div className="benefits-grid">
                  <label className="benefit-item"><input type="checkbox" {...register('hasEobi')} /> EOBI</label>
                  <Input label="EOBI Monthly Contribution" type="number" {...register('eobiContribution', { valueAsNumber: true })} />

                  <label className="benefit-item"><input type="checkbox" {...register('hasSocialSecurity')} /> SESSI / Social Security</label>
                  <Input label="SESSI Monthly Contribution" type="number" {...register('socialSecurityContribution', { valueAsNumber: true })} />

                  <label className="benefit-item"><input type="checkbox" {...register('hasHealthCard')} /> Health Card</label>
                  <Input label="Health Card Monthly Contribution" type="number" {...register('healthCardContribution', { valueAsNumber: true })} />

                  <label className="benefit-item"><input type="checkbox" {...register('hasOtherBenefit')} /> Other</label>
                  <Input
                    label="Other Monthly Contribution"
                    type="number"
                    {...register('otherBenefitContribution', { valueAsNumber: true })}
                    disabled={!hasOtherBenefit}
                  />
                </div>
                <Input
                  label="Other Benefit Name"
                  {...register('otherBenefitText')}
                  disabled={!hasOtherBenefit}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Employee Signature</label>
                <div
                  className="border-2 border-dashed border-[#E2E8F0] rounded-lg p-4 text-center text-[#64748B] cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                  onClick={() => signatureInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    onSignaturePick(e.dataTransfer.files?.[0]);
                  }}
                >
                  <input
                    ref={signatureInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="sr-only"
                    onChange={(e) => onSignaturePick(e.target.files?.[0])}
                  />

                  {signature ? (
                    <div className="flex flex-col items-center gap-3">
                      <img
                        src={signature}
                        alt="Signature Preview"
                        className="h-20 object-contain border border-[#E2E8F0] bg-white px-2"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          label="Change"
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            signatureInputRef.current?.click();
                          }}
                        />
                        <Button
                          type="button"
                          label="Remove"
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setValue('signature', null);
                          }}
                        />
                      </div>
                      <p className="text-xs text-[#64748B]">jpg/png, max 2MB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium text-[#0F172A]">Drag & drop or click to upload signature</p>
                      <p className="text-sm">jpg/png, max 2MB</p>
                    </div>
                  )}
                </div>
              </div>


              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Additional Notes</label>
                <textarea {...register('notes')} className="form-textarea" rows={4} />
              </div>
            </div>
          </Card>
        )}
        <div className="form-actions">
          <Button
            type="button"
            label="← Previous"
            variant="outline"
            disabled={activeTab === 0}
            onClick={() => setActiveTab((t) => Math.max(0, t - 1))}
          />
          {activeTab < 3 ? (
            <Button
              type="button"
              label="Next →"
              onClick={() => setActiveTab((t) => t + 1)}
            />
          ) : (
            <Button 
              type="button" 
              label="💾 Save" 
              loading={saving} 
              onClick={handleSubmit(onSubmit)} 
            />
          )}
        </div>
      </form>
    </div>
  );
}
