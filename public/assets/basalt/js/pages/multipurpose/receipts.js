/**
 * Receipts page (receipts.html). Lists the money customers sent Fieldline
 * over the last two weeks, says where each payment stands (still clearing,
 * landed, or gone wrong), what it cost to take, and offers the fix for the
 * broken ones: another go at the card, a payment link, dispute evidence or
 * a refund. A row leads to Receipt Details (receipt-details.html?id=<ref>);
 * the icon at its end opens the same payment in a side sheet without
 * leaving the list.
 *
 * Everything shown is read from the shared billing book
 * (window.Basalt.data.billing, assets/basalt/js/data/multipurpose/billing.js): card charges for
 * one-off purchases, matching Company Details, and settlements of the
 * invoices on the Invoices page, to the cent. Point the page at your
 * payment processor's feed instead and keep the shapes.
 */
(() => {
	'use strict';

	const screen = pick('[data-rcp-root]', document);
	const ledger = window.Basalt.data?.billing;
	if (!screen || !ledger) return;

	/* Fixed facts for the demo. `today` stands in for new Date(); a live page
     would read the clock. `parties` is filled in below from everyone who
     paid or still owes: name, contact, email and their page on Company
     Details. `unpaid` is what a recorded payment can be put against. */
	const BOOK = {
		today: ledger.today,
		clock: `${ledger.today} 10:40`,
		since: ledger.paidSince,
		bankName: 'Operating ···5182',
		parties: {},
		entries: ledger.payments(),
		unpaid: ledger
			.invoices()
			.filter((inv) => inv.state === 'sent')
			.sort((a, b) => a.due.localeCompare(b.due))
			.map((inv) => ({ number: inv.no, acct: inv.acct, owed: inv.amount, due: inv.due })),
	};
	const { today: THIS_DAY } = BOOK;

	for (const entry of [...BOOK.entries, ...BOOK.unpaid]) {
		if (BOOK.parties[entry.acct]) continue;
		const party = ledger.billTo(entry.acct);
		BOOK.parties[entry.acct] = {
			name: party.name,
			contact: party.contact,
			email: party.email,
			account: party.account,
		};
	}

	/* Each way of paying: what Fieldline pays to take it, and how many
     working days the bank needs before the money can be used. */
	const WAYS = {
		card: {
			name: 'Card',
			glyph: 'bi-credit-card',
			lag: 2,
			cost: (sum) => cents(sum * 0.029 + 0.3),
			costName: 'Card fee',
			costNote: '2.9% + 30¢',
		},
		ach: {
			name: 'Bank transfer',
			glyph: 'bi-bank',
			lag: 2,
			cost: (sum) => Math.min(5, cents(sum * 0.008)),
			costName: 'Bank transfer fee',
			costNote: '0.8%, at most $5',
		},
		wire: {
			name: 'Wire',
			glyph: 'bi-send',
			lag: 0,
			cost: () => 15,
			costName: 'Incoming wire fee',
			costNote: 'Flat $15',
		},
		check: {
			name: 'Check',
			glyph: 'bi-envelope-paper',
			lag: 3,
			cost: () => 0,
			costName: 'Check deposit',
			costNote: 'No fee',
		},
	};
	const WAY_KEYS = Object.keys(WAYS);
	const BOUNCE_CHARGE = 4;
	const CHARGEBACK_CHARGE = 15;

	/* What the pill in a row says for each place a payment can be. A payment
     whose state is ok is either clearing or in the bank, worked out from
     the day it lands; the other states are the payment's own. */
	const PILLS = {
		bank: { word: 'In the bank', tone: 'success' },
		clearing: { word: 'Clearing', tone: 'info' },
		failed: { word: 'Failed', tone: 'danger' },
		returned: { word: 'Returned', tone: 'danger' },
		disputed: { word: 'Disputed', tone: 'warning' },
	};
	const TILE_KEYS = ['all', 'clearing', 'bank', 'problem'];
	const EMPTY_COPY = {
		clearing: 'Nothing is on its way to the bank right now.',
		bank: 'No payment has reached the bank yet.',
		problem: 'Every payment went through. Nothing to sort out.',
	};
	const BATCH = 10;

	const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const LONG_MONTH = [
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
	const NUMERAL = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
	const TYPEFACE = "'Schibsted Grotesk', sans-serif";
	const stillMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

	/* Working copies, so a retry or a refund never writes into the shared
     book. A purchase refunded this month picks its refund up from the same
     book the Refunds page reads. */
	const entries = BOOK.entries.map((entry) => ({ ...entry }));
	for (const refund of ledger.refunds()) {
		const paid = entries.find(
			(entry) => entry.for[0] === 'purchase' && entry.for[1] === refund.no && entry.state === 'ok',
		);
		if (!paid) continue;
		const taxed = refund.tax ? refund.tax.amount : 0;
		paid.refund = {
			amount: cents(refund.lines.reduce((sum, line) => sum + line.amount, 0) + taxed),
			reason: refund.reason,
			on: refund.on,
		};
	}

	/* The parts of the page the script reads from or writes to. */
	const ui = {
		tiles: pickAll('[data-rcp-stage]'),
		listPane: pick('[data-rcp-panel]'),
		summary: pick('[data-rcp-list-sum]'),
		rows: pick('[data-rcp-body]'),
		tableWrap: pick('[data-rcp-table-wrap]'),
		search: pick('[data-rcp-search]'),
		way: pick('[data-rcp-method]'),
		tally: pick('[data-rcp-count]'),
		empty: pick('[data-rcp-empty]'),
		emptyCopy: pick('[data-rcp-empty-text]'),
		moreWrap: pick('[data-rcp-more-wrap]'),
		more: pick('[data-rcp-more]'),
		moreLabel: pick('[data-rcp-more-label]'),
		barCanvas: pick('[data-rcp-days]'),
		donutCanvas: pick('[data-rcp-ring]'),
		sheet: document.getElementById('rcp-drawer'),
		recordDialog: document.getElementById('rcp-record'),
	};
	ui.faces = pickAll('[data-rcp-view]', ui.sheet);
	ui.refundPane = pick('[data-rcp-refund-form]', ui.sheet);
	ui.evidencePane = pick('[data-rcp-evidence-form]', ui.sheet);
	ui.recordPane = pick('[data-rcp-form]', ui.recordDialog);
	const sheetCtl = window.bootstrap ? bootstrap.Offcanvas.getOrCreateInstance(ui.sheet) : null;
	const recordCtl = window.bootstrap ? bootstrap.Modal.getOrCreateInstance(ui.recordDialog) : null;

	/* What the visitor has asked the list for, and what it is showing. */
	const filter = { tile: 'all', text: '', way: 'all', by: 'date', order: 'desc', cap: BATCH };
	let matched = [];
	let visible = [];
	let openId = null;
	let findDelay;
	let chartsLive = false;
	let barChart = null;
	let donutChart = null;
	let shownEntry = null;
	let face = 'detail';
	let walkList = [];
	let walker = null;
	let attachments = [];
	let nextRef = 90472;

	function start() {
		wireTiles();
		wireToolbar();
		wireRows();
		wireSheet();
		wireRefund();
		wireEvidence();
		wireRecord();
		wireExport();
		paintAll();
		watchCharts();
	}

	/* Small utilities the rest of the file leans on. */

	function pick(selector, scope = screen) {
		return scope.querySelector(selector);
	}
	function pickAll(selector, scope = screen) {
		return [...scope.querySelectorAll(selector)];
	}
	function on(target, type, handler) {
		target.addEventListener(type, handler);
	}
	function unflag(field) {
		field.classList.remove('is-invalid');
	}
	function notify(message) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(message) : null;
	}
	function sayAloud(text) {
		if (window.Basalt.announce) window.Basalt.announce(text);
	}
	function parkToasts(corner) {
		if (window.Basalt.toasts?.position) window.Basalt.toasts.position(corner);
	}
	function cents(value) {
		return Math.round(value * 100) / 100;
	}
	function sumOf(list, key) {
		return list.reduce((sum, item) => sum + item[key], 0);
	}
	function cssVar(name, fallback) {
		return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
	}
	function rampColor(step, fallback) {
		return cssVar(`--basalt-series-${step}`, fallback);
	}

	function safe(value) {
		const swap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (ch) => swap[ch]);
	}

	/* Dates travel as ISO strings; these turn them into the words on screen.
     A no-break space keeps a month and its day together on one line. */

	function parseDay(iso) {
		const [year, month, dayOfMonth] = iso.slice(0, 10).split('-').map(Number);
		return new Date(year, month - 1, dayOfMonth);
	}

	function stamp(date) {
		const twoDigits = (n) => String(n).padStart(2, '0');
		return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
	}

	function shortDay(iso) {
		const date = parseDay(iso);
		return `${SHORT_MONTH[date.getMonth()]} ${date.getDate()}`;
	}
	function longDay(iso) {
		const date = parseDay(iso);
		return `${LONG_MONTH[date.getMonth()]} ${date.getDate()}`;
	}
	function clock12(hhmm) {
		const hour = +hhmm.slice(0, 2);
		return `${hour % 12 || 12}:${hhmm.slice(3, 5)}${hour < 12 ? ' am' : ' pm'}`;
	}
	function dayAndClock(iso) {
		return `${shortDay(iso)}, ${clock12(iso.slice(11, 16))}`;
	}

	/* Money does not move between banks on a weekend, so only working days
     count toward the day a payment lands. */
	function plusWorkdays(iso, count) {
		const date = parseDay(iso);
		let left = count;
		while (left > 0) {
			date.setDate(date.getDate() + 1);
			if (date.getDay() !== 0 && date.getDay() !== 6) left -= 1;
		}
		return stamp(date);
	}

	/* Numbers as words and amounts. */

	function dollars(value) {
		const sign = value < 0 ? '−' : '';
		return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function compact(value) {
		if (value >= 1000) return `$${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
		return wholeDollars(value);
	}

	function wholeDollars(value) {
		return `$${Math.round(value).toLocaleString('en-US')}`;
	}
	function countOf(count, one, many) {
		return `${count} ${count === 1 ? one : many || `${one}s`}`;
	}
	function spelledCount(count, one, many) {
		return `${NUMERAL[count] || count} ${count === 1 ? one : many || `${one}s`}`;
	}
	function upperFirst(text) {
		return text.charAt(0).toUpperCase() + text.slice(1);
	}
	function monogram(name) {
		return name
			.replace(/[^A-Za-z ]/g, '')
			.split(' ')
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0])
			.join('')
			.toUpperCase();
	}

	function hueFor(name) {
		let total = 0;
		for (const ch of name) total += ch.charCodeAt(0);
		return (total % 6) + 1;
	}

	/* Facts about one payment that several parts of the page ask for. */

	function payerOf(entry) {
		return BOOK.parties[entry.acct];
	}
	function pageFor(entry) {
		return `receipt-details.html?id=${encodeURIComponent(entry.id)}`;
	}
	function chargedOn(entry) {
		return entry.retry || entry.at;
	}
	function landsOn(entry) {
		return plusWorkdays(chargedOn(entry), WAYS[entry.method].lag);
	}
	function tileOf(entry) {
		return entry.state === 'ok' ? placeOf(entry) : 'problem';
	}
	function costOf(entry) {
		return entry.state === 'failed' ? 0 : WAYS[entry.method].cost(entry.amount);
	}
	function paidForText(entry) {
		return `${entry.for[0] === 'purchase' ? 'Order ' : 'Invoice '}${entry.for[1]}`;
	}

	function placeOf(entry) {
		if (entry.state !== 'ok') return entry.state;
		return landsOn(entry) <= THIS_DAY ? 'bank' : 'clearing';
	}

	function sortedOut(entry) {
		const pending = {
			failed: () => !!entry.linkSent,
			returned: () => !!entry.linkSent,
			disputed: () => !!entry.evidenceSent,
		};
		return pending[entry.state] ? pending[entry.state]() : true;
	}

	function paidForLink(entry) {
		if (entry.for[0] === 'purchase') return `company-details.html?id=${encodeURIComponent(entry.acct)}`;
		return `invoice-details.html?id=${encodeURIComponent(entry.for[1])}`;
	}

	function stateTag(entry) {
		const pill = PILLS[placeOf(entry)];
		return `<span class="basalt-status basalt-status-dot basalt-status-${pill.tone}">${pill.word}</span>`;
	}

	function avatarFor(entry) {
		const payer = payerOf(entry).name;
		return `<span aria-hidden="true" class="basalt-avatar rcp-mark basalt-avatar-tone-${hueFor(payer)}">${safe(monogram(payer))}</span>`;
	}

	function wayCell(entry) {
		const way = WAYS[entry.method];
		const wording = {
			card: () => entry.from.replace(/ ending /, ' ··'),
			check: () => entry.from.replace('Check no. ', 'Check '),
		};
		const detail = wording[entry.method] ? wording[entry.method]() : way.name;
		return `<span class="rcp-method rcp-method-${entry.method}"><i aria-hidden="true" class="bi ${way.glyph}"></i>${safe(detail)}</span>`;
	}

	function rowAside(entry) {
		if (entry.refund) return `Refunded ${dollars(entry.refund.amount)}`;
		if (entry.state === 'failed' || entry.state === 'returned') return entry.linkSent ? 'Payment link sent' : '';
		if (entry.state === 'disputed')
			return entry.evidenceSent ? 'Evidence sent' : `Evidence due ${shortDay(entry.dispute.due)}`;
		return '';
	}

	/* The tiles above the list: one bar split by where the money is, then
     a tile per place with its total. The problem tile also counts what
     still waits on the team. One tile is always current and the arrow
     keys walk between them. */

	function wireTiles() {
		for (const [index, tile] of ui.tiles.entries()) {
			on(tile, 'click', () => chooseTile(tile.getAttribute('data-rcp-stage')));
			on(tile, 'keydown', (event) => {
				const jump = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
				const edge = { Home: 0, End: ui.tiles.length - 1 }[event.key];
				let target = null;
				if (jump) target = (index + jump + ui.tiles.length) % ui.tiles.length;
				else if (edge !== undefined) target = edge;
				if (target === null) return;
				event.preventDefault();
				chooseTile(ui.tiles[target].getAttribute('data-rcp-stage'), true);
			});
		}
	}

	function chooseTile(key, moveFocus) {
		filter.tile = key;
		filter.cap = BATCH;
		for (const tile of ui.tiles) {
			const current = tile.getAttribute('data-rcp-stage') === key;
			tile.setAttribute('aria-selected', String(current));
			tile.tabIndex = current ? 0 : -1;
			if (!current) continue;
			ui.listPane.setAttribute('aria-labelledby', tile.id);
			if (moveFocus) tile.focus();
		}
		paintRows();
	}

	function paintTiles() {
		const totals = { all: [0, 0], clearing: [0, 0], bank: [0, 0], problem: [0, 0] };
		for (const entry of entries) {
			for (const key of [tileOf(entry), 'all']) {
				totals[key][0] += entry.amount;
				totals[key][1] += 1;
			}
		}
		const lastLanding = entries
			.filter((entry) => tileOf(entry) === 'clearing')
			.map(landsOn)
			.sort()
			.pop();
		const waiting = entries.filter((entry) => entry.state !== 'ok' && !sortedOut(entry)).length;
		const problemLine = () => {
			if (!totals.problem[1]) return 'Nothing went wrong';
			return waiting
				? `${countOf(totals.problem[1], 'payment')}, ${waiting} to sort out`
				: `${countOf(totals.problem[1], 'payment')}, all handled`;
		};
		const captions = {
			all: `${countOf(totals.all[1], 'payment')} since ${shortDay(BOOK.since)}`,
			clearing: totals.clearing[1]
				? `${countOf(totals.clearing[1], 'payment')}, all in by ${shortDay(lastLanding)}`
				: 'Nothing on its way',
			bank: `${countOf(totals.bank[1], 'payment')} landed`,
			problem: problemLine(),
		};
		for (const key of TILE_KEYS) {
			pick(`[data-rcp-stage-value="${key}"]`).textContent = wholeDollars(totals[key][0]);
			pick(`[data-rcp-stage-meta="${key}"]`).textContent = captions[key];
		}
		for (const segment of pickAll('[data-rcp-track]'))
			segment.style.flexGrow = totals[segment.getAttribute('data-rcp-track')][0];
	}

	/* The list: search, the way-of-paying filter, sorting and paging. */

	function wireToolbar() {
		on(ui.search, 'input', () => {
			clearTimeout(findDelay);
			findDelay = setTimeout(() => {
				filter.text = ui.search.value.trim();
				filter.cap = BATCH;
				paintRows();
			}, 160);
		});
		on(ui.way, 'change', () => {
			filter.way = ui.way.value;
			filter.cap = BATCH;
			paintRows();
		});
		on(pick('[data-rcp-clear]'), 'click', () => {
			ui.search.value = '';
			ui.way.value = 'all';
			filter.text = '';
			filter.way = 'all';
			paintRows();
			ui.search.focus();
		});
		on(ui.more, 'click', () => {
			const already = visible.length;
			window.Basalt.slide(ui.tableWrap, () => {
				filter.cap += BATCH;
				paintRows();
			});
			const firstNew = pickAll('.rcp-row', ui.rows)[already];
			if (firstNew) pick('.rcp-who-name', firstNew).focus();
			sayAloud(`Showing ${visible.length} payments`);
		});
		for (const head of pickAll('[data-rcp-sort]')) {
			on(head, 'click', () => {
				const key = head.getAttribute('data-rcp-sort');
				const sameColumn = filter.by === key;
				filter.order = sameColumn && filter.order === 'desc' ? 'asc' : 'desc';
				filter.by = key;
				paintRows();
			});
		}
	}

	function searchText(entry) {
		const payer = payerOf(entry);
		return [
			entry.id,
			payer.name,
			payer.contact,
			entry.for[1],
			entry.from,
			WAYS[entry.method].name,
			PILLS[placeOf(entry)].word,
		].join(' ');
	}

	function passes(entry) {
		if (filter.tile !== 'all' && tileOf(entry) !== filter.tile) return false;
		if (filter.way !== 'all' && entry.method !== filter.way) return false;
		if (!filter.text) return true;
		if (window.Basalt?.matchesQuery) return window.Basalt.matchesQuery(searchText(entry), filter.text);
		return searchText(entry).toLowerCase().includes(filter.text.toLowerCase());
	}

	function ordered(list) {
		const flip = filter.order === 'asc' ? 1 : -1;
		const compare = filter.by === 'amount' ? (a, b) => a.amount - b.amount : (a, b) => a.at.localeCompare(b.at);
		return list.slice().sort((a, b) => compare(a, b) * flip);
	}

	function paintSortHeads() {
		for (const head of pickAll('[data-rcp-th]')) {
			const arrow = pick('.bi', head);
			if (head.getAttribute('data-rcp-th') !== filter.by) {
				head.removeAttribute('aria-sort');
				arrow.className = 'bi bi-arrow-down-up rcp-sort-idle';
				continue;
			}
			const rising = filter.order === 'asc';
			head.setAttribute('aria-sort', rising ? 'ascending' : 'descending');
			arrow.className = `bi ${rising ? 'bi-arrow-up' : 'bi-arrow-down'}`;
		}
	}

	function paintSummary() {
		const landed = entries.filter((entry) => entry.state === 'ok').reduce((sum, entry) => sum + entry.amount, 0);
		const fees = entries.reduce((sum, entry) => sum + (entry.state === 'ok' ? costOf(entry) : 0), 0);
		ui.summary.innerHTML = `${upperFirst(spelledCount(entries.length, 'payment'))} since ${longDay(BOOK.since)}: <strong>${wholeDollars(landed)}</strong> paid in, ${dollars(fees)} of it in fees.`;
	}

	function rowMarkup(entry, freshId) {
		const payer = safe(payerOf(entry).name);
		const aside = rowAside(entry);
		const flags = `${entry.id === openId ? ' is-selected' : ''}${entry.id === freshId ? ' is-fresh' : ''}`;
		const who = `<div class="rcp-who">${avatarFor(entry)}<div class="rcp-who-text"><a class="rcp-who-name" href="${pageFor(entry)}">${payer}</a><span class="rcp-sub"><a class="rcp-sub-for" href="${paidForLink(entry)}">${safe(paidForText(entry))}</a>${aside ? ` · <span class="rcp-sub-note">${safe(aside)}</span>` : ''}</span></div></div>`;
		const quickView = `<button type="button" class="btn btn-icon btn-sm" data-rcp-open="${entry.id}" aria-label="Quick view: ${payer}, ${dollars(entry.amount)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i aria-hidden="true" class="bi bi-layout-sidebar-inset-reverse"></i></button>`;
		const fullPage = `<a class="btn btn-icon btn-sm" href="${pageFor(entry)}" aria-label="Open full page: ${payer}, ${dollars(entry.amount)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i aria-hidden="true" class="bi bi-arrows-angle-expand"></i></a>`;
		return `<tr class="rcp-row${flags}" data-rcp-id="${entry.id}"><td class="rcp-col-who">${who}</td><td class="rcp-col-method">${wayCell(entry)}<span class="rcp-row-date">${shortDay(entry.at)}</span></td><td class="rcp-col-date"><span class="rcp-date">${shortDay(entry.at)}</span></td><td class="rcp-col-status">${stateTag(entry)}</td><td class="rcp-col-amt"><span class="rcp-amt">${dollars(entry.amount)}</span></td><td class="rcp-col-go"><span class="basalt-row-actions">${quickView}${fullPage}</span></td></tr>`;
	}

	/** Redraws the rows for the current filter; `freshId` flashes a new row. */
	function paintRows(freshId) {
		matched = ordered(entries.filter(passes));
		visible = matched.slice(0, filter.cap);
		const nothing = matched.length === 0;
		const narrowed = Boolean(filter.text) || filter.way !== 'all';
		ui.tableWrap.hidden = nothing;
		ui.empty.hidden = !nothing;
		if (nothing) {
			pick('[data-rcp-empty-title]').textContent = narrowed ? 'No payment matches' : 'Nothing here right now';
			ui.emptyCopy.textContent = narrowed
				? 'Try another customer, order or invoice number, or show every way of paying.'
				: EMPTY_COPY[filter.tile] || '';
			pick('[data-rcp-clear]').hidden = !narrowed;
		}
		ui.tally.textContent = nothing ? '' : countOf(matched.length, 'payment');
		ui.rows.innerHTML = visible.map((entry) => rowMarkup(entry, freshId)).join('');
		const remaining = matched.length - visible.length;
		ui.moreWrap.hidden = remaining <= 0;
		ui.moreLabel.textContent = `Show ${Math.min(remaining, BATCH)} more`;
		paintSortHeads();
		if (window.Basalt.tips) window.Basalt.tips(ui.rows);
	}

	function paintAll(freshId) {
		paintTiles();
		paintSummary();
		paintRows(freshId);
		paintCharts();
	}

	function highlightRow(id) {
		for (const row of pickAll('.rcp-row', ui.rows))
			row.classList.toggle('is-selected', row.getAttribute('data-rcp-id') === id);
	}

	/* A click on a row, away from its own links and buttons, goes to the
     payment's page (a new tab with Cmd/Ctrl or the middle button); the
     panel icon opens the side sheet instead. */

	function wireRows() {
		on(ui.rows, 'click', rowClicked);
		on(ui.rows, 'auxclick', (event) => {
			if (event.button === 1 && !event.target.closest('a, button')) rowClicked(event);
		});
	}

	function rowClicked(event) {
		const quick = event.target.closest('[data-rcp-open]');
		if (quick) {
			openSheet(quick.getAttribute('data-rcp-open'));
			return;
		}
		const row = event.target.closest('.rcp-row');
		if (!row || event.target.closest('a, button, input, .dropdown-menu')) return;
		const entry = entries.find((candidate) => candidate.id === row.getAttribute('data-rcp-id'));
		if (!entry) return;
		const elsewhere = event.metaKey || event.ctrlKey || event.button === 1;
		if (elsewhere) window.open(pageFor(entry), '_blank', 'noopener');
		else window.location.href = pageFor(entry);
	}

	/* The two charts: money per day, split by whether it has landed, and a
     ring of the ways customers paid. They are built once the first one
     scrolls into view and rebuilt, without animation, on a theme change. */

	function watchCharts() {
		const wake = () => {
			chartsLive = true;
			mountCharts(true);
		};
		if ('IntersectionObserver' in window) {
			const watcher = new IntersectionObserver(
				(hits) => {
					if (!hits.some((hit) => hit.isIntersecting)) return;
					watcher.disconnect();
					wake();
				},
				{ rootMargin: '80px 0px' },
			);
			watcher.observe(ui.barCanvas);
		} else {
			wake();
		}
		on(document, 'basalt:appearance', () => {
			requestAnimationFrame(() => {
				if (chartsLive) mountCharts(false);
			});
		});
	}

	function spanDays() {
		const days = [];
		const cursor = parseDay(BOOK.since);
		while (stamp(cursor) <= THIS_DAY) {
			days.push(stamp(cursor));
			cursor.setDate(cursor.getDate() + 1);
		}
		return days;
	}

	function perDay() {
		const days = spanDays();
		const landed = days.map(() => 0);
		const moving = days.map(() => 0);
		for (const entry of entries) {
			if (entry.state !== 'ok') continue;
			const slot = days.indexOf(entry.at.slice(0, 10));
			if (slot < 0) continue;
			const bucket = placeOf(entry) === 'bank' ? landed : moving;
			bucket[slot] += entry.amount;
		}
		return { days, landed, moving };
	}

	function perWay() {
		return WAY_KEYS.map((key) => {
			const own = entries.filter((entry) => entry.state === 'ok' && entry.method === key);
			return {
				key,
				count: own.length,
				total: own.reduce((sum, entry) => sum + entry.amount, 0),
				fees: own.reduce((sum, entry) => sum + costOf(entry), 0),
			};
		});
	}

	function paintChartCopy() {
		const daily = perDay();
		const landed = daily.landed.reduce((a, b) => a + b, 0);
		const moving = daily.moving.reduce((a, b) => a + b, 0);
		const combined = daily.days.map((_, i) => daily.landed[i] + daily.moving[i]);
		const peak = combined.indexOf(Math.max(...combined));
		pick('[data-rcp-days-sum]').innerHTML =
			`<strong>${wholeDollars(landed)}</strong> in the bank and ${wholeDollars(moving)} on its way.`;
		ui.barCanvas.setAttribute(
			'aria-label',
			`Stacked bar chart of money paid in each day from ${longDay(BOOK.since)} to ${longDay(THIS_DAY)}: ${wholeDollars(landed)} in the bank and ${wholeDollars(moving)} still clearing. The biggest day was ${longDay(daily.days[peak])} at ${wholeDollars(combined[peak])}.`,
		);

		const ways = perWay();
		const [total, fees] = [sumOf(ways, 'total'), sumOf(ways, 'fees')];
		const cards = ways.find((way) => way.key === 'card');
		const share = (portion, whole) => Math.round((portion / whole) * 100);
		pick('[data-rcp-ways-sum]').innerHTML =
			`Cards brought in ${share(cards.total, total)}% of the money and <strong>${share(cards.fees, fees)}%</strong> of the ${dollars(fees)} in fees.`;
		pick('[data-rcp-ring-total]').textContent = compact(total);
		pick('[data-rcp-ways]').innerHTML = ways
			.map((way) => {
				const feeNote = way.fees ? `${dollars(way.fees)} in fees` : 'no fees';
				return `<li class="rcp-way rcp-method-${way.key}"><span aria-hidden="true" class="rcp-way-swatch"></span><span class="rcp-way-text"><span class="rcp-way-name">${WAYS[way.key].name}</span><span class="rcp-sub">${countOf(way.count, 'payment')} · ${feeNote}</span></span><span class="rcp-way-fig"><span class="rcp-way-amt">${wholeDollars(way.total)}</span><span class="rcp-way-share">${share(way.total, total)}%</span></span></li>`;
			})
			.join('');
		ui.donutCanvas.setAttribute(
			'aria-label',
			`Ring chart of the ${wholeDollars(total)} paid in, by way of paying: ${ways.map((way) => `${WAYS[way.key].name} ${wholeDollars(way.total)}`).join(', ')}.`,
		);
	}

	function tipStyle(extra) {
		const ink = cssVar('--basalt-copy', '#12233a');
		const font = (weight) => (weight ? { family: TYPEFACE, size: 12, weight } : { family: TYPEFACE, size: 12 });
		return {
			backgroundColor: cssVar('--basalt-plane', '#ffffff'),
			titleColor: ink,
			bodyColor: ink,
			footerColor: ink,
			borderColor: cssVar('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			borderWidth: 1,
			padding: 10,
			cornerRadius: 8,
			boxPadding: 4,
			usePointStyle: true,
			titleFont: font('600'),
			bodyFont: font(),
			footerFont: font('600'),
			...extra,
		};
	}

	function mountCharts(animate) {
		if (typeof Chart === 'undefined') return;
		barChart?.destroy();
		donutChart?.destroy();
		const motion = animate && !stillMotion.matches ? { duration: 500, easing: 'easeOutQuart' } : false;
		const tickStyle = {
			color: cssVar('--basalt-copy-muted', '#5f7186'),
			font: { family: TYPEFACE, size: 11.5 },
			padding: 6,
		};
		const daily = perDay();
		const rounded = { topLeft: 5, topRight: 5 };
		const bar = (label, data, color, radius) => ({
			label,
			data,
			backgroundColor: color,
			borderRadius: radius,
			borderSkipped: false,
			maxBarThickness: 30,
			stack: 'in',
		});
		const fillsCard = { responsive: true, maintainAspectRatio: false, animation: motion };
		const hidden = () => ({ display: false });
		barChart = new Chart(ui.barCanvas, {
			type: 'bar',
			data: {
				labels: daily.days.map(shortDay),
				datasets: [
					/* A day reads as one bar: only the top of its stack is rounded. */
					bar('In the bank', daily.landed, cssVar('--basalt-success', '#1f9d6b'), (ctx) =>
						daily.moving[ctx.dataIndex] ? 0 : rounded,
					),
					bar('Clearing', daily.moving, cssVar('--basalt-info', '#2f8fd8'), rounded),
				],
			},
			options: {
				...fillsCard,
				interaction: { mode: 'index', intersect: false },
				plugins: {
					legend: hidden(),
					tooltip: tipStyle({
						filter: (ctx) => ctx.parsed.y > 0,
						callbacks: {
							title: (items) => longDay(daily.days[items[0].dataIndex]),
							label: (ctx) => ` ${ctx.dataset.label}: ${dollars(ctx.parsed.y)}`,
							footer: (items) =>
								items.length > 1
									? `Total: ${dollars(items.reduce((sum, ctx) => sum + ctx.parsed.y, 0))}`
									: '',
						},
					}),
				},
				scales: {
					x: {
						stacked: true,
						grid: hidden(),
						border: hidden(),
						ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 12, ...tickStyle },
					},
					y: {
						stacked: true,
						beginAtZero: true,
						grid: { color: cssVar('--basalt-edge', 'rgba(16, 42, 72, .08)') },
						border: hidden(),
						ticks: { maxTicksLimit: 5, callback: (value) => compact(value), ...tickStyle },
					},
				},
			},
		});
		const ways = perWay();
		donutChart = new Chart(ui.donutCanvas, {
			type: 'doughnut',
			data: {
				labels: ways.map((way) => WAYS[way.key].name),
				datasets: [
					{
						data: ways.map((way) => cents(way.total)),
						backgroundColor: WAY_KEYS.map((_, i) => rampColor(i + 1, '#2f6fd8')),
						borderColor: cssVar('--basalt-plane', '#ffffff'),
						borderWidth: 3,
						hoverOffset: 4,
					},
				],
			},
			options: {
				...fillsCard,
				cutout: '72%',
				plugins: {
					legend: hidden(),
					tooltip: tipStyle({ callbacks: { label: (ctx) => ` ${ctx.label}: ${dollars(ctx.parsed)}` } }),
				},
			},
		});
	}

	function paintCharts() {
		paintChartCopy();
		if (chartsLive) mountCharts(false);
	}

	/* The side sheet: one payment at a time, with the refund and evidence
     forms as faces behind the details. Stepping with the arrows follows
     the rows on screen, in their order. */

	function part(key) {
		return pick(`[data-rcp-d="${key}"]`, ui.sheet);
	}

	function wireSheet() {
		if (window.Basalt.drawer) {
			const length = { valueOf: () => Math.max(1, walkList.length) };
			walker = window.Basalt.drawer.recordNav(ui.sheet, length, (index) => {
				if (walkList[index]) showEntry(walkList[index]);
			});
		}
		on(ui.sheet, 'show.bs.offcanvas', () => parkToasts('bottom-center'));
		on(ui.sheet, 'shown.bs.offcanvas', () => part('name').focus());
		on(ui.sheet, 'hidden.bs.offcanvas', () => {
			parkToasts('bottom-end');
			const row = openId && pick(`.rcp-row[data-rcp-id="${openId}"]`, ui.rows);
			openId = null;
			for (const each of pickAll('.rcp-row', ui.rows)) each.classList.remove('is-selected');
			if (row) pick('[data-rcp-open]', row).focus();
		});
		on(part('foot'), 'click', (event) => {
			const button = event.target.closest('[data-rcp-act]');
			if (!button || !shownEntry) return;
			ACTIONS[button.getAttribute('data-rcp-act')]?.(shownEntry);
		});
		for (const view of ui.faces) {
			on(view, 'keydown', (event) => {
				if (event.key !== 'Escape' || face === 'detail') return;
				event.preventDefault();
				event.stopPropagation();
				turnTo('detail', true);
			});
		}
	}

	function openSheet(id) {
		walkList = visible.slice();
		const index = walkList.findIndex((entry) => entry.id === id);
		if (index < 0 || !sheetCtl) return;
		if (walker) walker.go(index, 0);
		else showEntry(walkList[index]);
		pick('.basalt-drawer-nav', ui.sheet).hidden = walkList.length < 2;
		sheetCtl.show();
	}

	function showEntry(entry) {
		shownEntry = entry;
		fillSheet(entry);
		turnTo('detail');
		openId = entry.id;
		highlightRow(entry.id);
	}

	/** After an action, the row, the tiles, the charts and the sheet follow. */
	function afterChange(entry) {
		paintAll();
		fillSheet(entry);
		turnTo('detail', true);
		highlightRow(entry.id);
	}

	function turnTo(name, moveFocus) {
		face = name;
		for (const view of ui.faces) view.hidden = view.getAttribute('data-rcp-view') !== name;
		if (shownEntry) fillActions(shownEntry);
		const landing = name === 'detail' ? part('name') : pick(`[data-rcp-view="${name}"] .rcp-view-title`, ui.sheet);
		if (moveFocus && landing) landing.focus();
	}

	function fillSheet(entry) {
		const payer = payerOf(entry).name;
		Object.assign(part('mark'), {
			className: `basalt-avatar rcp-mark rcp-mark-lg basalt-avatar-tone-${hueFor(payer)}`,
			textContent: monogram(payer),
		});
		const words = { name: payer, sub: `${paidForText(entry)} · ${shortDay(entry.at)}` };
		for (const [key, text] of Object.entries(words)) part(key).textContent = text;
		const html = { status: stateTag(entry), lead: summaryLine(entry) };
		for (const [key, markup] of Object.entries(html)) part(key).innerHTML = markup;
		part('full').href = pageFor(entry);
		const lines = moneyLines(entry);
		part('money-wrap').hidden = !lines;
		if (lines) {
			part('money').innerHTML = lines
				.map((line) => {
					const note = line.note ? `<span class="rcp-sub">${safe(line.note)}</span>` : '';
					return `<li class="rcp-line${line.total ? ' rcp-line-total' : ''}"><span class="rcp-line-text"><span class="rcp-line-name">${safe(line.name)}</span>${note}</span><span class="rcp-line-amt">${dollars(line.sum)}</span></li>`;
				})
				.join('');
		}
		part('facts').innerHTML = factRows(entry)
			.map((fact) => `<div class="rcp-fact"><dt>${fact.term}</dt><dd>${fact.html}</dd></div>`)
			.join('');
		part('steps').innerHTML = timeline(entry)
			.map((step) => {
				const tone = step.tone ? ` rcp-step-${step.tone}` : '';
				return `<li class="rcp-step${tone}"><span class="rcp-step-what">${safe(step.what)}</span><span class="rcp-step-when">${safe(step.when)}</span></li>`;
			})
			.join('');
	}

	function summaryLine(entry) {
		const sum = `<strong>${dollars(entry.amount)}</strong>`;
		const payer = safe(payerOf(entry).name);
		const via =
			entry.method === 'card'
				? `by ${safe(entry.from.replace(/^(\w+) ending/, '$1 card ending'))}`
				: `by ${WAYS[entry.method].name.toLowerCase()} from ${safe(entry.from.replace(/^Check no\. /, 'check no. '))}`;
		const byState = {
			failed: () =>
				entry.linkSent
					? `${payer} got a payment link for ${sum} on ${shortDay(THIS_DAY)}. ${safe(entry.why)}`
					: `The ${sum} charge for ${safe(paidForText(entry))} didn’t go through. ${safe(entry.why)}`,
			returned: () =>
				`${payer} paid ${sum} ${via} on ${shortDay(entry.at)}. ${safe(entry.why)} The invoice is open again.`,
			disputed: () => {
				const dispute = entry.dispute;
				if (entry.evidenceSent)
					return `Evidence sent on ${shortDay(THIS_DAY)}. The card network decides by ${shortDay(plusWorkdays(THIS_DAY, 17))}; if it agrees, the ${sum} comes back.`;
				return `${payer} told their bank the training never happened and took back ${sum}. ${safe(dispute.by)} ran it on ${shortDay(dispute.held)}. Send evidence by <strong>${longDay(dispute.due)}</strong>.`;
			},
		};
		if (byState[entry.state]) return byState[entry.state]();
		const verb = placeOf(entry) === 'clearing' ? 'reaches' : 'reached';
		return `${payer} paid ${sum} ${via}. It ${verb} ${BOOK.bankName} on ${longDay(landsOn(entry))}.`;
	}

	function moneyLines(entry) {
		if (entry.state === 'failed') return null;
		const way = WAYS[entry.method];
		const cost = costOf(entry);
		const lines = [
			{ name: 'Paid', note: '', sum: entry.amount },
			{ name: way.costName, note: way.costNote, sum: -cost },
		];
		let kept = entry.amount - cost;
		if (entry.state === 'returned') {
			lines.push(
				{ name: 'Returned by the bank', note: shortDay(entry.returnedOn), sum: -entry.amount },
				{ name: 'Return fee', note: '', sum: -BOUNCE_CHARGE },
			);
			kept -= entry.amount + BOUNCE_CHARGE;
		}
		if (entry.state === 'disputed') {
			lines.push(
				{ name: 'Held for the dispute', note: `Since ${shortDay(entry.dispute.opened)}`, sum: -entry.amount },
				{ name: 'Dispute fee', note: 'Kept even if you win', sum: -CHARGEBACK_CHARGE },
			);
			kept -= entry.amount + CHARGEBACK_CHARGE;
		}
		if (entry.refund) {
			lines.push({ name: 'Refunded', note: entry.refund.reason, sum: -entry.refund.amount });
			kept -= entry.refund.amount;
		}
		const closing = () => {
			if (entry.state !== 'ok') return 'Net, after fees';
			if (entry.refund) return 'Kept, after the refund';
			return placeOf(entry) === 'clearing' ? 'On its way to the bank' : 'Reached the bank';
		};
		lines.push({ name: closing(), note: '', sum: cents(kept), total: true });
		return lines;
	}

	function timeline(entry) {
		const steps = [];
		const dispute = entry.dispute;
		const add = (what, when, tone) => steps.push({ what, when, tone });
		const opening = {
			card: () =>
				add(
					entry.state === 'failed' ? 'Card declined' : 'Card charged',
					dayAndClock(entry.at),
					entry.state === 'failed' ? 'bad' : '',
				),
			check: () => add('Check deposited', dayAndClock(entry.at)),
			wire: () => add('Wire received', dayAndClock(entry.at)),
			ach: () => add('Bank transfer started', dayAndClock(entry.at)),
		};
		(opening[entry.method] || opening.ach)();
		if (entry.state === 'failed') {
			add('Customer told by email', dayAndClock(entry.at));
			if (entry.retry) add('Card charged again by John Armstrong', dayAndClock(entry.retry));
			if (entry.linkSent) add('Payment link sent by John Armstrong', shortDay(THIS_DAY));
		}
		if (entry.state === 'returned') {
			add('Returned by the bank', shortDay(entry.returnedOn), 'bad');
			if (entry.linkSent) add('Payment link sent by John Armstrong', shortDay(THIS_DAY));
		}
		if (entry.state === 'disputed') {
			add(`Run by ${dispute.by}, attended by ${dispute.attended}`, shortDay(dispute.held));
			add(`Dispute opened: ${dispute.reason.toLowerCase()}`, shortDay(dispute.opened), 'bad');
			if (entry.evidenceSent) {
				add('Evidence sent by John Armstrong', shortDay(THIS_DAY));
				add('Card network decides', `By ${shortDay(plusWorkdays(THIS_DAY, 17))}`, 'wait');
			} else {
				add('Evidence due', shortDay(dispute.due), 'wait');
			}
		}
		if (entry.state === 'ok' || entry.retry) {
			const landing = shortDay(landsOn(entry));
			if (placeOf(entry) === 'bank') add(`In ${BOOK.bankName}`, landing);
			else add(`In ${BOOK.bankName}`, `Expected ${landing}`, 'wait');
		}
		if (entry.refund)
			add(
				`Refund of ${dollars(entry.refund.amount)} by John Armstrong`,
				shortDay(entry.refund.on || THIS_DAY),
				'back',
			);
		return steps;
	}

	function factRows(entry) {
		const payer = payerOf(entry);
		const payerHtml = payer.account
			? `<a class="rcp-link" href="company-details.html?id=${encodeURIComponent(payer.account)}">${safe(payer.name)}</a>`
			: safe(payer.name);
		return [
			{
				term: 'Paid for',
				html: `<a class="rcp-link" href="${paidForLink(entry)}">${safe(paidForText(entry))}</a>`,
			},
			{
				term: 'Customer',
				html: `${payerHtml}<span class="rcp-sub">${safe(payer.contact)}</span><span class="rcp-sub">${safe(payer.email)}</span>`,
			},
			{ term: 'Paid by', html: `${safe(entry.from)}<span class="rcp-sub">${WAYS[entry.method].name}</span>` },
			{ term: 'Reference', html: `<span class="rcp-ref">${safe(entry.id)}</span>` },
		];
	}

	/* The sheet's footer offers what can be done next, which depends on
     the face showing and on the payment itself. */

	function actionsFor(entry) {
		const ghost = (label, act, glyph) => ({ kind: 'ghost', label, act, glyph });
		const primary = (label, act, glyph) => ({ kind: 'primary', label, act, glyph });
		if (face === 'refund')
			return [ghost('Back', 'back'), primary('Refund', 'refund-send', 'bi-arrow-counterclockwise')];
		if (face === 'evidence') return [ghost('Back', 'back'), primary('Send evidence', 'evidence-send', 'bi-send')];
		const inBank = entry.state === 'ok' && placeOf(entry) === 'bank';
		if (entry.state === 'failed' && !entry.linkSent && !entry.retry)
			return [
				ghost('Retry card', 'retry', 'bi-arrow-repeat'),
				primary('Send payment link', 'link', 'bi-link-45deg'),
			];
		if (entry.state === 'returned' && !entry.linkSent)
			return [
				ghost('Open invoice', 'invoice', 'bi-receipt'),
				primary('Send payment link', 'link', 'bi-link-45deg'),
			];
		if (entry.state === 'disputed' && !entry.evidenceSent)
			return [
				ghost('Open account', 'purchase', 'bi-building'),
				primary('Send evidence', 'evidence', 'bi-shield-check'),
			];
		if (inBank && !entry.refund)
			return [
				ghost('Refund', 'refund', 'bi-arrow-counterclockwise'),
				primary('Send receipt', 'receipt', 'bi-envelope'),
			];
		if (entry.state === 'ok') return [primary('Send receipt', 'receipt', 'bi-envelope')];
		const isPurchase = entry.for[0] === 'purchase';
		return [primary(isPurchase ? 'Open account' : 'Open invoice', entry.for[0], 'bi-box-arrow-up-right')];
	}

	function fillActions(entry) {
		part('foot').innerHTML = actionsFor(entry)
			.map((button) => {
				const look = button.kind === 'primary' ? 'btn btn-primary' : 'btn btn-outline-secondary';
				const glyph = button.glyph ? `<i aria-hidden="true" class="bi ${button.glyph} me-1"></i>` : '';
				return `<button type="button" data-rcp-act="${button.act}" class="${look}">${glyph}${button.label}</button>`;
			})
			.join('');
	}

	const ACTIONS = {
		back: () => turnTo('detail', true),
		refund: (entry) => startRefund(entry),
		'refund-send': () => submitRefund(),
		evidence: (entry) => startEvidence(entry),
		'evidence-send': () => submitEvidence(),
		purchase: (entry) => {
			window.location.href = paidForLink(entry);
		},
		invoice: (entry) => {
			window.location.href = paidForLink(entry);
		},
		receipt: (entry) => {
			const payer = payerOf(entry);
			notify({
				tone: 'success',
				icon: 'bi-envelope-check',
				title: 'Receipt sent',
				text: `${payer.contact} got the receipt for ${dollars(entry.amount)} at ${payer.email}.`,
			});
		},
		link: (entry) => {
			entry.linkSent = true;
			afterChange(entry);
			notify({
				tone: 'success',
				icon: 'bi-link-45deg',
				title: 'Payment link sent',
				text: `${payerOf(entry).contact} can pay ${dollars(entry.amount)} by card or bank transfer.`,
			});
		},
		retry: (entry) => {
			entry.retry = BOOK.clock;
			entry.state = 'ok';
			afterChange(entry);
			notify({
				tone: 'success',
				icon: 'bi-credit-card',
				title: 'Card charged',
				text: `${dollars(entry.amount)} went through this time. It reaches the bank on ${shortDay(landsOn(entry))}.`,
			});
		},
	};

	/* Refunding all or part of a payment that reached the bank. */

	function refundField(key) {
		return pick(`[data-rcp-rf="${key}"]`, ui.refundPane);
	}

	function wireRefund() {
		for (const choice of pickAll('input[name="rcpRefundKind"]', ui.refundPane)) {
			on(choice, 'change', () => {
				const partial = pick('input[name="rcpRefundKind"]:checked', ui.refundPane).value === 'part';
				const amountBox = refundField('amount');
				amountBox.readOnly = !partial;
				unflag(amountBox);
				if (!partial && shownEntry) amountBox.value = shownEntry.amount.toFixed(2);
				if (partial) {
					amountBox.focus();
					amountBox.select();
				}
			});
		}
		on(refundField('amount'), 'input', () => unflag(refundField('amount')));
		on(ui.refundPane, 'submit', (event) => {
			event.preventDefault();
			submitRefund();
		});
	}

	function startRefund(entry) {
		ui.refundPane.reset();
		const amountBox = refundField('amount');
		unflag(amountBox);
		refundField('max').textContent = dollars(entry.amount);
		Object.assign(amountBox, { value: entry.amount.toFixed(2), readOnly: true });
		const facts = { fee: dollars(costOf(entry)), to: entry.from };
		for (const [key, text] of Object.entries(facts)) refundField(key).textContent = text;
		turnTo('refund', true);
	}

	function submitRefund() {
		const entry = shownEntry;
		const amountBox = refundField('amount');
		const sum = cents(parseFloat(String(amountBox.value).replace(/[$,\s]/g, '')));
		if (!(sum > 0) || sum > entry.amount) {
			amountBox.classList.add('is-invalid');
			amountBox.focus();
			return;
		}
		entry.refund = { amount: sum, reason: refundField('reason').value };
		afterChange(entry);
		notify({
			tone: 'success',
			icon: 'bi-arrow-counterclockwise',
			title: `${dollars(sum)} refunded`,
			text: `Back on ${entry.from} in 5 to 10 days.`,
			actions: [
				{
					label: 'Open refunds',
					onClick: () => {
						window.location.href = 'refunds.html';
					},
				},
			],
		});
	}

	/* Answering a card dispute with a note and attachments. */

	function evidenceField(key) {
		return pick(`[data-rcp-ev="${key}"]`, ui.evidencePane);
	}

	function wireEvidence() {
		on(evidenceField('files'), 'click', (event) => {
			const remove = event.target.closest('[data-rcp-file-x]');
			if (!remove) return;
			attachments.splice(+remove.getAttribute('data-rcp-file-x'), 1);
			paintAttachments();
			evidenceField('add').focus();
		});
		on(evidenceField('add'), 'click', () => evidenceField('input').click());
		on(evidenceField('input'), 'change', () => {
			const chooser = evidenceField('input');
			for (const file of Array.from(chooser.files)) attachments.push(file.name);
			chooser.value = '';
			paintAttachments();
		});
		on(evidenceField('text'), 'input', () => unflag(evidenceField('text')));
		on(ui.evidencePane, 'submit', (event) => {
			event.preventDefault();
			submitEvidence();
		});
	}

	function paintAttachments() {
		evidenceField('files').innerHTML = attachments
			.map(
				(name, index) =>
					`<li class="rcp-file"><i aria-hidden="true" class="bi bi-file-earmark-text"></i><span class="rcp-file-name">${safe(name)}</span><button type="button" data-rcp-file-x="${index}" aria-label="Remove ${safe(name)}" class="rcp-file-x"><i aria-hidden="true" class="bi bi-x-lg"></i></button></li>`,
			)
			.join('');
		evidenceField('none').hidden = attachments.length > 0;
	}

	function startEvidence(entry) {
		const dispute = entry.dispute;
		const prefill = { reason: dispute.reason, due: longDay(dispute.due) };
		for (const [key, text] of Object.entries(prefill)) evidenceField(key).textContent = text;
		evidenceField('text').value =
			`Order ${entry.for[1]} was a live training session run by ${dispute.by} on ${longDay(dispute.held)} (session ${dispute.session}) and attended by ${dispute.attended} and their team. The customer has not raised any problem with it.`;
		unflag(evidenceField('text'));
		attachments = [`attendance-list-${dispute.session.slice(-7)}.pdf`, `order-${entry.for[1]}.pdf`];
		paintAttachments();
		turnTo('evidence', true);
	}

	function submitEvidence() {
		const note = evidenceField('text');
		if (note.value.trim().length < 20) {
			note.classList.add('is-invalid');
			note.focus();
			return;
		}
		shownEntry.evidenceSent = true;
		afterChange(shownEntry);
		notify({
			tone: 'success',
			icon: 'bi-shield-check',
			title: 'Evidence sent',
			text: `${countOf(attachments.length, 'file')} went to the card network with your note.`,
		});
	}

	/* Recording money that arrived outside the app, against an open invoice. */

	function recordField(key) {
		return pick(`[data-rcp-f="${key}"]`, ui.recordPane);
	}
	function chosenInvoice() {
		return BOOK.unpaid.find((inv) => inv.number === recordField('invoice').value);
	}
	function clearFlag() {
		for (const field of pickAll('.is-invalid', ui.recordPane)) unflag(field);
	}

	function wireRecord() {
		on(pick('[data-rcp-record-open]'), 'click', () => {
			blankRecord();
			recordCtl?.show();
		});
		on(ui.recordDialog, 'shown.bs.modal', () => {
			const invoiceBox = recordField('invoice');
			(pick('.basalt-select-trigger', invoiceBox.parentNode) || invoiceBox).focus();
		});
		on(recordField('invoice'), 'change', () => {
			showOwed();
			unflag(recordField('amount'));
		});
		on(ui.recordPane, 'input', (event) => {
			if (event.target.classList.contains('is-invalid')) unflag(event.target);
		});
		on(ui.recordPane, 'submit', (event) => {
			event.preventDefault();
			submitRecord();
		});
	}

	function listUnpaid() {
		const invoiceBox = recordField('invoice');
		invoiceBox.innerHTML = BOOK.unpaid
			.map((inv) => {
				const overdue = inv.due < THIS_DAY ? ' · overdue' : '';
				const hint = safe(`${BOOK.parties[inv.acct].name} · ${dollars(inv.owed)}${overdue}`);
				return `<option value="${inv.number}" data-hint="${hint}">${inv.number}</option>`;
			})
			.join('');
		if (window.Basalt.select?.refresh) window.Basalt.select.refresh(invoiceBox);
	}

	function showOwed() {
		const inv = chosenInvoice();
		if (!inv) return;
		recordField('amount').value = inv.owed.toFixed(2);
		const when = inv.due < THIS_DAY ? `, overdue since ${shortDay(inv.due)}.` : `, due ${shortDay(inv.due)}.`;
		recordField('owed').textContent = `${BOOK.parties[inv.acct].name} owes ${dollars(inv.owed)}${when}`;
	}

	function blankRecord() {
		ui.recordPane.reset();
		clearFlag();
		listUnpaid();
		showOwed();
		Object.assign(recordField('date'), { value: THIS_DAY, max: THIS_DAY });
	}

	function submitRecord() {
		const inv = chosenInvoice();
		const sum = cents(parseFloat(recordField('amount').value.replace(/[$,\s]/g, '')));
		const day = recordField('date').value;
		const wrong = [];
		if (!(sum > 0) || (inv && sum > inv.owed)) wrong.push(recordField('amount'));
		if (!day || day > THIS_DAY || day < BOOK.since) wrong.push(recordField('date'));
		clearFlag();
		if (wrong.length) {
			for (const field of wrong) field.classList.add('is-invalid');
			wrong[0].focus();
			return;
		}
		const way = pick('input[name="rcpRecMethod"]:checked', ui.recordPane).value;
		const reference = recordField('ref').value.trim();
		const source =
			way === 'check'
				? `Check no. ${reference || 'not given'}`
				: reference || `${WAYS[way].name}, recorded by John Armstrong`;
		const entry = {
			id: `#${nextRef++}`,
			at: `${day}${day === THIS_DAY ? ` ${BOOK.clock.slice(11)}` : ' 12:00'}`,
			acct: inv.acct,
			for: ['invoice', inv.number],
			method: way,
			from: source,
			amount: sum,
			state: 'ok',
		};
		entries.push(entry);
		if (sum >= inv.owed) BOOK.unpaid.splice(BOOK.unpaid.indexOf(inv), 1);
		else inv.owed = cents(inv.owed - sum);
		Object.assign(filter, { text: '', way: 'all', by: 'date', order: 'desc' });
		ui.search.value = '';
		ui.way.value = 'all';
		recordCtl?.hide();
		chooseTile('all');
		paintAll(entry.id);
		notify({
			tone: 'success',
			icon: 'bi-cash-coin',
			title: `${dollars(sum)} recorded`,
			text: `${payerOf(entry).name} paid ${inv.number} by ${WAYS[way].name.toLowerCase()}.`,
		});
	}

	/* A CSV of whatever the list is filtered to, one payment per line. */

	function wireExport() {
		on(pick('[data-rcp-export]'), 'click', () => {
			const header = ['Reference', 'Date', 'Customer', 'Paid for', 'Paid by', 'Status', 'Amount', 'Fee'];
			const lines = matched.map((entry) => [
				entry.id,
				entry.at,
				payerOf(entry).name,
				paidForText(entry),
				entry.from,
				PILLS[placeOf(entry)].word,
				entry.amount.toFixed(2),
				costOf(entry).toFixed(2),
			]);
			const quote = (cell) => `"${String(cell).replace(/"/g, '""')}"`;
			const csv = [header, ...lines].map((line) => line.map(quote).join(',')).join('\r\n');
			const link = document.createElement('a');
			link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
			link.download = `receipts-${THIS_DAY}.csv`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(link.href), 1000);
			notify({
				tone: 'success',
				icon: 'bi-download',
				title: 'Export ready',
				text: `${countOf(matched.length, 'payment')} saved as ${link.download}.`,
			});
		});
	}

	start();
})();
