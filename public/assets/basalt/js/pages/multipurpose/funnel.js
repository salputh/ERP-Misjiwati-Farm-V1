/**
 * Conversion funnel, used by funnel.html. It follows the people
 * who reach the Fieldline website through sign-up, activation and a trial
 * to their first paid invoice, and shows where each group falls away and
 * how long every stage takes. Fieldline schedules crews that work on site.
 *
 * Bringing in real numbers: backend.load() is the single source for the
 * page. Point it at your server and answer with the same report shape, and
 * every tile, chart and table follows, so no two totals can disagree.
 * backend.download() is handed the rows behind each export button.
 *
 * Leans on basalt.js for the segmented switches, styled selects, filter
 * chips, pagination, drawer, tooltips, toasts, skeletons and empty states;
 * the charts are set up the way the chart pages set theirs up.
 */
(() => {
	'use strict';

	const shell = pick('[data-fa-root]', document);
	if (!shell) return;

	const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const TYPEFACE = "'Schibsted Grotesk', sans-serif";

	/* Sample figures. Fieldline sells seats on three plans (Basic $15, Pro
     $32, Max $58 a month, two months free when paid yearly). Data runs
     from Oct 1, 2024 to Sep 30, 2026, and every day is drawn from a seeded
     formula, so a given range gives the same answer on every visit. */
	const SAMPLE = {
		opens: '2024-10-01',
		closes: '2026-09-30',
		stages: [
			{
				id: 'visit',
				title: 'Visited the website',
				tag: 'Visits',
				help: 'Anyone who opened a page on the marketing site.',
			},
			{
				id: 'signup',
				title: 'Signed up',
				tag: 'Sign-ups',
				help: 'Created a Fieldline account with a work email address.',
			},
			{
				id: 'activated',
				title: 'Activated',
				tag: 'Activated',
				help: 'Added a team member and booked a first visit on the scheduling board.',
			},
			{ id: 'trial', title: 'Started a trial', tag: 'Trials', help: 'Began the 14-day trial of a paid plan.' },
			{ id: 'paid', title: 'Became a customer', tag: 'Paid', help: 'Paid a first invoice, monthly or annual.' },
		],
		/* The chance an average visitor moves on from each stage, set so the
       past year reads 18% trial to paid and September 2026 brings 3,850
       sign-ups, followed by how far each chance climbs in a year. */
		odds: [0.058, 0.42, 0.24, 0.1422],
		oddsGrowth: [0.05, 0.06, 0.04, 0.02],
		/* Weekday traffic in October 2024 and its growth per year, then the
       shape of a week (starting on Sunday) and of a year by month. */
		visitsPerDay: 1372.3,
		visitGrowth: 0.22,
		byWeekday: [0.58, 1.06, 1.1, 1.08, 1.04, 0.94, 0.52],
		byMonth: [0.94, 1.0, 1.04, 1.02, 1.0, 0.95, 0.88, 0.86, 1.05, 1.08, 1.04, 0.82],
		/* Every group carries its slice of the traffic and, per stage, how it
       converts next to the average visitor, where 1 means average. */
		groups: {
			source: [
				{ id: 'organic', label: 'Organic search', weight: 0.35, lift: [1, 1, 1, 1] },
				{ id: 'paid', label: 'Paid search', weight: 0.22, lift: [1.12, 0.84, 0.92, 0.8] },
				{ id: 'direct', label: 'Direct', weight: 0.18, lift: [0.9, 1.1, 1.05, 1.12] },
				{ id: 'referral', label: 'Referral', weight: 0.12, lift: [1.32, 1.18, 1.08, 1.22] },
				{ id: 'partner', label: 'Partner', weight: 0.08, lift: [1.45, 1.24, 1.16, 1.3] },
				{ id: 'social', label: 'Social', weight: 0.05, lift: [0.68, 0.76, 0.82, 0.72] },
			],
			device: [
				{ id: 'desktop', label: 'Desktop', weight: 0.6, lift: [1.14, 1.13, 1.04, 1.04] },
				{ id: 'mobile', label: 'Mobile', weight: 0.34, lift: [0.74, 0.68, 0.88, 0.9] },
				{ id: 'tablet', label: 'Tablet', weight: 0.06, lift: [0.92, 0.9, 0.96, 0.95] },
			],
			region: [
				{ id: 'northeast', label: 'Northeast', weight: 0.41, lift: [1.05, 1.02, 1, 1.08] },
				{ id: 'midwest', label: 'Midwest', weight: 0.33, lift: [1, 1.04, 1.02, 1] },
				{ id: 'west', label: 'West', weight: 0.17, lift: [0.93, 0.86, 0.96, 0.86] },
				{ id: 'south', label: 'South', weight: 0.09, lift: [0.86, 0.92, 0.94, 0.74] },
			],
			/* Which pricing page the visitor opened before any other. */
			plan: [
				{ id: 'starter', label: 'Basic', weight: 0.52, lift: [1.1, 1, 0.92, 0.84] },
				{ id: 'growth', label: 'Pro', weight: 0.38, lift: [0.95, 1.04, 1.1, 1.16] },
				{ id: 'enterprise', label: 'Max', weight: 0.1, lift: [0.62, 1.1, 1.22, 1.34] },
			],
			segment: [
				{ id: 'self', label: 'Self-serve', lift: [1, 1, 1, 1] },
				{ id: 'sales', label: 'Sales-led', lift: [0.82, 1.36, 1.28, 1.62] },
			],
		},
		/* How much of each plan's traffic the sales team handles. Basic never
       goes through sales, which is why Basic plus Sales-led comes up empty. */
		salesCut: { starter: 0, growth: 0.16, enterprise: 0.58 },
		/* Days spent between two stages by an average visitor, given as the
       first quartile, the median and the third quartile. */
		waits: [
			[0.05, 0.9, 5.4],
			[0.2, 1.1, 4.2],
			[0.8, 2.6, 7.4],
			[6.4, 11.2, 13.8],
		],
		/* Groups that move more slowly, as factors on each of the four waits. */
		slowdown: {
			mobile: [1.1, 1.5, 1.12, 1],
			tablet: [1, 1.2, 1.05, 1],
			sales: [1.25, 1.6, 1.9, 1.45],
			enterprise: [1.3, 1.3, 1.5, 1.35],
			west: [1, 1.15, 1.05, 1.05],
		},
		/* Advice for a leak, one list per stage gap (gap 0 is visit to sign-up).
       A group with no line of its own gets the fallback, and {name} turns
       into the group's label. */
		fixes: [
			{
				mobile: 'People read the site on their phone but leave before signing up. Offer to email them a sign-up link to open later on a computer.',
				social: 'Social ads land on the home page. Send each ad to a page about the one feature it shows, with the sign-up form near the top.',
				enterprise:
					'Max visitors want to talk first. Put a "Get a demo" button next to sign-up on the Enterprise page.',
				fallback:
					'Shorten sign-up for {name} visitors to a work email and password, and ask for the company name later.',
			},
			{
				mobile: 'Building a scheduling board on a phone is slow going. Let mobile sign-ups skip setup and send a link to finish on a computer.',
				west: 'Setup emails reach the {name} before the workday starts. Send them at nine in the morning Pacific time, and add a short video to the guide.',
				paid: 'Paid search brings people who sign up and never come back. Bid less on broad terms and more on searches that name the problem you solve.',
				fallback:
					'{name} sign-ups stall before their first booked visit. Start them with sample staff and visits, and send a reminder after one day.',
			},
			{
				starter:
					'Activated Basic accounts put off the trial. Start it for them when they book a tenth visit, with the $15 seat price beside the button.',
				fallback:
					'Activated {name} accounts do not start a trial. Show what Travel Planner and the Customer Portal add once they have booked ten visits.',
			},
			{
				south: 'Card payments fail more often in the {name}. Offer invoicing and ACH bank payments at checkout.',
				paid: 'Trials from paid search end without a purchase. Send a check-in on day ten and offer a one-week extension to accounts with three or more staff.',
				starter:
					'Basic trials end quietly. Remind them on day twelve with what they would lose, and offer annual billing at two months free.',
				fallback:
					'{name} trials end without a purchase. Send a check-in on day ten and offer a one-week extension to accounts that added three staff or more.',
			},
		],
	};

	/* Demo only: add ?state=error, ?state=empty or ?state=loading to the
     address to see the other states. Take it out once a server answers. */
	const forcedState = new URLSearchParams(location.search).get('state') || '';

	const LADDER = SAMPLE.stages;
	const FILTER_KEYS = ['plan', 'region', 'segment'];
	const GAPS = [0, 1, 2, 3];
	const NO_SLOWDOWN = [1, 1, 1, 1];
	const DAY_MS = 864e5;
	const MINUS = '−';
	const FIRST_DAY = dayNumber(SAMPLE.opens);
	const LAST_DAY = dayNumber(SAMPLE.closes);

	/* Every mix of source, device, region, plan and segment that someone
     actually falls into, with its traffic share and stage chances. */
	const combos = buildCombos();

	const DAY_FORMATS = {
		short: { month: 'short', day: 'numeric' },
		long: { month: 'short', day: 'numeric', year: 'numeric' },
		month: { month: 'short', year: '2-digit' },
	};

	/* The comparison choices. "No comparison" has no entry, so it shifts to
     nothing but still borrows the wording of the previous period. */
	const COMPARISONS = {
		previous: {
			label: 'Previous period',
			phrase: 'the previous period',
			shift: (start, end) => ({ start: start - (end - start + 1), end: start - 1 }),
		},
		year: {
			label: 'Same period last year',
			phrase: 'last year',
			shift: (start, end) => ({ start: start - 364, end: end - 364 }),
		},
	};

	/* The headline tiles. A tile with `from` is the rate between two
     stages; one without it counts the people at a single stage. */
	const FIGURES = [
		{ label: 'New paying customers', stage: 4 },
		{ label: 'Visit to paid', stage: 4, from: 0, places: 2 },
		{ label: 'Website visits', stage: 0 },
		{ label: 'Sign-up rate', stage: 1, from: 0, places: 1 },
		{ label: 'Trial to paid', stage: 4, from: 3, places: 1 },
	];

	const MOVES = {
		flat: { tone: '', icon: 'bi-dash', said: 'No change' },
		up: { tone: 'is-up', icon: 'bi-arrow-up-right', said: 'Up' },
		down: { tone: 'is-down', icon: 'bi-arrow-down-right', said: 'Down' },
	};

	const CHART_SPECS = { timing: timingChart, trend: trendChart, groups: groupChart, sources: sourceChart };
	const TICK_FONT = { family: TYPEFACE, size: 11.5 };

	/* Sort keys of the drill-down that point at a stage count. */
	const STAGE_COLUMN = { visit: 0, signup: 1, activated: 2, trial: 3, paid: 4 };
	const BREAKDOWNS = [
		['source', 'Source'],
		['device', 'Device'],
		['region', 'Region'],
	];
	const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	/* Clicks anywhere in the page go through this list; the first selector
     the click lands inside decides what happens. */
	const CLICK_ACTIONS = [
		['[data-fa-step]', (hit) => explainDrop(Number(hit.getAttribute('data-fa-step')))],
		['[data-fa-leak]', (hit) => explainLeak(Number(hit.getAttribute('data-fa-leak')))],
		['[data-fa-search-clear]', clearSearch],
		['[data-fa-row]', (hit) => explainRow(hit.getAttribute('data-fa-row'))],
		['th[data-fa-sort] .fa-sort', (hit) => toggleSort(hit.closest('th').getAttribute('data-fa-sort'))],
		['[data-fa-export]', exportFrom],
	];

	const ui = {
		span: '365',
		customSpan: { start: dayNumber('2026-08-01'), end: LAST_DAY },
		compareTo: 'previous',
		filters: { plan: '', region: '', segment: '' },
		splitBy: 'segment',
		current: null,
		previous: null,
		order: { column: 'paid', direction: 'desc' },
		search: '',
		page: 1,
		perPage: 10,
		rows: [],
		leaks: [],
	};

	const liveCharts = new Map();
	const onScreen = new Set();
	const drawer = document.getElementById('fa-drawer');
	const drawerExport = { rows: [], name: 'funnel' };
	let pagination = null;
	let latest = 0;
	let requestCount = 0;
	let figuresCounted = false;
	let arrivalsSet = false;

	/* Where a real server plugs in. Both calls return a Promise; the demo
     answers from SAMPLE after a short pause. Swap the bodies for fetch()
     and keep the shapes. */
	const backend = {
		/* GET /api/funnel?from=&to=&compareFrom=&compareTo=&plan=&region=&segment=
       range is { from, to, compare: { from, to } | null } in ISO dates.
       Resolves to { current, previous }; each is a report holding parts
       (one per group mix, with people at every stage), reach, series and
       waits, and previous is null without a comparison. */
		load(range, filters) {
			requestCount += 1;
			return pause(forcedState === 'loading' ? 1e9 : 420).then(() => {
				if (forcedState === 'error' && requestCount === 1)
					throw new Error('The analytics service did not answer');
				const blank = forcedState === 'empty';
				const current = buildReport(dayNumber(range.from), dayNumber(range.to), filters, blank);
				const previous = range.compare
					? buildReport(dayNumber(range.compare.from), dayNumber(range.compare.to), filters, blank)
					: null;
				return { current, previous };
			});
		},
		/* POST /api/exports with { name, rows }, answered with a file. The demo
       writes the CSV in the browser instead. */
		download(name, rows) {
			const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
			const href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
			const link = Object.assign(document.createElement('a'), { href, download: `${name}.csv` });
			document.body.append(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(href), 1000);
			return Promise.resolve({ name: link.download, rows: rows.length - 1 });
		},
	};

	/** Fills the filter menus, binds every control, then asks for the first report. */
	function start() {
		addFilterOptions();
		watchCharts();
		bindControls();
		bindTable();
		bindClicks();
		bindDrawer();
		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() => redrawOnScreen(false));
		});
		requestReport();
	}

	/* Asking for a report and showing the answer. */

	/**
	 * Requests the report for the current controls. A newer request makes
	 * any older answer stale, so only the latest one is ever drawn.
	 */
	function requestReport() {
		const range = activeRange();
		const ticket = ++latest;
		paintChips();
		const against = range.against ? `, against ${rangeText(range.against.start, range.against.end)}` : '';
		pick('[data-fa-period]').textContent = `Showing ${rangeText(range.start, range.end)}${against}`;
		markLoading();
		showNotice(null);
		const filters = { ...ui.filters };
		const request = {
			from: isoDay(range.start),
			to: isoDay(range.end),
			compare: range.against ? { from: isoDay(range.against.start), to: isoDay(range.against.end) } : null,
		};
		backend
			.load(request, filters)
			.then((answer) => {
				if (ticket === latest) receive(answer, filters);
			})
			.catch(() => {
				if (ticket !== latest) return;
				shell.classList.remove('is-loading');
				showNotice('error');
			});
	}

	function receive(answer, filters) {
		shell.classList.remove('is-loading');
		pick('[data-fa-report]').setAttribute('aria-busy', 'false');
		if (!answer.current.reach[0]) {
			showNothing(filters);
			return;
		}
		ui.current = answer.current;
		ui.previous = answer.previous;
		ui.page = 1;
		paintAll();
		window.Basalt.announce?.(
			`Funnel updated: ${whole(ui.current.reach[4])} paying customers from ${whole(ui.current.reach[0])} visits`,
		);
	}

	function showNothing(filters) {
		ui.current = null;
		const narrowed = FILTER_KEYS.some((key) => filters[key]);
		pick('[data-fa-empty-text]').textContent = narrowed
			? 'Nobody in this date range matches all of these filters. Basic, for one, is self-serve only.'
			: 'There were no visits in this date range.';
		pick('[data-fa-clear]').hidden = !narrowed;
		showNotice('empty');
		window.Basalt.announce?.('No visitors match these filters');
	}

	/** Swaps the report for the error or empty card, or (with null) brings it back. */
	function showNotice(which) {
		pick('[data-fa-state]').hidden = !which;
		pick('[data-fa-error]').hidden = which !== 'error';
		pick('[data-fa-empty]').hidden = which !== 'empty';
		pick('[data-fa-report]').hidden = Boolean(which);
	}

	/* While a request runs the page dims; on the very first one, with
     nothing drawn yet, skeletons hold the places of the real rows. */
	function markLoading() {
		shell.classList.add('is-loading');
		pick('[data-fa-report]').setAttribute('aria-busy', 'true');
		if (ui.current) return;
		paintFigureSkeletons();
		pick('[data-fa-steps]').innerHTML = LADDER.map(
			() =>
				'<tr aria-hidden="true"><td colspan="5"><span class="basalt-skeleton basalt-skeleton-text"></span></td></tr>',
		).join('');
		pick('[data-fa-leaks]').innerHTML = [0, 1, 2]
			.map(
				() =>
					'<li aria-hidden="true"><span class="basalt-skeleton basalt-skeleton-block fa-skel-leak"></span></li>',
			)
			.join('');
		pick('[data-fa-rows]').innerHTML = [0, 1, 2, 3, 4]
			.map(
				() =>
					'<tr aria-hidden="true"><td colspan="9"><span class="basalt-skeleton basalt-skeleton-text"></span></td></tr>',
			)
			.join('');
	}

	function paintAll() {
		paintFigures();
		paintStages();
		paintKeys();
		paintNumbers();
		paintLeaks();
		paintRows();
		redrawOnScreen(true);
		if (!arrivalsSet) {
			arrivalsSet = true;
			setArrivals();
		}
	}

	/* The first report plays in as each card comes into view: the step bars
     fill one stage after another while their numbers count up, and the
     leaks rise in rank order. Later reports and reduced motion show
     everything at rest. */

	function setArrivals() {
		const steps = pick('[data-fa-steps]');
		onFirstSight(steps, () => {
			arrive(steps);
			window.Basalt.countUp?.(pickAll('.fa-step-num', steps));
		});
		const leaks = pick('[data-fa-leaks]');
		onFirstSight(leaks, () => {
			arrive(leaks);
			window.Basalt.countUp?.(pickAll('.fa-leak-gain', leaks));
		});
	}

	/** Runs play once, the first time box is mostly on screen. */
	function onFirstSight(box, play) {
		if (calm || !window.IntersectionObserver) return;
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				play();
			},
			{ threshold: 0.35 },
		);
		watch.observe(box);
	}

	/** Lets the children of list play in turn, then leaves them as drawn. */
	function arrive(list) {
		Array.from(list.children).forEach((item, at) => item.style.setProperty('--fa-at', Math.min(at, 10)));
		list.classList.add('is-arriving');
		const runs = list.getAnimations({ subtree: true }).map((run) => run.finished);
		Promise.allSettled(runs).then(() => {
			list.classList.remove('is-arriving');
			for (const item of list.children) item.style.removeProperty('--fa-at');
		});
	}

	/* Date range, comparison and filter controls. */

	function bindControls() {
		const customForm = pick('[data-fa-custom]');
		const startField = pick('#fa-from');
		const endField = pick('#fa-to');
		const customError = pick('[data-fa-custom-error]');

		pick('[data-fa-range]').addEventListener('change', (event) => {
			const choice = event.target.value;
			customForm.hidden = choice !== 'custom';
			ui.span = choice;
			if (choice === 'custom') startField.focus();
			requestReport();
		});

		customForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const start = startField.value ? dayNumber(startField.value) : NaN;
			const end = endField.value ? dayNumber(endField.value) : NaN;
			const problem = dateProblem(start, end);
			customError.hidden = !problem;
			customError.textContent = problem;
			for (const field of [startField, endField]) {
				field.classList.toggle('is-invalid', Boolean(problem));
				if (problem) field.setAttribute('aria-invalid', 'true');
				else field.removeAttribute('aria-invalid');
			}
			if (problem) return;
			ui.customSpan = { start, end };
			requestReport();
		});

		pick('[data-fa-compare]').addEventListener('change', (event) => {
			ui.compareTo = event.target.value;
			requestReport();
		});

		for (const key of FILTER_KEYS) {
			pick(`[data-fa-filter="${key}"]`).addEventListener('change', (event) => {
				if (ui.filters[key] !== event.target.value) applyFilter(key, event.target.value);
			});
		}

		pick('[data-fa-groupby]').addEventListener('change', (event) => {
			ui.splitBy = event.target.value;
			if (!ui.current) return;
			paintKeys();
			paintNumbers();
			const canvas = pick('canvas[data-fa-chart="groups"]');
			if (onScreen.has(canvas)) drawChart(canvas, true);
		});

		pick('[data-fa-retry]').addEventListener('click', requestReport);
		pick('[data-fa-clear]').addEventListener('click', resetFilters);
	}

	/** Returns what is wrong with a custom range, or an empty string when it is fine. */
	function dateProblem(start, end) {
		if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Pick both dates.';
		if (start > end) return 'The start date has to come before the end date.';
		if (start < FIRST_DAY || end > LAST_DAY)
			return `Pick dates from ${formatDay(FIRST_DAY, 'long')} to ${formatDay(LAST_DAY, 'long')}.`;
		return '';
	}

	function activeRange() {
		const { start, end } =
			ui.span === 'custom' ? ui.customSpan : { start: LAST_DAY - Number(ui.span) + 1, end: LAST_DAY };
		return { start, end, against: COMPARISONS[ui.compareTo]?.shift(start, end) ?? null };
	}

	function comparison() {
		return COMPARISONS[ui.compareTo] || COMPARISONS.previous;
	}

	function addFilterOptions() {
		for (const key of FILTER_KEYS) {
			const menu = pick(`[data-fa-filter="${key}"]`);
			for (const group of SAMPLE.groups[key]) menu.append(new Option(group.label, group.id));
			window.Basalt.select?.refresh?.(menu);
		}
	}

	/* The removable chips under the controls, one per filter in use. */
	function paintChips() {
		const chips = FILTER_KEYS.filter((key) => ui.filters[key]).map((key) => ({
			label: groupLabel(key, ui.filters[key]),
			remove() {
				applyFilter(key, '');
			},
		}));
		window.Basalt.drawer?.applied?.(
			pick('[data-fa-applied]'),
			chips,
			resetFilters,
			pick('[data-fa-filter="plan"]'),
		);
	}

	function applyFilter(key, value) {
		ui.filters[key] = value;
		const menu = pick(`[data-fa-filter="${key}"]`);
		if (menu.value !== value) menu.value = value;
		requestReport();
	}

	function resetFilters() {
		for (const key of FILTER_KEYS) {
			ui.filters[key] = '';
			pick(`[data-fa-filter="${key}"]`).value = '';
		}
		requestReport();
	}

	/* Page-wide clicks and exports. */

	function bindClicks() {
		shell.addEventListener('click', (event) => {
			for (const [selector, act] of CLICK_ACTIONS) {
				const hit = event.target.closest(selector);
				if (!hit) continue;
				act(hit);
				return;
			}
		});
	}

	/** Downloads either the drill-down rows or the stage summary, named after the range. */
	function exportFrom(button) {
		if (!ui.current) return;
		const range = activeRange();
		const stamp = `${isoDay(range.start)}-to-${isoDay(range.end)}`;
		const [name, rows] =
			button.getAttribute('data-fa-export') === 'rows'
				? [`funnel-rows-${stamp}`, rowsForExport(ui.rows)]
				: [`funnel-${stamp}`, stagesForExport()];
		backend.download(name, rows).then(toastExport);
	}

	function stagesForExport() {
		const versus = Boolean(ui.previous);
		const { label } = comparison();
		const head = [
			'Step',
			'People',
			'From step before',
			'Dropped off',
			'Of all visitors',
			...(versus ? [`${label} people`, `${label} from step before`] : []),
		];
		const body = stageRows().map((row) => [
			row.title,
			row.people,
			row.rate == null ? '' : percent(row.rate),
			row.dropped == null ? '' : row.dropped,
			percent(row.ofAll, 2),
			...(versus ? ['', row.prevRate == null ? '' : percent(row.prevRate)] : []),
		]);
		return [head, ...body];
	}

	function rowsForExport(rows) {
		return [
			['Source', 'Device', 'Region', ...LADDER.map((stage) => stage.tag), 'Visit to paid'],
			...rows.map((row) => [
				row.sourceLabel,
				row.deviceLabel,
				row.regionLabel,
				...row.reach,
				percent(row.rate, 2),
			]),
		];
	}

	function toastExport(result) {
		window.Basalt.toasts?.push({
			title: 'Export ready',
			text: `${result.name}, ${result.rows}${result.rows === 1 ? ' row' : ' rows'}`,
			tone: 'success',
			icon: 'bi-download',
		});
	}

	/* Headline tiles. */

	function paintFigures() {
		const report = ui.current;
		const before = ui.previous?.reach;
		pick('[data-fa-kpis]').innerHTML = FIGURES.map((figure, i) => {
			const value = measure(figure, report.reach);
			const display = 'from' in figure ? percent(value, figure.places) : whole(value);
			const delta = before ? deltaLine(figure, value, measure(figure, before)) : '';
			const spark = sparkSvg(report.series.map((slice) => measure(figure, slice.reach)));
			return `<article class="card basalt-box fa-kpi fa-c${i + 1}"><div class="card-body"><h2 class="fa-kpi-label">${figure.label}</h2><p class="fa-kpi-value">${display}</p>${delta}${spark}</div></article>`;
		}).join('');
		/* The figures count up from zero on the first report only. */
		if (!figuresCounted) {
			figuresCounted = true;
			window.Basalt.countUp?.(pickAll('[data-fa-kpis] .fa-kpi-value'));
		}
	}

	function measure(figure, reach) {
		return 'from' in figure ? fraction(reach[figure.stage], reach[figure.from]) : reach[figure.stage];
	}

	/** The line under a tile: the change against the comparison and the old value. */
	function deltaLine(figure, value, was) {
		const isRate = 'from' in figure;
		const change = isRate
			? withSign((value - was) * 100, figure.places, ' pts')
			: withSign((was ? (value - was) / was : 0) * 100, 1, '%');
		const wasText = isRate ? percent(was, figure.places) : whole(was);
		const move = MOVES[value === was ? 'flat' : value > was ? 'up' : 'down'];
		return `<p class="fa-kpi-delta ${move.tone}"><i class="bi ${move.icon}" aria-hidden="true"></i><span class="visually-hidden">${move.said} </span>${change} <span class="fa-kpi-was">against ${wasText}</span></p>`;
	}

	/** A small line and area for a tile, stretched to whatever width the tile has. */
	function sparkSvg(values) {
		const width = 120;
		const height = 34;
		const high = Math.max(...values);
		const low = Math.min(...values);
		const range = high - low || 1;
		const last = Math.max(1, values.length - 1);
		const path = values
			.map((value, i) => {
				const x = (i / last) * width;
				const y = height - 3 - ((value - low) / range) * (height - 6);
				return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
			})
			.join(' ');
		return `<svg class="fa-spark basalt-card-foot" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="fa-spark-area" d="${path} L${width} ${height} L0 ${height} Z"/><path class="fa-spark-line" d="${path}"/></svg>`;
	}

	function paintFigureSkeletons() {
		const tile =
			'<article class="card basalt-box fa-kpi" aria-hidden="true"><div class="card-body"><span class="basalt-skeleton basalt-skeleton-text fa-skel-line"></span><span class="basalt-skeleton basalt-skeleton-title fa-skel-value"></span><span class="basalt-skeleton basalt-skeleton-text fa-skel-line fa-skel-line-short"></span></div></article>';
		pick('[data-fa-kpis]').innerHTML = FIGURES.map(() => tile).join('');
	}

	/* The stage table: a row per stage with its people, how many came
     through from the stage before, how many were lost, and a way in. */

	function stageRows() {
		const reach = ui.current.reach;
		const before = ui.previous?.reach;
		return LADDER.map((stage, i) => ({
			title: stage.title,
			people: reach[i],
			rate: i ? fraction(reach[i], reach[i - 1]) : null,
			dropped: i ? reach[i - 1] - reach[i] : null,
			ofAll: fraction(reach[i], reach[0]),
			prevRate: before && i ? fraction(before[i], before[i - 1]) : null,
		}));
	}

	function paintStages() {
		const body = pick('[data-fa-steps]');
		body.innerHTML = stageRows().map(stageRowHtml).join('');
		for (const trigger of pickAll('[data-bs-toggle="tooltip"]', body)) {
			window.bootstrap?.Tooltip.getOrCreateInstance(trigger);
		}
	}

	function stageRowHtml(row, i) {
		const stage = LADDER[i];
		const info = ` <button type="button" class="fa-info" data-bs-toggle="tooltip" data-bs-title="${htmlSafe(stage.help)}" aria-label="What counts as ${htmlSafe(stage.tag.toLowerCase())}"><i class="bi bi-info-circle" aria-hidden="true"></i></button>`;
		const head = `<th scope="row"><span class="fa-step-name">${htmlSafe(row.title)}${info}</span><span class="fa-step-bar" aria-hidden="true"><span style="width:${((i ? row.rate : 1) * 100).toFixed(1)}%"></span></span></th><td class="fa-step-num" data-label="People">${whole(row.people)}</td>`;
		if (!i) {
			return `<tr>${head}<td class="fa-step-num" data-label="Moved on"><span class="fa-step-start">Everyone starts here</span></td><td class="fa-step-num" data-label="Dropped off"><span class="fa-step-start">None yet</span></td><td class="fa-step-act"></td></tr>`;
		}
		const versus =
			row.prevRate == null
				? ''
				: `<span class="fa-step-vs">${withSign((row.rate - row.prevRate) * 100, 1, ' pts')} against ${comparison().phrase}</span>`;
		const open = `<button type="button" class="btn btn-sm btn-outline-secondary" data-fa-step="${i}">Who left<span class="visually-hidden"> before ${htmlSafe(row.title.toLowerCase())}</span></button>`;
		return `<tr>${head}<td class="fa-step-num" data-label="Moved on">${percent(row.rate)}${versus}</td><td class="fa-step-num" data-label="Dropped off">${whole(row.dropped)}</td><td class="fa-step-act">${open}</td></tr>`;
	}

	/* Chart keys, comparison wording and the "Show the numbers" tables. */

	function paintKeys() {
		const report = ui.current;
		pick('[data-fa-groups-key]').innerHTML = totalsBy(report, ui.splitBy)
			.map((group) => keyItem(group.slot, group.label))
			.join('');
		pick('[data-fa-device-key]').innerHTML = SAMPLE.groups.device
			.map((device, slot) => keyItem(slot, device.label))
			.join('');
		for (const item of pickAll('[data-fa-compare-only]')) item.hidden = !ui.previous;
		for (const item of pickAll('[data-fa-compare-name]')) item.textContent = comparison().label;
		const median = pick('[data-fa-compare-median]');
		if (median) median.textContent = `Median, ${comparison().label.toLowerCase()}`;
		const unit = report.length <= 31 ? 'day' : report.length <= 120 ? 'week' : 'month';
		pick('[data-fa-trend-desc]').textContent =
			`The share of trials started in each ${unit} that went on to pay. Across the range it is ${percent(stepRate(report.reach, 3))}.`;
	}

	function keyItem(slot, label) {
		return `<li class="fa-c${slot + 1}"><span class="fa-key-bar"></span>${htmlSafe(label)}</li>`;
	}

	function paintNumbers() {
		const now = ui.current;
		const before = ui.previous;
		const devices = SAMPLE.groups.device;

		pick('[data-fa-data="timing"]').innerHTML = numbersTable(
			['Between', 'Quarter', 'Median', 'Three quarters', ...(before ? ['Median before'] : [])],
			now.waits.map((wait, gap) => [
				gapLabel(gap),
				waitText(wait[0]),
				waitText(wait[1]),
				waitText(wait[2]),
				...(before ? [waitText(before.waits[gap][1])] : []),
			]),
		);

		pick('[data-fa-data="trend"]').innerHTML = numbersTable(
			['From', 'Trials', 'Paid', 'Trial to paid', ...(before ? [comparison().label] : [])],
			now.series.map((slice, i) => [
				slice.start === slice.end ? formatDay(slice.start, 'short') : rangeText(slice.start, slice.end),
				whole(slice.reach[3]),
				whole(slice.reach[4]),
				percent(stepRate(slice.reach, 3)),
				...(before ? [before.series[i] ? percent(stepRate(before.series[i].reach, 3)) : ''] : []),
			]),
		);

		pick('[data-fa-data="groups"]').innerHTML = numbersTable(
			['Group', ...GAPS.map(gapLabel)],
			totalsBy(now, ui.splitBy).map((group) => [
				group.label,
				...GAPS.map((gap) => percent(stepRate(group.reach, gap))),
			]),
		);

		pick('[data-fa-data="sources"]').innerHTML = numbersTable(
			['Source', ...devices.map((device) => device.label), 'Total', 'Visit to paid'],
			paidBySource(now).map((source) => [
				source.label,
				...source.byDevice.map(whole),
				whole(source.total),
				percent(source.rate, 2),
			]),
		);
	}

	/** A compact table with the first column as row headers and the rest right-aligned. */
	function numbersTable(head, rows) {
		const headRow = head
			.map((text, i) => `<th scope="col"${i ? ' class="text-end"' : ''}>${htmlSafe(text)}</th>`)
			.join('');
		const bodyRows = rows
			.map((cells) => {
				const [first, ...rest] = cells;
				return `<tr><th scope="row">${htmlSafe(first)}</th>${rest.map((cell) => `<td class="text-end">${htmlSafe(cell)}</td>`).join('')}</tr>`;
			})
			.join('');
		return `<table class="table table-sm fa-table fa-table-data"><thead><tr>${headRow}</tr></thead><tbody>${bodyRows}</tbody></table>`;
	}

	/* The leak list: groups below average at one stage, biggest loss first. */

	function paintLeaks() {
		const leaks = findLeaks(ui.current);
		const list = pick('[data-fa-leaks]');
		if (!leaks.length) {
			list.innerHTML =
				'<li class="fa-leaks-none"><div class="basalt-empty basalt-empty-compact basalt-empty-success"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi bi-check2-circle"></i></span><h3 class="basalt-empty-title">No group falls behind</h3><p class="basalt-empty-text">With these filters every group converts at or above the average.</p></div></li>';
			return;
		}
		ui.leaks = leaks;
		list.innerHTML = leaks.map(leakHtml).join('');
	}

	/* Each leak names the group and stage, how far below average it sits and
     the paying customers it would add; the button opens its drawer. */
	function leakHtml(leak, i) {
		const title = `${htmlSafe(leak.label)}: ${htmlSafe(gapLabel(leak.gap).toLowerCase())}`;
		return `<li><button type="button" class="fa-leak" data-fa-leak="${i}"><span class="fa-leak-rank" aria-hidden="true">${i + 1}</span><span class="fa-leak-body"><span class="fa-leak-title">${title}</span><span class="fa-leak-nums">${percent(leak.rate)} against ${percent(leak.mean)} on average</span></span><span class="fa-leak-gain">+${whole(leak.gain)}<span class="fa-leak-unit"> paying</span></span><i class="bi bi-chevron-right fa-leak-go" aria-hidden="true"></i></button></li>`;
	}

	/* The drill-down table: search, sort, pages. */

	function bindTable() {
		const search = pick('[data-fa-search]');
		search.addEventListener('input', () => {
			ui.search = search.value;
			ui.page = 1;
			if (ui.current) paintRows();
		});
	}

	function paintRows() {
		const rows = filteredRows();
		ui.rows = rows;
		const pageCount = Math.max(1, Math.ceil(rows.length / ui.perPage));
		ui.page = Math.min(ui.page, pageCount);
		const first = (ui.page - 1) * ui.perPage;
		pick('[data-fa-rows]').innerHTML = rows.length
			? rows
					.slice(first, first + ui.perPage)
					.map(drillRowHtml)
					.join('')
			: noMatchHtml();
		pick('[data-fa-rows-summary]').textContent = rows.length
			? `${first + 1} to ${Math.min(rows.length, first + ui.perPage)} of ${rows.length} rows`
			: 'No rows';
		markSortedColumn();
		syncPager(pageCount);
	}

	function filteredRows() {
		const needle = ui.search.trim().toLowerCase();
		const { column, direction } = ui.order;
		const rows = drillRows(ui.current)
			.filter((row) => row.reach[0] > 0)
			.filter(
				(row) =>
					!needle ||
					`${row.sourceLabel} ${row.deviceLabel} ${row.regionLabel}`.toLowerCase().includes(needle),
			);
		return rows.sort((a, b) => {
			const left = sortValue(a, column);
			const right = sortValue(b, column);
			const diff = typeof left === 'string' ? left.localeCompare(right) : left - right;
			return direction === 'asc' ? diff : -diff;
		});
	}

	function sortValue(row, column) {
		if (column in STAGE_COLUMN) return row.reach[STAGE_COLUMN[column]];
		return column === 'rate' ? row.rate : row[`${column}Label`];
	}

	function drillRowHtml(row) {
		const counts = row.reach.map((count) => `<td class="text-end">${whole(count)}</td>`).join('');
		return `<tr data-fa-row="${row.key}"><td><button type="button" class="fa-rowlink" data-fa-open-row="${row.key}">${htmlSafe(row.sourceLabel)}</button></td><td>${htmlSafe(row.deviceLabel)}</td><td>${htmlSafe(row.regionLabel)}</td>${counts}<td class="text-end">${percent(row.rate, 2)}</td></tr>`;
	}

	function noMatchHtml() {
		return `<tr class="basalt-empty-row"><td colspan="9"><div class="basalt-empty basalt-empty-compact"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi bi-search"></i></span><h3 class="basalt-empty-title">No rows match "${htmlSafe(ui.search)}"</h3><button type="button" class="btn btn-sm btn-link" data-fa-search-clear>Clear the search</button></div></td></tr>`;
	}

	function markSortedColumn() {
		const { column, direction } = ui.order;
		const arrow = direction === 'asc' ? 'bi-sort-up' : 'bi-sort-down';
		for (const header of pickAll('th[data-fa-sort]')) {
			const active = header.getAttribute('data-fa-sort') === column;
			if (active) header.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');
			else header.removeAttribute('aria-sort');
			pick('.fa-sort-icon', header).className = `bi fa-sort-icon ${active ? arrow : 'bi-arrow-down-up'}`;
		}
	}

	function syncPager(pageCount) {
		if (!window.Basalt.pagination) return;
		if (pagination) {
			pagination.setTotal(pageCount);
			if (pagination.get() !== ui.page) pagination.set(ui.page);
			return;
		}
		pagination = window.Basalt.pagination(pick('[data-fa-pages]'), {
			total: pageCount,
			current: ui.page,
			label: 'Page',
			onChange: turnPage,
		});
	}

	function turnPage(number) {
		ui.page = number;
		paintRows();
	}

	/* Text columns start A to Z, number columns start with the largest;
     a second click on the same column flips it. */
	function toggleSort(column) {
		const textual = ['source', 'device', 'region'].includes(column);
		const { order } = ui;
		ui.order =
			order.column === column
				? { column, direction: order.direction === 'asc' ? 'desc' : 'asc' }
				: { column, direction: textual ? 'asc' : 'desc' };
		ui.page = 1;
		paintRows();
	}

	function clearSearch() {
		const search = pick('[data-fa-search]');
		search.value = '';
		ui.search = '';
		paintRows();
		search.focus();
	}

	/* The drawer: a stage's drop-off, a leak, or one table row. */

	function bindDrawer() {
		drawer.addEventListener('change', (event) => {
			if (event.target.name !== 'fa-rank-by') return;
			for (const list of pickAll('[data-fa-rank]', drawer)) {
				list.hidden = list.getAttribute('data-fa-rank') !== event.target.value;
			}
		});
		pick('[data-fa-drawer-export]', drawer).addEventListener('click', () => {
			if (drawerExport.rows.length) backend.download(drawerExport.name, drawerExport.rows).then(toastExport);
		});
	}

	function fillDrawer(title, subtitle, bodyHtml, sheet, fileName) {
		pick('[data-fa-drawer-title]', drawer).textContent = title;
		pick('[data-fa-drawer-sub]', drawer).textContent = subtitle;
		pick('[data-fa-drawer-body]', drawer).innerHTML = bodyHtml;
		drawerExport.rows = sheet;
		drawerExport.name = fileName;
		if (window.bootstrap) bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
	}

	/**
	 * Who left just before `stage`: a sentence with the loss, then a ranked
	 * list for one breakdown at a time. The export carries all three.
	 */
	function explainDrop(stage) {
		const reach = ui.current.reach;
		const mean = stepRate(reach, stage - 1);
		const sheet = [
			['Group by', 'Group', `Reached ${LADDER[stage - 1].tag.toLowerCase()}`, 'Moved on', 'Dropped off', 'Rate'],
		];
		const rankings = BREAKDOWNS.map(([dim, heading]) => {
			const groups = totalsBy(ui.current, dim).map((group) => ({
				...group,
				rate: stepRate(group.reach, stage - 1),
			}));
			for (const group of groups) {
				const reached = group.reach[stage - 1];
				sheet.push([
					heading,
					group.label,
					reached,
					group.reach[stage],
					reached - group.reach[stage],
					percent(group.rate),
				]);
			}
			return rankingHtml(
				dim,
				groups.sort((a, b) => b.rate - a.rate),
				mean,
			);
		}).join('');
		const switcher = BREAKDOWNS.map(
			([dim, heading]) =>
				`<input type="radio" class="btn-check" name="fa-rank-by" id="fa-rank-${dim}" value="${dim}"${dim === 'source' ? ' checked' : ''}><label class="basalt-segmented-option" for="fa-rank-${dim}">${heading}</label>`,
		).join('');
		const body =
			`<p class="fa-drawer-lead"><strong>${whole(reach[stage - 1] - reach[stage])}</strong> of ${whole(reach[stage - 1])} people left here, and <strong>${percent(mean)}</strong> moved on.</p>` +
			`<p class="fa-drawer-hint">${htmlSafe(LADDER[stage].help)}</p>` +
			`<div class="fa-drawer-bar"><h3 class="fa-drawer-h">Who moved on most</h3><div class="basalt-segmented basalt-segmented-sm" role="radiogroup" aria-label="Break down by" data-basalt-segmented data-fa-rank-by>${switcher}</div></div>` +
			`${rankings}<p class="fa-drawer-hint"><span class="fa-rank-key" aria-hidden="true"></span>The stroke is the average, ${percent(mean)}.</p>`;
		fillDrawer(
			`Who left before "${LADDER[stage].title.toLowerCase()}"`,
			rangeText(ui.current.start, ui.current.end),
			body,
			sheet,
			`funnel-drop-off-${LADDER[stage].id}`,
		);
		window.Basalt.buttons?.(drawer);
	}

	/* Bars are scaled to the best group (or the average, if higher), with
     the average drawn as a stroke; below-average groups get a quieter bar. */
	function rankingHtml(dim, groups, mean) {
		const top = Math.max(mean, ...groups.map((group) => group.rate)) || 1;
		const items = groups
			.map(
				(group) =>
					`<li class="fa-rank-row${group.rate < mean ? ' is-below' : ''}"><span class="fa-rank-name">${htmlSafe(group.label)}</span><span class="fa-rank-track" aria-hidden="true"><span class="fa-rank-fill" style="width:${((group.rate / top) * 100).toFixed(1)}%"></span><span class="fa-rank-avg" style="left:${((mean / top) * 100).toFixed(1)}%"></span></span><span class="fa-rank-rate">${percent(group.rate)}</span></li>`,
			)
			.join('');
		return `<ol class="fa-rank" data-fa-rank="${dim}"${dim === 'source' ? '' : ' hidden'}>${items}</ol>`;
	}

	/** One group's own funnel next to the average, with optional advice above it. */
	function explainGroup(title, reach, intro, fileName) {
		const sheet = [
			['Step', 'People', 'From step before'],
			...LADDER.map((stage, i) => [stage.title, reach[i], i ? percent(stepRate(reach, i - 1)) : '']),
		];
		const body = `${intro || ''}<h3 class="fa-drawer-h">Steps against the average</h3>${stageMeter(reach, ui.current.reach)}<p class="fa-drawer-hint">The bar is this group; the stroke is the average for everyone in the current filters.</p>`;
		const subtitle = `${rangeText(ui.current.start, ui.current.end)}, ${whole(reach[4])} paying customers from ${whole(reach[0])} visits`;
		fillDrawer(title, subtitle, body, sheet, fileName);
	}

	function stageMeter(reach, everyone) {
		const items = LADDER.map((stage, i) => {
			const rate = i ? stepRate(reach, i - 1) : 1;
			const mean = i ? stepRate(everyone, i - 1) : 1;
			const note = i ? `${percent(rate)} moved on, ${percent(mean)} on average` : 'Everyone starts here';
			const marker = i ? `<span class="fa-mini-avg" style="left:${(mean * 100).toFixed(1)}%"></span>` : '';
			return `<li class="fa-mini-step fa-step${i}"><div class="fa-mini-top"><span class="fa-mini-name">${htmlSafe(stage.title)}</span><span class="fa-mini-num">${whole(reach[i])}</span></div><div class="fa-mini-track" aria-hidden="true"><span class="fa-mini-fill" style="width:${(rate * 100).toFixed(1)}%"></span>${marker}</div><p class="fa-mini-note">${note}</p></li>`;
		});
		return `<ol class="fa-mini">${items.join('')}</ol>`;
	}

	function explainLeak(index) {
		const leak = ui.leaks[index];
		if (!leak) return;
		const advice = `<div class="fa-drawer-fix"><i class="bi bi-lightbulb" aria-hidden="true"></i><div><h3 class="fa-drawer-h">What to try</h3><p class="mb-0">${htmlSafe(adviceFor(leak))}</p></div></div>`;
		explainGroup(`${leak.label}: ${gapLabel(leak.gap).toLowerCase()}`, leak.reach, advice, `funnel-${leak.id}`);
	}

	function explainRow(key) {
		const row = ui.rows.find((candidate) => candidate.key === key);
		if (!row) return;
		explainGroup(
			`${row.sourceLabel}, ${row.deviceLabel}, ${row.regionLabel}`,
			row.reach,
			'',
			`funnel-${key.replaceAll('|', '-')}`,
		);
	}

	/* Charts. Each canvas is built the first time it scrolls near the
     viewport, then rebuilt on new data or a theme change. */

	function watchCharts() {
		const canvases = pickAll('canvas[data-fa-chart]');
		if (!('IntersectionObserver' in window)) {
			for (const canvas of canvases) onScreen.add(canvas);
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					observer.unobserve(entry.target);
					onScreen.add(entry.target);
					drawChart(entry.target, true);
				}
			},
			{ rootMargin: '80px 0px' },
		);
		for (const canvas of canvases) observer.observe(canvas);
	}

	function redrawOnScreen(animate) {
		for (const canvas of onScreen) drawChart(canvas, animate);
	}

	function drawChart(canvas, animate) {
		const kind = canvas.getAttribute('data-fa-chart');
		const spec = CHART_SPECS[kind];
		if (!spec || !ui.current || typeof Chart === 'undefined') return;
		liveCharts.get(canvas)?.destroy();
		liveCharts.set(canvas, new Chart(canvas, spec(readColors(), animate && !calm)));
		canvas.setAttribute('aria-label', chartSummary(kind));
	}

	/** The sentence a screen reader hears in place of each chart. */
	function chartSummary(kind) {
		const report = ui.current;
		const summaries = {
			timing: () =>
				`Median time between steps: ${report.waits.map((wait, gap) => `${gapLabel(gap)} ${waitText(wait[1])}`).join(', ')}`,
			trend: () => {
				const rates = report.series.map((slice) => stepRate(slice.reach, 3) * 100);
				return `Trial to paid from ${rates[0].toFixed(1)}% to ${rates.at(-1).toFixed(1)}% across the range, ${percent(stepRate(report.reach, 3))} overall`;
			},
			groups: () => {
				const parts = totalsBy(report, ui.splitBy).map(
					(group) => `${group.label} ${GAPS.map((gap) => percent(stepRate(group.reach, gap))).join(', ')}`,
				);
				return `Step conversion by ${ui.splitBy}: ${parts.join('; ')}`;
			},
			sources: () =>
				`Paying customers by source: ${paidBySource(report)
					.map((source) => `${source.label} ${whole(source.total)}`)
					.join(', ')}`,
		};
		return summaries[kind]?.() ?? '';
	}

	/* Range bars from the first to the third quartile, with a stroke on the
     median and a ring on the comparison median, one row per stage gap. */
	function timingChart(colors, animate) {
		const now = ui.current.waits;
		const before = ui.previous?.waits;
		const hue = colors.series[4];
		const longest = Math.max(...now.map((wait) => wait[2]), ...(before ? before.map((wait) => wait[1]) : []));
		return {
			type: 'bar',
			data: {
				labels: GAPS.map(gapLabel),
				datasets: [
					{
						label: 'Middle half',
						data: now.map((wait) => [wait[0], wait[2]]),
						backgroundColor: translucent(hue, 0.32),
						hoverBackgroundColor: translucent(hue, 0.45),
						borderColor: hue,
						borderWidth: 1.5,
						borderRadius: 999,
						borderSkipped: false,
						barPercentage: 0.5,
					},
				],
			},
			options: sidewaysOptions(colors, animate, {
				layout: { padding: { right: 10 } },
				plugins: {
					tooltip: {
						displayColors: false,
						callbacks: { label: (item) => waitTooltip(now[item.dataIndex], before?.[item.dataIndex]) },
					},
				},
				scales: {
					x: {
						max: Math.ceil((longest + 2) / 4) * 4,
						ticks: { stepSize: 4, callback: (value) => `${value} d` },
					},
					y: { ticks: { color: colors.ink } },
				},
			}),
			plugins: [{ id: 'faMedianMarks', afterDatasetsDraw: (chart) => markMedians(chart, colors, now, before) }],
		};
	}

	function waitTooltip(wait, earlier) {
		const lines = [` Median ${waitText(wait[1])}`, ` Middle half ${waitText(wait[0])} to ${waitText(wait[2])}`];
		if (earlier) lines.push(` Median ${waitText(earlier[1])} in the ${comparison().label.toLowerCase()}`);
		return lines;
	}

	function markMedians(chart, colors, now, before) {
		const {
			ctx,
			chartArea,
			scales: { x: axis },
		} = chart;
		for (const [row, bar] of chart.getDatasetMeta(0).data.entries()) {
			const half = bar.height / 2;
			ctx.save();
			ctx.strokeStyle = colors.ink;
			ctx.lineWidth = 2.5;
			ctx.lineCap = 'round';
			const medianX = axis.getPixelForValue(now[row][1]);
			ctx.beginPath();
			ctx.moveTo(medianX, bar.y - half - 2);
			ctx.lineTo(medianX, bar.y + half + 2);
			ctx.stroke();
			if (before) {
				const earlierX = axis.getPixelForValue(before[row][1]);
				ctx.fillStyle = colors.card;
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.arc(earlierX, bar.y - half - 7, 3.5, 0, Math.PI * 2);
				ctx.fill();
				ctx.stroke();
			}
			ctx.restore();
			const labelX = Math.min(axis.getPixelForValue(now[row][2]) + 8, chartArea.right - 30);
			drawLabel(ctx, colors.ink, waitText(now[row][1]), labelX, bar.y + 6, 'left', 600);
		}
	}

	/* Trial to paid over the range, with the comparison period dotted
     beneath it and the latest value pinned to the end of the line. */
	function trendChart(colors, animate) {
		const hue = colors.series[0];
		const now = ui.current.series;
		const before = ui.previous?.series;
		const values = now.map(trialToPaid);
		const earlier = before ? now.map((_, i) => (before[i] ? trialToPaid(before[i]) : null)) : [];
		const plotted = [...values, ...earlier.filter((value) => value != null)];
		const datasets = [
			{
				type: 'line',
				label: 'Trial to paid',
				data: values,
				borderColor: hue,
				backgroundColor: (context) => areaFill(context, hue),
				fill: 'start',
				tension: 0.35,
				pointRadius: values.length > 16 ? 0 : 3,
				pointBackgroundColor: colors.card,
				pointBorderColor: hue,
				pointBorderWidth: 2,
				pointHoverBackgroundColor: hue,
				order: 0,
			},
		];
		if (before) {
			datasets.push({
				type: 'line',
				label: comparison().label,
				data: earlier,
				borderColor: colors.faint,
				backgroundColor: colors.faint,
				borderDash: [2, 4],
				borderWidth: 2,
				tension: 0.35,
				pointHoverBackgroundColor: colors.faint,
				order: 1,
			});
		}
		return {
			type: 'line',
			data: { labels: now.map((slice) => slice.label), datasets },
			options: chartDefaults(colors, animate, {
				layout: { padding: { top: 30, right: 10 } },
				plugins: {
					tooltip: {
						callbacks: {
							title: (items) => {
								const slice = now[items[0].dataIndex];
								return slice.start === slice.end
									? formatDay(slice.start, 'long')
									: rangeText(slice.start, slice.end);
							},
							label: percentTooltip,
						},
					},
				},
				scales: {
					x: { ticks: { maxTicksLimit: 8 } },
					y: {
						min: Math.max(0, Math.floor(Math.min(...plotted) / 5) * 5 - 5),
						max: Math.ceil(Math.max(...plotted) / 5) * 5 + 5,
						ticks: { callback: (value) => `${value}%`, stepSize: 5 },
					},
				},
			}),
			plugins: [
				{
					id: 'faLatestBadge',
					afterDatasetsDraw(chart) {
						const tip = chart.getDatasetMeta(0).data.at(-1);
						if (!tip) return;
						const area = chart.chartArea;
						drawBadge(chart.ctx, colors, tip.x, tip.y - 10, `Latest ${values.at(-1).toFixed(1)}%`, {
							left: area.left,
							right: area.right + 10,
							top: 0,
						});
					},
				},
			],
		};
	}

	function trialToPaid(slice) {
		return stepRate(slice.reach, 3) * 100;
	}

	function areaFill(context, hue) {
		const fill = window.Basalt.chartFill(
			[
				[0, translucent(hue, 0.24)],
				[1, translucent(hue, 0)],
			],
			{ flat: translucent(hue, 0.12) },
		);
		return fill(context);
	}

	/* Grouped bars, one color per group by its fixed place in the list, so
     filtering a group away never repaints the ones that remain. */
	function groupChart(colors, animate) {
		const groups = totalsBy(ui.current, ui.splitBy);
		return {
			type: 'bar',
			data: {
				labels: GAPS.map(gapLabel),
				datasets: groups.map((group) => ({
					label: group.label,
					data: GAPS.map((gap) => stepRate(group.reach, gap) * 100),
					backgroundColor: colors.series[group.slot],
					hoverBackgroundColor: colors.series[group.slot],
					borderColor: colors.card,
					borderWidth: { left: 1, right: 1 },
					borderRadius: 4,
					borderSkipped: 'start',
					barPercentage: 0.82,
					categoryPercentage: 0.72,
					maxBarThickness: 30,
				})),
			},
			options: chartDefaults(colors, animate, {
				plugins: { tooltip: { callbacks: { label: percentTooltip } } },
				scales: {
					x: { ticks: { callback: twoLineTick, autoSkip: false } },
					y: { beginAtZero: true, suggestedMax: 70, ticks: { callback: (value) => `${value}%` } },
				},
			}),
		};
	}

	/* Paying customers per source, stacked by device and laid on its side,
     with the total and visit-to-paid rate written past each bar. */
	function sourceChart(colors, animate) {
		const sources = paidBySource(ui.current);
		return {
			type: 'bar',
			data: {
				labels: sources.map((source) => source.label),
				datasets: SAMPLE.groups.device.map((device, slot) => ({
					label: device.label,
					data: sources.map((source) => source.byDevice[slot]),
					backgroundColor: colors.series[slot],
					hoverBackgroundColor: colors.series[slot],
					borderColor: colors.card,
					borderWidth: { right: 2 },
					borderSkipped: false,
					borderRadius: 0,
					barPercentage: 0.62,
					categoryPercentage: 0.9,
					stack: 'paid',
				})),
			},
			options: sidewaysOptions(colors, animate, {
				layout: { padding: { right: 96 } },
				plugins: {
					tooltip: {
						itemSort: (a, b) => a.datasetIndex - b.datasetIndex,
						callbacks: {
							label: (item) => ` ${item.dataset.label}: ${whole(item.parsed.x)} customers`,
							footer: (items) => {
								const source = sources[items[0].dataIndex];
								return `${whole(source.total)} customers, ${percent(source.rate, 2)} of visits`;
							},
						},
					},
				},
				scales: {
					x: { stacked: true, ticks: { maxTicksLimit: 5 } },
					y: { stacked: true, ticks: { color: colors.ink } },
				},
			}),
			plugins: [{ id: 'faSourceSums', afterDatasetsDraw: (chart) => writeSourceTotals(chart, colors, sources) }],
		};
	}

	function writeSourceTotals(chart, colors, sources) {
		const metas = chart.data.datasets.map((_, i) => chart.getDatasetMeta(i));
		for (const [row, source] of sources.entries()) {
			const barEnd = Math.max(...metas.map((meta) => (meta.hidden ? 0 : meta.data[row].x)));
			drawLabel(
				chart.ctx,
				colors.ink,
				`${whole(source.total)} · ${percent(source.rate, 2)}`,
				barEnd + 8,
				metas[0].data[row].y + 6,
				'left',
				600,
			);
		}
	}

	function percentTooltip(item) {
		return ` ${item.dataset.label}: ${item.parsed.y.toFixed(1)}%`;
	}

	/* On a narrow chart, a "this to that" axis label breaks onto two lines. */
	function twoLineTick(value) {
		const label = String(this.getLabelForValue(value));
		const cut = label.indexOf(' to ');
		if (this.chart.width >= 560 || cut < 0) return label;
		return [label.slice(0, cut), label.slice(cut + 1)];
	}

	/** Shared Chart.js options for this page; `overrides` is merged in deeply. */
	function chartDefaults(colors, animate, overrides) {
		const tick = { color: colors.quiet, font: TICK_FONT, padding: 8 };
		return overlay(
			{
				responsive: true,
				maintainAspectRatio: false,
				animation: animate ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				layout: { padding: { top: 6, right: 6 } },
				elements: {
					line: { borderWidth: 2.5, borderCapStyle: 'round', borderJoinStyle: 'round' },
					point: { radius: 0, hoverRadius: 5, hoverBorderWidth: 2, hoverBorderColor: colors.card },
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: colors.card,
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
						footerFont: { family: TYPEFACE, size: 11.5, weight: '600' },
					},
				},
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: { maxRotation: 0, autoSkipPadding: 12, ...tick },
					},
					y: {
						grid: { color: colors.grid },
						border: { display: false },
						ticks: { maxTicksLimit: 5, ...tick },
					},
				},
			},
			overrides,
		);
	}

	/* Horizontal bars: categories run down the y axis, values along x. */
	function sidewaysOptions(colors, animate, overrides) {
		return chartDefaults(
			colors,
			animate,
			overlay(
				{
					indexAxis: 'y',
					interaction: { mode: 'index', intersect: false, axis: 'y' },
					scales: {
						x: {
							grid: { display: true, color: colors.grid },
							ticks: { maxTicksLimit: 6 },
							beginAtZero: true,
						},
						y: { grid: { display: false }, ticks: { autoSkip: false } },
					},
				},
				overrides,
			),
		);
	}

	/* Plain objects merge key by key; anything else, arrays included, replaces. */
	function overlay(base, overrides) {
		const merged = { ...base };
		for (const [key, value] of Object.entries(overrides || {})) {
			merged[key] = isPlainObject(value) && isPlainObject(merged[key]) ? overlay(merged[key], value) : value;
		}
		return merged;
	}

	function isPlainObject(value) {
		return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
	}

	/** A rounded tag in card color with body text, so it reads on every palette. */
	function drawBadge(ctx, colors, x, y, label, box) {
		ctx.save();
		ctx.font = `600 11px ${TYPEFACE}`;
		const width = ctx.measureText(label).width + 16;
		const height = 21;
		const left = Math.max(box.left, Math.min(x - width / 2, box.right - width));
		const top = Math.max(box.top, y - height);
		ctx.fillStyle = colors.card;
		ctx.strokeStyle = colors.edge;
		ctx.lineWidth = 1;
		ctx.beginPath();
		if (ctx.roundRect) ctx.roundRect(left, top, width, height, 10.5);
		else ctx.rect(left, top, width, height);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = colors.ink;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(label, left + 8, top + height / 2 + 0.5);
		ctx.restore();
	}

	function drawLabel(ctx, color, label, x, y, align, weight) {
		ctx.save();
		ctx.font = `${weight || 600} 11.5px ${TYPEFACE}`;
		ctx.fillStyle = color;
		ctx.textAlign = align || 'left';
		ctx.textBaseline = 'bottom';
		ctx.fillText(label, x, y);
		ctx.restore();
	}

	/* Colors, read from the same --basalt-* tokens the stylesheet uses. */

	function readColors() {
		const ink = cssVar('--basalt-copy', '#12233a');
		const muted = cssVar('--basalt-copy-muted', '#5f7186');
		return {
			series: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => cssVar(`--basalt-series-${n}`, '#2b6fd4')),
			ink,
			/* Muted text pulled toward the body color keeps 4.5:1 on light palettes. */
			quiet: blend(muted, ink, 0.82),
			faint: translucent(ink, 0.3),
			grid: translucent(ink, 0.07),
			card: cssVar('--basalt-plane', '#ffffff'),
			edge: cssVar('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
		};
	}

	function cssVar(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** Splits a hex or rgb()/rgba() color into [red, green, blue, alpha]; mid gray if unreadable. */
	function rgbaParts(color) {
		const text = String(color || '').trim();
		const shortHex = /^#([0-9a-f]{3})$/i.exec(text);
		if (shortHex) return [...[...shortHex[1]].map((digit) => parseInt(digit + digit, 16)), 1];
		const longHex = /^#([0-9a-f]{6})$/i.exec(text);
		if (longHex) {
			const packed = parseInt(longHex[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 1];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(text);
		if (!functional) return [128, 128, 128, 1];
		const parts = functional[1].split(',').map((part) => parseFloat(part));
		return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
	}

	function translucent(color, alpha) {
		const [red, green, blue] = rgbaParts(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	/** Mixes two colors, `weight` of the first and the rest of the second. */
	function blend(first, second, weight) {
		const a = rgbaParts(first);
		const b = rgbaParts(second);
		const [red, green, blue] = [0, 1, 2].map((i) => Math.round(a[i] * weight + b[i] * (1 - weight)));
		return `rgb(${red}, ${green}, ${blue})`;
	}

	/* Totals by group, by source, by table row, and the leaks between them. */

	/** People at each stage for every group of `dim`, in list order, skipping empty groups. */
	function totalsBy(report, dim) {
		const groups = SAMPLE.groups[dim].map((group, slot) => ({
			id: group.id,
			label: group.label,
			slot,
			reach: [0, 0, 0, 0, 0],
		}));
		const slotFor = new Map(groups.map((group) => [group.id, group]));
		for (const part of report.parts) {
			const target = slotFor.get(part.combo[dim]);
			for (const [stage, count] of part.tally.entries()) target.reach[stage] += count;
		}
		return groups.filter((group) => group.reach[0] > 0);
	}

	function paidBySource(report) {
		const devices = SAMPLE.groups.device;
		return SAMPLE.groups.source
			.map((source) => {
				const byDevice = devices.map(() => 0);
				let visits = 0;
				for (const { combo, tally } of report.parts) {
					if (combo.source !== source.id) continue;
					byDevice[devices.findIndex((device) => device.id === combo.device)] += tally[4];
					visits += tally[0];
				}
				let total = 0;
				for (const count of byDevice) total += count;
				return { id: source.id, label: source.label, byDevice, total, visits, rate: fraction(total, visits) };
			})
			.sort((a, b) => b.total - a.total);
	}

	/* One row per source, device and region, summed over plan and segment. */
	function drillRows(report) {
		const byKey = new Map();
		for (const { combo, tally } of report.parts) {
			const key = `${combo.source}|${combo.device}|${combo.region}`;
			if (!byKey.has(key)) {
				byKey.set(key, {
					key,
					source: combo.source,
					device: combo.device,
					region: combo.region,
					reach: [0, 0, 0, 0, 0],
				});
			}
			const row = byKey.get(key);
			for (const [stage, count] of tally.entries()) row.reach[stage] += count;
		}
		return [...byKey.values()].map((row) => ({
			...row,
			sourceLabel: groupLabel('source', row.source),
			deviceLabel: groupLabel('device', row.device),
			regionLabel: groupLabel('region', row.region),
			rate: fraction(row.reach[4], row.reach[0]),
		}));
	}

	/**
	 * Groups converting below the average at some stage, with the paying
	 * customers they would add by matching it. Only the five largest stay.
	 */
	function findLeaks(report) {
		const everyone = report.reach;
		const found = [];
		for (const dim of ['source', 'device', 'region', 'plan']) {
			const groups = totalsBy(report, dim);
			if (groups.length < 2) continue;
			for (const group of groups) {
				for (const gap of GAPS) {
					const mean = stepRate(everyone, gap);
					const rate = stepRate(group.reach, gap);
					if (group.reach[gap] < 40 || rate >= mean) continue;
					const onward = fraction(everyone[4], everyone[gap + 1]);
					const gain = group.reach[gap] * (mean - rate) * onward;
					found.push({ dim, id: group.id, label: group.label, gap, rate, mean, gain, reach: group.reach });
				}
			}
		}
		return found.sort((a, b) => b.gain - a.gain).slice(0, 5);
	}

	function adviceFor(leak) {
		const advice = SAMPLE.fixes[leak.gap];
		return (advice[leak.id] || advice.fallback).replace('{name}', leak.label);
	}

	/* The demo generator behind backend.load(). */

	/**
	 * Everything the page draws for one range: per-mix parts, whole-number
	 * totals, a trend series and the waits between stages. With `blank`
	 * the range has no visits at all, for the empty state.
	 */
	function buildReport(start, end, filters, blank) {
		const overall = tally(start, end);
		if (blank) overall.visits = 0;
		const parts = roundToPeople(spread(overall, filters));
		const reach = addUp(parts);
		const series = slices(start, end).map((slice) => {
			const stretch = tally(slice.start, slice.end);
			if (blank) stretch.visits = 0;
			return { ...slice, reach: addUp(spread(stretch, filters)) };
		});
		/* People get a little quicker as the product matures. */
		const quicken = 1 - 0.05 * yearsIn((start + end) / 2);
		const waits = GAPS.map((gap) => {
			let weight = 0;
			let slow = 0;
			for (const { combo, tally: counts } of parts) {
				weight += counts[gap + 1];
				slow += counts[gap + 1] * combo.pace[gap];
			}
			const factor = (weight ? slow / weight : 1) * quicken;
			return SAMPLE.waits[gap].map((days) => days * factor);
		});
		return { start, end, length: end - start + 1, parts, reach, series, waits };
	}

	function buildCombos() {
		const { source, device, region, plan, segment } = SAMPLE.groups;
		const list = [];
		for (const traits of product([source, device, region, plan, segment])) {
			const [origin, screen, area, tier, motion] = traits;
			const salesPart = SAMPLE.salesCut[tier.id] || 0;
			const weight =
				origin.weight *
				screen.weight *
				area.weight *
				tier.weight *
				(motion.id === 'sales' ? salesPart : 1 - salesPart);
			if (!weight) continue;
			const lift = SAMPLE.odds.map((base, gap) =>
				Math.min(
					0.95,
					traits.reduce((acc, trait) => acc * trait.lift[gap], base),
				),
			);
			const pace = GAPS.map((gap) =>
				traits.reduce((acc, trait) => acc * (SAMPLE.slowdown[trait.id] || NO_SLOWDOWN)[gap], 1),
			);
			list.push({
				source: origin.id,
				device: screen.id,
				region: area.id,
				plan: tier.id,
				segment: motion.id,
				weight,
				lift,
				pace,
			});
		}
		return list;
	}

	/** Every pick of one item from each list, the first list varying slowest. */
	function product(lists) {
		let picks = [[]];
		for (const list of lists) picks = picks.flatMap((head) => list.map((item) => [...head, item]));
		return picks;
	}

	/* Visits over a run of days, and each stage's drift averaged by visits. */
	function tally(start, end) {
		let visits = 0;
		const driftSum = [0, 0, 0, 0];
		for (let day = start; day <= end; day += 1) {
			const count = visitsOn(day);
			visits += count;
			for (const gap of GAPS) driftSum[gap] += count * drift(gap, day);
		}
		return { visits, drift: driftSum.map((sum) => (visits ? sum / visits : 1)) };
	}

	/* People at every stage for each mix that passes the filters. */
	function spread(stretch, filters) {
		const parts = [];
		for (const combo of combos) {
			if (FILTER_KEYS.some((key) => filters[key] && combo[key] !== filters[key])) continue;
			const counts = [stretch.visits * combo.weight];
			for (const gap of GAPS) counts.push(counts[gap] * combo.lift[gap] * stretch.drift[gap]);
			parts.push({ combo, tally: counts });
		}
		return parts;
	}

	/**
	 * Turns fractional people into whole ones, stage by stage, handing out
	 * the leftover by largest remainder. The rounded parts then add up to
	 * the rounded total, and a 30-day view agrees with its month. A part
	 * never gains a person it did not have at the stage before.
	 */
	function roundToPeople(parts) {
		const exact = parts.map((part) => part.tally.slice());
		for (let stage = 0; stage < 5; stage += 1) {
			let total = 0;
			for (const counts of exact) total += counts[stage];
			let left = Math.round(total);
			for (const [i, part] of parts.entries()) {
				part.tally[stage] = Math.floor(exact[i][stage]);
				left -= part.tally[stage];
			}
			const byRemainder = parts
				.map((_, i) => i)
				.sort((a, b) => (exact[b][stage] % 1) - (exact[a][stage] % 1) || a - b);
			for (const i of byRemainder) {
				if (left <= 0) break;
				const counts = parts[i].tally;
				if (stage > 0 && counts[stage] >= counts[stage - 1]) continue;
				counts[stage] += 1;
				left -= 1;
			}
		}
		return parts;
	}

	function addUp(parts) {
		const totals = [0, 0, 0, 0, 0];
		for (const { tally: counts } of parts) {
			for (const [stage, count] of counts.entries()) totals[stage] += count;
		}
		return totals;
	}

	/* Trend buckets: single days up to a month, weeks up to about a
     quarter, calendar months for anything longer. */
	function slices(start, end) {
		const length = end - start + 1;
		const out = [];
		if (length <= 31) {
			for (let day = start; day <= end; day += 1)
				out.push({ start: day, end: day, label: formatDay(day, 'short') });
			return out;
		}
		if (length <= 120) {
			for (let day = start; day <= end; day += 7)
				out.push({ start: day, end: Math.min(end, day + 6), label: formatDay(day, 'short') });
			return out;
		}
		for (let day = start; day <= end;) {
			const date = dayDate(day);
			const monthEnd = Math.min(
				end,
				Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / DAY_MS) - 1,
			);
			out.push({ start: day, end: monthEnd, label: formatDay(day, 'month') });
			day = monthEnd + 1;
		}
		return out;
	}

	function visitsOn(day) {
		const date = dayDate(day);
		return (
			SAMPLE.visitsPerDay *
			(1 + SAMPLE.visitGrowth * yearsIn(day)) *
			SAMPLE.byWeekday[date.getUTCDay()] *
			SAMPLE.byMonth[date.getUTCMonth()] *
			(0.92 + 0.16 * jitter(day))
		);
	}

	/* How a stage's chance wanders on a given day: a slow yearly climb, a
     gentle wave and a little daily noise. */
	function drift(gap, day) {
		return (
			(1 + SAMPLE.oddsGrowth[gap] * yearsIn(day)) *
			(1 + 0.035 * Math.sin(day / 9 + gap * 1.7)) *
			(1 + 0.05 * (jitter(day * 7 + gap + 11) - 0.5))
		);
	}

	function yearsIn(day) {
		return (day - FIRST_DAY) / 365;
	}

	/** A repeatable number from 0 up to 1 for any whole-number seed. */
	function jitter(seed) {
		let hash = (seed * 2654435761) >>> 0;
		hash = Math.imul(hash ^ (hash >>> 15), hash | 1);
		hash ^= hash + Math.imul(hash ^ (hash >>> 7), hash | 61);
		return ((hash ^ (hash >>> 14)) >>> 0) / 4294967296;
	}

	/* Days are whole numbers counted from 1970 in UTC, so no time zone can
     shift a date by one. */

	function dayNumber(iso) {
		const [year, month, date] = iso.split('-').map(Number);
		return Math.floor(Date.UTC(year, month - 1, date) / DAY_MS);
	}

	function dayDate(day) {
		return new Date(day * DAY_MS);
	}

	function isoDay(day) {
		return dayDate(day).toISOString().slice(0, 10);
	}

	function formatDay(day, shape) {
		return dayDate(day).toLocaleDateString('en-US', { ...DAY_FORMATS[shape], timeZone: 'UTC' });
	}

	/* The year shows once when both ends share it, on both ends otherwise. */
	function rangeText(start, end) {
		const sameYear = dayDate(start).getUTCFullYear() === dayDate(end).getUTCFullYear();
		return `${formatDay(start, sameYear ? 'short' : 'long')} to ${formatDay(end, 'long')}`;
	}

	/* Number and text formatting. */

	function whole(value) {
		return Math.round(value).toLocaleString('en-US');
	}

	function percent(value, places) {
		return Number.isFinite(value) ? `${(value * 100).toFixed(places ?? 1)}%` : '0%';
	}

	function fraction(part, base) {
		return base ? part / base : 0;
	}

	/* Share of the people at stage `gap` who reach the next one. */
	function stepRate(reach, gap) {
		return fraction(reach[gap + 1], reach[gap]);
	}

	function withSign(value, places, suffix) {
		const sign = value > 0 ? '+' : value < 0 ? MINUS : '';
		return `${sign}${Math.abs(value).toFixed(places)}${suffix || ''}`;
	}

	/* Under a day reads in hours; under ten days keeps one decimal. */
	function waitText(days) {
		if (days < 1) return `${Math.max(1, Math.round(days * 24))} h`;
		return `${days < 10 ? days.toFixed(1) : Math.round(days)} d`;
	}

	function gapLabel(gap) {
		return `${LADDER[gap].tag} to ${LADDER[gap + 1].tag.toLowerCase()}`;
	}

	function groupLabel(dim, id) {
		return SAMPLE.groups[dim].find((group) => group.id === id)?.label || id;
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
	}

	function csvCell(value) {
		const text = String(value ?? '');
		return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
	}

	function pick(selector, scope = shell) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = shell) {
		return [...scope.querySelectorAll(selector)];
	}

	function pause(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	start();
})();
