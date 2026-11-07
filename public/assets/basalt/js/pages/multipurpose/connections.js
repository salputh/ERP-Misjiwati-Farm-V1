/**
 * Connections screen (connections.html). Lists the outside services
 * Fieldline talks to: alerts for the ones in trouble, a row per linked
 * service with today's traffic, a stacked chart of what went through,
 * a paged activity log and a shelf of services still to add.
 *
 * Every number comes from a fixed-seed generator, so each visit shows
 * the same company and the page never fetches anything. Toasts, record
 * stepping, dialogs, the pager, tabs and loading buttons are borrowed
 * from basalt.js.
 */
(() => {
	'use strict';

	const shell = pick('[data-itg-root]');
	if (!shell) return;

	/* The generator is seeded once; the order in which numbers are drawn
     from it decides the whole demo, so seeding happens in start(). */
	const random = makeRandom(20260929);
	const notices = window.Basalt.toasts;

	const CATEGORY_NAMES = {
		payments: 'Payments',
		shipping: 'Shipping and stock',
		books: 'Accounting and tax',
		marketing: 'Marketing',
		selling: 'Selling',
		help: 'Support and team',
	};

	/* What a newly linked service may read or do, by category. */
	const ACCESS_RIGHTS = {
		payments: ['Read orders and their totals', 'Take payments and make refunds', 'See payouts to the bank'],
		shipping: ['Read orders and delivery addresses', 'Buy postage labels', 'Add tracking numbers to orders'],
		books: ['Read sales, fees and refunds', 'Create invoices and daily totals'],
		marketing: ['Read customers who said yes to marketing', 'Read what they bought and when'],
		selling: ['Read and update products and prices', 'Create orders and seat plans'],
		help: ['Read customers and their orders', 'Post notes on an order'],
	};

	/* Services already linked. color picks one of the eight chart hues;
     cadence is a key of CADENCE_TEXT. */
	const IN_USE = [
		{
			id: 'stripe',
			name: 'Stripe',
			initials: 'St',
			category: 'payments',
			color: 1,
			role: 'Card payments',
			state: 'ok',
			blurb: 'Card payments for seat plans and add-on orders.',
			mailbox: 'payments@fieldline.app',
			joined: 'March 2023',
			minutesAgo: 2,
			cadence: 'live',
			essential: true,
		},
		{
			id: 'paypal',
			name: 'PayPal',
			initials: 'Pp',
			category: 'payments',
			color: 4,
			role: 'Payments',
			state: 'ok',
			blurb: 'PayPal and Pay Later at add-on checkout.',
			mailbox: 'orders@fieldline.app',
			joined: 'June 2023',
			minutesAgo: 6,
			cadence: 'live',
		},
		{
			id: 'shippo',
			name: 'Shippo',
			initials: 'Sh',
			category: 'shipping',
			color: 2,
			role: 'Postage labels',
			state: 'failing',
			blurb: 'Compares carrier prices and prints labels.',
			mailbox: 'fulfillment@fieldline.app',
			joined: 'May 2023',
			minutesAgo: 47,
			cadence: '15',
			problem: '3 labels failed to print this morning because Shippo stopped answering.',
			failuresLeft: 1,
		},
		{
			id: 'usps',
			name: 'USPS',
			initials: 'Us',
			category: 'shipping',
			color: 5,
			role: 'Postage',
			state: 'ok',
			blurb: 'Ground Advantage and Priority Mail rates.',
			mailbox: 'fulfillment@fieldline.app',
			joined: 'May 2023',
			minutesAgo: 9,
			cadence: '15',
		},
		{
			id: 'xero',
			name: 'Xero',
			initials: 'Xe',
			category: 'books',
			color: 3,
			role: 'Accounting',
			state: 'expiring',
			blurb: 'Sales, fees and refunds sent to the books each hour.',
			mailbox: 'accounts@fieldline.app',
			joined: 'January 2024',
			minutesAgo: 12,
			cadence: '60',
			problem: 'The sign-in runs out in 3 days. After that, sales stop reaching the books.',
		},
		{
			id: 'taxjar',
			name: 'TaxJar',
			initials: 'Tj',
			category: 'books',
			color: 6,
			role: 'Sales tax',
			state: 'ok',
			blurb: 'Works out sales tax on every invoice and add-on order.',
			mailbox: 'accounts@fieldline.app',
			joined: 'January 2024',
			minutesAgo: 4,
			cadence: 'live',
		},
		{
			id: 'mailchimp',
			name: 'Mailchimp',
			initials: 'Mc',
			category: 'marketing',
			color: 7,
			role: 'Email newsletter',
			state: 'ok',
			blurb: 'Keeps the newsletter list in step with trial and paying accounts.',
			mailbox: 'marketing@fieldline.app',
			joined: 'April 2023',
			minutesAgo: 18,
			cadence: '60',
		},
		{
			id: 'twilio',
			name: 'Twilio',
			initials: 'Tw',
			category: 'marketing',
			color: 8,
			role: 'Text messages',
			state: 'paused',
			blurb: 'Texts customers when their welcome pack ships.',
			mailbox: 'orders@fieldline.app',
			joined: 'August 2024',
			minutesAgo: 2880,
			cadence: 'live',
			pauseNote: 'Paused by Nia on Monday',
		},
		{
			id: 'analytics',
			name: 'Google Analytics',
			initials: 'Ga',
			category: 'marketing',
			color: 5,
			role: 'Site visits',
			state: 'ok',
			blurb: 'Shows which ads and emails bring in trials and add-on orders.',
			mailbox: 'marketing@fieldline.app',
			joined: 'March 2023',
			minutesAgo: 1,
			cadence: 'live',
		},
		{
			id: 'chargebee',
			name: 'Chargebee',
			initials: 'Cb',
			category: 'selling',
			color: 1,
			role: 'Seat billing',
			state: 'syncing',
			blurb: 'Monthly and annual seat plans, renewals and upgrades.',
			mailbox: 'billing@fieldline.app',
			joined: 'today',
			minutesAgo: 0,
			cadence: 'live',
			percent: 64,
		},
		{
			id: 'zendesk',
			name: 'Zendesk',
			initials: 'Zd',
			category: 'help',
			color: 2,
			role: 'Customer help',
			state: 'ok',
			blurb: 'Puts the account and its plan next to every support email.',
			mailbox: 'support@fieldline.app',
			joined: 'October 2023',
			minutesAgo: 3,
			cadence: 'live',
		},
		{
			id: 'slack',
			name: 'Slack',
			initials: 'Sl',
			category: 'help',
			color: 4,
			role: 'Team chat',
			state: 'ok',
			blurb: 'Posts new Max deals, big add-on orders and failed renewals to the team.',
			mailbox: 'team@fieldline.app',
			joined: 'February 2024',
			minutesAgo: 21,
			cadence: 'live',
		},
	];

	/* Services on the shelf, not linked yet. featured adds a Popular tag;
     unreliable makes the first connect attempt fail. */
	const ON_OFFER = [
		{
			id: 'square',
			name: 'Square',
			initials: 'Sq',
			category: 'payments',
			color: 3,
			blurb: 'Take card payments at industry events, with the sales in the same reports.',
			featured: true,
		},
		{
			id: 'klarna',
			name: 'Klarna',
			initials: 'Kl',
			category: 'payments',
			color: 7,
			blurb: 'Let customers split a bigger order, like onboarding and training, into four payments.',
		},
		{
			id: 'shipstation',
			name: 'ShipStation',
			initials: 'Ss',
			category: 'shipping',
			color: 6,
			blurb: 'Print labels and packing slips in batches for the morning pickup.',
			featured: true,
		},
		{
			id: 'ups',
			name: 'UPS',
			initials: 'Up',
			category: 'shipping',
			color: 8,
			blurb: 'Live UPS prices at checkout and pickups booked from here.',
		},
		{
			id: 'dhl',
			name: 'DHL Express',
			initials: 'Dh',
			category: 'shipping',
			color: 2,
			blurb: 'Send welcome packs overnight, with the labels printed for you.',
			unreliable: true,
		},
		{
			id: 'cin7',
			name: 'Cin7',
			initials: 'C7',
			category: 'shipping',
			color: 4,
			blurb: 'Count welcome pack stock across the office, the post room and the event kits.',
		},
		{
			id: 'quickbooks',
			name: 'QuickBooks',
			initials: 'Qb',
			category: 'books',
			color: 5,
			blurb: 'Send each day of sales and fees to QuickBooks as one tidy entry.',
			featured: true,
		},
		{
			id: 'avalara',
			name: 'Avalara',
			initials: 'Av',
			category: 'books',
			color: 1,
			blurb: 'Sales tax for add-on orders in every state you sell to.',
		},
		{
			id: 'klaviyo',
			name: 'Klaviyo',
			initials: 'Kv',
			category: 'marketing',
			color: 3,
			blurb: 'Emails that follow what people buy, like a nudge when their SMS credits run low.',
			featured: true,
		},
		{
			id: 'meta',
			name: 'Meta Ads',
			initials: 'Ma',
			category: 'marketing',
			color: 6,
			blurb: 'Show Fieldline in Facebook and Instagram ads, with trials tracked back.',
		},
		{
			id: 'postmark',
			name: 'Postmark',
			initials: 'Pm',
			category: 'marketing',
			color: 8,
			blurb: 'Invoice and add-on order emails that land in the inbox, not in spam.',
		},
		{
			id: 'shopping',
			name: 'Google Shopping',
			initials: 'Gs',
			category: 'selling',
			color: 7,
			blurb: 'List plans and add-ons in Google search results, with prices kept up to date.',
		},
		{
			id: 'amazonbiz',
			name: 'Amazon Business',
			initials: 'Ab',
			category: 'selling',
			color: 2,
			blurb: 'Sell SMS credit packs in bulk to franchises, with orders landing here.',
			featured: true,
		},
		{
			id: 'yotpo',
			name: 'Yotpo',
			initials: 'Yo',
			category: 'selling',
			color: 4,
			blurb: 'Ask for a review two weeks after onboarding and show the stars on each plan.',
		},
		{
			id: 'g2',
			name: 'G2',
			initials: 'G2',
			category: 'selling',
			color: 5,
			blurb: 'Ask happy accounts for a review and show the badge on the pricing page.',
		},
		{
			id: 'trustpilot',
			name: 'Trustpilot',
			initials: 'Tp',
			category: 'selling',
			color: 3,
			blurb: 'Collect customer reviews and show the rating at checkout.',
		},
		{
			id: 'gorgias',
			name: 'Gorgias',
			initials: 'Gg',
			category: 'help',
			color: 6,
			blurb: 'Answer email and chat from one inbox, with the account and its plan alongside.',
		},
		{
			id: 'dropbox',
			name: 'Dropbox',
			initials: 'Db',
			category: 'help',
			color: 1,
			blurb: 'Keep print supplier invoices and label files in shared folders.',
		},
	];

	/* Linked services come first in every list, in the order above. */
	const CATALOG = [...IN_USE.map((app) => ({ ...app, linked: true })), ...ON_OFFER];

	/* Traffic per hour of the day as a share of a quiet hour (7), and each
     service's quiet-hour volume. Services missing here default to 6. */
	const DAY_CURVE = [2, 1, 1, 1, 1, 2, 4, 7, 10, 12, 13, 11, 10, 9, 8, 8, 7, 7, 6, 5, 4, 4, 3, 2];
	const HOURLY_BASE = {
		stripe: 54,
		paypal: 9,
		shippo: 14,
		usps: 17,
		xero: 4,
		taxjar: 8,
		mailchimp: 23,
		twilio: 0,
		analytics: 47,
		chargebee: 17,
		zendesk: 3,
		slack: 1,
	};
	const FIXED_SUCCESS = { failing: 94.1, expiring: 98.6 };

	const PACK_ITEMS = [
		'2 × Welcome Pack, Large',
		'Quick-start Guides',
		'4 × Appointment Card Box',
		'Name Badges',
		'3 × Reminder Card Pack',
		'Training Workbook',
		'Printed Price List Pack',
		'Branded Visit Folders',
	];

	/* Log lines a healthy service writes, by category, and the one line
     each troubled service writes when a call fails. */
	const EVENT_LINES = {
		payments: [
			() => `Took $${randomInt(14, 96)}.${randomInt(10, 99)} for order ${orderNumber()}`,
			() => `Refunded order ${orderNumber()} in full`,
			() => `Payout of $${grouped(randomInt(900, 3800))} on its way to the bank`,
		],
		shipping: [
			() => `Label bought for order ${orderNumber()}, ${oneOf(PACK_ITEMS)}`,
			() => `Tracking added to order ${orderNumber()}`,
			() => `Order ${orderNumber()} delivered`,
		],
		books: [
			() => `Sent ${randomInt(12, 60)} sales and ${randomInt(0, 4)} refunds to the books`,
			() => `Sales tax worked out for order ${orderNumber()}`,
		],
		marketing: [
			() => `Added ${randomInt(2, 14)} new customers to the newsletter list`,
			() => `Order ${orderNumber()} traced back to the autumn email`,
			() => `Shipping text sent for order ${orderNumber()}`,
		],
		selling: [
			() => `Renewed ${randomInt(4, 22)} seat plans`,
			() => `Brought in ${randomInt(40, 120)} past invoices`,
		],
		help: [
			() => `Customer email linked to order ${orderNumber()}`,
			() => `Posted a big order to #orders: ${oneOf(PACK_ITEMS)}`,
		],
	};
	const FAILURE_LINES = {
		shippo: () => `Label for order ${orderNumber()} failed: Shippo did not answer`,
		xero: () => 'Could not send the 11:00 am sales: sign-in needs renewing',
		stripe: () => `Refund for order ${orderNumber()} declined by the bank`,
		mailchimp: () => 'Skipped 1 contact with an email address that bounces',
	};
	/* How likely a call is to fail for a service in each state. */
	const FAILURE_ODDS = { failing: 0.6, expiring: 0.25 };

	const CADENCE_TEXT = { live: 'As they happen', 15: 'Every 15 minutes', 60: 'Every hour', night: 'Once a night' };
	const BADGES = {
		ok: { tone: 'success', text: 'Working' },
		syncing: { tone: 'info', text: 'First sync' },
		expiring: { tone: 'warning', text: 'Sign in soon' },
		failing: { tone: 'danger', text: 'Failing' },
		paused: { tone: '', text: 'Paused' },
	};

	/* Wording and icons for the two kinds of alert. */
	const ALERT_COPY = {
		failing: {
			look: 'alert-danger',
			icon: 'bi-exclamation-octagon',
			headline: ' is not syncing',
			fixIcon: 'bi-arrow-clockwise',
			fixText: 'Try again',
			second: (app) =>
				`<button type="button" class="btn btn-sm basalt-alert-btn basalt-alert-btn-ghost" data-itg-open="${app.id}" data-itg-tab="activity">See what failed</button>`,
		},
		expiring: {
			look: 'alert-warning',
			icon: 'bi-key',
			headline: ' needs you to sign in again',
			fixIcon: 'bi-box-arrow-in-right',
			fixText: 'Sign in again',
			second: (app) =>
				`<button type="button" class="btn btn-sm basalt-alert-btn basalt-alert-btn-ghost" data-itg-snooze="${app.id}">Remind me tomorrow</button>`,
		},
	};

	/* What stops working once a service of each category is unlinked. */
	const LOSS_LINES = {
		payments: (name) => `Customers cannot pay with ${name} at checkout`,
		shipping: (name) => `No more labels or tracking from ${name}`,
		books: (name) => `Sales stop reaching ${name}`,
		marketing: (name) => `New customers stop reaching ${name}`,
		selling: (name) => `${name} stops creating orders here`,
		help: (name) => `${name} no longer sees orders`,
	};

	/* Row controls that can hold focus, in the order a redraw looks for
     them when putting focus back. */
	const ROW_CONTROLS = ['data-itg-open', 'data-itg-sync', 'data-itg-fix', 'data-itg-resume'];

	/* Delegated clicks: the first attribute present on the target decides
     what happens. */
	const CLICK_ACTIONS = [
		['data-itg-open', (app, control) => openPanel(app.id, control.getAttribute('data-itg-tab'), control)],
		['data-itg-sync', (app, control) => syncApp(app, control)],
		['data-itg-fix', (app, control) => repair(app, control)],
		['data-itg-resume', (app) => setPaused(app, false)],
		['data-itg-snooze', (app) => hideAlert(app.id)],
		['data-itg-connect', (app, control) => openConnectDialog(app, control)],
	];

	const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	const CHART_FONT = "'Schibsted Grotesk', sans-serif";
	const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	const activity = [];
	const hiddenAlerts = new Set();

	/* Handles and view state, one object per part of the screen. */

	const alerts = {
		box: pick('[data-itg-alerts]', shell),
		calm: pick('[data-itg-allclear]', shell),
	};
	const appList = {
		rows: pick('[data-itg-apps]', shell),
		empty: pick('[data-itg-apps-empty]', shell),
		search: pick('[data-itg-apps-search]', shell),
		total: pick('[data-itg-apps-kind]', shell),
		filter: 'all',
	};
	const chart = {
		canvas: pick('[data-itg-chart]', shell),
		instance: null,
		span: 'day',
	};
	const log = {
		list: pick('[data-itg-feed]', shell),
		empty: pick('[data-itg-feed-empty]', shell),
		picker: pick('[data-itg-activity-app]', shell),
		problemsOnly: pick('[data-itg-activity-problems]', shell),
		pagerBox: pick('[data-itg-pager]', shell),
		refresh: pick('[data-itg-activity-refresh]', shell),
		shown: [],
		pagerSettings: null,
		pager: null,
	};
	const shelf = {
		tabs: pick('[data-itg-cats]', shell),
		tiles: pick('[data-itg-tiles]', shell),
		empty: pick('[data-itg-tiles-empty]', shell),
		search: pick('[data-itg-cat-search]', shell),
		count: pick('[data-itg-cat-count]', shell),
		total: pick('[data-itg-cat-kind]', shell),
		category: 'all',
	};
	const linking = {
		dialog: document.getElementById('itg-connect'),
		form: null,
		finish: null,
		error: null,
		app: null,
		origin: null,
	};
	linking.form = pick('[data-itg-connect-form]', linking.dialog);
	linking.finish = pick('[data-basalt-step-finish]', linking.form);
	linking.error = pick('[data-itg-c="error"]', linking.form);
	const asking = {
		dialog: document.getElementById('itg-request'),
		form: null,
		origin: null,
	};
	asking.form = pick('[data-itg-request-form]', asking.dialog);
	const panel = {
		root: document.getElementById('itg-sheet'),
		tabs: null,
		retry: null,
		history: null,
		pause: null,
		app: null,
		origin: null,
		order: [],
		stepper: null,
		queuedRemoval: null,
	};
	panel.tabs = pick('[data-itg-d-tabs]', panel.root);
	panel.retry = pick('[data-itg-d-retry]', panel.root);
	panel.history = pick('[data-itg-d="feed"]', panel.root);
	panel.pause = pick('[data-itg-d-pause]', panel.root);
	const unlinking = {
		holdDialog: document.getElementById('itg-disconnect'),
		typedDialog: document.getElementById('itg-disconnect-typed'),
		app: null,
	};

	start();

	/** Seeds the demo, wires every part of the screen and paints it. */
	function start() {
		seedTraffic();
		seedActivity();

		wireAppList();
		wireRowClicks();
		wireCheckAll();
		watchFirstSync();
		wireChart();
		wireActivity();
		wireShelf();
		wireConnectDialog();
		wireRequestDialog();
		wirePanel();
		wireDisconnect();

		/* Placeholders stand in while the pretend request is out. */
		placeholderApps();
		placeholderActivity();
		paintHeadline();
		drawAlerts();
		drawCategoryTabs();
		drawTiles();
		fillAppPicker();
		setTimeout(
			() => {
				redrawApps();
				refreshActivity();
			},
			prefersCalm() ? 0 : 650,
		);
	}

	/** Repaints everything that depends on which services are linked. */
	function redrawAll() {
		paintHeadline();
		drawAlerts();
		redrawApps();
		fillAppPicker();
		refreshActivity();
		drawCategoryTabs();
		drawTiles();
		if (chart.instance) drawChart(false);
		else writeStats(chartSeries());
	}

	/* Demo data
     Hourly traffic and success rate per service, then sixty log entries
     spread back from the present, newest first. */

	function seedTraffic() {
		for (const app of CATALOG) {
			const base = HOURLY_BASE[app.id] || 6;
			app.hourly = DAY_CURVE.map((share) => Math.round(((base * share) / 7) * (0.75 + random() * 0.5)));
			app.successRate = FIXED_SUCCESS[app.state] ?? 99 + Math.round(random() * 9) / 10;
		}
	}

	function seedActivity() {
		const sources = linkedApps().filter((app) => app.state !== 'paused');
		let age = 1;
		for (let entry = 0; entry < 60; entry++) {
			const app = oneOf(sources);
			const roll = random();
			const failed = FAILURE_LINES[app.id] && roll < (FAILURE_ODDS[app.state] ?? 0.06);
			activity.push({
				appId: app.id,
				age,
				passed: !failed,
				line: failed ? FAILURE_LINES[app.id]() : oneOf(EVENT_LINES[app.category])(),
			});
			age += randomInt(2, 11);
		}
	}

	function orderNumber() {
		return `#${randomInt(4120, 4388)}`;
	}

	/** mulberry32: a tiny generator that repeats for a given seed. */
	function makeRandom(seed) {
		let state = seed >>> 0;
		return () => {
			state = (state + 0x6d2b79f5) >>> 0;
			let mixed = state;
			mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	/** Whole number from low to high, both ends included. */
	function randomInt(low, high) {
		return Math.floor(low + random() * (high - low + 1));
	}

	function oneOf(items) {
		return items[Math.floor(random() * items.length)];
	}

	/* Reading the data */

	function appById(id) {
		return CATALOG.find((app) => app.id === id);
	}

	function linkedApps() {
		return CATALOG.filter((app) => app.linked);
	}

	function needsAttention(app) {
		return app.state === 'failing' || app.state === 'expiring';
	}

	/** Calls so far today; before any traffic, the 10 am hour stands in. */
	function countToday(app) {
		if (app.state === 'paused') return 0;
		const sum = app.hourly.slice(0, new Date().getHours() + 1).reduce((total, value) => total + value, 0);
		return sum || app.hourly[10];
	}

	function sinceText(minutes) {
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes} min ago`;
		if (minutes < 1440) return `${Math.floor(minutes / 60)} h ago`;
		return `${Math.floor(minutes / 1440)}${minutes < 2880 ? ' day ago' : ' days ago'}`;
	}

	/** The short line beside a service's status badge. */
	function stateLine(app) {
		switch (app.state) {
			case 'paused':
				return app.pauseNote || 'Paused';
			case 'syncing':
				return `${app.percent}% of past records in`;
			case 'failing':
				return `Last worked ${sinceText(app.minutesAgo)}`;
			default:
				return `Synced ${sinceText(app.minutesAgo)}`;
		}
	}

	/* Shared markup */

	/** Joins the truthy class names, in order, with single spaces. */
	function classNames(...names) {
		return names.filter(Boolean).join(' ');
	}

	function logoMarkup(app, size) {
		return `<span class="${classNames('itg-logo', `itg-tone-${app.color}`, size && `itg-logo-${size}`)}" aria-hidden="true">${htmlSafe(app.initials)}</span>`;
	}

	function badgeMarkup(app) {
		const badge = BADGES[app.state];
		const look = classNames(
			'basalt-status basalt-status-dot',
			badge.tone && `basalt-status-${badge.tone}`,
			app.state === 'syncing' && 'basalt-status-live',
		);
		return `<span class="${look}">${badge.text}</span>`;
	}

	/** A button wired for basalt's loading states: icon and label swap. */
	function loadingButton({ look, hook, id, icon, label, off }) {
		return `<button type="button" class="${look} btn-loading btn-loading-swap" ${hook}="${id}"${off ? ' disabled' : ''}><span class="btn-loading-icon"><i class="bi ${icon}" aria-hidden="true"></i></span><span class="btn-loading-label">${label}</span></button>`;
	}

	/**
	 * Bars for the 6 am to 10 pm hours, tallest scaled to 22 of the 24
	 * units. A paused service draws a flat line of 1-unit stubs.
	 */
	function sparkMarkup(app) {
		const hours = app.hourly.slice(6, 22);
		const peak = Math.max(...hours, 1);
		const step = 6;
		const bars = hours.map((value, slot) => {
			const tall = app.state === 'paused' ? 1 : Math.max(1, Math.round((value / peak) * 22));
			return `<rect x="${slot * step}" y="${24 - tall}" width="4" height="${tall}" rx="1"></rect>`;
		});
		return `<svg class="itg-spark itg-tone-${app.color}" viewBox="0 0 ${hours.length * step - 2} 24" aria-hidden="true" focusable="false">${bars.join('')}</svg>`;
	}

	function eventMarkup(entry) {
		const app = appById(entry.appId);
		const stamp = new Date(Date.now() - entry.age * 60000).toISOString();
		const flag = entry.passed ? '' : '<span class="visually-hidden">Failed: </span>';
		return (
			`<li class="${classNames('itg-event', !entry.passed && 'is-failed', entry.isNew && 'is-fresh')}">` +
			`<span class="itg-event-icon" aria-hidden="true"><i class="bi ${entry.passed ? 'bi-check2' : 'bi-x-lg'}"></i></span>` +
			`<div class="itg-event-body"><p class="itg-event-text">${flag}${htmlSafe(entry.line)}</p>` +
			`<p class="itg-event-meta"><span>${htmlSafe(app ? app.name : entry.appId)}</span><span aria-hidden="true">·</span><time datetime="${stamp}">${sinceText(entry.age)}</time></p></div></li>`
		);
	}

	/* The headline figures above the cards */

	function paintHeadline() {
		const linked = linkedApps();
		const figures = {
			connected: linked.length,
			attention: linked.filter(needsAttention).length,
			today: grouped(linked.reduce((total, app) => total + countToday(app), 0)),
		};
		for (const [key, value] of Object.entries(figures)) {
			const slot = pick(`[data-itg-fig="${key}"]`, shell);
			if (slot) slot.textContent = value;
		}
	}

	/* Alerts for services in trouble */

	function drawAlerts() {
		const troubled = linkedApps().filter((app) => needsAttention(app) && !hiddenAlerts.has(app.id));
		alerts.box.innerHTML = troubled.map(alertMarkup).join('');
		alerts.calm.hidden = troubled.length > 0;
	}

	function alertMarkup(app) {
		const copy = ALERT_COPY[app.state];
		const fix = loadingButton({
			look: 'btn btn-sm basalt-alert-btn',
			hook: 'data-itg-fix',
			id: app.id,
			icon: copy.fixIcon,
			label: copy.fixText,
		});
		return (
			`<div class="alert ${copy.look} basalt-alert basalt-alert-action itg-alert" role="status" data-itg-alert="${app.id}">` +
			`<span class="basalt-alert-icon" aria-hidden="true"><i class="bi ${copy.icon}"></i></span>` +
			`<div class="basalt-alert-body"><p class="basalt-alert-title">${htmlSafe(app.name)}${copy.headline}</p><p class="basalt-alert-text">${htmlSafe(app.problem)}</p></div>` +
			`<div class="basalt-alert-actions">${fix}${copy.second(app)}</div>` +
			`<button type="button" class="basalt-alert-close" data-itg-snooze="${app.id}" aria-label="Hide the ${htmlSafe(app.name)} alert"><i class="bi bi-x-lg" aria-hidden="true"></i></button></div>`
		);
	}

	/** Hides one alert until tomorrow, with an undo in the toast. */
	function hideAlert(id) {
		const app = appById(id);
		hiddenAlerts.add(id);
		drawAlerts();
		(pick('[data-itg-alert] .basalt-alert-btn', alerts.box) || pick('[data-itg-apps-search]', shell))?.focus();
		notify({
			tone: 'info',
			icon: 'bi-bell-slash',
			title: 'Hidden until tomorrow',
			text: `${app.name} still shows in your connected apps.`,
			duration: 6000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						hiddenAlerts.delete(id);
						drawAlerts();
					},
				},
			],
		});
	}

	/* Repair, sync and pause */

	/**
	 * Retries a failing service or renews an expiring sign-in. Shippo
	 * fails once more before it recovers. Resolves to whether it worked.
	 */
	async function repair(app, button) {
		setButton(button, 'loading', app.state === 'expiring' ? 'Signing in' : 'Trying');
		await wait(1100);
		if (app.state === 'failing' && app.failuresLeft > 0) {
			app.failuresLeft -= 1;
			setButton(button, 'error', 'Still failing');
			notify({
				tone: 'danger',
				title: `${app.name} is still not answering`,
				text: 'Nothing was lost. Try once more, or see what failed.',
				duration: 7000,
				actions: [{ label: 'See what failed', onClick: () => openPanel(app.id, 'activity') }],
			});
			setTimeout(() => setButton(button, 'idle'), 1600);
			return false;
		}
		Object.assign(app, { state: 'ok', minutesAgo: 0, successRate: 99.1 });
		setButton(button, 'success', app.name === 'Xero' ? 'Signed in' : 'Working');
		notify({
			tone: 'success',
			title: `${app.name} is working again`,
			text:
				app.id === 'shippo' ? 'The 3 failed labels have been printed.' : 'Sales will keep reaching the books.',
			duration: 5000,
		});
		await wait(700);
		redrawAll();
		return true;
	}

	async function syncApp(app, button) {
		setButton(button, 'loading', 'Syncing');
		await wait(900);
		if (app.state === 'failing') {
			setButton(button, 'idle');
			return repair(app, button);
		}
		app.minutesAgo = 0;
		setButton(button, 'success', 'Synced');
		say(`${app.name} synced just now`);
		await wait(900);
		redrawApps();
	}

	/** Pauses or resumes a service; silent skips the toast (used by undo). */
	function setPaused(app, paused, silent) {
		if (paused) {
			app.priorState = app.state;
			app.state = 'paused';
			app.pauseNote = 'Paused by you just now';
		} else {
			app.state = app.priorState && app.priorState !== 'paused' ? app.priorState : 'ok';
			app.minutesAgo = 0;
		}
		redrawAll();
		if (panel.app === app) showInPanel(app);
		if (silent) return;
		notify({
			tone: paused ? 'warning' : 'success',
			icon: paused ? 'bi-pause-circle' : 'bi-play-circle',
			title: `${app.name}${paused ? ' paused' : ' is syncing again'}`,
			text: paused
				? 'Nothing is sent or received until you resume it.'
				: 'Anything that came in while it was paused is on its way.',
			duration: 6000,
			actions: [{ label: 'Undo', onClick: () => setPaused(app, !paused, true) }],
		});
	}

	/* Linked services list */

	function wireAppList() {
		for (const option of pickAll('input[name="itg-apps-show"]', shell)) {
			option.addEventListener('change', () => {
				appList.filter = option.value;
				redrawApps();
			});
		}
		appList.search.addEventListener('input', redrawApps);
		pick('[data-itg-apps-reset]', shell).addEventListener('click', () => {
			appList.search.value = '';
			appList.filter = 'all';
			const everything = pick('#itg-show-all');
			everything.checked = true;
			everything.dispatchEvent(new Event('change', { bubbles: true }));
			redrawApps();
			appList.search.focus();
		});
	}

	/**
	 * Repaints the rows. A repaint would lose keyboard focus, so the
	 * focused control is noted first and its twin focused afterwards.
	 */
	function redrawApps() {
		const focused = appList.rows.contains(document.activeElement) ? document.activeElement : null;
		const row = focused?.closest('[data-itg-app]');
		const control = focused && ROW_CONTROLS.find((name) => focused.hasAttribute(name));
		paintApps();
		if (!row) return;
		const id = row.getAttribute('data-itg-app');
		const twin =
			(control && pick(`[${control}="${id}"]`, appList.rows)) ||
			pick(`[data-itg-app="${id}"] button`, appList.rows) ||
			appList.search;
		twin.focus();
	}

	function paintApps() {
		const query = appList.search.value.trim().toLowerCase();
		const linked = linkedApps();
		const visible = linked.filter((app) => {
			if (appList.filter === 'attention' && !needsAttention(app)) return false;
			if (appList.filter === 'paused' && app.state !== 'paused') return false;
			return !query || `${app.name} ${app.role} ${CATEGORY_NAMES[app.category]}`.toLowerCase().includes(query);
		});
		appList.total.textContent = `${linked.length}${linked.length === 1 ? ' app' : ' apps'}`;
		dropTooltips(appList.rows);
		appList.rows.innerHTML = visible.map(rowMarkup).join('');
		appList.rows.removeAttribute('aria-busy');
		appList.empty.hidden = visible.length > 0;
		if (!visible.length) explainEmptyApps(query);
		window.Basalt.tips?.(appList.rows);
	}

	function explainEmptyApps(query) {
		const title = pick('[data-itg-apps-empty-title]', appList.empty);
		const text = pick('[data-itg-apps-empty-text]', appList.empty);
		if (query) {
			title.textContent = `No connected app matches “${appList.search.value.trim()}”`;
			text.textContent = 'Check the spelling, or look for it under Add an app below.';
		} else if (appList.filter === 'paused') {
			title.textContent = 'Nothing is paused';
			text.textContent = 'Every connected app is sending and receiving as normal.';
		} else {
			title.textContent = 'Nothing needs a look';
			text.textContent = 'Every connected app is working.';
		}
	}

	function rowMarkup(app) {
		const page = `connection-details.html?id=${encodeURIComponent(app.id)}`;
		const name = htmlSafe(app.name);
		const meter =
			app.state === 'syncing'
				? `<span class="progress itg-app-progress" role="progressbar" aria-label="${name} first sync" aria-valuenow="${app.percent}" aria-valuemin="0" aria-valuemax="100"><span class="progress-bar" style="width:${app.percent}%"></span></span>`
				: '';
		const shortcuts =
			`<span class="basalt-row-actions">` +
			`<button type="button" class="btn btn-icon btn-sm" data-itg-open="${app.id}" aria-label="Quick view: ${name}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>` +
			`<a class="btn btn-icon btn-sm" href="${page}" aria-label="Open full page: ${name}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span>`;
		return (
			`<li class="${classNames('itg-app', app.state === 'paused' && 'is-paused')}" data-itg-app="${app.id}">${logoMarkup(app)}` +
			`<div class="itg-app-main"><h3 class="itg-app-name"><a class="itg-app-open" href="${page}">${name}</a></h3><p class="itg-app-meta">${htmlSafe(app.role)}</p></div>` +
			`<div class="itg-app-state">${badgeMarkup(app)}<span class="itg-app-when">${htmlSafe(stateLine(app))}</span>${meter}</div>` +
			`<div class="itg-app-volume">${sparkMarkup(app)}<span class="itg-app-count"><strong>${grouped(countToday(app))}</strong> today</span></div>` +
			`<div class="itg-app-actions">${rowAction(app)}${shortcuts}</div></li>`
		);
	}

	/** The row's main button: resume, sign in again, or sync. */
	function rowAction(app) {
		if (app.state === 'paused') {
			return `<button type="button" class="btn btn-sm btn-outline-secondary" data-itg-resume="${app.id}"><i class="bi bi-play-circle me-1" aria-hidden="true"></i>Resume</button>`;
		}
		const look = 'btn btn-sm btn-outline-secondary';
		if (app.state === 'expiring') {
			return loadingButton({
				look,
				hook: 'data-itg-fix',
				id: app.id,
				icon: 'bi-box-arrow-in-right',
				label: 'Sign in again',
			});
		}
		const first = app.state === 'syncing';
		return loadingButton({
			look,
			hook: 'data-itg-sync',
			id: app.id,
			icon: 'bi-arrow-repeat',
			label: first ? 'Bringing in' : 'Sync now',
			off: first,
		});
	}

	function placeholderApps() {
		appList.rows.innerHTML =
			'<li class="itg-app itg-app-ghost" aria-hidden="true"><span class="basalt-skeleton basalt-skeleton-circle itg-logo-ghost"></span><div class="itg-app-main"><span class="basalt-skeleton basalt-skeleton-title"></span><span class="basalt-skeleton basalt-skeleton-text" style="width:40%"></span></div><div class="itg-app-state"><span class="basalt-skeleton basalt-skeleton-line" style="width:5rem"></span></div><div class="itg-app-volume"><span class="basalt-skeleton basalt-skeleton-line" style="width:6rem"></span></div><div class="itg-app-actions"><span class="basalt-skeleton basalt-skeleton-btn"></span></div></li>'.repeat(
				5,
			);
	}

	/** Tooltips on rows about to be replaced are disposed of first. */
	function dropTooltips(scope) {
		if (!window.bootstrap) return;
		for (const holder of pickAll('[data-bs-toggle="tooltip"]', scope)) {
			bootstrap.Tooltip.getInstance(holder)?.dispose();
		}
	}

	/* Clicks on a service, wherever it appears */

	function wireRowClicks() {
		appList.rows.addEventListener('click', (event) => {
			const address = rowLink(event);
			if (!address) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey) window.open(address, '_blank');
			else location.href = address;
		});
		appList.rows.addEventListener('auxclick', (event) => {
			const address = event.button === 1 && rowLink(event);
			if (address) window.open(address, '_blank');
		});
		shell.addEventListener('click', handleAction);
	}

	/**
	 * A click on the bare part of a row goes where the service's name
	 * links (a new tab with a modifier or the middle button). Returns ''
	 * when the click landed on a control or outside any row.
	 */
	function rowLink(event) {
		if (event.target.closest('a, button, input')) return '';
		const row = event.target.closest('.itg-app[data-itg-app]');
		return row ? pick('.itg-app-open', row).href : '';
	}

	function handleAction(event) {
		const control = event.target.closest(
			'[data-itg-open], [data-itg-sync], [data-itg-fix], [data-itg-resume], [data-itg-snooze], [data-itg-connect], [data-itg-request]',
		);
		if (!control) return;
		if (control.hasAttribute('data-itg-request')) {
			openRequestDialog(control);
			return;
		}
		const id = CLICK_ACTIONS.map(([name]) => control.getAttribute(name)).find(Boolean);
		const app = appById(id);
		if (!app) return;
		const match = CLICK_ACTIONS.find(([name]) => control.hasAttribute(name));
		match[1](app, control);
	}

	/* The check-everything button */

	function wireCheckAll() {
		const button = pick('[data-itg-check-all]', shell);
		button.addEventListener('click', async () => {
			setButton(button, 'loading', 'Checking');
			await wait(1400);
			const linked = linkedApps();
			for (const app of linked) {
				if (app.state === 'ok') app.minutesAgo = 0;
			}
			const tally = (state) => linked.filter((app) => app.state === state).length;
			setButton(button, 'success', 'All checked');
			const parts = [`${tally('ok')} working`];
			const extras = [
				['failing', 'failing'],
				['expiring', 'needing a new sign-in'],
				['paused', 'paused'],
			];
			for (const [state, words] of extras) {
				if (tally(state)) parts.push(`${tally(state)} ${words}`);
			}
			notify({
				tone: tally('failing') ? 'warning' : 'success',
				title: `${linked.length} connections checked`,
				text: `${parts.join(', ')}.`,
				duration: 6000,
			});
			redrawApps();
			setTimeout(() => setButton(button, 'idle'), 1500);
		});
	}

	/**
	 * Chargebee's first sync gains four points every four seconds while the
	 * tab is visible. Between steps only its text and bar are touched.
	 */
	function watchFirstSync() {
		const timer = setInterval(() => {
			const app = appById('chargebee');
			if (!app.linked || app.state !== 'syncing') {
				clearInterval(timer);
				return;
			}
			if (document.hidden) return;
			app.percent = Math.min(100, app.percent + 4);
			if (app.percent >= 100) {
				Object.assign(app, { state: 'ok', minutesAgo: 0 });
				clearInterval(timer);
				notify({
					tone: 'success',
					title: 'Chargebee is up to date',
					text: 'All past invoices are in.',
					duration: 5000,
				});
				redrawApps();
				return;
			}
			const row = pick('[data-itg-app="chargebee"]', appList.rows);
			if (!row) return;
			const when = pick('.itg-app-when', row);
			const meter = pick('.itg-app-progress', row);
			if (when) when.textContent = stateLine(app);
			if (meter) {
				meter.setAttribute('aria-valuenow', app.percent);
				meter.firstElementChild.style.width = `${app.percent}%`;
			}
		}, 4000);
	}

	/* Sync health chart
     The chart is made the first time it nears the viewport, and made
     again on basalt:appearance so it follows palette and mode. */

	function wireChart() {
		if (!chart.canvas) return;
		if ('IntersectionObserver' in window) {
			const watcher = new IntersectionObserver(
				(entries) => {
					if (!entries[0].isIntersecting) return;
					watcher.disconnect();
					drawChart(true);
				},
				{ rootMargin: '80px 0px' },
			);
			watcher.observe(chart.canvas);
		} else {
			drawChart(false);
		}
		document.addEventListener('basalt:appearance', () => {
			if (chart.instance) requestAnimationFrame(() => drawChart(false));
		});
		for (const option of pickAll('input[name="itg-range"]', shell)) {
			option.addEventListener('change', () => {
				chart.span = option.value;
				if (chart.instance) drawChart(true);
				else writeStats(chartSeries());
			});
		}
		writeStats(chartSeries());
	}

	function drawChart(animate) {
		if (typeof Chart === 'undefined' || !chart.canvas) return;
		const series = chartSeries();
		writeStats(series);
		const ink = readToken('--basalt-copy', '#12233a');
		const axisInk = blend(readToken('--basalt-copy-muted', '#5f7186'), ink, 0.82);
		const passColor = readToken('--basalt-series-1', '#2b6fd4');
		const failColor = readToken('--basalt-danger', '#ef4d63');
		const stack = (label, data, color) => ({
			label,
			data,
			stack: 's',
			backgroundColor: color,
			hoverBackgroundColor: color,
			borderRadius: 3,
			borderSkipped: false,
			maxBarThickness: 26,
		});
		const ticks = (extra) => ({ color: axisInk, font: { family: CHART_FONT, size: 11 }, ...extra });
		chart.instance?.destroy();
		chart.instance = new Chart(chart.canvas, {
			type: 'bar',
			data: {
				labels: series.labels,
				datasets: [stack('Went through', series.passed, passColor), stack('Failed', series.failed, failColor)],
			},
			options: {
				maintainAspectRatio: false,
				responsive: true,
				interaction: { intersect: false, mode: 'index' },
				animation: animate && !prefersCalm() ? { duration: 500, easing: 'easeOutQuart' } : false,
				scales: {
					x: {
						stacked: true,
						border: { display: false },
						grid: { display: false },
						ticks: ticks({ maxRotation: 0, autoSkipPadding: 14 }),
					},
					y: {
						stacked: true,
						border: { display: false },
						grid: { color: tint(ink, 0.07) },
						ticks: ticks({ maxTicksLimit: 5, callback: (value) => grouped(value) }),
					},
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: readToken('--basalt-plane', '#ffffff'),
						borderColor: readToken('--basalt-edge-strong', '#ccc'),
						borderWidth: 1,
						titleColor: ink,
						bodyColor: ink,
						titleFont: { family: CHART_FONT, size: 12, weight: '600' },
						bodyFont: { family: CHART_FONT, size: 12 },
						padding: 10,
						boxPadding: 4,
						cornerRadius: 8,
						usePointStyle: true,
						callbacks: { label: (item) => ` ${item.dataset.label}: ${grouped(item.parsed.y)}` },
					},
				},
			},
		});
	}

	/**
	 * Passed and failed calls for the chart: the last 24 hours ending with
	 * the current one, or a week built from today's total with its own seed.
	 */
	function chartSeries() {
		const linked = linkedApps();
		if (chart.span !== 'day') return weekSeries(linked);
		const hourNow = new Date().getHours();
		const series = { labels: [], passed: [], failed: [] };
		for (let back = 23; back >= 0; back--) {
			const hour = (hourNow - back + 24) % 24;
			let calls = 0;
			let failures = 0;
			for (const app of linked) {
				if (app.state === 'paused') continue;
				const value = app.hourly[hour];
				calls += value;
				failures += Math.round((value * (100 - app.successRate)) / 100);
			}
			series.labels.push(`${hour % 12 || 12}:00${hour < 12 ? ' am' : ' pm'}`);
			series.passed.push(calls - failures);
			series.failed.push(failures);
		}
		return series;
	}

	function weekSeries(linked) {
		const weekRandom = makeRandom(77);
		const daily = linked.reduce(
			(total, app) => total + (app.state === 'paused' ? 0 : app.hourly.reduce((sum, value) => sum + value, 0)),
			0,
		);
		const series = { labels: [...WEEKDAYS], passed: [], failed: [] };
		for (let index = 0; index < WEEKDAYS.length; index++) {
			const calls = Math.round(daily * (index > 4 ? 0.7 : 0.9 + weekRandom() * 0.25));
			const failures = Math.round(calls * (index === 6 ? 0.02 : 0.004 + weekRandom() * 0.004));
			series.passed.push(calls - failures);
			series.failed.push(failures);
		}
		return series;
	}

	/** Fills the three figures above the chart and the note under it. */
	function writeStats(series) {
		const passed = sum(series.passed);
		const failed = sum(series.failed);
		const figures = {
			rate: `${((passed / Math.max(1, passed + failed)) * 100).toFixed(1)}%`,
			total: grouped(passed + failed),
			failed: grouped(failed),
		};
		for (const [key, value] of Object.entries(figures)) {
			pick(`[data-itg-stat="${key}"]`, shell).textContent = value;
		}
		const busiest = indexOfMax(series.passed.map((value, slot) => value + series.failed[slot]));
		const worst = indexOfMax(series.failed);
		pick('[data-itg-chart-note]', shell).textContent =
			chart.span === 'day'
				? `Busiest hour: ${series.labels[busiest]}, when the morning seat renewals go through. Most failures came at ${series.labels[worst]}.`
				: `Busiest day: ${series.labels[busiest]}. Sunday failures were Shippo, while it was not answering.`;
	}

	function sum(values) {
		return values.reduce((total, value) => total + value, 0);
	}

	/** Position of the first largest value. */
	function indexOfMax(values) {
		let best = 0;
		for (let slot = 1; slot < values.length; slot++) {
			if (values[slot] > values[best]) best = slot;
		}
		return best;
	}

	function readToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** Reads #rgb, #rrggbb, rgb() or rgba() into three channels; gray otherwise. */
	function toRgb(color) {
		const text = String(color || '').trim();
		const short = /^#([0-9a-f]{3})$/i.exec(text);
		if (short) return short[1].split('').map((digit) => parseInt(digit + digit, 16));
		const long = /^#([0-9a-f]{6})$/i.exec(text);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(text);
		if (functional)
			return functional[1]
				.split(',')
				.slice(0, 3)
				.map((part) => parseFloat(part));
		return [128, 128, 128];
	}

	/** Mixes two colors; weight is the share of the first. */
	function blend(first, second, weight) {
		const near = toRgb(first);
		const far = toRgb(second);
		return `rgb(${near.map((channel, index) => Math.round(channel * weight + far[index] * (1 - weight))).join(', ')})`;
	}

	function tint(color, alpha) {
		return `rgba(${toRgb(color).join(', ')}, ${alpha})`;
	}

	/* Activity log */

	function wireActivity() {
		log.picker.addEventListener('change', refreshActivity);
		log.problemsOnly.addEventListener('change', refreshActivity);
		log.refresh.addEventListener('click', async () => {
			setButton(log.refresh, 'loading', 'Refreshing');
			placeholderActivity();
			await wait(900);
			for (const entry of activity) {
				entry.age += 1;
				entry.isNew = false;
			}
			const source = oneOf(linkedApps().filter((app) => app.state !== 'paused' && app.state !== 'failing'));
			activity.unshift({
				appId: source.id,
				age: 0,
				passed: true,
				line: oneOf(EVENT_LINES[source.category])(),
				isNew: true,
			});
			setButton(log.refresh, 'success', 'Up to date');
			refreshActivity();
			say('Activity refreshed. 1 new event.');
			setTimeout(() => setButton(log.refresh, 'idle'), 1400);
		});
	}

	/**
	 * Applies the service and problems-only filters. The pager reads
	 * settings.total each time it counts pages, so a later change edits it
	 * there, returns to page one and fires a size change to redraw.
	 */
	function refreshActivity() {
		const only = log.picker.value;
		log.shown = activity.filter(
			(entry) => (!only || entry.appId === only) && (!log.problemsOnly.checked || !entry.passed),
		);
		const nothing = !log.shown.length;
		log.empty.hidden = !nothing;
		log.pagerBox.hidden = nothing;
		if (nothing) {
			log.list.innerHTML = '';
			explainEmptyActivity(appById(only));
			return;
		}
		if (log.pager) {
			log.pagerSettings.total = log.shown.length;
			log.pager.set(1);
			pick('[data-basalt-pager-size]', log.pagerBox).dispatchEvent(new Event('change'));
			return;
		}
		log.pagerSettings = { total: log.shown.length, noun: 'events', render: paintActivityPage };
		log.pager = window.Basalt.pager(log.pagerBox, log.pagerSettings);
	}

	function explainEmptyActivity(app) {
		const problems = log.problemsOnly.checked;
		pick('[data-itg-feed-empty-title]', log.empty).textContent = problems ? 'No problems to show' : 'Nothing yet';
		let text;
		if (problems) text = `Everything ${app ? app.name : 'your apps'} sent or received went through.`;
		else if (app) text = `${app.name} has not sent or received anything today.`;
		else text = 'Activity shows here as soon as an app syncs.';
		pick('.basalt-empty-text', log.empty).textContent = text;
	}

	/** Pager callback: draws entries first to last, counted from 1. */
	function paintActivityPage(first, last) {
		log.list.innerHTML = log.shown
			.slice(first - 1, last)
			.map(eventMarkup)
			.join('');
		log.list.removeAttribute('aria-busy');
	}

	function placeholderActivity() {
		log.list.setAttribute('aria-busy', 'true');
		log.list.innerHTML = Array.from(
			{ length: 6 },
			(_, slot) =>
				`<li class="itg-event itg-event-ghost" aria-hidden="true"><span class="basalt-skeleton basalt-skeleton-circle"></span><div class="itg-event-body"><span class="basalt-skeleton basalt-skeleton-text" style="width:${60 + ((slot * 7) % 30)}%"></span><span class="basalt-skeleton basalt-skeleton-text basalt-skeleton-sm" style="width:30%"></span></div></li>`,
		).join('');
	}

	/** Rebuilds the service menu, keeping the choice while it is still linked. */
	function fillAppPicker() {
		const previous = log.picker.value;
		const linked = linkedApps();
		log.picker.innerHTML = `<option value="">Every app</option>${linked.map((app) => `<option value="${app.id}">${htmlSafe(app.name)}</option>`).join('')}`;
		log.picker.value = linked.some((app) => app.id === previous) ? previous : '';
		window.Basalt.select?.refresh?.(log.picker);
	}

	/* Services to add */

	function wireShelf() {
		shelf.search.addEventListener('input', drawTiles);
		pick('[data-itg-tiles-reset]', shell).addEventListener('click', () => {
			shelf.search.value = '';
			drawTiles();
			shelf.search.focus();
		});
	}

	function unlinkedApps() {
		return CATALOG.filter((app) => !app.linked);
	}

	/** Builds the category tabs once, then keeps their counts current. */
	function drawCategoryTabs() {
		const offered = unlinkedApps();
		const categories = [['all', 'All'], ...Object.entries(CATEGORY_NAMES)];
		const strip = shelf.tabs.closest('.basalt-tabs');
		if (!shelf.tabs.children.length) {
			shelf.tabs.innerHTML = categories
				.map(
					([key, label]) =>
						`<input type="radio" class="btn-check" name="itg-cat" id="itg-cat-${key}" value="${key}"${key === shelf.category ? ' checked' : ''}><label class="nav-link" for="itg-cat-${key}">${htmlSafe(label)} <span class="basalt-tabs-count" data-itg-cat-n="${key}"></span></label>`,
				)
				.join('');
			for (const option of pickAll('input[name="itg-cat"]', shelf.tabs)) {
				option.addEventListener('change', () => {
					shelf.category = option.value;
					drawTiles();
				});
			}
		}
		for (const [key] of categories) {
			const count = key === 'all' ? offered.length : offered.filter((app) => app.category === key).length;
			pick(`[data-itg-cat-n="${key}"]`, shelf.tabs).textContent = count;
		}
		if (!strip) return;
		if (strip.basaltTabs) strip.basaltTabs.refresh();
		else window.Basalt.tabs?.(strip);
	}

	function drawTiles() {
		const typed = shelf.search.value.trim();
		const query = typed.toLowerCase();
		const offered = unlinkedApps();
		const visible = offered.filter(
			(app) =>
				(shelf.category === 'all' || app.category === shelf.category) &&
				(!query || `${app.name} ${app.blurb} ${CATEGORY_NAMES[app.category]}`.toLowerCase().includes(query)),
		);
		shelf.total.textContent = `${offered.length} apps to add`;
		shelf.tiles.innerHTML = visible.map(tileMarkup).join('');
		shelf.empty.hidden = visible.length > 0;
		shelf.count.textContent = `${visible.length}${visible.length === 1 ? ' app' : ' apps'}${query ? ` match “${typed}”` : ''}`;
		if (!visible.length) {
			pick('[data-itg-tiles-empty-title]', shelf.empty).textContent = query
				? `No apps match “${typed}”`
				: 'Everything here is connected';
		}
	}

	function tileMarkup(app) {
		const tag = app.featured ? '<span class="basalt-status basalt-status-primary itg-tile-tag">Popular</span>' : '';
		return (
			`<li class="itg-tile"><div class="itg-tile-head">${logoMarkup(app)}<div class="itg-tile-who"><h3 class="itg-tile-name">${htmlSafe(app.name)}</h3><p class="itg-tile-cat">${htmlSafe(CATEGORY_NAMES[app.category])}</p></div>${tag}</div>` +
			`<p class="itg-tile-desc">${htmlSafe(app.blurb)}</p>` +
			`<div class="itg-tile-foot"><button type="button" class="btn btn-sm btn-outline-secondary" data-itg-connect="${app.id}"><i class="bi bi-plug me-1" aria-hidden="true"></i>Connect<span class="visually-hidden"> ${htmlSafe(app.name)}</span></button></div></li>`
		);
	}

	/* Linking a new service */

	function wireConnectDialog() {
		linking.dialog.addEventListener('hidden.bs.modal', () => {
			if (linking.origin && document.body.contains(linking.origin)) linking.origin.focus();
			else pick('[data-itg-cat-search]', shell).focus();
		});
		linking.form.addEventListener('basalt:steps-done', finishLinking);
	}

	function openConnectDialog(app, origin) {
		linking.app = app;
		linking.origin = origin;
		linking.form.basaltSteps?.reset();
		window.Basalt.dialog?.clearDone(linking.form);
		linking.error.hidden = true;
		setButton(linking.finish, 'idle');
		const name = htmlSafe(app.name);
		const rights = ACCESS_RIGHTS[app.category]
			.map((right) => `<li><i class="bi bi-check2-circle" aria-hidden="true"></i>${htmlSafe(right)}</li>`)
			.join('');
		const fills = {
			logo: htmlSafe(app.initials),
			title: `Connect ${name}`,
			sub: htmlSafe(app.blurb),
			name,
			finish: `Connect ${name}`,
			doneTitle: `${name} is connected`,
			perms: `${rights}<li class="is-never"><i class="bi bi-shield-lock" aria-hidden="true"></i>It never sees card numbers or staff passwords</li>`,
		};
		for (const [key, html] of Object.entries(fills)) {
			linkField(key).innerHTML = html;
		}
		linkField('logo').className = `itg-logo itg-logo-lg itg-tone-${app.color}`;
		pick('#itg-connect-account').value = 'ops@fieldline.app';
		bootstrap.Modal.getOrCreateInstance(linking.dialog).show();
	}

	function linkField(key) {
		return pick(`[data-itg-c="${key}"]`, linking.form);
	}

	/**
	 * Runs when the dialog's last step is confirmed. DHL Express turns the
	 * first attempt down; otherwise the service is linked and starts a
	 * first sync that completes a few seconds later.
	 */
	async function finishLinking() {
		const app = linking.app;
		if (!app) return;
		linking.error.hidden = true;
		setButton(linking.finish, 'loading', 'Connecting');
		await wait(1300);
		if (app.unreliable && !app.attempted) {
			app.attempted = true;
			linkField('errTitle').textContent = `${app.name} did not answer`;
			linking.error.hidden = false;
			setButton(linking.finish, 'error', 'Try again');
			setTimeout(() => {
				setButton(linking.finish, 'idle');
				linkField('finish').textContent = 'Try again';
			}, 1400);
			say(`${app.name} did not answer. Nothing was changed.`);
			return;
		}
		const fields = linking.form.elements;
		const cadence = (fields.every.value || '').toLowerCase();
		Object.assign(app, {
			linked: true,
			state: 'syncing',
			percent: 0,
			mailbox: fields.account.value.trim(),
			joined: 'today',
			minutesAgo: 0,
			role: CATEGORY_NAMES[app.category],
			cadence: cadenceKey(cadence),
			successRate: 100,
		});
		setButton(linking.finish, 'idle');
		window.Basalt.dialog.done(
			linking.form,
			`The first sync has started, bringing in ${fields.history.value} days of past records. It shows under your connected apps.`,
		);
		redrawAll();
		setTimeout(
			() => {
				if (!app.linked || app.state !== 'syncing') return;
				app.state = 'ok';
				app.percent = 100;
				redrawAll();
				notify({
					tone: 'success',
					title: `${app.name} is up to date`,
					text: `Past records are in, and new ones will follow ${CADENCE_TEXT[app.cadence].toLowerCase()}.`,
					duration: 5000,
				});
			},
			prefersCalm() ? 2500 : 6000,
		);
		linking.origin = pick(`[data-itg-app="${app.id}"] [data-itg-open]`, shell);
	}

	/** Maps the dialog's frequency wording onto a CADENCE_TEXT key. */
	function cadenceKey(wording) {
		if (wording.includes('15')) return '15';
		if (wording.includes('hour')) return '60';
		return 'live';
	}

	/* Asking for a service that is not listed */

	function wireRequestDialog() {
		asking.dialog.addEventListener('shown.bs.modal', () => pick('#itg-request-name').focus());
		asking.dialog.addEventListener('hidden.bs.modal', () => {
			if (asking.origin && document.body.contains(asking.origin)) asking.origin.focus();
		});
		asking.form.addEventListener('submit', async (event) => {
			event.preventDefault();
			const nameField = pick('#itg-request-name');
			const missing = window.Basalt.dialog.flagFields([nameField]);
			if (missing) {
				missing.focus();
				return;
			}
			const send = pick('button[type="submit"]', asking.form);
			setButton(send, 'loading', 'Sending');
			await wait(900);
			setButton(send, 'idle');
			window.Basalt.dialog.done(
				asking.form,
				`Thanks. We will email ops@fieldline.app when ${nameField.value.trim()} is ready to connect.`,
			);
		});
	}

	/** Opens the request form, starting it with whatever was searched for. */
	function openRequestDialog(origin) {
		asking.origin = origin;
		asking.form.reset();
		if (window.Basalt.dialog) {
			window.Basalt.dialog.clearDone(asking.form);
			window.Basalt.dialog.clearFlags(asking.form);
		}
		const typed = shelf.search.value.trim();
		if (typed) pick('#itg-request-name').value = typed.charAt(0).toUpperCase() + typed.slice(1);
		bootstrap.Modal.getOrCreateInstance(asking.dialog).show();
	}

	/* Quick-view side panel */

	function wirePanel() {
		/* recordNav takes a count; this one is read on every use, so the
       steps keep up as services are linked and unlinked. */
		const recordCount = {
			valueOf: () => Math.max(1, panel.order.length),
			toString: () => String(Math.max(1, panel.order.length)),
		};
		panel.stepper = window.Basalt.drawer?.recordNav
			? window.Basalt.drawer.recordNav(panel.root, recordCount, (index) =>
					showInPanel(appById(panel.order[index])),
				)
			: null;

		panel.retry.addEventListener('basalt:retry', retryHistory);
		/* Toasts usually sit bottom right, under the panel's own buttons, so
       they move to the center while the panel is open. */
		panel.root.addEventListener('show.bs.offcanvas', () => notices?.position('bottom-center'));
		panel.root.addEventListener('shown.bs.offcanvas', () => panel.tabs.basaltTabs?.refresh());
		panel.root.addEventListener('hidden.bs.offcanvas', panelClosed);
		pick('[data-itg-settings]', panel.root).addEventListener('submit', saveSettings);
		panel.pause.addEventListener('click', () => {
			const app = panel.app;
			if (app) setPaused(app, app.state !== 'paused');
		});
	}

	function openPanel(id, tab, origin) {
		panel.order = linkedApps().map((app) => app.id);
		const index = panel.order.indexOf(id);
		if (index < 0) return;
		panel.origin = origin || null;
		if (panel.stepper) panel.stepper.go(index, 0);
		else showInPanel(appById(id));
		selectPanelTab(tab || 'overview');
		bootstrap.Offcanvas.getOrCreateInstance(panel.root).show();
	}

	function selectPanelTab(name) {
		const trigger = pick(`#itg-tab-${name}-tab`);
		if (trigger && window.bootstrap) bootstrap.Tab.getOrCreateInstance(trigger).show();
	}

	/**
	 * After closing, a queued disconnect opens its dialog; otherwise focus
	 * returns to whatever opened the panel, or to the service's row.
	 */
	function panelClosed() {
		notices?.position('bottom-end');
		if (panel.queuedRemoval) {
			const app = panel.queuedRemoval;
			panel.queuedRemoval = null;
			confirmDisconnect(app);
			return;
		}
		const rowButton = panel.app && pick(`[data-itg-app="${panel.app.id}"] [data-itg-open]`, shell);
		if (panel.origin && document.body.contains(panel.origin)) panel.origin.focus();
		else if (rowButton) rowButton.focus();
	}

	function panelText(key, text) {
		const slot = pick(`[data-itg-d="${key}"]`, panel.root);
		if (slot) slot.textContent = text;
	}

	function showInPanel(app) {
		if (!app) return;
		panel.app = app;
		const logo = pick('[data-itg-d="logo"]', panel.root);
		logo.textContent = app.initials;
		logo.className = `itg-logo itg-logo-lg itg-tone-${app.color}`;
		panelText('name', app.name);
		panelText('cat', app.role);
		pick('[data-itg-d="full"]', panel.root).href = `connection-details.html?id=${encodeURIComponent(app.id)}`;
		pick('[data-itg-d="status"]', panel.root).innerHTML =
			`${badgeMarkup(app)}<span class="itg-drawer-when">${htmlSafe(stateLine(app))}</span>`;

		const ring = pick('[data-itg-d="ring"]', panel.root);
		ring.style.strokeDashoffset = String(100 - app.successRate);
		ring.closest('svg').classList.toggle('is-low', app.successRate < 97);
		panelText('rate', `${app.successRate.toFixed(1)}%`);
		panelText('account', app.mailbox);
		panelText('since', app.joined === 'today' ? 'Today' : app.joined);
		panelText(
			'last',
			app.state === 'paused'
				? 'Paused'
				: sinceText(app.minutesAgo).replace(/^./, (letter) => letter.toUpperCase()),
		);
		panelText('every', CADENCE_TEXT[app.cadence]);
		pick('[data-itg-d="scopes"]', panel.root).innerHTML = ACCESS_RIGHTS[app.category]
			.map((right) => `<li><i class="bi bi-check2" aria-hidden="true"></i>${htmlSafe(right)}</li>`)
			.join('');
		pick('[data-itg-d="hook"]', panel.root).value =
			`https://api.fieldline.app/hooks/${app.id}/${app.initials.toLowerCase()}7f3c${app.color}e9`;

		pick('#itg-set-two-way').checked = app.category === 'books' || app.category === 'selling';
		pick('#itg-set-alert').checked = !!app.essential || app.state === 'failing';
		pick('#itg-set-every').value = app.cadence;
		pick('#itg-set-retries').value = app.essential ? 5 : 3;

		const paused = app.state === 'paused';
		panel.pause.setAttribute('aria-pressed', String(paused));
		pick('i', panel.pause).className = `bi ${paused ? 'bi-play-circle' : 'bi-pause-circle'} me-1`;
		pick('span', panel.pause).textContent = paused ? 'Resume syncing' : 'Pause syncing';

		/* Shippo's history refuses to load until a retry gets through. */
		const unreachable = app.state === 'failing' && !app.historyReady;
		panel.retry.hidden = !unreachable;
		if (unreachable) {
			pick('[data-itg-d="errTitle"]', panel.root).textContent = `We couldn’t reach ${app.name}`;
			pick('[data-itg-d="errText"]', panel.root).textContent =
				`${app.name} did not answer in time, so its recent history could not load. Nothing was lost.`;
			panel.retry.basaltRetryReset?.();
		}
		paintPanelHistory(app, unreachable);
	}

	function paintPanelHistory(app, hidden) {
		const recent = activity.filter((entry) => entry.appId === app.id).slice(0, 8);
		panel.history.hidden = hidden;
		panel.history.innerHTML = recent.length
			? recent.map(eventMarkup).join('')
			: '<li class="itg-event itg-event-none"><div class="itg-event-body"><p class="itg-event-text">Nothing sent or received yet today.</p></div></li>';
	}

	/** The first retry fails on purpose; the second loads the history. */
	function retryHistory(event) {
		const app = panel.app;
		setTimeout(
			() => {
				if (event.detail.attempt < 2) {
					event.detail.done(false);
					return;
				}
				event.detail.done(true);
				app.historyReady = true;
				panel.retry.hidden = true;
				paintPanelHistory(app, false);
				say(`${app.name} history loaded.`);
				const newest = pick('.itg-event', panel.history);
				if (newest) {
					newest.setAttribute('tabindex', '-1');
					newest.focus();
				}
			},
			prefersCalm() ? 200 : 900,
		);
	}

	async function saveSettings(event) {
		event.preventDefault();
		const app = panel.app;
		const button = pick('[data-itg-save]', panel.root);
		setButton(button, 'loading', 'Saving');
		await wait(800);
		app.cadence = pick('#itg-set-every').value;
		setButton(button, 'success', 'Saved');
		panelText('every', CADENCE_TEXT[app.cadence]);
		notify({
			tone: 'success',
			title: `Settings saved for ${app.name}`,
			text: `It now checks for changes ${CADENCE_TEXT[app.cadence].toLowerCase()}.`,
			duration: 4000,
		});
		setTimeout(() => setButton(button, 'idle'), 1400);
	}

	/* Unlinking
     The panel closes first; its hidden handler then opens the right
     dialog. Essential services ask for the name to be typed. */

	function wireDisconnect() {
		pick('[data-itg-d-disconnect]', panel.root).addEventListener('click', () => {
			panel.queuedRemoval = panel.app;
			bootstrap.Offcanvas.getOrCreateInstance(panel.root).hide();
		});
		pick('[data-itg-x-hold]', unlinking.holdDialog).addEventListener('basalt:confirm', () => {
			if (unlinking.app) disconnectApp(unlinking.app, unlinking.holdDialog);
		});
		pick('[data-itg-typed-go]', unlinking.typedDialog).addEventListener('click', () => {
			if (unlinking.app) disconnectApp(unlinking.app, unlinking.typedDialog);
		});
		for (const dialog of [unlinking.holdDialog, unlinking.typedDialog]) {
			dialog.addEventListener('hidden.bs.modal', () => {
				const app = unlinking.app;
				unlinking.app = null;
				const rowButton = app && pick(`[data-itg-app="${app.id}"] [data-itg-open]`, shell);
				(rowButton || appList.search).focus();
			});
		}
	}

	function confirmDisconnect(app) {
		unlinking.app = app;
		if (app.essential) {
			pick('[data-basalt-type-confirm]', unlinking.typedDialog).basaltTyped?.reset();
			bootstrap.Modal.getOrCreateInstance(unlinking.typedDialog).show();
			return;
		}
		const dialog = unlinking.holdDialog;
		pick('[data-itg-x="title"]', dialog).textContent = `Disconnect ${app.name}?`;
		pick('[data-itg-x="text"]', dialog).textContent =
			'It stops syncing straight away. Past records stay in Fieldline; nothing is deleted.';
		const loss = LOSS_LINES[app.category](app.name);
		pick('[data-itg-x="list"]', dialog).innerHTML =
			`<li><i class="bi bi-x-circle" aria-hidden="true"></i>${htmlSafe(loss)}</li><li><i class="bi bi-x-circle" aria-hidden="true"></i>Its settings and address for updates are removed</li>`;
		bootstrap.Modal.getOrCreateInstance(dialog).show();
	}

	/** Unlinks a service; the toast's undo puts back what it had. */
	function disconnectApp(app, dialog) {
		const kept = { state: app.state, joined: app.joined, mailbox: app.mailbox };
		app.linked = false;
		bootstrap.Modal.getOrCreateInstance(dialog).hide();
		redrawAll();
		notify({
			tone: 'success',
			icon: 'bi-plug',
			title: `${app.name} disconnected`,
			text: 'It is back under Add an app if you change your mind.',
			duration: 8000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						app.linked = true;
						Object.assign(app, kept);
						redrawAll();
						say(`${app.name} connected again`);
					},
				},
			],
		});
	}

	/* Small utilities */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function prefersCalm() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/** Resolves after ms, capped at 250 ms when reduced motion is on. */
	function wait(ms) {
		return new Promise((resolve) => setTimeout(resolve, prefersCalm() ? Math.min(ms, 250) : ms));
	}

	function htmlSafe(value) {
		return String(value).replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
	}

	function grouped(value) {
		return Number(value).toLocaleString('en-US');
	}

	function notify(options) {
		return notices ? notices.push(options) : null;
	}

	function say(message) {
		window.Basalt.announce?.(message);
	}

	function setButton(button, state, label) {
		window.Basalt.buttonState?.(button, state, label);
	}
})();
