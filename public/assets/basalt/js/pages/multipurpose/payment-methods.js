/**
 * Basalt - Payment Methods (payment-methods.html)
 * The ways shoppers can pay at the Marlo shop: each method's mode
 * (live, test or off), fee, currencies and what it took in the last
 * 30 days. Draws the four figures, the methods list, the fees card
 * and the bank card, and the settings panel a row opens.
 *
 * The methods are window.Basalt.data.shopPayments (assets/js/data/
 * shop-payments.js); the orders behind the 30-day figures are the
 * shop book's (window.Basalt.shopBook, assets/basalt/js/data/multipurpose/store.js), so a
 * method's order count matches Orders. Mode changes stay on this page;
 * in a real app each would be a call to your payment provider.
 */
(() => {
	'use strict';
	const root = pick('[data-acl-root]');
	const book = window.Basalt.shopBook;
	const data = window.Basalt.data && window.Basalt.data.shopPayments;
	if (!root || !book || !data || typeof bootstrap === 'undefined') return;

	function start() {
		pick('[data-basalt-record-prev]', drawer).addEventListener('click', () => navTo(at - 1, -1));
		pick('[data-basalt-record-next]', drawer).addEventListener('click', () => navTo(at + 1, 1));
		drawer.addEventListener('keydown', (e) => {
			if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
			e.preventDefault();
			navTo(at + (e.key === 'ArrowUp' ? -1 : 1), e.key === 'ArrowUp' ? -1 : 1);
		});
		form.addEventListener('submit', (e) => e.preventDefault());
		pick('[data-acl-save]', drawer).addEventListener('click', () => {
			const m = methods[at];
			const mode = (pick('input[name="pmMode"]:checked', form) || {}).value || m.mode;
			const changed = mode !== m.mode;
			m.mode = mode;
			if (mode !== 'off' && !m.since) m.since = TODAY;
			bootstrap.Offcanvas.getOrCreateInstance(drawer).hide();
			drawFigs();
			drawList();
			toast({
				tone: 'success',
				icon: 'bi-check2-circle',
				title: m.name + (changed ? ` is now ${MODE[mode].label.toLowerCase()}` : ' saved'),
				text:
					mode === 'live'
						? 'Shoppers see it at checkout.'
						: mode === 'test'
							? 'Only staff with a test card see it.'
							: 'Hidden from checkout.',
			});
			const live = pick('[data-acl-live]', root);
			if (live) live.textContent = `${m.name} saved`;
		});

		drawFigs();
		drawList();
		drawSides();
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function htmlSafe(s) {
		return String(s == null ? '' : s).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function money(c) {
		return `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function whole(c) {
		return `$${Math.round(c / 100).toLocaleString('en-US')}`;
	}

	function plural(n, word) {
		return `${n} ${word}${n === 1 ? '' : 's'}`;
	}

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
	function longDay(s) {
		const [y, m, d] = s.split('-').map(Number);
		return `${MONTHS_LONG[m - 1]} ${d}, ${y}`;
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	const { WALLET, BANK, DELAY } = data;
	const methods = JSON.parse(JSON.stringify(data.METHODS));
	const MODE = {
		live: { label: 'Live', cls: 'basalt-status-dot basalt-status-success' },
		test: { label: 'Test', cls: 'basalt-status-dot basalt-status-warning' },
		off: { label: 'Off', cls: 'basalt-status-dot' },
	};

	/* The last 30 days, from the shop book */
	const TODAY = book.NOW.slice(0, 10);
	const FROM = (() => {
		const [y, m, d] = TODAY.split('-').map(Number);
		const x = new Date(y, m - 1, d - 30);
		return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
	})();

	function feeOf(m, cents) {
		if (!m.fee) return 0;
		const f = Math.round((cents * m.fee.pct) / 100) + m.fee.fixed;
		return m.fee.cap ? Math.min(f, m.fee.cap) : f;
	}

	function methodOf(o) {
		return o.paymentMethod === 'card' && WALLET.includes(o.orderNumber)
			? 'wallet'
			: (methods.find((m) => m.pays.includes(o.paymentMethod)) || {}).id;
	}

	const paid = book.ORDERS.filter((o) => o.date >= FROM && o.status !== 'placed' && o.status !== 'canceled');
	const stats = {};
	methods.forEach((m) => {
		stats[m.id] = { orders: 0, cents: 0, fees: 0 };
	});

	for (const o of paid) {
		const id = methodOf(o);
		if (!id) continue;
		const m = methods.find((x) => x.id === id);
		const cents = Math.round(o.total * 100);
		stats[id].orders++;
		stats[id].cents += cents;
		stats[id].fees += feeOf(m, cents);
	}

	const totalOrders = paid.length;
	const totalCents = paid.reduce((a, o) => a + Math.round(o.total * 100), 0);

	function feeText(m) {
		return !m.fee
			? 'No fee'
			: `${m.fee.pct}%${m.fee.fixed ? ` + ${m.fee.fixed}¢` : ''}${m.fee.cap ? `, up to $${m.fee.cap / 100}` : ''}`;
	}

	function curText(m) {
		return m.currencies.length > 3
			? `${m.currencies.slice(0, 3).join(', ')} +${m.currencies.length - 3}`
			: m.currencies.join(', ');
	}

	function tile(m, cls) {
		return `<span class="acl-tile acl-tone-${m.tone}${cls ? ` ${cls}` : ''}" aria-hidden="true"><i class="bi ${m.icon}"></i></span>`;
	}

	function modePill(m) {
		return `<span class="basalt-status ${MODE[m.mode].cls}">${MODE[m.mode].label}</span>`;
	}

	/* Figures */
	function fig(k) {
		return pick(`[data-acl-fig="${k}"]`, root);
	}

	function drawFigs() {
		const live = methods.filter((m) => m.mode === 'live').length;
		const test = methods.filter((m) => m.mode === 'test').length;
		fig('live').textContent = `${live} of ${methods.length}`;
		fig('live-note').textContent = test ? `${plural(test, 'method')} in test mode` : 'Nothing in test mode';
		const cards = stats.card.orders + stats.wallet.orders;
		fig('cards').textContent = `${Math.round((cards / totalOrders) * 100)}%`;
		fig('cards-note').textContent = `${cards} of ${totalOrders} paid orders, wallets included`;
		const fees = Object.keys(stats).reduce((a, k) => a + stats[k].fees, 0);
		fig('fees').textContent = money(fees);
		fig('fees-note').textContent = `On ${whole(totalCents)} taken in 30 days`;
		const feeBase = Object.keys(stats)
			.filter((k) => stats[k].fees)
			.reduce((a, k) => a + stats[k].cents, 0);
		fig('rate').textContent = `${((fees / feeBase) * 100).toFixed(1)}%`;
		fig('rate-note').textContent = 'Of the money on methods with a fee';
	}

	/* The list */
	const rowsEl = pick('[data-acl-rows]', root);
	function drawList() {
		pick('[data-acl-summary]', root).textContent =
			`Shoppers see the live ones in this order. Figures cover the 30 days to ${longDay(TODAY).replace(/, \d+$/, '')}.`;
		rowsEl.innerHTML = methods
			.map((m) => {
				const s = stats[m.id];
				const share = totalOrders ? Math.round((s.orders / totalOrders) * 100) : 0;
				return `<tr data-acl-id="${m.id}"${m.mode === 'off' ? ' class="is-off"' : ''}><td class="acl-col-name"><span class="acl-name">${tile(m)}<span class="acl-name-text">${htmlSafe(m.name)}</span></span></td><td class="acl-col-mode">${modePill(m)}</td><td class="acl-col-fee">${feeText(m)}</td><td class="acl-col-cur">${curText(m)}</td><td class="acl-col-orders">${s.orders || '<span class="acl-quiet">None</span>'}</td><td class="acl-col-amount">${s.cents ? whole(s.cents) : '<span class="acl-quiet">None</span>'}</td><td class="acl-col-share"><span class="acl-share"><span class="acl-share-track" aria-hidden="true"><span class="acl-share-bar acl-tone-${m.tone}" style="width:${share}%"></span></span>${share}%</span></td><td class="acl-col-act"><button type="button" class="btn btn-icon btn-sm" data-acl-open aria-label="Quick view: ${htmlSafe(m.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button></td></tr>`;
			})
			.join('');
		if (window.Basalt.tips) window.Basalt.tips(rowsEl);
	}
	/* There is no page per method, so the whole row opens the side panel. */
	rowsEl.addEventListener('click', (e) => {
		const tr = e.target.closest('tr[data-acl-id]');
		if (tr) openMethod(tr.getAttribute('data-acl-id'));
	});

	/* Fees by method, and the bank */
	function drawSides() {
		const rows = methods.filter((m) => stats[m.id].fees).sort((a, b) => stats[b.id].fees - stats[a.id].fees);
		const top = stats[rows[0].id].fees;
		pick('[data-acl-fees-sub]', root).textContent = 'What each method cost in the last 30 days, most first.';
		pick('[data-acl-fees]', root).innerHTML = rows
			.map((m) => {
				const s = stats[m.id];
				return `<li class="acl-bars-row"><span class="acl-bars-name">${htmlSafe(m.name)}</span><span class="acl-bars-count">${money(s.fees)}</span><span class="acl-bars-track" aria-hidden="true"><span class="acl-bars-bar acl-tone-${m.tone}" style="width:${Math.max(4, Math.round((s.fees / top) * 100))}%"></span></span><span class="acl-bars-note">${((s.fees / s.cents) * 100).toFixed(1)}% of ${whole(s.cents)} on ${plural(s.orders, 'order')}</span></li>`;
			})
			.join('');
		pick('[data-acl-bank]', root).innerHTML =
			`<div class="acl-bank-acct"><span class="acl-tile acl-tone-3" aria-hidden="true"><i class="bi bi-bank2"></i></span><span><span class="acl-strong">${htmlSafe(BANK.name)}</span><span class="acl-quiet">${htmlSafe(BANK.holder)} · ending ${BANK.last4}</span></span></div><dl class="acl-facts"><div><dt>Schedule</dt><dd>Each working day, ${DELAY.payout} working days after the charge</dd></div><div><dt>Arrives</dt><dd>The next working day</dd></div><div><dt>Currency</dt><dd>Paid out in ${BANK.currency}, converted at the day’s rate</dd></div></dl><a class="btn btn-outline-secondary btn-sm acl-bank-btn" href="payouts.html">See payouts</a>`;
	}

	/* Settings panel */
	const drawer = pick('#pm-method');
	const form = pick('[data-acl-r="body"]', drawer);
	let at = 0;
	function drawRecord(m) {
		const s = stats[m.id];
		const t = pick('[data-acl-r="tile"]', drawer);
		t.className = `acl-tile acl-tone-${m.tone}`;
		t.innerHTML = `<i class="bi ${m.icon}"></i>`;
		pick('[data-acl-r="title"]', drawer).textContent = m.name;
		pick('[data-acl-r="sub"]', drawer).textContent = m.detail;
		form.innerHTML = `<section class="basalt-drawer-section" aria-labelledby="pm-r-mode"><h3 class="basalt-drawer-legend" id="pm-r-mode">Mode</h3><div class="basalt-segmented basalt-segmented-sm basalt-segmented-block" role="radiogroup" aria-labelledby="pm-r-mode" data-basalt-segmented>${Object.keys(
			MODE,
		)
			.map(
				(k) =>
					`<input type="radio" class="btn-check" name="pmMode" id="pm-mode-${k}" value="${k}"${m.mode === k ? ' checked' : ''}><label class="basalt-segmented-option" for="pm-mode-${k}">${MODE[k].label}</label>`,
			)
			.join(
				'',
			)}</div><p class="acl-quiet acl-r-hint">Live takes real money. Test shows it only to staff with a test card. Off hides it.</p></section><section class="basalt-drawer-section" aria-labelledby="pm-r-stats"><h3 class="basalt-drawer-legend" id="pm-r-stats">Last 30 days</h3><dl class="acl-stats"><div><dt>Orders</dt><dd>${s.orders}</dd></div><div><dt>Taken</dt><dd>${whole(s.cents)}</dd></div><div><dt>Fees</dt><dd>${money(s.fees)}</dd></div></dl></section><section class="basalt-drawer-section" aria-labelledby="pm-r-terms"><h3 class="basalt-drawer-legend" id="pm-r-terms">Terms</h3><dl class="acl-facts"><div><dt>Fee</dt><dd>${feeText(m)}</dd></div>${m.limits ? `<div><dt>Offered for</dt><dd>Orders from $${m.limits[0].toLocaleString('en-US')} to $${m.limits[1].toLocaleString('en-US')}</dd></div>` : ''}<div><dt>Money</dt><dd>${htmlSafe(m.payout)}</dd></div><div><dt>Added</dt><dd>${m.since ? longDay(m.since) : 'Not set up yet'}</dd></div></dl></section><section class="basalt-drawer-section" aria-labelledby="pm-r-cur"><h3 class="basalt-drawer-legend" id="pm-r-cur">Currencies</h3><ul class="acl-chips">${m.currencies.map((c) => `<li>${c}</li>`).join('')}</ul></section>`;
		if (window.Basalt.buttons) window.Basalt.buttons(form);
	}
	function navTo(i, dir) {
		at = (i + methods.length) % methods.length;
		drawRecord(methods[at]);
		pick('[data-basalt-record-pos]', drawer).textContent = `${at + 1} of ${methods.length}`;
		drawer.classList.toggle('is-back', dir < 0);
	}
	function openMethod(id) {
		navTo(methods.findIndex((m) => m.id === id));
		bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
	}
	start();
})();
