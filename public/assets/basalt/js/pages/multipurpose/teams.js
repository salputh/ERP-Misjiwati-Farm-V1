/**
 * Basalt - Teams (teams.html)
 * Runs on the page that has [data-tm-root].
 *
 * The groups that carry Fieldline's projects: who is on each
 * team, who leads it, which projects it owns and what is due
 * next. A team's card opens its full page; its panel icon opens
 * a quick view drawer, where people are added and the team is
 * edited.
 *
 * To use your own data, fill the shared roster and projects
 * (assets/basalt/js/data/multipurpose/people.js and projects.js) and TEAMS with
 * what your backend returns, and send each change in the
 * places marked "save". TODAY is pinned to October 9, 2026
 * so the demo always reads the same; in a real app use
 * new Date().
 *
 * Teams link to team-details.html?id=<id>, people to
 * employee-user-details.html?id=<id> and projects to
 * project-details.html?id=<id>, the same ids employee-users.js and
 * projects.js use.
 */
(() => {
	'use strict';
	const page = pick('[data-tm-root]');
	if (!page) return;

	function start() {
		pick('[data-tm-add]', drawer).addEventListener('click', () => {
			adding = current;
			picked = new Set();
			adderSearch.value = '';
			addErr.hidden = true;
			pick('[data-tm-add-sub]', addModal).textContent = `Pick who should join ${adding.name}.`;
			drawPicks();
			countPicks();
			fromDrawer(addModal);
		});
		adderSearch.addEventListener('input', drawPicks);
		listAdder.addEventListener('change', (e) => {
			const box = e.target.closest('input[type="checkbox"]');
			if (!box) return;
			if (box.checked) picked.add(box.value);
			else picked.delete(box.value);
			countPicks();
		});
		addModal.addEventListener('shown.bs.modal', () => adderSearch.focus());
		addModal.addEventListener('hidden.bs.modal', returnToDrawer);

		createForm.addEventListener('submit', (e) => {
			e.preventDefault();
			if (!picked.size) {
				addErr.hidden = false;
				return;
			}
			const t = adding;
			const ids = Array.from(picked);

			for (const id of ids) {
				t.people.push(id);
			}

			window.bootstrap.Modal.getOrCreateInstance(addModal).hide(); /* save */
			refresh();
			toast({
				tone: 'success',
				icon: 'bi-person-plus',
				title:
					ids.length === 1
						? `${PEOPLE[ids[0]].name} joined ${t.name}`
						: `${ids.length} people joined ${t.name}`,
				text: 'They see the team’s projects from now on.',
				actions: [
					{
						label: 'Undo',
						onClick() {
							t.people = t.people.filter((id) => !ids.includes(id));
							refresh();
						},
					},
				],
			});
		});

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

	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	const B = window.Basalt || {};

	const TODAY = new Date(2026, 9, 9);
	const DAY = 86400000;
	const ME = 'ja';

	/* People and projects
	   People come from Fieldline's one roster (data/multipurpose/people.js): tone is
	   1 to 8, one of the palette's chart colors, the same for a person
	   on every page; invited people have not started yet. Projects come
	   from data/multipurpose/projects.js, the same records Projects shows.
	   status  on-track | at-risk | blocked | not-started | done
	   done    tasks finished, out of total
	   next    the next milestone [name, 'YYYY-MM-DD']
	   start   when a not-started project begins
	   ended   when a finished project was finished */
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
	const PROJECTS = {};
	window.Basalt.data.projects.list.forEach((rec) => {
		const s = window.Basalt.data.projects.summary(rec);
		const next = s.milestones.find((m) => !m[2]);
		const last = s.milestones[s.milestones.length - 1];
		PROJECTS[s.id] = {
			name: s.name,
			status: s.status,
			done: s.done,
			total: s.total,
			start: s.start,
			next: next ? [next[0], next[1]] : null,
			ended: next ? null : last[1],
		};
	});

	/* Teams
	   people  ids from PEOPLE; lead is one of them
	   tone    1 to 8, the team's color on the card and drawer */
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
		},
	];

	const STATUS = {
		'on-track': { label: 'On track', tone: 'success' },
		'at-risk': { label: 'At risk', tone: 'warning' },
		blocked: { label: 'Blocked', tone: 'danger' },
		'not-started': { label: 'Not started', tone: '' },
		done: { label: 'Done', tone: 'primary' },
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

	/* What each team is carrying */
	function teamById(id) {
		return TEAMS.find((t) => t.id === id);
	}

	function live(t) {
		return t.projects.filter((id) => PROJECTS[id].status !== 'done');
	}

	function openTasks(t) {
		return live(t).reduce((n, id) => n + PROJECTS[id].total - PROJECTS[id].done, 0);
	}

	function people(n) {
		return n === 1 ? '1 person' : `${n} people`;
	}

	function projectsWord(n) {
		return n === 1 ? 'project' : 'projects';
	}

	function pct(p) {
		return p.total ? Math.round((p.done / p.total) * 100) : 0;
	}

	/* The milestone the team meets next: late ones first, then the soonest. */
	function nextUp(t) {
		const ids = live(t)
			.slice()
			.sort((a, b) => PROJECTS[a].next[1].localeCompare(PROJECTS[b].next[1]));
		return ids.length
			? { project: PROJECTS[ids[0]], name: PROJECTS[ids[0]].next[0], date: PROJECTS[ids[0]].next[1] }
			: null;
	}

	function summary(t) {
		const n = live(t).length;
		const head = inWords(t.people.length) + (t.people.length === 1 ? ' person' : ' people');
		if (!n) return `${head} so far, and no live projects yet.`;
		const next = nextUp(t);
		const tasks = openTasks(t);
		const start = live(t)
			.map((id) => PROJECTS[id])
			.find((p) => p.status === 'not-started' && p === next.project);
		let text = `${head} on ${inWords(n).toLowerCase()} live ${projectsWord(n)}, ${tasks} tasks still open. `;
		if (start) text += `${next.project.name} starts ${short(start.start)}.`;
		else if (daysFrom(next.date) < 0)
			text += `${next.name} was due ${short(next.date)} and is ${relative(next.date)}.`;
		else text += `Next: ${next.name}, ${short(next.date)}.`;
		return text;
	}

	function pill(status) {
		const s = STATUS[status];
		return `<span class="basalt-status basalt-status-dot${s.tone ? ` basalt-status-${s.tone}` : ''}">${s.label}</span>`;
	}

	function initials(name) {
		return name
			.split(/\s+/)
			.map((w) => w[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}

	function avatar(id, size) {
		const who = PEOPLE[id];
		return `<span class="basalt-avatar ${size} basalt-avatar-tone-${who.tone}" title="${htmlSafe(who.name)}">${initials(who.name)}</span>`;
	}

	function profile(id) {
		return `employee-user-details.html?id=${encodeURIComponent(id)}`;
	}

	function projectUrl(id) {
		return `project-details.html?id=${encodeURIComponent(id)}`;
	}

	function teamUrl(id) {
		return `team-details.html?id=${encodeURIComponent(id)}`;
	}

	/* Team cards */
	const grid = pick('[data-tm-grid]', page);
	const search = pick('[data-tm-search]', page);
	const count = pick('[data-tm-count]', page);
	const state = { show: 'all', q: '' };
	const SHOWN_FACES = 4;
	let shown = [];

	function haystack(t) {
		return [t.name, t.about]
			.concat(
				t.people.map((id) => PEOPLE[id].name),
				t.projects.map((id) => PROJECTS[id].name),
			)
			.join(' ');
	}

	function matches(t, q) {
		return B.matchesQuery ? B.matchesQuery(haystack(t), q) : haystack(t).toLowerCase().includes(q.toLowerCase());
	}

	function card(t) {
		const lead = PEOPLE[t.lead];
		const faces = [t.lead].concat(t.people.filter((id) => id !== t.lead));
		const extra = faces.length - SHOWN_FACES;
		const next = nextUp(t);
		const projects = live(t)
			.map((id) => {
				const p = PROJECTS[id];
				return `<li><div class="tm-card-project"><a href="${projectUrl(id)}">${htmlSafe(p.name)}</a>${pill(p.status)}</div><span class="tm-bar" role="progressbar" aria-label="${htmlSafe(p.name)} tasks done" aria-valuenow="${pct(p)}" aria-valuemin="0" aria-valuemax="100" title="${p.done} of ${p.total} tasks done"><span class="tm-bar-fill" style="--tm-pct: ${pct(p)}%"></span></span></li>`;
			})
			.join('');
		let foot = '<span class="tm-next">Nothing scheduled yet</span>';
		if (next) {
			const late = daysFrom(next.date) < 0;
			foot = `<span class="tm-next">${htmlSafe(next.name)}</span><span class="tm-when${late ? ' is-late' : ''}">${short(next.date)} · ${relative(next.date)}</span>`;
		}
		return `<article class="card basalt-box tm-card tm-tone-${t.tone}" data-tm-card="${t.id}"><div class="tm-card-main"><span class="tm-icon" aria-hidden="true"><i class="bi ${t.icon}"></i></span><div class="tm-card-name"><h3 class="tm-card-title"><a href="${teamUrl(t.id)}">${htmlSafe(t.name)}</a></h3><p class="tm-card-lead">Led by ${htmlSafe(lead.name)}</p></div><p class="tm-card-about">${htmlSafe(t.about)}</p></div><span class="basalt-row-actions tm-card-actions"><button type="button" class="btn btn-icon btn-sm" data-tm-open="${t.id}" aria-label="Quick view: ${htmlSafe(t.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${teamUrl(t.id)}" aria-label="Open full page: ${htmlSafe(t.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span><div class="tm-card-people"><span class="basalt-avatar-group">${faces
			.slice(0, SHOWN_FACES)
			.map((id) => avatar(id, 'basalt-avatar-sm'))
			.join(
				'',
			)}</span>${extra > 0 ? `<span class="tm-card-more">+${extra}</span>` : ''}<span class="tm-card-count">${people(t.people.length)}</span></div><div class="tm-card-block"><p class="tm-label">Live projects</p>${projects ? `<ul class="tm-card-projects">${projects}</ul>` : '<p class="tm-card-none">No projects yet</p>'}</div><div class="tm-card-foot"><p class="tm-label">Next up</p>${foot}</div></article>`;
	}

	function render() {
		shown = TEAMS.filter(
			(t) => (state.show === 'all' || t.people.includes(ME)) && (!state.q || matches(t, state.q)),
		);
		if (shown.length) {
			grid.innerHTML = shown.map(card).join('');
			if (window.Basalt.tips) window.Basalt.tips(grid);
		} else {
			grid.innerHTML = `<div class="tm-grid-empty">${
				B.emptyState
					? B.emptyState({
							query: state.q,
							noun: 'teams',
							text:
								state.show === 'mine'
									? `You are on ${TEAMS.filter((t) => t.people.includes(ME)).length} teams. Try All teams, or a shorter search.`
									: null,
						})
					: ''
			}</div>`;
		}
		count.textContent = shown.length === 1 ? '1 team' : `${shown.length} teams`;
	}

	for (const r of pickAll('input[name="tm-show"]', page)) {
		r.addEventListener('change', () => {
			if (!r.checked) return;
			state.show = r.value;
			render();
		});
	}

	search.addEventListener('input', () => {
		state.q = search.value.trim();
		render();
	});

	/* Links go where they say. The panel icon opens the quick view; anywhere
     else on a card opens the team's full page, and the middle button or
     Cmd/Ctrl opens it in a new tab, as a link would. A team added in the
     demo has no full page, so its card opens the quick view. */
	const made = new Set();
	function cardClick(e) {
		if (e.button > 1 || e.target.closest('a')) return;
		const b = e.target.closest('[data-tm-open]');
		const c = e.target.closest('[data-tm-card]');
		if (!c) return;
		const id = c.getAttribute('data-tm-card');
		if (b || made.has(id)) {
			if (e.button === 0) openTeam(id);
			return;
		}
		if (e.button === 1 || e.metaKey || e.ctrlKey) window.open(teamUrl(id), '_blank');
		else location.href = teamUrl(id);
	}
	grid.addEventListener('click', cardClick);
	grid.addEventListener('auxclick', (e) => {
		if (e.button === 1) cardClick(e);
	});

	/* Team drawer */
	const drawer = document.getElementById('tm-team');

	function d(k) {
		return pick(`[data-tm-d="${k}"]`, drawer);
	}

	function bsDrawer() {
		return window.bootstrap.Offcanvas.getOrCreateInstance(drawer);
	}

	let navList = [];
	let nav = null;
	let current = null;

	function personRow(t, id) {
		const who = PEOPLE[id];
		const tag =
			id === t.lead
				? '<span class="basalt-status basalt-status-primary">Lead</span>'
				: who.invited
					? '<span class="basalt-status basalt-status-info">Invited</span>'
					: '';
		return `<li class="tm-d-person">${avatar(id, 'basalt-avatar-sm')}<span class="tm-d-person-text"><a href="${profile(id)}">${htmlSafe(who.name)}</a><span class="tm-d-person-title">${htmlSafe(who.title)}</span></span><span class="tm-d-person-tag">${tag}</span></li>`;
	}

	function projectRow(id) {
		const p = PROJECTS[id];
		let when;
		if (p.status === 'done') when = `All ${p.total} tasks done · finished ${short(p.ended)}`;
		else if (p.status === 'not-started') when = `${p.total} tasks planned · starts ${short(p.start)}`;
		else when = `${p.done} of ${p.total} tasks done`;
		return `<li class="tm-d-project"><div class="tm-d-project-top"><a href="${projectUrl(id)}">${htmlSafe(p.name)}</a>${pill(p.status)}</div><div class="tm-d-project-bar"><span class="tm-bar" role="progressbar" aria-label="${htmlSafe(p.name)} tasks done" aria-valuenow="${pct(p)}" aria-valuemin="0" aria-valuemax="100"><span class="tm-bar-fill" style="--tm-pct: ${pct(p)}%"></span></span><span class="tm-d-project-pct">${pct(p)}%</span></div><p class="tm-d-project-when">${when}</p></li>`;
	}

	function renderTeam(t) {
		current = t;
		drawer.className = `${drawer.className.replace(/\btm-tone-\d\b/g, '').trim()} tm-tone-${t.tone}`;
		d('icon').innerHTML = `<i class="bi ${t.icon}"></i>`;
		d('name').textContent = t.name;
		d('sub').textContent = t.about;
		pick('[data-tm-full]', drawer).href = teamUrl(t.id);
		d('summary').textContent = summary(t);
		const order = [t.lead].concat(
			t.people.filter((id) => id !== t.lead).sort((a, b) => PEOPLE[a].name.localeCompare(PEOPLE[b].name)),
		);
		d('people').innerHTML = order.map((id) => personRow(t, id)).join('');
		/* Live projects first, finished ones after. */
		const ids = live(t).concat(t.projects.filter((id) => PROJECTS[id].status === 'done'));
		d('projects').innerHTML = ids.length
			? ids.map(projectRow).join('')
			: '<li class="tm-d-none">No projects yet. Teams get projects on the <a href="projects.html">Projects</a> page.</li>';
	}

	function openTeam(id) {
		const t = teamById(id);
		if (!t) return;
		navList = shown.includes(t) ? shown.slice() : [t];
		if (!nav && window.Basalt.drawer) {
			nav = window.Basalt.drawer.recordNav(drawer, { valueOf: () => Math.max(1, navList.length) }, (at) =>
				renderTeam(navList[at]),
			);
		}
		if (nav) nav.go(navList.indexOf(t), 0);
		else renderTeam(t);
		pick('.basalt-drawer-nav', drawer).hidden = navList.length < 2;
		bsDrawer().show();
	}

	function refresh() {
		render();
		if (current) renderTeam(current);
	}

	/* Dialogs open from the drawer one at a time: the drawer steps aside
     while the dialog is up and comes back when it closes. */
	let back = null;
	function fromDrawer(modal) {
		back = current;
		drawer.addEventListener('hidden.bs.offcanvas', () => window.bootstrap.Modal.getOrCreateInstance(modal).show(), {
			once: true,
		});
		bsDrawer().hide();
	}
	function returnToDrawer() {
		if (!back) return;
		const t = back;
		back = null;
		openTeam(t.id);
	}

	/* New team and Edit team */
	const teamModal = document.getElementById('tm-team-dialog');
	const form = pick('[data-tm-form]', teamModal);
	const nameIn = pick('[data-tm-form-name]', teamModal);
	const nameErr = pick('[data-tm-form-error]', teamModal);
	const aboutIn = pick('[data-tm-form-about]', teamModal);
	const leadIn = pick('[data-tm-form-lead]', teamModal);
	const tones = pick('[data-tm-form-tones]', teamModal);
	let editing = null;

	function roster() {
		return Object.keys(PEOPLE).sort((a, b) => PEOPLE[a].name.localeCompare(PEOPLE[b].name));
	}

	leadIn.innerHTML = roster()
		.map((id) => `<option value="${id}">${htmlSafe(PEOPLE[id].name)}</option>`)
		.join('');
	tones.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8]
		.map(
			(n) =>
				`<input type="radio" class="btn-check" name="tm-tone" id="tm-tone-${n}" value="${n}" aria-label="Color ${n}"><label class="tm-swatch tm-tone-${n}" for="tm-tone-${n}"></label>`,
		)
		.join('');

	function setLead(id) {
		leadIn.value = id;
		if (window.Basalt.select) window.Basalt.select.refresh(leadIn);
	}
	function nameProblem(show) {
		nameErr.hidden = !show;
		nameIn.classList.toggle('is-invalid', show);
		nameIn.setAttribute('aria-invalid', String(show));
	}

	function fillForm(t) {
		editing = t;
		pick('[data-tm-form-title]', teamModal).textContent = t ? 'Edit team' : 'New team';
		pick('[data-tm-form-sub]', teamModal).textContent = t
			? 'Changes show on the card and on the team’s page.'
			: 'The lead joins it straight away. Add everyone else after.';
		pick('[data-tm-form-submit]', teamModal).textContent = t ? 'Save changes' : 'Create team';
		nameIn.value = t ? t.name : '';
		aboutIn.value = t ? t.about : '';
		setLead(t ? t.lead : ME);
		const tone = t ? t.tone : (TEAMS.length % 8) + 1;
		pick(`#tm-tone-${tone}`, teamModal).checked = true;
		nameProblem(false);
	}

	pick('[data-tm-new]', page).addEventListener('click', () => fillForm(null));
	pick('[data-tm-edit]', drawer).addEventListener('click', () => {
		fillForm(current);
		fromDrawer(teamModal);
	});
	nameIn.addEventListener('input', () => {
		if (nameIn.value.trim()) nameProblem(false);
	});
	teamModal.addEventListener('shown.bs.modal', () => nameIn.focus());
	teamModal.addEventListener('hidden.bs.modal', () => {
		if (editing) returnToDrawer();
		editing = null;
	});

	form.addEventListener('submit', (e) => {
		e.preventDefault();
		const name = nameIn.value.trim();
		if (!name) {
			nameProblem(true);
			nameIn.focus();
			return;
		}
		const about = aboutIn.value.trim();
		const lead = leadIn.value;
		const tone = Number(pick('input[name="tm-tone"]:checked', teamModal).value);
		if (editing) {
			Object.assign(editing, { name, about: about || editing.about, lead, tone });
			if (!editing.people.includes(lead)) editing.people.unshift(lead);
			window.bootstrap.Modal.getOrCreateInstance(teamModal).hide(); /* save */
			render();
			toast({ tone: 'success', title: 'Team saved', text: `${name} is led by ${PEOPLE[lead].name}.` });
			return;
		}
		const t = {
			id: `team-${Date.now()}`,
			name,
			about: about || 'Just set up.',
			icon: 'bi-people',
			tone,
			lead,
			people: [lead],
			projects: [],
		};
		TEAMS.push(t);
		made.add(t.id);
		window.bootstrap.Modal.getOrCreateInstance(teamModal).hide(); /* save */
		if (state.show === 'mine' && !t.people.includes(ME)) {
			const all = pick('#tm-show-all', page);
			all.checked = true;
			all.dispatchEvent(new Event('change', { bubbles: true }));
		}
		if (state.q && !matches(t, state.q)) {
			search.value = '';
			state.q = '';
		}
		render();
		const el = pick(`[data-tm-card="${t.id}"]`, grid);
		if (el) {
			if (!reduce.matches) el.classList.add('is-new');
			el.scrollIntoView({ block: 'nearest', behavior: reduce.matches ? 'auto' : 'smooth' });
		}
		toast({
			tone: 'success',
			title: 'Team created',
			text: `${name}, led by ${PEOPLE[lead].name}.`,
			actions: [
				{
					label: 'Add people',
					onClick() {
						openTeam(t.id);
						pick('[data-tm-add]', drawer).click();
					},
				},
			],
		});
	});

	/* Add people */
	const addModal = document.getElementById('tm-add-dialog');
	const createForm = pick('[data-tm-add-form]', addModal);
	const adderSearch = pick('[data-tm-add-search]', addModal);
	const listAdder = pick('[data-tm-add-list]', addModal);
	const addCount = pick('[data-tm-add-count]', addModal);
	const addErr = pick('[data-tm-add-error]', addModal);
	let picked = new Set();
	let adding = null;

	function otherTeams(id, t) {
		const on = TEAMS.filter((x) => x !== t && x.people.includes(id)).map((x) => x.name);
		return on.length ? `On ${on.join(' and ')}` : '';
	}

	function drawPicks() {
		const q = adderSearch.value.trim();
		const ids = roster()
			.filter((id) => !adding.people.includes(id))
			.filter(
				(id) =>
					!q ||
					(B.matchesQuery
						? B.matchesQuery(`${PEOPLE[id].name} ${PEOPLE[id].title}`, q)
						: `${PEOPLE[id].name} ${PEOPLE[id].title}`.toLowerCase().includes(q.toLowerCase())),
			);
		listAdder.innerHTML = ids.length
			? ids
					.map((id) => {
						const who = PEOPLE[id];
						const also = otherTeams(id, adding);
						return `<li><label class="tm-pick-row"><input class="form-check-input" type="checkbox" value="${id}"${picked.has(id) ? ' checked' : ''}>${avatar(id, 'basalt-avatar-sm')}<span class="tm-pick-text"><span class="tm-pick-name">${htmlSafe(who.name)}${who.invited ? ' <span class="basalt-status basalt-status-info">Invited</span>' : ''}</span><span class="tm-pick-title">${htmlSafe(who.title)}${also ? ` · ${htmlSafe(also)}` : ''}</span></span></label></li>`;
					})
					.join('')
			: `<li class="tm-pick-empty">${B.emptyState ? B.emptyState({ query: q, noun: 'people' }) : ''}</li>`;
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
