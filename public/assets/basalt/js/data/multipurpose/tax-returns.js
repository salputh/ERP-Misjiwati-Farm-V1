/**
 * Demo ledger behind the Tax Reports page, exposed as
 * window.Basalt.data.taxReturns.
 *
 * Fieldline collects sales tax in sixteen states.
 * Each one carries the invoice labels used in assets/basalt/js/data/multipurpose/billing.js,
 * which is how the page finds the invoices behind a total. Monthly
 * amounts run from October 2025 to the current, partial October, and
 * the filing periods are cut from those months. Texas, Massachusetts,
 * Minnesota and Florida return monthly, and their September returns sum to
 * the $9,840 that left the bank on October 6 ("September sales tax paid"
 * on Accounting).
 *
 * "Today" is fixed at October 9, 2026. Replace the jurisdiction lists
 * and the autumn recordedStates with real exports to show live figures.
 */
(() => {
	'use strict';

	/* The demo's fixed "now". October has run nine of its thirty-one
     days, and the growth curve is pinned to September's real figure. */
	const DEMO_CLOCK = {
		day: '2026-10-09',
		elapsed: 9 / 31,
		baseMonth: '2026-09',
	};
	const CURRENT_MONTH = DEMO_CLOCK.day.slice(0, 7);

	/* Every month on record, earliest first, ending with the current one. */
	const CALENDAR = monthSpan('2025-10', CURRENT_MONTH);

	/* Who prepares returns: one person for the monthly filers, one for the rest. */
	const PREPARERS = { monthly: 'Gregory Devin', elsewhere: 'Robyn Daniels' };

	/* Region labels, in the same words the Analytics pages use. */
	const AREA_NAMES = [
		['northeast', 'Northeast'],
		['midwest', 'Midwest'],
		['west', 'West'],
		['south', 'South'],
	].map(([id, name]) => ({ id, name }));

	/*
	 * Jurisdictions, written region by region. Field notes:
	 *   rate       the rate as printed on invoices
	 *   effective  blended fraction that converts tax back into sales
	 *   every      month, quarter or year
	 *   due        [months after the period, day of month]
	 *   sep        tax charged in September 2026
	 *   grow       month-over-month growth across the record
	 */
	const NORTHEAST = inRegion('northeast', [
		{
			id: 'us-ma',
			name: 'Massachusetts',
			kind: 'Sales tax',
			rate: '6.25%',
			effective: 0.0625,
			every: 'month',
			due: [1, 20],
			sep: 2180,
			grow: 0.018,
			office: 'Massachusetts DOR',
			reg: 'ST-0417-2295',
			labels: ['Massachusetts sales tax 6.25%'],
		},
		{
			id: 'us-ny',
			name: 'New York',
			kind: 'Sales tax',
			rate: '4%',
			effective: 0.04,
			every: 'quarter',
			due: [1, 23],
			sep: 1260,
			grow: 0.014,
			office: 'New York DTF',
			reg: 'NY 41-7730185',
			labels: ['New York sales tax 4%'],
		},
		{
			id: 'us-ct',
			name: 'Connecticut',
			kind: 'Sales tax',
			rate: '6.35%',
			effective: 0.0635,
			every: 'quarter',
			due: [1, 20],
			sep: 520,
			grow: 0.012,
			office: 'Connecticut DRS',
			reg: 'CT 2041-7730-001',
			labels: ['Connecticut sales tax 6.35%'],
		},
	]);

	const MIDWEST = inRegion('midwest', [
		{
			id: 'us-mn',
			name: 'Minnesota',
			kind: 'Sales tax',
			rate: '6.875%',
			effective: 0.06875,
			every: 'month',
			due: [1, 20],
			sep: 1640,
			grow: 0.016,
			office: 'Minnesota Revenue',
			reg: 'MN-7748215',
			labels: ['Minnesota sales tax 6.875%'],
		},
		{
			id: 'us-il',
			name: 'Illinois',
			kind: 'Sales tax',
			rate: '6.25%',
			effective: 0.0625,
			every: 'quarter',
			due: [1, 31],
			sep: 3920,
			grow: 0.017,
			office: 'Illinois DOR',
			reg: 'IL 4427-7301',
			labels: ['Illinois sales tax 6.25%'],
		},
		{
			id: 'us-oh',
			name: 'Ohio',
			kind: 'Sales tax',
			rate: '5.75%',
			effective: 0.0575,
			every: 'quarter',
			due: [1, 10],
			sep: 1880,
			grow: 0.018,
			office: 'Ohio Taxation',
			reg: 'OH 57-327441',
			labels: ['Ohio sales tax 5.75%'],
		},
		{
			id: 'us-ia',
			name: 'Iowa',
			kind: 'Sales tax',
			rate: '6%',
			effective: 0.06,
			every: 'quarter',
			due: [1, 28],
			sep: 690,
			grow: 0.02,
			office: 'Iowa Revenue',
			reg: 'IA 127-441-773',
			labels: ['Iowa sales tax 6%'],
		},
		{
			id: 'us-mi',
			name: 'Michigan',
			kind: 'Sales tax',
			rate: '6%',
			effective: 0.06,
			every: 'year',
			due: [3, 31],
			sep: 410,
			grow: 0.022,
			office: 'Michigan Treasury',
			reg: 'MI 44-1077301',
			labels: ['Michigan sales tax 6%'],
		},
	]);

	const WEST = inRegion('west', [
		{
			id: 'us-ca',
			name: 'California',
			kind: 'Sales tax',
			rate: '7.25%',
			effective: 0.0725,
			every: 'quarter',
			due: [2, 7],
			sep: 5480,
			grow: 0.015,
			office: 'California CDTFA',
			reg: 'SR KH 412-773018',
			labels: ['California sales tax 7.25%'],
		},
		{
			id: 'us-wa',
			name: 'Washington',
			kind: 'Sales tax',
			rate: '6.5%',
			effective: 0.065,
			every: 'quarter',
			due: [1, 31],
			sep: 2140,
			grow: 0.016,
			office: 'Washington DOR',
			reg: 'WA 614-277-301',
			labels: ['Washington sales tax 6.5%'],
		},
		{
			id: 'us-co',
			name: 'Colorado',
			kind: 'Sales tax',
			rate: '2.9%',
			effective: 0.029,
			every: 'quarter',
			due: [2, 12],
			sep: 640,
			grow: 0.013,
			office: 'Colorado DOR',
			reg: 'CO 55914-4773',
			labels: ['Colorado sales tax 2.9%'],
		},
		{
			id: 'us-az',
			name: 'Arizona',
			kind: 'Sales tax',
			rate: '5.6%',
			effective: 0.056,
			every: 'quarter',
			due: [1, 31],
			sep: 980,
			grow: 0.026,
			office: 'Arizona DOR',
			reg: 'AZ 90374417',
			labels: ['Arizona sales tax 5.6%'],
		},
	]);

	const SOUTH = inRegion('south', [
		{
			id: 'us-tx',
			name: 'Texas',
			kind: 'Sales tax',
			rate: '6.25%',
			effective: 0.0625,
			every: 'month',
			due: [1, 20],
			sep: 4610,
			grow: 0.021,
			office: 'Texas Comptroller',
			reg: '3-20419-8817-4',
			labels: ['Texas sales tax 6.25%'],
		},
		{
			id: 'us-fl',
			name: 'Florida',
			kind: 'Sales tax',
			rate: '6%',
			effective: 0.06,
			every: 'month',
			due: [1, 20],
			sep: 1410,
			grow: 0.019,
			office: 'Florida DOR',
			reg: '78-8019244561-2',
			labels: ['Florida sales tax 6%'],
		},
		{
			id: 'us-ga',
			name: 'Georgia',
			kind: 'Sales tax',
			rate: '4%',
			effective: 0.04,
			every: 'month',
			due: [1, 17],
			sep: 1150,
			grow: 0.027,
			office: 'Georgia DOR',
			reg: 'GA 190-822-417',
			labels: ['Georgia sales tax 4%'],
		},
		{
			id: 'us-nc',
			name: 'North Carolina',
			kind: 'Sales tax',
			rate: '4.75%',
			effective: 0.0475,
			every: 'quarter',
			due: [1, 28],
			sep: 2310,
			grow: 0.024,
			office: 'North Carolina DOR',
			reg: 'NC 44-773018',
			labels: ['North Carolina sales tax 4.75%'],
		},
	]);

	/* Page order: the Northeast, the Midwest, the West, then the South. */
	const JURISDICTIONS = [...NORTHEAST, ...MIDWEST, ...WEST, ...SOUTH];

	/*
	 * Where this autumn's returns stand, keyed "<jurisdiction> <period>"
	 * with a period of 2026-09, 2026-Q3 or 2026. Any closed period that
	 * is not listed was filed and paid a few days before its due date.
	 */
	const NOT_YET_FILED = [
		'us-ga 2026-09',
		'us-il 2026-Q3',
		'us-ca 2026-Q3',
		'us-ny 2026-Q3',
		'us-oh 2026-Q3',
		'us-co 2026-Q3',
		'us-az 2026-Q3',
		'us-mi 2026',
	];

	const AUTUMN_STATES = new Map([
		...NOT_YET_FILED.map((key) => [key, { state: 'open' }]),
		awaitingPayment('us-ct 2026-Q3', '2026-10-05', '2026-10-15'),
		awaitingPayment('us-nc 2026-Q3', '2026-10-02', '2026-10-28'),
		paidOn('us-tx 2026-09', '2026-10-06'),
		paidOn('us-ma 2026-09', '2026-10-06'),
		paidOn('us-mn 2026-09', '2026-10-06'),
		paidOn('us-fl 2026-09', '2026-10-06'),
		paidOn('us-wa 2026-Q3', '2026-10-07', '2026-10-08'),
		paidOn('us-ia 2026-Q3', '2026-10-03'),
	]);

	/* For each filing rhythm: the period a month falls in, and the last
     calendar month of a period. */
	const RHYTHMS = {
		month: { bucket: (key) => key, lastMonth: (period) => period },
		quarter: { bucket: quarterLabel, lastMonth: quarterEnd },
		year: { bucket: (key) => key.slice(0, 4), lastMonth: (period) => `${period}-12` },
	};

	publish();

	/** Builds every ledger entry once and hangs the read-only API on window. */
	function publish() {
		const ledger = JURISDICTIONS.map((place) => {
			const tax = taxByMonth(place);
			return { place, tax, returns: periodReturns(place, tax) };
		});

		window.Basalt.data = window.Basalt.data || {};
		window.Basalt.data.taxReturns = {
			today: DEMO_CLOCK.day,
			months: CALENDAR.slice(),
			areas: detached(AREA_NAMES),
			/* Each call hands back an independent copy of the whole ledger. */
			places: () => detached(ledger),
			find: (id) => {
				const wanted = ledger.find((entry) => entry.place.id === id);
				return wanted ? detached(wanted) : null;
			},
		};
	}

	/* Building the ledger. */

	/** Stamps a region id onto each record of one regional list. */
	function inRegion(area, records) {
		return records.map((record) => ({ area, ...record }));
	}

	/** A quarterly return already filed whose payment is scheduled. */
	function awaitingPayment(key, filed, payOn) {
		return [key, { state: 'filed', filed, by: PREPARERS.elsewhere, payOn }];
	}

	/** Monthly filers have their own preparer; every other state shares one. */
	function preparerFor(id) {
		const place = JURISDICTIONS.find((record) => record.id === id);
		return place && place.every === 'month' ? PREPARERS.monthly : PREPARERS.elsewhere;
	}

	/** A settled return; the money usually went the same day it was filed. */
	function paidOn(key, filed, paid = filed) {
		const preparer = preparerFor(key.split(' ')[0]);
		return [key, { state: 'paid', filed, paid, by: preparer }];
	}

	/**
	 * Tax charged per calendar month. The September figure is grown
	 * backward and forward, every other month gets its own steady
	 * variation, and the partial month keeps only its elapsed fraction.
	 */
	function taxByMonth(place) {
		const { baseMonth, elapsed } = DEMO_CLOCK;
		const baseIndex = CALENDAR.indexOf(baseMonth);
		return CALENDAR.map((key, position) => {
			const scale = key === baseMonth ? 1 : variation(place.id + key);
			let charged = place.sep * Math.pow(1 + place.grow, position - baseIndex) * scale;
			if (key === CURRENT_MONTH) charged *= elapsed;
			return toCents(charged);
		});
	}

	/**
	 * Groups the months into filing periods for this jurisdiction's
	 * rhythm and returns one return per period, earliest first.
	 */
	function periodReturns(place, tax) {
		const rhythm = RHYTHMS[place.every];
		const periodsSeen = new Map();
		for (const [position, key] of CALENDAR.entries()) {
			const period = rhythm.bucket(key);
			if (!periodsSeen.has(period)) periodsSeen.set(period, { months: [], sum: 0 });
			const bucket = periodsSeen.get(period);
			bucket.months.push(key);
			bucket.sum = toCents(bucket.sum + tax[position]);
		}

		const [offsetMonths, dueOn] = place.due;
		return Array.from(periodsSeen, ([period, { months, sum }]) => {
			/* The period ends with its final calendar month, on record or not. */
			const lastMonth = rhythm.lastMonth(period);
			const due = dueDateFor(lastMonth, offsetMonths, dueOn);
			const ended = lastMonth < CURRENT_MONTH;
			const outcome = outcomeFor(place, period, due, ended);
			return Object.assign({ place: place.id, period, months, ended, due, tax: sum }, outcome);
		});
	}

	/**
	 * A recorded state wins; an unfinished period is open; any other
	 * closed period was filed and paid together, a steady few days early.
	 */
	function outcomeFor(place, period, due, ended) {
		const recorded = AUTUMN_STATES.get(`${place.id} ${period}`);
		if (recorded) return { ...recorded };
		if (!ended) return { state: 'open' };

		const lead = 2 + Math.floor((variation(place.id + period) - 0.94) * 40);
		const day = offsetDay(due, -lead);
		const preparer = preparerFor(place.id);
		return { state: 'paid', filed: day, paid: day, by: preparer };
	}

	/* Dates, periods and rounding. Everything runs in local time. */

	/** Every "yyyy-mm" from `first` through `last`, inclusive. */
	function monthSpan(first, last) {
		const span = [];
		for (let serial = monthSerial(first); serial <= monthSerial(last); serial += 1) {
			span.push(`${Math.floor(serial / 12)}-${zeroPad((serial % 12) + 1)}`);
		}
		return span;
	}

	function monthSerial(key) {
		const [year, month] = key.split('-').map(Number);
		return year * 12 + month - 1;
	}

	function quarterLabel(key) {
		return `${key.slice(0, 4)}-Q${Math.ceil(Number(key.slice(5)) / 3)}`;
	}

	function quarterEnd(period) {
		return `${period.slice(0, 4)}-${zeroPad(Number(period.slice(-1)) * 3)}`;
	}

	/**
	 * The day a return falls due: `offset` months after the month
	 * "yyyy-mm" closes, on `dayOfMonth`, clamped to that month's length.
	 */
	function dueDateFor(lastMonth, offset, dayOfMonth) {
		const serial = monthSerial(lastMonth) + offset;
		const dueYear = Math.floor(serial / 12);
		const dueMonth = (serial % 12) + 1;
		const monthLength = new Date(dueYear, dueMonth, 0).getDate();
		return `${dueYear}-${zeroPad(dueMonth)}-${zeroPad(Math.min(dayOfMonth, monthLength))}`;
	}

	/** Moves a "yyyy-mm-dd" day by a signed number of days. */
	function offsetDay(isoDay, days) {
		const [year, month, date] = isoDay.split('-').map(Number);
		const shifted = new Date(year, month - 1, date + days);
		return `${shifted.getFullYear()}-${zeroPad(shifted.getMonth() + 1)}-${zeroPad(shifted.getDate())}`;
	}

	function zeroPad(number) {
		return String(number).padStart(2, '0');
	}

	function toCents(value) {
		return Math.round(value * 100) / 100;
	}

	/**
	 * A stable multiplier from 0.94 to 1.06 derived from a text seed with
	 * a 32-bit FNV-1a hash, so no two months or returns look alike.
	 */
	function variation(seed) {
		let fnv = 2166136261;
		for (const symbol of seed) fnv = Math.imul(fnv ^ symbol.charCodeAt(0), 16777619);
		const bucket = (fnv >>> 0) % 1000;
		return 0.94 + (bucket / 1000) * 0.12;
	}

	function detached(value) {
		return JSON.parse(JSON.stringify(value));
	}
})();
