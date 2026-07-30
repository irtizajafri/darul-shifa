import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { useClinicStore } from '../../../store/useClinicStore';
import './PatientDocumentsReport.scss';

const FILES_BASE = 'http://localhost:5001/uploads/';

function fmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  const day   = String(dt.getDate()).padStart(2, '0');
  const month = dt.toLocaleString('en-GB', { month: 'short' });
  const year  = dt.getFullYear();
  const time  = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${day}-${month}-${year} ${time}`;
}

export default function PatientDocumentsReport() {
  const { documentTypes, fetchDocumentTypes, fetchPatientDocumentsReport } = useClinicStore();

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [q, setQ] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => { fetchDocumentTypes(); }, [fetchDocumentTypes]);

  async function handleSearch() {
    setLoading(true);
    try {
      const params = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (q.trim()) params.q = q.trim();
      if (documentTypeId) params.documentTypeId = documentTypeId;
      setRows(await fetchPatientDocumentsReport(params));
      setSearched(true);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pdr-page">
      <ClinicMenuBar />

      <div className="pdr-header">
        <span className="pdr-title">Patient Documents Report</span>
      </div>

      <div className="pdr-filters">
        <div className="pdr-field">
          <label>From Date</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="pdr-field">
          <label>To Date</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div className="pdr-field pdr-field--grow">
          <label>Patient (MR # / Name / Admission # / Phone #)</label>
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search patient…"
          />
        </div>
        <div className="pdr-field">
          <label>Document Type</label>
          <select value={documentTypeId} onChange={e => setDocumentTypeId(e.target.value)}>
            <option value="">— All —</option>
            {documentTypes.map(t => (
              <option key={t.id} value={t.id}>{t.code} — {t.name}</option>
            ))}
          </select>
        </div>
        <button className="pdr-search-btn" onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      <div className="pdr-body">
        {searched && (
          <table className="pdr-tbl">
            <thead>
              <tr>
                <th>File</th>
                <th>Document Type</th>
                <th>Patient</th>
                <th>Admission #</th>
                <th>MR #</th>
                <th>Uploaded By</th>
                <th>Uploaded At</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>
                    <a href={`${FILES_BASE}${r.filePath}`} target="_blank" rel="noreferrer" className="pdr-file-link">
                      <FileText size={13} /> {r.fileName}
                    </a>
                  </td>
                  <td>{r.documentType?.name || '—'}</td>
                  <td>{r.admission?.patientTitle} {r.admission?.patientName}</td>
                  <td>{r.admission?.admissionNo || '—'}</td>
                  <td>{r.admission?.mrNo || '—'}</td>
                  <td>{r.uploadedBy || '—'}</td>
                  <td>{fmtDateTime(r.uploadedAt)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={7} className="pdr-empty-row">Koi document nahi mila</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
