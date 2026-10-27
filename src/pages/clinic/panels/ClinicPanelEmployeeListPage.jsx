import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import PageHeader from '../../../components/shared/PageHeader';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { useClinicStore } from '../../../store/useClinicStore';
import '../parameters/ClinicParameterPage.scss';
import { useShallow } from 'zustand/react/shallow';
import usePagedList from '../../../hooks/usePagedList';
import ShowMoreFooter from '../../../components/reports/ShowMoreFooter';
import SearchableSelect from '../../../components/ui/SearchableSelect';

export default function ClinicPanelEmployeeListPage() {
  const { panelEmployees, loading, fetchPanelEmployees, deletePanelEmployee, panelCompanies, fetchPanelCompanies } = useClinicStore(useShallow((s) => ({ panelEmployees: s.panelEmployees, loading: s.loading, fetchPanelEmployees: s.fetchPanelEmployees, deletePanelEmployee: s.deletePanelEmployee, panelCompanies: s.panelCompanies, fetchPanelCompanies: s.fetchPanelCompanies })));
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [companyId, setCompanyId] = useState('ALL');
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { fetchPanelEmployees(); fetchPanelCompanies(); }, [fetchPanelEmployees, fetchPanelCompanies]);

  // Company filter + search (owner, 2026-10-27): pick a Company to see only
  // its employees. Every word typed must match the code, name or company —
  // "mohsin pcsir" finds the Mohsin of P.C.S.I.R, not every Mohsin.
  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const squash = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return panelEmployees.filter((e) => {
      if (companyId !== 'ALL' && String(e.companyId ?? e.company?.id) !== String(companyId)) return false;
      if (!words.length) return true;
      const text = `${e.empCode} ${e.name} ${e.company?.code || ''} ${e.company?.name || ''}`.toLowerCase();
      const flat = squash(text);
      return words.every((w) => text.includes(w) || (squash(w) && flat.includes(squash(w))));
    });
  }, [panelEmployees, query, companyId]);

  // Search runs over all employees; only 300 matches are drawn at a time
  // (3k+ rows made the page slow). Page 1 again when the search changes.
  const page = usePagedList(filtered.length, `${query}|${companyId}`);
  const visible = useMemo(() => (page.limit >= filtered.length ? filtered : filtered.slice(0, page.limit)), [filtered, page.limit]);

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
          <SearchableSelect
            options={[{ id: 'ALL' }, ...panelCompanies]}
            value={companyId}
            onChange={(v) => setCompanyId(v || 'ALL')}
            getKey={(c) => c.id}
            getLabel={(c) => (c.id === 'ALL' ? '— Sab companies —' : `${c.code} — ${c.name}`)}
            clearable={false}
            size="sm"
            style={{ width: 280 }}
          />
          <div className="cpp-search">
            <Search className="cpp-search-icon" />
            <input
              type="text"
              placeholder="Search by code or name..."
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
                {visible.map((emp, i) => (
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
          {!loading && <ShowMoreFooter {...page} noun="records" />}
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
