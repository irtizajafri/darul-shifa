import { useRef, useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useModuleStore } from '../../store/useModuleStore';
import { departments, designations, allowanceTypes } from '../../utils/dummyData';
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

export default function AddEmployee({ edit }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const { id } = useParams();
  const { setModule } = useModuleStore();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const { employees, getEmployeeById, getNextEmpCode, addEmployee, updateEmployee } =
    useEmployeeStore();

  const existing = edit && id ? getEmployeeById(id) : null;

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
          dutyType: 'normal',
          dutyRoster: DAYS.map((d, i) => ({
            day: d,
            timeIn: i < 6 ? '08:00' : 'OFF',
            timeOut: i < 6 ? '16:00' : 'OFF',
            hours: i < 6 ? 8 : 0,
          })),
        }
      : {
          empCode: getNextEmpCode(),
          allowances: [],
          photo: null,
          dutyType: 'normal',
          dutyRoster: DAYS.map((d, i) => ({
            day: d,
            timeIn: i < 6 ? '08:00' : 'OFF',
            timeOut: i < 6 ? '16:00' : 'OFF',
            hours: i < 6 ? 8 : 0,
          })),
        },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'allowances' });
  const { fields: rosterFields } = useFieldArray({ control, name: 'dutyRoster' });

  const basicSalary = watch('basicSalary') || 0;
  const allowances = watch('allowances') || [];
  const totalSalary = getTotalSalary(basicSalary, allowances);
  const photo = watch('photo');

  useEffect(() => {
    setModule('employee');
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, [setModule]);

  // Ensure `photo` is registered so it is included in submit payload.
  useEffect(() => {
    register('photo');
  }, [register]);

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      if (edit && id) {
        await updateEmployee(id, data);
        toast.success('Employee updated successfully');
      } else {
        await addEmployee(data);
        toast.success('Employee added successfully');
      }
      navigate('/employees');
    } catch (error) {
      toast.error('Failed to save employee data.');
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
                  {designations.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Department *</label>
                <select {...register('department', { required: true })} className="form-select">
                  <option value="">Select</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
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
              <div className="col-span-2">
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
                <div className="space-y-2">
                  <datalist id="allowanceList">
                    {allowanceTypes.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                  {fields.map((f, i) => (
                    <div key={f.id} className="flex gap-2 items-center">
                      <input
                        type="text"
                        list="allowanceList"
                        {...register(`allowances.${i}.type`)}
                        className="form-input flex-1"
                        placeholder="Allowance Name (e.g. Dearness, Fuel)"
                      />
                      <input
                        type="number"
                        {...register(`allowances.${i}.amount`, { valueAsNumber: true })}
                        className="form-input w-32"
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
              <label><input type="radio" value="alternate" {...register('dutyType')} /> Alternate Duty</label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Time In</th>
                    <th>Time Out</th>
                    <th>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {rosterFields.map((f, i) => (
                    <tr key={f.id}>
                      <td>{watch(`dutyRoster.${i}.day`)}</td>
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
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
