const service = require('./attendance.service');
const { success, fail } = require('../../utils/response');
const prisma = require('../../config/db');

// ─── PKT Helper ───────────────────────────────────────────────────────────────
// setHours() server ke local timezone pe depend karta hai.
// Agar server UTC pe chal raha ho toh windows galat ban jaati hain.
// Yeh helper PKT (UTC+5) mein explicitly hour set karta hai.
function pktHour(date, hour) {
  const d = new Date(date);
  const pktOffset = 5; // PKT = UTC+5
  d.setUTCHours(hour - pktOffset, 0, 0, 0);
  return d;
}

// ─── Shared Punch Pairing Logic ───────────────────────────────────────────────
// testPairing aur syncAttendance dono mein same logic tha — ab ek jagah hai.
function pairPunches(punches, isNight) {
  if (!Array.isArray(punches) || punches.length === 0) {
    return { timeIn: null, timeOut: null, workedMinutes: 0 };
  }

  const sortedPunches = punches.slice().sort((a, b) => a - b);

  // Normal duty: strict transition pairing
  // p1-p2, p3-p4 ... odd last punch => open IN (missed_out)
  if (!isNight) {
    const stutterThresholdMs = 2 * 60 * 1000; // machine double-tap guard
    const deduped = [];
    for (const p of sortedPunches) {
      const last = deduped[deduped.length - 1];
      if (!last || (p.getTime() - last.getTime()) > stutterThresholdMs) {
        deduped.push(p);
      }
    }

    if (deduped.length === 1) {
      return { timeIn: deduped[0], timeOut: null, workedMinutes: 0 };
    }

    const pairs = [];
    for (let i = 0; i < deduped.length; i += 2) {
      pairs.push({ inPunch: deduped[i], outPunch: deduped[i + 1] || null });
    }

    const firstIn = pairs[0]?.inPunch || null;
    const lastCompletePair = [...pairs].reverse().find((p) => Boolean(p.outPunch));
    const finalOut = lastCompletePair ? lastCompletePair.outPunch : null;
    const workedMinutes = pairs.reduce((sum, p) => {
      if (!p.inPunch || !p.outPunch) return sum;
      const diff = (p.outPunch.getTime() - p.inPunch.getTime()) / 60000;
      return diff > 0 ? sum + Math.round(diff) : sum;
    }, 0);

    return { timeIn: firstIn, timeOut: finalOut, workedMinutes };
  }

  let timeIn = null;
  let timeOut = null;

  if (sortedPunches.length >= 2) {
    timeIn = sortedPunches[0];
    timeOut = sortedPunches[sortedPunches.length - 1];

  
    if (timeOut.getTime() - timeIn.getTime() < 3600000) {
      timeOut = null;
    }
  }

  // Agar sirf ek punch hai YA stutter ke baad timeOut null hua
  if (!timeOut) {
    // timeIn jo stutter se mila tha ya pehla punch
    const punch = timeIn || sortedPunches[0];

    // Is single punch ko identify karo — timeIn hai ya timeOut?
   if (isNight) {
  const hour = punch.getHours();
  

  if (hour >= 18 || hour <= 3) { 
    timeIn = punch;
    timeOut = null;
  } 
  
  else if (hour >= 6 && hour <= 12) {
    timeOut = punch;
    
    // Safety check: Agar galti se timeIn aur timeOut dono aik hi punch ko maan raha ho
    if (timeIn && timeIn.getTime() === punch.getTime()) {
      timeIn = null;
    }
  }
} else {
      if (punch.getHours() < 13) {
        timeIn = punch;
        timeOut = null;
      } else {
        timeOut = punch;
        timeIn = null;
      }
    }
  }

  let workedMinutes = 0;
  if (timeIn && timeOut) {
    const diff = (timeOut.getTime() - timeIn.getTime()) / 60000;
    workedMinutes = diff > 0 ? Math.round(diff) : 0;
  }

  return { timeIn, timeOut, workedMinutes };
}

// ─── Shared Window Logic ──────────────────────────────────────────────────────
function getWindow(date, isNight, isAlternate) {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);

  let windowStart, windowEnd;

  if (isNight) {
    // Night shift: aaj 12:00 PM PKT se kal 11:59 AM PKT tak
    windowStart = pktHour(dayStart, 12);
    windowEnd   = pktHour(dayStart, 36); // 36 - 5 = 31 UTC = kal 07:00 AM UTC = 12:00 PM PKT
  } else if (isAlternate) {
    // Alternate/24hr shift
    windowStart = pktHour(dayStart, 0);
    windowEnd   = pktHour(dayStart, 36);
  } else {
    // Normal shift: aaj 00:00 PKT se 23:59 PKT tak
    windowStart = pktHour(dayStart, 0);
    windowEnd   = pktHour(dayStart, 24);
  }

  return { windowStart, windowEnd };
}

// ─── isNight Detection ────────────────────────────────────────────────────────
function detectNight(emp) {
  // Sirf aur sirf DB ki value check karo. Auto auto-guess mat karo!
  if (emp?.dutyType && emp.dutyType.toLowerCase() === 'night') return true;
  if (isAlternativeDuty(emp) && Boolean(emp?.isNightShift)) return true;
  if (isAlternativeDuty(emp) && Array.isArray(emp?.dutyRoster)) {
    const firstOn = emp.dutyRoster.find(
      (r) => r && r.timeIn && r.timeOut && String(r.timeIn).toUpperCase() !== 'OFF' && String(r.timeOut).toUpperCase() !== 'OFF'
    );
    if (firstOn) {
      const inMatch = String(firstOn.timeIn).match(/^(\d{1,2}):(\d{2})/);
      const outMatch = String(firstOn.timeOut).match(/^(\d{1,2}):(\d{2})/);
      if (inMatch && outMatch) {
        const inMinutes = Number(inMatch[1]) * 60 + Number(inMatch[2]);
        const outMinutes = Number(outMatch[1]) * 60 + Number(outMatch[2]);
        if (outMinutes <= inMinutes) return true;
      }
    }
  }
  return false; 
}

function isAlternativeDuty(emp) {
  const duty = String(emp?.dutyType || '').toLowerCase();
  return duty === 'alternative' || duty === 'alternate';
}

function toDateOnlyUTC(value) {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isAlternativeOnDay(date, anchorDate) {
  const oneDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((toDateOnlyUTC(date) - toDateOnlyUTC(anchorDate)) / oneDay);
  return Math.abs(diffDays) % 2 === 0; // anchor day ON, next day OFF
}

// ─────────────────────────────────────────────────────────────────────────────

async function ping(_req, res, next) {
  try {
    res.json({ module: 'attendance', ok: true });
  } catch (err) {
    next(err);
  }
}

async function list(_req, res, next) {
  try {
    const records = await service.list();
    return success(res, records);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const required = ['employeeId', 'scheduledIn', 'scheduledOut', 'actualIn', 'actualOut', 'monthlySalary'];
    const missing = required.filter((k) => req.body[k] === undefined || req.body[k] === null);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);
    const record = await service.create(req.body);
    return success(res, record, 'attendance recorded');
  } catch (err) {
    next(err);
  }
}

async function fetchExternal(req, res, next) {
  try {
    const { Dates, DatesTo } = req.body || {};
    const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Dates, DatesTo })
    });
    const data = await response.json();
    return res.json(data);
  } catch (err) {
    next(err);
  }
}

async function testPairing(req, res, next) {
  try {
    const { startDate, endDate, employeeId } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate are required" });
    }

    const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';

    const fetchStart = new Date(startDate);
    fetchStart.setDate(fetchStart.getDate() - 1);
    const fetchEnd = new Date(endDate);
    fetchEnd.setDate(fetchEnd.getDate() + 1);

    const fStartDate = fetchStart.toISOString().split('T')[0].replace(/-/g, '/');
    const fEndDate   = fetchEnd.toISOString().split('T')[0].replace(/-/g, '/');

    const extRes  = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Dates: fStartDate, DatesTo: fEndDate })
    });
    const extJson = await extRes.json();
    let rawRecords = extJson?.data || [];

    if (employeeId) {
      rawRecords = rawRecords.filter(r => String(r.enrollid) === String(employeeId));
    }

    // Group logs by enrollid — PKT offset apply karo
    const logsByStaff = {};
    rawRecords.forEach(r => {
      if (!r.arrive_time) return;
      if (!logsByStaff[r.enrollid]) logsByStaff[r.enrollid] = [];
      const dateTime = new Date(r.arrive_time.replace(' ', 'T') + '+05:00');
      if (!isNaN(dateTime.getTime())) {
        logsByStaff[r.enrollid].push(dateTime);
      }
    });

    // DB se employees fetch karo
    const employees = await prisma.employee.findMany();
    const empMap = {};
    employees.forEach(e => { empMap[e.empCode] = e; });

    const parsedData = [];

    const dStart = new Date(startDate);
    const dEnd   = new Date(endDate);
    const logicalDates = [];
    for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
      logicalDates.push(new Date(d));
    }

    const staffIds = new Set(Object.keys(logsByStaff));
    if (employeeId && empMap[String(employeeId)]) {
      staffIds.add(String(employeeId));
    }

    Array.from(staffIds).forEach(staffId => {
      const logs = (logsByStaff[staffId] || []).sort((a, b) => a - b);
      const emp  = empMap[staffId];

  const isNightBase = detectNight(emp);
  const isAlternate = isAlternativeDuty(emp);
  const applyNightLogic = isNightBase;
      const altAnchorDate = isAlternate
        ? (emp?.appointmentDate
            ? new Date(emp.appointmentDate)
            : (emp?.createdAt ? new Date(emp.createdAt) : new Date('2026-01-01')))
        : null;

      logicalDates.forEach(date => {
  const { windowStart, windowEnd } = getWindow(date, applyNightLogic, isAlternate);
        const punches = logs.filter(l => l >= windowStart && l <= windowEnd);

        if (isAlternate) {
          const onDay = isAlternativeOnDay(date, altAnchorDate);

          if (!onDay) {
            let offIn = null;
            let offOut = null;
            let offWorkedMinutes = 0;
            if (punches.length > 0) {
              const pairedOff = pairPunches(punches, applyNightLogic);
              offIn = pairedOff.timeIn;
              offOut = pairedOff.timeOut;
              offWorkedMinutes = pairedOff.workedMinutes || 0;
            }
            parsedData.push({
              empCode:      staffId,
              dutyType:     emp?.dutyType || 'alternative',
              logicalDate:  date.toISOString().split('T')[0],
              timeIn:       offIn ? offIn.toISOString() : null,
              timeOut:      offOut ? offOut.toISOString() : null,
              workedMinutes: offWorkedMinutes,
              status:       punches.length > 0 ? 'off_not_avail' : 'off_avail',
              punchesCount: punches.length
            });
            return;
          }

          let onIn = null;
          let onOut = null;
          let onWorkedMinutes = 0;
          if (punches.length === 1) {
            // Business rule: ON day par single punch hamesha missed_out
            onIn = punches[0];
            onOut = null;
          } else if (punches.length > 1) {
            const pairedOn = pairPunches(punches, applyNightLogic);
            onIn = pairedOn.timeIn;
            onOut = pairedOn.timeOut;
            onWorkedMinutes = pairedOn.workedMinutes || 0;
          }

          parsedData.push({
            empCode:      staffId,
            dutyType:     emp?.dutyType || 'alternative',
            logicalDate:  date.toISOString().split('T')[0],
            timeIn:       onIn ? onIn.toISOString() : null,
            timeOut:      onOut ? onOut.toISOString() : null,
            workedMinutes: onWorkedMinutes,
            status:       punches.length === 0 ? 'absent' : (onOut ? 'present' : 'missed_out'),
            punchesCount: punches.length
          });
          return;
        }

        if (punches.length > 0) {
          const { timeIn, timeOut, workedMinutes } = pairPunches(punches, applyNightLogic);

          parsedData.push({
            empCode:      staffId,
            dutyType:     emp?.dutyType || (isNightBase ? 'night (auto)' : 'normal'),
            logicalDate:  date.toISOString().split('T')[0],
            timeIn:       timeIn  ? timeIn.toISOString()  : null,
            timeOut:      timeOut ? timeOut.toISOString() : null,
            workedMinutes: workedMinutes || 0,
            status:       !timeOut ? 'missed_out' : 'present',
            punchesCount: punches.length
          });
        }
      });
    });

    return res.json({ data: parsedData });
  } catch (err) {
    next(err);
  }
}

async function testRawPunches(req, res, next) {
  try {
    const { startDate, endDate, employeeId } = req.body || {};
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate are required" });
    }

    const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';
    const extRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Dates: startDate.replace(/-/g, '/'),
        DatesTo: endDate.replace(/-/g, '/'),
      })
    });

    const extJson = await extRes.json();
    let rawRecords = Array.isArray(extJson?.data) ? extJson.data : [];

    if (employeeId) {
      rawRecords = rawRecords.filter((r) => String(r.enrollid || r.enrollId) === String(employeeId));
    }

    const employees = await prisma.employee.findMany({
      select: { empCode: true, firstName: true, lastName: true }
    });
    const empNameMap = new Map(
      employees.map((e) => [String(e.empCode), `${e.firstName || ''} ${e.lastName || ''}`.trim()])
    );

    const grouped = new Map();

    rawRecords.forEach((rec) => {
      const empCode = String(rec.enrollid || rec.enrollId || '');
      const rawDateTime = rec.arrive_time || rec.arriveTime;
      if (!empCode || !rawDateTime) return;

      const [datePart, timePartRaw] = String(rawDateTime).split(' ');
      if (!datePart || !timePartRaw) return;
      const punchDate = datePart.replace(/\//g, '-');
      const punchTime = String(timePartRaw).slice(0, 5);
      if (!/^\d{2}:\d{2}$/.test(punchTime)) return;

      const key = `${empCode}|${punchDate}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          empCode,
          name: empNameMap.get(empCode) || rec.name || rec.username || '-',
          punchDate,
          punches: [],
        });
      }

      grouped.get(key).punches.push(punchTime);
    });

    const rows = Array.from(grouped.values())
      .map((row) => {
        const sortedPunches = row.punches.sort((a, b) => a.localeCompare(b)).slice(0, 12);
        const punchCols = {};
        for (let i = 1; i <= 12; i++) {
          punchCols[`Punch${i}`] = sortedPunches[i - 1] || '';
        }
        return {
          empCode: row.empCode,
          name: row.name,
          punchDate: row.punchDate,
          ...punchCols,
        };
      })
      .sort((a, b) => {
        if (a.empCode !== b.empCode) return String(a.empCode).localeCompare(String(b.empCode));
        return String(a.punchDate).localeCompare(String(b.punchDate));
      });

    return res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

async function syncAttendance(req, res, next) {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate are required" });
    }

    const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';

    const fetchStart = new Date(startDate);
    fetchStart.setDate(fetchStart.getDate() - 1);
    const fetchEnd = new Date(endDate);
    fetchEnd.setDate(fetchEnd.getDate() + 1);

    const fStartDate = fetchStart.toISOString().split('T')[0].replace(/-/g, '/');
    const fEndDate   = fetchEnd.toISOString().split('T')[0].replace(/-/g, '/');

    const extRes  = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Dates: fStartDate, DatesTo: fEndDate })
    });
    const extJson = await extRes.json();
    let rawRecords = extJson?.data || [];

    // Group logs by enrollid — PKT offset apply karo
    const logsByStaff = {};
    rawRecords.forEach(r => {
      const eId = r.enrollid || r.enrollId;
      if (!r.arrive_time || !eId) return;
      if (!logsByStaff[eId]) logsByStaff[eId] = [];
      const dateTime = new Date(r.arrive_time.replace(' ', 'T') + '+05:00');
      if (!isNaN(dateTime.getTime())) {
        logsByStaff[eId].push(dateTime);
      }
    });

    const employees = await prisma.employee.findMany();
    const empMap = {};
    employees.forEach(e => { empMap[String(e.empCode)] = e; });

    const parsedData = [];
    const dStart = new Date(startDate);
    const dEnd   = new Date(endDate);
    const logicalDates = [];

    for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
      logicalDates.push(new Date(d));
    }

    Object.keys(logsByStaff).forEach(staffId => {
      if (!empMap[staffId]) return; // DB mein nahi hai toh skip

      const logs = logsByStaff[staffId].sort((a, b) => a - b);
      const emp  = empMap[staffId];

  const isNight     = detectNight(emp);
  const isAlternate = isAlternativeDuty(emp);

      logicalDates.forEach(date => {
        const { windowStart, windowEnd } = getWindow(date, isNight, isAlternate);
        const punches = logs.filter(l => l >= windowStart && l <= windowEnd);

        if (punches.length > 0) {
          const { timeIn, timeOut, workedMinutes } = pairPunches(punches, isNight);

          parsedData.push({
            employeeId: emp.id,
            date:       new Date(date),
            actualIn:   timeIn  ? new Date(timeIn)  : null,
            actualOut:  timeOut ? new Date(timeOut) : null,
            workedMinutes: workedMinutes || 0,
            status:     !timeOut ? 'missed_out' : 'present'
          });
        }
      });
    });

    let savedCount = 0;
    for (const record of parsedData) {
      await prisma.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: record.employeeId,
            date:       record.date
          }
        },
        update: {
          actualIn:  record.actualIn,
          actualOut: record.actualOut,
          workedMinutes: record.workedMinutes,
          status:    record.status
        },
        create: {
          employeeId: record.employeeId,
          date:       record.date,
          actualIn:   record.actualIn,
          actualOut:  record.actualOut,
          workedMinutes: record.workedMinutes,
          status:     record.status
        }
      });
      savedCount++;
    }

    return res.json({
      success:      true,
      message:      `Sync Complete! Saved ${savedCount} daily records.`,
      syncedCount:  savedCount
    });

  } catch (err) {
    next(err);
  }
}

module.exports = { ping, list, create, fetchExternal, testPairing, testRawPunches, syncAttendance };

