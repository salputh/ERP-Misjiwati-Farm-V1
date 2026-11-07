/**
 * Who each campaign, renewal notice and offer goes to. segments.html
 * lists every audience and segment-details.html?id=fleets opens one,
 * and both read it from here so names, sizes, rules and sends agree.
 * Members point at the customer accounts in accounts.js, so that file has
 * to be loaded before this one.
 *
 * A production build would fetch this from its own API; treat the records
 * below as the contract the two pages are written against.
 *
 * window.Basalt.data.customerGroups exposes:
 *   total, companyMrr      accounts on the books (paying or trialing) and
 *                          what the whole book bills per month
 *   now                    the fixed "today" of the demo (use new Date())
 *   fields                 everything an audience rule is able to check
 *   list(), find(id)       detached copies the pages are free to edit;
 *                          find returns null for an unknown id
 *   estimate(rules, saved) a ballpark member count for a rule set
 *   sameRules(a, b)        whether two rule sets are identical
 */
(() => {
	'use strict';

	const BOOK_SIZE = 2140;
	const BOOK_MRR = 880000;
	const DEMO_TODAY = new Date('2026-10-09T10:00:00');

	/* Rule fields in the order the pickers offer them. A field with values
     is a fixed choice; any other takes a whole number, and unit is the
     word shown after that number. */
	const RULE_FIELDS = {
		plan: { label: 'Plan', ops: ['is', 'is not'], values: ['Basic', 'Pro', 'Max', 'Trial'] },
		seats: { label: 'Seats', ops: ['at least', 'at most'] },
		branches: { label: 'Offices', ops: ['at least', 'at most'] },
		visits: { label: 'Visits per week', ops: ['at least', 'at most'] },
		lastVisit: { label: 'Last visit booked', ops: ['more than', 'less than'], unit: 'days ago' },
		score: { label: 'Survey score', ops: ['at least', 'at most'], max: 10 },
		region: {
			label: 'Region',
			ops: ['is', 'is not'],
			values: ['Northeast', 'Midwest', 'West', 'South'],
		},
		travelPlan: { label: 'Travel Planner', ops: ['is'], values: ['Added', 'Not added'] },
		trialEnds: { label: 'Trial ends', ops: ['before', 'after'], values: ['Oct 15', 'Oct 31', 'Nov 15', 'Nov 30'] },
	};

	/* How the estimator models each field: share(value, number) is the part
     of the book a rule keeps under the operator named in keepsWith, and
     the remainder under the other one. With no keepsWith the operator is
     not consulted. Fields missing here leave the count untouched. */
	const FIELD_MODELS = {
		plan: { keepsWith: 'is', share: (value) => ({ Basic: 0.52, Pro: 0.34, Max: 0.09, Trial: 0.05 })[value] },
		seats: { keepsWith: 'at least', share: (value, number) => Math.exp(-number / 45) },
		branches: { keepsWith: 'at least', share: (value, number) => Math.pow(0.66, Math.max(number - 1, 0)) },
		visits: { keepsWith: 'at least', share: (value, number) => Math.exp(-number / 260) },
		lastVisit: {
			keepsWith: 'more than',
			share: (value, number) => Math.min(1, 0.5 * Math.exp(-(number - 30) / 90)),
		},
		score: { keepsWith: 'at least', share: (value, number) => Math.max(0.04, Math.min(1, (11 - number) * 0.1)) },
		region: {
			keepsWith: 'is',
			share: (value) => ({ Northeast: 0.58, Midwest: 0.23, West: 0.12, South: 0.07 })[value],
		},
		travelPlan: { share: (value) => (value === 'Added' ? 0.3 : 0.7) },
		trialEnds: {
			keepsWith: 'before',
			share: (value) => ({ 'Oct 15': 0.3, 'Oct 31': 0.55, 'Nov 15': 0.75, 'Nov 30': 0.9 })[value],
		},
	};

	/* Every record's fields, briefly:
     - kind is set by the builder: ruled() fills itself from its rules,
       listed() holds accounts added by hand or imported, and withheld()
       is a suppression that every send leaves out.
     - tone picks chart color 1 to 8, or danger / muted.
     - members counts accounts today and mrr is their monthly bill; mrr
       stays null while all of them are trialing, and potential then says
       what they would bill once converted.
     - rules must all hold for a segment; how says how a list or a
       suppression gets its accounts.
     - sample is a few [account id, optional fact] pairs, and factLabel is
       the heading of the fact column.
     - trend is the member count at the close of each of the last 12
       weeks, oldest first, ending on today.
     - joined and left cover the past 30 days, and moves are the newest of
       those as [account id, in or out, date, reason].
     - mix splits members across starter, growth, enterprise and trial.
     - uses are the sends that target this audience, each with a short
       progress note; skips are sends a suppression kept accounts out of.
     - history lists edits newest first as [timestamp, by, change, icon]. */
	const AUDIENCES = [
		/* Rule-based segments. */
		ruled({
			id: 'fleets',
			name: 'Large Teams',
			icon: 'people',
			tone: 1,
			desc: 'Max accounts with 50+ staff on site',
			updated: '2026-10-09T09:20',
			members: 64,
			mrr: 315500,
			mix: { enterprise: 64 },
			rules: [when('plan', 'is', 'Max'), when('seats', 'at least', '50')],
			sample: [['lumoraai'], ['oakhaven'], ['harborline'], ['rainier']],
			joined: 5,
			left: 1,
			trend: [52, 53, 55, 55, 56, 58, 59, 60, 61, 62, 62, 64],
			moves: [
				['rainier', 'in', '2026-10-06', 'Grew to 54 seats'],
				['harborline', 'in', '2026-09-29', 'Grew to 58 seats'],
				['highpoint', 'out', '2026-09-22', 'Went down to 31 seats'],
			],
			uses: [
				campaign(
					'Q4 renewal reminder',
					'Email',
					'Scheduled Oct 14',
					'info',
					'reply-templates.html',
					'Goes to 64 accounts at 9:00 am',
				),
				campaign(
					'SMS credit bundle',
					'Add-on offer',
					'Live',
					'success',
					'promo-codes.html',
					'Used 9 times since Sep 21',
				),
			],
			history: [
				['2026-10-02T11:40', 'Leslie Ashby', 'Picked it for the Q4 renewal reminder', 'envelope'],
				['2026-09-21T15:05', 'Elise Vick', 'Picked it for the Vehicle mount bundle offer', 'ticket-perforated'],
				['2026-08-14T10:20', 'John Armstrong', 'Changed Seats from at least 40 to at least 50', 'funnel'],
				['2026-06-03T09:15', 'John Armstrong', 'Made the segment', 'plus-lg'],
			],
		}),
		ruled({
			id: 'multisite',
			name: 'Multi-Depot Teams',
			icon: 'geo-alt',
			tone: 2,
			desc: 'Booking visits from five or more offices',
			updated: '2026-10-09T09:05',
			members: 182,
			mrr: 201400,
			mix: { starter: 12, growth: 104, enterprise: 66 },
			rules: [when('branches', 'at least', '5')],
			factLabel: 'Depots',
			sample: [
				['redline', '7 offices'],
				['lumoraai', '6 offices'],
				['harborline', '5 offices'],
				['oakhaven', '5 offices'],
				['volt', '5 offices'],
			],
			joined: 11,
			left: 3,
			trend: [158, 161, 163, 166, 168, 170, 171, 174, 176, 178, 180, 182],
			moves: [
				['volt', 'in', '2026-10-07', 'Opened a fifth office'],
				['oakhaven', 'in', '2026-09-30', 'Opened a fifth office'],
				['lakeside', 'out', '2026-09-24', 'Closed an office, now four'],
			],
			uses: [
				campaign('Depot routing webinar', 'Announcement', 'Draft', '', 'announcements.html', 'Not sent yet'),
			],
			history: [
				['2026-10-06T14:30', 'Leon Whitby', 'Picked it for the Depot routing webinar', 'megaphone'],
				['2026-07-22T16:10', 'Leon Whitby', 'Changed Depots from at least 4 to at least 5', 'funnel'],
				['2026-05-11T10:00', 'Leon Whitby', 'Made the segment', 'plus-lg'],
			],
		}),
		ruled({
			id: 'quiet',
			name: 'Quiet Since Spring',
			icon: 'moon-stars',
			tone: 6,
			desc: 'No visit booked in the last 90 days',
			updated: '2026-10-09T09:35',
			members: 117,
			mrr: 24800,
			mix: { starter: 81, growth: 36 },
			rules: [when('lastVisit', 'more than', '90'), when('plan', 'is not', 'Max')],
			factLabel: 'Quiet for',
			sample: [
				['ironwood', '128 days'],
				['desertbloom', '117 days'],
				['prairie', '104 days'],
				['vistalandscaping', '96 days'],
			],
			joined: 21,
			left: 12,
			trend: [64, 70, 78, 85, 91, 97, 104, 108, 112, 115, 113, 117],
			moves: [
				['vistalandscaping', 'in', '2026-10-08', '90 days without a visit'],
				['fernhill', 'out', '2026-10-03', 'Booked 14 visits this week'],
				['prairie', 'in', '2026-09-25', '90 days without a visit'],
			],
			uses: [
				campaign(
					'We miss you check-in',
					'Email',
					'Sending',
					'primary',
					'reply-templates.html',
					'Sent to 117 · 41% opened',
				),
			],
			history: [
				['2026-10-02T08:00', 'Leslie Ashby', 'Started sending We miss you check-in', 'envelope'],
				['2026-09-08T13:25', 'Leslie Ashby', 'Added the rule Plan is not Max', 'funnel'],
				['2026-06-30T11:50', 'Leslie Ashby', 'Made the segment', 'plus-lg'],
			],
		}),
		ruled({
			id: 'trials',
			name: 'Trials Ending in October',
			icon: 'hourglass-split',
			tone: 4,
			desc: 'Free trials that end before October 31',
			updated: '2026-10-09T09:45',
			members: 96,
			mrr: null,
			potential: 27400,
			mix: { trial: 96 },
			rules: [when('plan', 'is', 'Trial'), when('trialEnds', 'before', 'Oct 31')],
			factLabel: 'Trial ends',
			sample: [
				['oakmont', 'Oct 11'],
				['brookside', 'Oct 13'],
				['sunvale', 'Oct 14'],
				['coastline', 'Oct 15'],
				['alder', 'Oct 19'],
			],
			joined: 19,
			left: 2,
			trend: [41, 47, 52, 58, 63, 70, 74, 79, 83, 88, 92, 96],
			moves: [
				['alder', 'in', '2026-10-05', 'Started a Pro trial'],
				['coastline', 'in', '2026-10-01', 'Started a Pro trial'],
				['sunvale', 'in', '2026-09-30', 'Started a Max trial'],
			],
			uses: [
				campaign(
					'Your trial ends in 3 days',
					'Automatic email',
					'Always on',
					'success',
					'reply-templates.html',
					'38 sent this month',
				),
			],
			history: [
				[
					'2026-09-30T17:00',
					'Tony Aldridge',
					'Changed Trial ends from before Sep 30 to before Oct 31',
					'funnel',
				],
				['2026-08-28T10:40', 'Tony Aldridge', 'Picked it for Your trial ends in 3 days', 'arrow-repeat'],
				['2026-08-28T10:30', 'Tony Aldridge', 'Made the segment', 'plus-lg'],
			],
		}),
		ruled({
			id: 'promoters',
			name: 'Promoters',
			icon: 'star',
			tone: 5,
			desc: 'Scored 9 or 10 in the September survey',
			updated: '2026-10-09T09:10',
			members: 412,
			mrr: 214300,
			mix: { starter: 168, growth: 171, enterprise: 73 },
			rules: [when('score', 'at least', '9')],
			factLabel: 'Score',
			sample: [
				['oakhaven', '10'],
				['bluepeak', '10'],
				['valleypetcare', '9'],
				['brightwater', '9'],
				['evergreen', '9'],
			],
			joined: 39,
			left: 2,
			trend: [371, 371, 372, 372, 373, 373, 374, 375, 398, 409, 411, 412],
			moves: [
				['brightwater', 'in', '2026-09-16', 'Scored 9 in September'],
				['valleypetcare', 'in', '2026-09-16', 'Scored 9 in September'],
				['ironbridge', 'out', '2026-09-16', 'Scored 6 in September'],
			],
			uses: [
				campaign(
					'Refer a peer',
					'Email',
					'Sending',
					'primary',
					'reply-templates.html',
					'Sent to 412 · 9 referrals so far',
				),
				campaign(
					'Leave us a review',
					'Automatic email',
					'Always on',
					'success',
					'reply-templates.html',
					'57 reviews since June',
				),
			],
			history: [
				['2026-09-29T09:00', 'Elise Vick', 'Started sending Refer a peer', 'envelope'],
				['2026-09-16T08:00', 'Fieldline', 'September survey results came in: 23 joined', 'clipboard-data'],
				['2026-06-12T15:20', 'Elise Vick', 'Picked it for Leave us a review', 'arrow-repeat'],
				['2026-06-12T15:00', 'Elise Vick', 'Made the segment', 'plus-lg'],
			],
		}),
		ruled({
			id: 'route',
			name: 'Travel Planner Prospects',
			icon: 'signpost-split',
			tone: 3,
			desc: 'Pro accounts that plan travel by hand',
			updated: '2026-10-09T09:30',
			members: 238,
			mrr: 228500,
			mix: { growth: 238 },
			rules: [
				when('plan', 'is', 'Pro'),
				when('travelPlan', 'is', 'Not added'),
				when('visits', 'at least', '200'),
			],
			sample: [
				['redline', '410'],
				['millrace', '362'],
				['copperleaf', '298'],
				['cornerstone', '244'],
				['northbrook', '215'],
			],
			factLabel: 'Visits a week',
			joined: 6,
			left: 14,
			trend: [262, 259, 257, 255, 252, 250, 248, 246, 244, 242, 240, 238],
			moves: [
				['moorings', 'out', '2026-10-07', 'Down to 180 visits a week'],
				['solaris', 'out', '2026-10-02', 'Down to 190 visits a week'],
				['northbrook', 'in', '2026-09-28', 'Reached 215 visits a week'],
			],
			uses: [],
			history: [
				['2026-09-03T12:15', 'Thomas Morrison', 'Added the rule Visits per week at least 200', 'funnel'],
				['2026-07-01T09:30', 'Thomas Morrison', 'Made the segment', 'plus-lg'],
			],
		}),
		ruled({
			id: 'midwest',
			name: 'Midwest',
			icon: 'compass',
			tone: 7,
			desc: 'Accounts billed from the Duluth office',
			updated: '2026-10-09T09:50',
			members: 486,
			mrr: 198200,
			mix: { starter: 214, growth: 211, enterprise: 48, trial: 13 },
			rules: [when('region', 'is', 'Midwest')],
			sample: [['rainier'], ['valleypetcare'], ['avocet'], ['northbrook'], ['luminary']],
			joined: 15,
			left: 3,
			trend: [452, 455, 459, 462, 465, 468, 471, 474, 478, 481, 483, 486],
			moves: [
				['alder', 'in', '2026-10-05', 'Started a trial in Duluth'],
				['oakmont', 'in', '2026-09-27', 'Started a trial in Oshkosh'],
				['skerry', 'in', '2026-09-15', 'Moved billing to Duluth'],
			],
			uses: [
				campaign(
					'Price change notice',
					'Announcement',
					'Scheduled Nov 1',
					'info',
					'announcements.html',
					'Goes to 486 accounts',
				),
			],
			history: [
				['2026-10-01T10:05', 'Jeffrey McKay', 'Picked it for the Price change notice', 'megaphone'],
				['2026-02-17T14:45', 'Jeffrey McKay', 'Made the segment', 'plus-lg'],
			],
		}),

		/* Hand-kept lists. */
		listed({
			id: 'renewals',
			name: 'November Add-on Renewals',
			icon: 'arrow-repeat',
			tone: 8,
			desc: 'Add-on seats that renew in November',
			updated: '2026-09-12T14:10',
			members: 58,
			mrr: 41800,
			mix: { growth: 39, enterprise: 19 },
			factLabel: 'Renews',
			how: 'Imported from a CSV by Lindsay Kinney on Sep 12.',
			sample: [
				['lumoraai', 'Nov 2'],
				['polarair', 'Nov 11'],
			],
			joined: 58,
			left: 0,
			trend: [0, 0, 0, 0, 0, 0, 0, 0, 58, 58, 58, 58],
			moves: [
				['polarair', 'in', '2026-09-12', 'In the September import'],
				['lumoraai', 'in', '2026-09-12', 'In the September import'],
			],
			uses: [
				campaign(
					'Add-on renewal notice',
					'Email',
					'Scheduled Oct 20',
					'info',
					'reply-templates.html',
					'Goes to 58 accounts',
				),
			],
			history: [
				['2026-09-15T09:30', 'Lindsay Kinney', 'Picked it for the Add-on renewal notice', 'envelope'],
				['2026-09-12T14:10', 'Lindsay Kinney', 'Imported 58 accounts from a CSV', 'upload'],
				['2026-09-12T14:05', 'Lindsay Kinney', 'Made the list', 'plus-lg'],
			],
		}),
		listed({
			id: 'training',
			name: 'Live Training, Nov 12',
			icon: 'easel',
			tone: 2,
			desc: 'Booked onto scheduling training',
			updated: '2026-10-03T11:25',
			members: 22,
			mrr: 18900,
			mix: { starter: 5, growth: 13, enterprise: 4 },
			factLabel: 'Booked',
			how: 'Added by Tom Becker as bookings came in. Last change Oct 3.',
			sample: [
				['copperleaf', '2 seats'],
				['cedarfell', '2 seats'],
				['clearview', '2 seats'],
				['halden', '1 seat'],
				['polarair', '1 seat'],
			],
			joined: 13,
			left: 0,
			trend: [0, 0, 0, 0, 0, 0, 4, 9, 13, 17, 20, 22],
			moves: [
				['clearview', 'in', '2026-10-03', 'Booked 2 seats'],
				['halden', 'in', '2026-10-03', 'Booked 1 seat'],
				['cedarfell', 'in', '2026-09-24', 'Booked 2 seats'],
			],
			uses: [
				campaign(
					'Training joining link',
					'Email',
					'Scheduled Nov 11',
					'info',
					'reply-templates.html',
					'Goes to 22 accounts',
				),
			],
			history: [
				['2026-10-03T11:25', 'Tom Becker', 'Added Clearview Windows and Halden Robotics', 'person-plus'],
				['2026-09-24T16:00', 'Tom Becker', 'Added 4 accounts', 'person-plus'],
				['2026-09-01T10:10', 'Tom Becker', 'Made the list', 'plus-lg'],
			],
		}),
		listed({
			id: 'po',
			name: 'Pay by Purchase Order',
			icon: 'receipt',
			tone: 5,
			desc: 'Invoiced on terms, not by card',
			updated: '2026-08-31T16:40',
			members: 26,
			mrr: 86400,
			mix: { growth: 6, enterprise: 20 },
			factLabel: 'Terms',
			how: 'Added by Hope Stout when terms are agreed. Last change Aug 31.',
			sample: [
				['highpoint', 'Net 30'],
				['lumoraai', 'Net 30'],
				['bluepeak', 'Net 30'],
				['harborline', 'Net 30'],
				['tamara', 'Net 30'],
			],
			joined: 0,
			left: 0,
			trend: [22, 22, 23, 23, 24, 24, 26, 26, 26, 26, 26, 26],
			moves: [
				['tamara', 'in', '2026-08-31', 'Net 30 terms agreed'],
				['bluepeak', 'in', '2026-08-31', 'Net 30 terms agreed'],
				['highpoint', 'in', '2026-07-14', 'Net 30 terms agreed'],
			],
			uses: [
				campaign(
					'Monthly statement',
					'Automatic email',
					'Always on',
					'success',
					'invoices.html',
					'Last sent Oct 1',
				),
			],
			history: [
				[
					'2026-08-31T16:40',
					'Hope Stout',
					'Added Tamara Skincare Services and Bluepeak Studios',
					'person-plus',
				],
				['2026-07-14T11:00', 'Hope Stout', 'Added Highpoint Outfitters', 'person-plus'],
				['2025-11-03T09:20', 'Hope Stout', 'Made the list', 'plus-lg'],
			],
		}),
		listed({
			id: 'advisory',
			name: 'Customer Advisory Board',
			icon: 'people',
			tone: 1,
			desc: 'Owners who try new features first',
			updated: '2026-09-18T10:05',
			members: 12,
			mrr: 31200,
			mix: { growth: 5, enterprise: 7 },
			how: 'Added by John Armstrong. Last change Sep 18.',
			joined: 2,
			left: 0,
			sample: [['lumoraai'], ['oakhaven'], ['bluepeak'], ['redline'], ['valleypetcare']],
			trend: [10, 10, 10, 10, 10, 10, 10, 10, 11, 12, 12, 12],
			moves: [
				['valleypetcare', 'in', '2026-09-18', 'Invited by John Armstrong'],
				['redline', 'in', '2026-09-11', 'Invited by John Armstrong'],
			],
			uses: [
				campaign(
					'Offline mode beta',
					'Announcement',
					'Live',
					'success',
					'announcements.html',
					'9 of 12 have turned it on',
				),
			],
			history: [
				['2026-09-24T10:00', 'John Armstrong', 'Picked it for the Offline mode beta', 'megaphone'],
				['2026-09-18T10:05', 'John Armstrong', 'Added Valley Pet Care', 'person-plus'],
				['2026-09-11T15:30', 'John Armstrong', 'Added Redline Motion', 'person-plus'],
				['2026-03-02T09:00', 'John Armstrong', 'Made the list', 'plus-lg'],
			],
		}),

		/* Suppressions: no send ever reaches these accounts. */
		withheld({
			id: 'credit',
			name: 'Credit Hold',
			icon: 'slash-circle',
			tone: 'danger',
			desc: 'Overdue, so no offers until paid',
			updated: '2026-10-05T09:10',
			members: 6,
			mrr: 1140,
			mix: { starter: 2, growth: 4 },
			factLabel: 'Overdue',
			how: 'Added by Hope Stout when a bill is past due.',
			sample: [
				['aspenhollow', '20 days'],
				['copperleaf', '13 days'],
				['luminary', '6 days'],
				['clearwater', '4 days'],
			],
			joined: 4,
			left: 2,
			trend: [3, 4, 4, 5, 5, 4, 4, 4, 3, 4, 4, 6],
			moves: [
				['clearwater', 'in', '2026-10-05', 'Bill past due'],
				['luminary', 'in', '2026-10-03', 'Bill past due'],
				['halden', 'out', '2026-10-01', 'Bill paid'],
			],
			skips: [
				skipped('We miss you check-in', 'Email', 'Oct 2', 2),
				skipped('Refer a peer', 'Email', 'Sep 29', 3),
				skipped('SMS credit bundle', 'Add-on offer', 'Since Sep 21', 4),
			],
			history: [
				['2026-10-05T09:10', 'Hope Stout', 'Added Clearwater Surf Co.', 'person-plus'],
				['2026-10-03T11:20', 'Hope Stout', 'Added Lumière Électricité', 'person-plus'],
				['2026-10-01T16:45', 'Hope Stout', 'Removed Halden Robotics, bill paid', 'person-dash'],
				['2026-09-26T10:15', 'Hope Stout', 'Added Copperleaf Design', 'person-plus'],
				['2026-09-19T09:40', 'Hope Stout', 'Added Aguaclara Plomería', 'person-plus'],
				['2025-10-20T14:00', 'Hope Stout', 'Made the suppression', 'plus-lg'],
			],
		}),
		withheld({
			id: 'optout',
			name: 'Opted Out of Marketing',
			icon: 'envelope-slash',
			tone: 'muted',
			desc: 'Asked for service emails only',
			updated: '2026-10-02T08:15',
			members: 31,
			mrr: 14900,
			mix: { starter: 17, growth: 12, enterprise: 2 },
			factLabel: 'Since',
			how: 'Filled by the unsubscribe link in every campaign. Last change Oct 2.',
			sample: [
				['cedarfell', 'Oct 2'],
				['evergreen', 'Sep 21'],
				['tidewater', 'Sep 9'],
				['fernhill', 'Aug 28'],
				['clearview', 'Aug 14'],
			],
			joined: 3,
			left: 0,
			trend: [22, 23, 24, 24, 25, 26, 27, 28, 29, 30, 31, 31],
			moves: [
				['cedarfell', 'in', '2026-10-02', 'Used the unsubscribe link'],
				['evergreen', 'in', '2026-09-21', 'Used the unsubscribe link'],
				['tidewater', 'in', '2026-09-09', 'Used the unsubscribe link'],
			],
			skips: [
				skipped('We miss you check-in', 'Email', 'Oct 2', 6),
				skipped('Refer a peer', 'Email', 'Sep 29', 11),
				skipped('Offline mode beta', 'Announcement', 'Sep 24', 1),
			],
			history: [
				['2026-10-02T08:15', 'Fieldline', 'Cedar Fell Landscaping unsubscribed', 'envelope-slash'],
				['2026-09-21T12:30', 'Fieldline', 'Evergreen Landscaping unsubscribed', 'envelope-slash'],
				['2026-09-09T18:05', 'Fieldline', 'Tidewater Swimwear unsubscribed', 'envelope-slash'],
				['2024-04-08T10:00', 'John Armstrong', 'Made the suppression', 'plus-lg'],
			],
		}),
	];

	publish();

	/** Hands the audiences and their helpers to the pages. */
	function publish() {
		const shared = window.Basalt.data || {};
		window.Basalt.data = shared;
		shared.customerGroups = {
			total: BOOK_SIZE,
			companyMrr: BOOK_MRR,
			now: DEMO_TODAY,
			fields: RULE_FIELDS,
			list: listAudiences,
			find: findAudience,
			estimate: estimateMembers,
			sameRules: rulesMatch,
		};
	}

	/** @returns {object[]} a detached copy of every audience, in display order */
	function listAudiences() {
		return AUDIENCES.map(detach);
	}

	/** @returns {object|null} a detached copy of the audience with this id */
	function findAudience(id) {
		const hit = AUDIENCES.find((audience) => audience.id === id);
		return hit ? detach(hit) : null;
	}

	/**
	 * Ballpark member count for a set of rules. Demo only: each rule keeps a
	 * modeled share of the book and the shares multiply; a real backend
	 * would count the matching accounts.
	 * @param {object[]} rules  the rules being edited
	 * @param {object} [saved]  the audience as stored; while its rules are
	 *                          unchanged its real member count is returned
	 */
	function estimateMembers(rules, saved) {
		if (saved && rulesMatch(rules, saved.rules)) return saved.members;
		let tally = BOOK_SIZE;
		for (const rule of rules) tally *= keptShare(rule);
		return Math.round(tally);
	}

	/** Two rule sets match when they serialize to the same text. */
	function rulesMatch(left, right) {
		return JSON.stringify(left) === JSON.stringify(right);
	}

	/** The part of the book (0 to 1) a single rule lets through. */
	function keptShare(rule) {
		const model = FIELD_MODELS[rule.field];
		if (!model) return 1;
		const part = model.share(rule.value, Number.parseInt(rule.value, 10));
		if (!model.keepsWith) return part;
		return rule.op === model.keepsWith ? part : 1 - part;
	}

	/* Detaches a record from the source array, filling in the collections
     a page can expect to find even when a record leaves them out. */
	function detach(audience) {
		const filled = { rules: [], trend: [], mix: {}, uses: [], history: [], ...audience };
		return JSON.parse(JSON.stringify(filled));
	}

	/* Record builders, so each record only spells out what is its own. */
	function ruled(fields) {
		return { kind: 'segment', ...fields };
	}

	function listed(fields) {
		return { kind: 'list', ...fields };
	}

	function withheld(fields) {
		return { kind: 'suppression', uses: [], ...fields };
	}

	function when(field, op, value) {
		return { field, op, value };
	}

	function campaign(name, type, status, tone, href, note) {
		return { name, type, status, tone, href, note };
	}

	function skipped(name, type, sentOn, count) {
		return { name, type, when: sentOn, count };
	}
})();
