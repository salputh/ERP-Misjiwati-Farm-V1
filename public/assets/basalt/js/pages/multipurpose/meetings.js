/**
 * Meetings (meetings.html). The signed-in person's calendar in three
 * tabs: what is coming up, with a five-day strip showing how full each
 * day is; invitations still waiting for a reply; and past meetings with
 * their notes. A lead card shows the meeting on now (or up next) beside
 * what is waiting on you. A row, its name or its expand icon opens the
 * meeting's full page (meeting-details.html?id=<id>); the panel icon
 * opens a quick-view side panel, and a second panel schedules or moves
 * a meeting. The meetings live in assets/basalt/js/data/multipurpose/meetings.js; a real
 * deployment loads the same fields from its calendar service and keeps
 * the drawing code.
 */
(() => {
	'use strict';

	const stage = pick('[data-mt-root]');
	if (!stage) return;

	/* The data file is shared with Meeting Details. Its clock is Thursday
     October 8, 2026 at 11:20 in the morning: one meeting is live and
     three more come today. A live app would read new Date(). */
	const source = window.Basalt.data.meetings;
	const {
		NOW: now,
		ME: myId,
		endOf: finishOf,
		stateOf: phaseOf,
		recordWithId: meetingById,
		nameOf: nameFor,
		answerOf: replyFrom,
	} = source;
	const directory = source.people;
	const kindInfo = source.kinds;
	const schedule = source.meetings;
	const replyLabels = source.answers;

	const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
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
	const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	/* The strip runs from 8:00 for ten hours; a meeting is a block placed
     by its minutes past eight. */
	const TRACK_START_MIN = 8 * 60;
	const TRACK_SPAN_MIN = 10 * 60;
	const STRIP_DAYS = 5;
	const LENGTH_CHOICES = [15, 30, 45, 60, 90];

	/* The "where" field changes with the kind of meeting. */
	const PLACE_FIELDS = {
		video: {
			label: 'Video link',
			hint: 'A link is made from the meeting name. Change it if you like.',
			placeholder: 'meet.fieldline.app/your-meeting',
		},
		room: {
			label: 'Room or address',
			hint: 'People see it in the invite with a map link.',
			placeholder: 'Moorings room, 4th floor',
		},
		phone: {
			label: 'Dial-in number',
			hint: 'Everyone gets the number and PIN in the invite.',
			placeholder: '+1 415 555 0190, PIN 4471',
		},
	};
	const REPLY_TOASTS = { yes: "You're going", maybe: 'You might go', no: 'You declined' };

	const todayStart = midnightOf(now);
	const stripDays = workingDaysFrom(todayStart, STRIP_DAYS);

	const view = { day: null, past: { q: '', notes: 'all' }, sheetId: null, planMode: 'new' };
	let placeEdited = false;

	const dom = {
		headline: pick('[data-mt-now]'),
		todos: pick('[data-mt-todo]'),
		strip: pick('[data-mt-days]'),
		stripClear: pick('[data-mt-day-clear]'),
		upcomingSub: pick('[data-mt-next-sub]'),
		upcoming: pick('[data-mt-next]'),
		invitations: pick('[data-mt-reply]'),
		invitationsTable: pick('[data-mt-reply-table]'),
		invitationsEmpty: pick('[data-mt-reply-empty]'),
		invitationsSub: pick('[data-mt-reply-sub]'),
		past: pick('[data-mt-past]'),
		pastTable: pick('[data-mt-past-table]'),
		pastEmpty: pick('[data-mt-past-empty]'),
		pastStatus: pick('[data-mt-past-status]'),
		pastSearch: pick('[data-mt-past-search]'),
		pastNotes: pick('[data-mt-past-notes]'),
		sheet: pick('#mt-sheet'),
		plan: pick('#mt-plan'),
		planForm: pick('[data-mt-plan-form]'),
		inviteSelect: pick('[data-mt-plan-people]'),
	};

	/**
	 * Fills the invite list, wires every part of the page and draws it.
	 */
	function start() {
		fillInviteList();
		wireStrip();
		wirePageClicks();
		wireSheet();
		wirePlan();
		dom.pastSearch.addEventListener('input', () => {
			view.past.q = dom.pastSearch.value.trim();
			drawPast();
		});
		dom.pastNotes.addEventListener('change', () => {
			view.past.notes = dom.pastNotes.value;
			drawPast();
		});
		drawEverything();
	}

	function wireStrip() {
		dom.strip.addEventListener('click', (event) => {
			const tile = event.target.closest('[data-mt-day]');
			if (!tile) return;
			view.day = view.day === tile.dataset.mtDay ? null : tile.dataset.mtDay;
			drawStrip();
			drawUpcoming();
			sayAloud(view.day ? `Showing ${fullDate(new Date(`${view.day}T00:00`))} only` : 'Showing every day');
			const redrawn = pick(`[data-mt-day="${tile.dataset.mtDay}"]`, dom.strip);
			if (redrawn && event.detail === 0) redrawn.focus();
		});
		dom.stripClear.addEventListener('click', () => {
			const cleared = view.day;
			view.day = null;
			drawStrip();
			drawUpcoming();
			pick(`[data-mt-day="${cleared}"]`, dom.strip)?.focus({ preventScroll: true });
		});
	}

	/* One listener on the page handles the join buttons, the accept and
     decline buttons, the to-do shortcuts, the quick-view buttons, and
     a click anywhere else on a row, which opens the meeting's full
     page the way its name does (in a new tab with Cmd, Ctrl, Shift or
     the middle button). */
	function wirePageClicks() {
		stage.addEventListener('click', (event) => {
			const joiner = event.target.closest('[data-mt-go]');
			if (joiner) {
				event.preventDefault();
				joinMeeting(meetingById(joiner.dataset.mtGo));
				return;
			}
			const answerer = event.target.closest('[data-mt-answer]');
			if (answerer) {
				replyTo(meetingById(answerer.dataset.id), answerer.dataset.mtAnswer);
				(pick('[data-mt-answer]', dom.invitations) || pick('#mt-reply')).focus();
				return;
			}
			const shortcut = event.target.closest('[data-mt-tab]');
			if (shortcut) {
				jumpToTab(shortcut.dataset.mtTab);
				return;
			}
			const opener = event.target.closest('[data-mt-open]');
			if (opener) {
				showSheet(opener.dataset.mtOpen, opener.dataset.mtFocus);
				return;
			}
			const url = rowUrl(event);
			if (!url) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey) window.open(url, '_blank');
			else location.href = url;
		});
		stage.addEventListener('auxclick', (event) => {
			const url = event.button === 1 && rowUrl(event);
			if (url) window.open(url, '_blank');
		});
		pick('[data-mt-new]').addEventListener('click', () => showPlan(null));
	}

	function wireSheet() {
		dom.sheet.addEventListener('shown.bs.offcanvas', () => {
			const wanted = dom.sheet.dataset.focus;
			const target =
				wanted === 'reply'
					? pick('[data-mt-s-reply] input', dom.sheet)
					: pick('[data-mt-notes-text]', dom.sheet) || sheetSlot('title');
			target?.focus();
		});
		dom.sheet.addEventListener('change', (event) => {
			if (event.target.name !== 'mtAnswer') return;
			const meeting = meetingById(view.sheetId);
			if (!meeting) return;
			replyTo(meeting, event.target.value);
			pick(`#mt-answer-${event.target.value}`, dom.sheet)?.focus();
		});
		dom.sheet.addEventListener('input', (event) => {
			if (event.target.matches('[data-mt-notes-text]')) event.target.classList.remove('is-invalid');
		});
		dom.sheet.addEventListener('click', (event) => {
			const meeting = meetingById(view.sheetId);
			if (!meeting) return;
			if (event.target.closest('[data-mt-go]')) {
				event.preventDefault();
				joinMeeting(meeting);
			} else if (event.target.closest('[data-mt-rec]')) {
				notify({
					tone: 'info',
					icon: 'bi-play-circle',
					title: 'Opening the recording',
					text: `${meeting.title}, ${durationText(meeting.rec)}.`,
				});
			} else if (event.target.closest('[data-mt-s-cancel]')) {
				callOff(meeting);
			} else if (event.target.closest('[data-mt-s-move]')) {
				dom.sheet.addEventListener('hidden.bs.offcanvas', () => showPlan(meeting), { once: true });
				sheetPanel().hide();
			} else if (event.target.closest('[data-mt-s-go]')) {
				const mainButton = event.target.closest('[data-mt-s-go]');
				if (mainButton.dataset.do === 'notes') sendNotes(meeting);
				else joinMeeting(meeting);
			}
		});
	}

	function wirePlan() {
		dom.plan.addEventListener('shown.bs.offcanvas', () => field('title').focus());
		field('title').addEventListener('input', () => {
			field('title').classList.remove('is-invalid');
			refreshPlace();
		});
		field('where').addEventListener('input', () => {
			placeEdited = field('where').value.trim() !== '';
		});
		dom.planForm.addEventListener('change', (event) => {
			if (event.target.name === 'kind') {
				if (view.planMode === 'new') placeEdited = false;
				refreshPlace();
			}
			if (event.target.name === 'date' || event.target.name === 'time')
				event.target.classList.remove('is-invalid');
			refreshAvailability();
		});
		dom.planForm.addEventListener('submit', sendPlan);
	}

	/* Small helpers. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
	}

	function countOf(amount, singular, plural = `${singular}s`) {
		return `${amount} ${amount === 1 ? singular : plural}`;
	}

	function notify(options) {
		window.Basalt.toasts?.push(options);
	}

	function sayAloud(text) {
		window.Basalt.announce?.(text);
	}

	function queryHits(text, query) {
		if (window.Basalt?.matchesQuery) return window.Basalt.matchesQuery(text, query);
		return String(text).toLowerCase().includes(query.toLowerCase());
	}

	function sheetSlot(key) {
		return pick(`[data-mt-s="${key}"]`, dom.sheet);
	}

	function field(name) {
		return dom.planForm.elements[name];
	}

	/* Dates and times, in the words the page uses. */
	function midnightOf(date) {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate());
	}

	function isoDay(date) {
		const pad = (part) => String(part).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	}

	function onSameDay(a, b) {
		return isoDay(a) === isoDay(b);
	}

	function briefDate(date) {
		return `${WEEKDAYS[date.getDay()].slice(0, 3)}, ${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
	}

	function fullDate(date) {
		return `${WEEKDAYS[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
	}

	function clockTime(date) {
		const hour = date.getHours() % 12 || 12;
		return `${hour}:${String(date.getMinutes()).padStart(2, '0')} ${date.getHours() < 12 ? 'AM' : 'PM'}`;
	}

	/* "45 min", "1 h", "1 h 30 min". */
	function durationText(minutes) {
		const hours = Math.floor(minutes / 60);
		const rest = minutes % 60;
		if (!hours) return `${rest} min`;
		return `${hours} h${rest ? ` ${rest} min` : ''}`;
	}

	/* "2:00 to 3:00 PM", or "11:30 AM to 12:15 PM" across noon. */
	function timeRange(meeting) {
		const opens = clockTime(meeting.start);
		const closes = clockTime(finishOf(meeting));
		const sameHalf = opens.slice(-2) === closes.slice(-2);
		return `${sameHalf ? opens.slice(0, -3) : opens} to ${closes}`;
	}

	/* Under an hour reads in minutes; above it, rounded to the quarter. */
	function minutesInWords(minutes) {
		return minutes < 60 ? countOf(minutes, 'min', 'min') : durationText(Math.round(minutes / 15) * 15);
	}

	function workingDaysFrom(first, wanted) {
		const days = [];
		for (let cursor = new Date(first); days.length < wanted; cursor.setDate(cursor.getDate() + 1)) {
			if (cursor.getDay() !== 0 && cursor.getDay() !== 6) days.push(new Date(cursor));
		}
		return days;
	}

	/* About a meeting. */
	function givenName(id) {
		return nameFor(id).split(' ')[0];
	}

	function detailUrl(meeting) {
		return `meeting-details.html?id=${encodeURIComponent(meeting.id)}`;
	}

	function isAhead(meeting) {
		const phase = phaseOf(meeting);
		return phase === 'live' || phase === 'next';
	}

	function keptOnCalendar(meeting) {
		return !meeting.canceled && meeting.reply !== 'no';
	}

	function awaitsNotes(meeting) {
		return phaseOf(meeting) === 'past' && meeting.reply === 'host' && !meeting.notes;
	}

	function yourReply(meeting) {
		return meeting.reply === 'host' ? replyLabels.host : replyLabels[meeting.reply];
	}

	function invitedIds(meeting) {
		return [meeting.by].concat(meeting.people.filter((id) => id !== meeting.by));
	}

	function guestsOf(meeting) {
		return meeting.guests || [];
	}

	function headcount(meeting) {
		return meeting.everyone || invitedIds(meeting).length + guestsOf(meeting).length;
	}

	function goingCount(meeting) {
		return invitedIds(meeting).filter((id) => replyFrom(meeting, id) === 'yes').length + guestsOf(meeting).length;
	}

	/* Any other meeting on the calendar that overlaps this one. */
	function overlapFor(meeting) {
		const finish = finishOf(meeting);
		return schedule.find(
			(other) =>
				other !== meeting &&
				keptOnCalendar(other) &&
				other.reply !== 'ask' &&
				other.start < finish &&
				finishOf(other) > meeting.start,
		);
	}

	function notesStatus(meeting) {
		if (meeting.canceled) return { key: 'none', label: 'Canceled', tone: '' };
		if (meeting.notes) return { key: 'done', label: 'Written up', tone: 'success' };
		if (meeting.reply === 'host') return { key: 'todo', label: 'Notes to write', tone: 'warning' };
		return { key: 'none', label: 'No notes shared', tone: '' };
	}

	function byStart(a, b) {
		return a.start - b.start;
	}

	function byStartDesc(a, b) {
		return b.start - a.start;
	}

	/* Bits of markup the tables and the panel share. */
	function stateTag(label, tone, extra) {
		return `<span class="basalt-status${tone ? ` basalt-status-${tone}` : ''}${extra ? ` ${extra}` : ''}">${htmlSafe(label)}</span>`;
	}

	function livePill(label) {
		return stateTag(label, 'danger', 'basalt-status-dot basalt-status-live');
	}

	function kindBadge(kind, large) {
		return `<span class="mt-type${large ? ' mt-type-lg' : ''} mt-tone-${kind}" aria-hidden="true"><i class="bi ${kindInfo[kind].icon}"></i></span>`;
	}

	function avatarStack(meeting) {
		const names = meeting.people.map((id) => nameFor(id)).concat(guestsOf(meeting).map((guest) => guest[0]));
		const total = meeting.everyone || names.length;
		const shown = names.slice(0, total > 5 ? 4 : 5);
		const hidden = total - shown.length;
		const faces = shown
			.map(
				(name) =>
					`<span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(name)}"></span>`,
			)
			.join('');
		return `<div class="basalt-avatar-group basalt-avatar-group-sm" role="img" aria-label="${htmlSafe(countOf(total, 'person', 'people'))} invited">${faces}${hidden > 0 ? `<span class="basalt-avatar basalt-avatar-sm basalt-avatar-more">+${hidden}</span>` : ''}</div>`;
	}

	function byline(meeting) {
		const organizer = meeting.by === myId ? 'You' : nameFor(meeting.by);
		return `${organizer} · ${meeting.link ? meeting.link.name : kindInfo[meeting.kind].label}`;
	}

	function meetingSummary(meeting) {
		return `<div class="mt-what">${kindBadge(meeting.kind)}<div class="mt-what-text"><a class="mt-what-title" href="${detailUrl(meeting)}">${htmlSafe(meeting.title)}</a><span class="mt-what-sub">${htmlSafe(byline(meeting))}</span></div></div>`;
	}

	/* Every row ends with its two ways in: the quick view and the full page. */
	function rowLinks(meeting) {
		return `<span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-mt-open="${meeting.id}" aria-label="Quick view: ${htmlSafe(meeting.title)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${detailUrl(meeting)}" aria-label="Open full page: ${htmlSafe(meeting.title)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span>`;
	}

	function smallButton(label, attributes, primary) {
		return `<button type="button" class="btn btn-sm ${primary ? 'btn-primary' : 'btn-outline-secondary'}" ${attributes}>${label}</button>`;
	}

	/* An empty state. The lead card's one carries the heading the card
     is labeled by; a day with nothing booked gets the compact look. */
	function emptyBlock({ icon, title, text, look = 'success', asHeading = false }) {
		const heading = asHeading
			? `<h2 class="basalt-empty-title" id="mt-now-title">${title}</h2>`
			: `<p class="basalt-empty-title">${title}</p>`;
		return `<div class="basalt-empty basalt-empty-${look}" role="status"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi ${icon}"></i></span>${heading}<p class="basalt-empty-text">${text}</p></div>`;
	}

	function enhance(node) {
		if (window.Basalt.avatars) window.Basalt.avatars(node);
		if (window.Basalt.tips) window.Basalt.tips(node);
	}

	/* Drawing. Everything is redrawn from `schedule` after any change;
     an open panel is redrawn too, without losing keyboard focus. */
	function drawEverything() {
		drawTabCounts();
		drawHeadline();
		drawTodos();
		drawStrip();
		drawUpcoming();
		drawInvitations();
		drawPast();
		if (!view.sheetId || !dom.sheet.classList.contains('show')) return;
		const hadFocus = dom.sheet.contains(document.activeElement);
		fillSheet(meetingById(view.sheetId), false);
		const focused = document.activeElement;
		if (hadFocus && (!dom.sheet.contains(focused) || focused.closest('[hidden]'))) sheetSlot('title').focus();
	}

	function drawTabCounts() {
		pick('[data-mt-count="next"]').textContent = schedule.filter(isAhead).length;
		pick('[data-mt-count="reply"]').textContent = schedule.filter(
			(meeting) => isAhead(meeting) && meeting.reply === 'ask',
		).length;
	}

	/* The lead card: the meeting under way, or the next one you are going
     to. Its bar shows how far through it is. */
	function headlineMeeting() {
		const ahead = schedule.filter((meeting) => isAhead(meeting) && meeting.reply !== 'no').sort(byStart);
		return ahead.find((meeting) => phaseOf(meeting) === 'live') || ahead[0];
	}

	function drawHeadline() {
		const meeting = headlineMeeting();
		if (!meeting) {
			dom.headline.innerHTML = emptyBlock({
				icon: 'bi-calendar-check',
				title: 'Nothing booked',
				text: 'Your calendar is clear for the next five working days.',
				asHeading: true,
			});
			return;
		}
		const kind = kindInfo[meeting.kind];
		const live = phaseOf(meeting) === 'live';
		const untilStart = Math.round((meeting.start - now) / 60000);
		const elapsed = live ? Math.round((now - meeting.start) / 60000) : 0;
		const standing = live
			? `${livePill('Happening now')}<span class="mt-now-when">${minutesInWords(meeting.mins - elapsed)} left</span>`
			: `${stateTag('Up next', 'primary')}<span class="mt-now-when">${onSameDay(meeting.start, todayStart) ? `in ${minutesInWords(untilStart)}` : `${briefDate(meeting.start)} at ${clockTime(meeting.start)}`}</span>`;
		const attendance = meeting.everyone ? 'Whole company' : `${goingCount(meeting)} of ${headcount(meeting)} going`;
		const track = `<span class="mt-now-track" role="img" aria-label="${live ? htmlSafe(`${elapsed} of ${meeting.mins} minutes gone`) : 'Not started'}"><span class="mt-now-fill" style="width:${((elapsed / meeting.mins) * 100).toFixed(1)}%"></span></span>`;
		dom.headline.className = `mt-now-main mt-tone-${meeting.kind}`;
		dom.headline.innerHTML = `<p class="mt-now-state">${standing}</p><div class="mt-now-head">${kindBadge(meeting.kind, true)}<div class="mt-now-titles"><h2 class="mt-now-title" id="mt-now-title"><a href="${detailUrl(meeting)}">${htmlSafe(meeting.title)}</a></h2><p class="mt-now-sub">${htmlSafe(byline(meeting))}</p></div></div><p class="mt-now-about">${htmlSafe(meeting.about)}</p><div class="mt-now-time"><span class="mt-now-at">${clockTime(meeting.start)}</span>${track}<span class="mt-now-at">${clockTime(finishOf(meeting))}</span></div><div class="mt-now-foot"><div class="mt-now-people">${avatarStack(meeting)}<span class="mt-now-going">${attendance}</span></div><div class="mt-now-actions"><button type="button" class="btn btn-outline-secondary" data-mt-open="${meeting.id}">Agenda and people</button><button type="button" class="btn btn-primary" data-mt-go="${meeting.id}"><i class="bi ${kind.icon} me-1" aria-hidden="true"></i>${kind.go}</button></div></div>`;
		if (window.Basalt.avatars) window.Basalt.avatars(dom.headline);
	}

	/* Waiting on you: three short to-dos, each with the one button that
     deals with it. A finished one says so rather than hiding. */
	function todoItem(tone, icon, title, text, button = '') {
		return `<li class="mt-todo-item mt-todo-${tone}"><span class="mt-todo-icon" aria-hidden="true"><i class="bi ${icon}"></i></span><span class="mt-todo-text"><span class="mt-todo-title">${title}</span><span class="mt-todo-sub">${text}</span></span>${button}</li>`;
	}

	function drawTodos() {
		const asks = schedule.filter((meeting) => isAhead(meeting) && meeting.reply === 'ask').sort(byStart);
		const unwritten = schedule.filter(awaitsNotes).sort(byStartDesc);
		const ahead = schedule.filter((meeting) => isAhead(meeting) && keptOnCalendar(meeting)).sort(byStart);
		const clash = ahead.find((meeting) =>
			ahead.some(
				(other) => other !== meeting && other.start < finishOf(meeting) && finishOf(other) > meeting.start,
			),
		);

		const askItem = asks.length
			? todoItem(
					'reply',
					'bi-envelope-paper',
					`${countOf(asks.length, 'invitation')} to answer`,
					`${htmlSafe(asks[0].title)} is the soonest`,
					smallButton('Answer', 'data-mt-tab="reply"'),
				)
			: todoItem('done', 'bi-envelope-check', 'Every invitation answered', 'New ones show up here.');
		const notesItem = unwritten.length
			? todoItem(
					'notes',
					'bi-journal-text',
					`${countOf(unwritten.length, 'meeting')} to write up`,
					htmlSafe(unwritten[0].title) + (unwritten.length > 1 ? ` and ${unwritten.length - 1} more` : ''),
					smallButton('Write up', 'data-mt-tab="past"'),
				)
			: todoItem('done', 'bi-journal-check', 'Every write-up sent', 'Meetings you run land here once they end.');
		const clashItem = clash
			? todoItem(
					'clash',
					'bi-exclamation-circle',
					`A clash on ${briefDate(clash.start)}`,
					`${htmlSafe(clash.title)}, ${clockTime(clash.start)}`,
					smallButton(
						'Sort it out',
						`data-mt-open="${clash.id}"${clash.reply === 'host' ? '' : ' data-mt-focus="reply"'}`,
					),
				)
			: todoItem('done', 'bi-calendar-check', 'No clashes', 'None of your meetings overlap.');

		dom.todos.innerHTML = askItem + notesItem + clashItem;
	}

	/* The five-day strip: a tile per working day with a track of blocks. */
	function dayTile(date) {
		const booked = schedule.filter((meeting) => keptOnCalendar(meeting) && onSameDay(meeting.start, date));
		const ahead = booked.filter(isAhead);
		const minutes = ahead.reduce((sum, meeting) => sum + meeting.mins, 0);
		const today = onSameDay(date, todayStart);
		const dayName = today ? 'Today' : WEEKDAYS[date.getDay()].slice(0, 3);

		const blocks = booked
			.map((meeting) => {
				const offset = Math.max(
					0,
					meeting.start.getHours() * 60 + meeting.start.getMinutes() - TRACK_START_MIN,
				);
				const left = Math.min(100, (offset / TRACK_SPAN_MIN) * 100);
				const width = Math.min(100 - left, (meeting.mins / TRACK_SPAN_MIN) * 100);
				return `<span class="mt-day-seg mt-tone-${meeting.kind}${isAhead(meeting) ? '' : ' is-done'}" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%"></span>`;
			})
			.join('');
		const nowLine = today
			? `<span class="mt-day-now" style="left:${(((now.getHours() * 60 + now.getMinutes() - TRACK_START_MIN) / TRACK_SPAN_MIN) * 100).toFixed(2)}%"></span>`
			: '';

		const tally = `<span class="mt-day-n">${ahead.length}</span> <span class="mt-day-word">${today ? 'left' : ahead.length === 1 ? 'meeting' : 'meetings'}</span>`;
		const spoken = `${fullDate(date)}: ${today ? `${ahead.length} meetings left today` : countOf(ahead.length, 'meeting')}, ${durationText(minutes || 0)} booked`;
		return `<button type="button" class="mt-day${today ? ' is-today' : ''}" aria-pressed="${view.day === isoDay(date)}" aria-label="${htmlSafe(spoken)}" data-mt-day="${isoDay(date)}"><span class="mt-day-head"><span class="mt-day-name">${dayName}</span><span class="mt-day-date">${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getDate()}</span></span><span class="mt-day-track" aria-hidden="true">${blocks}${nowLine}</span><span class="mt-day-foot"><span class="mt-day-count">${tally}</span><span class="mt-day-hours">${minutes ? durationText(minutes) : 'Free'}</span></span></button>`;
	}

	function drawStrip() {
		dom.strip.innerHTML = stripDays.map(dayTile).join('');
	}

	/* Coming up: the meetings grouped under a heading row per day. A
     pressed tile in the strip narrows the list to that day. */
	function upcomingRow(meeting) {
		const live = phaseOf(meeting) === 'live';
		const reply = yourReply(meeting);
		const kind = kindInfo[meeting.kind];
		let action;
		if (meeting.reply === 'ask')
			action = smallButton('Reply', `data-mt-open="${meeting.id}" data-mt-focus="reply"`);
		else if (live)
			action = smallButton(
				`<i class="bi ${kind.icon} me-1" aria-hidden="true"></i>${kind.short}`,
				`data-mt-go="${meeting.id}"`,
				true,
			);
		else action = smallButton(kind.short, `data-mt-go="${meeting.id}"`);
		const rowClass = `mt-row${live ? ' is-live' : ''}${meeting.reply === 'no' ? ' is-declined' : ''}`;
		return `<tr class="${rowClass}" data-mt-row="${meeting.id}"><td class="mt-time"><span class="mt-time-at">${clockTime(meeting.start)}</span><span class="mt-time-len">${live ? livePill('Now') : durationText(meeting.mins)}</span></td><td>${meetingSummary(meeting)}</td><td class="mt-who">${avatarStack(meeting)}</td><td class="mt-you">${stateTag(reply.label, reply.tone)}</td><td class="mt-act">${action}${rowLinks(meeting)}</td></tr>`;
	}

	function dayHeadingRow(date, list) {
		const name = (onSameDay(date, todayStart) ? 'Today, ' : '') + fullDate(date);
		const minutes = list
			.filter((meeting) => meeting.reply !== 'no')
			.reduce((sum, meeting) => sum + meeting.mins, 0);
		const summary = list.length ? `${countOf(list.length, 'meeting')} · ${durationText(minutes)}` : '';
		return `<tr class="mt-dayrow"><th colspan="5" scope="colgroup"><span class="mt-dayrow-in"><span class="mt-dayrow-name">${name}</span><span class="mt-dayrow-sum">${summary}</span></span></th></tr>`;
	}

	function freeDayRow(date) {
		const block = emptyBlock({
			icon: 'bi-calendar-check',
			title: 'Nothing booked',
			text: `${htmlSafe(WEEKDAYS[date.getDay()])} is free for focused work.`,
			look: 'compact',
		});
		return `<tr class="mt-row-empty"><td colspan="5">${block}</td></tr>`;
	}

	function drawUpcoming() {
		const coming = schedule.filter(isAhead).sort(byStart);
		const leftToday = coming.filter(
			(meeting) => onSameDay(meeting.start, todayStart) && meeting.reply !== 'no',
		).length;
		dom.upcomingSub.textContent = leftToday
			? `${countOf(leftToday, 'meeting')} left today and ${coming.length - leftToday} more after that.`
			: `Nothing more today. ${countOf(coming.length, 'meeting')} after that.`;
		dom.stripClear.hidden = !view.day;

		const perDay = new Map();
		for (const meeting of coming) {
			const key = isoDay(meeting.start);
			if (!perDay.has(key)) perDay.set(key, []);
			perDay.get(key).push(meeting);
		}
		if (view.day && !perDay.has(view.day)) perDay.set(view.day, []);

		const keys = [...perDay.keys()].sort().filter((key) => !view.day || key === view.day);
		dom.upcoming.innerHTML = keys
			.map((key) => {
				const list = perDay.get(key);
				const date = new Date(`${key}T00:00`);
				return dayHeadingRow(date, list) + (list.length ? list.map(upcomingRow).join('') : freeDayRow(date));
			})
			.join('');
		enhance(dom.upcoming);
	}

	/* Your reply: each invitation says whether it clashes with something
     already on your calendar. */
	function calendarNote(meeting) {
		const clash = overlapFor(meeting);
		if (!clash)
			return '<span class="mt-cal"><i class="bi bi-check-circle" aria-hidden="true"></i><span>You\'re free then</span></span>';
		return `<span class="mt-cal mt-cal-clash"><i class="bi bi-exclamation-circle" aria-hidden="true"></i><span>Clashes with <button type="button" class="mt-cal-link" data-mt-open="${clash.id}">${htmlSafe(clash.title)}</button></span></span>`;
	}

	function invitationRow(meeting) {
		const answers = `<button type="button" class="btn btn-sm btn-outline-secondary" data-mt-answer="no" data-id="${meeting.id}">Decline</button><button type="button" class="btn btn-sm btn-primary" data-mt-answer="yes" data-id="${meeting.id}">Accept</button>`;
		return `<tr class="mt-row" data-mt-row="${meeting.id}"><td class="mt-time"><span class="mt-time-at">${briefDate(meeting.start)}</span><span class="mt-time-len">${clockTime(meeting.start)} · ${durationText(meeting.mins)}</span></td><td>${meetingSummary(meeting)}</td><td class="mt-calcell">${calendarNote(meeting)}</td><td class="mt-act mt-act-pair">${answers}${rowLinks(meeting)}</td></tr>`;
	}

	function drawInvitations() {
		const asks = schedule.filter((meeting) => isAhead(meeting) && meeting.reply === 'ask').sort(byStart);
		dom.invitationsSub.textContent = asks.length
			? `${countOf(asks.length, 'invitation')}, soonest first. Each organizer sees your answer straight away.`
			: 'Every invitation has an answer.';
		dom.invitationsTable.hidden = !asks.length;
		dom.invitationsEmpty.hidden = Boolean(asks.length);
		if (!asks.length)
			dom.invitationsEmpty.innerHTML = emptyBlock({
				icon: 'bi-check2-circle',
				title: 'All answered',
				text: 'New invitations show up here until you reply.',
			});
		dom.invitations.innerHTML = asks.map(invitationRow).join('');
		if (window.Basalt.tips) window.Basalt.tips(dom.invitations);
	}

	/* Past: newest first, narrowed by the search and the notes select. */
	function pastRow(meeting) {
		const notes = notesStatus(meeting);
		const action = notes.key === 'todo' ? smallButton('Write up', `data-mt-open="${meeting.id}"`) : '';
		return `<tr class="mt-row${meeting.canceled ? ' is-canceled' : ''}" data-mt-row="${meeting.id}"><td class="mt-time"><span class="mt-time-at">${briefDate(meeting.start)}</span><span class="mt-time-len">${clockTime(meeting.start)} · ${durationText(meeting.mins)}</span></td><td>${meetingSummary(meeting)}</td><td class="mt-notes">${stateTag(notes.label, notes.tone)}</td><td class="mt-act">${action}${rowLinks(meeting)}</td></tr>`;
	}

	function pastHaystack(meeting) {
		return [
			meeting.title,
			nameFor(meeting.by),
			meeting.people.map(nameFor).join(' '),
			guestsOf(meeting)
				.map((guest) => guest.join(' '))
				.join(' '),
			meeting.link ? meeting.link.name : '',
			meeting.notes ? meeting.notes.summary : '',
		].join(' ');
	}

	function drawPast() {
		const gone = schedule
			.filter((meeting) => phaseOf(meeting) === 'past' || (meeting.canceled && meeting.start < now))
			.sort(byStartDesc);
		const { q, notes } = view.past;
		const shown = gone.filter((meeting) => {
			if (notes !== 'all' && notesStatus(meeting).key !== notes) return false;
			return !q || queryHits(pastHaystack(meeting), q);
		});
		const narrowed = q || notes !== 'all';
		dom.pastStatus.textContent = narrowed ? `Showing ${shown.length} of ${countOf(gone.length, 'meeting')}.` : '';
		dom.pastTable.hidden = !shown.length;
		dom.pastEmpty.hidden = Boolean(shown.length);
		if (!shown.length) {
			dom.pastEmpty.innerHTML =
				q && window.Basalt?.emptyState
					? window.Basalt.emptyState({ query: q, noun: 'meetings' })
					: emptyBlock({
							icon: 'bi-journal-check',
							title: 'Nothing to write up',
							text: 'Every meeting you organized has its notes.',
						});
		}
		dom.past.innerHTML = shown.map(pastRow).join('');
		if (window.Basalt.tips) window.Basalt.tips(dom.past);
	}

	/* The quick-view panel. */
	function sheetPanel() {
		return bootstrap.Offcanvas.getOrCreateInstance(dom.sheet);
	}

	function attendeeRow(meeting, id, over) {
		const person = directory[id];
		const reply = over ? null : replyLabels[replyFrom(meeting, id)];
		const tag =
			id === meeting.by ? stateTag('Organizer', 'primary') : reply ? stateTag(reply.label, reply.tone) : '';
		return `<li class="mt-person"><span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(person[0])}" aria-hidden="true"></span><span class="mt-person-text"><a class="mt-person-name" href="${source.personPage(id)}">${htmlSafe(person[0])}${id === myId ? ' (you)' : ''}</a><span class="mt-person-meta">${htmlSafe(person[1])}</span></span>${tag}</li>`;
	}

	function guestRow(guest, over) {
		return `<li class="mt-person"><span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(guest[0])}" aria-hidden="true"></span><span class="mt-person-text"><span class="mt-person-name">${htmlSafe(guest[0])}</span><span class="mt-person-meta">Guest · ${htmlSafe(guest[1])}</span></span>${over ? '' : stateTag('Going', 'success')}</li>`;
	}

	function attendeesSection(meeting, over) {
		const ids = invitedIds(meeting);
		const guests = guestsOf(meeting);
		const total = meeting.everyone || ids.length + guests.length;
		const everyone = ids.map((id) => ({ id })).concat(guests.map((guest) => ({ guest })));
		const listed = everyone.slice(0, total > 7 ? 6 : 7);
		const going = over ? 0 : goingCount(meeting);
		const line = over
			? ''
			: `<p class="mt-sheet-line">${meeting.everyone ? 'The whole company is invited.' : `${going} of ${total} going so far.`}</p>`;
		const rows = listed
			.map((entry) => (entry.id ? attendeeRow(meeting, entry.id, over) : guestRow(entry.guest, over)))
			.join('');
		const more =
			total > listed.length
				? `<p class="mt-sheet-more">and ${countOf(total - listed.length, 'more person', 'more people')}</p>`
				: '';
		return `<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">People <span class="basalt-drawer-count">${total}</span></h3>${line}<ul class="mt-people">${rows}</ul>${more}</section>`;
	}

	function factList(meeting) {
		const kind = kindInfo[meeting.kind];
		const place =
			meeting.kind === 'video' && isAhead(meeting)
				? `<a href="#" data-mt-go="${meeting.id}">${htmlSafe(meeting.where)}</a>`
				: htmlSafe(meeting.where);
		const facts = [
			`<li><i class="bi ${kind.icon}" aria-hidden="true"></i><span>${place}</span></li>`,
			`<li><i class="bi bi-person" aria-hidden="true"></i><span>${meeting.by === myId ? 'You organized it' : `Organized by ${htmlSafe(nameFor(meeting.by))}`}</span></li>`,
		];
		if (meeting.link) {
			facts.push(
				`<li><i class="bi ${meeting.link.type === 'Customer' ? 'bi-building' : 'bi-kanban'}" aria-hidden="true"></i><span>${meeting.link.type}: <a href="${meeting.link.href}">${htmlSafe(meeting.link.name)}</a></span></li>`,
			);
		}
		return `<ul class="mt-facts">${facts.join('')}</ul>`;
	}

	function sheetStatus(meeting) {
		const phase = phaseOf(meeting);
		if (phase === 'canceled') return stateTag('Canceled', '');
		if (phase === 'live') return livePill('Happening now');
		if (phase === 'past') {
			const notes = notesStatus(meeting);
			return stateTag(notes.label, notes.tone);
		}
		const reply = yourReply(meeting);
		return stateTag(reply.label, reply.tone);
	}

	function replyOption(value, label, icon, current) {
		return `<input type="radio" class="btn-check" name="mtAnswer" id="mt-answer-${value}" value="${value}"${current === value ? ' checked' : ''}><label class="basalt-segmented-option" for="mt-answer-${value}"><i class="bi ${icon}" aria-hidden="true"></i>${label}</label>`;
	}

	function replySection(meeting) {
		const current = meeting.reply === 'ask' ? '' : meeting.reply;
		const options =
			replyOption('yes', 'Going', 'bi-check2', current) +
			replyOption('maybe', 'Maybe', 'bi-question', current) +
			replyOption('no', 'Not going', 'bi-x-lg', current);
		return `<fieldset class="basalt-drawer-section" data-mt-s-reply><legend class="basalt-drawer-legend">Your reply</legend><div class="basalt-segmented basalt-segmented-sm basalt-segmented-block" role="radiogroup" aria-label="Your reply" data-basalt-segmented>${options}</div><p class="mt-sheet-hint">${htmlSafe(givenName(meeting.by))} sees your answer straight away.</p></fieldset>`;
	}

	function notesSection(meeting) {
		let inner;
		if (meeting.notes) {
			inner = `<p class="mt-sheet-notes">${htmlSafe(meeting.notes.summary)}</p>`;
			if (meeting.notes.steps.length) {
				const steps = meeting.notes.steps
					.map(
						(step) =>
							`<li><span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(nameFor(step[0]))}" aria-hidden="true"></span><span class="mt-steps-text"><span class="mt-steps-task">${htmlSafe(step[1])}</span><span class="mt-steps-who">${htmlSafe(nameFor(step[0]))}</span></span></li>`,
					)
					.join('');
				inner += `<h4 class="mt-sheet-sub">Next steps</h4><ul class="mt-steps">${steps}</ul>`;
			}
		} else if (meeting.reply === 'host') {
			inner = `<label class="visually-hidden" for="mt-notes-text">Notes for ${htmlSafe(meeting.title)}</label><textarea class="form-control" id="mt-notes-text" rows="5" placeholder="What was decided, and who does what next" aria-describedby="mt-notes-hint mt-notes-error" data-mt-notes-text></textarea><div class="invalid-feedback" id="mt-notes-error">Write a line or two before saving.</div><p class="mt-sheet-hint" id="mt-notes-hint">Everyone invited gets the notes by email when you save.</p>`;
		} else {
			inner = `<p class="mt-sheet-line">${htmlSafe(givenName(meeting.by))} hasn't shared notes from this one.</p>`;
		}
		return `<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">Notes</h3>${inner}</section>`;
	}

	function recordingSection(meeting) {
		return `<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">Recording</h3><button type="button" class="mt-rec" data-mt-rec><span class="mt-rec-play" aria-hidden="true"><i class="bi bi-play-fill"></i></span><span class="mt-rec-text"><span class="mt-rec-title">Play the recording</span><span class="mt-rec-meta">${durationText(meeting.rec)} · kept for 90 days</span></span></button></section>`;
	}

	function agendaSection(meeting) {
		const items = meeting.agenda
			.map(
				(item, index) =>
					`<li><span class="mt-agenda-n" aria-hidden="true">${index + 1}</span><span class="mt-agenda-text">${htmlSafe(item[0])}</span><span class="mt-agenda-mins">${item[1]} min</span></li>`,
			)
			.join('');
		return `<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">Agenda</h3><ol class="mt-agenda">${items}</ol></section>`;
	}

	/* The panel's head, body and foot all follow the meeting's state: a
     reply switch while it is ahead, notes (or a box to write them)
     once it is over, and buttons for what can still be done. */
	function fillSheet(meeting, fresh) {
		const phase = phaseOf(meeting);
		const kind = kindInfo[meeting.kind];
		const ahead = phase === 'next' || phase === 'live';
		const over = phase === 'past' || phase === 'canceled';
		const mine = meeting.reply === 'host';
		view.sheetId = meeting.id;

		sheetSlot('icon').className = `mt-type mt-type-lg mt-tone-${meeting.kind}`;
		sheetSlot('icon').innerHTML = `<i class="bi ${kind.icon}"></i>`;
		sheetSlot('title').textContent = meeting.title;
		sheetSlot('sub').textContent = `${briefDate(meeting.start)} · ${timeRange(meeting)}`;
		sheetSlot('page').href = detailUrl(meeting);

		const sections = [
			`<div class="basalt-drawer-section"><p class="mt-sheet-state">${sheetStatus(meeting)}</p><p class="mt-sheet-about">${htmlSafe(meeting.about)}</p>${factList(meeting)}</div>`,
		];
		if (ahead && !mine) sections.push(replySection(meeting));
		if (phase === 'past') {
			sections.push(notesSection(meeting));
			if (meeting.rec) sections.push(recordingSection(meeting));
		} else {
			sections.push(agendaSection(meeting));
		}
		sections.push(attendeesSection(meeting, over));
		sheetSlot('body').innerHTML = sections.join('');
		if (window.Basalt.avatars) window.Basalt.avatars(sheetSlot('body'));
		if (window.Basalt.buttons) window.Basalt.buttons(sheetSlot('body'));

		pick('[data-mt-s-cancel]', dom.sheet).hidden = !(mine && ahead);
		pick('[data-mt-s-move]', dom.sheet).hidden = !(mine && phase === 'next');
		pick('[data-mt-s-close]', dom.sheet).hidden = mine && ahead;
		const mainButton = pick('[data-mt-s-go]', dom.sheet);
		if (ahead) {
			mainButton.hidden = false;
			mainButton.dataset.do = 'go';
			mainButton.innerHTML = `<i class="bi ${kind.icon} me-1" aria-hidden="true"></i>${kind.go}`;
		} else if (awaitsNotes(meeting)) {
			mainButton.hidden = false;
			mainButton.dataset.do = 'notes';
			mainButton.innerHTML = '<i class="bi bi-send me-1" aria-hidden="true"></i>Save and send';
		} else {
			mainButton.hidden = true;
		}
		if (fresh) pick('.offcanvas-body', dom.sheet).scrollTop = 0;
	}

	function showSheet(id, focusOn) {
		const meeting = meetingById(id);
		if (!meeting) return;
		fillSheet(meeting, true);
		dom.sheet.dataset.focus = focusOn || '';
		sheetPanel().show();
	}

	/* Doing things to a meeting. */
	function joinMeeting(meeting) {
		const callPage = source.callPage(meeting);
		if (callPage) {
			window.location.href = callPage;
			return;
		}
		const kind = kindInfo[meeting.kind];
		notify({ tone: 'info', icon: kind.icon, title: kind.going, text: meeting.where });
	}

	function replyTo(meeting, answer) {
		const previous = meeting.reply;
		meeting.reply = answer;
		drawEverything();
		notify({
			tone: answer === 'no' ? 'info' : 'success',
			title: REPLY_TOASTS[answer],
			text: `${meeting.title}, ${briefDate(meeting.start)}. ${givenName(meeting.by)} has been told.`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						meeting.reply = previous;
						drawEverything();
					},
				},
			],
		});
	}

	function callOff(meeting) {
		meeting.canceled = true;
		sheetPanel().hide();
		drawEverything();
		notify({
			tone: 'info',
			icon: 'bi-calendar-x',
			title: 'Meeting canceled',
			text: `${meeting.title} is off everyone's calendar and they have been told.`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						meeting.canceled = false;
						drawEverything();
					},
				},
			],
		});
	}

	function sendNotes(meeting) {
		const box = pick('[data-mt-notes-text]', dom.sheet);
		const text = box ? box.value.trim() : '';
		if (!text) {
			box.classList.add('is-invalid');
			box.focus();
			return;
		}
		meeting.notes = { summary: text, steps: [] };
		drawEverything();
		notify({ tone: 'success', title: 'Notes sent', text: `Everyone invited to ${meeting.title} has them now.` });
	}

	/* The to-do buttons open the tab that deals with them; a write-up
     opens Past narrowed to the meetings still to write up. */
	function jumpToTab(which) {
		if (which === 'past') {
			dom.pastSearch.value = '';
			dom.pastNotes.value = 'todo';
			refreshSelect(dom.pastNotes);
			view.past = { q: '', notes: 'todo' };
			drawPast();
		}
		const tab = pick(which === 'past' ? '#mt-tab-past' : '#mt-tab-reply');
		bootstrap.Tab.getOrCreateInstance(tab).show();
		tab.focus({ preventScroll: true });
		tab.scrollIntoView({
			block: 'start',
			behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
		});
	}

	function rowUrl(event) {
		const row = event.target.closest('[data-mt-row]');
		if (!row || event.target.closest('a, button, input')) return '';
		return pick('.mt-what-title', row).href;
	}

	/* The planning panel: schedules a meeting, or moves one. */
	function planPanel() {
		return bootstrap.Offcanvas.getOrCreateInstance(dom.plan);
	}

	function refreshSelect(select) {
		if (window.Basalt.select?.refresh) window.Basalt.select.refresh(select);
	}

	function fillInviteList() {
		const others = Object.keys(directory)
			.filter((id) => id !== myId)
			.sort((a, b) => nameFor(a).localeCompare(nameFor(b)));
		dom.inviteSelect.innerHTML = others
			.map(
				(id) =>
					`<option value="${id}" data-hint="${htmlSafe(directory[id][1])}">${htmlSafe(nameFor(id))}</option>`,
			)
			.join('');
		refreshSelect(dom.inviteSelect);
	}

	function slugify(text) {
		return text
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 40);
	}

	function chosenKind() {
		return pick('input[name="kind"]:checked', dom.planForm)?.value || 'video';
	}

	function chosenMinutes() {
		return parseInt(pick('input[name="length"]:checked', dom.planForm)?.value || '30', 10);
	}

	function chosenInvitees() {
		return [...dom.inviteSelect.selectedOptions].map((option) => option.value);
	}

	function chosenStart() {
		const day = field('date').value;
		const at = field('time').value;
		return day && at ? new Date(`${day}T${at}`) : null;
	}

	/* The where field follows the kind: a link made from the name, a
     dial-in, or a blank for a room, unless the person typed their own. */
	function refreshPlace() {
		const kind = chosenKind();
		const place = PLACE_FIELDS[kind];
		pick('[data-mt-where-label]', dom.planForm).textContent = place.label;
		pick('[data-mt-where-hint]', dom.planForm).textContent = place.hint;
		field('where').placeholder = place.placeholder;
		if (placeEdited) return;
		const suggested = {
			video: `meet.fieldline.app/${slugify(field('title').value) || 'new-meeting'}`,
			phone: '+1 415 555 0190, PIN 4471',
		};
		field('where').value = suggested[kind] ?? '';
	}

	/* Says who already has something on at the chosen time. */
	function refreshAvailability() {
		const note = pick('[data-mt-plan-busy]', dom.planForm);
		const chosen = chosenInvitees();
		const start = chosenStart();

		function say(text, warn) {
			note.textContent = text;
			note.classList.toggle('is-warn', warn);
		}

		if (!chosen.length || !start) {
			say("You're the organizer, so you're already on the invite.", false);
			return;
		}
		const finish = new Date(start.getTime() + chosenMinutes() * 60000);
		const skipId = view.planMode === 'move' ? view.sheetId : null;
		const busy = chosen.filter((id) =>
			schedule.some(
				(meeting) =>
					meeting.id !== skipId &&
					!meeting.canceled &&
					meeting.start < finish &&
					finishOf(meeting) > start &&
					(meeting.by === id || meeting.people.indexOf(id) > -1) &&
					replyFrom(meeting, id) !== 'no',
			),
		);
		if (!busy.length) {
			say("Everyone you've added is free then.", false);
			return;
		}
		const names = busy.map(nameFor);
		const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
		say(`${who}${names.length === 1 ? ' has another meeting' : ' have other meetings'} then.`, true);
	}

	function checkRadio(name, value) {
		const radio = pick(`input[name="${name}"][value="${value}"]`, dom.planForm);
		if (!radio) return;
		radio.checked = true;
		radio.dispatchEvent(new Event('change', { bubbles: true }));
	}

	function showPlan(meeting) {
		dom.planForm.reset();
		for (const flagged of pickAll('.is-invalid', dom.planForm)) flagged.classList.remove('is-invalid');

		view.planMode = meeting ? 'move' : 'new';
		pick('[data-mt-plan-title]').textContent = meeting ? 'Move meeting' : 'Schedule a meeting';
		pick('[data-mt-plan-sub]').textContent = meeting
			? 'Everyone gets the new time and is asked again.'
			: 'Everyone you add gets an invite.';
		pick('[data-mt-plan-save]').innerHTML =
			`<i class="bi bi-send me-1" aria-hidden="true"></i>${meeting ? 'Send new time' : 'Send invites'}`;
		field('date').min = isoDay(todayStart);

		if (meeting) {
			field('title').value = meeting.title;
			field('date').value = isoDay(meeting.start);
			field('time').value =
				`${String(meeting.start.getHours()).padStart(2, '0')}:${String(meeting.start.getMinutes()).padStart(2, '0')}`;
			checkRadio('length', LENGTH_CHOICES.includes(meeting.mins) ? meeting.mins : 60);
			checkRadio('kind', meeting.kind);
			placeEdited = true;
			field('where').value = meeting.where;
			field('agenda').value = meeting.agenda.map((item) => item[0]).join('\n');
			for (const option of dom.inviteSelect.options) option.selected = meeting.people.indexOf(option.value) > -1;
		} else {
			field('date').value = isoDay(stripDays[1]);
			field('time').value = '10:00';
			checkRadio('length', 30);
			checkRadio('kind', 'video');
			placeEdited = false;
			for (const option of dom.inviteSelect.options) option.selected = false;
		}
		refreshSelect(dom.inviteSelect);
		refreshPlace();
		refreshAvailability();
		planPanel().show();
	}

	/* Checks the name, day and time, then either moves the open meeting
     to the new details or adds a new one and opens Coming up on it. */
	function sendPlan(event) {
		event.preventDefault();
		const title = field('title').value.trim();
		const start = chosenStart();
		const at = field('time').value;
		const wrong = [];
		if (!title) wrong.push(field('title'));
		if (!field('date').value || field('date').value < isoDay(todayStart)) wrong.push(field('date'));
		if (!at || at < '07:00' || at > '19:00' || (start && start < now)) wrong.push(field('time'));

		for (const flagged of pickAll('.is-invalid', dom.planForm)) flagged.classList.remove('is-invalid');

		if (wrong.length) {
			for (const input of wrong) input.classList.add('is-invalid');
			const passedToday = start && start < now && field('date').value === isoDay(todayStart);
			pick('#mt-plan-time-error').textContent = passedToday
				? 'That time has already passed today.'
				: 'Pick a time between 7:00 AM and 7:00 PM.';
			wrong[0].focus();
			return;
		}

		const people = [myId].concat(chosenInvitees());
		const lines = field('agenda')
			.value.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);
		const minutes = chosenMinutes();
		const details = {
			title,
			start,
			mins: minutes,
			kind: chosenKind(),
			people,
			where: field('where').value.trim() || PLACE_FIELDS[chosenKind()].placeholder,
			agenda: lines.length
				? lines.map((line) => [line, Math.max(5, Math.round(minutes / lines.length / 5) * 5)])
				: [['Open discussion', minutes]],
		};
		const answers = {};
		for (const id of people) {
			if (id !== myId) answers[id] = 'wait';
		}

		let meeting;
		if (view.planMode === 'move') {
			meeting = meetingById(view.sheetId);
			Object.assign(meeting, details);
			meeting.answers = answers;
		} else {
			meeting = {
				id: `m${schedule.length + 1}-${Date.now().toString(36)}`,
				by: myId,
				reply: 'host',
				about: 'Booked from the Meetings page.',
				answers,
				...details,
			};
			schedule.push(meeting);
		}

		planPanel().hide();
		view.day = null;
		drawEverything();
		bootstrap.Tab.getOrCreateInstance(pick('#mt-tab-next')).show();
		const others = people.length - 1;
		notify({
			tone: 'success',
			icon: 'bi-send-check',
			title: view.planMode === 'move' ? 'New time sent' : 'Invites sent',
			text: `${others ? `To ${countOf(others, 'person', 'people')}` : 'Just you so far'} for ${briefDate(start)} at ${clockTime(start)}.`,
			actions: [{ label: 'Open', onClick: () => showSheet(meeting.id) }],
		});
	}

	start();
})();
