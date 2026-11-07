/**
 * Basalt - Trials (trials.html)
 * Every team trying Fieldline, how far each got with setup, and who
 * could use a nudge before their 14 days run out.
 *
 * Data comes from assets/basalt/js/data/multipurpose/trials.js (window.Basalt.data.trials),
 * which takes the trial accounts' names, plans and dates from
 * accounts.js. A row, a team's name and the expand icon open
 * trial-details.html?id=…; the panel icon opens a quick view.
 */
(() => {
	'use strict';
	const root = pick('[data-trl-root]');
	const T = window.Basalt.data && window.Basalt.data.trials;
	if (!root || !T) return;

	function start() {
		el.rows.addEventListener('click', rowClick);
		el.rows.addEventListener('auxclick', (e) => {
			if (e.button === 1) rowClick(e);
		});

		drawer.addEventListener('shown.bs.offcanvas', () => dEl.title.focus({ preventScroll: true }));
		drawer.addEventListener('hidden.bs.offcanvas', () => {
			const id = state.open;
			state.open = null;

			for (const r of pickAll('.trl-row.is-open', el.rows)) {
				r.classList.remove('is-open');
			}

			/* Back to the row's own button, quietly: no focus ring after a mouse click. */
			const btn = id && pick(`[data-trl-open="${CSS.escape(id)}"]`, el.rows);
			if (btn) btn.focus({ preventScroll: true, focusVisible: false });
		});
		drawer.addEventListener('click', (e) => {
			const btn = e.target.closest('[data-trl-d-nudge]');
			if (!btn) return;
			const t = nodeById(state.open);
			if (!t || t.nudgedNow) return;
			sendNudge(t);
			const first = t.people[0][0].split(' ')[0];
			toast({
				tone: 'success',
				title: `Nudge sent to ${first}`,
				text: `${t.name} will get it in a minute.`,
				duration: 4000,
			});
			paintSheet();
			renderNudge();
			/* The button that had focus is redrawn as "Nudge sent"; keep focus
	       inside the panel so Escape still closes it. */
			dEl.title.focus({ preventScroll: true });
		});

		/* Start */
		renderFigures();
		renderNudge();
		paintList();
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(s) {
		return String(s).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many || `${one}s`}`;
	}

	function listWords(a) {
		return a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function when(iso) {
		return iso === T.today ? 'Today' : T.between(iso, T.today) === 1 ? 'Yesterday' : T.date(iso);
	}

	function href(t) {
		return `trial-details.html?id=${encodeURIComponent(t.id)}`;
	}

	const SOON = 7;
	const state = { trials: T.list(), show: 'all', query: '', open: null };

	function nodeById(id) {
		return state.trials.find((t) => t.id === id);
	}

	function left(t) {
		return T.between(T.today, t.until);
	}

	function soon(t) {
		return t.status === 'running' && left(t) <= SOON;
	}

	/* Near the end with half the setup or less: worth a short email. */
	function needsNudge(t) {
		return soon(t) && T.done(t) <= 2 && !t.nudgedNow;
	}

	const el = {
		rows: pick('[data-trl-rows]', root),
		table: pick('[data-trl-table]', root),
		empty: pick('[data-trl-empty]', root),
		summary: pick('[data-trl-summary]', root),
		search: pick('[data-trl-search]', root),
		nudge: pick('[data-trl-nudge]', root),
		live: pick('[data-trl-live]', root),
		figs: {
			running: pick('[data-trl-fig="running"]', root),
			soon: pick('[data-trl-fig="soon"]', root),
			converted: pick('[data-trl-fig="converted"]', root),
		},
	};
	function say(text) {
		el.live.textContent = '';
		setTimeout(() => {
			el.live.textContent = text;
		}, 30);
	}

	/* Small shared pieces */
	function mark(t) {
		const ind = T.industries[t.industry];
		return `<span class="trl-mark" style="--trl-tone: var(--basalt-series-${ind.tone})" aria-hidden="true"><i class="bi ${ind.icon}"></i></span>`;
	}
	function planBadge(t) {
		const p = T.plans[t.plan];
		return `<span class="badge basalt-badge-as-dot basalt-badge-tone-${p.tone}">${p.name}</span>`;
	}
	/* Fourteen small blocks: days gone, today, and the days left. */
	function strip(t, big) {
		const d = T.day(t);
		const late = t.status === 'running' && left(t) <= 2;
		let s = `<span class="trl-strip${big ? ' trl-strip-big' : ''}${late ? ' is-late' : ''}${t.status === 'converted' ? ' is-paid' : t.status === 'ended' ? ' is-closed' : ''}" aria-hidden="true">`;
		for (let i = 1; i <= T.length; i++)
			s += `<span${i < d ? ' class="is-past"' : i === d ? ' class="is-today"' : ''}></span>`;
		return `${s}</span>`;
	}
	function steps(t) {
		const n = T.done(t);
		let s = '<span class="trl-dots" aria-hidden="true">';
		/* Filled left to right by count; the quick view says which steps. */
		T.milestones.forEach((m, i) => {
			s += `<span${i < n ? ' class="is-done"' : ''}></span>`;
		});
		return `${s}</span><span class="trl-dots-n">${n} of ${T.milestones.length}<span class="visually-hidden"> setup steps done</span></span>`;
	}
	function endText(t) {
		const n = left(t);
		if (n <= 0) return 'Ends today';
		if (n === 1) return 'Ends tomorrow';
		return `Ends ${T.date(t.until, true)}`;
	}

	/* The list */
	function matches(t) {
		if (state.show === 'soon' && !soon(t)) return false;
		if ((state.show === 'converted' || state.show === 'ended') && t.status !== state.show) return false;
		const q = state.query.trim().toLowerCase();
		if (!q) return true;
		const hay = [t.name, t.city, T.industries[t.industry].name, T.plans[t.plan].name]
			.concat(t.people.map((p) => p[0]))
			.join(' ')
			.toLowerCase();
		return q.split(/\s+/).every((w) => hay.includes(w));
	}

	function trialCell(t) {
		if (t.status === 'converted') {
			return `<span class="basalt-status basalt-status-dot basalt-status-success">Converted</span><span class="trl-cell-sub">${T.date(t.closed)}, on day ${T.day(t)}</span>`;
		}
		if (t.status === 'ended') {
			return `<span class="basalt-status basalt-status-dot">Ended</span><span class="trl-cell-sub">${T.date(t.closed)}, did not pay</span>`;
		}
		const late = left(t) <= 2;
		return `<span class="trl-day"><span class="trl-day-n">Day ${T.day(t)} <span class="trl-day-of">of ${T.length}</span></span>${strip(t)}</span><span class="trl-cell-sub${late ? ' trl-cell-sub-late' : ''}">${endText(t)}</span>`;
	}

	function rowHtml(t) {
		const open = t.id === state.open;
		return `<tr class="trl-row${open ? ' is-open' : ''}" data-trl-id="${htmlSafe(t.id)}"><td class="trl-row-team"><div class="trl-team">${mark(t)}<div class="trl-team-text"><p class="trl-team-name"><a class="trl-team-link" href="${href(t)}">${htmlSafe(t.name)}</a></p><p class="trl-team-meta">${htmlSafe(t.city)}<span class="trl-team-ind"> · ${htmlSafe(T.industries[t.industry].name)}</span></p></div></div></td><td class="trl-row-plan">${planBadge(t)}<span class="trl-cell-sub">${plural(t.seats, 'seat')}</span></td><td class="trl-row-trial">${trialCell(t)}</td><td class="trl-row-setup">${steps(t)}</td><td class="trl-row-open"><span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-trl-open="${htmlSafe(t.id)}" aria-label="Quick view: ${htmlSafe(t.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${href(t)}" aria-label="Open full page: ${htmlSafe(t.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span></td></tr>`;
	}

	function emptyHtml() {
		const q = state.query.trim();
		const words = {
			soon: 'trials ending in the next 7 days',
			converted: 'converted trials',
			ended: 'ended trials',
			all: 'trials',
		};
		const title = q ? `No trials match “${htmlSafe(q)}”` : `No ${words[state.show]}`;
		const text = q ? 'Search looks at team names, cities, industries, plans and people.' : 'Try another view.';
		const act = q
			? '<button type="button" class="btn btn-sm btn-outline-secondary" data-trl-clear>Clear the search</button>'
			: '<button type="button" class="btn btn-sm btn-outline-secondary" data-trl-all>Show all trials</button>';
		return `<div class="basalt-empty basalt-empty-compact trl-empty"><span class="trl-empty-icon" aria-hidden="true"><i class="bi ${q ? 'bi-search' : 'bi-hourglass'}"></i></span><h3 class="basalt-empty-title">${title}</h3><p class="basalt-empty-text">${text}</p><div class="basalt-empty-actions">${act}</div></div>`;
	}

	function paintList() {
		const shown = state.trials.filter(matches);

		for (const b of pickAll('[data-bs-toggle="tooltip"]', el.rows)) {
			const i = window.bootstrap && bootstrap.Tooltip.getInstance(b);
			if (i) i.dispose();
		}

		el.rows.innerHTML = shown.map(rowHtml).join('');
		if (window.Basalt.tips) window.Basalt.tips(el.rows);
		el.table.hidden = !shown.length;
		el.empty.hidden = !!shown.length;
		el.empty.innerHTML = shown.length ? '' : emptyHtml();
	}

	function renderFigures() {
		const running = state.trials.filter((t) => t.status === 'running');
		const paid = state.trials.filter(
			(t) => t.status === 'converted' && t.closed.slice(0, 7) === T.today.slice(0, 7),
		);
		el.figs.running.textContent = running.length;
		el.figs.soon.textContent = running.filter(soon).length;
		el.figs.converted.textContent = paid.length;
		const ended = state.trials.filter((t) => t.status === 'ended').length;
		el.summary.textContent = `${plural(running.length, 'team')} trying it now, ${paid.length} converted and ${ended} ended this month.`;
	}

	/* Who to nudge */
	function renderNudge() {
		const due = state.trials.filter(needsNudge);
		if (!due.length) {
			const sent = state.trials.filter((t) => t.nudgedNow);
			if (!sent.length) {
				el.nudge.hidden = true;
				el.nudge.innerHTML = '';
				return;
			}
			el.nudge.hidden = false;
			el.nudge.classList.add('is-done');
			el.nudge.innerHTML = `<span class="trl-nudge-icon" aria-hidden="true"><i class="bi bi-check2"></i></span><div class="trl-nudge-text"><h2 class="trl-nudge-title" id="trl-nudge-title">Nudges sent</h2><p class="trl-nudge-desc">${htmlSafe(listWords(sent.map((t) => t.name)))} will hear from us today.</p></div>`;
			return;
		}
		el.nudge.hidden = false;
		el.nudge.classList.remove('is-done');
		const names = due.map((t) => `<a href="${href(t)}">${htmlSafe(t.name)}</a>`);
		el.nudge.innerHTML = `<span class="trl-nudge-icon" aria-hidden="true"><i class="bi bi-bell"></i></span><div class="trl-nudge-text"><h2 class="trl-nudge-title" id="trl-nudge-title">${due.length === 1 ? 'One team ends soon' : `${due.length} teams end soon`}, setup unfinished</h2><p class="trl-nudge-desc">${listWords(names)}. A short email often brings them back.</p></div><button type="button" class="btn btn-sm btn-primary trl-nudge-btn" data-trl-nudge-all><i class="bi bi-send me-1" aria-hidden="true"></i>${due.length === 1 ? 'Send a nudge' : `Nudge all ${due.length}`}</button>`;
	}

	function sendNudge(t) {
		t.nudgedNow = true;
		t.nudges.push(T.today);
		const key = left(t) <= 3 ? 'ending' : 'setup';
		t.activity.unshift([T.today, `Nudge sent: ${T.templates[key].label.toLowerCase()}.`, 'nudge']);
	}

	el.nudge.addEventListener('click', (e) => {
		const btn = e.target.closest('[data-trl-nudge-all]');
		if (!btn) return;
		const due = state.trials.filter(needsNudge);
		due.forEach(sendNudge);
		toast({
			tone: 'success',
			title: due.length === 1 ? 'Nudge sent' : `${plural(due.length, 'nudge')} sent`,
			text: `${listWords(due.map((t) => t.name))}.`,
			duration: 4000,
		});
		renderNudge();
		if (state.open) paintSheet();
	});

	/* Search and the view switch */
	let timer = 0;
	el.search.addEventListener('input', () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			state.query = el.search.value;
			paintList();
			if (state.query.trim()) say(`${plural(state.trials.filter(matches).length, 'trial')} found`);
		}, 120);
	});
	el.search.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && el.search.value) {
			e.preventDefault();
			el.search.value = '';
			state.query = '';
			paintList();
		}
	});

	for (const r of pickAll('[data-trl-show]', root)) {
		r.addEventListener('change', () => {
			state.show = r.value;
			paintList();
		});
	}

	el.empty.addEventListener('click', (e) => {
		if (e.target.closest('[data-trl-clear]')) {
			el.search.value = '';
			state.query = '';
			paintList();
			el.search.focus();
		}
		if (e.target.closest('[data-trl-all]')) {
			const all = pick('#trl-show-all');
			all.checked = true;
			all.dispatchEvent(new Event('change', { bubbles: true }));
		}
	});

	pick('[data-trl-copy]', root).addEventListener('click', () => {
		const link = 'https://app.fieldline.example/start-trial';

		function done() {
			return toast({
				tone: 'success',
				title: 'Sign-up link copied',
				text: 'Anyone with it can start a 14-day trial.',
				duration: 4000,
			});
		}

		if (window.Basalt.copyText) window.Basalt.copyText(link).then(done);
		else done();
	});

	/* Quick view */
	const drawer = pick('#trl-trial');
	const dEl = {
		title: pick('[data-trl-d="title"]', drawer),
		sub: pick('[data-trl-d="sub"]', drawer),
		full: pick('[data-trl-d="full"]', drawer),
		body: pick('[data-trl-d="body"]', drawer),
		foot: pick('[data-trl-d="foot"]', drawer),
	};

	function panel() {
		return bootstrap.Offcanvas.getOrCreateInstance(drawer);
	}

	function statusLine(t) {
		if (t.status === 'converted') {
			const p = t.paid;
			return `Paying since ${T.date(t.closed)}: ${T.plans[p[0]].name}, ${plural(p[1], 'seat')}, $${T.price(p[0], p[1], p[2] === 'yearly').toLocaleString('en-US')} a month.`;
		}
		if (t.status === 'ended') return `Ended ${T.date(t.closed, true)}. ${t.reason}`;
		return `Day ${T.day(t)} of ${T.length}. ${endText(t)}.`;
	}

	function drawerHtml(t) {
		const nx = T.next(t);
		let s = `<div class="trl-d-sec"><div class="trl-d-tags">${planBadge(t)}<span class="trl-d-tag">${plural(t.seats, 'seat')}</span></div>${strip(t, true)}<p class="trl-d-line">${htmlSafe(statusLine(t))}</p><p class="trl-d-quiet">${t.signedIn} of ${t.seats} signed in · ${T.count(t.bookings, t.industry)} booked</p></div>`;

		s += `<section class="trl-d-sec"><h3 class="trl-d-h">Setup <span class="trl-d-count">${T.done(t)} of ${T.milestones.length}</span></h3><ul class="trl-check">`;
		T.milestones.forEach((m) => {
			const at = t.steps[m.key];
			s += `<li class="${at ? 'is-done' : ''}"><span class="trl-check-icon" aria-hidden="true"><i class="bi ${at ? 'bi-check-lg' : m.icon}"></i></span><span class="trl-check-label">${m.label}<span class="visually-hidden">${at ? ', done' : ', not yet'}</span></span><span class="trl-check-when">${at ? T.date(at) : 'Not yet'}</span></li>`;
		});
		s += `</ul>${nx && t.status === 'running' ? `<p class="trl-d-tip"><i class="bi bi-lightbulb" aria-hidden="true"></i>${htmlSafe(nx.tip)}</p>` : ''}</section>`;

		const shown = t.people.slice(0, 4);
		s += `<section class="trl-d-sec"><h3 class="trl-d-h">Who signed in</h3><ul class="trl-people">${shown
			.map(
				(p) =>
					`<li><span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(p[0])}" aria-hidden="true"></span><span class="trl-people-text"><span class="trl-people-name">${htmlSafe(p[0])}</span><span class="trl-people-role">${htmlSafe(p[1])}${p[2] !== p[1] ? ` · ${htmlSafe(p[2])}` : ''}</span></span><span class="trl-people-when">${when(p[3])}</span></li>`,
			)
			.join(
				'',
			)}</ul>${t.signedIn > shown.length ? `<p class="trl-d-quiet">and ${t.signedIn - shown.length} more</p>` : ''}</section>`;

		s += `<section class="trl-d-sec"><h3 class="trl-d-h">Latest</h3><ul class="trl-feed">${t.activity
			.slice(0, 3)
			.map(
				(a) =>
					`<li><span class="trl-feed-when">${T.date(a[0])}</span><span class="trl-feed-what">${htmlSafe(a[1])}</span></li>`,
			)
			.join('')}</ul></section>`;
		return s;
	}

	function footHtml(t) {
		if (t.status !== 'running')
			return `<a class="btn btn-outline-secondary" href="${href(t)}">See the whole trial</a>`;
		const sent = t.nudgedNow;
		return `<a class="btn btn-outline-secondary" href="${href(t)}&amp;do=convert">Convert to paid</a><button type="button" class="btn btn-primary" data-trl-d-nudge${sent ? ' disabled' : ''}><i class="bi ${sent ? 'bi-check2' : 'bi-send'} me-1" aria-hidden="true"></i>${sent ? 'Nudge sent' : 'Send a nudge'}</button>`;
	}

	function paintSheet() {
		const t = nodeById(state.open);
		if (!t) return;
		dEl.title.textContent = t.name;
		dEl.sub.textContent = `${t.city} · ${T.industries[t.industry].name}`;
		dEl.full.href = href(t);
		dEl.body.innerHTML = drawerHtml(t);
		dEl.foot.innerHTML = footHtml(t);
		if (window.Basalt.avatars) window.Basalt.avatars(drawer);
	}

	function openTrial(id) {
		if (!nodeById(id)) return;
		state.open = id;
		paintSheet();

		for (const r of pickAll('.trl-row', el.rows)) {
			r.classList.toggle('is-open', r.dataset.trlId === id);
		}

		panel().show();
	}

	/* The panel icon opens the quick view. The rest of a row opens the full
     page, and the middle button or Cmd/Ctrl opens it in a new tab, as a
     link would. */
	function rowClick(e) {
		if (e.button > 1 || e.target.closest('a')) return;
		const b = e.target.closest('[data-trl-open]');
		if (b) {
			if (e.button === 0) openTrial(b.dataset.trlOpen);
			return;
		}
		const tr = e.target.closest('tr[data-trl-id]');
		if (!tr) return;
		const url = href(nodeById(tr.dataset.trlId));
		if (e.button === 1 || e.metaKey || e.ctrlKey) window.open(url, '_blank');
		else location.href = url;
	}
	start();
})();
