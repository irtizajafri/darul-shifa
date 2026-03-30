import { format } from 'date-fns';

export function formatDate(dateStr, formatStr = 'dd MMM yyyy') {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), formatStr);
  } catch {
    return dateStr;
  }
}

export function getTotalSalary(basic, allowances = []) {
  const safeAllowances = Array.isArray(allowances) ? allowances : [];
  const allowanceSum = safeAllowances.reduce((sum, a) => sum + (Number(a?.amount) || 0), 0);
  const safeBasic = Number(basic) || 0;
  return safeBasic + allowanceSum;
}

export function calculateHours(timeIn, timeOut) {
  if (!timeIn || !timeOut || timeIn === 'OFF' || timeOut === 'OFF') return 0;
  const [inH, inM] = timeIn.split(':').map(Number);
  const [outH, outM] = timeOut.split(':').map(Number);
  return (outH * 60 + outM - (inH * 60 + inM)) / 60;
}
