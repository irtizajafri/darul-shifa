const { saveSnapshot, getSnapshot } = require('./payslip-snapshot.service');

async function save(req, res) {
  try {
    const { empCode, month, year, rows, netSalary } = req.body;
    if (!empCode || !month || !year || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'empCode, month, year, rows required' });
    }
    await saveSnapshot(String(empCode), String(month), String(year), rows, netSalary);
    res.json({ ok: true });
  } catch (err) {
    console.error('payslip-snapshot save error:', err);
    res.status(500).json({ error: 'Save failed' });
  }
}

async function get(req, res) {
  try {
    const { empCode, month, year } = req.query;
    if (!empCode || !month || !year) {
      return res.status(400).json({ error: 'empCode, month, year required' });
    }
    const snapshot = await getSnapshot(String(empCode), String(month), String(year));
    res.json({ data: snapshot });
  } catch (err) {
    console.error('payslip-snapshot get error:', err);
    res.status(500).json({ error: 'Fetch failed' });
  }
}

module.exports = { save, get };
