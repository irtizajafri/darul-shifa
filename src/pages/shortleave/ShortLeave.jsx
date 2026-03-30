import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useModuleStore } from '../../store/useModuleStore';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import PageLoader from '../../components/ui/PageLoader';
import PageHeader from '../../components/shared/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import toast from 'react-hot-toast';
import './ShortLeave.scss';

export default function ShortLeave() {
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [records, setRecords] = useState([]);
  const { setModule } = useModuleStore();
  const { employees, fetchEmployees } = useEmployeeStore();

  const { register, handleSubmit, watch, reset } = useForm();
  const empCode = watch('empCode');
  const selectedEmployee = employees.find((e) => String(e.empCode) === String(empCode));

  const STORAGE_KEY = 'shortLeaveRecords';
  const loadRecords = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  };
  const saveRecords = (next) => {
    setRecords(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    setModule('employee');
    Promise.all([fetchEmployees()]).then(() => {
      setRecords(loadRecords());
      setLoading(false);
    });
  }, [setModule, fetchEmployees]);

  const onSave = (data) => {
    if (!selectedEmployee) {
      toast.error('Employee not found');
      return;
    }
    const next = [
      {
        id: Date.now(),
        empCode: selectedEmployee.empCode,
        name: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`.trim(),
        date: data.date,
        timeOut: data.timeOut,
        timeIn: data.timeIn,
        purpose: data.purpose,
        permissionBy: data.permissionBy,
        status: 'Approved'
      },
      ...records
    ];
    saveRecords(next);
    toast.success('Short leave recorded');
    setModalOpen(false);
    reset();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="shortleave-page">
      <PageHeader
        breadcrumbs={[
          { link: '/employee-module', label: 'Dashboard' },
          { label: 'Short Leave' },
        ]}
        title="Short Leave"
        actionLabel="+ New Short Leave"
        onAction={() => setModalOpen(true)}
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sr</th>
                <th>Code</th>
                <th>Name</th>
                <th>Date</th>
                <th>Out</th>
                <th>In</th>
                <th>Purpose</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((s, i) => (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <td>{s.empCode}</td>
                  <td>{s.name}</td>
                  <td>{s.date}</td>
                  <td>{s.timeOut}</td>
                  <td>{s.timeIn}</td>
                  <td>{s.purpose}</td>
                  <td>
                    <Badge label={s.status} variant={s.status === 'Approved' ? 'success' : 'warning'} />
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
        title="New Short Leave"
        size="md"
      >
        <form onSubmit={handleSubmit(onSave)}>
          <Input label="Employee Code" {...register('empCode', { required: true })} />
          <div className="form-group mt-4">
            <label>Name (auto-fill)</label>
            <input
              type="text"
              className="form-input"
              readOnly
              value={selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : ''}
            />
          </div>
          <Input label="Permission By" {...register('permissionBy', { required: true })} />
          <div className="form-row">
            <Input label="Date" type="date" {...register('date', { required: true })} />
            <Input label="Time Out" type="time" {...register('timeOut', { required: true })} />
            <Input label="Time In" type="time" {...register('timeIn')} />
          </div>
          <div className="form-group">
            <label>Purpose *</label>
            <textarea {...register('purpose', { required: true })} className="form-textarea" rows={3} />
          </div>
          <div className="modal-actions">
            <Button type="button" label="Close" variant="ghost" onClick={() => setModalOpen(false)} />
            <Button type="button" label="Print" variant="outline" />
            <Button type="submit" label="Save" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
