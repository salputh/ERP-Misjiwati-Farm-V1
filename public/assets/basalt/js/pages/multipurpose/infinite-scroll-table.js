/**
 * Basalt - Infinite scroll table page
 * One table of the Marlo shop's latest 140 orders. The orders come
 * from a seeded generator, so they are the same on every load,
 * and "loading" is a short timer. A marker under the table is
 * watched against the window: each time the reader scrolls
 * down to it, one batch of 20 is added, and the next batch
 * waits until they scroll down to the new end. Search, the
 * status filter and sorting work on all 140 and start again
 * from the top.
 */
(() => {
	'use strict';
	const page = pick('[data-tinf-root]');
	const card = page && pick('[data-tinf-orders]', page);
	if (!card) return;

	const table = pick('[data-tinf-table]', card);
	const body = pick('[data-tinf-body]', card);
	const bones = pick('[data-tinf-bones]', card);
	const sentinel = pick('[data-tinf-sentinel]', card);
	const moreBtn = pick('[data-tinf-more]', card);
	const endLine = pick('[data-tinf-end]', card);
	const count = pick('[data-tinf-count]', card);
	const search = pick('[data-tinf-search]', card);
	const stateField = pick('[data-tinf-status]', card);
	const title = pick('#tinf-title', card);
	const topBtn = pick('[data-tinf-top]', page);
	const topBar = pick('.basalt-topbar');
	const footer = pick('.basalt-pagefoot');

	const TOTAL = 140;
	const BATCH = 20;
	const DELAY = 500;

	function start() {
		window.addEventListener(
			'scroll',
			() => {
				if (!ticking) {
					ticking = true;
					requestAnimationFrame(onScroll);
				}
			},
			{ passive: true },
		);
		topBtn.addEventListener('click', () => {
			window.scrollTo({ top: 0, behavior: reduce.matches ? 'instant' : 'smooth' });
			title.focus({ preventScroll: true });
		});

		/* Start */
		onScroll();
		restart();
	}

	/* Small helpers */
	function htmlSafe(v) {
		return String(v == null ? '' : v)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
	const int = new Intl.NumberFormat('en-US');

	function longDate(t) {
		return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function pad(n) {
		return String(n).padStart(2, '0');
	}

	function clock(t) {
		const d = new Date(t);
		const h = d.getHours();
		return `${h % 12 || 12}:${pad(d.getMinutes())}${h < 12 ? ' am' : ' pm'}`;
	}

	function initials(name) {
		return name
			.split(' ')
			.map((w) => w[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

	/* Seeded random, so the orders are the same on every load. */
	function seeded(seed) {
		let a = seed;
		return function () {
			a |= 0;
			a = (a + 0x6d2b79f5) | 0;
			let t = Math.imul(a ^ (a >>> 15), 1 | a);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	/* Wraps each case-insensitive hit of `q` in <mark>, escaping everything else. */
	function mark(text, q) {
		const s = String(text);
		if (!q) return htmlSafe(s);
		const low = s.toLowerCase();
		let out = '';
		let from = 0;
		let at = low.indexOf(q, from);
		while (at !== -1) {
			out += `${htmlSafe(s.slice(from, at))}<mark class="tinf-mark">${htmlSafe(s.slice(at, at + q.length))}</mark>`;
			from = at + q.length;
			at = low.indexOf(q, from);
		}
		return out + htmlSafe(s.slice(from));
	}

	const STATUSES = ['Awaiting payment', 'Processing', 'Shipped', 'Delivered', 'Refunded'];
	const TONE = {
		'Awaiting payment': 'warning',
		Processing: '',
		Shipped: 'info',
		Delivered: 'success',
		Refunded: 'danger',
	};

	function pill(label) {
		const tone = TONE[label];
		return `<span class="basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}">${htmlSafe(label)}</span>`;
	}

	/* The orders */
	const FIRST = [
		'Elaine',
		'Trent',
		'Abby',
		'Leon',
		'Connie',
		'Gerald',
		'Pamela',
		'Jim',
		'Carly',
		'Jonah',
		'Dawn',
		'Ike',
		'Hope',
		'Felix',
		'Allie',
		'Russ',
		'Clara',
		'Emil',
		'Yara',
		'Silas',
		'Felicia',
		'Derek',
		'Sandra',
		'Lyle',
		'Jill',
		'Ace',
		'Elsa',
		'Kirk',
		'Mae',
		'Rory',
		'Robyn',
		'Theo',
		'Ada',
		'Bruno',
		'Cheryl',
		'Malik',
	];
	const LAST = [
		'Nugent',
		'Leach',
		'Morrow',
		'McCall',
		'Reese',
		'Hughes',
		'Fleming',
		'Mathis',
		'Dillon',
		'Roe',
		'Krause',
		'Quigley',
		'Stout',
		'Barlow',
		'Cannon',
		'Iyer',
		'Kerr',
		'Dahl',
		'Hanson',
		'Keller',
		'Walsh',
		'McKay',
		'Farouk',
		'Buchanan',
		'Quinn',
		'McGee',
		'Larsen',
		'Oduya',
	];
	const CITIES = [
		'Akron',
		'Eugene',
		'Minot',
		'Olympia',
		'Stamford',
		'Topeka',
		'Waco',
		'Duluth',
		'Durango',
		'Ames',
		'Boulder',
		'Sioux Falls',
		'Santa Rosa',
		'Tacoma',
		'Mansfield',
		'La Crosse',
		'Syracuse',
		'Lincoln',
		'Dayton',
		'Helena',
	];
	/* Shop items at list price. The shoes and eyewear are listed twice so
     they turn up in more orders than coats and gowns do. */
	const PRODUCTS = [
		['Sculpted Shoulder Blazer', 1290],
		['Draped Column Gown', 2150],
		['Tiered Organza Dress', 1680],
		['Chalk-Stripe Suit', 2450],
		['Leather Trench Coat', 3200],
		['Bar Loafers', 790],
		['Two-Tone Oxfords', 850],
		['Cat-Eye Sunglasses', 465],
		['Shield Sunglasses', 520],
		['E-Gift Card, $250', 250],
		['Made-to-Measure Tailoring', 4800],
		['Private Styling Session', 650],
		['Bar Loafers', 790],
		['Shield Sunglasses', 520],
		['Two-Tone Oxfords', 850],
		['E-Gift Card, $250', 250],
	];

	/* Newest first, a few minutes to a few hours apart, so the 140 orders
     cover about the last ten days. Recent orders are still moving. */
	const ORDERS = (function build() {
		const rand = seeded(4817);

		function anyOf(list) {
			return list[Math.floor(rand() * list.length)];
		}

		const now = new Date();
		now.setSeconds(0, 0);
		let t = now.getTime() - 9 * 60e3;
		const list = new Array(TOTAL);
		for (let i = 0; i < TOTAL; i += 1) {
			const age = (now.getTime() - t) / 864e5;
			const r = rand();
			let status;
			if (age < 1) status = r < 0.4 ? 'Awaiting payment' : 'Processing';
			else if (age < 4) status = r < 0.3 ? 'Processing' : 'Shipped';
			else status = r < 0.05 ? 'Refunded' : r < 0.1 ? 'Shipped' : 'Delivered';
			const lines = 1 + Math.floor(rand() * rand() * 6);
			const names = [];
			let total = 0;
			for (let k = 0; k < lines; k += 1) {
				const p = anyOf(PRODUCTS);
				names.push(p[0]);
				total += p[1];
			}
			const name = `${anyOf(FIRST)} ${anyOf(LAST)}`;
			const city = anyOf(CITIES);
			const id = 58400 - i;
			list[i] = {
				id,
				name,
				city,
				t,
				lines,
				first: names[0],
				status,
				total: Math.round(total * 100) / 100,
				hay: `#${id} ${name} ${city} ${names.join(' ')}`.toLowerCase(),
			};
			t -= (5 + rand() * 190) * 60e3;
		}
		return list;
	})();

	/* State */
	const state = {
		sort: { key: 'date', dir: 'desc' },
		q: '',
		status: '',
		list: ORDERS,
		shown: 0,
		busy: false,
	};
	let timer = 0;

	const KEY = {
		id: (o) => o.id,
		customer: (o) => o.name,
		items: (o) => o.lines,
		date: (o) => o.t,
		status: (o) => STATUSES.indexOf(o.status),
		total: (o) => o.total,
	};

	function filterAndSort() {
		const q = state.q;
		const key = KEY[state.sort.key];
		const dir = state.sort.dir === 'asc' ? 1 : -1;
		const list = ORDERS.filter(
			(o) => (!state.status || o.status === state.status) && (!q || o.hay.indexOf(q) !== -1),
		);
		list.sort((a, b) => {
			const x = key(a);
			const y = key(b);
			const r = typeof x === 'string' ? x.localeCompare(y) : x - y;
			return (r || b.t - a.t) * (r ? dir : 1);
		});
		state.list = list;
	}

	/* Rows */
	function row(o, index) {
		const q = state.q;
		const more = o.lines > 1 ? `${o.lines} items` : '1 item';
		return `<tr aria-rowindex="${index + 2}"><td class="tinf-col-id"><span class="tinf-mono">${mark(`#${o.id}`, q)}</span></td><td class="tinf-col-customer"><span class="tinf-person"><span class="tinf-avatar" aria-hidden="true">${initials(o.name)}</span><span><span class="tinf-strong">${mark(o.name, q)}</span><span class="tinf-sub">${mark(o.city, q)}</span></span></span></td><td class="tinf-col-items"><span class="tinf-clip">${mark(o.first, q)}</span><span class="tinf-sub">${more}</span></td><td class="tinf-col-date">${longDate(o.t)} <span class="tinf-sub">${clock(o.t)}</span></td><td class="tinf-col-status">${pill(o.status)}</td><td class="tinf-col-total text-end tinf-strong">${usd.format(o.total)}</td></tr>`;
	}

	/* Placeholder rows while a batch "loads". Widths vary so they read as text. */
	const WIDTHS = [
		[58, 72, 80, 64, 50, 60],
		[66, 60, 62, 70, 44, 52],
		[52, 78, 70, 58, 56, 66],
		[62, 66, 56, 74, 48, 58],
	];
	const COLS = ['id', 'customer', 'items', 'date', 'status', 'total'];

	function skeleton() {
		return WIDTHS.map(
			(w) =>
				`<tr>${COLS.map((c, i) => `<td class="tinf-col-${c}${c === 'total' ? ' text-end' : ''}"><span class="tinf-bone" style="--tinf-w:${w[i]}%"></span></td>`).join('')}</tr>`,
		).join('');
	}

	/* Count and end line */
	function what(n) {
		return n === 1 ? 'order' : 'orders';
	}
	function say() {
		const n = state.list.length;
		if (!n) count.textContent = 'No orders match';
		else if (!state.shown) count.textContent = 'Loading orders';
		else count.textContent = `Showing 1–${int.format(state.shown)} of ${int.format(n)} ${what(n)}`;
	}

	function finish() {
		const n = state.list.length;
		const done = state.shown >= n;
		moreBtn.hidden = done;
		endLine.hidden = !done || !n;
		if (done && n) {
			endLine.textContent =
				n === 1
					? 'That’s the only order that matches.'
					: state.q || state.status
						? `That’s all ${int.format(n)} orders that match.`
						: `That’s all ${int.format(n)} orders.`;
		}
		if (!done) {
			const next = Math.min(BATCH, n - state.shown);
			moreBtn.textContent = `Load the next ${next} ${what(next)}`;
		}
	}

	/* Loading */
	/* `from` is 'scroll', 'keys' or 'top-up'. A batch asked for from the
     keyboard moves focus to its first row, so the reader carries on there. */
	function loadNext(from) {
		if (state.busy || state.shown >= state.list.length) return;
		state.busy = true;
		armed = false;
		scrolled = false;
		body.setAttribute('aria-busy', 'true');
		bones.innerHTML = skeleton();
		timer = window.setTimeout(() => {
			timer = 0;
			const start = state.shown;
			const next = state.list.slice(start, start + BATCH);
			body.insertAdjacentHTML('beforeend', next.map((o, i) => row(o, start + i)).join(''));
			state.shown += next.length;
			bones.innerHTML = '';
			state.busy = false;
			body.removeAttribute('aria-busy');
			say();
			finish();
			if (state.shown >= state.list.length) unwatch();
			if (from === 'keys') {
				const first = body.rows[start];
				first.tabIndex = -1;
				first.focus({ preventScroll: true });
				first.scrollIntoView({ block: 'nearest' });
			}
			/* The first batch after a (re)start tops the page up once if it did
         not fill the window, so there is something to scroll. After that,
         every batch waits for the reader to scroll down to the end again. */
			if (
				start === 0 &&
				state.shown < state.list.length &&
				sentinel.getBoundingClientRect().bottom <= window.innerHeight
			) {
				loadNext('top-up');
			}
		}, DELAY);
	}

	/* The marker under the table
	   It counts as reached only when it is fully in the window. One arrival
	   adds one batch; the next one needs the marker to have left the window
	   and a real scroll to bring it back. */
	let io = null;
	let armed = false;
	let scrolled = false;
	function watch() {
		if (!('IntersectionObserver' in window)) return;
		if (!sentinel.isConnected) table.after(sentinel);
		if (io) io.disconnect();
		armed = false;
		io = new IntersectionObserver(
			(entries) => {
				const entry = entries[entries.length - 1];
				if (!entry.isIntersecting) {
					armed = true;
					return;
				}
				/* Tabbing to the load button brings the marker into view too; the
         button does the loading then, not the scroll. */
				if (!armed || !scrolled || state.busy || document.activeElement === moreBtn) return;
				loadNext('scroll');
			},
			{ root: null, rootMargin: '0px', threshold: 1 },
		);
		io.observe(sentinel);
	}
	function unwatch() {
		if (io) io.disconnect();
		io = null;
		sentinel.remove();
	}

	function restart() {
		window.clearTimeout(timer);
		timer = 0;
		state.busy = false;
		state.shown = 0;
		filterAndSort();
		body.innerHTML = '';
		bones.innerHTML = '';
		endLine.hidden = true;
		moreBtn.hidden = true;
		watch();
		table.setAttribute('aria-rowcount', String(state.list.length + 1));
		/* Scrolled down past the table's start? Go back to it, so the new list
       is read from the first row. */
		const top = table.getBoundingClientRect().top;
		if (top < topOffset()) {
			window.scrollTo({ top: window.scrollY + top - topOffset() - 16, behavior: 'instant' });
		}
		if (!state.list.length) {
			unwatch();
			body.innerHTML =
				'<tr aria-rowindex="2"><td class="tinf-empty" colspan="6"><p class="tinf-empty-title">No orders match</p><p class="tinf-empty-text">Try a different name, city, item or order number, or clear the status filter.</p></td></tr>';
			say();
			return;
		}
		say();
		loadNext('top-up');
	}

	/* Sticky header: sit right under the top bar */
	function topOffset() {
		return topBar && getComputedStyle(topBar).position !== 'static'
			? Math.floor(topBar.getBoundingClientRect().height)
			: 0;
	}
	function measureTop() {
		page.style.setProperty('--tinf-top', `${topOffset()}px`);
	}
	measureTop();
	if (topBar && 'ResizeObserver' in window)
		new ResizeObserver(() => requestAnimationFrame(measureTop)).observe(topBar);
	else window.addEventListener('resize', measureTop);

	/* Sorting */
	const heads = Array.from(pickAll('th[data-tinf-sort]', table));
	function paintSort() {
		for (const th of heads) {
			const on = th.getAttribute('data-tinf-sort') === state.sort.key;
			const icon = pick('.tinf-sort-icon', th);
			if (on) th.setAttribute('aria-sort', state.sort.dir === 'asc' ? 'ascending' : 'descending');
			else th.removeAttribute('aria-sort');
			icon.className = `bi tinf-sort-icon ${on ? (state.sort.dir === 'asc' ? 'bi-chevron-up' : 'bi-chevron-down') : 'bi-chevron-expand'}`;
		}
	}

	for (const th of heads) {
		pick('.tinf-sort', th).addEventListener('click', () => {
			const key = th.getAttribute('data-tinf-sort');
			if (state.sort.key === key) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
			else state.sort = { key, dir: key === 'date' || key === 'total' ? 'desc' : 'asc' };
			paintSort();
			restart();
		});
	}

	paintSort();

	/* Search and status */
	let typing = 0;
	search.addEventListener('input', () => {
		window.clearTimeout(typing);
		typing = window.setTimeout(() => {
			const q = search.value.trim().toLowerCase();
			if (q === state.q) return;
			state.q = q;
			restart();
		}, 250);
	});
	stateField.addEventListener('change', () => {
		state.status = stateField.value;
		restart();
	});

	/* Next batch from the keyboard */
	moreBtn.addEventListener('click', () => loadNext('keys'));

	/* Back to top */
	let ticking = false;
	function onScroll() {
		ticking = false;
		scrolled = true;
		topBtn.hidden = window.scrollY < window.innerHeight;
		/* Lift the button while the page footer is in view, so it never covers it. */
		const lift = footer ? Math.max(0, window.innerHeight - footer.getBoundingClientRect().top) : 0;
		topBtn.style.setProperty('--tinf-lift', `${lift}px`);
	}
	start();

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
