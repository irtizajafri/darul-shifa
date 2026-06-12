import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function safeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

function buildGrandTotalFooter(rows) {
  if (!rows.length) return null;
  const headers = Object.keys(rows[0]);
  return headers.map((h, i) => {
    if (i === 0) return 'Grand Total';
    const vals = rows.map((r) => Number(r[h])).filter((v) => !isNaN(v) && isFinite(v));
    if (vals.length === rows.length && vals.length > 0) {
      return vals.reduce((a, b) => a + b, 0).toFixed(2);
    }
    return '';
  });
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

function addPdfMeta(doc, title, filterSummary, printedBy, generatedAt) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth  = doc.internal.pageSize.getWidth();

  let y = 34;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(title, 40, y);

  if (filterSummary && filterSummary.length > 0) {
    y += 14;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    const line = filterSummary.join('   |   ');
    doc.text(line, 40, y, { maxWidth: pageWidth - 80 });
    doc.setTextColor(0, 0, 0);
  }

  const startY = y + 12;

  const footerParts = [];
  if (printedBy)   footerParts.push(`Printed by: ${printedBy}`);
  if (generatedAt) footerParts.push(`Generated: ${generatedAt}`);
  const footerText = footerParts.join('   |   ');

  const drawFooter = () => {
    if (!footerText) return;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130, 130, 130);
    doc.text(footerText, 24, pageHeight - 10);
    doc.setTextColor(0, 0, 0);
  };

  return { startY, drawFooter };
}

export function exportRowsToPdf({ fileName = 'report', title = 'Report', rows = [], filterSummary = [], printedBy = '', generatedAt = '' }) {
  const data = safeRows(rows);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  const { startY, drawFooter } = addPdfMeta(doc, title, filterSummary, printedBy, generatedAt);

  if (data.length === 0) {
    doc.setFontSize(11);
    doc.text('No records found.', 40, startY + 10);
    drawFooter();
    doc.save(`${fileName}.pdf`);
    return;
  }

  const headers = Object.keys(data[0]);
  const body = data.map((row) => headers.map((key) => String(row[key] ?? '')));
  const footer = buildGrandTotalFooter(data);

  autoTable(doc, {
    startY,
    head: [headers],
    body,
    foot: footer ? [footer] : [],
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 64, 175] },
    footStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold' },
    showFoot: 'lastPage',
    margin: { left: 24, right: 24 },
    didDrawPage: () => drawFooter(),
  });

  doc.save(`${fileName}.pdf`);
}

export function printRowsToPdf({ title = 'Report', rows = [], filterSummary = [], printedBy = '', generatedAt = '' }) {
  const data = safeRows(rows);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  const { startY, drawFooter } = addPdfMeta(doc, title, filterSummary, printedBy, generatedAt);

  if (data.length === 0) {
    doc.setFontSize(11);
    doc.text('No records found.', 40, startY + 10);
    drawFooter();
  } else {
    const headers = Object.keys(data[0]);
    const body = data.map((row) => headers.map((key) => String(row[key] ?? '')));
    const footer = buildGrandTotalFooter(data);

    autoTable(doc, {
      startY,
      head: [headers],
      body,
      foot: footer ? [footer] : [],
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [30, 64, 175] },
      footStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold' },
      showFoot: 'lastPage',
      margin: { left: 24, right: 24 },
      didDrawPage: () => drawFooter(),
    });
  }

  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}

/**
 * Generates a formatted Sales Invoice PDF (Portrait A4)
 * mode: 'download' → saves file | 'print' → opens browser print dialog
 */
export function generateSalesInvoicePdf({ inv, mode = 'download' }) {
  if (!inv) return;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // ── SHOP NAME ──────────────────────────────────────────────
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Fair Price Medical Store', pageWidth / 2, 48, { align: 'center' });

  // Top divider
  doc.setLineWidth(1);
  doc.setDrawColor(30, 64, 175);
  doc.line(margin, 58, pageWidth - margin, 58);

  // ── INVOICE META ───────────────────────────────────────────
  const customerName =
    inv.customerType === 'customer' ? (inv.customerName || 'N/A') : 'Walking Customer';
  const invoiceDate = inv.invoiceDate
    ? new Date(inv.invoiceDate).toLocaleDateString('en-PK', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '-';

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(0, 0, 0);

  // Left: Invoice No & Patient
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice No:', margin, 76);
  doc.setFont('helvetica', 'normal');
  doc.text(inv.code || '-', margin + 64, 76);

  doc.setFont('helvetica', 'bold');
  doc.text('Patient:', margin, 92);
  doc.setFont('helvetica', 'normal');
  doc.text(customerName, margin + 44, 92);

  // Right: Date
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', pageWidth - margin - 120, 76);
  doc.setFont('helvetica', 'normal');
  doc.text(invoiceDate, pageWidth - margin - 80, 76);

  // Bottom divider below meta
  doc.setLineWidth(0.5);
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, 104, pageWidth - margin, 104);

  // ── ITEMS TABLE ────────────────────────────────────────────
  const invoiceItems = inv.items || [];
  const tableBody = invoiceItems.map((line, idx) => [
    idx + 1,
    line.item?.name || '-',
    Number(line.saleRate || 0).toFixed(2),
    line.quantity,
    Number(line.totalAmount || 0).toFixed(2),
  ]);

  autoTable(doc, {
    startY: 114,
    head: [['S.No', 'Description', 'Rate', 'Qty', 'Amount']],
    body: tableBody,
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 40 },
      1: { halign: 'left' },
      2: { halign: 'right', cellWidth: 75 },
      3: { halign: 'center', cellWidth: 45 },
      4: { halign: 'right', cellWidth: 80 },
    },
    margin: { left: margin, right: margin },
  });

  // ── TOTALS ─────────────────────────────────────────────────
  const tableEndY = doc.lastAutoTable.finalY;
  const labelX = pageWidth - margin - 160;
  const valueX = pageWidth - margin;

  const subTotal = Number(inv.subTotal || inv.totalAmount || 0);
  const discountPercent = Number(inv.discountPercent || 0);
  const discountAmount = Number(inv.discountAmount || 0);
  const grandTotal = Number(inv.totalAmount || 0);

  let y = tableEndY + 20;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(180, 180, 180);

  // Sub Total row
  doc.text('Sub Total:', labelX, y);
  doc.text(subTotal.toFixed(2), valueX, y, { align: 'right' });

  // Discount row (only if applicable)
  if (discountPercent > 0) {
    y += 20;
    doc.setTextColor(180, 0, 0);
    doc.text(`Discount (${discountPercent}%):`, labelX, y);
    doc.text(`- ${discountAmount.toFixed(2)}`, valueX, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  // Divider before grand total
  y += 10;
  doc.setLineWidth(0.8);
  doc.setDrawColor(30, 64, 175);
  doc.line(labelX, y, valueX, y);

  // Grand Total row
  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('Grand Total:', labelX, y);
  doc.text(grandTotal.toFixed(2), valueX, y, { align: 'right' });

  // ── OUTPUT ─────────────────────────────────────────────────
  const fileName = `sales-invoice-${inv.code || 'draft'}.pdf`;

  if (mode === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(fileName);
  }
}

/**
 * Generates a Maintenance / Repair Bill PDF (Portrait A4)
 * billType: 'sent'     → Bill 1 (item sent for repair)
 * billType: 'received' → Bill 2 (item received back)
 * mode: 'download' | 'print'
 */
export function generateMaintenanceBillPdf({ record, billType = 'sent', mode = 'download' }) {
  if (!record) return;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // ── HEADING ────────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Maintenance Note', pageWidth / 2, 48, { align: 'center' });

  // Blue divider
  doc.setLineWidth(1);
  doc.setDrawColor(30, 64, 175);
  doc.line(margin, 58, pageWidth - margin, 58);

  // ── META INFO ──────────────────────────────────────────────
  const moNo = record.moNumber || String(record.id);
  const sentDate = record.date
    ? new Date(record.date).toLocaleDateString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '-';
  const receivedDate = record.receivedDate
    ? new Date(record.receivedDate).toLocaleDateString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '-';

  const assetTags =
    Array.isArray(record.assetInstances) && record.assetInstances.length > 0
      ? record.assetInstances.map((a) => a.assetTag).join(', ')
      : '-';

  doc.setFontSize(10);
  doc.setDrawColor(0, 0, 0);

  // Left column
  doc.setFont('helvetica', 'bold');   doc.text('MO No:', margin, 76);
  doc.setFont('helvetica', 'normal'); doc.text(moNo, margin + 48, 76);

  doc.setFont('helvetica', 'bold');   doc.text('Item:', margin, 92);
  doc.setFont('helvetica', 'normal'); doc.text(record.item?.name || '-', margin + 36, 92);

  doc.setFont('helvetica', 'bold');   doc.text('Asset Tags:', margin, 108);
  doc.setFont('helvetica', 'normal'); doc.text(assetTags, margin + 64, 108);

  doc.setFont('helvetica', 'bold');   doc.text('Vendor:', margin, 124);
  doc.setFont('helvetica', 'normal'); doc.text(record.supplier?.name || '-', margin + 48, 124);

  // Right column
  doc.setFont('helvetica', 'bold');   doc.text('Date Sent:', pageWidth - margin - 150, 76);
  doc.setFont('helvetica', 'normal'); doc.text(sentDate, pageWidth - margin - 70, 76);

  if (billType === 'received') {
    doc.setFont('helvetica', 'bold');   doc.text('Date Received:', pageWidth - margin - 150, 92);
    doc.setFont('helvetica', 'normal'); doc.text(receivedDate, pageWidth - margin - 70, 92);

    doc.setFont('helvetica', 'bold');   doc.text('Checked By:', pageWidth - margin - 150, 108);
    doc.setFont('helvetica', 'normal'); doc.text(record.checkedBy || '-', pageWidth - margin - 70, 108);
  }

  // Grey divider
  doc.setLineWidth(0.5);
  doc.setDrawColor(180, 180, 180);
  const divY = billType === 'received' ? 136 : 136;
  doc.line(margin, divY, pageWidth - margin, divY);

  // ── TABLE ──────────────────────────────────────────────────
  const tableBody = [[
    '1',
    record.natureOfRepair || '-',
    record.cost != null ? `PKR ${Number(record.cost).toLocaleString()}` : '-',
  ]];

  autoTable(doc, {
    startY: divY + 10,
    head: [['S.No', 'Nature of Repair', 'Cost']],
    body: tableBody,
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 40 },
      1: { halign: 'left' },
      2: { halign: 'right', cellWidth: 100 },
    },
    margin: { left: margin, right: margin },
  });

  // ── COST TOTAL + STATUS SECTION ───────────────────────────
  const tableEndY = doc.lastAutoTable.finalY;
  let y = tableEndY + 16;

  const labelX = pageWidth - margin - 160;
  const valueX = pageWidth - margin;
  const estimatedCost = record.cost != null ? Number(record.cost) : null;
  const actualCost    = record.actualCost != null ? Number(record.actualCost) : null;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(180, 180, 180);

  if (billType === 'sent') {
    // Bill 1 — show estimated cost only
    doc.text('Estimated Cost:', labelX, y);
    doc.text(
      estimatedCost != null ? `PKR ${estimatedCost.toLocaleString()}` : '-',
      valueX, y, { align: 'right' }
    );

  } else {
    // Bill 2 — show estimated + actual cost
    doc.setTextColor(100, 100, 100);
    doc.text('Estimated Cost:', labelX, y);
    doc.text(
      estimatedCost != null ? `PKR ${estimatedCost.toLocaleString()}` : '-',
      valueX, y, { align: 'right' }
    );

    y += 18;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Actual Cost:', labelX, y);
    doc.text(
      actualCost != null ? `PKR ${actualCost.toLocaleString()}` : '-',
      valueX, y, { align: 'right' }
    );
    doc.setFont('helvetica', 'normal');

    if (record.status === 'discarded') {
      const gdnList = Array.isArray(record.gdns) ? record.gdns : [];
      const scrapVal = gdnList.length > 0 ? gdnList[0].scrapValue : null;

      if (scrapVal != null) {
        y += 18;
        doc.setTextColor(0, 0, 0);
        doc.text('Scrap Value:', labelX, y);
        doc.text(`PKR ${Number(scrapVal).toLocaleString()}`, valueX, y, { align: 'right' });
      }

      y += 10;
      doc.setLineWidth(0.8);
      doc.setDrawColor(30, 64, 175);
      doc.line(labelX, y, valueX, y);

      y += 16;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(180, 0, 0);
      doc.text('DISCARDED — GDN Created', labelX, y);
      doc.setTextColor(0, 0, 0);

    } else if (record.status === 'completed') {
      y += 10;
      doc.setLineWidth(0.8);
      doc.setDrawColor(30, 64, 175);
      doc.line(labelX, y, valueX, y);

      y += 16;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0, 130, 0);
      doc.text('Repair Completed ✓', labelX, y);
      doc.setTextColor(0, 0, 0);
    }
  }

  // ── OUTPUT ─────────────────────────────────────────────────
  const fileName = `maintenance-${moNo}-${billType}.pdf`;
  if (mode === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(fileName);
  }
}
