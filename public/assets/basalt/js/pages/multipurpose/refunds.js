/**
 * Basalt - Refunds page (Sales)
 * Refund claims on Marlo shop clothing orders. A customer
 * reports a damaged, faulty, wrong or missing item; the claim waits
 * for an answer (sometimes after the item comes back to the Elko
 * warehouse for a check), then is refunded or declined. Draws the
 * claim to answer first, the rest of the queue, the Settled list, the
 * reasons chart, the claim drawer (a quick view; each claim's full
 * page is Refund Details) and the New claim dialog from the shared
 * claim data. In a real app the data comes from your API; "today"
 * is fixed so the demo dates always read the same.
 */
(() => {
	'use strict';
	const root = pick('[data-rfd-root]');
	/* The orders, customers and catalog are the Marlo shop's, from
     the Store book (window.Basalt.shopBook, assets/basalt/js/data/multipurpose/store.js) that
     Orders and Order Details read, so a claim's order has the same
     lines, delivery date and tax everywhere. */
	const book = window.Basalt.shopBook;
	const data = window.Basalt.data && window.Basalt.data.refunds;
	if (!root || !book || !data) return;

	function start() {
		newEl.addEventListener('show.bs.modal', () => {
			nForm.reset();
			nOrder.value = '';
			nReason.value = 'faulty';
			flagField(nOrder, false);
			nError.hidden = true;
			if (window.Basalt.select && window.Basalt.select.refresh) {
				window.Basalt.select.refresh(nOrder);
				window.Basalt.select.refresh(nReason);
			}
			drawPick();
		});
		newEl.addEventListener('change', (e) => {
			if (e.target === nOrder) {
				flagField(nOrder, false);
				nError.hidden = true;
				drawPick();
				return;
			}
			if (e.target.closest('[data-rfd-line]')) {
				if (pickedLines().some((l) => l[1] > 0)) nError.hidden = true;
				syncPick();
			}
		});

		nForm.addEventListener('submit', (e) => {
			e.preventDefault();
			if (!nOrder.value) {
				flagField(nOrder, true);
				const trigger =
					nOrder.nextElementSibling && nOrder.nextElementSibling.matches('.basalt-select-trigger, button')
						? nOrder.nextElementSibling
						: nOrder;
				trigger.focus();
				return;
			}
			const lines = pickedLines().filter((l) => l[1] > 0);
			if (!lines.length) {
				nError.hidden = false;
				pick('.basalt-stepper-input', nLines).focus();
				return;
			}
			const nums = claims.map((c) => Number(c.id.replace(/\D/g, '')));
			const id = `#${Math.max(...nums) + 1}`;
			const acct = ACCOUNTS[ORDERS[nOrder.value].acct];
			made.add(id);
			claims.unshift({
				id,
				order: nOrder.value,
				reason: nReason.value,
				status: 'new',
				opened: now(),
				lines,
				said: nSaid.value.trim() || `Reported by phone to ${ME}.`,
				files: [],
			});
			bootstrap.Modal.getOrCreateInstance(newEl).hide();
			refresh();
			toast({
				tone: 'success',
				icon: 'bi-plus-circle',
				title: `${id} opened for ${acct.name}`,
				text: `Answer by ${day(addWorkDays(now(), ANSWER_DAYS))}.`,
				actions: [{ label: 'Review', onClick: () => openClaim(id, queue()) }],
			});
			announce(`${id} opened`);
		});

		refresh();
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	/* Demo data */
	/* The claims, reasons and answer times are shared with Refund Details
     (window.Basalt.data.refunds, assets/basalt/js/data/multipurpose/refunds.js). */
	const { ME, ANSWER_DAYS, CHECK_DAYS, REASONS, TONE, CLAIMS } = data;
	const TODAY = window.Basalt.toLocalDay(book.NOW.slice(0, 10)); /* Friday, October 9, 2026, local midnight */

	/* The products a claim can be for, each with its tile color. */
	const PRODUCTS = {};
	book.PRODUCTS.forEach((p) => {
		if (TONE[p.sku]) PRODUCTS[p.sku] = { name: p.name, price: p.price, icon: p.icon, tone: TONE[p.sku] };
	});

	/* The customer behind each order, whose page is on Shoppers. */
	const ACCOUNTS = {};
	book.CUSTOMERS.forEach((c) => {
		ACCOUNTS[c.id] = { name: c.name, city: c.city, contact: c.buyer, tone: c.avatarTone };
	});

	/* Orders delivered in the last six weeks, newest first: what a claim
     can be made against. `card` is the card it was paid with, if any. */
	const ORDERS = {};
	book.ORDERS.forEach((o) => {
		const told = book.story(o);
		if (!told.goods || !told.fulfil.deliveredAt || told.fulfil.deliveredAt < '2026-08-28') return;
		const p = told.payment;
		ORDERS[o.orderNumber] = {
			acct: book.customer(o.customer).id,
			src: o,
			delivered: told.fulfil.deliveredAt.slice(0, 10),
			lines: o.lines.filter((l) => PRODUCTS[l.sku]).map((l) => [l.sku, l.qty]),
			card: p.kind === 'card' ? `${p.brand === 'American Express' ? 'Amex' : p.brand} ending ${p.last4}` : '',
		};
	});

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

	function parse(s) {
		const [d, t] = s.split(' ');
		const [y, m, dd] = d.split('-').map(Number);
		const [h, mi] = (t || '00:00').split(':').map(Number);
		return new Date(y, m - 1, dd, h, mi);
	}

	function iso(d) {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function day(s) {
		const d = parse(s);
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function money(n) {
		return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function plural(n, word) {
		return `${n} ${word}${n === 1 ? '' : 's'}`;
	}

	const todayIso = iso(TODAY);

	function first(name) {
		return name.split(' ')[0];
	}

	function initials(name) {
		return name
			.split(' ')
			.map((w) => w[0])
			.slice(0, 2)
			.join('');
	}

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
	function now() {
		const c = new Date();
		return `${todayIso} ${String(c.getHours()).padStart(2, '0')}:${String(c.getMinutes()).padStart(2, '0')}`;
	}

	/* Money on each claim */
	/* The customer as they stand on one order: the card that order was
     paid with, and the tax where it was delivered. */
	function acctFor(id) {
		const o = ORDERS[id];
		return Object.assign({}, ACCOUNTS[o.acct], { card: o.card, order: o.src, tax: book.TAX[o.src.tax].rate });
	}

	function acctOf(c) {
		return acctFor(c.order);
	}

	/* A refund of these items at what was paid for them, discount and tax included. */
	function sums(acct, lines) {
		const r = book.refund(
			acct.order,
			lines.map(([sku, qty]) => ({ sku, qty })),
			false,
		);
		return {
			items: r.items / 100,
			tax: r.tax / 100,
			total: r.cents / 100,
			units: lines.reduce((a, l) => a + l[1], 0),
		};
	}

	function accountLink(a, cls) {
		return `<a${cls ? ` class="${cls}"` : ''} href="shoppers.html">${htmlSafe(a.name)}</a>`;
	}

	function orderUrl(id) {
		return `order-details.html?id=${encodeURIComponent(id)}`;
	}

	function claimUrl(id) {
		return `refund-details.html?id=${encodeURIComponent(id)}`;
	}

	function total(c) {
		return sums(acctOf(c), c.lines).total;
	}

	function opened(c) {
		return c.status === 'new' || c.status === 'inspecting';
	}

	function answerBy(c) {
		return c.status === 'inspecting' ? addWorkDays(c.ret.back, CHECK_DAYS) : addWorkDays(c.opened, ANSWER_DAYS);
	}

	function lateBy(c) {
		return answerBy(c) < todayIso ? workDaysBetween(`${answerBy(c)} 00:00`, `${todayIso} 00:00`) : 0;
	}

	function paidText(c, brief) {
		const a = acctOf(c);
		if (c.paid === 'card') return `To ${brief ? a.card.replace(' ending ', ' ··') : a.card}`;
		if (c.paid === 'bank') return 'By bank transfer';
		return `Store credit ${c.credit}`;
	}

	const claims = CLAIMS.slice();
	const made = new Set(); /* claims opened in this demo session */
	const state = { q: '', reason: 'all', more: false };

	function find(id) {
		return claims.find((c) => c.id === id);
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function announce(t) {
		if (window.Basalt.announce) window.Basalt.announce(t);
	}

	function queue() {
		return claims
			.filter(opened)
			.sort((a, b) => answerBy(a).localeCompare(answerBy(b)) || a.opened.localeCompare(b.opened));
	}

	function settled() {
		return claims
			.filter((c) => !opened(c))
			.sort((a, b) => b.settled.localeCompare(a.settled) || b.id.localeCompare(a.id));
	}

	function stagePill(c) {
		if (c.status === 'new') return '<span class="basalt-status basalt-status-dot basalt-status-info">New</span>';
		if (c.status === 'inspecting')
			return '<span class="basalt-status basalt-status-primary"><i class="bi bi-search" aria-hidden="true"></i>Inspecting</span>';
		if (c.status === 'refunded')
			return '<span class="basalt-status basalt-status-dot basalt-status-success">Refunded</span>';
		return '<span class="basalt-status basalt-status-dot">Declined</span>';
	}
	/* One short line under the stage: when the answer is due. */
	function stageNote(c) {
		const late = lateBy(c);
		if (late) return `<span class="rfd-sub rfd-sub-danger">${plural(late, 'day')} overdue</span>`;
		if (answerBy(c) === todayIso) return '<span class="rfd-sub rfd-sub-warning">Answer today</span>';
		if (c.status === 'inspecting') return `<span class="rfd-sub">Back with us ${day(c.ret.back)}</span>`;
		return `<span class="rfd-sub">Answer by ${day(answerBy(c))}</span>`;
	}

	function reasonLine(c) {
		return `<span class="rfd-sub rfd-reason"><span class="rfd-dot rfd-tone-${REASONS[c.reason].tone}" aria-hidden="true"></span>${REASONS[c.reason].label}</span>`;
	}

	function linesText(lines) {
		return lines.map(([sku, q]) => `${q} × ${PRODUCTS[sku].name}`).join(', ');
	}

	function who(c, sub) {
		const a = acctOf(c);
		return `<span class="rfd-who"><span class="basalt-avatar basalt-avatar-sm basalt-avatar-tone-${a.tone}" aria-hidden="true">${initials(a.name)}</span><span>${accountLink(a, 'rfd-strong rfd-acct')}${sub}</span></span>`;
	}

	/* To decide */
	const el = {
		next: pick('[data-rfd-next]', root),
		queueCard: pick('[data-rfd-queue-card]', root),
		queueSub: pick('[data-rfd-queue-sub]', root),
		queue: pick('[data-rfd-queue]', root),
		queueWrap: pick('[data-rfd-queue-wrap]', root),
		queueEmpty: pick('[data-rfd-queue-empty]', root),
		summary: pick('[data-rfd-summary]', root),
		search: pick('[data-rfd-search]', root),
		reason: pick('[data-rfd-reason]', root),
		settled: pick('[data-rfd-settled]', root),
		settledSub: pick('[data-rfd-settled-sub]', root),
		more: pick('[data-rfd-more]', root),
		moreWrap: pick('[data-rfd-more-wrap]', root),
		reasons: pick('[data-rfd-reasons]', root),
		reasonsSub: pick('[data-rfd-reasons-sub]', root),
		reasonsNote: pick('[data-rfd-reasons-note]', root),
	};

	function matches(c) {
		if (state.reason !== 'all' && c.reason !== state.reason) return false;
		if (!state.q) return true;
		const a = acctOf(c);
		const hay = [c.id, c.order, a.name, a.contact, REASONS[c.reason].label]
			.concat(c.lines.map((l) => PRODUCTS[l[0]].name))
			.join(' ');
		return window.Basalt && window.Basalt.matchesQuery
			? window.Basalt.matchesQuery(hay, state.q)
			: hay.toLowerCase().includes(state.q.toLowerCase());
	}

	function fileIcon(n) {
		return /\.(jpg|png)$/.test(n)
			? 'bi-file-earmark-image'
			: /\.mp4$/.test(n)
				? 'bi-file-earmark-play'
				: /\.pdf$/.test(n)
					? 'bi-file-earmark-pdf'
					: 'bi-file-earmark-text';
	}

	function productTile(sku) {
		return `<span class="rfd-tile rfd-tone-${PRODUCTS[sku].tone}" aria-hidden="true"><i class="bi ${PRODUCTS[sku].icon}"></i></span>`;
	}

	/* Answer first: the claim due soonest, told the way the
	   customer told it, with what they sent and one action. */
	function dueText(c) {
		const late = lateBy(c);
		if (late) return { tone: 'danger', icon: 'bi-clock-history', text: `${plural(late, 'day')} overdue` };
		if (answerBy(c) === todayIso) return { tone: 'warning', icon: 'bi-clock', text: 'Answer today' };
		return { tone: 'info', icon: 'bi-calendar-check', text: `Answer by ${day(answerBy(c))}` };
	}
	function drawNext() {
		const c = queue()[0];
		if (!c) {
			el.next.innerHTML = `<div class="basalt-empty basalt-empty-success rfd-empty rfd-empty-top" role="status"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-check2-circle"></i></span><h2 class="basalt-empty-title" id="rfd-next-title">Nothing to decide</h2><p class="basalt-empty-text">Every claim has an answer. New ones show up here.</p></div>`;
			return;
		}
		const a = acctOf(c);
		const o = ORDERS[c.order];
		const due = dueText(c);
		const waited = workDaysBetween(c.opened, `${todayIso} 00:00`);
		const shots = c.files.length
			? `<ul class="rfd-shots" aria-label="What ${htmlSafe(first(a.contact))} sent">${c.files
					.map(
						([n, size], i) =>
							`<li class="rfd-shot rfd-tone-${[REASONS[c.reason].tone, 4, 8][i % 3]}"><span class="rfd-shot-pic" aria-hidden="true"><i class="bi ${fileIcon(n)}"></i></span><span class="rfd-shot-name">${htmlSafe(n)}</span><span class="rfd-sub">${size}</span></li>`,
					)
					.join('')}</ul>`
			: '';
		el.next.setAttribute('data-rfd-id', c.id);
		el.next.innerHTML = `<div class="rfd-cardhead"><div><h2 class="rfd-cardhead-title" id="rfd-next-title">Answer first</h2><p class="rfd-cardhead-sub">${waited ? `${htmlSafe(first(a.contact))} has waited ${plural(waited, 'working day')} for ` : 'Due soonest: '}<a class="rfd-order" href="${claimUrl(c.id)}">${c.id}</a>.</p></div></div><div class="rfd-next-body"><div class="rfd-next-story"><span class="rfd-who"><span class="basalt-avatar basalt-avatar-lg basalt-avatar-tone-${a.tone}" aria-hidden="true">${initials(a.name)}</span><span>${accountLink(a, 'rfd-next-acct')}<span class="rfd-sub">${htmlSafe(a.city)} · <a class="rfd-order" href="${orderUrl(c.order)}">Order ${c.order}</a>, delivered ${day(o.delivered)}</span></span></span><blockquote class="rfd-next-quote rfd-tone-${REASONS[c.reason].tone}"><p>${htmlSafe(c.said)}</p></blockquote>${shots}</div><div class="rfd-next-ask"><div class="rfd-r-pills"><span class="basalt-status basalt-status-${due.tone}"><i class="bi ${due.icon}" aria-hidden="true"></i>${due.text}</span><span class="basalt-status rfd-tone-${REASONS[c.reason].tone}">${REASONS[c.reason].label}</span></div><ul class="rfd-next-items" aria-label="Claimed for">${c.lines
			.map(
				([sku, q]) =>
					`<li>${productTile(sku)}<span><span class="rfd-strong">${q} × ${htmlSafe(PRODUCTS[sku].name)}</span><span class="rfd-sub">$${PRODUCTS[sku].price} each</span></span></li>`,
			)
			.join(
				'',
			)}</ul><p class="rfd-next-sum"><span class="rfd-next-amount">${money(total(c))}</span><span class="rfd-sub">claimed, with tax</span></p><a class="btn btn-primary w-100" href="${claimUrl(c.id)}">Review claim</a></div></div>`;
	}

	/* The quick view and the claim's full page, side by side at a row's end. */
	function rowActions(c) {
		return `<td class="rfd-col-act"><span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-rfd-open aria-label="Quick view: ${c.id}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${claimUrl(c.id)}" aria-label="Open full page: ${c.id}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span></td>`;
	}

	function queueRow(c) {
		return `<tr data-rfd-id="${c.id}"><td class="rfd-col-claim"><a class="rfd-link" href="${claimUrl(c.id)}">${c.id}</a><span class="rfd-sub">Opened ${day(c.opened)}</span></td><td class="rfd-col-account">${who(c, `<a class="rfd-sub rfd-order" href="${orderUrl(c.order)}">Order ${c.order}</a>`)}</td><td class="rfd-col-items"><span class="rfd-items-cell">${productTile(c.lines[0][0])}<span><span class="rfd-line">${htmlSafe(linesText(c.lines))}</span>${reasonLine(c)}</span></span></td><td class="rfd-col-stage">${stagePill(c)}${stageNote(c)}</td><td class="rfd-col-amount"><span class="rfd-money">${money(total(c))}</span></td>${rowActions(c)}</tr>`;
	}

	let shownQueue = [];
	function drawQueue() {
		const all = queue().slice(1);
		el.queueCard.hidden = !all.length;
		shownQueue = all.filter(matches);
		const narrowed = shownQueue.length !== all.length;
		el.queueSub.textContent = `${plural(all.length, 'more claim')}, ${money(all.reduce((a, c) => a + total(c), 0))} claimed. Each gets an answer within ${ANSWER_DAYS} working days.`;
		el.summary.textContent = narrowed
			? `${shownQueue.length} of ${plural(all.length, 'claim')}, ${money(shownQueue.reduce((a, c) => a + total(c), 0))} claimed`
			: '';
		el.summary.hidden = !narrowed;
		el.queueWrap.hidden = !shownQueue.length;
		el.queueEmpty.hidden = !!shownQueue.length;
		el.queue.innerHTML = shownQueue.map(queueRow).join('');
		if (window.Basalt.tips) window.Basalt.tips(el.queue);
		if (shownQueue.length) {
			el.queueEmpty.innerHTML = '';
			return;
		}
		el.queueEmpty.innerHTML = `<div class="basalt-empty rfd-empty" role="status"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-search"></i></span><p class="basalt-empty-title">${state.q ? `No claims match “${htmlSafe(state.q)}”` : 'No claims for this reason'}</p><p class="basalt-empty-text">Try a claim or order number, a customer or a product.</p><button type="button" class="btn btn-sm btn-outline-secondary" data-rfd-clear>Clear filters</button></div>`;
	}

	/* Settled */
	const SHOW = 5;
	let shownSettled = [];
	function settledRow(c) {
		const out = c.status === 'refunded' ? paidText(c, true) : `By ${c.by}`;
		return `<tr data-rfd-id="${c.id}"><td class="rfd-col-claim"><a class="rfd-link" href="${claimUrl(c.id)}">${c.id}</a><span class="rfd-sub">${day(c.settled)}</span></td><td class="rfd-col-account">${who(c, reasonLine(c))}</td><td class="rfd-col-outcome">${stagePill(c)}<span class="rfd-sub">${htmlSafe(out)}</span></td><td class="rfd-col-amount"><span class="rfd-money${c.status === 'declined' ? ' rfd-money-muted' : ''}">${money(total(c))}</span></td>${rowActions(c)}</tr>`;
	}
	function drawSettled() {
		const all = settled();
		shownSettled = state.more ? all : all.slice(0, SHOW);
		const refunded = all.filter((c) => c.status === 'refunded');
		const declined = all.length - refunded.length;
		el.settledSub.textContent = `Last 30 days: ${refunded.length} refunded, ${declined} declined.`;
		el.settled.innerHTML = shownSettled.map(settledRow).join('');
		if (window.Basalt.tips) window.Basalt.tips(el.settled);
		const rest = all.length - SHOW;
		el.moreWrap.hidden = rest <= 0;
		el.more.setAttribute('aria-expanded', String(state.more));
		el.more.innerHTML = state.more
			? '<i class="bi bi-chevron-up me-1" aria-hidden="true"></i>Show fewer'
			: `<i class="bi bi-chevron-down me-1" aria-hidden="true"></i>Show ${rest} more`;
	}
	el.more.addEventListener('click', () => {
		window.Basalt.slide(el.settled.closest('.rfd-table-wrap'), () => {
			state.more = !state.more;
			drawSettled();
		});
	});

	/* Why claims come in: ranked bars, most claims first */
	function drawReasons() {
		const firstDay = claims.reduce((a, c) => (c.opened < a ? c.opened : a), `${todayIso} 23:59`);
		const rows = Object.keys(REASONS)
			.map((k) => {
				const list = claims.filter((c) => c.reason === k);
				return { k, n: list.length, amount: list.reduce((a, c) => a + total(c), 0) };
			})
			.filter((r) => r.n)
			.sort((a, b) => b.n - a.n || b.amount - a.amount);
		const max = Math.max(...rows.map((r) => r.n));
		const d = parse(firstDay);
		el.reasonsSub.textContent = `${plural(claims.length, 'claim')} opened since ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}, most common first.`;
		el.reasons.innerHTML = rows
			.map((r) => {
				const R = REASONS[r.k];
				return `<li class="rfd-reasons-row"><span class="rfd-reasons-name">${R.label}</span><span class="rfd-reasons-count">${plural(r.n, 'claim')}</span><span class="rfd-reasons-track" aria-hidden="true"><span class="rfd-reasons-bar rfd-tone-${R.tone}" style="width:${Math.max(4, Math.round((r.n / max) * 100))}%"></span></span><span class="rfd-reasons-amount">${money(r.amount)} claimed</span></li>`;
			})
			.join('');
		const refunded = claims.filter((c) => c.status === 'refunded').reduce((a, c) => a + total(c), 0);
		const declined = claims.filter((c) => c.status === 'declined').length;
		el.reasonsNote.innerHTML = `<strong>${money(refunded)}</strong> paid back so far, and ${plural(declined, 'claim')} declined.`;
	}

	function refresh() {
		drawNext();
		drawQueue();
		drawSettled();
		drawReasons();
	}

	let typing;
	el.search.addEventListener('input', () => {
		clearTimeout(typing);
		typing = setTimeout(() => {
			state.q = el.search.value.trim();
			drawQueue();
		}, 160);
	});
	el.reason.addEventListener('change', () => {
		state.reason = el.reason.value;
		drawQueue();
	});
	el.queueEmpty.addEventListener('click', (e) => {
		if (!e.target.closest('[data-rfd-clear]')) return;
		state.q = '';
		state.reason = 'all';
		el.search.value = '';
		el.reason.value = 'all';
		drawQueue();
		el.search.focus();
	});

	/* The panel icon opens the claim's quick view. */
	root.addEventListener('click', (e) => {
		const b = e.target.closest('[data-rfd-open]');
		if (b)
			openClaim(
				b.closest('[data-rfd-id]').getAttribute('data-rfd-id'),
				b.closest('[data-rfd-settled]') ? shownSettled : shownQueue,
			);
	});

	/* A click anywhere else on a row opens the claim's full page, and the
     middle button or Cmd/Ctrl opens it in a new tab, as a link would. A
     claim opened here in the demo has no full page, so it opens the quick view. */
	function rowToPage(e) {
		const row = e.button < 2 && e.target.closest('tr[data-rfd-id]');
		if (!row || e.target.closest('a, button')) return;
		const id = row.getAttribute('data-rfd-id');
		if (made.has(id)) {
			if (e.button === 0) openClaim(id, row.closest('[data-rfd-settled]') ? shownSettled : shownQueue);
			return;
		}
		if (e.button === 1 || e.metaKey || e.ctrlKey) window.open(claimUrl(id), '_blank');
		else location.href = claimUrl(id);
	}
	root.addEventListener('click', rowToPage);
	root.addEventListener('auxclick', (e) => {
		if (e.button === 1) rowToPage(e);
	});

	/* CSV export */
	pick('[data-rfd-export]', root).addEventListener('click', () => {
		const list = settled();

		function cell(v) {
			return `"${String(v).replace(/"/g, '""')}"`;
		}

		const rows = [
			['Claim', 'Opened', 'Settled', 'Customer', 'Order', 'Reason', 'Items', 'Outcome', 'Paid back', 'Amount'],
		].concat(
			list.map((c) => [
				c.id,
				c.opened.slice(0, 10),
				c.settled,
				acctOf(c).name,
				c.order,
				REASONS[c.reason].label,
				linesText(c.lines),
				c.status === 'refunded' ? 'Refunded' : 'Declined',
				c.status === 'refunded' ? paidText(c) : '',
				total(c).toFixed(2),
			]),
		);
		const blob = new Blob([rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `refunds-settled-${todayIso}.csv`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
		toast({
			tone: 'success',
			icon: 'bi-download',
			title: `Exported ${plural(list.length, 'claim')}`,
			text: a.download,
		});
	});

	/* The claim drawer */
	const drawer = pick('#rfd-claim');
	const body = pick('[data-rfd-r="body"]', drawer);
	let recordIds = [];
	let at = 0;

	/* One product with a quantity stepper; `note` says how many there are. */
	function lineRow(sku, qty, max, note, i) {
		const p = PRODUCTS[sku];
		return `<li class="rfd-item" data-rfd-line="${i}" data-sku="${sku}">${productTile(sku)}<span class="rfd-item-text"><span class="rfd-strong">${htmlSafe(p.name)}</span><span class="rfd-sub">$${p.price} each · ${note}</span></span><div class="basalt-stepper basalt-stepper-sm" data-basalt-stepper><button type="button" class="basalt-stepper-btn" data-basalt-step="-1" aria-label="One fewer ${htmlSafe(p.name)}"><i class="bi bi-dash-lg" aria-hidden="true"></i></button><input type="number" class="basalt-stepper-input" value="${qty}" min="0" max="${max}" inputmode="numeric" aria-label="${htmlSafe(p.name)} to refund"><button type="button" class="basalt-stepper-btn" data-basalt-step="1" aria-label="One more ${htmlSafe(p.name)}"><i class="bi bi-plus-lg" aria-hidden="true"></i></button></div></li>`;
	}

	function sumsHtml(acct, lines) {
		const m = sums(acct, lines);
		return `<div><dt>Items</dt><dd>${money(m.items)}</dd></div><div><dt>Tax</dt><dd>${acct.tax ? money(m.tax) : 'None'}</dd></div><div class="rfd-sums-total"><dt>Claimed</dt><dd>${money(m.total)}</dd></div>`;
	}

	function filesHtml(c) {
		if (!c.files.length) return '<p class="rfd-sub rfd-files-none">No photos or files sent.</p>';
		return `<ul class="rfd-files" aria-label="Files sent with the claim">${c.files
			.map(
				([n, size]) =>
					`<li><i class="bi ${fileIcon(n)}" aria-hidden="true"></i><span class="rfd-files-name">${htmlSafe(n)}</span><span class="rfd-files-size">${size}</span></li>`,
			)
			.join('')}</ul>`;
	}

	function stateHtml(c) {
		const late = opened(c) ? lateBy(c) : 0;
		let alert = '';
		if (late)
			alert = `<p class="rfd-alert rfd-alert-danger"><i class="bi bi-clock-history" aria-hidden="true"></i><span>The answer was due ${day(answerBy(c))}. ${htmlSafe(first(acctOf(c).contact))} has been waiting ${plural(workDaysBetween(c.opened, `${todayIso} 00:00`), 'working day')}.</span></p>`;
		else if (opened(c) && answerBy(c) === todayIso)
			alert =
				'<p class="rfd-alert rfd-alert-warning"><i class="bi bi-clock" aria-hidden="true"></i><span>Answer due today.</span></p>';
		return `<div class="rfd-r-pills">${stagePill(c)}<span class="basalt-status rfd-tone-${REASONS[c.reason].tone}">${REASONS[c.reason].label}</span></div>${alert}`;
	}

	/* A quick view: what was claimed and where it stands. Refunding,
     declining and reopening happen on the claim's full page. */
	function drawRecord(c) {
		const a = acctOf(c);
		const o = ORDERS[c.order];
		const av = pick('[data-rfd-r="avatar"]', drawer);
		av.className = `basalt-avatar basalt-avatar-sm basalt-avatar-tone-${a.tone}`;
		av.textContent = initials(a.name);
		pick('[data-rfd-r="title"]', drawer).textContent = c.id;
		/* The claim's own page, where it is read in full and answered. */
		pick('[data-rfd-r="full"]', drawer).href = claimUrl(c.id);
		pick('[data-rfd-r="sub"]', drawer).innerHTML =
			`${accountLink(a, '')} · <a href="${orderUrl(c.order)}">${c.order}</a>`;

		let html = `<div class="rfd-r-state">${stateHtml(c)}</div><section class="basalt-drawer-section" aria-labelledby="rfd-r-said"><h3 class="basalt-drawer-legend" id="rfd-r-said">What ${htmlSafe(first(a.contact))} told us</h3><blockquote class="rfd-quote"><p>${htmlSafe(c.said)}</p><footer class="rfd-sub">${htmlSafe(a.contact)}, ${day(c.opened)} · order delivered ${day(o.delivered)}</footer></blockquote>${filesHtml(c)}</section>`;
		if (c.check) {
			html += `<section class="basalt-drawer-section" aria-labelledby="rfd-r-check"><h3 class="basalt-drawer-legend" id="rfd-r-check">Our check</h3><p class="rfd-check"><i class="bi bi-clipboard-check" aria-hidden="true"></i><span>${htmlSafe(c.check)}<span class="rfd-sub">Elko warehouse, returned ${day(c.ret.back)}</span></span></p></section>`;
		}

		if (opened(c)) {
			html += `<section class="basalt-drawer-section" aria-labelledby="rfd-r-claimed"><h3 class="basalt-drawer-legend" id="rfd-r-claimed">Claimed</h3><ul class="rfd-items">${c.lines
				.map(
					([sku, q]) =>
						`<li class="rfd-item">${productTile(sku)}<span class="rfd-item-text"><span class="rfd-strong">${htmlSafe(PRODUCTS[sku].name)}</span><span class="rfd-sub">$${PRODUCTS[sku].price} each · ${q} claimed</span></span></li>`,
				)
				.join(
					'',
				)}</ul><dl class="rfd-sums">${sumsHtml(a, c.lines)}</dl><p class="rfd-sub rfd-r-answer">Refund all or part of it, or decline with a reason, on the claim's full page.</p></section>`;
		} else {
			const facts =
				c.status === 'refunded'
					? `<div><dt>Refunded</dt><dd>${money(total(c))} on ${day(c.settled)}</dd></div><div><dt>Paid back</dt><dd>${htmlSafe(paidText(c))}</dd></div>`
					: `<div><dt>Declined</dt><dd>${day(c.settled)}</dd></div>`;
			html += `<section class="basalt-drawer-section" aria-labelledby="rfd-r-outcome"><h3 class="basalt-drawer-legend" id="rfd-r-outcome">Outcome</h3><dl class="rfd-facts"><div><dt>Items</dt><dd>${htmlSafe(linesText(c.lines))}</dd></div>${facts}<div><dt>Decided by</dt><dd>${htmlSafe(c.by)}</dd></div><div><dt>Note sent</dt><dd>${htmlSafe(c.note)}</dd></div></dl></section>`;
		}
		body.innerHTML = html;
		body.scrollTop = 0;
	}

	function navTo(i, dir) {
		at = (i + recordIds.length) % recordIds.length;
		const c = find(recordIds[at]);
		if (c) drawRecord(c);
		pick('[data-basalt-record-pos]', drawer).textContent = `${at + 1} of ${recordIds.length}`;
		drawer.classList.toggle('is-back', dir < 0);
	}
	function openClaim(id, list) {
		recordIds = list.map((c) => c.id);
		if (!recordIds.includes(id)) recordIds = [id];
		navTo(recordIds.indexOf(id));
		bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
	}
	pick('[data-basalt-record-prev]', drawer).addEventListener('click', () => navTo(at - 1, -1));
	pick('[data-basalt-record-next]', drawer).addEventListener('click', () => navTo(at + 1, 1));
	drawer.addEventListener('keydown', (e) => {
		if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
		e.preventDefault();
		navTo(at + (e.key === 'ArrowUp' ? -1 : 1), e.key === 'ArrowUp' ? -1 : 1);
	});

	/* New claim dialog */
	const newEl = pick('#rfd-new');
	const nForm = pick('[data-rfd-new-form]', newEl);
	const nOrder = pick('[data-rfd-n="order"]', newEl);
	const nReason = pick('[data-rfd-n="reason"]', newEl);
	const nLines = pick('[data-rfd-n="lines"]', newEl);
	const nError = pick('[data-rfd-n="lines-error"]', newEl);
	const nSum = pick('[data-rfd-n="sum"]', newEl);
	const nSaid = pick('[data-rfd-n="said"]', newEl);

	nOrder.insertAdjacentHTML(
		'beforeend',
		Object.keys(ORDERS)
			.map(
				(id) =>
					`<option value="${id}" data-hint="Delivered ${day(ORDERS[id].delivered)}">${id} · ${htmlSafe(ACCOUNTS[ORDERS[id].acct].name)}</option>`,
			)
			.join(''),
	);
	if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(nOrder);

	function pickedLines() {
		return pickAll('[data-rfd-line]', nLines).map((li) => [
			li.getAttribute('data-sku'),
			Math.max(0, parseInt(pick('input', li).value, 10) || 0),
		]);
	}

	function drawPick() {
		const o = ORDERS[nOrder.value];
		if (!o) {
			nLines.innerHTML = '<li class="rfd-sub rfd-pick-empty">Choose an order to see what was on it.</li>';
			nSum.textContent = '';
			return;
		}
		nLines.innerHTML = o.lines.map(([sku, q], i) => lineRow(sku, 0, q, `${q} ordered`, i)).join('');

		for (const s of pickAll('[data-basalt-stepper]', nLines)) {
			if (window.Basalt.stepper) window.Basalt.stepper(s);
		}

		syncPick();
	}
	function syncPick() {
		const o = ORDERS[nOrder.value];
		if (!o) return;
		const m = sums(
			acctFor(nOrder.value),
			pickedLines().filter((l) => l[1] > 0),
		);
		nSum.innerHTML = m.units
			? `${plural(m.units, 'item')} claimed, <strong>${money(m.total)}</strong> with tax`
			: 'Set how many of each item the claim is for.';
	}
	function flagField(field, on) {
		field.classList.toggle('is-invalid', on);
		if (on) field.setAttribute('aria-invalid', 'true');
		else field.removeAttribute('aria-invalid');
	}

	start();
})();
