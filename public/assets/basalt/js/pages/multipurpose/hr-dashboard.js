/**
 * The live parts of the HR desk on hr-dashboard.html. Four lists are drawn from
 * BOOK below and redrawn as you work: requests waiting for a decision
 * (reviewed in a drawer, with Undo in the toast), who is off across
 * today and the next four working days, the people joining or leaving
 * with their checklists, and headcount as a ring by team or region.
 * The Add employee drawer feeds a new starter into the last two.
 *
 * Everything is dated against Friday, October 9, 2026, and the numbers
 * hold together: 52 staff (19 Northeast, 17 Midwest, 9 South,
 * 7 West), four starters, four people out today.
 * Swap BOOK for your own API response in the same shape.
 */
(() => {
	'use strict';

	const desk = pick('[data-hq-root]', document);
	if (!desk || !window.bootstrap) return;

	const SHOW_DATE = '2026-10-09';

	const BOOK = {
		asks: [
			{
				id: 'r-audrey',
				person: 'Ashley Steele',
				role: 'Frontend engineer',
				team: 'Engineering',
				replyTo: 'Ashley',
				category: 'Hours change',
				gist: 'Four days a week from Nov 2',
				overdue: true,
				age: '5 days',
				ageSpoken: 'five days',
				headline: 'Four days a week, Fridays off',
				words: 'I am studying for a master’s in human-computer interaction on Fridays until June.',
				signed: 'Ashley Steele, Sunday, October 4',
				details: [
					['Now', 'Full time, 40 hours'],
					['After', 'Four days, 32 hours'],
					['From', 'Monday, November 2'],
					['Pay', '80% of salary', 'Vacation drops to 20 days a year.'],
				],
				hint: {
					tone: 'success',
					icon: 'bi-check2-circle',
					text: 'Alicia Bowen, her manager, has already agreed to it.',
				},
				outcome: {
					approve: ['Ashley’s new hours are approved', 'Payroll picks them up from the November run.'],
					decline: ['Ashley’s request is declined', 'She gets an email with your note.'],
				},
			},
			{
				id: 'r-ben',
				person: 'Ben Pearce',
				role: 'Support specialist',
				team: 'Support',
				replyTo: 'Connie',
				category: 'Probation check-in',
				gist: 'Four weeks in, from Connie',
				age: '3 days',
				ageSpoken: 'three days',
				headline: 'Four-week check-in',
				words: 'Ben closed 64 tickets in his third week with a 96% happy score. He is ready for the Travel Planner queue.',
				signed: 'Connie Reese, his manager, Tuesday, October 6',
				details: [
					['Started', 'Monday, September 14'],
					['Probation ends', 'Monday, December 14'],
					['Onboarding', '6 of 6 done'],
					['Next check-in', 'Monday, November 9'],
				],
				hint: {
					tone: 'info',
					icon: 'bi-info-circle',
					text: 'On track keeps the next check-in. Needs a plan asks Connie to write one with him.',
				},
				verbs: { approve: 'Mark on track', decline: 'Needs a plan' },
				outcome: {
					approve: ['Ben is on track', 'His next check-in stays on Monday, November 9.'],
					decline: ['Connie will write a plan with Ben', 'She gets your note and a reminder for Friday.'],
				},
			},
			{
				id: 'r-leah',
				person: 'Leah Goldberg',
				role: 'Product manager, Customer Portal',
				team: 'Product',
				replyTo: 'Leah',
				category: 'Time off',
				gist: 'Oct 12–16, 5 working days',
				age: '2 days',
				ageSpoken: 'two days',
				headline: 'Vacation, Monday, October 12 to Friday, October 16',
				words: 'A family wedding in Akron. Oliver is running the Customer Portal stand-ups that week.',
				signed: 'Leah Goldberg, Wednesday, October 7',
				details: [
					['Working days', '5'],
					['Left after this', '9 of 25 days'],
					['Cover', 'Oliver Merritt'],
				],
				hint: { tone: 'success', icon: 'bi-check2-circle', text: 'Nobody else in Product is away that week.' },
				absence: {
					person: 'Leah Goldberg',
					team: 'Product',
					reason: 'Vacation',
					tone: 'primary',
					first: '2026-10-12',
					last: '2026-10-16',
					returns: 'Back Mon, Oct 19',
				},
				outcome: {
					approve: ['Leah’s time off is approved', 'It is on the time-off calendar, and she gets an email.'],
					decline: ['Leah’s time off is declined', 'She gets an email with your note.'],
				},
			},
			{
				id: 'r-forrest',
				person: 'Forrest Murphy',
				role: 'Backend engineer',
				team: 'Engineering',
				replyTo: 'Forrest',
				category: 'Time off',
				gist: 'Dec 21 – Jan 1, 8 working days',
				age: '1 day',
				ageSpoken: 'one day',
				headline: 'Vacation, Monday, December 21 to Friday, January 1',
				words: 'Visiting family in Dayton over the holidays. I will hand the billing service on-call to Rory before I go.',
				signed: 'Forrest Murphy, Thursday, October 8',
				details: [
					['Working days', '8', 'December 25 and January 1 are holidays.'],
					['Left after this', '6 of 25 days'],
					['Cover', 'Rory Beasley'],
				],
				hint: {
					tone: 'warning',
					icon: 'bi-exclamation-triangle',
					text: 'Rory Beasley is also off December 28–31, so nobody would cover the billing service that week.',
				},
				outcome: {
					approve: [
						'Forrest’s time off is approved',
						'It is on the time-off calendar, and he gets an email.',
					],
					decline: ['Forrest’s time off is declined', 'He gets an email with your note.'],
				},
			},
			{
				id: 'r-rory',
				person: 'Rory Beasley',
				role: 'Backend engineer',
				team: 'Engineering',
				replyTo: 'Rory',
				category: 'Referral bonus',
				gist: '$2,000 for Sloan Kirby',
				age: '20 hours',
				ageSpoken: 'twenty hours',
				headline: 'Referral bonus of $2,000',
				words: 'Sloan and I worked together in Duluth. Glad he said yes, he starts on Monday.',
				signed: 'Rory Beasley, Thursday, October 8',
				details: [
					['For', 'Sloan Kirby, platform engineer'],
					['Amount', '$2,000', 'Half now, half when Sloan passes probation.'],
					['Paid in', 'October payroll'],
				],
				hint: {
					tone: 'success',
					icon: 'bi-check2-circle',
					text: 'Sloan signed his contract on September 14, so the referral counts.',
				},
				outcome: {
					approve: ['Rory’s referral bonus is approved', 'The first $1,000 goes into the October payroll.'],
					decline: ['Rory’s referral bonus is declined', 'He gets an email with your note.'],
				},
			},
			{
				id: 'r-travis',
				person: 'Quentin Cook',
				role: 'Account executive',
				team: 'Sales',
				replyTo: 'Rowan',
				category: 'Pay change',
				gist: 'Promotion to senior from Nov 1',
				age: '4 hours',
				ageSpoken: 'four hours',
				headline: 'Promotion to senior account executive',
				words: 'Quentin closed 128% of his Q3 target, including Travel Planner for all 52 seats at Volt Film & Photo.',
				signed: 'Rowan Walsh, his manager, today at 10:20 am',
				details: [
					['Salary now', '$92,400'],
					['Salary after', '$104,400', 'Up 13%, inside the $98,000 – $118,000 band.'],
					['From', 'Sunday, November 1'],
					['Last change', 'November 2025'],
				],
				hint: {
					tone: 'success',
					icon: 'bi-check2-circle',
					text: 'The Sales budget for 2026 already holds this increase.',
				},
				outcome: {
					approve: [
						'Quentin’s promotion is approved',
						'Rowan can tell him. Payroll picks it up in November.',
					],
					decline: ['Quentin’s promotion is declined', 'Rowan gets an email with your note.'],
				},
			},
		],

		/* first and last are the outer days of the absence, both off;
       returns is the line shown for the day they are back. */
		absences: [
			{
				person: 'Randall Rhodes',
				team: 'Support',
				reason: 'Parental leave',
				tone: 'success',
				first: '2026-08-31',
				last: '2026-12-04',
				returns: 'Back Mon, Dec 7',
			},
			{
				person: 'Barbara Hahn',
				team: 'Marketing',
				reason: 'Vacation',
				tone: 'primary',
				first: '2026-10-05',
				last: '2026-10-09',
				returns: 'Back Mon, Oct 12',
			},
			{
				person: 'Jim Atkins',
				team: 'Engineering',
				reason: 'Sick leave',
				tone: 'warning',
				first: '2026-10-08',
				last: '2026-10-09',
				returns: 'Back Mon, Oct 12',
			},
			{
				person: 'Tony Aldridge',
				team: 'Success',
				reason: 'Vacation',
				tone: 'primary',
				first: '2026-10-09',
				last: '2026-10-09',
				returns: 'Back Mon, Oct 12',
			},
			{
				person: 'Hope Stout',
				team: 'Finance',
				reason: 'Public holiday',
				tone: 'info',
				first: '2026-10-12',
				last: '2026-10-12',
				returns: 'Back Tue, Oct 13',
			},
			{
				person: 'Nan Donovan',
				team: 'Support',
				reason: 'Bereavement leave',
				tone: 'info',
				first: '2026-10-12',
				last: '2026-10-14',
				returns: 'Back Thu, Oct 15',
			},
			{
				person: 'Jeffrey McKay',
				team: 'Sales',
				reason: 'Vacation',
				tone: 'primary',
				first: '2026-10-13',
				last: '2026-10-14',
				returns: 'Back Thu, Oct 15',
			},
		],

		/* Each task is [what, where it stands, ticked]. */
		changes: [
			{
				id: 'm-sloan',
				person: 'Sloan Kirby',
				role: 'Platform engineer',
				team: 'Engineering',
				city: 'Bellingham',
				joining: true,
				date: '2026-10-12',
				contract: 'Full time',
				manager: 'Alicia Bowen',
				buddy: 'Darryl Sanders',
				tasks: [
					['Contract signed', 'Signed on Monday, September 14', true],
					['Bank and tax details', 'Added to payroll', true],
					['Laptop delivered', 'Delivered in Bellingham on Tuesday, October 6', true],
					['Workspace invite sent', 'sloan.kirby@fieldline.app', true],
					['Buddy picked', 'Darryl Sanders', true],
					['First-week plan shared', 'Alicia is writing it', false],
				],
			},
			{
				id: 'm-wren',
				person: 'Wren Abbott',
				role: 'Operations analyst',
				team: 'Operations',
				city: 'Evanston',
				joining: true,
				date: '2026-10-12',
				contract: 'Full time',
				manager: 'Kirk Mathis',
				buddy: 'Lance Bishop',
				tasks: [
					['Contract signed', 'Signed on Monday, September 21', true],
					['Bank and tax details', 'Added to payroll', true],
					['Laptop delivered', 'Ships today, arrives on Monday morning', false],
					['Workspace invite sent', 'wren.abbott@fieldline.app', true],
					['Buddy picked', 'Lance Bishop', true],
					['First-week plan shared', 'Kirk is writing it', false],
				],
			},
			{
				id: 'm-tamara',
				person: 'Tamara Ives',
				role: 'Support specialist',
				team: 'Support',
				city: 'Missoula',
				joining: true,
				date: '2026-10-19',
				contract: 'Full time',
				manager: 'Connie Reese',
				buddy: 'Not picked yet',
				tasks: [
					['Contract signed', 'Signed on Friday, September 25', true],
					['Bank and tax details', 'Added to payroll', true],
					['Laptop delivered', 'Ordered, arrives on Thursday, October 15', false],
					['Workspace invite sent', 'tamara.ives@fieldline.app', true],
					['Buddy picked', 'Jessica Toll works the same hours', false],
					['First-week plan shared', 'Connie is writing it', false],
				],
			},
			{
				id: 'm-gerald',
				person: 'Gerald Pritchard',
				role: 'Sales development rep',
				team: 'Sales',
				city: 'Boston',
				joining: false,
				date: '2026-10-23',
				contract: 'Full time',
				manager: 'Rowan Walsh',
				tasks: [
					['Resignation confirmed in writing', 'Sent on Friday, September 25', true],
					['Exit interview booked', 'Thursday, October 22 at 3:00 pm', true],
					['Open leads handed over', 'To Quentin Cook', false],
					['Laptop return booked', 'A courier collects it on his last day', false],
					['Final pay worked out', 'Includes 4 unused vacation days', false],
				],
			},
			{
				id: 'm-jacob',
				person: 'Jacob Krause',
				role: 'Product designer',
				team: 'Product',
				city: 'Toledo',
				joining: true,
				date: '2026-11-02',
				contract: 'Full time',
				manager: 'Leslie Whitlock',
				buddy: 'Not picked yet',
				tasks: [
					['Contract signed', 'Signed on Thursday, October 1', true],
					['Bank and tax details', 'Waiting for his tax ID', false],
					['Laptop delivered', 'Not ordered yet', false],
					['Workspace invite sent', 'jacob.krause@fieldline.app', true],
					['Buddy picked', 'Sandra Franklin offered', false],
					['First-week plan shared', 'Leslie is writing it', false],
				],
			},
		],

		/* Keyed by the value of the Team / Region toggle; each row is
       [group, people now, people about to join]. */
		headcount: {
			team: [
				['Engineering', 11, 1],
				['Support', 11, 1],
				['Sales', 7, 0],
				['Success', 6, 0],
				['Operations', 5, 1],
				['Product', 5, 1],
				['Marketing', 4, 0],
				['Finance', 3, 0],
			],
			region: [
				['Northeast', 19, 1],
				['Midwest', 17, 1],
				['South', 9, 0],
				['West', 7, 2],
			],
		},
	};

	/* A starter added through the form begins with this list; the empty
     note on the invite is replaced by the address they typed. */
	const FIRST_TASKS = [
		['Contract signed', 'Not sent yet'],
		['Bank and tax details', 'Asked for in the welcome email'],
		['Laptop delivered', 'Not ordered yet'],
		['Workspace invite sent', ''],
		['Buddy picked', 'Not picked yet'],
		['First-week plan shared', 'Their manager writes it'],
	];
	const INVITE_TASK = 'Workspace invite sent';

	/* Button labels for a request that does not bring its own verbs. */
	const PLAIN_VERBS = { approve: 'Approve', decline: 'Decline' };

	/* Icon and chart-ramp slot for each category of request. */
	const CATEGORY_LOOK = {
		'Hours change': { icon: 'bi-clock-history', series: 5 },
		'Probation check-in': { icon: 'bi-clipboard-check', series: 3 },
		'Time off': { icon: 'bi-airplane', series: 1 },
		'Referral bonus': { icon: 'bi-gift', series: 8 },
		'Pay change': { icon: 'bi-graph-up-arrow', series: 2 },
	};

	const SPOKEN = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

	/* With this radius the circumference is exactly 100, so dash lengths
     on the ring read straight as percentages. */
	const RING_RADIUS = 15.9155;

	const view = { groupBy: 'team', pickedDay: SHOW_DATE, openAsk: null, openChange: null, refocus: false };

	const staff = window.Basalt.data.people;

	const queueRows = pick('[data-hq-requests]');
	const dayStrip = pick('[data-hq-week]');
	const absentList = pick('[data-hq-away]');
	const changeRows = pick('[data-hq-moves]');
	const ring = pick('[data-hq-ring]');
	const groupList = pick('[data-hq-size-list]');

	const askSheet = document.getElementById('hq-review');
	const replyBox = pick('[data-hq-r="note"]', askSheet);
	const replyError = document.getElementById('hq-note-error');
	const changeSheet = document.getElementById('hq-person');
	const addSheet = document.getElementById('hq-add');
	const createForm = pick('[data-hq-add]', document);
	let addressTouched = false;

	/* Where each office city sits on the globe, as latitude and longitude. */
	const COORDS = {
		Akron: [41.08, -81.52],
		Amarillo: [35.22, -101.83],
		Appleton: [44.26, -88.42],
		Atlanta: [33.75, -84.39],
		Bellingham: [48.75, -122.48],
		Bismarck: [46.81, -100.78],
		Boston: [42.36, -71.06],
		Boulder: [40.01, -105.27],
		Canton: [40.8, -81.38],
		Chattanooga: [35.05, -85.31],
		'Corpus Christi': [27.8, -97.4],
		Duluth: [46.79, -92.1],
		Durham: [35.99, -78.9],
		Eureka: [40.8, -124.16],
		Evanston: [42.05, -87.69],
		Fayetteville: [36.06, -94.16],
		Flagstaff: [35.2, -111.65],
		'Iowa City': [41.66, -91.53],
		'La Crosse': [43.8, -91.24],
		'Los Angeles': [34.05, -118.24],
		Louisville: [38.25, -85.76],
		Minot: [48.23, -101.3],
		Missoula: [46.87, -113.99],
		Newark: [40.74, -74.17],
		Olympia: [47.04, -122.9],
		Peoria: [40.69, -89.59],
		Rockford: [42.27, -89.09],
		Sarasota: [27.34, -82.53],
		'St. Cloud': [45.56, -94.16],
		Stamford: [41.05, -73.54],
		Syracuse: [43.05, -76.15],
		Tacoma: [47.25, -122.44],
		Toledo: [41.65, -83.54],
		Topeka: [39.05, -95.68],
		Waco: [31.55, -97.15],
		Yakima: [46.6, -120.51],
	};

	/* The five working days on the strip, starting with the show date. */
	const STRIP = workdaysFrom(SHOW_DATE, 5);

	start();

	/** Draws every list once and connects the page, drawers and form. */
	function start() {
		askSheet.addEventListener('click', onSheetDecision);
		askSheet.addEventListener('hidden.bs.offcanvas', onAskSheetClosed);
		replyBox.addEventListener('input', () => replyBox.classList.remove('is-invalid'));

		dayStrip.addEventListener('click', onDayPicked);

		changeSheet.addEventListener('change', onTaskTicked);
		changeSheet.addEventListener('hidden.bs.offcanvas', () => {
			view.openChange = null;
		});

		desk.addEventListener('change', onGroupingPicked);
		desk.addEventListener('click', onDeskClick);
		desk.addEventListener('auxclick', onDeskMiddleClick);

		wireAddForm();

		paintGlobe();
		paintQueue();
		paintAbsences();
		paintChanges();
		paintHeadcount();
	}

	/* Requests: the queue table and the review drawer. */

	function paintQueue() {
		const asks = BOOK.asks;
		queueRows.innerHTML = asks.map(queueRow).join('');
		const none = asks.length === 0;
		pick('[data-hq-requests-table]').hidden = none;
		pick('[data-hq-requests-empty]').hidden = !none;
		let summary = 'Nothing is waiting for a decision.';
		if (!none) {
			const tail = asks.length === 1 ? ' request. It has waited ' : ' requests. The oldest has waited ';
			summary = `${spoken(asks.length)}${tail}${asks[0].ageSpoken}.`;
		}
		pick('[data-hq-waiting-desc]').textContent = summary;
	}

	function queueRow(ask) {
		const look = CATEGORY_LOOK[ask.category];
		const ageClass = ask.overdue ? 'hq-requests-when hq-requests-when-old' : 'hq-requests-when';
		const who = `<td><button type="button" class="hq-open" data-hq-review="${ask.id}"><span class="hq-name">${htmlSafe(ask.person)}</span></button><span class="hq-sub">${htmlSafe(ask.team)}</span></td>`;
		const what = `<td><div class="hq-kind"><span class="hq-kind-icon" style="--hq-tone: var(--basalt-series-${look.series})" aria-hidden="true"><i class="bi ${look.icon}"></i></span><div><span class="hq-requests-ask">${htmlSafe(ask.category)}</span><span class="hq-sub">${htmlSafe(ask.gist)}</span></div></div></td>`;
		const age = `<td><span class="${ageClass}"><span class="hq-stack-label">Waiting </span>${htmlSafe(ask.age)}</span></td>`;
		const action = `<td><button type="button" class="btn btn-outline-primary btn-sm" data-hq-review="${ask.id}" aria-label="Review ${htmlSafe(ask.person)}’s request">Review</button></td>`;
		return `<tr data-hq-row="${ask.id}">${who}${what}${age}${action}</tr>`;
	}

	/** Fills the review drawer for one request and slides it in. */
	function showAsk(id) {
		const ask = BOOK.asks.find((entry) => entry.id === id);
		if (!ask) return;
		view.openAsk = ask;

		const face = pick('[data-hq-r="avatar"]', askSheet);
		face.setAttribute('data-name', ask.person);
		window.Basalt.avatar?.(face);
		pick('[data-hq-r="name"]', askSheet).textContent = ask.person;
		pick('[data-hq-r="sub"]', askSheet).textContent = `${ask.role} · ${ask.team}`;

		const detailRows = ask.details
			.map(([term, value, aside]) => {
				const extra = aside ? `<span class="hq-facts-note">${htmlSafe(aside)}</span>` : '';
				return `<div class="hq-facts-row"><dt>${htmlSafe(term)}</dt><dd>${htmlSafe(value)}${extra}</dd></div>`;
			})
			.join('');
		pick('[data-hq-r="body"]', askSheet).innerHTML = [
			`<p class="hq-sheet-eyebrow">${htmlSafe(ask.category)} · waiting ${htmlSafe(ask.age)}</p>`,
			`<p class="hq-sheet-ask">${htmlSafe(ask.headline)}</p>`,
			`<blockquote class="hq-quote"><p>${htmlSafe(ask.words)}</p><footer>${htmlSafe(ask.signed)}</footer></blockquote>`,
			`<h3 class="hq-sheet-h">Details</h3><dl class="hq-facts">${detailRows}</dl>`,
			'<h3 class="hq-sheet-h">Worth knowing</h3>',
			`<p class="hq-notice hq-notice-${ask.hint.tone}"><i class="bi ${ask.hint.icon}" aria-hidden="true"></i><span>${htmlSafe(ask.hint.text)}</span></p>`,
		].join('');

		pick('[data-hq-r="note-label"]', askSheet).textContent = `Note to ${ask.replyTo}`;
		replyBox.value = '';
		replyBox.classList.remove('is-invalid');
		for (const [verdict, label] of Object.entries(ask.verbs ?? PLAIN_VERBS)) {
			pick(`[data-hq-decide="${verdict}"]`, askSheet).textContent = label;
		}
		sheet(askSheet).show();
	}

	function onSheetDecision(event) {
		const trigger = event.target.closest('[data-hq-decide]');
		if (trigger) settle(trigger.getAttribute('data-hq-decide'));
	}

	/**
	 * Approves or declines the open request. Declining needs a note.
	 * The request leaves the queue (and an approved absence joins the
	 * strip) until Undo in the toast puts both back.
	 */
	function settle(verdict) {
		const ask = view.openAsk;
		if (!ask) return;
		const approving = verdict === 'approve';
		if (verdict === 'decline' && !replyBox.value.trim()) {
			replyBox.classList.add('is-invalid');
			replyError.textContent = `Say why, so ${ask.replyTo} knows what happens next.`;
			replyBox.focus();
			return;
		}

		const slot = BOOK.asks.indexOf(ask);
		BOOK.asks.splice(slot, 1);
		const joined = approving && ask.absence ? { fresh: true, ...ask.absence } : null;
		if (joined) BOOK.absences.push(joined);

		view.refocus = true;
		sheet(askSheet).hide();
		paintQueue();
		if (joined) paintAbsences();

		const [title, text] = ask.outcome[verdict];
		pushToast({
			tone: approving ? 'success' : 'info',
			title,
			text,
			actions: [{ label: 'Undo', onClick: () => restoreAsk(ask, slot, joined) }],
		});
	}

	function restoreAsk(ask, slot, joined) {
		BOOK.asks.splice(Math.min(slot, BOOK.asks.length), 0, ask);
		if (joined) {
			BOOK.absences.splice(BOOK.absences.indexOf(joined), 1);
			paintAbsences();
		}
		paintQueue();
		window.Basalt.announce?.('The request is back in Waiting for you.');
	}

	/* After a decision, focus moves to the next Review button, or to the
     all-clear heading once the queue is empty. */
	function onAskSheetClosed() {
		view.openAsk = null;
		if (!view.refocus) return;
		view.refocus = false;
		const nextUp = pick('[data-hq-review]', queueRows);
		(nextUp || pick('[data-hq-requests-empty] .basalt-empty-title')).focus();
	}

	/* Away: the five-day strip and the list for the picked day. */

	function paintAbsences() {
		dayStrip.innerHTML = STRIP.map(stripDay).join('');
		window.Basalt.avatars?.(dayStrip);

		const out = absentOn(view.pickedDay);
		const heading = view.pickedDay === SHOW_DATE ? 'today' : `on ${dateLabel(view.pickedDay, true)}`;
		const list = out.length
			? `<ul class="hq-away-list">${out.map(absentItem).join('')}</ul>`
			: '<p class="hq-away-none">Everyone is in.</p>';
		absentList.innerHTML = `<h3 class="hq-away-title">Off ${heading} · ${out.length}</h3>${list}`;

		for (const absence of BOOK.absences) delete absence.fresh;
		window.Basalt.avatars?.(absentList);

		const outToday = absentOn(SHOW_DATE).length;
		const lead = outToday
			? `${spoken(outToday)}${outToday === 1 ? ' person is' : ' people are'} off today.`
			: 'Everyone is in today.';
		pick('[data-hq-away-desc]').textContent = `${lead} Pick a day to see who is out.`;
	}

	function stripDay(date) {
		const out = absentOn(date);
		const name = date === SHOW_DATE ? 'Today' : dateLabel(date).split(' ')[0];
		const faces = out.length
			? out
					.slice(0, 3)
					.map((absence) => face(absence.person, 'basalt-avatar-xs'))
					.join('')
			: '<i class="bi bi-check2"></i>';
		const tally = out.length ? `${out.length} off` : 'All in';
		const flash = out.some((absence) => absence.fresh) ? ' is-new' : '';
		return `<li class="hq-week-item"><button type="button" class="hq-week-day${flash}" aria-pressed="${date === view.pickedDay}" data-hq-day="${date}"><span class="hq-week-dow">${name}</span><span class="hq-week-num">${Number(date.slice(8))}</span><span class="hq-week-faces" aria-hidden="true">${faces}</span><span class="hq-week-count">${tally}</span><span class="visually-hidden">, ${dateLabel(date, true)}</span></button></li>`;
	}

	function absentItem(absence) {
		return `<li class="hq-away-item${absence.fresh ? ' is-new' : ''}"><div class="hq-person">${face(absence.person)}<div><a class="hq-name" href="${recordOr(absence.person)}">${htmlSafe(absence.person)}</a><span class="hq-sub">${htmlSafe(absence.team)}</span></div></div><div class="hq-away-what"><span class="basalt-status basalt-status-${absence.tone}">${htmlSafe(absence.reason)}</span><span class="hq-away-back">${htmlSafe(absence.returns)}</span></div></li>`;
	}

	function absentOn(date) {
		return BOOK.absences.filter((absence) => absence.first <= date && date <= absence.last);
	}

	function onDayPicked(event) {
		const tile = event.target.closest('[data-hq-day]');
		if (!tile) return;
		view.pickedDay = tile.getAttribute('data-hq-day');
		paintAbsences();
		pick(`[data-hq-day="${view.pickedDay}"]`, dayStrip).focus({ preventScroll: true });
	}

	/* Joining and leaving: the table and the checklist drawer. */

	function paintChanges() {
		BOOK.changes.sort((left, right) => left.date.localeCompare(right.date));
		changeRows.innerHTML = BOOK.changes.map(changeRow).join('');
		window.Basalt.avatars?.(changeRows);
		window.Basalt.tips?.(changeRows);

		const arriving = BOOK.changes.filter((change) => change.joining).length;
		const departing = BOOK.changes.length - arriving;
		const arrivingPart = `${spoken(arriving)}${arriving === 1 ? ' person is' : ' people are'} joining`;
		const departingPart = `${spoken(departing).toLowerCase()}${departing === 1 ? ' is' : ' are'} leaving`;
		pick('[data-hq-moves-desc]').textContent = `${arrivingPart} and ${departingPart}.`;
	}

	function changeRow(change) {
		const name = htmlSafe(change.person);
		const record = recordOf(change.person);
		const badge = change.joining
			? '<span class="basalt-status basalt-status-success">Joining</span>'
			: '<span class="basalt-status basalt-status-warning">Leaving</span>';
		const fullPage = record
			? `<a class="btn btn-icon btn-sm" href="${record}" aria-label="Open full page: ${name}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>`
			: '';
		return (
			`<tr data-hq-row="${change.id}">` +
			`<td><div class="hq-person">${face(change.person)}<div><a class="hq-name" href="${record || 'employees.html'}">${name}</a><span class="hq-sub">${htmlSafe(change.role)} · ${htmlSafe(change.city)}</span></div></div></td>` +
			`<td class="hq-moves-day">${badge}<span class="hq-moves-date">${dateLabel(change.date)}</span></td>` +
			`<td class="hq-moves-ready"><button type="button" class="hq-open hq-ready-btn" data-hq-person="${change.id}" data-hq-ready="${change.id}" aria-label="Open ${name}’s checklist">${progressBar(change)}</button></td>` +
			`<td class="hq-moves-act"><span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-hq-person="${change.id}" aria-label="Quick view: ${name}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>${fullPage}</span></td>` +
			'</tr>'
		);
	}

	function progressBar(change) {
		const ticked = tickedCount(change);
		const total = change.tasks.length;
		const finished = ticked === total ? ' hq-ready-done' : '';
		return `<span class="hq-ready${finished}"><span class="hq-ready-bar" aria-hidden="true"><span style="--hq-done: ${Math.round((ticked / total) * 100)}%"></span></span><span class="hq-ready-count">${ticked} of ${total}<span class="visually-hidden"> done</span></span></span>`;
	}

	function tickedCount(change) {
		return change.tasks.filter((task) => task[2]).length;
	}

	/** Fills the checklist drawer for one starter or leaver and opens it. */
	function showChange(id) {
		const change = BOOK.changes.find((entry) => entry.id === id);
		if (!change) return;
		view.openChange = change;

		const portrait = pick('[data-hq-p="avatar"]', changeSheet);
		portrait.setAttribute('data-name', change.person);
		window.Basalt.avatar?.(portrait);
		pick('[data-hq-p="name"]', changeSheet).textContent = change.person;
		pick('[data-hq-p="sub"]', changeSheet).textContent = `${change.role} · ${change.team}`;

		const record = recordOf(change.person);
		const fullLink = pick('[data-hq-p="full"]', changeSheet);
		fullLink.href = record || 'employee-details.html';
		fullLink.hidden = !record;

		const longDate = dateLabel(change.date, true);
		const facts = change.joining
			? [
					['First day', longDate],
					['Where', change.city],
					['Manager', change.manager],
					['Buddy', change.buddy],
					['Contract', change.contract],
				]
			: [
					['Last day', longDate],
					['Where', change.city],
					['Manager', change.manager],
				];
		const factRows = facts
			.map(
				([term, value]) =>
					`<div class="hq-facts-row"><dt>${htmlSafe(term)}</dt><dd>${htmlSafe(value)}</dd></div>`,
			)
			.join('');
		const taskItems = change.tasks
			.map(([label, note, ticked], index) => {
				const small = note ? `<small>${htmlSafe(note)}</small>` : '';
				return `<li class="hq-checks-item"><div class="form-check"><input class="form-check-input" type="checkbox" id="hq-step-${index}" data-hq-step="${index}"${ticked ? ' checked' : ''}><label class="form-check-label hq-checks-label" for="hq-step-${index}"><span>${htmlSafe(label)}</span>${small}</label></div></li>`;
			})
			.join('');

		pick('[data-hq-p="body"]', changeSheet).innerHTML = [
			`<p class="hq-sheet-eyebrow">${change.joining ? 'Joining' : 'Leaving'}</p>`,
			`<p class="hq-sheet-ask">${change.joining ? 'Starts ' : 'Last day '}${longDate}</p>`,
			`<h3 class="hq-sheet-h">Details</h3><dl class="hq-facts">${factRows}</dl>`,
			`<div class="hq-check-head"><h3 class="hq-sheet-h">${change.joining ? 'Before day one' : 'Before they go'}</h3><span class="hq-check-head-count" data-hq-p="count" aria-live="polite"></span></div>`,
			`<ul class="hq-checks">${taskItems}</ul>`,
		].join('');

		updateTally();
		sheet(changeSheet).show();
	}

	function updateTally() {
		const change = view.openChange;
		pick('[data-hq-p="count"]', changeSheet).textContent = `${tickedCount(change)} of ${change.tasks.length} done`;
	}

	/* Ticking a task updates the drawer's count and the row's bar. */
	function onTaskTicked(event) {
		const box = event.target.closest('[data-hq-step]');
		const change = view.openChange;
		if (!box || !change) return;
		change.tasks[Number(box.getAttribute('data-hq-step'))][2] = box.checked;
		updateTally();
		const bar = pick(`[data-hq-ready="${change.id}"]`, changeRows);
		if (bar) bar.innerHTML = progressBar(change);
	}

	/* Team size: the ring and its legend. */

	function paintHeadcount() {
		const groups = [...BOOK.headcount[view.groupBy]].sort((a, b) => b[1] - a[1] || b[2] - a[2]);
		const total = groups.reduce((sum, group) => sum + group[1], 0);

		let traveled = 0;
		const arcs = groups.map(([, count], index) => {
			const share = (count / total) * 100;
			const dash = Math.max(share - 1.2, 0.4);
			const arc = `<circle class="hq-ring-arc" cx="21" cy="21" r="${RING_RADIUS}" style="--hq-tone: var(--basalt-series-${index + 1})" stroke-dasharray="${dash.toFixed(2)} ${(100 - dash).toFixed(2)}" stroke-dashoffset="${(25 - traveled).toFixed(2)}"></circle>`;
			traveled += share;
			return arc;
		});
		ring.innerHTML = `<circle class="hq-ring-track" cx="21" cy="21" r="${RING_RADIUS}"></circle>${arcs.join('')}`;

		groupList.innerHTML = groups
			.map(([group, count, incoming], index) => {
				const unit = count === 1 ? ' employee' : ' employees';
				const extra = incoming ? `+${incoming}<span class="visually-hidden"> joining</span>` : '';
				return `<li class="hq-size-row" style="--hq-tone: var(--basalt-series-${index + 1})"><span class="hq-size-dot" aria-hidden="true"></span><span class="hq-size-name">${htmlSafe(group)}</span><span class="hq-size-value">${count}<span class="visually-hidden">${unit}</span></span><span class="hq-size-plus">${extra}</span></li>`;
			})
			.join('');

		const incomingAll = BOOK.headcount.team.reduce((sum, group) => sum + group[2], 0);
		pick('[data-hq-ring-total]').textContent = `${total}`;
		pick('[data-hq-size-desc]').textContent = `${total} employees, ${incomingAll} more joining.`;
	}

	function onGroupingPicked(event) {
		const toggle = event.target.closest('[data-hq-size]');
		if (!toggle?.checked) return;
		view.groupBy = toggle.value;
		paintHeadcount();
	}

	/* Clicks across the page: wishes in Coming up, then the drawers, then
     whole rows. A row with a record behind it behaves like a link (Cmd,
     Ctrl or Shift opens a new tab); the rest open their drawer. */

	function onDeskClick(event) {
		const wish = event.target.closest('[data-hq-wish]');
		if (wish) {
			sendWishes(wish);
			return;
		}
		const reviewTrigger = event.target.closest('[data-hq-review]');
		if (reviewTrigger) {
			showAsk(reviewTrigger.getAttribute('data-hq-review'));
			return;
		}
		const checklistTrigger = event.target.closest('[data-hq-person]');
		if (checklistTrigger) {
			showChange(checklistTrigger.getAttribute('data-hq-person'));
			return;
		}

		const row = clickedRow(event);
		if (!row) return;
		const target = rowRecord(row);
		if (target) {
			if (event.metaKey || event.ctrlKey || event.shiftKey) window.open(target, '_blank');
			else location.href = target;
			return;
		}
		const rowId = row.getAttribute('data-hq-row');
		if (rowId.startsWith('r-')) showAsk(rowId);
		else showChange(rowId);
	}

	function onDeskMiddleClick(event) {
		if (event.button !== 1) return;
		const row = clickedRow(event);
		const target = row && rowRecord(row);
		if (target) window.open(target, '_blank');
	}

	/* Clicks on a control inside the row belong to that control. */
	function clickedRow(event) {
		if (event.target.closest('a, button, input, label')) return null;
		return event.target.closest('tr[data-hq-row]');
	}

	function rowRecord(row) {
		const change = BOOK.changes.find((entry) => entry.id === row.getAttribute('data-hq-row'));
		return change ? recordOf(change.person) : '';
	}

	function sendWishes(button) {
		const recipient = button.getAttribute('data-hq-wish');
		button.disabled = true;
		button.innerHTML = '<i class="bi bi-check2 me-1" aria-hidden="true"></i>Sent';
		pushToast({
			tone: 'success',
			icon: 'bi-heart',
			title: `Wishes on their way to ${givenName(recipient)}`,
			text: `A card from the team lands in their inbox on ${button.getAttribute('data-hq-wish-day')} morning.`,
		});
	}

	/* Add employee: the email follows the name until it is edited by hand. */

	function wireAddForm() {
		const nameField = field('name');
		const emailField = field('email');

		nameField.addEventListener('input', () => {
			if (addressTouched) return;
			const words = plainLetters(nameField.value).split(/\s+/).filter(Boolean);
			emailField.value = words.length > 1 ? `${words[0]}.${words.at(-1)}@fieldline.app` : '';
		});
		emailField.addEventListener('input', () => {
			addressTouched = emailField.value !== '';
		});
		createForm.addEventListener('input', (event) => event.target.classList?.remove('is-invalid'));
		createForm.addEventListener('basalt:steps-done', addStarter);

		addSheet.addEventListener('shown.bs.modal', () => nameField.focus());
		addSheet.addEventListener('hidden.bs.modal', () => {
			createForm.basaltSteps?.reset();
			addressTouched = false;
			for (const menu of pickAll('select', createForm)) window.Basalt.select?.refresh?.(menu);
		});
	}

	/**
	 * Adds the starter the wizard collected to Joining and leaving and to
	 * the headcount's "joining" figures, and offers their checklist. Each
	 * step was checked before the wizard let it pass.
	 */
	function addStarter() {
		const person = field('name').value.trim().replace(/\s+/g, ' ');
		const email = field('email').value.trim();
		const role = field('title').value.trim();
		const date = field('start').value;

		const team = field('team').value;
		const region = field('region').value;
		const change = {
			id: `m-new-${Date.now()}`,
			person,
			role,
			team,
			city: region,
			joining: true,
			date,
			contract: field('contract').value,
			manager: field('manager').value,
			buddy: 'Not picked yet',
			tasks: FIRST_TASKS.map(([label, note]) => [label, label === INVITE_TASK ? email : note, false]),
		};
		BOOK.changes.push(change);

		for (const [grouping, group] of Object.entries({ team, region })) {
			const counted = BOOK.headcount[grouping].find((row) => row[0] === group);
			if (counted) counted[2] += 1;
		}

		paintChanges();
		paintHeadcount();
		window.bootstrap.Modal.getOrCreateInstance(addSheet).hide();

		pushToast({
			tone: 'success',
			icon: 'bi-person-plus',
			title: `${givenName(person)} is added`,
			text: `Starts ${dateLabel(date, true)}${field('invite').checked ? ', and their invite is on its way' : ''}. Their checklist is in Joining and leaving.`,
			actions: [{ label: 'Open checklist', onClick: () => showChange(change.id) }],
		});
	}

	function field(name) {
		return createForm.elements[name];
	}

	/* Accents dropped and anything but letters, spaces and hyphens removed,
     so "José Núñez" becomes "jose nunez". */
	function plainLetters(text) {
		return text
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z\s-]/g, '')
			.trim();
	}

	/* Small shared helpers. */

	/* The globe: one point per city the team works in, lit while it is the
	   working day there (weekdays, 9 am to 6 pm local time), turning slowly
	   unless the visitor asks for less motion. The count and the biggest
	   offices beside it follow the real clock, minute by minute. */
	function paintGlobe() {
		const art = pick('[data-hq-globe]');
		if (!art) return;
		const cities = groupByCity();
		const lines = pick('[data-hq-globe-lines]', art);
		const marks = pick('[data-hq-globe-cities]', art);
		const radius = 96;
		const tilt = (20 * Math.PI) / 180;
		const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		let turn = -95;

		for (const city of cities) {
			city.glow = svgNode('circle', { r: 9, class: 'hq-globe-glow' }, marks);
			city.mark = svgNode('circle', { r: Math.min(6, 2.6 + city.people * 0.7), class: 'hq-globe-city' }, marks);
		}

		function place(lat, lon) {
			const phi = (lat * Math.PI) / 180;
			const lambda = ((lon - turn) * Math.PI) / 180;
			const facing = Math.sin(tilt) * Math.sin(phi) + Math.cos(tilt) * Math.cos(phi) * Math.cos(lambda);
			const x = 130 + radius * Math.cos(phi) * Math.sin(lambda);
			const y =
				130 - radius * (Math.cos(tilt) * Math.sin(phi) - Math.sin(tilt) * Math.cos(phi) * Math.cos(lambda));
			return { x, y, facing };
		}

		function trace(points) {
			let d = '';
			let drawing = false;
			for (const [lat, lon] of points) {
				const spot = place(lat, lon);
				if (spot.facing < 0) {
					drawing = false;
					continue;
				}
				d += `${drawing ? 'L' : 'M'}${spot.x.toFixed(1)},${spot.y.toFixed(1)}`;
				drawing = true;
			}
			return d;
		}

		function frame() {
			const paths = [];
			for (let lat = -60; lat <= 60; lat += 30)
				paths.push(trace(Array.from({ length: 73 }, (_, i) => [lat, i * 5 - 180])));
			for (let lon = -180; lon < 180; lon += 30)
				paths.push(trace(Array.from({ length: 37 }, (_, i) => [i * 5 - 90, lon])));
			lines.innerHTML = paths.map((d) => `<path d="${d}" />`).join('');
			for (const city of cities) {
				const spot = place(city.lat, city.lon);
				const shown = spot.facing > 0.04;
				const depth = Math.max(0, spot.facing);
				for (const node of [city.mark, city.glow]) {
					node.setAttribute('cx', spot.x.toFixed(1));
					node.setAttribute('cy', spot.y.toFixed(1));
				}
				city.mark.setAttribute(
					'opacity',
					shown ? (city.working ? 0.55 + depth * 0.45 : 0.25 + depth * 0.25).toFixed(2) : 0,
				);
				city.glow.setAttribute('opacity', shown && city.working ? (depth * 0.6).toFixed(2) : 0);
			}
		}

		function tell() {
			const now = new Date();
			let working = 0;
			for (const city of cities) {
				const clock = localClock(city.tz, now);
				city.working = clock.weekday && clock.hour >= 9 && clock.hour < 18;
				city.time = clock.text;
				if (city.working) working += city.people;
			}
			const total = cities.reduce((sum, city) => sum + city.people, 0);
			pick('[data-hq-globe-working]').textContent = working;
			pick('[data-hq-globe-total]').textContent = total;
			art.setAttribute(
				'aria-label',
				`${working} of ${total} people are in their working day, across ${cities.length} cities`,
			);
			pick('[data-hq-globe-hubs]').innerHTML = [...cities]
				.sort((a, b) => b.people - a.people || a.name.localeCompare(b.name))
				.slice(0, 6)
				.map(
					(city) =>
						`<li class="hq-globe-hub${city.working ? ' is-working' : ''}"><span aria-hidden="true" class="hq-globe-dot"></span><span class="hq-globe-name">${city.name}</span><span class="hq-globe-time">${city.time}</span><span class="hq-globe-people">${city.people} ${city.people === 1 ? 'person' : 'people'}</span></li>`,
				)
				.join('');
			frame();
		}

		tell();
		setInterval(tell, 60000);
		if (still) return;
		let last = performance.now();
		const spin = (now) => {
			turn = (turn + ((now - last) / 1000) * 4.5) % 360;
			last = now;
			frame();
			requestAnimationFrame(spin);
		};
		requestAnimationFrame(spin);
	}

	/** People who have started, gathered by the city they work in. */
	function groupByCity() {
		const counts = new Map();
		for (const person of staff.staff) {
			if (!staff.hasStarted(person)) continue;
			counts.set(person.city, (counts.get(person.city) ?? 0) + 1);
		}
		return [...counts]
			.filter(([name]) => COORDS[name])
			.map(([name, people]) => {
				const [lat, lon] = COORDS[name];
				return { name, people, lat, lon, tz: staff.cities[name]?.tz ?? 'UTC' };
			});
	}

	function localClock(tz, now) {
		const parts = Object.fromEntries(
			new Intl.DateTimeFormat('en-US', {
				timeZone: tz,
				weekday: 'short',
				hour: 'numeric',
				hourCycle: 'h23',
				minute: '2-digit',
			})
				.formatToParts(now)
				.map((part) => [part.type, part.value]),
		);
		const hour = Number(parts.hour);
		const text = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(now);
		return { hour, weekday: !['Sat', 'Sun'].includes(parts.weekday), text };
	}

	function svgNode(name, attributes, parent) {
		const node = document.createElementNS('http://www.w3.org/2000/svg', name);
		for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
		parent.append(node);
		return node;
	}

	function pick(selector, scope = desk) {
		return scope.querySelector(selector);
	}

	function sheet(element) {
		return window.bootstrap.Offcanvas.getOrCreateInstance(element);
	}

	function pushToast(options) {
		return window.Basalt.toasts?.push(options);
	}

	function face(name, size = 'basalt-avatar-sm') {
		return `<span class="basalt-avatar ${size}" data-basalt-avatar data-name="${htmlSafe(name)}" aria-hidden="true"></span>`;
	}

	/** The person's page from the shared roster, or '' when they have none. */
	function recordOf(name) {
		const match = staff.people.find((entry) => staff.nameOf(entry) === name);
		return match ? staff.staffPage(match) : '';
	}

	function recordOr(name) {
		return recordOf(name) || 'employees.html';
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (char) => entities[char]);
	}

	function givenName(full) {
		return String(full).split(' ')[0];
	}

	function spoken(count) {
		return SPOKEN[count] || String(count);
	}

	/** "Fri, Oct 9" by default, "Friday, October 9" when long is set. */
	function dateLabel(isoDate, long) {
		const style = long
			? { weekday: 'long', day: 'numeric', month: 'long' }
			: { weekday: 'short', day: 'numeric', month: 'short' };
		return window.Basalt.toLocalDay(isoDate).toLocaleDateString('en-US', style);
	}

	function workdaysFrom(isoDate, count) {
		const days = [];
		const cursor = window.Basalt.toLocalDay(isoDate);
		while (days.length < count) {
			const weekday = cursor.getDay();
			if (weekday !== 0 && weekday !== 6) days.push(isoOf(cursor));
			cursor.setDate(cursor.getDate() + 1);
		}
		return days;
	}

	function isoOf(date) {
		const pad = (part) => String(part).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	}

	/* DOM lookups, shared by every helper above. */
	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
