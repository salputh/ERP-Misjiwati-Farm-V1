/**
 * Fieldline's price list as demo data: the four plans a customer can be on
 * and the add-ons sold beside them. Subscription Plans, Plan Details, the
 * Report Builder and the AI assistant all read it from here, so one plan
 * keeps the same price, account count and revenue wherever it shows up, and
 * plan-details.html?id=<id> lands on the plan that was clicked.
 *
 * The figures agree with the other data files. At the close of September
 * 2026, 2,140 paying accounts bring in $880k a month, divided between plans
 * exactly as on Subscriptions; another 1,420 accounts sit on Free and pay
 * nothing. Each plan's MRR already includes its add-on revenue. Accounts are
 * looked up in assets/basalt/js/data/multipurpose/accounts.js, which has to load before this.
 *
 * Published as window.Basalt.data.plans:
 *   today / month / prevMonth  the demo's date and the last two closed months
 *   months       twelve month labels, October through September
 *   plans        all plans, from the lowest price up
 *   addOns       the monthly add-ons
 *   totals()     MRR, accounts and seats summed over the plans that charge
 *   find(id)     the plan with that id, falling back to Pro
 *   yearly(p)    per-seat monthly price on a yearly bill
 *   trend(p)     month-end MRR, earliest month first
 *   counts(p)    month-end accounts, earliest first (Free tracks accounts
 *                because it has no revenue)
 *   accounts(p)  sample accounts on the plan, largest MRR first
 *
 * A real app would load the same shapes from its billing backend.
 */
(() => {
	'use strict';

	/* The demo's year runs from last October to this September. */
	const MONTH_LABELS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

	/* Every charging plan offers a two-week trial and has no visit cap, so
     only Free spells those two fields out. */
	const PAID_TERMS = { trialDays: 14, visitLimit: null };

	/* Field guide for a plan record. price is per seat per month on a monthly
     bill, and a yearly bill charges ten of those months; tone picks the
     chart color (1 to 8) the dashboard also uses; seatLimit and visitLimit
     cap an account, with null meaning unlimited. includes lists
     [icon, feature] from shortest to longest. accounts, seats, mrr and
     yearlyShare describe the end of September, and addOnShare is how much of
     that MRR the add-ons bring. growth gives each month-end as a fraction of
     September (accounts for Free, MRR for the rest), a quarter per row.
     moves records September's arrivals and departures as [label, accounts,
     MRR], with seats being the net seats existing accounts added or
     dropped. prices is the price history as [date, price, note], latest
     first. Free alone
     carries busiest: [name, city, people, visits so far this month] for the
     accounts closest to the visit cap. */
	const PLAN_LIST = [
		{
			id: 'free',
			name: 'Free',
			icon: 'bi-gift',
			tone: 4,
			price: 0,
			trialDays: 0,
			seatLimit: 3,
			visitLimit: 100,
			blurb: 'For one to three people trying Fieldline for real.',
			includes: [
				['bi-calendar-week', 'Schedule and bookings'],
				['bi-phone', 'The Fieldline app for staff'],
				['bi-calendar-check', '100 visits a month'],
				['bi-envelope-paper', 'Email reminders'],
				['bi-book', 'Help center and guides'],
			],
			addOns: [],
			mrr: 0,
			accounts: 1420,
			seats: 3080,
			addOnShare: 0,
			yearlyShare: 0,
			growth: [0, 0, 0, 0, 0, 0, 0.22, 0.45, 0.63, 0.78, 0.9085, 1],
			moves: {
				in: [
					['New sign-ups', 190, 0],
					['Down from Basic', 6, 0],
				],
				out: [
					['Up to Basic', 12, 0],
					['Closed', 54, 0],
				],
				seats: 0,
			},
			prices: [
				['2026-07-01', 0, 'Visits a month raised from 60 to 100.'],
				['2026-04-14', 0, 'Launched for teams of up to 3 people.'],
			],
			busiest: [
				['Little Paws Walking', 'Bend, US', 3, 96],
				['Clearview Window Works', 'Minot, ND', 3, 91],
				['Fern & Lammas Gardens', 'Helena, MT', 3, 84],
				['Northside Pet Sitters', 'Concord, NH', 2, 77],
				['Tidy Nest Cleaning', 'Waco, US', 3, 70],
				['Lucent Frame Photo', 'Akron, OH', 2, 63],
			],
		},
		withPaidTerms({
			id: 'starter',
			name: 'Basic',
			icon: 'bi-send',
			tone: 3,
			price: 15,
			seatLimit: 15,
			blurb: 'For small teams moving their bookings off paper.',
			includes: [
				['bi-calendar-week', 'Schedule and bookings'],
				['bi-phone', 'The Fieldline app for staff'],
				['bi-chat-left-text', 'Text and email reminders'],
				['bi-receipt', 'Invoices and card payments'],
				['bi-envelope', 'Help by email'],
			],
			addOns: ['portal', 'sms'],
			mrr: 158000,
			accounts: 1190,
			seats: 9455,
			addOnShare: 0.04,
			yearlyShare: 0.3,
			growth: [0.9, 0.91, 0.92, 0.93, 0.94, 0.95, 0.955, 0.965, 0.97, 0.98, 0.99, 1],
			moves: {
				in: [
					['New accounts', 26, 3250],
					['Up from Free', 12, 1500],
					['Down from Pro', 4, 620],
				],
				out: [
					['Up to Pro', 14, 2240],
					['Down to Free', 6, 560],
					['Canceled', 15, 1420],
				],
				seats: 430,
			},
			prices: [
				['2026-03-01', 15, 'Raised from $13 for new accounts. Others moved at renewal.'],
				['2024-03-01', 13, 'Raised from $12 when reminders by text were added.'],
				['2021-04-12', 12, 'Launched with Fieldline 1.0.'],
			],
		}),
		withPaidTerms({
			id: 'growth',
			name: 'Pro',
			icon: 'bi-graph-up-arrow',
			tone: 1,
			price: 32,
			seatLimit: 60,
			blurb: 'For growing teams with regular visits and rounds.',
			includes: [
				['bi-check2-all', 'Everything in Basic'],
				['bi-arrow-repeat', 'Repeat visits and rounds'],
				['bi-ui-checks', 'Visit forms with photos'],
				['bi-bar-chart', 'Reports and exports'],
				['bi-plug', 'QuickBooks and Xero'],
				['bi-chat-dots', 'Help by chat'],
			],
			addOns: ['route', 'portal', 'sms'],
			mrr: 361000,
			accounts: 790,
			seats: 10882,
			addOnShare: 0.09,
			yearlyShare: 0.46,
			growth: [0.8, 0.815, 0.83, 0.845, 0.86, 0.875, 0.89, 0.91, 0.93, 0.95, 0.975, 1],
			moves: {
				in: [
					['New accounts', 22, 7200],
					['Up from Basic', 14, 3120],
					['Down from Max', 1, 1150],
				],
				out: [
					['Up to Max', 3, 2890],
					['Down to Basic', 4, 880],
					['Canceled', 6, 1240],
				],
				seats: 2565,
			},
			prices: [
				['2026-03-01', 32, 'Raised from $29 for new accounts. Others moved at renewal.'],
				['2024-03-01', 29, 'Raised from $25 when visit forms were added.'],
				['2021-04-12', 25, 'Launched with Fieldline 1.0.'],
			],
		}),
		withPaidTerms({
			id: 'enterprise',
			name: 'Max',
			icon: 'bi-buildings',
			tone: 2,
			price: 58,
			seatLimit: null,
			blurb: 'For larger teams with several branches.',
			includes: [
				['bi-check2-all', 'Everything in Pro'],
				['bi-diagram-3', 'Several branches'],
				['bi-shield-lock', 'Single sign-on'],
				['bi-person-check', 'Roles and approvals'],
				['bi-journal-text', 'Audit log'],
				['bi-person-badge', 'A named account manager'],
			],
			addOns: ['route', 'portal', 'sms'],
			mrr: 361000,
			accounts: 160,
			seats: 6465,
			addOnShare: 0.12,
			yearlyShare: 0.73,
			growth: [0.74, 0.76, 0.78, 0.8, 0.82, 0.845, 0.87, 0.895, 0.92, 0.945, 0.97, 1],
			moves: {
				in: [
					['New accounts', 4, 6980],
					['Up from Pro', 3, 4060],
				],
				out: [
					['Down to Pro', 1, 1620],
					['Canceled', 0, 0],
				],
				seats: 1410,
			},
			prices: [
				['2026-03-01', 58, 'Raised from $52 for new accounts. Others moved at renewal.'],
				['2023-09-04', 52, 'Launched for teams with more than one branch.'],
			],
		}),
	];

	/* Add-ons bill monthly at list price on top of the plan. per is the
     price and unit names what it is charged against; change is the MRR
     movement since August, as a percentage. */
	const EXTRAS = [
		{
			id: 'route',
			name: 'Travel Planner',
			icon: 'bi-signpost-split',
			about: 'Puts the day’s visits in the shortest order.',
			per: 6,
			unit: 'a seat a month',
			plans: ['growth', 'enterprise'],
			mrr: 41220,
			accounts: 410,
			change: 4.2,
		},
		{
			id: 'portal',
			name: 'Customer Portal',
			icon: 'bi-window',
			about: 'Customers book, pay and see their visits online.',
			per: 4,
			unit: 'a seat a month',
			plans: ['starter', 'growth', 'enterprise'],
			mrr: 27600,
			accounts: 520,
			change: 1.8,
		},
		{
			id: 'sms',
			name: 'SMS credits',
			icon: 'bi-chat-square-text',
			about: 'Text reminders and on-my-way messages.',
			per: 25,
			unit: 'per 1,000 texts a month',
			plans: ['starter', 'growth', 'enterprise'],
			mrr: 13300,
			accounts: 610,
			change: -0.6,
		},
	];

	/* The plan a missing or unknown id resolves to. */
	const FALLBACK_ID = 'growth';

	publish();

	/** Hangs the data and its helpers off window.Basalt.data for the pages. */
	function publish() {
		const shared = window.Basalt.data || {};
		window.Basalt.data = shared;
		shared.plans = {
			today: '2026-10-09',
			month: 'September',
			prevMonth: 'August',
			months: MONTH_LABELS,
			plans: PLAN_LIST,
			addOns: EXTRAS,
			totals: sumPaying,
			find: planById,
			yearly: yearlySeatPrice,
			trend: mrrByMonth,
			counts: accountsByMonth,
			accounts: accountsOnPlan,
		};
	}

	/* Building plan records. */

	/** Fills in the trial and visit terms that every charging plan shares. */
	function withPaidTerms(fields) {
		return { ...PAID_TERMS, ...fields };
	}

	/* Lookups and sums the pages call. */

	/**
	 * @param {string} id  a plan id, possibly unknown or empty
	 * @returns {object}   that plan, or Pro when nothing matches
	 */
	function planById(id) {
		const hit = PLAN_LIST.find((tier) => tier.id === id);
		return hit || PLAN_LIST.find((tier) => tier.id === FALLBACK_ID);
	}

	/** Adds up MRR, accounts and seats over every plan with a price. */
	function sumPaying() {
		const sum = { mrr: 0, accounts: 0, seats: 0 };
		for (const tier of PLAN_LIST) {
			if (tier.price <= 0) continue;
			sum.mrr += tier.mrr;
			sum.accounts += tier.accounts;
			sum.seats += tier.seats;
		}
		return sum;
	}

	/**
	 * A yearly bill covers ten months, so this spreads that over twelve and
	 * keeps two decimals.
	 */
	function yearlySeatPrice(tier) {
		return toCents((tier.price * 10) / 12);
	}

	/** Twelve month-end MRR figures for the plan. */
	function mrrByMonth(tier) {
		return scaleGrowth(tier, tier.mrr);
	}

	/** Twelve month-end account counts for the plan. */
	function accountsByMonth(tier) {
		return scaleGrowth(tier, tier.accounts);
	}

	/** The demo accounts subscribed to a plan, highest listed MRR first. */
	function accountsOnPlan(tier) {
		const book = window.Basalt.data?.accounts;
		if (!book) return [];
		const onPlan = book.list().filter((account) => account.plan === tier.id);
		return onPlan.sort((left, right) => book.listMrr(right) - book.listMrr(left));
	}

	/* Number helpers. */

	/** Applies each month's growth fraction to September's figure, whole numbers only. */
	function scaleGrowth(tier, september) {
		return tier.growth.map((share) => Math.round(september * share));
	}

	/** Rounds a money amount to whole cents. */
	function toCents(amount) {
		return Math.round(amount * 100) / 100;
	}
})();
