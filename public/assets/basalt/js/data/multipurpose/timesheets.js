/**
 * Weekly timesheets for the Fieldline staff, read by the Timesheets list and
 * the Timesheet Details page. Every name, team, manager and project is borrowed
 * from data/multipurpose/people.js and data/multipurpose/projects.js, so the hours agree with the rest of
 * the demo: the clocked hours on Shifts (people.workday) decide each day, and
 * leave booked in Time Off shows up as days away.
 *
 * Published on window.Basalt.data.timesheets:
 *   TODAY, NOW           the demo date and the current clock time
 *   weeks, current       the Mondays on offer (oldest first) and this one
 *   dayHours             the hours a full working day is expected to hold
 *   people(week)         the staff who keep a timesheet that week
 *   sheet(staff, week)   one week for one person: days, lines, totals, status
 *                        and the approval trail, or null when there is none
 *   work(person)         the projects and duties that person books time to
 *   fmtHours(n)          8, 7.5, 8.25
 *   dayTitle(iso)        "Mon, Oct 5"
 *   when(at)             "Today, 4:12 pm"
 *   addDays, toDate      the date arithmetic the pages share with this file
 *
 * A sheet is draft, submitted, approved or rejected. Swapping in a real time
 * tracker only means returning this same shape from sheet().
 */
(() => {
	'use strict';

	const roster = window.Basalt.data?.people;
	const projectBook = window.Basalt.data?.projects;
	if (!roster) return;

	/* The demo is pinned to the afternoon of Friday, October 9, 2026, and the
     person signed in is John Armstrong. */
	const today = roster.TODAY;
	const clockNow = '16:40';
	const mondays = ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05'];
	const thisMonday = mondays.at(-1);
	const lastMonday = mondays.at(-2);
	const fullDay = 8;
	const signedIn = 'ja';

	const monthTags = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	/* Customers that support, success and sales hours get billed against. */
	const customerNames = [
		'Lumora AI',
		'Oakhaven Studio',
		'Avocet Robotics',
		'Highpoint Outfitters',
		'Lakeside Apparel',
		'Larchwood Studios',
		'Harborline AI',
		'Copperleaf Design',
		'Evergreen Landscaping',
		'Cornerstone Logistics',
		'Rainier Mobility',
		'Vista Landscaping',
		'Tamara Skincare Services',
		'Northbrook Cleaning',
		'Aspen Hollow Pets',
	];
	const inHouse = 'Internal';

	/* The routine work of each team. Duties marked for a customer pick one
     from the list above; the notes are what people type next to the hours. */
	const teamDuties = {
		Engineering: [
			duty('Platform upkeep', [
				'Database upgrade prep',
				'Fixed the slow sign-in page',
				'Cleaned up error alerts',
				'Updated server images',
			]),
			duty('Code review', ['Reviewed pull requests', 'Paired on the visits API', 'Reviewed the release branch']),
		],
		Product: [
			duty('Discovery', ['Customer interviews', 'Wrote up research notes', 'Usability test sessions']),
			duty('Roadmap', ['Q4 planning with leads', 'Sorted feature requests', 'Wrote the next spec']),
		],
		Support: [
			customerDuty('Support inbox', [
				'Tickets and live chat',
				'Billing questions',
				'Calendar sync issues',
				'Login and access help',
			]),
			customerDuty('Customer calls', [
				'Setup help call',
				'Walked them through reports',
				'Call about missed reminders',
			]),
		],
		Success: [
			customerDuty('Onboarding', ['Kick-off call', 'Imported their customers', 'Scheduler training']),
			customerDuty('Check-in calls', ['Quarterly check-in', 'Renewal prep', 'Usage review']),
		],
		Sales: [
			customerDuty('Demos', ['Product demo', 'Follow-up demo for owners', 'Demo for their office team']),
			customerDuty('Proposals', ['Drafted the proposal', 'Pricing questions', 'Contract changes']),
		],
		Marketing: [
			duty('Campaigns', ['October email campaign', 'Ad budget review', 'Webinar invites']),
			duty('Content', ['Wrote a customer story', 'Edited help videos', 'Blog post draft']),
		],
		Finance: [
			duty('Month-end close', ['September close', 'Bank reconciliation', 'Accruals and journals']),
			duty('Billing runs', ['Card retries', 'Invoice questions', 'Refunds and credits']),
		],
		Operations: [
			duty('IT and systems', ['Laptops for new hires', 'Access reviews', 'Phone plan changes']),
			duty('Hiring', ['Interviews', 'Plans for new hires', 'Job posts']),
		],
	};
	const meetingDuty = duty('Team meetings', ['Weekly team meeting', 'One-on-one', 'All-hands']);
	const standbyDuty = duty('On-call', ['Weekend on-call', 'Paged for slow syncs']);
	const onStandby = ['ka', 'pd'];
	const liveStates = ['on-track', 'at-risk', 'blocked'];

	/* What a manager writes when a sheet goes back; the second only makes
     sense for customer work. */
	const pushbacks = [
		(iso, line) => `${dayTitle(iso)} has ${fmtHours(line.hours)} hours on ${line.name}. Is that right?`,
		(iso, line) => `Please split ${line.name} on ${dayTitle(iso)} into one line per customer.`,
	];

	const dutiesById = new Map();
	const sheetsByKey = new Map();

	publish();

	function publish() {
		window.Basalt.data.timesheets = {
			TODAY: today,
			NOW: clockNow,
			weeks: mondays,
			current: thisMonday,
			dayHours: fullDay,
			people: staffFor,
			sheet: weekSheet,
			work: dutiesOf,
			fmtHours,
			dayTitle,
			when,
			addDays: shiftDate,
			toDate: parseIso,
		};
	}

	/* Builders for the duty lists above. */
	function duty(name, notes) {
		return { name, notes };
	}

	function customerDuty(name, notes) {
		return { name, client: true, notes };
	}

	/* Deterministic pick in [0, size) for a seed string, so every visit
     shows the same week. */
	function pick(seed, size) {
		return roster.hash(seed) % size;
	}

	function toQuarter(hours) {
		return Math.round(hours * 4) / 4;
	}

	/** Hours rounded to the quarter, with no trailing zeros: 8, 7.5, 8.25. */
	function fmtHours(hours) {
		return String(toQuarter(hours));
	}

	/* Calendar helpers. Dates travel as 'YYYY-MM-DD' and are read in local time. */
	function parseIso(iso) {
		const [year, month, date] = iso.split('-').map(Number);
		return new Date(year, month - 1, date);
	}

	function shiftDate(iso, count) {
		const date = parseIso(iso);
		date.setDate(date.getDate() + count);
		return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
	}

	function twoDigits(value) {
		return String(value).padStart(2, '0');
	}

	/** "Mon, Oct 5" for an ISO date. */
	function dayTitle(iso) {
		const date = parseIso(iso);
		return `${weekdayNames[date.getDay()]}, ${monthTags[date.getMonth()]} ${date.getDate()}`;
	}

	/** '13:05' becomes '1:05 pm'. */
	function twelveHour(hhmm) {
		const [hour, minute] = hhmm.split(':').map(Number);
		const half = hour < 12 ? 'am' : 'pm';
		return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${half}`;
	}

	/**
	 * A 'YYYY-MM-DD HH:MM' moment as the pages print it: "Today, 4:12 pm",
	 * "Yesterday, ..." or the full day label.
	 */
	function when(moment) {
		const iso = moment.slice(0, 10);
		const time = twelveHour(moment.slice(11));
		const relative = { [today]: 'Today', [shiftDate(today, -1)]: 'Yesterday' };
		return `${relative[iso] ?? dayTitle(iso)}, ${time}`;
	}

	/* 'YYYY-MM-DD HH:MM' for a date and a number of minutes after midnight. */
	function timestamp(iso, minutes) {
		const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
		return `${iso} ${hour}:${String(minutes % 60).padStart(2, '0')}`;
	}

	/**
	 * Everything a person can book hours to: the live projects they belong to
	 * (their own open tasks, else the milestones still ahead, as notes), their
	 * team's duties, on-call for the few who carry it, and meetings.
	 * @returns {{projects: object[], team: object[], all: object[]}}
	 */
	function dutiesOf(person) {
		const known = dutiesById.get(person.id);
		if (known) return known;

		const projects = [];
		for (const project of projectBook ? projectBook.list : []) {
			if (!liveStates.includes(project.status) || !project.team.includes(person.id)) continue;
			const ownTasks = (project.tasks || []).filter((task) => task[2] === person.id).map((task) => task[0]);
			const ahead = project.milestones.filter((step) => !step.reached).map((step) => step.name);
			const notes = ownTasks.length ? ownTasks : ahead;
			projects.push({
				name: project.name,
				client: project.customer?.name ?? inHouse,
				project: project.id,
				notes: notes.length ? notes : ['Project work'],
			});
		}

		const team = (teamDuties[person.team] || []).map(({ name, client, notes }) => ({
			name,
			client: client ? customerNames[pick(`${person.id}${name}`, customerNames.length)] : inHouse,
			clientPool: Boolean(client),
			notes,
		}));

		const extras = [];
		if (onStandby.includes(person.id))
			extras.push({ name: standbyDuty.name, client: inHouse, notes: standbyDuty.notes });
		extras.push({ name: meetingDuty.name, client: inHouse, notes: meetingDuty.notes });

		const result = { projects, team, all: [...projects, ...team, ...extras] };
		dutiesById.set(person.id, result);
		return result;
	}

	function isPartTime(person) {
		return person.type === 'Part-time';
	}

	/* Full-timers work Monday to Friday, part-timers Monday to Wednesday. */
	function isWorkday(person, iso) {
		const weekday = parseIso(iso).getDay();
		const lastWeekday = isPartTime(person) ? 3 : 5;
		return weekday >= 1 && weekday <= lastWeekday;
	}

	/**
	 * Splits one day's hours into lines: a main piece of work (a project seven
	 * times in ten when the person has any), sometimes a second team duty,
	 * and a meeting on Mondays and about one day in five otherwise.
	 */
	function linesFor(person, iso, hours) {
		const seed = person.id + iso;
		const { projects, team } = dutiesOf(person);

		const lead =
			projects.length && pick(`${seed}main`, 10) < 7
				? projects[pick(`${seed}pj`, projects.length)]
				: team[pick(`${seed}tm`, team.length)];
		const alternates = team.filter((item) => item !== lead);
		const backup = alternates.length ? alternates[pick(`${seed}second`, alternates.length)] : null;

		const hasMeeting = parseIso(iso).getDay() === 1 || pick(`${seed}meet`, 5) === 0;
		const meetingHours = hasMeeting ? toQuarter(0.5 + pick(`${seed}mlen`, 3) * 0.25) : 0;
		const remaining = hours - meetingHours;
		const leadHours =
			backup && remaining > 3 ? toQuarter(remaining * (0.5 + pick(`${seed}split`, 4) * 0.1)) : remaining;
		const backupHours = toQuarter(remaining - leadHours);

		function noteFor(item, salt) {
			return item.notes[pick(`${seed}${salt}${item.name}`, item.notes.length)];
		}

		function customerFor(item, salt) {
			return item.clientPool ? customerNames[pick(`${seed}${salt}`, customerNames.length)] : item.client;
		}

		const lines = [
			{ name: lead.name, client: customerFor(lead, 'c1'), note: noteFor(lead, 'n1'), hours: leadHours },
		];
		if (backup && backupHours > 0) {
			lines.push({
				name: backup.name,
				client: customerFor(backup, 'c2'),
				note: noteFor(backup, 'n2'),
				hours: backupHours,
			});
		}
		if (meetingHours) {
			lines.push({
				name: meetingDuty.name,
				client: inHouse,
				note: noteFor(meetingDuty, 'n3'),
				hours: meetingHours,
			});
		}
		return lines;
	}

	/**
	 * Where a sheet stands. Anything older than last week is approved; last
	 * week is mostly approved with a few waiting or sent back; this week most
	 * people are still filling theirs in.
	 */
	function standingOf(person, week) {
		const roll = pick(`${person.id}${week}status`, 100);
		if (week === lastMonday) return roll < 9 ? 'submitted' : roll < 13 ? 'rejected' : 'approved';
		if (week !== thisMonday) return 'approved';
		if (isPartTime(person)) return roll < 50 ? 'approved' : 'submitted';
		if (person.id === signedIn) return 'draft';
		if (roll < 28) return 'submitted';
		return roll < 36 ? 'rejected' : 'draft';
	}

	function keepsSheet(person, week) {
		if (person.staffed === false || person.left) return false;
		return person.start <= shiftDate(week, 4);
	}

	function staffFor(week) {
		return roster.staff.filter((person) => keepsSheet(person, week));
	}

	/**
	 * One person's week, built once and then served from memory so the
	 * pages can update it in place.
	 * @param {string} staff staff number, e.g. '#101'
	 * @param {string} week the Monday, 'YYYY-MM-DD'
	 */
	function weekSheet(staff, week) {
		const person = roster.find(staff);
		if (!person || !mondays.includes(week) || !keepsSheet(person, week)) return null;
		const cacheKey = person.staff + week;
		if (sheetsByKey.has(cacheKey)) return sheetsByKey.get(cacheKey);

		const seed = person.id + week;
		const planned = standingOf(person, week);
		const days = buildDays(person, week, seed, planned);

		const expected =
			days.filter((day) => isWorkday(person, day.iso) && day.kind !== 'before' && day.kind !== 'off').length *
			fullDay;
		const total = toQuarter(days.reduce((sum, day) => sum + day.hours, 0));
		const away = days.filter((day) => day.kind === 'off');
		const logged = days.filter((day) => day.entries.length);

		const approver = roster.recordWithId(person.mgr) || roster.recordWithId('rc');
		const finalDay = shiftDate(week, isPartTime(person) ? 2 : 4);
		const sentAt = sentStamp(week, finalDay, seed, planned);
		/* A week spent entirely away is filled in from Time Off and needs no sign-off. */
		const status = logged.length ? planned : 'approved';
		const trail = { person, approver, week, finalDay, seed, sentAt, logged, reason: '' };
		const history = buildTrail(trail, status);

		const sheet = {
			id: person.staff,
			person,
			week,
			weekEnd: shiftDate(week, 6),
			status,
			days,
			total,
			expected,
			overtime: Math.max(0, toQuarter(total - expected)),
			missing: days.filter((day) => day.kind === 'missing').length,
			offDays: away.length,
			offLabel: away[0]?.reason ?? '',
			reason: trail.reason,
			history,
			approver,
			partTime: isPartTime(person),
			sentAt: status === 'draft' ? '' : sentAt,
		};
		sheetsByKey.set(cacheKey, sheet);
		return sheet;
	}

	/**
	 * The seven days of a week. Workdays take their hours from the time clock
	 * (clock-in to clock-out, less half an hour for lunch); this week's drafts
	 * may leave Friday, or Thursday and Friday, unlogged; and the on-call pair
	 * sometimes books a few Saturday hours.
	 */
	function buildDays(person, week, seed, planned) {
		const unlogged = new Set();
		if (week === thisMonday && planned === 'draft') {
			if (pick(`${seed}fri`, 2) === 0) unlogged.add(shiftDate(week, 4));
			if (pick(`${seed}thu`, 7) === 0) unlogged.add(shiftDate(week, 3)).add(shiftDate(week, 4));
		}

		const days = [];
		for (let offset = 0; offset < 7; offset += 1) {
			const iso = shiftDate(week, offset);
			const day = { iso, label: dayTitle(iso), weekend: offset >= 5, kind: 'rest', hours: 0, entries: [] };
			days.push(day);

			if (iso < person.start) {
				day.kind = 'before';
			} else if (isWorkday(person, iso)) {
				fillWorkday(day, person, unlogged);
			} else if (offset === 5 && onStandby.includes(person.id) && pick(`${seed}oncall`, 3) === 0) {
				day.kind = 'work';
				day.hours = toQuarter(2 + pick(`${seed}oclen`, 5) * 0.5);
				day.entries = [
					{
						name: standbyDuty.name,
						client: inHouse,
						note: standbyDuty.notes[pick(`${seed}ocn`, 2)],
						hours: day.hours,
					},
				];
			}
		}
		return days;
	}

	function fillWorkday(day, person, unlogged) {
		const shift = roster.workday(person, day.iso);
		if (shift.kind !== 'in') {
			day.kind = 'off';
			day.reason = shift.reason;
			return;
		}
		if (unlogged.has(day.iso)) {
			day.kind = 'missing';
			return;
		}
		day.kind = 'work';
		day.hours = toQuarter((shift.outAt - shift.inAt) / 60 - 0.5);
		day.entries = linesFor(person, day.iso, day.hours);
	}

	/* When the sheet went (or would go) to the manager, decided by the status
     it was planned with. */
	function sentStamp(week, finalDay, seed, planned) {
		if (week !== thisMonday) return timestamp(finalDay, 16 * 60 + 20 + pick(`${seed}sm`, 90));
		if (planned === 'rejected') return timestamp(shiftDate(week, 3), 17 * 60 + pick(`${seed}sm`, 40));
		const minutes =
			finalDay === today ? 14 * 60 + 5 + pick(`${seed}sm`, 140) : 16 * 60 + 30 + pick(`${seed}sm`, 60);
		return timestamp(finalDay, minutes);
	}

	/**
	 * The approval trail, oldest first. Writes the sent-back note, when there
	 * is a current one, onto trail.reason.
	 */
	function buildTrail(trail, status) {
		const { person, approver, week, finalDay, seed, sentAt, logged } = trail;
		const owner = roster.nameOf(person);
		const boss = roster.nameOf(approver);

		if (!logged.length) {
			const sixAm = timestamp(week, 6 * 60);
			return [
				{ kind: 'created', at: sixAm, who: 'Fieldline', text: 'filled it in from Time Off' },
				{ kind: 'approved', at: sixAm, who: 'Fieldline', text: 'approved it, as the whole week is time off' },
			];
		}

		const events = [
			{
				kind: 'created',
				at: timestamp(week, 9 * 60 + pick(`${seed}cm`, 50)),
				who: owner,
				text: 'started the timesheet',
			},
		];
		const sent = { kind: 'submitted', at: sentAt, who: owner, text: 'sent it for approval' };
		const recent = week === thisMonday || week === lastMonday;

		function pushbackFor(salt) {
			const day = logged[pick(`${seed}${salt}rd`, logged.length)] || logged[0];
			const line = day.entries[0];
			const fitting = pushbacks.filter((_, index) => index !== 1 || line.client !== inHouse);
			return fitting[pick(`${seed}${salt}rr`, fitting.length)](day.iso, line);
		}

		if (!recent && pick(`${seed}bounce`, 9) === 0) {
			const returned = shiftDate(finalDay, 3);
			events.push(
				sent,
				{
					kind: 'rejected',
					at: timestamp(returned, 10 * 60 + pick(`${seed}rb`, 90)),
					who: boss,
					text: 'sent it back',
					reason: pushbackFor('old'),
				},
				{
					kind: 'submitted',
					at: timestamp(returned, 14 * 60 + pick(`${seed}rs`, 90)),
					who: owner,
					text: 'fixed it and sent it again',
				},
				{
					kind: 'approved',
					at: timestamp(shiftDate(returned, 1), 9 * 60 + 30 + pick(`${seed}ra`, 60)),
					who: boss,
					text: 'approved it',
				},
			);
			return events;
		}
		if (status === 'draft') return events;

		events.push(sent);
		if (status === 'approved') {
			const decided = shiftDate(finalDay, week === thisMonday ? 1 : 3);
			events.push({
				kind: 'approved',
				at: timestamp(decided, 9 * 60 + pick(`${seed}am`, 120)),
				who: boss,
				text: 'approved it',
			});
		} else if (status === 'rejected') {
			trail.reason = pushbackFor('now');
			const decided = week === thisMonday ? today : shiftDate(finalDay, 3);
			events.push({
				kind: 'rejected',
				at: timestamp(decided, 10 * 60 + pick(`${seed}rj`, 120)),
				who: boss,
				text: 'sent it back',
				reason: trail.reason,
			});
		}
		return events;
	}
})();
