/**
 * The Fieldline sales team's activity log: calls, emails, meetings and notes,
 * both the ones still ahead and the ones already handled. The Activities page
 * (activities.html) is the only reader.
 *
 * An activity hangs off one record, written as "kind:id": a lead
 * (lead:#1088), a deal (deal:#2017) or a customer (company:lumoraai).
 * People, owners and dates agree with those records, so accounts.js, deals.js
 * and companies.js must load before this file; the page resolves links there.
 *
 * Published as window.Basalt.data.activities:
 *   now / today  the frozen demo clock, Friday October 9, 2026
 *   me           whoever is signed in
 *   types        label, plural, icon and tone for each kind of activity
 *   list()       every activity as new objects the page is free to mutate
 *   find(id)     a single activity by its AC number, or null
 *
 * A real app would load the same fields from its CRM instead.
 */
(() => {
	'use strict';

	const CLOCK = '2026-10-09T10:20';
	const SIGNED_IN = 'John Armstrong';
	const YEAR = CLOCK.slice(0, 4);

	const KINDS = {
		call: { icon: 'bi-telephone', tone: 1, label: 'Call', plural: 'Calls' },
		email: { icon: 'bi-envelope', tone: 2, label: 'Email', plural: 'Emails' },
		meeting: { icon: 'bi-camera-video', tone: 3, label: 'Meeting', plural: 'Meetings' },
		note: { icon: 'bi-journal-text', tone: 5, label: 'Note', plural: 'Notes' },
	};

	/*
	 * One line per activity, newest number first:
	 *   [number, "month-day time", kind, owner, contact, "record kind:id", minutes, title, notes]
	 * The year comes from the clock above. Minutes only matter for calls and
	 * meetings; emails and notes carry 0.
	 */

	/* Still open, and already past their time. */
	const OVERDUE = [
		[
			3188,
			'10-08 16:00',
			'email',
			'John Armstrong',
			'Renee Calloway',
			'lead:#1088',
			0,
			'Reply with a schedule demo',
			'Show both offices on one board. She books 26 carers by phone today.',
		],
		[
			3187,
			'10-08 17:00',
			'email',
			'Elise Vick',
			'Francis Becker',
			'lead:#1064',
			0,
			'Send the quote for 30 seats',
			'Pro with Travel Planner, priced through TechnoPro.',
		],
		[
			3186,
			'10-08 11:30',
			'call',
			'Leslie Ashby',
			'Lance Bishop',
			'deal:#2031',
			15,
			'Call Lance about the contract',
			'He hasn’t opened the contract since September 29.',
		],
		[
			3185,
			'10-09 09:00',
			'meeting',
			'Thomas Morrison',
			'Howard Mack',
			'lead:#1079',
			30,
			'Show the booking page',
			'Their customers want to book inspections themselves.',
		],
		[
			3184,
			'10-09 09:30',
			'email',
			'Tony Aldridge',
			'Steve Newton',
			'lead:#1066',
			0,
			'Send the Max quote',
			'Include the response-time reports he asked about.',
		],
	];

	/* Booked for the rest of the demo day. */
	const LATER_TODAY = [
		[
			3183,
			'10-09 11:00',
			'call',
			'Tony Aldridge',
			'Harvey Reid',
			'lead:#1081',
			15,
			'Book a supervisors demo',
			'All three supervisors on one call.',
		],
		[
			3182,
			'10-09 14:00',
			'meeting',
			'Elise Vick',
			'Marshall McCall',
			'lead:#1068',
			45,
			'Quote call with TechnoPro',
			'Walk through the quote with the French portal. TechnoPro joins.',
		],
		[
			3181,
			'10-09 15:00',
			'meeting',
			'John Armstrong',
			'Ben Carlisle',
			'lead:#1061',
			30,
			'Halfway trial review',
			'Before he scores the three tools on the shortlist.',
		],
		[
			3180,
			'10-09 16:30',
			'call',
			'John Armstrong',
			'Dana Holloway',
			'deal:#2041',
			15,
			'Check in after the board',
			'Dana planned to sign after Thursday’s board call.',
		],
	];

	/* Planned across the coming week. */
	const THIS_WEEK = [
		[
			3179,
			'10-10 09:00',
			'email',
			'Thomas Morrison',
			'Candace Hartnett',
			'lead:#1072',
			0,
			'Send a repeat-visit example',
			'Weekly rounds for 400 pools.',
		],
		[
			3178,
			'10-10 11:00',
			'call',
			'Quentin Cook',
			'Connie Strickland',
			'lead:#1059',
			20,
			'Call Connie about new hires',
			'Seats for this month’s starters.',
		],
		[
			3177,
			'10-12 10:00',
			'email',
			'Tony Aldridge',
			'Addison Gallagher',
			'lead:#1070',
			0,
			'Follow up on the guide',
			'She had the shared equipment guide on October 1.',
		],
		[
			3176,
			'10-12 13:00',
			'call',
			'Leslie Ashby',
			'Brooke Shepherd',
			'deal:#2038',
			15,
			'Check in with Brooke',
			'She signs once her business partner has read it.',
		],
		[
			3175,
			'10-13 10:30',
			'meeting',
			'John Armstrong',
			'Denise Quigley',
			'deal:#2026',
			30,
			'Missed visit numbers',
			'Denise wants the numbers on missed visits before SMS credits.',
		],
		[
			3174,
			'10-13 15:00',
			'call',
			'Tony Aldridge',
			'Graham Hartley',
			'deal:#2033',
			20,
			'Agree monthly billing',
			'Monthly for the first three months, then yearly.',
		],
		[
			3173,
			'10-14 11:00',
			'meeting',
			'Leslie Ashby',
			'Carla Malone',
			'deal:#2017',
			30,
			'Renewal sign-off',
			'Carla signs the renewal with the eight new seats on it.',
		],
		[
			3172,
			'10-14 09:00',
			'email',
			'John Armstrong',
			'Rachel Beck',
			'deal:#2009',
			0,
			'Chase the order form',
			'Pamela needs a purchase order before Rachel signs.',
		],
		[
			3171,
			'10-15 14:00',
			'meeting',
			'John Armstrong',
			'Connie Sexton',
			'company:highpoint',
			60,
			'Quarterly review',
			'Usage, the Portsmouth branch and training dates.',
		],
		[
			3170,
			'10-16 10:00',
			'meeting',
			'John Armstrong',
			'Monica Hale',
			'deal:#2045',
			60,
			'Security review with IT',
			'Their IT team brings the security questionnaire.',
		],
	];

	/* Already handled, most recent first. */
	const COMPLETED = [
		[
			3169,
			'10-09 10:00',
			'call',
			'John Armstrong',
			'Tom Whitaker',
			'lead:#1057',
			20,
			'Call Tom and his finance lead',
			'Agreed the quote before the trial ends. Finance wants yearly billing.',
		],
		[
			3168,
			'10-09 09:45',
			'email',
			'Jeffrey McKay',
			'Melvin Thornton',
			'lead:#1085',
			0,
			'Reply about billing in reais',
			'Finance confirmed we can invoice in reais from November.',
		],
		[
			3167,
			'10-08 16:10',
			'note',
			'John Armstrong',
			'Dan Mercer',
			'deal:#2013',
			0,
			'Portsmouth opens in January',
			'Dan signs off the training by the 22nd. Price 12 seats after that.',
		],
		[
			3166,
			'10-07 15:20',
			'email',
			'John Armstrong',
			'Monica Hale',
			'deal:#2045',
			0,
			'Sent the Max proposal',
			'Max for 70 seats, with the workshop notes attached.',
		],
		[
			3165,
			'10-07 11:05',
			'email',
			'John Armstrong',
			'Rachel Beck',
			'deal:#2009',
			0,
			'Sent the order form',
			'Customer Portal for 42 seats.',
		],
		[
			3164,
			'10-07 09:30',
			'call',
			'Thomas Morrison',
			'Elsie Kerr',
			'deal:#2046',
			25,
			'Agreed a start date',
			'They start on November 2. Seat count to confirm.',
		],
		[
			3163,
			'10-06 14:40',
			'email',
			'Leslie Ashby',
			'Carla Malone',
			'deal:#2017',
			0,
			'Sent the renewal quote',
			'94 seats on Max, eight more than today.',
		],
		[
			3162,
			'10-06 10:15',
			'email',
			'John Armstrong',
			'Dana Holloway',
			'deal:#2041',
			0,
			'Sent the contract',
			'Max for 80 seats, out for signature.',
		],
		[
			3161,
			'10-06 09:00',
			'call',
			'Leslie Ashby',
			'Mae Morrow',
			'company:lakeside',
			20,
			'Check-in call',
			'Happy with the schedule board. Asked about holiday cover.',
		],
		[
			3160,
			'10-06 08:30',
			'email',
			'Thomas Morrison',
			'Derrick Yost',
			'deal:#2028',
			0,
			'Sent the renewal quote',
			'Six more seats for the two new contracts.',
		],
		[
			3159,
			'10-05 13:00',
			'meeting',
			'Leslie Ashby',
			'Gina Carlson',
			'deal:#2049',
			30,
			'First call with Gina',
			'22 pool cleaners across three counties.',
		],
		[
			3158,
			'10-05 10:00',
			'meeting',
			'Elise Vick',
			'Kathy Schultz',
			'deal:#2042',
			30,
			'First call with Kathy',
			'18 cleaners on paper visit sheets.',
		],
		[
			3157,
			'10-05 09:10',
			'email',
			'Tony Aldridge',
			'Addison Brennan',
			'deal:#2021',
			0,
			'Sent the Max proposal',
			'Audit logs and single sign-on included.',
		],
		[
			3156,
			'10-05 19:15',
			'email',
			'Leslie Ashby',
			'Charles Mosley',
			'lead:#1076',
			0,
			'Sent the mobile app tour',
			'They decide once summer ends.',
		],
		[
			3155,
			'10-04 11:00',
			'meeting',
			'Tony Aldridge',
			'Leslie Price',
			'deal:#2023',
			30,
			'Customer Portal intro',
			'Interested, but the renewal is paid first.',
		],
		[
			3154,
			'10-03 14:00',
			'email',
			'John Armstrong',
			'Denise Quigley',
			'deal:#2026',
			0,
			'Quoted SMS credits',
			'10,000 credits a month for visit reminders.',
		],
		[
			3153,
			'10-02 16:30',
			'note',
			'Jeffrey McKay',
			'Randall Hatcher',
			'deal:#2030',
			0,
			'Wants audit logs first',
			'Discovery call: audit logs and single sign-on decide it.',
		],
		[
			3152,
			'10-01 15:00',
			'meeting',
			'Quentin Cook',
			'Lindsay Kinney',
			'deal:#2015',
			45,
			'Customer Portal demo',
			'The care team liked it. Price it for both branches.',
		],
	];

	/* The page lists activities in exactly this order, so the groups stay in it. */
	const LOG = [
		...OVERDUE.map((line) => [line, false]),
		...LATER_TODAY.map((line) => [line, false]),
		...THIS_WEEK.map((line) => [line, false]),
		...COMPLETED.map((line) => [line, true]),
	];

	/* Hands the log to the page under window.Basalt.data.activities. */
	function publish() {
		window.Basalt.data = window.Basalt.data || {};
		window.Basalt.data.activities = {
			now: CLOCK,
			today: CLOCK.slice(0, 10),
			me: SIGNED_IN,
			types: KINDS,
			list: () => LOG.map(([line, done]) => expand(line, done)),
			find: (id) => {
				const hit = LOG.find(([line]) => `#${line[0]}` === id);
				return hit ? expand(...hit) : null;
			},
		};
	}

	/**
	 * Turns one compact line into the object shape the page reads, building
	 * fresh objects every time so edits on the page never reach the source.
	 * @param {Array} line   one entry from the groups above
	 * @param {boolean} done whether its group is already completed
	 * @returns {{id: string, type: string, title: string, at: string, done: boolean,
	 *   owner: string, with: string, rel: {kind: string, id: string}, minutes: number, notes: string}}
	 */
	function expand(line, done) {
		const [number, when, kind, owner, contact, link, minutes, title, notes] = line;
		const split = link.indexOf(':');
		return {
			id: `#${number}`,
			type: kind,
			title,
			at: `${YEAR}-${when.replace(' ', 'T')}`,
			done,
			owner,
			with: contact,
			rel: { kind: link.slice(0, split), id: link.slice(split + 1) },
			minutes,
			notes,
		};
	}

	publish();
})();
