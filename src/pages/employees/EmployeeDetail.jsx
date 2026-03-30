import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Pencil, Printer, Eye, EyeOff } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useModuleStore } from '../../store/useModuleStore';
import { getTotalSalary, formatDate } from '../../utils/helpers';
import PageLoader from '../../components/ui/PageLoader';
import PageHeader from '../../components/shared/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import logo from '../../assets/logo.jpg';
import './EmployeeDetail.scss';

const salaryHistory = [];

export default function EmployeeDetail() {
  const [loading, setLoading] = useState(true);
  const [showSalary, setShowSalary] = useState(false);
  const [activeInfoTab, setActiveInfoTab] = useState(0);
  const { id } = useParams();
  const { setModule } = useModuleStore();
  const navigate = useNavigate();

  const { getEmployeeById } = useEmployeeStore();
  const emp = getEmployeeById(id);
  const seed = encodeURIComponent(`${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() || emp?.empCode || 'employee');
  const fallbackAvatar = `https://api.dicebear.com/8.x/initials/svg?seed=${seed}&backgroundColor=eff6ff&textColor=2563eb`;

  const downloadFile = ({ filename, content, mimeType }) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async ({ autoPrint = false } = {}) => {
    if (!emp) return;

    const pdf = new jsPDF('p', 'pt', 'a4');
    const img = new Image();
    img.src = logo;
    const photo = new Image();
    photo.src = emp.photo || '';

    await Promise.all([
      new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      }),
      new Promise((resolve) => {
        if (!photo.src) {
          resolve();
          return;
        }
        photo.onload = resolve;
        photo.onerror = resolve;
      })
    ]);

    const meta = {
      address: 'C 1-4 Survery # 675 Jaffar e Tayyar Society Malir, Karachi, Pakistan, 75210',
      phone: '021-34508390',
      whatsapp: '+92 334 2225746'
    };
    const margin = 40;
    const pageWidth = pdf.internal.pageSize.getWidth();

    if (img.complete && img.naturalWidth) {
      pdf.addImage(img, 'JPEG', margin, 20, 60, 60);
    }
    if (photo.complete && photo.naturalWidth) {
      pdf.addImage(photo, 'JPEG', pageWidth - margin - 70, 20, 60, 60);
    } else {
      pdf.setDrawColor(226, 232, 240);
      pdf.setFillColor(241, 245, 249);
      pdf.roundedRect(pageWidth - margin - 70, 20, 60, 60, 6, 6, 'FD');
      pdf.setFontSize(20);
      pdf.setTextColor(30, 64, 175);
      const initials = `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase() || 'EMP';
      pdf.text(initials, pageWidth - margin - 40, 55, { align: 'center' });
      pdf.setTextColor(0, 0, 0);
    }
    pdf.setFontSize(14);
    pdf.text('Darul Shifa Imam Khomeini', margin + 80, 40);
    pdf.setFontSize(9);
    pdf.text(meta.address, margin + 80, 58, { maxWidth: pageWidth - margin * 2 - 80 });
    pdf.text(`Tel: ${meta.phone}`, margin + 80, 74);
    pdf.text(`WhatsApp: ${meta.whatsapp}`, margin + 80, 90);
    pdf.setFontSize(12);
    pdf.text(`Employee Detail: ${emp.empCode}`, margin, 120);

    const totalSalary = getTotalSalary(emp.basicSalary, emp.allowances || []);

    autoTable(pdf, {
      startY: 140,
      head: [['Field', 'Value', 'Field', 'Value']],
      body: [
        ['Employee Code', emp.empCode || '-', 'Status', emp.status || '-'],
        ['Name', `${emp.firstName || ''} ${emp.middleName || ''} ${emp.lastName || ''}`.trim(), 'Father Name', emp.fatherName || '-'],
        ['DOB', formatDate(emp.dob), 'Gender', emp.gender || '-'],
        ['NIC', emp.nic || '-', 'Marital Status', emp.maritalStatus || '-'],
        ['Spouse Name', emp.spouseName || '-', 'Birth Place', emp.birthPlace || '-'],
        ['Address', emp.address || '-', 'City', emp.city || '-'],
        ['Phone', emp.phone || '-', 'Email', emp.email || '-'],
        ['Reference 1', emp.reference1 || '-', 'Reference 2', emp.reference2 || '-'],
        ['Beneficiary', emp.beneficiaryName || '-', 'Relation', emp.beneficiaryRelation || '-'],
        ['Department', emp.department || emp.departmentText || '-', 'Designation', emp.designation || emp.role || '-'],
        ['Appointment Date', formatDate(emp.appointmentDate), 'Joining Date', formatDate(emp.joiningDate)],
        ['Weekly Holiday', emp.weeklyHoliday || '-', 'Working Days', emp.workingDays || '-'],
        ['Duty Type', emp.dutyType || '-', 'Disbursement', emp.disbursement || '-'],
        ['Basic Salary', emp.basicSalary ? `PKR ${Number(emp.basicSalary).toLocaleString()}` : '-', 'Total Salary', `PKR ${totalSalary.toLocaleString()}`],
        ['Emergency Contact', emp.emergencyContact || '-', 'Emergency Phone', emp.emergencyPhone || '-'],
        ['Emergency Relation', emp.emergencyRelation || '-', 'Notes', emp.notes || '-']
      ],
      styles: { fontSize: 9 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        2: { fontStyle: 'bold' }
      },
      headStyles: { fillColor: [37, 99, 235] }
    });

    if (emp.allowances && emp.allowances.length) {
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 16,
        head: [['Allowance', 'Amount']],
        body: emp.allowances.map((a) => [a.type || '-', Number(a.amount || 0).toLocaleString()]),
        styles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: 'bold' } },
        headStyles: { fillColor: [30, 64, 175] }
      });
    }

    if (emp.dutyRoster && emp.dutyRoster.length) {
      autoTable(pdf, {
        startY: pdf.lastAutoTable.finalY + 16,
        head: [['Day', 'Time In', 'Time Out', 'Hours']],
        body: emp.dutyRoster.map((d) => [d.day || '-', d.timeIn || '-', d.timeOut || '-', d.hours ?? '-']),
        styles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: 'bold' } },
        headStyles: { fillColor: [59, 130, 246] }
      });
    }

    const footerY = pdf.internal.pageSize.getHeight() - 40;
    pdf.setFontSize(8);
    pdf.text(meta.address, margin, footerY, { maxWidth: pageWidth - margin * 2 });
    pdf.text(`Tel: ${meta.phone} | WhatsApp: ${meta.whatsapp}`, margin, footerY + 12);

    if (autoPrint) {
      pdf.autoPrint();
      const pdfUrl = pdf.output('bloburl');
      window.open(pdfUrl, '_blank');
      return;
    }

    pdf.save(`${emp.empCode}-detail.pdf`);
    toast.success('PDF downloaded');
  };

  useEffect(() => {
    setModule('employee');
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, [setModule]);

  if (!emp && !loading) {
    return <p>Employee not found</p>;
  }

  if (loading || !emp) return <PageLoader />;

  const totalSalary = getTotalSalary(emp.basicSalary, emp.allowances || []);

  return (
    <div className="employee-detail-page">
      <PageHeader
        breadcrumbs={[
          { link: '/employee-module', label: 'Dashboard' },
          { link: '/employees', label: 'Employees' },
          { label: emp.firstName + ' ' + emp.lastName },
        ]}
        action={
          <div className="flex gap-2">
            <Button label="Edit" icon={Pencil} variant="outline" onClick={() => navigate(`/employees/${id}/edit`)} />
            <Button label="Print" icon={Printer} variant="outline" onClick={() => exportPDF({ autoPrint: true })} />
            <Button label="PDF" variant="outline" onClick={() => exportPDF()} />
          </div>
        }
      />
      <div className="detail-grid">
        <Card className="profile-card">
          <div className="avatar-wrap">
            <div className="avatar">
              <img src={emp.photo || fallbackAvatar} alt="" />
            </div>
            <Badge label={emp.empCode} variant="info" className="emp-code-badge" />
            <Badge label={emp.status} variant={emp.status === 'Active' ? 'success' : 'danger'} />
          </div>
          <h2>{emp.firstName} {emp.middleName} {emp.lastName}</h2>
          <p className="designation">{emp.designation}</p>
          <p className="department">{emp.department}</p>
          <div className="salary-row">
            <span>Basic Salary:</span>
            <strong>{showSalary ? `PKR ${totalSalary.toLocaleString()}` : '********'}</strong>
            <Button
              label={showSalary ? 'Hide' : 'Show'}
              icon={showSalary ? EyeOff : Eye}
              size="sm"
              variant="ghost"
              onClick={() => setShowSalary(!showSalary)}
            />
          </div>
        </Card>
        <div className="info-tabs">
          <div className="tab-buttons">
            {['Personal', 'Company', 'Duty', 'History'].map((t, i) => (
              <button
                key={t}
                className={activeInfoTab === i ? 'active' : ''}
                onClick={() => setActiveInfoTab(i)}
              >
                {t}
              </button>
            ))}
          </div>
          <Card>
            {activeInfoTab === 0 && (
              <div className="info-grid">
                <p><strong>Father Name:</strong> {emp.fatherName}</p>
                <p><strong>DOB:</strong> {formatDate(emp.dob)}</p>
                <p><strong>Gender:</strong> {emp.gender}</p>
                <p><strong>NIC:</strong> {emp.nic}</p>
                <p><strong>Address:</strong> {emp.address}</p>
                <p><strong>City:</strong> {emp.city}</p>
                <p><strong>Phone:</strong> {emp.phone}</p>
                <p><strong>Email:</strong> {emp.email || '-'}</p>
              </div>
            )}
            {activeInfoTab === 1 && (
              <div className="info-grid">
                <p><strong>Designation:</strong> {emp.designation}</p>
                <p><strong>Department:</strong> {emp.department}</p>
                <p><strong>Status:</strong> {emp.status}</p>
                <p><strong>Appointment Date:</strong> {formatDate(emp.appointmentDate)}</p>
                <p><strong>Joining Date:</strong> {formatDate(emp.joiningDate)}</p>
              </div>
            )}
            {activeInfoTab === 2 && (
              <p>Duty roster information (normal 8hr shift)</p>
            )}
            {activeInfoTab === 3 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Previous</th>
                      <th>New</th>
                      <th>Increment</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryHistory.length === 0 ? (
                      <tr>
                        <td>-</td>
                        <td>0</td>
                        <td>0</td>
                        <td>0</td>
                        <td>-</td>
                      </tr>
                    ) : (
                      salaryHistory.map((r, i) => (
                        <tr key={i}>
                          <td>{formatDate(r.date)}</td>
                          <td>{r.previous.toLocaleString()}</td>
                          <td>{r.new.toLocaleString()}</td>
                          <td>{r.increment.toLocaleString()}</td>
                          <td>{r.by}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
