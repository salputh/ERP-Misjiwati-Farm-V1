/**
 * The week on John Armstrong's calendar, read by meetings.html,
 * meeting-details.html (opened as ?id=<meeting id>) and video-call.html, so
 * one meeting shows the same hour, guest list, replies, agenda and write-up
 * wherever it appears. Needs assets/basalt/js/data/multipurpose/people.js loaded before it:
 * every invitee comes from that roster with the name and title used there.
 *
 * Publishes window.Basalt.data.meetings with:
 *   NOW       the frozen demo clock, 11:20 on Thursday, October 8, 2026
 *   ME        roster id of whoever is signed in
 *   people    staff who can be invited, keyed by id: [name, job title]
 *   kinds     video, in person and phone, with the words their buttons use
 *   answers   the label and status tone for every kind of reply
 *   meetings  all meetings in time order, earliest first
 * and the helpers recordWithId, nameOf, endOf, stateOf, answerOf, personPage,
 * guestPage and callPage.
 *
 * Wiring a real calendar means building the same records from its feed
 * and letting NOW be new Date().
 */
(() => {
	'use strict';

	const roster = window.Basalt.data.people;
	const NOW = new Date(2026, 9, 8, 11, 20);
	const ME = 'ja';

	/* Anyone on the payroll now or about to join, as [full name, title]. */
	const PEOPLE = Object.fromEntries(roster.staff.map((member) => [member.id, [roster.nameOf(member), member.title]]));

	/* Every kind has its own chart color, set in the page stylesheets. */
	const KINDS = {
		video: {
			icon: 'bi-camera-video',
			label: 'Video call',
			short: 'Join',
			go: 'Join call',
			going: 'Opening the call',
		},
		room: {
			icon: 'bi-geo-alt',
			label: 'In person',
			short: 'Directions',
			go: 'Get directions',
			going: 'Opening the map',
		},
		phone: { icon: 'bi-telephone', label: 'Phone', short: 'Call in', go: 'Call in', going: 'Dialing in' },
	};

	const ANSWERS = Object.fromEntries(
		[
			['yes', 'Going', 'success'],
			['maybe', 'Maybe', 'warning'],
			['no', 'Not going', ''],
			['wait', 'No reply yet', ''],
			['ask', 'Reply needed', 'info'],
			['host', 'Organizer', 'primary'],
		].map(([reply, label, tone]) => [reply, { label, tone }]),
	);

	/* Replies handed out to invitees nobody pinned down; five in eight say yes. */
	const REPLY_POOL = ['yes', 'yes', 'yes', 'yes', 'yes', 'maybe', 'wait', 'no'];

	/*
	 * Field guide for a meeting: by is the organizer and also sits in people,
	 * the staff invited. guests lists customer contacts as [name, company].
	 * reply is John's answer (host when he organized it, otherwise yes, maybe,
	 * no, or ask while he has not replied); said pins down anyone else's.
	 * link points at the customer or project the meeting serves, and rec is
	 * the recording length in minutes. notes is the write-up afterwards:
	 * summary, decisions, steps as [who, task, due, done], and body as HTML.
	 * prep holds what people wrote ahead of time, files what came with the
	 * invite.
	 */
	const SCHEDULE = [
		/* Monday through Wednesday, already over. */
		standup('m01', 5, {
			summary:
				'Wren Abbott and Sloan Kirby start on October 12 and need their laptops before then. Sloan works from Bellingham, so his ships first.',
			decisions: ['John sets up both starter laptops this week'],
			steps: [
				actionItem('ja', 'Ship Sloan’s laptop to Bellingham', 6, true),
				actionItem('ih', 'Send both starters their first-day plan', 7, true),
			],
			body: '<p>Two people start on Monday, October 12: Wren Abbott, an operations analyst here in Evanston, and Sloan Kirby, a platform engineer working from Bellingham.</p><ul><li>Sloan’s laptop goes by courier on Tuesday so it lands before his first day.</li><li>Lance is Wren’s buddy for her first month; Darryl is Sloan’s.</li></ul>',
		}),
		meeting('m02', 'video', 'Midwest data region: hosting contract', 'as', booked(5, '14:00', 60), {
			where: meetLink('midwest-region'),
			people: ['as', 'ja', 'ds', 'pd', 'rd'],
			reply: 'yes',
			rec: 58,
			about: 'Where the Kalamazoo hosting contract stands, and what moves if it slips.',
			link: project('Midwest data region', 'eu'),
			agenda: [
				['What Legal still wants', 15],
				['Security review of the Kalamazoo setup', 20],
				['What moves if it slips', 15],
				['Owners', 10],
			],
			notes: {
				summary:
					'Legal expects the signed hosting contract by October 15. Nothing is built in Kalamazoo until it is signed.',
				decisions: [
					'Nothing is built in Kalamazoo before the contract is signed',
					'If it slips past October 15, the November 6 date moves week for week',
					'Alicia tells the waiting customers if the date moves',
				],
				steps: [
					actionItem('rd', 'Chase Legal for the signed contract', 9, false),
					actionItem('pd', 'Finish the security review of the Kalamazoo setup', 7, true),
					actionItem('ds', 'Price the database copies for the Midwest region', 12, false),
				],
				body: '<h3>The contract</h3><p>Legal has one open point, on where backups are kept. They expect a signed copy by <strong>October 15</strong>.</p><h3>Security review</h3><p>Patrick reviewed the test setup in Kalamazoo. Nothing blocks it; two small firewall changes are already made.</p><h3>If it slips</h3><ul><li>The app running in Kalamazoo on November 6 moves by as many weeks as the contract does.</li><li>The first customer moves stay at the end of November only if the contract is signed by October 15.</li></ul>',
			},
			files: [
				attachment('Kalamazoo hosting contract, draft 4.pdf', 'pdf', '840 KB', 'rd'),
				attachment('Midwest region cost estimate.xlsx', 'sheet', '112 KB', 'ds'),
				attachment('Kalamazoo security review.docx', 'doc', '36 KB', 'pd'),
			],
		}),
		meeting('m03', 'video', 'Single sign-on wrap-up', 'ja', booked(6, '10:00', 45), {
			where: meetLink('sso-wrap-up'),
			people: ['ja', 'pd', 'km', 'pr'],
			reply: 'host',
			about: 'The last people still signing in with a password, and the day passwords switch off.',
			agenda: [
				['Who still uses a password', 15],
				['Contractors', 15],
				['The switch-off date', 15],
			],
			notes: {
				summary:
					'Everyone but Lance Bishop, Gregory Devin and one contractor signs in through Okta. Passwords switch off for staff on November 2.',
				decisions: [
					'Passwords switch off for staff on November 2',
					'Contractors keep a password with two-factor until their contract ends',
					'Support gets a one-page guide for anyone locked out',
				],
				steps: [
					actionItem('ja', 'Move Lance and Gregory to Okta sign-in', 16, false),
					actionItem('pd', 'Add the switch-off date to the security policy', 14, false),
					actionItem('pr', 'Write the locked-out guide for Support', 20, false),
				],
				body: '<p>Okta covers everyone on staff except two people who never moved over: Lance Bishop and Gregory Devin. Gregory also has two-factor off, so he goes first.</p><ul><li>Nina Bledsoe is a contractor and keeps a password with two-factor.</li><li>Staff passwords stop working on November 2.</li></ul>',
			},
			files: [attachment('Sign-in method by person.xlsx', 'sheet', '48 KB', 'ja')],
		}),
		meeting('m04', 'video', 'Portal relaunch weekly', 'dk', booked(6, '16:00', 30), {
			where: meetLink('portal-relaunch'),
			people: ['dk', 'ja', 'gl', 'lo', 'pr'],
			reply: 'maybe',
			about: 'Where the relaunch stands, and the late booking page photos.',
			link: project('Portal relaunch', 'store'),
			agenda: [
				['Self-booking page', 10],
				['Booking page photos', 15],
				['Launch email date', 5],
			],
			notes: {
				summary:
					'The booking photos slipped a week and the self-booking page waits on them. The relaunch email stays on October 27.',
				decisions: [
					'The self-booking page goes live on October 16, with the old photos if the new ones are late',
				],
				steps: [
					actionItem('dk', 'Book the photo shoot again', 7, true),
					actionItem('lo', 'Confirm which plans get self-booking', 9, false),
				],
				body: '<p>Checkout with saved cards went live on October 2 with no problems. The new booking page photos are a week late, and self-booking needs them.</p><ul><li>Lance checks support is staffed for a busy first week.</li><li>Courtney adds self-booking to the new-account checklist.</li></ul>',
			},
			files: [attachment('Self-booking page draft.pdf', 'pdf', '1.2 MB', 'dk')],
		}),
		meeting('m05', 'video', 'Bluepeak Studios: Customer Portal', 'ja', booked(7, '9:00', 45), {
			where: meetLink('bluepeak-portal'),
			people: ['ja', 'lg'],
			guests: [
				['Rachel Beck', 'Bluepeak Studios'],
				['Pamela Rudd', 'Bluepeak Studios'],
			],
			reply: 'host',
			about: 'Rachel’s questions on the Customer Portal before she signs the order form.',
			link: customer('Bluepeak Studios', 'bluepeak'),
			agenda: [
				['What their customers see in the portal', 15],
				['Price for 42 seats', 15],
				['Next steps', 15],
			],
			notes: {
				summary:
					'Rachel is happy with the portal. Pamela approves anything over $2,000, so the order form goes to her before Rachel signs.',
				decisions: ['The order form goes to Pamela first, then to Rachel to sign'],
				steps: [
					actionItem('ja', 'Send the order form to Pamela', 8, true),
					actionItem('lg', 'Send Rachel the portal invoice screens', 9, false),
				],
				body: '<p>Bluepeak’s customers want to book visits and see their invoices without calling the office. The portal does both.</p><ul><li>42 seats at $4 a seat a month comes to $2,016 a year.</li><li>Pamela approves anything over $2,000.</li></ul>',
			},
		}),
		meeting('m06', 'video', 'Software spend review', 'km', booked(7, '15:30', 60), {
			where: meetLink('software-spend'),
			people: ['km', 'ja', 'rd'],
			reply: 'yes',
			canceled: true,
			about: 'Pulled: September’s bills are not all in until Friday.',
			agenda: [
				['Spend by tool, last quarter', 20],
				['Seats nobody uses', 20],
				['What we cancel', 20],
			],
		}),
		meeting('m07', 'video', 'Starter laptops and accounts', 'ja', booked(7, '17:00', 30), {
			where: meetLink('starter-setup'),
			people: ['ja', 'ih', 'ds', 'lo'],
			reply: 'host',
			about: 'Wren and Sloan start on Monday: laptops, accounts and who shows them around.',
			agenda: [
				['Laptops and sign-in', 10],
				['First-day plan', 10],
				['Buddies', 10],
			],
			files: [attachment('New starter checklist.docx', 'doc', '64 KB', 'ih')],
		}),

		/* Thursday morning, before the demo clock. */
		standup('m08', 8, {
			summary:
				'Both starter laptops are ready. The monthly usage report goes out a day late this week because of the seat count.',
			decisions: ['The usage report moves to Tuesday for October only'],
			steps: [
				actionItem('lo', 'Send the October seat counts to Marshall', 9, false),
				actionItem('ja', 'Hand Wren her laptop on Monday morning', 12, false),
			],
			body: '<p>Sloan’s laptop arrived in Bellingham on Wednesday. Wren’s is set up and waiting at the front desk.</p><p>Lance finishes the seat count on Friday, so the report goes out on Tuesday this month.</p>',
		}),
		meeting('m09', 'video', 'Sunvale Studios: pilot crews', 'ja', booked(8, '10:00', 45), {
			where: meetLink('sunvale-pilot'),
			people: ['ja', 'nf', 'gl'],
			guests: [['Ann Lyons', 'Sunvale Studios']],
			reply: 'host',
			rec: 44,
			about: 'How the two pilot crews got on, and what changes before all 15 photographers go live.',
			link: project('Sunvale Studios rollout', 'sunvale'),
			agenda: [
				['How the pilot crews got on', 15],
				['Single sign-on for their office', 15],
				['Go-live on October 19', 15],
			],
			files: [attachment('Sunvale go-live plan.pdf', 'pdf', '1.6 MB', 'nf')],
		}),

		/* The rest of Thursday, from 11:00 on. */
		meeting('m10', 'video', 'Team app 6.5: go or no-go', 'og', booked(8, '11:00', 45), {
			where: meetLink('app-go-no-go'),
			people: ['og', 'ja', 'as', 'th', 'jp', 'fr', 'pr'],
			reply: 'yes',
			about: 'Decide whether version 6.5 of the scheduling app ships to every account on October 14.',
			agenda: [
				['Crash rate on the beta', 10],
				['Open bugs, by severity', 15],
				['Support readiness', 10],
				['Go or no-go', 10],
			],
			prep: '<h3>Crash rate on the beta</h3><p>0.4% of sessions crashed this week, down from 1.1%. All but two crashes were on older Android 11 phones from one maker.</p><h3>Open bugs</h3><ul><li>2 high: duplicate photos after a retry, and a stuck “syncing” badge.</li><li>5 medium, none of them losing data.</li></ul>',
			files: [
				attachment('Team app 6.5 beta report.pdf', 'pdf', '1.1 MB', 'fr'),
				attachment('Open 6.5 bugs.xlsx', 'sheet', '22 KB', 'og'),
			],
		}),
		meeting('m11', 'video', 'Customer Portal: invoice screens', 'lg', booked(8, '14:00', 60), {
			where: meetLink('portal-invoices'),
			people: ['lg', 'ja', 'yt', 'nfe', 'hs'],
			reply: 'yes',
			about: 'Invoices in the portal are due on Friday: a last look before they reach the beta accounts.',
			link: project('Customer Portal redesign', 'portal'),
			agenda: [
				['Invoice list and PDF download', 20],
				['What Bluepeak asked for', 20],
				['Billing questions from Hope', 15],
				['Ship or hold', 5],
			],
			files: [
				attachment('Portal invoice screens.pdf', 'pdf', '3.2 MB', 'nfe'),
				attachment('Invoice test cases.docx', 'doc', '58 KB', 'yt'),
			],
		}),
		meeting('m12', 'video', '1:1 with Kirk', 'ja', booked(8, '16:30', 30), {
			where: meetLink('john-kirk'),
			people: ['ja', 'km'],
			reply: 'host',
			about: 'Weekly one-to-one with Kirk Mathis, head of operations.',
			agenda: [
				['Starter laptops', 10],
				['Software spend', 10],
				['Anything else', 10],
			],
			prep: '<ul><li>The spend review was pulled: when do we hold it instead?</li><li>A spare pool of four laptops, or order one per starter?</li></ul>',
		}),

		/* Friday, October 9. */
		meeting('m13', 'video', 'Q4 operations plan', 'km', booked(9, '9:30', 90), {
			where: meetLink('q4-operations'),
			people: ['km', 'ja', 'ih', 'lo', 'rd', 'rc'],
			reply: 'yes',
			about: 'Cut the operations list for Q4 down to what the team can finish before the year ends.',
			agenda: [
				['Q3 carry-over', 15],
				['Q4 must-haves', 40],
				['What we drop', 25],
				['Owners', 10],
			],
			prep: '<p>Bring your three must-haves for Q4. Kirk wants the list down to about <strong>nine</strong> for the whole team.</p>',
			files: [attachment('Q4 operations candidates.xlsx', 'sheet', '86 KB', 'km')],
		}),
		meeting('m14', 'video', 'Highpoint Outfitters renewal', 'mb', booked(9, '13:00', 45), {
			where: meetLink('highpoint-renewal'),
			people: ['mb', 'ja', 'hs'],
			guests: [
				['Connie Sexton', 'Highpoint Outfitters'],
				['Dan Mercer', 'Highpoint Outfitters'],
			],
			reply: 'ask',
			about: 'The December renewal, 12 seats for the Portsmouth branch and the training quote.',
			link: customer('Highpoint Outfitters', 'highpoint'),
			agenda: [
				['How the year went', 10],
				['Portsmouth: 12 seats from January', 20],
				['Training quote #442', 15],
			],
			prep: '<p>31 seats on Max today. Twelve more for Portsmouth at $58 a seat, billed as ten months a year, add <strong>$6,960 a year</strong>.</p>',
		}),
		meeting('m15', 'phone', 'Payment provider renewal', 'rd', booked(9, '15:00', 30), {
			where: '+1 512 555 0190, PIN 4471',
			people: ['rd', 'ja'],
			reply: 'maybe',
			about: 'New card fees for 2027, and the payments API the Customer Portal is waiting on.',
			agenda: [
				['Fee offer for 2027', 15],
				['Dates for the new payments API', 15],
			],
		}),

		/* Monday, October 12: the first day for both new starters. */
		meeting('m17', 'room', 'Wren’s first morning', 'ja', booked(12, '9:00', 60), {
			where: 'Lakeview room, 3rd floor',
			people: ['ja', 'wa', 'ih', 'lo', 'km'],
			reply: 'host',
			said: { wa: 'yes' },
			about: 'Wren’s laptop and accounts, then Cheryl and her buddy Lance join on screen.',
			agenda: [
				['Introductions', 10],
				['Laptop and sign-in', 20],
				['How operations works here', 20],
				['Questions', 10],
			],
			files: [attachment('Wren’s first two weeks.pdf', 'pdf', '320 KB', 'ih')],
		}),
		meeting('m18', 'video', 'Incident review: sync delay', 'ka', booked(12, '14:00', 45), {
			where: meetLink('incident-1006'),
			people: ['ka', 'ja', 'ds', 'pr', 'as'],
			reply: 'ask',
			about: 'What caused the 40-minute sync delay on October 6, and what changes.',
			agenda: [
				['Timeline', 10],
				['Root cause', 15],
				['What customers saw', 10],
				['Fixes and owners', 10],
			],
			files: [attachment('Incident timeline, October 6.docx', 'doc', '44 KB', 'ka')],
		}),

		/* Tuesday, October 13. */
		meeting('m19', 'video', 'Customer advisory board', 'hw', booked(13, '10:00', 120), {
			where: meetLink('advisory-board'),
			people: ['hw', 'ja', 'ev', 'lm'],
			guests: [
				['Hailey Zimmerman', 'Lumora AI'],
				['Connie Sexton', 'Highpoint Outfitters'],
				['Angela Ashby', 'Millrace Ceramics'],
			],
			reply: 'ask',
			about: 'Eight customers on one call: owners, schedulers and two team leads.',
			agenda: [
				['Travel Planner on their own visits', 60],
				['What we heard', 40],
				['What goes on the Q4 list', 20],
			],
			files: [attachment('Travel Planner pilot results.pptx', 'slides', '4.8 MB', 'hw')],
		}),
		meeting('m20', 'video', 'Laptops for Q4 starters', 'rd', booked(13, '10:30', 45), {
			where: meetLink('q4-laptops'),
			people: ['rd', 'ja', 'ih'],
			reply: 'yes',
			about: 'Laptops for everyone starting before December, and whether to keep a spare pool.',
			agenda: [
				['Starters booked to December', 10],
				['A spare pool of four, or none', 20],
				['Budget', 15],
			],
			files: [attachment('Q4 laptop quote.pdf', 'pdf', '180 KB', 'ja')],
		}),
		meeting('m21', 'video', 'Quarterly access review', 'pd', booked(13, '15:30', 45), {
			where: meetLink('access-review'),
			people: ['pd', 'ja', 'km'],
			reply: 'maybe',
			about: 'Who can open what: admin rights, API keys and the accounts of people who left.',
			agenda: [
				['Admins and billing admins', 15],
				['API keys nobody owns', 15],
				['Leavers', 15],
			],
			prep: '<p>Three people left since July: Patricia Larson, Ace McGee and Tyler Hogan. All three accounts are deactivated. Gerald Pritchard leaves on October 23.</p>',
			files: [attachment('Admin rights by person.xlsx', 'sheet', '40 KB', 'pd')],
		}),

		/* Wednesday, October 14, ending with the all-hands. */
		meeting('m22', 'phone', 'Support escalations review', 'pr', booked(14, '9:00', 30), {
			where: '+1 720 555 0134, PIN 2208',
			people: ['pr', 'ja', 'yh'],
			reply: 'yes',
			about: 'The tickets Support could not close on their own this week.',
			agenda: [
				['Avocet Robotics invoice sync', 10],
				['Lumora AI sign-in loop', 10],
				['Anything new', 10],
			],
		}),
		meeting('m23', 'room', 'Site visit: Millrace Ceramics', 'mb', booked(14, '13:00', 90), {
			where: 'Millrace Ceramics, 1040 W Fulton Market',
			people: ['mb', 'ja'],
			guests: [['Tom Vance', 'Millrace Ceramics']],
			reply: 'yes',
			about: 'Tom’s Travel Planner trial on the North Side, and SMS reminders for clients.',
			link: customer('Millrace Ceramics', 'millrace'),
			agenda: [
				['North Side trial results', 45],
				['Reminder texts for their clients', 30],
				['Questions', 15],
			],
		}),
		allHands('m24', 'rc', '2026-10-14'),
	];

	publish();

	/**
	 * Fills in each meeting's answers map, then hands the calendar and its
	 * helpers to the pages.
	 */
	function publish() {
		for (const entry of SCHEDULE) recordAbsences(entry);
		window.Basalt.data = window.Basalt.data || {};
		window.Basalt.data.meetings = {
			NOW,
			ME,
			people: PEOPLE,
			kinds: KINDS,
			answers: ANSWERS,
			meetings: SCHEDULE,
			recordWithId,
			nameOf,
			endOf,
			stateOf,
			answerOf,
			personPage,
			guestPage,
			callPage,
		};
	}

	/*
	 * Starts from the pinned replies in said, then marks as declined anyone
	 * the roster has away (leave, sick or off) on the meeting's day, except
	 * John and the organizer.
	 */
	function recordAbsences(entry) {
		const isoDay = dayKey(entry.start);
		entry.answers = { ...entry.said };
		for (const invitee of entry.people) {
			const exempt = invitee === ME || invitee === entry.by;
			if (!exempt && roster.awayOn(roster.recordWithId(invitee), isoDay)) entry.answers[invitee] = 'no';
		}
	}

	/* Builders that keep the meeting records short. */

	/** Lays out one meeting record; details carries every other field. */
	function meeting(id, kind, title, by, when, details) {
		return { id, title, kind, ...when, by, ...details };
	}

	/**
	 * A start time in October 2026 plus its length.
	 * @param {number} day   day of the month
	 * @param {string} clock 24-hour "h:mm"
	 * @param {number} mins  length in minutes
	 */
	function booked(day, clock, mins) {
		const [hour, minute] = clock.split(':').map(Number);
		return { start: new Date(2026, 9, day, hour, minute || 0), mins };
	}

	function meetLink(room) {
		return `meet.fieldline.app/${room}`;
	}

	function project(name, id) {
		return { type: 'Project', name, href: `project-details.html?id=${encodeURIComponent(id)}` };
	}

	function customer(name, id) {
		return { type: 'Customer', name, href: `company-details.html?id=${encodeURIComponent(id)}` };
	}

	function attachment(name, type, size, by) {
		return { name, type, size, by };
	}

	/** An action item as [owner, task, ISO due date in October 2026, done]. */
	function actionItem(owner, task, day, done) {
		return [owner, task, `2026-10-${pad(day)}`, done];
	}

	/** The Monday and Thursday operations standup; only the write-up changes. */
	function standup(id, day, notes) {
		return meeting(id, 'video', 'Operations standup', 'km', booked(day, '9:30', 15), {
			where: meetLink('ops-standup'),
			people: ['km', 'ja', 'ih', 'lo'],
			reply: 'yes',
			about: 'What each of us is on this week, then anything stuck.',
			agenda: [
				['This week, person by person', 10],
				['Anything stuck', 5],
			],
			notes,
		});
	}

	/**
	 * The company meeting invites everyone on staff by the given ISO date,
	 * with the host listed first.
	 */
	function allHands(id, host, cutoff) {
		const staffThen = roster.staff.filter((member) => member.start <= cutoff).map((member) => member.id);
		return meeting(id, 'video', 'October all-hands', host, booked(14, '16:00', 60), {
			where: meetLink('all-hands'),
			people: [host, ...staffThen.filter((member) => member !== host)],
			everyone: staffThen.length,
			reply: 'yes',
			about: 'Quarter close, two new starters and the Q4 plan on one slide.',
			agenda: [
				['Quarter close', 15],
				['Welcome, Wren and Sloan', 10],
				['Q4 on one slide', 20],
				['Questions', 15],
			],
			files: [attachment('October all-hands.pptx', 'slides', '6.2 MB', host)],
		});
	}

	/* Lookups the pages call. */

	/** The meeting with this id, or undefined when the calendar has none. */
	function recordWithId(id) {
		return SCHEDULE.find((entry) => entry.id === id);
	}

	/** A staff member's full name; an id missing from the roster comes back as is. */
	function nameOf(id) {
		const row = PEOPLE[id];
		return row ? row[0] : id;
	}

	/** Where a staff member's name links: their account on employee-user-details.html. */
	function personPage(id) {
		return `employee-user-details.html?id=${encodeURIComponent(id)}`;
	}

	/**
	 * Customer contacts live in assets/basalt/js/data/multipurpose/accounts.js under a slug of
	 * their name, so the link is built from the guest's [name, company].
	 */
	function guestPage(guest) {
		return `person-details.html?id=${encodeURIComponent(toSlug(guest[0]))}`;
	}

	/** The moment a meeting finishes, from its start plus its length. */
	function endOf(entry) {
		return new Date(entry.start.getTime() + entry.mins * 60000);
	}

	/** One of canceled, past, live or next, measured against NOW. */
	function stateOf(entry) {
		if (entry.canceled) return 'canceled';
		if (NOW >= endOf(entry)) return 'past';
		return NOW >= entry.start ? 'live' : 'next';
	}

	/*
	 * John reads his own reply (yes when he hosts) and organizers always go.
	 * Others keep any recorded answer; failing that, a hash of meeting id and
	 * person id picks from REPLY_POOL, so the answer never shifts between
	 * reloads or pages.
	 */
	function answerOf(entry, id) {
		if (id === ME) return entry.reply === 'host' ? 'yes' : entry.reply;
		if (id === entry.by) return 'yes';
		const recorded = entry.answers[id];
		if (recorded) return recorded;
		const bucket = `${entry.id}${id}`.split('').reduce((sum, unit) => (sum * 31 + unit.charCodeAt(0)) >>> 0, 0);
		return REPLY_POOL[bucket % REPLY_POOL.length];
	}

	/*
	 * Join opens video-call.html for a video meeting and voice-call.html with
	 * the first teammate on the line for a phone one. An in-person meeting has
	 * nowhere to go, so it gets an empty string.
	 */
	function callPage(entry) {
		const routes = {
			video: () => `video-call.html?id=${encodeURIComponent(entry.id)}`,
			phone: () => {
				const callee = [entry.by, ...entry.people].find((id) => id !== ME && PEOPLE[id]);
				return callee ? `voice-call.html?id=${encodeURIComponent(callee)}` : '';
			},
		};
		return routes[entry.kind]?.() ?? '';
	}

	/* Small formatting helpers. */

	function pad(number) {
		return String(number).padStart(2, '0');
	}

	function dayKey(moment) {
		return `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}`;
	}

	/** Lowercase ASCII with accents stripped and every other run turned into one dash. */
	function toSlug(text) {
		return String(text)
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^0-9a-z]+/g, '-')
			.replace(/^-|-$/g, '');
	}
})();
