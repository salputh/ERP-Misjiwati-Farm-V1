/**
 * Basalt - Payouts (payouts.html)
 * Card and wallet money paid out to Marlo's bank account. Each
 * working day, the charges from two working days before (less their
 * fees and any card refunds) go out as one payout and land the next
 * working day. Draws the four figures, the payouts list, the weekly
 * bars, the bank card and the side panel with the orders in a payout.
 *
 * The charges are the card orders in the shop book (window.
 * Basalt.shopBook, assets/basalt/js/data/multipurpose/store.js), so every order in a payout
 * opens on Order Details with the same total. Card refunds come from
 * Refunds (assets/basalt/js/data/multipurpose/refunds.js) and Returns (assets/js/data/
 * shop-returns.js); fees, the bank and the timing from assets/js/data/
 * shop-payments.js. "Today" is the book's, so the demo reads the same.
 */
(() => {
	'use strict';
	const root = pick('[data-po-root]');
	const book = window.Basalt.shopBook;
	const D = window.Basalt.data || {};
	const pay = D.shopPayments;
	if (!root || !book || !pay || typeof bootstrap === 'undefined') return;

	function start() {
		pick('[data-basalt-record-prev]', drawer).addEventListener('click', () => navTo(at - 1, -1));
		pick('[data-basalt-record-next]', drawer).addEventListener('click', () => navTo(at + 1, 1));
		drawer.addEventListener('keydown', (e) => {
			if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
			e.preventDefault();
			navTo(at + (e.key === 'ArrowUp' ? -1 : 1), e.key === 'ArrowUp' ? -1 : 1);
		});

		drawFigs();
		/* The four figures count up from zero once, as the page opens. */
		window.Basalt.countUp?.(pickAll('.basalt-fig-value', root));
		drawList();
		drawSides();
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

	function money(c) {
		return `${c < 0 ? '−' : ''}$${(Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function plural(n, word) {
		return `${n} ${word}${n === 1 ? '' : 's'}`;
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	/* Dates */
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

	function weekday(s) {
		return DAYS[parse(s).getDay()];
	}

	function addWorkDays(s, n) {
		const d = parse(s);
		while (n > 0) {
			d.setDate(d.getDate() + 1);
			if (d.getDay() % 6) n--;
		}
		return iso(d);
	}
	const TODAY = book.NOW.slice(0, 10);
	const FROM = '2026-09-01';

	/* Charges and card refunds, grouped into payouts */
	const card = pay.METHODS.find((m) => m.id === 'card');

	function feeOf(cents) {
		return Math.round((cents * card.fee.pct) / 100) + card.fee.fixed;
	}

	const items = [];
	book.ORDERS.forEach((o) => {
		if (o.paymentMethod !== 'card' || o.status === 'placed' || o.status === 'canceled') return;
		const at = book.story(o).payment.paidAt;
		if (!at || at < FROM) return;
		const cents = Math.round(o.total * 100);
		items.push({
			kind: 'charge',
			order: o.orderNumber,
			who: o.customer,
			at,
			cents,
			fee: feeOf(cents),
			wallet: pay.WALLET.includes(o.orderNumber),
		});
	});

	/* Card refunds come off the payout of the day they were made. */
	function refundOf(orderId, lines) {
		return book.refund(
			book.order(orderId),
			lines.map(([sku, qty]) => ({ sku, qty })),
			false,
		).cents;
	}

	((D.refunds && D.refunds.CLAIMS) || []).forEach((c) => {
		if (c.status !== 'refunded' || c.paid !== 'card') return;
		items.push({
			kind: 'refund',
			order: c.order,
			ref: c.id,
			who: book.order(c.order).customer,
			at: `${c.settled} 14:30`,
			cents: -refundOf(c.order, c.lines),
			fee: 0,
		});
	});
	((D.returns && D.returns.RETURNS) || []).forEach((r) => {
		if (r.status !== 'refunded' || r.refunded[2] !== 'card') return;
		items.push({
			kind: 'refund',
			order: r.order,
			ref: r.id,
			who: book.order(r.order).customer,
			at: r.refunded[0],
			cents: -refundOf(r.order, r.lines),
			fee: 0,
		});
	});

	const byDate = {};

	for (const it of items) {
		const out = addWorkDays(it.at.slice(0, 10), pay.DELAY.payout);
		(byDate[out] = byDate[out] || []).push(it);
	}

	/* A day whose refunds are more than its charges pays nothing out; the
     refunds come off the next payout instead. */
	const dates = Object.keys(byDate)
		.sort()
		.filter((date, i, all) => {
			const sum = byDate[date].reduce((a, x) => a + x.cents - x.fee, 0);
			if (sum >= 0 || i === all.length - 1) return true;
			byDate[all[i + 1]] = byDate[date].concat(byDate[all[i + 1]]);
			return false;
		});
	const payouts = dates
		.map((date, i) => {
			const list = byDate[date].sort((a, b) => a.at.localeCompare(b.at));
			const arrive = addWorkDays(date, pay.DELAY.arrive);
			const gross = list.filter((x) => x.kind === 'charge').reduce((a, x) => a + x.cents, 0);
			const refunds = list.filter((x) => x.kind === 'refund').reduce((a, x) => a + x.cents, 0);
			const fees = list.reduce((a, x) => a + x.fee, 0);
			const status = date > TODAY ? 'pending' : arrive > TODAY ? 'transit' : 'paid';
			return {
				id: `#${181 + i}`,
				date,
				arrive,
				list,
				gross,
				refunds,
				fees,
				net: gross + refunds - fees,
				status,
				orders: list.filter((x) => x.kind === 'charge').length,
			};
		})
		.reverse();

	const STATUS = {
		pending: { label: 'Scheduled', cls: 'basalt-status-dot basalt-status-info' },
		transit: { label: 'On the way', cls: 'basalt-status-dot basalt-status-warning' },
		paid: { label: 'Paid', cls: 'basalt-status-dot basalt-status-success' },
	};

	function pill(p) {
		return `<span class="basalt-status ${STATUS[p.status].cls}">${STATUS[p.status].label}</span>`;
	}

	/* Figures */
	function fig(k) {
		return pick(`[data-po-fig="${k}"]`, root);
	}

	function drawFigs() {
		const next = payouts.filter((p) => p.status === 'pending').pop();
		fig('next').textContent = next ? money(next.net) : 'None';
		fig('next-note').textContent = next
			? `Goes out ${weekday(next.date)}, ${day(next.date)}, from ${plural(next.orders, 'order')}`
			: 'Nothing waiting to go out';
		const transit = payouts.filter((p) => p.status === 'transit');
		fig('transit').textContent = money(transit.reduce((a, p) => a + p.net, 0));
		fig('transit-note').textContent = transit.length
			? `Lands ${weekday(transit[0].arrive)}, ${day(transit[0].arrive)}`
			: 'Nothing on the way';
		const sep = payouts.filter((p) => p.date.slice(0, 7) === '2026-09');
		fig('month').textContent = money(sep.reduce((a, p) => a + p.net, 0));
		fig('month-note').textContent = `${plural(sep.length, 'payout')}, ${plural(
			sep.reduce((a, p) => a + p.orders, 0),
			'order',
		)}`;
		const fees = payouts.reduce((a, p) => a + p.fees, 0);
		const gross = payouts.reduce((a, p) => a + p.gross, 0);
		fig('fees').textContent = money(fees);
		fig('fees-note').textContent = `${((fees / gross) * 100).toFixed(1)}% of charges since September 1`;
	}

	/* The list */
	const rowsEl = pick('[data-po-rows]', root);
	const SHOW = 10;
	let more = false;
	let shown = [];
	function drawList() {
		shown = more ? payouts : payouts.slice(0, SHOW);
		pick('[data-po-summary]', root).textContent =
			`${plural(payouts.length, 'payout')} since September 1 to ${pay.BANK.name} ending ${pay.BANK.last4}.`;
		rowsEl.innerHTML = shown
			.map(
				(p) =>
					`<tr data-po-id="${p.id}"><td class="po-col-id"><span class="po-strong">${p.id}</span></td><td class="po-col-date">${day(p.date)}</td><td class="po-col-arrive">${day(p.arrive)}</td><td class="po-col-orders">${p.orders}</td><td class="po-col-gross">${money(p.gross)}</td><td class="po-col-refunds">${p.refunds ? money(p.refunds) : '<span class="po-quiet">None</span>'}</td><td class="po-col-fees">${money(-p.fees)}</td><td class="po-col-net"><span class="po-money">${money(p.net)}</span></td><td class="po-col-status">${pill(p)}</td><td class="po-col-act"><button type="button" class="btn btn-icon btn-sm" data-po-open aria-label="Quick view: ${p.id}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button></td></tr>`,
			)
			.join('');
		if (window.Basalt.tips) window.Basalt.tips(rowsEl);
		const rest = payouts.length - SHOW;
		pick('[data-po-foot]', root).hidden = rest <= 0;
		pick('[data-po-foot-note]', root).textContent = more
			? `Showing all ${payouts.length}.`
			: `Showing the latest ${SHOW} of ${payouts.length}.`;
		const btn = pick('[data-po-more]', root);
		btn.textContent = more ? 'Show fewer' : 'Show all';
		btn.setAttribute('aria-expanded', String(more));
	}
	pick('[data-po-more]', root).addEventListener('click', () => {
		window.Basalt.slide(pick('.po-table-wrap', root), () => {
			more = !more;
			drawList();
		});
	});
	/* There is no page per payout, so the whole row opens the side panel. */
	rowsEl.addEventListener('click', (e) => {
		const tr = e.target.closest('tr[data-po-id]');
		if (tr && !e.target.closest('a')) openPayout(tr.getAttribute('data-po-id'));
	});

	/* Paid out each week, and the bank */
	function drawSides() {
		const weeks = {};

		for (const p of payouts.filter((p) => p.status !== 'pending')) {
			const d = parse(p.date);
			d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
			const k = iso(d);
			weeks[k] = weeks[k] || { net: 0, n: 0, orders: 0 };
			weeks[k].net += p.net;
			weeks[k].n++;
			weeks[k].orders += p.orders;
		}

		const keys = Object.keys(weeks).sort().reverse().slice(0, 5);
		const top = Math.max(...keys.map((k) => weeks[k].net));
		const tones = [1, 5, 3, 8, 2];
		pick('[data-po-weeks-sub]', root).textContent = 'Money paid out, by the week it went out. Newest first.';
		pick('[data-po-weeks]', root).innerHTML = keys
			.map((k, i) => {
				const w = weeks[k];
				return `<li class="po-bars-row"><span class="po-bars-name">Week of ${day(k)}</span><span class="po-bars-count">${money(w.net)}</span><span class="po-bars-track" aria-hidden="true"><span class="po-bars-bar po-tone-${tones[i]}" style="width:${Math.max(4, Math.round((w.net / top) * 100))}%"></span></span><span class="po-bars-note">${plural(w.n, 'payout')}, ${plural(w.orders, 'order')}</span></li>`;
			})
			.join('');
		pick('[data-po-bank]', root).innerHTML =
			`<div class="po-bank-acct"><span class="po-tile po-tone-3" aria-hidden="true"><i class="bi bi-bank2"></i></span><span><span class="po-strong">${htmlSafe(pay.BANK.name)}</span><span class="po-quiet">${htmlSafe(pay.BANK.holder)} · ending ${pay.BANK.last4}</span></span></div><dl class="po-facts"><div><dt>Schedule</dt><dd>Each working day, ${pay.DELAY.payout} working days after the charge</dd></div><div><dt>Arrives</dt><dd>The next working day</dd></div><div><dt>Shown as</dt><dd>MARLO PAYOUT and the payout number</dd></div></dl><a class="btn btn-outline-secondary btn-sm po-bank-btn" href="payment-methods.html">Payment methods</a>`;
	}

	/* CSV export */
	pick('[data-po-export]').addEventListener('click', () => {
		function cell(v) {
			return `"${String(v).replace(/"/g, '""')}"`;
		}

		const rows = [
			['Payout', 'Paid out', 'Arrives', 'Orders', 'Charges', 'Refunds', 'Fees', 'Amount', 'Status'],
		].concat(
			payouts.map((p) => [
				p.id,
				p.date,
				p.arrive,
				p.orders,
				(p.gross / 100).toFixed(2),
				(p.refunds / 100).toFixed(2),
				(p.fees / 100).toFixed(2),
				(p.net / 100).toFixed(2),
				STATUS[p.status].label,
			]),
		);
		const blob = new Blob([rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `payouts-${TODAY}.csv`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
		toast({
			tone: 'success',
			icon: 'bi-download',
			title: `Exported ${plural(payouts.length, 'payout')}`,
			text: a.download,
		});
	});

	/* Side panel: the orders in one payout */
	const drawer = pick('#po-payout');
	const body = pick('[data-po-r="body"]', drawer);
	let ids = [];
	let at = 0;
	function drawRecord(p) {
		pick('[data-po-r="title"]', drawer).textContent = p.id;
		pick('[data-po-r="sub"]', drawer).textContent =
			`${(p.status === 'pending' ? 'Goes out ' : 'Paid out ') + day(p.date)} · ${p.status === 'paid' ? 'arrived ' : 'arrives '}${day(p.arrive)}`;
		body.innerHTML = `<div class="po-r-state">${pill(p)}</div><section class="basalt-drawer-section" aria-labelledby="po-r-sums"><h3 class="basalt-drawer-legend" id="po-r-sums">Amount</h3><dl class="po-sums"><div><dt>Charges</dt><dd>${money(p.gross)}</dd></div>${p.refunds ? `<div><dt>Card refunds</dt><dd>${money(p.refunds)}</dd></div>` : ''}<div><dt>Fees</dt><dd>${money(-p.fees)}</dd></div><div class="po-sums-total"><dt>To the bank</dt><dd>${money(p.net)}</dd></div></dl></section><section class="basalt-drawer-section" aria-labelledby="po-r-orders"><h3 class="basalt-drawer-legend" id="po-r-orders">In this payout</h3><ul class="po-lines">${p.list
			.map(
				(x) =>
					`<li class="po-line${x.kind === 'refund' ? ' po-line-refund' : ''}"><span class="po-line-icon" aria-hidden="true"><i class="bi ${x.kind === 'refund' ? 'bi-arrow-counterclockwise' : x.wallet ? 'bi-phone' : 'bi-credit-card-2-front'}"></i></span><span class="po-line-text"><a class="po-link" href="order-details.html?id=${encodeURIComponent(x.order)}">${x.order}</a><span class="po-quiet">${htmlSafe(x.who)} · ${x.kind === 'refund' ? `refund ${x.ref}` : x.wallet ? 'wallet' : 'card'}, ${day(x.at)}</span></span><span class="po-line-amount"><span class="po-strong">${money(x.cents)}</span>${x.fee ? `<span class="po-quiet">fee ${money(-x.fee)}</span>` : ''}</span></li>`,
			)
			.join(
				'',
			)}</ul></section><section class="basalt-drawer-section" aria-labelledby="po-r-bank"><h3 class="basalt-drawer-legend" id="po-r-bank">Bank</h3><dl class="po-facts"><div><dt>Account</dt><dd>${htmlSafe(pay.BANK.name)} ending ${pay.BANK.last4}</dd></div><div><dt>Shown as</dt><dd>MARLO PAYOUT ${p.id}</dd></div></dl></section>`;
		body.scrollTop = 0;
	}
	function navTo(i, dir) {
		at = (i + ids.length) % ids.length;
		drawRecord(payouts.find((p) => p.id === ids[at]));
		pick('[data-basalt-record-pos]', drawer).textContent = `${at + 1} of ${ids.length}`;
		drawer.classList.toggle('is-back', dir < 0);
	}
	function openPayout(id) {
		ids = shown.map((p) => p.id);
		navTo(ids.indexOf(id));
		bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
	}
	start();
})();
