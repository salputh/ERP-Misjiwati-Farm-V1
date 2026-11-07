/**
 * Basalt - Schedule (schedule.html)
 * The team calendar for Fieldline: internal meetings, calls with
 * customers, deadlines and time off. Look at a month, a week or a plain
 * list; pick a day to see it in the side panel; open an event for the
 * details; add, edit or delete events in the side sheet.
 *
 * To use your own calendar:
 *   1. Replace TEAM, CUSTOMERS and EVENTS with what your backend
 *      returns. Every grid, list and count is drawn from them.
 *   2. NOW is fixed so the demo always opens on the same busy week.
 *      In a live app use new Date().
 *   3. save() and remove() are where an event reaches the server.
 * The month, week and list are FullCalendar 6 (loaded from assets/vendor by
 * schedule.html), made with window.Basalt.calendar in basalt.js: drag an
 * event to move it, or pull its edge to change the time or days off.
 * Built from shared parts in basalt.js: segmented controls, choice tiles, styled selects, avatars, drawers,
 * toasts and empty states.
 */
(() => {
	'use strict';
	const root = pick('[data-cdr-root]');
	if (!root) return;

	function start() {
		dayToggle.addEventListener('click', () => setDayPanel(layout.classList.contains('is-day-shut'), true));
		let startOpen = true;
		try {
			startOpen = localStorage.getItem('cdr-day-panel') !== 'shut';
		} catch {
			/* storage can be off; the panel starts open */
		}
		setDayPanel(startOpen);
		window
			.matchMedia('(min-width: 1400px)')
			.addEventListener('change', () => setDayPanel(!layout.classList.contains('is-day-shut')));

		fillSelects();
		phoneMonth();
		render();
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(v) {
		return String(v == null ? '' : v).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	/* Demo data */
	const NOW = new Date(2026, 9, 8, 10, 40);

	/* The Fieldline team on this calendar. Keys are the ids on the
     people roster (assets/basalt/js/data/multipurpose/people.js), so a name opens the
     right profile on employee-user-details.html. */
	const TEAM = {
		ja: { name: 'John Armstrong', role: 'IT and systems manager' },
		hb: { name: 'Leslie Ashby', role: 'Customer success manager' },
		mb: { name: 'Quentin Cook', role: 'Account executive' },
		ta: { name: 'Tony Aldridge', role: 'Customer success manager' },
		ev: { name: 'Elise Vick', role: 'Customer success lead' },
		pr: { name: 'Connie Reese', role: 'Support lead' },
		gl: { name: 'Courtney Lowry', role: 'Onboarding specialist' },
		lo: { name: 'Lance Bishop', role: 'Operations analyst' },
		so: { name: 'Rory Beasley', role: 'Backend engineer' },
		og: { name: 'Oliver Merritt', role: 'Product manager, mobile app' },
	};

	/* The customers events can be with, read from the shared accounts
     (assets/basalt/js/data/multipurpose/accounts.js): the same name, plan and seats as
     Companies, and each name opens that company's page. */
	const BOOK = window.Basalt.data.accounts;
	const CUSTOMERS = {};

	for (const id of [
		'lumoraai',
		'oakhaven',
		'avocet',
		'highpoint',
		'moorings',
		'copperleaf',
		'lakeside',
		'alder',
		'brookside',
		'coastline',
		'sunvale',
	]) {
		const a = BOOK.find(id);
		CUSTOMERS[id] = {
			name: a.name,
			plan: `${BOOK.plans[a.plan].name + (a.status === 'trial' ? ' trial, ' : ', ') + a.seats} seats`,
		};
	}

	const TYPES = {
		meeting: { label: 'Meeting', plural: 'Meetings' },
		customer: { label: 'Customer call', plural: 'Customer calls' },
		deadline: { label: 'Deadline', plural: 'Deadlines' },
		away: { label: 'Time off', plural: 'Time off' },
	};

	/* Each event: d = [month (0-based), day]; timed events have from/to as
     "HH:MM"; deadlines and time off are all day, time off over `days`. */
	const RAW = [
		{
			d: [8, 29],
			t: 'meeting',
			title: 'Q3 wrap-up',
			from: '15:00',
			to: '16:00',
			where: 'Video call',
			people: ['ja', 'hb', 'pr', 'gl'],
			note: 'What went well this quarter, and what we carry into Q4.',
		},
		{
			d: [8, 30],
			t: 'deadline',
			title: 'Q3 close',
			people: ['ja'],
			note: 'All September invoices sent and payments matched before the books close.',
			link: { href: 'invoices.html', label: 'Open invoices' },
		},
		{
			d: [9, 1],
			t: 'meeting',
			title: 'Ops standup',
			from: '09:30',
			to: '10:00',
			where: 'Video call',
			people: ['ja', 'hb', 'pr', 'gl', 'lo'],
			note: 'Ten minutes each Thursday: what is blocked, and who needs a hand.',
		},
		{
			d: [9, 1],
			t: 'customer',
			title: 'Coastline welcome',
			from: '14:00',
			to: '15:00',
			where: 'Video call',
			customer: 'coastline',
			people: ['hb', 'gl'],
			note: 'Set up Ray Downing’s workspace and the first week of visits. The trial ends on October 15.',
		},
		{
			d: [9, 1],
			t: 'customer',
			title: 'Oakhaven portal demo',
			from: '16:00',
			to: '16:45',
			where: 'Video call',
			customer: 'oakhaven',
			people: ['mb'],
			note: 'Show the Customer Portal to Lindsay Kinney’s care team, then price it for both branches.',
		},
		{
			d: [9, 2],
			t: 'customer',
			title: 'Sunvale sign-on',
			from: '11:00',
			to: '11:45',
			where: 'Video call',
			customer: 'sunvale',
			people: ['ja'],
			note: 'Set up single sign-on testing with Ann Lyons before their security review.',
		},
		{
			d: [9, 5],
			t: 'meeting',
			title: 'Q4 planning',
			from: '10:00',
			to: '11:00',
			where: 'Room 2, Evanston office',
			people: ['ja', 'hb', 'pr', 'so'],
			note: 'Agree the three things we ship before the end of the year.',
		},
		{
			d: [9, 5],
			t: 'customer',
			title: 'Alder welcome',
			from: '15:00',
			to: '15:45',
			where: 'Video call',
			customer: 'alder',
			people: ['ev'],
			note: 'Welcome call with Conor Alder to set up nine seats. The trial ends on October 19.',
		},
		{
			d: [9, 6],
			t: 'customer',
			title: 'Highpoint renewal plan',
			from: '13:00',
			to: '14:00',
			where: 'Video call',
			customer: 'highpoint',
			people: ['ja'],
			note: 'Plan the December renewal with Connie Sexton, and a price for 12 more seats once Portsmouth opens.',
		},
		{
			d: [9, 6],
			t: 'deadline',
			title: 'Payroll export',
			people: ['ja'],
			note: 'September hours exported to the accounting system.',
		},
		{
			d: [9, 7],
			t: 'meeting',
			title: '1:1 with Connie',
			from: '09:00',
			to: '09:30',
			where: 'Video call',
			people: ['ja', 'pr'],
			note: 'Support hiring, and the winter cover roster.',
		},
		{
			d: [9, 7],
			t: 'meeting',
			title: 'Support review',
			from: '16:00',
			to: '17:00',
			where: 'Video call',
			people: ['pr', 'ja', 'gl'],
			note: 'September tickets: 612 solved, first reply in 38 minutes on average.',
		},
		{
			d: [9, 8],
			t: 'meeting',
			title: 'Ops standup',
			from: '09:30',
			to: '10:00',
			where: 'Video call',
			people: ['ja', 'hb', 'pr', 'gl', 'lo'],
			note: 'Ten minutes each Thursday: what is blocked, and who needs a hand.',
		},
		{
			d: [9, 8],
			t: 'customer',
			title: 'Lumora AI renewal',
			from: '11:00',
			to: '12:00',
			where: 'Video call',
			customer: 'lumoraai',
			people: ['hb', 'ja'],
			note: 'Go through renewal quote #437 with Carla Malone: 94 Max seats from November 2, eight more than today.',
		},
		{
			d: [9, 8],
			t: 'meeting',
			title: 'Support interview',
			from: '14:00',
			to: '14:45',
			where: 'Video call',
			people: ['pr', 'ja'],
			note: 'Second interview for the support specialist role, Spanish and English.',
		},
		{
			d: [9, 8],
			t: 'deadline',
			title: 'Training slots',
			people: ['lo'],
			note: 'Open more training slots today: Highpoint Outfitters’s team took the last four places.',
			link: { href: 'meetings.html', label: 'Open meetings' },
		},
		{
			d: [9, 9],
			t: 'customer',
			title: 'Brookside billing',
			from: '10:00',
			to: '10:30',
			where: 'Video call',
			customer: 'brookside',
			people: ['hb'],
			note: 'Forrest Decker wants yearly billing before his trial ends on October 13.',
		},
		{ d: [9, 9], t: 'away', title: 'Tony off', people: ['ta'], note: 'Moving house. Leslie covers his accounts.' },
		{
			d: [9, 12],
			t: 'meeting',
			title: 'Portal review',
			from: '10:00',
			to: '10:45',
			where: 'Video call',
			people: ['so', 'ja', 'pr'],
			note: 'Last look at the Customer Portal release notes and the help articles.',
			link: { href: 'project-details.html', label: 'Open the project' },
		},
		{
			d: [9, 12],
			t: 'customer',
			title: 'Copperleaf payment',
			from: '15:00',
			to: '15:30',
			where: 'Video call',
			customer: 'copperleaf',
			people: ['ta'],
			note: 'Gail Lowe pays the overdue renewal, #904, by bank transfer. Send her the details.',
		},
		{
			d: [9, 13],
			t: 'deadline',
			title: 'Portal release',
			people: ['so'],
			note: 'Customer Portal 3.2 goes out to every account at 6:00 am.',
			link: { href: 'project-details.html', label: 'Open the project' },
		},
		{
			d: [9, 13],
			t: 'customer',
			title: 'Sunvale security review',
			from: '11:00',
			to: '12:00',
			where: 'Video call',
			customer: 'sunvale',
			people: ['ja'],
			note: 'Security review with Ann Lyons and their IT team. The trial ends the next day.',
		},
		{
			d: [9, 13],
			t: 'customer',
			title: 'Live training',
			from: '14:00',
			to: '15:00',
			where: 'Webinar room',
			people: ['gl', 'hb'],
			note: 'Travel Planner webinar for schedulers. 38 customers registered; the recording goes to everyone.',
		},
		{
			d: [9, 14],
			t: 'customer',
			title: 'Avocet proposal',
			from: '11:00',
			to: '11:45',
			where: 'Video call',
			customer: 'avocet',
			people: ['ta'],
			note: 'Go through the Max proposal with Addison Brennan and answer her question on how long visit photos are kept.',
		},
		{
			d: [9, 15],
			t: 'meeting',
			title: 'Ops standup',
			from: '09:30',
			to: '10:00',
			where: 'Video call',
			people: ['ja', 'hb', 'pr', 'gl', 'lo'],
			note: 'Ten minutes each Thursday: what is blocked, and who needs a hand.',
		},
		{
			d: [9, 15],
			t: 'meeting',
			title: 'All-hands',
			from: '13:00',
			to: '14:00',
			where: 'Main room, Evanston office',
			people: ['ja', 'hb', 'mb', 'ta', 'ev', 'pr', 'gl', 'lo', 'so', 'og'],
			note: 'Q3 results, the Q4 plan and two new starters.',
		},
		{
			d: [9, 16],
			t: 'customer',
			title: 'Moorings SMS credits',
			from: '10:00',
			to: '11:00',
			where: 'Video call',
			customer: 'moorings',
			people: ['ja'],
			note: 'Show Denise Quigley the missed-visit numbers behind the quote for 10,000 SMS credits a month.',
		},
		{
			d: [9, 19],
			t: 'away',
			title: 'Oliver on leave',
			days: 5,
			people: ['og'],
			note: 'Back on Monday, October 26. Leslie Whitlock covers the mobile app.',
		},
		{
			d: [9, 20],
			t: 'customer',
			title: 'Highpoint new seats',
			from: '15:00',
			to: '16:00',
			where: 'Video call',
			customer: 'highpoint',
			people: ['ja', 'mb'],
			note: 'Dan Mercer signs off quote #442 for 12 Portsmouth staff seats by the 22nd.',
		},
		{
			d: [9, 22],
			t: 'meeting',
			title: 'Ops standup',
			from: '09:30',
			to: '10:00',
			where: 'Video call',
			people: ['ja', 'hb', 'pr', 'gl', 'lo'],
			note: 'Ten minutes each Thursday: what is blocked, and who needs a hand.',
		},
		{
			d: [9, 22],
			t: 'meeting',
			title: 'Add-on pricing',
			from: '10:30',
			to: '11:30',
			where: 'Room 2, Evanston office',
			people: ['ja', 'mb'],
			note: 'Travel Planner and SMS credits prices for 2027.',
		},
		{
			d: [9, 23],
			t: 'deadline',
			title: 'Q3 board pack',
			people: ['ja'],
			note: 'Revenue, churn and hiring for the board meeting on October 28.',
			link: { href: 'reports.html', label: 'Open reports' },
		},
		{
			d: [9, 26],
			t: 'customer',
			title: 'Lumora AI visit',
			from: '09:00',
			to: '15:00',
			where: 'Lumora AI, Aurora office',
			customer: 'lumoraai',
			people: ['hb', 'gl'],
			note: 'Train the eight new carers in person before the renewal starts on November 2.',
		},
		{
			d: [9, 27],
			t: 'meeting',
			title: '1:1 with Leslie',
			from: '14:00',
			to: '14:30',
			where: 'Video call',
			people: ['ja', 'hb'],
			note: 'Renewals pipeline for November.',
		},
		{
			d: [9, 29],
			t: 'meeting',
			title: 'Ops standup',
			from: '09:30',
			to: '10:00',
			where: 'Video call',
			people: ['ja', 'hb', 'pr', 'gl', 'lo'],
			note: 'Ten minutes each Thursday: what is blocked, and who needs a hand.',
		},
		{
			d: [9, 29],
			t: 'customer',
			title: 'Lakeside check-in',
			from: '15:00',
			to: '15:45',
			where: 'Video call',
			customer: 'lakeside',
			people: ['hb'],
			note: 'Quarterly health check with Mae Morrow: 29 of 30 seats used every week.',
		},
		{
			d: [9, 30],
			t: 'deadline',
			title: 'Month-end close',
			people: ['ja'],
			note: 'October invoices sent and the books closed.',
			link: { href: 'invoices.html', label: 'Open invoices' },
		},
		{
			d: [10, 2],
			t: 'meeting',
			title: 'November planning',
			from: '10:00',
			to: '11:00',
			where: 'Video call',
			people: ['ja', 'hb', 'pr'],
			note: 'Renewals, the support roster and the December freeze.',
		},
		{
			d: [10, 3],
			t: 'customer',
			title: 'Oakhaven branch call',
			from: '11:00',
			to: '12:00',
			where: 'Video call',
			customer: 'oakhaven',
			people: ['mb'],
			note: 'Todd Bishop on the second branch: more seats and the Customer Portal for Plattsburgh.',
		},
		{
			d: [10, 5],
			t: 'meeting',
			title: 'Ops standup',
			from: '09:30',
			to: '10:00',
			where: 'Video call',
			people: ['ja', 'hb', 'pr', 'gl', 'lo'],
			note: 'Ten minutes each Thursday: what is blocked, and who needs a hand.',
		},
		{
			d: [10, 6],
			t: 'deadline',
			title: 'SMS pack forecast',
			people: ['lo'],
			note: 'Forecast SMS credit packs before the holiday reminders start.',
			link: { href: 'reports.html', label: 'Open reports' },
		},
		{
			d: [10, 12],
			t: 'meeting',
			title: 'Ops standup',
			from: '09:30',
			to: '10:00',
			where: 'Video call',
			people: ['ja', 'hb', 'pr', 'gl', 'lo'],
			note: 'Ten minutes each Thursday: what is blocked, and who needs a hand.',
		},
	];

	let seq = 0;

	function freshId() {
		return `ev-${(4100 + ++seq * 7).toString(16)}`;
	}

	function toMin(hhmm) {
		const [h, m] = hhmm.split(':').map(Number);
		return h * 60 + m;
	}

	function allDay(t) {
		return t === 'deadline' || t === 'away';
	}

	const EVENTS = RAW.map((r) => ({
		id: freshId(),
		type: r.t,
		title: r.title,
		date: new Date(2026, r.d[0], r.d[1]),
		days: r.days || 1,
		from: r.from || null,
		to: r.to || null,
		where: r.where || '',
		customer: r.customer || '',
		people: r.people || [],
		note: r.note || '',
		link: r.link || null,
	}));

	/* Dates */
	const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const MON_LONG = [
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

	function dayOnly(d) {
		return new Date(d.getFullYear(), d.getMonth(), d.getDate());
	}

	function shiftDays(d, n) {
		return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
	}

	function same(a, b) {
		return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
	}

	function iso(d) {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function fromIso(s) {
		const [y, m, d] = s.split('-').map(Number);
		return new Date(y, m - 1, d);
	}

	function mondayOf(d) {
		return shiftDays(dayOnly(d), -((d.getDay() + 6) % 7));
	}

	const TODAY = dayOnly(NOW);

	function shortDate(d) {
		return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
	}

	function longDate(d) {
		return `${DOW_LONG[d.getDay()]}, ${MON_LONG[d.getMonth()]} ${d.getDate()}`;
	}

	function clock(hhmm) {
		const [h, m] = hhmm.split(':').map(Number);
		return `${(h % 12 || 12) + (m ? `:${String(m).padStart(2, '0')}` : '')} ${h < 12 ? 'am' : 'pm'}`;
	}

	function span(e) {
		return `${clock(e.from)} to ${clock(e.to)}`;
	}

	function finalDay(e) {
		return shiftDays(e.date, e.days - 1);
	}
	function whenText(e) {
		if (e.type === 'away' && e.days > 1) return `${shortDate(e.date)} to ${shortDate(finalDay(e))}`;
		if (allDay(e.type)) return `${longDate(e.date)}, all day`;
		return `${longDate(e.date)}, ${span(e)}`;
	}
	function inDays(d) {
		const n = Math.round((dayOnly(d) - TODAY) / 86400000);
		if (n === 0) return 'Today';
		if (n === 1) return 'Tomorrow';
		return `In ${n} days`;
	}

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many}`;
	}

	/* State */
	const state = {
		view: 'month',
		anchor: new Date(TODAY),
		picked: new Date(TODAY),
		hidden: new Set(),
		editing: null,
	};

	function visible() {
		return EVENTS.filter((e) => !state.hidden.has(e.type));
	}

	function covers(e, d) {
		const day = dayOnly(d);
		return day >= e.date && day <= finalDay(e);
	}
	function on(d, list) {
		return (list || visible())
			.filter((e) => covers(e, d))
			.sort((a, b) => {
				if (allDay(a.type) !== allDay(b.type)) return allDay(a.type) ? -1 : 1;
				return (a.from ? toMin(a.from) : 0) - (b.from ? toMin(b.from) : 0);
			});
	}
	function who(e) {
		const names = e.people.map((p) => TEAM[p] && TEAM[p].name.split(' ')[0]).filter(Boolean);
		if (names.length <= 2) return names.join(' and ');
		return `${names.slice(0, 2).join(', ')} and ${plural(names.length - 2, 'other', 'others')}`;
	}
	function metaLine(e) {
		const bits = [];
		if (e.customer && CUSTOMERS[e.customer]) bits.push(CUSTOMERS[e.customer].name);
		else if (e.where && !allDay(e.type)) bits.push(e.where);
		if (e.people.length) bits.push(who(e));
		return bits.join(' · ');
	}
	/* The day panel shows who is in it as faces, up to three and a "+N". */
	const FACES = 3;
	function faces(e) {
		const names = e.people.map((p) => TEAM[p] && TEAM[p].name).filter(Boolean);
		if (!names.length) return '';
		const extra = names.length - FACES;
		return `<span class="basalt-avatar-group basalt-avatar-group-sm cdr-slot-faces" aria-hidden="true">${names
			.slice(0, FACES)
			.map(
				(n) =>
					`<span class="basalt-avatar basalt-avatar-xs" data-basalt-avatar data-name="${htmlSafe(n)}"></span>`,
			)
			.join(
				'',
			)}${extra > 0 ? `<span class="basalt-avatar basalt-avatar-xs basalt-avatar-more">+${extra}</span>` : ''}</span><span class="visually-hidden">${htmlSafe(who(e))}</span>`;
	}
	function placeLine(e) {
		if (e.customer && CUSTOMERS[e.customer]) return CUSTOMERS[e.customer].name;
		return e.where && !allDay(e.type) ? e.where : '';
	}

	const MAX_IN_CELL = 3;

	/* The calendar: FullCalendar
	   Month, week and list are FullCalendar views (made with
	   window.Basalt.calendar in basalt.js; the look is in basalt.css and
	   schedule.css). The toolbar above it is this page's own. */
	const VIEWS = { month: 'dayGridMonth', week: 'timeGridWeek', list: 'listMonth' };
	const TONES = { meeting: 1, customer: 3, deadline: 6, away: 5 };
	const FIRST_HOUR = 8;
	const LAST_HOUR = 19;

	function isoTime(d, hhmm) {
		return `${iso(d)}T${hhmm}`;
	}

	function hhmm(d) {
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	const phone = window.matchMedia('(max-width: 575.98px)');

	function toFc(e) {
		/* Titles keep their hyphens (non-breaking), so "check-in" never splits. */
		const base = {
			id: e.id,
			title: e.title.replace(/-/g, '\u2011'),
			classNames: [`basalt-fc-tone-${TONES[e.type]}`, `cdr-tone-${e.type}`],
		};
		if (allDay(e.type)) {
			return Object.assign(base, {
				start: iso(e.date),
				end: iso(shiftDays(e.date, e.days)),
				allDay: true,
				durationEditable: e.type === 'away',
			});
		}
		return Object.assign(base, { start: isoTime(e.date, e.from), end: isoTime(e.date, e.to) });
	}

	const emptyTpl = pick('[data-cdr-list-empty]', root);
	const fcHost = pick('[data-cdr-fc]', root);
	const cal = window.Basalt.calendar(fcHost, {
		initialView: VIEWS.month,
		initialDate: iso(TODAY),
		now: isoTime(TODAY, hhmm(NOW)),
		headerToolbar: false,
		fixedWeekCount: false,
		events: (info, ok) => ok(visible().map(toFc)),
		editable: true,
		/* In the week, timed events stay timed and all-day ones stay all day. */
		eventAllow: (drop, ev) => cal.view.type !== VIEWS.week || drop.allDay === ev.allDay,
		dayMaxEvents: MAX_IN_CELL,
		slotMinTime: `${String(FIRST_HOUR).padStart(2, '0')}:00:00`,
		slotMaxTime: `${LAST_HOUR}:00:00`,
		listDayFormat: { weekday: 'short', month: 'short', day: 'numeric' },
		listDaySideFormat: false,
		views: {
			dayGridMonth: { displayEventTime: false, dayHeaderFormat: { weekday: 'short' } },
			timeGridWeek: {
				dayHeaderContent: (arg) => ({
					html: `<span class="cdr-week-dow">${DOW[arg.date.getDay()]}</span><span class="cdr-week-num">${arg.date.getDate()}</span>`,
				}),
			},
		},
		noEventsContent: () => ({ html: emptyTpl.innerHTML }),
		dayCellClassNames: (arg) => (same(arg.date, state.picked) ? ['is-picked'] : []),
		/* The list shows where and who under each title. */
		eventContent: (arg) => {
			const e = EVENTS.find((x) => x.id === arg.event.id);
			if (!e) return true;
			/* The week: the title first, then the time when there is room. */
			if (arg.view.type === VIEWS.week && !arg.event.allDay) {
				const short = toMin(e.to) - toMin(e.from) < 60;
				return {
					html: `<span class="cdr-block${short ? ' is-short' : ''}"><strong>${htmlSafe(e.title)}</strong><span>${span(e)}</span></span>`,
				};
			}
			if (arg.view.type !== VIEWS.list) return true;
			return {
				html: `<span class="cdr-row-title">${htmlSafe(e.title)}</span><span class="cdr-row-meta">${htmlSafe(metaLine(e))}</span>`,
			};
		},
		eventDidMount: (arg) => {
			const e = EVENTS.find((x) => x.id === arg.event.id);
			if (!e) return;
			arg.el.setAttribute(
				'aria-label',
				`${e.title}, ${TYPES[e.type].label.toLowerCase()}${e.from ? `, ${span(e)}` : ''}`,
			);
		},
		eventClick: (arg) => {
			arg.jsEvent.preventDefault();
			openEvent(arg.event.id);
		},
		dateClick: (arg) => chooseDay(iso(arg.date)),
		moreLinkClick: (arg) => {
			chooseDay(iso(arg.date));
			if (window.matchMedia('(max-width: 1399.98px)').matches)
				pick('.cdr-day', root).scrollIntoView({ behavior: 'smooth', block: 'start' });
			return true;
		},
		/* The "+2 more" link opens a popover and carries aria-expanded, so it reads as a button. */
		moreLinkDidMount: (arg) => arg.el.setAttribute('role', 'button'),
		datesSet: () => paintDots(),
		eventDrop: moved,
		eventResize: moved,
	});

	/* Drag and resize: the new day, times or days off go back to EVENTS. */
	function moved(arg) {
		const e = EVENTS.find((x) => x.id === arg.event.id);
		if (!e) return;
		const before = { date: e.date, from: e.from, to: e.to, days: e.days };
		const ev = arg.event;
		e.date = dayOnly(ev.start);
		if (allDay(e.type)) {
			e.days = ev.end ? Math.max(1, Math.round((dayOnly(ev.end) - e.date) / 86400000)) : 1;
		} else {
			e.from = hhmm(ev.start);
			e.to = hhmm(ev.end || new Date(ev.start.getTime() + (toMin(before.to) - toMin(before.from)) * 60000));
		}
		state.picked = new Date(e.date);
		render();
		toast({
			tone: 'success',
			title: arg.endDelta && !arg.delta ? 'Event changed' : 'Event moved',
			text: `${e.title}, ${whenText(e)}.`,
			duration: 4000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						Object.assign(e, before);
						render();
					},
				},
			],
		});
	}

	/* A phone has no room for titles: each day shows a dot per event, and
     the day panel underneath lists them. */
	function paintDots() {
		for (const cell of pickAll('.fc-daygrid-day[data-date]', fcHost)) {
			let dots = pick('.cdr-cell-dots', cell);
			const top = pick('.fc-daygrid-day-top', cell);
			if (!phone.matches || !top) {
				if (dots) dots.remove();
				continue;
			}
			if (!dots) {
				dots = document.createElement('span');
				dots.className = 'cdr-cell-dots';
				dots.setAttribute('aria-hidden', 'true');
				top.after(dots);
			}
			dots.innerHTML = on(fromIso(cell.getAttribute('data-date')))
				.slice(0, 4)
				.map((e) => `<span class="cdr-dot cdr-tone-${e.type}"></span>`)
				.join('');
		}
	}
	function phoneMonth() {
		const want = phone.matches && state.view === 'month' ? 'none' : 'auto';
		if (cal.getOption('eventDisplay') !== want) cal.setOption('eventDisplay', want);
		paintDots();
	}
	phone.addEventListener('change', phoneMonth);

	function paintBoard() {
		const view = VIEWS[state.view];
		root.setAttribute('data-cdr-view', state.view);
		if (cal.view.type !== view) cal.changeView(view, state.anchor);
		else cal.gotoDate(state.anchor);
		phoneMonth();
		cal.refetchEvents();

		/* The picked day's tint. */
		for (const c of pickAll('.fc-daygrid-day[data-date]', fcHost)) {
			c.classList.toggle('is-picked', c.getAttribute('data-date') === iso(state.picked));
		}

		paintDots();
		const y = state.anchor.getFullYear();
		const m = state.anchor.getMonth();
		if (state.view === 'week') {
			const start = mondayOf(state.anchor);
			const end = shiftDays(start, 6);
			pick('[data-cdr-label]', root).textContent =
				start.getMonth() === end.getMonth()
					? `${MON[start.getMonth()]} ${start.getDate()} to ${end.getDate()}`
					: `${MON[start.getMonth()]} ${start.getDate()} to ${MON[end.getMonth()]} ${end.getDate()}`;
		} else {
			pick('[data-cdr-label]', root).textContent = `${MON_LONG[m]} ${y}`;
		}
	}

	/* Day panel */
	function paintDay() {
		const d = state.picked;
		const evs = on(d);

		function n(t) {
			return evs.filter((e) => allDay(e.type) === t).length;
		}

		const timed = n(false);
		const whole = evs.filter((e) => e.type === 'deadline').length;
		const off = evs.filter((e) => e.type === 'away').length;
		const parts = [];
		if (timed) parts.push(plural(timed, 'event', 'events'));
		if (whole) parts.push(plural(whole, 'deadline', 'deadlines'));
		if (off) parts.push(`${plural(off, 'person', 'people')} off`);
		const diff = Math.round((d - TODAY) / 86400000);
		pick('[data-cdr-day-eyebrow]', root).textContent =
			diff === 0
				? 'Today'
				: diff === 1
					? 'Tomorrow'
					: diff === -1
						? 'Yesterday'
						: `${MON_LONG[d.getMonth()]} ${d.getFullYear()}`;
		pick('[data-cdr-day-title]', root).textContent = longDate(d);
		pick('[data-cdr-day-desc]', root).textContent = parts.length
			? parts.join(', ').replace(/, ([^,]*)$/, ' and $1')
			: 'Nothing booked yet.';
		pick('[data-cdr-day-add-label]', root).textContent = `Add to ${MON[d.getMonth()]} ${d.getDate()}`;

		let html = '';
		let nowShown = !same(d, TODAY);
		evs.forEach((e) => {
			const startMin = e.from ? toMin(e.from) : -1;
			const nowMin = NOW.getHours() * 60 + NOW.getMinutes();
			if (!nowShown && startMin > nowMin) {
				html += `<li class="cdr-agenda-now">Now, ${clock(`${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}`)}</li>`;
				nowShown = true;
			}
			const past = (same(d, TODAY) && e.to && toMin(e.to) <= nowMin) || dayOnly(d) < TODAY;
			const time = allDay(e.type)
				? `All day<span>${TYPES[e.type].label}</span>`
				: `${clock(e.from)}<span>${clock(e.to)}</span>`;
			html += `<li><button type="button" class="cdr-slot cdr-tone-${e.type}${past ? ' is-past' : ''}" data-cdr-open="${e.id}"><span class="cdr-slot-time">${time}</span><span class="cdr-slot-body"><span class="cdr-slot-title">${htmlSafe(e.title)}</span>${placeLine(e) ? `<span class="cdr-slot-meta">${htmlSafe(placeLine(e))}</span>` : ''}${faces(e)}</span></button></li>`;
		});
		if (!evs.length)
			html = '<li><p class="cdr-agenda-free">A free day. Add a meeting, a call or a deadline.</p></li>';
		const agenda = pick('[data-cdr-day-list]', root);
		agenda.innerHTML = html;
		if (window.Basalt.avatars) window.Basalt.avatars(agenda);
	}

	function paintDue() {
		const due = visible()
			.filter((e) => e.type === 'deadline' && e.date > TODAY)
			.sort((a, b) => a.date - b.date)
			.slice(0, 3);
		pick('[data-cdr-due]', root).innerHTML = due.length
			? due
					.map(
						(e) =>
							`<li><button type="button" class="cdr-due-item" data-cdr-open="${e.id}"><span><span class="cdr-due-title">${htmlSafe(e.title)}</span><span class="cdr-due-date">${shortDate(e.date)}</span></span><span class="cdr-due-left">${inDays(e.date)}</span></button></li>`,
					)
					.join('')
			: '<li><p class="cdr-agenda-free">No deadlines coming up.</p></li>';
	}

	function render() {
		paintBoard();
		const unit = state.view === 'week' ? 'week' : 'month';
		pick('[data-cdr-step="-1"]', root).setAttribute('aria-label', `Previous ${unit}`);
		pick('[data-cdr-step="1"]', root).setAttribute('aria-label', `Next ${unit}`);
		paintDay();
		paintDue();
	}

	/* Event drawer */
	const evDrawer = document.getElementById('cdr-event');
	const formDrawer = document.getElementById('cdr-form');

	function ev(k) {
		return pick(`[data-cdr-ev="${k}"]`, evDrawer);
	}

	let shownId = null;

	function openEvent(id) {
		const e = EVENTS.find((x) => x.id === id);
		if (!e) return;
		shownId = id;
		ev('title').textContent = e.title;
		ev('when').textContent = whenText(e);
		const facts = [];
		if (!allDay(e.type)) {
			const mins = toMin(e.to) - toMin(e.from);
			const len = mins >= 60 ? mins / 60 + (mins === 60 ? ' hour' : ' hours') : `${mins} minutes`;
			facts.push(
				`<li><i class="bi bi-clock" aria-hidden="true"></i><span>${span(e)}<small>${len}</small></span></li>`,
			);
		}
		if (e.where && !allDay(e.type))
			facts.push(`<li><i class="bi bi-geo-alt" aria-hidden="true"></i><span>${htmlSafe(e.where)}</span></li>`);
		if (e.customer && CUSTOMERS[e.customer]) {
			const c = CUSTOMERS[e.customer];
			facts.push(
				`<li><i class="bi bi-building" aria-hidden="true"></i><span><a href="company-details.html?id=${encodeURIComponent(e.customer)}">${htmlSafe(c.name)}</a><small>${htmlSafe(c.plan)}</small></span></li>`,
			);
		}
		if (e.link)
			facts.push(
				`<li><i class="bi bi-box-arrow-up-right" aria-hidden="true"></i><span><a href="${htmlSafe(e.link.href)}">${htmlSafe(e.link.label)}</a></span></li>`,
			);

		const peopleHead = e.type === 'away' ? 'Who is off' : e.type === 'deadline' ? 'Owner' : 'People';
		const people = e.people
			.filter((p) => TEAM[p])
			.map((p) => {
				const u = TEAM[p];
				return `<li><span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(u.name)}" aria-hidden="true"></span><span><a href="employee-user-details.html?id=${encodeURIComponent(p)}"><strong>${htmlSafe(u.name)}</strong></a><small>${htmlSafe(u.role)}</small></span></li>`;
			})
			.join('');

		ev('body').innerHTML =
			`<div class="basalt-drawer-section"><span class="cdr-pill cdr-tone-${e.type}"><span class="cdr-dot" aria-hidden="true"></span>${TYPES[e.type].label}</span>${facts.length ? `<ul class="cdr-facts">${facts.join('')}</ul>` : ''}</div>${people ? `<section class="basalt-drawer-section"><h3 class="cdr-section-title">${peopleHead}</h3><ul class="cdr-people">${people}</ul></section>` : ''}${e.note ? `<section class="basalt-drawer-section"><h3 class="cdr-section-title">Notes</h3><p class="cdr-note">${htmlSafe(e.note)}</p></section>` : ''}`;
		if (window.Basalt.avatars) window.Basalt.avatars(evDrawer);
		bootstrap.Offcanvas.getOrCreateInstance(evDrawer).show();
	}

	/* New and edit */
	const form = pick('[data-cdr-form]', formDrawer);

	function f(name) {
		return form.elements[name];
	}

	function fillSelects() {
		f('people').innerHTML = Object.keys(TEAM)
			.map((k) => `<option value="${k}">${htmlSafe(TEAM[k].name)}</option>`)
			.join('');
		f('customer').innerHTML = `<option value="">No customer</option>${Object.keys(CUSTOMERS)
			.map((k) => `<option value="${k}">${htmlSafe(CUSTOMERS[k].name)}</option>`)
			.join('')}`;
	}
	function setMulti(sel, values) {
		for (const o of Array.from(sel.options)) {
			o.selected = values.indexOf(o.value) > -1;
		}

		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(sel);
	}
	function setValue(sel, value) {
		sel.value = value;
		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(sel);
	}

	function syncType() {
		const t = pick('input[name="type"]:checked', form).value;

		for (const el of pickAll('[data-cdr-timed]', form)) {
			el.hidden = allDay(t);
		}

		pick('[data-cdr-span]', form).hidden = t !== 'away';
		pick('[data-cdr-customer-field]', form).hidden = t !== 'customer';
		pick('[data-cdr-where-field]', form).hidden = allDay(t);
		f('start').required = !allDay(t);
		f('end').required = !allDay(t);
		pick('[data-cdr-people-label]', form).textContent =
			t === 'away' ? 'Who is off' : t === 'deadline' ? 'Owner' : 'People';
	}

	function openForm(id, dayIso) {
		const e = id ? EVENTS.find((x) => x.id === id) : null;
		state.editing = e ? e.id : null;
		form.reset();

		for (const el of pickAll('.is-invalid', form)) {
			el.classList.remove('is-invalid');
		}

		pick('[data-cdr-form-title]', formDrawer).textContent = e ? 'Edit event' : 'New event';
		pick('[data-cdr-delete]', formDrawer).hidden = !e;
		const type = e ? e.type : 'meeting';
		pick(`input[name="type"][value="${type}"]`, form).checked = true;
		f('title').value = e ? e.title : '';
		f('date').value = e ? iso(e.date) : dayIso || iso(state.picked);
		f('start').value = e && e.from ? e.from : '10:00';
		f('end').value = e && e.to ? e.to : '10:30';
		f('days').value = e ? e.days : 1;
		f('where').value = e ? e.where : '';
		f('note').value = e ? e.note : '';
		setValue(f('customer'), e ? e.customer : '');
		setMulti(f('people'), e ? e.people : ['ja']);
		syncType();

		function show() {
			return bootstrap.Offcanvas.getOrCreateInstance(formDrawer).show();
		}

		if (evDrawer.classList.contains('show')) {
			evDrawer.addEventListener('hidden.bs.offcanvas', show, { once: true });
			bootstrap.Offcanvas.getInstance(evDrawer).hide();
		} else show();
	}

	function validEnd() {
		const t = pick('input[name="type"]:checked', form).value;
		const ok = allDay(t) || !f('start').value || !f('end').value || toMin(f('end').value) > toMin(f('start').value);
		f('end').setCustomValidity(ok ? '' : 'End after it starts.');
		return ok;
	}

	function save(e) {
		e.preventDefault();
		validEnd();
		const fields = ['title', 'date', 'start', 'end'].map(f);

		for (const el of fields) {
			el.classList.toggle('is-invalid', !el.checkValidity());
		}

		const bad = fields.find((el) => !el.checkValidity());
		if (bad) {
			bad.focus();
			return;
		}
		const t = pick('input[name="type"]:checked', form).value;
		const data = {
			type: t,
			title: f('title').value.trim(),
			date: fromIso(f('date').value),
			days: t === 'away' ? Math.max(1, Math.min(30, parseInt(f('days').value, 10) || 1)) : 1,
			from: allDay(t) ? null : f('start').value,
			to: allDay(t) ? null : f('end').value,
			where: allDay(t) ? '' : f('where').value.trim(),
			customer: t === 'customer' ? f('customer').value : '',
			people: Array.from(f('people').selectedOptions).map((o) => o.value),
			note: f('note').value.trim(),
		};
		let item;
		if (state.editing) {
			item = EVENTS.find((x) => x.id === state.editing);
			Object.assign(item, data);
		} else {
			item = Object.assign({ id: freshId(), link: null }, data);
			EVENTS.push(item);
		}
		state.hidden.delete(t);

		for (const b of pickAll('[data-cdr-type]', root)) {
			b.setAttribute('aria-pressed', String(!state.hidden.has(b.getAttribute('data-cdr-type'))));
		}

		state.picked = new Date(item.date);
		if (state.view !== 'week') state.anchor = new Date(item.date.getFullYear(), item.date.getMonth(), 1);
		else state.anchor = new Date(item.date);
		bootstrap.Offcanvas.getInstance(formDrawer).hide();
		render();
		toast({
			tone: 'success',
			title: state.editing ? 'Event saved' : 'Event added',
			text: `${item.title}, ${shortDate(item.date)}.`,
			duration: 4000,
		});
	}

	function remove() {
		const i = EVENTS.findIndex((x) => x.id === state.editing);
		if (i < 0) return;
		const [gone] = EVENTS.splice(i, 1);
		bootstrap.Offcanvas.getInstance(formDrawer).hide();
		render();
		toast({
			tone: 'primary',
			title: 'Event deleted',
			text: `${gone.title}, ${shortDate(gone.date)}.`,
			duration: 6000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						EVENTS.splice(i, 0, gone);
						render();
					},
				},
			],
		});
	}

	/* Wiring */
	function chooseDay(dayIso) {
		state.picked = fromIso(dayIso);
		if (state.view === 'month' && state.picked.getMonth() !== state.anchor.getMonth()) {
			state.anchor = new Date(state.picked.getFullYear(), state.picked.getMonth(), 1);
		}
		render();
	}

	root.addEventListener('click', (e) => {
		const opener = e.target.closest('[data-cdr-open]');
		if (opener) openEvent(opener.getAttribute('data-cdr-open'));
	});

	for (const b of pickAll('[data-cdr-step]', root)) {
		b.addEventListener('click', () => {
			const dir = Number(b.getAttribute('data-cdr-step'));
			if (state.view === 'week') {
				state.anchor = shiftDays(state.anchor, dir * 7);
				state.picked = mondayOf(state.anchor);
				if (same(mondayOf(TODAY), state.picked)) state.picked = new Date(TODAY);
			} else {
				state.anchor = new Date(state.anchor.getFullYear(), state.anchor.getMonth() + dir, 1);
				state.picked =
					state.anchor.getMonth() === TODAY.getMonth() && state.anchor.getFullYear() === TODAY.getFullYear()
						? new Date(TODAY)
						: new Date(state.anchor);
			}
			render();
		});
	}

	pick('[data-cdr-today]', root).addEventListener('click', () => {
		state.anchor = new Date(TODAY);
		state.picked = new Date(TODAY);
		render();
	});

	for (const r of pickAll('input[name="cdr-view"]', root)) {
		r.addEventListener('change', () => {
			state.view = r.value;
			state.anchor =
				state.view === 'week'
					? new Date(state.picked)
					: new Date(state.picked.getFullYear(), state.picked.getMonth(), 1);
			render();
		});
	}

	for (const b of pickAll('[data-cdr-type]', root)) {
		b.addEventListener('click', () => {
			const t = b.getAttribute('data-cdr-type');
			if (state.hidden.has(t)) state.hidden.delete(t);
			else state.hidden.add(t);
			b.setAttribute('aria-pressed', String(!state.hidden.has(t)));
			render();
		});
	}

	pick('[data-cdr-new]', root).addEventListener('click', () => openForm(null, iso(state.picked)));
	pick('[data-cdr-day-add]', root).addEventListener('click', () => openForm(null, iso(state.picked)));
	pick('[data-cdr-edit]', evDrawer).addEventListener('click', () => openForm(shownId));

	for (const r of pickAll('input[name="type"]', form)) {
		r.addEventListener('change', syncType);
	}

	f('start').addEventListener('change', () => {
		if (!f('start').value) return;
		const end = toMin(f('start').value) + 30;
		if (!f('end').value || toMin(f('end').value) <= toMin(f('start').value)) {
			f('end').value =
				`${String(Math.min(23, Math.floor(end / 60))).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
		}
		if (validEnd()) f('end').classList.remove('is-invalid');
	});
	f('end').addEventListener('change', () => {
		if (validEnd()) f('end').classList.remove('is-invalid');
	});

	for (const n of ['title', 'date']) {
		f(n).addEventListener('input', () => {
			if (f(n).checkValidity()) f(n).classList.remove('is-invalid');
		});
	}

	form.addEventListener('submit', save);
	pick('[data-cdr-delete]', formDrawer).addEventListener('click', remove);

	/* The day panel folds to a slim strip beside the calendar (or to its
	   heading under it), and stays the way it was left. */
	const dayToggle = pick('[data-cdr-day-toggle]');
	const layout = pick('[data-cdr-layout]');
	const still = window.matchMedia('(prefers-reduced-motion: reduce)');
	const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
	/** Folds or opens the panel. Beside the calendar the column slides
	 * (a grid transition in schedule.css); under it the card's height
	 * slides. Either way the contents fade in once there is room. */
	function setDayPanel(open, animate = false) {
		const card = pick('.cdr-day', layout);
		const moving = animate && !still.matches && layout.classList.contains('is-day-shut') === open;
		const from = card.getBoundingClientRect().height;
		layout.classList.toggle('is-day-shut', !open);
		if (moving) {
			const beside = window.matchMedia('(min-width: 1400px)').matches;
			if (!beside) {
				const to = card.getBoundingClientRect().height;
				card.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 260, easing: EASE });
			}
			if (open) {
				for (const part of pickAll('.cdr-day-body > *, .cdr-day-eyebrow, .cdr-day-desc', card)) {
					part.animate(
						[
							{ opacity: 0, transform: beside ? 'translateX(0.75rem)' : 'translateY(-0.5rem)' },
							{ opacity: 1, transform: 'none' },
						],
						{ duration: 220, delay: 90, easing: EASE, fill: 'backwards' },
					);
				}
			}
		}
		dayToggle.setAttribute('aria-expanded', String(open));
		dayToggle.setAttribute('aria-label', open ? 'Collapse the day panel' : 'Expand the day panel');
		const beside = window.matchMedia('(min-width: 1400px)').matches;
		const glyph = beside
			? open
				? 'bi-chevron-bar-right'
				: 'bi-chevron-bar-left'
			: open
				? 'bi-chevron-up'
				: 'bi-chevron-down';
		pick('i', dayToggle).className = `bi ${glyph}`;
		try {
			localStorage.setItem('cdr-day-panel', open ? 'open' : 'shut');
		} catch {
			/* storage can be off; the panel still folds */
		}
	}
	start();
})();
