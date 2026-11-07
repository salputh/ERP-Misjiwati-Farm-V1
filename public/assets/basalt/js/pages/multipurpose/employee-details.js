/**
 * The staff record page (employee-details.html). It looks up whoever the
 * ?id= parameter names in the shared people roster (data/multipurpose/people.js) and
 * fills every panel on the page: the header, the four summary tiles, job
 * terms and contact details with their inline editors, leave balances and
 * the request still open, recent clock-ins, the current review, papers on
 * file, borrowed equipment and a change log. Papers and equipment come
 * from data/multipurpose/employee-records.js. A real backend would hand over the same
 * record for that id; the rendering below can stay as it is.
 */
(() => {
	'use strict';

	const sheet = pick('[data-emd-root]');
	if (!sheet) return;

	/* The demo is frozen on one calendar day so every figure agrees with
     the other HR pages. Only the local-time tile reads the real clock. */
	const DEMO_DAY = new Date(2026, 9, 9);
	const VIEWER = 'John Armstrong';
	const demoIso = toIso(DEMO_DAY);

	const DAY_FORMATS = {
		long: { day: 'numeric', month: 'short', year: 'numeric' },
		short: { day: 'numeric', month: 'short' },
		weekday: { weekday: 'short', day: 'numeric', month: 'short' },
	};
	const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	/* Choices offered by the two inline editors. */
	const CONTRACTS = ['Full-time', 'Part-time', 'Fixed-term', 'Contract'];
	const WEEKS = ['Mon to Fri, 40 hours', 'Mon to Thu, 32 hours', 'Mon to Wed, 24 hours'];
	const NOTICE_TERMS = ['2 weeks', '1 month', '2 months', '3 months'];
	const KIN = ['Partner', 'Parent', 'Sibling', 'Friend', 'Other'];

	/* Everybody on the page, colleagues included, is a row of the single
     Fieldline roster, so teams, hues and staff numbers match elsewhere. */
	const roster = window.Basalt.data.people;
	const squads = roster.teams.map((team) => ({ id: team.id, name: team.id, tone: team.tone }));
	const colleagues = roster.staff.map((row) => ({
		id: row.staff,
		name: roster.nameOf(row),
		team: row.team,
		role: row.title,
		mgr: row.mgr ? roster.recordWithId(row.mgr).staff : '',
	}));

	/* Whose record this is. An unknown or missing id falls back to Forrest
     Murphy, the one person with something to show in every panel. */
	const requested = roster.find(new URLSearchParams(location.search).get('id') || '');
	const person = requested && roster.staff.includes(requested) ? requested : roster.recordWithId('lm');
	const place = roster.cityOf(person);
	const reach = roster.contactOf(person);
	const rota = roster.shiftOf(person);
	const isLead = person.mgr === 'rc' || !person.mgr;
	const pronoun = person.g === 'she' ? { sub: 'she', obj: 'her', pos: 'her' } : { sub: 'he', obj: 'him', pos: 'his' };
	const standing = standingOf();
	const bossName = person.mgr ? rosterName(person.mgr) : 'Ruth Christensen';

	const profile = {
		id: person.staff,
		first: person.first,
		last: person.last,
		email: roster.emailOf(person),
		role: person.title,
		team: person.team,
		mgr: person.mgr ? roster.recordWithId(person.mgr).staff : '',
		type: person.type,
		pattern: WEEKS[person.type === 'Part-time' ? 2 : 0],
		start: person.start,
		probation: shiftMonths(person.start, 3),
		salary: person.salary,
		notice: noticeFor(),
		phone: reach.phone,
		city: person.city,
		country: place.country,
		tz: place.tz,
		tzName: place.zone,
		hours: [Math.floor(rota.start / 60), Math.floor(rota.end / 60) + 1],
		birthday: `${1978 + (roster.hash(`${person.id}y`) % 22)}-${reach.birthday}`,
		languages: reach.languages,
		sos: reach.sos,
	};

	/* Leave for the calendar year. Each balance counts days already taken
     or approved; the one request nobody has answered lives in `openAsk`. */
	const BALANCES = [
		{ key: 'annual', label: 'Vacation', icon: 'bi-sun', allowance: 25 },
		{ key: 'sick', label: 'Sick days', icon: 'bi-thermometer-half', allowance: 12 },
		{ key: 'study', label: 'Study days', icon: 'bi-mortarboard', allowance: 5 },
	];
	const EXTRA_LEAVE = {
		parental: { label: 'Parental leave', icon: 'bi-balloon-heart' },
		unpaid: { label: 'Unpaid leave', icon: 'bi-hourglass-split' },
		bereavement: { label: 'Bereavement leave', icon: 'bi-flower1' },
	};
	const absences = roster.absences(person);
	for (const balance of BALANCES) {
		balance.used = absences
			.filter((spell) => spell.type === balance.key)
			.reduce((total, spell) => total + spell.days, 0);
	}
	const openRequest = roster.timeOff.find((entry) => entry.who === person.id && entry.status === 'waiting');
	let openAsk = openRequest ? requestFrom(openRequest) : null;
	const bookedDays = absences.map((spell) => ({
		from: spell.from,
		to: spell.to,
		type: spell.type,
		days: spell.days,
		state: spell.to < demoIso ? 'Taken' : 'Approved',
	}));

	/* Ten working days back from the demo day, as the Shifts page has them. */
	const clockDays = collectClockDays();

	/* The H2 2026 review, matching what Performance shows for this person. */
	const SKILLS = ['Execution', 'Expertise', 'Collaboration', 'Customer focus', 'Leadership'];
	const CYCLE_STEPS = [
		['self', 'Self-review'],
		['peer', 'Peer feedback'],
		['manager', 'Manager review'],
		['calibration', 'Calibration'],
		['signed', 'Signed off'],
	];
	const STEP_STATE_WORDS = { done: ', done', now: ', now', '': ', to come' };
	const STAGE_DEADLINES = { self: '2026-09-25', peer: '2026-10-02', manager: '2026-10-16' };
	const appraisal = roster.reviewOf(person);
	const review = appraisal ? reviewFrom(appraisal) : null;
	/* Anyone who joined before this year has a score from the H1 cycle. */
	const priorScore =
		person.start < '2026-01-01' ? Math.round((3.6 + (roster.hash(`${person.id}h1`) % 11) / 10) * 10) / 10 : null;

	/* Papers and borrowed equipment. A tax form still on its way has no
     upload day yet, and anything that lapses carries an expiry day. */
	const paperwork = window.Basalt.data.employeeRecords;
	const papers = paperwork.docsOf(person.id);
	const loans = paperwork.assetsOf(person.id);
	const closet = paperwork.spares.map((spare) => ({ ...spare }));
	const PAPER_LOOK = {
		Contract: { icon: 'bi-file-earmark-text', tone: 1 },
		Letter: { icon: 'bi-award', tone: 2 },
		ID: { icon: 'bi-person-vcard', tone: 5 },
		'Tax form': { icon: 'bi-receipt', tone: 3 },
		Certificate: { icon: 'bi-patch-check', tone: 7 },
		Agreement: { icon: 'bi-pen', tone: 4 },
		Other: { icon: 'bi-file-earmark-arrow-up', tone: 6 },
	};
	const LOAN_ICON = {
		laptop: 'bi-laptop',
		phone: 'bi-phone',
		monitor: 'bi-display',
		badge: 'bi-person-badge',
		car: 'bi-car-front',
	};
	const WEAR_TONE = { New: 'info', Good: 'success', Fair: 'warning', 'Needs repair': 'danger' };
	const WEAR_LEVELS = Object.keys(WEAR_TONE);

	/* The change log, newest entry on top; four show until it is expanded. */
	const changelog = buildChangelog();
	const LOG_PREVIEW = 4;
	let logExpanded = false;

	/* Page furniture the handlers below reach for more than once. */
	const logFoot = pick('[data-emd-more-foot]', sheet);
	const logToggle = pick('[data-emd-more]', sheet);
	const uploader = pick('[data-emd-upload]', sheet);
	const lendDialog = document.getElementById('emd-assign');
	const lendForm = pick('[data-emd-assign-form]', lendDialog);
	const lendItem = pick('[data-emd-assign="item"]', lendDialog);
	const lendWear = pick('[data-emd-assign="condition"]', lendDialog);
	const lendDate = pick('[data-emd-assign="on"]', lendDialog);
	const lendSubmit = pick('button[type="submit"]', lendDialog);
	const jobEditor = pick('[data-emd-form="job"]', sheet);

	/* Inline editors. Each knows how to load its inputs, list the ones that
     are wrong, write the answers back and repaint what they touch. */
	const EDITORS = {
		job: {
			saved: 'Job details saved',
			load(form) {
				inputFor(form, 'role').value = profile.role;
				fillSelect(
					inputFor(form, 'team'),
					squads.map((squad) => [squad.id, squad.name]),
					profile.team,
				);
				fillSelect(inputFor(form, 'mgr'), bossChoices(profile.team), profile.mgr);
				fillSelect(inputFor(form, 'type'), CONTRACTS, profile.type);
				fillSelect(inputFor(form, 'pattern'), WEEKS, profile.pattern);
				fillSelect(inputFor(form, 'notice'), NOTICE_TERMS, profile.notice);
				inputFor(form, 'salary').value = String(profile.salary);
			},
			problems(form) {
				const wrong = [];
				const roleInput = inputFor(form, 'role');
				const pay = inputFor(form, 'salary');
				if (!roleInput.value.trim()) wrong.push(roleInput);
				if (!/^\d{3,7}$/.test(pay.value.replace(/[,\s]/g, ''))) wrong.push(pay);
				return wrong;
			},
			commit(form) {
				const edited = {
					role: inputFor(form, 'role').value.trim(),
					team: inputFor(form, 'team').value,
					mgr: inputFor(form, 'mgr').value,
					type: inputFor(form, 'type').value,
					pattern: inputFor(form, 'pattern').value,
					salary: Number(inputFor(form, 'salary').value.replace(/[,\s]/g, '')),
					notice: inputFor(form, 'notice').value,
				};
				const edits = [];
				if (edited.role !== profile.role) edits.push(['bi-briefcase', `Job title changed to ${edited.role}`]);
				if (edited.team !== profile.team) edits.push(['bi-people', `Moved to ${squadOf(edited.team).name}`]);
				if (edited.mgr !== profile.mgr)
					edits.push(['bi-diagram-2', `Now reports to ${colleague(edited.mgr).name}`]);
				if (edited.type !== profile.type)
					edits.push(['bi-file-earmark-text', `Contract changed to ${edited.type}`]);
				if (edited.pattern !== profile.pattern)
					edits.push(['bi-calendar-week', `Working week changed to ${edited.pattern}`]);
				if (edited.salary !== profile.salary)
					edits.push(['bi-cash-coin', `Salary changed to ${dollars(edited.salary)} a month`]);
				if (edited.notice !== profile.notice)
					edits.push(['bi-hourglass-split', `Notice period changed to ${edited.notice}`]);
				Object.assign(profile, edited);
				return edits;
			},
			repaint() {
				paintHeader();
				paintJob();
			},
		},
		contact: {
			saved: 'Contact details saved',
			load(form) {
				inputFor(form, 'phone').value = profile.phone;
				inputFor(form, 'city').value = profile.city;
				inputFor(form, 'sosName').value = profile.sos.name;
				fillSelect(inputFor(form, 'sosRel'), KIN, profile.sos.rel);
				inputFor(form, 'sosPhone').value = profile.sos.phone;
			},
			problems(form) {
				const dialable = /^\+?[0-9 ()-]{7,24}$/;
				return ['phone', 'city', 'sosName', 'sosPhone']
					.map((key) => inputFor(form, key))
					.filter((input) => {
						const typed = input.value.trim();
						return !typed || (input.type === 'tel' && !dialable.test(typed));
					});
			},
			commit(form) {
				const phone = inputFor(form, 'phone').value.trim();
				const town = inputFor(form, 'city').value.trim();
				const sos = {
					name: inputFor(form, 'sosName').value.trim(),
					rel: inputFor(form, 'sosRel').value,
					phone: inputFor(form, 'sosPhone').value.trim(),
				};
				const was = profile.sos;
				const edits = [];
				if (phone !== profile.phone) edits.push(['bi-telephone', 'Work phone changed']);
				if (town !== profile.city) edits.push(['bi-geo-alt', `Now works from ${town}`]);
				if (sos.name !== was.name || sos.rel !== was.rel || sos.phone !== was.phone) {
					edits.push(['bi-heart-pulse', 'Emergency contact updated']);
				}
				Object.assign(profile, { phone, city: town, sos });
				return edits;
			},
			repaint() {
				paintHeader();
				paintContact();
				paintClock();
			},
		},
	};

	/* Clicks inside the record, matched by the hook they land on. The first
     match handles the click; nothing on the page carries two of these. */
	const CLICK_ROUTES = [
		['[data-emd-decide]', decideFromButton],
		['[data-emd-download]', startDownload],
		['[data-emd-remove]', removePaper],
		['[data-emd-return]', returnLoan],
		[
			'[data-emd-edit], [data-emd-edit-open]',
			(button) => beginEdit(button.dataset.emdEdit || button.dataset.emdEditOpen),
		],
		['[data-emd-cancel]', (button) => endEdit(button.dataset.emdCancel)],
	];

	/**
	 * Wires every control, paints each panel once and keeps the local-time
	 * tile moving with the minute.
	 */
	function start() {
		sheet.addEventListener('click', routeClick);
		uploader.addEventListener('change', addUpload);
		lendDialog.addEventListener('show.bs.modal', prepareLend);
		lendItem.addEventListener('change', () => {
			const spare = closet[Number(lendItem.value)];
			if (spare) fillSelect(lendWear, WEAR_LEVELS, spare.condition);
		});
		lendForm.addEventListener('submit', submitLend);
		logToggle.addEventListener('click', () => {
			window.Basalt.slide(hook('history').closest('.emd-table-wrap'), () => {
				logExpanded = !logExpanded;
				paintLog();
			});
		});
		for (const editSheetForm of pickAll('[data-emd-form]', sheet)) wireEditor(editSheetForm);
		/* Changing the team offers that team's people as the new manager. */
		inputFor(jobEditor, 'team').addEventListener('change', (event) => {
			const choices = bossChoices(event.target.value);
			fillSelect(inputFor(jobEditor, 'mgr'), choices, choices[0][0]);
		});
		pick('[data-emd-copy-link]', sheet).addEventListener('click', copyRecordLink);

		paintHeader();
		paintGlance();
		paintJob();
		paintContact();
		paintLeave();
		paintAttendance();
		paintAppraisal();
		drawReview();
		paintPapers();
		paintLoans();
		paintLog();

		setInterval(paintClock, 60000);
	}

	/* With no request open the decide buttons fall through to later routes. */
	function decideFromButton(button) {
		if (!openAsk) return false;
		settleRequest(button.dataset.emdDecide);
		return true;
	}

	function routeClick(event) {
		for (const [selector, handle] of CLICK_ROUTES) {
			const hit = event.target.closest(selector);
			if (hit && handle(hit) !== false) return;
		}
	}

	/* The helpers below turn roster rows into the shapes the panels draw. */

	function standingOf() {
		if (person.lastDay) return { key: 'leaving', label: 'Leaving', tone: 'danger' };
		if (person.start > demoIso) return { key: 'starting', label: `Starts ${dayText(person.start)}`, tone: 'info' };
		if (roster.awayOn(person, demoIso)) return { key: 'away', label: 'Away', tone: 'warning' };
		if (dayGap(parseDay(person.start), DEMO_DAY) < 56)
			return { key: 'onboarding', label: 'Onboarding', tone: 'info' };
		return { key: 'active', label: 'Active', tone: 'success' };
	}

	/* Under six months in, notice is two weeks; after that it grows with
     seniority, and team leads owe the longest. */
	function noticeFor() {
		if (dayGap(parseDay(person.start), DEMO_DAY) < 183) return '2 weeks';
		if (isLead) return '3 months';
		return /senior|manager|lead/i.test(person.title) ? '2 months' : '1 month';
	}

	function requestFrom(entry) {
		return {
			id: entry.id,
			type: entry.type,
			from: entry.from,
			to: entry.to,
			days: roster.workdays(entry.from, entry.to),
			sent: entry.sent,
			cover: entry.cover ? roster.recordWithId(entry.cover).staff : '',
			reason: entry.reason,
		};
	}

	function collectClockDays() {
		const found = [];
		const cursor = new Date(DEMO_DAY);
		while (found.length < 10) {
			cursor.setDate(cursor.getDate() - 1);
			const iso = toIso(cursor);
			if (iso < person.start) break;
			const weekday = cursor.getDay();
			if (weekday === 0 || weekday === 6) continue;
			const punch = roster.workday(person, iso);
			found.unshift(
				punch.kind === 'in'
					? {
							day: iso,
							inAt: punch.inAt,
							outAt: punch.outAt,
							hours: Math.round((punch.outAt - punch.inAt) / 6) / 10,
						}
					: { day: iso, away: punch.reason },
			);
		}
		return found;
	}

	function reviewFrom(source) {
		const reached = CYCLE_STEPS.findIndex(([key]) => key === source.stage);
		const finished = source.stage === 'signed';
		return {
			cycle: 'H2 2026',
			by: person.mgr ? roster.recordWithId(person.mgr).staff : '',
			rating: source.rating || null,
			promote: Boolean(source.promote),
			session: finished ? source.signed : roster.teamOf(person.team).session,
			stage: source.stage,
			due: source.due || STAGE_DEADLINES[source.stage],
			stages: CYCLE_STEPS.map(([, label], step) => {
				if (step < reached || finished) return [label, 'done'];
				return [label, step === reached ? 'now' : ''];
			}),
			scores: source.scores ? SKILLS.map((skill, n) => [skill, source.scores[n]]) : [],
			goals: source.goals,
			said: source.said
				? [
						['Strength', source.said[0]],
						['To work on', source.said[1]],
					]
				: [],
			owes: roster.reviews
				.filter(
					(entry) =>
						roster.recordWithId(entry.who).mgr === person.id &&
						['self', 'peer', 'manager'].includes(entry.stage),
				)
				.map((entry) => roster.recordWithId(entry.who).first),
		};
	}

	function cycleExcuse() {
		if (person.id === 'rc') return 'The board reviews the chief executive once a year, in January.';
		if (person.lastDay) return `Not in the H2 2026 cycle: ${pronoun.pos} last day is ${dayText(person.lastDay)}.`;
		if (roster.awayOn(person, demoIso)?.type === 'parental') {
			return `Not in the H2 2026 cycle while on parental leave. ${upperFirst(pronoun.sub)} joins the H1 2027 cycle.`;
		}
		return `Joined after July 1, so ${pronoun.pos} first review is in the H1 2027 cycle.`;
	}

	/**
	 * Gathers every dated change the roster knows about for this person.
	 * Entries go in a fixed order before the sort so same-day changes keep
	 * a stable sequence.
	 */
	function buildChangelog() {
		const logRows = [];
		function add(when, icon, text, by) {
			logRows.push({ when, icon, text, by });
		}
		if (person.lastDay)
			add('2026-09-25', 'bi-box-arrow-right', `Resigned, last day ${dayText(person.lastDay)}`, VIEWER);
		if (openRequest) {
			add(
				openRequest.sent,
				'bi-calendar-plus',
				`Asked for ${spanLabel(openRequest.from, openRequest.to)} off`,
				wholeName(profile),
			);
		}
		if (appraisal?.rating) {
			const signed = appraisal.stage === 'signed';
			add(
				signed ? appraisal.signed : '2026-10-07',
				'bi-star',
				`${signed ? 'Review signed off' : 'Review moved to calibration'} with a ${appraisal.rating.toFixed(1)} rating`,
				bossName,
			);
		}
		for (const entry of roster.timeOff) {
			if (entry.who !== person.id || entry.status === 'waiting' || !entry.decided) continue;
			const approved = entry.status === 'approved';
			add(
				entry.decided.on,
				approved ? 'bi-calendar-check' : 'bi-calendar-x',
				`${approved ? 'Approved' : 'Declined'} ${spanLabel(entry.from, entry.to)} off`,
				rosterName(entry.decided.by),
			);
		}
		if (person.was) {
			const monthPart = String(person.was.until + 1).padStart(2, '0');
			add(
				`2026-${monthPart}-01`,
				'bi-cash-coin',
				`Salary changed to ${dollars(person.salary)} a month`,
				bossName,
			);
		}
		if (profile.probation < demoIso) add(profile.probation, 'bi-patch-check', 'Passed probation', bossName);
		add(
			person.start,
			'bi-door-open',
			`${person.start > demoIso ? 'Starts' : 'Joined'} as ${person.title}`,
			person.start < '2021-03-08' ? 'Ruth Christensen' : VIEWER,
		);
		return logRows.sort((a, b) => b.when.localeCompare(a.when));
	}

	/* The header and the four summary tiles are painted from `profile`. */

	function paintHeader() {
		const squad = squadOf(profile.team);
		const displayName = wholeName(profile);
		const portrait = hook('avatar');
		portrait.className = `basalt-avatar basalt-avatar-xl emd-avatar basalt-avatar-tone-${squad.tone}`;
		portrait.textContent = monogram(displayName);
		hook('name').textContent = displayName;
		hook('sub').textContent = `${profile.role} · ${squad.name} · ${profile.city}, ${profile.country}`;
		hook('mail').href = `mailto:${profile.email}`;
		hook('call').href = `voice-call.html?id=${encodeURIComponent(person.id)}`;
		hook('tags').innerHTML = [
			`<span class="basalt-status basalt-status-dot basalt-status-${standing.tone}">${htmlSafe(standing.label)}</span>`,
			`<span class="emd-pill emd-tone-${squad.tone}">${htmlSafe(squad.name)}</span>`,
			`<span class="emd-pill emd-pill-plain">${htmlSafe(profile.type)}</span>`,
			`<span class="emd-pill emd-pill-plain emd-mono">${htmlSafe(profile.id)}</span>`,
		].join('');
		document.title = `${displayName} · Basalt`;
		for (const word of pickAll('[data-emd-pron]', sheet)) word.textContent = pronoun[word.dataset.emdPron];
	}

	function paintGlance() {
		paintClock();
		paintBalanceTile();
		paintScoreTile();
		paintTenureTile();
	}

	function paintClock() {
		const now = localMoment();
		if (!now) {
			hook('time').textContent = '—';
			hook('hours').innerHTML = '';
			return;
		}
		const [opens, closes] = profile.hours;
		let mood = 'After hours';
		if (now.working) mood = 'Working hours';
		else if (now.weekend) mood = 'Weekend';
		hook('time').textContent = now.time;
		hook('time-note').textContent = `${mood} in ${profile.city}`;
		/* Twenty-four slots for the day: shift hours are filled in, and the
       current hour stands taller than the rest. */
		let strip = '';
		for (let hour = 0; hour < 24; hour += 1) {
			const lit = hour >= opens && hour < closes && !now.weekend ? ' is-work' : '';
			const nowMark = hour === now.hour ? ' is-now' : '';
			strip += `<span class="emd-hour${lit}${nowMark}"></span>`;
		}
		hook('hours').innerHTML = strip;
	}

	function paintBalanceTile() {
		const vacation = leaveKind('annual');
		const awaiting = openAsk?.type === 'annual' ? openAsk.days : 0;
		hook('left').textContent = tally(vacation.allowance - vacation.used, 'day');
		hook('left-note').textContent =
			`of ${vacation.allowance}${awaiting ? ` · ${awaiting} waiting for you` : ' this year'}`;
		/* The donut reads clockwise: days gone, days asked for, then the rest. */
		const loop = 2 * Math.PI * 16;
		const gone = (vacation.used / vacation.allowance) * loop;
		const asked = (awaiting / vacation.allowance) * loop;
		function circleTag(part, length, offset = '') {
			const dash = length === undefined ? '' : ` stroke-dasharray="${length.toFixed(2)} ${loop.toFixed(2)}"`;
			return `<circle cx="20" cy="20" r="16" class="emd-ring-${part}"${dash}${offset}/>`;
		}
		const askArc = asked ? circleTag('ask', asked, ` stroke-dashoffset="${(-gone).toFixed(2)}"`) : '';
		hook('ring').innerHTML =
			`<svg viewBox="0 0 40 40" focusable="false">${circleTag('track')}${circleTag('used', gone)}${askArc}</svg>`;
	}

	function paintScoreTile() {
		const rated = review?.rating || priorScore;
		if (rated) {
			hook('rating').innerHTML = `${rated.toFixed(1)} <span class="emd-glance-of">out of 5</span>`;
			let note = 'H1 2026 review';
			if (review?.rating) note = review.promote ? 'Put forward for promotion' : `${review.cycle} review`;
			hook('rating-note').textContent = note;
		} else {
			hook('rating').textContent = 'Not yet';
			hook('rating-note').textContent = 'First review in H1 2027';
		}
		const pips = [];
		for (let pip = 0; pip < 5; pip += 1) {
			const share = Math.min(1, Math.max(0, (rated || 0) - pip));
			pips.push(
				`<span class="emd-pip"><span class="emd-pip-fill" style="width:${Math.round(share * 100)}%"></span></span>`,
			);
		}
		hook('pips').innerHTML = pips.join('');
	}

	function paintTenureTile() {
		const hired = parseDay(profile.start);
		if (profile.start > demoIso) {
			hook('service').textContent = `Starts ${dayText(profile.start)}`;
			hook('service-note').textContent = `In ${tally(dayGap(DEMO_DAY, hired), 'day')}`;
			hook('service-meter').style.width = '0%';
			return;
		}
		const { years, months } = tenure();
		hook('service').textContent = tenureLabel(years, months, hired);
		const lastMark = new Date(hired.getFullYear() + years, hired.getMonth(), hired.getDate());
		const nextMark = new Date(hired.getFullYear() + years + 1, hired.getMonth(), hired.getDate());
		const markDay = nextMark.toLocaleDateString('en-US', DAY_FORMATS.short);
		hook('service-note').textContent =
			`${tally(years + 1, 'year')} on ${markDay}, in ${tally(dayGap(DEMO_DAY, nextMark), 'day')}`;
		hook('service-meter').style.width =
			`${Math.round((dayGap(lastMark, DEMO_DAY) / dayGap(lastMark, nextMark)) * 100)}%`;
	}

	function tenureLabel(years, months, hired) {
		if (!years) return months ? tally(months, 'month') : tally(dayGap(hired, DEMO_DAY), 'day');
		return months ? `${tally(years, 'year')}, ${tally(months, 'month')}` : tally(years, 'year');
	}

	/* Whole years and leftover months between the start date and the demo day. */
	function tenure() {
		const hired = parseDay(profile.start);
		let months = (DEMO_DAY.getFullYear() - hired.getFullYear()) * 12 + DEMO_DAY.getMonth() - hired.getMonth();
		if (DEMO_DAY.getDate() < hired.getDate()) months -= 1;
		return { years: Math.floor(months / 12), months: months % 12 };
	}

	/**
	 * Reads the wall clock in the person's own time zone.
	 * @returns {{time: string, hour: number, working: boolean, weekend: boolean} | null}
	 *   null when the browser cannot resolve the zone.
	 */
	function localMoment() {
		try {
			const bits = Object.fromEntries(
				new Intl.DateTimeFormat('en-US', {
					timeZone: profile.tz,
					hour: '2-digit',
					minute: '2-digit',
					weekday: 'short',
					hourCycle: 'h23',
				})
					.formatToParts(new Date())
					.map(({ type, value }) => [type, value]),
			);
			const hour = Number(bits.hour);
			const restDay = bits.weekday === 'Sat' || bits.weekday === 'Sun';
			const [opens, closes] = profile.hours;
			return {
				time: clockLabel(`${hour}:${bits.minute}`),
				hour,
				working: !restDay && hour >= opens && hour < closes,
				weekend: restDay,
			};
		} catch {
			return null;
		}
	}

	/* Job terms and contact details are plain definition lists. */

	function paintJob() {
		const squad = squadOf(profile.team);
		const boss = colleague(profile.mgr);
		const crew = colleagues.filter((member) => member.mgr === profile.id);
		const ownCard = `<span class="emd-person emd-person-self emd-tone-${squad.tone}">${personCard(wholeName(profile), squad.tone, profile.role)}</span>`;
		const chainItems = [];
		if (boss) chainItems.push(chainStep('', 'Reports to', personLink(boss)));
		chainItems.push(chainStep(' emd-chain-step-self', htmlSafe(profile.first), ownCard));
		if (crew.length) {
			/* Six faces at most; the remainder is a single line pointing onward. */
			const firstSix = crew.slice(0, 6);
			const extra = crew.length - firstSix.length;
			const overflow = extra
				? `<p class="emd-quiet emd-team-more">and ${tally(extra, 'more person', 'more people')} on <a class="emd-link" href="employees.html">Employees</a></p>`
				: '';
			const heading = `${upperFirst(pronoun.pos)} team · ${tally(crew.length, 'person', 'people')}`;
			chainItems.push(
				chainStep(
					'',
					heading,
					`<ul class="emd-team">${firstSix.map((member) => `<li>${personLink(member)}</li>`).join('')}</ul>${overflow}`,
				),
			);
		}
		hook('chain').innerHTML = chainItems.join('');

		const confirmed = profile.probation < demoIso;
		hook('job-facts').innerHTML = factList([
			['Contract', htmlSafe(profile.type)],
			['Working week', htmlSafe(profile.pattern)],
			[profile.start > demoIso ? 'Starts' : 'Started', htmlSafe(longDay(profile.start))],
			confirmed
				? ['Probation', 'Passed', htmlSafe(longDay(profile.probation))]
				: [
						'Probation',
						`Until ${htmlSafe(longDay(profile.probation))}`,
						`Check-ins with ${htmlSafe(bossName)}`,
					],
			['Monthly salary', htmlSafe(dollars(profile.salary))],
			['Notice period', htmlSafe(profile.notice)],
		]);
	}

	function chainStep(modifier, heading, body) {
		return `<li class="emd-chain-step${modifier}"><span class="emd-chain-label">${heading}</span>${body}</li>`;
	}

	function personLink(member) {
		return `<a href="${recordHref(member.id)}" class="emd-person">${personCard(member.name, squadOf(member.team).tone, member.role)}</a>`;
	}

	function personCard(name, tone, role) {
		return `${avatarChip(name, tone, 'sm')}<span class="emd-person-text"><span class="emd-person-name">${htmlSafe(name)}</span><span class="emd-person-role">${htmlSafe(role)}</span></span>`;
	}

	function paintContact() {
		const birthday = parseDay(profile.birthday).toLocaleDateString('en-US', { day: 'numeric', month: 'long' });
		const facts = hook('contact-facts');
		facts.innerHTML = factList([
			[
				'Email',
				copyLine(
					`<a class="emd-link" href="mailto:${htmlSafe(profile.email)}">${htmlSafe(profile.email)}</a>`,
					profile.email,
					'email',
				),
			],
			['Phone', copyLine(dialLink(profile.phone), profile.phone, 'phone number')],
			['Works from', `${htmlSafe(profile.city)}, ${htmlSafe(profile.country)}`],
			[
				'Working hours',
				`${clockLabel(profile.hours[0])} to ${clockLabel(profile.hours[1])}`,
				htmlSafe(profile.tzName),
			],
			['Languages', htmlSafe(profile.languages.join(', '))],
			['Birthday', htmlSafe(birthday)],
		]);
		hook('sos-facts').innerHTML = factList([
			['Name', htmlSafe(profile.sos.name), htmlSafe(profile.sos.rel)],
			['Phone', dialLink(profile.sos.phone)],
		]);
		window.Basalt.buttons?.(facts);
		window.Basalt.tips?.(facts);
	}

	function copyLine(content, value, what) {
		const button = `<button type="button" class="btn btn-icon emd-copy" aria-label="Copy ${what}" data-basalt-copy="${htmlSafe(value)}" data-basalt-copy-done="Copied" data-bs-toggle="tooltip" data-bs-title="Copy ${what}"><i class="bi bi-copy" aria-hidden="true"></i></button>`;
		return `<span class="emd-copyline">${content}${button}</span>`;
	}

	function dialLink(number) {
		return `<a class="emd-link" href="tel:${htmlSafe(number.replace(/[^+0-9]/g, ''))}">${htmlSafe(number)}</a>`;
	}

	/* The leave panel holds the open request, the balances and the bookings. */

	function paintLeave() {
		const vacation = leaveKind('annual');
		hook('off-desc').textContent =
			profile.start > demoIso
				? `${vacation.allowance} days of vacation a year, counted from ${pronoun.pos} first day.`
				: `${vacation.allowance} days of vacation a year, January to December.`;

		const askBox = hook('ask');
		askBox.hidden = !openAsk;
		askBox.innerHTML = openAsk ? requestCard(openAsk) : '';
		hook('key-ask').hidden = !openAsk;

		hook('allow').innerHTML = BALANCES.map(balanceRow).join('');
		hook('booked').innerHTML = bookedDays.length
			? bookedDays.map(bookedRow).join('')
			: '<tr><td colspan="4" class="emd-quiet">Nothing booked this year yet.</td></tr>';
	}

	function requestCard(request) {
		const stand = request.cover ? colleague(request.cover) : null;
		const opening = parseDay(request.from);
		const details = [tally(request.days, 'working day')];
		if (stand) details.push(`${htmlSafe(stand.name)} covers`);
		details.push(`asked ${htmlSafe(dayText(request.sent))}`);
		const calendar = `<span class="emd-ask-cal" aria-hidden="true"><span>${htmlSafe(opening.toLocaleDateString('en-US', { month: 'short' }))}</span>${opening.getDate()}</span>`;
		const copyBlock = `<div class="emd-ask-text"><h3 class="emd-ask-title">${htmlSafe(leaveKind(request.type).label)}, ${htmlSafe(spanLabel(request.from, request.to))}</h3><p class="emd-ask-line">${details.join(' · ')}</p><p class="emd-ask-reason">${htmlSafe(request.reason)}</p></div>`;
		const buttons =
			'<div class="emd-ask-acts">' +
			'<button type="button" class="btn btn-primary btn-sm" data-emd-decide="approve"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Approve</button>' +
			'<button type="button" class="btn btn-outline-secondary btn-sm" data-emd-decide="decline">Decline</button>' +
			'</div>';
		return `<div class="emd-ask-when">${calendar}${copyBlock}</div>${buttons}`;
	}

	function balanceRow(balance) {
		const awaiting = openAsk?.type === balance.key ? openAsk.days : 0;
		function width(days) {
			return (days / balance.allowance) * 100;
		}
		const askBar = awaiting ? `<span class="emd-allow-ask" style="width:${width(awaiting)}%"></span>` : '';
		const spoken = `, ${balance.used} taken or booked${awaiting ? `, ${awaiting} waiting for a decision` : ''}`;
		return (
			'<li class="emd-allow-row">' +
			`<span class="emd-allow-name"><i class="bi ${balance.icon}" aria-hidden="true"></i>${htmlSafe(balance.label)}</span>` +
			`<span class="emd-allow-bar" aria-hidden="true"><span class="emd-allow-used" style="width:${width(balance.used)}%"></span>${askBar}</span>` +
			`<span class="emd-allow-value"><strong>${balance.allowance - balance.used} left</strong> of ${balance.allowance}<span class="visually-hidden">${spoken}</span></span>` +
			'</li>'
		);
	}

	function bookedRow(booking) {
		const leave = leaveKind(booking.type);
		const tone = booking.state === 'Approved' ? 'info' : 'success';
		return (
			`<tr${freshClass(booking)}>` +
			`<td>${htmlSafe(spanLabel(booking.from, booking.to))}<span class="emd-type-sub">${htmlSafe(leave.label)}</span></td>` +
			`<td class="emd-col-wide emd-col-type"><span class="emd-type"><i class="bi ${leave.icon}" aria-hidden="true"></i>${htmlSafe(leave.label)}</span></td>` +
			`<td><span class="basalt-status basalt-status-dot basalt-status-${tone}">${htmlSafe(booking.state)}</span></td>` +
			`<td class="emd-col-num">${booking.days}</td>` +
			'</tr>'
		);
	}

	/**
	 * Approves or declines the open request, logs it and offers an undo
	 * that puts the request back exactly as it was.
	 * @param {'approve'|'decline'} verdict
	 */
	function settleRequest(verdict) {
		const request = openAsk;
		const approved = verdict === 'approve';
		const bucket = leaveKind(request.type);
		const dates = spanLabel(request.from, request.to);
		const booking = {
			from: request.from,
			to: request.to,
			type: request.type,
			days: request.days,
			state: 'Approved',
			fresh: true,
		};
		openAsk = null;
		if (approved) {
			bucket.used += request.days;
			bookedDays.unshift(booking);
		}
		logChange(
			approved ? 'bi-calendar-check' : 'bi-calendar-x',
			`${approved ? 'Approved' : 'Declined'} ${dates} off`,
		);
		paintLeave();
		paintGlance();
		pick('#emd-off-title').focus();

		const outcome = approved
			? `${profile.first} is off ${dates}.${request.cover ? ` ${colleague(request.cover).name} covers.` : ''}`
			: `${profile.first} gets an email saying the dates don't work.`;
		say(outcome);
		notify({
			tone: approved ? 'success' : 'info',
			title: approved ? 'Time off approved' : 'Time off declined',
			text: outcome,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						if (approved) {
							bucket.used -= request.days;
							bookedDays.splice(bookedDays.indexOf(booking), 1);
						}
						changelog.shift();
						openAsk = request;
						paintLeave();
						paintGlance();
						paintLog();
						say('Request is waiting again.');
					},
				},
			],
		});
	}

	/* Attendance is two figures over a ten-column bar chart. */

	function paintAttendance() {
		const worked = clockDays.filter((day) => !day.away);
		const figures = hook('att-figs');
		const chart = hook('att-bars');
		const note = hook('att-note');
		if (!worked.length) {
			figures.innerHTML = '';
			chart.hidden = true;
			pick('.emd-key', chart.closest('figure')).hidden = true;
			note.textContent =
				profile.start > demoIso
					? `Starts ${dayText(profile.start)}. ${upperFirst(pronoun.pos)} days on the time clock show here from then.`
					: 'Away for all of the last ten working days.';
			hook('att-caption').textContent = note.textContent.trim();
			return;
		}

		const meanHours = worked.reduce((sum, day) => sum + day.hours, 0) / worked.length;
		const meanStart = Math.round(worked.reduce((sum, day) => sum + day.inAt, 0) / worked.length);
		figures.innerHTML =
			`<div class="emd-fig"><dt>Average day</dt><dd>${durationLabel(meanHours)}</dd></div>` +
			`<div class="emd-fig"><dt>Usual start</dt><dd>${minutesLabel(meanStart)}</dd></div>`;
		chart.innerHTML = clockDays.map(dayBar).join('');

		/* Clocking in more than fifteen minutes after the shift opens is late. */
		const lateDays = worked.filter((day) => day.inAt > rota.start + 15);
		const awayCount = clockDays.length - worked.length;
		const lateText = lateDays.length
			? `${tally(lateDays.length, 'late start')}: ${lateDays.map((day) => `${minutesLabel(day.inAt)} on ${dayText(day.day)}`).join(', ')}.`
			: 'No late starts.';
		note.textContent = lateText + (awayCount ? ` ${tally(awayCount, 'day')} away.` : '');
		hook('att-caption').textContent =
			`Hours worked each day from ${dayText(clockDays[0].day)} to ${dayText(clockDays.at(-1).day)}. Average ${durationLabel(meanHours)}.`;
		window.Basalt.tips?.(chart);
	}

	/* Bars are scaled against a ten-hour day; an away day fills its column. */
	function dayBar(day) {
		const stamp = parseDay(day.day);
		const tip = day.away
			? `${dayText(day.day, 'weekday')}: ${day.away}`
			: `${dayText(day.day, 'weekday')}: ${minutesLabel(day.inAt)} to ${minutesLabel(day.outAt)}, ${durationLabel(day.hours)}`;
		let modifier = '';
		if (day.away) modifier = ' is-holiday';
		else if (day.hours > 9) modifier = ' is-long';
		const fillPct = day.away ? 100 : (day.hours / 10) * 100;
		const weekday = stamp.toLocaleDateString('en-US', { weekday: 'narrow' });
		return (
			`<span class="emd-bar${modifier}" role="img" tabindex="0" aria-label="${htmlSafe(tip)}" data-bs-toggle="tooltip" data-bs-title="${htmlSafe(tip)}">` +
			`<span class="emd-bar-col"><span class="emd-bar-fill" style="height:${fillPct.toFixed(1)}%"></span></span>` +
			`<span class="emd-bar-day" aria-hidden="true">${weekday}<span class="emd-bar-date">${stamp.getDate()}</span></span>` +
			'</span>'
		);
	}

	/* The review panel follows the cycle from self-review to sign-off. */

	function paintAppraisal() {
		const owed = hook('owes');
		if (!review) {
			const excuse = htmlSafe(cycleExcuse());
			hook('review-desc').textContent = 'The H2 2026 cycle runs from Sep 14 to Oct 30.';
			hook('review-body').innerHTML = window.Basalt?.emptyState
				? window.Basalt.emptyState({ icon: 'star', title: 'Not in this cycle', text: excuse })
				: `<p class="emd-quiet">${excuse}</p>`;
			owed.hidden = true;
			return;
		}

		const reviewer = colleague(review.by);
		const when =
			review.stage === 'signed'
				? `Signed off on ${dayText(review.session)}.`
				: `${profile.team} calibrates on ${dayText(review.session)}.`;
		hook('review-desc').textContent = `${review.cycle} review with ${reviewer.name}. ${when}`;
		hook('steps').innerHTML = review.stages.map(stageItem).join('');

		const ranked = [...review.scores].sort((a, b) => b[1] - a[1]);
		hook('scores').innerHTML = ranked.length
			? ranked
					.map(
						([skill, rated]) =>
							'<li class="emd-score">' +
							`<span class="emd-score-name">${htmlSafe(skill)}</span>` +
							`<span class="emd-score-bar" aria-hidden="true"><span style="width:${((rated / 5) * 100).toFixed(0)}%"></span></span>` +
							`<span class="emd-score-value">${rated.toFixed(1)}</span></li>`,
					)
					.join('')
			: `<li class="emd-quiet">Scores arrive with the manager review, due ${htmlSafe(dayText(STAGE_DEADLINES.manager))}.</li>`;

		hook('goals').innerHTML = review.goals.map(goalItem).join('');

		hook('said').innerHTML = review.said.length
			? review.said
					.map(
						([kind, words], n) =>
							`<li class="emd-quote emd-tone-${n ? 5 : 3}"><span class="emd-quote-kind">${htmlSafe(kind)}</span><q>${htmlSafe(words)}</q></li>`,
					)
					.join('')
			: `<li class="emd-quiet">${peerProgress()}</li>`;

		const reports = review.owes;
		owed.hidden = !reports.length;
		if (!reports.length) owed.textContent = '';
		else if (reports.length > 3)
			owed.textContent = `${upperFirst(pronoun.sub)} has ${reports.length} reviews to write for ${pronoun.pos} team, due ${dayText(STAGE_DEADLINES.manager)}.`;
		else
			owed.textContent = `${upperFirst(pronoun.sub)} is writing reviews for ${joinNames(reports)}, due ${dayText(STAGE_DEADLINES.manager)}.`;
	}

	/**
	 * The first time the review is on screen, the lines between finished
	 * stages draw in one after another, then the score and goal bars grow.
	 */
	function drawReview() {
		const parts = [hook('steps'), pick('.emd-review', sheet)];
		const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!parts.every(Boolean) || still || !window.IntersectionObserver) return;
		for (const list of [parts[0], hook('scores'), hook('goals')]) {
			[...list.children].forEach((item, at) => item.style.setProperty('--emd-at', at));
		}
		for (const part of parts) part.classList.add('is-waiting');
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				for (const part of parts) {
					part.classList.replace('is-waiting', 'is-drawing');
					const runs = part.getAnimations({ subtree: true }).map((run) => run.finished);
					Promise.allSettled(runs).then(() => part.classList.remove('is-drawing'));
				}
			},
			{ threshold: 0.5 },
		);
		watch.observe(parts[0]);
	}

	function peerProgress() {
		const [asked, answered] = appraisal.peers;
		if (answered < asked)
			return `Peer feedback is still coming in: ${answered} of ${asked} colleagues have answered.`;
		return 'Peer feedback opens after the self-review.';
	}

	function stageItem([label, state], step) {
		const mark = state === 'done' ? '<i class="bi bi-check-lg"></i>' : step + 1;
		const modifier = `${state === 'done' ? ' is-done' : ''}${state === 'now' ? ' is-now' : ''}`;
		return (
			`<li class="emd-step${modifier}"${state === 'now' ? ' aria-current="step"' : ''}>` +
			`<span class="emd-step-mark" aria-hidden="true">${mark}</span>` +
			`<span class="emd-step-label">${htmlSafe(label)}<span class="visually-hidden">${STEP_STATE_WORDS[state]}</span></span></li>`
		);
	}

	function goalItem([goal, percent]) {
		const met = percent >= 100;
		const figure = met ? '<i class="bi bi-check-circle-fill me-1" aria-hidden="true"></i>Done' : `${percent}%`;
		return (
			`<li class="emd-goal${met ? ' is-done' : ''}">` +
			`<span class="emd-goal-name">${htmlSafe(goal)}</span>` +
			`<span class="emd-goal-value">${figure}</span>` +
			`<span class="emd-goal-bar" aria-hidden="true"><span style="width:${Math.min(100, percent)}%"></span></span></li>`
		);
	}

	/* "Ann", "Ann and Ben", "Ann, Ben and Cy". */
	function joinNames(names) {
		if (names.length < 2) return names.join('');
		return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
	}

	/* One line per paper: its name, then type and upload day, and a status
     pill when it has an expiry date, colored by how soon that is. */
	function paintPapers() {
		const docList = hook('docs');
		docList.innerHTML = papers.length
			? papers.map(paperItem).join('')
			: '<li class="emd-quiet">No documents on file yet.</li>';
		window.Basalt.tips?.(docList);
	}

	function paperItem(doc, index) {
		const look = PAPER_LOOK[doc.type] || PAPER_LOOK.Other;
		/* The upload day is kept on one line however the row wraps. */
		const when = doc.uploaded
			? `<span class="emd-nowrap"><span class="emd-doc-verb">uploaded </span>${htmlSafe(longDay(doc.uploaded))}</span>`
			: `waiting for ${pronoun.pos} tax ID`;
		const expiry = doc.expires ? `<span class="emd-doc-state">${expiryPill(doc.expires)}</span>` : '';
		const download = doc.uploaded
			? iconButton(`data-emd-download="${index}"`, 'Download', `Download ${htmlSafe(doc.name)}`, 'bi-download')
			: '';
		const trashButton = iconButton(
			`data-emd-remove="${index}"`,
			'Remove',
			`Remove ${htmlSafe(doc.name)}`,
			'bi-trash3',
		);
		return (
			`<li class="emd-doc${doc.fresh ? ' is-fresh' : ''}">` +
			`<span class="emd-doc-icon emd-tone-${look.tone}" aria-hidden="true"><i class="bi ${look.icon}"></i></span>` +
			`<span class="emd-doc-text"><span class="emd-doc-name">${htmlSafe(doc.name)}</span><span class="emd-doc-meta">${htmlSafe(doc.type)} · ${when}</span>${expiry}</span>` +
			`<span class="emd-doc-acts">${download}${trashButton}</span></li>`
		);
	}

	function expiryPill(iso) {
		const left = dayGap(DEMO_DAY, parseDay(iso));
		let tone = 'success';
		if (left < 0) tone = 'danger';
		else if (left < 180) tone = 'warning';
		return `<span class="basalt-status basalt-status-dot basalt-status-${tone}">${left < 0 ? 'Expired' : 'Expires'} ${htmlSafe(longDay(iso))}</span>`;
	}

	function iconButton(dataAttr, tip, label, icon) {
		return `<button type="button" class="btn btn-icon emd-icon-btn" aria-label="${label}" ${dataAttr} data-bs-toggle="tooltip" data-bs-title="${tip}"><i class="bi ${icon}" aria-hidden="true"></i></button>`;
	}

	function startDownload(button) {
		const doc = papers[Number(button.dataset.emdDownload)];
		notify({ tone: 'success', title: 'Download started', text: `${doc.name} is on its way to your downloads.` });
	}

	function removePaper(button) {
		const index = Number(button.dataset.emdRemove);
		const doc = papers[index];
		disposeTip(button);
		papers.splice(index, 1);
		clearFresh(papers);
		paintPapers();
		const entry = logChange('bi-file-earmark-minus', `Removed ${doc.name} from ${pronoun.pos} documents`);
		pick('#emd-docs-title').focus();
		say(`${doc.name} removed.`);
		notify({
			tone: 'info',
			title: 'Document removed',
			text: `${doc.name} is no longer on ${profile.first}'s record.`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						if (papers.includes(doc)) return;
						papers.splice(Math.min(index, papers.length), 0, doc);
						forgetChange(entry);
						paintPapers();
						paintLog();
						say(`${doc.name} is back.`);
					},
				},
			],
		});
	}

	function addUpload() {
		const picked = uploader.files?.[0];
		if (!picked) return;
		clearFresh(papers);
		const doc = {
			name: picked.name.replace(/\.[^.]+$/, '').slice(0, 40),
			type: 'Other',
			uploaded: demoIso,
			fresh: true,
		};
		papers.unshift(doc);
		uploader.value = '';
		paintPapers();
		logChange('bi-file-earmark-arrow-up', `Added ${doc.name} to ${pronoun.pos} documents`);
		say(`${doc.name} added.`);
		notify({ tone: 'success', title: 'File added', text: `${doc.name} is on ${profile.first}'s record.` });
	}

	/* Each loan shows item, serial, hand-over day and condition. Returning
     sends it to the IT closet, and the dialog lends from that closet. */
	function paintLoans() {
		const tbody = hook('kit');
		tbody.innerHTML = loans.length
			? loans.map(loanRow).join('')
			: '<tr><td colspan="5" class="emd-quiet">Nothing on loan right now.</td></tr>';
		window.Basalt.tips?.(tbody);
	}

	function loanRow(loan, index) {
		const serial = htmlSafe(loan.serial);
		const handedOn = htmlSafe(longDay(loan.issued));
		const giveBack = iconButton(
			`data-emd-return="${index}"`,
			'Mark as returned',
			`Mark ${htmlSafe(loan.item)} as returned`,
			'bi-arrow-return-left',
		);
		return (
			`<tr${freshClass(loan)}>` +
			`<td class="emd-col-wide"><span class="emd-type"><i class="bi ${LOAN_ICON[loan.kind] || 'bi-box'}" aria-hidden="true"></i>${htmlSafe(loan.item)}</span>` +
			`<span class="emd-kit-sub"><span class="emd-mono">${serial}</span><span class="emd-kit-sub-on"> · ${handedOn}</span></span></td>` +
			`<td class="emd-col-serial emd-mono">${serial}</td>` +
			`<td class="emd-col-on">${handedOn}</td>` +
			`<td><span class="basalt-status basalt-status-dot basalt-status-${WEAR_TONE[loan.condition] || 'secondary'}">${htmlSafe(loan.condition)}</span></td>` +
			`<td class="emd-col-act">${giveBack}</td></tr>`
		);
	}

	function returnLoan(button) {
		const index = Number(button.dataset.emdReturn);
		const loan = loans[index];
		disposeTip(button);
		loans.splice(index, 1);
		clearFresh(loans);
		closet.push({ ...loan, fresh: false });
		paintLoans();
		const entry = logChange('bi-arrow-return-left', `Returned ${loan.item}`);
		pick('#emd-kit-title').focus();
		say(`${loan.item} returned.`);
		notify({
			tone: 'success',
			title: 'Marked as returned',
			text: `${loan.item} is back in the IT closet.`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						/* If the item has since gone out to someone else, keep it there. */
						const shelf = closet.findIndex((spare) => spare.serial === loan.serial);
						if (shelf < 0) return;
						closet.splice(shelf, 1);
						loans.splice(Math.min(index, loans.length), 0, loan);
						forgetChange(entry);
						paintLoans();
						paintLog();
						say(`${loan.item} is on loan again.`);
					},
				},
			],
		});
	}

	/* Closet items this person can take, with their closet positions. A
     door badge is left out for anyone working from home. */
	function lendable() {
		const offer = [];
		for (const [shelf, spare] of closet.entries()) {
			if (person.remote && spare.kind === 'badge') continue;
			offer.push([shelf, spare]);
		}
		return offer;
	}

	function prepareLend() {
		const offer = lendable();
		const topPick = offer[0];
		pick('[data-emd="assign-sub"]', lendDialog).textContent = `Lend ${profile.first} something from the IT closet.`;
		fillSelect(
			lendItem,
			topPick
				? offer.map(([shelf, spare]) => [String(shelf), `${spare.item} · ${spare.serial}`])
				: [['', 'Nothing left in the IT closet']],
			topPick ? String(topPick[0]) : '',
		);
		fillSelect(lendWear, WEAR_LEVELS, topPick ? topPick[1].condition : 'New');
		lendItem.disabled = lendWear.disabled = lendSubmit.disabled = !topPick;
		window.Basalt.datepicker?.set(lendDate, demoIso);
	}

	function submitLend(event) {
		event.preventDefault();
		const typed = pick('#emd-assign-on', lendDialog);
		const handedOn = window.Basalt.datepicker ? window.Basalt.datepicker.get(lendDate) : demoIso;
		/* The date picker flags a day it cannot accept and explains below it. */
		if (!handedOn || !typed.checkValidity()) {
			typed.focus();
			return;
		}
		const spare = lendItem.value === '' ? null : closet[Number(lendItem.value)];
		if (!spare) return;
		closet.splice(closet.indexOf(spare), 1);
		clearFresh(loans);
		loans.push({
			kind: spare.kind,
			item: spare.item,
			serial: spare.serial,
			issued: handedOn,
			condition: lendWear.value,
			fresh: true,
		});
		paintLoans();
		logChange('bi-laptop', `Assigned ${spare.item}`);
		window.bootstrap.Modal.getOrCreateInstance(lendDialog).hide();
		say(`${spare.item} assigned to ${profile.first}.`);
		notify({ tone: 'success', title: 'Equipment assigned', text: `${spare.item} is on loan to ${profile.first}.` });
	}

	/* The change log shows a short preview until someone expands it. */

	function paintLog() {
		const rowsShown = logExpanded ? changelog : changelog.slice(0, LOG_PREVIEW);
		hook('history').innerHTML = rowsShown
			.map(
				(entry) =>
					`<tr${freshClass(entry)}>` +
					`<td>${htmlSafe(longDay(entry.when))}</td>` +
					`<td class="emd-col-wide"><span class="emd-change"><i class="bi ${entry.icon}" aria-hidden="true"></i>${htmlSafe(entry.text)}</span></td>` +
					`<td class="emd-col-by">${htmlSafe(entry.by)}${entry.by === VIEWER ? ' <span class="emd-you">You</span>' : ''}</td></tr>`,
			)
			.join('');
		logFoot.hidden = changelog.length <= LOG_PREVIEW;
		logToggle.textContent = logExpanded ? 'Show fewer' : `Show all ${changelog.length}`;
		logToggle.setAttribute('aria-expanded', String(logExpanded));
	}

	/** Puts a change from the viewer on top of the log and returns it. */
	function logChange(icon, text) {
		clearFresh(changelog);
		const entry = { when: demoIso, icon, text, by: VIEWER, fresh: true };
		changelog.unshift(entry);
		paintLog();
		return entry;
	}

	function forgetChange(entry) {
		const at = changelog.indexOf(entry);
		if (at > -1) changelog.splice(at, 1);
	}

	/* Inline editing: one form per panel, validated on submit. */

	function wireEditor(form) {
		const editor = EDITORS[form.dataset.emdForm];
		const key = form.dataset.emdForm;
		/* A flagged field clears as soon as what is typed passes. */
		form.addEventListener('input', (event) => {
			const control = event.target;
			if (control.classList.contains('is-invalid') && !editor.problems(form).includes(control)) {
				control.classList.remove('is-invalid');
			}
		});
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const wrong = editor.problems(form);
			for (const control of pickAll('.form-control', form))
				control.classList.toggle('is-invalid', wrong.includes(control));
			if (wrong.length) {
				wrong[0].focus();
				return;
			}
			const notes = editor.commit(form);
			editor.repaint();
			endEdit(key);
			for (let n = notes.length - 1; n >= 0; n -= 1) logChange(...notes[n]);
			const summary = notes.length
				? `${tally(notes.length, 'change')} added to the history.`
				: 'Nothing had changed.';
			say(`${editor.saved}. ${summary}`);
			notify({ tone: 'success', title: editor.saved, text: summary });
		});
	}

	/* Edit swaps a panel's read-only facts for its form and moves focus in. */
	function beginEdit(key) {
		const card = pick(`[data-emd-section="${key}"]`, sheet);
		const editSheetForm = pick(`[data-emd-form="${key}"]`, card);
		EDITORS[key].load(editSheetForm);
		for (const control of pickAll('.is-invalid', editSheetForm)) control.classList.remove('is-invalid');
		pick(`[data-emd-view="${key}"]`, card).hidden = true;
		pick(`[data-emd-edit="${key}"]`, card).hidden = true;
		editSheetForm.hidden = false;
		const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		card.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
		pick('input', editSheetForm).focus({ preventScroll: true });
	}

	function endEdit(key) {
		const card = pick(`[data-emd-section="${key}"]`, sheet);
		const trigger = pick(`[data-emd-edit="${key}"]`, card);
		pick(`[data-emd-form="${key}"]`, card).hidden = true;
		pick(`[data-emd-view="${key}"]`, card).hidden = false;
		trigger.hidden = false;
		trigger.focus();
	}

	function inputFor(form, key) {
		return pick(`[data-emd-f="${key}"]`, form);
	}

	/* Anyone on that team can be picked, except people who report to this one. */
	function bossChoices(team) {
		return colleagues
			.filter((member) => member.team === team && member.mgr !== profile.id)
			.map((member) => [member.id, member.name]);
	}

	/**
	 * Replaces a select's options. Each choice is a plain string or a
	 * [value, label] pair; the one equal to `chosen` starts selected.
	 */
	function fillSelect(select, choices, chosen) {
		select.innerHTML = choices
			.map((choice) => {
				const [value, label] = Array.isArray(choice) ? choice : [choice, choice];
				return `<option value="${htmlSafe(value)}"${value === chosen ? ' selected' : ''}>${htmlSafe(label)}</option>`;
			})
			.join('');
		window.Basalt.select?.refresh?.(select);
	}

	function copyRecordLink() {
		const address = `${location.href.split('#')[0].split('?')[0]}?id=${encodeURIComponent(profile.id)}`;
		function copied() {
			return notify({
				tone: 'success',
				title: 'Link copied',
				text: `Anyone with access to HR can open ${profile.first}'s record.`,
			});
		}
		if (window.Basalt.copyText) window.Basalt.copyText(address).then(copied, () => {});
		else copied();
	}

	/* Markup fragments and lookups shared by several panels. */

	function factList(rows) {
		return rows
			.map(
				([label, value, note]) =>
					`<div><dt>${label}</dt><dd>${value}${note ? `<span class="emd-fact-sub">${note}</span>` : ''}</dd></div>`,
			)
			.join('');
	}

	function avatarChip(name, tone, size) {
		return `<span class="basalt-avatar ${size ? `basalt-avatar-${size} ` : ''}basalt-avatar-tone-${tone}" aria-hidden="true">${htmlSafe(monogram(name))}</span>`;
	}

	function freshClass(row) {
		return row.fresh ? ' class="is-fresh"' : '';
	}

	function clearFresh(rows) {
		for (const row of rows) row.fresh = false;
	}

	/* An open tooltip would outlive the button it belongs to after a redraw. */
	function disposeTip(button) {
		window.bootstrap?.Tooltip.getInstance(button)?.dispose();
	}

	function leaveKind(key) {
		return BALANCES.find((balance) => balance.key === key) || EXTRA_LEAVE[key];
	}

	function squadOf(id) {
		return squads.find((squad) => squad.id === id);
	}

	function colleague(id) {
		return colleagues.find((member) => member.id === id);
	}

	function rosterName(shortId) {
		return roster.nameOf(roster.recordWithId(shortId));
	}

	function wholeName(someone) {
		return `${someone.first} ${someone.last}`;
	}

	function monogram(name) {
		return name
			.split(' ')
			.map((part) => part.charAt(0))
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}

	function recordHref(id) {
		return `employee-details.html?id=${encodeURIComponent(id)}`;
	}

	function upperFirst(text) {
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	function tally(n, single, multiple) {
		return `${n} ${n === 1 ? single : multiple || `${single}s`}`;
	}

	function dollars(amount) {
		return `$${Number(amount).toLocaleString('en-US')}`;
	}

	/* Dates travel as YYYY-MM-DD strings and are read as local days. */

	function parseDay(iso) {
		const [year, month, day] = iso.split('-').map(Number);
		return new Date(year, month - 1, day);
	}

	function toIso(date) {
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${date.getFullYear()}-${month}-${day}`;
	}

	function shiftMonths(iso, months) {
		const date = parseDay(iso);
		date.setMonth(date.getMonth() + months);
		return toIso(date);
	}

	/** Formats a YYYY-MM-DD string in one of the DAY_FORMATS styles. */
	function dayText(iso, style = 'short') {
		return parseDay(iso).toLocaleDateString('en-US', DAY_FORMATS[style]);
	}

	function longDay(iso) {
		return dayText(iso, 'long');
	}

	/* "Oct 19 to 23" inside one month, "Sep 28 to Oct 2" across two. */
	function spanLabel(first, last) {
		if (first === last) return dayText(first);
		const end = parseDay(last);
		const tail = parseDay(first).getMonth() === end.getMonth() ? String(end.getDate()) : dayText(last);
		return `${dayText(first)} to ${tail}`;
	}

	/* Turns "17:07" (or a bare hour such as 9) into "5:07 pm". */
	function clockLabel(value) {
		const [hour, minute] = String(value).split(':').map(Number);
		return `${hour % 12 || 12}:${String(minute || 0).padStart(2, '0')}${hour < 12 ? ' am' : ' pm'}`;
	}

	function minutesLabel(total) {
		return clockLabel(`${Math.floor(total / 60)}:${total % 60}`);
	}

	/* 7.85 hours reads as "7 h 51 m". */
	function durationLabel(hours) {
		return `${Math.floor(hours)} h ${String(Math.round((hours % 1) * 60)).padStart(2, '0')} m`;
	}

	function dayGap(earlier, later) {
		return Math.round((later - earlier) / 864e5);
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function hook(key) {
		return pick(`[data-emd="${key}"]`, sheet);
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
	}

	function say(text) {
		window.Basalt.announce?.(text);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	start();
})();
