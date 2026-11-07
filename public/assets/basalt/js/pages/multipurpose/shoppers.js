/**
 * Basalt - Shoppers page (shoppers.html)
 * The people who buy clothing, extras and services from the Marlo
 * shop, and whether each is still ordering at their usual pace.
 *
 * The customers and their orders come from the Store book
 * (window.Basalt.shopBook, assets/basalt/js/data/multipurpose/store.js), the same records the
 * Orders, Order Details and Shopper Details pages read, so the pages
 * agree: the name, the city, spend, what they buy most and every
 * order. Each shopper, guests included, has a full page on Shopper
 * Details (shopper-details.html?id=<customer number>).
 * To use your own data, fill the book with your customers and orders.
 */
(() => {
	'use strict';
	const page = pick('[data-sc-root]');
	const book = window.Basalt.shopBook;
	if (!page || !book) return;

	function start() {
		for (const k of Object.keys(checks)) {
			fields[k].addEventListener('input', () => {
				if (fields[k].classList.contains('is-invalid')) valid(k);
			});
		}

		modal.addEventListener('hidden.bs.modal', () => {
			form.reset();

			for (const k of Object.keys(checks)) {
				fields[k].classList.remove('is-invalid');
				fields[k].removeAttribute('aria-invalid');
			}

			for (const s of pickAll('select', modal)) {
				s.dispatchEvent(new Event('change', { bubbles: true }));
			}
		});
		modal.addEventListener('shown.bs.modal', () => fields.name.focus());

		let freshId = 88084;
		form.addEventListener('submit', (e) => {
			e.preventDefault();
			const bad = Object.keys(checks).filter((k) => !valid(k));
			if (bad.length) {
				fields[bad[0]].focus();
				return;
			}
			const tier = pick('input[name="sc-new-tier"]:checked', form).value;
			const a = build(
				{
					id: `#${freshId++}`,
					name: fields.name.value.trim(),
					email: fields.email.value.trim(),
					country: fields.country.value,
					tier,
					lifetimeValue: 0,
					orders: 0,
					joinedOn: book.NOW.slice(0, 10),
					avatarTone: (ACCOUNTS.length % 4) + 1,
				},
				{
					buyer: fields.buyer.value.trim(),
					phone: 'Not given yet',
					city: fields.city.value.trim(),
					pays: pick('input[name="sc-new-pays"]:checked', form).value,
					unsaved: true,
					last: null,
					buys: [],
				},
			);
			ACCOUNTS.unshift(a);
			window.bootstrap.Modal.getInstance(modal).hide();
			counts();
			/* Show the new customer in their tier, nothing filtered out. */
			state.q = '';
			pick('[data-sc-search]').value = '';
			const view = pick(`#sc-view-${tier}`);
			view.checked = true;
			view.dispatchEvent(new Event('change', { bubbles: true }));
			state.all = true;
			render();
			const row = pick(`.sc-row[data-sc-row="${a.id}"]`, body);
			row.classList.add('is-fresh');
			row.scrollIntoView({ block: 'center', behavior: 'smooth' });
			toast({
				tone: 'success',
				title: `${a.name} can order now`,
				text: `${a.buyer} gets a welcome email with the lookbook.`,
				actions: [{ label: 'Open shopper', onClick: () => openAccount(a.id) }],
			});
		});

		counts();
		nudges();
		render();
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

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	/* The demo is pinned to one day so the "days since" figures always read
     the same. In a live app this is simply new Date(). */
	const TODAY = window.Basalt.toLocalDay(book.NOW.slice(0, 10));
	const DAY = 86400000;

	function day(iso) {
		return window.Basalt.toLocalDay(iso);
	}

	function daysSince(iso) {
		return Math.round((TODAY - day(iso)) / DAY);
	}

	function money(n) {
		return `$${Math.round(n).toLocaleString('en-US')}`;
	}

	function moneyCents(n) {
		return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/* Dates keep together on one line (no-break spaces). */
	function dayMonth(iso) {
		const d = day(iso);
		return `${MONTHS[d.getMonth()]}\u00a0${d.getDate()}`;
	}

	function fullDate(iso) {
		return `${dayMonth(iso)}\u00a0${day(iso).getFullYear()}`;
	}

	function monthYear(iso) {
		const d = day(iso);
		return `${MONTHS[d.getMonth()]}\u00a0${d.getFullYear()}`;
	}

	function plural(n, word) {
		return `${n} ${word}${n === 1 ? '' : 's'}`;
	}

	function initials(name) {
		return name
			.replace(/&/g, '')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0])
			.join('')
			.toUpperCase();
	}

	const TIERS = {
		flagship: { label: 'Insider', perk: '15% off clothing', tone: 8 },
		partner: { label: 'Member', perk: '10% off clothing', tone: 3 },
		trade: { label: 'Standard', perk: 'Full price', tone: 'plain' },
	};
	const COUNTRIES = book.COUNTRIES;
	const PAYS = { terms: 'Pay by invoice', ach: 'Bank transfer', card: 'Card', check: 'Gift card' };
	const ORDER_STATUS = {
		placed: ['warning', 'Awaiting payment'],
		paid: ['warning', 'Waiting to pack'],
		picking: ['primary', 'Packed'],
		dispatched: ['primary', 'Shipped'],
		delivered: ['success', 'Delivered'],
		canceled: ['danger', 'Canceled'],
	};
	/* How each reorder state reads in the list. */
	const RHYTHM = {
		ok: { tone: 'success', label: 'On track' },
		due: { tone: 'warning', label: 'Due to reorder' },
		quiet: { tone: 'danger', label: 'Gone quiet' },
		fresh: { tone: 'info', label: 'New' },
	};

	function product(sku) {
		return book.PRODUCTS.find((p) => p.sku === sku);
	}

	function ordersOf(name) {
		return book.ORDERS.filter((o) => o.customer === name)
			.slice()
			.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
	}

	/* A customer's pace: the average gap between its orders so far, and how
     long it has been since the last one. Past the usual gap it is due;
     well past it (1.8 times), it has gone quiet. */
	function rhythm(a) {
		if (!a.orders || !a.last) return { key: 'fresh', gap: 0, since: daysSince(a.joinedOn) };
		const since = daysSince(a.last);
		const gap = a.orders > 1 ? Math.round((day(a.last) - day(a.joinedOn)) / DAY / (a.orders - 1)) : 30;
		const key = since > gap * 1.8 ? 'quiet' : since > gap * 1.15 ? 'due' : 'ok';
		return { key, gap, since };
	}

	function build(c, extra) {
		const recent = ordersOf(c.name);
		const kept = recent.filter((o) => o.status !== 'canceled');
		const a = Object.assign({ pays: 'card' }, c, extra);
		a.buys = (a.buys || []).slice();
		a.last = kept.length ? kept[0].date : a.last || null;
		a.pays = kept.length ? kept[0].paymentMethod : a.pays;
		a.recent = recent;
		a.reminded = false;
		a.r = rhythm(a);
		return a;
	}

	const ACCOUNTS = book.CUSTOMERS.map((c) => build(c, {}));

	/* Where a shopper is: "City, ST", or the country for one added here without a city. */
	function placeOf(a) {
		return a.city && a.state ? `${a.city}, ${a.state}` : COUNTRIES[a.country] || a.city || '';
	}

	function late(a) {
		return a.r.key === 'due' || a.r.key === 'quiet';
	}

	/* A shopper added here lives only in this demo session, so has no page yet. */
	function accountUrl(a) {
		return a.unsaved ? '' : `shopper-details.html?id=${encodeURIComponent(a.id)}`;
	}

	function nameHtml(a) {
		return `<span class="sc-acc-name">${htmlSafe(a.name)}</span>`;
	}

	const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

	function inWords(n) {
		return words[n] || String(n);
	}

	/* Worth a nudge
	   Every shopper past their usual gap, the longest overdue first. Each bar
	   runs on one shared scale of days since the last order: the first part
	   is the shopper's usual gap, the rest is how far past it they are. */
	const nudgeList = pick('[data-sc-nudges]');
	const remindAll = pick('[data-sc-remind-all]');

	function nudgeHtml(a, scale) {
		const st = RHYTHM[a.r.key];
		const usual = Math.round((a.r.gap / scale) * 100);
		const past = Math.round(((a.r.since - a.r.gap) / scale) * 100);
		return `<li class="sc-nudge-row sc-tone-${a.avatarTone}"><div class="sc-acc"><span class="sc-avatar" aria-hidden="true">${htmlSafe(initials(a.name))}</span><span class="sc-acc-text">${nameHtml(a)}<span class="sc-sub">${htmlSafe(a.city)} · usual order ${money(a.lifetimeValue / a.orders)}</span></span></div><div class="sc-pace sc-pace-${a.r.key}"><span class="sc-pace-track" aria-hidden="true"><span class="sc-pace-usual" style="width:${usual}%"></span><span class="sc-pace-late" style="width:${past}%"></span></span><span class="sc-sub">${plural(a.r.since, 'day')} since the last order, usually ${a.r.gap}</span></div><span class="basalt-status basalt-status-dot basalt-status-${st.tone} sc-status">${st.label}</span><div class="sc-nudge-row-act">${a.reminded ? `<span class="sc-sent" tabindex="-1" data-sc-sent="${a.id}"><i class="bi bi-check2-circle" aria-hidden="true"></i>Sent today</span>` : `<button type="button" class="btn btn-outline-secondary btn-sm" data-sc-remind="${a.id}" aria-label="Send ${htmlSafe(a.name)} a reorder reminder">Remind</button>`}</div></li>`;
	}

	function nudges() {
		const list = ACCOUNTS.filter(late).sort((x, y) => y.r.since - y.r.gap - (x.r.since - x.r.gap));
		const scale = Math.ceil(Math.max(...list.map((a) => a.r.since)) / 10) * 10;
		nudgeList.innerHTML = list.map((a) => nudgeHtml(a, scale)).join('');
		const open = list.filter((a) => !a.reminded);
		const usual = list.reduce((n, a) => n + a.lifetimeValue / a.orders, 0);
		pick('[data-sc-nudge-lede]').textContent = open.length
			? `${inWords(list.length).charAt(0).toUpperCase() + inWords(list.length).slice(1) + (list.length === 1 ? ' shopper is' : ' shoppers are')} past their usual gap. Their usual orders come to about ${money(Math.round(usual / 10) * 10)}.`
			: 'Every late shopper has a reminder. Most reorder within a week.';
		remindAll.hidden = open.length < 2;
		pick('[data-sc-remind-all-label]').textContent = `Remind all ${inWords(open.length)}`;
	}

	function remind(list) {
		list.forEach((a) => {
			a.reminded = true;
		});
		nudgeList.classList.remove('sc-nudges-grow');
		nudges();
		render();
		if (current && list.indexOf(current) !== -1 && drawer.classList.contains('show')) renderAccount(current);
	}

	nudgeList.addEventListener('click', (e) => {
		const b = e.target.closest('[data-sc-remind]');
		if (!b) return;
		const a = ACCOUNTS.find((x) => x.id === b.getAttribute('data-sc-remind'));
		remind([a]);
		pick(`[data-sc-sent="${a.id}"]`, nudgeList).focus();
		toast({
			tone: 'success',
			title: 'Reminder sent',
			text: `${a.buyer} gets a short note with their usual items, ready to reorder.`,
		});
	});
	remindAll.addEventListener('click', () => {
		const list = ACCOUNTS.filter((a) => late(a) && !a.reminded);
		remind(list);
		pick('[data-sc-sent]', nudgeList).focus();
		toast({
			tone: 'success',
			title: `${plural(list.length, 'reminder')} sent`,
			text: 'Each shopper gets a short note with their usual items, ready to reorder.',
		});
	});

	/* The list */
	const FIRST = 10;
	const state = { tier: 'all', q: '', sort: 'spend', dir: -1, all: false };
	const body = pick('[data-sc-body]');
	const wrap = pick('[data-sc-table-wrap]');
	const more = pick('[data-sc-more]');
	const noMatch = pick('[data-sc-nomatch]');
	let shown = [];

	const SORTS = {
		name: (a, b) => a.name.localeCompare(b.name),
		spend: (a, b) => a.lifetimeValue - b.lifetimeValue,
		last: (a, b) => (a.last || '').localeCompare(b.last || ''),
	};

	function inTier(a, tier) {
		return tier === 'all' || a.tier === tier;
	}

	function matching() {
		return ACCOUNTS.filter(
			(a) =>
				inTier(a, state.tier) &&
				(!state.q || window.Basalt.matchesQuery([a.name, a.buyer, a.email, placeOf(a)].join(' '), state.q)),
		);
	}

	function rhythmLine(a) {
		if (a.reminded) return 'Reminder sent today';
		if (a.r.key === 'fresh') return `Joined ${dayMonth(a.joinedOn)}, no order yet`;
		return `Orders every ${a.r.gap} days`;
	}

	function rowHtml(a) {
		const t = TIERS[a.tier];
		const st = RHYTHM[a.r.key];
		return `<tr class="sc-row" data-sc-row="${a.id}"><td class="sc-col-acc"><div class="sc-acc"><span class="sc-avatar sc-tone-${a.avatarTone}" aria-hidden="true">${htmlSafe(initials(a.name))}</span><span class="sc-acc-text">${nameHtml(a)}<span class="sc-sub">Since ${htmlSafe(String(a.joinedOn).slice(0, 4))} · ${htmlSafe(placeOf(a))}</span></span></div></td><td class="sc-col-tier"><span class="sc-tier sc-tone-${t.tone}">${t.label}</span><span class="sc-sub">${t.perk}</span></td><td class="sc-col-spend"><span class="sc-strong">${money(a.lifetimeValue)}</span><span class="sc-sub">${a.orders ? plural(a.orders, 'order') : 'No orders yet'}</span></td><td class="sc-col-last"><span class="sc-cell"><span class="sc-stack-label">Last order </span>${a.last ? fullDate(a.last) : 'None yet'}</span><span class="sc-sub">${a.last ? (daysSince(a.last) ? `${plural(daysSince(a.last), 'day')} ago` : 'Today') : `Account is ${plural(a.r.since, 'day')} old`}</span></td><td class="sc-col-pace"><span class="basalt-status basalt-status-dot basalt-status-${st.tone} sc-status">${st.label}</span><span class="sc-sub">${rhythmLine(a)}</span></td><td class="sc-col-go"><span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-sc-open="${a.id}" aria-label="Quick view: ${htmlSafe(a.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>${accountUrl(a) ? `<a class="btn btn-icon btn-sm" href="${accountUrl(a)}" aria-label="Open full page: ${htmlSafe(a.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>` : ''}</span></td></tr>`;
	}

	function counts() {
		for (const v of ['all', 'flagship', 'partner', 'trade']) {
			pick(`[data-sc-count="${v}"]`).textContent = ACCOUNTS.filter((a) => inTier(a, v)).length;
		}

		pick('[data-sc-lede]').textContent =
			`${inWords(ACCOUNTS.length).charAt(0).toUpperCase() + inWords(ACCOUNTS.length).slice(1)} people buying clothing, extras and services online.`;
	}

	function sortHeads() {
		for (const th of pickAll('[data-sc-th]')) {
			const key = th.getAttribute('data-sc-th');
			const icon = pick('.bi', th);
			if (key === state.sort) {
				th.setAttribute('aria-sort', state.dir < 0 ? 'descending' : 'ascending');
				icon.className = `bi ${state.dir < 0 ? 'bi-arrow-down' : 'bi-arrow-up'}`;
			} else {
				th.removeAttribute('aria-sort');
				icon.className = 'bi bi-arrow-down-up sc-sort-idle';
			}
		}
	}

	function render() {
		const list = matching().sort((a, b) => SORTS[state.sort](a, b) * state.dir || a.name.localeCompare(b.name));
		shown = list;
		const rows = state.all ? list : list.slice(0, FIRST);
		body.innerHTML = rows.map(rowHtml).join('');
		if (window.Basalt.tips) window.Basalt.tips(body);
		wrap.hidden = !list.length;
		noMatch.hidden = !!list.length;
		if (!list.length) {
			pick('[data-sc-nomatch-title]').textContent = `No shopper matches “${state.q}”`;
		}
		const hiddenRows = list.length - rows.length;
		more.hidden = hiddenRows <= 0;
		if (hiddenRows > 0) {
			pick('[data-sc-more-text]').textContent = `The other ${plural(hiddenRows, 'shopper')} spend less with us.`;
			pick('[data-sc-more-btn]').textContent = `Show all ${list.length}`;
		}
		pick('[data-sc-summary]').textContent = plural(list.length, 'shopper');
		sortHeads();
	}

	for (const r of pickAll('input[name="sc-view"]')) {
		r.addEventListener('change', () => {
			state.tier = r.value;
			state.all = false;
			render();
		});
	}

	pick('[data-sc-search]').addEventListener('input', (e) => {
		state.q = e.target.value.trim();
		render();
	});

	for (const b of pickAll('[data-sc-sort]')) {
		b.addEventListener('click', () => {
			const key = b.getAttribute('data-sc-sort');
			if (state.sort === key) state.dir *= -1;
			else {
				state.sort = key;
				state.dir = key === 'name' ? 1 : -1;
			}
			render();
		});
	}

	pick('[data-sc-more-btn]').addEventListener('click', () => {
		window.Basalt.slide(wrap, () => {
			state.all = true;
			render();
		});
		const next = body.rows[FIRST];
		if (next) pick('.sc-acc-name', next).focus();
	});
	pick('[data-sc-clear]').addEventListener('click', () => {
		state.q = '';
		pick('[data-sc-search]').value = '';
		render();
		pick('[data-sc-search]').focus();
	});

	/* Customer drawer */
	const drawer = pick('#sc-account');

	function dEl(k) {
		return pick(`[data-sc-d="${k}"]`, drawer);
	}

	let navList = [];
	let nav = null;
	let current = null;

	function statusSentence(a) {
		if (a.r.key === 'fresh')
			return `Opened on ${fullDate(a.joinedOn)}. No order yet; a welcome call usually brings the first one.`;
		const pace = `Usually orders every ${a.r.gap} days. `;
		if (a.r.key === 'ok') return `${pace}The last order was ${plural(a.r.since, 'day')} ago.`;
		if (a.r.key === 'due') return `${pace}Nothing for ${plural(a.r.since, 'day')}, so the next one is due.`;
		return `${pace}Nothing for ${plural(a.r.since, 'day')}, more than twice as long as usual.`;
	}

	function renderAccount(a) {
		current = a;
		const t = TIERS[a.tier];
		const st = RHYTHM[a.r.key];
		const av = dEl('avatar');
		av.className = `sc-avatar sc-avatar-lg sc-tone-${a.avatarTone}`;
		av.textContent = initials(a.name);
		dEl('name').textContent = a.name;
		dEl('sub').textContent = `${t.label} · since ${monthYear(a.joinedOn)}`;
		dEl('status').className = `basalt-status basalt-status-dot basalt-status-${st.tone}`;
		dEl('status').textContent = st.label;
		dEl('lead').innerHTML = a.orders
			? `Spent <strong>${money(a.lifetimeValue)}</strong> on ${plural(a.orders, 'order')} since ${day(a.joinedOn).getFullYear()}. ${htmlSafe(statusSentence(a))}`
			: htmlSafe(statusSentence(a));
		const canRemind = a.r.key === 'due' || a.r.key === 'quiet' || a.r.key === 'fresh';
		dEl('remind').hidden = !canRemind || a.reminded;
		dEl('remind-label').textContent = a.r.key === 'fresh' ? 'Send a welcome email' : 'Send a reorder reminder';
		dEl('reminded').hidden = !a.reminded;

		const recent = a.recent.slice(0, 3);
		dEl('orders').innerHTML = recent
			.map((o) => {
				const s = ORDER_STATUS[o.status];
				const units = o.lines.reduce((n, l) => n + l.qty, 0);
				return `<li class="sc-order"><span class="sc-order-main"><a class="sc-link" href="order-details.html?id=${encodeURIComponent(o.orderNumber)}">${o.orderNumber}</a><span class="sc-sub">${dayMonth(o.date)} · ${plural(units, 'item')}</span></span><span class="basalt-status basalt-status-${s[0]} sc-order-status">${s[1]}</span><span class="sc-order-amt">${moneyCents(o.total)}</span></li>`;
			})
			.join('');
		dEl('orders').hidden = !recent.length;
		const canceled = a.recent.find((o) => o.status === 'canceled' && o === a.recent[0]);
		dEl('orders-note').textContent = !recent.length
			? a.last
				? `No recent orders here. The last one came in on ${fullDate(a.last)}.`
				: 'No orders yet.'
			: canceled
				? `The latest order was canceled: ${canceled.cancel.charAt(0).toLowerCase()}${canceled.cancel.slice(1)}`
				: '';
		dEl('orders-note').hidden = !dEl('orders-note').textContent.trim();

		const buys = a.buys || [];
		const top = buys.length ? Math.max(...buys.map((b) => b[1])) : 1;
		dEl('buys').innerHTML = buys
			.slice()
			.sort((x, y) => y[1] - x[1])
			.map((b, i) => {
				const p = product(b[0]);
				return `<li class="sc-bar sc-tone-${i + 1}"><span class="sc-bar-name">${htmlSafe(p.name)}</span><span class="sc-bar-track" aria-hidden="true"><span class="sc-bar-fill" style="width:${Math.max(4, Math.round((b[1] / top) * 100))}%"></span></span><span class="sc-bar-value">${b[1]}</span></li>`;
			})
			.join('');
		dEl('buys-section').hidden = !buys.length;

		dEl('buyer').textContent = a.buyer;
		const mail = dEl('email');
		mail.textContent = a.email;
		mail.href = `mailto:${a.email}`;
		dEl('phone').textContent = a.phone;
		dEl('ships').textContent = placeOf(a);
		dEl('pays').textContent = PAYS[a.pays] || 'Card';
		dEl('pricing').textContent = t.perk;
		dEl('id').textContent = a.id;
		dEl('mail-btn').href = `mailto:${a.email}`;
		dEl('open-btn').hidden = !accountUrl(a);
		if (accountUrl(a)) dEl('open-btn').href = accountUrl(a);

		for (const r of pickAll('.sc-row', body)) {
			r.classList.toggle('is-selected', r.getAttribute('data-sc-row') === a.id);
		}
	}

	function openAccount(id) {
		const a = ACCOUNTS.find((x) => x.id === id);
		if (!a) return;
		navList = shown.indexOf(a) !== -1 ? shown.slice() : [a];
		if (!nav && window.Basalt.drawer) {
			/* The count is read on each step, so one binding serves any list. */
			nav = window.Basalt.drawer.recordNav(drawer, { valueOf: () => Math.max(1, navList.length) }, (at) =>
				renderAccount(navList[at]),
			);
		}
		if (nav) nav.go(navList.indexOf(a), 0);
		else renderAccount(a);
		pick('.basalt-drawer-nav', drawer).hidden = navList.length < 2;
		window.bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
	}

	/* The panel icon opens the quick view. A click anywhere else on a row
     opens the shopper's full page, and the middle button or Cmd/Ctrl opens
     it in a new tab, as a link would; a shopper added in the demo has no
     full page, so it opens the quick view. */
	function rowClick(e) {
		if (e.button > 1 || e.target.closest('a')) return;
		const hit = e.target.closest('[data-sc-open]');
		if (hit) {
			if (e.button === 0) openAccount(hit.getAttribute('data-sc-open'));
			return;
		}
		const row = e.target.closest('[data-sc-row]');
		if (!row) return;
		const a = ACCOUNTS.find((x) => x.id === row.getAttribute('data-sc-row'));
		if (!accountUrl(a)) {
			if (e.button === 0) openAccount(a.id);
			return;
		}
		if (e.button === 1 || e.metaKey || e.ctrlKey) window.open(accountUrl(a), '_blank');
		else location.href = accountUrl(a);
	}
	body.addEventListener('click', rowClick);
	body.addEventListener('auxclick', (e) => {
		if (e.button === 1) rowClick(e);
	});
	drawer.addEventListener('hidden.bs.offcanvas', () => {
		for (const r of pickAll('.sc-row.is-selected', body)) {
			r.classList.remove('is-selected');
		}
	});

	dEl('remind').addEventListener('click', () => {
		const a = current;
		remind([a]);
		pick(`.sc-row[data-sc-row="${a.id}"]`, body)?.classList.add('is-selected');
		dEl('reminded').focus();
		toast({
			tone: 'success',
			title: a.r.key === 'fresh' ? 'Welcome email sent' : 'Reminder sent',
			text: `${a.buyer} gets ${a.r.key === 'fresh' ? 'the lookbook and a link to place a first order.' : 'a short note with their usual items, ready to reorder.'}`,
		});
	});

	/* Header menu: export and lookbook */
	pick('[data-sc-export]').addEventListener('click', () => {
		const head = [
			'Shopper',
			'Customer number',
			'Tier',
			'Known as',
			'Email',
			'City',
			'State',
			'Orders',
			'Spent (USD)',
			'Last order',
			'Reorder',
		];
		const rows = ACCOUNTS.map((a) => [
			a.name,
			a.id,
			TIERS[a.tier].label,
			a.buyer,
			a.email,
			a.city || '',
			a.state || '',
			a.orders,
			a.lifetimeValue,
			a.last || '',
			RHYTHM[a.r.key].label,
		]);
		const csv = [head]
			.concat(rows)
			.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
			.join('\r\n');
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
		link.download = 'shoppers.csv';
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000);
		toast({
			tone: 'success',
			title: 'Export ready',
			text: `${plural(ACCOUNTS.length, 'shopper')} saved to shoppers.csv.`,
		});
	});
	pick('[data-sc-pricelist]').addEventListener('click', () => {
		toast({
			tone: 'success',
			title: 'Lookbook sent',
			text: 'Every shopper gets the October lookbook, with their own tier discount applied.',
		});
	});

	/* Add a customer */
	const modal = pick('#sc-new');
	const form = pick('[data-sc-new-form]', modal);
	const fields = {
		name: pick('#sc-new-name'),
		buyer: pick('#sc-new-buyer'),
		email: pick('#sc-new-email'),
		city: pick('#sc-new-city'),
		country: pick('#sc-new-country'),
	};
	const checks = {
		name: (v) => v.length > 1,
		buyer: (v) => v.length > 1,
		email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
		city: (v) => v.length > 1,
	};
	function valid(key) {
		const ok = checks[key](fields[key].value.trim());
		fields[key].classList.toggle('is-invalid', !ok);
		fields[key].setAttribute('aria-invalid', String(!ok));
		return ok;
	}

	start();
})();
