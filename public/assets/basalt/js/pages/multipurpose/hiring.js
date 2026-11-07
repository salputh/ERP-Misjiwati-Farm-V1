/**
 * Hiring (hiring.html).
 *
 * Fieldline's hiring pipeline: every applicant in a column for the stage
 * they have reached, a drawer that opens their record to move them on or
 * turn them down, the open roles under the board with a quick view of each,
 * and drawers to add an applicant by hand or open a new role. Built on the
 * shared page header, avatars, styled selects, choice tiles, status pills,
 * empty states, the date picker, the record drawer, dialogs and toasts. In
 * your app the day and the signed-in name come from the server.
 */
(() => {
	'use strict';

	const PINNED_DAY = '2026-10-09';
	const SIGNED_IN = 'John Armstrong';
	const DAY_MS = 86400000;
	const SEARCH_DELAY = 150;
	const LONG_OPEN_DAYS = 45;
	const FIRST_NEW_ID = 4120;
	const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	const NUMBER_WORDS = [
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
	const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const JOB_STATUS = { open: ['Open', 'success'], paused: ['Paused', 'warning'], closed: ['Closed', 'danger'] };
	const SETUP_WORDS = { remote: 'remote', hybrid: 'hybrid', onsite: 'on site' };
	const VERDICT_COLOR = { 'Strong yes': 'success', Yes: 'success', Mixed: 'warning' };

	/* The five stages, left to right across the board. */
	const STAGE_LIST = [
		{ key: 'applied', label: 'Applied' },
		{ key: 'screen', label: 'Screening' },
		{ key: 'interview', label: 'Interviews' },
		{ key: 'offer', label: 'Offer' },
		{ key: 'hired', label: 'Hired' },
	];

	/* What someone is waiting for the moment they reach a stage. */
	const NEXT_STEP_AT = {
		applied: { text: 'Screening call', todo: 'To book' },
		screen: { text: 'Screening call', todo: 'To book' },
		interview: { text: 'Interviews', todo: 'To book' },
		offer: { text: 'Offer letter', todo: 'To draft' },
		hired: { text: 'Start date', todo: 'To agree' },
	};

	/*
	 * The open roles and every applicant are shared with Candidate Details
	 * (assets/basalt/js/data/multipurpose/hiring.js). Managers, recruiters and referrers are on
	 * the staff roster (assets/basalt/js/data/multipurpose/people.js), so their names open their
	 * own records. The board works on copies, so moves never touch the data.
	 */
	const HIRING = window.Basalt.data.hiring;
	const STAFF = window.Basalt.data.people;
	const JOBS = HIRING.roles;
	const SOURCE_WORDS = HIRING.sources;
	const pipeline = HIRING.candidates.map((row) => ({ ...row, history: row.history.slice() }));

	/* `stage` is the one column shown when the card is too narrow for five. */
	const boardState = { query: '', job: '', stage: 'applied', openId: null, dragId: null };
	let browseList = [];
	let rejectTarget = null;
	let addedCount = 0;
	let openJobKey = null;
	let ui = null;

	/*
	 * Everything starts here once the DOM is ready: the selects are filled,
	 * every part of the page is wired, the board and the roles are painted,
	 * and a ?role= in the address narrows the board to that role.
	 */
	function start() {
		ui = collectNodes();
		fillJobSelects();
		wireToolbar();
		wireBoard();
		wireDragging();
		wireJobsTable();
		wireJobForm();
		wireRecordDrawer();
		wireRejectDialog();
		wireAddForm();
		repaint();
		const askedJob = new URLSearchParams(location.search).get('role');
		if (askedJob && JOBS[askedJob]) focusBoardOn(askedJob);
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function collectNodes() {
		return {
			board: pick('[data-rc-board]'),
			stageChips: pick('[data-rc-stages]'),
			boardSub: pick('[data-rc-pipeline-sub]'),
			search: pick('[data-rc-search]'),
			jobSelect: pick('[data-rc-role]'),
			jobsTable: pick('[data-rc-roles]'),
			jobsSub: pick('[data-rc-roles-sub]'),
			recordDrawer: pick('#rc-record'),
			addForm: pick('[data-rc-form]'),
			addDrawer: pick('#rc-new'),
			addJobSelect: pick('[data-rc-new-role]'),
			addJobError: pick('#rc-new-role-error'),
			rejectDialog: pick('#rc-reject'),
			jobDrawer: pick('#rc-role-view'),
			jobNewDrawer: pick('#rc-role-new'),
			jobForm: pick('[data-rc-role-form]'),
			payError: pick('#rc-role-pay-error'),
			startField: pick('#rc-role-start'),
		};
	}

	function recordHook(name) {
		return pick(`[data-rc-r="${name}"]`, ui.recordDrawer);
	}

	function jobHook(name) {
		return pick(`[data-rc-v="${name}"]`, ui.jobDrawer);
	}

	function htmlSafe(value) {
		return `${value ?? ''}`.replace(/[&<>"']/g, (mark) => ESCAPES[mark]);
	}

	function notify(message) {
		window.Basalt.toasts?.push(message);
	}

	function upperFirst(text) {
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	/** "no roles", "one candidate", "twelve days", "14 days". */
	function countWords(total, one, many = `${one}s`) {
		const figure = total < NUMBER_WORDS.length ? NUMBER_WORDS[total] : String(total);
		return `${figure} ${total === 1 ? one : many}`;
	}

	function dateOf(iso) {
		const [year, month, dayOfMonth] = iso.split('-').map(Number);
		return new Date(year, month - 1, dayOfMonth);
	}

	function dayGap(from, to) {
		return Math.round((dateOf(to) - dateOf(from)) / DAY_MS);
	}

	function shortDate(iso) {
		const calendar = dateOf(iso);
		return `${MONTH_SHORT[calendar.getMonth()]} ${calendar.getDate()}`;
	}

	function weekdayDate(iso) {
		return `${WEEKDAY_SHORT[dateOf(iso).getDay()]}, ${shortDate(iso)}`;
	}

	function dateWithYear(iso) {
		return `${shortDate(iso)}, ${iso.slice(0, 4)}`;
	}

	/** "15:00" to "3:00 pm". */
	function clockText(hhmm) {
		const [hours, minutes] = hhmm.split(':').map(Number);
		return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')}${hours < 12 ? ' am' : ' pm'}`;
	}

	/** "Today, 3:00 pm", "Tomorrow" or "Mon, Oct 12". */
	function whenWords(iso, time) {
		const dayWord = { 0: 'Today', 1: 'Tomorrow' }[dayGap(PINNED_DAY, iso)] || weekdayDate(iso);
		return time ? `${dayWord}, ${clockText(time)}` : dayWord;
	}

	function displayName(person) {
		return `${person.first} ${person.last}`;
	}

	function jobOf(person) {
		return JOBS[person.role];
	}

	function monogram(person) {
		return person.first.charAt(0) + person.last.charAt(0);
	}

	/** A steady avatar color per person, from the palette's eight chart colors. */
	function avatarTone(person) {
		return (Array.from(person.id).reduce((sum, mark) => sum + mark.charCodeAt(0), 0) % 8) + 1;
	}

	/* Someone added by hand in the demo has no page of their own. */
	function applicantPage(person) {
		return `candidate-details.html?id=${encodeURIComponent(person.id)}`;
	}

	function jobPage(key) {
		return `role-details.html?id=${encodeURIComponent(key)}`;
	}

	function staffPageFor(name) {
		const staffer = STAFF.people.find((person) => STAFF.nameOf(person) === name);
		return staffer ? STAFF.staffPage(staffer) : 'employees.html';
	}

	function stageNamed(key) {
		return STAGE_LIST.find((stage) => stage.key === key);
	}

	function stageSlot(key) {
		return STAGE_LIST.findIndex((stage) => stage.key === key);
	}

	function jobStatusChip(job) {
		const [label, tone] = JOB_STATUS[job.status] || JOB_STATUS.open;
		return `<span class="basalt-status basalt-status-dot basalt-status-${tone}">${label}</span>`;
	}

	function stageChip(key) {
		return `<span class="basalt-status basalt-status-dot rc-stage-pill" data-stage="${key}">${stageNamed(key).label}</span>`;
	}

	function sourceWords(person) {
		if (person.referrer) return `Referred by ${person.referrer}`;
		if (person.agency) return `Agency, ${person.agency}`;
		return SOURCE_WORDS[person.source];
	}

	function verdictColor(verdict) {
		return VERDICT_COLOR[verdict] || 'danger';
	}

	function openApplicant() {
		return pipeline.find((person) => person.id === boardState.openId);
	}

	function repaint() {
		paintBoard();
		paintJobs();
		if (boardState.openId) paintRecord();
		if (openJobKey) paintJob();
	}

	/* The board: who passes the search and the role filter, stage by stage. */
	function isVisible(person) {
		if (boardState.job && person.role !== boardState.job) return false;
		if (!boardState.query) return true;
		const haystack = `${displayName(person)} ${jobOf(person).title} ${person.city}`;
		return window.Basalt?.matchesQuery
			? window.Basalt.matchesQuery(haystack, boardState.query)
			: haystack.toLowerCase().includes(boardState.query.toLowerCase());
	}

	/** Soonest next step first; steps without a date wait at the end. */
	function soonestFirst(a, b) {
		return (
			(a.next.date || '9999').localeCompare(b.next.date || '9999') || displayName(a).localeCompare(displayName(b))
		);
	}

	function shownApplicants() {
		return STAGE_LIST.flatMap((stage) =>
			pipeline.filter((person) => person.stage === stage.key && isVisible(person)).sort(soonestFirst),
		);
	}

	/** The quick view button and, when there is a page, the open-full-page link. */
	function rowActions(quickAttr, name, fullHref, noDrag) {
		const quick = `<button type="button" class="btn btn-icon btn-sm" ${quickAttr} aria-label="Quick view: ${name}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>`;
		const pageLink = fullHref
			? `<a class="btn btn-icon btn-sm" href="${fullHref}"${noDrag ? ' draggable="false"' : ''} aria-label="Open full page: ${name}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>`
			: '';
		return `<span class="basalt-row-actions">${quick}${pageLink}</span>`;
	}

	/* When the next step is and what it is, with the row actions at the end of the first line. */
	function nextStepHtml(person) {
		const nextStep = person.next;
		const whenHtml = nextStep.date
			? `<span class="rc-next-when${dayGap(PINNED_DAY, nextStep.date) === 0 ? ' is-today' : ''}"><i class="bi bi-calendar-event" aria-hidden="true"></i>${whenWords(nextStep.date, nextStep.time)}</span>`
			: `<span class="rc-next-when is-todo"><i class="bi bi-hourglass-split" aria-hidden="true"></i>${htmlSafe(nextStep.todo)}</span>`;
		const controlsHtml = rowActions(
			'data-rc-quick',
			htmlSafe(displayName(person)),
			person.made ? '' : applicantPage(person),
			true,
		);
		return `<div class="rc-next"><div class="rc-next-top">${whenHtml}${controlsHtml}</div><span class="rc-next-what">${htmlSafe(nextStep.text)}</span></div>`;
	}

	/* The interview verdicts so far: yes votes, and any mixed ones. */
	function verdictsHtml(person) {
		if (!person.scores?.length) return '';
		const yesCount = person.scores.filter((score) => verdictColor(score[2]) === 'success').length;
		const mixedCount = person.scores.length - yesCount;
		const said =
			countWords(yesCount, 'yes', 'yes') + (mixedCount ? `, ${countWords(mixedCount, 'mixed', 'mixed')}` : '');
		const yesHtml = yesCount
			? `<span class="rc-votes-n rc-votes-n-yes" aria-hidden="true"><i class="bi bi-hand-thumbs-up-fill"></i>${yesCount}</span>`
			: '';
		const mixedHtml = mixedCount
			? `<span class="rc-votes-n rc-votes-n-mixed" aria-hidden="true"><i class="bi bi-dash-circle-fill"></i>${mixedCount}</span>`
			: '';
		return `<span class="rc-votes" title="Scorecards: ${said}">${yesHtml}${mixedHtml}<span class="visually-hidden">Scorecards: ${said}</span></span>`;
	}

	function applicantCard(person) {
		const shownName = htmlSafe(displayName(person));
		const nameHtml = person.made
			? `<span class="rc-cand-name">${shownName}</span>`
			: `<a class="rc-cand-name" href="${applicantPage(person)}" draggable="false">${shownName}</a>`;
		return `<li class="rc-cand" draggable="true" data-id="${person.id}"><div class="rc-cand-who"><span class="basalt-avatar basalt-avatar-sm basalt-avatar-tone-${avatarTone(person)}" aria-hidden="true">${htmlSafe(monogram(person))}</span><span class="rc-cand-text">${nameHtml}<span class="rc-cand-role">${htmlSafe(jobOf(person).title)}</span></span></div><div class="rc-cand-tags"><span class="basalt-status rc-source rc-source-${person.source}">${htmlSafe(SOURCE_WORDS[person.source])}</span>${verdictsHtml(person)}</div>${nextStepHtml(person)}</li>`;
	}

	function noMatchesHtml({ icon, title, text, actions }) {
		return `<div class="basalt-empty basalt-empty-compact basalt-empty-muted rc-empty"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi ${icon}"></i></span><h3 class="basalt-empty-title">${title}</h3><p class="basalt-empty-text">${text}</p>${actions ? `<div class="basalt-empty-actions">${actions}</div>` : ''}</div>`;
	}

	function columnHtml(stage, here) {
		const cardList = here.map(applicantCard).join('');
		const nobody = here.length ? '' : '<p class="rc-col-empty">No one at this stage</p>';
		return `<section class="rc-col${stage.key === boardState.stage ? ' is-shown' : ''}" data-stage="${stage.key}" aria-labelledby="rc-col-${stage.key}"><header class="rc-col-head"><h3 class="rc-col-title" id="rc-col-${stage.key}"><span class="rc-col-dot" aria-hidden="true"></span>${stage.label}</h3><span class="rc-col-count">${here.length}<span class="visually-hidden"> ${here.length === 1 ? 'candidate' : 'candidates'}</span></span></header><ul class="rc-col-list" data-rc-drop="${stage.key}">${cardList}</ul>${nobody}</section>`;
	}

	function chipHtml(stage, total) {
		const id = `rc-stage-${stage.key}`;
		return `<input type="radio" class="btn-check" name="rcStage" id="${id}" value="${stage.key}"${stage.key === boardState.stage ? ' checked' : ''}><label class="rc-chip" for="${id}">${stage.label} <span class="rc-chip-count">${total}</span></label>`;
	}

	function paintBoard() {
		const shown = shownApplicants();
		ui.board.innerHTML = shown.length
			? STAGE_LIST.map((stage) =>
					columnHtml(
						stage,
						shown.filter((person) => person.stage === stage.key),
					),
				).join('')
			: noMatchesHtml({
					icon: 'bi-search',
					title: 'No candidates match',
					text: `Nobody here matches ${boardState.query ? `“${htmlSafe(boardState.query)}”` : 'that role'}. Try another name, role or city.`,
					actions:
						'<button type="button" class="btn btn-sm btn-outline-secondary" data-rc-reset>Clear the search</button>',
				});
		window.Basalt.tips?.(ui.board);
		ui.stageChips.hidden = !shown.length;
		ui.stageChips.innerHTML = STAGE_LIST.map((stage) =>
			chipHtml(stage, shown.filter((person) => person.stage === stage.key).length),
		).join('');
		const inPlay = pipeline.filter((person) => person.stage !== 'hired').length;
		ui.boardSub.textContent = `${upperFirst(countWords(inPlay, 'candidate'))} in progress across ${countWords(Object.keys(JOBS).length, 'role')}. Drag a card to move it on, or open it.`;
	}

	/* The open roles table, with how far each role's applicants have got. */
	function jobRow(key, job, theirs, hiredCount) {
		const inPlay = theirs.length - hiredCount;
		const furthest = theirs
			.filter((person) => person.stage !== 'hired')
			.reduce((best, person) => Math.max(best, stageSlot(person.stage)), -1);
		const age = dayGap(job.opened, PINNED_DAY);
		const statusTag = job.status && job.status !== 'open' ? jobStatusChip(job) : '';
		const furthestCell =
			furthest < 0 ? '<span class="rc-quiet">No one yet</span>' : stageChip(STAGE_LIST[furthest].key);
		const controlsHtml = rowActions(
			`data-rc-role-open="${htmlSafe(key)}"`,
			htmlSafe(job.title),
			jobPage(key),
			false,
		);
		return `<tr class="rc-role${key === openJobKey ? ' is-open' : ''}" data-rc-role-id="${htmlSafe(key)}"><td><span class="rc-role-title"><a class="rc-role-link" href="${jobPage(key)}">${htmlSafe(job.title)}</a>${statusTag}</span><span class="rc-role-meta">${htmlSafe(job.team)} · ${htmlSafe(job.where)}</span></td><td><a class="rc-link" href="${staffPageFor(job.manager)}">${htmlSafe(job.manager)}</a></td><td class="rc-num"><span class="rc-figure">${inPlay}</span><span class="rc-unit"> ${inPlay === 1 ? 'candidate' : 'candidates'}</span></td><td>${furthestCell}</td><td><span class="rc-filled">${hiredCount} of ${job.openings}</span></td><td><span class="rc-age${age > LONG_OPEN_DAYS ? ' is-long' : ''}">${age} days</span></td><td>${controlsHtml}</td></tr>`;
	}

	function paintJobs() {
		let openings = 0;
		let filled = 0;
		const rows = Object.entries(JOBS).map(([key, job]) => {
			const theirs = pipeline.filter((person) => person.role === key);
			const hiredCount = theirs.filter((person) => person.stage === 'hired').length;
			openings += job.openings;
			filled += hiredCount;
			return jobRow(key, job, theirs, hiredCount);
		});
		ui.jobsTable.innerHTML = rows.join('');
		window.Basalt.tips?.(ui.jobsTable);
		ui.jobsSub.textContent = `${upperFirst(countWords(openings, 'opening'))} across ${countWords(Object.keys(JOBS).length, 'role')}, ${countWords(filled, 'already filled', 'already filled')}.`;
	}

	/* Moving someone on (or back) resets their next step and notes it in their history. */
	function moveAlong(person, stage) {
		if (person.stage === stage) return;
		const backwards = stageSlot(stage) < stageSlot(person.stage);
		person.stage = stage;
		person.next = { ...NEXT_STEP_AT[stage] };
		person.history.push([
			PINNED_DAY,
			`Moved ${backwards ? 'back ' : ''}to ${stageNamed(stage).label} by ${SIGNED_IN}`,
		]);
		repaint();
		const hired = stage === 'hired';
		notify({
			tone: 'success',
			icon: hired ? 'bi-person-check' : 'bi-arrow-right-circle',
			title: hired ? `${displayName(person)} hired` : `Moved to ${stageNamed(stage).label}`,
			text: hired
				? `${jobOf(person).recruiter.split(' ')[0]} will agree a start date with ${person.first} and set up their first week.`
				: `${displayName(person)}, ${jobOf(person).title}. ${person.next.text} ${person.next.todo.toLowerCase()}.`,
		});
	}

	function askToReject(person) {
		rejectTarget = person;
		pick('[data-rc-reject-name]', ui.rejectDialog).textContent = displayName(person);
		pick('[data-rc-reject-sub]', ui.rejectDialog).textContent =
			`${jobOf(person).title}, at the ${stageNamed(person.stage).label} stage. They leave the pipeline.`;
		bootstrap.Modal.getOrCreateInstance(ui.rejectDialog).show();
	}

	function confirmReject() {
		const person = rejectTarget;
		if (!person) return;
		const spot = pipeline.indexOf(person);
		const reasonSelect = pick('[data-rc-reject-reason]', ui.rejectDialog);
		const emailed = pick('[data-rc-reject-email]', ui.rejectDialog).checked;
		pipeline.splice(spot, 1);
		bootstrap.Modal.getOrCreateInstance(ui.rejectDialog).hide();
		if (boardState.openId === person.id) bootstrap.Offcanvas.getOrCreateInstance(ui.recordDrawer).hide();
		repaint();
		notify({
			tone: 'info',
			icon: 'bi-person-x',
			title: `${displayName(person)} turned down`,
			text: `${reasonSelect.options[reasonSelect.selectedIndex].text}.${emailed ? ' They get the email today.' : ''}`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						pipeline.splice(spot, 0, person);
						repaint();
					},
				},
			],
		});
	}

	/* The applicant drawer: stage and what is next, scorecards, details, history. */
	function standingWords(person) {
		const nextStep = person.next;
		if (person.stage === 'hired')
			return `Starts on ${weekdayDate(nextStep.date)}. Reports to ${jobOf(person).manager}.`;
		if (!nextStep.date) return `${nextStep.text} ${nextStep.todo.toLowerCase()}.`;
		const timing =
			dayGap(PINNED_DAY, nextStep.date) === 0
				? `today${nextStep.time ? ` at ${clockText(nextStep.time)}` : ''}`
				: `on ${weekdayDate(nextStep.date)}`;
		return `${nextStep.text} ${timing}.`;
	}

	function scorecardsHtml(person) {
		const cardList = person.scores?.length
			? `<ul class="rc-scores">${person.scores.map(([who, what, verdict]) => `<li class="rc-score"><span class="rc-score-who"><span class="rc-score-name">${htmlSafe(who)}</span><span class="rc-score-what">${htmlSafe(what)}</span></span><span class="basalt-status basalt-status-${verdictColor(verdict)}">${htmlSafe(verdict)}</span></li>`).join('')}</ul>`
			: `<p class="rc-wait">Scorecards show here after ${htmlSafe(person.first)}’s first interview.</p>`;
		return `<section aria-labelledby="rc-r-scores"><h3 class="rc-r-h" id="rc-r-scores">Scorecards</h3>${cardList}</section>`;
	}

	function historyList(person) {
		const rows = person.history
			.slice()
			.reverse()
			.map(
				([day, what]) =>
					`<li><span class="rc-history-day">${shortDate(day)}</span><span class="rc-history-text">${htmlSafe(what)}</span></li>`,
			)
			.join('');
		return `<section aria-labelledby="rc-r-history"><h3 class="rc-r-h" id="rc-r-history">History</h3><ol class="rc-history">${rows}</ol></section>`;
	}

	function factList(rows) {
		return `<dl class="rc-r-facts">${rows.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join('')}</dl>`;
	}

	function detailsList(person) {
		const job = jobOf(person);
		const address = `${`${person.first}.${person.last}`
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-z.]/g, '')}@example.com`;
		const facts = factList([
			['Role', htmlSafe(job.title)],
			['Source', htmlSafe(sourceWords(person))],
			['Applied', weekdayDate(person.applied)],
			['Based in', htmlSafe(person.city)],
			['Email', `<a href="mailto:${address}">${address}</a>`],
			['Recruiter', `<a href="${staffPageFor(job.recruiter)}">${htmlSafe(job.recruiter)}</a>`],
			['Application', `<span class="rc-id">${person.id}</span>`],
		]);
		return `<section aria-labelledby="rc-r-details"><h3 class="rc-r-h" id="rc-r-details">Details</h3>${facts}</section>`;
	}

	function drawerButtons(person) {
		if (person.stage === 'hired') {
			const recordHref = person.staff
				? `employee-details.html?id=${encodeURIComponent(person.staff)}`
				: 'employees.html';
			return `<a class="btn btn-primary" href="${recordHref}"><i class="bi bi-person-badge me-1" aria-hidden="true"></i>Employee record</a>`;
		}
		const onward =
			person.stage === 'offer'
				? '<i class="bi bi-person-check me-1" aria-hidden="true"></i>Mark as hired'
				: '<i class="bi bi-arrow-right me-1" aria-hidden="true"></i>Next stage';
		return `<button type="button" class="btn btn-outline-secondary" data-rc-act="reject">Turn down</button><button type="button" class="btn btn-primary" data-rc-act="next">${onward}</button>`;
	}

	function paintRecord() {
		const person = openApplicant();
		if (!person) return;
		const spot = browseList.findIndex((row) => row.id === person.id);
		recordHook('title').textContent = displayName(person);
		recordHook('sub').textContent = `${jobOf(person).title} · ${person.city}`;
		recordHook('full').href = applicantPage(person);
		recordHook('full').hidden = Boolean(person.made);
		recordHook('pos').textContent = spot >= 0 ? `${spot + 1} of ${browseList.length}` : '';
		for (const button of pickAll('[data-rc-r-step]', ui.recordDrawer))
			button.disabled = spot < 0 || browseList.length < 2;
		const middle = person.scores?.length
			? scorecardsHtml(person) + detailsList(person)
			: detailsList(person) + scorecardsHtml(person);
		recordHook('body').innerHTML =
			`<div class="rc-r-state">${stageChip(person.stage)}<p class="rc-r-state-text">${htmlSafe(standingWords(person))}</p></div>${middle}${historyList(person)}`;
		recordHook('foot').innerHTML = drawerButtons(person);
	}

	function showApplicant(id) {
		boardState.openId = id;
		paintRecord();
		recordHook('body').scrollTop = 0;
		bootstrap.Offcanvas.getOrCreateInstance(ui.recordDrawer).show();
	}

	/** Steps through the applicants the board showed when the drawer opened. */
	function browseBy(direction) {
		if (browseList.length < 2) return;
		const spot = browseList.findIndex((row) => row.id === boardState.openId);
		showApplicant(browseList[(spot + direction + browseList.length) % browseList.length].id);
	}

	function peekAt(card) {
		browseList = shownApplicants();
		showApplicant(card.getAttribute('data-id'));
	}

	/* Forms: a wrong field is marked and announced; typing clears the mark. */
	function flagField(field, wrong) {
		field.classList.toggle('is-invalid', wrong);
		field.setAttribute('aria-invalid', String(wrong));
		return wrong;
	}

	function clearFlags(scope) {
		for (const flagged of pickAll('.is-invalid', scope)) {
			flagged.classList.remove('is-invalid');
			flagged.removeAttribute('aria-invalid');
		}
	}

	function addApplicant(event) {
		event.preventDefault();
		const applicantForm = ui.addForm;
		const checks = [
			[applicantForm.first, !applicantForm.first.value.trim()],
			[applicantForm.last, !applicantForm.last.value.trim()],
			[applicantForm.email, !EMAIL_SHAPE.test(applicantForm.email.value.trim())],
			[applicantForm.role, !applicantForm.role.value],
		];
		const wrongFields = checks.filter(([field, wrong]) => flagField(field, wrong)).map(([field]) => field);
		ui.addJobError.classList.toggle('d-block', !applicantForm.role.value);
		if (wrongFields.length) {
			wrongFields[0].focus();
			return;
		}
		addedCount += 1;
		const person = {
			id: `#${FIRST_NEW_ID + addedCount}`,
			made: true,
			first: applicantForm.first.value.trim(),
			last: applicantForm.last.value.trim(),
			role: applicantForm.role.value,
			stage: 'applied',
			source: applicantForm.source.value,
			applied: PINNED_DAY,
			city: 'Not given yet',
			next: { ...NEXT_STEP_AT.applied },
			history: [
				[PINNED_DAY, `Added by ${SIGNED_IN} (${SOURCE_WORDS[applicantForm.source.value].toLowerCase()})`],
			],
		};
		pipeline.push(person);
		bootstrap.Offcanvas.getOrCreateInstance(ui.addDrawer).hide();
		repaint();
		notify({
			tone: 'success',
			icon: 'bi-person-plus',
			title: `${displayName(person)} added`,
			text: `In Applied for ${jobOf(person).title}. ${JOBS[person.role].recruiter} books the screening call.`,
		});
	}

	function clearAddForm() {
		ui.addForm.reset();
		ui.addForm.role.dispatchEvent(new Event('change', { bubbles: true }));
		clearFlags(ui.addForm);
		ui.addJobError.classList.remove('d-block');
	}

	/* The role drawer: where the role stands, its applicants by stage, its facts. */
	function jobStandingWords(job, theirs) {
		const hiredCount = theirs.filter((person) => person.stage === 'hired').length;
		if (job.status === 'paused') return 'Hiring is paused, so the role takes no new applications for now.';
		if (job.status === 'closed') return 'Closed. The posting is off the careers page.';
		return `Open for ${countWords(dayGap(job.opened, PINNED_DAY), 'day')}. ${hiredCount ? `${hiredCount} of ${job.openings} openings filled so far.` : 'No openings filled yet.'}`;
	}

	function jobStagesHtml(theirs) {
		if (!theirs.length) return '<p class="rc-wait">No one has applied yet. Candidates show here by stage.</p>';
		const rows = STAGE_LIST.map((stage) => {
			const here = theirs.filter((person) => person.stage === stage.key).sort(soonestFirst);
			const nameList = here.length
				? here
						.map((person) =>
							person.made
								? htmlSafe(displayName(person))
								: `<a href="${applicantPage(person)}">${htmlSafe(displayName(person))}</a>`,
						)
						.join(', ')
				: '<span class="rc-quiet">No one</span>';
			return `<li class="rc-v-stage" data-stage="${stage.key}"><span class="rc-v-stage-label"><span class="rc-col-dot" aria-hidden="true"></span>${stage.label}</span><span class="rc-v-stage-count">${here.length}</span><span class="rc-v-stage-who">${nameList}</span></li>`;
		});
		return `<ul class="rc-v-stages">${rows.join('')}</ul>`;
	}

	function paintJob() {
		const job = JOBS[openJobKey];
		if (!job) return;
		const theirs = pipeline.filter((person) => person.role === openJobKey);
		jobHook('title').textContent = job.title;
		jobHook('sub').textContent = `${job.team} · ${job.where}`;
		jobHook('full').href = jobPage(openJobKey);
		const facts = factList([
			['Hiring manager', `<a href="${staffPageFor(job.manager)}">${htmlSafe(job.manager)}</a>`],
			['Recruiter', `<a href="${staffPageFor(job.recruiter)}">${htmlSafe(job.recruiter)}</a>`],
			['Salary', htmlSafe(job.band)],
			['Type', htmlSafe(`${job.type}, ${SETUP_WORDS[job.setup]}`)],
			['Target start', job.start ? dateWithYear(job.start) : '<span class="rc-quiet">Not set</span>'],
			['Careers page', job.published ? 'Published' : '<span class="rc-quiet">Not published</span>'],
		]);
		jobHook('body').innerHTML =
			`<div class="rc-r-state">${jobStatusChip(job)}<p class="rc-r-state-text">${htmlSafe(jobStandingWords(job, theirs))}</p></div><section aria-labelledby="rc-v-stages"><h3 class="rc-r-h" id="rc-v-stages">Candidates</h3>${jobStagesHtml(theirs)}</section><section aria-labelledby="rc-v-details"><h3 class="rc-r-h" id="rc-v-details">Details</h3>${facts}</section>`;
	}

	function showJob(key) {
		openJobKey = key;
		paintJob();
		for (const row of pickAll('tr[data-rc-role-id]', ui.jobsTable)) {
			row.classList.toggle('is-open', row.getAttribute('data-rc-role-id') === key);
		}
		jobHook('body').scrollTop = 0;
		bootstrap.Offcanvas.getOrCreateInstance(ui.jobDrawer).show();
	}

	/* The new-role form. The people who can hire are team leads and anyone with a report. */
	function fillJobForm() {
		const jobForm = ui.jobForm;
		jobForm.team.insertAdjacentHTML(
			'beforeend',
			STAFF.teams.map((team) => `<option value="${htmlSafe(team.id)}">${htmlSafe(team.id)}</option>`).join(''),
		);
		const leadIds = new Set(STAFF.teams.map((team) => team.lead));
		for (const person of STAFF.people) {
			if (person.mgr) leadIds.add(person.mgr);
		}
		const hirers = STAFF.people.filter((person) => leadIds.has(person.id) && !person.left);
		const optionGroups = STAFF.teams.map((team) => {
			const here = hirers
				.filter((person) => person.team === team.id)
				.sort((a, b) => STAFF.nameOf(a).localeCompare(STAFF.nameOf(b)));
			if (!here.length) return '';
			return `<optgroup label="${htmlSafe(team.id)}">${here.map((person) => `<option value="${htmlSafe(STAFF.nameOf(person))}">${htmlSafe(STAFF.nameOf(person))}</option>`).join('')}</optgroup>`;
		});
		jobForm.manager.insertAdjacentHTML('beforeend', optionGroups.join(''));
	}

	/** "95,000" or "95k" to 95000; anything else to NaN. */
	function parsePay(text) {
		const amountMatch = /^(\d[\d,]*)(k?)$/i.exec(text.trim().replace(/\s/g, ''));
		return amountMatch ? Number(amountMatch[1].replace(/,/g, '')) * (amountMatch[2] ? 1000 : 1) : NaN;
	}

	function placeWords(setup, place) {
		if (setup === 'remote' && !/^remote/i.test(place)) return `Remote, ${place}`;
		return setup === 'hybrid' ? `${place} or remote` : place;
	}

	function openJob(event) {
		event.preventDefault();
		const jobForm = ui.jobForm;
		const payFrom = parsePay(jobForm.payFrom.value);
		const payTo = parsePay(jobForm.payTo.value);
		const payWrong = !(payFrom > 0 && payTo >= payFrom);
		const startWrong = !ui.startField.checkValidity();
		flagField(jobForm.payFrom, payWrong);
		flagField(jobForm.payTo, payWrong);
		ui.payError.hidden = !payWrong;
		const checks = [
			[jobForm.title, !jobForm.title.value.trim()],
			[jobForm.team, !jobForm.team.value],
			[jobForm.manager, !jobForm.manager.value],
			[jobForm.where, !jobForm.where.value.trim()],
		];
		const wrongFields = checks.filter(([field, wrong]) => flagField(field, wrong)).map(([field]) => field);
		if (payWrong) wrongFields.push(jobForm.payFrom);
		if (startWrong) wrongFields.push(ui.startField);
		if (wrongFields.length) {
			wrongFields[0].focus();
			return;
		}
		const setup = jobForm.setup.value;
		const place = jobForm.where.value.trim();
		const currency = jobForm.currency.value;
		const recruiter = /Sales|Support|Success/.test(jobForm.team.value) ? 'Kirk Mathis' : 'Cheryl Henderson';
		const job = {
			title: jobForm.title.value.trim(),
			team: jobForm.team.value,
			manager: jobForm.manager.value,
			recruiter,
			openings: Number(jobForm.openings.value),
			opened: PINNED_DAY,
			where: placeWords(setup, place),
			band: `${currency}${payFrom.toLocaleString('en-US')} to ${currency}${payTo.toLocaleString('en-US')}`,
			skills: [],
			extra: [],
			rounds: [
				['Screening call', recruiter, 30, 2, ['Experience', 'Communication', 'Motivation']],
				['Hiring manager interview', '', 45, 7, ['Know-how', 'Planning', 'Team fit']],
			],
			status: 'open',
			published: jobForm.publish.checked,
			views: 0,
			setup,
			type: jobForm.type.value,
			start: jobForm.start.value,
			pitch: jobForm.pitch.value.trim(),
			does: [],
			wants: [],
		};
		const key = HIRING.addRole(job);
		const option = `<option value="${htmlSafe(key)}">${htmlSafe(job.title)}</option>`;
		ui.jobSelect.insertAdjacentHTML('beforeend', option);
		ui.addJobSelect.insertAdjacentHTML('beforeend', option);
		bootstrap.Offcanvas.getOrCreateInstance(ui.jobNewDrawer).hide();
		repaint();
		notify({
			tone: 'success',
			icon: 'bi-briefcase',
			title: `${job.title} is open`,
			text: `${job.published ? 'It is on the careers page. ' : 'It is not on the careers page yet. '}${recruiter} will help ${job.manager.split(' ')[0]} with the interviews.`,
			actions: [
				{
					label: 'Open its page',
					onClick: () => {
						location.href = jobPage(key);
					},
				},
			],
		});
	}

	function clearJobForm() {
		const jobForm = ui.jobForm;
		jobForm.reset();
		for (const dropdown of [jobForm.team, jobForm.manager, jobForm.currency, jobForm.openings]) {
			dropdown.dispatchEvent(new Event('change', { bubbles: true }));
		}
		clearFlags(jobForm);
		ui.payError.hidden = true;
	}

	/* Wiring, one part of the page at a time. */
	function fillJobSelects() {
		const optionHtml = Object.entries(JOBS)
			.map(([key, job]) => `<option value="${key}">${htmlSafe(job.title)}</option>`)
			.join('');
		ui.jobSelect.insertAdjacentHTML('beforeend', optionHtml);
		ui.addJobSelect.insertAdjacentHTML('beforeend', optionHtml);
	}

	function pickJob(key) {
		ui.jobSelect.value = key;
		ui.jobSelect.dispatchEvent(new Event('change', { bubbles: true }));
	}

	/** The board narrowed to one role and scrolled into view. */
	function focusBoardOn(key) {
		ui.search.value = '';
		boardState.query = '';
		pickJob(key);
		pick('#rc-pipeline').scrollIntoView({
			behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
			block: 'start',
		});
	}

	function wireToolbar() {
		let typingTimer;
		ui.search.addEventListener('input', () => {
			clearTimeout(typingTimer);
			typingTimer = setTimeout(() => {
				boardState.query = ui.search.value.trim();
				paintBoard();
			}, SEARCH_DELAY);
		});
		ui.jobSelect.addEventListener('change', () => {
			boardState.job = ui.jobSelect.value;
			paintBoard();
		});
		ui.stageChips.addEventListener('change', (event) => {
			if (!event.target.matches('input[name="rcStage"]')) return;
			boardState.stage = event.target.value;
			for (const column of pickAll('.rc-col', ui.board)) {
				column.classList.toggle('is-shown', column.getAttribute('data-stage') === boardState.stage);
			}
		});
	}

	/**
	 * A click on a card or row, away from its own controls, follows its name's
	 * link: in a new tab with Cmd, Ctrl, Shift or the middle button, as a link
	 * would. With no link (someone added here) a plain click runs `fallback`.
	 */
	function followLink(event, rowSelector, linkSelector, fallback) {
		const row = event.target.closest(rowSelector);
		if (!row || event.target.closest('a, button') || (event.type === 'auxclick' && event.button !== 1)) return;
		const anchor = pick(`a${linkSelector}`, row);
		if (!anchor) {
			if (event.type === 'click') fallback(row);
			return;
		}
		if (event.type === 'auxclick' || event.metaKey || event.ctrlKey || event.shiftKey)
			window.open(anchor.href, '_blank');
		else location.href = anchor.href;
	}

	/* The panel icon opens the quick view; anywhere else on a card opens the full page, as the name does. */
	function wireBoard() {
		ui.board.addEventListener('click', (event) => {
			if (event.target.closest('[data-rc-reset]')) {
				ui.search.value = '';
				boardState.query = '';
				pickJob('');
				ui.search.focus();
				return;
			}
			const peek = event.target.closest('[data-rc-quick]');
			if (peek) {
				peekAt(peek.closest('.rc-cand'));
				return;
			}
			followLink(event, '.rc-cand', '.rc-cand-name', peekAt);
		});
		ui.board.addEventListener('auxclick', (event) => followLink(event, '.rc-cand', '.rc-cand-name', peekAt));
	}

	function wireDragging() {
		ui.board.addEventListener('dragstart', (event) => {
			const card = event.target.closest('.rc-cand');
			if (!card) return;
			boardState.dragId = card.getAttribute('data-id');
			card.classList.add('is-dragging');
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', boardState.dragId);
		});
		ui.board.addEventListener('dragend', () => {
			boardState.dragId = null;
			for (const node of pickAll('.is-dragging, .is-over', ui.board))
				node.classList.remove('is-dragging', 'is-over');
		});
		ui.board.addEventListener('dragover', (event) => {
			const column = event.target.closest('.rc-col');
			if (!column || !boardState.dragId) return;
			event.preventDefault();
			event.dataTransfer.dropEffect = 'move';
			for (const sibling of pickAll('.rc-col.is-over', ui.board)) {
				if (sibling !== column) sibling.classList.remove('is-over');
			}
			column.classList.add('is-over');
		});
		ui.board.addEventListener('dragleave', (event) => {
			const column = event.target.closest('.rc-col');
			if (column && !column.contains(event.relatedTarget)) column.classList.remove('is-over');
		});
		ui.board.addEventListener('drop', (event) => {
			const column = event.target.closest('.rc-col');
			if (!column || !boardState.dragId) return;
			event.preventDefault();
			const person = pipeline.find((row) => row.id === boardState.dragId);
			boardState.dragId = null;
			if (person) moveAlong(person, column.getAttribute('data-stage'));
		});
	}

	/* The same on the roles table: the panel icon for the quick view, the row for the full page. */
	function wireJobsTable() {
		ui.jobsTable.addEventListener('click', (event) => {
			const peek = event.target.closest('[data-rc-role-open]');
			if (peek) {
				showJob(peek.getAttribute('data-rc-role-open'));
				return;
			}
			followLink(event, 'tr[data-rc-role-id]', '.rc-role-link');
		});
		ui.jobsTable.addEventListener('auxclick', (event) => followLink(event, 'tr[data-rc-role-id]', '.rc-role-link'));
		ui.jobDrawer.addEventListener('hidden.bs.offcanvas', () => {
			openJobKey = null;
			for (const row of pickAll('tr.is-open', ui.jobsTable)) row.classList.remove('is-open');
		});
		pick('[data-rc-v-board]', ui.jobDrawer).addEventListener('click', () => {
			focusBoardOn(openJobKey);
			bootstrap.Offcanvas.getOrCreateInstance(ui.jobDrawer).hide();
		});
	}

	function wireJobForm() {
		fillJobForm();
		const jobForm = ui.jobForm;
		jobForm.addEventListener('submit', openJob);
		jobForm.addEventListener('input', (event) => {
			if (event.target === jobForm.payFrom || event.target === jobForm.payTo) {
				if (!jobForm.payFrom.classList.contains('is-invalid')) return;
				flagField(jobForm.payFrom, false);
				flagField(jobForm.payTo, false);
				ui.payError.hidden = true;
				return;
			}
			if (event.target.classList.contains('is-invalid') && event.target.value.trim())
				flagField(event.target, false);
		});
		jobForm.addEventListener('change', (event) => {
			if ((event.target === jobForm.team || event.target === jobForm.manager) && event.target.value)
				flagField(event.target, false);
			/* A team's lead is the usual hiring manager, so they are offered first. */
			if (event.target !== jobForm.team || !event.target.value || jobForm.manager.value) return;
			const team = STAFF.teamOf(jobForm.team.value);
			const lead = team && STAFF.recordWithId(team.lead);
			if (!lead) return;
			jobForm.manager.value = STAFF.nameOf(lead);
			jobForm.manager.dispatchEvent(new Event('change', { bubbles: true }));
		});
		ui.jobNewDrawer.addEventListener('hidden.bs.offcanvas', clearJobForm);
	}

	function wireRecordDrawer() {
		for (const button of pickAll('[data-rc-r-step]', ui.recordDrawer)) {
			button.addEventListener('click', () => browseBy(+button.getAttribute('data-rc-r-step')));
		}
		ui.recordDrawer.addEventListener('keydown', (event) => {
			if (!event.altKey) return;
			const direction = { ArrowUp: -1, ArrowDown: 1 }[event.key];
			if (!direction) return;
			event.preventDefault();
			browseBy(direction);
		});
		ui.recordDrawer.addEventListener('hidden.bs.offcanvas', () => {
			boardState.openId = null;
		});
		ui.recordDrawer.addEventListener('click', (event) => {
			const button = event.target.closest('[data-rc-act]');
			if (!button) return;
			const person = openApplicant();
			if (button.getAttribute('data-rc-act') === 'reject') {
				askToReject(person);
				return;
			}
			moveAlong(person, STAGE_LIST[stageSlot(person.stage) + 1].key);
			recordHook('title').focus();
		});
	}

	function wireRejectDialog() {
		pick('[data-rc-reject-go]', ui.rejectDialog).addEventListener('click', confirmReject);
		ui.rejectDialog.addEventListener('hidden.bs.modal', () => {
			rejectTarget = null;
			pick('[data-rc-reject-note]', ui.rejectDialog).value = '';
			pick('[data-rc-reject-email]', ui.rejectDialog).checked = true;
		});
	}

	function wireAddForm() {
		ui.addForm.addEventListener('submit', addApplicant);
		ui.addForm.addEventListener('input', (event) => {
			if (event.target.classList.contains('is-invalid') && event.target.value.trim())
				flagField(event.target, false);
		});
		ui.addForm.addEventListener('change', (event) => {
			if (event.target !== ui.addForm.role || !event.target.value) return;
			flagField(event.target, false);
			ui.addJobError.classList.remove('d-block');
		});
		ui.addDrawer.addEventListener('hidden.bs.offcanvas', clearAddForm);
	}

	document.addEventListener('DOMContentLoaded', start);
})();
