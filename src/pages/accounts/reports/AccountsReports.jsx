import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import './AccountsReports.scss';

const REPORTS = [
  {
    key: 'voucher-reprint',
    label: 'Voucher Reprint',
    icon: Printer,
    desc: 'Reprint expense or income vouchers by voucher number or date range',
  },
];

export default function AccountsReports() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const label = entityType === 'corporate' ? 'Corporate' : 'Non-Corporate';

  return (
    <div className="acc-reports">
      <div className="acc-reports__header">
        <button className="acc-reports__back" onClick={() => navigate(-1)}>
          <ArrowLeft size={15} /> Back
        </button>
        <div>
          <h1 className="acc-reports__title">Reports</h1>
          <p className="acc-reports__sub">{label} · Select a report to open</p>
        </div>
      </div>

      <div className="acc-reports__grid">
        {REPORTS.map((r) => (
          <div
            key={r.key}
            className="acc-reports__card"
            onClick={() => navigate(`/accounts/${entityType}/reports/${r.key}`)}
          >
            <div className="acc-reports__icon">
              <r.icon size={26} />
            </div>
            <div className="acc-reports__info">
              <div className="acc-reports__name">{r.label}</div>
              <div className="acc-reports__desc">{r.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
