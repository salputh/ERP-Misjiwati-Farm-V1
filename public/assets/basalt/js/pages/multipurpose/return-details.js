/**
 * Basalt - Return Details (return-details.html)
 * One return on a Marlo shop order, in full: what is coming back and
 * why, the refund, each step from request to refund, the prepaid
 * label and the shopper. The next step is the button in the header:
 * Approve, Send label, Mark received or Refund; Decline is in the
 * menu beside it.
 *
 * The returns are the ones on the Returns page (window.Basalt.data.
 * returns, assets/basalt/js/data/multipurpose/shop-returns.js). Their orders, shoppers,
 * prices and tax are the shop book's (window.Basalt.shopBook,
 * assets/basalt/js/data/multipurpose/store.js), so the refund here is the one on Returns
 * and the order is the one on Order Details.
 *
 * ?id=%23229 in the address picks the return. Without one (or with
 * an id that isn't there), the oldest request still waiting for an
 * answer opens.
 *
 * Changes made here stay on this page; in a real app each would be a
 * call to your API.
 */
(() => {
	'use strict';
	const root = pick('[data-rtd-root]');
	const book = window.Basalt.shopBook;
	const data = window.Basalt.data && window.Basalt.data.returns;
	if (!root || !book || !data || typeof bootstrap === 'undefined') return;

	function start() {
		labelNode.addEventListener('show.bs.modal', () => {
			const carriers = book.REGIONS[S.region].carriers;
			lf('carriers').innerHTML = `<legend>Carrier</legend>${carriers
				.map(
					(c, i) =>
						`<label class="basalt-choice"><input type="radio" name="rtd-carrier" value="${htmlSafe(c)}"${i === 0 ? ' checked' : ''}><i class="bi ${CARRIER_ICON[c] || 'bi-truck'}" aria-hidden="true"></i>${htmlSafe(c)}</label>`,
				)
				.join('')}`;
			lf('sub').textContent = `Prepaid, so the ${linesText} comes back to the ${SITE} at no cost.`;
			lf('goes').innerHTML =
				`Collected from <strong>${htmlSafe(A.name)}</strong>, ${htmlSafe(A.address.join(', '))}.`;
			lf('email').checked = true;
			lf('email-label').textContent = `Email the label to ${first(A.name)}`;
		});
		lf('form').addEventListener('submit', (e) => {
			e.preventDefault();
			const carrier = (pick('input[name="rtd-carrier"]:checked', labelNode) || {}).value || 'UPS';
			R.label = { carrier, tracking: tracking(carrier), sent: now() };
			hide(labelNode);
			done(
				'Label sent',
				'Return label sent',
				lf('email').checked
					? `${carrier} label emailed to ${first(A.name)}.`
					: `${carrier} label ready to print.`,
			);
		});

		/* Mark received */
		const COND = { new: 'Unworn with tags on.', tried: 'Tried on, no marks.', worn: 'Worn or washed.' };
		pick('[data-rtd-c="form"]', recEl).addEventListener('submit', (e) => {
			e.preventDefault();
			const c = (pick('input[name="rtd-cond"]:checked', recEl) || {}).value || 'new';
			const note = pick('[data-rtd-c="note"]', recEl).value.trim();
			R.status = 'received';
			R.received = [
				now(),
				COND[c] +
					(note
						? ` ${note}`
						: c === 'worn'
							? ' It may not go back on sale.'
							: ` Back in stock at ${SITE.replace(' warehouse', '')}.`),
			];
			hide(recEl);
			pick('[data-rtd-c="form"]', recEl).reset();
			done(
				'Received',
				`${R.id} marked received`,
				c === 'worn' ? 'Refund it or decline it with a note.' : `Next, refund ${money(sums().cents)}.`,
			);
		});

		/* Refund */
		refEl.addEventListener('show.bs.modal', () => {
			pick('[data-rtd-f="sub"]', refEl).textContent =
				`${money(sums().cents)} for the ${linesText}, tax included.`;
			pick('[data-rtd-f="go"]', refEl).textContent = `Refund ${money(sums().cents)}`;
			pick('[data-rtd-f="methods"]', refEl).innerHTML = METHODS.map(
				(m, i) =>
					`<label class="basalt-choice-card"><input class="basalt-choice-card-input" type="radio" name="rtdMethod" value="${m.key}"${i === 0 ? ' checked' : ''}><span class="basalt-choice-card-icon" aria-hidden="true"><i class="bi ${m.icon}"></i></span><span class="basalt-choice-card-title">${m.title}</span><span class="basalt-choice-card-text">${htmlSafe(m.text)}</span></label>`,
			).join('');
		});
		pick('[data-rtd-f="form"]', refEl).addEventListener('submit', (e) => {
			e.preventDefault();
			const how = (pick('input[name="rtdMethod"]:checked', refEl) || {}).value || METHODS[0].key;
			R.status = 'refunded';
			if (how === 'credit') R.credit = '#64';
			R.refunded = [now(), ME, how];
			hide(refEl);
			done('Refunded', `${money(sums().cents)} refunded`, `${paidText(how)}. ${first(A.name)} gets an email.`);
		});

		/* Decline */
		const dNote = pick('[data-rtd-d="note"]', decEl);
		decEl.addEventListener('show.bs.modal', () => {
			dNote.value = '';
			dNote.classList.remove('is-invalid');
			dNote.removeAttribute('aria-invalid');
			pick('[data-rtd-d="sub"]', decEl).textContent = `${first(A.name)} gets your note by email.`;
		});
		decEl.addEventListener('shown.bs.modal', () => dNote.focus());
		dNote.addEventListener('input', () => {
			if (dNote.value.trim()) {
				dNote.classList.remove('is-invalid');
				dNote.removeAttribute('aria-invalid');
			}
		});
		pick('[data-rtd-d="form"]', decEl).addEventListener('submit', (e) => {
			e.preventDefault();
			const note = dNote.value.trim();
			if (!note) {
				dNote.classList.add('is-invalid');
				dNote.setAttribute('aria-invalid', 'true');
				dNote.focus();
				return;
			}
			R.status = 'declined';
			R.declined = [now(), ME, note];
			hide(decEl);
			done('Declined', `${R.id} declined`, `${first(A.name)} has your note by email.`);
		});

		drawAll();
		growSteps();
	}

	/* Helpers */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function el(name) {
		return pick(`[data-rtd="${name}"]`, root);
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
		return `${n} ${word}${n === 1 ? '' : 's'}`;
	}

	function initials(name) {
		const w = name.split(' ');
		return (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
	}

	function first(name) {
		return name.split(' ')[0];
	}

	function money(c) {
		return `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	/* Dates: "today" is the book's, October 9, 2026 */
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

	const TODAY = book.NOW.slice(0, 10);
	const YESTERDAY = iso(new Date(parse(TODAY).getTime() - 864e5));
	function day(s) {
		const d = parse(s);
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}
	function longDay(s) {
		const d = parse(s);
		return `${MONTHS_LONG[d.getMonth()]} ${d.getDate()}`;
	}

	function clock(d) {
		return `${d.getHours() % 12 || 12}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'am' : 'pm'}`;
	}

	function when(s) {
		const d = parse(s);
		const k = iso(d);
		return `${k === TODAY ? 'Today' : k === YESTERDAY ? 'Yesterday' : day(s)}, ${clock(d)}`;
	}

	/* An action is stamped with the book's clock, a few minutes after
     the return's latest step, so the timeline always reads in order. */
	function stamp(d) {
		return `${iso(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function now() {
		const steps = [R.requested, R.approved && R.approved[0], R.label && R.label.sent, R.received && R.received[0]]
			.filter(Boolean)
			.map(parse);
		const at = new Date(Math.max(parse(book.NOW).getTime(), Math.max(...steps.map((d) => d.getTime())) + 5 * 6e4));
		return stamp(at);
	}
	function shiftDays(s, n) {
		const d = parse(s);
		d.setDate(d.getDate() + n);
		return iso(d);
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

	/* The return */
	const { ME, WINDOW_DAYS, APPROVE_DAYS, REASONS } = data;
	/* A copy, so what this page changes stays on this page. */
	const all = JSON.parse(JSON.stringify(data.RETURNS));
	const waiting = all.filter((r) => r.status === 'requested').sort((a, b) => a.requested.localeCompare(b.requested));
	const wanted = new URLSearchParams(location.search).get('id');
	const R = all.find((r) => r.id === wanted) || waiting[0] || all[0];
	const O = book.order(R.order);
	const S = book.story(O);
	const A = book.customer(O.customer);

	function P(sku) {
		return book.product(sku);
	}

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
	const SITE = `${{ reno: 'Elko', annarbor: 'Ann Arbor', medford: 'Bellingham' }[S.site]} warehouse`;
	const TIER = { flagship: 'Insider', partner: 'Member', trade: 'Standard' };
	const card =
		S.payment.kind === 'card'
			? `${S.payment.brand === 'American Express' ? 'Amex' : S.payment.brand} ending ${S.payment.last4}`
			: '';
	const delivered = S.fulfil.deliveredAt;
	const closes = shiftDays(delivered, WINDOW_DAYS);

	function sums() {
		return book.refund(
			O,
			R.lines.map(([sku, qty]) => ({ sku, qty })),
			false,
		);
	}

	const linesText = R.lines.map(([sku, q]) => (q > 1 ? `${q} × ` : '') + P(sku).name).join(', ');
	const units = R.lines.reduce((n, l) => n + l[1], 0);

	function url(id) {
		return `return-details.html?id=${encodeURIComponent(id)}`;
	}

	function opened() {
		return R.status === 'requested' || R.status === 'approved' || R.status === 'received';
	}

	const approveBy = addWorkDays(R.requested, APPROVE_DAYS);

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

	function paidText(how) {
		return how === 'card'
			? `Back to the ${card || 'card'}`
			: how === 'bank'
				? 'By bank transfer'
				: `As store credit${R.credit ? ` ${R.credit}` : ''}`;
	}

	const STATUS = {
		requested: { label: 'Requested', cls: 'basalt-status-dot basalt-status-info' },
		approved: { label: 'Approved', cls: 'basalt-status-dot basalt-status-primary' },
		received: { label: 'Received', cls: 'basalt-status-dot basalt-status-warning' },
		refunded: { label: 'Refunded', cls: 'basalt-status-dot basalt-status-success' },
		declined: { label: 'Declined', cls: 'basalt-status-dot' },
	};

	function tile(sku) {
		return `<span class="rtd-tile rtd-tone-${TONE[sku] || 1}" aria-hidden="true"><i class="bi ${P(sku).icon}"></i></span>`;
	}

	function copyButton(text, label) {
		return `<button type="button" class="btn btn-icon btn-sm rtd-copy" data-rtd-copy="${htmlSafe(text)}" aria-label="${htmlSafe(label)}"><i class="bi bi-copy" aria-hidden="true"></i></button>`;
	}

	let fresh = '';

	/* Header: return number, where it stands, the next step */
	/* The one next step, as the header's main button. */
	function nextStep() {
		if (R.status === 'requested') return { act: 'approve', icon: 'bi-check2', label: 'Approve' };
		if (R.status === 'approved' && !R.label) return { act: 'label', icon: 'bi-printer', label: 'Send label' };
		if (R.status === 'approved') return { act: 'received', icon: 'bi-box-seam', label: 'Mark received' };
		if (R.status === 'received')
			return { act: 'refund', icon: 'bi-arrow-counterclockwise', label: `Refund ${money(sums().cents)}` };
		return null;
	}
	function drawHead() {
		el('title').textContent = `Return ${R.id}`;
		document.title = `Return ${R.id} · Basalt`;
		el('sub').textContent =
			`${A.name} · ${plural(units, 'item')} · ${money(sums().cents)} · asked ${day(R.requested)}`;
		const late = R.status === 'requested' && approveBy < TODAY ? workDaysBetween(approveBy, TODAY) : 0;
		el('tags').innerHTML =
			`<span class="basalt-status ${STATUS[R.status].cls}">${STATUS[R.status].label}</span><span class="basalt-status rtd-tone-${REASONS[R.reason].tone}">${REASONS[R.reason].label}</span>${late ? `<span class="basalt-status basalt-status-danger"><i class="bi bi-clock-history" aria-hidden="true"></i>${plural(late, 'day')} overdue</span>` : ''}`;
		const n = nextStep();
		el('next').innerHTML = n
			? `<button type="button" class="btn btn-primary btn-sm" data-rtd-act="${n.act}"><i class="bi ${n.icon} me-1" aria-hidden="true"></i>${n.label}</button>`
			: '';
		el('menu').innerHTML =
			`${opened() ? '<li><button type="button" class="dropdown-item" data-rtd-act="decline"><i class="bi bi-x-circle" aria-hidden="true"></i>Decline return</button></li>' : ''}<li><button type="button" class="dropdown-item" data-rtd-act="copy"><i class="bi bi-link-45deg" aria-hidden="true"></i>Copy link</button></li><li><button type="button" class="dropdown-item" data-rtd-act="print"><i class="bi bi-printer" aria-hidden="true"></i>Print</button></li>`;
		/* Newer and older returns, in the list's order. */
		const i = all.findIndex((r) => r.id === R.id);
		const prev = all[i - 1];
		const next = all[i + 1];

		for (const [k, r] of [
			['prev', prev],
			['next-page', next],
		]) {
			const a = el(k);
			a.href = r ? url(r.id) : '#';
			a.classList.toggle('disabled', !r);
			if (r) a.removeAttribute('aria-disabled');
			else a.setAttribute('aria-disabled', 'true');
		}
	}

	/* Coming back */
	function drawItems() {
		el('items-desc').textContent =
			`${plural(units, 'item')} from order ${O.orderNumber}, delivered ${longDay(delivered)}.`;
		el('order-link').href = `order-details.html?id=${encodeURIComponent(O.orderNumber)}`;
		el('who').innerHTML =
			`<span class="basalt-avatar basalt-avatar-tone-${A.avatarTone}" aria-hidden="true">${initials(A.name)}</span><span class="rtd-who-text"><span class="rtd-who-name">${htmlSafe(A.name)}</span><span class="rtd-quiet">${htmlSafe(A.city)} · asked ${when(R.requested)}</span></span>`;
		const q = el('quote');
		q.className = `rtd-quote rtd-tone-${REASONS[R.reason].tone}`;
		q.innerHTML = `<p>${htmlSafe(R.said)}</p>`;
		el('lines').innerHTML = R.lines
			.map(([sku, qty, size]) => {
				const l = O.lines.find((x) => x.sku === sku);
				const each = book.line(O, l).net / l.qty;
				return `<tr><td><span class="rtd-product">${tile(sku)}<span class="rtd-product-text"><span class="rtd-product-name">${htmlSafe(P(sku).name)}</span><span class="rtd-quiet rtd-sku">${sku}</span></span></span></td><td class="text-end">${size || 'One size'}</td><td class="text-end">${qty}</td><td class="text-end rtd-col-paid">${money(each)}</td></tr>`;
			})
			.join('');
		el('item-facts').innerHTML =
			`<div><dt>Shopper says</dt><dd>${htmlSafe(R.condition)}</dd></div>${R.received ? `<div><dt>Our check</dt><dd>${htmlSafe(R.received[1])}</dd></div>` : ''}<div><dt>Return window</dt><dd>${closes >= TODAY ? `Open until ${longDay(closes)}` : `Closed ${longDay(closes)}`}</dd></div>`;
	}

	/* Refund */
	function drawRefund() {
		const m = sums();
		const rows = `<dl class="rtd-sums"><div><dt>Items</dt><dd>${money(m.items)}</dd></div><div><dt>Tax</dt><dd>${m.tax ? money(m.tax) : 'None'}</dd></div><div><dt>Return shipping</dt><dd>Free</dd></div><div class="rtd-sums-total"><dt>${R.status === 'refunded' ? 'Refunded' : 'Refund'}</dt><dd>${money(m.cents)}</dd></div></dl>`;
		let tail;
		if (R.status === 'refunded') {
			el('refund-desc').textContent = `Paid back on ${longDay(R.refunded[0])}.`;
			tail = `<dl class="rtd-facts rtd-facts-after"><div><dt>Paid back</dt><dd>${htmlSafe(paidText(R.refunded[2]))}</dd></div><div><dt>By</dt><dd>${htmlSafe(R.refunded[1])}</dd></div></dl>`;
		} else if (R.status === 'declined') {
			el('refund-desc').textContent = `Declined on ${longDay(R.declined[0])} by ${R.declined[1]}.`;
			tail = `<div class="rtd-sent"><p>${htmlSafe(R.declined[2])}</p></div>`;
		} else {
			el('refund-desc').textContent =
				R.status === 'received'
					? 'The item is back and checked, so it can be paid.'
					: 'Paid once the item is back and checked.';
			tail = `<p class="rtd-hint">Goes back ${card ? `to the ${htmlSafe(card)}` : 'by bank transfer'}, or as store credit if ${htmlSafe(first(A.name))} prefers.</p>`;
		}
		el('refund').innerHTML = rows + tail;
	}

	/* Timeline */
	function drawSteps() {
		const st = [{ label: 'Requested', at: R.requested, who: A.name, icon: 'bi-chat-left-text' }];
		if (R.status === 'declined' && !R.approved) {
			st.push({ label: 'Declined', at: R.declined[0], who: R.declined[1], icon: 'bi-x-lg', declined: true });
		} else {
			st.push({
				label: 'Approved',
				at: R.approved && R.approved[0],
				who: R.approved && R.approved[1],
				icon: 'bi-check2',
			});
			st.push({
				label: 'Label sent',
				at: R.label && R.label.sent,
				who: R.label && R.label.carrier,
				icon: 'bi-printer',
			});
			st.push({ label: 'Received', at: R.received && R.received[0], who: SITE, icon: 'bi-box-seam' });
			if (R.status === 'declined')
				st.push({ label: 'Declined', at: R.declined[0], who: R.declined[1], icon: 'bi-x-lg', declined: true });
			else
				st.push({
					label: 'Refunded',
					at: R.refunded && R.refunded[0],
					who: R.refunded && R.refunded[1],
					icon: 'bi-arrow-counterclockwise',
				});
		}
		const nextAt = st.findIndex((x) => !x.at);
		const doneN = st.filter((x) => x.at).length;
		el('steps-desc').textContent = opened()
			? `${doneN} of ${st.length} steps done.`
			: `Closed ${longDay((R.refunded || R.declined)[0])}.`;
		el('steps').innerHTML = st
			.map((x, i) => {
				const cls = x.at ? 'is-done' : i === nextAt ? 'is-next' : 'is-todo';
				const sub = x.at
					? when(x.at) + (x.who ? ` · ${htmlSafe(x.who)}` : '')
					: i === nextAt
						? R.status === 'requested'
							? `Answer by ${day(approveBy)}`
							: 'Next'
						: 'Not yet';
				return `<li class="rtd-step ${cls}${x.declined ? ' is-declined' : ''}${fresh === x.label ? ' is-fresh' : ''}"><span class="rtd-step-marker" aria-hidden="true">${x.at ? `<i class="bi ${x.icon}"></i>` : i + 1}</span><span class="rtd-step-text"><span class="rtd-step-label">${x.label}</span><span class="rtd-quiet">${sub}</span></span></li>`;
			})
			.join('');
	}

	/**
	 * Grows the filled lines between done steps the first time the steps are
	 * on screen. Later repaints show them already drawn.
	 */
	function growSteps() {
		const trail = el('steps');
		let left = trail ? pickAll('.rtd-step.is-done:not(:last-child)', trail).length : 0;
		if (!left || !window.IntersectionObserver || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
			return;
		trail.classList.add('is-waiting');
		trail.addEventListener('animationend', function done(e) {
			if (e.animationName !== 'rtd-trail-grow' || --left) return;
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

	/* Return label */
	function drawLabel() {
		if (R.label) {
			el('label-desc').textContent = R.received
				? `Back at the ${SITE} on ${longDay(R.received[0])}.`
				: `On its way to the ${SITE}.`;
			el('label').innerHTML =
				`<dl class="rtd-facts"><div><dt>Carrier</dt><dd>${htmlSafe(R.label.carrier)}</dd></div><div><dt>Tracking</dt><dd><span class="rtd-sku">${htmlSafe(R.label.tracking)}</span>${copyButton(R.label.tracking, 'Copy tracking number')}</dd></div><div><dt>Sent</dt><dd>${when(R.label.sent)}</dd></div><div><dt>Back</dt><dd>${R.received ? when(R.received[0]) : 'Not yet'}</dd></div></dl>`;
			return;
		}
		if (R.status === 'approved') {
			el('label-desc').textContent = 'Approved, waiting for a label.';
			el('label').innerHTML =
				`<p class="rtd-none"><i class="bi bi-printer" aria-hidden="true"></i>Send a prepaid label so ${htmlSafe(first(A.name))} can post it back.</p><button type="button" class="btn btn-outline-secondary btn-sm rtd-label-btn" data-rtd-act="label"><i class="bi bi-printer me-1" aria-hidden="true"></i>Send label</button>`;
			return;
		}
		el('label-desc').textContent = '';
		el('label').innerHTML =
			`<p class="rtd-none"><i class="bi bi-info-circle" aria-hidden="true"></i>${R.status === 'declined' ? 'No label: the return was declined before anything was sent.' : 'A prepaid label goes out once the return is approved.'}</p>`;
	}

	/* Shopper */
	function drawShopper() {
		el('shopper-link').href = `shopper-details.html?id=${encodeURIComponent(A.id)}`;
		el('shopper').innerHTML =
			`<span class="basalt-avatar basalt-avatar-lg basalt-avatar-tone-${A.avatarTone}" aria-hidden="true">${initials(A.name)}</span><span class="rtd-who-text"><span class="rtd-who-name">${htmlSafe(A.name)}</span><span class="rtd-quiet">${TIER[A.tier]} tier · ${htmlSafe(A.city)}</span></span>`;
		const theirs = all.filter((r) => book.order(r.order).customer === A.name).length;
		el('shopper-facts').innerHTML =
			`<div><dt>Email</dt><dd><a class="rtd-link rtd-email" href="mailto:${htmlSafe(A.email)}">${htmlSafe(A.email)}</a></dd></div><div><dt>Orders</dt><dd>${A.orders} since ${MONTHS_LONG[parse(A.joinedOn).getMonth()]} ${parse(A.joinedOn).getFullYear()}</dd></div><div><dt>Spent</dt><dd>$${A.lifetimeValue.toLocaleString('en-US')}</dd></div><div><dt>Returns</dt><dd>${plural(theirs, 'return')} since September</dd></div>`;
	}

	function drawAll() {
		drawHead();
		drawItems();
		drawRefund();
		drawSteps();
		drawLabel();
		drawShopper();
	}

	/* Actions */
	const labelNode = pick('#rtd-label');
	const recEl = pick('#rtd-received');
	const refEl = pick('#rtd-refund');
	const decEl = pick('#rtd-decline');

	function show(m) {
		return bootstrap.Modal.getOrCreateInstance(m).show();
	}

	function hide(m) {
		return bootstrap.Modal.getOrCreateInstance(m).hide();
	}

	function done(step, title, text) {
		fresh = step;
		drawAll();
		toast({ tone: 'success', icon: 'bi-check2-circle', title, text });
		announce(title);
	}

	document.addEventListener('click', (e) => {
		const cp = e.target.closest('[data-rtd-copy]');
		if (cp) {
			const t = cp.getAttribute('data-rtd-copy');
			if (window.Basalt.copyText) window.Basalt.copyText(t);
			toast({ tone: 'success', icon: 'bi-copy', title: 'Copied', text: t });
			return;
		}
		const b = e.target.closest('[data-rtd-act]');
		if (!b) return;
		const act = b.getAttribute('data-rtd-act');
		if (act === 'approve') {
			R.status = 'approved';
			R.approved = [now(), ME];
			done('Approved', `${R.id} approved`, `Next, send ${first(A.name)} a prepaid label.`);
		} else if (act === 'label') show(labelNode);
		else if (act === 'received') show(recEl);
		else if (act === 'refund') show(refEl);
		else if (act === 'decline') show(decEl);
		else if (act === 'copy') {
			if (window.Basalt.copyText) window.Basalt.copyText(`${location.origin + location.pathname}?id=${R.id}`);
			toast({
				tone: 'success',
				icon: 'bi-link-45deg',
				title: 'Link copied',
				text: `return-details.html?id=${encodeURIComponent(R.id)}`,
			});
		} else if (act === 'print') window.print();
	});

	/* Send label */
	function lf(n) {
		return pick(`[data-rtd-l="${n}"]`, labelNode);
	}

	const CARRIER_ICON = {
		UPS: 'bi-truck',
		FedEx: 'bi-airplane',
		'DHL Express': 'bi-lightning-charge',
		USPS: 'bi-envelope',
	};
	function tracking(carrier) {
		const rnd = book.seeded(R.id + carrier);

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
	start();
})();
