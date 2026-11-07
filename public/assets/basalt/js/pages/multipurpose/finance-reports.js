/**
 * Finance Reports (finance-reports.html). Fieldline's month-end
 * statements, one at a time: profit and loss, balance sheet, cash flow,
 * budget against actual, what customers owe, what suppliers are owed, and
 * the trial balance.
 *
 * Every figure on the page comes out of one small monthly model
 * (LEDGER_LINES below), which is why the statements never contradict each
 * other: cash is whatever is left once every other balance is placed, so
 * the cash flow statement always lands on the balance sheet's cash. To run
 * the page on real books, have incomeIn(), balances() and the AGED lists
 * return figures from your ledger; nothing else reads the model.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-fr-root]', document);
	if (!pageRoot) return;

	const DASH = '−';
	const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
	const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	const NIL_CELL = '<span class="fr-nil">–</span>';
	const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

	/* The calendar. Month 0 is January 2025 and 20 is September 2026, the
     newest month with closed books; -1 (December 2024) only carries an
     opening balance. */
	const MONTHS_LONG = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	];
	const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	const NEWEST_CLOSED = 20;
	const AS_AT = 'Oct 9, 2026';
	const BOOKS_CLOSED = { 17: 'Jul 6, 2026', 18: 'Aug 5, 2026', 19: 'Sep 4, 2026', 20: 'Oct 6, 2026' };

	/* The model. Each line holds its September 2026 value, a monthly growth
     rate and a small seasonal swing; every other month is derived. */
	const ADD_ONS = [
		{ name: 'Data import', price: 649, units: 30, margin: 0.34 },
		{ name: 'Scheduler course', price: 429, units: 18, margin: 0.31 },
		{ name: 'Report template', price: 149, units: 40, margin: 0.38 },
		{ name: 'Staff onboarding', price: 119, units: 36, margin: 0.42 },
		{ name: 'Custom form build', price: 189, units: 22, margin: 0.36 },
		{ name: 'Staff profile import', price: 49, units: 52, margin: 0.55 },
		{ name: 'Extra storage, 10 GB', price: 39, units: 28, margin: 0.5 },
		{ name: 'Office set-up call', price: 89, units: 12, margin: 0.44 },
	].map((product) => ({
		...product,
		revenue: product.price * product.units,
		cost: Math.round(product.price * product.units * (1 - product.margin)),
	}));
	const ADD_ON_SALES = ADD_ONS.reduce((sum, product) => sum + product.revenue, 0);
	const ADD_ON_COST = ADD_ONS.reduce((sum, product) => sum + product.cost, 0);

	const LEDGER_LINES = {
		sub: [872400, 0.025, 0.004],
		svc: [18600, 0.015, 0.08],
		add: [ADD_ON_SALES, 0.02, 0.06],
		ref: [5240, 0.015, 0.1],
		host: [71800, 0.018, 0.02],
		pay: [23300, 0.023, 0.02],
		sup: [64500, 0.012, 0.01],
		eng: [214300, 0.012, 0.01],
		sales: [121800, 0.015, 0.03],
		mkt: [76400, 0.012, 0.12],
		ga: [62100, 0.008, 0.03],
		office: [26100, 0.005, 0.02],
		da: [9800, 0.01, 0],
		int: [4100, 0.01, 0.03],
	};
	const LINE_KEYS = Object.keys(LEDGER_LINES);
	const PAID_IN_CAPITAL = 1500000;
	const OPENING_RETAINED = -1490000;
	const TAX_RATE = 0.24;
	/* The 2026 budget for each cost line is a fixed share of that line's
     underlying trend, rounded to the nearest hundred dollars. */
	const BUDGET_FACTOR = {
		host: 1.04,
		pay: 0.97,
		addc: 1.1,
		sup: 1.02,
		eng: 1.03,
		sales: 0.98,
		mkt: 1.08,
		ga: 1.05,
		office: 1.02,
	};
	const PLAN_WEIGHTS = [
		['Max', 361],
		['Pro', 361],
		['Basic', 158],
	];
	const incomeMemo = new Map();
	const balanceMemo = new Map();

	/* Statement rows. A row is a section (name and ramp color), a line
     (opens the drawer), a subtotal or the grand total; `better` says which
     direction is good news and `flip` shows a deduction as a positive. */
	const RAMP = {
		1: 'var(--basalt-series-1)',
		2: 'var(--basalt-series-2)',
		3: 'var(--basalt-series-3)',
		4: 'var(--basalt-series-4)',
	};
	const INCOME_ROWS = [
		{ section: 'Revenue', tone: 1 },
		{ id: 'sub', label: 'Subscriptions', better: 'up', tone: 1 },
		{ id: 'svc', label: 'Onboarding and training', better: 'up', tone: 1 },
		{ id: 'add', label: 'Add-ons and set-up work', better: 'up', tone: 1 },
		{ id: 'ref', label: 'Refunds and credits', better: 'down', tone: 1, flip: true },
		{ subtotal: 'rev', label: 'Total revenue', better: 'up' },
		{ section: 'Cost of revenue', tone: 2 },
		{ id: 'host', label: 'Hosting and infrastructure', better: 'down', tone: 2 },
		{ id: 'pay', label: 'Payment processing', better: 'down', tone: 2 },
		{ id: 'addc', label: 'Add-on costs', better: 'down', tone: 2 },
		{ id: 'sup', label: 'Customer support', better: 'down', tone: 2 },
		{ subtotal: 'cor', label: 'Total cost of revenue', better: 'down' },
		{ subtotal: 'gp', label: 'Gross profit', better: 'up', bold: true },
		{ section: 'Operating expenses', tone: 3 },
		{ id: 'eng', label: 'Product and engineering', better: 'down', tone: 3 },
		{ id: 'sales', label: 'Sales', better: 'down', tone: 3 },
		{ id: 'mkt', label: 'Marketing', better: 'down', tone: 3 },
		{ id: 'ga', label: 'General and admin', better: 'down', tone: 3 },
		{ id: 'office', label: 'Office and facilities', better: 'down', tone: 3 },
		{ subtotal: 'opex', label: 'Total operating expenses', better: 'down' },
		{ subtotal: 'op', label: 'Operating profit', better: 'up', bold: true },
		{ section: 'Other', tone: 4 },
		{ id: 'da', label: 'Depreciation and amortization', better: 'down', tone: 4, flip: true },
		{ id: 'int', label: 'Interest income', better: 'up', tone: 4 },
		{ subtotal: 'pbt', label: 'Profit before tax', better: 'up' },
		{ id: 'tax', label: 'Income tax', better: 'down', tone: 4, flip: true },
		{ grand: 'ni', label: 'Net income', better: 'up' },
	];
	const BALANCE_ROWS = [
		{ section: 'Assets', tone: 1 },
		{ id: 'cash', label: 'Cash', better: 'up', tone: 1 },
		{ id: 'ar', label: 'Owed by customers', better: 'down', tone: 1 },
		{ id: 'inv', label: 'Prepaid SMS credit', better: 'down', tone: 1 },
		{ id: 'pre', label: 'Paid in advance', better: 'down', tone: 1 },
		{ id: 'equip', label: 'Equipment, after depreciation', better: 'up', tone: 1 },
		{ subtotal: 'assets', label: 'Total assets', better: 'up', bold: true },
		{ section: 'Liabilities', tone: 2 },
		{ id: 'ap', label: 'Owed to suppliers', better: 'down', tone: 2 },
		{ id: 'accr', label: 'Salaries owed', better: 'down', tone: 2 },
		{ id: 'stax', label: 'Sales tax to pay', better: 'down', tone: 2 },
		{ id: 'def', label: 'Billed, not yet earned', better: 'up', tone: 2 },
		{ id: 'loan', label: 'Equipment loan', better: 'down', tone: 2 },
		{ subtotal: 'liab', label: 'Total liabilities', better: 'down' },
		{ section: 'Equity', tone: 3 },
		{ id: 'cap', label: 'Share capital', better: 'up', tone: 3 },
		{ id: 're', label: 'Retained earnings', better: 'up', tone: 3 },
		{ subtotal: 'eq', label: 'Total equity', better: 'up' },
		{ grand: 'le', label: 'Liabilities and equity', better: 'up' },
	];
	const CASH_ROWS = [
		{ section: 'Operating activities', tone: 1 },
		{ id: 'ni', label: 'Net income', better: 'up', tone: 1 },
		{ id: 'da', label: 'Depreciation added back', better: 'up', tone: 1 },
		{ id: 'ar', label: 'Owed by customers', better: 'up', tone: 1 },
		{ id: 'inv', label: 'Prepaid SMS credit', better: 'up', tone: 1 },
		{ id: 'pre', label: 'Paid in advance', better: 'up', tone: 1 },
		{ id: 'ap', label: 'Owed to suppliers', better: 'up', tone: 1 },
		{ id: 'accr', label: 'Salaries owed', better: 'up', tone: 1 },
		{ id: 'stax', label: 'Sales tax to pay', better: 'up', tone: 1 },
		{ id: 'def', label: 'Billed, not yet earned', better: 'up', tone: 1 },
		{ subtotal: 'ops', label: 'Cash from operations', better: 'up', bold: true },
		{ section: 'Investing activities', tone: 2 },
		{ id: 'capex', label: 'Equipment bought', better: 'up', tone: 2 },
		{ subtotal: 'invest', label: 'Cash from investing', better: 'up' },
		{ section: 'Financing activities', tone: 3 },
		{ id: 'loan', label: 'Loan repayments', better: 'up', tone: 3 },
		{ subtotal: 'fin', label: 'Cash from financing', better: 'up' },
		{ grand: 'net', label: 'Net change in cash', better: 'up' },
		{ subtotal: 'open', label: 'Cash at the start', better: 'up', faint: true },
		{ subtotal: 'close', label: 'Cash at the end', better: 'up', bold: true },
	];
	const COST_GROUPS = [
		{ section: 'Cost of revenue', tone: 2, keys: ['host', 'pay', 'addc', 'sup'] },
		{ section: 'Operating expenses', tone: 3, keys: ['eng', 'sales', 'mkt', 'ga', 'office'] },
	];
	const LINE_LABEL = Object.fromEntries(INCOME_ROWS.filter((row) => row.id).map((row) => [row.id, row.label]));

	/* Where a statement's figures come from for a run of months, and where
     a single line's figure for one month comes from (the drawer's trend). */
	const FIGURES_FOR = {
		pnl(months) {
			return incomeAcross(months);
		},
		balance(months) {
			return balances(months.at(-1));
		},
		cashflow(months) {
			return cashMoves(months);
		},
	};
	const MONTH_FIGURE = {
		pnl(id, index) {
			return incomeIn(index)[id];
		},
		balance(id, index) {
			return balances(index)[id];
		},
		cashflow(id, index) {
			return cashMoves([index])[id];
		},
		budget(id, index) {
			return incomeIn(index)[id];
		},
	};
	const CATALOG = {
		pnl: { title: 'Profit and loss', rows: INCOME_ROWS, statement: true, firstColumn: 'Line', draw: drawStatement },
		balance: {
			title: 'Balance sheet',
			rows: BALANCE_ROWS,
			statement: true,
			snapshot: true,
			firstColumn: 'Account',
			draw: drawStatement,
		},
		cashflow: {
			title: 'Cash flow',
			rows: CASH_ROWS,
			statement: true,
			firstColumn: 'Movement',
			draw: drawStatement,
		},
		budget: { title: 'Budget against actual', firstColumn: 'Cost', draw: drawBudget },
		ar: { title: 'Owed by customers', aging: true, party: 'Customer', draw: drawAged },
		ap: { title: 'Owed to suppliers', aging: true, party: 'Supplier', draw: drawAged },
		trial: { title: 'Trial balance', snapshot: true, draw: drawTrialBalance },
	};
	const PERIOD_OPTIONS = {
		m20: { label: 'September 2026', months: [20], kind: 'month' },
		m19: { label: 'August 2026', months: [19], kind: 'month' },
		m18: { label: 'July 2026', months: [18], kind: 'month' },
		m17: { label: 'June 2026', months: [17], kind: 'month' },
		q3: { label: 'Q3 2026', months: [18, 19, 20], kind: 'quarter' },
		q2: { label: 'Q2 2026', months: [15, 16, 17], kind: 'quarter' },
		ytd: { label: '2026 to date', months: sequence(12, 20), kind: 'ytd' },
	};

	/* Open invoices and bills, live as at Oct 9, 2026. What customers owe is
     every invoice sent and unpaid in the billing data
     (assets/basalt/js/data/multipurpose/billing.js) that Invoices, Income and Accounting also
     read, so the totals agree page to page. The nine largest balances get
     a row each and the rest share one. A doc is [number, what, amount,
     due, days late], with days late negative while not yet due. */
	const INVOICING = window.Basalt.data.billing;
	const CUSTOMER_BOOK = window.Basalt.data.accounts;
	const RECEIVABLES = receivablesByCustomer(9);
	const AGED = {
		ar: RECEIVABLES.rows,
		arOthers: RECEIVABLES.others,
		ap: [
			{
				name: 'Inlet Cloud',
				note: 'Hosting and infrastructure',
				docs: [['#2318', 'September hosting', 70940, 'Oct 15', -6]],
			},
			{
				name: 'Relaywave Messaging',
				note: 'Text messages, bought ahead',
				booked: true,
				docs: [
					['#2305', '2.1M SMS credits for October', 16480, 'Oct 28', -19],
					['#2240', 'Q4 top-up, 3M texts', 24640, 'Oct 26', -17],
				],
			},
			{
				name: 'Brightwork Studio',
				note: 'Campaign design',
				docs: [['#2311', 'Autumn campaign', 18500, 'Oct 28', -19]],
			},
			{
				name: 'Ledgerline Advisors',
				note: 'Audit and tax',
				docs: [
					['#2296', 'Q3 review', 12000, 'Oct 15', -6],
					['#2188', 'Tax filing, disputed', 6500, 'Aug 25', 45],
				],
			},
			{
				name: 'Coursekit',
				note: 'Course platform and videos',
				booked: true,
				docs: [
					['#2299', 'Course hosting, Q4', 5172, 'Nov 5', -27],
					['#2262', 'Training videos, 6 lessons', 5920, 'Nov 2', -24],
				],
			},
			{
				name: 'Northwire Telecom',
				note: 'Text-back phone lines',
				docs: [
					['#2314', 'September lines', 4260, 'Oct 12', -3],
					['#2251', 'August lines', 3980, 'Sep 12', 27],
				],
			},
		],
		apOthers: { count: 21, buckets: [14320, 2180, 0, 0] },
	};

	/* Saved reports. Owners come from the reports data
     (assets/basalt/js/data/multipurpose/reports.js). A report that lives in the Reports library
     opens its own page (full); the others link to the page their figures
     come from (page). */
	const REPORT_LIBRARY = window.Basalt.data.reports;
	const OWNER_NAMES = Object.fromEntries(REPORT_LIBRARY.people.map((who) => [who.id, who.name]));
	const PLAN_REPORT = REPORT_LIBRARY.reports.find((report) => report.id === 'r-102');
	const FIGURES = {
		revenue: {
			label: 'Revenue',
			icon: 'bi-graph-up-arrow',
			tone: 1,
			monthly(index) {
				return incomeIn(index).rev;
			},
			lines() {
				return INCOME_ROWS.slice(1, 5).map((row) => ({
					label: row.label,
					value: incomeIn(NEWEST_CLOSED)[row.id] * (row.flip ? -1 : 1),
				}));
			},
		},
		costs: {
			label: 'Costs',
			icon: 'bi-receipt',
			tone: 2,
			monthly(index) {
				return incomeIn(index).cor + incomeIn(index).opex;
			},
			lines() {
				return COST_GROUPS.flatMap((group) => group.keys)
					.map((key) => ({ label: LINE_LABEL[key], value: incomeIn(NEWEST_CLOSED)[key] }))
					.sort((a, b) => b.value - a.value);
			},
		},
		ni: {
			label: 'Net income',
			icon: 'bi-piggy-bank',
			tone: 3,
			monthly(index) {
				return incomeIn(index).ni;
			},
		},
		cash: {
			label: 'Cash',
			icon: 'bi-bank',
			tone: 4,
			monthly(index) {
				return balances(index).cash;
			},
		},
	};
	const pinned = [
		{
			id: 'deferred',
			name: 'Billed, not yet earned',
			desc: 'What was billed and earned each month of the quarter',
			icon: 'bi-hourglass-split',
			tone: 2,
			owner: 'hk',
			schedule: 'Monthly, after close',
			run: 'Oct 6',
			page: ['invoices.html', 'Open invoices'],
			draw() {
				const quarter = [18, 19, 20];
				const opening = balances(17).def;
				const closing = balances(20).def;
				const rows = quarter
					.map((index) => {
						const earned = incomeIn(index).sub;
						const billed = earned + balances(index).def - balances(index - 1).def;
						return `<tr><th scope="row">${calendar(index).brief}</th>${amountCell(dollars(billed))}${amountCell(dollars(earned))}${amountCell(dollars(balances(index).def), 'fr-strong')}</tr>`;
					})
					.join('');
				return `<p class="fr-dlede">Billed but not yet earned went from ${dollars(opening)} on ${calendar(17).closing} to ${dollars(closing)} on ${calendar(20).closing}.</p>${drawerSection('Q3 2026', `<table class="table fr-table fr-table-mini"><thead><tr><th scope="col">Month</th><th scope="col" class="fr-num">Billed</th><th scope="col" class="fr-num">Earned</th><th scope="col" class="fr-num">Left</th></tr></thead><tbody>${rows}</tbody></table>`)}`;
			},
		},
		{
			id: 'addons',
			name: 'Add-on margin by product',
			desc: 'One-off sales and the margin made on each add-on',
			icon: 'bi-puzzle',
			tone: 1,
			owner: 'ja',
			schedule: 'Monthly, after close',
			run: 'Oct 6',
			page: ['income.html', 'Open income'],
			draw() {
				const byRevenue = [...ADD_ONS]
					.sort((a, b) => b.revenue - a.revenue)
					.map((product) => ({
						label: product.name,
						value: product.revenue,
						note: `${product.units} sold, ${percent(product.margin, 0)} margin`,
					}));
				return `<p class="fr-dlede">Accounts bought ${dollars(ADD_ON_SALES)} of add-ons in September 2026 at a ${percent(1 - ADD_ON_COST / ADD_ON_SALES)} margin.</p>${drawerSection('September 2026', barList(byRevenue, 1))}`;
			},
		},
		{
			id: 'plans',
			name: PLAN_REPORT.name,
			desc: PLAN_REPORT.summary,
			icon: 'bi-layers',
			tone: 3,
			owner: PLAN_REPORT.owner,
			schedule: 'Not scheduled',
			run: `${MONTHS_LONG[Number(PLAN_REPORT.updated.slice(5, 7)) - 1].slice(0, 3)} ${Number(PLAN_REPORT.updated.slice(8, 10))}`,
			full: `report-details.html?id=${encodeURIComponent(PLAN_REPORT.id)}`,
			draw() {
				return `<p class="fr-dlede">Subscriptions brought in ${dollars(incomeIn(NEWEST_CLOSED).sub)} in September 2026; Pro and Max each bring about two fifths.</p>${drawerSection('September 2026', barList(otherBreakdown('sub').items(), 3))}`;
			},
		},
		{
			id: 'hosting',
			name: 'Hosting cost by month',
			desc: 'Cloud and infrastructure bills over the last six months',
			icon: 'bi-cloud',
			tone: 4,
			owner: 'ja',
			schedule: 'Weekly, Monday',
			run: 'Oct 5',
			page: ['expenses.html', 'Open expenses'],
			draw() {
				const latest = incomeIn(NEWEST_CLOSED);
				return `<p class="fr-dlede">Hosting cost ${dollars(latest.host)} in September 2026, ${percent(latest.host / latest.rev)} of revenue.</p>${drawerSection(
					'Last six months',
					barList(
						sixMonthsTo(NEWEST_CLOSED).map((index) => ({
							label: calendar(index).brief,
							value: incomeIn(index).host,
						})),
						4,
					),
				)}`;
			},
		},
	];

	/* What the reader has chosen, and the nodes the painters write into. */
	const chosen = { report: 'pnl', period: 'm20', compare: 'prev', view: 'summary' };
	let ui = null;
	let repaintDrawer = null;
	let madeCount = 0;

	/**
	 * Collects the page's nodes, wires every control, then draws the glance
	 * cards, the first report and the saved list.
	 */
	function start() {
		ui = collectNodes();
		wireControls();
		wireDrawer();
		wirePinned();
		wireBuilder();

		limitCompare();
		drawGlance();
		drawReport();
		drawPinned();
	}

	function pick(selector, scope = pageRoot) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = pageRoot) {
		return [...scope.querySelectorAll(selector)];
	}

	function collectNodes() {
		const drawerNode = document.getElementById('fr-drawer');
		const builderNode = document.getElementById('fr-builder');
		return {
			title: pick('[data-fr-title]'),
			lede: pick('[data-fr-lede]'),
			body: pick('[data-fr-body]'),
			foot: pick('[data-fr-foot]'),
			period: pick('[data-fr-period]'),
			compare: pick('[data-fr-compare]'),
			toolbar: pick('[data-fr-toolbar]'),
			compareField: pick('[data-fr-field="compare"]'),
			viewField: pick('[data-fr-field="view"]'),
			asOf: pick('[data-fr-asof]'),
			keptSub: pick('[data-fr-kept-sub]'),
			keptCents: pick('[data-fr-kept-cents]'),
			split: pick('[data-fr-split]'),
			splitLegend: pick('[data-fr-split-legend]'),
			trendSub: pick('[data-fr-trend-sub]'),
			columns: pick('[data-fr-cols]'),
			pinnedList: pick('[data-fr-saved]'),
			pinnedEmpty: pick('[data-fr-saved-empty]'),
			pinnedCount: pick('[data-fr-saved-count]'),
			drawerNode,
			drawerTitle: pick('[data-fr-drawer-title]', drawerNode),
			drawerSub: pick('[data-fr-drawer-sub]', drawerNode),
			drawerBody: pick('[data-fr-drawer-body]', drawerNode),
			drawerFoot: pick('[data-fr-drawer-foot]', drawerNode),
			drawerFull: pick('[data-fr-drawer-full]', drawerNode),
			builderNode,
			builderForm: pick('[data-fr-builder]', builderNode),
			nameField: pick('[data-fr-b-name]', builderNode),
			previewBox: pick('[data-fr-b-preview]', builderNode),
			byLineOption: pick('#fr-split-line', builderNode),
			byMonthOption: pick('#fr-split-month', builderNode),
			splitNote: pick('[data-fr-b-hint]', builderNode),
			emailSwitch: pick('[data-fr-b-email]', builderNode),
		};
	}

	function htmlSafe(value) {
		return `${value ?? ''}`.replace(/[&<>"']/g, (mark) => ESCAPES[mark]);
	}

	function notify(message) {
		return window.Basalt.toasts?.push(message) ?? null;
	}

	function syncSelect(field) {
		window.Basalt.select?.refresh?.(field);
	}

	function sequence(from, to) {
		return Array.from({ length: Math.max(0, to - from + 1) }, (nothing, offset) => from + offset);
	}

	/* Money and percentages, always in whole dollars with a true minus sign. */
	function dollars(amount) {
		return `${amount < 0 ? DASH : ''}$${wholeNumber.format(Math.abs(Math.round(amount)))}`;
	}

	function signedDollars(amount) {
		const sign = amount > 0 ? '+' : amount < 0 ? DASH : '';
		return `${sign}$${wholeNumber.format(Math.abs(Math.round(amount)))}`;
	}

	function compactDollars(amount) {
		const magnitude = Math.abs(amount);
		const sign = amount < 0 ? DASH : '';
		if (magnitude >= 1e6) return `${sign}$${(magnitude / 1e6).toFixed(2)}M`;
		if (magnitude >= 1e3) return `${sign}$${(magnitude / 1e3).toFixed(1)}k`;
		return `${sign}$${wholeNumber.format(magnitude)}`;
	}

	function percent(ratio, places = 1) {
		return `${(ratio * 100).toFixed(places)}%`;
	}

	/* Calendar helpers: one month index becomes every spelling the page needs. */
	function calendar(index) {
		const calendarYear = 2025 + Math.floor(index / 12);
		const monthOfYear = ((index % 12) + 12) % 12;
		const abbr = MONTHS_LONG[monthOfYear].slice(0, 3);
		return {
			year: calendarYear,
			monthOfYear,
			abbr,
			full: `${MONTHS_LONG[monthOfYear]} ${calendarYear}`,
			brief: `${abbr} ${calendarYear}`,
			closing: `${DAYS_IN_MONTH[monthOfYear]} ${abbr} ${calendarYear}`,
		};
	}

	function sixMonthsTo(index) {
		return sequence(index - 5, index);
	}

	function spanLabel(months, spelledOut) {
		const fromMonth = calendar(months[0]);
		const toMonth = calendar(months.at(-1));
		if (months.length === 1) return spelledOut ? fromMonth.full : fromMonth.brief;
		if (months.length === 3 && fromMonth.monthOfYear % 3 === 0)
			return `Q${fromMonth.monthOfYear / 3 + 1} ${fromMonth.year}`;
		return `${fromMonth.abbr}–${toMonth.abbr} ${toMonth.year}`;
	}

	function comparedMonths(period, mode) {
		if (mode === 'none') return null;
		const monthsBack = mode === 'yoy' ? 12 : period.months.length;
		return period.months.map((index) => index - monthsBack);
	}

	/* The model: a line's value in any month, then the three statements. */
	function projected(key, index) {
		const [anchor, growth, swing] = LEDGER_LINES[key];
		const phase = LINE_KEYS.indexOf(key);

		function wave(at) {
			return swing * Math.sin(1.9 * at + 2.3 * phase);
		}

		return Math.round(
			(anchor * Math.pow(1 + growth, index - NEWEST_CLOSED) * (1 + wave(index))) / (1 + wave(NEWEST_CLOSED)),
		);
	}

	function incomeIn(index) {
		if (incomeMemo.has(index)) return incomeMemo.get(index);
		const figures = Object.fromEntries(LINE_KEYS.map((key) => [key, projected(key, index)]));
		figures.addc = Math.round((figures.add * ADD_ON_COST) / ADD_ON_SALES);
		figures.rev = figures.sub + figures.svc + figures.add - figures.ref;
		figures.cor = figures.host + figures.pay + figures.addc + figures.sup;
		figures.gp = figures.rev - figures.cor;
		figures.opex = figures.eng + figures.sales + figures.mkt + figures.ga + figures.office;
		figures.op = figures.gp - figures.opex;
		figures.pbt = figures.op - figures.da + figures.int;
		figures.tax = Math.round(figures.pbt * TAX_RATE);
		figures.ni = figures.pbt - figures.tax;
		figures.capex = index % 3 === 0 ? 12400 : 3100;
		incomeMemo.set(index, figures);
		return figures;
	}

	function incomeAcross(months) {
		const sum = {};
		for (const index of months) {
			for (const [key, value] of Object.entries(incomeIn(index))) sum[key] = (sum[key] || 0) + value;
		}
		return sum;
	}

	/** Balances at the end of a month; cash is the figure that makes them balance. */
	function balances(index) {
		if (balanceMemo.has(index)) return balanceMemo.get(index);
		const thisMonth = incomeIn(index);
		const sheet = {};
		sheet.ar = Math.round(thisMonth.rev * 0.4);
		sheet.inv = Math.round(thisMonth.addc * 1.6);
		sheet.pre = Math.round(41000 * Math.pow(1.008, index - NEWEST_CLOSED));
		sheet.equip = index < 0 ? 98000 : balances(index - 1).equip + thisMonth.capex - thisMonth.da;
		sheet.ap = Math.round((thisMonth.cor + thisMonth.ga) * 0.42);
		sheet.accr = Math.round((thisMonth.eng + thisMonth.sales + thisMonth.sup) * 0.35);
		sheet.stax = Math.round(thisMonth.rev * 0.025);
		sheet.def = Math.round(thisMonth.sub * 0.58);
		sheet.loan = 210000 - 5000 * (index + 1);
		sheet.cap = PAID_IN_CAPITAL;
		sheet.re = index < 0 ? OPENING_RETAINED : balances(index - 1).re + thisMonth.ni;
		sheet.liab = sheet.ap + sheet.accr + sheet.stax + sheet.def + sheet.loan;
		sheet.eq = sheet.cap + sheet.re;
		sheet.cash = sheet.liab + sheet.eq - (sheet.ar + sheet.inv + sheet.pre + sheet.equip);
		sheet.assets = sheet.cash + sheet.ar + sheet.inv + sheet.pre + sheet.equip;
		sheet.le = sheet.liab + sheet.eq;
		balanceMemo.set(index, sheet);
		return sheet;
	}

	/** Cash movements across a run of months, read off the balances at each end. */
	function cashMoves(months) {
		const atStart = balances(months[0] - 1);
		const atEnd = balances(months.at(-1));
		const earned = incomeAcross(months);
		const moves = {
			ni: earned.ni,
			da: earned.da,
			ar: -(atEnd.ar - atStart.ar),
			inv: -(atEnd.inv - atStart.inv),
			pre: -(atEnd.pre - atStart.pre),
			ap: atEnd.ap - atStart.ap,
			accr: atEnd.accr - atStart.accr,
			stax: atEnd.stax - atStart.stax,
			def: atEnd.def - atStart.def,
			capex: -earned.capex,
			loan: atEnd.loan - atStart.loan,
			open: atStart.cash,
			close: atEnd.cash,
		};
		moves.ops =
			moves.ni + moves.da + moves.ar + moves.inv + moves.pre + moves.ap + moves.accr + moves.stax + moves.def;
		moves.invest = moves.capex;
		moves.fin = moves.loan;
		moves.net = moves.ops + moves.invest + moves.fin;
		return moves;
	}

	function budgetFor(key, index) {
		const trendValue =
			key === 'addc'
				? ((LEDGER_LINES.add[0] * ADD_ON_COST) / ADD_ON_SALES) *
					Math.pow(1 + LEDGER_LINES.add[1], index - NEWEST_CLOSED)
				: LEDGER_LINES[key][0] * Math.pow(1 + LEDGER_LINES[key][1], index - NEWEST_CLOSED);
		return Math.round((trendValue * BUDGET_FACTOR[key]) / 100) * 100;
	}

	/* Aged balances: open docs sorted into not due, 1 to 30, 31 to 60 and over 60 days. */
	function ageBucket(daysLate) {
		return daysLate <= 0 ? 0 : daysLate <= 30 ? 1 : daysLate <= 60 ? 2 : 3;
	}

	function utcDay(isoDate) {
		const [year, month, day] = isoDate.split('-').map(Number);
		return Date.UTC(year, month - 1, day);
	}

	function dueText(isoDate) {
		return `${MONTHS_LONG[Number(isoDate.slice(5, 7)) - 1].slice(0, 3)} ${Number(isoDate.slice(8, 10))}`;
	}

	function receivablesByCustomer(shown) {
		const byAccount = {};
		for (const invoice of INVOICING.invoices().filter((entry) => entry.state === 'sent')) {
			const account = CUSTOMER_BOOK.find(invoice.acct);
			byAccount[invoice.acct] ??= {
				name: invoice.customer,
				id: invoice.acct,
				note: account ? `${CUSTOMER_BOOK.plans[account.plan].name}, ${account.seats} seats` : 'Customer',
				docs: [],
			};
			byAccount[invoice.acct].docs.push([
				invoice.no,
				invoice.item,
				invoice.amount,
				dueText(invoice.due),
				Math.round((utcDay(INVOICING.today) - utcDay(invoice.due)) / 864e5),
			]);
		}

		function owed(party) {
			return party.docs.reduce((sum, doc) => sum + doc[2], 0);
		}

		const ranked = Object.values(byAccount).sort((a, b) => owed(b) - owed(a));
		const aged = [0, 0, 0, 0];
		for (const party of ranked.slice(shown)) {
			for (const doc of party.docs) aged[ageBucket(doc[4])] += doc[2];
		}
		return { rows: ranked.slice(0, shown), others: { count: ranked.length - shown, buckets: aged } };
	}

	function agedParties(kind) {
		return AGED[kind]
			.map((party) => {
				const aged = [0, 0, 0, 0];
				for (const doc of party.docs) aged[ageBucket(doc[4])] += doc[2];
				return {
					...party,
					buckets: aged,
					total: aged[0] + aged[1] + aged[2] + aged[3],
					overdue: aged[1] + aged[2] + aged[3],
				};
			})
			.sort((a, b) => b.total - a.total);
	}

	/* Bits of markup every table shares. */
	function delta(current, previous, better) {
		if (previous == null) return { amount: '', rate: '', cls: '' };
		const difference = current - previous;
		if (difference === 0) return { amount: '$0', rate: '0.0%', cls: '' };
		const improved = better === 'down' ? difference < 0 : difference > 0;
		const rateText =
			previous === 0 ? '–' : `${difference > 0 ? '+' : DASH}${percent(Math.abs(difference / previous))}`;
		return { amount: signedDollars(difference), rate: rateText, cls: improved ? 'fr-up' : 'fr-down' };
	}

	function amountCell(text, extraClass) {
		return `<td class="fr-num${extraClass ? ` ${extraClass}` : ''}">${text}</td>`;
	}

	function rampDot(tone) {
		return `<span class="fr-dot" style="--fr-tone:${RAMP[tone]}" aria-hidden="true"></span>`;
	}

	function lineButton(key, tone, label) {
		return `<button type="button" class="fr-line" data-fr-line="${key}" data-fr-tone="${tone}"><span>${htmlSafe(label)}</span><i class="bi bi-chevron-right" aria-hidden="true"></i></button>`;
	}

	function sectionRow(tone, name, columns) {
		return `<tr class="fr-row-head"><th scope="rowgroup" colspan="${columns}">${rampDot(tone)}${htmlSafe(name)}</th></tr>`;
	}

	function reportTable(classes, caption, headCells, bodyRows) {
		return `<table class="table fr-table ${classes}"><caption class="visually-hidden">${caption}</caption><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
	}

	/* The three statements share one painter: current period, the compared
     period when there is one, and the change between them. */
	function rowClasses(row) {
		if (row.grand) return 'fr-row-total';
		if (row.subtotal)
			return `fr-row-sub${row.bold ? ' fr-row-sub-strong' : ''}${row.faint ? ' fr-row-sub-quiet' : ''}`;
		return 'fr-row-line';
	}

	function drawStatement(entry) {
		const period = PERIOD_OPTIONS[chosen.period];
		const against = comparedMonths(period, chosen.compare);
		const thisSpan = FIGURES_FOR[chosen.report](period.months);
		const lastSpan = against ? FIGURES_FOR[chosen.report](against) : null;
		const currentLabel = entry.snapshot ? calendar(period.months.at(-1)).closing : spanLabel(period.months);
		const previousLabel = !against ? '' : entry.snapshot ? calendar(against.at(-1)).closing : spanLabel(against);
		const summaryOnly = chosen.view === 'summary';
		let tone = 1;

		const bodyRows = entry.rows
			.map((row) => {
				if (row.section) {
					tone = row.tone;
					return summaryOnly ? '' : sectionRow(row.tone, row.section, lastSpan ? 5 : 2);
				}
				if (row.id && summaryOnly) return '';
				const key = row.id || row.subtotal || row.grand;
				const sign = row.flip ? -1 : 1;
				const thisValue = thisSpan[key] * sign;
				const lastValue = lastSpan ? lastSpan[key] * sign : null;
				const better = row.flip ? (row.better === 'down' ? 'up' : 'down') : row.better;
				const movement = delta(thisValue, lastValue, better);
				const firstCell = row.id ? lineButton(key, tone, row.label) : htmlSafe(row.label);
				const compareCells = lastSpan
					? amountCell(dollars(lastValue), 'fr-col-cmp fr-muted') +
						amountCell(movement.amount, movement.cls) +
						amountCell(movement.rate, `fr-col-pct ${movement.cls}`)
					: '';
				return `<tr class="${rowClasses(row)}"><th scope="row">${firstCell}</th>${amountCell(dollars(thisValue))}${compareCells}</tr>`;
			})
			.join('');

		const compareHead = lastSpan
			? `<th scope="col" class="fr-num fr-col-cmp">${htmlSafe(previousLabel)}</th><th scope="col" class="fr-num">Change</th><th scope="col" class="fr-num fr-col-pct">%</th>`
			: '';
		ui.body.innerHTML = reportTable(
			`fr-table-statement${lastSpan ? '' : ' fr-table-single'}`,
			`${htmlSafe(entry.title)}, ${htmlSafe(currentLabel)}${lastSpan ? ` compared with ${htmlSafe(previousLabel)}` : ''}`,
			`<th scope="col">${htmlSafe(entry.firstColumn)}</th><th scope="col" class="fr-num">${htmlSafe(currentLabel)}</th>${compareHead}`,
			bodyRows,
		);
		ui.lede.textContent = statementSummary(thisSpan, lastSpan, against);
	}

	function statementSummary(thisSpan, lastSpan, against) {
		const period = PERIOD_OPTIONS[chosen.period];

		function versus(thisValue, lastValue) {
			if (lastValue == null) return '';
			const ratio = (thisValue - lastValue) / Math.abs(lastValue);
			return `, ${ratio >= 0 ? 'up ' : 'down '}${percent(Math.abs(ratio))} on ${spanLabel(against, true)}`;
		}

		if (chosen.report === 'pnl') {
			return `Net income was ${dollars(thisSpan.ni)}, ${percent(thisSpan.ni / thisSpan.rev)} of revenue${versus(thisSpan.ni, lastSpan?.ni)}.`;
		}
		if (chosen.report === 'balance') {
			return `Fieldline held ${compactDollars(thisSpan.cash)} in cash on ${calendar(period.months.at(-1)).closing}, and owed ${compactDollars(thisSpan.liab)} in all, ${compactDollars(thisSpan.def)} of it billed but not yet earned.`;
		}
		const stretch = { month: 'the month', quarter: 'the quarter', ytd: 'the year so far' }[period.kind];
		return `Operations brought in ${dollars(thisSpan.ops)}, and cash ended ${stretch} at ${compactDollars(thisSpan.close)}.`;
	}

	/* Budget against actual: each cost line with a meter of its budget used. */
	function budgetLine(label, outlay, planned, key, tone, rowClass = 'fr-row-line') {
		const share = outlay / planned;
		const over = share > 1;
		const firstCell = key ? lineButton(key, tone, label) : htmlSafe(label);
		const usageCell = `<td class="fr-used${over ? ' is-over' : ''}"><span class="fr-used-bar" aria-hidden="true"><span style="width:${Math.min(100, share * 100).toFixed(1)}%"></span></span><span class="fr-used-pct">${percent(share, 0)}</span></td>`;
		return `<tr class="${rowClass}"><th scope="row">${firstCell}</th>${amountCell(dollars(outlay))}${amountCell(dollars(planned), 'fr-col-cmp fr-muted')}${amountCell(dollars(planned - outlay), `fr-col-pct ${over ? 'fr-down' : ''}`)}${usageCell}</tr>`;
	}

	function drawBudget() {
		const period = PERIOD_OPTIONS[chosen.period];
		const actual = incomeAcross(period.months);
		let spentAll = 0;
		let plannedAll = 0;
		const groupMarkup = COST_GROUPS.map((group) => {
			let spentGroup = 0;
			let plannedGroup = 0;
			const lineMarkup = group.keys
				.map((key) => {
					const outlay = actual[key];
					const planned = period.months.reduce((sum, index) => sum + budgetFor(key, index), 0);
					spentGroup += outlay;
					plannedGroup += planned;
					return budgetLine(LINE_LABEL[key], outlay, planned, key, group.tone);
				})
				.join('');
			spentAll += spentGroup;
			plannedAll += plannedGroup;
			return `${sectionRow(group.tone, group.section, 5)}${lineMarkup}${budgetLine(`Total ${group.section.toLowerCase()}`, spentGroup, plannedGroup, null, 0, 'fr-row-sub')}`;
		}).join('');

		ui.body.innerHTML = reportTable(
			'fr-table-budget',
			`Costs against the 2026 budget, ${htmlSafe(period.label)}`,
			'<th scope="col">Cost</th><th scope="col" class="fr-num">Spent</th><th scope="col" class="fr-num fr-col-cmp">Budget</th><th scope="col" class="fr-num fr-col-pct">Left</th><th scope="col" class="fr-used-head">Used</th>',
			groupMarkup + budgetLine('All costs', spentAll, plannedAll, null, 0, 'fr-row-total'),
		);
		const headroom = plannedAll - spentAll;
		ui.lede.textContent = `Costs came to ${dollars(spentAll)}, ${headroom >= 0 ? `${dollars(headroom)} under` : `${dollars(-headroom)} over`} a budget of ${dollars(plannedAll)} (${percent(spentAll / plannedAll, 0)} share).`;
	}

	/* Owed by customers and owed to suppliers: one row per party, aged. */
	function agedCells(buckets, grandTotal) {
		const pastDue = buckets[1] + buckets[2] + buckets[3];
		const perBucket = buckets
			.map((value, slot) => {
				const column = slot ? 'fr-col-bucket' : 'fr-col-notdue';
				const tone = `${slot === 3 && value ? ' fr-down' : ''}${slot && slot < 3 && value ? ' fr-warn' : ''}`;
				return amountCell(value ? dollars(value) : NIL_CELL, column + tone);
			})
			.join('');
		const overdueTone = buckets[3] ? ' fr-down' : buckets[1] + buckets[2] ? ' fr-warn' : '';
		return (
			perBucket +
			amountCell(pastDue ? dollars(pastDue) : NIL_CELL, `fr-col-overdue${overdueTone}`) +
			amountCell(dollars(grandTotal), 'fr-strong')
		);
	}

	function partyRow(party, position) {
		return `<tr class="fr-row-line"><th scope="row"><button type="button" class="fr-line fr-line-who" data-fr-party="${position}"><span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(party.name)}" aria-hidden="true"></span><span class="fr-who"><span class="fr-who-name">${htmlSafe(party.name)}</span><span class="fr-who-note">${htmlSafe(party.note)}</span></span><i class="bi bi-chevron-right" aria-hidden="true"></i></button></th>${agedCells(party.buckets, party.total)}</tr>`;
	}

	function drawAged() {
		const ledgerSide = chosen.report;
		const parties = agedParties(ledgerSide);
		const rest = AGED[`${ledgerSide}Others`];
		const sums = [0, 0, 0, 0];
		for (const party of [...parties, rest]) {
			for (const [slot, value] of party.buckets.entries()) sums[slot] += value;
		}
		const grandTotal = sums.reduce((sum, value) => sum + value, 0);
		const pastDue = sums[1] + sums[2] + sums[3];
		const restTotal = rest.buckets.reduce((sum, value) => sum + value, 0);
		const restRow = `<tr class="fr-row-line fr-row-others"><th scope="row"><span class="fr-who fr-who-others"><span class="fr-who-name">${rest.count} other ${ledgerSide === 'ar' ? 'customers' : 'suppliers'}</span><span class="fr-who-note">Smaller balances, in the full export</span></span></th>${agedCells(rest.buckets, restTotal)}</tr>`;
		const totalRow = `<tr class="fr-row-total"><th scope="row">Total</th>${agedCells(sums, grandTotal)}</tr>`;

		ui.body.innerHTML = reportTable(
			'fr-table-aging',
			`${htmlSafe(CATALOG[ledgerSide].title)} by how long it is overdue, as at ${AS_AT}`,
			`<th scope="col">${CATALOG[ledgerSide].party}</th><th scope="col" class="fr-num fr-col-notdue">Not due</th><th scope="col" class="fr-num fr-col-bucket">1–30 days</th><th scope="col" class="fr-num fr-col-bucket">31–60 days</th><th scope="col" class="fr-num fr-col-bucket">Over 60</th><th scope="col" class="fr-num fr-col-overdue">Overdue</th><th scope="col" class="fr-num">Total</th>`,
			parties.map(partyRow).join('') + restRow + totalRow,
		);
		window.Basalt.avatars?.(ui.body);
		ui.lede.textContent =
			ledgerSide === 'ar'
				? `Customers owe ${dollars(grandTotal)}; ${dollars(pastDue)} of it is past its due date.`
				: `Fieldline owes suppliers ${dollars(grandTotal)}; ${dollars(pastDue)} of it is past its due date.`;
	}

	/* The trial balance: every account with its year-to-date debit or credit. */
	function drawTrialBalance() {
		const end = PERIOD_OPTIONS[chosen.period].months.at(-1);
		const fiscalYear = calendar(end).year;
		const yearStart = (fiscalYear - 2025) * 12;
		const earned = incomeAcross(sequence(yearStart, end));
		const sheet = balances(end);
		const openingRetained = balances(yearStart - 1).re;
		const ledger = [
			[
				'Assets',
				[
					['1000', 'Cash', sheet.cash],
					['1100', 'Owed by customers', sheet.ar],
					['1200', 'Prepaid SMS credit', sheet.inv],
					['1300', 'Paid in advance', sheet.pre],
					['1500', 'Equipment, after depreciation', sheet.equip],
				],
			],
			[
				'Liabilities',
				[
					['2000', 'Owed to suppliers', -sheet.ap],
					['2100', 'Salaries owed', -sheet.accr],
					['2200', 'Sales tax to pay', -sheet.stax],
					['2300', 'Billed, not yet earned', -sheet.def],
					['2500', 'Equipment loan', -sheet.loan],
				],
			],
			[
				'Equity',
				[
					['3000', 'Share capital', -sheet.cap],
					['3100', 'Retained earnings, Jan 1', -openingRetained],
				],
			],
			[
				'Revenue',
				[
					['4000', 'Subscriptions', -earned.sub],
					['4100', 'Onboarding and training', -earned.svc],
					['4200', 'Add-ons and set-up work', -earned.add],
					['4900', 'Refunds and credits', earned.ref],
				],
			],
			[
				'Costs',
				[
					['5000', 'Hosting and infrastructure', earned.host],
					['5100', 'Payment processing', earned.pay],
					['5200', 'Add-on costs', earned.addc],
					['5300', 'Customer support', earned.sup],
					['6000', 'Product and engineering', earned.eng],
					['6100', 'Sales', earned.sales],
					['6200', 'Marketing', earned.mkt],
					['6300', 'General and admin', earned.ga],
					['6400', 'Office and facilities', earned.office],
					['7000', 'Depreciation and amortization', earned.da],
					['7100', 'Interest income', -earned.int],
					['8000', 'Income tax', earned.tax],
				],
			],
		];
		let debits = 0;
		let credits = 0;
		const trialRows = [];
		for (const [position, [groupName, accounts]] of ledger.entries()) {
			trialRows.push(sectionRow((position % 4) + 1, groupName, 4));
			for (const [code, account, amount] of accounts) {
				if (amount >= 0) debits += amount;
				else credits -= amount;
				trialRows.push(
					`<tr class="fr-row-line"><td class="fr-code">${code}</td><th scope="row">${htmlSafe(account)}</th>${amountCell(amount >= 0 ? dollars(amount) : NIL_CELL)}${amountCell(amount < 0 ? dollars(-amount) : NIL_CELL)}</tr>`,
				);
			}
		}
		trialRows.push(
			`<tr class="fr-row-total"><td class="fr-code"></td><th scope="row">Totals</th>${amountCell(dollars(debits))}${amountCell(dollars(credits))}</tr>`,
		);

		ui.body.innerHTML = reportTable(
			'fr-table-trial',
			`Trial balance as at ${calendar(end).closing}`,
			'<th scope="col" class="fr-code">Code</th><th scope="col">Account</th><th scope="col" class="fr-num">Debit</th><th scope="col" class="fr-num">Credit</th>',
			trialRows.join(''),
		);
		ui.lede.textContent =
			debits === credits
				? `Debits and credits both come to ${dollars(debits)} on ${calendar(end).closing}, so the books balance.`
				: `Debits and credits differ by ${dollars(Math.abs(debits - credits))}. Check the latest journal entries.`;
	}

	/* The card around whichever report is chosen: title, toolbar, table, footnote. */
	function drawReport() {
		const entry = CATALOG[chosen.report];
		const period = PERIOD_OPTIONS[chosen.period];
		ui.title.textContent = entry.title;
		ui.toolbar.hidden = !(entry.statement || entry.aging);
		ui.compareField.hidden = !entry.statement;
		ui.viewField.hidden = !entry.statement;
		ui.asOf.hidden = !entry.aging;
		entry.draw(entry);

		const end = period.months.at(-1);
		const bookNote =
			period.kind === 'month' ? `Books for ${calendar(end).full}` : `Books through ${calendar(end).full}`;
		ui.foot.textContent = entry.aging
			? `Open ${chosen.report === 'ar' ? 'invoices' : 'bills'} as at ${AS_AT}, straight from the ledger. Amounts in US dollars.`
			: `${bookNote} closed on ${BOOKS_CLOSED[end]} by John Armstrong. Amounts in US dollars.`;
	}

	/* The glance cards: where each dollar of revenue went, in whole cents
     that add to 100, and net income over the six months to the period's end. */
	function drawGlance() {
		const period = PERIOD_OPTIONS[chosen.period];
		const earned = incomeAcross(period.months);
		const keptCents = Math.round((earned.ni / earned.rev) * 100);
		const deliveryCents = Math.round((earned.cor / earned.rev) * 100);
		const shares = [
			{
				label: 'Delivering the service',
				note: 'Hosting, payments, add-ons and support',
				cents: deliveryCents,
				value: earned.cor,
				tone: 2,
			},
			{
				label: 'Running the business',
				note: 'Teams, offices, depreciation and tax',
				cents: 100 - keptCents - deliveryCents,
				value: earned.rev - earned.cor - earned.ni,
				tone: 4,
			},
			{
				label: 'Kept as net income',
				note: `${percent(earned.ni / earned.rev)} net margin`,
				cents: keptCents,
				value: earned.ni,
				tone: 3,
			},
		];
		ui.keptSub.textContent = `Revenue of ${dollars(earned.rev)} in ${period.label}, and where it went.`;
		ui.keptCents.textContent = `${keptCents}¢`;
		ui.split.setAttribute('aria-label', shares.map((share) => `${share.label}, ${share.cents} cents`).join('; '));
		ui.split.innerHTML = shares
			.map(
				(share) =>
					`<span class="fr-split-part" style="--fr-tone:${RAMP[share.tone]};flex-grow:${share.cents}"></span>`,
			)
			.join('');
		ui.splitLegend.innerHTML = shares
			.map(
				(share) =>
					`<li class="fr-split-item" style="--fr-tone:${RAMP[share.tone]}"><span class="fr-dot" aria-hidden="true"></span><span class="fr-split-text"><span class="fr-split-label">${htmlSafe(share.label)}</span><span class="fr-split-note">${htmlSafe(share.note)}</span></span><span class="fr-split-cents">${share.cents}¢</span><span class="fr-split-value">${compactDollars(share.value)}</span></li>`,
			)
			.join('');

		const end = period.months.at(-1);
		const recentSix = sixMonthsTo(end);
		const netIncomes = recentSix.map((index) => incomeIn(index).ni);
		const peak = Math.max(...netIncomes);
		const priorMonth = incomeIn(recentSix[4]).ni;
		const ratio = (netIncomes[5] - priorMonth) / priorMonth;
		ui.trendSub.textContent = `${dollars(netIncomes[5])} in ${calendar(end).full}, ${ratio >= 0 ? 'up ' : 'down '}${percent(Math.abs(ratio))} on ${calendar(recentSix[4]).full}.`;
		ui.columns.innerHTML = recentSix
			.map(
				(index, slot) =>
					`<li class="fr-cols-col${period.months.includes(index) ? ' is-on' : ''}"><span class="fr-cols-value">$${Math.round(netIncomes[slot] / 1000)}k</span><span class="fr-cols-track" aria-hidden="true"><span class="fr-cols-bar" style="height:${((netIncomes[slot] / peak) * 100).toFixed(1)}%"></span></span><span class="fr-cols-month">${calendar(index).abbr}</span></li>`,
			)
			.join('');
	}

	/* A year to date has no "previous period" of the same length worth
     reading, so that option goes away while a year is chosen. */
	function limitCompare() {
		const yearToDate = PERIOD_OPTIONS[chosen.period].kind === 'ytd';
		const previousOption = pick('option[value="prev"]', ui.compare);
		previousOption.hidden = yearToDate;
		previousOption.disabled = yearToDate;
		if (yearToDate && chosen.compare === 'prev') {
			chosen.compare = 'yoy';
			ui.compare.value = 'yoy';
		}
		syncSelect(ui.compare);
	}

	function wireControls() {
		for (const radio of pickAll('[data-fr-report]')) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				chosen.report = radio.value;
				drawReport();
			});
		}
		ui.period.addEventListener('change', () => {
			chosen.period = ui.period.value;
			limitCompare();
			drawGlance();
			drawReport();
		});
		ui.compare.addEventListener('change', () => {
			chosen.compare = ui.compare.value;
			drawReport();
		});
		for (const radio of pickAll('input[name="frView"]')) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				chosen.view = radio.value;
				drawReport();
			});
		}
		for (const button of pickAll('[data-fr-export]')) {
			button.addEventListener('click', () => {
				const entry = CATALOG[chosen.report];
				const when = entry.aging ? `as at ${AS_AT}` : PERIOD_OPTIONS[chosen.period].label;
				notify({
					tone: 'success',
					title: `${entry.title} exported`,
					text: `${when}, ${button.getAttribute('data-fr-export')}.`,
					duration: 4000,
				});
			});
		}
	}

	/* The drawer: one line of a statement, one customer or supplier, or one
     saved report. `fill` paints its body and is kept so a switch inside
     the drawer can paint it again. */
	function drawerApi() {
		return bootstrap.Offcanvas.getOrCreateInstance(ui.drawerNode);
	}

	function showDrawer(title, subtitle, fill, fullPage) {
		ui.drawerTitle.textContent = title;
		ui.drawerSub.textContent = subtitle;
		ui.drawerFull.hidden = !fullPage;
		if (fullPage) ui.drawerFull.href = fullPage;
		repaintDrawer = fill;
		fill();
		drawerApi().show();
	}

	function setDrawerFoot(html) {
		ui.drawerFoot.innerHTML = html;
	}

	function drawerSection(heading, html) {
		return `<section class="fr-dsec"><h3 class="fr-dsec-title">${htmlSafe(heading)}</h3>${html}</section>`;
	}

	/** Name, bar and value per item, bars scaled to the largest. */
	function barList(items, tone) {
		const widest = Math.max(...items.map((item) => Math.abs(item.value))) || 1;
		const barRows = items
			.map((item) => {
				const note = item.note ? `<span class="fr-bars-note">${htmlSafe(item.note)}</span>` : '';
				return `<li class="fr-bars-row"><span class="fr-bars-name">${htmlSafe(item.label)}</span><span class="fr-bars-track" aria-hidden="true"><span class="fr-bars-fill${item.value < 0 ? ' is-neg' : ''}" style="width:${((Math.abs(item.value) / widest) * 100).toFixed(1)}%"></span></span><span class="fr-bars-value">${item.text || dollars(item.value)}</span>${note}</li>`;
			})
			.join('');
		return `<ul class="fr-bars" style="--fr-tone:${RAMP[tone || 1]}">${barRows}</ul>`;
	}

	/* A second breakdown for the lines that have one: subscriptions by
     plan, add-ons by product. */
	function otherBreakdown(id) {
		if (id === 'sub') {
			return {
				label: 'By plan',
				note: 'September 2026',
				items() {
					const subscriptions = incomeIn(NEWEST_CLOSED).sub;
					return PLAN_WEIGHTS.map(([plan, weight], slot) => ({
						label: plan,
						value:
							slot === 2
								? subscriptions - Math.round((subscriptions * 361) / 880) * 2
								: Math.round((subscriptions * weight) / 880),
					}));
				},
			};
		}
		if (id === 'add' || id === 'addc') {
			return {
				label: 'By product',
				note: 'September 2026',
				items() {
					return [...ADD_ONS]
						.sort((a, b) => b.revenue - a.revenue)
						.map((product) =>
							id === 'add'
								? {
										label: product.name,
										value: product.revenue,
										note: `${product.units} sold, ${percent(product.margin, 0)} margin`,
									}
								: { label: product.name, value: product.cost, note: `${product.units} sold` },
						);
				},
			};
		}
		return null;
	}

	function showLine(id, tone) {
		const report = chosen.report;
		const period = PERIOD_OPTIONS[chosen.period];
		const end = period.months.at(-1);
		const rows = report === 'budget' ? INCOME_ROWS : CATALOG[report].rows;
		const row = rows.find((candidate) => candidate.id === id) || { label: LINE_LABEL[id] };
		const sign = row.flip ? -1 : 1;
		const sixMonths = sixMonthsTo(end).map((index) => ({
			label: calendar(index).brief,
			value: MONTH_FIGURE[report](id, index) * sign,
		}));
		const extra = otherBreakdown(id);
		let breakdown = 'month';

		let opening;
		if (report === 'budget') {
			const outlay = period.months.reduce((sum, index) => sum + incomeIn(index)[id], 0);
			const planned = period.months.reduce((sum, index) => sum + budgetFor(id, index), 0);
			opening = `${dollars(outlay)} outlay in ${period.label} against a budget of ${dollars(planned)}, ${percent(outlay / planned, 0)} used.`;
		} else {
			const latest = sixMonths[5].value;
			const prior = sixMonths[4].value;
			const ratio = prior ? (latest - prior) / Math.abs(prior) : 0;
			const openingLine =
				report === 'balance'
					? `${dollars(latest)} on ${calendar(end).closing}`
					: `${dollars(latest)} in ${calendar(end).full}`;
			opening =
				openingLine +
				(ratio
					? `, ${ratio > 0 ? 'up ' : 'down '}${percent(Math.abs(ratio))} on the month before.`
					: ', the same as the month before.');
		}

		showDrawer(row.label, CATALOG[report].title, () => {
			const switcher = extra
				? `<div class="fr-dswitch"><div class="basalt-segmented basalt-segmented-sm" role="radiogroup" aria-label="Break down by" data-basalt-segmented><input type="radio" class="btn-check" name="frBreak" id="fr-break-month" value="month"${breakdown === 'month' ? ' checked' : ''}><label class="basalt-segmented-option" for="fr-break-month">By month</label><input type="radio" class="btn-check" name="frBreak" id="fr-break-other" value="other"${breakdown === 'other' ? ' checked' : ''}><label class="basalt-segmented-option" for="fr-break-other">${extra.label}</label></div></div>`
				: '';
			const breakdownMarkup =
				breakdown === 'month'
					? drawerSection(
							report === 'balance' ? 'Balance at each month end' : 'Last six months',
							barList(sixMonths, tone),
						)
					: drawerSection(`${extra.label}, ${extra.note}`, barList(extra.items(), tone));
			ui.drawerBody.innerHTML = `<p class="fr-dlede">${htmlSafe(opening)}</p>${switcher}${breakdownMarkup}`;

			for (const radio of pickAll('input[name="frBreak"]', ui.drawerBody)) {
				radio.addEventListener('change', () => {
					breakdown = radio.value;
					repaintDrawer();
					pick('input[name="frBreak"]:checked', ui.drawerBody)?.focus({ preventScroll: true });
				});
			}
			window.Basalt.buttons?.(ui.drawerBody);
		});
		setDrawerFoot(
			'<button type="button" class="btn btn-outline-secondary" data-fr-dl>Download CSV</button><a class="btn btn-primary" href="transactions.html">View transactions</a>',
		);
	}

	function docRow(doc, receivable) {
		const late = doc[4] > 0;
		const dueBadge = late
			? `<span class="basalt-status basalt-status-${doc[4] > 60 ? 'danger' : 'warning'}">${doc[4]} days late</span>`
			: `<span class="basalt-status basalt-status-info">Due in ${-doc[4]} days</span>`;
		const number = receivable
			? `<a class="fr-docs-num" href="invoice-details.html?id=${encodeURIComponent(doc[0])}">${doc[0]}</a>`
			: `<span class="fr-docs-num">${doc[0]}</span>`;
		return `<li class="fr-docs-row"><div class="fr-docs-main">${number}<span class="fr-docs-what">${htmlSafe(doc[1])}, due ${htmlSafe(doc[3])}</span></div><div class="fr-docs-side"><span class="fr-docs-amount">${dollars(doc[2])}</span>${dueBadge}</div></li>`;
	}

	function showParty(position) {
		const ledgerSide = chosen.report;
		const party = agedParties(ledgerSide)[position];
		const receivable = ledgerSide === 'ar';
		const opening =
			(receivable ? `${party.name} owes ` : `Fieldline owes ${party.name} `) +
			dollars(party.total) +
			(party.overdue ? `, and ${dollars(party.overdue)} of it is overdue.` : '. Nothing is overdue yet.');
		const sortedDocs = [...party.docs].sort((a, b) => b[4] - a[4]);
		showDrawer(party.name, party.note, () => {
			const docList = `<ul class="fr-docs">${sortedDocs.map((doc) => docRow(doc, receivable)).join('')}</ul>`;
			ui.drawerBody.innerHTML = `<p class="fr-dlede">${htmlSafe(opening)}</p>${drawerSection(receivable ? 'Open invoices' : 'Open bills', docList)}`;
		});
		if (receivable) {
			const customerLink = `company-details.html${party.id ? `?id=${encodeURIComponent(party.id)}` : ''}`;
			setDrawerFoot(
				`<a class="btn btn-outline-secondary" href="${customerLink}">Open customer</a><button type="button" class="btn btn-primary" data-fr-remind>${party.overdue ? 'Send a reminder' : 'Send a statement'}</button>`,
			);
		} else {
			setDrawerFoot(
				`${party.booked ? '<a class="btn btn-outline-secondary" href="accounting.html">Open in Accounting</a>' : ''}<button type="button" class="btn btn-primary" data-fr-pay>Schedule payment</button>`,
			);
		}
		ui.drawerNode.dataset.party = party.name;
	}

	function wireDrawer() {
		pageRoot.addEventListener('click', (event) => {
			const line = event.target.closest('[data-fr-line]');
			if (line) {
				showLine(line.dataset.frLine, Number(line.dataset.frTone) || 1);
				return;
			}
			const party = event.target.closest('[data-fr-party]');
			if (party) showParty(Number(party.dataset.frParty));
		});

		ui.drawerNode.addEventListener('click', (event) => {
			const heading = ui.drawerTitle.textContent.trim();
			if (event.target.closest('[data-fr-dl]')) {
				notify({
					tone: 'success',
					title: 'Download started',
					text: `${heading}, ${ui.drawerSub.textContent.trim().toLowerCase()}, as CSV.`,
					duration: 4000,
				});
			} else if (event.target.closest('[data-fr-remind]')) {
				drawerApi().hide();
				notify({
					tone: 'success',
					title: `Sent to ${heading}`,
					text: 'Their billing contact gets the open invoices and a link to pay.',
					duration: 5000,
				});
			} else if (event.target.closest('[data-fr-pay]')) {
				drawerApi().hide();
				notify({
					tone: 'success',
					title: 'Payment scheduled',
					text: `${heading} is paid in the next bank run on Friday.`,
					duration: 5000,
				});
			}
		});
	}

	/* Saved reports: the list, its quick view, and the row click rules. */
	function pinnedNameMarkup(report) {
		return report.full
			? `<a class="fr-saved-name" href="${report.full}">${htmlSafe(report.name)}</a>`
			: `<button type="button" class="fr-saved-name" data-fr-open="${report.id}">${htmlSafe(report.name)}</button>`;
	}

	function pinnedActionsMarkup(report) {
		const quickView = `<button type="button" class="btn btn-icon btn-sm" data-fr-open="${report.id}" aria-label="Quick view: ${htmlSafe(report.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>`;
		const fullPage = report.full
			? `<a class="btn btn-icon btn-sm" href="${report.full}" aria-label="Open full page: ${htmlSafe(report.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>`
			: '';
		const menu = `<div class="dropdown"><button type="button" class="btn btn-icon" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="More for ${htmlSafe(report.name)}"><i class="bi bi-three-dots" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end"><li><button type="button" class="dropdown-item" data-fr-saved-dl="${report.id}"><i class="bi bi-download me-2" aria-hidden="true"></i>Download CSV</button></li><li><button type="button" class="dropdown-item text-danger" data-fr-saved-del="${report.id}"><i class="bi bi-trash3 me-2" aria-hidden="true"></i>Delete</button></li></ul></div>`;
		return `<div class="fr-saved-actions"><span class="basalt-row-actions">${quickView}${fullPage}</span>${menu}</div>`;
	}

	function pinnedRow(report) {
		const ownerName = htmlSafe(OWNER_NAMES[report.owner]);
		return `<li class="fr-saved-row" data-fr-saved-id="${report.id}"><span class="fr-saved-icon" style="--fr-tone:${RAMP[report.tone]}" aria-hidden="true"><i class="bi ${report.icon}"></i></span><div class="fr-saved-text">${pinnedNameMarkup(report)}<span class="fr-saved-desc">${htmlSafe(report.desc)}</span></div><span class="fr-saved-owner"><span class="basalt-avatar basalt-avatar-xs" data-basalt-avatar data-name="${ownerName}" aria-hidden="true"></span>${ownerName}</span><span class="fr-saved-when"><span class="fr-saved-schedule">${htmlSafe(report.schedule)}</span><span class="fr-saved-run">Last run ${htmlSafe(report.run)}</span></span>${pinnedActionsMarkup(report)}</li>`;
	}

	function drawPinned() {
		const howMany = pinned.length;
		ui.pinnedList.innerHTML = pinned.map(pinnedRow).join('');
		ui.pinnedList.hidden = !howMany;
		ui.pinnedEmpty.hidden = Boolean(howMany);
		ui.pinnedCount.textContent = howMany
			? `${COUNT_WORDS[howMany] || howMany} report${howMany === 1 ? '' : 's'} the finance team runs again and again.`
			: 'Reports you save show up here.';
		window.Basalt.avatars?.(ui.pinnedList);
		window.Basalt.tips?.(ui.pinnedList);
	}

	function pinnedById(id) {
		return pinned.find((report) => report.id === id);
	}

	function showPinned(id) {
		const report = pinnedById(id);
		if (!report) return;
		const owner = OWNER_NAMES[report.owner];
		const subtitle = report.schedule === 'Not scheduled' ? `Saved by ${owner}` : `${report.schedule}, by ${owner}`;
		showDrawer(
			report.name,
			subtitle,
			() => {
				ui.drawerBody.innerHTML = report.draw();
			},
			report.full,
		);
		const pageLink =
			!report.full && report.page
				? `<a class="btn btn-outline-secondary" href="${report.page[0]}">${report.page[1]}</a>`
				: '';
		setDrawerFoot(`${pageLink}<button type="button" class="btn btn-primary" data-fr-dl>Download CSV</button>`);
	}

	/**
	 * A click on a row outside its links, buttons and menu acts like its
	 * name: the full page when there is one (a new tab with Cmd/Ctrl or the
	 * middle button), otherwise the quick view. Says whether it handled it.
	 */
	function rowClick(event) {
		const row = event.target.closest('[data-fr-saved-id]');
		if (!row || event.target.closest('a, button, .dropdown-menu')) return false;
		const report = pinnedById(row.dataset.frSavedId);
		if (!report.full) {
			if (event.button === 0) showPinned(report.id);
		} else if (event.metaKey || event.ctrlKey || event.button === 1) {
			window.open(report.full, '_blank', 'noopener');
		} else {
			location.href = report.full;
		}
		return true;
	}

	function removePinned(id) {
		const at = pinned.findIndex((report) => report.id === id);
		const [gone] = pinned.splice(at, 1);
		drawPinned();
		notify({
			tone: 'info',
			title: 'Report deleted',
			text: `${gone.name} is gone for everyone.`,
			duration: 6000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						pinned.splice(at, 0, gone);
						drawPinned();
					},
				},
			],
		});
		(pick('[data-fr-open]', ui.pinnedList) || pick('[data-fr-new-empty]'))?.focus();
	}

	function wirePinned() {
		ui.pinnedList.addEventListener('auxclick', (event) => {
			if (event.button === 1) rowClick(event);
		});
		ui.pinnedList.addEventListener('click', (event) => {
			const quickView = event.target.closest('[data-fr-open]');
			if (quickView) {
				showPinned(quickView.dataset.frOpen);
				return;
			}
			if (rowClick(event)) return;
			const download = event.target.closest('[data-fr-saved-dl]');
			if (download) {
				notify({
					tone: 'success',
					title: 'Download started',
					text: `${pinnedById(download.dataset.frSavedDl).name}, as CSV.`,
					duration: 4000,
				});
				return;
			}
			const trash = event.target.closest('[data-fr-saved-del]');
			if (trash) removePinned(trash.dataset.frSavedDel);
		});
	}

	/* The new report dialog: a figure, a split, a live preview, then it
     joins the saved list. */
	function readBuilder() {
		const measure = pick('input[name="frMeasure"]:checked', ui.builderNode).value;
		const canSplitByLine = Boolean(FIGURES[measure].lines);
		ui.byLineOption.disabled = !canSplitByLine;
		if (!canSplitByLine && ui.byLineOption.checked) ui.byMonthOption.checked = true;
		ui.splitNote.textContent = canSplitByLine
			? 'By line uses September 2026, the last closed month.'
			: `${FIGURES[measure].label} is one figure, so it is split by month.`;
		const split = pick('input[name="frSplit"]:checked', ui.builderNode).value;
		return { measure, split };
	}

	function builderSeries({ measure, split }) {
		const figure = FIGURES[measure];
		return split === 'line'
			? figure.lines()
			: sixMonthsTo(NEWEST_CLOSED).map((index) => ({
					label: calendar(index).brief,
					value: figure.monthly(index),
				}));
	}

	function paintPreview() {
		const choice = readBuilder();
		ui.previewBox.innerHTML = barList(builderSeries(choice).slice(0, 3), FIGURES[choice.measure].tone);
	}

	function saveBuilder(event) {
		event.preventDefault();
		const reportName = ui.nameField.value.trim();
		if (!reportName) {
			ui.nameField.classList.add('is-invalid');
			ui.nameField.focus();
			return;
		}
		const choice = readBuilder();
		const figure = FIGURES[choice.measure];
		const emailed = ui.emailSwitch.checked;
		const points = builderSeries(choice);
		const byLine = choice.split === 'line';
		madeCount += 1;
		pinned.unshift({
			id: `custom${madeCount}`,
			name: reportName,
			icon: figure.icon,
			tone: figure.tone,
			owner: 'ja',
			desc: figure.label + (byLine ? ' by line, September 2026' : ' by month, last six months'),
			schedule: emailed ? 'Monthly, after close' : 'Not scheduled',
			run: 'Just now',
			draw() {
				return `<p class="fr-dlede">${htmlSafe(figure.label)}${byLine ? ' for September 2026, largest first.' : ' at each month over the last six months.'}</p>${drawerSection(byLine ? 'September 2026' : 'Last six months', barList(points, figure.tone))}`;
			},
		});
		drawPinned();
		bootstrap.Modal.getInstance(ui.builderNode).hide();
		notify({
			tone: 'success',
			title: 'Report saved',
			text: reportName + (emailed ? ' will be emailed to you each month.' : ' is in your saved reports.'),
			duration: 5000,
		});
	}

	function wireBuilder() {
		ui.builderNode.addEventListener('change', (event) => {
			if (['frMeasure', 'frSplit'].includes(event.target.name)) paintPreview();
		});
		ui.builderNode.addEventListener('show.bs.modal', () => {
			ui.builderForm.reset();
			ui.builderForm.classList.remove('was-validated');
			ui.nameField.classList.remove('is-invalid');
			paintPreview();
		});
		ui.builderNode.addEventListener('shown.bs.modal', () => ui.nameField.focus());
		ui.nameField.addEventListener('input', () => {
			if (ui.nameField.value.trim()) ui.nameField.classList.remove('is-invalid');
		});
		ui.builderForm.addEventListener('submit', saveBuilder);
	}

	start();
})();
