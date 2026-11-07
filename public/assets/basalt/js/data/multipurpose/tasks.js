/**
 * Sample to-dos behind the Task Details screen (task-details.html).
 *
 * The people, projects and tasks mirror the To Dos board (to-dos.html) down
 * to the ids, so a link such as task-details.html?id=t101 lands on the very
 * task clicked over there. Beyond what the board shows, a task may also own
 * a comment thread, attachments and a trail of earlier changes.
 *
 * Published as window.Basalt.data.tasks with:
 *   me, people, lists, tasks   the same records To Dos reads
 *   extras                     thread, attachments and history, keyed by task id
 *   find(id)                   the matching task, or null when there is none
 *
 * Every date is relative to the moment the page loads, just like To Dos, so
 * the list never runs out of work due today. A live backend would send fixed
 * dates ("2026-10-02"); swap these arrays for its responses, same shapes.
 */
(() => {
	'use strict';

	/* Who is on the team, as id, full name and job title. */
	const team = [
		['john', 'John Armstrong', 'Head of customer operations'],
		['theo', 'Theo Barlow', 'Account manager'],
		['connie', 'Lindsay Kinney', 'Support lead'],
		['rory', 'Rory Whitlock', 'Add-ons and billing'],
		['dawn', 'Dawn Zeller', 'Onboarding specialist'],
	].map(([id, name, role]) => ({ id, name, role }));

	/* Projects take their swatch from their place in this list (1 to 6). The
     inbox is the one the reader cannot rename or delete. */
	const projects = [
		['inbox', 'Inbox'],
		['launch', 'Travel Planner launch'],
		['accounts', 'Accounts'],
		['onboarding', 'Onboarding'],
		['store', 'Add-ons'],
		['personal', 'Personal'],
	].map(([id, name], slot) =>
		id === 'inbox' ? { id, name, color: slot + 1, locked: true } : { id, name, color: slot + 1 },
	);

	/* One row per task, in board order: id, project, priority, owner, due day
     (offset from today, or null), title, and anything beyond the defaults. */
	const chores = [
		chore('t101', 'launch', 1, 'john', 0, 'Sign off all the Travel Planner help articles', {
			notes: 'Support needs them by 3pm to load the macros before Friday.',
			checklist: [
				['Check the screenshots match the new board', true],
				['Check the per-seat price matches the pricing page', true],
				['Reply to the docs team', false],
			],
		}),
		chore('t102', 'launch', 1, 'john', -1, 'Set the launch discount for existing Pro accounts', {
			notes: 'Add-on lists at $6 a seat a month. Margin sheet is in the shared drive.',
		}),
		chore('t103', 'launch', 2, 'dawn', 1, 'Record the Travel Planner demo for the pricing page', {
			checklist: [
				['Load the demo account with a week of visits', false],
				['Record on a phone and the desktop', false],
			],
		}),
		chore('t104', 'launch', 3, 'dawn', 3, 'Write the in-app tour for the new day plan view', {
			notes: 'Keep it to four steps, same voice as the schedule board tour.',
		}),
		chore('t105', 'launch', 2, 'connie', 2, 'Schedule the launch email for Thursday morning'),
		chore('t106', 'accounts', 2, 'theo', 0, 'Send Oakhaven Studio their Max renewal quote'),
		chore('t107', 'accounts', 1, 'theo', -2, 'Chase the unpaid invoice from Avocet Robotics', {
			notes: 'Invoice 2214, 38 days late. Second reminder already sent.',
		}),
		chore('t108', 'accounts', 3, 'theo', 5, 'Book a check-in call with Larchwood Studios'),
		chore('t109', 'accounts', 4, 'theo', null, 'Quote 40 extra seats for Northgate Analytics'),
		chore('t110', 'onboarding', 2, 'connie', 0, 'Reply to customers asking to pause seats over the winter', {
			notes: 'Eleven emails so far. Use the seat pause template.',
		}),
		chore('t111', 'onboarding', 1, 'connie', 1, "Fix the welcome email showing last month's training dates", {
			checklist: [
				['Find which template it uses', true],
				['Send a test to yourself', false],
			],
		}),
		chore('t112', 'onboarding', 2, 'john', 4, "Move Lakeside Apparel's data import to next week"),
		chore('t113', 'store', 2, 'rory', 2, 'Top up the SMS credit packs before the Friday billing run'),
		chore('t114', 'store', 3, 'rory', 0, 'Refund the double-charged data import from last week', {
			notes: 'Order 4127. The customer keeps the import we already ran.',
		}),
		chore('t115', 'store', 3, 'rory', 8, 'Ask finance about Saturday training sessions'),
		chore('t116', 'store', 4, 'rory', null, 'Count the unused training sessions this quarter'),
		chore('t117', 'personal', 2, 'john', 12, 'Renew the first aid certificate'),
		chore('t118', 'personal', 4, 'john', null, 'Shadow a Brightline Photography shoot for a day'),
		chore('t119', 'inbox', 3, 'dawn', null, 'Add a 5,000-credit SMS pack to the price list'),
		chore('t120', 'inbox', 4, null, null, 'Look into a smaller SMS credit pack', {
			notes: 'Two customers asked this week.',
		}),

		/* Already finished: ticked off on the day they were due. */
		chore('t121', 'store', 2, 'rory', 0, 'Book more live training slots', { finished: true }),
		chore('t122', 'accounts', 3, 'theo', 0, 'Send the welcome pack to Copperleaf Design', { finished: true }),
		chore('t123', 'store', 3, 'rory', -1, 'Upload the September add-on report', { finished: true }),
		chore('t124', 'onboarding', 2, 'john', -2, 'Pick the October live training dates', { finished: true }),
		chore('t125', 'store', 2, 'rory', -3, 'Send 62 staff invites for Highpoint Outfitters', { finished: true }),
	];

	/* What only the detail view shows, per task id. The history lists earlier
     events, oldest first; the page itself adds "created" and "completed". */
	const extras = {
		t101: {
			created: stamp(-6, '09:15'),
			createdBy: 'john',
			comments: [
				said(
					'connie',
					stamp(-1, '16:40'),
					'Support needs the final set by 3pm to load the macros. Anything still in review I can take.',
				),
				said(
					'john',
					stamp(0, '08:55'),
					'Screenshots and prices are done. Only the reply to the docs team is left.',
				),
			],
			files: [
				attached('dawn', stamp(-3, '11:05'), 'travel-planner-help-articles.docx', '1.2 MB'),
				attached('dawn', stamp(-2, '14:30'), 'new-board-screenshots.zip', '8.4 MB'),
			],
			activity: [
				did('john', stamp(-6, '09:20'), 'set the priority to Urgent'),
				did('john', stamp(-2, '10:10'), 'checked off a step: Check the screenshots match the new board'),
				did(
					'john',
					stamp(-1, '15:45'),
					'checked off a step: Check the per-seat price matches the pricing page',
				),
			],
		},
		t102: {
			created: stamp(-5, '13:00'),
			createdBy: 'theo',
			comments: [
				said(
					'theo',
					stamp(-1, '17:05'),
					'Three Pro accounts asked about it on calls this week. Even 10% for the first year would help.',
				),
			],
			files: [attached('rory', stamp(-4, '09:30'), 'add-on-margin-sheet.xlsx', '96 KB')],
			activity: [did('theo', stamp(-5, '13:00'), 'assigned it to John Armstrong')],
		},
		t103: {
			created: stamp(-4, '10:00'),
			createdBy: 'john',
			comments: [
				said('dawn', stamp(-1, '12:10'), 'I’ll record on Thursday morning when the demo account is quiet.'),
			],
			files: [],
			activity: [did('john', stamp(-4, '10:02'), 'assigned it to Dawn Zeller')],
		},
		t107: {
			created: stamp(-9, '15:30'),
			createdBy: 'rory',
			comments: [
				said('rory', stamp(-4, '09:45'), 'Second reminder went out on Monday. No reply yet.'),
				said('theo', stamp(-2, '11:20'), 'Their office manager is back tomorrow. I’ll call her first thing.'),
			],
			files: [attached('rory', stamp(-9, '15:32'), 'invoice-2214.pdf', '142 KB')],
			activity: [
				did('rory', stamp(-9, '15:31'), 'assigned it to Theo Barlow'),
				did('theo', stamp(-3, '09:00'), 'moved the due date'),
			],
		},
		t110: {
			created: stamp(-3, '08:40'),
			createdBy: 'connie',
			comments: [
				said(
					'john',
					stamp(-1, '14:05'),
					'Pausing is fine up to three months. Anything longer, send them to Theo.',
				),
			],
			files: [attached('connie', stamp(-3, '08:45'), 'seat-pause-template.txt', '4 KB')],
			activity: [],
		},
		t111: {
			created: stamp(-2, '09:10'),
			createdBy: 'dawn',
			comments: [said('connie', stamp(-1, '10:30'), 'It is the onboarding welcome template, not the trial one.')],
			files: [attached('dawn', stamp(-2, '09:12'), 'welcome-email-screenshot.png', '612 KB')],
			activity: [did('connie', stamp(-1, '10:32'), 'checked off a step: Find which template it uses')],
		},
		t114: {
			created: stamp(-2, '16:15'),
			createdBy: 'connie',
			comments: [
				said('rory', stamp(-1, '09:25'), 'Refund goes back to the card it was paid with. Five to ten days.'),
			],
			files: [],
			activity: [did('connie', stamp(-2, '16:16'), 'assigned it to Rory Whitlock')],
		},
		t121: {
			created: stamp(-3, '11:00'),
			createdBy: 'rory',
			comments: [said('rory', stamp(0, '09:10'), 'Four new Saturday slots are in the calendar.')],
			files: [],
			activity: [],
		},
	};

	publish();

	/* Hangs the board on the shared Basalt.data namespace, keeping whatever
     other data files have already put there. */
	function publish() {
		window.Basalt.data = window.Basalt.data || {};
		window.Basalt.data.tasks = {
			me: 'john',
			people: team,
			lists: projects,
			tasks: chores,
			extras,
			find: lookUp,
		};
	}

	/**
	 * Returns the task with this id, or null when no task carries it.
	 * @param {string} id  a task id such as "t101"
	 */
	function lookUp(id) {
		return chores.find((entry) => entry.id === id) ?? null;
	}

	/**
	 * Builds one board task. Notes default to empty and the checklist to none;
	 * a finished task is marked done at ten to nine on its due day.
	 * @param {number|null} dueShift  days from today, or null for no due date
	 * @param {{notes?: string, checklist?: Array<[string, boolean]>, finished?: boolean}} [overrides]
	 */
	function chore(id, list, priority, assignee, dueShift, title, overrides = {}) {
		const due = dueShift === null ? null : dayFromToday(dueShift);
		const record = {
			id,
			title,
			list,
			due,
			priority,
			assignee,
			notes: overrides.notes ?? '',
			steps: (overrides.checklist ?? []).map(([stepTitle, ticked], position) => ({
				id: `s${position + 1}`,
				title: stepTitle,
				done: ticked,
			})),
		};
		if (overrides.finished) {
			record.done = true;
			record.doneAt = `${due}T08:50`;
		}
		return record;
	}

	/* Thread, attachment and history entries share the same "who, when" pair. */
	function said(who, at, text) {
		return { at, who, text };
	}
	function attached(who, at, name, size) {
		return { name, size, at, who };
	}
	function did(who, at, what) {
		return { at, who, what };
	}

	/** A local time on a day relative to today, as "YYYY-MM-DDTHH:MM". */
	function stamp(dayShift, clock) {
		return `${dayFromToday(dayShift)}T${clock}`;
	}

	/** The local calendar date this many days from today, as "YYYY-MM-DD". */
	function dayFromToday(shift) {
		const rightNow = new Date();
		const landing = new Date(rightNow.getFullYear(), rightNow.getMonth(), rightNow.getDate() + shift);
		return [landing.getFullYear(), landing.getMonth() + 1, landing.getDate()].map(twoDigits).join('-');
	}

	/** Left-pads a month or day number to two digits. */
	function twoDigits(part) {
		return `${part}`.padStart(2, '0');
	}
})();
