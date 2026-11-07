/**
 * Basalt - Realtime (realtime.html)
 * Live traffic on the Fieldline website, drawn from LIVE below:
 *   minutes  visitors in each of the last 30 minutes; the last bar is the
 *            minute still running and always equals the live count
 *   pages    every page with someone on it, searched, filtered by section
 *            and sorted by any column
 *   sources, devices, places  the same visitors split three ways
 *   feed     sign-ups, trials, demo bookings and add-on checkouts
 *
 * Every few seconds one visitor arrives or leaves: the page, source,
 * device and place they belong to all move by one, so every split keeps
 * adding up to the live count. New events join the feed now and then.
 * Pause stops the updates; they also stop while the tab is hidden.
 * In your app, replace tick() with your analytics stream (a WebSocket
 * or a poll) and keep the shapes in LIVE.
 */
(() => {
	'use strict';
	const root = pick('[data-rtm-root]', document);
	if (!root) return;

	const TICK = 3000;
	const TICKS_A_MINUTE = 20;

	const LIVE = {
		minutes: [
			188, 191, 186, 194, 197, 193, 199, 204, 201, 196, 203, 208, 205, 211, 207, 202, 209, 214, 212, 206, 210,
			216, 219, 213, 208, 211, 217, 215, 212, 214,
		],
		figures: { views: 96, signups: 7, demos: 12 },
		pages: [
			{ path: '/', title: 'Home', section: 'product', now: 46, time: 52, exit: 31 },
			{ path: '/pricing', title: 'Plans and pricing', section: 'pricing', now: 38, time: 128, exit: 22 },
			{ path: '/travel-planner', title: 'Travel Planner', section: 'product', now: 24, time: 96, exit: 27 },
			{ path: '/features/scheduling', title: 'Scheduling', section: 'product', now: 21, time: 84, exit: 24 },
			{
				path: '/blog/roster-tips',
				title: 'Home care roster tips',
				section: 'blog',
				now: 19,
				time: 214,
				exit: 63,
			},
			{
				path: '/help/import-staff',
				title: 'Import your staff list',
				section: 'help',
				now: 14,
				time: 176,
				exit: 41,
			},
			{ path: '/add-ons', title: 'Fieldline Add-ons', section: 'pricing', now: 12, time: 71, exit: 29 },
			{ path: '/signup', title: 'Start a free trial', section: 'product', now: 11, time: 95, exit: 18 },
			{ path: '/demo', title: 'Book a demo', section: 'product', now: 9, time: 88, exit: 21 },
			{
				path: '/blog/mileage-rules',
				title: 'Mileage rules for carers',
				section: 'blog',
				now: 8,
				time: 241,
				exit: 58,
			},
			{ path: '/features/timesheets', title: 'Timesheets', section: 'product', now: 7, time: 67, exit: 26 },
			{
				path: '/help/sms-reminders',
				title: 'Set up SMS reminders',
				section: 'help',
				now: 3,
				time: 132,
				exit: 37,
			},
			{ path: '/add-ons/sms-credits', title: 'SMS credit packs', section: 'pricing', now: 2, time: 58, exit: 34 },
		],
		sources: [
			{ name: 'Search', now: 82 },
			{ name: 'Direct', now: 54 },
			{ name: 'Paid ads', now: 31 },
			{ name: 'Email', now: 22 },
			{ name: 'Social', now: 15 },
			{ name: 'Other sites', now: 10 },
		],
		devices: [
			{ name: 'Desktop', now: 141 },
			{ name: 'Phone', now: 64 },
			{ name: 'Tablet', now: 9 },
		],
		places: [
			{ name: 'California', now: 88 },
			{ name: 'Texas', now: 41 },
			{ name: 'New York', now: 23 },
			{ name: 'Illinois', now: 19 },
			{ name: 'Washington', now: 12 },
			{ name: 'Colorado', now: 9 },
			{ name: 'Michigan', now: 7 },
			{ name: 'Other states', now: 15 },
		],
		/* ago: seconds before the page opened. */
		feed: [
			{ kind: 'trial', who: 'Someone in Minot, ND', what: 'Started a Growth trial', page: '/signup', ago: 40 },
			{
				kind: 'addon',
				who: 'Brightwater Home Care',
				what: 'Bought 5,000 SMS credits',
				page: '/add-ons/sms-credits',
				ago: 95,
			},
			{
				kind: 'demo',
				who: 'Someone in Concord, NH',
				what: 'Booked a demo for Tuesday',
				page: '/demo',
				ago: 170,
			},
			{ kind: 'signup', who: 'Someone in Waco, TX', what: 'Made an account', page: '/signup', ago: 260 },
			{
				kind: 'trial',
				who: 'Someone in Cheyenne, WY',
				what: 'Started a Starter trial',
				page: '/pricing',
				ago: 410,
			},
			{
				kind: 'addon',
				who: 'Avocet Care Group',
				what: 'Added Travel Planner for 38 staff',
				page: '/travel-planner',
				ago: 530,
			},
			{ kind: 'signup', who: 'Someone in Dayton, OH', what: 'Made an account', page: '/signup', ago: 690 },
			{ kind: 'demo', who: 'Someone in Boulder, CO', what: 'Booked a demo for Friday', page: '/demo', ago: 880 },
			{
				kind: 'signup',
				who: 'Someone in Stamford, CT',
				what: 'Made an account',
				page: '/signup',
				ago: 1040,
			},
			{
				kind: 'trial',
				who: 'Someone in Ames, IA',
				what: 'Started a Growth trial',
				page: '/signup',
				ago: 1310,
			},
		],
		/* New events are drawn from here in turn while the page is open. */
		incoming: [
			{ kind: 'signup', who: 'Someone in Eugene, OR', what: 'Made an account', page: '/signup' },
			{ kind: 'trial', who: 'Someone in Buffalo, NY', what: 'Started a Growth trial', page: '/pricing' },
			{
				kind: 'addon',
				who: 'Larchwood Home Help',
				what: 'Bought 2,000 SMS credits',
				page: '/add-ons/sms-credits',
			},
			{ kind: 'demo', who: 'Someone in Chico, CA', what: 'Booked a demo for Monday', page: '/demo' },
			{ kind: 'signup', who: 'Someone in Mankato, MN', what: 'Made an account', page: '/signup' },
			{
				kind: 'addon',
				who: 'Tidewell Nursing',
				what: 'Added Travel Planner for 12 staff',
				page: '/travel-planner',
			},
		],
	};

	const KIND = {
		signup: { label: 'Sign-up', icon: 'bi-person-plus', tone: 'tone-series-1' },
		trial: { label: 'Trial', icon: 'bi-rocket-takeoff', tone: 'tone-series-2' },
		demo: { label: 'Demo', icon: 'bi-calendar-check', tone: 'tone-series-7' },
		addon: { label: 'Add-on', icon: 'bi-bag-plus', tone: 'tone-series-4' },
	};

	const state = {
		paused: false,
		ticks: 0,
		next: 0,
		sort: { key: 'now', up: false },
		seed: 7,
	};

	function start() {
		drawMinutes();
		drawFigures();
		wirePages();
		drawSplits();
		growOnSight();
		wireFeed();
		wirePause();
		window.setInterval(() => {
			if (!state.paused && !document.hidden) tick();
		}, TICK);
	}

	/* Helpers */
	function pick(selector, scope = root) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = root) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return String(value).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function whole(n) {
		return n.toLocaleString('en-US');
	}

	function total() {
		return LIVE.pages.reduce((sum, p) => sum + p.now, 0);
	}

	function duration(sec) {
		const m = Math.floor(sec / 60);
		const s = sec % 60;
		return m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
	}

	function ago(sec) {
		if (sec < 30) return 'Just now';
		if (sec < 60) return `${sec} sec ago`;
		return `${Math.floor(sec / 60)} min ago`;
	}

	/* A small seeded random, so the demo moves the same way on every load. */
	function random() {
		state.seed = (state.seed * 16807) % 2147483647;
		return (state.seed - 1) / 2147483646;
	}

	/** Picks one entry, weighted by how many visitors it has. */
	function weighted(list) {
		let at = random() * list.reduce((sum, e) => sum + e.now, 0);
		for (const e of list) {
			at -= e.now;
			if (at < 0) return e;
		}
		return list[list.length - 1];
	}

	/* The minute bars and the live count. */
	function drawMinutes() {
		const box = pick('[data-rtm-minutes]');
		const values = LIVE.minutes;
		const top = Math.max(...values) * 1.08;
		const low = Math.min(...values) * 0.85;
		const bars = pickAll('[data-rtm-minute]', box);
		/* After the first draw the bars stay in place and only their heights
		   change, so each new minute slides in through the height transition. */
		if (bars.length === values.length) {
			values.forEach((v, i) => {
				const left = values.length - 1 - i;
				bars[i].className = `rtm-minute${left ? '' : ' is-now'} value-${heightOf(v)}`;
				bars[i].setAttribute('aria-label', `${minuteName(left)}: ${whole(v)} visitors`);
			});
		} else {
			box.innerHTML = values
				.map((v, i) => {
					const left = values.length - 1 - i;
					return `<span class="rtm-minute${left ? '' : ' is-now'} value-${heightOf(v)}" data-rtm-minute="${i}" role="img" tabindex="0" aria-label="${minuteName(left)}: ${whole(v)} visitors"></span>`;
				})
				.join('');
			for (const bar of pickAll('[data-rtm-minute]', box)) {
				bar.addEventListener('pointerenter', () => readMinute(Number(bar.dataset.rtmMinute)));
				bar.addEventListener('focus', () => readMinute(Number(bar.dataset.rtmMinute)));
				bar.addEventListener('pointerleave', () => readMinute());
				bar.addEventListener('blur', () => readMinute());
			}
		}
		box.setAttribute(
			'aria-label',
			`Visitors each minute for the last 30 minutes, from ${whole(values[0])} to ${whole(values[values.length - 1])}`,
		);
		pick('[data-rtm-now]').textContent = whole(total());
		readMinute();

		function heightOf(v) {
			return Math.round(((v - low) / (top - low)) * 100);
		}
	}

	function minuteName(left) {
		return left ? `${left} min ago` : 'This minute';
	}

	function readMinute(index) {
		const read = pick('[data-rtm-read]');
		const values = LIVE.minutes;
		if (index === undefined) {
			const before = values[0];
			const diff = values[values.length - 1] - before;
			read.textContent = `${diff >= 0 ? 'Up' : 'Down'} ${Math.abs(diff)} on half an hour ago. Point at a bar for that minute.`;
			return;
		}
		const left = values.length - 1 - index;
		read.textContent = `${minuteName(left)}: ${whole(values[index])} visitors.`;
	}

	function drawFigures() {
		for (const [key, value] of Object.entries(LIVE.figures))
			pick(`[data-rtm-fig="${key}"]`).textContent = whole(value);
	}

	/* Pages being read */
	function wirePages() {
		pick('[data-rtm-page-search]').addEventListener('input', drawPages);
		pick('[data-rtm-page-show]').addEventListener('change', drawPages);
		for (const th of pickAll('[data-rtm-sort]')) {
			pick('button', th).addEventListener('click', () => {
				const key = th.dataset.rtmSort;
				state.sort = { key, up: state.sort.key === key ? !state.sort.up : key === 'path' };
				drawPages();
			});
		}
		pick('[data-rtm-pages]').addEventListener('click', (event) => {
			if (!event.target.closest('[data-rtm-page-reset]')) return;
			pick('[data-rtm-page-search]').value = '';
			pick('[data-rtm-page-show]').value = 'all';
			drawPages();
		});
		drawPages();
	}

	function drawPages() {
		const q = pick('[data-rtm-page-search]').value.trim().toLowerCase();
		const section = pick('[data-rtm-page-show]').value;
		const { key, up } = state.sort;
		const rows = LIVE.pages
			.filter((p) => section === 'all' || p.section === section)
			.filter((p) => !q || `${p.path} ${p.title}`.toLowerCase().includes(q))
			.sort((a, b) => {
				const d = key === 'path' ? a.path.localeCompare(b.path) : a[key] - b[key];
				return up ? d : -d;
			});
		const busiest = Math.max(...LIVE.pages.map((p) => p.now));
		const sum = total();
		pick('[data-rtm-pages-sum]').textContent =
			`${LIVE.pages.length} pages open. Pricing pages hold ${Math.round((LIVE.pages.filter((p) => p.section === 'pricing').reduce((s, p) => s + p.now, 0) / sum) * 100)}% of visitors.`;
		pick('[data-rtm-page-count]').textContent = `${rows.length} of ${LIVE.pages.length}`;
		for (const th of pickAll('[data-rtm-sort]')) {
			const on = th.dataset.rtmSort === key;
			const icon = pick('.bi', th);
			icon.className = `bi ${on ? (up ? 'bi-arrow-up' : 'bi-arrow-down') : 'bi-arrow-down-up rtm-sort-idle'}`;
			if (on) th.setAttribute('aria-sort', up ? 'ascending' : 'descending');
			else th.removeAttribute('aria-sort');
		}
		const body = pick('[data-rtm-pages]');
		if (!rows.length) {
			body.innerHTML = `<tr><td colspan="4"><div class="basalt-empty basalt-empty-compact"><h3 class="basalt-empty-title">No pages here</h3><p class="basalt-empty-text">Nobody is on a page that matches.</p><div class="basalt-empty-actions"><button data-rtm-page-reset type="button" class="btn btn-outline-secondary btn-sm">Show all pages</button></div></div></td></tr>`;
			return;
		}
		body.innerHTML = rows
			.map((p) => {
				const w = Math.max(2, Math.round((p.now / busiest) * 100));
				return `<tr><td><a href="analytics-dashboard.html" class="rtm-page-link"><span class="rtm-page-path">${htmlSafe(p.path)}</span><span class="rtm-page-title">${htmlSafe(p.title)}</span></a><span class="rtm-page-bar w-${w}" aria-hidden="true"></span></td><td class="rtm-num rtm-strong">${p.now}</td><td class="rtm-num rtm-col-time">${duration(p.time)}</td><td class="rtm-num rtm-col-exit">${p.exit}%</td></tr>`;
			})
			.join('');
	}

	/* Sources, devices and places: three splits of the same visitors. */
	function drawSplits() {
		const sum = total();
		drawBars(pick('[data-rtm-sources]'), LIVE.sources, sum);
		drawBars(pick('[data-rtm-geo]'), LIVE.places, sum);
		const top = [...LIVE.sources].sort((a, b) => b.now - a.now)[0];
		pick('[data-rtm-src-read]').textContent =
			`${top.name} brings the most, ${Math.round((top.now / sum) * 100)}% of everyone here.`;
		const elsewhere = sum - LIVE.places[0].now;
		pick('[data-rtm-geo-read]').textContent =
			`${Math.round((elsewhere / sum) * 100)}% of visitors are outside ${LIVE.places[0].name}.`;
		const strip = pick('[data-rtm-devices]');
		strip.innerHTML = LIVE.devices
			.map(
				(d, i) =>
					`<span class="rtm-device tone-series-${[1, 7, 4, 2][i]} stagger-${i} w-${Math.max(1, Math.round((d.now / sum) * 100))}"></span>`,
			)
			.join('');
		strip.setAttribute(
			'aria-label',
			LIVE.devices.map((d) => `${d.name} ${Math.round((d.now / sum) * 100)}%`).join(', '),
		);
		pick('[data-rtm-device-key]').innerHTML = LIVE.devices
			.map(
				(d, i) =>
					`<li><span class="rtm-key tone-series-${[1, 7, 4, 2][i]}"></span>${d.name}<strong>${Math.round((d.now / sum) * 100)}%</strong></li>`,
			)
			.join('');
	}

	/**
	 * The source, place and device bars wait at zero until their card scrolls
	 * into view, then grow in one after another. Live redraws after that keep
	 * the bars at full length and only move their widths.
	 */
	function growOnSight() {
		if (!('IntersectionObserver' in window)) return;
		const groups = pickAll('[data-rtm-sources], [data-rtm-geo], [data-rtm-devices]');
		for (const group of groups) group.classList.add('is-waiting');
		const watcher = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					watcher.unobserve(entry.target);
					requestAnimationFrame(() => entry.target.classList.remove('is-waiting'));
				}
			},
			{ threshold: 0.35 },
		);
		for (const group of groups) watcher.observe(group);
	}

	function drawBars(list, rows, sum) {
		const top = Math.max(...rows.map((r) => r.now));
		list.innerHTML = rows
			.map(
				(r, i) =>
					`<li class="rtm-bar stagger-${Math.min(i, 15)}"><span class="rtm-bar-name">${htmlSafe(r.name)}</span><span class="rtm-bar-value">${r.now}<span class="rtm-bar-share">${Math.round((r.now / sum) * 100)}%</span></span><span class="rtm-bar-track" aria-hidden="true"><span class="rtm-bar-fill w-${Math.max(1, Math.round((r.now / top) * 100))}"></span></span></li>`,
			)
			.join('');
	}

	/* Just happened */
	function wireFeed() {
		pick('[data-rtm-feed-search]').addEventListener('input', drawFeed);
		pick('[data-rtm-feed-show]').addEventListener('change', drawFeed);
		pick('[data-rtm-feed]').addEventListener('click', (event) => {
			if (!event.target.closest('[data-rtm-feed-reset]')) return;
			pick('[data-rtm-feed-search]').value = '';
			pick('[data-rtm-feed-show]').value = 'all';
			drawFeed();
		});
		drawFeed();
	}

	function drawFeed() {
		const q = pick('[data-rtm-feed-search]').value.trim().toLowerCase();
		const show = pick('[data-rtm-feed-show]').value;
		const rows = LIVE.feed
			.filter((e) => show === 'all' || e.kind === show)
			.filter((e) => !q || `${e.who} ${e.what} ${e.page}`.toLowerCase().includes(q));
		pick('[data-rtm-feed-count]').textContent = `${rows.length} of ${LIVE.feed.length}`;
		const list = pick('[data-rtm-feed]');
		if (!rows.length) {
			list.innerHTML = `<li class="rtm-feed-empty"><div class="basalt-empty basalt-empty-compact"><h3 class="basalt-empty-title">Nothing here yet</h3><p class="basalt-empty-text">No events match. New ones still arrive while you wait.</p><div class="basalt-empty-actions"><button data-rtm-feed-reset type="button" class="btn btn-outline-secondary btn-sm">Show everything</button></div></div></li>`;
			return;
		}
		list.innerHTML = rows
			.map((e) => {
				const k = KIND[e.kind];
				return `<li class="rtm-event${e.fresh ? ' is-fresh' : ''}"><span class="rtm-event-icon ${k.tone}" aria-hidden="true"><i class="bi ${k.icon}"></i></span><span class="rtm-event-main"><span class="rtm-event-what">${htmlSafe(e.what)}</span><span class="rtm-event-who">${htmlSafe(e.who)} · <a href="analytics-dashboard.html">${htmlSafe(e.page)}</a></span></span><span class="rtm-event-when">${ago(e.ago)}</span></li>`;
			})
			.join('');
	}

	/* Live updates */
	function wirePause() {
		const button = pick('[data-rtm-pause]');
		button.addEventListener('click', () => {
			state.paused = !state.paused;
			button.setAttribute('aria-pressed', String(state.paused));
			pick('.bi', button).className = `bi ${state.paused ? 'bi-play-fill' : 'bi-pause-fill'} me-1`;
			pick('span', button).textContent = state.paused ? 'Resume' : 'Pause';
			pick('.rtm-now-label .basalt-status').classList.toggle('basalt-status-live', !state.paused);
		});
	}

	function tick() {
		state.ticks += 1;
		/* One visitor arrives or leaves, and every split moves with them. */
		const delta = random() < 0.52 ? 1 : -1;
		for (const list of [LIVE.pages, LIVE.sources, LIVE.devices, LIVE.places]) {
			const entry = weighted(list.filter((e) => delta > 0 || e.now > 1));
			entry.now += delta;
		}
		LIVE.minutes[LIVE.minutes.length - 1] = total();
		if (state.ticks % TICKS_A_MINUTE === 0) {
			LIVE.minutes.shift();
			LIVE.minutes.push(total());
		}
		LIVE.figures.views = Math.max(60, LIVE.figures.views + Math.round((random() - 0.5) * 6));
		for (const e of LIVE.feed) e.ago += TICK / 1000;
		for (const e of LIVE.feed) e.fresh = false;
		if (state.ticks % 5 === 0) {
			const e = { ...LIVE.incoming[state.next % LIVE.incoming.length], ago: 0, fresh: true };
			state.next += 1;
			LIVE.feed.unshift(e);
			LIVE.feed.length = Math.min(LIVE.feed.length, 12);
			if (e.kind === 'signup' || e.kind === 'trial') LIVE.figures.signups += 1;
			if (e.kind === 'demo') LIVE.figures.demos += 1;
		}
		drawMinutes();
		drawFigures();
		drawPages();
		drawSplits();
		drawFeed();
	}

	start();
})();
