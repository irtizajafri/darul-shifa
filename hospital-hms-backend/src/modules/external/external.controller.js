const { success, fail } = require('../../utils/response');

const API_URL = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';

async function fetchAttendance(req, res, next) {
  try {
    const { Dates, DatesTo } = req.body || {};
    if (!Dates || !DatesTo) {
      return fail(res, 400, 'Dates and DatesTo are required');
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Dates, DatesTo }),
    });

    const json = await response.json();
    return success(res, json, 'External attendance fetched');
  } catch (err) {
    next(err);
  }
}

module.exports = { fetchAttendance };
