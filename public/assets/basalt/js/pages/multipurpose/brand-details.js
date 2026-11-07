/**
 * Brand Details (brand-details.html).
 *
 * One maker whose clothes Marlo sells, picked by ?id= in the address: what
 * it supplies and how each piece is selling, six months of sales, its
 * purchase orders, the buying terms, the contact, team notes and an activity
 * feed. The makers, products and figures are the same ones the Brands page
 * (brands.html) lists, so a brand reads alike on both. A missing or
 * unknown id opens Hollis Atelier. In a real app MAKERS comes from your API and
 * each Save posts its change; the clock is pinned so the demo dates read the
 * same on every visit.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-bd-root]', document);
	if (!pageRoot) return;

	const CLOCK = new Date(2026, 9, 9, 11, 20);
	const SIGNED_IN = 'John Armstrong';
	const HOME_ID = 'hollis';
	const FEED_LIMIT = 5;
	const LOGO_LIMIT = 1024 * 1024;
	const MONTH_LABELS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
	const RANK_WORDS = ['', '1st', '2nd', '3rd'];
	const TERM_CHOICES = ['Net 30', 'Net 45', 'Prepaid'];
	const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	const STATUS_META = {
		active: ['Active', 'success'],
		onboarding: ['Onboarding', 'info'],
		paused: ['Paused', 'warning'],
	};
	const ORDER_META = {
		shipped: ['On the way', 'info'],
		received: ['Received', 'success'],
		returned: ['Sent back', 'danger'],
	};
	const UNIT_WORDS = {
		seats: ['member joined', 'members joined'],
		packs: ['card sold', 'cards sold'],
		booked: ['booking', 'bookings'],
	};
	const SECTION_ICON = { buying: 'bi-receipt', contact: 'bi-person-lines-fill', about: 'bi-building-gear' };
	const SECTION_WORD = { buying: 'buying terms', contact: 'contact', about: 'brand details' };

	/*
	 * How a product reads in the Stock column when its kind settles the
	 * answer; stocked items fall through to the count.
	 */
	const KIND_STOCK = {
		digital: '<span class="bd-state">Digital</span>',
		service: '<span class="bd-state">Bookable</span>',
		hidden: '<span class="bd-state">On sale</span><span class="bd-sub">None in stock yet</span>',
		review: '<span class="bd-state bd-state-info">In review</span><span class="bd-sub">Not on sale yet</span>',
	};

	/* The second line of a purchase order, by where it is. */
	const ORDER_DATE = {
		shipped: (order) => `Arrives ${calendarDay(order.due)}`,
		received: (order) => `Received ${calendarDay(order.on)}`,
		returned: (order) => `Sent back ${calendarDay(order.on)}`,
	};

	/* The feed entry an order earns once it has landed, or come back. */
	const LANDING = {
		received: (order) => ({
			at: `${order.on}T14:30`,
			icon: 'bi-box-seam',
			text: `${order.id} <strong>arrived</strong> at the Elko warehouse`,
		}),
		returned: (order) => ({
			at: `${order.on}T11:10`,
			icon: 'bi-arrow-return-left',
			text: `${order.id} was <strong>sent back</strong> to ${htmlSafe(maker.name)}`,
		}),
	};

	/*
	 * Products, prices, stock and sales match the Brands page. `sold` counts
	 * the last 90 days in the product's `unit`; `prev` is the brand's sales in
	 * the 90 days before that; `shape` splits each 90 days over its three
	 * months. Purchase orders run newest first, and the first is the one the
	 * Brands page shows as the latest.
	 */
	const MAKERS = [
		{
			id: 'hollis',
			name: 'Hollis Atelier',
			tone: 2,
			status: 'active',
			makes: 'Tailoring and eveningwear',
			city: 'Champaign',
			country: 'IL',
			since: 2022,
			web: 'hollisatelier.com',
			prev: 1135900,
			shape: [0.31, 0.33, 0.36, 0.3, 0.33, 0.37],
			buying: { lead: 21, terms: 'Net 45', min: 10000 },
			contact: {
				name: 'Carly Caldwell',
				role: 'Partner manager',
				email: 'carly.caldwell@hollisatelier.com',
				phone: '+1 217 555 0122',
			},
			products: [
				{
					sku: 'ML-BLAZ',
					name: 'Sculpted Shoulder Blazer',
					price: 1290,
					icon: 'bi-briefcase',
					kind: 'stock',
					stock: 184,
					sold: 388,
				},
				{
					sku: 'ML-GOWN',
					name: 'Draped Column Gown',
					price: 2150,
					icon: 'bi-stars',
					kind: 'stock',
					stock: 236,
					sold: 359,
				},
			],
			pos: [
				{
					id: '#1184',
					placed: '2026-09-22',
					amount: 51600,
					state: 'shipped',
					due: '2026-10-13',
					what: '100 Sculpted Shoulder Blazers',
				},
				{
					id: '#1171',
					placed: '2026-08-18',
					amount: 103200,
					state: 'received',
					on: '2026-09-08',
					what: '120 Draped Column Gowns',
				},
				{
					id: '#1160',
					placed: '2026-07-14',
					amount: 77400,
					state: 'received',
					on: '2026-08-04',
					what: '150 Sculpted Shoulder Blazers',
				},
			],
			notes: [
				{
					at: '2026-09-30T15:10',
					by: 'John Armstrong',
					text: "Carly says this year's prices hold until March. Ask about a leather coat sample in November.",
				},
				{
					at: '2026-08-14T09:40',
					by: 'Connie Reese',
					text: 'Moved to Net 45 after the second year of on-time payments.',
				},
			],
			events: [
				{
					at: '2026-10-06T08:15',
					icon: 'bi-truck',
					text: '<strong>Carly Caldwell</strong> confirmed #1184 left Champaign',
				},
				{
					at: '2026-08-14T09:35',
					icon: 'bi-receipt',
					text: '<strong>Connie Reese</strong> changed payment terms from Net 30 to Net 45',
				},
			],
		},
		{
			id: 'marlo',
			name: 'Marlo',
			tone: 1,
			status: 'active',
			makes: 'Own label',
			city: 'Akron',
			country: 'OH',
			since: null,
			web: 'marlo.com',
			prev: 1094100,
			shape: [0.32, 0.33, 0.35, 0.31, 0.33, 0.36],
			buying: { madeBy: 'Workshops in Akron and Erie', lead: 35, terms: 'Net 30', min: 15000 },
			contact: {
				name: 'Dawn Fischer',
				role: 'Production lead',
				email: 'dawn.fischer@marlo.com',
				phone: '+1 330 555 0148',
			},
			products: [
				{
					sku: 'ML-PASS',
					name: 'Express Delivery Pass',
					price: 15,
					per: '/member/month',
					unit: 'seats',
					icon: 'bi-truck',
					kind: 'digital',
					sold: 1315,
				},
				{
					sku: 'ML-MTM',
					name: 'Made-to-Measure Tailoring',
					price: 4800,
					unit: 'booked',
					icon: 'bi-rulers',
					kind: 'service',
					sold: 23,
				},
				{
					sku: 'ML-LOAF',
					name: 'Bar Loafers',
					price: 790,
					icon: 'bi-gem',
					kind: 'stock',
					stock: 540,
					sold: 520,
				},
				{
					sku: 'ML-GIFT250',
					name: 'E-Gift Card, $250',
					price: 250,
					unit: 'packs',
					icon: 'bi-gift',
					kind: 'digital',
					sold: 1149,
				},
				{
					sku: 'ML-STYLE',
					name: 'Private Styling Session',
					price: 650,
					unit: 'booked',
					icon: 'bi-person-standing-dress',
					kind: 'service',
					sold: 60,
				},
				{
					sku: 'ML-CARE',
					name: 'Aftercare Plan, monthly',
					price: 25,
					per: '/member/month',
					unit: 'seats',
					icon: 'bi-scissors',
					kind: 'digital',
					sold: 814,
				},
				{
					sku: 'ML-OXFD',
					name: 'Two-Tone Oxfords',
					price: 850,
					icon: 'bi-award',
					kind: 'stock',
					stock: 310,
					sold: 360,
				},
			],
			pos: [
				{
					id: '#1179',
					placed: '2026-09-02',
					amount: 189600,
					state: 'received',
					on: '2026-09-30',
					what: '600 Bar Loafers',
				},
				{
					id: '#1158',
					placed: '2026-07-08',
					amount: 136000,
					state: 'received',
					on: '2026-08-12',
					what: '400 Two-Tone Oxfords',
				},
			],
			notes: [
				{
					at: '2026-10-01T11:05',
					by: 'Dawn Fischer',
					text: 'New loafer colors due in November. Keep the old stock under 600 until then.',
				},
			],
			events: [
				{
					at: '2026-09-14T10:20',
					icon: 'bi-tag',
					text: '<strong>Dawn Fischer</strong> priced the E-Gift Card at $25 a card',
				},
			],
		},
		{
			id: 'calder',
			name: 'Calder Couture',
			tone: 3,
			status: 'active',
			makes: 'Couture dresses',
			city: 'Galesburg',
			country: 'IL',
			since: 2023,
			web: 'caldercouture.com',
			prev: 873900,
			shape: [0.3, 0.33, 0.37, 0.29, 0.33, 0.38],
			buying: { lead: 14, terms: 'Net 30', min: 5000 },
			contact: {
				name: 'Gerald Burnett',
				role: 'Account manager',
				email: 'gerald.burnett@caldercouture.com',
				phone: '+1 309 555 0120',
			},
			products: [
				{
					sku: 'ML-ORGZ',
					name: 'Tiered Organza Dress',
					price: 1680,
					icon: 'bi-flower1',
					kind: 'stock',
					stock: 412,
					sold: 620,
				},
			],
			pos: [
				{
					id: '#1181',
					placed: '2026-09-10',
					amount: 201600,
					state: 'received',
					on: '2026-09-24',
					what: '300 Tiered Organza Dresses',
				},
				{
					id: '#1163',
					placed: '2026-08-04',
					amount: 268800,
					state: 'received',
					on: '2026-08-18',
					what: '400 Tiered Organza Dresses',
				},
			],
			notes: [
				{
					at: '2026-09-25T16:30',
					by: 'John Armstrong',
					text: 'Fast and reliable. Worth asking for a better price above 500 dresses.',
				},
			],
			events: [],
		},
		{
			id: 'willamette',
			name: 'Willamette Tailors',
			tone: 4,
			status: 'active',
			makes: 'Suits and leather outerwear',
			city: 'Salina',
			country: 'KS',
			since: 2023,
			web: 'willamettetailors.com',
			prev: 890300,
			shape: [0.34, 0.33, 0.33, 0.35, 0.33, 0.32],
			buying: { lead: 21, terms: 'Net 30', min: 3000 },
			contact: {
				name: 'Robin Dickerson',
				role: 'Key accounts',
				email: 'r.dickerson@willamettetailors.com',
				phone: '+1 785 555 0117',
			},
			products: [
				{
					sku: 'ML-TRCH',
					name: 'Leather Trench Coat',
					price: 3200,
					icon: 'bi-cloud-drizzle',
					kind: 'stock',
					stock: 128,
					sold: 165,
				},
				{
					sku: 'ML-SUIT',
					name: 'Chalk-Stripe Suit',
					price: 2450,
					icon: 'bi-person-standing',
					kind: 'stock',
					stock: 96,
					sold: 126,
				},
			],
			pos: [
				{
					id: '#1189',
					placed: '2026-09-29',
					amount: 194400,
					state: 'shipped',
					due: '2026-10-20',
					what: '120 suits, 60 trench coats',
				},
				{
					id: '#1166',
					placed: '2026-07-31',
					amount: 129600,
					state: 'received',
					on: '2026-08-21',
					what: '80 suits, 40 trench coats',
				},
			],
			notes: [
				{
					at: '2026-09-29T10:00',
					by: 'John Armstrong',
					text: 'Sales dipped after the suit price rise. Watch October before ordering more.',
				},
			],
			events: [],
		},
		{
			id: 'fairhaven',
			name: 'Fairhaven Optical',
			tone: 5,
			status: 'active',
			makes: 'Acetate and metal eyewear',
			city: 'Joplin',
			country: 'MO',
			since: 2024,
			web: 'fairhavenoptical.com',
			prev: 209000,
			shape: [0.32, 0.34, 0.34, 0.33, 0.35, 0.32],
			buying: { lead: 21, terms: 'Prepaid', min: 2000 },
			contact: {
				name: 'Melanie Elliot',
				role: 'Trade sales',
				email: 'melanie@fairhavenoptical.com',
				phone: '+1 417 555 0190',
			},
			products: [
				{
					sku: 'ML-SHLD',
					name: 'Shield Sunglasses',
					price: 520,
					icon: 'bi-eyeglasses',
					kind: 'stock',
					stock: 0,
					sold: 298,
					due: '2026-10-16',
				},
				{
					sku: 'ML-CATE',
					name: 'Cat-Eye Sunglasses',
					price: 465,
					icon: 'bi-sunglasses',
					kind: 'stock',
					stock: 22,
					low: true,
					sold: 130,
				},
			],
			pos: [
				{
					id: '#1192',
					placed: '2026-09-25',
					amount: 24960,
					state: 'shipped',
					due: '2026-10-16',
					what: '120 Shield Sunglasses',
				},
				{
					id: '#1174',
					placed: '2026-08-13',
					amount: 32400,
					state: 'received',
					on: '2026-09-03',
					what: '40 cat-eyes, 120 shields',
				},
			],
			notes: [
				{
					at: '2026-10-02T09:15',
					by: 'John Armstrong',
					text: 'Shield sunglasses sold out a week early. Order 200 next time, not 120.',
				},
			],
			events: [
				{
					at: '2026-10-02T08:50',
					icon: 'bi-exclamation-circle',
					text: 'Shield Sunglasses <strong>sold out</strong>',
				},
			],
		},
		{
			id: 'brightloom',
			name: 'Brightloom',
			tone: 6,
			status: 'paused',
			pausedOn: '2026-09-02',
			pauseNote:
				'A batch of silk ties failed our color test. Both products are hidden from the Store until a new batch passes.',
			makes: 'Silk ties and pocket squares',
			city: 'Greenville',
			country: 'SC',
			since: 2024,
			web: 'brightloom.com',
			prev: 135000,
			shape: [0.33, 0.34, 0.33, 0.52, 0.44, 0.04],
			buying: { lead: 28, terms: 'Net 30', min: 2500 },
			contact: {
				name: 'Kevin Zane',
				role: 'Sales manager',
				email: 'kevin.zane@brightloom.com',
				phone: '+1 864 555 0172',
			},
			products: [
				{ sku: 'ML-STIE', name: 'Silk Twill Tie', price: 185, icon: 'bi-wind', kind: 'hidden', sold: 214 },
				{
					sku: 'ML-PSQ3',
					name: 'Pocket Squares, 3-pack',
					price: 145,
					icon: 'bi-square',
					kind: 'hidden',
					sold: 302,
				},
			],
			pos: [
				{
					id: '#1176',
					placed: '2026-08-26',
					amount: 37000,
					state: 'returned',
					on: '2026-09-04',
					what: '500 ties, sent back',
				},
				{
					id: '#1150',
					placed: '2026-06-16',
					amount: 51000,
					state: 'received',
					on: '2026-07-14',
					what: '300 ties, 600 squares',
				},
			],
			notes: [
				{
					at: '2026-09-28T14:20',
					by: 'John Armstrong',
					text: 'Kevin is sending a new batch for testing. Expected mid-October.',
				},
			],
			events: [
				{
					at: '2026-09-02T13:05',
					icon: 'bi-droplet',
					text: 'A batch of silk ties <strong>failed the color test</strong>',
				},
			],
		},
		{
			id: 'hartwell',
			name: 'Hartwell Stokes',
			tone: 7,
			status: 'onboarding',
			signed: '2026-09-22',
			onboardNote: 'Both styles are being wear-tested before they go on sale.',
			makes: 'Leather gloves',
			city: 'Kalamazoo',
			country: 'MI',
			since: 2026,
			web: 'hartwellstokes.com',
			prev: 0,
			shape: [0, 0, 0, 0, 0, 0],
			buying: { lead: 21, terms: 'Net 30', min: 4000 },
			contact: {
				name: 'Jacob Becker',
				role: 'Trade sales',
				email: 'j.becker@hartwellstokes.com',
				phone: '+1 269 555 0130',
			},
			products: [
				{
					sku: 'ML-GLV-NP',
					name: 'Nappa Opera Gloves',
					price: 390,
					icon: 'bi-snow3',
					kind: 'review',
					sold: 0,
				},
				{
					sku: 'ML-GLV-SD',
					name: 'Suede Driving Gloves',
					price: 290,
					icon: 'bi-snow',
					kind: 'review',
					sold: 0,
				},
			],
			pos: [
				{
					id: '#1194',
					placed: '2026-10-01',
					amount: 41100,
					state: 'shipped',
					due: '2026-10-22',
					what: '300 gloves, the first order',
				},
			],
			notes: [
				{
					at: '2026-09-22T17:00',
					by: 'John Armstrong',
					text: 'Signed today. Wear-test both pairs on the studio team before listing them.',
				},
			],
			events: [
				{
					at: '2026-09-22T16:45',
					icon: 'bi-pen',
					text: '<strong>John Armstrong</strong> signed Hartwell Stokes as a new maker',
				},
			],
		},
	];

	/*
	 * The makers with their totals worked out, biggest seller first, and the
	 * one this page is about. The clock's date is kept as text for the
	 * "today" comparisons.
	 */
	const makers = MAKERS.map(withTotals).sort((a, b) => b.sales - a.sales);
	const storeSales = makers.reduce((sum, row) => sum + row.sales, 0);
	const wantedId = new URLSearchParams(location.search).get('id');
	const maker = makers.find((row) => row.id === wantedId) || makers.find((row) => row.id === HOME_ID);
	const dayStamp = clockStamp(CLOCK).slice(0, 10);
	let feedExpanded = false;
	let draftLogo = null;
	let ui = null;

	/*
	 * Everything starts here: the feed is assembled, the editors, logo picker,
	 * pause and resume, note form and feed toggle are wired, and the page is
	 * painted once.
	 */
	function start() {
		ui = collectNodes();
		maker.activity = buildFeed();
		maker.notes.sort(newestFirst);
		wireLogoPicker();
		for (const card of ui.sections) wireSection(card);
		for (const button of pickAll('[data-bd-edit-go]')) {
			button.addEventListener('click', () => toggleEditor(button.getAttribute('data-bd-edit-go'), true));
		}
		ui.pauseButton.addEventListener('click', () => switchStatus('paused'));
		ui.resumeButton.addEventListener('click', () => switchStatus('active'));
		ui.moreButton.addEventListener('click', () => {
			window.Basalt.slide(hook('activity'), () => {
				feedExpanded = !feedExpanded;
				paintFeed();
			});
		});
		wireNoteForm();
		paint();
	}

	function pick(selector, scope = pageRoot) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = pageRoot) {
		return [...scope.querySelectorAll(selector)];
	}

	function hook(name) {
		return pick(`[data-bd="${name}"]`);
	}

	function sectionCard(name) {
		return pick(`[data-bd-section="${name}"]`);
	}

	function collectNodes() {
		const aboutCard = sectionCard('about');
		return {
			sections: pickAll('[data-bd-section]'),
			logoFile: pick('[data-bd-logo-input]', aboutCard),
			logoClear: pick('[data-bd-logo-remove]', aboutCard),
			logoPreview: pick('[data-bd-logo-preview]', aboutCard),
			nameField: pick('[data-bd-f="name"]', aboutCard),
			orderButton: pick('[data-bd-po]'),
			resumeButton: pick('[data-bd-resume]'),
			pauseButton: pick('[data-bd-pause]'),
			pauseItems: pickAll('[data-bd-pause-wrap]'),
			moreButton: pick('[data-bd-more]'),
			noteField: pick('[data-bd-note]'),
			noteForm: pick('[data-bd-note-form]'),
		};
	}

	function htmlSafe(value) {
		return `${value ?? ''}`.replace(/[&<>"']/g, (mark) => ESCAPES[mark]);
	}

	function notify(message) {
		window.Basalt.toasts?.push(message);
	}

	function sayAloud(text) {
		window.Basalt.announce?.(text);
	}

	function dollars(amount) {
		return `$${Math.round(amount).toLocaleString('en-US')}`;
	}

	/** "$64.9k" above a thousand, "$318k" above a hundred thousand, else whole dollars. */
	function compact(amount) {
		if (amount < 1000) return dollars(amount);
		return `$${(amount / 1000).toFixed(amount >= 100000 ? 0 : 1)}k`;
	}

	function countOf(total, word, many = `${word}s`) {
		return `${total.toLocaleString('en-US')} ${total === 1 ? word : many}`;
	}

	function twoDigits(number) {
		return String(number).padStart(2, '0');
	}

	/** A local "YYYY-MM-DDTHH:MM" stamp, the form the feed and notes are keyed by. */
	function clockStamp(date) {
		const dayPart = [date.getFullYear(), twoDigits(date.getMonth() + 1), twoDigits(date.getDate())].join('-');
		return `${dayPart}T${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
	}

	function calendarDay(iso) {
		return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	/** "Today, 11:20 am", "Yesterday, 3:05 pm" or "Sep 30, 3:10 pm". */
	function whenWords(iso) {
		const clock = new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
		const gap = Math.round((new Date(dayStamp) - new Date(iso.slice(0, 10))) / 864e5);
		const dayWord = { 0: 'Today', 1: 'Yesterday' }[gap] || calendarDay(iso);
		return `${dayWord}, ${clock}`;
	}

	function monogram(name) {
		return name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0])
			.join('')
			.toUpperCase();
	}

	function newestFirst(a, b) {
		return (b.at > a.at) - (b.at < a.at);
	}

	/** Sales, stock on hand and what is out or low, all read off the product rows. */
	function withTotals(record) {
		const boxed = record.products.filter((item) => item.kind === 'stock');
		record.sales = record.products.reduce((sum, item) => sum + revenueOf(item), 0);
		record.onHand = boxed.reduce((sum, item) => sum + item.stock, 0);
		record.boxed = boxed.length > 0;
		record.out = boxed.filter((item) => item.stock === 0);
		record.low = boxed.filter((item) => item.low);
		record.change = record.prev ? Math.round(((record.sales - record.prev) / record.prev) * 100) : null;
		return record;
	}

	function revenueOf(item) {
		return item.price * item.sold;
	}

	function inboundOrder() {
		return maker.pos.find((order) => order.state === 'shipped');
	}

	/** The brand's own events plus one entry per order placed, landed or returned, newest first. */
	function buildFeed() {
		const stream = maker.events.slice();
		for (const purchase of maker.pos) {
			stream.push({
				at: `${purchase.placed}T10:00`,
				icon: 'bi-cart-plus',
				text: `<strong>${SIGNED_IN}</strong> placed ${purchase.id} for ${htmlSafe(purchase.what.replace(/, .*$/, ''))}`,
			});
			const landed = LANDING[purchase.state];
			if (landed) stream.push(landed(purchase));
		}
		if (maker.status === 'paused') {
			stream.push({
				at: `${maker.pausedOn}T15:00`,
				icon: 'bi-pause-circle',
				text: `<strong>${SIGNED_IN}</strong> paused selling`,
			});
		}
		return stream.sort(newestFirst);
	}

	function recordAction(icon, text) {
		maker.activity.unshift({
			at: clockStamp(CLOCK),
			icon,
			text: `<strong>${SIGNED_IN}</strong> ${text}`,
			fresh: true,
		});
	}

	function paint() {
		paintHeader();
		paintBanner();
		paintFigures();
		paintProducts();
		paintMonths();
		paintOrders();
		for (const editorName of Object.keys(EDITORS)) paintFacts(editorName);
		paintNotes();
		paintFeed();
	}

	function markHtml(source, name) {
		return source ? `<img src="${source}" alt="">` : htmlSafe(monogram(name));
	}

	function statusMarkup(status) {
		const [label, tone] = STATUS_META[status];
		return `<span class="basalt-status basalt-status-dot basalt-status-${tone}">${label}</span>`;
	}

	/* Header: logo, name, the line under it, tags, the menu and the pager. */
	function paintHeader() {
		document.title = `${maker.name} · Basalt`;
		const mark = hook('logo');
		mark.className = `bd-logo bd-tone-${maker.tone}`;
		mark.innerHTML = markHtml(maker.logo, maker.name);
		hook('name').textContent = maker.name;
		hook('sub').textContent = [
			maker.makes,
			`${maker.city}, ${maker.country}`,
			maker.since && `partner since ${maker.since}`,
		]
			.filter(Boolean)
			.join(' · ');
		const outCount = maker.out.length;
		const outTag =
			maker.status === 'active' && outCount
				? `<span class="basalt-status basalt-status-dot basalt-status-danger">${countOf(outCount, 'product')} out</span>`
				: '';
		hook('tags').innerHTML = statusMarkup(maker.status) + outTag;
		ui.orderButton.hidden = maker.status === 'paused';
		ui.resumeButton.hidden = maker.status !== 'paused';
		for (const menuItem of ui.pauseItems) menuItem.hidden = maker.status !== 'active';

		const mailLink = hook('mail');
		mailLink.href = `mailto:${maker.contact.email}`;
		mailLink.lastChild.textContent = `Email ${maker.contact.name.split(' ')[0]}`;

		const place = makers.indexOf(maker);
		const neighbors = { prev: makers.at(place - 1), next: makers[(place + 1) % makers.length] };
		for (const [key, other] of Object.entries(neighbors)) {
			const anchor = hook(key);
			anchor.href = `brand-details.html?id=${encodeURIComponent(other.id)}`;
			anchor.setAttribute('aria-label', `${key === 'prev' ? 'Previous' : 'Next'} brand: ${other.name}`);
		}
	}

	/* One slim line explaining a pause, an onboarding or an empty shelf. */
	function paintBanner() {
		const banner = hook('notice');
		const [tone, body] = bannerContent();
		banner.hidden = !body;
		banner.className = tone ? `bd-notice bd-notice-${tone}` : 'bd-notice';
		banner.innerHTML = body;
	}

	function bannerContent() {
		if (maker.status === 'paused') {
			return [
				'warning',
				`<i class="bi bi-pause-circle" aria-hidden="true"></i><span>Paused on ${calendarDay(maker.pausedOn)}. ${htmlSafe(maker.pauseNote || 'Its products are hidden from the Store.')}</span>`,
			];
		}
		if (maker.status === 'onboarding') {
			const firstOrder = inboundOrder();
			const arrival = firstOrder ? ` The first stock arrives ${calendarDay(firstOrder.due)}.` : '';
			return [
				'info',
				`<i class="bi bi-hourglass-split" aria-hidden="true"></i><span>Signed on ${calendarDay(maker.signed)}. ${htmlSafe(maker.onboardNote)}${arrival}</span>`,
			];
		}
		if (maker.out.length) {
			const inbound = inboundOrder();
			const relief = inbound
				? ` ${htmlSafe(inbound.what)} arrive ${calendarDay(inbound.due)} on <a href="purchase-orders.html">${inbound.id}</a>.`
				: '';
			return [
				'warning',
				`<i class="bi bi-box-seam" aria-hidden="true"></i><span>${htmlSafe(maker.out[0].name)} is out of stock.${relief}</span>`,
			];
		}
		return ['', ''];
	}

	/* The four figures: sales, store share, stock on hand, next delivery. */
	function paintFigures() {
		hook('fig-sales').textContent = dollars(maker.sales);
		const salesNote = hook('fig-sales-note');
		if (maker.change == null) {
			salesNote.className = 'bd-fig-note';
			salesNote.textContent = 'No sales yet';
		} else {
			const direction = maker.change >= 0 ? 'up' : 'down';
			salesNote.className = `bd-fig-note bd-${direction}`;
			salesNote.innerHTML = `<i class="bi bi-arrow-${direction}-short" aria-hidden="true"></i>${Math.abs(maker.change)}% on the 90 days before`;
		}

		const sellers = makers.filter((row) => row.sales > 0);
		hook('fig-share').textContent = `${Math.round((maker.sales / storeSales) * 100)}%`;
		hook('fig-share-note').textContent = shareWords(sellers.indexOf(maker) + 1, sellers.length);

		const stockNote = hook('fig-stock-note');
		if (maker.boxed) {
			hook('fig-stock').textContent = countOf(maker.onHand, 'unit');
			const [flag, words] = maker.out.length
				? ['bd-down', `${countOf(maker.out.length, 'product')} out of stock`]
				: maker.low.length
					? ['bd-warn', `${countOf(maker.low.length, 'product')} running low`]
					: ['', 'Everything in stock'];
			stockNote.className = flag ? `bd-fig-note ${flag}` : 'bd-fig-note';
			stockNote.textContent = words;
		} else {
			hook('fig-stock').textContent = 'None held';
			stockNote.className = 'bd-fig-note';
			stockNote.textContent = unheldWords();
		}

		const inbound = maker.pos.filter((order) => order.state === 'shipped').sort((a, b) => (a.due < b.due ? -1 : 1));
		if (inbound.length) {
			hook('fig-next').textContent = calendarDay(inbound[0].due);
			hook('fig-next-note').textContent = `${inbound[0].id} · ${inbound[0].what}`;
			return;
		}
		hook('fig-next').textContent = 'None due';
		const latest = maker.pos[0];
		hook('fig-next-note').textContent = latest
			? `${latest.id}${latest.state === 'returned' ? ' was sent back ' : ' arrived '}${calendarDay(latest.on)}`
			: 'No orders yet';
	}

	function shareWords(rank, sellerCount) {
		if (!maker.sales) return 'Not selling yet';
		if (maker.status === 'paused') return 'Sold before the pause';
		if (rank === 1) return `The largest of ${sellerCount} brands`;
		return `${RANK_WORDS[rank] || `${rank}th`} of ${sellerCount} brands`;
	}

	function unheldWords() {
		if (maker.status === 'paused') return 'Hidden while paused';
		if (maker.status === 'onboarding') return 'Nothing in stock yet';
		return maker.products.some((item) => item.kind === 'hidden')
			? 'None in stock yet'
			: 'Digital and services only';
	}

	/* Products, best sellers first, with a bar scaled to the top seller. */
	function paintProducts() {
		const ranked = maker.products.slice().sort((a, b) => revenueOf(b) - revenueOf(a));
		const ceiling = Math.max(1, ...ranked.map(revenueOf));
		hook('products-desc').textContent = productsBlurb(ranked.length);
		hook('products').innerHTML = ranked.map((item) => productRow(item, ceiling)).join('');
	}

	function productsBlurb(total) {
		if (maker.status === 'onboarding') return `${countOf(total, 'product')} in review, not on sale yet.`;
		if (maker.status === 'paused') return `${countOf(total, 'product')}, hidden from the Store while paused.`;
		return `${countOf(total, 'product')} on sale, best sellers first.`;
	}

	function productRow(item, ceiling) {
		const takings = revenueOf(item);
		const perNote = item.per ? `<span class="bd-sub">${htmlSafe(item.per.replace(/^ \+ /, 'plus '))}</span>` : '';
		const salesCell = item.sold
			? `<span class="bd-sold"><span class="bd-sold-bar" aria-hidden="true"><span style="width:${Math.max(3, (takings / ceiling) * 100).toFixed(1)}%"></span></span><span class="bd-sold-num">${dollars(takings)}</span></span><span class="bd-sub">${soldWords(item)}</span>`
			: '<span class="bd-sub">No sales yet</span>';
		const nameCell = [
			`<span class="bd-product"><span class="bd-product-icon bd-tone-${maker.tone}" aria-hidden="true"><i class="bi ${item.icon}"></i></span>`,
			`<span class="bd-product-text"><a class="bd-product-name" href="product-details.html?sku=${encodeURIComponent(item.sku)}">${htmlSafe(item.name)}</a>`,
			`<span class="bd-sub"><span class="bd-sku">${item.sku}</span><span class="bd-fold"> · ${dollars(item.price)}${item.per ? htmlSafe(item.per) : ''}</span></span></span></span>`,
		].join('');
		return `<tr><td>${nameCell}</td><td class="bd-col-price text-end">${dollars(item.price)}${perNote}</td><td class="bd-col-sales bd-tone-${maker.tone}">${salesCell}</td><td class="bd-col-stock">${stockHtml(item)}</td></tr>`;
	}

	function soldWords(item) {
		const [one, many] = UNIT_WORDS[item.unit] || ['sold', 'sold'];
		return `${item.sold.toLocaleString('en-US')} ${item.sold === 1 ? one : many}`;
	}

	function stockHtml(item) {
		if (maker.status === 'paused')
			return '<span class="bd-state bd-state-warn">Hidden</span><span class="bd-sub">While paused</span>';
		if (KIND_STOCK[item.kind]) return KIND_STOCK[item.kind];
		if (item.stock === 0)
			return `<span class="bd-state bd-state-danger">Out of stock</span><span class="bd-sub">Back ${calendarDay(item.due)}</span>`;
		if (item.low)
			return `<span class="bd-state bd-state-warn">${item.stock} left</span><span class="bd-sub">Running low</span>`;
		return `<span class="bd-state">${item.stock} in stock</span>`;
	}

	/* Six months of sales: the last 90 days drawn solid against the 90 before. */
	function paintMonths() {
		const chartBox = hook('chart');
		if (!maker.sales && !maker.prev) {
			const firstOrder = inboundOrder();
			const promise = firstOrder
				? `Selling starts once the first stock arrives on ${calendarDay(firstOrder.due)}.`
				: 'Selling starts once the first stock arrives.';
			hook('sales-desc').textContent = `Store sales from ${maker.name}, April to September.`;
			chartBox.innerHTML = `<div class="basalt-empty bd-empty"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-bar-chart"></i></span><p class="basalt-empty-title">No sales yet</p><p class="basalt-empty-text">${promise}</p></div>`;
			return;
		}
		const figures = monthSplit();
		const peak = Math.max(...figures);
		hook('sales-desc').textContent = `Best month: ${MONTH_LABELS[figures.indexOf(peak)]}, ${dollars(peak)}.`;
		const columns = figures.map((value, index) => {
			const fillHeight = (value ? Math.max(2, (value / peak) * 100) : 0).toFixed(1);
			return `<li class="bd-bar${index >= 3 ? ' is-recent' : ''}"><span class="bd-bar-value">${compact(value)}</span><span class="bd-bar-track" aria-hidden="true"><span class="bd-bar-fill" style="height:${fillHeight}%"></span></span><span class="bd-bar-label">${MONTH_LABELS[index]}<span class="visually-hidden">: ${dollars(value)}</span></span></li>`;
		});
		chartBox.innerHTML = `<ol class="bd-bars bd-tone-${maker.tone}">${columns.join('')}</ol><ul class="bd-legend bd-tone-${maker.tone}"><li><span class="bd-legend-key is-recent" aria-hidden="true"></span>Last 90 days, ${compact(maker.sales)}</li><li><span class="bd-legend-key" aria-hidden="true"></span>The 90 days before, ${compact(maker.prev)}</li></ul>`;
	}

	function monthSplit() {
		return [
			...carveQuarter(maker.prev, maker.shape.slice(0, 3)),
			...carveQuarter(maker.sales, maker.shape.slice(3)),
		];
	}

	/** Three months from a quarter's total and two weights; the remainder is the third. */
	function carveQuarter(total, weights) {
		const opening = Math.round(total * weights[0]);
		const middle = Math.round(total * weights[1]);
		return [opening, middle, Math.max(0, total - opening - middle)];
	}

	/* Purchase orders, the open ones ahead of the settled ones. */
	function paintOrders() {
		const inbound = maker.pos.filter((order) => order.state === 'shipped');
		const settled = maker.pos.filter((order) => order.state !== 'shipped');
		const received = settled.filter((order) => order.state === 'received').length;
		const tallies = [
			[inbound.length, 'on the way'],
			[received, 'received'],
			[settled.length - received, 'sent back'],
		]
			.filter(([total]) => total)
			.map(([total, words]) => `${total} ${words}`);
		hook('po-desc').textContent = tallies.length
			? `${tallies.join(', ')} since ${calendarDay(maker.pos.at(-1).placed)}.`
			: 'No orders yet.';
		hook('pos').innerHTML = [...inbound, ...settled].map(orderRow).join('');
	}

	function orderRow(order) {
		const [label, tone] = ORDER_META[order.state];
		return `<li class="bd-po"><span class="bd-po-main"><a class="bd-po-id" href="purchase-orders.html">${order.id}</a><span class="bd-sub">${htmlSafe(order.what)}</span></span><span class="bd-po-state"><span class="basalt-status basalt-status-dot basalt-status-${tone}">${label}</span><span class="bd-sub">${ORDER_DATE[order.state](order)}</span></span><span class="bd-po-amount">${dollars(order.amount)}</span></li>`;
	}

	function factRow(label, value) {
		return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
	}

	/*
	 * The three cards edited in place. Each knows how to list its facts, load
	 * its form, verify the fields and commit them, answering with the words
	 * the feed records.
	 */
	const EDITORS = {
		buying: {
			facts() {
				const terms = maker.buying;
				return (
					factRow('Lead time', `${terms.lead} days from order`) +
					factRow('Payment', htmlSafe(terms.terms)) +
					factRow('Minimum order', terms.min ? dollars(terms.min) : 'None') +
					(terms.madeBy ? factRow('Made by', htmlSafe(terms.madeBy)) : '')
				);
			},
			load(fields) {
				fields.lead.value = maker.buying.lead;
				fields.min.value = maker.buying.min || 0;
				fields.madeBy.value = maker.buying.madeBy || '';
				const choice = TERM_CHOICES.includes(maker.buying.terms) ? maker.buying.terms : 'Net 30';
				const radio = pick(`input[name="bdTerms"][value="${choice}"]`);
				radio.checked = true;
				radio.dispatchEvent(new Event('change', { bubbles: true }));
			},
			verify(fields) {
				const lead = parseInt(fields.lead.value, 10);
				const floor = Number(fields.min.value);
				return [
					[fields.lead, !(lead >= 1 && lead <= 120)],
					[fields.min, fields.min.value === '' || !(floor >= 0)],
				];
			},
			commit(fields) {
				const terms = maker.buying;
				const lead = parseInt(fields.lead.value, 10);
				const payment = pick('input[name="bdTerms"]:checked').value;
				const floor = Math.round(Number(fields.min.value));
				const changed = [];
				if (lead !== terms.lead) changed.push(`lead time from ${terms.lead} to ${lead} days`);
				if (payment !== terms.terms)
					changed.push(`payment terms from ${htmlSafe(terms.terms)} to ${htmlSafe(payment)}`);
				if (floor !== (terms.min || 0)) changed.push(`the minimum order to ${dollars(floor)}`);
				Object.assign(terms, { lead, terms: payment, min: floor, madeBy: fields.madeBy.value.trim() });
				return changed.length ? `changed ${listWords(changed)}` : 'updated the buying terms';
			},
		},
		contact: {
			facts() {
				const person = maker.contact;
				return (
					factRow(
						'Name',
						htmlSafe(person.name) +
							(person.role ? `<span class="bd-sub">${htmlSafe(person.role)}</span>` : ''),
					) +
					(person.email
						? factRow(
								'Email',
								`<a class="bd-link bd-link-plain" href="mailto:${htmlSafe(person.email)}">${htmlSafe(person.email)}</a>`,
							)
						: '') +
					(person.phone
						? factRow(
								'Phone',
								`<a class="bd-link bd-link-plain" href="tel:${htmlSafe(person.phone.replace(/\s+/g, ''))}">${htmlSafe(person.phone)}</a>`,
							)
						: '')
				);
			},
			load(fields) {
				fields.cname.value = maker.contact.name;
				fields.role.value = maker.contact.role || '';
				fields.email.value = maker.contact.email || '';
				fields.phone.value = maker.contact.phone || '';
			},
			verify(fields) {
				const address = fields.email.value.trim();
				return [
					[fields.cname, !fields.cname.value.trim()],
					[fields.email, address !== '' && !EMAIL_SHAPE.test(address)],
				];
			},
			commit(fields) {
				const before = maker.contact.name;
				maker.contact = {
					name: fields.cname.value.trim(),
					role: fields.role.value.trim(),
					email: fields.email.value.trim(),
					phone: fields.phone.value.trim(),
				};
				return maker.contact.name === before
					? 'updated the contact details'
					: `made ${htmlSafe(maker.contact.name)} the contact`;
			},
		},
		about: {
			facts() {
				return (
					factRow('Makes', htmlSafe(maker.makes)) +
					factRow('Office', htmlSafe(`${maker.city}, ${maker.country}`)) +
					factRow('Partner since', maker.since ? String(maker.since) : 'Our own label') +
					(maker.web ? factRow('Website', htmlSafe(maker.web)) : '')
				);
			},
			load(fields) {
				fields.name.value = maker.name;
				fields.makes.value = maker.makes;
				fields.city.value = maker.city;
				fields.country.value = maker.country;
				window.Basalt.select?.refresh?.(fields.country);
				fields.web.value = maker.web || '';
				draftLogo = maker.logo || null;
				ui.logoFile.value = '';
				paintLogoPreview();
			},
			verify(fields) {
				return [[fields.name, !fields.name.value.trim()]];
			},
			commit(fields) {
				const before = maker.name;
				const logoChanged = (draftLogo || null) !== (maker.logo || null);
				maker.logo = draftLogo;
				maker.name = fields.name.value.trim();
				maker.makes = fields.makes.value.trim() || maker.makes;
				maker.city = fields.city.value.trim();
				maker.country = fields.country.value;
				maker.web = fields.web.value.trim();
				if (maker.name !== before) return `renamed ${htmlSafe(before)} to ${htmlSafe(maker.name)}`;
				if (!logoChanged) return 'updated the brand details';
				return maker.logo ? 'changed the logo' : 'removed the logo';
			},
		},
	};

	/** "a", "a and b" or "a, b and c". */
	function listWords(parts) {
		if (parts.length < 2) return parts[0];
		return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
	}

	function fieldMap(card) {
		return Object.fromEntries(
			pickAll('[data-bd-f]', card).map((entryField) => [entryField.getAttribute('data-bd-f'), entryField]),
		);
	}

	/** Marks a field wrong or right, along with its input group and its own error line. */
	function flagField(field, wrong) {
		field.classList.toggle('is-invalid', wrong);
		if (wrong) field.setAttribute('aria-invalid', 'true');
		else field.removeAttribute('aria-invalid');
		field.closest('.input-group')?.classList.toggle('is-invalid', wrong);
		const errorId = (field.getAttribute('aria-describedby') || '')
			.split(' ')
			.find((token) => token.endsWith('Error'));
		if (errorId) document.getElementById(errorId).hidden = !wrong;
	}

	function paintFacts(name) {
		pick('[data-bd-view]', sectionCard(name)).innerHTML = EDITORS[name].facts();
	}

	/* Swaps a card between its facts and its form; opening loads and focuses. */
	function toggleEditor(name, open) {
		const card = sectionCard(name);
		const sectionForm = pick('[data-bd-form]', card);
		const editButton = pick('[data-bd-edit]', card);
		if (open) {
			const controls = fieldMap(card);
			EDITORS[name].load(controls);
			for (const entryField of Object.values(controls)) flagField(entryField, false);
		}
		card.classList.toggle('is-editing', open);
		sectionForm.hidden = !open;
		pick('[data-bd-view]', card).hidden = open;
		editButton.hidden = open;
		if (!open) {
			editButton.focus({ focusVisible: false });
			return;
		}
		pick('[data-bd-f]', sectionForm).focus({ preventScroll: true });
		card.scrollIntoView({
			block: 'nearest',
			behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
		});
	}

	function wireSection(card) {
		const cardName = card.getAttribute('data-bd-section');
		const sectionForm = pick('[data-bd-form]', card);
		pick('[data-bd-edit]', card).addEventListener('click', () => toggleEditor(cardName, true));
		pick('[data-bd-cancel]', card).addEventListener('click', () => toggleEditor(cardName, false));
		sectionForm.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			toggleEditor(cardName, false);
		});
		for (const entryField of pickAll('[data-bd-f]', card)) {
			entryField.addEventListener('input', () => flagField(entryField, false));
		}
		sectionForm.addEventListener('submit', (event) => {
			event.preventDefault();
			saveSection(cardName, card);
		});
	}

	function saveSection(name, card) {
		const controls = fieldMap(card);
		const wrong = [];
		for (const [entryField, bad] of EDITORS[name].verify(controls)) {
			flagField(entryField, bad);
			if (bad) wrong.push(entryField);
		}
		if (wrong.length) {
			wrong[0].focus();
			return;
		}
		recordAction(SECTION_ICON[name], EDITORS[name].commit(controls));
		toggleEditor(name, false);
		paint();
		notify({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'Saved',
			text: `The ${SECTION_WORD[name]} for ${maker.name} are up to date.`,
		});
		sayAloud('Saved');
	}

	/* The logo is previewed while editing and kept only when the card saves. */
	function wireLogoPicker() {
		ui.nameField.addEventListener('input', paintLogoPreview);
		ui.logoFile.addEventListener('change', () => {
			const picked = ui.logoFile.files?.[0];
			if (!picked) return;
			if (picked.size > LOGO_LIMIT) {
				notify({
					tone: 'danger',
					icon: 'bi-image',
					title: 'That logo is over 1 MB',
					text: 'Pick a smaller PNG or SVG.',
				});
				ui.logoFile.value = '';
				return;
			}
			const fileReader = new FileReader();
			fileReader.onload = (event) => {
				draftLogo = event.target.result;
				paintLogoPreview();
			};
			fileReader.readAsDataURL(picked);
		});
		ui.logoClear.addEventListener('click', () => {
			draftLogo = null;
			ui.logoFile.value = '';
			paintLogoPreview();
			ui.logoFile.focus();
		});
	}

	function paintLogoPreview() {
		ui.logoPreview.className = `bd-logo bd-logo-sm bd-tone-${maker.tone}`;
		ui.logoPreview.innerHTML = markHtml(draftLogo, ui.nameField.value.trim() || maker.name);
		ui.logoClear.hidden = !draftLogo;
	}

	/* Pausing hides the products; the toast can undo it for a few seconds. */
	function switchStatus(status) {
		const pausing = status === 'paused';
		const before = { status: maker.status, pausedOn: maker.pausedOn, pauseNote: maker.pauseNote };
		maker.status = status;
		if (pausing) {
			maker.pausedOn = dayStamp;
			maker.pauseNote = 'Its products are hidden from the Store until you resume.';
		}
		const glyph = pausing ? 'bi-pause-circle' : 'bi-play-circle';
		recordAction(glyph, pausing ? 'paused selling' : 'resumed selling');
		paint();
		const headline = pausing ? `${maker.name} paused` : `${maker.name} is selling again`;
		notify({
			tone: pausing ? 'warning' : 'success',
			icon: glyph,
			title: headline,
			text: `${countOf(maker.products.length, 'product')}${pausing ? ' hidden from the Store.' : ' back on sale.'}`,
			duration: 8000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						Object.assign(maker, before);
						maker.activity.shift();
						paint();
						sayAloud(`${headline}, undone`);
					},
				},
			],
		});
		sayAloud(headline);
	}

	function wireNoteForm() {
		ui.noteField.addEventListener('input', () => flagField(ui.noteField, false));
		ui.noteForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const noteText = ui.noteField.value.trim();
			if (!noteText) {
				flagField(ui.noteField, true);
				ui.noteField.focus();
				return;
			}
			ui.noteField.value = '';
			maker.notes.unshift({ at: clockStamp(CLOCK), by: SIGNED_IN, text: noteText, fresh: true });
			recordAction('bi-sticky', 'added a note');
			paint();
			notify({
				tone: 'success',
				icon: 'bi-sticky',
				title: 'Note added',
				text: 'Everyone on the team can see it.',
			});
			sayAloud('Note added');
		});
	}

	function paintNotes() {
		hook('notes').innerHTML = maker.notes
			.map(
				(note) =>
					`<li class="bd-note${note.fresh ? ' is-fresh' : ''}"><p class="bd-note-text">${htmlSafe(note.text)}</p><p class="bd-note-meta">${htmlSafe(note.by)} · ${whenWords(note.at)}</p></li>`,
			)
			.join('');
	}

	/* The feed shows five entries until "See all" opens the rest. */
	function paintFeed() {
		const shown = feedExpanded ? maker.activity : maker.activity.slice(0, FEED_LIMIT);
		hook('activity').innerHTML = shown
			.map(
				(entry) =>
					`<li class="bd-feed-item${entry.fresh ? ' is-fresh' : ''}"><span class="bd-feed-icon" aria-hidden="true"><i class="bi ${entry.icon}"></i></span><span class="bd-feed-text"><span>${entry.text}</span><span class="bd-feed-time">${whenWords(entry.at)}</span></span></li>`,
			)
			.join('');
		ui.moreButton.hidden = maker.activity.length <= FEED_LIMIT;
		ui.moreButton.textContent = feedExpanded ? 'Show fewer' : `See all ${maker.activity.length}`;
		ui.moreButton.setAttribute('aria-expanded', String(feedExpanded));
	}

	start();
})();
