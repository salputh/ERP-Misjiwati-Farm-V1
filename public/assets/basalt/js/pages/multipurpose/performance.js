/**
 * Basalt - Performance (performance.html)
 * Fieldline's half-year review cycle: where the running cycle stands
 * stage by stage, how ratings moved over past cycles, every review in
 * a table whose rows open each person's page and whose panel icon
 * opens a drawer for the detail, and a drawer to plan the next cycle. Uses the shared tabs, styled selects, choice tiles, avatars,
 * status pills, empty states, the record drawer and toasts.
 */
(() => {
	'use strict';
	/* In your app these come from the server and the clock. */
	const TODAY = '2026-10-09';
	const PAGE_SIZE = 10;

	/* The running cycle. Each stage has the day it should be finished by;
     calibration runs as one session per team. */
	const CYCLE = { name: 'H2 2026', opened: '2026-09-14', closes: '2026-10-30' };
	const STAGES = [
		{ key: 'self', label: 'Self-review', due: '2026-09-25' },
		{ key: 'peer', label: 'Peer feedback', due: '2026-10-02' },
		{ key: 'manager', label: 'Manager review', due: '2026-10-16' },
		{ key: 'calibration', label: 'Calibration', from: '2026-10-21', due: '2026-10-22' },
		{ key: 'signed', label: 'Signed off', due: '2026-10-30' },
	];

	function stageOf(key) {
		return STAGES.find((s) => s.key === key);
	}

	function stageIndex(key) {
		return STAGES.findIndex((s) => s.key === key);
	}

	/* Everyone in the cycle and their managers, who write the reviews,
     from Fieldline's one roster (data/multipurpose/people.js): the same teams,
     avatar colors and staff numbers as Employees. `session` is the
     team's calibration day. */
	const D = window.Basalt.data.people;
	const TEAMS = {};
	D.teams.forEach((t) => {
		TEAMS[t.id] = { name: t.id, tone: t.tone, session: t.session };
	});
	const PEOPLE = {};
	D.people.forEach((x) => {
		PEOPLE[x.staff] = { first: x.first, last: x.last, team: x.team, role: x.title };
	});

	/* Five competencies, scored 1 to 5 by the manager. */
	const COMPETENCIES = ['Execution', 'Expertise', 'Collaboration', 'Customer focus', 'Leadership'];

	/* The reviews in this cycle, shared with each person's own page.
     Everyone who started before July 1 is in it, except the chief
     executive, people on parental leave and people leaving. `due` is
     only set when a deadline was moved for one person; `peers` is
     [asked, answered]; `rating` and `scores` arrive with the manager
     review. Team leads are reviewed by the chief executive. */
	const REVIEWS = D.reviews.map((r) => {
		const x = D.recordWithId(r.who);
		return Object.assign({}, r, { who: x.staff, by: D.recordWithId(x.mgr).staff });
	});

	/* Closed cycles, newest first: how many people were reviewed and how
     many landed in each band. */
	const HISTORY = [
		{ cycle: 'H1 2026', top: 11, strong: 27, under: 6, avg: 4.1 },
		{ cycle: 'H2 2025', top: 9, strong: 24, under: 7, avg: 4.1 },
		{ cycle: 'H1 2025', top: 7, strong: 22, under: 7, avg: 4.0 },
		{ cycle: 'H2 2024', top: 5, strong: 19, under: 7, avg: 3.9 },
		{ cycle: 'H1 2024', top: 4, strong: 16, under: 7, avg: 3.9 },
		{ cycle: 'H2 2023', top: 3, strong: 14, under: 7, avg: 3.8 },
	];

	/* Who the next cycle covers: everyone in this one, plus the people
     who started after July 1 and Randall Rhodes, back on December 7. */
	const NEXT_CYCLE_PEOPLE = REVIEWS.length + D.staff.filter((x) => x.start > '2026-07-01').length + 1;

	/* Helpers */
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

	const WORDS = [
		'no',
		'one',
		'two',
		'three',
		'four',
		'five',
		'six',
		'seven',
		'eight',
		'nine',
		'ten',
		'eleven',
		'twelve',
	];

	function count(n, one, many) {
		return `${n < WORDS.length ? WORDS[n] : String(n)} ${n === 1 ? one : many || `${one}s`}`;
	}

	function cap(s) {
		return s.charAt(0).toUpperCase() + s.slice(1);
	}

	function toDate(iso) {
		const p = iso.split('-').map(Number);
		return new Date(p[0], p[1] - 1, p[2]);
	}

	function dayGap(a, b) {
		return Math.round((toDate(b) - toDate(a)) / 86400000);
	}

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	function dayMonth(iso) {
		const d = toDate(iso);
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function longDay(iso) {
		return `${DAYS[toDate(iso).getDay()]}, ${dayMonth(iso)}`;
	}

	function days(n) {
		return n + (n === 1 ? ' day' : ' days');
	}

	function person(id) {
		return PEOPLE[id];
	}

	function nameOf(id) {
		return `${person(id).first} ${person(id).last}`;
	}

	function firstOf(id) {
		return person(id).first;
	}

	function avatar(id, size) {
		const p = person(id);
		const initials = (p.first.charAt(0) + p.last.replace(/^O’/, '').charAt(0)).toUpperCase();
		return `<span class="basalt-avatar basalt-avatar-${size || 'sm'} basalt-avatar-tone-${TEAMS[p.team].tone}" aria-hidden="true">${htmlSafe(initials)}</span>`;
	}

	/* The name opens the person's page on Employees; the rest of the row
     opens the review in the drawer. */
	function profileUrl(id) {
		return `employee-details.html?id=${encodeURIComponent(id)}`;
	}

	function band(rating) {
		if (rating >= 4.5) return 'Exceptional';
		if (rating >= 3.8) return 'Strong';
		if (rating >= 3) return 'Solid';
		return 'Developing';
	}
	function stagePill(key) {
		return `<span class="basalt-status basalt-status-dot pf-stage-pill" data-stage="${key}">${stageOf(key).label}</span>`;
	}

	/* Where each review stands */
	const reviews = REVIEWS.map((r) => Object.assign({}, r));

	function team(r) {
		return person(r.who).team;
	}

	/* The day the review's current step should be done by. */
	function dueOf(r) {
		if (r.stage === 'signed') return r.signed;
		if (r.stage === 'calibration') return TEAMS[team(r)].session;
		return r.due || stageOf(r.stage).due;
	}

	function isLate(r) {
		return ['self', 'peer', 'manager'].includes(r.stage) && dueOf(r) < TODAY;
	}

	function late() {
		return reviews
			.filter(isLate)
			.sort((a, b) => dueOf(a).localeCompare(dueOf(b)) || nameOf(a.who).localeCompare(nameOf(b.who)));
	}

	/* State */
	const state = { stage: '', q: '', team: '', all: false, open: null };
	let drawerList = [];

	const el = {
		track: pick('[data-pf-track]'),
		bands: pick('[data-pf-bands]'),
		rows: pick('[data-pf-rows]'),
		tableWrap: pick('[data-pf-table-wrap]'),
		empty: pick('[data-pf-empty]'),
		sub: pick('[data-pf-list-sub]'),
		more: pick('[data-pf-more]'),
		range: pick('[data-pf-range]'),
		moreBtn: pick('[data-pf-more-btn]'),
		tabs: pick('[data-pf-tabs]'),
		search: pick('[data-pf-search]'),
		team: pick('[data-pf-team]'),
		late: pick('[data-pf-late]'),
		drawer: pick('#pf-record'),
		form: pick('[data-pf-form]'),
		newDrawer: pick('#pf-new'),
	};

	function R(k) {
		return pick(`[data-pf-r="${k}"]`, el.drawer);
	}

	/* The stage track */
	/* A short line or two under each stage's count. */
	function stageNotes(s, list) {
		if (s.key === 'self' || s.key === 'peer') {
			const behind = list.filter(isLate).length;
			const moved = list.filter((r) => r.due);
			const notes = [];
			if (behind) notes.push({ text: `${behind} late`, late: true });
			if (moved.length) notes.push({ text: `${moved.length} extended` });
			return notes.length ? notes : [{ text: 'All done' }];
		}
		if (s.key === 'manager') return [{ text: `Due in ${days(dayGap(TODAY, s.due))}` }];
		if (s.key === 'calibration') return [{ text: 'Rated, waiting for the session' }];
		return [
			{ text: list.length ? andList(Array.from(new Set(list.map((r) => TEAMS[team(r)].name)))) : 'None yet' },
		];
	}
	/* Who is sitting in a stage: a few faces, late ones first. Clicking
     them shows that stage's reviews in the table. */
	const FACES = 3;
	function faces(s, list) {
		if (!list.length) return '<span class="pf-stage-faces"></span>';
		const sorted = list.slice().sort((a, b) => isLate(b) - isLate(a) || nameOf(a.who).localeCompare(nameOf(b.who)));
		const extra = list.length - FACES;
		return `<span class="pf-stage-faces"><button type="button" class="pf-faces" data-pf-show="${s.key}" aria-label="Show the ${list.length === 1 ? 'review' : `${list.length} reviews`} at ${s.label.toLowerCase()}"><span class="basalt-avatar-group basalt-avatar-group-sm">${sorted
			.slice(0, extra > 0 ? FACES - 1 : FACES)
			.map((r) => avatar(r.who, 'xs'))
			.join(
				'',
			)}${extra > 0 ? `<span class="basalt-avatar basalt-avatar-xs basalt-avatar-more" aria-hidden="true">+${extra + 1}</span>` : ''}</span></button></span>`;
	}

	function andList(a) {
		return a.join(', ').replace(/, ([^,]*)$/, ' and $1');
	}

	function renderTrack() {
		const now = STAGES.findIndex((s) => s.due >= TODAY);
		el.track.innerHTML = STAGES.map((s, i) => {
			const list = reviews.filter((r) => r.stage === s.key);
			const notes = stageNotes(s, list);
			const when = s.from ? `${dayMonth(s.from)} – ${toDate(s.due).getDate()}` : `By ${dayMonth(s.due)}`;
			return `<li class="pf-stage${i < now ? ' is-past' : ''}${i === now ? ' is-now' : ''}" data-stage="${s.key}"${i === now ? ' aria-current="step"' : ''}><span class="pf-stage-head"><span class="pf-stage-mark" aria-hidden="true">${i + 1}</span>${i === now ? '<span class="pf-stage-now">Now</span>' : ''}</span><p class="pf-stage-name">${s.label}</p><p class="pf-stage-date">${when}</p><span class="pf-stage-count">${list.length}<span class="visually-hidden"> ${list.length === 1 ? 'review' : 'reviews'}</span></span><span class="pf-stage-notes">${notes.map((n) => `<span class="pf-stage-note${n.late ? ' is-late' : ''}">${htmlSafe(n.text)}</span>`).join('')}</span>${faces(s, list)}</li>`;
		}).join('');
		pick('[data-pf-cycle-sub]').textContent =
			`Opened ${dayMonth(CYCLE.opened)}, closes ${dayMonth(CYCLE.closes)}. Manager reviews are due ${dayMonth(stageOf('manager').due)}.`;
		const left = dayGap(TODAY, CYCLE.closes);
		pick('[data-pf-left]').innerHTML = `<span class="pf-left-n">${left}</span> ${left === 1 ? 'day' : 'days'} left`;
		renderLate();
	}

	/* The late reviews, in one slim line under the track. */
	function renderLate() {
		const list = late();
		const waiting = list.filter((r) => r.reminded !== TODAY);
		let html;
		if (!list.length) {
			html =
				'<i class="bi bi-check2-circle pf-late-icon" aria-hidden="true"></i><p class="pf-late-text">Nothing is late. Every review is on time.</p>';
		} else if (!waiting.length) {
			html = `<i class="bi bi-bell pf-late-icon" aria-hidden="true"></i><p class="pf-late-text">${cap(count(list.length, 'late review'))}. Everyone behind was reminded today.</p>`;
		} else {
			html = `<i class="bi bi-clock-history pf-late-icon is-late" aria-hidden="true"></i><p class="pf-late-text"><strong>${cap(count(list.length, 'review'))} late:</strong> ${htmlSafe(andList(list.map((r) => firstOf(r.who))))}.</p><button type="button" class="btn btn-outline-secondary btn-sm" data-pf-remind-late>${waiting.length === 1 ? 'Send a reminder' : 'Send reminders'}</button>`;
		}
		el.late.innerHTML = html;
	}

	/* Ratings by cycle */
	function renderBands() {
		const first = HISTORY[HISTORY.length - 1];
		const last = HISTORY[0];

		function share(h) {
			return Math.round((h.top / (h.top + h.strong + h.under)) * 100);
		}

		pick('[data-pf-bands-sub]').textContent = `Exceptional ratings rose from ${share(first)}% to ${share(last)}%.`;
		el.bands.innerHTML = HISTORY.map((h) => {
			const total = h.top + h.strong + h.under;

			function seg(k) {
				return `<span data-band="${k}" style="--pf-share:${((h[k] / total) * 100).toFixed(1)}%"></span>`;
			}

			return `<li class="pf-band"><p class="pf-band-cycle">${h.cycle}<span class="pf-band-people">${total} people</span></p><span class="pf-band-bar" aria-hidden="true">${seg('top')}${seg('strong')}${seg('under')}</span><span class="visually-hidden">${h.top} exceptional, ${h.strong} strong, ${h.under} under 3.8.</span><p class="pf-band-avg">${h.avg.toFixed(1)}<span class="pf-band-unit"> avg</span></p></li>`;
		}).join('');
	}

	/* Reviews table */
	function matches(r) {
		if (state.team && team(r) !== state.team) return false;
		if (!state.q) return true;
		const hay = `${nameOf(r.who)} ${person(r.who).role} ${nameOf(r.by)}`;
		return window.Basalt && window.Basalt.matchesQuery
			? window.Basalt.matchesQuery(hay, state.q)
			: hay.toLowerCase().includes(state.q.toLowerCase());
	}
	/* Late reviews first, then by stage and due date, then by name. */
	function visible() {
		return reviews
			.filter((r) => (!state.stage || r.stage === state.stage) && matches(r))
			.sort(
				(a, b) =>
					isLate(b) - isLate(a) ||
					stageIndex(a.stage) - stageIndex(b.stage) ||
					dueOf(a).localeCompare(dueOf(b)) ||
					nameOf(a.who).localeCompare(nameOf(b.who)),
			);
	}
	function dueHtml(r) {
		const due = dueOf(r);
		let note;
		if (r.stage === 'signed') note = 'Signed off';
		else if (isLate(r)) note = `${days(dayGap(due, TODAY))} late`;
		else if (due === TODAY) note = 'Today';
		else note = `In ${days(dayGap(TODAY, due))}`;
		return `<span class="pf-due">${dayMonth(due)}</span><span class="pf-due-note${isLate(r) ? ' is-late' : ''}">${note}</span>`;
	}
	function ratingHtml(r) {
		if (!r.rating) return '<span class="pf-rating-none">Not yet</span>';
		return `<span class="pf-rating"><i class="bi bi-star-fill" aria-hidden="true"></i>${r.rating.toFixed(1)}</span><span class="pf-rating-band">${band(r.rating)}</span>`;
	}
	function rowHtml(r) {
		const p = person(r.who);
		return `<tr data-id="${r.id}"><td><span class="pf-who">${avatar(r.who)}<span><a class="pf-who-name" href="${profileUrl(r.who)}">${htmlSafe(nameOf(r.who))}</a><span class="pf-who-role">${htmlSafe(p.role)}</span></span></span></td><td><span class="pf-reviewer">${htmlSafe(nameOf(r.by))}</span></td><td>${stagePill(r.stage)}</td><td>${dueHtml(r)}</td><td class="pf-num">${ratingHtml(r)}</td><td><span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-pf-open="${r.id}" aria-label="Quick view: ${htmlSafe(nameOf(r.who))}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${profileUrl(r.who)}" aria-label="Open full page: ${htmlSafe(nameOf(r.who))}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span></td></tr>`;
	}
	function emptyHtml(o) {
		return `<div class="basalt-empty basalt-empty-compact basalt-empty-${o.tone} pf-empty"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi ${o.icon}"></i></span><h3 class="basalt-empty-title">${o.title}</h3><p class="basalt-empty-text">${o.text}</p>${o.actions ? `<div class="basalt-empty-actions">${o.actions}</div>` : ''}</div>`;
	}
	function viewEmpty() {
		if (state.q || state.team) {
			return emptyHtml({
				tone: 'muted',
				icon: 'bi-search',
				title: 'No reviews match',
				text: `Nothing here matches ${state.q ? `“${htmlSafe(state.q)}”` : 'that team'}. Try another name or team.`,
				actions:
					'<button type="button" class="btn btn-sm btn-outline-secondary" data-pf-reset>Clear the search</button>',
			});
		}
		return emptyHtml({
			tone: 'muted',
			icon: 'bi-inbox',
			title: 'Nothing at this stage',
			text: `Reviews show up here as they reach ${stageOf(state.stage).label.toLowerCase()}.`,
		});
	}
	function paintTable() {
		const list = visible();
		const shown = state.all ? list : list.slice(0, PAGE_SIZE);
		el.rows.innerHTML = shown.map(rowHtml).join('');
		if (window.Basalt.tips) window.Basalt.tips(el.rows);
		el.tableWrap.hidden = !list.length;
		el.empty.hidden = !!list.length;
		el.empty.innerHTML = list.length ? '' : viewEmpty();
		el.more.hidden = !list.length;
		el.range.innerHTML =
			list.length > shown.length
				? `Showing <strong>${shown.length}</strong> of ${list.length} reviews`
				: list.length + (list.length === 1 ? ' review' : ' reviews');
		el.moreBtn.hidden = list.length <= shown.length;
		el.moreBtn.textContent = `Show all ${list.length}`;

		const behind = late().length;
		el.sub.textContent = `${cap(count(reviews.length, 'review'))} in ${CYCLE.name}${behind ? `, the ${count(behind, 'late one')} first.` : '.'}`;

		for (const s of STAGES.concat({ key: '' })) {
			pick(`[data-pf-count="${s.key}"]`, el.tabs).textContent = reviews.filter(
				(r) => !s.key || r.stage === s.key,
			).length;
		}
	}

	function refresh() {
		renderTrack();
		paintTable();
	}

	/* Review drawer */
	function drawerCtl() {
		return bootstrap.Offcanvas.getOrCreateInstance(el.drawer);
	}

	function stateText(r) {
		const first = firstOf(r.who);
		const due = dueOf(r);
		switch (r.stage) {
			case 'self':
				return isLate(r)
					? `${first} hasn’t sent the self-review yet. It was due on ${dayMonth(due)}.`
					: `Self-review due on ${dayMonth(due)}.`;
			case 'peer':
				return `${r.peers[1]} of ${r.peers[0]} peers have answered. Feedback was due on ${dayMonth(due)}.`;
			case 'manager':
				return `Self-review and peer feedback are in. Waiting for ${nameOf(r.by)}’s review, due ${dayMonth(due)}.`;
			case 'calibration':
				return `${nameOf(r.by)} proposed ${r.rating.toFixed(1)}. ${TEAMS[team(r)].name} calibrates on ${longDay(due)}.`;
			default:
				return `Signed off at ${r.rating.toFixed(1)} on ${dayMonth(r.signed)} and shared with ${first}.`;
		}
	}
	function stateHtml(r) {
		const notes = [];
		if (r.note) notes.push(r.note);
		if (r.reminded === TODAY) notes.push('Reminder sent today.');
		return `<div class="pf-r-state">${stagePill(r.stage)}<p class="pf-r-state-text">${htmlSafe(stateText(r))}</p>${notes.map((n) => `<p class="pf-r-note">${htmlSafe(n)}</p>`).join('')}</div>`;
	}
	function scoreHtml(r) {
		if (!r.rating) return '';
		const by =
			r.stage === 'signed'
				? `Agreed at calibration on ${dayMonth(TEAMS[team(r)].session)}`
				: `Proposed by ${nameOf(r.by)}`;
		return `<div class="pf-r-score" data-stage="${r.stage}"><p class="pf-r-score-value">${r.rating.toFixed(1)}</p><div><p class="pf-r-score-band">${band(r.rating)}</p><p class="pf-r-score-by">${htmlSafe(by)}</p></div></div><section aria-labelledby="pf-r-scores"><h3 class="pf-r-h" id="pf-r-scores">Scores out of 5</h3><ul class="pf-meters">${COMPETENCIES.map((c, i) => meter(c, r.scores[i].toFixed(1), (r.scores[i] / 5) * 100, false)).join('')}</ul></section>`;
	}
	function meter(name, value, pct, done) {
		return `<li class="pf-meter${done ? ' is-done' : ''}"><p class="pf-meter-name">${htmlSafe(name)}</p><p class="pf-meter-value">${value}</p><span class="pf-meter-bar" aria-hidden="true"><span style="--pf-fill:${pct}%"></span></span></li>`;
	}
	function goalsHtml(r) {
		return `<section aria-labelledby="pf-r-goals"><h3 class="pf-r-h" id="pf-r-goals">Goals</h3><ul class="pf-meters pf-meters-goals">${r.goals.map((g) => meter(g[0], `${g[1]}%`, g[1], g[1] === 100)).join('')}</ul></section>`;
	}
	function feedbackHtml(r) {
		const body = r.said
			? `<dl class="pf-quotes"><div><dt>Strengths</dt><dd>${htmlSafe(r.said[0])}</dd></div><div><dt>To work on</dt><dd>${htmlSafe(r.said[1])}</dd></div></dl><p class="pf-quotes-by">From ${count(r.peers[1], 'peer')} and ${firstOf(r.who)}’s self-review.</p>`
			: `<p class="pf-r-wait">Shows here once ${firstOf(r.who)}’s peers have answered.</p>`;
		return `<section aria-labelledby="pf-r-feedback"><h3 class="pf-r-h" id="pf-r-feedback">Feedback</h3>${body}</section>`;
	}
	function promoHtml(r) {
		if (r.stage !== 'calibration') return '';
		return `<section aria-labelledby="pf-r-promo"><h3 class="pf-r-h" id="pf-r-promo">Promotion</h3><div class="pf-promo"><div><p class="pf-promo-label" id="pf-r-promo-label">Put forward for promotion</p><p class="pf-promo-hint">Talked about at the ${dayMonth(dueOf(r))} session.</p></div><div class="form-check form-switch"><input class="form-check-input" type="checkbox" role="switch" aria-labelledby="pf-r-promo-label" data-pf-promo${r.promote ? ' checked' : ''}></div></div></section>`;
	}
	function factsHtml(r) {
		const p = person(r.who);
		const rows = [
			['Team', htmlSafe(TEAMS[p.team].name)],
			['Reviewer', `<a href="${profileUrl(r.by)}">${htmlSafe(nameOf(r.by))}</a>`],
			['Peers', `${r.peers[1]} of ${r.peers[0]} answered`],
			['Calibration', longDay(TEAMS[p.team].session)],
			['Promotion', r.stage === 'signed' ? (r.promote ? 'Put forward' : 'Not this cycle') : ''],
			['Review', `<span class="pf-id">${r.id}</span>`],
		].filter((x) => x[1]);
		return `<section aria-labelledby="pf-r-details"><h3 class="pf-r-h" id="pf-r-details">Details</h3><dl class="pf-r-facts">${rows.map((x) => `<dt>${x[0]}</dt><dd>${x[1]}</dd>`).join('')}</dl></section>`;
	}
	/* The one thing this review needs. */
	function footHtml(r) {
		if (isLate(r))
			return '<button type="button" class="btn btn-primary" data-pf-act="remind"><i class="bi bi-bell me-1" aria-hidden="true"></i>Send a reminder</button>';
		if (r.stage === 'signed')
			return '<button type="button" class="btn btn-outline-secondary" data-pf-act="pdf"><i class="bi bi-download me-1" aria-hidden="true"></i>Download PDF</button>';
		return '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="offcanvas">Close</button>';
	}
	function paintDrawer() {
		const r = reviews.find((x) => x.id === state.open);
		if (!r) return;
		const at = drawerList.findIndex((x) => x.id === r.id);
		R('title').textContent = nameOf(r.who);
		R('sub').textContent = `${person(r.who).role} · ${CYCLE.name}`;
		R('full').href = profileUrl(r.who);
		R('pos').textContent = at >= 0 ? `${at + 1} of ${drawerList.length}` : '';

		for (const b of pickAll('[data-pf-r-step]', el.drawer)) {
			b.disabled = at < 0 || drawerList.length < 2;
		}

		R('body').innerHTML =
			stateHtml(r) + scoreHtml(r) + goalsHtml(r) + feedbackHtml(r) + promoHtml(r) + factsHtml(r);
		R('foot').innerHTML = footHtml(r);
	}
	function openReview(id, dir) {
		state.open = id;
		paintDrawer();
		R('body').scrollTop = 0;
		if (dir)
			for (const n of pickAll(':scope > *', R('body'))) {
				n.style.animation = 'none';
				void n.offsetWidth;
				n.style.animation = '';
			}
		drawerCtl().show();
	}
	function step(dir) {
		if (drawerList.length < 2) return;
		const at = drawerList.findIndex((x) => x.id === state.open);
		openReview(drawerList[(at + dir + drawerList.length) % drawerList.length].id, dir);
	}

	/* Reminders */
	/* Who a reminder goes to: the person for a self-review, the peers who
     haven't answered for peer feedback, the reviewer for the manager review. */
	function remindText(list) {
		const parts = [];
		const own = list
			.filter((r) => r.stage === 'self')
			.map((r) => nameOf(r.who))
			.concat(list.filter((r) => r.stage === 'manager').map((r) => nameOf(r.by)));
		const peers = list.filter((r) => r.stage === 'peer').reduce((n, r) => n + r.peers[0] - r.peers[1], 0);
		if (own.length) parts.push(andList(own));
		if (peers)
			parts.push(
				`${(parts.length ? 'the ' : 'The ') + (peers === 1 ? 'peer' : `${peers} peers`)} still to answer`,
			);
		return `${parts.join(' and ')} will get an email today.`;
	}
	function remind(list) {
		list.forEach((r) => {
			r.reminded = TODAY;
		});
		renderTrack();
		if (state.open) paintDrawer();
	}

	/* Plan a cycle */
	function fieldError(input, bad) {
		input.classList.toggle('is-invalid', bad);
		input.setAttribute('aria-invalid', String(bad));
		return bad;
	}
	function paintNew() {
		const f = el.form;
		const ok = f.opens.value && f.closes.value && f.closes.value > f.opens.value;
		const weeks = ok ? Math.round(dayGap(f.opens.value, f.closes.value) / 7) : 0;
		pick('[data-pf-new-span]').textContent = ok
			? `${cap(count(weeks, 'week'))}, from ${longDay(f.opens.value)} to ${longDay(f.closes.value)}.`
			: '';
		pick('[data-pf-new-who]').textContent =
			`${NEXT_CYCLE_PEOPLE} people${f.opens.value ? ` get a self-review form on ${dayMonth(f.opens.value)}` : ''}. The leadership team is reviewed by the CEO.`;
	}
	function submitNew(e) {
		e.preventDefault();
		const f = el.form;
		const opens = f.opens.value;
		const closes = f.closes.value;
		const badOpen = !opens || opens < f.opens.min || opens > f.opens.max;
		const badClose = !badOpen && (!closes || closes > f.closes.max || dayGap(opens, closes) < 28);
		const bad = [
			fieldError(f.name, !f.name.value.trim()) && f.name,
			fieldError(f.opens, badOpen) && f.opens,
			fieldError(f.closes, badClose) && f.closes,
		].filter(Boolean);
		if (bad.length) {
			bad[0].focus();
			return;
		}
		bootstrap.Offcanvas.getOrCreateInstance(el.newDrawer).hide();
		toast({
			tone: 'success',
			icon: 'bi-calendar-check',
			title: `${f.name.value.trim()} scheduled`,
			text: `It opens on ${longDay(opens)} for ${NEXT_CYCLE_PEOPLE} people and closes on ${dayMonth(closes)}.`,
		});
	}
	function resetNew() {
		el.form.reset();

		for (const i of pickAll('.is-invalid', el.form)) {
			i.classList.remove('is-invalid');
			i.removeAttribute('aria-invalid');
		}

		paintNew();
	}

	/* Wiring */
	function start() {
		el.tabs.addEventListener('change', (e) => {
			if (!e.target.matches('input[name="pfView"]')) return;
			state.stage = e.target.value;
			state.all = false;
			paintTable();
		});
		let typing;
		el.search.addEventListener('input', () => {
			clearTimeout(typing);
			typing = setTimeout(() => {
				state.q = el.search.value.trim();
				state.all = false;
				paintTable();
			}, 150);
		});
		el.team.addEventListener('change', () => {
			state.team = el.team.value;
			state.all = false;
			paintTable();
		});
		el.moreBtn.addEventListener('click', () => {
			window.Basalt.slide(el.tableWrap, () => {
				state.all = true;
				paintTable();
			});
		});
		el.empty.addEventListener('click', (e) => {
			if (!e.target.closest('[data-pf-reset]')) return;
			el.search.value = '';
			el.team.value = '';
			el.team.dispatchEvent(new Event('change', { bubbles: true }));
			state.q = '';
			paintTable();
			el.search.focus();
		});

		/* The panel icon opens the review's quick view; the rest of a row
       opens the person's full page, as their name does, in a new tab
       with Cmd, Ctrl, Shift or the middle button. */
		function rowPage(e) {
			const tr = e.target.closest('tr[data-id]');
			return tr && !e.target.closest('a, button') ? pick('.pf-who-name', tr).href : '';
		}

		el.rows.addEventListener('click', (e) => {
			const quick = e.target.closest('[data-pf-open]');
			if (quick) {
				drawerList = visible();
				openReview(quick.getAttribute('data-pf-open'), 0);
				return;
			}
			const url = rowPage(e);
			if (!url) return;
			if (e.metaKey || e.ctrlKey || e.shiftKey) window.open(url, '_blank');
			else location.href = url;
		});
		el.rows.addEventListener('auxclick', (e) => {
			const url = e.button === 1 && rowPage(e);
			if (url) window.open(url, '_blank');
		});

		/* A stage's faces pick that stage's tab and bring the table into view. */
		el.track.addEventListener('click', (e) => {
			const b = e.target.closest('[data-pf-show]');
			if (!b) return;
			const tab = pick(`input[name="pfView"][value="${b.getAttribute('data-pf-show')}"]`, el.tabs);
			tab.checked = true;
			tab.dispatchEvent(new Event('change', { bubbles: true }));
			tab.closest('.pf-card').scrollIntoView({
				behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
				block: 'start',
			});
		});

		el.late.addEventListener('click', (e) => {
			if (!e.target.closest('[data-pf-remind-late]')) return;
			const list = late().filter((r) => r.reminded !== TODAY);
			remind(list);
			toast({
				tone: 'success',
				icon: 'bi-bell',
				title: list.length === 1 ? 'Reminder sent' : 'Reminders sent',
				text: remindText(list),
			});
		});

		pick('[data-pf-export]').addEventListener('click', () => {
			toast({
				tone: 'success',
				icon: 'bi-download',
				title: 'Export started',
				text: `${cap(count(reviews.length, 'review'))} from ${CYCLE.name}, as a CSV file.`,
			});
		});

		for (const b of pickAll('[data-pf-r-step]', el.drawer)) {
			b.addEventListener('click', () => step(+b.getAttribute('data-pf-r-step')));
		}

		el.drawer.addEventListener('keydown', (e) => {
			if (!e.altKey) return;
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				step(-1);
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				step(1);
			}
		});
		el.drawer.addEventListener('hidden.bs.offcanvas', () => {
			state.open = null;
		});
		el.drawer.addEventListener('click', (e) => {
			const b = e.target.closest('[data-pf-act]');
			if (!b) return;
			const r = reviews.find((x) => x.id === state.open);
			if (b.getAttribute('data-pf-act') === 'remind') {
				remind([r]);
				R('title').focus();
				toast({ tone: 'success', icon: 'bi-bell', title: 'Reminder sent', text: remindText([r]) });
			} else {
				toast({
					tone: 'success',
					icon: 'bi-download',
					title: 'Download started',
					text: `${nameOf(r.who)}’s ${CYCLE.name} review, as a PDF.`,
				});
			}
		});
		el.drawer.addEventListener('change', (e) => {
			if (!e.target.matches('[data-pf-promo]')) return;
			const r = reviews.find((x) => x.id === state.open);
			r.promote = e.target.checked;
			toast({
				tone: 'info',
				icon: 'bi-award',
				title: r.promote ? 'Put forward' : 'Taken off the list',
				text: `${nameOf(r.who) + (r.promote ? ' is on the promotion list for the ' : ' is no longer on the promotion list for the ') + dayMonth(dueOf(r))} session.`,
			});
		});

		el.form.addEventListener('submit', submitNew);
		el.form.addEventListener('change', (e) => {
			if (e.target.classList.contains('is-invalid')) fieldError(e.target, false);
			paintNew();
		});
		el.form.addEventListener('input', (e) => {
			if (e.target === el.form.name && e.target.value.trim()) fieldError(e.target, false);
			paintNew();
		});
		el.newDrawer.addEventListener('hidden.bs.offcanvas', resetNew);

		renderBands();
		refresh();
		paintNew();
		/* The stage counts and the days left count up from zero once. */
		window.Basalt.countUp?.(pickAll('.pf-stage-count, .pf-left-n'));
		drawTrack();
	}

	/**
	 * The first time the stage track is on screen, the line up to the
	 * current stage draws in one stretch after another.
	 */
	function drawTrack() {
		const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!pick('.pf-stage.is-past', el.track) || still || !window.IntersectionObserver) return;
		el.track.classList.add('is-waiting');
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				el.track.classList.replace('is-waiting', 'is-drawing');
				const runs = el.track.getAnimations({ subtree: true }).map((run) => run.finished);
				Promise.allSettled(runs).then(() => el.track.classList.remove('is-drawing'));
			},
			{ threshold: 0.5 },
		);
		watch.observe(el.track);
	}

	document.addEventListener('DOMContentLoaded', start);
})();
