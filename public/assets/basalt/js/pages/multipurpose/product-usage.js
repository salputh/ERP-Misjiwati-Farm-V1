/**
 * Product usage report for product-usage.html, the page carrying
 * [data-pu-root]. It shows who uses Fieldline and how: active people by
 * day, week and month, how regular each plan is, which features and
 * actions get used, whether new workspaces finish setup and stick around,
 * how full the paid seats are, which accounts are slipping, and the
 * people who are in the most.
 *
 * Nothing on the page is written into the markup. Every figure comes from
 * the report that backend.report() hands back, so wiring in real numbers
 * means one of two things: swap SAMPLE for your own records and let the
 * sample engine below keep building the report, or have backend.report()
 * fetch a finished report from your server in the shape documented above
 * buildReport().
 *
 * Two query switches show the other states: ?state=error fails the first
 * load (Try again then works) and ?state=empty pretends there are no
 * accounts at all.
 *
 * Charts behave like the ones on the chart pages: they take their colors
 * from the --basalt-* tokens, draw the first time they scroll into view,
 * and redraw after basalt:appearance or whenever the report changes. The
 * shared helpers in basalt.js supply the rest: the segmented control,
 * styled selects, the command menu, filter chips, paging, the drawer,
 * toasts and the live region.
 */
(() => {
	'use strict';

	const host = pick('[data-pu-root]');
	if (!host || typeof Chart === 'undefined') return;

	/*
	 * Sample records for Fieldline, a scheduling tool for crews who work at
	 * the customer's door: home care, pet care, photography and cleaning.
	 * Schedulers and office staff use it at a desk, the people out on visits
	 * use the phone app. Seats are sold on three plans (Basic $15, Pro $32,
	 * Max $58 per seat per month) across four regions, bought either online
	 * with a card or through the sales team.
	 *
	 * totals    every paying account on the last day, per plan: how many
	 *           accounts, paid seats, seat holders seen in the last 30
	 *           days, customer portal users seen in the last 30 days (the
	 *           portal is an add-on and needs no seat), and for accounts not
	 *           named below, the daily share of active seat holders and
	 *           their month-on-month trend
	 * accounts  the accounts followed by name; the remainder of each plan is
	 *           spread over regions and channels using mix
	 *           [id, name, plan, region, channel, seats, active, daily, trend, owner]
	 *           seats  seats paid for
	 *           active seat holders seen in the last 30 days, as of today
	 *           daily  the share of them who are in on an ordinary day
	 *           trend  monthly change in active people (-0.06 is 6% fewer)
	 * features  adopt: share of each plan's accounts using it; days: how
	 *           many days a week its users open it; drift: monthly change
	 *           in adoption, in points
	 * events    perDay: times an active person does it on a day they are
	 *           in; drift: monthly change in that rate
	 * signups   new workspaces per day by plan, with the region split and
	 *           the self-serve share of each plan
	 * setup     the five checklist steps; reach is the share of a plan's new
	 *           workspaces that got that far, gain the monthly improvement
	 *           in points that onboarding work brings
	 * retention floor: share of a plan's new workspaces still active long
	 *           after signup; settle: weeks until it levels off
	 * people    [name, account id, role, how often they are in (0 to 1),
	 *           actions on a day they are in, the feature they use most]
	 */
	const SAMPLE = {
		product: 'Fieldline',
		/* The final day that has data; no report reaches past it. */
		lastDay: '2026-09-30',
		/* Growth of the whole customer base on top of each account's own
       trend, per month: 0.014 adds 1.4% more active people. */
		growth: 0.014,
		plans: ['Basic', 'Pro', 'Max'],
		regions: ['Northeast', 'Midwest', 'West', 'South'],
		channels: ['Self-serve', 'Sales-led'],
		totals: {
			Basic: { accounts: 1190, seats: 11200, active: 9100, portal: 2100, daily: 0.66, trend: 0.009 },
			Pro: { accounts: 790, seats: 12300, active: 10600, portal: 8400, daily: 0.695, trend: 0.009 },
			Max: { accounts: 160, seats: 7900, active: 7000, portal: 11000, daily: 0.73, trend: 0.009 },
		},
		/* Region split of the unnamed accounts, and how much of each plan
       buys online without talking to sales. */
		mix: {
			region: { Northeast: 0.47, Midwest: 0.27, West: 0.16, South: 0.1 },
			selfServe: { Basic: 0.91, Pro: 0.58, Max: 0.09 },
		},
		/* Portal users per paid seat at a named account with the add-on,
       and how often they show up. */
		portal: { perSeat: 2.6, daily: 0.07, weekly: 0.32 },
		accounts: [
			[
				'A101',
				'Henderson Facility Services',
				'Max',
				'Midwest',
				'Sales-led',
				240,
				206,
				0.73,
				0.012,
				'Leslie Becker',
			],
			['A102', 'Oakhaven Home Services', 'Max', 'Northeast', 'Sales-led', 310, 265, 0.77, 0.018, 'Connie Reese'],
			['A103', 'Avocet Property Services', 'Max', 'Midwest', 'Sales-led', 150, 92, 0.57, -0.062, 'Leslie Becker'],
			['A104', 'Orbis Media Group', 'Max', 'West', 'Sales-led', 210, 177, 0.69, 0.009, 'Thomas Mack'],
			['A105', 'Canopy Labs', 'Max', 'Northeast', 'Sales-led', 170, 144, 0.66, 0.021, 'Connie Reese'],
			['A106', 'Tidewater Labs', 'Max', 'Northeast', 'Sales-led', 120, 68, 0.53, -0.081, 'Forrest Beasley'],
			[
				'A107',
				'Brightline Photography Group',
				'Max',
				'Midwest',
				'Sales-led',
				260,
				237,
				0.81,
				0.014,
				'Leslie Becker',
			],
			['A108', 'Tamara Facilities', 'Max', 'West', 'Sales-led', 110, 91, 0.64, 0.026, 'Thomas Mack'],
			['A109', 'Andes Outfitters', 'Max', 'South', 'Sales-led', 95, 73, 0.6, -0.024, 'Todd Bishop'],
			[
				'A110',
				'Crestmoor Commercial Cleaning',
				'Max',
				'Midwest',
				'Sales-led',
				180,
				143,
				0.62,
				0.005,
				'Leslie Becker',
			],
			[
				'A111',
				'Northgate Pet Sitting & Walks',
				'Max',
				'Northeast',
				'Sales-led',
				180,
				145,
				0.7,
				0.011,
				'Forrest Beasley',
			],
			['A112', 'Quillfield Film & Photo', 'Max', 'Northeast', 'Self-serve', 64, 59, 0.78, 0.032, 'Connie Reese'],
			['A201', 'Lattice Photography', 'Pro', 'Midwest', 'Self-serve', 24, 20, 0.62, 0.018, 'Alexis Boone'],
			['A202', 'Fernhill Florals', 'Pro', 'Northeast', 'Self-serve', 18, 16, 0.67, 0.024, 'Alexis Boone'],
			['A203', 'Cobalt AI at Home', 'Pro', 'Northeast', 'Sales-led', 42, 26, 0.5, -0.094, 'Forrest Beasley'],
			['A204', 'Vantage Photo & Video', 'Pro', 'South', 'Sales-led', 30, 24, 0.55, 0.007, 'Todd Bishop'],
			['A205', 'Penrose & Finch Tailors', 'Pro', 'Midwest', 'Sales-led', 34, 27, 0.59, -0.018, 'Leslie Becker'],
			['A206', 'Harborline Rentals', 'Pro', 'West', 'Self-serve', 20, 12, 0.43, -0.072, 'Thomas Mack'],
			['A207', 'Spruce Commercial Cleaning', 'Pro', 'Midwest', 'Self-serve', 16, 15, 0.71, 0.029, 'Alexis Boone'],
			['A208', 'Highpoint Dog Walkers', 'Pro', 'Northeast', 'Sales-led', 28, 23, 0.52, 0.004, 'Connie Reese'],
			['A209', 'Stratus Event Studios', 'Pro', 'Northeast', 'Self-serve', 22, 20, 0.64, 0.021, 'Alexis Boone'],
			['A210', 'Ironwood Furniture', 'Pro', 'Northeast', 'Sales-led', 46, 25, 0.41, -0.11, 'Forrest Beasley'],
			['A211', 'Bluefin Pet Services', 'Pro', 'West', 'Sales-led', 26, 21, 0.56, 0.013, 'Thomas Mack'],
			['A212', 'Solace Office Cleaning', 'Pro', 'Midwest', 'Sales-led', 32, 24, 0.49, -0.041, 'Leslie Becker'],
			['A213', 'Rio Claro Surf', 'Pro', 'South', 'Self-serve', 18, 14, 0.53, 0.016, 'Todd Bishop'],
			['A214', 'Tandem Pet Sitters', 'Pro', 'Midwest', 'Self-serve', 15, 13, 0.66, 0.02, 'Alexis Boone'],
			[
				'A215',
				'Waypoint Moving & Storage',
				'Pro',
				'Northeast',
				'Self-serve',
				22,
				14,
				0.46,
				-0.066,
				'Alexis Boone',
			],
			['A216', 'Kiwi Kites Co.', 'Pro', 'West', 'Self-serve', 14, 13, 0.63, 0.027, 'Thomas Mack'],
			['A217', 'Granite Security', 'Pro', 'Northeast', 'Sales-led', 26, 22, 0.6, 0.006, 'Connie Reese'],
			['A218', 'Glint Wedding Photography', 'Pro', 'Midwest', 'Self-serve', 18, 16, 0.57, 0.011, 'Alexis Boone'],
			['A219', 'Copperleaf Studios', 'Pro', 'South', 'Sales-led', 36, 28, 0.52, -0.012, 'Todd Bishop'],
			['A220', 'Orchard Lane Homes', 'Pro', 'Midwest', 'Sales-led', 38, 29, 0.48, -0.035, 'Leslie Becker'],
			['A221', 'Tessellate Photography', 'Pro', 'West', 'Self-serve', 16, 15, 0.74, 0.031, 'Thomas Mack'],
			['A222', 'Northstar Navigation', 'Pro', 'Northeast', 'Self-serve', 15, 13, 0.55, 0.008, 'Alexis Boone'],
			['A301', 'Moss & Stone Gardens', 'Basic', 'Midwest', 'Self-serve', 8, 7, 0.5, 0.015, 'Scaled team'],
			['A302', 'Brookside Cleaning', 'Basic', 'Northeast', 'Self-serve', 5, 4, 0.43, 0.004, 'Scaled team'],
			['A303', 'Tamarisk Studios', 'Basic', 'Midwest', 'Self-serve', 4, 3, 0.39, 0.009, 'Scaled team'],
			['A304', 'Downland Couriers', 'Basic', 'Northeast', 'Self-serve', 12, 9, 0.46, -0.058, 'Scaled team'],
			['A305', 'Kōyō Care Services', 'Basic', 'West', 'Self-serve', 6, 5, 0.53, 0.022, 'Scaled team'],
			['A306', 'Pinewood Pets', 'Basic', 'South', 'Self-serve', 9, 7, 0.38, -0.031, 'Scaled team'],
			['A307', 'Saltmarsh Goods', 'Basic', 'Midwest', 'Self-serve', 5, 3, 0.31, -0.09, 'Scaled team'],
			['A308', 'Redbud Window Cleaning', 'Basic', 'Northeast', 'Self-serve', 7, 6, 0.42, 0.012, 'Scaled team'],
			['A309', 'Brazier Games & Help', 'Basic', 'Northeast', 'Self-serve', 14, 12, 0.48, 0.018, 'Scaled team'],
			['A310', 'Tallgrass Studios', 'Basic', 'Northeast', 'Sales-led', 15, 13, 0.52, 0.006, 'Connie Reese'],
			['A311', 'Opal Jewelry', 'Basic', 'West', 'Self-serve', 4, 3, 0.35, -0.044, 'Scaled team'],
			['A312', 'Brightwater Cleaning', 'Basic', 'Midwest', 'Self-serve', 10, 9, 0.45, 0.01, 'Scaled team'],
			['A313', 'Cielo Foto', 'Basic', 'South', 'Self-serve', 6, 5, 0.49, 0.024, 'Scaled team'],
			['A314', 'Quarry Benson Brewing', 'Basic', 'Northeast', 'Self-serve', 8, 5, 0.36, -0.067, 'Scaled team'],
			['A315', 'Inkwell Photography', 'Basic', 'Midwest', 'Self-serve', 11, 10, 0.52, 0.019, 'Scaled team'],
			['A316', 'Moorings Home Help', 'Basic', 'West', 'Self-serve', 5, 4, 0.46, 0.008, 'Scaled team'],
			['A317', 'Volta Photographers', 'Basic', 'Midwest', 'Sales-led', 13, 10, 0.41, -0.022, 'Leslie Becker'],
			['A318', 'Sierra Limpieza', 'Basic', 'South', 'Self-serve', 3, 2, 0.43, 0.014, 'Scaled team'],
			['A319', 'Thicket Gardening', 'Basic', 'Northeast', 'Self-serve', 9, 8, 0.41, 0.007, 'Scaled team'],
			['A320', 'Judy Data Group', 'Basic', 'West', 'Self-serve', 12, 9, 0.38, -0.038, 'Scaled team'],
			['A321', 'Atlas Moving Services', 'Basic', 'Northeast', 'Self-serve', 7, 6, 0.53, 0.026, 'Scaled team'],
			['A322', 'Wren Carpet Cleaning', 'Basic', 'Midwest', 'Self-serve', 4, 3, 0.56, 0.016, 'Scaled team'],
		],
		features: [
			{ id: 'board', name: 'Scheduling board', adopt: { Basic: 0.96, Pro: 0.99, Max: 1 }, days: 4.8, drift: 0 },
			{ id: 'mobile', name: 'Mobile app', adopt: { Basic: 0.82, Pro: 0.93, Max: 0.97 }, days: 4.5, drift: 0.5 },
			{ id: 'map', name: 'Schedule map', adopt: { Basic: 0.41, Pro: 0.72, Max: 0.9 }, days: 4.2, drift: 0.7 },
			{
				id: 'travel',
				name: 'Travel planning',
				adopt: { Basic: 0.08, Pro: 0.31, Max: 0.58 },
				days: 3.9,
				drift: 2.2,
			},
			{ id: 'invoicing', name: 'Invoicing', adopt: { Basic: 0.71, Pro: 0.84, Max: 0.78 }, days: 2.7, drift: 0.4 },
			{ id: 'quotes', name: 'Quotes', adopt: { Basic: 0.46, Pro: 0.66, Max: 0.74 }, days: 1.9, drift: 0.6 },
			{
				id: 'portal',
				name: 'Customer portal',
				adopt: { Basic: 0.06, Pro: 0.27, Max: 0.52 },
				days: 1.6,
				drift: 1.4,
			},
			{ id: 'sms', name: 'SMS reminders', adopt: { Basic: 0.33, Pro: 0.55, Max: 0.69 }, days: 3.2, drift: 1.1 },
			{ id: 'timesheets', name: 'Timesheets', adopt: { Basic: 0.22, Pro: 0.43, Max: 0.71 }, days: 4, drift: 0.5 },
			{
				id: 'checklists',
				name: 'Visit checklists',
				adopt: { Basic: 0.18, Pro: 0.38, Max: 0.64 },
				days: 3.4,
				drift: 0.9,
			},
			{ id: 'reports', name: 'Reports', adopt: { Basic: 0.39, Pro: 0.64, Max: 0.91 }, days: 1.3, drift: -0.2 },
			{ id: 'api', name: 'Public API', adopt: { Basic: 0.02, Pro: 0.11, Max: 0.47 }, days: 2.3, drift: 0.3 },
		],
		events: [
			{ name: 'Visit status updated', perDay: 5.4, drift: 0.004 },
			{ name: 'Visit booked', perDay: 2.6, drift: 0.006 },
			{ name: 'Photo attached', perDay: 1.9, drift: 0.012 },
			{ name: 'Visit completed', perDay: 1.7, drift: 0.003 },
			{ name: 'Invoice sent', perDay: 0.82, drift: 0.005 },
			{ name: 'Travel planned', perDay: 0.44, drift: 0.025 },
			{ name: 'Quote sent', perDay: 0.36, drift: -0.004 },
			{ name: 'Report exported', perDay: 0.12, drift: -0.014 },
		],
		signups: {
			perDay: { Basic: 67.74, Pro: 43.08, Max: 12.28 },
			region: { Northeast: 0.44, Midwest: 0.3, West: 0.16, South: 0.1 },
			selfServe: { Basic: 0.95, Pro: 0.7, Max: 0.15 },
		},
		setup: [
			{ step: 'Created a workspace', reach: { Basic: 1, Pro: 1, Max: 1 }, gain: 0 },
			{ step: 'Added a team member', reach: { Basic: 0.71, Pro: 0.85, Max: 0.95 }, gain: 0.6 },
			{ step: 'Booked a first visit', reach: { Basic: 0.62, Pro: 0.79, Max: 0.91 }, gain: 0.8 },
			{ step: 'Closed a visit in the app', reach: { Basic: 0.41, Pro: 0.6, Max: 0.8 }, gain: 1.1 },
			{ step: 'Sent a first invoice', reach: { Basic: 0.27, Pro: 0.46, Max: 0.66 }, gain: 1.3 },
		],
		retention: {
			Basic: { floor: 0.24, settle: 3 },
			Pro: { floor: 0.43, settle: 4 },
			Max: { floor: 0.66, settle: 5 },
		},
		people: [
			['Meghan Schultz', 'A101', 'Scheduling manager', 0.97, 64, 'travel'],
			['Marshall Devin', 'A102', 'Head of scheduling', 0.95, 71, 'board'],
			['Carly Caldwell', 'A107', 'Operations director', 0.96, 58, 'reports'],
			['Russ Patton', 'A104', 'Service coordinator', 0.92, 49, 'board'],
			['Clara Vogt', 'A110', 'Cleaning supervisor', 0.86, 37, 'checklists'],
			['Jun Takahashi', 'A108', 'Facilities officer', 0.9, 44, 'mobile'],
			['Pamela McCoy', 'A109', 'Lead care worker', 0.84, 39, 'timesheets'],
			['Ezra Fenwick', 'A105', 'Office manager', 0.88, 46, 'quotes'],
			['Courtney Lowry', 'A112', 'Systems lead', 0.98, 83, 'api'],
			['Silas Fischer', 'A111', 'Scheduler', 0.91, 52, 'board'],
			['Leah Kaplan', 'A201', 'Office manager', 0.93, 47, 'timesheets'],
			['Isaac Hanson', 'A209', 'Operations manager', 0.95, 61, 'map'],
			['Felicia Byrd', 'A207', 'Scheduler', 0.9, 55, 'board'],
			['Ike Rankin', 'A204', 'Scheduling lead', 0.82, 34, 'mobile'],
			['Hope Beck', 'A221', 'Studio manager', 0.94, 66, 'travel'],
			['Tobias Wren', 'A214', 'Owner', 0.87, 31, 'checklists'],
			['Aaliyah Merritt', 'A202', 'Office manager', 0.89, 42, 'invoicing'],
			['Cameron Reid', 'A217', 'Care manager', 0.85, 29, 'quotes'],
			['Audrey Stout', 'A211', 'Pet sitter and walker', 0.83, 33, 'mobile'],
			['Luna Payne', 'A213', 'Scheduler', 0.8, 27, 'sms'],
			['Ben Archer', 'A203', 'Care team lead', 0.72, 30, 'board'],
			['Erica Davis', 'A212', 'Area supervisor', 0.74, 22, 'checklists'],
			['Rory Whitfield', 'A315', 'Owner', 0.9, 24, 'board'],
			['Ann Thornton', 'A313', 'Founder', 0.88, 26, 'timesheets'],
			['Kip Watkins', 'A305', 'Care worker', 0.86, 21, 'mobile'],
			['Ruth Andrews', 'A309', 'Office manager', 0.84, 19, 'sms'],
			['Felix Morgan', 'A321', 'Office manager', 0.89, 23, 'mobile'],
			['Sandra Bledsoe', 'A312', 'Owner', 0.81, 18, 'checklists'],
			['George Thorne', 'A310', 'Owner', 0.83, 20, 'timesheets'],
			['Jean Mackay', 'A322', 'Bookkeeper', 0.92, 25, 'reports'],
		],
	};

	/* The ?state= switch for the error and empty demos. A real server makes
     it unnecessary. */
	const demoMode = new URLSearchParams(location.search).get('state') || '';

	/* Dates travel as whole day numbers counted from 1970, which keeps every
     range a pair of integers and every lookup an index. */
	const MS_PER_DAY = 86400000;
	const FINAL_DAY = isoToDay(SAMPLE.lastDay);
	const FIRST_DAY = FINAL_DAY - 364;

	/* Office work peaks midweek; these weights average out to 1 over a
     week, starting on Sunday. */
	const WEEKDAY_LOAD = (() => {
		const raw = [0.36, 1.13, 1.18, 1.17, 1.12, 0.97, 0.3];
		const perDay = raw.reduce((acc, weight) => acc + weight, 0) / 7;
		return raw.map((weight) => weight / perDay);
	})();

	const featureById = new Map(SAMPLE.features.map((feature) => [feature.id, feature]));
	const PORTAL_SLOT = SAMPLE.features.indexOf(featureById.get('portal'));

	/* The accounts listed by name, then one pooled row for every plan,
     region and channel that soaks up the rest, so the sums land exactly
     on SAMPLE.totals. */
	const namedAccounts = SAMPLE.accounts.map(toAccount);
	const namedById = new Map(namedAccounts.map((account) => [account.id, account]));
	const everyAccount = namedAccounts.concat(poolRemainder());

	/* Plan colors follow the chart ramp: Max first, Basic third. */
	const PLAN_TONE = { Basic: 3, Pro: 2, Max: 1 };
	const EVENT_SWATCHES = 8;
	const STAY_MARKS = [1, 4, 8];
	const MINUS = '−';
	const CHART_FONT = "'Schibsted Grotesk', sans-serif";
	const TICK_FONT = { family: CHART_FONT, size: 11.5 };
	const motionOff = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* What the reader has picked, and what the page has loaded for it. */
	const view = {
		preset: '365',
		range: { from: FINAL_DAY - 364, to: FINAL_DAY },
		compare: 'previous',
		filters: { plan: '', region: '', channel: '' },
		series: 'dau',
		report: null,
		order: { key: 'change', dir: 'asc' },
		search: '',
		page: 1,
		pageSize: 8,
		drawerIds: [],
		drawerIndex: 0,
		drawerTarget: null,
	};

	/* The parts of the page the script writes into. */
	const reportBox = pick('[data-pu-report]', host);
	const failBox = pick('[data-pu-error]', host);
	const blankBox = pick('[data-pu-empty]', host);
	const periodText = pick('[data-pu-period]', host);
	const slipBody = pick('[data-pu-falling-body]', host);
	const slipPager = pick('[data-pu-falling-pages]', host);
	const slipSearch = pick('[data-pu-falling-search]', host);
	const customBox = pick('[data-pu-custom]', host);
	const fromField = pick('[data-pu-from]', host);
	const toField = pick('[data-pu-to]', host);
	const customNote = pick('[data-pu-custom-error]', host);
	const compareBox = pick('[data-pu-compare]', host);
	const filterBoxes = pickAll('[data-pu-filter]', host);
	const chipRow = pick('[data-pu-applied]', host);
	const drawer = pick('[data-pu-drawer]', host);
	const drawerCanvas = pick('[data-pu-acc-chart]', drawer);
	const finder = pick('[data-pu-find]', host);

	/* Live chart instances keyed by canvas, and the canvases that have been
     on screen at least once; only those get redrawn. */
	const liveCharts = new Map();
	const shownCanvases = new Set();
	const chartCanvases = pickAll('canvas[data-pu-chart]', host);
	const CHART_RECIPES = {
		spark: sparkChart,
		active: activityChart,
		events: eventsChart,
		stay: stayChart,
		seats: seatsChart,
	};
	const viewWatcher =
		'IntersectionObserver' in window ? new IntersectionObserver(onCanvasSeen, { rootMargin: '80px 0px' }) : null;

	let slipPaging = null;
	let drawerPanel = null;
	let drawerChart = null;
	let drawerAccount = null;
	let loadTicket = 0;
	let fetchCount = 0;

	/** Wires every control, fills the account finder and asks for the first report. */
	function start() {
		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() => {
				redrawShown(false);
				if (drawerChart) paintDrawerChart(false);
			});
		});

		slipPaging = window.Basalt.pagination
			? window.Basalt.pagination(slipPager, {
					total: 1,
					current: 1,
					label: 'Page',
					onChange: (pageNumber) => {
						view.page = pageNumber;
						paintSlipping();
					},
				})
			: null;

		wireSlippingTable();
		wireOpeners();
		pick('[data-pu-retry]', host).addEventListener('click', retryLoad);

		wireRange();
		bindFilters();
		wireSeriesSwitch();
		host.addEventListener('click', onExportClick);

		wireDrawer();
		fillFinder();

		paintChips();
		fetchReport();
	}

	/* The sample engine turns SAMPLE into a report for any dates and
     filters. Each figure is drawn from a hash of the account and the day,
     so the same request always returns the same report. */

	function dayOf(date) {
		return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
	}

	function dateOf(day) {
		const utc = new Date(day * MS_PER_DAY);
		return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
	}

	/* Sunday is 0, as with Date#getDay. */
	function weekdayOf(day) {
		return (day + 4) % 7;
	}

	/** A repeatable pseudo-random number in [0, 1) for a pair of integers. */
	function hashPair(first, second) {
		let mixed = Math.imul(first | 0, 374761393) + Math.imul(second | 0, 668265263);
		mixed = Math.imul(mixed ^ (mixed >>> 13), 1274126177);
		mixed ^= mixed >>> 16;
		return (mixed >>> 0) / 4294967296;
	}

	function within(value, low, high) {
		return Math.max(low, Math.min(high, value));
	}

	function addUp(list) {
		return list.reduce((acc, value) => acc + value, 0);
	}

	function average(list) {
		return list.length ? addUp(list) / list.length : 0;
	}

	/** Days from the final day, in months of 30 days; negative before it. */
	function monthsFromEnd(day) {
		return (day - FINAL_DAY) / 30;
	}

	/** Every day number in a span, both ends included. */
	function spanDays(span) {
		const list = [];
		for (let day = span.from; day <= span.to; day += 1) list.push(day);
		return list;
	}

	function toAccount(row, index) {
		const [id, name, plan, region, channel, seats, active, daily, trend, owner] = row;
		const account = { i: index + 1, id, name, plan, region, channel, seats, active, daily, trend, owner, count: 1 };
		/* Only accounts that bought the portal add-on have portal users. */
		account.hasPortal = hashPair(account.i * 37 + PORTAL_SLOT, 77) < featureById.get('portal').adopt[account.plan];
		account.portal = account.hasPortal ? Math.round(account.seats * SAMPLE.portal.perSeat) : 0;
		return account;
	}

	/**
	 * Splits a whole number across weights so the parts are whole and add
	 * back up exactly; leftover units go to the largest remainders.
	 */
	function apportion(amount, weights) {
		const weightSum = addUp(weights);
		const exact = weights.map((weight) => (weightSum ? (amount * weight) / weightSum : 0));
		const parts = exact.map((value) => Math.floor(value));
		const byRemainder = exact
			.map((value, slot) => ({ slot, rest: value - parts[slot] }))
			.sort((left, right) => right.rest - left.rest);
		for (const { slot } of byRemainder.slice(0, amount - addUp(parts))) parts[slot] += 1;
		return parts;
	}

	function poolRemainder() {
		const pooled = [];
		for (const plan of SAMPLE.plans) {
			const planTotals = SAMPLE.totals[plan];
			const listed = namedAccounts.filter((account) => account.plan === plan);
			const onlineShare = SAMPLE.mix.selfServe[plan];
			const slices = [];
			for (const region of SAMPLE.regions) {
				for (const channel of SAMPLE.channels) {
					const channelShare = channel === 'Self-serve' ? onlineShare : 1 - onlineShare;
					slices.push({ region, channel, weight: SAMPLE.mix.region[region] * channelShare });
				}
			}
			const weights = slices.map((slice) => slice.weight);
			const accountsLeft = apportion(planTotals.accounts - listed.length, weights);
			const seatsLeft = apportion(planTotals.seats - addUp(listed.map((account) => account.seats)), weights);
			const activeLeft = apportion(planTotals.active - addUp(listed.map((account) => account.active)), weights);
			const portalLeft = apportion(planTotals.portal - addUp(listed.map((account) => account.portal)), seatsLeft);
			for (const [slot, slice] of slices.entries()) {
				if (!accountsLeft[slot]) continue;
				pooled.push({
					i: 1000 + pooled.length,
					id: `pool-${plan}-${slot}`,
					pooled: true,
					name: `Other ${plan} accounts`,
					plan,
					region: slice.region,
					channel: slice.channel,
					count: accountsLeft[slot],
					seats: seatsLeft[slot],
					active: activeLeft[slot],
					portal: portalLeft[slot],
					daily: planTotals.daily,
					trend: planTotals.trend,
				});
			}
		}
		return pooled;
	}

	/* People counts for one account on one day. */

	function growthBy(account, day) {
		return Math.pow(1 + account.trend + SAMPLE.growth, monthsFromEnd(day));
	}

	/** Seat holders seen in the 30 days up to the day; never quite every seat. */
	function seatHolders(account, day) {
		return Math.min(account.seats * 0.98, account.active * growthBy(account, day));
	}

	function portalPeople(account, day) {
		return account.portal * growthBy(account, day);
	}

	function monthlyPeople(account, day) {
		return seatHolders(account, day) + portalPeople(account, day);
	}

	function weeklyPeople(account, day) {
		return (
			(seatHolders(account, day) * Math.min(0.96, account.daily * 1.5 + 0.18) +
				portalPeople(account, day) * SAMPLE.portal.weekly) *
			(0.97 + 0.06 * hashPair(account.i + 500, day))
		);
	}

	function dailyPeople(account, day) {
		return (
			(seatHolders(account, day) * account.daily + portalPeople(account, day) * SAMPLE.portal.daily) *
			WEEKDAY_LOAD[weekdayOf(day)] *
			(0.86 + 0.28 * hashPair(account.i, day))
		);
	}

	/** Share of a plan's accounts using a feature on a given day. */
	function planAdoption(feature, plan, day) {
		return within(feature.adopt[plan] + (feature.drift / 100) * monthsFromEnd(day), 0, 1);
	}

	function usesFeature(account, feature, day) {
		if (feature.id === 'portal') return account.hasPortal;
		return (
			hashPair(account.i * 37 + SAMPLE.features.indexOf(feature), 77) < planAdoption(feature, account.plan, day)
		);
	}

	/* New workspaces and how far they get through setup. */

	/** Workspaces created on a day under the filters, by plan. */
	function workspacesBorn(day, filters) {
		const source = SAMPLE.signups;
		const regionShare = filters.region ? source.region[filters.region] : 1;
		const born = {};
		for (const [slot, plan] of SAMPLE.plans.entries()) {
			if (filters.plan && filters.plan !== plan) {
				born[plan] = 0;
				continue;
			}
			const online = source.selfServe[plan];
			const channelShare = { 'Self-serve': online, 'Sales-led': 1 - online }[filters.channel] ?? 1;
			born[plan] =
				source.perDay[plan] *
				regionShare *
				channelShare *
				WEEKDAY_LOAD[weekdayOf(day)] *
				(0.55 + 0.9 * hashPair(9000 + slot, day));
		}
		return born;
	}

	function stepReach(step, plan, day) {
		return within(
			step.reach[plan] +
				(step.gain / 100) * monthsFromEnd(day) +
				(hashPair(step.gain * 100 + plan.length, day) - 0.5) * 0.04,
			0,
			1,
		);
	}

	/** Workspaces reaching each setup step over a span, as fractions. */
	function setupTally(span, filters) {
		const reached = SAMPLE.setup.map(() => 0);
		for (const day of spanDays(span)) {
			const born = workspacesBorn(day, filters);
			for (const plan of SAMPLE.plans) {
				if (!born[plan]) continue;
				for (const [slot, step] of SAMPLE.setup.entries())
					reached[slot] += born[plan] * stepReach(step, plan, day);
			}
		}
		return reached;
	}

	/** The same tally rounded, with no step larger than the one before it. */
	function setupCounts(span, filters) {
		const counts = [];
		for (const value of setupTally(span, filters)) {
			const ceiling = counts.length ? counts[counts.length - 1] : Infinity;
			counts.push(Math.min(ceiling, Math.round(value)));
		}
		return counts;
	}

	/* Two completion rates on purpose: the per-bucket one skips buckets with
     hardly any signups, the headline one only needs a first step. */
	function bucketCompletion(steps) {
		return steps && steps[0] >= 0.05 ? (steps[steps.length - 1] / steps[0]) * 100 : null;
	}

	function overallCompletion(steps) {
		return steps && steps[0] ? (steps[steps.length - 1] / steps[0]) * 100 : null;
	}

	/** Chart buckets: single days up to 120 days, whole weeks counted back from the end beyond that. */
	function bucketDays(span) {
		const list = spanDays(span);
		if (list.length <= 120) return list.map((day) => [day]);
		const weeks = [];
		for (let end = list.length; end > 0; end -= 7) weeks.unshift(list.slice(Math.max(0, end - 7), end));
		return weeks;
	}

	function comparisonSpan(span, mode) {
		const length = span.to - span.from + 1;
		const shifts = { year: 364, previous: length };
		if (!(mode in shifts)) return null;
		return { from: span.from - shifts[mode], to: span.to - shifts[mode] };
	}

	/*
	 * The report backend.report() resolves with:
	 * { range: { from, to }, compare: { from, to } | null, bucket: 'day' | 'week',
	 *   accounts: n, empty: bool,
	 *   kpis: { dau, mau, stick, activation } each { value, was, series, wasSeries },
	 *   active: { labels, dau, wau, mau, avg, was: { dau, wau, mau, avg } },
	 *   plans: [{ plan, stick, wasStick, seats, mau, wasMau }],
	 *   features: [{ id, name, adoption, days, wasAdoption, wasDays }],
	 *   events: [{ name, count, was }],
	 *   stay: [percent still active, week 0 to 12],
	 *   setup: { steps: [{ step, count }], workspaces, rate, wasRate },
	 *   falling: [{ id, name, plan, region, owner, active, before, change, seatUse }],
	 *   nearFull: [{ id, name, plan, seats, seatUse }],
	 *   people: [{ name, account, accountId, role, days, of, wasDays, events, feature }] }
	 */
	function buildReport(span, compareMode, filters) {
		const fits = (account) =>
			(!filters.plan || account.plan === filters.plan) &&
			(!filters.region || account.region === filters.region) &&
			(!filters.channel || account.channel === filters.channel);
		const accounts = demoMode === 'empty' ? [] : everyAccount.filter(fits);
		const accountTotal = addUp(accounts.map((account) => account.count));
		const against = comparisonSpan(span, compareMode);
		const buckets = bucketDays(span);
		const report = {
			range: span,
			compare: against,
			bucket: buckets[0].length > 1 ? 'week' : 'day',
			accounts: accountTotal,
			empty: !accountTotal,
		};
		if (report.empty) return report;

		const scope = {
			span,
			against,
			filters,
			accounts,
			accountTotal,
			buckets,
			/* Only named accounts feed the tables, the drawer and the people list. */
			named: accounts.filter((account) => !account.pooled),
			baseline: against || comparisonSpan(span, 'previous'),
			offset: against ? span.from - against.from : 0,
			now: dailyTotals(accounts, span),
			then: against ? dailyTotals(accounts, against) : null,
			steps: setupCounts(span, filters),
			thenSteps: against ? setupCounts(against, filters) : null,
		};

		report.kpis = headlineFigures(scope);
		report.active = activitySeries(scope);
		report.plans = planFigures(scope);
		report.features = featureFigures(scope);
		report.events = eventFigures(scope);
		report.stay = stayCurve(scope);
		report.setup = {
			steps: SAMPLE.setup.map((step, slot) => ({ step: step.step, count: scope.steps[slot] })),
			workspaces: scope.steps[0],
			rate: overallCompletion(scope.steps),
			wasRate: overallCompletion(scope.thenSteps),
		};
		report.falling = slippingAccounts(scope);
		report.nearFull = crowdedAccounts(scope);
		report.people = topPeople(scope);
		return report;
	}

	/** Daily, weekly and monthly active people summed over the accounts, one entry per day. */
	function dailyTotals(accounts, span) {
		const list = spanDays(span);
		const sumFor = (measure) => list.map((day) => addUp(accounts.map((account) => measure(account, day))));
		return { list, dau: sumFor(dailyPeople), wau: sumFor(weeklyPeople), mau: sumFor(monthlyPeople) };
	}

	/**
	 * Averages per-day values into the chart buckets. The comparison span is
	 * the same length as the current one, so both index from its first day.
	 */
	function bucketMeans(scope, values) {
		return scope.buckets.map((bucket) => average(bucket.map((day) => values[day - scope.span.from])));
	}

	/** Seven-day average of daily active people, reaching six days back before the span. */
	function weekAverage(scope, span, values) {
		const leadIn = spanDays({ from: span.from - 6, to: span.from - 1 }).map((day) =>
			addUp(scope.accounts.map((account) => dailyPeople(account, day))),
		);
		const padded = leadIn.concat(values);
		return values.map((_, slot) => average(padded.slice(slot, slot + 7)));
	}

	function headlineFigures(scope) {
		const { now, then, against, buckets, filters, offset } = scope;
		const dauLine = bucketMeans(scope, now.dau);
		const mauLine = bucketMeans(scope, now.mau);
		const thenDau = then ? bucketMeans(scope, then.dau) : null;
		const thenMau = then ? bucketMeans(scope, then.mau) : null;
		const completionLine = (shift) =>
			buckets.map((bucket) =>
				bucketCompletion(
					setupTally({ from: bucket[0] - shift, to: bucket[bucket.length - 1] - shift }, filters),
				),
			);
		const stickiness = (totals) => (average(totals.dau) / average(totals.mau)) * 100;

		return {
			dau: {
				value: average(now.dau),
				was: then ? average(then.dau) : null,
				series: dauLine,
				wasSeries: thenDau,
			},
			mau: {
				value: now.mau[now.mau.length - 1],
				was: then ? then.mau[then.mau.length - 1] : null,
				series: mauLine,
				wasSeries: thenMau,
			},
			stick: {
				value: stickiness(now),
				was: then ? stickiness(then) : null,
				series: dauLine.map((value, slot) => (value / mauLine[slot]) * 100),
				wasSeries: then ? thenDau.map((value, slot) => (value / thenMau[slot]) * 100) : null,
			},
			activation: {
				value: overallCompletion(scope.steps),
				was: overallCompletion(scope.thenSteps),
				series: completionLine(0),
				wasSeries: against ? completionLine(offset) : null,
			},
		};
	}

	function activitySeries(scope) {
		const { now, then, span, against, buckets } = scope;
		return {
			labels: buckets.map((bucket) => bucket[0]),
			dau: bucketMeans(scope, now.dau),
			wau: bucketMeans(scope, now.wau),
			mau: bucketMeans(scope, now.mau),
			avg: bucketMeans(scope, weekAverage(scope, span, now.dau)),
			was: then
				? {
						dau: bucketMeans(scope, then.dau),
						avg: bucketMeans(scope, weekAverage(scope, against, then.dau)),
						wau: bucketMeans(scope, then.wau),
						mau: bucketMeans(scope, then.mau),
					}
				: null,
		};
	}

	function planFigures(scope) {
		const { accounts, span, against } = scope;
		const present = SAMPLE.plans.filter((plan) => accounts.some((account) => account.plan === plan));
		return present.map((plan) => {
			const members = accounts.filter((account) => account.plan === plan);
			const meanOf = (measure, list) =>
				average(list.map((day) => addUp(members.map((account) => measure(account, day)))));
			const stickiness = (period) => {
				const list = spanDays(period);
				return (meanOf(dailyPeople, list) / meanOf(monthlyPeople, list)) * 100;
			};
			/* Seat holders only, because portal users never take a seat. */
			const holdersOn = (day) => addUp(members.map((account) => seatHolders(account, day)));
			return {
				plan,
				stick: stickiness(span),
				wasStick: against ? stickiness(against) : null,
				seats: addUp(members.map((account) => account.seats)),
				mau: holdersOn(span.to),
				wasMau: against ? holdersOn(against.to) : null,
			};
		});
	}

	/* Adoption on the last day of a span: named accounts count one by one,
     pooled rows at their plan's rate. */
	function featureFigures(scope) {
		const { accounts, accountTotal, span, against } = scope;
		const adoptionOn = (feature, day) =>
			(addUp(
				accounts.map((account) => {
					if (account.pooled) return account.count * planAdoption(feature, account.plan, day);
					return usesFeature(account, feature, day) ? 1 : 0;
				}),
			) /
				accountTotal) *
			100;
		const daysAWeek = (feature, period) =>
			within(
				feature.days *
					(0.93 +
						0.14 * hashPair(SAMPLE.features.indexOf(feature) + 40, period.to + (period.to - period.from))),
				0.5,
				7,
			);

		return SAMPLE.features.map((feature) => ({
			id: feature.id,
			name: feature.name,
			adoption: adoptionOn(feature, span.to),
			days: daysAWeek(feature, span),
			wasAdoption: against ? adoptionOn(feature, against.to) : null,
			wasDays: against ? daysAWeek(feature, against) : null,
		}));
	}

	/* An action's count is active people times how often each does it. */
	function eventFigures(scope) {
		const { now, then, span, against } = scope;
		const tallyIn = (period, perDayPeople) =>
			SAMPLE.events.map((event, slot) =>
				addUp(
					spanDays(period).map(
						(day, offset) =>
							perDayPeople[offset] *
							event.perDay *
							(1 + event.drift * monthsFromEnd(day)) *
							(0.9 + 0.2 * hashPair(700 + slot, day)),
					),
				),
			);
		const current = tallyIn(span, now.dau);
		const earlier = then ? tallyIn(against, then.dau) : null;
		return SAMPLE.events
			.map((event, slot) => ({
				name: event.name,
				count: Math.round(current[slot]),
				was: earlier ? Math.round(earlier[slot]) : null,
			}))
			.sort((left, right) => right.count - left.count);
	}

	/**
	 * Share of new workspaces still active each week after signup: up to
	 * four of the latest signup months with at least two weeks behind
	 * them, pooled week by week and weighted by how many signed up.
	 */
	function stayCurve(scope) {
		const { span, filters } = scope;
		const endDate = dateOf(span.to);
		const months = [];
		for (let back = 0; months.length < 4 && back < 8; back += 1) {
			const first = new Date(endDate.getFullYear(), endDate.getMonth() - back, 1);
			const weeksOld = Math.floor((span.to - dayOf(first)) / 7);
			if (weeksOld >= 2) months.unshift({ first, weeksOld: Math.min(12, weeksOld) });
		}

		const cohorts = [];
		for (const [slot, month] of months.entries()) {
			const startDay = dayOf(month.first);
			const finalDay = Math.min(
				span.to,
				dayOf(new Date(month.first.getFullYear(), month.first.getMonth() + 1, 0)),
			);
			const born = Object.fromEntries(SAMPLE.plans.map((plan) => [plan, 0]));
			for (const day of spanDays({ from: startDay, to: finalDay })) {
				const created = workspacesBorn(day, filters);
				for (const plan of SAMPLE.plans) born[plan] += created[plan];
			}
			const size = addUp(SAMPLE.plans.map((plan) => born[plan]));
			if (!(size > 0)) continue;
			/* Newer months lose a little less, thanks to onboarding work. */
			const lossScale = 1 - 0.07 * slot;
			const weeks = [100];
			for (let week = 1; week <= month.weeksOld; week += 1) {
				const kept = addUp(
					SAMPLE.plans.map((plan) => {
						const curve = SAMPLE.retention[plan];
						const lost = (1 - curve.floor) * (1 - Math.exp(-week / curve.settle)) * lossScale;
						return (born[plan] / size) * (1 - lost);
					}),
				);
				weeks.push(within(Math.round(kept * 100 + (hashPair(slot * 31 + week, startDay) - 0.5) * 3), 1, 100));
			}
			cohorts.push({ size, weeks });
		}

		const curve = [];
		for (let week = 0; cohorts.some((cohort) => cohort.weeks[week] != null); week += 1) {
			const reporting = cohorts.filter((cohort) => cohort.weeks[week] != null);
			curve.push(
				addUp(reporting.map((cohort) => cohort.weeks[week] * cohort.size)) /
					addUp(reporting.map((cohort) => cohort.size)),
			);
		}
		return curve;
	}

	/* Accounts whose daily active people fell by 5% or more against the baseline. */
	function slippingAccounts(scope) {
		const { named, span, baseline } = scope;
		const rows = [];
		for (const account of named) {
			const active = average(spanDays(span).map((day) => dailyPeople(account, day)));
			const before = average(spanDays(baseline).map((day) => dailyPeople(account, day)));
			const change = (active - before) / before;
			if (!(change <= -0.05)) continue;
			rows.push({
				id: account.id,
				name: account.name,
				plan: account.plan,
				region: account.region,
				owner: account.owner,
				active,
				before,
				change,
				seatUse: seatHolders(account, span.to) / account.seats,
			});
		}
		return rows;
	}

	/* Accounts using nearly every seat they pay for, largest first, since
     those have the most seats left to sell. */
	function crowdedAccounts(scope) {
		return scope.named
			.map((account) => ({
				id: account.id,
				name: account.name,
				plan: account.plan,
				seats: account.seats,
				seatUse: seatHolders(account, scope.span.to) / account.seats,
			}))
			.filter((row) => row.seatUse >= 0.85)
			.sort((left, right) => right.seats - left.seats)
			.slice(0, 5);
	}

	/* The people who were in on the most days, at least half the span. */
	function topPeople(scope) {
		const { named, span, against } = scope;
		const length = span.to - span.from + 1;
		const daysIn = (person, slot, period) =>
			spanDays(period).filter((day) => {
				const weekday = weekdayOf(day);
				const weekend = weekday === 0 || weekday === 6;
				return hashPair(slot * 13 + 3, day) < person[3] * (weekend ? 0.2 : 0.97);
			}).length;

		const rows = [];
		for (const [slot, person] of SAMPLE.people.entries()) {
			const [name, accountId, role, , perDay, favorite] = person;
			const account = namedById.get(accountId);
			if (!account || !named.includes(account)) continue;
			const days = daysIn(person, slot, span);
			if (days < Math.ceil(length * 0.5)) continue;
			rows.push({
				name,
				account: account.name,
				accountId: account.id,
				role,
				days,
				of: length,
				wasDays: against ? daysIn(person, slot, against) : null,
				events: Math.round(days * perDay * (0.9 + 0.2 * hashPair(slot, span.to))),
				feature: (featureById.get(favorite) || { name: favorite }).name,
			});
		}
		return rows.sort((left, right) => right.days - left.days || right.events - left.events).slice(0, 8);
	}

	/** One named account for the drawer, or null for an id it does not know. */
	function buildAccount(id, span, compareMode) {
		const account = namedById.get(id);
		if (!account) return null;
		const against = comparisonSpan(span, compareMode);
		const baseline = against || comparisonSpan(span, 'previous');
		const buckets = bucketDays(span);
		const offset = against ? span.from - against.from : 0;
		const meanDaily = (window) => average(spanDays(window).map((day) => dailyPeople(account, day)));
		const bucketLine = (shift) =>
			buckets.map((bucket) => average(bucket.map((day) => dailyPeople(account, day - shift))));
		const active = meanDaily(span);
		const before = meanDaily(baseline);
		return {
			id: account.id,
			name: account.name,
			plan: account.plan,
			region: account.region,
			channel: account.channel,
			owner: account.owner,
			seats: account.seats,
			mau: monthlyPeople(account, span.to),
			seatUsers: seatHolders(account, span.to),
			stick: account.daily * 100,
			active,
			change: (active - before) / before,
			labels: buckets.map((bucket) => bucket[0]),
			series: bucketLine(0),
			was: against ? bucketLine(offset) : null,
			features: SAMPLE.features.map((feature) => ({
				id: feature.id,
				name: feature.name,
				on: usesFeature(account, feature, span.to),
			})),
		};
	}

	/* Every backend call returns a Promise. The demo answers from SAMPLE
     after a short pause; replace the bodies with fetch() and keep the
     shapes. */

	function pause(ms) {
		return new Promise((resolve) => {
			setTimeout(resolve, ms);
		});
	}

	const backend = {
		/* GET /api/usage?from=YYYY-MM-DD&to=YYYY-MM-DD&compare=previous|year|none
       &plan=&region=&channel=, answering with the report above buildReport(). */
		report(span, compareMode, filters) {
			fetchCount += 1;
			return pause(380).then(() => {
				if (demoMode === 'error' && fetchCount === 1) throw new Error('The server did not answer');
				return buildReport(span, compareMode, filters);
			});
		},
		/* GET /api/usage/accounts/:id?from=&to=&compare=, one account for the drawer. */
		account(id, span, compareMode) {
			return pause(120).then(() => buildAccount(id, span, compareMode));
		},
		/* POST /api/accounts/:id/flags with { reason }, which alerts the account owner. */
		flag(id, reason) {
			return pause(200).then(() => ({ id, reason }));
		},
		/* The browser writes exports from the loaded report. A server that
       builds them could hand back a file URL to open here instead. */
		saveCsv(fileName, header, rows) {
			saveText(fileName, csvText(header, rows));
			return Promise.resolve(fileName);
		},
	};

	/* A report is fetched, then each card paints its own part of it. */

	/** Asks for a report for the current choices; a reason means the reader caused it and hears the outcome. */
	function fetchReport(reason) {
		loadTicket += 1;
		const ticket = loadTicket;
		host.classList.add('is-loading');
		reportBox.setAttribute('aria-busy', 'true');
		const settle = () => {
			host.classList.remove('is-loading');
			reportBox.setAttribute('aria-busy', 'false');
		};
		return backend
			.report(view.range, view.compare, view.filters)
			.then((report) => {
				if (ticket !== loadTicket) return;
				settle();
				paintReport(report);
				if (!reason) return;
				announce(
					report.empty ? 'No accounts match these filters.' : `Report updated: ${periodText.textContent}`,
				);
			})
			.catch((problem) => {
				if (ticket !== loadTicket) return;
				settle();
				reportBox.hidden = true;
				blankBox.hidden = true;
				failBox.hidden = false;
				periodText.textContent = 'The report could not be loaded.';
				notify({
					tone: 'danger',
					title: 'Could not load usage',
					text: problem.message || 'Something went wrong.',
				});
			});
	}

	function retryLoad() {
		fetchReport('retry').then(() => {
			const landing = reportBox.hidden ? blankBox : pick('.pu-kpi', host);
			if (!landing) return;
			landing.setAttribute('tabindex', '-1');
			landing.focus({ preventScroll: true });
		});
	}

	function paintReport(report) {
		view.report = report;
		paintPeriod(report);
		failBox.hidden = true;
		blankBox.hidden = !report.empty;
		reportBox.hidden = report.empty;
		if (report.empty) {
			paintNoAccounts();
			return;
		}
		for (const paint of [
			paintHeadline,
			paintActivity,
			paintPlanRings,
			paintAdoption,
			paintEvents,
			paintStay,
			paintSetup,
			paintSeats,
			resetSlipping,
			paintPeople,
		])
			paint(report);
		redrawShown(true);
		watchCanvases();
	}

	function paintNoAccounts() {
		const filtered = Object.values(view.filters).some(Boolean);
		pick('[data-pu-empty-title]', host).textContent = filtered
			? 'No accounts match these filters'
			: 'No usage to show yet';
		pick('[data-pu-empty-text]', host).textContent = filtered
			? 'Try another plan, region or channel, or clear the filters to see every account.'
			: 'Once customers start using Fieldline, their activity shows up here within the hour.';
		pick('[data-pu-clear]', host).hidden = !filtered;
	}

	function paintPeriod(report) {
		const length = report.range.to - report.range.from + 1;
		const parts = [`${spanLabel(report.range)}, ${length} ${length === 1 ? 'day' : 'days'}`];
		parts.push(report.compare ? `, compared with ${spanLabel(report.compare)}` : ', no comparison');
		if (!report.empty)
			parts.push(`. ${asWhole(report.accounts)} ${report.accounts === 1 ? 'account' : 'accounts'}.`);
		periodText.textContent = parts.join('');
		for (const node of pickAll('[data-pu-compare-only]', host)) node.hidden = !report.compare;
		for (const node of pickAll('[data-pu-compare-name]', host)) node.textContent = comparisonName();
	}

	function paintHeadline(report) {
		const { kpis } = report;
		const sinceWord = view.compare === 'year' ? 'last year' : 'before';
		const oneDecimal = (value) => asPercent(value, 1);
		const card = ({ value, was }, format, badgeOptions) => ({
			value: format(value),
			was: was != null ? `from ${format(was)}` : '',
			badge: changeBadge(value, was, badgeOptions),
		});
		const cards = {
			dau: card(kpis.dau, asWhole),
			mau: card(kpis.mau, asWhole),
			stick: card(kpis.stick, oneDecimal, { points: true }),
			activation:
				kpis.activation.value == null
					? { value: 'None yet', was: '', badge: '' }
					: card(kpis.activation, oneDecimal, { points: true }),
		};

		for (const [key, figures] of Object.entries(cards)) {
			const box = pick(`[data-pu-kpi="${key}"]`, host);
			pick('[data-pu-kpi-value]', box).textContent = figures.value;
			pick('[data-pu-kpi-delta]', box).innerHTML = figures.badge;
			pick('[data-pu-kpi-was]', box).textContent = figures.was
				? `${figures.was} ${sinceWord}`
				: report.compare
					? ''
					: 'No comparison';
		}

		const note = pick('[data-pu-kpi-note]', host);
		if (note) {
			note.textContent = report.setup.workspaces
				? `Of ${asWhole(report.setup.workspaces)} new workspaces, all five setup steps done`
				: 'No new workspaces in this period';
		}

		const firstKnown = (list) => list.find((value) => value != null);
		const lastKnown = (list) =>
			list
				.slice()
				.reverse()
				.find((value) => value != null);
		const spark = (key) => `[data-pu-spark="${key}"]`;
		labelChart(
			spark('dau'),
			`Daily active users across the period, from ${asWhole(firstKnown(kpis.dau.series))} to ${asWhole(lastKnown(kpis.dau.series))}`,
		);
		labelChart(
			spark('mau'),
			`Monthly active users across the period, from ${asWhole(firstKnown(kpis.mau.series))} to ${asWhole(lastKnown(kpis.mau.series))}`,
		);
		labelChart(
			spark('stick'),
			`Stickiness across the period, from ${asPercent(firstKnown(kpis.stick.series), 1)} to ${asPercent(lastKnown(kpis.stick.series), 1)}`,
		);
		const rates = kpis.activation.series.filter((value) => value != null);
		labelChart(
			spark('activation'),
			rates.length
				? `Activation rate across the period, between ${asPercent(Math.min(...rates))} and ${asPercent(Math.max(...rates))}`
				: 'No activation data in this period',
		);
	}

	const SERIES_NAMES = { dau: 'Daily active', wau: 'Weekly active', mau: 'Monthly active' };
	const SERIES_NOTES = {
		dau: 'People who did anything in the product each day. The line is the seven-day average, so weekends don’t hide the trend.',
		wau: 'People active at least once in the seven days up to each day. It smooths out the weekend dip.',
		mau: 'People active at least once in the 30 days up to each day: the size of the regular user base.',
	};

	function paintActivity(report) {
		const { active } = report;
		const key = view.series;
		const name = SERIES_NAMES[key];
		const daily = key === 'dau';
		const weekly = report.bucket === 'week';
		const values = active[key];

		pick('[data-pu-active-desc]', host).textContent =
			SERIES_NOTES[key] + (weekly ? ' Each point is a weekly average.' : '');
		const nameNode = pick('[data-pu-active-name]', host);
		nameNode.textContent = name;
		pick('[data-pu-active-avg]', host).hidden = !daily;
		/* The key swatch changes class with the view, so it is reached by position. */
		nameNode.previousElementSibling.className = daily ? 'pu-key-bar pu-key-bar-soft' : 'pu-key-band';

		const peak = values.indexOf(Math.max(...values));
		const against = active.was ? `, against ${asWhole(average(active.was[key]))} in the comparison period` : '';
		labelChart(
			'[data-pu-chart="active"]',
			`${name} users ${weekly ? 'by week' : 'by day'} from ${spanLabel(report.range)}, averaging ${asWhole(average(values))}, highest on ${shortDate(active.labels[peak])} at ${asWhole(values[peak])}${against}`,
		);

		const header = [weekly ? 'Week of' : 'Day', name];
		if (daily) header.push('Seven-day average');
		if (active.was) header.push(comparisonName());
		numbersTable(
			'active',
			`${name} users`,
			header,
			active.labels.map((day, slot) => [
				shortDate(day, true),
				asWhole(values[slot]),
				...(daily ? [asWhole(active.avg[slot])] : []),
				...(active.was ? [asWhole(active.was[key][slot])] : []),
			]),
		);
	}

	function paintPlanRings(report) {
		const { plans } = report;
		const box = pick('[data-pu-rings]', host);
		box.innerHTML = plans.map(planRing).join('');
		for (const ring of pickAll('[data-pu-ring]', box))
			ring.style.setProperty('--value', ring.getAttribute('data-pu-ring'));

		const leader = plans.slice().sort((left, right) => right.stick - left.stick)[0];
		pick('[data-pu-rings-note]', host).textContent =
			plans.length > 1
				? `${leader.plan} customers are the most regular: ${Math.round(leader.stick)}% of them are in on a typical day, against ${asPercent(report.kpis.stick.value)} across all plans.`
				: `Only ${leader.plan} accounts match the filters.`;
	}

	function planRing(plan) {
		const share = Math.round(plan.stick);
		const earlier = plan.wasStick != null ? `, ${Math.round(plan.wasStick)}% in the comparison period` : '';
		const arc = 'M112 60 A52 52 0 1 1 8 60 A52 52 0 1 1 112 60';
		const svg = `<svg viewBox="0 0 120 120" aria-hidden="true"><path class="basalt-ring-track" d="${arc}" pathLength="100"></path><path class="basalt-ring-bar" d="${arc}" pathLength="100"></path></svg>`;
		const ring = `<div class="basalt-ring" role="img" aria-label="${htmlSafe(plan.plan)}: ${share}% of monthly active users are in on a typical day${earlier}" data-pu-ring="${share}">${svg}<span class="basalt-ring-label"><span class="basalt-ring-value">${share}%</span></span></div>`;
		const caption = `<figcaption><span class="pu-ring-name">${htmlSafe(plan.plan)}</span>${changeBadge(plan.stick, plan.wasStick, { points: true })}</figcaption>`;
		return `<figure class="pu-ring pu-tone-${PLAN_TONE[plan.plan]}">${ring}${caption}</figure>`;
	}

	/* Feature adoption: one ranked row per feature with a bar for the share
     of accounts using it and its users' days a week beside it. A tick on
     the track marks the comparison period. */
	function adoptionGroup(feature) {
		if (feature.days < 2.5) return '';
		return feature.adoption >= 50 ? 'Core' : 'Loved by a few';
	}

	function paintAdoption(report) {
		const ranked = report.features.slice().sort((left, right) => right.adoption - left.adoption);
		const withPast = (feature) => report.compare && feature.wasAdoption != null;
		const otherName = comparisonName();

		pick('[data-pu-adopt]', host).innerHTML = ranked
			.map((feature) => {
				const group = adoptionGroup(feature);
				const tick = withPast(feature)
					? `<span class="pu-adopt-was" style="left:${Math.min(100, feature.wasAdoption).toFixed(1)}%" title="${otherName}: ${asPercent(feature.wasAdoption)}"></span>`
					: '';
				const spoken = withPast(feature)
					? `, ${asPercent(feature.wasAdoption)} in the ${otherName.toLowerCase()}`
					: '';
				const tag = group ? `<span class="pu-adopt-group">${group}</span>` : '';
				return [
					`<li class="pu-adopt-row${group === 'Core' ? ' is-core' : ''}">`,
					`<span class="pu-adopt-name">${feature.name}</span>`,
					`<span class="pu-adopt-track" aria-hidden="true"><span class="pu-adopt-fill" style="width:${Math.min(100, feature.adoption).toFixed(1)}%"></span>${tick}</span>`,
					`<span class="pu-adopt-pct basalt-num">${asPercent(feature.adoption)}</span>`,
					`<span class="pu-adopt-days">${feature.days.toFixed(1)} days a week</span>`,
					`<span class="pu-adopt-tag">${tag}</span>`,
					`<span class="visually-hidden">${spoken}</span></li>`,
				].join('');
			})
			.join('');

		const header = ['Feature', 'Accounts using it', 'Days a week'];
		if (report.compare) header.push(`Accounts, ${otherName.toLowerCase()}`, `Days, ${otherName.toLowerCase()}`);
		numbersTable(
			'quadrant',
			'Feature adoption and frequency',
			header,
			ranked.map((feature) =>
				report.compare
					? [
							feature.name,
							asPercent(feature.adoption),
							feature.days.toFixed(1),
							asPercent(feature.wasAdoption),
							feature.wasDays.toFixed(1),
						]
					: [feature.name, asPercent(feature.adoption), feature.days.toFixed(1)],
			),
		);
	}

	/* Top events: the ring shows the split, the list carries the numbers. */
	function paintEvents(report) {
		const ranked = report.events.slice().sort((left, right) => right.count - left.count);
		const allActions = ranked.reduce((acc, event) => acc + event.count, 0);
		const shareOf = (event) => asPercent((event.count / allActions) * 100);
		const otherName = comparisonName();

		pick('[data-pu-events-total]', host).textContent = asShort(allActions);
		pick('[data-pu-evlist]', host).innerHTML = ranked
			.map((event, slot) => {
				const change = report.compare && event.was ? ((event.count - event.was) / event.was) * 100 : null;
				const changeTag =
					change == null
						? ''
						: `<span class="pu-evlist-change${change < 0 ? ' is-down' : ''}">${asSigned(change)}%<span class="visually-hidden"> on the ${otherName.toLowerCase()}</span></span>`;
				return `<li class="pu-evlist-row"><span class="pu-evlist-dot pu-ev-${slot % EVENT_SWATCHES}" aria-hidden="true"></span><span class="pu-evlist-name">${event.name}</span><span class="pu-evlist-count basalt-num">${asShort(event.count)}</span><span class="pu-evlist-share basalt-num">${shareOf(event)}</span>${changeTag}</li>`;
			})
			.join('');

		const leaders = ranked
			.slice(0, 3)
			.map((event) => `${event.name} ${shareOf(event)}`)
			.join(', ');
		labelChart('[data-pu-chart="events"]', `Share of all actions: ${leaders}, and ${ranked.length - 3} more`);

		const header = report.compare ? ['Event', 'Times', otherName, 'Change'] : ['Event', 'Times'];
		numbersTable(
			'events',
			'Top events',
			header,
			ranked.map((event) =>
				report.compare
					? [
							event.name,
							asWhole(event.count),
							asWhole(event.was),
							`${asSigned(((event.count - event.was) / event.was) * 100)}%`,
						]
					: [event.name, asWhole(event.count)],
			),
		);
	}

	function paintStay(report) {
		const { stay } = report;
		pick('[data-pu-stay-figs]', host).innerHTML = STAY_MARKS.map(
			(week) =>
				`<div><dt>Week ${week}</dt><dd class="basalt-num">${stay[week] == null ? '–' : `${Math.round(stay[week])}%`}</dd></div>`,
		).join('');
		const known = STAY_MARKS.filter((week) => stay[week] != null);
		const weeksText = (week) => (week === 1 ? '1 week' : `${week} weeks`);
		labelChart(
			'[data-pu-chart="stay"]',
			known.length
				? `Share of new workspaces still active: ${known.map((week) => `${Math.round(stay[week])}% after ${weeksText(week)}`).join(', ')}`
				: 'No signup months with two weeks of data in this period',
		);
	}

	function paintSetup(report) {
		const { setup } = report;
		const nothing = !setup.workspaces;
		pick('[data-pu-setup]', host).classList.toggle('is-blank', nothing);

		let note = 'No new workspaces were created in this period with these filters.';
		if (!nothing) {
			const earlier =
				setup.wasRate != null
					? `, against ${asPercent(setup.wasRate, 1)} ${view.compare === 'year' ? 'a year earlier' : 'in the period before'}`
					: '';
			note = `${asPercent(setup.rate, 1)} finished all five steps${earlier}. The biggest drop is at “${steepestDrop(setup.steps)}”.`;
		}
		pick('[data-pu-setup-note]', host).textContent = note;

		const list = pick('[data-pu-steps]', host);
		list.innerHTML = nothing
			? ''
			: setup.steps
					.map((entry) => {
						const share = Math.round((entry.count / setup.workspaces) * 100);
						return `<li><span class="pu-steps-name">${htmlSafe(entry.step)}</span><span class="pu-steps-count basalt-num">${asWhole(entry.count)}</span><span class="pu-steps-share basalt-num">${share}%</span><span class="pu-meter pu-meter-wide" aria-hidden="true"><span class="pu-meter-fill" data-w="${share}"></span></span></li>`;
					})
					.join('');
		sizeMeters(list);
	}

	/** The step that loses the largest share of the workspaces that reached the one before. */
	function steepestDrop(steps) {
		let worstSlot = 1;
		let worstLoss = -1;
		for (let slot = 1; slot < steps.length; slot += 1) {
			const previous = steps[slot - 1].count;
			const loss = previous ? 1 - steps[slot].count / previous : 0;
			if (loss <= worstLoss) continue;
			worstLoss = loss;
			worstSlot = slot;
		}
		return steps[worstSlot].step;
	}

	function paintSeats(report) {
		const { plans } = report;
		const useOf = (plan) => asPercent((plan.mau / plan.seats) * 100);
		labelChart(
			'[data-pu-chart="seats"]',
			`Seat use by plan: ${plans.map((plan) => `${plan.plan} ${asWhole(plan.mau)} active seat holders of ${asWhole(plan.seats)} seats, ${useOf(plan)}`).join('; ')}`,
		);

		const header = ['Plan', 'Active seat holders', 'Paid seats', 'Seat use'];
		if (report.compare) header.push(`Active, ${comparisonName().toLowerCase()}`);
		const rows = plans.map((plan) => [
			plan.plan,
			asWhole(plan.mau),
			asWhole(plan.seats),
			useOf(plan),
			...(report.compare ? [asWhole(plan.wasMau)] : []),
		]);
		if (plans.length > 1) {
			const holders = addUp(plans.map((plan) => plan.mau));
			const seats = addUp(plans.map((plan) => plan.seats));
			rows.push([
				'All plans',
				asWhole(holders),
				asWhole(seats),
				asPercent((holders / seats) * 100),
				...(report.compare ? [asWhole(addUp(plans.map((plan) => plan.wasMau)))] : []),
			]);
		}
		numbersTable('seats', 'Seat use by plan', header, rows);
		pick('[data-pu-chart="seats"]', host).parentElement.style.setProperty(
			'--pu-rows',
			String(Math.max(1, plans.length)),
		);

		const crowded = report.nearFull;
		const list = pick('[data-pu-near]', host);
		list.innerHTML = crowded
			.map((row) => {
				const meter = `<span class="pu-meter" aria-hidden="true"><span class="pu-meter-fill" data-w="${Math.round(row.seatUse * 100)}"></span></span>`;
				return `<li><button type="button" class="pu-link" data-pu-open-btn="${htmlSafe(row.id)}">${htmlSafe(row.name)}</button><span class="pu-near-plan">${htmlSafe(row.plan)}</span><span class="pu-near-use">${meter}<span class="basalt-num">${asPercent(row.seatUse * 100)} of ${row.seats}</span></span></li>`;
			})
			.join('');
		sizeMeters(list);
		list.hidden = !crowded.length;
		pick('[data-pu-near-none]', host).hidden = crowded.length > 0;
	}

	function paintPeople(report) {
		const { people } = report;
		const list = pick('[data-pu-power]', host);
		list.innerHTML = people
			.map((person, slot) => {
				const initials = person.name
					.split(' ')
					.map((word) => word[0])
					.slice(0, 2)
					.join('');
				const share = Math.round((person.days / person.of) * 100);
				const badge = person.wasDays != null ? changeBadge(person.days, person.wasDays) : '';
				const accountButton = `<button type="button" class="pu-link pu-link-quiet" data-pu-open-btn="${htmlSafe(person.accountId)}" data-pu-person-account>${htmlSafe(person.account)}</button>`;
				return `<li class="pu-person">
        <span class="pu-person-rank" aria-hidden="true">${slot + 1}</span>
        <span class="basalt-avatar basalt-avatar-sm basalt-avatar-tone-${(slot % 8) + 1}" aria-hidden="true">${htmlSafe(initials)}</span>
        <span class="pu-person-who">
          <span class="pu-person-name">${htmlSafe(person.name)}</span>
          <span class="pu-person-sub">${htmlSafe(person.role)}, ${accountButton}</span>
        </span>
        <span class="pu-person-use">
          <span class="pu-person-days"><strong class="basalt-num">${person.days}</strong> of ${person.of} days ${badge}</span>
          <span class="pu-meter pu-meter-wide" aria-hidden="true"><span class="pu-meter-fill" data-w="${share}"></span></span>
          <span class="pu-person-sub">${asWhole(person.events)} actions, mostly ${htmlSafe(person.feature)}</span>
        </span>
      </li>`;
			})
			.join('');
		sizeMeters(list);
		pick('[data-pu-power-empty]', host).hidden = people.length > 0;
		list.hidden = !people.length;
	}

	/** Writes a "Show the numbers" table; on phones its rows stack and each figure carries its column name. */
	function numbersTable(key, caption, header, rows) {
		const box = pick(`[data-pu-data="${key}"] .pu-data-body`, host);
		if (!box) return;
		const headCells = header
			.map((title, column) => `<th scope="col"${column ? ' class="text-end"' : ''}>${htmlSafe(title)}</th>`)
			.join('');
		const bodyRows = rows
			.map((row) => {
				const [first, ...rest] = row;
				const figures = rest
					.map(
						(value, offset) =>
							`<td class="text-end" data-label="${htmlSafe(header[offset + 1])}">${htmlSafe(value)}</td>`,
					)
					.join('');
				return `<tr><th scope="row">${htmlSafe(first)}</th>${figures}</tr>`;
			})
			.join('');
		/* The column count decides the width below which the rows stack. */
		const columnsClass = `pu-data-table-c${Math.min(header.length, 5)}`;
		box.innerHTML = `<div class="table-responsive"><table class="table table-sm pu-data-table ${columnsClass}"><caption class="visually-hidden">${htmlSafe(caption)}</caption><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
	}

	function labelChart(selector, text) {
		pick(selector, host)?.setAttribute('aria-label', text);
	}

	/* Meter fills carry their width in data-w; it becomes an inline width
     here, capped at 100%. */
	function sizeMeters(scopeNode) {
		for (const fill of pickAll('.pu-meter-fill', scopeNode))
			fill.style.width = `${Math.min(100, Number(fill.getAttribute('data-w')))}%`;
	}

	function comparisonName() {
		return view.compare === 'year' ? 'Same period last year' : 'Previous period';
	}

	/* The falling-usage table searches, sorts and pages on the client. */

	/** The slipping accounts after the search and the sort, before paging. */
	function slippingRows() {
		const report = view.report;
		if (!report || report.empty) return [];
		const needle = view.search.trim().toLowerCase();
		const { key, dir } = view.order;
		const direction = dir === 'asc' ? 1 : -1;
		const matches = (row) =>
			!needle || `${row.name} ${row.owner} ${row.plan} ${row.region}`.toLowerCase().includes(needle);
		const compare = (left, right) => {
			const a = left[key];
			const b = right[key];
			const primary = typeof a === 'string' ? a.localeCompare(b) : a - b;
			return primary * direction || left.name.localeCompare(right.name);
		};
		return report.falling.filter(matches).sort(compare);
	}

	function resetSlipping(report) {
		const baseline = report.compare
			? view.compare === 'year'
				? 'the same period last year'
				: 'the period before'
			: 'the period before (no comparison is picked, so the table uses the one before)';
		pick('[data-pu-falling-desc]', host).textContent =
			`Accounts whose daily active users dropped by 5% or more on ${baseline}. Open one to see what changed.`;
		view.page = 1;
		slipPaging?.set(1);
		paintSlipping();
	}

	function paintSlipping() {
		const report = view.report;
		const rows = slippingRows();
		const pageCount = Math.max(1, Math.ceil(rows.length / view.pageSize));
		view.page = Math.min(view.page, pageCount);
		const skip = (view.page - 1) * view.pageSize;
		const visible = rows.slice(skip, skip + view.pageSize);

		slipBody.innerHTML = visible.map(slippingRow).join('');
		sizeMeters(slipBody);
		if (window.Basalt.tips) window.Basalt.tips(slipBody);

		const nothing = !rows.length;
		pick('[data-pu-falling-empty]', host).hidden = !nothing;
		slipBody.closest('.pu-scroll').hidden = nothing;
		const typed = view.search.trim();
		if (nothing) {
			pick('[data-pu-falling-empty-title]', host).textContent = typed
				? `No falling account matches “${typed}”`
				: 'No account is slipping';
			pick('[data-pu-falling-empty-text]', host).textContent = typed
				? 'Try another name or owner, or clear the search.'
				: 'Every account held on to its daily users in this period.';
		}

		const slipping = report && !report.empty ? report.falling.length : 0;
		pick('[data-pu-falling-count]', host).textContent = typed
			? `${rows.length} of ${slipping} accounts`
			: `${slipping} ${slipping === 1 ? 'account' : 'accounts'}`;
		pick('[data-pu-falling-range]', host).innerHTML = nothing
			? ''
			: `<strong>${skip + 1}–${skip + visible.length}</strong> of ${rows.length}`;
		slipPaging?.setTotal(pageCount);
		slipPager.closest('nav').hidden = pageCount < 2;
		markSortHeaders();
	}

	function slippingRow(row) {
		const name = htmlSafe(row.name);
		const page = accountPage(row.id);
		const shown = row.active >= 10 ? asWhole(row.active) : row.active.toFixed(1);
		const seatMeter = `<span class="pu-meter" aria-hidden="true"><span class="pu-meter-fill" data-w="${Math.round(row.seatUse * 100)}"></span></span><span class="basalt-num">${asPercent(row.seatUse * 100)}</span>`;
		const quick = `<button type="button" class="btn btn-icon btn-sm" data-pu-quick aria-label="Quick view: ${name}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>`;
		const full = `<a class="btn btn-icon btn-sm" href="${page}" aria-label="Open full page: ${name}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>`;
		return `<tr data-pu-open="${htmlSafe(row.id)}">
      <td><a class="pu-link" href="${page}">${name}</a><span class="pu-table-sub">${htmlSafe(row.region)}</span></td>
      <td><span class="badge basalt-badge-as-dot basalt-badge-tone-${PLAN_TONE[row.plan]}">${htmlSafe(row.plan)}</span></td>
      <td class="text-end basalt-num">${shown}</td>
      <td class="text-end">${changeBadge(row.active, row.before)}</td>
      <td class="text-end">${seatMeter}</td>
      <td>${htmlSafe(row.owner)}</td>
      <td class="text-end pu-col-act"><span class="basalt-row-actions">${quick}${full}</span></td>
    </tr>`;
	}

	function markSortHeaders() {
		const { key, dir } = view.order;
		for (const header of pickAll('th[data-pu-sort]', host)) {
			const active = header.getAttribute('data-pu-sort') === key;
			if (active) header.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
			else header.removeAttribute('aria-sort');
			const icon = pick('.pu-sort-icon', header);
			if (!icon) continue;
			const shape = active ? (dir === 'asc' ? 'bi-chevron-up' : 'bi-chevron-down') : 'bi-chevron-expand';
			icon.className = `bi pu-sort-icon ${shape}`;
		}
	}

	function backToFirstPage() {
		view.page = 1;
		slipPaging?.set(1);
		paintSlipping();
	}

	function wireSlippingTable() {
		for (const button of pickAll('th[data-pu-sort] .pu-sort', host)) {
			button.addEventListener('click', () => {
				const key = button.closest('th').getAttribute('data-pu-sort');
				const flip = view.order.key === key && view.order.dir === 'asc';
				view.order = { key, dir: flip ? 'desc' : 'asc' };
				backToFirstPage();
				announce(
					`Sorted by ${button.textContent.trim()}, ${view.order.dir === 'asc' ? 'low to high' : 'high to low'}`,
				);
			});
		}

		slipSearch.addEventListener('input', () => {
			view.search = slipSearch.value;
			backToFirstPage();
		});

		/* The quick-view icon opens the drawer. Anywhere else on a row that is
       not itself a link or button goes to the account's full page, in a
       new tab when Cmd, Ctrl or Shift is held or the middle button is used. */
		slipBody.addEventListener('click', (event) => {
			const quick = event.target.closest('[data-pu-quick]');
			if (quick) {
				openAccount(
					quick.closest('[data-pu-open]').getAttribute('data-pu-open'),
					slippingRows().map((row) => row.id),
				);
				return;
			}
			const target = rowTarget(event);
			if (!target) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey) window.open(target, '_blank');
			else location.href = target;
		});
		slipBody.addEventListener('auxclick', (event) => {
			const target = event.button === 1 && rowTarget(event);
			if (target) window.open(target, '_blank');
		});
	}

	function rowTarget(event) {
		const row = event.target.closest('[data-pu-open]');
		if (!row || event.target.closest('a, button')) return '';
		return pick('.pu-link', row).href;
	}

	/* The near-full list and the people list both name accounts that open
     in the drawer; each steps through its own set of accounts. */
	function wireOpeners() {
		pick('[data-pu-near]', host).addEventListener('click', (event) => {
			const opener = event.target.closest('[data-pu-open-btn]');
			if (opener)
				openAccount(
					opener.getAttribute('data-pu-open-btn'),
					view.report.nearFull.map((row) => row.id),
				);
		});
		pick('[data-pu-power]', host).addEventListener('click', (event) => {
			const opener = event.target.closest('[data-pu-open-btn]');
			if (!opener) return;
			const ids = [
				...new Set(
					pickAll('[data-pu-person-account]', host).map((node) => node.getAttribute('data-pu-open-btn')),
				),
			];
			openAccount(opener.getAttribute('data-pu-open-btn'), ids);
		});
	}

	/* The range, comparison, filters and series switch all trigger a reload. */

	function wireRange() {
		fromField.min = toField.min = isoDate(FIRST_DAY);
		fromField.max = toField.max = isoDate(FINAL_DAY);

		for (const option of pickAll('[data-pu-range] input', host)) {
			option.addEventListener('change', () => {
				if (!option.checked) return;
				const custom = option.value === 'custom';
				view.preset = option.value;
				window.Basalt.slide(customBox, () => {
					customBox.hidden = !custom;
				});
				if (custom) {
					fromField.value = isoDate(view.range.from);
					toField.value = isoDate(view.range.to);
					fromField.focus();
					return;
				}
				view.range = { from: FINAL_DAY - Number(option.value) + 1, to: FINAL_DAY };
				fetchReport('range');
			});
		}

		customBox.addEventListener('submit', (event) => {
			event.preventDefault();
			const from = isoToDay(fromField.value);
			const to = isoToDay(toField.value);
			const problem = rangeProblem(from, to);
			for (const field of [fromField, toField]) {
				field.classList.toggle('is-invalid', Boolean(problem));
				if (problem) {
					field.setAttribute('aria-invalid', 'true');
					field.setAttribute('aria-describedby', 'pu-custom-error');
				} else {
					field.removeAttribute('aria-invalid');
					field.removeAttribute('aria-describedby');
				}
			}
			customNote.hidden = !problem;
			customNote.textContent = problem;
			if (problem) {
				fromField.focus();
				return;
			}
			view.range = { from, to };
			fetchReport('range');
		});

		compareBox.addEventListener('change', () => {
			view.compare = compareBox.value;
			fetchReport('compare');
		});
	}

	function rangeProblem(from, to) {
		if (from == null || to == null) return 'Pick both dates.';
		if (from > to) return 'The start date has to come before the end date.';
		if (from < FIRST_DAY || to > FINAL_DAY)
			return `Pick dates between ${shortDate(FIRST_DAY, true)} and ${shortDate(FINAL_DAY, true)}.`;
		return '';
	}

	function bindFilters() {
		for (const box of filterBoxes) {
			box.addEventListener('change', () => applyFilter(box.getAttribute('data-pu-filter'), box.value));
		}
		pick('[data-pu-clear]', host).addEventListener('click', () => {
			clearFilters();
			filterBoxes[0].focus();
		});
	}

	/** Sets one filter, keeps its select in step, redraws the chips and reloads unless told to hold off. */
	function applyFilter(key, value, holdReload) {
		view.filters[key] = value;
		const box = filterBoxes.find((node) => node.getAttribute('data-pu-filter') === key);
		if (box && box.value !== value) {
			box.value = value;
			window.Basalt.select?.refresh?.(box);
		}
		paintChips();
		if (!holdReload) fetchReport('filter');
	}

	function clearFilters() {
		for (const key of Object.keys(view.filters)) applyFilter(key, '', true);
		fetchReport('filter');
	}

	function paintChips() {
		const chips = Object.entries(view.filters)
			.filter(([, value]) => value)
			.map(([key, value]) => ({ label: value, remove: () => applyFilter(key, '') }));
		window.Basalt.drawer?.applied?.(chipRow, chips, clearFilters, filterBoxes[0]);
	}

	function wireSeriesSwitch() {
		for (const option of pickAll('input[name="pu-active"]', host)) {
			option.addEventListener('change', () => {
				if (!option.checked || !view.report) return;
				view.series = option.value;
				paintActivity(view.report);
				const canvas = pick('[data-pu-chart="active"]', host);
				if (shownCanvases.has(canvas)) drawChart(canvas, true);
			});
		}
	}

	/* Each export builds a CSV from the report that is on screen. */

	const EXPORTS = {
		falling: () => ({
			suffix: '-falling-accounts',
			header: [
				'Account',
				'Plan',
				'Region',
				'Owner',
				'Daily active',
				'Daily active before',
				'Change %',
				'Seat use %',
			],
			rows: slippingRows().map((row) => [
				row.name,
				row.plan,
				row.region,
				row.owner,
				row.active.toFixed(1),
				row.before.toFixed(1),
				(row.change * 100).toFixed(1),
				(row.seatUse * 100).toFixed(0),
			]),
		}),
		power: (report) => ({
			suffix: '-power-users',
			header: ['Name', 'Role', 'Account', 'Active days', 'Days in period', 'Actions', 'Most used'],
			rows: report.people.map((person) => [
				person.name,
				person.role,
				person.account,
				person.days,
				person.of,
				person.events,
				person.feature,
			]),
		}),
		report: (report) => {
			const { active } = report;
			const header = [
				report.bucket === 'week' ? 'Week of' : 'Day',
				'Daily active',
				'Weekly active',
				'Monthly active',
				'Stickiness %',
			];
			if (active.was) header.push(`Daily active, ${comparisonName().toLowerCase()}`);
			const rows = active.labels.map((day, slot) => [
				isoDate(day),
				Math.round(active.dau[slot]),
				Math.round(active.wau[slot]),
				Math.round(active.mau[slot]),
				((active.dau[slot] / active.mau[slot]) * 100).toFixed(1),
				...(active.was ? [Math.round(active.was.dau[slot])] : []),
			]);
			return { suffix: '', header, rows };
		},
	};

	function onExportClick(event) {
		const trigger = event.target.closest('[data-pu-export]');
		if (!trigger) return;
		const report = view.report;
		if (!report || report.empty) {
			notify({
				tone: 'warning',
				title: 'Nothing to export',
				text: 'Load a report with some accounts in it first.',
			});
			return;
		}
		const kind = trigger.getAttribute('data-pu-export');
		const { suffix, header, rows } = (EXPORTS[kind] || EXPORTS.report)(report);
		const fileName = `usage-${isoDate(view.range.from)}-to-${isoDate(view.range.to)}${suffix}.csv`;
		backend.saveCsv(fileName, header, rows);
		notify({ tone: 'success', title: 'Export ready', text: `${fileName} is in your downloads.` });
	}

	function csvField(value) {
		const text = String(value ?? '');
		return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
	}

	function csvText(header, rows) {
		return [header, ...rows].map((row) => row.map(csvField).join(',')).join('\n');
	}

	function saveText(fileName, text) {
		const link = document.createElement('a');
		const address = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
		link.href = address;
		link.download = fileName;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(address), 1000);
	}

	/* The drawer shows one account and can step to its neighbors. */

	function wireDrawer() {
		drawerPanel = window.bootstrap ? bootstrap.Offcanvas.getOrCreateInstance(drawer) : null;
		pick('[data-pu-acc-prev]', drawer).addEventListener('click', () => stepDrawer(-1));
		pick('[data-pu-acc-next]', drawer).addEventListener('click', () => stepDrawer(1));
		drawer.addEventListener('keydown', (event) => {
			const moves = { ArrowUp: -1, ArrowDown: 1 };
			if (!event.altKey || !(event.key in moves)) return;
			event.preventDefault();
			stepDrawer(moves[event.key]);
		});
		drawer.addEventListener('shown.bs.offcanvas', () => paintDrawerChart(true));
		drawer.addEventListener('hidden.bs.offcanvas', () => {
			if (!drawerChart) return;
			drawerChart.destroy();
			drawerChart = null;
		});
		pick('[data-pu-acc-flag]', drawer).addEventListener('click', flagCurrent);
	}

	/** Opens the drawer on one account; the list decides what Alt+Up and Alt+Down step through. */
	function openAccount(id, list) {
		view.drawerIds = list && list.includes(id) ? list : [id];
		view.drawerIndex = view.drawerIds.indexOf(id);
		showAccount(id).then(() => drawerPanel?.show());
	}

	function showAccount(id) {
		view.drawerTarget = id;
		return backend.account(id, view.range, view.compare).then((account) => {
			if (account && view.drawerTarget === id) paintDrawer(account);
		});
	}

	function stepDrawer(by) {
		const ids = view.drawerIds;
		if (ids.length < 2) return;
		view.drawerIndex = (view.drawerIndex + by + ids.length) % ids.length;
		showAccount(ids[view.drawerIndex]);
	}

	function paintDrawer(account) {
		drawerAccount = account;
		const seatShare = asPercent((account.seatUsers / account.seats) * 100);
		const dailyShown = account.active >= 10 ? asWhole(account.active) : account.active.toFixed(1);
		const stats = [
			['Daily active', dailyShown, changeBadge(account.change * 100 + 100, 100)],
			['Monthly active', asWhole(account.mau), ''],
			['Paid seats', asWhole(account.seats), ''],
			['Seat use', seatShare, ''],
		];

		pick('[data-pu-acc-name]', drawer).textContent = account.name;
		pick('[data-pu-acc-sub]', drawer).textContent =
			`${account.plan} plan, ${account.region}, ${account.channel.toLowerCase()}. Owner: ${account.owner}`;
		pick('[data-pu-acc-stats]', drawer).innerHTML = stats
			.map(
				([term, figure, badge]) =>
					`<div><dt>${term}</dt><dd><span class="basalt-num">${figure}</span>${badge ? ` ${badge}` : ''}</dd></div>`,
			)
			.join('');
		pick('[data-pu-acc-features]', drawer).innerHTML = account.features
			.map(
				(feature) =>
					`<li class="${feature.on ? 'is-on' : ''}"><i class="bi ${feature.on ? 'bi-check-circle-fill' : 'bi-circle'}" aria-hidden="true"></i>${htmlSafe(feature.name)}<span class="visually-hidden">${feature.on ? ', in use' : ', not used'}</span></li>`,
			)
			.join('');
		pick('[data-pu-acc-advice]', drawer).textContent = nextStep(account);
		pick('[data-pu-acc-full]', drawer).href = accountPage(account.id);
		drawerCanvas.setAttribute(
			'aria-label',
			`Daily active users at ${account.name}, averaging ${account.active.toFixed(1)} a day in this period`,
		);

		const ids = view.drawerIds;
		pick('[data-pu-acc-nav]', drawer).hidden = ids.length < 2;
		pick('[data-pu-acc-pos]', drawer).textContent =
			ids.length > 1 ? `${view.drawerIndex + 1} of ${ids.length}` : '';
		if (drawer.classList.contains('show')) paintDrawerChart(true);
	}

	/** The advice line: the first of these that applies wins. */
	function nextStep(account) {
		const seatShare = account.seatUsers / account.seats;
		if (account.change <= -0.15) {
			const asker =
				account.owner === 'Scaled team'
					? 'the main admin'
					: `${account.owner.split(' ')[0]} to ask the main admin`;
			return `Daily use fell ${Math.round(Math.abs(account.change) * 100)}%. Ask ${asker} whether a crew or a branch moved elsewhere, well before the renewal.`;
		}
		if (seatShare < 0.6)
			return `Only ${asPercent(seatShare * 100)} of paid seats are in use. Offer a short mobile app session for the staff who were invited but never logged a visit.`;
		if (!account.features.find((feature) => feature.id === 'sms').on)
			return 'This account has not switched on SMS reminders yet. Accounts that send them have fewer missed visits; send them the setup guide.';
		return 'Usage is holding up. Check in at the next quarterly review and ask what they would like to see next.';
	}

	function flagCurrent(event) {
		const button = event.currentTarget;
		const account = drawerAccount;
		if (!account) return;
		button.disabled = true;
		const recipient = account.owner === 'Scaled team' ? 'The scaled team' : account.owner;
		backend
			.flag(account.id, nextStep(account))
			.then(() => {
				notify({
					tone: 'success',
					title: 'Flagged',
					text: `${recipient} will see ${account.name} at the top of their list.`,
				});
			})
			.catch(() => {
				notify({
					tone: 'danger',
					title: 'Could not flag the account',
					text: 'Nothing was sent. Try again in a moment.',
				});
			})
			.then(() => {
				button.disabled = false;
			});
	}

	function paintDrawerChart(animate) {
		if (!drawerAccount) return;
		drawerChart?.destroy();
		const colors = chartColors();
		const lead = colors.series[0];
		const frame = { bucket: view.report.bucket, range: view.report.range };
		const datasets = [
			{
				label: 'This period',
				data: drawerAccount.series,
				borderColor: lead,
				backgroundColor: fadeFill(lead),
				fill: true,
				tension: 0.35,
				pointBackgroundColor: lead,
			},
		];
		if (drawerAccount.was) {
			datasets.push({
				label: comparisonName(),
				data: drawerAccount.was,
				borderColor: colors.rest,
				backgroundColor: colors.rest,
				borderWidth: 1.75,
				borderDash: [5, 4],
				tension: 0.35,
				pointBackgroundColor: colors.rest,
			});
		}
		const tickText = tickFormatter(frame);
		drawerChart = new Chart(drawerCanvas, {
			type: 'line',
			data: { labels: drawerAccount.labels, datasets },
			options: chartOptions(colors, animate && !motionOff, {
				plugins: {
					tooltip: {
						callbacks: {
							title: (items) => pointTitle(frame, drawerAccount.labels[items[0].dataIndex]),
							label: (item) => ` ${item.dataset.label}: ${item.parsed.y.toFixed(1)}`,
						},
					},
				},
				scales: {
					x: { ticks: { maxTicksLimit: 5, callback: (index) => tickText(drawerAccount.labels[index]) } },
					y: { beginAtZero: true },
				},
			}),
		});
	}

	/* The finder's command menu lists every account by plan; picking one
     opens the drawer, stepping through the falling table when the account
     is in it. */

	function fillFinder() {
		const item = (account) =>
			`<div class="basalt-command-item" role="option" id="pu-find-${account.id}" aria-selected="false" data-value="${account.id}" data-keywords="${htmlSafe(`${account.owner} ${account.channel}`)}"><span class="basalt-command-icon" aria-hidden="true"><i class="bi bi-building"></i></span><span class="basalt-command-text"><span class="basalt-command-title">${htmlSafe(account.name)}</span><span class="basalt-command-sub">${htmlSafe(account.region)}, ${account.seats} seats</span></span></div>`;
		pick('[data-pu-find-list]', host).innerHTML = SAMPLE.plans
			.map(
				(plan) => `<div class="basalt-command-group" role="group" aria-labelledby="pu-find-${plan}">
    <div class="basalt-command-heading" id="pu-find-${plan}">${plan}</div>
    ${everyAccount
		.filter((account) => account.plan === plan)
		.map(item)
		.join('')}
  </div>`,
			)
			.join('');
		finder.setAttribute('data-basalt-command', '');
		if (window.Basalt.command) window.Basalt.command(finder);
		finder.addEventListener('basalt:command', (event) => {
			const id = event.detail.value;
			const report = view.report;
			const slipping = report && !report.empty ? report.falling.map((row) => row.id) : [];
			openAccount(id, slipping.includes(id) ? slippingRows().map((row) => row.id) : [id]);
		});
	}

	/* Each chart canvas is drawn the first time it nears the viewport and
     redrawn from the current report after that. */

	function onCanvasSeen(entries) {
		for (const entry of entries) {
			if (!entry.isIntersecting || !view.report) continue;
			viewWatcher.unobserve(entry.target);
			shownCanvases.add(entry.target);
			drawChart(entry.target, true);
		}
	}

	function watchCanvases() {
		for (const canvas of chartCanvases) {
			if (shownCanvases.has(canvas)) continue;
			if (viewWatcher) {
				viewWatcher.observe(canvas);
			} else {
				shownCanvases.add(canvas);
				drawChart(canvas, false);
			}
		}
	}

	function redrawShown(animate) {
		for (const canvas of shownCanvases) drawChart(canvas, animate);
	}

	function drawChart(canvas, animate) {
		const report = view.report;
		if (!report || report.empty) return;
		const recipe = CHART_RECIPES[canvas.getAttribute('data-pu-chart')];
		if (!recipe) return;
		liveCharts.get(canvas)?.destroy();
		liveCharts.set(canvas, new Chart(canvas, recipe(chartColors(), animate && !motionOff, report, canvas)));
	}

	/** The KPI sparkline: the period as a soft area, the comparison dotted behind it. */
	function sparkChart(colors, animate, report, canvas) {
		const key = canvas.getAttribute('data-pu-spark');
		const figure = report.kpis[key];
		const tone = colors.series[{ dau: 0, mau: 1, stick: 2, activation: 3 }[key]];
		const lastSlot = figure.series.length - 1;
		const datasets = [
			{
				data: figure.series,
				borderColor: tone,
				/* The area runs down to the card's foot in a faint tint. */
				backgroundColor: window.Basalt.chartFill(
					[
						[0, tint(tone, 0.2)],
						[1, tint(tone, 0.06)],
					],
					{ flat: tint(tone, 0.1) },
				),
				fill: true,
				borderWidth: 2,
				tension: 0.35,
				spanGaps: true,
				pointRadius: (context) => (context.dataIndex === lastSlot ? 3 : 0),
				pointBackgroundColor: tone,
				pointBorderWidth: 0,
				pointHoverRadius: 4,
			},
		];
		if (figure.wasSeries) {
			datasets.push({
				data: figure.wasSeries,
				borderColor: colors.rest,
				borderWidth: 1.5,
				borderDash: [3, 3],
				tension: 0.35,
				spanGaps: true,
				fill: false,
				pointRadius: 0,
			});
		}
		return {
			type: 'line',
			data: { labels: figure.series.map((_, slot) => slot), datasets },
			options: chartOptions(colors, animate, {
				layout: { autoPadding: false, padding: { top: 4, right: 0, bottom: 0, left: 0 } },
				plugins: { tooltip: { enabled: false } },
				/* Pointing along the line shows that week in the card. */
				...window.Basalt.sparkReadout?.({
					value: pick('[data-pu-kpi-value]', canvas.closest('[data-pu-kpi]')),
					note: pick('.pu-kpi-change', canvas.closest('[data-pu-kpi]')),
					labels: report.active.labels.map((day) => pointTitle(report, day)),
					format: (value) => (key === 'dau' || key === 'mau' ? asWhole(value) : asPercent(value, 1)),
				}),
				scales: { x: { display: false }, y: { display: false, grace: '8%' } },
			}),
		};
	}

	/**
	 * Active people over time. The daily view is bars under a seven-day
	 * average line, as on the mixed chart page; the others are a filled
	 * line. The comparison is always dashed, and on the daily view it is
	 * the average too, because weekdays rarely line up between two periods.
	 */
	function activityChart(colors, animate, report) {
		const { active } = report;
		const key = view.series;
		const daily = key === 'dau';
		const lead = colors.series[0];
		const pastKey = daily ? 'avg' : key;
		const datasets = daily
			? [
					{
						type: 'line',
						label: 'Seven-day average',
						data: active.avg,
						borderColor: lead,
						backgroundColor: lead,
						pointBackgroundColor: lead,
						tension: 0.35,
						order: 0,
					},
					{
						type: 'bar',
						label: SERIES_NAMES.dau,
						data: active.dau,
						order: 2,
						backgroundColor: tint(lead, 0.32),
						hoverBackgroundColor: tint(lead, 0.6),
						barPercentage: 0.82,
						categoryPercentage: 0.9,
						maxBarThickness: 22,
					},
				]
			: [
					{
						type: 'line',
						label: SERIES_NAMES[key],
						data: active[key],
						borderColor: lead,
						backgroundColor: fadeFill(lead),
						pointBackgroundColor: lead,
						fill: true,
						tension: 0.35,
						order: 0,
					},
				];
		if (active.was) {
			datasets.push({
				type: 'line',
				label: comparisonName() + (daily ? ', seven-day average' : ''),
				data: active.was[pastKey],
				borderColor: colors.rest,
				backgroundColor: colors.rest,
				pointBackgroundColor: colors.rest,
				borderWidth: 1.75,
				borderDash: [5, 4],
				tension: 0.35,
				order: 1,
			});
		}
		const tickText = tickFormatter(report);
		const changeLine = (items) => {
			if (!active.was) return '';
			const slot = items[0].dataIndex;
			const current = daily ? active.avg[slot] : active[key][slot];
			const past = active.was[pastKey][slot];
			if (!past) return '';
			return `${asSigned(((current - past) / past) * 100)}% on ${view.compare === 'year' ? 'last year' : 'the period before'}`;
		};
		return {
			type: 'bar',
			data: { labels: active.labels, datasets },
			options: chartOptions(colors, animate, {
				plugins: {
					tooltip: {
						itemSort: (left, right) => left.datasetIndex - right.datasetIndex,
						callbacks: {
							title: (items) => pointTitle(report, active.labels[items[0].dataIndex]),
							label: (item) => ` ${item.dataset.label}: ${asWhole(item.parsed.y)}`,
							footer: changeLine,
						},
					},
				},
				scales: {
					x: { ticks: { callback: (index) => tickText(active.labels[index]) } },
					y: { beginAtZero: daily, ticks: { callback: (value) => asShort(value) } },
				},
			}),
		};
	}

	/** Top events as a ring, each slice one action's share of everything done. */
	function eventsChart(colors, animate, report) {
		const ranked = report.events.slice().sort((left, right) => right.count - left.count);
		const allActions = ranked.reduce((acc, event) => acc + event.count, 0);
		return {
			type: 'doughnut',
			data: {
				labels: ranked.map((event) => event.name),
				datasets: [
					{
						data: ranked.map((event) => event.count),
						backgroundColor: ranked.map((_, slot) => colors.series[slot % colors.series.length]),
						borderColor: colors.surface,
						borderWidth: 3,
						hoverOffset: 4,
					},
				],
			},
			options: chartOptions(colors, animate, {
				cutout: '74%',
				interaction: { mode: 'nearest', intersect: true },
				layout: { padding: 6 },
				plugins: {
					tooltip: {
						callbacks: {
							label: (item) =>
								` ${item.label}: ${asWhole(item.parsed)} (${asPercent((item.parsed / allActions) * 100)})`,
						},
					},
				},
				scales: { x: { display: false }, y: { display: false } },
			}),
		};
	}

	/** One pooled line: the share of new workspaces still active each week after signup. */
	function stayChart(colors, animate, report) {
		const lead = colors.series[0];
		return {
			type: 'line',
			data: {
				labels: report.stay.map((_, week) => week),
				datasets: [
					{
						label: 'Still active',
						data: report.stay,
						borderColor: lead,
						backgroundColor: lead,
						pointBackgroundColor: lead,
						tension: 0.3,
						borderWidth: 2.5,
						pointRadius: 0,
					},
				],
			},
			options: chartOptions(colors, animate, {
				layout: { padding: { top: 10, right: 12 } },
				plugins: {
					tooltip: {
						displayColors: false,
						callbacks: {
							title: (items) =>
								items[0].dataIndex === 0 ? 'Signup week' : `Week ${items[0].dataIndex} after signup`,
							label: (item) => ` ${Math.round(item.parsed.y)}% still active`,
						},
					},
				},
				scales: {
					x: {
						title: {
							display: true,
							text: 'Weeks after signup',
							color: colors.quiet,
							font: { family: CHART_FONT, size: 11.5, weight: '500' },
						},
					},
					y: { min: 0, max: 100, ticks: { stepSize: 25, callback: (value) => `${value}%` } },
				},
			}),
		};
	}

	/**
	 * Seat use as one bullet per plan, after the bullet on the bar chart
	 * page: active seat holders inside the paid seats, a mark at 80%, and
	 * the figures written to the right of each track.
	 */
	function seatsChart(colors, animate, report) {
		const { plans } = report;
		const tone = colors.series[1];
		const useOf = (plan) => (plan.mau / plan.seats) * 100;
		const bar = { borderSkipped: 'start', categoryPercentage: 1, grouped: false };
		return {
			type: 'bar',
			data: {
				labels: plans.map((plan) => plan.plan),
				datasets: [
					{
						...bar,
						label: 'Seat use',
						data: plans.map(useOf),
						backgroundColor: tone,
						hoverBackgroundColor: tone,
						borderRadius: 4,
						barPercentage: 0.36,
						maxBarThickness: 18,
						order: 0,
					},
					{
						...bar,
						label: 'Paid seats',
						data: plans.map(() => 100),
						backgroundColor: colors.track,
						hoverBackgroundColor: colors.track,
						borderRadius: 6,
						barPercentage: 0.72,
						maxBarThickness: 36,
						order: 1,
					},
				],
			},
			options: chartOptions(colors, animate, {
				indexAxis: 'y',
				interaction: { mode: 'index', intersect: false, axis: 'y' },
				layout: { padding: { right: 112 } },
				plugins: {
					tooltip: {
						filter: (item) => item.datasetIndex === 0,
						callbacks: {
							label: (item) => {
								const plan = plans[item.dataIndex];
								return ` ${asWhole(plan.mau)} active of ${asWhole(plan.seats)} paid seats, ${asPercent(useOf(plan))}`;
							},
							footer: (items) => {
								const plan = plans[items[0].dataIndex];
								if (plan.wasMau == null) return '';
								return `${asPercent((plan.wasMau / plan.seats) * 100)} at the end of the ${view.compare === 'year' ? 'same period last year' : 'period before'}`;
							},
						},
					},
				},
				scales: {
					x: {
						min: 0,
						max: 100,
						grid: { display: true, color: colors.grid },
						ticks: { stepSize: 25, callback: (value) => `${value}%` },
					},
					y: { grid: { display: false }, ticks: { color: colors.text, autoSkip: false } },
				},
			}),
			plugins: [{ id: 'puSeatMarks', afterDatasetsDraw: (chart) => drawSeatMarks(chart, plans, colors, useOf) }],
		};
	}

	function drawSeatMarks(chart, plans, colors, useOf) {
		const {
			ctx,
			scales: { x },
		} = chart;
		const mark = x.getPixelForValue(80);
		ctx.save();
		for (const [slot, track] of chart.getDatasetMeta(1).data.entries()) {
			const plan = plans[slot];
			const half = track.height / 2;
			ctx.strokeStyle = colors.text;
			ctx.lineWidth = 2.5;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(mark, track.y - half + 2);
			ctx.lineTo(mark, track.y + half - 2);
			ctx.stroke();

			ctx.textAlign = 'left';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = colors.text;
			ctx.font = `600 11.5px ${CHART_FONT}`;
			ctx.fillText(asPercent(useOf(plan)), track.x + 10, track.y - 7);
			ctx.fillStyle = colors.quiet;
			ctx.font = `500 11px ${CHART_FONT}`;
			ctx.fillText(`${asShort(plan.mau)} of ${asShort(plan.seats)}`, track.x + 10, track.y + 8);
		}
		ctx.restore();
	}

	/* Chart plumbing shared with the chart pages. */

	function cssToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** Reads #rgb, #rrggbb, rgb() or rgba() into [r, g, b, a]; anything else becomes mid gray. */
	function rgbaParts(color) {
		const text = String(color || '').trim();
		const short = /^#([0-9a-f]{3})$/i.exec(text);
		if (short) return [...short[1]].map((digit) => parseInt(digit + digit, 16)).concat(1);
		const long = /^#([0-9a-f]{6})$/i.exec(text);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 1];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(text);
		if (functional) {
			const channels = functional[1].split(',').map((part) => parseFloat(part));
			return [channels[0], channels[1], channels[2], channels.length > 3 ? channels[3] : 1];
		}
		return [128, 128, 128, 1];
	}

	function tint(color, alpha) {
		const [red, green, blue] = rgbaParts(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	/** Mixes two colors; weight is how much of the first one goes in. */
	function blend(first, second, weight) {
		const one = rgbaParts(first);
		const two = rgbaParts(second);
		const [red, green, blue] = [0, 1, 2].map((channel) =>
			Math.round(one[channel] * weight + two[channel] * (1 - weight)),
		);
		return `rgb(${red}, ${green}, ${blue})`;
	}

	function chartColors() {
		const ink = cssToken('--basalt-copy', '#12233a');
		const muted = cssToken('--basalt-copy-muted', '#5f7186');
		return {
			series: [1, 2, 3, 4, 5, 6, 7, 8].map((step) => cssToken(`--basalt-series-${step}`, '#2b6fd4')),
			text: ink,
			/* The recipe behind --pu-quiet in product-usage.css: small gray text
         that still passes 4.5:1 on the lighter palettes. */
			quiet: blend(muted, ink, 0.82),
			rest: tint(ink, 0.32),
			grid: tint(ink, 0.07),
			track: tint(ink, 0.08),
			surface: cssToken('--basalt-plane', '#ffffff'),
			border: cssToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
		};
	}

	function isPlainObject(value) {
		return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
	}

	/** Copies base and lays extra over it, merging nested plain objects instead of replacing them. */
	function mergeDeep(base, extra) {
		const merged = { ...base };
		for (const [key, value] of Object.entries(extra || {})) {
			merged[key] = isPlainObject(value) && isPlainObject(merged[key]) ? mergeDeep(merged[key], value) : value;
		}
		return merged;
	}

	function chartOptions(colors, animate, extra) {
		const tickStyle = { color: colors.quiet, font: TICK_FONT, padding: 8 };
		const tooltip = {
			backgroundColor: colors.surface,
			titleColor: colors.text,
			bodyColor: colors.text,
			footerColor: colors.quiet,
			borderColor: colors.border,
			borderWidth: 1,
			padding: 10,
			cornerRadius: 8,
			boxPadding: 4,
			usePointStyle: true,
			titleFont: { family: CHART_FONT, size: 12, weight: '600' },
			bodyFont: { family: CHART_FONT, size: 12 },
			footerFont: { family: CHART_FONT, size: 11.5, weight: '600' },
		};
		return mergeDeep(
			{
				responsive: true,
				maintainAspectRatio: false,
				animation: animate ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				layout: { padding: { top: 6, right: 6 } },
				elements: {
					line: { borderWidth: 2.5, borderCapStyle: 'round', borderJoinStyle: 'round' },
					point: { radius: 0, hoverRadius: 5, hoverBorderWidth: 2, hoverBorderColor: colors.surface },
					bar: { borderRadius: 4, borderSkipped: 'start' },
				},
				plugins: { legend: { display: false }, tooltip },
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: { maxRotation: 0, autoSkipPadding: 14, ...tickStyle },
					},
					y: {
						grid: { color: colors.grid },
						border: { display: false },
						ticks: { maxTicksLimit: 5, ...tickStyle },
					},
				},
			},
			extra,
		);
	}

	/** A fill under a line that fades to nothing; with gradients off it keeps a faint tint. */
	function fadeFill(color, strength) {
		return window.Basalt.chartFill(
			[
				[0, tint(color, strength || 0.24)],
				[1, tint(color, 0)],
			],
			{ flat: tint(color, 0.1) },
		);
	}

	/** Axis dates: month names alone once weekly buckets cover more than 200 days. */
	function tickFormatter(frame) {
		const monthsOnly = frame.bucket === 'week' && frame.range.to - frame.range.from > 200;
		const format = monthsOnly ? { month: 'short' } : { month: 'short', day: 'numeric' };
		return (day) => dateOf(day).toLocaleDateString('en-US', format);
	}

	function pointTitle(frame, day) {
		if (frame.bucket === 'week') return `Week of ${shortDate(day, true)}`;
		return dateOf(day).toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});
	}

	/* Small helpers that every part above leans on. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
	}

	function accountPage(id) {
		return `company-details.html?id=${encodeURIComponent(id)}`;
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function announce(text) {
		window.Basalt.announce?.(text);
	}

	function asWhole(value) {
		return Math.round(value).toLocaleString('en-US');
	}

	/** Large counts as 12.5k or 1.2M; anything under 10,000 stays whole. */
	function asShort(value) {
		const compact = (scaled, digits) => scaled.toFixed(digits).replace(/\.0$/, '');
		if (value >= 1e6) return `${compact(value / 1e6, value >= 1e7 ? 0 : 1)}M`;
		if (value >= 10000) return `${compact(value / 1000, value >= 100000 ? 0 : 1)}k`;
		return asWhole(value);
	}

	function asPercent(value, digits) {
		return value == null ? '' : `${value.toFixed(digits ?? 0)}%`;
	}

	/** A number with its sign spelled out, using a true minus. */
	function asSigned(value, digits) {
		const sign = value > 0 ? '+' : value < 0 ? MINUS : '';
		return `${sign}${Math.abs(value).toFixed(digits ?? 0)}`;
	}

	/**
	 * A change as the shared trend badge (.basalt-trend-up, -down or
	 * -flat). Percent change by default; options.points reports the plain
	 * difference in points and options.invert flips the colors. Returns ''
	 * when there is nothing sound to compare.
	 */
	function changeBadge(current, previous, options = {}) {
		const { points, invert } = options;
		if (
			current == null ||
			previous == null ||
			!Number.isFinite(current) ||
			!Number.isFinite(previous) ||
			(!points && !previous)
		)
			return '';
		const delta = points ? current - previous : ((current - previous) / previous) * 100;
		const digits = points ? 1 : 0;
		let look = { dir: 'flat', icon: 'bi-dash', shown: 'No change', spoken: 'no change' };
		if (Math.abs(delta) >= 0.5) {
			const rising = delta > 0;
			look = {
				dir: rising ? 'up' : 'down',
				icon: rising ? 'bi-arrow-up-right' : 'bi-arrow-down-right',
				shown: `${asSigned(delta, digits)}${points ? ' pts' : '%'}`,
				spoken: `${rising ? 'up' : 'down'} ${Math.abs(delta).toFixed(digits)}${points ? ' points' : ' percent'}`,
			};
		}
		return `<span class="basalt-trend basalt-trend-${look.dir}${invert ? ' basalt-trend-invert' : ''}"><i class="bi ${look.icon}" aria-hidden="true"></i><span aria-hidden="true">${look.shown}</span><span class="visually-hidden">${look.spoken}</span></span>`;
	}

	function isoDate(day) {
		const date = dateOf(day);
		const pad = (number) => String(number).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	}

	/** A YYYY-MM-DD string as a day number, or null when it is not one. */
	function isoToDay(text) {
		const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text || '');
		return parts ? dayOf(new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))) : null;
	}

	function shortDate(day, withYear) {
		const format = withYear
			? { month: 'short', day: 'numeric', year: 'numeric' }
			: { month: 'short', day: 'numeric' };
		return dateOf(day).toLocaleDateString('en-US', format);
	}

	function spanLabel(span) {
		const sameYear = dateOf(span.from).getFullYear() === dateOf(span.to).getFullYear();
		return `${shortDate(span.from, !sameYear)} to ${shortDate(span.to, true)}`;
	}

	start();
})();
