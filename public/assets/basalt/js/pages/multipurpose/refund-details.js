/**
 * Basalt - Refund Details (refund-details.html)
 * One refund claim on a Marlo shop order, in full: what the
 * customer told us and sent, the answer (refund each item in full or
 * in part, how the money goes back, or decline with a reason), the
 * order it is about, getting the item back, everything that happened
 * and who is asking.
 *
 * The claims are the ones on the Refunds page, from the shared claim
 * data (window.Basalt.data.refunds, assets/basalt/js/data/multipurpose/refunds.js). Their
 * orders, customers, prices and tax are the Store book's
 * (window.Basalt.shopBook, assets/basalt/js/data/multipurpose/store.js), so the amount here
 * is the amount on Refunds and the order is the one on Order Details.
 *
 * ?id=%23147 in the address picks the claim. Without one (or with
 * an id that isn't there), the claim to answer first opens: the open
 * claim whose answer is due soonest, as on Refunds.
 *
 * Answers, return labels and reopened claims change the claim on this
 * page only; in a real app each would be a call to your API.
 */
(() => {
	'use strict';
	const root = pick('[data-rd-root]', document);
	const book = window.Basalt.shopBook;
	const data = window.Basalt.data && window.Basalt.data.refunds;
	if (!root || !book || !data || typeof bootstrap === 'undefined') return;

	function start() {
		document.addEventListener('click', (e) => {
			const c = e.target.closest('[data-rd-copy]');
			if (c && root.contains(c)) {
				copy(c.getAttribute('data-rd-copy'));
				return;
			}
			const b = e.target.closest('[data-rd-act]');
			if (!b || !root.contains(b)) return;
			const act = b.getAttribute('data-rd-act');
			if (act === 'approve') approve();
			else if (act === 'decline') decline();
			else if (act === 'reopen') reopen();
			else if (act === 'link') copy(`${location.href.split('?')[0]}?id=${C.id}`, `Link to ${C.id} copied`);
		});

		drawClaim();
		drawOrder();
		drawAccount();
		drawAll();
		growReturn();
	}

	/* Helpers */
	function pick(selector, scope = root) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = root) {
		return [...scope.querySelectorAll(selector)];
	}

	function el(name) {
		return pick(`[data-rd="${name}"]`);
	}

	function htmlSafe(s) {
		return String(s == null ? '' : s).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function announce(t) {
		if (window.Basalt.announce) window.Basalt.announce(t);
	}

	function plural(n, word) {
		return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
	}

	function initials(name) {
		return name
			.split(/\s+/)
			.filter(Boolean)
			.map((w) => w[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	function first(name) {
		return name.split(' ')[0];
	}

	/* Cents to "$1,234.56" */
	function money(c) {
		return `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	/* Dates: the demo's "today" is the book's, October 9, 2026 */
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	function pad(n) {
		return String(n).padStart(2, '0');
	}

	/* "2026-10-02 15:20", "2026-10-02T15:20" or "2026-10-02" */
	function parse(s) {
		const [d, t] = s.split(/[ T]/);
		const [y, m, dd] = d.split('-').map(Number);
		const [h, mi] = (t || '00:00').split(':').map(Number);
		return new Date(y, m - 1, dd, h, mi);
	}

	function iso(d) {
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}

	const TODAY = book.NOW.slice(0, 10);
	const YESTERDAY = iso(new Date(parse(TODAY).getTime() - 864e5));
	function day(s) {
		const d = parse(s);
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function clock(d) {
		return `${d.getHours() % 12 || 12}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'am' : 'pm'}`;
	}

	/* "Today, 9:30 am", "Yesterday, 4:40 pm" or "Oct 2, 3:20 pm" */
	function when(s) {
		const d = parse(s);
		const k = iso(d);
		return `${k === TODAY ? 'Today' : k === YESTERDAY ? 'Yesterday' : day(s)}, ${clock(d)}`;
	}

	/* Today's date at the time on the visitor's clock. */
	function now() {
		const c = new Date();
		return `${TODAY} ${pad(c.getHours())}:${pad(c.getMinutes())}`;
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

	/* The claim */
	const { ME, ANSWER_DAYS, CHECK_DAYS, COLLECT_FROM, REASONS, TONE } = data;
	/* A copy, so what this page changes stays on this page. */
	const claims = JSON.parse(JSON.stringify(data.CLAIMS));

	function opened(c) {
		return c.status === 'new' || c.status === 'inspecting';
	}

	function answerBy(c) {
		return c.status === 'inspecting'
			? addWorkDays(c.ret.back, CHECK_DAYS)
			: addWorkDays(c.reopened || c.opened, ANSWER_DAYS);
	}

	function lateBy(c) {
		return answerBy(c) < TODAY ? workDaysBetween(answerBy(c), TODAY) : 0;
	}

	function queue() {
		return claims
			.filter(opened)
			.sort((a, b) => answerBy(a).localeCompare(answerBy(b)) || a.opened.localeCompare(b.opened));
	}

	const wanted = new URLSearchParams(location.search).get('id');
	const C = claims.find((c) => c.id === wanted) || queue()[0] || claims[0];
	const O = book.order(C.order);
	const S = book.story(O);
	const A = book.customer(O.customer);

	function P(sku) {
		return book.product(sku);
	}

	function tone(sku) {
		return TONE[sku] || 1;
	}

	const SITE = `${{ reno: 'Elko', annarbor: 'Ann Arbor', medford: 'Bellingham' }[S.site]} warehouse`;
	const TIER = { flagship: 'Insider tier', partner: 'Member tier', trade: 'Standard tier' };
	const contact = A.buyer;
	const card = S.payment.kind === 'card' ? `${S.payment.brand} ending ${S.payment.last4}` : '';

	/* A refund of these items at what was paid for them, discount and tax included, in cents. */
	function sums(lines) {
		return book.refund(
			O,
			lines.map(([sku, qty]) => ({ sku, qty })),
			false,
		);
	}

	function lineNet(sku) {
		const l = O.lines.find((x) => x.sku === sku);
		return book.line(O, l).net / l.qty;
	}

	function linesText(lines) {
		return lines.map(([sku, q]) => `${q} × ${P(sku).name}`).join(', ');
	}

	function units(lines) {
		return lines.reduce((n, l) => n + l[1], 0);
	}

	/* Where a refund can go: back the way the customer paid, or as store credit. */
	const METHODS = [
		card
			? { key: 'card', icon: 'bi-credit-card', title: 'Back to card', text: `${card}. Lands in 5 to 10 days.` }
			: {
					key: 'bank',
					icon: 'bi-bank',
					title: 'Bank transfer',
					text: 'To their bank account. Lands in 1 to 2 days.',
				},
		{ key: 'credit', icon: 'bi-receipt', title: 'Store credit', text: 'Spent on their next order.' },
	];
	function paidText(c) {
		if (c.paid === 'card') return `To the ${card}`;
		if (c.paid === 'bank') return 'By bank transfer';
		return `As store credit ${c.credit}`;
	}

	function fileIcon(n) {
		return /\.(jpg|png)$/.test(n)
			? 'bi-image'
			: /\.mp4$/.test(n)
				? 'bi-play-circle'
				: /\.pdf$/.test(n)
					? 'bi-file-earmark-pdf'
					: 'bi-file-earmark-text';
	}

	function tile(sku) {
		return `<span class="rd-tile rd-tone-${tone(sku)}" aria-hidden="true"><i class="bi ${P(sku).icon}"></i></span>`;
	}

	function copyButton(text, label) {
		return `<button type="button" class="btn btn-icon btn-sm rd-copy" data-rd-copy="${htmlSafe(text)}" aria-label="${htmlSafe(label)}"><i class="bi bi-copy" aria-hidden="true"></i></button>`;
	}

	const customerUrl = 'shoppers.html';
	const orderUrl = `order-details.html?id=${encodeURIComponent(O.orderNumber)}`;

	function claimUrl(id) {
		return `refund-details.html?id=${encodeURIComponent(id)}`;
	}

	function stagePill(c) {
		if (c.status === 'new') return '<span class="basalt-status basalt-status-dot basalt-status-info">New</span>';
		if (c.status === 'inspecting')
			return '<span class="basalt-status basalt-status-primary"><i class="bi bi-search" aria-hidden="true"></i>Inspecting</span>';
		if (c.status === 'refunded')
			return '<span class="basalt-status basalt-status-dot basalt-status-success">Refunded</span>';
		return '<span class="basalt-status basalt-status-dot">Declined</span>';
	}
	function duePill(c) {
		const late = lateBy(c);
		if (late)
			return `<span class="basalt-status basalt-status-danger"><i class="bi bi-clock-history" aria-hidden="true"></i>${plural(late, 'day')} overdue</span>`;
		if (answerBy(c) === TODAY)
			return '<span class="basalt-status basalt-status-warning"><i class="bi bi-clock" aria-hidden="true"></i>Answer today</span>';
		return `<span class="basalt-status basalt-status-info"><i class="bi bi-calendar-check" aria-hidden="true"></i>Answer by ${day(answerBy(c))}</span>`;
	}

	function reasonPill(c) {
		return `<span class="basalt-status rd-tone-${REASONS[c.reason].tone}">${REASONS[c.reason].label}</span>`;
	}

	/* Header: claim number, state, other claims */
	function drawHead() {
		el('title').textContent = `Claim ${C.id}`;
		document.title = `Claim ${C.id} · Basalt`;
		el('sub').textContent =
			`${A.name} · ${money(sums(C.lines).cents)} ${C.status === 'refunded' ? 'refunded' : 'claimed'} · opened ${day(C.opened)}`;
		el('tags').innerHTML = stagePill(C) + (opened(C) ? duePill(C) : '') + reasonPill(C);

		function item(inner) {
			return `<li>${inner}</li>`;
		}

		el('menu').innerHTML =
			item(
				`<a class="dropdown-item" href="${orderUrl}"><i class="bi bi-bag" aria-hidden="true"></i>Open order ${O.orderNumber}</a>`,
			) +
			item(
				`<a class="dropdown-item" href="mailto:${htmlSafe(A.email)}?subject=${encodeURIComponent(`Your refund claim ${C.id}`)}"><i class="bi bi-envelope" aria-hidden="true"></i>Email ${htmlSafe(first(contact))}</a>`,
			) +
			item(
				'<button type="button" class="dropdown-item" data-rd-act="link"><i class="bi bi-link-45deg" aria-hidden="true"></i>Copy link to claim</button>',
			) +
			(C.status === 'declined'
				? item('<hr class="dropdown-divider">') +
					item(
						'<button type="button" class="dropdown-item" data-rd-act="reopen"><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>Reopen claim</button>',
					)
				: '');

		/* Newer and older claims, in the order Refunds keeps them. */
		const i = claims.indexOf(C);

		for (const [name, other, label] of [
			['prev', claims[i - 1], 'Newer claim'],
			['next', claims[i + 1], 'Older claim'],
		]) {
			const a = el(name);
			if (other) {
				a.href = claimUrl(other.id);
				a.classList.remove('disabled');
				a.removeAttribute('aria-disabled');
				a.removeAttribute('tabindex');
				a.setAttribute('aria-label', `${label}, ${other.id}`);
			} else {
				a.removeAttribute('href');
				a.classList.add('disabled');
				a.setAttribute('aria-disabled', 'true');
				a.setAttribute('tabindex', '-1');
				a.setAttribute('aria-label', `No ${label.toLowerCase()}`);
			}
		}
	}

	/* The claim: who, their words, what they sent, our check */
	function drawClaim() {
		const R = REASONS[C.reason];
		const delivered = S.fulfil.deliveredAt;
		const after = workDaysBetween(delivered.slice(0, 10), C.opened.slice(0, 10));
		el('claim-title').textContent = `What ${first(contact)} told us`;
		el('claim-desc').textContent =
			`Opened ${when(C.opened)}, ${after ? `${plural(after, 'working day')} after delivery.` : 'the day it was delivered.'}`;
		el('who').innerHTML =
			`<span class="basalt-avatar basalt-avatar-tone-${A.avatarTone || 1}" aria-hidden="true">${initials(contact)}</span><span class="rd-who-text"><span class="rd-who-name">${htmlSafe(contact)}</span><span class="rd-quiet">Shops with us from <a class="rd-link" href="${customerUrl}">${htmlSafe(A.city)}</a></span></span>`;
		const quote = el('quote');
		quote.className = `rd-quote rd-tone-${R.tone}`;
		quote.innerHTML = `<p>${htmlSafe(C.said)}</p>`;

		const ev = el('evidence');
		if (!C.files.length) {
			ev.innerHTML =
				'<p class="rd-none"><i class="bi bi-paperclip" aria-hidden="true"></i>No photos or files came with this claim.</p>';
		} else {
			/* Each file is a stand-in tile in the reason's colors; the lightbox
         shows it large. Swap the tile for an <img> or <video> of the upload. */
			const tones = [R.tone, 4, 6, 8];
			ev.innerHTML = `<h3 class="rd-section">What ${htmlSafe(first(contact))} sent</h3><ul class="rd-files" data-basalt-lightbox-set="#rd-files">${C.files
				.map(
					([n, size], i) =>
						`<li><button type="button" class="rd-file" data-basalt-lightbox-item data-caption="${htmlSafe(n)}" data-note="${htmlSafe(`${size} · sent with the claim, ${day(C.opened)}`)}" aria-label="View ${htmlSafe(n)}"><span class="rd-photo rd-photo-${tones[i % tones.length]}" aria-hidden="true"><i class="bi ${fileIcon(n)}"></i></span><span class="rd-file-name">${htmlSafe(n)}</span><span class="rd-file-size">${size}</span></button></li>`,
				)
				.join('')}</ul>`;
			if (window.Basalt.dialog) window.Basalt.dialog.init(ev);
		}

		const check = el('check');
		check.hidden = !C.check;
		if (C.check) {
			check.innerHTML = `<h3 class="rd-section">What we found</h3><p class="rd-finding"><i class="bi bi-clipboard-check" aria-hidden="true"></i><span>${htmlSafe(C.check)}<span class="rd-quiet">Checked at the ${SITE}, ${day(C.ret.back)}</span></span></p>`;
		}
	}

	/* The answer, or how it was settled */
	const decide = el('decide');
	let draft = null; /* the refund being prepared: [sku, qty] per claimed line */

	function sumsHtml(lines) {
		const m = sums(lines);
		const tax = book.TAX[O.tax];
		return `<div><dt>Items</dt><dd>${money(m.items)}</dd></div><div><dt>Tax<small>${htmlSafe(tax.label)}</small></dt><dd>${tax.rate && m.tax ? money(m.tax) : 'None'}</dd></div><div class="rd-sums-total"><dt>Refund</dt><dd>${money(m.cents)}</dd></div>`;
	}

	function drawDecide() {
		if (opened(C)) drawAnswer();
		else drawOutcome();
	}

	function drawAnswer() {
		draft = C.lines.map((l) => l.slice());
		const name = htmlSafe(first(contact));
		decide.innerHTML = `<div class="card-body"><header class="rd-card-head"><div><h2 class="rd-card-title" id="rd-decide-title">Your answer</h2><p class="rd-card-desc">Refund all or part of it, or decline with a reason.</p></div></header><section class="rd-block" aria-labelledby="rd-items-title"><h3 class="rd-section" id="rd-items-title">What to refund</h3><ul class="rd-items" aria-describedby="rd-items-hint">${C.lines
			.map(
				([sku, q], i) =>
					`<li class="rd-item" data-rd-line="${i}">${tile(sku)}<span class="rd-item-text"><span class="rd-item-name">${htmlSafe(P(sku).name)}</span><span class="rd-quiet">${q} claimed · ${money(lineNet(sku))} each</span></span><div class="basalt-stepper basalt-stepper-sm" data-basalt-stepper><button type="button" class="basalt-stepper-btn" data-basalt-step="-1" aria-label="One fewer ${htmlSafe(P(sku).name)}"><i class="bi bi-dash-lg" aria-hidden="true"></i></button><input type="number" class="basalt-stepper-input" value="${q}" min="0" max="${q}" inputmode="numeric" aria-label="${htmlSafe(P(sku).name)} to refund"><button type="button" class="basalt-stepper-btn" data-basalt-step="1" aria-label="One more ${htmlSafe(P(sku).name)}"><i class="bi bi-plus-lg" aria-hidden="true"></i></button></div></li>`,
			)
			.join(
				'',
			)}</ul><p class="rd-hint" id="rd-items-hint">Lower a number to refund part of the claim.</p><p class="rd-error" id="rd-items-error" hidden>Refund at least one item, or decline the claim.</p><dl class="rd-sums" aria-live="polite" data-rd-sums>${sumsHtml(draft)}</dl></section><fieldset class="rd-block basalt-choice-set"><legend class="rd-section">Pay back as</legend><div class="basalt-choice-grid rd-methods">${METHODS.map(
			(m, i) =>
				`<label class="basalt-choice-card"><input class="basalt-choice-card-input" type="radio" name="rdMethod" value="${m.key}"${i === 0 ? ' checked' : ''}><span class="basalt-choice-card-icon" aria-hidden="true"><i class="bi ${m.icon}"></i></span><span class="basalt-choice-card-title">${m.title}</span><span class="basalt-choice-card-text">${htmlSafe(m.text)}</span></label>`,
		).join(
			'',
		)}</div></fieldset><div class="rd-block"><label class="rd-section" for="rd-note">Note to ${name}</label><textarea class="form-control" id="rd-note" rows="3" maxlength="600" aria-describedby="rd-note-hint rd-note-error" placeholder="Sent by email with your answer"></textarea><div class="form-text" id="rd-note-hint">Optional when you refund. Needed when you decline.</div><div class="invalid-feedback" id="rd-note-error">Say why you are declining, so ${name} can reply.</div></div></div><div class="rd-decide-foot"><button type="button" class="btn btn-outline-secondary" data-rd-act="decline"><i class="bi bi-x-lg me-1" aria-hidden="true"></i>Decline</button><button type="button" class="btn btn-primary" data-rd-act="approve"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Approve refund</button></div>`;

		for (const s of pickAll('[data-basalt-stepper]', decide)) {
			if (window.Basalt.stepper) window.Basalt.stepper(s);
		}
	}

	function drawOutcome() {
		draft = null;
		const name = htmlSafe(first(contact));
		const refunded = C.status === 'refunded';
		const m = sums(C.lines);
		const tax = book.TAX[O.tax];
		const facts = [['Items', htmlSafe(linesText(C.lines))]];
		if (refunded && C.partOf) facts.push(['Claimed', htmlSafe(linesText(C.partOf))]);
		if (refunded) {
			facts.push([
				'Made up of',
				`${money(m.items)} for the items${m.tax ? ` and ${money(m.tax)} ${htmlSafe(tax.label.replace(/ [\d.]+%$/, ''))}` : ', no tax'}`,
			]);
			facts.push(['Paid back', htmlSafe(paidText(C))]);
			facts.push([
				'Lands',
				C.paid === 'card'
					? `By ${day(addWorkDays(C.settled, 8))}, 5 to 10 days after`
					: C.paid === 'bank'
						? `By ${day(addWorkDays(C.settled, 2))}`
						: 'Taken off the next invoice',
			]);
		}
		facts.push(['Decided by', htmlSafe(C.by) + (C.by === ME ? ' <span class="rd-you">You</span>' : '')]);
		decide.innerHTML = `<div class="card-body"><header class="rd-card-head"><div><h2 class="rd-card-title" id="rd-decide-title">Outcome</h2><p class="rd-card-desc">${refunded ? 'Refunded' : 'Declined'} on ${day(C.settled)}.</p></div></header><div class="rd-result rd-result-${refunded ? 'refunded' : 'declined'}"><span class="rd-result-icon" aria-hidden="true"><i class="bi ${refunded ? 'bi-check2-circle' : 'bi-x-circle'}"></i></span><span class="rd-result-text"><span class="rd-result-amount">${money(m.cents)}</span><span class="rd-quiet">${refunded ? 'refunded with tax' : 'claimed, not refunded'}</span></span></div><dl class="rd-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl><section class="rd-block" aria-labelledby="rd-note-title"><h3 class="rd-section" id="rd-note-title">Note sent to ${name}</h3><blockquote class="rd-sent"><p>${htmlSafe(C.note)}</p></blockquote></section></div>${refunded ? '' : '<div class="rd-decide-foot"><button type="button" class="btn btn-outline-secondary" data-rd-act="reopen"><i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Reopen claim</button></div>'}`;
	}

	/* Numbers change the refund as they move. */
	decide.addEventListener('change', (e) => {
		const li = e.target.closest('[data-rd-line]');
		if (!li || !draft) return;
		draft[+li.getAttribute('data-rd-line')][1] = Math.max(0, parseInt(e.target.value, 10) || 0);
		pick('[data-rd-sums]', decide).innerHTML = sumsHtml(draft.filter((l) => l[1] > 0));
		if (draft.some((l) => l[1] > 0)) pick('#rd-items-error', decide).hidden = true;
	});
	decide.addEventListener('input', (e) => {
		if (e.target.id !== 'rd-note') return;
		e.target.classList.remove('is-invalid');
		e.target.removeAttribute('aria-invalid');
	});

	/* The order the claim is about, at the foot of the claim */
	function drawOrder() {
		el('order-title').textContent = `Order ${O.orderNumber}`;
		el('order-link').href = orderUrl;
		el('order-link').innerHTML = `Open order<span class="visually-hidden"> ${O.orderNumber}</span>`;
		el('order-desc').textContent =
			`Placed ${day(S.placed)}, delivered ${day(S.fulfil.deliveredAt)} by ${S.fulfil.carrier}.`;
		const claimed = {};
		C.lines.forEach(([sku, q]) => {
			claimed[sku] = q;
		});
		el('lines').innerHTML = O.lines
			.map((l) => {
				const q = claimed[l.sku] || 0;
				return `<tr${q ? ' class="is-claimed"' : ''}><td><span class="rd-product">${tile(l.sku)}<span class="rd-product-text"><span class="rd-product-name">${htmlSafe(P(l.sku).name)}</span><span class="rd-quiet rd-sku">${l.sku}</span></span></span></td><td class="text-end">${l.qty}</td><td class="text-end">${q ? `<span class="rd-claimed">${q}</span>` : '<span class="rd-quiet">None</span>'}</td><td class="text-end rd-col-paid">${money(lineNet(l.sku))}</td></tr>`;
			})
			.join('');
		const sum = book.sums(O);
		const p = S.payment;
		const facts = [['Order total', `${money(sum.total)} <span class="rd-quiet rd-inline">with tax</span>`]];
		if (O.discount)
			facts.push([
				'Promo code',
				`<span class="rd-sku">${O.discount}</span> <span class="rd-quiet rd-inline">${htmlSafe(book.DISCOUNTS[O.discount].label)}</span>`,
			]);
		facts.push(
			card
				? ['Paid by', htmlSafe(card)]
				: [
						'Paid by',
						`Invoice <a class="rd-link" href="invoice-details.html?id=${encodeURIComponent(p.invoice)}">${p.invoice}</a>`,
					],
		);
		el('order-facts').innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
	}

	/* Return: the label, the parcel, the check */
	function carrierOf(ret) {
		return ret.carrier || S.fulfil.carrier;
	}

	function drawReturn() {
		const ret = C.ret;
		const box = el('return');
		if (ret && ret.kept) {
			el('return-desc').textContent = 'No return needed.';
			box.innerHTML = `<p class="rd-kept"><i class="bi bi-house-check" aria-hidden="true"></i><span>${htmlSafe(ret.kept)}</span></p>`;
			return;
		}
		if (!ret) {
			if (!opened(C)) {
				el('return-desc').textContent = 'No return needed.';
				box.innerHTML =
					'<p class="rd-kept"><i class="bi bi-house-check" aria-hidden="true"></i><span>The claim was settled without the item coming back.</span></p>';
				return;
			}
			const cheap = C.lines.every(([sku]) => P(sku).price < COLLECT_FROM);
			el('return-desc').textContent = 'No return arranged yet.';
			box.innerHTML = `<p class="rd-kept rd-kept-ask"><i class="bi bi-box-arrow-in-left" aria-hidden="true"></i><span>${cheap ? `Items under $${COLLECT_FROM} each usually stay with the customer, so you can refund without one.` : 'Ask for the item back if you want to check it before you answer.'}</span></p><button type="button" class="btn btn-outline-secondary btn-sm rd-label-btn" data-bs-toggle="modal" data-bs-target="#rd-label"><i class="bi bi-printer me-1" aria-hidden="true"></i>Send return label</button>`;
			return;
		}
		const carrier = carrierOf(ret);
		const done = !opened(C) || Boolean(C.check);
		el('return-desc').textContent = `A prepaid ${carrier} label, sent by ${ret.by}.`;

		function step(state, label, sub, mark) {
			return `<li class="rd-step is-${state}"><span class="rd-step-marker" aria-hidden="true">${state === 'done' ? '<i class="bi bi-check-lg"></i>' : mark}</span><span class="rd-step-text"><span class="rd-step-label">${label}<span class="visually-hidden">, ${state === 'done' ? 'done' : state === 'next' ? 'up next' : 'not yet'}</span></span><span class="rd-step-when">${sub}</span></span></li>`;
		}

		const back = Boolean(ret.back);
		box.innerHTML = `<ol class="rd-steps">${step('done', 'Label sent', when(ret.sent) + (ret.printed ? ' · printed to post' : ` · emailed to ${htmlSafe(first(contact))}`), 1)}${step(back ? 'done' : 'next', 'On its way', `${carrier} <span class="rd-sku">${htmlSafe(ret.label)}</span>${copyButton(ret.label, 'Copy the tracking number')}`, 2)}${step(back ? 'done' : 'todo', `Back at the ${SITE}`, back ? when(ret.back) : 'Not yet', 3)}${step(done ? 'done' : back ? 'next' : 'todo', 'Checked', done && back ? (C.check ? 'What we found is in the claim' : `${day(C.settled)}, as described`) : 'Not yet', 4)}</ol>`;
	}

	/**
	 * Grows the filled lines between done steps of the return the first
	 * time they are on screen. Later repaints show them already drawn.
	 */
	function growReturn() {
		const trail = pick('.rd-steps');
		let left = trail ? pickAll('.rd-step.is-done:not(:last-child)', trail).length : 0;
		if (!left || !window.IntersectionObserver || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
			return;
		trail.classList.add('is-waiting');
		trail.addEventListener('animationend', function done(event) {
			if (event.animationName !== 'rd-trail-grow' || --left) return;
			trail.classList.remove('is-drawing');
			trail.removeEventListener('animationend', done);
		});
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				trail.classList.replace('is-waiting', 'is-drawing');
			},
			{ threshold: 0.5 },
		);
		watch.observe(trail);
	}

	/* Send return label */
	const labelNode = document.getElementById('rd-label');

	function lf(name) {
		return pick(`[data-rd-label="${name}"]`, labelNode);
	}

	const CARRIER_ICON = {
		UPS: 'bi-truck',
		FedEx: 'bi-airplane',
		'DHL Express': 'bi-lightning-charge',
		USPS: 'bi-envelope',
	};
	/* Tracking numbers in each carrier's own shape, the same for the same claim. */
	function tracking(carrier) {
		const rnd = book.seeded(C.id + carrier);

		function digits(n) {
			return Array.from({ length: n }, () => Math.floor(rnd() * 10)).join('');
		}

		function alnum(n) {
			return Array.from({ length: n }, () => '0123456789ABCDEFGHJKLMNPRSTUVWXY'[Math.floor(rnd() * 32)]).join('');
		}

		if (carrier === 'UPS') return `1Z${alnum(6)}${digits(10)}`;
		if (carrier === 'FedEx') return `7781${digits(8)}`;
		if (carrier === 'USPS') return `9400${digits(18)}`;
		return digits(10);
	}
	labelNode.addEventListener('show.bs.modal', () => {
		const carriers = book.REGIONS[S.region].carriers;
		lf('carriers').innerHTML = `<legend>Carrier</legend>${carriers
			.map(
				(c, i) =>
					`<label class="basalt-choice"><input type="radio" name="rd-carrier" value="${htmlSafe(c)}"${c === S.fulfil.carrier || (!carriers.includes(S.fulfil.carrier) && i === 0) ? ' checked' : ''}><i class="bi ${CARRIER_ICON[c] || 'bi-truck'}" aria-hidden="true"></i>${htmlSafe(c)}</label>`,
			)
			.join('')}`;
		lf('sub').textContent =
			`Prepaid, so ${linesText(C.lines)} come${units(C.lines) === 1 ? 's' : ''} back to the ${SITE}.`;
		lf('goes').innerHTML =
			`Collected from <strong>${htmlSafe(A.name)}</strong>, ${htmlSafe(A.address.join(', '))}.`;
		lf('email').checked = true;
		lf('email-label').textContent = `Email the label to ${contact}`;
	});
	lf('form').addEventListener('submit', (e) => {
		e.preventDefault();
		const carrier = (pick('input[name="rd-carrier"]:checked', labelNode) || {}).value || S.fulfil.carrier;
		const emailed = lf('email').checked;
		C.ret = { label: tracking(carrier), carrier, by: ME, sent: now(), printed: !emailed };
		bootstrap.Modal.getOrCreateInstance(labelNode).hide();
		fresh = 'label';
		drawAll();
		toast({
			tone: 'success',
			icon: 'bi-box-arrow-in-left',
			title: 'Return label sent',
			text: emailed ? `${carrier} label emailed to ${first(contact)}.` : `${carrier} label ready to print.`,
		});
		announce('Return label sent');
	});

	/* History, newest first */
	let fresh = ''; /* the kind of the event this visit just added */

	function who(name) {
		return `<strong>${htmlSafe(name)}</strong>`;
	}

	/* A decision on the record; for the demo data, settled that afternoon. */
	function decisionEvent(c) {
		const at = c.decidedAt || `${c.settled} 14:30`;
		const m = sums(c.lines);
		if (c.status === 'refunded') {
			return {
				at,
				kind: 'decided',
				icon: 'bi-check2-circle',
				tone: 'success',
				html: `${who(c.by)} refunded ${money(m.cents)}${c.paid === 'credit' ? ` as store credit ${c.credit}` : c.paid === 'card' ? ` to the ${htmlSafe(card)}` : ' by bank transfer'} and emailed ${htmlSafe(first(contact))}`,
			};
		}
		return {
			at,
			kind: 'decided',
			icon: 'bi-x-circle',
			html: `${who(c.by)} declined the claim and emailed ${htmlSafe(first(contact))} why`,
		};
	}
	function drawHistory() {
		const ev = [];
		ev.push({
			at: S.fulfil.deliveredAt,
			icon: 'bi-truck',
			html: `Order ${O.orderNumber} delivered by ${htmlSafe(S.fulfil.carrier)}`,
		});
		ev.push({
			at: C.opened,
			icon: 'bi-chat-left-text',
			html: `${who(contact)} opened the claim${C.files.length ? ` and sent ${plural(C.files.length, 'file')}` : ''}`,
		});
		if (C.ret && C.ret.label) {
			ev.push({
				at: C.ret.sent,
				kind: 'label',
				icon: 'bi-printer',
				html: `${who(C.ret.by)} sent a ${htmlSafe(carrierOf(C.ret))} return label`,
			});
			if (C.ret.back)
				ev.push({
					at: C.ret.back,
					icon: 'bi-box-seam',
					html: `Item back at the ${SITE}${C.check ? ' and checked' : ''}`,
				});
		}
		(C.log || []).forEach((e) => ev.push(e));
		if (!opened(C)) ev.push(decisionEvent(C));
		/* Newest first; of two at the same minute, the one added later. */
		ev.forEach((e, i) => {
			e.n = i;
		});
		ev.sort((a, b) => parse(b.at) - parse(a.at) || b.n - a.n);
		el('history').innerHTML = ev
			.map(
				(e) =>
					`<li class="rd-feed-item${e.tone ? ` rd-feed-item-${e.tone}` : ''}${fresh && e.kind === fresh ? ' is-fresh' : ''}"><span class="rd-feed-icon" aria-hidden="true"><i class="bi ${e.icon}"></i></span><span class="rd-feed-text"><span>${e.html}</span><span class="rd-feed-time">${when(e.at)}</span></span></li>`,
			)
			.join('');
	}

	/* Customer: who they are, and their other claims */
	function drawAccount() {
		el('account-link').href = customerUrl;
		el('account-link').innerHTML = `View customer<span class="visually-hidden"> ${htmlSafe(A.name)}</span>`;
		el('account').innerHTML =
			`<span class="rd-account-mark rd-tone-${A.avatarTone || 1}" aria-hidden="true">${initials(A.name)}</span><span class="rd-account-text"><span class="rd-account-name">${htmlSafe(A.name)}</span><span class="rd-quiet">${htmlSafe([TIER[A.tier], `customer since ${A.joinedOn.slice(0, 4)}`].filter(Boolean).join(' · '))}</span></span>`;
		const theirs = claims.filter((c) => book.order(c.order).customer === O.customer && c !== C);
		const others = theirs.length
			? `${theirs.map((c) => `<a class="rd-link" href="${claimUrl(c.id)}">${c.id}</a>`).join(', ')} <span class="rd-quiet rd-inline">since ${day(claims[claims.length - 1].opened)}</span>`
			: `None since ${day(claims[claims.length - 1].opened)}`;
		const facts = [
			['Contact', htmlSafe(contact)],
			[
				'Email',
				`<span>${htmlSafe(A.email).replace('@', '<wbr>@')}</span>${copyButton(A.email, 'Copy the email address')}`,
			],
			['Phone', `<span>${htmlSafe(A.phone)}</span>${copyButton(A.phone, 'Copy the phone number')}`],
			['Store orders', `${plural(A.orders, 'order')}, $${A.lifetimeValue.toLocaleString('en-US')} in all`],
			['Other claims', others],
		];
		el('account-facts').innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
	}

	function drawAll() {
		drawHead();
		drawDecide();
		drawReturn();
		drawHistory();
	}

	/* Actions */
	function copy(text, title) {
		function done() {
			return toast({ tone: 'success', icon: 'bi-copy', title: title || `Copied ${text}`, duration: 2400 });
		}

		if (window.Basalt.copyText) window.Basalt.copyText(text).then(done);
		else done();
	}
	/* After an answer the card is shorter: bring its top back into view
     (below the sticky top bar) and put focus on its title. */
	function focusDecide() {
		const h = pick('#rd-decide-title');
		h.setAttribute('tabindex', '-1');
		h.focus({ preventScroll: true });
		const bar = pick('.basalt-topbar', document);
		const top = decide.getBoundingClientRect().top + window.scrollY - (bar ? bar.offsetHeight : 0) - 16;
		if (top < window.scrollY)
			window.scrollTo({
				top,
				behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
			});
	}

	function approve() {
		const lines = draft.filter((l) => l[1] > 0);
		if (!lines.length) {
			pick('#rd-items-error', decide).hidden = false;
			pick('.basalt-stepper-input', decide).focus();
			return;
		}
		const before = sums(C.lines).cents;
		if (sums(lines).cents < before) C.partOf = C.lines;
		C.lines = lines;
		C.paid = (pick('input[name="rdMethod"]:checked', decide) || {}).value || 'credit';
		if (C.paid === 'credit') {
			const used = claims
				.map((x) => x.credit)
				.filter(Boolean)
				.map((s) => Number(s.replace(/\D/g, '')));
			C.credit = `#${Math.max(...used.concat(60)) + 1}`;
		}
		settle('refunded', pick('#rd-note', decide).value.trim() || 'Your refund is approved.');
		const partly = Boolean(C.partOf);
		toast({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: C.id + (partly ? ' partly refunded' : ' refunded'),
			text: `${money(sums(C.lines).cents)} · ${paidText(C)}`,
		});
		announce(C.id + (partly ? ' partly refunded' : ' refunded'));
	}
	function decline() {
		const note = pick('#rd-note', decide);
		if (!note.value.trim()) {
			note.classList.add('is-invalid');
			note.setAttribute('aria-invalid', 'true');
			note.focus();
			return;
		}
		settle('declined', note.value.trim());
		toast({
			tone: 'info',
			icon: 'bi-x-circle',
			title: `${C.id} declined`,
			text: `${first(contact)} gets your note by email.`,
		});
		announce(`${C.id} declined`);
	}
	function settle(status, note) {
		C.status = status;
		C.settled = TODAY;
		C.decidedAt = now();
		C.by = ME;
		C.note = note;
		fresh = 'decided';
		drawAll();
		focusDecide();
	}
	function reopen() {
		C.log = (C.log || []).concat(decisionEvent(C), {
			at: now(),
			kind: 'reopened',
			icon: 'bi-arrow-counterclockwise',
			html: `${who(ME)} reopened the claim`,
		});
		C.status = 'new';
		C.reopened = now();

		for (const k of ['settled', 'decidedAt', 'by', 'note', 'paid', 'credit', 'partOf']) {
			delete C[k];
		}

		fresh = 'reopened';
		drawAll();
		focusDecide();
		toast({
			tone: 'info',
			icon: 'bi-arrow-counterclockwise',
			title: `${C.id} reopened`,
			text: `Answer by ${day(answerBy(C))}.`,
		});
		announce(`${C.id} reopened`);
	}

	start();
})();
