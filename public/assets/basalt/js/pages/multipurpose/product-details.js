/**
 * Product Details (product-details.html): a single Marlo product laid out
 * card by card. The store listing, sales, stock per location, sizes,
 * ratings, sales channels, recent orders and a change log all sit on one
 * page, and each card edits in place: Edit opens its form, Save or Cancel
 * closes it, and the switches apply at once with an Undo in the toast.
 *
 * The address picks the product (?sku=ML-BLAZ). Product links on Products,
 * Storefront, Stock Levels, Purchase Orders and E-Commerce all carry one;
 * a missing or unknown SKU falls back to the Sculpted Shoulder Blazer.
 *
 * Records come from window.Basalt.data.catalog (assets/basalt/js/data/multipurpose/catalog.js)
 * and orders from window.Basalt.shopBook, which keeps every figure in step
 * with the rest of the shop. Swap in your own data by returning the same
 * shapes from both. The submit and switch handlers are the place to call a
 * server; this demo only edits the in-memory record. Styled selects and
 * toasts come from basalt.js.
 */
(() => {
	'use strict';

	const page = pick('[data-pd-root]');
	const shelf = window.Basalt.data?.catalog;
	const ledger = window.Basalt.shopBook;
	if (!page || !shelf || !ledger) return;

	/* Sales run to Thursday, October 8, 2026, in six windows of five days
     whose units add up to the catalog's 30-day total. Photo entries are
     image paths (see photoSource), a location's tone is its chart color on
     Stock Levels, and a size's plug is the letter on its tile. */
	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const SALE_WINDOWS = ['Sep 9–13', 'Sep 14–18', 'Sep 19–23', 'Sep 24–28', 'Sep 29–Oct 3', 'Oct 4–8'];
	const CHART_DAYS = 30;
	const CHART_END = new Date(2026, 9, 8);
	const CHART_FONT = "'Schibsted Grotesk', sans-serif";
	const PHOTO_LIMIT = 6;
	const FALLBACK_SKU = 'ML-BLAZ';

	/* Whoever is signed in gets the credit for edits made on this page. */
	const EDITOR = 'John Armstrong';

	const BADGE_LOOK = {
		new: ['New', 'info'],
		staff: ['Staff pick', 'primary'],
		limited: ['Limited stock', 'warning'],
	};
	const ORDER_LOOK = {
		placed: ['Awaiting payment', 'warning'],
		paid: ['Paid', 'info'],
		picking: ['Being packed', 'warning'],
		dispatched: ['Shipped', 'primary'],
		delivered: ['Delivered', 'success'],
	};
	const SALE_END_NAMES = { '2026-10-18': 'Oct 18', '2026-10-31': 'Oct 31', '2026-11-30': 'Nov 30' };
	const CHANNEL_NAMES = { listed: 'the store', front: 'the front page', partner: 'the stockist catalog' };

	/* Clicks anywhere on the page are routed by the hook they land on. */
	const CLICK_ROUTES = [
		['[data-pd-show]', showPhoto],
		['[data-pd-edit]', (hit) => showEditor(hit.dataset.pdEdit)],
		['[data-pd-cancel]', (hit) => closeEditor(hit.dataset.pdCancel)],
		['[data-pd-copy-link]', copyPageLink],
		['[data-pd-duplicate]', duplicateProduct],
		['[data-pd-archive]', archiveProduct],
	];

	const source = shelf.find(new URLSearchParams(location.search).get('sku')) || shelf.find(FALLBACK_SKU);
	const item = describeProduct(source);

	const forms = {
		listing: pick('[data-pd-form="listing"]', page),
		stock: pick('[data-pd-form="stock"]', page),
		variants: pick('[data-pd-form="variants"]', page),
	};
	const copyBox = listingField('desc');
	const saleEndsRow = pick('[data-pd-sale-ends]', forms.listing);
	const photoPicker = pick('[data-pd-photo-file]', forms.listing);

	let photoIndex = 0;
	let isArchived = false;
	let sizesEditing = false;
	let openSection = null;
	let photoDraft = [];
	let revenueChart = null;

	start();

	/** Binds every listener in the order the page reads, then paints it. */
	function start() {
		page.addEventListener('error', dropBrokenPhoto, true);
		page.addEventListener('click', onPageClick);
		document.addEventListener('basalt:appearance', () => {
			if (revenueChart) paintRevenueChart();
		});
		page.addEventListener('keydown', onEscape);

		wireListingForm();
		forms.stock.addEventListener('submit', saveReorderPoints);
		forms.variants.addEventListener('input', rememberTyping);
		forms.variants.addEventListener('click', onSizesClick);
		forms.variants.addEventListener('submit', saveSizes);
		forms.variants.addEventListener('change', toggleSize);
		page.addEventListener('change', toggleChannel);
		/* The arrow keys step through the rail, wrapping at either end. */
		slot('thumbs').addEventListener('keydown', (event) => {
			const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[event.key];
			if (!step) return;
			event.preventDefault();
			const count = item.gallery.length;
			photoIndex = (photoIndex + step + count) % count;
			paintListing();
			pick(`[data-pd-show="${photoIndex}"]`, slot('thumbs'))?.focus();
		});

		paintEverything();
	}

	function paintEverything() {
		paintHeader();
		paintListing();
		paintSales();
		paintStock();
		paintSizes();
		paintRatings();
		paintChannels();
		paintOrders();
		paintHistory();
	}

	function onPageClick(event) {
		for (const [hook, act] of CLICK_ROUTES) {
			const hit = event.target.closest(hook);
			if (hit) {
				act(hit);
				return;
			}
		}
	}

	/* The catalog entry becomes one plain record, built once on load. */

	/**
	 * Turns a catalog entry into the record this page reads and edits.
	 * @param {object} entry  a catalog.find() result
	 */
	function describeProduct(entry) {
		const shipsGoods = entry.kind === 'hardware';
		const orders = ledger.ORDERS.filter(
			(order) => order.status !== 'canceled' && order.lines.some((line) => line.sku === entry.sku),
		);
		const windows = splitSales(entry.sold, entry.sku);
		const delivery = shelf.incoming().find((po) => po.sku === entry.sku);
		const warranty = entry.warranty ? entry.warranty.replace(/^(\d+) (year|month)s?$/, '$1-$2 repairs') : '';
		const [lead, ...points] = entry.desc;
		const bullets = points.length ? `<ul>${points.map((point) => `<li>${point}</li>`).join('')}</ul>` : '';
		const unitsIn = (order) => order.lines.find((line) => line.sku === entry.sku).qty;

		return {
			sku: entry.sku,
			name: entry.name,
			group: shelf.groups[entry.group].name,
			kind: entry.kind,
			maker: entry.maker,
			madeIn: entry.madeIn,
			warranty,
			icon: entry.icon,
			gallery: [entry.photo, ...(entry.photos || [])],
			copyHtml: `<p>${lead}</p>${bullets}`,
			listPrice: entry.was || entry.price,
			salePrice: entry.was ? entry.price : null,
			saleEnds: entry.ends || '',
			badge: entry.badge,
			listed: !entry.hidden,
			frontSpot: shelf.front.indexOf(entry.sku) + 1,
			stockists: entry.kind !== 'service',
			category: entry.category,
			note: entry.note || '',
			state: entry.state || '',
			priceNote: priceNoteFor(entry),
			unit: unitFor(entry),
			rating: entry.rating,
			stars: entry.stars,
			review: {
				title: entry.review.title,
				who: entry.review.who,
				account: accountId(entry.review.who),
				date: shortDate(entry.review.date),
				body: entry.review.body,
			},
			sales: { before: entry.before, windows: SALE_WINDOWS.map((label, at) => [label, windows[at]]) },
			locations: shipsGoods
				? shelf.sites.map((site) => {
						const [onHand, held, reorder] = entry.stock.at[site.id];
						return { name: site.name, region: site.region, tone: site.tone, onHand, held, reorder };
					})
				: [],
			incoming: delivery
				? {
						po: delivery.po,
						qty: delivery.qty,
						site: locationName(delivery.site),
						date: shortDate(delivery.due),
					}
				: null,
			noun: { 'ML-GOWN': 'gown', 'ML-LOAF': 'loafer', 'ML-OXFD': 'oxford' }[entry.sku] || 'blazer',
			variants: entry.variants,
			orders: orders.slice(0, 3).map((order) => ({
				no: order.orderNumber,
				customer: order.customer,
				account: accountId(order.customer),
				qty: unitsIn(order),
				date: shortDate(order.date),
				status: order.status,
			})),
			events: pastEvents(entry, shipsGoods, orders, unitsIn),
		};
	}

	function priceNoteFor(entry) {
		if (entry.per) return 'Per member a month';
		return entry.fee ? `Plus $${entry.fee} a month` : 'Before tax';
	}

	function unitFor(entry) {
		if (entry.per) return 'members';
		return { packs: 'cards', booked: 'bookings' }[entry.unit] || 'units';
	}

	/**
	 * Shares a 30-day unit count across the six sale windows. The split is
	 * seeded by SKU, so it comes out the same on every load; whole units left
	 * over go to the windows that were closest to earning one.
	 */
	function splitSales(total, sku) {
		if (sku === FALLBACK_SKU) return [2, 2, 12, 13, 16, 23];
		const random = ledger.seeded(`${sku}:sales`);
		const weights = SALE_WINDOWS.map((_, at) => 0.8 + random() * 0.4 + at * 0.04);
		const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
		const shares = weights.map((weight) => (total * weight) / weightSum);
		const units = shares.map(Math.floor);
		const spare = total - units.reduce((sum, unit) => sum + unit, 0);
		const byRemainder = shares.map((share, at) => [share - units[at], at]).sort((a, b) => b[0] - a[0]);
		for (const [, at] of byRemainder.slice(0, spare)) units[at] += 1;
		return units;
	}

	/* Stock movements for goods, recent orders for everything else, plus
     the last listing edit, newest first. */
	function pastEvents(entry, shipsGoods, orders, unitsIn) {
		const customerLink = (name, id) => (id ? `<a href="shoppers.html">${name}</a>` : name);
		const movements = {
			out: (move) => [
				'bi-box-arrow-up-right',
				`${Math.abs(move.qty)} shipped from ${locationName(move.site)} to ${customerLink(move.customer, move.account)}`,
			],
			in: (move) => [
				'bi-box-arrow-in-down',
				`${move.qty} received at ${locationName(move.site)} on <a href="purchase-orders.html">${move.ref}</a>`,
			],
			move: (move) => [
				'bi-arrow-left-right',
				`${move.qty} moved from ${locationName(move.site)} to ${locationName(move.to)}`,
			],
			count: (move) => [
				'bi-clipboard-check',
				`Count corrected by ${move.qty > 0 ? '+' : '−'}${Math.abs(move.qty)} at ${locationName(move.site)}: ${move.note.toLowerCase()}`,
			],
		};
		const entries = [];

		if (shipsGoods) {
			for (const move of shelf.moves()[entry.sku] || []) {
				const [icon, text] = (movements[move.kind] || movements.count)(move);
				entries.push({ at: move.date, icon, text });
			}
		} else {
			const booked = entry.kind === 'service';
			for (const order of orders.slice(0, 4)) {
				const who = customerLink(order.customer, accountId(order.customer));
				entries.push({
					at: order.date,
					icon: booked ? 'bi-calendar-check' : 'bi-plus-circle',
					text: booked ? `Booked by ${who}` : `${unitsIn(order)} bought by ${who}`,
				});
			}
		}

		entries.push({ at: entry.changed, icon: 'bi-pencil', text: `<strong>${EDITOR}</strong> updated the listing` });
		entries.sort((a, b) => b.at.localeCompare(a.at));
		return entries.map(({ at, icon, text }) => ({ icon, text, when: shortDate(at) }));
	}

	function accountId(name) {
		return ledger.customer(name)?.id ?? null;
	}

	function locationName(id) {
		return shelf.sites.find((site) => site.id === id).name;
	}

	/* Totals and states are worked out from the record each time they are
     needed, so an edit shows up everywhere at once. */

	function currentPrice() {
		return item.salePrice ?? item.listPrice;
	}

	function onSale() {
		return item.salePrice != null;
	}

	function sumOf(list, read) {
		return list.reduce((sum, entry) => sum + read(entry), 0);
	}

	function unitsOnHand() {
		return sumOf(item.locations, (place) => place.onHand);
	}

	function unitsHeld() {
		return sumOf(item.locations, (place) => place.held);
	}

	function reorderTotal() {
		return sumOf(item.locations, (place) => place.reorder);
	}

	function unitsSold() {
		return sumOf(item.sales.windows, ([, units]) => units);
	}

	function ratingCount() {
		return sumOf(item.stars, (count) => count);
	}

	/** @returns {[string, string]} the status label and its tone */
	function stockStatus() {
		const fixed = { addon: ['Digital', 'info'], service: ['Bookable', 'primary'] }[item.kind];
		if (fixed) return fixed;
		const onHand = unitsOnHand();
		if (!onHand) return ['Out of stock', 'danger'];
		return onHand <= reorderTotal() ? ['Low stock', 'warning'] : ['In stock', 'success'];
	}

	/* The header names the product and carries its status tags. */

	function paintHeader() {
		slot('name').textContent = item.name;
		document.title = `${item.name} · Basalt`;
		slot('sub').textContent = `${item.sku} · ${item.maker} · ${item.group}`;
		slot('crumb').textContent = item.name;
		slot('tags').innerHTML = headerTags()
			.map(
				([label, tone]) =>
					`<span class="basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}">${htmlSafe(label)}</span>`,
			)
			.join('');
	}

	function headerTags() {
		if (isArchived) return [['Archived', '']];
		const tags = [stockStatus(), item.listed ? ['In the store', 'primary'] : ['Hidden from the store', '']];
		if (onSale()) tags.push([`On sale${item.saleEnds ? ` until ${SALE_END_NAMES[item.saleEnds]}` : ''}`, 'danger']);
		if (item.listed && item.frontSpot) tags.push([`Front page, spot ${item.frontSpot}`, 'info']);
		return tags;
	}

	function copyPageLink() {
		window.Basalt.copyText?.(location.href.split('#')[0]);
		notify({ tone: 'success', icon: 'bi-link-45deg', title: 'Link copied' });
	}

	function duplicateProduct() {
		notify({
			tone: 'success',
			icon: 'bi-copy',
			title: `${item.name} (copy) made`,
			text: 'It is hidden from the store until you give it its own SKU.',
		});
	}

	function archiveProduct() {
		isArchived = true;
		paintHeader();
		notify({
			tone: 'success',
			icon: 'bi-archive',
			title: `${item.name} archived`,
			text: 'It stays on past orders and invoices.',
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						isArchived = false;
						paintHeader();
					},
				},
			],
		});
	}

	/* The store card shows the product the way a buyer sees it. */

	function paintListing() {
		if (photoIndex >= item.gallery.length) photoIndex = 0;
		const count = item.gallery.length;
		const chip = listingChip();

		slot('photo').innerHTML = photoTile(item.gallery[photoIndex], 900, 1200, 'pd-pic-main');
		slot('thumbs').innerHTML = count < 2 ? '' : photoRail();
		slot('thumbs').hidden = count < 2;
		slot('eyebrow').innerHTML =
			htmlSafe(item.maker) + (chip ? `<span class="pd-chip pd-chip-${chip[1]}">${htmlSafe(chip[0])}</span>` : '');

		const score = item.rating.toFixed(1);
		slot('stars').innerHTML =
			`${starRow(item.rating)}<span>${score} <span class="pd-quiet">(${countText(ratingCount())})</span></span>` +
			`<span class="visually-hidden">, rated ${score} out of 5 from ${countText(ratingCount())} ratings</span>`;
		slot('price').innerHTML = priceMarkup();
		slot('desc').innerHTML = item.copyHtml;
		slot('perks').innerHTML = listingPerks()
			.map(([icon, text]) => `<li><i class="bi ${icon}" aria-hidden="true"></i>${htmlSafe(text)}</li>`)
			.join('');
		paintSizeBoxes();
	}

	/** Sizes as plain boxes under the words: a size with none on hand is
	    struck through, and one kept out of the store is left off. Eyewear,
	    extras and services come in one size, so they show none. */
	function paintSizeBoxes() {
		const box = slot('sizes');
		const sizes = item.variants.filter((size) => size.listed);
		box.hidden = !sizes.length;
		box.innerHTML = sizes.length
			? `<p class="pd-sizes-label">Size</p><ul class="pd-size-list">${sizes
					.map(
						(size) =>
							`<li class="pd-size${size.onHand ? '' : ' is-out'}">${htmlSafe(size.plug || size.name)}${size.onHand ? '' : '<span class="visually-hidden"> (none on hand)</span>'}</li>`,
					)
					.join('')}</ul>`
			: '';
	}

	/** @returns {?[string, string]} the photo badge's label and tone */
	function listingChip() {
		if (onSale()) return ['Sale', 'danger'];
		return item.badge ? BADGE_LOOK[item.badge] : null;
	}

	function priceMarkup() {
		const was = onSale()
			? `<s class="pd-price-was"><span class="visually-hidden">was </span>${exactDollars(item.listPrice)}</s>`
			: '';
		let note = item.priceNote;
		if (onSale()) note = item.saleEnds ? `Sale ends ${SALE_END_NAMES[item.saleEnds]}` : 'Sale, no end date';
		return `<span class="pd-price-now">${exactDollars(currentPrice())}</span>${was}<span class="pd-price-note">${note}</span>`;
	}

	function listingPerks() {
		if (item.kind === 'hardware') {
			const ships = stockStatus()[1] === 'danger' ? 'Ships when stock arrives' : 'Ships the next working day';
			return [
				['bi-truck', ships],
				['bi-shield-check', item.warranty],
				['bi-globe2', `Made in ${item.madeIn}`],
			];
		}
		if (item.kind === 'addon') {
			return [
				['bi-lightning-charge', 'Starts the same day'],
				['bi-truck', 'Nothing ships'],
				['bi-headset', 'Looked after by the Marlo team'],
			];
		}
		return [
			['bi-calendar-check', item.state],
			['bi-camera-video', 'Also on video'],
			['bi-people', 'By the Marlo team'],
		];
	}

	/** A rail of thumbnails beside the photo, one per photo; each one
	    shows the photo it names, and the current one is marked. */
	function photoRail() {
		const count = item.gallery.length;
		return item.gallery
			.map(
				(id, at) =>
					`<button type="button" class="pd-rail-thumb" aria-label="Photo ${at + 1} of ${count}" aria-pressed="${at === photoIndex}" data-pd-show="${at}">${photoTile(id, 150, 200)}</button>`,
			)
			.join('');
	}

	/* A thumbnail swaps the big photo; keyboard users keep their place on
	   the thumbnail they used. */
	function showPhoto(button) {
		photoIndex = Number(button.dataset.pdShow);
		paintListing();
		const replacement = pick(`[data-pd-show="${photoIndex}"]`, slot('thumbs'));
		if (replacement && button.matches(':focus-visible')) replacement.focus();
	}

	/* Sales figures sit above a chart of revenue building up over the month. */

	function paintSales() {
		const units = unitsSold();
		const earlier = item.sales.before;
		const change = Math.round(((units - earlier) / earlier) * 100);
		const way = change >= 0 ? 'up' : 'down';
		const revenue = dollars(units * item.listPrice);

		slot('sales-figs').innerHTML = [
			`<div><dt>Sold</dt><dd>${countText(units)}</dd></div>`,
			`<div><dt>Revenue</dt><dd>${revenue}</dd></div>`,
			`<div class="pd-figs-trend"><dt class="visually-hidden">Change</dt><dd><span class="pd-trend pd-trend-${way}"><i class="bi bi-arrow-${way}-right" aria-hidden="true"></i>${Math.abs(change)}%</span> ${way} on the 30 days before, when ${countText(earlier)} sold</dd></div>`,
		].join('');
		paintRevenueChart();
		slot('chart-caption').textContent =
			`Revenue so far: ${revenue} in the last 30 days, against ${dollars(earlier * item.listPrice)} in the 30 days before.`;
	}

	/* Both lines climb from zero: the filled one is the last 30 days, the
     dashed one the 30 before, and the space between them tells the story. */
	function paintRevenueChart() {
		const canvas = slot('chart');
		if (!canvas || typeof Chart === 'undefined') return;

		const accent = themeColor('--basalt-series-1', '#6d3fe0');
		const muted = themeColor('--basalt-copy-body', '#40546b');
		const rule = themeColor('--basalt-edge', 'rgba(16, 42, 72, .08)');
		const recent = cumulativeRevenue(spreadOverDays(item.sales.windows.map(([, units]) => units)));
		const earlier = cumulativeRevenue(spreadOverDays(evenSplit(item.sales.before, 6)));
		const wash = window.Basalt.chartFill([
			[0, themeColor('--basalt-hue-soft', '#eee8fd')],
			[1, themeColor('--basalt-plane', '#ffffff')],
		]);
		const tickStyle = () => ({ color: muted, font: { family: CHART_FONT, size: 11.5 } });

		revenueChart?.destroy();
		revenueChart = new Chart(canvas, {
			type: 'line',
			data: {
				labels: recent.map((_, day) => dayName(day)),
				datasets: [
					{
						label: 'Last 30 days',
						order: 1,
						data: recent,
						borderColor: accent,
						backgroundColor: wash,
						fill: 'origin',
						borderWidth: 2.5,
						tension: 0.35,
						pointRadius: 0,
						pointHoverRadius: 4,
						pointHoverBackgroundColor: accent,
					},
					{
						label: 'The 30 before',
						order: 0,
						data: earlier,
						borderColor: muted,
						borderDash: [4, 4],
						borderWidth: 1.5,
						fill: false,
						tension: 0.35,
						pointRadius: 0,
						pointHoverRadius: 3,
						pointHoverBackgroundColor: muted,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: prefersStill() ? false : { duration: 500, easing: 'easeOutCubic' },
				interaction: { mode: 'index', intersect: false },
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: {
							...tickStyle(),
							maxRotation: 0,
							autoSkip: false,
							callback: (_, day) => (day % 7 === 1 || day === CHART_DAYS - 1 ? dayName(day) : ''),
						},
					},
					y: {
						beginAtZero: true,
						grid: { color: rule },
						border: { display: false },
						ticks: { ...tickStyle(), maxTicksLimit: 4, callback: (value) => dollars(value) },
					},
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: themeColor('--basalt-plane', '#ffffff'),
						titleColor: themeColor('--basalt-copy', '#12233a'),
						bodyColor: themeColor('--basalt-copy', '#12233a'),
						borderColor: themeColor('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
						borderWidth: 1,
						padding: 10,
						cornerRadius: 8,
						titleFont: { family: CHART_FONT, size: 12, weight: '600' },
						bodyFont: { family: CHART_FONT, size: 12 },
						callbacks: {
							title: (points) => `By ${points[0].label}`,
							label: (point) => ` ${point.dataset.label}: ${dollars(point.parsed.y)}`,
						},
					},
				},
			},
		});
	}

	/** Splits a total into equal whole parts, the first parts taking the rest. */
	function evenSplit(total, parts) {
		return Array.from({ length: parts }, (_, at) => Math.floor(total / parts) + (at < total % parts ? 1 : 0));
	}

	/** Spreads each window's units over its days, later days taking the rest. */
	function spreadOverDays(windowUnits) {
		const span = CHART_DAYS / windowUnits.length;
		const days = [];
		for (const units of windowUnits) {
			const base = Math.floor(units / span);
			const firstExtra = span - (units % span);
			for (let day = 0; day < span; day++) days.push(base + (day >= firstExtra ? 1 : 0));
		}
		return days;
	}

	function cumulativeRevenue(dayUnits) {
		let running = 0;
		return dayUnits.map((units) => (running += units * item.listPrice));
	}

	function dayName(day) {
		const date = new Date(CHART_END.getTime() - (CHART_DAYS - 1 - day) * 864e5);
		return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
	}

	function themeColor(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/* Stock is counted per location, each with its own reorder point. */

	function paintStock() {
		const onShelves = item.kind === 'hardware';
		pick('#pd-stock-title', page).textContent = onShelves ? 'Stock by location' : 'How it is delivered';
		pick('[data-pd-edit="stock"]', page).hidden = !onShelves;

		/* Extras and services never sit on a shelf, so the card explains how
       they reach the customer instead. */
		if (!onShelves) {
			const icon = item.kind === 'service' ? 'bi-calendar-check' : 'bi-check2-circle';
			slot('stock-desc').textContent = item.note;
			slot('sites').innerHTML = '';
			slot('incoming').innerHTML =
				`<i class="bi ${icon}" aria-hidden="true"></i><span>${htmlSafe(item.state)}.</span>`;
			return;
		}

		slot('stock-desc').textContent =
			`${countText(unitsOnHand())} on hand, ${countText(unitsHeld())} of them held for open orders.`;
		const fullest = Math.max(...item.locations.map((place) => place.onHand)) || 1;
		slot('sites').innerHTML = item.locations.map((place) => locationRow(place, fullest)).join('');

		const delivery = item.incoming;
		slot('incoming').innerHTML = delivery
			? `<i class="bi bi-truck" aria-hidden="true"></i><span><a href="purchase-orders.html">${htmlSafe(delivery.po)}</a> brings ${countText(delivery.qty)} more to ${htmlSafe(delivery.site)} on ${htmlSafe(delivery.date)}.</span>`
			: '';
	}

	function locationRow(place, fullest) {
		const width = Math.max(4, Math.round((place.onHand / fullest) * 100));
		const atReorder = place.onHand - place.held <= place.reorder;
		const reorder = atReorder
			? `<span class="pd-low">at its reorder point of ${countText(place.reorder)}</span>`
			: `reorders at ${countText(place.reorder)}`;
		return (
			`<li class="pd-site">` +
			`<div class="pd-site-top"><span class="pd-site-name">${htmlSafe(place.name)}</span><span class="pd-site-qty"><strong>${countText(place.onHand)}</strong> on hand</span></div>` +
			`<span class="pd-site-track" aria-hidden="true"><span class="pd-site-fill pd-tone-${place.tone}" style="--pd-w:${width}%"></span></span>` +
			`<span class="pd-site-sub">${htmlSafe(place.region)} · ${countText(place.held)} held for orders · ${reorder}</span>` +
			'</li>'
		);
	}

	function fillReorderForm() {
		pick('[data-pd-reorder]', forms.stock).innerHTML = item.locations
			.map(
				(place, at) =>
					`<div class="pd-reorder-row">` +
					`<label class="pd-reorder-label" for="pd-reorder-${at}"><span class="pd-site-name">${htmlSafe(place.name)}</span><span class="pd-site-sub">${countText(place.onHand - place.held)} free to sell</span></label>` +
					`<div><input type="number" class="form-control pd-reorder-input" id="pd-reorder-${at}" min="0" max="9999" step="1" value="${place.reorder}" required aria-describedby="pd-reorder-err-${at}" data-i="${at}">` +
					`<div class="invalid-feedback" id="pd-reorder-err-${at}">Enter 0 or more.</div></div>` +
					'</div>',
			)
			.join('');
	}

	function saveReorderPoints(event) {
		event.preventDefault();
		const boxes = pickAll('.pd-reorder-input', forms.stock);
		const wrong = boxes.filter((box) => box.value === '' || !(+box.value >= 0) || +box.value % 1);
		for (const box of boxes) box.classList.toggle('is-invalid', wrong.includes(box));
		if (wrong.length) {
			wrong[0].focus();
			return;
		}

		let edited = 0;
		for (const box of boxes) {
			const place = item.locations[+box.dataset.i];
			if (place.reorder === +box.value) continue;
			place.reorder = +box.value;
			edited++;
		}

		paintStock();
		paintHeader();
		paintListing();
		closeEditor('stock', true);
		if (edited) logEdit(`changed the reorder point at ${edited === 1 ? 'one location' : `${edited} locations`}`);
		notify({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'Reorder points saved',
			text: `Stock Levels asks for more at ${countText(reorderTotal())} in all.`,
		});
	}

	/* Sizes are the variants table: read-only rows, or inputs while editing. */

	function paintSizes() {
		const body = slot('variants');
		const sizes = item.variants;
		const inStore = sizes.filter((size) => size.listed).length;

		/* Only garments sold in a range of sizes have this card at all. */
		body.closest('.pd-card').hidden = !sizes.length;
		slot('variants-desc').textContent = sizesEditing
			? 'Leave a price empty to charge the product price.'
			: `${sizes.length} sizes, one ${item.noun}. ${inStore === sizes.length ? 'All are in the store.' : `${inStore} of ${sizes.length} are in the store.`}`;
		body.closest('table').classList.toggle('is-editing', sizesEditing);
		body.innerHTML = sizes.map(sizesEditing ? sizeEditRow : sizeViewRow).join('');
		paintSizeBoxes();
	}

	function stockCell(size) {
		return size.onHand ? countText(size.onHand) : '<span class="pd-quiet">None</span>';
	}

	function sizeViewRow(size, at) {
		const plug = size.plug || size.name.charAt(0).toUpperCase();
		const shelfNote = size.onHand ? `${countText(size.onHand)} on hand` : 'none on hand';
		const name = htmlSafe(size.name);
		return (
			'<tr>' +
			`<td><span class="pd-var"><span class="pd-var-icon pd-tone-${size.tone || 5}" aria-hidden="true">${htmlSafe(plug)}</span><span><span class="pd-var-name">${name}</span><span class="pd-var-note">${htmlSafe(size.note)}<span class="pd-var-stock"> · ${shelfNote}</span></span></span></span></td>` +
			`<td class="pd-col-sku"><span class="pd-sku">${htmlSafe(size.sku)}</span></td>` +
			`<td class="pd-col-num">${exactDollars(size.price ?? currentPrice())}</td>` +
			`<td class="pd-col-num pd-col-stock">${stockCell(size)}</td>` +
			`<td class="pd-col-num pd-col-sold">${countText(size.sold)}</td>` +
			`<td class="pd-col-on"><div class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" role="switch" id="pd-var-${at}" data-pd-var-listed="${at}"${size.listed ? ' checked' : ''}><label class="form-check-label visually-hidden" for="pd-var-${at}">Sell ${name} in the store</label></div></td>` +
			'</tr>'
		);
	}

	function sizeEditRow(size, at) {
		const typedPrice = typedValue(size, 'price');
		const lastCell = size.added
			? `<button type="button" class="btn btn-icon pd-remove" aria-label="Remove this new variant" data-pd-var-remove="${at}"><i class="bi bi-x-lg" aria-hidden="true"></i></button>`
			: `<span class="pd-quiet">${size.listed ? 'On' : 'Off'}</span>`;
		return (
			'<tr>' +
			`<td class="pd-col-name"><label class="pd-vlabel" for="pd-var-name-${at}">Variant name</label><input type="text" class="form-control form-control-sm pd-var-input" id="pd-var-name-${at}" maxlength="32" value="${htmlSafe(typedValue(size, 'name'))}" required data-pd-vf="name" data-i="${at}"><div class="invalid-feedback">Give it a name.</div></td>` +
			`<td class="pd-col-sku"><label class="pd-vlabel" for="pd-var-sku-${at}">SKU</label><input type="text" class="form-control form-control-sm pd-sku-input" id="pd-var-sku-${at}" maxlength="14" value="${htmlSafe(typedValue(size, 'sku'))}" required spellcheck="false" autocomplete="off" data-pd-vf="sku" data-i="${at}"><div class="invalid-feedback">Use a SKU no other variant has.</div></td>` +
			`<td class="pd-col-num"><label class="pd-vlabel" for="pd-var-price-${at}">Price<span class="visually-hidden"> for ${htmlSafe(size.name || 'the new variant')}</span></label><input type="number" class="form-control form-control-sm pd-price-input" id="pd-var-price-${at}" min="1" step="0.01" inputmode="decimal" value="${htmlSafe(typedPrice === '' ? currentPrice() : typedPrice)}" data-pd-vf="price" data-i="${at}"><div class="invalid-feedback">Above $0, or empty.</div></td>` +
			`<td class="pd-col-num pd-col-stock">${stockCell(size)}</td>` +
			`<td class="pd-col-num pd-col-sold">${countText(size.sold)}</td>` +
			`<td class="pd-col-on">${lastCell}</td>` +
			'</tr>'
		);
	}

	/* Text typed into a row lives on the size itself (in `typed`) until
     Save or Cancel, so adding or dropping another row keeps it. */
	function typedValue(size, field) {
		return size.typed?.[field] ?? size[field] ?? '';
	}

	function rememberTyping(event) {
		const box = event.target.closest('[data-pd-vf]');
		if (!box) return;
		box.classList.remove('is-invalid');
		const size = item.variants[+box.dataset.i];
		size.typed = { ...size.typed, [box.dataset.pdVf]: box.value };
	}

	function onSizesClick(event) {
		if (event.target.closest('[data-pd-add-variant]')) {
			item.variants.push({
				name: '',
				note: 'New variant',
				sku: `${item.sku}-`,
				price: null,
				onHand: 0,
				sold: 0,
				listed: true,
				added: true,
			});
			paintSizes();
			pick(`[data-pd-vf="name"][data-i="${item.variants.length - 1}"]`, forms.variants).focus();
			return;
		}
		const remove = event.target.closest('[data-pd-var-remove]');
		if (!remove) return;
		item.variants.splice(+remove.dataset.pdVarRemove, 1);
		paintSizes();
		pick('[data-pd-add-variant]', forms.variants).focus();
	}

	/** Checks one row field; a SKU must be unique across the table. */
	function sizeFieldIsWrong(box, skus) {
		const value = box.value.trim();
		const kind = box.dataset.pdVf;
		if (kind === 'name') return !value;
		if (kind === 'sku') {
			const upper = value.toUpperCase();
			return !value || skus.indexOf(upper) !== skus.lastIndexOf(upper);
		}
		return value !== '' && !(parseFloat(value) > 0);
	}

	function saveSizes(event) {
		event.preventDefault();
		if (!sizesEditing) return;
		const boxes = pickAll('[data-pd-vf]', forms.variants);
		const skus = boxes.filter((box) => box.dataset.pdVf === 'sku').map((box) => box.value.trim().toUpperCase());
		const wrong = boxes.filter((box) => sizeFieldIsWrong(box, skus));
		for (const box of boxes) box.classList.toggle('is-invalid', wrong.includes(box));
		if (wrong.length) {
			wrong[0].focus();
			speak('Check the highlighted fields.');
			return;
		}

		const newCount = item.variants.filter((size) => size.added).length;
		const apply = {
			name: (size, value) => {
				size.name = value;
			},
			sku: (size, value) => {
				size.sku = value.toUpperCase();
			},
			/* A price equal to the product's own is stored as none, so it keeps
         following the product price. */
			price: (size, value) => {
				size.price = value === '' || parseFloat(value) === currentPrice() ? null : parseFloat(value);
			},
		};
		for (const box of boxes) apply[box.dataset.pdVf](item.variants[+box.dataset.i], box.value.trim());

		closeEditor('variants', true);
		logEdit(newCount ? `added ${newCount === 1 ? 'a variant' : `${newCount} variants`}` : 'edited the variants');
		notify({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'Variants saved',
			text: newCount ? 'New variants start with no stock. Receive some in Stock Levels.' : '',
		});
	}

	function toggleSize(event) {
		const toggle = event.target.closest('[data-pd-var-listed]');
		if (!toggle) return;
		const size = item.variants[+toggle.dataset.pdVarListed];
		size.listed = toggle.checked;
		paintSizes();
		notify({
			tone: 'success',
			icon: size.listed ? 'bi-eye' : 'bi-eye-slash',
			title: `${size.name}${size.listed ? ' is back in the store' : ' is hidden'}`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						size.listed = !size.listed;
						paintSizes();
					},
				},
			],
		});
	}

	/* Ratings show the average, a bar per star count and one review. */

	function paintRatings() {
		const top = Math.max(...item.stars) || 1;
		const bars = item.stars
			.map((count, at) => {
				const tone = at < 2 ? 'up' : at === 2 ? 'mid' : 'down';
				return (
					`<li class="pd-dist-row"><span class="pd-dist-label">${5 - at} star${at === 4 ? '' : 's'}</span>` +
					`<span class="pd-dist-track" aria-hidden="true"><span class="pd-dist-fill pd-dist-fill-${tone}" style="--pd-w:${((count / top) * 100).toFixed(1)}%"></span></span>` +
					`<span class="pd-dist-n">${countText(count)}</span></li>`
				);
			})
			.join('');
		slot('score').innerHTML =
			`<div class="pd-score-big"><span class="pd-score-num">${item.rating.toFixed(1)}</span>${starRow(item.rating)}<span class="pd-score-sub">${countText(ratingCount())} ratings</span></div>` +
			`<ul class="pd-dist" aria-label="Ratings by stars">${bars}</ul>`;

		const { title, body, who, account, date } = item.review;
		const reviewer = account ? `<a href="shoppers.html">${htmlSafe(who)}</a>` : htmlSafe(who);
		slot('review').innerHTML =
			`<blockquote class="pd-review-quote"><p class="pd-review-title">${starRow(5)}${htmlSafe(title)}</p><p class="pd-review-body">${htmlSafe(body)}</p></blockquote>` +
			`<figcaption class="pd-review-who">${reviewer} · Verified buyer · ${htmlSafe(date)}</figcaption>`;
	}

	/** Five stars for a score, rounding to the nearest half star. */
	function starRow(score) {
		let icons = '';
		for (let star = 1; star <= 5; star++) {
			let shape = 'bi-star';
			if (score >= star - 0.75) shape = 'bi-star-half';
			if (score >= star - 0.25) shape = 'bi-star-fill';
			icons += `<i class="bi ${shape}" aria-hidden="true"></i>`;
		}
		return `<span class="pd-stars">${icons}</span>`;
	}

	/* Each sales channel has a switch that applies at once. */

	function paintChannels() {
		const { listed, frontSpot, stockists } = item;
		const channels = [
			{
				key: 'listed',
				icon: 'bi-shop',
				tone: 1,
				name: 'Marlo online shop',
				on: listed,
				line: listed ? 'Every customer can find and buy it.' : 'Hidden. It stays on past orders and invoices.',
			},
			{
				key: 'front',
				icon: 'bi-house',
				tone: 2,
				name: 'Front page',
				on: listed && !!frontSpot,
				off: !listed,
				line: frontLine(),
			},
			{
				key: 'partner',
				icon: 'bi-people',
				tone: 5,
				name: 'Stockist catalog',
				on: stockists,
				line: stockists ? 'Boutiques see it at the wholesale price.' : 'Stockists cannot order it.',
			},
		];
		const category =
			'<li class="pd-place"><span class="pd-place-icon pd-tone-4" aria-hidden="true"><i class="bi bi-tags"></i></span>' +
			`<div class="pd-place-text"><span class="pd-place-name">Category</span><span class="pd-place-line">Shown under ${htmlSafe(item.category)} in the store menu.</span></div>` +
			'<a class="pd-link" href="categories.html">Change</a></li>';
		slot('places').innerHTML = channels.map(channelRow).join('') + category;
	}

	function frontLine() {
		if (!item.listed) return 'Show it in the store first.';
		return item.frontSpot
			? `Spot ${item.frontSpot} of 3, seen first by every visitor.`
			: 'Not featured. Turn on to take the free spot.';
	}

	function channelRow({ key, icon, tone, name, on, off, line }) {
		return (
			`<li class="pd-place"><span class="pd-place-icon pd-tone-${tone}" aria-hidden="true"><i class="bi ${icon}"></i></span>` +
			`<div class="pd-place-text"><span class="pd-place-name" id="pd-place-${key}">${name}</span><span class="pd-place-line" id="pd-place-line-${key}">${htmlSafe(line)}</span></div>` +
			`<div class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" role="switch" aria-labelledby="pd-place-${key}" aria-describedby="pd-place-line-${key}" data-pd-place="${key}"${on ? ' checked' : ''}${off ? ' disabled' : ''}></div></li>`
		);
	}

	function toggleChannel(event) {
		const toggle = event.target.closest('[data-pd-place]');
		if (!toggle) return;
		const key = toggle.dataset.pdPlace;
		const previous = { listed: item.listed, frontSpot: item.frontSpot, stockists: item.stockists };
		const apply = {
			listed: () => {
				item.listed = toggle.checked;
			},
			front: () => {
				item.frontSpot = toggle.checked ? 1 : 0;
			},
			partner: () => {
				item.stockists = toggle.checked;
			},
		};
		apply[key]?.();
		paintChannels();
		paintHeader();
		pick(`[data-pd-place="${key}"]`, page)?.focus({ preventScroll: true });
		notify({
			tone: 'success',
			icon: toggle.checked ? 'bi-eye' : 'bi-eye-slash',
			title: `${toggle.checked ? 'Added to ' : 'Taken off '}${CHANNEL_NAMES[key]}`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						Object.assign(item, previous);
						paintChannels();
						paintHeader();
					},
				},
			],
		});
	}

	/* Recent orders and the change log close the page. */

	function paintOrders() {
		pick('.pd-more[href="stock-levels.html"]', page).hidden = item.kind !== 'hardware';
		if (!item.orders.length) {
			const quiet =
				item.kind === 'addon'
					? 'No Store orders for it lately. Most members join from their account.'
					: 'No Store orders for it lately.';
			slot('orders').innerHTML = `<li class="pd-order">${quiet}</li>`;
			return;
		}
		slot('orders').innerHTML = item.orders.map(orderRow).join('');
	}

	function orderRow(order) {
		const [label, tone] = ORDER_LOOK[order.status];
		const buyer = order.account
			? `<a class="pd-order-cust" href="shoppers.html">${htmlSafe(order.customer)}</a>`
			: `<span class="pd-order-cust">${htmlSafe(order.customer)}</span>`;
		const unit = order.qty === 1 ? item.unit.replace(/s$/, '') : item.unit;
		return (
			`<li class="pd-order"><div class="pd-order-who"><a class="pd-order-no" href="order-details.html?id=${encodeURIComponent(order.no)}">${htmlSafe(order.no)}</a>${buyer}</div>` +
			`<span class="pd-order-qty">${countText(order.qty)} ${unit}</span>` +
			`<span class="pd-order-date">${htmlSafe(order.date)}</span>` +
			`<span class="pd-order-state"><span class="basalt-status basalt-status-dot basalt-status-${tone}">${label}</span></span></li>`
		);
	}

	function paintHistory() {
		slot('history').innerHTML = item.events
			.slice(0, 5)
			.map(
				({ icon, text, when }) =>
					'<li class="pd-event">' +
					`<span class="pd-event-icon" aria-hidden="true"><i class="bi ${icon}"></i></span>` +
					`<div><p class="pd-event-text">${text}</p><p class="pd-event-when">${htmlSafe(when)}</p></div>` +
					'</li>',
			)
			.join('');
	}

	/** Puts an edit made on this page at the top of the change log. */
	function logEdit(summary) {
		item.events.unshift({
			icon: 'bi-pencil',
			text: `<strong>${htmlSafe(EDITOR)}</strong> ${summary}`,
			when: 'Today',
		});
		paintHistory();
	}

	/* Only one card's form is open at a time, and closing it puts focus back
     on that card's Edit button. */

	function editButtons(section) {
		return pickAll(`[data-pd-edit="${section}"]`, page);
	}

	function showEditor(section) {
		if (openSection && openSection !== section) closeEditor(openSection);
		openSection = section;
		for (const button of editButtons(section)) button.disabled = true;

		if (section === 'variants') {
			sizesEditing = true;
			paintSizes();
			pick('[data-pd-variants-foot]', page).hidden = false;
			pick('[data-pd-vf]', forms.variants).focus();
			return;
		}

		const form = forms[section];
		pick(`[data-pd-view="${section}"]`, page).hidden = true;
		form.hidden = false;
		({ listing: fillListingForm, stock: fillReorderForm })[section]?.();
		const firstField = pick('input:not([type=file]), select', form);
		form.closest('.pd-card').scrollIntoView({ block: 'start', behavior: prefersStill() ? 'auto' : 'smooth' });
		firstField?.focus({ preventScroll: true });
	}

	function closeEditor(section, saved) {
		for (const button of editButtons(section)) button.disabled = false;

		if (section === 'variants') {
			sizesEditing = false;
			item.variants = item.variants.filter((size) => saved || !size.added);
			for (const size of item.variants) {
				delete size.added;
				delete size.typed;
			}
			pick('[data-pd-variants-foot]', page).hidden = true;
			paintSizes();
		} else {
			const form = forms[section];
			form.hidden = true;
			for (const field of pickAll('.is-invalid', form)) field.classList.remove('is-invalid');
			pick(`[data-pd-view="${section}"]`, page).hidden = false;
		}

		openSection = null;
		/* The listing's Edit sits in the bar at the top, the others in their card heads. */
		(pick(`.pd-card-head [data-pd-edit="${section}"]`, page) || editButtons(section)[0])?.focus({
			preventScroll: !saved,
		});
	}

	/* Escape leaves an open form, unless it is closing a menu inside it. */
	function onEscape(event) {
		if (event.key !== 'Escape' || !openSection) return;
		if (!event.target.closest('[data-pd-form]') || event.target.closest('.dropdown-menu, .basalt-select-menu'))
			return;
		closeEditor(openSection);
	}

	/* The listing form edits photos, the description text and prices. */

	function listingField(name) {
		return pick(`[data-pd-f="${name}"]`, forms.listing);
	}

	function wireListingForm() {
		forms.listing.addEventListener('click', onPhotoEditClick);
		photoPicker.addEventListener('change', addPickedPhoto);

		/* Bold, italic and a bulleted list. Buttons keep the caret where it
       was by never taking focus on mousedown. */
		for (const button of pickAll('[data-pd-cmd]', forms.listing)) {
			button.addEventListener('mousedown', (event) => event.preventDefault());
			button.addEventListener('click', () => {
				copyBox.focus();
				document.execCommand(button.dataset.pdCmd);
				reflectFormatting();
			});
		}
		copyBox.addEventListener('keyup', reflectFormatting);
		copyBox.addEventListener('mouseup', reflectFormatting);
		copyBox.addEventListener('input', () => copyBox.classList.remove('is-invalid'));
		/* Paste lands as plain text so outside styling never comes along. */
		copyBox.addEventListener('paste', (event) => {
			event.preventDefault();
			document.execCommand(
				'insertText',
				false,
				(event.clipboardData || window.clipboardData).getData('text/plain'),
			);
		});

		listingField('sale').addEventListener('input', () => {
			saleEndsRow.hidden = listingField('sale').value.trim() === '';
		});
		for (const field of pickAll('input', forms.listing)) {
			field.addEventListener('input', () => field.classList.remove('is-invalid'));
		}
		forms.listing.addEventListener('submit', saveListing);
	}

	function fillListingForm() {
		listingField('name').value = item.name;
		chooseOption(listingField('badge'), item.badge);
		copyBox.innerHTML = item.copyHtml;
		listingField('price').value = item.listPrice;
		listingField('sale').value = onSale() ? item.salePrice : '';
		chooseOption(listingField('ends'), item.saleEnds || '2026-10-31');
		saleEndsRow.hidden = !onSale();
		photoDraft = [...item.gallery];
		paintPhotoDraft();
	}

	/* Styled selects follow the native one through its change event. */
	function chooseOption(select, value) {
		select.value = value;
		select.dispatchEvent(new Event('change', { bubbles: true }));
	}

	function reflectFormatting() {
		for (const button of pickAll('[data-pd-cmd]', forms.listing)) {
			button.setAttribute('aria-pressed', String(document.queryCommandState(button.dataset.pdCmd)));
		}
	}

	function paintPhotoDraft() {
		const tiles = photoDraft.map((id, at) => {
			const lead =
				at === 0
					? '<span class="pd-chip pd-chip-primary">Main</span>'
					: `<button type="button" class="btn btn-sm pd-photo-edit-main" data-pd-photo-main="${at}">Make main</button>`;
			return `<li class="pd-photo-edit-item">${photoTile(id, 240, 180)}${lead}<button type="button" class="btn btn-icon pd-photo-edit-remove" aria-label="Remove photo ${at + 1}" data-pd-photo-remove="${at}"><i class="bi bi-x-lg" aria-hidden="true"></i></button></li>`;
		});
		if (photoDraft.length < PHOTO_LIMIT) {
			tiles.push(
				'<li><button type="button" class="pd-photo-edit-add" data-pd-photo-add><i class="bi bi-plus-lg" aria-hidden="true"></i>Add photo</button></li>',
			);
		}
		pick('[data-pd-photos]', forms.listing).innerHTML = tiles.join('');
	}

	function onPhotoEditClick(event) {
		const promote = event.target.closest('[data-pd-photo-main]');
		const drop = event.target.closest('[data-pd-photo-remove]');

		if (promote) {
			const from = Number(promote.dataset.pdPhotoMain);
			const [moved] = photoDraft.splice(from, 1);
			photoDraft.unshift(moved);
			paintPhotoDraft();
			pick('[data-pd-photo-remove="0"]', forms.listing).focus();
			speak(`Photo ${from + 1} is now the main photo.`);
			return;
		}

		if (drop) {
			const from = Number(drop.dataset.pdPhotoRemove);
			photoDraft.splice(from, 1);
			paintPhotoDraft();
			const nextFocus =
				pick(`[data-pd-photo-remove="${Math.min(from, photoDraft.length - 1)}"]`, forms.listing) ||
				pick('[data-pd-photo-add]', forms.listing);
			nextFocus?.focus();
			speak('Photo removed.');
			return;
		}

		if (event.target.closest('[data-pd-photo-add]')) photoPicker.click();
	}

	function addPickedPhoto() {
		const picked = photoPicker.files?.[0];
		if (picked && photoDraft.length < PHOTO_LIMIT) {
			photoDraft.push(URL.createObjectURL(picked));
			paintPhotoDraft();
			speak('Photo added.');
		}
		photoPicker.value = '';
	}

	/** Lists what a listing save changed, as words for the change log. */
	function listingChanges(next) {
		const changes = [];
		if (next.name !== item.name) changes.push('the name');
		if (next.copyHtml !== item.copyHtml) changes.push('the description');
		if (photoDraft.join() !== item.gallery.join()) changes.push('the photos');
		if (next.badge !== item.badge) changes.push('the badge');
		if (next.listPrice !== item.listPrice)
			changes.push(`the price from ${exactDollars(item.listPrice)} to ${exactDollars(next.listPrice)}`);
		if (next.salePrice !== item.salePrice || (next.salePrice != null && next.endsChoice !== item.saleEnds))
			changes.push('the sale price');
		return changes;
	}

	function saveListing(event) {
		event.preventDefault();
		const typedSale = listingField('sale').value.trim();
		const next = {
			name: listingField('name').value.trim(),
			listPrice: parseFloat(listingField('price').value),
			salePrice: typedSale === '' ? null : parseFloat(typedSale),
			copyHtml: copyBox.innerHTML,
			badge: listingField('badge').value,
			endsChoice: listingField('ends').value,
		};

		const wrong = [];
		if (!next.name) wrong.push(listingField('name'));
		if (!copyBox.textContent.trim()) wrong.push(copyBox);
		if (!(next.listPrice > 0)) wrong.push(listingField('price'));
		if (next.salePrice != null && !(next.salePrice > 0 && next.salePrice < next.listPrice))
			wrong.push(listingField('sale'));
		for (const field of pickAll('.is-invalid', forms.listing)) field.classList.remove('is-invalid');
		if (wrong.length) {
			for (const field of wrong) field.classList.add('is-invalid');
			wrong[0].focus();
			speak('Check the highlighted fields.');
			return;
		}

		const changes = listingChanges(next);
		Object.assign(item, {
			name: next.name,
			listPrice: next.listPrice,
			salePrice: next.salePrice,
			copyHtml: next.copyHtml,
			badge: next.badge,
			saleEnds: next.salePrice == null ? '' : next.endsChoice,
			gallery: photoDraft.length ? [...photoDraft] : item.gallery.slice(0, 1),
		});
		photoIndex = 0;
		paintEverything();
		closeEditor('listing', true);
		if (changes.length) logEdit(`changed ${htmlSafe(joinWithAnd(changes))}`);
		notify({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'Listing saved',
			text: changes.length ? 'The store shows the changes now.' : 'Nothing had changed.',
		});
	}

	function joinWithAnd(parts) {
		if (parts.length < 2) return parts[0];
		return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
	}

	/* Every photo sits over a tinted tile with the product icon, which
     stays in view while the photo loads or if it never arrives. */

	function photoTile(id, width, height, extraClass) {
		const image = id
			? `<img src="${id.startsWith('blob:') ? id : photoSource(id, width, height)}" alt="" width="${width}" height="${height}" decoding="async"${extraClass === 'pd-pic-main' ? ' fetchpriority="high"' : ''}>`
			: '';
		return `<span class="pd-pic ${extraClass || ''}"><i class="bi ${item.icon}" aria-hidden="true"></i>${image}</span>`;
	}

	/* Point this at your own image host to use your own photos. */
	function photoSource(id, width, height) {
		return window.Basalt.photo(id, width, height);
	}

	function dropBrokenPhoto(event) {
		const image = event.target;
		if (image instanceof HTMLImageElement && image.closest('.pd-pic')) image.remove();
	}

	/* Small helpers used across the cards. */

	function slot(name) {
		return pick(`[data-pd="${name}"]`, page);
	}

	function pickAll(selector, scope) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (char) => entities[char]);
	}

	function countText(value) {
		return Number(value).toLocaleString('en-US');
	}

	/** Whole dollars when the amount is whole, cents otherwise. */
	function dollars(amount) {
		const options = { minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 };
		return `$${Number(amount).toLocaleString('en-US', options)}`;
	}

	function exactDollars(amount) {
		return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function shortDate(iso) {
		return `${MONTH_NAMES[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
	}

	function prefersStill() {
		return matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function speak(message) {
		window.Basalt.announce?.(message);
	}

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}
})();
