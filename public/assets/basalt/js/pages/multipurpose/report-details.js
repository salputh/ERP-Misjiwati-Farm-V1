/**
 * A single saved report, opened on its own page (report-details.html).
 *
 * The page draws the report's chart and the monthly figures behind it
 * for a chosen period, comparison and set of filters, then explains the
 * figure: the revenue bridge that moved it, how it divides by plan or
 * region, who receives it by email, who may open it, how it is set up
 * and a log of what has happened to it. Each of those cards edits in
 * place, and the Reports quick view can open one straight into editing
 * with ?edit=setup, ?edit=schedule or ?edit=share.
 *
 * Wiring in real data takes three steps. Point backend.fetch(id) at the
 * report your server stores for the id in the address
 * (report-details.html?id=r-105); the demo reads SAMPLE.reports, the
 * list the Reports page shows, and falls back to Monday MRR. Replace
 * the generated ledger with the monthly figures your server returns.
 * Then fill in the remaining backend methods, one request each; the
 * page always redraws itself before the request goes out.
 *
 * The ledger is seeded exactly like the one in reports.js, so a report
 * here shows the numbers its card shows there. Charts use Chart.js 4,
 * take their colors from the --basalt-* tokens whenever one is built,
 * and are all built again on basalt:appearance.
 */
(() => {
	'use strict';

	const page = pick('[data-rd-root]', document);
	if (!page || typeof Chart === 'undefined') return;

	/*
	 * The demo company is Fieldline, which sells per-seat scheduling
	 * software for field teams on three paid plans. The months run from
	 * October 2024 through September 2026. Each plan is scaled so that
	 * September 2026 lands on its closing figures, and every month
	 * balances: closing MRR equals the previous close plus new and
	 * expansion revenue, minus downgrades and cancellations.
	 */
	const library = window.Basalt.data.reports;

	const SAMPLE = {
		/* The demo's fixed "today"; a live app would use new Date(). */
		now: '2026-10-09T10:00',
		firstMonth: '2024-10',
		monthCount: 24,
		me: 'ja',
		linkBase: 'https://app.example.com/reports/',

		people: library.people,
		reports: library.reports,
		activity: library.activity,

		plans: [
			{
				id: 'starter',
				name: 'Basic',
				close: { mrr: 158000, accounts: 1190, seats: 11200 },
				rates: { new: 0.02358, expansion: 0.00987, contraction: 0.003, churn: 0.008 },
				logoRatio: 2.44,
				channelShare: { self: 0.93, sales: 0.07 },
				regionShare: { northeast: 0.41, midwest: 0.31, west: 0.17, south: 0.11 },
				arpa: { self: 118, sales: 260 },
				annualShare: { self: 0.21, sales: 0.48 },
				addons: { route: 0.03, portal: 0.02, sms: 0.03 },
				trial: { conv: 0.21 },
				reasons: { price: 34, usage: 26, feature: 14, competitor: 9, closed: 11, other: 6 },
			},
			{
				id: 'growth',
				name: 'Pro',
				close: { mrr: 361000, accounts: 790, seats: 12600 },
				rates: { new: 0.01472, expansion: 0.01476, contraction: 0.0025, churn: 0.0035 },
				logoRatio: 3.19,
				channelShare: { self: 0.56, sales: 0.44 },
				regionShare: { northeast: 0.46, midwest: 0.29, west: 0.15, south: 0.1 },
				arpa: { self: 390, sales: 590 },
				annualShare: { self: 0.37, sales: 0.69 },
				addons: { route: 0.05, portal: 0.03, sms: 0.03 },
				trial: { conv: 0.15 },
				reasons: { price: 21, usage: 18, feature: 27, competitor: 19, closed: 9, other: 6 },
			},
			{
				id: 'enterprise',
				name: 'Max',
				close: { mrr: 361000, accounts: 160, seats: 7600 },
				rates: { new: 0.00969, expansion: 0.01617, contraction: 0.002, churn: 0.0015 },
				logoRatio: 3.1,
				channelShare: { self: 0.2, sales: 0.8 },
				regionShare: { northeast: 0.52, midwest: 0.3, west: 0.13, south: 0.05 },
				arpa: { self: 720, sales: 2900 },
				annualShare: { self: 0.84, sales: 0.93 },
				addons: { route: 0.06, portal: 0.02, sms: 0.02 },
				trial: { conv: 0.08 },
				reasons: { price: 12, usage: 10, feature: 31, competitor: 24, closed: 17, other: 6 },
			},
		],
		/* How many trials turned into paying accounts over the final year. */
		trialToPaid: 0.18,
		regions: [
			{ id: 'northeast', name: 'Northeast', newBoost: 1.0, churnBoost: 0.9 },
			{ id: 'midwest', name: 'Midwest', newBoost: 1.08, churnBoost: 1.0 },
			{ id: 'west', name: 'West', newBoost: 1.32, churnBoost: 1.15 },
			{ id: 'south', name: 'South', newBoost: 1.18, churnBoost: 1.38 },
		],
		/* The "Segment" filter: whether an account signed up alone or through sales. */
		channels: [
			{ id: 'self', name: 'Self-serve', newBoost: 1.1, churnBoost: 1.12, expBoost: 0.8 },
			{ id: 'sales', name: 'Sales-led', newBoost: 0.86, churnBoost: 0.7, expBoost: 1.25 },
		],
		/* A multiplier on new business for each calendar month, starting in January. */
		seasonality: [1.22, 1.08, 1.12, 1.0, 0.98, 0.94, 0.88, 0.8, 1.06, 1.1, 1.02, 0.78],
		addons: [
			{ id: 'route', name: 'Travel Planner' },
			{ id: 'portal', name: 'Customer Portal' },
			{ id: 'sms', name: 'SMS credits' },
		],
		reasons: [
			{ id: 'price', label: 'Too expensive', short: 'Price' },
			{ id: 'feature', label: 'Missing a feature', short: 'Feature' },
			{ id: 'usage', label: 'Not using it enough', short: 'Usage' },
			{ id: 'competitor', label: 'Moved to another tool', short: 'Rival' },
			{ id: 'closed', label: 'Business closed or merged', short: 'Closed' },
			{ id: 'other', label: 'Something else', short: 'Other' },
		],

		/*
		 * A balance is read at the close of the period and a tally is summed
		 * across it. When "falling" is set, a drop is the good direction.
		 */
		metrics: {
			mrr: { label: 'MRR', long: 'Monthly recurring revenue', type: 'stock', unit: 'money' },
			new: { label: 'New MRR', long: 'MRR from new accounts', type: 'flow', unit: 'money' },
			expansion: { label: 'Expansion MRR', long: 'MRR added by existing accounts', type: 'flow', unit: 'money' },
			churn: {
				label: 'Canceled MRR',
				long: 'MRR lost to cancellations',
				type: 'flow',
				unit: 'money',
				falling: true,
			},
			netnew: {
				label: 'Net new MRR',
				long: 'MRR added after cancellations and downgrades',
				type: 'flow',
				unit: 'money',
			},
			accounts: { label: 'Paying accounts', long: 'Accounts on a paid plan', type: 'stock', unit: 'count' },
			seats: { label: 'Paid seats', long: 'Seats on paid plans', type: 'stock', unit: 'count' },
			trials: { label: 'Trials started', long: 'Self-serve trials started', type: 'flow', unit: 'count' },
			/* Counted in accounts rather than revenue, and used by the Pareto chart alone. */
			lost: {
				label: 'Accounts lost',
				long: 'Accounts that canceled',
				type: 'flow',
				unit: 'count',
				falling: true,
			},
		},
		breakdowns: {
			none: 'Nothing',
			plan: 'Plan',
			region: 'Region',
			segment: 'Segment',
			billing: 'Billing',
			addon: 'Add-on',
		},
		/* The splits each number can sensibly be cut by. */
		allowedSplits: {
			mrr: ['none', 'plan', 'region', 'segment', 'billing', 'addon'],
			new: ['none', 'plan', 'region', 'segment', 'billing'],
			expansion: ['none', 'plan', 'region', 'segment'],
			churn: ['none', 'plan', 'region', 'segment'],
			netnew: ['none', 'plan', 'region', 'segment'],
			accounts: ['none', 'plan', 'region', 'segment', 'billing'],
			seats: ['none', 'plan', 'region', 'segment'],
			trials: ['none', 'plan', 'region'],
		},
		chartKinds: {
			line: { label: 'Trend line', icon: 'bi-graph-up' },
			stacked: { label: 'Stacked columns', icon: 'bi-bar-chart-steps' },
			columns: { label: 'Columns', icon: 'bi-bar-chart' },
			ring: { label: 'Ring', icon: 'bi-pie-chart' },
			bars: { label: 'Ranked bars', icon: 'bi-filter-left' },
			share: { label: 'Share over time', icon: 'bi-layers' },
			pareto: { label: 'Pareto', icon: 'bi-sort-down', locked: true },
			bullet: { label: 'Against plan', icon: 'bi-bullseye', locked: true },
		},
		periods: { 3: 'Last 3 months', 6: 'Last 6 months', 12: 'Last 12 months', ytd: 'Year to date' },
		compares: { prev: 'Previous period', yoy: 'Same period last year', none: 'No comparison' },
	};

	/*
	 * One method per request to your server. The demo answers at once;
	 * replace a body with a fetch() call and return the same shape.
	 */
	const backend = {
		/** GET /api/reports/:id */
		fetch(id) {
			return copyOf(SAMPLE.reports.find((entry) => entry.id === id) || SAMPLE.reports[0]);
		},
		/** PUT /api/reports/:id with { name, summary, kind, metric, breakdown, period, compare, filters } */
		save(entry) {
			return Promise.resolve(copyOf(entry));
		},
		/** PUT /api/reports/:id/star with { starred } */
		star(id, starred) {
			return Promise.resolve({ id, starred });
		},
		/** PUT /api/reports/:id/schedule with { cadence, day, time, to, format }, or null to stop sending */
		schedule(id, schedule) {
			return Promise.resolve({ id, schedule });
		},
		/** PUT /api/reports/:id/sharing with { people, access, link } */
		share(id, sharing) {
			return Promise.resolve({ id, share: sharing });
		},
		/** POST /api/reports/:id/duplicate */
		duplicate(id) {
			return Promise.resolve({ id: `${id}-copy` });
		},
		/** DELETE /api/reports/:id */
		remove(id) {
			return Promise.resolve({ id });
		},
	};

	/* The demo's "today", and the calendar the ledger counts months from. */
	const asOf = new Date(SAMPLE.now);
	const [startYear, startMonth] = SAMPLE.firstMonth.split('-').map(Number);
	const lastIndex = SAMPLE.monthCount - 1;

	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const ledger = buildLedger();

	/*
	 * The stored report and the view on screen are kept apart. The
	 * toolbar only touches the view; "Save as default" copies it back.
	 */
	const NO_FILTERS = { plan: 'all', region: 'all', segment: 'all' };
	const report = Object.assign(
		{ period: '12', compare: 'prev', filters: copyOf(NO_FILTERS) },
		backend.fetch(new URLSearchParams(window.location.search).get('id')),
	);
	let onScreen = viewFrom(report);
	let current = null;

	const FOLDED_ROWS = 6;
	let tableExpanded = false;

	/* Which days a schedule sends on; any other cadence counts as monthly. */
	const SEND_DAY = {
		daily: (moment) => moment.getDay() !== 0 && moment.getDay() !== 6,
		weekly: (moment, schedule) => moment.getDay() === schedule.day,
		monthly: (moment, schedule) => moment.getDate() === schedule.day,
	};

	const FEED_PREVIEW = 5;
	let feedExpanded = false;
	const events = (SAMPLE.activity[report.id] || fallbackHistory(report)).slice();

	const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const OVER_TIME = ['line', 'stacked', 'columns', 'share'];
	const CHOOSABLE_KINDS = Object.keys(SAMPLE.chartKinds).filter((kind) => !SAMPLE.chartKinds[kind].locked);
	const FILTER_KEYS = ['plan', 'region', 'segment'];
	const TYPEFACE = "'Schibsted Grotesk', sans-serif";

	/*
	 * Every plan, region, segment, billing period and add-on keeps the
	 * series color it has on the Reports page. Markup refers to the token
	 * so it follows a theme change by itself; canvases read its value.
	 */
	const SERIES_SLOT = {
		starter: 0,
		growth: 1,
		enterprise: 2,
		northeast: 0,
		midwest: 1,
		west: 2,
		south: 3,
		self: 4,
		sales: 0,
		monthly: 5,
		annual: 0,
		seats: 0,
		route: 1,
		portal: 2,
		sms: 3,
	};

	/* One tone per kind of event, so sends and shares are easy to spot. */
	const EVENT_TONE = {
		'bi-envelope-check': 'success',
		'bi-envelope-paper': 'success',
		'bi-envelope-x': 'danger',
		'bi-download': 'series-3',
		'bi-people': 'primary',
		'bi-sliders': 'series-4',
		'bi-plus-lg': 'series-2',
	};

	/* Live charts by canvas, each with the builder that made it. */
	const liveCharts = new Map();

	const controls = {
		period: pickAll('input[name="rdPeriod"]'),
		compare: pick('[data-rd-compare]'),
		plan: pick('[data-rd-filter="plan"]'),
		region: pick('[data-rd-filter="region"]'),
		segment: pick('[data-rd-filter="segment"]'),
	};
	const setupPanel = panel('setup');
	const schedulePanel = panel('schedule');
	const sharePanel = panel('share');

	/** Fills the pickers, binds every control, draws the page and honors ?edit=. */
	function start() {
		fillPickers();
		bindToolbar();
		bindTable();
		bindSetup();
		bindSchedule();
		bindSharing();
		bindFeed();
		wireHeroActions();
		bindPageClicks();
		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() => {
				for (const [canvas, entry] of liveCharts) paint(canvas, entry.build, false);
			});
		});

		fillHero();
		fillSetupCard();
		fillScheduleCard();
		fillSharingCard();
		fillActivity();
		redrawView();
		openFromAddress();
	}

	/* The choices every select offers, written in once at load. */
	function fillPickers() {
		controls.plan.innerHTML = optionsHtml('All plans', SAMPLE.plans);
		controls.region.innerHTML = optionsHtml('All regions', SAMPLE.regions);
		controls.segment.innerHTML = optionsHtml('All segments', SAMPLE.channels);

		const lists = {
			metric: [Object.keys(SAMPLE.allowedSplits), (key) => SAMPLE.metrics[key].label],
			breakdown: [Object.keys(SAMPLE.breakdowns), (key) => SAMPLE.breakdowns[key]],
			kind: [CHOOSABLE_KINDS, (key) => SAMPLE.chartKinds[key].label],
			period: [Object.keys(SAMPLE.periods), (key) => SAMPLE.periods[key]],
			compare: [Object.keys(SAMPLE.compares), (key) => SAMPLE.compares[key]],
		};
		for (const [field, [keys, captionFor]] of Object.entries(lists)) {
			setupField(field).innerHTML = keys
				.map((key) => `<option value="${key}">${htmlSafe(captionFor(key))}</option>`)
				.join('');
		}

		scheduleField('hint').textContent = SAMPLE.people
			.filter((member) => member.id !== SAMPLE.me && member.id !== 'tpl')
			.map((member) => member.name.split(' ')[0])
			.join(', ');

		shareField('people').innerHTML = SAMPLE.people
			.filter((member) => member.id !== report.owner && member.id !== 'tpl')
			.map(
				(member) =>
					`<option value="${member.id}" data-hint="${htmlSafe(member.role)}">${htmlSafe(member.name)}</option>`,
			)
			.join('');
		shareField('url').value = SAMPLE.linkBase + report.id;
	}

	/** Builds everything that depends on the view, in reading order. */
	function redrawView() {
		current = measure(onScreen);
		reflectView();
		fillChartCard();
		fillNumbers();
		fillBridge();
		fillSplit();
	}

	/*
	 * The Reports quick view links Edit, Schedule and Share here with
	 * ?edit=setup, schedule or share. That card opens for editing once
	 * the enhanced selects exist, scrolled clear of the sticky top bar.
	 */
	function openFromAddress() {
		const opener = { setup: openSetup, schedule: openSchedule, share: openSharing }[
			new URLSearchParams(window.location.search).get('edit')
		];
		if (!opener) return;
		document.addEventListener('DOMContentLoaded', () => {
			opener();
			document.activeElement?.blur();
			const card = pick('[data-rd-form]:not([hidden])').closest('[data-rd-section]');
			const topbar = pick('.basalt-topbar', document);
			const offset = topbar ? topbar.offsetHeight : 0;
			window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - offset - 16, behavior: 'auto' });
		});
	}

	/* Lookups, escaping and other small tools the whole page leans on. */

	function pick(selector, scope = page) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = page) {
		return [...scope.querySelectorAll(selector)];
	}

	function copyOf(value) {
		return JSON.parse(JSON.stringify(value));
	}

	const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
	}

	function addUp(values) {
		let running = 0;
		for (const value of values) running += value;
		return running;
	}

	/** Whole numbers from first to last, both included. */
	function steps(first, last) {
		return Array.from({ length: Math.max(0, last - first + 1) }, (_, offset) => first + offset);
	}

	function sayAloud(message) {
		window.Basalt.announce?.(message);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function syncPicker(select) {
		window.Basalt.select?.refresh?.(select);
	}

	function memberById(id) {
		return SAMPLE.people.find((member) => member.id === id) || SAMPLE.people[0];
	}

	function memberNamed(name) {
		return SAMPLE.people.find((member) => member.name === name);
	}

	function avatarHtml(name) {
		const monogram = name
			.split(/\s+/)
			.map((word) => word[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
		const index = SAMPLE.people.findIndex((member) => member.name === name);
		const tone = ((index < 0 ? name.length : index) % 8) + 1;
		return `<span class="basalt-avatar basalt-avatar-sm basalt-avatar-tone-${tone}" aria-hidden="true">${htmlSafe(monogram)}</span>`;
	}

	/** "A", "A and B", "A, B and C". */
	function joinNames(names) {
		if (names.length < 2) return names.join('');
		return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
	}

	/* Month indexes become dates here, and amounts become display text. */

	function monthStart(index) {
		return new Date(startYear, startMonth - 1 + index, 1);
	}

	function monthAndYear(index) {
		return monthStart(index).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
	}

	function monthNameYear(index) {
		return monthStart(index).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
	}

	/** An axis label: the short month, plus the year on the first tick and every January. */
	function axisMonth(index, first) {
		const date = monthStart(index);
		const name = date.toLocaleDateString('en-US', { month: 'short' });
		const showYear = index === first || date.getMonth() === 0;
		return showYear ? `${name} ’${String(date.getFullYear()).slice(2)}` : name;
	}

	function spanLabel(first, last) {
		return first === last ? monthNameYear(first) : `${monthAndYear(first)} to ${monthAndYear(last)}`;
	}

	function dateLabel(iso) {
		const moment = new Date(iso.length > 10 ? iso : `${iso}T12:00`);
		return moment.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function clockLabel(moment) {
		return moment.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
	}

	/** Dollars, shortened to k or M unless exact is set; minus is a true minus sign. */
	function asMoney(amount, exact) {
		const minus = amount < 0 ? '−' : '';
		const size = Math.abs(amount);
		let body;
		if (exact) body = Math.round(size).toLocaleString('en-US');
		else if (size >= 1e6) body = `${(size / 1e6).toFixed(2)}M`;
		else if (size >= 1e4) body = `${Math.round(size / 1e3)}k`;
		else if (size >= 1e3) body = `${(size / 1e3).toFixed(1)}k`;
		else body = String(Math.round(size));
		return `${minus}$${body}`;
	}

	function asCount(amount) {
		return `${amount < 0 ? '−' : ''}${Math.round(Math.abs(amount)).toLocaleString('en-US')}`;
	}

	function display(metric, amount, exact) {
		return SAMPLE.metrics[metric].unit === 'money' ? asMoney(amount, exact) : asCount(amount);
	}

	function withSign(metric, amount) {
		return `${amount > 0 ? '+' : ''}${display(metric, amount)}`;
	}

	function percent(amount, digits) {
		return `${amount.toFixed(digits ?? 1)}%`;
	}

	function tickFormatter(metric) {
		if (SAMPLE.metrics[metric].unit === 'money') return (tick) => asMoney(tick);
		return (tick) => (Math.abs(tick) >= 1000 ? `${(tick / 1000).toFixed(1)}k` : asCount(tick));
	}

	function nth(day) {
		const teen = day === 11 || day === 12 || day === 13;
		const suffix = teen ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th';
		return `${day}${suffix}`;
	}

	/* The generated ledger: one row per plan, region and channel, month by month. */

	/**
	 * A small seeded generator (mulberry32), so every visit draws the
	 * same months.
	 * @param {number} seed
	 * @returns {() => number} values in [0, 1)
	 */
	function randomStream(seed) {
		let state = seed >>> 0;
		return () => {
			state = (state + 0x6d2b79f5) >>> 0;
			let mixed = state;
			mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	/**
	 * Divides a whole number in proportion to weights. The floors are
	 * handed out first, then the leftover units go to the largest
	 * remainders, so the parts always add back up to the whole.
	 */
	function apportion(whole, weights) {
		const weightSum = addUp(weights) || 1;
		const exact = weights.map((weight) => (whole * weight) / weightSum);
		const parts = exact.map(Math.floor);
		const remainders = exact.map((value) => value - Math.floor(value));
		const leftover = whole - addUp(parts);
		const byRemainder = [...exact.keys()].sort((a, b) => remainders[b] - remainders[a]);
		for (const index of byRemainder.slice(0, Math.max(0, leftover))) parts[index] += 1;
		return parts;
	}

	/**
	 * Grows every plan, region and channel month by month, scales each
	 * plan to its closing figures and rounds across slices so totals stay
	 * whole. Generated the same way as on the Reports page.
	 * @returns {Array<{planId, regionId, channelId, plan, months}>}
	 */
	function buildLedger() {
		const random = randomStream(20261002);
		const slices = [];
		for (const plan of SAMPLE.plans) {
			for (const region of SAMPLE.regions) {
				for (const channel of SAMPLE.channels) {
					slices.push({
						planId: plan.id,
						regionId: region.id,
						channelId: channel.id,
						plan,
						months: growSlice(plan, region, channel, random),
					});
				}
			}
		}
		for (const plan of SAMPLE.plans)
			settlePlan(
				slices.filter((slice) => slice.planId === plan.id),
				plan,
			);
		sizeTrials(slices);
		return slices;
	}

	/** The raw months of one plan, region and channel, before any scaling. */
	function growSlice(plan, region, channel, random) {
		const jitter = () => 0.86 + random() * 0.28;
		const addonShare = addUp(Object.values(plan.addons));
		const months = [];
		let mrr = 1000 * plan.regionShare[region.id] * plan.channelShare[channel.id];
		let accounts = mrr / plan.arpa[channel.id];

		for (let index = 0; index < SAMPLE.monthCount; index += 1) {
			const opening = mrr;
			const season = SAMPLE.seasonality[monthStart(index).getMonth()];
			const expectedNew = opening * plan.rates.new * region.newBoost * channel.newBoost;
			const added = expectedNew * season * jitter();
			const grown = opening * plan.rates.expansion * channel.expBoost * jitter();
			const shrunk = opening * plan.rates.contraction * jitter();
			const churnRate = plan.rates.churn * region.churnBoost * channel.churnBoost * jitter();
			const lost = opening * churnRate;
			mrr = opening + added + grown - shrunk - lost;

			const accountsBefore = accounts;
			const accountsWon = added / (plan.arpa[channel.id] * 0.82);
			const accountsLost = accountsBefore * churnRate * plan.logoRatio;
			accounts = accountsBefore + accountsWon - accountsLost;

			months.push({
				opening,
				mrr,
				added,
				grown,
				shrunk,
				lost,
				accounts,
				accountsBefore,
				accountsWon,
				accountsLost,
				/* The plan for the month: the expected new business with no luck either way. */
				target: expectedNew * 1.04 * (0.5 + season / 2),
				seats: mrr * (1 - addonShare),
			});
		}
		return months;
	}

	/** Splits a rounded total for one field of one month back across slices. */
	function roundAcross(slices, index, field) {
		const raw = slices.map((slice) => slice.months[index][field]);
		const parts = apportion(Math.round(addUp(raw)), raw);
		for (const [position, slice] of slices.entries()) slice.months[index][field] = parts[position];
	}

	/**
	 * Scales one plan's slices to its closing figures, rounds them and
	 * rebuilds the flows from the rounded balances so each month still
	 * reconciles.
	 */
	function settlePlan(slices, plan) {
		const closing = (field) => addUp(slices.map((slice) => slice.months[lastIndex][field]));
		const moneyScale = plan.close.mrr / closing('mrr');
		const accountScale = plan.close.accounts / closing('accounts');
		const seatScale = plan.close.seats / closing('seats');

		for (const slice of slices) {
			for (const month of slice.months) {
				for (const field of ['opening', 'mrr', 'added', 'grown', 'shrunk', 'lost', 'target'])
					month[field] *= moneyScale;
				for (const field of ['accounts', 'accountsBefore', 'accountsWon', 'accountsLost'])
					month[field] *= accountScale;
				month.seats *= seatScale;
			}
		}

		const openingMrr = slices.map((slice) => slice.months[0].opening);
		const openingAccounts = slices.map((slice) => slice.months[0].accountsBefore);
		const mrrStart = apportion(Math.round(addUp(openingMrr)), openingMrr);
		const accountStart = apportion(Math.round(addUp(openingAccounts)), openingAccounts);
		for (let index = 0; index < SAMPLE.monthCount; index += 1) {
			for (const field of ['mrr', 'accounts', 'seats']) roundAcross(slices, index, field);
		}

		for (const [position, slice] of slices.entries()) {
			let mrr = mrrStart[position];
			let accounts = accountStart[position];
			for (const month of slice.months) {
				month.opening = mrr;
				month.added = Math.round(month.added);
				month.shrunk = Math.round(month.shrunk);
				month.lost = Math.round(month.lost);
				month.target = Math.round(month.target);
				month.grown = month.mrr - month.opening - month.added + month.shrunk + month.lost;
				month.accountsBefore = accounts;
				month.accountsLost = Math.min(accounts, Math.round(month.accountsLost));
				month.accountsWon = month.accounts - month.accountsBefore + month.accountsLost;
				if (month.accountsWon < 0) {
					month.accountsLost -= month.accountsWon;
					month.accountsWon = 0;
				}
				mrr = month.mrr;
				accounts = month.accounts;
			}
		}
	}

	/** Self-serve trials, scaled so the final year converts at SAMPLE.trialToPaid. */
	function sizeTrials(slices) {
		const selfServe = slices.filter((slice) => slice.channelId === 'self');
		const finalYear = steps(lastIndex - 11, lastIndex);
		const unscaled = (slice, index) => slice.months[index].accountsWon / slice.plan.trial.conv;
		const paidInYear = addUp(
			selfServe.map((slice) => addUp(finalYear.map((index) => slice.months[index].accountsWon))),
		);
		const trialsInYear = addUp(selfServe.map((slice) => addUp(finalYear.map((index) => unscaled(slice, index)))));
		const scale = paidInYear / SAMPLE.trialToPaid / trialsInYear;

		for (const slice of slices) {
			for (const [index, month] of slice.months.entries()) {
				month.trials = slice.channelId === 'self' ? unscaled(slice, index) * scale : 0;
			}
		}
		for (let index = 0; index < SAMPLE.monthCount; index += 1) roundAcross(selfServe, index, 'trials');
	}

	/* Reading the ledger back as the totals, splits and extras a view asks for. */

	const LEDGER_FIELD = {
		mrr: (month) => month.mrr,
		new: (month) => month.added,
		expansion: (month) => month.grown,
		churn: (month) => month.lost,
		netnew: (month) => month.added + month.grown - month.shrunk - month.lost,
		accounts: (month) => month.accounts,
		seats: (month) => month.seats,
		trials: (month) => month.trials,
		lost: (month) => month.accountsLost,
	};

	function slicesMatching(filters) {
		return ledger.filter(
			(slice) =>
				(filters.plan === 'all' || slice.planId === filters.plan) &&
				(filters.region === 'all' || slice.regionId === filters.region) &&
				(filters.segment === 'all' || slice.channelId === filters.segment),
		);
	}

	function totalAt(slices, index, field) {
		return addUp(slices.map((slice) => slice.months[index][field]));
	}

	/**
	 * One number for one slice in one month. A portion narrows it to a
	 * billing period or an add-on by that plan's share.
	 */
	function pieceValue(slice, index, metric, portion) {
		const amount = LEDGER_FIELD[metric]?.(slice.months[index]) || 0;
		if (!portion) return amount;
		if (portion.by === 'billing') {
			const yearly = slice.plan.annualShare[slice.channelId];
			return amount * (portion.id === 'annual' ? yearly : 1 - yearly);
		}
		const shares = slice.plan.addons;
		return amount * (portion.id === 'seats' ? 1 - addUp(Object.values(shares)) : shares[portion.id] || 0);
	}

	const CUTS = {
		plan: () =>
			SAMPLE.plans.map((plan) => ({ id: plan.id, label: plan.name, keep: (slice) => slice.planId === plan.id })),
		region: () =>
			SAMPLE.regions.map((region) => ({
				id: region.id,
				label: region.name,
				keep: (slice) => slice.regionId === region.id,
			})),
		segment: () =>
			SAMPLE.channels.map((channel) => ({
				id: channel.id,
				label: channel.name,
				keep: (slice) => slice.channelId === channel.id,
			})),
		billing: () => [
			{ id: 'monthly', label: 'Billed monthly', part: { by: 'billing', id: 'monthly' } },
			{ id: 'annual', label: 'Billed yearly', part: { by: 'billing', id: 'annual' } },
		],
		addon: () => [
			{ id: 'seats', label: 'Seat licenses', part: { by: 'addon', id: 'seats' } },
			...SAMPLE.addons.map((addon) => ({ id: addon.id, label: addon.name, part: { by: 'addon', id: addon.id } })),
		],
	};

	function cutsFor(breakdown) {
		return CUTS[breakdown]?.() || [];
	}

	/** The monthly values of each part of a split, empty parts dropped, plus the overall total. */
	function seriesFor(slices, metric, breakdown, months) {
		const groups = [];
		for (const cut of cutsFor(breakdown)) {
			const members = cut.keep ? slices.filter(cut.keep) : slices;
			const values = months.map((index) =>
				Math.round(addUp(members.map((slice) => pieceValue(slice, index, metric, cut.part)))),
			);
			if (values.some((value) => value !== 0))
				groups.push({ id: cut.id, label: cut.label, keep: cut.keep, part: cut.part, data: values });
		}
		const totals = months.map((index) =>
			Math.round(addUp(slices.map((slice) => pieceValue(slice, index, metric)))),
		);
		return { groups, totals };
	}

	/** A balance takes the closing month; a tally adds the months up. */
	function collapse(metric, values) {
		return SAMPLE.metrics[metric].type === 'stock' ? values.at(-1) : addUp(values);
	}

	function windowFor(period) {
		if (period !== 'ytd') return { from: lastIndex - Number(period) + 1, to: lastIndex };
		const january = (asOf.getFullYear() - startYear) * 12 + (1 - startMonth);
		return { from: Math.max(0, january), to: lastIndex };
	}

	function baselineFor(from, to, mode) {
		const length = to - from + 1;
		if (mode === 'prev' && from - length >= 0) {
			return {
				from: from - length,
				to: from - 1,
				label: 'previous period',
				name: length === 1 ? 'Month before' : `Previous ${length} months`,
			};
		}
		if (mode === 'yoy' && from - 12 >= 0) {
			return { from: from - 12, to: to - 12, label: 'same period last year', name: 'Same months last year' };
		}
		return null;
	}

	function runsOverTime(kind) {
		return OVER_TIME.includes(kind);
	}

	/**
	 * Everything one view of the report needs: its months, totals,
	 * comparison and the extra figures its chart kind draws.
	 */
	function measure(view) {
		const { from, to } = windowFor(view.period);
		const months = steps(from, to);
		const baseline = baselineFor(from, to, view.compare);
		/* The Pareto chart counts lost accounts; every other kind shows the report's own number. */
		const metric = view.kind === 'pareto' ? 'lost' : view.metric;
		const slices = slicesMatching(view.filters);
		const splitBy =
			runsOverTime(view.kind) || view.kind === 'ring' || view.kind === 'bars' ? view.breakdown : 'none';
		const { groups, totals } = seriesFor(slices, metric, splitBy, months);
		const baselineTotals = baseline
			? seriesFor(slices, metric, 'none', steps(baseline.from, baseline.to)).totals
			: null;

		const figure = {
			view,
			slices,
			from,
			to,
			months,
			baseline,
			metric,
			groups,
			totals,
			baselineTotals,
			ticks: months.map((index) => axisMonth(index, from)),
			monthTags: months.map(monthAndYear),
			value: collapse(metric, totals),
			prior: baselineTotals ? collapse(metric, baselineTotals) : null,
			empty: !totals.some((value) => value !== 0),
		};
		KIND_EXTRAS[view.kind]?.(figure);
		return figure;
	}

	const KIND_EXTRAS = {
		share(figure) {
			figure.shares = figure.groups.map((group) =>
				group.data.map((value, index) => (figure.totals[index] ? (value / figure.totals[index]) * 100 : 0)),
			);
		},
		ring(figure) {
			for (const group of figure.groups) group.value = collapse(figure.metric, group.data);
		},
		bars(figure) {
			KIND_EXTRAS.ring(figure);
			figure.groups.sort((a, b) => b.value - a.value);
		},
		pareto(figure) {
			const lostByPlan = Object.fromEntries(SAMPLE.plans.map((plan) => [plan.id, 0]));
			for (const slice of figure.slices)
				lostByPlan[slice.planId] += addUp(figure.months.map((index) => slice.months[index].accountsLost));
			const byReason = Object.fromEntries(SAMPLE.reasons.map((reason) => [reason.id, 0]));
			for (const plan of SAMPLE.plans) {
				const split = apportion(
					lostByPlan[plan.id],
					SAMPLE.reasons.map((reason) => plan.reasons[reason.id]),
				);
				for (const [index, reason] of SAMPLE.reasons.entries()) byReason[reason.id] += split[index];
			}
			figure.reasons = SAMPLE.reasons
				.map((reason) => ({ ...reason, value: byReason[reason.id] }))
				.sort((a, b) => b.value - a.value);
		},
		bullet(figure) {
			const sumOver = (members, field) =>
				addUp(members.map((slice) => addUp(figure.months.map((index) => slice.months[index][field]))));
			figure.regions = SAMPLE.regions
				.map((region) => {
					const members = figure.slices.filter((slice) => slice.regionId === region.id);
					return {
						id: region.id,
						label: region.name,
						value: sumOver(members, 'added'),
						goal: sumOver(members, 'target'),
					};
				})
				.filter((region) => region.goal > 0);
			figure.target = addUp(figure.regions.map((region) => region.goal));
		},
	};

	function viewFrom(entry) {
		return {
			kind: entry.kind,
			metric: entry.metric,
			breakdown: entry.breakdown,
			period: entry.period,
			compare: entry.compare,
			filters: copyOf(entry.filters),
		};
	}

	/* The page header shows the report's name, owner, tags and star. */

	function fillHero() {
		document.title = `${report.name} · Basalt`;
		pick('[data-rd="title"]').textContent = report.name;
		pick('[data-rd-delete-name]').textContent = report.name;
		const author = report.owner === 'tpl' ? 'Ready-made report' : memberById(report.owner).name;
		pick('[data-rd="sub"]').textContent =
			`${author} · Updated ${dateLabel(report.updated)} · Opened ${report.opens} times`;

		const kind = SAMPLE.chartKinds[report.kind];
		const audience = report.share.people.length;
		const tags = [
			`<span class="rd-kind"><i class="bi ${kind.icon}" aria-hidden="true"></i>${htmlSafe(kind.label)}</span>`,
		];
		tags.push(
			report.schedule
				? `<span class="basalt-status basalt-status-success basalt-status-dot">${htmlSafe(cadenceLabel(report.schedule))}</span>`
				: '<span class="basalt-status basalt-status-dot">Not scheduled</span>',
		);
		if (audience)
			tags.push(
				`<span class="basalt-status basalt-status-primary"><i class="bi bi-people" aria-hidden="true"></i>Shared with ${audience}</span>`,
			);
		pick('[data-rd="tags"]').innerHTML = tags.join('');

		const starButton = pick('[data-rd-star]');
		starButton.setAttribute('aria-pressed', String(report.starred));
		starButton.innerHTML = report.starred
			? '<i class="bi bi-star-fill" aria-hidden="true"></i>Starred'
			: '<i class="bi bi-star" aria-hidden="true"></i>Star';
	}

	function cadenceLabel(schedule) {
		const hour = Number(schedule.time.slice(0, 2));
		const clock = `${hour % 12 || 12}${schedule.time.slice(2, 5)}${hour < 12 ? ' am' : ' pm'}`;
		if (schedule.cadence === 'daily') return `Every weekday at ${clock}`;
		if (schedule.cadence === 'weekly') return `Every ${WEEKDAYS[schedule.day]} at ${clock}`;
		return `On the ${nth(schedule.day)} of each month at ${clock}`;
	}

	function deliveryLabel(schedule) {
		const names = joinNames(schedule.to);
		return schedule.format === 'Link' ? `Sent a link to ${names}` : `Emailed to ${names} as a ${schedule.format}`;
	}

	function wireHeroActions() {
		pick('[data-rd-star]').addEventListener('click', () => {
			report.starred = !report.starred;
			backend.star(report.id, report.starred);
			fillHero();
			sayAloud(report.starred ? 'Starred.' : 'Star removed.');
		});
		pick('[data-rd-delete-confirm]').addEventListener('click', () => {
			backend.remove(report.id).then(() => {
				window.location.href = 'reports.html';
			});
		});
	}

	/* The export menu, the "more" menu and the table's own CSV button. */
	const ACTIONS = {
		csv: exportNumbers,
		print: () => window.print(),
		edit() {
			setupPanel.card.scrollIntoView({ block: 'start', behavior: calmMotion ? 'auto' : 'smooth' });
			if (setupPanel.form.hidden) openSetup();
		},
		duplicate() {
			backend.duplicate(report.id).then(() =>
				notify({
					tone: 'success',
					title: 'Report duplicated',
					text: `${report.name} (copy) is in your reports.`,
					actions: [
						{
							label: 'Open Reports',
							onClick: () => {
								window.location.href = 'reports.html';
							},
						},
					],
				}),
			);
		},
		link() {
			window.Basalt.copyText?.(SAMPLE.linkBase + report.id);
			notify({
				tone: 'success',
				icon: 'bi-link-45deg',
				title: 'Link copied',
				text: 'People need access to open it.',
			});
		},
		delete: () => bootstrap.Modal.getOrCreateInstance(pick('#rd-delete')).show(),
	};

	/* Clicks on generated markup and on repeated buttons are handled once, at the page root. */
	function bindPageClicks() {
		page.addEventListener('click', (event) => {
			if (event.target.closest('[data-rd-empty-clear]')) {
				onScreen.filters = copyOf(NO_FILTERS);
				redrawView();
			}
			const cancel = event.target.closest('[data-rd-cancel]');
			if (cancel) endEditing(cancel.closest('[data-rd-section]').getAttribute('data-rd-section'));
			const action = event.target.closest('[data-rd-act]');
			if (action) ACTIONS[action.getAttribute('data-rd-act')]?.();
		});
	}

	/* Period, comparison and filters change only the view. Once it no
     longer matches the stored report, a short note in the chart card
     offers to keep it as the default or to go back. */

	function optionsHtml(allLabel, entries) {
		const choices = entries.map((entry) => `<option value="${entry.id}">${htmlSafe(entry.name)}</option>`);
		return `<option value="all">${allLabel}</option>${choices.join('')}`;
	}

	function bindToolbar() {
		for (const radio of controls.period) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				onScreen.period = radio.value;
				redrawView();
			});
		}
		controls.compare.addEventListener('change', () => {
			onScreen.compare = controls.compare.value;
			redrawView();
		});
		for (const key of FILTER_KEYS) {
			controls[key].addEventListener('change', () => {
				onScreen.filters[key] = controls[key].value;
				redrawView();
			});
		}

		pick('[data-rd-clear]').addEventListener('click', () => {
			onScreen.filters = copyOf(NO_FILTERS);
			redrawView();
			pick('[data-rd-filter-btn]').focus();
		});
		pick('[data-rd-view-reset]').addEventListener('click', () => {
			onScreen = viewFrom(report);
			redrawView();
			sayAloud('Back to the saved view.');
		});
		pick('[data-rd-view-save]').addEventListener('click', () => {
			Object.assign(report, copyOf(onScreen), { updated: SAMPLE.now.slice(0, 10) });
			record('bi-sliders', memberById(SAMPLE.me).name, 'saved a new default period and filters');
			backend.save(report);
			redrawView();
			fillHero();
			fillSetupCard();
			notify({
				tone: 'success',
				title: 'Saved as the default',
				text: `Everyone who opens ${report.name} now starts from this view.`,
			});
		});
	}

	/** Puts the toolbar controls and the filter badge in step with the view. */
	function reflectView() {
		for (const radio of controls.period) radio.checked = radio.value === onScreen.period;
		controls.period[0].closest('[data-basalt-segmented]')?.dispatchEvent(new Event('change', { bubbles: true }));
		controls.compare.value = onScreen.compare;
		syncPicker(controls.compare);
		for (const key of FILTER_KEYS) controls[key].value = onScreen.filters[key];

		const active = FILTER_KEYS.filter((key) => onScreen.filters[key] !== 'all').length;
		const badge = pick('[data-rd-filter-count]');
		badge.textContent = active;
		badge.hidden = !active;
		pick('[data-rd-filter-btn]').setAttribute('aria-label', active ? `Filters, ${active} on` : 'Filters');
		pick('[data-rd-clear]').hidden = !active;
	}

	function matchesSaved() {
		return JSON.stringify(viewFrom(report)) === JSON.stringify(onScreen);
	}

	function filterSummary(filters) {
		const named = [
			[filters.plan, SAMPLE.plans],
			[filters.region, SAMPLE.regions],
			[filters.segment, SAMPLE.channels],
		]
			.filter(([chosen]) => chosen !== 'all')
			.map(([chosen, list]) => list.find((entry) => entry.id === chosen).name);
		return named.length ? named.join(', ') : 'All plans, regions and segments';
	}

	function fillChartCard() {
		const figure = current;
		const metric = SAMPLE.metrics[onScreen.metric];
		const titles = { pareto: 'Reasons for canceling', bullet: 'New MRR against plan' };
		pick('[data-rd="chart-title"]').textContent = titles[onScreen.kind] || metric.long;
		const against =
			figure.baseline && runsOverTime(onScreen.kind) && onScreen.kind !== 'share'
				? `, against ${spanLabel(figure.baseline.from, figure.baseline.to)}`
				: '';
		pick('[data-rd="chart-desc"]').textContent =
			`${spanLabel(figure.from, figure.to)}${against}. ${filterSummary(onScreen.filters)}.`;
		fillHeadline(figure);

		const legend = pick('[data-rd="key"]');
		legend.innerHTML = figure.empty ? '' : legendHtml(figure);
		legend.hidden = !legend.innerHTML;

		const stage = pick('[data-rd="chart"]');
		stage.className = `rd-chart rd-chart-${onScreen.kind}`;
		stage.style.removeProperty('--rd-rows');
		const caption = metric.type === 'stock' ? `in ${monthAndYear(figure.to)}` : 'in the period';

		if (figure.empty) {
			wipe(stage);
			stage.innerHTML = `<div class="basalt-empty basalt-empty-framed">
        <span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-funnel"></i></span>
        <h3 class="basalt-empty-title">Nothing for these filters</h3>
        <p class="basalt-empty-text">${htmlSafe(metric.label)} has no figures for ${htmlSafe(filterSummary(onScreen.filters))}.</p>
        <div class="basalt-empty-actions"><button type="button" class="btn btn-sm btn-outline-secondary" data-rd-empty-clear>Clear filters</button></div>
      </div>`;
		} else if (onScreen.kind === 'ring') {
			wipe(stage);
			stage.innerHTML =
				'<div class="rd-ring"><div class="rd-ring-chart"></div><ul class="rd-split-list"></ul></div>';
			pick('.rd-split-list', stage).innerHTML = splitItems(figure.groups, figure.value, figure.metric);
			plant(pick('.rd-ring-chart', stage), `${report.name}. ${chartSummary(figure)}`, (colors, animate) =>
				CHARTS.ring(colors, figure, animate, figure.groups, figure.value, caption),
			);
		} else {
			const rows = { bars: figure.groups, bullet: figure.regions }[onScreen.kind];
			if (rows) stage.style.setProperty('--rd-rows', rows.length);
			plant(stage, `${report.name}. ${chartSummary(figure)}`, (colors, animate) =>
				CHARTS[onScreen.kind](colors, figure, animate),
			);
		}
		pick('[data-rd="view-note"]').hidden = matchesSaved();
	}

	function fillHeadline(figure) {
		const metric = SAMPLE.metrics[figure.metric];
		pick('[data-rd="headline"]').hidden = figure.empty;
		pick('[data-rd="value"]').textContent = display(figure.metric, figure.value);
		pick('[data-rd="value-label"]').textContent =
			metric.type === 'stock'
				? `${metric.label} in ${monthNameYear(figure.to)}`
				: `${figure.view.kind === 'pareto' ? 'Accounts that canceled' : metric.label}, ${spanLabel(figure.from, figure.to)}`;

		const { reference, against } = headlineReference(figure, metric);
		const delta = pick('[data-rd="delta"]');
		if (!reference || figure.empty) {
			delta.className = 'rd-delta';
			delta.textContent = '';
			return;
		}
		const change = ((figure.value - reference) / Math.abs(reference)) * 100;
		const welcome = metric.falling ? change <= 0 : change >= 0;
		delta.className = `rd-delta ${welcome ? 'is-up' : 'is-down'}`;
		delta.innerHTML =
			`<i class="bi ${change >= 0 ? 'bi-arrow-up-right' : 'bi-arrow-down-right'}" aria-hidden="true"></i>` +
			`<strong>${change >= 0 ? '+' : '−'}${percent(Math.abs(change))}</strong>` +
			`<span>on ${htmlSafe(against)} (${htmlSafe(display(figure.metric, reference))})</span>`;
	}

	/**
	 * What the headline figure is measured against: the plan for the
	 * bullet chart, otherwise the chosen comparison. A balance with no
	 * comparison falls back to the month before.
	 */
	function headlineReference(figure, metric) {
		if (figure.view.kind === 'bullet') return { reference: figure.target, against: 'plan' };
		if (figure.baseline) return { reference: figure.prior, against: `the ${figure.baseline.label}` };
		if (metric.type === 'stock') {
			const field = { mrr: 'mrr', accounts: 'accounts', seats: 'seats' }[figure.metric];
			return { reference: totalAt(figure.slices, figure.to - 1, field), against: monthNameYear(figure.to - 1) };
		}
		return { reference: null, against: '' };
	}

	/** The chart key is markup, not canvas, so it can wrap on narrow cards. */
	function legendHtml(figure) {
		const entry = (shape, label, color) =>
			`<li><span class="rd-key-${shape}" style="--rd-c:${color}"></span>${htmlSafe(label)}</li>`;
		const perGroup = (shape) =>
			figure.groups.map((group, index) => entry(shape, group.label, rampVar(group.id, index))).join('');
		const metricLabel = SAMPLE.metrics[figure.metric].label;
		const keys = {
			line() {
				if (figure.groups.length > 1) return perGroup('line');
				const main = entry(
					'line',
					`${metricLabel}, ${spanLabel(figure.from, figure.to)}`,
					'var(--basalt-series-1)',
				);
				return (
					main +
					(figure.baselineTotals
						? entry('line rd-key-line-dashed', figure.baseline.name, 'var(--rd-quiet)')
						: '')
				);
			},
			stacked: () =>
				figure.groups.length > 1
					? perGroup('bar') + entry('line', 'Total', 'var(--basalt-copy)')
					: entry('bar', metricLabel, 'var(--basalt-series-1)'),
			share: () => perGroup('bar'),
			columns: () =>
				entry('bar', 'Added', 'var(--basalt-series-1)') + entry('bar', 'Lost', 'var(--basalt-danger)'),
			pareto: () =>
				entry('bar', 'Share of cancellations', 'var(--basalt-series-3)') +
				entry('line', 'Running total', 'var(--basalt-copy)') +
				entry('line rd-key-line-dotted', '80% mark', 'var(--rd-quiet)'),
			bullet: () =>
				entry('bar', 'New MRR', 'var(--basalt-series-1)') + entry('tick', 'Plan', 'var(--basalt-copy)'),
		};
		return keys[figure.view.kind]?.() || '';
	}

	/** A sentence for the canvas's accessible name. */
	function chartSummary(figure) {
		const metric = SAMPLE.metrics[figure.metric];
		const period = spanLabel(figure.from, figure.to);
		const splitName = () => SAMPLE.breakdowns[figure.view.breakdown].toLowerCase();
		const byPart = () => {
			const when = metric.type === 'stock' ? `in ${monthAndYear(figure.to)}` : `for ${period}`;
			const parts = figure.groups
				.map((group) => `${group.label} ${display(figure.metric, group.value)}`)
				.join(', ');
			return `${metric.label} ${when} by ${splitName()}: ${parts}.`;
		};
		const sentences = {
			pareto() {
				const leaders = figure.reasons
					.slice(0, 2)
					.map((reason) => `${reason.label} (${asCount(reason.value)})`)
					.join(' and ');
				return `${asCount(figure.value)} accounts canceled, ${period}. ${leaders} were the top reasons.`;
			},
			bullet() {
				const regions = figure.regions
					.map((region) => `${region.label} ${percent((region.value / region.goal) * 100, 0)} of plan`)
					.join(', ');
				return `New MRR ${asMoney(figure.value)} against a plan of ${asMoney(figure.target)}, ${period}. ${regions}.`;
			},
			ring: byPart,
			bars: byPart,
			share() {
				const parts = figure.groups
					.map((group, index) => `${group.label} ${percent(figure.shares[index].at(-1))}`)
					.join(', ');
				return `Share of ${metric.label} in ${monthAndYear(figure.to)}: ${parts}.`;
			},
		};
		if (sentences[figure.view.kind]) return sentences[figure.view.kind]();

		const movement =
			metric.type === 'stock'
				? ` went from ${display(figure.metric, figure.totals[0])} in ${monthAndYear(figure.from)} to ${display(figure.metric, figure.value)} in ${monthAndYear(figure.to)}`
				: ` came to ${display(figure.metric, figure.value)}, ${period}`;
		let versus = '';
		if (figure.prior) {
			const change = ((figure.value - figure.prior) / Math.abs(figure.prior)) * 100;
			versus = `, ${change >= 0 ? 'up ' : 'down '}${percent(Math.abs(change))} on the ${figure.baseline.label}`;
		}
		return `${metric.label}${movement}${versus}.`;
	}

	/* Canvas drawing reads theme colors fresh, so a rebuilt chart always matches the page. */

	function cssToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** Red, green and blue from a hex or rgb() color; mid gray when it cannot be read. */
	function rgbParts(color) {
		const source = String(color || '').trim();
		const short = /^#([0-9a-f]{3})$/i.exec(source);
		if (short) return [...short[1]].map((digit) => parseInt(digit + digit, 16));
		const long = /^#([0-9a-f]{6})$/i.exec(source);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(source);
		if (functional)
			return functional[1]
				.split(',')
				.map((part) => parseFloat(part))
				.slice(0, 3);
		return [128, 128, 128];
	}

	function translucent(color, alpha) {
		const [red, green, blue] = rgbParts(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	function blend(color, other, weight) {
		const first = rgbParts(color);
		const second = rgbParts(other);
		const [red, green, blue] = [0, 1, 2].map((channel) =>
			Math.round(first[channel] * weight + second[channel] * (1 - weight)),
		);
		return `rgb(${red}, ${green}, ${blue})`;
	}

	function gradientsOff() {
		return document.documentElement.getAttribute('data-basalt-gradients') === 'off';
	}

	/** The current theme's colors, read fresh for every chart build. */
	function chartColors() {
		const ink = cssToken('--basalt-copy', '#12233a');
		const muted = cssToken('--basalt-copy-muted', '#5f7186');
		return {
			ramp: [1, 2, 3, 4, 5, 6, 7, 8].map((step) => cssToken(`--basalt-series-${step}`, '#2b6fd4')),
			ink,
			/* Mixed the same way as --rd-quiet in report-details.css. */
			soft: blend(muted, ink, 0.72),
			faint: translucent(ink, 0.3),
			gridline: translucent(ink, 0.07),
			rail: translucent(ink, 0.07),
			paper: cssToken('--basalt-plane', '#ffffff'),
			outline: cssToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			alarm: cssToken('--basalt-danger', '#ef4d63'),
		};
	}

	function slotFor(id, index) {
		return SERIES_SLOT[id] ?? index;
	}

	function rampColor(colors, id, index) {
		return colors.ramp[slotFor(id, index)];
	}

	function rampVar(id, index) {
		return `var(--basalt-series-${slotFor(id, index) + 1})`;
	}

	/* A top-to-bottom fade across the plot; with gradients off, one plain
	   color: `flat`, or the first stop. */
	function verticalGradient(stops, flat) {
		return window.Basalt.chartFill(stops, { flat });
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

	function barWash(color, topAlpha, bottomAlpha) {
		return verticalGradient([
			[0, translucent(color, topAlpha)],
			[1, translucent(color, bottomAlpha)],
		]);
	}

	/**
	 * A rounded badge painted on the canvas: card color behind body text,
	 * kept inside the given horizontal bounds.
	 * @param {{align?: 'left'|'center', dot?: string}} [placement]
	 */
	function drawBadge(ctx, colors, x, y, label, bounds, placement = {}) {
		const height = 21;
		ctx.save();
		ctx.font = `600 11px ${TYPEFACE}`;
		const dotRoom = placement.dot ? 12 : 0;
		const width = ctx.measureText(label).width + 16 + dotRoom;
		const anchored = { left: x, center: x - width / 2 }[placement.align] ?? x - width;
		const left = Math.max(bounds.left, Math.min(anchored, bounds.right - width));
		const top = Math.max(0, y - height);

		ctx.fillStyle = colors.paper;
		ctx.strokeStyle = colors.outline;
		ctx.lineWidth = 1;
		ctx.beginPath();
		if (ctx.roundRect) ctx.roundRect(left, top, width, height, 10.5);
		else ctx.rect(left, top, width, height);
		ctx.fill();
		ctx.stroke();
		if (placement.dot) {
			ctx.fillStyle = placement.dot;
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

	function drawLabel(ctx, color, label, x, y, align) {
		ctx.save();
		ctx.font = `600 11.5px ${TYPEFACE}`;
		ctx.fillStyle = color;
		ctx.textAlign = align || 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(label, x, y);
		ctx.restore();
	}

	function isPlainObject(value) {
		return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
	}

	/** Merges nested option objects; arrays and functions replace what was there. */
	function layerOptions(base, overrides) {
		const merged = { ...base };
		for (const [key, value] of Object.entries(overrides || {})) {
			merged[key] = isPlainObject(value) && isPlainObject(merged[key]) ? layerOptions(merged[key], value) : value;
		}
		return merged;
	}

	/** Options every cartesian chart on the page shares, with per-chart overrides merged in. */
	function chartDefaults(colors, animate, overrides) {
		const tickStyle = { color: colors.soft, font: { family: TYPEFACE, size: 11.5 }, padding: 8 };
		return layerOptions(
			{
				responsive: true,
				maintainAspectRatio: false,
				animation: animate ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				layout: { padding: { top: 28, right: 12 } },
				elements: {
					line: { borderWidth: 2.5, borderCapStyle: 'round', borderJoinStyle: 'round' },
					point: { radius: 0, hoverRadius: 5, hoverBorderWidth: 2, hoverBorderColor: colors.paper },
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: colors.paper,
						titleColor: colors.ink,
						bodyColor: colors.ink,
						footerColor: colors.ink,
						borderColor: colors.outline,
						borderWidth: 1,
						padding: 10,
						cornerRadius: 8,
						boxPadding: 4,
						usePointStyle: true,
						titleFont: { family: TYPEFACE, size: 12, weight: '600' },
						bodyFont: { family: TYPEFACE, size: 12 },
					},
				},
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: { maxRotation: 0, autoSkipPadding: 10, ...tickStyle },
					},
					y: {
						grid: { color: colors.gridline },
						border: { display: false },
						ticks: { maxTicksLimit: 5, ...tickStyle },
					},
				},
			},
			overrides,
		);
	}

	/* One config builder per chart kind, keyed by the report's kind. */
	const CHARTS = {
		/* A trend line over the comparison, dashed behind it; or one line per part of a split. */
		line(colors, figure, animate) {
			const single = figure.groups.length < 2;
			const accent = colors.ramp[0];
			const datasets = single
				? [
						{
							label: SAMPLE.metrics[figure.metric].label,
							data: figure.totals,
							borderColor: accent,
							backgroundColor: areaWash(accent),
							pointBackgroundColor: accent,
							fill: 'start',
							tension: 0.35,
						},
					]
				: figure.groups.map((group, index) => {
						const color = rampColor(colors, group.id, index);
						return {
							label: group.label,
							data: group.data,
							borderColor: color,
							backgroundColor: color,
							pointBackgroundColor: color,
							tension: 0.35,
						};
					});
			if (single && figure.baselineTotals) {
				datasets.push({
					label: figure.baseline.name,
					data: figure.baselineTotals,
					borderColor: colors.soft,
					backgroundColor: colors.soft,
					pointBackgroundColor: colors.soft,
					borderWidth: 1.5,
					borderDash: [5, 5],
					fill: false,
					tension: 0.35,
				});
			}
			const lastPoint = figure.totals.length - 1;
			const tooltipTitle = (items) => {
				const index = items[0].dataIndex;
				const against =
					figure.baseline && single ? ` (against ${monthAndYear(figure.baseline.from + index)})` : '';
				return figure.monthTags[index] + against;
			};
			return {
				type: 'line',
				data: { labels: figure.ticks, datasets },
				options: chartDefaults(colors, animate, {
					plugins: {
						tooltip: {
							callbacks: {
								title: tooltipTitle,
								label: (item) =>
									` ${item.dataset.label}: ${display(figure.metric, item.parsed.y, true)}`,
							},
						},
					},
					scales: {
						y: {
							beginAtZero: SAMPLE.metrics[figure.metric].type === 'flow',
							ticks: { callback: tickFormatter(figure.metric) },
						},
					},
				}),
				plugins: [
					{
						id: 'rdLatestBadge',
						afterDatasetsDraw(chart) {
							if (!single) return;
							const point = chart.getDatasetMeta(0).data[lastPoint];
							const area = chart.chartArea;
							if (!point) return;
							drawBadge(
								chart.ctx,
								colors,
								point.x,
								point.y - 10,
								display(figure.metric, figure.totals[lastPoint]),
								{ left: area.left, right: area.right + 10 },
								{ dot: accent },
							);
						},
					},
				],
			};
		},

		/* Columns stacked by part in each part's color, with the total traced as a line. */
		stacked(colors, figure, animate) {
			const parts = figure.groups.length
				? figure.groups
				: [{ id: 'all', label: SAMPLE.metrics[figure.metric].label, data: figure.totals }];
			const topIndex = parts.length - 1;
			const datasets = parts.map((part, index) => {
				const color = parts.length === 1 ? colors.ramp[0] : rampColor(colors, part.id, index);
				return {
					type: 'bar',
					label: part.label,
					data: part.data,
					stack: 'one',
					order: 2,
					backgroundColor: translucent(color, 0.9),
					hoverBackgroundColor: color,
					borderRadius: index === topIndex ? { topLeft: 6, topRight: 6 } : 0,
					borderColor: colors.paper,
					borderWidth: index === 0 ? 0 : { bottom: 2 },
					borderSkipped: false,
					barPercentage: 0.62,
					categoryPercentage: 0.82,
					maxBarThickness: 44,
				};
			});
			if (parts.length > 1) {
				datasets.unshift({
					type: 'line',
					label: 'Total',
					data: figure.totals,
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
			const totalLast = (a, b) => {
				if (a.dataset.label === 'Total') return 1;
				if (b.dataset.label === 'Total') return -1;
				return b.datasetIndex - a.datasetIndex;
			};
			return {
				type: 'bar',
				data: { labels: figure.ticks, datasets },
				options: chartDefaults(colors, animate, {
					plugins: {
						tooltip: {
							itemSort: totalLast,
							callbacks: {
								title: (items) => figure.monthTags[items[0].dataIndex],
								label: (item) =>
									` ${item.dataset.label}: ${display(figure.metric, item.parsed.y, true)}`,
							},
						},
					},
					scales: {
						x: { stacked: true },
						y: { stacked: true, beginAtZero: true, ticks: { callback: tickFormatter(figure.metric) } },
					},
				}),
			};
		},

		/* Plain columns; a month that lost ground drops below zero in the danger color. */
		columns(colors, figure, animate) {
			const accent = colors.ramp[0];
			const values = figure.totals;
			return {
				type: 'bar',
				data: {
					labels: figure.ticks,
					datasets: [
						{
							label: SAMPLE.metrics[figure.metric].label,
							data: values,
							backgroundColor: values.map((value) =>
								value < 0 ? translucent(colors.alarm, 0.85) : translucent(accent, 0.9),
							),
							hoverBackgroundColor: values.map((value) => (value < 0 ? colors.alarm : accent)),
							borderRadius: 6,
							borderSkipped: false,
							barPercentage: 0.6,
							maxBarThickness: 40,
						},
					],
				},
				options: chartDefaults(colors, animate, {
					plugins: {
						tooltip: {
							displayColors: false,
							callbacks: {
								title: (items) => figure.monthTags[items[0].dataIndex],
								label: (item) => ` ${display(figure.metric, item.parsed.y, true)}`,
							},
						},
					},
					scales: { y: { beginAtZero: true, ticks: { callback: tickFormatter(figure.metric) } } },
				}),
				plugins: [
					{
						id: 'rdPeakBadge',
						afterDatasetsDraw(chart) {
							const peak = values.indexOf(Math.max(...values));
							const column = chart.getDatasetMeta(0).data[peak];
							const area = chart.chartArea;
							if (!column) return;
							const label = `Best ${figure.monthTags[peak].split(' ')[0]} · ${display(figure.metric, values[peak])}`;
							drawBadge(
								chart.ctx,
								colors,
								column.x,
								column.y - 6,
								label,
								{ left: area.left, right: area.right },
								{ align: 'center', dot: accent },
							);
						},
					},
				],
			};
		},

		/* Areas stacked to 100%, one per part. */
		share(colors, figure, animate) {
			const datasets = figure.groups.map((group, index) => {
				const color = rampColor(colors, group.id, index);
				return {
					label: group.label,
					data: figure.shares[index].map((value) => Math.round(value * 10) / 10),
					borderColor: color,
					backgroundColor: translucent(color, gradientsOff() ? 0.5 : 0.62),
					pointBackgroundColor: color,
					fill: index === 0 ? 'origin' : '-1',
					tension: 0.3,
					borderWidth: 2,
				};
			});
			return {
				type: 'line',
				data: { labels: figure.ticks, datasets },
				options: chartDefaults(colors, animate, {
					layout: { padding: { top: 8, right: 12 } },
					plugins: {
						tooltip: {
							callbacks: {
								title: (items) => figure.monthTags[items[0].dataIndex],
								label: (item) => ` ${item.dataset.label}: ${item.parsed.y.toFixed(1)}%`,
							},
						},
					},
					scales: {
						y: { stacked: true, min: 0, max: 100, ticks: { stepSize: 25, callback: (tick) => `${tick}%` } },
					},
				}),
			};
		},

		/* A doughnut with the total written in its hole; also drawn by the split card. */
		ring(colors, figure, animate, groups, total, caption) {
			const fills = groups.map((group, index) => rampColor(colors, group.id, index));
			return {
				type: 'doughnut',
				data: {
					labels: groups.map((group) => group.label),
					datasets: [
						{
							data: groups.map((group) => group.value),
							backgroundColor: fills,
							hoverBackgroundColor: fills,
							borderColor: colors.paper,
							borderWidth: 2,
							hoverOffset: 6,
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					cutout: '72%',
					animation: animate ? { duration: 500, easing: 'easeOutQuart' } : false,
					layout: { padding: 8 },
					plugins: {
						legend: { display: false },
						tooltip: {
							backgroundColor: colors.paper,
							titleColor: colors.ink,
							bodyColor: colors.ink,
							borderColor: colors.outline,
							borderWidth: 1,
							padding: 10,
							cornerRadius: 8,
							boxPadding: 4,
							usePointStyle: true,
							bodyFont: { family: TYPEFACE, size: 12 },
							callbacks: {
								label: (item) =>
									` ${item.label}: ${display(figure.metric, item.parsed, true)} (${percent((item.parsed / (total || 1)) * 100)})`,
							},
						},
					},
				},
				plugins: [
					{
						id: 'rdRingCenter',
						afterDraw(chart) {
							const area = chart.chartArea;
							if (!area) return;
							const middleX = (area.left + area.right) / 2;
							const middleY = (area.top + area.bottom) / 2;
							const { ctx } = chart;
							ctx.save();
							ctx.textAlign = 'center';
							ctx.fillStyle = colors.ink;
							ctx.font = `700 20px ${TYPEFACE}`;
							ctx.fillText(display(figure.metric, total), middleX, middleY + 2);
							ctx.fillStyle = colors.soft;
							ctx.font = `500 11.5px ${TYPEFACE}`;
							ctx.fillText(caption, middleX, middleY + 20);
							ctx.restore();
						},
					},
				],
			};
		},

		/* Horizontal bars, largest first, each in its part's color with the value at its tip. */
		bars(colors, figure, animate) {
			const longest = Math.max(...figure.groups.map((group) => group.value)) || 1;
			const fills = figure.groups.map((group, index) => rampColor(colors, group.id, index));
			return {
				type: 'bar',
				data: {
					labels: figure.groups.map((group) => group.label),
					datasets: [
						{
							label: SAMPLE.metrics[figure.metric].label,
							data: figure.groups.map((group) => group.value),
							backgroundColor: fills.map((color) => translucent(color, 0.9)),
							hoverBackgroundColor: fills,
							borderRadius: 6,
							borderSkipped: false,
							barPercentage: 0.66,
							categoryPercentage: 0.86,
							maxBarThickness: 34,
						},
					],
				},
				options: chartDefaults(colors, animate, {
					indexAxis: 'y',
					interaction: { mode: 'nearest', axis: 'y', intersect: false },
					layout: { padding: { top: 4, right: 70 } },
					plugins: {
						tooltip: {
							displayColors: false,
							callbacks: {
								label: (item) =>
									` ${display(figure.metric, item.parsed.x, true)} (${percent((item.parsed.x / (figure.value || 1)) * 100)} of the total)`,
							},
						},
					},
					scales: {
						x: { display: false, beginAtZero: true, max: longest },
						y: {
							grid: { display: false },
							ticks: { color: colors.ink, font: { family: TYPEFACE, size: 12.5, weight: '600' } },
						},
					},
				}),
				plugins: [
					{
						id: 'rdBarTips',
						afterDatasetsDraw(chart) {
							for (const [index, bar] of chart.getDatasetMeta(0).data.entries()) {
								drawLabel(
									chart.ctx,
									colors.ink,
									display(figure.metric, figure.groups[index].value),
									bar.x + 10,
									bar.y + 0.5,
								);
							}
						},
					},
				],
			};
		},

		/* Cancellation reasons as bars, with the running share as a line and an 80% guide. */
		pareto(colors, figure, animate) {
			const accent = colors.ramp[2];
			const whole = figure.value || 1;
			const shares = figure.reasons.map((reason) => Math.round((reason.value / whole) * 1000) / 10);
			let cumulative = 0;
			const running = shares.map((share) => {
				cumulative += share;
				return Math.min(100, Math.round(cumulative * 10) / 10);
			});
			const vitalFew = running.findIndex((share) => share >= 80);
			const strong = barWash(accent, 0.95, 0.5);
			const faint = barWash(accent, 0.34, 0.16);
			return {
				type: 'bar',
				data: {
					labels: figure.reasons.map((reason) => reason.label),
					datasets: [
						{
							type: 'line',
							label: 'Running total',
							data: running,
							order: 0,
							borderColor: colors.ink,
							backgroundColor: colors.ink,
							borderWidth: 2,
							tension: 0.3,
							pointRadius: 3,
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
							maxBarThickness: 56,
							borderRadius: 6,
							backgroundColor: (context) =>
								context.dataIndex <= vitalFew ? strong(context) : faint(context),
							hoverBackgroundColor: (context) =>
								context.dataIndex <= vitalFew ? accent : translucent(accent, 0.55),
						},
					],
				},
				options: chartDefaults(colors, animate, {
					plugins: {
						tooltip: {
							itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
							callbacks: {
								title: (items) => figure.reasons[items[0].dataIndex].label,
								label: (item) =>
									item.dataset.label === 'Share'
										? ` ${asCount(figure.reasons[item.dataIndex].value)} accounts, ${item.parsed.y}%`
										: ` Running total: ${item.parsed.y}%`,
							},
						},
					},
					scales: {
						x: {
							ticks: {
								autoSkip: false,
								callback(index) {
									return this.chart.width < 760
										? figure.reasons[index].short
										: figure.reasons[index].label;
								},
							},
						},
						y: { min: 0, max: 100, ticks: { stepSize: 25, callback: (tick) => `${tick}%` } },
					},
				}),
				plugins: [
					{
						id: 'rdEightyGuide',
						beforeDatasetsDraw(chart) {
							const { ctx, chartArea: area, scales } = chart;
							const level = scales.y.getPixelForValue(80);
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
							const area = chart.chartArea;
							const point = chart.getDatasetMeta(0).data[vitalFew];
							if (!point) return;
							const label = `Top ${vitalFew + 1} · ${Math.round(running[vitalFew])}% of cancellations`;
							drawBadge(
								chart.ctx,
								colors,
								point.x + 10,
								point.y + 26,
								label,
								{ left: area.left, right: area.right + 6 },
								{ align: 'left', dot: accent },
							);
						},
					},
				],
			};
		},

		/* New MRR per region on a track, with each region's plan marked as a tick. */
		bullet(colors, figure, animate) {
			const regions = figure.regions;
			const reach = Math.max(...regions.map((region) => Math.max(region.value, region.goal))) * 1.12;
			return {
				type: 'bar',
				data: {
					labels: regions.map((region) => region.label),
					datasets: [
						{
							label: 'New MRR',
							data: regions.map((region) => region.value),
							backgroundColor: regions.map((region, index) =>
								translucent(rampColor(colors, region.id, index), 0.95),
							),
							hoverBackgroundColor: regions.map((region, index) => rampColor(colors, region.id, index)),
							barPercentage: 0.4,
							categoryPercentage: 1,
							borderRadius: 4,
							grouped: false,
							order: 0,
						},
						{
							label: 'Track',
							data: regions.map(() => reach),
							backgroundColor: colors.rail,
							hoverBackgroundColor: colors.rail,
							borderRadius: 6,
							barPercentage: 0.78,
							categoryPercentage: 1,
							grouped: false,
							order: 1,
						},
					],
				},
				options: chartDefaults(colors, animate, {
					indexAxis: 'y',
					interaction: { mode: 'nearest', axis: 'y', intersect: false },
					layout: { padding: { top: 4, right: 4 } },
					plugins: {
						tooltip: {
							filter: (item) => item.datasetIndex === 0,
							callbacks: {
								label: (item) =>
									` ${asMoney(regions[item.dataIndex].value, true)} of a ${asMoney(regions[item.dataIndex].goal, true)} plan`,
							},
						},
					},
					scales: {
						x: {
							max: reach,
							beginAtZero: true,
							grid: { display: false },
							ticks: { maxTicksLimit: 5, callback: (tick) => asMoney(tick) },
						},
						y: {
							grid: { display: false },
							ticks: { color: colors.ink, font: { family: TYPEFACE, size: 12.5, weight: '600' } },
						},
					},
				}),
				plugins: [
					{
						id: 'rdPlanTicks',
						afterDatasetsDraw(chart) {
							const { ctx, scales } = chart;
							ctx.save();
							for (const [index, track] of chart.getDatasetMeta(1).data.entries()) {
								const region = regions[index];
								const tickX = scales.x.getPixelForValue(region.goal);
								const halfHeight = track.height / 2;
								ctx.strokeStyle = colors.ink;
								ctx.lineWidth = 2.5;
								ctx.lineCap = 'round';
								ctx.beginPath();
								ctx.moveTo(tickX, track.y - halfHeight + 3);
								ctx.lineTo(tickX, track.y + halfHeight - 3);
								ctx.stroke();

								const gap = Math.round(((region.value - region.goal) / region.goal) * 100);
								let sign = '';
								if (gap > 0) sign = '+';
								else if (gap < 0) sign = '−';
								ctx.fillStyle = colors.ink;
								ctx.font = `600 11.5px ${TYPEFACE}`;
								ctx.textAlign = 'right';
								ctx.textBaseline = 'middle';
								ctx.fillText(`${sign}${Math.abs(gap)}% on plan`, track.x - 10, track.y + 0.5);
							}
							ctx.restore();
						},
					},
				],
			};
		},
	};

	/** Builds (or rebuilds) the chart on a canvas from the current theme's colors. */
	function paint(canvas, build, animate) {
		liveCharts.get(canvas)?.chart.destroy();
		liveCharts.set(canvas, { chart: new Chart(canvas, build(chartColors(), animate && !calmMotion)), build });
	}

	/** Destroys every chart inside a box and empties it. */
	function wipe(box) {
		for (const [canvas, entry] of liveCharts) {
			if (!box.contains(canvas)) continue;
			entry.chart.destroy();
			liveCharts.delete(canvas);
		}
		box.textContent = '';
	}

	/** Replaces a box's contents with a fresh, labeled canvas and draws on it. */
	function plant(box, label, build) {
		wipe(box);
		const canvas = document.createElement('canvas');
		canvas.setAttribute('role', 'img');
		canvas.setAttribute('aria-label', label);
		box.appendChild(canvas);
		paint(canvas, build, true);
	}

	/* The numbers table puts the newest month on top; six show and the
     rest fold away. Ring and ranked-bar reports already show their
     parts, so the table lists those parts month by month. Reasons and
     the plan chart list their own rows instead of months. */

	function bindTable() {
		pick('[data-rd-table-more]').addEventListener('click', () => {
			window.Basalt.slide(pick('[data-rd="table"]'), () => {
				tableExpanded = !tableExpanded;
				fillNumbers();
			});
		});
	}

	function column(label, numeric, extra) {
		return { label, num: numeric, ...extra };
	}

	/**
	 * The table as data, shared by the page and the CSV export.
	 * @returns {{title, head: Array<{label, num, cls?, dot?}>, rows: Array<{cells, latest?}>, foot, months?}}
	 */
	function tableSpec(figure) {
		if (onScreen.kind === 'pareto') return reasonsTable(figure);
		if (onScreen.kind === 'bullet') return regionsTable(figure);
		return monthsTable(figure);
	}

	function reasonsTable(figure) {
		let runningShare = 0;
		const rows = figure.reasons.map((reason) => {
			const share = (reason.value / (figure.value || 1)) * 100;
			runningShare += share;
			const running = percent(Math.min(100, runningShare));
			return {
				cells: [
					{ v: reason.label },
					{ v: reason.value, show: asCount(reason.value), cls: 'rd-strong' },
					{ v: percent(share), show: percent(share) },
					{ v: running, show: running, cls: 'rd-quiet rd-col-extra' },
				],
			};
		});
		return {
			title: `By reason, biggest first. ${spanLabel(figure.from, figure.to)}.`,
			head: [
				column('Reason', false),
				column('Accounts', true),
				column('Share', true),
				column('Running share', true, { cls: 'rd-col-extra' }),
			],
			rows,
			foot: ['Total', asCount(figure.value), '100%', ''],
		};
	}

	function signedPercent(amount) {
		return `${amount >= 0 ? '+' : '−'}${percent(Math.abs(amount))}`;
	}

	function regionsTable(figure) {
		const rows = figure.regions.map((region, index) => {
			const gap = ((region.value - region.goal) / region.goal) * 100;
			return {
				cells: [
					{ v: region.label, dot: rampVar(region.id, index) },
					{ v: region.value, show: asMoney(region.value, true), cls: 'rd-strong' },
					{ v: region.goal, show: asMoney(region.goal, true), cls: 'rd-quiet rd-col-extra' },
					{ v: percent(gap), show: signedPercent(gap), change: gap },
				],
			};
		});
		return {
			title: `By region. ${spanLabel(figure.from, figure.to)}.`,
			head: [
				column('Region', false),
				column('New MRR', true),
				column('Plan', true, { cls: 'rd-col-extra' }),
				column('Against plan', true),
			],
			rows,
			foot: [
				'Total',
				asMoney(figure.value, true),
				asMoney(figure.target, true),
				signedPercent(((figure.value - figure.target) / figure.target) * 100),
			],
		};
	}

	function monthsTable(figure) {
		const { metric } = figure;
		const definition = SAMPLE.metrics[metric];
		const isShare = onScreen.kind === 'share';
		const parts = figure.groups.length > 1 ? figure.groups : [];
		const compared = Boolean(figure.baseline) && !isShare;
		/* With every part in its own column there is no room left for the
       comparison's figures; the change column still compares. */
		const baselineColumn = compared && !parts.length;

		const head = [
			column('Month', false),
			...parts.map((group, index) =>
				column(group.label, true, { cls: 'rd-col-part', dot: rampVar(group.id, index) }),
			),
			column(parts.length ? 'Total' : definition.label, true),
		];
		if (baselineColumn) head.push(column(figure.baseline.name, true, { cls: 'rd-col-extra' }));
		if (compared) head.push(column('Change', true));
		else if (!isShare) head.push(column('On the month', true));

		const rows = figure.months
			.map((month, index) => {
				const amount = figure.totals[index];
				let reference;
				if (compared) reference = figure.baselineTotals[index];
				else if (index > 0) reference = figure.totals[index - 1];
				else reference = Math.round(addUp(figure.slices.map((slice) => pieceValue(slice, month - 1, metric))));
				const change = reference ? ((amount - reference) / Math.abs(reference)) * 100 : 0;

				const cells = [{ v: monthAndYear(month), month }];
				for (const group of parts) {
					const shown = isShare
						? percent(figure.shares[figure.groups.indexOf(group)][index])
						: display(metric, group.data[index], true);
					cells.push({ v: group.data[index], show: shown, cls: 'rd-col-part' });
				}
				cells.push({ v: amount, show: display(metric, amount, true), cls: 'rd-strong' });
				if (baselineColumn)
					cells.push({ v: reference, show: display(metric, reference, true), cls: 'rd-quiet rd-col-extra' });
				if (!isShare)
					cells.push({
						v: `${change.toFixed(1)}%`,
						show: signedPercent(change),
						change: definition.falling ? -change : change,
					});
				return { cells };
			})
			.reverse();
		rows[0].latest = true;

		let foot = null;
		if (definition.type === 'flow' && !isShare) {
			foot = [
				'Total',
				...parts.map((group) => display(metric, addUp(group.data), true)),
				display(metric, addUp(figure.totals), true),
			];
			if (baselineColumn) foot.push(display(metric, addUp(figure.baselineTotals), true));
			foot.push('');
		}
		const note = compared && !baselineColumn ? `, with the change on the ${figure.baseline.label}` : '';
		return {
			title: `By month, newest first. ${spanLabel(figure.from, figure.to)}${note}.`,
			head,
			rows,
			months: true,
			foot,
		};
	}

	function cellClass(extra, numeric) {
		return [numeric ? 'text-end' : '', extra || ''].join(' ').trim();
	}

	function classAttr(value) {
		return value ? ` class="${value}"` : '';
	}

	function swatch(color) {
		return color ? `<span class="rd-dot" style="--rd-c:${color}" aria-hidden="true"></span>` : '';
	}

	function fillNumbers() {
		const figure = current;
		const holder = pick('[data-rd="table"]');
		const toggle = pick('[data-rd-table-more]');
		if (figure.empty) {
			pick('[data-rd="table-desc"]').textContent = 'Nothing to show for these filters.';
			holder.innerHTML = '';
			toggle.hidden = true;
			return;
		}

		const spec = tableSpec(figure);
		const folds = spec.months && spec.rows.length > FOLDED_ROWS;
		const visible = spec.months && !tableExpanded ? spec.rows.slice(0, FOLDED_ROWS) : spec.rows;
		const wide = spec.head.filter((cell) => cell.cls === 'rd-col-part').length > 3;
		const showFoot = spec.foot && (!spec.months || tableExpanded || !folds);

		const headRow = spec.head
			.map(
				(cell) =>
					`<th scope="col"${classAttr(cellClass(cell.cls, cell.num))}>${swatch(cell.dot)}${htmlSafe(cell.label)}</th>`,
			)
			.join('');
		const bodyRows = visible
			.map(
				(row) =>
					`<tr>${row.cells.map((cell, index) => (index === 0 ? rowHeader(cell, row.latest) : dataCell(cell))).join('')}</tr>`,
			)
			.join('');
		const footRow = showFoot
			? `<tfoot><tr>${spec.foot
					.map((text, index) =>
						index === 0
							? `<th scope="row">${htmlSafe(text)}</th>`
							: `<td${classAttr(cellClass(spec.head[index].cls, true))}>${htmlSafe(text)}</td>`,
					)
					.join('')}</tr></tfoot>`
			: '';

		pick('[data-rd="table-desc"]').textContent = spec.title;
		holder.innerHTML = `<table class="table align-middle rd-table${wide ? ' rd-table-wide' : ''}">
      <caption class="visually-hidden">${htmlSafe(report.name)}: ${htmlSafe(spec.title)}</caption>
      <thead><tr>${headRow}</tr></thead>
      <tbody>${bodyRows}</tbody>
      ${footRow}
    </table>`;
		toggle.hidden = !folds;
		toggle.setAttribute('aria-expanded', String(tableExpanded));
		toggle.textContent = tableExpanded ? `Show the latest ${FOLDED_ROWS}` : `Show all ${spec.rows.length} months`;
	}

	function rowHeader(cell, latest) {
		const label =
			cell.month == null
				? htmlSafe(cell.v)
				: `<span class="rd-month rd-month-long">${htmlSafe(monthNameYear(cell.month))}</span><span class="rd-month rd-month-short">${htmlSafe(monthAndYear(cell.month))}</span>`;
		return `<th scope="row">${swatch(cell.dot)}${label}${latest ? '<span class="rd-latest">Latest</span>' : ''}</th>`;
	}

	function dataCell(cell) {
		const body =
			cell.change == null
				? htmlSafe(cell.show)
				: `<span class="rd-change ${cell.change >= 0 ? 'is-up' : 'is-down'}">${htmlSafe(cell.show)}</span>`;
		return `<td${classAttr(cellClass(cell.cls, true))}>${body}</td>`;
	}

	/* The CSV export writes the same rows the numbers table shows. */

	function exportNumbers() {
		if (current.empty) {
			notify({ tone: 'info', title: 'Nothing to export', text: 'There are no figures for these filters.' });
			return;
		}
		const fileName = `${fileSlug(report.name)}-${isoMonth(current.from)}-to-${isoMonth(current.to)}.csv`;
		const spec = tableSpec(current);
		saveCsv(
			[spec.head.map((cell) => cell.label), ...spec.rows.map((row) => row.cells.map((cell) => cell.v))],
			fileName,
		);
		record('bi-download', memberById(SAMPLE.me).name, 'exported the numbers as CSV');
		notify({ tone: 'success', title: 'Export ready', text: `${fileName} is in your downloads.` });
	}

	function isoMonth(index) {
		const date = monthStart(index);
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
	}

	function fileSlug(text) {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function csvField(value) {
		const text = String(value ?? '');
		return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
	}

	/** Hands the rows to the browser as a CSV download. */
	function saveCsv(rows, fileName) {
		const body = rows.map((row) => row.map(csvField).join(',')).join('\r\n');
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }));
		link.download = fileName;
		document.body.appendChild(link);
		link.click();
		setTimeout(() => {
			URL.revokeObjectURL(link.href);
			link.remove();
		}, 0);
	}

	/* The bridge card explains money through the MRR bridge and counts
     through accounts won and lost, over the chart's months and filters. */

	function fillBridge() {
		const figure = current;
		const inMoney = SAMPLE.metrics[figure.metric].unit === 'money';
		const anchor = inMoney ? 'mrr' : 'accounts';
		const across = (field) => addUp(figure.months.map((index) => totalAt(figure.slices, index, field)));

		const movements = inMoney
			? [
					{
						label: 'New accounts',
						note: 'First month on a paid plan',
						amount: across('added'),
						tone: 'series-1',
					},
					{
						label: 'Expansion',
						note: 'More seats and bigger plans',
						amount: across('grown'),
						tone: 'series-3',
					},
					{
						label: 'Downgrades',
						note: 'Fewer seats or a smaller plan',
						amount: -across('shrunk'),
						tone: 'warning',
					},
					{ label: 'Cancellations', note: 'Accounts that left', amount: -across('lost'), tone: 'danger' },
				]
			: [
					{
						label: 'New accounts',
						note: 'Started paying in the period',
						amount: across('accountsWon'),
						tone: 'series-1',
					},
					{
						label: 'Cancellations',
						note: 'Stopped paying in the period',
						amount: -across('accountsLost'),
						tone: 'danger',
					},
				];
		const opening = totalAt(figure.slices, figure.from, inMoney ? 'opening' : 'accountsBefore');
		const closing = totalAt(figure.slices, figure.to, inMoney ? 'mrr' : 'accounts');
		const widest = Math.max(...movements.map((step) => Math.abs(step.amount))) || 1;
		const net = closing - opening;

		pick('[data-rd="moves-title"]').textContent =
			figure.metric === anchor ? 'What moved it' : `What moved ${inMoney ? 'MRR' : 'paying accounts'}`;
		pick('[data-rd="moves-desc"]').textContent =
			`From ${display(anchor, opening)} at the start of ${monthAndYear(figure.from)} to ${display(anchor, closing)} at the end of ${monthAndYear(figure.to)}.`;
		pick('[data-rd="moves"]').innerHTML = movements
			.map(
				(step) => `<li class="rd-move rd-tone-${step.tone}">
        <span class="rd-move-text"><span class="rd-move-label">${htmlSafe(step.label)}</span><span class="rd-move-note">${htmlSafe(step.note)}</span></span>
        <span class="rd-move-track" aria-hidden="true"><span class="rd-move-bar" style="--rd-w:${Math.max(2, Math.round((Math.abs(step.amount) / widest) * 100))}%"></span></span>
        <span class="rd-move-value ${step.amount < 0 ? 'is-down' : 'is-up'}">${htmlSafe(withSign(anchor, step.amount))}</span>
      </li>`,
			)
			.join('');
		pick('[data-rd="moves-net"]').innerHTML =
			`<span>Net change</span><strong class="${net >= 0 ? 'is-up' : 'is-down'}">${htmlSafe(withSign(anchor, net))}</strong>`;
	}

	function splitItems(groups, total, metric) {
		return groups
			.map(
				(group, index) => `<li class="rd-split-row">
        <span class="rd-split-dot" style="--rd-c:${rampVar(group.id, index)}" aria-hidden="true"></span>
        <span class="rd-split-name">${htmlSafe(group.label)}</span>
        <span class="rd-split-value">${htmlSafe(display(metric, group.value))}</span>
        <span class="rd-split-share">${percent((group.value / (total || 1)) * 100, 0)}</span>
      </li>`,
			)
			.join('');
	}

	/*
	 * The same number cut the other way: by region when the report is
	 * already split by plan, by plan in every other case.
	 */
	function fillSplit() {
		const figure = current;
		const cut = onScreen.breakdown === 'plan' && onScreen.kind !== 'pareto' ? 'region' : 'plan';
		const cutName = SAMPLE.breakdowns[cut].toLowerCase();
		const metric = SAMPLE.metrics[figure.metric];
		const months = metric.type === 'stock' ? [figure.to] : figure.months;
		const groups = cutsFor(cut)
			.map((entry) => {
				const members = figure.slices.filter(entry.keep);
				const value = Math.round(
					addUp(
						months.map((index) => addUp(members.map((slice) => pieceValue(slice, index, figure.metric)))),
					),
				);
				return { id: entry.id, label: entry.label, value };
			})
			.filter((group) => group.value > 0);
		const total = addUp(groups.map((group) => group.value));

		pick('[data-rd="split-title"]').textContent = `By ${cutName}`;
		pick('[data-rd="split-desc"]').textContent =
			metric.type === 'stock'
				? `Where the ${metric.label} sits in ${monthNameYear(figure.to)}.`
				: `${metric.label}, ${spanLabel(figure.from, figure.to)}.`;
		const holder = pick('[data-rd="split-chart"]');
		pick('[data-rd="split-list"]').innerHTML = splitItems(groups, total, figure.metric);
		if (!total) {
			wipe(holder);
			return;
		}
		const label = `${metric.label} by ${cutName}: ${groups.map((group) => `${group.label} ${display(figure.metric, group.value)}`).join(', ')}.`;
		const caption = metric.type === 'stock' ? `in ${monthAndYear(figure.to)}` : 'in the period';
		plant(holder, label, (colors, animate) => CHARTS.ring(colors, figure, animate, groups, total, caption));
	}

	/* Cards that edit in place each hold a summary and a form. Edit shows
     the form; Save and Cancel bring the summary back and refocus Edit. */

	function panel(name) {
		const card = pick(`[data-rd-section="${name}"]`);
		return {
			card,
			display: pick('[data-rd-view]', card),
			form: pick('[data-rd-form]', card),
			trigger: pick('[data-rd-edit]', card),
		};
	}

	function beginEditing(target, prefill) {
		prefill();
		target.display.hidden = true;
		target.form.hidden = false;
		target.trigger.hidden = true;
		pick('input:not([type="hidden"]):not([type="radio"]), select, .basalt-tags-input', target.form)?.focus({
			preventScroll: true,
		});
	}

	function endEditing(name) {
		const target = panel(name);
		target.display.hidden = false;
		target.form.hidden = true;
		target.trigger.hidden = false;
		target.trigger.focus({ preventScroll: true });
	}

	/* The setup card holds the report's name, number, split, chart and defaults. */

	function setupField(key) {
		return pick(`[data-rd-setup="${key}"]`, setupPanel.form);
	}

	function fillSetupCard() {
		const facts = [
			['Description', report.summary || 'No description'],
			['Number', SAMPLE.metrics[report.metric].long],
			['Split by', SAMPLE.breakdowns[report.breakdown]],
			['Chart', SAMPLE.chartKinds[report.kind].label],
			['Period', SAMPLE.periods[report.period]],
			['Compare to', SAMPLE.compares[report.compare]],
			['Filters', filterSummary(report.filters)],
		];
		setupPanel.display.innerHTML = `<dl class="rd-facts">${facts.map(([term, detail]) => `<div><dt>${htmlSafe(term)}</dt><dd>${htmlSafe(detail)}</dd></div>`).join('')}</dl>`;
	}

	/* Each check answers with the message to show, or an empty string when the field is fine. */
	function splitIssue(metric, breakdown) {
		if (SAMPLE.allowedSplits[metric].includes(breakdown)) return '';
		return `${SAMPLE.metrics[metric].label} can’t be split by ${SAMPLE.breakdowns[breakdown].toLowerCase()}.`;
	}

	function chartIssue(kind, breakdown) {
		const needsSplit = kind === 'ring' || kind === 'bars' || kind === 'share';
		if (needsSplit && breakdown === 'none')
			return `Pick a split for a ${SAMPLE.chartKinds[kind].label.toLowerCase()} chart.`;
		if (kind === 'columns' && breakdown !== 'none') return 'Columns show one number: split by Nothing.';
		return '';
	}

	function flagField(key, message) {
		const field = setupField(key);
		const hint = setupField(`${key}-error`);
		field.classList.toggle('is-invalid', Boolean(message));
		if (message) field.setAttribute('aria-invalid', 'true');
		else field.removeAttribute('aria-invalid');
		hint.textContent = message;
		hint.hidden = !message;
		if (field.tagName === 'SELECT') syncPicker(field);
	}

	/** Shows every problem in the setup form and lists the fields that have one. */
	function validateSetup() {
		const locked = SAMPLE.chartKinds[report.kind].locked;
		const issues = {
			name: setupField('name').value.trim() ? '' : 'Give the report a name.',
			breakdown: locked ? '' : splitIssue(setupField('metric').value, setupField('breakdown').value),
			kind: locked ? '' : chartIssue(setupField('kind').value, setupField('breakdown').value),
		};
		for (const [key, message] of Object.entries(issues)) flagField(key, message);
		return Object.keys(issues).filter((key) => issues[key]);
	}

	function openSetup() {
		beginEditing(setupPanel, () => {
			const locked = SAMPLE.chartKinds[report.kind].locked;
			setupField('name').value = report.name;
			setupField('summary').value = report.summary;
			setupField('shape').hidden = Boolean(locked);
			setupField('fixed').hidden = !locked;
			for (const key of ['metric', 'breakdown', 'kind', 'period', 'compare']) {
				if (!locked || key === 'period' || key === 'compare') setupField(key).value = report[key];
				syncPicker(setupField(key));
			}
			for (const key of ['name', 'breakdown', 'kind']) flagField(key, '');
		});
	}

	function bindSetup() {
		setupPanel.trigger.addEventListener('click', openSetup);
		setupField('name').addEventListener('input', () => flagField('name', ''));

		/* Once a split or chart problem is showing, it clears or updates as the choices change. */
		setupPanel.form.addEventListener('change', (event) => {
			if (setupPanel.form.hidden) return;
			const key = event.target.getAttribute('data-rd-setup');
			if (!['metric', 'breakdown', 'kind'].includes(key)) return;
			const showing =
				setupField('breakdown').classList.contains('is-invalid') ||
				setupField('kind').classList.contains('is-invalid');
			if (!showing) return;
			flagField('breakdown', splitIssue(setupField('metric').value, setupField('breakdown').value));
			flagField('kind', chartIssue(setupField('kind').value, setupField('breakdown').value));
		});

		setupPanel.form.addEventListener('submit', (event) => {
			event.preventDefault();
			const [firstProblem] = validateSetup();
			if (firstProblem) {
				/* An enhanced select is operated through the trigger button next to it. */
				const field = setupField(firstProblem);
				const trigger = [field.previousElementSibling, field.nextElementSibling].find((node) =>
					node?.classList.contains('basalt-select-trigger'),
				);
				(trigger || field).focus();
				return;
			}
			const locked = SAMPLE.chartKinds[report.kind].locked;
			Object.assign(report, {
				name: setupField('name').value.trim(),
				summary: setupField('summary').value.trim(),
				period: setupField('period').value,
				compare: setupField('compare').value,
				updated: SAMPLE.now.slice(0, 10),
			});
			if (!locked) {
				Object.assign(report, {
					metric: setupField('metric').value,
					breakdown: setupField('breakdown').value,
					kind: setupField('kind').value,
				});
			}
			onScreen = viewFrom(report);
			backend.save(report);
			record('bi-sliders', memberById(SAMPLE.me).name, 'changed the report setup');
			fillHero();
			fillSetupCard();
			redrawView();
			endEditing('setup');
			notify({ tone: 'success', title: 'Report saved', text: `${report.name} now opens with these settings.` });
		});
	}

	/* The schedule card says when the report is emailed and to whom. */

	function scheduleField(key) {
		return pick(`[data-rd-sched="${key}"]`, schedulePanel.card);
	}

	/**
	 * The next (or, with backwards set, the most recent) send times of a
	 * schedule relative to a moment, at most `limit` of them.
	 */
	function sendTimes(schedule, from, limit, backwards) {
		const found = [];
		if (!schedule) return found;
		const [hours, minutes] = schedule.time.split(':').map(Number);
		const isSendDay = SEND_DAY[schedule.cadence] || SEND_DAY.monthly;
		const cursor = new Date(from);
		cursor.setHours(hours, minutes, 0, 0);
		for (let tries = 0; tries < 400 && found.length < limit; tries += 1) {
			const onTheRightSide = backwards ? cursor < from : cursor > from;
			if (isSendDay(cursor, schedule) && onTheRightSide) found.push(new Date(cursor));
			cursor.setDate(cursor.getDate() + (backwards ? -1 : 1));
		}
		return found;
	}

	function fillScheduleCard() {
		const schedule = report.schedule;
		const holder = schedulePanel.display;
		schedulePanel.trigger.innerHTML = schedule
			? '<i class="bi bi-pencil me-1" aria-hidden="true"></i>Edit'
			: '<i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Set up';

		if (!schedule) {
			holder.innerHTML = `<div class="rd-off">
        <span class="rd-off-icon" aria-hidden="true"><i class="bi bi-envelope-paper"></i></span>
        <p class="rd-off-title">Not sent on a schedule</p>
        <p class="rd-off-text">Email it to the team on a regular day, as a PDF, a CSV or a link.</p>
      </div>`;
			return;
		}

		const recipients = schedule.to.length;
		const how = schedule.format === 'Link' ? 'A link to the live report' : `As a ${htmlSafe(schedule.format)}`;
		const upcoming = sendTimes(schedule, asOf, 3)
			.map(
				(moment, index) =>
					`<li class="rd-send${index === 0 ? ' is-next' : ''}">` +
					`<span class="rd-send-day">${htmlSafe(moment.toLocaleDateString('en-US', { weekday: 'short' }))}</span>` +
					`<span class="rd-send-date">${htmlSafe(moment.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}</span>` +
					`<span class="rd-send-time">${htmlSafe(clockLabel(moment))}</span></li>`,
			)
			.join('');
		const people = schedule.to
			.map((name) => {
				const member = memberNamed(name);
				const shownName = member
					? `<a class="rd-link" href="employee-user-details.html">${htmlSafe(name)}</a>`
					: htmlSafe(name);
				const role = member ? `<span class="rd-person-role">${htmlSafe(member.role)}</span>` : '';
				return `<li class="rd-person">${avatarHtml(name)}<span class="rd-person-text"><span class="rd-person-name">${shownName}</span>${role}</span></li>`;
			})
			.join('');

		holder.innerHTML = `<div class="rd-when">
        <span class="rd-when-icon" aria-hidden="true"><i class="bi bi-envelope-check"></i></span>
        <span class="rd-when-text"><span class="rd-when-main">${htmlSafe(cadenceLabel(schedule))}</span><span class="rd-when-sub">${how}, to ${recipients} ${recipients === 1 ? 'person' : 'people'}</span></span>
      </div>
      <h3 class="rd-sub">Next sends</h3>
      <ol class="rd-sends">${upcoming}</ol>
      <h3 class="rd-sub">Sent to</h3>
      <ul class="rd-people rd-people-compact">${people}</ul>`;
	}

	/** Rebuilds the day picker for a cadence; a daily schedule hides it. */
	function fillDayPicker(cadence, chosen) {
		const picker = scheduleField('day');
		scheduleField('day-wrap').hidden = cadence === 'daily';
		if (cadence === 'weekly') {
			scheduleField('day-label').textContent = 'Day of the week';
			picker.innerHTML = WEEKDAYS.slice(1, 6)
				.map((name, offset) => {
					const value = offset + 1;
					return `<option value="${value}"${value === chosen ? ' selected' : ''}>${name}</option>`;
				})
				.join('');
		} else if (cadence === 'monthly') {
			scheduleField('day-label').textContent = 'Day of the month';
			picker.innerHTML = [1, 2, 3, 5, 10, 15, 20, 25]
				.map((day) => `<option value="${day}"${day === chosen ? ' selected' : ''}>${nth(day)}</option>`)
				.join('');
		}
		syncPicker(picker);
	}

	function checkRadios(name, value) {
		for (const radio of pickAll(`input[name="${name}"]`, schedulePanel.form)) radio.checked = radio.value === value;
	}

	function checkedRadio(name) {
		return pick(`input[name="${name}"]:checked`, schedulePanel.form)?.value;
	}

	function openSchedule() {
		beginEditing(schedulePanel, () => {
			const schedule = report.schedule || {
				cadence: 'weekly',
				day: 1,
				time: '08:00',
				to: [memberById(SAMPLE.me).name],
				format: 'PDF',
			};
			checkRadios('rdCadence', schedule.cadence);
			for (const group of pickAll('[data-basalt-segmented]', schedulePanel.form)) {
				group.dispatchEvent(new Event('change', { bubbles: true }));
			}
			fillDayPicker(schedule.cadence, schedule.day);
			scheduleField('time').value = schedule.time;
			syncPicker(scheduleField('time'));
			checkRadios('rdFormat', schedule.format);
			scheduleField('tags').basaltTags?.set(schedule.to);
			scheduleField('error').hidden = true;
			scheduleField('stop').hidden = !report.schedule;
		});
	}

	/** Redraws the two places a schedule shows: its card and the header tags. */
	function afterScheduleChange() {
		fillScheduleCard();
		fillHero();
	}

	function bindSchedule() {
		schedulePanel.trigger.addEventListener('click', openSchedule);

		schedulePanel.form.addEventListener('change', (event) => {
			if (event.target.name === 'rdCadence') fillDayPicker(event.target.value, 1);
			if (event.target.closest('[data-rd-sched="tags"]')) scheduleField('error').hidden = true;
		});

		schedulePanel.form.addEventListener('submit', (event) => {
			event.preventDefault();
			const recipients = scheduleField('tags').basaltTags?.get() ?? [];
			if (!recipients.length) {
				scheduleField('error').hidden = false;
				pick('.basalt-tags-input', schedulePanel.form).focus();
				return;
			}
			report.schedule = {
				cadence: checkedRadio('rdCadence') || 'weekly',
				day: Number(scheduleField('day').value) || 1,
				time: scheduleField('time').value,
				to: recipients,
				format: checkedRadio('rdFormat') || 'PDF',
			};
			backend.schedule(report.id, report.schedule);
			const phrase = cadenceLabel(report.schedule).replace(/^E/, 'e').replace(/^O/, 'o');
			record('bi-envelope-paper', memberById(SAMPLE.me).name, `set it to go out ${phrase}`);
			afterScheduleChange();
			endEditing('schedule');
			const [firstSend] = sendTimes(report.schedule, asOf, 1);
			const when = firstSend
				? `${firstSend.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${clockLabel(firstSend)}`
				: 'soon';
			notify({
				tone: 'success',
				icon: 'bi-envelope-check',
				title: 'Schedule saved',
				text: `First send ${when}.`,
			});
		});

		scheduleField('stop').addEventListener('click', () => {
			const previous = report.schedule;
			report.schedule = null;
			backend.schedule(report.id, null);
			record('bi-envelope-x', memberById(SAMPLE.me).name, 'stopped the scheduled email');
			afterScheduleChange();
			endEditing('schedule');
			const undo = () => {
				report.schedule = previous;
				backend.schedule(report.id, previous);
				afterScheduleChange();
			};
			notify({
				tone: 'info',
				icon: 'bi-envelope-x',
				title: 'No longer sent',
				text: report.name,
				actions: [{ label: 'Undo', onClick: undo }],
			});
		});
	}

	/* The sharing card lists who can open the report and how. */

	function shareField(key) {
		return pick(`[data-rd-share="${key}"]`, sharePanel.card);
	}

	function personRow(member, badge) {
		const name =
			member.id === 'tpl'
				? htmlSafe(member.name)
				: `<a class="rd-link" href="employee-user-details.html">${htmlSafe(member.name)}</a>`;
		return `<li class="rd-person">${avatarHtml(member.name)}<span class="rd-person-text"><span class="rd-person-name">${name}</span><span class="rd-person-role">${htmlSafe(member.role)}</span></span>${badge}</li>`;
	}

	function linkStatus(isTemplate, linkOn) {
		if (isTemplate) return 'A template: everyone in the workspace can open it and make their own copy.';
		return linkOn ? 'Anyone in the workspace with the link can view it.' : 'Only the people listed can open it.';
	}

	function fillSharingCard() {
		const sharing = report.share;
		const isTemplate = report.owner === 'tpl';
		const rights = sharing.access === 'edit' ? 'Can edit' : 'Can view';
		const ownerBadge = `<span class="rd-access rd-access-owner">${isTemplate ? 'Everyone' : 'Owner'}</span>`;
		const others = sharing.people
			.map((id) => personRow(memberById(id), `<span class="rd-access">${rights}</span>`))
			.join('');
		const icon = isTemplate || sharing.link ? 'bi-link-45deg' : 'bi-lock';

		sharePanel.display.innerHTML = `<ul class="rd-people">
        ${personRow(memberById(report.owner), ownerBadge)}
        ${others}
      </ul>
      ${sharing.people.length || isTemplate ? '' : '<p class="rd-note">Nobody else can open it yet.</p>'}
      <p class="rd-link-state"><i class="bi ${icon}" aria-hidden="true"></i>${linkStatus(isTemplate, sharing.link)}</p>`;
	}

	function openSharing() {
		beginEditing(sharePanel, () => {
			for (const option of shareField('people').options)
				option.selected = report.share.people.includes(option.value);
			syncPicker(shareField('people'));
			shareField('access').value = report.share.access;
			syncPicker(shareField('access'));
			shareField('link').checked = report.share.link;
		});
	}

	function bindSharing() {
		sharePanel.trigger.addEventListener('click', openSharing);
		sharePanel.form.addEventListener('submit', (event) => {
			event.preventDefault();
			const earlier = report.share.people.slice();
			report.share = {
				people: [...shareField('people').selectedOptions].map((option) => option.value),
				access: shareField('access').value,
				link: shareField('link').checked,
			};
			backend.share(report.id, report.share);
			const newcomers = report.share.people
				.filter((id) => !earlier.includes(id))
				.map((id) => memberById(id).name);
			record(
				'bi-people',
				memberById(SAMPLE.me).name,
				newcomers.length ? `shared it with ${joinNames(newcomers)}` : 'changed who can open it',
			);
			fillSharingCard();
			fillHero();
			endEditing('share');

			const count = report.share.people.length;
			const text = count
				? `Shared with ${count}${count === 1 ? ' person.' : ' people.'}`
				: `Only the owner can open it${report.share.link ? ', and anyone with the link.' : '.'}`;
			notify({ tone: 'success', icon: 'bi-people', title: 'Sharing saved', text });
		});
	}

	/* The activity feed lists sends, edits and exports, newest first. */

	/**
	 * A believable history for a report that has none in SAMPLE.activity:
	 * its last two sends, who it was shared with, its last change and the
	 * day it was made.
	 */
	function fallbackHistory(entry) {
		const ownerName = memberById(entry.owner).name;
		const isTemplate = entry.owner === 'tpl';
		const created = new Date(`${entry.updated}T10:20`);
		created.setMonth(created.getMonth() - 7);

		const history = sendTimes(entry.schedule, asOf, 2, true).map((moment) => ({
			at: moment.toISOString(),
			icon: 'bi-envelope-check',
			who: '',
			text: deliveryLabel(entry.schedule),
		}));
		history.push({
			at: `${entry.updated}T15:30`,
			icon: 'bi-sliders',
			who: isTemplate ? '' : ownerName,
			text: isTemplate ? 'Template updated with the latest plans and regions' : 'changed the report setup',
		});
		if (entry.share.people.length) {
			history.push({
				at: `${entry.updated}T11:05`,
				icon: 'bi-people',
				who: ownerName,
				text: `shared it with ${joinNames(entry.share.people.map((id) => memberById(id).name))}`,
			});
		}
		history.push({
			at: created.toISOString(),
			icon: 'bi-plus-lg',
			who: isTemplate ? '' : ownerName,
			text: isTemplate ? 'Added as a ready-made report' : 'created the report',
		});
		return history.sort((a, b) => new Date(b.at) - new Date(a.at));
	}

	/** Adds a fresh event to the top of the feed and redraws it. */
	function record(icon, who, text) {
		events.unshift({ at: SAMPLE.now, icon, who, text, fresh: true });
		fillActivity();
	}

	function eventTime(entry) {
		if (entry.fresh) return 'Just now';
		const moment = new Date(entry.at);
		const year = moment.getFullYear() === asOf.getFullYear() ? undefined : 'numeric';
		return `${moment.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year })}, ${clockLabel(moment)}`;
	}

	function fillActivity() {
		const shown = feedExpanded ? events : events.slice(0, FEED_PREVIEW);
		pick('[data-rd="activity"]').innerHTML = shown
			.map(
				(entry) => `<li class="rd-feed-item rd-feed-${EVENT_TONE[entry.icon] || 'muted'}">
        <span class="rd-feed-icon" aria-hidden="true"><i class="bi ${entry.icon}"></i></span>
        <span class="rd-feed-text"><span>${entry.who ? `<strong>${htmlSafe(entry.who)}</strong> ` : ''}${htmlSafe(entry.text)}</span><span class="rd-feed-time">${htmlSafe(eventTime(entry))}</span></span>
      </li>`,
			)
			.join('');

		const toggle = pick('[data-rd-feed-more]');
		toggle.hidden = events.length <= FEED_PREVIEW;
		toggle.setAttribute('aria-expanded', String(feedExpanded));
		toggle.textContent = feedExpanded ? 'Show fewer' : `See all ${events.length}`;
	}

	function bindFeed() {
		pick('[data-rd-feed-more]').addEventListener('click', () => {
			window.Basalt.slide(pick('[data-rd="activity"]'), () => {
				feedExpanded = !feedExpanded;
				fillActivity();
			});
		});
	}

	start();
})();
