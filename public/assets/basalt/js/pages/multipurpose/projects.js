/**
 * Projects overview (projects.html, the element marked [data-pj-root]).
 *
 * Every panel on the page reads the same project records, so the status
 * bar, the off-track tiles, the table, the due-soon list and the side
 * panel never disagree. The throughput chart draws from THROUGHPUT.
 *
 * Point the shared people and project files (assets/js/data/) and
 * THROUGHPUT at your own backend to go live. NOW stays fixed on
 * 9 October 2026 so screenshots match; swap in new Date() for real use.
 */
(() => {
	'use strict';

	const screen = pick('[data-pj-root]', document);
	if (!screen) return;

	const shared = window.Basalt || {};
	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const NOW = new Date(2026, 9, 9);
	const MS_PER_DAY = 86400000;
	const TYPEFACE = "'Schibsted Grotesk', sans-serif";

	/* Staff come from the single Fieldline roster and projects from the
     shared project file, which Project Details and the team pages read
     as well. Each person keeps one chart tone (1 to 8) across pages.
     A project record carries: status (on-track, at-risk, blocked,
     not-started or done), done of total tasks, team ids with the lead
     first, an optional customer, a note explaining any trouble, and
     milestones as [name, 'YYYY-MM-DD', finished] sorted by date. */
	const roster = window.Basalt.data.people;
	const staffById = {};
	for (const person of roster.staff.filter(roster.hasStarted)) {
		staffById[person.id] = { name: roster.nameOf(person), role: person.title, tone: roster.toneOf(person) };
	}
	const projects = window.Basalt.data.projects.list.map(window.Basalt.data.projects.summary);

	/* Project Board only has boards for these ids (see project-board.js). */
	const WITH_BOARD = ['store', 'web', 'onboard'];

	/* Tasks raised and closed across all projects, keyed by the Monday
     that opens each week. */
	const THROUGHPUT = [
		{ start: '2026-08-10', opened: 26, finished: 21 },
		{ start: '2026-08-17', opened: 22, finished: 24 },
		{ start: '2026-08-24', opened: 25, finished: 19 },
		{ start: '2026-08-31', opened: 24, finished: 26 },
		{ start: '2026-09-07', opened: 21, finished: 28 },
		{ start: '2026-09-14', opened: 27, finished: 23 },
		{ start: '2026-09-21', opened: 22, finished: 31 },
		{ start: '2026-09-28', opened: 20, finished: 27 },
	];

	const STAGES = {
		'on-track': { label: 'On track', tone: 'success' },
		'at-risk': { label: 'At risk', tone: 'warning' },
		blocked: { label: 'Blocked', tone: 'danger' },
		'not-started': { label: 'Not started', tone: '' },
		done: { label: 'Done', tone: 'primary' },
	};
	const STAGE_ORDER = ['on-track', 'at-risk', 'blocked', 'not-started', 'done'];
	const TROUBLED = ['at-risk', 'blocked'];
	const SPELLED = [
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
	const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DUE_VISIBLE = 5;

	/* Which projects each table filter keeps; "all" keeps everything. */
	const FILTERS = {
		active: (project) => project.status !== 'done',
		off: (project) => TROUBLED.includes(project.status),
		done: (project) => project.status === 'done',
	};

	/* Templates for the New project dialog; their milestones are spaced
     evenly from the coming Monday to the finish date. */
	const TEMPLATES = {
		launch: {
			area: 'Product',
			icon: 'bi-rocket-takeoff',
			tasks: 20,
			milestones: ['Spec signed off', 'Beta for first accounts', 'Help articles ready', 'Release'],
		},
		rollout: {
			area: 'Customer rollout',
			icon: 'bi-building-check',
			tasks: 16,
			milestones: ['Visits and customers imported', 'Scheduler training', 'Pilot teams live', 'Everyone live'],
		},
		blank: { area: 'Project', icon: 'bi-kanban', tasks: 0, milestones: ['Finished'] },
	};

	/* Side panel and dialog roots, then every other node the page writes to. */
	const quickView = document.getElementById('pj-project');
	const creator = document.getElementById('pj-new');
	const ui = {
		statusBar: pick('[data-pj-mix]'),
		statusLegend: pick('[data-pj-mix-key]'),
		helpTiles: pick('[data-pj-help]'),
		tableBody: pick('[data-pj-body]'),
		searchBox: pick('[data-pj-search]'),
		resultCount: pick('[data-pj-count]'),
		tableIntro: pick('[data-pj-list-desc]'),
		dueSoon: pick('[data-pj-due]'),
		dueOverflow: pick('[data-pj-due-more]'),
		chartCanvas: pick('[data-pj-chart]'),
		creatorForm: pick('[data-pj-new-form]', creator),
		titleField: pick('[data-pj-new-name]', creator),
		titleError: pick('[data-pj-new-error]', creator),
		leadField: pick('[data-pj-new-lead]', creator),
		finishField: pick('[data-pj-new-due]', creator),
	};

	/* What the visitor is looking at right now. */
	const view = { filter: 'active', query: '' };
	let tableRows = [];
	let troubled = [];
	let upcoming = [];
	let stepList = [];
	let stepper = null;
	let throughputChart = null;

	/** Wires every control, then paints each panel once. */
	function start() {
		ui.helpTiles.addEventListener('click', (event) => openFrom(event, 'data-pj-help-open', troubled));
		ui.dueSoon.addEventListener('click', (event) => openFrom(event, 'data-pj-due-open', upcoming));

		for (const option of [...pickAll('input[name="pj-show"]', screen)]) {
			option.addEventListener('change', () => {
				if (!option.checked) return;
				view.filter = option.value;
				paintTable();
			});
		}
		ui.searchBox.addEventListener('input', () => {
			view.query = ui.searchBox.value.trim();
			paintTable();
		});
		ui.tableBody.addEventListener('click', onTableClick);
		ui.tableBody.addEventListener('auxclick', (event) => {
			const target = event.button === 1 && rowTarget(event);
			if (target) window.open(target, '_blank');
		});

		if (ui.chartCanvas) {
			window.addEventListener('scroll', drawWhenNear, { passive: true });
			drawWhenNear();
		}
		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() => {
				if (throughputChart) drawChart(false);
			});
		});

		setUpCreator();

		paintTable();
		paintStanding();
		paintUpcoming();
		paintChartCopy();
	}

	/* Shared bits: lookups, escaping and toasts. */

	function pick(selector, scope = screen) {
		return scope.querySelector(selector);
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => entities[ch]);
	}

	function notify(message) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(message) : null;
	}

	function spell(number) {
		return SPELLED[number] || String(number);
	}

	function spellLower(number) {
		return spell(number).toLowerCase();
	}

	/* Calendar arithmetic, all against the pinned NOW. */

	function toDate(stamp) {
		const [year, month, day] = stamp.split('-').map(Number);
		return new Date(year, month - 1, day);
	}

	function toStamp(date) {
		const two = (n) => String(n).padStart(2, '0');
		return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
	}

	function dayName(stamp) {
		const date = toDate(stamp);
		return `${WEEKDAY_ABBR[date.getDay()]}, ${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
	}

	function offsetDays(stamp) {
		return Math.round((toDate(stamp) - NOW) / MS_PER_DAY);
	}

	/** Steps by calendar day so a daylight-saving change cannot shift it. */
	function shiftDays(date, amount) {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
	}

	function fromNow(stamp) {
		const gap = offsetDays(stamp);
		if (gap > 1) return `in ${gap} days`;
		if (gap === 1) return 'tomorrow';
		if (gap === 0) return 'today';
		return gap === -1 ? '1 day late' : `${-gap} days late`;
	}

	/* Facts derived from a single project record. */

	function leadOf({ team }) {
		return staffById[team[0]];
	}

	function percentDone({ done, total }) {
		return total ? Math.round((done / total) * 100) : 0;
	}

	function upcomingMilestone({ milestones }) {
		return milestones.find(([, , finished]) => !finished) || null;
	}

	function finalMilestone({ milestones }) {
		return milestones[milestones.length - 1];
	}

	function stillRunning({ status }) {
		return status !== 'done';
	}

	function overdue(step) {
		return Boolean(step) && !step[2] && offsetDays(step[1]) < 0;
	}

	function nextUp(project) {
		if (project.status === 'done') {
			const last = finalMilestone(project);
			return { name: last[0], when: `Finished ${dayName(last[1])}`, late: false };
		}
		const step = upcomingMilestone(project);
		return { name: step[0], when: `${dayName(step[1])} · ${fromNow(step[1])}`, late: overdue(step) };
	}

	function overview(project) {
		if (project.status === 'done')
			return `All ${project.total} tasks done. Finished on ${dayName(finalMilestone(project)[1])}.`;
		const step = upcomingMilestone(project);
		if (project.status === 'not-started') {
			const planned = project.total ? ` with ${project.total} tasks planned` : '';
			return `Starts ${dayName(project.start)}${planned}. First milestone: ${step[0]}, ${dayName(step[1])}.`;
		}
		const due = overdue(step) ? `due ${dayName(step[1])}` : dayName(step[1]);
		return `${project.done} of ${project.total} tasks done. Next: ${step[0]}, ${due}, ${fromNow(step[1])}.`;
	}

	function badge(status) {
		const { label, tone } = STAGES[status];
		const toneClass = tone ? ` basalt-status-${tone}` : '';
		return `<span class="basalt-status basalt-status-dot${toneClass}">${label}</span>`;
	}

	function face(personId, size) {
		const person = staffById[personId];
		const letters = person.name
			.split(/\s+/)
			.map((word) => word[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
		return `<span class="basalt-avatar ${size} basalt-avatar-tone-${person.tone}" title="${htmlSafe(person.name)}">${letters}</span>`;
	}

	function detailsHref(id) {
		return `project-details.html?id=${encodeURIComponent(id)}`;
	}

	/* Standing: the split bar, its legend and one tile per troubled
     project, blocked ones ahead of at-risk ones. */

	function paintStanding() {
		const tally = STAGE_ORDER.map((status) => ({
			status,
			total: projects.filter((p) => p.status === status).length,
		})).filter((entry) => entry.total);
		ui.statusBar.innerHTML = tally
			.map(
				({ status, total }) => `<span class="pj-mix-seg pj-mix-seg-${status}" style="--pj-n: ${total}"></span>`,
			)
			.join('');
		ui.statusBar.setAttribute(
			'aria-label',
			`Projects by status: ${tally.map(({ status, total }) => `${total} ${STAGES[status].label.toLowerCase()}`).join(', ')}`,
		);
		ui.statusLegend.innerHTML = tally
			.map(
				({ status, total }) =>
					`<li class="pj-mix-key-item pj-mix-key-item-${status}"><span class="pj-mix-key-n">${total}</span><span class="pj-mix-key-label">${STAGES[status].label}</span></li>`,
			)
			.join('');

		troubled = projects.filter((p) => TROUBLED.includes(p.status)).sort(byUrgency);
		const running = projects.filter(stillRunning).length;
		const healthy = projects.filter((p) => p.status === 'on-track').length;
		const pending = projects.filter((p) => p.status === 'not-started').length;
		const tail = pending ? ` and ${spellLower(pending)} still to start.` : '.';
		pick('[data-pj-health-desc]').textContent =
			`${spell(running)} active projects: ${spellLower(healthy)} on track, ${spellLower(troubled.length)} needing help${tail}`;

		ui.helpTiles.innerHTML = troubled.length
			? troubled.map(troubleTile).join('')
			: '<li class="pj-help-none">Nothing needs help right now. Every active project is on track or still to start.</li>';
	}

	function byUrgency(first, second) {
		if (first.status !== second.status) return first.status === 'blocked' ? -1 : 1;
		return upcomingMilestone(first)[1].localeCompare(upcomingMilestone(second)[1]);
	}

	function troubleTile(project) {
		const step = upcomingMilestone(project);
		const lateClass = overdue(step) ? ' is-late' : '';
		return `<li><button type="button" class="pj-help-tile pj-help-tile-${project.status} pj-tone-${project.tone}" data-pj-help-open="${project.id}"><span class="pj-help-top"><span class="pj-icon" aria-hidden="true"><i class="bi ${project.icon}"></i></span><span class="pj-help-who"><span class="pj-help-name">${htmlSafe(project.name)}</span><span class="pj-help-lead">Led by ${htmlSafe(leadOf(project).name)}</span></span></span>${badge(project.status)}<span class="pj-help-note">${htmlSafe(project.note)}</span><span class="pj-help-next">Next: ${htmlSafe(step[0])}<span class="pj-when${lateClass}">${dayName(step[1])} · ${fromNow(step[1])}</span></span></button></li>`;
	}

	/* The project table, its filter and search. */

	function paintTable() {
		const keep = FILTERS[view.filter] || (() => true);
		tableRows = sortForTable(projects.filter((p) => keep(p) && (!view.query || fitsQuery(p, view.query))));

		if (tableRows.length) {
			ui.tableBody.innerHTML = tableRows.map(tableRow).join('');
			window.Basalt.tips?.(ui.tableBody);
		} else {
			ui.tableBody.innerHTML = `<tr class="pj-empty-row"><td colspan="6">${emptyMessage()}</td></tr>`;
		}
		ui.resultCount.textContent = tableRows.length === 1 ? '1 project' : `${tableRows.length} projects`;
		ui.tableIntro.textContent = `${spell(projects.length)} projects across product, the portal and customer rollouts. Open one to see its milestones and team.`;
	}

	function emptyMessage() {
		if (!shared.emptyState) return '';
		return view.query
			? shared.emptyState({ query: view.query, noun: 'projects' })
			: shared.emptyState({
					icon: 'check2-circle',
					title: 'Nothing off track',
					text: 'Every active project is on track or not started yet.',
				});
	}

	/** Running projects by nearest milestone, then finished ones, latest first. */
	function sortForTable(subset) {
		return [...subset].sort((first, second) => {
			const firstRunning = stillRunning(first);
			if (firstRunning !== stillRunning(second)) return firstRunning ? -1 : 1;
			return firstRunning
				? upcomingMilestone(first)[1].localeCompare(upcomingMilestone(second)[1])
				: finalMilestone(second)[1].localeCompare(finalMilestone(first)[1]);
		});
	}

	function searchText(project) {
		const people = project.team.map((id) => staffById[id].name);
		const steps = project.milestones.map((step) => step[0]);
		return [project.name, project.area, project.customer || '', ...people, ...steps].join(' ');
	}

	function fitsQuery(project, query) {
		const text = searchText(project);
		return shared.matchesQuery
			? shared.matchesQuery(text, query)
			: text.toLowerCase().includes(query.toLowerCase());
	}

	function tableRow(project) {
		const next = nextUp(project);
		const hidden = project.team.length - 3;
		const share = percentDone(project);
		const href = detailsHref(project.id);
		const name = htmlSafe(project.name);
		const faces = project.team
			.slice(0, 3)
			.map((id) => face(id, 'basalt-avatar-sm'))
			.join('');
		return `<tr data-pj-row="${project.id}" class="pj-tone-${project.tone}"><td class="pj-cell-proj"><div class="pj-proj"><span class="pj-icon" aria-hidden="true"><i class="bi ${project.icon}"></i></span><div class="pj-proj-text"><a class="pj-proj-name" href="${href}">${unbroken(project.name)}</a><span class="pj-proj-lead">Led by ${htmlSafe(leadOf(project).name)}</span></div></div></td><td class="pj-col-team"><span class="basalt-avatar-group">${faces}</span>${hidden > 0 ? `<span class="pj-more-people">+${hidden}</span>` : ''}</td><td class="pj-cell-prog"><div class="pj-progress" title="${project.done} of ${project.total} tasks done"><span class="pj-bar" role="progressbar" aria-label="${name} progress" aria-valuenow="${share}" aria-valuemin="0" aria-valuemax="100"><span class="pj-bar-fill" style="--pj-pct: ${share}%"></span></span><span class="pj-progress-pct">${share}%</span></div></td><td class="pj-cell-next"><span class="pj-next">${unbroken(next.name)}</span><span class="pj-when${next.late ? ' is-late' : ''}">${htmlSafe(next.when)}</span></td><td class="pj-cell-status">${badge(project.status)}</td><td class="pj-col-go text-end"><span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-pj-open="${project.id}" aria-label="Quick view: ${name}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${href}" aria-label="Open full page: ${name}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span></td></tr>`;
	}

	/** Escaped text whose hyphenated words never break at the hyphen. */
	function unbroken(text) {
		return htmlSafe(text).replace(/\w+(?:-\w+)+/g, '<span class="pj-unbroken">$&</span>');
	}

	/** The panel icon opens the quick view; any other part of a row goes to
      the full page, in a new tab when a modifier key is held. */
	function onTableClick(event) {
		const quick = event.target.closest('[data-pj-open]');
		if (quick) {
			showProject(quick.getAttribute('data-pj-open'), tableRows);
			return;
		}
		const target = rowTarget(event);
		if (!target) return;
		if (event.metaKey || event.ctrlKey || event.shiftKey) window.open(target, '_blank');
		else location.href = target;
	}

	/** The full-page link for a click on a row's blank space, or ''. */
	function rowTarget(event) {
		const row = event.target.closest('tr[data-pj-row]');
		if (!row || event.target.closest('a, button')) return '';
		return pick('.pj-proj-name', row).href;
	}

	/* Due soon: milestones in the next fortnight, overdue first. */

	function paintUpcoming() {
		const entries = projects
			.filter(stillRunning)
			.map((project) => ({ project, step: upcomingMilestone(project) }))
			.filter(({ step }) => step && offsetDays(step[1]) <= 14)
			.sort((first, second) => first.step[1].localeCompare(second.step[1]));
		upcoming = entries.map(({ project }) => project);
		ui.dueSoon.innerHTML = entries.slice(0, DUE_VISIBLE).map(dueItem).join('');

		const extra = entries.slice(DUE_VISIBLE);
		ui.dueOverflow.hidden = !extra.length;
		if (!extra.length) return;
		const howMany = extra.length === 1 ? 'one more' : `${spellLower(extra.length)} more`;
		ui.dueOverflow.textContent = `And ${howMany} by ${dayName(extra[extra.length - 1].step[1])}.`;
	}

	function dueItem({ project, step }) {
		const date = toDate(step[1]);
		const gap = offsetDays(step[1]);
		let urgency = '';
		if (gap < 0) urgency = ' basalt-status-danger';
		else if (gap <= 2) urgency = ' basalt-status-warning';
		const phrase = fromNow(step[1]);
		return `<li class="pj-due-item"><button type="button" class="pj-due-btn pj-tone-${project.tone}" data-pj-due-open="${project.id}"><span class="pj-date" aria-hidden="true"><span class="pj-date-day">${date.getDate()}</span><span class="pj-date-month">${MONTH_ABBR[date.getMonth()]}</span></span><span class="pj-due-text"><span class="pj-due-name">${htmlSafe(step[0])}</span><span class="pj-due-project">${htmlSafe(project.name)}<span class="visually-hidden">, ${dayName(step[1])}</span></span></span><span class="basalt-status pj-due-when${urgency}">${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}</span></button></li>`;
	}

	/* The quick-view side panel. */

	function openFrom(event, attribute, list) {
		const trigger = event.target.closest(`[${attribute}]`);
		if (trigger) showProject(trigger.getAttribute(attribute), list);
	}

	function slot(key) {
		return pick(`[data-pj-d="${key}"]`, quickView);
	}

	function showProject(id, list) {
		const project = projects.find((p) => p.id === id);
		if (!project) return;
		stepList = list.includes(project) ? [...list] : [project];
		if (!stepper && window.Basalt.drawer) {
			/* The count is an object read on every step, so this single
         binding works for the tiles, the table and the due list. */
			const size = { valueOf: () => Math.max(1, stepList.length) };
			stepper = window.Basalt.drawer.recordNav(quickView, size, (index) => fillPanel(stepList[index]));
		}
		if (stepper) stepper.go(stepList.indexOf(project), 0);
		else fillPanel(project);
		pick('.basalt-drawer-nav', quickView).hidden = stepList.length < 2;
		window.bootstrap.Offcanvas.getOrCreateInstance(quickView).show();
	}

	function fillPanel(project) {
		const share = percentDone(project);
		pick('[data-pj-full]', quickView).href = detailsHref(project.id);
		pick('[data-pj-board]', quickView).href = WITH_BOARD.includes(project.id)
			? `project-board.html?project=${encodeURIComponent(project.id)}`
			: 'project-board.html';
		quickView.className = `${quickView.className.replace(/\bpj-tone-\d\b/g, '').trim()} pj-tone-${project.tone}`;

		slot('icon').innerHTML = `<i class="bi ${project.icon}"></i>`;
		slot('name').textContent = project.name;
		slot('sub').innerHTML = project.customer
			? `${htmlSafe(project.area)} for <a href="company-details.html?id=${encodeURIComponent(project.customerId)}">${htmlSafe(project.customer)}</a>`
			: htmlSafe(project.area);
		slot('status').innerHTML = badge(project.status);
		slot('summary').textContent = overview(project);

		const meter = slot('bar');
		pick('.pj-bar-fill', meter).style.setProperty('--pj-pct', `${share}%`);
		const meterAttributes = {
			role: 'progressbar',
			'aria-label': 'Tasks done',
			'aria-valuenow': String(share),
			'aria-valuemin': '0',
			'aria-valuemax': '100',
		};
		for (const [name, value] of Object.entries(meterAttributes)) meter.setAttribute(name, value);
		slot('pct').textContent = `${share}%`;

		const warning = slot('note');
		warning.hidden = !project.note;
		warning.classList.toggle('is-blocked', project.status === 'blocked');
		slot('note-text').textContent = project.note || '';

		slot('steps').innerHTML = project.milestones
			.map((step, index) => milestoneItem(step, index, upcomingMilestone(project)))
			.join('');
		slot('team').innerHTML = project.team
			.map((personId, index) => {
				const person = staffById[personId];
				const prefix = index === 0 ? 'Lead · ' : '';
				return `<li>${face(personId, 'basalt-avatar-sm')}<span><a href="employee-user-details.html?id=${encodeURIComponent(personId)}">${htmlSafe(person.name)}</a><span class="pj-d-team-role">${prefix}${htmlSafe(person.role)}</span></span></li>`;
			})
			.join('');
	}

	function milestoneItem(step, index, current) {
		const finished = Boolean(step[2]);
		const isCurrent = step === current;
		const hint = finished ? `Done ${dayName(step[1])}` : `${dayName(step[1])} · ${fromNow(step[1])}`;
		const classes = `basalt-steps-item${finished ? ' is-done' : ''}${isCurrent ? ' is-current' : ''}`;
		return `<li class="${classes}"${isCurrent ? ' aria-current="step"' : ''}><span class="basalt-steps-dot"><i class="bi bi-check-lg" aria-hidden="true"></i><span class="basalt-steps-num">${index + 1}</span></span><span class="basalt-steps-text"><span class="basalt-steps-label">${htmlSafe(step[0])}</span><span class="basalt-steps-hint${overdue(step) ? ' is-late' : ''}">${htmlSafe(hint)}</span></span></li>`;
	}

	/* Throughput chart: finished tasks as bars, opened ones as a line. */

	function themeValue(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** Reads #rrggbb or rgb()/rgba() into channels; anything else is gray. */
	function channels(color) {
		const text = String(color || '').trim();
		const hex = /^#([0-9a-f]{6})$/i.exec(text);
		if (hex) {
			const packed = parseInt(hex[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(text);
		return functional
			? functional[1]
					.split(',')
					.slice(0, 3)
					.map((part) => parseFloat(part))
			: [128, 128, 128];
	}

	function tint(color, alpha) {
		const [red, green, blue] = channels(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	function blend(front, back, weight) {
		const top = channels(front);
		const under = channels(back);
		const [red, green, blue] = [0, 1, 2].map((i) => Math.round(top[i] * weight + under[i] * (1 - weight)));
		return `rgb(${red}, ${green}, ${blue})`;
	}

	function weekOf({ start }) {
		const monday = toDate(start);
		return `${MONTH_ABBR[monday.getMonth()]} ${monday.getDate()}`;
	}

	function paintChartCopy() {
		const closed = THROUGHPUT.reduce((sum, week) => sum + week.finished, 0);
		const gainingWeeks = THROUGHPUT.filter((week) => week.finished > week.opened).length;
		const outstanding = projects.filter(stillRunning).reduce((sum, p) => sum + (p.total - p.done), 0);
		const finalDay = shiftDays(toDate(THROUGHPUT[THROUGHPUT.length - 1].start), 6);
		pick('[data-pj-key="finished"]').textContent = closed;
		pick('[data-pj-key="open"]').textContent = outstanding;
		pick('[data-pj-chart-desc]').textContent =
			`${weekOf(THROUGHPUT[0])} to ${MONTH_ABBR[finalDay.getMonth()]} ${finalDay.getDate()}. More finished than opened in ${gainingWeeks} of ${THROUGHPUT.length} weeks.`;
	}

	/** Waits until the chart is near the viewport so its bars grow in view;
      skipping past it (End key, a quick fling) draws it without motion. */
	function drawWhenNear() {
		const box = ui.chartCanvas.getBoundingClientRect();
		if (box.top > window.innerHeight + 80) return;
		window.removeEventListener('scroll', drawWhenNear);
		drawChart(box.bottom > 0);
	}

	function drawChart(animate) {
		if (typeof Chart === 'undefined' || !ui.chartCanvas) return;
		throughputChart?.destroy();

		const ink = themeValue('--basalt-copy', '#12233a');
		const surface = themeValue('--basalt-plane', '#ffffff');
		const barColor = themeValue('--basalt-series-1', '#2b6fd4');
		const lineColor = themeValue('--basalt-series-3', '#1fc6a8');
		const axisText = {
			color: blend(themeValue('--basalt-copy-muted', '#5f7186'), ink, 0.82),
			font: { family: TYPEFACE, size: 11.5 },
			padding: 6,
		};

		const openedLine = {
			type: 'line',
			label: 'Opened',
			data: THROUGHPUT.map((week) => week.opened),
			order: 0,
			borderColor: lineColor,
			backgroundColor: surface,
			borderWidth: 2.5,
			tension: 0.35,
			pointRadius: 4,
			pointHoverRadius: 5,
			pointBorderWidth: 2.5,
			pointBorderColor: lineColor,
		};
		const finishedBars = {
			label: 'Finished',
			data: THROUGHPUT.map((week) => week.finished),
			order: 1,
			backgroundColor: barColor,
			hoverBackgroundColor: barColor,
			borderRadius: 6,
			borderSkipped: false,
			maxBarThickness: 30,
			categoryPercentage: 0.7,
			barPercentage: 0.8,
		};
		const hoverCard = {
			backgroundColor: surface,
			titleColor: ink,
			bodyColor: ink,
			borderColor: themeValue('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			borderWidth: 1,
			padding: 10,
			cornerRadius: 8,
			boxPadding: 4,
			usePointStyle: true,
			titleFont: { family: TYPEFACE, size: 12, weight: '600' },
			bodyFont: { family: TYPEFACE, size: 12 },
			itemSort: (first, second) => second.datasetIndex - first.datasetIndex,
			callbacks: {
				title: (items) => `Week of ${items[0].label}`,
				label: (item) => ` ${item.dataset.label}: ${item.parsed.y} tasks`,
			},
		};

		throughputChart = new Chart(ui.chartCanvas, {
			type: 'bar',
			data: { labels: THROUGHPUT.map(weekOf), datasets: [openedLine, finishedBars] },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: animate && !calmMotion.matches ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				plugins: { legend: { display: false }, tooltip: hoverCard },
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: { maxRotation: 0, autoSkipPadding: 10, ...axisText },
					},
					y: {
						beginAtZero: true,
						suggestedMax: 35,
						grid: { color: tint(ink, 0.07) },
						border: { display: false },
						ticks: { stepSize: 10, ...axisText },
					},
				},
			},
		});
	}

	/* The New project dialog. */

	function setUpCreator() {
		ui.leadField.innerHTML = Object.keys(staffById)
			.sort((first, second) => staffById[first].name.localeCompare(staffById[second].name))
			.map(
				(id) =>
					`<option value="${id}"${id === 'ja' ? ' selected' : ''}>${htmlSafe(staffById[id].name)}</option>`,
			)
			.join('');

		ui.titleField.addEventListener('input', () => {
			if (ui.titleField.value.trim()) flagTitle(false);
		});
		creator.addEventListener('shown.bs.modal', () => ui.titleField.focus());
		creator.addEventListener('hidden.bs.modal', () => {
			ui.creatorForm.reset();
			ui.leadField.value = 'ja';
			flagTitle(false);
		});
		ui.creatorForm.addEventListener('submit', createProject);
	}

	function flagTitle(invalid) {
		ui.titleError.hidden = !invalid;
		ui.titleField.classList.toggle('is-invalid', invalid);
		ui.titleField.setAttribute('aria-invalid', String(invalid));
	}

	/** Milestones fall on working days: Saturdays move back, Sundays forward. */
	function onWorkday(date) {
		const shiftBy = { 6: -1, 0: 1 }[date.getDay()];
		return shiftBy ? shiftDays(date, shiftBy) : date;
	}

	function createProject(event) {
		event.preventDefault();
		const name = ui.titleField.value.trim();
		if (!name) {
			flagTitle(true);
			ui.titleField.focus();
			return;
		}

		const template = TEMPLATES[pick('input[name="pj-plan"]:checked', ui.creatorForm).value];
		const kickoff = shiftDays(NOW, (8 - NOW.getDay()) % 7 || 7);
		let finish = ui.finishField.value ? toDate(ui.finishField.value) : shiftDays(kickoff, 70);
		if (finish <= kickoff) finish = shiftDays(kickoff, 28);
		const spanDays = Math.round((finish - kickoff) / MS_PER_DAY);
		const stepCount = template.milestones.length;

		const project = {
			id: `new-${Date.now()}`,
			name,
			area: template.area,
			icon: template.icon,
			tone: (projects.length % 8) + 1,
			team: [ui.leadField.value],
			status: 'not-started',
			done: 0,
			total: template.tasks,
			start: toStamp(kickoff),
			milestones: template.milestones.map((title, index) => [
				title,
				toStamp(onWorkday(shiftDays(kickoff, Math.round((spanDays * (index + 1)) / stepCount)))),
			]),
		};
		projects.push(project);
		window.bootstrap.Modal.getOrCreateInstance(creator).hide();

		if (view.filter === 'off' || view.filter === 'done') {
			const activeOption = pick('#pj-show-active');
			activeOption.checked = true;
			activeOption.dispatchEvent(new Event('change', { bubbles: true }));
		}
		if (view.query && !fitsQuery(project, view.query)) {
			ui.searchBox.value = '';
			view.query = '';
		}
		paintTable();
		paintStanding();
		paintUpcoming();
		paintChartCopy();

		const added = pick(`tr[data-pj-row="${project.id}"]`, ui.tableBody);
		if (added) {
			if (!calmMotion.matches) added.classList.add('is-new');
			added.scrollIntoView({ block: 'nearest', behavior: calmMotion.matches ? 'auto' : 'smooth' });
		}
		notify({
			tone: 'success',
			title: 'Project created',
			text: `${name} starts ${dayName(project.start)}, led by ${staffById[project.team[0]].name}.`,
		});
	}
	start();

	/* DOM lookups, shared by every helper above. */
	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
