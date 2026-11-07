/**
 * Basalt - Team Details (team-details.html)
 * Runs on the page that has [data-tmd-root].
 *
 * One team in full: who is on it and how much each person has
 * open, the milestones coming up, the projects it carries, its
 * settings and what it did lately. Everything is drawn from
 * PEOPLE, PROJECTS and the team's record in TEAMS, so adding
 * someone, changing the lead or renaming the team updates every
 * card at once.
 *
 * The page shows the team named by ?id=, the same six teams the
 * Teams page lists; opened on its own it shows Customer
 * Rollouts. To use your own data, load the record your backend
 * returns into these constants and send each change in the
 * places marked "save". TODAY is pinned to October 9, 2026, as on
 * the Teams page, so the demo always reads the same; in a real
 * app use new Date().
 *
 * People link to employee-user-details.html?id=<id> and projects to
 * project-details.html?id=<id>, the same ids teams.js uses.
 */
(() => {
	'use strict';
	const page = pick('[data-tmd-root]');
	if (!page) return;

	function start() {
		addModal.addEventListener('show.bs.modal', () => {
			picked = new Set();
			adderSearch.value = '';
			addErr.hidden = true;
			pick('[data-tmd-add-sub]', addModal).textContent = `Pick who should join ${TEAM.name}.`;
			drawPicks();
			countPicks();
		});
		addModal.addEventListener('shown.bs.modal', () => adderSearch.focus());
		adderSearch.addEventListener('input', drawPicks);
		listAdder.addEventListener('change', (e) => {
			const box = e.target.closest('input[type="checkbox"]');
			if (!box) return;
			if (box.checked) picked.add(box.value);
			else picked.delete(box.value);
			countPicks();
		});

		createForm.addEventListener('submit', (e) => {
			e.preventDefault();
			if (!picked.size) {
				addErr.hidden = false;
				return;
			}
			const ids = Array.from(picked);

			for (const id of ids) {
				TEAM.people.push(id);
			} /* save */

			window.bootstrap.Modal.getOrCreateInstance(addModal).hide();
			paintEverything();
			toast({
				tone: 'success',
				icon: 'bi-person-plus',
				title:
					ids.length === 1
						? `${PEOPLE[ids[0]].name} joined ${TEAM.name}`
						: `${ids.length} people joined ${TEAM.name}`,
				text: 'They see the team’s projects from now on.',
				actions: [
					{
						label: 'Undo',
						onClick() {
							TEAM.people = TEAM.people.filter((id) => !ids.includes(id));
							paintEverything();
						},
					},
				],
			});
		});

		/* Copy link and archive */
		pick('[data-tmd-copy]', page).addEventListener('click', () => {
			if (window.Basalt.copyText) window.Basalt.copyText(window.location.href);
			toast({
				tone: 'success',
				icon: 'bi-link-45deg',
				title: 'Link copied',
				text: `Anyone on the workspace can open ${TEAM.name}.`,
			});
		});

		const archiveModal = document.getElementById('tmd-archive');
		pick('[data-tmd-archive]', page).addEventListener('click', () =>
			window.bootstrap.Modal.getOrCreateInstance(archiveModal).show(),
		);
		archiveModal.addEventListener('show.bs.modal', () => {
			pick('[data-tmd-archive-note]', archiveModal).textContent =
				`${TEAM.name} leaves the Teams page. Its ${lower(live().length)} live ${projectsWord(live().length)} and ${openAll()} open tasks carry on, and everyone keeps their tasks.`;
		});
		pick('[data-tmd-archive-confirm]', archiveModal).addEventListener('click', () => {
			window.bootstrap.Modal.getOrCreateInstance(archiveModal).hide(); /* save */
			toast({
				tone: 'success',
				icon: 'bi-archive',
				title: `${TEAM.name} archived`,
				text: 'It no longer shows on the Teams page.',
				actions: [
					{
						label: 'Undo',
						onClick() {
							toast({ tone: 'success', title: `${TEAM.name} is back on the Teams page` });
						},
					},
				],
			});
		});

		paintEverything();
		paintFeed();
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function el(k) {
		return pick(`[data-tmd="${k}"]`, page);
	}

	function htmlSafe(s) {
		return String(s == null ? '' : s).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	const B = window.Basalt || {};

	const TODAY = new Date(2026, 9, 9);
	const DAY = 86400000;

	/* People and projects
	   People come from Fieldline's one roster (data/multipurpose/people.js): tone is
	   1 to 8, one of the palette's chart colors, the same for a person
	   on every page; invited people have not started yet. Projects,
	   with their milestones, open tasks and activity, come from
	   data/multipurpose/projects.js, the same records Projects and Project Details
	   show.
	   status     on-track | at-risk | blocked | not-started | done
	   done       tasks finished, out of total
	   customer   for customer rollouts, shown with a link
	   note       why an off-track project is off track
	   milestones [name, 'YYYY-MM-DD', finished] in date order */
	const ROSTER = window.Basalt.data.people;
	const PEOPLE = {};
	ROSTER.staff.forEach((x) => {
		PEOPLE[x.id] = {
			name: ROSTER.nameOf(x),
			title: x.title,
			tone: ROSTER.toneOf(x),
			invited: !ROSTER.hasStarted(x),
		};
	});
	const DATA = window.Basalt.data.projects;
	const PROJECTS = {};
	DATA.list.forEach((rec) => {
		PROJECTS[rec.id] = Object.assign(DATA.summary(rec), { tasks: rec.tasks, feed: rec.feed });
	});

	/* Teams
	   The same teams as teams.js, with what only this page shows.
	   work  open tasks each person has on each project, and how
	         many of them are due in the next seven days (week)
	   feed  newest first; what is HTML written here, never from
	         what a visitor types; p is the project it belongs to */
	const TEAMS = [
		{
			id: 'route-planning',
			name: 'Travel Planning',
			about: 'Travel Planner and the schedule map.',
			icon: 'bi-signpost-split',
			tone: 1,
			lead: 'hw',
			people: ['hw', 'lm', 'nfe', 'fr', 'ao'],
			projects: ['route'],
			channel: '#travel-planning',
			created: '2024-06-03',
			createdBy: 'ja',
		},
		{
			id: 'customer-portal',
			name: 'Customer Portal',
			about: 'Where customers book, track and pay.',
			icon: 'bi-person-workspace',
			tone: 6,
			lead: 'lg',
			people: ['lg', 'yt', 'jw', 'nfe'],
			projects: ['portal'],
			channel: '#customer-portal',
			created: '2025-01-20',
			createdBy: 'ja',
		},
		{
			id: 'platform',
			name: 'Platform',
			about: 'Hosting, data, security and uptime.',
			icon: 'bi-hdd-stack',
			tone: 8,
			lead: 'as',
			people: ['as', 'ds', 'ka', 'im', 'pd', 'ja'],
			projects: ['eu'],
			channel: '#platform',
			created: '2023-11-06',
			createdBy: 'ja',
		},
		{
			id: 'customer-rollouts',
			name: 'Customer Rollouts',
			about: 'Gets new accounts live on Fieldline.',
			icon: 'bi-building-check',
			tone: 4,
			lead: 'ev',
			people: ['ev', 'gl', 'nf', 'cd', 'ta'],
			projects: ['onboard', 'volt', 'sunvale'],
			channel: '#customer-rollouts',
			created: '2025-03-12',
			createdBy: 'ja',
		},
		{
			id: 'web-store',
			name: 'Web and Portal',
			about: 'The website, pricing and the Portal.',
			icon: 'bi-window',
			tone: 5,
			lead: 'cr',
			people: ['cr', 'sr', 'dk', 'ja'],
			projects: ['store', 'web', 'pricing'],
			channel: '#web-and-portal',
			created: '2025-05-14',
			createdBy: 'ja',
		},
		{
			id: 'mobile-app',
			name: 'Mobile App',
			about: 'The team member app on iOS and Android.',
			icon: 'bi-phone',
			tone: 2,
			lead: 'og',
			people: ['og', 'th', 'jp', 'so'],
			projects: ['sms'],
			channel: '#mobile-app',
			created: '2024-02-26',
			createdBy: 'ja',
		},
	];

	/* The team to show: ?id= from the Teams page, or Customer
     Rollouts when the page is opened on its own. */
	const wanted = new URLSearchParams(window.location.search).get('id');
	const TEAM = TEAMS.find((t) => t.id === wanted) || TEAMS.find((t) => t.id === 'customer-rollouts');
	/* What each person still has open on the team's projects, and how
     many of those tasks are due in the next seven days (week). */
	const WORK = {};
	TEAM.projects.forEach((pid) =>
		PROJECTS[pid].tasks.forEach(([, , who, due]) => {
			const w = WORK[who] || (WORK[who] = { week: 0 });
			w[pid] = (w[pid] || 0) + 1;
			const d = due.split('-').map(Number);
			if (Math.round((new Date(d[0], d[1] - 1, d[2]) - TODAY) / DAY) <= 7) w.week += 1;
		}),
	);
	/* What the team did across its projects, newest first. */
	const FEED = TEAM.projects
		.reduce(
			(all, pid) =>
				all.concat(PROJECTS[pid].feed.map(([who, icon, what, at]) => ({ who, p: pid, icon, what, at }))),
			[],
		)
		.sort((a, b) => b.at.localeCompare(a.at))
		.map((a) => Object.assign(a, { when: DATA.when(a.at) }));
	const FEED_SHOWN = 4;

	/* Every milestone the team's live projects still have to reach. */
	function live() {
		return TEAM.projects.filter((id) => PROJECTS[id].status !== 'done');
	}

	function milestones() {
		return live().reduce(
			(list, id) => list.concat(PROJECTS[id].milestones.filter((m) => !m[2]).map((m) => [id, m[0], m[1]])),
			[],
		);
	}

	const STATUS = {
		'on-track': { label: 'On track', tone: 'success' },
		'at-risk': { label: 'At risk', tone: 'warning' },
		blocked: { label: 'Blocked', tone: 'danger' },
		'not-started': { label: 'Not started', tone: '' },
	};
	const NUMBERS = [
		'No',
		'One',
		'Two',
		'Three',
		'Four',
		'Five',
		'Six',
		'Seven',
		'Eight',
		'Nine',
		'Ten',
		'Eleven',
		'Twelve',
	];

	function inWords(n) {
		return NUMBERS[n] || String(n);
	}

	function lower(n) {
		return inWords(n).toLowerCase();
	}

	/* Dates */
	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	function parse(iso) {
		const p = iso.split('-').map(Number);
		return new Date(p[0], p[1] - 1, p[2]);
	}
	function short(iso) {
		const d = parse(iso);
		return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}
	function long(iso) {
		const d = parse(iso);
		return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
	}

	function daysFrom(iso) {
		return Math.round((parse(iso) - TODAY) / DAY);
	}

	function relative(iso) {
		const n = daysFrom(iso);
		if (n === 0) return 'today';
		if (n === 1) return 'tomorrow';
		if (n > 1) return `in ${n} days`;
		return `${n === -1 ? '1 day' : `${-n} days`} late`;
	}

	/* Small pieces */
	function initials(name) {
		return name
			.split(/\s+/)
			.map((w) => w[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}

	function avatar(id, size) {
		return `<span class="basalt-avatar ${size} basalt-avatar-tone-${PEOPLE[id].tone}" aria-hidden="true">${initials(PEOPLE[id].name)}</span>`;
	}

	function profile(id) {
		return `employee-user-details.html?id=${encodeURIComponent(id)}`;
	}

	function projectUrl(id) {
		return `project-details.html?id=${encodeURIComponent(id)}`;
	}

	function person(id) {
		return `<a class="tmd-person" href="${profile(id)}">${htmlSafe(PEOPLE[id].name)}</a>`;
	}

	function pill(status) {
		return `<span class="basalt-status basalt-status-dot${STATUS[status].tone ? ` basalt-status-${STATUS[status].tone}` : ''}">${STATUS[status].label}</span>`;
	}

	function peopleWord(n) {
		return n === 1 ? '1 person' : `${n} people`;
	}

	function projectsWord(n) {
		return n === 1 ? 'project' : 'projects';
	}

	function liveWords() {
		return `${inWords(live().length)} live ${projectsWord(live().length)}`;
	}

	function pct(p) {
		return Math.round((p.done / p.total) * 100);
	}

	function openOf(id) {
		return live().reduce((n, p) => n + ((WORK[id] || {})[p] || 0), 0);
	}

	function weekOf(id) {
		return (WORK[id] || {}).week || 0;
	}

	function openAll() {
		return TEAM.people.reduce((n, id) => n + openOf(id), 0);
	}

	/* Lead first, then whoever has the most open. */
	function busiestFirst(a, b) {
		return openOf(b) - openOf(a) || PEOPLE[a].name.localeCompare(PEOPLE[b].name);
	}

	function ordered() {
		return [TEAM.lead].concat(TEAM.people.filter((id) => id !== TEAM.lead).sort(busiestFirst));
	}

	/* Cover */
	const cover = el('cover');
	function renderCover() {
		cover.className = `${cover.className.replace(/\btmd-tone-\d\b/g, '').trim()} tmd-tone-${TEAM.tone}`;

		for (const i of pickAll('[data-tmd="icon"] .bi, [data-tmd="band-icon"]', cover)) {
			i.className = `bi ${TEAM.icon}`;
		}

		el('name').textContent = TEAM.name;
		el('about').textContent = TEAM.about;
		el('meta').innerHTML =
			`Led by ${person(TEAM.lead)}<span aria-hidden="true"> · </span>${peopleWord(TEAM.people.length)}<span aria-hidden="true"> · </span>${liveWords()}`;
		document.title = `${TEAM.name} · Basalt`;
	}

	/* People and workload */
	const SCALE = 8; /* open tasks that fill a bar; a fuller week runs past it */
	function personRow(id) {
		const who = PEOPLE[id];
		const open = openOf(id);
		const week = weekOf(id);
		const scale = Math.max(SCALE, ...TEAM.people.map(openOf));
		const segs = live()
			.filter((p) => (WORK[id] || {})[p])
			.map((p) => {
				const n = WORK[id][p];
				return `<span class="tmd-load-seg tmd-tone-${PROJECTS[p].tone}" style="--tmd-w: ${(n / scale) * 100}%" title="${htmlSafe(PROJECTS[p].name)}: ${n} open"></span>`;
			})
			.join('');
		const tag =
			id === TEAM.lead
				? '<span class="basalt-status basalt-status-primary">Lead</span>'
				: who.invited
					? '<span class="basalt-status basalt-status-info">Invited</span>'
					: '';
		const label = open ? `${open} open tasks, ${week} due this week` : 'No open tasks';
		const menu =
			id === TEAM.lead
				? `<li><span class="dropdown-item-text tmd-menu-note">Pick a new lead before removing ${htmlSafe(who.name.split(' ')[0])}.</span></li>`
				: `<li><button type="button" class="dropdown-item" data-tmd-lead="${id}"><i class="bi bi-star" aria-hidden="true"></i>Make team lead</button></li><li><button type="button" class="dropdown-item" data-tmd-remove="${id}"><i class="bi bi-person-dash" aria-hidden="true"></i>Remove from team</button></li>`;
		return `<li class="tmd-person-row" data-tmd-person="${id}"><div class="tmd-who">${avatar(id, '')}<span class="tmd-who-text"><span class="tmd-who-name">${person(id)}${tag}</span><span class="tmd-who-title">${htmlSafe(who.title)}</span></span></div><div class="tmd-load"><span class="tmd-load-bar" role="img" aria-label="${label}">${segs}</span><span class="tmd-load-text">${open ? `<strong>${open} open</strong><span>${week ? `${week} this week` : 'none this week'}</span>` : '<span>No open tasks</span>'}</span></div><div class="dropdown tmd-person-row-menu"><button type="button" class="btn btn-icon" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="More for ${htmlSafe(who.name)}"><i class="bi bi-three-dots" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end tmd-menu">${menu}</ul></div></li>`;
	}

	function renderPeople() {
		const order = ordered();
		el('people').innerHTML = order.map(personRow).join('');
		const busiest = TEAM.people.slice().sort(busiestFirst)[0];
		const open = openAll();
		let desc = `${open} open tasks across ${lower(live().length)} ${projectsWord(live().length)}.`;
		if (busiest && openOf(busiest)) {
			desc += ` ${PEOPLE[busiest].name} has the most${weekOf(busiest) ? `, ${weekOf(busiest)} of them due this week.` : ', none due this week.'}`;
		}
		el('people-desc').textContent = desc;
		el('key').innerHTML = live()
			.map(
				(p) =>
					`<li><span class="tmd-key-dot tmd-tone-${PROJECTS[p].tone}" aria-hidden="true"></span>${htmlSafe(PROJECTS[p].name)}</li>`,
			)
			.join('');
	}

	/* Coming up */
	function renderSoon() {
		const list = milestones().sort((a, b) => a[2].localeCompare(b[2]));
		el('soon').innerHTML = list
			.map((m) => {
				const p = PROJECTS[m[0]];
				const d = parse(m[2]);
				const n = daysFrom(m[2]);
				const tone = n < 0 ? ' basalt-status-danger' : n <= 7 ? ' basalt-status-warning' : '';
				return `<li class="tmd-soon-item"><span class="tmd-date tmd-tone-${p.tone}" aria-hidden="true"><span class="tmd-date-day">${d.getDate()}</span><span class="tmd-date-month">${MONTHS[d.getMonth()]}</span></span><span class="tmd-soon-text"><span class="tmd-soon-name">${htmlSafe(m[1])}</span><span class="tmd-soon-project"><a href="${projectUrl(m[0])}">${htmlSafe(p.name)}</a> · ${short(m[2])}</span></span><span class="basalt-status tmd-soon-when${tone}">${relative(m[2])}</span></li>`;
			})
			.join('');
		const first = list[0];
		el('soon-desc').textContent =
			`${inWords(list.length)} milestones, ${daysFrom(first[2]) < 0 ? 'one ' : 'the first '}${relative(first[2])}.`;
	}

	/* Projects */
	function renderProjects() {
		const ids = live();
		const done = ids.reduce((n, id) => n + PROJECTS[id].done, 0);
		const total = ids.reduce((n, id) => n + PROJECTS[id].total, 0);
		const off = ids.filter((id) => PROJECTS[id].status === 'at-risk' || PROJECTS[id].status === 'blocked');
		const finished = TEAM.projects.filter((id) => PROJECTS[id].status === 'done');
		let desc = liveWords();
		if (off.length)
			desc += `, ${lower(off.length)} ${off.length === 1 ? STATUS[PROJECTS[off[0]].status].label.toLowerCase() : 'off track'}`;
		else if (ids.length > 1 && ids.every((id) => PROJECTS[id].status === 'on-track')) desc += ', all on track';
		desc += `. ${done} of ${total} tasks done.`;
		if (finished.length)
			desc += ` ${finished.map((id) => PROJECTS[id].name).join(' and ')}${finished.length === 1 ? ' is' : ' are'} finished.`;
		el('projects-desc').textContent = desc;
		const list = el('projects');
		list.setAttribute('data-count', String(ids.length));
		list.innerHTML = ids
			.map((id) => {
				const p = PROJECTS[id];
				const count =
					p.status === 'not-started' ? `Starts ${short(p.start)}` : `${p.done} of ${p.total} tasks done`;
				const next = milestones()
					.filter((m) => m[0] === id)
					.sort((a, b) => a[2].localeCompare(b[2]))[0];
				const sub = p.customer
					? `<a href="company-details.html?id=${encodeURIComponent(p.customerId)}">${htmlSafe(p.customer)}</a>`
					: htmlSafe(p.area);
				return `<li class="tmd-project tmd-tone-${p.tone}"><div class="tmd-project-top"><span class="tmd-icon" aria-hidden="true"><i class="bi ${p.icon}"></i></span><span class="tmd-project-name"><a href="${projectUrl(id)}">${htmlSafe(p.name)}</a><span class="tmd-project-sub">${sub}</span></span></div><div class="tmd-project-mid"><div class="basalt-ring basalt-ring-sm tmd-ring" style="--value: ${pct(p)}" role="img" aria-label="${pct(p)}% of tasks done"><svg viewBox="0 0 120 120" aria-hidden="true"><path class="basalt-ring-track" d="M112 60 A52 52 0 1 1 8 60 A52 52 0 1 1 112 60" pathLength="100"></path><path class="basalt-ring-bar" d="M112 60 A52 52 0 1 1 8 60 A52 52 0 1 1 112 60" pathLength="100"></path></svg><span class="basalt-ring-label"><span class="basalt-ring-value">${pct(p)}%</span></span></div><div class="tmd-project-state">${pill(p.status)}<span class="tmd-project-count">${count}</span></div></div>${p.note ? `<p class="tmd-project-note">${htmlSafe(p.note)}</p>` : ''}<div class="tmd-project-foot">${next ? `<p class="tmd-project-next"><span class="tmd-project-label">Next milestone</span>${htmlSafe(next[1])}<span class="tmd-project-date${daysFrom(next[2]) < 0 ? ' is-late' : ''}">${short(next[2])} · ${relative(next[2])}</span></p>` : ''}</div></li>`;
			})
			.join('');
	}

	/* About the team */
	const aboutCard = el('about-card');
	const form = pick('[data-tmd-form]', aboutCard);
	const view = pick('[data-tmd-view]', aboutCard);
	const editButton = pick('[data-tmd-edit-team]', page);

	function f(k) {
		return pick(`[data-tmd-f="${k}"]`, form);
	}

	function err(k) {
		return pick(`[data-tmd-err="${k}"]`, form);
	}

	function renderFacts() {
		const invited = TEAM.people.filter((id) => PEOPLE[id].invited).length;
		const rows = [
			[
				'Lead',
				`<span class="tmd-fact-person">${avatar(TEAM.lead, 'basalt-avatar-xs')}${person(TEAM.lead)}</span>`,
			],
			['Works on', htmlSafe(TEAM.about)],
			['Chat channel', htmlSafe(TEAM.channel)],
			['People', peopleWord(TEAM.people.length) + (invited ? `, ${invited} still invited` : '')],
			['Created', `${long(TEAM.created)} by ${htmlSafe(PEOPLE[TEAM.createdBy].name)}`],
		];
		view.innerHTML = rows.map((r) => `<div class="tmd-fact"><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`).join('');
	}

	f('tones').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8]
		.map(
			(n) =>
				`<input type="radio" class="btn-check" name="tmd-tone" id="tmd-tone-${n}" value="${n}" aria-label="Color ${n}"><label class="tmd-swatch tmd-tone-${n}" for="tmd-tone-${n}"></label>`,
		)
		.join('');

	function problem(k, show) {
		err(k).hidden = !show;
		f(k).classList.toggle('is-invalid', show);
		f(k).setAttribute('aria-invalid', String(show));
	}

	function showEditor() {
		f('name').value = TEAM.name;
		f('about').value = TEAM.about;
		f('lead').innerHTML = TEAM.people
			.slice()
			.sort((a, b) => PEOPLE[a].name.localeCompare(PEOPLE[b].name))
			.map((id) => `<option value="${id}">${htmlSafe(PEOPLE[id].name)}</option>`)
			.join('');
		f('lead').value = TEAM.lead;
		f('channel').value = TEAM.channel;
		pick(`#tmd-tone-${TEAM.tone}`, form).checked = true;
		problem('name', false);
		problem('about', false);
		view.hidden = true;
		form.hidden = false;
	}
	function closeEditor() {
		form.hidden = true;
		view.hidden = false;
	}

	editButton.addEventListener('click', () => {
		if (form.hidden) showEditor();
		aboutCard.scrollIntoView({ block: 'start', behavior: reduce.matches ? 'auto' : 'smooth' });
		f('name').focus({ preventScroll: true });
	});
	pick('[data-tmd-cancel]', form).addEventListener('click', () => {
		closeEditor();
		editButton.focus({ preventScroll: true });
	});

	for (const k of ['name', 'about']) {
		f(k).addEventListener('input', () => {
			if (f(k).value.trim()) problem(k, false);
		});
	}

	form.addEventListener('submit', (e) => {
		e.preventDefault();
		const name = f('name').value.trim();
		const about = f('about').value.trim();
		problem('name', !name);
		problem('about', !about);
		if (!name || !about) {
			(name ? f('about') : f('name')).focus();
			return;
		}
		const channel = f('channel').value.trim();
		Object.assign(TEAM, {
			name,
			about,
			lead: f('lead').value,
			channel: channel ? (channel.startsWith('#') ? channel : `#${channel}`) : '—',
			tone: Number(pick('input[name="tmd-tone"]:checked', form).value),
		}); /* save */
		closeEditor();
		paintEverything();
		editButton.focus({ preventScroll: true });
		toast({ tone: 'success', title: 'Team saved', text: `${name} is led by ${PEOPLE[TEAM.lead].name}.` });
	});

	/* Recent activity */
	const feedMore = pick('[data-tmd-feed-more]', page);
	let feedAll = false;
	function paintFeed() {
		const items = feedAll ? FEED : FEED.slice(0, FEED_SHOWN);
		el('feed').innerHTML = items
			.map(
				(a) =>
					`<li class="tmd-feed-item"><span class="tmd-feed-icon tmd-tone-${PROJECTS[a.p].tone}" aria-hidden="true"><i class="bi ${a.icon}"></i></span><span class="tmd-feed-text"><span class="tmd-feed-what">${person(a.who)} ${a.what}</span><span class="tmd-feed-when">${a.when}</span></span></li>`,
			)
			.join('');
		feedMore.hidden = FEED.length <= FEED_SHOWN;
		feedMore.textContent = feedAll ? 'Show fewer' : `See all ${FEED.length}`;
		feedMore.setAttribute('aria-expanded', String(feedAll));
	}
	feedMore.addEventListener('click', () => {
		window.Basalt.slide(el('feed'), () => {
			feedAll = !feedAll;
			paintFeed();
		});
	});

	function paintEverything() {
		renderCover();
		renderPeople();
		renderSoon();
		renderProjects();
		renderFacts();
	}

	/* Changing who is on the team */
	el('people').addEventListener('click', (e) => {
		const make = e.target.closest('[data-tmd-lead]');
		const drop = e.target.closest('[data-tmd-remove]');
		if (make) {
			const id = make.getAttribute('data-tmd-lead');
			const before = TEAM.lead;
			TEAM.lead = id; /* save */
			paintEverything();
			toast({
				tone: 'success',
				icon: 'bi-star',
				title: `${PEOPLE[id].name} now leads ${TEAM.name}`,
				actions: [
					{
						label: 'Undo',
						onClick() {
							TEAM.lead = before;
							paintEverything();
						},
					},
				],
			});
		}
		if (drop) {
			const id = drop.getAttribute('data-tmd-remove');
			const at = TEAM.people.indexOf(id);
			const open = openOf(id);
			TEAM.people.splice(at, 1); /* save */
			paintEverything();
			toast({
				tone: 'success',
				icon: 'bi-person-dash',
				title: `${PEOPLE[id].name} left ${TEAM.name}`,
				text: open
					? `Their ${open} open tasks stay on the projects.`
					: 'They no longer see the team’s projects.',
				actions: [
					{
						label: 'Undo',
						onClick() {
							TEAM.people.splice(at, 0, id);
							paintEverything();
						},
					},
				],
			});
		}
	});

	/* Add people */
	const addModal = document.getElementById('tmd-add');
	const createForm = pick('[data-tmd-add-form]', addModal);
	const adderSearch = pick('[data-tmd-add-search]', addModal);
	const listAdder = pick('[data-tmd-add-list]', addModal);
	const addCount = pick('[data-tmd-add-count]', addModal);
	const addErr = pick('[data-tmd-add-error]', addModal);
	let picked = new Set();

	function drawPicks() {
		const q = adderSearch.value.trim();

		function text(id) {
			return `${PEOPLE[id].name} ${PEOPLE[id].title}`;
		}

		const ids = Object.keys(PEOPLE)
			.filter((id) => !TEAM.people.includes(id))
			.filter(
				(id) =>
					!q ||
					(B.matchesQuery ? B.matchesQuery(text(id), q) : text(id).toLowerCase().includes(q.toLowerCase())),
			)
			.sort((a, b) => PEOPLE[a].name.localeCompare(PEOPLE[b].name));
		listAdder.innerHTML = ids.length
			? ids
					.map((id) => {
						const who = PEOPLE[id];
						return `<li><label class="tmd-pick-row"><input class="form-check-input" type="checkbox" value="${id}"${picked.has(id) ? ' checked' : ''}>${avatar(id, 'basalt-avatar-sm')}<span class="tmd-pick-text"><span class="tmd-pick-name">${htmlSafe(who.name)}${who.invited ? ' <span class="basalt-status basalt-status-info">Invited</span>' : ''}</span><span class="tmd-pick-title">${htmlSafe(who.title)}</span></span></label></li>`;
					})
					.join('')
			: `<li class="tmd-pick-empty">${B.emptyState ? B.emptyState({ query: q, noun: 'people', text: q ? null : 'Everyone is on this team already.' }) : ''}</li>`;
	}
	function countPicks() {
		addCount.textContent = picked.size
			? picked.size === 1
				? '1 person picked'
				: `${picked.size} people picked`
			: 'No one picked yet';
		if (picked.size) addErr.hidden = true;
	}

	start();
})();
