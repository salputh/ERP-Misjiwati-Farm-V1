/**
 * Basalt - Returns page (returns.html)
 * Return requests on Marlo shop orders: a shopper asks to send
 * something back, we approve it and send a prepaid label, the item
 * comes back and is checked, and the money goes back (or the return
 * is declined). Draws the four stage figures, the list of returns
 * with its search and status chips, the reasons and products cards
 * and the quick view from the shared return data. Each return's full
 * page is Return Details.
 *
 * The returns are window.Basalt.data.returns (assets/js/data/
 * shop-returns.js); their orders, shoppers, prices and tax are the
 * shop book's (window.Basalt.shopBook, assets/basalt/js/data/multipurpose/store.js), so a
 * return's refund is worked out the same way Refunds and Order Details
 * work out theirs. "Today" is the book's, so the demo always reads the
 * same.
 */
(() => {
	'use strict';
	const root = pick('[data-rt-root]');
	const book = window.Basalt.shopBook;
	const data = window.Basalt.data && window.Basalt.data.returns;
	if (!root || !book || !data || typeof bootstrap === 'undefined') return;

	function start() {
		pick('[data-basalt-record-prev]', drawer).addEventListener('click', () => navTo(at - 1, -1));
		pick('[data-basalt-record-next]', drawer).addEventListener('click', () => navTo(at + 1, 1));
		drawer.addEventListener('keydown', (e) => {
			if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
			e.preventDefault();
			navTo(at + (e.key === 'ArrowUp' ? -1 : 1), e.key === 'ArrowUp' ? -1 : 1);
		});

		drawFigs();
		drawList();
		drawSides();
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	const { APPROVE_DAYS, WINDOW_DAYS, REASONS, RETURNS } = data;
	const returns = RETURNS.slice();

	/* Formatting */
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const MONTHS_LONG = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	];

	function htmlSafe(s) {
		return String(s == null ? '' : s).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function pad(n) {
		return String(n).padStart(2, '0');
	}

	function parse(s) {
		const [d, t] = s.split(/[ T]/);
		const [y, m, dd] = d.split('-').map(Number);
		const [h, mi] = (t || '00:00').split(':').map(Number);
		return new Date(y, m - 1, dd, h, mi);
	}

	function iso(d) {
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}

	function day(s) {
		const d = parse(s);
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function clock(d) {
		return `${d.getHours() % 12 || 12}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'am' : 'pm'}`;
	}

	function when(s) {
		return `${day(s)}, ${clock(parse(s))}`;
	}

	function money(c) {
		return `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function plural(n, word) {
		return `${n} ${word}${n === 1 ? '' : 's'}`;
	}

	function initials(name) {
		const w = name.split(' ');
		return (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
	}

	function first(name) {
		return name.split(' ')[0];
	}

	const TODAY = book.NOW.slice(0, 10);
	function addWorkDays(s, n) {
		const d = parse(s);
		while (n > 0) {
			d.setDate(d.getDate() + 1);
			if (d.getDay() % 6) n--;
		}
		return iso(d);
	}
	function workDaysBetween(a, b) {
		let n = 0;
		const d = parse(a);
		const end = parse(b);
		while (d < end) {
			d.setDate(d.getDate() + 1);
			if (d.getDay() % 6) n++;
		}
		return n;
	}

	/* Each return, worked out from its order */
	/* Each product's tile color, from the chart ramp. */
	const TONE = {
		'ML-BLAZ': 1,
		'ML-GOWN': 8,
		'ML-ORGZ': 3,
		'ML-SUIT': 5,
		'ML-TRCH': 2,
		'ML-LOAF': 4,
		'ML-OXFD': 6,
		'ML-CATE': 7,
		'ML-SHLD': 3,
	};

	function order(r) {
		return book.order(r.order);
	}

	function shopper(r) {
		return book.customer(order(r).customer);
	}

	function product(sku) {
		return book.product(sku);
	}

	/* The refund: what was paid for these items, discount and tax included, in cents. */
	function refund(r) {
		return book.refund(
			order(r),
			r.lines.map(([sku, qty]) => ({ sku, qty })),
			false,
		);
	}

	function amount(r) {
		return refund(r).cents;
	}

	function linesText(r) {
		return r.lines.map(([sku, q]) => (q > 1 ? `${q} × ` : '') + product(sku).name).join(', ');
	}

	function delivered(r) {
		return (book.story(order(r)).fulfil.deliveredAt || '').slice(0, 10);
	}

	function approveBy(r) {
		return addWorkDays(r.requested, APPROVE_DAYS);
	}

	function lateBy(r) {
		return r.status === 'requested' && approveBy(r) < TODAY ? workDaysBetween(approveBy(r), TODAY) : 0;
	}

	function url(id) {
		return `return-details.html?id=${encodeURIComponent(id)}`;
	}

	function orderUrl(id) {
		return `order-details.html?id=${encodeURIComponent(id)}`;
	}

	function shopperUrl(r) {
		return `shopper-details.html?id=${encodeURIComponent(shopper(r).id)}`;
	}

	const STATUS = {
		requested: { label: 'Requested', cls: 'basalt-status-dot basalt-status-info' },
		approved: { label: 'Approved', cls: 'basalt-status-dot basalt-status-primary' },
		received: { label: 'Received', cls: 'basalt-status-dot basalt-status-warning' },
		refunded: { label: 'Refunded', cls: 'basalt-status-dot basalt-status-success' },
		declined: { label: 'Declined', cls: 'basalt-status-dot' },
	};

	function stateTag(r) {
		return `<span class="basalt-status ${STATUS[r.status].cls}">${STATUS[r.status].label}</span>`;
	}

	function reasonPill(r) {
		return `<span class="basalt-status rt-tone-${REASONS[r.reason].tone}">${REASONS[r.reason].label}</span>`;
	}

	function tile(sku) {
		return `<span class="rt-tile rt-tone-${TONE[sku] || 1}" aria-hidden="true"><i class="bi ${product(sku).icon}"></i></span>`;
	}

	const PAID = { card: 'Back to the card', bank: 'By bank transfer', credit: 'As store credit' };

	/* The four figures */
	function fig(k) {
		return pick(`[data-rt-fig="${k}"]`, root);
	}

	function drawFigs() {
		const ask = returns.filter((r) => r.status === 'requested');
		const late = ask.filter(lateBy).length;
		fig('ask').textContent = ask.length;
		fig('ask-note').textContent = late
			? `${plural(late, 'request')} past ${APPROVE_DAYS} working days`
			: `Each answered within ${APPROVE_DAYS} working days`;
		const back = returns.filter((r) => r.status === 'approved');
		const toSend = back.filter((r) => !r.label).length;
		fig('back').textContent = back.length;
		fig('back-note').textContent = toSend ? `${plural(toSend, 'label')} still to send` : 'Every label has gone out';
		const due = returns.filter((r) => r.status === 'received');
		fig('due').textContent = money(due.reduce((a, r) => a + amount(r), 0));
		fig('due-note').textContent = `${plural(due.length, 'return')} back and checked`;
		const from = iso(new Date(parse(TODAY).getTime() - 30 * 864e5));
		const paid = returns.filter((r) => r.status === 'refunded' && r.refunded[0].slice(0, 10) >= from);
		fig('paid').textContent = money(paid.reduce((a, r) => a + amount(r), 0));
		fig('paid-note').textContent = `${plural(paid.length, 'return')} in the last 30 days`;
	}

	/* The list */
	const el = {
		rows: pick('[data-rt-rows]', root),
		wrap: pick('[data-rt-wrap]', root),
		empty: pick('[data-rt-empty]', root),
		summary: pick('[data-rt-summary]', root),
		search: pick('[data-rt-search]', root),
		chips: pick('[data-rt-chips]', root),
		live: pick('[data-rt-live]', root),
	};
	const state = { q: '', status: 'all' };

	function matches(r) {
		if (state.status !== 'all' && r.status !== state.status) return false;
		if (!state.q) return true;
		const hay = [r.id, r.order, shopper(r).name, REASONS[r.reason].label, r.condition]
			.concat(r.lines.map((l) => product(l[0]).name))
			.join(' ');
		return window.Basalt && window.Basalt.matchesQuery
			? window.Basalt.matchesQuery(hay, state.q)
			: hay.toLowerCase().includes(state.q.toLowerCase());
	}

	function labelCell(r) {
		if (r.label)
			return `<span class="rt-label"><i class="bi bi-check2" aria-hidden="true"></i><span class="visually-hidden">Sent </span>${day(r.label.sent)}</span>`;
		if (r.status === 'approved') return '<span class="rt-label rt-label-todo">To send</span>';
		return '<span class="rt-quiet">None</span>';
	}

	/* The quick view and the full page, side by side at a row's end. */
	function rowActions(r) {
		return `<td class="rt-col-act"><span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-rt-open aria-label="Quick view: ${r.id}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${url(r.id)}" aria-label="Open full page: ${r.id}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span></td>`;
	}

	function row(r) {
		const s = shopper(r);
		const R = REASONS[r.reason];
		return `<tr data-rt-id="${r.id}"><td class="rt-col-id"><a class="rt-link" href="${url(r.id)}">${r.id}</a></td><td class="rt-col-who"><span class="rt-who"><span class="basalt-avatar basalt-avatar-xs basalt-avatar-tone-${s.avatarTone}" aria-hidden="true">${initials(s.name)}</span><span class="rt-ellipsis">${htmlSafe(s.name)}</span></span></td><td class="rt-col-order"><a class="rt-order" href="${orderUrl(r.order)}">${r.order}</a></td><td class="rt-col-items"><span class="rt-item"><span class="rt-ellipsis">${htmlSafe(linesText(r))}</span></span></td><td class="rt-col-reason"><span class="rt-reason"><span class="rt-dot rt-tone-${R.tone}" aria-hidden="true"></span>${R.label}</span></td><td class="rt-col-cond">${htmlSafe(r.condition)}</td><td class="rt-col-label">${labelCell(r)}</td><td class="rt-col-status">${stateTag(r)}</td><td class="rt-col-amount"><span class="rt-money${r.status === 'declined' ? ' rt-money-muted' : ''}">${money(amount(r))}</span></td>${rowActions(r)}</tr>`;
	}

	let shown = [];
	function drawList() {
		shown = returns.filter(matches);

		for (const k of Object.keys(STATUS).concat('all')) {
			const n = k === 'all' ? returns.length : returns.filter((r) => r.status === k).length;
			pick(`[data-rt-count="${k}"]`, root).textContent = n;
		}

		for (const b of pickAll('[data-rt-chip]', el.chips)) {
			b.setAttribute('aria-pressed', String(b.getAttribute('data-rt-chip') === state.status));
		}

		const open = returns.filter(
			(r) => r.status === 'requested' || r.status === 'approved' || r.status === 'received',
		).length;
		el.summary.textContent =
			shown.length === returns.length
				? `${plural(returns.length, 'return')} since ${day(returns[returns.length - 1].requested)}, ${open} still open. Shoppers have ${WINDOW_DAYS} days from delivery to ask.`
				: `${shown.length} of ${plural(returns.length, 'return')}, ${money(shown.reduce((a, r) => a + amount(r), 0))} in refunds`;
		el.rows.innerHTML = shown.map(row).join('');
		el.wrap.hidden = !shown.length;
		el.empty.hidden = !!shown.length;
		if (window.Basalt.tips) window.Basalt.tips(el.rows);
		if (shown.length) {
			el.empty.innerHTML = '';
			return;
		}
		el.empty.innerHTML = `<div class="basalt-empty rt-empty" role="status"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-search"></i></span><p class="basalt-empty-title">${state.q ? `No returns match “${htmlSafe(state.q)}”` : 'No returns here'}</p><p class="basalt-empty-text">Try a return or order number, a shopper or a product.</p><button type="button" class="btn btn-sm btn-outline-secondary" data-rt-clear>Clear filters</button></div>`;
	}

	let typing;
	el.search.addEventListener('input', () => {
		clearTimeout(typing);
		typing = setTimeout(() => {
			state.q = el.search.value.trim();
			drawList();
			el.live.textContent = shown.length ? `${plural(shown.length, 'return')} shown` : 'No returns match';
		}, 160);
	});
	el.chips.addEventListener('click', (e) => {
		const b = e.target.closest('[data-rt-chip]');
		if (!b) return;
		state.status = b.getAttribute('data-rt-chip');
		drawList();
		el.live.textContent = `${plural(shown.length, 'return')} shown`;
	});
	el.empty.addEventListener('click', (e) => {
		if (!e.target.closest('[data-rt-clear]')) return;
		state.q = '';
		state.status = 'all';
		el.search.value = '';
		drawList();
		el.search.focus();
	});

	/* The panel icon opens the quick view. */
	root.addEventListener('click', (e) => {
		const b = e.target.closest('[data-rt-open]');
		if (b) openReturn(b.closest('[data-rt-id]').getAttribute('data-rt-id'));
	});
	/* A click anywhere else on a row opens the full page; the middle
     button or Cmd/Ctrl opens it in a new tab, as a link would. */
	function rowToPage(e) {
		const tr = e.button < 2 && e.target.closest('tr[data-rt-id]');
		if (!tr || e.target.closest('a, button')) return;
		const href = url(tr.getAttribute('data-rt-id'));
		if (e.button === 1 || e.metaKey || e.ctrlKey) window.open(href, '_blank');
		else location.href = href;
	}
	root.addEventListener('click', rowToPage);
	root.addEventListener('auxclick', (e) => {
		if (e.button === 1) rowToPage(e);
	});

	/* Why things come back, and what comes back most */
	function bar(name, count, pct, tone, note) {
		return `<li class="rt-bars-row"><span class="rt-bars-name">${name}</span><span class="rt-bars-count">${count}</span><span class="rt-bars-track" aria-hidden="true"><span class="rt-bars-bar rt-tone-${tone}" style="width:${Math.max(4, Math.round(pct))}%"></span></span><span class="rt-bars-note">${note}</span></li>`;
	}
	function drawSides() {
		const since = returns[returns.length - 1].requested;
		const reasons = Object.keys(REASONS)
			.map((k) => {
				const list = returns.filter((r) => r.reason === k);
				return {
					k,
					n: list.length,
					cents: list.filter((r) => r.status !== 'declined').reduce((a, r) => a + amount(r), 0),
				};
			})
			.filter((x) => x.n)
			.sort((a, b) => b.n - a.n || b.cents - a.cents);
		const most = reasons[0].n;
		const d = parse(since);
		pick('[data-rt-reasons-sub]', root).textContent =
			`${plural(returns.length, 'return')} asked for since ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}. Sizing sends back the most.`;
		pick('[data-rt-reasons]', root).innerHTML = reasons
			.map((x) =>
				bar(
					REASONS[x.k].label,
					plural(x.n, 'return'),
					(x.n / most) * 100,
					REASONS[x.k].tone,
					`${money(x.cents)} to refund`,
				),
			)
			.join('');

		/* Units sent back against units delivered since September 1. */
		const sold = {};
		book.ORDERS.forEach((o) => {
			const at = book.story(o).fulfil.deliveredAt;
			if (o.status === 'canceled' || !at || at < '2026-09-01') return;
			o.lines.forEach((l) => {
				if (book.kind(l.sku) === 'goods') sold[l.sku] = (sold[l.sku] || 0) + l.qty;
			});
		});
		const back = {};

		for (const r of returns) {
			r.lines.forEach(([sku, q]) => {
				back[sku] = (back[sku] || 0) + q;
			});
		}

		const rows = Object.keys(back)
			.map((sku) => ({
				sku,
				n: back[sku],
				sold: sold[sku] || back[sku],
				rate: back[sku] / (sold[sku] || back[sku]),
			}))
			.sort((a, b) => b.rate - a.rate || b.n - a.n)
			.slice(0, 5);
		const top = rows[0].rate;
		pick('[data-rt-products-sub]', root).textContent =
			'Share of each product sent back, of everything delivered since September 1.';
		pick('[data-rt-products]', root).innerHTML = rows
			.map((x) =>
				bar(
					htmlSafe(product(x.sku).name),
					`${Math.round(x.rate * 100)}%`,
					(x.rate / top) * 100,
					TONE[x.sku] || 1,
					`${x.n} of ${x.sold} sent back`,
				),
			)
			.join('');
	}

	/* CSV export */
	pick('[data-rt-export]').addEventListener('click', () => {
		function cell(v) {
			return `"${String(v).replace(/"/g, '""')}"`;
		}

		const rows = [
			[
				'Return',
				'Requested',
				'Shopper',
				'Order',
				'Items',
				'Reason',
				'Condition',
				'Label sent',
				'Status',
				'Refund',
			],
		].concat(
			returns.map((r) => [
				r.id,
				r.requested.slice(0, 10),
				shopper(r).name,
				r.order,
				linesText(r),
				REASONS[r.reason].label,
				r.condition,
				r.label ? r.label.sent.slice(0, 10) : '',
				STATUS[r.status].label,
				(amount(r) / 100).toFixed(2),
			]),
		);
		const blob = new Blob([rows.map((x) => x.map(cell).join(',')).join('\r\n')], { type: 'text/csv' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `returns-${TODAY}.csv`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
		if (window.Basalt.toasts)
			window.Basalt.toasts.push({
				tone: 'success',
				icon: 'bi-download',
				title: `Exported ${plural(returns.length, 'return')}`,
				text: a.download,
			});
	});

	/* The quick view */
	const drawer = pick('#rt-return');
	const body = pick('[data-rt-r="body"]', drawer);
	let ids = [];
	let at = 0;
	let stepsGrown = false;

	/* The five steps a return goes through, with when each happened. */
	function steps(r) {
		const out = [['Requested', r.requested]];
		if (r.status === 'declined' && !r.approved) return out.concat([['Declined', r.declined[0]]]);
		out.push(['Approved', r.approved && r.approved[0]]);
		out.push(['Label sent', r.label && r.label.sent]);
		out.push(['Received', r.received && r.received[0]]);
		out.push(r.status === 'declined' ? ['Declined', r.declined[0]] : ['Refunded', r.refunded && r.refunded[0]]);
		return out;
	}
	function nextText(r) {
		if (r.status === 'requested') return 'Approve or decline it on the full page.';
		if (r.status === 'approved' && !r.label) return 'Send the return label from the full page.';
		if (r.status === 'approved') return 'Mark it received on the full page once it is back.';
		if (r.status === 'received') return 'Refund it on the full page.';
		return '';
	}

	function drawRecord(r) {
		const s = shopper(r);
		const m = refund(r);
		const av = pick('[data-rt-r="avatar"]', drawer);
		av.className = `basalt-avatar basalt-avatar-sm basalt-avatar-tone-${s.avatarTone}`;
		av.textContent = initials(s.name);
		pick('[data-rt-r="title"]', drawer).textContent = r.id;
		pick('[data-rt-r="sub"]', drawer).innerHTML =
			`<a href="${shopperUrl(r)}">${htmlSafe(s.name)}</a> · <a href="${orderUrl(r.order)}">${r.order}</a>`;
		pick('[data-rt-r="full"]', drawer).href = url(r.id);

		const late = lateBy(r);
		const alert = late
			? `<p class="rt-alert"><i class="bi bi-clock-history" aria-hidden="true"></i><span>The answer was due ${day(approveBy(r))}. ${htmlSafe(first(s.name))} has waited ${plural(workDaysBetween(r.requested, TODAY), 'working day')}.</span></p>`
			: '';
		const st = steps(r);
		const nextAt = st.findIndex((x) => !x[1]);
		const next = nextText(r);
		body.innerHTML = `<div class="rt-r-state"><div class="rt-r-pills">${stateTag(r)}${reasonPill(r)}</div>${alert}</div><section class="basalt-drawer-section" aria-labelledby="rt-r-said"><h3 class="basalt-drawer-legend" id="rt-r-said">What ${htmlSafe(first(s.name))} said</h3><blockquote class="rt-quote"><p>${htmlSafe(r.said)}</p><footer class="rt-quiet">${htmlSafe(r.condition)} · delivered ${day(delivered(r))}</footer></blockquote></section><section class="basalt-drawer-section" aria-labelledby="rt-r-steps"><h3 class="basalt-drawer-legend" id="rt-r-steps">Progress</h3><ol class="rt-steps">${st
			.map((x, i) => {
				const cls = x[1] ? 'is-done' : i === nextAt ? 'is-next' : 'is-todo';
				const icon = x[1] ? (x[0] === 'Declined' ? 'bi-x-lg' : 'bi-check2') : '';
				return `<li class="rt-step ${cls}${x[0] === 'Declined' ? ' is-declined' : ''}"><span class="rt-step-marker" aria-hidden="true">${icon ? `<i class="bi ${icon}"></i>` : i + 1}</span><span class="rt-step-text"><span class="rt-step-label">${x[0]}</span><span class="rt-quiet">${x[1] ? when(x[1]) : i === nextAt ? 'Next' : 'Not yet'}</span></span></li>`;
			})
			.join(
				'',
			)}</ol></section><section class="basalt-drawer-section" aria-labelledby="rt-r-items"><h3 class="basalt-drawer-legend" id="rt-r-items">Coming back</h3><ul class="rt-items">${r.lines
			.map(
				([sku, q, size]) =>
					`<li class="rt-items-row">${tile(sku)}<span class="rt-items-text"><span class="rt-strong">${htmlSafe(product(sku).name)}</span><span class="rt-quiet">${size ? `Size ${size} · ` : ''}${q} × $${product(sku).price}</span></span></li>`,
			)
			.join(
				'',
			)}</ul><dl class="rt-sums"><div><dt>Items</dt><dd>${money(m.items)}</dd></div><div><dt>Tax</dt><dd>${m.tax ? money(m.tax) : 'None'}</dd></div><div class="rt-sums-total"><dt>${r.status === 'refunded' ? 'Refunded' : r.status === 'declined' ? 'Not refunded' : 'To refund'}</dt><dd>${money(m.cents)}</dd></div></dl>${r.status === 'refunded' ? `<p class="rt-quiet rt-r-note">${PAID[r.refunded[2]]}${r.credit ? ` ${r.credit}` : ''}, ${day(r.refunded[0])}.</p>` : ''}${r.status === 'declined' ? `<p class="rt-quiet rt-r-note">${htmlSafe(r.declined[2])}</p>` : ''}${next ? `<p class="rt-quiet rt-r-note">${next}</p>` : ''}</section>`;
		body.scrollTop = 0;
		growSteps(pick('.rt-steps', body));
	}

	/**
	 * Grows the filled lines between done steps the first time a return shows
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
			!pickAll('.rt-step.is-done:not(:last-child)', trail).length
		)
			return;
		stepsGrown = true;
		let left = 0;
		trail.classList.add('is-waiting');
		trail.addEventListener('animationend', function done(event) {
			if (event.animationName !== 'rt-trail-grow' || --left > 0) return;
			trail.classList.remove('is-drawing');
			trail.removeEventListener('animationend', done);
		});
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				left = pickAll('.rt-step.is-done:not(:last-child)', trail).length;
				trail.classList.remove('is-waiting');
				if (left) trail.classList.add('is-drawing');
			},
			{ threshold: 0.5 },
		);
		watch.observe(trail);
	}

	function navTo(i, dir) {
		at = (i + ids.length) % ids.length;
		const r = returns.find((x) => x.id === ids[at]);
		if (r) drawRecord(r);
		pick('[data-basalt-record-pos]', drawer).textContent = `${at + 1} of ${ids.length}`;
		drawer.classList.toggle('is-back', dir < 0);
	}
	function openReturn(id) {
		ids = shown.map((r) => r.id);
		if (!ids.includes(id)) ids = [id];
		navTo(ids.indexOf(id));
		bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
	}
	start();
})();
