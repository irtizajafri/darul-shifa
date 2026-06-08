import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import PageHeader from '../../../components/shared/PageHeader';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { useClinicStore } from '../../../store/useClinicStore';
import '../parameters/ClinicParameterPage.scss';

export default function ClinicPanelEmployeeListPage() {
  const { panelEmployees, loading, fetchPanelEmployees, deletePanelEmployee } = useClinicStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { fetchPanelEmployees(); }, [fetchPanelEmployees]);

  const filtered = panelEmployees.filter((e) =>
    e.empCode.toLowerCase().includes(query.toLowerCase()) ||
    e.name.toLowerCase().includes(query.toLowerCase()) ||
    (e.company?.name || '').toLowerCase().includes(query.toLowerCase())
  );

  async function handleDelete(emp) {
    try {
      await deletePanelEmployee(emp.id);
      toast.success('Panel Employee deleted');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div className="clinic-parameter-page">
      <ClinicMenuBar />
      <div className="cpp-body">
        <PageHeader
          breadcrumbs={[
            { label: 'Clinic', link: '/clinic-module' },
            { label: 'Panels' },
            { label: 'Parameter' },
            { label: 'Panel Employees' },
          ]}
          title="Panel Employees"
          actionLabel="Add Panel Employee"
          actionIcon={Plus}
          onAction={() => navigate('/clinic/panels/employees/new')}
        />

        <div className="cpp-toolbar">
          <div className="cpp-search">
            <Search className="cpp-search-icon" />
            <input
              type="text"
              placeholder="Search by code, name or company..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="cpp-search-input"
            />
          </div>
          <span className="cpp-count">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="cpp-table-wrap">
          {loading ? (
            <p className="cpp-empty">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="cpp-empty">No panel employees found.</p>
          ) : (
            <table className="cpp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Emp. Code</th>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Gender</th>
                  <th>Entitlement</th>
                  <th>Status</th>
                  <th className="cpp-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp, i) => (
                  <tr key={emp.id}>
                    <td className="cpp-num">{i + 1}</td>
                    <td><strong>{emp.empCode}</strong></td>
                    <td>{emp.title} {emp.name}</td>
                    <td>{emp.company?.code} — {emp.company?.name}</td>
                    <td style={{ textTransform: 'capitalize' }}>{emp.gender}</td>
                    <td style={{ textTransform: 'capitalize' }}>{emp.entitlement}</td>
                    <td>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: emp.status === 'active' ? '#dcfce7' : '#fee2e2',
                        color: emp.status === 'active' ? '#16a34a' : '#dc2626',
                      }}>{emp.status === 'active' ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="cpp-actions">
                      <button className="cpp-btn-icon cpp-edit" onClick={() => navigate(`/clinic/panels/employees/${emp.id}`)} title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button className="cpp-btn-icon cpp-delete" onClick={() => setConfirmDelete(emp)} title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Panel Employee" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete panel employee <strong>{confirmDelete?.empCode} — {confirmDelete?.name}</strong>?
        </p>
        <div className="flex justify-end gap-2">
          <Button label="Cancel" variant="secondary" onClick={() => setConfirmDelete(null)} />
          <Button label="Delete" variant="danger" onClick={() => handleDelete(confirmDelete)} />
        </div>
      </Modal>
    </div>
  );
}
