/**
 * Audit trail, used by audit-trail.html. A month of made-up team activity is
 * grown from a fixed seed, so the history reads the same on every visit. The
 * log table, the daily chart, the review queue and the people ranking all look
 * at that one history through one shared set of filters. Paging, drawer
 * stepping, toasts, the hold and typed confirmations and the retry countdown
 * are borrowed from basalt.js.
 */
(() => {
	'use strict';

	const shell = pick('[data-al-root]', document);
	if (!shell) return;

	const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* The demo clock is pinned so that "today" agrees with every other page of
     the template. A working store would read the real time here instead. */
	const CLOCK = new Date(2026, 8, 29, 16, 40);
	const DAY_MS = 86400000;
	const HOUR_MS = 3600000;
	const MIDNIGHT = dayStart(CLOCK);
	const CHART_SPAN = 14;

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
	const MONTHS_SHORT = MONTHS_LONG.map((month) => month.slice(0, 3));
	const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	/* Everyone who can touch the store, plus the stock feed that writes on its
     own. Columns: key, name, role, avatar tone, device, device icon, town, IP. */
	const TEAM = [
		[
			'sandra',
			'Sandra Ashby',
			'Head of operations',
			1,
			'Safari on a MacBook',
			'bi-laptop',
			'Eugene, Oregon',
			'203.0.113.24',
		],
		[
			'tom',
			'Tom Nugent',
			'Store manager',
			2,
			'Chrome on Windows',
			'bi-pc-display',
			'Eugene, Oregon',
			'203.0.113.31',
		],
		[
			'dawn',
			'Dawn Fischer',
			'Customer care',
			3,
			'Firefox on Windows',
			'bi-pc-display',
			'Beaverton, Oregon',
			'198.51.100.17',
		],
		['russ', 'Russ McGee', 'Fulfillment', 4, 'Shop app on an iPad', 'bi-tablet', 'Eugene, Oregon', '203.0.113.58'],
		[
			'pamela',
			'Pamela Mayer',
			'Marketing',
			5,
			'Chrome on a MacBook',
			'bi-laptop',
			'Syracuse, New York',
			'198.51.100.92',
		],
		[
			'jonah',
			'Jonah Reed',
			'Customer care',
			6,
			'Edge on Windows',
			'bi-pc-display',
			'Eugene, Oregon',
			'203.0.113.44',
		],
		['connie', 'Connie Dyer', 'Billing', 7, 'Safari on an iPhone', 'bi-phone', 'Salem, Oregon', '198.51.100.140'],
		[
			'sync',
			'Stock sync',
			'Connected app',
			8,
			'Warehouse stock feed',
			'bi-arrow-repeat',
			'Runs on a schedule',
			'192.0.2.10',
		],
		[
			'john',
			'John Armstrong',
			'Administrator',
			1,
			'Chrome on a MacBook',
			'bi-laptop',
			'Eugene, Oregon',
			'203.0.113.12',
		],
	].map(([key, name, role, tone, device, icon, place, ip]) => ({ key, name, role, tone, device, icon, place, ip }));
	const MEMBER = Object.fromEntries(TEAM.map((member) => [member.key, member]));
	const SELF = MEMBER.john;

	/* The slot number picks the chart color for each part of the store. */
	const AREAS = [
		['orders', 'Orders'],
		['catalog', 'Products and prices'],
		['customers', 'Customers'],
		['team', 'Team and sign-ins'],
		['settings', 'Settings'],
	].map(([key, label], index) => ({ key, label, slot: index + 1 }));
	const AREA_BY_KEY = Object.fromEntries(AREAS.map((area) => [area.key, area]));

	const KIND_LABEL = {
		create: 'Added',
		update: 'Changed',
		delete: 'Removed',
		money: 'Refund or credit',
		access: 'Sign-in or access',
		export: 'Export',
	};

	const ALERT_ICONS = {
		'Refund over $150': 'bi-cash-coin',
		'New device': 'bi-phone',
		'More access': 'bi-key',
		'New API key': 'bi-plug',
		'Customer list exported': 'bi-file-earmark-arrow-down',
		'Bank details changed': 'bi-bank',
	};

	const GOODS = [
		['Sculpted Shoulder Blazer', 1290],
		['Draped Column Gown', 2150],
		['Tiered Organza Dress', 1680],
		['Chalk-Stripe Suit', 2450],
		['Leather Trench Coat', 3200],
		['Bar Loafers', 790],
		['Two-Tone Oxfords', 850],
		['Cat-Eye Sunglasses', 465],
		['Shield Sunglasses', 520],
		['E-Gift Card, $250', 25],
		['Made-to-Measure Tailoring', 4800],
		['Private Styling Session', 650],
	];
	const SHOPPERS = [
		'Sandra Franklin',
		'Travis Daugherty',
		'Cheryl Sorensen',
		'Eleanor Fairweather',
		'Christopher Vance',
		'Benjamin Hartley',
		'Sabrina Kavanagh',
		'Georgia Webster',
		'Natalie Tanner',
		'Rochelle Fairbanks',
	];
	const ADDRESSES = [
		'14 Elm Street',
		'22 Alder Way',
		'9 Moorings Road',
		'310 Pine Avenue',
		'5 Coppice Lane',
		'71 Oak Court',
	];

	/* One random source drives every made-up value. Recipes, ids and the live
     feed all draw from it in turn, so the call order is part of the data. */
	const roll = makeRandom(20260929);
	let minted = 0;

	/* What the team does, grouped by the part of the store it touches. Weight
     is how often a recipe comes up and makers are who usually does it; each
     write() returns the headline, the subject and [label, before, after]
     edits, where 'None' stands for an empty value. */
	const PLAYBOOK = {
		orders: [
			{
				weight: 9,
				kind: 'update',
				makers: ['russ', 'russ', 'tom'],
				reversible: true,
				write() {
					const order = orderRef();
					return {
						headline: `Marked order ${order} as shipped`,
						subject: `order ${order}`,
						edits: [
							['Status', 'Packed', 'Shipped'],
							['Tracking', 'None', `1Z${within(100000, 999999)}`],
						],
					};
				},
			},
			{
				weight: 4,
				kind: 'update',
				makers: ['dawn', 'jonah'],
				reversible: true,
				write() {
					const order = orderRef();
					const before = oneOf(ADDRESSES);
					let after = oneOf(ADDRESSES);
					if (after === before) after = ADDRESSES[(ADDRESSES.indexOf(before) + 1) % ADDRESSES.length];
					return {
						headline: `Changed the delivery address on ${order}`,
						subject: `order ${order}`,
						edits: [['Street', before, after]],
					};
				},
			},
			{
				weight: 4,
				kind: 'money',
				makers: ['dawn', 'jonah', 'tom'],
				reversible: false,
				write() {
					const order = orderRef();
					const large = roll() < 0.3;
					const amount = large ? within(152, 240) : within(8, 64) + (roll() < 0.5 ? 0.5 : 0);
					return {
						headline: `Refunded ${dollars(amount)} on order ${order}`,
						subject: `order ${order}`,
						edits: [
							['Refunded', '$0.00', dollars(amount)],
							['Status', 'Delivered', large ? 'Refunded' : 'Part refunded'],
						],
						alert: amount >= 150 ? 'Refund over $150' : null,
					};
				},
			},
			{
				weight: 2,
				kind: 'delete',
				makers: ['dawn', 'tom'],
				reversible: true,
				write() {
					const order = orderRef();
					return {
						headline: `Canceled order ${order}`,
						subject: `order ${order}`,
						edits: [['Status', 'Processing', 'Canceled']],
					};
				},
			},
			{
				weight: 3,
				kind: 'create',
				makers: ['dawn', 'jonah', 'russ'],
				reversible: true,
				write() {
					const order = orderRef();
					const remark = oneOf([
						'Gift wrap, no prices on the slip',
						'Leave it with the neighbor at no. 12',
						'Leave in the porch if nobody is in',
						'Swap the oxfords for the black pair',
					]);
					return {
						headline: `Added a note to order ${order}`,
						subject: `order ${order}`,
						edits: [['Note', 'None', remark]],
					};
				},
			},
		],
		catalog: [
			{
				weight: 5,
				kind: 'update',
				makers: ['pamela', 'tom', 'sandra'],
				reversible: true,
				write() {
					const [item, price] = oneOf(GOODS);
					const raise = roll() < 0.7;
					const updated = raise ? price + oneOf([0.5, 1, 1.5, 2]) : Math.max(1, price - oneOf([0.5, 1, 2]));
					return {
						headline: `Changed the price of ${item}`,
						subject: item,
						edits: [['Price', dollars(price), dollars(updated)]],
					};
				},
			},
			{
				weight: 9,
				kind: 'update',
				makers: ['sync', 'sync', 'sync', 'russ'],
				reversible: true,
				write() {
					const [item] = oneOf(GOODS);
					const onHand = within(0, 40);
					const restocked = onHand + within(6, 60);
					return {
						headline: `Updated stock for ${item}`,
						subject: item,
						edits: [['In stock', String(onHand), String(restocked)]],
					};
				},
			},
			{
				weight: 2,
				kind: 'create',
				makers: ['pamela', 'sandra'],
				reversible: true,
				write() {
					const [item] = oneOf(GOODS);
					return {
						headline: `Put ${item} back on sale`,
						subject: item,
						edits: [['Visible in the Store', 'No', 'Yes']],
					};
				},
			},
			{
				weight: 2,
				kind: 'delete',
				makers: ['pamela', 'tom'],
				reversible: true,
				write() {
					const [item] = oneOf(GOODS);
					return {
						headline: `Took ${item} off sale`,
						subject: item,
						edits: [['Visible in the Store', 'Yes', 'No']],
					};
				},
			},
			{
				weight: 2,
				kind: 'update',
				makers: ['pamela'],
				reversible: true,
				write() {
					const [item] = oneOf(GOODS);
					return {
						headline: `Edited the description of ${item}`,
						subject: item,
						edits: [
							[
								'First line',
								'Cut for a long night out.',
								'Grain de poudre wool that keeps its line all evening.',
							],
						],
					};
				},
			},
			{
				weight: 1,
				kind: 'create',
				makers: ['pamela', 'sandra'],
				reversible: true,
				write() {
					const promo = oneOf(['SCULPT20', 'EXTRAS15', 'FIRSTORDER', 'INSIDERS']);
					const offer = oneOf(['15% off tailoring', '10% off accessories', '$200 off a silk gown']);
					return {
						headline: `Created the discount code ${promo}`,
						subject: promo,
						edits: [
							['Discount', 'None', offer],
							['Ends', 'None', 'Oct 31'],
						],
					};
				},
			},
		],
		customers: [
			{
				weight: 3,
				kind: 'update',
				makers: ['dawn', 'jonah'],
				reversible: true,
				write() {
					const shopper = oneOf(SHOPPERS);
					const mailbox = shopper
						.normalize('NFD')
						.replace(/[̀-ͯ]/g, '')
						.toLowerCase()
						.replace(/[^a-z]+/g, '.');
					return {
						headline: `Changed the email address for ${shopper}`,
						subject: shopper,
						edits: [['Email', `${mailbox}@gmail.com`, `${mailbox}@outlook.com`]],
					};
				},
			},
			{
				weight: 2,
				kind: 'money',
				makers: ['dawn', 'jonah'],
				reversible: true,
				write() {
					const shopper = oneOf(SHOPPERS);
					const credit = oneOf([5, 10, 10, 15, 25]);
					return {
						headline: `Gave ${shopper} ${dollars(credit)} store credit`,
						subject: shopper,
						edits: [['Store credit', '$0.00', dollars(credit)]],
					};
				},
			},
			{
				weight: 3,
				kind: 'update',
				makers: ['dawn', 'jonah'],
				reversible: true,
				write() {
					const shopper = oneOf(SHOPPERS);
					return {
						headline: `Paused the Aftercare Plan for ${shopper}`,
						subject: shopper,
						edits: [
							['Aftercare Plan', 'Active', 'Paused'],
							['Next charge', 'Oct 6', 'None'],
						],
					};
				},
			},
			{
				weight: 0.9,
				kind: 'export',
				makers: ['pamela', 'sandra'],
				reversible: false,
				write() {
					return {
						headline: 'Exported the customer list',
						subject: 'customer list',
						edits: [['File', 'None', 'customers.csv, 2,140 rows']],
						alert: 'Customer list exported',
					};
				},
			},
		],
		team: [
			{
				weight: 7,
				kind: 'access',
				makers: ['sandra', 'tom', 'dawn', 'russ', 'pamela', 'jonah', 'connie'],
				reversible: false,
				write(member) {
					const subject = `${member.name} sign-ins`;
					if (roll() < 0.08)
						return {
							headline: 'Signed in from a new device',
							subject,
							edits: [],
							roaming: true,
							alert: 'New device',
						};
					return { headline: 'Signed in', subject, edits: [] };
				},
			},
			{
				weight: 1.5,
				kind: 'access',
				makers: ['jonah', 'russ', 'pamela'],
				reversible: false,
				write(member) {
					const tries = within(2, 4);
					return {
						headline: 'Couldn’t sign in',
						subject: `${member.name} sign-ins`,
						edits: [['Result', 'None', `Wrong password, ${tries} tries`]],
					};
				},
			},
			{
				weight: 0.6,
				kind: 'access',
				makers: ['sandra'],
				reversible: true,
				write() {
					const teammate = oneOf([MEMBER.jonah, MEMBER.dawn, MEMBER.russ]);
					return {
						headline: `Changed ${teammate.name}’s role`,
						subject: `${teammate.name} role`,
						edits: [['Role', teammate.role, 'Store manager']],
						alert: 'More access',
					};
				},
			},
			{
				weight: 0.5,
				kind: 'access',
				makers: ['sandra', 'tom'],
				reversible: true,
				write() {
					return {
						headline: 'Created an API key for the stock feed',
						subject: 'API keys',
						edits: [
							['Key', 'None', `sk_live_••••${within(1000, 9999)}`],
							['Can', 'None', 'Read and write stock'],
						],
						alert: 'New API key',
					};
				},
			},
			{
				weight: 0.6,
				kind: 'create',
				makers: ['sandra', 'tom'],
				reversible: true,
				write() {
					const invitee = oneOf(['jamie', 'bea', 'kirk', 'meghan']);
					return {
						headline: `Invited ${invitee}@marlo.com to the team`,
						subject: 'team',
						edits: [['Invite', 'None', 'Fulfillment, expires in 7 days']],
					};
				},
			},
		],
		settings: [
			{
				weight: 1,
				kind: 'update',
				makers: ['sandra', 'tom'],
				reversible: true,
				write() {
					const threshold = oneOf([40, 45, 50]);
					return {
						headline: 'Changed the free shipping threshold',
						subject: 'shipping settings',
						edits: [['Free shipping from', `$${threshold}`, `$${threshold + 5}`]],
					};
				},
			},
			{
				weight: 0.6,
				kind: 'update',
				makers: ['connie', 'sandra'],
				reversible: true,
				write() {
					return {
						headline: 'Changed the payout schedule',
						subject: 'payouts',
						edits: [['Payouts', 'Weekly, on Mondays', 'Every day']],
					};
				},
			},
			{
				weight: 0.4,
				kind: 'update',
				makers: ['connie'],
				reversible: true,
				write() {
					return {
						headline: 'Changed the payout bank account',
						subject: 'payouts',
						edits: [['Account', 'Ending 4410', `Ending ${within(1000, 9999)}`]],
						alert: 'Bank details changed',
					};
				},
			},
			{
				weight: 1,
				kind: 'update',
				makers: ['pamela', 'tom'],
				reversible: true,
				write() {
					return {
						headline: 'Edited the shipping confirmation email',
						subject: 'shipping email',
						edits: [['Subject', 'Your order is on its way', 'Your Marlo order is on the way']],
					};
				},
			},
		],
	};
	const RECIPES = Object.entries(PLAYBOOK).flatMap(([area, recipes]) =>
		recipes.map((recipe) => ({ ...recipe, area })),
	);
	const TOTAL_WEIGHT = RECIPES.reduce((sum, recipe) => sum + recipe.weight, 0);

	const HISTORY = growMonth();

	/* Two flagged changes near the start of the week were already looked at. */
	const reviewed = new Map();
	for (const change of HISTORY.filter(
		(entry) => entry.alert && entry.at >= new Date(MIDNIGHT.getTime() - 6 * DAY_MS),
	).slice(-2)) {
		reviewed.set(change.ref, { by: MEMBER.sandra, at: new Date(change.at.getTime() + 3 * HOUR_MS) });
	}

	/* What the visitor is filtering on; span is the period in days. */
	const view = { area: '', query: '', person: '', kind: '', span: 7, day: null };

	const ui = {
		search: pick('[data-al-search]'),
		person: pick('[data-al-person]'),
		kind: pick('[data-al-kind]'),
		body: pick('[data-al-body]'),
		table: pick('[data-al-table]'),
		summary: pick('[data-al-summary]'),
		chips: pick('[data-al-applied]'),
		pager: pick('[data-al-pager]'),
		perPage: pick('[data-basalt-pager-size]'),
		logHeading: pick('#al-log-title'),
	};

	const recordPanel = document.getElementById('al-record');
	const record = {
		undo: pick('[data-al-undo]', recordPanel),
		undoNote: pick('[data-al-undo-none]', recordPanel),
		person: pick('[data-al-r-person]', recordPanel),
		copy: pick('[data-al-r-copy]', recordPanel),
	};

	const review = {
		list: pick('[data-al-checks]'),
		allDone: pick('[data-al-checks-done]'),
		ring: pick('[data-al-ring]'),
		ringValue: pick('[data-al-ring-value]'),
	};

	const ranking = { list: pick('[data-al-people]'), desc: pick('[data-al-people-desc]') };

	const chartCanvas = pick('[data-al-chart]');
	const legendList = pick('[data-al-legend]');
	const chartNote = pick('[data-al-chart-note]');
	const chartDays = Array.from(
		{ length: CHART_SPAN },
		(_, index) => new Date(MIDNIGHT.getTime() - (CHART_SPAN - 1 - index) * DAY_MS),
	);
	const mutedAreas = new Set();
	const DAY_KEYS = {
		ArrowLeft: (index) => index - 1,
		ArrowRight: (index) => index + 1,
		Home: () => 0,
		End: () => CHART_SPAN - 1,
	};

	const liveToggle = pick('[data-al-live]');

	const archive = {
		button: pick('[data-al-archive-open]'),
		slot: pick('[data-al-archive-slot]'),
		template: document.getElementById('al-archive-error'),
	};

	const retention = {
		form: pick('[data-al-keep-form]'),
		months: pick('[data-al-keep-months]'),
		hint: pick('[data-al-keep-hint]'),
		status: pick('[data-al-keep-state]'),
		save: pick('[data-al-keep-save]'),
		signins: pick('[data-al-keep-signins]'),
		shorten: document.getElementById('al-shorten'),
	};

	const exportModal = document.getElementById('al-export');
	const exporting = {
		form: pick('[data-al-export-form]', exportModal),
		go: pick('[data-al-export-go]', exportModal),
		content: pick('.modal-content', exportModal),
	};

	/* Basalt.pager reads total each time it draws, so a new filter only has to
     change the number and send the pager back to page one. */
	const pagerConfig = { total: 0, noun: 'changes', render: paintRange };

	/* recordNav expects a fixed count; reading it through valueOf lets the
     drawer follow the list as it grows or shrinks. */
	const stepCount = {
		valueOf() {
			return Math.max(1, sourceList().length);
		},
	};

	let visible = [];
	let pagerHandle = null;
	let loadDelay = 0;
	let typingDelay = 0;
	let listSource = 'log';
	let shownRecord = null;
	let drawerShowing = false;
	let stepper = null;
	let barChart = null;
	let focusIndex = CHART_SPAN - 1;
	let liveClock = new Date(CLOCK);
	let liveDelay = 0;
	let archiveAttempts = 0;
	let savedRetention = { months: 12, copy: 'never', signins: true };

	function start() {
		bindFilters();
		wireDrawer();
		review.list.addEventListener('click', onReviewClick);
		ranking.list.addEventListener('click', onRankingClick);
		wireChart();
		wireLive();
		wireArchive();
		wireRetention();
		wireExport();

		drawReview();
		paintFigures();
		drawRanking();
		retentionChanged();
		reload(700);
	}

	/* Small shared tools. */

	function pick(selector, scope = shell) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = shell) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return String(value).replace(/[&<>"']/g, (char) => ENTITIES[char]);
	}

	function announce(message) {
		window.Basalt.announce?.(message);
	}

	function toast(options) {
		return window.Basalt.toasts?.push(options) ?? null;
	}

	/* While the drawer is open toasts sit in the middle, clear of its buttons. */
	function moveToasts(where) {
		window.Basalt.toasts?.position(where);
	}

	function buttonState(button, phase) {
		window.Basalt.buttonState?.(button, phase);
	}

	function monogram(name) {
		return name
			.split(' ')
			.map((word) => word.charAt(0))
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}

	function shortName(member) {
		return member.key === 'sync' ? 'Stock sync' : member.name.split(' ')[0];
	}

	function lowerFirst(text) {
		return text.charAt(0).toLowerCase() + text.slice(1);
	}

	/* Seeded numbers and the made-up month. */

	/** A small 32-bit generator: the same seed always yields the same run of floats in [0, 1). */
	function makeRandom(seed) {
		let cursor = seed >>> 0;
		return () => {
			cursor = (cursor + 0x6d2b79f5) >>> 0;
			let mixed = Math.imul(cursor ^ (cursor >>> 15), cursor | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	function oneOf(options) {
		return options[Math.floor(roll() * options.length)];
	}

	function within(low, high) {
		return low + Math.floor(roll() * (high - low + 1));
	}

	function dollars(amount) {
		return `$${amount.toFixed(2)}`;
	}

	function orderRef() {
		return `#${within(48180, 48330)}`;
	}

	/** A short change id: a counter part that always grows, then two random characters. */
	function nextRef() {
		const serial = (0x2f00a + minted * 37).toString(36);
		minted += 1;
		const tail = Math.floor(roll() * 1296)
			.toString(36)
			.padStart(2, '0');
		return `chg_${serial}${tail}`;
	}

	function drawRecipe() {
		let remaining = roll() * TOTAL_WEIGHT;
		return RECIPES.find((recipe) => (remaining -= recipe.weight) <= 0) ?? RECIPES[0];
	}

	/** Builds one change at the given time from a weighted recipe and one of its usual makers. */
	function forge(at) {
		const recipe = drawRecipe();
		const actor = MEMBER[oneOf(recipe.makers)];
		const draft = recipe.write(actor);
		const ref = nextRef();
		const roaming = Boolean(draft.roaming);
		return {
			ref,
			at,
			actor,
			area: recipe.area,
			kind: recipe.kind,
			reversible: recipe.reversible,
			headline: draft.headline,
			subject: draft.subject,
			edits: draft.edits,
			alert: draft.alert || null,
			device: roaming ? 'Chrome on Android' : actor.device,
			icon: roaming ? 'bi-phone' : actor.icon,
			place: roaming ? 'Akron, OH' : actor.place,
			ip: roaming ? `198.51.100.${within(160, 220)}` : actor.ip,
		};
	}

	/** Thirty days of changes, newest first: quieter at weekends, busiest mid-morning. */
	function growMonth() {
		const month = [];
		for (let back = 29; back >= 0; back -= 1) {
			const date = new Date(MIDNIGHT.getTime() - back * DAY_MS);
			const restDay = date.getDay() === 0 || date.getDay() === 6;
			const volume = restDay ? within(4, 8) : within(10, 19);
			for (let made = 0; made < volume; made += 1) {
				const minute = Math.floor(7 * 60 + Math.pow(roll(), 1.25) * 11.5 * 60);
				const at = new Date(date.getTime() + minute * 60000 + within(0, 59) * 1000);
				if (at <= CLOCK) month.push(forge(at));
			}
		}
		return month.sort((older, newer) => newer.at - older.at);
	}

	/* Dates, all measured against the pinned clock. */

	function dayStart(date) {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate());
	}

	function twoDigits(value) {
		return String(value).padStart(2, '0');
	}

	function clockTime(date) {
		const hours = date.getHours();
		return `${hours % 12 || 12}:${twoDigits(date.getMinutes())}${hours < 12 ? ' am' : ' pm'}`;
	}

	function shortDate(date) {
		return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
	}

	function monthYear(date) {
		return `${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
	}

	function dateStamp(date) {
		return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
	}

	function isoMinute(date) {
		return `${dateStamp(date)}T${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
	}

	function daysBefore(date) {
		return Math.round((MIDNIGHT - dayStart(date)) / DAY_MS);
	}

	function dayHeading(date) {
		return ['Today', 'Yesterday'][daysBefore(date)] ?? `${WEEKDAYS[date.getDay()]}, ${shortDate(date)}`;
	}

	function spokenWhen(date) {
		const day = ['today', 'yesterday'][daysBefore(date)] ?? shortDate(date);
		return `${day} at ${clockTime(date)}`;
	}

	function relative(date, now = CLOCK) {
		const minutes = Math.round((now - date) / 60000);
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes} min ago`;
		const days = daysBefore(date);
		if (days === 0) return `${Math.round(minutes / 60)} h ago`;
		return days === 1 ? 'yesterday' : shortDate(date);
	}

	function spanStart() {
		return new Date(MIDNIGHT.getTime() - (view.span - 1) * DAY_MS);
	}

	/* Filtering the log. */

	function bindFilters() {
		ui.logHeading.tabIndex = -1;
		pick('[data-al-people-list]').innerHTML = TEAM.map(
			(member) => `<option value="${htmlSafe(member.name)}"></option>`,
		).join('');

		ui.search.addEventListener('input', () =>
			afterTyping(() => {
				view.query = ui.search.value.trim();
				reload();
			}),
		);
		ui.person.addEventListener('input', () =>
			afterTyping(() => {
				view.person = ui.person.value.trim();
				reload();
			}),
		);
		ui.person.addEventListener('change', () => {
			view.person = ui.person.value.trim();
			reload(true);
		});
		ui.kind.addEventListener('change', () => {
			view.kind = ui.kind.value;
			reload(true);
		});

		for (const radio of pickAll('input[name="al-area"]')) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				view.area = radio.value;
				reload(true);
			});
		}
		for (const radio of pickAll('input[name="al-period"]')) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				view.span = parseInt(radio.value, 10);
				if (view.day && new Date(`${view.day}T12:00`) < spanStart()) view.day = null;
				reload(true);
			});
		}

		ui.body.addEventListener('click', onLogClick);
		document.addEventListener('keydown', onSlashKey);
	}

	/* Search and person typing share one timer, so the last keystroke wins. */
	function afterTyping(apply) {
		clearTimeout(typingDelay);
		typingDelay = setTimeout(apply, 180);
	}

	/* The open button carries the keyboard; a click anywhere on the line works too. */
	function onLogClick(event) {
		const hit = event.target;
		if (hit.closest('[data-al-clear]')) {
			clearFilters();
			ui.search.focus();
			return;
		}
		if (hit.closest('[data-al-widen]')) {
			choosePeriod(30);
			return;
		}
		const row = hit.closest('[data-al-id]');
		if (row) openRecord(row.getAttribute('data-al-id'), 'log');
	}

	function onSlashKey(event) {
		if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.target.closest?.('input, textarea, select, [contenteditable="true"], .modal, .offcanvas')) return;
		event.preventDefault();
		ui.search.focus();
	}

	function haystack(change) {
		const edits = change.edits.map((edit) => edit.join(' ')).join(' ');
		return [change.headline, change.subject, change.actor.name, change.ref, edits].join(' ').toLowerCase();
	}

	/** True when a change passes every filter; the area tabs count with the area filter left out. */
	function fits(change, ignoreArea = false) {
		const inPeriod = change.at >= spanStart() && (!view.day || dateStamp(change.at) === view.day);
		if (!inPeriod) return false;
		if (!ignoreArea && view.area && change.area !== view.area) return false;
		if (view.kind && change.kind !== view.kind) return false;
		if (view.person && !change.actor.name.toLowerCase().includes(view.person.toLowerCase())) return false;
		return !view.query || haystack(change).includes(view.query.toLowerCase());
	}

	/** Escapes the text and wraps whatever the search box matched in <mark>. */
	function highlight(text) {
		const safe = htmlSafe(text).replace(/\w+(?:-\w+)+/g, '<span class="al-unbroken">$&</span>');
		if (!view.query) return safe;
		const pattern = htmlSafe(view.query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const match = new RegExp(`(${pattern})`, 'ig');
		/* Marks go in the words only, never inside the tags around them. */
		return safe.replace(/(<[^>]+>)|([^<]+)/g, (all, tag, words) =>
			tag ? tag : words.replace(match, '<mark>$1</mark>'),
		);
	}

	/**
	 * Redraws everything that depends on the filters. Passing true (or a delay
	 * in ms) shows placeholder rows first, the way a slow request would.
	 */
	function reload(placeholder) {
		clearTimeout(loadDelay);
		if (placeholder) {
			ui.table.setAttribute('aria-busy', 'true');
			ui.summary.textContent = 'Loading changes';
			paintGhosts();
			loadDelay = setTimeout(settle, typeof placeholder === 'number' ? placeholder : 280);
			return;
		}
		settle();
	}

	function settle() {
		visible = HISTORY.filter((change) => fits(change));
		ui.table.setAttribute('aria-busy', 'false');
		tallyAreas();
		drawChips();
		writeSummary();
		syncPager();
		drawRanking();
		recolorBars();
		if (drawerShowing && listSource === 'log') followOpenRecord();
	}

	function clearFilters() {
		ui.search.value = '';
		ui.person.value = '';
		Object.assign(view, { query: '', person: '', day: null });
		if (!view.kind) {
			reload(true);
			return;
		}
		ui.kind.value = '';
		view.kind = '';
		ui.kind.dispatchEvent(new Event('change'));
	}

	function choosePeriod(days) {
		const radio = pick(`input[name="al-period"][value="${days}"]`);
		if (!radio || radio.checked) return;
		radio.checked = true;
		radio.dispatchEvent(new Event('change', { bubbles: true }));
	}

	function tallyAreas() {
		const pool = HISTORY.filter((change) => fits(change, true));
		for (const badge of pickAll('[data-al-count]')) {
			const key = badge.getAttribute('data-al-count');
			badge.textContent = key ? pool.filter((change) => change.area === key).length : pool.length;
		}
	}

	function drawChips() {
		const chips = [];
		if (view.query) {
			chips.push({
				label: `Search: ${view.query}`,
				remove() {
					ui.search.value = '';
					view.query = '';
					reload();
				},
			});
		}
		if (view.person) {
			chips.push({
				label: `Who: ${view.person}`,
				remove() {
					ui.person.value = '';
					view.person = '';
					reload(true);
				},
			});
		}
		if (view.kind) {
			chips.push({
				label: `Kind: ${KIND_LABEL[view.kind]}`,
				remove() {
					ui.kind.value = '';
					ui.kind.dispatchEvent(new Event('change'));
				},
			});
		}
		if (view.day) {
			chips.push({
				label: `Day: ${dayHeading(new Date(`${view.day}T12:00`))}`,
				remove() {
					focusOnDay(null);
				},
			});
		}
		window.Basalt.drawer?.applied(ui.chips, chips, clearFilters, ui.search);
	}

	function writeSummary() {
		const count = visible.length;
		if (!count) {
			ui.summary.textContent = 'No changes match';
			return;
		}
		const authors = new Set(visible.map((change) => change.actor.key)).size;
		let reach = ` in the last ${view.span} days`;
		if (view.day) reach = '';
		else if (view.span === 1) reach = ' today';
		ui.summary.textContent = `${count} ${count === 1 ? 'change' : 'changes'} by ${authors} ${authors === 1 ? 'person' : 'people'}${reach}`;
	}

	function filterToPerson(member) {
		ui.person.value = member.name;
		view.person = member.name;
		reload(true);
		document.getElementById('al-log').scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
		ui.logHeading.focus({ preventScroll: true });
	}

	/* The log table and its pager. */

	function syncPager() {
		pagerConfig.total = visible.length;
		ui.pager.hidden = !visible.length;
		if (!pagerHandle) {
			pagerHandle = window.Basalt.pager?.(ui.pager, pagerConfig) ?? null;
			if (!pagerHandle) paintRange(1, visible.length);
			return;
		}
		const pageSize = parseInt(ui.perPage.value, 10) || 10;
		pagerHandle.setTotal(Math.max(1, Math.ceil(visible.length / pageSize)));
		pagerHandle.set(1);
		/* Firing the size select makes basalt.js redraw the range line and the rows. */
		ui.perPage.dispatchEvent(new Event('change'));
	}

	/** Draws rows first to last (counted from 1) with a heading row wherever the day changes. */
	function paintRange(first, last) {
		if (!visible.length) {
			ui.body.innerHTML = emptyMarkup();
			return;
		}
		const rows = [];
		let heading = '';
		for (const change of visible.slice(first - 1, last)) {
			const stamp = dateStamp(change.at);
			if (stamp !== heading) {
				heading = stamp;
				rows.push(
					`<tr class="al-day"><th colspan="5" scope="colgroup"><span>${dayHeading(change.at)}</span></th></tr>`,
				);
			}
			rows.push(rowMarkup(change));
		}
		ui.body.innerHTML = rows.join('');
		for (const change of HISTORY) change.isNew = false;
	}

	function emptyMarkup() {
		const advice =
			view.span === 1
				? 'Nothing like that has happened today.'
				: 'Try a longer period, another area or fewer filters.';
		const widen =
			view.span === 30
				? ''
				: '<button type="button" class="btn btn-sm btn-primary" data-al-widen>Look at 30 days</button>';
		const actions = `<div class="basalt-empty-actions"><button type="button" class="btn btn-sm btn-outline-secondary" data-al-clear>Clear the filters</button>${widen}</div>`;
		const card = `<div class="basalt-empty basalt-empty-compact"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi bi-search"></i></span><h3 class="basalt-empty-title">No changes match</h3><p class="basalt-empty-text">${advice}</p>${actions}</div>`;
		return `<tr class="basalt-empty-row"><td colspan="5">${card}</td></tr>`;
	}

	function areaTag(area) {
		return `<span class="al-area al-area-${area.slot}">${htmlSafe(area.label)}</span>`;
	}

	/* Only the first edit fits in the table; the drawer lists them all. */
	function deltaMarkup(change) {
		const [first] = change.edits;
		if (!first) return '<span class="al-quiet">No change</span>';
		const [, before, after] = first;
		const was =
			before === 'None'
				? ''
				: `<span class="al-delta-from">${htmlSafe(before)}</span><i class="bi bi-arrow-right" aria-hidden="true"></i><span class="visually-hidden"> to </span>`;
		return `<span class="al-delta">${was}<span class="al-delta-to">${htmlSafe(after)}</span></span>`;
	}

	function rowMarkup(change) {
		const { actor } = change;
		let badge = '';
		if (change.reverted) badge = '<span class="basalt-status basalt-status-info">Put back</span>';
		else if (change.alert && !reviewed.has(change.ref))
			badge = `<span class="basalt-status basalt-status-dot basalt-status-warning">${htmlSafe(change.alert)}</span>`;
		const cells = [
			`<td class="al-col-when"><time datetime="${isoMinute(change.at)}">${clockTime(change.at)}</time></td>`,
			`<td class="al-col-who"><span class="al-who"><span class="basalt-avatar basalt-avatar-xs basalt-avatar-tone-${actor.tone}" aria-hidden="true">${monogram(actor.name)}</span><span class="al-who-name">${highlight(actor.name)}</span></span></td>`,
			`<td class="al-col-what"><button type="button" class="al-open" data-al-open="${change.ref}">${highlight(change.headline)}</button><span class="al-what-meta">${areaTag(AREA_BY_KEY[change.area])}${badge}</span></td>`,
			`<td class="al-col-change">${deltaMarkup(change)}</td>`,
			`<td class="al-col-from"><span class="al-from"><i class="bi ${change.icon}" aria-hidden="true"></i>${htmlSafe(change.place)}</span></td>`,
		];
		return `<tr class="al-row${change.isNew ? ' is-fresh' : ''}" data-al-id="${change.ref}">${cells.join('')}</tr>`;
	}

	function paintGhosts() {
		const still = calm ? ' basalt-skeleton-still' : '';
		function bone(shape, style) {
			return `<span class="basalt-skeleton basalt-skeleton-${shape}${still}" style="${style}"></span>`;
		}
		const rows = Array.from({ length: 6 }, (_, index) =>
			[
				'<tr class="al-row al-row-ghost" aria-hidden="true">',
				`<td class="al-col-when">${bone('text', 'width:2.6rem')}</td>`,
				`<td class="al-col-who"><span class="al-who">${bone('circle', 'width:26px;height:26px')}${bone('text', 'width:6rem')}</span></td>`,
				`<td class="al-col-what">${bone('text', `width:${60 + ((index * 7) % 30)}%`)}${bone('sm', 'width:5rem')}</td>`,
				`<td class="al-col-change">${bone('text', 'width:5.5rem')}</td>`,
				`<td class="al-col-from">${bone('text', 'width:6rem')}</td>`,
				'</tr>',
			].join(''),
		);
		ui.body.innerHTML = rows.join('');
	}

	/* Headline numbers in the page header. */

	function paintFigures() {
		const todays = HISTORY.filter((change) => daysBefore(change.at) === 0);
		const figures = {
			today: todays.length,
			people: new Set(todays.map((change) => change.actor.key)).size,
			check: reviewQueue().filter((change) => !reviewed.has(change.ref)).length,
		};
		for (const [key, value] of Object.entries(figures)) pick(`[data-al-fig="${key}"]`).textContent = value;
	}

	/* The drawer that shows one change in full. */

	function wireDrawer() {
		stepper = window.Basalt.drawer
			? window.Basalt.drawer.recordNav(recordPanel, stepCount, paintRecord)
			: { go: paintRecord, at: 0 };
		recordPanel.addEventListener('show.bs.offcanvas', () => moveToasts('bottom-center'));
		recordPanel.addEventListener('shown.bs.offcanvas', () => {
			drawerShowing = true;
		});
		recordPanel.addEventListener('hidden.bs.offcanvas', () => {
			drawerShowing = false;
			moveToasts('bottom-end');
		});
		record.person.addEventListener('click', () => {
			if (!shownRecord) return;
			const { actor } = shownRecord;
			bootstrap.Offcanvas.getOrCreateInstance(recordPanel).hide();
			filterToPerson(actor);
		});
		record.undo.addEventListener('basalt:confirm', revertShown);
	}

	function sourceList() {
		return listSource === 'log' ? visible : reviewQueue();
	}

	function recordSlot(key) {
		return pick(`[data-al-r="${key}"]`, recordPanel);
	}

	function openRecord(ref, source) {
		listSource = source;
		const index = sourceList().findIndex((change) => change.ref === ref);
		if (index < 0) return;
		stepper.go(index, 0);
		bootstrap.Offcanvas.getOrCreateInstance(recordPanel).show();
	}

	/* When the list changes under an open drawer, stay on the same change. */
	function followOpenRecord() {
		if (!shownRecord) return;
		const index = sourceList().indexOf(shownRecord);
		if (index >= 0) stepper.go(index, 0);
		else paintRecord(Math.min(stepper.at, sourceList().length - 1));
	}

	function paintRecord(index) {
		const list = sourceList();
		const change = list[Math.min(index, list.length - 1)];
		if (!change) return;
		shownRecord = change;
		const { actor } = change;

		const avatar = recordSlot('initials');
		avatar.className = `basalt-avatar basalt-avatar-sm basalt-avatar-tone-${actor.tone}`;
		avatar.textContent = monogram(actor.name);
		recordSlot('title').textContent = change.headline;
		recordSlot('sub').textContent = `${actor.name}, ${actor.role} · ${spokenWhen(change.at)}`;
		recordSlot('tags').innerHTML = recordTags(change);
		recordSlot('diff').innerHTML = beforeAfterMarkup(change);

		recordSlot('id').textContent = change.ref;
		record.copy.setAttribute('data-basalt-copy', change.ref);
		recordSlot('ip').textContent = change.ip;
		recordSlot('device').innerHTML =
			`<i class="bi ${change.icon}" aria-hidden="true"></i> ${htmlSafe(change.device)}`;
		recordSlot('place').textContent = change.place;
		recordSlot('history').innerHTML = earlierMarkup(change);
		record.person.textContent = `Only ${shortName(actor)}’s changes`;

		/* The hold button only makes sense while the change can still be undone. */
		const undoable = change.reversible && !change.reverted;
		record.undo.hidden = !undoable;
		record.undo.classList.remove('is-done', 'is-holding');
		record.undo.style.setProperty('--basalt-hold', '0');
		record.undoNote.hidden = undoable;
		record.undoNote.textContent = change.reverted
			? `Put back by ${change.reverted.by.name}.`
			: 'This kind of change can’t be put back from here.';
	}

	function recordTags(change) {
		const tags = [
			areaTag(AREA_BY_KEY[change.area]),
			`<span class="basalt-status">${KIND_LABEL[change.kind]}</span>`,
		];
		if (change.alert) {
			const check = reviewed.get(change.ref);
			tags.push(
				check
					? `<span class="basalt-status basalt-status-success"><i class="bi bi-check2" aria-hidden="true"></i>Checked by ${htmlSafe(shortName(check.by))}</span>`
					: `<span class="basalt-status basalt-status-dot basalt-status-warning">${htmlSafe(change.alert)}</span>`,
			);
		}
		if (change.reverted)
			tags.push(
				`<span class="basalt-status basalt-status-info">Put back ${relative(change.reverted.at, liveClock)}</span>`,
			);
		return tags.join('');
	}

	function beforeAfterMarkup(change) {
		if (!change.edits.length) {
			return '<p class="al-r-note">Nothing in the Store was changed. Sign-ins are kept so you can see who was in the admin, when, and from which device.</p>';
		}
		const body = change.edits
			.map(([label, before, after]) => {
				const was =
					before === 'None' ? '<span class="al-quiet">Empty</span>' : `<del>${htmlSafe(before)}</del>`;
				return `<tr><th scope="row">${htmlSafe(label)}</th><td>${was}</td><td><ins>${htmlSafe(after)}</ins></td></tr>`;
			})
			.join('');
		const head =
			'<thead><tr><th scope="col">What</th><th scope="col">Before</th><th scope="col">After</th></tr></thead>';
		return `<table class="al-diff"><caption class="visually-hidden">Values before and after the change</caption>${head}<tbody>${body}</tbody></table>`;
	}

	function earlierMarkup(change) {
		const earlier = HISTORY.filter(
			(other) => other !== change && other.subject === change.subject && other.at < change.at,
		).slice(0, 3);
		if (!earlier.length) return '<li class="al-history-none">No earlier changes in the last 30 days.</li>';
		return earlier
			.map(
				(other) =>
					`<li><span class="al-history-when">${shortDate(other.at)}, ${clockTime(other.at)}</span><span class="al-history-what">${htmlSafe(other.actor.name)}: ${htmlSafe(lowerFirst(other.headline))}</span></li>`,
			)
			.join('');
	}

	/* Holding the button records a new change that swaps before and after back. */
	function revertShown() {
		const original = shownRecord;
		if (!original || !original.reversible || original.reverted) return;
		const reversal = {
			ref: nextRef(),
			at: new Date(liveClock),
			actor: SELF,
			area: original.area,
			kind: 'update',
			reversible: false,
			headline: `Put back: ${lowerFirst(original.headline)}`,
			subject: original.subject,
			edits: original.edits.map(([label, before, after]) => [label, after, before]),
			alert: null,
			device: SELF.device,
			icon: SELF.icon,
			place: SELF.place,
			ip: SELF.ip,
			isNew: true,
		};
		original.reverted = { by: SELF, at: new Date(liveClock) };
		HISTORY.unshift(reversal);
		reload();
		paintFigures();
		paintRecord(stepper.at);
		/* The hold button has gone, so the line that replaced it takes focus. */
		setTimeout(() => record.undoNote.focus(), 60);
		toast({
			tone: 'success',
			title: 'Change put back',
			text: `${original.headline} is back to how it was.`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						cancelRevert(original, reversal);
					},
				},
			],
		});
	}

	function cancelRevert(original, reversal) {
		const at = HISTORY.indexOf(reversal);
		if (at >= 0) HISTORY.splice(at, 1);
		original.reverted = null;
		reload();
		paintFigures();
		if (shownRecord === original) paintRecord(stepper.at);
		toast({ tone: 'info', title: 'Kept the change', text: 'Nothing was put back.', duration: 3500 });
	}

	/* The review queue: flagged changes from the last seven days. */

	/** Changes nobody has checked yet come first, each group newest first. */
	function reviewQueue() {
		const since = new Date(MIDNIGHT.getTime() - 6 * DAY_MS);
		const recent = HISTORY.filter((change) => change.alert && change.at >= since);
		const waiting = recent.filter((change) => !reviewed.has(change.ref));
		const cleared = recent.filter((change) => reviewed.has(change.ref));
		return [...waiting, ...cleared];
	}

	function drawReview(focusRef) {
		const queue = reviewQueue();
		const cleared = queue.filter((change) => reviewed.has(change.ref)).length;
		const size = queue.length;
		review.ring.style.setProperty('--value', size ? Math.round((cleared / size) * 100) : 100);
		review.ring.setAttribute('aria-label', `${cleared} of ${size} checked`);
		review.ringValue.textContent = `${cleared}/${size}`;
		review.allDone.hidden = cleared < size;
		review.list.innerHTML = queue.map((change) => reviewItem(change)).join('');
		paintFigures();
		if (!focusRef) return;
		/* Once the last one is checked, the "all done" heading takes focus. */
		if (cleared === size) {
			pick('.basalt-empty-title', review.allDone).focus();
			return;
		}
		pick(`[data-al-check="${focusRef}"]`, review.list)
			?.querySelector('[data-al-check-ok], [data-al-check-undo]')
			?.focus();
	}

	function reviewItem(change) {
		const check = reviewed.get(change.ref);
		const headline = htmlSafe(change.headline);
		const icon = check ? 'bi-check2' : ALERT_ICONS[change.alert] || 'bi-flag';
		const reason = check ? `Checked by ${htmlSafe(shortName(check.by))}` : htmlSafe(change.alert);
		const decide = check
			? `<button type="button" class="btn btn-sm btn-outline-secondary" data-al-check-undo aria-label="Mark as not checked: ${headline}">Reopen</button>`
			: `<button type="button" class="btn btn-sm btn-primary" data-al-check-ok aria-label="Looks fine: ${headline}">Looks fine</button>`;
		const meta = `<p class="al-check-meta"><span class="al-check-reason">${reason}</span> · ${htmlSafe(change.actor.name)} · ${shortDate(change.at)}, ${clockTime(change.at)}</p>`;
		const actions = `<div class="al-check-actions"><button type="button" class="btn btn-sm btn-outline-secondary" data-al-check-open aria-label="Open: ${headline}">Open</button>${decide}</div>`;
		return `<li class="al-check${check ? ' is-checked' : ''}" data-al-check="${change.ref}"><span class="al-check-icon" aria-hidden="true"><i class="bi ${icon}"></i></span><div class="al-check-main"><p class="al-check-title">${headline}</p>${meta}</div>${actions}</li>`;
	}

	function markReviewed(ref, isChecked, moveFocus) {
		if (isChecked) reviewed.set(ref, { by: SELF, at: new Date(liveClock) });
		else reviewed.delete(ref);
		drawReview(moveFocus ? ref : null);
		reload();
		if (drawerShowing && shownRecord?.ref === ref) paintRecord(stepper.at);
	}

	function onReviewClick(event) {
		const item = event.target.closest('[data-al-check]');
		if (!item) return;
		const ref = item.getAttribute('data-al-check');
		if (event.target.closest('[data-al-check-open]')) {
			openRecord(ref, 'checks');
			return;
		}
		if (event.target.closest('[data-al-check-undo]')) {
			markReviewed(ref, false, true);
			return;
		}
		if (!event.target.closest('[data-al-check-ok]')) return;
		const change = HISTORY.find((entry) => entry.ref === ref);
		markReviewed(ref, true, true);
		toast({
			tone: 'success',
			title: 'Marked as checked',
			text: change.headline,
			duration: 5000,
			actions: [
				{
					label: 'Undo',
					onClick() {
						markReviewed(ref, false, true);
					},
				},
			],
		});
	}

	/* Who made changes in the chosen period, busiest first. */

	function drawRanking() {
		const since = spanStart();
		const inPeriod = HISTORY.filter((change) => change.at >= since);
		const board = [];
		for (const member of TEAM) {
			const theirs = inPeriod.filter((change) => change.actor === member);
			if (theirs.length) board.push({ member, count: theirs.length, latest: theirs[0].at });
		}
		board.sort((a, b) => b.count - a.count);
		const peak = board.length ? board[0].count : 1;
		const period = view.span === 1 ? 'Today' : `The last ${view.span} days`;
		ranking.desc.textContent = `${period}, busiest first. Pick someone to see only their changes.`;
		ranking.list.innerHTML =
			board.map((entry) => rankingItem(entry, peak)).join('') ||
			'<li class="al-history-none">Nobody has changed anything in this period.</li>';
	}

	function rankingItem({ member, count, latest }, peak) {
		const bar = `<span class="al-bar al-bar-${member.tone}" aria-hidden="true"><span style="width:${Math.max(4, Math.round((count / peak) * 100))}%"></span></span>`;
		const name = `<p class="al-person-row-name">${htmlSafe(member.name)} <span class="al-person-row-role">${htmlSafe(member.role)}</span></p>`;
		const meta = `<p class="al-person-row-meta">${count}${count === 1 ? ' change' : ' changes'} · last ${relative(latest)}</p>`;
		const show = `<button type="button" class="btn btn-sm btn-outline-secondary" data-al-person-show="${member.key}" aria-label="Show ${htmlSafe(member.name)}’s changes">Show</button>`;
		return `<li class="al-person-row"><span class="basalt-avatar basalt-avatar-sm basalt-avatar-tone-${member.tone}" aria-hidden="true">${monogram(member.name)}</span><div class="al-person-row-main">${name}${bar}${meta}</div>${show}</li>`;
	}

	function onRankingClick(event) {
		const button = event.target.closest('[data-al-person-show]');
		if (button) filterToPerson(MEMBER[button.getAttribute('data-al-person-show')]);
	}

	/* The stacked bar chart of changes per day. */

	function wireChart() {
		chartCanvas.setAttribute(
			'aria-label',
			'Stacked bar chart of changes per day for the last 14 days, split by area.',
		);
		chartCanvas.addEventListener('keydown', onChartKey);
		chartCanvas.addEventListener('blur', () => {
			if (!barChart) return;
			barChart.setActiveElements([]);
			barChart.tooltip?.setActiveElements([], { x: 0, y: 0 });
			barChart.update('none');
		});
		legendList.addEventListener('click', onLegendClick);
		drawLegend();
		if (chartCanvas) buildWhenSeen();
		/* Tokens follow the theme attribute, so the next frame reads the new ones. */
		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() => {
				if (barChart) buildChart(false);
			});
		});
	}

	/* The first draw waits until the canvas is close to the screen, so its
     grow-in animation is actually seen. */
	function buildWhenSeen() {
		if (!('IntersectionObserver' in window)) {
			buildChart(false);
			return;
		}
		const watcher = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					watcher.unobserve(entry.target);
					buildChart(true);
				}
			},
			{ rootMargin: '80px 0px' },
		);
		watcher.observe(chartCanvas);
	}

	function readToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** Reads #rgb, #rrggbb or rgb()/rgba() into three channels; anything else is mid gray. */
	function toRgb(color) {
		const text = String(color || '').trim();
		const short = /^#([0-9a-f]{3})$/i.exec(text);
		if (short) return [...short[1]].map((digit) => parseInt(digit + digit, 16));
		const long = /^#([0-9a-f]{6})$/i.exec(text);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(text);
		return functional
			? functional[1]
					.split(',')
					.map((part) => parseFloat(part))
					.slice(0, 3)
			: [128, 128, 128];
	}

	function tint(color, alpha) {
		const [red, green, blue] = toRgb(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	/** Mixes two colors, giving the first one the stated share. */
	function blend(first, second, share) {
		const one = toRgb(first);
		const two = toRgb(second);
		const channels = [0, 1, 2].map((at) => Math.round(one[at] * share + two[at] * (1 - share)));
		return `rgb(${channels.join(', ')})`;
	}

	function chartPalette() {
		const ink = readToken('--basalt-copy', '#12233a');
		const soft = readToken('--basalt-copy-muted', '#5f7186');
		return {
			series: [1, 2, 3, 4, 5].map((n) => readToken(`--basalt-series-${n}`, '#2b6fd4')),
			ink,
			axis: blend(soft, ink, 0.82),
			grid: tint(ink, 0.07),
			panel: readToken('--basalt-plane', '#ffffff'),
			edge: readToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
		};
	}

	function perDay(areaKey) {
		return chartDays.map(
			(day) =>
				HISTORY.filter((change) => change.area === areaKey && dateStamp(change.at) === dateStamp(day)).length,
		);
	}

	function dayTotal(index) {
		return HISTORY.filter((change) => dateStamp(change.at) === dateStamp(chartDays[index])).length;
	}

	/* With a day picked, every other day's bars fade back. */
	function barColors(palette, series) {
		const solid = palette.series[series];
		return chartDays.map((day) => (!view.day || view.day === dateStamp(day) ? solid : tint(solid, 0.28)));
	}

	function buildChart(animate) {
		if (typeof Chart === 'undefined' || !chartCanvas) return;
		barChart?.destroy();
		const palette = chartPalette();
		barChart = new Chart(chartCanvas, {
			type: 'bar',
			data: {
				labels: chartDays.map((day) => (daysBefore(day) === 0 ? 'Today' : shortDate(day))),
				datasets: AREAS.map((area, series) => ({
					label: area.label,
					data: perDay(area.key),
					hidden: mutedAreas.has(area.key),
					backgroundColor: barColors(palette, series),
					borderColor: palette.panel,
					borderWidth: { top: 1 },
					borderRadius: 3,
					borderSkipped: false,
					maxBarThickness: 28,
				})),
			},
			options: chartOptions(palette, animate),
		});
	}

	function chartOptions(palette, animate) {
		const family = "'Schibsted Grotesk', sans-serif";
		const ticks = { color: palette.axis, font: { family, size: 11.5 }, padding: 6 };
		return {
			responsive: true,
			maintainAspectRatio: false,
			animation: animate && !calm ? { duration: 500, easing: 'easeOutQuart' } : false,
			interaction: { mode: 'index', intersect: false },
			onClick(_event, hits) {
				if (hits?.length) pickDay(hits[0].index);
			},
			onHover(_event, hits) {
				chartCanvas.style.cursor = hits?.length ? 'pointer' : 'default';
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					backgroundColor: palette.panel,
					titleColor: palette.ink,
					bodyColor: palette.ink,
					footerColor: palette.ink,
					borderColor: palette.edge,
					borderWidth: 1,
					padding: 10,
					cornerRadius: 8,
					boxPadding: 4,
					usePointStyle: true,
					titleFont: { family, size: 12, weight: '600' },
					bodyFont: { family, size: 12 },
					footerFont: { family, size: 11.5, weight: '500' },
					filter: (item) => item.raw > 0,
					callbacks: {
						title: (items) => (items.length ? dayHeading(chartDays[items[0].dataIndex]) : ''),
						footer: (items) =>
							items.length ? `${dayTotal(items[0].dataIndex)} changes. Click to show them.` : '',
					},
				},
			},
			scales: {
				x: {
					stacked: true,
					grid: { display: false },
					border: { display: false },
					ticks: { maxRotation: 0, autoSkipPadding: 10, ...ticks },
				},
				y: {
					stacked: true,
					grid: { color: palette.grid },
					border: { display: false },
					ticks: { maxTicksLimit: 5, precision: 0, ...ticks },
				},
			},
		};
	}

	function recolorBars() {
		if (!barChart) return;
		const palette = chartPalette();
		for (const [series, dataset] of barChart.data.datasets.entries())
			dataset.backgroundColor = barColors(palette, series);
		barChart.update('none');
	}

	function refreshBarData() {
		if (!barChart) return;
		for (const [series, dataset] of barChart.data.datasets.entries()) dataset.data = perDay(AREAS[series].key);
		barChart.update('none');
		drawLegend();
	}

	/** Picking a day filters the log to it, widening the period first when the day falls outside it. */
	function pickDay(index) {
		const day = chartDays[index];
		const stamp = dateStamp(day);
		if (view.day === stamp) {
			focusOnDay(null);
			return;
		}
		const needed = daysBefore(day) + 1;
		if (needed <= view.span) {
			focusOnDay(stamp);
			return;
		}
		view.day = stamp;
		chartNote.textContent = `Showing ${dayHeading(day)} in the activity log. Pick it again to show every day.`;
		choosePeriod(needed > 7 ? 30 : 7);
	}

	function focusOnDay(stamp) {
		view.day = stamp;
		reload(true);
		chartNote.textContent = stamp
			? `Showing ${dayHeading(new Date(`${stamp}T12:00`))} in the activity log. Pick it again to show every day.`
			: 'Showing every day again.';
	}

	function onChartKey(event) {
		if (!barChart) return;
		if (Object.hasOwn(DAY_KEYS, event.key)) {
			event.preventDefault();
			focusIndex = Math.max(0, Math.min(CHART_SPAN - 1, DAY_KEYS[event.key](focusIndex)));
			const active = [];
			for (const [datasetIndex, dataset] of barChart.data.datasets.entries()) {
				if (!dataset.hidden) active.push({ datasetIndex, index: focusIndex });
			}
			barChart.setActiveElements(active);
			barChart.tooltip?.setActiveElements(active, { x: 0, y: 0 });
			barChart.update('none');
			chartNote.textContent = `${dayHeading(chartDays[focusIndex])}: ${dayTotal(focusIndex)} changes. Press Enter to show them in the log.`;
			return;
		}
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			pickDay(focusIndex);
		}
	}

	function drawLegend() {
		legendList.innerHTML = AREAS.map((area) => {
			const total = perDay(area.key).reduce((sum, count) => sum + count, 0);
			const pressed = String(!mutedAreas.has(area.key));
			return `<li><button type="button" class="al-legend-item al-legend-item-${area.slot}" data-al-series="${area.key}" aria-pressed="${pressed}"><span class="al-legend-swatch" aria-hidden="true"></span>${htmlSafe(area.label)} <span class="al-legend-n">${total}</span></button></li>`;
		}).join('');
	}

	/* One area always stays on the chart. */
	function onLegendClick(event) {
		const button = event.target.closest('[data-al-series]');
		if (!button) return;
		const key = button.getAttribute('data-al-series');
		const muted = mutedAreas.has(key);
		if (!muted && mutedAreas.size === AREAS.length - 1) {
			chartNote.textContent = 'At least one area stays on the chart.';
		} else {
			showArea(button, key, muted);
		}
	}

	function showArea(button, key, shown) {
		if (shown) mutedAreas.delete(key);
		else mutedAreas.add(key);
		button.setAttribute('aria-pressed', String(shown));
		if (!barChart) return;
		barChart.data.datasets[AREAS.findIndex((area) => area.key === key)].hidden = !shown;
		barChart.update(calm ? 'none' : undefined);
	}

	/* The live feed: with the switch on, the demo clock moves on a minute or
     two and one new change lands every five seconds. */

	function wireLive() {
		liveToggle.addEventListener('change', () => {
			scheduleLive();
			announce(
				liveToggle.checked ? 'New changes will appear at the top of the log.' : 'The log has stopped updating.',
			);
		});
		document.addEventListener('visibilitychange', scheduleLive);
	}

	function scheduleLive() {
		clearTimeout(liveDelay);
		if (!liveToggle.checked) return;
		liveDelay = setTimeout(() => {
			if (!document.hidden) addLiveChange();
			scheduleLive();
		}, 5000);
	}

	function addLiveChange() {
		liveClock = new Date(liveClock.getTime() + within(1, 3) * 60000);
		const change = forge(new Date(liveClock));
		change.alert = null;
		change.isNew = !calm;
		HISTORY.unshift(change);
		reload();
		paintFigures();
		refreshBarData();
		announce(`New change: ${change.actor.name}, ${change.headline}`);
	}

	/* The archive sits on slower storage in this demo: the first two tries
     time out and the third answers, so every state can be seen. */

	function wireArchive() {
		archive.button.addEventListener('click', startArchiveSearch);
		archive.slot.addEventListener('basalt:retry', (event) => {
			archiveAttempts += 1;
			setTimeout(() => {
				const answered = archiveAttempts >= 2;
				event.detail.done(answered);
				if (answered) showArchiveResults();
			}, 800);
		});
		archive.slot.addEventListener('click', (event) => {
			if (!event.target.closest('[data-al-archive-close]')) return;
			archive.slot.replaceChildren();
			archive.button.focus();
		});
	}

	function startArchiveSearch() {
		archiveAttempts = 0;
		archive.button.disabled = true;
		const still = calm ? ' basalt-skeleton-still' : '';
		const lines = [70, 55, 62]
			.map(
				(width) => `<span class="basalt-skeleton basalt-skeleton-line${still}" style="width:${width}%"></span>`,
			)
			.join('');
		archive.slot.innerHTML = `<div class="al-archive-found" aria-busy="true"><p class="al-quiet">Searching the archive</p>${lines}</div>`;
		setTimeout(() => {
			archive.button.disabled = false;
			showArchiveError();
		}, 900);
	}

	function showArchiveError() {
		archive.slot.replaceChildren(archive.template.content.cloneNode(true));
		window.Basalt.empty?.init(archive.slot);
		pick('[data-basalt-retry-now]', archive.slot)?.focus();
	}

	/* Older changes come from their own seed for the dates; the changes
     themselves still draw from the shared source. */
	function showArchiveResults() {
		const older = makeRandom(4410);
		const found = [];
		for (let made = 0; made < 40; made += 1) {
			const daysBack = 31 + Math.floor(older() * 300);
			const hour = 8 + Math.floor(older() * 10);
			found.push(forge(new Date(MIDNIGHT.getTime() - daysBack * DAY_MS + hour * HOUR_MS)));
		}
		found.sort((a, b) => b.at - a.at);

		const query = view.query.toLowerCase();
		const person = view.person.toLowerCase();
		const shortlist = found
			.filter(
				(change) =>
					(!view.query || `${change.headline} ${change.actor.name}`.toLowerCase().includes(query)) &&
					(!view.person || change.actor.name.toLowerCase().includes(person)),
			)
			.slice(0, 6);
		const scope = view.query || view.person ? 'matching your search' : 'most recent';
		const listing = shortlist.length
			? `<ul class="al-archive-list">${shortlist.map((change) => `<li><span class="al-archive-when">${shortDate(change.at)}, ${change.at.getFullYear()}</span><span class="al-archive-what">${htmlSafe(change.actor.name)}: ${htmlSafe(lowerFirst(change.headline))}</span></li>`).join('')}</ul>`
			: '<p class="al-quiet mb-0">Nothing older matches that search.</p>';
		const head = `<div class="al-archive-head"><h3 class="al-archive-title" tabindex="-1">From the archive, ${scope}</h3><button type="button" class="btn btn-sm btn-outline-secondary" data-al-archive-close>Close</button></div>`;
		archive.slot.innerHTML = `<div class="al-archive-found">${head}${listing}</div>`;
		pick('.al-archive-title', archive.slot).focus();
	}

	/* How long changes are kept. A shorter limit asks for a typed confirmation
     first, since older changes go for good. */

	function wireRetention() {
		const { form, shorten } = retention;
		form.addEventListener('input', retentionChanged);
		form.addEventListener('change', retentionChanged);
		form.addEventListener('submit', onRetentionSubmit);
		shorten.addEventListener('show.bs.modal', () =>
			pick('[data-basalt-type-confirm]', shorten)?.basaltTyped?.reset(),
		);
		shorten.addEventListener('shown.bs.modal', () => pick('#al-shorten-input', shorten).focus());
		pick('[data-al-shorten-go]', shorten).addEventListener('click', () => {
			bootstrap.Modal.getOrCreateInstance(shorten).hide();
			saveRetention();
		});
		shorten.addEventListener('hidden.bs.modal', () => {
			if (!retention.save.classList.contains('is-loading')) retention.save.focus();
		});
	}

	function readRetention() {
		return {
			months: Math.max(1, Math.min(84, parseInt(retention.months.value, 10) || 1)),
			copy: pick('input[name="al-keep-copy"]:checked', retention.form)?.value || 'never',
			signins: retention.signins.checked,
		};
	}

	function spanLabel(months) {
		if (months % 12 !== 0) return months === 1 ? '1 month' : `${months} months`;
		const years = months / 12;
		return years === 1 ? '1 year' : `${years} years`;
	}

	/** The first of the month the oldest kept change would date from. */
	function cutoff(months) {
		return new Date(CLOCK.getFullYear(), CLOCK.getMonth() - months, 1);
	}

	function retentionChanged() {
		const draft = readRetention();
		retention.hint.textContent = `${spanLabel(draft.months)}, back to ${monthYear(cutoff(draft.months))}.`;
		const unsaved = ['months', 'copy', 'signins'].some((key) => draft[key] !== savedRetention[key]);
		if (!retention.save.classList.contains('is-loading')) retention.save.disabled = !unsaved;
		let status = 'Saved settings. Nothing to save.';
		if (unsaved)
			status =
				draft.months < savedRetention.months
					? 'Unsaved. Shorter than now, so older changes will be removed.'
					: 'Unsaved changes.';
		retention.status.textContent = status;
	}

	function restoreRetention(values) {
		retention.months.value = values.months;
		const radio = pick(`input[name="al-keep-copy"][value="${values.copy}"]`, retention.form);
		if (radio) {
			radio.checked = true;
			radio.dispatchEvent(new Event('change', { bubbles: true }));
		}
		retention.signins.checked = values.signins;
		retentionChanged();
	}

	function saveRetention() {
		const previous = { ...savedRetention };
		const next = readRetention();
		buttonState(retention.save, 'loading');
		retention.status.textContent = 'Saving';
		setTimeout(() => {
			savedRetention = next;
			buttonState(retention.save, 'success');
			retention.status.textContent = 'Saved just now.';
			toast({
				tone: 'success',
				title: 'Settings saved',
				text: `Changes are kept for ${spanLabel(next.months)}.`,
				actions: [
					{
						label: 'Undo',
						onClick() {
							savedRetention = previous;
							restoreRetention(previous);
							toast({ tone: 'info', title: `Back to ${spanLabel(previous.months)}`, duration: 3500 });
						},
					},
				],
			});
			setTimeout(() => {
				buttonState(retention.save, 'idle');
				retentionChanged();
			}, 1400);
		}, 900);
	}

	function onRetentionSubmit(event) {
		event.preventDefault();
		if (retention.save.disabled || retention.save.classList.contains('is-loading')) return;
		retention.months.value = readRetention().months;
		const next = readRetention();
		if (next.months < savedRetention.months) askBeforeShortening(next.months);
		else saveRetention();
	}

	function askBeforeShortening(months) {
		const { shorten } = retention;
		pick('[data-al-shorten-text]', shorten).textContent =
			`Changes from before ${monthYear(cutoff(months))} are removed tonight and can’t be brought back.`;
		bootstrap.Modal.getOrCreateInstance(shorten).show();
	}

	/* Export: the filtered list or the whole month, as CSV, JSON or text. */

	function wireExport() {
		exportModal.addEventListener('show.bs.modal', () => {
			window.Basalt.dialog?.clearDone(exporting.content);
			pick('[data-al-export-count]', exportModal).textContent = visible.length;
			pick('[data-al-export-all]', exportModal).textContent = lastMonth().length;
			buttonState(exporting.go, 'idle');
			updateExportLabel();
		});
		exporting.form.addEventListener('change', updateExportLabel);
		exporting.form.addEventListener('submit', onExportSubmit);
	}

	function lastMonth() {
		const since = new Date(MIDNIGHT.getTime() - 29 * DAY_MS);
		return HISTORY.filter((change) => change.at >= since);
	}

	function exportWhole() {
		return pick('#al-export-all', exporting.form).checked;
	}

	function updateExportLabel() {
		const count = exportWhole() ? lastMonth().length : visible.length;
		pick('[data-al-export-label]', exportModal).textContent =
			`Export ${count}${count === 1 ? ' change' : ' changes'}`;
		exporting.go.disabled = !count;
	}

	function onExportSubmit(event) {
		event.preventDefault();
		const { form, go } = exporting;
		if (go.classList.contains('is-loading') || go.disabled) return;
		const list = exportWhole() ? lastMonth() : visible.slice();
		const type = pick('input[name="al-export-type"]:checked', form)?.value || 'csv';
		buttonState(go, 'loading');
		setTimeout(() => {
			const file = buildFile(list, type, pick('#al-export-values', form).checked);
			download(file, `audit-trail-${dateStamp(CLOCK)}.${type}`);
			buttonState(go, 'success');
			window.Basalt.dialog?.done(
				exporting.content,
				`${list.length}${list.length === 1 ? ' change' : ' changes'}, saved as a ${type.toUpperCase()} file.`,
			);
		}, 900);
	}

	/** Turns changes into file text. Before and after columns are left out unless asked for. */
	function buildFile(list, type, withValues) {
		const records = list.map((change) => ({
			id: change.ref,
			time: isoMinute(change.at),
			who: change.actor.name,
			area: AREA_BY_KEY[change.area].label,
			change: change.headline,
			before: withValues ? change.edits.map(([label, was]) => `${label}: ${was}`).join('; ') : undefined,
			after: withValues ? change.edits.map(([label, , now]) => `${label}: ${now}`).join('; ') : undefined,
			ip: change.ip,
			device: change.device,
		}));
		const writers = {
			json: () => ({ text: JSON.stringify(records, null, 2), mime: 'application/json' }),
			txt: () => ({ text: records.map((entry) => plainLine(entry, withValues)).join('\n'), mime: 'text/plain' }),
			csv: () => csvFile(records),
		};
		return (Object.hasOwn(writers, type) ? writers[type] : writers.csv)();
	}

	function plainLine(entry, withValues) {
		const values = withValues && entry.after ? `\n    ${entry.before}  ->  ${entry.after}` : '';
		return `${entry.time.replace('T', ' ')}  ${entry.who}  ${entry.change}${values}`;
	}

	function csvFile(records) {
		const sample = records[0] || {};
		const columns = Object.keys(sample).filter((key) => sample[key] !== undefined);
		function quote(value) {
			return `"${String(value).replace(/"/g, '""')}"`;
		}
		const lines = [columns.join(','), ...records.map((entry) => columns.map((key) => quote(entry[key])).join(','))];
		return { text: lines.join('\n'), mime: 'text/csv' };
	}

	function download(file, name) {
		try {
			const url = URL.createObjectURL(new Blob([file.text], { type: file.mime }));
			const link = document.createElement('a');
			link.href = url;
			link.download = name;
			document.body.append(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		} catch {
			/* In the demo the file still counts as prepared. */
		}
	}

	start();
})();
