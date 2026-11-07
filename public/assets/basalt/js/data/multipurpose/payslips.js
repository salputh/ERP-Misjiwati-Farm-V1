/**
 * The pay rules Payslip Details (payslip-details.html) works from: which run
 * Fieldline has open, what it withholds, and the October changes waiting for
 * sign-off. Payroll (payroll.html) runs on these same rules, so a payslip
 * reads the same on either screen. Staff records belong to data/multipurpose/people.js,
 * which must be loaded first. A single payslip opens at
 * payslip-details.html?id=<staff number>&month=<1-12>.
 *
 * window.Basalt.data.payslips offers the run (year, openMonth, approveBy and
 * the paying account), the withholding rates, a label per kind of change,
 * the October changes by staff number, and four readers: people(),
 * slipFor(person, month), payday(month) and accountOf(person). A payroll
 * provider can stand in by handing back the same shapes.
 */
(() => {
	'use strict';
	const staffBook = window.Basalt.data && window.Basalt.data.people;
	if (!staffBook) throw new Error('Load people.js before payslips.js.');

	const payYear = 2026;
	const currentRun = 10;
	const withholding = { health: 180, pension: 0.05, tax: 0.15 };

	/* What each kind of change is called on screen, grouped by whether it
     moves people, moves money or only touches the paperwork. */
	const changeNames = {
		starter: 'New starter',
		leaver: 'Leaving',
		raise: 'Pay rise',
		bonus: 'Bonus',
		commission: 'Commission',
		allowance: 'Allowance',
		oncall: 'On-call',
		bank: 'Bank details',
		deduction: 'Deduction',
	};

	/* October's queue in the order Payroll lists it. Anything not yet looked
     at is todo; an extra above zero is paid as a separate earnings line. */
	const awaiting = { status: 'todo', extra: 0 };
	const octoberQueue = [
		{
			...awaiting,
			by: 'op',
			kind: 'leaver',
			note: 'Leaves Oct 23, 4 days paid out',
			extra: 904.62,
			extraLabel: 'Unused leave, 4 days',
		},
		{ ...awaiting, by: 'yh', kind: 'raise', note: 'From $6,400 to $6,900 a month' },
		{
			...awaiting,
			by: 'lf',
			kind: 'commission',
			note: 'Q3 add-on sales, three accounts',
			extra: 1840,
			extraLabel: 'Q3 commission',
		},
		{ ...awaiting, by: 'cm', kind: 'bank', note: 'New account, not confirmed yet' },
		{ ...awaiting, by: 'ak', kind: 'starter', note: 'Starts Oct 12, paid 15 of 22 days', status: 'approved' },
		{ ...awaiting, by: 'wa', kind: 'starter', note: 'Starts Oct 12, paid 15 of 22 days', status: 'approved' },
		{ ...awaiting, by: 'si', kind: 'starter', note: 'Starts Oct 19, paid 10 of 22 days' },
		{
			...awaiting,
			by: 'ka',
			kind: 'oncall',
			note: 'Six weekend shifts in September',
			status: 'approved',
			extra: 540,
			extraLabel: 'On-call, 6 shifts',
		},
	].map(({ by, ...change }) => ({ who: staffBook.recordWithId(by).staff, ...change }));

	function publish() {
		const payroll = [];
		for (const member of staffBook.people) {
			if (onPayrollThisYear(member)) payroll.push(asPayee(member));
		}

		window.Basalt.data.payslips = {
			year: payYear,
			openMonth: currentRun,
			approveBy: '2026-10-23',
			account: '7730',
			rates: withholding,
			kinds: changeNames,
			changes: octoberQueue,
			people: () => [...payroll],
			slipFor: payslipOf,
			payday: payDateOf,
			accountOf: accountTail,
		};
	}

	/* Salaried staff whose time with the company overlaps January up to the
     end of the open month; contractors are paid elsewhere. */
	function onPayrollThisYear({ staffed, start, left }) {
		if (staffed === false) return false;
		if (start > `${payYear}-${zeroPad(currentRun)}-31`) return false;
		return !left || left >= `${payYear}-01-01`;
	}

	function asPayee({ staff, id, first, last, team, title, city, type, start, left, lastDay, salary, was }) {
		return {
			id: staff,
			short: id,
			first,
			last,
			team,
			role: title,
			city,
			type,
			start,
			end: left || lastDay || '',
			salary,
			was,
		};
	}

	/**
	 * The payslip a payee gets for one month of the year, or null for a month
	 * after the open run or outside their time on the payroll. Open-run
	 * changes are only applied to the open month.
	 */
	function payslipOf(payee, month) {
		if (month < 1 || month > currentRun) return null;
		const coverage = daysPaid(payee, month);
		if (!coverage) return null;

		const applied =
			month !== currentRun
				? []
				: octoberQueue.filter((change) => change.status !== 'skipped' && change.who === payee.id);
		const payLines = [salaryLine(payee, month, coverage)];
		for (const { extra, extraLabel, kind } of applied) {
			if (extra) payLines.push({ label: extraLabel || changeNames[kind], amount: extra });
		}

		const beforeTax = cents(sumOf(payLines));
		const taxLines = [{ label: 'Income tax, 15%', amount: cents(beforeTax * withholding.tax) }];
		const otherLines = [
			{ label: 'Pension, 5%', amount: cents(beforeTax * withholding.pension) },
			{ label: 'Health cover', amount: withholding.health },
		];
		const taxDue = cents(sumOf(taxLines));
		const otherDue = cents(sumOf(otherLines));

		return {
			p: payee,
			m: month,
			...coverage,
			changes: applied,
			earnings: payLines,
			gross: beforeTax,
			taxes: taxLines,
			deductions: otherLines,
			tax: taxDue,
			other: otherDue,
			ded: cents(taxDue + otherDue),
			net: cents(beforeTax - taxDue - otherDue),
		};
	}

	/**
	 * The first and last calendar day a payee is paid for in a month, as
	 * { from, to }, or null when they had not joined yet or had already gone.
	 */
	function daysPaid(payee, month) {
		const monthLength = lengthOf(month);
		const joinedOn = fromIso(payee.start);
		const leftOn = payee.end ? fromIso(payee.end) : null;
		if (joinedOn > new Date(payYear, month - 1, monthLength)) return null;
		if (leftOn && leftOn < new Date(payYear, month - 1, 1)) return null;
		return {
			from: fallsIn(joinedOn, month) ? joinedOn.getDate() : 1,
			to: leftOn && fallsIn(leftOn, month) ? leftOn.getDate() : monthLength,
		};
	}

	/* A full month pays the whole salary (the earlier figure while a raise was
     still ahead); a partial one pays the share of weekdays worked. */
	function salaryLine(payee, month, { from, to }) {
		const monthly = payee.was && month <= payee.was.until ? payee.was.salary : payee.salary;
		if (from <= 1 && to >= lengthOf(month)) return { label: 'Base salary', amount: monthly };
		const workedDays = weekdayCount(month, from, to);
		const allDays = weekdayCount(month, 1, lengthOf(month));
		return {
			label: `Base salary, ${workedDays} of ${allDays} days`,
			amount: cents((monthly * workedDays) / allDays),
		};
	}

	/* Money goes out on the 28th, or on the Friday before a weekend 28th. */
	function payDateOf(month) {
		const day = new Date(payYear, month - 1, 28);
		while (onWeekend(day)) day.setDate(day.getDate() - 1);
		return [day.getFullYear(), zeroPad(day.getMonth() + 1), zeroPad(day.getDate())].join('-');
	}

	/* A made-up but stable four-digit account tail, derived from the
     numeric part of the staff number. */
	function accountTail({ id }) {
		const serial = Number(id.replace(/\D/g, ''));
		return String(serial * 917 + 1000).slice(-4);
	}

	function weekdayCount(month, firstDay, lastDay) {
		let weekdays = 0;
		for (let dayOfMonth = firstDay; dayOfMonth <= lastDay; dayOfMonth++) {
			weekdays += onWeekend(new Date(payYear, month - 1, dayOfMonth)) ? 0 : 1;
		}
		return weekdays;
	}

	function sumOf(payLines) {
		let tally = 0;
		for (const { amount } of payLines) tally += amount;
		return tally;
	}

	function cents(value) {
		return Math.round(value * 100) / 100;
	}

	function onWeekend(day) {
		return [0, 6].includes(day.getDay());
	}

	function fallsIn(day, month) {
		return day.getMonth() === month - 1 && day.getFullYear() === payYear;
	}

	function lengthOf(month) {
		return new Date(payYear, month, 0).getDate();
	}

	function fromIso(text) {
		const [year, monthNumber, dayOfMonth] = text.split('-').map(Number);
		return new Date(year, monthNumber - 1, dayOfMonth);
	}

	function zeroPad(value) {
		return String(value).padStart(2, '0');
	}

	publish();
})();
