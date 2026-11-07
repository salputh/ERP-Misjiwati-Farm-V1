/**
 * Time Off (time-off.html). Fieldline's time-off requests: the
 * ones waiting for a decision with the checks behind each, a four-week
 * grid of who is away, days taken this year by kind, and a drawer that
 * books time off for someone. Built on the shared tabs, styled selects,
 * choice tiles, avatars, status pills, empty states, record drawer and
 * toasts from basalt.js; the roster comes from assets/basalt/js/data/multipurpose/people.js.
 */
(() => {
	'use strict';

	/* The clock and the policy numbers. In your app these come from the
     server and the calendar. */
	const CLOCK = '2026-10-09';
	const GRID_FROM = '2026-10-05';
	const GRID_LENGTH = 20;
	const SIGNED_IN = 'John Armstrong';
	const CROWDED_AT = 4;
	const VACATION_NOTICE = 10;
	const COVER_OVER = 5;
	const FIRST_NEW_NUMBER = 453;
	const SEARCH_DELAY_MS = 150;

	/* Each kind of leave has a label, an icon and, for some, a yearly
     allowance in days. Its color is set in CSS from data-type. */
	const LEAVE_KINDS = {
		annual: { label: 'Vacation', icon: 'bi-sun', allowance: 25 },
		study: { label: 'Study', icon: 'bi-mortarboard', allowance: 5 },
		parental: { label: 'Parental', icon: 'bi-balloon-heart' },
		sick: { label: 'Sick', icon: 'bi-thermometer-half', allowance: 12 },
		unpaid: { label: 'Unpaid', icon: 'bi-hourglass-split' },
		bereavement: { label: 'Bereavement', icon: 'bi-flower1' },
	};

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
	const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	/* What each tab says under the card title, and what it shows when it
     has nothing to list. */
	const TAB_WORDING = {
		waiting: { line: 'waiting for you, oldest first', none: 'Nothing is waiting for you.' },
		approved: { line: 'approved, the soonest first', none: 'Nothing approved yet.' },
		declined: { line: 'declined in the last few weeks', none: 'Nothing declined lately.' },
	};
	const TAB_EMPTY = {
		waiting: {
			icon: 'bi-check2-all',
			tone: 'success',
			title: 'All decided',
			text: 'New requests show up here as people send them.',
		},
		approved: {
			icon: 'bi-calendar-check',
			tone: 'muted',
			title: 'Nothing approved',
			text: 'Requests you approve are listed here.',
		},
		declined: {
			icon: 'bi-calendar-x',
			tone: 'muted',
			title: 'Nothing declined',
			text: 'Requests you decline are listed here with your note.',
		},
	};
	const CLOSE_BUTTON =
		'<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="offcanvas">Close</button>';

	/* The roster is the one in data/multipurpose/people.js, so names, teams, colors and
     staff numbers match Employees and Payroll. `used` is the days of each
     allowance already taken or approved this year; waiting requests are
     not in it yet. */
	const roster = window.Basalt.data.people;
	const teamById = Object.fromEntries(roster.teams.map((team) => [team.id, { name: team.id, tone: team.tone }]));
	const onPayroll = roster.staff.filter(roster.hasStarted);
	const staff = onPayroll.map((who) => ({
		id: who.staff,
		first: who.first,
		last: who.last,
		team: who.team,
		role: who.title,
		used: { ...who.used },
	}));

	/* Every request from the last few weeks and the ones booked ahead,
     shared with HR and each person's own page. A request waits until
     someone approves or declines it. */
	const requests = roster.timeOff.map(requestFromRoster);
	const daysTakenByKind = tallyDaysTaken();
	const gridDays = buildGrid();

	const view = { tab: 'waiting', query: '', kind: '', openId: null, asking: null };
	let nextNewNumber = FIRST_NEW_NUMBER;
	let drawerQueue = [];

	const dom = {
		calendar: pick('[data-lv-cal]'),
		calendarScroll: pick('[data-lv-cal-scroll]'),
		tableBody: pick('[data-lv-rows]'),
		tableWrap: pick('[data-lv-table-wrap]'),
		emptySlot: pick('[data-lv-empty]'),
		caption: pick('[data-lv-caption]'),
		requestsSub: pick('[data-lv-req-sub]'),
		tabRadios: pick('[data-lv-tabs]'),
		searchBox: pick('[data-lv-search]'),
		kindSelect: pick('[data-lv-type]'),
		drawer: pick('#lv-record'),
		askForm: pick('[data-lv-ask]'),
		askText: pick('[data-lv-ask-text]'),
		askLabel: pick('[data-lv-ask-label]'),
		booking: pick('[data-lv-form]'),
		bookingDrawer: pick('#lv-new'),
	};

	/**
	 * Wires the page once the markup is there, then draws every card.
	 */
	function start() {
		wireRequestList();
		wireDrawer();
		wireBooking();
		drawDaysTaken();
		redrawAll();
		updateBookingHints();
	}

	function wireRequestList() {
		dom.tabRadios.addEventListener('change', (event) => {
			if (!event.target.matches('input[name="lvView"]')) return;
			view.tab = event.target.value;
			drawTable();
		});

		let pendingSearch;
		dom.searchBox.addEventListener('input', () => {
			clearTimeout(pendingSearch);
			pendingSearch = setTimeout(() => {
				view.query = dom.searchBox.value.trim();
				drawTable();
			}, SEARCH_DELAY_MS);
		});

		dom.kindSelect.addEventListener('change', () => {
			view.kind = dom.kindSelect.value;
			drawTable();
		});

		dom.emptySlot.addEventListener('click', (event) => {
			if (!event.target.closest('[data-lv-reset]')) return;
			dom.searchBox.value = '';
			dom.kindSelect.value = '';
			dom.kindSelect.dispatchEvent(new Event('change', { bubbles: true }));
			view.query = '';
			view.kind = '';
			drawTable();
			dom.searchBox.focus();
		});

		/* A row opens its request; so does a bar on the calendar. The drawer
       then steps through the rows of the open tab, or through the bars
       in calendar order. */
		dom.tableBody.addEventListener('click', (event) => {
			const row = event.target.closest('tr[data-id]');
			if (!row || event.target.closest('a')) return;
			drawerQueue = rowsForView();
			showRequest(row.getAttribute('data-id'), 0);
		});
		dom.calendar.addEventListener('click', (event) => {
			const bar = event.target.closest('[data-lv-open]');
			if (!bar) return;
			drawerQueue = barsInOrder();
			showRequest(bar.getAttribute('data-lv-open'), 0);
		});
		dom.calendarScroll.addEventListener('scroll', markScrollEdges, { passive: true });
		window.addEventListener('resize', markScrollEdges);

		pick('[data-lv-export]').addEventListener('click', () => {
			notify({
				tone: 'success',
				icon: 'bi-download',
				title: 'Export on its way',
				text: `${upperFirst(spellCount(requests.length, 'request'))} from this year, as a CSV file.`,
			});
		});
	}

	function wireDrawer() {
		for (const stepper of pickAll('[data-lv-r-step]', dom.drawer)) {
			stepper.addEventListener('click', () => stepDrawer(Number(stepper.getAttribute('data-lv-r-step'))));
		}

		dom.drawer.addEventListener('keydown', (event) => {
			if (!event.altKey) return;
			const direction = { ArrowUp: -1, ArrowDown: 1 }[event.key];
			if (!direction) return;
			event.preventDefault();
			stepDrawer(direction);
		});
		dom.drawer.addEventListener('hidden.bs.offcanvas', () => {
			view.openId = null;
			view.asking = null;
		});

		const actions = {
			approve(request) {
				approveRequest(request);
				moveOnAfter(request);
			},
			decline(request) {
				beginNote('decline', request);
			},
			cover(request) {
				beginNote('cover', request);
			},
			cancel() {
				window.Basalt.slide(dom.askForm, () => {
					view.asking = null;
					fillDrawerKeepFocus();
				});
			},
			send: sendNote,
			unapprove(request) {
				const undo = rememberForUndo(request);
				request.status = 'waiting';
				delete request.decided;
				chargeAllowance(request, -1);
				notify({
					tone: 'info',
					icon: 'bi-arrow-counterclockwise',
					title: 'Back in the queue',
					text: `${firstNameOf(request.who)} is no longer booked off until you approve it again.`,
					actions: [{ label: 'Undo', onClick: undo }],
				});
				redrawAll();
				fillDrawerKeepFocus();
			},
			reopen(request) {
				const undo = rememberForUndo(request);
				request.status = 'waiting';
				delete request.decided;
				notify({
					tone: 'info',
					icon: 'bi-arrow-counterclockwise',
					title: 'Request reopened',
					text: 'It is back in To decide.',
					actions: [{ label: 'Undo', onClick: undo }],
				});
				redrawAll();
				fillDrawerKeepFocus();
			},
		};
		dom.drawer.addEventListener('click', (event) => {
			const button = event.target.closest('[data-lv-act]');
			if (!button) return;
			actions[button.getAttribute('data-lv-act')]?.(currentRequest());
		});

		dom.askText.addEventListener('input', () => {
			if (dom.askText.value.trim()) markInvalid(dom.askText, false);
		});
	}

	function wireBooking() {
		dom.booking.addEventListener('submit', sendBooking);
		dom.booking.addEventListener('change', (event) => {
			if (event.target.classList.contains('is-invalid')) markInvalid(event.target, false);
			updateBookingHints();
		});
		dom.booking.addEventListener('input', updateBookingHints);
		dom.bookingDrawer.addEventListener('hidden.bs.offcanvas', clearBooking);
	}

	/* Small helpers: querying, escaping, the shared toasts and announcer,
     and a few words. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
	}

	function notify(options) {
		window.Basalt.toasts?.push(options);
	}

	function sayAloud(text) {
		window.Basalt.announce?.(text);
	}

	/* "three days", "one request", "12 people": small numbers in words. */
	function spellCount(amount, singular, plural = `${singular}s`) {
		const word = amount < NUMBER_WORDS.length ? NUMBER_WORDS[amount] : String(amount);
		return `${word} ${amount === 1 ? singular : plural}`;
	}

	function upperFirst(text) {
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	/* Dates travel as ISO strings and only become Date objects to be
     formatted or shifted. */
	function parseIso(iso) {
		const [year, month, day] = iso.split('-').map(Number);
		return new Date(year, month - 1, day);
	}

	function formatIso(date) {
		const pad = (part) => String(part).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	}

	function shiftDays(iso, by) {
		const date = parseIso(iso);
		date.setDate(date.getDate() + by);
		return formatIso(date);
	}

	function worksOn(iso) {
		return roster.workdays(iso, iso) === 1;
	}

	function monthDay(iso) {
		return parseIso(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
	}

	function weekdayDate(iso) {
		return parseIso(iso).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
	}

	function fullDate(iso) {
		return parseIso(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	/* Working days from the first date to the last, both included. */
	function workdaysBetween(first, last) {
		let total = 0;
		for (let day = first; day <= last; day = shiftDays(day, 1)) {
			if (worksOn(day)) total += 1;
		}
		return total;
	}

	function firstWorkdayAfter(iso) {
		let day = shiftDays(iso, 1);
		while (!worksOn(day)) day = shiftDays(day, 1);
		return day;
	}

	/* "Oct 19 – 23", "Oct 26 – Nov 6", "Dec 21 – Jan 4", or one day. */
	function dateSpan({ from, to }) {
		if (from === to) return monthDay(from);
		const first = parseIso(from);
		const last = parseIso(to);
		const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
		return sameMonth ? `${monthDay(from)} – ${last.getDate()}` : `${monthDay(from)} – ${monthDay(to)}`;
	}

	/* "Oct 22", "Oct 22 and 23", "Oct 12, 13 and 14", or "5 days from Oct 12". */
	function listDays(days) {
		if (days.length > 3) return `${days.length} days from ${monthDay(days[0])}`;
		const sameMonth = days.every((day) => day.slice(0, 7) === days[0].slice(0, 7));
		const words = days.map((day, index) =>
			sameMonth && index < days.length - 1 ? String(parseIso(day).getDate()) : monthDay(day),
		);
		if (words.length === 1) return words[0];
		return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
	}

	/* The roster and the requests, read into this page's own shape. */
	function staffNumber(shortId) {
		return shortId ? roster.recordWithId(shortId).staff : '';
	}

	function requestFromRoster(entry) {
		const decided = entry.decided
			? {
					on: entry.decided.on,
					by: roster.nameOf(roster.recordWithId(entry.decided.by)),
					note: entry.decided.note,
				}
			: undefined;
		return { ...entry, who: staffNumber(entry.who), cover: staffNumber(entry.cover), decided };
	}

	/* Working days off in 2026 so far, by kind, across everyone who has
     been on the payroll this year. */
	function tallyDaysTaken() {
		const tally = {};
		const dayBefore = shiftDays(CLOCK, -1);
		const everyone = onPayroll.concat(roster.people.filter((who) => who.left));

		for (const who of everyone) {
			for (const absence of roster.absences(who)) {
				if (absence.from > dayBefore) continue;
				const until = absence.to < dayBefore ? absence.to : dayBefore;
				tally[absence.type] = (tally[absence.type] || 0) + roster.workdays(absence.from, until);
			}
		}

		return tally;
	}

	/* The working days the calendar shows: four weeks from the Monday of
     this week. */
	function buildGrid() {
		const days = [];
		for (let day = GRID_FROM; days.length < GRID_LENGTH; day = shiftDays(day, 1)) {
			if (worksOn(day)) days.push(day);
		}
		return days;
	}

	function staffById(id) {
		return staff.find((who) => who.id === id);
	}

	function fullNameOf(id) {
		const who = staffById(id);
		return who ? `${who.first} ${who.last}` : '';
	}

	function firstNameOf(id) {
		return staffById(id).first;
	}

	function currentRequest() {
		return requests.find((request) => request.id === view.openId);
	}

	/* Bits of markup several cards share. */
	function avatarHtml(id) {
		const who = staffById(id);
		const initials = (who.first.charAt(0) + who.last.replace(/^O’/, '').charAt(0)).toUpperCase();
		return `<span class="basalt-avatar basalt-avatar-sm basalt-avatar-tone-${teamById[who.team].tone}" aria-hidden="true">${htmlSafe(initials)}</span>`;
	}

	function kindTag(kind) {
		const info = LEAVE_KINDS[kind];
		return `<span class="lv-type" data-type="${kind}"><i class="bi ${info.icon}" aria-hidden="true"></i>${info.label}</span>`;
	}

	function stateTag(tone, label) {
		return `<span class="basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}">${label}</span>`;
	}

	/* Who is away when. */
	function approvedRequests() {
		return requests.filter((request) => request.status === 'approved');
	}

	function peopleAwayOn(day, pool = approvedRequests()) {
		return new Set(
			pool.filter((request) => request.from <= day && day <= request.to).map((request) => request.who),
		);
	}

	function crowdedDaysAhead() {
		return gridDays.filter((day) => day >= CLOCK && peopleAwayOn(day).size >= CROWDED_AT);
	}

	/* The checks behind a decision: allowance, notice, cover, the rest of
     the team, and how many people are away on each day. */
	function allowanceFor(request) {
		const info = LEAVE_KINDS[request.type];
		if (!info.allowance) return null;
		const used = staffById(request.who).used[request.type] || 0;
		const days = workdaysBetween(request.from, request.to);
		const before = info.allowance - used + (request.status === 'approved' ? days : 0);
		return { total: info.allowance, before, after: before - days };
	}

	function lacksCover(request) {
		return !request.cover && workdaysBetween(request.from, request.to) > COVER_OVER;
	}

	function reviewChecks(request) {
		const days = workdaysBetween(request.from, request.to);
		const team = staffById(request.who).team;
		const kindLabel = LEAVE_KINDS[request.type].label;
		const findings = [];

		const budget = allowanceFor(request);
		findings.push(
			budget
				? {
						ok: budget.after >= 0,
						title: 'Allowance',
						text: `${budget.before} of ${budget.total} ${kindLabel.toLowerCase()} days left, ${budget.after} after this.`,
					}
				: { ok: true, title: 'Allowance', text: `${kindLabel} leave doesn’t use an allowance.` },
		);

		if (request.type === 'annual') {
			const notice = workdaysBetween(shiftDays(request.sent, 1), shiftDays(request.from, -1));
			findings.push({
				ok: notice >= VACATION_NOTICE,
				title: 'Notice',
				text: `Asked ${notice} working days ahead. Vacation needs ${VACATION_NOTICE}.`,
			});
		}

		if (request.cover) {
			findings.push({
				ok: true,
				title: 'Cover',
				text: `${fullNameOf(request.cover)} covers while ${firstNameOf(request.who)} is away.`,
			});
		} else {
			findings.push({
				ok: days <= COVER_OVER,
				title: 'Cover',
				text:
					days > COVER_OVER
						? 'No one named. Anything over a week needs cover.'
						: `No one named. Not needed for ${spellCount(days, 'day')}.`,
			});
		}

		const teammatesAway = approvedRequests().filter(
			(other) =>
				other.who !== request.who &&
				staffById(other.who).team === team &&
				other.from <= request.to &&
				request.from <= other.to,
		);
		findings.push(
			teammatesAway.length
				? {
						ok: false,
						title: 'Team',
						text: `${teammatesAway.map((other) => `${fullNameOf(other.who)} is off ${dateSpan(other)}`).join('; ')}.`,
					}
				: { ok: true, title: 'Team', text: `No one else in ${teamById[team].name} is away then.` },
		);

		const crowded = [];
		for (let day = request.from; day <= request.to; day = shiftDays(day, 1)) {
			if (worksOn(day) && peopleAwayOn(day).size + 1 >= CROWDED_AT) crowded.push(day);
		}
		findings.push(
			crowded.length
				? {
						ok: false,
						title: 'Short-staffed',
						text: `${listDays(crowded)}${crowded.length === 1 ? ' would have ' : ' would each have '}${CROWDED_AT} or more people away.`,
					}
				: { ok: true, title: 'Short-staffed', text: `Every day stays under ${CROWDED_AT} people away.` },
		);

		return findings.concat(request.checks || []);
	}

	function waitingFlag(request) {
		if (lacksCover(request)) return { tone: 'danger', label: 'No cover' };
		const clash = reviewChecks(request).some((finding) => !finding.ok);
		return clash ? { tone: 'warning', label: 'Clash' } : { tone: 'success', label: 'Clear' };
	}

	function statusOf(request) {
		if (request.status === 'waiting') return waitingFlag(request);
		if (request.status === 'declined') return { tone: 'danger', label: 'Declined' };
		if (request.to < CLOCK) return { tone: '', label: 'Back' };
		if (request.from <= CLOCK) return { tone: 'primary', label: 'Away now' };
		return { tone: 'info', label: 'Coming up' };
	}

	/* Drawing: everything on the page is redrawn from `requests`. */
	function redrawAll() {
		drawTabCounts();
		drawCalendar();
		drawTable();
	}

	function drawTabCounts() {
		for (const tab of Object.keys(TAB_WORDING)) {
			pick(`[data-lv-count="${tab}"]`).textContent = requests.filter((request) => request.status === tab).length;
		}
		pick('.lv-tabs')?.basaltTabs?.refresh();
	}

	/* The calendar is a grid: a name column, then one column per working
     day. Each row is one person with their time off laid over the day
     cells as bars. */
	function drawCalendar() {
		const finalDay = gridDays[gridDays.length - 1];
		const inWindow = requests
			.filter(
				(request) =>
					(request.status === 'approved' || request.status === 'waiting') &&
					request.from <= finalDay &&
					request.to >= gridDays[0],
			)
			.sort((a, b) => a.from.localeCompare(b.from) || a.id.localeCompare(b.id));

		const lanes = new Map();
		for (const request of inWindow) {
			if (!lanes.has(request.who)) lanes.set(request.who, []);
			lanes.get(request.who).push(request);
		}

		const weeks = [];
		for (let at = 0; at < gridDays.length; at += 5) weeks.push(gridDays.slice(at, at + 5));

		const rows = [weeksRow(weeks), daysRow(), awayRow()];
		for (const [who, list] of lanes) rows.push(personLane(who, list, finalDay));
		dom.calendar.innerHTML = rows.join('');

		const crowded = crowdedDaysAhead();
		const awayToday = peopleAwayOn(CLOCK).size;
		const ahead = crowded.length
			? `${listDays(crowded)}${crowded.length === 1 ? ' has ' : ' have '}`
			: 'No day ahead has ';
		pick('[data-lv-cal-sub]').textContent =
			`${upperFirst(spellCount(awayToday, 'person', 'people'))} away today. ${ahead}${CROWDED_AT} or more away.`;
		markScrollEdges();
	}

	/* Every cell names its column, so the bars laid over a row can't push
     the day cells out of place. */
	function cellAttributes(day, index) {
		return `class="lv-cal-cell${index % 5 === 0 ? ' is-monday' : ''}${day === CLOCK ? ' is-today' : ''}" style="grid-column:${index + 2}"`;
	}

	function weeksRow(weeks) {
		const spans = weeks.map(
			(week, index) =>
				`<span class="lv-cal-week" style="grid-column:${index * 5 + 2} / span 5">${dateSpan({ from: week[0], to: week[week.length - 1] })}</span>`,
		);
		return `<div class="lv-cal-row lv-cal-row-weeks" aria-hidden="true"><span class="lv-cal-name"></span>${spans.join('')}</div>`;
	}

	function daysRow() {
		const cells = gridDays.map((day, index) => {
			const date = parseIso(day);
			return `<span ${cellAttributes(day, index)}><span class="lv-cal-dow">${date.toLocaleDateString('en-US', { weekday: 'narrow' })}</span><span class="lv-cal-date">${date.getDate()}</span></span>`;
		});
		return `<div class="lv-cal-row lv-cal-row-days" aria-hidden="true"><span class="lv-cal-name"></span>${cells.join('')}</div>`;
	}

	function awayRow() {
		const cells = gridDays.map((day, index) => {
			const away = peopleAwayOn(day).size;
			const crowded = away >= CROWDED_AT;
			return `<span ${cellAttributes(day, index)}><span class="lv-cal-n${crowded ? ' is-short' : ''}" title="${weekdayDate(day)}: ${spellCount(away, 'person', 'people')} away">${away}<span class="visually-hidden"> away on ${weekdayDate(day)}${crowded ? ', short-staffed' : ''}</span></span></span>`;
		});
		return `<div class="lv-cal-row lv-cal-row-away"><span class="lv-cal-name lv-cal-label">Away</span>${cells.join('')}</div>`;
	}

	function personLane(who, list, finalDay) {
		const person = staffById(who);
		const cells = gridDays
			.map((day, index) => `<span ${cellAttributes(day, index)} aria-hidden="true"></span>`)
			.join('');
		const bars = list.map((request) => barHtml(request, finalDay)).join('');
		const name = `<span class="lv-cal-name">${avatarHtml(person.id)}<span class="lv-cal-who"><span class="lv-cal-person">${htmlSafe(`${person.first} ${person.last}`)}</span><span class="lv-cal-team">${htmlSafe(teamById[person.team].name)}</span></span></span>`;
		return `<div class="lv-cal-row lv-cal-row-person">${name}${cells}${bars}</div>`;
	}

	/* A bar spans the grid columns of its days. It gets a word only where
     one fits whole: three days for a short kind, four for a long one. */
	function barHtml(request, finalDay) {
		const startAt = gridDays.findIndex((day) => day >= request.from);
		let endAt = -1;
		for (let index = gridDays.length - 1; index >= 0; index -= 1) {
			if (gridDays[index] <= request.to) {
				endAt = index;
				break;
			}
		}
		if (startAt < 0 || endAt < startAt) return '';

		const cutStart = request.from < gridDays[0];
		const cutEnd = request.to > finalDay;
		const width = endAt - startAt + 1;
		const kind = LEAVE_KINDS[request.type];
		let caption = width >= (kind.label.length > 8 ? 4 : 3) ? kind.label : '';
		if (caption && cutEnd && width >= 5) caption += ` · until ${monthDay(request.to)}`;
		const spoken = `${fullNameOf(request.who)}, ${kind.label.toLowerCase()} leave, ${dateSpan(request)}${request.status === 'waiting' ? ', waiting for you' : ''}`;
		const classes = [
			'lv-bar',
			request.status === 'waiting' && 'is-waiting',
			cutStart && 'is-cut-start',
			cutEnd && 'is-cut-end',
		]
			.filter(Boolean)
			.join(' ');
		return `<button type="button" class="${classes}" data-type="${request.type}" style="grid-column:${startAt + 2} / ${endAt + 3}" data-lv-open="${request.id}" aria-label="${htmlSafe(spoken)}" title="${htmlSafe(spoken)}"><i class="bi ${kind.icon}" aria-hidden="true"></i>${caption ? `<span class="lv-bar-label">${caption}</span>` : ''}</button>`;
	}

	/* On narrow screens the calendar scrolls sideways: the side with more
     fades, and the pinned names cast a shadow once scrolled. */
	function markScrollEdges() {
		const scroller = dom.calendarScroll;
		const frame = scroller.parentElement;
		frame.classList.toggle('has-more-end', scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1);
		frame.classList.toggle('is-scrolled', scroller.scrollLeft > 0);
	}

	/* The requests table: the open tab, narrowed by the search and the
     kind select. */
	function keepsFilter(request) {
		if (view.kind && request.type !== view.kind) return false;
		if (!view.query) return true;
		const haystack = [
			fullNameOf(request.who),
			request.reason,
			request.id,
			teamById[staffById(request.who).team].name,
			fullNameOf(request.cover),
		].join(' ');
		return window.Basalt?.matchesQuery
			? window.Basalt.matchesQuery(haystack, view.query)
			: haystack.toLowerCase().includes(view.query.toLowerCase());
	}

	/* Waiting: oldest first. Approved: away now and coming up by start
     date, then the ones already back. Declined: newest decision first. */
	function rowsForView() {
		const matching = requests.filter((request) => request.status === view.tab && keepsFilter(request));
		const orderings = {
			waiting: (list) => list.sort((a, b) => a.sent.localeCompare(b.sent) || a.id.localeCompare(b.id)),
			declined: (list) => list.sort((a, b) => b.decided.on.localeCompare(a.decided.on)),
			approved(list) {
				const ahead = list
					.filter((request) => request.to >= CLOCK)
					.sort((a, b) => a.from.localeCompare(b.from));
				const back = list.filter((request) => request.to < CLOCK).sort((a, b) => b.to.localeCompare(a.to));
				return ahead.concat(back);
			},
		};
		return orderings[view.tab](matching);
	}

	function requestRow(request) {
		const person = staffById(request.who);
		const status = statusOf(request);
		const days = workdaysBetween(request.from, request.to);
		const toReview = request.status === 'waiting';
		const cover = request.cover
			? `<span class="lv-cover">${htmlSafe(fullNameOf(request.cover))}</span>`
			: '<span class="lv-cover is-none">Not named</span>';
		return `<tr data-id="${request.id}"><td><span class="lv-who">${avatarHtml(person.id)}<span><a class="lv-who-name" href="employee-details.html?id=${encodeURIComponent(person.id)}">${htmlSafe(`${person.first} ${person.last}`)}</a><span class="lv-who-role">${htmlSafe(person.role)}</span></span></span></td><td><span class="lv-when">${dateSpan(request)}</span><span class="lv-when-days">${days} working day${days === 1 ? '' : 's'}</span></td><td>${kindTag(request.type)}</td><td>${cover}</td><td>${stateTag(status.tone, status.label)}</td><td><button type="button" class="btn btn-sm ${toReview ? 'btn-outline-primary' : 'btn-outline-secondary'}" data-lv-open="${request.id}">${toReview ? 'Review' : 'Open'}</button></td></tr>`;
	}

	function blankNote({ tone, icon, title, text, actions }) {
		return `<div class="basalt-empty basalt-empty-compact${tone ? ` basalt-empty-${tone}` : ''} lv-empty"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi ${icon}"></i></span><h3 class="basalt-empty-title">${title}</h3><p class="basalt-empty-text">${text}</p>${actions ? `<div class="basalt-empty-actions">${actions}</div>` : ''}</div>`;
	}

	function emptyForView() {
		if (view.query || view.kind) {
			return blankNote({
				tone: 'muted',
				icon: 'bi-search',
				title: 'No requests match',
				text: `Nothing here matches ${view.query ? `“${htmlSafe(view.query)}”` : 'that type'}. Try another word or type.`,
				actions:
					'<button type="button" class="btn btn-sm btn-outline-secondary" data-lv-reset>Clear the search</button>',
			});
		}
		return blankNote(TAB_EMPTY[view.tab]);
	}

	function drawTable() {
		const shown = rowsForView();
		const underTab = requests.filter((request) => request.status === view.tab).length;
		dom.tableBody.innerHTML = shown.map(requestRow).join('');
		dom.tableWrap.hidden = !shown.length;
		dom.emptySlot.hidden = Boolean(shown.length);
		dom.emptySlot.innerHTML = shown.length ? '' : emptyForView();
		dom.caption.textContent = `Time-off requests ${TAB_WORDING[view.tab].line}`;
		dom.requestsSub.textContent = tableSummary(shown.length, underTab);
	}

	function tableSummary(shown, underTab) {
		const wording = TAB_WORDING[view.tab];
		if (!underTab) return wording.none;
		if (!shown) return `None of the ${underTab} match.`;
		if (shown < underTab) return `Showing ${shown} of ${underTab}.`;
		return `${upperFirst(spellCount(underTab, 'request'))} ${wording.line}.`;
	}

	/* Days off this year: one bar per kind, longest first. */
	function drawDaysTaken() {
		const byKind = Object.entries(daysTakenByKind).sort(([, a], [, b]) => b - a);
		const total = byKind.reduce((sum, [, days]) => sum + days, 0);
		const [, most] = byKind[0] ?? [];
		pick('[data-lv-taken-sub]').textContent =
			`${total.toLocaleString('en-US')} working days since Jan 1, across ${staff.length} people.`;
		pick('[data-lv-taken]').innerHTML = byKind
			.map(([kind, days]) => {
				const share = Math.round((days / total) * 100);
				return `<li class="lv-taken-row" data-type="${kind}"><p class="lv-taken-name">${kindTag(kind)}</p><span class="lv-taken-bar" aria-hidden="true"><span style="--lv-share:${Math.max(1.5, (days / most) * 100).toFixed(1)}%"></span></span><p class="lv-taken-days"><span><span class="lv-taken-n">${days}</span> ${days === 1 ? 'day' : 'days'}</span><span class="lv-taken-share">${share < 1 ? '&lt;1' : share}%</span></p></li>`;
			})
			.join('');
	}

	/* The request drawer: status, dates, the checks (while it waits),
     the facts and the history, with buttons that fit its state. */
	function recordDrawer() {
		return bootstrap.Offcanvas.getOrCreateInstance(dom.drawer);
	}

	function slot(key) {
		return pick(`[data-lv-r="${key}"]`, dom.drawer);
	}

	function drawerStatus(request) {
		const status = statusOf(request);
		let line;
		if (request.status === 'waiting') {
			line = request.asked
				? `You asked ${firstNameOf(request.who)} to name cover on ${monthDay(request.asked.on)}.`
				: `Sent on ${monthDay(request.sent)}. Waiting for you.`;
		} else if (request.status === 'approved') {
			const who = request.decided.by === SIGNED_IN ? 'You' : request.decided.by;
			const first = firstNameOf(request.who);
			const back =
				request.to < CLOCK
					? `${first} was back on ${monthDay(firstWorkdayAfter(request.to))}.`
					: `${first} is back on ${weekdayDate(firstWorkdayAfter(request.to))}.`;
			line = `${who} approved it on ${monthDay(request.decided.on)}. ${back}`;
		} else {
			line = `${request.decided.by === SIGNED_IN ? 'You' : request.decided.by} declined it on ${monthDay(request.decided.on)}.`;
		}
		const note = request.status === 'declined' ? request.decided.note : request.asked ? request.asked.text : '';
		const noteHtml = note
			? `<p class="lv-r-note">${htmlSafe(note)}<span class="lv-r-note-by">${htmlSafe(request.decided ? request.decided.by : SIGNED_IN)}</span></p>`
			: '';
		return `<div class="lv-r-state">${stateTag(status.tone, status.label)}<p class="lv-r-state-text">${htmlSafe(line)}</p>${noteHtml}</div>`;
	}

	function drawerDates(request) {
		const days = workdaysBetween(request.from, request.to);
		const when =
			request.from === request.to
				? weekdayDate(request.from)
				: `${weekdayDate(request.from)} to ${weekdayDate(request.to)}`;
		return `<div class="lv-r-when" data-type="${request.type}"><p class="lv-r-when-dates">${when}</p><p class="lv-r-when-meta">${LEAVE_KINDS[request.type].label} leave · ${days} working day${days === 1 ? '' : 's'}</p><blockquote class="lv-r-when-reason">“${htmlSafe(request.reason)}”</blockquote></div>`;
	}

	function drawerChecks(request) {
		const items = reviewChecks(request).map(
			(finding) =>
				`<li class="lv-check${finding.ok ? '' : ' is-warn'}"><span class="lv-check-mark" aria-hidden="true"><i class="bi ${finding.ok ? 'bi-check-lg' : 'bi-exclamation-lg'}"></i></span><div><p class="lv-check-title">${htmlSafe(finding.title)}<span class="visually-hidden">${finding.ok ? ', fine' : ', needs a look'}</span></p><p class="lv-check-text">${htmlSafe(finding.text)}</p></div></li>`,
		);
		return `<ul class="lv-checks">${items.join('')}</ul>`;
	}

	function drawerFacts(request) {
		const person = staffById(request.who);
		const budget = allowanceFor(request);
		const back = firstWorkdayAfter(request.to);
		const facts = [
			[
				'Person',
				`<a href="employee-details.html?id=${encodeURIComponent(person.id)}">${htmlSafe(`${person.first} ${person.last}`)}</a>`,
			],
			['Team', htmlSafe(teamById[person.team].name)],
			['Back on', weekdayDate(back) + (back.slice(0, 4) !== CLOCK.slice(0, 4) ? ` ${back.slice(0, 4)}` : '')],
			['Cover', request.cover ? htmlSafe(fullNameOf(request.cover)) : 'Not named'],
			['Allowance', budget && request.status !== 'waiting' ? `${budget.after} of ${budget.total} days left` : ''],
			['Request', request.id],
		].filter(([, value]) => value);
		return `<dl class="lv-r-facts">${facts.map(([term, value]) => `<dt>${term}</dt><dd>${value}</dd>`).join('')}</dl>`;
	}

	function drawerHistory(request) {
		const steps = [{ icon: 'bi-send', what: `Sent by ${fullNameOf(request.who)}`, when: request.sent }];
		if (request.asked)
			steps.push({
				icon: 'bi-person-raised-hand',
				tone: 'warning',
				what: 'Asked to name cover',
				when: request.asked.on,
			});
		if (request.status === 'approved')
			steps.push({
				icon: 'bi-check2',
				tone: 'success',
				what: `Approved by ${request.decided.by}`,
				when: request.decided.on,
			});
		if (request.status === 'declined')
			steps.push({
				icon: 'bi-x-lg',
				tone: 'danger',
				what: `Declined by ${request.decided.by}`,
				when: request.decided.on,
			});
		const items = steps.map(
			(step) =>
				`<li><span class="lv-trail-mark${step.tone ? ` is-${step.tone}` : ''}" aria-hidden="true"><i class="bi ${step.icon}"></i></span><div><p class="lv-trail-what">${htmlSafe(step.what)}</p><p class="lv-trail-when">${fullDate(step.when)}</p></div></li>`,
		);
		return `<ol class="lv-trail">${items.join('')}</ol>`;
	}

	function drawerButtons(request) {
		if (view.asking) {
			return `<button type="button" class="btn btn-outline-secondary" data-lv-act="cancel">Cancel</button><button type="button" class="btn btn-primary" data-lv-act="send">${view.asking === 'decline' ? 'Decline request' : 'Send'}</button>`;
		}
		if (request.status === 'waiting') {
			const main = lacksCover(request)
				? '<button type="button" class="btn btn-primary" data-lv-act="cover"><i class="bi bi-person-raised-hand me-1" aria-hidden="true"></i>Ask for cover</button>'
				: '<button type="button" class="btn btn-primary" data-lv-act="approve"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Approve</button>';
			return `<button type="button" class="btn btn-outline-secondary me-auto" data-lv-act="decline">Decline</button>${main}`;
		}
		if (request.status === 'approved' && request.from > CLOCK) {
			return `<button type="button" class="btn btn-outline-secondary me-auto" data-lv-act="unapprove">Undo approval</button>${CLOSE_BUTTON}`;
		}
		if (request.status === 'declined') {
			return `<button type="button" class="btn btn-outline-secondary me-auto" data-lv-act="reopen">Reopen</button>${CLOSE_BUTTON}`;
		}
		return CLOSE_BUTTON;
	}

	function fillDrawer() {
		const request = currentRequest();
		if (!request) return;
		const at = drawerQueue.findIndex((queued) => queued.id === request.id);
		slot('title').textContent = fullNameOf(request.who);
		slot('sub').textContent = staffById(request.who).role;
		slot('pos').textContent = at >= 0 ? `${at + 1} of ${drawerQueue.length}` : '';

		for (const stepper of pickAll('[data-lv-r-step]', dom.drawer)) {
			stepper.disabled = at < 0 || drawerQueue.length < 2;
		}

		const parts = [drawerStatus(request), drawerDates(request)];
		if (request.status === 'waiting')
			parts.push(
				`<section aria-labelledby="lv-r-checks"><h3 class="lv-r-h" id="lv-r-checks">Before you decide</h3>${drawerChecks(request)}</section>`,
			);
		parts.push(
			`<section aria-labelledby="lv-r-details"><h3 class="lv-r-h" id="lv-r-details">Details</h3>${drawerFacts(request)}</section>`,
		);
		parts.push(
			`<section aria-labelledby="lv-r-history"><h3 class="lv-r-h" id="lv-r-history">History</h3>${drawerHistory(request)}</section>`,
		);
		slot('body').innerHTML = parts.join('');
		dom.askForm.hidden = !view.asking;
		slot('foot').innerHTML = drawerButtons(request);
	}

	/* The buttons that were pressed are drawn anew, so focus goes back to
     the title rather than off the drawer. */
	function fillDrawerKeepFocus() {
		fillDrawer();
		slot('title').focus();
	}

	function showRequest(id, direction) {
		view.openId = id;
		view.asking = null;
		dom.askText.value = '';
		dom.askText.classList.remove('is-invalid');
		dom.drawer.classList.toggle('is-back', direction < 0);
		fillDrawer();
		if (direction) {
			for (const node of pickAll(':scope > *', slot('body'))) replayAnimation(node);
		}
		recordDrawer().show();
	}

	function replayAnimation(node) {
		node.style.animation = 'none';
		void node.offsetWidth;
		node.style.animation = '';
	}

	function stepDrawer(direction) {
		if (drawerQueue.length < 2) return;
		const at = drawerQueue.findIndex((queued) => queued.id === view.openId);
		showRequest(drawerQueue[(at + direction + drawerQueue.length) % drawerQueue.length].id, direction);
	}

	function barsInOrder() {
		return pickAll('.lv-bar', dom.calendar).map((bar) =>
			requests.find((request) => request.id === bar.getAttribute('data-lv-open')),
		);
	}

	/* After a decision: on to the next waiting request, or closed when
     that was the last one. */
	function moveOnAfter(request) {
		const at = drawerQueue.findIndex((queued) => queued.id === request.id);
		redrawAll();
		drawerQueue = drawerQueue.filter((queued) => queued.status === 'waiting');
		if (!drawerQueue.length) {
			recordDrawer().hide();
			return;
		}
		showRequest(drawerQueue[Math.min(Math.max(at, 0), drawerQueue.length - 1)].id, 1);
		slot('title').focus();
	}

	/* Decisions. Each one hands back an undo that restores the request
     and the person's allowance as they were. */
	function rememberForUndo(request) {
		const before = JSON.parse(JSON.stringify(request));
		const usedBefore = { ...staffById(request.who).used };
		return () => {
			for (const key of Object.keys(request)) delete request[key];
			Object.assign(request, before);
			staffById(request.who).used = usedBefore;
			redrawAll();
			if (view.openId) fillDrawer();
		};
	}

	function chargeAllowance(request, sign) {
		if (!LEAVE_KINDS[request.type].allowance) return;
		const person = staffById(request.who);
		person.used[request.type] = (person.used[request.type] || 0) + sign * workdaysBetween(request.from, request.to);
	}

	function approveRequest(request) {
		const undo = rememberForUndo(request);
		request.status = 'approved';
		request.decided = { on: CLOCK, by: SIGNED_IN };
		delete request.asked;
		chargeAllowance(request, 1);
		notify({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'Time off approved',
			text: `${firstNameOf(request.who)} is booked off ${dateSpan(request)} and gets an email.`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						undo();
						sayAloud('Undone. Back in the queue.');
					},
				},
			],
		});
	}

	function beginNote(kind, request) {
		view.asking = kind;
		dom.askLabel.textContent =
			kind === 'decline' ? 'Why is it declined?' : `Message to ${firstNameOf(request.who)}`;
		dom.askText.value =
			kind === 'cover' ? 'Who will look after your work while you’re away? Add them and I’ll approve it.' : '';
		dom.askText.classList.remove('is-invalid');
		window.Basalt.slide(dom.askForm, fillDrawer);
		dom.askText.focus();
	}

	function sendNote(request) {
		const text = dom.askText.value.trim();
		if (markInvalid(dom.askText, !text)) {
			dom.askText.focus();
			return;
		}
		const undo = rememberForUndo(request);
		if (view.asking === 'decline') {
			request.status = 'declined';
			request.decided = { on: CLOCK, by: SIGNED_IN, note: text };
			delete request.asked;
			notify({
				tone: 'danger',
				icon: 'bi-x-circle',
				title: 'Request declined',
				text: `${firstNameOf(request.who)} gets an email with your note.`,
				actions: [{ label: 'Undo', onClick: undo }],
			});
			view.asking = null;
			moveOnAfter(request);
			return;
		}
		request.asked = { on: CLOCK, text };
		notify({
			tone: 'info',
			icon: 'bi-person-raised-hand',
			title: 'Asked for cover',
			text: `${firstNameOf(request.who)} gets an email. The request stays in your queue.`,
			actions: [{ label: 'Undo', onClick: undo }],
		});
		view.asking = null;
		redrawAll();
		fillDrawerKeepFocus();
	}

	/* Booking time off for someone. */
	function markInvalid(input, bad) {
		input.classList.toggle('is-invalid', bad);
		input.setAttribute('aria-invalid', String(bad));
		return bad;
	}

	function updateBookingHints() {
		const booking = dom.booking;
		const who = booking.who.value;
		const kind = LEAVE_KINDS[booking.type.value];
		const hint = pick('[data-lv-new-hint]');
		if (!who) {
			hint.textContent = '';
		} else if (!kind.allowance) {
			hint.textContent = `${kind.label} leave doesn’t use an allowance.`;
		} else {
			const left = kind.allowance - (staffById(who).used[booking.type.value] || 0);
			hint.textContent = `${firstNameOf(who)} has ${left} of ${kind.allowance} ${kind.label.toLowerCase()} days left.`;
		}
		const { from, to } = booking;
		const days = from.value && to.value && to.value >= from.value ? workdaysBetween(from.value, to.value) : 0;
		pick('[data-lv-new-days]').textContent = days
			? `${upperFirst(spellCount(days, 'working day'))}, back on ${weekdayDate(firstWorkdayAfter(to.value))}.`
			: '';
	}

	function sendBooking(event) {
		event.preventDefault();
		const booking = dom.booking;
		const from = booking.from.value;
		const to = booking.to.value;
		const badFrom = !from || from < booking.from.min || from > booking.from.max;
		const badTo = !badFrom && (!to || to < from || workdaysBetween(from, to) === 0);
		pick('#lv-new-to-error').textContent =
			to && to >= from ? 'Pick dates with at least one working day.' : 'The last day can’t be before the first.';
		const invalid = [
			[booking.who, !booking.who.value],
			[booking.from, badFrom],
			[booking.to, badTo],
		]
			.filter(([input, bad]) => markInvalid(input, bad))
			.map(([input]) => input);
		if (invalid.length) {
			invalid[0].focus();
			return;
		}
		const fresh = {
			id: `#${nextNewNumber++}`,
			who: booking.who.value,
			type: booking.type.value,
			from,
			to,
			sent: CLOCK,
			status: 'waiting',
			cover: booking.cover.value,
			reason: booking.reason.value.trim() || `Booked by ${SIGNED_IN}.`,
		};
		requests.push(fresh);
		bootstrap.Offcanvas.getOrCreateInstance(dom.bookingDrawer).hide();
		const waitingTab = pick('#lv-view-waiting');
		if (!waitingTab.checked) {
			waitingTab.checked = true;
			view.tab = 'waiting';
		}
		redrawAll();
		notify({
			tone: 'success',
			icon: 'bi-calendar-plus',
			title: 'Request added',
			text: `${fullNameOf(fresh.who)}, ${dateSpan(fresh)}. It is waiting in To decide.`,
		});
	}

	function clearBooking() {
		dom.booking.reset();

		for (const select of [dom.booking.who, dom.booking.cover]) {
			select.dispatchEvent(new Event('change', { bubbles: true }));
		}

		for (const input of pickAll('.is-invalid', dom.booking)) {
			input.classList.remove('is-invalid');
			input.removeAttribute('aria-invalid');
		}

		updateBookingHints();
	}

	document.addEventListener('DOMContentLoaded', start);
})();
