import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, DoorOpen, Upload, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClinicStore } from '../../store/useClinicStore';
import { useAuthStore } from '../../store/useAuthStore';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import './UploadPatientDocument.scss';

const FILES_BASE = 'http://localhost:5001/uploads/';

function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  const day   = String(dt.getDate()).padStart(2, '0');
  const month = dt.toLocaleString('en-GB', { month: 'short' });
  const year  = dt.getFullYear();
  const time  = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${day}-${month}-${year} ${time}`;
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadPatientDocument() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const uploadedBy = user?.name || user?.username || user?.email || '';
  const {
    documentTypes, fetchDocumentTypes,
    searchAdmissionsForDocuments,
    fetchPatientDocuments,
    uploadPatientDocument,
  } = useClinicStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState([]);

  const [admission, setAdmission] = useState(null);
  const [docs, setDocs] = useState([]);
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { fetchDocumentTypes(); }, [fetchDocumentTypes]);

  async function handleSearch() {
    setSearching(true);
    try {
      const rows = await searchAdmissionsForDocuments(searchTerm.trim());
      setResults(rows || []);
      setSearched(true);
    } catch {
      toast.error('Search fail hui');
    } finally {
      setSearching(false);
    }
  }

  async function loadDocs(admissionId) {
    try { setDocs(await fetchPatientDocuments(admissionId)); } catch { setDocs([]); }
  }

  async function handleSelect(row) {
    setAdmission(row);
    setDocumentTypeId('');
    setFile(null);
    await loadDocs(row.id);
  }

  function resetToSearch() {
    setAdmission(null);
    setDocs([]);
    setDocumentTypeId('');
    setFile(null);
    setSearchTerm('');
    setSearched(false);
    setResults([]);
  }

  async function handleUpload() {
    if (!file) return toast.error('File select karna zaroori hai');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('admissionId', admission.id);
      if (documentTypeId) formData.append('documentTypeId', documentTypeId);
      formData.append('uploadedBy', uploadedBy);
      await uploadPatientDocument(formData);
      toast.success('Document upload ho gaya');
      setDocumentTypeId('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadDocs(admission.id);
    } catch (err) {
      toast.error(err.message || 'Upload fail ho gaya');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="upd-page">
      <ClinicMenuBar />

      <div className="upd-toolbar">
        <button className="upd-tbtn upd-tbtn--exit" onClick={() => navigate(-1)} title="Exit">
          <DoorOpen size={16} />
        </button>
        <span className="upd-toolbar-title">Upload Patient Document</span>
      </div>

      <div className="upd-content">
        {!admission && (
          <>
            <div className="upd-search-row">
              <label>Search</label>
              <div className="upd-search-box">
                <input
                  autoFocus
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="MR #, Phone #, Patient Name, ya Admission # likh kar search karein"
                />
                <button onClick={handleSearch} disabled={searching} title="Search">
                  <Search size={15} />
                </button>
              </div>
            </div>

            {searched && (
              <table className="upd-search-tbl">
                <thead>
                  <tr>
                    <th>Admission #</th>
                    <th>MR #</th>
                    <th>Patient</th>
                    <th>Phone #</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => (
                    <tr key={r.id} onClick={() => handleSelect(r)}>
                      <td>{r.admissionNo}</td>
                      <td>{r.mrNo || '—'}</td>
                      <td>{r.patientName}</td>
                      <td>{r.phoneNo || '—'}</td>
                      <td>{fmtDateTime(r.createdAt)}</td>
                    </tr>
                  ))}
                  {!results.length && (
                    <tr><td colSpan={5} className="upd-td-empty">Koi match nahi mila</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </>
        )}

        {admission && (
          <div className="upd-form-card">
            <div className="upd-patient-row">
              <span className="upd-patient-name">{admission.patientName}</span>
              <span className="upd-badge">Admission # {admission.admissionNo}</span>
              {admission.mrNo && <span className="upd-badge">MR # {admission.mrNo}</span>}
            </div>

            <div className="upd-separator" />

            <div className="upd-upload-row">
              <div className="upd-field">
                <label>Document Type</label>
                <select value={documentTypeId} onChange={e => setDocumentTypeId(e.target.value)}>
                  <option value="">— Select Document Type —</option>
                  {documentTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.code} — {t.name}</option>
                  ))}
                </select>
              </div>
              <div className="upd-field">
                <label>File</label>
                <input ref={fileInputRef} type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>
              <button className="upd-upload-btn" onClick={handleUpload} disabled={uploading || !file}>
                <Upload size={14} />
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>

            <div className="upd-separator" />

            <div className="upd-docs-title">Uploaded Documents</div>
            <table className="upd-docs-tbl">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Document Type</th>
                  <th>Size</th>
                  <th>Uploaded By</th>
                  <th>Uploaded At</th>
                </tr>
              </thead>
              <tbody>
                {docs.map(d => (
                  <tr key={d.id}>
                    <td>
                      <a href={`${FILES_BASE}${d.filePath}`} target="_blank" rel="noreferrer" className="upd-file-link">
                        <FileText size={13} /> {d.fileName}
                      </a>
                    </td>
                    <td>{d.documentType?.name || '—'}</td>
                    <td>{fmtSize(d.fileSize)}</td>
                    <td>{d.uploadedBy || '—'}</td>
                    <td>{fmtDateTime(d.uploadedAt)}</td>
                  </tr>
                ))}
                {!docs.length && (
                  <tr><td colSpan={5} className="upd-td-empty">Abhi tak koi document upload nahi hua</td></tr>
                )}
              </tbody>
            </table>

            <div className="upd-footer">
              <button className="upd-close-btn" onClick={resetToSearch}>Select Another Patient</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
