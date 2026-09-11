import logoSvgRaw from '../assets/logo.svg?raw';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtPKR = (n) =>
  n != null ? Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';

const fmtDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
};

const fmtMonthYear = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
};

// Compare just the date part (YYYY-MM-DD) regardless of time / timezone
const dateStr = (d) => new Date(d).toISOString().slice(0, 10);

// Filter readings to [from, to] inclusive using date-only comparison
function filterByPeriod(readings, from, to) {
  const f = from ? from.slice(0, 10) : null;
  const t = to   ? to.slice(0, 10)   : null;
  return readings.filter((r) => {
    if (!r.date) return false;
    const d = dateStr(r.date);
    if (f && d < f) return false;
    if (t && d > t) return false;
    return true;
  }).sort((a, b) => dateStr(a.date).localeCompare(dateStr(b.date)));
}

/**
 * Given a sorted-ascending list of period readings, return
 *   { startReading, endReading, billedUnits }
 *
 * Strategy:
 *   startReading = first reading's dayStart (the meter value on the 1st of the month)
 *   endReading   = last  reading's dayEnd (the meter value on the last day of the month)
 *   billedUnits  = endReading − startReading
 *
 *   Fallback: if dayStart/dayEnd not recorded → sum of each day's totalUnits
 */
function calcUnits(sortedReadings) {
  if (!sortedReadings.length) return { startReading: 0, endReading: 0, billedUnits: 0 };

  const first = sortedReadings[0];
  const last  = sortedReadings[sortedReadings.length - 1];

  const startReading = first.dayStart ?? first.nightStart ?? null;
  const endReading   = last.dayEnd   ?? last.nightEnd    ?? last.dayStart ?? null;

  if (startReading != null && endReading != null && endReading >= startReading) {
    return { startReading, endReading, billedUnits: endReading - startReading };
  }

  // Fallback: daily totalUnits sum
  const total = sortedReadings.reduce((s, r) => s + Number(r.totalUnits || 0), 0);
  return { startReading: startReading ?? 0, endReading: endReading ?? 0, billedUnits: total };
}

// Build monthly history: last 7 months, sorted oldest → newest
// Each bar = (last reading's dayEnd) − (first reading's dayStart) for that month
function buildHistory(allReadings) {
  const map = {};
  allReadings.forEach((r) => {
    const key = dateStr(r.date).slice(0, 7); // YYYY-MM
    if (!map[key]) map[key] = [];
    map[key].push(r);
  });

  return Object.keys(map)
    .sort()
    .slice(-7)
    .map((key) => {
      const sorted = map[key].sort((a, b) => dateStr(a.date).localeCompare(dateStr(b.date)));
      const { billedUnits } = calcUnits(sorted);
      const d = new Date(key + '-01');
      return { key, label: d.toLocaleDateString('en-US', { month: 'short' }), units: billedUnits };
    });
}

// ─── Main Print Function ───────────────────────────────────────────────────────
/**
 * @param {object} p
 * @param {object} p.meter        - meter object { meterNo, departmentName, location, utility }
 * @param {string} p.fromDate     - period start (YYYY-MM-DD)
 * @param {string} p.toDate       - period end   (YYYY-MM-DD)
 * @param {Array}  p.readings     - ALL readings for this meter (for history + period calc)
 * @param {Array}  p.rates        - rate history sorted DESC by effectiveFrom
 * @param {string} p.tariff       - e.g. "A-1R"
 * @param {number} p.outstanding  - outstanding amount (0 = NIL)
 * @param {string} p.dueDate      - ISO date string
 * @param {number} p.surcharge    - late surcharge added after due date
 * @param {string} p.note         - optional note text
 * @param {string} p.remarks      - pre-filled remarks
 */
export function printUtilityBill({
  meter,
  fromDate,
  toDate,
  readings = [],
  rates = [],
  tariff = 'A-1R',
  outstanding = 0,
  dueDate,
  surcharge = 0,
  note = '',
  remarks = '',
}) {
  // ── Period calculations ──────────────────────────────────────────────────
  const periodReadings = filterByPeriod(readings, fromDate, toDate);
  const { startReading, endReading, billedUnits } = calcUnits(periodReadings);

  const currentRate   = rates.length ? Number(rates[0].rate || 0) : 0;
  const billingAmt    = billedUnits * currentRate;
  const outstandingAmt = Number(outstanding || 0);
  const totalDue      = outstandingAmt + billingAmt;
  const afterDue      = totalDue + Number(surcharge || 0);

  const finalDueDate = dueDate || (() => {
    if (!toDate) return '';
    const d = new Date(toDate);
    d.setDate(d.getDate() + 10);
    return d.toISOString().slice(0, 10);
  })();

  // ── Previous month comparison ────────────────────────────────────────────
  const history       = buildHistory(readings);
  const maxUnits      = Math.max(...history.map((h) => h.units), 1);

  // Current and previous month keys
  const curKey  = toDate   ? toDate.slice(0, 7)   : '';
  const prevKey = fromDate ? (() => {
    const d = new Date(fromDate);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  })() : '';

  const curEntry  = history.find((h) => h.key === curKey);
  const prevEntry = history.find((h) => h.key === prevKey);
  const curMonthUnits  = curEntry  ? curEntry.units  : billedUnits;
  const lastMonthUnits = prevEntry ? prevEntry.units : 0;
  const extraUnits = curMonthUnits - lastMonthUnits;
  const changePct  = lastMonthUnits > 0
    ? Math.round(((curMonthUnits - lastMonthUnits) / lastMonthUnits) * 100)
    : 0;
  const isIncrease = changePct >= 0;

  // ── Inline SVG — make it scale to container width ───────────────────────
  const logoSvg = logoSvgRaw
    .replace(/\bwidth="[^"]*"/, '')          // remove fixed width attr
    .replace(/\bheight="[^"]*"/, '')         // remove fixed height attr
    .replace(/<svg /, '<svg style="width:80%;height:auto;display:block;margin:0 auto" ');

  // ── Bill metadata ────────────────────────────────────────────────────────
  const billedTo    = meter.departmentName || meter.location || meter.meterNo || 'N/A';
  const meterDisplay = meter.meterNo || meter.departmentName || '-';

  // ── Chart bars HTML ──────────────────────────────────────────────────────
  const bars = history.map((h) => {
    const pct = maxUnits > 0 ? Math.max(4, Math.round((h.units / maxUnits) * 80)) : 4;
    const isCur = h.key === curKey;
    return `
      <div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0">
        <div style="font-size:7px;color:#666;margin-bottom:2px">${h.units.toLocaleString()}</div>
        <div style="height:${pct}px;width:18px;background:${isCur ? '#1a3a5c' : '#7ba7c9'};border-radius:2px 2px 0 0"></div>
        <div style="font-size:7.5px;color:#555;margin-top:3px;font-weight:${isCur ? '700' : '400'}">${h.label}</div>
      </div>`;
  }).join('');

  // ── HTML ─────────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Utility Bill</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,Helvetica,sans-serif; font-size:10px; color:#111; background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .page { width:190mm; margin:0 auto; }
  @page { size:A4; margin:10mm 12mm; }
  @media print { body { margin:0; } }
</style>
</head>
<body>
<div class="page">

  <!-- ═══ HEADER — logo only ═══ -->
  <div style="border:1px solid #c5d3e0;border-radius:4px 4px 0 0;padding:6px 14px;background:#fff">
    ${logoSvg}
  </div>

  <!-- ═══ CUSTOMER INFO ═══ -->
  <div style="display:flex;background:#eef2f7;border:1px solid #c5d3e0;border-top:none">
    <div style="flex:1.4;padding:9px 14px;border-right:1px solid #c5d3e0">
      <div style="font-size:7.5px;color:#7a90a5;text-transform:uppercase;letter-spacing:.6px;font-weight:700">Billed To</div>
      <div style="font-size:12px;font-weight:800;color:#0f2a47;margin-top:3px">${billedTo}</div>
      <div style="font-size:8.5px;color:#4a6070;margin-top:2px">Meter # ${meterDisplay}</div>
    </div>
    <div style="flex:1;padding:9px 14px;border-right:1px solid #c5d3e0">
      <div style="font-size:7.5px;color:#7a90a5;text-transform:uppercase;letter-spacing:.6px;font-weight:700">Billing Month</div>
      <div style="font-size:11.5px;font-weight:800;color:#0f2a47;margin-top:3px">${fmtMonthYear(fromDate)}</div>
      <div style="font-size:8px;color:#4a6070;margin-top:2px">${fmtDate(fromDate)} — ${fmtDate(toDate)}</div>
    </div>
    <div style="flex:.7;padding:9px 14px">
      <div style="font-size:7.5px;color:#7a90a5;text-transform:uppercase;letter-spacing:.6px;font-weight:700">Tariff</div>
      <div style="font-size:14px;font-weight:900;color:#1a3a5c;margin-top:3px">${tariff || 'A-1R'}</div>
    </div>
  </div>

  <!-- ═══ AMOUNT DUE + BILLING SUMMARY ═══ -->
  <div style="display:flex;border:1px solid #c5d3e0;border-top:none">
    <!-- Amount boxes (left) -->
    <div style="display:flex;flex-direction:column">
      <div style="background:#1a3a5c;padding:11px 18px;flex:1">
        <div style="color:#a8c4dc;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px">Amount Due</div>
        <div style="color:#fff;font-size:22px;font-weight:900;margin-top:4px;white-space:nowrap">PKR ${fmtPKR(totalDue)}</div>
      </div>
      <div style="background:#c8a84b;padding:9px 18px;border-top:1px solid #b0903a">
        <div style="color:#5a3d00;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px">Due Date</div>
        <div style="color:#2a1500;font-size:14px;font-weight:900;margin-top:3px;white-space:nowrap">${fmtDate(finalDueDate)}</div>
      </div>
    </div>
    <!-- Billing Summary (right) -->
    <div style="flex:1;padding:10px 14px;border-left:1px solid #c5d3e0">
      <div style="background:#1a3a5c;color:#fff;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:4px 9px;border-radius:2px;margin-bottom:8px">Billing Summary</div>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="font-size:9px;color:#444;padding:3px 0;border-bottom:1px solid #eee">Outstanding Bill Amount</td>
          <td style="font-size:9px;font-weight:700;text-align:right;padding:3px 0;border-bottom:1px solid #eee">${outstandingAmt > 0 ? 'PKR ' + fmtPKR(outstandingAmt) : 'NIL'}</td>
        </tr>
        <tr>
          <td style="font-size:9px;color:#444;padding:3px 0;border-bottom:1px solid #eee">Current Bill Amount</td>
          <td style="font-size:9px;font-weight:700;text-align:right;padding:3px 0;border-bottom:1px solid #eee">PKR ${fmtPKR(billingAmt)}</td>
        </tr>
        <tr>
          <td style="font-size:9px;color:#444;padding:3px 0;border-bottom:1px solid #eee">Amount Payable Till Due Date</td>
          <td style="font-size:9px;font-weight:700;text-align:right;padding:3px 0;border-bottom:1px solid #eee">PKR ${fmtPKR(totalDue)}</td>
        </tr>
        <tr>
          <td style="font-size:9px;color:#c0392b;padding:3px 0">After Due Date</td>
          <td style="font-size:9px;font-weight:700;color:#c0392b;text-align:right;padding:3px 0">PKR ${fmtPKR(afterDue)}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- ═══ BILLING DETAILS ═══ -->
  <div style="background:#2d4a65;color:#fff;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:5px 12px;border:1px solid #1a3a5c;border-top:none">
    Billing Details
  </div>

  <div style="display:flex;border:1px solid #c5d3e0;border-top:none">
    <!-- Left: Readings grid + billing row -->
    <div style="flex:1.4;padding:12px 14px;border-right:1px solid #c5d3e0">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:10px">
        <div style="border:1px solid #c5d3e0;border-radius:4px;padding:8px 11px;background:#f7fafd">
          <div style="font-size:7.5px;color:#7a90a5;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Present Reading</div>
          <div style="font-size:18px;font-weight:900;color:#0f2a47;margin-top:4px;line-height:1">${Math.round(endReading).toLocaleString()}</div>
        </div>
        <div style="border:1px solid #c5d3e0;border-radius:4px;padding:8px 11px;background:#f7fafd">
          <div style="font-size:7.5px;color:#7a90a5;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Previous Reading</div>
          <div style="font-size:18px;font-weight:900;color:#0f2a47;margin-top:4px;line-height:1">${Math.round(startReading).toLocaleString()}</div>
        </div>
      </div>
      <div style="display:flex;background:#e8f0f7;border-radius:4px;padding:7px 10px;gap:0">
        <div style="flex:1;border-right:1px solid #c5d3e0;padding-right:10px">
          <div style="font-size:7.5px;color:#5a7085;text-transform:uppercase;letter-spacing:.5px">Billed Units</div>
          <div style="font-size:14px;font-weight:900;color:#0f2a47;margin-top:3px">${Math.round(billedUnits).toLocaleString()}</div>
        </div>
        <div style="flex:1;padding:0 10px;border-right:1px solid #c5d3e0">
          <div style="font-size:7.5px;color:#5a7085;text-transform:uppercase;letter-spacing:.5px">Per Unit Rate</div>
          <div style="font-size:14px;font-weight:900;color:#0f2a47;margin-top:3px">PKR ${fmtPKR(currentRate)}</div>
        </div>
        <div style="flex:1;padding-left:10px">
          <div style="font-size:7.5px;color:#5a7085;text-transform:uppercase;letter-spacing:.5px">Billing Amount</div>
          <div style="font-size:14px;font-weight:900;color:#1a3a5c;margin-top:3px">PKR ${fmtPKR(billingAmt)}</div>
        </div>
      </div>
    </div>
    <!-- Right: Month comparison -->
    <div style="flex:1;padding:12px 14px">
      <div style="font-size:8px;font-weight:700;color:#2d4a65;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;border-bottom:1px solid #e0e8f0;padding-bottom:5px">Monthly Comparison</div>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="font-size:9px;color:#555;padding:4px 0;border-bottom:1px solid #f0f0f0">Last Month Units</td>
          <td style="font-size:11px;font-weight:800;color:#111;text-align:right;padding:4px 0;border-bottom:1px solid #f0f0f0">${Math.round(lastMonthUnits).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="font-size:9px;color:#555;padding:4px 0;border-bottom:1px solid #f0f0f0">Current Month Units</td>
          <td style="font-size:11px;font-weight:800;color:#111;text-align:right;padding:4px 0;border-bottom:1px solid #f0f0f0">${Math.round(curMonthUnits).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="font-size:9px;color:#555;padding:4px 0">Difference</td>
          <td style="font-size:11px;font-weight:800;color:${extraUnits > 0 ? '#c0392b' : '#27ae60'};text-align:right;padding:4px 0">${extraUnits >= 0 ? '+' : ''}${Math.round(extraUnits).toLocaleString()}</td>
        </tr>
      </table>
      <div style="margin-top:8px;background:${isIncrease ? '#fff5f5' : '#f0fff4'};border:1px solid ${isIncrease ? '#f5c6cb' : '#c3e6cb'};border-radius:4px;padding:6px 10px;text-align:center">
        <div style="font-size:20px;font-weight:900;color:${isIncrease ? '#c0392b' : '#27ae60'}">${Math.abs(changePct)}% ${isIncrease ? '▲' : '▼'}</div>
        <div style="font-size:8px;color:${isIncrease ? '#922b21' : '#1e8449'};margin-top:2px;font-weight:700">${isIncrease ? 'INCREASE' : 'DECREASE'}</div>
      </div>
    </div>
  </div>

  <!-- ═══ HISTORY CHART + NOTE ═══ -->
  <div style="display:flex;border:1px solid #c5d3e0;border-top:none;gap:0">
    <!-- Bar chart -->
    <div style="flex:1.4;padding:10px 14px;border-right:1px solid #c5d3e0">
      <div style="font-size:8px;font-weight:700;color:#2d4a65;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">History</div>
      <div style="display:flex;align-items:flex-end;height:90px;gap:4px;padding-bottom:4px;border-bottom:1px solid #e0e8f0">
        ${bars || '<div style="font-size:9px;color:#aaa;padding:10px">No data</div>'}
      </div>
    </div>
    <!-- Note -->
    <div style="flex:1;padding:10px 14px">
      <div style="background:#1a3a5c;color:#fff;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:3px 8px;border-radius:2px;margin-bottom:6px">Note</div>
      <div style="font-size:9px;color:#333;line-height:1.5;min-height:60px">${note || ''}</div>
    </div>
  </div>

  <!-- ═══ PAY STUB DIVIDER ═══ -->
  <div style="position:relative;margin:12px 0 8px;border-top:2px dashed #aaa;text-align:center">
    <span style="position:absolute;left:50%;transform:translate(-50%,-50%);background:#fff;padding:0 10px;font-size:7.5px;color:#777;letter-spacing:1.5px;font-weight:700;white-space:nowrap">
      ✂ &nbsp; PAY STUB — DETACH AND SEND WITH PAYMENT &nbsp; ✂
    </span>
  </div>

  <!-- ═══ PAY STUB ═══ -->
  <div style="display:flex;border:1px solid #c5d3e0;border-radius:3px;overflow:hidden">
    <!-- Left: Customer info -->
    <div style="flex:1.2;padding:10px 14px;border-right:1px solid #c5d3e0">
      <div style="font-size:8px;color:#7a90a5;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Billed To</div>
      <div style="font-size:13px;font-weight:900;color:#0f2a47;margin-top:3px">${billedTo}</div>
      <div style="font-size:8.5px;color:#4a6070;margin-top:2px">Meter # ${meterDisplay}</div>
      <div style="font-size:8.5px;color:#4a6070;margin-top:1px">Billing Month: ${fmtMonthYear(fromDate)}</div>
      <div style="font-size:8.5px;color:#4a6070">Tariff: ${tariff || 'A-1R'}</div>
      <div style="background:#1a3a5c;color:#fff;padding:5px 10px;border-radius:3px;margin-top:7px;font-size:9.5px;font-weight:700">
        Total Amount Due: &nbsp; PKR ${fmtPKR(totalDue)}
      </div>
    </div>
    <!-- Right: Billing summary repeated -->
    <div style="flex:1;padding:10px 14px">
      <div style="background:#1a3a5c;color:#fff;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:4px 9px;border-radius:2px;margin-bottom:7px">Billing Summary</div>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="font-size:8.5px;color:#444;padding:2.5px 0;border-bottom:1px solid #eee">Outstanding Bill Amount</td>
          <td style="font-size:8.5px;font-weight:700;text-align:right;padding:2.5px 0;border-bottom:1px solid #eee">${outstandingAmt > 0 ? 'PKR ' + fmtPKR(outstandingAmt) : 'NIL'}</td>
        </tr>
        <tr>
          <td style="font-size:8.5px;color:#444;padding:2.5px 0;border-bottom:1px solid #eee">Current Bill Amount</td>
          <td style="font-size:8.5px;font-weight:700;text-align:right;padding:2.5px 0;border-bottom:1px solid #eee">PKR ${fmtPKR(billingAmt)}</td>
        </tr>
        <tr>
          <td style="font-size:8.5px;color:#444;padding:2.5px 0;border-bottom:1px solid #eee">Amount Payable Till Due Date</td>
          <td style="font-size:8.5px;font-weight:700;text-align:right;padding:2.5px 0;border-bottom:1px solid #eee">PKR ${fmtPKR(totalDue)}</td>
        </tr>
        <tr>
          <td style="font-size:8.5px;color:#c0392b;padding:2.5px 0">After Due Date</td>
          <td style="font-size:8.5px;font-weight:700;color:#c0392b;text-align:right;padding:2.5px 0">PKR ${fmtPKR(afterDue)}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- ═══ REMARKS + SIGNATURE ═══ -->
  <div style="margin-top:12px;border:1px solid #c5d3e0;border-radius:3px;padding:10px 14px">
    <div style="margin-bottom:10px">
      <div style="font-size:8px;color:#7a90a5;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Remarks</div>
      <div style="font-size:9px;color:#333;min-height:20px;border-bottom:1px solid #aaa;padding-bottom:3px">${remarks || ''}</div>
    </div>
    <div style="display:flex;gap:0;justify-content:space-between;margin-top:14px">
      <div style="flex:1;text-align:center;padding:0 12px">
        <div style="border-bottom:1.5px solid #333;height:28px;margin-bottom:4px"></div>
        <div style="font-size:8px;color:#666;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Authorized Signature</div>
      </div>
      <div style="flex:1;text-align:center;padding:0 12px">
        <div style="border-bottom:1.5px solid #333;height:28px;margin-bottom:4px"></div>
        <div style="font-size:8px;color:#666;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Recipient Signature</div>
      </div>
      <div style="flex:1;text-align:center;padding:0 12px">
        <div style="border-bottom:1.5px solid #333;height:28px;margin-bottom:4px"></div>
        <div style="font-size:8px;color:#666;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Date</div>
      </div>
    </div>
  </div>

</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Popup blocked — please allow popups in your browser');
    return;
  }
  win.document.write(html);
  win.document.close();
}
