/**
 * The single-project screen (project-details.html, marked [data-pd-root]).
 *
 * It reads one record from the shared project data (assets/basalt/js/data/multipurpose/projects.js),
 * picked by ?id= in the address and falling back to Travel Planner 2.0, and
 * draws the progress ring, pace bars, milestone steps, open tasks, team, files
 * and activity from it. Every change (a task ticked off, a file added, a new
 * status) goes through the same in-memory lists and redraws what depends on
 * them. The clock is fixed at October 9, 2026 so the demo never drifts; swap in
 * new Date() and your own record when wiring this to a backend.
 */
(() => {
	'use strict';

	const host = pick('[data-pd-root]');
	if (!host) return;

	const PINNED_DATE = new Date(2026, 9, 9);
	const PINNED_ISO = '2026-10-09';
	const MS_PER_DAY = 86400000;
	const SELF_ID = 'ja';
	const VISIBLE_TASKS = 6;
	const VISIBLE_EVENTS = 5;

	/* Project Board only has boards for these three projects. */
	const BOARD_IDS = ['store', 'web', 'onboard'];

	const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const NUMBER_WORDS = [
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

	const STATE_LOOK = {
		'on-track': { label: 'On track', tone: 'success' },
		'at-risk': { label: 'At risk', tone: 'warning' },
		blocked: { label: 'Blocked', tone: 'danger' },
		'not-started': { label: 'Not started', tone: '' },
		done: { label: 'Done', tone: 'primary' },
	};

	/* File extensions map to an icon, a chart tone and a plain name. */
	const SHEET_KIND = { icon: 'bi-file-earmark-spreadsheet', tone: 3, label: 'Spreadsheet' };
	const IMAGE_KIND = { icon: 'bi-file-earmark-image', tone: 6, label: 'Image' };
	const FILE_KINDS = {
		pdf: { icon: 'bi-file-earmark-pdf', tone: 7, label: 'PDF' },
		xlsx: SHEET_KIND,
		csv: SHEET_KIND,
		docx: { icon: 'bi-file-earmark-text', tone: 1, label: 'Document' },
		png: IMAGE_KIND,
		jpg: IMAGE_KIND,
	};
	const PLAIN_KIND = { icon: 'bi-file-earmark', tone: 5, label: 'File' };

	/* An activity icon always comes in the same chart tone. */
	const EVENT_TONES = {
		'bi-check2-circle': 3,
		'bi-image': 6,
		'bi-upload': 6,
		'bi-envelope': 2,
		'bi-bug': 7,
		'bi-calendar-event': 4,
		'bi-flag': 1,
		'bi-kanban': 1,
		'bi-plus-circle': 1,
		'bi-person-plus': 5,
		'bi-pencil': 8,
		'bi-activity': 8,
	};

	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

	/* Everyone on staff who has started, keyed by id, from data/multipurpose/people.js. */
	const roster = window.Basalt.data.people;
	const staffById = {};
	for (const person of roster.staff.filter(roster.hasStarted)) {
		staffById[person.id] = { name: roster.nameOf(person), role: person.title, tone: roster.toneOf(person) };
	}

	const projectStore = window.Basalt.data.projects;
	const record =
		projectStore.find(new URLSearchParams(location.search).get('id') || '') || projectStore.find('route');

	const project = {
		id: record.id,
		name: record.name,
		area: record.area,
		customer: record.customer,
		status: record.status,
		lead: record.team[0],
		team: record.team.slice(),
		start: record.start,
		goal: record.goal,
	};

	/* Each phase counts its finished tasks in done and flips reached once met;
     the date on the final phase is the release date. */
	const phases = record.milestones.map((phase) => ({ ...phase }));
	const openTasks = record.tasks.map(([name, ms, who, due], position) => ({
		id: `t${position + 1}`,
		name,
		ms,
		who,
		due,
	}));
	const attachments = record.files.map(([name, size, who, when]) => ({ name, size, who, when }));
	/* The what of an event is trusted markup from the data or escaped input. */
	const activity = record.feed.map(([who, icon, what, at]) => ({ who, icon, what, when: projectStore.when(at) }));

	const view = {
		phaseFilter: 'all',
		tasksExpanded: false,
		eventsExpanded: false,
	};

	const parts = {
		taskList: slot('tasks'),
		filter: slot('filter'),
		moreTasks: pick('[data-pd-tasks-more]', host),
		moreEvents: pick('[data-pd-feed-more]', host),
		fileList: slot('files'),
		upload: pick('[data-pd-upload]', host),
		editButton: pick('[data-pd-edit]', host),
		factsForm: pick('[data-pd-form]', host),
		taskDialog: document.getElementById('pd-task'),
		personDialog: document.getElementById('pd-person'),
	};
	parts.standCard = slot('ring').closest('.pd-card');

	start();

	/** Fills the static choices, binds every control, then draws the page. */
	function start() {
		buildPhaseFilter();
		wireTaskList();
		wireFiles();
		parts.moreEvents.addEventListener('click', () => {
			window.Basalt.slide(slot('feed'), () => {
				view.eventsExpanded = !view.eventsExpanded;
				drawActivity();
			});
		});
		wireFactsEditor();
		wireHeaderMenu();
		wireTaskDialog();
		wirePersonDialog();

		redrawAll();
		drawFiles();
		drawTrail(slot('steps'));
	}

	/* Lookups and small text helpers. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function slot(key) {
		return pick(`[data-pd="${key}"]`, host);
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (ch) => entities[ch]);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function upperFirst(text) {
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	/** A count as a word ("Three"), or as digits once past twelve. */
	function spelled(count) {
		return NUMBER_WORDS[count] || String(count);
	}

	function spelledLower(count) {
		return spelled(count).toLowerCase();
	}

	function plural(count) {
		return count === 1 ? '' : 's';
	}

	/* Calendar arithmetic, always against the pinned date. */

	function toDate(iso) {
		const [year, month, day] = iso.split('-').map(Number);
		return new Date(year, month - 1, day);
	}

	function weekdayDate(iso) {
		const date = toDate(iso);
		return `${WEEKDAY_ABBR[date.getDay()]}, ${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
	}

	function monthDay(iso) {
		const date = toDate(iso);
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
	}

	function daysAway(iso) {
		return Math.round((toDate(iso) - PINNED_DATE) / MS_PER_DAY);
	}

	/** "today", "tomorrow", "in 4 days", or "2 days late". */
	function fromNow(iso) {
		const gap = daysAway(iso);
		if (gap === 0) return 'today';
		if (gap === 1) return 'tomorrow';
		if (gap > 1) return `in ${gap} days`;
		return gap === -1 ? '1 day late' : `${-gap} days late`;
	}

	/* Figures worked out from the live lists. */

	function releaseDate() {
		return phases[phases.length - 1].date;
	}

	function upcomingPhase() {
		return phases.find((phase) => !phase.reached) || null;
	}

	function finishedCount() {
		return phases.reduce((sum, phase) => sum + phase.done, 0);
	}

	function taskTotal() {
		return finishedCount() + openTasks.length;
	}

	function percentDone() {
		return Math.round((finishedCount() / Math.max(1, taskTotal())) * 100);
	}

	function overdueCount() {
		return openTasks.filter((task) => daysAway(task.due) < 0).length;
	}

	function scheduleDays() {
		return (toDate(releaseDate()) - toDate(project.start)) / MS_PER_DAY;
	}

	function percentElapsed() {
		const elapsed = (PINNED_DATE - toDate(project.start)) / MS_PER_DAY;
		const share = Math.round((elapsed / Math.max(1, scheduleDays())) * 100);
		return Math.min(100, Math.max(0, share));
	}

	function phaseOf(task) {
		return phases.find((phase) => phase.id === task.ms);
	}

	function tasksHeldBy(personId) {
		return openTasks.filter((task) => task.who === personId).length;
	}

	function namesInOrder(ids) {
		return ids.sort((left, right) => staffById[left].name.localeCompare(staffById[right].name));
	}

	/* Markup shared by several panels. */

	function stateTag(status) {
		const { tone, label } = STATE_LOOK[status];
		const toneClass = tone ? ` basalt-status-${tone}` : '';
		return `<span class="basalt-status basalt-status-dot${toneClass}">${label}</span>`;
	}

	function initialsBadge(personId, sizeClass) {
		const person = staffById[personId];
		const letters = person.name
			.split(/\s+/)
			.map((word) => word[0])
			.join('')
			.slice(0, 2)
			.toUpperCase();
		return `<span class="basalt-avatar ${sizeClass} basalt-avatar-tone-${person.tone}" aria-hidden="true">${letters}</span>`;
	}

	function profileLink(personId) {
		return `<a class="pd-person" href="employee-user-details.html?id=${encodeURIComponent(personId)}">${htmlSafe(staffById[personId].name)}</a>`;
	}

	function logEvent(icon, what) {
		const entry = { who: SELF_ID, icon, what, when: 'Just now' };
		activity.unshift(entry);
		return entry;
	}

	/* Drawing. */

	function redrawAll() {
		drawHeader();
		drawStanding();
		drawPhases();
		drawTasks();
		drawTeam();
		drawActivity();
	}

	function drawHeader() {
		const icon = slot('icon');
		icon.className = `pd-icon pd-icon-lg pd-tone-${record.tone}`;
		icon.innerHTML = `<i class="bi ${record.icon}"></i>`;
		slot('name').textContent = project.name;

		/* Once every milestone is met the project stops taking tasks. */
		pick('[data-bs-target="#pd-task"]', host).hidden = phases.every((phase) => phase.reached);
		pick('[data-pd-task-sub]').textContent = `Joins the open tasks of ${project.name}.`;
		document.title = `${project.name} · Basalt`;

		const scope = project.customer ? `${project.area} for ${project.customer.name}` : project.area;
		slot('sub').textContent =
			`${scope} · Led by ${staffById[project.lead].name} · ${monthDay(project.start)} to ${monthDay(releaseDate())}, 2026`;
		slot('tags').innerHTML = stateTag(project.status);

		/* Projects without their own board point at the board page in general. */
		const hasBoard = BOARD_IDS.includes(project.id);
		for (const link of pickAll('[data-pd-board]', host)) {
			link.href = hasBoard
				? `project-board.html?project=${encodeURIComponent(project.id)}`
				: 'project-board.html';
			pick('[data-pd-board-text]', link).textContent = hasBoard ? 'Open on the board' : 'Open the project board';
		}

		for (const option of pickAll('[data-pd-status]', host)) {
			const current = option.dataset.pdStatus === project.status;
			option.classList.toggle('is-selected', current);
			option.setAttribute('aria-current', String(current));
		}
	}

	/** The ring, the work-versus-time bars, the goal, the next milestone and the facts list. */
	function drawStanding() {
		const percent = percentDone();
		const finished = finishedCount();
		const total = taskTotal();
		const ring = slot('ring');
		ring.style.setProperty('--value', percent);
		ring.setAttribute('aria-label', `${percent}% of tasks done: ${finished} of ${total}`);
		slot('pct').textContent = `${percent}%`;
		slot('pct-caption').textContent = `${finished} of ${total} tasks`;

		const elapsed = percentElapsed();
		slot('work').textContent = `${percent}%`;
		slot('time').textContent = `${elapsed}%`;
		slot('work-bar').style.setProperty('--pd-pct', `${percent}%`);
		slot('time-bar').style.setProperty('--pd-pct', `${elapsed}%`);

		const daysAhead = Math.round(((percent - elapsed) / 100) * scheduleDays());
		const pace = daysAhead > 3 ? 'ahead' : daysAhead < -3 ? 'behind' : 'even';
		const paceNote = slot('pace-note');
		paceNote.className = `pd-pace-note${{ ahead: ' is-ahead', behind: ' is-behind', even: '' }[pace]}`;
		paceNote.innerHTML = {
			ahead: `<i class="bi bi-arrow-up-right" aria-hidden="true"></i>About ${daysAhead} days ahead of plan.`,
			behind: `<i class="bi bi-arrow-down-right" aria-hidden="true"></i>About ${-daysAhead} days behind plan.`,
			even: '<i class="bi bi-arrow-right" aria-hidden="true"></i>Right on plan.',
		}[pace];

		slot('goal').textContent = project.goal;
		slot('next').innerHTML = nextPhaseMarkup(upcomingPhase());

		const overdue = overdueCount();
		const verdict = { ahead: 'Ahead of plan', behind: 'Behind plan', even: 'On plan' }[pace];
		const lateClause = overdue ? `, and ${spelledLower(overdue)} task${plural(overdue)} late.` : '.';
		slot('stand-desc').textContent =
			`${verdict}: ${percent}% of the work done with ${elapsed}% of the time gone${lateClause}`;

		const releaseNote = upcomingPhase() ? upperFirst(fromNow(releaseDate())) : 'Released';
		slot('facts').innerHTML = [
			`<div><dt>Lead</dt><dd class="pd-facts-who">${initialsBadge(project.lead, 'basalt-avatar-xs')}${profileLink(project.lead)}</dd></div>`,
			`<div><dt>Area</dt><dd>${htmlSafe(project.area)}</dd></div>`,
			`<div><dt>Started</dt><dd>${weekdayDate(project.start)}</dd></div>`,
			`<div><dt>Release</dt><dd>${weekdayDate(releaseDate())}<span class="pd-facts-muted">${releaseNote}</span></dd></div>`,
		].join('');
	}

	function nextPhaseMarkup(phase) {
		if (!phase) {
			return (
				'<span class="pd-next-date pd-next-date-success" aria-hidden="true"><i class="bi bi-trophy-fill"></i></span>' +
				'<span class="pd-next-text"><span class="pd-next-label">Every milestone reached</span><span class="pd-next-name">Ready to close</span></span>'
			);
		}
		const date = toDate(phase.date);
		const gap = daysAway(phase.date);
		let tone = 'primary';
		if (gap < 0) tone = 'danger';
		else if (gap <= 7) tone = 'warning';
		const chipTone = tone === 'primary' ? '' : ` basalt-status-${tone}`;
		return (
			`<span class="pd-next-date pd-next-date-${tone}" aria-hidden="true"><span class="pd-next-day">${date.getDate()}</span><span class="pd-next-month">${MONTH_ABBR[date.getMonth()]}</span></span>` +
			`<span class="pd-next-text"><span class="pd-next-label">Next milestone</span><span class="pd-next-name">${htmlSafe(phase.name)}</span><span class="visually-hidden">${weekdayDate(phase.date)}</span></span>` +
			`<span class="basalt-status pd-next-when${chipTone}">${upperFirst(fromNow(phase.date))}</span>`
		);
	}

	function drawPhases() {
		const upcoming = upcomingPhase();
		const reachedCount = phases.filter((phase) => phase.reached).length;
		const nextClause = upcoming ? ` ${upcoming.name} is next, ${fromNow(upcoming.date)}.` : '';
		slot('ms-desc').textContent =
			`${upperFirst(spelledLower(reachedCount))} of ${spelledLower(phases.length)} reached.${nextClause}`;
		slot('steps').innerHTML = phases
			.map((phase, position) => phaseStep(phase, position, phase === upcoming))
			.join('');
	}

	/**
	 * Fills the milestones in from the first the first time they are on
	 * screen: markers color in one after another, task bars fill and the
	 * reached stretches grow between them. Later redraws show them drawn.
	 */
	function drawTrail(trail) {
		if (!window.IntersectionObserver || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		pickAll('.pd-step', trail).forEach((step, at) => step.style.setProperty('--pd-trail-at', at));
		trail.classList.add('is-waiting');
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				trail.classList.replace('is-waiting', 'is-drawing');
				const running = trail
					.getAnimations({ subtree: true })
					.filter((animation) => /^pd-(trail|marker|bar)-/.test(animation.animationName));
				Promise.allSettled(running.map((animation) => animation.finished)).then(() =>
					trail.classList.remove('is-drawing'),
				);
			},
			{ threshold: 0.5 },
		);
		watch.observe(trail);
	}

	function phaseStep(phase, position, isUpcoming) {
		const pending = openTasks.filter((task) => task.ms === phase.id).length;
		const total = phase.done + pending;
		const share = total ? Math.round((phase.done / total) * 100) : 0;
		let state = 'is-todo';
		if (phase.reached) state = 'is-done';
		else if (isUpcoming) state = 'is-next';
		const marker = phase.reached ? '<i class="bi bi-check-lg"></i>' : position + 1;
		const timing = phase.reached
			? `Reached ${weekdayDate(phase.date)}`
			: `${weekdayDate(phase.date)} · ${fromNow(phase.date)}`;
		const lateClass = !phase.reached && daysAway(phase.date) < 0 ? ' is-late' : '';
		return (
			`<li class="pd-step ${state}"${isUpcoming ? ' aria-current="step"' : ''}>` +
			`<span class="pd-step-marker" aria-hidden="true">${marker}</span>` +
			`<span class="pd-step-text"><span class="pd-step-label">${htmlSafe(phase.name)}</span>` +
			`<span class="pd-step-when${lateClass}">${timing}</span>` +
			`<span class="pd-step-tasks"><span class="pd-step-bar" aria-hidden="true"><span style="--pd-pct: ${share}%"></span></span>${phase.done} of ${total} tasks</span></span></li>`
		);
	}

	function drawTasks() {
		const matching = openTasks
			.filter((task) => view.phaseFilter === 'all' || task.ms === view.phaseFilter)
			.sort((left, right) => left.due.localeCompare(right.due));
		const shown = view.tasksExpanded ? matching : matching.slice(0, VISIBLE_TASKS);

		parts.taskList.innerHTML = shown.length
			? shown.map(taskItem).join('')
			: `<li class="pd-tasks-none">${emptyTasksMarkup()}</li>`;

		const toggle = parts.moreTasks;
		toggle.hidden = matching.length <= VISIBLE_TASKS;
		toggle.setAttribute('aria-expanded', String(view.tasksExpanded));
		toggle.textContent = view.tasksExpanded ? 'Show fewer' : `Show all ${matching.length}`;

		const remaining = openTasks.length;
		const overdue = overdueCount();
		slot('tasks-desc').textContent = remaining
			? `${upperFirst(spelledLower(remaining))} task${plural(remaining)} left${overdue ? `, ${spelledLower(overdue)} late` : ''}. Check one off when it is done.`
			: 'Every task is done.';
	}

	function emptyTasksMarkup() {
		const fallback = 'Every task for this milestone is done.';
		if (!window.Basalt?.emptyState) return fallback;
		return window.Basalt.emptyState({
			icon: 'check2-circle',
			title: 'Nothing left here',
			text: view.phaseFilter === 'all' ? 'Every task on this project is done.' : fallback,
		});
	}

	function taskItem(task) {
		const owner = htmlSafe(staffById[task.who].name);
		const gap = daysAway(task.due);
		let dueTone = '';
		if (gap < 0) dueTone = ' basalt-status-danger';
		else if (gap <= 3) dueTone = ' basalt-status-warning';
		const dueText = gap < 0 ? upperFirst(fromNow(task.due)) : weekdayDate(task.due);
		return (
			`<li class="pd-task" data-pd-task-row="${task.id}">` +
			`<label class="basalt-tick basalt-tick-sm basalt-tick-success"><input type="checkbox" data-pd-done="${task.id}" aria-label="Mark done: ${htmlSafe(task.name)}"><span class="basalt-tick-box"><i class="bi bi-check-lg" aria-hidden="true"></i></span></label>` +
			`<span class="pd-task-text"><span class="pd-task-name">${htmlSafe(task.name)}</span><span class="pd-task-ms">${htmlSafe(phaseOf(task).name)}</span></span>` +
			`<span title="${owner}">${initialsBadge(task.who, 'basalt-avatar-sm')}<span class="visually-hidden">Assigned to ${owner}</span></span>` +
			`<span class="basalt-status pd-task-due${dueTone}">${dueText}</span></li>`
		);
	}

	function drawTeam() {
		const busiest = Math.max(1, ...project.team.map(tasksHeldBy));
		slot('team-desc').textContent =
			`${upperFirst(spelledLower(project.team.length))} people, with the tasks each still has open.`;
		slot('team').innerHTML = project.team
			.map((personId) => {
				const person = staffById[personId];
				const held = tasksHeldBy(personId);
				const rolePrefix = personId === project.lead ? 'Lead · ' : '';
				return (
					`<li class="pd-member pd-tone-${person.tone}">${initialsBadge(personId, 'basalt-avatar-sm')}` +
					`<span class="pd-member-text">${profileLink(personId)}<span class="pd-member-role">${rolePrefix}${htmlSafe(person.role)}</span></span>` +
					`<span class="pd-member-load"><span class="pd-member-bar" aria-hidden="true"><span style="--pd-pct: ${Math.round((held / busiest) * 100)}%"></span></span>` +
					`<span class="pd-member-count">${held ? `${held} open` : 'None open'}</span></span></li>`
				);
			})
			.join('');
	}

	function drawFiles() {
		const count = attachments.length;
		slot('files-desc').textContent =
			`${upperFirst(spelledLower(count))} file${plural(count)} shared on the project, newest first.`;
		if (!count) {
			parts.fileList.innerHTML =
				'<li class="pd-tasks-none">No files yet. Upload the spec or designs so the team has them in one place.</li>';
			return;
		}
		/* Latest date first, and on a shared date the later upload first. */
		const ordered = attachments
			.map((file, index) => ({ file, index }))
			.sort((left, right) => right.file.when.localeCompare(left.file.when) || right.index - left.index);
		parts.fileList.innerHTML = ordered.map(fileItem).join('');
	}

	function fileItem({ file, index }) {
		const extension = (file.name.split('.').pop() || '').toLowerCase();
		const kind = FILE_KINDS[extension] || PLAIN_KIND;
		const day = file.when === PINNED_ISO ? 'today' : monthDay(file.when);
		return (
			`<li class="pd-file"><span class="pd-icon pd-tone-${kind.tone}" aria-hidden="true"><i class="bi ${kind.icon}"></i></span>` +
			`<span class="pd-file-text"><span class="pd-file-name">${htmlSafe(file.name)}</span><span class="pd-file-meta">${kind.label} · ${readableSize(file.size)} · ${htmlSafe(staffById[file.who].name)}, ${day}</span></span>` +
			`<button type="button" class="btn btn-icon pd-file-remove" data-pd-remove="${index}" aria-label="Remove ${htmlSafe(file.name)}" title="Remove"><i class="bi bi-trash3" aria-hidden="true"></i></button></li>`
		);
	}

	function readableSize(bytes) {
		return bytes >= 1000000 ? `${(bytes / 1000000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
	}

	function drawActivity() {
		const shown = view.eventsExpanded ? activity : activity.slice(0, VISIBLE_EVENTS);
		slot('feed').innerHTML = shown
			.map(
				(event) =>
					`<li class="pd-feed-item"><span class="pd-feed-icon pd-tone-${EVENT_TONES[event.icon] || 1}" aria-hidden="true"><i class="bi ${event.icon}"></i></span>` +
					`<span class="pd-feed-text"><span class="pd-feed-head">${profileLink(event.who)} <span class="pd-feed-when">${htmlSafe(event.when)}</span></span><span class="pd-feed-what">${event.what}</span></span></li>`,
			)
			.join('');

		const toggle = parts.moreEvents;
		toggle.hidden = activity.length <= VISIBLE_EVENTS;
		toggle.setAttribute('aria-expanded', String(view.eventsExpanded));
		toggle.textContent = view.eventsExpanded ? 'Show fewer' : `See all ${activity.length}`;
	}

	/* Open tasks: the milestone filter, ticking off, and Show all. */

	function buildPhaseFilter() {
		/* Only milestones that still have open tasks earn a choice. */
		const choices = phases.filter((phase) => openTasks.some((task) => task.ms === phase.id));
		const options = [{ id: 'all', short: 'All' }, ...choices];
		parts.filter.innerHTML = options
			.map(
				(option, position) =>
					`<input type="radio" class="btn-check" name="pd-show" id="pd-show-${option.id}" value="${option.id}"${position ? '' : ' checked'}>` +
					`<label class="basalt-segmented-option" for="pd-show-${option.id}">${htmlSafe(option.short || option.name)}</label>`,
			)
			.join('');
		parts.filter.hidden = choices.length < 2;
	}

	function wireTaskList() {
		parts.filter.addEventListener('change', (event) => {
			if (event.target.name !== 'pd-show') return;
			view.phaseFilter = event.target.value;
			view.tasksExpanded = false;
			drawTasks();
		});

		parts.moreTasks.addEventListener('click', () => {
			window.Basalt.slide(parts.taskList, () => {
				view.tasksExpanded = !view.tasksExpanded;
				drawTasks();
			});
		});

		parts.taskList.addEventListener('change', (event) => {
			const checkbox = event.target.closest('[data-pd-done]');
			if (!checkbox?.checked) return;
			const row = checkbox.closest('.pd-task');
			const rowIndex = pickAll('.pd-task', parts.taskList).indexOf(row);
			const keepFocus = document.activeElement === checkbox;
			row.classList.add('is-done');
			setTimeout(
				() => {
					finishTask(checkbox.getAttribute('data-pd-done'));
					if (keepFocus) focusRowAt(rowIndex);
				},
				calmMotion.matches ? 0 : 420,
			);
		});
	}

	/** Puts keyboard focus on whichever row slid into the finished one's place. */
	function focusRowAt(rowIndex) {
		const checkboxes = pickAll('[data-pd-done]', parts.taskList);
		checkboxes[Math.min(rowIndex, checkboxes.length - 1)]?.focus({ preventScroll: true });
	}

	function finishTask(taskId) {
		const position = openTasks.findIndex((task) => task.id === taskId);
		if (position < 0) return;
		const task = openTasks[position];
		const phase = phaseOf(task);
		openTasks.splice(position, 1);
		phase.done += 1;
		const entry = logEvent('bi-check2-circle', `finished <strong>${htmlSafe(task.name)}</strong>`);
		redrawAll();

		function undo() {
			openTasks.splice(Math.min(position, openTasks.length), 0, task);
			phase.done -= 1;
			const at = activity.indexOf(entry);
			if (at >= 0) activity.splice(at, 1);
			redrawAll();
		}

		notify({
			tone: 'success',
			title: 'Task done',
			text: `${task.name}. ${percentDone()}% of the project is done now.`,
			actions: [{ label: 'Undo', onClick: undo }],
		});
	}

	/* Files: remove with undo, and uploads from the hidden input. */

	function wireFiles() {
		parts.fileList.addEventListener('click', (event) => {
			const button = event.target.closest('[data-pd-remove]');
			if (!button) return;
			const index = Number(button.getAttribute('data-pd-remove'));
			const [removed] = attachments.splice(index, 1);
			drawFiles();
			notify({
				title: 'File removed',
				text: removed.name,
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							attachments.splice(index, 0, removed);
							drawFiles();
						},
					},
				],
			});
		});

		parts.upload.addEventListener('change', (event) => {
			const chosen = [...(event.target.files || [])];
			if (!chosen.length) return;
			for (const upload of chosen) {
				attachments.push({ name: upload.name, size: upload.size, who: SELF_ID, when: PINNED_ISO });
				logEvent('bi-upload', `uploaded <strong>${htmlSafe(upload.name)}</strong>`);
			}
			event.target.value = '';
			drawFiles();
			drawActivity();
			const single = chosen.length === 1;
			notify({
				tone: 'success',
				title: single ? 'File uploaded' : `${chosen.length} files uploaded`,
				text: `The team can open ${single ? 'it' : 'them'} from Files.`,
			});
		});
	}

	/* The Edit button swaps the goal and the facts for one form with one Save. */

	function field(key) {
		return pick(`[data-pd-f="${key}"]`, parts.standCard);
	}

	function wireFactsEditor() {
		const everyone = namesInOrder(Object.keys(staffById));
		field('lead').innerHTML = everyone
			.map((personId) => `<option value="${personId}">${htmlSafe(staffById[personId].name)}</option>`)
			.join('');

		parts.editButton.addEventListener('click', () => setEditing(true));
		pick('[data-pd-cancel]', parts.standCard).addEventListener('click', () => setEditing(false));
		parts.standCard.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape' || parts.factsForm.hidden) return;
			event.preventDefault();
			setEditing(false);
		});
		parts.factsForm.addEventListener('submit', saveFacts);
	}

	function setEditing(open) {
		for (const node of pickAll('[data-pd-view]', parts.standCard)) node.hidden = open;
		for (const node of pickAll('[data-pd-editor]', parts.standCard)) node.hidden = !open;
		parts.editButton.hidden = open;

		if (!open) {
			parts.editButton.focus({ preventScroll: true });
			return;
		}
		field('goal').value = project.goal;
		field('lead').value = project.lead;
		field('area').value = project.area;
		field('start').value = project.start;
		field('release').value = releaseDate();
		for (const key of ['goal', 'start', 'release']) flagField(key, false);
		field('goal').focus();
	}

	function flagField(key, invalid) {
		pick(`[data-pd-err="${key}"]`, parts.standCard).hidden = !invalid;
		const input = field(key);
		input.classList.toggle('is-invalid', invalid);
		input.setAttribute('aria-invalid', String(invalid));
	}

	function saveFacts(event) {
		event.preventDefault();
		const goal = field('goal').value.trim();
		const startDate = field('start').value;
		const release = field('release').value;
		const lastBeforeRelease = phases[phases.length - 2].date;

		const problems = {
			goal: !goal,
			start: !startDate,
			release: !release || (startDate && release <= startDate) || release <= lastBeforeRelease,
		};
		for (const [key, invalid] of Object.entries(problems)) flagField(key, Boolean(invalid));
		const firstProblem = Object.keys(problems).find((key) => problems[key]);
		if (firstProblem) {
			field(firstProblem).focus();
			return;
		}

		const releaseMoved = release !== releaseDate();
		project.goal = goal;
		project.lead = field('lead').value;
		project.team = [project.lead, ...project.team.filter((personId) => personId !== project.lead)];
		project.area = field('area').value;
		project.start = startDate;
		phases[phases.length - 1].date = release;

		if (releaseMoved)
			logEvent('bi-calendar-event', `moved the release to <strong>${weekdayDate(release)}</strong>`);
		else logEvent('bi-pencil', 'edited the project details');

		setEditing(false);
		redrawAll();
		notify({
			tone: 'success',
			title: 'Project saved',
			text: releaseMoved ? `Release moved to ${weekdayDate(release)}.` : 'The goal and details are up to date.',
		});
	}

	/* The header menu: status choices and copying the page link. */

	function wireHeaderMenu() {
		for (const option of pickAll('[data-pd-status]', host)) {
			option.addEventListener('click', () => switchState(option.getAttribute('data-pd-status')));
		}

		pick('[data-pd-copy]', host).addEventListener('click', () => {
			const confirm = () =>
				notify({
					tone: 'success',
					title: 'Link copied',
					text: 'Anyone on the team can open this project with it.',
				});
			if (window.Basalt.copyText) window.Basalt.copyText(window.location.href).then(confirm);
			else confirm();
		});
	}

	function switchState(status) {
		if (status === project.status) return;
		project.status = status;
		const { label, tone } = STATE_LOOK[status];
		logEvent('bi-activity', `set the status to <strong>${label}</strong>`);
		drawHeader();
		drawActivity();
		notify({ tone, title: 'Status changed', text: `${project.name} is now ${label.toLowerCase()}.` });
	}

	/* The Add task dialog. */

	function taskInput(key) {
		return pick(`[data-pd-task="${key}"]`, parts.taskDialog);
	}

	function flagTaskName(invalid) {
		pick('[data-pd-task-error]', parts.taskDialog).hidden = !invalid;
		const input = taskInput('name');
		input.classList.toggle('is-invalid', invalid);
		input.setAttribute('aria-invalid', String(invalid));
	}

	function wireTaskDialog() {
		const dialog = parts.taskDialog;
		const form = pick('[data-pd-task-form]', dialog);

		taskInput('milestone').addEventListener('change', () => {
			const picked = phases.find((phase) => phase.id === taskInput('milestone').value);
			if (picked) taskInput('due').value = picked.date;
		});
		taskInput('name').addEventListener('input', () => {
			if (taskInput('name').value.trim()) flagTaskName(false);
		});
		dialog.addEventListener('show.bs.modal', prefillTaskDialog);
		dialog.addEventListener('shown.bs.modal', () => taskInput('name').focus());
		dialog.addEventListener('hidden.bs.modal', () => {
			form.reset();
			flagTaskName(false);
		});
		form.addEventListener('submit', addTask);
	}

	function prefillTaskDialog() {
		const upcoming = upcomingPhase();
		taskInput('milestone').innerHTML = phases
			.filter((phase) => !phase.reached)
			.map(
				(phase) =>
					`<option value="${phase.id}"${phase === upcoming ? ' selected' : ''}>${htmlSafe(phase.name)}</option>`,
			)
			.join('');
		taskInput('who').innerHTML = project.team
			.map(
				(personId) =>
					`<option value="${personId}"${personId === project.lead ? ' selected' : ''}>${htmlSafe(staffById[personId].name)}</option>`,
			)
			.join('');
		taskInput('due').value = upcoming ? upcoming.date : releaseDate();
	}

	function addTask(event) {
		event.preventDefault();
		const name = taskInput('name').value.trim();
		if (!name) {
			flagTaskName(true);
			taskInput('name').focus();
			return;
		}

		const task = {
			id: `n${Date.now()}`,
			name,
			ms: taskInput('milestone').value,
			who: taskInput('who').value,
			due: taskInput('due').value || releaseDate(),
		};
		openTasks.push(task);
		logEvent(
			'bi-plus-circle',
			`added <strong>${htmlSafe(name)}</strong> for ${htmlSafe(staffById[task.who].name)}`,
		);
		window.bootstrap.Modal.getOrCreateInstance(parts.taskDialog).hide();

		/* Widen the filter if it would hide the new task, then show the full list. */
		if (view.phaseFilter !== 'all' && view.phaseFilter !== task.ms) {
			view.phaseFilter = 'all';
			pick('#pd-show-all', host).checked = true;
			parts.filter.dispatchEvent(new Event('change'));
		}
		view.tasksExpanded = true;
		redrawAll();

		const row = pick(`[data-pd-task-row="${task.id}"]`, parts.taskList);
		if (row) {
			if (!calmMotion.matches) row.classList.add('is-new');
			row.scrollIntoView({ block: 'nearest', behavior: calmMotion.matches ? 'auto' : 'smooth' });
		}
		notify({ tone: 'success', title: 'Task added', text: `${name}, due ${weekdayDate(task.due)}.` });
	}

	/* The Add to the team dialog lists only people not already on it. */

	function wirePersonDialog() {
		const dialog = parts.personDialog;
		const picker = pick('[data-pd-person]', dialog);
		const submit = pick('button[type="submit"]', dialog);

		dialog.addEventListener('show.bs.modal', () => {
			const outside = namesInOrder(Object.keys(staffById).filter((personId) => !project.team.includes(personId)));
			picker.innerHTML = outside.length
				? outside
						.map(
							(personId) =>
								`<option value="${personId}">${htmlSafe(`${staffById[personId].name} · ${staffById[personId].role}`)}</option>`,
						)
						.join('')
				: '<option value="">Everyone is already on the team</option>';
			picker.disabled = !outside.length;
			submit.disabled = !outside.length;
		});

		pick('[data-pd-person-form]', dialog).addEventListener('submit', (event) => {
			event.preventDefault();
			const personId = picker.value;
			if (!personId) return;
			project.team.push(personId);
			logEvent('bi-person-plus', `added ${profileLink(personId)} to the team`);
			window.bootstrap.Modal.getOrCreateInstance(dialog).hide();
			redrawAll();
			notify({
				tone: 'success',
				title: 'Added to the team',
				text: `${staffById[personId].name} can now pick up tasks here.`,
			});
		});
	}
})();
