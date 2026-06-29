import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Printer, Search } from 'lucide-react';
import hospitalLogo from '../../../assets/download.png';
import './VoucherReprint.scss';

const API = 'http://localhost:5001/api/accounts';

const todayStr = () => new Date().toISOString().slice(0, 10);
const firstOfYear = () => `${new Date().getFullYear()}-01-01`;

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

export default function VoucherReprint() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const printRef = useRef();

  const [voucherType, setVoucherType] = useState('expense');
  const [voucherFrom, setVoucherFrom] = useState('');
  const [voucherTo, setVoucherTo]     = useState('');
  const [dateFrom, setDateFrom]       = useState(firstOfYear());
  const [dateTo, setDateTo]           = useState(todayStr());

  const [vouchers, setVouchers]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [searched, setSearched]   = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(false);
    try {
      const params = new URLSearchParams({
        type: voucherType,
        entityType,
        ...(voucherFrom && { voucherFrom }),
        ...(voucherTo   && { voucherTo }),
        ...(dateFrom    && { dateFrom }),
        ...(dateTo      && { dateTo }),
      });
      const r = await fetch(`${API}/voucher-reprint?${params}`);
      const j = await r.json();
      setVouchers(Array.isArray(j?.data) ? j.data : []);
    } catch {
      setVouchers([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Voucher Reprint</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #000; }
          .vr-print-page { page-break-after: always; padding: 18px 24px; border: 1px solid #000; margin-bottom: 8px; }
          .vr-print-page:last-child { page-break-after: avoid; }
          .vr-ph { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
          .vr-ph img { height: 52px; }
          .vr-ph-info h1 { font-size: 16px; font-weight: 700; }
          .vr-ph-info p { font-size: 10px; color: #555; }
          .vr-meta { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 11px; }
          .vr-meta-block { display: flex; flex-direction: column; gap: 3px; }
          .vr-meta-label { font-weight: 700; }
          .vr-badge { display: inline-block; padding: 2px 8px; border: 1px solid #000; border-radius: 3px; font-size: 10px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          th, td { border: 1px solid #000; padding: 5px 7px; font-size: 11px; text-align: left; }
          th { background: #f0f0f0; font-weight: 700; }
          .td-r { text-align: right; }
          .tfoot-row td { font-weight: 700; background: #f5f5f5; }
          .vr-sigs { display: flex; justify-content: space-between; margin-top: 18px; border-top: 1px solid #ccc; padding-top: 12px; }
          .vr-sig { text-align: center; font-size: 10px; border-top: 1px solid #000; padding-top: 4px; width: 130px; }
        </style>
      </head>
      <body>${printContent}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const isExpense = voucherType === 'expense';

  return (
    <div className="vr-page">

      {/* Breadcrumb */}
      <div className="vr-breadcrumb">
        <button className="vr-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Back
        </button>
        <ChevronRight size={13} className="vr-bc-sep" />
        <span>Reports</span>
        <ChevronRight size={13} className="vr-bc-sep" />
        <span className="vr-bc-active">Voucher Reprint</span>
      </div>

      {/* Filter Card */}
      <div className="vr-filter-card">
        <div className="vr-filter-title">Select Voucher Reprint</div>

        {/* Voucher # row */}
        <div className="vr-filter-row">
          <div className="vr-filter-label">Voucher #</div>
          <div className="vr-filter-fields">
            <div className="vr-range-group">
              <span className="vr-range-tag">From</span>
              <input
                className="vr-input"
                placeholder="e.g. VE-20260629-001"
                value={voucherFrom}
                onChange={(e) => setVoucherFrom(e.target.value)}
              />
              <Search size={14} className="vr-input-icon" />
            </div>
            <div className="vr-range-group">
              <span className="vr-range-tag">To</span>
              <input
                className="vr-input"
                placeholder="e.g. VE-20260629-999"
                value={voucherTo}
                onChange={(e) => setVoucherTo(e.target.value)}
              />
              <Search size={14} className="vr-input-icon" />
            </div>
          </div>
        </div>

        {/* Voucher Date row */}
        <div className="vr-filter-row">
          <div className="vr-filter-label">Voucher Date</div>
          <div className="vr-filter-fields">
            <div className="vr-range-group">
              <span className="vr-range-tag">From</span>
              <input type="date" className="vr-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="vr-range-group">
              <span className="vr-range-tag">To</span>
              <input type="date" className="vr-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Radio row */}
        <div className="vr-radio-row">
          <label className="vr-radio-label">
            <input type="radio" value="expense" checked={voucherType === 'expense'} onChange={() => setVoucherType('expense')} />
            Expense Voucher
          </label>
          <label className="vr-radio-label">
            <input type="radio" value="income" checked={voucherType === 'income'} onChange={() => setVoucherType('income')} />
            Income Voucher
          </label>
        </div>

        {/* Actions */}
        <div className="vr-filter-actions">
          <button className="vr-btn-search" onClick={handleSearch} disabled={loading}>
            {loading ? 'Searching…' : 'Voucher Reprint'}
          </button>
          {vouchers?.length > 0 && (
            <button className="vr-btn-print" onClick={handlePrint}>
              <Printer size={15} /> Print All
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div className="vr-results">
          {vouchers.length === 0 ? (
            <div className="vr-no-data">No vouchers found for the selected filters.</div>
          ) : (
            <>
              <div className="vr-results-count">{vouchers.length} voucher{vouchers.length > 1 ? 's' : ''} found</div>

              {/* Printable area */}
              <div ref={printRef}>
                {vouchers.map((v) => (
                  <div key={v.id} className="vr-print-page">
                    {/* Header */}
                    <div className="vr-ph">
                      <img src={hospitalLogo} alt="logo" className="vr-ph-img" />
                      <div className="vr-ph-info">
                        <div className="vr-ph-name">Darul Shifa Hospital</div>
                        <div className="vr-ph-sub">{entityType === 'corporate' ? 'Corporate Accounts' : 'Non-Corporate Accounts'}</div>
                      </div>
                      <div className="vr-ph-type">
                        <span className="vr-type-badge">
                          {isExpense ? 'PAYMENT VOUCHER' : 'RECEIPT VOUCHER'}
                        </span>
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="vr-meta">
                      <div className="vr-meta-block">
                        <span className="vr-meta-label">Voucher No</span>
                        <span className="vr-meta-val">{v.voucherNo}</span>
                      </div>
                      <div className="vr-meta-block">
                        <span className="vr-meta-label">Date</span>
                        <span className="vr-meta-val">{fmtDate(v.voucherDate)}</span>
                      </div>
                      <div className="vr-meta-block">
                        <span className="vr-meta-label">Mode</span>
                        <span className="vr-meta-val">{v.mode?.toUpperCase()}</span>
                      </div>
                      <div className="vr-meta-block">
                        <span className="vr-meta-label">Total Amount</span>
                        <span className="vr-meta-val vr-meta-total">PKR {Number(v.totalAmount).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Entries table */}
                    <table className="vr-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          {isExpense ? (
                            <>
                              <th>Account Code</th>
                              <th>Account Name</th>
                              <th>Payee</th>
                              {v.entries?.some((e) => e.chequeNo) && <th>Cheque #</th>}
                            </>
                          ) : (
                            <>
                              <th>Income Account</th>
                            </>
                          )}
                          <th>Particulars</th>
                          <th className="vr-td-r">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(v.entries || []).map((e, i) => (
                          <tr key={e.id}>
                            <td>{i + 1}</td>
                            {isExpense ? (
                              <>
                                <td>{e.accountCode || '—'}</td>
                                <td>{e.accountName || '—'}</td>
                                <td>{e.payeeName || '—'}</td>
                                {v.entries?.some((x) => x.chequeNo) && <td>{e.chequeNo || '—'}</td>}
                              </>
                            ) : (
                              <>
                                <td>{e.incomeCategoryName || '—'}</td>
                              </>
                            )}
                            <td>{e.particulars || '—'}</td>
                            <td className="vr-td-r">{Number(e.amount).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={isExpense ? (v.entries?.some((e) => e.chequeNo) ? 5 : 4) : 2} className="vr-tfoot-label">
                            TOTAL
                          </td>
                          <td className="vr-td-r vr-tfoot-amt">PKR {Number(v.totalAmount).toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>

                    {/* Signatures */}
                    <div className="vr-sigs">
                      <div className="vr-sig">Prepared By</div>
                      <div className="vr-sig">Verified By</div>
                      <div className="vr-sig">Approved By</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
