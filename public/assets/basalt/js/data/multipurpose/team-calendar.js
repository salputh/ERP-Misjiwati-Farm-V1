/**
 * Schedule behind the Calendar page (full-calendar.html): what the Fieldline
 * success team has booked from the last days of September into early
 * November, namely customer visits, internal meetings and reviews.
 *
 * Needs assets/basalt/js/data/multipurpose/accounts.js on the page before it. A visit only names
 * an account id; the company name and the city shown for it are looked up on
 * that record, so they always agree with Companies and Company Details.
 *
 * Published as window.Basalt.data.teamCalendar:
 *   NOW       the moment the demo pretends it is (Thu Oct 8 2026, 10:40)
 *   types     visit, meeting and review, each with its labels and a tone 1-8
 *   events    the bookings in the shape FullCalendar accepts
 *   recordWithId(id)  a single booking, or null when the id is unknown
 *
 * A booking carries id, type, title, start, end, allDay, account, company,
 * where and note. Timed bookings use "2026-10-08T09:30"; all-day ones use a
 * bare date and end on the day after they finish. To show real data, build
 * the list from your own calendar service and set NOW to new Date().
 */
(() => {
	'use strict';

	const accounts = window.Basalt.data.accounts;
	const demoClock = new Date(2026, 9, 8, 10, 40);

	const kinds = {
		visit: { tone: 3, label: 'Visit', plural: 'Visits' },
		meeting: { tone: 1, label: 'Team meeting', plural: 'Team meetings' },
		review: { tone: 6, label: 'Review', plural: 'Reviews' },
	};

	/* Wording several bookings share, kept in one place so it cannot drift. */
	const usual = {
		call: 'Video call',
		standup: 'Ten minutes on what is blocked and who needs a hand.',
	};

	/*
	 * One row per booking: kind, day, hours, title, place, note. Hours are
	 * "from-to" on that day, or a whole number of days for an all-day booking.
	 * For a visit the place is an account id instead of a location. Rows keep
	 * the order the page has always received them in, which is not strictly
	 * by date inside a week.
	 */
	const bookings = [
		/* Week of September 28, closing out the third quarter. */
		[
			'review',
			'2026-09-28',
			'14:00-15:00',
			'Q3 numbers',
			usual.call,
			'Revenue, churn and seats for the quarter, before the wrap-up.',
		],
		[
			'visit',
			'2026-09-29',
			'09:00-12:00',
			'Lakeside setup',
			'lakeside',
			'Set up the front desk tablets and the first week of visits.',
		],
		[
			'review',
			'2026-09-29',
			'15:00-16:00',
			'Q3 wrap-up',
			office('Room 2'),
			'What went well this quarter, and what carries into Q4.',
		],
		['meeting', '2026-10-01', '09:30-10:00', 'Ops standup', usual.call, usual.standup],
		[
			'review',
			'2026-10-01',
			'14:00-15:00',
			'Oakhaven review',
			usual.call,
			'Quarterly review with Lindsay Kinney: seats used, missed visits and the portal.',
		],

		/* Week of October 5, the one the page opens on. */
		[
			'visit',
			'2026-10-05',
			2,
			'Coastline setup',
			'coastline',
			'Two days in Norfolk setting up Ray Downing’s crews before the trial ends.',
		],
		[
			'meeting',
			'2026-10-05',
			'10:00-11:00',
			'Q4 planning',
			office('Room 2'),
			'Agree the three things the team ships before the end of the year.',
		],
		[
			'meeting',
			'2026-10-07',
			'09:00-09:30',
			'1:1 with Connie',
			usual.call,
			'Support hiring, and the winter cover roster.',
		],
		[
			'review',
			'2026-10-07',
			'16:00-17:00',
			'Support review',
			usual.call,
			'September tickets: 612 solved, first reply in 38 minutes on average.',
		],
		['meeting', '2026-10-08', '09:30-10:00', 'Ops standup', usual.call, usual.standup],
		[
			'visit',
			'2026-10-08',
			'11:00-12:30',
			'Moorings check-in',
			'moorings',
			'Walk the dispatch desk through the new missed-visit alerts.',
		],
		[
			'review',
			'2026-10-08',
			'14:00-15:00',
			'Renewal review',
			usual.call,
			'Every renewal due before December, and who owns each one.',
		],
		[
			'meeting',
			'2026-10-09',
			'13:00-14:00',
			'Design crit',
			office('Room 1'),
			'First look at the new visit timeline for the mobile app.',
		],

		/* Week of October 12. */
		[
			'visit',
			'2026-10-12',
			'10:00-15:00',
			'Highpoint site visit',
			'highpoint',
			'Meet the Portsmouth team before their 12 new seats start.',
		],
		['meeting', '2026-10-15', '09:30-10:00', 'Ops standup', usual.call, usual.standup],
		[
			'review',
			'2026-10-12',
			'10:00-10:45',
			'Portal review',
			usual.call,
			'Last look at the Customer Portal release notes and help articles.',
		],
		[
			'visit',
			'2026-10-14',
			'13:00-15:30',
			'Brookside visit',
			'brookside',
			'Help Forrest Decker move his schedule over to yearly billing.',
		],
		[
			'meeting',
			'2026-10-15',
			'13:00-14:00',
			'All-hands',
			office('Main room'),
			'Q3 results, the Q4 plan and two new starters.',
		],
		[
			'review',
			'2026-10-16',
			'10:00-10:45',
			'Hiring review',
			usual.call,
			'Shortlist for the support specialist role.',
		],

		/* Week of October 19. */
		[
			'visit',
			'2026-10-19',
			2,
			'Oakhaven branch',
			'oakhaven',
			'Two days at the new Plattsburgh branch, setting up the portal.',
		],
		['meeting', '2026-10-22', '09:30-10:00', 'Ops standup', usual.call, usual.standup],
		[
			'meeting',
			'2026-10-22',
			'10:30-11:30',
			'Add-on pricing',
			office('Room 2'),
			'Travel Planner and SMS credits prices for 2027.',
		],
		[
			'review',
			'2026-10-22',
			'15:00-16:00',
			'Highpoint review',
			usual.call,
			'Quarterly review with Connie Sexton, and the December renewal.',
		],

		/* Week of October 26, ending the month. */
		[
			'visit',
			'2026-10-29',
			'15:00-15:45',
			'Lakeside check-in',
			'lakeside',
			'Quarterly check-in: 29 of 30 seats used every week.',
		],
		['meeting', '2026-10-29', '09:30-10:00', 'Ops standup', usual.call, usual.standup],
		[
			'review',
			'2026-10-27',
			'14:00-15:30',
			'Board pack review',
			office('Room 1'),
			'Revenue, churn and hiring before the board meets on October 28.',
		],
		[
			'visit',
			'2026-10-26',
			'09:00-15:00',
			'Lumora AI visit',
			'lumoraai',
			'Train the eight new carers in person before the renewal starts.',
		],
		[
			'meeting',
			'2026-10-30',
			'12:00-13:30',
			'Team lunch',
			'Lou’s Diner, Evanston',
			'End of the month, on the team budget.',
		],

		/* Early November, already on the books. */
		[
			'meeting',
			'2026-11-02',
			'10:00-11:00',
			'November planning',
			usual.call,
			'Renewals, the support roster and the December freeze.',
		],
		[
			'review',
			'2026-11-04',
			'11:00-12:00',
			'Avocet review',
			usual.call,
			'Addison Brennan’s answer on the Max proposal, and a start date.',
		],
	];

	publish();

	/* Turns every row into a booking and hangs the result on Basalt.data. */
	function publish() {
		const events = bookings.map(toEvent);

		window.Basalt.data = window.Basalt.data || {};
		window.Basalt.data.teamCalendar = {
			NOW: demoClock,
			types: kinds,
			events,
			recordWithId: (wanted) => events.find((event) => event.id === wanted) ?? null,
		};
	}

	/**
	 * Expands one schedule row into the record FullCalendar and the page read.
	 * Ids count up from tc-2601 in row order.
	 * @param {Array} row  [kind, day, hours, title, place, note]
	 * @param {number} position  index of the row in the schedule
	 */
	function toEvent([type, day, hours, title, place, note], position) {
		const allDay = typeof hours === 'number';
		const [from, to] = allDay ? [] : hours.split('-');
		const customer = type === 'visit' ? accounts.find(place) : null;

		return {
			id: `tc-${2601 + position}`,
			type,
			title,
			start: allDay ? day : `${day}T${from}`,
			end: allDay ? dayAfter(day, hours) : `${day}T${to}`,
			allDay,
			account: customer?.id ?? '',
			company: customer?.name ?? '',
			where: customer ? customer.city : place,
			note,
		};
	}

	/** The calendar date that lies a given number of days after "YYYY-MM-DD". */
	function dayAfter(day, count) {
		const midnight = new Date(`${day}T00:00Z`);
		midnight.setUTCDate(midnight.getUTCDate() + count);
		return midnight.toISOString().slice(0, 10);
	}

	/** A room in the Evanston office, written the way every booking names it. */
	function office(room) {
		return `${room}, Evanston office`;
	}
})();
