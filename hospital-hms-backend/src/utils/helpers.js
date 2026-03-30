function calcRatesFromMonthly(monthlySalary) {
	const salary = Number(monthlySalary || 0);
	const perDay = salary / 30;
	const perHour = perDay / 24;
	const perMinute = perHour / 60;
	return { perDay, perHour, perMinute };
}

function minutesBetween(start, end) {
	if (!start || !end) return 0;
	const s = new Date(start);
	const e = new Date(end);
	return Math.max(0, Math.round((e - s) / 60000));
}

module.exports = {
	calcRatesFromMonthly,
	minutesBetween,
};
