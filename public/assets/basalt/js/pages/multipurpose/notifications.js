/**
 * Notifications feed for notifications.html.
 *
 * The page is one list of everything Fieldline wants a person to know
 * about (mentions, card payments, access requests, sign-ups, new sign-ins,
 * releases, schedule trouble, finished exports) plus a side column with the
 * channel matrix and the quiet-hours strip. A row shows who it is from, one
 * sentence of detail and a single call to action; mark read, snooze and
 * dismiss live in a small tray on the right. Counts in the header follow
 * the list.
 *
 * Hooking it to a backend: swap SAMPLE for the records your server sends
 * (or have server.load() fetch them), then give each server.* method a real
 * request. The page applies every change first and rolls it back with an
 * error toast when the call fails.
 *
 * Demo switches on the URL: ?state=empty (cleared feed), ?state=error
 * (the first load fails), ?state=offline (every save fails, so the rollback
 * can be watched).
 */
(() => {
	'use strict';
	const page = pick('[data-ntf-root]');
	if (!page) return;

	/* Everything the demo shows. Times are local and written 'YYYY-MM-DD HH:MM'. */
	const SAMPLE = {
		/* The moment the demo treats as "now"; a real app uses the real clock. */
		now: '2026-10-02 10:40',
		me: { name: 'John Armstrong' },

		/* Icon and tone per kind. A single notification may carry its own tone. */
		kinds: {
			mention: { icon: 'bi-at', tone: 'primary' },
			payment: { icon: 'bi-credit-card', tone: 'primary' },
			signup: { icon: 'bi-person-plus', tone: 'success' },
			plan: { icon: 'bi-arrow-up-right-circle', tone: 'success' },
			signin: { icon: 'bi-shield-lock', tone: 'warning' },
			access: { icon: 'bi-key', tone: 'warning' },
			release: { icon: 'bi-rocket-takeoff', tone: 'info' },
			schedule: { icon: 'bi-calendar-x', tone: 'warning' },
			export: { icon: 'bi-file-earmark-arrow-down', tone: 'primary' },
		},

		/* The kinds behind each filter tab. */
		filters: {
			mentions: ['mention'],
			billing: ['payment', 'signup', 'plan'],
			security: ['signin', 'access'],
			schedule: ['schedule'],
		},

		/* A notification carries: id, kind, at, read, who, actor ('person',
       'company' or 'system'; the first two get a monogram, system rows the
       kind's icon), what (rest of the headline), detail (one muted line),
       quote (wrap the detail in quotes), tone, needs (waiting on the reader),
       resolved (short label shown once it is handled) and action, one of
         { type: 'reply', label, where }
         { type: 'open', label, href }
         { type: 'review', label, title, text, choices: [{ id, label, primary, done, toast }] }
         { type: 'retry', label, busy, done, toast }
         { type: 'download', label, busy, file } */
		notifications: [
			{
				id: 'n01',
				kind: 'mention',
				at: '2026-10-02 10:32',
				read: false,
				needs: true,
				actor: 'person',
				who: 'Connie Reese',
				what: 'mentioned you on ticket #4821',
				detail: 'Can you approve a fourth admin seat for Oakhaven Studio? Their ops lead is locked out of the schedule board.',
				quote: true,
				action: { type: 'reply', label: 'Reply', where: 'ticket #4821' },
			},
			{
				id: 'n02',
				kind: 'payment',
				at: '2026-10-02 10:05',
				read: false,
				needs: true,
				tone: 'danger',
				actor: 'company',
				who: 'Lakeside Apparel & Walks',
				what: 'card payment of $1,216.00 failed',
				detail: 'Visa ending 4417 was declined. Second of four tries, the next is on Mon, Oct 5.',
				action: {
					type: 'retry',
					label: 'Retry payment',
					busy: 'Retrying…',
					done: 'Paid',
					toast: 'Lakeside Apparel & Walks paid $1,216.00 on the retry.',
				},
			},
			{
				id: 'n03',
				kind: 'access',
				at: '2026-10-02 09:48',
				read: false,
				needs: true,
				actor: 'person',
				who: 'Hope Stout',
				what: 'asked for the Billing admin role',
				detail: 'I need to see the payment retry log for the Lakeside failures.',
				quote: true,
				action: {
					type: 'review',
					label: 'Review request',
					title: 'Billing admin for 7 days, until Fri, Oct 9',
					text: 'Hope could see invoices, retry payments and refund up to $500.',
					choices: [
						{
							id: 'approve',
							label: 'Approve for 7 days',
							primary: true,
							done: 'Approved',
							toast: 'Hope has Billing admin until Fri, Oct 9.',
						},
						{
							id: 'decline',
							label: 'Decline',
							done: 'Declined',
							toast: 'Hope has been told the request was declined.',
						},
					],
				},
			},
			{
				id: 'n04',
				kind: 'schedule',
				at: '2026-10-02 09:20',
				read: false,
				tone: 'danger',
				actor: 'company',
				who: 'Northgate Analytics',
				what: "visits are not reaching their carers' phones",
				detail: '46 visits waiting to sync since 9:12 am. Hope Stout is on it.',
				action: { type: 'open', label: 'See sync status', href: 'system-status.html' },
			},
			{
				id: 'n05',
				kind: 'signup',
				at: '2026-10-02 08:55',
				read: false,
				actor: 'company',
				who: 'Copperleaf Interiors Co.',
				what: 'signed up for Pro',
				detail: '22 seats, billed yearly: $7,040 a year.',
				action: { type: 'open', label: 'View account', href: 'company-details.html' },
			},
			{
				id: 'n06',
				kind: 'signin',
				at: '2026-10-02 08:31',
				read: true,
				needs: true,
				actor: 'system',
				who: 'Your account',
				what: 'was used to sign in on a new device',
				detail: 'Chrome on macOS, near Boulder, Colorado.',
				action: {
					type: 'review',
					label: 'Check sign-in',
					title: 'Fri, Oct 2 at 8:31 am, from 73.14.208.91',
					text: "If this wasn't you, sign that session out and change your password.",
					choices: [
						{
							id: 'mine',
							label: 'This was me',
							primary: true,
							done: 'Confirmed',
							toast: 'Thanks. That sign-in is marked as yours.',
						},
						{
							id: 'signout',
							label: 'Sign out that session',
							done: 'Signed out',
							toast: 'That session was signed out.',
						},
					],
				},
			},
			{
				id: 'n07',
				kind: 'export',
				at: '2026-10-02 07:58',
				read: true,
				actor: 'system',
				who: 'Your export',
				what: 'is ready to download',
				detail: 'Completed visits, Q3 2026, all regions. CSV, 18.4 MB.',
				action: {
					type: 'download',
					label: 'Download CSV',
					busy: 'Preparing…',
					file: 'completed-visits-q3-2026.csv',
				},
			},
			{
				id: 'n08',
				kind: 'mention',
				at: '2026-10-01 16:12',
				read: false,
				needs: true,
				actor: 'person',
				who: 'Quentin Cook',
				what: "mentioned you on Brightline Photography's account",
				detail: 'They want all 60 seats on Max before the Nov 1 renewal. Two months free if they go yearly?',
				quote: true,
				action: { type: 'reply', label: 'Reply', where: "Brightline Photography's account note" },
			},
			{
				id: 'n09',
				kind: 'release',
				at: '2026-10-01 17:40',
				read: true,
				actor: 'system',
				who: 'Fieldline 4.18',
				what: 'is live for every account',
				detail: 'Travel Planner plans around lunch breaks, and visit photos upload once the signal is back.',
				action: { type: 'open', label: "Read what's new", href: 'help-desk.html' },
			},
			{
				id: 'n10',
				kind: 'plan',
				at: '2026-10-01 14:03',
				read: true,
				actor: 'company',
				who: 'Moorings Photography Studios',
				what: 'moved from Basic to Pro',
				detail: '14 seats. Up $238 a month, to $448.',
				action: { type: 'open', label: 'View account', href: 'company-details.html' },
			},
			{
				id: 'n11',
				kind: 'payment',
				at: '2026-10-01 09:15',
				read: true,
				tone: 'success',
				actor: 'company',
				who: 'Larchwood Games',
				what: 'paid $480.00 on the second try',
				detail: 'Pro, 15 seats. Mastercard ending 0932.',
				action: { type: 'open', label: 'View payment', href: 'receipts.html' },
			},
			{
				id: 'n12',
				kind: 'schedule',
				at: '2026-10-01 08:02',
				read: true,
				actor: 'company',
				who: 'Sunridge Cleaning Co.',
				what: 'has 7 visits with no one assigned on Saturday',
				detail: 'Sat, Oct 3, 7:00 to 11:00 am. Their scheduler has been told.',
				action: { type: 'open', label: 'See the visits', href: 'system-status.html' },
			},
			{
				id: 'n13',
				kind: 'payment',
				at: '2026-09-30 18:20',
				read: true,
				actor: 'system',
				who: 'September billing run',
				what: 'has finished',
				detail: '2,140 invoices sent. 31 cards were declined and will be retried over 10 days.',
				action: { type: 'open', label: 'View the run', href: 'receipts.html' },
			},
			{
				id: 'n14',
				kind: 'access',
				at: '2026-09-30 15:45',
				read: true,
				actor: 'person',
				who: 'Marshall Roe',
				what: 'created an API key',
				detail: '"Mobile build pipeline", read-only access to visits and staff.',
				action: {
					type: 'review',
					label: 'Review key',
					title: 'Read-only, expires Tue, Mar 30, 2027',
					text: "Keep it, or revoke it now if you weren't expecting it.",
					choices: [
						{
							id: 'keep',
							label: 'Keep the key',
							primary: true,
							done: 'Kept',
							toast: 'The key stays active.',
						},
						{
							id: 'revoke',
							label: 'Revoke it',
							done: 'Revoked',
							toast: 'The key was revoked. Marshall has been told.',
						},
					],
				},
			},
			{
				id: 'n15',
				kind: 'mention',
				at: '2026-09-30 13:10',
				read: true,
				resolved: 'Replied',
				actor: 'person',
				who: 'Todd Rudd',
				what: 'mentioned you in the 4.19 release plan',
				detail: 'Can you sign off on the Customer Portal price for the Midwest? The draft has $9 per seat a month.',
				quote: true,
				action: { type: 'reply', label: 'Reply', where: 'the 4.19 release plan' },
			},
			{
				id: 'n16',
				kind: 'schedule',
				at: '2026-09-29 16:40',
				read: true,
				actor: 'company',
				who: 'Oakhaven Studio',
				what: 'has a visit 3 hours past its window',
				detail: 'Morning care #55120. The carer marked it as waiting for a family member.',
				action: { type: 'open', label: 'See the visit', href: 'system-status.html' },
			},
		],

		/* Rows of the channel matrix; a locked row is always on and cannot change. */
		channels: [
			{
				id: 'mentions',
				label: 'Mentions',
				hint: 'When someone writes @John',
				email: true,
				push: true,
				sms: false,
			},
			{
				id: 'billing',
				label: 'Billing',
				hint: 'Failed payments, plan changes',
				email: true,
				push: false,
				sms: false,
			},
			{
				id: 'security',
				label: 'Security',
				hint: 'Always on, every channel',
				email: true,
				push: true,
				sms: true,
				locked: true,
			},
			{
				id: 'schedule',
				label: 'Schedule',
				hint: 'Sync delays, late visits',
				email: false,
				push: true,
				sms: true,
			},
			{
				id: 'product',
				label: 'Releases',
				hint: 'New versions and exports',
				email: true,
				push: false,
				sms: false,
			},
		],

		quiet: { on: true, from: '21:00', to: '07:00' },
	};

	/* The three columns of the channel matrix. */
	const WAYS = [
		{ id: 'email', name: 'Email', icon: 'bi-envelope' },
		{ id: 'push', name: 'Push', icon: 'bi-phone' },
		{ id: 'sms', name: 'SMS', icon: 'bi-chat-dots' },
	];
	const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DAY_MS = 86400000;
	const FALLBACK_KIND = { icon: 'bi-bell', tone: 'primary' };
	const REFRESH_EVERY = 30000;

	/* Text for the three states the feed can land in instead of rows. */
	const NOTICES = {
		error: {
			tone: 'danger',
			alert: true,
			icon: 'bi-wifi-off',
			title: "Your notifications didn't load",
			text: "The server didn't answer. Nothing has been lost.",
			button: ['Try again', 'data-ntf-reload'],
		},
		cleared: {
			tone: 'success',
			icon: 'bi-check2-circle',
			title: "You're all caught up",
			text: 'New mentions, payments and alerts will show up here.',
		},
		filtered: {
			tone: 'muted',
			icon: 'bi-funnel',
			title: 'Nothing here right now',
			text: 'No notifications match this filter.',
			button: ['Show all', 'data-ntf-show-all'],
		},
	};

	const demoMode = new URLSearchParams(location.search).get('state');
	const bootedAt = Date.now();
	const SAMPLE_CLOCK = readStamp(SAMPLE.now);

	/* What the page holds in memory. */
	let feedItems = [];
	let channelRows = [];
	let quietHours = null;
	let loadAttempts = 0;
	const view = {
		filter: 'all',
		sort: 'newest',
		/* Checkboxes and the bulk bar are on screen. */
		selecting: false,
		selected: new Set(),
		/* The row whose reply or review box is open. */
		box: null,
		/* Reply text kept while its box is closed. */
		drafts: {},
		/* Rows with an action in flight. */
		busy: {},
		loading: true,
		error: false,
	};

	const ui = {
		feed: pick('[data-ntf-feed]', page),
		tabs: pickAll('[data-ntf-filter]', page),
		counts: pickAll('[data-ntf-count]', page),
		sortLabel: pick('[data-ntf-sort-label]', page),
		sorts: pickAll('[data-ntf-sort]', page),
		selectMode: pick('[data-ntf-select-mode]', page),
		selectLabel: pick('[data-ntf-select-label]', page),
		bulkBar: pick('#ntf-bulk', page),
		selectAll: pick('[data-ntf-select-all]', page),
		selCount: pick('[data-ntf-sel-count]', page),
		bulk: pickAll('[data-ntf-bulk]', page),
		prefs: pick('#ntf-prefs', page),
		kinds: pick('[data-ntf-kinds]', page),
		quiet: pick('[data-ntf-quiet]', page),
		quietFrom: pick('[data-ntf-quiet-from]', page),
		quietTo: pick('[data-ntf-quiet-to]', page),
		strip: pick('[data-ntf-strip]', page),
		stripBar: pick('[data-ntf-strip-bar]', page),
		quietSum: pick('[data-ntf-quiet-sum]', page),
		stat: {
			since: pick('[data-ntf-stat="since"]', page),
			unread: pick('[data-ntf-stat="unread"]', page),
			needs: pick('[data-ntf-stat="needs"]', page),
		},
	};

	/* One method per request. The demo answers after a short pause; replace
     each body with a fetch() that resolves to the same shape. */
	const server = {
		/* GET /api/notifications -> { notifications, channels, quiet } */
		load() {
			loadAttempts += 1;
			if (demoMode === 'error' && loadAttempts === 1)
				return settle(500).then(() => {
					throw new Error('The server did not answer');
				});
			const notifications = demoMode === 'empty' ? [] : SAMPLE.notifications;
			return settle(400, { notifications, channels: SAMPLE.channels, quiet: SAMPLE.quiet });
		},
		/* PATCH /api/notifications { ids, read } */
		markRead(ids, read) {
			return roundTrip(150);
		},
		/* POST /api/notifications/dismiss { ids, dismissed }; false restores them */
		dismiss(ids, dismissed) {
			return roundTrip(150);
		},
		/* POST /api/notifications/snooze { ids, until }; a null until wakes them */
		snooze(ids, until) {
			return roundTrip(150);
		},
		/* POST /api/notifications/:id/reply { text }, posted on the ticket or note */
		reply(id, text) {
			return roundTrip(450);
		},
		/* POST /api/notifications/:id/actions/:action, where action is retry,
       download, approve, decline, mine, signout, keep or revoke */
		act(id, action) {
			return roundTrip(action === 'retry' || action === 'download' ? 1300 : 350);
		},
		/* PUT /api/notification-settings/channels/:kind { email | push | sms } */
		saveChannel(kind, channel, on) {
			return roundTrip(250);
		},
		/* PUT /api/notification-settings/quiet { on, from, to } */
		saveQuiet(quiet) {
			return roundTrip(250);
		},
	};

	/* Wires the page, draws the preferences from the sample and asks the
     server for the feed. Runs once, at the end of this file. */
	function start() {
		buildHourOptions(ui.quietFrom);
		buildHourOptions(ui.quietTo);
		channelRows = SAMPLE.channels.map((row) => ({ ...row }));
		quietHours = { ...SAMPLE.quiet };
		paintMatrix();
		paintQuiet();

		ui.feed.addEventListener('click', onFeedClick);
		ui.feed.addEventListener('change', onFeedCheck);
		ui.feed.addEventListener('input', onReplyTyping);
		ui.feed.addEventListener('keydown', onReplyKeys);

		for (const tab of ui.tabs) tab.addEventListener('click', () => chooseFilter(tab.dataset.ntfFilter));
		for (const option of ui.sorts) option.addEventListener('click', () => chooseSort(option));
		ui.selectMode.addEventListener('click', flipSelectMode);
		ui.selectAll.addEventListener('change', selectEverything);
		for (const button of ui.bulk) button.addEventListener('click', () => runBulk(button.dataset.ntfBulk));

		ui.kinds.addEventListener('click', onChannelClick);
		for (const control of [ui.quiet, ui.quietFrom, ui.quietTo]) control.addEventListener('change', storeQuiet);

		fetchFeed();
		setInterval(tick, REFRESH_EVERY);
	}

	/* DOM and text helpers. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function safe(value) {
		const swap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (ch) => swap[ch]);
	}

	function say(text) {
		window.Basalt.announce?.(text);
	}

	function notify(options) {
		return window.Basalt.toasts?.push(options) ?? null;
	}

	function countOf(amount, singular, pluralForm = `${singular}s`) {
		return `${amount} ${amount === 1 ? singular : pluralForm}`;
	}

	/* Promise helpers behind the fake server. */

	function settle(ms, value) {
		return new Promise((resolve) => setTimeout(() => resolve(value), ms));
	}

	function roundTrip(ms) {
		if (demoMode !== 'offline') return settle(ms);
		return settle(ms).then(() => {
			throw new Error('offline');
		});
	}

	/* Dates and clocks. */

	function readStamp(text) {
		const found = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(text || '');
		if (!found) return null;
		const [, year, month, dayOfMonth, hours, minutes] = found.map(Number);
		return new Date(year, month - 1, dayOfMonth, hours, minutes);
	}

	function twoDigits(number) {
		return String(number).padStart(2, '0');
	}

	function writeStamp(date) {
		const datePart = `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
		return `${datePart} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
	}

	/* The demo clock runs from SAMPLE.now at real speed. */
	function clock() {
		return new Date(SAMPLE_CLOCK.getTime() + (Date.now() - bootedAt));
	}

	function meridiem(hours) {
		return hours < 12 ? ' am' : ' pm';
	}

	function clockFromText(hhmm) {
		const hours = +hhmm.slice(0, 2);
		return `${hours % 12 || 12}:${hhmm.slice(3, 5)}${meridiem(hours)}`;
	}

	function clockOf(date) {
		return `${date.getHours() % 12 || 12}:${twoDigits(date.getMinutes())}${meridiem(date.getHours())}`;
	}

	function dateWords(date) {
		return `${WEEKDAYS[date.getDay()]}, ${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
	}

	function midnightOf(date) {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate());
	}

	function dayGap(from, to) {
		return Math.round((midnightOf(to) - midnightOf(from)) / DAY_MS);
	}

	/** Short relative time for the end of a row, which already sits under a day label. */
	function sinceLabel(date) {
		const minutes = Math.round((clock() - date) / 60000);
		const days = dayGap(date, clock());
		if (minutes < 1) return 'Now';
		if (minutes < 60) return `${minutes} min`;
		if (days === 0) return `${Math.floor(minutes / 60)} hr`;
		if (days === 1) return clockOf(date);
		return `${WEEKDAYS[date.getDay()]} ${clockOf(date)}`;
	}

	function bucketOf(date) {
		const days = dayGap(date, clock());
		if (days <= 0) return 'Today';
		if (days === 1) return 'Yesterday';
		if (days < 7) return 'Earlier this week';
		return 'Older';
	}

	/** The moment a snoozed row comes back for a menu choice ('1h', 'tomorrow', 'week'). */
	function wakeTime(choice) {
		const current = clock();
		if (choice === '1h') return new Date(current.getTime() + 3600000);
		if (choice === 'tomorrow')
			return new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1, 8, 0);
		/* Next week means the coming Monday at eight. */
		const untilMonday = (8 - current.getDay()) % 7 || 7;
		return new Date(current.getFullYear(), current.getMonth(), current.getDate() + untilMonday, 8, 0);
	}

	function whenLabel(date) {
		const days = dayGap(clock(), date);
		if (days === 0) return `today at ${clockOf(date)}`;
		if (days === 1) return `tomorrow at ${clockOf(date)}`;
		return `${dateWords(date)} at ${clockOf(date)}`;
	}

	/* Reading one notification. */

	function kindMeta(item) {
		return SAMPLE.kinds[item.kind] || FALLBACK_KIND;
	}

	function toneFor(item) {
		return item.tone || kindMeta(item).tone;
	}

	function headline(item) {
		return `${item.who} ${item.what}`;
	}

	function monogram(name) {
		const words = name
			.replace(/[^\p{L}\s]/gu, ' ')
			.trim()
			.split(/\s+/);
		return words
			.slice(0, 2)
			.map((word) => word[0])
			.join('')
			.toUpperCase();
	}

	/** A stable pick of one of the six chart colors for a name. */
	function hueSlot(name) {
		let sum = 0;
		for (const ch of name) sum += ch.charCodeAt(0);
		return 1 + (sum % 6);
	}

	function itemById(id) {
		return feedItems.find((item) => item.id === id);
	}

	function stillSnoozed(item) {
		return !!item.snoozed && readStamp(item.snoozed) > clock();
	}

	function visible(item) {
		return !item.dismissed && !stillSnoozed(item);
	}

	function pending(item) {
		return item.needs && !item.resolved;
	}

	function fitsFilter(item, filter = view.filter) {
		if (filter === 'all') return true;
		if (filter === 'unread') return !item.read;
		return (SAMPLE.filters[filter] || []).includes(item.kind);
	}

	/** The rows on screen for the current filter and sort. */
	function orderedList() {
		const direction = view.sort === 'oldest' ? 1 : -1;
		return feedItems
			.filter((item) => visible(item) && fitsFilter(item))
			.sort((left, right) => direction * (readStamp(left.at) - readStamp(right.at)));
	}

	/* Markup for one row. */

	function avatarMarkup(item) {
		const meta = kindMeta(item);
		const tone = toneFor(item);
		const glyph = `<i class="bi ${meta.icon}"></i>`;
		if (!item.actor || item.actor === 'system') {
			return `<span class="ntf-who ntf-who-glyph ntf-tone-${tone}" aria-hidden="true">${glyph}</span>`;
		}
		const shape = item.actor === 'company' ? ' ntf-who-org' : '';
		return `<span class="ntf-who ntf-hue-${hueSlot(item.who)}${shape}" aria-hidden="true">${safe(monogram(item.who))}<span class="ntf-who-badge ntf-tone-${tone}">${glyph}</span></span>`;
	}

	function ctaMarkup(item) {
		const action = item.action;
		if (item.resolved)
			return `<span class="ntf-done"><i class="bi bi-check2-circle" aria-hidden="true"></i>${safe(item.resolved)}</span>`;
		if (!action) return '';
		const named = ` aria-label="${safe(`${action.label}: ${headline(item)}`)}"`;
		if (action.type === 'open') {
			return `<a class="ntf-cta" href="${safe(action.href)}" data-ntf-act data-ntf-key="act"${named}>${safe(action.label)}<i class="bi bi-arrow-right" aria-hidden="true"></i></a>`;
		}
		if (view.busy[item.id]) {
			return `<button type="button" class="ntf-cta" aria-disabled="true" data-ntf-act data-ntf-key="act"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>${safe(action.busy)}</button>`;
		}
		if (action.type === 'reply' || action.type === 'review') {
			const expanded = view.box === item.id;
			const controls = expanded ? ` aria-controls="ntf-box-${item.id}"` : '';
			const lead = action.type === 'reply' ? '<i class="bi bi-reply" aria-hidden="true"></i>' : '';
			return `<button type="button" class="ntf-cta" data-ntf-act data-ntf-key="act"${named} aria-expanded="${expanded}"${controls}>${lead}${safe(action.label)}<i class="bi bi-chevron-down ntf-cta-caret" aria-hidden="true"></i></button>`;
		}
		const icon = action.type === 'retry' ? 'bi-arrow-repeat' : 'bi-download';
		return `<button type="button" class="ntf-cta" data-ntf-act data-ntf-key="act"${named}><i class="bi ${icon}" aria-hidden="true"></i>${safe(action.label)}</button>`;
	}

	function trayMarkup(item) {
		const title = safe(headline(item));
		const readWord = item.read ? 'Mark unread' : 'Mark read';
		const readIcon = item.read ? 'bi-envelope' : 'bi-envelope-open';
		const snoozeMenu =
			'<ul class="dropdown-menu dropdown-menu-end"><li><span class="dropdown-header">Remind me in</span></li><li><button type="button" class="dropdown-item" data-ntf-snooze="1h">1 hour</button></li><li><button type="button" class="dropdown-item" data-ntf-snooze="tomorrow">Tomorrow morning</button></li><li><button type="button" class="dropdown-item" data-ntf-snooze="week">Next week</button></li></ul>';
		return `<div class="ntf-tray"><button type="button" class="ntf-tray-btn" aria-label="${readWord}: ${title}" title="${readWord}" data-ntf-toggle-read data-ntf-key="read"><i class="bi ${readIcon}" aria-hidden="true"></i></button><div class="dropdown"><button type="button" class="ntf-tray-btn" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Snooze: ${title}" title="Snooze" data-ntf-key="snooze"><i class="bi bi-alarm" aria-hidden="true"></i></button>${snoozeMenu}</div><button type="button" class="ntf-tray-btn" aria-label="Dismiss: ${title}" title="Dismiss" data-ntf-dismiss data-ntf-key="dismiss"><i class="bi bi-x-lg" aria-hidden="true"></i></button></div>`;
	}

	function inlineMarkup(item) {
		const action = item.action;
		const boxId = `ntf-box-${item.id}`;
		if (action.type === 'reply') {
			const fieldId = `ntf-reply-${item.id}`;
			return `<div class="ntf-inline" id="${boxId}"><label class="ntf-inline-label" for="${fieldId}">Reply to ${safe(item.who)} on ${safe(action.where)}</label><textarea class="form-control form-control-sm" id="${fieldId}" rows="2" placeholder="Write a reply. Ctrl+Enter sends it." aria-describedby="ntf-reply-err-${item.id}" data-ntf-reply data-ntf-key="reply">${safe(view.drafts[item.id] || '')}</textarea><div class="invalid-feedback" id="ntf-reply-err-${item.id}">Write something first.</div><div class="ntf-inline-foot"><button type="button" class="btn btn-primary btn-sm" data-ntf-send data-ntf-key="send"><i class="bi bi-send me-1" aria-hidden="true"></i>Send reply</button>${cancelButton('Cancel')}</div></div>`;
		}
		const choices = action.choices
			.map((choice, index) => {
				const look = choice.primary ? 'btn-primary' : 'btn-outline-secondary';
				return `<button type="button" class="btn btn-sm ${look}" data-ntf-choice="${safe(choice.id)}" data-ntf-key="choice-${index}">${safe(choice.label)}</button>`;
			})
			.join('');
		return `<div class="ntf-inline" id="${boxId}" role="group" aria-labelledby="${boxId}-title"><p class="ntf-inline-label" id="${boxId}-title">${safe(action.title)}</p><p class="ntf-inline-text">${safe(action.text)}</p><div class="ntf-inline-foot">${choices}${cancelButton('Not now')}</div></div>`;
	}

	function cancelButton(word) {
		return `<button type="button" class="btn btn-sm btn-link ntf-inline-cancel" data-ntf-close-box data-ntf-key="cancel">${word}</button>`;
	}

	function rowMarkup(item) {
		const when = readStamp(item.at);
		const title = headline(item);
		const picked = view.selected.has(item.id);
		const classes = `ntf-row${item.read ? '' : ' is-unread'}${picked ? ' is-selected' : ''}`;
		const checkbox = view.selecting
			? `<input class="form-check-input ntf-row-check" type="checkbox" data-ntf-check data-ntf-key="check" aria-label="Select: ${safe(title)}"${picked ? ' checked' : ''}>`
			: '';
		const unreadNote = item.read ? '' : '<span class="visually-hidden">Unread. </span>';
		const detailText = item.quote ? `“${safe(item.detail)}”` : safe(item.detail);
		const detail = item.detail ? `<p class="ntf-row-detail">${detailText}</p>` : '';
		const box = view.box === item.id ? inlineMarkup(item) : '';
		const time = `<time class="ntf-row-time" datetime="${safe(item.at.replace(' ', 'T'))}" title="${safe(`${dateWords(when)}, ${clockOf(when)}`)}" data-ntf-ago="${item.id}">${safe(sinceLabel(when))}</time>`;
		return `<li class="${classes}" id="ntf-row-${item.id}" data-id="${item.id}"><div class="ntf-row-main">${checkbox}${avatarMarkup(item)}<div class="ntf-row-body"><div class="ntf-row-head"><p class="ntf-row-title">${unreadNote}<strong>${safe(item.who)}</strong> ${safe(item.what)}</p>${time}</div>${detail}<div class="ntf-row-foot">${ctaMarkup(item)}${trayMarkup(item)}</div>${box}</div></div></li>`;
	}

	/* Markup for the feed as a whole. */

	function placeholderMarkup() {
		const bars = Array.from({ length: 5 }, (_, index) => {
			const first = 52 + ((index * 9) % 30);
			const second = 70 + ((index * 7) % 22);
			return `<div class="ntf-skel" aria-hidden="true"><span class="basalt-skeleton basalt-skeleton-circle"></span><div class="ntf-skel-lines"><span class="basalt-skeleton basalt-skeleton-line d-block" style="width:${first}%"></span><span class="basalt-skeleton basalt-skeleton-line d-block mt-2" style="width:${second}%"></span></div></div>`;
		});
		return `${bars.join('')}<p class="visually-hidden">Loading notifications</p>`;
	}

	function noticeMarkup(notice) {
		const role = notice.alert ? ' role="alert"' : ' role="status"';
		const button = notice.button
			? `<button type="button" class="btn btn-sm btn-outline-secondary mt-2" ${notice.button[1]}>${safe(notice.button[0])}</button>`
			: '';
		return `<div class="ntf-state"><div class="basalt-empty basalt-empty-${notice.tone}"${role}><span class="basalt-empty-icon" aria-hidden="true"><i class="bi ${notice.icon}"></i></span><p class="basalt-empty-title">${safe(notice.title)}</p><p class="basalt-empty-text">${safe(notice.text)}</p>${button}</div></div>`;
	}

	function dayMarkup(bucket) {
		const headingId = `ntf-day-${bucket.name.toLowerCase().replace(/\s+/g, '-')}`;
		return `<div class="ntf-day"><h3 class="ntf-day-title" id="${headingId}"><span>${bucket.name}</span><span class="ntf-day-n">${countOf(bucket.rows.length, 'item')}</span></h3><ul class="ntf-list" aria-labelledby="${headingId}">${bucket.rows.map(rowMarkup).join('')}</ul></div>`;
	}

	function snoozedFootMarkup() {
		const asleep = feedItems.filter((item) => !item.dismissed && stillSnoozed(item)).length;
		if (!asleep) return '';
		const verb = asleep === 1 ? 'It comes' : 'They come';
		const owner = asleep === 1 ? 'its' : 'their';
		return `<p class="ntf-foot"><i class="bi bi-alarm me-1" aria-hidden="true"></i>${countOf(asleep, 'notification')} snoozed. ${verb} back on ${owner} own.</p>`;
	}

	/* Focus bookkeeping across redraws. */

	/** Where focus is inside the feed, as a row id and a data-ntf-key, so it can come back. */
	function rememberFocus() {
		const active = document.activeElement;
		if (!active || !ui.feed.contains(active)) return null;
		const row = active.closest('[data-id]');
		return row ? { id: row.dataset.id, key: active.dataset.ntfKey } : null;
	}

	function returnFocus(memo) {
		if (!memo) return;
		const row = pick(`[data-id="${memo.id}"]`, ui.feed);
		if (!row) {
			const fallback = pick('[data-ntf-act], [data-ntf-key="snooze"]', ui.feed) || ui.tabs[0];
			fallback.focus();
			return;
		}
		const target =
			(memo.key && pick(`[data-ntf-key="${memo.key}"]`, row)) ||
			pick('[data-ntf-key="act"]', row) ||
			pick('[data-ntf-key="snooze"]', row);
		target?.focus();
	}

	/** The id of the row after (or, failing that, before) the given one. */
	function nextRowId(id) {
		const rows = pickAll('[data-id]', ui.feed);
		const index = rows.findIndex((row) => row.dataset.id === id);
		const chosen = rows[index + 1] || rows[index - 1];
		return chosen ? chosen.dataset.id : null;
	}

	/* Painting the page. */

	function paint(memo) {
		paintChrome();
		paintFeed(memo);
	}

	/** Redraws the list. memo: undefined keeps focus where it is, null drops it, an object restores it. */
	function paintFeed(memo) {
		const keep = memo === undefined ? rememberFocus() : memo;
		ui.feed.setAttribute('aria-busy', String(view.loading));
		ui.feed.classList.toggle('is-selecting', view.selecting);
		if (view.loading) {
			ui.feed.innerHTML = placeholderMarkup();
			return;
		}
		if (view.error) {
			ui.feed.innerHTML = noticeMarkup(NOTICES.error);
			return;
		}
		const rows = orderedList();
		if (!feedItems.some(visible)) {
			ui.feed.innerHTML = noticeMarkup(NOTICES.cleared);
			return;
		}
		if (!rows.length) {
			ui.feed.innerHTML = noticeMarkup(NOTICES.filtered);
			return;
		}
		const buckets = [];
		for (const item of rows) {
			const name = bucketOf(readStamp(item.at));
			const last = buckets[buckets.length - 1];
			if (last?.name === name) last.rows.push(item);
			else buckets.push({ name, rows: [item] });
		}
		ui.feed.innerHTML = buckets.map(dayMarkup).join('') + snoozedFootMarkup();
		returnFocus(keep);
	}

	/** Header figures, tabs, sort menu, select mode and the bulk bar. */
	function paintChrome() {
		const ready = !view.loading && !view.error;
		const onScreen = feedItems.filter(visible);
		const unread = onScreen.filter((item) => !item.read).length;

		for (const tab of ui.tabs) tab.setAttribute('aria-pressed', String(tab.dataset.ntfFilter === view.filter));
		for (const badge of ui.counts)
			badge.textContent = onScreen.filter((item) => fitsFilter(item, badge.dataset.ntfCount)).length;

		/* A selection only counts while its row is still in the list. */
		for (const id of view.selected) {
			const item = itemById(id);
			if (!item || !visible(item)) view.selected.delete(id);
		}
		const chosen = view.selected.size;
		const rows = ready ? orderedList() : [];
		const everyRow = rows.length > 0 && rows.every((item) => view.selected.has(item.id));
		ui.selectMode.setAttribute('aria-pressed', String(view.selecting));
		ui.selectMode.disabled = !ready || !onScreen.length;
		ui.selectLabel.textContent = view.selecting ? 'Done' : 'Select';
		ui.bulkBar.hidden = !view.selecting;
		ui.selCount.textContent = chosen ? `${countOf(chosen, 'notification')} selected` : 'Select all shown';
		ui.selectAll.checked = everyRow;
		ui.selectAll.indeterminate = chosen > 0 && !everyRow;
		ui.selectAll.disabled = !rows.length;
		for (const button of ui.bulk) button.disabled = !chosen;

		for (const option of ui.sorts) {
			const current = option.dataset.ntfSort === view.sort;
			option.classList.toggle('active', current);
			if (!current) {
				option.removeAttribute('aria-current');
				continue;
			}
			option.setAttribute('aria-current', 'true');
			ui.sortLabel.textContent = option.textContent.trim();
		}

		const yesterday = new Date(clock().getTime() - DAY_MS);
		const recent = feedItems.filter((item) => !item.dismissed && readStamp(item.at) >= yesterday).length;
		ui.stat.since.textContent = ready ? recent : '0';
		ui.stat.unread.textContent = unread;
		ui.stat.needs.textContent = onScreen.filter(pending).length;
	}

	/* The preferences column. */

	function channelCell(row, way) {
		const on = !!row[way.id];
		const locked = row.locked ? ' disabled title="Always on"' : '';
		return `<td><button type="button" class="ntf-chan" aria-pressed="${on}"${locked} aria-label="${way.name} for ${safe(row.label)}" data-ntf-channel="${row.id}" data-ntf-via="${way.id}"><i class="bi ${way.icon}${on ? '-fill' : ''}" aria-hidden="true"></i></button></td>`;
	}

	function paintMatrix() {
		ui.kinds.innerHTML = channelRows
			.map((row) => {
				const lock = row.locked ? '<i class="bi bi-lock-fill" aria-hidden="true"></i>' : '';
				const cells = WAYS.map((way) => channelCell(row, way)).join('');
				return `<tr${row.locked ? ' class="is-locked"' : ''}><th scope="row"><span class="ntf-matrix-kind">${safe(row.label)}${lock}</span><span class="ntf-matrix-hint">${safe(row.hint)}</span></th>${cells}</tr>`;
			})
			.join('');
	}

	function hourValue(hhmm) {
		const [hours, minutes] = hhmm.split(':').map(Number);
		return hours + minutes / 60;
	}

	function buildHourOptions(select) {
		const options = [];
		for (let hour = 0; hour < 24; hour += 1) {
			options.push(
				`<option value="${twoDigits(hour)}:00">${hour % 12 || 12}:00 ${hour < 12 ? 'am' : 'pm'}</option>`,
			);
		}
		select.innerHTML = options.join('');
	}

	function paintQuiet() {
		const { on, from, to } = quietHours;
		ui.quiet.checked = on;
		ui.quietFrom.value = from;
		ui.quietTo.value = to;
		ui.quietFrom.disabled = !on;
		ui.quietTo.disabled = !on;

		/* The window on a 24-hour strip; one that crosses midnight is two spans. */
		const start = hourValue(from);
		const end = hourValue(to);
		const spans =
			start < end
				? [[start, end]]
				: [
						[start, 24],
						[0, end],
					];
		const current = clock();
		const shaded = spans
			.filter(([a, b]) => b > a)
			.map(
				([a, b]) =>
					`<span class="ntf-day24-quiet" style="left:${(a / 24) * 100}%;width:${((b - a) / 24) * 100}%"></span>`,
			)
			.join('');
		const marker = `<span class="ntf-day24-now" style="left:${((current.getHours() + current.getMinutes() / 60) / 24) * 100}%"></span>`;
		ui.strip.classList.toggle('is-off', !on);
		ui.stripBar.innerHTML = shaded + marker;
		ui.quietSum.innerHTML = on
			? `<i class="bi bi-moon-stars" aria-hidden="true"></i><span>Push waits from <strong>${clockFromText(from)}</strong> to <strong>${clockFromText(to)}</strong>.</span>`
			: '<i class="bi bi-bell" aria-hidden="true"></i><span>Quiet hours are off. Push comes through any time.</span>';
	}

	/* Changes to notifications. Each one updates the page first and hands the
     server call a rollback for the failure path. */

	/** A catch handler: undo the change, repaint and explain. */
	function rollbackWith(verb, undo) {
		return () => {
			undo?.();
			paint();
			notify({
				tone: 'danger',
				title: `Couldn't ${verb}`,
				text: 'Nothing changed. Check your connection and try again.',
			});
		};
	}

	function idsOf(list) {
		return list.map((item) => item.id);
	}

	function setRead(list, read) {
		const changed = list.filter((item) => item.read !== read);
		if (!changed.length) return;
		for (const item of changed) item.read = read;

		function undo() {
			for (const item of changed) item.read = !read;
		}

		server.markRead(idsOf(changed), read).catch(rollbackWith(`mark ${read ? 'read' : 'unread'}`, undo));
	}

	/** Takes rows out of the list (dismiss or snooze), moving focus to a neighbor when it was one row. */
	function retireRows(list, apply) {
		const memo = list.length === 1 ? { id: nextRowId(list[0].id), key: 'act' } : null;
		for (const item of list) {
			apply(item);
			view.selected.delete(item.id);
			if (view.box === item.id) view.box = null;
		}
		paint(memo);
		if (!memo?.id) ui.tabs[0].focus();
	}

	function clearRows(list) {
		function undo() {
			for (const item of list) item.dismissed = false;
		}

		retireRows(list, (item) => {
			item.dismissed = true;
		});
		server.dismiss(idsOf(list), true).catch(rollbackWith('dismiss it', undo));
		notify({
			tone: 'primary',
			icon: 'bi-x-circle',
			title: list.length === 1 ? 'Dismissed' : `${countOf(list.length, 'notification')} dismissed`,
			text: list.length === 1 ? `${headline(list[0])}.` : "They're gone from the feed.",
			actions: [
				{
					label: 'Undo',
					onClick() {
						undo();
						server.dismiss(idsOf(list), false);
						paint(null);
						say('Dismiss undone');
					},
				},
			],
		});
	}

	function shelveRows(list, choice) {
		const until = writeStamp(wakeTime(choice));
		const earlier = new Map(list.map((item) => [item, item.snoozed]));

		function undo() {
			for (const [item, was] of earlier) item.snoozed = was;
		}

		retireRows(list, (item) => {
			item.snoozed = until;
		});
		server.snooze(idsOf(list), until).catch(rollbackWith('snooze it', undo));
		notify({
			tone: 'primary',
			icon: 'bi-alarm',
			title: `Snoozed until ${whenLabel(readStamp(until))}`,
			text:
				list.length === 1
					? `${headline(list[0])}.`
					: `${countOf(list.length, 'notification')} will come back then.`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						undo();
						server.snooze(idsOf(list), null);
						paint(null);
						say('Snooze undone');
					},
				},
			],
		});
	}

	/* The box slides open under its row and folds away again. Folding
	   happens in place, so the box stays drawn until it has shut; the next
	   repaint of the feed drops it. */
	function flipInline(item) {
		const shutting = view.box === item.id ? document.getElementById(`ntf-box-${item.id}`) : null;
		view.box = view.box === item.id ? null : item.id;
		if (view.box) setRead([item], true);
		paintChrome();
		if (shutting) {
			const cta = pick('[data-ntf-act]', shutting.closest('[data-id]'));
			cta.setAttribute('aria-expanded', 'false');
			cta.removeAttribute('aria-controls');
			window.Basalt.slide(shutting, () => {
				shutting.hidden = true;
			});
			cta.focus();
			return;
		}
		paintFeed(null);
		const row = pick(`[data-id="${item.id}"]`, ui.feed);
		if (!row) return;
		const box = document.getElementById(`ntf-box-${item.id}`);
		if (box) {
			box.hidden = true;
			window.Basalt.slide(box, () => {
				box.hidden = false;
			});
		}
		const target = view.box ? pick('[data-ntf-reply], [data-ntf-choice]', row) : pick('[data-ntf-act]', row);
		target?.focus();
	}

	/** Marks a row handled: resolved label on, needs off, read on, box closed. Returns what to put back. */
	function settleRow(item, label) {
		const was = { resolved: item.resolved, needs: item.needs };
		item.resolved = label;
		item.needs = false;
		item.read = true;
		view.box = null;
		return was;
	}

	function postReply(item, row) {
		const field = pick('[data-ntf-reply]', row);
		const text = field.value.trim();
		if (!text) {
			field.classList.add('is-invalid');
			field.setAttribute('aria-invalid', 'true');
			field.focus();
			return;
		}
		const was = settleRow(item, 'Replied');
		delete view.drafts[item.id];
		paint({ id: item.id, key: 'snooze' });
		notify({
			tone: 'success',
			icon: 'bi-send',
			title: 'Reply sent',
			text: `Posted on ${item.action.where} for ${item.who}.`,
		});
		server.reply(item.id, text).catch(() => {
			Object.assign(item, was);
			view.drafts[item.id] = text;
			view.box = item.id;
			paint(null);
			notify({
				tone: 'danger',
				title: "Your reply wasn't sent",
				text: "It's still in the box. Try again in a moment.",
			});
		});
	}

	function decideOn(item, choiceId) {
		const choice = item.action.choices.find((candidate) => candidate.id === choiceId);
		if (!choice) return;
		const was = settleRow(item, choice.done);
		paint({ id: item.id, key: 'snooze' });
		notify({ tone: 'success', title: choice.done, text: choice.toast });
		server.act(item.id, choice.id).catch(rollbackWith(choice.label.toLowerCase(), () => Object.assign(item, was)));
	}

	/** Retry and download: the row spins until the server answers, and the answer is the news. */
	function fireAction(item) {
		const action = item.action;
		const isRetry = action.type === 'retry';
		view.busy[item.id] = true;
		setRead([item], true);
		paint();
		say(action.busy);
		server
			.act(item.id, action.type)
			.then(() => {
				delete view.busy[item.id];
				if (isRetry) {
					item.resolved = action.done;
					item.needs = false;
				}
				paint();
				if (isRetry) {
					say(action.toast);
					notify({ tone: 'success', icon: 'bi-check2-circle', title: action.done, text: action.toast });
				} else {
					notify({
						tone: 'success',
						icon: 'bi-download',
						title: 'Downloading now',
						text: `${action.file} is on its way to your downloads.`,
					});
				}
			})
			.catch(() => {
				delete view.busy[item.id];
				paint();
				notify({
					tone: 'danger',
					title: isRetry ? "The retry didn't go through" : "The download didn't start",
					text: 'Nothing was charged or changed. Try again in a moment.',
				});
			});
	}

	/* Events inside the feed. */

	function onFeedClick(event) {
		function hit(selector) {
			return event.target.closest(selector);
		}

		if (hit('[data-ntf-reload]')) {
			fetchFeed();
			return;
		}
		if (hit('[data-ntf-show-all]')) {
			chooseFilter('all');
			ui.tabs[0].focus();
			return;
		}
		const row = hit('[data-id]');
		const item = row && itemById(row.dataset.id);
		if (!item) return;

		const cta = hit('[data-ntf-act]');
		if (cta) {
			if (cta.getAttribute('aria-disabled') === 'true') {
				event.preventDefault();
				return;
			}
			const type = item.action.type;
			if (type === 'open') setRead([item], true);
			else if (type === 'reply' || type === 'review') flipInline(item);
			else fireAction(item);
			return;
		}
		if (hit('[data-ntf-toggle-read]')) {
			const read = !item.read;
			setRead([item], read);
			paint({ id: item.id, key: 'read' });
			say(read ? 'Marked read' : 'Marked unread');
			return;
		}
		const snoozeChoice = hit('[data-ntf-snooze]');
		if (snoozeChoice) {
			shelveRows([item], snoozeChoice.dataset.ntfSnooze);
			return;
		}
		if (hit('[data-ntf-dismiss]')) {
			clearRows([item]);
			return;
		}
		if (hit('[data-ntf-send]')) {
			postReply(item, row);
			return;
		}
		const choice = hit('[data-ntf-choice]');
		if (choice) {
			decideOn(item, choice.dataset.ntfChoice);
			return;
		}
		if (hit('[data-ntf-close-box]')) flipInline(item);
	}

	function onFeedCheck(event) {
		const box = event.target.closest('[data-ntf-check]');
		if (!box) return;
		const row = box.closest('[data-id]');
		view.selected[box.checked ? 'add' : 'delete'](row.dataset.id);
		row.classList.toggle('is-selected', box.checked);
		paintChrome();
	}

	function onReplyTyping(event) {
		const field = event.target.closest('[data-ntf-reply]');
		if (!field) return;
		view.drafts[field.closest('[data-id]').dataset.id] = field.value;
		if (field.value.trim()) {
			field.classList.remove('is-invalid');
			field.removeAttribute('aria-invalid');
		}
	}

	function onReplyKeys(event) {
		const field = event.target.closest('[data-ntf-reply]');
		if (!field) return;
		const row = field.closest('[data-id]');
		const item = itemById(row.dataset.id);
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			postReply(item, row);
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			flipInline(item);
		}
	}

	/* Events on the toolbar, bulk bar and header. */

	function chooseFilter(filter) {
		view.filter = filter;
		view.box = null;
		paint(null);
		const shown = orderedList().length;
		say(shown ? `${countOf(shown, 'notification')} shown` : 'Nothing matches this filter');
	}

	function chooseSort(option) {
		view.sort = option.dataset.ntfSort;
		paint(null);
		say(`Sorted ${option.textContent.trim().toLowerCase()}`);
	}

	function flipSelectMode() {
		view.selecting = !view.selecting;
		if (!view.selecting) view.selected.clear();
		paint(null);
		say(view.selecting ? 'Select mode on. Check notifications to act on them together.' : 'Select mode off');
	}

	function selectEverything() {
		if (ui.selectAll.checked) {
			for (const item of orderedList()) view.selected.add(item.id);
		} else {
			view.selected.clear();
		}
		paint(null);
		say(view.selected.size ? `${countOf(view.selected.size, 'notification')} selected` : 'Selection cleared');
	}

	function runBulk(what) {
		const list = feedItems.filter((item) => view.selected.has(item.id));
		if (!list.length) return;
		if (what === 'read' || what === 'unread') {
			setRead(list, what === 'read');
			view.selected.clear();
			paint(null);
			notify({ tone: 'success', title: `${countOf(list.length, 'notification')} marked ${what}` });
			return;
		}
		if (what === 'snooze') shelveRows(list, 'tomorrow');
		if (what === 'dismiss') clearRows(list);
	}

	/* Events in the preferences column. */

	function onChannelClick(event) {
		const button = event.target.closest('[data-ntf-channel]');
		if (!button || button.disabled) return;
		const row = channelRows.find((candidate) => candidate.id === button.dataset.ntfChannel);
		const wayId = button.dataset.ntfVia;
		const way = WAYS.find((candidate) => candidate.id === wayId);
		const on = !row[wayId];
		const label = `${way.name} for ${row.label}`;

		/* The matrix is rebuilt, so focus is put back on the same cell when the body took it. */
		function repaint() {
			paintMatrix();
			const sameCell = pick(`[data-ntf-channel="${row.id}"][data-ntf-via="${wayId}"]`, ui.kinds);
			if (sameCell && document.activeElement === document.body) sameCell.focus();
		}

		row[wayId] = on;
		repaint();
		say(`${label}${on ? ' on' : ' off'}`);
		server.saveChannel(row.id, wayId, on).catch(() => {
			row[wayId] = !on;
			repaint();
			notify({ tone: 'danger', title: "Couldn't save that", text: `${label} is back to ${on ? 'off' : 'on'}.` });
		});
	}

	function storeQuiet() {
		const earlier = { ...quietHours };
		quietHours = {
			on: ui.quiet.checked,
			from: ui.quietFrom.value || earlier.from,
			to: ui.quietTo.value || earlier.to,
		};
		paintQuiet();
		say(
			quietHours.on
				? `Quiet hours on, ${clockFromText(quietHours.from)} to ${clockFromText(quietHours.to)}`
				: 'Quiet hours off',
		);
		server.saveQuiet(quietHours).catch(() => {
			quietHours = earlier;
			paintQuiet();
			notify({ tone: 'danger', title: "Couldn't save quiet hours", text: "They're back to how they were." });
		});
	}

	/* Loading and the clock. */

	function fetchFeed() {
		view.loading = true;
		view.error = false;
		paint(null);
		server
			.load()
			.then((reply) => {
				feedItems = reply.notifications.map((item) => ({ ...item }));
				channelRows = reply.channels.map((row) => ({ ...row }));
				quietHours = { ...reply.quiet };
				view.loading = false;
				paintMatrix();
				paintQuiet();
				paint(null);
			})
			.catch(() => {
				view.loading = false;
				view.error = true;
				paint(null);
				const retry = pick('[data-ntf-reload]', ui.feed);
				if (retry && document.activeElement && ui.feed.contains(document.activeElement)) retry.focus();
			});
	}

	/** Every half minute: wake snoozed rows whose time has come, otherwise refresh the "12 min" labels. */
	function tick() {
		if (view.loading || view.error) return;
		const due = feedItems.filter((item) => item.snoozed && !stillSnoozed(item));
		if (due.some((item) => !item.dismissed)) {
			for (const item of due) item.snoozed = null;
			paint();
			return;
		}
		for (const stamp of pickAll('[data-ntf-ago]', ui.feed)) {
			const item = itemById(stamp.dataset.ntfAgo);
			if (!item) continue;
			const label = sinceLabel(readStamp(item.at));
			if (stamp.textContent.trim() !== label) stamp.textContent = label;
		}
	}

	start();
})();
