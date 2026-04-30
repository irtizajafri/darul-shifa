import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Pencil, Trash2, UserPlus } from 'lucide-react';
import { useModuleStore } from '../../store/useModuleStore';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import PageLoader from '../../components/ui/PageLoader';
import PageHeader from '../../components/shared/PageHeader';
import DataTable from '../../components/shared/DataTable';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import { formatDate } from '../../utils/helpers';
import './EmployeeList.scss';

export default function EmployeeList() {
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState('');
  const [filterDesig, setFilterDesig] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [deleteModal, setDeleteModal] = useState(null);
  const { setModule } = useModuleStore();
  const navigate = useNavigate();
  const { employees, deleteEmployee, fetchEmployees } = useEmployeeStore();

  useEffect(() => {
    setModule('employee');
    fetchEmployees().then(() => setLoading(false));
  }, [setModule, fetchEmployees]);

  const filteredData = useMemo(() => {
    return employees.filter((e) => {
      const matchSearch =
        !search ||
        e.empCode?.toLowerCase().includes(search.toLowerCase()) ||
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase());
      const matchDept = !filterDept || e.department === filterDept;
      const matchDesig = !filterDesig || e.designation === filterDesig;
      const matchStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && e.status === 'Active') ||
        (filterStatus === 'inactive' && e.status === 'Inactive');
      return matchSearch && matchDept && matchDesig && matchStatus;
    });
  }, [employees, search, filterDept, filterDesig, filterStatus]);

  const departmentOptions = useMemo(() => {
    const values = employees
      .map((e) => String(e.department || '').trim())
      .filter(Boolean);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const designationOptions = useMemo(() => {
    const values = employees
      .map((e) => String(e.designation || '').trim())
      .filter(Boolean);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const columns = [
    { header: 'Emp Code', accessorKey: 'empCode', cell: (info) => info.getValue() },
    {
      header: 'Name',
      accessorKey: 'firstName',
      cell: (info) => {
        const row = info.row.original;
        const seed = encodeURIComponent(`${row.firstName || ''} ${row.lastName || ''}`.trim() || row.empCode || 'employee');
        const fallbackAvatar = `https://api.dicebear.com/8.x/initials/svg?seed=${seed}&backgroundColor=eff6ff&textColor=2563eb`;
        return (
          <div className="flex items-center gap-3">
            <img
              src={row.photo || fallbackAvatar}
              alt=""
              className="w-8 h-8 rounded-full object-cover border border-[#E2E8F0] bg-white"
              loading="lazy"
            />
            <span>{row.firstName} {row.lastName}</span>
          </div>
        );
      },
    },
    { header: 'Department', accessorKey: 'department' },
    { header: 'Designation', accessorKey: 'designation' },
    { header: 'Contact', accessorKey: 'phone' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (info) => (
        <Badge
          label={info.getValue()}
          variant={info.getValue() === 'Active' ? 'success' : 'danger'}
        />
      ),
    },
    { header: 'Joining Date', accessorKey: 'joiningDate', cell: (info) => formatDate(info.getValue()) },
    {
      header: 'Actions',
      id: 'actions',
      cell: (info) => {
        const row = info.row.original;
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/employees/${row.id}`)}
              className="p-1.5 rounded hover:bg-[#EFF6FF] text-[#64748B] hover:text-[#2563EB]"
              title="View"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate(`/employees/${row.id}/edit`)}
              className="p-1.5 rounded hover:bg-[#EFF6FF] text-[#64748B] hover:text-[#2563EB]"
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeleteModal(row)}
              className="p-1.5 rounded hover:bg-[#FEF2F2] text-[#64748B] hover:text-[#EF4444]"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  const handleDelete = () => {
    if (deleteModal) {
      console.log('Delete employee:', deleteModal.id);
      deleteEmployee(deleteModal.id);
      toast.success('Employee deleted successfully');
      setDeleteModal(null);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setFilterDept('');
    setFilterDesig('');
    setFilterStatus('all');
  };

  if (loading) return <PageLoader />;

  return (
    <div className="employee-list-page">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', link: '/employee-module' },
          { label: 'Employee Mgmt', link: '/employee-module' },
          { label: 'Employees' },
        ]}
        title="Employee Database"
        actionLabel="+ Add Employee"
        actionIcon={UserPlus}
        onAction={() => navigate('/employees/add')}
      />
      <div className="filters-bar">
        <input
          type="text"
          placeholder="Search by name or emp code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-input"
        />
        <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="filter-select">
          <option value="">All Departments</option>
          {departmentOptions.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={filterDesig} onChange={(e) => setFilterDesig(e.target.value)} className="filter-select">
          <option value="">All Designations</option>
          {designationOptions.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <div className="status-pills">
          {['all', 'active', 'inactive'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`pill ${filterStatus === s ? 'active' : ''}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        {/* <Button label="Reset" variant="ghost" onClick={resetFilters} /> */}
      </div>
      <DataTable
        columns={columns}
        data={filteredData}
        searchPlaceholder="Search employees..."
      />
      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Confirm Delete"
      >
        {deleteModal && (
          <div>
            <p>Are you sure you want to delete {deleteModal.firstName} {deleteModal.lastName}?</p>
            <div className="modal-actions">
              <Button label="Cancel" variant="ghost" onClick={() => setDeleteModal(null)} />
              <Button label="Delete" variant="danger" onClick={handleDelete} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
