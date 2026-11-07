/**
 * Drives data-grids.html: nine sample grids from the Marlo shop and the
 * Fieldline back office. One reusable controller, tableKit(), handles
 * searching, narrowing, ordering and paging; the remaining grids are wired
 * by hand. Bootstrap's dropdown is the only outside dependency.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-dt-root]');

	const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
	const wholeDollars = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 0,
	});
	const counting = new Intl.NumberFormat('en-US');

	/* Every date is pinned to midday so day arithmetic never trips on DST. */
	const midday = new Date();
	midday.setHours(12, 0, 0, 0);
	const DAY_MS = 864e5;

	/* A fixed seed keeps the generated orders, spend and stock identical on
     every visit. The grids draw from it in page order, so that order matters. */
	const random = seededRandom(1729);

	/** Status label to the tone suffix of .basalt-status; an empty tone is neutral. */
	const TONE_OF = {
		'Awaiting payment': 'warning',
		Processing: '',
		Shipped: 'info',
		Delivered: 'success',
		Refunded: 'danger',
		Paid: 'success',
		Due: 'warning',
		Overdue: 'danger',
		Draft: '',
		Active: 'success',
		Paused: '',
		'Out of stock': 'danger',
	};

	/* Marlo shoppers who buy online: name, home city, mail provider. */
	const SHOPPERS = [
		['Dana Whitfield', 'Columbus', 'outlook.com'],
		['Earl Rudd', 'Minneapolis', 'fastmail.com'],
		['Keisha Merritt', 'Boulder', 'icloud.com'],
		['Gerald Fletcher', 'Spokane', 'protonmail.com'],
		['Lindsay Kinney', 'Waco', 'hey.com'],
		['Forrest Brennan', 'Concord', 'comcast.net'],
		['Robyn Daniels', 'Madison', 'outlook.com'],
		['Tom Ashworth', 'Minot', 'aol.com'],
		['Sandra Palmer', 'Pittsburgh', 'icloud.com'],
		['Courtney Holloway', 'Eugene', 'fastmail.com'],
		['Victor Devin', 'Phoenix', 'yahoo.com'],
		['Leslie Beck', 'Tampa', 'hey.com'],
	];

	/* The people placing the generated orders, each with a ship-to city. */
	const BUYERS = [
		['Sandra Franklin', 'Columbus'],
		['Leslie Whitlock', 'Minneapolis'],
		['Phyllis Delaney', 'Boulder'],
		['Travis Daugherty', 'Spokane'],
		['Patricia Pemberton', 'Waco'],
		['Benjamin Hartley', 'Concord'],
		['Cheryl Sorensen', 'Madison'],
		['Sabrina Kavanagh', 'Minot'],
		['Eleanor Fairweather', 'Pittsburgh'],
		['Iva Blackwood', 'Eugene'],
		['Rodney Forbes', 'Phoenix'],
		['Christopher Vance', 'Tampa'],
		['Georgia Webster', 'Syracuse'],
		['Faith van der Linden', 'Ann Arbor'],
		['Maureen Fitzgerald', 'Cheyenne'],
	];

	/* Boxed Marlo goods with their list price in dollars. */
	const CATALOG = [
		['Sculpted Shoulder Blazer', 1290],
		['Draped Column Gown', 2150],
		['Tiered Organza Dress', 1680],
		['Chalk-Stripe Suit', 2450],
		['Leather Trench Coat', 3200],
		['Bar Loafers', 790],
		['Two-Tone Oxfords', 850],
		['Cat-Eye Sunglasses', 465],
		['Shield Sunglasses', 520],
	];

	/* Card hook to the function that brings that card to life, in page order. */
	const MOUNTS = [
		['[data-dt-orders]', mountOrders],
		['[data-dt-techs]', mountTeam],
		['[data-dt-customers]', mountShoppers],
		['[data-dt-gear]', mountClothing],
		['[data-dt-invoices]', mountInvoices],
		['[data-dt-stock]', mountStockLog],
		['[data-dt-subs]', mountPlans],
		['[data-dt-services]', mountPriceList],
		['[data-dt-sales]', mountSales],
	];

	if (pageRoot) start();

	function start() {
		for (const [hook, mount] of MOUNTS) {
			const section = pick(hook, pageRoot);
			if (section) mount(section);
		}
		wireKindChips();
	}

	/* The chips above the grid show one kind of table at a time. */
	function wireKindChips() {
		const [board, counter] = hooksIn(pageRoot, 'grid', 'count');
		const panels = [...pickAll('.dt-card', board)];
		const kindButtons = pickAll('[data-dt-filter]', pageRoot);

		function showKind(kind) {
			const everything = kind === 'all';
			let shownCount = 0;
			for (const section of panels) {
				const fits = everything || section.getAttribute('data-dt-kind') === kind;
				section.classList.toggle('is-hidden', !fits);
				shownCount += fits ? 1 : 0;
			}
			board.classList.toggle('is-filtered', !everything);
			counter.textContent = `${shownCount} ${shownCount === 1 ? 'table' : 'tables'}`;
		}

		for (const kindButton of kindButtons) {
			kindButton.addEventListener('click', () => {
				for (const button of kindButtons) {
					button.setAttribute('aria-pressed', String(button === kindButton));
				}
				showKind(kindButton.getAttribute('data-dt-filter'));
			});
		}
	}

	/* Recent orders: every feature of tableKit at once, plus row selection. */
	function mountOrders(section) {
		const records = makeOrders();
		const chosen = new Set();
		const [searchBox, statusPick, sizePick, rangeNote, pageBox, batchBar, bulkTally, widenButton] = hooksIn(
			section,
			'search',
			'status',
			'per',
			'summary',
			'check-page',
			'bulk',
			'bulk-count',
			'select-all-matching',
		);
		const SHIPPABLE = new Set(['Processing', 'Awaiting payment']);
		let onlyStatus = '';

		const ordersTable = tableKit(section, {
			records,
			perPage: Number(sizePick.value),
			startSort: { key: 'date', dir: 'desc' },
			hits: (sale, query) => `#${sale.id} ${sale.customer} ${sale.city}`.toLowerCase().includes(query),
			passes: (sale) => !onlyStatus || sale.status === onlyStatus,
			toRow: (sale, query) => orderRow(sale, query, chosen.has(sale.id)),
			emptyCell: (query) =>
				`<div class="dt-empty"><p class="dt-empty-title">No orders match${query ? ` “${safeText(query)}”` : ' this status'}</p><p class="dt-empty-text">Try another word, or show every status.</p><button type="button" class="btn btn-outline-secondary btn-sm" data-dt-reset>Clear search and filter</button></div>`,
			onDraw: (snapshot) => {
				const matchCount = snapshot.kept.length;
				const firstShown = matchCount ? (snapshot.page - 1) * snapshot.perPage + 1 : 0;
				const lastShown = Math.min(snapshot.page * snapshot.perPage, matchCount);
				rangeNote.textContent = matchCount
					? `${counting.format(firstShown)}–${counting.format(lastShown)} of ${countOf(matchCount, 'order', 'orders')}`
					: 'No orders to show';
				reflectSelection();
			},
		});

		searchBox.addEventListener('input', () => ordersTable.setSearch(searchBox.value));
		statusPick.addEventListener('change', () => {
			onlyStatus = statusPick.value;
			ordersTable.restart();
		});
		sizePick.addEventListener('change', () => ordersTable.setPageSize(Number(sizePick.value)));

		section.addEventListener('change', (event) => {
			const box = event.target.closest('[data-dt-pick]');
			if (!box) return;
			const id = Number(box.getAttribute('data-dt-pick'));
			if (box.checked) chosen.add(id);
			else chosen.delete(id);
			box.closest('tr').classList.toggle('table-active', box.checked);
			reflectSelection();
		});

		section.addEventListener('click', (event) => {
			if (!event.target.closest('[data-dt-reset]')) return;
			searchBox.value = '';
			statusPick.value = '';
			onlyStatus = '';
			ordersTable.setSearch('');
			searchBox.focus();
		});

		pageBox.addEventListener('change', () => {
			const adding = pageBox.checked;
			for (const sale of ordersTable.snapshot.onPage) {
				if (adding) chosen.add(sale.id);
				else chosen.delete(sale.id);
			}
			ordersTable.redraw();
		});

		widenButton.addEventListener('click', () => {
			for (const sale of ordersTable.snapshot.kept) chosen.add(sale.id);
			ordersTable.redraw();
			pageBox.focus();
		});

		const [clearButton, shipButton, pickedExport, fullExport] = hooksIn(
			section,
			'bulk-clear',
			'bulk-ship',
			'bulk-export',
			'export',
		);

		clearButton.addEventListener('click', () => {
			chosen.clear();
			ordersTable.redraw();
			pageBox.focus();
		});

		shipButton.addEventListener('click', () => {
			for (const sale of records) {
				if (chosen.has(sale.id) && SHIPPABLE.has(sale.status)) sale.status = 'Shipped';
			}
			ordersTable.redraw();
		});

		pickedExport.addEventListener('click', () => {
			saveFile('orders-selected.csv', ordersCsv(records.filter((sale) => chosen.has(sale.id))));
		});
		fullExport.addEventListener('click', () => {
			saveFile('orders.csv', ordersCsv(ordersTable.snapshot.kept));
		});

		ordersTable.redraw();

		/* Keeps the header checkbox, the bulk bar and the "select all" offer
       in step with what is chosen and what the page shows. */
		function reflectSelection() {
			const { onPage, kept } = ordersTable.snapshot;
			const chosenHere = onPage.filter((sale) => chosen.has(sale.id)).length;
			pageBox.checked = onPage.length > 0 && chosenHere === onPage.length;
			pageBox.indeterminate = chosenHere > 0 && chosenHere < onPage.length;
			pageBox.disabled = onPage.length === 0;
			batchBar.hidden = chosen.size === 0;
			bulkTally.textContent = counting.format(chosen.size);
			const unchosen = kept.some((sale) => !chosen.has(sale.id));
			widenButton.hidden = !(pageBox.checked && unchosen);
			widenButton.textContent = `Select all ${counting.format(kept.length)} matching`;
		}
	}

	/** Builds the 124 generated orders, newest first, from the seeded stream. */
	function makeOrders() {
		const batch = [];
		for (let n = 0; n < 124; n += 1) {
			const [customer, city] = pickFrom(BUYERS);
			const age = Math.floor(n * 0.55 + random() * 0.5);
			const stage = statusForAge(age, random());
			const pieces = 1 + Math.floor(random() * 5);
			let basket = 0;
			for (let line = 0; line < pieces; line += 1) basket += pickFrom(CATALOG)[1];
			batch.push({
				id: 21760 - n,
				customer,
				city,
				date: daysBack(age),
				items: pieces,
				status: stage,
				total: basket,
			});
		}
		return batch;
	}

	/** Older orders are further along; a few of the oldest end up refunded. */
	function statusForAge(age, chance) {
		if (age < 1) return chance < 0.35 ? 'Awaiting payment' : 'Processing';
		if (age < 3) return chance < 0.4 ? 'Processing' : 'Shipped';
		if (age < 6) return chance < 0.5 ? 'Shipped' : 'Delivered';
		return random() < 0.07 ? 'Refunded' : 'Delivered';
	}

	function orderRow(sale, query, isChosen) {
		const parts = [
			`<td class="dt-check"><input class="form-check-input" type="checkbox" data-dt-pick="${sale.id}"${isChosen ? ' checked' : ''} aria-label="Select order ${sale.id}"></td>`,
			`<td><span class="dt-mono">${markHits(`#${sale.id}`, query)}</span></td>`,
			`<td><span class="dt-strong">${markHits(sale.customer, query)}</span><span class="dt-sub">${markHits(sale.city, query)}</span></td>`,
			`<td>${timeTag(sale.date)}</td>`,
			`<td class="text-end">${sale.items}</td>`,
			`<td>${toneTag(sale.status)}</td>`,
			`<td class="text-end dt-strong">${dollars.format(sale.total)}</td>`,
		];
		return `<tr${isChosen ? ' class="table-active"' : ''}>${parts.join('')}</tr>`;
	}

	function ordersCsv(batch) {
		const titles = ['Order', 'Customer', 'City', 'Placed', 'Items', 'Status', 'Total'];
		const body = batch.map((sale) => [
			`#${sale.id}`,
			sale.customer,
			sale.city,
			dayStamp(sale.date),
			sale.items,
			sale.status,
			sale.total.toFixed(2),
		]);
		return [titles, ...body].map((parts) => parts.map(csvField).join(',')).join('\n');
	}

	/* Team members: sort only, with a sentence that names the current order. */
	function mountTeam(section) {
		const staff = [
			{
				name: 'Andre Coleman',
				crew: 'North crew',
				trade: 'Carer',
				rating: 4.86,
				rate: 48,
				lastVisit: daysBack(0),
			},
			{
				name: 'Bea Lancaster',
				crew: 'North crew',
				trade: 'Senior carer',
				rating: 4.71,
				rate: 52,
				lastVisit: daysBack(1),
			},
			{
				name: 'Charles Maddox',
				crew: 'East crew',
				trade: 'Nurse',
				rating: 4.93,
				rate: 46.5,
				lastVisit: daysBack(0),
			},
			{
				name: 'Dee Harrington',
				crew: 'East crew',
				trade: 'Carer',
				rating: 4.58,
				rate: 44,
				lastVisit: daysBack(3),
			},
			{
				name: 'Eli Washburn',
				crew: 'South crew',
				trade: 'Live-in carer',
				rating: 4.64,
				rate: 34.5,
				lastVisit: daysBack(2),
			},
			{
				name: 'Zoey Quaid',
				crew: 'South crew',
				trade: 'Senior carer',
				rating: 4.9,
				rate: 55,
				lastVisit: daysBack(0),
			},
			{
				name: 'Gus Patterson',
				crew: 'West crew',
				trade: 'Nurse',
				rating: 4.42,
				rate: 41,
				lastVisit: daysBack(6),
			},
			{
				name: 'Holly Vick',
				crew: 'West crew',
				trade: 'Cleaner',
				rating: 4.77,
				rate: 28.5,
				lastVisit: daysBack(1),
			},
		];
		/* Column key to its spoken name, then the ascending and descending phrase. */
		const PHRASES = {
			name: ['team member', 'A to Z', 'Z to A'],
			trade: ['role', 'A to Z', 'Z to A'],
			rating: ['rating', 'lowest first', 'highest first'],
			rate: ['hourly rate', 'lowest first', 'highest first'],
			lastVisit: ['last visit', 'oldest first', 'newest first'],
		};
		const [note] = hooksIn(section, 'summary');

		tableKit(section, {
			records: staff,
			startSort: { key: 'name', dir: 'asc' },
			toRow: (member) =>
				`<tr><td><span class="dt-strong">${safeText(member.name)}</span><span class="dt-sub">${safeText(member.crew)}</span></td><td>${safeText(member.trade)}</td><td class="text-end">${member.rating.toFixed(2)}</td><td class="text-end">${dollars.format(member.rate)}</td><td>${timeTag(member.lastVisit)}</td></tr>`,
			onDraw: ({ sortBy: orderBy }) => {
				const [spoken, rising, falling] = PHRASES[orderBy.key];
				note.textContent = `Sorted by ${spoken}, ${orderBy.dir === 'asc' ? rising : falling}`;
			},
		}).redraw();
	}

	/* Customers: a search box whose hits are marked inside each cell. */
	function mountShoppers(section) {
		const people = SHOPPERS.map(([name, city, domain]) => ({
			name,
			email: mailAddress(name, domain),
			city,
			spent: Math.round(120 + random() * 1400),
		}));
		const [searchBox, note] = hooksIn(section, 'search', 'summary');
		const everyone = countOf(people.length, 'customer', 'customers');

		const listing = tableKit(section, {
			records: people,
			hits: (person, query) => `${person.name} ${person.email} ${person.city}`.toLowerCase().includes(query),
			toRow: (person, query) =>
				`<tr><td><span class="dt-person"><span class="dt-avatar" aria-hidden="true">${monogram(person.name)}</span><span><a class="dt-link" href="company-details.html">${markHits(person.name, query)}</a><span class="dt-sub">${markHits(person.email, query)}</span></span></span></td><td>${markHits(person.city, query)}</td><td class="text-end dt-strong">${wholeDollars.format(person.spent)}</td></tr>`,
			emptyCell: (query) =>
				`<div class="dt-empty"><p class="dt-empty-title">No customers match “${safeText(query)}”</p><p class="dt-empty-text">Check the spelling, or search by city or email instead.</p><button type="button" class="btn btn-outline-secondary btn-sm" data-dt-clear>Clear search</button></div>`,
			onDraw: ({ query, kept }) => {
				note.textContent = query ? `${counting.format(kept.length)} of ${everyone}` : everyone;
			},
		});

		searchBox.addEventListener('input', () => listing.setSearch(searchBox.value));
		section.addEventListener('click', (event) => {
			if (!event.target.closest('[data-dt-clear]')) return;
			searchBox.value = '';
			listing.setSearch('');
			searchBox.focus();
		});
		listing.redraw();
	}

	/* Marlo clothing: four filters that narrow the list together. */
	function mountClothing(section) {
		const garments = [
			{ name: 'Sculpted Shoulder Blazer', cat: 'Clothing', brand: 'Hollis Atelier', stock: 38, price: 649 },
			{ name: 'Draped Column Gown', cat: 'Clothing', brand: 'Hollis Atelier', stock: 3, price: 429 },
			{ name: 'Tiered Organza Dress', cat: 'Clothing', brand: 'Calder Couture', stock: 112, price: 119 },
			{ name: 'Leather Trench Coat', cat: 'Clothing', brand: 'Willamette Tailors', stock: 0, price: 149 },
			{ name: 'Chalk-Stripe Suit', cat: 'Clothing', brand: 'Willamette Tailors', stock: 17, price: 189 },
			{ name: 'Bar Loafers', cat: 'Clothing', brand: 'Marlo', stock: 64, price: 59 },
			{ name: 'Two-Tone Oxfords', cat: 'Accessories', brand: 'Marlo', stock: 2, price: 49 },
			{ name: 'Cat-Eye Sunglasses', cat: 'Accessories', brand: 'Fairhaven Optical', stock: 0, price: 89 },
			{ name: 'Shield Sunglasses', cat: 'Accessories', brand: 'Fairhaven Optical', stock: 145, price: 39 },
		];
		const CEILING = 700;
		const chosen = { category: '', maker: '', maxPrice: CEILING, inStockOnly: false };
		const [categoryPick, brandPick, priceSlider, priceReadout, stockSwitch, resetButton, note] = hooksIn(
			section,
			'gear-cat',
			'gear-brand',
			'gear-price',
			'gear-price-out',
			'gear-stock',
			'gear-reset',
			'summary',
		);

		const makers = [...new Set(garments.map((product) => product.brand))].sort();
		for (const maker of makers) brandPick.add(new Option(maker, maker));

		const listing = tableKit(section, {
			records: garments,
			startSort: { key: 'name', dir: 'asc' },
			passes: (product) =>
				(!chosen.category || product.cat === chosen.category) &&
				(!chosen.maker || product.brand === chosen.maker) &&
				product.price <= chosen.maxPrice &&
				(!chosen.inStockOnly || product.stock > 0),
			toRow: (product) =>
				`<tr><td class="dt-strong">${safeText(product.name)}</td><td>${safeText(product.cat)}</td><td>${safeText(product.brand)}</td><td class="text-end">${stockCell(product.stock)}</td><td class="text-end dt-strong">${wholeDollars.format(product.price)}</td></tr>`,
			emptyCell: () =>
				'<div class="dt-empty"><p class="dt-empty-title">Nothing fits all of these filters</p><p class="dt-empty-text">Loosen one of them, or start again.</p><button type="button" class="btn btn-outline-secondary btn-sm" data-dt-gear-reset-empty>Reset filters</button></div>',
			onDraw: ({ kept }) => {
				const all = countOf(garments.length, 'product', 'products');
				note.textContent = kept.length === garments.length ? all : `${counting.format(kept.length)} of ${all}`;
				const narrowed = chosen.category || chosen.maker || chosen.maxPrice < CEILING || chosen.inStockOnly;
				resetButton.disabled = !narrowed;
			},
		});

		for (const input of [categoryPick, brandPick, stockSwitch]) input.addEventListener('change', readFilters);
		priceSlider.addEventListener('input', readFilters);
		resetButton.addEventListener('click', clearFilters);
		section.addEventListener('click', (event) => {
			if (event.target.closest('[data-dt-gear-reset-empty]')) clearFilters();
		});
		listing.redraw();

		function readFilters() {
			chosen.category = categoryPick.value;
			chosen.maker = brandPick.value;
			chosen.maxPrice = Number(priceSlider.value);
			chosen.inStockOnly = stockSwitch.checked;
			priceReadout.textContent = wholeDollars.format(chosen.maxPrice);
			listing.restart();
		}

		function clearFilters() {
			categoryPick.value = '';
			brandPick.value = '';
			priceSlider.value = String(CEILING);
			stockSwitch.checked = false;
			readFilters();
			categoryPick.focus();
		}
	}

	/** Sold out reads as a red pill, three or fewer as an amber count. */
	function stockCell(units) {
		if (units === 0) return toneTag('Out of stock');
		if (units > 3) return counting.format(units);
		return `<span class="basalt-status basalt-status-warning basalt-status-dot">${units} left</span>`;
	}

	/* Customer invoices: each row unfolds into its line items. */
	function mountInvoices(section) {
		/* One month of Fieldline billing per account, as
       [account, status, days until due, [item, quantity, unit price][]]. */
		const BILLING = [
			[
				'Oakhaven Studio',
				'Paid',
				-12,
				[
					['Pro plan, per seat', 24, 32],
					['Travel Planner, per seat', 24, 6],
					['SMS Credits, 1,000', 3, 25],
				],
			],
			[
				'Lakeside Apparel',
				'Due',
				6,
				[
					['Basic plan, per seat', 8, 15],
					['Customer Portal, per seat', 8, 4],
				],
			],
			[
				'Highpoint Outfitters',
				'Paid',
				-30,
				[
					['Max plan, per seat', 40, 58],
					['Customer Portal, per seat', 40, 4],
					['Live Training Session', 1, 350],
				],
			],
			[
				'Copperleaf Design',
				'Overdue',
				-4,
				[
					['Pro plan, per seat', 12, 32],
					['SMS Credits, 1,000', 2, 25],
				],
			],
			[
				'Harborline AI',
				'Due',
				14,
				[
					['Basic plan, per seat', 6, 15],
					['Onboarding Package', 1, 1250],
				],
			],
			[
				'Larchwood Studios',
				'Paid',
				-45,
				[
					['Pro plan, per seat', 18, 32],
					['Travel Planner, per seat', 18, 6],
					['Customer Portal, per seat', 18, 4],
				],
			],
		];
		const invoices = BILLING.map(([account, stage, daysLeft, items], position) => {
			const charges = items.map(([goods, qty, unit]) => ({ item: goods, qty, amount: qty * unit }));
			return {
				number: `#${4318 - position}`,
				account,
				status: stage,
				charges,
				due: daysBack(-daysLeft),
				method: position % 2 ? 'Bank transfer' : 'Card on file',
				amount: charges.reduce((sum, charge) => sum + charge.amount, 0),
			};
		});
		const [tbody, allButton] = hooksIn(section, 'body', 'expand-all');

		tbody.innerHTML = invoices.map(invoiceRows).join('');
		const expanders = [...pickAll('.dt-expander', tbody)];

		tbody.addEventListener('click', (event) => {
			const expander = event.target.closest('.dt-expander');
			if (!expander) return;
			unfold(expander, expander.getAttribute('aria-expanded') !== 'true');
			reflectAll();
		});

		allButton.addEventListener('click', () => {
			const opening = allButton.getAttribute('aria-pressed') !== 'true';
			for (const expander of expanders) unfold(expander, opening);
			reflectAll();
		});

		function unfold(expander, open) {
			const detailRow = document.getElementById(expander.getAttribute('aria-controls'));
			const spoken = expander.getAttribute('aria-label').replace(/^(Show|Hide)/, open ? 'Hide' : 'Show');
			expander.setAttribute('aria-expanded', String(open));
			expander.setAttribute('aria-label', spoken);
			window.Basalt.slide(pick('.dt-detail-box', detailRow), () => {
				detailRow.hidden = !open;
			});
			expander.closest('tr').classList.toggle('is-open', open);
		}

		function reflectAll() {
			const everyOpen = expanders.every((expander) => expander.getAttribute('aria-expanded') === 'true');
			allButton.textContent = everyOpen ? 'Collapse all' : 'Expand all';
			allButton.setAttribute('aria-pressed', String(everyOpen));
		}
	}

	/** The summary row and its hidden detail row for one invoice. */
	function invoiceRows(invoice) {
		const panelId = `dt-${invoice.number.toLowerCase()}-items`;
		const charges = invoice.charges
			.map(
				(charge) =>
					`<li><span>${safeText(charge.item)}</span><span class="dt-lines-qty">× ${charge.qty}</span><span class="dt-lines-amt">${dollars.format(charge.amount)}</span></li>`,
			)
			.join('');
		const summary = `<tr><td><button type="button" class="dt-expander" aria-expanded="false" aria-controls="${panelId}" aria-label="Show line items for ${invoice.number}"><i class="bi bi-chevron-right" aria-hidden="true"></i></button></td><td><a class="dt-link dt-mono" href="invoice-details.html">${invoice.number}</a><span class="dt-sub">${safeText(invoice.account)}</span></td><td>${timeTag(invoice.due)}</td><td>${toneTag(invoice.status)}</td><td class="text-end dt-strong">${dollars.format(invoice.amount)}</td></tr>`;
		const detail = `<tr class="dt-detail" id="${panelId}" hidden><td colspan="5"><div class="dt-detail-box"><ul class="dt-lines">${charges}</ul><p class="dt-detail-meta"><span>Billed to ${safeText(invoice.account)}</span><span>${safeText(invoice.method)}</span><span>Net 30</span></p></div></td></tr>`;
		return summary + detail;
	}

	/* Marlo stock movements: a long log under a header that stays pinned. */
	function mountStockLog(section) {
		const movements = makeMovements();
		const FIRST_FEW = 8;
		const [tbody, moreButton, note] = hooksIn(section, 'body', 'more', 'summary');
		tbody.innerHTML = movements.map(movementRow).join('');

		/* Rather than scroll inside a box, the log shows its newest rows and a
       button lets the page grow to hold the rest. */
		const logRows = [...tbody.children];
		const fitsAlready = movements.length <= FIRST_FEW;

		moreButton?.addEventListener('click', () => {
			const all = moreButton.getAttribute('aria-expanded') !== 'true';
			window.Basalt.slide(tbody.closest('table').parentElement, () => showRows(all));
		});
		showRows(false);

		function showRows(all) {
			for (const [place, row] of logRows.entries()) row.hidden = !all && place >= FIRST_FEW;
			note.textContent =
				all || fitsAlready
					? `${countOf(movements.length, 'movement', 'movements')} in the last five weeks`
					: `Latest ${FIRST_FEW} of ${movements.length} movements in the last five weeks`;
			if (!moreButton) return;
			moreButton.hidden = fitsAlready;
			moreButton.setAttribute('aria-expanded', String(all));
			moreButton.textContent = all ? 'Show fewer' : `Show all ${movements.length}`;
		}
	}

	/** Five weeks of receipts and shipments, newest first, from the seeded stream. */
	function makeMovements() {
		const ITEMS = [
			'Sculpted Shoulder Blazer',
			'Draped Column Gown',
			'Tiered Organza Dress',
			'Leather Trench Coat',
			'Bar Loafers',
			'Shield Sunglasses',
		];
		const onShelf = {};
		for (const goods of ITEMS) onShelf[goods] = 20 + Math.floor(random() * 40);

		const log = [];
		for (let back = 34; back >= 0; back -= 1) {
			if (random() < 0.15) continue;
			const goods = pickFrom(ITEMS);
			const incoming = onShelf[goods] < 12 || random() < 0.25;
			const qty = incoming ? 20 + Math.floor(random() * 20) : 1 + Math.floor(random() * 8);
			onShelf[goods] += incoming ? qty : -qty;
			log.push({ date: daysBack(back), item: goods, incoming, qty, onHand: onShelf[goods] });
		}
		return log.reverse();
	}

	function movementRow(entry) {
		const direction = entry.incoming ? 'dt-move-in' : 'dt-move-out';
		const signed = `${entry.incoming ? '+' : '−'}${entry.qty}`;
		return `<tr><td>${timeTag(entry.date)}</td><td class="dt-strong">${safeText(entry.item)}</td><td>${entry.incoming ? 'Received' : 'Shipped'}</td><td class="text-end dt-move ${direction}">${signed}</td><td class="text-end">${entry.onHand}</td></tr>`;
	}

	/* Maintenance plans: a row turns into fields to edit, and can be paused. */
	function mountPlans(section) {
		const HOLDERS = [
			'Joel Barker',
			'Pamela Malone',
			'Arthur Lane',
			'Mae Gill',
			'Curtis Boyd',
			'Lacey Hanson',
			'Frank Kerr',
			'Iva Price',
		];
		const PLANS = ['Window clean', 'Gutter clear', 'Full home clean', 'Carpet and rug care'];
		const PROPERTIES = ['Townhouse', 'Bungalow', 'Farmhouse', 'Flat'];
		const INTERVALS = ['Quarter', '6 months', 'Year'];
		const plans = HOLDERS.map((name, n) => ({
			id: n,
			name,
			email: mailAddress(name),
			plan: PLANS[n % PLANS.length],
			units: 1 + ((n * 7) % 3),
			equipment: PROPERTIES[(n * 3) % PROPERTIES.length],
			every: INTERVALS[n % INTERVALS.length],
			next: daysBack(-(2 + ((n * 5) % 16))),
			status: n === 2 || n === 6 ? 'Paused' : 'Active',
		}));
		const [tbody, note] = hooksIn(section, 'body', 'summary');
		let openId = null;

		/* Which button was pressed decides what happens to its row. */
		const ACTIONS = {
			'data-dt-edit': (contract) => {
				openId = contract.id;
				paint({ focusOn: contract.id, selector: 'select' });
				note.textContent = `Editing ${contract.name}. Enter saves, Escape cancels.`;
			},
			'data-dt-pause': (contract) => {
				const pausing = contract.status !== 'Paused';
				contract.status = pausing ? 'Paused' : 'Active';
				paint({ focusOn: contract.id, selector: '[data-dt-pause]' });
				note.textContent = `${pausing ? 'Paused' : 'Resumed'} ${contract.name}. ${tally()}`;
			},
			'data-dt-save': (_, row) => keepEdits(row),
			'data-dt-cancel': (_, row) => discard(row),
		};

		tbody.addEventListener('click', (event) => {
			const button = event.target.closest('button');
			if (!button) return;
			const row = button.closest('tr');
			const handlerName = Object.keys(ACTIONS).find((name) => button.hasAttribute(name));
			if (handlerName) ACTIONS[handlerName](planIn(row), row);
		});

		tbody.addEventListener('keydown', (event) => {
			const row = event.target.closest('tr.is-editing');
			if (!row) return;
			if (event.key === 'Escape') {
				event.preventDefault();
				discard(row);
			} else if (event.key === 'Enter' && !event.target.matches('button')) {
				event.preventDefault();
				keepEdits(row);
			}
		});

		paint({});
		note.textContent = tally();

		function planIn(row) {
			return plans[Number(row.getAttribute('data-dt-sub'))];
		}

		function tally() {
			const paused = plans.filter((contract) => contract.status === 'Paused').length;
			return `${counting.format(plans.length - paused)} active, ${counting.format(paused)} paused`;
		}

		/** Redraws every row, then optionally focuses a control and flashes a saved row. */
		function paint({ focusOn, selector, flash }) {
			tbody.innerHTML = plans
				.map((contract) => (contract.id === openId ? planEditor(contract) : planReadout(contract)))
				.join('');
			if (window.Basalt.stepper) {
				for (const stepper of pickAll('[data-basalt-stepper]', tbody)) window.Basalt.stepper(stepper);
			}
			if (focusOn != null) pick(`[data-dt-sub="${focusOn}"] ${selector}`, tbody)?.focus();
			if (flash != null) pick(`[data-dt-sub="${flash}"]`, tbody)?.classList.add('is-saved');
		}

		function keepEdits(row) {
			const contract = planIn(row);
			const readField = (name) => pick(`[name="${name}"]`, row).value;
			const typedUnits = parseInt(readField('units'), 10) || contract.units;
			const nextDay = readField('next');
			contract.plan = readField('plan');
			contract.equipment = readField('equipment');
			contract.every = readField('every');
			contract.units = Math.min(6, Math.max(1, typedUnits));
			if (nextDay) contract.next = new Date(`${nextDay}T12:00:00`);
			openId = null;
			paint({ focusOn: contract.id, selector: '[data-dt-edit]', flash: contract.id });
			note.textContent = `Saved ${contract.name}. ${tally()}`;
		}

		function discard(row) {
			openId = null;
			paint({ focusOn: Number(row.getAttribute('data-dt-sub')), selector: '[data-dt-edit]' });
			note.textContent = tally();
		}

		function choices(list, current) {
			return list
				.map((option) => `<option${option === current ? ' selected' : ''}>${safeText(option)}</option>`)
				.join('');
		}

		function planReadout(contract) {
			const paused = contract.status === 'Paused';
			const nextCell = paused
				? '<span class="dt-quiet">On hold</span>'
				: `<time datetime="${dayStamp(contract.next)}">${fullDate(contract.next)}</time>`;
			const who = safeText(contract.name);
			const toggleWord = paused ? 'Resume' : 'Pause';
			return `<tr data-dt-sub="${contract.id}"><td><span class="dt-strong">${who}</span><span class="dt-sub">${safeText(contract.email)}</span></td><td>${safeText(contract.plan)}</td><td class="text-end">${contract.units}</td><td>${safeText(contract.equipment)}</td><td>${safeText(contract.every)}</td><td>${nextCell}</td><td>${toneTag(contract.status)}</td><td class="text-end"><span class="dt-actions"><button type="button" class="btn btn-outline-secondary btn-sm" data-dt-edit aria-label="Edit ${who}">Edit</button><button type="button" class="btn btn-outline-secondary btn-sm dt-pause" data-dt-pause aria-label="${toggleWord} ${who}">${toggleWord}</button></span></td></tr>`;
		}

		function planEditor(contract) {
			const who = safeText(contract.name);
			const stepper = `<div class="basalt-stepper basalt-stepper-sm dt-num" data-basalt-stepper><button type="button" class="basalt-stepper-btn" data-basalt-step="-1" aria-label="One unit fewer for ${who}"><i class="bi bi-dash-lg" aria-hidden="true"></i></button><input class="basalt-stepper-input" type="number" name="units" min="1" max="6" value="${contract.units}" inputmode="numeric" aria-label="Units covered for ${who}"><button type="button" class="basalt-stepper-btn" data-basalt-step="1" aria-label="One unit more for ${who}"><i class="bi bi-plus-lg" aria-hidden="true"></i></button></div>`;
			return `<tr class="is-editing" data-dt-sub="${contract.id}"><td><span class="dt-strong">${who}</span><span class="dt-sub">${safeText(contract.email)}</span></td><td><select class="form-select form-select-sm" name="plan" aria-label="Plan for ${who}">${choices(PLANS, contract.plan)}</select></td><td class="text-end">${stepper}</td><td><select class="form-select form-select-sm" name="equipment" aria-label="Property for ${who}">${choices(PROPERTIES, contract.equipment)}</select></td><td><select class="form-select form-select-sm" name="every" aria-label="Visit frequency for ${who}">${choices(INTERVALS, contract.every)}</select></td><td><input class="form-control form-control-sm" type="date" name="next" value="${dayStamp(contract.next)}" aria-label="Next visit for ${who}"></td><td>${toneTag(contract.status)}</td><td class="text-end"><span class="dt-actions"><button type="button" class="btn btn-primary btn-sm" data-dt-save>Save</button><button type="button" class="btn btn-outline-secondary btn-sm" data-dt-cancel>Cancel</button></span></td></tr>`;
		}
	}

	/* Service price list: pick the columns, the row height and the stripes. */
	function mountPriceList(section) {
		const priceTable = pick('[data-dt-service-table]', section);
		const INDUSTRY_TONE = { 'Home care': 3, 'Pet care': 5, Photography: 4, Cleaning: 2, 'Property care': 1 };
		const SKILL_STEPS = { Entry: 1, Skilled: 2, Licensed: 3 };
		const offerings = [
			['Care check-in', 'Home care', 'Gloves, apron', '1 h', 'Skilled', 129],
			['Personal care visit', 'Home care', 'Gloves, care notes', '1 h 15 min', 'Licensed', 149],
			['Puppy drop-in visit', 'Pet care', 'Treats, poop bags', '45 min', 'Entry', 99],
			['Dog training', 'Pet care', 'None', '1 h', 'Skilled', 175],
			['Headshot session', 'Photography', 'Backdrop, lights', '1 h 30 min', 'Skilled', 210],
			['Passport photos', 'Photography', 'Print pack', '30 min', 'Entry', 85],
			['Deep clean, 3-bed home', 'Cleaning', 'Supplies kit', '4 h', 'Entry', 240],
			['Quarterly gutter clearing', 'Property care', 'Bags, gloves', '1 h', 'Skilled', 115],
		];
		/* [column key, menu label, always shown]. */
		const COLUMN_MENU = [
			['name', 'Service', true],
			['trade', 'Industry', false],
			['parts', 'Supplies', false],
			['time', 'Time on site', false],
			['skill', 'Skill level', false],
			['price', 'Flat rate', false],
		];
		const concealed = new Set(['parts']);
		const [tbody, columnMenu, stripeSwitch] = hooksIn(section, 'body', 'colmenu', 'stripes');

		tbody.innerHTML = offerings
			.map(([name, industry, supplies, duration, skill, price]) => {
				const pips = [1, 2, 3]
					.map((step) => `<i${step <= SKILL_STEPS[skill] ? ' class="is-on"' : ''}></i>`)
					.join('');
				return `<tr><td class="dt-strong" data-dt-col="name">${safeText(name)}</td><td data-dt-col="trade"><span class="dt-type dt-tone-${INDUSTRY_TONE[industry]}">${safeText(industry)}</span></td><td data-dt-col="parts">${safeText(supplies)}</td><td data-dt-col="time">${safeText(duration)}</td><td data-dt-col="skill"><span class="dt-meter"><span class="dt-meter-bars" aria-hidden="true">${pips}</span>${safeText(skill)}</span></td><td class="text-end" data-dt-col="price">${dollars.format(price)}</td></tr>`;
			})
			.join('');

		columnMenu.innerHTML = COLUMN_MENU.map(
			([key, menuLabel, fixed]) =>
				`<div class="form-check"><input class="form-check-input" type="checkbox" id="dt-svc-col-${key}" value="${key}"${concealed.has(key) ? '' : ' checked'}${fixed ? ' disabled' : ''}><label class="form-check-label" for="dt-svc-col-${key}">${menuLabel}</label></div>`,
		).join('');

		columnMenu.addEventListener('change', ({ target: box }) => {
			if (box.checked) concealed.delete(box.value);
			else concealed.add(box.value);
			hideConcealed();
		});

		for (const radio of pickAll('[data-dt-density]', section)) {
			radio.addEventListener('change', () => {
				priceTable.classList.toggle('table-sm', radio.checked && radio.value === 'compact');
			});
		}

		stripeSwitch.addEventListener('change', () => {
			priceTable.classList.toggle('table-striped', stripeSwitch.checked);
		});

		hideConcealed();

		function hideConcealed() {
			for (const node of pickAll('[data-dt-col]', priceTable)) {
				node.hidden = concealed.has(node.getAttribute('data-dt-col'));
			}
		}
	}

	/* Marlo sales by category: three months, row totals, shares and a footer. */
	function mountSales(section) {
		const monthStarts = [3, 2, 1].map((back) => new Date(midday.getFullYear(), midday.getMonth() - back, 1));
		/* [category, revenue per month, orders per month]. */
		const SOLD = [
			['Clothing', [31420, 34880, 38150], [58, 64, 71]],
			['Accessories', [9870, 10460, 11930], [142, 151, 168]],
			['Extras', [5180, 4620, 5940], [37, 33, 41]],
			['Services', [7400, 10150, 8600], [9, 12, 10]],
		];
		/* Each measure knows which series it reads, how it prints and its caption word. */
		const MEASURES = {
			revenue: { series: 1, print: (value) => wholeDollars.format(value), word: 'Revenue' },
			orders: { series: 2, print: (value) => counting.format(value), word: 'Orders' },
		};
		const [tbody, tfoot, caption] = hooksIn(section, 'body', 'foot', 'sales-caption');
		const shortMonth = (date) => date.toLocaleDateString('en-US', { month: 'short' });
		const sum = (figures) => figures.reduce((running, value) => running + value, 0);

		for (const heading of pickAll('[data-dt-month]', section)) {
			heading.textContent = shortMonth(monthStarts[Number(heading.getAttribute('data-dt-month'))]);
		}

		for (const radio of pickAll('[data-dt-measure]', section)) {
			radio.addEventListener('change', () => {
				if (radio.checked) showMeasure(radio.value);
			});
		}

		showMeasure('revenue');

		function showMeasure(name) {
			const { series, print, word } = MEASURES[name === 'orders' ? 'orders' : 'revenue'];
			const monthTotals = [0, 1, 2].map((month) => sum(SOLD.map((category) => category[series][month])));
			const quarter = sum(monthTotals);
			const figureCells = (figures) =>
				figures.map((value) => `<td class="text-end">${print(value)}</td>`).join('');

			tbody.innerHTML = SOLD.map((category) => {
				const figures = category[series];
				const rowTotal = sum(figures);
				const share = Math.round((rowTotal / quarter) * 100);
				return `<tr><th scope="row">${safeText(category[0])}</th>${figureCells(figures)}<td class="text-end dt-strong">${print(rowTotal)}</td><td><span class="dt-share"><span class="dt-share-bar" aria-hidden="true"><span class="dt-share-fill" style="--dt-share:${share}%"></span></span><span class="dt-share-pct">${share}%</span></span></td></tr>`;
			}).join('');
			tfoot.innerHTML = `<tr><th scope="row">Total</th>${figureCells(monthTotals)}<td class="text-end">${print(quarter)}</td><td class="text-end">100%</td></tr>`;
			caption.textContent = `${word} by category, ${shortMonth(monthStarts[0])} to ${shortMonth(monthStarts[2])}`;
		}
	}

	/**
	 * Gives one card's table searching, extra filtering, header sorting and
	 * paging. Sortable headers carry data-dt-sort="field" with a .dt-sort button.
	 *
	 * @param {Element} section  the card holding the table and its optional pager
	 * @param {object} spec
	 *   records    the plain objects to show
	 *   toRow      (record, query) => '<tr>…</tr>'
	 *   hits       (record, query) => whether the lower-cased query is found
	 *   passes     (record) => whether every other filter lets it through
	 *   startSort  { key, dir } applied before the first click
	 *   perPage    rows per page; 0 shows everything
	 *   emptyCell  (query) => markup for the single empty row
	 *   onDraw     (snapshot) => runs after each redraw
	 */
	function tableKit(section, spec) {
		const sheet = pick('table', section);
		const [tbody] = hooksIn(sheet, 'body');
		const [pagerNode] = hooksIn(section, 'pager');
		const width = sheet.tHead.rows[0].cells.length;
		const sortHeads = [...pickAll('th[data-dt-sort]', sheet)];
		const snapshot = {
			sortBy: spec.startSort || null,
			query: '',
			page: 1,
			perPage: spec.perPage || 0,
			pageCount: 1,
			kept: [],
			onPage: [],
		};

		for (const heading of sortHeads) {
			pick('.dt-sort', heading).addEventListener('click', () => {
				const key = heading.getAttribute('data-dt-sort');
				if (snapshot.sortBy?.key === key) snapshot.sortBy.dir = snapshot.sortBy.dir === 'asc' ? 'desc' : 'asc';
				else snapshot.sortBy = { key, dir: 'asc' };
				redraw();
			});
		}

		pagerNode?.addEventListener('click', (event) => {
			const pageButton = event.target.closest('[data-dt-page]');
			if (!pageButton || pageButton.disabled) return;
			snapshot.page = Number(pageButton.getAttribute('data-dt-page'));
			redraw();
			/* The pager is rebuilt, so focus returns to the page now current. */
			pick('[aria-current="page"]', pagerNode)?.focus();
		});

		return {
			snapshot,
			redraw,
			setSearch(phrase) {
				snapshot.query = String(phrase || '')
					.trim()
					.toLowerCase();
				restart();
			},
			setPageSize(size) {
				snapshot.perPage = size;
				restart();
			},
			restart,
		};

		function restart() {
			snapshot.page = 1;
			redraw();
		}

		function redraw() {
			const { query } = snapshot;
			const kept = spec.records.filter(
				(record) => (!query || spec.hits(record, query)) && (!spec.passes || spec.passes(record)),
			);
			if (snapshot.sortBy) kept.sort(byOrder);
			snapshot.kept = kept;
			snapshot.pageCount = snapshot.perPage ? Math.max(1, Math.ceil(kept.length / snapshot.perPage)) : 1;
			snapshot.page = Math.min(Math.max(1, snapshot.page), snapshot.pageCount);
			const offset = (snapshot.page - 1) * snapshot.perPage;
			snapshot.onPage = snapshot.perPage ? kept.slice(offset, offset + snapshot.perPage) : kept;

			if (snapshot.onPage.length) {
				tbody.innerHTML = snapshot.onPage.map((record) => spec.toRow(record, query)).join('');
			} else {
				const inner = spec.emptyCell
					? spec.emptyCell(query)
					: '<div class="dt-empty"><p class="dt-empty-title">Nothing to show</p></div>';
				tbody.innerHTML = `<tr class="basalt-empty-row"><td colspan="${width}">${inner}</td></tr>`;
			}
			markSortHeads();
			buildPager();
			spec.onDraw?.(snapshot);
		}

		/* Numbers and dates compare by size, everything else as words; the
       engine's sort is stable, so ties keep their source order. */
		function byOrder(left, right) {
			const { key, dir } = snapshot.sortBy;
			const a = left[key];
			const b = right[key];
			const bySize = (typeof a === 'number' && typeof b === 'number') || a instanceof Date;
			const difference = bySize
				? a - b
				: String(a).localeCompare(String(b), 'en', { sensitivity: 'base', numeric: true });
			return dir === 'desc' ? -difference : difference;
		}

		function markSortHeads() {
			const ARIA = { asc: 'ascending', desc: 'descending' };
			const ARROW = { asc: 'bi-chevron-up', desc: 'bi-chevron-down' };
			for (const heading of sortHeads) {
				const isSorted =
					Boolean(snapshot.sortBy) && heading.getAttribute('data-dt-sort') === snapshot.sortBy.key;
				const direction = isSorted && snapshot.sortBy.dir === 'asc' ? 'asc' : 'desc';
				if (isSorted) heading.setAttribute('aria-sort', ARIA[direction]);
				else heading.removeAttribute('aria-sort');
				const arrow = pick('.dt-sort-icon', heading);
				if (arrow) arrow.className = `bi dt-sort-icon ${isSorted ? ARROW[direction] : 'bi-chevron-expand'}`;
			}
		}

		function buildPager() {
			if (!pagerNode) return;
			const { page, pageCount } = snapshot;
			if (pageCount <= 1) {
				pagerNode.innerHTML = '';
				return;
			}
			const items = pageSlots(pageCount, page).map((slot) => {
				if (slot === null)
					return '<li class="page-item disabled dt-gap"><span class="page-link" aria-hidden="true">…</span></li>';
				if (slot === page)
					return `<li class="page-item active"><button type="button" class="page-link" aria-current="page" aria-label="Page ${slot}, current page" data-dt-page="${slot}">${slot}</button></li>`;
				return pagerButton(slot, `Page ${slot}`, slot, false);
			});
			const back = pagerButton(
				page - 1,
				'Previous page',
				'<i class="bi bi-chevron-left" aria-hidden="true"></i>',
				page === 1,
			);
			const ahead = pagerButton(
				page + 1,
				'Next page',
				'<i class="bi bi-chevron-right" aria-hidden="true"></i>',
				page === pageCount,
			);
			pagerNode.innerHTML = `<ul class="pagination pagination-sm">${back}${items.join('')}${ahead}</ul>`;
		}
	}

	/** First, last and the neighbors of the current page; null marks a gap. */
	function pageSlots(pageTotal, current) {
		const slots = [];
		for (let number = 1; number <= pageTotal; number += 1) {
			if (number === 1 || number === pageTotal || Math.abs(number - current) <= 1) slots.push(number);
			else if (slots[slots.length - 1] !== null) slots.push(null);
		}
		return slots;
	}

	function pagerButton(destination, label, content, off) {
		return `<li class="page-item${off ? ' disabled' : ''}"><button type="button" class="page-link" data-dt-page="${destination}" aria-label="${label}"${off ? ' disabled' : ''}>${content}</button></li>`;
	}

	/* Markup helpers shared by every grid. */

	/** The first element in scope carrying data-dt-<name>, for each name given. */
	function hooksIn(scope, ...names) {
		return names.map((name) => pick(`[data-dt-${name}]`, scope));
	}

	function safeText(value) {
		const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (character) => ENTITIES[character]);
	}

	/** Escapes the text and wraps every case-insensitive occurrence of the query in <mark>. */
	function markHits(phrase, query) {
		const raw = String(phrase);
		if (!query) return safeText(raw);
		const lowered = raw.toLowerCase();
		const pieces = [];
		let cursor = 0;
		for (let hitAt = lowered.indexOf(query); hitAt !== -1; hitAt = lowered.indexOf(query, cursor)) {
			pieces.push(
				safeText(raw.slice(cursor, hitAt)),
				`<mark class="dt-mark">${safeText(raw.slice(hitAt, hitAt + query.length))}</mark>`,
			);
			cursor = hitAt + query.length;
		}
		pieces.push(safeText(raw.slice(cursor)));
		return pieces.join('');
	}

	function toneTag(label) {
		const tone = TONE_OF[label];
		const toneClass = tone ? ` basalt-status-${tone}` : '';
		return `<span class="basalt-status basalt-status-dot${toneClass}">${safeText(label)}</span>`;
	}

	function timeTag(date) {
		return `<time datetime="${dayStamp(date)}">${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</time>`;
	}

	function fullDate(date) {
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	/** YYYY-MM-DD in local time, for datetime attributes, date inputs and CSV. */
	function dayStamp(date) {
		const twoDigits = (number) => String(number).padStart(2, '0');
		return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
	}

	/** A date that many days before today (negative counts reach forward). */
	function daysBack(days) {
		return new Date(midday.getTime() - days * DAY_MS);
	}

	function monogram(name) {
		return name
			.split(' ')
			.map((word) => word[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	function countOf(amount, singular, pluralWord) {
		return `${counting.format(amount)} ${amount === 1 ? singular : pluralWord}`;
	}

	/** first.last@domain from a display name, with accents and punctuation dropped. */
	function mailAddress(name, domain) {
		const local = name
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z ]/g, '')
			.replace(' ', '.');
		return `${local}@${domain || 'mail.com'}`;
	}

	/* The seeded stream and CSV download. */

	/** Mulberry32: a tiny deterministic generator returning floats in [0, 1). */
	function seededRandom(seed) {
		let seedState = seed;
		return () => {
			seedState |= 0;
			seedState = (seedState + 0x6d2b79f5) | 0;
			let mixed = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
			mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	function pickFrom(list) {
		return list[Math.floor(random() * list.length)];
	}

	function csvField(value) {
		const phrase = String(value ?? '');
		return /[",\n]/.test(phrase) ? `"${phrase.replace(/"/g, '""')}"` : phrase;
	}

	function saveFile(filename, contents, type = 'text/csv') {
		const href = URL.createObjectURL(new Blob([contents], { type }));
		const anchor = document.createElement('a');
		anchor.href = href;
		anchor.download = filename;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(href), 1000);
	}

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
