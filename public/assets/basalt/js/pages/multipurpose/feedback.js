/**
 * The customer feedback page, feedback.html.
 *
 * Fieldline hears from customers in the app, through the score survey, at
 * account reviews, in the community and on review sites. Each piece is a
 * bug, an idea, praise or a question about one part of the product, holds
 * the sender's 0 to 10 score, and moves from New to Replied, Planned and
 * Shipped, or to Declined.
 *
 * The header figures, the reply queue, the status columns and the list are all
 * counted from FEEDBACK for the period chosen in the header, so they can
 * never disagree. To run it on real data, load FEEDBACK from your backend
 * with the same fields, let ANCHOR_DAY be new Date() rather than a fixed
 * day, and make saveFeedback() and sendSurvey() talk to the server; in the
 * demo they change the page and raise a toast.
 *
 * Shared parts from basalt.js: the hero header, the segmented control,
 * styled selects, avatars, status pills, filter chips, empty states,
 * pagination, the drawer, choice tiles and toasts.
 */
(() => {
	'use strict';

	/* The demo stands still on October 9, 2026, so "the last 30 days" always
     holds the same rows. */
	const ANCHOR_DAY = new Date(2026, 9, 9);
	const ROWS_PER_PAGE = 8;
	/* The first reply the team aims for, in hours. */
	const REPLY_GOAL = 8;
	const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const SIGNED_IN = 'John Armstrong';
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	const KINDS = {
		bug: { label: 'Bug', glyph: 'bug' },
		idea: { label: 'Idea', glyph: 'lightbulb' },
		praise: { label: 'Praise', glyph: 'hand-thumbs-up' },
		question: { label: 'Question', glyph: 'question-circle' },
	};

	const CHANNELS = {
		app: 'In the app',
		survey: 'Score survey',
		review: 'Account review',
		community: 'Community',
		site: 'Review site',
	};

	/* Listed in the order the status chips appear. pillClass is the color
     class the status pill takes; Declined stays plain. */
	const PROGRESS = {
		new: { label: 'New', pillClass: 'basalt-status-warning' },
		replied: { label: 'Replied', pillClass: 'basalt-status-info' },
		planned: { label: 'Planned', pillClass: 'fbk-status-planned' },
		shipped: { label: 'Shipped', pillClass: 'basalt-status-success' },
		declined: { label: 'Declined', pillClass: '' },
	};

	/* The three surveys the dialog can send, and the scale each one shows. */
	const QUESTIONS = {
		score: {
			ask: 'How likely are you to recommend Fieldline to another business?',
			low: 0,
			high: 10,
			ends: ['Not likely', 'Very likely'],
		},
		support: {
			ask: 'How did we do with your last support request?',
			low: 1,
			high: 5,
			ends: ['Poorly', 'Very well'],
		},
		feature: {
			ask: 'How useful is Travel Planner for your team?',
			low: 1,
			high: 5,
			ends: ['Not useful', 'Can’t do without it'],
		},
	};

	const CSV_COLUMNS = [
		'ID',
		'Received',
		'Customer',
		'Contact',
		'Type',
		'Topic',
		'Source',
		'Score',
		'Status',
		'Owner',
		'Title',
		'Comment',
	];

	/* Each customer's plan, seat count and email domain, as on Companies. */
	const CLIENT_PLANS = {
		'Lumora AI': { plan: 'Max', seats: 86, domain: 'lumoraai.com' },
		'Oakhaven Studio': { plan: 'Max', seats: 64, domain: 'oakhavenstudio.com' },
		'Highpoint Outfitters': { plan: 'Max', seats: 31, domain: 'highpointoutfitters.com' },
		'Moorings Line Studios': { plan: 'Max', seats: 58, domain: 'harborline-studios.com' },
		'Avocet Robotics': { plan: 'Pro', seats: 24, domain: 'avocetrobotics.com' },
		'Copperleaf Design': { plan: 'Pro', seats: 38, domain: 'copperleafdesign.com' },
		'Polaris Running Co. Group': { plan: 'Pro', seats: 31, domain: 'polarisrunningco.com' },
		'Bluepeak Studios': { plan: 'Pro', seats: 27, domain: 'bluepeakstudios.com' },
		'Redline Motion': { plan: 'Pro', seats: 42, domain: 'redlineproperty.com' },
		'Larchwood Sitters': { plan: 'Pro', seats: 46, domain: 'larchwoodsitters.com' },
		'Clearview Windows': { plan: 'Pro', seats: 22, domain: 'clearviewwindows.com' },
		'Lakeside Apparel': { plan: 'Basic', seats: 9, domain: 'lakesideapparel.com' },
		'Cedar Fell Landscaping': { plan: 'Basic', seats: 14, domain: 'cedarfelllandscaping.com' },
		'Ironwood Studio': { plan: 'Basic', seats: 12, domain: 'ironwoodstudio.com' },
		'Maple Grove Candles': { plan: 'Basic', seats: 10, domain: 'maplegrovecandles.com' },
		'Evergreen Arborists': { plan: 'Basic', seats: 13, domain: 'evergreenarborists.com' },
		'Merlin Dog Walking': { plan: 'Basic', seats: 7, domain: 'merlindogwalking.com' },
		'Brookside Books': { plan: 'Basic', seats: 5, domain: 'brooksidebooks.com' },
		'Harborline AI': { plan: 'Basic', seats: 8, domain: 'harborlineai.com' },
	};

	/* One record per piece of feedback, newest first. waitHours is how long
     the first reply took and stays null while a record is New; answer is
     what we wrote back. */
	const FEEDBACK = [
		/* From the last thirty days. */
		{
			ref: '#2087',
			date: '2026-10-09',
			account: 'Oakhaven Studio',
			from: 'Todd Bishop',
			jobTitle: 'Owner',
			via: 'app',
			kind: 'bug',
			topic: 'Mobile app',
			score: 4,
			stage: 'new',
			owner: 'Connie Reese',
			waitHours: null,
			title: 'Photos upload twice on a weak signal',
			body: 'In basements the app keeps retrying, and every visit ends up with each photo twice. Families see the doubles on their report.',
		},
		{
			ref: '#2086',
			date: '2026-10-09',
			account: 'Lumora AI',
			from: 'Marshall Ashby',
			jobTitle: 'Care manager',
			via: 'survey',
			kind: 'idea',
			topic: 'Travel Planner',
			score: 9,
			stage: 'new',
			owner: 'Mae Loy Ware',
			waitHours: null,
			title: 'Let us pin a visit to a time slot',
			body: 'Some clients have to be the first visit of the day. The planner moves them, and we drag them back every morning.',
		},
		{
			ref: '#2084',
			date: '2026-10-08',
			account: 'Avocet Robotics',
			from: 'Addison Brennan',
			jobTitle: 'Managing director',
			via: 'app',
			kind: 'praise',
			topic: 'Customer Portal',
			score: 10,
			stage: 'new',
			owner: 'Sherry Callahan',
			waitHours: null,
			title: 'Customers book their own repeat visits',
			body: 'Since we turned on the portal, half of our weekly dog walks were booked without a single phone call.',
		},
		{
			ref: '#2083',
			date: '2026-10-08',
			account: 'Highpoint Outfitters',
			from: 'Connie Sexton',
			jobTitle: 'Operations director',
			via: 'review',
			kind: 'question',
			topic: 'Reports',
			score: 7,
			stage: 'new',
			owner: 'John Armstrong',
			waitHours: null,
			title: 'Can reports split hours by team?',
			body: 'We pay carers by the visit, so payroll needs hours per team rather than per person.',
		},
		{
			ref: '#2081',
			date: '2026-10-07',
			account: 'Moorings Line Studios',
			from: 'Courtney Whitman',
			jobTitle: 'Operations manager',
			via: 'site',
			kind: 'bug',
			topic: 'Invoicing',
			score: 5,
			stage: 'new',
			owner: 'Todd Hatcher',
			waitHours: null,
			title: 'Invoice PDFs cut off long addresses',
			body: 'Site addresses on three lines lose the last one, so the postal code is missing from the customer copy.',
		},
		{
			ref: '#2078',
			date: '2026-10-06',
			account: 'Lakeside Apparel',
			from: 'Mae Morrow',
			jobTitle: 'General manager',
			via: 'community',
			kind: 'idea',
			topic: 'Schedule board',
			score: 9,
			stage: 'replied',
			owner: 'Sherry Callahan',
			waitHours: 3,
			title: 'Color visits by service on the board',
			body: 'We run dog walks and pet sitting side by side. Seeing the service at a glance would save a lot of clicking.',
			answer: 'Good shout, Mae. Color by visit type is on our list for the board, and I have added your vote. I will write here when it moves.',
		},
		{
			ref: '#2075',
			date: '2026-10-05',
			account: 'Redline Motion',
			from: 'Travis Teague',
			jobTitle: 'Scheduling lead',
			via: 'survey',
			kind: 'praise',
			topic: 'Travel Planner',
			score: 10,
			stage: 'replied',
			owner: 'Sherry Callahan',
			waitHours: 2,
			title: 'Travel Planner saves us an hour a day',
			body: 'Our teams finish before rush hour now, and fuel is down 14% since August.',
			answer: 'Thank you, Travis. Would you be up for a short case study? We would love to share your fuel numbers.',
		},
		{
			ref: '#2072',
			date: '2026-10-04',
			account: 'Larchwood Sitters',
			from: 'Dana Whitlock',
			jobTitle: 'Operations manager',
			via: 'app',
			kind: 'bug',
			topic: 'Mobile app',
			score: 6,
			stage: 'planned',
			owner: 'Todd Hatcher',
			waitHours: 5,
			title: 'Offline notes vanish after a restart',
			body: 'If the phone restarts before it syncs, the visit notes are gone. It happened twice this week.',
			answer: 'Sorry, Dana. We found it: notes were kept in memory until the sync. The fix saves them on the phone first and is due in the 4.20 app.',
		},
		{
			ref: '#2069',
			date: '2026-10-03',
			account: 'Cedar Fell Landscaping',
			from: 'Gerald Pruitt',
			jobTitle: 'Team manager',
			via: 'survey',
			kind: 'idea',
			topic: 'SMS reminders',
			score: 8,
			stage: 'planned',
			owner: 'Mae Loy Ware',
			waitHours: 6,
			title: 'Reminders in Spanish for some customers',
			body: 'About a third of our customers prefer Spanish. A language setting per customer would cover it.',
			answer: 'Thanks, Gerald. A language per customer is planned for November, starting with Spanish.',
		},
		{
			ref: '#2066',
			date: '2026-10-02',
			account: 'Polaris Running Co. Group',
			from: 'Derrick Yost',
			jobTitle: 'Care operations manager',
			via: 'review',
			kind: 'idea',
			topic: 'Integrations',
			score: 9,
			stage: 'planned',
			owner: 'Todd Hatcher',
			waitHours: 8,
			title: 'Send supplies used to QuickBooks items',
			body: 'Supplies are already on the visit, but we retype them as invoice lines in QuickBooks every Friday.',
			answer: 'Agreed, Derrick. Matching supplies to QuickBooks items is planned for the next sync update. You will be first to try it.',
		},
		{
			ref: '#2063',
			date: '2026-10-01',
			account: 'Copperleaf Design',
			from: 'Leslie Price',
			jobTitle: 'Operations manager',
			via: 'site',
			kind: 'praise',
			topic: 'Schedule board',
			score: 10,
			stage: 'replied',
			owner: 'Sherry Callahan',
			waitHours: 4,
			title: 'The easiest schedule board we have tried',
			body: 'New coordinators learn it in an afternoon. We tried three other tools before this one.',
			answer: 'That made our week, Leslie. Thank you for taking the time to write the review.',
		},
		{
			ref: '#2059',
			date: '2026-09-29',
			account: 'Bluepeak Studios',
			from: 'Rachel Beck',
			jobTitle: 'Chief executive',
			via: 'app',
			kind: 'idea',
			topic: 'Schedule board',
			score: 9,
			stage: 'shipped',
			owner: 'Mae Loy Ware',
			waitHours: 2,
			title: 'Drag a shoot to another day from the map',
			body: 'When a shoot runs over, we want to drop the next one onto tomorrow without leaving the map.',
			answer: 'This is live in 4.18, Rachel: drag any pin onto the week strip under the map.',
		},
		{
			ref: '#2055',
			date: '2026-09-27',
			account: 'Maple Grove Candles',
			from: 'Tara Kerr',
			jobTitle: 'Owner',
			via: 'survey',
			kind: 'bug',
			topic: 'Invoicing',
			score: 3,
			stage: 'replied',
			owner: 'Todd Hatcher',
			waitHours: 1,
			title: 'Card payments fail on mobile invoices',
			body: 'Three customers could not pay from the invoice link on their phones this week.',
			answer: 'Sorry, Tara. A payment page update broke some phone browsers. It was fixed this morning; the three links work again.',
		},
		{
			ref: '#2052',
			date: '2026-09-25',
			account: 'Evergreen Arborists',
			from: 'Rory Whitcombe',
			jobTitle: 'Team lead',
			via: 'app',
			kind: 'question',
			topic: 'Mobile app',
			score: 7,
			stage: 'replied',
			owner: 'Connie Reese',
			waitHours: 9,
			title: 'Can crews clock in as a team?',
			body: 'One person clocks in four people every morning. Is there a way to do the whole crew at once?',
			answer: 'Yes, Rory: open the crew on the Today screen and tap Clock in all. Each person can still clock out on their own.',
		},
		{
			ref: '#2048',
			date: '2026-09-23',
			account: 'Merlin Dog Walking',
			from: 'Hunter Rudd',
			jobTitle: 'Owner',
			via: 'community',
			kind: 'idea',
			topic: 'Customer Portal',
			score: 10,
			stage: 'planned',
			owner: 'Mae Loy Ware',
			waitHours: 12,
			title: 'Show the walker’s photo in the portal',
			body: 'Customers like knowing who is coming. A photo and a first name would be enough.',
			answer: 'Lovely idea, Hunter. It is planned, with a switch for teams who would rather not show photos.',
		},
		{
			ref: '#2044',
			date: '2026-09-21',
			account: 'Highpoint Outfitters',
			from: 'Connie Sexton',
			jobTitle: 'Operations director',
			via: 'survey',
			kind: 'praise',
			topic: 'Travel Planner',
			score: 9,
			stage: 'replied',
			owner: 'Sherry Callahan',
			waitHours: 3,
			title: 'Fewer late arrivals since September',
			body: 'Late arrivals dropped from 11% to 4% in our biggest region.',
			answer: 'Great to hear, Connie. Thanks for sharing the numbers with us.',
		},
		{
			ref: '#2040',
			date: '2026-09-19',
			account: 'Brookside Books',
			from: 'Ian MacLeod',
			jobTitle: 'Owner',
			via: 'site',
			kind: 'idea',
			topic: 'SMS reminders',
			score: 4,
			stage: 'declined',
			owner: 'John Armstrong',
			waitHours: 20,
			title: 'Free text messages on Basic',
			body: 'Paying for SMS credits on top of the plan feels like a lot for a team of five.',
			answer: 'Every text has a cost to us, Ian, so we can’t make them free. From November, Basic includes 100 credits a month.',
		},
		{
			ref: '#2037',
			date: '2026-09-17',
			account: 'Lumora AI',
			from: 'Marshall Ashby',
			jobTitle: 'Care manager',
			via: 'app',
			kind: 'bug',
			topic: 'Travel Planner',
			score: 8,
			stage: 'shipped',
			owner: 'Todd Hatcher',
			waitHours: 4,
			title: 'Day plans ignore lunch breaks',
			body: 'Carers get a visit booked right in the middle of their break.',
			answer: 'Fixed in 4.17, Marshall. Breaks set on a carer’s shift are now kept free.',
		},
		{
			ref: '#2033',
			date: '2026-09-15',
			account: 'Harborline AI',
			from: 'Denise Quigley',
			jobTitle: 'Owner',
			via: 'survey',
			kind: 'question',
			topic: 'Invoicing',
			score: 6,
			stage: 'replied',
			owner: 'Connie Reese',
			waitHours: 7,
			title: 'Can we bill a yearly plan monthly?',
			body: 'Our care plans run for a year, but customers want to pay by the month.',
			answer: 'You can, Denise: set the plan to bill monthly under Billing schedule. I have sent you a two-minute video.',
		},
		{
			ref: '#2030',
			date: '2026-09-13',
			account: 'Ironwood Studio',
			from: 'Wade Collins',
			jobTitle: 'Owner',
			via: 'review',
			kind: 'idea',
			topic: 'Reports',
			score: 10,
			stage: 'shipped',
			owner: 'Mae Loy Ware',
			waitHours: 5,
			title: 'Photo report for insurers as a PDF',
			body: 'Insurers want a photo report for every move. We copy the photos into a document by hand.',
			answer: 'Shipped, Wade: Visit report › Download PDF now includes every photo with its time and place.',
		},
		{
			ref: '#2027',
			date: '2026-09-11',
			account: 'Clearview Windows',
			from: 'Luna Padgett',
			jobTitle: 'Coordinator',
			via: 'app',
			kind: 'idea',
			topic: 'Travel Planner',
			score: 9,
			stage: 'declined',
			owner: 'Mae Loy Ware',
			waitHours: 15,
			title: 'Avoid school roads at drop-off time',
			body: 'Our cars lose twenty minutes outside schools at half past eight.',
			answer: 'We looked into it, Luna, but school times aren’t reliable enough to plan around. Live traffic already avoids the worst of it.',
		},

		/* Thirty to sixty days back. */
		{
			ref: '#2024',
			date: '2026-09-08',
			account: 'Oakhaven Studio',
			from: 'Todd Bishop',
			jobTitle: 'Owner',
			via: 'review',
			kind: 'praise',
			topic: 'Schedule board',
			score: 9,
			stage: 'replied',
			owner: 'Sherry Callahan',
			waitHours: 5,
			title: 'The board held up in our busiest week',
			body: 'Flu week, 40 carers, and nobody lost track of a single visit.',
			answer: 'Thank you, Todd. Glad it held up when it mattered most.',
		},
		{
			ref: '#2020',
			date: '2026-09-05',
			account: 'Moorings Line Studios',
			from: 'Courtney Whitman',
			jobTitle: 'Operations manager',
			via: 'app',
			kind: 'bug',
			topic: 'Invoicing',
			score: 5,
			stage: 'shipped',
			owner: 'Todd Hatcher',
			waitHours: 6,
			title: 'Tax is a cent out on large invoices',
			body: 'Invoices over $10,000 show tax one cent higher than our accounting system.',
			answer: 'Fixed, Courtney. Tax is now rounded once per invoice, the same way your accounting system does it.',
		},
		{
			ref: '#2016',
			date: '2026-09-02',
			account: 'Redline Motion',
			from: 'Travis Teague',
			jobTitle: 'Scheduling lead',
			via: 'survey',
			kind: 'idea',
			topic: 'Travel Planner',
			score: 10,
			stage: 'shipped',
			owner: 'Mae Loy Ware',
			waitHours: 3,
			title: 'Balance days by hours, not visit count',
			body: 'Six short visits and six long ones are not the same day.',
			answer: 'Shipped, Travis: Travel Planner now balances by expected hours.',
		},
		{
			ref: '#2013',
			date: '2026-08-30',
			account: 'Avocet Robotics',
			from: 'Addison Brennan',
			jobTitle: 'Managing director',
			via: 'community',
			kind: 'question',
			topic: 'SMS reminders',
			score: 6,
			stage: 'replied',
			owner: 'Connie Reese',
			waitHours: 10,
			title: 'Why do some reminders arrive late?',
			body: 'A few customers got the morning reminder after the walker had arrived.',
			answer: 'Those numbers were on a carrier that delays bulk texts, Addison. We switched them to another network on August 30.',
		},
		{
			ref: '#2009',
			date: '2026-08-27',
			account: 'Cedar Fell Landscaping',
			from: 'Gerald Pruitt',
			jobTitle: 'Team manager',
			via: 'app',
			kind: 'idea',
			topic: 'Mobile app',
			score: 8,
			stage: 'planned',
			owner: 'Mae Loy Ware',
			waitHours: 7,
			title: 'Bigger buttons for gloved hands',
			body: 'Crews take their gloves off for every tap in winter.',
			answer: 'A large-button mode is planned for the winter release, Gerald.',
		},
		{
			ref: '#2005',
			date: '2026-08-23',
			account: 'Copperleaf Design',
			from: 'Leslie Price',
			jobTitle: 'Operations manager',
			via: 'site',
			kind: 'praise',
			topic: 'Customer Portal',
			score: 9,
			stage: 'replied',
			owner: 'Sherry Callahan',
			waitHours: 2,
			title: 'Clients move their own visits now',
			body: 'Rescheduling calls have almost stopped since the portal went live.',
			answer: 'Thanks, Leslie. That is exactly what we hoped the portal would do.',
		},
		{
			ref: '#2001',
			date: '2026-08-20',
			account: 'Larchwood Sitters',
			from: 'Dana Whitlock',
			jobTitle: 'Operations manager',
			via: 'survey',
			kind: 'bug',
			topic: 'Mobile app',
			score: 4,
			stage: 'shipped',
			owner: 'Todd Hatcher',
			waitHours: 9,
			title: 'Checklist resets when switching visits',
			body: 'Checked items clear if a sitter opens another visit and comes back.',
			answer: 'Fixed in 4.15, Dana. Checklists now save each check straight away.',
		},
		{
			ref: '#1997',
			date: '2026-08-16',
			account: 'Polaris Running Co. Group',
			from: 'Derrick Yost',
			jobTitle: 'Care operations manager',
			via: 'review',
			kind: 'idea',
			topic: 'Reports',
			score: 7,
			stage: 'planned',
			owner: 'Mae Loy Ware',
			waitHours: 16,
			title: 'Report on missed-visit rate',
			body: 'It is the number our biggest contracts are judged on.',
			answer: 'Planned for the Reports update this autumn, Derrick.',
		},
		{
			ref: '#1993',
			date: '2026-08-13',
			account: 'Lumora AI',
			from: 'Marshall Ashby',
			jobTitle: 'Care manager',
			via: 'app',
			kind: 'praise',
			topic: 'Integrations',
			score: 10,
			stage: 'replied',
			owner: 'Sherry Callahan',
			waitHours: 4,
			title: 'Calendar sync just works',
			body: 'Carers see their visits in their own calendar and stopped asking the office.',
			answer: 'Thanks, Marshall. Passing this on to the team who built it.',
		},

		/* Older than sixty days. */
		{
			ref: '#1988',
			date: '2026-08-07',
			account: 'Highpoint Outfitters',
			from: 'Connie Sexton',
			jobTitle: 'Operations director',
			via: 'survey',
			kind: 'bug',
			topic: 'Travel Planner',
			score: 3,
			stage: 'shipped',
			owner: 'Todd Hatcher',
			waitHours: 5,
			title: 'Day plans start at the office, not at home',
			body: 'Most of our carers drive from home, so the first leg of every day plan is wrong.',
			answer: 'Fixed, Connie. Each carer can now start and end at home.',
		},
		{
			ref: '#1984',
			date: '2026-08-02',
			account: 'Lakeside Apparel',
			from: 'Mae Morrow',
			jobTitle: 'General manager',
			via: 'app',
			kind: 'question',
			topic: 'Invoicing',
			score: 8,
			stage: 'replied',
			owner: 'Connie Reese',
			waitHours: 6,
			title: 'Can deposits show on the final invoice?',
			body: 'Customers ask why the deposit they paid is not on the final bill.',
			answer: 'Yes, Mae: turn on Show deposits under Invoice settings and they appear as a paid line.',
		},
		{
			ref: '#1979',
			date: '2026-07-29',
			account: 'Merlin Dog Walking',
			from: 'Hunter Rudd',
			jobTitle: 'Owner',
			via: 'site',
			kind: 'idea',
			topic: 'SMS reminders',
			score: 5,
			stage: 'shipped',
			owner: 'Mae Loy Ware',
			waitHours: 22,
			title: 'Let customers reply to reminders',
			body: 'Replies to our reminders go nowhere, and customers think we ignore them.',
			answer: 'Shipped, Hunter: replies now land in the visit’s messages.',
		},
		{
			ref: '#1975',
			date: '2026-07-24',
			account: 'Bluepeak Studios',
			from: 'Rachel Beck',
			jobTitle: 'Chief executive',
			via: 'community',
			kind: 'praise',
			topic: 'Schedule board',
			score: 9,
			stage: 'replied',
			owner: 'Sherry Callahan',
			waitHours: 3,
			title: 'The week view finally fits on a laptop',
			body: 'No more scrolling sideways to find Friday.',
			answer: 'Thanks, Rachel. Small change, big difference.',
		},
		{
			ref: '#1970',
			date: '2026-07-19',
			account: 'Maple Grove Candles',
			from: 'Tara Kerr',
			jobTitle: 'Owner',
			via: 'survey',
			kind: 'bug',
			topic: 'Mobile app',
			score: 6,
			stage: 'shipped',
			owner: 'Todd Hatcher',
			waitHours: 8,
			title: 'The app asks to sign in every morning',
			body: 'Carers lose ten minutes a day finding their password.',
			answer: 'Fixed, Tara. Sign-ins now last 30 days on a trusted phone.',
		},
		{
			ref: '#1966',
			date: '2026-07-16',
			account: 'Evergreen Arborists',
			from: 'Rory Whitcombe',
			jobTitle: 'Team lead',
			via: 'review',
			kind: 'idea',
			topic: 'Customer Portal',
			score: 10,
			stage: 'shipped',
			owner: 'Mae Loy Ware',
			waitHours: 11,
			title: 'Let customers approve quotes online',
			body: 'Quotes sit in inboxes for days waiting for a signature.',
			answer: 'Shipped, Rory: customers can approve and sign quotes in the portal.',
		},
		{
			ref: '#1962',
			date: '2026-07-13',
			account: 'Harborline AI',
			from: 'Denise Quigley',
			jobTitle: 'Owner',
			via: 'app',
			kind: 'idea',
			topic: 'Reports',
			score: 7,
			stage: 'declined',
			owner: 'John Armstrong',
			waitHours: 30,
			title: 'A dashboard for each team member',
			body: 'Each team member would like to see their own numbers for the week.',
			answer: 'We decided against league tables for staff, Denise. Managers can still filter any report by person.',
		},
	];

	/* What the list is narrowed to right now. */
	const lens = { days: 30, stage: 'all', kind: '', via: '', topic: '', query: '', page: 1 };

	const sheet = pick('#fbk-drawer');
	const sheetForm = pick('[data-fbk-form]');
	const answerBox = pick('[data-fbk-reply]');
	const stageSelect = pick('[data-fbk-status]');
	const ownerSelect = pick('[data-fbk-owner]');
	const surveyDialog = pick('#fbk-survey');
	const surveyForm = pick('[data-fbk-survey]');

	let pageControl = null;
	let listed = [];
	let editing = null;
	let stageTouched = false;

	/**
	 * Binds the drawer and the survey dialog straight away, and the list's
	 * own controls once the document is ready, then paints everything.
	 */
	function start() {
		answerBox.addEventListener('input', matchSaveButton);
		stageSelect.addEventListener('change', () => {
			stageTouched = true;
		});
		sheetForm.addEventListener('submit', submitDrawer);
		sheet.addEventListener('hidden.bs.offcanvas', () => {
			editing = null;
		});

		surveyForm.addEventListener('change', (event) => {
			if (event.target.name === 'kind') previewSurvey();
			if (event.target.matches('[data-fbk-by]')) pick('[data-fbk-by-error]').hidden = true;
		});
		surveyForm.addEventListener('submit', submitSurvey);
		surveyDialog.addEventListener('hidden.bs.modal', () => {
			surveyForm.reset();
			pick('[data-fbk-by-error]').hidden = true;
			window.Basalt.select.refresh(pick('[data-fbk-audience]'));
			previewSurvey();
		});

		document.addEventListener('DOMContentLoaded', wireList);
	}

	function wireList() {
		pageControl = window.Basalt.pagination(pick('[data-fbk-pager]'), {
			total: 1,
			current: 1,
			label: 'Page',
			onChange: (page) => {
				lens.page = page;
				showRows(windowRows());
			},
		});

		pick('[data-fbk-period]').addEventListener('change', (event) => {
			lens.days = Number(event.target.value);
			lens.page = 1;
			repaint();
		});

		pick('[data-fbk-chips]').addEventListener('click', (event) => {
			const pressedChip = event.target.closest('[data-fbk-chip]');
			if (!pressedChip) return;
			lens.stage = pressedChip.getAttribute('data-fbk-chip');
			lens.page = 1;
			repaint();
			refocus(`[data-fbk-chip="${lens.stage}"]`, event);
		});

		/* A status column filters the list like its chip; a second click clears it. */
		pick('[data-fbk-flow]').addEventListener('click', (event) => {
			const column = event.target.closest('[data-fbk-flow-stage]');
			if (!column) return;
			const stage = column.getAttribute('data-fbk-flow-stage');
			lens.stage = lens.stage === stage ? 'all' : stage;
			lens.page = 1;
			repaint();
			refocus(`[data-fbk-flow-stage="${stage}"]`, event);
		});

		pick('[data-fbk-search]').addEventListener('input', (event) => {
			lens.query = event.target.value.trim();
			lens.page = 1;
			repaint();
		});

		const selects = { '[data-fbk-type]': 'kind', '[data-fbk-source]': 'via' };
		for (const [selector, key] of Object.entries(selects)) {
			pick(selector).addEventListener('change', (event) => {
				lens[key] = event.target.value;
				lens.page = 1;
				repaint();
			});
		}

		pick('[data-fbk-export]').addEventListener('click', downloadList);

		pick('[data-fbk-rows]').addEventListener('click', (event) => {
			if (event.target.closest('a')) return;
			const button = event.target.closest('[data-fbk-open]');
			const row = event.target.closest('tr[data-fbk-id]');
			const ref = button?.getAttribute('data-fbk-open') ?? row?.getAttribute('data-fbk-id');
			if (ref != null) openFeedback(ref);
		});

		previewSurvey();
		repaint();
	}

	/* A keyboard press re-renders the button it pressed, so focus is put
     back on the new copy. A mouse click (detail above 0) leaves it be. */
	function refocus(selector, event) {
		const fresh = pick(selector);
		if (fresh && event.detail === 0) fresh.focus();
	}

	/* Small helpers for the DOM, dates and numbers. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
	}

	function withCommas(number) {
		return number.toLocaleString('en-US');
	}

	function toDate(iso) {
		const [year, month, date] = iso.split('-').map(Number);
		return new Date(year, month - 1, date);
	}

	function ageInDays(iso) {
		return Math.round((ANCHOR_DAY - toDate(iso)) / 86400000);
	}

	/** "Today", "Yesterday" and "3 days ago" for the past week, then "Sep 28". */
	function whenLabel(iso) {
		const age = ageInDays(iso);
		const nearDays = { 0: 'Today', 1: 'Yesterday' };
		if (age in nearDays) return nearDays[age];
		if (age < 7) return `${age} days ago`;
		const day = toDate(iso);
		return `${MONTH_ABBR[day.getMonth()]} ${day.getDate()}`;
	}

	function calendarLabel(iso) {
		const day = toDate(iso);
		return `${MONTH_ABBR[day.getMonth()]} ${day.getDate()}, ${day.getFullYear()}`;
	}

	function bandOf(score) {
		if (score >= 9) return 'promoter';
		if (score >= 7) return 'passive';
		return 'detractor';
	}

	/* The first name, lowercased and without accents, at the customer's domain. */
	function mailTo(record) {
		const firstName = record.from
			.split(' ')[0]
			.toLowerCase()
			.normalize('NFD')
			.replace(/[^a-z]/g, '');
		return `${firstName}@${CLIENT_PLANS[record.account].domain}`;
	}

	/* Choosing rows and counting them. */

	/** Received at least `from` days ago and fewer than `to` days ago. */
	function inWindow(record, from, to) {
		const age = ageInDays(record.date);
		return age >= from && age < to;
	}

	function windowRows() {
		return FEEDBACK.filter((record) => inWindow(record, 0, lens.days));
	}

	/* Every filter but the period. The status chips leave out their own
     filter so each chip can count what picking it would show. */
	function fitsFilters(record, ignoreStage) {
		const checks = [
			() => ignoreStage || lens.stage === 'all' || record.stage === lens.stage,
			() => !lens.kind || record.kind === lens.kind,
			() => !lens.via || record.via === lens.via,
			() => !lens.topic || record.topic === lens.topic,
			() =>
				!lens.query ||
				window.Basalt.matchesQuery(
					[record.account, record.from, record.title, record.body, record.topic, record.ref].join(' '),
					lens.query,
				),
		];
		return checks.every((check) => check());
	}

	/** Median hours to the first reply, ignoring rows nobody has answered. */
	function medianWait(rows) {
		const hours = rows
			.map((record) => record.waitHours)
			.filter((wait) => wait != null)
			.sort((a, b) => a - b);
		if (!hours.length) return null;
		const middle = Math.floor(hours.length / 2);
		if (hours.length % 2) return hours[middle];
		return Math.round((hours[middle - 1] + hours[middle]) / 2);
	}

	/* Painting the page. repaint() runs every part in turn from one set of rows. */

	function repaint() {
		const rows = windowRows();
		showFigures(rows);
		showQueue(rows);
		showFlow(rows);
		showChips(rows);
		showApplied();
		showRows(rows);
	}

	function showFigures(rows) {
		const median = medianWait(rows);
		pick('[data-fbk-fig="new"]').textContent = rows.filter((record) => record.stage === 'new').length;
		pick('[data-fbk-fig="reply"]').textContent = median == null ? '–' : `${median}h`;
	}

	/* Waiting on a reply: how many, since when, split by age, then how fast
     the first reply usually comes against REPLY_GOAL hours. */
	function showQueue(rows) {
		const waiting = rows.filter((record) => record.stage === 'new');
		pick('[data-fbk-queue-count]').textContent = waiting.length;
		const oldest = waiting.reduce((age, record) => Math.max(age, ageInDays(record.date)), 0);
		const oldestRow = waiting.find((record) => ageInDays(record.date) === oldest);
		pick('[data-fbk-queue-since]').textContent = !waiting.length
			? 'Nobody is waiting.'
			: oldest === 0
				? 'waiting, all from today'
				: `waiting, the oldest since ${oldest === 1 ? 'yesterday' : WEEKDAYS[toDate(oldestRow.date).getDay()]}`;

		const ages = [
			{ label: 'Today', tone: 'fresh', n: waiting.filter((record) => ageInDays(record.date) === 0).length },
			{ label: 'Yesterday', tone: 'aging', n: waiting.filter((record) => ageInDays(record.date) === 1).length },
			{ label: 'Older', tone: 'old', n: waiting.filter((record) => ageInDays(record.date) >= 2).length },
		].filter((age) => age.n);
		const box = pick('[data-fbk-ages]');
		box.hidden = !ages.length;
		box.setAttribute('role', 'img');
		box.setAttribute('aria-label', ages.map((age) => `${age.label}: ${age.n}`).join(', '));
		box.innerHTML = ages
			.map(
				(age) =>
					`<span class="fbk-age fbk-age-${age.tone} share-${Math.round((age.n / waiting.length) * 100)}"><span class="fbk-age-bar">${age.n}</span><span class="fbk-age-label">${age.label}</span></span>`,
			)
			.join('');

		const median = medianWait(rows);
		const top = Math.max(REPLY_GOAL * 1.2, (median || 0) * 1.1);
		pick('[data-fbk-firstreply-text]').innerHTML =
			median == null ? 'No replies yet in this period' : `First reply usually takes <b>${median} h</b>`;
		pick('[data-fbk-firstreply-goal]').textContent = `Goal ${REPLY_GOAL} h`;
		const fill = pick('[data-fbk-firstreply-fill]');
		fill.className = `fbk-firstreply-fill w-${Math.round(((median || 0) / top) * 100)}${median > REPLY_GOAL ? ' is-over' : ''}`;
		pick('[data-fbk-firstreply-mark]').className =
			`fbk-firstreply-mark target-${Math.round((REPLY_GOAL / top) * 100)}`;
	}

	/* What happened to feedback: a column per status, tallest for the most.
     The one picked in the list's chips is lit. */
	function showFlow(rows) {
		const counts = Object.keys(PROGRESS).map((stage) => ({
			stage,
			label: PROGRESS[stage].label,
			n: rows.filter((record) => record.stage === stage).length,
		}));
		const top = Math.max(1, ...counts.map((count) => count.n));
		pick('[data-fbk-flow]').innerHTML = counts
			.map((count) => {
				const pressed = lens.stage === count.stage;
				const share = rows.length ? Math.round((count.n / rows.length) * 100) : 0;
				return `<li><button type="button" class="fbk-flow-step fbk-flow-${count.stage}${pressed ? ' is-on' : ''}" data-fbk-flow-stage="${count.stage}" aria-pressed="${pressed}"><span class="fbk-flow-col" aria-hidden="true"><span class="fbk-flow-bar value-${Math.max(4, Math.round((count.n / top) * 100))}"></span></span><span class="fbk-flow-n">${count.n}</span><span class="fbk-flow-label">${count.label}<span class="visually-hidden">: ${share}% of all</span></span></button></li>`;
			})
			.join('');
	}

	/* One chip per status, each counting what it would show with every
     other filter kept. */
	function showChips(rows) {
		const candidates = rows.filter((record) => fitsFilters(record, true));
		const chipSet = [['all', 'All', candidates.length]];
		for (const [stage, { label }] of Object.entries(PROGRESS)) {
			chipSet.push([stage, label, candidates.filter((record) => record.stage === stage).length]);
		}
		pick('[data-fbk-chips]').innerHTML = chipSet
			.map(([stage, label, total]) => {
				const pressed = lens.stage === stage;
				return `<button type="button" class="fbk-chip${pressed ? ' is-on' : ''}" aria-pressed="${pressed}" data-fbk-chip="${stage}">${label} <span class="fbk-chip-n">${total}</span></button>`;
			})
			.join('');
	}

	/* Only the topic shows up as a removable chip; the selects and the
     search box show their own state. */
	function showApplied() {
		const chipSet = [];
		if (lens.topic) {
			chipSet.push({
				label: `Topic: ${lens.topic}`,
				remove: () => {
					lens.topic = '';
					lens.page = 1;
					repaint();
				},
			});
		}
		window.Basalt.drawer.applied(pick('[data-fbk-applied]'), chipSet, null, pick('[data-fbk-search]'));
	}

	function stagePill(stage) {
		const { label, pillClass } = PROGRESS[stage];
		return `<span class="basalt-status basalt-status-dot${pillClass ? ` ${pillClass}` : ''}">${label}</span>`;
	}

	function scoreChip(score) {
		return `<span class="fbk-score-pill fbk-score-pill-${bandOf(score)}">${score}</span>`;
	}

	function rowMarkup(record) {
		const { label, glyph } = KINDS[record.kind];
		const { plan, seats } = CLIENT_PLANS[record.account];
		const unread = record.stage === 'new';
		const columns = [
			`<td class="fbk-c-who"><span class="fbk-who"><span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(record.account)}" aria-hidden="true"></span><span class="fbk-who-text"><a class="fbk-who-name" href="company-details.html">${htmlSafe(record.account)}</a><span class="fbk-who-meta">${plan} · ${seats} seats</span></span></span></td>`,
			`<td class="fbk-c-what"><span class="fbk-what-title">${htmlSafe(record.title)}</span><span class="fbk-what-meta">${htmlSafe(record.topic)} · ${CHANNELS[record.via]}</span></td>`,
			`<td class="fbk-c-type"><span class="fbk-type fbk-type-${record.kind}"><i class="bi bi-${glyph}" aria-hidden="true"></i>${label}</span></td>`,
			`<td class="fbk-c-score"><span class="fbk-c-label">Score </span>${scoreChip(record.score)}</td>`,
			`<td class="fbk-c-status">${stagePill(record.stage)}</td>`,
			`<td class="fbk-c-when">${whenLabel(record.date)}</td>`,
			`<td class="fbk-c-act"><button type="button" class="btn btn-sm btn-outline-${unread ? 'primary' : 'secondary'}" data-fbk-open="${record.ref}">${unread ? 'Reply' : 'Open'}<span class="visually-hidden">: ${htmlSafe(record.title)}</span></button></td>`,
		];
		return `<tr data-fbk-id="${record.ref}">${columns.join('')}</tr>`;
	}

	/* The table, one page at a time, or an empty state that says why
     nothing is there. */
	function showRows(rows) {
		const matching = rows.filter((record) => fitsFilters(record, false));
		listed = matching;
		const pageCount = Math.max(1, Math.ceil(matching.length / ROWS_PER_PAGE));
		lens.page = Math.min(lens.page, pageCount);
		const startAt = (lens.page - 1) * ROWS_PER_PAGE;
		const onPage = matching.slice(startAt, startAt + ROWS_PER_PAGE);

		const tableBody = pick('[data-fbk-rows]');
		const emptyBox = pick('[data-fbk-empty]');
		tableBody.innerHTML = onPage.map(rowMarkup).join('');
		window.Basalt.avatars(tableBody);

		if (!matching.length) emptyBox.innerHTML = emptyMessage();
		emptyBox.hidden = matching.length > 0;
		pick('.fbk-table-wrap').hidden = !matching.length;
		pick('[data-fbk-pager-wrap]').hidden = matching.length <= ROWS_PER_PAGE;
		pick('[data-fbk-range]').textContent = matching.length
			? `${startAt + 1}–${startAt + onPage.length} of ${matching.length}`
			: '';
		pageControl?.setTotal(pageCount);
		if (pageControl && pageControl.get() !== lens.page) pageControl.set(lens.page);

		pick('[data-fbk-list-sub]').textContent =
			`${withCommas(rows.length)} in the last ${lens.days} days, newest first. Open one to reply.`;
	}

	function emptyMessage() {
		const narrowed = lens.kind || lens.via || lens.topic || lens.stage !== 'all';
		if (lens.query) {
			return window.Basalt.emptyState({
				query: lens.query,
				noun: 'feedback',
				text: narrowed ? 'Check the spelling, or clear the other filters.' : '',
			});
		}
		if (lens.stage === 'new' && !lens.kind && !lens.via && !lens.topic) {
			return window.Basalt.emptyState({
				icon: 'check2-circle',
				title: 'Nothing new to read',
				text: 'Every piece of feedback in this period has a reply.',
			});
		}
		return window.Basalt.emptyState({
			icon: 'funnel',
			title: 'Nothing matches these filters',
			text: 'Try another status, type or source.',
		});
	}

	/* The drawer shows one piece of feedback and takes a reply, a status
     and an owner. */

	function drawerPart(name) {
		return pick(`[data-fbk-d="${name}"]`, sheet);
	}

	function openFeedback(ref) {
		const record = FEEDBACK.find((candidate) => candidate.ref === ref);
		if (!record) return;
		editing = record;
		stageTouched = false;
		const { plan, seats } = CLIENT_PLANS[record.account];

		drawerPart('title').textContent = record.title;
		drawerPart('sub').textContent = `${record.ref} · ${calendarLabel(record.date)} · ${CHANNELS[record.via]}`;
		drawerPart('avatar').setAttribute('data-name', record.from);
		window.Basalt.avatar(drawerPart('avatar'));
		drawerPart('contact').textContent = `${record.from}, ${record.jobTitle}`;
		drawerPart('customer').textContent = record.account;
		drawerPart('plan').textContent = `· ${plan}, ${seats} seats`;

		const scoreBadge = drawerPart('score');
		scoreBadge.className = `fbk-score-pill fbk-score-pill-${bandOf(record.score)}`;
		scoreBadge.textContent = record.score;
		scoreBadge.setAttribute('title', `Score ${record.score} of 10`);

		drawerPart('comment').textContent = record.body;
		drawerPart('facts').textContent =
			`${KINDS[record.kind].label} · ${record.topic} · scored ${record.score} of 10`;

		const answered = Boolean(record.answer);
		drawerPart('thread-wrap').hidden = !answered;
		if (answered) showEarlierAnswer(record);
		drawerPart('reply-label').textContent = answered ? 'Reply again' : 'Reply';

		answerBox.value = '';
		answerBox.placeholder = `Hi ${record.from.split(' ')[0]}, thanks for…`;
		drawerPart('reply-hint').textContent = `Sent by email to ${mailTo(record)}.`;
		stageSelect.value = record.stage;
		ownerSelect.value = record.owner;
		matchSaveButton();
		bootstrap.Offcanvas.getOrCreateInstance(sheet).show();
	}

	function showEarlierAnswer(record) {
		const author = record.answeredBy || record.owner;
		const hours = record.waitHours;
		const timing = hours === 0 ? 'just now' : `after ${hours}${hours === 1 ? ' hour' : ' hours'}`;
		const replyBox = drawerPart('thread');
		replyBox.innerHTML = `<div class="fbk-reply-head"><span class="basalt-avatar basalt-avatar-xs" data-basalt-avatar data-name="${htmlSafe(author)}" aria-hidden="true"></span><span class="fbk-reply-by">${htmlSafe(author)}</span><span class="fbk-reply-when">${timing}</span></div><p class="fbk-reply-text">${htmlSafe(record.answer)}</p>`;
		window.Basalt.avatars(replyBox);
	}

	/* The button reads "Send reply" once something is typed. Typing a reply
     to a New item also moves it to Replied, unless the status was chosen
     by hand. */
	function matchSaveButton() {
		const typed = answerBox.value.trim();
		pick('[data-fbk-save-label]').textContent = typed ? 'Send reply' : 'Save';
		if (!stageTouched && editing?.stage === 'new') stageSelect.value = typed ? 'replied' : 'new';
	}

	function submitDrawer(event) {
		event.preventDefault();
		if (!editing) return;
		const record = editing;
		const typed = answerBox.value.trim();
		const edits = { stage: stageSelect.value, owner: ownerSelect.value };
		if (typed) {
			Object.assign(edits, { answer: typed, answeredBy: SIGNED_IN });
			if (record.waitHours == null) edits.waitHours = 0;
		}
		const stageBefore = record.stage;

		saveFeedback(record, edits).then(() => {
			bootstrap.Offcanvas.getOrCreateInstance(sheet).hide();
			repaint();
			const movedNote = stageBefore === record.stage ? '' : ` It is now ${PROGRESS[record.stage].label}.`;
			window.Basalt.toasts.push({
				tone: 'success',
				title: typed ? `Reply sent to ${record.from}` : 'Saved',
				text: `${typed ? '' : `${record.title}.`}${movedNote}`,
			});
		});
	}

	/** Where an edit reaches the server. The demo applies it at once. */
	function saveFeedback(record, edits) {
		Object.assign(record, edits);
		return Promise.resolve(record);
	}

	/* The survey dialog previews the chosen question on its own scale and
     refuses to send until at least one way of sending is on. */

	function previewSurvey() {
		const { ask, low, high, ends } = QUESTIONS[pick('input[name="kind"]:checked', surveyForm).value];
		pick('[data-fbk-preview-q]').textContent = ask;
		let marks = '';
		for (let mark = low; mark <= high; mark += 1) marks += `<span>${mark}</span>`;
		const scale = pick('[data-fbk-preview-scale]');
		scale.innerHTML = marks;
		scale.style.setProperty('--fbk-cells', high - low + 1);
		pick('[data-fbk-preview-ends]').innerHTML = `<span>${ends[0]}</span><span>${ends[1]}</span>`;
	}

	function submitSurvey(event) {
		event.preventDefault();
		const ways = pickAll('[data-fbk-by]', surveyForm).filter((toggle) => toggle.checked);
		if (!ways.length) {
			pick('[data-fbk-by-error]').hidden = false;
			pick('[data-fbk-by]', surveyForm).focus();
			return;
		}
		const recipients = Number(pick('[data-fbk-audience]').value);
		const request = { kind: surveyForm.kind.value, audience: recipients, by: ways.map((toggle) => toggle.name) };
		sendSurvey(request).then(() => {
			bootstrap.Modal.getOrCreateInstance(surveyDialog).hide();
			window.Basalt.toasts.push({
				tone: 'success',
				title: `Survey sent to ${withCommas(recipients)} accounts`,
				text: 'Answers will show up in this list as they come in.',
			});
		});
	}

	/** Where a survey reaches the server. */
	function sendSurvey(request) {
		return Promise.resolve(request);
	}

	/* The export holds every row the filters let through, not just the
     page on screen. */
	function downloadList() {
		function quoted(value) {
			return `"${String(value).replace(/"/g, '""')}"`;
		}

		const records = listed.map((record) => [
			record.ref,
			record.date,
			record.account,
			record.from,
			KINDS[record.kind].label,
			record.topic,
			CHANNELS[record.via],
			record.score,
			PROGRESS[record.stage].label,
			record.owner,
			record.title,
			record.body,
		]);
		const csv = [CSV_COLUMNS, ...records].map((cells) => cells.map(quoted).join(',')).join('\r\n');

		const blobUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
		const anchor = Object.assign(document.createElement('a'), {
			href: blobUrl,
			download: 'fieldline-feedback.csv',
		});
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
		window.Basalt.toasts.push({
			tone: 'success',
			title: `Exported ${listed.length} rows`,
			text: 'Saved as fieldline-feedback.csv.',
		});
	}

	start();
})();
