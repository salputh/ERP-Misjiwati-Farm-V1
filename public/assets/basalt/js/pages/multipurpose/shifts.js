/**
 * Shifts page (shifts.html), active only where [data-at-root] exists.
 * It draws today's shift board, the people table with its today and
 * six-week views, the chart of absences and late starts per working day,
 * and the person and day side panels.
 *
 * Every number on the page comes out of recordFor(member, isoDay), so the
 * board, the table, the chart and both panels can never disagree. To go
 * live, keep the drawing code, fill the roster in assets/basalt/js/data/multipurpose/people.js
 * and have recordFor() read your time clock instead.
 */
(() => {
	'use strict';

	const stage = pick('[data-at-root]');
	if (!stage) return;

	/* The demo is frozen at 11:40 am on Friday, October 9, 2026. */
	const DEMO_DATE = '2026-10-09';
	const DEMO_MINUTE = 11 * 60 + 40;
	const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const MONTH_NAMES = [
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
	const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

	/* Everyone who has started, read from Fieldline's single roster in
     data/multipurpose/people.js, so names, teams and staff numbers match Employees and
     Time Off. A remote flag means home every day, lateRate is how often
     someone runs late, and time away is the leave Time Off already lists. */
	const roster = window.Basalt.data.people;
	const SHIFT_TIMES = roster.shifts;
	const sourceById = new Map();
	const members = roster.staff.filter(roster.hasStarted).map((source) => {
		const member = {
			id: source.staff,
			name: roster.nameOf(source),
			role: source.title,
			team: source.team,
			shift: source.shift || 'day',
			start: source.start,
		};
		sourceById.set(member.id, source);
		return member;
	});

	/* Today's exceptions are fixed so the page header reads as written. */
	const REMOTE_TODAY = ['Marshall Beck', 'Floyd Rankin', 'Oliver Merritt', 'Casey Martin', 'Laurie Sloan'];
	const LATE_TODAY_MINUTES = { 'Gerald Pritchard': 22, 'Ashley Steele': 14, 'Quentin Cook': 9 };

	const PAST_DAYS = workingDaysBefore(DEMO_DATE, 30);
	const dayCache = new Map();
	const TOTALS = new Map(members.map((member) => [member.id, totalsFor(member)]));

	/* Which of today's records each status tab keeps. */
	const TAB_FILTERS = {
		all: () => true,
		late: arrivedLate,
		remote: (record) => record.kind === 'in' && record.remote,
		away: isOff,
		later: (record) => record.kind === 'later',
	};

	/* Today's table leads with what needs attention: late, then sick, then
     on leave, then everyone in on time, with the late shift last. */
	const URGENCY = { sick: 1, leave: 2, in: 3 };

	const STATUS_PILLS = {
		leave: (record) => ['basalt-status basalt-status-info', htmlSafe(record.reason)],
		sick: () => ['basalt-status basalt-status-danger', 'Out sick'],
		later: () => ['basalt-status', 'Starts 1 pm'],
		in: (record) =>
			record.late
				? ['basalt-status basalt-status-warning', `${record.late} min late`]
				: ['basalt-status basalt-status-success', 'On time'],
	};

	/* The board plots each shift on a 6 am to 9 pm axis. */
	const AXIS_START = 6 * 60;
	const AXIS_END = 21 * 60;
	const HOUR_MARKS = [6, 9, 12, 15, 18, 21];
	const SHIFT_TITLES = { early: 'Early', day: 'Day', late: 'Late' };
	const FACES_PER_LANE = 4;

	const PAGE_SIZE = 10;
	const view = { mode: 'today', tab: 'all', query: '', team: '', order: 'name', expanded: false };
	const VIEW_NOTES = {
		today: 'Everyone on today\u2019s roster, late and away first.',
		weeks: `The last 30 working days, ${shortDate(PAST_DAYS[0])} to ${shortDate(PAST_DAYS.at(-1))}.`,
	};
	const QUIET_DASH = '<span class="at-quiet">—</span>';
	const WEEK_COLUMNS = ['in', 'remote', 'late', 'sick', 'leave'];

	const ui = {
		peopleNote: pick('[data-at-people-desc]', stage),
		tabStrip: pick('[data-at-tabs]', stage),
		tables: { today: pick('[data-at-table="today"]', stage), weeks: pick('[data-at-table="weeks"]', stage) },
		bodies: { today: pick('[data-at-body="today"]', stage), weeks: pick('[data-at-body="weeks"]', stage) },
		orderSelect: pick('[data-at-sort]', stage),
		emptyState: pick('[data-at-empty]', stage),
		footer: pick('[data-at-more]', stage),
		showAllButton: pick('[data-at-more-btn]', stage),
		rangeNote: pick('[data-at-range]', stage),
		plot: pick('[data-at-chart]', stage),
		personPanel: document.getElementById('at-person'),
		dayPanel: document.getElementById('at-day'),
	};

	/* One chart series per kind of trouble, in stacking order. */
	const CHART_SERIES = [
		{ key: 'leave', label: 'On leave', token: '--basalt-info', matches: (record) => record.kind === 'leave' },
		{ key: 'sick', label: 'Out sick', token: '--basalt-danger', matches: (record) => record.kind === 'sick' },
		{ key: 'late', label: 'Late', token: '--basalt-warning', matches: arrivedLate },
	];
	const DAY_SUMMARIES = PAST_DAYS.map(summarizeDay);
	const CHART_FONT = "'Schibsted Grotesk', sans-serif";
	const DAY_KEYS = {
		ArrowLeft: (index) => Math.max(0, index - 1),
		ArrowRight: (index) => Math.min(DAY_SUMMARIES.length - 1, index + 1),
		Home: () => 0,
		End: () => DAY_SUMMARIES.length - 1,
	};
	const EMPTY_DAY_LINES = {
		leave: 'Nobody was on leave.',
		sick: 'Nobody was out sick.',
		late: 'Everyone was in on time.',
	};

	let barChart = null;
	let focusedDay = DAY_SUMMARIES.length - 1;
	let openDayIndex = 0;

	function start() {
		fillTabCounts();
		drawShiftBoard();
		wirePeopleTable();
		wireRowClicks();
		wireAwayChart();
		wireDayPanel();
		wireDownloads();
		ui.peopleNote.textContent = VIEW_NOTES.today;
		renderPeople();
	}

	/* Everything starts from one person on one day. */

	/**
	 * Past days come from the shared time clock (roster.workday), seeded by
	 * person and date, so this page and each person's own page always agree.
	 * Today is worked out here, up to the current minute. Results are cached.
	 */
	function recordFor(member, isoDay) {
		const cacheKey = `${member.id}${isoDay}`;
		if (!dayCache.has(cacheKey)) dayCache.set(cacheKey, buildRecord(member, isoDay, cacheKey));
		return dayCache.get(cacheKey);
	}

	function buildRecord(member, isoDay, seedKey) {
		if (isoDay < member.start) return { kind: 'none' };
		const source = sourceById.get(member.id);
		if (isoDay !== DEMO_DATE) return roster.workday(source, isoDay);

		const absence = roster.awayOn(source, isoDay);
		if (absence)
			return {
				kind: absence.type === 'sick' ? 'sick' : 'leave',
				reason: absence.reason,
				from: absence.from,
				to: absence.to,
			};
		if (member.shift === 'late') return { kind: 'later' };

		const shiftStart = SHIFT_TIMES[member.shift].start;
		const roll = seededRandom(roster.hash(seedKey));
		const lateBy = LATE_TODAY_MINUTES[member.name] || 0;
		return {
			kind: 'in',
			remote: Boolean(source.remote) || REMOTE_TODAY.includes(member.name),
			late: lateBy,
			inAt: lateBy ? shiftStart + lateBy : shiftStart - 2 - Math.floor(roll() * 21),
			outAt: null,
		};
	}

	/** A repeatable stream of fractions in [0, 1) from a 32-bit seed. */
	function seededRandom(seed) {
		let state = seed;
		return function roll() {
			state |= 0;
			state = (state + 0x6d2b79f5) | 0;
			let bits = Math.imul(state ^ (state >>> 15), 1 | state);
			bits = (bits + Math.imul(bits ^ (bits >>> 7), 61 | bits)) ^ bits;
			return ((bits ^ (bits >>> 14)) >>> 0) / 4294967296;
		};
	}

	function todayOf(member) {
		return recordFor(member, DEMO_DATE);
	}

	function arrivedLate(record) {
		return record.kind === 'in' && record.late > 0;
	}

	function isOff(record) {
		return record.kind === 'leave' || record.kind === 'sick';
	}

	/** Counts of each kind of day across the six-week window, skipping days before a start date. */
	function totalsFor(member) {
		const totals = { days: 0, in: 0, remote: 0, late: 0, sick: 0, leave: 0 };
		for (const isoDay of PAST_DAYS) {
			const record = recordFor(member, isoDay);
			if (record.kind === 'none') continue;
			totals.days += 1;
			if (record.kind !== 'in') {
				totals[record.kind] += 1;
				continue;
			}
			totals.in += 1;
			if (record.remote) totals.remote += 1;
			if (record.late) totals.late += 1;
		}
		return totals;
	}

	/* The tab counts and today's board draw once, on load. */

	function fillTabCounts() {
		for (const [tab, keeps] of Object.entries(TAB_FILTERS)) {
			pick(`[data-at-count="${tab}"]`, stage).textContent = members.filter((member) =>
				keeps(todayOf(member)),
			).length;
		}
	}

	/* Each bar is a shift, its darker share the time worked so far, and the
     faces are who is in, late arrivals first. The board is a size
     container: on a narrow card a lane's name and count sit above a
     full-width bar. */
	function drawShiftBoard() {
		const shiftBoard = pick('[data-at-board]', stage);
		shiftBoard.style.setProperty('--at-now', ((DEMO_MINUTE - AXIS_START) / (AXIS_END - AXIS_START)).toFixed(4));
		pick('[data-at-board-desc]', stage).textContent = `${longDate(DEMO_DATE)}, updated ${clockLabel(DEMO_MINUTE)}.`;
		pick('[data-at-axis]', shiftBoard).innerHTML = axisHtml();
		pick('[data-at-lanes]', shiftBoard).innerHTML = Object.keys(SHIFT_TIMES).map(laneHtml).join('');
		window.Basalt.avatars?.(shiftBoard);
	}

	/* Hour marks too close to the current-time label are dropped. */
	function axisHtml() {
		const marks = HOUR_MARKS.filter((hour) => Math.abs(hour * 60 - DEMO_MINUTE) >= 50).map((hour) =>
			tickHtml('at-board-tick', hour * 60, hourLabel(hour)),
		);
		marks.push(tickHtml('at-board-tick at-board-tick-now', DEMO_MINUTE, clockLabel(DEMO_MINUTE)));
		return `<span class="at-board-track">${marks.join('')}</span>`;
	}

	function tickHtml(classes, minute, label) {
		return `<span class="${classes}" style="--at-x:${axisPercent(minute)}">${label}</span>`;
	}

	function laneHtml(shiftKey) {
		const times = SHIFT_TIMES[shiftKey];
		const crew = members.filter((member) => member.shift === shiftKey);
		const underway = DEMO_MINUTE >= times.start;
		const present = crew
			.filter((member) => !underway || todayOf(member).kind === 'in')
			.sort((a, b) => arrivedLate(todayOf(b)) - arrivedLate(todayOf(a)) || a.name.localeCompare(b.name));
		const faces = present.slice(0, FACES_PER_LANE);
		const hidden = present.length - faces.length;
		const worked = Math.min(1, Math.max(0, (DEMO_MINUTE - times.start) / (times.end - times.start)));
		const barStyle = `--at-x:${axisPercent(times.start)};--at-w:${axisPercent(AXIS_START + times.end - times.start)};--at-done:${(worked * 100).toFixed(1)}%`;
		const { headline, detail } = laneSummary(times, crew);
		const overflow =
			hidden > 0
				? `<span class="basalt-avatar basalt-avatar-xs basalt-avatar-more" title="${countOf(hidden, 'more person', 'more people')}">+${hidden}</span>`
				: '';

		return (
			`<li class="at-lane at-lane-${shiftKey}">` +
			`<div class="at-lane-name"><span class="at-lane-title">${SHIFT_TITLES[shiftKey]} shift</span><span class="at-lane-hours">${times.label}</span></div>` +
			`<div class="at-board-track"><div class="at-lane-bar${underway ? '' : ' is-ahead'}" style="${barStyle}">` +
			`<span class="basalt-avatar-group basalt-avatar-group-sm at-lane-faces">${faces.map(faceButtonHtml).join('')}${overflow}</span>` +
			'</div></div>' +
			`<p class="at-lane-sum"><span class="at-lane-big">${headline}</span><span class="at-lane-small">${detail}</span></p>` +
			'</li>'
		);
	}

	function faceButtonHtml(member) {
		const name = htmlSafe(member.name);
		return `<button type="button" class="basalt-avatar basalt-avatar-xs" data-basalt-avatar data-name="${name}" data-at-open="${member.id}" aria-label="Quick view of ${name}" title="${name}"></button>`;
	}

	/** The lane's right-hand count: who is in and what is wrong, or when it starts. */
	function laneSummary(times, crew) {
		if (DEMO_MINUTE < times.start) {
			return {
				headline: `<strong>${crew.length}</strong> on the roster`,
				detail: `Starts in ${minutesInWords(times.start - DEMO_MINUTE)}`,
			};
		}
		const records = crew.map(todayOf);
		const lateCount = records.filter(arrivedLate).length;
		const offCount = records.filter(isOff).length;
		const notes = [lateCount && `${lateCount} late`, offCount && `${offCount} away`].filter(Boolean);
		return {
			headline: `<strong>${records.filter((record) => record.kind === 'in').length} of ${crew.length}</strong> in`,
			detail: notes.join(' · ') || 'Everyone on time',
		};
	}

	function axisPercent(minute) {
		return `${(((minute - AXIS_START) / (AXIS_END - AXIS_START)) * 100).toFixed(2)}%`;
	}

	/* The people table redraws whenever a view, tab, search or team changes. */

	function wirePeopleTable() {
		for (const radio of pickAll('input[name="at-view"]', stage)) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				view.mode = radio.value;
				view.expanded = false;
				ui.peopleNote.textContent = VIEW_NOTES[view.mode];
				ui.tabStrip.hidden = view.mode !== 'today';
				ui.orderSelect.hidden = view.mode !== 'weeks';
				renderPeople();
			});
		}

		for (const tab of pickAll('[data-at-tab]', stage)) {
			tab.addEventListener('shown.bs.tab', () => {
				view.tab = tab.getAttribute('data-at-tab');
				view.expanded = false;
				pick('#at-list').setAttribute('aria-labelledby', tab.id);
				renderPeople();
			});
		}

		const searchBox = pick('[data-at-search]', stage);
		const teamSelect = pick('[data-at-team]', stage);
		let searchDelay;
		searchBox.addEventListener('input', (event) => {
			clearTimeout(searchDelay);
			searchDelay = setTimeout(() => narrowTo({ query: event.target.value }), 150);
		});
		teamSelect.addEventListener('change', (event) => narrowTo({ team: event.target.value }));
		ui.orderSelect.addEventListener('change', (event) => {
			view.order = event.target.value;
			renderPeople();
		});

		/* Show all keeps the reader's place: focus lands on the first new name. */
		ui.showAllButton.addEventListener('click', () => {
			const alreadyShown = ui.bodies[view.mode].children.length;
			window.Basalt.slide(ui.tables[view.mode].parentElement, () => {
				view.expanded = true;
				renderPeople();
			});
			ui.bodies[view.mode].children[alreadyShown]?.querySelector('.at-who-name')?.focus({ preventScroll: true });
		});

		pick('[data-at-clear]', stage).addEventListener('click', () => {
			searchBox.value = '';
			teamSelect.value = '';
			window.Basalt.select?.refresh?.(teamSelect);
			view.query = '';
			view.team = '';
			renderPeople();
			searchBox.focus();
		});
	}

	/* A new search or team folds the list back to its first page. */
	function narrowTo(changes) {
		Object.assign(view, changes, { expanded: false });
		renderPeople();
	}

	function renderPeople() {
		const matches = matchingPeople();
		const listed = view.expanded ? matches : matches.slice(0, PAGE_SIZE);
		const tbody = ui.bodies[view.mode];
		ui.bodies[view.mode === 'today' ? 'weeks' : 'today'].innerHTML = '';
		tbody.innerHTML = listed.map(view.mode === 'today' ? todayRowHtml : weeksRowHtml).join('');
		window.Basalt.avatars?.(tbody);
		window.Basalt.tips?.(tbody);

		for (const [mode, table] of Object.entries(ui.tables)) table.hidden = mode !== view.mode;
		ui.tables[view.mode].classList.toggle('is-empty', !matches.length);
		ui.emptyState.hidden = matches.length > 0;
		ui.footer.hidden = !matches.length;

		const everyone = countOf(matches.length, 'person', 'people');
		ui.rangeNote.innerHTML =
			matches.length > listed.length ? `Showing <strong>${listed.length}</strong> of ${everyone}` : everyone;
		ui.showAllButton.hidden = matches.length <= listed.length;
		ui.showAllButton.textContent = `Show all ${matches.length}`;
	}

	function matchingPeople() {
		const query = view.query.trim();
		const pool = members.filter(
			(member) =>
				(!view.team || member.team === view.team) &&
				(!query || window.Basalt.matchesQuery(`${member.name} ${member.role}`, query)),
		);

		if (view.mode === 'today') {
			return pool
				.filter((member) => TAB_FILTERS[view.tab](todayOf(member)))
				.sort((a, b) => urgencyOf(todayOf(a)) - urgencyOf(todayOf(b)) || compareNames(a, b));
		}
		if (view.order === 'name') return pool.sort(compareNames);
		return pool.sort((a, b) => TOTALS.get(b.id)[view.order] - TOTALS.get(a.id)[view.order] || compareNames(a, b));
	}

	function urgencyOf(record) {
		return arrivedLate(record) ? 0 : (URGENCY[record.kind] ?? 4);
	}

	function compareNames(a, b) {
		return a.name.localeCompare(b.name);
	}

	function todayRowHtml(member) {
		const record = todayOf(member);
		const present = record.kind === 'in';
		return (
			`<tr data-at-row="${member.id}">` +
			`<td>${personCellHtml(member)}</td>` +
			`<td data-at-cell="team">${htmlSafe(member.team)}</td>` +
			`<td data-at-cell="shift"><span class="at-shift at-shift-${member.shift}">${SHIFT_TIMES[member.shift].label}</span></td>` +
			`<td data-at-cell="in">${present ? clockLabel(record.inAt) : QUIET_DASH}</td>` +
			`<td data-at-cell="where">${present ? (record.remote ? 'Remote' : 'Office') : QUIET_DASH}</td>` +
			`<td data-at-cell="status">${statusPillHtml(record)}</td>` +
			`<td class="text-end" data-at-cell="go">${rowActionsHtml(member)}</td>` +
			'</tr>'
		);
	}

	function weeksRowHtml(member) {
		const totals = TOTALS.get(member.id);
		return (
			`<tr data-at-row="${member.id}">` +
			`<td>${personCellHtml(member)}</td>` +
			`<td data-at-cell="team">${htmlSafe(member.team)}</td>${WEEK_COLUMNS.map((column) =>
				countCellHtml(totals[column], column),
			).join('')}<td class="text-end" data-at-cell="go">${rowActionsHtml(member)}</td>` +
			`</tr>`
		);
	}

	/* A zero is drawn as a quiet dash so the counts that matter stand out. */
	function countCellHtml(amount, column) {
		const opening = `<td class="text-end at-num" data-at-cell="${column}"`;
		if (amount) return `${opening}>${amount}</td>`;
		return `${opening} data-zero><span aria-hidden="true">–</span><span class="visually-hidden">0</span></td>`;
	}

	function personCellHtml(member) {
		return (
			`<div class="at-who-id">${avatarHtml(member)}<div class="at-who-text">` +
			`<a class="at-who-name" href="${profileHref(member)}">${htmlSafe(member.name)}</a>` +
			`<span class="at-who-role">${htmlSafe(member.role)}</span></div></div>`
		);
	}

	function avatarHtml(member) {
		return `<span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(member.name)}" aria-hidden="true"></span>`;
	}

	function rowActionsHtml(member) {
		const name = htmlSafe(member.name);
		return (
			'<span class="basalt-row-actions">' +
			`<button type="button" class="btn btn-icon btn-sm" data-at-open="${member.id}" aria-label="Quick view: ${name}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>` +
			`<a class="btn btn-icon btn-sm" href="${profileHref(member)}" aria-label="Open full page: ${name}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>` +
			'</span>'
		);
	}

	function statusPillHtml(record) {
		const [classes, label] = (STATUS_PILLS[record.kind] || STATUS_PILLS.in)(record);
		return `<span class="${classes}">${label}</span>`;
	}

	function profileHref(member) {
		return `employee-details.html?id=${encodeURIComponent(member.id)}`;
	}

	/* Row clicks lead to the full page or to the person panel. */

	function wireRowClicks() {
		stage.addEventListener('click', followRow);
		stage.addEventListener('auxclick', (event) => {
			if (event.button === 1 && !event.target.closest('button')) followRow(event);
		});
	}

	/* A row behaves like its name link and opens the full page, in a new tab
     with Cmd or Ctrl held or on a middle click. Only the panel icon, or a
     face on the board, opens the quick view. */
	function followRow(event) {
		const opener = event.target.closest('[data-at-open]');
		if (opener) {
			showPerson(opener.getAttribute('data-at-open'));
			return;
		}
		const row = event.target.closest('[data-at-row]');
		if (!row || event.target.closest('a, button, input, select')) return;
		const destination = pick('.at-who-name', row).href;
		if (event.metaKey || event.ctrlKey || event.button === 1) window.open(destination, '_blank', 'noopener');
		else location.href = destination;
	}

	function showPerson(staffId) {
		const member = members.find((candidate) => candidate.id === staffId);
		if (!member) return;
		const record = todayOf(member);
		const portrait = personField('avatar');
		portrait.setAttribute('data-name', member.name);
		portrait.textContent = '';
		window.Basalt.avatar?.(portrait);

		personField('name').textContent = member.name;
		personField('sub').textContent = `${member.role} · ${member.team}`;
		personField('status').innerHTML = statusPillHtml(record);
		personField('today').textContent = todaySentence(member, record);
		personField('summary').textContent = sixWeekSentence(TOTALS.get(member.id));
		personField('strip').innerHTML = PAST_DAYS.map((isoDay) =>
			stripDayHtml(isoDay, recordFor(member, isoDay)),
		).join('');
		personField('from').textContent = shortDate(PAST_DAYS[0]);
		personField('to').textContent = shortDate(PAST_DAYS.at(-1));
		personField('days').innerHTML = [DEMO_DATE, ...PAST_DAYS.slice(-4).reverse()]
			.map((isoDay) => clockInRowHtml(isoDay, recordFor(member, isoDay)))
			.join('');
		personField('profile').setAttribute('href', profileHref(member));
		window.bootstrap.Offcanvas.getOrCreateInstance(ui.personPanel).show();
	}

	function personField(name) {
		return pick(`[data-at-p="${name}"]`, ui.personPanel);
	}

	function todaySentence(member, record) {
		if (record.kind === 'leave')
			return `On ${record.reason.toLowerCase()}${record.to === DEMO_DATE ? ' today.' : ` until ${longDate(record.to)}.`}`;
		if (record.kind === 'sick') return `Out sick since ${longDate(record.from)}.`;
		if (record.kind === 'later') return `On the late shift today, ${shiftHours(member)}.`;
		const place = record.remote ? ' from home' : ' at the office';
		const arrived = `Clocked in${place} at ${clockLabel(record.inAt)}`;
		if (!record.late) return `${arrived} for the ${shiftHours(member)} shift.`;
		const startsAt = clockLabel(SHIFT_TIMES[member.shift].start).replace(':00', '');
		return `${arrived}, ${record.late} minutes after the ${startsAt} start.`;
	}

	/* Shift hours with unbreakable spaces, so "9 am – 5 pm" never wraps. */
	function shiftHours(member) {
		return SHIFT_TIMES[member.shift].label.replace(/ /g, '\u00a0');
	}

	function sixWeekSentence(totals) {
		let remoteNote = '';
		if (totals.remote)
			remoteNote = totals.remote === totals.in ? ', all of them remote' : `, ${totals.remote} of them remote`;
		const sinceStart = totals.days < PAST_DAYS.length ? ' since starting' : '';
		const opening = `In on ${totals.in} of ${totals.days} working days${remoteNote}${sinceStart}.`;
		const lapses = [
			totals.late && `late ${howOften(totals.late)}`,
			totals.sick && `out sick for ${countOf(totals.sick, 'day')}`,
			totals.leave && `on leave for ${countOf(totals.leave, 'day')}`,
		].filter(Boolean);
		if (!lapses.length) return `${opening} Never late, never off.`;
		const rest = joinWithAnd(lapses);
		return `${opening} ${rest.charAt(0).toUpperCase()}${rest.slice(1)}.`;
	}

	/** One square of the 30-day strip; the word for the day lives in its tooltip. */
	function stripDayHtml(isoDay, record) {
		const [tone, word] = stripTone(record);
		return `<li class="at-strip-day at-strip-day-${tone}" title="${weekdayDate(isoDay)}: ${htmlSafe(word)}"></li>`;
	}

	function stripTone(record) {
		if (record.kind === 'none') return ['none', 'Before the first day'];
		if (record.kind === 'sick') return ['sick', 'Out sick'];
		if (record.kind === 'leave') return ['leave', record.reason];
		if (record.late) return ['late', `${record.late} min late`];
		return ['in', record.remote ? 'In, remote' : 'In'];
	}

	function clockInRowHtml(isoDay, record) {
		const present = record.kind === 'in';
		let headline = record.reason;
		let footnote = '';
		if (present) {
			headline = `${clockLabel(record.inAt)} – ${record.outAt ? clockLabel(record.outAt) : 'still in'}`;
			footnote = [
				record.outAt && hoursWorked(record.outAt - record.inAt),
				record.remote && 'Remote',
				record.late && `${record.late} min late`,
			]
				.filter(Boolean)
				.join(' · ');
		} else if (record.kind === 'later') {
			headline = 'Starts at 1:00 pm';
		}
		const awayClass = present || record.kind === 'later' ? '' : ' is-away';
		return (
			'<li class="at-days-row">' +
			`<span class="at-days-date">${isoDay === DEMO_DATE ? 'Today' : weekdayDate(isoDay)}</span>` +
			`<span class="at-days-what${awayClass}">${htmlSafe(headline)}</span>` +
			`<span class="at-days-note">${htmlSafe(footnote)}</span>` +
			'</li>'
		);
	}

	/* The chart shows who was away or late on each working day. */

	/** Who was in, and who fell under each chart series, on one working day. */
	function summarizeDay(isoDay) {
		const entries = members.map((member) => ({ member, record: recordFor(member, isoDay) }));
		const summary = { day: isoDay, in: 0, remote: 0 };
		for (const { record } of entries) {
			if (record.kind !== 'in') continue;
			summary.in += 1;
			if (record.remote) summary.remote += 1;
		}
		for (const series of CHART_SERIES) summary[series.key] = entries.filter(({ record }) => series.matches(record));
		return summary;
	}

	/* The chart is built once it scrolls near view, and rebuilt in the new
     colors after a theme change. */
	function wireAwayChart() {
		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() => {
				if (barChart) buildBarChart(false);
			});
		});

		const { plot } = ui;
		if (!plot) return;
		const inTotal = DAY_SUMMARIES.reduce((sum, summary) => sum + summary.in, 0);
		plot.setAttribute(
			'aria-label',
			`Bar chart of people on leave, out sick or late on each of the last ${DAY_SUMMARIES.length} working days. On an average day ${Math.round(inTotal / DAY_SUMMARIES.length)} of ${members.length} people were in.`,
		);
		plot.addEventListener('keydown', moveThroughDays);
		plot.addEventListener('focus', () => {
			if (plot.matches(':focus-visible')) highlightFocusedDay();
		});
		plot.addEventListener('blur', () => {
			if (barChart) setChartFocus([]);
		});

		if (!('IntersectionObserver' in window)) {
			buildBarChart(false);
			return;
		}
		const watcher = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watcher.disconnect();
				buildBarChart(true);
			},
			{ rootMargin: '80px 0px' },
		);
		watcher.observe(plot);
	}

	/* Arrows, Home and End walk the days and read each one out; Enter or
     Space opens the focused day. */
	function moveThroughDays(event) {
		if (!barChart) return;
		if (Object.hasOwn(DAY_KEYS, event.key)) {
			event.preventDefault();
			focusedDay = DAY_KEYS[event.key](focusedDay);
			highlightFocusedDay();
			window.Basalt.announce?.(weekdayDate(DAY_SUMMARIES[focusedDay].day));
		} else if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openDay(focusedDay);
		}
	}

	function highlightFocusedDay() {
		if (!barChart) return;
		setChartFocus(CHART_SERIES.map((series, datasetIndex) => ({ datasetIndex, index: focusedDay })));
	}

	function setChartFocus(points) {
		barChart.setActiveElements(points);
		barChart.tooltip.setActiveElements(points, { x: 0, y: 0 });
		barChart.update('none');
	}

	function buildBarChart(animate) {
		if (typeof Chart === 'undefined' || !ui.plot) return;
		barChart?.destroy();
		const ink = themeToken('--basalt-copy', '#12233a');
		const tickInk = themeToken('--basalt-copy-body', '#40546b');
		const rule = themeToken('--basalt-edge', 'rgba(16, 42, 72, .08)');
		const tickStyle = { color: tickInk, font: { family: CHART_FONT, size: 11.5 }, padding: 6 };

		barChart = new Chart(ui.plot, {
			type: 'bar',
			data: {
				labels: DAY_SUMMARIES.map((summary) => shortDate(summary.day)),
				datasets: CHART_SERIES.map((series) => ({
					label: series.label,
					data: DAY_SUMMARIES.map((summary) => summary[series.key].length),
					backgroundColor: themeToken(series.token, '#4071f1'),
					borderColor: themeToken('--basalt-plane', '#ffffff'),
					borderWidth: { top: 2 },
					borderRadius: 3,
					borderSkipped: 'bottom',
					maxBarThickness: 22,
					stack: 'day',
				})),
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: animate && !lessMotion.matches ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				onHover: (event, hits) => {
					ui.plot.style.cursor = hits.length ? 'pointer' : '';
				},
				onClick: (event, hits) => {
					if (!hits.length) return;
					focusedDay = hits[0].index;
					openDay(focusedDay);
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: themeToken('--basalt-plane', '#ffffff'),
						titleColor: ink,
						bodyColor: ink,
						borderColor: themeToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
						borderWidth: 1,
						padding: 10,
						cornerRadius: 8,
						boxPadding: 4,
						usePointStyle: true,
						titleFont: { family: CHART_FONT, size: 12, weight: '600' },
						bodyFont: { family: CHART_FONT, size: 12 },
						callbacks: {
							title: (items) => weekdayDate(DAY_SUMMARIES[items[0].dataIndex].day),
							label: (context) => ` ${context.dataset.label}: ${context.parsed.y}`,
						},
					},
				},
				scales: {
					x: {
						stacked: true,
						grid: { display: false },
						border: { display: false },
						ticks: { maxRotation: 0, autoSkipPadding: 18, ...tickStyle },
					},
					y: {
						stacked: true,
						beginAtZero: true,
						suggestedMax: 8,
						grid: { color: rule },
						border: { display: false },
						ticks: { precision: 0, maxTicksLimit: 5, ...tickStyle },
					},
				},
			},
		});
	}

	function themeToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/* The day panel lists the names behind one bar; the downloads only confirm. */

	function wireDayPanel() {
		for (const radio of pickAll('input[name="at-day-kind"]', ui.dayPanel)) {
			radio.addEventListener('change', () => {
				if (radio.checked) listDayPeople(radio.value);
			});
		}
	}

	/**
	 * Fills the day panel for one chart bar and opens on the first kind that
	 * has anyone in it; checking that radio draws the list through its
	 * change listener.
	 */
	function openDay(index) {
		openDayIndex = index;
		const summary = DAY_SUMMARIES[index];
		const tallies = Object.fromEntries(CHART_SERIES.map(({ key }) => [key, summary[key].length]));
		dayField('title').textContent = longDate(summary.day);
		dayField('sub').textContent = `${summary.in} of ${members.length} in · ${summary.remote} remote`;
		const facts = [
			tallies.leave && `${tallies.leave} on leave`,
			tallies.sick && `${tallies.sick} out sick`,
			tallies.late && `${tallies.late} late`,
		].filter(Boolean);
		dayField('lead').textContent = facts.length ? `${joinWithAnd(facts)}.` : 'Everyone was in, on time.';

		for (const { key } of CHART_SERIES) pick(`[data-at-d-count="${key}"]`, ui.dayPanel).textContent = tallies[key];

		const opening = CHART_SERIES.find(({ key }) => tallies[key]) || CHART_SERIES[0];
		const radio = pick(`input[name="at-day-kind"][value="${opening.key}"]`, ui.dayPanel);
		radio.checked = true;
		radio.dispatchEvent(new Event('change', { bubbles: true }));
		window.bootstrap.Offcanvas.getOrCreateInstance(ui.dayPanel).show();
	}

	function listDayPeople(kind) {
		const entries = DAY_SUMMARIES[openDayIndex][kind];
		const nameList = dayField('list');
		nameList.innerHTML = entries.length
			? entries
					.map(({ member, record }) =>
						dayPersonHtml(
							member,
							kind === 'late'
								? `In at ${clockLabel(record.inAt)} · ${record.late} min late`
								: record.reason,
						),
					)
					.join('')
			: `<li class="at-who-none">${EMPTY_DAY_LINES[kind]}</li>`;
		window.Basalt.avatars?.(nameList);
	}

	function dayPersonHtml(member, detail) {
		return (
			`<li class="at-who-row"><div class="at-who-id">${avatarHtml(member)}<div class="at-who-text">` +
			`<span class="at-who-label">${htmlSafe(member.name)}</span><span class="at-who-role">${htmlSafe(member.team)}</span>` +
			`</div></div><span class="at-who-detail">${htmlSafe(detail)}</span></li>`
		);
	}

	function dayField(name) {
		return pick(`[data-at-d="${name}"]`, ui.dayPanel);
	}

	function wireDownloads() {
		pick('[data-at-export]', stage).addEventListener('click', () =>
			window.Basalt.toasts?.push({
				tone: 'success',
				title: 'Timesheet downloaded',
				text: `${countOf(members.length, 'person', 'people')}, ${shortDate(PAST_DAYS[0])} to ${shortDate(DEMO_DATE)}, as a CSV file.`,
			}),
		);
		pick('[data-at-d-download]', ui.dayPanel).addEventListener('click', () =>
			window.Basalt.toasts?.push({
				tone: 'success',
				title: 'Day downloaded',
				text: `Clock-ins for ${longDate(DAY_SUMMARIES[openDayIndex].day)}, as a CSV file.`,
			}),
		);
	}

	/* Dates and times are formatted the same way everywhere on the page. */

	function localDay(isoDay) {
		return window.Basalt.toLocalDay(isoDay);
	}

	function isoDate(date) {
		return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
	}

	/** The `count` weekdays before `isoDay`, oldest first. */
	function workingDaysBefore(isoDay, count) {
		const cursor = localDay(isoDay);
		const found = [];
		while (found.length < count) {
			cursor.setDate(cursor.getDate() - 1);
			const weekday = cursor.getDay();
			if (weekday !== 0 && weekday !== 6) found.unshift(isoDate(cursor));
		}
		return found;
	}

	function shortDate(isoDay) {
		const date = localDay(isoDay);
		return `${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
	}

	function weekdayDate(isoDay) {
		return `${WEEKDAY_NAMES[localDay(isoDay).getDay()].slice(0, 3)} ${shortDate(isoDay)}`;
	}

	function longDate(isoDay) {
		const date = localDay(isoDay);
		return `${WEEKDAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
	}

	/* Minutes after midnight become "9:05 am", with a no-break space before am or pm. */
	function clockLabel(minute) {
		const hour = Math.floor(minute / 60);
		return `${twelveHour(hour)}:${twoDigits(minute % 60)}${meridiem(hour)}`;
	}

	function hourLabel(hour) {
		return `${twelveHour(hour)}${meridiem(hour)}`;
	}

	function twelveHour(hour) {
		return ((hour + 11) % 12) + 1;
	}

	function meridiem(hour) {
		return hour < 12 ? '\u00a0am' : '\u00a0pm';
	}

	function hoursWorked(minutes) {
		return `${Math.floor(minutes / 60)}h ${twoDigits(minutes % 60)}m`;
	}

	/** "1 h 20 min", "2 h" or "45 min", with no-break spaces inside each part. */
	function minutesInWords(minutes) {
		const hours = Math.floor(minutes / 60);
		const rest = minutes % 60;
		return [hours && `${hours}\u00a0h`, rest && `${rest}\u00a0min`].filter(Boolean).join(' ');
	}

	/* Small helpers for words and markup. */

	function countOf(amount, singular, pluralForm = `${singular}s`) {
		return `${amount} ${amount === 1 ? singular : pluralForm}`;
	}

	function howOften(amount) {
		return { 1: 'once', 2: 'twice' }[amount] ?? `${amount} times`;
	}

	function joinWithAnd(items) {
		return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0];
	}

	function twoDigits(value) {
		return String(value).padStart(2, '0');
	}

	function htmlSafe(text) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(text).replace(/[&<>"']/g, (character) => entities[character]);
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	start();
})();
