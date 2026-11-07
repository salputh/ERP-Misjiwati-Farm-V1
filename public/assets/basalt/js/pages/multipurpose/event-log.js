/**
 * Event log screen (event-log.html). A seeded generator writes an hour of
 * lines from a field-service app, so each visit tells the same story. The
 * page clock starts at 14:32:10 and keeps running in real time; Follow live
 * stamps its new lines against it. Most controls are the shared basalt.js
 * widgets: styled selects, segmented controls, tabs, the pager, search
 * suggestions, toasts, the record drawer, hold to confirm, loading and copy
 * buttons, tooltips and the retry panel.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-slg-root]', document);
	if (!pageRoot) return;

	/* The clock is pinned so the demo data never shifts. A live install would
     read Date.now() here and pull its lines from a real log service. */
	const PINNED_START = new Date(2026, 8, 29, 14, 32, 10).getTime();
	const pageOpenedAt = Date.now();
	const MINUTE = 60000;
	const LOCALE = 'en-US';
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const HEX_DIGITS = '0123456789abcdef';
	const ENTITY = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	const CHART_FONT = "'Schibsted Grotesk', sans-serif";

	/* Each part of the app that writes lines, with the label and icon it shows. */
	const ORIGINS = Object.fromEntries(
		[
			['schedule', 'Schedule board', 'bi-kanban'],
			['mobile', 'Mobile sync', 'bi-phone'],
			['sms', 'SMS reminders', 'bi-chat-dots'],
			['invoicing', 'Invoices and payments', 'bi-credit-card'],
			['portal', 'Customer portal', 'bi-globe2'],
			['planner', 'Travel planner', 'bi-signpost-split'],
			['checkout', 'Web checkout', 'bi-cart3'],
			['email', 'Email', 'bi-envelope'],
		].map(([key, label, icon]) => [key, { label, icon }]),
	);

	/* Severity: its rank for filtering, its pill name and tone, and its chart series. */
	const SEVERITY = {
		debug: { rank: 0, name: 'Debug', tone: '', series: 'Debug' },
		info: { rank: 1, name: 'Info', tone: 'basalt-status-info', series: 'Info' },
		warn: { rank: 2, name: 'Warning', tone: 'basalt-status-warning', series: 'Warnings' },
		error: { rank: 3, name: 'Error', tone: 'basalt-status-danger', series: 'Errors' },
	};
	const CHART_STACK = ['error', 'warn', 'info', 'debug'];

	const STATE_LOOK = {
		open: { tone: 'basalt-status-primary', name: 'Open' },
		muted: { tone: '', name: 'Muted' },
		resolved: { tone: 'basalt-status-success', name: 'Resolved' },
	};

	const EMPTY_GROUP_COPY = {
		open: ['No open groups', 'Everything this hour is muted or resolved.'],
		muted: ['Nothing is muted', 'Mute a group when you know about it and want some quiet.'],
		resolved: ['Nothing resolved this hour', 'Mark a group resolved once the fix is live.'],
		all: ['No warnings or errors', 'A quiet hour.'],
	};

	const EXPORT_EXTENSION = { csv: 'csv', json: 'jsonl' };

	/* The names, devices and numbers the generated lines are made from. */
	const CLIENTS = [
		'Oakhaven Studio',
		'Northgate Analytics',
		'Highpoint Outfitters',
		'Larchwood Studios',
		'Brightline Photography',
		'Bluepeak Studios',
		'Lakeside Apparel',
		'Avocet Robotics',
		'Ironbridge Fintech',
		'Copperleaf Design',
		'Highpoint Data Works',
		'Harborline AI',
		'Evergreen Landscaping',
		'Polaris Running Co. Group',
		'Cornerstone Logistics',
	];
	const CREW = [
		'Lance Bishop',
		'Dana Whitfield',
		'Travis Yoder',
		'Keisha Merritt',
		'Gerald Pratt',
		'Pamela Roach',
		'Jamal Pearce',
		'Erin Kerr',
	];
	const APPS = ['iPhone app, v4.2', 'Android app, v4.2'];
	const ADDONS = [
		{ title: 'Team Lead Course', code: 'FL-TAB10', slug: 'team-lead-course' },
		{ title: 'Scheduler Course', code: 'FL-PH5', slug: 'scheduler-course' },
		{ title: 'Staff Onboarding', code: 'FL-GPS', slug: 'staff-onboarding' },
		{ title: 'Custom Form Build', code: 'FL-PRN', slug: 'custom-form-build' },
		{ title: 'Report Template', code: 'FL-SCN', slug: 'report-template' },
		{ title: 'Extra Phone Line', code: 'FL-CRD', slug: 'extra-phone-line' },
		{ title: 'Staff Profile Import', code: 'FL-MNT', slug: 'staff-profile-import' },
		{ title: 'Office Setup Call', code: 'FL-DCK', slug: 'office-setup-call' },
		{ title: 'Extra Storage, 10 GB', code: 'FL-BAT', slug: 'extra-storage-10-gb' },
	];
	const TIERS = ['Basic, 6 seats', 'Pro, 14 seats', 'Pro, 32 seats', 'Max, 85 seats'];
	const PROMOS = ['SPRINGTEAMS', 'TRIAL20', 'FIRSTSEAT', 'ANNUAL2FREE'];
	const SEARCHES = [
		'no key',
		'end of tenancy',
		'gate code',
		'family portrait',
		'annual hedge trim',
		'parking',
		'cat feed',
	];
	const AREAS = ['North', 'East', 'Downtown', 'Westside', 'Airport', 'Lakeshore'];
	const SLOTS = ['8–10 am', '10 am–12 pm', '12–2 pm', '2–4 pm', '4–6 pm'];
	const ZIP_CODES = ['97214', '98103', '94110', '10027', '60614', '78704', '02139'];
	const INBOX_PREFIXES = ['office', 'accounts', 'desk', 'ops'];
	const BOUNCE_REASONS = ['Mailbox full', 'Address does not exist'];
	const DECLINE_REASONS = ['Insufficient funds', 'Do not honor', 'Card reported lost'];
	const PORTAL_ENTRY = ['Reminder text', 'Invoice email', 'Booking page', 'Visit summary'];
	const WEBHOOK_EVENTS = ['charge.succeeded', 'charge.refunded', 'payout.paid'];

	/* One entry per kind of line. Warnings and errors are grouped by their key,
     which plays the part of the fingerprint a hosted log service computes;
     the keys also travel in error-details.html links, so they stay fixed. */
	const KINDS = {
		payTimeout: {
			level: 'error',
			origin: 'portal',
			title: 'Invoice payment timed out after 10 seconds',
			trace: 'GatewayTimeoutError: no reply from the payment gateway within 10000 ms\n    at chargeCard (payments/charge.js:88:13)\n    at async payInvoice (portal/pay-invoice.js:141:5)\n    at async handle (server/portal.js:57:3)',
			compose() {
				const client = anyOf(CLIENTS);
				const invoiceRef = nextInvoiceRef();
				const amount = dollars(rollInt(14500, 286000) / 100);
				const attempt = rollInt(1, 3);
				return {
					facts: [
						['Invoice', invoiceRef],
						['Amount', amount],
						['Customer', client],
						['Attempt', `${attempt} of 3`],
					],
				};
			},
		},
		label: {
			level: 'error',
			origin: 'planner',
			title: 'Could not plan a day: the visit address was not found on the map',
			trace: 'GeocodeError: map service says "street number not found"\n    at locate (planner/geocode.js:212:11)\n    at async planDay (planner/plan.js:64:7)\n    at async runQueue (jobs/queue.js:39:9)',
			compose() {
				const visitRef = nextVisitRef();
				const client = anyOf(CLIENTS);
				const zip = anyOf(ZIP_CODES);
				const area = anyOf(AREAS);
				return {
					facts: [
						['Visit', visitRef],
						['Customer', client],
						['ZIP code', zip],
						['Territory', area],
					],
				};
			},
		},
		renewal: {
			level: 'error',
			origin: 'invoicing',
			title: 'Plan renewal failed because the saved card has expired',
			trace: 'CardExpired: card expired 08/2026\n    at renew (billing/renew.js:97:15)\n    at async nightlyRenewals (jobs/renewals.js:22:5)',
			compose() {
				const client = anyOf(CLIENTS);
				const tier = anyOf(TIERS);
				const lastDigits = rollInt(1000, 9999);
				return {
					facts: [
						['Customer', client],
						['Plan', tier],
						['Card', `Visa ending ${lastDigits}`],
						['Next try', 'in 24 hours'],
					],
				};
			},
		},
		stockSync: {
			level: 'error',
			origin: 'mobile',
			title: 'Offline changes from a team member’s phone failed to sync',
			trace: 'SyncError: sync server replied 502 Bad Gateway\n    at pushChanges (mobile/sync.js:58:9)\n    at async syncDevice (mobile/sync.js:21:3)\n    at async onReconnect (mobile/connection.js:14:5)',
			compose() {
				const member = anyOf(CREW);
				const app = anyOf(APPS);
				const queued = rollInt(3, 24);
				return {
					facts: [
						['Team member', member],
						['App', app],
						['Waiting', `${queued} changes`],
						['Reply', '502 Bad Gateway'],
					],
				};
			},
		},
		bounce: {
			level: 'error',
			origin: 'email',
			title: 'Invoice email bounced',
			trace: 'BounceNotice: 550 5.1.1 recipient rejected\n    at onBounce (email/webhooks.js:44:13)\n    at async receive (server/email.js:18:3)',
			compose() {
				const client = anyOf(CLIENTS);
				const invoiceRef = nextInvoiceRef();
				const inbox = maskedInbox(client);
				const reason = anyOf(BOUNCE_REASONS);
				return {
					facts: [
						['Invoice', invoiceRef],
						['Customer', client],
						['Sent to', inbox],
						['Reason', reason],
					],
				};
			},
		},
		noPrice: {
			level: 'error',
			origin: 'checkout',
			title: 'Checkout page failed: one of its options has no price',
			trace: "TypeError: Cannot read properties of undefined (reading 'amount')\n    at priceLabel (extras/product.js:131:28)\n    at renderOptions (extras/product.js:88:12)\n    at async productPage (server/extras.js:73:5)",
			compose() {
				const addon = anyOf(ADDONS.slice(0, 5));
				return {
					facts: [
						['Product', addon.title],
						['Option', '2 places, recorded'],
						['Page', `/extras/${addon.slug}`],
					],
				};
			},
		},
		expiredCode: {
			level: 'warn',
			origin: 'checkout',
			title: 'Customer tried a discount code that has expired',
			compose() {
				const promo = anyOf(PROMOS);
				const cart = dollars(rollInt(4900, 64900) / 100);
				const client = anyOf(CLIENTS);
				return {
					facts: [
						['Code', promo],
						['Cart', cart],
						['Customer', client],
					],
				};
			},
		},
		noImage: {
			level: 'warn',
			origin: 'portal',
			title: 'Company logo not found on the customer portal',
			compose() {
				const handle = anyOf(CLIENTS)
					.toLowerCase()
					.replace(/[^a-z]+/g, '-');
				const version = rollInt(1, 3);
				return {
					facts: [
						['File', `${handle}-logo-${version}.png`],
						['Page', `/portal/${handle}`],
					],
				};
			},
		},
		slowSearch: {
			level: 'warn',
			origin: 'schedule',
			title: 'Visit search on the schedule board took longer than 2 seconds',
			compose() {
				const term = anyOf(SEARCHES);
				const seconds = (rollInt(21, 48) / 10).toFixed(1);
				return {
					facts: [
						['Searched for', `"${term}"`],
						['Took', `${seconds} s`],
					],
				};
			},
		},
		declined: {
			level: 'warn',
			origin: 'invoicing',
			title: "Card declined by the customer's bank",
			compose() {
				const invoiceRef = nextInvoiceRef();
				const client = anyOf(CLIENTS);
				const reason = anyOf(DECLINE_REASONS);
				return {
					facts: [
						['Invoice', invoiceRef],
						['Customer', client],
						['Reason', reason],
					],
				};
			},
		},
		lowStock: {
			level: 'warn',
			origin: 'sms',
			title: 'An account is running low on SMS credits',
			compose() {
				const client = anyOf(CLIENTS);
				const credits = rollInt(30, 90);
				const daily = rollInt(40, 120);
				return {
					facts: [
						['Customer', client],
						['Left', `${credits} credits`],
						['Sends', `${daily} a day`],
					],
				};
			},
		},
		paid: {
			level: 'info',
			origin: 'invoicing',
			compose() {
				const invoiceRef = nextInvoiceRef();
				const amount = dollars(rollInt(9500, 412000) / 100);
				const client = anyOf(CLIENTS);
				return {
					text: `Invoice ${invoiceRef} paid`,
					facts: [
						['Invoice', invoiceRef],
						['Amount', amount],
						['Customer', client],
					],
				};
			},
		},
		renewed: {
			level: 'info',
			origin: 'invoicing',
			compose() {
				const client = anyOf(CLIENTS);
				const tier = anyOf(TIERS);
				return {
					text: `Plan renewed for ${client}`,
					facts: [
						['Customer', client],
						['Plan', tier],
					],
				};
			},
		},
		printed: {
			level: 'info',
			origin: 'sms',
			compose() {
				const visitRef = nextVisitRef();
				const slot = anyOf(SLOTS);
				return {
					text: `Reminder text sent for visit ${visitRef}`,
					facts: [
						['Visit', visitRef],
						['Window', slot],
					],
				};
			},
		},
		stocked: {
			level: 'info',
			origin: 'mobile',
			compose() {
				const member = anyOf(CREW);
				const changes = rollInt(2, 18);
				const app = anyOf(APPS);
				const offline = rollInt(1, 40);
				return {
					text: `Synced ${changes} changes from ${member}`,
					facts: [
						['App', app],
						['Waited', `${offline} min offline`],
					],
				};
			},
		},
		signup: {
			level: 'info',
			origin: 'portal',
			compose() {
				const client = anyOf(CLIENTS);
				const via = anyOf(PORTAL_ENTRY);
				return {
					text: `New portal login for a client of ${client}`,
					facts: [
						['Customer', client],
						['Came from', via],
					],
				};
			},
		},
		shippedMail: {
			level: 'info',
			origin: 'email',
			compose() {
				const visitRef = nextVisitRef();
				return { text: `Visit summary emailed for visit ${visitRef}`, facts: [['Visit', visitRef]] };
			},
		},
		cache: {
			level: 'debug',
			origin: 'checkout',
			compose() {
				const addon = anyOf(ADDONS);
				const took = rollInt(3, 18);
				return { text: `Page served from cache: /extras/${addon.slug}`, facts: [['Took', `${took} ms`]] };
			},
		},
		hook: {
			level: 'debug',
			origin: 'invoicing',
			compose() {
				const event = anyOf(WEBHOOK_EVENTS);
				const took = rollInt(8, 60);
				return { text: `Webhook received: ${event}`, facts: [['Took', `${took} ms`]] };
			},
		},
		cart: {
			level: 'debug',
			origin: 'checkout',
			compose() {
				const items = rollInt(1, 5);
				const total = dollars(rollInt(3900, 129800) / 100);
				const client = anyOf(CLIENTS);
				return {
					text: `Cart recalculated: ${items}${items === 1 ? ' item, ' : ' items, '}${total}`,
					facts: [['Customer', client]],
				};
			},
		},
		query: {
			level: 'debug',
			origin: 'schedule',
			compose() {
				const term = anyOf(SEARCHES);
				const found = rollInt(0, 14);
				const took = rollInt(40, 400);
				return { text: `Visit search for "${term}" found ${found} visits`, facts: [['Took', `${took} ms`]] };
			},
		},
		rates: {
			level: 'debug',
			origin: 'planner',
			compose() {
				const took = rollInt(140, 620);
				const area = anyOf(AREAS);
				const stops = rollInt(4, 11);
				return {
					text: `Day planned in ${took} ms`,
					facts: [
						['Territory', area],
						['Stops', String(stops)],
					],
				};
			},
		},
	};

	const TRACKED_KINDS = Object.keys(KINDS).filter((key) => SEVERITY[KINDS[key].level].rank >= 2);
	const SUGGESTED_INFO = ['Plan renewed', 'Reminder text sent', 'Page served from cache'];

	/* Generator state. The hour is written from one seed; once it is done the
     stream switches to a second seed that live lines draw from. */
	let random = mulberry(20260929);
	let visitCounter = 18240;
	let invoiceCounter = 30715;
	let lineSerial = 0;
	let lines = [];
	let olderLines = null;
	let olderLoaded = false;
	let olderAttempts = 0;
	let clearedDebug = null;

	/* Groups start open, apart from the logo warning, muted until 15:10, and the
     price bug, already resolved. */
	const groupState = Object.fromEntries(TRACKED_KINDS.map((key) => [key, { status: 'open', until: 0 }]));
	groupState.noImage = { status: 'muted', until: PINNED_START + 38 * MINUTE };
	groupState.noPrice = { status: 'resolved', until: 0 };

	/* What the visitor has narrowed the log down to. */
	const view = { search: '', floor: 'debug', origins: [], span: 60, minute: null, kind: null, foldRepeats: true };

	const ui = {
		stream: pick('#slg-stream'),
		list: pick('[data-slg-list]'),
		headRow: pick('.slg-head-row'),
		empty: pick('[data-slg-empty]'),
		emptyText: pick('[data-slg-empty-text]'),
		failure: pick('[data-slg-error]'),
		pager: pick('[data-slg-pager]'),
		perPage: pick('[data-slg-per]'),
		rangeText: pick('[data-slg-range-text]'),
		fresh: pick('[data-slg-fresh]'),
		freshLabel: pick('[data-slg-fresh-label]'),
		eventCount: pick('[data-slg-count="events"]'),
		search: pick('[data-slg-q]'),
		floor: pick('[data-slg-level]'),
		origins: pick('[data-slg-sources]'),
		fold: pick('[data-slg-fold]'),
		span: pick('[data-slg-range]'),
		appliedRow: pick('[data-slg-applied-row]'),
		applied: pick('[data-slg-applied]'),
		groups: pick('[data-slg-groups]'),
		groupsEmpty: pick('[data-slg-gempty]'),
		groupCount: pick('[data-slg-count="groups"]'),
		groupFigure: pick('[data-slg-fig="groups"]'),
		groupSummary: pick('[data-slg-gsummary]'),
		drawer: pick('[data-slg-drawer]'),
		originList: pick('[data-slg-source-list]'),
		chart: pick('[data-slg-chart]'),
		spikes: pick('[data-slg-spikes]'),
		live: pick('[data-slg-live]'),
		keepForm: pick('[data-slg-keep]'),
		keepDays: pick('[data-slg-keep-days]'),
		keepSave: pick('[data-slg-keep-save]'),
		alertLevel: pick('[data-slg-keep-alert]'),
		alertNote: pick('[data-slg-alert-note]'),
		clearDebug: pick('[data-slg-clear-debug]'),
		debugNote: pick('[data-slg-debug-note]'),
	};
	const drawerPane = pick('[data-slg-d="body"]', ui.drawer);

	/* Paging and the list's own state. */
	let pagination = null;
	let rowsPerPage = parseInt(ui.perPage.value, 10) || 25;
	let pageNumber = 1;
	let folded = [];
	let unseen = 0;
	let quietPaging = false;
	let settled = false;
	let typingTimer = 0;
	const openIds = new Set();

	let groupFilter = 'open';
	let drawerOrder = [];
	let drawerKind = null;
	let drawerNav = null;
	let chart = null;
	let followTimer = 0;

	/** Seeds the data, wires every control and paints the first frame. */
	function start() {
		lines = seedLastHour();
		random = mulberry(77);

		pagination = window.Basalt.pagination(pick('[data-slg-pages]'), {
			total: 1,
			current: 1,
			label: 'Page',
			onChange: onPageChange,
		});
		fillOriginOptions();
		pick('[data-slg-suggest]').innerHTML = suggestionMarkup();

		wireList();
		wireToolbar();
		wireArchive();
		wireGroups();
		wireDrawer();
		wireOrigins();
		wireChart();
		wireFollow();
		wireExport();
		wireHousekeeping();

		showLoading();
		renderGroups();
		renderOrigins();
		renderBusyMinutes();
		renderFigures();
		renderAlertPreview();
		renderDebugNote();
		/* The hero figures count up and the busy minutes rise in, once. */
		window.Basalt.countUp?.(pickAll('[data-slg-fig]'));
		playOnSight(ui.spikes);
		setTimeout(
			() => {
				settled = true;
				rebuildList(true);
				window.Basalt.countUp?.([ui.eventCount]);
				playOnSight(ui.list);
			},
			prefersStill() ? 250 : 650,
		);

		/* With Follow live off, the figures and mute timers still need a nudge now and then. */
		setInterval(() => {
			if (document.hidden || ui.live.getAttribute('aria-pressed') === 'true') return;
			renderFigures();
			renderGroups();
		}, 30000);
	}

	/* Small helpers the rest of the file leans on. */

	function pick(selector, scope = pageRoot) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = pageRoot) {
		return [...scope.querySelectorAll(selector)];
	}

	function prefersStill() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/**
	 * The first time a list is on screen its rows rise in one after another;
	 * whatever is drawn into it later appears as it is.
	 * @param {HTMLElement} list
	 */
	function playOnSight(list) {
		if (prefersStill() || !('IntersectionObserver' in window)) return;
		list.classList.add('is-waiting');
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				list.classList.replace('is-waiting', 'is-drawing');
				const runs = list.getAnimations({ subtree: true }).filter((run) => run.animationName === 'slg-rise');
				Promise.allSettled(runs.map((run) => run.finished)).then(() => list.classList.remove('is-drawing'));
			},
			{ threshold: 0.1 },
		);
		watch.observe(list);
	}

	function say(message) {
		window.Basalt.announce?.(message);
	}

	function notify(options) {
		const toasts = window.Basalt.toasts;
		return toasts ? toasts.push(options) : null;
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (char) => ENTITY[char]);
	}

	function countOf(amount, singular, pluralForm) {
		return `${amount.toLocaleString(LOCALE)} ${amount === 1 ? singular : pluralForm || `${singular}s`}`;
	}

	function rankOf(level) {
		return SEVERITY[level].rank;
	}

	function newestFirst(a, b) {
		return b.at - a.at;
	}

	function refreshWidgets(scope) {
		window.Basalt.buttons?.(scope);
		window.Basalt.tips?.(scope);
	}

	function scrollToStream() {
		ui.stream.scrollIntoView({ behavior: prefersStill() ? 'auto' : 'smooth', block: 'start' });
	}

	function focusFirstRow(options) {
		pick('.slg-row-main', ui.list)?.focus(options);
	}

	/* Reading and formatting times on the demo clock. */

	function clockNow() {
		return PINNED_START + (Date.now() - pageOpenedAt);
	}

	function twoDigits(value) {
		return String(value).padStart(2, '0');
	}

	function stamp(time) {
		const moment = new Date(time);
		return `${twoDigits(moment.getHours())}:${twoDigits(moment.getMinutes())}:${twoDigits(moment.getSeconds())}`;
	}

	function hourMinute(time) {
		const moment = new Date(time);
		return `${twoDigits(moment.getHours())}:${twoDigits(moment.getMinutes())}`;
	}

	/** "Sep 29, 2026, 14:31:07.042": the full stamp an opened line shows. */
	function fullStamp(time) {
		const moment = new Date(time);
		const millis = String(moment.getMilliseconds()).padStart(3, '0');
		return `${MONTH_ABBR[moment.getMonth()]} ${moment.getDate()}, ${moment.getFullYear()}, ${stamp(time)}.${millis}`;
	}

	function dollars(amount) {
		return `$${amount.toFixed(2)}`;
	}

	/* The generator turns one seeded random stream into log lines. */

	/** A small seeded generator (mulberry32) returning numbers in [0, 1). */
	function mulberry(seed) {
		let state = seed >>> 0;
		return () => {
			state = (state + 0x6d2b79f5) >>> 0;
			let mixed = Math.imul(state ^ (state >>> 15), state | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	function anyOf(options) {
		return options[Math.floor(random() * options.length)];
	}

	function rollInt(low, high) {
		return low + Math.floor(random() * (high - low + 1));
	}

	function hexRun(length) {
		return Array.from({ length }, () => HEX_DIGITS[Math.floor(random() * 16)]).join('');
	}

	function nextVisitRef() {
		const ref = `#${visitCounter}`;
		visitCounter += 1;
		return ref;
	}

	function nextInvoiceRef() {
		const ref = `#${invoiceCounter}`;
		invoiceCounter += 1;
		return ref;
	}

	/** A half-hidden address such as "a•••@oakhavenstudio.com". */
	function maskedInbox(company) {
		const initial = anyOf(INBOX_PREFIXES)[0];
		return `${initial}•••@${company.toLowerCase().replace(/[^a-z]+/g, '')}.com`;
	}

	/* The payment gateway had a rough patch around 13:52 and mobile sync
     stumbled near 14:18; both minute windows count back from 14:32. */
	function inGatewayOutage(minutesAgo) {
		return minutesAgo >= 36 && minutesAgo <= 41;
	}

	function inSyncWobble(minutesAgo) {
		return minutesAgo >= 12 && minutesAgo <= 15;
	}

	/**
	 * How likely each kind of line is, a given number of minutes back. The
	 * checkout price bug was fixed at 14:05, so it stops 28 minutes ago.
	 */
	function frequencies(minutesAgo) {
		return {
			payTimeout: inGatewayOutage(minutesAgo) ? 26 : 0.25,
			label: 0.5,
			renewal: 0.35,
			stockSync: inSyncWobble(minutesAgo) ? 14 : 0.12,
			bounce: 0.25,
			noPrice: minutesAgo >= 28 ? 0.6 : 0,
			expiredCode: 0.8,
			noImage: 0.6,
			slowSearch: 0.5,
			declined: 0.9,
			lowStock: 0.35,
			paid: 5,
			renewed: 1.6,
			printed: 3,
			stocked: 1.5,
			signup: 1,
			shippedMail: 2.4,
			cache: 5.5,
			hook: 3,
			cart: 4,
			query: 3.2,
			rates: 2.4,
		};
	}

	function pickKind(weights) {
		const pairs = Object.entries(weights);
		let remaining = random() * pairs.reduce((total, [, weight]) => total + weight, 0);
		for (const [key, weight] of pairs) {
			remaining -= weight;
			if (remaining <= 0) return key;
		}
		return 'paid';
	}

	function makeLine(kindKey, at) {
		const spec = KINDS[kindKey];
		const { text = spec.title, facts } = spec.compose();
		return {
			id: ++lineSerial,
			at,
			level: spec.level,
			origin: spec.origin,
			kind: kindKey,
			text,
			facts,
			trace: spec.trace || '',
			request: `req_${hexRun(12)}`,
		};
	}

	function seedLastHour() {
		const made = [];
		for (let minutesAgo = 59; minutesAgo >= 0; minutesAgo -= 1) {
			const weights = frequencies(minutesAgo);
			const howMany = rollInt(6, 12) + (inGatewayOutage(minutesAgo) ? 8 : 0) + (inSyncWobble(minutesAgo) ? 5 : 0);
			for (let step = 0; step < howMany; step += 1) {
				const at = PINNED_START - minutesAgo * MINUTE - Math.floor(random() * MINUTE);
				made.push(makeLine(pickKind(weights), at));
			}
		}
		return made.sort(newestFirst);
	}

	/** The thinner day before the last hour, written only when someone asks for 24 hours. */
	function seedOlderDay() {
		random = mulberry(1402);
		const made = [];
		for (let minutesAgo = 1440; minutesAgo > 60; minutesAgo -= 5) {
			const weights = { ...frequencies(minutesAgo), noPrice: 0.6 };
			const howMany = rollInt(1, 4);
			for (let step = 0; step < howMany; step += 1) {
				const kindKey = pickKind(weights);
				made.push(makeLine(kindKey, PINNED_START - minutesAgo * MINUTE - Math.floor(random() * 5 * MINUTE)));
			}
		}
		random = mulberry(77);
		return made.sort(newestFirst);
	}

	/* Which lines the current filters let through, and how repeats fold. */

	function allLines() {
		return olderLoaded ? lines.concat(olderLines) : lines;
	}

	function visibleLines() {
		return allLines().filter((line) => admits(line));
	}

	function admits(line) {
		if (line.at < clockNow() - view.span * MINUTE) return false;
		if (rankOf(line.level) < rankOf(view.floor)) return false;
		if (view.origins.length && !view.origins.includes(line.origin)) return false;
		if (view.minute !== null && (line.at < view.minute || line.at >= view.minute + MINUTE)) return false;
		if (view.kind && line.kind !== view.kind) return false;
		if (!view.search) return true;
		const values = line.facts.map(([, value]) => value).join(' ');
		const haystack = `${line.text} ${ORIGINS[line.origin].label} ${line.request} ${values}`.toLowerCase();
		return haystack.includes(view.search.toLowerCase());
	}

	/**
	 * Back-to-back runs of one warning or error, each no more than two minutes
	 * after the last, collapse into a single entry that counts them.
	 */
	function collapseRuns(source) {
		if (!view.foldRepeats) return source.map((line) => ({ line, count: 1, since: line.at }));
		const collapsed = [];
		for (const line of source) {
			const previous = collapsed[collapsed.length - 1];
			const joins =
				previous &&
				rankOf(line.level) >= 2 &&
				previous.line.kind === line.kind &&
				previous.since - line.at <= 2 * MINUTE;
			if (joins) {
				previous.count += 1;
				previous.since = line.at;
			} else {
				collapsed.push({ line, count: 1, since: line.at });
			}
		}
		return collapsed;
	}

	/** Escapes the text and wraps every case-blind match of the search in <mark>. */
	function markMatches(text, needle) {
		const safe = htmlSafe(text);
		if (!needle) return safe;
		const target = htmlSafe(needle).toLowerCase();
		const lower = safe.toLowerCase();
		let html = '';
		let cursor = 0;
		for (let hit = lower.indexOf(target); hit >= 0 && target; hit = lower.indexOf(target, cursor)) {
			html += `${safe.slice(cursor, hit)}<mark>${safe.slice(hit, hit + target.length)}</mark>`;
			cursor = hit + target.length;
		}
		return html + safe.slice(cursor);
	}

	/* Markup pieces shared by the list, the groups and the drawer. */

	function levelBadge(level) {
		return `<span class="basalt-status basalt-status-dot slg-lvl ${SEVERITY[level].tone}">${SEVERITY[level].name}</span>`;
	}

	function stateBadge(status) {
		const look = STATE_LOOK[status];
		return `<span class="basalt-status ${look.tone}">${look.name}</span>`;
	}

	function factPair([term, value]) {
		return `<div><dt>${htmlSafe(term)}</dt><dd>${htmlSafe(value)}</dd></div>`;
	}

	function requestFact(request) {
		return [
			'<div><dt>Request ID</dt><dd class="slg-facts-req">',
			`<code>${request}</code>`,
			`<button data-basalt-copy="${request}" data-bs-title="Copy request ID" data-bs-toggle="tooltip" aria-label="Copy request ID" type="button" class="btn btn-icon btn-sm slg-copy"><i aria-hidden="true" class="bi bi-copy"></i></button>`,
			'</dd></div>',
		].join('');
	}

	/** The stack trace box; copyHook is the attribute its Copy button carries. */
	function traceBlock(trace, copyHook) {
		return [
			'<div class="slg-stack">',
			`<div class="slg-stack-head"><span>Stack trace</span><button ${copyHook} type="button" class="btn btn-sm btn-outline-secondary"><i aria-hidden="true" class="bi bi-copy me-1"></i>Copy</button></div>`,
			`<pre aria-label="Stack trace" tabindex="0" class="slg-stack-pre"><code>${htmlSafe(trace)}</code></pre>`,
			'</div>',
		].join('');
	}

	/* The log list draws one page of folded lines at a time. */

	function wireList() {
		ui.perPage.addEventListener('change', () => {
			const firstShown = (pageNumber - 1) * rowsPerPage;
			rowsPerPage = parseInt(ui.perPage.value, 10) || 25;
			pageNumber = Math.floor(firstShown / rowsPerPage) + 1;
			rebuildList(false);
		});
		ui.list.addEventListener('click', onListClick);
		ui.list.addEventListener('keydown', onListKey);
		ui.fresh.addEventListener('click', () => {
			openIds.clear();
			rebuildList(true);
			focusFirstRow();
		});
	}

	function onPageChange(next) {
		pageNumber = next;
		if (quietPaging) return;
		openIds.clear();
		drawList();
		if (ui.stream.getBoundingClientRect().top < 0) scrollToStream();
	}

	/** Re-filters, re-folds and redraws; a reset also returns to page one. */
	function rebuildList(resetPage) {
		folded = collapseRuns(visibleLines());
		if (resetPage) {
			pageNumber = 1;
			openIds.clear();
		}
		const pageTotal = Math.max(1, Math.ceil(folded.length / rowsPerPage));
		pageNumber = Math.min(pageNumber, pageTotal);
		quietPaging = true;
		pagination.setTotal(pageTotal);
		pagination.set(pageNumber);
		quietPaging = false;
		unseen = 0;
		ui.fresh.hidden = true;
		drawList();
		renderApplied();
		ui.eventCount.textContent = folded.length.toLocaleString(LOCALE);
	}

	function drawList(freshIds) {
		if (!settled) return;
		const offset = (pageNumber - 1) * rowsPerPage;
		const onPage = folded.slice(offset, offset + rowsPerPage);
		const failing = ui.failure && !ui.failure.hidden;
		const nothing = !folded.length;
		ui.list.hidden = failing || nothing;
		ui.headRow.hidden = ui.list.hidden;
		ui.empty.hidden = failing || !nothing;
		ui.pager.hidden = failing || nothing;
		ui.list.innerHTML = onPage.map((entry) => rowMarkup(entry, freshIds?.has(entry.line.id))).join('');
		ui.list.removeAttribute('aria-busy');
		if (nothing) {
			ui.emptyText.textContent = view.search
				? `Nothing in this time range mentions "${view.search}". Try a wider range or a shorter search.`
				: 'Try a wider time range or fewer filters.';
		} else {
			const from = (offset + 1).toLocaleString(LOCALE);
			const to = (offset + onPage.length).toLocaleString(LOCALE);
			ui.rangeText.innerHTML = `<strong>${from}–${to}</strong> of ${countOf(folded.length, 'line')}`;
		}
		refreshWidgets(ui.list);
	}

	function rowMarkup(entry, isFresh) {
		const { line, count: repeats } = entry;
		const origin = ORIGINS[line.origin];
		const panelId = `slg-d-${line.id}`;
		const opened = openIds.has(line.id);
		const summary = line.facts
			.slice(0, 2)
			.map(([, value]) => markMatches(value, view.search))
			.join(' · ');
		const repeat =
			repeats > 1
				? `<span title="Happened ${repeats} times in a row" class="slg-row-rep">×${repeats}<span class="visually-hidden"> times in a row</span></span>`
				: '<span aria-hidden="true" class="slg-row-rep slg-row-rep-none"></span>';
		return [
			`<li data-id="${line.id}" class="slg-row slg-row-${line.level}${opened ? ' is-open' : ''}${isFresh ? ' is-new' : ''}">`,
			`<button aria-controls="${panelId}" aria-expanded="${opened}" type="button" class="slg-row-main">`,
			`<time datetime="${new Date(line.at).toISOString()}" class="slg-row-time">${stamp(line.at)}</time>`,
			levelBadge(line.level),
			`<span class="slg-row-src"><i aria-hidden="true" class="bi ${origin.icon}"></i><span class="slg-row-src-name">${origin.label}</span></span>`,
			`<span class="slg-row-msg"><span class="slg-row-text">${markMatches(line.text, view.search)}</span><span class="slg-row-meta">${summary}</span></span>`,
			repeat,
			'<i aria-hidden="true" class="bi bi-chevron-down slg-row-chev"></i>',
			'</button>',
			`<div id="${panelId}"${opened ? '' : ' hidden'} class="slg-row-detail">${opened ? detailMarkup(entry) : ''}</div>`,
			'</li>',
		].join('');
	}

	function detailMarkup({ line, count: repeats, since }) {
		const facts = [['When', fullStamp(line.at)], ['Source', ORIGINS[line.origin].label], ...line.facts];
		const parts = ['<div class="slg-detail">'];
		if (repeats > 1) {
			parts.push(
				`<p class="slg-detail-note"><i aria-hidden="true" class="bi bi-layers"></i>Happened ${repeats} times in a row, from ${stamp(since)} to ${stamp(line.at)}. These are the details of the latest one.</p>`,
			);
		}
		parts.push(`<dl class="slg-facts">${facts.map(factPair).join('')}${requestFact(line.request)}</dl>`);
		if (line.trace) parts.push(traceBlock(line.trace, `data-slg-copy-stack="${line.id}"`));
		parts.push('<div class="slg-detail-actions">');
		if (rankOf(line.level) >= 2) {
			parts.push(
				`<button data-slg-only="${line.kind}" type="button" class="btn btn-sm btn-outline-secondary"><i aria-hidden="true" class="bi bi-funnel me-1"></i>Only this kind</button>`,
				`<button data-slg-group="${line.kind}" type="button" class="btn btn-sm btn-outline-secondary"><i aria-hidden="true" class="bi bi-collection me-1"></i>Open its group</button>`,
			);
		}
		parts.push(
			`<button data-slg-copy-json="${line.id}" type="button" class="btn btn-sm btn-outline-secondary"><i aria-hidden="true" class="bi bi-braces me-1"></i>Copy as JSON</button>`,
		);
		parts.push('</div></div>');
		return parts.join('');
	}

	/* A click in the list either opens a line or runs one of its buttons. */
	function onListClick(event) {
		const opener = event.target.closest('.slg-row-main');
		if (opener) {
			toggleRow(opener);
			return;
		}
		const only = event.target.closest('[data-slg-only]');
		if (only) {
			narrowToKind(only.getAttribute('data-slg-only'));
			return;
		}
		const group = event.target.closest('[data-slg-group]');
		if (group) {
			openGroup(group.getAttribute('data-slg-group'));
			return;
		}
		const asJson = event.target.closest('[data-slg-copy-json]');
		if (asJson) {
			const line = lineById(asJson.getAttribute('data-slg-copy-json'));
			copyText(JSON.stringify(toRecord(line), null, 2), 'Event copied as JSON');
			return;
		}
		const stack = event.target.closest('[data-slg-copy-stack]');
		if (stack) copyText(lineById(stack.getAttribute('data-slg-copy-stack')).trace, 'Stack trace copied');
	}

	function toggleRow(opener) {
		const row = opener.closest('.slg-row');
		const id = Number(row.getAttribute('data-id'));
		const panel = pick('.slg-row-detail', row);
		const opening = opener.getAttribute('aria-expanded') !== 'true';
		const entry = folded.find((candidate) => candidate.line.id === id);
		if (opening && !entry) return;
		window.Basalt.slide(panel, () => {
			if (opening) {
				panel.innerHTML = detailMarkup(entry);
				openIds.add(id);
				refreshWidgets(panel);
			} else {
				openIds.delete(id);
			}
			panel.hidden = !opening;
		});
		row.classList.toggle('is-open', opening);
		opener.setAttribute('aria-expanded', String(opening));
		if (!opening && unseen) showUnseen();
	}

	function narrowToKind(kindKey) {
		view.kind = kindKey;
		if (rankOf(view.floor) > rankOf(KINDS[kindKey].level)) setFloor('debug');
		rebuildList(true);
		say(`Showing only "${KINDS[kindKey].title}". ${countOf(folded.length, 'line')}.`);
		focusFirstRow();
	}

	/* Arrow keys step between lines; Home and End jump to either end. */
	function onListKey(event) {
		const opener = event.target.closest('.slg-row-main');
		if (!opener) return;
		const openers = pickAll('.slg-row-main', ui.list);
		const index = openers.indexOf(opener);
		const destination = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: openers.length - 1 }[event.key];
		if (destination === undefined) return;
		event.preventDefault();
		openers[Math.max(0, Math.min(openers.length - 1, destination))]?.focus();
	}

	function lineById(rawId) {
		const id = Number(rawId);
		return allLines().find((line) => line.id === id);
	}

	function copyText(text, doneTitle) {
		const copying = window.Basalt.copyText ? window.Basalt.copyText(text) : Promise.reject();
		copying
			.then(() => notify({ tone: 'success', title: doneTitle, duration: 2500 }))
			.catch(() =>
				notify({
					tone: 'warning',
					title: 'Could not copy',
					text: 'Your browser blocked the clipboard. Select the text and copy it by hand.',
				}),
			);
	}

	/** One line as a flat record, the shape the JSON copy and export share. */
	function toRecord(line) {
		const record = {
			time: new Date(line.at).toISOString(),
			level: line.level,
			source: line.origin,
			message: line.text,
			request_id: line.request,
		};
		for (const [term, value] of line.facts) record[term.toLowerCase().replace(/[^a-z0-9]+/g, '_')] = value;
		if (line.trace) record.stack = line.trace;
		return record;
	}

	function showLoading() {
		ui.list.hidden = false;
		ui.headRow.hidden = false;
		ui.empty.hidden = true;
		ui.pager.hidden = true;
		ui.list.setAttribute('aria-busy', 'true');
		ui.list.innerHTML = skeletonRows(8);
	}

	function skeletonRows(howMany) {
		return Array.from({ length: howMany }, (_, index) =>
			[
				'<li aria-hidden="true" class="slg-row slg-row-skeleton">',
				'<span class="basalt-skeleton basalt-skeleton-text slg-sk slg-sk-time"></span>',
				'<span class="basalt-skeleton basalt-skeleton-btn slg-sk slg-sk-pill"></span>',
				'<span class="basalt-skeleton basalt-skeleton-text slg-sk slg-sk-src"></span>',
				`<span style="--slg-sk-w:${46 + ((index * 37) % 40)}%" class="basalt-skeleton basalt-skeleton-text slg-sk slg-sk-msg"></span>`,
				'</li>',
			].join(''),
		).join('');
	}

	/* Lines that arrive while the reader is busy wait behind a button. */
	function showUnseen() {
		ui.fresh.hidden = !unseen;
		if (unseen) ui.freshLabel.textContent = `Show ${countOf(unseen, 'new line')}`;
	}

	/* The toolbar narrows the list; every active filter also shows as a chip. */

	function wireToolbar() {
		ui.search.addEventListener('input', () => {
			clearTimeout(typingTimer);
			typingTimer = setTimeout(() => applySearch(ui.search.value), 160);
		});
		ui.search.addEventListener('change', () => {
			clearTimeout(typingTimer);
			applySearch(ui.search.value);
		});
		ui.search.addEventListener('keydown', (event) => {
			const suggestionsOpen = ui.search.getAttribute('aria-expanded') === 'true';
			if (event.key !== 'Escape' || !ui.search.value || suggestionsOpen) return;
			ui.search.value = '';
			applySearch('');
		});
		document.addEventListener('keydown', onSlashKey);

		ui.floor.addEventListener('change', (event) => {
			if (!event.target.matches('input[name="slg-level"]')) return;
			view.floor = event.target.value;
			rebuildList(true);
		});
		ui.origins.addEventListener('change', () => {
			view.origins = [...ui.origins.selectedOptions].map((option) => option.value);
			rebuildList(true);
			renderOrigins();
		});
		ui.fold.addEventListener('change', () => {
			view.foldRepeats = ui.fold.checked;
			rebuildList(true);
		});
		pick('[data-slg-clear-all]').addEventListener('click', () => {
			resetFilters();
			if (ui.span.value === '15') {
				ui.span.value = '60';
				view.span = 60;
				rebuildList(true);
			}
			ui.search.focus();
		});
	}

	/* A slash anywhere outside a field jumps to the search box. */
	function onSlashKey(event) {
		if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.target.closest?.('input, textarea, select, [contenteditable="true"], .modal, .offcanvas')) return;
		event.preventDefault();
		revealTab('events');
		ui.search.focus();
	}

	function applySearch(raw) {
		const trimmed = raw.trim();
		if (trimmed === view.search) return;
		view.search = trimmed;
		rebuildList(true);
		say(folded.length ? `${countOf(folded.length, 'line')} match` : 'Nothing matches');
	}

	function setFloor(level) {
		const radio = pick(`#slg-level-${level}`);
		if (!radio || radio.checked) return;
		radio.checked = true;
		view.floor = level;
		ui.floor.dispatchEvent(new Event('change', { bubbles: false }));
	}

	function fillOriginOptions() {
		ui.origins.innerHTML = Object.entries(ORIGINS)
			.map(
				([key, { label, icon }]) =>
					`<option data-icon="${icon.replace('bi-', '')}" value="${key}">${label}</option>`,
			)
			.join('');
		if (window.Basalt.select?.refresh) window.Basalt.select.refresh(ui.origins);
	}

	function setOrigins(keys) {
		for (const option of ui.origins.options) option.selected = keys.includes(option.value);
		if (window.Basalt.select?.refresh) window.Basalt.select.refresh(ui.origins);
		view.origins = keys.slice();
	}

	function resetFilters() {
		view.search = '';
		ui.search.value = '';
		view.minute = null;
		view.kind = null;
		setOrigins([]);
		setFloor('debug');
		rebuildList(true);
		renderOrigins();
		renderBusyMinutes();
		repaintChart();
	}

	/** Each active filter becomes a removable chip above the list. */
	function renderApplied() {
		const chips = [];
		if (view.search) {
			chips.push({
				label: `Search: ${view.search}`,
				remove() {
					view.search = '';
					ui.search.value = '';
					rebuildList(true);
				},
			});
		}
		if (view.floor !== 'debug') {
			const floorName = pick(`label[for="slg-level-${view.floor}"]`).textContent.trim();
			chips.push({
				label: `At least: ${floorName}`,
				remove() {
					setFloor('debug');
					rebuildList(true);
				},
			});
		}
		for (const key of view.origins) {
			chips.push({
				label: ORIGINS[key].label,
				remove() {
					setOrigins(view.origins.filter((other) => other !== key));
					rebuildList(true);
					renderOrigins();
				},
			});
		}
		if (view.minute !== null) {
			chips.push({
				label: `Minute ${hourMinute(view.minute)}`,
				remove() {
					view.minute = null;
					rebuildList(true);
					renderBusyMinutes();
					repaintChart();
				},
			});
		}
		if (view.kind) {
			chips.push({
				label: `Only: ${KINDS[view.kind].title}`,
				remove() {
					view.kind = null;
					rebuildList(true);
				},
			});
		}
		ui.appliedRow.hidden = !chips.length;
		window.Basalt.drawer?.applied?.(ui.applied, chips, resetFilters, ui.search);
	}

	function suggestionMarkup() {
		const tracked = TRACKED_KINDS.map(
			(key) => `<li data-hint="${ORIGINS[KINDS[key].origin].label}">${htmlSafe(KINDS[key].title)}</li>`,
		);
		const routine = SUGGESTED_INFO.map((phrase) => `<li data-hint="Info">${phrase}</li>`);
		return tracked.join('') + routine.join('');
	}

	/* The 24 hour range loads older lines, failing once on purpose first. */

	function wireArchive() {
		ui.span.addEventListener('change', () => {
			const minutes = parseInt(ui.span.value, 10);
			view.span = minutes;
			if (minutes === 1440 && !olderLoaded) {
				requestOlder();
				return;
			}
			ui.failure.hidden = true;
			rebuildList(true);
		});
		ui.failure.addEventListener('basalt:retry', (event) => {
			setTimeout(() => {
				event.detail.done(true);
				if (parseInt(ui.span.value, 10) === 1440) acceptOlder();
			}, 1100);
		});
		pick('[data-slg-back-hour]').addEventListener('click', () => {
			ui.span.value = '60';
			ui.span.dispatchEvent(new Event('change', { bubbles: true }));
			ui.search.focus();
		});
	}

	/* The first request is made to time out, so the page can show its error panel. */
	function requestOlder() {
		ui.failure.hidden = true;
		showLoading();
		say('Loading the last 24 hours');
		olderAttempts += 1;
		setTimeout(() => {
			if (olderLoaded || parseInt(ui.span.value, 10) !== 1440) return;
			if (olderAttempts > 1) {
				acceptOlder();
				return;
			}
			ui.list.innerHTML = '';
			ui.failure.hidden = false;
			drawList();
			ui.failure.basaltRetryReset?.();
			say('Older events could not be loaded. Trying again shortly.');
		}, 900);
	}

	function acceptOlder() {
		olderLines = seedOlderDay();
		olderLoaded = true;
		ui.failure.hidden = true;
		rebuildList(true);
		notify({
			tone: 'success',
			title: 'Older events loaded',
			text: `${countOf(olderLines.length, 'more event')} from the last 24 hours.`,
			duration: 4000,
		});
	}

	/* Warnings and errors gathered into groups on their own tab. */

	function wireGroups() {
		pick('[data-slg-gstatus]').addEventListener('change', (event) => {
			groupFilter = event.target.value;
			renderGroups();
		});
		ui.groups.addEventListener('click', onGroupPointer);
		ui.groups.addEventListener('auxclick', (event) => {
			if (event.button === 1) onGroupPointer(event);
		});
	}

	/** The group's status, letting a mute lapse once its hour is up. */
	function stateOf(kindKey) {
		const entry = groupState[kindKey];
		if (entry.status === 'muted' && entry.until && entry.until <= clockNow()) {
			entry.status = 'open';
			entry.until = 0;
		}
		return entry.status;
	}

	/** Last hour's totals per tracked kind, errors first, then the busiest. */
	function tallyGroups() {
		const hourStart = clockNow() - 60 * MINUTE;
		const tally = Object.fromEntries(
			TRACKED_KINDS.map((key) => [
				key,
				{
					key,
					total: 0,
					first: 0,
					last: 0,
					slots: new Array(12).fill(0),
					clients: new Set(),
					latest: null,
				},
			]),
		);
		for (const line of lines) {
			const group = tally[line.kind];
			if (!group || line.at < hourStart) continue;
			group.total += 1;
			if (!group.last || line.at > group.last) {
				group.last = line.at;
				group.latest = line;
			}
			if (!group.first || line.at < group.first) group.first = line.at;
			group.slots[Math.min(11, Math.floor((line.at - hourStart) / (5 * MINUTE)))] += 1;
			for (const [term, value] of line.facts) {
				if (term === 'Customer') group.clients.add(value);
			}
		}
		return TRACKED_KINDS.map((key) => tally[key])
			.filter((group) => group.total > 0)
			.sort((a, b) => rankOf(KINDS[b.key].level) - rankOf(KINDS[a.key].level) || b.total - a.total);
	}

	function renderGroups() {
		const groups = tallyGroups();
		const shown = groups.filter((group) => groupFilter === 'all' || stateOf(group.key) === groupFilter);
		const openTotal = String(groups.filter((group) => stateOf(group.key) === 'open').length);
		const eventTotal = shown.reduce((sum, group) => sum + group.total, 0);
		ui.groupCount.textContent = openTotal;
		ui.groupFigure.textContent = openTotal;
		ui.groupSummary.textContent = `${countOf(shown.length, 'group')} · ${countOf(eventTotal, 'event')} this hour`;
		ui.groups.hidden = !shown.length;
		ui.groupsEmpty.hidden = shown.length > 0;
		if (!shown.length) {
			const [heading, text] = EMPTY_GROUP_COPY[groupFilter];
			pick('[data-slg-gempty-title]').textContent = heading;
			pick('[data-slg-gempty-text]').textContent = text;
		}
		ui.groups.innerHTML = shown.map(groupMarkup).join('');
		window.Basalt.tips?.(ui.groups);
	}

	function groupMarkup(group) {
		const spec = KINDS[group.key];
		const status = stateOf(group.key);
		const origin = ORIGINS[spec.origin];
		const title = htmlSafe(spec.title);
		const page = `error-details.html?id=${encodeURIComponent(group.key)}`;
		const meta = [
			`<span><i aria-hidden="true" class="bi ${origin.icon}"></i>${origin.label}</span>`,
			`<span>First ${hourMinute(group.first)}</span>`,
			`<span>Last ${hourMinute(group.last)}</span>`,
			group.clients.size ? `<span>${countOf(group.clients.size, 'customer')}</span>` : '',
			status === 'muted' ? `<span>Muted until ${hourMinute(groupState[group.key].until)}</span>` : '',
		].join('');
		return [
			`<li data-slg-k="${group.key}" class="slg-group slg-group-${spec.level} is-${status}">`,
			'<div class="slg-group-main">',
			`<div class="slg-group-pills">${levelBadge(spec.level)}${stateBadge(status)}</div>`,
			`<h3 class="slg-group-title"><a href="${page}" class="slg-group-link">${title}</a></h3>`,
			`<p class="slg-group-meta">${meta}</p>`,
			'</div>',
			`<div class="slg-group-trend">${sparkline(group.slots)}<span class="visually-hidden">${group.total} events in the last hour, ${group.slots[group.slots.length - 1]} in the last five minutes</span></div>`,
			`<p class="slg-group-count"><strong>${group.total}</strong><span>events</span></p>`,
			'<span class="basalt-row-actions slg-group-open">',
			`<button data-slg-open-group="${group.key}" data-bs-title="Quick view" data-bs-trigger="hover" data-bs-toggle="tooltip" aria-label="Quick view: ${title}" type="button" class="btn btn-icon btn-sm"><i aria-hidden="true" class="bi bi-layout-sidebar-inset-reverse"></i></button>`,
			`<a href="${page}" data-bs-title="Open full page" data-bs-trigger="hover" data-bs-toggle="tooltip" aria-label="Open full page: ${title}" class="btn btn-icon btn-sm"><i aria-hidden="true" class="bi bi-arrows-angle-expand"></i></a>`,
			'</span>',
			'</li>',
		].join('');
	}

	function sparkline(slots) {
		const peak = Math.max(1, ...slots);
		const bars = slots.map((value) => {
			const height = Math.max(6, Math.round((value / peak) * 100));
			return `<span style="--h:${height}%"${value ? '' : ' class="is-zero"'}></span>`;
		});
		return `<span aria-hidden="true" class="slg-spark">${bars.join('')}</span>`;
	}

	/**
	 * The panel icon opens the quick view. Anywhere else on a row goes to the
	 * group's page; a middle click or Cmd/Ctrl opens it in a new tab instead,
	 * the way a link would behave.
	 */
	function onGroupPointer(event) {
		if (event.button > 1) return;
		const quick = event.target.closest('[data-slg-open-group]');
		if (quick) {
			if (event.button === 0) openGroup(quick.getAttribute('data-slg-open-group'));
			return;
		}
		const row = event.target.closest('.slg-group[data-slg-k]');
		if (!row || event.target.closest('a, button')) return;
		const url = `error-details.html?id=${encodeURIComponent(row.getAttribute('data-slg-k'))}`;
		if (event.button === 1 || event.metaKey || event.ctrlKey) window.open(url, '_blank');
		else location.href = url;
	}

	function revealTab(name) {
		const tab = pick(name === 'groups' ? '#slg-tab-groups' : '#slg-tab-events');
		if (tab && !tab.classList.contains('active')) window.bootstrap.Tab.getOrCreateInstance(tab).show();
	}

	/* The drawer shows one group and lets the reader mute or resolve it. */

	function wireDrawer() {
		drawerPane.addEventListener('click', (event) => {
			if (!event.target.closest('[data-slg-d-stack]')) return;
			copyText(
				KINDS[drawerKind] && drawerOrder.find((group) => group.key === drawerKind).latest.trace,
				'Stack trace copied',
			);
		});

		/* Toasts usually sit bottom right, on top of the drawer's buttons, so
       they move to the bottom center while the drawer is open. */
		ui.drawer.addEventListener('show.bs.offcanvas', () => window.Basalt.toasts?.position('bottom-center'));
		ui.drawer.addEventListener('hidden.bs.offcanvas', () => window.Basalt.toasts?.position('bottom-end'));

		pick('[data-slg-d-mute]', ui.drawer).addEventListener('click', () => {
			if (!drawerKind) return;
			if (stateOf(drawerKind) === 'muted') changeGroupState(drawerKind, 'open', 'Group unmuted');
			else changeGroupState(drawerKind, 'muted', `Muted until ${hourMinute(clockNow() + 60 * MINUTE)}`);
		});
		pick('[data-slg-d-resolve]', ui.drawer).addEventListener('click', () => {
			if (!drawerKind) return;
			if (stateOf(drawerKind) === 'resolved') changeGroupState(drawerKind, 'open', 'Group reopened');
			else changeGroupState(drawerKind, 'resolved', 'Marked resolved');
		});
		pick('[data-slg-d-events]', ui.drawer).addEventListener('click', showDrawerEvents);
	}

	function openGroup(kindKey) {
		drawerOrder = tallyGroups();
		const index = drawerOrder.findIndex((group) => group.key === kindKey);
		if (index < 0) return;
		if (!drawerNav && window.Basalt.drawer?.recordNav)
			drawerNav = window.Basalt.drawer.recordNav(ui.drawer, drawerOrder.length, showGroupAt);
		if (drawerNav) drawerNav.go(index, 0);
		else showGroupAt(index);
		window.bootstrap.Offcanvas.getOrCreateInstance(ui.drawer).show();
	}

	function showGroupAt(index) {
		const group = drawerOrder[index];
		if (!group) return;
		drawerKind = group.key;
		const spec = KINDS[group.key];
		const status = stateOf(group.key);
		pick('[data-slg-d="title"]', ui.drawer).textContent = spec.title;
		pick('[data-slg-d="sub"]', ui.drawer).textContent =
			`${ORIGINS[spec.origin].label} · ${SEVERITY[spec.level].name.toLowerCase()} group`;
		pick('[data-slg-d="full"]', ui.drawer).href = `error-details.html?id=${encodeURIComponent(group.key)}`;
		drawerPane.innerHTML = drawerMarkup(group, spec, status);

		const mute = pick('[data-slg-d-mute]', ui.drawer);
		mute.textContent = status === 'muted' ? 'Unmute' : 'Mute an hour';
		mute.disabled = status === 'resolved';
		pick('[data-slg-d-resolve]', ui.drawer).innerHTML =
			status === 'resolved'
				? '<i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Reopen'
				: '<i class="bi bi-check2 me-1" aria-hidden="true"></i>Mark resolved';
		refreshWidgets(drawerPane);
	}

	function drawerMarkup(group, spec, status) {
		const latest = group.latest;
		const hourStart = clockNow() - 60 * MINUTE;
		const peak = Math.max(1, ...group.slots);
		const bars = group.slots
			.map((value, slot) =>
				[
					`<li><span style="--h:${Math.round((value / peak) * 100)}" class="slg-dbars-bar"></span>`,
					`<span class="slg-dbars-val">${value}</span>`,
					`<span class="slg-dbars-at">${slot % 4 === 0 ? hourMinute(hourStart + slot * 5 * MINUTE) : ''}</span></li>`,
				].join(''),
			)
			.join('');
		const summary = [
			['This hour', countOf(group.total, 'event')],
			['Customers hit', group.clients.size || 'None named'],
			['First seen', stamp(group.first)],
			['Last seen', stamp(group.last)],
		]
			.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`)
			.join('');
		const until =
			status === 'muted'
				? `<span class="slg-d-until">until ${hourMinute(groupState[group.key].until)}</span>`
				: '';
		return [
			`<div class="slg-d-pills">${levelBadge(spec.level)}${stateBadge(status)}${until}</div>`,
			`<dl class="slg-d-facts">${summary}</dl>`,
			'<h3 class="slg-d-sub">Every five minutes</h3>',
			`<ol aria-label="Events in each five minute slot of the last hour" class="slg-dbars${spec.level === 'warn' ? ' slg-dbars-warn' : ''}">${bars}</ol>`,
			`<h3 class="slg-d-sub">Latest one, at ${stamp(latest.at)}</h3>`,
			`<dl class="slg-facts slg-facts-tight">${latest.facts.map(factPair).join('')}${requestFact(latest.request)}</dl>`,
			latest.trace ? traceBlock(latest.trace, 'data-slg-d-stack') : '',
		].join('');
	}

	/** Records the new status, redraws, and offers an undo in the toast. */
	function changeGroupState(kindKey, next, heading) {
		const previous = { ...groupState[kindKey] };
		groupState[kindKey] = { status: next, until: next === 'muted' ? clockNow() + 60 * MINUTE : 0 };
		afterGroupChange();
		notify({
			tone: next === 'resolved' ? 'success' : 'info',
			title: heading,
			text: KINDS[kindKey].title,
			actions: [
				{
					label: 'Undo',
					onClick() {
						groupState[kindKey] = previous;
						afterGroupChange();
						say('Undone');
					},
				},
			],
		});
	}

	function afterGroupChange() {
		renderGroups();
		const index = drawerOrder.findIndex((group) => group.key === drawerKind);
		if (index >= 0 && ui.drawer.classList.contains('show')) showGroupAt(index);
	}

	function showDrawerEvents() {
		if (!drawerKind) return;
		view.kind = drawerKind;
		if (rankOf(view.floor) > rankOf(KINDS[drawerKind].level)) setFloor('debug');
		window.bootstrap.Offcanvas.getOrCreateInstance(ui.drawer).hide();
		revealTab('events');
		rebuildList(true);
		ui.drawer.addEventListener(
			'hidden.bs.offcanvas',
			() => {
				scrollToStream();
				focusFirstRow({ preventScroll: true });
			},
			{ once: true },
		);
	}

	/* The sources card ranks each part of the app by how much it wrote. */

	function wireOrigins() {
		ui.originList.addEventListener('click', (event) => {
			const button = event.target.closest('[data-slg-src]');
			if (!button) return;
			const key = button.getAttribute('data-slg-src');
			const wasOn = button.getAttribute('aria-pressed') === 'true';
			setOrigins(wasOn ? [] : [key]);
			rebuildList(true);
			renderOrigins();
			revealTab('events');
			say(
				wasOn
					? 'Showing every source'
					: `Showing only ${ORIGINS[key].label}. ${countOf(folded.length, 'line')}.`,
			);
			if (!wasOn) scrollToStream();
			pick(`[data-slg-src="${key}"]`, ui.originList)?.focus({ preventScroll: true });
		});
	}

	function renderOrigins() {
		const hourStart = clockNow() - 60 * MINUTE;
		const tallies = Object.keys(ORIGINS).map((key) => ({ key, all: 0, error: 0, warn: 0 }));
		const byKey = Object.fromEntries(tallies.map((tally) => [tally.key, tally]));
		for (const line of lines) {
			if (line.at < hourStart) continue;
			const tally = byKey[line.origin];
			tally.all += 1;
			if (line.level === 'error') tally.error += 1;
			if (line.level === 'warn') tally.warn += 1;
		}
		tallies.sort((a, b) => b.all - a.all);
		const busiest = Math.max(1, ...tallies.map((tally) => tally.all));
		ui.originList.innerHTML = tallies.map((tally) => originMarkup(tally, busiest)).join('');
	}

	function originMarkup({ key, all, error, warn }, busiest) {
		const { label, icon } = ORIGINS[key];
		const pressed = view.origins.length === 1 && view.origins[0] === key;
		const width = (all / busiest) * 100;
		const errorWidth = all ? (error / all) * width : 0;
		const warnWidth = all ? (warn / all) * width : 0;
		const errors = error ? ` · <span class="slg-source-err">${countOf(error, 'error')}</span>` : '';
		return [
			`<li><button data-slg-src="${key}" aria-pressed="${pressed}" type="button" class="slg-source">`,
			`<span aria-hidden="true" class="slg-source-icon"><i class="bi ${icon}"></i></span>`,
			'<span class="slg-source-body">',
			`<span class="slg-source-top"><span class="slg-source-name">${label}</span><span class="slg-source-nums">${countOf(all, 'event')}${errors}</span></span>`,
			'<span aria-hidden="true" class="slg-source-bar">',
			`<span style="width:${width.toFixed(1)}%" class="slg-source-fill"></span>`,
			`<span style="width:${(errorWidth + warnWidth).toFixed(1)}%" class="slg-source-warn"></span>`,
			`<span style="width:${errorWidth.toFixed(1)}%" class="slg-source-error"></span>`,
			'</span></span></button></li>',
		].join('');
	}

	/* The minute chart and the busiest minutes listed beside it. */

	function wireChart() {
		drawChartOnArrival();
		document.addEventListener('basalt:appearance', () => requestAnimationFrame(redrawForTheme));

		ui.spikes.addEventListener('click', (event) => {
			const button = event.target.closest('[data-slg-minute]');
			if (!button) return;
			const minuteStart = Number(button.getAttribute('data-slg-minute'));
			focusMinute(minuteStart);
			pick(`[data-slg-minute="${minuteStart}"]`, ui.spikes)?.focus();
		});
	}

	/* The chart animates in the first time it scrolls near the viewport;
     browsers without IntersectionObserver get it drawn at once, still. */
	function drawChartOnArrival() {
		if (!('IntersectionObserver' in window)) {
			drawChart(false);
			return;
		}
		const watcher = new IntersectionObserver(
			(seen) => {
				if (!seen.some((item) => item.isIntersecting)) return;
				watcher.disconnect();
				drawChart(true);
			},
			{ rootMargin: '80px 0px' },
		);
		watcher.observe(ui.chart);
	}

	/* A theme switch rebuilds a chart that already exists, without animation. */
	function redrawForTheme() {
		if (chart) drawChart(false);
	}

	function token(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** Reads a hex or rgb() color into its three channels; gray when unreadable. */
	function rgbParts(color) {
		const value = String(color || '').trim();
		const short = /^#([0-9a-f]{3})$/i.exec(value);
		if (short) return [...short[1]].map((digit) => parseInt(digit + digit, 16));
		const long = /^#([0-9a-f]{6})$/i.exec(value);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(value);
		if (functional)
			return functional[1]
				.split(',')
				.slice(0, 3)
				.map((part) => parseFloat(part));
		return [128, 128, 128];
	}

	function translucent(color, alpha) {
		const [red, green, blue] = rgbParts(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	function blend(first, second, share) {
		const a = rgbParts(first);
		const b = rgbParts(second);
		const [red, green, blue] = [0, 1, 2].map((slot) => Math.round(a[slot] * share + b[slot] * (1 - share)));
		return `rgb(${red}, ${green}, ${blue})`;
	}

	function chartPalette() {
		const text = token('--basalt-copy', '#12233a');
		return {
			text,
			quiet: blend(token('--basalt-copy-muted', '#5f7186'), text, 0.82),
			grid: translucent(text, 0.07),
			surface: token('--basalt-plane', '#ffffff'),
			border: token('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			error: token('--basalt-danger', '#ef4d63'),
			warn: token('--basalt-warning', '#f5a524'),
			info: token('--basalt-info', '#2b6fd4'),
			debug: translucent(text, 0.2),
		};
	}

	/** Sixty one-minute buckets ending at the current minute, counted per level. */
	function minuteBuckets() {
		const lastMinute = Math.floor(clockNow() / MINUTE) * MINUTE;
		const firstMinute = lastMinute - 59 * MINUTE;
		const starts = Array.from({ length: 60 }, (_, slot) => firstMinute + slot * MINUTE);
		const buckets = { starts, labels: starts.map(hourMinute) };
		for (const level of CHART_STACK) buckets[level] = new Array(60).fill(0);
		for (const line of lines) {
			const slot = Math.floor((line.at - firstMinute) / MINUTE);
			if (slot >= 0 && slot < 60) buckets[line.level][slot] += 1;
		}
		return buckets;
	}

	/* With a minute picked, every other bar fades so the chosen one stands out. */
	function barFill(palette, level, buckets) {
		if (view.minute === null) return palette[level];
		const base = palette[level] === palette.debug ? token('--basalt-copy', '#12233a') : palette[level];
		const faded = translucent(base, level === 'debug' ? 0.08 : 0.28);
		return buckets.starts.map((minuteStart) => (minuteStart === view.minute ? palette[level] : faded));
	}

	function drawChart(animate) {
		if (!window.Chart) return;
		chart?.destroy();
		const palette = chartPalette();
		const buckets = minuteBuckets();
		const ticks = { color: palette.quiet, font: { family: CHART_FONT, size: 11.5 }, padding: 6 };
		chart = new Chart(ui.chart, {
			type: 'bar',
			data: {
				labels: buckets.labels,
				datasets: CHART_STACK.map((level) => ({
					label: SEVERITY[level].series,
					data: buckets[level],
					backgroundColor: barFill(palette, level, buckets),
					stack: 'all',
					borderRadius: 2,
					borderSkipped: false,
					barPercentage: 0.78,
					categoryPercentage: 0.92,
				})),
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: animate && !prefersStill() ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				onHover(event, hits) {
					ui.chart.style.cursor = hits.length ? 'pointer' : 'default';
				},
				onClick(event, hits) {
					if (hits.length) focusMinute(minuteBuckets().starts[hits[0].index]);
				},
				scales: {
					x: {
						stacked: true,
						grid: { display: false },
						border: { display: false },
						ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 7, ...ticks },
					},
					y: {
						stacked: true,
						beginAtZero: true,
						grid: { color: palette.grid },
						border: { display: false },
						ticks: { maxTicksLimit: 4, precision: 0, ...ticks },
					},
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: palette.surface,
						borderColor: palette.border,
						borderWidth: 1,
						titleColor: palette.text,
						bodyColor: palette.text,
						footerColor: palette.quiet,
						titleFont: { family: CHART_FONT, size: 12, weight: '600' },
						bodyFont: { family: CHART_FONT, size: 12 },
						footerFont: { family: CHART_FONT, size: 11, weight: '400' },
						padding: 10,
						cornerRadius: 8,
						boxPadding: 4,
						usePointStyle: true,
						callbacks: { footer: () => 'Click to see this minute' },
					},
				},
			},
		});
	}

	function repaintChart() {
		if (!chart) return;
		const palette = chartPalette();
		const buckets = minuteBuckets();
		chart.data.labels = buckets.labels;
		for (const [index, level] of CHART_STACK.entries()) {
			Object.assign(chart.data.datasets[index], {
				data: buckets[level],
				backgroundColor: barFill(palette, level, buckets),
			});
		}
		chart.update('none');
	}

	/** Picking the same minute twice lets go of it again. */
	function focusMinute(minuteStart) {
		view.minute = view.minute === minuteStart ? null : minuteStart;
		if (view.minute !== null && view.span < 60) {
			ui.span.value = '60';
			view.span = 60;
		}
		revealTab('events');
		rebuildList(true);
		renderBusyMinutes();
		repaintChart();
		say(
			view.minute === null
				? 'Showing the whole range'
				: `Showing ${hourMinute(minuteStart)}, ${countOf(folded.length, 'line')}`,
		);
	}

	/* Up to four minutes with errors, at most one per incident: a minute within
     three of one already listed is passed over. */
	function renderBusyMinutes() {
		const buckets = minuteBuckets();
		const ranked = buckets.starts
			.map((minuteStart, slot) => ({
				minuteStart,
				errors: buckets.error[slot],
				all: buckets.error[slot] + buckets.warn[slot] + buckets.info[slot] + buckets.debug[slot],
			}))
			.filter((minute) => minute.errors > 0)
			.sort((a, b) => b.errors - a.errors || b.minuteStart - a.minuteStart);
		const chosen = [];
		for (const minute of ranked) {
			if (chosen.length >= 4) break;
			if (chosen.every((kept) => Math.abs(kept.minuteStart - minute.minuteStart) > 3 * MINUTE))
				chosen.push(minute);
		}
		ui.spikes.innerHTML = chosen.length
			? chosen
					.map((minute) =>
						[
							`<li><button data-slg-minute="${minute.minuteStart}" aria-pressed="${view.minute === minute.minuteStart}" type="button" class="slg-spike">`,
							`<span class="slg-spike-time">${hourMinute(minute.minuteStart)}</span>`,
							`<span class="slg-spike-n">${countOf(minute.errors, 'error')}</span>`,
							`<span class="slg-spike-all">${countOf(minute.all, 'line')} in all</span>`,
							'</button></li>',
						].join(''),
					)
					.join('')
			: '<li class="slg-spikes-none">No errors in the last hour.</li>';
	}

	function renderFigures() {
		const now = clockNow();
		const errorsThisHour = lines.filter((line) => line.at >= now - 60 * MINUTE && line.level === 'error').length;
		const lastQuarter = lines.filter((line) => line.at >= now - 15 * MINUTE).length;
		pick('[data-slg-fig="errors"]').textContent = errorsThisHour.toLocaleString(LOCALE);
		pick('[data-slg-fig="rate"]').textContent = (lastQuarter / 15).toFixed(1);
	}

	/* Follow live adds fresh lines every two seconds. */

	function wireFollow() {
		ui.live.addEventListener('click', () => {
			const turningOn = ui.live.getAttribute('aria-pressed') !== 'true';
			setFollowing(turningOn);
			say(turningOn ? 'Following live. New lines appear at the top.' : 'Stopped following live.');
		});
	}

	function setFollowing(on) {
		ui.live.setAttribute('aria-pressed', String(on));
		ui.live.classList.toggle('is-live', on);
		pick('[data-slg-live-label]').textContent = on ? 'Following live' : 'Follow live';
		clearInterval(followTimer);
		if (on) followTimer = setInterval(followTick, 2000);
	}

	/**
	 * Writes one to three new lines, 180 ms apart. They go straight
	 * into the list only when the reader is on page one with nothing open and
	 * focus outside the list; otherwise they wait behind the "new lines" button.
	 */
	function followTick() {
		if (document.hidden) return;
		const now = clockNow();
		const weights = frequencies(0);
		const howMany = rollInt(1, 3);
		const arrivals = [];
		for (let step = 0; step < howMany; step += 1)
			arrivals.push(makeLine(pickKind(weights), now - (howMany - 1 - step) * 180));
		arrivals.sort(newestFirst);
		lines = arrivals.concat(lines);
		renderFigures();
		repaintChart();
		renderBusyMinutes();
		renderGroups();
		renderOrigins();

		const matching = arrivals.filter((line) => admits(line));
		if (!matching.length) return;
		const readerBusy =
			pageNumber !== 1 || openIds.size > 0 || ui.list.contains(document.activeElement) || !ui.failure.hidden;
		if (readerBusy) {
			unseen += matching.length;
			showUnseen();
			return;
		}
		folded = collapseRuns(visibleLines());
		quietPaging = true;
		pagination.setTotal(Math.max(1, Math.ceil(folded.length / rowsPerPage)));
		quietPaging = false;
		drawList(new Set(matching.map((line) => line.id)));
		ui.eventCount.textContent = folded.length.toLocaleString(LOCALE);
	}

	/* Export saves whatever the filters currently show. */

	function wireExport() {
		for (const button of pickAll('[data-slg-export]')) {
			button.addEventListener('click', () => exportLines(button.getAttribute('data-slg-export')));
		}
	}

	function exportLines(format) {
		const chosen = visibleLines();
		if (!chosen.length) {
			notify({
				tone: 'warning',
				title: 'Nothing to export',
				text: 'No events match your filters. Clear a filter and try again.',
			});
			return;
		}
		const fileName = `event-log-${hourMinute(clockNow()).replace(':', '')}.${EXPORT_EXTENSION[format] || 'log'}`;
		const progress = notify({
			tone: 'loading',
			title: 'Preparing your export',
			text: countOf(chosen.length, 'event'),
			duration: 0,
		});
		setTimeout(() => {
			const body = serialize(chosen, format);
			try {
				const url = URL.createObjectURL(
					new Blob([body], { type: format === 'csv' ? 'text/csv' : 'text/plain' }),
				);
				const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
				document.body.appendChild(link);
				link.click();
				link.remove();
				setTimeout(() => URL.revokeObjectURL(url), 1000);
				if (progress)
					progress.update({
						tone: 'success',
						title: 'Export ready',
						text: `${countOf(chosen.length, 'event')} saved as ${fileName}`,
						duration: 5000,
					});
			} catch {
				if (progress)
					progress.update({
						tone: 'danger',
						title: 'Export failed',
						text: 'Your browser would not save the file.',
						duration: 6000,
					});
			}
		}, 700);
	}

	function serialize(chosen, format) {
		if (format === 'json') return chosen.map((line) => JSON.stringify(toRecord(line))).join('\n');
		if (format === 'csv') {
			const rows = chosen.map((line) =>
				[
					new Date(line.at).toISOString(),
					line.level,
					line.origin,
					line.text,
					line.facts.map(([term, value]) => `${term}: ${value}`).join('; '),
					line.request,
				]
					.map(csvCell)
					.join(','),
			);
			return `time,level,source,message,details,request_id\n${rows.join('\n')}`;
		}
		return chosen
			.map((line) => {
				const pairs = line.facts.map(([term, value]) => `${term}=${value}`).join(' ');
				return `${stamp(line.at)} ${line.level.toUpperCase().padEnd(5)} [${line.origin}] ${line.text} ${pairs}`;
			})
			.join('\n');
	}

	function csvCell(value) {
		return `"${String(value).replace(/"/g, '""')}"`;
	}

	/* Retention settings, and clearing out debug lines by hand. */

	function wireHousekeeping() {
		ui.alertLevel.addEventListener('input', renderAlertPreview);
		ui.alertLevel.addEventListener('change', renderAlertPreview);
		ui.keepForm.addEventListener('submit', saveRetention);
		ui.clearDebug.addEventListener('basalt:confirm', clearDebugLines);
	}

	/* Tells the reader how many emails the chosen threshold would have sent this hour. */
	function renderAlertPreview() {
		const threshold = parseInt(ui.alertLevel.value, 10);
		if (!Number.isFinite(threshold) || threshold < 1) {
			ui.alertNote.textContent = '';
			return;
		}
		const emails = minuteBuckets().error.filter((errors) => errors >= threshold).length;
		const sentence = emails
			? `At this level the team would have had ${countOf(emails, 'email')} in the last hour.`
			: 'At this level nobody would have been emailed in the last hour.';
		ui.alertNote.innerHTML = `<i class="bi bi-envelope-paper" aria-hidden="true"></i>${sentence}`;
	}

	function saveRetention(event) {
		event.preventDefault();
		if (ui.keepSave.classList.contains('is-loading')) return;
		const fields = [ui.keepDays, ui.alertLevel];
		const outOfRange = fields.filter((field) => {
			const value = Number(field.value);
			return !Number.isFinite(value) || value < Number(field.min) || value > Number(field.max);
		});
		for (const field of fields) field.setAttribute('aria-invalid', String(outOfRange.includes(field)));
		if (outOfRange.length) {
			outOfRange[0].focus();
			notify({
				tone: 'danger',
				title: 'Check the highlighted number',
				text: 'Keep events between 7 and 90 days, and set the email level between 1 and 50.',
			});
			return;
		}
		window.Basalt.buttonState(ui.keepSave, 'loading');
		setTimeout(() => {
			window.Basalt.buttonState(ui.keepSave, 'success');
			const debugDays = Number(pick('input[name="slg-keep-debug"]:checked', ui.keepForm).value);
			notify({
				tone: 'success',
				title: 'Settings saved',
				text: `Keeping events for ${ui.keepDays.value} days and debug lines for ${countOf(debugDays, 'day')}.`,
				duration: 4000,
			});
			setTimeout(() => window.Basalt.buttonState(ui.keepSave, 'idle'), 1800);
		}, 900);
	}

	function renderDebugNote() {
		const debugTotal = lines.filter((line) => line.level === 'debug').length;
		ui.debugNote.textContent = debugTotal
			? `Removes ${countOf(debugTotal, 'debug line')} from the log. Errors, warnings and info stay.`
			: 'No debug lines left. New ones will appear as the app runs.';
	}

	/* Debug lines leave both the hour and the loaded day; the toast can put them back. */
	function clearDebugLines() {
		const isDebug = (line) => line.level === 'debug';
		const fromHour = lines.filter(isDebug);
		const fromDay = olderLoaded ? olderLines.filter(isDebug) : [];
		clearedDebug = { fromHour, fromDay };
		lines = lines.filter((line) => !isDebug(line));
		if (olderLoaded) olderLines = olderLines.filter((line) => !isDebug(line));
		redrawAll();
		notify({
			tone: 'success',
			title: 'Debug lines cleared',
			text: `${countOf(fromHour.length + fromDay.length, 'line')} removed.`,
			duration: 8000,
			actions: [{ label: 'Undo', onClick: restoreDebugLines }],
		});
		setTimeout(() => {
			ui.clearDebug.classList.remove('is-done');
			ui.clearDebug.style.setProperty('--basalt-hold', '0');
		}, 1600);
	}

	function restoreDebugLines() {
		if (!clearedDebug) return;
		lines = lines.concat(clearedDebug.fromHour).sort(newestFirst);
		if (olderLoaded) olderLines = olderLines.concat(clearedDebug.fromDay).sort(newestFirst);
		clearedDebug = null;
		redrawAll();
		say('Debug lines are back');
	}

	function redrawAll() {
		rebuildList(false);
		renderGroups();
		renderOrigins();
		renderBusyMinutes();
		renderFigures();
		renderAlertPreview();
		renderDebugNote();
		repaintChart();
	}

	start();
})();
