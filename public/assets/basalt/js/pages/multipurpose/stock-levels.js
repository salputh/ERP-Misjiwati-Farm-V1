/**
 * Stock Levels (stock-levels.html, marked [data-whs-root]).
 *
 * Shows how many boxed Marlo products sit at each of the four locations: a
 * restock list, a ring of stock by location, the sortable stock table, a
 * quick-view drawer per product and a second drawer for booking deliveries in
 * or correcting a shelf count. Products, locations, open purchase orders and
 * movements all come from the shared catalog (assets/basalt/js/data/multipurpose/catalog.js), so
 * Products, Product Details and Purchase Orders show the same figures; only
 * the in-and-out chart keeps its own totals below.
 */
(() => {
	'use strict';

	const screen = pick('[data-whs-root]');
	if (!screen || !window.Basalt.data?.catalog) return;

	/* The demo is written around this date; a live install would use today. */
	const AS_OF = '2026-10-09';
	const TYPEFACE = "'Schibsted Grotesk', sans-serif";
	const SMALL_COUNTS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

	/* A product's perSite maps each location id to [on hand, reserved,
     reorder point]. Reserved units are promised to open orders, and a
     location wants a top-up once its free stock drops under the reorder point. */
	const catalog = window.Basalt.data.catalog;
	const LOCATIONS = catalog.sites;
	const items = catalog
		.products()
		.filter((entry) => entry.stock)
		.map((entry) => ({
			sku: entry.sku,
			name: entry.name,
			category: entry.stock.category,
			maker: entry.maker,
			icon: entry.stock.icon,
			tone: entry.stock.tone,
			leadDays: entry.stock.leadDays,
			perSite: entry.stock.at,
		}));
	/* Purchase orders still on their way. */
	const inbound = catalog.incoming();
	/* Recent movements per SKU, newest first; qty is the change to on hand,
     and a move between locations leaves the total as it was. */
	const history = catalog.moves();

	/* Units received and shipped across all locations, per period choice. */
	const FLOW_SERIES = {
		weeks: {
			ticks: ['Aug 10', 'Aug 17', 'Aug 24', 'Aug 31', 'Sep 7', 'Sep 14', 'Sep 21', 'Sep 28'],
			span: 'in the last 8 weeks',
			unit: 'week',
			received: [220, 90, 260, 40, 310, 120, 310, 640],
			shipped: [52, 56, 4, 18, 15, 54, 86, 85],
		},
		months: {
			ticks: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
			span: 'in the last 6 months',
			unit: 'month',
			received: [620, 540, 710, 680, 760, 1360],
			shipped: [150, 160, 170, 165, 140, 205],
		},
	};

	const STOCK_STATES = {
		ok: { label: 'In stock', tone: 'success', urgency: 2 },
		low: { label: 'Low', tone: 'warning', urgency: 1 },
		out: { label: 'Out of stock', tone: 'danger', urgency: 0 },
	};

	/* How each sortable column compares two table rows. */
	const SORTERS = {
		name: (left, right) => left.item.name.localeCompare(right.item.name),
		status: (left, right) =>
			STOCK_STATES[left.stock.status].urgency - STOCK_STATES[right.stock.status].urgency ||
			coverRatio(left.stock) - coverRatio(right.stock),
		onHand: (left, right) => left.stock.onHand - right.stock.onHand,
		avail: (left, right) => left.stock.avail - right.stock.avail,
	};

	/* Each delegated action, tried in order; the first matching target wins. */
	const CLICK_ACTIONS = [
		[
			'[data-whs-reset]',
			() => {
				nodes.query.value = '';
				nodes.statusFilter.value = 'all';
				nodes.siteFilter.value = 'all';
				drawLocations();
				drawTable();
			},
		],
		[
			'[data-whs-receive-po]',
			(target) =>
				openEntry(
					'receive',
					target.getAttribute('data-whs-receive-sku'),
					target.getAttribute('data-whs-receive-po'),
				),
		],
		['[data-whs-open]', (target) => openQuickView(target.getAttribute('data-whs-open'))],
		['[data-whs-receive]', (target) => openEntry('receive', target.getAttribute('data-whs-receive'))],
		['[data-whs-count]', (target) => openEntry('count', target.getAttribute('data-whs-count'))],
		['[data-whs-move]', (target) => openEntry(target.getAttribute('data-whs-move'), null)],
		[
			'[data-whs-export]',
			() => {
				window.Basalt.toasts.push({
					tone: 'success',
					title: 'Stock list exported',
					text: `inventory-${AS_OF}.csv, ${items.length} products at ${LOCATIONS.length} locations.`,
				});
			},
		],
	];

	/* Wording for each kind of movement; anything unknown is a count fix. */
	const MOVEMENT_TEXT = {
		in: (move, place) => ({
			icon: 'box-arrow-in-down',
			what: `Received from ${htmlSafe(move.supplier)}`,
			detail: `${htmlSafe(move.ref)} · ${place}`,
		}),
		out: (move, place) => ({
			icon: 'truck',
			what: `Shipped to <a href="shoppers.html">${htmlSafe(move.customer)}</a>`,
			detail: `<a href="order-details.html?id=${encodeURIComponent(move.order)}">Order ${htmlSafe(move.order)}</a> · ${place}`,
		}),
		move: (move, place) => ({
			icon: 'arrow-left-right',
			what: `Moved to ${htmlSafe(locationById(move.to).name)}`,
			detail: `${htmlSafe(move.ref)} · from ${place}`,
		}),
		count: (move, place) => ({
			icon: 'clipboard-check',
			what: 'Count corrected',
			detail: `${htmlSafe(move.note)} · ${place}`,
		}),
	};

	/* Copy for each entry mode: heading, subline, quantity label and button. */
	const ENTRY_COPY = {
		receive: {
			title: 'Receive stock',
			sub: 'Book a delivery in so it counts as on hand.',
			qtyLabel: 'Units received',
			submit: 'Book it in',
			min: '1',
		},
		count: {
			title: 'Correct a count',
			sub: 'Type what’s on the shelf to fix the record.',
			qtyLabel: 'Units on the shelf',
			submit: 'Save count',
			min: '0',
		},
	};

	const stillMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

	const nodes = {
		restock: pick('[data-whs-restock]', screen),
		flowCanvas: pick('[data-whs-flow-chart]', screen),
		ringCanvas: pick('[data-whs-ring]', screen),
		siteList: pick('[data-whs-sites]', screen),
		siteFilter: pick('[data-whs-site]', screen),
		statusFilter: pick('[data-whs-status]', screen),
		query: pick('[data-whs-search]', screen),
		tableBody: pick('[data-whs-rows]', screen),
		resultCount: pick('[data-whs-count]', screen),
		quickView: document.getElementById('whs-record'),
		entry: document.getElementById('whs-move'),
	};
	const entryForm = pick('[data-whs-move-form]', nodes.entry);
	const entryFields = {
		product: pick('[data-whs-move-product]', nodes.entry),
		order: pick('[data-whs-move-po]', nodes.entry),
		units: pick('[data-whs-move-qty]', nodes.entry),
		preview: pick('[data-whs-move-after]', nodes.entry),
		sites: pick('[data-whs-move-sites]', nodes.entry),
	};

	const state = {
		period: 'weeks',
		sortBy: 'status',
		ascending: true,
		quickViewSku: null,
		/* The quantity is only judged after Save has been pressed once. */
		saveAttempted: false,
	};
	let flowChart = null;
	let siteRing = null;
	let quickViewDrawer = null;
	let entryDrawer = null;

	start();

	/** Binds the charts, filters, table and drawers, then draws the three data panels. */
	function start() {
		wireFlowChart();
		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() => {
				if (flowChart) drawFlowChart(false);
				if (siteRing) {
					siteRing.destroy();
					siteRing = null;
					drawRing(false);
				}
			});
		});
		wireLocations();
		wireTable();
		wireQuickView();
		wireEntryDrawer();
		redraw();
	}

	/* General helpers. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function grouped(value) {
		return Number(value).toLocaleString('en-US');
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (ch) => entities[ch]);
	}

	function cssToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	function shortDate(iso) {
		return Basalt.toLocalDay(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function daysAhead(iso) {
		return Math.round((new Date(`${iso}T00:00:00`) - new Date(`${AS_OF}T00:00:00`)) / 86400000);
	}

	/** ", in 5 days" or ", tomorrow" after a due date; nothing once it is today or past. */
	function arrivalHint(iso) {
		const gap = daysAhead(iso);
		if (gap > 1) return `, in ${gap} days`;
		return gap === 1 ? ', tomorrow' : '';
	}

	/** "A", "A and B", or "A, B and C". */
	function joinNames(names) {
		if (names.length < 2) return names[0];
		return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
	}

	function countPhrase(count, singular, pluralForm) {
		return `${SMALL_COUNTS[count] || grouped(count)} ${count === 1 ? singular : pluralForm}`;
	}

	function productUrl(sku) {
		return `product-details.html?sku=${encodeURIComponent(sku)}`;
	}

	/* Stock arithmetic. */

	function locationById(id) {
		return LOCATIONS.find((location) => location.id === id);
	}

	function itemBySku(sku) {
		return items.find((item) => item.sku === sku);
	}

	function stockState(onHand, reserved, threshold) {
		const free = onHand - reserved;
		if (free <= 0) return 'out';
		return free < threshold ? 'low' : 'ok';
	}

	function siteState(item, siteId) {
		const [onHand, reserved, threshold] = item.perSite[siteId];
		return stockState(onHand, reserved, threshold);
	}

	/**
	 * One product's figures at one location, or summed over all of them when
	 * where is 'all'. shortAt lists the locations running low while the overall
	 * total still looks healthy.
	 */
	function measure(item, where) {
		const siteIds = where === 'all' ? LOCATIONS.map((location) => location.id) : [where];
		let onHand = 0;
		let reserved = 0;
		let reorder = 0;
		for (const siteId of siteIds) {
			const [held, promised, threshold] = item.perSite[siteId];
			onHand += held;
			reserved += promised;
			reorder += threshold;
		}
		return {
			onHand,
			reserved,
			reorder,
			avail: Math.max(0, onHand - reserved),
			status: stockState(onHand, reserved, reorder),
			incoming: inbound.filter((order) => order.sku === item.sku && (where === 'all' || order.site === where)),
			shortAt: where === 'all' ? LOCATIONS.filter((location) => siteState(item, location.id) !== 'ok') : [],
		};
	}

	function coverRatio(stock) {
		return stock.avail / Math.max(stock.reorder, 1);
	}

	/* Short or out, with nothing already ordered. */
	function wantsReorder(stock) {
		return stock.status !== 'ok' && !stock.incoming.length;
	}

	function productTile(item, extraClass = '', extraAttrs = '') {
		return `<span class="whs-tile${extraClass}" style="--whs-tone: var(--basalt-series-${item.tone})" aria-hidden="true"${extraAttrs}><i class="bi bi-${item.icon}"></i></span>`;
	}

	function stateChip(status) {
		const look = STOCK_STATES[status];
		return `<span class="basalt-status basalt-status-dot basalt-status-${look.tone}">${look.label}</span>`;
	}

	function redraw() {
		drawRestock();
		drawLocations();
		drawTable();
	}

	/* Restock: products to order now come first, then deliveries by due date. */

	function drawRestock() {
		const toOrder = items.filter((item) => wantsReorder(measure(item, 'all')));
		const arriving = [...inbound].sort((left, right) => left.due.localeCompare(right.due));

		const sections = [];
		if (toOrder.length) {
			sections.push(
				restockGroup(
					'warning',
					'Order now',
					toOrder.map((item) => {
						const stock = measure(item, 'all');
						return restockLine(
							item,
							`<a href="${productUrl(item.sku)}">${htmlSafe(item.name)}</a>`,
							`${grouped(stock.avail)} free, reorder below ${grouped(stock.reorder)}`,
							'<a class="btn btn-outline-secondary btn-sm" href="purchase-orders.html">Reorder</a>',
						);
					}),
				),
			);
		}
		if (arriving.length) {
			sections.push(
				restockGroup(
					'info',
					'On the way',
					arriving.map((order) => {
						const item = itemBySku(order.sku);
						return restockLine(
							item,
							`${grouped(order.qty)} × <a href="${productUrl(item.sku)}">${htmlSafe(item.name)}</a>`,
							`<a href="purchase-orders.html">${htmlSafe(order.po)}</a>, due ${shortDate(order.due)} at ${locationById(order.site).name}`,
							`<button type="button" class="btn btn-outline-secondary btn-sm" data-whs-receive-po="${order.po}" data-whs-receive-sku="${order.sku}">Receive</button>`,
						);
					}),
				),
			);
		}

		nodes.restock.innerHTML =
			sections.join('') ||
			Basalt.emptyState({
				icon: 'check2-circle',
				title: 'Nothing to restock',
				text: 'Every product is above its reorder point and no deliveries are due.',
				clear: false,
			});
		pick('[data-whs-restock-sub]', screen).textContent =
			`${countPhrase(toOrder.length, 'product', 'products')} to order, ${countPhrase(arriving.length, 'delivery', 'deliveries').toLowerCase()} on the way.`;
	}

	function restockGroup(tone, title, lines) {
		return (
			`<section class="whs-restock-group"><h3 class="whs-restock-title"><span class="basalt-status basalt-status-dot basalt-status-${tone}">${title}</span></h3>` +
			`<ul class="whs-restock-list">${lines.join('')}</ul></section>`
		);
	}

	function restockLine(item, what, detail, action) {
		return `<li class="whs-restock-item">${productTile(item)}<div class="whs-restock-text"><p class="whs-restock-what">${what}</p><p class="whs-restock-sub">${detail}</p></div>${action}</li>`;
	}

	/* Color arithmetic for the chart canvases, which cannot read color-mix(). */

	function channels(color) {
		const text = String(color || '').trim();
		const hex = /^#([0-9a-f]{6})$/i.exec(text);
		if (hex) {
			const packed = parseInt(hex[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(text);
		if (functional)
			return functional[1]
				.split(',')
				.slice(0, 3)
				.map((part) => parseFloat(part));
		return [128, 128, 128];
	}

	function tint(color, alpha) {
		const [red, green, blue] = channels(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	/** Blends two colors, weight being the share of the first one. */
	function blend(first, second, weight) {
		const from = channels(first);
		const to = channels(second);
		const [red, green, blue] = from.map((value, slot) => Math.round(value * weight + to[slot] * (1 - weight)));
		return `rgb(${red}, ${green}, ${blue})`;
	}

	function tooltipLook(surface, ink) {
		return {
			backgroundColor: surface,
			titleColor: ink,
			bodyColor: ink,
			borderColor: cssToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			borderWidth: 1,
			padding: 10,
			cornerRadius: 8,
			boxPadding: 4,
			usePointStyle: true,
			titleFont: { family: TYPEFACE, size: 12, weight: '600' },
			bodyFont: { family: TYPEFACE, size: 12 },
		};
	}

	/* Stock in and out: weekly or monthly bars, built once scrolled near. */

	function wireFlowChart() {
		for (const choice of pickAll('input[name="whs-flow"]', screen)) {
			choice.addEventListener('change', () => {
				if (!choice.checked) return;
				state.period = choice.value;
				drawFlowChart(true);
				writeFlowTotals();
			});
		}

		const canvas = nodes.flowCanvas;
		if (!canvas) return;
		writeFlowTotals();
		if (!('IntersectionObserver' in window)) {
			drawFlowChart(false);
			return;
		}
		const watcher = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watcher.disconnect();
				drawFlowChart(true);
			},
			{ rootMargin: '80px 0px' },
		);
		watcher.observe(canvas);
	}

	function drawFlowChart(animate) {
		if (typeof Chart === 'undefined' || !nodes.flowCanvas) return;
		flowChart?.destroy();
		const ink = cssToken('--basalt-copy', '#12233a');
		const muted = blend(cssToken('--basalt-copy-muted', '#5f7186'), ink, 0.82);
		const series = FLOW_SERIES[state.period];
		const tickLook = { color: muted, font: { family: TYPEFACE, size: 11.5 }, padding: 6 };
		const barLook = {
			borderRadius: 4,
			borderSkipped: false,
			maxBarThickness: 26,
			categoryPercentage: 0.5,
			barPercentage: 0.86,
		};

		flowChart = new Chart(nodes.flowCanvas, {
			type: 'bar',
			data: {
				labels: [...series.ticks],
				datasets: [
					{
						label: 'Received',
						data: [...series.received],
						backgroundColor: window.Basalt.series(2, 0, '#00a3c4'),
						...barLook,
					},
					{
						label: 'Shipped',
						data: [...series.shipped],
						backgroundColor: window.Basalt.series(5, 0, '#f0a93c'),
						...barLook,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: animate && !stillMotion.matches ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				plugins: {
					legend: { display: false },
					tooltip: {
						...tooltipLook(cssToken('--basalt-plane', '#ffffff'), ink),
						callbacks: {
							label: (context) => ` ${context.dataset.label}: ${grouped(context.parsed.y)} units`,
						},
					},
				},
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: { maxRotation: 0, autoSkipPadding: 12, ...tickLook },
					},
					y: {
						beginAtZero: true,
						grid: { color: tint(ink, 0.07) },
						border: { display: false },
						ticks: { maxTicksLimit: 5, callback: (value) => grouped(value), ...tickLook },
					},
				},
			},
		});
	}

	function writeFlowTotals() {
		const series = FLOW_SERIES[state.period];
		const sum = (list) => list.reduce((total, value) => total + value, 0);
		const received = sum(series.received);
		const shipped = sum(series.shipped);
		pick('[data-whs-flow-total="in"]', screen).textContent = grouped(received);
		pick('[data-whs-flow-total="out"]', screen).textContent = grouped(shipped);
		nodes.flowCanvas.setAttribute(
			'aria-label',
			`Bar chart: ${grouped(received)} units received and ${grouped(shipped)} shipped ${series.span}, ${series.unit} by ${series.unit}.`,
		);
	}

	/* Stock by location: a ring beside a list. Picking a location keeps its
     slice in color, fades the rest and filters the table to it. */

	function wireLocations() {
		for (const location of LOCATIONS) {
			const option = document.createElement('option');
			option.value = location.id;
			option.textContent = location.name;
			nodes.siteFilter.appendChild(option);
		}

		if (nodes.ringCanvas) {
			if ('IntersectionObserver' in window) {
				const watcher = new IntersectionObserver((entries) => {
					if (!entries.some((entry) => entry.isIntersecting)) return;
					watcher.disconnect();
					drawRing(true);
				});
				watcher.observe(nodes.ringCanvas);
			} else {
				drawRing(false);
			}
		}

		nodes.siteList.addEventListener('click', (event) => {
			const button = event.target.closest('[data-whs-site-pick]');
			if (!button) return;
			const siteId = button.getAttribute('data-whs-site-pick');
			nodes.siteFilter.value = nodes.siteFilter.value === siteId ? 'all' : siteId;
			nodes.siteFilter.dispatchEvent(new Event('change', { bubbles: true }));
			button.blur();
		});
	}

	function locationTotals() {
		return LOCATIONS.map((location) => {
			const figures = items.map((item) => measure(item, location.id));
			return {
				location,
				onHand: figures.reduce((total, stock) => total + stock.onHand, 0),
				short: figures.filter((stock) => stock.status !== 'ok').length,
			};
		});
	}

	function drawRing(animate) {
		if (typeof Chart === 'undefined' || !nodes.ringCanvas) return;
		const totals = locationTotals();
		const chosen = nodes.siteFilter.value;
		const surface = cssToken('--basalt-plane', '#ffffff');
		const fills = totals.map(({ location }) => {
			const color = window.Basalt.series(location.tone, 0, '#2b6fd4');
			return chosen === 'all' || chosen === location.id ? color : blend(color, surface, 0.22);
		});
		const amounts = totals.map((entry) => entry.onHand);

		/* A plain refresh repaints the existing ring without animating it. */
		if (siteRing && !animate) {
			Object.assign(siteRing.data.datasets[0], {
				data: amounts,
				backgroundColor: fills,
				hoverBackgroundColor: fills,
				borderColor: surface,
			});
			siteRing.update('none');
			return;
		}

		siteRing?.destroy();
		if (!nodes.ringCanvas.dataset.whsCenter) {
			nodes.ringCanvas.dataset.whsCenter = 'on';
			nodes.ringCanvas.addEventListener('mouseleave', () => ringCenter());
		}
		siteRing = new Chart(nodes.ringCanvas, {
			type: 'doughnut',
			data: {
				labels: totals.map((entry) => entry.location.name),
				datasets: [
					{
						data: amounts,
						backgroundColor: fills,
						hoverBackgroundColor: fills,
						borderColor: surface,
						borderWidth: 3,
						hoverOffset: 0,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				cutout: '72%',
				animation:
					animate && !stillMotion.matches
						? { duration: 500, easing: 'easeOutQuart', animateRotate: true }
						: false,
				onHover: (event, slices) => ringCenter(slices[0]?.index),
				plugins: {
					legend: { display: false },
					tooltip: { enabled: false },
				},
			},
		});
	}

	/* The ring's middle names the location under the pointer, and goes back
	   to the units on hand once the pointer leaves. */
	function ringCenter(index) {
		const total = pick('[data-whs-ring-total]', screen);
		const label = pick('[data-whs-ring-label]', screen);
		const name = siteRing?.data.labels[index];
		if (name === undefined) {
			if (ringCenter.shown) [total.textContent, label.textContent] = ringCenter.shown;
			ringCenter.shown = null;
			return;
		}
		ringCenter.shown ??= [total.textContent, label.textContent];
		total.textContent = grouped(siteRing.data.datasets[0].data[index]);
		label.textContent = name;
	}

	function drawLocations() {
		const totals = locationTotals();
		const overall = totals.reduce((sum, entry) => sum + entry.onHand, 0);
		const chosen = nodes.siteFilter.value;
		const showAll = chosen === 'all';

		pick('[data-whs-ring-total]', screen).textContent = grouped(
			showAll ? overall : totals.find((entry) => entry.location.id === chosen).onHand,
		);
		pick('[data-whs-ring-label]', screen).textContent = showAll
			? 'units on hand'
			: `at ${locationById(chosen).name}`;
		nodes.ringCanvas.setAttribute(
			'aria-label',
			`Ring chart of units on hand: ${totals.map((entry) => `${entry.location.name} ${grouped(entry.onHand)}`).join(', ')}.`,
		);
		nodes.siteList.innerHTML = totals.map((entry) => locationButton(entry, chosen, overall)).join('');

		if (siteRing) drawRing(false);
	}

	function locationButton({ location, onHand, short }, chosen, overall) {
		const picked = chosen === location.id;
		const note = short
			? `${short === 1 ? '1 product' : `${short} products`} running low`
			: 'Everything above its reorder point';
		const share = Math.round((onHand / (overall || 1)) * 100);
		return (
			`<li><button type="button" class="whs-site${picked ? ' is-picked' : ''}" aria-pressed="${picked}" data-whs-site-pick="${location.id}" style="--whs-tone: var(--basalt-series-${location.tone})">` +
			'<span class="whs-site-dot" aria-hidden="true"></span>' +
			`<span class="whs-site-who"><span class="whs-site-name">${htmlSafe(location.name)}</span><span class="whs-site-note${short ? ' whs-site-note-low' : ''}">${note}</span></span>` +
			`<span class="whs-site-value">${grouped(onHand)}<span class="whs-site-unit">${share}%</span></span></button></li>`
		);
	}

	/* The stock table, its filters and sorting, and clicks anywhere on the page. */

	function wireTable() {
		nodes.query.addEventListener('input', drawTable);
		nodes.statusFilter.addEventListener('change', drawTable);
		nodes.siteFilter.addEventListener('change', () => {
			drawLocations();
			drawTable();
		});

		for (const button of pickAll('[data-whs-sort]', screen)) {
			button.addEventListener('click', () => {
				const column = button.getAttribute('data-whs-sort');
				if (state.sortBy === column) {
					state.ascending = !state.ascending;
				} else {
					state.sortBy = column;
					/* Words read A to Z first; quantities start with the largest. */
					state.ascending = column === 'name' || column === 'status';
				}
				drawTable();
			});
		}

		screen.addEventListener('auxclick', (event) => {
			const url = event.button === 1 && rowLink(event);
			if (url) window.open(url, '_blank');
		});
		screen.addEventListener('click', onScreenClick);
	}

	function onScreenClick(event) {
		for (const [selector, run] of CLICK_ACTIONS) {
			const target = event.target.closest(selector);
			if (target) {
				run(target);
				return;
			}
		}
		/* Anywhere else on a row opens the product's page like its name does;
       Cmd, Ctrl or Shift sends it to a new tab. The panel icon is the quick view. */
		const url = rowLink(event);
		if (!url) return;
		if (event.metaKey || event.ctrlKey || event.shiftKey) window.open(url, '_blank');
		else location.href = url;
	}

	function rowLink(event) {
		const row = event.target.closest('tr[data-whs-sku]');
		if (!row || event.target.closest('a, button, .dropdown-menu')) return '';
		return pick('.whs-prod-name', row).href;
	}

	function tableRows() {
		const where = nodes.siteFilter.value;
		const wanted = nodes.statusFilter.value;
		const text = nodes.query.value.trim();
		const direction = state.ascending ? 1 : -1;
		const compare = SORTERS[state.sortBy];

		return items
			.map((item) => ({ item, stock: measure(item, where) }))
			.filter(({ item, stock }) => {
				if (text && !Basalt.matchesQuery(`${item.name} ${item.sku} ${item.category} ${item.maker}`, text))
					return false;
				if (wanted === 'reorder') return wantsReorder(stock);
				return wanted === 'all' || stock.status === wanted;
			})
			.sort((left, right) => compare(left, right) * direction || left.item.name.localeCompare(right.item.name));
	}

	/** The availability meter runs to twice the reorder point, so the marker sits mid-track. */
	function availabilityMeter(stock) {
		const ceiling = Math.max(stock.reorder * 2, 1);
		const fill = Math.min(100, (stock.avail / ceiling) * 100);
		return `<span class="whs-meter whs-meter-${stock.status}" aria-hidden="true"><span class="whs-meter-fill" style="width:${fill.toFixed(1)}%"></span><span class="whs-meter-mark"></span></span>`;
	}

	function tableRow({ item, stock }) {
		const firstOrder = stock.incoming[0];
		const arriving = stock.incoming.reduce((total, order) => total + order.qty, 0);
		const lowElsewhere =
			stock.status === 'ok' && stock.shortAt.length
				? `Low at ${joinNames(stock.shortAt.map((location) => location.name))}`
				: '';
		const name = htmlSafe(item.name);
		const url = productUrl(item.sku);

		let primaryAction = '';
		if (firstOrder)
			primaryAction = `<button type="button" class="btn btn-outline-secondary btn-sm" data-whs-receive="${item.sku}">Receive</button>`;
		else if (stock.status !== 'ok')
			primaryAction = '<a class="btn btn-outline-secondary btn-sm" href="purchase-orders.html">Reorder</a>';

		const incomingCell = arriving
			? `<span class="whs-num">${grouped(arriving)}<span class="whs-narrow"> incoming</span></span><span class="whs-sub">Due ${shortDate(firstOrder.due)}</span>`
			: '<span class="whs-none">None<span class="whs-narrow"> on order</span></span>';

		const menu =
			'<ul class="dropdown-menu dropdown-menu-end">' +
			`<li><button type="button" class="dropdown-item" data-whs-receive="${item.sku}"><i class="bi bi-box-arrow-in-down" aria-hidden="true"></i>Receive stock</button></li>` +
			`<li><button type="button" class="dropdown-item" data-whs-count="${item.sku}"><i class="bi bi-clipboard-check" aria-hidden="true"></i>Correct a count</button></li>` +
			'<li><a class="dropdown-item" href="stock-transfers.html"><i class="bi bi-arrow-left-right" aria-hidden="true"></i>Move between locations</a></li></ul>';

		const actions =
			`<div class="whs-act">${primaryAction}<div class="basalt-row-actions">` +
			`<button type="button" class="btn btn-icon btn-sm" data-whs-open="${item.sku}" aria-label="Quick view: ${name}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>` +
			`<a class="btn btn-icon btn-sm" href="${url}" aria-label="Open full page: ${name}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>` +
			`<div class="dropdown"><button type="button" class="btn btn-icon btn-sm" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="More for ${name}"><i class="bi bi-three-dots" aria-hidden="true"></i></button>${menu}</div>` +
			'</div></div>';

		return (
			`<tr data-whs-sku="${item.sku}">` +
			`<td><div class="whs-prod">${productTile(item)}<div class="whs-prod-text"><a class="whs-prod-name" href="${url}">${name}</a><span class="whs-prod-sku">${htmlSafe(item.sku)}</span></div></div></td>` +
			`<td class="whs-col-num whs-col-onhand"><span class="whs-num">${grouped(stock.onHand)}</span><span class="whs-sub">${grouped(stock.reserved)} reserved</span></td>` +
			`<td class="whs-col-avail"><div class="whs-avail"><span class="whs-num">${grouped(stock.avail)}<span class="whs-narrow"> available</span></span>${availabilityMeter(stock)}</div><span class="whs-sub">Reorder below ${grouped(stock.reorder)}</span></td>` +
			`<td class="whs-col-incoming">${incomingCell}</td>` +
			`<td class="whs-col-status">${stateChip(stock.status)}${lowElsewhere ? `<span class="whs-sub">${htmlSafe(lowElsewhere)}</span>` : ''}</td>` +
			`<td class="whs-col-act">${actions}</td></tr>`
		);
	}

	function drawTable() {
		const shown = tableRows();
		const where = nodes.siteFilter.value;
		const narrowed = nodes.statusFilter.value !== 'all' || where !== 'all';

		if (shown.length) {
			nodes.tableBody.innerHTML = shown.map(tableRow).join('');
			window.Basalt.tips?.(nodes.tableBody);
		} else {
			const reset = narrowed
				? '<div class="whs-reset"><button type="button" class="btn btn-sm btn-outline-secondary" data-whs-reset>Show everything</button></div>'
				: '';
			nodes.tableBody.innerHTML = `<tr class="basalt-empty-row"><td colspan="6">${Basalt.emptyState(emptyTableState(where, narrowed))}${reset}</td></tr>`;
		}

		const total = items.length;
		nodes.resultCount.textContent =
			shown.length === total ? `${total} products` : `${shown.length} of ${total} products`;
		pick('[data-whs-stock-sub]', screen).textContent =
			where === 'all'
				? 'Every boxed product, with what’s free to sell and when to reorder.'
				: `Stock held at ${locationById(where).name}, ${locationById(where).region}.`;

		syncSortHeaders();
	}

	function emptyTableState(where, narrowed) {
		const text = nodes.query.value.trim();
		if (text) {
			return {
				query: text,
				noun: 'products',
				text: narrowed ? 'Check the spelling, or show every location and status.' : '',
			};
		}
		const missing = { out: 'out of stock', reorder: 'needs reordering' }[nodes.statusFilter.value] || 'matches';
		const place = where === 'all' ? '' : ` at ${htmlSafe(locationById(where).name)}`;
		return {
			icon: 'box-seam',
			title: `Nothing ${missing}${place}`,
			text: 'Good news. Pick another status to see the rest.',
			clear: false,
		};
	}

	function syncSortHeaders() {
		for (const header of pickAll('th[aria-sort]', screen)) {
			const button = pick('[data-whs-sort]', header);
			const active = button?.getAttribute('data-whs-sort') === state.sortBy;
			header.setAttribute('aria-sort', active ? (state.ascending ? 'ascending' : 'descending') : 'none');
			const arrow = button && pick('.bi', button);
			if (!arrow) continue;
			let shape = 'bi-arrow-down-up';
			if (active) shape = state.ascending ? 'bi-arrow-up' : 'bi-arrow-down';
			arrow.className = `bi ${shape}`;
		}
	}

	/* The quick-view drawer: status, free stock per location, orders and movements. */

	function wireQuickView() {
		quickViewDrawer = bootstrap.Offcanvas.getOrCreateInstance(nodes.quickView);
		nodes.quickView.addEventListener('click', (event) => {
			const orderButton = event.target.closest('[data-whs-receive-po]');
			if (orderButton) {
				handOff('receive', state.quickViewSku, orderButton.getAttribute('data-whs-receive-po'));
				return;
			}
			if (event.target.closest('[data-whs-r="receive"]')) handOff('receive', state.quickViewSku, null);
		});
	}

	function openQuickView(sku) {
		state.quickViewSku = sku;
		fillQuickView();
		quickViewDrawer.show();
	}

	/** Only one drawer is open at a time, so the entry form waits for this one to close. */
	function handOff(kind, sku, po) {
		nodes.quickView.addEventListener('hidden.bs.offcanvas', () => openEntry(kind, sku, po), { once: true });
		quickViewDrawer.hide();
	}

	function quickViewSummary(item, stock) {
		let summary =
			stock.status === 'out'
				? 'None free to sell at any location.'
				: `${grouped(stock.avail)} free to sell, after ${grouped(stock.reserved)} reserved for open orders.`;
		if (stock.incoming.length) {
			const [next] = stock.incoming;
			summary += ` ${grouped(next.qty)} more arrive at ${locationById(next.site).name} on ${shortDate(next.due)}.`;
		} else if (stock.status !== 'ok') {
			summary += ` Nothing is on order, and ${item.maker} takes about ${item.leadDays} days to deliver.`;
		} else if (stock.shortAt.length) {
			summary += ` ${joinNames(stock.shortAt.map((location) => location.name))} could take some from another location.`;
		}
		return summary;
	}

	function fillQuickView() {
		const panel = nodes.quickView;
		const item = itemBySku(state.quickViewSku);
		const stock = measure(item, 'all');

		pick('[data-whs-r="tile"]', panel).outerHTML = productTile(item, ' whs-tile-lg', ' data-whs-r="tile"');
		pick('[data-whs-r="name"]', panel).textContent = item.name;
		pick('[data-whs-r="full"]', panel).href = productUrl(item.sku);
		pick('[data-whs-r="sub"]', panel).textContent = `${item.sku} · ${item.category} · ${item.maker}`;

		const bySite = LOCATIONS.map((location) => {
			const [onHand, reserved, reorder] = item.perSite[location.id];
			return {
				location,
				free: Math.max(0, onHand - reserved),
				reorder,
				status: stockState(onHand, reserved, reorder),
			};
		});
		const scaleTop = Math.max(...bySite.map((entry) => Math.max(entry.free, entry.reorder * 2))) || 1;
		const rankRows = bySite
			.map((entry) => {
				const width = Math.max(entry.free ? 2 : 0, (entry.free / scaleTop) * 100).toFixed(1);
				const mark = ((entry.reorder / scaleTop) * 100).toFixed(1);
				return (
					`<li class="whs-rank-row whs-rank-row-${entry.status}"><span class="whs-rank-name">${htmlSafe(entry.location.name)}</span>` +
					`<span class="whs-rank-bar" aria-hidden="true"><span class="whs-rank-fill" style="width:${width}%"></span><span class="whs-rank-mark" style="left:${mark}%"></span></span>` +
					`<span class="whs-rank-value">${grouped(entry.free)}</span></li>`
				);
			})
			.join('');

		const orderRows = stock.incoming
			.map(
				(order) =>
					'<li class="whs-po"><span class="whs-po-icon" aria-hidden="true"><i class="bi bi-truck"></i></span>' +
					`<div class="whs-po-text"><p class="whs-po-what"><a href="purchase-orders.html">${htmlSafe(order.po)}</a> · ${grouped(order.qty)} units</p>` +
					`<p class="whs-po-sub">To ${locationById(order.site).name}, due ${shortDate(order.due)}${arrivalHint(order.due)}</p></div>` +
					`<button type="button" class="btn btn-outline-secondary btn-sm" data-whs-receive-po="${order.po}">Receive</button></li>`,
			)
			.join('');
		const ordersSection = orderRows
			? `<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">On the way</h3><ul class="whs-pos">${orderRows}</ul></section>`
			: '';
		const movements = (history[item.sku] || []).slice(0, 4).map(movementRow).join('');

		pick('[data-whs-r="body"]', panel).innerHTML =
			`<div class="basalt-drawer-section">${stateChip(stock.status)}<p class="whs-say">${quickViewSummary(item, stock)}</p></div>` +
			`<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">Free to sell by location</h3><ul class="whs-rank">${rankRows}</ul>` +
			`<p class="whs-rank-key"><span class="whs-rank-keymark" aria-hidden="true"></span>Marks each location’s reorder point</p></section>${
				ordersSection
			}<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">Recent movements</h3><ul class="whs-moves">${movements}</ul></section>`;

		/* Reorder is offered only when stock is short and nothing is coming. */
		pick('[data-whs-r="reorder"]', panel).hidden = !wantsReorder(stock);
	}

	function movementRow(move) {
		const describe = Object.hasOwn(MOVEMENT_TEXT, move.kind) ? MOVEMENT_TEXT[move.kind] : MOVEMENT_TEXT.count;
		const { icon, what, detail } = describe(move, locationById(move.site).name);
		let amount = grouped(move.qty);
		if (move.kind !== 'move') amount = `${move.qty > 0 ? '+' : '−'}${grouped(Math.abs(move.qty))}`;
		return (
			`<li class="whs-moves-item whs-moves-item-${move.kind}"><span class="whs-moves-icon" aria-hidden="true"><i class="bi bi-${icon}"></i></span>` +
			`<div class="whs-moves-text"><p class="whs-moves-what">${what}</p><p class="whs-moves-sub">${detail}</p></div>` +
			`<div class="whs-moves-end"><span class="whs-moves-qty">${amount}</span><span class="whs-moves-date">${shortDate(move.date)}</span></div></li>`
		);
	}

	/* The entry drawer books a delivery in, or replaces a location's count. */

	function wireEntryDrawer() {
		entryDrawer = bootstrap.Offcanvas.getOrCreateInstance(nodes.entry);

		for (const item of items) {
			const option = document.createElement('option');
			option.value = item.sku;
			option.textContent = item.name;
			option.setAttribute('data-hint', item.sku);
			entryFields.product.appendChild(option);
		}
		entryFields.sites.insertAdjacentHTML(
			'beforeend',
			LOCATIONS.map(
				(location) =>
					`<label class="basalt-choice"><input type="radio" name="site" value="${location.id}">${htmlSafe(location.name)}</label>`,
			).join(''),
		);

		nodes.entry.addEventListener('change', onEntryChange);
		entryFields.units.addEventListener('input', () => {
			if (state.saveAttempted) entryFields.units.classList.toggle('is-invalid', !unitsValid());
			describeOutcome();
		});
		entryForm.addEventListener('submit', saveEntry);
	}

	function entryKind() {
		return pick('input[name="invKind"]:checked', nodes.entry)?.value || 'receive';
	}

	function chosenSite() {
		return pick('input[name="site"]:checked', nodes.entry)?.value;
	}

	function chooseSite(siteId) {
		for (const radio of pickAll('input[name="site"]', nodes.entry)) radio.checked = radio.value === siteId;
	}

	function setUnits(amount) {
		const input = entryFields.units;
		input.value = amount;
		input.dispatchEvent(new Event('input', { bubbles: true }));
	}

	function unitsValid() {
		const amount = parseInt(entryFields.units.value, 10);
		return Number.isFinite(amount) && amount >= (entryKind() === 'receive' ? 1 : 0);
	}

	/** Lists the chosen product's open orders; picking one later fills its site and quantity. */
	function listOrders(preferred) {
		const select = entryFields.order;
		const open = inbound.filter((order) => order.sku === entryFields.product.value);
		const options = open.map(
			(order) =>
				`<option value="${order.po}" data-hint="${grouped(order.qty)} units, due ${shortDate(order.due)}">${order.po} from ${htmlSafe(order.supplier)}</option>`,
		);
		select.innerHTML = `${options.join('')}<option value="">No purchase order</option>`;
		if (preferred && open.some((order) => order.po === preferred)) select.value = preferred;
		else select.value = open[0]?.po ?? '';
		window.Basalt.select?.refresh?.(select);
	}

	function selectedOrder() {
		return inbound.find((order) => order.po === entryFields.order.value);
	}

	function useSelectedOrder() {
		const order = selectedOrder();
		if (!order) return;
		chooseSite(order.site);
		setUnits(order.qty);
	}

	function applyEntryKind() {
		const kind = entryKind();
		for (const block of pickAll('[data-whs-only]', nodes.entry))
			block.hidden = block.getAttribute('data-whs-only') !== kind;
		const copy = kind === 'receive' ? ENTRY_COPY.receive : ENTRY_COPY.count;
		for (const key of ['title', 'sub', 'qtyLabel', 'submit']) {
			pick(`[data-whs-m="${key}"]`, nodes.entry).textContent = copy[key];
		}
		entryFields.units.min = copy.min;
	}

	function defaultUnits() {
		const counts = itemBySku(entryFields.product.value).perSite[chosenSite()];
		if (entryKind() === 'count') setUnits(counts ? counts[0] : 0);
		else if (!selectedOrder()) setUnits(1);
	}

	function describeOutcome() {
		const preview = entryFields.preview;
		const item = itemBySku(entryFields.product.value);
		const siteId = chosenSite();
		const amount = Math.max(0, parseInt(entryFields.units.value, 10) || 0);
		if (!item || !siteId) {
			preview.textContent = '';
			return;
		}
		const current = item.perSite[siteId][0];
		if (entryKind() === 'receive') {
			preview.textContent = `${locationById(siteId).name} goes from ${grouped(current)} to ${grouped(current + amount)} on hand.`;
			return;
		}
		const change = amount - current;
		if (change === 0) preview.textContent = `Matches the ${grouped(current)} on record.`;
		else
			preview.textContent = `${change > 0 ? `${grouped(change)} more` : `${grouped(-change)} fewer`} than the ${grouped(current)} on record.`;
	}

	function openEntry(kind, sku, po) {
		state.saveAttempted = false;
		entryFields.units.classList.remove('is-invalid');
		entryForm.reset();
		const modeRadio = pick(kind === 'count' ? '#whs-kind-count' : '#whs-kind-receive', nodes.entry);
		modeRadio.checked = true;
		/* The segmented control moves its highlight on the radio's change event. */
		modeRadio.dispatchEvent(new Event('change', { bubbles: true }));

		/* Without a product, start from the first one with a delivery due. */
		const startSku = sku || inbound[0]?.sku || items[0].sku;
		entryFields.product.value = startSku;
		listOrders(po);
		applyEntryKind();

		const order = selectedOrder();
		const item = itemBySku(startSku);
		const shortSite = LOCATIONS.find((location) => siteState(item, location.id) !== 'ok');
		let siteId = (shortSite || LOCATIONS[0]).id;
		if (nodes.siteFilter.value !== 'all') siteId = nodes.siteFilter.value;
		if (kind === 'receive' && order) siteId = order.site;
		chooseSite(siteId);

		if (kind === 'receive' && order) setUnits(order.qty);
		else defaultUnits();
		describeOutcome();
		entryDrawer.show();
	}

	function onEntryChange(event) {
		const target = event.target;
		if (target.name === 'invKind') {
			applyEntryKind();
			if (entryKind() === 'receive') useSelectedOrder();
			defaultUnits();
		} else if (target === entryFields.product) {
			listOrders(null);
			if (entryKind() === 'receive') useSelectedOrder();
			defaultUnits();
		} else if (target === entryFields.order) {
			useSelectedOrder();
			defaultUnits();
		} else if (target.name === 'site') {
			defaultUnits();
		}
		describeOutcome();
	}

	function saveEntry(event) {
		event.preventDefault();
		state.saveAttempted = true;
		const receiving = entryKind() === 'receive';
		const input = entryFields.units;
		pick('[data-whs-move-error]', nodes.entry).textContent = receiving
			? 'Enter at least 1 unit.'
			: 'Enter 0 or more units.';
		if (!unitsValid()) {
			input.classList.add('is-invalid');
			input.focus();
			return;
		}
		input.classList.remove('is-invalid');

		const item = itemBySku(entryFields.product.value);
		const siteId = chosenSite();
		const placeName = locationById(siteId).name;
		const amount = parseInt(input.value, 10);
		const counts = item.perSite[siteId];
		const note = (entryForm.elements.note.value || '').trim();
		const message = receiving
			? bookDelivery(item, siteId, counts, amount, placeName)
			: recordCount(item, siteId, counts, amount, placeName, note);

		entryDrawer.hide();
		redraw();
		window.Basalt.toasts.push(message);
	}

	/* Adds the delivery to on hand and shrinks or closes the order it came on. */
	function bookDelivery(item, siteId, counts, amount, placeName) {
		counts[0] += amount;
		const position = inbound.findIndex((order) => order.po === entryFields.order.value);
		const order = position > -1 ? inbound[position] : null;
		if (order) {
			if (amount >= order.qty) inbound.splice(position, 1);
			else order.qty -= amount;
		}
		history[item.sku].unshift({
			date: AS_OF,
			kind: 'in',
			qty: amount,
			site: siteId,
			ref: order ? order.po : 'No purchase order',
			supplier: order ? order.supplier : item.maker,
		});
		return {
			tone: 'success',
			title: `${grouped(amount)} × ${item.name} booked in`,
			text: `${placeName} now has ${grouped(counts[0])} on hand.`,
		};
	}

	/* Replaces on hand with the shelf count; reservations cannot exceed it. */
	function recordCount(item, siteId, counts, amount, placeName, note) {
		const change = amount - counts[0];
		counts[0] = amount;
		counts[1] = Math.min(counts[1], amount);
		if (change) {
			history[item.sku].unshift({
				date: AS_OF,
				kind: 'count',
				qty: change,
				site: siteId,
				note: note || entryForm.elements.reason.value,
			});
		}
		const text = change
			? `${placeName}: ${change > 0 ? '+' : '−'}${grouped(Math.abs(change))}, now ${grouped(amount)} on hand.`
			: `${placeName} already matched.`;
		return { tone: 'success', title: `Count saved for ${item.name}`, text };
	}
})();
