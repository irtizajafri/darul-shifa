import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function safeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

// Number-looking identifiers (Admission #, Item Code, …) are not amounts.
const isIdColumn = (h) => /#|code|admission/i.test(h);

function buildGrandTotalFooter(rows) {
  if (!rows.length) return null;
  const headers = Object.keys(rows[0]);
  return headers.map((h, i) => {
    if (i === 0) return 'Grand Total';
    if (isIdColumn(h)) return '';
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

export function exportRowsToPdf({ fileName = 'report', title = 'Report', rows = [], filterSummary = [], printedBy = '', generatedAt = '', grandTotal = true }) {
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
  const footer = grandTotal ? buildGrandTotalFooter(data) : null;

  autoTable(doc, {
    startY,
    head: [headers],
    body,
    foot: footer ? [footer] : [],
    styles: { fontSize: 8, cellPadding: 4, textColor: [0, 0, 0] },
    headStyles: { fillColor: [152, 152, 152], textColor: [255, 255, 255] },
    footStyles: { fillColor: [152, 152, 152], textColor: [255, 255, 255], fontStyle: 'bold' },
    showFoot: 'lastPage',
    margin: { left: 24, right: 24 },
    didDrawPage: () => drawFooter(),
  });

  doc.save(`${fileName}.pdf`);
}

// Portrait A4 print of a row report as a plain HTML page in a popup — real
// Arial 8pt (jsPDF has no Arial). Columns empty on every row ('-' / blank)
// are dropped so the rest fit the narrower portrait page. Same title,
// filter line, Grand Total footer and Printed by / Generated line as the PDF.
export function printRowsHtml({ title = 'Report', rows = [], filterSummary = [], printedBy = '', generatedAt = '', grandTotal = true }) {
  const data = safeRows(rows);
  const allHeaders = data.length ? Object.keys(data[0]) : [];
  const isBlank = (v) => v === undefined || v === null || String(v).trim() === '' || String(v).trim() === '-';
  const headers = allHeaders.filter((h) => data.some((r) => !isBlank(r[h])));
  const numeric = (h) => data.length > 0 && data.every((r) => isBlank(r[h]) || (!Number.isNaN(Number(r[h])) && Number.isFinite(Number(r[h]))));
  const numCols = new Set(headers.filter((h) => !isIdColumn(h) && numeric(h)));
  const footer = grandTotal ? buildGrandTotalFooter(data.map((r) => Object.fromEntries(headers.map((h) => [h, r[h]])))) : null;
  const isTotalRow = (r) => /total/i.test(String(r[headers[0]] ?? ''));

  const head = headers.map((h) => `<th class="${numCols.has(h) ? 'r' : ''}">${escHtml(h)}</th>`).join('');
  const body = data.map((r) => `<tr class="${isTotalRow(r) ? 'tot' : ''}">${headers.map((h) => `<td class="${numCols.has(h) ? 'r' : ''}">${escHtml(r[h] ?? '')}</td>`).join('')}</tr>`).join('');
  const foot = footer ? `<tfoot><tr>${footer.map((v, i) => `<td class="${i > 0 && numCols.has(headers[i]) ? 'r' : ''}">${escHtml(v)}</td>`).join('')}</tr></tfoot>` : '';
  const printed = [printedBy && `Printed by: ${printedBy}`, generatedAt && `Generated: ${generatedAt}`].filter(Boolean).join('   |   ');

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<title>${escHtml(title)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; line-height: 1.2; color: #000; background: #fff; }
  h1 { font-size: 10pt; margin-bottom: 2px; }
  .filters { font-size: 7.5pt; color: #333; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; table-layout: auto; }
  th, td { border: 0.5pt solid #888; padding: 1px 3px; vertical-align: top; word-break: break-word; }
  th { background: #e3e3e3; font-weight: 700; text-align: left; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  .r { text-align: right; white-space: nowrap; }
  tr.tot td { font-weight: 700; background: #f2f2f2; }
  tfoot td { font-weight: 700; background: #e3e3e3; }
  .printed { font-size: 7pt; color: #555; margin-top: 4px; }
  @page { size: A4 portrait; margin: 10mm; }
</style></head><body>
  <h1>${escHtml(title)}</h1>
  ${filterSummary && filterSummary.length ? `<div class="filters">${escHtml(filterSummary.join('   |   '))}</div>` : ''}
  ${data.length ? `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table>` : '<p>No records found.</p>'}
  ${printed ? `<div class="printed">${escHtml(printed)}</div>` : ''}
  <script>window.onload = function () { window.print(); };</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

// grandTotal: false when the rows already carry their own total lines.
export function printRowsToPdf({ title = 'Report', rows = [], filterSummary = [], printedBy = '', generatedAt = '', grandTotal = true }) {
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
    const footer = grandTotal ? buildGrandTotalFooter(data) : null;

    autoTable(doc, {
      startY,
      head: [headers],
      body,
      foot: footer ? [footer] : [],
      styles: { fontSize: 8, cellPadding: 4, textColor: [0, 0, 0] },
      headStyles: { fillColor: [152, 152, 152], textColor: [255, 255, 255] },
      footStyles: { fillColor: [152, 152, 152], textColor: [255, 255, 255], fontStyle: 'bold' },
      showFoot: 'lastPage',
      margin: { left: 24, right: 24 },
      didDrawPage: () => drawFooter(),
    });
  }

  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}

/**
 * Dedicated PDF generator for Item Ledger (detail & summary views).
 * The detail view has 17 columns — requires explicit widths, tight fonts, and
 * shortened multi-line headers so everything fits in landscape A4.
 * mode: 'download' | 'print'
 */
export function exportItemLedgerPdf({
  title = 'Item Ledger Report',
  rows = [],
  isSummary = false,
  filterSummary = [],
  printedBy = '',
  generatedAt = '',
  mode = 'download',
  fileName = 'item-ledger',
}) {
  const data = safeRows(rows);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const { startY, drawFooter } = addPdfMeta(doc, title, filterSummary, printedBy, generatedAt);

  if (data.length === 0) {
    doc.setFontSize(11);
    doc.text('No records found.', 40, startY + 10);
    drawFooter();
    if (mode === 'print') { doc.autoPrint(); window.open(doc.output('bloburl'), '_blank'); }
    else doc.save(`${fileName}.pdf`);
    return;
  }

  const fmt = (n) => Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sumCol = (rows, key) => rows.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0);

  if (isSummary) {
    // 12 columns — more breathing room
    const keys = [
      'Item Code', 'Item Name', 'Category', 'Subcategory',
      'Opening Qty', 'Total Received', 'Received Amount',
      'Total Issued', 'Issued Amount',
      'Remaining Qty', 'Remaining Amount', 'Remaining Breakdown',
    ];
    const displayHeaders = [
      'Item Code', 'Item Name', 'Category', 'Subcategory',
      'Opening\nQty', 'Total\nReceived', 'Received\nAmount',
      'Total\nIssued', 'Issued\nAmount',
      'Rem\nQty', 'Rem\nAmount', 'Rem Breakdown',
    ];
    const body = data.map((row) => keys.map((k) => String(row[k] ?? '')));
    const grandTotal = [
      'Grand Total', '', '', '',
      fmt(sumCol(data, 'Opening Qty')),
      fmt(sumCol(data, 'Total Received')),
      fmt(sumCol(data, 'Received Amount')),
      fmt(sumCol(data, 'Total Issued')),
      fmt(sumCol(data, 'Issued Amount')),
      fmt(sumCol(data, 'Remaining Qty')),
      fmt(sumCol(data, 'Remaining Amount')),
      '',
    ];

    autoTable(doc, {
      startY,
      head: [displayHeaders],
      body,
      foot: [grandTotal],
      showFoot: 'lastPage',
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', textColor: [0, 0, 0] },
      headStyles: { fillColor: [152, 152, 152], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', valign: 'middle' },
      footStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: 90 },
        2: { cellWidth: 65 },
        3: { cellWidth: 65 },
        4: { cellWidth: 46, halign: 'right' },
        5: { cellWidth: 52, halign: 'right' },
        6: { cellWidth: 62, halign: 'right' },
        7: { cellWidth: 50, halign: 'right' },
        8: { cellWidth: 60, halign: 'right' },
        9: { cellWidth: 54, halign: 'right' },
        10: { cellWidth: 62, halign: 'right' },
        11: { cellWidth: 'auto' },
      },
      margin: { left: 24, right: 24 },
      didDrawPage: () => drawFooter(),
    });

  } else {
    // 18 columns (added Department) — use compressed font + shortened multi-line headers
    const keys = [
      'Date', 'Item Code', 'Item Name', 'Category', 'Subcategory',
      'Received Qty', 'Received Rate', 'Received Amount',
      'Issuance Qty', 'Issuance Amount', 'Issuance Breakdown',
      'Department',
      'Remaining Qty', 'Remaining Amount', 'Remaining Breakdown',
      'Unit', 'Source', 'Reference',
    ];
    const displayHeaders = [
      'Date', 'Code', 'Item Name', 'Category', 'Subcategory',
      'Rcvd\nQty', 'Rate', 'Rcvd\nAmt',
      'Iss\nQty', 'Iss\nAmt', 'Iss\nBrkdwn',
      'Dept',
      'Rem\nQty', 'Rem\nAmt', 'Rem\nBrkdwn',
      'Unit', 'Source', 'Ref No',
    ];
    const body = data.map((row) => keys.map((k) => String(row[k] ?? '')));
    const nonOpeningRows = data.filter((r) => r['Source'] !== 'OPENING');
    const grandTotal = [
      'Grand Total', '', '', '', '',
      fmt(sumCol(nonOpeningRows, 'Received Qty')),
      '',
      fmt(sumCol(nonOpeningRows, 'Received Amount')),
      fmt(sumCol(data, 'Issuance Qty')),
      fmt(sumCol(data, 'Issuance Amount')),
      '', '',
      '-',
      '-',
      '', '', '', '',
    ];

    autoTable(doc, {
      startY,
      head: [displayHeaders],
      body,
      foot: [grandTotal],
      showFoot: 'lastPage',
      styles: { fontSize: 6, cellPadding: 2, overflow: 'linebreak', textColor: [0, 0, 0] },
      headStyles: { fillColor: [152, 152, 152], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 6 },
      footStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'right', fontSize: 6 },
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: 36 },
        2: { cellWidth: 70 },
        3: { cellWidth: 48 },
        4: { cellWidth: 48 },
        5: { cellWidth: 28, halign: 'right' },
        6: { cellWidth: 30, halign: 'right' },
        7: { cellWidth: 38, halign: 'right' },
        8: { cellWidth: 28, halign: 'right' },
        9: { cellWidth: 38, halign: 'right' },
        10: { cellWidth: 44 },
        11: { cellWidth: 44 },
        12: { cellWidth: 28, halign: 'right' },
        13: { cellWidth: 38, halign: 'right' },
        14: { cellWidth: 44 },
        15: { cellWidth: 24 },
        16: { cellWidth: 32 },
        17: { cellWidth: 'auto' },
      },
      margin: { left: 20, right: 20 },
      didDrawPage: () => drawFooter(),
    });
  }

  if (mode === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(`${fileName}.pdf`);
  }
}

/**
 * Generates a formatted Sales Invoice PDF (Portrait A4)
 * mode: 'download' → saves file | 'print' → opens browser print dialog
 */
// Sales Invoice print — a plain HTML page in a popup (real Arial 9pt, tight
// spacing, fixed on A4), the same popup-print pattern as the hospital's
// slips. 'download' still builds the PDF below.
const escHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money2 = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function printSalesInvoiceHtml(inv) {
  const who = inv.customerType === 'admission'
    ? ['Admission #', inv.customerName || '-']
    : ['Patient', inv.customerType === 'customer' ? (inv.customerName || 'N/A') : 'Walking Customer'];
  const date = inv.invoiceDate
    ? new Date(inv.invoiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '-';
  const rows = (inv.items || []).map((line, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${escHtml(`${Number(line.quantity) < 0 ? 'Return: ' : ''}${line.item?.name || '-'}`)}</td>
      <td class="r">${money2(line.saleRate)}</td>
      <td class="c">${escHtml(line.quantity)}</td>
      <td class="r">${money2(line.totalAmount)}</td>
    </tr>`).join('');
  const subTotal = Number(inv.subTotal ?? inv.totalAmount ?? 0);
  const discountPercent = Number(inv.discountPercent || 0);
  const discountAmount = Number(inv.discountAmount || 0);
  const grandTotal = Number(inv.totalAmount || 0);

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<title>Sales Invoice ${escHtml(inv.code || '')}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; line-height: 1.25; color: #000; background: #fff; width: 190mm; margin: 0 auto; }
  h1 { font-size: 12pt; text-align: center; margin-bottom: 3px; }
  .rule { border-top: 1px solid #000; margin-bottom: 4px; }
  .meta { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
  .meta b { margin-right: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 0.5pt solid #777; padding: 2px 4px; vertical-align: top; }
  th { background: #e5e5e5; font-weight: 700; text-align: left; }
  .c { text-align: center; } .r { text-align: right; }
  th.c { text-align: center; } th.r { text-align: right; }
  .tot { width: 65mm; margin: 4px 0 0 auto; }
  .tot div { display: flex; justify-content: space-between; padding: 1px 0; }
  .tot .grand { font-weight: 700; border-top: 1px solid #000; margin-top: 2px; padding-top: 2px; }
  .disc { color: #b00; }
  @page { size: A4 portrait; margin: 10mm; }
</style></head><body>
  <h1>Fair Price Medical Store</h1>
  <div class="rule"></div>
  <div class="meta">
    <div><b>Invoice No:</b>${escHtml(inv.code || '-')}</div>
    <div><b>${who[0]}:</b>${escHtml(who[1])}</div>
    <div><b>Date:</b>${escHtml(date)}</div>
  </div>
  <table>
    <thead><tr><th class="c" style="width:10mm">S.No</th><th>Description</th><th class="r" style="width:24mm">Rate</th><th class="c" style="width:14mm">Qty</th><th class="r" style="width:26mm">Amount</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" class="c">—</td></tr>'}</tbody>
  </table>
  <div class="tot">
    <div><span>Sub Total:</span><span>${money2(subTotal)}</span></div>
    ${discountPercent > 0 ? `<div class="disc"><span>Discount (${discountPercent}%):</span><span>- ${money2(discountAmount)}</span></div>` : ''}
    <div class="grand"><span>Grand Total:</span><span>${money2(grandTotal)}</span></div>
  </div>
  <script>window.onload = function () { window.print(); };</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=900');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export function generateSalesInvoicePdf({ inv, mode = 'download' }) {
  if (!inv) return;
  if (mode === 'print') { printSalesInvoiceHtml(inv); return; }

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
    headStyles: { fillColor: [152, 152, 152], textColor: 255, fontStyle: 'bold' },
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
 * Generates a Maintenance Note / Gate Pass PDF (Portrait A4)
 * billType: 'sent'     → Bill 1 (item sent for repair)
 * billType: 'received' → Bill 2 (item received back)
 * mode: 'download' | 'print'
 */
export function generateMaintenanceBillPdf({ record, billType = 'sent', mode = 'download', printedBy = '', generatedAt = '' }) {
  if (!record) return;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  // ── HEADING ────────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Maintenance Note / Gate Pass', pageWidth / 2, 44, { align: 'center' });

  // Bill type subtitle
  const subtitle = billType === 'sent' ? 'Sent for Repair — Bill 1' : 'Received from Repair — Bill 2';
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(subtitle, pageWidth / 2, 58, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Blue divider
  doc.setLineWidth(1);
  doc.setDrawColor(30, 64, 175);
  doc.line(margin, 66, pageWidth - margin, 66);

  // ── META INFO ──────────────────────────────────────────────
  const moNo = record.moNumber || String(record.id);
  const sentDate = record.date
    ? new Date(record.date).toLocaleDateString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '-';
  const receivedDate = record.receivedDate
    ? new Date(record.receivedDate).toLocaleDateString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '-';
  // Location shown inline per tag (matches the on-screen "Select Asset
  // Units" picker, which shows a Location chip when the unit has one) —
  // units without a recorded location just show their bare tag.
  const assetTags =
    Array.isArray(record.assetInstances) && record.assetInstances.length > 0
      ? record.assetInstances.map((a) => (a.location ? `${a.assetTag} [${a.location}]` : a.assetTag)).join(', ')
      : '-';
  const employeeName = record.employee
    ? `${record.employee.firstName || ''} ${record.employee.lastName || ''}`.trim()
    : '-';

  doc.setFontSize(10);
  doc.setDrawColor(0, 0, 0);

  let ly = 82; // left column y start
  const drawMeta = (label, value, y, isLeft = true) => {
    const lx = isLeft ? margin : pageWidth - margin - 160;
    const vx = isLeft ? margin + 72 : pageWidth - margin;
    const valign = isLeft ? 'left' : 'right';
    doc.setFont('helvetica', 'bold');   doc.text(`${label}:`, lx, y);
    doc.setFont('helvetica', 'normal'); doc.text(String(value || '-'), isLeft ? vx : vx, y, isLeft ? {} : { align: 'right' });
  };

  // Left column
  drawMeta('MO No',      moNo,                     82,  true);
  drawMeta('Item',       record.item?.name || '-',  98,  true);
  drawMeta('Asset Tags', assetTags,                 114, true);
  drawMeta('Vendor',     record.supplier?.name || '-', 130, true);
  drawMeta('Employee',   employeeName,              146, true);

  // Right column
  drawMeta('Date Sent', sentDate, 82, false);
  if (billType === 'received') {
    drawMeta('Date Rcvd', receivedDate,          98,  false);
    drawMeta('Checked By', record.checkedBy || '-', 114, false);
    if (record.warrantyDays) {
      drawMeta('Warranty', `${record.warrantyDays} days`, 130, false);
    }
  }

  // Grey divider
  doc.setLineWidth(0.5);
  doc.setDrawColor(180, 180, 180);
  const divY = 162;
  doc.line(margin, divY, pageWidth - margin, divY);

  // ── TABLE ──────────────────────────────────────────────────
  const tableBody = [[
    '1',
    record.natureOfRepair || '-',
    record.cost != null ? `PKR ${Number(record.cost).toLocaleString()}` : '-',
  ]];

  autoTable(doc, {
    startY: divY + 10,
    head: [['S.No', 'Nature of Repair', 'Estimated Cost']],
    body: tableBody,
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [152, 152, 152], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 40 },
      1: { halign: 'left' },
      2: { halign: 'right', cellWidth: 120 },
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

  // ── SIGNATURES ─────────────────────────────────────────────
  const sigY = Math.max(y + 60, tableEndY + 130);
  const sigLineW = 90;
  const sigPositions = [
    { x: margin,                          label: 'Store Keeper'  },
    { x: pageWidth / 2 - sigLineW / 2,   label: 'Employee'      },
    { x: pageWidth - margin - sigLineW,   label: 'C.E.O.'        },
  ];
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setDrawColor(100, 100, 100);
  sigPositions.forEach(({ x, label }) => {
    doc.setLineWidth(0.6);
    doc.line(x, sigY, x + sigLineW, sigY);
    doc.text(label, x + sigLineW / 2, sigY + 12, { align: 'center' });
  });

  // ── GENERATED BY FOOTER ────────────────────────────────────
  const footerY = pageHeight - 18;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(140, 140, 140);
  doc.setLineWidth(0.3);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, footerY - 6, pageWidth - margin, footerY - 6);

  const footerParts = [];
  if (printedBy)   footerParts.push(`Generated by: ${printedBy}`);
  if (generatedAt) {
    const dt = new Date(generatedAt);
    const formatted = dt.toLocaleDateString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + dt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
    footerParts.push(`Date & Time: ${formatted}`);
  }
  if (footerParts.length > 0) {
    doc.text(footerParts.join('   |   '), margin, footerY);
  }

  doc.setTextColor(0, 0, 0);

  // ── OUTPUT ─────────────────────────────────────────────────
  const fileName = `maintenance-${moNo}-${billType}.pdf`;
  if (mode === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(fileName);
  }
}
