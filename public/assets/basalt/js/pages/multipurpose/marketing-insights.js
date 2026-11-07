/**
 * Marketing analytics, the script behind marketing-insights.html (it wakes
 * up only where the page carries [data-mkt-root]).
 *
 * The figures describe Fieldline, field scheduling software billed per seat
 * on three paid plans (Basic at $15, Pro at $32 and Max at $58 with a floor
 * of $2,500 a month), bought either self-serve or through sales. The page
 * answers six questions: what every channel costs, how much pipeline it
 * opens, what one new customer costs and how many months they take to earn
 * it back, which campaigns did the work, how credit moves between the first
 * and the last touch, which content pulls buyers in, and what is booked on
 * the campaign calendar.
 *
 * Wiring in real data:
 *   - SAMPLE holds every number the page shows; nothing is hard-coded in the
 *     markup. Swap it for your backend's answer, or make server.figures()
 *     fetch it.
 *   - server.figures() is called once per change of period or filter, and
 *     server.download() is the place for an export done on the server.
 *
 * What reacts to what:
 *   period, plan, region or segment changes   refetch, then repaint all
 *   a channel bubble or a payback bar         filters the campaign table
 *   a campaign name, its row, the expand icon  campaign-details.html
 *   the panel icon, a calendar bar, the finder the campaign drawer
 *   Export                                    CSV by channel, month or campaign
 *
 * Add ?state=empty or ?state=error to the address to preview the other
 * states (with error, the first request fails and Try again recovers).
 *
 * Shared pieces come from basalt.js: command menu, styled selects,
 * segmented controls, tabs, pager, drawers, toasts, skeletons, empty states
 * and the live region. The charts reuse the chart pages' recipes and repaint
 * on basalt:appearance, so palette, mode and the Flat switch all apply.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-mkt-root]');
	if (!pageRoot) return;

	/*
	 * SAMPLE is the stand-in for your backend; replace it with real figures.
	 *   product        whose numbers these are.
	 *   today          the demo's current date. Figures stop at the end of
	 *                  the month before it, and "last month" and "year to
	 *                  date" are counted back from there.
	 *   firstMonth     the earliest month held; months is how many follow.
	 *   grossMargin    the part of a bill left after running costs, which
	 *                  drives payback time.
	 *   paybackTarget  in months, drawn as the line on the payback chart.
	 *   season         one multiplier per calendar month, January first.
	 *   regions        the share of all activity each region accounts for.
	 *   plans          seat is the monthly price per seat, seats a typical
	 *                  new account's size and minimum its monthly floor; from
	 *                  those comes arr, the yearly value. win is the share of
	 *                  opportunities that close.
	 *   signups        the reported sign-ups for one month; the generator
	 *                  makes that month's leads land exactly on it.
	 *   segments       the way a customer bought, with its plan mix.
	 *   channels       tone picks one of the eight chart colors. spend is the
	 *                  opening monthly budget and growth its monthly rise; cpl
	 *                  is the price of a lead, sql and opp the step rates,
	 *                  selfServe the share of leads that buy unassisted, and
	 *                  lastTouch how credit shifts when the final touch wins.
	 *   campaigns      channel is a channel id; a null end means still running;
	 *                  weight is its share of the channel while live; paused is
	 *                  the day spending stopped until it restarts.
	 *   content        pieces credited by Content and SEO. weight divides the
	 *                  signups, pipelineWeight the pipeline, and viewsPer is
	 *                  the page views behind each signup.
	 */
	const SAMPLE = {
		product: 'Fieldline',
		today: '2026-10-02',
		firstMonth: '2024-10',
		months: 24,
		grossMargin: 0.8,
		paybackTarget: 15,
		season: [0.92, 0.97, 1.04, 1.0, 0.98, 0.95, 0.94, 0.93, 1.08, 1.1, 1.04, 0.82],
		regions: [
			{ id: 'northeast', name: 'Northeast', share: 0.47 },
			{ id: 'midwest', name: 'Midwest', share: 0.29 },
			{ id: 'west', name: 'West', share: 0.15 },
			{ id: 'south', name: 'South', share: 0.09 },
		],
		plans: [
			{ id: 'starter', name: 'Basic', seat: 15, seats: 9, win: 0.25 },
			{ id: 'growth', name: 'Pro', seat: 32, seats: 15, win: 0.19 },
			{ id: 'enterprise', name: 'Max', seat: 58, seats: 40, minimum: 2500, win: 0.15 },
		],
		segments: [
			{ id: 'self', name: 'Self-serve', mix: { starter: 0.8, growth: 0.2 } },
			{ id: 'sales', name: 'Sales-led', mix: { growth: 0.91, enterprise: 0.09 } },
		],
		signups: { month: '2026-09', leads: 3850 },
		channels: [
			{
				id: 'search',
				name: 'Paid search',
				short: 'Search',
				tone: 1,
				spend: 27000,
				growth: 0.011,
				cpl: 42,
				sql: 0.15,
				opp: 0.38,
				selfServe: 0.66,
				lastTouch: 1.22,
			},
			{
				id: 'social',
				name: 'Paid social',
				short: 'Social',
				tone: 2,
				spend: 20500,
				growth: 0.004,
				cpl: 55,
				sql: 0.11,
				opp: 0.34,
				selfServe: 0.72,
				lastTouch: 0.7,
			},
			{
				id: 'content',
				name: 'Content and SEO',
				short: 'Content',
				tone: 3,
				spend: 11500,
				growth: 0.019,
				cpl: 17,
				sql: 0.12,
				opp: 0.36,
				selfServe: 0.8,
				lastTouch: 0.56,
			},
			{
				id: 'events',
				name: 'Webinars and events',
				short: 'Events',
				tone: 4,
				spend: 15500,
				growth: 0.002,
				cpl: 62,
				sql: 0.17,
				opp: 0.4,
				selfServe: 0.24,
				lastTouch: 0.84,
			},
			{
				id: 'partners',
				name: 'Partners',
				short: 'Partners',
				tone: 5,
				spend: 7000,
				growth: 0.024,
				cpl: 35,
				sql: 0.19,
				opp: 0.44,
				selfServe: 0.36,
				lastTouch: 1.1,
			},
			{
				id: 'outbound',
				name: 'Outbound',
				short: 'Outbound',
				tone: 6,
				spend: 24500,
				growth: 0.009,
				cpl: 98,
				sql: 0.22,
				opp: 0.38,
				selfServe: 0.04,
				lastTouch: 1.36,
			},
			{
				id: 'reviews',
				name: 'Review sites',
				short: 'Reviews',
				tone: 7,
				spend: 5500,
				growth: 0.014,
				cpl: 27,
				sql: 0.14,
				opp: 0.38,
				selfServe: 0.84,
				lastTouch: 1.5,
			},
		],
		campaigns: [
			{
				id: 'cmp-101',
				name: 'Scheduling software keywords',
				channel: 'search',
				owner: 'Hope Stout',
				start: '2024-10-01',
				end: null,
				weight: 5,
				about: 'Always-on bids on searches such as scheduling software and home care roster app, from people who already know they need a tool like Fieldline.',
			},
			{
				id: 'cmp-102',
				name: 'Visit form template searches',
				channel: 'search',
				owner: 'Hope Stout',
				start: '2025-11-03',
				end: null,
				weight: 2.2,
				about: 'Ads on searches for free visit form and quote templates, landing on the template gallery with a Fieldline trial offer.',
			},
			{
				id: 'cmp-103',
				name: 'Year-end planning push',
				channel: 'search',
				owner: 'Randall Farley',
				start: '2025-11-10',
				end: '2026-01-16',
				weight: 3,
				about: 'Raised bids while service companies plan next season and have budget left to spend.',
			},
			{
				id: 'cmp-104',
				name: 'Service owners audience',
				channel: 'social',
				owner: 'Allie Boyle',
				start: '2024-10-01',
				end: null,
				weight: 4,
				about: 'Short videos shown to owners and office managers at home care, pet care and photography businesses with 5 to 200 staff.',
			},
			{
				id: 'cmp-105',
				name: 'Customer story videos',
				channel: 'social',
				owner: 'Allie Boyle',
				start: '2026-02-02',
				end: null,
				weight: 2.5,
				paused: '2026-06-12',
				about: 'Two-minute stories from Fieldline customers. Paused in June while the next three are filmed.',
			},
			{
				id: 'cmp-106',
				name: 'Trial visitor reminders',
				channel: 'social',
				owner: 'Randall Farley',
				start: '2025-06-02',
				end: null,
				weight: 2,
				about: 'Reminder ads for people who started a trial and have not added their team to the mobile app yet.',
			},
			{
				id: 'cmp-107',
				name: 'Blog and organic search',
				channel: 'content',
				owner: 'Larry Barlow',
				start: '2024-10-01',
				end: null,
				weight: 5,
				about: 'Two articles a week on running an on-site business, written for search.',
			},
			{
				id: 'cmp-108',
				name: 'Scheduling benchmark report',
				channel: 'content',
				owner: 'Larry Barlow',
				start: '2026-03-09',
				end: null,
				weight: 3,
				about: 'Yearly report on how 600 on-site businesses book visits, schedule and get paid. Free with an email address.',
			},
			{
				id: 'cmp-109',
				name: 'Template gallery',
				channel: 'content',
				owner: 'Connie Reese',
				start: '2025-05-05',
				end: null,
				weight: 2,
				about: 'Forty visit forms, checklists and quote templates anyone can copy into a trial account.',
			},
			{
				id: 'cmp-110',
				name: 'Monthly product webinar',
				channel: 'events',
				owner: 'Tom Whitaker',
				start: '2024-10-01',
				end: null,
				weight: 4,
				about: 'A live tour of what shipped in Fieldline that month, with questions at the end.',
			},
			{
				id: 'cmp-111',
				name: 'Home Services Expo booth',
				channel: 'events',
				owner: 'Tom Whitaker',
				start: '2026-04-20',
				end: '2026-04-24',
				weight: 6,
				about: 'A booth and one talk at the spring home services expo. Most of its pipeline came through sales follow-up.',
			},
			{
				id: 'cmp-112',
				name: 'City breakfast series',
				channel: 'events',
				owner: 'Tom Whitaker',
				start: '2025-09-08',
				end: '2025-11-21',
				weight: 3,
				about: 'Eight small breakfasts for service company owners in eight cities.',
			},
			{
				id: 'cmp-113',
				name: 'Autumn launch livestream',
				channel: 'events',
				owner: 'Tom Whitaker',
				start: '2026-10-21',
				end: '2026-10-21',
				weight: 4,
				about: 'The autumn release of Fieldline, shown live, with sign-up for early access.',
			},
			{
				id: 'cmp-114',
				name: 'Partner referral program',
				channel: 'partners',
				owner: 'Connie Reese',
				start: '2024-10-01',
				end: null,
				weight: 4,
				about: 'Industry associations and bookkeepers who set Fieldline up for service companies, paid a share of the first year.',
			},
			{
				id: 'cmp-115',
				name: 'Integration directory listings',
				channel: 'partners',
				owner: 'Connie Reese',
				start: '2026-02-16',
				end: null,
				weight: 2,
				about: 'Listings in the app directories of the accounting and payment tools Fieldline connects to.',
			},
			{
				id: 'cmp-116',
				name: 'Mid-market outbound',
				channel: 'outbound',
				owner: 'Randall Farley',
				start: '2024-10-01',
				end: null,
				weight: 4,
				about: 'Emails and calls from the sales development team to service companies with 50 to 500 staff.',
			},
			{
				id: 'cmp-117',
				name: 'Trial team upgrade calls',
				channel: 'outbound',
				owner: 'Randall Farley',
				start: '2026-05-11',
				end: null,
				weight: 2.5,
				about: 'Calls to trial accounts with more than ten people on the mobile app, offering a Pro or Max plan.',
			},
			{
				id: 'cmp-118',
				name: 'Enterprise budget-season emails',
				channel: 'outbound',
				owner: 'Randall Farley',
				start: '2026-11-02',
				end: '2026-12-18',
				weight: 3,
				about: 'A six-week sequence for large service groups while next year’s budgets are set.',
			},
			{
				id: 'cmp-119',
				name: 'Review site profiles',
				channel: 'reviews',
				owner: 'Allie Boyle',
				start: '2024-10-01',
				end: null,
				weight: 4,
				about: 'Paid placement on the two review sites small business buyers read most.',
			},
			{
				id: 'cmp-120',
				name: 'Customer review drive',
				channel: 'reviews',
				owner: 'Allie Boyle',
				start: '2026-07-06',
				end: '2026-08-28',
				weight: 3,
				about: 'Asked long-standing customers for an honest review, with a donation for each one.',
			},
			{
				id: 'cmp-121',
				name: 'Year-end planning push 2026',
				channel: 'search',
				owner: 'Hope Stout',
				start: '2026-11-09',
				end: '2027-01-15',
				weight: 3,
				about: 'Last year’s planning push again, with the new benchmark report as the offer.',
			},
		],
		content: [
			{
				id: 'pc-01',
				name: 'Visit form template',
				short: 'Visit form',
				type: 'Template',
				weight: 5,
				pipelineWeight: 3.4,
				viewsPer: 9,
			},
			{
				id: 'pc-02',
				name: 'Scheduling benchmark report',
				short: 'Benchmark',
				type: 'Report',
				weight: 4.2,
				pipelineWeight: 5.6,
				viewsPer: 6,
			},
			{
				id: 'pc-03',
				name: 'Moving the roster off the whiteboard',
				short: 'Whiteboard',
				type: 'Guide',
				weight: 3.6,
				pipelineWeight: 2.2,
				viewsPer: 18,
			},
			{
				id: 'pc-04',
				name: 'Planning the day, step by step',
				short: 'Day plans',
				type: 'Guide',
				weight: 2.4,
				pipelineWeight: 1.9,
				viewsPer: 22,
			},
			{
				id: 'pc-05',
				name: 'Onboarding 40 carers in a week',
				short: 'Onboarding',
				type: 'Customer story',
				weight: 1.9,
				pipelineWeight: 2.6,
				viewsPer: 14,
			},
			{
				id: 'pc-06',
				name: 'Cost per visit calculator',
				short: 'Calculator',
				type: 'Tool',
				weight: 1.6,
				pipelineWeight: 0.9,
				viewsPer: 11,
			},
			{
				id: 'pc-07',
				name: 'Recurring visit plan tracker',
				short: 'Contracts',
				type: 'Template',
				weight: 1.2,
				pipelineWeight: 0.6,
				viewsPer: 12,
			},
			{
				id: 'pc-08',
				name: 'Invoicing from the client’s door',
				short: 'Invoicing',
				type: 'Guide',
				weight: 0.9,
				pipelineWeight: 0.5,
				viewsPer: 26,
			},
			{
				id: 'pc-09',
				name: 'Security overview for IT reviews',
				short: 'Security',
				type: 'Document',
				weight: 0.7,
				pipelineWeight: 1.4,
				viewsPer: 8,
			},
			{
				id: 'pc-10',
				name: 'Supplies checklist',
				short: 'Supplies',
				type: 'Template',
				weight: 0.5,
				pipelineWeight: 0.2,
				viewsPer: 15,
			},
		],
	};

	/* A typical new account's yearly value: its seats at the seat price for
     twelve months, lifted to the plan's monthly floor when it has one. */
	for (const tier of SAMPLE.plans) {
		tier.arr = Math.max(tier.seat * tier.seats, tier.minimum || 0) * 12;
	}

	/* The preview switch for the empty and error states. A real server
     makes it unnecessary. */
	const demoMode = new URLSearchParams(location.search).get('state') || '';

	/* Every plan price divides by this, so pipeline can be split in steps of
     it and still add back to the exact dollar. */
	const PIPELINE_STEP = 20;
	const FIGURES = ['spend', 'budget', 'leads', 'sqls', 'opps', 'won', 'pipeline', 'arr'];
	const SPLIT_FIELDS = ['spend', 'leads', 'sqls', 'opps', 'won', 'pipeline', 'arr'];
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DAY_MS = 86400000;

	const NOW_DAY = parseDay(SAMPLE.today);
	/* The newest complete month. The current month is still running, so the
     page stops one short of it. */
	const LAST_FULL = monthsSinceStart(NOW_DAY) - 1;

	const PHASES = {
		live: { name: 'Live', tone: 'success' },
		paused: { name: 'Paused', tone: 'warning' },
		ended: { name: 'Ended', tone: '' },
		scheduled: { name: 'Scheduled', tone: 'info' },
	};
	const PHASE_ORDER = ['live', 'paused', 'ended', 'scheduled'];

	const RANGES = {
		'1m': { name: 'Last month', from: LAST_FULL, to: LAST_FULL },
		'3m': { name: 'Last 3 months', from: LAST_FULL - 2, to: LAST_FULL },
		'6m': { name: 'Last 6 months', from: LAST_FULL - 5, to: LAST_FULL },
		ytd: { name: 'Year to date', from: LAST_FULL - calendarOf(LAST_FULL).month, to: LAST_FULL },
		'12m': { name: 'Last 12 months', from: LAST_FULL - 11, to: LAST_FULL },
	};

	/* Everything the page currently shows is derived from this one object. */
	const ui = {
		range: '12m',
		from: RANGES['12m'].from,
		to: LAST_FULL,
		filters: { plan: 'all', region: 'all', segment: 'all' },
		table: { channel: 'all', phase: 'all', query: '', sortBy: 'pipeline', direction: -1 },
		rankBy: 'pipeline',
		payload: null,
		model: null,
		ready: false,
		openId: null,
		stepOrder: [],
	};

	const TYPEFACE = "'Schibsted Grotesk', sans-serif";
	const AXIS_TYPE = { family: TYPEFACE, size: 11.5 };
	const docEl = document.documentElement;

	const refs = {
		body: pick('[data-mkt-body]', pageRoot),
		stateBox: pick('[data-mkt-state]', pageRoot),
		summary: pick('[data-mkt-summary]', pageRoot),
		rangeLabel: pick('[data-mkt-range-label]', pageRoot),
		clear: pick('[data-mkt-clear]', pageRoot),
		rows: pick('[data-mkt-rows]', pageRoot),
		totals: pick('[data-mkt-total]', pageRoot),
		noMatches: pick('[data-mkt-table-empty]', pageRoot),
		pager: pick('[data-mkt-pager]', pageRoot),
		channelPicker: pick('[data-mkt-channel]', pageRoot),
		search: pick('[data-mkt-search]', pageRoot),
		calendar: pick('[data-mkt-cal]', pageRoot),
		stages: pick('[data-mkt-stages]', pageRoot),
	};
	const panel = pick('#mkt-sheet', pageRoot);

	const liveCharts = new Map();
	const drawnOnce = new Set();

	let fetchCount = 0;
	let factCache = null;
	let requestId = 0;
	let pager = null;
	let shownCampaigns = [];
	let arrivalsSet = false;
	const pagerSetup = { total: 0, noun: 'campaigns', render: (first, last) => paintRows(first, last) };

	/*
	 * The server boundary. Both calls return promises; the demo answers from
	 * memory after a short pause. Replace the bodies with fetch() calls and
	 * keep the shapes the same.
	 */
	const server = {
		/**
		 * GET /api/marketing?from=2026-07&to=2026-09&plan=growth&region=midwest&segment=self
		 * @param {{from: number, to: number}} range  month numbers, 0 = SAMPLE.firstMonth
		 * @param {{plan: string, region: string, segment: string}} filters  an id or 'all'
		 * @returns {Promise<{facts: object[], campaigns: object[], content: object[]}>}
		 *   facts      { m, ch, region, seg, plan, spend, budget, leads, sqls, opps, won, pipeline, arr }
		 *   campaigns  { id, m, spend, leads, sqls, opps, won, pipeline, arr }
		 *   content    { id, m, views, signups, pipeline }
		 * Only the months the page asks for and only rows inside the filters.
		 * Pipeline belongs to the first channel a buyer arrived through; arr is
		 * the yearly value of the deals won.
		 */
		async figures(range, filters) {
			fetchCount += 1;
			await later(fetchCount === 1 ? 650 : 260);
			if (demoMode === 'error' && fetchCount === 1) throw new Error('The server did not answer');
			if (demoMode === 'empty') return { facts: [], campaigns: [], content: [] };
			factCache = factCache || buildFacts(SAMPLE);
			const earliest = Math.min(range.from, range.to - 11);

			function wanted(row) {
				if (row.m < earliest || row.m > range.to) return false;
				return [
					['plan', row.plan],
					['region', row.region],
					['segment', row.seg],
				].every(([field, value]) => filters[field] === 'all' || value === filters[field]);
			}

			const facts = factCache.filter(wanted);
			return { facts, campaigns: campaignRows(facts), content: contentRows(facts) };
		},

		/* A server export would post the same range and filters and send back a
       file; the demo writes the CSV in the browser. */
		download(fileName, table) {
			const text = table.map((line) => line.map(csvField).join(',')).join('\r\n');
			const link = document.createElement('a');
			link.href = URL.createObjectURL(new Blob([`${text}`], { type: 'text/csv;charset=utf-8' }));
			link.download = fileName;
			document.body.appendChild(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(link.href), 1000);
			return Promise.resolve(fileName);
		},
	};

	/* Chart recipes, keyed by each canvas's data-mkt-chart. Every one takes
     the colors, whether to animate and the canvas, and reads ui.model. */
	const RECIPES = {
		spark: sparkChart,
		quadrant: quadrantChart,
		payback: paybackChart,
		months: monthsChart,
		content: contentChart,
		campaign: campaignChart,
	};

	const SPARK_SPECS = {
		spend: { read: (sums) => sums.spend, show: asShortDollars, color: 7 },
		pipeline: { read: (sums) => sums.pipeline, show: asShortDollars, color: 0 },
		won: { read: (sums) => sums.won, show: asCount, color: 3 },
		cac: { read: (sums) => sums.cac, show: (value) => asShortDollars(value), color: 4 },
		payback: { read: (sums) => sums.payback, show: (value) => `${value.toFixed(1)} months`, color: 5 },
	};

	/* The five headline cards: how each value prints, and how its change
     chip reads (neutral, lower is better, or measured in months). */
	const HEADLINES = {
		spend: { print: (sums) => asShortDollars(sums.spend), neutral: true },
		pipeline: { print: (sums) => asShortDollars(sums.pipeline) },
		won: { print: (sums) => asCount(sums.won) },
		cac: { print: (sums) => (sums.cac == null ? 'None won' : asDollars(sums.cac)), lowerIsBetter: true },
		payback: {
			print: (sums) =>
				sums.payback == null
					? 'None won'
					: `${sums.payback.toFixed(1)}<span class="mkt-kpi-unit">months</span>`,
			lowerIsBetter: true,
			inMonths: true,
		},
	};

	const SORT_KEYS = {
		name: (entry) => entry.info.name.toLowerCase(),
		channel: (entry) => lookup(SAMPLE.channels, entry.info.channel).name,
		status: (entry) => PHASE_ORDER.indexOf(entry.phase),
		spend: (entry) => entry.sums.spend,
		pipeline: (entry) => entry.sums.pipeline,
		won: (entry) => entry.sums.won,
		cac: (entry) => (entry.sums.cac == null ? Infinity : entry.sums.cac),
		roi: (entry) => (entry.sums.roi == null ? -1 : entry.sums.roi),
	};
	const ASCENDING_FIRST = ['name', 'channel', 'status', 'cac'];

	const EXPORTERS = {
		channels: exportChannels,
		months: exportMonths,
		campaigns: exportCampaigns,
	};

	/* Reading a token makes the browser work out styles, so the chart colors
	   are read once and kept until the appearance changes. */
	let keptColors = null;

	start();

	/**
	 * Fills the static parts of the page, wires every control, then asks the
	 * server for the first set of figures.
	 */
	function start() {
		paintLegends();
		fillPeriodPickers();
		setUpFinder();
		watchCanvases();
		wireDrawer();
		wirePeriod();
		wireFilterMenu();
		wireContentToggle();
		wireTable();
		wireRowClicks();
		wireExports();
		writeSummary();
		refs.summary.textContent = 'Loading the figures';
		fetchFigures();
	}

	/* Loading and painting the whole page. */

	/**
	 * Requests figures for the current period and filters. A reply that
	 * arrives after a newer request was made is dropped.
	 * @param {HTMLButtonElement} [retryButton] shows a spinner while waiting
	 */
	async function fetchFigures(retryButton) {
		const ticket = ++requestId;
		refs.body.setAttribute('aria-busy', 'true');
		if (ui.ready) refs.body.classList.add('is-busy');
		if (retryButton && window.Basalt.buttonState) window.Basalt.buttonState(retryButton, 'loading');
		try {
			const payload = await server.figures({ from: ui.from, to: ui.to }, { ...ui.filters });
			if (ticket !== requestId) return;
			ui.payload = payload;
			const firstTime = !ui.ready;
			ui.ready = true;
			settle();
			paintEverything();
			if (!firstTime) announce(refs.summary.textContent.trim());
		} catch {
			if (ticket !== requestId) return;
			settle();
			writeSummary();
			refs.summary.textContent = 'The figures did not load.';
			setStateBlock(
				emptyCard({
					icon: 'bi-wifi-off',
					tone: 'danger',
					title: 'The figures didn’t load',
					text: 'The connection dropped before the marketing figures arrived. Nothing is lost; try again in a moment.',
					actions:
						'<button type="button" class="btn btn-sm btn-outline-secondary btn-loading btn-loading-swap" data-mkt-retry><span class="btn-loading-icon" aria-hidden="true"><i class="bi bi-arrow-clockwise"></i></span><span class="btn-loading-label">Try again</span></button>',
				}),
			);
			announce('The marketing figures did not load.');
		}
	}

	/* Takes the page out of its loading and busy looks. */
	function settle() {
		pageRoot.classList.remove('is-loading');
		refs.body.classList.remove('is-busy');
		refs.body.setAttribute('aria-busy', 'false');
	}

	function paintEverything() {
		const model = buildModel(ui.payload);
		ui.model = model;
		writeSummary();
		paintHeroFigures(model);
		if (!model.totals.spend && !model.totals.leads) {
			setStateBlock(emptyCard(nothingToShow()));
			return;
		}
		setStateBlock('');
		paintHeadlines(model);
		paintCardText(model);
		paintTable();
		paintCalendar();
		repaintCharts();
		if (panel.classList.contains('show') && ui.openId) fillDrawer(ui.openId);
		if (!arrivalsSet) {
			arrivalsSet = true;
			setArrivals();
		}
	}

	/* The first report plays in as each card comes into view: the hero and
     step figures count up, budget and lean bars grow out from their center
     line, and the calendar bars run out from each start date, row by row.
     Later reports and reduced motion show everything at rest. */

	function setArrivals() {
		if (calmMotion()) return;
		window.Basalt.countUp?.(pickAll('[data-mkt-fig]', pageRoot));
		onFirstSight(refs.stages, () => window.Basalt.countUp?.(pickAll('.mkt-stages-count', refs.stages)));
		const budget = pick('[data-mkt-use]', pageRoot);
		onFirstSight(budget, () => {
			arrive(pickAll('.mkt-use-row', budget), budget);
			window.Basalt.countUp?.(pickAll('.mkt-use-pct', budget));
		});
		const lean = pick('[data-mkt-lean]', pageRoot);
		onFirstSight(lean, () => arrive(pickAll('.mkt-lean-row', lean), lean));
		onFirstSight(refs.calendar, () => arrive(pickAll('.mkt-cal-row', refs.calendar), refs.calendar));
	}

	/** Runs play once, the first time box is partly on screen. */
	function onFirstSight(box, play) {
		if (!box || !window.IntersectionObserver) return;
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				play();
			},
			{ threshold: 0.25 },
		);
		watch.observe(box);
	}

	/** Numbers the rows for their turn and plays box in, then leaves it as drawn. */
	function arrive(rows, box) {
		rows.forEach((row, at) => row.style.setProperty('--mkt-at', Math.min(at, 16)));
		box.classList.add('is-arriving');
		const runs = box.getAnimations({ subtree: true }).map((run) => run.finished);
		Promise.allSettled(runs).then(() => {
			box.classList.remove('is-arriving');
			for (const row of rows) row.style.removeProperty('--mkt-at');
		});
	}

	/* Why the page has nothing to draw: no data at all, or filters that
     exclude everything (one pairing can never match, and says so). */
	function nothingToShow() {
		if (demoMode === 'empty') {
			return {
				icon: 'bi-megaphone',
				title: 'No marketing figures yet',
				text: 'Once a channel is connected and a campaign has run for a day, spend, pipeline and customers show up here.',
				actions: '',
			};
		}
		const impossible = ui.filters.plan === 'enterprise' && ui.filters.segment === 'self';
		return {
			icon: 'bi-funnel',
			title: 'Nothing matches these filters',
			text: impossible
				? 'Max is only sold through the sales team, so there are no self-serve Max customers to show.'
				: `No spend or leads for ${htmlSafe(describeFilters())} in ${htmlSafe(periodText(ui.from, ui.to))}.`,
			actions:
				'<button type="button" class="btn btn-sm btn-outline-secondary" data-mkt-clear-state>Clear filters</button>',
		};
	}

	function setStateBlock(markup) {
		refs.stateBox.innerHTML = markup;
		refs.stateBox.hidden = !markup;
		refs.body.hidden = !!markup;
	}

	function emptyCard({ icon, tone, title, text, actions }) {
		const toneClass = tone ? ` basalt-empty-${tone}` : '';
		const buttons = actions ? `<div class="basalt-empty-actions">${actions}</div>` : '';
		return `<div class="basalt-empty basalt-empty-compact${toneClass}"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi ${icon}"></i></span><h3 class="basalt-empty-title">${title}</h3><p class="basalt-empty-text">${text}</p>${buttons}</div>`;
	}

	/* Turning the server's rows into what the cards need. */

	/**
	 * Sums the rows for the chosen period by channel, by month and segment,
	 * by campaign and by content piece, and adds the twelve-month trail the
	 * sparklines draw.
	 */
	function buildModel(payload) {
		const inPeriod = payload.facts.filter(withinPeriod);
		const perChannel = groupTotals(inPeriod, (row) => row.ch);
		const perMonth = groupTotals(payload.facts, (row) => row.m);
		const perMonthSegment = groupTotals(inPeriod, (row) => `${row.m}|${row.seg}`);

		const model = {
			totals: sumAll(inPeriod),
			channels: SAMPLE.channels.map((info) => ({ info, sums: withRates(perChannel[info.id] || zeroed()) })),
			trail: [],
			months: [],
		};

		for (let month = ui.to - 11; month <= ui.to; month += 1) {
			model.trail.push({ month, sums: withRates(perMonth[month] || zeroed()) });
		}
		for (let month = ui.from; month <= ui.to; month += 1) {
			model.months.push({
				month,
				self: (perMonthSegment[`${month}|self`] || zeroed()).pipeline,
				sales: (perMonthSegment[`${month}|sales`] || zeroed()).pipeline,
				total: (perMonth[month] || zeroed()).pipeline,
			});
		}

		/* Last-touch credit: the same pipeline, reshared by each channel's lean. */
		const leanings = model.channels.map((entry) => entry.sums.pipeline * entry.info.lastTouch);
		const lastTouch = splitWhole(Math.round(model.totals.pipeline / PIPELINE_STEP), leanings);
		for (const [index, entry] of model.channels.entries()) {
			entry.lastTouch = lastTouch[index] * PIPELINE_STEP;
		}

		/* Campaigns that ran inside the period, plus the ones still to start. */
		const campaignMonths = payload.campaigns.filter(withinPeriod);
		const perCampaign = groupTotals(campaignMonths, (row) => row.id);
		model.campaigns = SAMPLE.campaigns
			.map((info) => ({
				info,
				phase: phaseOf(info),
				sums: withRates(perCampaign[info.id] || zeroed()),
				ran: !!perCampaign[info.id] || touchesPeriod(info),
			}))
			.filter((entry) => entry.ran || entry.phase === 'scheduled');
		model.campaignMonths = campaignMonths;

		const perPiece = {};
		for (const row of payload.content.filter(withinPeriod)) {
			perPiece[row.id] = perPiece[row.id] || { views: 0, signups: 0, pipeline: 0 };
			perPiece[row.id].views += row.views;
			perPiece[row.id].signups += row.signups;
			perPiece[row.id].pipeline += row.pipeline;
		}
		model.content = SAMPLE.content.map((info) => ({
			info,
			sums: perPiece[info.id] || { views: 0, signups: 0, pipeline: 0 },
		}));
		model.live = SAMPLE.campaigns.filter((info) => phaseOf(info) === 'live').length;
		return model;
	}

	function withinPeriod(row) {
		return row.m >= ui.from && row.m <= ui.to;
	}

	function touchesPeriod(info) {
		for (let month = ui.from; month <= ui.to; month += 1) {
			if (runShare(info, month, true) > 0) return true;
		}
		return false;
	}

	function zeroed() {
		return Object.fromEntries(FIGURES.map((field) => [field, 0]));
	}

	function accumulate(into, row) {
		for (const field of FIGURES) {
			if (row[field] != null) into[field] += row[field];
		}
		return into;
	}

	function groupTotals(rows, keyFor) {
		const groups = {};
		for (const row of rows) {
			const key = keyFor(row);
			groups[key] = groups[key] || zeroed();
			accumulate(groups[key], row);
		}
		return groups;
	}

	/* The ratios every card uses, worked out in one place: cost per customer,
     months to pay back, and pipeline per dollar. */
	function withRates(sums) {
		sums.cac = sums.won ? sums.spend / sums.won : null;
		sums.payback = sums.arr ? (12 * sums.spend) / (SAMPLE.grossMargin * sums.arr) : null;
		sums.roi = sums.spend ? sums.pipeline / sums.spend : null;
		return sums;
	}

	function sumAll(rows) {
		return withRates(rows.reduce(accumulate, zeroed()));
	}

	/* Headline cards, hero figures and the summary line. */

	function paintHeroFigures(model) {
		const { totals } = model;
		pick('[data-mkt-fig="live"]', pageRoot).textContent = String(model.live);
		pick('[data-mkt-fig="budget"]', pageRoot).textContent = totals.budget
			? `${Math.round((totals.spend / totals.budget) * 100)}%`
			: '0%';
		pick('[data-mkt-fig="ratio"]', pageRoot).textContent = totals.roi == null ? '$0' : `$${totals.roi.toFixed(2)}`;
	}

	function paintHeadlines(model) {
		/* Growth is measured inside the period: its last month against its first. */
		const inPeriod = model.trail.filter((step) => step.month >= ui.from);
		const opening = inPeriod[0];
		const closing = inPeriod[inPeriod.length - 1];

		for (const card of pickAll('[data-mkt-kpi]', pageRoot)) {
			const key = card.getAttribute('data-mkt-kpi');
			const headline = HEADLINES[key];
			const spark = SPARK_SPECS[key];
			pick('[data-mkt-kpi-value]', card).innerHTML = headline.print(model.totals);

			const before = inPeriod.length > 1 ? spark.read(opening.sums) : null;
			const after = inPeriod.length > 1 ? spark.read(closing.sums) : null;
			pick('[data-mkt-kpi-delta]', card).innerHTML =
				before == null || after == null
					? '<span>Pick two months or more to see growth</span>'
					: `${changeChip(after, before, headline)}<span>${htmlSafe(shortMonth(opening.month))} to ${htmlSafe(shortMonth(closing.month))}</span>`;

			const values = model.trail.map((step) => spark.read(step.sums)).filter((value) => value != null);
			const peak = model.trail.find((step) => spark.read(step.sums) === Math.max(...values));
			const low = model.trail.find((step) => spark.read(step.sums) === Math.min(...values));
			if (!peak || !low) continue;
			const title = pick('.mkt-kpi-label', card).textContent.trim();
			pick('canvas', card).setAttribute(
				'aria-label',
				`${title}, month by month from ${longMonth(model.trail[0].month)} to ${longMonth(ui.to)}: highest ${spark.show(spark.read(peak.sums))} in ${longMonth(peak.month)}, lowest ${spark.show(spark.read(low.sums))} in ${longMonth(low.month)}.`,
			);
		}
		window.Basalt.countUp?.(pickAll('[data-mkt-kpi-value]', pageRoot));
	}

	/**
	 * The small up, down or flat chip under a headline figure.
	 * @param {{neutral?: boolean, lowerIsBetter?: boolean, inMonths?: boolean}} look
	 */
	function changeChip(now, before, look) {
		if (before == null || now == null) return '';
		let change;
		let shown;
		if (look.inMonths) {
			change = now - before;
			shown = `${signOf(change)}${Math.abs(change).toFixed(1)} mo`;
		} else {
			if (!before) return '<span class="basalt-trend basalt-trend-flat">New</span>';
			change = (now - before) / before;
			shown = `${signOf(change)}${Math.abs(change * 100).toFixed(1)}%`;
		}
		/* A change too small to survive the rounding above counts as none. */
		const tooSmall = Math.abs(change) < (look.inMonths ? 0.05 : 0.0005);
		const way = tooSmall ? 'flat' : change > 0 ? 'up' : 'down';
		const arrow = { flat: 'bi-dash', up: 'bi-arrow-up-right', down: 'bi-arrow-down-right' }[way];
		const spoken = { flat: 'no change ', up: 'up ', down: 'down ' }[way];
		const classes = ['basalt-trend', `basalt-trend-${way}`];
		if (look.lowerIsBetter) classes.push('basalt-trend-invert');
		if (look.neutral) classes.push('mkt-trend-plain');
		return `<span class="${classes.join(' ')}"><i class="bi ${arrow}" aria-hidden="true"></i><span aria-hidden="true">${shown}</span><span class="visually-hidden">${spoken}${shown.replace(/^[+−]/, '')}</span></span>`;
	}

	function signOf(value) {
		return value >= 0 ? '+' : '−';
	}

	function describeFilters() {
		const { plan, region, segment } = ui.filters;
		const words = [
			plan === 'all' ? 'all plans' : `${lookup(SAMPLE.plans, plan).name} plan`,
			region === 'all' ? 'all regions' : lookup(SAMPLE.regions, region).name,
		];
		if (segment !== 'all') words.push(lookup(SAMPLE.segments, segment).name.toLowerCase());
		return words.join(', ');
	}

	function writeSummary() {
		const period = periodText(ui.from, ui.to);
		/* Phones hide the months after the range name; the summary still says them. */
		refs.rangeLabel.innerHTML =
			ui.range === 'custom'
				? htmlSafe(period)
				: `${htmlSafe(RANGES[ui.range].name)}<span class="mkt-range-dates"> · ${htmlSafe(period)}</span>`;
		const planNote = ui.filters.plan !== 'all' ? ' Spend for one plan is its share of each channel’s spend.' : '';
		refs.summary.innerHTML = `Showing <strong>${htmlSafe(period)}</strong> for ${htmlSafe(describeFilters())}.${planNote}`;

		const active = Object.values(ui.filters).filter((value) => value !== 'all').length;
		refs.clear.hidden = !active;
		const badge = pick('[data-mkt-filter-count]', pageRoot);
		badge.textContent = String(active);
		badge.hidden = !active;
	}

	/* The words, lists and number tables around each chart. */

	function paintCardText(model) {
		const spending = model.channels.filter((entry) => entry.sums.spend > 0);
		describeQuadrant(model, spending);
		describePayback(model, spending);
		describeMonths(model);
		paintStages(model.totals);
		paintBudget(model);
		paintLean(model);
		describeContent(model);
	}

	function describeQuadrant(model, spending) {
		const best = [...spending].sort((a, b) => (b.sums.roi || 0) - (a.sums.roi || 0))[0];
		const biggest = [...spending].sort((a, b) => b.sums.spend - a.sums.spend)[0];
		if (best && biggest) {
			labelCanvas(
				'quadrant',
				`Spend and pipeline per dollar for ${spending.length} channels. ${biggest.info.name} spent the most, ${asShortDollars(biggest.sums.spend)}; ${best.info.name} brought back the most per dollar, ${perDollar(best.sums.roi)}. Blended, every dollar brought ${perDollar(model.totals.roi)} of pipeline.`,
			);
		}
		fillNumbers(
			'quadrant',
			['Channel', 'Spend', 'Pipeline', 'Per $1', 'New customers'],
			model.channels.map(({ info, sums }) => [
				info.name,
				asDollars(sums.spend),
				asDollars(sums.pipeline),
				perDollar(sums.roi),
				asCount(sums.won),
			]),
		);
	}

	function describePayback(model, spending) {
		const target = SAMPLE.paybackTarget;
		const onTarget = spending.filter((entry) => entry.sums.payback != null && entry.sums.payback <= target).length;
		labelCanvas(
			'payback',
			`Months to earn back a customer for each channel against a ${target}-month target; ${onTarget} of ${spending.length} channels are inside it. Blended payback is ${oneDecimal(model.totals.payback)} months.`,
		);
		pick('[data-mkt-target-label]', pageRoot).textContent = `Target, ${target} months`;
		fillNumbers(
			'payback',
			['Channel', 'Cost per customer', 'Payback, months'],
			model.channels.map(({ info, sums }) => [
				info.name,
				sums.cac == null ? 'None won' : asDollars(sums.cac),
				sums.payback == null ? 'None won' : sums.payback.toFixed(1),
			]),
		);
	}

	function describeMonths(model) {
		const best = [...model.months].sort((a, b) => b.total - a.total)[0];
		labelCanvas(
			'months',
			`Pipeline created each month from ${longMonth(ui.from)} to ${longMonth(ui.to)}, ${asShortDollars(model.totals.pipeline)} in all; the best month was ${longMonth(best.month)} at ${asShortDollars(best.total)}.`,
		);
		const [selfKey, salesKey] = pickAll(
			'.mkt-key li',
			pick('[data-mkt-chart="months"]', pageRoot).closest('.card-body'),
		);
		selfKey.hidden = ui.filters.segment === 'sales';
		salesKey.hidden = ui.filters.segment === 'self';
		fillNumbers(
			'months',
			['Month', 'Self-serve', 'Sales-led', 'Total'],
			model.months.map((row) => [
				longMonth(row.month),
				asDollars(row.self),
				asDollars(row.sales),
				asDollars(row.total),
			]),
		);
	}

	/* One row per funnel step: the head count, a thin bar against all leads,
     and the conversion from the step above. */
	function paintStages(totals) {
		const steps = [
			['Leads', totals.leads],
			['Sales-qualified', totals.sqls],
			['Opportunities', totals.opps],
			['Customers', totals.won],
		];
		const scale = totals.leads || 1;
		refs.stages.innerHTML = steps
			.map(([name, people], index) => {
				const width = people ? Math.max(1.5, (people / scale) * 100) : 0;
				return (
					`<li class="mkt-stages-row"><span class="mkt-stages-name">${name}</span><span class="mkt-stages-count">${asCount(people)}</span>` +
					`<span class="mkt-stages-track" aria-hidden="true"><span class="mkt-stages-bar" style="width:${width.toFixed(1)}%"></span></span>` +
					`<span class="mkt-stages-note">${stepNote(steps, index)}</span></li>`
				);
			})
			.join('');
		fillNumbers(
			'stages',
			['Step', 'This period'],
			steps.map(([name, people]) => [name, asCount(people)]),
		);
	}

	function stepNote(steps, index) {
		if (index === 0) return 'Every lead in the period';
		const [aboveName, aboveCount] = steps[index - 1];
		const rate = aboveCount ? (steps[index][1] / aboveCount) * 100 : null;
		return `${rate == null ? 'None' : `${rate.toFixed(1)}%`} of ${aboveName.toLowerCase()}`;
	}

	/* Each channel against its own budget, drawn out from the budget line:
     under to the left, over to the right, both scaled to the channel that
     strayed furthest so even a few percent is visible. */
	function paintBudget(model) {
		const { totals } = model;
		const drift = model.channels.map(({ sums }) => (sums.budget ? (sums.spend - sums.budget) / sums.budget : 0));
		const furthest = Math.max(...drift.map(Math.abs), 0.01);
		pick('[data-mkt-use]', pageRoot).innerHTML = model.channels
			.map(({ info, sums }, index) => {
				const gap = sums.spend - sums.budget;
				const width = ((Math.abs(drift[index]) / furthest) * 50).toFixed(1);
				const used = Math.round((sums.budget ? sums.spend / sums.budget : 0) * 100);
				const note =
					gap > 0
						? `Over by ${asShortDollars(gap)}`
						: gap < 0
							? `Under by ${asShortDollars(-gap)}`
							: 'On budget';
				return (
					`<li class="mkt-use-row ${gap > 0 ? 'is-over' : 'is-under'}">` +
					`<span class="mkt-use-name">${htmlSafe(info.name)}<span class="mkt-use-sub">${asShortDollars(sums.spend)} of ${asShortDollars(sums.budget)}</span></span>` +
					`<span class="mkt-use-track" aria-hidden="true"><span class="mkt-use-bar" style="width:${width}%"></span></span>` +
					`<span class="mkt-use-pct">${used}%</span>` +
					`<span class="mkt-use-note">${note}</span></li>`
				);
			})
			.join('');

		const overspent = model.channels.filter(({ sums }) => sums.spend > sums.budget);
		const verdict = overspent.length
			? `${overspent.map(({ info }) => info.name).join(', ')} went over.`
			: 'Every channel came in under budget.';
		labelCanvas(
			'budget',
			`Spend against budget for each channel: ${asShortDollars(totals.spend)} spent of ${asShortDollars(totals.budget)}. ${verdict}`,
		);
		fillNumbers(
			'budget',
			['Channel', 'Budget', 'Spent', 'Over or under'],
			model.channels.map(({ info, sums }) => [
				info.name,
				asDollars(sums.budget),
				asDollars(sums.spend),
				`${sums.spend > sums.budget ? 'Over by ' : 'Under by '}${asDollars(Math.abs(sums.spend - sums.budget))}`,
			]),
		);
	}

	/* Which way each channel leans, drawn out from the middle: towards opening
     deals (more first-touch credit) or closing them (more last-touch). */
	function paintLean(model) {
		const leans = model.channels
			.filter((entry) => entry.sums.pipeline || entry.lastTouch)
			.map((entry) => ({ entry, shift: entry.lastTouch - entry.sums.pipeline }))
			.sort((a, b) => a.shift - b.shift);
		const widest = Math.max(...leans.map(({ shift }) => Math.abs(shift)), 1);
		pick('[data-mkt-lean]', pageRoot).innerHTML = leans
			.map(({ entry, shift }) => {
				const side = shift >= 0 ? 'closes' : 'opens';
				const width = ((Math.abs(shift) / widest) * 50).toFixed(1);
				const touch = side === 'closes' ? 'the last touch' : 'the first touch';
				return (
					`<li class="mkt-lean-row is-${side}">` +
					`<span class="mkt-lean-name">${htmlSafe(entry.info.name)}<span class="mkt-lean-sub">First ${asShortDollars(entry.sums.pipeline)} · last ${asShortDollars(entry.lastTouch)}</span></span>` +
					`<span class="mkt-lean-track" aria-hidden="true"><span class="mkt-lean-bar" style="width:${width}%"></span></span>` +
					`<span class="mkt-lean-value">${asShortDollars(Math.abs(shift))}<span class="visually-hidden"> more as ${touch}</span></span></li>`
				);
			})
			.join('');
		fillNumbers(
			'attribution',
			['Channel', 'First touch', 'Last touch', 'Difference'],
			model.channels.map(({ info, sums, lastTouch }) => [
				info.name,
				asDollars(sums.pipeline),
				asDollars(lastTouch),
				`${lastTouch >= sums.pipeline ? '+' : '−'}${asDollars(Math.abs(lastTouch - sums.pipeline))}`,
			]),
		);
	}

	function describeContent(model) {
		const metric = ui.rankBy;
		const ranked = [...model.content].sort((a, b) => b.sums[metric] - a.sums[metric]);
		const top = ranked[0];
		if (top) {
			const lead =
				metric === 'pipeline' ? asShortDollars(top.sums.pipeline) : `${asCount(top.sums.signups)} signups`;
			labelCanvas(
				'content',
				`Content pieces ranked by ${metric === 'pipeline' ? 'pipeline' : 'signups'}; ${top.info.name} leads with ${lead}.`,
			);
		}
		fillNumbers(
			'content',
			['Piece', 'Type', 'Views', 'Signups', 'Pipeline'],
			ranked.map(({ info, sums }) => [
				info.name,
				info.type,
				asCount(sums.views),
				asCount(sums.signups),
				asDollars(sums.pipeline),
			]),
		);
	}

	function labelCanvas(chartName, text) {
		pick(`canvas[data-mkt-chart="${chartName}"]`, pageRoot)?.setAttribute('aria-label', text);
	}

	/**
	 * Writes the "Show the numbers" table under a chart. The class carries the
	 * column count, which sets how narrow the card may get before each row
	 * stacks with its figures labeled.
	 */
	function fillNumbers(name, columns, rows) {
		const box = pick(`[data-mkt-data="${name}"] .mkt-data-body`, pageRoot);
		if (!box) return;
		const head = columns
			.map((title, index) => `<th scope="col"${index ? ' class="text-end"' : ''}>${htmlSafe(title)}</th>`)
			.join('');
		const body = rows
			.map(([first, ...rest]) => {
				const cells = rest
					.map((value, index) => `<td data-label="${htmlSafe(columns[index + 1])}">${htmlSafe(value)}</td>`)
					.join('');
				return `<tr><th scope="row">${htmlSafe(first)}</th>${cells}</tr>`;
			})
			.join('');
		box.innerHTML = `<table class="mkt-data-table-c${Math.min(columns.length, 5)}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
	}

	function paintLegends() {
		pick('[data-mkt-key="channels"]', pageRoot).innerHTML = SAMPLE.channels
			.map((info) => `<li class="mkt-c${info.tone}"><span class="mkt-key-dot"></span>${htmlSafe(info.name)}</li>`)
			.join('');
		const bars = SAMPLE.channels
			.map(
				(info) => `<li class="mkt-c${info.tone}"><span class="mkt-key-bar"></span>${htmlSafe(info.short)}</li>`,
			)
			.join('');
		pick('[data-mkt-key="calendar"]', pageRoot).innerHTML =
			`${bars}<li class="mkt-ct"><span class="mkt-key-line mkt-key-line-dotted"></span>Latest figures</li>`;
	}

	/* The campaign table. */

	function paintTable() {
		const { list, counts } = filteredCampaigns();
		shownCampaigns = list;

		for (const [phase, count] of Object.entries(counts)) {
			const badge = pick(`[data-mkt-status-count="${phase}"]`, pageRoot);
			if (badge) badge.textContent = count;
		}

		const { sortBy: orderBy, direction } = ui.table;
		for (const header of pickAll('[data-mkt-sort]', pageRoot)) {
			const sorted = header.getAttribute('data-mkt-sort') === orderBy;
			if (sorted) header.setAttribute('aria-sort', direction > 0 ? 'ascending' : 'descending');
			else header.removeAttribute('aria-sort');
			const arrow = sorted ? (direction > 0 ? 'bi-arrow-up' : 'bi-arrow-down') : 'bi-arrow-down-up';
			pick('.mkt-sort-icon', header).className = `bi mkt-sort-icon ${arrow}`;
		}

		/* The totals cover what is listed; with no table filter they equal the
       headline figures. */
		const narrowed = ui.table.channel !== 'all' || ui.table.phase !== 'all' || ui.table.query.trim();
		refs.totals.innerHTML = list.length ? totalsRow(list, narrowed) : '';
		refs.noMatches.hidden = !!list.length;
		refs.pager.hidden = !list.length;
		if (!list.length) {
			refs.rows.innerHTML = '';
			refs.noMatches.innerHTML = emptyCard({
				icon: 'bi-search',
				title: 'No campaigns match',
				text: narrowed
					? 'Nothing in this period matches the search, channel and status you picked.'
					: 'No campaign ran in this period.',
				actions: narrowed
					? '<button type="button" class="btn btn-sm btn-outline-secondary" data-mkt-table-reset>Show every campaign</button>'
					: '',
			});
		}

		pagerSetup.total = list.length;
		if (!pager && window.Basalt.pager) pager = window.Basalt.pager(refs.pager, pagerSetup);
		if (!pager) {
			paintRows(1, list.length);
			return;
		}
		pager.setTotal(Math.max(1, Math.ceil(list.length / rowsPerPage())));
		pager.set(1);
		paintRows(1, rowsPerPage());
	}

	function totalsRow(list, narrowed) {
		const sums = withRates(list.reduce((into, entry) => accumulate(into, entry.sums), zeroed()));
		const label = `${list.length}${list.length === 1 ? ' campaign' : ' campaigns'}${narrowed ? ', filtered' : ''}`;
		return (
			`<tr><th scope="row">Total<span class="mkt-sub">${label}</span></th><td></td><td></td>` +
			`<td class="text-end">${asDollars(sums.spend)}</td><td class="text-end">${asDollars(sums.pipeline)}</td><td class="text-end">${asCount(sums.won)}</td>` +
			`<td class="text-end">${sums.cac == null ? 'None won' : asDollars(sums.cac)}</td><td class="text-end">${sums.roi == null ? 'No spend' : `${sums.roi.toFixed(1)}×`}</td><td class="mkt-col-act"></td></tr>`
		);
	}

	/* Applies the channel, search and status filters, counts each status
     before the status filter, then sorts (ties fall back to the name). */
	function filteredCampaigns() {
		const { channel, phase, query, sortBy: orderBy, direction } = ui.table;
		const needle = query.trim().toLowerCase();
		const matching = ui.model.campaigns.filter((entry) => {
			if (channel !== 'all' && entry.info.channel !== channel) return false;
			if (!needle) return true;
			return `${entry.info.name} ${entry.info.owner} ${lookup(SAMPLE.channels, entry.info.channel).name}`
				.toLowerCase()
				.includes(needle);
		});

		const counts = { all: matching.length, live: 0, paused: 0, ended: 0, scheduled: 0 };
		for (const entry of matching) counts[entry.phase] += 1;

		const keyOf = SORT_KEYS[orderBy];
		const list = matching
			.filter((entry) => phase === 'all' || entry.phase === phase)
			.sort((a, b) => compareKeys(keyOf(a), keyOf(b)) * direction || a.info.name.localeCompare(b.info.name));
		return { list, counts };
	}

	function compareKeys(left, right) {
		if (left < right) return -1;
		return left > right ? 1 : 0;
	}

	function rowsPerPage() {
		return parseInt(pick('[data-basalt-pager-size]', refs.pager).value, 10) || 10;
	}

	function paintRows(first, last) {
		refs.rows.innerHTML = shownCampaigns
			.slice(first - 1, last)
			.map(campaignRow)
			.join('');
		window.Basalt.tips?.(refs.rows);
		const rangeText = pick('[data-basalt-pager-range]', refs.pager);
		if (!rangeText) return;
		rangeText.innerHTML = shownCampaigns.length
			? `<strong>${first}–${Math.min(last, shownCampaigns.length)}</strong> of ${shownCampaigns.length} campaigns`
			: 'No campaigns';
	}

	function campaignRow({ info, phase, sums }) {
		const notStarted = phase === 'scheduled';
		const fullPage = `campaign-details.html?id=${encodeURIComponent(info.id)}`;
		const cac = sums.cac == null ? '<span class="mkt-quiet">None won</span>' : asDollars(sums.cac);
		const roi = sums.roi == null ? '<span class="mkt-quiet">No spend</span>' : `${sums.roi.toFixed(1)}×`;
		const name = htmlSafe(info.name);
		const tag = channelTag(info.channel);
		return (
			`<tr data-mkt-row="${info.id}">` +
			`<td><a class="mkt-open" href="${fullPage}">${name}</a><span class="mkt-sub">${htmlSafe(info.owner)}</span><span class="mkt-fold">${tag}</span></td>` +
			`<td>${tag}</td><td>${phaseBadge(phase)}</td>` +
			`<td class="text-end">${figure(asDollars(sums.spend))}</td><td class="text-end">${figure(asDollars(sums.pipeline))}</td><td class="text-end">${figure(asCount(sums.won))}</td>` +
			`<td class="text-end">${figure(cac)}</td><td class="text-end">${figure(roi)}</td>` +
			'<td class="mkt-col-act"><span class="basalt-row-actions">' +
			`<button type="button" class="btn btn-icon btn-sm" data-mkt-open="${info.id}" aria-label="Quick view: ${name}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>` +
			`<a class="btn btn-icon btn-sm" href="${fullPage}" aria-label="Open full page: ${name}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>` +
			'</span></td></tr>'
		);

		function figure(markup) {
			return notStarted ? '<span class="mkt-quiet">Not started</span>' : markup;
		}
	}

	function phaseBadge(phase) {
		const { name, tone } = PHASES[phase];
		return `<span class="basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}">${name}</span>`;
	}

	function channelTag(channelId) {
		const info = lookup(SAMPLE.channels, channelId);
		return `<span class="badge basalt-badge-as-dot basalt-badge-tone-${info.tone}">${htmlSafe(info.name)}</span>`;
	}

	/* The campaign calendar: the period plus three months ahead. */

	function paintCalendar() {
		const first = ui.from;
		const last = LAST_FULL + 3;
		const columns = last - first + 1;
		const opens = firstOfMonth(first);
		const closes = firstOfMonth(last + 1);

		const onCalendar = SAMPLE.campaigns.filter((info) => {
			const ends = info.end ? parseDay(info.end) : closes;
			return parseDay(info.start) < closes && ends >= opens;
		});

		const ticks = [];
		for (let month = first; month <= last; month += 1) {
			const word = calendarOf(month).month === 0 || month === first ? longMonth(month) : shortMonth(month);
			ticks.push(`<span${month > LAST_FULL ? ' class="is-ahead"' : ''}>${word}</span>`);
		}

		const groups = SAMPLE.channels
			.map((group) => {
				const items = onCalendar.filter((info) => info.channel === group.id);
				if (!items.length) return '';
				const bars = items.map((info) => calendarBar(info, group, across, closes, columns)).join('');
				return `<li><p class="mkt-cal-group">${htmlSafe(group.name)}</p><ul class="list-unstyled mb-0">${bars}</ul></li>`;
			})
			.join('');

		const todayAt = across(new Date(NOW_DAY.getTime() + DAY_MS));
		refs.calendar.innerHTML =
			`<div class="mkt-cal-grid" style="--mkt-cols:${columns}">` +
			`<div class="mkt-cal-months" aria-hidden="true"><span></span><div class="mkt-cal-ticks">${ticks.join('')}</div></div>` +
			`<ul class="list-unstyled mb-0">${groups}</ul>` +
			`<div class="mkt-cal-today" style="--mkt-today: ${(todayAt / 100).toFixed(4)}" aria-hidden="true"></div>` +
			'</div>';
		refs.calendar.setAttribute(
			'aria-label',
			`Campaign calendar, ${periodText(first, last)}. ${onCalendar.length} campaigns, grouped by channel.`,
		);

		/* Where a date falls across the calendar, as a percentage. */
		function across(date) {
			return ((date - opens) / (closes - opens)) * 100;
		}
	}

	/* One campaign's bar. A bar too short to hold its word shows as a bare
     mark; its label still carries the full description. */
	function calendarBar(info, group, across, closes, columns) {
		const left = Math.max(across(parseDay(info.start)), 0);
		const right = Math.min(across(info.end ? new Date(parseDay(info.end).getTime() + DAY_MS) : closes), 100);
		const phase = phaseOf(info);
		const tiny = (right - left) * columns < 55;
		const name = htmlSafe(info.name);
		const classes = [`mkt-cal-bar mkt-c${group.tone}`];
		if (phase === 'scheduled') classes.push('mkt-cal-bar-ahead');
		if (phase === 'paused') classes.push('mkt-cal-bar-paused');
		if (tiny) classes.push('mkt-cal-bar-short');
		const place = `left:${left.toFixed(2)}%;width:${Math.max(right - left, 0.8).toFixed(2)}%`;
		const label = `${name}, ${PHASES[phase].name.toLowerCase()}, ${htmlSafe(runSpan(info, ', paused '))}`;
		return (
			`<li class="mkt-cal-row"><span class="mkt-cal-name" aria-hidden="true">${name}</span><div class="mkt-cal-lane">` +
			`<button type="button" class="${classes.join(' ')}" style="${place}" data-mkt-open="${info.id}" aria-label="${label}"${tiny ? ` title="${name}"` : ''}>` +
			`<span aria-hidden="true">${tiny ? '' : htmlSafe(PHASES[phase].name)}</span></button></div></li>`
		);
	}

	/* When a campaign runs, in words; the paused wording differs by place. */
	function runSpan(info, pausedLead) {
		let tail = ', still running';
		if (info.end) tail = ` to ${prettyDate(info.end)}`;
		else if (info.paused) tail = `${pausedLead}${prettyDate(info.paused)}`;
		return `${prettyDate(info.start)}${tail}`;
	}

	/* The campaign drawer. */

	function wireDrawer() {
		panel.addEventListener('shown.bs.offcanvas', () => {
			const canvas = pick('canvas', panel);
			if (canvas) drawChart(canvas, true);
		});
		panel.addEventListener('hidden.bs.offcanvas', () => {
			dropChart(pick('canvas', panel));
			ui.openId = null;
		});
		for (const button of pickAll('[data-mkt-step]', panel)) {
			button.addEventListener('click', () => stepDrawer(parseInt(button.getAttribute('data-mkt-step'), 10)));
		}
	}

	/* Up and down walk the table in its current sort and filter, or every
     campaign when the open one is not in the table. */
	function stepDrawer(by) {
		const order = ui.stepOrder;
		const here = order.indexOf(ui.openId);
		fillDrawer(order[(here + by + order.length) % order.length]);
		const canvas = pick('canvas', panel);
		if (canvas) drawChart(canvas, false);
	}

	function tableOrder() {
		const source = shownCampaigns.length ? shownCampaigns.map((entry) => entry.info) : SAMPLE.campaigns;
		return source.map((info) => info.id);
	}

	function revealCampaign(id) {
		if (!ui.model) return;
		ui.stepOrder = tableOrder();
		fillDrawer(id);
		if (window.bootstrap) bootstrap.Offcanvas.getOrCreateInstance(panel).show();
	}

	function fillDrawer(id) {
		const info = lookup(SAMPLE.campaigns, id);
		if (!info) return;
		ui.openId = id;
		const phase = phaseOf(info);
		const entry = ui.model.campaigns.find((row) => row.info.id === id) || {
			info,
			phase,
			sums: withRates(zeroed()),
		};
		if (!ui.stepOrder.includes(id)) {
			ui.stepOrder = tableOrder();
			if (!ui.stepOrder.includes(id)) ui.stepOrder = SAMPLE.campaigns.map((item) => item.id);
		}
		const notStarted = phase === 'scheduled';

		slot('title').textContent = info.name;
		slot('sub').textContent = `${lookup(SAMPLE.channels, info.channel).name} · run by ${info.owner}`;
		slot('pos').textContent = `${ui.stepOrder.indexOf(id) + 1} of ${ui.stepOrder.length}`;

		dropChart(pick('canvas', panel));
		slot('body').innerHTML = drawerMarkup(info, phase, entry.sums);
		slot('note').textContent = notStarted ? `Starts ${prettyDate(info.start)}.` : `For ${describeFilters()}.`;
		pick('[data-mkt-sheet-export]', panel).disabled = notStarted;
		pick('[data-mkt-sheet-page]', panel).href = `campaign-details.html?id=${encodeURIComponent(id)}`;

		const canvas = pick('canvas', panel);
		if (canvas && panel.classList.contains('show')) drawChart(canvas, false);

		function slot(name) {
			return pick(`[data-mkt-s="${name}"]`, panel);
		}
	}

	function drawerMarkup(info, phase, sums) {
		const intro =
			`<div class="mkt-sheet-tags">${phaseBadge(phase)}${channelTag(info.channel)}</div>` +
			`<p class="mkt-sheet-text">${htmlSafe(info.about)}</p><p class="mkt-sheet-text"><strong>Runs</strong> ${htmlSafe(runSpan(info, ', paused since '))}.</p>`;
		if (phase === 'scheduled') {
			return (
				intro +
				emptyCard({
					icon: 'bi-calendar-event',
					title: 'Not started yet',
					text: 'Figures start the day it goes live. Until then it shows on the calendar with a dashed outline.',
				})
			);
		}
		const figures = [
			['Spend', asDollars(sums.spend)],
			['Pipeline', asDollars(sums.pipeline)],
			['Pipeline ROI', sums.roi == null ? 'No spend' : `${sums.roi.toFixed(1)}×`],
			['New customers', asCount(sums.won)],
			['Cost per customer', sums.cac == null ? 'None won' : asDollars(sums.cac)],
			['Yearly value won', asShortDollars(sums.arr)],
		]
			.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`)
			.join('');
		const flow = [
			['Leads', sums.leads],
			['Qualified', sums.sqls],
			['Opportunities', sums.opps],
			['Customers', sums.won],
		]
			.map(([step, people]) => `<li><span>${step}</span><strong>${asCount(people)}</strong></li>`)
			.join('');
		return (
			`${
				intro
			}<section><h3 class="mkt-sheet-h">In ${htmlSafe(periodText(ui.from, ui.to))}</h3><dl class="mkt-sheet-figs">${figures}</dl></section>` +
			`<section><h3 class="mkt-sheet-h">Leads to customers</h3><ol class="mkt-sheet-flow">${flow}</ol></section>` +
			`<section><h3 class="mkt-sheet-h" id="mkt-sheet-chart-title">Spend and pipeline by month</h3>` +
			`<ul class="mkt-key"><li class="mkt-c8"><span class="mkt-key-bar"></span>Spend</li><li class="mkt-c1"><span class="mkt-key-bar"></span>Pipeline</li></ul>` +
			`<div class="mkt-sheet-chart"><canvas data-mkt-chart="campaign" role="img" aria-label="Spend and pipeline by month for ${htmlSafe(info.name)}: ${asDollars(sums.spend)} spent and ${asDollars(sums.pipeline)} of pipeline in all."></canvas></div></section>`
		);
	}

	/* Controls: period, filters, content ranking. */

	function fillPeriodPickers() {
		const first = pick('[data-mkt-from]', pageRoot);
		const last = pick('[data-mkt-to]', pageRoot);
		const months = [];
		for (let month = LAST_FULL - 11; month <= LAST_FULL; month += 1) {
			months.push(`<option value="${month}">${longMonth(month)}</option>`);
		}
		for (const picker of [first, last]) picker.innerHTML = months.join('');
		first.value = String(ui.from);
		last.value = String(ui.to);
		for (const picker of [first, last]) refreshSelect(picker);

		refs.channelPicker.insertAdjacentHTML(
			'beforeend',
			SAMPLE.channels.map((info) => `<option value="${info.id}">${htmlSafe(info.name)}</option>`).join(''),
		);
		refreshSelect(refs.channelPicker);
	}

	function refreshSelect(picker) {
		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(picker);
	}

	function wirePeriod() {
		for (const option of pickAll('input[name="mkt-range"]', pageRoot)) {
			option.addEventListener('change', () => {
				if (option.checked) applyRange(option.value);
			});
		}

		pick('[data-mkt-custom]', pageRoot).addEventListener('submit', (event) => {
			event.preventDefault();
			const lastPicker = pick('[data-mkt-to]', pageRoot);
			const first = parseInt(pick('[data-mkt-from]', pageRoot).value, 10);
			const last = parseInt(lastPicker.value, 10);
			const problem = pick('[data-mkt-custom-error]', pageRoot);
			if (last < first) {
				problem.hidden = false;
				problem.textContent = 'The last month has to come after the first.';
				lastPicker.setAttribute('aria-invalid', 'true');
				return;
			}
			problem.hidden = true;
			lastPicker.removeAttribute('aria-invalid');
			Object.assign(ui, { range: 'custom', from: first, to: last });
			for (const option of pickAll('input[name="mkt-range"]', pageRoot)) option.checked = false;
			const opener = pick('[data-mkt-range-btn]', pageRoot);
			if (window.bootstrap) bootstrap.Dropdown.getOrCreateInstance(opener).hide();
			opener.focus();
			fetchFigures();
		});
	}

	function applyRange(key) {
		ui.range = key;
		ui.from = RANGES[key].from;
		ui.to = RANGES[key].to;
		pick('[data-mkt-from]', pageRoot).value = String(ui.from);
		pick('[data-mkt-to]', pageRoot).value = String(ui.to);
		fetchFigures();
	}

	function wireFilterMenu() {
		for (const option of pickAll('input[name="mkt-segment"]', pageRoot)) {
			option.addEventListener('change', () => {
				if (!option.checked) return;
				ui.filters.segment = option.value;
				fetchFigures();
			});
		}
		for (const picker of pickAll('[data-mkt-filter]', pageRoot)) {
			picker.addEventListener('change', () => {
				ui.filters[picker.getAttribute('data-mkt-filter')] = picker.value;
				fetchFigures();
			});
		}
		refs.clear.addEventListener('click', clearFilters);
		refs.stateBox.addEventListener('click', (event) => {
			if (event.target.closest('[data-mkt-clear-state]')) clearFilters();
			const retry = event.target.closest('[data-mkt-retry]');
			if (retry) fetchFigures(retry);
		});
	}

	function clearFilters() {
		ui.filters = { plan: 'all', region: 'all', segment: 'all' };
		for (const picker of pickAll('[data-mkt-filter]', pageRoot)) picker.value = 'all';
		checkAndNotify(pick('#mkt-seg-all', pageRoot));
		fetchFigures();
		announce('Showing every campaign again.');
	}

	/* Ticks a radio and lets the shared segmented and tab controls hear it. */
	function checkAndNotify(radio) {
		radio.checked = true;
		radio.dispatchEvent(new Event('change', { bubbles: true }));
	}

	function wireContentToggle() {
		for (const option of pickAll('input[name="mkt-content"]', pageRoot)) {
			option.addEventListener('change', () => {
				if (!option.checked) return;
				ui.rankBy = option.value;
				paintCardText(ui.model);
				const canvas = pick('canvas[data-mkt-chart="content"]', pageRoot);
				if (drawnOnce.has(canvas)) drawChart(canvas, true);
			});
		}
	}

	/* Controls: the campaign table. */

	function wireTable() {
		for (const option of pickAll('input[name="mkt-status"]', pageRoot)) {
			option.addEventListener('change', () => {
				if (!option.checked || !ui.model) return;
				ui.table.phase = option.value;
				paintTable();
			});
		}

		let pause = 0;
		refs.search.addEventListener('input', () => {
			clearTimeout(pause);
			pause = setTimeout(() => {
				ui.table.query = refs.search.value;
				paintTable();
			}, 150);
		});
		refs.channelPicker.addEventListener('change', () => {
			ui.table.channel = refs.channelPicker.value;
			paintTable();
		});

		for (const header of pickAll('[data-mkt-sort]', pageRoot)) {
			const button = pick('button', header);
			button.addEventListener('click', () => {
				const key = header.getAttribute('data-mkt-sort');
				if (ui.table.sortBy === key) {
					ui.table.direction *= -1;
				} else {
					ui.table.sortBy = key;
					ui.table.direction = ASCENDING_FIRST.includes(key) ? 1 : -1;
				}
				paintTable();
				announce(
					`Sorted by ${button.textContent.trim()}${ui.table.direction > 0 ? ', lowest first' : ', highest first'}.`,
				);
			});
		}

		refs.noMatches.addEventListener('click', (event) => {
			if (!event.target.closest('[data-mkt-table-reset]')) return;
			Object.assign(ui.table, { channel: 'all', phase: 'all', query: '' });
			refs.search.value = '';
			refs.channelPicker.value = 'all';
			checkAndNotify(pick('#mkt-status-all', pageRoot));
			paintTable();
		});
	}

	/* A click anywhere else on a campaign's row opens its full page, like its
     name does; Cmd, Ctrl, Shift or the middle button use a new tab. */
	function wireRowClicks() {
		pageRoot.addEventListener('click', (event) => {
			const opener = event.target.closest('[data-mkt-open]');
			if (opener) {
				revealCampaign(opener.getAttribute('data-mkt-open'));
				return;
			}
			const address = rowAddress(event);
			if (!address) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey) window.open(address, '_blank');
			else location.href = address;
		});
		pageRoot.addEventListener('auxclick', (event) => {
			const address = event.button === 1 && rowAddress(event);
			if (address) window.open(address, '_blank');
		});
	}

	function rowAddress(event) {
		const row = event.target.closest('tr[data-mkt-row]');
		if (!row || event.target.closest('button, a')) return '';
		return pick('.mkt-open', row).href;
	}

	/**
	 * Narrows the table to one channel, clearing the other table filters, and
	 * scrolls it into view. Charts call this when a channel is clicked.
	 */
	function focusChannel(channelId) {
		Object.assign(ui.table, { channel: channelId, phase: 'all', query: '' });
		refs.search.value = '';
		refs.channelPicker.value = channelId;
		refreshSelect(refs.channelPicker);
		checkAndNotify(pick('#mkt-status-all', pageRoot));
		paintTable();
		pick('#mkt-campaigns', pageRoot).scrollIntoView({ behavior: calmMotion() ? 'auto' : 'smooth', block: 'start' });
		notify({
			tone: 'info',
			title: `Showing ${lookup(SAMPLE.channels, channelId).name} campaigns`,
			text: 'Pick All channels above the table to see the rest.',
		});
	}

	/* Finder and exports. */

	function setUpFinder() {
		pick('[data-mkt-find-list]', pageRoot).innerHTML = SAMPLE.channels.map(finderGroup).join('');
		const finder = pick('[data-mkt-find]', pageRoot);
		const dialog = pick('#mkt-find', pageRoot);
		finder.setAttribute('data-basalt-command', '');
		window.Basalt.command?.(finder);
		/* The drawer opens only after the dialog has closed, so focus can land in it. */
		finder.addEventListener('basalt:command', (event) => {
			const id = event.detail?.value;
			if (!id) return;
			dialog.addEventListener('hidden.bs.modal', () => revealCampaign(id), { once: true });
			bootstrap.Modal.getOrCreateInstance(dialog).hide();
		});
	}

	function finderGroup(group) {
		const items = SAMPLE.campaigns
			.filter((info) => info.channel === group.id)
			.map((info) => {
				const phaseName = PHASES[phaseOf(info)].name;
				return (
					`<div class="basalt-command-item" role="option" id="mkt-find-${info.id}" aria-selected="false" data-value="${info.id}" data-keywords="${htmlSafe(`${info.owner} ${phaseName} ${group.short}`)}">` +
					'<span class="basalt-command-icon" aria-hidden="true"><i class="bi bi-megaphone"></i></span>' +
					`<span class="basalt-command-label">${htmlSafe(info.name)}</span><span class="basalt-command-hint">${phaseName} · ${htmlSafe(info.owner)}</span></div>`
				);
			})
			.join('');
		return `<div class="basalt-command-group" role="group" aria-labelledby="mkt-find-g-${group.id}"><div class="basalt-command-heading" id="mkt-find-g-${group.id}">${htmlSafe(group.name)}</div>${items}</div>`;
	}

	function wireExports() {
		/* The dialog tells how many rows each choice holds and what it covers. */
		const dialog = pick('#mkt-export', pageRoot);
		dialog.addEventListener('show.bs.modal', (event) => {
			if (!ui.model) {
				event.preventDefault();
				return;
			}
			const sizes = {
				channels: [SAMPLE.channels.length, 'channel'],
				months: [ui.to - ui.from + 1, 'month'],
				campaigns: [ui.model.campaigns.length, 'campaign'],
			};
			for (const [kind, [rows, unit]] of Object.entries(sizes)) {
				pick(`[data-mkt-export-count="${kind}"]`, dialog).textContent =
					`${rows}${rows === 1 ? ' row' : ' rows'}, one per ${unit}`;
			}
			pick('[data-mkt-export-scope]', dialog).textContent =
				`Covers ${periodText(ui.from, ui.to)} for ${describeFilters()}. A CSV file opens in any spreadsheet.`;
		});
		pick('[data-mkt-export-form]', pageRoot).addEventListener('submit', (event) => {
			event.preventDefault();
			const kind = pick('input[name="mkt-export"]:checked', dialog).value;
			bootstrap.Modal.getOrCreateInstance(dialog).hide();
			EXPORTERS[kind]();
		});
		pick('[data-mkt-table-export]', pageRoot).addEventListener('click', () => {
			if (ui.model) exportCampaigns(shownCampaigns, 'marketing-campaigns-shown-');
		});
		pick('[data-mkt-sheet-export]', panel).addEventListener('click', exportOpenCampaign);
	}

	function exportChannels() {
		const head = [
			'Channel',
			'Spend',
			'Budget',
			'Leads',
			'Sales-qualified',
			'Opportunities',
			'New customers',
			'Pipeline',
			'Pipeline per $1',
			'Cost per customer',
			'Payback months',
			'Last-touch pipeline',
			'Period',
			'Plan',
			'Region',
			'Segment',
		];
		const rows = ui.model.channels.map(({ info, sums, lastTouch }) => [
			info.name,
			sums.spend,
			sums.budget,
			sums.leads,
			sums.sqls,
			sums.opps,
			sums.won,
			sums.pipeline,
			sums.roi == null ? '' : sums.roi.toFixed(2),
			sums.cac == null ? '' : Math.round(sums.cac),
			sums.payback == null ? '' : sums.payback.toFixed(1),
			lastTouch,
			periodText(ui.from, ui.to),
			...filterCells(),
		]);
		return download(`marketing-channels-${periodSlug()}.csv`, [head, ...rows], 'the channel summary');
	}

	function exportMonths() {
		const head = [
			'Month',
			'Spend',
			'Budget',
			'Leads',
			'Sales-qualified',
			'Opportunities',
			'New customers',
			'Pipeline',
			'Yearly value won',
			'Plan',
			'Region',
			'Segment',
		];
		const perMonth = groupTotals(ui.payload.facts, (row) => row.m);
		const rows = [];
		for (let month = ui.from; month <= ui.to; month += 1) {
			const sums = perMonth[month] || zeroed();
			rows.push([
				isoMonth(month),
				sums.spend,
				sums.budget,
				sums.leads,
				sums.sqls,
				sums.opps,
				sums.won,
				sums.pipeline,
				sums.arr,
				...filterCells(),
			]);
		}
		return download(`marketing-months-${periodSlug()}.csv`, [head, ...rows], 'month by month');
	}

	/**
	 * @param {object[]} [list] only these table entries; every campaign if left out
	 * @param {string} [prefix] the file name before the period
	 */
	function exportCampaigns(list, prefix) {
		const head = [
			'Campaign',
			'Channel',
			'Owner',
			'Status',
			'Starts',
			'Ends',
			'Spend',
			'Pipeline',
			'New customers',
			'Cost per customer',
			'Pipeline ROI',
			'Period',
			'Plan',
			'Region',
			'Segment',
		];
		const rows = (list || ui.model.campaigns).map(({ info, phase, sums }) => [
			info.name,
			lookup(SAMPLE.channels, info.channel).name,
			info.owner,
			PHASES[phase].name,
			info.start,
			info.end || '',
			sums.spend,
			sums.pipeline,
			sums.won,
			sums.cac == null ? '' : Math.round(sums.cac),
			sums.roi == null ? '' : sums.roi.toFixed(2),
			periodText(ui.from, ui.to),
			...filterCells(),
		]);
		return download(
			`${prefix || 'marketing-campaigns-'}${periodSlug()}.csv`,
			[head, ...rows],
			list ? 'the campaigns shown' : 'every campaign',
		);
	}

	function exportOpenCampaign() {
		const id = ui.openId;
		const info = lookup(SAMPLE.campaigns, id);
		const head = [
			'Campaign',
			'Month',
			'Spend',
			'Leads',
			'Sales-qualified',
			'Opportunities',
			'New customers',
			'Pipeline',
			'Yearly value won',
		];
		const rows = [];
		for (let month = ui.from; month <= ui.to; month += 1) {
			const row = ui.model.campaignMonths.find((item) => item.id === id && item.m === month);
			if (row)
				rows.push([
					info.name,
					isoMonth(month),
					row.spend,
					row.leads,
					row.sqls,
					row.opps,
					row.won,
					row.pipeline,
					row.arr,
				]);
		}
		download(`${info.id}-${periodSlug()}.csv`, [head, ...rows], info.name);
	}

	function filterCells() {
		const { plan, region, segment } = ui.filters;
		return [
			plan === 'all' ? 'All plans' : lookup(SAMPLE.plans, plan).name,
			region === 'all' ? 'All regions' : lookup(SAMPLE.regions, region).name,
			segment === 'all' ? 'Both' : lookup(SAMPLE.segments, segment).name,
		];
	}

	function periodSlug() {
		return `${isoMonth(ui.from)}-to-${isoMonth(ui.to)}`;
	}

	async function download(fileName, table, what) {
		try {
			await server.download(fileName, table);
			notify({ tone: 'success', title: `Exported ${what}`, text: `Saved as ${fileName}.` });
		} catch {
			notify({
				tone: 'danger',
				title: `Could not export ${what}`,
				text: 'Nothing was saved. Try again in a moment.',
			});
		}
	}

	/* Drawing charts: once a canvas scrolls near, then again whenever the
     data or the theme changes. */

	function watchCanvases() {
		const canvases = pickAll('canvas[data-mkt-chart]', pageRoot).filter((canvas) => !canvas.closest('.mkt-sheet'));
		if (!('IntersectionObserver' in window)) {
			for (const canvas of canvases) drawnOnce.add(canvas);
		} else {
			const watcher = new IntersectionObserver(
				(sightings) => {
					for (const { isIntersecting, target } of sightings) {
						if (!isIntersecting) continue;
						watcher.unobserve(target);
						drawnOnce.add(target);
						drawChart(target, true);
					}
				},
				{ rootMargin: '80px 0px' },
			);
			for (const canvas of canvases) watcher.observe(canvas);
		}
		/* Tokens switch with the attribute, so the next frame reads the new ones. */
		document.addEventListener('basalt:appearance', () => {
			keptColors = null;
			requestAnimationFrame(repaintCharts);
		});
	}

	function drawChart(canvas, animate) {
		if (typeof Chart === 'undefined' || !ui.model) return;
		const recipe = RECIPES[canvas.getAttribute('data-mkt-chart')];
		if (!recipe) return;
		liveCharts.get(canvas)?.destroy();
		liveCharts.set(canvas, new Chart(canvas, recipe(chartColors(), animate && !calmMotion(), canvas)));
	}

	function dropChart(canvas) {
		const chart = canvas && liveCharts.get(canvas);
		if (!chart) return;
		chart.destroy();
		liveCharts.delete(canvas);
	}

	function repaintCharts() {
		for (const canvas of drawnOnce) drawChart(canvas, false);
		const drawerCanvas = pick('.mkt-sheet canvas', pageRoot);
		if (drawerCanvas && ui.openId && panel.classList.contains('show')) drawChart(drawerCanvas, false);
	}

	/* Chart recipes. */

	/* A headline sparkline: twelve months to the end of the period, with the
     months before the period drawn fainter. */
	function sparkChart(colors, animate, canvas) {
		const { trail } = ui.model;
		const spec = SPARK_SPECS[canvas.getAttribute('data-mkt-spark')];
		const values = trail.map((step) => spec.read(step.sums));
		const stroke = colors.series[spec.color];
		const periodStart = trail.findIndex((step) => step.month === ui.from);
		const known = values.filter((value) => value != null);
		const floor = Math.min(...known);
		const ceiling = Math.max(...known);
		const spread = ceiling - floor || 1;
		const lastIndex = values.length - 1;
		return {
			type: 'line',
			data: {
				labels: trail.map((step) => longMonth(step.month)),
				datasets: [
					{
						label: 'Value',
						data: values,
						borderColor: stroke,
						/* The area runs down to the card's foot in a faint tint. */
						backgroundColor: window.Basalt.chartFill(
							[
								[0, translucent(stroke, 0.34)],
								[1, translucent(stroke, 0.06)],
							],
							{ flat: translucent(stroke, 0.12) },
						),
						fill: 'start',
						tension: 0.35,
						borderWidth: 2,
						spanGaps: true,
						pointRadius: (point) => (point.dataIndex === lastIndex ? 3 : 0),
						pointHoverRadius: 4,
						pointBackgroundColor: stroke,
						pointBorderWidth: 0,
						segment: {
							borderColor: (part) =>
								part.p1DataIndex <= periodStart ? translucent(stroke, 0.35) : stroke,
						},
					},
				],
			},
			options: chartDefaults(colors, animate, {
				layout: { autoPadding: false, padding: { top: 4, right: 0, bottom: 0, left: 0 } },
				plugins: { tooltip: { enabled: false } },
				/* Pointing along the line shows that month in the card. */
				...window.Basalt.sparkReadout?.({
					value: pick('[data-mkt-kpi-value]', canvas.closest('[data-mkt-kpi]')),
					note: pick('[data-mkt-kpi-delta]', canvas.closest('[data-mkt-kpi]')),
					labels: trail.map((step) => longMonth(step.month)),
					format: spec.show,
				}),
				scales: {
					x: { display: false },
					y: { display: false, min: floor - spread * 0.6, max: ceiling + spread * 0.1 },
				},
			}),
		};
	}

	/* Spend along the bottom, pipeline per dollar up the side, and new
     customers as the size of each bubble. */
	function quadrantChart(colors, animate, canvas) {
		const { model } = ui;
		const spending = model.channels.filter((entry) => entry.sums.spend > 0);
		const middleX = spending.reduce((sum, entry) => sum + entry.sums.spend, 0) / (spending.length || 1);
		const middleY = model.totals.roi || 0;
		const reachX = Math.max(...spending.map((entry) => entry.sums.spend), 1) * 1.18;
		const reachY = Math.max(...spending.map((entry) => entry.sums.roi || 0), 1) * 1.2;
		const width = canvas.parentElement.clientWidth;
		const corners = {
			topLeft: 'Room to grow',
			topRight: 'Core engines',
			bottomLeft: 'Small bets',
			bottomRight: 'Costly, check it',
		};

		function bubble(won, room) {
			return within(5 + Math.sqrt(won) * 1.9, 6, 26) * within(room / 520, 0.72, 1.1);
		}

		function axisTitle(text) {
			return { display: true, text, color: colors.quiet, font: AXIS_TYPE };
		}

		return {
			type: 'bubble',
			data: {
				datasets: [
					{
						label: 'Channels',
						data: spending.map(({ info, sums }) => ({
							x: sums.spend,
							y: sums.roi || 0,
							r: bubble(sums.won, width),
							won: sums.won,
							ch: info.id,
							name: info.short,
						})),
						backgroundColor: spending.map(({ info }) => translucent(channelColor(colors, info.id), 0.6)),
						hoverBackgroundColor: spending.map(({ info }) =>
							translucent(channelColor(colors, info.id), 0.9),
						),
						borderColor: spending.map(({ info }) => channelColor(colors, info.id)),
						borderWidth: 1.5,
						hoverRadius: 2,
					},
				],
			},
			options: chartDefaults(colors, animate, {
				interaction: { mode: 'nearest', intersect: true },
				layout: { padding: { top: 10, right: 14 } },
				onHover: pointerOverItems,
				onClick: (event, items) => {
					if (items.length) focusChannel(spending[items[0].index].info.id);
				},
				plugins: {
					tooltip: {
						callbacks: {
							title: (items) => lookup(SAMPLE.channels, items[0].raw.ch).name,
							label: ({ raw }) => [
								` Spend ${asDollars(raw.x)}`,
								` ${perDollar(raw.y)} of pipeline per $1`,
								` ${asCount(raw.won)} new customers`,
							],
							footer: () => 'Click to see its campaigns',
						},
					},
				},
				scales: {
					x: {
						type: 'linear',
						min: 0,
						suggestedMax: reachX,
						border: { color: colors.grid },
						ticks: { maxTicksLimit: 6, callback: (x) => asShortDollars(x) },
						title: axisTitle('Spend in the period'),
					},
					y: {
						min: 0,
						suggestedMax: reachY,
						ticks: { maxTicksLimit: 6, callback: (y) => `$${y.toFixed(0)}` },
						title: axisTitle('Pipeline per $1'),
					},
				},
				onResize(chart, size) {
					for (const point of chart.data.datasets[0].data) point.r = bubble(point.won, size.width);
				},
			}),
			plugins: [
				{
					id: 'mktQuadrants',
					/* Tints the top-left quarter and draws the two dashed averages. */
					beforeDatasetsDraw(chart) {
						const { ctx, chartArea: area, scales } = chart;
						const splitX = scales.x.getPixelForValue(middleX);
						const splitY = scales.y.getPixelForValue(middleY);
						ctx.save();
						ctx.fillStyle = translucent(colors.series[0], gradientsOff() ? 0.05 : 0.07);
						ctx.fillRect(area.left, area.top, splitX - area.left, splitY - area.top);
						ctx.strokeStyle = colors.rest;
						ctx.setLineDash([4, 4]);
						ctx.lineWidth = 1;
						ctx.beginPath();
						ctx.moveTo(splitX, area.top);
						ctx.lineTo(splitX, area.bottom);
						ctx.moveTo(area.left, splitY);
						ctx.lineTo(area.right, splitY);
						ctx.stroke();
						ctx.restore();
					},
					afterDatasetsDraw(chart) {
						const { ctx, chartArea: area } = chart;
						const bounds = { left: area.left, right: area.right };
						drawTag(ctx, colors, area.left + 8, area.top + 28, corners.topLeft, bounds, { align: 'left' });
						drawTag(ctx, colors, area.right - 8, area.top + 28, corners.topRight, bounds, {
							align: 'right',
						});
						drawTag(ctx, colors, area.left + 8, area.bottom - 8, corners.bottomLeft, bounds, {
							align: 'left',
						});
						drawTag(ctx, colors, area.right - 8, area.bottom - 8, corners.bottomRight, bounds, {
							align: 'right',
						});
						const marks = chart.getDatasetMeta(0).data.map((element, index) => ({
							text: spending[index].info.short,
							x: element.x,
							y: element.y,
							r: element.options.radius,
						}));
						labelMarks(ctx, colors, area, marks);
					},
				},
			],
		};
	}

	/* Bullet bars of payback months against the target; shorter is better. */
	function paybackChart(colors, animate) {
		const target = SAMPLE.paybackTarget;
		const rows = ui.model.channels.filter((entry) => entry.sums.spend > 0).sort((a, b) => rank(a) - rank(b));
		/* Beyond four years a bar stops at the edge and its label gives the length. */
		const longest = Math.min(48, Math.max(...rows.map((entry) => entry.sums.payback || 0), target));
		const padded = longest * 1.15;
		const axisEnd = padded > 24 ? Math.ceil(padded / 12) * 12 : Math.ceil(padded / 6) * 6;
		const faintTrack = translucent(colors.text, 0.06);

		function rank(entry) {
			return entry.sums.payback == null ? 1e9 : entry.sums.payback;
		}

		function verdictColor(entry) {
			const healthy = entry.sums.payback != null && entry.sums.payback <= target;
			return healthy ? colors.success : colors.danger;
		}

		return {
			type: 'bar',
			data: {
				labels: rows.map((entry) => entry.info.short),
				datasets: [
					barSeries(colors.success, {
						label: 'Payback',
						data: rows.map((entry) =>
							entry.sums.payback == null ? null : Math.min(entry.sums.payback, axisEnd),
						),
						backgroundColor: rows.map((entry) => translucent(verdictColor(entry), 0.85)),
						hoverBackgroundColor: rows.map(verdictColor),
						barPercentage: 0.36,
						categoryPercentage: 1,
						borderRadius: 4,
						borderSkipped: false,
						grouped: false,
						order: 0,
					}),
					{
						label: 'Track',
						data: rows.map(() => axisEnd),
						backgroundColor: faintTrack,
						hoverBackgroundColor: faintTrack,
						borderRadius: 6,
						borderSkipped: false,
						barPercentage: 0.7,
						categoryPercentage: 1,
						grouped: false,
						order: 1,
					},
				],
			},
			options: chartDefaults(colors, animate, {
				indexAxis: 'y',
				interaction: { mode: 'nearest', axis: 'y', intersect: false },
				layout: { padding: { right: 8 } },
				onHover: pointerOverItems,
				onClick: (event, items) => {
					if (items.length) focusChannel(rows[items[0].index].info.id);
				},
				plugins: {
					tooltip: {
						filter: (item) => item.datasetIndex === 0,
						callbacks: {
							title: (items) => rows[items[0].dataIndex].info.name,
							label: (item) => {
								const { payback, cac } = rows[item.dataIndex].sums;
								if (payback == null) return ' No customers won yet';
								return [
									` ${payback.toFixed(1)} months to pay back`,
									` ${asDollars(cac)} to win each customer`,
								];
							},
						},
					},
				},
				scales: {
					x: {
						min: 0,
						max: axisEnd,
						grid: { color: colors.grid },
						ticks: { stepSize: axisEnd > 36 ? 12 : 6, callback: (months) => `${months} mo` },
					},
					y: { grid: { display: false }, ticks: { color: colors.text, padding: 10, autoSkip: false } },
				},
			}),
			plugins: [
				{
					id: 'mktTarget',
					/* A target tick across every track, and each bar's length in words. */
					afterDatasetsDraw(chart) {
						const {
							ctx,
							scales: { x },
						} = chart;
						const targetX = x.getPixelForValue(target);
						ctx.save();
						for (const [index, track] of chart.getDatasetMeta(1).data.entries()) {
							const half = track.height / 2;
							ctx.strokeStyle = colors.text;
							ctx.lineWidth = 2.5;
							ctx.lineCap = 'round';
							ctx.beginPath();
							ctx.moveTo(targetX, track.y - half + 3);
							ctx.lineTo(targetX, track.y + half - 3);
							ctx.stroke();
							const months = rows[index].sums.payback;
							const words = months == null ? 'No customers yet' : `${months.toFixed(1)} mo`;
							const barEnd = x.getPixelForValue(months == null ? 0 : Math.min(months, axisEnd));
							const roomRight = barEnd + 8 + 64 < chart.chartArea.right;
							drawLabel(
								ctx,
								colors,
								words,
								roomRight ? barEnd + 8 : barEnd - 8,
								track.y + 0.5,
								roomRight ? 'left' : 'right',
							);
						}
						ctx.restore();
					},
				},
			],
		};
	}

	/* Pipeline per month stacked by segment (the stacked recipe from the
     mixed charts page). */
	function monthsChart(colors, animate) {
		const { months } = ui.model;
		const segment = ui.filters.segment;
		const stacks = [];
		if (segment !== 'sales')
			stacks.push(
				barSeries(colors.series[0], {
					label: 'Self-serve',
					data: months.map((row) => row.self),
					stack: 'pipe',
				}),
			);
		if (segment !== 'self')
			stacks.push(
				barSeries(colors.series[4], {
					label: 'Sales-led',
					data: months.map((row) => row.sales),
					stack: 'pipe',
				}),
			);
		return {
			type: 'bar',
			data: { labels: months.map((row) => shortMonth(row.month)), datasets: stacks },
			options: chartDefaults(colors, animate, {
				plugins: {
					tooltip: {
						callbacks: {
							title: (items) => longMonth(months[items[0].dataIndex].month),
							label: (item) => ` ${item.dataset.label}: ${asShortDollars(item.parsed.y)}`,
							footer: (items) => `Total ${asShortDollars(months[items[0].dataIndex].total)}`,
						},
					},
				},
				scales: {
					x: { stacked: true },
					y: { stacked: true, beginAtZero: true, ticks: { callback: (y) => asShortDollars(y) } },
				},
			}),
		};
	}

	/* Content pieces ranked with a running total (the Pareto recipe from the
     mixed charts page); the pieces that reach 80% stay strong. */
	function contentChart(colors, animate) {
		const metric = ui.rankBy;
		const ranked = [...ui.model.content].sort((a, b) => b.sums[metric] - a.sums[metric]);
		const hue = colors.series[2];
		const whole = ranked.reduce((sum, entry) => sum + entry.sums[metric], 0) || 1;
		const shares = ranked.map((entry) => Math.round((entry.sums[metric] / whole) * 1000) / 10);
		const running = [];
		let soFar = 0;
		for (const share of shares) {
			soFar += share;
			running.push(Math.min(100, Math.round(soFar * 10) / 10));
		}
		const lastStrong = Math.max(
			0,
			running.findIndex((value) => value >= 80),
		);
		const strongFill = barGradient(hue);
		const faintFill = barGradient(hue, 0.34, 0.14);
		const noun = metric === 'pipeline' ? 'pipeline' : 'signups';

		return {
			type: 'bar',
			data: {
				labels: ranked.map((entry) => entry.info.short),
				datasets: [
					lineSeries(colors.text, {
						label: 'Running total',
						data: running,
						tension: 0.3,
						borderWidth: 2,
						...hollowPoints(colors, colors.text),
					}),
					barSeries(hue, {
						label: 'Share',
						data: shares,
						barPercentage: 0.62,
						maxBarThickness: 40,
						backgroundColor: (context) =>
							context.dataIndex <= lastStrong ? strongFill(context) : faintFill(context),
						hoverBackgroundColor: (context) =>
							context.dataIndex <= lastStrong ? hue : translucent(hue, 0.55),
					}),
				],
			},
			options: chartDefaults(colors, animate, {
				layout: { padding: { top: 26 } },
				plugins: {
					tooltip: {
						itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
						callbacks: {
							title: (items) => ranked[items[0].dataIndex].info.name,
							label: (item) => {
								if (item.dataset.label !== 'Share') return ` Running total: ${item.parsed.y}%`;
								const { sums } = ranked[item.dataIndex];
								return ` ${metric === 'pipeline' ? asShortDollars(sums.pipeline) : `${asCount(sums.signups)} signups`}, ${item.parsed.y}%`;
							},
						},
					},
				},
				scales: {
					x: { ticks: { autoSkip: false, maxRotation: 55, minRotation: 0 } },
					y: { min: 0, max: 100, ticks: { stepSize: 25, callback: (y) => `${y}%` } },
				},
			}),
			plugins: [
				{
					id: 'mktEighty',
					beforeDatasetsDraw(chart) {
						const { ctx, chartArea: area, scales } = chart;
						const lineY = scales.y.getPixelForValue(80);
						ctx.save();
						ctx.strokeStyle = colors.rest;
						ctx.lineWidth = 1.25;
						ctx.setLineDash([2, 4]);
						ctx.beginPath();
						ctx.moveTo(area.left, lineY);
						ctx.lineTo(area.right, lineY);
						ctx.stroke();
						ctx.restore();
					},
					afterDatasetsDraw(chart) {
						const point = chart.getDatasetMeta(0).data[lastStrong];
						if (!point) return;
						const { chartArea: area } = chart;
						drawTag(
							chart.ctx,
							colors,
							point.x + 10,
							point.y + 26,
							`Top ${lastStrong + 1} · ${Math.round(running[lastStrong])}% of ${noun}`,
							{ left: area.left, right: area.right + 6, top: 0 },
							{ align: 'left', dot: hue },
						);
					},
				},
			],
		};
	}

	/* In the drawer: the open campaign's spend and pipeline, month by month. */
	function campaignChart(colors, animate) {
		const months = [];
		for (let month = ui.from; month <= ui.to; month += 1) {
			const row = ui.model.campaignMonths.find((item) => item.id === ui.openId && item.m === month);
			months.push({ month, spend: row ? row.spend : 0, pipeline: row ? row.pipeline : 0 });
		}
		const sideBySide = { barPercentage: 0.8, categoryPercentage: 0.7 };
		return {
			type: 'bar',
			data: {
				labels: months.map((row) => shortMonth(row.month)),
				datasets: [
					barSeries(colors.series[7], {
						label: 'Spend',
						data: months.map((row) => row.spend),
						...sideBySide,
					}),
					barSeries(colors.series[0], {
						label: 'Pipeline',
						data: months.map((row) => row.pipeline),
						...sideBySide,
					}),
				],
			},
			options: chartDefaults(colors, animate, {
				plugins: {
					tooltip: {
						callbacks: {
							title: (items) => longMonth(months[items[0].dataIndex].month),
							label: (item) => ` ${item.dataset.label}: ${asShortDollars(item.parsed.y)}`,
						},
					},
				},
				scales: { y: { beginAtZero: true, ticks: { callback: (y) => asShortDollars(y) } } },
			}),
		};
	}

	function pointerOverItems(event, items) {
		event.native.target.style.cursor = items.length ? 'pointer' : 'default';
	}

	/* Chart building blocks, the same recipes the chart pages use. */

	function chartColors() {
		if (keptColors) return keptColors;
		const text = readToken('--basalt-copy', '#12233a');
		const muted = readToken('--basalt-copy-muted', '#5f7186');
		keptColors = {
			series: [1, 2, 3, 4, 5, 6, 7, 8].map((slot) => readToken(`--basalt-series-${slot}`, '#2b6fd4')),
			text,
			/* Matches --mkt-quiet in the stylesheet, share for share. */
			quiet: blend(muted, text, 0.72),
			rest: translucent(text, 0.3),
			grid: translucent(text, 0.07),
			surface: readToken('--basalt-plane', '#ffffff'),
			border: readToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			success: readToken('--basalt-success', '#12c08f'),
			danger: readToken('--basalt-danger', '#ef4d63'),
		};
		return keptColors;
	}

	function readToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	function channelColor(colors, channelId) {
		return colors.series[(lookup(SAMPLE.channels, channelId).tone - 1) % 8];
	}

	function gradientsOff() {
		return docEl.getAttribute('data-basalt-gradients') === 'off';
	}

	/**
	 * The shared Chart.js options, with per-chart overrides merged in deeply.
	 * @param {object} colors from chartColors()
	 * @param {boolean} animate
	 * @param {object} [overrides]
	 */
	function chartDefaults(colors, animate, overrides) {
		const ticks = { color: colors.quiet, font: AXIS_TYPE, padding: 8 };
		const bodyType = { family: TYPEFACE, size: 12 };
		return layered(
			{
				responsive: true,
				maintainAspectRatio: false,
				animation: animate ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				layout: { padding: { top: 6, right: 6 } },
				elements: {
					line: { borderWidth: 2.5, borderCapStyle: 'round', borderJoinStyle: 'round' },
					point: { radius: 0, hoverRadius: 5, hoverBorderWidth: 2, hoverBorderColor: colors.surface },
					bar: { borderRadius: 6, borderSkipped: 'start' },
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: colors.surface,
						titleColor: colors.text,
						bodyColor: colors.text,
						footerColor: colors.text,
						borderColor: colors.border,
						borderWidth: 1,
						padding: 10,
						cornerRadius: 8,
						boxPadding: 4,
						usePointStyle: true,
						titleFont: { ...bodyType, weight: '600' },
						bodyFont: bodyType,
						footerFont: { family: TYPEFACE, size: 11.5, weight: '600' },
					},
				},
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: { ...ticks, maxRotation: 0, autoSkipPadding: 12 },
					},
					y: {
						grid: { color: colors.grid },
						border: { display: false },
						ticks: { ...ticks, maxTicksLimit: 5 },
					},
				},
			},
			overrides,
		);
	}

	function layered(base, overrides) {
		const merged = { ...base };
		for (const [key, value] of Object.entries(overrides || {})) {
			merged[key] = isPlain(value) && isPlain(merged[key]) ? layered(merged[key], value) : value;
		}
		return merged;

		function isPlain(value) {
			return value && typeof value === 'object' && !Array.isArray(value);
		}
	}

	/* A top-to-bottom fade across the plot; with gradients off, one plain
	   color: `flat`, or the first stop. */
	function verticalGradient(stops, flat) {
		return window.Basalt.chartFill(stops, { flat });
	}

	function barGradient(color, top, bottom) {
		return verticalGradient([
			[0, translucent(color, top ?? 0.95)],
			[1, translucent(color, bottom ?? 0.42)],
		]);
	}

	function barSeries(color, extra) {
		return {
			type: 'bar',
			backgroundColor: barGradient(color),
			hoverBackgroundColor: color,
			barPercentage: 0.58,
			categoryPercentage: 0.8,
			maxBarThickness: 34,
			order: 2,
			...extra,
		};
	}

	function lineSeries(color, extra) {
		return {
			type: 'line',
			order: 0,
			borderColor: color,
			backgroundColor: color,
			pointBackgroundColor: color,
			pointHoverBackgroundColor: color,
			tension: 0.35,
			...extra,
		};
	}

	/* Points drawn as rings in the card color, filled on hover. */
	function hollowPoints(colors, color, radius = 3.5) {
		return {
			pointRadius: radius,
			pointHoverRadius: 5.5,
			pointBackgroundColor: colors.surface,
			pointBorderColor: color,
			pointBorderWidth: 2,
			pointHoverBackgroundColor: color,
			pointHoverBorderColor: colors.surface,
		};
	}

	/**
	 * Paints a rounded tag with a label on the canvas, body text on the card
	 * color so it reads the same on every palette. Kept inside bounds.
	 * @param {{align?: 'left'|'right', dot?: string}} [look]
	 */
	function drawTag(ctx, colors, x, y, text, bounds, look = {}) {
		const height = 21;
		ctx.save();
		ctx.font = `600 11px ${TYPEFACE}`;
		const dotRoom = look.dot ? 12 : 0;
		const width = ctx.measureText(text).width + 16 + dotRoom;
		const anchored = { left: x, right: x - width }[look.align] ?? x - width / 2;
		const left = Math.max(bounds.left, Math.min(anchored, bounds.right - width));
		const top = Math.max(bounds.top == null ? -Infinity : bounds.top, y - height);
		ctx.fillStyle = colors.surface;
		ctx.strokeStyle = colors.border;
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
		ctx.fillStyle = colors.text;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(text, left + 8 + dotRoom, top + height / 2 + 0.5);
		ctx.restore();
	}

	/* Text written straight onto the chart, outlined in the card color so it
     stays legible where it crosses a mark. */
	function drawLabel(ctx, colors, text, x, y, align, color) {
		ctx.save();
		ctx.font = `600 11.5px ${TYPEFACE}`;
		ctx.textAlign = align || 'left';
		ctx.textBaseline = 'middle';
		ctx.lineJoin = 'round';
		ctx.lineWidth = 4;
		ctx.strokeStyle = colors.surface;
		ctx.strokeText(text, x, y);
		ctx.fillStyle = color || colors.text;
		ctx.fillText(text, x, y);
		ctx.restore();
	}

	/**
	 * Names each mark without letting names overlap (the scatter page's
	 * method): every name tries right, left, above and below, takes the spot
	 * with the fewest clashes, and is skipped when every spot collides.
	 */
	function labelMarks(ctx, colors, area, marks) {
		const taken = [];
		ctx.save();
		ctx.font = `600 11.5px ${TYPEFACE}`;

		for (const mark of marks) {
			const width = ctx.measureText(mark.text).width;
			const height = 14;
			const gap = mark.r + 6;
			const spots = [
				{
					x: mark.x + gap,
					y: mark.y,
					align: 'left',
					box: { l: mark.x + gap, r: mark.x + gap + width, t: mark.y - height / 2, b: mark.y + height / 2 },
				},
				{
					x: mark.x - gap,
					y: mark.y,
					align: 'right',
					box: { l: mark.x - gap - width, r: mark.x - gap, t: mark.y - height / 2, b: mark.y + height / 2 },
				},
				{
					x: mark.x,
					y: mark.y - gap - height / 2 + 2,
					align: 'center',
					box: { l: mark.x - width / 2, r: mark.x + width / 2, t: mark.y - gap - height, b: mark.y - gap },
				},
				{
					x: mark.x,
					y: mark.y + gap + height / 2 - 2,
					align: 'center',
					box: { l: mark.x - width / 2, r: mark.x + width / 2, t: mark.y + gap, b: mark.y + gap + height },
				},
			];
			let chosen = null;
			let fewest = Infinity;
			for (const spot of spots) {
				const { box } = spot;
				const inside =
					box.l >= area.left - 2 && box.r <= area.right + 4 && box.t >= area.top - 4 && box.b <= area.bottom;
				const clashes =
					(inside ? 0 : 100) +
					taken.filter((other) => boxesMeet(other, box)).length * 10 +
					marks.filter((other) => other !== mark && boxMeetsMark(box, other)).length;
				if (clashes < fewest) {
					chosen = spot;
					fewest = clashes;
				}
			}
			if (!chosen || fewest >= 10) continue;
			taken.push(chosen.box);
			drawLabel(ctx, colors, mark.text, chosen.x, chosen.y, chosen.align);
		}
		ctx.restore();

		function boxesMeet(a, b) {
			return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
		}

		function boxMeetsMark(box, mark) {
			const nearX = within(mark.x, box.l, box.r);
			const nearY = within(mark.y, box.t, box.b);
			return (nearX - mark.x) ** 2 + (nearY - mark.y) ** 2 < (mark.r + 2) ** 2;
		}
	}

	/* Color helpers. Tokens arrive as #rrggbb or rgba(); Chart.js wants plain
     strings it can read, so mixing happens here instead of color-mix(). */

	function rgbaParts(color) {
		const text = String(color || '').trim();
		const short = text.match(/^#([0-9a-f]{3})$/i);
		if (short) return [...short[1]].map((digit) => parseInt(digit + digit, 16)).concat(1);
		const long = text.match(/^#([0-9a-f]{6})$/i);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 1];
		}
		const call = text.match(/^rgba?\(([^)]+)\)$/i);
		if (!call) return [128, 128, 128, 1];
		const [red, green, blue, alpha] = call[1]
			.split(/[\s,/]+/)
			.filter(Boolean)
			.map((part) => parseFloat(part));
		return [red, green, blue, alpha === undefined ? 1 : alpha];
	}

	function translucent(color, alpha) {
		const [red, green, blue] = rgbaParts(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	function blend(first, second, share) {
		const a = rgbaParts(first);
		const b = rgbaParts(second);
		const [red, green, blue] = [0, 1, 2].map((index) => Math.round(a[index] * share + b[index] * (1 - share)));
		return `rgb(${red}, ${green}, ${blue})`;
	}

	/* Months and dates. Month 0 is SAMPLE.firstMonth; numbers past the last
     sample month are fine and feed the calendar's look ahead. */

	function calendarOf(month) {
		const year = +SAMPLE.firstMonth.slice(0, 4);
		const offset = +SAMPLE.firstMonth.slice(5, 7) - 1 + month;
		return { year: year + Math.floor(offset / 12), month: ((offset % 12) + 12) % 12 };
	}

	function monthsSinceStart(date) {
		const origin = calendarOf(0);
		return (date.getFullYear() - origin.year) * 12 + date.getMonth() - origin.month;
	}

	function shortMonth(month) {
		return MONTH_ABBR[calendarOf(month).month];
	}

	function longMonth(month) {
		const { year, month: index } = calendarOf(month);
		return `${MONTH_ABBR[index]} ${year}`;
	}

	function isoMonth(month) {
		const { year, month: index } = calendarOf(month);
		return `${year}-${String(index + 1).padStart(2, '0')}`;
	}

	function periodText(first, last) {
		if (first === last) return longMonth(first);
		const start = calendarOf(first);
		const end = calendarOf(last);
		if (start.year !== end.year) return `${longMonth(first)}–${longMonth(last)}`;
		return `${MONTH_ABBR[start.month]}–${MONTH_ABBR[end.month]} ${end.year}`;
	}

	function firstOfMonth(month) {
		const { year, month: index } = calendarOf(month);
		return new Date(year, index, 1);
	}

	function parseDay(isoDate) {
		const [year, month, date] = isoDate.split('-').map(Number);
		return new Date(year, month - 1, date);
	}

	function prettyDate(isoDate) {
		return parseDay(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	/**
	 * The share of a month, 0 to 1, that a campaign was running. A paused
	 * campaign stops counting on its pause date unless wholeRun asks for its
	 * full span.
	 */
	function runShare(info, month, wholeRun) {
		const monthOpens = firstOfMonth(month);
		const monthCloses = firstOfMonth(month + 1);
		const stopDay = info.end || (!wholeRun && info.paused) || null;
		const runEnds = stopDay ? new Date(parseDay(stopDay).getTime() + DAY_MS) : new Date(8640000000000000);
		const from = Math.max(monthOpens, parseDay(info.start));
		const until = Math.min(monthCloses, runEnds);
		return until > from ? (until - from) / (monthCloses - monthOpens) : 0;
	}

	function phaseOf(info) {
		if (parseDay(info.start) > NOW_DAY) return 'scheduled';
		if (info.paused) return 'paused';
		return info.end && parseDay(info.end) < NOW_DAY ? 'ended' : 'live';
	}

	/* Number formats. */

	function asCount(value) {
		return Math.round(value).toLocaleString('en-US');
	}

	function asDollars(value) {
		return `$${asCount(value)}`;
	}

	function asShortDollars(value) {
		const size = Math.abs(value);
		const sign = value < 0 ? '−' : '';
		if (size >= 1e6) return `${sign}$${(size / 1e6).toFixed(size >= 1e7 ? 1 : 2)}M`;
		if (size >= 1e3) return `${sign}$${(size / 1e3).toFixed(size >= 1e5 ? 0 : 1).replace(/\.0$/, '')}k`;
		return `${sign}$${Math.round(size)}`;
	}

	function perDollar(value) {
		return value == null ? 'none' : `$${value.toFixed(2)}`;
	}

	function oneDecimal(value) {
		return value == null ? 'none' : value.toFixed(1);
	}

	function within(value, low, high) {
		return Math.max(low, Math.min(high, value));
	}

	/* Small page utilities. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function lookup(list, id) {
		return list.find((item) => item.id === id);
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (char) => entities[char]);
	}

	function csvField(value) {
		const text = String(value ?? '');
		return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
	}

	function notify(message) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(message) : null;
	}

	function announce(text) {
		window.Basalt.announce?.(text);
	}

	function calmMotion() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function later(ms, value) {
		return new Promise((resolve) => setTimeout(() => resolve(value), ms));
	}

	/* Demo data only: turns SAMPLE into the monthly rows a warehouse would
     return. A real server sends rows of this shape, so none of what follows
     is needed once server.figures() fetches. */

	/* mulberry32, seeded, so every load produces the same demo. */
	function prng(seed) {
		let bits = seed >>> 0;
		return function next() {
			bits = (bits + 0x6d2b79f5) | 0;
			let mixed = Math.imul(bits ^ (bits >>> 15), 1 | bits);
			mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	/**
	 * One row per month, channel, region, segment and plan, with spend,
	 * budget and every funnel count, then nudged so the reported sign-up
	 * month matches the figure the other pages quote.
	 */
	function buildFacts(sample) {
		const random = prng(2026);

		/* A fractional count becomes whole by rounding up as often as its
       fraction says, so totals stay honest across many rows. */
		function roundByChance(amount) {
			const floor = Math.floor(amount);
			return floor + (random() < amount - floor ? 1 : 0);
		}

		const firstCalendarMonth = calendarOf(0).month;
		const rows = [];
		for (let m = 0; m < sample.months; m += 1) {
			const season = sample.season[(firstCalendarMonth + m) % 12];
			for (const source of sample.channels) {
				const planned = source.spend * Math.pow(1 + source.growth, m);
				const spent = planned * (0.9 + random() * 0.18) * (0.6 + 0.4 * season);
				const leadsAll = (spent / source.cpl) * (0.9 + random() * 0.2) * season;
				/* A self-serve lead costs a little over half what a sales-led one does. */
				const selfCost = source.selfServe * 0.55;
				const spendShare = {
					self: selfCost / (selfCost + 1 - source.selfServe),
					sales: (1 - source.selfServe) / (selfCost + 1 - source.selfServe),
				};
				const leadShare = { self: source.selfServe, sales: 1 - source.selfServe };
				for (const area of sample.regions) {
					for (const buyer of sample.segments) {
						for (const planId of Object.keys(buyer.mix)) {
							const tier = lookup(sample.plans, planId);
							const portion = area.share * spendShare[buyer.id] * buyer.mix[planId];
							const leads = roundByChance(
								leadsAll * area.share * leadShare[buyer.id] * buyer.mix[planId],
							);
							const sqls = roundByChance(leads * source.sql * (0.92 + random() * 0.16));
							const opps = roundByChance(sqls * source.opp);
							const won = roundByChance(opps * tier.win * (0.9 + random() * 0.2));
							rows.push({
								m,
								ch: source.id,
								region: area.id,
								seg: buyer.id,
								plan: planId,
								spend: Math.round(spent * portion),
								budget: Math.round(planned * portion),
								leads,
								sqls,
								opps,
								won,
								pipeline: opps * tier.arr,
								arr: won * tier.arr,
							});
						}
					}
				}
			}
		}
		if (sample.signups) matchReportedSignups(sample, rows);
		return rows;
	}

	/* Pins the month the company reports sign-ups for, so this page agrees
     with the others; the difference goes to that month's largest rows. */
	function matchReportedSignups(sample, rows) {
		const [year, month] = sample.signups.month.split('-').map(Number);
		const target = (year - +sample.firstMonth.slice(0, 4)) * 12 + month - +sample.firstMonth.slice(5, 7);
		const biggest = rows.filter((row) => row.m === target).sort((a, b) => b.leads - a.leads);
		let gap = sample.signups.leads - biggest.reduce((sum, row) => sum + row.leads, 0);
		for (let at = 0; gap !== 0 && biggest.length; at = (at + 1) % biggest.length) {
			const row = biggest[at];
			const nudge = gap > 0 ? 1 : row.leads > row.sqls ? -1 : 0;
			row.leads += nudge;
			gap -= nudge;
		}
	}

	/**
	 * Splits a whole number by weight into whole parts that add back to it,
	 * handing the leftover units to the largest remainders.
	 */
	function splitWhole(total, weights) {
		const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
		if (!weightSum) return weights.map(() => 0);
		const exact = weights.map((weight) => (total * weight) / weightSum);
		const parts = exact.map((value) => Math.floor(value));
		const leftover = total - parts.reduce((sum, part) => sum + part, 0);
		const byRemainder = exact
			.map((value, index) => ({ index, remainder: value - parts[index] }))
			.sort((a, b) => b.remainder - a.remainder);
		for (const { index } of byRemainder.slice(0, Math.max(0, Math.ceil(leftover)))) parts[index] += 1;
		return parts;
	}

	/* Hands each channel's month to the campaigns live in it, by weight and
     by how much of the month each one ran. */
	function campaignRows(facts) {
		const cells = groupTotals(facts, (row) => `${row.m}|${row.ch}`);
		const rows = [];
		for (const [key, sums] of Object.entries(cells)) {
			const [monthText, channelId] = key.split('|');
			const month = +monthText;
			const running = SAMPLE.campaigns
				.filter((info) => info.channel === channelId)
				.map((info) => ({ info, weight: info.weight * runShare(info, month) }))
				.filter(({ weight }) => weight > 0);
			const weights = running.map(({ weight }) => weight);
			const shares = Object.fromEntries(SPLIT_FIELDS.map((field) => [field, splitWhole(sums[field], weights)]));
			for (const [index, { info }] of running.entries()) {
				const row = { id: info.id, m: month };
				for (const field of SPLIT_FIELDS) row[field] = shares[field][index];
				rows.push(row);
			}
		}
		return rows;
	}

	/* The Content and SEO channel's signups and pipeline, piece by piece. */
	function contentRows(facts) {
		const perMonth = groupTotals(
			facts.filter((row) => row.ch === 'content'),
			(row) => row.m,
		);
		const rows = [];
		for (const [monthText, sums] of Object.entries(perMonth)) {
			const signups = splitWhole(
				sums.leads,
				SAMPLE.content.map((piece) => piece.weight),
			);
			const pipeline = splitWhole(
				sums.pipeline / PIPELINE_STEP,
				SAMPLE.content.map((piece) => piece.pipelineWeight),
			);
			for (const [index, piece] of SAMPLE.content.entries()) {
				rows.push({
					id: piece.id,
					m: +monthText,
					signups: signups[index],
					pipeline: pipeline[index] * PIPELINE_STEP,
					views: Math.round(signups[index] * piece.viewsPer * 10),
				});
			}
		}
		return rows;
	}
})();
