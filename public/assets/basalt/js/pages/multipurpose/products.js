/**
 * Products page (products.html): the Marlo catalog with price,
 * stock and the last thirty days of sales for every product.
 *
 * Group tabs, a search box, a Filters panel and a sort order narrow the
 * list, which shows as store-style photo tiles or as a table; in the
 * table products can be checked and then moved, exported or archived
 * together. A tile or row leads to the product's own page
 * (product-details.html), where it is edited. Quick view (in a tile's
 * round menu, or the row's panel icon) opens a drawer that Alt plus the
 * arrow keys step through. One dialog adds a product or makes
 * a copy of one.
 *
 * Bringing your own data: fill assets/basalt/js/data/multipurpose/catalog.js with what
 * your backend returns, in the same shape, and everything here follows.
 * `photo` is a path to the product's picture; point it at your own
 * images. The add form's submit, archiveProducts(), moveProducts() and
 * the CSV download are the places a server call would go; in the demo
 * they only change the list in memory.
 *
 * Shared parts from basalt.js: tabs, the segmented control, styled
 * selects, applied-filter chips, the drawer, and toasts with Undo.
 */
(() => {
	'use strict';

	const stage = pick('[data-prl-root]');
	if (!stage || !window.Basalt.data?.catalog || !window.Basalt.data.accounts) return;

	/* The records come from the shared catalog (window.Basalt.data.catalog),
     the same ones the Storefront, Stock Levels and Product Details pages
     read. Sales cover the thirty days to Thursday, October 8, 2026, and
     `before` the thirty days ahead of those. `buyers` lists the three
     customers who bought the most. Clothing carries `stock`, summed over
     the four warehouses; extras and services carry a `note` saying how
     they reach the customer instead. */
	const catalog = window.Basalt.data.catalog;
	const GROUP_INFO = catalog.groups;
	const WAREHOUSE_NAMES = { reno: 'Elko', columbus: 'Columbus', annarbor: 'Ann Arbor', medford: 'Bellingham' };
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const OPTIONAL_FIELDS = [
		'unit',
		'per',
		'fee',
		'madeIn',
		'warranty',
		'note',
		'state',
		'was',
		'badge',
		'hidden',
		'category',
	];
	/* Tiles come in pages of twelve; Load more adds the next twelve. */
	const PAGE_SIZE = 12;
	/* The Maker list shows this many before Show more. */
	const MAKERS_SHOWN = 6;
	const STATUS_NAMES = { active: 'Active', draft: 'Draft', archived: 'Archived' };
	/* Letter sizes in their usual order; number sizes follow, smallest first. */
	const LETTER_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
	const FACETS = ['category', 'maker', 'stock', 'status', 'size'];
	const DEMO_DAY = '2026-10-09';
	const SIGNED_IN = 'John Armstrong';

	/* Where a product stands. Clothing is in stock, low (at or under its
     reorder point) or out; extras and services are always for sale. */
	const STOCK_STATES = {
		in: { label: 'In stock', tone: 'success' },
		low: { label: 'Low stock', tone: 'warning' },
		out: { label: 'Out of stock', tone: 'danger' },
		digital: { label: 'Digital', tone: 'info' },
		bookable: { label: 'Bookable', tone: 'primary' },
	};
	const NEEDS_RESTOCK = ['low', 'out'];
	const KIND_GLYPHS = { hardware: 'bi-box-seam', addon: 'bi-puzzle', service: 'bi-calendar-check' };
	/* The small word under a tile's price: a stock problem first, then the
     listing's own badge. */
	const TILE_PILLS = { out: 'Sold out', low: 'Low stock', new: 'New', staff: 'Staff pick', limited: 'Limited' };
	const SORTERS = {
		relevant: (a, b) => Number(Boolean(b.badge)) - Number(Boolean(a.badge)) || takings(b) - takings(a),
		best: (a, b) => takings(b) - takings(a),
		'price-desc': (a, b) => b.price - a.price,
		'price-asc': (a, b) => a.price - b.price,
		changed: (a, b) => b.changed.localeCompare(a.changed),
	};

	const listing = catalog.products().map(fromCatalog);

	const view = {
		group: '',
		query: '',
		stock: new Set(),
		maker: new Set(),
		category: new Set(),
		size: new Set(),
		status: new Set(),
		min: null,
		max: null,
		moreMakers: false,
		shown: PAGE_SIZE,
		sort: 'relevant',
		layout: 'cards',
		checked: new Set(),
	};

	const drawerNode = document.getElementById('prl-drawer');
	const editorNode = document.getElementById('prl-editor');
	const editSheetForm = pick('[data-prl-form]', editorNode);
	const ui = {
		grid: pick('[data-prl-grid]', stage),
		tableWrap: pick('[data-prl-table-wrap]', stage),
		rows: pick('[data-prl-body]', stage),
		empty: pick('[data-prl-empty]', stage),
		emptyText: pick('[data-prl-empty-text]', stage),
		summary: pick('[data-prl-summary]', stage),
		search: pick('[data-prl-search]', stage),
		sort: pick('[data-prl-sort]', stage),
		applied: pick('[data-prl-applied]', stage),
		filterButton: pick('[data-prl-filter-btn]', stage),
		filterColumn: pick('#prl-filters', stage),
		clearAll: pick('[data-prl-filter-clear]', stage),
		moreWrap: pick('[data-prl-more-wrap]', stage),
		moreCount: pick('[data-prl-more-count]', stage),
		filterCount: pick('[data-prl-filter-count]', stage),
		bulkBar: pick('[data-prl-bulk]', stage),
		bulkCount: pick('[data-prl-bulk-count]', stage),
		checkAll: pick('[data-prl-check-all]', stage),
		tabs: pick('.prl-groups', stage),
		restock: pick('[data-prl-restock]', stage),
		catalogCard: pick('.prl-cat', stage),
	};

	/* What the drawer is stepping through, and where it is in that list. */
	let drawerList = [];
	let drawerIndex = 0;

	/* The filters, order and group the tiles were last drawn for; a change
     starts the tiles again from the first page. */
	let drawnFor = '';

	/* The product a Duplicate started from, or null for a blank form. */
	let template = null;

	/**
	 * Builds the chips, wires every control, draws the list once and then
	 * watches the card's width so the table can give way to cards.
	 */
	function start() {
		buildFilterChips();
		pick('[data-prl-bulk-groups]', stage).innerHTML = ['devices', 'accessories']
			.map(
				(group) =>
					`<li><button type="button" class="dropdown-item" data-prl-move="${group}">${GROUP_INFO[group].name}</button></li>`,
			)
			.join('');

		for (const radio of pickAll('input[name="prl-group"]', stage)) {
			radio.addEventListener('change', () => {
				view.group = radio.value;
				paint();
			});
		}

		for (const radio of pickAll('input[name="prl-layout"]', stage)) {
			radio.addEventListener('change', () => {
				view.layout = radio.value;
				paint();
			});
		}

		ui.search.addEventListener('input', () => {
			view.query = ui.search.value.trim();
			paint();
		});
		ui.sort.addEventListener('change', () => {
			view.sort = ui.sort.value;
			paint();
		});
		stage.addEventListener('change', onStageChange);
		stage.addEventListener('click', onStageClick);
		stage.addEventListener('auxclick', onStageMiddleClick);
		ui.bulkBar.addEventListener('click', onBulkClick);
		pick('[data-prl-add]', stage).addEventListener('click', () => showEditor());
		ui.restock.addEventListener('click', () => {
			view.stock = new Set(NEEDS_RESTOCK);
			syncFilterChips();
			paint();
			ui.filterButton.focus();
		});
		pick('[data-prl-export="all"]', stage).addEventListener('click', () => downloadCsv(listing));
		pick('[data-prl-filter-clear]', stage).addEventListener('click', clearFilters);
		pick('[data-prl-filter-done]', stage).addEventListener('click', () =>
			bootstrap.Offcanvas.getOrCreateInstance(ui.filterColumn).hide(),
		);
		stage.addEventListener('input', onPriceInput);
		pick('[data-prl-more="maker"]', stage).addEventListener('click', () => {
			view.moreMakers = !view.moreMakers;
			paintFacets();
		});
		pick('[data-prl-load]', stage).addEventListener('click', loadMore);
		pick('[data-prl-reset]', stage).addEventListener('click', () => {
			view.query = '';
			ui.search.value = '';
			view.group = '';
			pick('#prl-group-all', stage).checked = true;
			clearFilters();
			ui.search.focus();
		});

		/* A photo that fails to load is removed, leaving the tinted tile. */
		document.addEventListener(
			'error',
			(event) => {
				if (event.target instanceof HTMLImageElement && event.target.classList.contains('prl-pic-img'))
					event.target.remove();
			},
			true,
		);

		wireDrawer();
		wireEditor();
		paint();

		if (window.ResizeObserver) {
			let hadTable = tableFits();
			new ResizeObserver(() => {
				if (tableFits() === hadTable) return;
				hadTable = tableFits();
				paint();
			}).observe(ui.catalogCard);
		}
	}

	/* Small helpers used throughout. */

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

	function withCommas(value) {
		return Number(value).toLocaleString('en-US');
	}

	function dollars(value) {
		return `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function sayAloud(text) {
		window.Basalt.announce?.(text);
	}

	function counted(count, singular, plural) {
		return `${withCommas(count)} ${count === 1 ? singular : plural || `${singular}s`}`;
	}

	function shortDate(iso) {
		const [, month, dayNumber] = iso.split('-');
		return `${MONTH_ABBR[Number(month) - 1]} ${Number(dayNumber)}`;
	}

	function setSelectValue(select, value) {
		select.value = value;
		window.Basalt.select?.refresh?.(select);
	}

	/** One catalog record, reshaped to what this page reads. */
	function fromCatalog(record) {
		const product = {
			id: record.id,
			sku: record.sku,
			name: record.name,
			group: record.group,
			kind: record.kind,
			icon: record.icon,
			photo: record.photo,
			maker: record.maker,
			price: record.price,
			priceNote: record.priceNote,
			sold: record.sold,
			before: record.before,
			buyers: record.buyers,
			rating: record.rating,
			ratings: record.ratings,
			changed: record.changed,
			sizes: (record.variants ?? []).map((size) => String(size.plug || size.name)),
		};

		for (const key of OPTIONAL_FIELDS) {
			if (record[key] != null) product[key] = record[key];
		}

		if (record.stock) {
			/* The home warehouse is whichever holds the most of it. */
			const sites = Object.keys(record.stock.at);
			const home = sites.reduce(
				(best, site) => (record.stock.at[site][0] > record.stock.at[best][0] ? site : best),
				'reno',
			);
			product.stock = {
				onHand: record.totals.onHand,
				held: record.totals.held,
				reorder: record.totals.reorder,
				warehouse: WAREHOUSE_NAMES[home],
			};
			if (record.waiting) product.stock.waiting = record.waiting;
			const order = catalog.incoming().find((entry) => entry.sku === record.sku);
			if (order) product.stock.incoming = { qty: order.qty, date: shortDate(order.due), po: order.po };
		}
		return product;
	}

	/* Facts about one product, in words and in markup. */

	function takings(product) {
		return product.sold * product.price;
	}

	function priceMarkup(product) {
		if (product.per) return `${dollars(product.price)}<span class="prl-per">/member/mo</span>`;
		if (product.fee) return `${dollars(product.price)}<span class="prl-per"> + $${product.fee}/mo</span>`;
		return dollars(product.price);
	}

	/** A running sale shows the new price in red, the old one struck
	    through and the share off; otherwise the plain price. */
	function tilePrice(product) {
		if (!product.was || product.was <= product.price) return `<span>${priceMarkup(product)}</span>`;
		const off = Math.round((1 - product.price / product.was) * 100);
		return `<span class="prl-sale">${dollars(product.price)}</span><s class="prl-was"><span class="visually-hidden">was </span>${dollars(product.was)}</s><span class="prl-off">-${off}%</span>`;
	}

	function tilePill(product) {
		const state = product.kind === 'hardware' ? stockStateOf(product) : '';
		const word = TILE_PILLS[state] || TILE_PILLS[product.badge];
		return word ? `<p class="prl-card-pill"><span>${word}</span></p>` : '';
	}

	function priceWords(product) {
		if (product.per) return `${dollars(product.price)} per member a month`;
		if (product.fee) return `${dollars(product.price)} + $${product.fee} a month`;
		return dollars(product.price);
	}

	function stockStateOf(product) {
		if (product.kind === 'addon') return 'digital';
		if (product.kind === 'service') return 'bookable';
		if (product.stock.onHand === 0) return 'out';
		return product.stock.onHand <= product.stock.reorder ? 'low' : 'in';
	}

	function stockBadge(product) {
		const state = STOCK_STATES[stockStateOf(product)];
		return `<span class="basalt-status basalt-status-dot basalt-status-${state.tone}">${state.label}</span>`;
	}

	/** A few words under the badge: how many there are, or when more come. */
	function stockSummary(product) {
		if (product.kind !== 'hardware') return product.state;
		const stock = product.stock;
		if (stock.onHand !== 0) return `${withCommas(stock.onHand)} on hand`;
		return stock.incoming ? `${withCommas(stock.incoming.qty)} arrive ${stock.incoming.date}` : 'None on hand';
	}

	/* A product added in the demo has no page of its own, so its links go
     to the quick view instead. */
	function detailUrl(product) {
		return `product-details.html?sku=${encodeURIComponent(product.sku)}`;
	}

	function photoSrc(product, width, height) {
		return window.Basalt.photo(product.photo, width, height);
	}

	/* The picture is the photo over a tinted tile that carries the product's
     icon, so the tile shows when there is no photo or it fails to load. */
	function pictureInner(product, width, height) {
		const photo = product.photo
			? `<img class="prl-pic-img" src="${photoSrc(product, width, height)}" alt="" width="${width}" height="${height}" loading="lazy" decoding="async">`
			: '';
		return `<i class="bi ${product.icon}"></i>${photo}`;
	}

	function pictureTile(product, sizeClass) {
		return `<span class="prl-pic ${sizeClass} prl-tone-${GROUP_INFO[product.group].tone}" aria-hidden="true">${pictureInner(product, 120, 120)}</span>`;
	}

	/* Filtering and ordering. */

	function statusOf(product) {
		if (product.archived) return 'archived';
		return product.hidden ? 'draft' : 'active';
	}

	/**
	 * Whether a product passes the search and every filter in use. `skip`
	 * leaves one filter out, which is how each group in the filter column
	 * counts what picking one of its own values would show.
	 */
	function passesFilters(product, skip) {
		if (view.query && !window.Basalt.matchesQuery(`${product.name} ${product.sku} ${product.maker}`, view.query))
			return false;
		if (skip !== 'stock' && view.stock.size && !view.stock.has(stockStateOf(product))) return false;
		if (skip !== 'maker' && view.maker.size && !view.maker.has(product.maker)) return false;
		if (skip !== 'category' && view.category.size && !view.category.has(product.category)) return false;
		if (skip !== 'size' && view.size.size && !product.sizes.some((size) => view.size.has(size))) return false;
		if (skip !== 'price' && view.min != null && product.price < view.min) return false;
		if (skip !== 'price' && view.max != null && product.price > view.max) return false;
		/* Archived products only show when asked for. */
		if (skip !== 'status') {
			const status = statusOf(product);
			if (view.status.size ? !view.status.has(status) : status === 'archived') return false;
		}
		return true;
	}

	function visibleProducts() {
		const inGroup = (product) => !view.group || product.group === view.group;
		return listing.filter((product) => passesFilters(product) && inGroup(product)).sort(SORTERS[view.sort]);
	}

	function activeFilterCount() {
		const ticked = ['stock', ...FACETS].reduce((sum, kind) => sum + view[kind].size, 0);
		return ticked + (view.min != null || view.max != null ? 1 : 0);
	}

	/** Every value a filter group offers, in the order it lists them. */
	function facetValues(kind) {
		if (kind === 'stock') return Object.keys(STOCK_STATES);
		if (kind === 'status') return Object.keys(STATUS_NAMES);
		if (kind === 'size') return sizeOrder([...new Set(listing.flatMap((product) => product.sizes))]);
		const counts = new Map();
		for (const product of listing) counts.set(product[kind], (counts.get(product[kind]) || 0) + 1);
		return [...counts.keys()].filter(Boolean).sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
	}

	function sizeOrder(sizes) {
		const rank = (size) => {
			const letter = LETTER_SIZES.indexOf(size);
			if (letter > -1) return letter;
			const number = Number.parseFloat(size);
			return Number.isFinite(number) ? 100 + number : 1000;
		};
		return sizes.sort((a, b) => rank(a) - rank(b));
	}

	function facetLabel(kind, value) {
		if (kind === 'stock') return STOCK_STATES[value].label;
		if (kind === 'status') return STATUS_NAMES[value];
		return value;
	}

	function facetValuesOf(kind, product) {
		if (kind === 'stock') return [stockStateOf(product)];
		if (kind === 'status') return [statusOf(product)];
		if (kind === 'size') return product.sizes;
		return [product[kind]];
	}

	/** Draws the filter column's lists once; paintFacets() keeps their
	    counts and ticks in step afterwards. */
	function buildFilterChips() {
		for (const kind of FACETS) {
			pick(`[data-prl-facet="${kind}"]`, stage).innerHTML = facetValues(kind)
				.map((value, at) => facetItem(kind, value, at))
				.join('');
		}
		syncFilterChips();
	}

	function facetItem(kind, value, at) {
		const id = `prl-${kind}-${String(value)
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')}`;
		const label = safe(facetLabel(kind, value));
		const count = '<span class="prl-facet-n" data-prl-n></span>';
		if (kind === 'size')
			return `<span class="prl-size" data-prl-facet-item="${safe(value)}"><input type="checkbox" class="btn-check" id="${id}" value="${safe(value)}" data-prl-chip="size"><label class="prl-chip" for="${id}">${label}${count}</label></span>`;
		const extra = kind === 'maker' && at >= MAKERS_SHOWN ? ' prl-facet-extra' : '';
		return `<li class="prl-facet-item${extra}" data-prl-facet-item="${safe(value)}"><input type="checkbox" class="form-check-input" id="${id}" value="${safe(value)}" data-prl-chip="${kind}"><label class="prl-facet-label" for="${id}"><span>${label}</span>${count}</label></li>`;
	}

	/** Counts follow the other filters; a value that would show nothing is
	    dimmed but stays usable. */
	function paintFacets() {
		for (const kind of FACETS) {
			const pool = listing.filter((product) => passesFilters(product, kind));
			for (const item of pickAll(`[data-prl-facet="${kind}"] [data-prl-facet-item]`, stage)) {
				const value = item.getAttribute('data-prl-facet-item');
				const count = pool.filter((product) => facetValuesOf(kind, product).includes(value)).length;
				pick('[data-prl-n]', item).textContent = count;
				item.classList.toggle('is-empty', !count);
			}
		}
		const extras = pickAll('[data-prl-facet="maker"] .prl-facet-extra', stage);
		for (const item of extras) item.hidden = !view.moreMakers;
		const more = pick('[data-prl-more="maker"]', stage);
		more.hidden = !extras.length;
		more.textContent = view.moreMakers ? 'Show less' : `Show more (+${extras.length})`;
		more.setAttribute('aria-expanded', String(view.moreMakers));
		ui.clearAll.hidden = !activeFilterCount();
	}

	function syncFilterChips() {
		for (const chip of pickAll('[data-prl-chip]', stage)) {
			chip.checked = view[chip.getAttribute('data-prl-chip')].has(chip.value);
		}
		for (const box of pickAll('[data-prl-price]', stage)) {
			const value = view[box.getAttribute('data-prl-price')];
			box.value = value == null ? '' : value;
		}
	}

	function clearFilters() {
		for (const kind of ['stock', ...FACETS]) view[kind].clear();
		view.min = null;
		view.max = null;
		syncFilterChips();
		paint();
	}

	function onPriceInput(event) {
		const box = event.target.closest('[data-prl-price]');
		if (!box) return;
		const value = Number.parseFloat(box.value);
		view[box.getAttribute('data-prl-price')] = Number.isFinite(value) && value >= 0 ? value : null;
		paint();
	}

	/** Adds the next page of tiles and moves focus to the first new one. */
	function loadMore() {
		const firstNew = view.shown;
		view.shown += PAGE_SIZE;
		paint();
		pick(`.prl-card:nth-child(${firstNew + 1}) .prl-card-link`, ui.grid)?.focus();
	}

	/* Drawing the cards or the table. */

	/** Quick view opens the drawer; the expand icon goes to the full page. */
	function quickButtons(product) {
		const quick = `<button type="button" class="btn btn-icon btn-sm" data-prl-act="quick" data-id="${product.id}" aria-label="Quick view: ${safe(product.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>`;
		if (product.made) return quick;
		return `${quick}<a class="btn btn-icon btn-sm" href="${detailUrl(product)}" aria-label="Open full page: ${safe(product.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>`;
	}

	function actionMenu(product, placement) {
		return `<div class="dropdown ${placement}"><button type="button" class="btn btn-icon prl-menu-btn" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Actions for ${safe(product.name)}"><i class="bi bi-three-dots" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end"><li><button type="button" class="dropdown-item" data-prl-act="copy" data-id="${product.id}"><i class="bi bi-copy" aria-hidden="true"></i>Duplicate</button></li><li><button type="button" class="dropdown-item" data-prl-act="archive" data-id="${product.id}"><i class="bi bi-archive" aria-hidden="true"></i>Archive</button></li></ul></div>`;
	}

	/** The tile's one round button holds every action, the two view
	    actions first. */
	function tileMenu(product) {
		const views = product.made
			? `<li><button type="button" class="dropdown-item" data-prl-act="quick" data-id="${product.id}"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i>Quick view</button></li>`
			: `<li><button type="button" class="dropdown-item" data-prl-act="quick" data-id="${product.id}"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i>Quick view</button></li><li><a class="dropdown-item" href="${detailUrl(product)}"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i>Open full page</a></li>`;
		return actionMenu(product, 'prl-card-menu').replace(
			'<ul class="dropdown-menu dropdown-menu-end">',
			`<ul class="dropdown-menu dropdown-menu-end">${views}<li><hr class="dropdown-divider"></li>`,
		);
	}

	/** A portrait photo on a pale ground with one round button in its
	    corner, and under it, centered, the maker, the name and the price. */
	function cardMarkup(product) {
		const title = product.made
			? safe(product.name)
			: `<a class="prl-card-link" href="${detailUrl(product)}">${safe(product.name)}</a>`;
		const media = `<div class="prl-card-media"><div class="prl-pic prl-card-art" aria-hidden="true">${pictureInner(product, 600, 800)}</div>${tileMenu(product)}</div>`;
		const body = `<div class="prl-card-body"><p class="prl-card-maker">${safe(product.maker)}</p><h3 class="prl-card-name">${title}</h3><p class="prl-card-price">${tilePrice(product)}</p>${tilePill(product)}</div>`;
		return `<li class="prl-card prl-tone-${GROUP_INFO[product.group].tone}" data-prl-id="${product.id}">${media}${body}</li>`;
	}

	function rowMarkup(product) {
		const group = GROUP_INFO[product.group];
		const isChecked = view.checked.has(product.id);
		const title = product.made
			? `<strong>${safe(product.name)}</strong>`
			: `<a class="prl-prod-name" href="${detailUrl(product)}">${safe(product.name)}</a>`;
		const cells = [
			`<td class="prl-col-check"><input class="form-check-input" type="checkbox" aria-label="Check ${safe(product.name)}" data-prl-tick="${product.id}"${isChecked ? ' checked' : ''}></td>`,
			`<td><div class="prl-prod">${pictureTile(product, 'prl-pic-sm')}<div class="prl-prod-text">${title}<span class="prl-prod-sku prl-mono">${safe(product.sku)}</span></div></div></td>`,
			`<td class="prl-col-group"><span class="prl-group prl-tone-${group.tone}">${safe(group.name)}</span></td>`,
			`<td class="prl-col-num"><span class="prl-num">${priceMarkup(product)}</span></td>`,
			`<td class="prl-col-stock">${stockBadge(product)}<span class="prl-sub">${safe(stockSummary(product))}</span></td>`,
			`<td class="prl-col-num"><span class="prl-num">${withCommas(product.sold)}</span><span class="prl-sub">${dollars(takings(product))}</span></td>`,
			`<td class="prl-col-menu"><span class="basalt-row-actions">${quickButtons(product)}${actionMenu(product, 'prl-row-menu')}</span></td>`,
		];
		return `<tr class="prl-row${isChecked ? ' is-selected' : ''}" data-prl-id="${product.id}">${cells.join('')}</tr>`;
	}

	/* Under 760px only the cards are shown; products.css agrees. */
	function tableFits() {
		return view.layout === 'table' && ui.catalogCard.clientWidth >= 760;
	}

	function emptyMessage() {
		const where = view.group ? ` in ${GROUP_INFO[view.group].name}` : '';
		if (!view.query) return `Nothing${where} matches these filters.`;
		return `Nothing${where} matches “${view.query}”${activeFilterCount() ? ' with these filters' : ''}. Try another spelling.`;
	}

	function paint() {
		const list = visibleProducts();
		const asCards = !tableFits();
		const key = [
			view.group,
			view.query,
			view.sort,
			view.min,
			view.max,
			...['stock', ...FACETS].map((kind) => [...view[kind]].join()),
		].join('|');
		if (key !== drawnFor) view.shown = PAGE_SIZE;
		drawnFor = key;
		ui.grid.hidden = !asCards || !list.length;
		ui.tableWrap.hidden = asCards || !list.length;
		ui.empty.hidden = list.length > 0;
		if (asCards) ui.grid.innerHTML = list.slice(0, view.shown).map(cardMarkup).join('');
		else ui.rows.innerHTML = list.map(rowMarkup).join('');
		ui.moreWrap.hidden = !asCards || list.length <= view.shown;
		ui.moreCount.textContent = `Showing ${Math.min(view.shown, list.length)} of ${list.length}`;
		window.Basalt.tips?.(asCards ? ui.grid : ui.rows);
		if (!list.length) ui.emptyText.textContent = emptyMessage();

		const matching = listing.filter(passesFilters);
		for (const counter of pickAll('[data-prl-count]', stage)) {
			const group = counter.getAttribute('data-prl-count');
			counter.textContent = group
				? matching.filter((product) => product.group === group).length
				: matching.length;
		}

		ui.tabs.basaltTabs?.refresh();
		const live = listing.filter((product) => !product.archived).length;
		ui.summary.textContent =
			list.length === live ? counted(live, 'result') : `${list.length} of ${counted(live, 'result')}`;

		paintFacets();

		paintRestock();
		paintApplied();
		syncChecks(list);
	}

	/* The restock shortcut shows while some clothing is low or out and that
     filter is not already the one in use. */
	function paintRestock() {
		const needing = listing.filter(
			(product) => !product.archived && NEEDS_RESTOCK.includes(stockStateOf(product)),
		).length;
		const alreadyOn =
			view.stock.size === NEEDS_RESTOCK.length && NEEDS_RESTOCK.every((state) => view.stock.has(state));
		ui.restock.hidden = !needing || alreadyOn;
		pick('[data-prl-restock-text]', ui.restock).textContent = `${needing} need restock`;
	}

	function paintApplied() {
		const total = activeFilterCount();
		ui.filterCount.hidden = !total;
		ui.filterCount.textContent = total;
		ui.filterButton.classList.toggle('is-on', total > 0);
		const chips = [];

		for (const state of view.stock) {
			chips.push({
				label: STOCK_STATES[state].label,
				remove: () => {
					view.stock.delete(state);
					syncFilterChips();
					paint();
				},
			});
		}

		for (const kind of ['maker', 'category', 'size', 'status']) {
			for (const value of view[kind]) {
				chips.push({
					label: kind === 'size' ? `Size ${value}` : facetLabel(kind, value),
					remove: () => {
						view[kind].delete(value);
						syncFilterChips();
						paint();
					},
				});
			}
		}

		if (view.min != null || view.max != null) {
			const low = view.min != null ? dollars(view.min) : '$0';
			chips.push({
				label: view.max != null ? `${low} to ${dollars(view.max)}` : `${low} and up`,
				remove: () => {
					view.min = null;
					view.max = null;
					syncFilterChips();
					paint();
				},
			});
		}

		window.Basalt.drawer?.applied(ui.applied, chips, clearFilters, ui.filterButton);
	}

	/** Checks only live in the table, and only on rows still shown. */
	function syncChecks(list) {
		const visibleIds = (list || visibleProducts()).map((product) => product.id);

		for (const id of [...view.checked]) {
			if (!visibleIds.includes(id) || !tableFits()) view.checked.delete(id);
		}

		const total = view.checked.size;
		ui.bulkBar.hidden = total === 0;
		ui.bulkCount.textContent = `${total} checked`;
		ui.checkAll.checked = total > 0 && total === visibleIds.length;
		ui.checkAll.indeterminate = total > 0 && total < visibleIds.length;

		for (const row of pickAll('.prl-row', stage)) {
			const on = view.checked.has(row.getAttribute('data-prl-id'));
			row.classList.toggle('is-selected', on);
			const box = pick('[data-prl-tick]', row);
			if (box) box.checked = on;
		}
	}

	/* Page-level events. */

	/** Adds to or drops from a Set, following a checkbox. */
	function follow(set, box, value) {
		if (box.checked) set.add(value);
		else set.delete(value);
	}

	function onStageChange(event) {
		const chip = event.target.closest('[data-prl-chip]');
		if (chip) {
			follow(view[chip.getAttribute('data-prl-chip')], chip, chip.value);
			paint();
			return;
		}
		const tick = event.target.closest('[data-prl-tick]');
		if (tick) {
			follow(view.checked, tick, tick.getAttribute('data-prl-tick'));
			syncChecks();
			return;
		}
		if (event.target !== ui.checkAll) return;
		for (const product of visibleProducts()) {
			follow(view.checked, ui.checkAll, product.id);
		}
		syncChecks();
	}

	/* A click on a card or row away from its controls goes where the name
     goes: the product's page, in a new tab with Cmd, Ctrl or Shift. A
     product added in the demo has no page, so it opens the quick view. */
	function onStageClick(event) {
		const action = event.target.closest('[data-prl-act]');
		if (action) {
			const id = action.getAttribute('data-id');
			const verb = action.getAttribute('data-prl-act');
			if (verb === 'archive') archiveProducts([id]);
			else if (verb === 'quick') openQuickView(id);
			else showEditor(id);
			return;
		}
		const item = itemUnder(event);
		if (!item) return;
		const href = itemHref(item);
		if (!href) openQuickView(item.getAttribute('data-prl-id'));
		else if (event.metaKey || event.ctrlKey || event.shiftKey) window.open(href, '_blank');
		else location.href = href;
	}

	function onStageMiddleClick(event) {
		const item = event.button === 1 && itemUnder(event);
		const href = item && itemHref(item);
		if (href) window.open(href, '_blank');
	}

	function itemUnder(event) {
		if (event.target.closest('a, button, input, label, .dropdown-menu')) return null;
		return event.target.closest('.prl-card, .prl-row');
	}

	function itemHref(item) {
		return pick('a.prl-card-link, a.prl-prod-name', item)?.href ?? '';
	}

	function onBulkClick(event) {
		const move = event.target.closest('[data-prl-move]');
		if (move) {
			moveProducts([...view.checked], move.getAttribute('data-prl-move'));
			return;
		}
		const button = event.target.closest('[data-prl-bulk]');
		if (!button) return;
		const verb = button.getAttribute('data-prl-bulk');
		if (verb === 'clear') {
			view.checked.clear();
			syncChecks();
			ui.checkAll.focus();
		} else if (verb === 'export') {
			downloadCsv(listing.filter((product) => view.checked.has(product.id)));
		} else if (verb === 'archive') {
			archiveProducts([...view.checked]);
		}
	}

	/* The quick view drawer. */

	function slot(key) {
		return pick(`[data-prl-d="${key}"]`, drawerNode);
	}

	function wireDrawer() {
		for (const arrow of pickAll('[data-prl-step]', drawerNode)) {
			arrow.addEventListener('click', () => {
				const step = Number(arrow.getAttribute('data-prl-step'));
				showAt(drawerIndex + step, step);
			});
		}

		drawerNode.addEventListener('keydown', (event) => {
			if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
			event.preventDefault();
			const step = event.key === 'ArrowUp' ? -1 : 1;
			showAt(drawerIndex + step, step);
		});
		drawerNode.addEventListener('shown.bs.offcanvas', () => slot('name').focus());
		/* Closing returns focus to the product last shown, so keyboard users
       pick up where they were in the list. */
		drawerNode.addEventListener('hidden.bs.offcanvas', () => {
			const product = drawerList[drawerIndex];
			const target =
				product &&
				pick(
					`[data-prl-id="${product.id}"] .prl-card-link, [data-prl-id="${product.id}"] .prl-prod-name`,
					stage,
				);
			if (target && (document.activeElement === document.body || drawerNode.contains(document.activeElement)))
				target.focus({ preventScroll: true });
		});
	}

	function stockParagraph(product) {
		if (product.kind !== 'hardware') return safe(product.note);
		const stock = product.stock;
		const incoming = stock.incoming
			? ` <a class="prl-link" href="purchase-orders.html">${safe(stock.incoming.po)}</a> brings ${withCommas(stock.incoming.qty)} more on ${safe(stock.incoming.date)}.`
			: '';
		if (stock.onHand === 0) {
			const waiting = stock.waiting
				? `, and ${counted(stock.waiting, 'unit')} are waiting on customer orders.`
				: '.';
			return `None on hand at ${safe(stock.warehouse)}${waiting}${incoming}`;
		}
		if (stock.onHand <= stock.reorder)
			return `${withCommas(stock.onHand)} on hand at ${safe(stock.warehouse)}, under the reorder point of ${withCommas(stock.reorder)}.${incoming}`;
		return `${withCommas(stock.onHand)} on hand at ${safe(stock.warehouse)}, ${withCommas(stock.held)} of them held for open orders. Reorders at ${withCommas(stock.reorder)}.`;
	}

	function salesParagraph(product) {
		if (!product.sold) return `Nothing sold yet. It went on sale on ${shortDate(product.changed)}.`;
		const shift = product.before ? Math.round(((product.sold - product.before) / product.before) * 100) : 0;
		const trend = shift === 0 ? 'the same as' : `${shift > 0 ? 'up ' : 'down '}${Math.abs(shift)}% on`;
		const byUnit = {
			seats: () => `${counted(product.sold, 'new member')}, worth ${dollars(takings(product))} a month`,
			packs: () => `${counted(product.sold, 'gift card')} sold for ${dollars(takings(product))}`,
			booked: () => `${counted(product.sold, 'booking')} for ${dollars(takings(product))}`,
		};
		const what = byUnit[product.unit]
			? byUnit[product.unit]()
			: `${withCommas(product.sold)} sold for ${dollars(takings(product))}`;
		return `${what}, ${trend} the 30 days before.`;
	}

	function buyersMarkup(product) {
		if (!product.buyers.length) return '';
		const top = product.buyers[0][1];
		const bars = product.buyers.map(
			([name, qty]) =>
				`<li class="prl-bars-row"><a class="prl-bars-name" href="shoppers.html">${safe(name)}</a><span class="prl-bars-track" aria-hidden="true"><span class="prl-bars-fill prl-tone-${GROUP_INFO[product.group].tone}" style="width:${Math.max(6, Math.round((qty / top) * 100))}%"></span></span><span class="prl-bars-value">${withCommas(qty)}</span></li>`,
		);
		return `<p class="prl-d-label" id="prl-buyers-label">Biggest buyers</p><ol class="prl-bars" aria-labelledby="prl-buyers-label">${bars.join('')}</ol>`;
	}

	function drawerSections(product) {
		const facts = [['Maker', safe(product.maker)]];
		if (product.madeIn) facts.push(['Made in', safe(product.madeIn)]);
		if (product.warranty) facts.push(['Free repairs', safe(product.warranty)]);
		facts.push([
			'Ratings',
			product.ratings
				? `<a class="prl-link" href="reviews.html">${product.rating.toFixed(1)} from ${counted(product.ratings, 'rating')}</a>`
				: 'None yet',
		]);
		facts.push(['Last changed', `${safe(shortDate(product.changed))} by ${safe(product.changedBy || SIGNED_IN)}`]);
		const note = product.priceNote.charAt(0).toUpperCase() + product.priceNote.slice(1);
		const sections = [
			`<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">Stock</h3><p class="prl-d-pill">${stockBadge(product)}</p><p class="prl-d-text">${stockParagraph(product)}</p></section>`,
			`<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">Price</h3><p class="prl-d-price">${priceMarkup(product)}</p><p class="prl-d-text">${safe(note)} <a class="prl-link" href="price-list.html">Price list</a></p></section>`,
			`<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">Last 30 days</h3><p class="prl-d-text">${safe(salesParagraph(product))}</p>${buyersMarkup(product)}</section>`,
			`<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">Details</h3><dl class="prl-facts">${facts.map(([term, value]) => `<div class="prl-facts-row"><dt>${term}</dt><dd>${value}</dd></div>`).join('')}</dl></section>`,
		];
		return sections.join('');
	}

	/** Close, plus a restock link when the product is low or out. The full
      page is the solid button under the name. */
	function drawerButtons(product) {
		const restock = NEEDS_RESTOCK.includes(stockStateOf(product))
			? '<a class="btn btn-outline-secondary" href="purchase-orders.html"><i class="bi bi-truck me-1" aria-hidden="true"></i>Restock</a>'
			: '';
		return `<button type="button" class="btn btn-outline-secondary me-auto" data-bs-dismiss="offcanvas">Close</button>${restock}`;
	}

	function showAt(index, step) {
		drawerIndex = (index + drawerList.length) % drawerList.length;
		const product = drawerList[drawerIndex];
		const tile = slot('pic');
		tile.className = `prl-pic prl-pic-lg prl-tone-${GROUP_INFO[product.group].tone}`;
		tile.innerHTML = pictureInner(product, 120, 120);
		slot('name').textContent = product.name;
		slot('sub').textContent = `${product.sku} · ${GROUP_INFO[product.group].name}`;
		slot('full').href = detailUrl(product);
		slot('full').hidden = Boolean(product.made);
		slot('pos').textContent = `${drawerIndex + 1} of ${drawerList.length}`;
		slot('body').innerHTML = drawerSections(product);
		slot('foot').innerHTML = drawerButtons(product);
		drawerNode.classList.toggle('is-back', step < 0);
		if (!step) return;
		/* Restarting the animation makes each section slide in again. */
		for (const section of pickAll(':scope > *', slot('body'))) {
			section.style.animation = 'none';
			void section.offsetWidth;
			section.style.animation = '';
		}
	}

	function openQuickView(id) {
		drawerList = visibleProducts();
		const index = drawerList.findIndex((product) => product.id === id);
		if (index < 0) return;
		showAt(index, 0);
		bootstrap.Offcanvas.getOrCreateInstance(drawerNode).show();
	}

	/* The add-or-duplicate dialog. Editing happens on the product's page. */

	function field(key) {
		return pick(`[data-prl-f="${key}"]`, editSheetForm);
	}

	function editorSlot(key) {
		return pick(`[data-prl-e="${key}"]`, editorNode);
	}

	function chosenKind() {
		return pick('input[name="plKind"]:checked', editSheetForm).value;
	}

	function wireEditor() {
		for (const radio of pickAll('input[name="plKind"]', editSheetForm)) {
			radio.addEventListener('change', applyKind);
		}

		editorNode.addEventListener('shown.bs.modal', () => field('name').focus());
		field('sku').addEventListener('input', () => {
			const sku = field('sku');
			const caret = sku.selectionStart;
			sku.value = sku.value.toUpperCase();
			sku.setSelectionRange(caret, caret);
		});
		editSheetForm.addEventListener('submit', onEditorSubmit);
	}

	/** Shows the fields that belong to the chosen kind and swaps the icon. */
	function applyKind() {
		const kind = chosenKind();

		for (const block of pickAll('[data-prl-only]', editSheetForm)) {
			block.hidden = block.getAttribute('data-prl-only') !== kind;
		}

		pick('[data-prl-per]', editSheetForm).hidden = kind !== 'addon';
		editorSlot('icon').className = `bi ${KIND_GLYPHS[kind]}`;
	}

	/** With an id the dialog opens as a copy of that product. */
	function showEditor(id) {
		const source = id ? listing.find((product) => product.id === id) : null;
		template = source;
		editSheetForm.reset();
		editSheetForm.classList.remove('was-validated');

		for (const control of pickAll('.is-invalid', editSheetForm)) {
			control.classList.remove('is-invalid');
		}

		const kind = source ? source.kind : 'hardware';
		pick(`input[name="plKind"][value="${kind}"]`, editSheetForm).checked = true;
		if (source) {
			field('name').value = `${source.name} (copy)`;
			field('price').value = source.price;
			if (source.kind === 'hardware') {
				pick(`input[name="plGroup"][value="${source.group}"]`, editSheetForm).checked = true;
				setSelectValue(field('maker'), source.maker);
				setSelectValue(field('warehouse'), source.stock.warehouse);
				field('reorder').value = source.stock.reorder;
			}
		} else {
			setSelectValue(field('maker'), 'Marlo');
			setSelectValue(field('warehouse'), 'Elko');
		}
		editorSlot('title').textContent = source ? 'Duplicate product' : 'Add product';
		editorSlot('sub').textContent = source
			? `A new product with ${source.name}’s details. Give it its own SKU.`
			: 'It shows in the store as soon as you save.';
		applyKind();
		bootstrap.Modal.getOrCreateInstance(editorNode).show();
	}

	function checkForm() {
		const failed = [];
		function judge(control, ok) {
			control.classList.toggle('is-invalid', !ok);
			if (!ok) failed.push(control);
		}

		judge(field('name'), field('name').value.trim().length > 0);
		const sku = field('sku').value.trim();
		const taken = listing.some((product) => product.sku === sku);
		pick('[data-prl-sku-error]', editSheetForm).textContent = !sku
			? 'Enter a SKU.'
			: taken
				? `${sku} is already used by another product.`
				: 'Use capitals, numbers and dashes only.';
		judge(field('sku'), Boolean(sku) && !taken && /^[A-Z0-9-]{2,12}$/.test(sku));
		const price = parseFloat(field('price').value);
		judge(field('price'), price > 0 && price <= 100000);
		if (chosenKind() === 'hardware') {
			const onHand = field('stock').value;
			judge(field('stock'), onHand !== '' && Number(onHand) >= 0 && Number.isInteger(Number(onHand)));
		} else {
			field('stock').classList.remove('is-invalid');
		}
		failed[0]?.focus();
		return !failed.length;
	}

	function onEditorSubmit(event) {
		event.preventDefault();
		if (!checkForm()) return;
		const kind = chosenKind();
		const groups = { addon: 'addons', service: 'services' };
		const typed = {
			name: field('name').value.trim(),
			sku: field('sku').value.trim(),
			price: Math.round(parseFloat(field('price').value) * 100) / 100,
			group: groups[kind] ?? pick('input[name="plGroup"]:checked', editSheetForm).value,
			changed: DEMO_DAY,
			changedBy: SIGNED_IN,
		};
		if (kind === 'hardware') {
			typed.maker = field('maker').value;
			typed.stock = {
				onHand: Number(field('stock').value),
				held: 0,
				reorder: Number(field('reorder').value) || 0,
				warehouse: field('warehouse').value,
			};
		}
		/* A copy keeps the original's picture and wording; a new product
       starts with its kind's icon and no sales. */
		const like = template && template.kind === kind ? template : null;
		const priceNotes = {
			addon: 'per member each month, billed to the card.',
			service: 'per booking.',
			hardware: 'each, before tax.',
		};
		const product = {
			id: `p-${Date.now()}`,
			made: true,
			kind,
			unit: kind === 'addon' ? 'seats' : kind === 'service' ? 'booked' : null,
			per: kind === 'addon',
			icon: like ? like.icon : KIND_GLYPHS[kind],
			photo: like ? like.photo : null,
			maker: 'Marlo',
			madeIn: like ? like.madeIn : null,
			warranty: like ? like.warranty : null,
			sold: 0,
			before: 0,
			buyers: [],
			rating: 0,
			ratings: 0,
			priceNote: like ? like.priceNote : priceNotes[kind],
			note:
				kind === 'addon'
					? 'Joined online and billed each month, so there is nothing to stock.'
					: 'Booked with the Marlo team.',
			state: kind === 'addon' ? 'No members yet' : 'Not booked yet',
			...typed,
		};
		listing.unshift(product);
		bootstrap.Modal.getInstance(editorNode).hide();
		view.group = '';
		pick('#prl-group-all', stage).checked = true;
		view.sort = 'changed';
		setSelectValue(ui.sort, 'changed');
		paint();
		pick(`[data-prl-id="${product.id}"]`, stage)?.classList.add('is-fresh');
		notify({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: `${product.name} added`,
			text: `It is on sale now at ${priceWords(product)}.`,
		});
		sayAloud(`${product.name} added.`);
	}

	/* Archive, move and export. */

	/* Archiving keeps the product in the list with an Archived status, so
	   the Status filter can still find it and Undo puts it straight back. */
	function archiveProducts(ids) {
		const archived = listing.filter((product) => ids.includes(product.id) && !product.archived);

		for (const product of archived) product.archived = true;

		view.checked.clear();
		paint();
		notify({
			tone: 'success',
			icon: 'bi-archive',
			title:
				archived.length === 1
					? `${archived[0].name} archived`
					: `${counted(archived.length, 'product')} archived`,
			text: 'Hidden from the store. Past orders keep them.',
			duration: 8000,
			actions: [
				{
					label: 'Undo',
					onClick() {
						for (const product of archived) product.archived = false;

						paint();
						sayAloud('Put back.');
					},
				},
			],
		});
	}

	function moveProducts(ids, group) {
		const moved = listing.filter((product) => ids.includes(product.id) && product.kind === 'hardware');

		for (const product of moved) {
			product.group = group;
			product.changed = DEMO_DAY;
			product.changedBy = SIGNED_IN;
		}

		const leftBehind = ids.length - moved.length;
		view.checked.clear();
		paint();
		notify({
			tone: 'success',
			icon: 'bi-folder2',
			title: `${counted(moved.length, 'product')} moved to ${GROUP_INFO[group].name}`,
			text: leftBehind
				? `${counted(leftBehind, 'extra or service', 'extras and services')} stayed where they are.`
				: '',
		});
	}

	function downloadCsv(list) {
		const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
		const billing = (product) =>
			product.per ? 'per member a month' : product.fee ? `plus $${product.fee} a month` : 'one-off';
		const header = ['SKU', 'Name', 'Group', 'Maker', 'Price', 'Billing', 'Stock', 'On hand', 'Sold in 30 days'];
		const rows = list.map((product) => [
			product.sku,
			product.name,
			GROUP_INFO[product.group].name,
			product.maker,
			product.price.toFixed(2),
			billing(product),
			STOCK_STATES[stockStateOf(product)].label,
			product.stock ? product.stock.onHand : '',
			product.sold,
		]);
		const text = [header, ...rows].map((row) => row.map(quote).join(',')).join('\r\n');
		const file = new Blob([text], { type: 'text/csv' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(file);
		link.download = `marlo-products-${DEMO_DAY}.csv`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000);
		notify({
			tone: 'success',
			icon: 'bi-download',
			title: 'Export ready',
			text: `${counted(list.length, 'product')}, saved as a CSV file.`,
		});
	}

	start();
})();
