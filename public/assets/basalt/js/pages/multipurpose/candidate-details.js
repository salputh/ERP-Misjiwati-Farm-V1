/**
 * Candidate profile, the script behind candidate-details.html.
 *
 * Shows one applicant from top to bottom: which of the five hiring stages
 * they have reached, each interview round and the scorecard it produced,
 * a short CV, contact details and terms (editable right on the card),
 * their files, and the team's notes mixed into the history. Buttons in the
 * header advance them a stage or turn them down, and either can be undone.
 * Parts borrowed from basalt.js: the detail header, avatars, status pills,
 * styled selects, dialogs, the file drop zone and toasts.
 */
(() => {
	'use strict';

	/* A real app gets these from the server and the clock. The applicant is
     whoever ?id= names, looked up in the same records the Hiring page
     uses (assets/basalt/js/data/multipurpose/hiring.js); without an id the page shows
     Beatriz Antunes. */
	const TODAY = '2026-10-09';
	const VIEWER = 'John Armstrong';

	/* Stage order matters: the next stage is always the one after. The
     colors match the Hiring board through data-stage. */
	const PIPELINE = [
		{ key: 'applied', label: 'Applied' },
		{ key: 'screen', label: 'Screening' },
		{ key: 'interview', label: 'Interviews' },
		{ key: 'offer', label: 'Offer' },
		{ key: 'hired', label: 'Hired' },
	];

	const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const DAY_MS = 86400000;
	const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	const FILE_GLYPHS = {
		pdf: 'bi-file-earmark-pdf',
		doc: 'bi-file-earmark-word',
		image: 'bi-file-earmark-image',
		code: 'bi-code-slash',
	};
	const HISTORY_GLYPHS = {
		referral: 'bi-people',
		move: 'bi-arrow-right-circle',
		call: 'bi-camera-video',
		file: 'bi-paperclip',
		book: 'bi-calendar-check',
		note: 'bi-chat-left-text',
		out: 'bi-person-x',
		back: 'bi-arrow-counterclockwise',
		edit: 'bi-pencil',
	};
	/* History lines shown before the "Show more" button. */
	const HISTORY_VISIBLE = 4;

	/* Take-home work per role: [file name, kind, size line]. */
	const TAKE_HOME = {
		backend: ['Code review: visit batcher', 'code', 'Repository link'],
		platform: ['Incident write-up', 'doc', 'Word, 48 KB'],
		designer: ['Portfolio', 'code', 'Website link'],
		growth: ['Growth case study', 'pdf', 'PDF, 2.1 MB'],
	};

	/* The applicant, flattened from the shared records. */
	const hiring = window.Basalt.data.hiring;
	const directory = window.Basalt.data.people;
	const record = hiring.find(new URLSearchParams(location.search).get('id') || '') || hiring.find('#4110');
	const opening = hiring.roles[record.role];
	const resume = hiring.cv(record);
	const person = {
		id: record.id,
		first: record.first,
		last: record.last,
		role: opening.title,
		team: opening.team,
		where: opening.where,
		stage: record.stage,
		source: record.source,
		referrer: record.referrer,
		agency: record.agency,
		staff: record.staff,
		applied: record.applied,
		reached: record.reached,
		recruiter: opening.recruiter,
		manager: opening.manager,
		details: hiring.details(record),
	};
	const wholeName = `${person.first} ${person.last}`;

	/* Avatar color from the id, so it matches the Hiring board every time. */
	let codeSum = 0;
	for (const character of person.id) codeSum += character.charCodeAt(0);
	const avatarTone = (codeSum % 8) + 1;

	/* What lies ahead the moment someone reaches the offer or hired stage. */
	const NEXT_AFTER = {
		offer: { what: 'Offer letter', note: `To draft with ${person.recruiter}` },
		hired: {
			what: 'Start date',
			note: person.staff ? `Starts ${weekdayDate(record.next.date)}` : `To agree with ${person.manager}`,
		},
	};

	/* Rounds come from the role's interview plan. `tone` picks one of the
     palette's chart colors, `scores` holds [what was rated, 1 to 4] and
     `looks` lists what a round still to come will rate. */
	const plannedRounds = hiring.rounds(record);

	/* Plain history lines from the record, turned into [kind, who, text]. */
	const HISTORY_READERS = [
		[/^Referred by (.+)$/, ([, who]) => ['referral', who, `referred ${person.first} for ${person.role}`]],
		[
			/^Put forward by (.+)$/,
			([, agency]) => ['referral', person.recruiter, `got ${person.first}’s CV from ${agency}`],
		],
		[/^Moved to (\w+) by (.+)$/, ([, stage, who]) => ['move', who, `moved them to ${stage}`]],
		[
			/^Offer (sent|approved) by (.+)$/,
			([, step, who]) => ['move', who, step === 'sent' ? 'sent the offer' : 'approved the offer'],
		],
	];

	const view = {
		stage: person.stage,
		reached: { ...person.reached },
		out: null,
		details: { ...person.details },
		rounds: plannedRounds.map((round) => ({ ...round })),
		files: startingFiles(),
		history: startingHistory(),
		historyExpanded: false,
		bookingIndex: null,
	};

	const ui = {
		primary: pick('[data-cv-primary]'),
		bookDialog: pick('#cv-book'),
		bookForm: pick('[data-cv-book-form]'),
		rejectDialog: pick('#cv-reject'),
		detailsForm: pick('[data-cv-form]'),
		editButton: pick('[data-cv-edit]'),
		noteForm: pick('[data-cv-note-form]'),
		noteField: pick('[data-cv-note]'),
		dropZone: pick('[data-cv-drop]'),
	};

	/**
	 * Draws every card, fills the interviewer list, then listens for the
	 * header buttons, both dialogs, the details form, notes and dropped files.
	 */
	function start() {
		paintAll();
		drawTrack();
		paintFacts();
		paintFiles();
		paintResume();
		fillInterviewers();

		document.addEventListener('click', routeClick);

		pick('[data-cv-reject-go]', ui.rejectDialog).addEventListener('click', turnDown);
		ui.rejectDialog.addEventListener('hidden.bs.modal', resetRejectDialog);

		ui.bookForm.addEventListener('submit', confirmBooking);
		ui.bookForm.addEventListener('input', (event) => {
			if (event.target.classList.contains('is-invalid') && event.target.value) markField(event.target, false);
		});
		ui.bookDialog.addEventListener('hidden.bs.modal', () => {
			view.bookingIndex = null;
		});

		ui.editButton.addEventListener('click', beginEditing);
		pick('[data-cv-edit-cancel]').addEventListener('click', stopEditing);
		ui.detailsForm.addEventListener('submit', saveDetails);
		ui.detailsForm.addEventListener('input', (event) => {
			if (event.target.classList.contains('is-invalid') && event.target.value.trim())
				markField(event.target, false);
		});
		ui.detailsForm.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			stopEditing();
		});

		ui.noteForm.addEventListener('submit', postNote);
		ui.noteField.addEventListener('input', clearNoteError);
		ui.dropZone.addEventListener('basalt:files', (event) => {
			for (const file of event.detail.files) attachFile(file);
		});
	}

	/* Small shared helpers. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function slot(name) {
		return pick(`[data-cv="${name}"]`);
	}

	function htmlSafe(value) {
		return `${value ?? ''}`.replace(/[&<>"']/g, (character) => ENTITIES[character]);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	/** "two rounds", "one file": small counts as words, larger as digits. */
	function spell(amount, singular, plural) {
		const number = amount < NUMBER_WORDS.length ? NUMBER_WORDS[amount] : `${amount}`;
		return `${number} ${amount === 1 ? singular : plural || `${singular}s`}`;
	}

	function upperFirst(text) {
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	function lowerFirst(text) {
		return text.charAt(0).toLowerCase() + text.slice(1);
	}

	function firstNameOf(name) {
		return name.split(' ')[0];
	}

	function stageAt(key) {
		return PIPELINE.findIndex((stage) => stage.key === key);
	}

	function stageLabel(key) {
		return PIPELINE[stageAt(key)].label;
	}

	/* Dates. Everything is an ISO day string; times are "HH:MM". */

	function parseDay(iso) {
		const [year, month, day] = iso.split('-').map(Number);
		return new Date(year, month - 1, day);
	}

	function dayGap(fromIso, toIso) {
		return Math.round((parseDay(toIso) - parseDay(fromIso)) / DAY_MS);
	}

	function shiftDay(iso, amount) {
		const date = parseDay(iso);
		date.setDate(date.getDate() + amount);
		return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
	}

	function twoDigits(part) {
		return `${part}`.padStart(2, '0');
	}

	function shortDate(iso) {
		const date = parseDay(iso);
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
	}

	function weekdayDate(iso) {
		return `${WEEKDAY_ABBR[parseDay(iso).getDay()]}, ${shortDate(iso)}`;
	}

	function clockTime(time) {
		const [hours, minutes] = time.split(':').map(Number);
		return `${hours % 12 || 12}:${twoDigits(minutes)} ${hours < 12 ? 'am' : 'pm'}`;
	}

	/** "Today, 3:00 pm", "Tomorrow, 10:00 am" or "Tue, Oct 13, 10:00 am". */
	function relativeWhen(iso, time) {
		const gap = dayGap(TODAY, iso);
		const day = { 0: 'Today', 1: 'Tomorrow' }[gap] || weekdayDate(iso);
		return time ? `${day}, ${clockTime(time)}` : day;
	}

	/* People and where the applicant came from. */

	function sourceLine() {
		if (person.referrer) return `Referred by ${person.referrer}`;
		return person.agency ? `Agency, ${person.agency}` : hiring.sources[person.source];
	}

	/** A colleague's HR page from the shared roster, or the staff list if unknown. */
	function staffLink(name) {
		const match = directory.people.find((entry) => directory.nameOf(entry) === name);
		return match ? directory.staffPage(match) : 'employees.html';
	}

	function colleagueLink(name) {
		return `<a class="cv-link" href="${staffLink(name)}">${htmlSafe(name)}</a>`;
	}

	/* The starting record: the files already held and the history so far. */

	function startingFiles() {
		const files = [
			{
				name: `${person.first}-${person.last}-CV.pdf`,
				kind: 'pdf',
				meta: `PDF, ${120 + (directory.hash(person.id) % 140)} KB`,
				added: person.applied,
			},
		];
		if (person.source === 'careers') {
			files.push({
				name: 'Cover-letter.pdf',
				kind: 'pdf',
				meta: `PDF, ${40 + (directory.hash(`${person.id}l`) % 40)} KB`,
				added: person.applied,
			});
		}

		const finished = plannedRounds.filter((round) => round.state === 'done');
		const task = TAKE_HOME[record.role];
		if (task && (finished.length > 1 || record.role === 'designer')) {
			const [name, kind, meta] = task;
			files.push({
				name,
				kind,
				meta,
				added: finished.length > 1 ? shiftDay(finished[1].date, -2) : person.applied,
			});
		}

		if (person.reached.offer)
			files.push({ name: 'Offer letter.pdf', kind: 'pdf', meta: 'PDF, 96 KB', added: person.reached.offer });
		if (person.reached.hired)
			files.push({ name: 'Signed contract.pdf', kind: 'pdf', meta: 'PDF, 212 KB', added: person.reached.hired });
		return files;
	}

	/**
	 * The history, oldest first, as [day, kind, who, text]. Kind `note` is a
	 * team note; every other kind is something that happened.
	 */
	function startingHistory() {
		const lines = record.history.map(([day, text]) => [day, ...readHistoryLine(day, text)]);

		const upcoming = plannedRounds.find((round) => round.state === 'booked');
		if (upcoming) {
			const finalDay = record.history[record.history.length - 1][0];
			const twoDaysOn = shiftDay(finalDay, 2);
			const bookedOn = twoDaysOn < TODAY ? twoDaysOn : TODAY;
			const roundName = upcoming.name.toLowerCase();
			lines.push([
				bookedOn,
				'book',
				person.recruiter,
				`booked the ${roundName} for ${weekdayDate(upcoming.date)}`,
			]);
			if (person.referrer) {
				lines.push([
					bookedOn,
					'note',
					person.manager,
					`${firstNameOf(person.referrer)} worked with ${person.first} before. Ask about ${resume.jobs[0].title.split(', ')[1]} in the ${roundName}.`,
				]);
			}
		}

		return lines.sort((left, right) => left[0].localeCompare(right[0]));
	}

	function readHistoryLine(day, text) {
		for (const [pattern, read] of HISTORY_READERS) {
			const hit = pattern.exec(text);
			if (hit) return read(hit);
		}
		const heldRound = plannedRounds.find((round) => round.state === 'done' && round.date === day);
		if (heldRound) return ['call', heldRound.who, `held the ${heldRound.name.toLowerCase()}: ${heldRound.verdict}`];
		if (/^(Applied|Signed|Accepted)/.test(text)) return ['file', wholeName, lowerFirst(text)];
		return ['call', person.manager, lowerFirst(text)];
	}

	function logEvent(kind, text, who) {
		view.history.push([TODAY, kind, who || VIEWER, text]);
	}

	/* Whole-page redraw after anything that changes the stage. */

	function paintAll() {
		paintHeader();
		paintProgress();
		paintRounds();
		paintScorecards();
		paintHistory();
	}

	/* Header: avatar, name, pills, the main button and the More menu. */

	function stageBadge(key) {
		return `<span class="basalt-status basalt-status-dot cv-stage-pill" data-stage="${key}">${stageLabel(key)}</span>`;
	}

	/** The header's main button for where the applicant stands, or null when hired. */
	function mainAction() {
		if (view.out) return { act: 'reopen', icon: 'bi-arrow-counterclockwise', label: 'Reopen' };
		if (view.stage === 'hired') return null;
		if (view.stage === 'offer') return { act: 'next', icon: 'bi-person-check', label: 'Mark as hired' };
		return { act: 'next', icon: 'bi-arrow-right', label: `Move to ${PIPELINE[stageAt(view.stage) + 1].label}` };
	}

	function paintHeader() {
		const avatar = slot('avatar');
		avatar.className = `basalt-avatar basalt-avatar-xl basalt-avatar-tone-${avatarTone}`;
		avatar.textContent = person.first.charAt(0) + person.last.charAt(0);
		slot('name').textContent = wholeName;
		slot('sub').textContent = `${person.role} · ${view.details.city}`;
		const standing = view.out
			? '<span class="basalt-status basalt-status-dot basalt-status-danger">Turned down</span>'
			: stageBadge(view.stage);
		slot('tags').innerHTML =
			`${standing}<span class="basalt-status cv-source">${htmlSafe(hiring.sources[person.source])}</span><span class="cv-id">${person.id}</span>`;

		const action = mainAction();
		ui.primary.hidden = !action;
		if (action) {
			ui.primary.dataset.cvAct = action.act;
			ui.primary.innerHTML = `<i class="bi ${action.icon} me-1" aria-hidden="true"></i>${action.label}`;
		}

		slot('menu').innerHTML = moreMenu().join('');

		const notice = slot('notice');
		notice.hidden = !view.out;
		if (!view.out) return;
		const emailLine = view.out.emailed ? ' They get the email today.' : ' No email sent.';
		notice.innerHTML = `<i class="bi bi-person-x" aria-hidden="true"></i><span>Turned down today by ${htmlSafe(VIEWER)}: ${htmlSafe(view.out.reason.toLowerCase())}.${emailLine} Booked interviews are canceled.</span>`;
	}

	function moreMenu() {
		const entries = [
			`<li><a class="dropdown-item" href="mailto:${htmlSafe(view.details.email)}"><i class="bi bi-envelope" aria-hidden="true"></i>Email ${htmlSafe(person.first)}</a></li>`,
			'<li><button type="button" class="dropdown-item" data-cv-act="download" data-cv-file="0"><i class="bi bi-download" aria-hidden="true"></i>Download CV</button></li>',
		];
		if (person.staff) {
			entries.push(
				`<li><a class="dropdown-item" href="employee-details.html?id=${encodeURIComponent(person.staff)}"><i class="bi bi-person-badge" aria-hidden="true"></i>Employee record</a></li>`,
			);
		}
		if (!view.out && view.stage !== 'hired') {
			entries.push(
				'<li><hr class="dropdown-divider"></li>',
				'<li><button type="button" class="dropdown-item cv-danger-item" data-cv-act="reject"><i class="bi bi-person-x" aria-hidden="true"></i>Turn down</button></li>',
			);
		}
		return entries;
	}

	/* Progress: a sentence, the stage track and three at-a-glance facts. */

	function finishedRounds() {
		return view.rounds.filter((round) => round.state === 'done');
	}

	/** The earliest booked round from today on, else the first still to book. */
	function upcomingRound() {
		const booked = view.rounds
			.filter((round) => round.state === 'booked' && dayGap(TODAY, round.date) >= 0)
			.sort((left, right) => `${left.date}${left.time}`.localeCompare(`${right.date}${right.time}`));
		return booked[0] || view.rounds.find((round) => round.state === 'todo') || null;
	}

	function progressSentence() {
		if (view.out) return `${person.first} is out of the running for ${person.role}.`;
		if (view.stage === 'hired') return `${person.first} accepted the offer for ${person.role}.`;
		if (view.stage === 'offer')
			return `${person.first} passed the interviews for ${person.role}. The offer is next.`;
		const next = upcomingRound();
		const tail =
			next && next.state === 'booked'
				? `. ${next.name} with ${firstNameOf(next.who)} on ${weekdayDate(next.date)}.`
				: '.';
		return `Interviewing for ${person.role}, ${NUMBER_WORDS[finishedRounds().length]} of ${NUMBER_WORDS[view.rounds.length]} rounds done${tail}`;
	}

	function paintProgress() {
		slot('progress-desc').textContent = progressSentence();
		paintTrack();
		paintGlance();
	}

	function paintTrack() {
		const reachedAt = stageAt(view.stage);
		slot('track').innerHTML = PIPELINE.map((stage, position) => {
			const passed = position < reachedAt || (view.stage === 'hired' && position === reachedAt);
			const here = position === reachedAt && !passed;
			const stoppedHere = here && Boolean(view.out);

			let modifier = '';
			let marker = `${position + 1}`;
			let note = 'Not yet';
			let spoken = 'not reached';
			if (passed) {
				modifier = ' is-done';
				marker = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
				note = shortDate(view.reached[stage.key]);
				spoken = 'done';
			} else if (stoppedHere) {
				modifier = ' is-out';
				marker = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
				note = 'Turned down';
				spoken = 'turned down here';
			} else if (here) {
				modifier = ' is-current';
				note = `Since ${shortDate(view.reached[stage.key])}`;
				spoken = 'current stage';
			}

			return `<li class="cv-step${modifier}" data-stage="${stage.key}"${here ? ' aria-current="step"' : ''}><span class="cv-step-marker" aria-hidden="true">${marker}</span><span class="cv-step-label">${stage.label}<span class="visually-hidden">, ${spoken}</span></span><span class="cv-step-note">${note}</span></li>`;
		}).join('');
	}

	function glanceFact(glyph, tone, label, value, note) {
		return `<div class="cv-glance-item" data-tone="${tone}"><dt><span class="cv-glance-icon" aria-hidden="true"><i class="bi ${glyph}"></i></span>${label}</dt><dd><span class="cv-glance-value">${value}</span><span class="cv-glance-note">${note}</span></dd></div>`;
	}

	function nextStepFact() {
		if (view.out)
			return glanceFact('bi-calendar-x', 'next', 'Next step', 'None', 'Reopen to pick up where you left off');
		const ahead = NEXT_AFTER[view.stage];
		if (ahead) return glanceFact('bi-calendar-event', 'next', 'Next step', ahead.what, ahead.note);
		const next = upcomingRound();
		if (next && next.state === 'booked') {
			return glanceFact(
				'bi-calendar-event',
				'next',
				'Next interview',
				htmlSafe(relativeWhen(next.date, next.time)),
				`${htmlSafe(next.name)} with ${htmlSafe(next.who)}`,
			);
		}
		return glanceFact(
			'bi-calendar-event',
			'next',
			'Next interview',
			'To book',
			next ? `${htmlSafe(next.name)} with ${htmlSafe(next.who)}` : 'Every round is done',
		);
	}

	function scorecardFact() {
		const finished = finishedRounds();
		if (!finished.length)
			return glanceFact(
				'bi-hand-thumbs-up',
				'votes',
				'Scorecards',
				'None yet',
				'They show after the first interview',
			);

		const strongCount = finished.filter((round) => round.verdict === 'Strong yes').length;
		const plainCount = finished.length - strongCount;
		const pending = view.rounds.filter((round) => round.state === 'booked');
		const value = `${upperFirst(spell(finished.length, 'in', 'in'))}, ${finished.length === 2 ? 'both' : 'all'} yes`;
		const split = [
			strongCount && spell(strongCount, 'strong yes', 'strong yes'),
			plainCount && spell(plainCount, 'yes', 'yes'),
		]
			.filter(Boolean)
			.join(', ');
		const due =
			pending.length && !view.out
				? ` · ${htmlSafe(firstNameOf(pending[0].who))}’s due ${shortDate(shiftDay(pending[0].date, 1))}`
				: '';
		return glanceFact('bi-hand-thumbs-up', 'votes', 'Scorecards', value, upperFirst(split) + due);
	}

	function ageFact() {
		const days = dayGap(person.applied, TODAY);
		return glanceFact(
			'bi-hourglass-split',
			'age',
			'In the process',
			`${days} days`,
			`Since ${shortDate(person.applied)}, ${htmlSafe(lowerFirst(sourceLine()))}`,
		);
	}

	/**
	 * The first time the track is on screen, the lines between passed stages
	 * draw in one after another. Later redraws show them already drawn.
	 */
	function drawTrack() {
		const track = slot('track');
		const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!pick('.cv-step.is-done', track) || still || !window.IntersectionObserver) return;
		track.classList.add('is-waiting');
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				track.classList.replace('is-waiting', 'is-drawing');
				const runs = track.getAnimations({ subtree: true }).map((run) => run.finished);
				Promise.allSettled(runs).then(() => track.classList.remove('is-drawing'));
			},
			{ threshold: 0.5 },
		);
		watch.observe(track);
	}

	function paintGlance() {
		slot('glance').innerHTML = nextStepFact() + scorecardFact() + ageFact();
	}

	/* Interview rounds, one row each. */

	function verdictTone(verdict) {
		if (verdict === 'Strong yes' || verdict === 'Yes') return 'success';
		return verdict === 'Mixed' ? 'warning' : 'danger';
	}

	const CANCELED_PILL = '<span class="basalt-status">Canceled</span>';

	/* When, result and button for a round in each state; anything other
     than done or booked reads as still to book. */
	const ROUND_CELLS = {
		done: (round) => ({
			when: htmlSafe(relativeWhen(round.date, round.time)),
			status: `<span class="basalt-status basalt-status-${verdictTone(round.verdict)}"><i class="bi bi-hand-thumbs-up-fill" aria-hidden="true"></i>${htmlSafe(round.verdict)}</span>`,
			action: '',
		}),
		booked: (round, position) => ({
			when: htmlSafe(relativeWhen(round.date, round.time)),
			status: view.out
				? CANCELED_PILL
				: '<span class="basalt-status basalt-status-info basalt-status-dot">Booked</span>',
			action: view.out
				? ''
				: `<button type="button" class="btn btn-sm btn-outline-secondary" data-cv-book="${position}">Reschedule</button>`,
		}),
		todo: (round, position) => ({
			when: '<span class="cv-quiet">Not booked</span>',
			status: view.out
				? CANCELED_PILL
				: '<span class="basalt-status basalt-status-warning basalt-status-dot">To book</span>',
			action: view.out
				? ''
				: `<button type="button" class="btn btn-sm btn-outline-primary" data-cv-book="${position}">Book</button>`,
		}),
	};

	function roundRow(round, position) {
		const cells = (ROUND_CELLS[round.state] || ROUND_CELLS.todo)(round, position);
		const meta = `With <a class="cv-link" href="${staffLink(round.who)}">${htmlSafe(round.who)}</a> · ${round.mins} min, video`;
		return `<li class="cv-round cv-tone-${round.tone}"><span class="cv-round-icon" aria-hidden="true">${position + 1}</span><span class="cv-round-text"><span class="cv-round-name">${htmlSafe(round.name)}</span><span class="cv-round-meta">${meta}</span></span><span class="cv-round-when">${cells.when}</span><span class="cv-round-status">${cells.status}</span><span class="cv-round-action">${cells.action}</span></li>`;
	}

	function paintRounds() {
		slot('rounds-desc').textContent =
			`${upperFirst(spell(view.rounds.length, 'round'))}, ${spell(finishedRounds().length, 'done', 'done')}. Every round is on video.`;
		slot('rounds').innerHTML = view.rounds.map(roundRow).join('');
	}

	/* Scorecards: written ones in full, booked ones as a promise. */

	function rateRow([skill, rating]) {
		let pips = '';
		for (let pip = 1; pip <= 4; pip += 1) pips += `<span${pip <= rating ? ' class="is-on"' : ''}></span>`;
		return `<div class="cv-rate"><dt>${htmlSafe(skill)}</dt><dd><span class="cv-rate-bar" aria-hidden="true">${pips}</span><span class="cv-rate-n">${rating}<span class="visually-hidden"> out of 4</span></span></dd></div>`;
	}

	function scorecard(round) {
		const initials = round.who
			.split(' ')
			.map((word) => word.charAt(0))
			.join('');
		const author = `<span class="cv-score-who"><span class="basalt-avatar basalt-avatar-sm basalt-avatar-tone-${round.tone}" aria-hidden="true">${htmlSafe(initials)}</span><span class="cv-score-text"><span class="cv-score-name">${htmlSafe(round.who)}</span><span class="cv-score-round">${htmlSafe(round.name)}</span></span></span>`;

		if (round.state !== 'done') {
			const looks = round.looks.map((look) => `<dd>${htmlSafe(look)}</dd>`).join('');
			return `<div class="cv-score cv-score-waiting cv-tone-${round.tone}">${author}<p class="cv-score-wait"><i class="bi bi-hourglass-split" aria-hidden="true"></i>Due ${weekdayDate(shiftDay(round.date, 1))}, the day after the interview.</p><dl class="cv-score-looks"><dt>Will rate</dt>${looks}</dl></div>`;
		}
		const verdict = `<span class="basalt-status basalt-status-${verdictTone(round.verdict)}">${htmlSafe(round.verdict)}</span>`;
		return `<div class="cv-score cv-tone-${round.tone}"><div class="cv-score-head">${author}${verdict}</div><dl class="cv-rates">${round.scores.map(rateRow).join('')}</dl><blockquote class="cv-score-said">${htmlSafe(round.said)}</blockquote></div>`;
	}

	/* Once someone is turned down, only scorecards already written remain. */
	function paintScorecards() {
		const visible = view.rounds.filter(
			(round) => round.state === 'done' || (round.state === 'booked' && !view.out),
		);
		const holder = slot('scores');
		holder.setAttribute('data-count', visible.length);
		holder.innerHTML = visible.map(scorecard).join('');
	}

	/* Details card: a read-only list that swaps for a form while editing. */

	function paintFacts() {
		const details = view.details;
		const notGiven = '<span class="cv-quiet">Not given</span>';
		const facts = [
			['Email', `<a class="cv-link" href="mailto:${htmlSafe(details.email)}">${htmlSafe(details.email)}</a>`],
			['Phone', details.phone ? htmlSafe(details.phone) : notGiven],
			['Based in', htmlSafe(details.city)],
			['Notice period', htmlSafe(details.notice)],
			['Salary hopes', details.salary ? `${htmlSafe(details.salary)} a year` : notGiven],
			['Work rights', htmlSafe(details.rights)],
			['Source', person.referrer ? `Referred by ${colleagueLink(person.referrer)}` : htmlSafe(sourceLine())],
			['Recruiter', colleagueLink(person.recruiter)],
			[
				'Role',
				`${htmlSafe(person.role)}<span class="cv-facts-note">${htmlSafe(person.team)} · ${htmlSafe(person.where)}</span>`,
			],
		];
		slot('facts').innerHTML = facts
			.map(([term, value]) => `<div class="cv-facts-row"><dt>${term}</dt><dd>${value}</dd></div>`)
			.join('');
	}

	/** Sets or clears a field's error state and hands the flag back. */
	function markField(field, invalid) {
		field.classList.toggle('is-invalid', invalid);
		if (invalid) field.setAttribute('aria-invalid', 'true');
		else field.removeAttribute('aria-invalid');
		return invalid;
	}

	function clearErrors(form) {
		for (const field of pickAll('.is-invalid', form)) markField(field, false);
	}

	/* Styled selects listen for change, so a value set in code announces itself. */
	function chooseOption(select, value) {
		select.value = value;
		select.dispatchEvent(new Event('change', { bubbles: true }));
	}

	function beginEditing() {
		const form = ui.detailsForm;
		const { email, phone, city, notice, salary } = view.details;
		form.email.value = email;
		form.phone.value = phone;
		form.city.value = city;
		chooseOption(form.notice, notice);
		form.salary.value = salary;
		clearErrors(form);

		slot('facts').hidden = true;
		form.hidden = false;
		ui.editButton.hidden = true;
		form.email.focus();
	}

	function stopEditing() {
		ui.detailsForm.hidden = true;
		slot('facts').hidden = false;
		ui.editButton.hidden = false;
		ui.editButton.focus({ preventScroll: true });
	}

	function saveDetails(event) {
		event.preventDefault();
		const form = ui.detailsForm;
		const emailBad = markField(form.email, !EMAIL_SHAPE.test(form.email.value.trim()));
		const cityBad = markField(form.city, !form.city.value.trim());
		if (emailBad || cityBad) {
			(emailBad ? form.email : form.city).focus();
			return;
		}

		Object.assign(view.details, {
			email: form.email.value.trim(),
			phone: form.phone.value.trim(),
			city: form.city.value.trim(),
			notice: form.notice.value,
			salary: form.salary.value.trim(),
		});
		logEvent('edit', 'updated the details');
		paintFacts();
		paintHeader();
		paintHistory();
		stopEditing();
		notify({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'Details saved',
			text: `${person.first}’s contact details and terms are up to date.`,
		});
	}

	/* Files on record, plus anything dropped onto the card. */

	function fileRow(file, position) {
		const isLink = file.kind === 'code';
		const added = file.added === TODAY ? 'Added today' : `Added ${shortDate(file.added)}`;
		const button = `<button type="button" class="btn btn-icon cv-doc-get" data-cv-act="download" data-cv-file="${position}" aria-label="${isLink ? 'Open ' : 'Download '}${htmlSafe(file.name)}"><i class="bi ${isLink ? 'bi-box-arrow-up-right' : 'bi-download'}" aria-hidden="true"></i></button>`;
		return `<li class="cv-doc" data-kind="${file.kind}"><span class="cv-doc-icon" aria-hidden="true"><i class="bi ${FILE_GLYPHS[file.kind]}"></i></span><span class="cv-doc-text"><span class="cv-doc-name">${htmlSafe(file.name)}</span><span class="cv-doc-meta">${htmlSafe(file.meta)} · ${added}</span></span>${button}</li>`;
	}

	function paintFiles() {
		slot('docs-desc').textContent = `${upperFirst(spell(view.files.length, 'file'))} on record, newest last.`;
		slot('docs').innerHTML = view.files.map(fileRow).join('');
	}

	function fileKind(extension) {
		if (extension === 'pdf') return 'pdf';
		return extension === 'doc' || extension === 'docx' ? 'doc' : 'image';
	}

	function attachFile(file) {
		const extension = (file.name.split('.').pop() || '').toLowerCase();
		const kilobytes = Math.max(1, Math.round(file.size / 1024));
		const size = kilobytes >= 1024 ? `${(kilobytes / 1024).toFixed(1)} MB` : `${kilobytes} KB`;
		view.files.push({
			name: file.name,
			kind: fileKind(extension),
			meta: `${extension.toUpperCase()}, ${size}`,
			added: TODAY,
		});
		logEvent('file', `added ${file.name}`);
		paintFiles();
		paintHistory();
		notify({
			tone: 'success',
			icon: 'bi-paperclip',
			title: 'File added',
			text: `${file.name} is on ${person.first}’s record.`,
		});
	}

	/* Notes and history, newest first, folded after a few lines. */

	function historyRow([day, kind, who, text]) {
		const isNote = kind === 'note';
		const line = isNote
			? `<span class="cv-log-line"><strong>${htmlSafe(who)}</strong> added a note</span><span class="cv-log-note">${htmlSafe(text)}</span>`
			: `<span class="cv-log-line"><strong>${htmlSafe(who)}</strong> ${htmlSafe(text)}</span>`;
		return `<li class="cv-log-item${isNote ? ' cv-log-item-note' : ''}" data-kind="${kind}"><span class="cv-log-icon" aria-hidden="true"><i class="bi ${HISTORY_GLYPHS[kind]}"></i></span><span class="cv-log-text">${line}<span class="cv-log-when">${day === TODAY ? 'Today' : weekdayDate(day)}</span></span></li>`;
	}

	function paintHistory() {
		const newestFirst = [...view.history].reverse();
		const visible = view.historyExpanded ? newestFirst : newestFirst.slice(0, HISTORY_VISIBLE);
		const hidden = newestFirst.length - visible.length;
		const more = hidden
			? `<li class="cv-log-more"><button type="button" class="btn btn-sm btn-outline-secondary" data-cv-act="more">Show ${spell(hidden, 'more line', 'more lines')}</button></li>`
			: '';
		slot('log').innerHTML = visible.map(historyRow).join('') + more;
	}

	function postNote(event) {
		event.preventDefault();
		const text = ui.noteField.value.trim();
		const empty = !text;
		markField(ui.noteField, empty);
		pick('#cv-note-error').hidden = !empty;
		if (empty) {
			ui.noteField.focus();
			return;
		}
		logEvent('note', text);
		ui.noteField.value = '';
		paintHistory();
		notify({ tone: 'success', icon: 'bi-chat-left-text', title: 'Note added', text: 'Only your team sees it.' });
	}

	function clearNoteError() {
		if (!ui.noteField.value.trim() || !ui.noteField.classList.contains('is-invalid')) return;
		markField(ui.noteField, false);
		pick('#cv-note-error').hidden = true;
	}

	/* Clicks anywhere on the page that carry a data-cv-act or data-cv-book. */

	const CLICK_ACTIONS = {
		next: advanceStage,
		reopen: reopenApplication,
		reject: openRejectDialog,
		more() {
			window.Basalt.slide(slot('log'), () => {
				view.historyExpanded = true;
				paintHistory();
			});
		},
		download(button) {
			const file = view.files[Number(button.dataset.cvFile)];
			const isLink = file.kind === 'code';
			notify({
				tone: 'info',
				icon: isLink ? 'bi-box-arrow-up-right' : 'bi-download',
				title: isLink ? 'Opening the link' : 'Downloading',
				text: file.name,
			});
		},
	};

	function routeClick(event) {
		const button = event.target.closest('[data-cv-act], [data-cv-book]');
		if (!button || !button.closest('[data-cv-root]')) return;
		if (button.hasAttribute('data-cv-book')) {
			openBooking(Number(button.dataset.cvBook));
			return;
		}
		const handler = CLICK_ACTIONS[button.dataset.cvAct];
		if (handler) handler(button);
		/* A mouse click should not leave a focus ring behind; a key press may. */
		if (button.matches('.btn') && event.detail > 0) button.blur();
	}

	/* Stage changes: forward, out and back in. */

	function advanceStage() {
		const before = { stage: view.stage, reached: { ...view.reached }, length: view.history.length };
		const target = PIPELINE[stageAt(view.stage) + 1];
		const isHire = target.key === 'hired';
		view.stage = target.key;
		view.reached[target.key] = TODAY;
		logEvent('move', `moved them to ${target.label}`);
		paintAll();
		notify({
			tone: 'success',
			icon: isHire ? 'bi-person-check' : 'bi-arrow-right-circle',
			title: isHire ? `${wholeName} hired` : `Moved to ${target.label}`,
			text: isHire
				? `${firstNameOf(person.manager)} agrees a start date with ${person.first}.`
				: `${firstNameOf(person.recruiter)} drafts the offer letter next.`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						view.stage = before.stage;
						view.reached = before.reached;
						view.history.length = before.length;
						paintAll();
					},
				},
			],
		});
	}

	function openRejectDialog() {
		pick('[data-cv-reject-name]', ui.rejectDialog).textContent = wholeName;
		pick('[data-cv-reject-sub]', ui.rejectDialog).textContent =
			`${person.role}, at the ${stageLabel(view.stage)} stage.`;
		bootstrap.Modal.getOrCreateInstance(ui.rejectDialog).show();
	}

	function resetRejectDialog() {
		pick('[data-cv-reject-note]', ui.rejectDialog).value = '';
		pick('[data-cv-reject-email]', ui.rejectDialog).checked = true;
	}

	function turnDown() {
		const reasonSelect = pick('[data-cv-reject-reason]', ui.rejectDialog);
		view.out = {
			reason: reasonSelect.options[reasonSelect.selectedIndex].text,
			emailed: pick('[data-cv-reject-email]', ui.rejectDialog).checked,
		};
		logEvent('out', `turned them down: ${view.out.reason.toLowerCase()}`);
		bootstrap.Modal.getOrCreateInstance(ui.rejectDialog).hide();
		paintAll();
		notify({ tone: 'info', icon: 'bi-person-x', title: `${wholeName} turned down`, text: `${view.out.reason}.` });
	}

	function reopenApplication() {
		view.out = null;
		logEvent('back', 'reopened the application');
		paintAll();
		notify({
			tone: 'success',
			icon: 'bi-arrow-counterclockwise',
			title: 'Back in the running',
			text: `${wholeName} is in ${stageLabel(view.stage)} again.`,
		});
	}

	/* The CV card, filled once. */

	function paintResume() {
		slot('cv-summary').textContent = resume.summary;
		slot('jobs').innerHTML = resume.jobs
			.map(
				(job) =>
					`<li class="cv-job"><span class="cv-job-years">${htmlSafe(job.years)}</span><span class="cv-job-text"><span class="cv-job-title">${htmlSafe(job.title)}</span><span class="cv-job-note">${htmlSafe(job.note)}</span></span></li>`,
			)
			.join('');
		slot('skills').innerHTML = resume.skills
			.map((skill) => `<li class="cv-skill${skill.match ? ' cv-skill-match' : ''}">${htmlSafe(skill.name)}</li>`)
			.join('');
		slot('education').textContent = resume.education;
	}

	/* Booking or moving a round in its dialog. */

	/** Recruiter and hiring manager first, then each round's interviewer, once each. */
	function fillInterviewers() {
		const select = ui.bookForm.who;
		const names = new Set([person.recruiter, person.manager, ...view.rounds.map((round) => round.who)]);
		select.innerHTML = [...names]
			.map((name) => `<option value="${htmlSafe(name)}">${htmlSafe(name)}</option>`)
			.join('');
		window.Basalt.select?.refresh?.(select);
	}

	function openBooking(position) {
		view.bookingIndex = position;
		const round = view.rounds[position];
		const form = ui.bookForm;
		const isMove = round.state === 'booked';
		pick('[data-cv-book-title]').textContent = `${isMove ? 'Reschedule' : 'Book'} ${round.name.toLowerCase()}`;
		pick('[data-cv-book-sub]').textContent = `${wholeName}, ${round.mins} minutes on video.`;
		pick('[data-cv-book-go]').textContent = isMove ? 'Move it' : 'Book';
		form.date.value = round.date || '';
		form.time.value = round.time || '';
		chooseOption(form.who, round.who);
		form.invite.checked = true;
		clearErrors(form);
		bootstrap.Modal.getOrCreateInstance(ui.bookDialog).show();
	}

	function confirmBooking(event) {
		event.preventDefault();
		const form = ui.bookForm;
		const dateBad = markField(form.date, !form.date.value || dayGap(TODAY, form.date.value) < 0);
		const timeBad = markField(form.time, !form.time.value);
		if (dateBad || timeBad) {
			(dateBad ? form.date : form.time).focus();
			return;
		}

		const round = view.rounds[view.bookingIndex];
		const wasBooked = round.state === 'booked';
		Object.assign(round, { state: 'booked', date: form.date.value, time: form.time.value, who: form.who.value });
		logEvent('book', `${wasBooked ? 'moved' : 'booked'} ${round.name.toLowerCase()} to ${weekdayDate(round.date)}`);
		bootstrap.Modal.getOrCreateInstance(ui.bookDialog).hide();
		paintAll();
		const invite = form.invite.checked ? ` ${person.first} gets the invite now.` : '';
		notify({
			tone: 'success',
			icon: 'bi-calendar-check',
			title: `${round.name}${wasBooked ? ' moved' : ' booked'}`,
			text: `${relativeWhen(round.date, round.time)} with ${round.who}.${invite}`,
		});
	}

	document.addEventListener('DOMContentLoaded', start);
})();
