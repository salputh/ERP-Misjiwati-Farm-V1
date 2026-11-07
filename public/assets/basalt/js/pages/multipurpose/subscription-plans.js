/**
 * Basalt - Subscription Plans
 * Fieldline's plans side by side, cheapest first, with the add-ons
 * sold on top. Free comes last and is followed by accounts rather
 * than revenue, as it pays nothing. Clicking a plan, its name, the expand
 * icon or the quick view's button opens plan-details.html?id=<plan>;
 * the panel icon opens a quick view of it. Everything comes from
 * assets/basalt/js/data/multipurpose/plans.js, the same record Plan Details reads.
 */
(() => {
	'use strict';
	const root = pick('[data-spl-root]');
	if (!root || !window.Basalt.data || !window.Basalt.data.plans) return;

	const D = window.Basalt.data.plans;
	const A = window.Basalt.data.accounts;

	function start() {
		drawer.addEventListener('shown.bs.offcanvas', () => d('title').focus());
		drawer.addEventListener('hidden.bs.offcanvas', () => {
			const id = state.open;
			state.open = null;

			for (const c of pickAll('.is-open', plansBox)) {
				c.classList.remove('is-open');
			}

			try {
				history.replaceState(null, '', location.pathname + location.search);
			} catch {
				/* file:// */
			}
			const btn = id && pick(`[data-spl-open="${id}"]`, plansBox);
			if (btn) btn.focus({ preventScroll: true });
		});

		/* Draw */
		drawPlans();
		drawAddOns();
		/* A link to subscription-plans.html#growth opens that plan's quick view. */
		const hash = location.hash.slice(1);
		if (hash && D.plans.some((p) => p.id === hash)) openPlan(hash);
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

	function htmlSafe(v) {
		return String(v).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function num(n) {
		return Math.round(n).toLocaleString('en-US');
	}

	function money(n) {
		return `$${num(n)}`;
	}

	function cents(n) {
		return `$${Number.isInteger(n) ? String(n) : n.toFixed(2)}`;
	}

	/* $361k, $41.2k */
	function short(n) {
		return n >= 100000
			? `$${Math.round(n / 1000)}k`
			: n >= 1000
				? `$${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
				: money(n);
	}

	function tone(p) {
		return `style="--spl-tone: var(--basalt-series-${p.tone})"`;
	}

	function detailUrl(p) {
		return `plan-details.html?id=${encodeURIComponent(p.id)}`;
	}

	const T = D.totals();

	function isFree(p) {
		return p.price === 0;
	}

	/* How MRR moved against the month before, from the plan's trend;
     for Free, how its accounts moved. */
	function change(p) {
		const t = isFree(p) ? D.counts(p) : D.trend(p);
		return (t[t.length - 1] / t[t.length - 2] - 1) * 100;
	}

	function movedUp(p) {
		return p.moves.out.filter((m) => /^Up to/.test(m[0])).reduce((n, m) => n + m[1], 0);
	}

	function changeHtml(pct, against, unit) {
		const r = Math.round(pct * 10) / 10;
		const kind = r > 0 ? 'up' : r < 0 ? 'down' : 'flat';
		const icon = kind === 'up' ? 'bi-arrow-up-right' : kind === 'down' ? 'bi-arrow-down-right' : 'bi-dash';
		const sign = r > 0 ? '+' : r < 0 ? '−' : '';
		return `<span class="spl-change spl-change-${kind}"><i class="bi ${icon}" aria-hidden="true"></i>${sign}${Math.abs(r).toFixed(1)}%${unit ? ` ${unit}` : ''}${against ? ` vs ${against}` : ''}</span>`;
	}

	/* Plan cards */
	const plansBox = pick('[data-spl-plans]', root);
	const state = { open: null };

	function cardHtml(p) {
		const share = (p.mrr / T.mrr) * 100;
		const free = isFree(p);
		return `<li${free ? ' class="spl-plans-free"' : ''}><article class="card basalt-box spl-plan spl-tone${free ? ' spl-plan-free' : ''}${state.open === p.id ? ' is-open' : ''}" ${tone(p)} data-spl-id="${p.id}" aria-labelledby="spl-plan-${p.id}"><div class="spl-plan-head"><span class="spl-plan-icon" aria-hidden="true"><i class="bi ${p.icon}"></i></span><h3 class="spl-plan-name" id="spl-plan-${p.id}"><a href="${detailUrl(p)}">${htmlSafe(p.name)}</a></h3><span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-spl-open="${p.id}" aria-label="Quick view: ${htmlSafe(p.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${detailUrl(p)}" aria-label="Open full page: ${htmlSafe(p.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span></div><div class="spl-plan-pricebox"><p class="spl-plan-price"><span class="spl-plan-amount">${cents(p.price)}</span><span class="spl-plan-per">${free ? 'for good, no card' : 'a seat a month'}</span></p><p class="spl-plan-yearly">${free ? `Up to ${p.seatLimit} people and ${p.visitLimit} visits a month` : `${cents(D.yearly(p))} a month when paid yearly`}</p></div><p class="spl-plan-blurb">${htmlSafe(p.blurb)}</p><ul class="spl-includes" aria-label="Included in ${htmlSafe(p.name)}">${p.includes.map((x) => `<li><i class="bi bi-check2" aria-hidden="true"></i>${htmlSafe(x[1])}</li>`).join('')}</ul><div class="spl-plan-bottom"><dl class="spl-plan-figs"><div class="spl-fig"><dt>Accounts</dt><dd>${num(p.accounts)}</dd></div><div class="spl-fig"><dt>${free ? 'People' : 'Seats'}</dt><dd>${num(p.seats)}</dd></div>${free ? `<div class="spl-fig"><dt>Moved up</dt><dd>${num(movedUp(p))}</dd></div>` : `<div class="spl-fig"><dt>A month</dt><dd>${short(p.mrr)}</dd></div>`}</dl><div class="spl-share">${free ? `<p class="spl-share-text mb-0"><span>Pays nothing</span>${changeHtml(change(p), D.prevMonth, 'accounts')}</p>` : `<div class="spl-share-bar" aria-hidden="true"><span data-spl-w="${share.toFixed(1)}%"></span></div><p class="spl-share-text mb-0"><span>${Math.round(share)}% of revenue</span>${changeHtml(change(p), D.prevMonth)}</p>`}</div></div></article></li>`;
	}

	function drawPlans() {
		disposeTips(plansBox);
		/* Paid plans first; Free closes the list as it earns nothing. */
		plansBox.innerHTML = [...D.plans.filter((p) => !isFree(p)), ...D.plans.filter(isFree)].map(cardHtml).join('');
		if (window.Basalt.tips) window.Basalt.tips(plansBox);
		const bars = pickAll('[data-spl-w]', plansBox);

		function fill() {
			return bars.forEach((b) => b.style.setProperty('--spl-w', b.dataset.splW));
		}

		if (reduce.matches || drawPlans.done) fill();
		else requestAnimationFrame(() => requestAnimationFrame(fill));
		drawPlans.done = true;
	}

	/* The panel icon opens the quick view. A click anywhere else on a card,
     apart from its links, opens the plan's full page, and the middle button
     or Cmd/Ctrl opens it in a new tab, as a link would. */
	function cardClick(e) {
		if (e.button > 1 || e.target.closest('a')) return;
		const btn = e.target.closest('[data-spl-open]');
		if (btn) {
			if (e.button === 0) openPlan(btn.dataset.splOpen);
			return;
		}
		const card = e.target.closest('[data-spl-id]');
		if (!card) return;
		const url = detailUrl(D.find(card.dataset.splId));
		if (e.button === 1 || e.metaKey || e.ctrlKey) window.open(url, '_blank');
		else location.href = url;
	}
	plansBox.addEventListener('click', cardClick);
	plansBox.addEventListener('auxclick', (e) => {
		if (e.button === 1) cardClick(e);
	});

	/* Add-ons */
	function drawAddOns() {
		pick('[data-spl-addons]', root).innerHTML = D.addOns
			.map(
				(a) =>
					`<tr><td><div class="spl-addon"><span class="spl-addon-icon" aria-hidden="true"><i class="bi ${a.icon}"></i></span><span><span class="spl-addon-name">${htmlSafe(a.name)}</span><span class="spl-addon-price">${cents(a.per)} ${htmlSafe(a.unit)}</span><span class="spl-addon-about">${htmlSafe(a.about)}</span><span class="spl-addon-acc">${num(a.accounts)} accounts</span></span></div></td><td class="spl-col-plans"><span class="spl-plan-pills">${a.plans
						.map((id) => {
							const p = D.find(id);
							return `<span class="spl-pill" ${tone(p)}>${htmlSafe(p.name)}</span>`;
						})
						.join(
							'',
						)}</span></td><td class="text-end spl-col-acc"><span class="spl-num">${num(a.accounts)}</span></td><td class="text-end"><span class="spl-num">${short(a.mrr)}<small>${changeHtml(a.change, D.prevMonth.slice(0, 3))}</small></span></td></tr>`,
			)
			.join('');
	}

	/* Quick view: one plan */
	const drawer = pick('#spl-plan');

	function d(name) {
		return pick(`[data-spl-d="${name}"]`, drawer);
	}

	function panel() {
		return bootstrap.Offcanvas.getOrCreateInstance(drawer);
	}

	function disposeTips(scope) {
		if (!window.bootstrap) return;

		for (const t of pickAll('[data-bs-toggle="tooltip"]', scope)) {
			const i = bootstrap.Tooltip.getInstance(t);
			if (!i) continue;
			if (i.tip) {
				if (i.tip.classList.contains('show')) i.hide();
				continue;
			}
			i.dispose();
		}
	}

	/* The month in three lines and a total; the full page splits them.
     Free counts accounts, as its moves carry no revenue. */
	function movesHtml(p) {
		function sum(rows, i) {
			return rows.reduce((t, r) => t + r[i], 0);
		}

		function accs(n) {
			return n + (n === 1 ? ' account' : ' accounts');
		}

		if (isFree(p)) {
			function low(t) {
				return t.charAt(0).toLowerCase() + t.slice(1);
			}

			const came = sum(p.moves.in, 1);
			const went = sum(p.moves.out, 1);

			function line(label, note, n, kind) {
				return `<li><span>${label}<small>${note}</small></span><span class="spl-dmoves-v spl-change-${kind}">${n >= 0 ? '+' : '−'}${num(Math.abs(n))}</span></li>`;
			}

			return `<ul class="spl-dmoves">${line('Came in', p.moves.in.map((m) => low(m[0])).join(', '), came, 'up')}${line('Went out', p.moves.out.map((m) => low(m[0])).join(', '), -went, 'down')}</ul><p class="spl-dnet"><span>Net change</span><strong>${came - went >= 0 ? '+' : '−'}${accs(Math.abs(came - went))}</strong></p>`;
		}

		function signed(n) {
			return (n >= 0 ? '+' : '−') + money(Math.abs(n));
		}

		const seats = p.moves.seats;
		const t = D.trend(p);
		const net = t[t.length - 1] - t[t.length - 2];

		function row(label, note, value, kind) {
			return `<li><span>${label}<small>${note}</small></span><span class="spl-dmoves-v spl-change-${kind}">${signed(value)}</span></li>`;
		}

		return `<ul class="spl-dmoves">${row('Came in', accs(sum(p.moves.in, 1)), sum(p.moves.in, 2), 'up')}${row('Went out', accs(sum(p.moves.out, 1)), -sum(p.moves.out, 2), 'down')}${row(seats >= 0 ? 'More seats' : 'Fewer seats', 'existing accounts', seats, seats >= 0 ? 'up' : 'down')}</ul><p class="spl-dnet"><span>Net change</span><strong>${signed(net)}</strong></p>`;
	}

	function accountsHtml(p) {
		if (p.busiest) {
			return `<section class="spl-dsec" aria-labelledby="spl-d-accounts"><h3 class="basalt-drawer-legend" id="spl-d-accounts">Busiest accounts</h3><ul class="spl-dlist">${p.busiest
				.slice(0, 4)
				.map(
					(a) =>
						`<li><span>${htmlSafe(a[0])}<small>${a[2]} of ${p.seatLimit} people · ${htmlSafe(a[1])}</small></span><span class="spl-dlist-mrr">${a[3]} visits</span></li>`,
				)
				.join('')}</ul><p class="spl-dnote">Visits booked this month, out of ${p.visitLimit}.</p></section>`;
		}
		const list = D.accounts(p).slice(0, 4);
		if (!list.length || !A) return '';
		return `<section class="spl-dsec" aria-labelledby="spl-d-accounts"><h3 class="basalt-drawer-legend" id="spl-d-accounts">Biggest accounts</h3><ul class="spl-dlist">${list
			.map(
				(a) =>
					`<li><span><a href="company-details.html?id=${encodeURIComponent(a.id)}">${htmlSafe(a.name)}</a><small>${num(a.seats)} seats · ${htmlSafe(a.city)}</small></span><span class="spl-dlist-mrr">${money(A.listMrr(a))}</span></li>`,
			)
			.join('')}</ul><p class="spl-dnote">What each pays a month, add-ons included.</p></section>`;
	}

	function drawDrawer(p) {
		drawer.style.setProperty('--spl-tone', `var(--basalt-series-${p.tone})`);
		d('title').textContent = p.name;
		const free = isFree(p);
		d('sub').textContent = free
			? `Free for up to ${p.seatLimit} people, ${p.visitLimit} visits a month`
			: `${cents(p.price)} a seat a month, ${cents(D.yearly(p))} when paid yearly`;
		d('full').setAttribute('href', detailUrl(p));
		d('edit').setAttribute('href', `${detailUrl(p)}&edit=1`);
		/* Free's limits are fixed, so it has nothing to edit. */
		d('edit').hidden = free;
		d('body').innerHTML =
			`<section class="spl-dsec" aria-label="${htmlSafe(p.name)} in figures"><dl class="spl-dfigs">${free ? `<div class="spl-fig"><dt>Accounts</dt><dd>${num(p.accounts)}</dd></div><div class="spl-fig"><dt>People</dt><dd>${num(p.seats)}</dd></div><div class="spl-fig"><dt>Moved up</dt><dd>${num(movedUp(p))}</dd></div>` : `<div class="spl-fig"><dt>A month</dt><dd>${short(p.mrr)}</dd></div><div class="spl-fig"><dt>Accounts</dt><dd>${num(p.accounts)}</dd></div><div class="spl-fig"><dt>Seats</dt><dd>${num(p.seats)}</dd></div>`}</dl><p class="spl-dnote">${free ? `Pays nothing. ${num(movedUp(p))} accounts moved to a paid plan in ${htmlSafe(D.month)}.` : `${Math.round((p.mrr / T.mrr) * 100)}% of revenue, ${Math.round(p.yearlyShare * 100)}% of accounts pay yearly.`}</p></section><section class="spl-dsec" aria-labelledby="spl-d-moves"><h3 class="basalt-drawer-legend" id="spl-d-moves">${htmlSafe(D.month)} in and out</h3>${movesHtml(p)}</section>${accountsHtml(p)}<section class="spl-dsec spl-tone" aria-labelledby="spl-d-incl"><h3 class="basalt-drawer-legend" id="spl-d-incl">Included</h3><ul class="spl-includes mt-0">${p.includes.map((x) => `<li><i class="bi ${x[0]}" aria-hidden="true"></i>${htmlSafe(x[1])}</li>`).join('')}</ul></section>`;
	}

	function openPlan(id) {
		const p = D.plans.find((x) => x.id === id);
		if (!p) return;
		state.open = id;
		drawDrawer(p);

		for (const c of pickAll('[data-spl-id]', plansBox)) {
			c.classList.toggle('is-open', c.dataset.splId === id);
		}

		try {
			history.replaceState(null, '', `#${id}`);
		} catch {
			/* file:// */
		}
		panel().show();
	}
	start();

	/* DOM lookups, shared by every helper above. */
	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
