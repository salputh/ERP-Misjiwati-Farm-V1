/**
 * Basalt - Suppliers (suppliers.html)
 * The mills and workshops Marlo buys from: four figures about buying,
 * then every supplier with its lead time, on-time record and open
 * purchase orders, and a side panel for a quick look at one.
 *
 * The suppliers and orders come from window.Basalt.data.suppliers
 * (assets/basalt/js/data/multipurpose/suppliers.js); prices and stock from the catalog.
 *
 * A row, and its expand icon, open supplier-details.html?id=<id>; the
 * panel icon opens the quick view.
 */
(() => {
	'use strict';
	const root = pick('[data-sup-root]');
	const D = window.Basalt.data && window.Basalt.data.suppliers;
	if (!root || !D || typeof bootstrap === 'undefined') return;

	function start() {
		drawer.addEventListener('shown.bs.offcanvas', () => dEl.title.focus());
		drawer.addEventListener('hidden.bs.offcanvas', () => {
			const id = state.open;
			state.open = null;
			paintList();
			const btn = id && pick(`[data-sup-open="${CSS.escape(id)}"]`, el.rows);
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

	function money(n) {
		return `$${Math.round(n).toLocaleString('en-US')}`;
	}

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many || `${one}s`}`;
	}

	/* Dates */
	function parse(s) {
		const [d, t] = s.split('T');
		const [y, m, dd] = d.split('-').map(Number);
		const [h, mi] = (t || '00:00').split(':').map(Number);
		return new Date(y, m - 1, dd, h, mi);
	}

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	function fmtDay(d) {
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function fmtShort(d) {
		return `${DAYS[d.getDay()]}, ${fmtDay(d)}`;
	}

	/* State */
	const all = D.all().sort((a, b) => b.spend - a.spend);
	const state = { filter: 'all', query: '', open: null };

	function nodeById(id) {
		return all.find((s) => s.id === id);
	}

	function fullHref(s) {
		return `supplier-details.html?id=${encodeURIComponent(s.id)}`;
	}

	function mono(s, cls) {
		return `<span class="sup-mono sup-tone-${s.tone}${cls ? ` ${cls}` : ''}" aria-hidden="true">${htmlSafe(s.mono)}</span>`;
	}

	function pill(map, key) {
		const s = map[key];
		return `<span class="basalt-status basalt-status-dot${s.tone ? ` basalt-status-${s.tone}` : ''}">${s.label}</span>`;
	}

	function onTimeTone(p) {
		return p >= 90 ? 'good' : p >= 75 ? 'fair' : 'poor';
	}

	/* The figures */
	function fig(k, v) {
		const n = pick(`[data-sup-fig="${k}"]`, root);
		if (n) n.textContent = v;
	}

	function renderFigures() {
		const open = all.flatMap((s) => s.open.map((o) => Object.assign({ who: s.name }, o)));
		fig('open', String(open.length));
		const coming = open.filter((o) => o.status !== 'draft');
		fig('open-note', `${money(open.reduce((t, o) => t + o.total, 0))}, ${coming.length} on the way`);
		const rec = all.reduce((t, s) => [t[0] + s.record[0], t[1] + s.record[1]], [0, 0]);
		fig('time', `${Math.round((rec[1] / rec[0]) * 100)}%`);
		fig('time-note', `${rec[1]} of ${rec[0]} deliveries`);
		const active = all.filter((s) => s.status === 'active');
		fig('lead', `${Math.round(active.reduce((t, s) => t + s.lead, 0) / active.length)} days`);
		const fast = active.slice().sort((a, b) => a.lead - b.lead)[0];
		fig('lead-note', `Fastest: ${fast.name}, ${fast.lead} days`);
		const next = coming.slice().sort((a, b) => (a.due < b.due ? -1 : 1))[0];
		fig('next', next ? fmtShort(parse(next.due)) : 'None due');
		fig('next-note', next ? `${next.id} from ${next.who}` : 'Nothing on the way');
	}

	/* The list */
	const el = {
		rows: pick('[data-sup-rows]', root),
		table: pick('[data-sup-table]', root),
		empty: pick('[data-sup-empty]', root),
		summary: pick('[data-sup-summary]', root),
		search: pick('[data-sup-search]', root),
		chips: pick('[data-sup-chips]', root),
		live: pick('[data-sup-live]', root),
	};
	function matches(s) {
		if (state.filter !== 'all' && s.status !== state.filter) return false;
		const q = state.query.trim().toLowerCase();
		if (!q) return true;
		const hay = [
			s.name,
			s.legal,
			s.makes,
			s.city,
			s.country,
			s.products.map((p) => `${p.name} ${p.sku}`).join(' '),
			s.contacts.map((c) => c.name).join(' '),
		]
			.join(' ')
			.toLowerCase();
		return q.split(/\s+/).every((w) => hay.includes(w));
	}

	function shown() {
		return all.filter(matches);
	}

	function timeHtml(s) {
		if (s.onTime == null) return '<span class="sup-quiet">None yet</span>';
		return `<span class="sup-time sup-time-${onTimeTone(s.onTime)}"><span class="sup-time-bar" aria-hidden="true"><span style="width:${s.onTime}%"></span></span><span class="sup-time-num">${s.onTime}%</span></span>`;
	}
	function rowHtml(s) {
		return `<tr class="sup-row${s.id === state.open ? ' is-open' : ''}" data-sup-id="${htmlSafe(s.id)}"><td class="sup-row-name"><span class="sup-who">${mono(s)}<span class="sup-who-name">${htmlSafe(s.name)}</span></span></td><td class="sup-row-makes"><span class="sup-ellipsis">${htmlSafe(s.makes)}</span></td><td class="sup-row-lead">${s.lead} days</td><td class="sup-row-time">${timeHtml(s)}</td><td class="sup-row-open">${s.open.length ? plural(s.open.length, 'order') : '<span class="sup-quiet">None</span>'}</td><td class="sup-row-status">${pill(D.STATUS, s.status)}</td><td class="sup-row-act"><span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-sup-open="${htmlSafe(s.id)}" aria-label="Quick view: ${htmlSafe(s.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${fullHref(s)}" aria-label="Open full page: ${htmlSafe(s.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span></td></tr>`;
	}
	function emptyHtml() {
		const q = state.query.trim();
		return `<div class="basalt-empty basalt-empty-compact sup-empty"><span class="sup-empty-icon" aria-hidden="true"><i class="bi ${q ? 'bi-search' : 'bi-building'}"></i></span><h3 class="basalt-empty-title">${q ? `No suppliers match “${htmlSafe(q)}”` : `No ${D.STATUS[state.filter].label.toLowerCase()} suppliers`}</h3><p class="basalt-empty-text">${q ? 'Search looks at names, products and contacts.' : 'Nothing here right now.'}</p><div class="basalt-empty-actions"><button type="button" class="btn btn-sm btn-outline-secondary" data-sup-reset>Show every supplier</button></div></div>`;
	}
	function disposeTips(scope) {
		for (const t of pickAll('[data-bs-toggle="tooltip"]', scope)) {
			const i = bootstrap.Tooltip.getInstance(t);
			if (i) i.dispose();
		}
	}
	function paintList() {
		const n = { all: all.length, active: 0, onboarding: 0, paused: 0 };

		for (const s of all) {
			n[s.status] += 1;
		}

		for (const k of Object.keys(n)) {
			const x = pick(`[data-sup-count="${k}"]`, root);
			if (x) x.textContent = n[k];
		}

		el.summary.textContent = `${plural(all.length, 'supplier')}, sorted by spend over the last 12 months.`;
		const list = shown();
		disposeTips(el.rows);
		el.rows.innerHTML = list.map(rowHtml).join('');
		if (window.Basalt.tips) window.Basalt.tips(el.rows);
		el.table.hidden = !list.length;
		el.empty.hidden = !!list.length;
		el.empty.innerHTML = list.length ? '' : emptyHtml();
	}

	let timer = 0;
	el.search.addEventListener('input', () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			state.query = el.search.value;
			paintList();
			if (state.query.trim()) el.live.textContent = `${plural(shown().length, 'supplier')} found`;
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
	function setFilter(f) {
		state.filter = f;

		for (const b of pickAll('[data-sup-chip]', el.chips)) {
			b.setAttribute('aria-pressed', String(b.dataset.supChip === f));
		}

		paintList();
	}
	el.chips.addEventListener('click', (e) => {
		const b = e.target.closest('[data-sup-chip]');
		if (b) setFilter(b.dataset.supChip);
	});
	root.addEventListener('click', (e) => {
		if (!e.target.closest('[data-sup-reset]')) return;
		el.search.value = '';
		state.query = '';
		setFilter('all');
		el.search.focus();
	});

	function onRowClick(e) {
		if (e.target.closest('a')) return;
		const quick = e.target.closest('[data-sup-open]');
		if (quick) {
			openRecord(quick.dataset.supOpen);
			return;
		}
		const tr = e.target.closest('tr[data-sup-id]');
		if (!tr) return;
		const s = nodeById(tr.dataset.supId);
		if (e.metaKey || e.ctrlKey || e.button === 1) window.open(fullHref(s), '_blank', 'noopener');
		else if (e.button === 0) location.href = fullHref(s);
	}
	el.rows.addEventListener('click', onRowClick);
	el.rows.addEventListener('auxclick', (e) => {
		if (e.button === 1 && !e.target.closest('button, a')) onRowClick(e);
	});

	/* The side panel: one supplier */
	const drawer = document.getElementById('sup-record');
	const dEl = {
		mono: pick('[data-sup-d="mono"]', drawer),
		title: pick('[data-sup-d="title"]', drawer),
		sub: pick('[data-sup-d="sub"]', drawer),
		full: pick('[data-sup-d="full"]', drawer),
		body: pick('[data-sup-d="body"]', drawer),
		foot: pick('[data-sup-d="foot"]', drawer),
	};

	function panel() {
		return bootstrap.Offcanvas.getOrCreateInstance(drawer);
	}

	function facts(rows) {
		return `<dl class="sup-facts">${rows.map((r) => `<div><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`).join('')}</dl>`;
	}

	function paintSheet() {
		const s = nodeById(state.open);
		if (!s) return;
		dEl.mono.className = `sup-mono sup-mono-lg sup-tone-${s.tone}`;
		dEl.mono.textContent = s.mono;
		dEl.title.textContent = s.name;
		dEl.sub.textContent = `${s.makes} · ${s.city}, ${s.country}`;
		dEl.full.href = fullHref(s);
		const orders = s.open.length
			? `<ul class="sup-pos">${s.open
					.map(
						(o) =>
							`<li class="sup-po"><span class="sup-po-main"><a class="sup-link" href="purchase-orders.html#${htmlSafe(o.id.replace(/^#/, ''))}">${htmlSafe(o.id)}</a><span class="sup-po-meta">Due ${htmlSafe(fmtDay(parse(o.due)))} · ${money(o.total)}</span></span>${pill(D.PO_STATUS, o.status)}</li>`,
					)
					.join('')}</ul>`
			: '<p class="sup-d-none">No open orders.</p>';
		const c = s.contacts[0];
		dEl.body.innerHTML = `<div class="sup-d-state">${pill(D.STATUS, s.status)}<span class="sup-d-fact">${s.onTime == null ? 'No deliveries yet' : `${s.onTime}% on time`}</span></div>${s.note ? `<p class="sup-d-note">${htmlSafe(s.note)}</p>` : ''}<section class="sup-d-section" aria-labelledby="sup-d-orders"><h3 class="sup-d-h" id="sup-d-orders">Open orders</h3>${orders}</section><section class="sup-d-section" aria-labelledby="sup-d-products"><h3 class="sup-d-h" id="sup-d-products">Products</h3>${facts(s.products.map((p) => [htmlSafe(p.name), `${money(p.cost)} a unit`]))}</section><section class="sup-d-section" aria-labelledby="sup-d-terms"><h3 class="sup-d-h" id="sup-d-terms">Terms</h3>${facts(
			[
				['Lead time', `${s.lead} days`],
				['Payment', htmlSafe(s.terms)],
				['Minimum order', money(s.min)],
				['Ships by', htmlSafe(s.ship)],
			],
		)}</section><section class="sup-d-section" aria-labelledby="sup-d-contact"><h3 class="sup-d-h" id="sup-d-contact">Contact</h3>${facts(
			[
				['Name', `${htmlSafe(c.name)}, ${htmlSafe(c.role)}`],
				[
					'Email',
					`<a class="sup-link sup-link-plain" href="mailto:${htmlSafe(c.email)}">${htmlSafe(c.email)}</a>`,
				],
				['Phone', htmlSafe(c.phone)],
			],
		)}</section>`;
		dEl.foot.innerHTML = `${s.status === 'paused' ? '' : '<a class="btn btn-sm btn-primary" href="purchase-orders.html#new"><i class="bi bi-cart-plus me-1" aria-hidden="true"></i>New purchase order</a>'}<a class="btn btn-sm btn-outline-secondary" href="mailto:${htmlSafe(c.email)}"><i class="bi bi-envelope me-1" aria-hidden="true"></i>Email ${htmlSafe(c.name.split(' ')[0])}</a>`;
	}
	function openRecord(id) {
		if (!nodeById(id)) return;
		state.open = id;
		paintSheet();
		paintList();
		panel().show();
	}
	start();
})();
