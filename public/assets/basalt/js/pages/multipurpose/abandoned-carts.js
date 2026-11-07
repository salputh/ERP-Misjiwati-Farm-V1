/**
 * Basalt - Abandoned Carts (abandoned-carts.html)
 * Carts shoppers left at checkout, the two reminder emails that go
 * out for each, and the settings for those emails.
 *
 * Reads window.Basalt.data.carts (assets/basalt/js/data/multipurpose/carts.js) for the
 * carts, the shop book (window.Basalt.shopBook, store.js) for each
 * shopper's name and email, and the catalog
 * (window.Basalt.data.catalog) for product names, prices and photos.
 *
 * A row, its expand icon and the panel's "Open full page" go to the
 * shopper's own page; the panel icon opens the cart in the side panel.
 * Guests have no shopper page, so their rows open the panel.
 */
(() => {
	'use strict';
	const root = pick('[data-ac-root]');
	if (!root) return;
	const D = window.Basalt.data && window.Basalt.data.carts;
	const CAT = window.Basalt.data && window.Basalt.data.catalog;
	const BOOK = window.Basalt.shopBook;
	if (!D || !CAT || !BOOK) return;

	function start() {
		field('on').addEventListener('change', paused);
		form.addEventListener('submit', (e) => {
			e.preventDefault();
			const first = Number(field('first').value);
			const second = Number(field('second').value);
			if (second <= first) {
				toast({
					tone: 'warning',
					title: 'Check the timing',
					text: 'The 2nd email has to go after the 1st.',
					duration: 5000,
				});
				field('second').focus();
				return;
			}
			state.rules = {
				on: field('on').checked,
				first,
				second,
				code: field('code').value,
				keep: Number(field('keep').value),
			};
			refresh();
			if (state.open) paintSheet();
			const code = state.rules.code
				? ` The 2nd email carries ${state.rules.code} (${CODES[state.rules.code]}).`
				: '';
			toast({
				tone: 'success',
				title: state.rules.on ? 'Reminder emails saved' : 'Reminders are off',
				text:
					(state.rules.on ? 'New times apply to every open cart.' : 'No more reminder emails will go out.') +
					code,
				duration: 5000,
			});
		});

		fillRules();
		refresh();
		/* The four figures count up from zero once, as the page opens. */
		window.Basalt.countUp?.(pickAll('.basalt-fig-value[data-ac-fig]'));
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
		return `${n} ${n === 1 ? one : many || `${one}s`}`;
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	/* Dates
	   Times are local and written without a zone, so they read the same
	   wherever the demo is opened. */
	function parse(s) {
		const [d, t] = s.split('T');
		const [y, m, dd] = d.split('-').map(Number);
		const [h, mi] = (t || '0:0').split(':').map(Number);
		return new Date(y, m - 1, dd, h, mi);
	}

	const NOW = parse(D.now);
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MIN = 60000;

	function addMin(d, m) {
		return new Date(d.getTime() + m * MIN);
	}

	function startOfDay(d) {
		return new Date(d.getFullYear(), d.getMonth(), d.getDate());
	}

	function dayDiff(d) {
		return Math.round((startOfDay(NOW) - startOfDay(d)) / 86400000);
	}

	function clockText(d) {
		const h = d.getHours();
		const m = d.getMinutes();
		return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? ' am' : ' pm'}`;
	}

	function fmtDay(d) {
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function fmtShort(d) {
		const diff = dayDiff(d);
		if (diff === 0) return 'Today';
		if (diff === 1) return 'Yesterday';
		if (diff === -1) return 'Tomorrow';
		return `${DAYS[d.getDay()]}, ${fmtDay(d)}`;
	}

	function fmtLong(d) {
		return `${fmtShort(d)} at ${clockText(d)}`;
	}

	function lower(s) {
		return /^(Yesterday|Tomorrow|Today)/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
	}

	/* "in 25 minutes", "in 3 hours", "tomorrow at 9:10 am" */
	function fromNow(d) {
		const mins = Math.round((d - NOW) / MIN);
		if (mins < 60) return `in ${plural(Math.max(1, mins), 'minute')}`;
		if (dayDiff(d) === 0 && mins < 360) return `in ${plural(Math.round(mins / 60), 'hour')}`;
		return lower(fmtLong(d));
	}

	/* The shop */
	function product(sku) {
		return CAT.find(sku);
	}

	function photo(id, w, h) {
		return window.Basalt.photo(id, w, h);
	}

	function shopper(id) {
		return id ? BOOK.CUSTOMERS.find((c) => c.id === id) : null;
	}

	const CODES = {
		FIRSTORDER: '15% off a first order',
		SCULPT20: '20% off the Sculpted Shoulder Blazer',
		SHADES50: '$50 off accessories over $400',
	};

	/* State */
	const state = {
		rules: D.rules(),
		carts: D.carts()
			.map((c) => {
				const s = shopper(c.customer);
				const items = c.items.map(([sku, qty, size]) => {
					const p = product(sku);
					return { sku, qty, size, name: p.name, price: p.price, photo: p.photo };
				});
				return Object.assign(c, {
					who: s ? s.name : 'Guest',
					email: s ? s.email : c.email,
					city: s ? s.city : '',
					items,
					value: items.reduce((t, i) => t + i.price * i.qty, 0),
					leftAt: parse(c.left),
					sentAt: c.sent.map(parse),
					orderedAt: c.ordered ? parse(c.ordered) : null,
				});
			})
			.sort((a, b) => b.leftAt - a.leftAt),
		filter: 'all',
		expanded: false,
		query: '',
		open: null,
	};

	function nodeById(id) {
		return state.carts.find((c) => c.id === id);
	}

	function clearsAt(c) {
		return addMin(c.leftAt, state.rules.keep * 1440);
	}

	function statusOf(c) {
		if (c.order) return 'recovered';
		if (clearsAt(c) <= NOW) return 'expired';
		return c.sentAt.length ? 'reminded' : 'waiting';
	}
	/* When the next reminder goes, or null when none is due. */
	function nextReminder(c) {
		if (!state.rules.on || statusOf(c) === 'recovered' || statusOf(c) === 'expired' || c.sentAt.length >= 2)
			return null;
		const due = addMin(c.leftAt, c.sentAt.length ? state.rules.second : state.rules.first);
		return due > NOW ? due : addMin(NOW, 1);
	}
	const STATUS = {
		waiting: { label: 'Waiting', tone: 'info' },
		reminded: { label: 'Reminded', tone: 'warning' },
		recovered: { label: 'Recovered', tone: 'success' },
		expired: { label: 'Expired', tone: '' },
	};

	function stateTag(c) {
		const s = STATUS[statusOf(c)];
		return `<span class="basalt-status basalt-status-dot${s.tone ? ` basalt-status-${s.tone}` : ''}">${s.label}</span>`;
	}

	const ROWS = 8;

	function itemTotal(c) {
		return c.items.reduce((t, i) => t + i.qty, 0);
	}

	/* The figures */
	const el = {
		rows: pick('[data-ac-rows]'),
		table: pick('[data-ac-table]'),
		empty: pick('[data-ac-empty]'),
		summary: pick('[data-ac-summary]'),
		search: pick('[data-ac-search]'),
		chips: pick('[data-ac-chips]'),
		live: pick('[data-ac-live]'),
		foot: pick('[data-ac-foot]'),
		footNote: pick('[data-ac-foot-note]'),
		more: pick('[data-ac-more]'),
	};
	function fig(k, v) {
		const n = pick(`[data-ac-fig="${k}"]`);
		if (n) n.textContent = v;
	}
	function renderFigures() {
		const monday = startOfDay(addMin(NOW, -((NOW.getDay() + 6) % 7) * 1440));
		const week = state.carts.filter((c) => c.leftAt >= monday);
		const open = state.carts.filter((c) => statusOf(c) === 'waiting' || statusOf(c) === 'reminded');
		const month = state.carts.filter((c) => c.leftAt.getMonth() === NOW.getMonth());
		const won = state.carts.filter((c) => c.order && c.orderedAt.getMonth() === NOW.getMonth());
		const weekOpen = week.filter((c) => open.includes(c)).length;
		fig('week', String(week.length));
		fig('week-note', weekOpen ? `${weekOpen} still open` : 'All closed');
		fig('stake', money(open.reduce((t, c) => t + c.value, 0)));
		fig('stake-note', `in ${plural(open.length, 'cart')}`);
		fig('won', money(won.reduce((t, c) => t + c.value, 0)));
		fig('won-note', `${plural(won.length, 'cart')} in October`);
		const rate = month.length ? Math.round((won.length / month.length) * 100) : 0;
		fig('rate', `${rate}%`);
		fig('rate-note', `${won.length} of ${month.length} carts`);
	}

	/* The list */
	function matches(c) {
		if (state.filter !== 'all' && statusOf(c) !== state.filter) return false;
		const q = state.query.trim().toLowerCase();
		if (!q) return true;
		const hay = [c.who, c.email, c.city, c.id, c.items.map((i) => i.name).join(' ')].join(' ').toLowerCase();
		return q.split(/\s+/).every((w) => hay.includes(w));
	}

	function shown() {
		return state.carts.filter(matches);
	}

	function avatar(c, size) {
		if (!c.customer)
			return `<span class="basalt-avatar ${size} ac-guest" aria-hidden="true"><i class="bi bi-person"></i></span>`;
		return `<span class="basalt-avatar ${size}" data-basalt-avatar data-name="${htmlSafe(c.who)}" aria-hidden="true"></span>`;
	}
	/* Up to two photos, then a "+N" for the rest. */
	function thumbs(c) {
		const lead = c.items
			.slice(0, 2)
			.map(
				(i) =>
					`<img class="ac-thumb" src="${photo(i.photo, 80, 80)}" alt="" width="36" height="36" loading="lazy">`,
			)
			.join('');
		const more =
			c.items.length > 2
				? `<span class="ac-thumb ac-thumb-more" aria-hidden="true">+${c.items.length - 2}</span>`
				: '';
		const names = c.items.map((i) => (i.qty > 1 ? `${i.qty} × ` : '') + i.name).join(', ');
		return `<span class="ac-thumbs">${lead}${more}</span><span class="visually-hidden">${htmlSafe(names)}</span>`;
	}
	function reminders(c) {
		function pill(n, label) {
			const sent = c.sentAt.length >= n;
			return `<span class="ac-rem${sent ? ' is-sent' : ''}">${sent ? '<i class="bi bi-check2" aria-hidden="true"></i>' : ''}${label}</span>`;
		}

		const words = c.sentAt.length === 0 ? 'None sent' : c.sentAt.length === 1 ? '1st sent' : 'Both sent';
		return `<span class="ac-rems" aria-hidden="true">${pill(1, '1st')}${pill(2, '2nd')}</span><span class="visually-hidden">${words}</span>`;
	}

	function fullHref(c) {
		return `shopper-details.html?id=${encodeURIComponent(c.customer)}`;
	}

	function rowHtml(c) {
		const open = c.id === state.open;
		const label = c.customer ? c.who : `Guest, ${c.email}`;
		return `<tr class="ac-row${open ? ' is-open' : ''}" data-ac-id="${htmlSafe(c.id)}"><td class="ac-row-who"><span class="ac-who">${avatar(c, 'basalt-avatar-sm')}<span class="ac-who-text"><span class="ac-who-name">${htmlSafe(c.who)}</span><span class="ac-who-email">${htmlSafe(c.email)}</span></span></span></td><td class="ac-row-items">${thumbs(c)}</td><td class="ac-row-value"><span class="ac-value">${money(c.value)}</span><span class="ac-row-left-inline">${htmlSafe(fmtShort(c.leftAt))}</span></td><td class="ac-row-left"><span class="ac-left-day">${htmlSafe(fmtShort(c.leftAt))}</span><span class="ac-left-time">${htmlSafe(clockText(c.leftAt))}</span></td><td class="ac-row-rem">${reminders(c)}</td><td class="ac-row-status">${stateTag(c)}</td><td class="ac-row-open"><span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-ac-open="${htmlSafe(c.id)}" aria-label="Quick view: ${htmlSafe(label)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>${c.customer ? `<a class="btn btn-icon btn-sm" href="${fullHref(c)}" aria-label="Open full page: ${htmlSafe(c.who)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>` : '<span class="btn btn-icon btn-sm ac-noicon" aria-hidden="true"></span>'}</span></td></tr>`;
	}

	function emptyHtml() {
		const q = state.query.trim();
		const title = q ? `No carts match “${htmlSafe(q)}”` : `No ${STATUS[state.filter].label.toLowerCase()} carts`;
		const text = q
			? `Search looks at shoppers, emails and products${state.filter === 'all' ? '.' : ' in this view only.'}`
			: 'Nothing here right now.';
		const btns =
			(q
				? '<button type="button" class="btn btn-sm btn-outline-secondary" data-ac-clear>Clear the search</button>'
				: '') +
			(state.filter !== 'all'
				? '<button type="button" class="btn btn-sm btn-outline-secondary" data-ac-all>Show all carts</button>'
				: '');
		return `<div class="basalt-empty basalt-empty-compact ac-empty"><span class="ac-empty-icon" aria-hidden="true"><i class="bi ${q ? 'bi-search' : 'bi-cart'}"></i></span><h3 class="basalt-empty-title">${title}</h3><p class="basalt-empty-text">${text}</p><div class="basalt-empty-actions">${btns}</div></div>`;
	}

	function summaryText() {
		function n(s) {
			return state.carts.filter((c) => statusOf(c) === s).length;
		}

		const openN = n('waiting') + n('reminded');
		return `${plural(state.carts.length, 'cart')} left in October, ${openN} still open.`;
	}

	function renderCounts() {
		const n = { all: state.carts.length, waiting: 0, reminded: 0, recovered: 0, expired: 0 };
		state.carts.forEach((c) => {
			n[statusOf(c)] += 1;
		});

		for (const k of Object.keys(n)) {
			const x = pick(`[data-ac-count="${k}"]`);
			if (x) x.textContent = n[k];
		}
	}

	function disposeTips(scope) {
		if (!window.bootstrap || !bootstrap.Tooltip) return;

		for (const t of pickAll('[data-bs-toggle="tooltip"]', scope)) {
			const i = bootstrap.Tooltip.getInstance(t);
			if (i) i.dispose();
		}
	}
	function paintList() {
		el.summary.textContent = summaryText();
		renderCounts();
		const list = shown();
		disposeTips(el.rows);
		/* The first ROWS carts, and a quiet footer that opens the rest. */
		const rows = state.expanded ? list : list.slice(0, ROWS);
		el.rows.innerHTML = rows.map(rowHtml).join('');
		el.foot.hidden = list.length <= ROWS;
		if (list.length > ROWS) {
			el.footNote.textContent = state.expanded
				? `Showing all ${list.length} carts.`
				: `Showing the newest ${ROWS} of ${list.length} carts.`;
			el.more.textContent = state.expanded ? 'Show fewer' : `Show all ${list.length}`;
			el.more.setAttribute('aria-expanded', String(state.expanded));
		}
		if (window.Basalt.avatars) window.Basalt.avatars(el.rows);
		if (window.Basalt.tips) window.Basalt.tips(el.rows);
		el.table.hidden = !list.length;
		el.empty.hidden = !!list.length;
		el.empty.innerHTML = list.length ? '' : emptyHtml();
	}
	function refresh() {
		renderFigures();
		paintList();
	}

	/* Search and chips */
	let findDelay = 0;
	el.search.addEventListener('input', () => {
		clearTimeout(findDelay);
		findDelay = setTimeout(() => {
			state.query = el.search.value;
			paintList();
			if (state.query.trim()) el.live.textContent = `${plural(shown().length, 'cart')} found`;
		}, 120);
	});
	el.search.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && el.search.value) {
			e.preventDefault();
			clearSearch();
		}
	});
	function clearSearch() {
		el.search.value = '';
		state.query = '';
		paintList();
		el.search.focus();
	}
	el.more.addEventListener('click', () => {
		window.Basalt.slide(el.table.parentElement, () => {
			state.expanded = !state.expanded;
			paintList();
		});
	});
	function setFilter(f) {
		state.filter = f;
		state.expanded = false;

		for (const b of pickAll('[data-ac-chip]', el.chips)) {
			b.setAttribute('aria-pressed', String(b.dataset.acChip === f));
		}

		paintList();
	}
	el.chips.addEventListener('click', (e) => {
		const b = e.target.closest('[data-ac-chip]');
		if (b) setFilter(b.dataset.acChip);
	});
	root.addEventListener('click', (e) => {
		if (e.target.closest('[data-ac-clear]')) {
			clearSearch();
			return;
		}
		if (e.target.closest('[data-ac-all]')) {
			setFilter('all');
			el.search.focus();
			return;
		}
		const to = e.target.closest('[data-ac-to-rules]');
		if (to) {
			e.preventDefault();
			const rules = pick('#ac-rules');
			rules.scrollIntoView({
				behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
				block: 'start',
			});
			rules.focus({ preventScroll: true });
		}
	});

	/* A row opens the shopper's page (Cmd/Ctrl or middle click: a new tab);
     the panel icon, or a guest's row, opens the quick view. */
	function onRowClick(e) {
		if (e.target.closest('a')) return;
		const quick = e.target.closest('[data-ac-open]');
		if (quick) {
			openCart(quick.dataset.acOpen);
			return;
		}
		const tr = e.target.closest('tr[data-ac-id]');
		if (!tr) return;
		const c = nodeById(tr.dataset.acId);
		if (!c.customer) {
			if (e.button === 0) openCart(c.id);
			return;
		}
		if (e.metaKey || e.ctrlKey || e.button === 1) window.open(fullHref(c), '_blank', 'noopener');
		else if (e.button === 0) location.href = fullHref(c);
	}
	el.rows.addEventListener('click', onRowClick);
	el.rows.addEventListener('auxclick', (e) => {
		if (e.button === 1 && !e.target.closest('button')) onRowClick(e);
	});

	/* The side panel: one cart */
	const drawer = pick('#ac-cart');
	const dEl = {
		title: pick('[data-ac-d="title"]', drawer),
		sub: pick('[data-ac-d="sub"]', drawer),
		full: pick('[data-ac-d="full"]', drawer),
		body: pick('[data-ac-d="body"]', drawer),
		foot: pick('[data-ac-d="foot"]', drawer),
	};

	function panel() {
		return bootstrap.Offcanvas.getOrCreateInstance(drawer);
	}

	function itemsHtml(c) {
		return `<ul class="ac-items">${c.items
			.map(
				(i) =>
					`<li class="ac-item"><img class="ac-item-img" src="${photo(i.photo, 112, 112)}" alt="" width="48" height="48" loading="lazy"><span class="ac-item-text"><span class="ac-item-name">${htmlSafe(i.name)}</span><span class="ac-item-meta">${i.size ? `Size ${htmlSafe(i.size)} · ` : ''}Qty ${i.qty}</span></span><span class="ac-item-price">${money(i.price * i.qty)}</span></li>`,
			)
			.join('')}</ul><p class="ac-total"><span>Cart value</span><strong>${money(c.value)}</strong></p>`;
	}

	/* Left checkout, the two emails, then how it ended (or will). */
	function timelineHtml(c) {
		const st = statusOf(c);
		const steps = [{ tone: 'left', icon: 'bi-cart3', title: 'Left checkout', when: fmtLong(c.leftAt) }];
		const next = nextReminder(c);
		['1st', '2nd'].forEach((name, i) => {
			const at = c.sentAt[i];
			const code = i === 1 && state.rules.code ? `, with ${state.rules.code}` : '';
			if (at)
				steps.push({
					tone: 'sent',
					icon: 'bi-envelope-check',
					title: `${name} email sent${code}`,
					when: fmtLong(at),
				});
			else if (next && i === c.sentAt.length)
				steps.push({
					tone: 'due',
					icon: 'bi-envelope',
					title: `${name} email goes ${fromNow(next)}${code}`,
					when: 'Scheduled',
				});
			else if (st === 'waiting' || st === 'reminded')
				steps.push({
					tone: 'due',
					icon: 'bi-envelope',
					title: `${name} email`,
					when: state.rules.on ? 'After the 1st' : 'Reminders are off',
				});
		});
		if (st === 'recovered')
			steps.push({
				tone: 'won',
				icon: 'bi-bag-check',
				title: 'Ordered',
				when: fmtLong(c.orderedAt),
				link: c.order,
			});
		else if (st === 'expired')
			steps.push({ tone: 'end', icon: 'bi-hourglass-bottom', title: 'Cart cleared', when: fmtLong(clearsAt(c)) });
		else
			steps.push({
				tone: 'due',
				icon: 'bi-hourglass-split',
				title: `Cart clears ${fromNow(clearsAt(c))}`,
				when: 'If nothing is bought',
			});
		return `<ol class="ac-tl">${steps
			.map(
				(s) =>
					`<li class="ac-tl-item ac-tl-item-${s.tone}"><span class="ac-tl-dot" aria-hidden="true"><i class="bi ${s.icon}"></i></span><span class="ac-tl-title">${htmlSafe(s.title)}${s.link ? ` <a href="order-details.html?id=${encodeURIComponent(s.link)}">${htmlSafe(s.link)}</a>` : ''}</span><span class="ac-tl-when">${htmlSafe(s.when)}</span></li>`,
			)
			.join('')}</ol>`;
	}

	function checkoutLink(c) {
		return `https://marlo.shop/checkout/${c.id.toLowerCase()}`;
	}

	function footHtml(c) {
		const st = statusOf(c);
		if (st === 'recovered')
			return `<a class="btn btn-sm btn-outline-secondary" href="order-details.html?id=${encodeURIComponent(c.order)}"><i class="bi bi-receipt me-1" aria-hidden="true"></i>Open order</a>`;
		if (st === 'expired') return '';
		const copy = `<button type="button" class="btn btn-sm btn-outline-secondary" data-basalt-copy="${htmlSafe(checkoutLink(c))}" data-basalt-copy-done="Link copied"><i class="bi bi-link-45deg me-1" aria-hidden="true"></i>Copy checkout link</button>`;
		const send =
			c.sentAt.length < 2
				? '<button type="button" class="btn btn-sm btn-primary" data-ac-send><i class="bi bi-send me-1" aria-hidden="true"></i>Send reminder</button>'
				: '';
		return copy + send;
	}
	function noteHtml(c) {
		const st = statusOf(c);
		if (st === 'expired')
			return '<p class="ac-d-note">This cart was cleared. The shopper can still order from the shop as usual.</p>';
		if (st === 'reminded' && c.sentAt.length >= 2)
			return '<p class="ac-d-note">Both emails have gone out. You can still send the checkout link yourself.</p>';
		return '';
	}

	function paintSheet() {
		const c = nodeById(state.open);
		if (!c) return;
		disposeTips(drawer);
		dEl.title.textContent = c.who;
		dEl.sub.textContent = c.customer ? `${c.email} · ${c.city}` : `${c.email} · checked out as a guest`;
		dEl.full.hidden = !c.customer;
		if (c.customer) dEl.full.href = fullHref(c);
		dEl.body.innerHTML = `<div class="ac-d-facts">${stateTag(c)}<span class="ac-d-fact">${plural(itemTotal(c), 'item')} · ${money(c.value)}</span></div><section class="ac-d-section" aria-labelledby="ac-d-items"><h3 class="ac-d-h" id="ac-d-items">In the cart</h3>${itemsHtml(c)}</section><section class="ac-d-section" aria-labelledby="ac-d-rem"><h3 class="ac-d-h" id="ac-d-rem">Reminders</h3>${timelineHtml(c)}${noteHtml(c)}</section>`;
		dEl.foot.innerHTML = footHtml(c);
		dEl.foot.hidden = !dEl.foot.innerHTML;
		if (window.Basalt.buttons) window.Basalt.buttons(dEl.foot);
	}

	function openCart(id) {
		if (!nodeById(id)) return;
		state.open = id;
		paintSheet();
		paintList();
		panel().show();
	}
	drawer.addEventListener('shown.bs.offcanvas', () => dEl.title.focus());
	drawer.addEventListener('hidden.bs.offcanvas', () => {
		const id = state.open;
		state.open = null;
		paintList();
		const btn = id && pick(`[data-ac-open="${CSS.escape(id)}"]`, el.rows);
		if (btn) btn.focus({ preventScroll: true });
	});

	/* Send the next reminder now. */
	drawer.addEventListener('click', (e) => {
		if (!e.target.closest('[data-ac-send]')) return;
		const c = nodeById(state.open);
		if (!c || c.sentAt.length >= 2) return;
		c.sentAt.push(NOW);
		const which = c.sentAt.length === 1 ? '1st' : '2nd';
		paintSheet();
		refresh();
		toast({
			tone: 'success',
			title: `${which} reminder sent`,
			text: `Sent to ${c.customer ? c.who : c.email}.`,
			duration: 4000,
		});
		dEl.title.focus();
	});

	/* Reminder settings */
	const form = pick('[data-ac-rules]');

	function field(k) {
		return pick(`[data-ac-rule="${k}"]`, form);
	}

	const flow = pick('[data-ac-flow]', form);
	function fillRules() {
		field('on').checked = state.rules.on;
		field('first').value = String(state.rules.first);
		field('second').value = String(state.rules.second);
		field('code').value = state.rules.code;
		field('keep').value = String(state.rules.keep);
		paused();
	}
	/* With reminders off, the two email steps fade back but stay editable. */
	function paused() {
		flow.classList.toggle('is-off', !field('on').checked);
	}
	start();
})();
