import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import PageHeader from '../../../components/shared/PageHeader';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { useClinicStore } from '../../../store/useClinicStore';
import './ClinicParameterPage.scss';

export default function ClinicBillHeadListPage() {
  const { billHeads, loading, fetchBillHeads, deleteBillHead } = useClinicStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { fetchBillHeads(); }, [fetchBillHeads]);

  const filtered = billHeads.filter((b) =>
    b.headCode.toLowerCase().includes(query.toLowerCase()) ||
    b.description?.toLowerCase().includes(query.toLowerCase())
  );

  async function handleDelete(bh) {
    try {
      await deleteBillHead(bh.id);
      toast.success('Bill Head deleted');
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
            { label: 'Parameters' },
            { label: 'Bill Heads' },
          ]}
          title="Bill Heads"
          actionLabel="Add Bill Head"
          actionIcon={Plus}
          onAction={() => navigate('/clinic/parameters/bill-heads/new')}
        />

        <div className="cpp-toolbar">
          <div className="cpp-search">
            <Search className="cpp-search-icon" />
            <input
              type="text"
              placeholder="Search bill heads..."
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
            <p className="cpp-empty">No bill heads found.</p>
          ) : (
            <table className="cpp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Head Code</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Ref. Department</th>
                  <th>Status</th>
                  <th className="cpp-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((bh, i) => (
                  <tr key={bh.id}>
                    <td className="cpp-num">{i + 1}</td>
                    <td><strong>{bh.headCode}</strong></td>
                    <td>{bh.description}</td>
                    <td style={{ textTransform: 'capitalize' }}>{bh.type === 'both' ? 'Both' : bh.type === 'provisional' ? 'Provisional Bill' : 'Final Bill'}</td>
                    <td>{bh.refDepartment?.name || '—'}</td>
                    <td>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: bh.status === 'active' ? '#dcfce7' : '#fee2e2',
                        color: bh.status === 'active' ? '#16a34a' : '#dc2626',
                      }}>{bh.status === 'active' ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="cpp-actions">
                      <button className="cpp-btn-icon cpp-edit" onClick={() => navigate(`/clinic/parameters/bill-heads/${bh.id}`)} title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button className="cpp-btn-icon cpp-delete" onClick={() => setConfirmDelete(bh)} title="Delete">
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

      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Bill Head" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete bill head <strong>{confirmDelete?.headCode}</strong>?
        </p>
        <div className="flex justify-end gap-2">
          <Button label="Cancel" variant="secondary" onClick={() => setConfirmDelete(null)} />
          <Button label="Delete" variant="danger" onClick={() => handleDelete(confirmDelete)} />
        </div>
      </Modal>
    </div>
  );
}
