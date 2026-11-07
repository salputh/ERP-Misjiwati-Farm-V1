/**
 * Basalt - Storefront (storefront.html)
 * How the Marlo online shop shows each product: in the store or hidden,
 * on the front page, its badge and any sale price. Names, list prices,
 * stock, ratings and orders come from window.Basalt.shopBook (the Store
 * book, assets/basalt/js/data/multipurpose/store.js), the same book the Orders and Order
 * Details pages read,
 * so every page agrees. What is set here is demo state kept in memory;
 * in a real store it is saved to the store's API.
 */
(() => {
	'use strict';
	const page = pick('[data-sp-root]');
	const book = window.Basalt.shopBook;
	if (!page || !book || !window.Basalt.data || !window.Basalt.data.catalog) return;

	function start() {
		saleModal.addEventListener('show.bs.modal', () => {
			drawPicks();
			picksError.hidden = true;
			drawSaleSum();
		});
		saleModal.addEventListener('hidden.bs.modal', () => {
			preselect = '';
		});
		saleForm.addEventListener('change', () => {
			if (picked().length) picksError.hidden = true;
			drawSaleSum();
		});
		saleForm.addEventListener('submit', (e) => {
			e.preventDefault();
			const list = picked();
			if (!list.length) {
				picksError.hidden = false;
				const first = pick('input[name="sp-pick"]', picks);
				if (first) first.focus();
				return;
			}
			const before = list.map((it) => ({ it, sale: it.sale, ends: it.ends }));
			list.forEach((it) => {
				it.sale = salePrice(it);
				it.ends = saleEnds.value;
			});
			redraw();
			bootstrap.Modal.getOrCreateInstance(saleModal).hide();
			const until = saleEnds.value ? `until ${day(saleEnds.value)}` : 'until you end it';
			toast({
				tone: 'success',
				title: list.length === 1 ? `${list[0].name} is on sale` : `${list.length} products are on sale`,
				text: `${off()}% off, ${until}.`,
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							for (const b of before) {
								b.it.sale = b.sale;
								b.it.ends = b.ends;
							}

							redraw();
						},
					},
				],
			});
			announce(`${list.length} products put on sale`);
		});

		/* Export
		   A CSV of what the store shows, built in the browser. */
		pick('[data-sp-export]').addEventListener('click', () => {
			function q(v) {
				return `"${String(v).replace(/"/g, '""')}"`;
			}

			const lines = [
				['SKU', 'Product', 'Kind', 'List price', 'Sale price', 'Sale ends', 'Badge', 'In store', 'Front page']
					.map(q)
					.join(','),
			].concat(
				items.map((it) =>
					[
						it.sku,
						it.name,
						it.kind,
						it.list.toFixed(2),
						it.sale != null ? it.sale.toFixed(2) : '',
						it.ends,
						BADGES[shownBadge(it)] || '',
						it.listed ? 'Yes' : 'No',
						isFront(it) ? front.indexOf(it.sku) + 1 : '',
					]
						.map(q)
						.join(','),
				),
			);
			const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv' }));
			const a = document.createElement('a');
			a.href = url;
			a.download = 'marlo-shop-prices.csv';
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
			toast({
				tone: 'success',
				title: 'Price list downloaded',
				text: `${items.length} products in marlo-shop-prices.csv.`,
			});
		});

		drawCounts();
		redraw();
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function announce(text) {
		if (window.Basalt.announce) window.Basalt.announce(text);
	}

	function htmlSafe(s) {
		return String(s == null ? '' : s).replace(
			/[&<>"']/g,
			(c) =>
				({
					'&': '&amp;',
					'<': '&lt;',
					'>': '&gt;',
					'"': '&quot;',
					"'": '&#39;',
				})[c],
		);
	}

	const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

	function fmt(n) {
		return money.format(n);
	}

	function day(iso) {
		const d = window.Basalt.toLocalDay(iso);
		return `${d.toLocaleDateString('en-US', { month: 'short' })} ${d.getDate()}`;
	}

	/* Store settings per product
	   From the shared catalog (window.Basalt.data.catalog), as on the
	   Products and Product Details pages:
	   photo     path to the product shot (swap in your own images)
	   badge     '', 'new', 'staff' or 'limited'; a running sale shows Sale
	   ends      last day of a running sale ('' for no end date)
	   per       the recurring part of the price, in words
	   stars     ratings by score, 5 down to 1; they add up to the book's
	             review count and average to its rating
	   hidden    not shown in the store */
	const catalog = window.Basalt.data.catalog;
	const EXTRA = {};
	catalog.products().forEach((c) => {
		EXTRA[c.sku] = {
			photo: c.photo,
			badge: c.badge,
			stars: c.stars,
			ends: c.ends || '',
			per: c.per ? 'a month each' : c.fee ? `plus $${c.fee} a month` : '',
			hidden: !!c.hidden,
		};
	});
	const FRONT = catalog.front;
	const FRONT_MAX = 3;
	const KINDS = ['Clothing', 'Accessories', 'Extras', 'Services'];
	const BADGES = { sale: 'Sale', new: 'New', staff: 'Staff pick', limited: 'Limited stock' };
	const BADGE_TONE = { sale: 'danger', new: 'info', staff: 'primary', limited: 'warning' };

	const items = book.PRODUCTS.map((p) => {
		const x = EXTRA[p.sku] || { stars: [0, 0, 0, 0, 0] };
		return {
			sku: p.sku,
			name: p.name,
			maker: p.brand,
			kind: p.category,
			icon: p.icon,
			photo: x.photo || '',
			stock: p.stock,
			rating: p.rating,
			reviews: p.reviews,
			stars: x.stars,
			per: x.per || '',
			list: p.compareAtPrice || p.price,
			sale: p.compareAtPrice ? p.price : null,
			ends: p.compareAtPrice ? x.ends || '' : '',
			badge: x.badge || '',
			listed: !x.hidden,
		};
	});

	function bySku(sku) {
		return items.find((it) => it.sku === sku);
	}

	let front = FRONT.slice();

	function isFront(it) {
		return front.indexOf(it.sku) !== -1;
	}

	/* Small pieces */
	function kindTone(it) {
		return KINDS.indexOf(it.kind) + 1;
	}

	function shownBadge(it) {
		return it.sale != null ? 'sale' : it.badge;
	}

	function price(it) {
		return it.sale != null ? it.sale : it.list;
	}

	function canSale(it) {
		return it.stock != null && it.listed;
	}

	/* The product's own page, where everything else about it is edited. */
	function pageUrl(it) {
		return `product-details.html?sku=${encodeURIComponent(it.sku)}`;
	}

	/* The product photo over a tinted tile with its icon, so the card still
     reads while the photo loads or if it cannot be fetched. */
	function photo(it, w, h) {
		return `<span class="sp-photo sp-photo-${kindTone(it)}"><i class="bi ${htmlSafe(it.icon)}" aria-hidden="true"></i>${it.photo ? `<img src="${window.Basalt.photo(it.photo, w, h)}" alt="" width="${w}" height="${h}" loading="lazy" data-sp-img>` : ''}</span>`;
	}

	function availability(it) {
		if (it.stock == null) {
			return it.kind === 'Services'
				? { tone: 'primary', label: 'Bookable', line: 'Booked with a stylist or a tailor' }
				: { tone: 'info', label: 'Digital', line: 'Sent or joined online, so nothing ships' };
		}
		if (it.stock === 0)
			return { tone: 'danger', label: 'Backorder', line: 'On backorder, ships when stock arrives' };
		if (it.stock < 50) return { tone: 'warning', label: `Only ${it.stock} left`, line: `Only ${it.stock} left` };
		return { tone: 'success', label: 'In stock', line: 'In stock, ships the next working day' };
	}

	function starsRow(rating) {
		let out = '';
		for (let i = 1; i <= 5; i++) {
			const cls = rating >= i - 0.25 ? 'bi-star-fill' : rating >= i - 0.75 ? 'bi-star-half' : 'bi-star';
			out += `<i class="bi ${cls}" aria-hidden="true"></i>`;
		}
		return `<span class="sp-stars">${out}</span>`;
	}

	function ratingLine(it) {
		return `<p class="sp-rating">${starsRow(it.rating)}<span>${it.rating.toFixed(1)} <span class="sp-quiet">(${it.reviews})</span></span><span class="visually-hidden">, rated ${it.rating.toFixed(1)} out of 5 from ${it.reviews} ratings</span></p>`;
	}

	function priceLine(it) {
		return `<p class="sp-prices"><span class="sp-price">${fmt(price(it))}</span>${it.sale != null ? `<s class="sp-was"><span class="visually-hidden">was </span>${fmt(it.list)}</s>` : ''}${it.per ? `<span class="sp-per">${htmlSafe(it.per)}</span>` : ''}</p>`;
	}

	function badgeChip(it) {
		const b = shownBadge(it);
		return b ? `<span class="sp-chip sp-chip-${BADGE_TONE[b]}">${BADGES[b]}</span>` : '';
	}

	/* The product as a customer sees it: a wide card, photo on the left.
     On the front page its name opens the quick view; at the top of the
     quick view it also says whether and when it ships. */
	function storeTile(it, link) {
		const name = link
			? `<h3 class="sp-tile-name"><button type="button" class="sp-tile-open" data-sp-open="${it.sku}">${htmlSafe(it.name)}</button></h3>`
			: `<p class="sp-tile-name">${htmlSafe(it.name)}</p>`;
		return `<div class="sp-tile${it.listed ? '' : ' is-hidden'}"><div class="sp-tile-art">${photo(it, 360, 360)}${badgeChip(it)}</div><div class="sp-tile-body"><p class="sp-eyebrow">${htmlSafe(it.kind)} · ${htmlSafe(it.maker)}</p>${name}${ratingLine(it)}${priceLine(it)}${link ? '' : `<p class="sp-tile-avail">${it.listed ? htmlSafe(availability(it).line) : 'Hidden from the store'}</p>`}</div></div>`;
	}

	/* Front page */
	const frontList = pick('[data-sp-front]');
	function drawFront() {
		let html = front
			.map(
				(sku, i) =>
					`<li class="sp-front-item"><span class="sp-front-spot">Spot ${i + 1}</span>${storeTile(bySku(sku), true)}</li>`,
			)
			.join('');
		for (let i = front.length; i < FRONT_MAX; i++) {
			html += `<li class="sp-front-item"><span class="sp-front-spot">Spot ${i + 1}</span><div class="sp-tile sp-tile-empty"><span class="sp-tile-emptyicon" aria-hidden="true"><i class="bi bi-plus-lg"></i></span><div><p class="sp-tile-name">An open spot</p><p class="sp-help">Open a product and turn on Feature on the front page.</p></div></div></li>`;
		}
		frontList.innerHTML = html;
	}

	/* Catalog grid */
	const grid = pick('[data-sp-grid]');
	const search = pick('[data-sp-search]');
	const sort = pick('[data-sp-sort]');
	const summary = pick('[data-sp-summary]');
	const state = { q: '', kind: 'all', sort: 'kind' };
	let view = items.slice();

	function compute() {
		const list = items.filter(
			(it) =>
				(state.kind === 'all' || it.kind === state.kind) &&
				(!state.q.trim() ||
					window.Basalt.matchesQuery([it.name, it.maker, it.kind, it.sku].join(' '), state.q)),
		);
		const order = {
			kind: (a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind),
			rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
			low: (a, b) => price(a) - price(b),
			high: (a, b) => price(b) - price(a),
		}[state.sort];
		return list
			.map((it, i) => [it, i])
			.sort((a, b) => order(a[0], b[0]) || a[1] - b[1])
			.map((p) => p[0]);
	}

	/** A catalog tile: a square photo straight on the page with nothing on
	    it, quick view and full page in a tray that rises on hover or
	    focus, then a few quiet lines of text and the store switch. */
	function card(it) {
		const av = availability(it);
		const front = isFront(it)
			? '<span class="sp-chip sp-chip-front"><i class="bi bi-house" aria-hidden="true"></i>Front page</span>'
			: '';
		const tray = `<span class="sp-item-tray"><button type="button" class="btn btn-icon btn-sm" data-sp-open="${it.sku}" aria-label="Quick view: ${htmlSafe(it.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${pageUrl(it)}" aria-label="Open full page: ${htmlSafe(it.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span>`;
		const rating = `<span class="sp-item-rating"><i class="bi bi-star-fill" aria-hidden="true"></i>${it.rating.toFixed(1)} <span class="sp-quiet">(${it.reviews})</span><span class="visually-hidden"> out of 5 from ${it.reviews} ratings</span></span>`;
		return `<li class="sp-item${it.listed ? '' : ' is-hidden'}" data-sp-item="${it.sku}"><div class="sp-item-media"><div class="sp-item-art">${photo(it, 600, 600)}</div>${tray}</div><div class="sp-item-body"><p class="sp-eyebrow">${htmlSafe(it.kind)} · ${htmlSafe(it.maker)}</p><h3 class="sp-item-name"><a href="${pageUrl(it)}">${htmlSafe(it.name)}</a></h3>${priceLine(it)}<p class="sp-item-meta">${rating}<span class="basalt-status basalt-status-dot basalt-status-${av.tone}">${htmlSafe(av.label)}</span>${badgeChip(it)}${front}</p><div class="form-check form-switch sp-store"><input class="form-check-input" type="checkbox" role="switch" id="sp-in-${it.sku}" data-sp-listed="${it.sku}"${it.listed ? ' checked' : ''}><label class="form-check-label" for="sp-in-${it.sku}"><span class="visually-hidden">Show ${htmlSafe(it.name)} in the store: </span>${it.listed ? 'In store' : 'Hidden'}</label></div></div></li>`;
	}

	function drawGrid() {
		view = compute();
		grid.innerHTML = view.length
			? view.map(card).join('')
			: `<li class="sp-grid-empty">${state.q.trim() ? window.Basalt.emptyState({ query: state.q, noun: 'products', text: state.kind !== 'all' ? 'Check the spelling, or look in All.' : '' }) : window.Basalt.emptyState({ title: 'Nothing here yet', text: 'Products of this kind show up here once they are added.', icon: 'box-seam' })}</li>`;
		if (window.Basalt.tips) window.Basalt.tips(grid);
		const listed = items.filter((it) => it.listed).length;
		const onSale = items.filter((it) => it.sale != null).length;
		summary.textContent = `${items.length} products: ${listed} in the store, ${onSale} on sale.`;
	}

	function drawCounts() {
		for (const el of pickAll('[data-sp-kind-n]')) {
			const k = el.getAttribute('data-sp-kind-n');
			el.textContent = k === 'all' ? items.length : items.filter((it) => it.kind === k).length;
		}
	}

	function redraw() {
		drawFront();
		drawGrid();
		if (current && drawer.classList.contains('show')) fill(current);
	}

	/* Show or hide a product. Hiding takes it off the front page too. */
	function setListed(it, on) {
		const before = { listed: it.listed, front: front.slice() };
		it.listed = on;
		if (!on) front = front.filter((s) => s !== it.sku);
		redraw();
		const wasFront = before.front.indexOf(it.sku) !== -1 && !on;
		toast({
			tone: on ? 'success' : 'info',
			title: it.name + (on ? ' is back in the store' : ' is hidden'),
			text: on
				? 'Customers can find and order it again.'
				: wasFront
					? 'It left the front page as well.'
					: 'It stays on past orders and invoices.',
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						it.listed = before.listed;
						front = before.front;
						redraw();
					},
				},
			],
		});
	}

	/* Add to or take off the front page. */
	function setFront(it, on) {
		const before = front.slice();
		front = front.filter((s) => s !== it.sku);
		if (on) front.push(it.sku);
		redraw();
		toast({
			tone: 'success',
			title: on ? `${it.name} is on the front page` : `${it.name} left the front page`,
			text: on ? `It takes spot ${front.length} of ${FRONT_MAX}.` : 'Its spot is open for another product.',
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						front = before;
						redraw();
					},
				},
			],
		});
	}

	search.addEventListener('input', () => {
		state.q = search.value;
		drawGrid();
	});
	sort.addEventListener('change', () => {
		state.sort = sort.value;
		drawGrid();
	});

	for (const r of pickAll('[data-sp-kinds] .btn-check')) {
		r.addEventListener('change', () => {
			state.kind = r.value;
			drawGrid();
		});
	}

	grid.addEventListener('change', (e) => {
		const sw = e.target.closest('[data-sp-listed]');
		if (!sw) return;
		const sku = sw.getAttribute('data-sp-listed');
		setListed(bySku(sku), sw.checked);
		const again = document.getElementById(`sp-in-${sku}`);
		if (again) again.focus({ preventScroll: true });
	});

	/* A photo that cannot be fetched leaves the tinted icon tile showing. */
	document.addEventListener(
		'error',
		(e) => {
			if (e.target.matches && e.target.matches('[data-sp-img]')) e.target.remove();
		},
		true,
	);

	/* Quick view */
	const drawer = document.getElementById('sp-listing');

	function d(k) {
		return pick(`[data-sp-d="${k}"]`, drawer);
	}

	function f(k) {
		return pick(`[data-sp-f="${k}"]`, drawer);
	}

	let navList = items;
	let current = null;

	function fill(it) {
		current = it;
		d('title').textContent = it.name;
		d('sub').textContent = it.sku;
		d('full').href = pageUrl(it);
		d('preview').innerHTML = storeTile(it, false);

		const others = front.filter((s) => s !== it.sku);
		const full = others.length >= FRONT_MAX;
		f('listed').checked = it.listed;
		f('featured').checked = isFront(it);
		f('featured').disabled = !it.listed || (full && !isFront(it));
		d('listedHelp').textContent =
			it.stock === 0 && !it.listed
				? 'Hidden while it is on backorder. It stays on past orders and invoices.'
				: 'Hidden products stay on past orders and invoices.';
		d('featuredHelp').textContent = !it.listed
			? 'Show it in the store first.'
			: full && !isFront(it)
				? `The front page holds three. Take one off first: ${others.map((s) => bySku(s).name).join(', ')}.`
				: isFront(it)
					? `In spot ${front.indexOf(it.sku) + 1} of ${FRONT_MAX}.`
					: `${others.length} of ${FRONT_MAX} spots are taken.`;

		const saleBtn = d('saleBtn');
		saleBtn.hidden = !canSale(it) && it.sale == null;
		saleBtn.textContent = it.sale != null ? 'End sale' : 'Put on sale';
		saleBtn.parentElement.hidden = saleBtn.hidden;

		d('ratingLead').innerHTML =
			`<span class="sp-lead-score">${it.rating.toFixed(1)}</span> out of 5 from ${it.reviews} ratings`;
		const most = Math.max(...it.stars) || 1;
		d('bars').innerHTML = it.stars
			.map(
				(n, i) =>
					`<li class="sp-bar"><span class="sp-bar-label">${5 - i} star${i === 4 ? '' : 's'}</span><span class="sp-bar-track" aria-hidden="true"><span class="sp-bar-fill sp-bar-fill-${i < 2 ? 'up' : i === 2 ? 'mid' : 'down'}" style="--sp-w:${((n / most) * 100).toFixed(1)}%"></span></span><span class="sp-bar-n">${n}</span></li>`,
			)
			.join('');

		/* Store orders from the last six weeks with this product in them, newest first. */
		const since = new Date(window.Basalt.toLocalDay(book.NOW.slice(0, 10)).getTime() - 42 * 86400000);
		const orders = book.ORDERS.filter(
			(o) =>
				window.Basalt.toLocalDay(o.date) >= since &&
				o.status !== 'canceled' &&
				o.lines.some((l) => l.sku === it.sku),
		);
		d('orders').innerHTML =
			orders
				.slice(0, 3)
				.map((o) => {
					const qty = o.lines.find((l) => l.sku === it.sku).qty;
					return `<li class="sp-order"><div class="sp-order-who"><a href="order-details.html?id=${encodeURIComponent(o.orderNumber)}" class="sp-order-no">${htmlSafe(o.orderNumber)}</a><a href="shoppers.html" class="sp-order-cust">${htmlSafe(o.customer)}</a></div><span class="sp-order-qty">${qty} × ${fmt(book.line(o, { sku: it.sku, qty: 1 }).gross / 100)}</span><span class="sp-order-date">${day(o.date)}</span></li>`;
				})
				.join('') ||
			`<li class="sp-order sp-order-none">No store orders in the last six weeks.${it.kind === 'Extras' ? ' Most members join from their account.' : ''}</li>`;
		d('ordersMore').innerHTML =
			orders.length > 3
				? `And ${orders.length - 3} more in <a href="orders.html">Orders</a>.`
				: orders.length
					? 'Every order is in <a href="orders.html">Orders</a>.'
					: '';
	}

	const nav = window.Basalt.drawer
		? window.Basalt.drawer.recordNav(drawer, { valueOf: () => Math.max(1, navList.length) }, (at) =>
				fill(navList[at]),
			)
		: { go: (at) => fill(navList[at]) };

	function open(sku) {
		navList = view.some((it) => it.sku === sku) ? view.slice() : items.slice();
		nav.go(navList.findIndex((it) => it.sku === sku));
		bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
	}

	/* The panel icon opens the quick view. */
	page.addEventListener('click', (e) => {
		const btn = e.target.closest('[data-sp-open]');
		if (btn) open(btn.getAttribute('data-sp-open'));
	});

	/* A click anywhere else on a card other than its controls opens the
     product's full page, and the middle button or Cmd/Ctrl opens it in a
     new tab, as a link would. */
	function cardToPage(e) {
		const item = e.button < 2 && e.target.closest('[data-sp-item]');
		if (!item || e.target.closest('a, button, .form-check')) return;
		const url = pageUrl(items.find((it) => it.sku === item.getAttribute('data-sp-item')));
		if (e.button === 1 || e.metaKey || e.ctrlKey) window.open(url, '_blank');
		else location.href = url;
	}
	grid.addEventListener('click', cardToPage);
	grid.addEventListener('auxclick', (e) => {
		if (e.button === 1) cardToPage(e);
	});

	f('listed').addEventListener('change', () => setListed(current, f('listed').checked));
	f('featured').addEventListener('change', () => setFront(current, f('featured').checked));

	d('saleBtn').addEventListener('click', () => {
		const it = current;
		if (it.sale == null) {
			preselect = it.sku;
			bootstrap.Offcanvas.getOrCreateInstance(drawer).hide();
			bootstrap.Modal.getOrCreateInstance(saleModal).show();
			return;
		}
		const before = { sale: it.sale, ends: it.ends };
		it.sale = null;
		it.ends = '';
		redraw();
		toast({
			tone: 'info',
			title: 'Sale ended',
			text: `${it.name} is back at ${fmt(it.list)}.`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						it.sale = before.sale;
						it.ends = before.ends;
						redraw();
					},
				},
			],
		});
	});

	/* Run a sale */
	const saleModal = document.getElementById('sp-sale');
	const saleForm = pick('[data-sp-sale-form]');
	const picks = pick('[data-sp-picks]');
	const picksError = pick('[data-sp-picks-error]');
	const saleSum = pick('[data-sp-sale-sum]');
	const saleEnds = pick('[data-sp-sale-ends]');
	let preselect = '';

	function off() {
		return Number((pick('input[name="sp-off"]:checked', saleForm) || {}).value || 10);
	}

	function salePrice(it) {
		return Math.round(it.list * (100 - off())) / 100;
	}

	function picked() {
		return pickAll('input[name="sp-pick"]:checked', picks).map((c) => bySku(c.value));
	}

	function drawPicks() {
		picks.innerHTML = items
			.filter(canSale)
			.map(
				(it) =>
					`<li class="sp-pick"><input class="form-check-input" type="checkbox" name="sp-pick" id="sp-pick-${it.sku}" value="${it.sku}"${it.sku === preselect ? ' checked' : ''}><label class="sp-pick-label" for="sp-pick-${it.sku}"><span class="sp-thumb" aria-hidden="true">${photo(it, 80, 80)}</span><span class="sp-pick-name">${htmlSafe(it.name)}${it.sale != null ? `<span class="sp-pick-note">On sale now at ${fmt(it.sale)}</span>` : ''}</span><span class="sp-pick-price">${fmt(it.list)}</span></label></li>`,
			)
			.join('');
	}

	function drawSaleSum() {
		const list = picked();
		if (!list.length) {
			saleSum.textContent = 'Pick the products to put on sale.';
			return;
		}
		const first = list[0];
		saleSum.innerHTML = `<strong>${htmlSafe(first.name)}</strong> goes from ${fmt(first.list)} to <strong>${fmt(salePrice(first))}</strong>${list.length > 2 ? `. The other ${list.length - 1} products are ${off()}% off too.` : list.length === 2 ? `. ${htmlSafe(list[1].name)} is ${off()}% off too.` : '.'}`;
	}

	start();
})();
