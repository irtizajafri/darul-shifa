import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Power, X } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import PageHeader from '../../../components/shared/PageHeader';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { useClinicStore } from '../../../store/useClinicStore';
import './ClinicParameterPage.scss';
import './ClinicPanelBillHeadListPage.scss';

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Panels > Parameter > Bill Head — a bill-head list independent of the main
// Clinic Bill Heads, only ever offered inside Panel Billing's manual-add flow.
// 'simple' heads are just a name (Qty/Rate entered freely when added to a
// bill). 'package' heads (e.g. "Surgery") carry their own medicine+rate list
// below — adding one to a bill opens a checklist so only the medicines that
// actually applied get added, each as its own row.
export default function ClinicPanelBillHeadListPage() {
  const {
    panelBillHeads, loading, fetchPanelBillHeads, createPanelBillHead, updatePanelBillHead, deletePanelBillHead,
    addPanelBillHeadItem, deletePanelBillHeadItem,
  } = useClinicStore();

  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState('simple');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Package-medicine sub-form (only shown once the head being edited is a 'package')
  const [medName, setMedName] = useState('');
  const [medRate, setMedRate] = useState('');
  const [addingMed, setAddingMed] = useState(false);

  useEffect(() => { fetchPanelBillHeads(); }, [fetchPanelBillHeads]);

  const filtered = panelBillHeads.filter((h) =>
    h.description.toLowerCase().includes(query.toLowerCase()) || h.headCode.toLowerCase().includes(query.toLowerCase())
  );

  function openAdd() {
    setEditing(null);
    setDescription('');
    setKind('simple');
    setShowModal(true);
  }

  function openEdit(head) {
    setEditing(head);
    setDescription(head.description);
    setKind(head.kind);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setDescription('');
    setKind('simple');
    setMedName('');
    setMedRate('');
  }

  async function handleSave() {
    if (!description.trim()) return toast.error('Naam zaroori hai');
    setSaving(true);
    try {
      if (editing) {
        const updated = await updatePanelBillHead(editing.id, { description });
        setEditing(updated); // keep modal open (esp. for packages) so medicines can be managed right after
        toast.success('Head updated');
      } else {
        const created = await createPanelBillHead({ description, kind });
        if (kind === 'package') {
          setEditing(created); // stay open to add medicines immediately
          toast.success('Head banaya — ab medicines add karo');
        } else {
          toast.success('Head banaya');
          closeModal();
        }
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(head) {
    try {
      await updatePanelBillHead(head.id, { status: head.status === 'active' ? 'inactive' : 'active' });
      toast.success(head.status === 'active' ? 'Head disabled' : 'Head enabled');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDelete(head) {
    try {
      await deletePanelBillHead(head.id);
      toast.success('Head deleted');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConfirmDelete(null);
    }
  }

  async function handleAddMedicine() {
    if (!medName.trim()) return toast.error('Medicine ka naam likho');
    const rate = Number(medRate);
    if (!Number.isFinite(rate) || rate < 0) return toast.error('Rate valid honi chahiye');
    setAddingMed(true);
    try {
      const row = await addPanelBillHeadItem(editing.id, { medicine: medName, rate });
      setEditing((h) => ({ ...h, packageItems: [...h.packageItems, row] }));
      setMedName('');
      setMedRate('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAddingMed(false);
    }
  }

  async function handleDeleteMedicine(itemId) {
    try {
      await deletePanelBillHeadItem(itemId);
      setEditing((h) => ({ ...h, packageItems: h.packageItems.filter((i) => i.id !== itemId) }));
    } catch (err) {
      toast.error(err.message);
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
            { label: 'Bill Head' },
          ]}
          title="Panel Bill Head"
          actionLabel="Add Head"
          actionIcon={Plus}
          onAction={openAdd}
        />

        <div className="cpp-toolbar">
          <div className="cpp-search">
            <Search className="cpp-search-icon" />
            <input
              type="text"
              placeholder="Search heads..."
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
            <p className="cpp-empty">No panel bill heads found.</p>
          ) : (
            <table className="cpp-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Kind</th>
                  <th>Status</th>
                  <th className="cpp-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((head) => (
                  <tr key={head.id}>
                    <td>{head.headCode}</td>
                    <td>{head.description}</td>
                    <td>
                      <span className={`pbh-kind-badge ${head.kind === 'package' ? 'pbh-kind-badge--package' : ''}`}>
                        {head.kind === 'package' ? `Medicine Package (${head.packageItems.length})` : 'Simple'}
                      </span>
                    </td>
                    <td>
                      <span className={`cpp-status-badge ${head.status === 'active' ? 'cpp-status-badge--active' : 'cpp-status-badge--inactive'}`}>
                        {head.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="cpp-actions">
                      <button className="cpp-btn-icon" onClick={() => toggleStatus(head)} title={head.status === 'active' ? 'Disable' : 'Enable'}>
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button className="cpp-btn-icon cpp-edit" onClick={() => openEdit(head)} title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button className="cpp-btn-icon cpp-delete" onClick={() => setConfirmDelete(head)} title="Remove">
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

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Edit Bill Head' : 'Add Bill Head'} size={kind === 'package' || editing?.kind === 'package' ? 'md' : 'sm'}>
        <div className="flex flex-col gap-4">
          <Input
            label="Head Name"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Surgery"
            onKeyDown={(e) => e.key === 'Enter' && !editing?.kind && handleSave()}
          />

          {!editing && (
            <div className="pbh-kind-select">
              <label className={`pbh-kind-opt ${kind === 'simple' ? 'pbh-kind-opt--active' : ''}`}>
                <input type="radio" checked={kind === 'simple'} onChange={() => setKind('simple')} />
                Simple Head
              </label>
              <label className={`pbh-kind-opt ${kind === 'package' ? 'pbh-kind-opt--active' : ''}`}>
                <input type="radio" checked={kind === 'package'} onChange={() => setKind('package')} />
                Medicine Package
              </label>
            </div>
          )}

          {(editing?.kind === 'package') && (
            <div className="pbh-package-editor">
              <div className="pbh-package-title">Medicines in this package</div>
              <div className="pbh-package-add-row">
                <input placeholder="Medicine name" value={medName} onChange={(e) => setMedName(e.target.value)} />
                <input placeholder="Rate" value={medRate} onChange={(e) => setMedRate(e.target.value)} className="pbh-rate-input" />
                <button className="pbh-add-med-btn" onClick={handleAddMedicine} disabled={addingMed}><Plus size={13} /> Add</button>
              </div>
              <div className="pbh-package-list">
                {editing.packageItems.length === 0 ? (
                  <div className="pbh-package-empty">Abhi koi medicine nahi — upar se add karo.</div>
                ) : editing.packageItems.map((it) => (
                  <div key={it.id} className="pbh-package-row">
                    <span className="pbh-med-name">{it.medicine}</span>
                    <span className="pbh-med-rate">Rs. {fmt(it.rate)}</span>
                    <button onClick={() => handleDeleteMedicine(it.id)} title="Remove"><X size={13} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button label="Close" variant="secondary" onClick={closeModal} />
            <Button label={editing ? 'Save Name' : 'Create'} onClick={handleSave} loading={saving} />
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Remove Bill Head" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Remove <strong>{confirmDelete?.description}</strong>{confirmDelete?.kind === 'package' ? ` (${confirmDelete.packageItems.length} medicines) ` : ' '}
          — pehle se kisi bill me manually add ki hui rows par asar nahi padega (wo apni jagah rehti hain), sirf yeh head aage select nahi ho sakega.
        </p>
        <div className="flex justify-end gap-2">
          <Button label="Cancel" variant="secondary" onClick={() => setConfirmDelete(null)} />
          <Button label="Remove" variant="danger" onClick={() => handleDelete(confirmDelete)} />
        </div>
      </Modal>
    </div>
  );
}
