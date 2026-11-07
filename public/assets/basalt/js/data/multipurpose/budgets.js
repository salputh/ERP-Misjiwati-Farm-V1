/**
 * Fieldline's 2026 spending plans, read by budgets.html and by
 * budget-details.html (which opens one of them from ?id=<key>), so both
 * pages agree on what each plan has spent, where it is heading and who
 * owns it.
 *
 * Published as window.Basalt.data.budgets with the demo clock (today,
 * year, month, pace, monthPart, monthsLeft), the possible owners
 * (people), the plans in setup order (budgets), the status labels
 * (statuses), the shared ledger link (transactions), and two helpers:
 * figures(budget) and find(key). A real backend fills the same shapes
 * and takes today from the system clock.
 */
(() => {
	'use strict';

	/* The demo is frozen on October 9, 2026; every share of the year and
     month below is measured from that day. Counting in UTC keeps
     daylight saving from nudging the day arithmetic. */
	const asOf = new Date(2026, 9, 9);
	const [calendarYear, monthIndex] = [asOf.getFullYear(), asOf.getMonth()];
	const DAY_MS = 86400000;
	const yearStartUtc = Date.UTC(calendarYear, 0, 1);
	const elapsedDays = (Date.UTC(calendarYear, monthIndex, asOf.getDate()) - yearStartUtc) / DAY_MS + 1;
	const yearLength = (Date.UTC(calendarYear + 1, 0, 1) - yearStartUtc) / DAY_MS;
	const monthLength = new Date(calendarYear, monthIndex + 1, 0).getDate();
	const monthShare = asOf.getDate() / monthLength;
	const remainingMonths = 11 - monthIndex + (1 - monthShare);

	/* Anyone listed here can be picked as a plan's owner; the short keys
     are what each plan's `owner` and each history entry's `who` hold. */
	const ownerRoster = {
		ev: { name: 'Elise Vick', title: 'Onboarding lead' },
		as: { name: 'Alicia Bowen', title: 'Engineering manager' },
		cr: { name: 'Cameron Reid', title: 'Marketing lead' },
		rd: { name: 'Robyn Daniels', title: 'Finance controller' },
		ih: { name: 'Cheryl Henderson', title: 'Workplace and IT coordinator' },
		km: { name: 'Kirk Mathis', title: 'Head of operations' },
		pm: { name: 'Paula Malone', title: 'Events manager' },
	};

	/* Forecast standing, from worst to best: key, label, status tone. */
	const standings = Object.fromEntries(
		[
			['over', 'Going over', 'danger'],
			['near', 'Near limit', 'warning'],
			['ok', 'On track', 'success'],
		].map(([id, label, tone]) => [id, { label, tone }]),
	);

	/* Most plans point their "see the payments" link at the ledger. */
	const ledgerLink = { href: 'transactions.html', label: 'Transactions' };

	/* How to read a plan: `months` runs January through September and
     `now` is October to date; a quarter's share is a quarter of
     `amount`, which is what the Finance overview shows for Q3. `costs`
     names the largest payees of the year (the rest of the spending is
     "everything else"), `recent` lists the latest payments newest first
     with the October ones summing to `now`, and `history` holds notes
     and amount changes, also newest first. */
	const plans = [
		budgetRecord({
			name: 'Customer onboarding',
			key: 'onboarding',
			owner: 'ev',
			icon: 'rocket-takeoff',
			tone: 4,
			amount: 360000,
			alert: 'forecast',
			months: [26000, 27400, 28800, 29500, 30800, 31900, 30600, 32100, 33700],
			now: 9400,
			costs: {
				'Lucent Path Setup Team': 118400,
				'Northbound Training Co.': 74900,
				'Onsite Setup Partners, Midwest': 52300,
			},
			recent: [
				payment('2026-10-07', 4200, 'Lucent Path Setup Team', 'App setup days, Boulder teams'),
				payment('2026-10-05', 3100, 'Northbound Training Co.', 'Data imports, 14 teams'),
				payment('2026-10-02', 2100, 'Onsite Setup Partners, Midwest', 'Ann Arbor rollout'),
				payment('2026-09-30', 6800, 'Lucent Path Setup Team', 'September setups'),
			],
			history: [
				note(
					'2026-10-06',
					'ev',
					'The Q4 setup backlog is heavier than planned. Asking Finance for $10,000 more before November.',
				),
				amendment('2026-07-01', 'Raised from $320,000 to $360,000 for the Midwest rollout.'),
				amendment('2026-01-05', 'Set at $320,000 for 2026.'),
			],
		}),
		budgetRecord({
			name: 'Cloud hosting',
			key: 'cloud',
			owner: 'as',
			icon: 'hdd-stack',
			tone: 3,
			amount: 540000,
			alert: 'forecast',
			months: [41300, 42000, 43500, 44000, 45600, 47000, 46200, 47500, 48900],
			now: 12800,
			costs: { 'Amazon Web Services': 312600, Cloudflare: 41800, Datadog: 38900 },
			recent: [
				payment('2026-10-06', 8600, 'Amazon Web Services', 'Reserved instances, October'),
				payment('2026-10-04', 3000, 'Datadog', 'Monitoring, October'),
				payment('2026-10-03', 1200, 'Cloudflare', 'Pro plan and Workers'),
				payment('2026-09-30', 34900, 'Amazon Web Services', 'September usage'),
			],
			history: [
				note(
					'2026-09-24',
					'as',
					'Moving logs to cheaper storage in November should save about $3,000 a month.',
				),
				amendment('2026-04-14', 'Raised from $500,000 to $540,000 after the EU region launch.'),
				amendment('2026-01-05', 'Set at $500,000 for 2026.'),
			],
		}),
		budgetRecord({
			name: 'Paid marketing',
			key: 'marketing',
			owner: 'cr',
			icon: 'megaphone',
			tone: 2,
			amount: 880000,
			alert: '90',
			months: [62000, 66500, 70100, 72400, 75800, 69300, 68400, 71900, 74500],
			now: 21600,
			costs: { 'Google Ads': 284300, 'LinkedIn Ads': 168200, 'Small Business Weekly': 96400 },
			recent: [
				payment('2026-10-08', 9800, 'Google Ads', 'Search, week 41'),
				payment('2026-10-06', 6400, 'LinkedIn Ads', 'Operations managers campaign'),
				payment('2026-10-01', 5400, 'Small Business Weekly', 'November issue, full page'),
				payment('2026-09-30', 9500, 'Google Ads', 'Search, week 40'),
			],
			history: [
				note('2026-09-30', 'cr', 'LinkedIn pauses for December, so the year should land under.'),
				amendment('2026-01-05', 'Set at $880,000 for 2026.'),
			],
		}),
		budgetRecord({
			name: 'Software tools',
			key: 'software',
			owner: 'rd',
			icon: 'window-stack',
			tone: 6,
			amount: 248000,
			alert: 'forecast',
			months: [17800, 18100, 18400, 18700, 18900, 19000, 19200, 19600, 20100],
			now: 6900,
			costs: { Salesforce: 58200, Slack: 31400, GitHub: 27900 },
			recent: [
				payment('2026-10-05', 4850, 'Salesforce', 'Sales Cloud, 38 seats'),
				payment('2026-10-02', 2050, 'Slack', 'Business+ plan'),
				payment('2026-09-29', 2320, 'GitHub', 'Team plan, 62 seats'),
				payment('2026-09-26', 1150, 'Figma', 'Design seats'),
			],
			history: [
				note('2026-08-18', 'rd', 'Slack and GitHub move to yearly billing in January, about 15% cheaper.'),
				amendment('2026-01-05', 'Set at $248,000 for 2026.'),
			],
		}),
		budgetRecord({
			name: 'Office and facilities',
			key: 'office',
			owner: 'ih',
			icon: 'building',
			tone: 5,
			amount: 296000,
			alert: 'forecast',
			months: [21200, 21500, 21900, 22000, 22300, 22600, 22400, 22900, 23400],
			now: 6100,
			costs: { 'Boulder office rent': 118500, 'Akron co-working desks': 44200, 'Cleaning and utilities': 26800 },
			recent: [
				payment('2026-10-06', 4900, 'Akron co-working desks', 'October, 12 desks'),
				payment('2026-10-02', 1200, 'Cleaning and utilities', 'Boulder cleaning, September'),
				payment('2026-09-28', 12900, 'Boulder office rent', 'October rent'),
				payment('2026-09-15', 2300, 'Cleaning and utilities', 'Boulder power and water'),
			],
			history: [
				note('2026-09-02', 'ih', 'Akron goes from 12 to 16 desks in November.'),
				amendment('2026-03-10', 'Lowered from $310,000 to $296,000 after the Boulder lease renewal.'),
				amendment('2026-01-05', 'Set at $310,000 for 2026.'),
			],
		}),
		budgetRecord({
			name: 'Staff equipment',
			key: 'equipment',
			owner: 'km',
			icon: 'laptop',
			tone: 1,
			amount: 1240000,
			alert: '90',
			months: [78300, 84600, 91200, 96000, 89400, 92700, 82400, 88700, 95500],
			now: 31800,
			costs: { 'Laptops for staff': 402800, 'Phones for staff': 151300, 'Monitors and docks': 142700 },
			recent: [
				payment('2026-10-07', 18400, 'Laptops for staff', '#2611, 40 units'),
				payment('2026-10-03', 8100, 'Phones for staff', '#2608, 60 units'),
				payment('2026-10-01', 5300, 'Monitors and docks', '#2604, 45 units'),
				payment('2026-09-29', 23900, 'Laptops for staff', '#2598, 52 units'),
			],
			history: [
				note('2026-10-01', 'km', 'Laptop orders pick up ahead of the winter hiring.'),
				amendment('2026-01-05', 'Set at $1,240,000 for 2026.'),
			],
			link: { href: 'purchase-orders.html', label: 'Purchase orders' },
		}),
		budgetRecord({
			name: 'Travel and events',
			key: 'travel',
			owner: 'pm',
			icon: 'airplane',
			tone: 7,
			amount: 240000,
			alert: 'forecast',
			months: [14600, 22800, 16100, 17400, 18900, 15200, 12300, 9800, 19100],
			now: 3400,
			costs: { Flights: 52300, 'Small Business Expo, Las Vegas': 46800, Hotels: 31200 },
			recent: [
				payment('2026-10-05', 2100, 'Flights', 'Boulder to Akron, 2 people'),
				payment('2026-10-02', 1300, 'Hotels', 'Akron, 3 nights'),
				payment('2026-09-22', 12600, 'Small Business Expo, Las Vegas', 'Booth balance'),
				payment('2026-09-18', 3800, 'Flights', 'Team to Las Vegas, 6 people'),
			],
			history: [
				note('2026-09-23', 'pm', 'Small Business Expo is paid in full. Nothing big is left this year.'),
				amendment('2026-05-20', 'Lowered from $260,000 to $240,000. Two spring events moved online.'),
				amendment('2026-01-05', 'Set at $260,000 for 2026.'),
			],
		}),
	];

	window.Basalt.data = window.Basalt.data || {};
	window.Basalt.data.budgets = {
		today: asOf,
		year: calendarYear,
		month: monthIndex,
		pace: elapsedDays / yearLength,
		monthPart: monthShare,
		monthsLeft: remainingMonths,
		people: ownerRoster,
		budgets: plans,
		statuses: standings,
		transactions: ledgerLink,
		figures: outlook,
		find: lookUp,
	};

	/**
	 * Where one plan stands today. The forecast assumes the average of the
	 * last three full months keeps going until December 31.
	 * @returns {{spent: number, pace: number, forecast: number, used: number, gap: number, status: string}}
	 */
	function outlook(entry) {
		const paidSoFar = sumOf(entry.months) + entry.now;
		const lastQuarter = entry.months.slice(-3);
		const monthlyRate = sumOf(lastQuarter) / lastQuarter.length;
		const yearEnd = toNearestHundred(paidSoFar + monthlyRate * remainingMonths);
		return {
			spent: paidSoFar,
			pace: monthlyRate,
			forecast: yearEnd,
			used: paidSoFar / entry.amount,
			gap: entry.amount - yearEnd,
			status: standingFor(yearEnd / entry.amount),
		};
	}

	/** The plan with this key; an unknown key falls back to the first plan. */
	function lookUp(key) {
		return plans.find((candidate) => candidate.key === key) || plans[0];
	}

	/* Builders that keep the records above short. */

	function budgetRecord({ costs, link = ledgerLink, ...rest }) {
		return { ...rest, costs: Object.entries(costs), link };
	}

	function payment(date, amount, payee, memo) {
		return [date, payee, memo, amount];
	}

	function note(date, who, text) {
		return { date, who, kind: 'note', text };
	}

	/* Amount changes are always made by the finance controller. */
	function amendment(date, text) {
		return { date, who: 'rd', kind: 'change', text };
	}

	/* Arithmetic helpers for outlook(). */

	function sumOf(values) {
		let sum = 0;
		for (const part of values) sum += part;
		return sum;
	}

	function toNearestHundred(raw) {
		return Math.round(raw / 100) * 100;
	}

	/* Over budget above 100%, close to it from 95%, otherwise fine. */
	function standingFor(share) {
		if (share > 1) return 'over';
		return share >= 0.95 ? 'near' : 'ok';
	}
})();
