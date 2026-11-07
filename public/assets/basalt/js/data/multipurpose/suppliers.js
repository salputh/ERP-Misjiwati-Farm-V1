/**
 * Who makes Marlo's clothes: the mills and workshops behind the shop, and
 * the purchase orders placed with them. Published as
 * window.Basalt.data.suppliers for suppliers.html (the roster) and
 * supplier-details.html (one supplier), so both pages agree on every
 * supplier's terms, lead time, people and orders.
 *
 * Names, legal names, terms, lead times and unit costs match what the
 * Purchase Orders page buys with, and ORDER_BOOK mirrors its orders
 * (purchase-orders.html#1041 opens one there). Shelf prices and stock
 * levels are looked up in window.Basalt.data.catalog.
 *
 * A supplier record, field by field:
 *   status    active, onboarding (contract signed, nothing selling yet)
 *             or paused (no buying for now), with `note` giving the reason
 *   lead      typical days between sending an order and receiving it
 *   terms     invoice payment terms; `min` is the smallest order accepted
 *   ship      how goods normally travel
 *   record    [deliveries, delivered on time] across the past year,
 *             counting the received orders in ORDER_BOOK
 *   spend     dollars paid to them across the past year
 *   products  [sku, unit cost, draft?]; the draft carries name, price,
 *             icon and state for items the catalog has not listed yet
 *   contacts  [name, role, email, phone], account contact before orders desk
 *   notes     [when, who, text]
 * An order's lines are [sku, ordered, received so far]; `got` stamps the
 * latest delivery booked in.
 *
 * A real backend only has to answer with the same shape.
 */
(() => {
	'use strict';

	const CLOCK = '2026-10-09T10:40';

	/* Badge wording and color per state, keyed the way records spell the state. */
	const SUPPLIER_STATES = badges({
		active: ['Active', 'success'],
		onboarding: ['Onboarding', 'info'],
		paused: ['Paused', 'warning'],
	});

	const ORDER_STATES = badges({
		draft: ['Draft', ''],
		ordered: ['Ordered', 'info'],
		partial: ['Partly received', 'warning'],
		received: ['Received', 'success'],
		canceled: ['Canceled', 'danger'],
	});

	/* An order counts as open until every unit is in or it is called off. */
	const STILL_OPEN = new Set(['draft', 'ordered', 'partial']);

	/* Both pages list these by spend over the past year, highest first. */
	const MILLS = [
		{
			id: 'hollis',
			mono: 'HA',
			tone: 1,
			status: 'active',
			name: 'Hollis Atelier',
			legal: 'Hollis Atelier LLC',
			since: 2022,
			makes: 'Tailoring and eveningwear',
			city: 'Champaign',
			country: 'IL',
			web: 'hollisatelier.com',
			terms: 'Net 30',
			min: 10000,
			lead: 21,
			ship: 'Rail freight',
			spend: 982100,
			record: [14, 13],
			products: [
				['ML-BLAZ', 516],
				['ML-GOWN', 860],
			],
			contacts: [
				['Carly Caldwell', 'Partner manager', 'carly.caldwell@hollisatelier.com', '+1 217 555 0122'],
				['Rui Fonseca', 'Orders desk', 'orders@hollisatelier.com', '+1 217 555 0100'],
			],
			notes: [
				[
					'2026-09-30T15:10',
					'John Armstrong',
					"Carly says this year's prices hold until March. Ask about a leather coat sample in November.",
				],
				[
					'2026-09-26T18:20',
					'Dee Quigley',
					'They can fly up to 40 blazers ahead from stock when we run short. About $60 more a unit.',
				],
			],
		},
		{
			id: 'calder',
			mono: 'CC',
			tone: 2,
			status: 'active',
			name: 'Calder Couture',
			legal: 'Calder Couture Inc.',
			since: 2023,
			makes: 'Couture dresses',
			city: 'Galesburg',
			country: 'IL',
			web: 'caldercouture.com',
			terms: 'Net 30',
			min: 5000,
			lead: 10,
			ship: 'Road freight',
			spend: 1220200,
			record: [11, 10],
			products: [['ML-ORGZ', 672]],
			contacts: [
				['Gerald Burnett', 'Account manager', 'gerald.burnett@caldercouture.com', '+1 309 555 0120'],
				['Beth Sutcliffe', 'Orders desk', 'orders@caldercouture.com', '+1 309 555 0100'],
			],
			notes: [
				[
					'2026-10-02T09:40',
					'John Armstrong',
					"Canceled #1040: they couldn't make Ann Arbor by Oct 6. Order two weeks earlier next time.",
				],
				[
					'2026-09-25T16:30',
					'John Armstrong',
					'Fast and reliable. Worth asking for a better price above 500 boxes.',
				],
			],
		},
		{
			id: 'willamette',
			mono: 'WT',
			tone: 3,
			status: 'active',
			name: 'Willamette Tailors',
			legal: 'Willamette Tailors LLC',
			since: 2023,
			makes: 'Suits and leather outerwear',
			city: 'Salina',
			country: 'KS',
			web: 'willamettetailors.com',
			terms: 'Net 45',
			min: 3000,
			lead: 14,
			ship: 'Air freight',
			spend: 796900,
			record: [9, 7],
			products: [
				['ML-SUIT', 980],
				['ML-TRCH', 1280],
			],
			contacts: [
				['Robin Dickerson', 'Key accounts', 'r.dickerson@willamettetailors.com', '+1 785 555 0117'],
				['Trent Prescott', 'Orders desk', 'sales@willamettetailors.com', '+1 785 555 0100'],
			],
			notes: [
				[
					'2026-10-07T11:10',
					'Dee Quigley',
					'Air freight from Salina takes four days door to door. Use it for Bellingham top-ups.',
				],
				[
					'2026-09-21T14:00',
					'Ruud de Vries',
					'#1029 came two days late, held at the depot in Evansville. Robin has changed haulier.',
				],
			],
		},
		{
			id: 'fairhaven',
			mono: 'FO',
			tone: 5,
			status: 'active',
			name: 'Fairhaven Optical',
			legal: 'Fairhaven Optical Inc.',
			since: 2024,
			makes: 'Acetate and metal eyewear',
			city: 'Joplin',
			country: 'MO',
			web: 'fairhavenoptical.com',
			terms: 'Net 30',
			min: 2000,
			lead: 18,
			ship: 'Road freight',
			spend: 174500,
			record: [8, 6],
			products: [
				['ML-CATE', 186],
				['ML-SHLD', 208],
			],
			contacts: [
				['Melanie Elliot', 'Trade sales', 'melanie@fairhavenoptical.com', '+1 417 555 0190'],
				['Cameron Bryce', 'Orders desk', 'orders@fairhavenoptical.com', '+1 417 555 0100'],
			],
			notes: [
				[
					'2026-10-02T09:15',
					'John Armstrong',
					'Shield sunglasses sold out a week early. Order 200 next time, not 160.',
				],
			],
		},
		{
			id: 'marlo',
			mono: 'MA',
			tone: 4,
			status: 'active',
			name: 'Marlo',
			legal: 'Marlo Workroom Akron',
			since: null,
			makes: 'Own label shoes',
			city: 'Akron',
			country: 'OH',
			web: 'marlo.com',
			terms: 'Net 15',
			min: 1500,
			lead: 7,
			ship: 'Air freight',
			spend: 651000,
			record: [12, 10],
			products: [
				['ML-LOAF', 316],
				['ML-OXFD', 340],
			],
			contacts: [
				['Dawn Fischer', 'Production lead', 'dawn.fischer@marlo.com', '+1 330 555 0148'],
				['Joana Reis', 'Orders desk', 'workshop@marlo.com', '+1 330 555 0100'],
			],
			notes: [
				[
					'2026-10-01T11:05',
					'Dawn Fischer',
					'New loafer colors due in November. Keep the old stock under 600 until then.',
				],
			],
		},
		{
			id: 'hartwell',
			mono: 'HS',
			tone: 7,
			status: 'onboarding',
			note: 'Signed Sep 22. Both glove styles are being wear-tested before the first order.',
			name: 'Hartwell Stokes',
			legal: 'Hartwell Stokes Inc.',
			since: 2026,
			makes: 'Leather gloves',
			city: 'Kalamazoo',
			country: 'MI',
			web: 'hartwellstokes.com',
			terms: 'Net 30',
			min: 4000,
			lead: 21,
			ship: 'Road freight',
			spend: 0,
			record: [0, 0],
			products: [
				[
					'ML-GLV-NP',
					156,
					{ name: 'Nappa Opera Gloves', icon: 'bi-hand-index', price: 390, state: 'In wear test' },
				],
				[
					'ML-GLV-SD',
					118,
					{ name: 'Suede Driving Gloves', icon: 'bi-hand-thumbs-up', price: 290, state: 'In wear test' },
				],
			],
			contacts: [
				['Jacob Becker', 'Trade sales', 'j.becker@hartwellstokes.com', '+1 269 555 0130'],
				['Anke Vogel', 'Orders desk', 'orders@hartwellstokes.com', '+1 269 555 0100'],
			],
			notes: [
				[
					'2026-09-22T17:00',
					'John Armstrong',
					'Signed today. Wear-test both pairs on the studio team before the first order.',
				],
			],
		},
		{
			id: 'brightloom',
			mono: 'BL',
			tone: 8,
			status: 'paused',
			note: 'Paused Sep 2: a batch of silk ties failed our color test. No new orders until a test batch passes.',
			name: 'Brightloom',
			legal: 'Brightloom Textile Co.',
			since: 2024,
			makes: 'Silk ties and pocket squares',
			city: 'Greenville',
			country: 'SC',
			web: 'brightloom.com',
			terms: 'Net 30',
			min: 2500,
			lead: 28,
			ship: 'Road freight',
			spend: 94500,
			record: [6, 4],
			products: [
				[
					'ML-STIE',
					74,
					{ name: 'Silk Twill Tie', icon: 'bi-wind', price: 185, state: 'Hidden from the store' },
				],
				[
					'ML-PSQ3',
					48,
					{ name: 'Pocket Squares, 3-pack', icon: 'bi-square', price: 145, state: 'Hidden from the store' },
				],
			],
			contacts: [
				['Kevin Zane', 'Sales manager', 'kevin.zane@brightloom.com', '+1 864 555 0172'],
				['Peggy Gill', 'Orders desk', 'orders@brightloom.com', '+1 864 555 0100'],
			],
			notes: [
				[
					'2026-09-28T14:20',
					'John Armstrong',
					'Kevin is sending a new batch for testing. Expected mid-October.',
				],
			],
		},
	];

	/* Every purchase order on the books, newest first, as the Purchase Orders page lists them. */
	const ORDER_BOOK = [
		{
			id: '#1044',
			supplier: 'fairhaven',
			status: 'draft',
			site: 'Elko DC',
			by: 'John Armstrong',
			created: '2026-10-08T16:20',
			due: '2026-10-27',
			freight: 160,
			lines: [
				['ML-CATE', 60, 0],
				['ML-SHLD', 100, 0],
			],
		},
		{
			id: '#1043',
			supplier: 'willamette',
			status: 'draft',
			site: 'Bellingham DC',
			by: 'Dee Quigley',
			created: '2026-10-07T11:05',
			due: '2026-10-23',
			freight: 140,
			lines: [
				['ML-SUIT', 16, 0],
				['ML-TRCH', 10, 0],
			],
		},
		{
			id: '#1042',
			supplier: 'hollis',
			status: 'canceled',
			site: 'Bellingham DC',
			by: 'Dee Quigley',
			created: '2026-10-03T09:40',
			due: '2026-10-24',
			canceled: '2026-10-05T14:10',
			freight: 200,
			lines: [['ML-GOWN', 30, 0]],
		},
		{
			id: '#1041',
			supplier: 'hollis',
			status: 'partial',
			site: 'Ann Arbor DC',
			by: 'John Armstrong',
			created: '2026-09-25T15:30',
			sent: '2026-09-26T09:12',
			due: '2026-10-19',
			got: '2026-09-28T10:45',
			freight: 680,
			lines: [['ML-BLAZ', 120, 40]],
		},
		{
			id: '#1040',
			supplier: 'calder',
			status: 'canceled',
			site: 'Ann Arbor DC',
			by: 'John Armstrong',
			created: '2026-09-25T11:00',
			sent: '2026-09-25T11:20',
			due: '2026-10-06',
			canceled: '2026-10-02T09:30',
			freight: 180,
			lines: [['ML-ORGZ', 120, 0]],
		},
		{
			id: '#1039',
			supplier: 'fairhaven',
			status: 'ordered',
			site: 'Columbus DC',
			by: 'Dee Quigley',
			created: '2026-09-24T10:02',
			sent: '2026-09-24T10:15',
			due: '2026-10-12',
			freight: 120,
			lines: [['ML-SHLD', 160, 0]],
		},
		{
			id: '#1036',
			supplier: 'marlo',
			status: 'received',
			site: 'Elko DC',
			by: 'Dee Quigley',
			created: '2026-09-22T10:40',
			sent: '2026-09-22T10:52',
			due: '2026-09-29',
			got: '2026-09-30T09:15',
			freight: 240,
			lines: [['ML-LOAF', 300, 300]],
		},
		{
			id: '#1035',
			supplier: 'calder',
			status: 'received',
			site: 'Columbus DC',
			by: 'John Armstrong',
			created: '2026-09-20T13:02',
			sent: '2026-09-20T13:10',
			due: '2026-09-30',
			got: '2026-09-30T08:40',
			freight: 220,
			lines: [['ML-ORGZ', 200, 200]],
		},
		{
			id: '#1034',
			supplier: 'marlo',
			status: 'received',
			site: 'Columbus DC',
			by: 'John Armstrong',
			created: '2026-09-18T14:05',
			sent: '2026-09-18T14:12',
			due: '2026-09-25',
			got: '2026-09-27T13:50',
			freight: 150,
			lines: [['ML-OXFD', 150, 150]],
		},
		{
			id: '#1033',
			supplier: 'hollis',
			status: 'received',
			site: 'Columbus DC',
			by: 'John Armstrong',
			created: '2026-09-08T09:30',
			sent: '2026-09-08T09:41',
			due: '2026-09-29',
			got: '2026-09-29T11:20',
			freight: 680,
			lines: [['ML-BLAZ', 120, 120]],
		},
		{
			id: '#1031',
			supplier: 'hollis',
			status: 'received',
			site: 'Elko DC',
			by: 'Dee Quigley',
			created: '2026-09-06T14:12',
			sent: '2026-09-06T14:30',
			due: '2026-09-27',
			got: '2026-09-26T09:05',
			freight: 520,
			lines: [['ML-GOWN', 90, 90]],
		},
		{
			id: '#1029',
			supplier: 'willamette',
			status: 'received',
			site: 'Ann Arbor DC',
			by: 'John Armstrong',
			created: '2026-09-05T10:00',
			sent: '2026-09-05T10:08',
			due: '2026-09-19',
			got: '2026-09-21T13:35',
			freight: 180,
			lines: [['ML-TRCH', 64, 64]],
		},
		{
			id: '#1028',
			supplier: 'willamette',
			status: 'received',
			site: 'Columbus DC',
			by: 'John Armstrong',
			created: '2026-09-04T15:44',
			sent: '2026-09-04T15:50',
			due: '2026-09-18',
			got: '2026-09-18T10:10',
			freight: 160,
			lines: [['ML-SUIT', 60, 60]],
		},
		{
			id: '#1019',
			supplier: 'fairhaven',
			status: 'received',
			site: 'Elko DC',
			by: 'Dee Quigley',
			created: '2026-08-03T11:15',
			sent: '2026-08-03T11:22',
			due: '2026-08-21',
			got: '2026-08-21T08:30',
			freight: 140,
			lines: [['ML-CATE', 80, 80]],
		},
	];

	publish();

	/* Hands the pages a read-only view: every call returns fresh copies. */
	function publish() {
		const roster = MILLS.map(unpack);

		window.Basalt.data = window.Basalt.data || {};
		window.Basalt.data.suppliers = {
			NOW: CLOCK,
			STATUS: SUPPLIER_STATES,
			PO_STATUS: ORDER_STATES,
			all() {
				return roster.map(profile);
			},
			find(id) {
				const wanted = roster.find((mill) => mill.id === id);
				return wanted ? profile(wanted) : null;
			},
		};
	}

	/** Expands { state: [label, tone] } into the { label, tone } pairs the badges read. */
	function badges(table) {
		return Object.fromEntries(Object.entries(table).map(([state, [label, tone]]) => [state, { label, tone }]));
	}

	/* Turns the compact contact and note tuples into the objects the pages read. */
	function unpack(mill) {
		return {
			...mill,
			contacts: mill.contacts.map(([name, role, email, phone]) => ({ name, role, email, phone })),
			notes: mill.notes.map(([at, by, text]) => ({ at, by, text })),
		};
	}

	/**
	 * Builds the full picture of one supplier: catalog details on each product,
	 * its orders with totals worked out, the subset still open, and the share
	 * of deliveries that arrived on time (null before the first delivery).
	 */
	function profile(mill) {
		const portrait = structuredClone(mill);
		const catalog = window.Basalt.data.catalog;
		portrait.products = mill.products.map(([sku, cost, draft]) => stockLine(catalog, sku, cost, draft));

		const bySku = new Map(portrait.products.map((item) => [item.sku, item]));
		portrait.orders = ORDER_BOOK.filter((order) => order.supplier === mill.id).map((order) =>
			costOrder(order, bySku),
		);
		portrait.open = portrait.orders.filter((order) => order.open);

		const [deliveries, punctual] = portrait.record;
		portrait.onTime = deliveries ? Math.round((punctual / deliveries) * 100) : null;
		return portrait;
	}

	/** One product as a supplier sells it, priced and stocked from the catalog when listed there. */
	function stockLine(catalog, sku, cost, draft) {
		const listed = catalog?.find(sku);
		if (!listed) return { sku, cost, onHand: null, ...draft };

		const { name, price, icon, totals } = listed;
		return { sku, cost, name, price, icon, onHand: totals ? totals.onHand : null, state: '' };
	}

	/**
	 * Copies an order and adds its unit counts, landed total (goods at unit
	 * cost plus freight), readable line items and whether it is still open.
	 */
	function costOrder(order, bySku) {
		const sheet = structuredClone(order);
		let unitCount = 0;
		let arrived = 0;
		let goods = 0;
		for (const [sku, qty, got] of order.lines) {
			unitCount += qty;
			arrived += got;
			goods += qty * (bySku.get(sku)?.cost ?? 0);
		}

		sheet.units = unitCount;
		sheet.received = arrived;
		sheet.total = goods + order.freight;
		sheet.items = order.lines.map(([sku, qty, got]) => ({ sku, qty, got, name: bySku.get(sku)?.name || sku }));
		sheet.open = STILL_OPEN.has(order.status);
		return sheet;
	}
})();
