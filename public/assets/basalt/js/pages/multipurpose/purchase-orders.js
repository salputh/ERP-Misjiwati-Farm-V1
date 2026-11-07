/**
 * Purchasing for the Marlo shop, used by purchase-orders.html only. The
 * address decides what is on screen: the order book with no hash, a single
 * order at #1041, and the order form at #new, #edit-1044 or
 * #again-1033. The receiving drawer and the cancel dialog live here too,
 * and every figure on the page is worked out from the records below.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-po-root]');
	if (!pageRoot) return;

	/* The demo is pinned to one day and one buyer. A live install would use
     the real date, whoever is signed in, and its own purchasing records. */
	const demoToday = '2026-10-09';
	const buyerName = 'John Armstrong';

	/* Distribution centers that take deliveries. `tone` picks the chart color
     slot used on Stock Levels, and `lead` names the person who books stock in. */
	const depots = [
		{
			id: 'reno',
			name: 'Elko DC',
			tone: 1,
			lead: 'Earl Buchanan',
			street: '1450 Gateway Drive',
			town: 'Elko, NV 89521',
			country: 'United States',
			hours: 'Mon to Fri, 7:00 am to 3:00 pm',
		},
		{
			id: 'columbus',
			name: 'Columbus DC',
			tone: 3,
			lead: 'Tasha Greene',
			street: '2200 Rickenbacker Parkway',
			town: 'Columbus, OH 43217',
			country: 'United States',
			hours: 'Mon to Fri, 6:00 am to 2:00 pm',
		},
		{
			id: 'annarbor',
			name: 'Ann Arbor DC',
			tone: 8,
			lead: 'Ruud de Vries',
			street: '22 Chestnut St',
			town: 'Ann Arbor, MI 48104',
			country: 'United States',
			hours: 'Mon to Fri, 8:00 am to 4:30 pm',
		},
		{
			id: 'medford',
			name: 'Bellingham DC',
			tone: 7,
			lead: 'Allison Nance',
			street: '18 Spruce St',
			town: 'Bellingham, WA 98225',
			country: 'United States',
			hours: 'Mon to Fri, 7:30 am to 3:30 pm',
		},
	];

	/* Mills and workshops the shop buys from. Here `lead` is how many days a
     delivery usually takes once the order is sent, and `ship` the usual mode. */
	const vendors = [
		{
			id: 'hollis',
			name: 'Hollis Atelier',
			mono: 'HA',
			tone: 1,
			legal: 'Hollis Atelier LLC',
			city: 'Champaign, IL',
			contact: 'Carly Caldwell',
			email: 'orders@hollisatelier.com',
			phone: '+1 217 555 0122',
			terms: 'Net 30',
			lead: 21,
			ship: 'Rail freight',
		},
		{
			id: 'calder',
			name: 'Calder Couture',
			mono: 'CC',
			tone: 2,
			legal: 'Calder Couture Inc.',
			city: 'Galesburg, IL',
			contact: 'Gerald Burnett',
			email: 'orders@caldercouture.com',
			phone: '+1 309 555 0120',
			terms: 'Net 30',
			lead: 10,
			ship: 'Road freight',
		},
		{
			id: 'willamette',
			name: 'Willamette Tailors',
			mono: 'WT',
			tone: 3,
			legal: 'Willamette Tailors LLC',
			city: 'Salina, KS',
			contact: 'Robin Dickerson',
			email: 'sales@willamettetailors.com',
			phone: '+1 785 555 0117',
			terms: 'Net 45',
			lead: 14,
			ship: 'Air freight',
		},
		{
			id: 'fairhaven',
			name: 'Fairhaven Optical',
			mono: 'FO',
			tone: 5,
			legal: 'Fairhaven Optical Inc.',
			city: 'Joplin, MO',
			contact: 'Melanie Elliot',
			email: 'orders@fairhavenoptical.com',
			phone: '+1 417 555 0190',
			terms: 'Net 30',
			lead: 18,
			ship: 'Road freight',
		},
		{
			id: 'marlo',
			name: 'Marlo',
			mono: 'MA',
			tone: 4,
			legal: 'Marlo Workroom Akron',
			city: 'Akron, OH',
			contact: 'Dawn Fischer',
			email: 'workshop@marlo.com',
			phone: '+1 330 555 0148',
			terms: 'Net 15',
			lead: 7,
			ship: 'Air freight',
		},
	];

	/* What can be ordered, at each supplier's unit cost. `free` holds, per
     location, the units free to sell and the reorder point, as on Stock Levels. */
	const catalog = [
		{
			sku: 'ML-BLAZ',
			name: 'Sculpted Shoulder Blazer',
			icon: 'briefcase',
			tone: 1,
			supplier: 'hollis',
			cost: 516,
			free: { reno: [54, 20], columbus: [44, 20], annarbor: [40, 15], medford: [20, 10] },
		},
		{
			sku: 'ML-GOWN',
			name: 'Draped Column Gown',
			icon: 'stars',
			tone: 1,
			supplier: 'hollis',
			cost: 860,
			free: { reno: [81, 25], columbus: [65, 25], annarbor: [46, 15], medford: [26, 10] },
		},
		{
			sku: 'ML-ORGZ',
			name: 'Tiered Organza Dress',
			icon: 'flower1',
			tone: 2,
			supplier: 'calder',
			cost: 672,
			free: { reno: [136, 50], columbus: [152, 50], annarbor: [58, 25], medford: [26, 20] },
		},
		{
			sku: 'ML-SUIT',
			name: 'Chalk-Stripe Suit',
			icon: 'person-standing',
			tone: 3,
			supplier: 'willamette',
			cost: 980,
			free: { reno: [29, 12], columbus: [26, 12], annarbor: [21, 10], medford: [6, 8] },
		},
		{
			sku: 'ML-TRCH',
			name: 'Leather Trench Coat',
			icon: 'cloud-drizzle',
			tone: 3,
			supplier: 'willamette',
			cost: 1280,
			free: { reno: [37, 12], columbus: [34, 12], annarbor: [33, 12], medford: [13, 6] },
		},
		{
			sku: 'ML-LOAF',
			name: 'Bar Loafers',
			icon: 'gem',
			tone: 4,
			supplier: 'marlo',
			cost: 316,
			free: { reno: [168, 50], columbus: [150, 50], annarbor: [106, 30], medford: [54, 20] },
		},
		{
			sku: 'ML-OXFD',
			name: 'Two-Tone Oxfords',
			icon: 'award',
			tone: 5,
			supplier: 'marlo',
			cost: 340,
			free: { reno: [98, 30], columbus: [85, 30], annarbor: [64, 20], medford: [28, 15] },
		},
		{
			sku: 'ML-CATE',
			name: 'Cat-Eye Sunglasses',
			icon: 'sunglasses',
			tone: 6,
			supplier: 'fairhaven',
			cost: 186,
			free: { reno: [7, 12], columbus: [5, 10], annarbor: [2, 10], medford: [0, 8] },
		},
		{
			sku: 'ML-SHLD',
			name: 'Shield Sunglasses',
			icon: 'eyeglasses',
			tone: 6,
			supplier: 'fairhaven',
			cost: 208,
			free: { reno: [0, 25], columbus: [0, 25], annarbor: [0, 20], medford: [0, 10] },
		},
	];

	/* The pill each status wears, with its wording. */
	const statusPills = {
		draft: { tone: '', label: 'Draft' },
		ordered: { tone: 'info', label: 'Ordered' },
		partial: { tone: 'warning', label: 'Partly received' },
		received: { tone: 'success', label: 'Received' },
		canceled: { tone: 'danger', label: 'Canceled' },
	};

	/* The order book. Each entry in `lines` reads [sku, ordered, received so
     far]; `ship` and `ref` appear once the supplier has dispatched, `receipts`
     are deliveries already booked in, and `events` are extra activity notes. */
	const purchaseOrders = [
		{
			id: '#1044',
			status: 'draft',
			supplier: 'fairhaven',
			site: 'reno',
			by: 'John Armstrong',
			created: '2026-10-08T16:20',
			due: '2026-10-27',
			freight: 160,
			lines: [
				['ML-CATE', 60, 0],
				['ML-SHLD', 100, 0],
			],
			note: 'Please pack both styles of sunglasses in one carton.',
		},
		{
			id: '#1043',
			status: 'draft',
			supplier: 'willamette',
			site: 'medford',
			by: 'Dee Quigley',
			created: '2026-10-07T11:05',
			due: '2026-10-23',
			freight: 140,
			lines: [
				['ML-SUIT', 16, 0],
				['ML-TRCH', 10, 0],
			],
			note: 'Air freight please, Bellingham is short of suits.',
		},
		{
			id: '#1042',
			status: 'canceled',
			supplier: 'hollis',
			site: 'medford',
			by: 'Dee Quigley',
			created: '2026-10-03T09:40',
			due: '2026-10-24',
			freight: 200,
			lines: [['ML-GOWN', 30, 0]],
			canceled: { reason: 'Covered by a stock transfer', at: '2026-10-05T14:10', by: 'John Armstrong' },
			note: '',
		},
		{
			id: '#1041',
			status: 'partial',
			supplier: 'hollis',
			site: 'annarbor',
			by: 'John Armstrong',
			created: '2026-09-25T15:30',
			sent: '2026-09-26T09:12',
			due: '2026-10-19',
			freight: 680,
			ship: 'Rail freight',
			ref: 'LHT-48812',
			lines: [['ML-BLAZ', 120, 40]],
			receipts: [{ at: '2026-09-28T10:45', qty: 40, by: 'Ruud de Vries', note: 'Flown ahead from stock' }],
			events: [
				{
					at: '2026-09-26T18:02',
					icon: 'chat-left-text',
					text: '<strong>Hollis Atelier</strong> confirmed: 40 by air now, 80 by rail',
				},
			],
			note: 'Fly 40 ahead from stock if you can, the rest by rail.',
		},
		{
			id: '#1040',
			status: 'canceled',
			supplier: 'calder',
			site: 'annarbor',
			by: 'John Armstrong',
			created: '2026-09-25T11:00',
			sent: '2026-09-25T11:20',
			due: '2026-10-06',
			freight: 180,
			lines: [['ML-ORGZ', 120, 0]],
			canceled: { reason: "Supplier can't deliver in time", at: '2026-10-02T09:30', by: 'John Armstrong' },
			note: '',
		},
		{
			id: '#1039',
			status: 'ordered',
			supplier: 'fairhaven',
			site: 'columbus',
			by: 'Dee Quigley',
			created: '2026-09-24T10:02',
			sent: '2026-09-24T10:15',
			due: '2026-10-12',
			freight: 120,
			ship: 'Road freight',
			ref: 'FK-77310',
			lines: [['ML-SHLD', 160, 0]],
			note: 'Deliver to dock 3 before noon.',
		},
		{
			id: '#1036',
			status: 'received',
			supplier: 'marlo',
			site: 'reno',
			by: 'Dee Quigley',
			created: '2026-09-22T10:40',
			sent: '2026-09-22T10:52',
			due: '2026-09-29',
			freight: 240,
			ship: 'Air freight',
			ref: 'MAP-3318',
			lines: [['ML-LOAF', 300, 300]],
			receipts: [{ at: '2026-09-30T09:15', qty: 300, by: 'Earl Buchanan' }],
			note: '',
		},
		{
			id: '#1035',
			status: 'received',
			supplier: 'calder',
			site: 'columbus',
			by: 'John Armstrong',
			created: '2026-09-20T13:02',
			sent: '2026-09-20T13:10',
			due: '2026-09-30',
			freight: 220,
			ship: 'Road freight',
			ref: 'CML-20931',
			lines: [['ML-ORGZ', 200, 200]],
			receipts: [{ at: '2026-09-30T08:40', qty: 200, by: 'Tasha Greene' }],
			note: '',
		},
		{
			id: '#1034',
			status: 'received',
			supplier: 'marlo',
			site: 'columbus',
			by: 'John Armstrong',
			created: '2026-09-18T14:05',
			sent: '2026-09-18T14:12',
			due: '2026-09-25',
			freight: 150,
			ship: 'Air freight',
			ref: 'MAP-3297',
			lines: [['ML-OXFD', 150, 150]],
			receipts: [{ at: '2026-09-27T13:50', qty: 150, by: 'Tasha Greene' }],
			note: '',
		},
		{
			id: '#1033',
			status: 'received',
			supplier: 'hollis',
			site: 'columbus',
			by: 'John Armstrong',
			created: '2026-09-08T09:30',
			sent: '2026-09-08T09:41',
			due: '2026-09-29',
			freight: 680,
			ship: 'Rail freight',
			ref: 'LHT-48517',
			lines: [['ML-BLAZ', 120, 120]],
			receipts: [{ at: '2026-09-29T11:20', qty: 120, by: 'Tasha Greene' }],
			note: '',
		},
		{
			id: '#1031',
			status: 'received',
			supplier: 'hollis',
			site: 'reno',
			by: 'Dee Quigley',
			created: '2026-09-06T14:12',
			sent: '2026-09-06T14:30',
			due: '2026-09-27',
			freight: 520,
			ship: 'Rail freight',
			ref: 'LHT-48466',
			lines: [['ML-GOWN', 90, 90]],
			receipts: [{ at: '2026-09-26T09:05', qty: 90, by: 'Earl Buchanan' }],
			note: '',
		},
		{
			id: '#1029',
			status: 'received',
			supplier: 'willamette',
			site: 'annarbor',
			by: 'John Armstrong',
			created: '2026-09-05T10:00',
			sent: '2026-09-05T10:08',
			due: '2026-09-19',
			freight: 180,
			ship: 'Road freight',
			ref: 'VL-6610',
			lines: [['ML-TRCH', 64, 64]],
			receipts: [{ at: '2026-09-21T13:35', qty: 64, by: 'Ruud de Vries' }],
			note: '',
		},
		{
			id: '#1028',
			status: 'received',
			supplier: 'willamette',
			site: 'columbus',
			by: 'John Armstrong',
			created: '2026-09-04T15:44',
			sent: '2026-09-04T15:50',
			due: '2026-09-18',
			freight: 160,
			ship: 'Air freight',
			ref: 'VL-6597',
			lines: [['ML-SUIT', 60, 60]],
			receipts: [{ at: '2026-09-18T10:10', qty: 60, by: 'Tasha Greene' }],
			note: '',
		},
		{
			id: '#1019',
			status: 'received',
			supplier: 'fairhaven',
			site: 'reno',
			by: 'Dee Quigley',
			created: '2026-08-03T11:15',
			sent: '2026-08-03T11:22',
			due: '2026-08-21',
			freight: 140,
			ship: 'Road freight',
			ref: 'FK-76902',
			lines: [['ML-CATE', 80, 80]],
			receipts: [{ at: '2026-08-21T08:30', qty: 80, by: 'Earl Buchanan' }],
			note: '',
		},
	];

	const vendorIndex = new Map(vendors.map((vendor) => [vendor.id, vendor]));
	const depotIndex = new Map(depots.map((depot) => [depot.id, depot]));
	const catalogIndex = new Map(catalog.map((product) => [product.sku, product]));
	const openStatuses = new Set(['draft', 'ordered', 'partial']);
	const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const weekdayAbbr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const htmlEntities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	/* Table sorting: how each sortable column compares two orders, and the
     arrow its header shows for each aria-sort state. */
	const rowComparers = {
		total: (a, b) => orderTotal(a) - orderTotal(b),
		when: (a, b) => deliverySortDate(a).localeCompare(deliverySortDate(b)),
		id: (a, b) => a.id.localeCompare(b.id),
	};
	const sortArrows = { ascending: 'arrow-up', descending: 'arrow-down', none: 'arrow-down-up' };

	/* What the order page's buttons and menu items do, keyed by data-po-act. */
	const orderActions = {
		receive(order) {
			openReceiving(order);
		},
		send(order) {
			dispatchOrder(order);
		},
		again(order) {
			location.hash = `again-${addressOf(order.id)}`;
		},
		cancel(order) {
			openCanceling(order);
		},
		copy(order) {
			if (!window.Basalt.copyText) return;
			window.Basalt.copyText(order.id);
			notify({ tone: 'success', title: 'Copied', text: `${order.id} is on your clipboard.` });
		},
	};

	/* Spoken after each delivery step's label, since its marker is hidden. */
	const stepSpoken = { 'is-done': ', done', 'is-next': ', next', 'is-stopped': ', stopped' };

	const views = {
		list: pick('[data-po-view="list"]', pageRoot),
		order: pick('[data-po-view="order"]', pageRoot),
		edit: pick('[data-po-view="edit"]', pageRoot),
	};
	const orderBook = {
		incoming: pick('[data-po-coming]', pageRoot),
		rows: pick('[data-po-rows]', pageRoot),
		search: pick('[data-po-search]', pageRoot),
		vendorFilter: pick('[data-po-supplier]', pageRoot),
		siteFilter: pick('[data-po-site]', pageRoot),
		panel: pick('#po-list-panel', pageRoot),
	};
	const orderForm = views.edit;
	const vendorPicker = formField('supplier');
	const sitePicker = formField('sites');
	const dueInput = formField('due');
	const receiveDrawer = pick('#po-receive');
	const receiveForm = pick('[data-po-receive-form]');
	const cancelDialog = pick('#po-cancel');
	const cancelForm = pick('[data-po-cancel-form]');

	const listState = { status: 'open', sortKey: 'id', sortDir: -1 };
	let openOrder = null;
	let draftInForm = null;
	let orderBeingReceived = null;
	let orderBeingCanceled = null;
	let activeView = '';
	let listScrollTop = 0;
	let stepsGrown = false;

	function start() {
		fillPickers();
		wireOrderBook();
		wireOrderPage();
		wireOrderForm();
		wireReceiving();
		wireCanceling();
		window.addEventListener('hashchange', showFromAddress);
		redrawOrderBook();
		showFromAddress();
	}

	/* The supplier and location pickers on the list and in the form all come
     from the records, so they are filled in before anything draws. */
	function fillPickers() {
		const vendorOptions = vendors
			.map((vendor) => `<option value="${vendor.id}">${htmlSafe(vendor.name)}</option>`)
			.join('');
		orderBook.vendorFilter.insertAdjacentHTML('beforeend', vendorOptions);
		orderBook.siteFilter.insertAdjacentHTML(
			'beforeend',
			depots.map((depot) => `<option value="${depot.id}">${htmlSafe(depot.name)}</option>`).join(''),
		);
		vendorPicker.insertAdjacentHTML('beforeend', vendorOptions);
		sitePicker.insertAdjacentHTML(
			'beforeend',
			depots
				.map(
					(depot) =>
						`<label class="basalt-choice"><input type="radio" name="site" value="${depot.id}">${htmlSafe(depot.name)}</label>`,
				)
				.join(''),
		);
	}

	/* Picks the view the hash asks for, remembers where the list was scrolled
     on the way out, and on a real change of view moves focus to its title. */
	function showFromAddress() {
		const nextView = viewForAddress(decodeURIComponent(location.hash.replace(/^#/, '')));
		if (activeView === 'list' && nextView !== 'list') listScrollTop = window.scrollY;
		for (const [name, element] of Object.entries(views)) element.hidden = name !== nextView;
		if (nextView === 'list') document.title = 'Purchase Orders · Basalt';

		const firstVisit = !activeView;
		const changed = activeView !== nextView || nextView !== 'list';
		activeView = nextView;
		if (firstVisit || !changed) return;
		window.scrollTo(0, nextView === 'list' ? listScrollTop : 0);
		pick(`[data-po-view="${nextView}"] h1`, pageRoot)?.focus({ preventScroll: true });
	}

	/** Draws whatever the address points at and returns that view's name. */
	/** An order's place in the address: its number without the #, which the
      address already uses to start the fragment. */
	function addressOf(id) {
		return id.replace(/^#/, '');
	}

	function viewForAddress(address) {
		if (address === 'new') {
			loadOrderForm('new', null);
			return 'edit';
		}
		const [, mode, sourceNumber] = /^(edit|again)-(\d+)$/.exec(address) || [];
		const fromOrder = sourceNumber ? findOrder(`#${sourceNumber}`) : undefined;
		if (mode === 'edit' && fromOrder && fromOrder.status === 'draft') {
			loadOrderForm('edit', fromOrder);
			return 'edit';
		}
		if (mode === 'again' && fromOrder) {
			loadOrderForm('again', fromOrder);
			return 'edit';
		}
		const jumpTo = /^\d+$/.test(address) ? findOrder(`#${address}`) : undefined;
		if (!jumpTo) return 'list';
		renderOrder(jumpTo);
		return 'order';
	}

	function wireOrderBook() {
		/* The shared tabs component handles the underline and arrow keys; this
       page only needs to know which status was picked. */
		pick('[role="tablist"]', pageRoot).addEventListener('shown.bs.tab', (event) => {
			orderBook.panel.setAttribute('aria-labelledby', event.target.id);
			listState.status = event.target.getAttribute('data-po-tab');
			renderOrderRows();
		});
		orderBook.search.addEventListener('input', () => renderOrderRows());
		for (const selectBox of [orderBook.vendorFilter, orderBook.siteFilter]) {
			selectBox.addEventListener('change', () => renderOrderRows());
		}
		for (const sortButton of pickAll('[data-po-sort]', pageRoot)) {
			sortButton.addEventListener('click', () => changeSort(sortButton.getAttribute('data-po-sort')));
		}
		orderBook.rows.addEventListener('click', openClickedRow);
		pick('[data-po-export]', pageRoot).addEventListener('click', () => {
			notify({
				tone: 'success',
				title: 'Orders exported',
				text: `purchase-orders-${demoToday}.csv, ${plural(purchaseOrders.length, 'order', 'orders')}.`,
			});
		});
	}

	function redrawOrderBook() {
		renderIncoming();
		renderSpend();
		renderOrderRows();
	}

	/** The same column flips direction; a new one starts soonest-first for dates, largest-first otherwise. */
	function changeSort(key) {
		listState.sortDir = listState.sortKey === key ? -listState.sortDir : key === 'when' ? 1 : -1;
		listState.sortKey = key;
		renderOrderRows();
	}

	/* A row opens its order when the click lands outside its links and buttons. */
	function openClickedRow(event) {
		if (event.target.closest('a, button')) return;
		const row = event.target.closest('tr[data-po-id]');
		if (row) location.hash = addressOf(row.getAttribute('data-po-id'));
	}

	/* Deliveries under way, oldest due first, then drafts nobody has sent. */
	function renderIncoming() {
		const inbound = purchaseOrders.filter(inTransit).sort((a, b) => a.due.localeCompare(b.due));
		const unsent = purchaseOrders
			.filter((entry) => entry.status === 'draft')
			.sort((a, b) => b.created.localeCompare(a.created));
		const cardBlocks = [
			['On the way', inbound, transitRow],
			['Ready to send', unsent, unsentRow],
		]
			.filter(([, members]) => members.length)
			.map(
				([heading, members, toRow]) =>
					`<h3 class="po-group">${heading}</h3><ul class="po-trips">${members.map((entry) => toRow(entry)).join('')}</ul>`,
			);
		orderBook.incoming.innerHTML =
			cardBlocks.join('') ||
			Basalt.emptyState({
				title: 'Nothing on the way',
				icon: 'truck',
				text: 'Orders you send to suppliers show here until they arrive.',
			});

		const summary = [];
		if (inbound.length) summary.push(`${plural(inbound.length, 'delivery', 'deliveries')} on the way`);
		if (unsent.length) summary.push(`${plural(unsent.length, 'draft', 'drafts')} waiting to be sent`);
		pick('[data-po-coming-sub]', pageRoot).textContent = summary.length
			? `${summary.join(', ')}.`
			: 'No deliveries due and no drafts.';
	}

	/* One delivery on its way: a track from the day it left to the day it is
     due, with the van drawn at today's point along it. */
	function transitRow(order) {
		const vendor = vendorIndex.get(order.supplier);
		const journeyDays = Math.max(1, dayGap(order.sent, order.due));
		const traveled = Math.max(4, Math.min(100, Math.round((dayGap(order.sent, demoToday) / journeyDays) * 100)));
		const leftToCome = orderedUnits(order) - receivedUnits(order);
		const cargo =
			order.lines.length === 1
				? `${formatNumber(leftToCome)} × ${catalogIndex.get(order.lines[0][0]).name}`
				: `${plural(leftToCome, 'unit', 'units')} of ${plural(order.lines.length, 'product', 'products')}`;
		const late = dayGap(demoToday, order.due) < 0;
		return tidyMarkup`
      <li class="po-trip${late ? ' is-late' : ''}" style="--po-tone: ${seriesColor(vendor.tone)}">${vendorBadge(vendor)}
        <div class="po-trip-main"><a class="po-trip-what" href="#${order.id}">${htmlSafe(cargo)}</a>
          <p class="po-trip-sub">${order.id}, ${htmlSafe(vendor.name)} to ${htmlSafe(depotIndex.get(order.site).name)}</p>
          <div class="po-trip-track" role="img" aria-label="Sent ${shortDay(order.sent)}, due ${shortDay(order.due)}">
            <span class="po-trip-fill" style="--po-pct: ${traveled}%"></span>
            <span class="po-trip-van" style="--po-pct: ${traveled}%"><i class="bi bi-truck" aria-hidden="true"></i></span>
          </div>
        </div>
        <p class="po-trip-when"><strong>${dueWording(order.due)}</strong><span>${weekdayAndDay(order.due)}</span></p>
        ${receiveButton(order.id)}
      </li>`;
	}

	function unsentRow(order) {
		const vendor = vendorIndex.get(order.supplier);
		return tidyMarkup`
      <li class="po-draft">${vendorBadge(vendor)}
        <div class="po-trip-main"><a class="po-trip-what" href="#${order.id}">${htmlSafe(vendor.name)} to ${htmlSafe(depotIndex.get(order.site).name)}</a>
          <p class="po-trip-sub">${order.id}, ${htmlSafe(contentsSummary(order))}, ${dollars(orderTotal(order))}</p>
        </div>
        <p class="po-trip-when"><strong>Started ${shortDay(order.created)}</strong><span>by ${htmlSafe(order.by)}</span></p>
        <a class="btn btn-outline-secondary btn-sm" href="#${order.id}">Review</a>
      </li>`;
	}

	/* Ninety days of sent orders per supplier, largest first, canceled ones
     left out, each bar measured against the biggest. */
	function renderSpend() {
		const cutoff = shiftDate(demoToday, -90);
		const ranking = [];
		for (const vendor of vendors) {
			const counted = purchaseOrders.filter(
				(entry) =>
					entry.supplier === vendor.id &&
					entry.sent &&
					entry.status !== 'canceled' &&
					entry.sent.slice(0, 10) >= cutoff,
			);
			if (counted.length) ranking.push({ vendor, orderCount: counted.length, spent: sumOf(counted, orderTotal) });
		}
		ranking.sort((a, b) => b.spent - a.spent);
		const largest = ranking.length ? ranking[0].spent : 1;
		pick('[data-po-spend-sub]', pageRoot).textContent =
			`Orders sent in the last 90 days, ${dollars(sumOf(ranking, (entry) => entry.spent))} in all.`;
		pick('[data-po-spend]', pageRoot).innerHTML = ranking
			.map(
				({ vendor, orderCount, spent }) => tidyMarkup`
      <li class="po-spend-row" style="--po-tone: ${seriesColor(vendor.tone)}">${vendorBadge(vendor)}
        <span class="po-spend-who"><span class="po-spend-name">${htmlSafe(vendor.name)}</span>
          <span class="po-spend-count">${plural(orderCount, 'order', 'orders')}, usually ${vendor.lead} days</span>
        </span>
        <span class="po-spend-bar" aria-hidden="true"><span style="--po-pct: ${Math.max(2, Math.round((spent / largest) * 100))}%"></span></span>
        <span class="po-spend-value">${dollars(spent)}</span>
      </li>`,
			)
			.join('');
	}

	/* The table: tab counts first, then the rows that pass the tab, both
     filters and the search, in the chosen order, then the header arrows. */
	function renderOrderRows() {
		const searchQuery = orderBook.search.value.trim();
		const vendorId = orderBook.vendorFilter.value;
		const siteId = orderBook.siteFilter.value;
		const { status, sortKey: orderKey, sortDir } = listState;

		for (const tab of ['open', 'received', 'canceled', 'all']) {
			pick(`[data-po-tab-count="${tab}"]`, pageRoot).textContent = purchaseOrders.filter((entry) =>
				belongsToTab(entry, tab),
			).length;
		}

		const shownOrders = purchaseOrders.filter(
			(entry) =>
				belongsToTab(entry, status) &&
				(vendorId === 'all' || entry.supplier === vendorId) &&
				(siteId === 'all' || entry.site === siteId) &&
				(!searchQuery || Basalt.matchesQuery(searchText(entry), searchQuery)),
		);
		const comparer = rowComparers[orderKey] || rowComparers.id;
		shownOrders.sort((a, b) => comparer(a, b) * sortDir || b.id.localeCompare(a.id));

		orderBook.rows.innerHTML = shownOrders.length
			? shownOrders.map(orderRow).join('')
			: emptyRow(searchQuery, vendorId !== 'all' || siteId !== 'all');
		pick('[data-po-count]', pageRoot).textContent = plural(shownOrders.length, 'order', 'orders');

		const direction = sortDir > 0 ? 'ascending' : 'descending';
		for (const columnHead of pickAll('th[aria-sort]', pageRoot)) {
			const ariaState =
				pick('[data-po-sort]', columnHead).getAttribute('data-po-sort') === orderKey ? direction : 'none';
			columnHead.setAttribute('aria-sort', ariaState);
			pick('.bi', columnHead).className = `bi bi-${sortArrows[ariaState]}`;
		}
	}

	function belongsToTab(order, tab) {
		if (tab === 'all') return true;
		return tab === 'open' ? openStatuses.has(order.status) : order.status === tab;
	}

	function searchText(order) {
		const haystack = [
			order.id,
			vendorIndex.get(order.supplier).name,
			depotIndex.get(order.site).name,
			statusPills[order.status].label,
		];
		for (const [sku] of order.lines) haystack.push(`${catalogIndex.get(sku).name} ${sku}`);
		return haystack.join(' ');
	}

	/** The date the Delivery column sorts on: when it arrived, when it was called off, or when it is due. */
	function deliverySortDate(order) {
		if (order.status === 'received') return finalReceiptAt(order);
		return order.status === 'canceled' ? order.canceled.at : order.due;
	}

	function emptyRow(searchQuery, narrowed) {
		const placeholder = searchQuery
			? Basalt.emptyState({
					noun: 'orders',
					query: searchQuery,
					text: narrowed ? 'Check the spelling, or show every supplier and location.' : '',
				})
			: Basalt.emptyState({
					title: 'No orders here',
					icon: 'inboxes',
					text: narrowed
						? 'Nothing matches this supplier and location. Try showing all of them.'
						: 'Orders show here once they reach this status.',
				});
		return `<tr class="basalt-empty-row"><td colspan="7">${placeholder}</td></tr>`;
	}

	function orderRow(order) {
		const vendor = vendorIndex.get(order.supplier);
		const opened = order.sent ? `Sent ${shortDay(order.sent)}` : `Started ${shortDay(order.created)}`;
		const partialNote =
			order.status === 'partial'
				? `<span class="po-sub">${formatNumber(receivedUnits(order))} of ${formatNumber(orderedUnits(order))} in</span>`
				: '';
		return tidyMarkup`
      <tr data-po-id="${order.id}">
        <td class="po-col-id"><a class="po-id" href="#${order.id}">${order.id}</a><span class="po-sub">${opened}</span></td>
        <td class="po-col-supplier"><span class="po-who">${vendorBadge(vendor)}<span class="po-who-text">
          <span class="po-main">${htmlSafe(vendor.name)}</span><span class="po-sub">to ${htmlSafe(depotIndex.get(order.site).name)}</span>
        </span></span></td>
        <td class="po-col-items"><span class="po-main po-main-plain">${htmlSafe(contentsSummary(order))}</span></td>
        <td class="po-col-when">${deliveryCell(order)}</td>
        <td class="po-col-status">${statusTag(order)}${partialNote}</td>
        <td class="po-col-total"><span class="po-money">${dollars(orderTotal(order))}</span><span class="po-sub">${plural(orderedUnits(order), 'unit', 'units')}</span></td>
        <td class="po-col-act"><div class="po-act">${rowAction(order)}</div></td>
      </tr>`;
	}

	function deliveryCell(order) {
		const twoLine = (main, sub, subClass = 'po-sub') =>
			`<span class="po-main">${main}</span><span class="${subClass}">${sub}</span>`;
		if (order.status === 'received') return twoLine(shortDay(finalReceiptAt(order)), arrivalVerdict(order));
		if (order.status === 'canceled')
			return twoLine(
				`Canceled ${shortDay(order.canceled.at)}`,
				order.sent ? `Was due ${shortDay(order.due)}` : 'Never sent',
			);
		if (order.status === 'draft') return twoLine(shortDay(order.due), 'If sent today');
		const lateBy = dayGap(demoToday, order.due) < 0;
		return twoLine(shortDay(order.due), dueWording(order.due), lateBy ? 'po-sub po-sub-late' : 'po-sub');
	}

	/* The one button a row offers depends only on where the order stands. */
	function rowAction(order) {
		const byStatus = {
			ordered: () => receiveButton(order.id),
			partial: () => receiveButton(order.id),
			draft: () => `<a class="btn btn-outline-secondary btn-sm" href="#${order.id}">Review</a>`,
			received: () => `<a class="btn btn-outline-secondary btn-sm" href="#again-${order.id}">Order again</a>`,
		};
		return byStatus[order.status]?.() ?? '';
	}

	function receiveButton(orderId) {
		return `<button type="button" class="btn btn-outline-secondary btn-sm" data-po-receive="${orderId}">Receive</button>`;
	}

	function wireOrderPage() {
		views.order.addEventListener('click', (event) => {
			const trigger = event.target.closest('[data-po-act]');
			if (!trigger || !openOrder) return;
			orderActions[trigger.getAttribute('data-po-act')]?.(openOrder);
		});
		orderPart('edit').addEventListener('click', () => {
			if (openOrder) location.hash = `edit-${addressOf(openOrder.id)}`;
		});
	}

	function renderOrder(order) {
		openOrder = order;
		const vendor = vendorIndex.get(order.supplier);
		const depot = depotIndex.get(order.site);
		document.title = `${order.id} · Basalt`;
		orderPart('title').textContent = order.id;
		orderPart('sub').textContent =
			`${order.sent ? `Sent ${dayWithYear(order.sent)}` : `Started ${dayWithYear(order.created)}`} · ${vendor.name} to ${depot.name}`;
		orderPart('tags').innerHTML = statusTag(order);

		renderOrderActions(order);
		renderOrderPager(order);
		renderDeliveryCard(order, vendor);
		renderItemsCard(order, vendor);
		renderParties(vendor, depot);

		const noteBox = orderPart('noteBox');
		noteBox.hidden = !order.note;
		orderPart('extras').hidden = orderPart('parcel').hidden && noteBox.hidden;
		orderPart('noteLabel').textContent = `Note to ${vendor.name}`;
		orderPart('note').textContent = order.note;
		orderPart('log').innerHTML = activityFor(order)
			.map(
				(happening) => tidyMarkup`
      <li class="po-feed-item${happening.fresh ? ' is-fresh' : ''}">
        <span class="po-feed-icon" aria-hidden="true"><i class="bi bi-${happening.icon}"></i></span>
        <span class="po-feed-text"><span>${happening.text}</span><span class="po-feed-time">${dayAndTime(happening.at)}</span></span>
      </li>`,
			)
			.join('');
	}

	/* The main button suits the order's stage; everything else sits in the menu. */
	function renderOrderActions(order) {
		let headline = { name: 'again', icon: 'arrow-repeat', label: 'Order again' };
		if (inTransit(order)) headline = { name: 'receive', icon: 'box-arrow-in-down', label: 'Receive items' };
		else if (order.status === 'draft') headline = { name: 'send', icon: 'send', label: 'Send to supplier' };
		const primary = orderPart('primary');
		primary.setAttribute('data-po-act', headline.name);
		primary.innerHTML = `<i class="bi bi-${headline.icon} me-1" aria-hidden="true"></i>${headline.label}`;
		orderPart('edit').hidden = order.status !== 'draft';

		const menuItems = [
			'<li><button type="button" class="dropdown-item" data-po-act="copy"><i class="bi bi-clipboard" aria-hidden="true"></i>Copy order number</button></li>',
		];
		if (headline.name !== 'again')
			menuItems.unshift(
				`<li><a class="dropdown-item" href="#again-${order.id}"><i class="bi bi-arrow-repeat" aria-hidden="true"></i>Order again</a></li>`,
			);
		if (order.status !== 'received' && order.status !== 'canceled') {
			menuItems.push(
				'<li><hr class="dropdown-divider"></li><li><button type="button" class="dropdown-item po-danger-item" data-po-act="cancel"><i class="bi bi-x-octagon" aria-hidden="true"></i>Cancel order</button></li>',
			);
		}
		orderPart('menu').innerHTML = menuItems.join('');
	}

	/* Newer and older neighbors by order number; at either end the link
     points back at this order and is switched off. */
	function renderOrderPager(order) {
		const newestFirst = purchaseOrders
			.map((entry) => entry.id)
			.sort()
			.reverse();
		const slotIndex = newestFirst.indexOf(order.id);
		const neighbors = { prev: newestFirst[slotIndex - 1], next: newestFirst[slotIndex + 1] };
		for (const [part, neighborId] of Object.entries(neighbors)) {
			const anchor = orderPart(part);
			anchor.classList.toggle('disabled', !neighborId);
			anchor.setAttribute('aria-disabled', String(!neighborId));
			anchor.setAttribute('href', `#${neighborId || order.id}`);
			anchor.tabIndex = neighborId ? 0 : -1;
		}
	}

	function renderDeliveryCard(order, vendor) {
		orderPart('trackSub').innerHTML = deliverySummary(order, vendor);
		const stepTrail = deliverySteps(order, vendor);
		const track = orderPart('steps');
		track.style.setProperty('--po-count', stepTrail.length);
		track.innerHTML = stepTrail
			.map((step, index) => {
				let marker = index + 1;
				if (step.state === 'is-done') marker = '<i class="bi bi-check-lg"></i>';
				else if (step.icon) marker = `<i class="bi bi-${step.icon}"></i>`;
				return tidyMarkup`
        <li class="po-step ${step.state}"><span class="po-step-marker" aria-hidden="true">${marker}</span>
          <span class="po-step-text">
            <span class="po-step-label">${step.label}<span class="visually-hidden">${stepSpoken[step.state] || ', not yet'}</span></span>
            <span class="po-step-when">${step.when}</span>
          </span>
        </li>`;
			})
			.join('');
		growSteps(track);

		/* A draft is mostly about what goes on it, so its items card leads. */
		const trackCard = orderPart('trackCard');
		const itemsCard = orderPart('itemsCard');
		if (order.status === 'draft') trackCard.parentNode.insertBefore(itemsCard, trackCard);
		else trackCard.parentNode.insertBefore(trackCard, itemsCard);

		const parcel = orderPart('parcel');
		parcel.hidden = !order.ship || order.status === 'canceled';
		parcel.innerHTML = !order.ship
			? ''
			: tidyMarkup`
      <span class="po-parcel-icon" aria-hidden="true"><i class="bi bi-truck"></i></span>
      <span class="po-parcel-text"><span class="po-parcel-carrier">${htmlSafe(order.ship)}</span>
        <span class="po-parcel-ref">Shipment reference <span class="po-code">${htmlSafe(order.ref)}</span></span>
      </span>`;
	}

	/**
	 * Grows the filled lines between done steps the first time an order shows
	 * them on screen; every later fill shows them already drawn.
	 */
	function growSteps(trail) {
		if (stepsGrown) {
			trail.classList.remove('is-drawing');
			return;
		}
		if (
			!window.IntersectionObserver ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
			!pickAll('.po-step.is-done:not(:last-child)', trail).length
		)
			return;
		stepsGrown = true;
		let left = 0;
		trail.classList.add('is-waiting');
		trail.addEventListener('animationend', function done(event) {
			if (event.animationName !== 'po-trail-grow' || --left > 0) return;
			trail.classList.remove('is-drawing');
			trail.removeEventListener('animationend', done);
		});
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				left = pickAll('.po-step.is-done:not(:last-child)', trail).length;
				trail.classList.remove('is-waiting');
				if (left) trail.classList.add('is-drawing');
			},
			{ threshold: 0.5 },
		);
		watch.observe(trail);
	}

	function deliverySummary(order, vendor) {
		const place = htmlSafe(depotIndex.get(order.site).name);
		switch (order.status) {
			case 'draft':
				return `Not sent yet. ${htmlSafe(vendor.name)} usually delivers ${vendor.lead} days after an order is sent.`;
			case 'canceled':
				return `Canceled on ${shortDay(order.canceled.at)} by ${htmlSafe(order.canceled.by)}.`;
			case 'received':
				return `Everything arrived at ${place}, ${arrivalVerdict(order).toLowerCase()}.`;
			default: {
				const leftToCome = orderedUnits(order) - receivedUnits(order);
				return `${plural(leftToCome, 'unit', 'units')} due at ${place} on ${weekdayAndDay(order.due)}, ${dueWording(order.due).toLowerCase()}.`;
			}
		}
	}

	/* Drafted, sent, first delivery, all received. A canceled order stops
     at the point it was called off. */
	function deliverySteps(order, vendor) {
		const trail = [
			{ label: 'Drafted', when: `${dayAndTime(order.created)}<br>By ${htmlSafe(order.by)}`, state: 'is-done' },
		];
		const calledOff = () => ({
			label: 'Canceled',
			when: `${dayAndTime(order.canceled.at)}<br>${htmlSafe(order.canceled.reason)}`,
			state: 'is-stopped',
			icon: 'x-lg',
		});
		if (order.status === 'canceled' && !order.sent) return [...trail, calledOff()];

		trail.push({
			label: 'Sent',
			when: order.sent ? `${dayAndTime(order.sent)}<br>To ${htmlSafe(vendor.name)}` : 'Not yet',
			state: order.sent ? 'is-done' : 'is-next',
		});
		if (order.status === 'canceled') return [...trail, calledOff()];

		const firstDrop = order.receipts?.length ? order.receipts[0] : null;
		const waiting = order.sent ? 'is-next' : 'is-todo';
		trail.push({
			label: 'First delivery',
			when: firstDrop
				? `${dayAndTime(firstDrop.at)}<br>${plural(firstDrop.qty, 'unit', 'units')}`
				: order.sent
					? `Due ${shortDay(order.due)}`
					: 'Not yet',
			state: firstDrop ? 'is-done' : waiting,
		});

		const complete = order.status === 'received';
		const partway = order.status === 'partial';
		let lastWhen = 'Not yet';
		if (complete) lastWhen = `${dayAndTime(finalReceiptAt(order))}<br>${arrivalVerdict(order)}`;
		else if (partway)
			lastWhen = `${formatNumber(receivedUnits(order))} of ${formatNumber(orderedUnits(order))} in<br>Rest due ${shortDay(order.due)}`;
		trail.push({
			label: 'All received',
			when: lastWhen,
			state: complete ? 'is-done' : partway ? 'is-next' : 'is-todo',
		});
		return trail;
	}

	/* Until an order is sent nothing can arrive, so the Received column hides. */
	function renderItemsCard(order, vendor) {
		orderPart('linesTable').classList.toggle('po-lines-table-unsent', !order.sent);
		orderPart('itemsSub').textContent =
			`${plural(order.lines.length, 'product', 'products')}, ${plural(orderedUnits(order), 'unit', 'units')} in all.`;
		orderPart('lines').innerHTML = order.lines
			.map(([sku, ordered, received]) => {
				const product = catalogIndex.get(sku);
				const share = ordered ? Math.round((received / ordered) * 100) : 0;
				return tidyMarkup`
        <tr>
          <td><span class="po-product">${productTile(product)}<span class="po-product-text">
            <a class="po-product-name" href="product-details.html?sku=${encodeURIComponent(product.sku)}">${htmlSafe(product.name)}</a>
            <span class="po-fold">${product.sku} · ${dollars(product.cost)} each</span>
            <span class="po-fold po-fold-qty">${formatNumber(ordered)} ordered${order.sent ? `, ${formatNumber(received)} received` : ''}</span>
          </span></span></td>
          <td class="po-col-sku"><span class="po-code">${product.sku}</span></td>
          <td class="po-col-num po-col-cost">${dollars(product.cost)}</td>
          <td class="po-col-num po-col-qty">${formatNumber(ordered)}</td>
          <td class="po-col-got"><span class="po-got">
            <span class="po-meter${share >= 100 ? ' po-meter-done' : ''}" aria-hidden="true"><span style="--po-pct: ${share}%"></span></span>
            ${order.status === 'canceled' ? 'None' : formatNumber(received)}
          </span></td>
          <td class="po-col-num po-line-total">${dollars(ordered * product.cost)}</td>
        </tr>`;
			})
			.join('');
		const freightNote = order.sent
			? `${order.ship || 'Freight'}, quoted by ${vendor.name}`
			: `Estimate, confirmed by ${vendor.name}`;
		orderPart('totals').innerHTML = totalsMarkup(goodsCost(order), order.freight, freightNote);
	}

	/* Who supplies the order (a brand in the catalog) and where it is delivered. */
	function renderParties(vendor, depot) {
		orderPart('supplier-link').href = `brand-details.html?id=${encodeURIComponent(vendor.id)}`;
		orderPart('supplier').innerHTML =
			partyHeader(vendorBadge(vendor, 'po-mono-lg'), vendor.legal, vendor.city) +
			factList({
				Contact: htmlSafe(vendor.contact),
				Email: `<a class="po-link po-link-plain" href="mailto:${vendor.email}">${vendor.email}</a>`,
				Phone: htmlSafe(vendor.phone),
				Terms: `${htmlSafe(vendor.terms)}, usually ${vendor.lead} days to deliver`,
			});
		const mark = `<span class="po-mono po-mono-lg" style="--po-tone: ${seriesColor(depot.tone)}" aria-hidden="true"><i class="bi bi-buildings"></i></span>`;
		orderPart('site').innerHTML =
			partyHeader(mark, depot.name, depot.country) +
			factList({
				Address: `${htmlSafe(depot.street)}<br>${htmlSafe(depot.town)}`,
				Receiving: htmlSafe(depot.hours),
				'Books it in': htmlSafe(depot.lead),
			});
	}

	function partyHeader(mark, name, detail) {
		return `<div class="po-org">${mark}<span class="po-org-text"><span class="po-org-name">${htmlSafe(name)}</span><span class="po-org-meta">${htmlSafe(detail)}</span></span></div>`;
	}

	function factList(facts) {
		return `<dl class="po-facts">${Object.entries(facts)
			.map(([term, detail]) => `<div><dt>${term}</dt><dd>${detail}</dd></div>`)
			.join('')}</dl>`;
	}

	/* Every dated thing that happened to the order, newest at the top. */
	function activityFor(order) {
		const vendor = vendorIndex.get(order.supplier);
		const place = htmlSafe(depotIndex.get(order.site).name);
		const happenings = [];
		const draftedSeparately = order.created.slice(0, 16) !== (order.sent || '').slice(0, 16);
		if (order.status === 'draft' || draftedSeparately) {
			happenings.push({
				at: order.created,
				icon: 'pencil',
				text: `<strong>${htmlSafe(order.by)}</strong> started the order`,
			});
		}
		if (order.sent)
			happenings.push({
				at: order.sent,
				icon: 'send',
				text: `<strong>${htmlSafe(order.by)}</strong> sent it to ${htmlSafe(vendor.name)}`,
			});
		happenings.push(...(order.events || []));
		for (const receipt of order.receipts || []) {
			const remark = receipt.note ? `: ${htmlSafe(receipt.note)}` : '';
			happenings.push({
				at: receipt.at,
				icon: 'box-arrow-in-down',
				fresh: receipt.fresh,
				text: `<strong>${htmlSafe(receipt.by)}</strong> booked ${plural(receipt.qty, 'unit', 'units')} into ${place}${remark}`,
			});
		}
		if (order.canceled) {
			happenings.push({
				at: order.canceled.at,
				icon: 'x-octagon',
				fresh: order.canceled.fresh,
				text: `<strong>${htmlSafe(order.canceled.by)}</strong> canceled it: ${htmlSafe(order.canceled.reason)}`,
			});
		}
		return happenings.sort((a, b) => b.at.localeCompare(a.at));
	}

	/* Sending stamps the order with today's time, the supplier's usual lead
     time and shipping mode, and a shipment reference built from the number. */
	function dispatchOrder(order) {
		const vendor = vendorIndex.get(order.supplier);
		Object.assign(order, {
			status: 'ordered',
			sent: currentStamp(),
			by: buyerName,
			due: shiftDate(demoToday, vendor.lead),
			ship: vendor.ship,
			ref: `${vendor.mono}-${78000 + Number(order.id.replace(/\D/g, ''))}`,
		});
		renderOrder(order);
		redrawOrderBook();
		notify({
			tone: 'success',
			title: `${order.id} sent to ${vendor.name}`,
			text: `Due at ${depotIndex.get(order.site).name} on ${shortDay(order.due)}.`,
		});
	}

	function wireOrderForm() {
		vendorPicker.addEventListener('change', () => {
			renderFormLines({});
			if (!draftInForm) dueInput.value = shiftDate(demoToday, vendorIndex.get(vendorPicker.value).lead);
			describeDueDate();
		});
		sitePicker.addEventListener('change', updateFormSummary);
		for (const eventType of ['change', 'input']) formField('lines').addEventListener(eventType, updateFormSummary);
		dueInput.addEventListener('change', () => {
			describeDueDate();
			if (dueInput.value && dueInput.value >= demoToday) markInvalid(dueInput, formField('dueError'), false);
		});
		orderForm.addEventListener('submit', (event) => {
			event.preventDefault();
			saveOrderForm(true);
		});
		formField('draft').addEventListener('click', () => saveOrderForm(false));
	}

	/**
	 * Resets the form for a mode: 'new' starts blank, 'edit' changes a draft
	 * in place, and 'again' copies an earlier order into a new one.
	 */
	function loadOrderForm(mode, fromOrder) {
		draftInForm = mode === 'edit' ? fromOrder : null;
		orderForm.reset();
		markInvalid(formField('lines'), formField('linesError'), false);
		markInvalid(dueInput, formField('dueError'), false);

		const vendorId = fromOrder ? fromOrder.supplier : 'fairhaven';
		vendorPicker.value = vendorId;
		window.Basalt.select?.refresh?.(vendorPicker);
		pick(`input[value="${fromOrder ? fromOrder.site : 'reno'}"]`, sitePicker).checked = true;
		dueInput.value = mode === 'edit' ? fromOrder.due : shiftDate(demoToday, vendorIndex.get(vendorId).lead);
		formField('note').value = fromOrder ? fromOrder.note : '';

		const wording = formWording(mode, fromOrder);
		formField('title').textContent = wording.title;
		formField('sub').textContent = wording.sub;
		formField('back').setAttribute('href', wording.backHref);
		document.title = `${wording.title} · Basalt`;

		renderFormLines(Object.fromEntries((fromOrder ? fromOrder.lines : []).map(([sku, ordered]) => [sku, ordered])));
		describeDueDate();
	}

	function formWording(mode, fromOrder) {
		if (mode === 'edit') {
			return {
				title: `Edit ${fromOrder.id}`,
				sub: 'A draft, not sent yet. Change it, then send it or keep it as a draft.',
				backHref: `#${fromOrder.id}`,
			};
		}
		return {
			title: 'New purchase order',
			sub: fromOrder
				? `A copy of ${fromOrder.id}. Check the quantities, then send it.`
				: 'Pick a supplier, then how many of each product to order.',
			backHref: '#',
		};
	}

	/* One row per product the chosen supplier makes, showing how much the
     chosen location has free so the buyer can judge how many to order. */
	function renderFormLines(quantities) {
		const vendor = vendorIndex.get(vendorPicker.value);
		const quantityList = formField('lines');
		quantityList.innerHTML = catalog
			.filter((product) => product.supplier === vendor.id)
			.map(
				(product) => tidyMarkup`
      <li class="po-qty" data-po-sku="${product.sku}">${productTile(product)}
        <span class="po-qty-text"><label class="po-qty-name" for="po-eQty-${product.sku}">${htmlSafe(product.name)}</label>
          <span class="po-qty-sub">${dollars(product.cost)} each · <span data-po-stock></span></span>
        </span>
        ${stepperMarkup({ id: `poEQty-${product.sku}`, value: quantities[product.sku] || 0, max: 5000, step: 10, label: `Units of ${product.name}` })}
        <span class="po-qty-total" data-po-line-total></span>
      </li>`,
			)
			.join('');
		activateSteppers(quantityList);
		formField('supplierHelp').textContent =
			`${vendor.legal}, ${vendor.terms}. Usually delivers ${vendor.lead} days after the order is sent.`;
		formField('itemsSub').textContent = `Everything ${vendor.name} supplies. Leave a product at 0 to skip it.`;
		updateFormSummary();
	}

	/* Refreshes stock hints, line totals and the summary card after any change. */
	function updateFormSummary() {
		const siteId = chosenSite();
		const depot = depotIndex.get(siteId);
		const quantityList = formField('lines');
		const quantities = readQuantities(quantityList);
		const tallies = { cost: 0, units: 0, products: 0 };

		for (const row of pickAll('.po-qty', quantityList)) {
			const product = catalogIndex.get(row.getAttribute('data-po-sku'));
			const [free, reorderAt] = product.free[siteId];
			const wanted = quantities[product.sku];
			const stock = pick('[data-po-stock]', row);
			stock.textContent = `${formatNumber(free)} free at ${depot.name}${free < reorderAt ? `, below ${reorderAt}` : ''}`;
			stock.classList.toggle('po-low', free < reorderAt);
			pick('[data-po-line-total]', row).textContent = wanted ? dollars(wanted * product.cost) : '';
			tallies.cost += wanted * product.cost;
			tallies.units += wanted;
			if (wanted) tallies.products += 1;
		}

		const vendor = vendorIndex.get(vendorPicker.value);
		formField('totals').innerHTML = totalsMarkup(
			tallies.cost,
			tallies.units ? estimateFreight(tallies.units) : 0,
			`Estimate, confirmed by ${vendor.name}`,
		);
		formField('sumWho').textContent = tallies.units
			? `${vendor.name} to ${depot.name}, ${plural(tallies.products, 'product', 'products')}, ${plural(tallies.units, 'unit', 'units')}.`
			: 'Nothing added yet.';
		formField('sendNote').textContent = `Sending emails the order to ${vendor.email}.`;
		if (tallies.units) markInvalid(quantityList, formField('linesError'), false);
	}

	function describeDueDate() {
		const vendor = vendorIndex.get(vendorPicker.value);
		const picked = dueInput.value;
		formField('dueHelp').textContent = picked
			? `${weekdayAndDay(picked)}, ${dayGap(demoToday, picked)} days from today. ${vendor.name} usually takes ${vendor.lead}.`
			: '';
	}

	/* Checks there is something to order and a date from today on, then
     keeps the order as a draft or sends it straight away. */
	function saveOrderForm(sendNow) {
		const quantityList = formField('lines');
		const quantities = readQuantities(quantityList);
		const unitCount = sumOf(Object.values(quantities), (value) => value);
		const dateMissing = !dueInput.value || dueInput.value < demoToday;
		markInvalid(quantityList, formField('linesError'), !unitCount);
		markInvalid(dueInput, formField('dueError'), dateMissing);
		if (!unitCount) {
			pick('.basalt-stepper-input', quantityList)?.focus();
			return;
		}
		if (dateMissing) {
			dueInput.focus();
			return;
		}

		let saved = draftInForm;
		if (!saved) {
			const nextNumber = Math.max(...purchaseOrders.map((entry) => Number(entry.id.replace(/\D/g, '')))) + 1;
			saved = { id: `#${nextNumber}`, created: currentStamp(), by: buyerName };
			purchaseOrders.unshift(saved);
		}
		Object.assign(saved, {
			status: 'draft',
			supplier: vendorPicker.value,
			site: chosenSite(),
			due: dueInput.value,
			freight: estimateFreight(unitCount),
			lines: Object.entries(quantities)
				.filter(([, wanted]) => wanted)
				.map(([sku, wanted]) => [sku, wanted, 0]),
			note: formField('note').value.trim(),
		});
		if (sendNow) dispatchOrder(saved);
		else
			notify({
				tone: 'success',
				title: `${saved.id} saved as a draft`,
				text: `Send it to ${vendorIndex.get(saved.supplier).name} when it is ready.`,
			});
		redrawOrderBook();
		location.hash = addressOf(saved.id);
	}

	function chosenSite() {
		return pick('input[name="site"]:checked', sitePicker)?.value ?? 'reno';
	}

	/** A rough freight quote: a base charge plus a little per unit, to the nearest ten. */
	function estimateFreight(unitCount) {
		return Math.round((60 + unitCount * 0.6) / 10) * 10;
	}

	function wireReceiving() {
		for (const eventType of ['change', 'input']) drawerPart('lines').addEventListener(eventType, describeReceipt);
		receiveForm.addEventListener('submit', bookReceipt);

		/* Receive buttons appear on the list and on the order page alike. */
		document.addEventListener('click', (event) => {
			const trigger = event.target.closest('[data-po-receive]');
			if (trigger) openReceiving(findOrder(trigger.getAttribute('data-po-receive')));
		});
	}

	/* Each line still owed starts at the full outstanding count. */
	function openReceiving(order) {
		orderBeingReceived = order;
		receiveForm.reset();
		markInvalid(drawerPart('lines'), drawerPart('error'), false);
		drawerPart('title').textContent = `Receive ${order.id}`;
		drawerPart('sub').textContent =
			`From ${vendorIndex.get(order.supplier).name} at ${depotIndex.get(order.site).name}. Count what is in the delivery.`;
		drawerPart('lines').innerHTML = order.lines
			.filter(([, ordered, received]) => ordered > received)
			.map(([sku, ordered, received]) => {
				const product = catalogIndex.get(sku);
				const owed = ordered - received;
				return tidyMarkup`
        <li class="po-qty" data-po-sku="${product.sku}">${productTile(product)}
          <span class="po-qty-text"><label class="po-qty-name" for="po-gQty-${product.sku}">${htmlSafe(product.name)}</label>
            <span class="po-qty-sub">${formatNumber(owed)} still due${received ? `, ${formatNumber(received)} already in` : ''}</span>
          </span>
          ${stepperMarkup({ id: `poGQty-${product.sku}`, value: owed, max: owed, step: 1, label: `Units of ${product.name} that arrived` })}
        </li>`;
			})
			.join('');
		activateSteppers(drawerPart('lines'));
		describeReceipt();
		window.bootstrap.Offcanvas.getOrCreateInstance(receiveDrawer).show();
	}

	/* Says what booking the counted units will do to the order. */
	function describeReceipt() {
		if (!orderBeingReceived) return;
		const counted = sumOf(Object.values(readQuantities(drawerPart('lines'))), (value) => value);
		const stillOwed = orderedUnits(orderBeingReceived) - receivedUnits(orderBeingReceived) - counted;
		const booking = `Books ${plural(counted, 'unit', 'units')} into ${depotIndex.get(orderBeingReceived.site).name}`;
		let outcome = '';
		if (counted)
			outcome =
				stillOwed > 0
					? `${booking}. ${formatNumber(stillOwed)} stay on order.`
					: `${booking} and closes the order.`;
		drawerPart('after').textContent = outcome;
		if (counted) markInvalid(drawerPart('lines'), drawerPart('error'), false);
	}

	function bookReceipt(event) {
		event.preventDefault();
		const receiving = orderBeingReceived;
		const quantityList = drawerPart('lines');
		const tallies = readQuantities(quantityList);
		const counted = sumOf(Object.values(tallies), (value) => value);
		if (!counted) {
			markInvalid(quantityList, drawerPart('error'), true);
			pick('.basalt-stepper-input', quantityList)?.focus();
			return;
		}

		for (const line of receiving.lines) {
			if (tallies[line[0]]) line[2] = Math.min(line[1], line[2] + tallies[line[0]]);
		}
		receiving.receipts = receiving.receipts || [];
		receiving.receipts.push({
			at: currentStamp(),
			qty: counted,
			by: buyerName,
			note: pick('#po-receive-note').value.trim(),
			fresh: true,
		});
		receiving.status = receivedUnits(receiving) >= orderedUnits(receiving) ? 'received' : 'partial';
		window.bootstrap.Offcanvas.getOrCreateInstance(receiveDrawer).hide();
		redrawOrderBook();
		if (openOrder === receiving && !views.order.hidden) renderOrder(receiving);
		notify({
			tone: 'success',
			title: `${plural(counted, 'unit', 'units')} booked into ${depotIndex.get(receiving.site).name}`,
			text:
				receiving.status === 'received'
					? `${receiving.id} is complete.`
					: `${receiving.id} has ${formatNumber(orderedUnits(receiving) - receivedUnits(receiving))} still to come.`,
		});
	}

	function wireCanceling() {
		cancelForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const closing = orderBeingCanceled;
			closing.status = 'canceled';
			closing.canceled = {
				at: currentStamp(),
				by: buyerName,
				reason: pick('#po-cancel-reason').value,
				fresh: true,
			};
			window.bootstrap.Modal.getOrCreateInstance(cancelDialog).hide();
			redrawOrderBook();
			renderOrder(closing);
			notify({
				tone: 'success',
				title: `${closing.id} canceled`,
				text: closing.sent
					? `${vendorIndex.get(closing.supplier).name} has been told.`
					: 'The draft is closed.',
			});
		});
	}

	/* A sent order means telling the supplier; a draft simply closes. */
	function openCanceling(order) {
		orderBeingCanceled = order;
		cancelForm.reset();
		window.Basalt.select?.refresh?.(pick('#po-cancel-reason'));
		pick('[data-po-c="title"]', cancelDialog).textContent = `Cancel ${order.id}`;
		const arrived = receivedUnits(order);
		const stockLine = arrived
			? `The ${plural(arrived, 'unit', 'units')} already received stay in stock.`
			: 'Nothing has arrived yet.';
		pick('[data-po-c="sub"]', cancelDialog).textContent = order.sent
			? `${vendorIndex.get(order.supplier).name} is told the order is off. ${stockLine}`
			: 'It was never sent, so the supplier is not told.';
		window.bootstrap.Modal.getOrCreateInstance(cancelDialog).show();
	}

	/* Small pieces of markup used by more than one view. */

	/**
	 * Template tag for markup written over several indented lines: it drops
	 * each line break and the indent after it from the literal text, and
	 * leaves every inserted value exactly as it is.
	 */
	function tidyMarkup(pieces, ...values) {
		let joined = '';
		for (const [index, piece] of pieces.entries()) {
			joined += piece.replace(/\n\s*/g, '');
			if (index < values.length) joined += String(values[index]);
		}
		return joined;
	}

	function vendorBadge(vendor, extraClass) {
		return `<span class="po-mono${extraClass ? ` ${extraClass}` : ''}" aria-hidden="true" style="--po-tone: ${seriesColor(vendor.tone)}">${vendor.mono}</span>`;
	}

	function productTile(product) {
		return `<span class="po-tile" aria-hidden="true" style="--po-tone: ${seriesColor(product.tone)}"><i class="bi bi-${product.icon}"></i></span>`;
	}

	function statusTag(order) {
		const { tone, label } = statusPills[order.status];
		return `<span class="basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}">${label}</span>`;
	}

	function totalsMarkup(goods, freight, freightNote) {
		return tidyMarkup`
      <div><dt>Subtotal</dt><dd>${dollars(goods)}</dd></div>
      <div><dt>Freight<small>${htmlSafe(freightNote)}</small></dt><dd>${dollars(freight)}</dd></div>
      <div class="po-totals-sum"><dt>Total</dt><dd>${dollars(goods + freight)}</dd></div>`;
	}

	function stepperMarkup({ id, value, max, step, label }) {
		return tidyMarkup`
      <div class="basalt-stepper" data-basalt-stepper>
        <button type="button" class="basalt-stepper-btn" aria-label="${step} fewer" data-basalt-step="-1"><i class="bi bi-dash-lg" aria-hidden="true"></i></button>
        <input type="number" class="basalt-stepper-input" id="${id}" value="${value}" min="0" max="${max}" step="${step}" inputmode="numeric" aria-label="${htmlSafe(label)}">
        <button type="button" class="basalt-stepper-btn" aria-label="${step} more" data-basalt-step="1"><i class="bi bi-plus-lg" aria-hidden="true"></i></button>
      </div>`;
	}

	function activateSteppers(container) {
		for (const stepper of pickAll('[data-basalt-stepper]', container)) window.Basalt.stepper?.(stepper);
	}

	/** Reads every quantity row in a list as { sku: whole units, never below zero }. */
	function readQuantities(list) {
		const bySku = {};
		for (const row of pickAll('.po-qty', list)) {
			bySku[row.getAttribute('data-po-sku')] = Math.max(0, parseInt(pick('input', row).value, 10) || 0);
		}
		return bySku;
	}

	/* Shows or clears an error message along with the red state on its field. */
	function markInvalid(field, message, invalid) {
		message.hidden = !invalid;
		field.classList.toggle('is-invalid', invalid);
	}

	function notify(options) {
		window.Basalt.toasts?.push(options);
	}

	/* Lookups and sums over an order's lines. */

	function findOrder(id) {
		return purchaseOrders.find((entry) => entry.id === id);
	}
	function inTransit(order) {
		return order.status === 'ordered' || order.status === 'partial';
	}
	function orderedUnits(order) {
		return sumOf(order.lines, (line) => line[1]);
	}
	function receivedUnits(order) {
		return sumOf(order.lines, (line) => line[2]);
	}
	function goodsCost(order) {
		return sumOf(order.lines, ([sku, ordered]) => ordered * catalogIndex.get(sku).cost);
	}
	function orderTotal(order) {
		return goodsCost(order) + order.freight;
	}
	function finalReceiptAt(order) {
		return order.receipts?.length ? order.receipts[order.receipts.length - 1].at : '';
	}

	function sumOf(list, amountOf) {
		let accrued = 0;
		for (const entry of list) accrued += amountOf(entry);
		return accrued;
	}

	/** "120 × Sculpted Shoulder Blazer" for a single product, a product and unit count for several. */
	function contentsSummary(order) {
		if (order.lines.length !== 1)
			return `${plural(order.lines.length, 'product', 'products')}, ${plural(orderedUnits(order), 'unit', 'units')}`;
		const [[sku, ordered]] = order.lines;
		return `${formatNumber(ordered)} × ${catalogIndex.get(sku).name}`;
	}

	/** "Today", "Tomorrow", "In 4 days" or "2 days late", counted from the demo date. */
	function dueWording(isoDate) {
		const gap = dayGap(demoToday, isoDate);
		if (gap > 1) return `In ${gap} days`;
		if (gap === 1) return 'Tomorrow';
		return gap === 0 ? 'Today' : `${plural(-gap, 'day', 'days')} late`;
	}

	/** How the last delivery landed against the due date. */
	function arrivalVerdict(order) {
		const gap = dayGap(order.due, finalReceiptAt(order));
		if (gap < 0) return `${plural(-gap, 'day', 'days')} early`;
		return gap <= 0 ? 'On time' : `${plural(gap, 'day', 'days')} late`;
	}

	/* DOM shortcuts, then how numbers, money and dates are written. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}
	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
	function orderPart(key) {
		return pick(`[data-po-o="${key}"]`, views.order);
	}
	function formField(key) {
		return pick(`[data-po-e="${key}"]`, orderForm);
	}
	function drawerPart(key) {
		return pick(`[data-po-g="${key}"]`, receiveDrawer);
	}
	function seriesColor(slot) {
		return `var(--basalt-series-${slot})`;
	}
	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (character) => htmlEntities[character]);
	}
	function formatNumber(value) {
		return Number(value).toLocaleString('en-US');
	}
	function dollars(value) {
		return `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
	}
	function plural(count, singular, pluralForm) {
		return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
	}

	/* Dates are handled as UTC calendar days so no time zone can shift them. */
	function calendarDay(iso) {
		const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
		return new Date(Date.UTC(year, month - 1, day));
	}

	function shortDay(iso) {
		const when = calendarDay(iso);
		return `${monthAbbr[when.getUTCMonth()]} ${when.getUTCDate()}`;
	}

	function dayWithYear(iso) {
		return `${shortDay(iso)} ${calendarDay(iso).getUTCFullYear()}`;
	}
	function weekdayAndDay(iso) {
		return `${weekdayAbbr[calendarDay(iso).getUTCDay()]}, ${shortDay(iso)}`;
	}

	function dayAndTime(iso) {
		const hour = Number(iso.slice(11, 13));
		return `${shortDay(iso)}, ${hour % 12 || 12}:${iso.slice(14, 16)} ${hour < 12 ? 'am' : 'pm'}`;
	}

	function dayGap(fromIso, toIso) {
		return Math.round((calendarDay(toIso) - calendarDay(fromIso)) / 86400000);
	}

	function shiftDate(iso, days) {
		const when = calendarDay(iso);
		when.setUTCDate(when.getUTCDate() + days);
		return when.toISOString().slice(0, 10);
	}

	/** The demo date with the visitor's current clock time, as stored on new events. */
	function currentStamp() {
		const now = new Date();
		const twoDigits = (part) => String(part).padStart(2, '0');
		return `${demoToday}T${twoDigits(now.getHours())}:${twoDigits(now.getMinutes())}`;
	}

	start();
})();
