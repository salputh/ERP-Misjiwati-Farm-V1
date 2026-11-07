/**
 * Basalt - Social Planner (social-planner.html)
 * Marlo's social posts on a calendar (a week of picture tiles or the
 * whole month), then the next few to go out and the drafts waiting
 * for an OK. A row, its title, its expand icon and the quick view's
 * button open social-post-details.html?id=<id>; a row's panel icon, or a
 * tile on the calendar, opens a quick view.
 *
 * Data: assets/basalt/js/data/multipurpose/social.js (window.Basalt.data.social), which
 * reads pictures from assets/basalt/js/data/multipurpose/catalog.js. Changes made here
 * (approving a draft, dragging a post to another day) live in memory
 * only; send them to your scheduling service where noted.
 *
 * Wide cards show the week as seven columns of tiles and the month as
 * a grid; narrow ones show the week as a day-by-day list and the month
 * as small day buttons with the chosen day's posts under them.
 */
(() => {
	'use strict';
	const root = pick('[data-sp-root]');
	if (!root || !window.Basalt.data || !window.Basalt.data.social) return;

	const S = window.Basalt.data.social;

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

	const CH = {};
	S.channels.forEach((c) => {
		CH[c.id] = c;
	});
	const posts = S.posts();

	function nodeById(id) {
		return posts.find((p) => p.id === id) || null;
	}

	/* Dates */
	function parse(iso) {
		const [d, t] = iso.split('T');
		const [y, m, day] = d.split('-').map(Number);
		const [h, min] = (t || '0:0').split(':').map(Number);
		return new Date(y, m - 1, day, h, min);
	}

	const NOW = parse(S.now);

	function keyOf(d) {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function isoOf(d) {
		return `${keyOf(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	function shiftDays(d, n) {
		return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
	}

	function dayStart(d) {
		return new Date(d.getFullYear(), d.getMonth(), d.getDate());
	}

	function weekStart(d) {
		return shiftDays(dayStart(d), -((d.getDay() + 6) % 7));
	}

	function onSameDay(a, b) {
		return keyOf(a) === keyOf(b);
	}

	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
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

	function time(d) {
		return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'am' : 'pm'}`;
	}

	function dayName(d) {
		const diff = Math.round((dayStart(d) - dayStart(NOW)) / 864e5);
		if (diff === 0) return 'Today';
		if (diff === 1) return 'Tomorrow';
		if (diff === -1) return 'Yesterday';
		return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function when(d) {
		return `${dayName(d)}, ${time(d)}`;
	}

	/* The same, inside a sentence: "goes out today, 4:00 pm". */
	function whenMid(d) {
		return when(d).replace(/^(Today|Tomorrow|Yesterday)/, (w) => w.toLowerCase());
	}

	function longDay(d) {
		return `${DAYS_LONG[d.getDay()]}, ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}`;
	}

	function until(d) {
		const mins = Math.round((d - NOW) / 6e4);
		if (mins < 60) return `in ${mins} min`;
		const days = Math.round((dayStart(d) - dayStart(NOW)) / 864e5);
		if (days === 0) {
			const h = Math.round(mins / 60);
			return `in ${h}${h === 1 ? ' hour' : ' hours'}`;
		}
		if (days === 1) return 'tomorrow';
		return `in ${days} days`;
	}

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many || `${one}s`}`;
	}

	function list(names) {
		return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
	}

	/* Small parts */
	const STATUS = {
		published: { label: 'Published', tone: 'success' },
		scheduled: { label: 'Scheduled', tone: 'primary' },
		draft: { label: 'Draft', tone: 'warning' },
	};

	function channelNames(p) {
		return list(p.channels.map((c) => CH[c].name));
	}

	function marks(p) {
		return `<span class="sp-marks">${p.channels.map((c) => `<span class="sp-mark sp-tone-${CH[c].tone}" aria-hidden="true"><i class="bi ${CH[c].icon}"></i></span>`).join('')}<span class="visually-hidden">${htmlSafe(channelNames(p))}</span></span>`;
	}

	function pill(p) {
		return `<span class="basalt-status basalt-status-dot basalt-status-${STATUS[p.status].tone}">${STATUS[p.status].label}</span>`;
	}

	function thumb(p, size, cls) {
		return `<img class="${cls}" src="${S.photoOf(p, size * 2, size * 2)}" alt="" width="${size}" height="${size}" loading="lazy">`;
	}

	function page(p) {
		return `social-post-details.html?id=${encodeURIComponent(p.id)}`;
	}

	function actions(p) {
		return `<span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-sp-open="${htmlSafe(p.id)}" aria-label="Quick view: ${htmlSafe(p.title)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${page(p)}" aria-label="Open full page: ${htmlSafe(p.title)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span>`;
	}

	function rowHead(p, meta) {
		return `${thumb(p, 48, 'sp-thumb')}<div class="sp-row-main"><p class="sp-row-title"><a class="sp-row-link" href="${page(p)}">${htmlSafe(p.title)}</a></p><p class="sp-row-meta">${marks(p)}<span>${meta}</span></p></div>`;
	}

	function disposeTips(scope) {
		if (!window.bootstrap || !scope) return;

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

	function start(scope) {
		if (window.Basalt.avatars) window.Basalt.avatars(scope);
		if (window.Basalt.tips) window.Basalt.tips(scope);
	}

	function say(text) {
		const live = pick('[data-sp-live]', root);
		if (live) {
			live.textContent = '';
			setTimeout(() => {
				live.textContent = text;
			}, 30);
		}
	}
	function toast(o) {
		if (window.Basalt.toasts) window.Basalt.toasts.push(o);
		else say(`${o.title}. ${o.text || ''}`);
	}

	/* Next up, and the drafts waiting for an OK */
	const el = {
		next: pick('[data-sp-next]', root),
		nextNote: pick('[data-sp-next-note]', root),
		wait: pick('[data-sp-wait]', root),
		waitNote: pick('[data-sp-wait-note]', root),
		cal: pick('[data-sp-cal]', root),
		period: pick('[data-sp-period]', root),
		chips: pick('[data-sp-chips]', root),
	};

	function upcoming() {
		return posts
			.filter((p) => p.status === 'scheduled' && parse(p.at) > NOW)
			.sort((a, b) => parse(a.at) - parse(b.at));
	}

	function waiting() {
		return posts.filter((p) => p.status === 'draft').sort((a, b) => parse(a.at) - parse(b.at));
	}

	function renderTop() {
		disposeTips(el.next);
		disposeTips(el.wait);
		const up = upcoming();
		el.next.innerHTML =
			up
				.slice(0, 3)
				.map(
					(p) =>
						`<li class="sp-row" data-sp-id="${htmlSafe(p.id)}">${rowHead(p, htmlSafe(when(parse(p.at))))}<span class="sp-row-soon">${htmlSafe(until(parse(p.at)))}</span>${actions(p)}</li>`,
				)
				.join('') || '<li class="sp-row sp-row-empty">Nothing booked yet.</li>';
		const rest = up.length - 3;
		el.nextNote.textContent =
			rest > 0 ? `${plural(rest, 'more post')} booked after these.` : 'That is everything booked.';

		const w = waiting();
		el.wait.innerHTML =
			w
				.slice(0, 3)
				.map(
					(p) =>
						`<li class="sp-row sp-row-wait" data-sp-id="${htmlSafe(p.id)}">${rowHead(p, `${htmlSafe(p.by)} · for ${htmlSafe(dayName(parse(p.at)))}`)}<button type="button" class="btn btn-outline-secondary btn-sm sp-row-approve" data-sp-approve="${htmlSafe(p.id)}"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Approve</button>${actions(p)}</li>`,
				)
				.join('') ||
			'<li class="sp-row sp-row-empty"><span class="sp-done" aria-hidden="true"><i class="bi bi-check2-all"></i></span>All caught up. Nothing is waiting for you.</li>';
		el.waitNote.textContent =
			w.length > 3
				? `${plural(w.length - 3, 'more draft')} after these, on the calendar.`
				: w.length
					? 'Drafts stay off the channels until you approve them.'
					: 'New drafts from the team show up here.';
		start(el.next);
		start(el.wait);
	}

	/* The calendar */
	const state = {
		view: 'week',
		anchor: dayStart(NOW),
		channel: 'all',
		picked: dayStart(NOW),
		wide: true,
		open: null,
	};

	function shown() {
		return posts.filter((p) => state.channel === 'all' || p.channels.includes(state.channel));
	}

	function onDay(d) {
		return shown()
			.filter((p) => onSameDay(parse(p.at), d))
			.sort((a, b) => parse(a.at) - parse(b.at));
	}

	function canMove(p) {
		return p.status !== 'published';
	}

	function tile(p) {
		const at = parse(p.at);
		const label = `${p.title}, ${channelNames(p)}, ${time(at)}, ${STATUS[p.status].label.toLowerCase()}`;
		return `<div class="sp-tile is-${p.status}${state.open === p.id ? ' is-open' : ''}" data-sp-id="${htmlSafe(p.id)}"${canMove(p) ? ' draggable="true"' : ''}><span class="sp-tile-pic"><img src="${S.photoOf(p, 320, 240)}" alt="" width="160" height="120" loading="lazy">${p.status === 'published' ? '<span class="sp-tile-flag sp-tile-flag-out" aria-hidden="true"><i class="bi bi-check-lg"></i></span>' : ''}${p.status === 'draft' ? '<span class="sp-tile-flag sp-tile-flag-draft" aria-hidden="true">Draft</span>' : ''}</span><button type="button" class="sp-tile-btn" data-sp-open="${htmlSafe(p.id)}" aria-label="${htmlSafe(label)}"><span class="sp-tile-top"><span class="sp-tile-time">${htmlSafe(time(at))}</span>${marks(p)}</span><span class="sp-tile-title">${htmlSafe(p.title)}</span></button></div>`;
	}

	function nowLine() {
		return `<div class="sp-now"><span class="sp-now-label">Now, ${htmlSafe(time(NOW))}</span></div>`;
	}

	function weekWide() {
		const start = weekStart(state.anchor);
		let html = '<div class="sp-week">';
		for (let i = 0; i < 7; i += 1) {
			const d = shiftDays(start, i);
			const items = onDay(d);
			const today = onSameDay(d, NOW);
			const past = dayStart(d) < dayStart(NOW);
			let body = '';
			let lined = false;
			items.forEach((p) => {
				if (today && !lined && parse(p.at) > NOW) {
					body += nowLine();
					lined = true;
				}
				body += tile(p);
			});
			if (today && !lined) body += nowLine();
			html += `<section class="sp-day${today ? ' is-today' : ''}${past ? ' is-past' : ''}" aria-label="${htmlSafe(longDay(d))}${items.length ? `, ${plural(items.length, 'post')}` : ', nothing booked'}"><header class="sp-day-head"><span class="sp-day-name">${DAYS[d.getDay()]}</span><span class="sp-day-num">${d.getDate()}</span></header><div class="sp-day-posts" data-sp-drop="${keyOf(d)}">${body}</div></section>`;
		}
		return `${html}</div>`;
	}

	function agendaRow(p) {
		return `<li class="sp-row sp-row-agenda${state.open === p.id ? ' is-open' : ''}" data-sp-id="${htmlSafe(p.id)}">${rowHead(p, htmlSafe(time(parse(p.at))))}${pill(p)}${actions(p)}</li>`;
	}

	function weekNarrow() {
		const start = weekStart(state.anchor);
		let html = '<div class="sp-agenda">';
		for (let i = 0; i < 7; i += 1) {
			const d = shiftDays(start, i);
			const items = onDay(d);
			const today = onSameDay(d, NOW);
			html += `<section class="sp-agenda-day${today ? ' is-today' : ''}" aria-label="${htmlSafe(longDay(d))}"><h3 class="sp-agenda-title">${htmlSafe(`${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`)}${today ? '<span class="sp-agenda-today">Today</span>' : ''}</h3>${items.length ? `<ol class="sp-list">${items.map(agendaRow).join('')}</ol>` : '<p class="sp-agenda-none">Nothing booked</p>'}</section>`;
		}
		return `${html}</div>`;
	}

	function monthDays() {
		const first = new Date(state.anchor.getFullYear(), state.anchor.getMonth(), 1);
		const start = weekStart(first);
		const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
		const end = shiftDays(weekStart(last), 6);
		const days = [];
		for (let d = start; d <= end; d = shiftDays(d, 1)) days.push(d);
		return { first, days };
	}

	function monthWide() {
		const { first, days } = monthDays();
		let html = `<div class="sp-month"><div class="sp-month-head" aria-hidden="true">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((n) => `<span>${n}</span>`).join('')}</div><div class="sp-month-grid">`;
		days.forEach((d) => {
			const items = onDay(d);
			const out = d.getMonth() !== first.getMonth();
			const today = onSameDay(d, NOW);
			html += `<section class="sp-mday${out ? ' is-out' : ''}${today ? ' is-today' : ''}${dayStart(d) < dayStart(NOW) ? ' is-past' : ''}" aria-label="${htmlSafe(longDay(d))}${items.length ? `, ${plural(items.length, 'post')}` : ''}" data-sp-drop="${keyOf(d)}"><span class="sp-mday-num">${d.getDate()}</span>${
				items.length
					? `<ul class="sp-mday-posts">${items
							.map((p) => {
								const at = parse(p.at);
								return `<li><button type="button" class="sp-mini is-${p.status}${state.open === p.id ? ' is-open' : ''}" data-sp-open="${htmlSafe(p.id)}" data-sp-id="${htmlSafe(p.id)}"${canMove(p) ? ' draggable="true"' : ''} aria-label="${htmlSafe(`${p.title}, ${channelNames(p)}, ${time(at)}, ${STATUS[p.status].label.toLowerCase()}`)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="${htmlSafe(p.title)}">${thumb(p, 22, 'sp-mini-pic')}<span class="sp-mini-time">${htmlSafe(time(at).replace(':00', ''))}</span>${marks(Object.assign({}, p, { channels: [p.channels[0]] }))}</button></li>`;
							})
							.join('')}</ul>`
					: ''
			}</section>`;
		});
		return `${html}</div></div>`;
	}

	function monthNarrow() {
		const { first, days } = monthDays();
		if (state.picked.getMonth() !== first.getMonth()) {
			const firstWith = days.find((d) => d.getMonth() === first.getMonth() && onDay(d).length);
			const thisMonth = NOW.getMonth() === first.getMonth() && NOW.getFullYear() === first.getFullYear();
			state.picked = thisMonth ? dayStart(NOW) : firstWith || first;
		}
		let html = `<div class="sp-mini-month"><div class="sp-month-head" aria-hidden="true">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((n) => `<span>${n}</span>`).join('')}</div><div class="sp-mini-month-grid">`;
		days.forEach((d) => {
			const out = d.getMonth() !== first.getMonth();
			if (out) {
				html += '<span class="sp-pick is-out" aria-hidden="true"></span>';
				return;
			}
			const items = onDay(d);
			const picked = onSameDay(d, state.picked);
			html += `<button type="button" class="sp-pick${picked ? ' is-picked' : ''}${onSameDay(d, NOW) ? ' is-today' : ''}" data-sp-pick="${keyOf(d)}" aria-pressed="${picked}" aria-label="${htmlSafe(`${longDay(d)}, ${items.length ? plural(items.length, 'post') : 'nothing booked'}`)}"><span class="sp-pick-num">${d.getDate()}</span><span class="sp-pick-dots" aria-hidden="true">${items
				.slice(0, 3)
				.map((p) => `<span class="sp-dot sp-dot-${p.status}"></span>`)
				.join('')}</span></button>`;
		});
		const items = onDay(state.picked);
		html += `</div></div><section class="sp-agenda-day sp-agenda-day-picked" aria-label="${htmlSafe(longDay(state.picked))}"><h3 class="sp-agenda-title">${htmlSafe(longDay(state.picked))}${onSameDay(state.picked, NOW) ? '<span class="sp-agenda-today">Today</span>' : ''}</h3>${items.length ? `<ol class="sp-list">${items.map(agendaRow).join('')}</ol>` : '<p class="sp-agenda-none">Nothing booked</p>'}</section>`;
		return html;
	}

	function renderCal() {
		disposeTips(el.cal);
		const a = state.anchor;
		if (state.view === 'week') {
			const s = weekStart(a);
			const e = shiftDays(s, 6);
			el.period.textContent =
				s.getMonth() === e.getMonth()
					? `${MONTHS[s.getMonth()]} ${s.getDate()} – ${e.getDate()}, ${e.getFullYear()}`
					: `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
			el.cal.innerHTML = state.wide ? weekWide() : weekNarrow();
		} else {
			el.period.textContent = `${MONTHS_LONG[a.getMonth()]} ${a.getFullYear()}`;
			el.cal.innerHTML = state.wide ? monthWide() : monthNarrow();
		}
		const unit = state.view === 'week' ? 'week' : 'month';

		for (const b of pickAll('[data-sp-step]', root)) {
			const label = (b.dataset.spStep === '-1' ? 'Previous ' : 'Next ') + unit;
			b.setAttribute('aria-label', label);
			b.setAttribute('data-bs-title', label);
			const tip = window.bootstrap && bootstrap.Tooltip.getInstance(b);
			if (tip) tip.setContent({ '.tooltip-inner': label });
		}

		el.cal.classList.toggle('is-wide', state.wide);
		start(el.cal);
	}

	function paintEverything() {
		renderTop();
		renderCal();
	}

	/* Toolbar */
	root.addEventListener('click', (e) => {
		const step = e.target.closest('[data-sp-step]');
		if (step) {
			const n = Number(step.dataset.spStep);
			const a = state.anchor;
			state.anchor = state.view === 'week' ? shiftDays(a, 7 * n) : new Date(a.getFullYear(), a.getMonth() + n, 1);
			renderCal();
			return;
		}
		if (e.target.closest('[data-sp-today]')) {
			state.anchor = dayStart(NOW);
			state.picked = dayStart(NOW);
			renderCal();
			return;
		}
		if (e.target.closest('[data-sp-see-month]')) {
			setView('month');
			state.anchor = dayStart(NOW);
			renderCal();
			pick('.sp-cal', root).scrollIntoView({
				behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
				block: 'start',
			});
			return;
		}
		const chip = e.target.closest('[data-sp-channel]');
		if (chip) {
			state.channel = chip.dataset.spChannel;

			for (const c of pickAll('[data-sp-channel]', el.chips)) {
				c.setAttribute('aria-pressed', String(c === chip));
			}

			renderCal();
			const n =
				state.view === 'week'
					? [0, 1, 2, 3, 4, 5, 6].reduce((s, i) => s + onDay(shiftDays(weekStart(state.anchor), i)).length, 0)
					: null;
			if (n !== null)
				say(`${plural(n, 'post')} this week${state.channel === 'all' ? '' : ` on ${CH[state.channel].name}`}`);
			return;
		}
		const dayButton = e.target.closest('[data-sp-pick]');
		if (dayButton) {
			state.picked = parse(`${dayButton.dataset.spPick}T00:00`);
			renderCal();
			const again = pick(`[data-sp-pick="${dayButton.dataset.spPick}"]`, el.cal);
			if (again) again.focus({ preventScroll: true });
			return;
		}
		const approve = e.target.closest('[data-sp-approve]');
		if (approve) {
			approvePost(approve.dataset.spApprove);
			return;
		}
		if (e.target.closest('a')) return;
		const open = e.target.closest('[data-sp-open]');
		if (open) {
			openPost(open.dataset.spOpen);
			return;
		}
		rowToPage(e);
	});

	/* The rest of a row opens the post's full page, and the middle button or
     Cmd/Ctrl opens it in a new tab, as a link would. */
	function rowToPage(e) {
		const row = e.button < 2 && e.target.closest('.sp-row[data-sp-id]');
		if (!row || e.target.closest('a, button')) return;
		const url = page(nodeById(row.dataset.spId));
		if (e.button === 1 || e.metaKey || e.ctrlKey) window.open(url, '_blank');
		else location.href = url;
	}
	root.addEventListener('auxclick', (e) => {
		if (e.button === 1) rowToPage(e);
	});

	function setView(v) {
		state.view = v;
		const input = pick(`[data-sp-view][value="${v}"]`, root);
		if (input && !input.checked) {
			input.checked = true;
			input.dispatchEvent(new Event('change', { bubbles: true }));
		}
	}

	for (const input of pickAll('[data-sp-view]', root)) {
		input.addEventListener('change', () => {
			if (!input.checked || state.view === input.value) return;
			state.view = input.value;
			renderCal();
		});
	}

	/* Wide or narrow follows the card's own width. */
	const WIDE = 860;

	function measure() {
		const wide = el.cal.clientWidth >= WIDE;
		if (wide !== state.wide) {
			state.wide = wide;
			renderCal();
		}
	}

	if ('ResizeObserver' in window) new ResizeObserver(() => requestAnimationFrame(measure)).observe(el.cal);
	else window.addEventListener('resize', measure);

	/* Drag a post to another day
	   Keeps its time. Published posts stay where they went out, and a post
	   can't be moved to a time that has passed. */
	let dragging = null;
	el.cal.addEventListener('dragstart', (e) => {
		const t = e.target.closest('[data-sp-id][draggable="true"]');
		if (!t) return;
		dragging = t.dataset.spId;
		e.dataTransfer.effectAllowed = 'move';
		try {
			e.dataTransfer.setData('text/plain', dragging);
		} catch {
			/* old browsers */
		}
		t.classList.add('is-dragging');
		root.classList.add('is-dragging');
		const tip = window.bootstrap && bootstrap.Tooltip.getInstance(t);
		if (tip) tip.hide();
	});
	el.cal.addEventListener('dragend', () => {
		dragging = null;
		root.classList.remove('is-dragging');

		for (const x of pickAll('.is-dragging, .is-drop', el.cal)) {
			x.classList.remove('is-dragging', 'is-drop');
		}
	});
	el.cal.addEventListener('dragover', (e) => {
		const zone = dragging && e.target.closest('[data-sp-drop]');
		if (!zone) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';

		for (const x of pickAll('.is-drop', el.cal)) {
			if (x !== zone) x.classList.remove('is-drop');
		}

		zone.classList.add('is-drop');
	});
	el.cal.addEventListener('dragleave', (e) => {
		const zone = e.target.closest('[data-sp-drop]');
		if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove('is-drop');
	});
	el.cal.addEventListener('drop', (e) => {
		const zone = e.target.closest('[data-sp-drop]');
		const id = dragging;
		if (!zone || !id) return;
		e.preventDefault();
		movePost(id, zone.dataset.spDrop);
	});

	function movePost(id, dayKey) {
		const p = nodeById(id);
		if (!p) return;
		const from = parse(p.at);
		const to = parse(`${dayKey}T${p.at.split('T')[1]}`);
		if (onSameDay(from, to)) return;
		if (to <= NOW) {
			toast({
				tone: 'warning',
				icon: 'bi-clock-history',
				title: 'That time has passed',
				text: `Pick today after ${time(NOW)}, or a later day.`,
			});
			return;
		}
		const before = p.at;
		p.at = isoOf(to);
		/* Send the new time to your scheduling service here. */
		paintEverything();
		if (state.open === id) paintSheet();
		toast({
			tone: 'success',
			icon: 'bi-calendar2-check',
			title: 'Moved',
			text: `“${p.title}” now goes out ${whenMid(to)}.`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						p.at = before;
						paintEverything();
						if (state.open === id) paintSheet();
					},
				},
			],
		});
	}

	function approvePost(id) {
		const p = nodeById(id);
		if (!p || p.status !== 'draft') return;
		p.status = 'scheduled';
		p.approved = { by: S.me, on: keyOf(NOW) };
		delete p.waiting;
		/* Send the approval to your scheduling service here. */
		paintEverything();
		if (state.open === id) paintSheet();
		toast({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'Approved',
			text: `“${p.title}” goes out ${whenMid(parse(p.at))}.`,
		});
		const next = pick('[data-sp-wait] [data-sp-approve]', root);
		if (!state.open) (next || pick('[data-sp-see-month]', root)).focus({ preventScroll: true });
	}

	/* Quick view */
	const drawer = pick('#sp-post');
	const dEl = {
		title: pick('[data-sp-d="title"]', drawer),
		sub: pick('[data-sp-d="sub"]', drawer),
		full: pick('[data-sp-d="full"]', drawer),
		body: pick('[data-sp-d="body"]', drawer),
		foot: pick('[data-sp-d="foot"]', drawer),
	};

	function panel() {
		return bootstrap.Offcanvas.getOrCreateInstance(drawer);
	}

	function fmt(n) {
		return n >= 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : n.toLocaleString('en-US');
	}

	function shortDate(iso) {
		const d = parse(iso.length > 10 ? iso : `${iso}T00:00`);
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function sheetBody(p) {
		const at = parse(p.at);
		const shape = CH[p.channels[0]].shape;
		let html = `<figure class="sp-dpic sp-dpic-${shape}"><img src="${S.photoOf(p, 760, shape === 'wide' ? 520 : 860)}" alt="${htmlSafe(p.title)}" loading="lazy"></figure>`;
		html += `<div class="sp-dline">${pill(p)}<span class="sp-dline-when">${htmlSafe(p.status === 'published' ? `Went out ${whenMid(at)}` : p.status === 'scheduled' ? `Goes out ${until(at)}` : `Booked for ${whenMid(at)}`)}</span></div>`;
		html += `<section class="sp-dsec" aria-labelledby="sp-d-cap"><h3 class="sp-dsec-title" id="sp-d-cap">Caption</h3><p class="sp-dcap">${htmlSafe(p.caption)}</p><p class="sp-dtags">${p.tags.map(htmlSafe).join(' ')}</p></section>`;
		if (p.results) {
			const sum = [0, 1, 2, 3].map((i) => p.channels.reduce((s, c) => s + ((p.results[c] || [])[i] || 0), 0));
			html += `<section class="sp-dsec" aria-labelledby="sp-d-res"><h3 class="sp-dsec-title" id="sp-d-res">How it did</h3><dl class="sp-figs">${['Reach', 'Likes', 'Saves', 'Clicks'].map((l, i) => `<div class="sp-fig"><dt>${l}</dt><dd>${fmt(sum[i])}</dd></div>`).join('')}</dl><p class="sp-dnote">${p.channels.length > 1 ? `On ${htmlSafe(channelNames(p))} together. The full page splits them.` : `On ${htmlSafe(channelNames(p))} so far.`}</p></section>`;
		}
		html += `<section class="sp-dsec" aria-labelledby="sp-d-who"><h3 class="sp-dsec-title" id="sp-d-who">Who</h3><ul class="sp-who"><li><span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(p.by)}" aria-hidden="true"></span><span><span class="sp-who-name">${htmlSafe(p.by)}</span><span class="sp-who-meta">Wrote it on ${htmlSafe(shortDate(p.written))}</span></span></li>${p.approved ? `<li><span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(p.approved.by)}" aria-hidden="true"></span><span><span class="sp-who-name">${htmlSafe(p.approved.by === S.me ? 'You' : p.approved.by)}</span><span class="sp-who-meta">Approved it on ${htmlSafe(shortDate(p.approved.on))}</span></span></li>` : `<li><span class="sp-who-wait" aria-hidden="true"><i class="bi bi-hourglass-split"></i></span><span><span class="sp-who-name">Waiting for your OK</span><span class="sp-who-meta">Sent ${htmlSafe(whenMid(parse(p.waiting)))}</span></span></li>`}</ul></section>`;
		return html;
	}

	function paintSheet() {
		const p = nodeById(state.open);
		if (!p) return;
		disposeTips(drawer);
		dEl.title.textContent = p.title;
		dEl.sub.textContent = `${channelNames(p)} · ${when(parse(p.at))}`;
		dEl.full.href = page(p);
		dEl.body.innerHTML = sheetBody(p);
		if (p.status === 'draft') {
			dEl.foot.innerHTML = `<button type="button" class="btn btn-primary" data-sp-approve="${htmlSafe(p.id)}"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Approve</button>`;
			dEl.foot.hidden = false;
		} else {
			dEl.foot.innerHTML = '';
			dEl.foot.hidden = true;
		}
		start(drawer);
	}

	function markOpen() {
		for (const x of pickAll('.is-open[data-sp-id]', root)) {
			x.classList.remove('is-open');
		}

		if (state.open)
			for (const x of pickAll(`[data-sp-id="${CSS.escape(state.open)}"]`, root)) {
				if (!x.closest('[data-sp-next], [data-sp-wait]')) x.classList.add('is-open');
			}
	}

	let opener = null;
	function openPost(id) {
		if (!nodeById(id)) return;
		opener = document.activeElement;
		state.open = id;
		paintSheet();
		markOpen();
		panel().show();
	}
	drawer.addEventListener('click', (e) => {
		const approve = e.target.closest('[data-sp-approve]');
		if (approve) approvePost(approve.dataset.spApprove);
	});
	drawer.addEventListener('shown.bs.offcanvas', () => dEl.title.focus());
	drawer.addEventListener('hide.bs.offcanvas', () => disposeTips(drawer));
	drawer.addEventListener('hidden.bs.offcanvas', () => {
		const id = state.open;
		state.open = null;
		markOpen();
		const back =
			(opener && document.contains(opener) && opener) || (id && pick(`[data-sp-open="${CSS.escape(id)}"]`, root));
		if (back) back.focus({ preventScroll: true });
	});

	/* Start */
	state.wide = el.cal.clientWidth >= WIDE;
	paintEverything();
	/* A link to social-planner.html#sp-212 opens that post. */
	const hash = location.hash.slice(1);
	if (hash && nodeById(hash)) openPost(hash);
})();
