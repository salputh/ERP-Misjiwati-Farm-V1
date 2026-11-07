/**
 * Report library behind reports.html. It grows two years of monthly figures
 * for Fieldline, a per-seat scheduling product, and reads every saved report
 * through them: the four pinned figures, a card or list row per report, the
 * quick-view drawer with its drill-down table, the builder, the schedule and
 * sharing dialogs, and the CSV exports.
 *
 * Bringing your own data: put your payload where SAMPLE sits, or let the
 * methods on `server` fetch it. Each method stands for one request; the page
 * changes first and puts things back when a request fails.
 * Add ?state=slow, ?state=error or ?state=empty to the address to see those
 * views. Charts are Chart.js 4, colored from the --basalt-* tokens when they
 * are built, drawn once they scroll into view, rebuilt on basalt:appearance.
 */
(() => {
	'use strict';

	const page = pick('[data-rpt-root]', document);
	if (!page || typeof Chart === 'undefined') return;

	/* The sample business. Plans carry their rates and where each one stands
     at the close of September 2026; the monthly history is grown from those
     rates by a seeded generator, so every load shows the same numbers, and
     every month reconciles (closing MRR is opening plus new and expansion,
     less downgrades and cancellations). */
	const feed = window.Basalt.data.reports;
	const SAMPLE = {
		/* The sample's idea of "now"; a live app would use new Date(). */
		today: '2026-10-09T10:00',
		/* The first month on record and how many months follow it. */
		opening: '2024-10',
		span: 24,
		viewer: 'ja',
		shareRoot: 'https://app.example.com/reports/',
		people: feed.people,
		reports: feed.reports,

		/* Seat prices are per seat per month, yearly billing earns two months
       free, and every pace is a share of the month's opening MRR. Accounts
       leave faster than revenue does (accountLossFactor), because it is the
       smaller accounts on a plan that cancel. */
		plans: [
			{
				id: 'starter',
				name: 'Basic',
				perSeat: 15,
				endsAt: { mrr: 158000, accounts: 1190, seats: 11200 },
				pace: { gain: 0.02358, upsell: 0.00987, downsell: 0.003, loss: 0.008 },
				accountLossFactor: 2.44,
				bySegment: { self: 0.93, sales: 0.07 },
				byRegion: { northeast: 0.41, midwest: 0.31, west: 0.17, south: 0.11 },
				perAccount: { self: 118, sales: 260 },
				yearlyShare: { self: 0.21, sales: 0.48 },
				extras: { route: 0.03, portal: 0.02, sms: 0.03 },
				trialWin: 0.21,
				exitMix: { price: 34, usage: 26, feature: 14, competitor: 9, closed: 11, other: 6 },
			},
			{
				id: 'growth',
				name: 'Pro',
				perSeat: 32,
				endsAt: { mrr: 361000, accounts: 790, seats: 12600 },
				pace: { gain: 0.01472, upsell: 0.01476, downsell: 0.0025, loss: 0.0035 },
				accountLossFactor: 3.19,
				bySegment: { self: 0.56, sales: 0.44 },
				byRegion: { northeast: 0.46, midwest: 0.29, west: 0.15, south: 0.1 },
				perAccount: { self: 390, sales: 590 },
				yearlyShare: { self: 0.37, sales: 0.69 },
				extras: { route: 0.05, portal: 0.03, sms: 0.03 },
				trialWin: 0.15,
				exitMix: { price: 21, usage: 18, feature: 27, competitor: 19, closed: 9, other: 6 },
			},
			{
				id: 'enterprise',
				name: 'Max',
				perSeat: 58,
				endsAt: { mrr: 361000, accounts: 160, seats: 7600 },
				pace: { gain: 0.00969, upsell: 0.01617, downsell: 0.002, loss: 0.0015 },
				accountLossFactor: 3.1,
				bySegment: { self: 0.2, sales: 0.8 },
				byRegion: { northeast: 0.52, midwest: 0.3, west: 0.13, south: 0.05 },
				perAccount: { self: 720, sales: 2900 },
				yearlyShare: { self: 0.84, sales: 0.93 },
				extras: { route: 0.06, portal: 0.02, sms: 0.02 },
				trialWin: 0.08,
				exitMix: { price: 12, usage: 10, feature: 31, competitor: 24, closed: 17, other: 6 },
			},
		],
		/* Across the latest twelve months, this share of trials goes on to pay. */
		trialToPaid: 0.18,
		regions: [
			{ id: 'northeast', name: 'Northeast', short: 'Northeast', gainLift: 1.0, lossLift: 0.9 },
			{ id: 'midwest', name: 'Midwest', short: 'Midwest', gainLift: 1.08, lossLift: 1.0 },
			{ id: 'west', name: 'West', short: 'West', gainLift: 1.32, lossLift: 1.15 },
			{ id: 'south', name: 'South', short: 'South', gainLift: 1.18, lossLift: 1.38 },
		],
		/* The Segment filter: whether the account bought on its own or through sales. */
		segments: [
			{ id: 'self', name: 'Self-serve', gainLift: 1.1, lossLift: 1.12, upsellLift: 0.8 },
			{ id: 'sales', name: 'Sales-led', gainLift: 0.86, lossLift: 0.7, upsellLift: 1.25 },
		],
		/* How strongly each calendar month brings in new business, January first. */
		monthlyPull: [1.22, 1.08, 1.12, 1.0, 0.98, 0.94, 0.88, 0.8, 1.06, 1.1, 1.02, 0.78],
		extras: [
			{ id: 'route', name: 'Travel Planner' },
			{ id: 'portal', name: 'Customer Portal' },
			{ id: 'sms', name: 'SMS credits' },
		],
		exitReasons: [
			{ id: 'price', label: 'Too expensive', short: 'Price' },
			{ id: 'feature', label: 'Missing a feature', short: 'Feature' },
			{ id: 'usage', label: 'Not using it enough', short: 'Usage' },
			{ id: 'competitor', label: 'Moved to another tool', short: 'Rival' },
			{ id: 'closed', label: 'Business closed or merged', short: 'Closed' },
			{ id: 'other', label: 'Something else', short: 'Other' },
		],

		/* Numbers a report can be built on. A level is read at the last month
       of the range; a flow is summed over it. */
		measures: {
			mrr: { label: 'MRR', long: 'Monthly recurring revenue', reads: 'level', format: 'money' },
			new: { label: 'New MRR', long: 'MRR from new accounts', reads: 'flow', format: 'money' },
			expansion: {
				label: 'Expansion MRR',
				long: 'MRR added by existing accounts',
				reads: 'flow',
				format: 'money',
			},
			churn: { label: 'Canceled MRR', long: 'MRR lost to cancellations', reads: 'flow', format: 'money' },
			netnew: {
				label: 'Net new MRR',
				long: 'MRR added after cancellations and downgrades',
				reads: 'flow',
				format: 'money',
			},
			accounts: { label: 'Paying accounts', long: 'Accounts on a paid plan', reads: 'level', format: 'count' },
			seats: { label: 'Paid seats', long: 'Seats on paid plans', reads: 'level', format: 'count' },
			trials: { label: 'Trials started', long: 'Self-serve trials started', reads: 'flow', format: 'count' },
		},
		splits: {
			none: 'Nothing',
			plan: 'Plan',
			region: 'Region',
			segment: 'Segment',
			billing: 'Billing',
			addon: 'Add-on',
		},
		drawings: {
			line: { label: 'Trend line', icon: 'bi-graph-up' },
			stacked: { label: 'Stacked columns', icon: 'bi-bar-chart-steps' },
			columns: { label: 'Columns', icon: 'bi-bar-chart' },
			ring: { label: 'Ring', icon: 'bi-pie-chart' },
			bars: { label: 'Ranked bars', icon: 'bi-filter-left' },
			share: { label: 'Share over time', icon: 'bi-layers' },
			pareto: { label: 'Pareto', icon: 'bi-sort-down' },
			bullet: { label: 'Against plan', icon: 'bi-bullseye' },
		},
	};

	/* Preview switches read from the address bar. */
	const previewMode = readPreviewMode();
	let failOnce = previewMode === 'error';

	/* One method per request. The sample answers from SAMPLE at once, except
     the figures, which wait a beat so the loading view can be seen. Swap a
     body for a fetch() to your backend and keep what it resolves with. */
	const server = {
		/* GET /api/reports/figures?from=2025-10&to=2026-09&plan=&region=&segment=
       Resolves with one monthly ledger per plan, region and segment the
       filters keep. */
		figures(span, filters) {
			if (failOnce) {
				failOnce = false;
				return later(700).then(() => Promise.reject(new Error('The figures service did not answer in time.')));
			}
			return later(previewMode === 'slow' ? 2600 : 420, strandsFor(filters));
		},
		/* GET /api/reports */
		reports() {
			return later(0, previewMode === 'empty' ? [] : SAMPLE.reports.map(copyOf));
		},
		/* POST /api/reports for a new one, PUT /api/reports/:id otherwise. */
		save(report) {
			return Promise.resolve(copyOf(report));
		},
		/* DELETE /api/reports/:id */
		discard(id) {
			return Promise.resolve({ id });
		},
		/* PUT /api/reports/:id/star with { starred } */
		star(id, starred) {
			return Promise.resolve({ id, starred });
		},
		/* PUT /api/reports/:id/schedule with the plan, or null to stop sending. */
		schedule(id, plan) {
			return Promise.resolve({ id, schedule: plan });
		},
		/* PUT /api/reports/:id/sharing with { people, access, link } */
		share(id, sharing) {
			return Promise.resolve({ id, share: sharing });
		},
		/* The file is built in the browser; point this at
       GET /api/reports/:id/export.csv to let the server write it. */
		exportCsv(lines, filename) {
			saveCsv(lines, filename);
			return Promise.resolve();
		},
	};

	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const CLOCK = new Date(SAMPLE.today);
	const prefs = {
		read(key) {
			try {
				return window.localStorage.getItem(key);
			} catch {
				return null;
			}
		},
		write(key, value) {
			try {
				window.localStorage.setItem(key, value);
			} catch {
				/* storage is off in this window */
			}
		},
	};

	const [baseYear, baseMonth] = SAMPLE.opening.split('-').map(Number);
	const FINAL = SAMPLE.span - 1;
	/* The custom range reaches back twelve months at most. */
	const EARLIEST = FINAL - 11;
	const STRANDS = growStrands();

	/* What the page shows right now: the lens (range, comparison, filters),
     the library controls and the figures the last load returned. */
	const ui = {
		span: '12',
		from: FINAL - 11,
		to: FINAL,
		compare: 'prev',
		plan: 'all',
		region: 'all',
		segment: 'all',
		shelf: 'all',
		query: '',
		order: 'recent',
		page: 1,
		layout: prefs.read('basalt-reports-view') === 'list' ? 'list' : 'grid',
		strands: [],
		ready: false,
		failure: null,
	};
	let catalog = [];
	let requestNo = 0;

	const PINNED = [
		{ id: 'mrr', label: 'MRR', icon: 'bi-graph-up-arrow', tone: 1, note: 'at the end of the range' },
		{ id: 'netnew', label: 'Net new MRR', icon: 'bi-plus-slash-minus', tone: 3, note: 'added across the range' },
		{ id: 'accounts', label: 'Paying accounts', icon: 'bi-building', tone: 2, note: 'at the end of the range' },
		{
			id: 'nrr',
			label: 'Net revenue retention',
			icon: 'bi-arrow-repeat',
			tone: 5,
			note: 'kept and grown from existing accounts',
		},
	];
	const SHELVES = [
		{ id: 'all', label: 'All', holds: () => true },
		{ id: 'starred', label: 'Starred', holds: (report) => report.starred },
		{ id: 'mine', label: 'Mine', holds: (report) => report.owner === SAMPLE.viewer },
		{
			id: 'shared',
			label: 'Shared with me',
			holds: (report) => report.owner !== SAMPLE.viewer && report.owner !== 'tpl',
		},
		{ id: 'scheduled', label: 'Scheduled', holds: (report) => !!report.schedule },
		{ id: 'templates', label: 'Templates', holds: (report) => report.owner === 'tpl' },
	];
	/* The builder offers six of the eight drawings, and only the splits that
     mean something for the chosen number. */
	const BUILDABLE = ['line', 'stacked', 'columns', 'ring', 'bars', 'share'];
	const SPLITS_BY_MEASURE = {
		mrr: ['none', 'plan', 'region', 'segment', 'billing', 'addon'],
		new: ['none', 'plan', 'region', 'segment', 'billing'],
		expansion: ['none', 'plan', 'region', 'segment'],
		churn: ['none', 'plan', 'region', 'segment'],
		netnew: ['none', 'plan', 'region', 'segment'],
		accounts: ['none', 'plan', 'region', 'segment', 'billing'],
		seats: ['none', 'plan', 'region', 'segment'],
		trials: ['none', 'plan', 'region'],
	};

	const TYPEFACE = "'Schibsted Grotesk', sans-serif";
	/* Every plan, region, segment and add-on keeps one slot on the series
     ramp, so it wears the same color in every chart. */
	const SERIES_SLOT = {
		starter: 0,
		growth: 1,
		enterprise: 2,
		northeast: 0,
		midwest: 1,
		west: 2,
		south: 3,
		self: 7,
		sales: 2,
		monthly: 6,
		annual: 3,
		seats: 0,
		route: 1,
		portal: 2,
		sms: 3,
	};
	/* Live charts by canvas, each with the recipe that rebuilds it. */
	const charts = new Map();
	const queued = new Map();
	const watcher =
		'IntersectionObserver' in window ? new IntersectionObserver(paintSeen, { rootMargin: '120px 0px' }) : null;

	const filterSelects = {
		compare: pick('[data-rpt-filter="compare"]'),
		plan: pick('[data-rpt-filter="plan"]'),
		region: pick('[data-rpt-filter="region"]'),
		segment: pick('[data-rpt-filter="segment"]'),
	};
	const customForm = pick('[data-rpt-custom]');
	const fromField = pick('[data-rpt-from]');
	const toField = pick('[data-rpt-to]');
	let monthPickers = [];

	const pinnedBox = pick('[data-rpt-kpis]');
	const results = pick('[data-rpt-results]');
	const shelfTabs = pick('[data-rpt-groups]');
	const searchBox = pick('[data-rpt-search]');
	const pagerBox = pick('[data-rpt-pager]');
	let pager = null;

	/* Reports saved during this visit have no page of their own yet. */
	let serial = 200;
	const madeHere = new Set();

	const drawerNode = pick('#rpt-drawer');
	const quick = { report: null, figures: null, drillIndex: null, csvRows: null };

	const builderModal = pick('#rpt-builder');
	const builderForm = pick('[data-rpt-builder]');
	let editingReport = null;
	let titleTimer = 0;
	const templateReports = SAMPLE.reports.filter((report) => report.owner === 'tpl');

	const scheduleModal = pick('#rpt-schedule');
	const cadenceForm = pick('[data-rpt-schedule]');
	let schedulingReport = null;

	const shareModal = pick('#rpt-share');
	let sharingReport = null;

	/**
	 * Fills the static lists, binds every control and starts the first load.
	 */
	function start() {
		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() => {
				pruneCharts();
				for (const [canvas, entry] of charts) paint(canvas, entry.recipe, false);
			});
		});

		wireLens();
		page.addEventListener('click', (event) => {
			if (event.target.closest('[data-rpt-retry]')) reload();
		});
		pick('[data-rpt-export-kpis]').addEventListener('click', exportPinned);
		wireLibrary();
		wireDrawer();
		wireBuilder();
		wireTemplates();
		wireSchedule();
		wireShare();

		applySpan();
		showPlaceholders();
		server.reports().then((list) => {
			catalog = list;
			paintHeroFigures();
			reload();
		});
	}

	/* Small tools that every part of the page leans on. */

	function pick(selector, scope = page) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = page) {
		return [...scope.querySelectorAll(selector)];
	}

	function copyOf(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (char) => entities[char]);
	}

	function addUp(values) {
		return values.reduce((running, value) => running + value, 0);
	}

	/** Whole numbers from first to last, both ends included. */
	function runFrom(first, last) {
		const out = [];
		for (let at = first; at <= last; at += 1) out.push(at);
		return out;
	}

	function say(message) {
		window.Basalt.announce?.(message);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function later(ms, value) {
		return new Promise((resolve) => setTimeout(() => resolve(value), ms));
	}

	function readPreviewMode() {
		try {
			return new URLSearchParams(window.location.search).get('state') || '';
		} catch {
			return '';
		}
	}

	function personById(id) {
		return SAMPLE.people.find((who) => who.id === id) || SAMPLE.people[0];
	}

	function monogram(wholeName) {
		return wholeName
			.split(/\s+/)
			.map((word) => word[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	/** A generator whose numbers look random but repeat on every load. */
	function seededRandom(seed) {
		let state = seed >>> 0;
		return function next() {
			state = (state + 0x6d2b79f5) >>> 0;
			let mixed = state;
			mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	/* Months are counted from the first month on record. */

	function dateOfMonth(index) {
		return new Date(baseYear, baseMonth - 1 + index, 1);
	}

	function shortMonth(index) {
		return dateOfMonth(index).toLocaleDateString('en-US', { month: 'short' });
	}

	function monthYear(index) {
		return dateOfMonth(index).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
	}

	function fullMonth(index) {
		return dateOfMonth(index).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
	}

	function monthKey(index) {
		const date = dateOfMonth(index);
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
	}

	function indexOfMonth(key) {
		const [year, month] = String(key).split('-').map(Number);
		return (year - baseYear) * 12 + (month - baseMonth);
	}

	/** Axis text: the month, plus the year on the first tick and on every January. */
	function axisMonth(index, first) {
		const date = dateOfMonth(index);
		const withYear = index === first || date.getMonth() === 0;
		return withYear ? `${shortMonth(index)} ’${String(date.getFullYear()).slice(2)}` : shortMonth(index);
	}

	/* Number formats. Negative values use a true minus sign. */

	function dollars(amount, exact) {
		const sign = amount < 0 ? '−' : '';
		const size = Math.abs(amount);
		if (exact) return `${sign}$${Math.round(size).toLocaleString('en-US')}`;
		if (size >= 1e6) return `${sign}$${(size / 1e6).toFixed(2)}M`;
		if (size >= 1e4) return `${sign}$${Math.round(size / 1e3)}k`;
		if (size >= 1e3) return `${sign}$${(size / 1e3).toFixed(1)}k`;
		return `${sign}$${Math.round(size)}`;
	}

	function whole(amount) {
		return `${amount < 0 ? '−' : ''}${Math.round(Math.abs(amount)).toLocaleString('en-US')}`;
	}

	function formatFor(measure, amount, exact) {
		return SAMPLE.measures[measure].format === 'money' ? dollars(amount, exact) : whole(amount);
	}

	function percent(amount, digits) {
		const scale = Math.pow(10, digits || 0);
		return `${(Math.round(amount * scale) / scale).toFixed(digits || 0)}%`;
	}

	/* The sample model grows a ledger for every plan, region and segment,
     scales each plan so September 2026 lands on its closing figures, then
     rounds to whole dollars, accounts and seats without breaking a month's sums. */

	function growStrands() {
		const random = seededRandom(20261002);
		const strands = [];
		for (const plan of SAMPLE.plans) {
			for (const region of SAMPLE.regions) {
				for (const segment of SAMPLE.segments) strands.push(growStrand(plan, region, segment, random));
			}
		}
		for (const plan of SAMPLE.plans)
			settlePlan(
				plan,
				strands.filter((strand) => strand.plan === plan.id),
			);
		addTrials(strands);
		return strands;
	}

	/** One plan in one region and segment, month by month, in loose units. */
	function growStrand(plan, region, segment, random) {
		const extrasShare = addUp(Object.values(plan.extras));
		const ledger = [];
		let level = 1000 * plan.byRegion[region.id] * plan.bySegment[segment.id];
		let accounts = level / plan.perAccount[segment.id];

		function luck() {
			return 0.86 + random() * 0.28;
		}

		for (let month = 0; month < SAMPLE.span; month += 1) {
			const opening = level;
			const pull = SAMPLE.monthlyPull[dateOfMonth(month).getMonth()];
			const planned = opening * plan.pace.gain * region.gainLift * segment.gainLift;
			const gained = planned * pull * luck();
			const upsold = opening * plan.pace.upsell * segment.upsellLift * luck();
			const downsold = opening * plan.pace.downsell * luck();
			const lossRate = plan.pace.loss * region.lossLift * segment.lossLift * luck();
			const lost = opening * lossRate;
			level = opening + gained + upsold - downsold - lost;
			const accountsBefore = accounts;
			const won = gained / (plan.perAccount[segment.id] * 0.82);
			const churned = accountsBefore * lossRate * plan.accountLossFactor;
			accounts = accountsBefore + won - churned;
			ledger.push({
				opening,
				closing: level,
				gained,
				upsold,
				downsold,
				lost,
				accounts,
				accountsBefore,
				won,
				churned,
				/* The plan's expectation: this month's new business without the luck. */
				target: planned * 1.04 * (0.5 + pull / 2),
				seats: level * (1 - extrasShare),
			});
		}
		return {
			plan: plan.id,
			region: region.id,
			segment: segment.id,
			planInfo: plan,
			regionInfo: region,
			segmentInfo: segment,
			ledger,
		};
	}

	/** Scales one plan's strands to its closing figures and rounds them. */
	function settlePlan(plan, strands) {
		function closingSum(field) {
			return addUp(strands.map((strand) => strand.ledger[FINAL][field]));
		}

		const moneyScale = plan.endsAt.mrr / closingSum('closing');
		const accountScale = plan.endsAt.accounts / closingSum('accounts');
		const seatScale = plan.endsAt.seats / closingSum('seats');

		for (const strand of strands) {
			for (const row of strand.ledger) {
				for (const field of ['opening', 'closing', 'gained', 'upsold', 'downsold', 'lost', 'target'])
					row[field] *= moneyScale;
				for (const field of ['accounts', 'accountsBefore', 'won', 'churned']) row[field] *= accountScale;
				row.seats *= seatScale;
			}
		}

		/* Opening levels first, then every month's closing levels, are rounded so
       the plan totals stay whole. Flows round on their own; expansion and new
       accounts absorb whatever is left over. */
		const firstRows = strands.map((strand) => strand.ledger[0]);
		const openingMoney = firstRows.map((row) => row.opening);
		const openingAccounts = firstRows.map((row) => row.accountsBefore);
		const startMoney = splitWhole(Math.round(addUp(openingMoney)), openingMoney);
		const startAccounts = splitWhole(Math.round(addUp(openingAccounts)), openingAccounts);
		for (let month = 0; month < SAMPLE.span; month += 1) {
			for (const field of ['closing', 'accounts', 'seats']) roundTogether(strands, month, field);
		}

		for (const [position, strand] of strands.entries()) {
			let money = startMoney[position];
			let count = startAccounts[position];
			for (const row of strand.ledger) {
				row.opening = money;
				row.gained = Math.round(row.gained);
				row.downsold = Math.round(row.downsold);
				row.lost = Math.round(row.lost);
				row.target = Math.round(row.target);
				row.upsold = row.closing - row.opening - row.gained + row.downsold + row.lost;
				row.accountsBefore = count;
				row.churned = Math.min(count, Math.round(row.churned));
				row.won = row.accounts - row.accountsBefore + row.churned;
				if (row.won < 0) {
					row.churned -= row.won;
					row.won = 0;
				}
				money = row.closing;
				count = row.accounts;
			}
		}
	}

	/** Self-serve trials, sized so a year of them converts at SAMPLE.trialToPaid. */
	function addTrials(strands) {
		const selfServe = strands.filter((strand) => strand.segment === 'self');
		const lastYear = runFrom(FINAL - 11, FINAL);

		function rawTrials(strand, month) {
			return strand.ledger[month].won / strand.planInfo.trialWin;
		}

		const paidInYear = addUp(selfServe.map((strand) => addUp(lastYear.map((month) => strand.ledger[month].won))));
		const scale =
			paidInYear /
			SAMPLE.trialToPaid /
			addUp(selfServe.map((strand) => addUp(lastYear.map((month) => rawTrials(strand, month)))));

		for (const strand of strands) {
			for (const [month, row] of strand.ledger.entries()) {
				row.trials = strand.segment === 'self' ? rawTrials(strand, month) * scale : 0;
			}
		}
		for (let month = 0; month < SAMPLE.span; month += 1) roundTogether(selfServe, month, 'trials');
	}

	/** Rounds one field across strands so the whole parts add up to the rounded sum. */
	function roundTogether(strands, month, field) {
		const exact = strands.map((strand) => strand.ledger[month][field]);
		const parts = splitWhole(Math.round(addUp(exact)), exact);
		for (const [position, strand] of strands.entries()) strand.ledger[month][field] = parts[position];
	}

	/** Splits a whole number by weights; the largest remainders take the spare units. */
	function splitWhole(amount, weights) {
		const weightSum = addUp(weights) || 1;
		const exact = weights.map((weight) => (amount * weight) / weightSum);
		const parts = exact.map(Math.floor);
		let spare = amount - addUp(parts);
		const byRemainder = exact
			.map((value, position) => [value - Math.floor(value), position])
			.sort((a, b) => b[0] - a[0]);
		for (const [, position] of byRemainder) {
			if (spare <= 0) break;
			parts[position] += 1;
			spare -= 1;
		}
		return parts;
	}

	function strandsFor(filters) {
		function keeps(field, strand) {
			return filters[field] === 'all' || strand[field] === filters[field];
		}

		return STRANDS.filter((strand) => keeps('plan', strand) && keeps('region', strand) && keeps('segment', strand));
	}

	/** One measure for one strand in one month, narrowed to a billing or add-on slice when given. */
	function measureAt(strand, month, measure, slice) {
		const row = strand.ledger[month];
		const readings = {
			mrr: () => row.closing,
			new: () => row.gained,
			expansion: () => row.upsold,
			churn: () => row.lost,
			netnew: () => row.gained + row.upsold - row.downsold - row.lost,
			accounts: () => row.accounts,
			seats: () => row.seats,
			trials: () => row.trials,
		};
		const amount = readings[measure] ? readings[measure]() : 0;
		if (slice?.by === 'billing') {
			const yearly = strand.planInfo.yearlyShare[strand.segment];
			return amount * (slice.id === 'annual' ? yearly : 1 - yearly);
		}
		if (slice?.by === 'addon') {
			const shares = strand.planInfo.extras;
			return amount * (slice.id === 'seats' ? 1 - addUp(Object.values(shares)) : shares[slice.id] || 0);
		}
		return amount;
	}

	/** The slices a split produces; strand-based ones carry a keep test, the rest a share. */
	function slicesFor(split, measure) {
		const makers = {
			plan: () =>
				SAMPLE.plans.map((plan) => ({
					id: plan.id,
					label: plan.name,
					keep: (strand) => strand.plan === plan.id,
				})),
			region: () =>
				SAMPLE.regions.map((region) => ({
					id: region.id,
					label: region.name,
					short: region.short,
					keep: (strand) => strand.region === region.id,
				})),
			segment: () =>
				SAMPLE.segments.map((segment) => ({
					id: segment.id,
					label: segment.name,
					keep: (strand) => strand.segment === segment.id,
				})),
			billing: () => [
				{ id: 'monthly', label: 'Billed monthly', part: { by: 'billing', id: 'monthly' } },
				{ id: 'annual', label: 'Billed yearly', part: { by: 'billing', id: 'annual' } },
			],
			addon: () =>
				[{ id: 'seats', label: 'Seat licenses', part: { by: 'addon', id: 'seats' } }].concat(
					SAMPLE.extras.map((extra) => ({
						id: extra.id,
						label: extra.name,
						part: { by: 'addon', id: extra.id },
					})),
				),
		};
		return makers[split] ? makers[split]() : [{ id: 'all', label: SAMPLE.measures[measure].label }];
	}

	/** Monthly values for every slice of a split that is not all zeros, and the overall line. */
	function seriesFor(strands, measure, split, from, to) {
		const months = runFrom(from, to);
		const slices = slicesFor(split, measure)
			.map((slice) => {
				const members = slice.keep ? strands.filter(slice.keep) : strands;
				return {
					...slice,
					data: months.map((month) =>
						Math.round(addUp(members.map((strand) => measureAt(strand, month, measure, slice.part)))),
					),
				};
			})
			.filter((slice) => slice.data.some((amount) => amount !== 0));
		const totals = months.map((month) =>
			Math.round(addUp(strands.map((strand) => measureAt(strand, month, measure)))),
		);
		return { months, slices, totals };
	}

	/** A level is read at its last month; a flow is summed. */
	function closeOut(measure, values) {
		return SAMPLE.measures[measure].reads === 'level' ? values[values.length - 1] : addUp(values);
	}

	/* A range is a run of month indexes; the comparison is the run before it
     or the same months a year earlier. */

	function applySpan() {
		if (ui.span === 'ytd') {
			ui.from = Math.max(0, indexOfMonth(`${CLOCK.getFullYear()}-01`));
			ui.to = FINAL;
			return;
		}
		if (ui.span === 'custom') return;
		ui.to = FINAL;
		ui.from = FINAL - Number(ui.span) + 1;
	}

	/** The window a range is compared against, or null when there is none. */
	function comparisonFor(from, to, mode) {
		const length = to - from + 1;
		if (mode === 'prev' && from - length >= 0) {
			return {
				from: from - length,
				to: from - 1,
				phrase: 'previous period',
				title: length === 1 ? 'Month before' : `Previous ${length} months`,
			};
		}
		if (mode === 'yoy' && from - 12 >= 0) {
			return { from: from - 12, to: to - 12, phrase: 'same period last year', title: 'Same months last year' };
		}
		return null;
	}

	/** A report follows the page's range unless it pins a run of recent months. */
	function windowOf(report) {
		if (!report.range || report.range === 'page') return { from: ui.from, to: ui.to };
		return { from: FINAL - Number(report.range) + 1, to: FINAL };
	}

	function spanText(from, to) {
		return from === to ? fullMonth(from) : `${monthYear(from)} to ${monthYear(to)}`;
	}

	/* Each drawing turns a report and the filtered strands into the figures
     its chart, sentence, stats and table read from. */

	/**
	 * Everything a report's chart, sentence, stats and table are drawn from.
	 * @param {object} report a saved report (or the builder's draft)
	 * @param {object[]} strands the strands the current filters keep
	 */
	function figuresFor(report, strands) {
		const { from, to } = windowOf(report);
		const months = runFrom(from, to);
		const fig = {
			report,
			measure: report.metric,
			from,
			to,
			months,
			against: comparisonFor(from, to, ui.compare),
			ticks: months.map((month) => axisMonth(month, from)),
			titles: months.map(monthYear),
			empty: false,
		};
		const shapers = {
			line: overTimeFigures,
			stacked: overTimeFigures,
			columns: overTimeFigures,
			share: overTimeFigures,
			ring: splitFigures,
			bars: splitFigures,
			pareto: reasonFigures,
			bullet: planFigures,
		};
		if (!shapers[report.kind]) {
			fig.empty = true;
			return fig;
		}
		shapers[report.kind](fig, strands);
		return fig;
	}

	function overTimeFigures(fig, strands) {
		const { measure, against } = fig;
		const series = seriesFor(strands, measure, fig.report.breakdown, fig.from, fig.to);
		fig.slices = series.slices;
		fig.totals = series.totals;
		if (against) fig.previous = seriesFor(strands, measure, 'none', against.from, against.to).totals;
		fig.headline = closeOut(measure, series.totals);
		fig.baseline = against ? closeOut(measure, fig.previous) : null;
		fig.empty = !series.totals.some((amount) => amount !== 0);
		if (fig.report.kind === 'share') {
			fig.shares = series.slices.map((slice) =>
				slice.data.map((amount, at) => (series.totals[at] ? (amount / series.totals[at]) * 100 : 0)),
			);
		}
	}

	function splitFigures(fig, strands) {
		const { measure, against } = fig;
		const series = seriesFor(strands, measure, fig.report.breakdown, fig.from, fig.to);
		fig.slices = series.slices.map((slice) => Object.assign(slice, { value: closeOut(measure, slice.data) }));
		if (fig.report.kind === 'bars') fig.slices.sort((a, b) => b.value - a.value);
		fig.headline = addUp(fig.slices.map((slice) => slice.value));
		if (against)
			fig.baseline = closeOut(measure, seriesFor(strands, measure, 'none', against.from, against.to).totals);
		fig.empty = !fig.headline;
	}

	/** Cancellations by reason: each plan's lost accounts split by its own reason mix. */
	function reasonFigures(fig, strands) {
		const lostByPlan = Object.fromEntries(SAMPLE.plans.map((plan) => [plan.id, 0]));
		for (const strand of strands)
			lostByPlan[strand.plan] += addUp(fig.months.map((month) => strand.ledger[month].churned));
		const byReason = Object.fromEntries(SAMPLE.exitReasons.map((reason) => [reason.id, 0]));
		for (const plan of SAMPLE.plans) {
			const parts = splitWhole(
				lostByPlan[plan.id],
				SAMPLE.exitReasons.map((reason) => plan.exitMix[reason.id]),
			);
			for (const [position, reason] of SAMPLE.exitReasons.entries()) byReason[reason.id] += parts[position];
		}
		fig.reasons = SAMPLE.exitReasons
			.map((reason) => ({ ...reason, value: byReason[reason.id] }))
			.sort((a, b) => b.value - a.value);
		fig.headline = addUp(fig.reasons.map((reason) => reason.value));
		fig.empty = !fig.headline;
		const { against } = fig;
		if (against)
			fig.baseline = addUp(
				strands.map((strand) =>
					addUp(runFrom(against.from, against.to).map((month) => strand.ledger[month].churned)),
				),
			);
	}

	/** New MRR per region against what the plan expected. */
	function planFigures(fig, strands) {
		function sumOf(members, field) {
			return addUp(members.map((strand) => addUp(fig.months.map((month) => strand.ledger[month][field]))));
		}

		fig.regions = SAMPLE.regions
			.map((region) => {
				const members = strands.filter((strand) => strand.region === region.id);
				return {
					id: region.id,
					label: region.name,
					short: region.short,
					value: sumOf(members, 'gained'),
					target: sumOf(members, 'target'),
				};
			})
			.filter((region) => region.target > 0);
		fig.headline = addUp(fig.regions.map((region) => region.value));
		fig.baseline = addUp(fig.regions.map((region) => region.target));
		fig.empty = !fig.regions.length;
	}

	/** The sentence a screen reader hears in place of the chart. */
	function sentenceFor(fig) {
		const info = SAMPLE.measures[fig.measure] || SAMPLE.measures.mrr;
		const when = spanText(fig.from, fig.to);
		if (fig.empty) return `No figures for these filters, ${when}.`;
		const change = fig.baseline ? ((fig.headline - fig.baseline) / Math.abs(fig.baseline)) * 100 : null;
		const versus =
			change != null && fig.against
				? `, ${change >= 0 ? 'up ' : 'down '}${percent(Math.abs(change), 1)} on the ${fig.against.phrase}`
				: '';
		const isLevel = info.reads === 'level';

		function amount(value) {
			return formatFor(fig.measure, value);
		}

		function trendSentence() {
			const story = isLevel
				? `went from ${amount(fig.totals[0])} in ${monthYear(fig.from)} to ${amount(fig.headline)} in ${monthYear(fig.to)}`
				: `came to ${amount(fig.headline)} from ${when}`;
			return `${info.label} ${story}${versus}.`;
		}

		function stacked() {
			const largest = fig.slices
				.slice()
				.sort((a, b) => closeOut(fig.measure, b.data) - closeOut(fig.measure, a.data))[0];
			return `${info.label} ${isLevel ? 'ended at ' : 'came to '}${amount(fig.headline)}, ${when}${versus}. ${largest.label} was the largest part at ${amount(closeOut(fig.measure, largest.data))}.`;
		}

		function share() {
			const latest = fig.slices.map(
				(slice, at) => `${slice.label} ${percent(fig.shares[at][fig.shares[at].length - 1])}`,
			);
			return `Share of ${info.label} in ${monthYear(fig.to)}: ${latest.join(', ')}.`;
		}

		function split() {
			const parts = fig.slices.map((slice) => `${slice.label} ${amount(slice.value)}`).join(', ');
			return `${info.label} ${isLevel ? `in ${monthYear(fig.to)}` : `for ${when}`} by ${SAMPLE.splits[fig.report.breakdown].toLowerCase()}: ${parts}.`;
		}

		function reasons() {
			const leading = fig.reasons
				.slice(0, 2)
				.map((reason) => `${reason.label} (${whole(reason.value)})`)
				.join(' and ');
			return `${whole(fig.headline)} accounts canceled, ${when}. ${leading} were the top reasons.`;
		}

		function plan() {
			const byRegion = fig.regions
				.map((region) => `${region.label} ${percent((region.value / region.target) * 100)} of plan`)
				.join(', ');
			return `New MRR ${dollars(fig.headline)} against a plan of ${dollars(fig.baseline)}, ${when}. ${byRegion}.`;
		}

		const writers = {
			line: trendSentence,
			columns: trendSentence,
			stacked,
			share,
			ring: split,
			bars: split,
			pareto: reasons,
			bullet: plan,
		};
		return writers[fig.report.kind] ? writers[fig.report.kind]() : '';
	}

	/* Chart colors come from the tokens on every build, so a rebuild after a
     theme change picks up the new palette. */

	function readToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** A CSS color as [red, green, blue, alpha]; gray when it cannot be read. */
	function rgbaParts(color) {
		const text = String(color || '').trim();
		const short = /^#([0-9a-f]{3})$/i.exec(text);
		if (short) return [...short[1].split('').map((digit) => parseInt(digit + digit, 16)), 1];
		const long = /^#([0-9a-f]{6})$/i.exec(text);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 1];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(text);
		if (functional) {
			const parts = functional[1].split(',').map((part) => parseFloat(part));
			return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
		}
		return [128, 128, 128, 1];
	}

	function translucent(color, alpha) {
		const [red, green, blue] = rgbaParts(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	function blend(first, second, weight) {
		const a = rgbaParts(first);
		const b = rgbaParts(second);

		function mixAt(at) {
			return Math.round(a[at] * weight + b[at] * (1 - weight));
		}

		return `rgb(${mixAt(0)}, ${mixAt(1)}, ${mixAt(2)})`;
	}

	function gradientsOff() {
		return document.documentElement.getAttribute('data-basalt-gradients') === 'off';
	}

	function colorsNow() {
		const ink = readToken('--basalt-copy', '#12233a');
		const muted = readToken('--basalt-copy-muted', '#5f7186');
		return {
			ramp: [1, 2, 3, 4, 5, 6, 7, 8].map((slot) => readToken(`--basalt-series-${slot}`, '#2b6fd4')),
			ink,
			/* The --rpt-quiet recipe from reports.css: small gray text that keeps
         4.5:1 on every palette. */
			hush: blend(muted, ink, 0.72),
			faint: translucent(ink, 0.3),
			rule: translucent(ink, 0.07),
			groove: translucent(ink, 0.07),
			paper: readToken('--basalt-plane', '#ffffff'),
			edge: readToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			alarm: readToken('--basalt-danger', '#ef4d63'),
		};
	}

	function isPlainObject(value) {
		return !!value && typeof value === 'object' && !Array.isArray(value);
	}

	/** Copies extra over base, merging plain objects key by key. */
	function layerOptions(base, extra) {
		const merged = { ...base };
		for (const [key, value] of Object.entries(extra || {})) {
			merged[key] = isPlainObject(value) && isPlainObject(merged[key]) ? layerOptions(merged[key], value) : value;
		}
		return merged;
	}

	/**
	 * Options every chart starts from. A compact chart (a card preview) has no
	 * axes, tooltips or pointer events, so it reads as a shape.
	 * @param {object} colors from colorsNow()
	 * @param {{compact?: boolean, animate?: boolean, onSelect?: Function}} flags
	 * @param {object} extra chart-specific options merged on top
	 */
	function chartDefaults(colors, flags, extra) {
		const compact = flags.compact;
		const tickStyle = { color: colors.hush, font: { family: TYPEFACE, size: 11.5 }, padding: 8 };
		const options = {
			responsive: true,
			maintainAspectRatio: false,
			animation: flags.animate ? { duration: 500, easing: 'easeOutQuart' } : false,
			interaction: { mode: 'index', intersect: false },
			layout: { padding: compact ? { top: 4, right: 2, bottom: 2, left: 2 } : { top: 6, right: 8 } },
			events: compact ? [] : ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
			elements: {
				line: { borderWidth: compact ? 2 : 2.5, borderCapStyle: 'round', borderJoinStyle: 'round' },
				point: { radius: 0, hoverRadius: 5, hoverBorderWidth: 2, hoverBorderColor: colors.paper },
				bar: { borderRadius: compact ? 3 : 6, borderSkipped: 'start' },
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					enabled: !compact,
					backgroundColor: colors.paper,
					titleColor: colors.ink,
					bodyColor: colors.ink,
					footerColor: colors.ink,
					borderColor: colors.edge,
					borderWidth: 1,
					padding: 10,
					cornerRadius: 8,
					boxPadding: 4,
					usePointStyle: true,
					titleFont: { family: TYPEFACE, size: 12, weight: '600' },
					bodyFont: { family: TYPEFACE, size: 12 },
					footerFont: { family: TYPEFACE, size: 12, weight: '600' },
				},
			},
			scales: {
				x: {
					display: !compact,
					grid: { display: false },
					border: { display: false },
					ticks: { maxRotation: 0, autoSkipPadding: 10, ...tickStyle },
				},
				y: {
					display: !compact,
					grid: { color: colors.rule },
					border: { display: false },
					ticks: { maxTicksLimit: 5, ...tickStyle },
				},
			},
		};
		if (flags.onSelect && !compact) {
			options.onClick = (event, hits) => {
				if (hits?.length) flags.onSelect(hits[0].index);
			};
			options.onHover = (event, hits) => {
				const target = event.native?.target;
				if (target) target.style.cursor = hits?.length ? 'pointer' : 'default';
			};
		}
		return layerOptions(options, extra);
	}

	/* A top-to-bottom fade across the plot; with gradients off, one plain
	   color: `flat`, or the first stop. */
	function verticalGradient(stops, flat) {
		return window.Basalt.chartFill(stops, { flat });
	}

	function columnFill(color, top, bottom) {
		return verticalGradient([
			[0, translucent(color, top ?? 0.95)],
			[1, translucent(color, bottom ?? 0.5)],
		]);
	}

	function areaWash(color) {
		return verticalGradient(
			[
				[0, translucent(color, 0.26)],
				[1, translucent(color, 0)],
			],
			translucent(color, 0.12),
		);
	}

	/**
	 * Draws a rounded label chip on the canvas: card color behind body text,
	 * kept inside the given bounds.
	 */
	function canvasPill(ctx, colors, x, y, label, bounds, look = {}) {
		ctx.save();
		ctx.font = `600 11px ${TYPEFACE}`;
		const dotRoom = look.dot ? 12 : 0;
		const width = ctx.measureText(label).width + 16 + dotRoom;
		const height = 21;
		const anchored = { left: x, right: x - width };
		const left = Math.max(bounds.left, Math.min(anchored[look.align] ?? x - width / 2, bounds.right - width));
		const top = Math.max(bounds.top ?? -Infinity, y - height);
		ctx.fillStyle = colors.paper;
		ctx.strokeStyle = colors.edge;
		ctx.lineWidth = 1;
		ctx.beginPath();
		if (ctx.roundRect) ctx.roundRect(left, top, width, height, 10.5);
		else ctx.rect(left, top, width, height);
		ctx.fill();
		ctx.stroke();
		if (look.dot) {
			ctx.fillStyle = look.dot;
			ctx.beginPath();
			ctx.arc(left + 11, top + height / 2, 3.5, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.fillStyle = colors.ink;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(label, left + 8 + dotRoom, top + height / 2 + 0.5);
		ctx.restore();
	}

	function canvasLabel(ctx, color, label, x, y, align, size, baseline) {
		ctx.save();
		ctx.font = `600 ${size || 11.5}px ${TYPEFACE}`;
		ctx.fillStyle = color;
		ctx.textAlign = align || 'left';
		ctx.textBaseline = baseline || 'bottom';
		ctx.fillText(label, x, y);
		ctx.restore();
	}

	/* Chart.js hands tick callbacks extra arguments, so these take the value only. */
	function moneyTick(value) {
		return dollars(value);
	}

	function tickFormatter(measure) {
		return (value) => {
			if (SAMPLE.measures[measure].format === 'money') return dollars(value);
			return Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : whole(value);
		};
	}

	/* A one-color chart takes a ramp slot picked from its report, so the
     cards in the grid do not all come out in the first color. */
	const LEAD_SLOTS = [0, 2, 7, 3, 1, 6];

	function leadColor(colors, fig) {
		const id = String(fig.report.id);
		let sum = 0;
		for (const ch of id) sum += ch.charCodeAt(0);
		return colors.ramp[LEAD_SLOTS[sum % LEAD_SLOTS.length]];
	}

	function sliceColor(colors, fig, position) {
		const slice = fig.slices[position];
		if (!slice || fig.slices.length === 1) return leadColor(colors, fig);
		return colors.ramp[SERIES_SLOT[slice.id] ?? position];
	}

	/* One recipe per drawing, each returning a full Chart.js config. */

	const RECIPES = {
		line: trendChart,
		stacked: stackedChart,
		columns: columnChart,
		share: shareChart,
		ring: ringChart,
		bars: rankedChart,
		pareto: paretoChart,
		bullet: bulletChart,
	};

	/** The trend with the comparison dashed behind it. */
	function trendChart(colors, fig, flags) {
		const compact = flags.compact;
		const single = fig.slices.length <= 1;
		const last = fig.totals.length - 1;
		const lines = single
			? [
					{
						label: SAMPLE.measures[fig.measure].label,
						data: fig.totals,
						borderColor: leadColor(colors, fig),
						backgroundColor: areaWash(leadColor(colors, fig)),
						pointBackgroundColor: leadColor(colors, fig),
						pointHoverBackgroundColor: leadColor(colors, fig),
						fill: 'start',
						tension: 0.35,
					},
				]
			: fig.slices.map((slice, position) => {
					const color = sliceColor(colors, fig, position);
					return {
						label: slice.label,
						data: slice.data,
						borderColor: color,
						backgroundColor: color,
						pointBackgroundColor: color,
						tension: 0.35,
					};
				});
		if (fig.previous && single) {
			lines.push({
				label: fig.against.title,
				data: fig.previous,
				borderColor: colors.hush,
				backgroundColor: colors.hush,
				pointBackgroundColor: colors.hush,
				pointHoverBackgroundColor: colors.hush,
				borderWidth: compact ? 1.25 : 1.5,
				borderDash: [5, 5],
				fill: false,
				tension: 0.35,
			});
		}
		const options = chartDefaults(colors, flags, {
			layout: { padding: compact ? { top: 6, right: 2, bottom: 2, left: 2 } : { top: 28, right: 12 } },
			plugins: {
				tooltip: {
					callbacks: {
						title: (items) => {
							const at = items[0].dataIndex;
							return (
								fig.titles[at] +
								(fig.against && single ? ` (against ${monthYear(fig.against.from + at)})` : '')
							);
						},
						label: (item) => ` ${item.dataset.label}: ${formatFor(fig.measure, item.parsed.y, true)}`,
					},
				},
			},
			scales: {
				y: {
					beginAtZero: SAMPLE.measures[fig.measure].reads === 'flow',
					ticks: { callback: tickFormatter(fig.measure) },
				},
			},
		});
		const lastValue = {
			id: 'rptLastValue',
			afterDatasetsDraw(chart) {
				const point = chart.getDatasetMeta(0).data[last];
				const area = chart.chartArea;
				if (!point || !single) return;
				canvasPill(
					chart.ctx,
					colors,
					point.x,
					point.y - 10,
					formatFor(fig.measure, fig.totals[last]),
					{ left: area.left, right: area.right + 10, top: 0 },
					{ align: 'right', dot: leadColor(colors, fig) },
				);
			},
		};
		return {
			type: 'line',
			data: { labels: fig.ticks, datasets: lines },
			options,
			plugins: compact ? [] : [lastValue],
		};
	}

	/** Stacked columns with the overall line and its figures over them. */
	function stackedChart(colors, fig, flags) {
		const compact = flags.compact;
		const topLayer = fig.slices.length - 1;
		const roundTop = compact ? 3 : 6;
		const columns = fig.slices.map((slice, position) => {
			const color = sliceColor(colors, fig, position);
			return {
				type: 'bar',
				label: slice.label,
				data: slice.data,
				stack: 'one',
				order: 2,
				backgroundColor: position === 0 ? columnFill(color, 0.95, 0.72) : translucent(color, 0.9),
				hoverBackgroundColor: color,
				borderRadius: position === topLayer ? { topLeft: roundTop, topRight: roundTop } : 0,
				borderColor: colors.paper,
				borderWidth: position === 0 ? 0 : { bottom: compact ? 1 : 2 },
				borderSkipped: false,
				barPercentage: 0.62,
				categoryPercentage: 0.82,
				maxBarThickness: 40,
			};
		});
		if (fig.slices.length > 1 && !compact) {
			columns.unshift({
				type: 'line',
				label: 'Total',
				data: fig.totals,
				stack: 'total',
				order: 0,
				borderColor: colors.ink,
				backgroundColor: colors.ink,
				borderWidth: 2,
				tension: 0.3,
				pointRadius: 3,
				pointBackgroundColor: colors.paper,
				pointBorderColor: colors.ink,
				pointBorderWidth: 2,
			});
		}
		const labelEach = fig.totals.length <= 6;

		function totalsFirstLast(a, b) {
			if (a.dataset.label === 'Total') return 1;
			if (b.dataset.label === 'Total') return -1;
			return b.datasetIndex - a.datasetIndex;
		}

		const options = chartDefaults(colors, flags, {
			layout: { padding: compact ? { top: 4 } : { top: 26, right: 8 } },
			plugins: {
				tooltip: {
					itemSort: totalsFirstLast,
					callbacks: {
						title: (items) => fig.titles[items[0].dataIndex],
						label: (item) => ` ${item.dataset.label}: ${formatFor(fig.measure, item.parsed.y, true)}`,
					},
				},
			},
			scales: {
				x: { stacked: true },
				y: { stacked: true, beginAtZero: true, ticks: { callback: tickFormatter(fig.measure) } },
			},
		});
		const totalsLayer = {
			id: 'rptColumnTotals',
			afterDatasetsDraw(chart) {
				if (fig.slices.length < 2) return;
				const points = chart.getDatasetMeta(0).data;
				const area = chart.chartArea;
				for (const [at, point] of points.entries()) {
					const amount = formatFor(fig.measure, fig.totals[at]);
					if (labelEach) canvasLabel(chart.ctx, colors.ink, amount, point.x, point.y - 9, 'center');
					else if (at === points.length - 1)
						canvasPill(
							chart.ctx,
							colors,
							point.x,
							point.y - 10,
							`Total ${amount}`,
							{ left: area.left, right: area.right + 8, top: 0 },
							{ align: 'right', dot: colors.ink },
						);
				}
			},
		};
		return {
			type: 'bar',
			data: { labels: fig.ticks, datasets: columns },
			options,
			plugins: compact ? [] : [totalsLayer],
		};
	}

	/** Plain columns; anything below zero takes the danger color. */
	function columnChart(colors, fig, flags) {
		const compact = flags.compact;
		const color = leadColor(colors, fig);
		const values = fig.totals;
		const options = chartDefaults(colors, flags, {
			layout: { padding: compact ? { top: 4 } : { top: 22 } },
			plugins: {
				tooltip: {
					displayColors: false,
					callbacks: {
						title: (items) => fig.titles[items[0].dataIndex],
						label: (item) => ` ${formatFor(fig.measure, item.parsed.y, true)}`,
					},
				},
			},
			scales: { y: { beginAtZero: true, ticks: { callback: tickFormatter(fig.measure) } } },
		});
		const bestMonth = {
			id: 'rptBestMonth',
			afterDatasetsDraw(chart) {
				const best = values.indexOf(Math.max(...values));
				const column = chart.getDatasetMeta(0).data[best];
				const area = chart.chartArea;
				if (!column) return;
				canvasPill(
					chart.ctx,
					colors,
					column.x,
					column.y - 6,
					`Best ${fig.titles[best].split(' ')[0]} · ${formatFor(fig.measure, values[best])}`,
					{ left: area.left, right: area.right, top: 0 },
					{ dot: color },
				);
			},
		};
		return {
			type: 'bar',
			data: {
				labels: fig.ticks,
				datasets: [
					{
						label: SAMPLE.measures[fig.measure].label,
						data: values,
						backgroundColor: values.map((value) =>
							value < 0 ? translucent(colors.alarm, 0.85) : translucent(color, 0.9),
						),
						hoverBackgroundColor: values.map((value) => (value < 0 ? colors.alarm : color)),
						borderRadius: compact ? 3 : 6,
						borderSkipped: false,
						barPercentage: 0.6,
						maxBarThickness: 34,
					},
				],
			},
			options,
			plugins: compact ? [] : [bestMonth],
		};
	}

	/** Each slice's share of the whole, stacked to 100%. */
	function shareChart(colors, fig, flags) {
		const bands = fig.slices.map((slice, position) => {
			const color = sliceColor(colors, fig, position);
			return {
				label: slice.label,
				data: fig.shares[position].map((value) => Math.round(value * 10) / 10),
				borderColor: color,
				backgroundColor: translucent(color, gradientsOff() ? 0.5 : 0.62),
				pointBackgroundColor: color,
				fill: position === 0 ? 'origin' : '-1',
				tension: 0.3,
				borderWidth: flags.compact ? 1.5 : 2,
			};
		});
		const options = chartDefaults(colors, flags, {
			plugins: {
				tooltip: {
					callbacks: {
						title: (items) => fig.titles[items[0].dataIndex],
						label: (item) => ` ${item.dataset.label}: ${item.parsed.y.toFixed(1)}%`,
					},
				},
			},
			scales: {
				y: { stacked: true, min: 0, max: 100, ticks: { stepSize: 25, callback: (value) => `${value}%` } },
			},
		});
		return { type: 'line', data: { labels: fig.ticks, datasets: bands }, options };
	}

	/** A doughnut with the overall figure written in the hole. */
	function ringChart(colors, fig, flags) {
		const compact = flags.compact;
		const fills = fig.slices.map((slice, position) => sliceColor(colors, fig, position));
		const options = chartDefaults(colors, flags, {
			cutout: compact ? '70%' : '74%',
			interaction: { mode: 'nearest', intersect: true },
			layout: { padding: compact ? 4 : 10 },
			scales: { x: { display: false }, y: { display: false } },
			plugins: {
				tooltip: {
					callbacks: {
						label: (item) =>
							` ${item.label}: ${formatFor(fig.measure, item.parsed, true)} (${percent((item.parsed / fig.headline) * 100, 1)})`,
					},
				},
			},
		});
		const hole = {
			id: 'rptRingCenter',
			afterDraw(chart) {
				const area = chart.chartArea;
				if (!area) return;
				const middleX = (area.left + area.right) / 2;
				const middleY = (area.top + area.bottom) / 2;
				const ctx = chart.ctx;
				ctx.save();
				ctx.textAlign = 'center';
				ctx.fillStyle = colors.ink;
				ctx.font = `700 ${compact ? 13 : 24}px ${TYPEFACE}`;
				ctx.textBaseline = compact ? 'middle' : 'alphabetic';
				ctx.fillText(formatFor(fig.measure, fig.headline), middleX, compact ? middleY : middleY + 2);
				if (!compact) {
					ctx.fillStyle = colors.hush;
					ctx.font = `500 12px ${TYPEFACE}`;
					ctx.fillText(
						SAMPLE.measures[fig.measure].reads === 'level' ? `in ${monthYear(fig.to)}` : 'in the period',
						middleX,
						middleY + 22,
					);
				}
				ctx.restore();
			},
		};
		return {
			type: 'doughnut',
			data: {
				labels: fig.slices.map((slice) => slice.label),
				datasets: [
					{
						data: fig.slices.map((slice) => slice.value),
						backgroundColor: fills,
						hoverBackgroundColor: fills,
						borderColor: colors.paper,
						borderWidth: 2,
						hoverOffset: compact ? 0 : 6,
					},
				],
			},
			options,
			plugins: [hole],
		};
	}

	/** Horizontal bars, largest first, with each value at the bar's end. */
	function rankedChart(colors, fig, flags) {
		const compact = flags.compact;
		const color = leadColor(colors, fig);
		const longest = Math.max(...fig.slices.map((slice) => slice.value)) || 1;
		const options = chartDefaults(colors, flags, {
			indexAxis: 'y',
			interaction: { mode: 'nearest', axis: 'y', intersect: false },
			layout: { padding: compact ? { right: 4 } : { right: 62 } },
			plugins: {
				tooltip: {
					displayColors: false,
					callbacks: {
						label: (item) =>
							` ${formatFor(fig.measure, item.parsed.x, true)} (${percent((item.parsed.x / fig.headline) * 100, 1)} of the total)`,
					},
				},
			},
			scales: {
				x: { display: false, beginAtZero: true, max: longest * (compact ? 1.02 : 1.0) },
				y: { display: !compact, grid: { display: false }, ticks: { color: colors.ink, padding: 8 } },
			},
		});
		const valueLabels = {
			id: 'rptBarEnds',
			afterDatasetsDraw(chart) {
				for (const [at, bar] of chart.getDatasetMeta(0).data.entries()) {
					canvasLabel(
						chart.ctx,
						colors.ink,
						formatFor(fig.measure, fig.slices[at].value),
						bar.x + 8,
						bar.y + 0.5,
						'left',
						11.5,
						'middle',
					);
				}
			},
		};
		return {
			type: 'bar',
			data: {
				labels: fig.slices.map((slice) => (compact ? slice.short || slice.label : slice.label)),
				datasets: [
					{
						label: SAMPLE.measures[fig.measure].label,
						data: fig.slices.map((slice) => slice.value),
						backgroundColor: fig.slices.map((slice, at) => (at === 0 ? color : translucent(color, 0.55))),
						hoverBackgroundColor: color,
						borderRadius: compact ? 3 : 5,
						borderSkipped: false,
						barPercentage: 0.7,
						categoryPercentage: 0.86,
					},
				],
			},
			options,
			plugins: compact ? [] : [valueLabels],
		};
	}

	/** Cancellation reasons with the running share and a dotted 80% mark. */
	function paretoChart(colors, fig, flags) {
		const compact = flags.compact;
		const color = colors.ramp[2];
		const shares = fig.reasons.map((reason) => Math.round((reason.value / (fig.headline || 1)) * 1000) / 10);
		let carried = 0;
		const running = shares.map((share) => {
			carried += share;
			return Math.min(100, Math.round(carried * 10) / 10);
		});
		const vital = running.findIndex((share) => share >= 80);
		const strong = columnFill(color);
		const faint = columnFill(color, 0.34, 0.16);
		const options = chartDefaults(colors, flags, {
			layout: { padding: compact ? { top: 4 } : { top: 26 } },
			plugins: {
				tooltip: {
					itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
					callbacks: {
						title: (items) => fig.reasons[items[0].dataIndex].label,
						label: (item) =>
							item.dataset.label === 'Share'
								? ` ${whole(fig.reasons[item.dataIndex].value)} accounts, ${item.parsed.y}%`
								: ` Running total: ${item.parsed.y}%`,
					},
				},
			},
			scales: {
				x: { ticks: { autoSkip: false } },
				y: { min: 0, max: 100, ticks: { stepSize: 25, callback: (value) => `${value}%` } },
			},
		});
		const eightyMark = {
			id: 'rptEightyLine',
			beforeDatasetsDraw(chart) {
				const {
					ctx,
					chartArea: area,
					scales: { y: yScale },
				} = chart;
				const level = yScale.getPixelForValue(80);
				ctx.save();
				ctx.strokeStyle = colors.faint;
				ctx.lineWidth = 1.25;
				ctx.setLineDash([2, 4]);
				ctx.beginPath();
				ctx.moveTo(area.left, level);
				ctx.lineTo(area.right, level);
				ctx.stroke();
				ctx.restore();
			},
			afterDatasetsDraw(chart) {
				if (compact) return;
				const area = chart.chartArea;
				const point = chart.getDatasetMeta(0).data[vital];
				if (!point) return;
				canvasPill(
					chart.ctx,
					colors,
					point.x + 10,
					point.y + 26,
					`Top ${vital + 1} · ${Math.round(running[vital])}% of cancellations`,
					{ left: area.left, right: area.right + 6, top: 0 },
					{ align: 'left', dot: color },
				);
			},
		};
		return {
			type: 'bar',
			data: {
				labels: fig.reasons.map((reason) => reason.short),
				datasets: [
					{
						type: 'line',
						label: 'Running total',
						data: running,
						order: 0,
						borderColor: colors.ink,
						backgroundColor: colors.ink,
						borderWidth: compact ? 1.5 : 2,
						tension: 0.3,
						pointRadius: compact ? 0 : 3,
						pointBackgroundColor: colors.paper,
						pointBorderColor: colors.ink,
						pointBorderWidth: 2,
					},
					{
						type: 'bar',
						label: 'Share',
						data: shares,
						order: 2,
						barPercentage: 0.64,
						maxBarThickness: 40,
						backgroundColor: (context) => (context.dataIndex <= vital ? strong(context) : faint(context)),
						hoverBackgroundColor: (context) =>
							context.dataIndex <= vital ? color : translucent(color, 0.55),
					},
				],
			},
			options,
			plugins: [eightyMark],
		};
	}

	/** Actual new MRR on a track, with the plan marked as a tick. */
	function bulletChart(colors, fig, flags) {
		const compact = flags.compact;
		const regions = fig.regions;
		const reach = Math.max(...regions.map((region) => Math.max(region.value, region.target))) * 1.12;
		const options = chartDefaults(colors, flags, {
			indexAxis: 'y',
			interaction: { mode: 'nearest', axis: 'y', intersect: false },
			layout: { padding: compact ? { right: 2 } : { right: 4 } },
			plugins: {
				tooltip: {
					filter: (item) => item.datasetIndex === 0,
					callbacks: {
						label: (item) =>
							` ${dollars(regions[item.dataIndex].value, true)} of a ${dollars(regions[item.dataIndex].target, true)} plan`,
					},
				},
			},
			scales: {
				x: {
					max: reach,
					beginAtZero: true,
					grid: { display: false },
					ticks: { maxTicksLimit: 4, callback: moneyTick },
				},
				y: { display: !compact, grid: { display: false }, ticks: { color: colors.ink } },
			},
		});
		const planTicks = {
			id: 'rptPlanTicks',
			afterDatasetsDraw(chart) {
				const {
					ctx,
					scales: { x: xScale },
				} = chart;
				ctx.save();
				for (const [at, track] of chart.getDatasetMeta(1).data.entries()) {
					const region = regions[at];
					const tickX = xScale.getPixelForValue(region.target);
					const half = track.height / 2;
					ctx.strokeStyle = colors.ink;
					ctx.lineWidth = compact ? 2 : 2.5;
					ctx.lineCap = 'round';
					ctx.beginPath();
					ctx.moveTo(tickX, track.y - half + 3);
					ctx.lineTo(tickX, track.y + half - 3);
					ctx.stroke();
					if (compact) continue;
					const gap = Math.round(((region.value - region.target) / region.target) * 100);
					const sign = gap > 0 ? '+' : gap < 0 ? '−' : '';
					ctx.fillStyle = colors.ink;
					ctx.font = `600 11px ${TYPEFACE}`;
					ctx.textAlign = 'right';
					ctx.textBaseline = 'middle';
					ctx.fillText(`${sign}${Math.abs(gap)}%`, track.x - 8, track.y + 0.5);
				}
				ctx.restore();
			},
		};
		return {
			type: 'bar',
			data: {
				labels: regions.map((region) => (compact ? region.short : region.label)),
				datasets: [
					{
						label: 'New MRR',
						data: regions.map((region) => region.value),
						backgroundColor: translucent(leadColor(colors, fig), 0.95),
						hoverBackgroundColor: leadColor(colors, fig),
						barPercentage: 0.36,
						categoryPercentage: 1,
						borderRadius: compact ? 2 : 4,
						grouped: false,
						order: 0,
					},
					{
						label: 'Track',
						data: regions.map(() => reach),
						backgroundColor: colors.groove,
						hoverBackgroundColor: colors.groove,
						borderRadius: compact ? 3 : 6,
						barPercentage: 0.74,
						categoryPercentage: 1,
						grouped: false,
						order: 1,
					},
				],
			},
			options,
			plugins: [planTicks],
		};
	}

	/* Charts are built when their canvas scrolls into view and forgotten once
     the canvas leaves the page. */

	function paint(canvas, recipe, animate) {
		charts.get(canvas)?.chart?.destroy();
		const chart = new Chart(canvas, recipe(colorsNow(), animate && !reducedMotion));
		charts.set(canvas, { chart, recipe });
	}

	/** Forgets charts whose canvas has left the page. */
	function pruneCharts() {
		for (const [canvas, entry] of charts) {
			if (canvas.isConnected) continue;
			entry.chart?.destroy();
			charts.delete(canvas);
		}
	}

	function paintSeen(entries) {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			watcher.unobserve(entry.target);
			const recipe = queued.get(entry.target);
			queued.delete(entry.target);
			if (recipe && entry.target.isConnected) paint(entry.target, recipe, true);
		}
	}

	function paintWhenSeen(canvas, recipe) {
		if (!watcher) {
			paint(canvas, recipe, false);
			return;
		}
		queued.set(canvas, recipe);
		watcher.observe(canvas);
	}

	/** Fills a box with the report's chart, or a short note when the filters leave nothing. */
	function placeChart(box, fig, flags) {
		box.textContent = '';
		if (fig.empty) {
			box.innerHTML =
				'<p class="rpt-nodata"><i class="bi bi-funnel" aria-hidden="true"></i>Nothing to show for these filters.</p>';
			return;
		}
		const canvas = document.createElement('canvas');
		canvas.setAttribute('role', 'img');
		canvas.setAttribute('aria-label', `${fig.report.name}. ${sentenceFor(fig)}`);
		box.appendChild(canvas);

		function recipe(colors, animate) {
			return RECIPES[fig.report.kind](colors, fig, { ...flags, animate });
		}

		if (flags.deferred) paintWhenSeen(canvas, recipe);
		else paint(canvas, recipe, flags.animate !== false);
	}

	/** The legend as HTML list items, so long keys wrap instead of colliding. */
	function legendFor(fig) {
		const colors = colorsNow();
		const kind = fig.report.kind;

		function entry(shape, label, color) {
			return `<li><span class="rpt-key-${shape}" style="--rpt-c:${color}"></span>${htmlSafe(label)}</li>`;
		}

		function sliceEntries(shape) {
			return fig.slices.map((slice, at) => entry(shape, slice.label, sliceColor(colors, fig, at))).join('');
		}

		if (kind === 'line') {
			if (fig.slices.length > 1) return sliceEntries('line');
			const current = entry(
				'line',
				`${SAMPLE.measures[fig.measure].label}, ${spanText(fig.from, fig.to)}`,
				leadColor(colors, fig),
			);
			return current + (fig.previous ? entry('line rpt-key-line-dashed', fig.against.title, colors.hush) : '');
		}
		if (kind === 'stacked')
			return sliceEntries('bar') + (fig.slices.length > 1 ? entry('line', 'Total', colors.ink) : '');
		if (kind === 'share') return sliceEntries('band');
		if (kind === 'ring') return sliceEntries('bar');
		const fixed = {
			columns: () => entry('bar', 'Added', leadColor(colors, fig)) + entry('bar', 'Lost', colors.alarm),
			pareto: () =>
				entry('bar', 'Share of cancellations', colors.ramp[2]) +
				entry('line', 'Running total', colors.ink) +
				entry('line rpt-key-line-dotted', '80% mark', colors.faint),
			bullet: () => entry('bar', 'New MRR', leadColor(colors, fig)) + entry('tick', 'Plan', colors.ink),
			bars: () => entry('bar', SAMPLE.measures[fig.measure].label, leadColor(colors, fig)),
		};
		return fixed[kind] ? fixed[kind]() : '';
	}

	/* The lens is the date range, the comparison and the three filters every
     figure on the page is read through. */

	function wireLens() {
		function optionsHtml(allLabel, items) {
			const choices = items.map((item) => `<option value="${item.id}">${htmlSafe(item.name)}</option>`).join('');
			return `<option value="all">${allLabel}</option>${choices}`;
		}

		filterSelects.plan.innerHTML = optionsHtml('All plans', SAMPLE.plans);
		filterSelects.region.innerHTML = optionsHtml('All regions', SAMPLE.regions);
		filterSelects.segment.innerHTML = optionsHtml('All segments', SAMPLE.segments);

		monthPickers = pickAll('[data-rpt-month]', customForm).map(makeMonthPicker);
		const [startPicker, endPicker] = monthPickers;
		document.addEventListener('pointerdown', (event) => {
			for (const picker of monthPickers) {
				if (!picker.holder.contains(event.target)) picker.shut(false);
			}
		});
		startPicker.choose(ui.from);
		endPicker.choose(ui.to);

		for (const [field, select] of Object.entries(filterSelects)) {
			select.addEventListener('change', () => {
				if (ui[field] === select.value) return;
				ui[field] = select.value;
				if (field !== 'compare') {
					reload();
					return;
				}
				paintLens();
				paintAll();
			});
		}

		pick('[data-rpt-range]').addEventListener('change', (event) => {
			const chosen = event.target.value;
			if (!chosen) return;
			customForm.hidden = chosen !== 'custom';
			if (chosen === 'custom') {
				startPicker.choose(ui.from);
				endPicker.choose(ui.to);
				startPicker.button.focus();
				return;
			}
			ui.span = chosen;
			applySpan();
			reload();
		});

		customForm.addEventListener('submit', applyCustomRange);
	}

	function applyCustomRange(event) {
		event.preventDefault();
		const first = indexOfMonth(fromField.value);
		const last = indexOfMonth(toField.value);
		const note = pick('[data-rpt-custom-note]');
		const invalid =
			!fromField.value ||
			!toField.value ||
			isNaN(first) ||
			isNaN(last) ||
			first < EARLIEST ||
			last > FINAL ||
			last < first ||
			last - first > 11;
		for (const picker of monthPickers) {
			picker.button.classList.toggle('is-invalid', invalid);
			picker.button.setAttribute('aria-invalid', String(invalid));
		}
		note.textContent = invalid
			? `Pick a start no later than the end, within ${monthYear(EARLIEST)} to ${monthYear(FINAL)}, up to 12 months.`
			: `Up to 12 whole months, from ${fullMonth(EARLIEST)}.`;
		note.classList.toggle('is-error', invalid);
		if (invalid) return;
		ui.span = 'custom';
		ui.from = first;
		ui.to = last;
		reload();
	}

	/**
	 * One end of the custom range: a button that opens a year as a four by
	 * three grid of months, with arrows to step between years. Only the last
	 * twelve months can be chosen, and the choice is kept as YYYY-MM in the
	 * hidden input beside the button.
	 * Keys: arrows move by a month or a row, Page Up and Page Down by a year,
	 * Home and End jump to the first and last month shown, Enter or Space
	 * chooses, Escape closes.
	 */
	function makeMonthPicker(holder) {
		const button = pick('[data-rpt-month-btn]', holder);
		const hidden = pick('input[type="hidden"]', holder);
		const pop = pick('[data-rpt-month-pop]', holder);

		function yearOf(index) {
			return dateOfMonth(index).getFullYear();
		}

		function clamp(index) {
			return Math.min(FINAL, Math.max(EARLIEST, index));
		}

		let shownYear = yearOf(FINAL);
		let focusIndex = FINAL;
		/* A repaint removes the focused cell; that must not count as leaving. */
		let repainting = false;
		const handle = { holder, button, choose, shut };

		button.addEventListener('click', () => {
			if (pop.hidden) openPop();
			else shut(true);
		});
		button.addEventListener('keydown', (event) => {
			if (pop.hidden && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
				event.preventDefault();
				openPop();
			}
		});
		pop.addEventListener('click', (event) => {
			const stepper = event.target.closest('[data-rpt-year]');
			if (stepper) {
				stepYear(stepper.getAttribute('data-rpt-year'));
				return;
			}
			const cell = event.target.closest('[data-rpt-month-i]');
			if (!cell || cell.disabled) return;
			choose(Number(cell.getAttribute('data-rpt-month-i')));
			shut(true);
		});
		pop.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				event.stopPropagation();
				shut(true);
				return;
			}
			const cell = event.target.closest('[data-rpt-month-i]');
			if (!cell) return;
			const index = Number(cell.getAttribute('data-rpt-month-i'));
			const january = indexOfMonth(`${shownYear}-01`);
			const targets = {
				ArrowLeft: index - 1,
				ArrowRight: index + 1,
				ArrowUp: index - 4,
				ArrowDown: index + 4,
				PageUp: index - 12,
				PageDown: index + 12,
				Home: january,
				End: january + 11,
			};
			if (!(event.key in targets)) return;
			event.preventDefault();
			focusIndex = clamp(targets[event.key]);
			shownYear = yearOf(focusIndex);
			paintGrid(true);
		});
		holder.addEventListener('focusout', (event) => {
			if (!repainting && !holder.contains(event.relatedTarget)) shut(false);
		});
		return handle;

		function paintGrid(focus) {
			repainting = true;
			const january = indexOfMonth(`${shownYear}-01`);
			const cells = runFrom(january, january + 11)
				.map((index) => {
					const outside = index < EARLIEST || index > FINAL;
					const chosen = monthKey(index) === hidden.value;
					return `<button type="button" class="rpt-month-cell${chosen ? ' is-selected' : ''}" data-rpt-month-i="${index}" aria-pressed="${chosen}" aria-label="${htmlSafe(fullMonth(index))}"${outside ? ' disabled' : ''} tabindex="${index === focusIndex ? 0 : -1}">${htmlSafe(shortMonth(index))}</button>`;
				})
				.join('');
			const earlierOff = shownYear <= yearOf(EARLIEST) ? ' disabled' : '';
			const laterOff = shownYear >= yearOf(FINAL) ? ' disabled' : '';
			pop.innerHTML =
				`<div class="rpt-month-nav">` +
				`<button type="button" class="rpt-month-step" data-rpt-year="-1" aria-label="Previous year"${earlierOff}><i class="bi bi-chevron-left" aria-hidden="true"></i></button>` +
				`<p class="rpt-month-year" id="${pop.id}Year" aria-live="polite">${shownYear}</p>` +
				`<button type="button" class="rpt-month-step" data-rpt-year="1" aria-label="Next year"${laterOff}><i class="bi bi-chevron-right" aria-hidden="true"></i></button>` +
				`</div><div class="rpt-month-grid" role="group" aria-labelledby="${pop.id}Year">${cells}</div>`;
			if (focus) pick('[tabindex="0"]', pop).focus();
			repainting = false;
		}

		function stepYear(direction) {
			shownYear += Number(direction);
			focusIndex = clamp(
				indexOfMonth(`${shownYear}-${String(dateOfMonth(focusIndex).getMonth() + 1).padStart(2, '0')}`),
			);
			paintGrid(false);
			const sameArrow = pick(`[data-rpt-year="${direction}"]`, pop);
			(sameArrow.disabled ? pick('[tabindex="0"]', pop) : sameArrow).focus();
		}

		/* Pulls the popup back inside the window when the button sits near the right edge. */
		function keepInView() {
			pop.style.left = '';
			const box = pop.getBoundingClientRect();
			const overflow = box.right - (document.documentElement.clientWidth - 8);
			if (overflow > 0) pop.style.left = `${-Math.min(overflow, box.left - 8)}px`;
		}

		function openPop() {
			for (const other of monthPickers) {
				if (other !== handle) other.shut(false);
			}
			const chosen = indexOfMonth(hidden.value);
			focusIndex = clamp(isNaN(chosen) ? FINAL : chosen);
			shownYear = yearOf(focusIndex);
			pop.hidden = false;
			button.setAttribute('aria-expanded', 'true');
			button.classList.add('is-open');
			paintGrid(true);
			keepInView();
		}

		function shut(refocus) {
			if (pop.hidden) return;
			pop.hidden = true;
			pop.textContent = '';
			button.setAttribute('aria-expanded', 'false');
			button.classList.remove('is-open');
			if (refocus) button.focus();
		}

		function choose(index) {
			hidden.value = monthKey(index);
			button.textContent = monthYear(index);
		}
	}

	/** Writes the range summary and the removable chips for filters in use. */
	function paintLens() {
		const against = comparisonFor(ui.from, ui.to, ui.compare);
		const length = ui.to - ui.from + 1;
		const summary = pick('[data-rpt-summary]');
		summary.textContent = `${spanText(ui.from, ui.to)} (${length}${length === 1 ? ' month' : ' months'})${against ? `, against ${spanText(against.from, against.to)}.` : ', with no comparison.'}`;

		function nameIn(list, id) {
			return list.find((item) => item.id === id)?.name;
		}

		const chips = [
			['plan', 'Plan', SAMPLE.plans],
			['region', 'Region', SAMPLE.regions],
			['segment', 'Segment', SAMPLE.segments],
		]
			.filter(([field]) => ui[field] !== 'all')
			.map(([field, title, list]) => ({
				label: `${title}: ${nameIn(list, ui[field])}`,
				remove() {
					setFilter(field, 'all');
				},
			}));
		window.Basalt.drawer?.applied?.(
			pick('[data-rpt-applied]'),
			chips,
			() => {
				ui.plan = 'all';
				ui.region = 'all';
				ui.segment = 'all';
				matchSelects();
				reload();
			},
			summary,
		);
	}

	function matchSelects() {
		for (const field of ['plan', 'region', 'segment', 'compare']) {
			if (filterSelects[field].value !== ui[field]) filterSelects[field].value = ui[field];
		}
	}

	function setFilter(field, value) {
		ui[field] = value;
		matchSelects();
		reload();
	}

	/* Each change of lens reloads the figures; placeholders hold the layout
     while they come, and a failure gets its own message with a retry. */

	/** Asks for the figures again; an answer that arrives after a newer request is dropped. */
	function reload() {
		requestNo += 1;
		const mine = requestNo;
		ui.ready = false;
		paintLens();
		showPlaceholders();
		server
			.figures(
				{ from: monthKey(ui.from), to: monthKey(ui.to) },
				{ plan: ui.plan, region: ui.region, segment: ui.segment },
			)
			.then((strands) => {
				if (mine !== requestNo) return;
				ui.strands = strands;
				ui.failure = null;
				ui.ready = true;
				paintAll();
				say(`Figures updated for ${spanText(ui.from, ui.to)}.`);
			})
			.catch((failure) => {
				if (mine !== requestNo) return;
				ui.failure = failure;
				showFailure(failure);
			});
	}

	function showPlaceholders() {
		pinnedBox.setAttribute('aria-busy', 'true');
		results.setAttribute('aria-busy', 'true');
		const ghost =
			'<div class="basalt-trend-card rpt-kpi rpt-kpi-ghost" aria-hidden="true"><span class="basalt-skeleton basalt-skeleton-text rpt-w-50"></span><span class="basalt-skeleton basalt-skeleton-title rpt-w-70"></span><span class="basalt-skeleton basalt-skeleton-text rpt-w-60"></span><span class="basalt-skeleton basalt-skeleton-block rpt-kpi-ghost-spark"></span></div>';
		pinnedBox.innerHTML = ghost.repeat(PINNED.length);
		/* Cards already on the page stay put; only their previews wait. */
		for (const box of pickAll('[data-rpt-chart]', results))
			box.innerHTML =
				'<span class="basalt-skeleton basalt-skeleton-block rpt-chart-ghost" aria-hidden="true"></span>';
		if (!results.children.length) results.innerHTML = ghostCards(4);
	}

	function ghostCards(count) {
		const card =
			'<div class="card basalt-box rpt-card rpt-card-ghost"><span class="basalt-skeleton basalt-skeleton-text rpt-w-30"></span><span class="basalt-skeleton basalt-skeleton-title rpt-w-70"></span><span class="basalt-skeleton basalt-skeleton-text"></span><span class="basalt-skeleton basalt-skeleton-block rpt-chart-ghost"></span><span class="basalt-skeleton basalt-skeleton-text rpt-w-50"></span></div>';
		return `<div class="rpt-grid" aria-hidden="true">${card.repeat(count)}</div>`;
	}

	function showFailure(failure) {
		pinnedBox.removeAttribute('aria-busy');
		results.removeAttribute('aria-busy');
		const reason = failure?.message ? failure.message : 'Something went wrong.';
		pinnedBox.innerHTML = `<div class="basalt-empty basalt-empty-framed basalt-empty-danger rpt-error" role="alert">
      <span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-cloud-slash"></i></span>
      <h3 class="basalt-empty-title">The figures did not load</h3>
      <p class="basalt-empty-text">${htmlSafe(reason)} Your reports are safe; this page just could not reach the numbers behind them.</p>
      <div class="basalt-empty-actions"><button type="button" class="btn btn-sm btn-primary" data-rpt-retry><i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Try again</button></div>
    </div>`;
		for (const box of pickAll('[data-rpt-chart]', results))
			box.innerHTML =
				'<p class="rpt-nodata"><i class="bi bi-cloud-slash" aria-hidden="true"></i>Preview not loaded</p>';
		say('The figures did not load.');
	}

	function paintAll() {
		if (!ui.ready) return;
		paintLens();
		paintPinned();
		paintLibrary();
		paintHeroFigures();
		if (quick.report && drawerNode.classList.contains('show')) openQuickView(quick.report.id, true);
	}

	/* The four pinned figures read first, each with a sparkline. */

	/** Each pinned figure for a range, with its month-by-month line. */
	function pinnedValues(from, to) {
		const months = runFrom(from, to);

		function at(field, month) {
			return addUp(ui.strands.map((strand) => strand.ledger[month][field]));
		}

		function kept(month) {
			return at('opening', month) + at('upsold', month) - at('downsold', month) - at('lost', month);
		}

		const opening = addUp(ui.strands.map((strand) => strand.ledger[from].opening));
		return {
			mrr: { value: at('closing', to), spark: months.map((month) => at('closing', month)) },
			netnew: {
				value: at('closing', to) - opening,
				spark: months.map(
					(month) => at('gained', month) + at('upsold', month) - at('downsold', month) - at('lost', month),
				),
			},
			accounts: { value: at('accounts', to), spark: months.map((month) => at('accounts', month)) },
			/* Each month's kept-and-grown share of its opening MRR, compounded. */
			nrr: {
				value:
					100 *
					months.reduce((carried, month) => {
						const base = at('opening', month);
						return base ? carried * (kept(month) / base) : carried;
					}, 1),
				spark: months.map((month) => {
					const base = at('opening', month);
					return base ? (kept(month) / base) * 100 : 0;
				}),
			},
		};
	}

	function pinnedText(id, value) {
		if (id === 'nrr') return percent(value, 1);
		return id === 'accounts' ? whole(value) : dollars(value);
	}

	function paintPinned() {
		pinnedBox.removeAttribute('aria-busy');
		const against = comparisonFor(ui.from, ui.to, ui.compare);
		const current = pinnedValues(ui.from, ui.to);
		const earlier = against ? pinnedValues(against.from, against.to) : null;
		pinnedBox.innerHTML = PINNED.map((pin) => {
			const figure = current[pin.id];
			const before = earlier ? earlier[pin.id].value : null;
			let delta = `<p class="basalt-trend-card-delta"><span class="basalt-trend-card-vs">${htmlSafe(pin.note)}</span></p>`;
			let spoken = '';
			if (before != null) {
				const change =
					pin.id === 'nrr'
						? figure.value - before
						: before
							? ((figure.value - before) / Math.abs(before)) * 100
							: 0;
				const rising = change >= 0;
				const size = pin.id === 'nrr' ? `${Math.abs(change).toFixed(1)} pts` : percent(Math.abs(change), 1);
				delta = `<p class="basalt-trend-card-delta ${rising ? 'is-up' : 'is-down'}"><i class="bi ${rising ? 'bi-arrow-up-right' : 'bi-arrow-down-right'}" aria-hidden="true"></i><span>${rising ? '+' : '−'}${size}</span> <span class="basalt-trend-card-vs" title="On the ${against.phrase}">vs ${pinnedText(pin.id, before)}</span></p>`;
				spoken = `, ${rising ? 'up' : 'down'} ${size} on the ${against.phrase}`;
			}
			const monthlyWords = figure.spark
				.map((value, at) => `${shortMonth(ui.from + at)} ${pinnedText(pin.id, value)}`)
				.join(', ');
			return `<article class="card basalt-trend-card rpt-kpi rpt-tone-${pin.tone}">
        <div class="basalt-trend-card-top">
          <h3 class="basalt-trend-card-label">${htmlSafe(pin.label)}</h3>
          <span class="basalt-trend-card-icon" aria-hidden="true"><i class="bi ${pin.icon}"></i></span>
        </div>
        <p class="basalt-trend-card-value">${pinnedText(pin.id, figure.value)}</p>
        ${delta}
        <p class="visually-hidden">${htmlSafe(pin.label)} ${pinnedText(pin.id, figure.value)}${htmlSafe(spoken)}. By month: ${monthlyWords}.</p>
        <div class="basalt-trend-card-spark rpt-kpi-line" data-rpt-kpi-line="${pin.id}"></div>
      </article>`;
		}).join('');
		/* On the first paint each figure counts up from zero. */
		if (!pinnedBox.dataset.counted && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			pinnedBox.dataset.counted = 'yes';
			for (const pin of PINNED) {
				const node = pick(
					'.basalt-trend-card-value',
					pick(`[data-rpt-kpi-line="${pin.id}"]`, pinnedBox).closest('.rpt-kpi'),
				);
				const target = current[pin.id].value;
				const begin = performance.now();
				const step = (now) => {
					const at = Math.min(1, (now - begin) / 500);
					node.textContent = pinnedText(pin.id, target * (1 - (1 - at) ** 3));
					if (at < 1) requestAnimationFrame(step);
				};
				requestAnimationFrame(step);
			}
		}
		/* Pointing along a figure's line shows that month in the figure and
		   the line under it; leaving the line puts the period back. */
		for (const pin of PINNED) {
			const card = pick(`[data-rpt-kpi-line="${pin.id}"]`, pinnedBox).closest('.rpt-kpi');
			const valueText = pick('.basalt-trend-card-value', card);
			const delta = pick('.basalt-trend-card-delta', card);
			const resting = [valueText.textContent, delta.innerHTML, delta.className];
			const spark = current[pin.id].spark;
			window.Basalt.trendline?.(pick(`[data-rpt-kpi-line="${pin.id}"]`, card), spark, {
				labels: spark.map((value, at) => monthYear(ui.from + at)),
				format: (value) => pinnedText(pin.id, value),
				name: pin.label,
				onRead: (at, value, label) => {
					if (at === null) {
						[valueText.textContent, delta.innerHTML, delta.className] = resting;
						return;
					}
					valueText.textContent = pinnedText(pin.id, value);
					delta.className = 'basalt-trend-card-delta';
					const before = at > 0 ? spark[at - 1] : null;
					const change =
						before === null
							? ''
							: pin.id === 'nrr'
								? ` · ${value - before >= 0 ? '+' : '−'}${Math.abs(value - before).toFixed(1)} pts`
								: before
									? ` · ${value >= before ? '+' : '−'}${percent(Math.abs(((value - before) / Math.abs(before)) * 100), 1)}`
									: '';
					delta.innerHTML = `<span class="basalt-trend-card-vs">${htmlSafe(label)}${change}</span>`;
				},
			});
		}
	}

	function exportPinned() {
		if (!ui.ready) return;
		const against = comparisonFor(ui.from, ui.to, ui.compare);
		const current = pinnedValues(ui.from, ui.to);
		const earlier = against ? pinnedValues(against.from, against.to) : null;

		function cents(value) {
			return Math.round(value * 100) / 100;
		}

		const lines = [['Figure', spanText(ui.from, ui.to), ...(against ? [spanText(against.from, against.to)] : [])]];
		for (const pin of PINNED) {
			lines.push([pin.label, cents(current[pin.id].value), ...(earlier ? [cents(earlier[pin.id].value)] : [])]);
		}
		server.exportCsv(lines, `pinned-figures-${monthKey(ui.from)}-to-${monthKey(ui.to)}.csv`);
		notify({ tone: 'success', title: 'Figures exported', text: 'The CSV is in your downloads.' });
	}

	/* The library lists reports by shelf, search and sort, as cards or a table,
     four cards or ten rows to a page. */

	function wireLibrary() {
		shelfTabs.innerHTML = SHELVES.map(
			(shelf) =>
				`<input type="radio" class="btn-check" name="rptGroup" id="rpt-group-${shelf.id}" value="${shelf.id}"${shelf.id === 'all' ? ' checked' : ''}><label class="nav-link" for="rpt-group-${shelf.id}">${shelf.label} <span class="basalt-tabs-count" data-rpt-gcount="${shelf.id}">0</span></label>`,
		).join('');
		shelfTabs.addEventListener('change', (event) => {
			ui.shelf = event.target.value;
			backToFirstPage();
		});
		searchBox.addEventListener('input', () => {
			ui.query = searchBox.value;
			backToFirstPage();
		});
		pick('[data-rpt-sort]').addEventListener('change', (event) => {
			ui.order = event.target.value;
			backToFirstPage();
		});
		for (const radio of pickAll('[data-rpt-view]')) {
			radio.checked = radio.value === ui.layout;
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				ui.layout = radio.value;
				prefs.write('basalt-reports-view', radio.value);
				backToFirstPage();
			});
		}
		page.addEventListener('auxclick', (event) => {
			if (event.button === 1) followCard(event);
		});
		page.addEventListener('click', handlePageClick);
	}

	function backToFirstPage() {
		ui.page = 1;
		paintLibrary();
	}

	function drawingName(report) {
		return SAMPLE.drawings[report.kind].label;
	}

	/* A report opens in full on its own page; the drawer is the quick view. */
	function fullPageUrl(report) {
		return `report-details.html?id=${encodeURIComponent(report.id)}`;
	}

	function cadenceText(plan) {
		if (!plan) return '';
		const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		const hour = +plan.time.slice(0, 2);
		const clock = `${hour % 12 || 12}${plan.time.slice(2, 5)}${hour < 12 ? ' am' : ' pm'}`;
		if (plan.cadence === 'daily') return `Daily, ${clock}`;
		if (plan.cadence === 'weekly') return `Weekly, ${weekdays[plan.day]} ${clock}`;
		return `Monthly, ${withSuffix(plan.day)} ${clock}`;
	}

	function withSuffix(day) {
		const teens = day >= 11 && day <= 13;
		const endings = { 1: 'st', 2: 'nd', 3: 'rd' };
		return `${day}${(!teens && endings[day % 10]) || 'th'}`;
	}

	function sinceText(isoDay) {
		const stamp = new Date(`${isoDay}T12:00`);
		const days = Math.round((CLOCK - stamp) / 864e5);
		if (days <= 0) return 'today';
		if (days === 1) return 'yesterday';
		if (days < 14) return `${days} days ago`;
		return stamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function avatarHtml(ownerId) {
		if (ownerId === 'tpl')
			return '<span class="basalt-avatar basalt-avatar-sm basalt-avatar-outline rpt-avatar" aria-hidden="true"><i class="bi bi-layout-text-window-reverse"></i></span>';
		const tone = (SAMPLE.people.findIndex((who) => who.id === ownerId) % 8) + 1;
		return `<span class="basalt-avatar basalt-avatar-sm rpt-avatar basalt-avatar-tone-${tone}" aria-hidden="true">${monogram(personById(ownerId).name)}</span>`;
	}

	function ownerName(report) {
		return report.owner === 'tpl' ? 'Template' : htmlSafe(personById(report.owner).name);
	}

	/** The reports the shelf, search and sort leave, in order. */
	function filteredReports() {
		const shelf = SHELVES.find((item) => item.id === ui.shelf) || SHELVES[0];
		const query = ui.query.trim();

		function haystack(report) {
			return [
				report.name,
				report.summary,
				drawingName(report),
				personById(report.owner).name,
				SAMPLE.measures[report.metric].label,
			].join(' ');
		}

		const sorters = {
			recent: (a, b) => (b.updated > a.updated ? 1 : b.updated < a.updated ? -1 : 0),
			opened: (a, b) => b.opens - a.opens,
			name: (a, b) => a.name.localeCompare(b.name),
		};
		return catalog
			.filter((report) => shelf.holds(report) && (!query || window.Basalt.matchesQuery(haystack(report), query)))
			.sort(sorters[ui.order]);
	}

	function paintLibrary() {
		for (const shelf of SHELVES) {
			const badge = pick(`[data-rpt-gcount="${shelf.id}"]`);
			if (badge) badge.textContent = catalog.filter(shelf.holds).length;
		}
		pick('.rpt-groups')?.basaltTabs?.refresh();
		results.removeAttribute('aria-busy');
		pruneCharts();

		const shown = filteredReports();
		const pageSize = ui.layout === 'grid' ? 4 : 10;
		const pageCount = Math.max(1, Math.ceil(shown.length / pageSize));
		ui.page = Math.min(ui.page, pageCount);
		const onPage = shown.slice((ui.page - 1) * pageSize, ui.page * pageSize);
		pick('[data-rpt-count]').textContent = `${shown.length}${shown.length === 1 ? ' report' : ' reports'}`;

		if (!catalog.length || !shown.length) {
			results.innerHTML = catalog.length ? emptyShelf() : noReportsYet();
			pagerBox.hidden = true;
			return;
		}

		if (ui.layout === 'grid') {
			results.innerHTML = `<div class="rpt-grid">${onPage.map(reportCard).join('')}</div>`;
			for (const report of onPage) {
				const box = pick(`[data-rpt-chart="${report.id}"]`, results);
				if (!box) continue;
				if (ui.ready) placeChart(box, figuresFor(report, ui.strands), { compact: true, deferred: true });
				else
					box.innerHTML =
						'<span class="basalt-skeleton basalt-skeleton-block rpt-chart-ghost" aria-hidden="true"></span>';
			}
		} else {
			results.innerHTML = reportTable(onPage);
		}
		window.Basalt.menus?.(results);
		window.Basalt.tips?.(results);
		paintPager(shown.length, pageSize, pageCount);
	}

	function noReportsYet() {
		return `<div class="basalt-empty basalt-empty-framed rpt-empty">
      <span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-file-earmark-bar-graph"></i></span>
      <h3 class="basalt-empty-title">No reports yet</h3>
      <p class="basalt-empty-text">Build one from any number on this page, or start from a template and change it to suit.</p>
      <div class="basalt-empty-actions"><button type="button" class="btn btn-sm btn-primary" data-rpt-new><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>New report</button><button type="button" class="btn btn-sm btn-outline-secondary" data-rpt-open-templates>Browse templates</button></div>
    </div>`;
	}

	function emptyShelf() {
		const query = ui.query.trim();
		if (query) return window.Basalt.emptyState({ query, noun: 'reports' });
		const starred = ui.shelf === 'starred';
		return window.Basalt.emptyState({
			icon: starred ? 'star' : 'inbox',
			title: starred ? 'No starred reports' : 'Nothing here yet',
			text: starred ? 'Star a report to keep it at hand here.' : 'Reports you add will show up here.',
		});
	}

	function paintPager(count, pageSize, pageCount) {
		pagerBox.hidden = pageCount < 2;
		const first = (ui.page - 1) * pageSize + 1;
		pick('[data-rpt-pager-range]').innerHTML =
			`<strong>${first}–${Math.min(count, ui.page * pageSize)}</strong> of ${count} reports`;
		if (pager) {
			pager.setTotal(pageCount);
			if (pager.get() !== ui.page) pager.set(ui.page);
			return;
		}
		if (!window.Basalt.pagination) return;
		pager = window.Basalt.pagination(pick('[data-rpt-pager-pages]'), {
			total: pageCount,
			current: ui.page,
			label: 'Page',
			onChange: (chosen) => {
				ui.page = chosen;
				paintLibrary();
				results.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
			},
		});
	}

	function actionMenu(report) {
		const template = report.owner === 'tpl';

		function item(action, icon, label, extraClass) {
			return `<li><button type="button" class="dropdown-item${extraClass ? ` ${extraClass}` : ''}" data-rpt-act="${action}" data-id="${report.id}"><i class="bi ${icon}" aria-hidden="true"></i>${label}</button></li>`;
		}

		const entries = [
			template ? item('use', 'bi-plus-square', 'Use this template') : item('edit', 'bi-sliders', 'Edit'),
			item('duplicate', 'bi-copy', 'Duplicate'),
			template ? '' : item('schedule', 'bi-envelope-paper', report.schedule ? 'Change schedule' : 'Schedule'),
			template ? '' : item('share', 'bi-people', 'Share'),
			item('export', 'bi-download', 'Export CSV'),
			report.owner === SAMPLE.viewer
				? `<li><hr class="dropdown-divider"></li>${item('delete', 'bi-trash3', 'Delete', 'text-danger')}`
				: '',
		];
		return `<ul class="dropdown-menu dropdown-menu-end">${entries.join('')}</ul>`;
	}

	function moreButton(report) {
		return `<div class="dropdown"><button type="button" class="rpt-icon-btn" data-bs-toggle="dropdown" aria-expanded="false" aria-label="More actions for ${htmlSafe(report.name)}"><i class="bi bi-three-dots" aria-hidden="true"></i></button>${actionMenu(report)}</div>`;
	}

	/** Quick view and Open full page side by side; a table row adds the menu. */
	function quickActions(report, withMenu) {
		const name = htmlSafe(report.name);
		return (
			`<span class="basalt-row-actions">` +
			`<button type="button" class="btn btn-icon btn-sm" data-rpt-act="open" data-id="${report.id}" aria-label="Quick view: ${name}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>` +
			`<a class="btn btn-icon btn-sm" href="${fullPageUrl(report)}" aria-label="Open full page: ${name}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>` +
			`${withMenu ? moreButton(report) : ''}</span>`
		);
	}

	function starButton(report) {
		return `<button type="button" class="rpt-icon-btn rpt-star${report.starred ? ' is-on' : ''}" data-rpt-act="star" data-id="${report.id}" aria-pressed="${report.starred}" aria-label="Star ${htmlSafe(report.name)}"><i class="bi ${report.starred ? 'bi-star-fill' : 'bi-star'}" aria-hidden="true"></i></button>`;
	}

	function drawingBadge(report) {
		const drawing = SAMPLE.drawings[report.kind];
		return `<span class="rpt-kind"><i class="bi ${drawing.icon}" aria-hidden="true"></i>${htmlSafe(drawing.label)}</span>`;
	}

	function reportCard(report) {
		const scheduled = !!report.schedule;
		const footnote = scheduled ? htmlSafe(cadenceText(report.schedule)) : `Updated ${sinceText(report.updated)}`;
		return `<article class="card basalt-box rpt-card" data-rpt-card="${report.id}">
      <div class="rpt-card-top">${drawingBadge(report)}<div class="rpt-card-tools">${starButton(report)}${moreButton(report)}</div></div>
      <h3 class="rpt-card-title"><a class="rpt-card-open" href="${fullPageUrl(report)}">${htmlSafe(report.name)}</a></h3>
      <p class="rpt-card-desc">${htmlSafe(report.summary)}</p>
      <div class="rpt-card-chart" data-rpt-chart="${report.id}"></div>
      <div class="rpt-card-meta">
        ${avatarHtml(report.owner)}
        <span class="rpt-card-owner">${ownerName(report)}</span>
        ${quickActions(report)}
        <span class="rpt-sched${scheduled ? ' is-on' : ''}"><i class="bi ${scheduled ? 'bi-envelope-check' : 'bi-clock-history'}" aria-hidden="true"></i>${footnote}</span>
      </div>
    </article>`;
	}

	function reportTable(reports) {
		const shelfName = SHELVES.find((shelf) => shelf.id === ui.shelf).label.toLowerCase();
		const headings = [
			'<th scope="col" class="rpt-table-star"><span class="visually-hidden">Starred</span></th>',
			'<th scope="col">Report</th>',
			'<th scope="col">Chart</th>',
			'<th scope="col">Owner</th>',
			'<th scope="col">Schedule</th>',
			'<th scope="col">Updated</th>',
			'<th scope="col" class="text-end">Opens</th>',
			'<th scope="col"><span class="visually-hidden">Actions</span></th>',
		];

		function row(report) {
			const schedule = report.schedule
				? `<span class="rpt-sched is-on"><i class="bi bi-envelope-check" aria-hidden="true"></i>${htmlSafe(cadenceText(report.schedule))}</span>`
				: '<span class="rpt-quiet">Not scheduled</span>';
			return (
				`<tr data-rpt-card="${report.id}">` +
				`<td class="rpt-table-star">${starButton(report)}</td>` +
				`<td class="rpt-table-name"><a class="rpt-link" href="${fullPageUrl(report)}">${htmlSafe(report.name)}</a><span class="rpt-sub">${htmlSafe(report.summary)}</span></td>` +
				`<td>${drawingBadge(report)}</td>` +
				`<td><span class="rpt-owner">${avatarHtml(report.owner)}${ownerName(report)}</span></td>` +
				`<td>${schedule}</td>` +
				`<td class="rpt-quiet">${sinceText(report.updated)}</td>` +
				`<td class="text-end rpt-num">${report.opens}</td>` +
				`<td class="text-end">${quickActions(report, true)}</td>` +
				'</tr>'
			);
		}

		return (
			`<div class="card basalt-box rpt-list"><div class="table-responsive rpt-scroll" role="region" tabindex="0" aria-label="Reports">` +
			`<table class="table table-hover align-middle rpt-table"><caption class="visually-hidden">Reports, ${htmlSafe(shelfName)}</caption>` +
			`<thead><tr>${headings.join('')}</tr></thead><tbody>${reports.map(row).join('')}</tbody></table></div></div>`
		);
	}

	/* Scheduled sends are counted for the hero and listed in the schedule dialog. */

	/** The next sends of a schedule after a moment; daily sends skip weekends. */
	function upcomingSends(plan, after, limit) {
		const found = [];
		if (!plan) return found;
		const [hours, minutes] = plan.time.split(':').map(Number);
		const day = new Date(after);
		day.setHours(hours, minutes, 0, 0);
		const sendsOn = {
			daily: () => day.getDay() !== 0 && day.getDay() !== 6,
			weekly: () => day.getDay() === plan.day,
		};
		for (let tries = 0; tries < 400 && found.length < limit; tries += 1) {
			const due = sendsOn[plan.cadence] ? sendsOn[plan.cadence]() : day.getDate() === plan.day;
			if (due && day > after) found.push(new Date(day));
			day.setDate(day.getDate() + 1);
		}
		return found;
	}

	function sendTime(moment) {
		const date = moment.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
		const clock = moment.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
		return `${date}, ${clock}`;
	}

	function sendsThisWeek() {
		const weekOut = new Date(CLOCK.getTime() + 7 * 864e5);
		return catalog.flatMap((report) =>
			upcomingSends(report.schedule, CLOCK, 8).filter((moment) => moment <= weekOut),
		);
	}

	function paintHeroFigures() {
		pick('[data-rpt-fig="saved"]').textContent = catalog.filter((report) => report.owner !== 'tpl').length;
		pick('[data-rpt-fig="scheduled"]').textContent = catalog.filter((report) => report.schedule).length;
		pick('[data-rpt-fig="week"]').textContent = sendsThisWeek().length;
	}

	/* Card, row and menu actions all arrive through one click listener on the page. */

	function reportById(id) {
		return catalog.find((report) => report.id === id);
	}

	function handlePageClick(event) {
		if (event.target.closest('[data-rpt-new]')) {
			showBuilder(null);
			return;
		}
		if (event.target.closest('[data-rpt-open-templates]')) {
			bootstrap.Dropdown.getOrCreateInstance(pick('[data-rpt-template-toggle]')).show();
			return;
		}
		const trigger = event.target.closest('[data-rpt-act]');
		if (!trigger) {
			followCard(event);
			return;
		}
		const report = reportById(trigger.getAttribute('data-id') || quick.report?.id);
		if (!report) return;
		const actions = {
			open: () => openQuickView(report.id),
			star: () => flipStar(report),
			edit: () => showBuilder(report),
			duplicate: () => copyReport(report, false),
			use: () => copyReport(report, true),
			schedule: () => showSchedule(report),
			share: () => showShare(report),
			export: () => exportOne(report),
			delete: () => deleteReport(report),
		};
		actions[trigger.getAttribute('data-rpt-act')]?.();
	}

	/**
	 * The rest of a card or row behaves like a link to the report's own page:
	 * the middle button or Cmd/Ctrl opens a new tab. A report saved during
	 * this visit has no page yet, so it opens the quick view instead.
	 */
	function followCard(event) {
		const card = event.button < 2 && event.target.closest('[data-rpt-card]');
		if (!card || !results.contains(card) || event.target.closest('a, button, input, .dropdown')) return;
		const report = reportById(card.getAttribute('data-rpt-card'));
		if (madeHere.has(report.id)) {
			if (event.button === 0) openQuickView(report.id);
			return;
		}
		if (event.button === 1 || event.metaKey || event.ctrlKey) window.open(fullPageUrl(report), '_blank');
		else location.href = fullPageUrl(report);
	}

	function flipStar(report) {
		report.starred = !report.starred;
		paintLibrary();
		paintDrawerStar();
		say(`${report.starred ? 'Starred ' : 'Removed the star from '}${report.name}.`);
		pick(`[data-rpt-card="${report.id}"] .rpt-star`, results)?.focus();
		server.star(report.id, report.starred).catch(() => {
			report.starred = !report.starred;
			paintLibrary();
			notify({ tone: 'danger', title: 'Could not save the star' });
		});
	}

	/** Switches the library to the Mine shelf and its tab. */
	function showMine() {
		ui.shelf = 'mine';
		const radio = pick('#rpt-group-mine');
		if (radio) radio.checked = true;
	}

	function newReportFields() {
		serial += 1;
		return {
			id: `r-${serial}`,
			owner: SAMPLE.viewer,
			starred: false,
			opens: 0,
			schedule: null,
			updated: SAMPLE.today.slice(0, 10),
			share: { people: [], access: 'view', link: false },
		};
	}

	function copyReport(report, fromTemplate) {
		const copy = Object.assign(copyOf(report), newReportFields(), {
			name: fromTemplate ? report.name : `${report.name} (copy)`,
		});
		catalog.unshift(copy);
		madeHere.add(copy.id);
		server
			.save(copy)
			.then(() => {
				showMine();
				ui.order = 'recent';
				pick('[data-rpt-sort]').value = 'recent';
				ui.page = 1;
				paintLibrary();
				paintHeroFigures();
				notify({
					tone: 'success',
					title: fromTemplate ? 'Added to your reports' : 'Report duplicated',
					text: `${copy.name} is in Mine.`,
					actions: [{ label: 'Open', onClick: () => openQuickView(copy.id) }],
				});
			})
			.catch(() => {
				catalog.splice(catalog.indexOf(copy), 1);
				paintLibrary();
				notify({ tone: 'danger', title: 'Could not duplicate the report' });
			});
	}

	/** Removes the report at once; the request only goes out when the toast closes without Undo. */
	function deleteReport(report) {
		const position = catalog.indexOf(report);
		let restored = false;

		function putBack() {
			catalog.splice(position, 0, report);
		}

		catalog.splice(position, 1);
		if (quick.report?.id === report.id) bootstrap.Offcanvas.getOrCreateInstance(drawerNode).hide();
		paintLibrary();
		paintHeroFigures();
		notify({
			tone: 'info',
			icon: 'bi-trash3',
			title: 'Report deleted',
			text: report.name,
			duration: 7000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						restored = true;
						putBack();
						paintLibrary();
						paintHeroFigures();
						say(`${report.name} restored.`);
					},
				},
			],
			onClose: () => {
				if (restored) return;
				server.discard(report.id).catch(() => {
					putBack();
					paintLibrary();
					notify({ tone: 'danger', title: `Could not delete ${report.name}` });
				});
			},
		});
		searchBox.focus();
	}

	function saveCsv(lines, filename) {
		function field(value) {
			const text = String(value ?? '');
			return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
		}

		const csv = lines.map((line) => line.map(field).join(',')).join('\r\n');
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		setTimeout(() => {
			URL.revokeObjectURL(link.href);
			link.remove();
		}, 0);
	}

	function fileSlug(text) {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function exportOne(report) {
		if (!ui.ready) {
			notify({ tone: 'warning', title: 'Figures still loading', text: 'Try again in a moment.' });
			return;
		}
		const fig = figuresFor(report, ui.strands);
		server.exportCsv(
			numbersFor(fig, null).csv,
			`${fileSlug(report.name)}-${monthKey(fig.from)}-to-${monthKey(fig.to)}.csv`,
		);
		notify({ tone: 'success', title: 'Export ready', text: `${fileSlug(report.name)}.csv is in your downloads.` });
	}

	/* The quick-view drawer shows one report with its stats and numbers, and
     any month or row can be drilled into by plan, region and segment. */

	function drawerPart(name) {
		return pick(`[data-rpt-d="${name}"]`, drawerNode);
	}

	function wireDrawer() {
		drawerNode.addEventListener('hidden.bs.offcanvas', () => {
			drawerPart('chart').textContent = '';
			pruneCharts();
			quick.report = null;
		});
		drawerNode.addEventListener('click', (event) => {
			const drillButton = event.target.closest('[data-rpt-drill]');
			if (drillButton) {
				drillInto(Number(drillButton.getAttribute('data-rpt-drill')));
				return;
			}
			if (event.target.closest('[data-rpt-drill-back]')) {
				const left = quick.drillIndex;
				quick.drillIndex = null;
				paintNumbers();
				pick(`[data-rpt-drill="${left}"]`, drawerNode)?.focus();
				return;
			}
			if (event.target.closest('[data-rpt-drill-export]') && quick.csvRows) {
				const drilled =
					quick.drillIndex != null ? `-${fileSlug(drawerPart('drill-title').textContent.trim())}` : '';
				const filename = `${fileSlug(quick.report.name)}${drilled}.csv`;
				server.exportCsv(quick.csvRows, filename);
				notify({ tone: 'success', title: 'Export ready', text: `${filename} is in your downloads.` });
			}
		});
	}

	function paintDrawerStar() {
		if (!quick.report) return;
		const starred = !!quick.report.starred;
		const toggle = pick('[data-rpt-act="star"]', drawerNode);
		toggle.setAttribute('aria-pressed', String(starred));
		pick('i', toggle).className = `bi ${starred ? 'bi-star-fill' : 'bi-star'}`;
		pick('span', toggle).textContent = starred ? 'Starred' : 'Star';
	}

	/**
	 * Fills the drawer for one report and slides it in.
	 * @param {string} id
	 * @param {boolean} [keepDrill] keep the drilled row when it is the same report
	 */
	function openQuickView(id, keepDrill) {
		const report = reportById(id);
		if (!report) return;
		const same = quick.report?.id === id;
		const template = report.owner === 'tpl';
		const drawerShown = drawerNode.classList.contains('show');
		quick.report = report;
		if (!keepDrill || !same) quick.drillIndex = null;

		const drawing = SAMPLE.drawings[report.kind];
		drawerPart('kind').innerHTML =
			`<i class="bi ${drawing.icon}" aria-hidden="true"></i>${htmlSafe(drawing.label)}`;
		drawerPart('title').textContent = report.name;
		drawerPart('full').href = fullPageUrl(report);
		const sending = report.schedule
			? `Sent ${cadenceText(report.schedule).replace(/^(\w)/, (first) => first.toLowerCase())}`
			: 'Not scheduled';
		drawerPart('sub').textContent = `${template ? 'Template' : personById(report.owner).name} · ${sending}`;

		/* Edit, schedule and share live on the report's own page, opened at that section. */
		const sections = { edit: 'setup', schedule: 'schedule', share: 'share' };
		for (const [part, section] of Object.entries(sections)) {
			drawerPart(part).hidden = template;
			drawerPart(part).href = `${fullPageUrl(report)}&edit=${section}`;
		}
		const copyButton = pick('[data-rpt-dup]', drawerNode);
		copyButton.innerHTML = template
			? '<i class="bi bi-plus-square me-1" aria-hidden="true"></i>Use template'
			: '<i class="bi bi-copy me-1" aria-hidden="true"></i>Duplicate';
		copyButton.setAttribute('data-rpt-act', template ? 'use' : 'duplicate');
		paintDrawerStar();

		const box = drawerPart('chart');
		box.className = `rpt-drawer-chart rpt-drawer-chart-${report.kind}`;
		if (ui.ready) fillQuickView(report, box, same, drawerShown);
		else {
			box.innerHTML =
				'<span class="basalt-skeleton basalt-skeleton-block rpt-chart-ghost rpt-chart-ghost-lg" aria-hidden="true"></span>';
			drawerPart('lead').textContent = ui.failure
				? 'The figures did not load. Close this and try again.'
				: 'Loading the figures…';
			for (const part of ['stats', 'key', 'table']) drawerPart(part).innerHTML = '';
		}
		if (!drawerShown) bootstrap.Offcanvas.getOrCreateInstance(drawerNode).show();
	}

	function fillQuickView(report, box, same, drawerShown) {
		const fig = figuresFor(report, ui.strands);
		const drillable = canDrill(fig);
		quick.figures = fig;
		drawerPart('lead').textContent = `${report.summary} ${sentenceFor(fig)}`;
		drawerPart('stats').innerHTML = statsList(fig);
		drawerPart('key').innerHTML = legendFor(fig);
		drawerPart('hint').textContent = drillable
			? `Pick a ${overTime(fig) ? 'month' : 'row'} in the chart or the table to see it by plan, region and segment.`
			: '';

		function show() {
			placeChart(box, fig, {
				compact: false,
				animate: !same,
				onSelect: drillable ? (index) => drillInto(index) : null,
			});
		}

		if (drawerShown) show();
		else drawerNode.addEventListener('shown.bs.offcanvas', show, { once: true });
		paintNumbers();
	}

	function overTime(fig) {
		return ['line', 'stacked', 'columns', 'share'].includes(fig.report.kind);
	}

	function canDrill(fig) {
		return !fig.empty && (overTime(fig) || ['ring', 'bars', 'bullet'].includes(fig.report.kind));
	}

	/** The headline stats over the chart, as dt/dd pairs. */
	function statsList(fig) {
		if (fig.empty) return '';
		const info = SAMPLE.measures[fig.measure];
		const kind = fig.report.kind;

		function stat(label, value, state) {
			return `<div><dt>${htmlSafe(label)}</dt><dd${state ? ` class="${state}"` : ''}>${value}</dd></div>`;
		}

		const lines = [];
		if (kind === 'pareto') {
			lines.push(
				stat('Accounts canceled', whole(fig.headline)),
				stat('Top reason', htmlSafe(fig.reasons[0].label)),
			);
			if (fig.baseline != null && fig.against) lines.push(stat(fig.against.title, whole(fig.baseline)));
			return lines.join('');
		}
		if (kind === 'bullet') {
			lines.push(stat('New MRR', dollars(fig.headline)), stat('Plan', dollars(fig.baseline)));
			lines.push(
				stat(
					'Against plan',
					percent((fig.headline / (fig.baseline || 1)) * 100),
					fig.headline >= fig.baseline ? 'is-up' : 'is-down',
				),
			);
			return lines.join('');
		}
		if (!['line', 'stacked', 'columns', 'share', 'ring', 'bars'].includes(kind)) return '';
		lines.push(
			stat(
				info.reads === 'level' ? `${info.label}, ${shortMonth(fig.to)}` : `${info.label}, total`,
				formatFor(fig.measure, fig.headline),
			),
		);
		if (fig.baseline != null && fig.against) {
			const change = fig.baseline ? ((fig.headline - fig.baseline) / Math.abs(fig.baseline)) * 100 : 0;
			/* Fewer cancellations is the good direction. */
			const better = fig.measure === 'churn' ? change <= 0 : change >= 0;
			lines.push(stat(fig.against.title, formatFor(fig.measure, fig.baseline)));
			lines.push(
				stat(
					'Change',
					`<i class="bi ${change >= 0 ? 'bi-arrow-up-right' : 'bi-arrow-down-right'}" aria-hidden="true"></i>${change >= 0 ? '+' : '−'}${percent(Math.abs(change), 1)}`,
					better ? 'is-up' : 'is-down',
				),
			);
		}
		if (overTime(fig) && info.reads === 'flow')
			lines.push(stat('Monthly average', formatFor(fig.measure, fig.headline / fig.totals.length)));
		return lines.join('');
	}

	/**
	 * The table under the chart and its CSV: the top level, or every strand
	 * behind one drilled month or row.
	 * @returns {{title: string, header: string[], numeric?: boolean[], csv: Array[], cells: Array[], footer?: string[]|null, linkColumn?: number|null}}
	 */
	function numbersFor(fig, drillIndex) {
		if (drillIndex != null) return drilledNumbers(fig, drillIndex);
		if (overTime(fig)) return monthlyNumbers(fig);
		const info = SAMPLE.measures[fig.measure];
		const kind = fig.report.kind;

		function shareOf(value) {
			return (value / (fig.headline || 1)) * 100;
		}

		if (kind === 'ring' || kind === 'bars') {
			const splitName = SAMPLE.splits[fig.report.breakdown];
			const header = [splitName, info.label, 'Share'];
			const unlinked = fig.report.breakdown === 'billing' || fig.report.breakdown === 'addon';
			return {
				title: `By ${splitName.toLowerCase()}`,
				header,
				numeric: [false, true, true],
				csv: [
					header,
					...fig.slices.map((slice) => [
						slice.label,
						Math.round(slice.value),
						`${shareOf(slice.value).toFixed(1)}%`,
					]),
				],
				linkColumn: unlinked ? null : 0,
				cells: fig.slices.map((slice) => [
					slice.label,
					formatFor(fig.measure, slice.value, true),
					percent(shareOf(slice.value), 1),
				]),
				footer: ['Total', formatFor(fig.measure, fig.headline, true), '100%'],
			};
		}
		if (kind === 'pareto') {
			const header = ['Reason', 'Accounts', 'Share', 'Running share'];
			let carried = 0;
			const rows = fig.reasons.map((reason) => {
				const share = shareOf(reason.value);
				carried += share;
				return [reason.label, reason.value, `${share.toFixed(1)}%`, `${Math.min(100, carried).toFixed(1)}%`];
			});
			return {
				title: 'By reason',
				header,
				numeric: [false, true, true, true],
				csv: [header, ...rows],
				cells: rows.map(([label, accounts, share, runningShare]) => [
					label,
					whole(accounts),
					share,
					runningShare,
				]),
				footer: ['Total', whole(fig.headline), '100%', ''],
			};
		}
		if (kind === 'bullet') {
			const header = ['Region', 'New MRR', 'Plan', 'Against plan'];
			const rows = fig.regions.map((region) => [
				region.label,
				region.value,
				region.target,
				`${((region.value / (region.target || 1)) * 100).toFixed(0)}%`,
			]);
			return {
				title: 'By region',
				header,
				numeric: [false, true, true, true],
				csv: [header, ...rows],
				linkColumn: 0,
				cells: rows.map(([label, actual, target, against]) => [
					label,
					dollars(actual, true),
					dollars(target, true),
					against,
				]),
				footer: [
					'Total',
					dollars(fig.headline, true),
					dollars(fig.baseline, true),
					percent((fig.headline / (fig.baseline || 1)) * 100),
				],
			};
		}
		return { title: '', header: [], csv: [[]], cells: [] };
	}

	function monthlyNumbers(fig) {
		const info = SAMPLE.measures[fig.measure];
		const sliced = fig.slices.length > 1;
		const withPrevious = fig.previous && fig.report.kind !== 'share';
		const header = [
			'Month',
			...(sliced ? fig.slices.map((slice) => slice.label) : []),
			info.label + (sliced ? ', total' : ''),
			...(withPrevious ? [fig.against.title] : []),
		];
		const rows = fig.months.map((month, at) => [
			monthYear(month),
			...(sliced ? fig.slices.map((slice) => Math.round(slice.data[at])) : []),
			Math.round(fig.totals[at]),
			...(withPrevious ? [Math.round(fig.previous[at])] : []),
		]);

		function exact(value) {
			return formatFor(fig.measure, value, true);
		}

		const footer =
			info.reads === 'flow'
				? [
						'Total',
						...(sliced ? fig.slices.map((slice) => exact(addUp(slice.data))) : []),
						exact(addUp(fig.totals)),
						...(withPrevious ? [exact(addUp(fig.previous))] : []),
					]
				: null;
		return {
			title: 'By month',
			header,
			numeric: header.map((heading, at) => at > 0),
			csv: [header, ...rows],
			linkColumn: 0,
			cells: rows.map((row) => row.map((value, at) => (at === 0 ? value : exact(value)))),
			footer,
		};
	}

	function drilledNumbers(fig, drillIndex) {
		const target = drillTarget(fig, drillIndex);
		const rows = ui.strands
			.map((strand) => ({ strand, amount: target.value(strand) }))
			.filter((entry) => Math.round(entry.amount) !== 0)
			.sort((a, b) => b.amount - a.amount);
		const overall = addUp(rows.map((entry) => entry.amount));

		function shareOf(amount) {
			return overall ? (amount / overall) * 100 : 0;
		}

		const header = ['Plan', 'Region', 'Segment', target.label, 'Share'];

		function names({ strand }) {
			return [strand.planInfo.name, strand.regionInfo.name, strand.segmentInfo.name];
		}

		return {
			title: target.title,
			header,
			numeric: [false, false, false, true, true],
			csv: [
				header,
				...rows.map((entry) => [
					...names(entry),
					Math.round(entry.amount),
					`${shareOf(entry.amount).toFixed(1)}%`,
				]),
			],
			cells: rows.map((entry) => [
				...names(entry),
				target.format(entry.amount),
				percent(shareOf(entry.amount), 1),
			]),
			footer: ['Total', '', '', target.format(overall), '100%'],
		};
	}

	/** What one drilled month or row stands for: a title, a column label and a value per strand. */
	function drillTarget(fig, index) {
		const measure = fig.measure;
		const kind = fig.report.kind;

		function exact(value) {
			return formatFor(measure, value, true);
		}

		function sliceReading(strand, slice) {
			if (SAMPLE.measures[measure].reads === 'level') return measureAt(strand, fig.to, measure, slice.part);
			return addUp(fig.months.map((month) => measureAt(strand, month, measure, slice.part)));
		}

		function gainedOver(strand) {
			return addUp(fig.months.map((month) => strand.ledger[month].gained));
		}

		if (overTime(fig)) {
			const month = fig.months[index];
			return {
				title: fullMonth(month),
				label: SAMPLE.measures[measure].label,
				value: (strand) => measureAt(strand, month, measure),
				format: exact,
			};
		}
		if (kind === 'ring' || kind === 'bars') {
			const slice = fig.slices[index];
			const keep = slice.keep || (() => true);
			return {
				title: slice.label,
				label: SAMPLE.measures[measure].label,
				value: (strand) => (keep(strand) ? sliceReading(strand, slice) : 0),
				format: exact,
			};
		}
		if (kind === 'bullet') {
			const region = fig.regions[index];
			return {
				title: `${region.label}, new MRR`,
				label: 'New MRR',
				value: (strand) => (strand.region === region.id ? gainedOver(strand) : 0),
				format: (value) => dollars(value, true),
			};
		}
		return { title: '', label: '', value: () => 0, format: String };
	}

	function paintNumbers() {
		const fig = quick.figures;
		if (!fig) return;
		const drilled = quick.drillIndex != null;
		const table = numbersFor(fig, quick.drillIndex);
		quick.csvRows = table.csv;
		drawerPart('drill-title').textContent = drilled ? table.title : 'The numbers';
		let crumb = `${table.title}, ${spanText(fig.from, fig.to)}.`;
		if (drilled) crumb = `Split by plan, region and segment. ${table.cells.length} rows.`;
		else if (fig.empty) crumb = 'Nothing to show for these filters.';
		drawerPart('crumb').textContent = crumb;
		pick('[data-rpt-drill-back]', drawerNode).hidden = !drilled;
		if (fig.empty) {
			drawerPart('table').innerHTML = '';
			return;
		}
		const linked = !drilled && canDrill(fig) && table.linkColumn === 0;

		function numberCell(value, at) {
			return `<td${table.numeric?.[at] ? ' class="text-end rpt-num"' : ''}>${htmlSafe(value)}</td>`;
		}

		function firstCell(value, row) {
			const label = htmlSafe(value);
			return `<th scope="row">${linked ? `<button type="button" class="rpt-link" data-rpt-drill="${row}" aria-label="Drill into ${label}">${label}</button>` : label}</th>`;
		}

		const head = table.header
			.map(
				(heading, at) =>
					`<th scope="col"${table.numeric?.[at] ? ' class="text-end"' : ''}>${htmlSafe(heading)}</th>`,
			)
			.join('');
		const body = table.cells
			.map(
				(cells, row) =>
					`<tr>${cells.map((value, at) => (at === 0 ? firstCell(value, row) : numberCell(value, at))).join('')}</tr>`,
			)
			.join('');
		const foot = table.footer
			? `<tfoot><tr>${table.footer.map((value, at) => (at === 0 ? `<th scope="row">${htmlSafe(value)}</th>` : numberCell(value, at))).join('')}</tr></tfoot>`
			: '';
		drawerPart('table').innerHTML =
			`<table class="table align-middle rpt-table rpt-table-data"><caption class="visually-hidden">${htmlSafe(fig.report.name)}: ${htmlSafe(table.title)}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table>`;
	}

	function drillInto(index) {
		quick.drillIndex = index;
		paintNumbers();
		say(`Showing ${drawerPart('drill-title').textContent} by plan, region and segment.`);
		pick('[data-rpt-drill-back]', drawerNode).focus({ preventScroll: true });
		drawerPart('table').scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
	}

	/* The builder makes or edits a report from a number, a split, a drawing
     and a range, with a live preview beside the form. */

	function builderPart(name) {
		return pick(`[data-rpt-b="${name}"]`, builderModal);
	}

	function wireBuilder() {
		builderPart('metric').innerHTML = Object.entries(SAMPLE.measures)
			.map(
				([id, info]) =>
					`<option value="${id}" data-hint="${htmlSafe(info.long)}">${htmlSafe(info.label)}</option>`,
			)
			.join('');
		builderPart('breakdown').innerHTML = Object.entries(SAMPLE.splits)
			.map(([id, label]) => `<option value="${id}">${htmlSafe(label)}</option>`)
			.join('');
		builderPart('charts').innerHTML = BUILDABLE.map(
			(kind) =>
				`<label class="basalt-choice rpt-tile"><input type="radio" name="rptBKind" value="${kind}"${kind === 'line' ? ' checked' : ''}><span class="rpt-tile-icon" aria-hidden="true"><i class="bi ${SAMPLE.drawings[kind].icon}"></i></span><span class="rpt-tile-label">${htmlSafe(SAMPLE.drawings[kind].label)}</span></label>`,
		).join('');

		builderModal.addEventListener('shown.bs.modal', () => {
			settleBuilder();
			builderPart('name').focus();
		});
		builderModal.addEventListener('hidden.bs.modal', () => {
			builderPart('chart').textContent = '';
			pruneCharts();
		});
		builderPart('metric').addEventListener('change', settleBuilder);
		builderPart('breakdown').addEventListener('change', settleBuilder);
		builderPart('range').addEventListener('change', paintPreview);
		builderPart('charts').addEventListener('change', () => {
			builderPart('note').textContent = '';
			paintPreview();
		});
		builderPart('name').addEventListener('input', () => {
			builderPart('name').classList.remove('is-invalid');
			clearTimeout(titleTimer);
			titleTimer = setTimeout(() => {
				builderPart('ptitle').textContent = builderPart('name').value.trim() || 'Untitled report';
			}, 120);
		});
		builderForm.addEventListener('submit', saveBuilder);
	}

	function fitsSplit(kind, split) {
		if (['ring', 'bars', 'share'].includes(kind)) return split !== 'none';
		return kind === 'columns' ? split === 'none' : true;
	}

	function readBuilder() {
		const kindInput = pick('input[name="rptBKind"]:checked', builderModal);
		return {
			name: builderPart('name').value.trim(),
			metric: builderPart('metric').value,
			breakdown: builderPart('breakdown').value,
			kind: kindInput ? kindInput.value : 'line',
			range: builderPart('range').value,
		};
	}

	/** Narrows the splits to the chosen number, the drawings to the split, and says when one was swapped. */
	function settleBuilder() {
		const allowed = SPLITS_BY_MEASURE[builderPart('metric').value];
		const splitSelect = builderPart('breakdown');
		for (const option of splitSelect.options) option.disabled = !allowed.includes(option.value);
		if (!allowed.includes(splitSelect.value)) splitSelect.value = 'none';
		window.Basalt.select?.refresh?.(splitSelect);
		const split = splitSelect.value;

		for (const input of pickAll('input[name="rptBKind"]', builderModal)) {
			const fits = fitsSplit(input.value, split);
			input.disabled = !fits;
			input.closest('.basalt-choice').classList.toggle('is-disabled', !fits);
		}

		let note = split === 'none' ? 'Ring, ranked bars and share over time need a split.' : '';
		const picked = pick('input[name="rptBKind"]:checked', builderModal);
		if (picked?.disabled) {
			pick(`input[name="rptBKind"][value="${split === 'none' ? 'line' : 'stacked'}"]`, builderModal).checked =
				true;
			note =
				SAMPLE.drawings[picked.value].label +
				(split === 'none'
					? ' needs a split, so this shows as a trend line.'
					: ' is for a single number, so this shows as stacked columns.');
		}
		builderPart('note').textContent = note;
		paintPreview();
	}

	function paintPreview() {
		const draft = readBuilder();
		const report = {
			id: 'preview',
			name: draft.name || 'Untitled report',
			summary: '',
			kind: draft.kind,
			metric: draft.metric,
			breakdown: draft.breakdown,
			range: draft.range,
			owner: SAMPLE.viewer,
		};
		const box = builderPart('chart');
		builderPart('ptitle').textContent = report.name;
		if (!ui.ready) {
			box.innerHTML =
				'<span class="basalt-skeleton basalt-skeleton-block rpt-chart-ghost rpt-chart-ghost-lg" aria-hidden="true"></span>';
			builderPart('pdesc').textContent = 'Waiting for the figures to load.';
			return;
		}
		const fig = figuresFor(report, ui.strands);
		builderPart('pdesc').textContent = sentenceFor(fig);
		builderPart('key').innerHTML = legendFor(fig);
		placeChart(box, fig, { compact: false, animate: false });
		pruneCharts();
	}

	/** Opens the builder empty, on a report to edit, or on a template to start from. */
	function showBuilder(report) {
		editingReport = report && report.owner !== 'tpl' ? report : null;
		const buildable = BUILDABLE.includes(report?.kind ?? 'stacked');
		const draft = report || { name: '', metric: 'mrr', breakdown: 'plan', kind: 'stacked', range: 'page' };
		const kind = buildable ? draft.kind : 'stacked';
		builderPart('title').textContent = editingReport ? 'Edit report' : 'New report';
		builderPart('save').textContent = editingReport ? 'Save changes' : 'Save to my reports';
		builderPart('name').value = draft.name;
		builderPart('name').classList.remove('is-invalid');
		builderPart('metric').value = buildable ? draft.metric : 'mrr';
		builderPart('breakdown').value = buildable ? draft.breakdown : 'plan';
		builderPart('range').value = String(draft.range || 'page');
		for (const input of pickAll('input[name="rptBKind"]', builderModal)) input.checked = input.value === kind;
		builderPart('note').textContent =
			report && !buildable
				? `${SAMPLE.drawings[report.kind].label} charts come from templates; pick another way to draw it here.`
				: '';
		if (drawerNode.classList.contains('show')) bootstrap.Offcanvas.getOrCreateInstance(drawerNode).hide();
		bootstrap.Modal.getOrCreateInstance(builderModal).show();
	}

	function saveBuilder(event) {
		event.preventDefault();
		const draft = readBuilder();
		const nameInput = builderPart('name');
		if (!draft.name) {
			nameInput.classList.add('is-invalid');
			nameInput.setAttribute('aria-invalid', 'true');
			nameInput.focus();
			return;
		}
		nameInput.removeAttribute('aria-invalid');
		const splitNote =
			draft.breakdown !== 'none' ? `, split by ${SAMPLE.splits[draft.breakdown].toLowerCase()}` : '';
		const summary = `${SAMPLE.measures[draft.metric].long}${splitNote}.`;
		let saved;
		if (editingReport) {
			const edited = editingReport;
			const before = copyOf(edited);
			const keepsSummary =
				edited.summary && edited.metric === draft.metric && edited.breakdown === draft.breakdown;
			Object.assign(edited, draft, {
				summary: keepsSummary ? edited.summary : summary,
				updated: SAMPLE.today.slice(0, 10),
			});
			saved = edited;
			server.save(saved).catch(() => {
				Object.assign(edited, before);
				paintLibrary();
				notify({ tone: 'danger', title: 'Could not save the changes' });
			});
		} else {
			saved = Object.assign({ summary, ...newReportFields() }, draft);
			catalog.unshift(saved);
			madeHere.add(saved.id);
			showMine();
			ui.page = 1;
			server.save(saved).catch(() => {
				catalog.splice(catalog.indexOf(saved), 1);
				paintLibrary();
				notify({ tone: 'danger', title: 'Could not save the report' });
			});
		}
		bootstrap.Modal.getOrCreateInstance(builderModal).hide();
		paintLibrary();
		paintHeroFigures();
		notify({
			tone: 'success',
			title: editingReport ? 'Changes saved' : 'Report saved',
			text: saved.name + (editingReport ? '' : ' is in Mine.'),
			actions: [{ label: 'Open', onClick: () => openQuickView(saved.id) }],
		});
	}

	/* The template picker in the hero is a command menu; picking an entry copies it. */
	function wireTemplates() {
		function entry(report) {
			const drawing = SAMPLE.drawings[report.kind];
			return `<div class="basalt-command-item" role="option" id="rpt-tpl-item-${report.id}" aria-selected="false" data-value="${report.id}" data-keywords="${htmlSafe(`${drawing.label} ${SAMPLE.measures[report.metric].label}`)}"><span class="basalt-command-icon" aria-hidden="true"><i class="bi ${drawing.icon}"></i></span><span class="basalt-command-text"><span class="basalt-command-title">${htmlSafe(report.name)}</span><span class="basalt-command-sub">${htmlSafe(drawing.label)}</span></span></div>`;
		}

		pick('[data-rpt-template-list]').innerHTML =
			`<div class="basalt-command-group" role="group" aria-labelledby="rpt-tpl-head"><div class="basalt-command-heading" id="rpt-tpl-head">Templates</div>${templateReports.map(entry).join('')}</div>` +
			'<div class="basalt-command-group" role="group" aria-labelledby="rpt-tpl-blank"><div class="basalt-command-heading" id="rpt-tpl-blank">Or</div>' +
			'<div class="basalt-command-item" role="option" id="rpt-tpl-item-blank" aria-selected="false" data-value="blank" data-keywords="new empty builder"><span class="basalt-command-icon basalt-command-icon-primary" aria-hidden="true"><i class="bi bi-plus-lg"></i></span><span class="basalt-command-text"><span class="basalt-command-title">Blank report</span><span class="basalt-command-sub">Open the builder</span></span></div></div>';
		pick('[data-rpt-templates]').addEventListener('basalt:command', (event) => {
			const value = event.detail?.value;
			bootstrap.Dropdown.getOrCreateInstance(pick('[data-rpt-template-toggle]')).hide();
			if (value === 'blank') {
				showBuilder(null);
				return;
			}
			const report = reportById(value) || templateReports.find((item) => item.id === value);
			if (report) copyReport(report, true);
		});
	}

	/* The schedule dialog sets how often a report is emailed and to whom. */

	function schedulePart(name) {
		return pick(`[data-rpt-s="${name}"]`, scheduleModal);
	}

	function wireSchedule() {
		schedulePart('hint').textContent = SAMPLE.people
			.filter((who) => who.id !== 'tpl' && who.id !== SAMPLE.viewer)
			.map((who) => who.name.split(' ')[0])
			.join(', ');
		scheduleModal.addEventListener('change', (event) => {
			if (event.target.name === 'rptCadence') fillDays(event.target.value, 1);
			if (event.target.closest('[data-rpt-s="tags"]')) schedulePart('error').hidden = true;
			paintSends();
		});
		cadenceForm.addEventListener('submit', saveSchedule);
		schedulePart('stop').addEventListener('click', stopSchedule);
	}

	function fillDays(cadence, chosen) {
		const select = schedulePart('day');
		schedulePart('day-wrap').hidden = cadence === 'daily';
		const lists = {
			weekly: {
				label: 'Day of the week',
				options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((name, at) => [at + 1, name]),
			},
			monthly: {
				label: 'Day of the month',
				options: [1, 2, 3, 5, 10, 15, 20, 25].map((day) => [day, withSuffix(day)]),
			},
		};
		const list = lists[cadence];
		if (list) {
			schedulePart('day-label').textContent = list.label;
			select.innerHTML = list.options
				.map(
					([value, text]) =>
						`<option value="${value}"${value === chosen ? ' selected' : ''}>${text}</option>`,
				)
				.join('');
		}
		window.Basalt.select?.refresh?.(select);
	}

	function readSchedule() {
		const tags = schedulePart('tags').basaltTags;
		return {
			cadence: pick('input[name="rptCadence"]:checked', scheduleModal)?.value || 'weekly',
			day: Number(schedulePart('day').value) || 1,
			time: schedulePart('time').value,
			to: tags ? tags.get() : [],
			format: pick('input[name="rptFormat"]:checked', scheduleModal)?.value || 'PDF',
		};
	}

	/** The next five sends and the email they would arrive as. */
	function paintSends() {
		const plan = readSchedule();
		schedulePart('next').innerHTML = upcomingSends(plan, CLOCK, 5)
			.map((moment) => `<li>${htmlSafe(sendTime(moment))}</li>`)
			.join('');
		schedulePart('subject').textContent =
			`${schedulingReport ? schedulingReport.name : 'Report'}, ${cadenceText(plan).toLowerCase()}`;
		const attachment =
			plan.format === 'Link'
				? ', with a link to the live report.'
				: `, with the report attached as ${plan.format}.`;
		schedulePart('line').textContent = plan.to.length
			? `To ${plan.to.join(', ')}${attachment}`
			: 'Add people to send to.';
	}

	function showSchedule(report) {
		schedulingReport = report;
		const plan = report.schedule || {
			cadence: 'weekly',
			day: 1,
			time: '08:00',
			to: [personById(SAMPLE.viewer).name],
			format: 'PDF',
		};
		schedulePart('sub').textContent =
			`${report.name}. The email holds the report as it stands on the day it goes out.`;
		for (const input of pickAll('input[name="rptCadence"]', scheduleModal))
			input.checked = input.value === plan.cadence;
		fillDays(plan.cadence, plan.day);
		schedulePart('time').value = plan.time;
		for (const input of pickAll('input[name="rptFormat"]', scheduleModal))
			input.checked = input.value === plan.format;
		schedulePart('tags').basaltTags?.set(plan.to);
		schedulePart('stop').hidden = !report.schedule;
		schedulePart('error').hidden = true;
		if (drawerNode.classList.contains('show')) bootstrap.Offcanvas.getOrCreateInstance(drawerNode).hide();
		paintSends();
		bootstrap.Modal.getOrCreateInstance(scheduleModal).show();
	}

	function refreshAfterSchedule() {
		paintLibrary();
		paintHeroFigures();
	}

	function saveSchedule(event) {
		event.preventDefault();
		const plan = readSchedule();
		if (!plan.to.length) {
			schedulePart('error').hidden = false;
			pick('#rpt-s-to').focus();
			return;
		}
		const report = schedulingReport;
		const before = report.schedule;
		report.schedule = plan;
		bootstrap.Modal.getOrCreateInstance(scheduleModal).hide();
		refreshAfterSchedule();
		const firstSend = upcomingSends(plan, CLOCK, 1)[0];
		notify({
			tone: 'success',
			icon: 'bi-envelope-check',
			title: 'Schedule saved',
			text: `${report.name} goes out ${cadenceText(plan).toLowerCase()}. First send ${firstSend ? sendTime(firstSend) : 'soon'}.`,
		});
		server.schedule(report.id, plan).catch(() => {
			report.schedule = before;
			refreshAfterSchedule();
			notify({ tone: 'danger', title: 'Could not save the schedule' });
		});
	}

	function stopSchedule() {
		const report = schedulingReport;
		const before = report.schedule;
		report.schedule = null;
		bootstrap.Modal.getOrCreateInstance(scheduleModal).hide();
		refreshAfterSchedule();
		notify({
			tone: 'info',
			icon: 'bi-envelope-x',
			title: 'No longer sent',
			text: report.name,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						report.schedule = before;
						refreshAfterSchedule();
						server.schedule(report.id, before);
					},
				},
			],
		});
		server.schedule(report.id, null).catch(() => {
			report.schedule = before;
			refreshAfterSchedule();
		});
	}

	/* The share dialog picks teammates, their access and the workspace link. */

	function sharePart(name) {
		return pick(`[data-rpt-sh="${name}"]`, shareModal);
	}

	function wireShare() {
		sharePart('people').innerHTML = SAMPLE.people
			.filter((who) => who.id !== 'tpl' && who.id !== SAMPLE.viewer)
			.map((who) => `<option value="${who.id}" data-hint="${htmlSafe(who.role)}">${htmlSafe(who.name)}</option>`)
			.join('');
		pick('[data-rpt-share]').addEventListener('submit', saveShare);
	}

	function showShare(report) {
		sharingReport = report;
		const people = sharePart('people');
		sharePart('sub').textContent =
			`${report.name}. People you add see the same figures you do, through their own filters.`;
		for (const option of people.options) option.selected = report.share.people.includes(option.value);
		window.Basalt.select?.refresh?.(people);
		sharePart('access').value = report.share.access;
		sharePart('link').checked = !!report.share.link;
		sharePart('url').value = SAMPLE.shareRoot + report.id;
		if (drawerNode.classList.contains('show')) bootstrap.Offcanvas.getOrCreateInstance(drawerNode).hide();
		bootstrap.Modal.getOrCreateInstance(shareModal).show();
	}

	function saveShare(event) {
		event.preventDefault();
		const report = sharingReport;
		const before = copyOf(report.share);
		report.share = {
			people: [...sharePart('people').selectedOptions].map((option) => option.value),
			access: sharePart('access').value,
			link: sharePart('link').checked,
		};
		bootstrap.Modal.getOrCreateInstance(shareModal).hide();
		const count = report.share.people.length;
		const text = count
			? `${report.name} is shared with ${count}${count === 1 ? ' person' : ' people'}.`
			: `${report.name} is only visible to you${report.share.link ? ' and anyone with the link.' : '.'}`;
		notify({ tone: 'success', icon: 'bi-people', title: 'Sharing saved', text });
		server.share(report.id, report.share).catch(() => {
			report.share = before;
			notify({ tone: 'danger', title: 'Could not save sharing' });
		});
	}

	start();
})();
