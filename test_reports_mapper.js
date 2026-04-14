const { isFuture, workedMinutes, scheduledMinutes, isOffStatus } = {
  isFuture: false, workedMinutes: 720, scheduledMinutes: 720, isOffStatus: false
};
const wrkHrsRaw = workedMinutes / 60;
const wrkHrsRounded = (isFuture && !workedMinutes) ? 0 : parseFloat(wrkHrsRaw.toFixed(1));
const wrkHrsDisplay = (isFuture && !workedMinutes) ? "0.00" : wrkHrsRounded.toFixed(2);
console.log({ dutyHrs: (isOffStatus && workedMinutes === 0) ? "0.00" : (scheduledMinutes > 0 ? (scheduledMinutes / 60).toFixed(2) : "0.00"), wrkHrsDisplay });
