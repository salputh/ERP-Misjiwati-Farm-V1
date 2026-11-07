/**
 * Stock transfers for stock-transfers.html: Marlo shop stock moving between
 * the four warehouses.
 *
 * The page has three parts fed from one list of records: the shipments on
 * their way (a track per shipment), the requests waiting for approval, and
 * the full list of the last 30 days with tabs, search and a warehouse
 * filter. A drawer shows one transfer and carries its next action (approve,
 * decline, ship, receive, raise again); a dialog raises a new one.
 *
 * Warehouses, products and stock figures agree with the Stock Levels page,
 * and #199, #204 and #208 are the moves its history lists. The demo
 * day is October 9, 2026, as there. For a real app, point DEMO_DAY at the
 * current date and put your own records in `records`.
 *
 * A transfer's status is one of: approval (asked for by the receiving
 * warehouse), packing (approved, being boxed at the sender), transit
 * (shipped), customs (held at a carrier sort hub), received (counted in) or
 * declined (turned down, with a reason).
 */
(() => {
	'use strict';
	const page = pick('[data-stx-root]');
	if (!page || typeof bootstrap === 'undefined') return;

	const DEMO_DAY = new Date(2026, 9, 9);
	const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DAY_MS = 86400000;
	const APPROVED_BY = 'John Armstrong';

	/* The warehouses. `tone` is the chart color slot used on the Stock Levels
     page; `lead` runs the site and raises its requests. `region` decides
     which lanes rail runs on, and the two smaller sites take freight
     through a carrier sort `hub`, where a shipment can be held for papers. */
	const WAREHOUSES = {
		reno: { name: 'Elko DC', region: 'West', hub: '', tone: 1, lead: 'Marshall Nugent' },
		columbus: { name: 'Columbus DC', region: 'Midwest', hub: '', tone: 3, lead: 'Ezra Fenwick' },
		annarbor: {
			name: 'Ann Arbor DC',
			region: 'Midwest',
			hub: 'the Ann Arbor sort hub',
			tone: 8,
			lead: 'Sofie de Vries',
		},
		medford: {
			name: 'Bellingham DC',
			region: 'West',
			hub: 'the Bellingham sort hub',
			tone: 7,
			lead: 'Mae Loy',
		},
	};

	/* Each person keeps the same avatar color everywhere. */
	const AVATAR_TONES = {
		'Marshall Nugent': 2,
		'Ezra Fenwick': 4,
		'Sofie de Vries': 6,
		'Mae Loy': 5,
		'John Armstrong': 1,
	};

	/* Marlo's boxed products. `at` holds [on hand, reserved for orders] per
     warehouse; the difference is free to move. */
	const CATALOG = {
		'ML-BLAZ': {
			name: 'Sculpted Shoulder Blazer',
			price: 1290,
			icon: 'bi-briefcase',
			cat: 1,
			at: { reno: [64, 10], columbus: [52, 8], annarbor: [46, 6], medford: [22, 2] },
		},
		'ML-GOWN': {
			name: 'Draped Column Gown',
			price: 2150,
			icon: 'bi-stars',
			cat: 1,
			at: { reno: [88, 7], columbus: [70, 5], annarbor: [50, 4], medford: [28, 2] },
		},
		'ML-ORGZ': {
			name: 'Tiered Organza Dress',
			price: 1680,
			icon: 'bi-flower1',
			cat: 2,
			at: { reno: [150, 14], columbus: [168, 16], annarbor: [64, 6], medford: [30, 4] },
		},
		'ML-SUIT': {
			name: 'Chalk-Stripe Suit',
			price: 2450,
			icon: 'bi-person-standing',
			cat: 3,
			at: { reno: [34, 5], columbus: [30, 4], annarbor: [24, 3], medford: [8, 2] },
		},
		'ML-TRCH': {
			name: 'Leather Trench Coat',
			price: 3200,
			icon: 'bi-cloud-drizzle',
			cat: 3,
			at: { reno: [40, 3], columbus: [38, 4], annarbor: [36, 3], medford: [14, 1] },
		},
		'ML-LOAF': {
			name: 'Bar Loafers',
			price: 790,
			icon: 'bi-gem',
			cat: 4,
			at: { reno: [190, 22], columbus: [170, 20], annarbor: [120, 14], medford: [60, 6] },
		},
		'ML-OXFD': {
			name: 'Two-Tone Oxfords',
			price: 850,
			icon: 'bi-award',
			cat: 5,
			at: { reno: [110, 12], columbus: [96, 11], annarbor: [72, 8], medford: [32, 4] },
		},
		'ML-CATE': {
			name: 'Cat-Eye Sunglasses',
			price: 465,
			icon: 'bi-sunglasses',
			cat: 6,
			at: { reno: [10, 3], columbus: [8, 3], annarbor: [4, 2], medford: [0, 0] },
		},
		'ML-SHLD': {
			name: 'Shield Sunglasses',
			price: 520,
			icon: 'bi-eyeglasses',
			cat: 6,
			at: { reno: [0, 0], columbus: [0, 0], annarbor: [0, 0], medford: [0, 0] },
		},
	};

	const SHIPPING = {
		road: {
			label: 'Road',
			freight: 'Road freight',
			carrier: 'XPO Freight',
			hint: 'Any lane, by truck',
			icon: 'bi-truck',
		},
		air: { label: 'Air', freight: 'Air freight', carrier: 'DHL Express', hint: '1 to 3 days', icon: 'bi-airplane' },
		/* The long-haul rail lane; its key matches the page styles. */
		sea: {
			label: 'Rail',
			freight: 'Rail freight',
			carrier: 'Union Pacific',
			hint: 'Between regions',
			icon: 'bi-train-freight-front',
		},
	};

	const STAGE_INFO = {
		approval: { label: 'Waiting on approval', icon: 'bi-hourglass-split', tab: 'open' },
		packing: { label: 'Packing', icon: 'bi-box-seam', tab: 'open' },
		transit: { label: 'In transit', icon: 'bi-truck', tab: 'open' },
		customs: { label: 'At the sort hub', icon: 'bi-signpost-split', tab: 'open' },
		received: { label: 'Received', icon: 'bi-check2-circle', tab: 'received' },
		declined: { label: 'Declined', icon: 'bi-x-circle', tab: 'declined' },
	};
	const ON_THE_MOVE = ['transit', 'customs'];
	const LEAVING_OR_MOVING = ['packing', 'transit', 'customs'];

	/* The records, newest first. `by` raised the request; John Armstrong approves. */
	const records = [
		{
			id: '#214',
			from: 'columbus',
			to: 'medford',
			mode: 'air',
			by: 'Mae Loy',
			status: 'approval',
			raised: '2026-10-08',
			lines: [
				['ML-SUIT', 6],
				['ML-TRCH', 6],
				['ML-OXFD', 12],
			],
			note: 'Bellingham is down to its last few suits, and Hartley & Briar opens on October 19.',
			customer: 'Hartley & Briar',
		},
		{
			id: '#213',
			from: 'reno',
			to: 'annarbor',
			mode: 'sea',
			by: 'Sofie de Vries',
			status: 'approval',
			raised: '2026-10-07',
			lines: [
				['ML-BLAZ', 16],
				['ML-LOAF', 20],
				['ML-OXFD', 24],
			],
			note: 'Magnolia Lane Boutique restocks both its shops in November: tailoring, loafers and eyewear.',
			customer: 'Magnolia Lane Boutique',
		},
		{
			id: '#212',
			from: 'columbus',
			to: 'reno',
			mode: 'road',
			by: 'Marshall Nugent',
			status: 'packing',
			raised: '2026-10-06',
			approved: '2026-10-07',
			shipBy: '2026-10-10',
			lines: [
				['ML-ORGZ', 40],
				['ML-SUIT', 10],
			],
			note: 'Arbor North Studio Topeka wants 40 organza dresses for the holidays, and their order ships from Elko.',
			customer: 'Arbor North Studio Topeka',
		},
		{
			id: '#211',
			from: 'reno',
			to: 'medford',
			mode: 'air',
			by: 'Mae Loy',
			status: 'packing',
			raised: '2026-10-05',
			approved: '2026-10-06',
			shipBy: '2026-10-09',
			lines: [
				['ML-GOWN', 12],
				['ML-TRCH', 6],
			],
			note: 'Dresses and shirts for the new Hartley & Briar window display.',
			customer: 'Hartley & Briar',
		},
		{
			id: '#210',
			from: 'reno',
			to: 'columbus',
			mode: 'road',
			by: 'Ezra Fenwick',
			status: 'transit',
			raised: '2026-10-02',
			approved: '2026-10-02',
			shipped: '2026-10-06',
			eta: '2026-10-10',
			ref: '7730 4418',
			lines: [
				['ML-BLAZ', 10],
				['ML-SUIT', 8],
			],
			note: 'The Silk Room opened a second shop and wants its blazers this month.',
			customer: 'The Silk Room',
		},
		{
			id: '#209',
			from: 'reno',
			to: 'annarbor',
			mode: 'sea',
			by: 'John Armstrong',
			status: 'transit',
			raised: '2026-09-24',
			approved: '2026-09-25',
			shipped: '2026-10-05',
			eta: '2026-10-13',
			ref: 'EMHU 4471205',
			lines: [
				['ML-ORGZ', 48],
				['ML-OXFD', 30],
				['ML-LOAF', 40],
			],
			note: 'Building up Ann Arbor before the winter rush, when the Great Lakes shops run out of organza dresses.',
		},
		{
			id: '#208',
			from: 'reno',
			to: 'medford',
			mode: 'air',
			by: 'Mae Loy',
			status: 'received',
			raised: '2026-09-23',
			approved: '2026-09-24',
			shipped: '2026-09-25',
			cleared: '2026-09-30',
			received: '2026-10-01',
			ref: '5520 1187 46',
			lines: [['ML-BLAZ', 12]],
			note: 'Blazers for Wren & Thistle, who are taking the full winter range.',
			customer: 'Wren & Thistle',
		},
		{
			id: '#207',
			from: 'reno',
			to: 'annarbor',
			mode: 'air',
			by: 'Sofie de Vries',
			status: 'customs',
			raised: '2026-09-22',
			approved: '2026-09-22',
			shipped: '2026-09-23',
			customsFrom: '2026-09-25',
			eta: '2026-10-12',
			ref: '5520 0934 12',
			hold: 'The hub asked for a corrected bill of lading for the trench coats, which we sent on Oct 6.',
			lines: [
				['ML-TRCH', 12],
				['ML-SUIT', 10],
			],
			note: 'Trenches and suits for the new pick-up counter in Ann Arbor.',
		},
		{
			id: '#206',
			from: 'columbus',
			to: 'medford',
			mode: 'sea',
			by: 'Mae Loy',
			status: 'customs',
			raised: '2026-09-14',
			approved: '2026-09-15',
			shipped: '2026-09-29',
			customsFrom: '2026-10-07',
			eta: '2026-10-10',
			ref: 'EMHU 3982016',
			lines: [
				['ML-LOAF', 40],
				['ML-OXFD', 20],
				['ML-ORGZ', 16],
			],
			note: 'The quarterly top-up for Bellingham, sent by rail to keep freight costs down.',
		},
		{
			id: '#205',
			from: 'columbus',
			to: 'reno',
			mode: 'road',
			by: 'Marshall Nugent',
			status: 'declined',
			raised: '2026-09-13',
			declined: '2026-09-14',
			reason: 'Elko has 300 bar loafers arriving on PO‑1036, so there is no need to move these.',
			lines: [['ML-LOAF', 60]],
			note: 'Elko is running low on bar loafers.',
		},
		{
			id: '#204',
			from: 'reno',
			to: 'annarbor',
			mode: 'air',
			by: 'Sofie de Vries',
			status: 'received',
			raised: '2026-09-12',
			approved: '2026-09-14',
			shipped: '2026-09-19',
			cleared: '2026-09-23',
			received: '2026-09-24',
			ref: '5519 8826 03',
			lines: [['ML-ORGZ', 20]],
			note: 'Organza dresses for the second Magnolia Lane Boutique shop.',
			customer: 'Magnolia Lane Boutique',
		},
		{
			id: '#203',
			from: 'columbus',
			to: 'medford',
			mode: 'air',
			by: 'Mae Loy',
			status: 'received',
			raised: '2026-09-10',
			approved: '2026-09-11',
			shipped: '2026-09-16',
			cleared: '2026-09-21',
			received: '2026-09-22',
			ref: '5519 7410 58',
			lines: [
				['ML-GOWN', 16],
				['ML-OXFD', 20],
			],
			note: 'Dresses and oxfords for the Hartley & Briar trial.',
			customer: 'Hartley & Briar',
		},
		{
			id: '#202',
			from: 'reno',
			to: 'columbus',
			mode: 'road',
			by: 'Ezra Fenwick',
			status: 'received',
			raised: '2026-09-08',
			approved: '2026-09-08',
			shipped: '2026-09-15',
			received: '2026-09-19',
			ref: '7729 1053',
			lines: [['ML-ORGZ', 30]],
			note: 'Oak & Brenda Clothing doubled their organza order.',
			customer: 'Oak & Brenda Clothing',
		},
		{
			id: '#201',
			from: 'columbus',
			to: 'annarbor',
			mode: 'air',
			by: 'Sofie de Vries',
			status: 'received',
			raised: '2026-09-05',
			approved: '2026-09-07',
			shipped: '2026-09-12',
			cleared: '2026-09-16',
			received: '2026-09-17',
			ref: '5519 5502 71',
			lines: [
				['ML-BLAZ', 20],
				['ML-GOWN', 20],
			],
			note: 'Ann Arbor ran out of blazers and gowns after the August orders.',
		},
		{
			id: '#200',
			from: 'reno',
			to: 'medford',
			mode: 'air',
			by: 'Mae Loy',
			status: 'received',
			raised: '2026-09-04',
			approved: '2026-09-04',
			shipped: '2026-09-10',
			cleared: '2026-09-15',
			received: '2026-09-16',
			ref: '5519 4127 90',
			lines: [['ML-LOAF', 50]],
			note: 'Bar loafers for the Marlo stand at the Bellingham Fashion Week pop-up.',
		},
		{
			id: '#199',
			from: 'columbus',
			to: 'medford',
			mode: 'air',
			by: 'Mae Loy',
			status: 'received',
			raised: '2026-09-03',
			approved: '2026-09-03',
			shipped: '2026-09-09',
			cleared: '2026-09-14',
			received: '2026-09-15',
			ref: '5519 3361 22',
			lines: [['ML-TRCH', 8]],
			note: 'Bellingham had no trench coats left.',
		},
	];

	/* What the list is showing, and what the drawer is stepping through. */
	const filters = { tab: 'open', q: '', site: '' };
	let listed = [];
	let drawerIds = [];
	let drawerIndex = 0;
	let seedTransfer = null;
	let lineCounter = 0;
	let trackGrown = false;
	const stillness = window.matchMedia('(prefers-reduced-motion: reduce)');

	const ui = {
		trips: pick('[data-stx-trips]', page),
		tripsSub: pick('[data-stx-trips-sub]', page),
		asks: pick('[data-stx-asks]', page),
		asksSub: pick('[data-stx-asks-sub]', page),
		rows: pick('[data-stx-body]', page),
		tableWrap: pick('[data-stx-table-wrap]', page),
		emptyBox: pick('[data-stx-empty]', page),
		summary: pick('[data-stx-summary]', page),
		search: pick('[data-stx-search]', page),
		siteSelect: pick('[data-stx-site]', page),
		panel: pick('[data-stx-panel]', page),
		tabs: pickAll('[data-stx-tab]', page),
		exportButton: pick('[data-stx-export]', page),
		drawer: pick('#stx-record'),
		dialog: pick('#stx-new'),
	};
	ui.form = pick('[data-stx-new-form]', ui.dialog);
	ui.fromSelect = dialogPart('from');
	ui.toSelect = dialogPart('to');
	ui.lineList = dialogPart('lines');
	ui.noteField = dialogPart('note');
	ui.dialogSummary = dialogPart('sum');
	ui.toError = dialogPart('to-error');
	ui.modeRadios = pickAll('input[name="stxMode"]', ui.dialog);

	/* Binds every control and draws the three sections. Runs once, at the end. */
	function start() {
		ui.trips.addEventListener('click', (event) => {
			const button = event.target.closest('[data-stx-act="open"]');
			if (button) openDrawerFor(button.closest('[data-stx-id]').getAttribute('data-stx-id'));
		});
		ui.asks.addEventListener('click', onRequestClick);

		for (const [index, tab] of ui.tabs.entries()) {
			tab.addEventListener('click', () => selectTab(tab.getAttribute('data-stx-tab')));
			tab.addEventListener('keydown', (event) => onTabKey(event, index));
		}
		ui.search.addEventListener('input', () => {
			filters.q = ui.search.value;
			paintList();
		});
		ui.siteSelect.addEventListener('change', () => selectSite(ui.siteSelect.value));
		ui.emptyBox.addEventListener('click', (event) => {
			if (!event.target.closest('[data-stx-reset]')) return;
			selectSite('');
			ui.search.focus();
		});
		ui.rows.addEventListener('click', (event) => {
			const row = event.target.closest('tr[data-stx-id]');
			if (!row) return;
			const plainCell = !event.target.closest('a, button');
			if (plainCell || event.target.closest('[data-stx-act="open"]'))
				openDrawerFor(row.getAttribute('data-stx-id'));
		});
		ui.exportButton.addEventListener('click', exportListed);

		pick('[data-basalt-record-prev]', ui.drawer).addEventListener('click', () => showRecordAt(drawerIndex - 1, -1));
		pick('[data-basalt-record-next]', ui.drawer).addEventListener('click', () => showRecordAt(drawerIndex + 1, 1));
		ui.drawer.addEventListener('keydown', (event) => {
			if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
			event.preventDefault();
			const step = event.key === 'ArrowUp' ? -1 : 1;
			showRecordAt(drawerIndex + step, step);
		});
		/* Toasts move beside the open drawer so they never cover its buttons. */
		ui.drawer.addEventListener('show.bs.offcanvas', () => parkToasts('bottom-center'));
		ui.drawer.addEventListener('hidden.bs.offcanvas', () => {
			parkToasts('bottom-end');
			for (const row of pickAll('tr.is-selected', ui.rows)) row.classList.remove('is-selected');
		});
		drawerPart('foot').addEventListener('click', (event) => {
			const button = event.target.closest('[data-stx-do]');
			if (button) carryOut(button.getAttribute('data-stx-do'), recordById(drawerIds[drawerIndex]));
		});

		ui.dialog.addEventListener('show.bs.modal', fillDialog);
		dialogPart('swap').addEventListener('click', swapRoute);
		dialogPart('add').addEventListener('click', addAnotherLine);
		ui.lineList.addEventListener('click', (event) => {
			const remove = event.target.closest('[data-stx-n-remove]');
			if (!remove) return;
			remove.closest('li').remove();
			refreshDialog();
			dialogPart('add').focus();
		});
		ui.dialog.addEventListener('change', (event) => {
			if (event.target === ui.toSelect || event.target === ui.fromSelect) clearToError();
			refreshDialog();
		});
		ui.dialog.addEventListener('input', () => {
			refreshLines(false);
			refreshSummary();
		});
		ui.form.addEventListener('submit', submitNewTransfer);

		paintAll();
	}

	/* DOM and text helpers. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function drawerPart(name) {
		return pick(`[data-stx-r="${name}"]`, ui.drawer);
	}

	function dialogPart(name) {
		return pick(`[data-stx-n="${name}"]`, ui.dialog);
	}

	function safe(value) {
		const swap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (ch) => swap[ch]);
	}

	function notify(options) {
		return window.Basalt.toasts?.push(options) ?? null;
	}

	function say(text) {
		window.Basalt.announce?.(text);
	}

	function parkToasts(where) {
		window.Basalt.toasts?.position(where);
	}

	function countOf(amount, singular, pluralForm = `${singular}s`) {
		return `${amount.toLocaleString('en-US')} ${amount === 1 ? singular : pluralForm}`;
	}

	function dollars(amount) {
		return `$${amount.toLocaleString('en-US')}`;
	}

	/* Dates, all as 'YYYY-MM-DD' strings or local Date objects. */

	function twoDigits(number) {
		return String(number).padStart(2, '0');
	}

	function dateOf(text) {
		const [year, month, dayOfMonth] = text.split('-').map(Number);
		return new Date(year, month - 1, dayOfMonth);
	}

	function isoOf(date) {
		return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
	}

	function shiftDays(date, count) {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
	}

	function monthDay(value) {
		const date = typeof value === 'string' ? dateOf(value) : value;
		return `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
	}

	function daysApart(fromIso, toIso) {
		return Math.round((dateOf(toIso) - dateOf(fromIso)) / DAY_MS);
	}

	/** "today", "tomorrow", or the short date. */
	function relativeDay(iso) {
		const ahead = daysApart(isoOf(DEMO_DAY), iso);
		if (ahead === 0) return 'today';
		if (ahead === 1) return 'tomorrow';
		return monthDay(iso);
	}

	/* Reading one transfer. */

	function unitCount(transfer) {
		let total = 0;
		for (const [, quantity] of transfer.lines) total += quantity;
		return total;
	}

	function stockValue(transfer) {
		let total = 0;
		for (const [sku, quantity] of transfer.lines) total += quantity * CATALOG[sku].price;
		return total;
	}

	function freeStock(sku, site) {
		const [onHand, reserved] = CATALOG[sku].at[site];
		return Math.max(0, onHand - reserved);
	}

	/** Door-to-door days for a lane, or null where that way of shipping does not run. */
	function transitDays(from, to, mode) {
		const sameRegion = WAREHOUSES[from].region === WAREHOUSES[to].region;
		const sorting = WAREHOUSES[from].hub || WAREHOUSES[to].hub ? 1 : 0;
		if (mode === 'road') return (sameRegion ? 2 : 4) + sorting;
		if (mode === 'air') return (sameRegion ? 1 : 2) + sorting;
		if (sameRegion) return null;
		return 7 + sorting;
	}

	function leadTime(transfer) {
		return transitDays(transfer.from, transfer.to, transfer.mode);
	}

	/** The sort hub a transfer passes through, or '' when it goes door to door. */
	function sortHub(transfer) {
		return WAREHOUSES[transfer.to].hub || WAREHOUSES[transfer.from].hub;
	}

	/** The booked arrival once shipped; before that, worked out from the ship date or from tomorrow. */
	function arrivalDate(transfer) {
		if (transfer.eta) return transfer.eta;
		const leaves = transfer.shipBy ? dateOf(transfer.shipBy) : shiftDays(DEMO_DAY, 1);
		return isoOf(shiftDays(leaves, leadTime(transfer)));
	}

	function recordById(id) {
		return records.find((transfer) => transfer.id === id);
	}

	function underTab(transfer, tab) {
		return STAGE_INFO[transfer.status].tab === tab;
	}

	/* Small pieces of markup shared by the sections and the drawer. */

	function monogram(name) {
		return name
			.split(' ')
			.filter((word) => /^[A-Z]/.test(word))
			.map((word) => word[0])
			.slice(0, 2)
			.join('');
	}

	function avatarMarkup(name) {
		return `<span class="basalt-avatar basalt-avatar-sm basalt-avatar-tone-${AVATAR_TONES[name] || 3}" aria-hidden="true">${monogram(name)}</span>`;
	}

	function personLink(name) {
		return `<a href="employee-user-details.html">${safe(name)}</a>`;
	}

	function stagePill(transfer) {
		const stage = STAGE_INFO[transfer.status];
		return `<span class="basalt-status stx-tone-${transfer.status}"><i class="bi ${stage.icon}" aria-hidden="true"></i>${stage.label}</span>`;
	}

	function siteMarkup(key) {
		const site = WAREHOUSES[key];
		return `<span class="stx-place stx-site-${site.tone}"><span class="stx-dot" aria-hidden="true"></span>${site.name}</span>`;
	}

	function routeMarkup(transfer) {
		return `<span class="stx-route-line">${siteMarkup(transfer.from)}<i class="bi bi-arrow-right stx-arrow" role="img" aria-label="to"></i>${siteMarkup(transfer.to)}</span>`;
	}

	function shippingMarkup(transfer) {
		const way = SHIPPING[transfer.mode];
		return `<span class="stx-mode stx-mode-${transfer.mode}"><i class="bi ${way.icon}" aria-hidden="true"></i>${way.label}</span>`;
	}

	/** The note, with the customer it names turned into a link. */
	function noteMarkup(transfer) {
		const text = safe(transfer.note);
		if (!transfer.customer) return text;
		const customer = safe(transfer.customer);
		return text.replace(customer, `<a href="shoppers.html">${customer}</a>`);
	}

	/** One short line under a status pill: what happens next, and when. */
	function nextStepNote(transfer) {
		const notes = {
			approval: () => `Asked for by ${safe(transfer.by)}`,
			packing: () => `Ships ${relativeDay(transfer.shipBy)}`,
			transit: () => `Arrives ${relativeDay(transfer.eta)}`,
			customs: () => `${transfer.hold ? 'Held, due ' : 'Due '}${relativeDay(transfer.eta)}`,
			received: () => `On ${monthDay(transfer.received)}`,
			declined: () => `On ${monthDay(transfer.declined)}`,
		};
		return notes[transfer.status]();
	}

	/* On the way: a track per shipment, soonest first. */

	/** How far along its lane a shipment is, 0 while packing to 1 at the door; a hub hold keeps it just short. */
	function laneProgress(transfer) {
		if (transfer.status === 'packing') return 0;
		if (transfer.status === 'customs') return 0.88;
		const whole = Math.max(1, daysApart(transfer.shipped, transfer.eta));
		const soFar = daysApart(transfer.shipped, isoOf(DEMO_DAY)) / whole;
		return Math.min(0.82, Math.max(0.08, soFar));
	}

	function tripDetail(transfer) {
		const units = countOf(unitCount(transfer), 'unit');
		if (transfer.status === 'packing')
			return `Packing at ${WAREHOUSES[transfer.from].name}, ships ${relativeDay(transfer.shipBy)} · ${units}`;
		if (transfer.status === 'customs') {
			if (transfer.hold)
				return `<span class="stx-trip-held"><i class="bi bi-exclamation-circle" aria-hidden="true"></i>Held at the sort hub for papers</span> · ${units}`;
			return `At the sort hub since ${monthDay(transfer.customsFrom)} · ${units}`;
		}
		const way = SHIPPING[transfer.mode];
		return `${way.freight} with ${way.carrier} · ${units}`;
	}

	function tripDue(transfer) {
		const arrives = arrivalDate(transfer);
		const ahead = daysApart(isoOf(DEMO_DAY), arrives);
		return ahead <= 1 ? `Arrives ${relativeDay(arrives)}` : `Due ${monthDay(arrives)}`;
	}

	function tripMarkup(transfer) {
		const percent = Math.round(laneProgress(transfer) * 100);
		const packing = transfer.status === 'packing';
		const icon = packing ? 'bi-box-seam' : SHIPPING[transfer.mode].icon;
		const trackLabel = percent ? `${percent}% of the way` : 'Not shipped yet';
		return `<li class="stx-trip stx-mode-${transfer.mode}${packing ? ' is-packing' : ''}" data-stx-id="${transfer.id}"><div class="stx-trip-top"><span class="stx-trip-what"><button type="button" class="stx-link" data-stx-act="open">${transfer.id}</button>${routeMarkup(transfer)}</span><span class="stx-trip-eta">${tripDue(transfer)}</span></div><div class="stx-trip-track" data-p="${percent}" role="img" aria-label="${trackLabel}"><span class="stx-trip-end stx-site-${WAREHOUSES[transfer.from].tone}"></span><span class="stx-trip-fill"></span><span class="stx-trip-end stx-trip-end-to stx-site-${WAREHOUSES[transfer.to].tone}"></span><span class="stx-trip-mover"><i class="bi ${icon}" aria-hidden="true"></i></span></div><p class="stx-trip-note">${tripDetail(transfer)}</p></li>`;
	}

	function paintTrips() {
		const moving = records
			.filter((transfer) => LEAVING_OR_MOVING.includes(transfer.status))
			.sort((left, right) => (arrivalDate(left) < arrivalDate(right) ? -1 : 1));
		const units = moving.reduce((sum, transfer) => sum + unitCount(transfer), 0);
		ui.tripsSub.textContent = moving.length
			? `${countOf(moving.length, 'shipment')} and ${countOf(units, 'unit')} heading out or underway, soonest first.`
			: 'Nothing is moving between warehouses right now.';
		ui.trips.innerHTML = moving.map(tripMarkup).join('');

		/* The vehicles roll out to their place once the tracks are on screen. */
		const tracks = pickAll('.stx-trip-track', ui.trips);
		function settle() {
			for (const track of tracks) track.style.setProperty('--p', track.getAttribute('data-p') / 100);
		}
		if (stillness.matches) settle();
		else requestAnimationFrame(() => requestAnimationFrame(settle));
	}

	/* Waiting for you: requests to approve, oldest first. */

	function requestMarkup(transfer) {
		const site = WAREHOUSES[transfer.to];
		const relation = site.lead === transfer.by ? 'Runs ' : 'For ';
		const asked = relativeDay(transfer.raised).replace(/^\d/, 'on $&');
		const chips = transfer.lines
			.map(([sku, quantity]) => {
				const product = CATALOG[sku];
				return `<li class="stx-chip stx-cat-${product.cat}"><span class="stx-chip-icon" aria-hidden="true"><i class="bi ${product.icon}"></i></span>${quantity} × ${safe(product.name)}</li>`;
			})
			.join('');
		const facts = `${countOf(unitCount(transfer), 'unit')} · ${dollars(stockValue(transfer))} · ${SHIPPING[transfer.mode].freight.toLowerCase()}, due ${monthDay(arrivalDate(transfer))}`;
		return `<li class="stx-ask" data-stx-id="${transfer.id}"><div class="stx-ask-who">${avatarMarkup(transfer.by)}<span><a class="stx-ask-name" href="employee-user-details.html">${safe(transfer.by)}</a><span class="stx-sub">${relation}${site.name} · asked ${asked}</span></span></div><p class="stx-ask-why">${noteMarkup(transfer)}</p><div class="stx-ask-route">${routeMarkup(transfer)}<span class="stx-sub">${facts}</span></div><ul class="stx-ask-items" aria-label="Products asked for">${chips}</ul><div class="stx-ask-acts"><button type="button" class="btn btn-primary btn-sm" data-stx-ask="approve"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Approve</button><button type="button" class="btn btn-outline-secondary btn-sm" data-stx-ask="open">Review ${transfer.id}</button></div></li>`;
	}

	function paintRequests() {
		const waiting = records.filter((transfer) => transfer.status === 'approval');
		const howMany = waiting.length === 1 ? 'One request' : countOf(waiting.length, 'request');
		ui.asksSub.textContent = waiting.length
			? `${howMany} from the warehouses, oldest first.`
			: 'Every request has an answer.';
		if (!waiting.length) {
			ui.asks.innerHTML =
				'<li class="stx-asks-none"><div class="basalt-empty" role="status"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-check2-circle"></i></span><p class="basalt-empty-title">Nothing to approve</p><p class="basalt-empty-text">New requests from the warehouses show up here.</p></div></li>';
			return;
		}
		ui.asks.innerHTML = waiting.slice().reverse().map(requestMarkup).join('');
	}

	function onRequestClick(event) {
		const button = event.target.closest('[data-stx-ask]');
		if (!button) return;
		const id = button.closest('[data-stx-id]').getAttribute('data-stx-id');
		if (button.getAttribute('data-stx-ask') === 'open') {
			openDrawerFor(id);
			return;
		}
		carryOut('approve', recordById(id));
		const following = pick('[data-stx-ask="approve"]', ui.asks) || pick('#stx-asks-title');
		following.focus();
	}

	/* The transfer list: tabs, search, warehouse filter and the table. */

	function haystack(transfer) {
		const products = transfer.lines.map(([sku]) => `${sku} ${CATALOG[sku].name}`).join(' ');
		return [
			transfer.id,
			transfer.by,
			SHIPPING[transfer.mode].label,
			WAREHOUSES[transfer.from].name,
			WAREHOUSES[transfer.to].name,
			transfer.customer || '',
			products,
		].join(' ');
	}

	function passesFilters(transfer) {
		if (!underTab(transfer, filters.tab)) return false;
		if (filters.site && transfer.from !== filters.site && transfer.to !== filters.site) return false;
		if (filters.q.trim() && !window.Basalt.matchesQuery(haystack(transfer), filters.q)) return false;
		return true;
	}

	function rowMarkup(transfer) {
		const firstProduct = CATALOG[transfer.lines[0][0]].name;
		const units = unitCount(transfer);
		const extra = transfer.lines.length > 1 ? `${countOf(transfer.lines.length, 'product')} · ` : '';
		const voided = transfer.status === 'declined' ? ' stx-money-void' : '';
		const action =
			transfer.status === 'approval'
				? '<button type="button" class="btn btn-outline-primary btn-sm" data-stx-act="open">Review</button>'
				: '';
		return `<tr data-stx-id="${transfer.id}"${transfer.isNew ? ' class="is-new"' : ''}><td class="stx-col-id"><button type="button" class="stx-link" data-stx-act="open">${transfer.id}</button><span class="stx-sub">Raised ${monthDay(transfer.raised)}</span></td><td class="stx-col-route">${routeMarkup(transfer)}<span class="stx-sub">${shippingMarkup(transfer)} · ${countOf(leadTime(transfer), 'day')}</span></td><td class="stx-col-items"><span class="stx-line">${safe(firstProduct)}</span><span class="stx-sub">${extra}${countOf(units, 'unit')}</span></td><td class="stx-col-status">${stagePill(transfer)}<span class="stx-sub">${nextStepNote(transfer)}</span></td><td class="stx-col-value"><span class="stx-money${voided}">${dollars(stockValue(transfer))}</span></td><td class="stx-col-act">${action}</td></tr>`;
	}

	function emptyMarkup() {
		if (filters.q.trim()) {
			return window.Basalt.emptyState({
				query: filters.q,
				noun: 'transfers',
				text: filters.site ? 'Check the spelling, or show every warehouse.' : '',
			});
		}
		const what = filters.tab;
		if (filters.site) {
			return `<div class="basalt-empty" role="status"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-buildings"></i></span><p class="basalt-empty-title">No ${what} transfers for ${WAREHOUSES[filters.site].name}</p><p class="basalt-empty-text">Nothing to or from this warehouse in the last 30 days.</p><button type="button" class="btn btn-sm btn-outline-secondary" data-stx-reset>Show every warehouse</button></div>`;
		}
		const reason =
			filters.tab === 'open' ? 'Nothing is moving between warehouses right now.' : 'None in the last 30 days.';
		return `<div class="basalt-empty" role="status"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-arrow-left-right"></i></span><p class="basalt-empty-title">No ${what} transfers</p><p class="basalt-empty-text">${reason}</p></div>`;
	}

	function markSelectedRow(id) {
		for (const row of pickAll('tr[data-stx-id]', ui.rows)) {
			row.classList.toggle('is-selected', row.getAttribute('data-stx-id') === id);
		}
	}

	function paintList() {
		listed = records.filter(passesFilters);
		const narrowed = filters.q.trim() || filters.site;
		const inThisTab = records.filter((transfer) => underTab(transfer, filters.tab)).length;
		const units = listed.reduce((sum, transfer) => sum + unitCount(transfer), 0);
		const worth = listed.reduce((sum, transfer) => sum + stockValue(transfer), 0);
		const ofAll = narrowed ? ` of ${inThisTab}` : '';
		ui.summary.textContent = listed.length
			? `${countOf(listed.length, 'transfer')}${ofAll} · ${countOf(units, 'unit')} · ${dollars(worth)} of stock`
			: '';
		ui.summary.hidden = !listed.length;

		for (const tab of ui.tabs) {
			const name = tab.getAttribute('data-stx-tab');
			pick('[data-stx-count]', tab).textContent = records.filter((transfer) => underTab(transfer, name)).length;
		}

		const nothing = !listed.length;
		ui.tableWrap.hidden = nothing;
		ui.emptyBox.hidden = !nothing;
		ui.emptyBox.innerHTML = nothing ? emptyMarkup() : '';
		ui.rows.innerHTML = nothing ? '' : listed.map(rowMarkup).join('');
		if (!nothing && ui.drawer.classList.contains('show')) markSelectedRow(drawerIds[drawerIndex]);
	}

	function paintAll() {
		paintTrips();
		paintRequests();
		paintList();
	}

	function selectTab(name, moveFocus) {
		filters.tab = name;
		for (const tab of ui.tabs) {
			const current = tab.getAttribute('data-stx-tab') === name;
			tab.classList.toggle('active', current);
			tab.setAttribute('aria-selected', String(current));
			tab.tabIndex = current ? 0 : -1;
			if (!current) continue;
			ui.panel.setAttribute('aria-labelledby', tab.id);
			if (moveFocus) tab.focus();
		}
		paintList();
	}

	function selectSite(key) {
		filters.site = key;
		ui.siteSelect.value = key;
		paintList();
		say(key ? `Showing transfers to and from ${WAREHOUSES[key].name}` : 'Showing every warehouse');
	}

	/** Arrow keys, Home and End move between the tabs. */
	function onTabKey(event, index) {
		const count = ui.tabs.length;
		const jumps = {
			Home: 0,
			End: count - 1,
			ArrowRight: (index + 1) % count,
			ArrowLeft: (index - 1 + count) % count,
		};
		const target = jumps[event.key];
		if (target === undefined) return;
		event.preventDefault();
		selectTab(ui.tabs[target].getAttribute('data-stx-tab'), true);
	}

	/** Downloads the rows on screen as CSV. */
	function exportListed() {
		function quoted(value) {
			return `"${String(value).replace(/"/g, '""')}"`;
		}

		const header = ['Transfer', 'Raised', 'From', 'To', 'Shipping', 'Units', 'Value', 'Status', 'Asked for by'];
		const lines = [header.map(quoted).join(',')];
		for (const transfer of listed) {
			const fields = [
				transfer.id,
				transfer.raised,
				WAREHOUSES[transfer.from].name,
				WAREHOUSES[transfer.to].name,
				SHIPPING[transfer.mode].freight,
				unitCount(transfer),
				stockValue(transfer),
				STAGE_INFO[transfer.status].label,
				transfer.by,
			];
			lines.push(fields.map(quoted).join(','));
		}
		const fileName = `stock-transfers-${isoOf(DEMO_DAY)}.csv`;
		const href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv' }));
		const link = document.createElement('a');
		link.href = href;
		link.download = fileName;
		document.body.append(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(href), 1000);
		notify({
			tone: 'success',
			icon: 'bi-download',
			title: `Exported ${countOf(listed.length, 'transfer')}`,
			text: fileName,
		});
	}

	/* The drawer: one transfer, its lines, its tracking and its next action. */

	function summaryLine(transfer) {
		const from = WAREHOUSES[transfer.from].name;
		const to = WAREHOUSES[transfer.to];
		const lines = {
			approval: () =>
				`Waiting for your approval. Once approved, ${from} packs it and it should arrive by ${monthDay(arrivalDate(transfer))}.`,
			packing: () =>
				`Approved. ${from} is packing it to ship ${relativeDay(transfer.shipBy)}, due ${monthDay(arrivalDate(transfer))}.`,
			transit: () => `On its way with ${SHIPPING[transfer.mode].carrier}, due ${relativeDay(transfer.eta)}.`,
			customs: () =>
				transfer.hold
					? `Held at ${sortHub(transfer)}. ${transfer.hold}`
					: `Being sorted at ${sortHub(transfer)}, due ${relativeDay(transfer.eta)}.`,
			received: () =>
				`Received at ${to.name} on ${monthDay(transfer.received)}. All ${countOf(unitCount(transfer), 'unit')} were counted in.`,
			declined: () => `Declined on ${monthDay(transfer.declined)}. ${transfer.reason}`,
		};
		return lines[transfer.status]();
	}

	function stepMarkup(className, mark, title, detail) {
		const sub = detail ? `<span class="stx-sub">${detail}</span>` : '';
		return `<li class="stx-step ${className}"><span class="stx-step-mark" aria-hidden="true">${mark}</span><span><span class="stx-step-title">${title}</span>${sub}</span></li>`;
	}

	/** The tracking list: done steps carry a check, the first open one is current, the rest wait. */
	function trackMarkup(transfer) {
		const tick = '<i class="bi bi-check-lg"></i>';
		const steps = [];
		let number = 0;
		let reachedCurrent = false;

		function addStep(done, title, doneDetail, waitDetail) {
			number += 1;
			if (done) {
				steps.push(stepMarkup('is-done', tick, title, doneDetail));
				return;
			}
			steps.push(stepMarkup(reachedCurrent ? 'is-later' : 'is-current', number, title, waitDetail));
			reachedCurrent = true;
		}

		const sender = WAREHOUSES[transfer.from];
		const receiver = WAREHOUSES[transfer.to];
		addStep(true, 'Asked for', `${monthDay(transfer.raised)} · ${personLink(transfer.by)}`);
		if (transfer.status === 'declined') {
			steps.push(
				stepMarkup(
					'is-stopped',
					'<i class="bi bi-x-lg"></i>',
					'Declined',
					`${monthDay(transfer.declined)} · ${personLink(APPROVED_BY)}`,
				),
			);
			return steps.join('');
		}
		addStep(
			!!transfer.approved,
			'Approved',
			transfer.approved ? `${monthDay(transfer.approved)} · ${personLink(APPROVED_BY)}` : '',
			'Waiting for you',
		);
		addStep(
			!!transfer.shipped,
			'Shipped',
			transfer.shipped
				? `${monthDay(transfer.shipped)} · ${SHIPPING[transfer.mode].carrier} ${safe(transfer.ref)}`
				: '',
			transfer.status === 'packing'
				? `Packing at ${sender.name}, ships ${relativeDay(transfer.shipBy)}`
				: 'After approval',
		);
		if (sortHub(transfer)) {
			addStep(
				!!transfer.cleared,
				'Left the sort hub',
				transfer.cleared ? monthDay(transfer.cleared) : '',
				transfer.status === 'customs'
					? `Since ${monthDay(transfer.customsFrom)}${transfer.hold ? ' · held for papers' : ''}`
					: `On the way through ${sortHub(transfer)}`,
			);
		}
		addStep(
			!!transfer.received,
			'Received',
			transfer.received ? `${monthDay(transfer.received)} · counted in by ${personLink(receiver.lead)}` : '',
			`Due ${monthDay(arrivalDate(transfer))}`,
		);
		return steps.join('');
	}

	function footMarkup(transfer) {
		if (transfer.status === 'approval') {
			return '<button type="button" class="btn btn-outline-secondary" data-stx-do="decline">Decline</button><button type="button" class="btn btn-primary" data-stx-do="approve"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Approve</button>';
		}
		if (transfer.status === 'packing')
			return '<button type="button" class="btn btn-primary" data-stx-do="ship"><i class="bi bi-truck me-1" aria-hidden="true"></i>Mark as shipped</button>';
		if (ON_THE_MOVE.includes(transfer.status))
			return '<button type="button" class="btn btn-primary" data-stx-do="receive"><i class="bi bi-box-arrow-in-down me-1" aria-hidden="true"></i>Mark as received</button>';
		if (transfer.status === 'received')
			return '<a class="btn btn-outline-secondary" href="stock-levels.html">See stock levels</a>';
		return '<button type="button" class="btn btn-outline-secondary" data-stx-do="again"><i class="bi bi-arrow-repeat me-1" aria-hidden="true"></i>Raise again</button>';
	}

	function lineMarkup([sku, quantity]) {
		const product = CATALOG[sku];
		return `<li class="stx-item stx-cat-${product.cat}"><span class="stx-tile" aria-hidden="true"><i class="bi ${product.icon}"></i></span><span><span class="stx-line">${safe(product.name)}</span><span class="stx-sub">${sku} · ${quantity} × ${dollars(product.price)}</span></span><span class="stx-money">${dollars(quantity * product.price)}</span></li>`;
	}

	function paintDrawer(transfer) {
		const quote = transfer.note
			? `<blockquote class="stx-r-quote"><p>${noteMarkup(transfer)}</p><footer>${safe(transfer.by)}, ${monthDay(transfer.raised)}</footer></blockquote>`
			: '';
		drawerPart('title').textContent = transfer.id;
		drawerPart('sub').innerHTML =
			`<span class="stx-nw">${WAREHOUSES[transfer.from].name} →</span> <span class="stx-nw">${WAREHOUSES[transfer.to].name}</span>`;
		drawerPart('state').innerHTML =
			`${stagePill(transfer)}<p class="stx-r-note">${safe(summaryLine(transfer))}</p>${quote}`;
		drawerPart('lines').innerHTML = transfer.lines.map(lineMarkup).join('');
		drawerPart('total').innerHTML =
			`<span>${countOf(unitCount(transfer), 'unit')}</span><span class="stx-money">${dollars(stockValue(transfer))}</span>`;
		drawerPart('track').innerHTML = trackMarkup(transfer);
		growTrack(drawerPart('track'));
		drawerPart('foot').innerHTML = footMarkup(transfer);
		markSelectedRow(transfer.id);
	}

	/**
	 * Grows the filled lines between done steps the first time a transfer shows
	 * them on screen; every later fill shows them already drawn.
	 */
	function growTrack(trail) {
		if (trackGrown) {
			trail.classList.remove('is-drawing');
			return;
		}
		if (
			!window.IntersectionObserver ||
			stillness.matches ||
			!pickAll('.stx-step.is-done:not(:last-child)', trail).length
		)
			return;
		trackGrown = true;
		let left = 0;
		trail.classList.add('is-waiting');
		trail.addEventListener('animationend', function done(event) {
			if (event.animationName !== 'stx-trail-grow' || --left > 0) return;
			trail.classList.remove('is-drawing');
			trail.removeEventListener('animationend', done);
		});
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				left = pickAll('.stx-step.is-done:not(:last-child)', trail).length;
				trail.classList.remove('is-waiting');
				if (left) trail.classList.add('is-drawing');
			},
			{ threshold: 0.5 },
		);
		watch.observe(trail);
	}

	/** Shows the record at a position in the drawer's list; direction < 0 plays the backward slide. */
	function showRecordAt(position, direction) {
		drawerIndex = (position + drawerIds.length) % drawerIds.length;
		paintDrawer(recordById(drawerIds[drawerIndex]));
		pick('[data-basalt-record-pos]', ui.drawer).textContent = `${drawerIndex + 1} of ${drawerIds.length}`;
		ui.drawer.classList.toggle('is-back', direction < 0);
		/* Redrawing the footer drops focus when it sat on one of its buttons. */
		if (ui.drawer.classList.contains('show') && !ui.drawer.contains(document.activeElement)) ui.drawer.focus();
	}

	/** Opens the drawer on a transfer, stepping through the rows on screen (or everything when it is not among them). */
	function openDrawerFor(id) {
		drawerIds = listed.map((transfer) => transfer.id);
		if (!drawerIds.includes(id)) drawerIds = records.map((transfer) => transfer.id);
		showRecordAt(drawerIds.indexOf(id));
		bootstrap.Offcanvas.getOrCreateInstance(ui.drawer).show();
	}

	function drawerShows(transfer) {
		return ui.drawer.classList.contains('show') && drawerIds[drawerIndex] === transfer.id;
	}

	/** Applies an action, repaints the page, and repaints the drawer when it shows that transfer. */
	function carryOut(name, transfer) {
		decisions[name](transfer);
		paintAll();
		if (!drawerShows(transfer)) return;
		paintDrawer(transfer);
		const next = pick('.basalt-drawer-foot .btn-primary', ui.drawer) || pick('.basalt-drawer-foot .btn', ui.drawer);
		if (next) next.focus();
		else ui.drawer.focus();
	}

	const decisions = {
		approve(transfer) {
			transfer.status = 'packing';
			transfer.approved = isoOf(DEMO_DAY);
			transfer.shipBy = isoOf(shiftDays(DEMO_DAY, 1));
			notify({
				tone: 'success',
				icon: 'bi-check2-circle',
				title: `${transfer.id} approved`,
				text: `${WAREHOUSES[transfer.from].name} will pack it to ship tomorrow.`,
			});
		},
		decline(transfer) {
			transfer.status = 'declined';
			transfer.declined = isoOf(DEMO_DAY);
			transfer.reason = `Declined by ${APPROVED_BY}. ${transfer.by} has been told.`;
			notify({
				tone: 'warning',
				icon: 'bi-x-circle',
				title: `${transfer.id} declined`,
				text: `${transfer.by} has been told.`,
				actions: [
					{
						label: 'Undo',
						onClick() {
							transfer.status = 'approval';
							delete transfer.declined;
							delete transfer.reason;
							paintAll();
							if (drawerShows(transfer)) paintDrawer(transfer);
						},
					},
				],
			});
		},
		ship(transfer) {
			const tail = transfer.id.slice(-3);
			const prefixes = { sea: 'EMHU 5108', air: '5520 2240 ', road: '7730 ' };
			transfer.status = 'transit';
			transfer.shipped = isoOf(DEMO_DAY);
			transfer.eta = isoOf(shiftDays(DEMO_DAY, leadTime(transfer)));
			transfer.ref = `${prefixes[transfer.mode]}${tail}`;
			notify({
				tone: 'success',
				icon: 'bi-truck',
				title: `${transfer.id} shipped`,
				text: `With ${SHIPPING[transfer.mode].carrier}, due ${monthDay(transfer.eta)}.`,
			});
		},
		receive(transfer) {
			transfer.status = 'received';
			transfer.received = isoOf(DEMO_DAY);
			if (sortHub(transfer) && !transfer.cleared) transfer.cleared = isoOf(DEMO_DAY);
			notify({
				tone: 'success',
				icon: 'bi-box-arrow-in-down',
				title: `${transfer.id} received`,
				text: `${countOf(unitCount(transfer), 'unit')} added to ${WAREHOUSES[transfer.to].name}.`,
			});
		},
		again(transfer) {
			bootstrap.Offcanvas.getOrCreateInstance(ui.drawer).hide();
			seedTransfer = transfer;
			bootstrap.Modal.getOrCreateInstance(ui.dialog).show();
		},
	};

	/* The New transfer dialog. */

	function appendLine(sku, quantity) {
		lineCounter += 1;
		const fieldId = `stx-new-line-${lineCounter}`;
		const options = Object.entries(CATALOG)
			.map(
				([key, product]) =>
					`<option value="${key}"${key === sku ? ' selected' : ''} data-hint="${key}">${safe(product.name)}</option>`,
			)
			.join('');
		const row = document.createElement('li');
		row.className = 'stx-pick-row';
		row.innerHTML = `<label class="visually-hidden" for="${fieldId}">Product</label><select class="form-select" id="${fieldId}">${options}</select><div class="basalt-stepper stx-pick-qty" data-basalt-stepper><button type="button" class="basalt-stepper-btn" data-basalt-step="-1" aria-label="One fewer"><i class="bi bi-dash-lg" aria-hidden="true"></i></button><input type="number" class="basalt-stepper-input" value="${quantity || 1}" min="1" max="500" inputmode="numeric" aria-label="Units" aria-describedby="${fieldId}Free"><button type="button" class="basalt-stepper-btn" data-basalt-step="1" aria-label="One more"><i class="bi bi-plus-lg" aria-hidden="true"></i></button></div><button type="button" class="btn btn-icon stx-pick-remove" aria-label="Remove this product" data-stx-n-remove><i class="bi bi-trash3" aria-hidden="true"></i></button><p class="stx-pick-free" id="${fieldId}Free"></p>`;
		ui.lineList.append(row);
		window.Basalt.stepper?.(pick('[data-basalt-stepper]', row));
	}

	/** The dialog's lines as [sku, quantity] pairs, with repeats of a product added together. */
	function collectLines() {
		const merged = {};
		for (const row of pickAll('.stx-pick-row', ui.lineList)) {
			const sku = pick('select', row).value;
			const quantity = Math.max(1, parseInt(pick('input', row).value, 10) || 1);
			merged[sku] = (merged[sku] || 0) + quantity;
		}
		return Object.entries(merged);
	}

	/** Disables the ways of shipping that do not run on the chosen lane and picks a default. */
	function refreshModes() {
		const from = ui.fromSelect.value;
		const to = ui.toSelect.value;
		const laneSet = to && to !== from;
		for (const radio of ui.modeRadios) {
			const days = laneSet ? transitDays(from, to, radio.value) : null;
			radio.disabled = laneSet && days === null;
			if (radio.disabled) radio.checked = false;
			const hint = pick(`[data-stx-mode-text="${radio.value}"]`, ui.dialog);
			if (!laneSet) hint.textContent = SHIPPING[radio.value].hint;
			else if (days === null) hint.textContent = 'Not offered here';
			else hint.textContent = `${countOf(days, 'day')} door to door`;
		}
		if (laneSet && !ui.modeRadios.some((radio) => radio.checked)) {
			const fallback = transitDays(from, to, 'road') ? 'road' : 'air';
			ui.modeRadios.find((radio) => radio.value === fallback).checked = true;
		}
	}

	/** Writes the free stock under each line and flags lines asking for more than there is. Returns the first flagged row. */
	function refreshLines(flagNow) {
		const from = ui.fromSelect.value;
		const siteName = WAREHOUSES[from].name;
		const rows = pickAll('.stx-pick-row', ui.lineList);
		const asked = Object.fromEntries(collectLines());
		let firstBad = null;
		for (const row of rows) {
			pick('[data-stx-n-remove]', row).hidden = rows.length === 1;
			const sku = pick('select', row).value;
			const have = freeStock(sku, from);
			const over = asked[sku] > have;
			const note = pick('.stx-pick-free', row);
			const stepper = pick('.stx-pick-qty', row);
			const flagged = over && (flagNow || note.classList.contains('is-invalid'));
			if (flagged) note.textContent = have ? `Only ${have} free at ${siteName}.` : `None free at ${siteName}.`;
			else note.textContent = `${have} free at ${siteName}`;
			note.classList.toggle('is-invalid', flagged);
			stepper.classList.toggle('is-invalid', flagged);
			pick('input', stepper).setAttribute('aria-invalid', String(flagged));
			if (over && !firstBad) firstBad = row;
		}
		return firstBad;
	}

	function refreshSummary() {
		const lines = collectLines();
		const from = ui.fromSelect.value;
		const to = ui.toSelect.value;
		const chosen = ui.modeRadios.find((radio) => radio.checked);
		let units = 0;
		let worth = 0;
		for (const [sku, quantity] of lines) {
			units += quantity;
			worth += quantity * CATALOG[sku].price;
		}
		let text = `${countOf(lines.length, 'product')} · ${countOf(units, 'unit')} · <strong>${dollars(worth)}</strong> of stock`;
		if (to && to !== from && chosen) {
			text += ` · ships tomorrow, due ${monthDay(shiftDays(DEMO_DAY, 1 + transitDays(from, to, chosen.value)))}`;
		}
		ui.dialogSummary.innerHTML = text;
	}

	function clearToError() {
		ui.toSelect.classList.remove('is-invalid');
		ui.toSelect.removeAttribute('aria-invalid');
	}

	function refreshDialog() {
		refreshModes();
		refreshLines(false);
		refreshSummary();
	}

	/** Resets the dialog, from a seed transfer when "Raise again" opened it. */
	function fillDialog() {
		/* Earlier confirmations would sit over the dialog's buttons. */
		window.Basalt.toasts?.clear();
		const seed = seedTransfer;
		seedTransfer = null;
		ui.form.reset();
		clearToError();
		ui.lineList.innerHTML = '';
		ui.fromSelect.value = seed ? seed.from : 'columbus';
		ui.toSelect.value = seed ? seed.to : '';
		if (seed) {
			for (const [sku, quantity] of seed.lines) appendLine(sku, quantity);
		} else {
			appendLine('ML-BLAZ', 5);
		}
		for (const radio of ui.modeRadios) radio.checked = !!seed && radio.value === seed.mode;
		ui.noteField.value = seed ? seed.note : '';
		refreshDialog();
	}

	function swapRoute() {
		if (!ui.toSelect.value) return;
		[ui.fromSelect.value, ui.toSelect.value] = [ui.toSelect.value, ui.fromSelect.value];
		clearToError();
		refreshDialog();
	}

	function addAnotherLine() {
		const used = collectLines().map(([sku]) => sku);
		const unused = Object.keys(CATALOG).find((sku) => !used.includes(sku)) || 'ML-OXFD';
		appendLine(unused, 1);
		refreshDialog();
		const lastRow = pickAll('.stx-pick-row', ui.lineList).pop();
		pick('.basalt-select-trigger, select', lastRow)?.focus();
	}

	function submitNewTransfer(event) {
		event.preventDefault();
		const from = ui.fromSelect.value;
		const to = ui.toSelect.value;
		if (!to || to === from) {
			ui.toError.textContent = to
				? 'Pick a different warehouse from the one it leaves.'
				: 'Choose where the stock goes.';
			ui.toSelect.classList.add('is-invalid');
			ui.toSelect.setAttribute('aria-invalid', 'true');
			const trigger = pick('.basalt-select-trigger', ui.toSelect.parentElement) || ui.toSelect;
			trigger.focus();
			return;
		}
		const shortRow = refreshLines(true);
		if (shortRow) {
			pick('.basalt-stepper-input', shortRow).focus();
			return;
		}
		const highest = Math.max(...records.map((transfer) => Number(transfer.id.replace(/\D/g, ''))));
		const transfer = {
			id: `#${highest + 1}`,
			from,
			to,
			mode: ui.modeRadios.find((radio) => radio.checked).value,
			by: APPROVED_BY,
			status: 'packing',
			raised: isoOf(DEMO_DAY),
			approved: isoOf(DEMO_DAY),
			shipBy: isoOf(shiftDays(DEMO_DAY, 1)),
			lines: collectLines(),
			note: ui.noteField.value.trim(),
			isNew: true,
		};
		records.unshift(transfer);
		filters.q = '';
		ui.search.value = '';
		if (filters.site && filters.site !== from && filters.site !== to) filters.site = '';
		selectTab('open');
		paintTrips();
		const row = pick(`tr[data-stx-id="${transfer.id}"]`, ui.rows);
		if (row) {
			ui.dialog.addEventListener(
				'hidden.bs.modal',
				() => {
					row.scrollIntoView({ block: 'center', behavior: stillness.matches ? 'auto' : 'smooth' });
				},
				{ once: true },
			);
		}
		bootstrap.Modal.getOrCreateInstance(ui.dialog).hide();
		notify({
			tone: 'success',
			icon: 'bi-box-seam',
			title: `${transfer.id} created`,
			text: `${WAREHOUSES[from].name} will pack ${countOf(unitCount(transfer), 'unit')} to ship tomorrow.`,
			actions: [{ label: 'Open', onClick: () => openDrawerFor(transfer.id) }],
		});
	}

	start();
})();
