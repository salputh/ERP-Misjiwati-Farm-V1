/**
 * Helpdesk fixtures for Fieldline, published as window.Basalt.data.support.
 * The ticket queue (tickets.html) and a single ticket's page
 * (ticket-details.html?id=%2320417) both read from here, which is why one
 * ticket looks identical in either place. Every timestamp is stored as a
 * number of minutes before the fixed clock below, so the demo never ages.
 * Replace it with your own records; the pages only care about the shape.
 */
(() => {
	'use strict';

	/* A frozen clock: Friday, October 2, 2026 at 10:40. A live app would pass new Date(). */
	const clock = new Date(2026, 9, 2, 10, 40);
	const signedIn = 'ja';

	/* Seats are priced per month; reply targets are minutes, looked up by plan and then priority. */
	const seatPrice = { Basic: 15, Pro: 32, Max: 58 };
	const replyTargets = {
		Basic: within(120, 240, 480, 1440),
		Pro: within(60, 120, 480, 1440),
		Max: within(30, 60, 240, 720),
	};

	/* Everyone who answers tickets, with the presence shown beside their avatar. */
	const staff = [
		{ id: 'ja', presence: 'online', name: 'John Armstrong', title: 'Chief Technology Officer' },
		{ id: 'pr', presence: 'online', name: 'Connie Reese', title: 'Support lead' },
		{ id: 'ab', presence: 'online', name: 'Alexis Boone', title: 'Support' },
		{ id: 'cm', presence: 'away', name: 'Casey Martin', title: 'Support, Midwest' },
		{ id: 'dr', presence: 'busy', name: 'Randall Rhodes', title: 'Support' },
		{ id: 'hs', presence: 'offline', name: 'Hope Stout', title: 'Billing, Finance' },
	];

	/* Escalation targets. A "who" of csm stands for whichever account manager owns the customer. */
	const handoffTeams = [
		{
			id: 'eng',
			icon: 'bi-cpu',
			name: 'Engineering',
			hint: 'Bugs and outages',
			who: 'Jim Atkins is on call today',
		},
		{ id: 'success', icon: 'bi-person-heart', name: 'Success', hint: 'Account and renewals', who: 'csm' },
		{
			id: 'billing',
			icon: 'bi-receipt',
			name: 'Billing',
			hint: 'Refunds and invoices',
			who: 'Hope Stout, Finance',
		},
		{
			id: 'product',
			icon: 'bi-lightbulb',
			name: 'Product',
			hint: 'Requests and feedback',
			who: 'Leslie Whitlock reads these on Mondays',
		},
	];

	/* These accounts match assets/basalt/js/data/multipurpose/accounts.js field for field: plan, seats,
     city, manager and add-ons. The mrr figure already includes any add-ons. */
	const accounts = [
		yearly({
			id: 'lumoraai',
			name: 'Lumora AI',
			plan: 'Max',
			seats: 86,
			mrr: 4672.67,
			addons: ['Travel Planner'],
			city: 'Boulder, CO',
			region: 'West',
			tz: 'America/Denver',
			since: 'November 2022',
			csm: 'Leslie Ashby',
			health: 91,
			healthNote: '81 of 86 seats used this week',
			contact: person('Dean Whitfield', 'Scheduling lead', 'dean@lumoraai.com', '+1 303 555 0167'),
		}),
		yearly({
			id: 'lakeside',
			name: 'Lakeside Apparel',
			plan: 'Pro',
			seats: 30,
			mrr: 800,
			addons: [],
			city: 'Minneapolis, MN',
			region: 'Midwest',
			tz: 'America/Chicago',
			since: 'July 2023',
			csm: 'Leslie Ashby',
			health: 82,
			healthNote: '29 of 30 seats used this week',
			contact: person('Mae Morrow', 'General manager', 'mae@lakesideapparel.com', '+1 612 555 0177'),
		}),
		yearly({
			id: 'oakhaven',
			name: 'Oakhaven Studio',
			plan: 'Max',
			seats: 64,
			mrr: 3093.33,
			addons: [],
			city: 'Stamford, CT',
			region: 'Northeast',
			tz: 'America/New_York',
			since: 'May 2022',
			csm: 'Quentin Cook',
			health: 84,
			healthNote: '58 of 64 seats used; a second branch is planned',
			contact: person('Lyle Reeves', 'IT manager', 'lyle@oakhavenstudio.com', '+1 203 555 0136'),
		}),
		yearly({
			id: 'brightline',
			name: 'Brightline Photography',
			plan: 'Pro',
			seats: 34,
			mrr: 906.67,
			addons: [],
			city: 'Olympia, WA',
			region: 'West',
			tz: 'America/Los_Angeles',
			since: 'September 2023',
			csm: 'Thomas Morrison',
			health: 87,
			healthNote: '33 of 34 seats used this week',
			contact: person('Carl Jensen', 'Managing director', 'carl@brightlinephoto.com', '+1 360 555 0153'),
		}),
		yearly({
			id: 'copperleaf',
			name: 'Copperleaf Design',
			plan: 'Pro',
			seats: 26,
			mrr: 693.33,
			addons: [],
			city: 'Ames, IA',
			region: 'Midwest',
			tz: 'America/Chicago',
			since: 'September 2024',
			csm: 'Tony Aldridge',
			health: 41,
			healthNote: 'Renewal unpaid since the card was declined on September 26',
			contact: person('Gail Lowe', 'Bookkeeper', 'gail@copperleafdesign.com', '+1 515 555 0523'),
		}),
		yearly({
			id: 'highpoint',
			name: 'Highpoint Outfitters',
			plan: 'Max',
			seats: 31,
			mrr: 1622.33,
			addons: ['Customer Portal'],
			city: 'Concord, NH',
			region: 'Northeast',
			tz: 'America/New_York',
			since: 'December 2020',
			csm: 'John Armstrong',
			health: 88,
			healthNote: '29 of 31 seats used; a Portsmouth branch opens in January',
			contact: person(
				'Connie Sexton',
				'Operations director',
				'connie@highpointoutfitters.com',
				'+1 603 555 0192',
			),
		}),
		yearly({
			id: 'moorings',
			name: 'Harborline AI',
			plan: 'Pro',
			seats: 18,
			mrr: 530,
			addons: ['SMS credits'],
			city: 'Tampa, FL',
			region: 'South',
			tz: 'America/New_York',
			since: 'June 2024',
			csm: 'John Armstrong',
			health: 79,
			healthNote: 'Text reminders go out before every visit',
			contact: person('Denise Quigley', 'Owner', 'denise@harborlineai.com', '+1 813 555 0164'),
		}),
		yearly({
			id: 'redline',
			name: 'Redline Motion',
			plan: 'Pro',
			seats: 42,
			mrr: 1220,
			addons: ['SMS credits'],
			city: 'Plano, TX',
			region: 'South',
			tz: 'America/Chicago',
			since: 'October 2022',
			csm: 'Quentin Cook',
			health: 89,
			healthNote: 'Signed the renewal for 42 seats on October 1',
			contact: person('Curtis Rowe', 'Operations manager', 'curtis@redlineproperty.com', '+1 214 555 0102'),
		}),
		yearly({
			id: 'rainier',
			name: 'Rainier Mobility',
			plan: 'Max',
			seats: 54,
			mrr: 2610,
			addons: [],
			city: 'Lansing, MI',
			region: 'Midwest',
			tz: 'America/Detroit',
			since: 'December 2022',
			csm: 'Elise Vick',
			health: 58,
			healthNote: '39 of 54 seats signed in since the move to single sign-on',
			contact: person('Jacob Becker', 'Head of care', 'jacob@rainiermobility.com', '+1 517 555 0176'),
		}),
		yearly({
			id: 'larchwood',
			name: 'Larchwood Studios',
			plan: 'Basic',
			seats: 12,
			mrr: 150,
			addons: [],
			city: 'Eugene, OR',
			region: 'West',
			tz: 'America/Los_Angeles',
			since: 'October 2024',
			csm: 'Quentin Cook',
			health: 74,
			healthNote: 'Every seat used; visit notes on every shoot',
			contact: person('Jordan Pike', 'Owner', 'jordan@larchwoodstudios.com', '+1 503 555 0138'),
		}),
		yearly({
			id: 'tidewater',
			name: 'Tidewater Swimwear',
			plan: 'Basic',
			seats: 8,
			mrr: 100,
			addons: [],
			city: 'Buffalo, NY',
			region: 'Northeast',
			tz: 'America/New_York',
			since: 'February 2025',
			csm: 'John Armstrong',
			health: 81,
			healthNote: 'Recurring visits are 70% of their bookings',
			contact: person('Ian MacLeod', 'Owner', 'ian@tidewaterswimwear.com', '+1 716 555 0118'),
		}),
		yearly({
			id: 'solaris',
			name: 'Solaris Photography',
			plan: 'Pro',
			seats: 24,
			mrr: 640,
			addons: [],
			city: 'Knoxville, TN',
			region: 'South',
			tz: 'America/New_York',
			since: 'July 2024',
			csm: 'Jeffrey McKay',
			health: 80,
			healthNote: 'Asked about time tracking on the last call',
			contact: person('Randall Hatcher', 'Studio director', 'randall@solarisphoto.com', '+1 865 555 0142'),
		}),
		yearly({
			id: 'ironbridge',
			name: 'Ironbridge Fintech',
			plan: 'Basic',
			seats: 9,
			mrr: 112.5,
			addons: [],
			city: 'Minot, ND',
			region: 'Midwest',
			tz: 'America/Chicago',
			since: 'November 2025',
			csm: 'Tony Aldridge',
			health: 70,
			healthNote: 'Steady, pays on time',
			contact: person('Leon Marsh', 'Director', 'leon@ironbridgefintech.com', '+1 701 555 0142'),
		}),
		yearly({
			id: 'avocet',
			name: 'Avocet Robotics',
			plan: 'Pro',
			seats: 22,
			mrr: 586.67,
			addons: [],
			city: 'Duluth, MN',
			region: 'Midwest',
			tz: 'America/Chicago',
			since: 'November 2024',
			csm: 'Tony Aldridge',
			health: 86,
			healthNote: 'Weighing Max for audit logs before the renewal',
			contact: person('Addison Brennan', 'Managing director', 'addison@avocetrobotics.com', '+1 218 555 0177'),
		}),
		yearly({
			id: 'volt',
			name: 'Volt Film & Photo',
			plan: 'Pro',
			seats: 52,
			mrr: 1698.67,
			addons: ['Travel Planner'],
			city: 'Evanston, IL',
			region: 'Midwest',
			tz: 'America/Chicago',
			since: 'February 2024',
			csm: 'Quentin Cook',
			health: 40,
			healthNote: 'Three tickets this month about slow travel times',
			contact: person('Jamal Zeller', 'Operations manager', 'jamal@voltfilmphoto.com', '+1 312 555 0190'),
		}),
		yearly({
			id: 'coastline',
			name: 'Coastline Surf Co.',
			plan: 'Pro',
			seats: 8,
			mrr: 213.33,
			addons: [],
			city: 'Norfolk, VA',
			region: 'South',
			tz: 'America/New_York',
			since: 'October 2026',
			csm: 'Leslie Ashby',
			health: 72,
			healthNote: 'On trial until October 15, then billed yearly',
			contact: person('Ray Downing', 'Owner', 'ray@coastlinesurfco.com', '+1 757 555 0196'),
		}),
		yearly({
			id: 'cedarfell',
			name: 'Cedar Fell Landscaping',
			plan: 'Basic',
			seats: 14,
			mrr: 175,
			addons: [],
			city: 'Raleigh, NC',
			region: 'South',
			tz: 'America/New_York',
			since: 'February 2025',
			csm: 'Leslie Ashby',
			health: 63,
			healthNote: 'Three crews over the winter, six in spring',
			contact: person('Gerald Pruitt', 'Crew manager', 'gerald@cedarfelllandscaping.com', '+1 919 555 0143'),
		}),
	];

	/* Closed tickets from earlier weeks. They only surface in a customer's
     ticket history, each stored as [customer, number, subject, status, days ago]. */
	const archive = [
		closedEarlier('lumoraai', '#20211', 'Bulk-move visits to another carer', 19),
		closedEarlier('lumoraai', '#20094', 'Two seats for new carers', 42),
		closedEarlier('highpoint', '#20240', 'Single sign-on certificate renewal', 16),
		closedEarlier('oakhaven', '#20252', 'Single sign-on for every carer', 14),
		closedEarlier('lakeside', '#20155', 'Pet photos on the visit notes', 27),
		closedEarlier('redline', '#20302', 'Reminder sent for a canceled visit', 9),
		closedEarlier('tidewater', '#20266', 'Walking plan prices for 2027', 13),
		closedEarlier('rainier', '#20310', 'EIN on every invoice', 8),
		closedEarlier('copperleaf', '#20279', 'Card on file expiring', 11),
		closedEarlier('ironbridge', '#20198', 'Add a second scheduler login', 21),
		closedEarlier('larchwood', '#20233', 'Add a second office number', 17),
		closedEarlier('moorings', '#20129', 'Text reminders for the Tampa rounds', 33),
		closedEarlier('solaris', '#20291', 'Visit notes in Spanish', 10),
		closedEarlier('avocet', '#20281', 'How long visit photos are kept', 11),
		closedEarlier('volt', '#20276', 'Days take longer since the August update', 12),
		closedEarlier('cedarfell', '#20118', 'Recurring visits for the winter crews', 35),
	];

	/* Canned text for the composer. A "reply" only fills the box; a "macro" also
     updates the ticket on send. The tokens {first}, {me}, {plan}, {seat} and
     {customer} are swapped for details of whichever ticket is open. */
	const savedReplies = [
		{
			kind: 'reply',
			id: 'ack',
			title: 'Looking into it',
			icon: 'bi-chat-left-text',
			sub: 'First reply when the answer needs digging',
			body: framedReply(
				[
					'Thanks for getting in touch. I am looking into this now and will update you within two hours, even if it is only to say what I have ruled out.',
				],
				'{me}\nFieldline Support',
			),
		},
		{
			kind: 'reply',
			id: 'resync',
			title: 'Mobile app: full sync',
			icon: 'bi-phone',
			sub: 'Steps for a team member whose visits are missing',
			body: framedReply([
				"This usually clears it on the team member's phone:",
				'1. Open Fieldline and go to Settings.\n2. Tap Sync now, then Full sync.\n3. Keep the app open until the bar finishes, usually under a minute.',
				'If visits are still missing after that, tell me which person and I will check their account from here.',
			]),
		},
		{
			kind: 'reply',
			id: 'seats',
			title: 'How to add a seat',
			icon: 'bi-person-plus',
			sub: 'Where to add a person, and the price',
			body: framedReply([
				'You can add a person under Settings > Team > Add person. They get an email invite and can sign in to the mobile app straight away.',
				'On {plan}, each extra seat is {seat} a month, charged for the rest of this billing period only.',
			]),
		},
		{
			kind: 'macro',
			id: 'info',
			title: 'Ask for screenshots',
			icon: 'bi-camera',
			sub: 'Reply, then set to Pending',
			status: 'pending',
			tags: ['needs-info'],
			body: framedReply([
				'Could you send a screenshot of what you see, and the app version from Settings > About? With those I can match it to the right fix.',
			]),
		},
		{
			kind: 'macro',
			id: 'solve',
			title: 'Solve with thanks',
			icon: 'bi-check2-circle',
			sub: 'Reply, then set to Solved and send the survey',
			status: 'solved',
			body: framedReply([
				'Glad that is working again. I will mark this as solved; reply here at any time and it opens again with everything kept.',
			]),
		},
		{
			kind: 'macro',
			id: 'eng',
			title: 'Note for Engineering',
			icon: 'bi-cpu',
			sub: 'Internal note, put on hold, tag engineering',
			note: true,
			status: 'hold',
			tags: ['engineering'],
			body: 'Engineering: {customer} ({plan}) is affected.\nSteps to reproduce:\nWhat the customer sees:\nWorkaround given:',
		},
		{
			kind: 'macro',
			id: 'billing',
			title: 'Hand to Billing',
			icon: 'bi-receipt',
			sub: 'Internal note, assign to Hope Stout',
			note: true,
			assignee: 'hs',
			tags: ['billing'],
			body: 'Hope, {customer} needs a billing change. Details below.\n',
		},
	];

	/* A rolling seven days, read by the Service levels dialog in the workspace menu. */
	const lastWeek = {
		slaTarget: 95,
		slaMet: 93.4,
		slaMetBefore: 91.1,
		csatBefore: 89,
		firstReply: 41,
		firstReplyBefore: 48,
		toSolve: 380,
		toSolveBefore: 425,
		csat: { good: 196, bad: 18 },
	};

	/* The live queue, newest first. Each thread is built from the four message
     helpers further down; "ago" always counts minutes back from the clock. */
	const queue = [
		{
			id: '#20418',
			subject: 'Carers see an empty visit list in the mobile app',
			customer: 'lumoraai',
			status: 'open',
			priority: 'urgent',
			channel: 'chat',
			assignee: null,
			unread: true,
			tags: ['mobile-app', 'sync'],
			messages: [
				said(
					52,
					"Morning. About half our carers open the app and today's list is empty. The schedule board shows 140 visits booked for today, all assigned. Phones are a mix of Android and iPhone, all on version 6.14. Carers are waiting at the office.",
				),
				said(
					34,
					'Update: signing out and back in fixes it for some of them, not all. Anyone whose phone was offline overnight seems stuck.',
				),
			],
		},
		{
			id: '#20417',
			subject: 'Schedule board freezes when filtering by skill',
			customer: 'highpoint',
			status: 'open',
			priority: 'urgent',
			channel: 'phone',
			assignee: 'ab',
			tags: ['schedule-board', 'performance'],
			escalation: { team: 'Engineering', ref: 'ENG-3312' },
			messages: [
				logged(95, 'bi-telephone', 'Alexis Boone logged a call from Connie Sexton (14 minutes)'),
				said(
					95,
					"Call notes: the schedule board hangs for 20 to 30 seconds whenever a scheduler filters by skill with all three branches showing. Started after Tuesday's release. Three schedulers affected, all on Chrome on Windows.",
				),
				answered(
					'ab',
					80,
					'Connie, thanks for walking me through it on the phone. I can make the same delay happen on a test account set up like yours, with three branches and every skill, so it is nothing on your side. I have passed it to our engineers with your account details.\n\nUntil there is a fix, filtering by branch first and then by skill keeps the board responsive. I will update you by 1pm your time.',
				),
				noted(
					'ab',
					72,
					'Reproduced on staging: three branches plus the skill filter blocks the page for about 24 seconds. Raised ENG-3312, Jim is on call.',
				),
				said(
					25,
					'Thanks Alexis. Branch first does help. Any idea on timing? Friday is our busiest day for visits.',
				),
			],
		},
		{
			id: '#20416',
			subject: 'Travel Planner put two shoots 30 miles apart back to back',
			customer: 'volt',
			status: 'open',
			priority: 'high',
			channel: 'email',
			assignee: 'ja',
			unread: true,
			tags: ['travel-planner'],
			messages: [
				said(
					170,
					'Yesterday Travel Planner gave Kyle a family shoot in Evanston, then one in Oak Lawn, then back to Evanston. That is 30 miles each way. "Keep visits in the same area" was switched on. Screenshot of his day attached.',
					['day-kyle-oct-1.png'],
				),
				answered(
					'ja',
					140,
					'Hi Jamal, thanks for the screenshot. That plan is wrong and I want to find out why. Was the Oak Creek shoot added after the day was first planned, and if so, roughly when?',
				),
				said(
					40,
					"It was booked by phone at 7:50am, after the plan was built at 7:30 am. Kyle didn't get any warning that his day had changed.",
				),
			],
		},
		{
			id: '#20415',
			subject: "Accounting export stopped after Tuesday's update",
			customer: 'oakhaven',
			status: 'open',
			priority: 'high',
			channel: 'email',
			assignee: null,
			tags: ['integrations', 'invoices'],
			messages: [
				said(
					190,
					'Since Tuesday the nightly export of invoices to our accounting system has stopped. The last good run was September 29 and there is nothing in the export log after that. We close the month on Monday, so we need it running before then.',
				),
			],
		},
		{
			id: '#20414',
			subject: 'Single sign-on for the remaining 15 users',
			customer: 'rainier',
			status: 'open',
			priority: 'normal',
			channel: 'email',
			assignee: 'cm',
			tags: ['sso', 'onboarding'],
			messages: [
				said(
					300,
					'We have connected single sign-on and 39 people can log in fine. The other 15 get "account not provisioned". They are all in the same group in our directory. What are we missing?',
				),
				answered(
					'cm',
					262,
					'Hi Jacob, those 15 people were invited before single sign-on was switched on, so their accounts are still waiting for a password. I can convert all 15 to single sign-on in one go if you are happy for me to. The other way is to remove and invite them again, which loses nothing as none of them have used the app yet.',
				),
				said(
					90,
					'Please convert them, thank you. Can it be done before the Bonn team starts on Monday morning?',
				),
			],
		},
		{
			id: '#20413',
			subject: 'Customer signatures missing from PDF visit notes',
			customer: 'larchwood',
			status: 'open',
			priority: 'high',
			channel: 'chat',
			assignee: 'ja',
			unread: true,
			tags: ['visit-notes', 'mobile-app'],
			messages: [
				said(
					70,
					"Customers sign on the photographer's phone and the signature shows in the app, but the PDF visit note we email them has a blank box. Happened on six shoots yesterday.",
				),
				answered(
					'ja',
					62,
					"Hi Jordan, that shouldn't happen. Which visit numbers were they? I will check the stored signatures.",
				),
				said(12, '#88412, #88415 and #88420 are three of them. All done by Ricky on his Android.'),
			],
		},
		{
			id: '#20412',
			subject: 'October dog-walk visits created twice',
			customer: 'tidewater',
			status: 'pending',
			priority: 'high',
			channel: 'email',
			assignee: 'pr',
			tags: ['recurring-visits'],
			messages: [
				said(
					1170,
					'Every recurring dog-walk visit for October has been created twice. That is about 96 extra visits on the calendar, and our walkers are asking which one is real.',
				),
				answered(
					'pr',
					1140,
					"Hi Ian, sorry for the mess. The second copies came from the walking plan being edited while October's visits were being created overnight. I can delete the second copy of each visit, the ones created at 2:14am on October 1. Nothing is sent to your customers when I do. Shall I go ahead?",
				),
				noted(
					'pr',
					1135,
					'Clean-up ready: deletes 96 visits created Oct 1 2:14 am on this account. Waiting for Ian to say yes.',
				),
			],
		},
		{
			id: '#20411',
			subject: 'Text reminders show the old arrival window after a visit moves',
			customer: 'redline',
			status: 'open',
			priority: 'normal',
			channel: 'chat',
			assignee: 'ab',
			tags: ['sms', 'reminders'],
			messages: [
				said(
					240,
					'Reminders texted to customers say "arriving 8 to 10am" when the visit has been moved to 10 to 12. Only happens on visits we moved after booking.',
				),
				answered(
					'ab',
					212,
					'Thanks Curtis. When a visit moves, its reminder should pick up the new window. I am checking whether these reminders were queued before the move.',
				),
				said(45, 'Another one just went out wrong, visit #77310.'),
			],
		},
		{
			id: '#20410',
			subject: 'How do I add a seat for a new assistant?',
			customer: 'brightline',
			status: 'open',
			priority: 'low',
			channel: 'email',
			assignee: null,
			tags: ['seats'],
			messages: [
				said(
					360,
					'We have taken on an assistant who starts Monday. How do I add him to Fieldline, and what will it cost? We are on Pro.',
				),
			],
		},
		{
			id: '#20409',
			subject: "Card declined and the team can't see their visits",
			customer: 'copperleaf',
			status: 'open',
			priority: 'urgent',
			channel: 'email',
			assignee: null,
			unread: true,
			tags: ['billing', 'payment'],
			messages: [
				said(
					110,
					"Our card was declined when the renewal came round on September 26, and now the app says the account is on hold. Our cleaners can't see today's visits. I asked last week to pay by bank transfer instead. Please switch us back on while it goes through.",
				),
			],
		},
		{
			id: '#20408',
			subject: 'Customer Portal still shows September prices',
			customer: 'highpoint',
			status: 'hold',
			priority: 'normal',
			channel: 'chat',
			assignee: 'dr',
			tags: ['customer-portal'],
			escalation: { team: 'Engineering', ref: 'ENG-3298' },
			messages: [
				said(
					1500,
					'We changed our prices on October 1 but customers booking through the portal still see the old ones. The office app shows the new prices.',
				),
				answered(
					'dr',
					1460,
					"Hi Connie, I can see it too. The portal is holding on to a saved copy of your price list. Our engineers are fixing it in Monday's release. Until then, any booking made through the portal is charged at the new price, whatever the page shows.",
				),
				noted(
					'dr',
					1455,
					"Portal price list cache isn't cleared when prices change. ENG-3298, fix ships Monday, October 5.",
				),
				logged(
					1455,
					'bi-arrow-up-right-circle',
					'Randall Rhodes escalated to Engineering and put the ticket on hold',
				),
			],
		},
		{
			id: '#20407',
			subject: 'Customer import stops at row 812',
			customer: 'coastline',
			status: 'open',
			priority: 'normal',
			channel: 'email',
			assignee: 'ab',
			tags: ['import', 'onboarding'],
			messages: [
				said(
					120,
					'We are importing 1,240 customers from our old system. It stops at row 812 every time with "invalid address". Row 812 looks fine to us. File attached.',
					['coastline-customers.csv'],
				),
			],
		},
		{
			id: '#20406',
			subject: 'Fewer seats over the winter',
			customer: 'cedarfell',
			status: 'open',
			priority: 'normal',
			channel: 'phone',
			assignee: 'hs',
			tags: ['billing', 'seats'],
			messages: [
				logged(1320, 'bi-telephone', 'Hope Stout logged a call from Gerald Pruitt (6 minutes)'),
				said(
					1320,
					'Call notes: Gerald runs three crews over the winter and six in spring. He wants to go from 14 seats to 8 on November 1 and back to 14 on March 1, and asked what happens to the months already paid for.',
				),
				answered(
					'hs',
					1300,
					"Gerald, as we discussed: I can take the plan down to 8 seats on November 1 and back up to 14 on March 1. The 6 seats you won't use for those four months come back as a $300 credit on your account, at $12.50 a seat a month. Reply yes and I will set it up today.",
				),
				said(180, 'Yes please, go ahead. Thanks Hope.'),
			],
		},
		{
			id: '#20405',
			subject: 'Can photographers clock in from the app?',
			customer: 'solaris',
			status: 'open',
			priority: 'low',
			channel: 'chat',
			assignee: 'dr',
			tags: ['time-tracking'],
			messages: [
				said(
					30,
					'Hola. Our photographers fill in paper timesheets. Can they clock in and out from the Fieldline app instead, and can we see the hours for payroll?',
				),
			],
		},
		{
			id: '#20404',
			subject: "Invoice emails landing in customers' junk folders",
			customer: 'ironbridge',
			status: 'pending',
			priority: 'normal',
			channel: 'email',
			assignee: 'ja',
			tags: ['email', 'invoices'],
			messages: [
				said(
					2900,
					'Several of our customers say our invoice emails from Fieldline end up in junk. It started this month.',
				),
				answered(
					'ja',
					2860,
					'Hi Leon, invoices go out from your own address, so your email provider needs to know Fieldline is allowed to send for you. I have attached the two lines your IT person adds to your domain settings. It takes about ten minutes. Let me know once it is done and I will send a test.',
					['fieldline-sender-setup.pdf'],
				),
			],
		},
		{
			/* Spam has no customer record, so the sender travels on the ticket itself. */
			id: '#20403',
			subject: 'Page one of search results, guaranteed',
			customer: null,
			from: { name: 'RankFast Growth Team', email: 'growth@rankfast-seo.biz' },
			status: 'open',
			priority: 'low',
			channel: 'email',
			assignee: null,
			tags: [],
			messages: [
				said(
					180,
					'Dear business owner, we can put your website on page one of search results in 30 days or your money back. Reply now for a free audit.',
				),
			],
		},
		{
			id: '#20400',
			subject: "Dog walker can't reset his password",
			customer: 'tidewater',
			...solvedAt(85, true, null),
			priority: 'normal',
			channel: 'phone',
			assignee: 'pr',
			tags: ['sign-in'],
			messages: [
				said(130, 'Call notes: dog walker Darnell Hughes never gets the password reset email.'),
				answered(
					'pr',
					95,
					"Hi Ian, Darnell's account had an old email address on it. I have updated it and sent the reset again; he should have it now.",
				),
				logged(85, 'bi-check2-circle', 'Connie Reese solved the ticket'),
			],
		},
		{
			id: '#20402',
			subject: 'Carer photos not attaching to visits',
			customer: 'oakhaven',
			...solvedAt(1100, true, 'good', 'Casey sorted it in ten minutes. Great help.'),
			priority: 'normal',
			channel: 'chat',
			assignee: 'cm',
			tags: ['mobile-app', 'photos'],
			messages: [
				said(1160, 'Photos taken on visits today are not showing on the visit record.'),
				answered(
					'cm',
					1140,
					'Hi Lyle, the photos were waiting on the phones for a Wi-Fi connection because "Upload on Wi-Fi only" was on. Switching it off sends them over mobile data. They are all on the visits now.',
				),
				logged(1100, 'bi-check2-circle', 'Casey Martin solved the ticket'),
			],
		},
		{
			id: '#20401',
			subject: 'Change the billing email address',
			customer: 'lakeside',
			...solvedAt(1250, true, 'good', ''),
			priority: 'low',
			channel: 'email',
			assignee: 'ja',
			tags: ['billing'],
			messages: [
				said(1400, 'Please send invoices to accounts@lakesideapparel.com from now on.'),
				answered(
					'ja',
					1260,
					"Done, Mae. October's invoice and every one after it will go to accounts@lakesideapparel.com.",
				),
				logged(1250, 'bi-check2-circle', 'John Armstrong solved the ticket'),
			],
		},
		{
			id: '#20399',
			subject: 'Overtime rules for weekend visits',
			customer: 'highpoint',
			...solvedAt(2880, false, 'bad', 'Took three days and two people to get an answer.'),
			priority: 'high',
			channel: 'phone',
			assignee: 'ab',
			tags: ['timesheets'],
			messages: [
				said(
					7100,
					'Call notes: Connie wants weekend visits paid at time and a half automatically on timesheets.',
				),
				answered(
					'ab',
					2900,
					'Connie, sorry this took so long. Overtime rules are under Settings > Timesheets > Pay rules. I have set up "Weekend visit, 1.5x" for you; it applies from this Saturday.',
				),
				logged(2880, 'bi-check2-circle', 'Alexis Boone solved the ticket'),
			],
		},
		{
			id: '#20398',
			subject: 'Invite links expired for six users',
			customer: 'rainier',
			...solvedAt(2700, true, 'good', 'Quick and clear.'),
			priority: 'normal',
			channel: 'email',
			assignee: 'cm',
			tags: ['onboarding'],
			messages: [
				said(2800, 'Six of our planners say their invite link has expired.'),
				answered(
					'cm',
					2720,
					'Hi Jacob, invite links last 7 days. I have sent fresh ones to all six; they are good until next Wednesday.',
				),
				logged(2700, 'bi-check2-circle', 'Casey Martin solved the ticket'),
			],
		},
		{
			id: '#20397',
			subject: 'Our own domain for the Customer Portal',
			customer: 'lumoraai',
			...solvedAt(4300, true, 'good', 'Thanks Connie!'),
			priority: 'normal',
			channel: 'email',
			assignee: 'pr',
			tags: ['customer-portal'],
			messages: [
				said(4500, 'If we take the Customer Portal, can it live at book.lumoraai.com?'),
				answered(
					'pr',
					4320,
					'It can, Dean. Once the portal is switched on, it takes about a day to set up at book.lumoraai.com, with the padlock in place.',
				),
				logged(4300, 'bi-check2-circle', 'Connie Reese solved the ticket'),
			],
		},
		{
			id: '#20395',
			subject: 'Export staff hours to a spreadsheet',
			customer: 'redline',
			...solvedAt(5600, true, null),
			priority: 'low',
			channel: 'chat',
			assignee: 'dr',
			tags: ['timesheets'],
			messages: [
				said(5700, 'Where do I download staff hours for last month?'),
				answered(
					'dr',
					5620,
					'Reports > Timesheets, pick September, then Export. It downloads as a CSV that opens in any spreadsheet.',
				),
				logged(5600, 'bi-check2-circle', 'Randall Rhodes solved the ticket'),
			],
		},
	];

	/* Arrives twenty seconds after load on the first ticket, so the queue visibly updates. */
	const lateArrival = {
		ticket: '#20418',
		after: 20,
		text: 'Is anyone looking at this? Our schedulers are ringing carers one by one to read out their visits.',
	};

	publish();

	/** Hangs the assembled helpdesk on window.Basalt.data without disturbing other data files. */
	function publish() {
		(window.Basalt.data ??= {}).support = {
			now: clock,
			me: signedIn,
			agents: staff,
			teams: handoffTeams,
			customers: accounts,
			tickets: queue,
			incoming: lateArrival,
			history: archive,
			macros: savedReplies,
			metrics: lastWeek,
			sla: replyTargets,
			prices: seatPrice,
		};
	}

	/* Record builders: they only fill in what every record of a kind shares. */

	/** Reply targets for one plan, most pressing priority first. */
	function within(urgent, high, normal, low) {
		return { urgent, high, normal, low };
	}

	/** Every demo account renews once a year, so billing is filled in here. */
	function yearly(account) {
		return { billing: 'annual', ...account };
	}

	/** The person who raises tickets for an account. */
	function person(name, role, email, phone) {
		return { name, role, email, phone };
	}

	/** One row of the archive; nothing old is left unresolved. */
	function closedEarlier(customer, number, subject, daysAgo) {
		return [customer, number, subject, 'solved', daysAgo];
	}

	/**
	 * Wraps the paragraphs of a saved reply in a greeting and a signature,
	 * leaving the blank line an email puts between blocks.
	 */
	function framedReply(paragraphs, signature = '{me}') {
		return ['Hi {first},', ...paragraphs, signature].join('\n\n');
	}

	/**
	 * The fields a solved ticket carries. The survey goes out the moment it is
	 * solved; a comment is only stored when the customer left one, even an empty one.
	 */
	function solvedAt(minutesAgo, withinTarget, score, comment) {
		const csat = { sentAgo: minutesAgo, score };
		if (comment !== undefined) csat.comment = comment;
		return { status: 'solved', solvedAgo: minutesAgo, slaMet: withinTarget, csat };
	}

	/* Thread messages. Customer lines carry no author because they come from
     the ticket's contact; replies and notes name the agent who wrote them. */

	function said(minutesAgo, text, uploads) {
		return withFiles({ t: 'customer', ago: minutesAgo, text }, uploads);
	}

	function answered(agent, minutesAgo, text, uploads) {
		return withFiles({ t: 'reply', by: agent, ago: minutesAgo, text }, uploads);
	}

	function noted(agent, minutesAgo, text) {
		return { t: 'note', by: agent, ago: minutesAgo, text };
	}

	function logged(minutesAgo, icon, text) {
		return { t: 'event', ago: minutesAgo, icon, text };
	}

	/** Adds an attachment list only to the messages that have one. */
	function withFiles(message, uploads) {
		return uploads ? { ...message, files: uploads } : message;
	}
})();
