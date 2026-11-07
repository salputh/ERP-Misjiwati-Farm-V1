/**
 * Basalt - Shipments (shipments.html)
 * Every parcel the Marlo shop has sent in the last month, delayed
 * ones first, with the four figures above the list and a side panel
 * for a quick look at one parcel.
 *
 * The parcels come from window.Basalt.data.shipments
 * (assets/basalt/js/data/multipurpose/shipments.js), which reads the shop book for the
 * orders, shoppers and tracking numbers.
 *
 * A row, and its expand icon, open the parcel's own page,
 * shipment-details.html?id=<id>; the panel icon opens the quick view.
 */
(() => {
	'use strict';
	const root = pick('[data-shp-root]');
	const D = window.Basalt.data && window.Basalt.data.shipments;
	if (!root || !D || typeof bootstrap === 'undefined') return;

	function start() {
		drawer.addEventListener('shown.bs.offcanvas', () => dEl.title.focus());
		drawer.addEventListener('hidden.bs.offcanvas', () => {
			const id = state.open;
			state.open = null;
			paintList();
			const btn = id && pick(`[data-shp-open="${CSS.escape(id)}"]`, el.rows);
			if (btn) btn.focus({ preventScroll: true });
		});

		renderFigures();
		paintList();
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(s) {
		return String(s == null ? '' : s).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many || `${one}s`}`;
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	/* Dates: the demo's "now" is the shop book's */
	function parse(s) {
		const [d, t] = s.split('T');
		const [y, m, dd] = d.split('-').map(Number);
		const [h, mi] = (t || '00:00').split(':').map(Number);
		return new Date(y, m - 1, dd, h, mi);
	}

	const NOW = parse(D.NOW);
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	function startOfDay(d) {
		return new Date(d.getFullYear(), d.getMonth(), d.getDate());
	}

	function dayDiff(d) {
		return Math.round((startOfDay(d) - startOfDay(NOW)) / 86400000);
	}

	function clockText(d) {
		return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}${d.getHours() < 12 ? ' am' : ' pm'}`;
	}

	function fmtDay(d) {
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function fmtShort(d) {
		const n = dayDiff(d);
		if (n === 0) return 'Today';
		if (n === -1) return 'Yesterday';
		if (n === 1) return 'Tomorrow';
		return `${DAYS[d.getDay()]}, ${fmtDay(d)}`;
	}

	function fmtLong(d) {
		return `${fmtShort(d)}, ${clockText(d)}`;
	}

	/* State */
	const STATUS = D.STATUS;
	const state = {
		all: D.all(),
		carrier: 'all',
		status: 'all',
		query: '',
		expanded: false,
		open: null,
	};
	const ROWS = 12;

	function nodeById(id) {
		return state.all.find((x) => x.id === id);
	}

	function fullHref(x) {
		return `shipment-details.html?id=${encodeURIComponent(x.id)}`;
	}

	function pill(x) {
		const s = STATUS[x.status];
		return `<span class="basalt-status basalt-status-dot${s.tone ? ` basalt-status-${s.tone}` : ''}">${s.label}</span>`;
	}

	function mark(carrier, cls) {
		const c = D.CARRIERS[carrier] || { mark: carrier.slice(0, 2), tone: 1 };
		return `<span class="shp-mark shp-tone-${c.tone}${cls ? ` ${cls}` : ''}" aria-hidden="true">${htmlSafe(c.mark)}</span>`;
	}

	/* What the date column says for each parcel. */
	function whenText(x) {
		if (x.status === 'delivered') return `Delivered ${fmtDay(parse(x.deliveredAt))}`;
		if (x.status === 'returned') return `Back ${fmtDay(parse(x.deliveredAt))}`;
		if (x.kind === 'return') return `Due back ${fmtDay(parse(x.expected))}`;
		return fmtShort(parse(x.expected));
	}

	function titleOf(x) {
		return x.kind === 'return' ? `Return from ${x.customer.city}` : `Parcel to ${x.customer.city}`;
	}

	/* The figures */
	function fig(k, v) {
		const n = pick(`[data-shp-fig="${k}"]`, root);
		if (n) n.textContent = v;
	}

	function renderFigures() {
		function has(s) {
			return state.all.filter((x) => x.status === s);
		}

		const late = has('delayed');
		const untold = late.filter((x) => !x.emails.some((e) => /delay/i.test(e.text)));
		fig('late', String(late.length));
		fig(
			'late-note',
			late.length
				? untold.length
					? `${plural(untold.length, 'shopper')} not told yet`
					: 'Every shopper told'
				: 'Nothing late',
		);
		const out = has('out');
		const way = has('transit').filter((x) => x.kind === 'out').length + out.length;
		fig('way', String(way));
		fig('way-note', out.length ? `${out.length} out for delivery today` : 'None out for delivery today');
		const wait = has('label');
		fig('wait', String(wait.length));
		const pickup = wait.map((x) => parse(x.pickupAt)).sort((a, b) => a - b)[0];
		fig('wait-note', pickup ? `Pickup ${fmtShort(pickup).toLowerCase()} at ${clockText(pickup)}` : 'All picked up');
		const week = state.all.filter((x) => x.status === 'delivered' && dayDiff(parse(x.deliveredAt)) > -7);
		fig('done', String(week.length));
		const days = week.map((x) => (parse(x.deliveredAt) - parse(x.shippedAt)) / 86400000);
		const avg = days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0;
		fig('done-note', `Average ${avg.toFixed(1)} days on the way`);
	}

	/* The list */
	const el = {
		rows: pick('[data-shp-rows]', root),
		table: pick('[data-shp-table]', root),
		empty: pick('[data-shp-empty]', root),
		summary: pick('[data-shp-summary]', root),
		search: pick('[data-shp-search]', root),
		carrier: pick('[data-shp-carrier]', root),
		status: pick('[data-shp-status]', root),
		live: pick('[data-shp-live]', root),
		foot: pick('[data-shp-foot]', root),
		footNote: pick('[data-shp-foot-note]', root),
		more: pick('[data-shp-more]', root),
	};

	function matches(x) {
		if (state.carrier !== 'all' && x.carrier !== state.carrier) return false;
		if (state.status !== 'all' && x.status !== state.status) return false;
		const q = state.query.trim().toLowerCase();
		if (!q) return true;
		const hay = [x.customer.name, x.customer.city, x.order, x.tracking, x.carrier, x.dest].join(' ').toLowerCase();
		return q.split(/\s+/).every((w) => hay.includes(w));
	}

	function shown() {
		return state.all.filter(matches);
	}

	function rowHtml(x) {
		const open = x.id === state.open;
		const late = x.status === 'delayed';
		return `<tr class="shp-row${open ? ' is-open' : ''}" data-shp-id="${htmlSafe(x.id)}"><td class="shp-row-who"><span class="shp-who"><span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(x.customer.name)}" aria-hidden="true"></span><span class="shp-who-name">${htmlSafe(x.customer.name)}</span>${x.kind === 'return' ? '<span class="shp-flag">Return</span>' : ''}</span></td><td class="shp-row-order"><a class="shp-link" href="order-details.html?id=${encodeURIComponent(x.order)}">${htmlSafe(x.order)}</a></td><td class="shp-row-carrier"><span class="shp-carrier">${mark(x.carrier)}<span>${htmlSafe(x.carrier)}</span></span></td><td class="shp-row-track"><span class="shp-track">${htmlSafe(x.tracking)}</span></td><td class="shp-row-status">${pill(x)}</td><td class="shp-row-when"><span class="shp-when${late ? ' is-late' : ''}">${htmlSafe(whenText(x))}</span>${late ? `<span class="visually-hidden">, was due ${htmlSafe(fmtDay(parse(x.was)))}</span>` : ''}</td><td class="shp-row-open"><span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-shp-open="${htmlSafe(x.id)}" aria-label="Quick view: ${htmlSafe(titleOf(x))}, ${htmlSafe(x.order)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${fullHref(x)}" aria-label="Open full page: ${htmlSafe(titleOf(x))}, ${htmlSafe(x.order)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span></td></tr>`;
	}

	function emptyHtml() {
		const q = state.query.trim();
		const title = q ? `No parcels match “${htmlSafe(q)}”` : 'No parcels here';
		const text = q
			? 'Search looks at shoppers, cities, orders and tracking numbers.'
			: 'Nothing matches these filters right now.';
		return `<div class="basalt-empty basalt-empty-compact shp-empty"><span class="shp-empty-icon" aria-hidden="true"><i class="bi ${q ? 'bi-search' : 'bi-box-seam'}"></i></span><h3 class="basalt-empty-title">${title}</h3><p class="basalt-empty-text">${text}</p><div class="basalt-empty-actions"><button type="button" class="btn btn-sm btn-outline-secondary" data-shp-reset>Show every parcel</button></div></div>`;
	}

	function summaryText() {
		function n(s) {
			return state.all.filter((x) => x.status === s).length;
		}

		return `${plural(state.all.length, 'parcel')} since Sep 9. ${n('delayed')} delayed, ${n('transit') + n('out')} on the way, ${n('returned')} returned.`;
	}

	function disposeTips(scope) {
		if (!bootstrap.Tooltip) return;

		for (const t of pickAll('[data-bs-toggle="tooltip"]', scope)) {
			const i = bootstrap.Tooltip.getInstance(t);
			if (i) i.dispose();
		}
	}
	function paintList() {
		el.summary.textContent = summaryText();
		const list = shown();
		disposeTips(el.rows);
		const rows = state.expanded ? list : list.slice(0, ROWS);
		el.rows.innerHTML = rows.map(rowHtml).join('');
		el.foot.hidden = list.length <= ROWS;
		if (list.length > ROWS) {
			el.footNote.textContent = state.expanded
				? `Showing all ${list.length} parcels.`
				: `Showing ${ROWS} of ${list.length} parcels.`;
			el.more.textContent = state.expanded ? 'Show fewer' : `Show all ${list.length}`;
			el.more.setAttribute('aria-expanded', String(state.expanded));
		}
		if (window.Basalt.avatars) window.Basalt.avatars(el.rows);
		if (window.Basalt.tips) window.Basalt.tips(el.rows);
		el.table.hidden = !list.length;
		el.empty.hidden = !!list.length;
		el.empty.innerHTML = list.length ? '' : emptyHtml();
	}

	/* Search and filters */
	let timer = 0;
	el.search.addEventListener('input', () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			state.query = el.search.value;
			state.expanded = false;
			paintList();
			if (state.query.trim()) el.live.textContent = `${plural(shown().length, 'parcel')} found`;
		}, 120);
	});
	el.search.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && el.search.value) {
			e.preventDefault();
			el.search.value = '';
			state.query = '';
			paintList();
		}
	});
	el.carrier.addEventListener('change', () => {
		state.carrier = el.carrier.value;
		state.expanded = false;
		paintList();
	});
	el.status.addEventListener('change', () => {
		state.status = el.status.value;
		state.expanded = false;
		paintList();
	});
	el.more.addEventListener('click', () => {
		window.Basalt.slide(el.table.parentElement, () => {
			state.expanded = !state.expanded;
			paintList();
		});
	});
	root.addEventListener('click', (e) => {
		if (!e.target.closest('[data-shp-reset]')) return;
		el.search.value = '';
		el.carrier.value = 'all';
		el.status.value = 'all';
		Object.assign(state, { query: '', carrier: 'all', status: 'all', expanded: false });
		paintList();
		el.search.focus();
	});

	/* A row opens the parcel's page (Cmd/Ctrl or middle click: a new
     tab); the panel icon opens the quick view; links keep their own. */
	function onRowClick(e) {
		if (e.target.closest('a')) return;
		const quick = e.target.closest('[data-shp-open]');
		if (quick) {
			openParcel(quick.dataset.shpOpen);
			return;
		}
		const tr = e.target.closest('tr[data-shp-id]');
		if (!tr) return;
		const x = nodeById(tr.dataset.shpId);
		if (e.metaKey || e.ctrlKey || e.button === 1) window.open(fullHref(x), '_blank', 'noopener');
		else if (e.button === 0) location.href = fullHref(x);
	}
	el.rows.addEventListener('click', onRowClick);
	el.rows.addEventListener('auxclick', (e) => {
		if (e.button === 1 && !e.target.closest('button, a')) onRowClick(e);
	});

	/* Export the rows in view */
	pick('[data-shp-export]', root).addEventListener('click', () => {
		const list = shown();

		function cell(v) {
			return `"${String(v).replace(/"/g, '""')}"`;
		}

		const csv = [['Order', 'Shopper', 'Carrier', 'Tracking', 'Status', 'Expected'].map(cell).join(',')]
			.concat(
				list.map((x) =>
					[x.order, x.customer.name, x.carrier, x.tracking, STATUS[x.status].label, x.expected]
						.map(cell)
						.join(','),
				),
			)
			.join('\r\n');
		const a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
		a.download = 'shipments.csv';
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
		toast({
			tone: 'success',
			title: 'Export ready',
			text: `${plural(list.length, 'parcel')} saved to shipments.csv.`,
			duration: 4000,
		});
	});

	/* The side panel: one parcel */
	const drawer = document.getElementById('shp-parcel');
	const dEl = {
		mark: pick('[data-shp-d="mark"]', drawer),
		title: pick('[data-shp-d="title"]', drawer),
		sub: pick('[data-shp-d="sub"]', drawer),
		full: pick('[data-shp-d="full"]', drawer),
		body: pick('[data-shp-d="body"]', drawer),
		foot: pick('[data-shp-d="foot"]', drawer),
	};

	function panel() {
		return bootstrap.Offcanvas.getOrCreateInstance(drawer);
	}

	function photo(id) {
		return window.Basalt.photo(id, 96, 96);
	}

	function factsHtml(x) {
		const rows = [];
		if (x.status === 'delayed')
			rows.push(['New date', `${fmtShort(parse(x.expected))}, was ${fmtDay(parse(x.was))}`]);
		else if (x.deliveredAt)
			rows.push([x.kind === 'return' ? 'Back at' : 'Delivered', fmtLong(parse(x.deliveredAt))]);
		else rows.push(['Expected', fmtShort(parse(x.expected))]);
		rows.push(['Service', x.service]);
		rows.push(['Tracking', `<span class="shp-track">${htmlSafe(x.tracking)}</span>`]);
		rows.push([x.kind === 'return' ? 'From' : 'To', htmlSafe(x.kind === 'return' ? x.origin : x.dest)]);
		return `<dl class="shp-facts">${rows.map((r) => `<div><dt>${r[0]}</dt><dd>${r[0] === 'Tracking' || r[0] === 'To' || r[0] === 'From' ? r[1] : htmlSafe(r[1])}</dd></div>`).join('')}</dl>`;
	}
	function scansHtml(x) {
		return `<ol class="shp-scans">${x.events
			.slice(0, 4)
			.map(
				(e, i) =>
					`<li class="shp-scan${i === 0 ? ' is-latest' : ''}${e.kind === 'delay' ? ' is-late' : ''}"><span class="shp-scan-dot" aria-hidden="true"></span><span class="shp-scan-text">${htmlSafe(e.text)}</span><span class="shp-scan-meta">${htmlSafe(e.place)} · ${htmlSafe(fmtLong(parse(e.at)))}</span></li>`,
			)
			.join('')}</ol>`;
	}
	function itemsHtml(x) {
		return `<ul class="shp-items">${x.lines
			.map(
				(l) =>
					`<li class="shp-item">${l.photo ? `<img class="shp-item-img" src="${photo(l.photo)}" alt="" width="40" height="40" loading="lazy">` : `<span class="shp-item-img" aria-hidden="true"><i class="bi ${htmlSafe(l.icon)}"></i></span>`}<span class="shp-item-name">${htmlSafe(l.name)}</span><span class="shp-item-qty">× ${l.qty}</span></li>`,
			)
			.join('')}</ul><p class="shp-d-note">${htmlSafe(x.box)}, ${x.weight.toFixed(2)} kg</p>`;
	}

	function paintSheet() {
		const x = nodeById(state.open);
		if (!x) return;
		disposeTips(drawer);
		const c = D.CARRIERS[x.carrier] || { mark: '', tone: 1 };
		dEl.mark.className = `shp-mark shp-mark-lg shp-tone-${c.tone}`;
		dEl.mark.textContent = c.mark;
		dEl.title.textContent = titleOf(x);
		dEl.sub.textContent = `${x.order} · ${x.customer.name}`;
		dEl.full.href = fullHref(x);
		const late =
			x.status === 'delayed'
				? `<p class="shp-d-alert"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i><span>${htmlSafe(x.carrier)}: ${htmlSafe(x.delay.text.toLowerCase())} in ${htmlSafe(x.delay.place)}.</span></p>`
				: '';
		dEl.body.innerHTML = `<div class="shp-d-state">${pill(x)}</div>${late}${factsHtml(x)}<section class="shp-d-section" aria-labelledby="shp-d-scans"><h3 class="shp-d-h" id="shp-d-scans">Latest scans</h3>${scansHtml(x)}</section><section class="shp-d-section" aria-labelledby="shp-d-items"><h3 class="shp-d-h" id="shp-d-items">In the parcel</h3>${itemsHtml(x)}</section>`;
		dEl.foot.innerHTML = `<button type="button" class="btn btn-sm btn-outline-secondary" data-basalt-copy="${htmlSafe(D.trackingLink(x))}" data-basalt-copy-done="Link copied"><i class="bi bi-link-45deg me-1" aria-hidden="true"></i>Copy tracking link</button><a class="btn btn-sm btn-outline-secondary" href="order-details.html?id=${encodeURIComponent(x.order)}"><i class="bi bi-receipt me-1" aria-hidden="true"></i>Open order</a>`;
		if (window.Basalt.buttons) window.Basalt.buttons(dEl.foot);
	}

	function openParcel(id) {
		if (!nodeById(id)) return;
		state.open = id;
		paintSheet();
		paintList();
		panel().show();
	}
	start();
})();
