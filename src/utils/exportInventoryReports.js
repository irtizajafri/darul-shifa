import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function safeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

export function exportRowsToExcel({ fileName = 'report', sheetName = 'Report', rows = [] }) {
  const data = safeRows(rows);
  const headers = data.length ? Object.keys(data[0]) : [];

  const escapeCell = (value) => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const bodyLines = data.map((row) => headers.map((h) => escapeCell(row[h])).join(','));
  const csv = [headerLine, ...bodyLines].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}-${sheetName}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportRowsToPdf({ fileName = 'report', title = 'Report', rows = [] }) {
  const data = safeRows(rows);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFontSize(14);
  doc.text(title, 40, 34);

  if (data.length === 0) {
    doc.setFontSize(11);
    doc.text('No records found.', 40, 60);
    doc.save(`${fileName}.pdf`);
    return;
  }

  const headers = Object.keys(data[0]);
  const body = data.map((row) => headers.map((key) => String(row[key] ?? '')));

  autoTable(doc, {
    startY: 52,
    head: [headers],
    body,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 64, 175] },
    margin: { left: 24, right: 24 },
  });

  doc.save(`${fileName}.pdf`);
}
