/**
 * Basalt - Income (income.html)
 * Three views of the money coming in: what reached the bank in October,
 * split by source with each source's January to September trend, the
 * invoices still waiting to be paid, and every October payment, which
 * opens in a drawer.
 *
 * The month totals for January to September are in DEMO below. SMS
 * and extras is what accounts bought outside their plan before tax:
 * SMS credit packs, extra phone lines and storage. The unpaid invoices
 * and October's payments come from the shared billing book
 * (window.Basalt.data.billing, assets/basalt/js/data/multipurpose/billing.js), the same
 * invoices and payments as on the Invoices and Receipts pages, with the
 * refunds on purchases. In a real app, replace it with your billing
 * system's data and keep the shapes.
 */
(() => {
	'use strict';
	const root = pick('[data-earn-root]');
	const billing = window.Basalt.data && window.Basalt.data.billing;
	if (!root || !billing) return;

	/* Demo data */
	const DEMO = {
		/* The demo's "today". A deployed page would use new Date(). */
		today: '2026-10-09',
		sources: {
			plans: { label: 'Plans and add-ons' },
			extras: { label: 'SMS and extras' },
			onboarding: { label: 'Onboarding and training' },
		},
		/* Received from September 1 to 9, for the comparison under October's total. */
		sameDaysLastMonth: 742600,
		earned: {
			plans: [757000, 766400, 784900, 802600, 808100, 825600, 851500, 860300, 876700],
			extras: [28400, 30900, 36200, 33700, 35800, 39400, 34600, 29300, 37200],
			onboarding: [31200, 34800, 42600, 36900, 38400, 44700, 35100, 39600, 45800],
		},
		/* Invoices sent and not paid yet, oldest due date first. */
		unpaid: [],
		/* Payments in October. status: received, clearing (money on its
       way to the bank) or refunded. ref.kind: invoice, purchase or batch
       (the monthly card run, which pays many accounts at once). Each
       line is [name, detail, amount]. */
		payments: [
			{
				date: '2026-10-01',
				who: 'Card renewals',
				what: '1,824 accounts on monthly plans',
				src: 'plans',
				status: 'received',
				method: 'card',
				ref: { kind: 'batch', no: 'October run' },
				batch: true,
				lines: [
					['Basic plan', '1,040 accounts', 121440],
					['Pro plan', '642 accounts', 318976],
					['Max plan', '142 accounts', 302464],
				],
			},
		],
	};

	/* From the billing book */
	const MONTH_START = `${DEMO.today.slice(0, 8)}01`;

	function start() {
		for (const b of pickAll('[data-earn-record-open]', root)) {
			b.addEventListener('click', () => {
				resetForm();
				if (modal) modal.show();
			});
		}

		dialogNode.addEventListener('shown.bs.modal', () => f('who').focus());
		form.addEventListener('input', (e) => {
			if (e.target.classList.contains('is-invalid')) e.target.classList.remove('is-invalid');
		});
		form.addEventListener('submit', (e) => {
			e.preventDefault();
			const who = f('who').value.trim();
			const amount = Math.round(parseFloat(f('amount').value.replace(/[$,\s]/g, '')) * 100) / 100;
			const date = f('date').value;
			const bad = [];
			if (!who) bad.push(f('who'));
			if (!(amount > 0)) bad.push(f('amount'));
			if (!date || date < f('date').min || date > f('date').max) bad.push(f('date'));

			for (const el of pickAll('.is-invalid', form)) {
				el.classList.remove('is-invalid');
			}

			if (bad.length) {
				for (const el of bad) {
					el.classList.add('is-invalid');
				}

				bad[0].focus();
				return;
			}
			const src = pick('input[name="incRecSource"]:checked', form).value;
			const method = f('method').value;
			const ref = f('ref').value.trim().toUpperCase();
			const p = {
				id: upcomingId++,
				date,
				who,
				what: DEMO.sources[src].label,
				src,
				status: 'received',
				method,
				ref: { kind: 'invoice', no: ref || 'No invoice' },
				lines: [[DEMO.sources[src].label, 'Recorded by John Armstrong', amount]],
				amount,
			};
			payments.push(p);
			state.q = '';
			state.src = 'all';
			state.sort = 'date';
			state.dir = 'desc';
			els.search.value = '';
			els.source.value = 'all';
			if (modal) modal.hide();
			drawMonth();
			drawLog(p.id);
			toast({
				tone: 'success',
				icon: 'bi-cash-coin',
				title: `${money(amount)} recorded`,
				text: `${who}, ${METHOD[method]} on ${day(date)}.`,
			});
		});

		/* Export */
		pick('[data-earn-export]', root).addEventListener('click', () => {
			toast({
				tone: 'success',
				icon: 'bi-download',
				title: 'Export started',
				text: `October’s ${plural(payments.length, 'payment')} will download as a CSV file.`,
			});
		});

		/* Start */
		drawMonth();
		drawDue();
		drawLog();
	}

	function cents(n) {
		return Math.round(n * 100) / 100;
	}

	/* Working days for money to reach the bank, as on the Receipts page. */
	const BANK_DAYS = { card: 2, ach: 2, wire: 0, check: 3 };
	function bankDay(at, method) {
		const d = new Date(`${at.slice(0, 10)}T00:00:00`);
		let left = BANK_DAYS[method];
		while (left > 0) {
			d.setDate(d.getDate() + 1);
			if (d.getDay() % 6) left -= 1;
		}
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}
	/* What a purchase came to, line by line, then its tax. */
	function purchaseLines(p) {
		const out = p.lines.map((l) => [
			l.name,
			`${l.qty} at $${l.unit.toLocaleString('en-US')}`,
			cents(l.qty * l.unit),
		]);
		if (p.tax && p.tax.amount) out.push(['Tax', p.tax.label, p.tax.amount]);
		return out;
	}

	function srcOf(p) {
		return p.kind === 'service' ? 'onboarding' : 'extras';
	}

	const invoices = billing.invoices();

	for (const v of invoices.filter((v) => v.state === 'sent').sort((x, y) => x.due.localeCompare(y.due))) {
		DEMO.unpaid.push({ who: v.customer, ref: v.no, due: v.due, amount: v.amount });
	}

	billing.payments().forEach((pay) => {
		if (pay.state !== 'ok' && pay.state !== 'disputed') return;
		if (pay.at.slice(0, 10) < MONTH_START) return;
		const row = {
			date: pay.at.slice(0, 10),
			who: pay.customer,
			status: bankDay(pay.at, pay.method) > DEMO.today ? 'clearing' : 'received',
			method: pay.method === 'card' ? 'card' : 'transfer',
			account: pay.acct,
		};
		if (pay.method === 'card') row.card = pay.from.slice(-4);
		if (pay.for[0] === 'invoice') {
			const v = invoices.find((x) => x.no === pay.for[1]);
			const o = v.purchase ? billing.purchase(v.purchase) : null;
			Object.assign(row, {
				what: v.item,
				src: o ? srcOf(o) : 'plans',
				ref: { kind: 'invoice', no: v.no },
				sent: v.issued,
			});
			row.lines = v.lines.map((l) => [l.name, l.desc, cents(l.qty * l.unit)]);
			if (v.tax && v.tax.amount) row.lines.push(['Tax', v.tax.label, v.tax.amount]);
		} else {
			const o = billing.purchase(pay.for[1]);
			Object.assign(row, {
				what: o.item.replace(/ and \d+ more$/, ' and more'),
				src: srcOf(o),
				ref: { kind: 'purchase', no: o.no },
			});
			row.lines = purchaseLines(o);
		}
		DEMO.payments.push(row);
	});
	/* Money paid back this month on purchases. */
	billing.refunds().forEach((r) => {
		if (r.on < MONTH_START) return;
		const lines = r.lines.map((l) => [`${l.name}, refunded`, l.desc, -l.amount]);
		if (r.tax && r.tax.amount) lines.push(['Tax', r.tax.label, -r.tax.amount]);
		DEMO.payments.push({
			date: r.on,
			who: r.customer,
			what: r.reason,
			src: r.kind === 'service' ? 'onboarding' : 'extras',
			status: 'refunded',
			method: r.card ? 'card' : 'transfer',
			card: r.card,
			ref: { kind: 'purchase', no: r.no },
			account: r.acct,
			lines,
		});
	});
	DEMO.payments.sort((x, y) => y.date.localeCompare(x.date));

	/* Small helpers */
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

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function announce(t) {
		if (window.Basalt.announce) window.Basalt.announce(t);
	}
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DAY = 86400000;

	function toDate(s) {
		return new Date(`${s}T00:00:00`);
	}

	const today = toDate(DEMO.today);
	function day(s) {
		const d = toDate(s);
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function money(n) {
		return `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function whole(n) {
		return `$${Math.round(n).toLocaleString('en-US')}`;
	}

	function short(n) {
		if (n >= 1e6) return `$${(n / 1e6).toFixed(2).replace(/0$/, '')}M`;
		if (n >= 1e3) return `$${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
		return whole(n);
	}

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many || `${one}s`}`;
	}

	const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

	function words(n, one, many) {
		return `${WORDS[n] || n} ${n === 1 ? one : many || `${one}s`}`;
	}

	function cap(s) {
		return s.charAt(0).toUpperCase() + s.slice(1);
	}

	function initials(name) {
		return name
			.replace(/[^A-Za-z ]/g, '')
			.split(' ')
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0])
			.join('')
			.toUpperCase();
	}

	function toneOf(name) {
		return (Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0) % 6) + 1;
	}

	function total(p) {
		return p.lines.reduce((s, l) => s + l[2], 0);
	}

	const STATUS = {
		received: { word: 'Received', tone: 'success' },
		clearing: { word: 'Clearing', tone: 'warning' },
		refunded: { word: 'Refunded', tone: 'info' },
	};
	const SRC_KEYS = Object.keys(DEMO.sources);

	let upcomingId = 1;
	const payments = DEMO.payments.map((p) => Object.assign({ id: upcomingId++, amount: total(p) }, p));

	/* Received in October */
	const SRC_ICON = { plans: 'bi-arrow-repeat', extras: 'bi-chat-dots', onboarding: 'bi-mortarboard' };
	const dueTotal = DEMO.unpaid.reduce((s, i) => s + i.amount, 0);

	function isIn(p) {
		return p.status !== 'clearing';
	}

	/* A line through the nine months, scaled to its own range so the shape shows. */
	function spark(values) {
		const w = 120,
			h = 36,
			pad = 3;
		const lo = Math.min(...values),
			hi = Math.max(...values);
		const pts = values.map((v, i) =>
			[(i / (values.length - 1)) * w, pad + (1 - (v - lo) / (hi - lo || 1)) * (h - pad * 2)].map(
				(n) => Math.round(n * 10) / 10,
			),
		);
		const line = `M${pts.map((pt) => pt.join(' ')).join(' L')}`;
		const end = pts[pts.length - 1];
		return `<svg class="earn-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path class="earn-spark-area" d="${line} L${w} ${h} L0 ${h} Z"/><path class="earn-spark-line" d="${line}" vector-effect="non-scaling-stroke"/></svg><span class="earn-spark-dot" style="top:${Math.round((end[1] / h) * 100)}%" aria-hidden="true"></span>`;
	}
	function drawMonth() {
		const got = payments.filter(isIn);
		const received = got.reduce((s, p) => s + p.amount, 0);
		const clearing = payments.filter((p) => !isIn(p));
		const change = ((received - DEMO.sameDaysLastMonth) / DEMO.sameDaysLastMonth) * 100;
		pick('[data-earn-received]', root).textContent = whole(received);
		const delta = pick('[data-earn-delta]', root);
		delta.className = `earn-delta earn-delta-${change >= 0 ? 'up' : 'down'}`;
		delta.innerHTML = `<i class="bi ${change >= 0 ? 'bi-arrow-up-right' : 'bi-arrow-down-right'}" aria-hidden="true"></i>${change >= 0 ? '+' : '−'}${Math.abs(change).toFixed(1)}% on September 1 to 9`;
		pick('[data-earn-clearing]', root).innerHTML = clearing.length
			? `<span class="earn-month-wait" aria-hidden="true"></span>Another <strong>${whole(clearing.reduce((s, p) => s + p.amount, 0))}</strong> is on its way by bank transfer.`
			: 'Nothing is waiting to clear.';
		pick('[data-earn-sources]', root).innerHTML = SRC_KEYS.map((k) => {
			const mine = got.filter((p) => p.src === k);
			const months = DEMO.earned[k];
			const year = months.reduce((a, b) => a + b, 0);
			return `<li class="earn-source earn-src-${k}"><span class="earn-source-icon" aria-hidden="true"><i class="bi ${SRC_ICON[k]}"></i></span><span class="earn-source-text"><span class="earn-source-name">${htmlSafe(DEMO.sources[k].label)}</span><span class="earn-sub">${short(year)} since January</span></span><span class="earn-source-trend" role="img" aria-label="Earned each month from January to September: ${short(months[0])} in January, ${short(months[months.length - 1])} in September">${spark(months)}</span><span class="earn-source-amt"><span class="earn-source-value">${whole(mine.reduce((s, p) => s + p.amount, 0))}</span><span class="earn-sub">${plural(mine.length, 'payment')}</span></span></li>`;
		}).join('');
		const run = got.find((p) => p.batch);
		pick('[data-earn-run]', root).textContent = run
			? `Most of it is the ${day(run.date)} card run: ${whole(run.amount)} from ${run.what.split(' on ')[0]}.`
			: '';
	}

	/* Waiting for payment */
	const SHOWN_DUE = 5;

	function overdue() {
		return DEMO.unpaid.filter((i) => toDate(i.due) < today);
	}

	function drawDue() {
		const late = overdue();
		const lateSum = late.reduce((s, i) => s + i.amount, 0);
		pick('[data-earn-due-sum]', root).innerHTML =
			`<strong>${whole(dueTotal)}</strong> on ${words(DEMO.unpaid.length, 'invoice')}${late.length ? `, ${whole(lateSum)} of it overdue.` : '.'}`;
		pick('[data-earn-due]', root).innerHTML = DEMO.unpaid
			.slice(0, SHOWN_DUE)
			.map((i) => {
				const days = Math.round((today - toDate(i.due)) / DAY);
				const when =
					days > 0
						? `<span class="earn-due-late">${plural(days, 'day')} overdue</span>`
						: days === 0
							? 'Due today'
							: `Due ${day(i.due)}`;
				return `<li><a class="earn-due-row" href="invoice-details.html?id=${encodeURIComponent(i.ref)}"><span class="basalt-avatar basalt-avatar-sm basalt-avatar-tone-${toneOf(i.who)}" aria-hidden="true">${htmlSafe(initials(i.who))}</span><span class="earn-due-text"><span class="earn-due-name">${htmlSafe(i.who)}</span><span class="earn-due-meta">${htmlSafe(i.ref)} · ${when}</span></span><span class="earn-due-amt">${whole(i.amount)}</span></a></li>`;
			})
			.join('');
		const rest = DEMO.unpaid.slice(SHOWN_DUE);
		pick('[data-earn-due-more]', root).textContent = rest.length
			? `${cap(WORDS[rest.length] || String(rest.length))} more, ${whole(rest.reduce((s, i) => s + i.amount, 0))}, due later in October.`
			: '';
	}
	const remindBtn = pick('[data-earn-remind]', root);
	remindBtn.addEventListener('click', () => {
		const late = overdue();
		remindBtn.disabled = true;
		remindBtn.innerHTML = '<i class="bi bi-check2 me-1" aria-hidden="true"></i>Reminded today';
		toast({
			tone: 'success',
			icon: 'bi-bell',
			title: 'Reminders sent',
			text: `${late
				.map((i) => i.who)
				.join(', ')
				.replace(/, ([^,]*)$/, ' and $1')} got a reminder with a link to pay.`,
		});
	});

	/* Payment log */
	const PAGE = 8;
	const els = {
		body: pick('[data-earn-body]', root),
		wrap: pick('[data-earn-table-wrap]', root),
		search: pick('[data-earn-search]', root),
		source: pick('[data-earn-source]', root),
		count: pick('[data-earn-count]', root),
		empty: pick('[data-earn-empty]', root),
		moreWrap: pick('[data-earn-more-wrap]', root),
		more: pick('[data-earn-more]', root),
		moreLabel: pick('[data-earn-more-label]', root),
	};
	const state = { q: '', src: 'all', sort: 'date', dir: 'desc', limit: PAGE };
	let shown = [];
	let pickedId = null;

	function matches(p) {
		if (state.src !== 'all' && p.src !== state.src) return false;
		if (!state.q) return true;
		const hay = `${p.who} ${p.what} ${p.ref.no} ${p.lines.map((l) => l[0]).join(' ')}`.toLowerCase();
		return state.q
			.toLowerCase()
			.split(/\s+/)
			.every((w) => hay.includes(w.replace(/^#/, '')));
	}
	function sorted(list) {
		const dir = state.dir === 'asc' ? 1 : -1;
		return list.slice().sort((a, b) => {
			const d = state.sort === 'amount' ? a.amount - b.amount : a.date.localeCompare(b.date) || a.id - b.id;
			return d * dir;
		});
	}
	function mark(p, size) {
		if (p.batch)
			return `<span class="basalt-avatar earn-mark earn-mark-batch${size ? ` ${size}` : ''} basalt-avatar-tone-1" aria-hidden="true"><i class="bi bi-arrow-repeat"></i></span>`;
		return `<span class="basalt-avatar earn-mark${size ? ` ${size}` : ''} basalt-avatar-tone-${toneOf(p.who)}" aria-hidden="true">${htmlSafe(initials(p.who))}</span>`;
	}
	function pill(p) {
		const s = STATUS[p.status];
		return `<span class="basalt-status basalt-status-dot basalt-status-${s.tone}">${s.word}</span>`;
	}
	function drawSortHeads() {
		for (const th of pickAll('[data-earn-th]', root)) {
			const key = th.getAttribute('data-earn-th');
			const icon = pick('.bi', th);
			if (key === state.sort) {
				th.setAttribute('aria-sort', state.dir === 'asc' ? 'ascending' : 'descending');
				icon.className = `bi ${state.dir === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down'}`;
			} else {
				th.removeAttribute('aria-sort');
				icon.className = 'bi bi-arrow-down-up earn-sort-idle';
			}
		}
	}
	function drawLog(freshId) {
		const all = sorted(payments.filter(matches));
		shown = all.slice(0, state.limit);
		const none = !all.length;
		els.wrap.hidden = none;
		els.empty.hidden = !none;
		els.count.textContent = none
			? ''
			: all.length === payments.length
				? plural(all.length, 'payment')
				: `${all.length} of ${payments.length} payments`;
		els.body.innerHTML = shown
			.map((p) => {
				const sub =
					htmlSafe(p.what) + (p.batch ? '' : ` · <span class="earn-ref">${htmlSafe(p.ref.no)}</span>`);
				return `<tr class="earn-row${p.id === pickedId ? ' is-selected' : ''}${p.id === freshId ? ' is-fresh' : ''}" data-earn-id="${p.id}"><td class="earn-col-who"><div class="earn-who">${mark(p)}<div class="earn-who-text"><button type="button" class="earn-who-name" data-earn-open="${p.id}">${htmlSafe(p.who)}</button><span class="earn-sub">${sub}</span></div></div></td><td class="earn-col-src"><span class="earn-src earn-src-${p.src}">${htmlSafe(DEMO.sources[p.src].label)}</span><span class="earn-row-date">${day(p.date)}</span></td><td class="earn-col-date"><span class="earn-date">${day(p.date)}</span></td><td class="earn-col-status">${pill(p)}</td><td class="earn-col-amt"><span class="earn-amt${p.amount < 0 ? ' earn-amt-out' : ''}">${money(p.amount)}</span></td><td class="earn-col-go"><span class="earn-go" aria-hidden="true"><i class="bi bi-chevron-right"></i></span></td></tr>`;
			})
			.join('');
		const left = all.length - shown.length;
		els.moreWrap.hidden = left <= 0;
		els.moreLabel.textContent = `Show ${Math.min(left, PAGE)} more`;
		drawSortHeads();
	}

	let typing;
	els.search.addEventListener('input', () => {
		clearTimeout(typing);
		typing = setTimeout(() => {
			state.q = els.search.value.trim();
			state.limit = PAGE;
			drawLog();
		}, 160);
	});
	els.source.addEventListener('change', () => {
		state.src = els.source.value;
		state.limit = PAGE;
		drawLog();
	});
	pick('[data-earn-clear]', root).addEventListener('click', () => {
		els.search.value = '';
		els.source.value = 'all';
		state.q = '';
		state.src = 'all';
		drawLog();
		els.search.focus();
	});
	els.more.addEventListener('click', () => {
		const before = shown.length;
		window.Basalt.slide(els.wrap, () => {
			state.limit += PAGE;
			drawLog();
		});
		const next = pickAll('.earn-row', els.body)[before];
		if (next) pick('.earn-who-name', next).focus();
		announce(`Showing ${shown.length} payments`);
	});

	for (const b of pickAll('[data-earn-sort]', root)) {
		b.addEventListener('click', () => {
			const key = b.getAttribute('data-earn-sort');
			if (state.sort === key) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
			else {
				state.sort = key;
				state.dir = 'desc';
			}
			drawLog();
		});
	}

	/* One payment, in the drawer */
	const sheetNode = document.getElementById('earn-drawer');
	const drawer = window.bootstrap ? bootstrap.Offcanvas.getOrCreateInstance(sheetNode) : null;

	function d(k) {
		return pick(`[data-earn-d="${k}"]`, sheetNode);
	}

	const METHOD = { card: 'card', transfer: 'bank transfer', check: 'check' };
	const ACCOUNT = 'the Operating Account ···5182';
	function shiftDays(s, n) {
		const t = toDate(s);
		t.setDate(t.getDate() + n);
		return t.toISOString().slice(0, 10);
	}
	function lead(p) {
		const amt = `<strong>${money(Math.abs(p.amount))}</strong>`;
		if (p.status === 'refunded') return `${amt} went back to the card ending ${p.card} on ${day(p.date)}.`;
		if (p.status === 'clearing')
			return `${amt} sent by bank transfer on ${day(p.date)}, expected in ${ACCOUNT} by ${day(shiftDays(p.date, 3))}.`;
		if (p.batch)
			return `${amt} charged to cards on ${day(p.date)} for every account on a monthly plan, paid into ${ACCOUNT}.`;
		if (p.method === 'card') {
			const fee = Math.round((p.amount * 0.029 + 0.3) * 100) / 100;
			return `${amt} paid by ${p.card ? `the card ending ${p.card}` : 'card'} on ${day(p.date)}. ${money(fee)} went on the card fee.`;
		}
		return `${amt} paid by ${METHOD[p.method]} on ${day(p.date)} into ${ACCOUNT}.`;
	}
	function steps(p) {
		const out = [];
		if (p.ref.kind === 'purchase') out.push(['Bought in the Fieldline app', day(p.date)]);
		if (p.ref.kind === 'invoice' && p.sent) out.push([`Invoice ${p.ref.no} sent`, day(p.sent)]);
		if (p.batch) out.push(['Renewal emails sent', day(shiftDays(p.date, -3))]);
		if (p.status === 'refunded') {
			out.push(['Refund approved by John Armstrong', day(p.date)]);
			out.push(['Back on the customer’s card', 'Usually 5 to 10 days', 'back']);
		} else if (p.status === 'clearing') {
			out.push([`Transfer started by ${p.who}`, day(p.date)]);
			out.push(['In the bank', `Expected ${day(shiftDays(p.date, 3))}`, 'wait']);
		} else {
			out.push([p.method === 'card' ? 'Card charged' : 'Payment received', day(p.date)]);
			out.push(['In the bank', day(shiftDays(p.date, p.method === 'card' ? 2 : 0))]);
		}
		return out;
	}
	function paintSheet(p) {
		const m = d('mark');
		m.className = `basalt-avatar earn-mark earn-mark-lg basalt-avatar-tone-${p.batch ? 1 : toneOf(p.who)}${p.batch ? ' earn-mark-batch' : ''}`;
		m.innerHTML = p.batch ? '<i class="bi bi-arrow-repeat"></i>' : htmlSafe(initials(p.who));
		d('name').textContent = p.who;
		d('sub').textContent =
			`${p.batch ? 'Monthly plans' : (p.ref.kind === 'purchase' ? 'Order ' : '') + p.ref.no} · ${day(p.date)} 2026`;
		d('status').innerHTML = pill(p);
		d('lead').innerHTML = lead(p);
		const lines = p.lines.map(
			(l) =>
				`<li class="earn-line"><span class="earn-line-text"><span class="earn-line-name">${htmlSafe(l[0])}</span><span class="earn-sub">${htmlSafe(l[1])}</span></span><span class="earn-line-amt">${money(l[2])}</span></li>`,
		);
		if (p.lines.length > 1)
			lines.push(
				`<li class="earn-line earn-line-total"><span class="earn-line-text"><span class="earn-line-name">Total</span></span><span class="earn-line-amt">${money(p.amount)}</span></li>`,
			);
		d('lines').innerHTML = lines.join('');
		d('steps').innerHTML = steps(p)
			.map(
				(s) =>
					`<li class="earn-step${s[2] ? ` earn-step-${s[2]}` : ''}"><span class="earn-step-what">${htmlSafe(s[0])}</span><span class="earn-step-when">${htmlSafe(s[1])}</span></li>`,
			)
			.join('');
		const customer = d('customer');
		customer.hidden = !p.account;
		if (p.account) customer.href = `company-details.html?id=${encodeURIComponent(p.account)}`;
		const open = d('open');
		if (p.batch) {
			open.href = 'subscriptions.html';
			open.textContent = 'Open subscriptions';
		} else if (p.ref.kind === 'purchase') {
			open.href = `company-details.html?id=${encodeURIComponent(p.account)}`;
			open.textContent = 'Open account';
		} else {
			open.href = `invoice-details.html?id=${encodeURIComponent(p.ref.no)}`;
			open.textContent = 'Open invoice';
		}
		pickedId = p.id;

		for (const r of pickAll('.earn-row', els.body)) {
			r.classList.toggle('is-selected', +r.getAttribute('data-earn-id') === p.id);
		}
	}
	/* Stepping follows the payments the visitor can see, in their order. */
	let navList = [];
	const nav = window.Basalt.drawer
		? window.Basalt.drawer.recordNav(sheetNode, { valueOf: () => Math.max(1, navList.length) }, (i) => {
				if (navList[i]) paintSheet(navList[i]);
			})
		: null;
	function openPayment(id) {
		navList = shown.slice();
		const i = navList.findIndex((p) => p.id === id);
		if (i < 0 || !drawer) return;
		if (nav) nav.go(i, 0);
		else paintSheet(navList[i]);
		pick('.basalt-drawer-nav', sheetNode).hidden = navList.length < 2;
		drawer.show();
	}
	els.body.addEventListener('click', (e) => {
		const row = e.target.closest('.earn-row');
		if (row) openPayment(+row.getAttribute('data-earn-id'));
	});

	/* Toasts move to the middle while the drawer is open, so they don't cover its buttons. */
	function toastsAt(where) {
		if (window.Basalt.toasts && window.Basalt.toasts.position) window.Basalt.toasts.position(where);
	}

	sheetNode.addEventListener('show.bs.offcanvas', () => toastsAt('bottom-center'));
	sheetNode.addEventListener('shown.bs.offcanvas', () => d('name').focus());
	sheetNode.addEventListener('hidden.bs.offcanvas', () => {
		toastsAt('bottom-end');
		const row = pickedId && pick(`.earn-row[data-earn-id="${pickedId}"]`, els.body);
		pickedId = null;

		for (const r of pickAll('.earn-row', els.body)) {
			r.classList.remove('is-selected');
		}

		if (row) pick('.earn-who-name', row).focus();
	});

	/* Record income */
	const dialogNode = document.getElementById('earn-record');
	const modal = window.bootstrap ? bootstrap.Modal.getOrCreateInstance(dialogNode) : null;
	const form = pick('[data-earn-form]', dialogNode);

	function f(k) {
		return pick(`[data-earn-f="${k}"]`, form);
	}

	function resetForm() {
		form.reset();

		for (const el of pickAll('.is-invalid', form)) {
			el.classList.remove('is-invalid');
		}
	}

	start();
})();
