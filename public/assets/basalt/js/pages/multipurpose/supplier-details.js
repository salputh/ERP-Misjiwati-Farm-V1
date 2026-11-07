/**
 * Basalt - Supplier Details (supplier-details.html)
 * One mill or workshop Marlo buys from: its delivery record, open
 * purchase orders and recent deliveries, the products it makes with
 * their cost and margin, the buying terms, contacts, notes and
 * activity.
 *
 * The suppliers and orders are the ones on Suppliers, from
 * window.Basalt.data.suppliers (assets/basalt/js/data/multipurpose/suppliers.js).
 * ?id=hollis in the address picks the supplier; without one, or
 * with an id that isn't there, Hollis Atelier opens.
 */
(() => {
	'use strict';
	const root = pick('[data-spd-root]');
	const D = window.Basalt.data && window.Basalt.data.suppliers;
	if (!root || !D) return;

	function start() {
		drawHead();
		/* The four figures count up from zero once, as the page opens. */
		window.Basalt.countUp?.(pickAll('.spd-fig-value', root));
		drawOrders();
		drawProducts();
		drawTerms();
		drawNotes();
		drawLog();
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
		return `${n.toLocaleString('en-US')} ${n === 1 ? one : many || `${one}s`}`;
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function P(k) {
		return pick(`[data-spd="${k}"]`, root);
	}

	const ME = 'John Armstrong';

	/* Dates */
	function pad(n) {
		return String(n).padStart(2, '0');
	}

	function parse(s) {
		const [d, t] = s.split('T');
		const [y, m, dd] = d.split('-').map(Number);
		const [h, mi] = (t || '00:00').split(':').map(Number);
		return new Date(y, m - 1, dd, h, mi);
	}
	const NOW = parse(D.NOW);
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	function startOfDay(d) {
		return new Date(d.getFullYear(), d.getMonth(), d.getDate());
	}

	function days(a, b) {
		return Math.round((startOfDay(b) - startOfDay(a)) / 864e5);
	}

	function fmtDay(d) {
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function clockText(d) {
		return `${d.getHours() % 12 || 12}:${pad(d.getMinutes())}${d.getHours() < 12 ? ' am' : ' pm'}`;
	}

	function when(iso) {
		const d = parse(iso);
		const n = days(d, NOW);
		return `${n === 0 ? 'Today' : n === 1 ? 'Yesterday' : fmtDay(d)}, ${clockText(d)}`;
	}

	function stamp(d) {
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	/* The supplier */
	const ALL = D.all().sort((a, b) => b.spend - a.spend);
	const asked = new URLSearchParams(location.search).get('id');
	const S = ALL.find((s) => s.id === asked) || ALL.find((s) => s.id === 'hollis');
	function pill(map, key) {
		const s = map[key];
		return `<span class="basalt-status basalt-status-dot${s.tone ? ` basalt-status-${s.tone}` : ''}">${s.label}</span>`;
	}

	function poLink(id) {
		return `<a class="spd-link" href="purchase-orders.html#${htmlSafe(id.replace(/^#/, ''))}">${htmlSafe(id)}</a>`;
	}

	function what(o) {
		return o.items.length === 1
			? `${o.items[0].qty.toLocaleString('en-US')} × ${o.items[0].name}`
			: `${plural(o.items.length, 'product')}, ${plural(o.units, 'unit')}`;
	}

	/* Header, notice and figures */
	function drawHead() {
		document.title = `${S.name} · Basalt`;
		const m = P('mono');
		m.className = `spd-mono spd-tone-${S.tone}`;
		m.textContent = S.mono;
		P('name').textContent = S.name;
		P('sub').textContent =
			`${S.makes} · ${S.city}, ${S.country}${S.since ? ` · supplier since ${S.since}` : ' · own workshop'}`;
		P('tags').innerHTML = `${pill(D.STATUS, S.status)}<span class="spd-tag">${htmlSafe(S.legal)}</span>`;
		P('po').hidden = S.status === 'paused';
		P('mail').href = `mailto:${S.contacts[0].email}`;
		P('mail').innerHTML =
			`<i class="bi bi-envelope me-1" aria-hidden="true"></i>Email ${htmlSafe(S.contacts[0].name.split(' ')[0])}`;
		const i = ALL.indexOf(S);
		function link(el, x, word) {
			el.href = `supplier-details.html?id=${encodeURIComponent(x.id)}`;
			el.setAttribute('aria-label', `${word} supplier: ${x.name}`);
		}
		link(P('prev'), ALL[(i - 1 + ALL.length) % ALL.length], 'Previous');
		link(P('next'), ALL[(i + 1) % ALL.length], 'Next');

		const n = P('notice');
		n.hidden = !S.note;
		if (S.note) {
			n.className = `spd-notice spd-notice-${S.status === 'paused' ? 'warning' : 'info'}`;
			n.innerHTML = `<i class="bi ${S.status === 'paused' ? 'bi-pause-circle' : 'bi-hourglass-split'}" aria-hidden="true"></i><span>${htmlSafe(S.note)}</span>`;
		}

		function fig(k, v) {
			P(k).textContent = v;
		}
		fig('fig-time', S.onTime == null ? 'None yet' : `${S.onTime}%`);
		fig(
			'fig-time-note',
			S.record[0] ? `${S.record[1]} of ${S.record[0]} deliveries in 12 months` : 'No deliveries so far',
		);
		fig('fig-lead', `${S.lead} days`);
		fig('fig-lead-note', `Order to delivery, ${S.ship.toLowerCase()}`);
		fig('fig-open', String(S.open.length));
		fig(
			'fig-open-note',
			S.open.length ? `${money(S.open.reduce((t, o) => t + o.total, 0))} at cost` : 'Nothing on order',
		);
		fig('fig-spend', money(S.spend));
		fig('fig-spend-note', S.spend ? `Paid on ${S.terms} terms` : 'Nothing bought yet');
	}

	/* Purchase orders */
	function drawOrders() {
		P('open-desc').textContent = S.open.length ? `${plural(S.open.length, 'order')} not yet in stock.` : '';
		P('open').innerHTML = S.open.length
			? S.open
					.map(
						(o) =>
							`<li class="spd-po"><span class="spd-po-main">${poLink(o.id)}<span class="spd-po-sub">${htmlSafe(what(o))}</span></span><span class="spd-po-state">${pill(D.PO_STATUS, o.status)}<span class="spd-po-sub">Due ${htmlSafe(fmtDay(parse(o.due)))}</span></span><span class="spd-po-amount">${money(o.total)}</span></li>`,
					)
					.join('')
			: `<li class="spd-none">${S.status === 'paused' ? 'Buying is paused.' : S.status === 'onboarding' ? 'The first order goes in once the wear tests pass.' : 'No open orders.'}</li>`;

		const got = S.orders.filter((o) => o.got).sort((a, b) => (a.got < b.got ? 1 : -1));
		P('recent-desc').textContent = got.length ? 'When each arrived against its due date.' : '';
		P('recent').innerHTML = got.length
			? got
					.map((o) => {
						const late = days(parse(o.due), parse(o.got));
						/* A part delivery flown ahead isn't judged against the due date. */
						const part = o.status === 'partial';
						const word = part
							? 'Part delivery'
							: late > 0
								? `${plural(late, 'day')} late`
								: late < 0
									? `${plural(-late, 'day')} early`
									: 'On time';
						const tone = part ? 'info' : late > 0 ? 'warning' : 'success';
						return `<li class="spd-po"><span class="spd-po-main">${poLink(o.id)}<span class="spd-po-sub">${htmlSafe(o.status === 'partial' ? `${o.received} of ${o.units} units so far` : what(o))}</span></span><span class="spd-po-state"><span class="basalt-status basalt-status-dot basalt-status-${tone}">${word}</span><span class="spd-po-sub">Arrived ${htmlSafe(fmtDay(parse(o.got)))}</span></span><span class="spd-po-amount">${money(o.total)}</span></li>`;
					})
					.join('')
			: '<li class="spd-none">No deliveries yet.</li>';
	}

	/* Products, terms and contacts */
	function drawProducts() {
		P('products-desc').textContent = `${plural(S.products.length, 'product')}, unit cost against the shop price.`;
		P('products').innerHTML = S.products
			.map((p) => {
				const margin = p.price ? Math.round(((p.price - p.cost) / p.price) * 100) : 0;
				const stock =
					p.onHand == null
						? `<span class="spd-state">${htmlSafe(p.state || 'Not stocked')}</span>`
						: p.onHand === 0
							? '<span class="spd-state spd-state-bad">Sold out</span>'
							: `${p.onHand.toLocaleString('en-US')} units`;
				return `<tr><td><span class="spd-product"><span class="spd-product-icon spd-tone-${S.tone}" aria-hidden="true"><i class="bi ${htmlSafe(p.icon)}"></i></span><span class="spd-product-text"><span class="spd-product-name">${htmlSafe(p.name)}</span><span class="spd-product-sku">${htmlSafe(p.sku)}</span></span></span></td><td class="spd-col-num">${money(p.cost)}</td><td class="spd-col-num spd-col-price">${money(p.price)}</td><td class="spd-col-num spd-col-margin">${margin}%</td><td class="spd-col-stock">${stock}</td></tr>`;
			})
			.join('');
	}
	function drawTerms() {
		const rows = [
			['Payment', S.terms],
			['Lead time', `${S.lead} days from order`],
			['Minimum order', money(S.min)],
			['Ships by', S.ship],
			['Legal name', S.legal],
			[
				'Website',
				`<a class="spd-link spd-link-plain" href="https://${htmlSafe(S.web)}" rel="noopener">${htmlSafe(S.web)}</a>`,
			],
		];
		P('terms').innerHTML = rows
			.map((r) => `<div><dt>${r[0]}</dt><dd>${r[0] === 'Website' ? r[1] : htmlSafe(r[1])}</dd></div>`)
			.join('');
		P('contacts').innerHTML = S.contacts
			.map(
				(c) =>
					`<li class="spd-person"><span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(c.name)}" aria-hidden="true"></span><span class="spd-person-text"><span class="spd-person-name">${htmlSafe(c.name)}</span><span class="spd-person-role">${htmlSafe(c.role)}</span><a class="spd-link spd-link-plain" href="mailto:${htmlSafe(c.email)}">${htmlSafe(c.email)}</a><a class="spd-link spd-link-plain" href="tel:${htmlSafe(c.phone.replace(/\s+/g, ''))}">${htmlSafe(c.phone)}</a></span></li>`,
			)
			.join('');
		if (window.Basalt.avatars) window.Basalt.avatars(P('contacts'));
	}

	/* Notes and activity */
	const notes = S.notes.slice().sort((a, b) => (a.at < b.at ? 1 : -1));
	function drawNotes() {
		P('notes').innerHTML = notes
			.map(
				(n) =>
					`<li class="spd-note${n.fresh ? ' is-fresh' : ''}"><p class="spd-note-text">${htmlSafe(n.text)}</p><p class="spd-note-meta">${htmlSafe(n.by)} · ${htmlSafe(when(n.at))}</p></li>`,
			)
			.join('');
	}
	const form = pick('[data-spd-note-form]', root);
	form.addEventListener('submit', (e) => {
		e.preventDefault();
		const box = pick('[data-spd-note-text]', form);
		const text = box.value.trim();
		if (!text) {
			box.focus();
			return;
		}
		notes.unshift({ at: stamp(NOW), by: ME, text, fresh: true });
		box.value = '';
		drawNotes();
		toast({ tone: 'success', title: 'Note added', text: `Saved to ${S.name}.`, duration: 3000 });
	});

	function drawLog() {
		const ev = [];
		S.orders.forEach((o) => {
			ev.push({
				at: o.created,
				icon: 'bi-pencil-square',
				text: `<strong>${htmlSafe(o.by)}</strong> ${o.status === 'draft' ? 'drafted ' : 'created '}${htmlSafe(o.id)}`,
			});
			if (o.sent) ev.push({ at: o.sent, icon: 'bi-send', text: `${htmlSafe(o.id)} sent to ${htmlSafe(S.name)}` });
			if (o.got)
				ev.push({
					at: o.got,
					icon: 'bi-box-seam',
					text: `${o.status === 'partial' ? `${o.received} of ${o.units} units` : htmlSafe(o.id)} <strong>arrived</strong> at ${htmlSafe(o.site)}`,
				});
			if (o.canceled)
				ev.push({
					at: o.canceled,
					icon: 'bi-x-circle',
					text: `${htmlSafe(o.id)} was <strong>canceled</strong>`,
				});
		});
		if (S.status === 'onboarding')
			ev.push({
				at: '2026-09-22T16:45',
				icon: 'bi-pen',
				text: `<strong>${ME}</strong> signed ${htmlSafe(S.name)} as a supplier`,
			});
		if (S.status === 'paused')
			ev.push({ at: '2026-09-02T15:00', icon: 'bi-pause-circle', text: `<strong>${ME}</strong> paused buying` });
		ev.sort((a, b) => (a.at < b.at ? 1 : -1));
		P('log').innerHTML =
			ev
				.slice(0, 6)
				.map(
					(e) =>
						`<li class="spd-feed-item"><span class="spd-feed-icon" aria-hidden="true"><i class="bi ${e.icon}"></i></span><span class="spd-feed-text"><span>${e.text}</span><span class="spd-feed-time">${htmlSafe(when(e.at))}</span></span></li>`,
				)
				.join('') || '<li class="spd-none">Nothing yet.</li>';
	}

	start();
})();
