/**
 * Live health of the Marlo shop for system-status.html: six services with
 * a strip of daily history, the incident on now and the ones behind it,
 * booked maintenance, response times and the monthly downtime allowance.
 * The demo records are generated here from a fixed seed and counted back
 * from today, so every visit sees the same shop. Chart colors come from the
 * --basalt-* tokens and are redrawn when the theme changes.
 */
(() => {
	'use strict';

	const root = pick('[data-ss-root]');
	if (!root) return;

	const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const TYPEFACE = "'Schibsted Grotesk', sans-serif";
	const MINUTE_MS = 60000;
	const DAY_MS = 86400000;
	const MINUTES_PER_DAY = 1440;

	/* Every date on the page is measured from the moment it loaded. */
	const loadedAt = new Date();
	const midnight = new Date(loadedAt.getFullYear(), loadedAt.getMonth(), loadedAt.getDate());

	/* The six services the shop runs on. `hue` picks the chart series color;
     `baseMs` is a normal response time, and a service without one stays
     off the response chart. */
	const SERVICE_FACTS = {
		storefront: {
			name: 'Storefront',
			icon: 'bi-shop',
			hue: 1,
			baseMs: 180,
			blurb: 'Product pages, basket and customer accounts',
		},
		checkout: {
			name: 'Checkout',
			icon: 'bi-bag-check',
			hue: 2,
			baseMs: 260,
			blurb: 'Addresses, delivery options and order confirmation',
		},
		payments: {
			name: 'Payments',
			icon: 'bi-credit-card',
			hue: 3,
			baseMs: 300,
			blurb: 'Cards, PayPal, Apple Pay and refunds',
		},
		search: {
			name: 'Search',
			icon: 'bi-search',
			hue: 4,
			baseMs: 140,
			blurb: 'Product search, filters and suggestions',
		},
		email: {
			name: 'Email',
			icon: 'bi-envelope',
			hue: 6,
			baseMs: 0,
			blurb: 'Order confirmations, shipping notices and newsletters',
		},
		api: {
			name: 'API',
			icon: 'bi-code-slash',
			hue: 5,
			baseMs: 110,
			blurb: 'Stock sync, stockist orders and connected apps',
		},
	};

	/* The parts of each service, written "Name: what it covers" where a
     part needs explaining. */
	const SERVICE_PARTS = {
		storefront: [
			'Product pages: Clothing, accessories and extras',
			'Basket',
			'Customer accounts: Sign-in, past orders and addresses',
			'Product photos',
		],
		checkout: [
			'Address lookup',
			'Delivery options: Courier prices and dates',
			'Discount codes',
			'Plan sign-up: Aftercare Plan and Express Delivery Pass',
		],
		payments: ['Card payments', 'PayPal', 'Apple Pay and Google Pay', 'Refunds'],
		search: ['Search box', 'Filters: Category, brand and price', 'Suggestions'],
		email: ['Order confirmations', 'Shipping notices', 'Newsletters'],
		api: ['Stock sync: Warehouse stock levels', 'Stockist orders: Boutiques ordering at wholesale', 'Webhooks'],
	};
	const services = Object.entries(SERVICE_FACTS).map(([id, facts]) => ({
		id,
		...facts,
		parts: SERVICE_PARTS[id].map(splitPart),
	}));
	const serviceById = Object.fromEntries(services.map((service) => [service.id, service]));

	/* How each kind of trouble is worded and colored. Archived posts take
     their headings from `steps`, in the order they were written. */
	const AFTERMATH = ['Looking into it', 'Cause found', 'Resolved'];
	const TONES = {
		ok: { word: 'Working', status: 'success', bar: 'ss-tone-ok' },
		maint: {
			word: 'Maintenance',
			status: 'maint',
			bar: 'ss-tone-maint',
			steps: ['Started', 'In progress', 'Completed'],
		},
		slow: { word: 'Slow', status: 'warning', bar: 'ss-tone-slow', steps: AFTERMATH },
		down: { word: 'Down', status: 'danger', bar: 'ss-tone-down', steps: AFTERMATH },
	};
	const SEVERITY = { ok: 0, maint: 1, slow: 2, down: 3 };

	/* The four phases a live incident walks through, as keys and as words. */
	const PHASES = ['investigating', 'identified', 'monitoring', 'resolved'];
	const PHASE_WORDS = {
		investigating: 'Looking into it',
		identified: 'Cause found',
		monitoring: 'Fix is in',
		resolved: 'Resolved',
	};

	/* Response chart spans: how many readings, how far apart, and how a
     reading's time is labeled. Readings above AIM_MS count as slow. */
	const SPANS = {
		'24h': {
			points: 24,
			stepMinutes: 60,
			unit: 'hours',
			spoken: '24 hours',
			tick: (date) => date.toLocaleTimeString('en-US', { hour: 'numeric' }),
		},
		'7d': {
			points: 28,
			stepMinutes: 360,
			unit: 'readings',
			spoken: '7 days',
			tick: (date) =>
				`${date.toLocaleDateString('en-US', { weekday: 'short' })} ${date.toLocaleTimeString('en-US', { hour: 'numeric' })}`,
		},
		'30d': { points: 30, stepMinutes: 1440, unit: 'days', spoken: '30 days', tick: (date) => shortDate(date) },
	};
	const AIM_MS = 400;

	/* Words the history list uses for each kind of record. */
	const COUNTED_AS = { down: 'downtime', slow: 'slow, not downtime' };
	const KIND_PLURALS = { '': 'incidents', down: 'outages', slow: 'slowdowns', maint: 'maintenance' };

	/* The note under the webhook field before it is tested, and how each
     update channel is named in the confirmation. */
	const HOOK_HINT = "We'll send a small test message to check it answers.";
	const CHANNEL_WORDS = { email: 'email', sms: 'text', webhook: 'webhook' };

	/* Closed incidents as a plain log, one per block: days back, start time,
     service, part, kind, minutes and title, then the three posts written
     while it was handled, oldest first. */
	const ARCHIVE_LOG = `
    3  | 08:10 | email      | Order confirmations      | slow  | 95  | Order confirmation emails arriving late
       - Some order confirmation emails are taking up to an hour to arrive. The orders themselves are fine.
       - Our email provider had a backlog. They have added capacity and emails are catching up.
       - Every delayed email has been delivered, and new ones arrive within a minute.
    9  | 14:25 | search     | Search box               | down  | 22  | Search returning no results
       - Searching the shop returns nothing. Browsing by collection still works.
       - An update to the search index went wrong. We are rolling it back.
       - Search is back and results are complete again.
    12 | 02:00 | payments   | PayPal                   | maint | 30  | PayPal connection upgrade
       - Work is starting. PayPal may be slow for up to 30 minutes.
       - Upgrade in progress. Card payments are not affected.
       - Work finished. PayPal is running normally.
    17 | 11:40 | storefront | Product photos           | slow  | 40  | Product photos loading slowly
       - Product photos are slow to load on some pages.
       - Our image service was struggling after a big upload of new tailoring and silk photos. We have spread the load.
       - Photos load at normal speed again.
    23 | 19:05 | checkout   | Delivery options         | down  | 14  | Checkout not loading for some shoppers
       - Some shoppers see a blank page when they go to checkout.
       - The delivery prices service stopped answering, which blocked checkout. We have restarted it.
       - Checkout works for everyone. Baskets were kept, so shoppers can carry on where they were.
    28 | 06:30 | api        | Stock sync               | slow  | 120 | Stock sync running behind
       - Stock levels from the warehouse are updating late, up to two hours behind.
       - A large delivery of tailoring created more updates than usual. The sync is working through them.
       - Stock sync has caught up and is running on time.
    34 | 12:15 | payments   | Apple Pay and Google Pay | down  | 18  | Apple Pay payments failing
       - Apple Pay payments are being declined. Cards and PayPal work.
       - A certificate on our side ran out. A new one is going in.
       - Apple Pay is working again.
    41 | 01:00 | email      | Newsletters              | maint | 60  | Moving newsletters to a new sender
       - Work is starting. Newsletters are paused for an hour.
       - Moving the sender settings. Order emails are not affected.
       - Done. Newsletters now go out from the new address.
    47 | 16:50 | storefront | Product pages            | down  | 9   | Shop offline after an update
       - The shop is showing an error page to everyone.
       - A theme update broke the product pages. We are putting the previous version back.
       - The shop is back. The update will be fixed and tried again tonight.
    55 | 10:20 | search     | Filters                  | slow  | 50  | Filters slow on the accessories collection
       - Filtering the accessories collection takes several seconds.
       - A new fabric and size filter made each search heavier than expected.
       - We changed how the filter is worked out, and it is quick again.
    62 | 18:35 | checkout   | Delivery options         | slow  | 35  | Delivery options slow to appear
       - Delivery options take up to 20 seconds to show at checkout.
       - The courier price service is slow. We are showing saved prices meanwhile.
       - Courier prices are coming through at normal speed.
    70 | 09:05 | api        | Stockist orders          | down  | 26  | Stockist orders not coming through
       - Orders placed by stockists through the wholesale portal are not reaching us.
       - A change to our sign-in rules blocked the app. We are undoing it.
       - Stockist orders are coming through, and the missed ones have been picked up.
    76 | 15:30 | payments   | Refunds                  | slow  | 45  | Refunds taking longer than usual
       - Refunds are taking several minutes to go through instead of seconds.
       - Our card processor is slow with refunds today. Payments are fine.
       - Refunds are going through normally again.
    83 | 03:00 | storefront | Customer accounts        | maint | 20  | Database upgrade
       - Work is starting. Signing in may fail for a few minutes.
       - Upgrade in progress. The shop is open and baskets work.
       - Done. Everything is running on the new database.
    88 | 07:45 | email      | Newsletters              | down  | 31  | Newsletter sending stopped
       - The weekly newsletter stopped sending part way through.
       - We reached our sending limit. The limit has been raised.
       - The newsletter has finished sending to everyone.
  `;

	/* The working records. Each is replaced or spliced as people act on the
     page, and every view is redrawn from them. */
	let archive = readArchiveLog(ARCHIVE_LOG).map(toArchived);

	let live = [
		{
			id: 'inc-live',
			services: ['payments'],
			part: 'Card payments',
			kind: 'slow',
			title: 'Card payments are slow',
			startedAt: minutesBefore(52),
			phase: 'monitoring',
			posts: [
				{
					phase: 'monitoring',
					when: minutesBefore(4),
					text: "Payments are back to normal speed for most shoppers. We're keeping an eye on it.",
				},
				{
					phase: 'identified',
					when: minutesBefore(29),
					text: 'Our card processor is having trouble in one region. They have moved traffic to another region.',
				},
				{
					phase: 'investigating',
					when: minutesBefore(52),
					text: "Some card payments are taking up to 30 seconds to go through. Orders are still being placed, so there's no need to pay twice.",
				},
			],
		},
	];

	let bookings = [
		{
			id: 'mt-1',
			service: 'search',
			title: 'Search index rebuild',
			startsAt: dayAt(-1, '02:00'),
			minutes: 45,
			notify: true,
			note: 'Search may show older stock levels while it runs. Browsing is not affected.',
		},
		{
			id: 'mt-2',
			service: 'payments',
			title: 'Card processor certificate update',
			startsAt: dayAt(-6, '03:00'),
			minutes: 15,
			notify: true,
			note: 'Card payments may take a few seconds longer.',
		},
		{
			id: 'mt-3',
			service: 'email',
			title: 'Moving order emails to a new sender',
			startsAt: dayAt(-13, '01:00'),
			minutes: 60,
			notify: true,
			note: 'Order confirmations may arrive a few minutes late.',
		},
	];
	let bookingCount = bookings.length;

	/* Brief slow patches too small to have earned a post, keyed by service
     and then by how many days back they fell. */
	const spikes = scatterSpikes();

	/* Every page element the script touches, looked up once. */
	const ui = {
		boardList: pick('[data-ss-services]'),
		banner: pick('[data-ss-banner]'),
		checkedLabel: pick('[data-ss-checked]'),
		checkButton: pick('[data-ss-check]'),
		liveBox: pick('[data-ss-open]'),
		updateDialog: pick('#ss-update'),
		updateForm: pick('[data-ss-update-form]'),
		updateText: pick('#ss-update-msg'),
		updateCounter: pick('[data-ss-update-count]'),
		resolveDialog: pick('#ss-resolve'),
		reportDialog: pick('#ss-report'),
		reportForm: pick('[data-ss-report-form]'),
		reportServices: pick('[data-ss-report-svcs]'),
		reportServiceError: pick('[data-ss-report-svc-err]'),
		chartCanvas: pick('[data-ss-chart]'),
		chartNothing: pick('[data-ss-chart-empty]'),
		bookingList: pick('[data-ss-maint]'),
		bookingNothing: pick('[data-ss-maint-empty]'),
		planDrawer: pick('#ss-plan'),
		planForm: pick('[data-ss-plan-form]'),
		planHeading: pick('[data-ss-plan-title]'),
		planSave: pick('[data-ss-plan-submit]'),
		planSaveLabel: pick('[data-ss-plan-submit-label]'),
		planEndsHint: pick('[data-ss-plan-ends]'),
		historyList: pick('[data-ss-hist]'),
		historyNothing: pick('[data-ss-hist-empty]'),
		historyCount: pick('[data-ss-hist-range]'),
		historyPanel: pick('#ss-hist-panel'),
		historyService: pick('[data-ss-hist-svc]'),
		followDrawer: pick('#ss-subscribe'),
		followForm: pick('[data-ss-sub-form]'),
		followServices: pick('[data-ss-sub-svcs]'),
		followEverything: pick('[data-ss-sub-all]'),
		channelError: pick('[data-ss-sub-channel-err]'),
		hookNote: pick('[data-ss-hook-msg]'),
		hookTest: pick('[data-ss-hook-test]'),
		hookField: pick('#ss-sub-hook'),
		followLabel: pick('[data-ss-subscribe-label]'),
	};

	/* What the visitor has chosen so far. */
	let windowDays = 90;
	const unfolded = new Set();
	const stripCursor = new WeakMap();
	let lastCheck = Date.now();

	let updateTarget = null;
	let resolveTarget = null;

	let chartSpan = '24h';
	const charted = new Set(['storefront', 'checkout', 'payments']);
	const seriesCache = {};
	let chartInstance = null;
	let chartInView = false;

	let bookingInEdit = null;
	let promise = 99.9;

	const PAGE_SIZE = 5;
	let historyKind = '';
	let historyPage = 1;
	let pager = null;
	let knownPageCount = 0;
	let historyTimer = 0;
	const openedRecords = new Set();

	let channelsOn = null;

	/* Where focus goes when a dialog or drawer closes. Openers are often
     redrawn while one is open, so the target is resolved at close time. */
	let focusAfter = null;

	start();

	/**
	 * Wires every control on the page, then draws each section once. The
	 * service board waits a moment behind its skeleton rows, the way the
	 * live checks would arrive.
	 */
	function start() {
		bindBoard();
		bindLiveIncidents();
		bindReport();
		bindChart();
		bindBookings();
		bindAllowance();
		bindHistory();
		bindFollow();

		for (const dialog of [ui.updateDialog, ui.resolveDialog, ui.reportDialog]) {
			dialog.addEventListener('hidden.bs.modal', restoreFocus);
		}
		for (const drawer of [ui.planDrawer, ui.followDrawer]) {
			drawer.addEventListener('hidden.bs.offcanvas', restoreFocus);
		}

		drawLive();
		drawBookings();
		drawAllowance();
		drawChartStats();
		drawHistory();
		drawHeadline();
		setTimeout(drawBoard, calm ? 0 : 450);
	}

	/** Redraws everything an incident change can reach. */
	function redrawAll(freshId) {
		drawBoard();
		drawLive(freshId);
		drawAllowance();
		drawHistory();
	}

	/* Small shared tools. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value).replace(/[&<>"']/g, (char) => entities[char]);
	}

	function say(message) {
		window.Basalt.announce?.(message);
	}

	/** A pause that shrinks to a quarter second when motion is reduced. */
	function wait(ms) {
		return new Promise((resolve) => {
			setTimeout(resolve, calm ? Math.min(ms, 250) : ms);
		});
	}

	/** Shows a toast whose only action takes the change back. */
	function notify(message, undo) {
		if (!window.Basalt.toasts) {
			say(message.title);
			return null;
		}
		return window.Basalt.toasts.push({ ...message, actions: [{ label: 'Undo', onClick: undo }] });
	}

	/** Remembers where focus should return; `target` may be a function. */
	function focusAfterClose(target) {
		focusAfter = target;
	}

	function restoreFocus() {
		const target = focusAfter;
		focusAfter = null;
		if (!target) return;
		/* Bootstrap returns focus on this same event, so step in after it. */
		setTimeout(() => {
			const goal = typeof target === 'function' ? target() : target;
			if (goal?.isConnected) goal.focus();
		}, 0);
	}

	/** Marks a field valid or not and returns whether it passed. */
	function markField(field, passes) {
		field.classList.toggle('is-invalid', !passes);
		if (passes) field.removeAttribute('aria-invalid');
		else field.setAttribute('aria-invalid', 'true');
		return passes;
	}

	function markFixed(field) {
		field.classList.remove('is-invalid');
		field.removeAttribute('aria-invalid');
	}

	/** A seeded mulberry32 generator, so the demo looks the same each visit. */
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

	/* Dates and the words used for them. */

	function midnightBack(count) {
		const date = new Date(midnight);
		date.setDate(date.getDate() - count);
		return date;
	}

	/** The given clock time, `count` days back (negative counts look ahead). */
	function dayAt(count, clock) {
		const date = midnightBack(count);
		const [hours, minutes] = clock.split(':').map(Number);
		date.setHours(hours, minutes, 0, 0);
		return date;
	}

	function minutesBefore(count) {
		return new Date(loadedAt.getTime() - count * MINUTE_MS);
	}

	function longDate(date) {
		return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}

	function shortDate(date) {
		return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
	}

	function clockTime(date) {
		return date.toLocaleTimeString('en-US', { minute: '2-digit', hour: 'numeric' });
	}

	function plural(count, one, many) {
		return `${count}${count === 1 ? one : many}`;
	}

	function sinceText(date) {
		const minutes = Math.round((Date.now() - date.getTime()) / MINUTE_MS);
		if (minutes < 1) return 'just now';
		if (minutes < 60) return plural(minutes, ' minute ago', ' minutes ago');
		const hours = Math.round(minutes / 60);
		return hours < 24 ? plural(hours, ' hour ago', ' hours ago') : longDate(date);
	}

	function durationText(total) {
		if (total < 60) return plural(total, ' minute', ' minutes');
		const rest = total % 60;
		return plural(Math.floor(total / 60), ' hour', ' hours') + (rest ? ` ${rest} min` : '');
	}

	function wholeDays(from, to) {
		return Math.round((to - from) / DAY_MS);
	}

	/** A yyyy-mm-dd string for date inputs. */
	function dateValue(date) {
		const two = (n) => String(n).padStart(2, '0');
		return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
	}

	function percentText(value) {
		if (value >= 99.995) return '100%';
		return `${(Math.floor(value * 100) / 100).toFixed(2)}%`;
	}

	function msText(value) {
		return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`;
	}

	function middleValue(values) {
		const sorted = [...values].sort((a, b) => a - b);
		const half = Math.floor(sorted.length / 2);
		if (sorted.length % 2) return sorted[half];
		return (sorted[half - 1] + sorted[half]) / 2;
	}

	/* Turning the records into what each view needs. */

	/** "Name: detail" becomes { name, detail }; a bare name has no detail. */
	function splitPart(text) {
		const [name, detail = ''] = text.split(': ');
		return { name, detail };
	}

	/** Reads ARCHIVE_LOG into one note per incident, posts in writing order. */
	function readArchiveLog(log) {
		const notes = [];
		for (const line of log
			.split('\n')
			.map((raw) => raw.trim())
			.filter(Boolean)) {
			if (line.startsWith('- ')) {
				notes[notes.length - 1].posts.push(line.slice(2));
				continue;
			}
			const [back, clock, service, part, kind, minutes, title] = line.split('|').map((cell) => cell.trim());
			notes.push({ back: Number(back), clock, service, part, kind, minutes: Number(minutes), title, posts: [] });
		}
		return notes;
	}

	function toArchived(note) {
		const startedAt = dayAt(note.back, note.clock);
		const offsets = [0, Math.max(3, Math.round(note.minutes * 0.4)), note.minutes];
		const stepWords = TONES[note.kind].steps;
		const posts = note.posts.map((text, step) => ({
			phase: stepWords[step],
			when: new Date(startedAt.getTime() + offsets[step] * MINUTE_MS),
			text,
		}));
		return {
			id: `earn-${note.back}-${note.service}`,
			services: [note.service],
			part: note.part,
			kind: note.kind,
			minutes: note.minutes,
			title: note.title,
			startedAt,
			posts: posts.reverse(),
		};
	}

	function scatterSpikes() {
		const random = makeRandom(20260929);
		const found = {};
		for (const service of services) {
			const perDay = {};
			for (let round = 0; round < 2; round += 1) {
				const back = 1 + Math.floor(random() * 88);
				perDay[back] = 3 + Math.floor(random() * 9);
			}
			found[service.id] = perDay;
		}
		return found;
	}

	/** Live incidents with their running length, so they can sit beside the archive. */
	function liveSoFar(round) {
		return live.map((incident) => {
			const elapsed = (Date.now() - incident.startedAt) / MINUTE_MS;
			return { ...incident, minutes: round ? Math.max(1, Math.round(elapsed)) : elapsed, ongoing: true };
		});
	}

	/** One entry per day, oldest first, with the minutes lost to each kind. */
	function daysFor(serviceId, length) {
		const everything = archive.concat(liveSoFar(true));
		const days = [];
		for (let back = length - 1; back >= 0; back -= 1) {
			const date = midnightBack(back);
			const until = new Date(date.getTime() + DAY_MS);
			const day = { back, date, kind: 'ok', lost: { down: 0, slow: 0, maint: 0 }, events: [] };

			for (const incident of everything) {
				const covers = incident.services.includes(serviceId);
				if (!covers || incident.startedAt < date || incident.startedAt >= until) continue;
				day.lost[incident.kind] += incident.minutes;
				day.events.push(incident);
				if (SEVERITY[incident.kind] > SEVERITY[day.kind]) day.kind = incident.kind;
			}

			const spike = spikes[serviceId][back];
			if (spike && day.kind === 'ok') {
				day.kind = 'slow';
				day.lost.slow += spike;
				day.spike = spike;
			}
			days.push(day);
		}
		return days;
	}

	function downMinutes(serviceId, length) {
		return daysFor(serviceId, length).reduce((sum, day) => sum + day.lost.down, 0);
	}

	function availability(serviceId, length) {
		return 100 * (1 - downMinutes(serviceId, length) / (length * MINUTES_PER_DAY));
	}

	function worstOf(incidents) {
		return incidents.reduce(
			(worst, incident) => (SEVERITY[incident.kind] > SEVERITY[worst] ? incident.kind : worst),
			'ok',
		);
	}

	function serviceState(serviceId) {
		return worstOf(live.filter((incident) => incident.services.includes(serviceId)));
	}

	function partState(serviceId, partName) {
		return worstOf(
			live.filter(
				(incident) => incident.services.includes(serviceId) && (!incident.part || incident.part === partName),
			),
		);
	}

	function toneChip(kind, extraClass) {
		const tone = TONES[kind];
		const classes = ['basalt-status', 'basalt-status-dot', `basalt-status-${tone.status}`];
		if (extraClass) classes.push(extraClass);
		return `<span class="${classes.join(' ')}">${tone.word}</span>`;
	}

	function serviceNames(ids) {
		return ids.map((id) => serviceById[id].name).join(', ');
	}

	/* The service board: the banner, one row per service and its day strip. */

	function bindBoard() {
		ui.boardList.addEventListener('pointermove', (event) => {
			const bar = event.target.closest('.ss-bar');
			const strip = event.target.closest('[data-ss-bars]');
			if (bar && strip) readStrip(strip, Number(bar.getAttribute('data-i')));
		});
		ui.boardList.addEventListener(
			'pointerleave',
			() => {
				for (const strip of pickAll('[data-ss-bars]', ui.boardList)) {
					if (strip !== document.activeElement) restStrip(strip);
				}
			},
			true,
		);
		ui.boardList.addEventListener('focusin', (event) => {
			const strip = event.target.closest?.('[data-ss-bars]');
			if (!strip) return;
			strip.nextElementSibling.setAttribute('aria-live', 'polite');
			readStrip(strip, stripCursor.get(strip) ?? pickAll('.ss-bar', strip).length - 1);
		});
		ui.boardList.addEventListener('focusout', (event) => {
			const strip = event.target.closest?.('[data-ss-bars]');
			if (!strip) return;
			strip.nextElementSibling.removeAttribute('aria-live');
			restStrip(strip);
		});
		ui.boardList.addEventListener('keydown', stepStrip);
		ui.boardList.addEventListener('click', (event) => {
			const toggle = event.target.closest('[data-ss-toggle]');
			if (toggle) foldParts(toggle);
		});

		for (const choice of pickAll('input[name="ss-range"]')) {
			choice.addEventListener('change', () => {
				if (choice.checked) changeWindow(Number(choice.value));
			});
		}

		setInterval(() => {
			if (!document.hidden) sayChecked();
		}, 10000);
		ui.checkButton.addEventListener('click', checkAgain);
	}

	function drawBoard() {
		ui.boardList.innerHTML = services.map(serviceRow).join('');
		ui.boardList.setAttribute('aria-busy', 'false');
		drawBanner();
		drawHeadline();
	}

	function drawBanner() {
		const hurt = services.filter((service) => serviceState(service.id) !== 'ok');
		const down = hurt.filter((service) => serviceState(service.id) === 'down');
		const joinNames = (list) => list.map((service) => service.name).join(list.length === 2 ? ' and ' : ', ');

		let look;
		if (!hurt.length) {
			look = {
				tone: 'success',
				icon: 'bi bi-check-lg',
				title: 'Everything is working',
				line: 'All six services are answering normally. Shoppers can browse, pay and get their emails.',
			};
		} else if (down.length) {
			const first = live.find((incident) => incident.kind === 'down');
			look = {
				tone: 'danger',
				icon: 'bi bi-x-lg',
				title: joinNames(down) + (down.length === 1 ? ' is down' : ' are down'),
				line: `${first.title}. ${hurt.length === services.length ? '' : 'Everything else is working.'}`,
			};
		} else {
			look = {
				tone: 'warning',
				icon: 'bi bi-exclamation-triangle',
				title: joinNames(hurt) + (hurt.length === 1 ? ' is slow right now' : ' are slow right now'),
				line: `${live[0].title}. Everything else is working.`,
			};
		}

		ui.banner.setAttribute('data-tone', look.tone);
		pick('[data-ss-banner-icon]').className = look.icon;
		pick('[data-ss-banner-title]').textContent = look.title;
		pick('[data-ss-banner-sub]').textContent = look.line;
	}

	/** The soonest booking for a service within the coming week. */
	function nextBooking(serviceId) {
		const horizon = Date.now() + 7 * DAY_MS;
		const ahead = bookings.filter(
			(booking) => booking.service === serviceId && booking.startsAt.getTime() < horizon,
		);
		return ahead.sort((a, b) => a.startsAt - b.startsAt)[0];
	}

	function serviceRow(service) {
		const state = serviceState(service.id);
		const showing = unfolded.has(service.id);
		const booking = nextBooking(service.id);
		const name = htmlSafe(service.name);

		const partItems = service.parts
			.map((part) => {
				const detail = part.detail ? `<span class="ss-parts-sub">${htmlSafe(part.detail)}</span>` : '';
				return `<li><span class="ss-parts-name">${htmlSafe(part.name)}${detail}</span>${toneChip(partState(service.id, part.name))}</li>`;
			})
			.join('');

		const bookingNote = booking
			? `<p class="ss-svc-note"><i class="bi bi-calendar-event" aria-hidden="true"></i>Maintenance ${htmlSafe(longDate(booking.startsAt))}, ${htmlSafe(clockTime(booking.startsAt))}</p>`
			: '';

		const toggle = `<button type="button" class="ss-svc-toggle" aria-expanded="${showing}" aria-controls="ss-parts-${service.id}" data-ss-toggle="${service.id}">${name}<span class="visually-hidden">, show its ${service.parts.length} parts</span><i class="bi bi-chevron-down" aria-hidden="true"></i></button>`;

		const head = [
			`<span class="ss-svc-icon" aria-hidden="true"><i class="bi ${service.icon}"></i></span>`,
			`<div class="ss-svc-name-wrap"><h3 class="ss-svc-name">${toggle}</h3><p class="ss-svc-desc">${htmlSafe(service.blurb)}</p>${bookingNote}</div>`,
			`<span class="ss-svc-status">${toneChip(state, state !== 'ok' ? 'basalt-status-live' : '')}</span>`,
			`<p class="ss-svc-uptime"><span class="ss-svc-pct" data-ss-pct>${percentText(availability(service.id, windowDays))}</span><span class="ss-svc-pct-label">uptime</span></p>`,
		].join('');

		const strip = `<div class="ss-bars ss-bars-${windowDays}" tabindex="0" role="group" aria-roledescription="day history" aria-label="${stripLabel(name)}" aria-describedby="ss-read-${service.id}" data-ss-bars="${service.id}">${stripBars(service.id)}</div>`;

		return [
			`<li class="ss-svc" data-svc="${service.id}">`,
			`<div class="ss-svc-head">${head}</div>`,
			strip,
			`<p class="ss-read" id="ss-read-${service.id}" data-ss-read>${restingCaption()}</p>`,
			`<ul class="ss-parts" id="ss-parts-${service.id}" aria-label="Parts of ${name}"${showing ? '' : ' hidden'}>${partItems}</ul>`,
			'</li>',
		].join('');
	}

	function stripLabel(name) {
		return `${name}, last ${windowDays} days. Use the arrow keys to read each day.`;
	}

	function stripBars(serviceId) {
		return daysFor(serviceId, windowDays)
			.map((day, index) => `<span class="ss-bar ${TONES[day.kind].bar}" data-i="${index}"></span>`)
			.join('');
	}

	function restingCaption() {
		return `<span>${windowDays} days ago</span><span>Today</span>`;
	}

	/** The caption under a strip while one day is being read. */
	function dayCaption(serviceId, index) {
		const day = daysFor(serviceId, windowDays)[index];
		let summary = 'No problems';
		if (day.kind !== 'ok') {
			const lost = [
				['Down', day.lost.down],
				['Slow', day.lost.slow],
				['Maintenance', day.lost.maint],
			]
				.filter(([, minutes]) => minutes)
				.map(([word, minutes]) => `${word} for ${durationText(minutes)}`);
			summary = lost.join(', ');
			const [event] = day.events;
			if (event) summary += `. ${event.title}${event.ongoing ? ' (still open)' : ''}`;
			else if (day.spike) summary += ', too short to need a post';
		}
		const dayUptime = 100 * (1 - day.lost.down / MINUTES_PER_DAY);
		const label = day.back === 0 ? 'Today' : htmlSafe(longDate(day.date));
		return `<span><span class="ss-read-day">${label}</span> · ${htmlSafe(summary)} · ${percentText(dayUptime)} uptime</span>`;
	}

	function readStrip(strip, index) {
		stripCursor.set(strip, index);
		strip.classList.add('is-reading');
		for (const [position, bar] of pickAll('.ss-bar', strip).entries())
			bar.classList.toggle('is-active', position === index);
		const caption = strip.nextElementSibling;
		caption.classList.add('is-reading');
		caption.innerHTML = dayCaption(strip.getAttribute('data-ss-bars'), index);
	}

	function restStrip(strip) {
		strip.classList.remove('is-reading');
		for (const bar of pickAll('.ss-bar.is-active', strip)) bar.classList.remove('is-active');
		const caption = strip.nextElementSibling;
		caption.classList.remove('is-reading');
		caption.innerHTML = restingCaption();
	}

	/** Arrow, Home/End and Page keys move through the focused strip's days. */
	function stepStrip(event) {
		const strip = event.target.closest?.('[data-ss-bars]');
		if (!strip || event.target !== strip) return;
		const last = pickAll('.ss-bar', strip).length - 1;
		const here = stripCursor.get(strip) ?? last;
		const moves = {
			ArrowLeft: here - 1,
			ArrowDown: here - 1,
			ArrowRight: here + 1,
			ArrowUp: here + 1,
			PageUp: here - 7,
			PageDown: here + 7,
			Home: 0,
			End: last,
		};
		if (!(event.key in moves)) return;
		event.preventDefault();
		readStrip(strip, Math.max(0, Math.min(last, moves[event.key])));
	}

	function foldParts(toggle) {
		const id = toggle.getAttribute('data-ss-toggle');
		const opening = toggle.getAttribute('aria-expanded') !== 'true';
		toggle.setAttribute('aria-expanded', String(opening));
		const parts = document.getElementById(`ss-parts-${id}`);
		window.Basalt.slide(parts, () => {
			parts.hidden = !opening;
		});
		if (opening) unfolded.add(id);
		else unfolded.delete(id);
	}

	/** Swaps every strip to a new number of days without rebuilding the rows. */
	function changeWindow(days) {
		windowDays = days;
		for (const service of services) {
			const row = pick(`[data-svc="${service.id}"]`, ui.boardList);
			if (!row) continue;
			const strip = pick('[data-ss-bars]', row);
			strip.className = `ss-bars ss-bars-${windowDays}`;
			strip.innerHTML = stripBars(service.id);
			stripCursor.delete(strip);
			strip.setAttribute('aria-label', stripLabel(service.name));
			pick('[data-ss-read]', row).innerHTML = restingCaption();
			pick('[data-ss-pct]', row).textContent = percentText(availability(service.id, windowDays));
		}
		say(`Showing the last ${windowDays} days`);
	}

	function sayChecked() {
		const seconds = Math.round((Date.now() - lastCheck) / 1000);
		let text = `Checked ${sinceText(new Date(lastCheck))}`;
		if (seconds < 10) text = 'Checked just now';
		else if (seconds < 60) text = `Checked ${Math.floor(seconds / 10) * 10} seconds ago`;
		ui.checkedLabel.textContent = text;
	}

	function checkAgain() {
		if (ui.checkButton.classList.contains('is-loading')) return;
		window.Basalt.buttonState(ui.checkButton, 'loading');
		wait(900)
			.then(() => {
				lastCheck = Date.now();
				sayChecked();
				drawBoard();
				window.Basalt.buttonState(ui.checkButton, 'success');
				say(`Checked. ${pick('[data-ss-banner-title]').textContent}`);
				return wait(1600);
			})
			.then(() => window.Basalt.buttonState(ui.checkButton, 'idle'));
	}

	/* The three figures across the top of the page. */

	function drawHeadline() {
		const meanUptime = services.reduce((sum, service) => sum + availability(service.id, 90), 0) / services.length;
		const readings = services
			.filter((service) => service.baseMs)
			.flatMap((service) => seriesFor(service.id, '24h'));
		pick('[data-ss-fig="uptime"]').textContent = percentText(meanUptime);
		pick('[data-ss-fig="open"]').textContent = String(live.length);
		pick('[data-ss-fig="median"]').textContent = `${Math.round(middleValue(readings))} ms`;
	}

	/* Incidents happening now, and the dialogs that post to, resolve or open them. */

	function bindLiveIncidents() {
		ui.liveBox.addEventListener('click', (event) => {
			const postButton = event.target.closest('[data-ss-post]');
			const resolveButton = event.target.closest('[data-ss-resolve]');
			if (postButton) askForUpdate(postButton);
			if (resolveButton) askToResolve(resolveButton);
		});

		ui.updateText.addEventListener('input', () => {
			countUpdate();
			if (ui.updateText.value.trim()) ui.updateText.classList.remove('is-invalid');
		});
		ui.updateDialog.addEventListener('shown.bs.modal', () => ui.updateText.focus());
		ui.updateForm.addEventListener('submit', postUpdate);

		ui.resolveDialog.addEventListener('basalt:confirm', resolveIncident);
	}

	function drawLive(freshId) {
		pick('[data-ss-open-count]').textContent = live.length ? `${live.length} open` : 'None open';
		ui.liveBox.innerHTML = live.length
			? live.map((incident) => liveCard(incident, freshId)).join('')
			: allClearMarkup();
	}

	function allClearMarkup() {
		const action =
			'<button type="button" class="btn btn-sm btn-outline-secondary" data-bs-toggle="modal" data-bs-target="#ss-report"><i class="bi bi-megaphone me-1" aria-hidden="true"></i>Report an incident</button>';
		return [
			'<div class="basalt-empty basalt-empty-compact basalt-empty-success">',
			'<span class="basalt-empty-badge" aria-hidden="true"><i class="bi bi-check2-circle"></i></span>',
			'<h3 class="basalt-empty-title">Nothing is wrong right now</h3>',
			'<p class="basalt-empty-text">Every service is working. If shoppers tell you otherwise, post it here so they know you are on it.</p>',
			`<div class="basalt-empty-actions">${action}</div>`,
			'</div>',
		].join('');
	}

	function liveCard(incident, freshId) {
		const part = incident.part ? ` (${htmlSafe(incident.part)})` : '';
		const actions = [
			`<button type="button" class="btn btn-sm btn-primary" data-ss-post="${incident.id}"><i class="bi bi-chat-square-text me-1" aria-hidden="true"></i>Post an update</button>`,
			`<button type="button" class="btn btn-sm btn-outline-secondary" data-ss-resolve="${incident.id}"><i class="bi bi-check2-circle me-1" aria-hidden="true"></i>Mark resolved</button>`,
		].join('');
		return [
			`<article class="ss-inc" aria-labelledby="${incident.id}-t">`,
			`<div class="ss-inc-top">${toneChip(incident.kind, 'basalt-status-live')}<span class="ss-inc-since">Started ${htmlSafe(sinceText(incident.startedAt))}, at ${htmlSafe(clockTime(incident.startedAt))}</span></div>`,
			`<h3 class="ss-inc-title" id="${incident.id}-t">${htmlSafe(incident.title)}</h3>`,
			`<p class="ss-inc-affects">Affects <strong>${htmlSafe(serviceNames(incident.services))}</strong>${part}</p>`,
			phaseSteps(incident.phase),
			postList(incident.posts, incident.id === freshId),
			`<div class="ss-inc-actions">${actions}</div>`,
			'</article>',
		].join('');
	}

	/** The progress steps for a live incident, with the current phase marked. */
	function phaseSteps(phase) {
		const reached = PHASES.indexOf(phase);
		const items = PHASES.map((key, index) => {
			let state = { cls: '', spoken: '', current: '' };
			if (index < reached) state = { cls: ' is-done', spoken: ', done', current: '' };
			if (index === reached)
				state = { cls: ' is-current', spoken: ', where things stand', current: ' aria-current="step"' };
			const dot = `<span class="basalt-steps-dot" aria-hidden="true"><i class="bi bi-check-lg"></i><span class="basalt-steps-num">${index + 1}</span></span>`;
			const text = `<span class="basalt-steps-text"><span class="basalt-steps-label">${PHASE_WORDS[key]}</span><span class="visually-hidden">${state.spoken}</span></span>`;
			return `<li class="basalt-steps-item${state.cls}"${state.current}>${dot}${text}</li>`;
		});
		return `<div class="basalt-steps"><ol class="basalt-steps-list" aria-label="Progress">${items.join('')}</ol></div>`;
	}

	/** Posts newest first; `freshFirst` flags the top one as just added. */
	function postList(posts, freshFirst) {
		const items = posts.map((post, index) => {
			const earlier = wholeDays(post.when, loadedAt) > 0 ? `, ${htmlSafe(shortDate(post.when))}` : '';
			const stamp = `<time datetime="${post.when.toISOString()}">${htmlSafe(clockTime(post.when))}${earlier}</time>`;
			const heading = htmlSafe(PHASE_WORDS[post.phase] || post.phase);
			return `<li class="ss-update${freshFirst && index === 0 ? ' is-new' : ''}"><p class="ss-update-meta"><span class="ss-update-stage">${heading}</span> · ${stamp}</p><p class="ss-update-text">${htmlSafe(post.text)}</p></li>`;
		});
		return `<ol class="ss-updates">${items.join('')}</ol>`;
	}

	function countUpdate() {
		const length = ui.updateText.value.length;
		ui.updateCounter.textContent = `${length} of 280 characters`;
		ui.updateCounter.classList.toggle('is-near', length > 240);
	}

	function askForUpdate(button) {
		updateTarget = live.find((incident) => incident.id === button.getAttribute('data-ss-post'));
		if (!updateTarget) return;
		pick('[data-ss-update-sub]').textContent = `${updateTarget.title}.`;
		const suggested = PHASES[Math.min(PHASES.indexOf(updateTarget.phase) + 1, 2)];
		for (const option of pickAll('input[name="stage"]', ui.updateForm)) option.checked = option.value === suggested;
		ui.updateText.value = '';
		ui.updateText.classList.remove('is-invalid');
		countUpdate();
		const { id } = updateTarget;
		focusAfterClose(() => pick(`[data-ss-post="${id}"]`));
		bootstrap.Modal.getOrCreateInstance(ui.updateDialog).show(button);
	}

	function askToResolve(button) {
		resolveTarget = live.find((incident) => incident.id === button.getAttribute('data-ss-resolve'));
		if (!resolveTarget) return;
		pick('[data-ss-resolve-title]').textContent = `Mark “${resolveTarget.title}” as resolved?`;
		const { id } = resolveTarget;
		focusAfterClose(() => pick(`[data-ss-resolve="${id}"]`));
		bootstrap.Modal.getOrCreateInstance(ui.resolveDialog).show(button);
	}

	function postUpdate(event) {
		event.preventDefault();
		if (!ui.updateText.value.trim()) {
			ui.updateText.classList.add('is-invalid');
			ui.updateText.setAttribute('aria-invalid', 'true');
			ui.updateText.focus();
			return;
		}
		ui.updateText.removeAttribute('aria-invalid');

		const incident = updateTarget;
		const earlier = { phase: incident.phase, posts: [...incident.posts] };
		const phase = pick('input[name="stage"]:checked', ui.updateForm)?.value || incident.phase;
		incident.phase = phase;
		incident.posts.unshift({ phase, when: new Date(), text: ui.updateText.value.trim() });
		bootstrap.Modal.getInstance(ui.updateDialog).hide();
		drawLive(incident.id);

		const told = document.getElementById('ss-update-notify').checked;
		notify(
			{
				tone: 'success',
				title: 'Update posted',
				text: told ? 'Subscribers have been told.' : 'It is on the status page. Subscribers were not told.',
			},
			() => {
				incident.phase = earlier.phase;
				incident.posts = earlier.posts;
				drawLive();
				say('Update removed');
			},
		);
	}

	/** Runs once the hold-to-confirm in the resolve dialog completes. */
	function resolveIncident() {
		const incident = resolveTarget;
		if (!incident) return;
		wait(450).then(() => {
			bootstrap.Modal.getInstance(ui.resolveDialog).hide();
			const position = live.indexOf(incident);
			live.splice(position, 1);
			const closed = {
				id: incident.id,
				services: incident.services,
				part: incident.part,
				kind: incident.kind,
				minutes: Math.max(1, Math.round((Date.now() - incident.startedAt) / MINUTE_MS)),
				title: incident.title,
				startedAt: incident.startedAt,
				posts: [
					{ phase: 'Resolved', when: new Date(), text: 'This is fixed. Thanks for your patience.' },
					...incident.posts,
				],
			};
			archive.unshift(closed);
			redrawAll();
			focusAfterClose(() => pick('[data-ss-post]', ui.liveBox) || pick('button', ui.liveBox));
			notify(
				{ tone: 'success', title: 'Incident resolved', text: `${incident.title} moved to the history.` },
				() => {
					archive = archive.filter((record) => record !== closed);
					live.splice(position, 0, incident);
					redrawAll();
					say('Incident reopened');
				},
			);
		});
	}

	function bindReport() {
		ui.reportServices.innerHTML = services
			.map(
				(service) =>
					`<label class="basalt-choice"><input type="checkbox" name="svc" value="${service.id}"><i class="bi ${service.icon}" aria-hidden="true"></i>${htmlSafe(service.name)}</label>`,
			)
			.join('');

		ui.reportDialog.addEventListener('show.bs.modal', () => {
			ui.reportForm.reset();
			for (const field of pickAll('.is-invalid', ui.reportForm)) markFixed(field);
			ui.reportServiceError.hidden = true;
		});
		ui.reportDialog.addEventListener('shown.bs.modal', () => document.getElementById('ss-report-name').focus());
		ui.reportServices.addEventListener('change', () => {
			if (pick('input:checked', ui.reportServices)) ui.reportServiceError.hidden = true;
		});
		ui.reportForm.addEventListener('input', (event) => {
			const field = event.target;
			if (field.classList.contains('is-invalid') && field.value.trim()) markFixed(field);
		});
		ui.reportForm.addEventListener('submit', fileReport);
	}

	function fileReport(event) {
		event.preventDefault();
		const titleField = document.getElementById('ss-report-name');
		const messageField = document.getElementById('ss-report-msg');
		const chosen = pickAll('input[name="svc"]:checked', ui.reportServices).map((box) => box.value);

		const titleOk = markField(titleField, Boolean(titleField.value.trim()));
		const messageOk = markField(messageField, Boolean(messageField.value.trim()));
		ui.reportServiceError.hidden = chosen.length > 0;
		const firstProblem = [
			titleOk ? null : titleField,
			messageOk ? null : messageField,
			chosen.length ? null : pick('input', ui.reportServices),
		].find(Boolean);
		if (firstProblem) {
			firstProblem.focus();
			return;
		}

		const opened = new Date();
		const incident = {
			id: `inc-new-${Date.now()}`,
			services: chosen,
			part: '',
			kind: pick('input[name="impact"]:checked', ui.reportForm).value,
			title: titleField.value.trim(),
			startedAt: opened,
			phase: 'investigating',
			posts: [{ phase: 'investigating', when: new Date(), text: messageField.value.trim() }],
		};
		live.unshift(incident);
		focusAfterClose(() => pick(`[data-ss-post="${incident.id}"]`));
		bootstrap.Modal.getInstance(ui.reportDialog).hide();
		redrawAll(incident.id);

		const told = document.getElementById('ss-report-notify').checked;
		notify(
			{
				tone: 'warning',
				icon: 'bi-megaphone',
				title: 'Incident posted',
				text: told ? 'It is on the status page and subscribers have been told.' : 'It is on the status page.',
			},
			() => {
				live = live.filter((item) => item !== incident);
				redrawAll();
				say('Incident removed');
			},
		);
	}

	/* The response time chart, its service keys and its summary figures. */

	function bindChart() {
		for (const key of pickAll('[data-ss-key]')) {
			key.addEventListener('click', () => {
				const id = key.getAttribute('data-ss-key');
				const pressed = key.getAttribute('aria-pressed') !== 'true';
				key.setAttribute('aria-pressed', String(pressed));
				if (pressed) charted.add(id);
				else charted.delete(id);
				drawChartStats();
				paintChart(false);
			});
		}

		for (const choice of pickAll('input[name="ss-period"]')) {
			choice.addEventListener('change', () => {
				if (!choice.checked) return;
				chartSpan = choice.value;
				drawChartStats();
				paintChart(true);
			});
		}

		if ('IntersectionObserver' in window) {
			const watcher = new IntersectionObserver(
				(entries) => {
					if (!entries.some((entry) => entry.isIntersecting)) return;
					watcher.disconnect();
					chartInView = true;
					paintChart(true);
				},
				{ rootMargin: '80px 0px' },
			);
			watcher.observe(ui.chartCanvas);
		} else {
			chartInView = true;
			paintChart(false);
		}

		document.addEventListener('basalt:appearance', () => requestAnimationFrame(() => paintChart(false)));
	}

	function chartedServices() {
		return services.filter((service) => service.baseMs && charted.has(service.id));
	}

	/** The reading times for a span, oldest first, ending on the current step. */
	function spanTimes(spanKey) {
		const span = SPANS[spanKey];
		const stepMs = span.stepMinutes * MINUTE_MS;
		const lastMs = spanKey === '30d' ? midnight.getTime() : Math.floor(Date.now() / stepMs) * stepMs;
		return Array.from({ length: span.points }, (_, index) => new Date(lastMs - (span.points - 1 - index) * stepMs));
	}

	/**
	 * Seeded response times for one service over a span: a daily rhythm,
	 * some noise, and a bump wherever an outage or slowdown overlapped.
	 * Each series is worked out once and kept.
	 */
	function seriesFor(serviceId, spanKey) {
		const cacheKey = serviceId + spanKey;
		if (seriesCache[cacheKey]) return seriesCache[cacheKey];

		const service = serviceById[serviceId];
		const span = SPANS[spanKey];
		const stepMs = span.stepMinutes * MINUTE_MS;
		const random = makeRandom(service.baseMs * 31 + spanKey.length * 7 + service.hue);
		const trouble = archive
			.concat(liveSoFar(false))
			.filter((incident) => incident.services.includes(serviceId) && incident.kind !== 'maint');

		seriesCache[cacheKey] = spanTimes(spanKey).map((moment) => {
			const rush =
				spanKey === '30d' ? 1 : 1 + 0.22 * Math.max(0, Math.sin(((moment.getHours() - 11) / 24) * Math.PI * 2));
			let reading = service.baseMs * rush * (0.88 + random() * 0.24);
			const from = moment.getTime();
			const to = from + stepMs;
			for (const incident of trouble) {
				const began = incident.startedAt.getTime();
				const ended = began + incident.minutes * MINUTE_MS;
				if (ended < from || began > to) continue;
				const overlap = Math.min(
					1,
					(Math.min(ended, to) - Math.max(began, from)) / stepMs + (spanKey === '24h' ? 0.5 : 0.15),
				);
				reading += (incident.kind === 'down' ? 2.6 : 1.5) * service.baseMs * overlap;
			}
			return Math.round(reading);
		});
		return seriesCache[cacheKey];
	}

	function drawChartStats() {
		const shown = chartedServices();
		const statsBox = pick('[data-ss-stats]');
		ui.chartNothing.hidden = shown.length > 0;
		if (!shown.length) {
			ui.chartCanvas.setAttribute('aria-label', 'No services picked');
			for (const stat of pickAll('[data-ss-stat]', statsBox)) stat.textContent = 'None';
			return;
		}

		const span = SPANS[chartSpan];
		const series = shown.map((service) => ({ service, values: seriesFor(service.id, chartSpan) }));
		const median = middleValue(series.flatMap((entry) => entry.values));

		let slowest = { value: 0 };
		for (const { service, values } of series) {
			for (const [index, value] of values.entries()) {
				if (value > slowest.value) slowest = { value, service, index };
			}
		}

		let overAim = 0;
		for (let index = 0; index < span.points; index += 1) {
			if (series.some((entry) => entry.values[index] > AIM_MS)) overAim += 1;
		}

		const slowestAt = spanTimes(chartSpan)[slowest.index];
		pick('[data-ss-stat="median"]', statsBox).textContent = msText(median);
		pick('[data-ss-stat="peak"]', statsBox).innerHTML =
			`${htmlSafe(msText(slowest.value))}<span class="ss-stat-sub">${htmlSafe(slowest.service.name)}</span>`;
		pick('[data-ss-stat="over"]', statsBox).textContent = `${overAim} of ${span.points} ${span.unit}`;
		const names = shown.map((service) => service.name).join(', ');
		ui.chartCanvas.setAttribute(
			'aria-label',
			`Response time over the last ${span.spoken} for ${names}. Median ${msText(median)}; slowest ${msText(slowest.value)} for ${slowest.service.name} at ${span.tick(slowestAt)}.`,
		);
	}

	function paintChart(animate) {
		if (!chartInView || typeof Chart === 'undefined') return;
		chartInstance?.destroy();
		chartInstance = new Chart(ui.chartCanvas, chartSetup(animate && !calm));
	}

	function chartSetup(animate) {
		const ink = chartInks();
		const labels = spanTimes(chartSpan).map(SPANS[chartSpan].tick);
		const lines = chartedServices().map((service) => {
			const color = ink.series[service.hue - 1];
			return {
				label: service.name,
				data: seriesFor(service.id, chartSpan),
				borderColor: color,
				backgroundColor: color,
				pointBackgroundColor: color,
				pointHoverBackgroundColor: color,
				borderWidth: 2,
				tension: 0.3,
			};
		});
		const aimLine = {
			label: 'Aim',
			data: labels.map(() => AIM_MS),
			borderColor: ink.rest,
			borderDash: [5, 5],
			borderWidth: 1.5,
			pointRadius: 0,
			pointHoverRadius: 0,
			tension: 0,
			order: 9,
		};
		const tickStyle = { color: ink.quiet, padding: 8, font: { family: TYPEFACE, size: 11.5 } };

		return {
			type: 'line',
			data: { labels, datasets: [...lines, aimLine] },
			options: {
				maintainAspectRatio: false,
				responsive: true,
				animation: animate ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { intersect: false, mode: 'index' },
				layout: { padding: { right: 6, top: 6 } },
				elements: {
					line: { borderCapStyle: 'round', borderJoinStyle: 'round' },
					point: { radius: 0, hoverRadius: 5, hoverBorderWidth: 2, hoverBorderColor: ink.surface },
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: ink.surface,
						borderColor: ink.border,
						borderWidth: 1,
						titleColor: ink.text,
						bodyColor: ink.text,
						titleFont: { family: TYPEFACE, size: 12, weight: '600' },
						bodyFont: { family: TYPEFACE, size: 12 },
						padding: 10,
						boxPadding: 4,
						cornerRadius: 8,
						usePointStyle: true,
						filter: (item) => item.dataset.label !== 'Aim',
						callbacks: { label: (item) => ` ${item.dataset.label}: ${msText(item.parsed.y)}` },
					},
				},
				scales: {
					x: {
						border: { display: false },
						grid: { display: false },
						ticks: { ...tickStyle, autoSkipPadding: 14, maxRotation: 0, maxTicksLimit: 7 },
					},
					y: {
						beginAtZero: true,
						border: { display: false },
						grid: { color: ink.grid },
						ticks: { ...tickStyle, maxTicksLimit: 5, callback: (value) => msText(value) },
					},
				},
			},
		};
	}

	/* Chart colors, read from the theme tokens each time the chart is built. */

	function themeToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** Red, green and blue channels from a hex or rgb() color, gray if unreadable. */
	function channels(color) {
		const value = String(color || '').trim();
		const short = value.match(/^#([0-9a-f]{3})$/i);
		if (short) return [...short[1]].map((digit) => parseInt(digit + digit, 16));
		const long = value.match(/^#([0-9a-f]{6})$/i);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
		}
		const functional = value.match(/^rgba?\(([^)]+)\)$/i);
		if (functional)
			return functional[1]
				.split(',')
				.slice(0, 3)
				.map((part) => parseFloat(part));
		return [128, 128, 128];
	}

	function seeThrough(color, alpha) {
		const [red, green, blue] = channels(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	/** Blends two colors, taking `weight` of the first. */
	function blend(first, second, weight) {
		const a = channels(first);
		const b = channels(second);
		const [red, green, blue] = [0, 1, 2].map((index) => Math.round(a[index] * weight + b[index] * (1 - weight)));
		return `rgb(${red}, ${green}, ${blue})`;
	}

	function chartInks() {
		const text = themeToken('--basalt-copy', '#12233a');
		const muted = themeToken('--basalt-copy-muted', '#5f7186');
		const series = [];
		for (let slot = 1; slot <= 8; slot += 1) series.push(themeToken(`--basalt-series-${slot}`, '#2b6fd4'));
		return {
			series,
			text,
			quiet: blend(muted, text, 0.8),
			rest: seeThrough(text, 0.35),
			grid: seeThrough(text, 0.07),
			surface: themeToken('--basalt-plane', '#ffffff'),
			border: themeToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
		};
	}

	/* Planned maintenance: the list, canceling, and the drawer that books or changes it. */

	function bindBookings() {
		ui.bookingList.addEventListener('basalt:confirm', cancelBooking);

		const earliest = new Date(midnight.getTime() + DAY_MS + 3 * 3600000);
		planField('date').min = dateValue(earliest);

		for (const type of ['input', 'change']) {
			ui.planForm.addEventListener(type, (event) => {
				const field = event.target;
				if (field === planField('time') || field === planField('mins')) sayEnds();
				if (field.classList?.contains('is-invalid') && field.value) markFixed(field);
			});
		}

		root.addEventListener('click', (event) => {
			const add = event.target.closest('[data-ss-plan]');
			const change = event.target.closest('[data-ss-mt-edit]');
			if (add) openPlanner(null, add);
			if (change)
				openPlanner(
					bookings.find((booking) => booking.id === change.getAttribute('data-ss-mt-edit')),
					change,
				);
		});
		ui.planDrawer.addEventListener('shown.bs.offcanvas', () => planField('title').focus());
		ui.planForm.addEventListener('submit', saveBooking);
	}

	function planField(name) {
		return ui.planForm.elements[name];
	}

	function bookingWhen(booking) {
		const ends = new Date(booking.startsAt.getTime() + booking.minutes * MINUTE_MS);
		return `${longDate(booking.startsAt)}, ${clockTime(booking.startsAt)} to ${clockTime(ends)} · ${durationText(booking.minutes)}`;
	}

	function drawBookings(freshId) {
		bookings.sort((a, b) => a.startsAt - b.startsAt);
		ui.bookingNothing.hidden = bookings.length > 0;
		ui.bookingList.hidden = !bookings.length;
		ui.bookingList.innerHTML = bookings.map((booking) => bookingItem(booking, freshId)).join('');
		window.Basalt.buttons?.(ui.bookingList);
	}

	function bookingItem(booking, freshId) {
		const service = serviceById[booking.service];
		const title = htmlSafe(booking.title);
		const dateBlock = `<div class="ss-maint-date" aria-hidden="true"><span class="ss-maint-day">${booking.startsAt.getDate()}</span><span class="ss-maint-mon">${booking.startsAt.toLocaleDateString('en-US', { month: 'short' })}</span></div>`;
		const note = booking.note ? `<p class="ss-maint-note">${htmlSafe(booking.note)}</p>` : '';
		const foot = [
			`<span class="badge basalt-badge-as-dot basalt-badge-tone-${service.hue}">${htmlSafe(service.name)}</span>`,
			`<button type="button" class="btn btn-sm btn-outline-secondary" data-ss-mt-edit="${booking.id}" aria-label="Change ${title}"><i class="bi bi-pencil me-1" aria-hidden="true"></i>Change</button>`,
			`<button type="button" class="btn btn-sm btn-outline-danger btn-confirm" data-basalt-confirm data-ss-mt-cancel="${booking.id}"><span class="btn-confirm-idle"><i class="bi bi-x-lg" aria-hidden="true"></i>Cancel</span><span class="btn-confirm-ask">Click again to cancel it</span></button>`,
		].join('');
		return `<li class="ss-maint-item${booking.id === freshId ? ' is-new' : ''}" data-mt="${booking.id}">${dateBlock}<div><h3 class="ss-maint-title">${title}</h3><p class="ss-maint-when">${htmlSafe(bookingWhen(booking))}</p>${note}</div><div class="ss-maint-foot">${foot}</div></li>`;
	}

	function cancelBooking(event) {
		const button = event.target.closest('[data-ss-mt-cancel]');
		if (!button) return;
		const position = bookings.findIndex((booking) => booking.id === button.getAttribute('data-ss-mt-cancel'));
		if (position < 0) return;
		const [removed] = bookings.splice(position, 1);
		drawBookings();
		drawBoard();
		(pick('[data-ss-mt-edit]', ui.bookingList) || pick('[data-ss-maint-empty] button'))?.focus();
		notify(
			{
				tone: 'info',
				icon: 'bi-calendar-x',
				title: 'Maintenance canceled',
				text: removed.title + (removed.notify ? '. Subscribers will be told.' : '.'),
			},
			() => {
				bookings.push(removed);
				drawBookings(removed.id);
				drawBoard();
				say('Maintenance put back');
			},
		);
	}

	/** Clamps a length in minutes to the 15 to 240 the form allows. */
	function clampMinutes(raw, fallback) {
		return Math.max(15, Math.min(240, Number(raw) || fallback));
	}

	function sayEnds() {
		const [hours, minutes] = (planField('time').value || '02:00').split(':').map(Number);
		const ends = new Date(2000, 0, 1, hours, minutes + clampMinutes(planField('mins').value, 15));
		ui.planEndsHint.textContent = `15 to 240 minutes. Ends at ${clockTime(ends)}.`;
	}

	/** Opens the drawer empty for a new booking, or filled in for `booking`. */
	function openPlanner(booking, opener) {
		bookingInEdit = booking || null;
		ui.planForm.reset();
		for (const field of pickAll('.is-invalid', ui.planForm)) markFixed(field);

		ui.planHeading.textContent = booking ? 'Change maintenance' : 'Plan maintenance';
		ui.planSaveLabel.textContent = booking ? 'Save changes' : 'Book it';
		const two = (n) => String(n).padStart(2, '0');
		const values = booking
			? {
					title: booking.title,
					svc: booking.service,
					date: dateValue(booking.startsAt),
					time: `${two(booking.startsAt.getHours())}:${two(booking.startsAt.getMinutes())}`,
					mins: booking.minutes,
					note: booking.note,
				}
			: {
					svc: 'storefront',
					date: dateValue(new Date(midnight.getTime() + 2 * DAY_MS + 3 * 3600000)),
					time: '02:00',
					mins: 30,
				};
		for (const [name, value] of Object.entries(values)) planField(name).value = value;
		if (booking) planField('notify').checked = booking.notify;

		window.Basalt.select?.refresh?.(planField('svc'));
		sayEnds();
		window.Basalt.buttonState(ui.planSave, 'idle');

		const editedId = booking ? booking.id : null;
		focusAfterClose(
			() =>
				(editedId ? pick(`[data-ss-mt-edit="${editedId}"]`) : null) ||
				(opener?.isConnected ? opener : pick('[data-ss-plan]')),
		);
		bootstrap.Offcanvas.getOrCreateInstance(ui.planDrawer).show(opener);
	}

	function saveBooking(event) {
		event.preventDefault();
		if (ui.planSave.classList.contains('is-loading')) return;

		const date = planField('date');
		const checks = [
			[planField('title'), Boolean(planField('title').value.trim())],
			[date, Boolean(date.value) && date.value >= date.min],
			[planField('time'), Boolean(planField('time').value)],
		];
		const failed = checks.filter(([field, passes]) => !markField(field, passes));
		if (failed.length) {
			failed[0][0].focus();
			return;
		}

		const [year, month, day] = date.value.split('-').map(Number);
		const [hours, minutes] = planField('time').value.split(':').map(Number);
		const entry = {
			service: planField('svc').value,
			title: planField('title').value.trim(),
			startsAt: new Date(year, month - 1, day, hours, minutes),
			minutes: clampMinutes(planField('mins').value, 30),
			note: planField('note').value.trim(),
			notify: planField('notify').checked,
		};

		window.Basalt.buttonState(ui.planSave, 'loading');
		wait(800)
			.then(() => {
				window.Basalt.buttonState(ui.planSave, 'success');
				return wait(500);
			})
			.then(() => {
				const changing = bookingInEdit;
				const undo = changing ? applyChange(changing, entry) : addBooking(entry);
				drawBoard();
				bootstrap.Offcanvas.getInstance(ui.planDrawer).hide();
				notify(
					{
						tone: 'success',
						icon: 'bi-calendar-check',
						title: changing ? 'Maintenance changed' : 'Maintenance booked',
						text: `${entry.title}, ${longDate(entry.startsAt)} at ${clockTime(entry.startsAt)}.`,
					},
					undo,
				);
			});
	}

	/** Writes the form into an existing booking and returns its undo. */
	function applyChange(booking, entry) {
		const previous = { ...booking };
		Object.assign(booking, entry);
		drawBookings(booking.id);
		focusAfterClose(() => pick(`[data-ss-mt-edit="${booking.id}"]`));
		return () => {
			Object.assign(booking, previous);
			drawBookings();
			drawBoard();
			say('Change undone');
		};
	}

	/** Adds a new booking and returns its undo. */
	function addBooking(entry) {
		bookingCount += 1;
		const booking = { id: `mt-${bookingCount}`, ...entry };
		bookings.push(booking);
		drawBookings(booking.id);
		focusAfterClose(() => pick(`[data-ss-mt-edit="${booking.id}"]`));
		return () => {
			bookings = bookings.filter((item) => item !== booking);
			drawBookings();
			drawBoard();
			say('Booking removed');
		};
	}

	/* The downtime allowance for the last 30 days against the chosen promise. */

	function bindAllowance() {
		for (const choice of pickAll('input[name="ss-target"]')) {
			choice.addEventListener('change', () => {
				if (!choice.checked) return;
				promise = Number(choice.value);
				drawAllowance();
				say(pick('[data-ss-budget-big]').textContent.trim());
			});
		}
	}

	/** Small numbers keep one decimal, larger ones are whole. */
	function minutesFigure(value) {
		return value < 10 ? value.toFixed(1).replace('.0', '') : String(Math.round(value));
	}

	function drawAllowance() {
		const allowed = 30 * MINUTES_PER_DAY * (1 - promise / 100);
		const perService = services.map((service) => ({ service, minutes: downMinutes(service.id, 30) }));
		const spent = perService.reduce((sum, entry) => sum + entry.minutes, 0);
		const share = spent / allowed;
		const percent = Math.round(share * 100);

		let tone = 'success';
		if (share >= 1) tone = 'danger';
		else if (share >= 0.75) tone = 'warning';

		const ring = pick('[data-ss-ring]');
		ring.className = `basalt-ring ss-budget-ring basalt-ring-${tone}`;
		ring.style.setProperty('--value', String(Math.min(100, percent)));
		ring.setAttribute('aria-label', `${percent}% of the downtime allowance used`);
		pick('[data-ss-ring-value]').textContent = `${percent}%`;

		const remaining = allowed - spent;
		pick('[data-ss-budget-big]').textContent = `${minutesFigure(spent)} of ${minutesFigure(allowed)} minutes used`;
		pick('[data-ss-budget-note]').textContent =
			remaining >= 0
				? `${minutesFigure(remaining)} minutes of downtime left before the ${promise}% promise is broken. Any minute a service is down counts.`
				: `The ${promise}% promise was broken by ${minutesFigure(-remaining)} minutes. Any minute a service is down counts.`;

		pick('[data-ss-budget-list]').innerHTML = perService
			.map(({ service, minutes }) => {
				const fill = `--share:${Math.min(1, minutes / allowed).toFixed(3)};--ss-c:var(--basalt-series-${service.hue})`;
				return `<li class="ss-budget-row"><span class="ss-budget-name">${htmlSafe(service.name)}</span><span class="ss-budget-bar" aria-hidden="true"><span class="ss-budget-fill" style="${fill}"></span></span><span class="ss-budget-mins">${minutes ? `${minutes} min` : 'None'}</span></li>`;
			})
			.join('');
	}

	/* Past incidents: kind tabs, a service filter, paging and folding rows. */

	function bindHistory() {
		ui.historyList.addEventListener('click', (event) => {
			const row = event.target.closest('[data-ss-hrow]');
			if (!row) return;
			const id = row.getAttribute('data-ss-hrow');
			const opening = row.getAttribute('aria-expanded') !== 'true';
			row.setAttribute('aria-expanded', String(opening));
			const body = document.getElementById(`${id}-b`);
			window.Basalt.slide(body, () => {
				body.hidden = !opening;
			});
			if (opening) openedRecords.add(id);
			else openedRecords.delete(id);
		});

		for (const tab of pickAll('[data-ss-kind]')) {
			tab.addEventListener('shown.bs.tab', () => {
				historyKind = tab.getAttribute('data-ss-kind');
				ui.historyPanel.setAttribute('aria-labelledby', tab.id);
				historyPage = 1;
				refetchHistory();
			});
		}

		ui.historyService.addEventListener('change', () => {
			historyPage = 1;
			refetchHistory();
		});
		pick('[data-ss-hist-reset]').addEventListener('click', clearHistoryFilters);
	}

	function filteredHistory(kind) {
		const serviceId = ui.historyService.value;
		return archive
			.filter((record) => (!kind || record.kind === kind) && (!serviceId || record.services.includes(serviceId)))
			.sort((a, b) => b.startedAt - a.startedAt);
	}

	function historyRow(record) {
		const showing = openedRecords.has(record.id);
		const names = serviceNames(record.services);
		const length = htmlSafe(durationText(record.minutes));
		const meta = `${htmlSafe(names)} · ${htmlSafe(longDate(record.startedAt))}, ${htmlSafe(clockTime(record.startedAt))} · ${length}`;
		const button = `<button type="button" class="ss-hrow-btn" aria-expanded="${showing}" aria-controls="${record.id}-b" data-ss-hrow="${record.id}"><span class="ss-hrow-dot ${TONES[record.kind].bar}" aria-hidden="true"></span><span class="ss-hrow-main"><span class="ss-hrow-title">${htmlSafe(record.title)}</span><span class="ss-hrow-meta">${meta}</span></span><span class="ss-hrow-side">${toneChip(record.kind)}<i class="bi bi-chevron-down" aria-hidden="true"></i></span></button>`;
		const facts = [
			`<span>Affected <strong>${htmlSafe(record.part || names)}</strong></span>`,
			`<span>Lasted <strong>${length}</strong></span>`,
			`<span>Counted as <strong>${COUNTED_AS[record.kind] || 'planned work'}</strong></span>`,
		].join('');
		return `<li class="ss-hrow">${button}<div class="ss-hrow-body" id="${record.id}-b"${showing ? '' : ' hidden'}><p class="ss-hrow-facts">${facts}</p>${postList(record.posts)}</div></li>`;
	}

	function drawTabCounts() {
		for (const badge of pickAll('[data-ss-count]')) {
			badge.textContent = String(filteredHistory(badge.getAttribute('data-ss-count')).length);
		}
	}

	function drawHistory() {
		const records = filteredHistory(historyKind);
		const pageCount = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
		historyPage = Math.min(historyPage, pageCount);
		const offset = (historyPage - 1) * PAGE_SIZE;
		const onPage = records.slice(offset, offset + PAGE_SIZE);

		ui.historyList.innerHTML = onPage.map(historyRow).join('');
		ui.historyList.setAttribute('aria-busy', 'false');
		ui.historyNothing.hidden = records.length > 0;
		ui.historyList.hidden = !records.length;

		if (records.length) {
			ui.historyCount.innerHTML = `<strong>${offset + 1}–${offset + onPage.length}</strong> of ${plural(records.length, ' incident', ' incidents')}`;
		} else {
			const serviceName = ui.historyService.value ? serviceById[ui.historyService.value].name : '';
			pick('[data-ss-hist-empty-title]').textContent =
				`No ${KIND_PLURALS[historyKind]}${serviceName ? ` for ${serviceName}` : ''} lately`;
			pick('[data-ss-hist-empty-text]').textContent =
				historyKind === 'down'
					? 'Nothing went fully down in this time. Good news.'
					: 'Nothing like that was posted in this time.';
			ui.historyCount.innerHTML = '';
		}

		syncPager(pageCount);
		drawTabCounts();
	}

	function syncPager(pageCount) {
		const pagerSlot = pick('[data-ss-hist-pages]');
		if (!pager) {
			pager = window.Basalt.pagination(pagerSlot, {
				total: pageCount,
				current: historyPage,
				label: 'Page',
				onChange: (page) => {
					historyPage = page;
					drawHistory();
				},
			});
		} else if (pageCount !== knownPageCount) {
			pager.setTotal(pageCount);
		}
		knownPageCount = pageCount;
		if (pager.get() !== historyPage) pager.set(historyPage);
		pagerSlot.closest('nav').hidden = pageCount < 2;
	}

	/** Shows skeleton rows briefly, as a separate archive lookup would once deployed. */
	function refetchHistory() {
		clearTimeout(historyTimer);
		ui.historyList.hidden = false;
		ui.historyNothing.hidden = true;
		ui.historyList.setAttribute('aria-busy', 'true');
		const ghost =
			'<li class="ss-hrow-ghost" aria-hidden="true"><span class="basalt-skeleton basalt-skeleton-circle" style="width:.9rem;height:.9rem"></span><span><span class="basalt-skeleton basalt-skeleton-title"></span><span class="basalt-skeleton basalt-skeleton-line" style="width:40%"></span></span></li>';
		ui.historyList.innerHTML = ghost.repeat(3);
		historyTimer = setTimeout(drawHistory, calm ? 0 : 320);
	}

	function clearHistoryFilters() {
		ui.historyService.value = '';
		window.Basalt.select?.refresh?.(ui.historyService);
		const allTab = document.getElementById('ss-tab-all');
		if (allTab.classList.contains('active')) {
			historyPage = 1;
			refetchHistory();
		} else {
			bootstrap.Tab.getOrCreateInstance(allTab).show();
		}
		allTab.focus();
	}

	/* The drawer where visitors choose how they hear about incidents. */

	function bindFollow() {
		ui.followServices.innerHTML = services
			.map(
				(service) =>
					`<div class="form-check"><input class="form-check-input" type="checkbox" id="ss-follow-${service.id}" name="follow" value="${service.id}" checked><label class="form-check-label" for="ss-follow-${service.id}">${htmlSafe(service.name)}</label></div>`,
			)
			.join('');

		ui.followForm.addEventListener('change', (event) => {
			const field = event.target;
			const boxes = () => pickAll('input[name="follow"]', ui.followServices);
			if (field.name === 'channel') {
				window.Basalt.slide(pick(`[data-ss-sub-for="${field.value}"]`, ui.followForm), showChannelFields);
			}
			if (field === ui.followEverything) {
				for (const box of boxes()) box.checked = ui.followEverything.checked;
			}
			if (field.name === 'follow') ui.followEverything.checked = boxes().every((box) => box.checked);
		});
		ui.followForm.addEventListener('input', (event) => {
			const field = event.target;
			if (field.classList.contains('is-invalid')) markFixed(field);
			if (field === ui.hookField) setHookNote('', HOOK_HINT);
		});
		ui.hookTest.addEventListener('click', testHook);
		ui.followForm.addEventListener('submit', saveFollow);

		showChannelFields();
	}

	function chosenChannels() {
		return pickAll('input[name="channel"]:checked', ui.followForm).map((box) => box.value);
	}

	function showChannelFields() {
		const chosen = chosenChannels();
		for (const section of pickAll('[data-ss-sub-for]', ui.followForm)) {
			section.hidden = !chosen.includes(section.getAttribute('data-ss-sub-for'));
		}
		if (chosen.length) ui.channelError.hidden = true;
	}

	function setHookNote(state, text) {
		ui.hookNote.className = state ? `ss-hook-msg ${state}` : 'ss-hook-msg';
		ui.hookNote.textContent = text;
	}

	/** Why an address cannot take a webhook, or an empty string if it can. */
	function hookFault(address) {
		let parsed;
		try {
			parsed = new URL(address);
		} catch {
			return "That doesn't look like a web address. It should start with https://";
		}
		return ['https:', 'http:'].includes(parsed.protocol) ? '' : 'Use a web address that starts with https://';
	}

	function testHook() {
		if (ui.hookTest.classList.contains('is-loading')) return;
		const address = ui.hookField.value.trim();
		const fault = address ? hookFault(address) : 'Enter the address first.';
		if (fault) {
			ui.hookField.classList.add('is-invalid');
			ui.hookField.setAttribute('aria-invalid', 'true');
			setHookNote('is-bad', fault);
			ui.hookField.focus();
			return;
		}

		setHookNote('', 'Sending a test message…');
		window.Basalt.buttonState(ui.hookTest, 'loading');
		wait(1000)
			.then(() => {
				const secure = address.startsWith('https://');
				window.Basalt.buttonState(ui.hookTest, secure ? 'success' : 'error');
				if (secure) {
					setHookNote('is-good', 'It answered in 184 ms. Updates will arrive there.');
				} else {
					setHookNote(
						'is-bad',
						'It refused the test because the address is not secure. Use one that starts with https://',
					);
					ui.hookField.classList.add('is-invalid');
					ui.hookField.setAttribute('aria-invalid', 'true');
				}
				return wait(1800);
			})
			.then(() => window.Basalt.buttonState(ui.hookTest, 'idle'));
	}

	function saveFollow(event) {
		event.preventDefault();
		const chosen = chosenChannels();
		const problems = [];
		ui.channelError.hidden = chosen.length > 0;
		if (!chosen.length) problems.push(pick('input[name="channel"]', ui.followForm));

		const emailField = document.getElementById('ss-sub-email');
		const phoneField = document.getElementById('ss-sub-phone');
		const rules = {
			email: () =>
				markField(emailField, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailField.value.trim())) || emailField,
			sms: () => markField(phoneField, phoneField.value.replace(/[^\d]/g, '').length >= 8) || phoneField,
			webhook: () => {
				const address = ui.hookField.value.trim();
				if (markField(ui.hookField, address.startsWith('https://') && !hookFault(address))) return true;
				setHookNote('is-bad', 'Enter a secure address that starts with https://');
				return ui.hookField;
			},
		};
		for (const channel of ['email', 'sms', 'webhook']) {
			if (!chosen.includes(channel)) continue;
			const outcome = rules[channel]();
			if (outcome !== true) problems.push(outcome);
		}
		if (problems.length) {
			problems[0].focus();
			return;
		}

		const previous = channelsOn;
		channelsOn = chosen.map((channel) => CHANNEL_WORDS[channel]);
		ui.followLabel.textContent = 'Updates on';
		bootstrap.Offcanvas.getInstance(ui.followDrawer).hide();
		const spoken =
			channelsOn.length === 1
				? channelsOn[0]
				: `${channelsOn.slice(0, -1).join(', ')} and ${channelsOn[channelsOn.length - 1]}`;
		notify(
			{ tone: 'success', icon: 'bi-bell', title: 'Updates turned on', text: `You'll hear by ${spoken}.` },
			() => {
				channelsOn = previous;
				ui.followLabel.textContent = previous ? 'Updates on' : 'Get updates';
				say('Change undone');
			},
		);
	}
})();
