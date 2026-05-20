export function printPODocument(result) {
  const poItems = result?.records ? result.records : Array.isArray(result) ? result : [result];
  if (!poItems.length) return;

  const first = poItems[0];
  const poCode = result?.batchCode || first.code || '';
  const supplierName = first.supplier?.name || '';
  const poDate = first.poDate
    ? new Date(first.poDate).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  let totalEst = 0;
  const rows = poItems.map((po, idx) => {
    const qty = Number(po.requiredQuantity) || 0;
    const rate = Number(po.orderedRate) || 0;
    const total = qty * rate;
    totalEst += total;
    return `<tr>
      <td>${idx + 1}</td>
      <td class="desc">${po.item?.name || '-'}</td>
      <td>${qty || '-'}</td>
      <td>${rate ? rate.toFixed(2) : '-'}</td>
      <td>${total > 0 ? total.toFixed(2) : '-'}</td>
      <td>${po.lastPurchaseQuantity ?? '-'}</td>
      <td>${po.lastPurchaseRate != null ? Number(po.lastPurchaseRate).toFixed(2) : '-'}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Purchase Order</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A5; margin: 12mm 10mm 10mm 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Poppins', sans-serif; font-size: 8.5pt; color: #111; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
    .title { font-size: 17pt; font-weight: 700; letter-spacing: 0.3px; }
    .po-meta { text-align: right; font-size: 8pt; line-height: 1.7; }
    .divider { border: none; border-top: 2px solid #aaa; margin-bottom: 7px; }
    .supplier-section { border: 1px solid #bbb; margin-bottom: 12px; }
    .supplier-row { display: flex; }
    .supplier-label { background: #e8e8e8; padding: 5px 10px; font-weight: 600; font-size: 8pt; white-space: nowrap; border-right: 1px solid #bbb; }
    .supplier-value { padding: 5px 10px; font-size: 8pt; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    thead tr { background: #e8e8e8; }
    th { padding: 5px 3px; font-weight: 600; text-align: center; border: 1px solid #bbb; font-size: 7.5pt; line-height: 1.4; }
    tbody tr td { border: 1px solid #ddd; padding: 4px 3px; text-align: center; font-size: 7.5pt; }
    tbody tr td.desc { text-align: left; padding-left: 5px; }
    tbody tr:nth-child(even) { background: #f9f9f9; }
    .total-section { display: flex; justify-content: flex-end; margin-bottom: 24px; }
    .total-box { display: flex; border: 1px solid #bbb; }
    .total-label { background: #e8e8e8; padding: 5px 16px; font-weight: 600; font-size: 8.5pt; border-right: 1px solid #bbb; }
    .total-value { padding: 5px 16px; min-width: 80px; text-align: right; font-size: 8.5pt; }
    .signatures { display: flex; justify-content: space-between; margin-top: 60px; padding-top: 4px; }
    .sig { font-weight: 700; font-size: 9pt; }
    .sig-line { border-top: 1px solid #555; width: 80px; margin-bottom: 5px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">PURCHASE ORDER (PO)</div>
    <div class="po-meta">
      <div>PO Number: ${poCode}</div>
      <div>Date: ${poDate}</div>
    </div>
  </div>
  <hr class="divider">
  <div class="supplier-section">
    <div class="supplier-row">
      <div class="supplier-label">Supplier Name</div>
      <div class="supplier-value">${supplierName}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Item #</th>
        <th>Description</th>
        <th>Quantity<br>Req</th>
        <th>Unit Price<br>Est</th>
        <th>Total<br>Est</th>
        <th>Last Purchase<br>Qty</th>
        <th>Last Purchase<br>Rate</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total-section">
    <div class="total-box">
      <div class="total-label">Total</div>
      <div class="total-value">${totalEst > 0 ? totalEst.toFixed(2) : '-'}</div>
    </div>
  </div>
  <div class="signatures">
    <div class="sig"><div class="sig-line"></div>Store Keeper</div>
    <div class="sig"><div class="sig-line"></div>C.E.O.</div>
  </div>
  <script>document.fonts.ready.then(() => window.print());</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) setTimeout(() => URL.revokeObjectURL(url), 60000);
}