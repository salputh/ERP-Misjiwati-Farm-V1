/**
 * Runs meeting-details.html, the page a single meeting opens on.
 *
 * The record is the one the Meetings list shows, read from
 * assets/basalt/js/data/multipurpose/meetings.js: ?id=m14 picks the Highpoint Outfitters renewal,
 * and a bare link from the menu falls back to the EU data region call.
 * The cards are ordered by where the meeting stands. Before it starts, the
 * date, the join button and your reply come first; once it is over, the
 * write-up, the recording and the notes do. The agenda, the write-up, the
 * notes, the files, your reply, a new time and calling it off are all
 * changed right on the page.
 */
(() => {
	'use strict';

	const root = pick('[data-mdt-root]');
	const store = window.Basalt.data?.meetings;
	if (!root || !store) return;

	const { NOW: now, ME: myId, endOf: endsAt, stateOf: phaseOf, nameOf: wholeName, answerOf: replyOf } = store;
	const FALLBACK_ID = 'm02';
	const DAY_MS = 86400000;
	const PEOPLE_BEFORE_MORE = 6;
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
	const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	const today = startOfDay(now);

	/* Arriving from the list brings ?id=; any other way in shows a sample
     meeting, so the page is never blank. */
	const meeting =
		store.recordWithId(new URLSearchParams(window.location.search).get('id')) || store.recordWithId(FALLBACK_ID);
	const medium = store.kinds[meeting.kind];

	/* Reply groups in the order the bar and its legend list them. */
	const REPLY_GROUPS = [
		{ key: 'yes', words: 'going', swatch: 'success' },
		{ key: 'maybe', words: 'maybe', swatch: 'warning' },
		{ key: 'wait', words: 'no reply yet', swatch: 'wait' },
		{ key: 'no', words: 'not going', swatch: 'no' },
	];

	/* How each attachment is drawn; tone is its step on the chart ramp. */
	const FILE_KINDS = {
		pdf: { icon: 'bi-file-earmark-pdf', label: 'PDF', tone: 4 },
		sheet: { icon: 'bi-file-earmark-spreadsheet', label: 'Spreadsheet', tone: 2 },
		doc: { icon: 'bi-file-earmark-text', label: 'Document', tone: 0 },
		slides: { icon: 'bi-file-earmark-slides', label: 'Slides', tone: 5 },
		image: { icon: 'bi-file-earmark-image', label: 'Image', tone: 6 },
		other: { icon: 'bi-file-earmark', label: 'File', tone: 7 },
	};
	const EXTENSION_KINDS = new Map(
		Object.entries({
			pdf: ['pdf'],
			sheet: ['xls', 'xlsx', 'csv', 'numbers'],
			doc: ['doc', 'docx', 'txt', 'md', 'pages', 'rtf'],
			slides: ['ppt', 'pptx', 'key'],
			image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'svg'],
		}).flatMap(([kind, extensions]) => extensions.map((extension) => [extension, kind])),
	);

	/* Every element the script fills or listens to, found once. */
	const HOOKS = {
		title: '[data-mdt="title"]',
		subtitle: '[data-mdt="sub"]',
		tags: '[data-mdt="tags"]',
		mainAction: '[data-mdt-primary]',
		moreMenu: '[data-mdt="menu"]',
		earlier: '[data-mdt="prev"]',
		later: '[data-mdt="next"]',
		notice: '[data-mdt="notice"]',
		grid: '[data-mdt="grid"]',
		whenBody: '[data-mdt="when"]',
		outcomeView: '[data-mdt="outcome"]',
		outcomeNote: '[data-mdt="outcome-desc"]',
		outcomeEditButton: '[data-mdt-outcome-edit]',
		outcomeForm: '[data-mdt-outcome-form]',
		outcomeCancel: '[data-mdt-outcome-cancel]',
		summaryField: '[data-mdt-summary]',
		summaryError: '#mdt-summary-error',
		decisionList: '[data-mdt-decisions]',
		addDecision: '[data-mdt-add-decision]',
		taskList: '[data-mdt-steps-edit]',
		addTask: '[data-mdt-add-step]',
		recordingNote: '[data-mdt="hire-desc"]',
		recordingCopy: '[data-mdt-rec-copy]',
		track: '[data-mdt="track"]',
		position: '[data-mdt="at"]',
		runtime: '[data-mdt="len"]',
		playButton: '[data-mdt-play]',
		chapterList: '[data-mdt="chapters"]',
		agendaView: '[data-mdt="agenda"]',
		agendaNote: '[data-mdt="agenda-desc"]',
		agendaEditButton: '[data-mdt-agenda-edit]',
		agendaForm: '[data-mdt-agenda-form]',
		agendaCancel: '[data-mdt-agenda-cancel]',
		agendaRows: '[data-mdt-agenda-rows]',
		addAgendaItem: '[data-mdt-add-item]',
		agendaTally: '[data-mdt-agenda-sum]',
		replies: '[data-mdt="replies"]',
		peopleList: '[data-mdt="people"]',
		peopleNote: '[data-mdt="people-desc"]',
		moreButton: '[data-mdt-people-more]',
		notesView: '[data-mdt="notes"]',
		notesNote: '[data-mdt="notes-desc"]',
		notesEditButton: '[data-mdt-notes-edit]',
		notesCancel: '[data-mdt-notes-cancel]',
		notesSave: '[data-mdt-notes-save]',
		editor: '[data-mdt-editor]',
		writingArea: '[data-mdt-notes-body]',
		wordTally: '[data-mdt-words]',
		fileList: '[data-mdt="files"]',
		filesNote: '[data-mdt="files-desc"]',
		filePicker: '[data-mdt-file-input]',
		uploadLabel: '.mdt-upload',
		moveDialog: '#mdt-move',
		moveForm: '[data-mdt-move-form]',
		moveHeading: '[data-mdt-move-title]',
		moveClashes: '[data-mdt-move-busy]',
		cancelDialog: '#mdt-cancel',
		cancelText: '[data-mdt-cancel-text]',
		cancelConfirm: '[data-mdt-cancel-go]',
	};
	const nodes = Object.fromEntries(Object.entries(HOOKS).map(([name, selector]) => [name, pick(selector)]));
	const panels = Object.fromEntries(
		pickAll('[data-mdt-card]', nodes.grid).map((panel) => [panel.dataset.mdtCard, panel]),
	);

	const view = { arrangement: '', everyoneListed: false, playhead: 0, ticker: null };

	/* One counter feeds the ids of every row the editors add, so labels and
     inputs never share an id across the decision, task and agenda lists. */
	let fieldSerial = 0;

	/* What each action name in the menu, the notice and the header button does. */
	const ACTIONS = {
		go: joinMeeting,
		write: openWriteUp,
		play: playFromHeader,
		move: openMoveDialog,
		cancel: openCancelDialog,
		agenda: openAgendaEditor,
		email: () =>
			notify({
				tone: 'success',
				icon: 'bi-envelope-check',
				title: 'Notes sent',
				text: `Everyone invited to ${meeting.title} has them by email.`,
			}),
		copy: () =>
			copyText(window.location.href).then(() =>
				notify({
					tone: 'success',
					icon: 'bi-link-45deg',
					title: 'Link copied',
					text: 'It opens this meeting.',
				}),
			),
		print: () => window.print(),
	};

	function start() {
		wireActions();
		wireReply();
		wireWriteUp();
		wireRecording();
		wireAgendaEditor();
		wirePeople();
		wireNotesEditor();
		wireFiles();
		wireDialogs();
		redraw();
	}

	/* Paints every card from the record. When the state changed enough to
     move the cards around, reading starts again at the title. */
	function redraw() {
		const before = view.arrangement;
		for (const paint of [
			arrangeCards,
			drawHeader,
			drawWhen,
			drawOutcome,
			drawRecording,
			drawAgenda,
			drawPeople,
			drawNotes,
			drawFiles,
		])
			paint();
		if (before && before !== view.arrangement) nodes.title.focus({ preventScroll: true });
	}

	/* The cards are regrouped into rows whenever the state calls for it. */

	/**
	 * The rows of cards for a meeting in this state. A row with one card
	 * spans the page; a row with two gives the first one two thirds.
	 */
	function rowPlan(phase, hasNotes) {
		if (phase === 'canceled') return [['agenda', 'people']];
		if (phase !== 'past') return [['when'], ['agenda', 'people'], ['notes', 'files']];
		/* With nothing written yet, the empty notes card sinks to the bottom. */
		if (meeting.rec) {
			return hasNotes
				? [['outcome'], ['rec', 'files'], ['notes'], ['agenda', 'people']]
				: [['outcome'], ['rec', 'files'], ['agenda', 'people'], ['notes']];
		}
		return hasNotes
			? [['outcome'], ['notes', 'files'], ['agenda', 'people']]
			: [['outcome'], ['agenda', 'people'], ['notes', 'files']];
	}

	function arrangeCards() {
		const phase = phaseOf(meeting);
		const hasNotes = Boolean(notesMarkup());
		const signature = [phase, meeting.rec ? 'rec' : '', hasNotes ? 'notes' : ''].join('/');
		if (signature === view.arrangement) return;
		view.arrangement = signature;

		const placed = new Set();
		const batch = document.createDocumentFragment();
		for (const names of rowPlan(phase, hasNotes)) {
			const row = batch.appendChild(document.createElement('div'));
			row.className = names.length > 1 ? 'mdt-row mdt-row-pair' : 'mdt-row';
			for (const name of names) {
				panels[name].hidden = false;
				row.append(panels[name]);
				placed.add(name);
			}
		}
		/* Cards this state has no use for wait, hidden, after the rows. */
		for (const [name, panel] of Object.entries(panels)) {
			if (placed.has(name)) continue;
			panel.hidden = true;
			batch.append(panel);
		}
		nodes.grid.replaceChildren(batch);
	}

	/* The header carries the name, the state, the main button, the menu and
     the pager. */

	function drawHeader() {
		const phase = phaseOf(meeting);
		nodes.title.textContent = meeting.title;
		document.title = `${meeting.title} · Basalt`;
		nodes.subtitle.textContent = `${fullDay(meeting.start)} · ${timeRange(meeting)} · ${medium.label}`;
		nodes.tags.innerHTML = standingBadge(phase) + linkChip();
		setMainAction(phase);
		nodes.moreMenu.innerHTML = menuEntries(phase).join('');
		linkNeighbors();
		drawNotice(phase);
	}

	function standingBadge(phase) {
		if (phase === 'past') {
			if (meeting.notes) return badge('Written up', 'success');
			return hosting() ? badge('Notes to write', 'warning') : badge('No notes yet');
		}
		if (phase === 'canceled') return badge('Canceled');
		if (phase === 'live') return liveBadge('Happening now');
		const reply = hosting() ? store.answers.host : store.answers[meeting.reply];
		return badge(reply.label, reply.tone);
	}

	function linkChip() {
		const link = meeting.link;
		if (!link) return '';
		const icon = link.type === 'Customer' ? 'bi-building' : 'bi-kanban';
		return `<a href="${htmlSafe(link.href)}" class="mdt-chip"><i aria-hidden="true" class="bi ${icon}"></i>${htmlSafe(link.type)}: ${htmlSafe(link.name)}</a>`;
	}

	/* The header button offers what can be done right now: join before and
     during, replay afterwards. A meeting still to be written up keeps its
     Write up button inside the Outcome card instead. */
	function setMainAction(phase) {
		const button = nodes.mainAction;
		const joinable = phase === 'next' || phase === 'live';
		const replayable = phase === 'past' && Boolean(meeting.rec);
		button.hidden = !joinable && !replayable;
		if (joinable) {
			button.dataset.do = 'go';
			button.innerHTML = `<i aria-hidden="true" class="bi ${medium.icon} me-1"></i>${medium.go}`;
		} else if (replayable) {
			button.dataset.do = 'play';
			button.innerHTML = '<i aria-hidden="true" class="bi bi-play-fill me-1"></i>Play recording';
		} else {
			button.innerHTML = '';
		}
	}

	function menuEntries(phase) {
		const host = hosting();
		const ahead = phase === 'next' && host;
		const choices = [
			[ahead, 'move', 'bi-clock-history', 'Move meeting'],
			[(phase === 'next' || phase === 'live') && host, 'agenda', 'bi-list-ol', 'Edit agenda'],
			[phase === 'canceled' && host, 'move', 'bi-arrow-repeat', 'Book it again'],
			[phase === 'past' && Boolean(meeting.notes), 'email', 'bi-envelope', 'Email the notes to everyone'],
			[true, 'copy', 'bi-link-45deg', 'Copy link to this page'],
			[true, 'print', 'bi-printer', 'Print'],
		];
		const entries = choices
			.filter(([offered]) => offered)
			.map(([, action, icon, text]) => menuEntry(action, icon, text));
		if (ahead)
			entries.push(
				'<li><hr class="dropdown-divider"></li>',
				menuEntry('cancel', 'bi-calendar-x', 'Cancel meeting', true),
			);
		return entries;
	}

	function menuEntry(action, icon, text, danger = false) {
		return `<li><button data-mdt-act="${action}" type="button" class="dropdown-item${danger ? ' mdt-danger-item' : ''}"><i aria-hidden="true" class="bi ${icon}"></i>${text}</button></li>`;
	}

	/* The arrows step through the calendar in time order. */
	function linkNeighbors() {
		const timeline = [...store.meetings].sort((a, b) => a.start - b.start);
		const place = timeline.indexOf(meeting);
		pointPager(nodes.earlier, timeline[place - 1]);
		pointPager(nodes.later, timeline[place + 1]);
	}

	function pointPager(link, target) {
		if (!target) {
			link.removeAttribute('href');
			link.removeAttribute('title');
			link.classList.add('disabled');
			link.setAttribute('aria-disabled', 'true');
			return;
		}
		link.href = `meeting-details.html?id=${encodeURIComponent(target.id)}`;
		link.title = target.title;
		link.classList.remove('disabled');
		link.removeAttribute('aria-disabled');
	}

	function drawNotice(phase) {
		const called = phase === 'canceled';
		nodes.notice.hidden = !called;
		if (!called) return;
		const rebook = hosting()
			? '<button data-mdt-act="move" type="button" class="btn btn-outline-secondary btn-sm">Book it again</button>'
			: '';
		nodes.notice.innerHTML = `<i aria-hidden="true" class="bi bi-calendar-x"></i><span><strong>Canceled.</strong> ${htmlSafe(meeting.cancelNote || meeting.about)}</span>${rebook}`;
	}

	/* The When card leads an upcoming meeting: date, place, organizer and your
     reply. */

	function drawWhen() {
		const body = nodes.whenBody;
		if (!isUpcoming()) {
			body.innerHTML = '<h2 id="mdt-when-title" class="visually-hidden">When</h2>';
			return;
		}
		const live = phaseOf(meeting) === 'live';
		const elapsed = live ? Math.round((now - meeting.start) / 60000) : 0;
		const status = live
			? `<span class="mdt-when-count">${timeUntil(meeting.mins - elapsed)} left</span>`
			: badge(`Starts in ${timeUntil(Math.round((meeting.start - now) / 60000))}`, 'primary');

		body.className = `card-body mdt-when-body mdt-tone-${meeting.kind}`;
		body.innerHTML = `<div class="mdt-when-main">${dateLeaf()}<div class="mdt-when-text"><p class="mdt-when-state">${status}</p><h2 id="mdt-when-title" class="mdt-card-title">${htmlSafe(relativeDay(meeting.start))}, ${htmlSafe(timeRange(meeting))}</h2><p class="mdt-when-about">${htmlSafe(meeting.about)}</p>${live ? liveProgress(elapsed) : ''}${factList()}</div></div><div class="mdt-when-side">${hosting() ? calendarCheck() : replyPicker()}</div>`;
		window.Basalt.avatars?.(body);
		window.Basalt.buttons?.(body);
	}

	/* The tear-off calendar page beside the time. */
	function dateLeaf() {
		const day = meeting.start;
		return `<div aria-hidden="true" class="mdt-leaf"><span class="mdt-leaf-day">${abbreviate(WEEKDAYS[day.getDay()])}</span><span class="mdt-leaf-num">${day.getDate()}</span><span class="mdt-leaf-mon">${abbreviate(MONTH_NAMES[day.getMonth()])}</span></div>`;
	}

	function liveProgress(elapsed) {
		const underway = itemUnderway();
		const bar = `<div class="mdt-progress"><span class="mdt-progress-at">${clockTime(meeting.start)}</span><span role="img" aria-label="${htmlSafe(`${elapsed} of ${meeting.mins} minutes gone`)}" class="mdt-progress-track"><span class="mdt-progress-fill" style="width:${((elapsed / meeting.mins) * 100).toFixed(1)}%"></span></span><span class="mdt-progress-at">${clockTime(endsAt(meeting))}</span></div>`;
		return underway < 0
			? bar
			: `${bar}<p class="mdt-when-on">On now: <strong>${htmlSafe(meeting.agenda[underway][0])}</strong></p>`;
	}

	function factList() {
		const copyWhat = medium.label === 'In person' ? 'address' : 'details';
		const organizer = hosting()
			? 'You organized it'
			: `Organized by <a href="${store.personPage(meeting.by)}" class="mdt-link">${htmlSafe(wholeName(meeting.by))}</a>`;
		const place = `<li><span aria-hidden="true" class="mdt-type"><i class="bi ${medium.icon}"></i></span><span class="mdt-facts-text">${placeMarkup()}</span><button data-mdt-copy-where aria-label="Copy ${htmlSafe(copyWhat)}" type="button" class="btn btn-sm mdt-copy"><i aria-hidden="true" class="bi bi-copy"></i></button></li>`;
		const owner = `<li>${avatarSpan(wholeName(meeting.by))}<span class="mdt-facts-text">${organizer} · <span class="text-nowrap">${htmlSafe(duration(meeting.mins))}</span></span></li>`;
		return `<ul class="mdt-facts">${place}${owner}</ul>`;
	}

	/* A video link opens the call, a phone number dials, a room is just text. */
	function placeMarkup() {
		const where = htmlSafe(meeting.where);
		if (meeting.kind === 'video') return `<button data-mdt-go type="button" class="mdt-linkbtn">${where}</button>`;
		if (meeting.kind === 'phone')
			return `<a href="tel:${htmlSafe(meeting.where.split(',')[0].replace(/\s+/g, ''))}" class="mdt-link">${where}</a>`;
		return `<span>${where}</span>`;
	}

	/* The organizer sees whether the people invited are free; anyone else
     answers the invite. */
	function calendarCheck() {
		const busy = invitedButBusy(meeting.start, meeting.mins);
		const hint = busy.length
			? `<p class="mdt-hint is-warn"><i aria-hidden="true" class="bi bi-exclamation-circle"></i><span>${htmlSafe(clashSentence(busy))}</span></p>`
			: '<p class="mdt-hint"><i aria-hidden="true" class="bi bi-check-circle"></i><span>Everyone you invited is free then.</span></p>';
		const mover =
			phaseOf(meeting) === 'next'
				? '<button data-mdt-act="move" type="button" class="btn btn-outline-secondary btn-sm"><i aria-hidden="true" class="bi bi-clock-history me-1"></i>Move meeting</button>'
				: '';
		return `<h3 class="mdt-sub">Everyone's calendar</h3>${hint}${mover}`;
	}

	function replyPicker() {
		const options = [
			['yes', 'Going', 'bi-check2'],
			['maybe', 'Maybe', 'bi-question'],
			['no', 'Not going', 'bi-x-lg'],
		]
			.map(
				([value, label, icon]) =>
					`<input id="mdt-reply-${value}" name="mdtReply" type="radio" class="btn-check" value="${value}"${meeting.reply === value ? ' checked' : ''}><label for="mdt-reply-${value}" class="basalt-segmented-option"><i aria-hidden="true" class="bi ${icon}"></i>${label}</label>`,
			)
			.join('');
		return `<h3 id="mdt-reply-label" class="mdt-sub">Your reply</h3><div data-basalt-segmented role="radiogroup" aria-labelledby="mdt-reply-label" class="basalt-segmented basalt-segmented-sm basalt-segmented-block">${options}</div><p class="mdt-hint">${replyHint()}</p>`;
	}

	function replyHint() {
		const conflict = myConflict();
		if (!conflict)
			return `<i aria-hidden="true" class="bi bi-check-circle"></i><span>You're free then. ${htmlSafe(givenName(meeting.by))} sees your answer straight away.</span>`;
		return `<i aria-hidden="true" class="bi bi-exclamation-circle"></i><span>Clashes with <a href="meeting-details.html?id=${encodeURIComponent(conflict.id)}" class="mdt-link">${htmlSafe(conflict.title)}</a></span>`;
	}

	/* Another meeting at the same time that is still on my calendar. */
	function myConflict() {
		return store.meetings.find(
			(other) =>
				other !== meeting &&
				!other.canceled &&
				other.start < endsAt(meeting) &&
				endsAt(other) > meeting.start &&
				other.reply !== 'no' &&
				other.reply !== 'ask',
		);
	}

	/** Teammates invited here who have accepted something else in that slot. */
	function invitedButBusy(from, minutes) {
		const until = new Date(from.getTime() + minutes * 60000);
		const bookedElsewhere = (id) =>
			store.meetings.some(
				(other) =>
					other !== meeting &&
					!other.canceled &&
					other.start < until &&
					endsAt(other) > from &&
					other.people.includes(id) &&
					replyOf(other, id) !== 'no',
			);
		return meeting.people.filter((id) => id !== myId && bookedElsewhere(id));
	}

	function clashSentence(ids) {
		return `${joinNames(ids)}${ids.length === 1 ? ' has another meeting' : ' have other meetings'} then.`;
	}

	function joinNames(ids) {
		const names = ids.map(wholeName);
		const last = names.pop();
		return names.length ? `${names.join(', ')} and ${last}` : last;
	}

	/* Your reply: the switch stays where you put it, and everything that
     reflects it is redrawn around it. */
	function wireReply() {
		nodes.whenBody.addEventListener('change', (event) => {
			if (event.target.name !== 'mdtReply') return;
			const previous = meeting.reply;
			meeting.reply = event.target.value;
			drawHeader();
			drawPeople();
			notify({
				tone: meeting.reply === 'no' ? 'info' : 'success',
				title: { yes: "You're going", maybe: 'You might go', no: 'You declined' }[meeting.reply],
				text: `${givenName(meeting.by)} has been told.`,
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							meeting.reply = previous;
							redraw();
						},
					},
				],
			});
		});
	}

	/* The Outcome card shows the write-up after the meeting and edits it in
     place. */

	function drawOutcome() {
		if (phaseOf(meeting) !== 'past') return;
		const record = meeting.notes;
		nodes.outcomeEditButton.hidden = !record || !nodes.outcomeForm.hidden;
		nodes.outcomeNote.textContent = record
			? `Written up by ${record.by === myId ? 'you' : wholeName(record.by || meeting.by)}. Everyone invited has it.`
			: 'What was decided, and who does what next.';
		if (!record) {
			nodes.outcomeView.innerHTML = missingWriteUp();
			return;
		}
		nodes.outcomeView.innerHTML = writeUpMarkup(record);
		window.Basalt.avatars?.(nodes.outcomeView);
	}

	function missingWriteUp() {
		const text = hosting()
			? 'You ran this one. Add a summary, what was decided and who does what next; everyone invited gets it.'
			: `${htmlSafe(givenName(meeting.by))} hasn't shared notes yet. Anyone invited can start them.`;
		const action =
			'<div class="basalt-empty-actions"><button data-mdt-act="write" type="button" class="btn btn-primary btn-sm"><i aria-hidden="true" class="bi bi-pencil"></i>Write up</button></div>';
		return blankNote('warning', 'bi-journal-text', 'Not written up yet', text, action);
	}

	function writeUpMarkup({ summary, decisions, steps }) {
		const finished = steps.filter((step) => step[3]).length;
		const decided = decisions.length
			? `<ul class="mdt-decisions">${decisions.map((line) => `<li><i aria-hidden="true" class="bi bi-check-circle-fill"></i><span>${htmlSafe(line)}</span></li>`).join('')}</ul>`
			: '<p class="mdt-quiet">Nothing was decided.</p>';
		const progress = steps.length ? ` <span class="mdt-count">${finished} of ${steps.length} done</span>` : '';
		const tasks = steps.length
			? `<ul class="mdt-steps">${steps.map(taskItem).join('')}</ul>`
			: '<p class="mdt-quiet">No action items.</p>';
		return `<p class="mdt-summary">${htmlSafe(summary)}</p><div class="mdt-outcome-cols"><section aria-labelledby="mdt-dec-title" class="mdt-outcome-col"><h3 id="mdt-dec-title" class="mdt-sub">Decisions</h3>${decided}</section><section aria-labelledby="mdt-steps-title" class="mdt-outcome-col"><h3 id="mdt-steps-title" class="mdt-sub">Action items${progress}</h3>${tasks}</section></div>`;
	}

	/** One action item: [owner id, task, due as YYYY-MM-DD, done]. */
	function taskItem([owner, task, due, done], index) {
		const dueDay = parseDay(due);
		const boxId = `mdt-step-${index}`;
		const when = done ? 'Done' : `Due ${htmlSafe(briefDay(dueDay))}`;
		const overdue = !done && dueDay < today ? badge('Overdue', 'warning') : '';
		return `<li class="mdt-step${done ? ' is-done' : ''}"><input data-mdt-step="${index}" id="${boxId}" type="checkbox" class="form-check-input"${done ? ' checked' : ''}><div class="mdt-step-text"><label for="${boxId}" class="mdt-step-task">${htmlSafe(task)}</label><span class="mdt-step-meta">${avatarSpan(wholeName(owner))}<span>${htmlSafe(owner === myId ? 'You' : wholeName(owner))} · ${when}</span>${overdue}</span></div></li>`;
	}

	/* The whole outcome is edited at once: summary, decisions, action items. */
	function openWriteUp() {
		const record = meeting.notes || { summary: '', decisions: [], steps: [] };
		nodes.summaryField.value = record.summary;
		nodes.summaryField.classList.remove('is-invalid');
		nodes.summaryError.hidden = true;
		nodes.decisionList.innerHTML = (record.decisions.length ? record.decisions : [''])
			.map((text) => decisionField(text))
			.join('');
		nodes.taskList.innerHTML = (record.steps.length ? record.steps : [blankTask()])
			.map((step) => taskField(step))
			.join('');
		nodes.outcomeView.hidden = true;
		nodes.outcomeForm.hidden = false;
		nodes.outcomeEditButton.hidden = true;
		panels.outcome.scrollIntoView({ block: 'nearest' });
		nodes.summaryField.focus();
	}

	function closeWriteUp() {
		nodes.outcomeForm.hidden = true;
		nodes.outcomeView.hidden = false;
		drawOutcome();
	}

	function decisionField(text) {
		const id = `mdt-dec-${++fieldSerial}`;
		return `<li class="mdt-editrow mdt-editrow-one"><label for="${id}" class="visually-hidden">Decision</label><input id="${id}" type="text" class="form-control" maxlength="120" placeholder="What was agreed" value="${htmlSafe(text)}">${removeButton('Remove this decision')}</li>`;
	}

	function taskField([owner, task, due, done]) {
		const id = `mdt-sE-${++fieldSerial}`;
		const owners = meeting.people
			.map(
				(person) =>
					`<option value="${person}"${person === owner ? ' selected' : ''}>${htmlSafe(person === myId ? 'You' : wholeName(person))}</option>`,
			)
			.join('');
		return `<li data-done="${done ? '1' : ''}" class="mdt-editrow mdt-editrow-step"><div class="mdt-editrow-task"><label for="${id}t" class="mdt-label mdt-label-small">Task</label><input data-f="task" id="${id}t" type="text" class="form-control" maxlength="100" placeholder="Who does what" value="${htmlSafe(task)}"></div><div><label for="${id}w" class="mdt-label mdt-label-small">Owner</label><select data-f="who" id="${id}w" class="form-select">${owners}</select></div><div><label for="${id}d" class="mdt-label mdt-label-small">Due</label><input data-f="due" id="${id}d" type="date" class="form-control" value="${htmlSafe(due)}"></div>${removeButton('Remove this action item')}</li>`;
	}

	/* A new action item is mine and due a week from today. */
	function blankTask() {
		return [myId, '', isoDay(new Date(today.getTime() + 7 * DAY_MS)), false];
	}

	function readTask(row) {
		return [
			pick('[data-f="who"]', row).value,
			pick('[data-f="task"]', row).value.trim(),
			pick('[data-f="due"]', row).value || isoDay(today),
			row.dataset.done === '1',
		];
	}

	function wireWriteUp() {
		nodes.outcomeEditButton.addEventListener('click', openWriteUp);
		nodes.outcomeCancel.addEventListener('click', () => {
			closeWriteUp();
			(meeting.notes ? nodes.outcomeEditButton : pick('[data-mdt-act="write"]', nodes.outcomeView)).focus();
		});
		nodes.addDecision.addEventListener('click', () => appendRow(nodes.decisionList, decisionField('')));
		nodes.addTask.addEventListener('click', () => appendRow(nodes.taskList, taskField(blankTask())));

		nodes.outcomeForm.addEventListener('click', (event) => {
			const remover = event.target.closest('[data-mdt-remove]');
			if (!remover) return;
			const row = remover.closest('li');
			dropRow(row, row.parentElement.nextElementSibling).focus();
		});

		nodes.summaryField.addEventListener('input', () => {
			nodes.summaryField.classList.remove('is-invalid');
			nodes.summaryError.hidden = true;
		});

		nodes.outcomeForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const summary = nodes.summaryField.value.trim();
			if (!summary) {
				nodes.summaryField.classList.add('is-invalid');
				nodes.summaryField.setAttribute('aria-invalid', 'true');
				nodes.summaryError.hidden = false;
				nodes.summaryField.focus();
				return;
			}
			nodes.summaryField.removeAttribute('aria-invalid');
			const earlier = meeting.notes;
			meeting.notes = {
				summary,
				decisions: pickAll('input', nodes.decisionList)
					.map((field) => field.value.trim())
					.filter(Boolean),
				steps: pickAll('li', nodes.taskList)
					.map(readTask)
					.filter(([, task]) => task),
				body: earlier ? earlier.body : meeting.draft || '',
				by: earlier ? earlier.by : myId,
			};
			closeWriteUp();
			drawHeader();
			drawNotes();
			nodes.outcomeEditButton.focus();
			notify({
				tone: 'success',
				icon: 'bi-send-check',
				title: earlier ? 'Outcome updated' : 'Write-up shared',
				text: `Everyone invited to ${meeting.title} has it now.`,
			});
		});

		/* Ticking an action item off redraws the list and keeps focus on it. */
		nodes.outcomeView.addEventListener('change', (event) => {
			const box = event.target.closest('[data-mdt-step]');
			if (!box) return;
			const index = box.dataset.mdtStep;
			const step = meeting.notes.steps[Number(index)];
			step[3] = box.checked;
			drawOutcome();
			pick(`[data-mdt-step="${index}"]`, nodes.outcomeView)?.focus();
			window.Basalt.announce?.(`${step[3] ? 'Done' : 'Not done'}: ${step[1]}`);
		});
	}

	/* The Recording card turns each agenda item into a chapter, stretched over
     the recording in proportion. Playback ticks in real time and holds while
     the tab is in the background. */

	function recordingLength() {
		return meeting.rec * 60;
	}

	function chapterSpans() {
		const planned = meeting.agenda.reduce((sum, [, minutes]) => sum + minutes, 0) || 1;
		const total = recordingLength();
		let cursor = 0;
		return meeting.agenda.map(([title, minutes], index) => {
			const from = cursor;
			cursor += (minutes / planned) * total;
			return { index, title, from, to: cursor };
		});
	}

	function drawRecording() {
		if (!meeting.rec || phaseOf(meeting) !== 'past') return;
		const total = recordingLength();
		const keptUntil = new Date(meeting.start.getTime() + 90 * DAY_MS);
		nodes.recordingNote.textContent = `${duration(meeting.rec)}, kept until ${MONTH_NAMES[keptUntil.getMonth()]} ${keptUntil.getDate()}, ${keptUntil.getFullYear()}.`;
		nodes.runtime.textContent = minutesSeconds(total);

		const spans = chapterSpans();
		const segments = spans.map(
			({ index, from, to }) =>
				`<span class="mdt-player-seg ${rampClass(index)}" style="width:${(((to - from) / total) * 100).toFixed(2)}%"></span>`,
		);
		nodes.track.innerHTML = `${segments.join('')}<span data-mdt-head class="mdt-player-head"></span>`;
		nodes.chapterList.innerHTML = spans
			.map(
				({ index, title, from, to }) =>
					`<li><button data-mdt-chapter="${index}" type="button" class="mdt-chapter ${rampClass(index)}"><span aria-hidden="true" class="mdt-chapter-dot"></span><span class="mdt-chapter-at">${minutesSeconds(from)}</span><span class="mdt-chapter-title">${htmlSafe(title)}</span><span class="mdt-chapter-len">${duration(Math.max(1, Math.round((to - from) / 60)))}</span></button></li>`,
			)
			.join('');
		paintPlayhead();
	}

	function paintPlayhead() {
		const share = `${((view.playhead / recordingLength()) * 100).toFixed(2)}%`;
		const knob = pick('[data-mdt-head]', nodes.track);
		if (knob) knob.style.left = share;
		nodes.track.style.setProperty('--mdt-played', share);
		nodes.position.textContent = minutesSeconds(view.playhead);

		const playing = Boolean(view.ticker);
		nodes.playButton.innerHTML = `<i aria-hidden="true" class="bi ${playing ? 'bi-pause-fill' : 'bi-play-fill'}"></i>`;
		nodes.playButton.setAttribute('aria-label', playing ? 'Pause the recording' : 'Play the recording');

		const current = chapterSpans().find(({ from, to }) => view.playhead >= from && view.playhead < to);
		for (const button of pickAll('[data-mdt-chapter]', nodes.chapterList)) {
			const active = Boolean(current) && Number(button.dataset.mdtChapter) === current.index;
			button.classList.toggle('is-on', active);
			if (active) button.setAttribute('aria-current', 'true');
			else button.removeAttribute('aria-current');
		}
	}

	function startPlayback() {
		if (view.ticker) return;
		if (view.playhead >= recordingLength()) view.playhead = 0;
		view.ticker = window.setInterval(advancePlayback, 1000);
		paintPlayhead();
	}

	function advancePlayback() {
		if (document.hidden) return;
		view.playhead = Math.min(recordingLength(), view.playhead + 1);
		if (view.playhead >= recordingLength()) stopPlayback();
		paintPlayhead();
	}

	function stopPlayback() {
		window.clearInterval(view.ticker);
		view.ticker = null;
		paintPlayhead();
	}

	function playFromHeader() {
		const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		panels.rec.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
		startPlayback();
		nodes.playButton.focus({ preventScroll: true });
	}

	function wireRecording() {
		nodes.playButton.addEventListener('click', () => (view.ticker ? stopPlayback() : startPlayback()));

		nodes.chapterList.addEventListener('click', (event) => {
			const chapter = event.target.closest('[data-mdt-chapter]');
			if (!chapter) return;
			view.playhead = Math.ceil(chapterSpans()[Number(chapter.dataset.mdtChapter)].from);
			paintPlayhead();
			startPlayback();
		});

		/* A click along the bar seeks for pointer users; keyboard users jump
       with the chapter list. */
		nodes.track.addEventListener('click', (event) => {
			const box = nodes.track.getBoundingClientRect();
			const ratio = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
			view.playhead = Math.round(ratio * recordingLength());
			paintPlayhead();
		});

		nodes.recordingCopy.addEventListener('click', () => {
			copyText(`https://meet.fieldline.app/recordings/${meeting.id}`).then(() =>
				notify({
					tone: 'success',
					icon: 'bi-link-45deg',
					title: 'Link copied',
					text: 'Anyone invited can open the recording with it.',
				}),
			);
		});
	}

	/* The Agenda card lists the items with their times; the organizer edits it
     before the start. */

	function drawAgenda() {
		const items = meeting.agenda;
		const planned = items.reduce((sum, [, minutes]) => sum + minutes, 0);
		const canceled = phaseOf(meeting) === 'canceled';
		nodes.agendaNote.textContent = `${count(items.length, 'item')}, ${planned} of ${meeting.mins} minutes planned.`;
		nodes.agendaEditButton.hidden = !(hosting() && isUpcoming()) || !nodes.agendaForm.hidden;

		const underway = itemUnderway();
		const offsets = itemOffsets();
		const scale = Math.max(planned, meeting.mins);
		const stageOf = (index) => (index < underway ? 'done' : index === underway ? 'now' : '');

		const bar = items
			.map(
				([, minutes], index) =>
					`<span class="mdt-bar-seg ${rampClass(index)}${index < underway ? ' is-done' : ''}" style="width:${((minutes / scale) * 100).toFixed(2)}%"></span>`,
			)
			.join('');
		const list = items
			.map(([topic, minutes], index) => {
				const stage = stageOf(index);
				const startsAt = new Date(meeting.start.getTime() + offsets[index] * 60000);
				const marker = stage === 'done' ? '<i class="bi bi-check-lg"></i>' : index + 1;
				const onNow = stage === 'now' ? ` ${liveBadge('On now')}` : '';
				return `<li class="mdt-item ${rampClass(index)}${stage ? ` is-${stage}` : ''}"><span aria-hidden="true" class="mdt-item-n">${marker}</span><span class="mdt-item-text">${htmlSafe(topic)}${onNow}</span><span class="mdt-item-at">${canceled ? '' : clockTime(startsAt)}</span><span class="mdt-item-mins">${minutes} min</span></li>`;
			})
			.join('');
		nodes.agendaView.innerHTML = `<div aria-hidden="true" class="mdt-bar">${bar}</div><ol class="mdt-items">${list}</ol>`;
	}

	/** Minutes from the start at which each agenda item begins. */
	function itemOffsets() {
		let running = 0;
		return meeting.agenda.map(([, minutes]) => {
			const offset = running;
			running += minutes;
			return offset;
		});
	}

	/** Index of the agenda item being talked about now, or -1 when not live. */
	function itemUnderway() {
		if (phaseOf(meeting) !== 'live') return -1;
		const elapsed = (now - meeting.start) / 60000;
		return itemOffsets().findLastIndex((offset) => elapsed >= offset);
	}

	function agendaField([topic, minutes]) {
		const id = `mdt-ag-${++fieldSerial}`;
		return `<li class="mdt-editrow mdt-editrow-agenda"><div class="mdt-editrow-task"><label for="${id}t" class="visually-hidden">Agenda item</label><input data-f="text" id="${id}t" aria-describedby="${id}e" type="text" class="form-control" maxlength="60" placeholder="What to talk about" value="${htmlSafe(topic)}"></div><div class="mdt-mins"><label for="${id}m" class="visually-hidden">Minutes</label><input data-f="mins" id="${id}m" aria-describedby="${id}e" type="number" class="form-control" min="5" max="180" step="5" value="${minutes}"><span aria-hidden="true">min</span></div>${removeButton('Remove this item')}<p id="${id}e" class="mdt-error mdt-editrow-error" hidden></p></li>`;
	}

	/* The running total under the editor warns once the plan runs long. */
	function tallyAgenda() {
		const planned = pickAll('[data-f="mins"]', nodes.agendaRows).reduce(
			(sum, field) => sum + (parseInt(field.value, 10) || 0),
			0,
		);
		const surplus = planned - meeting.mins;
		nodes.agendaTally.classList.toggle('is-warn', surplus > 0);
		if (surplus > 0) {
			nodes.agendaTally.textContent = `${planned} minutes planned, ${surplus} more than the meeting runs.`;
			return;
		}
		nodes.agendaTally.textContent = `${planned} of ${meeting.mins} minutes planned${surplus < 0 ? `, ${-surplus} to spare.` : '.'}`;
	}

	function openAgendaEditor() {
		nodes.agendaRows.innerHTML = meeting.agenda.map((item) => agendaField(item)).join('');
		nodes.agendaView.hidden = true;
		nodes.agendaForm.hidden = false;
		nodes.agendaEditButton.hidden = true;
		tallyAgenda();
		panels.agenda.scrollIntoView({ block: 'nearest' });
		pick('input', nodes.agendaRows).focus();
	}

	function closeAgendaEditor() {
		nodes.agendaForm.hidden = true;
		nodes.agendaView.hidden = false;
		drawAgenda();
	}

	/**
	 * Checks one agenda row, marks the field at fault and writes its message.
	 * Returns the row as [topic, minutes] and the field to focus, if any.
	 */
	function checkAgendaRow(row) {
		const topicField = pick('[data-f="text"]', row);
		const minutesField = pick('[data-f="mins"]', row);
		const message = pick('.mdt-editrow-error', row);
		const minutes = parseInt(minutesField.value, 10);
		let fault = null;
		if (!topicField.value.trim()) {
			fault = topicField;
			message.textContent = 'Say what this item is about, or remove it.';
		} else if (!(minutes >= 5 && minutes <= 180)) {
			fault = minutesField;
			message.textContent = 'Give it between 5 and 180 minutes.';
		}
		message.hidden = !fault;
		if (fault) {
			fault.classList.add('is-invalid');
			fault.setAttribute('aria-invalid', 'true');
		}
		return { entry: [topicField.value.trim(), minutes], fault };
	}

	function wireAgendaEditor() {
		nodes.agendaEditButton.addEventListener('click', openAgendaEditor);
		nodes.agendaCancel.addEventListener('click', () => {
			closeAgendaEditor();
			nodes.agendaEditButton.focus();
		});
		nodes.addAgendaItem.addEventListener('click', () => {
			nodes.agendaRows.insertAdjacentHTML('beforeend', agendaField(['', 10]));
			tallyAgenda();
			pick('input', nodes.agendaRows.lastElementChild).focus();
		});

		/* Typing in a row clears that row's complaint and updates the total. */
		nodes.agendaForm.addEventListener('input', (event) => {
			const row = event.target.closest('li');
			if (row) {
				for (const field of pickAll('.is-invalid', row)) {
					field.classList.remove('is-invalid');
					field.removeAttribute('aria-invalid');
				}
				pick('.mdt-editrow-error', row).hidden = true;
			}
			tallyAgenda();
		});

		nodes.agendaForm.addEventListener('click', (event) => {
			const remover = event.target.closest('[data-mdt-remove]');
			if (!remover) return;
			const next = dropRow(remover.closest('li'), nodes.addAgendaItem);
			tallyAgenda();
			next.focus();
		});

		nodes.agendaForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const checked = pickAll('li', nodes.agendaRows).map(checkAgendaRow);
			const fault = checked.find((result) => result.fault)?.fault;
			if (fault) {
				fault.focus();
				return;
			}
			if (!checked.length) {
				nodes.agendaTally.textContent = 'Add at least one item.';
				nodes.agendaTally.classList.add('is-warn');
				nodes.addAgendaItem.focus();
				return;
			}
			const previous = meeting.agenda;
			meeting.agenda = checked.map(({ entry }) => entry);
			closeAgendaEditor();
			drawWhen();
			nodes.agendaEditButton.focus();
			notify({
				tone: 'success',
				icon: 'bi-list-check',
				title: 'Agenda updated',
				text: 'Everyone invited sees the new agenda.',
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							meeting.agenda = previous;
							drawAgenda();
							drawWhen();
						},
					},
				],
			});
		});
	}

	/* The People card lists everyone invited with their reply, folded after
     six. */

	function drawPeople() {
		const phase = phaseOf(meeting);
		const team = [meeting.by, ...meeting.people.filter((id) => id !== meeting.by)];
		const guests = meeting.guests || [];
		const tally = { yes: guests.length, maybe: 0, wait: 0, no: 0 };
		for (const id of team) {
			const answer = replyOf(meeting, id);
			tally[answer === 'ask' ? 'wait' : answer] += 1;
		}
		const invited = meeting.everyone || team.length + guests.length;
		const named = team.length + guests.length;

		nodes.peopleNote.textContent = peopleSummary(phase, invited, tally.yes);
		nodes.replies.innerHTML = meeting.everyone || phase === 'canceled' ? '' : replyBar(tally);

		const rows = [...team.map((id) => teammateRow(id, phase)), ...guests.map((guest) => guestRow(guest, phase))];
		const visible = view.everyoneListed ? rows : rows.slice(0, PEOPLE_BEFORE_MORE);
		const remainder =
			view.everyoneListed && invited > named
				? `<li class="mdt-person mdt-person-rest">and ${count(invited - named, 'more person', 'more people')} across the company</li>`
				: '';
		nodes.peopleList.innerHTML = visible.join('') + remainder;

		nodes.moreButton.hidden = rows.length <= PEOPLE_BEFORE_MORE;
		nodes.moreButton.setAttribute('aria-expanded', String(view.everyoneListed));
		nodes.moreButton.textContent = view.everyoneListed ? 'Show fewer' : `Show all ${invited}`;
		window.Basalt.avatars?.(nodes.peopleList);
	}

	function peopleSummary(phase, invited, going) {
		if (meeting.everyone) return `The whole company is invited, ${invited} people.`;
		if (phase === 'canceled') return `${count(invited, 'person was', 'people were')} invited and have been told.`;
		if (phase === 'past') return `${count(invited, 'person', 'people')} invited; ${going} said they would go.`;
		return `${going} of ${invited} going so far.`;
	}

	/* A stacked bar of the replies; the legend repeats it for sighted readers. */
	function replyBar(tally) {
		const groups = REPLY_GROUPS.filter(({ key }) => tally[key]);
		const spoken = groups.map(({ key, words }) => `${tally[key]} ${words}`).join(', ');
		const segments = groups
			.map(
				({ key, swatch }) =>
					`<span class="mdt-replies-seg mdt-replies-${swatch}" style="flex-grow:${tally[key]}"></span>`,
			)
			.join('');
		const legend = groups
			.map(
				({ key, words, swatch }) =>
					`<li><span class="mdt-legend-dot mdt-replies-${swatch}"></span>${tally[key]} ${words}</li>`,
			)
			.join('');
		return `<div role="img" aria-label="${htmlSafe(spoken)}" class="mdt-replies">${segments}</div><ul aria-hidden="true" class="mdt-legend">${legend}</ul>`;
	}

	function teammateRow(id, phase) {
		const organizer = id === meeting.by;
		let status = '';
		if (phase !== 'canceled' || organizer) {
			const answer = organizer ? store.answers.host : store.answers[replyOf(meeting, id)];
			status = badge(answer.label, answer.tone);
		}
		const name = `${htmlSafe(wholeName(id))}${id === myId ? ' (you)' : ''}`;
		return personRow(wholeName(id), store.personPage(id), name, htmlSafe(store.people[id][1]), status);
	}

	function guestRow(guest, phase) {
		const [name, company] = guest;
		return personRow(
			name,
			store.guestPage(guest),
			htmlSafe(name),
			`Guest · ${htmlSafe(company)}`,
			phase === 'canceled' ? '' : badge('Going', 'success'),
		);
	}

	function personRow(avatarName, href, nameMarkup, meta, status) {
		return `<li class="mdt-person">${avatarSpan(avatarName)}<span class="mdt-person-text"><a href="${href}" class="mdt-person-name">${nameMarkup}</a><span class="mdt-person-meta">${meta}</span></span>${status}</li>`;
	}

	function wirePeople() {
		nodes.moreButton.addEventListener('click', () => {
			window.Basalt.slide(nodes.peopleList, () => {
				view.everyoneListed = !view.everyoneListed;
				drawPeople();
			});
			if (!view.everyoneListed) return;
			const firstHidden = nodes.peopleList.children[PEOPLE_BEFORE_MORE];
			if (firstHidden) pick('a', firstHidden).focus();
		});
	}

	/* The Notes card is written in place. Ahead of the meeting it holds the
     prep; afterwards it is the full write-up under the outcome. */

	function notesMarkup() {
		if (phaseOf(meeting) !== 'past') return meeting.prep || '';
		return (meeting.notes ? meeting.notes.body : meeting.draft) || '';
	}

	function storeNotes(markup) {
		if (phaseOf(meeting) !== 'past') meeting.prep = markup;
		else if (meeting.notes) meeting.notes.body = markup;
		else meeting.draft = markup;
	}

	function drawNotes() {
		const phase = phaseOf(meeting);
		const past = phase === 'past';
		const hints = {
			past: 'The full write-up. Anyone invited can add to it.',
			live: 'Shared with everyone invited. Take them as you go.',
		};
		nodes.notesNote.textContent = hints[phase] || 'Shared with everyone invited. Jot down what to bring up.';
		nodes.notesEditButton.hidden = !nodes.editor.hidden;
		const markup = notesMarkup();
		nodes.notesView.innerHTML = markup
			? `<div class="mdt-prose">${markup}</div>`
			: blankNote(
					'muted',
					'bi-journal',
					'No notes yet',
					past ? 'Add what was said, item by item.' : 'Anything written here goes out with the invite.',
				);
	}

	function countWords() {
		const words = nodes.writingArea.textContent.trim().match(/\S+/g) || [];
		nodes.wordTally.textContent = count(words.length, 'word');
	}

	function openNotesEditor() {
		nodes.writingArea.innerHTML = notesMarkup();
		nodes.notesView.hidden = true;
		nodes.editor.hidden = false;
		nodes.notesEditButton.hidden = true;
		countWords();
		panels.notes.scrollIntoView({ block: 'nearest' });
		nodes.writingArea.focus();
		reflectToolbar();
	}

	function closeNotesEditor() {
		nodes.editor.hidden = true;
		nodes.notesView.hidden = false;
		drawNotes();
		nodes.notesEditButton.focus();
	}

	/* The toolbar buttons show pressed while the caret sits in bold, a list
     or a heading. */
	function reflectToolbar() {
		for (const tool of pickAll('[data-mdt-cmd]', nodes.editor)) {
			if (!tool.hasAttribute('aria-pressed')) continue;
			const pressed = attempt(() => document.queryCommandState(tool.dataset.mdtCmd), false);
			tool.setAttribute('aria-pressed', String(pressed));
		}
		const block = attempt(() => String(document.queryCommandValue('formatBlock')).toLowerCase(), '');
		pick('[data-mdt-block]', nodes.editor).setAttribute('aria-pressed', String(block === 'h3'));
	}

	function wireNotesEditor() {
		attempt(() => document.execCommand('defaultParagraphSeparator', false, 'p'));
		nodes.notesEditButton.addEventListener('click', openNotesEditor);
		nodes.notesCancel.addEventListener('click', closeNotesEditor);
		nodes.notesSave.addEventListener('click', () => {
			storeNotes(nodes.writingArea.textContent.trim() ? nodes.writingArea.innerHTML.trim() : '');
			closeNotesEditor();
			notify({
				tone: 'success',
				icon: 'bi-journal-check',
				title: 'Notes saved',
				text: `Everyone invited to ${meeting.title} sees them.`,
			});
		});

		/* Pressing a tool must not pull focus out of the text. */
		nodes.editor.addEventListener('mousedown', (event) => {
			if (event.target.closest('.mdt-tool')) event.preventDefault();
		});
		nodes.editor.addEventListener('click', (event) => {
			const tool = event.target.closest('.mdt-tool');
			if (!tool) return;
			nodes.writingArea.focus();
			const block = tool.dataset.mdtBlock;
			attempt(() =>
				block
					? document.execCommand(
							'formatBlock',
							false,
							tool.getAttribute('aria-pressed') === 'true' ? 'p' : block,
						)
					: document.execCommand(tool.dataset.mdtCmd, false, null),
			);
			reflectToolbar();
			countWords();
		});
		nodes.editor.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			closeNotesEditor();
		});

		nodes.writingArea.addEventListener('input', countWords);
		nodes.writingArea.addEventListener('keyup', reflectToolbar);
		nodes.writingArea.addEventListener('mouseup', reflectToolbar);
		/* Pasting drops formatting, so every note keeps the same look. */
		nodes.writingArea.addEventListener('paste', (event) => {
			event.preventDefault();
			document.execCommand(
				'insertText',
				false,
				(event.clipboardData || window.clipboardData).getData('text/plain'),
			);
		});
	}

	/* The Files card lists attachments; adding and removing take effect at
     once. */

	function drawFiles() {
		const files = meeting.files || [];
		nodes.filesNote.textContent = files.length
			? `${count(files.length, 'file')} for everyone invited.`
			: 'Nothing shared yet.';
		if (!files.length) {
			nodes.fileList.innerHTML = `<li>${blankNote('muted', 'bi-paperclip', 'No files yet', 'Add a deck, a doc or anything people should read first.')}</li>`;
			return;
		}
		nodes.fileList.innerHTML = files
			.map((file, index) => {
				const look = FILE_KINDS[file.type] || FILE_KINDS.other;
				const sharer = file.by === myId ? 'You' : wholeName(file.by);
				return `<li class="mdt-file ${rampClass(look.tone)}"><span aria-hidden="true" class="mdt-file-icon"><i class="bi ${look.icon}"></i></span><span class="mdt-file-text"><button data-mdt-file="${index}" type="button" class="mdt-file-name">${htmlSafe(file.name)}</button><span class="mdt-file-meta">${look.label} · ${htmlSafe(file.size)} · ${htmlSafe(sharer)}</span></span><button data-mdt-file-remove="${index}" aria-label="Remove ${htmlSafe(file.name)}" type="button" class="btn btn-sm mdt-copy"><i aria-hidden="true" class="bi bi-trash3"></i></button></li>`;
			})
			.join('');
	}

	function kindFromName(name) {
		return EXTENSION_KINDS.get(name.split('.').pop().toLowerCase()) || 'other';
	}

	function readableSize(bytes) {
		if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
		return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	}

	function wireFiles() {
		nodes.fileList.addEventListener('click', (event) => {
			const opener = event.target.closest('[data-mdt-file]');
			if (opener) {
				const file = meeting.files[Number(opener.dataset.mdtFile)];
				notify({
					tone: 'info',
					icon: 'bi-download',
					title: 'Downloading',
					text: `${file.name}, ${file.size}.`,
				});
				return;
			}
			const remover = event.target.closest('[data-mdt-file-remove]');
			if (remover) removeFile(Number(remover.dataset.mdtFileRemove));
		});

		nodes.filePicker.addEventListener('change', () => {
			const picked = [...(nodes.filePicker.files || [])];
			if (!picked.length) return;
			meeting.files = meeting.files || [];
			for (const file of picked) {
				meeting.files.push({
					name: file.name,
					type: kindFromName(file.name),
					size: readableSize(file.size),
					by: myId,
				});
			}
			nodes.filePicker.value = '';
			drawFiles();
			const single = picked.length === 1;
			notify({
				tone: 'success',
				icon: 'bi-paperclip',
				title: single ? 'File shared' : `${count(picked.length, 'file')} shared`,
				text: `Everyone invited to ${meeting.title} can open ${single ? 'it' : 'them'}.`,
			});
		});
	}

	/* Focus moves to the remove button now in the same place, or to Add
     file once the list is empty. Undo puts the file back where it was. */
	function removeFile(index) {
		const [file] = meeting.files.splice(index, 1);
		drawFiles();
		const neighbor = pickAll('[data-mdt-file-remove]', nodes.fileList)[Math.min(index, meeting.files.length - 1)];
		(neighbor || nodes.uploadLabel).focus();
		notify({
			tone: 'info',
			icon: 'bi-trash3',
			title: 'File removed',
			text: `${file.name} is no longer shared.`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						meeting.files.splice(index, 0, file);
						drawFiles();
					},
				},
			],
		});
	}

	/* The two dialogs: a new time for the meeting, and calling it off. */

	function moveField(name) {
		return nodes.moveForm.elements[name];
	}

	function chosenLength() {
		return parseInt(pick('input[name="length"]:checked', nodes.moveForm)?.value || '60', 10);
	}

	function proposedStart() {
		const day = moveField('date').value;
		const time = moveField('time').value;
		return day && time ? new Date(`${day}T${time}`) : null;
	}

	function reportMoveClashes() {
		const start = proposedStart();
		const busy = start ? invitedButBusy(start, chosenLength()) : [];
		nodes.moveClashes.classList.toggle('is-warn', busy.length > 0);
		if (!start) nodes.moveClashes.textContent = '';
		else nodes.moveClashes.textContent = busy.length ? clashSentence(busy) : 'Everyone invited is free then.';
	}

	/** Shows or clears the message under a dialog field; an empty text clears it. */
	function markField(field, messageId, text) {
		const message = document.getElementById(messageId);
		if (text) message.textContent = text;
		message.hidden = !text;
		field.classList.toggle('is-invalid', Boolean(text));
		if (text) field.setAttribute('aria-invalid', 'true');
		else field.removeAttribute('aria-invalid');
	}

	function timeProblem(time, start) {
		if (!time || time < '07:00' || time > '19:00') return 'Pick a time between 7:00 AM and 7:00 PM.';
		if (start && start < now) return 'That time has already passed today.';
		return '';
	}

	/* The dialog opens on the meeting's own slot, or tomorrow at the same
     hour once that slot has gone by. */
	function openMoveDialog() {
		const day = meeting.start > now ? meeting.start : new Date(today.getTime() + DAY_MS);
		moveField('date').value = isoDay(day);
		moveField('date').min = isoDay(today);
		moveField('time').value = `${twoDigits(meeting.start.getHours())}:${twoDigits(meeting.start.getMinutes())}`;
		const length = [15, 30, 45, 60, 90].includes(meeting.mins) ? meeting.mins : 60;
		const choice = pick(`input[name="length"][value="${length}"]`, nodes.moveForm);
		choice.checked = true;
		choice.dispatchEvent(new Event('change', { bubbles: true }));
		markField(moveField('date'), 'mdt-move-date-error', '');
		markField(moveField('time'), 'mdt-move-time-error', '');
		nodes.moveHeading.textContent = meeting.canceled ? 'Book it again' : 'Move meeting';
		reportMoveClashes();
		bootstrap.Modal.getOrCreateInstance(nodes.moveDialog).show();
	}

	function openCancelDialog() {
		const others = meeting.people.length - 1 + (meeting.guests || []).length;
		nodes.cancelText.textContent = `${meeting.title}, ${briefDay(meeting.start)} at ${clockTime(meeting.start)}, comes off everyone's calendar and ${count(others, 'person', 'people')} are told.`;
		bootstrap.Modal.getOrCreateInstance(nodes.cancelDialog).show();
	}

	function wireDialogs() {
		nodes.moveDialog.addEventListener('shown.bs.modal', () => moveField('date').focus());

		nodes.moveForm.addEventListener('change', (event) => {
			const { name } = event.target;
			if (name === 'date') markField(moveField('date'), 'mdt-move-date-error', '');
			if (name === 'time') markField(moveField('time'), 'mdt-move-time-error', '');
			reportMoveClashes();
		});

		nodes.moveForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const start = proposedStart();
			const dayValue = moveField('date').value;
			const dateWrong = !dayValue || dayValue < isoDay(today);
			const timeWrong = timeProblem(moveField('time').value, start);
			markField(moveField('date'), 'mdt-move-date-error', dateWrong ? 'Pick today or a later day.' : '');
			markField(moveField('time'), 'mdt-move-time-error', timeWrong);
			if (dateWrong || timeWrong) {
				moveField(dateWrong ? 'date' : 'time').focus();
				return;
			}

			const before = {
				start: meeting.start,
				mins: meeting.mins,
				canceled: meeting.canceled,
				cancelNote: meeting.cancelNote,
				answers: { ...meeting.answers },
			};
			Object.assign(meeting, { start, mins: chosenLength(), canceled: false, cancelNote: '' });
			/* Everyone but the organizer and me is asked to reply again. */
			for (const id of meeting.people) {
				if (id !== myId && id !== meeting.by) meeting.answers[id] = 'wait';
			}
			bootstrap.Modal.getOrCreateInstance(nodes.moveDialog).hide();
			redraw();
			notify({
				tone: 'success',
				icon: 'bi-send-check',
				title: before.canceled ? 'Booked again' : 'New time sent',
				text: `Everyone invited is asked again for ${briefDay(start)} at ${clockTime(start)}.`,
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							Object.assign(meeting, before);
							redraw();
						},
					},
				],
			});
		});

		nodes.cancelConfirm.addEventListener('click', () => {
			meeting.canceled = true;
			meeting.cancelNote = `You called it off on ${briefDay(now)}. Everyone invited has been told.`;
			bootstrap.Modal.getOrCreateInstance(nodes.cancelDialog).hide();
			redraw();
			notify({
				tone: 'info',
				icon: 'bi-calendar-x',
				title: 'Meeting canceled',
				text: `${meeting.title} is off everyone's calendar.`,
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							meeting.canceled = false;
							meeting.cancelNote = '';
							redraw();
						},
					},
				],
			});
		});
	}

	/* Actions reached from the header, the menu and buttons inside the cards. */

	function doAction(name) {
		if (Object.hasOwn(ACTIONS, name)) ACTIONS[name]();
	}

	/* Video and phone meetings open their call page; a room has none, so a
     toast says where to go. */
	function joinMeeting() {
		const callPage = store.callPage(meeting);
		if (callPage) {
			window.location.href = callPage;
			return;
		}
		notify({ tone: 'info', icon: medium.icon, title: medium.going, text: meeting.where });
	}

	function wireActions() {
		nodes.mainAction.addEventListener('click', () => doAction(nodes.mainAction.dataset.do));
		root.addEventListener('click', (event) => {
			const trigger = event.target.closest('[data-mdt-act]');
			if (trigger) {
				doAction(trigger.dataset.mdtAct);
				return;
			}
			if (event.target.closest('[data-mdt-go]')) {
				joinMeeting();
				return;
			}
			if (event.target.closest('[data-mdt-copy-where]')) {
				copyText(meeting.where).then(() =>
					notify({ tone: 'success', icon: 'bi-copy', title: 'Copied', text: meeting.where }),
				);
			}
		});
	}

	/* Markup fragments that several cards build from. */

	function badge(label, tone = '', extra = '') {
		const classes = ['basalt-status', tone && `basalt-status-${tone}`, extra].filter(Boolean).join(' ');
		return `<span class="${classes}">${htmlSafe(label)}</span>`;
	}

	function liveBadge(label) {
		return badge(label, 'danger', 'basalt-status-dot basalt-status-live');
	}

	function avatarSpan(name) {
		return `<span data-basalt-avatar data-name="${htmlSafe(name)}" aria-hidden="true" class="basalt-avatar basalt-avatar-sm"></span>`;
	}

	function removeButton(label) {
		return `<button data-mdt-remove aria-label="${label}" type="button" class="btn btn-outline-secondary btn-square"><i aria-hidden="true" class="bi bi-x-lg"></i></button>`;
	}

	function blankNote(tone, icon, title, text, actions = '') {
		return `<div class="basalt-empty basalt-empty-${tone} basalt-empty-compact mdt-empty"><span aria-hidden="true" class="basalt-empty-icon"><i class="bi ${icon}"></i></span><h3 class="basalt-empty-title">${title}</h3><p class="basalt-empty-text">${text}</p>${actions}</div>`;
	}

	/* Agenda items, chapters and files walk the eight-step chart ramp. */
	function rampClass(step) {
		return `mdt-series-${(step % 8) + 1}`;
	}

	function appendRow(list, markup) {
		list.insertAdjacentHTML('beforeend', markup);
		pick('input', list.lastElementChild).focus();
	}

	/**
	 * Removes an editor row and returns where focus should land: the first
	 * input of the row that took its place, or the fallback when none is left.
	 */
	function dropRow(row, fallback) {
		const neighbor = row.nextElementSibling || row.previousElementSibling;
		row.remove();
		return neighbor ? pick('input', neighbor) : fallback;
	}

	/* Small helpers with no ties to one card. */

	function hosting() {
		return meeting.reply === 'host';
	}

	function isUpcoming() {
		const phase = phaseOf(meeting);
		return phase === 'next' || phase === 'live';
	}

	function givenName(id) {
		return wholeName(id).split(' ')[0];
	}

	function count(amount, singular, pluralForm = `${singular}s`) {
		return `${amount} ${amount === 1 ? singular : pluralForm}`;
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (character) => ENTITIES[character]);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function copyText(text) {
		return window.Basalt.copyText ? window.Basalt.copyText(text) : Promise.resolve();
	}

	/** Runs a call the browser may not support; returns the fallback if it throws. */
	function attempt(call, fallback) {
		try {
			return call();
		} catch {
			return fallback;
		}
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	/* Dates and times, written the way the rest of the app writes them. */

	function startOfDay(date) {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate());
	}

	function twoDigits(number) {
		return String(number).padStart(2, '0');
	}

	function abbreviate(word) {
		return word.slice(0, 3);
	}

	function isoDay(date) {
		return [date.getFullYear(), twoDigits(date.getMonth() + 1), twoDigits(date.getDate())].join('-');
	}

	function parseDay(text) {
		return new Date(`${text}T00:00`);
	}

	function fullDay(date) {
		return `${WEEKDAYS[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
	}

	function briefDay(date) {
		return `${abbreviate(WEEKDAYS[date.getDay()])}, ${abbreviate(MONTH_NAMES[date.getMonth()])} ${date.getDate()}`;
	}

	/* Today, Tomorrow and Yesterday by name; any other day in full. */
	function relativeDay(date) {
		const offset = Math.round((startOfDay(date) - today) / DAY_MS);
		return { 0: 'Today', 1: 'Tomorrow', '-1': 'Yesterday' }[offset] || fullDay(date);
	}

	function clockTime(date) {
		const hours = date.getHours();
		return `${hours % 12 || 12}:${twoDigits(date.getMinutes())} ${hours < 12 ? 'AM' : 'PM'}`;
	}

	/* 2:00 to 3:00 PM, or 11:30 AM to 12:15 PM across noon. */
	function timeRange(entry) {
		const [from, to] = [entry.start, endsAt(entry)].map(clockTime);
		return `${from.endsWith(to.slice(-2)) ? from.slice(0, -3) : from} to ${to}`;
	}

	function duration(minutes) {
		const hours = Math.floor(minutes / 60);
		const rest = minutes % 60;
		if (!hours) return `${rest} min`;
		return rest ? `${hours} h ${rest} min` : `${hours} h`;
	}

	function minutesSeconds(seconds) {
		return `${Math.floor(seconds / 60)}:${twoDigits(Math.floor(seconds % 60))}`;
	}

	/* Rounder the further off it is: minutes, then five-minute steps, then
     whole hours, then days. */
	function timeUntil(minutes) {
		if (minutes < 60) return count(minutes, 'min', 'min');
		if (minutes < 1440) return duration(Math.round(minutes / 5) * 5);
		if (minutes < 2880) return duration(Math.round(minutes / 60) * 60);
		return count(Math.round(minutes / 1440), 'day');
	}

	start();
})();
