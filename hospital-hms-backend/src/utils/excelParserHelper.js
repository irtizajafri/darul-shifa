function parseTime(timeVal, dateStr) {
  if (timeVal === undefined || timeVal === null || timeVal === '') return null;
  // If timeVal is a fraction of a day (raw Excel time)
  if (typeof timeVal === 'number') {
    const totalSeconds = Math.round(timeVal * 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return new Date(`${dateStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
  }
  
  // If timeVal is a string (e.g., "09:00", "09:00:00", "5:00 PM")
  let tStr = String(timeVal).trim();
  let d = new Date(`${dateStr} ${tStr}`);
  if (!isNaN(d)) return d;
  
  // Try forcing T format
  if (tStr.length <= 5) tStr += ':00'; // "09:00" -> "09:00:00"
  d = new Date(`${dateStr}T${tStr}`);
  if (!isNaN(d)) return d;
  
  return null;
}

module.exports = { parseTime };
