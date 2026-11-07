/**
 * Reply Templates, the script behind reply-templates.html ([data-mt-root]).
 *
 * Keeps the library of messages Fieldline sends over and over: emails,
 * texts, Support and Chat replies and app notifications. Every template
 * carries merge fields like {{customer.first_name}}, a preview filled from
 * a sample customer, a trail of saved versions and its send figures.
 *
 * Wiring in a real backend takes two steps. SEED stands in for the answer
 * of the first request and nothing in the markup is a template, so swap it
 * for your data or let server.load() fetch it. Then fill in the server
 * methods, one request each: the page changes first, calls the method, and
 * if the request fails it rolls itself back and raises an error toast.
 *
 * In use: pick a template to edit it (edits wait per template until saved
 * or thrown away); saving a changed subject or text makes a new version;
 * Insert field, or typing {{, opens the merge field picker; the history
 * drawer shows any version and loads it back as a draft; a test sends the
 * unsaved text filled from a sample; duplicating and archiving offer Undo.
 *
 * The toasts, drawer, dialogs, hold-to-confirm, command menu, styled
 * selects, avatars, tooltips, copy and loading buttons, empty states and
 * the screen reader announcer all come from basalt.js.
 */
(() => {
	'use strict';

	const shell = pick('[data-mt-root]');
	if (!shell) return;

	/* What the server would answer with, in its shape. today is the date the
     demo pretends it is; a live build reads the real clock. signedIn names
     the viewer from team. Each kind has a rateLabel for its response figure,
     since notifications get opened rather than answered. A category hue
     picks one of the eight chart colors. fieldGroups feeds the picker, and
     personas are made-up recipients that the preview and test sends draw
     values from; a field a persona lacks shows up as missing. fromLines is
     the email sender per category. On a template, status is live, draft or
     archived; versions run newest first and the first one is what is live;
     perWeek holds the last eight weeks of sends, oldest first; rate is a
     share from 0 to 1, or null before any send; handSends splits manual
     sends by person while trigger explains what sends it unattended; latest
     lists recent sends as [name, company, when, replied]. openElsewhere
     marks templates a teammate has open right now. */
	const SEED = {
		today: '2026-10-02T16:20:00',
		signedIn: 'john',
		team: [
			{
				id: 'john',
				name: 'John Armstrong',
				role: 'Administrator',
				email: 'john@fieldline.app',
				phone: '(415) 555-0101',
			},
			{
				id: 'elaine',
				name: 'Elaine Nugent',
				role: 'Support lead',
				email: 'elaine@fieldline.app',
				phone: '(415) 555-0117',
			},
			{
				id: 'connie',
				name: 'Lindsay Kinney',
				role: 'Customer success',
				email: 'connie@fieldline.app',
				phone: '(415) 555-0124',
			},
			{ id: 'theo', name: 'Theo Barlow', role: 'Sales', email: 'theo@fieldline.app', phone: '(415) 555-0138' },
			{ id: 'dawn', name: 'Dawn Zeller', role: 'Finance', email: 'dawn@fieldline.app', phone: '(415) 555-0142' },
			{
				id: 'rory',
				name: 'Rory Whitlock',
				role: 'Product, scheduling',
				email: 'rory@fieldline.app',
				phone: '(415) 555-0156',
			},
			{
				id: 'courtney',
				name: 'Courtney Lowry',
				role: 'Marketing',
				email: 'courtney@fieldline.app',
				phone: '(415) 555-0163',
			},
		],
		kinds: [
			{
				id: 'email',
				name: 'Email',
				pluralName: 'Email',
				icon: 'bi-envelope',
				rateLabel: 'Reply rate',
				pickedIn: 'Mail',
			},
			{ id: 'sms', name: 'SMS', pluralName: 'SMS', icon: 'bi-phone', rateLabel: 'Reply rate', pickedIn: 'SMS' },
			{
				id: 'canned',
				name: 'Canned reply',
				pluralName: 'Canned replies',
				icon: 'bi-reply',
				rateLabel: 'Reply rate',
				pickedIn: 'Support and Chat',
			},
			{
				id: 'notification',
				name: 'Notification',
				pluralName: 'Notifications',
				icon: 'bi-bell',
				rateLabel: 'Opened',
				pickedIn: 'the mobile app',
			},
		],
		categories: [
			{ id: 'onboarding', name: 'Onboarding', hue: 1 },
			{ id: 'billing', name: 'Billing', hue: 4 },
			{ id: 'support', name: 'Support', hue: 3 },
			{ id: 'schedule', name: 'Schedule', hue: 2 },
		],
		fieldGroups: [
			{
				heading: 'Customer',
				entries: [
					['customer.first_name', 'First name'],
					['customer.last_name', 'Last name'],
					['customer.company', 'Company'],
					['customer.email', 'Email address'],
					['customer.phone', 'Phone number'],
				],
			},
			{
				heading: 'Business',
				entries: [
					['account.name', 'Business name, as the customer knows it'],
					['account.phone', 'Business phone'],
					['account.portal_link', 'Customer Portal link'],
				],
			},
			{
				heading: 'Visit',
				entries: [
					['visit.date', 'Visit date'],
					['visit.time', 'Expected arrival time'],
					['visit.window', 'Arrival window'],
					['visit.service', 'Service booked'],
					['visit.address', 'Visit address'],
					['visit.ref', 'Booking number'],
					['staff.first_name', 'Team member first name'],
				],
			},
			{
				heading: 'Billing',
				entries: [
					['invoice.number', 'Invoice number'],
					['invoice.total', 'Invoice total'],
					['invoice.due_date', 'Due or renewal date'],
					['invoice.link', 'Payment link'],
					['plan.name', 'Plan name'],
					['plan.seats', 'Seats on the plan'],
					['trial.end_date', 'Trial end date'],
					['sms.credits_left', 'SMS credits left'],
				],
			},
			{
				heading: 'Support',
				entries: [
					['ticket.id', 'Ticket number'],
					['ticket.subject', 'Ticket subject'],
					['agent.first_name', 'Your first name'],
				],
			},
			{
				heading: 'Reports',
				entries: [
					['report.visits_done', 'Visits completed last week'],
					['report.on_time', 'On-time arrivals'],
					['report.reminders', 'Reminders sent'],
				],
			},
		],
		personas: [
			{
				id: 'rachel',
				name: 'Rachel Monroe',
				hint: 'Client, Northgate Analytics visit',
				fills: {
					'customer.first_name': 'Rachel',
					'customer.last_name': 'Monroe',
					'customer.email': 'rachel.monroe@example.com',
					'customer.phone': '(503) 555-0148',
					'account.name': 'Northgate Analytics',
					'account.phone': '(503) 555-0100',
					'account.portal_link': 'fldl.co/ng/8KX2',
					'visit.date': 'Sat, Oct 3',
					'visit.time': '2:30 PM',
					'visit.window': '2:00 to 4:00 PM',
					'visit.service': 'Care visit',
					'visit.address': '1186 Alder St, Eugene',
					'visit.ref': '#20417',
					'staff.first_name': 'Lance',
					'invoice.number': '#20931',
					'invoice.total': '$214.50',
					'invoice.due_date': 'Oct 16',
					'invoice.link': 'fldl.co/pay/20931',
					'ticket.id': '#4821',
					'ticket.subject': 'The staff app keeps signing out',
				},
			},
			{
				id: 'dana',
				name: 'Dana Whitfield',
				hint: 'Office manager, Lakeside Apparel & Walks (on trial)',
				fills: {
					'customer.first_name': 'Dana',
					'customer.last_name': 'Whitfield',
					'customer.company': 'Lakeside Apparel & Walks',
					'customer.email': 'dana@lakesideapparel.example',
					'customer.phone': '(612) 555-0193',
					'account.name': 'Lakeside Apparel & Walks',
					'account.phone': '(612) 555-0110',
					'account.portal_link': 'fldl.co/lk/2RQ9',
					'visit.date': 'Mon, Oct 5',
					'visit.time': '9:00 AM',
					'visit.window': '8:00 to 10:00 AM',
					'visit.service': 'Dog walk, 60 minutes',
					'visit.address': '42 Birchwood Ave, Edina',
					'visit.ref': '#11873',
					'staff.first_name': 'Andre',
					'invoice.number': '#21044',
					'invoice.total': '$192.00',
					'invoice.due_date': 'Oct 12',
					'invoice.link': 'fldl.co/pay/21044',
					'plan.name': 'Pro',
					'plan.seats': '6',
					'trial.end_date': 'Monday, Oct 5',
					'sms.credits_left': '180',
					'ticket.id': '#4836',
					'ticket.subject': 'Importing customers from a spreadsheet',
					'report.visits_done': '64',
					'report.on_time': '91%',
					'report.reminders': '58',
				},
			},
			{
				id: 'trent',
				name: 'Todd Bishop',
				hint: 'Owner, Oakhaven Studio (Max, yearly)',
				fills: {
					'customer.first_name': 'Todd',
					'customer.last_name': 'Bishop',
					'customer.company': 'Oakhaven Studio',
					'customer.email': 'trent@oakhavenstudio.example',
					'customer.phone': '(210) 555-0172',
					'account.name': 'Oakhaven Studio',
					'account.phone': '(210) 555-0100',
					'account.portal_link': 'fldl.co/mh/5TB1',
					'visit.date': 'Tue, Oct 6',
					'visit.time': '11:30 AM',
					'visit.window': '11:00 AM to 1:00 PM',
					'visit.service': 'Weekly care check-in',
					'visit.address': '7730 Mesa Verde Dr, San Antonio',
					'visit.ref': '#30552',
					'staff.first_name': 'Kiara',
					'invoice.number': '#20877',
					'invoice.total': '$22,040.00',
					'invoice.due_date': 'Oct 19',
					'invoice.link': 'fldl.co/pay/20877',
					'plan.name': 'Max',
					'plan.seats': '38',
					'sms.credits_left': '9,850',
					'ticket.id': '#4809',
					'ticket.subject': 'Travel Planner skipped two visits',
					'report.visits_done': '1,208',
					'report.on_time': '96%',
					'report.reminders': '1,131',
				},
			},
		],
		fromLines: {
			onboarding: 'John Armstrong at Fieldline <john@fieldline.app>',
			billing: 'Fieldline Billing <billing@fieldline.app>',
			support: 'Fieldline Support <support@fieldline.app>',
			schedule: 'Fieldline Reports <reports@fieldline.app>',
		},
		templates: [
			{
				id: 'tpl-welcome',
				type: 'email',
				category: 'onboarding',
				status: 'live',
				name: 'Welcome to Fieldline',
				persona: 'dana',
				owner: 'connie',
				perWeek: [38, 41, 36, 44, 47, 52, 49, 55],
				lifetime: 4180,
				rate: 0.18,
				trigger: 'Automatically, a minute after a new account signs up.',
				latest: [
					['Dana Whitfield', 'Lakeside Apparel & Walks', '2026-09-28T10:04:00', true],
					['Gerald Price', 'Moorings Point Apparel', '2026-10-02T09:12:00', false],
					['Carly Calder', 'Cedar Fell Outdoor', '2026-10-01T15:47:00', false],
				],
				versions: [
					{
						number: 3,
						savedAt: '2026-09-14T11:20:00',
						author: 'connie',
						summary: 'Shorter list, added the SMS reminders step',
						subject: 'Welcome to Fieldline, {{customer.first_name}}',
						body: 'Hi {{customer.first_name}},\n\nThanks for choosing Fieldline for {{customer.company}}. Your workspace is ready, and your trial runs until {{trial.end_date}}.\n\nThree things get most teams running in their first week:\n1. Add your team members so they can sign in to the mobile app.\n2. Import your customer list, or add your next five visits by hand.\n3. Turn on SMS reminders so customers know when you are coming.\n\nIf you would like a hand, reply to this email and I will set up a 20-minute call.\n\n{{agent.first_name}}\nFieldline Customer Success',
					},
					{
						number: 2,
						savedAt: '2026-07-02T09:45:00',
						author: 'connie',
						summary: 'Added the customer’s first name to the subject',
						subject: 'Welcome to Fieldline, {{customer.first_name}}',
						body: 'Hi {{customer.first_name}},\n\nThanks for choosing Fieldline for {{customer.company}}. Your workspace is ready, and your trial runs until {{trial.end_date}}.\n\nTo get started, add your team members, import your customers and book your first visit. Our help center has a short video for each step.\n\nIf you would like a hand, reply to this email and I will set up a call.\n\n{{agent.first_name}}\nFieldline Customer Success',
					},
					{
						number: 1,
						savedAt: '2026-03-18T14:10:00',
						author: 'courtney',
						summary: 'First version',
						subject: 'Welcome to Fieldline',
						body: 'Hi {{customer.first_name}},\n\nWelcome to Fieldline. Your workspace for {{customer.company}} is ready.\n\nTo get started, add your team members, import your customers and book your first visit.\n\nThe Fieldline team',
					},
				],
			},
			{
				id: 'tpl-first-day',
				type: 'email',
				category: 'onboarding',
				status: 'live',
				name: 'Day 3: plan your first day',
				persona: 'dana',
				owner: 'connie',
				perWeek: [30, 33, 29, 35, 36, 40, 38, 42],
				lifetime: 2310,
				rate: 0.09,
				trigger: 'Automatically, on day 3 of a trial if no day has been planned yet.',
				latest: [
					['Quentin Cook', 'Brightline Photography', '2026-10-02T08:00:00', false],
					['Dana Whitfield', 'Lakeside Apparel & Walks', '2026-10-01T08:00:00', true],
				],
				versions: [
					{
						number: 2,
						savedAt: '2026-08-21T16:05:00',
						author: 'connie',
						summary: 'Mention the Travel Planner trial',
						subject: 'Your first day plan takes about five minutes',
						body: 'Hi {{customer.first_name}},\n\nMost schedulers save the most time once their visits are on the map. Open Schedule, pick tomorrow, and drag each visit onto a team member. Fieldline puts them in travel order for you.\n\nIf {{customer.company}} runs more than 20 visits a day, the Travel Planner add-on can plan the whole day in one click. You can try it free until {{trial.end_date}}.\n\n{{agent.first_name}}',
					},
					{
						number: 1,
						savedAt: '2026-05-04T10:30:00',
						author: 'connie',
						summary: 'First version',
						subject: 'Your first day plan takes about five minutes',
						body: 'Hi {{customer.first_name}},\n\nMost schedulers save the most time once their visits are on the map. Open Schedule, pick tomorrow, and drag each visit onto a team member. Fieldline puts them in travel order for you.\n\n{{agent.first_name}}',
					},
				],
			},
			{
				id: 'tpl-invite-team',
				type: 'email',
				category: 'onboarding',
				status: 'draft',
				name: 'Invite your team members',
				persona: 'dana',
				owner: 'courtney',
				perWeek: [0, 0, 0, 0, 0, 0, 0, 0],
				lifetime: 0,
				rate: null,
				trigger: 'Automatically, on day 5 of a trial if only one person has signed in.',
				latest: [],
				versions: [
					{
						number: 1,
						savedAt: '2026-10-01T17:32:00',
						author: 'courtney',
						summary: 'First draft',
						subject: '{{customer.first_name}}, your team members are one tap away',
						body: 'Hi {{customer.first_name}},\n\nYou have {{plan.seats}} seats on the {{plan.name}} plan, and so far only you have signed in. Each person you invite gets a text with a link to the Fieldline app, and they can see their visits for the day as soon as they open it.\n\nInvite them from Settings, then Team. It takes under a minute each.\n\n{{agent.first_name}}',
					},
				],
			},
			{
				id: 'tpl-trial-ending',
				type: 'email',
				category: 'billing',
				status: 'live',
				name: 'Trial ends in 3 days',
				persona: 'dana',
				owner: 'dawn',
				perWeek: [22, 25, 21, 27, 24, 29, 31, 28],
				lifetime: 1564,
				rate: 0.24,
				trigger: 'Automatically, three days before a trial ends.',
				latest: [
					['Dana Whitfield', 'Lakeside Apparel & Walks', '2026-10-02T07:00:00', true],
					['Phyllis Riggs', 'Highpoint Outfitters', '2026-10-01T07:00:00', false],
					['Kirk Mathis', 'Ironwood Studios', '2026-09-30T07:00:00', true],
				],
				versions: [
					{
						number: 2,
						savedAt: '2026-09-09T13:15:00',
						author: 'dawn',
						summary: 'Prices for the new plans, two months free on yearly',
						subject: 'Your Fieldline trial ends on {{trial.end_date}}',
						body: 'Hi {{customer.first_name}},\n\nYour trial for {{customer.company}} ends on {{trial.end_date}}. To keep your visits, customers and schedules, pick a plan before then:\n\nStarter, $15 per seat a month\nGrowth, $32 per seat a month\nEnterprise, $58 per seat a month\n\nPay yearly and you get two months free. Nothing is deleted if you need a few more days; just reply and we will extend the trial.\n\n{{agent.first_name}}\nFieldline',
					},
					{
						number: 1,
						savedAt: '2026-02-11T09:00:00',
						author: 'dawn',
						summary: 'First version',
						subject: 'Your trial is almost over',
						body: 'Hi {{customer.first_name}},\n\nYour Fieldline trial ends on {{trial.end_date}}. Choose a plan in Settings, then Billing, to keep your data.\n\nFieldline Billing',
					},
				],
			},
			{
				id: 'tpl-payment-failed',
				type: 'email',
				category: 'billing',
				status: 'live',
				name: 'Card payment failed',
				persona: 'trent',
				owner: 'dawn',
				perWeek: [9, 7, 11, 8, 10, 6, 9, 12],
				lifetime: 412,
				rate: 0.41,
				trigger: 'Automatically, when a card payment is declined.',
				latest: [
					['Hank Leach', 'Copperfield Pens', '2026-10-01T06:12:00', true],
					['Bea Sawyer', 'Larchwood Ventures', '2026-09-29T06:09:00', true],
				],
				versions: [
					{
						number: 1,
						savedAt: '2026-04-27T11:40:00',
						author: 'dawn',
						summary: 'First version',
						subject: 'We couldn’t take your payment for {{invoice.number}}',
						body: 'Hi {{customer.first_name}},\n\nWe tried to charge the card on file for {{invoice.total}} ({{invoice.number}}) and the bank declined it. Your account stays fully active for now.\n\nYou can update the card here: {{invoice.link}}\n\nWe will try again on {{invoice.due_date}}. If something has changed on your side, reply and our Finance team will sort it out with you.\n\n{{agent.first_name}}\nFieldline Billing',
					},
				],
			},
			{
				id: 'tpl-annual-renewal',
				type: 'email',
				category: 'billing',
				status: 'live',
				name: 'Yearly renewal reminder',
				persona: 'trent',
				owner: 'dawn',
				perWeek: [4, 6, 5, 3, 7, 5, 6, 4],
				lifetime: 188,
				rate: 0.33,
				trigger: 'Automatically, 14 days before a yearly plan renews.',
				latest: [
					['Todd Bishop', 'Oakhaven Studio', '2026-10-01T07:00:00', true],
					['Alice Brennan', 'Tri-County Studios', '2026-09-26T07:00:00', false],
				],
				versions: [
					{
						number: 1,
						savedAt: '2026-06-15T15:20:00',
						author: 'dawn',
						summary: 'First version',
						subject: '{{customer.company}} renews on {{invoice.due_date}}',
						body: 'Hi {{customer.first_name}},\n\nA quick note that your yearly {{plan.name}} plan for {{plan.seats}} seats renews on {{invoice.due_date}}. The total will be {{invoice.total}}, which already includes your two free months.\n\nIf your team has grown or shrunk, reply before then and we will change the seat count.\n\n{{agent.first_name}}',
					},
				],
			},
			{
				id: 'tpl-ticket-solved',
				type: 'email',
				category: 'support',
				status: 'live',
				name: 'Ticket solved: how did we do?',
				persona: 'trent',
				owner: 'elaine',
				perWeek: [118, 124, 131, 109, 127, 135, 129, 140],
				lifetime: 6920,
				rate: 0.37,
				trigger: 'Automatically, when a Support ticket is marked as solved.',
				latest: [
					['Todd Bishop', 'Oakhaven Studio', '2026-10-02T15:58:00', false],
					['Quentin Cook', 'Brightline Photography', '2026-10-02T14:31:00', true],
					['Dana Whitfield', 'Lakeside Apparel & Walks', '2026-10-02T11:06:00', true],
				],
				versions: [
					{
						number: 2,
						savedAt: '2026-08-03T10:00:00',
						author: 'elaine',
						summary: 'Ask for a 1 to 5 score by reply',
						subject: 'Ticket {{ticket.id}} is solved',
						body: 'Hi {{customer.first_name}},\n\nWe have marked ticket {{ticket.id}}, “{{ticket.subject}}”, as solved. If anything still isn’t right, reply to this email and it will open again with the same person.\n\nOne question, if you have a moment: how did we do? Reply with a number from 1 to 5.\n\n{{agent.first_name}}\nFieldline Support',
					},
					{
						number: 1,
						savedAt: '2026-01-20T12:00:00',
						author: 'elaine',
						summary: 'First version',
						subject: 'Your ticket has been solved',
						body: 'Hi {{customer.first_name}},\n\nWe have marked ticket {{ticket.id}} as solved. If anything still isn’t right, reply to this email and it will open again.\n\nFieldline Support',
					},
				],
			},
			{
				id: 'tpl-weekly-summary',
				type: 'email',
				category: 'schedule',
				status: 'live',
				name: 'Weekly schedule summary',
				persona: 'trent',
				owner: 'rory',
				perWeek: [1824, 1838, 1851, 1866, 1874, 1889, 1902, 1913],
				lifetime: 71480,
				rate: 0.02,
				trigger: 'Automatically, every Monday at 7:00 AM in the account’s time zone.',
				latest: [
					['Todd Bishop', 'Oakhaven Studio', '2026-09-28T07:00:00', false],
					['Dana Whitfield', 'Lakeside Apparel & Walks', '2026-09-28T07:00:00', false],
				],
				versions: [
					{
						number: 1,
						savedAt: '2026-05-25T09:10:00',
						author: 'rory',
						summary: 'First version',
						subject: '{{customer.company}}: your week in Fieldline',
						body: 'Hi {{customer.first_name}},\n\nHere is how last week went for {{customer.company}}:\n\nVisits completed: {{report.visits_done}}\nOn-time arrivals: {{report.on_time}}\nCustomer reminders sent: {{report.reminders}}\n\nThe full report is in Fieldline under Reports.\n\nThe Fieldline team',
					},
				],
			},
			{
				id: 'tpl-sms-on-way',
				type: 'sms',
				category: 'schedule',
				status: 'live',
				name: 'Team member on the way',
				persona: 'rachel',
				owner: 'rory',
				perWeek: [9120, 9480, 9310, 9655, 9870, 10140, 9988, 10320],
				lifetime: 486200,
				rate: 0.06,
				trigger: 'Automatically, when a team member taps “On my way” in the app.',
				latest: [
					['Rachel Monroe', 'Northgate Analytics', '2026-10-02T16:12:00', false],
					['Carl Jensen', 'Brightline Photography', '2026-10-02T16:09:00', true],
					['Mae Morrow', 'Lakeside Apparel & Walks', '2026-10-02T16:02:00', false],
				],
				versions: [
					{
						number: 4,
						savedAt: '2026-09-24T10:45:00',
						author: 'rory',
						summary: 'Added the Customer Portal tracking link',
						subject: '',
						body: 'Hi {{customer.first_name}}, {{staff.first_name}} from {{account.name}} is on the way and should arrive around {{visit.time}}. Track the visit: {{account.portal_link}} Reply STOP to opt out.',
					},
					{
						number: 3,
						savedAt: '2026-07-08T14:30:00',
						author: 'rory',
						summary: 'Opt-out wording for the US carriers',
						subject: '',
						body: 'Hi {{customer.first_name}}, {{staff.first_name}} from {{account.name}} is on the way and should arrive around {{visit.time}}. Reply STOP to opt out.',
					},
					{
						number: 2,
						savedAt: '2026-04-02T09:15:00',
						author: 'theo',
						summary: 'Use the business name, not Fieldline',
						subject: '',
						body: 'Hi {{customer.first_name}}, {{staff.first_name}} from {{account.name}} is on their way to you now.',
					},
					{
						number: 1,
						savedAt: '2026-01-12T16:00:00',
						author: 'rory',
						summary: 'First version',
						subject: '',
						body: 'Your Fieldline team member is on their way.',
					},
				],
			},
			{
				id: 'tpl-sms-reminder',
				type: 'sms',
				category: 'schedule',
				status: 'live',
				name: 'Visit reminder, day before',
				persona: 'rachel',
				owner: 'rory',
				perWeek: [7410, 7720, 7650, 7980, 8120, 8310, 8260, 8490],
				lifetime: 352800,
				rate: 0.58,
				trigger: 'Automatically, at 5:00 PM the day before a booked visit.',
				latest: [
					['Rachel Monroe', 'Northgate Analytics', '2026-10-02T17:00:00', null],
					['Lyle Reeves', 'Oakhaven Studio', '2026-10-01T17:00:00', true],
					['Jo Whitaker', 'Cedar Fell Outdoor', '2026-10-01T17:00:00', true],
				],
				versions: [
					{
						number: 2,
						savedAt: '2026-08-12T11:00:00',
						author: 'rory',
						summary: 'Reply C or R instead of a link',
						subject: '',
						body: 'Hi {{customer.first_name}}, this is {{account.name}}. A reminder that your {{visit.service}} is tomorrow, {{visit.date}}, with a {{visit.window}} arrival window. Reply C to confirm or R to reschedule.',
					},
					{
						number: 1,
						savedAt: '2026-02-03T10:20:00',
						author: 'rory',
						summary: 'First version',
						subject: '',
						body: 'Hi {{customer.first_name}}, this is {{account.name}}. A reminder about your {{visit.service}} tomorrow, {{visit.date}}. Manage the visit at {{account.portal_link}}',
					},
				],
			},
			{
				id: 'tpl-sms-late',
				type: 'sms',
				category: 'schedule',
				status: 'live',
				name: 'Running late',
				persona: 'rachel',
				owner: 'elaine',
				perWeek: [612, 655, 590, 702, 688, 720, 676, 745],
				lifetime: 24300,
				rate: 0.21,
				handSends: [
					['rory', 0.15],
					['elaine', 0.1],
				],
				trigger: 'By schedulers, from the visit card, when a visit is going to start late.',
				latest: [
					['Ann Rudd', 'Northgate Analytics', '2026-10-02T13:41:00', true],
					['Peter Shaw', 'Brightline Photography', '2026-10-02T11:20:00', false],
				],
				versions: [
					{
						number: 1,
						savedAt: '2026-03-30T08:50:00',
						author: 'elaine',
						summary: 'First version',
						subject: '',
						body: 'Hi {{customer.first_name}}, sorry, {{staff.first_name}} is running about 30 minutes behind and will now arrive around {{visit.time}}. Reply if that no longer works and we will rebook. {{account.name}}',
					},
				],
			},
			{
				id: 'tpl-sms-visit-done',
				type: 'sms',
				category: 'billing',
				status: 'live',
				name: 'Visit done, invoice link',
				persona: 'rachel',
				owner: 'dawn',
				perWeek: [5980, 6130, 6040, 6320, 6410, 6590, 6520, 6700],
				lifetime: 281400,
				rate: 0.04,
				trigger: 'Automatically, when a team member marks a visit complete and the account bills on the spot.',
				latest: [
					['Greg Holt', 'Northgate Analytics', '2026-10-02T15:51:00', false],
					['Sana Iqbal', 'Lakeside Apparel & Walks', '2026-10-02T15:33:00', false],
				],
				versions: [
					{
						number: 1,
						savedAt: '2026-05-11T12:25:00',
						author: 'dawn',
						summary: 'First version',
						subject: '',
						body: 'Thanks {{customer.first_name}}! Your {{visit.service}} is done. Invoice {{invoice.number}} for {{invoice.total}}: {{invoice.link}} {{account.name}}',
					},
				],
			},
			{
				id: 'tpl-sms-trial-checkin',
				type: 'sms',
				category: 'onboarding',
				status: 'draft',
				name: 'Trial check-in text',
				persona: 'dana',
				owner: 'connie',
				perWeek: [0, 0, 0, 0, 0, 0, 0, 0],
				lifetime: 0,
				rate: null,
				handSends: [],
				trigger: 'By Customer Success, from the account page.',
				latest: [],
				versions: [
					{
						number: 1,
						savedAt: '2026-10-02T10:18:00',
						author: 'connie',
						summary: 'First draft',
						subject: '',
						body: 'Hi {{customer.first_name}}, it’s {{agent.first_name}} at Fieldline. How is the trial going at {{customer.company}}? Reply here if anything is getting in the way 🙂',
					},
				],
			},
			{
				id: 'tpl-sms-deep-clean',
				type: 'sms',
				category: 'schedule',
				status: 'archived',
				name: 'Summer deep clean offer',
				persona: 'rachel',
				owner: 'courtney',
				perWeek: [1210, 860, 0, 0, 0, 0, 0, 0],
				lifetime: 14920,
				rate: 0.12,
				trigger: 'By accounts, as a one-off campaign.',
				latest: [['Rachel Monroe', 'Northgate Analytics', '2026-08-18T10:00:00', true]],
				versions: [
					{
						number: 1,
						savedAt: '2026-06-01T09:00:00',
						author: 'courtney',
						summary: 'First version',
						subject: '',
						body: '{{account.name}}: book your deep clean before Aug 31 and save $25. Reply YES and we will call to set a time. Reply STOP to opt out.',
					},
				],
			},
			{
				id: 'tpl-cr-reset-login',
				type: 'canned',
				category: 'support',
				status: 'live',
				name: 'Reset a staff app sign-in',
				shortcut: 'reset-login',
				persona: 'rachel',
				owner: 'elaine',
				perWeek: [64, 71, 58, 69, 75, 62, 70, 81],
				lifetime: 1830,
				rate: 0.29,
				handSends: [
					['elaine', 0.46],
					['john', 0.22],
					['connie', 0.18],
					['theo', 0.14],
				],
				latest: [
					['Carl Jensen', 'Brightline Photography', '2026-10-02T12:40:00', true],
					['Rachel Monroe', 'Northgate Analytics', '2026-10-01T16:05:00', false],
				],
				versions: [
					{
						number: 1,
						savedAt: '2026-02-24T15:00:00',
						author: 'elaine',
						summary: 'First version',
						subject: '',
						body: 'Hi {{customer.first_name}},\n\nYou can reset this from the web app: go to Settings, then Team, pick the team member and choose “Send new sign-in link”. The link works for 24 hours and signs them out of any old phones.\n\nIf they still can’t get in, send me their email address and I’ll check the account from our side.\n\n{{agent.first_name}}',
					},
				],
			},
			{
				id: 'tpl-cr-travel',
				type: 'canned',
				category: 'support',
				status: 'live',
				name: 'Travel Planner explained',
				shortcut: 'travel',
				persona: 'trent',
				owner: 'theo',
				perWeek: [41, 38, 46, 44, 52, 49, 55, 58],
				lifetime: 960,
				rate: 0.52,
				handSends: [
					['theo', 0.41],
					['elaine', 0.33],
					['connie', 0.26],
				],
				latest: [
					['Todd Bishop', 'Oakhaven Studio', '2026-10-02T10:22:00', true],
					['Hank Leach', 'Copperfield Pens', '2026-09-30T14:18:00', true],
				],
				versions: [
					{
						number: 1,
						savedAt: '2026-03-09T11:30:00',
						author: 'theo',
						summary: 'First version',
						subject: '',
						body: 'Travel Planner plans each team member’s day in the shortest travel order, and plans it again when a visit runs over. It is an add-on to any plan, and you can try it free for 14 days from Settings, then Add-ons.\n\nWould you like me to switch the trial on for {{customer.company}} now?',
					},
				],
			},
			{
				id: 'tpl-cr-refund',
				type: 'canned',
				category: 'billing',
				status: 'live',
				name: 'Credit for extra seats',
				shortcut: 'refund',
				persona: 'dana',
				owner: 'dawn',
				perWeek: [12, 9, 14, 11, 10, 13, 12, 15],
				lifetime: 377,
				rate: 0.35,
				handSends: [
					['dawn', 0.58],
					['elaine', 0.42],
				],
				latest: [['Bea Sawyer', 'Larchwood Ventures', '2026-10-01T11:50:00', true]],
				versions: [
					{
						number: 1,
						savedAt: '2026-04-14T10:05:00',
						author: 'dawn',
						summary: 'First version',
						subject: '',
						body: 'Hi {{customer.first_name}},\n\nI have checked {{invoice.number}}. Because the extra seats were added by mistake and never used, I’ve given you a credit of {{invoice.total}}. It will show on your next invoice.\n\nIf you would rather have the money back on your card, just say and I’ll arrange it. That takes 5 to 10 working days.\n\n{{agent.first_name}}',
					},
				],
			},
			{
				id: 'tpl-cr-escalate',
				type: 'canned',
				category: 'support',
				status: 'live',
				name: 'Passed to Engineering',
				shortcut: 'escalate',
				persona: 'trent',
				owner: 'elaine',
				perWeek: [22, 19, 27, 24, 21, 26, 30, 28],
				lifetime: 702,
				rate: 0.44,
				handSends: [
					['elaine', 0.64],
					['john', 0.2],
					['connie', 0.16],
				],
				latest: [
					['Todd Bishop', 'Oakhaven Studio', '2026-10-02T09:37:00', true],
					['Kirk Mathis', 'Ironwood Studios', '2026-10-01T13:12:00', false],
				],
				versions: [
					{
						number: 1,
						savedAt: '2026-02-24T15:20:00',
						author: 'elaine',
						summary: 'First version',
						subject: '',
						body: 'Thanks for the detail, {{customer.first_name}}. I’ve passed ticket {{ticket.id}} to our Engineering team with your screenshots. I’ll update you by the end of the day tomorrow, sooner if they find the cause.\n\n{{agent.first_name}}',
					},
				],
			},
			{
				id: 'tpl-cr-yearly',
				type: 'canned',
				category: 'billing',
				status: 'live',
				name: 'Switching to yearly billing',
				shortcut: 'yearly',
				persona: 'trent',
				owner: 'theo',
				perWeek: [16, 18, 15, 21, 19, 24, 22, 26],
				lifetime: 455,
				rate: 0.61,
				handSends: [
					['theo', 0.52],
					['dawn', 0.31],
					['connie', 0.17],
				],
				latest: [
					['Alice Brennan', 'Tri-County Studios', '2026-10-02T14:05:00', true],
					['Gerald Price', 'Moorings Point Apparel', '2026-09-30T10:44:00', true],
				],
				versions: [
					{
						number: 1,
						savedAt: '2026-06-22T09:30:00',
						author: 'theo',
						summary: 'First version',
						subject: '',
						body: 'Good news: moving {{customer.company}} to yearly billing gives you two months free. On {{plan.name}} with {{plan.seats}} seats, that brings the year to {{invoice.total}}. I can make the change today, and the new price starts at your next renewal. Shall I go ahead?',
					},
				],
			},
			{
				id: 'tpl-cr-sms-credits',
				type: 'canned',
				category: 'billing',
				status: 'draft',
				name: 'Buying more SMS credits',
				shortcut: 'sms-credits',
				persona: 'dana',
				owner: 'dawn',
				perWeek: [0, 0, 0, 0, 0, 0, 0, 0],
				lifetime: 0,
				rate: null,
				handSends: [],
				latest: [],
				versions: [
					{
						number: 1,
						savedAt: '2026-09-30T16:40:00',
						author: 'dawn',
						summary: 'First draft',
						subject: '',
						body: 'SMS credits come in packs from Settings, then Billing, then SMS credits. {{customer.company}} has {{sms.credits_left}} left right now. Credits never run out of date, and you can turn on automatic top-ups so reminders never stop.',
					},
				],
			},
			{
				id: 'tpl-n-visit-assigned',
				type: 'notification',
				category: 'schedule',
				status: 'live',
				name: 'New visit assigned',
				persona: 'dana',
				owner: 'rory',
				perWeek: [14820, 15140, 15030, 15460, 15610, 15930, 15770, 16180],
				lifetime: 742600,
				rate: 0.71,
				trigger: 'Automatically, to the team member, when a scheduler assigns them a visit.',
				latest: [
					['Andre Parsons', 'Lakeside Apparel & Walks', '2026-10-02T16:15:00', true],
					['Lance Rhodes', 'Northgate Analytics', '2026-10-02T16:11:00', true],
				],
				versions: [
					{
						number: 1,
						savedAt: '2026-01-12T16:30:00',
						author: 'rory',
						summary: 'First version',
						subject: 'New visit: {{visit.service}}',
						body: '{{visit.date}} at {{visit.time}}, {{visit.address}}. Tap to see the details and directions.',
					},
				],
			},
			{
				id: 'tpl-n-rescheduled',
				type: 'notification',
				category: 'schedule',
				status: 'live',
				name: 'Visit moved to a new time',
				persona: 'rachel',
				owner: 'rory',
				perWeek: [2210, 2290, 2240, 2380, 2350, 2460, 2410, 2520],
				lifetime: 108300,
				rate: 0.64,
				trigger: 'Automatically, to the team member, when a visit they have is rescheduled.',
				latest: [
					['Lance Rhodes', 'Northgate Analytics', '2026-10-02T14:52:00', true],
					['Kiara Ellery', 'Oakhaven Studio', '2026-10-02T13:30:00', false],
				],
				versions: [
					{
						number: 1,
						savedAt: '2026-01-12T16:40:00',
						author: 'rory',
						summary: 'First version',
						subject: '{{visit.ref}} moved to {{visit.date}}',
						body: '{{customer.first_name}} {{customer.last_name}} asked to reschedule. The new arrival time is {{visit.time}}.',
					},
				],
			},
			{
				id: 'tpl-n-sms-low',
				type: 'notification',
				category: 'billing',
				status: 'live',
				name: 'SMS credits running low',
				persona: 'dana',
				owner: 'dawn',
				perWeek: [88, 94, 81, 97, 102, 91, 99, 108],
				lifetime: 3920,
				rate: 0.38,
				trigger: 'Automatically, to account admins, when fewer than 200 SMS credits are left.',
				latest: [['Dana Whitfield', 'Lakeside Apparel & Walks', '2026-10-02T08:30:00', true]],
				versions: [
					{
						number: 1,
						savedAt: '2026-03-02T09:00:00',
						author: 'dawn',
						summary: 'First version',
						subject: 'SMS credits running low',
						body: '{{account.name}} has {{sms.credits_left}} SMS credits left. Top up so customer reminders keep going out.',
					},
				],
			},
			{
				id: 'tpl-n-seats-full',
				type: 'notification',
				category: 'billing',
				status: 'live',
				name: 'All seats in use',
				persona: 'dana',
				owner: 'theo',
				perWeek: [61, 58, 66, 72, 69, 75, 71, 79],
				lifetime: 2140,
				rate: 0.27,
				trigger: 'Automatically, to account admins, when someone is invited and every seat is taken.',
				latest: [['Quentin Cook', 'Brightline Photography', '2026-10-01T10:20:00', true]],
				versions: [
					{
						number: 1,
						savedAt: '2026-03-02T09:20:00',
						author: 'theo',
						summary: 'First version',
						subject: 'All {{plan.seats}} seats are in use',
						body: 'Add a seat to invite another team member to the mobile app. Each extra seat on {{plan.name}} is billed from today.',
					},
				],
			},
			{
				id: 'tpl-welcome-2025',
				type: 'email',
				category: 'onboarding',
				status: 'archived',
				name: 'Welcome email (2025)',
				persona: 'dana',
				owner: 'courtney',
				perWeek: [0, 0, 0, 0, 0, 0, 0, 0],
				lifetime: 9840,
				rate: 0.11,
				trigger: 'Replaced by “Welcome to Fieldline” in March.',
				latest: [],
				versions: [
					{
						number: 1,
						savedAt: '2025-02-10T10:00:00',
						author: 'courtney',
						summary: 'First version',
						subject: 'Welcome aboard',
						body: 'Hi {{customer.first_name}},\n\nYour Fieldline account is ready. Log in at any time to start scheduling.\n\nThe Fieldline team',
					},
				],
			},
		],
		openElsewhere: { 'tpl-sms-on-way': 'rory', 'tpl-trial-ending': 'dawn' },
	};

	/* Demo switches, not product behavior: ?state=empty starts with no
     templates, ?state=error fails the first load (Try again recovers) and
     ?state=offline fails every write so the rollbacks show. */
	const scenario = new URLSearchParams(location.search).get('state') || '';

	/* The demo's clock starts at SEED.today and moves with real time from the
     moment the page loads, so a fresh save reads "just now". */
	const bootedAt = Date.now();

	const ROWS_PER_PAGE = 10;
	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const MERGE_FIELD = /\{\{\s*([a-zA-Z_.]+)\s*\}\}/g;
	const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	/* A text that stays inside GSM-7 gets 160 characters, or 153 a part once
     it splits, and the signs in GSM_DOUBLE count twice. One character from
     outside (an emoji, most accents) turns the whole text into Unicode,
     where the numbers drop to 70 and 67. */
	const GSM_SINGLE =
		'@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
	const GSM_DOUBLE = '^{}\\[~]|€';

	const STATUS_CHOICES = [
		{ value: 'active', label: 'Live and drafts' },
		{ value: 'live', label: 'Live' },
		{ value: 'draft', label: 'Drafts' },
		{ value: 'archived', label: 'Archived' },
		{ value: 'everything', label: 'Everything' },
	];
	const STATUS_TESTS = {
		active: (status) => status !== 'archived',
		live: (status) => status === 'live',
		draft: (status) => status === 'draft',
		archived: (status) => status === 'archived',
	};
	const ORDERINGS = {
		used: (a, b) => recentSends(b) - recentSends(a) || a.name.localeCompare(b.name),
		updated: (a, b) => liveVersion(b).savedAt.localeCompare(liveVersion(a).savedAt),
		reply: (a, b) => (b.rate ?? -1) - (a.rate ?? -1),
		name: (a, b) => a.name.localeCompare(b.name),
	};

	/* How the editor dresses itself for each kind of template. */
	const KIND_FORM = {
		email: { hasSubject: true, subjectLabel: 'Subject', bodyLabel: 'Message', rows: 10 },
		sms: { hasSubject: false, subjectLabel: 'Subject', bodyLabel: 'Text', rows: 4 },
		canned: { hasSubject: false, subjectLabel: 'Subject', bodyLabel: 'Message', rows: 10 },
		notification: { hasSubject: true, subjectLabel: 'Title', bodyLabel: 'Notification text', rows: 4 },
	};
	const PREVIEWS = { email: mailPreview, sms: textPreview, canned: replyPreview };
	const STARTER_BODIES = {
		email: 'Hi {{customer.first_name}},\n\n\n\n{{agent.first_name}}',
		sms: 'Hi {{customer.first_name}}, ',
		canned: 'Hi {{customer.first_name}},\n\n\n\n{{agent.first_name}}',
		notification: '',
	};

	/* Where a test send goes depends on the kind: a phone number for texts,
     a teammate's device for notifications, an inbox for everything else. */
	const RECIPIENTS = {
		phone: {
			label: 'Send to this phone',
			help: 'A teammate, or any mobile number.',
			error: 'Enter a phone number, or pick a teammate.',
			contact: (member) => member.phone,
			accepts: (value) => value.replace(/\D/g, '').length >= 10,
			arrival: (to) => `It should reach ${to} within a minute.`,
		},
		device: {
			label: 'Send to this person’s phone',
			help: 'They get it as a notification in the Fieldline app.',
			error: 'Pick a teammate.',
			contact: (member) => member.name,
			accepts: (value) => model.team.some((member) => member.name === value),
			arrival: (to) => `${to} gets it as a notification now.`,
		},
		email: {
			label: 'Send to',
			help: 'A teammate, or any email address.',
			error: 'Enter an email address, or pick a teammate.',
			contact: (member) => member.email,
			accepts: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
			arrival: (to) => `Look for “[Test]” in ${to}’s inbox in a minute.`,
		},
	};

	const NEW_BUTTON =
		'<button type="button" class="btn btn-sm btn-primary" data-mt-new><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>New template</button>';
	const UNSAVED_FLAG = '<span class="mt-unsaved"><i class="bi bi-pencil-fill" aria-hidden="true"></i>Unsaved</span>';

	const narrow = window.matchMedia('(max-width: 767.98px)');
	const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

	const model = {
		ready: false,
		signedIn: '',
		team: [],
		kinds: [],
		categories: [],
		fieldGroups: [],
		personas: [],
		fromLines: {},
		templates: [],
		openElsewhere: {},
		unsaved: new Map(),
		activeId: null,
		personaId: null,
		filter: { text: '', kind: 'all', category: 'all', status: 'active' },
		order: 'used',
		page: 1,
		readingOnPhone: false,
		pickedVersion: null,
		focusedField: null,
	};

	/* Merge field names the picker knows, filled once the data arrives. */
	let knownFields = new Set();
	/* Set while the picker is open because someone typed {{ in a field. */
	let braceOrigin = null;
	let dialogKind = 'email';
	let loadTries = 0;
	let countTimer = 0;

	const ui = gatherElements();

	/* Each method stands for one request and answers with a Promise. The demo
     replies from memory after a short pause; swap the bodies for fetch()
     calls and keep what they resolve with. */
	const server = {
		/* GET /api/templates, answering with the whole SEED shape. */
		load() {
			loadTries += 1;
			return pause(450).then(() => {
				if (scenario === 'error' && loadTries === 1) throw new Error('The server did not answer');
				const payload = copyOf(SEED);
				if (scenario === 'empty') payload.templates = [];
				return payload;
			});
		},
		/* POST /api/templates with { type, category, name, subject, body }. */
		create(template) {
			return commit(copyOf(template));
		},
		/* POST /api/templates/:id/versions with the version plus name, category, shortcut and status. */
		addVersion(id, version, details) {
			return commit({ id, version: copyOf(version), details: copyOf(details) }, 650);
		},
		/* PATCH /api/templates/:id with only the details that changed. */
		patch(id, changes) {
			return commit({ id, changes: copyOf(changes) }, 650);
		},
		/* POST /api/templates/:id/duplicate, answering with the copy. */
		duplicate(id, copy) {
			return commit(copyOf(copy));
		},
		/* POST /api/templates/:id/archive and /restore. */
		archive(id) {
			return commit(id);
		},
		unarchive(id) {
			return commit(id);
		},
		/* DELETE /api/templates/:id */
		remove(id) {
			return commit(id);
		},
		/* POST /api/templates/:id/test with { to, sample, subject, body }. */
		test(id, request) {
			return commit({ id, to: request.to }, 900);
		},
	};

	/** Wires every control on the page, then asks for the data. */
	function start() {
		wireLibrary();
		wireEditor();
		wireDrawerAndDialogs();
		narrow.addEventListener('change', () => {
			if (!narrow.matches) model.readingOnPhone = false;
			ui.app.classList.toggle('is-reading', model.readingOnPhone);
		});
		document.addEventListener('keydown', onShortcut);
		fetchAll();
	}

	/* Loading */

	function fetchAll() {
		showSkeletons();
		return server
			.load()
			.then(adopt)
			.catch(() => showLoadFailure());
	}

	/** Takes the server's answer into the model and draws the first screen. */
	function adopt(payload) {
		model.signedIn = payload.signedIn;
		model.team = payload.team;
		model.kinds = payload.kinds;
		model.categories = payload.categories;
		model.fieldGroups = payload.fieldGroups;
		model.personas = payload.personas;
		model.fromLines = payload.fromLines;
		model.templates = payload.templates;
		model.openElsewhere = payload.openElsewhere || {};
		model.ready = true;
		knownFields = new Set(model.fieldGroups.flatMap((group) => group.entries.map(([key]) => key)));

		ui.skeleton.hidden = true;
		ui.loadingText.hidden = true;
		ui.app.classList.remove('is-reading');
		drawSelectFilters();
		setOptions(ui.persona, personaOptions(), model.personas[0]?.id ?? '');
		buildFieldPicker();

		const first = shownTemplates()[0];
		model.activeId = first ? first.id : null;
		if (first) model.personaId = first.persona;
		redraw();
		announce(`${counted(model.templates.length, 'template')} loaded`);
	}

	function showSkeletons() {
		ui.count.textContent = 'Loading';
		ui.skeleton.hidden = false;
		ui.loadingText.hidden = false;
		ui.rows.hidden = true;
		ui.listNote.hidden = true;
		ui.sheet.hidden = true;
		ui.detailState.hidden = true;
		ui.detailSkeleton.hidden = false;
		ui.detail.setAttribute('aria-busy', 'true');
	}

	function showLoadFailure() {
		ui.count.textContent = 'Not loaded';
		ui.skeleton.hidden = true;
		ui.loadingText.hidden = true;
		ui.listNote.hidden = true;
		ui.detailSkeleton.hidden = true;
		ui.detail.setAttribute('aria-busy', 'false');
		ui.detailState.hidden = false;
		ui.detailState.innerHTML = blankNote({
			tone: 'danger',
			icon: 'bi-wifi-off',
			title: 'The templates didn’t load',
			text: 'The connection dropped before they arrived. Nothing you saved has been lost.',
			actions:
				'<button type="button" class="btn btn-sm btn-primary btn-loading btn-loading-swap" data-mt-retry><span class="btn-loading-icon" aria-hidden="true"><i class="bi bi-arrow-clockwise"></i></span><span class="btn-loading-label">Try again</span></button>',
		});
		ui.app.classList.add('is-reading');
		announce('The templates did not load.');
	}

	/* Event wiring */

	function wireLibrary() {
		shell.addEventListener('click', onShellClick);

		ui.search.addEventListener('input', () => {
			model.filter.text = ui.search.value.trim();
			model.page = 1;
			drawLibrary();
		});
		ui.search.addEventListener('keydown', onSearchKey);
		ui.search.addEventListener('input', () => {
			clearTimeout(countTimer);
			countTimer = setTimeout(() => announce(ui.count.textContent.trim()), 600);
		});

		ui.sort.addEventListener('change', () => {
			model.order = ui.sort.value;
			model.page = 1;
			drawLibrary();
		});
		for (const [select, key] of [
			[ui.kindFilter, 'kind'],
			[ui.categoryFilter, 'category'],
			[ui.statusFilter, 'status'],
		]) {
			select.addEventListener('change', () => {
				model.filter[key] = select.value;
				model.page = 1;
				if (key === 'status') drawKindFilter();
				drawLibrary();
				announce(ui.count.textContent.trim());
			});
		}

		/* Up and down arrows walk the rows of the library. */
		ui.rows.addEventListener('keydown', (event) => {
			if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
			const buttons = Array.from(pickAll('[data-mt-open]', ui.rows));
			const position = buttons.indexOf(document.activeElement);
			if (position < 0) return;
			event.preventDefault();
			buttons[position + (event.key === 'ArrowDown' ? 1 : -1)]?.focus();
		});
	}

	function wireEditor() {
		ui.form.addEventListener('input', handleEdit);
		ui.form.addEventListener('change', (event) => {
			if (event.target === ui.category || event.target === ui.live) handleEdit();
		});
		ui.form.addEventListener('submit', (event) => {
			event.preventDefault();
			saveDraft();
		});

		for (const field of pickAll('[data-mt-insertable]', shell)) {
			field.addEventListener('focus', () => {
				model.focusedField = field;
			});
			field.addEventListener('input', (event) => watchForBraces(field, event));
		}

		ui.insertMenu.addEventListener('basalt:command', (event) => placeField(event.detail.value));
		ui.insertButton.addEventListener('hidden.bs.dropdown', () => {
			if (!braceOrigin) return;
			const { field, start: braceAt } = braceOrigin;
			braceOrigin = null;
			setTimeout(() => {
				field.focus();
				field.setSelectionRange(braceAt + 2, braceAt + 2);
			}, 0);
		});

		ui.persona.addEventListener('change', () => {
			model.personaId = ui.persona.value;
			drawDraftState();
			announce(`Preview filled in for ${personaById(model.personaId).name}`);
		});
	}

	function wireDrawerAndDialogs() {
		ui.versionList.addEventListener('click', (event) => {
			const choice = event.target.closest('[data-mt-version]');
			if (!choice) return;
			model.pickedVersion = Number(choice.getAttribute('data-mt-version'));
			drawHistory();
			pick(`[data-mt-version="${model.pickedVersion}"]`, ui.versionList)?.focus();
		});
		ui.versionRestore.addEventListener('click', bringBackVersion);

		ui.newKinds.addEventListener('change', (event) => {
			if (event.target.name !== 'mtNewType') return;
			dialogKind = event.target.value;
			fillStartingPoints();
		});
		ui.newForm.addEventListener('submit', (event) => {
			event.preventDefault();
			createDraft();
		});
		ui.newModal.addEventListener('shown.bs.modal', () => ui.newName.focus());

		ui.testForm.addEventListener('submit', (event) => {
			event.preventDefault();
			if (ui.testSend.getAttribute('aria-busy') !== 'true') sendTest();
		});
		ui.testPersona.addEventListener('change', drawTestPeek);
		ui.testTo.addEventListener('input', () => {
			if (ui.testTo.classList.contains('is-invalid')) ui.testTo.classList.remove('is-invalid');
		});
		ui.testModal.addEventListener('shown.bs.modal', () => {
			ui.testTo.focus();
			ui.testTo.select();
		});

		ui.deleteHold.addEventListener('basalt:confirm', deleteOpen);
	}

	/* One delegated handler for every button inside the page. The first
     selector that matches wins, in this order. */
	function onShellClick(event) {
		for (const [selector, act] of CLICK_ROUTES) {
			const hit = event.target.closest(selector);
			if (hit) {
				act(hit);
				return;
			}
		}
	}

	const CLICK_ROUTES = [
		['[data-mt-open]', (button) => openById(button.getAttribute('data-mt-open'))],
		['[data-mt-new]', () => startNewDialog()],
		['[data-mt-keys-open]', () => dialogFor(ui.keysModal).show()],
		['[data-mt-clear]', () => clearFilters()],
		['[data-mt-page]', (button) => turnPage(button)],
		['[data-mt-back]', () => backToList()],
		['[data-mt-history-open]', () => showHistory()],
		['[data-mt-test-open]', () => openTestDialog()],
		['[data-mt-duplicate]', () => duplicateOpen()],
		['[data-mt-copy-id]', () => copyTemplateId()],
		['[data-mt-archive]', () => archiveOpen()],
		['[data-mt-restore]', () => unarchiveOpen()],
		['[data-mt-delete-open]', () => askRemove()],
		['[data-mt-discard]', () => throwAway()],
		[
			'[data-mt-retry]',
			(button) => {
				buttonState(button, 'loading');
				fetchAll();
			},
		],
	];

	function onSearchKey(event) {
		if (event.key === 'Escape' && ui.search.value) {
			event.preventDefault();
			ui.search.value = '';
			model.filter.text = '';
			drawLibrary();
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			pick('[data-mt-open]', ui.rows)?.focus();
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			const top = shownTemplates()[0];
			if (top) openById(top.id, { focusRow: true, speak: true });
		}
	}

	/* Single-key shortcuts work while nothing is being typed and no dialog,
     drawer or menu is open; Ctrl or Cmd+S saves from anywhere. */
	function onShortcut(event) {
		if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') {
			if (!model.ready || ui.sheet.hidden) return;
			event.preventDefault();
			saveDraft();
			return;
		}
		if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
		if (pick('.modal.show, .offcanvas.show, .dropdown-menu.show')) return;
		if (isTyping(event.target) || !model.ready) return;
		const act =
			PAGE_KEYS[event.key] ||
			(event.key === 'Escape' && model.readingOnPhone ? backToList : null) ||
			(ui.sheet.hidden ? null : SHEET_KEYS[event.key]);
		if (!act) return;
		event.preventDefault();
		act();
	}

	const PAGE_KEYS = {
		j: () => step(1),
		k: () => step(-1),
		'/': () => {
			if (narrow.matches) backToList();
			ui.search.focus();
			ui.search.select();
		},
		c: () => startNewDialog(),
		'?': () => dialogFor(ui.keysModal).show(),
	};

	const SHEET_KEYS = {
		i: () => showFieldPicker(false),
		t: () => openTestDialog(),
		h: () => showHistory(),
		d: () => duplicateOpen(),
		e: () => archiveOpen(),
		u: () => {
			const tab = ui.usageTab.classList.contains('active') ? ui.writeTab : ui.usageTab;
			bootstrap.Tab.getOrCreateInstance(tab).show();
			tab.focus();
		},
	};

	function isTyping(target) {
		return Boolean(target && target.closest('input, textarea, select, [contenteditable="true"]'));
	}

	/* Drawing the page */

	function redraw() {
		if (!model.ready) return;
		drawFigures();
		drawKindFilter();
		drawLibrary();
		drawDetail();
		ui.app.classList.toggle('is-reading', model.readingOnPhone);
	}

	/* The three numbers over the page: live templates, sends in the last four
     weeks, and the reply rate weighted by sends (notifications left out). */
	function drawFigures() {
		const all = model.templates;
		const answerable = all.filter((t) => t.type !== 'notification' && t.rate != null && t.status !== 'archived');
		const sends = sum(answerable.map(recentSends));
		const replies = sum(answerable.map((t) => recentSends(t) * t.rate));
		const figures = {
			live: all.filter((t) => t.status === 'live').length,
			sent: figure(sum(all.map(recentSends))),
			reply: sends ? percent(replies / sends) : '0%',
		};
		for (const [key, value] of Object.entries(figures)) {
			const slot = pick(`[data-mt-fig="${key}"]`, shell);
			if (slot) slot.textContent = value;
		}
	}

	function drawSelectFilters() {
		setOptions(
			ui.categoryFilter,
			[{ value: 'all', label: 'All categories' }, ...categoryOptions()],
			model.filter.category,
		);
		setOptions(ui.statusFilter, STATUS_CHOICES, model.filter.status);
	}

	/* The type filter counts what the status filter lets through. */
	function drawKindFilter() {
		const pool =
			model.filter.status === 'active' ? model.templates.filter((t) => t.status !== 'archived') : model.templates;
		const options = [{ value: 'all', label: 'All types', hint: String(pool.length) }];
		for (const kind of model.kinds) {
			options.push({
				value: kind.id,
				label: kind.pluralName,
				hint: String(pool.filter((t) => t.type === kind.id).length),
			});
		}
		setOptions(ui.kindFilter, options, model.filter.kind);
	}

	/** Draws the visible page of the library, moving focus to a row if asked. */
	function drawLibrary(focusId = null) {
		const matching = shownTemplates();
		const total = model.templates.length;
		const pageCount = Math.max(1, Math.ceil(matching.length / ROWS_PER_PAGE));
		model.page = Math.min(Math.max(1, model.page), pageCount);
		const offset = (model.page - 1) * ROWS_PER_PAGE;
		const pageRows = matching.slice(offset, offset + ROWS_PER_PAGE);

		if (!total) ui.count.textContent = 'No templates yet';
		else
			ui.count.textContent = filtering()
				? `${matching.length} of ${counted(total, 'template')} match`
				: counted(matching.length, 'template');
		ui.rows.innerHTML = pageRows.map(rowMarkup).join('');

		const note = libraryNote(total, matching.length);
		ui.listNote.innerHTML = note;
		ui.listNote.hidden = !note;
		ui.rows.hidden = pageRows.length === 0;

		ui.pager.hidden = matching.length <= ROWS_PER_PAGE;
		ui.pagePosition.textContent = `${offset + 1}–${offset + pageRows.length} of ${matching.length}`;
		pick('[data-mt-page="prev"]', ui.pager).disabled = model.page <= 1;
		pick('[data-mt-page="next"]', ui.pager).disabled = model.page >= pageCount;

		if (focusId) pick(`[data-mt-open="${focusId}"]`, ui.rows)?.focus();
	}

	function rowMarkup(template) {
		const kind = kindById(template.type);
		const draft = editorCopy(template);
		const opened = template.id === model.activeId;
		const rateNote =
			template.rate == null
				? ''
				: `<span class="mt-item-stat">${percent(template.rate)} ${template.type === 'notification' ? 'opened' : 'replies'}</span>`;
		const meta = [
			categoryBadge(categoryById(template.category)),
			statusTag(template),
			model.unsaved.has(template.id) ? UNSAVED_FLAG : '',
			template.shortcut ? `<span class="mt-item-stat">/${htmlSafe(template.shortcut)}</span>` : '',
			`<span class="mt-item-stat">${figure(recentSends(template))} sent</span>`,
			rateNote,
		];
		return [
			`<li class="mt-items-row"><button type="button" class="mt-item${opened ? ' is-open' : ''}" data-mt-open="${template.id}"${opened ? ' aria-current="true"' : ''}>`,
			`<span class="mt-type-tile mt-type-tile-${template.type}" aria-hidden="true"><i class="bi ${kind.icon}"></i></span>`,
			'<span class="mt-item-main">',
			`<span class="mt-item-top"><span class="mt-item-name">${htmlSafe(draft.name || template.name)}</span><span class="mt-item-when">${terse(liveVersion(template).savedAt)}</span></span>`,
			`<span class="mt-item-snippet">${htmlSafe(excerpt(template))}</span>`,
			`<span class="mt-item-meta">${meta.join('')}</span>`,
			`<span class="visually-hidden">, ${htmlSafe(kind.name)}</span>`,
			'</span></button></li>',
		].join('');
	}

	/* Under the list: an invitation when there is nothing at all, a way out
     when the filters hide everything, and nothing otherwise. */
	function libraryNote(total, shown) {
		if (!total) {
			return blankNote({
				icon: 'bi-chat-square-quote',
				title: 'No templates yet',
				text: 'Save the emails, texts and replies your team sends again and again, with merge fields for the parts that change.',
				actions: NEW_BUTTON,
			});
		}
		if (shown) return '';
		const query = model.filter.text;
		return blankNote({
			icon: 'bi-search',
			title: 'No templates match',
			text: query
				? `Nothing matches “${htmlSafe(query)}” with the filters you have on.`
				: 'No template matches the filters you have on.',
			actions:
				'<button type="button" class="btn btn-sm btn-outline-secondary" data-mt-clear>Clear filters</button>',
		});
	}

	function blankNote({ icon, title, text, actions = '', tone = '' }) {
		const toneClass = tone ? ` basalt-empty-${tone}` : '';
		const actionRow = actions ? `<div class="basalt-empty-actions">${actions}</div>` : '';
		return `<div class="basalt-empty basalt-empty-compact mt-empty${toneClass}"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi ${icon}"></i></span><h3 class="basalt-empty-title">${title}</h3><p class="basalt-empty-text">${text}</p>${actionRow}</div>`;
	}

	function statusTag(template) {
		if (template.status === 'live') return '';
		return template.status === 'draft'
			? '<span class="basalt-count-pill basalt-count-pill-warning">Draft</span>'
			: '<span class="basalt-count-pill mt-pill-muted">Archived</span>';
	}

	function categoryBadge(category) {
		return `<span class="badge basalt-badge-as-dot basalt-badge-tone-${category.hue} mt-cat">${htmlSafe(category.name)}</span>`;
	}

	function excerpt(template) {
		const { subject, body } = editorCopy(template);
		return `${subject ? `${subject} · ` : ''}${body}`.replace(/\s+/g, ' ').slice(0, 140);
	}

	/* The open template */

	function drawDetail() {
		const template = activeTemplate();
		ui.detail.setAttribute('aria-busy', 'false');
		ui.detailSkeleton.hidden = true;
		ui.sheet.hidden = !template;
		ui.detailState.hidden = Boolean(template);
		if (!template) {
			ui.detailState.innerHTML = model.templates.length
				? blankNote({
						icon: 'bi-hand-index',
						title: 'Pick a template',
						text: 'Choose one from the library to edit it, preview it with sample data and see how it is doing.',
					})
				: startPanel();
			return;
		}

		const kind = kindById(template.type);
		const draft = editorCopy(template);
		const archived = template.status === 'archived';
		drawHeading(template, kind, draft);

		ui.archiveLabel.textContent = archived ? 'Restore' : 'Archive';
		ui.deleteRow.hidden = !archived;
		ui.archivedNote.hidden = !archived;

		const form = KIND_FORM[template.type];
		ui.shortcutField.hidden = template.type !== 'canned';
		ui.triggerField.hidden = !template.trigger;
		ui.trigger.textContent = template.trigger || '';
		ui.subjectField.hidden = !form.hasSubject;
		ui.subjectLabel.textContent = form.subjectLabel;
		ui.bodyLabel.textContent = form.bodyLabel;
		ui.body.rows = form.rows;
		ui.liveHelp.textContent = `The team can pick it in ${kind.pickedIn}${template.trigger ? ', and it sends on its own as described above.' : '.'}`;
		ui.live.closest('.mt-live').hidden = archived;

		fillForm(draft);
		if (!model.personaId || !model.personas.some((p) => p.id === model.personaId)) {
			model.personaId = template.persona || model.personas[0]?.id;
		}
		pickValue(ui.persona, model.personaId);
		drawDraftState();
		drawUsage(template);
		enhance(ui.sheet);
	}

	/* The first screen of an empty library explains what a template is. */
	function startPanel() {
		return [
			'<div class="basalt-empty basalt-empty-framed mt-start">',
			'<span class="basalt-empty-badge" aria-hidden="true"><i class="bi bi-braces"></i></span>',
			'<h3 class="basalt-empty-title">Write it once, send it many times</h3>',
			'<p class="basalt-empty-text">A template keeps one message with merge fields such as <code>{{customer.first_name}}</code> and <code>{{visit.time}}</code>. Mail, Support, Chat and SMS fill them in when it is sent.</p>',
			`<div class="basalt-empty-actions">${NEW_BUTTON}</div>`,
			'</div>',
		].join('');
	}

	function drawHeading(template, kind, draft) {
		const version = liveVersion(template);
		const owner = memberById(template.owner);
		ui.sheetIcon.className = `mt-type-tile mt-type-tile-lg mt-type-tile-${template.type}`;
		ui.sheetIcon.innerHTML = `<i class="bi ${kind.icon}"></i>`;
		ui.sheetTitle.textContent = draft.name || 'Untitled template';
		const saved = `v${version.number} saved by ${htmlSafe(shortName(memberById(version.author)))}, ${htmlSafe(relative(version.savedAt))}`;
		const parts = [
			htmlSafe(kind.name),
			`${categoryBadge(categoryById(draft.category))} ${statusTag(template)}`.trim(),
			saved,
			owner ? `owned by ${htmlSafe(owner.name)}` : '',
		];
		ui.sheetMeta.innerHTML = parts
			.filter(Boolean)
			.map((part) => `<span class="mt-tpl-meta-part">${part}</span>`)
			.join('');
		ui.versionBadge.textContent = `v${version.number}`;

		const viewer = memberById(model.openElsewhere[template.id]);
		ui.presence.hidden = !viewer;
		ui.presence.innerHTML = viewer
			? [
					`<span class="basalt-avatar-status" data-bs-toggle="tooltip" data-bs-title="${htmlSafe(viewer.name)} has this open too">`,
					`<span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(viewer.name)}" aria-hidden="true"></span>`,
					'<span class="basalt-avatar-status-dot basalt-avatar-status-dot-online"></span></span>',
					`<span class="visually-hidden">${htmlSafe(viewer.name)} has this template open too</span>`,
				].join('')
			: '';
	}

	function fillForm(draft) {
		ui.name.value = draft.name;
		ui.name.classList.remove('is-invalid');
		ui.body.classList.remove('is-invalid');
		setOptions(ui.category, categoryOptions(), draft.category);
		ui.shortcut.value = draft.shortcut;
		ui.subject.value = draft.subject;
		ui.body.value = draft.body;
		ui.live.checked = Boolean(draft.live);
	}

	/* Whatever moves while someone types: the save bar, the preview, the SMS
     meter and the list of fields in use. */
	function drawDraftState() {
		const template = activeTemplate();
		if (!template) return;
		const draft = editorCopy(template);
		const changed = model.unsaved.has(template.id) ? changedKeys(template, draft) : [];
		const dirty = changed.length > 0;
		const freshText = changed.includes('subject') || changed.includes('body');

		ui.saveState.innerHTML = dirty
			? '<i class="bi bi-circle-fill" aria-hidden="true"></i>Unsaved changes'
			: '<i class="bi bi-check2" aria-hidden="true"></i>All changes saved';
		ui.saveState.classList.toggle('is-dirty', dirty);
		ui.discard.disabled = !dirty;
		ui.save.disabled = !dirty;
		ui.saveLabel.textContent = freshText ? `Save as v${liveVersion(template).number + 1}` : 'Save';

		drawPreview(template, draft);
		drawSmsMeter(template, draft);
		drawFieldChips(draft);
	}

	/* Preview */

	function drawPreview(template, draft) {
		const persona = personaById(model.personaId);
		const values = mergeValues(persona);
		const me = memberById(model.signedIn);
		const build = PREVIEWS[template.type] || pushPreview;
		ui.preview.innerHTML = build(draft, persona, values, me);

		const used = fieldsIn(`${draft.subject} ${draft.body}`);
		const unknown = used.filter((key) => !knownFields.has(key));
		const missing = used.filter((key) => knownFields.has(key) && !values[key]);
		const notes = [`Filled in for ${htmlSafe(persona.name)}. `];
		if (unknown.length)
			notes.push(
				`<strong>${counted(unknown.length, 'name is', 'names are')} not a merge field</strong> and would be sent as typed. `,
			);
		if (missing.length)
			notes.push(
				`${counted(missing.length, 'field has', 'fields have')} no value for this sample; a real send leaves ${missing.length === 1 ? 'it' : 'them'} blank.`,
			);
		if (!unknown.length && !missing.length) notes.push('Every field has a value.');
		ui.previewFoot.innerHTML = notes.join('');
		enhance(ui.preview);
	}

	function mailPreview(draft, persona, values, me) {
		const sender = (model.fromLines[draft.category] || 'Fieldline <hello@fieldline.app>').replace(
			'John Armstrong',
			me ? me.name : 'John Armstrong',
		);
		const subject = draft.subject
			? fillHtml(draft.subject, values)
			: '<span class="mt-token mt-token-missing">No subject</span>';
		return [
			'<div class="mt-mail"><dl class="mt-mail-head">',
			`<div><dt>From</dt><dd>${htmlSafe(sender)}</dd></div>`,
			`<div><dt>To</dt><dd>${htmlSafe(persona.name)} &lt;${htmlSafe(values['customer.email'] || '')}&gt;</dd></div>`,
			`</dl><p class="mt-mail-subject">${subject}</p>`,
			`<div class="mt-mail-body">${fillHtml(draft.body, values)}</div></div>`,
		].join('');
	}

	/* Texts from onboarding come from Fieldline itself; the rest carry the
     customer's business name. */
	function textPreview(draft, persona, values) {
		const sender = draft.category === 'onboarding' ? 'Fieldline' : values['account.name'] || '{{account.name}}';
		return [
			'<div class="mt-phone"><div class="mt-phone-top">',
			`<span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(sender)}" aria-hidden="true"></span>`,
			`<span class="mt-phone-from">${htmlSafe(sender)}</span>`,
			`<span class="mt-phone-to">to ${htmlSafe(values['customer.phone'] || persona.name)}</span></div>`,
			`<div class="mt-phone-thread"><p class="mt-phone-day">Today ${htmlSafe(timeOfDay(SEED.today))}</p>`,
			`<div class="mt-bubble mt-bubble-in">${fillHtml(draft.body, values)}</div></div></div>`,
		].join('');
	}

	function replyPreview(draft, persona, values, me) {
		const ticket = values['ticket.id'] ? ` on ticket ${htmlSafe(values['ticket.id'])}` : '';
		return [
			`<div class="mt-reply"><p class="mt-reply-ctx"><i class="bi bi-person-raised-hand" aria-hidden="true"></i>Reply to ${htmlSafe(persona.name)}${ticket}</p>`,
			`<div class="mt-reply-msg"><span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(me ? me.name : 'John Armstrong')}" aria-hidden="true"></span>`,
			`<div class="mt-reply-bubble"><p class="mt-reply-who">${htmlSafe(me ? me.name : '')} <span>Fieldline Support</span></p>${fillHtml(draft.body, values)}</div></div></div>`,
		].join('');
	}

	function pushPreview(draft, persona, values) {
		return [
			`<div class="mt-lock"><p class="mt-lock-time">${htmlSafe(timeOfDay(SEED.today))}</p>`,
			'<div class="mt-push"><span class="mt-push-app" aria-hidden="true"><i class="bi bi-geo-alt-fill"></i></span>',
			'<div class="mt-push-text"><p class="mt-push-head"><span>Fieldline</span><span>now</span></p>',
			`<p class="mt-push-title">${draft.subject ? fillHtml(draft.subject, values) : 'No title'}</p>`,
			`<p class="mt-push-body">${fillHtml(draft.body, values)}</p></div></div></div>`,
		].join('');
	}

	/* SMS meter and field chips */

	function drawSmsMeter(template, draft) {
		const isText = template.type === 'sms';
		ui.sms.hidden = !isText;
		if (!isText) return;

		const persona = personaById(model.personaId);
		const reading = measureSms(fillText(draft.body, mergeValues(persona)));
		const segments = Math.max(reading.parts, 1);
		const tone = reading.parts > 2 ? 'danger' : reading.parts > 1 ? 'warning' : 'success';

		ui.smsCount.innerHTML = `<strong>${reading.length}</strong> characters with ${htmlSafe(persona.name.split(' ')[0])}’s details`;
		ui.smsSegments.innerHTML = `<span class="basalt-count-pill basalt-count-pill-${tone}">${counted(reading.parts, 'segment')}</span><span class="mt-sms-enc">${reading.unicode ? 'Unicode' : 'GSM-7'}</span>`;
		ui.smsBar.innerHTML = Array.from({ length: segments }, (_, index) => {
			const filled = Math.min(reading.per, Math.max(0, reading.length - index * reading.per));
			return `<span class="mt-sms-part"><span class="mt-sms-fill" data-w="${Math.round((filled / reading.per) * 100)}"></span></span>`;
		}).join('');
		for (const fill of pickAll('.mt-sms-fill', ui.smsBar)) fill.style.width = `${fill.getAttribute('data-w')}%`;

		const room = reading.per * segments;
		const sentences = [
			reading.parts > 1
				? `Each send costs ${counted(reading.parts, 'SMS credit')}. ${counted(room - reading.length, 'character')} left before another segment.`
				: `${counted(reading.per - reading.length, 'character')} left in one segment.`,
		];
		if (reading.unicode) {
			const culprits = reading.odd
				.slice(0, 3)
				.map((ch) => `<code class="mt-char">${htmlSafe(ch)}</code>`)
				.join(' ');
			sentences.push(
				`${culprits} switch${reading.odd.length === 1 ? 'es' : ''} the text to Unicode, so a segment holds 70 characters instead of 160.`,
			);
		}
		sentences.push('Names and times vary, so real lengths will too.');
		ui.smsNote.innerHTML = sentences.join(' ');
	}

	/** Length, encoding and segment count of a text once its fields are filled. */
	function measureSms(text) {
		const chars = Array.from(text);
		const outside = chars.filter((ch) => !GSM_SINGLE.includes(ch) && !GSM_DOUBLE.includes(ch));
		if (outside.length) {
			const length = sum(chars.map((ch) => (ch.codePointAt(0) > 0xffff ? 2 : 1)));
			return segmentsFor(length, 70, 67, { unicode: true, odd: [...new Set(outside)] });
		}
		const length = sum(chars.map((ch) => (GSM_DOUBLE.includes(ch) ? 2 : 1)));
		return segmentsFor(length, 160, 153, { unicode: false, odd: [] });
	}

	function segmentsFor(length, single, perPart, encoding) {
		const fits = length <= single;
		return { ...encoding, length, per: fits ? single : perPart, parts: fits ? 1 : Math.ceil(length / perPart) };
	}

	function drawFieldChips(draft) {
		const used = fieldsIn(`${draft.subject} ${draft.body}`);
		if (!used.length) {
			ui.fieldChips.innerHTML =
				'<p class="mt-fields-used-label">No merge fields yet. Every send will read exactly the same.</p>';
			return;
		}
		const values = mergeValues(personaById(model.personaId));
		const chips = used.map((key) => {
			let flag = '';
			let reason = '';
			if (!knownFields.has(key)) [flag, reason] = [' is-unknown', ', not a merge field'];
			else if (!values[key]) [flag, reason] = [' is-missing', ', no sample value'];
			const warning = flag ? '<i class="bi bi-exclamation-triangle" aria-hidden="true"></i>' : '';
			return `<li><span class="mt-field-chip${flag}">${warning}${htmlSafe(key)}<span class="visually-hidden">${reason}</span></span></li>`;
		});
		ui.fieldChips.innerHTML = `<p class="mt-fields-used-label">Fields in this template</p><ul class="mt-fields-used-list">${chips.join('')}</ul>`;
	}

	/* Usage tab */

	function drawUsage(template) {
		const kind = kindById(template.type);
		const isPush = template.type === 'notification';
		const sent = recentSends(template);
		const before = earlierSends(template);
		const change = before ? Math.round(((sent - before) / before) * 100) : null;
		const delivered = template.latest
			.filter(([, , when]) => new Date(when).getTime() <= demoNow())
			.sort((a, b) => b[2].localeCompare(a[2]));
		const lastSend = delivered.length ? delivered[0][2] : null;
		const noRate = template.rate == null;

		const tiles = [
			['Sent, last 4 weeks', sent.toLocaleString('en-US'), trendBadge(change)],
			[
				kind.rateLabel,
				noRate ? 'No sends yet' : percent(template.rate),
				noRate ? '' : `<span class="mt-stat-sub">of ${isPush ? 'notifications' : 'sends'}</span>`,
			],
			['Sent since it was made', template.lifetime.toLocaleString('en-US'), ''],
			['Last sent', lastSend ? relative(lastSend) : 'Not yet', ''],
		].map(
			([label, value, foot]) =>
				`<div class="mt-stat"><p class="mt-stat-label">${label}</p><p class="mt-stat-value">${value}</p>${foot ? `<p class="mt-stat-foot">${foot}</p>` : ''}</div>`,
		);

		const tallest = Math.max(...template.perWeek, 1);
		const bars = template.perWeek.map(
			(count, week) =>
				`<li class="mt-bars-col"><span class="mt-bars-val">${figure(count)}</span><span class="mt-bars-track"><span class="mt-bars-bar" data-h="${Math.round((count / tallest) * 100)}"></span></span><span class="mt-bars-week">${weekStarting(week)}</span></li>`,
		);

		const manual = Boolean(template.handSends?.length);
		const whoTitle = manual ? 'Who sends it, last 4 weeks' : 'How it is sent';

		ui.usage.innerHTML = [
			`<div class="mt-stats">${tiles.join('')}</div>`,
			`<section class="mt-usage-block" aria-labelledby="mt-bars-title"><h3 class="mt-usage-title" id="mt-bars-title">Sends per week</h3><ol class="mt-bars" aria-label="Sends per week, weeks starting ${weekStarting(0)} to ${weekStarting(7)}">${bars.join('')}</ol></section>`,
			'<div class="mt-usage-grid">',
			`<section class="mt-usage-block" aria-labelledby="mt-who-title"><h3 class="mt-usage-title" id="mt-who-title">${whoTitle}</h3>${senderBlock(template, sent) || '<p class="mt-help">Nobody has sent it by hand yet.</p>'}</section>`,
			`<section class="mt-usage-block" aria-labelledby="mt-recent-title"><h3 class="mt-usage-title" id="mt-recent-title">Latest sends</h3>${latestBlock(template, isPush)}</section>`,
			'</div>',
			`<div class="mt-api"><span class="mt-api-label">Template ID for the API</span><code class="mt-api-id">${htmlSafe(template.id)}</code><button type="button" class="btn btn-sm btn-outline-secondary btn-square" data-basalt-copy="${htmlSafe(template.id)}" data-bs-toggle="tooltip" data-bs-title="Copy the ID" aria-label="Copy the template ID"><i class="bi bi-copy" aria-hidden="true"></i></button></div>`,
		].join('');

		for (const bar of pickAll('.mt-bars-bar', ui.usage)) {
			bar.style.height = `${Math.max(2, Number(bar.getAttribute('data-h')))}%`;
		}
	}

	function trendBadge(change) {
		if (change == null) return '';
		const [tone, arrow] = change > 0 ? ['up', 'up'] : change < 0 ? ['down', 'down'] : ['flat', 'right'];
		return `<span class="basalt-trend basalt-trend-${tone}"><i class="bi bi-arrow-${arrow}" aria-hidden="true"></i>${Math.abs(change)}%<span class="visually-hidden"> ${change >= 0 ? 'more' : 'fewer'} than the 4 weeks before</span></span>`;
	}

	/* The trigger line, when the template sends itself, followed by who sent
     it by hand and how many each, from their share of recent sends. */
	function senderBlock(template, sent) {
		let block = '';
		if (template.handSends?.length) {
			const people = template.handSends.map(([memberId, share]) => {
				const member = memberById(memberId);
				const name = htmlSafe(member ? member.name : '');
				return `<li><span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${name}" aria-hidden="true"></span><span class="mt-who-name">${name}<span>${htmlSafe(member ? member.role : '')}</span></span><span class="mt-who-n">${Math.round(sent * share).toLocaleString('en-US')}</span></li>`;
			});
			block = `<ul class="mt-who">${people.join('')}</ul>`;
		}
		if (template.trigger)
			block = `<p class="mt-trigger mt-trigger-card"><i class="bi bi-lightning-charge" aria-hidden="true"></i>${htmlSafe(template.trigger)}</p>${block}`;
		return block;
	}

	function latestBlock(template, isPush) {
		if (!template.latest.length)
			return '<span class="basalt-empty basalt-empty-inline"><span class="basalt-empty-text">Nothing sent with this template yet.</span></span>';
		const items = template.latest
			.slice()
			.sort((a, b) => b[2].localeCompare(a[2]))
			.map(([name, company, when, answered]) =>
				[
					`<li><span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(name)}" aria-hidden="true"></span>`,
					`<span class="mt-recent-who">${htmlSafe(name)}<span>${htmlSafe(company)}</span></span>`,
					`<span class="mt-recent-when">${htmlSafe(relative(when))}</span>`,
					`${outcomePill(answered, isPush)}</li>`,
				].join(''),
			);
		return `<ul class="mt-recent">${items.join('')}</ul>`;
	}

	/* true is a reply (or an open), false is silence, null is still to come. */
	function outcomePill(answered, isPush) {
		if (answered === true)
			return `<span class="basalt-count-pill basalt-count-pill-success">${isPush ? 'Opened' : 'Replied'}</span>`;
		if (answered === false)
			return `<span class="basalt-count-pill mt-pill-muted">${isPush ? 'Not opened' : 'No reply'}</span>`;
		return '<span class="basalt-count-pill mt-pill-muted">Scheduled</span>';
	}

	/** Month and day of the Monday that began week `index` of perWeek; index 7 is the current week. */
	function weekStarting(index) {
		const monday = new Date(SEED.today);
		monday.setHours(0, 0, 0, 0);
		monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - (7 - index) * 7);
		return `${MONTH_NAMES[monday.getMonth()]} ${monday.getDate()}`;
	}

	/* The merge field picker, a command menu inside a dropdown */

	function buildFieldPicker() {
		const groups = model.fieldGroups.map((group, groupIndex) => {
			const options = group.entries.map(
				([key, label], index) =>
					`<div class="basalt-command-item" role="option" id="mt-f-${groupIndex}-${index}" aria-selected="false" data-value="${htmlSafe(key)}" data-keywords="${htmlSafe(group.heading.toLowerCase())}"><span class="basalt-command-text"><span class="basalt-command-title">{{${htmlSafe(key)}}}</span><span class="basalt-command-sub">${htmlSafe(label)}</span></span></div>`,
			);
			return `<div class="basalt-command-group" role="group" aria-labelledby="mt-fg-${groupIndex}"><div class="basalt-command-heading" id="mt-fg-${groupIndex}">${htmlSafe(group.heading)}</div>${options.join('')}</div>`;
		});
		ui.insertMenu.innerHTML = [
			'<div class="basalt-command basalt-command-as-menu mt-command">',
			'<div class="basalt-command-search"><i class="bi bi-search" aria-hidden="true"></i><input type="text" class="basalt-command-input" role="combobox" aria-expanded="true" aria-controls="mt-field-list" aria-autocomplete="list" aria-label="Search merge fields" placeholder="Search fields, e.g. time" autocomplete="off" spellcheck="false"></div>',
			`<div class="basalt-command-list" id="mt-field-list" role="listbox" aria-label="Merge fields">${groups.join('')}</div>`,
			'<div class="basalt-command-empty" hidden><i class="bi bi-braces" aria-hidden="true"></i><p>No field matches “<span data-basalt-command-term></span>”.</p></div>',
			'<div class="basalt-command-foot" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> insert</span><span><kbd>Esc</kbd> close</span></div>',
			'</div>',
		].join('');
		const menu = pick('.basalt-command', ui.insertMenu);
		menu.setAttribute('data-basalt-command', '');
		window.Basalt.command?.(menu);
	}

	/* Typing {{ (unless }} already follows) opens the picker and remembers
     where the braces are, so the chosen field replaces them. */
	function watchForBraces(field, event) {
		if (event.inputType && !event.inputType.startsWith('insert')) return;
		const caret = field.selectionStart;
		if (caret < 2 || field.value.slice(caret - 2, caret) !== '{{' || field.value.slice(caret, caret + 2) === '}}')
			return;
		braceOrigin = { field, start: caret - 2 };
		showFieldPicker(true);
	}

	function showFieldPicker(keepBraces) {
		if (ui.sheet.hidden) return;
		if (!keepBraces) braceOrigin = null;
		if (ui.usageTab.classList.contains('active')) bootstrap.Tab.getOrCreateInstance(ui.writeTab).show();
		bootstrap.Dropdown.getOrCreateInstance(ui.insertButton).show();
	}

	/** Writes {{key}} at the caret of the last field used, or over the typed braces. */
	function placeField(key) {
		const target = braceOrigin ? braceOrigin.field : model.focusedField || ui.body;
		const token = `{{${key}}}`;
		let from = target.selectionStart ?? target.value.length;
		let to = target.selectionEnd ?? from;
		if (braceOrigin && target.value.slice(braceOrigin.start, braceOrigin.start + 2) === '{{') {
			from = braceOrigin.start;
			to = Math.max(to, from + 2);
		}
		target.value = `${target.value.slice(0, from)}${token}${target.value.slice(to)}`;
		braceOrigin = null;
		const caret = from + token.length;
		handleEdit();
		setTimeout(() => {
			target.focus();
			target.setSelectionRange(caret, caret);
		}, 0);
		announce(`Inserted ${key}`);
	}

	/* Editing and saving */

	function readForm() {
		return {
			name: ui.name.value,
			category: ui.category.value,
			shortcut: ui.shortcut.value.trim().replace(/^\//, ''),
			subject: ui.subject.value,
			body: ui.body.value,
			live: ui.live.checked,
		};
	}

	/* Any change in the form lands here: the draft is kept only while it
     differs from what is saved. */
	function handleEdit() {
		const template = activeTemplate();
		if (!template) return;
		const draft = readForm();
		if (changedKeys(template, draft).length) model.unsaved.set(template.id, draft);
		else model.unsaved.delete(template.id);
		ui.sheetTitle.textContent = draft.name || 'Untitled template';
		drawDraftState();
		syncRow(template, draft);
	}

	/* Patches the template's row in the library in place, redrawing the list
     only when the Unsaved flag has to appear or go. */
	function syncRow(template, draft) {
		const row = pick(`[data-mt-open="${template.id}"]`, ui.rows);
		if (!row) return;
		if (Boolean(pick('.mt-unsaved', row)) !== model.unsaved.has(template.id)) {
			drawLibrary();
			return;
		}
		const nameSlot = pick('.mt-item-name', row);
		if (nameSlot) nameSlot.textContent = draft.name || template.name;
		const snippetSlot = pick('.mt-item-snippet', row);
		if (snippetSlot) snippetSlot.textContent = excerpt(template);
	}

	function throwAway() {
		const template = activeTemplate();
		if (!template || !model.unsaved.has(template.id)) return;
		const stash = model.unsaved.get(template.id);
		model.unsaved.delete(template.id);
		redraw();
		notify({
			tone: 'info',
			icon: 'bi-arrow-counterclockwise',
			title: 'Changes discarded',
			text: `${template.name} is back to v${liveVersion(template).number}.`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						model.unsaved.set(template.id, stash);
						if (model.activeId === template.id) redraw();
						else openById(template.id);
					},
				},
			],
		});
		announce('Changes discarded');
	}

	function saveDraft() {
		const template = activeTemplate();
		if (!template || !model.unsaved.has(template.id)) return;
		const draft = model.unsaved.get(template.id);
		if (!draftIsValid(template, draft)) return;

		const changed = changedKeys(template, draft);
		const snapshot = copyOf(template);
		const status = template.status === 'archived' ? 'archived' : draft.live ? 'live' : 'draft';
		const details = { name: draft.name.trim(), category: draft.category, shortcut: draft.shortcut, status };
		const version =
			changed.includes('subject') || changed.includes('body') ? nextVersion(template, draft, changed) : null;
		if (version) template.versions.unshift(version);
		Object.assign(template, details);
		if (!template.shortcut) delete template.shortcut;
		model.unsaved.delete(template.id);

		buttonState(ui.save, 'loading');
		const request = version ? server.addVersion(template.id, version, details) : server.patch(template.id, details);
		guarded(request, `save ${snapshot.name}`, () => {
			const index = model.templates.findIndex((t) => t.id === template.id);
			if (index > -1) model.templates[index] = snapshot;
			model.unsaved.set(template.id, draft);
		})
			.then(() => {
				buttonState(ui.save, 'success');
				setTimeout(() => buttonState(ui.save, 'idle'), 1200);
				redraw();
				const shift = statusShift(snapshot.status, status);
				notify({
					tone: 'success',
					icon: 'bi-check2-circle',
					title: version ? `Saved as v${version.number}` : 'Saved',
					text: `${template.name}.${shift}`,
				});
				announce(`${version ? `Saved as version ${version.number}` : 'Saved'}.${shift}`);
			})
			.catch(() => {
				buttonState(ui.save, 'error');
				setTimeout(() => buttonState(ui.save, 'idle'), 1600);
			});
	}

	/* A name and some text are required; a canned reply's shortcut may only
     use lower-case letters, digits and dashes. */
	function draftIsValid(template, draft) {
		const noName = !draft.name.trim();
		const noText = !draft.body.trim();
		ui.name.classList.toggle('is-invalid', noName);
		ui.body.classList.toggle('is-invalid', noText);
		if (noName || noText) {
			(noName ? ui.name : ui.body).focus();
			return false;
		}
		if (template.type === 'canned' && draft.shortcut && !/^[a-z0-9-]+$/.test(draft.shortcut)) {
			ui.shortcut.classList.add('is-invalid');
			notify({
				tone: 'warning',
				title: 'Check the shortcut',
				text: 'Use lower-case letters, numbers and dashes only.',
			});
			ui.shortcut.focus();
			return false;
		}
		ui.shortcut.classList.remove('is-invalid');
		return true;
	}

	function nextVersion(template, draft, changed) {
		const edited = [];
		if (changed.includes('subject')) edited.push(template.type === 'notification' ? 'title' : 'subject');
		if (changed.includes('body')) edited.push(template.type === 'sms' ? 'text' : 'message');
		return {
			number: liveVersion(template).number + 1,
			savedAt: stampNow(),
			author: model.signedIn,
			summary: `Edited the ${edited.join(' and ')}`,
			subject: draft.subject,
			body: draft.body,
		};
	}

	function statusShift(was, now) {
		if (now === 'live' && was !== 'live') return ' It is live now.';
		if (now === 'draft' && was === 'live') return ' It is a draft now, so the team can no longer pick it.';
		return '';
	}

	/* Opening templates and moving around */

	/** Opens a template, bringing its page of the library into view. */
	function openById(id, { focusRow = false, speak = false } = {}) {
		const template = templateById(id);
		if (!template) return;
		if (model.activeId !== id) model.personaId = template.persona || model.personaId;
		model.activeId = id;
		model.pickedVersion = null;
		if (narrow.matches) model.readingOnPhone = true;

		const position = shownTemplates().findIndex((t) => t.id === id);
		if (position > -1) model.page = Math.floor(position / ROWS_PER_PAGE) + 1;
		drawLibrary(focusRow ? id : null);
		drawDetail();
		ui.app.classList.toggle('is-reading', model.readingOnPhone);

		if (narrow.matches && !focusRow) {
			ui.app.scrollIntoView({ block: 'start' });
			ui.sheetTitle.setAttribute('tabindex', '-1');
			ui.sheetTitle.focus({ preventScroll: true });
		}
		if (speak) announce(`Opened ${template.name}`);
	}

	function step(offset) {
		const list = shownTemplates();
		if (!list.length) return;
		const position = list.findIndex((t) => t.id === model.activeId);
		const target = list[Math.min(list.length - 1, Math.max(0, position < 0 ? 0 : position + offset))];
		const fromList = Boolean(document.activeElement && ui.rows.contains(document.activeElement));
		openById(target.id, { focusRow: fromList || !narrow.matches, speak: true });
	}

	function backToList() {
		model.readingOnPhone = false;
		ui.app.classList.remove('is-reading');
		pick(`[data-mt-open="${model.activeId}"]`, ui.rows)?.focus();
	}

	/* The page scrolls rather than the list, so after a page turn that left
     the library's top under the top bar, scroll back to its first row. */
	function turnPage(button) {
		if (button.disabled) return;
		model.page += button.getAttribute('data-mt-page') === 'next' ? 1 : -1;
		drawLibrary();
		if (ui.listPane.getBoundingClientRect().top < 0) ui.listPane.scrollIntoView({ block: 'start' });
	}

	function clearFilters() {
		Object.assign(model.filter, { text: '', kind: 'all', category: 'all', status: 'active' });
		ui.search.value = '';
		model.page = 1;
		drawSelectFilters();
		drawKindFilter();
		drawLibrary();
		ui.search.focus();
		announce(ui.count.textContent.trim());
	}

	function copyTemplateId() {
		const template = activeTemplate();
		if (!template || !window.Basalt.copyText) return;
		window.Basalt.copyText(template.id).then(() =>
			notify({
				tone: 'success',
				icon: 'bi-clipboard-check',
				title: 'Template ID copied',
				text: template.id,
				duration: 3000,
			}),
		);
	}

	/* Duplicate, archive, restore and delete */

	function duplicateOpen() {
		const template = activeTemplate();
		if (!template) return;
		const draft = editorCopy(template);
		const copy = Object.assign(copyOf(template), {
			id: freshId('tpl-'),
			name: `Copy of ${draft.name || template.name}`,
			status: 'draft',
			owner: model.signedIn,
			perWeek: [0, 0, 0, 0, 0, 0, 0, 0],
			lifetime: 0,
			rate: null,
			latest: [],
		});
		if (copy.handSends) copy.handSends = [];
		if (copy.shortcut) copy.shortcut = `${copy.shortcut}-copy`;
		copy.versions = [
			{
				number: 1,
				savedAt: stampNow(),
				author: model.signedIn,
				summary: `Copied from ${template.name} v${liveVersion(template).number}`,
				subject: draft.subject,
				body: draft.body,
			},
		];
		model.templates.splice(model.templates.indexOf(template) + 1, 0, copy);

		const originalId = template.id;
		if (model.filter.status === 'archived' || model.filter.status === 'live') model.filter.status = 'active';
		drawSelectFilters();
		openById(copy.id);
		guarded(server.duplicate(template.id, copy), `duplicate ${template.name}`, () => {
			model.templates = model.templates.filter((t) => t.id !== copy.id);
			model.activeId = originalId;
		})
			.then(() => {
				notify({
					tone: 'success',
					icon: 'bi-copy',
					title: 'Duplicated as a draft',
					text: copy.name,
					actions: [
						{
							label: 'Undo',
							onClick() {
								model.templates = model.templates.filter((t) => t.id !== copy.id);
								model.unsaved.delete(copy.id);
								server.remove(copy.id);
								openById(originalId);
								announce('Copy removed');
							},
						},
					],
				});
				announce(`Duplicated. ${copy.name} is open.`);
				ui.name.focus();
				ui.name.select();
			})
			.catch(() => {});
	}

	/* Once a template drops out of the list, its neighbor takes the focus. */
	function successorOf(id) {
		const list = shownTemplates();
		const position = list.findIndex((t) => t.id === id);
		return list[position + 1] || list[position - 1] || null;
	}

	function archiveOpen() {
		const template = activeTemplate();
		if (!template) return;
		if (template.status === 'archived') {
			unarchiveOpen();
			return;
		}
		const previous = template.status;
		const successor = successorOf(template.id);
		template.statusBeforeArchive = previous;
		template.status = 'archived';
		if (!passes(template) && successor) model.activeId = successor.id;
		redraw();
		announce(`Archived ${template.name}`);
		guarded(server.archive(template.id), `archive ${template.name}`, () => {
			template.status = previous;
			model.activeId = template.id;
		})
			.then(() => {
				notify({
					tone: 'info',
					icon: 'bi-archive',
					title: 'Archived',
					text: `${template.name} is out of every picker. Find it under Archived.`,
					actions: [
						{
							label: 'Undo',
							onClick() {
								template.status = previous;
								server.unarchive(template.id);
								openById(template.id);
								announce(`Restored ${template.name}`);
							},
						},
					],
				});
			})
			.catch(() => {});
	}

	function unarchiveOpen() {
		const template = activeTemplate();
		if (!template || template.status !== 'archived') return;
		const returnsAs = template.statusBeforeArchive === 'live' ? 'live' : 'draft';
		template.status = returnsAs;
		if (model.filter.status === 'archived') model.filter.status = 'active';
		drawSelectFilters();
		openById(template.id);
		guarded(server.unarchive(template.id), `restore ${template.name}`, () => {
			template.status = 'archived';
		})
			.then(() => {
				notify({
					tone: 'success',
					icon: 'bi-box-arrow-up',
					title: 'Restored',
					text: `${template.name}${returnsAs === 'live' ? ' is live again.' : ' is back as a draft.'}`,
					actions: [
						{
							label: 'Undo',
							onClick() {
								template.status = 'archived';
								server.archive(template.id);
								redraw();
							},
						},
					],
				});
				announce(`Restored ${template.name}`);
			})
			.catch(() => {});
	}

	function askRemove() {
		ui.deleteTitle.textContent = `Delete “${activeTemplate().name}” for good?`;
		dialogFor(ui.deleteModal).show();
	}

	function deleteOpen() {
		const template = activeTemplate();
		if (!template) return;
		const index = model.templates.indexOf(template);
		const successor = successorOf(template.id);
		model.templates.splice(index, 1);
		model.unsaved.delete(template.id);
		model.activeId = successor ? successor.id : null;
		dialogFor(ui.deleteModal).hide();
		redraw();
		guarded(server.remove(template.id), `delete ${template.name}`, () => {
			model.templates.splice(index, 0, template);
			model.activeId = template.id;
		})
			.then(() => {
				notify({ tone: 'success', icon: 'bi-trash3', title: 'Deleted for good', text: template.name });
				announce(`Deleted ${template.name}`);
			})
			.catch(() => {});
	}

	/* Version history drawer */

	function showHistory() {
		drawHistory();
		bootstrap.Offcanvas.getOrCreateInstance(ui.history).show();
	}

	function drawHistory() {
		const template = activeTemplate();
		if (!template) return;
		const { versions } = template;
		if (!model.pickedVersion || !versions.some((v) => v.number === model.pickedVersion))
			model.pickedVersion = versions[0].number;
		ui.historySub.textContent = `${template.name}, ${counted(versions.length, 'version')}`;
		ui.versionList.innerHTML = versions.map((version, index) => versionRow(version, index === 0)).join('');

		const shown = versions.find((v) => v.number === model.pickedVersion);
		const values = mergeValues(personaById(model.personaId));
		const subject = shown.subject
			? `<p class="mt-version-view-subject">${fillHtml(shown.subject, values)}</p>`
			: '';
		ui.versionView.innerHTML = `<h3 class="mt-version-view-title">Version ${shown.number}</h3>${subject}<div class="mt-version-view-body">${fillHtml(shown.body, values)}</div>`;

		const isCurrent = shown.number === versions[0].number;
		ui.versionRestore.disabled = isCurrent && !model.unsaved.has(template.id);
		ui.versionRestore.innerHTML = `<i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>${isCurrent ? `Go back to v${shown.number}` : `Restore v${shown.number}`}`;
		enhance(ui.history);
	}

	function versionRow(version, isCurrent) {
		const author = memberById(version.author);
		const picked = version.number === model.pickedVersion;
		return [
			`<li><button type="button" class="mt-version${picked ? ' is-on' : ''}" data-mt-version="${version.number}" aria-pressed="${picked}">`,
			`<span class="mt-version-n">v${version.number}</span>`,
			`<span class="mt-version-main"><span class="mt-version-note">${htmlSafe(version.summary)}</span>`,
			`<span class="mt-version-by"><span class="basalt-avatar basalt-avatar-xs" data-basalt-avatar data-name="${htmlSafe(author ? author.name : '')}" aria-hidden="true"></span>${htmlSafe(author ? author.name : 'Someone')}, ${htmlSafe(relative(version.savedAt))}</span></span>`,
			`${isCurrent ? '<span class="basalt-count-pill basalt-count-pill-success">Current</span>' : ''}</button></li>`,
		].join('');
	}

	/* Loads the picked version into the editor as an unsaved draft; picking
     the current one simply drops the draft. */
	function bringBackVersion() {
		const template = activeTemplate();
		const version = template && template.versions.find((v) => v.number === model.pickedVersion);
		if (!version) return;
		const stash = model.unsaved.get(template.id) || null;
		const draft = { ...editorCopy(template), subject: version.subject || '', body: version.body };
		if (changedKeys(template, draft).length) model.unsaved.set(template.id, draft);
		else model.unsaved.delete(template.id);
		bootstrap.Offcanvas.getOrCreateInstance(ui.history).hide();
		bootstrap.Tab.getOrCreateInstance(ui.writeTab).show();
		redraw();

		const latest = version.number === liveVersion(template).number;
		notify({
			tone: 'info',
			icon: 'bi-clock-history',
			title: latest ? `Back to v${version.number}` : `v${version.number} is in the editor`,
			text: latest
				? 'Your unsaved changes are gone.'
				: `Save to make it v${liveVersion(template).number + 1}. Nothing is live until you do.`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						if (stash) model.unsaved.set(template.id, stash);
						else model.unsaved.delete(template.id);
						redraw();
					},
				},
			],
		});
		announce(
			latest ? 'Unsaved changes removed' : `Version ${version.number} loaded into the editor. Save to keep it.`,
		);
		ui.body.focus();
	}

	/* New template dialog */

	function startNewDialog() {
		if (!model.ready) return;
		ui.newForm.reset();
		ui.newName.classList.remove('is-invalid');
		dialogKind = model.filter.kind === 'all' ? 'email' : model.filter.kind;
		ui.newKinds.innerHTML = model.kinds
			.map(
				(kind) =>
					`<label class="basalt-choice mt-choice"><input type="radio" name="mtNewType" value="${kind.id}"${kind.id === dialogKind ? ' checked' : ''}><span class="mt-choice-icon" aria-hidden="true"><i class="bi ${kind.icon}"></i></span><span class="mt-choice-label">${htmlSafe(kind.name)}</span></label>`,
			)
			.join('');
		setOptions(
			ui.newCategory,
			categoryOptions(),
			model.filter.category === 'all' ? 'onboarding' : model.filter.category,
		);
		fillStartingPoints();
		dialogFor(ui.newModal).show();
	}

	/* A new template starts blank or from a copy of any unarchived one of the same kind. */
	function fillStartingPoints() {
		const sameKind = model.templates.filter((t) => t.type === dialogKind && t.status !== 'archived');
		const options = [{ value: '', label: 'A blank page' }];
		for (const t of sameKind)
			options.push({ value: t.id, label: `Copy of ${t.name}`, hint: categoryById(t.category).name });
		setOptions(ui.newFrom, options, '');
	}

	function createDraft() {
		const name = ui.newName.value.trim();
		ui.newName.classList.toggle('is-invalid', !name);
		if (!name) {
			ui.newName.focus();
			return;
		}
		const origin = templateById(ui.newFrom.value);
		const source = origin ? editorCopy(origin) : { subject: '', body: STARTER_BODIES[dialogKind] };
		const category = ui.newCategory.value;
		const template = {
			id: freshId('tpl-'),
			type: dialogKind,
			category,
			status: 'draft',
			name,
			owner: model.signedIn,
			persona: dialogKind === 'sms' || category === 'schedule' ? 'rachel' : 'dana',
			perWeek: [0, 0, 0, 0, 0, 0, 0, 0],
			lifetime: 0,
			rate: null,
			latest: [],
			versions: [
				{
					number: 1,
					savedAt: stampNow(),
					author: model.signedIn,
					summary: origin ? `Started from ${origin.name}` : 'First draft',
					subject: source.subject || '',
					body: source.body,
				},
			],
		};
		if (dialogKind === 'canned') Object.assign(template, { shortcut: '', handSends: [] });

		model.templates.unshift(template);
		Object.assign(model.filter, { kind: 'all', category: 'all', text: '' });
		ui.search.value = '';
		if (model.filter.status !== 'everything') model.filter.status = 'active';
		drawSelectFilters();
		dialogFor(ui.newModal).hide();
		openById(template.id);
		redraw();

		guarded(server.create(template), `create ${name}`, () => {
			model.templates = model.templates.filter((t) => t.id !== template.id);
			model.activeId = model.templates[0] ? model.templates[0].id : null;
		})
			.then(() => {
				notify({
					tone: 'success',
					icon: 'bi-plus-circle',
					title: 'Draft created',
					text: `${name} is open. Switch it to Live when it is ready.`,
				});
				announce(`Draft created: ${name}`);
				setTimeout(() => {
					ui.body.focus();
					const afterGreeting = ui.body.value.indexOf('\n\n') + 2;
					if (afterGreeting > 1) ui.body.setSelectionRange(afterGreeting, afterGreeting);
				}, 350);
			})
			.catch(() => {});
	}

	/* Test send dialog */

	function recipientKind(template) {
		if (template.type === 'sms') return 'phone';
		return template.type === 'notification' ? 'device' : 'email';
	}

	function openTestDialog() {
		const template = activeTemplate();
		if (!template) return;
		const body = pick('.modal-content', ui.testModal);
		window.Basalt.dialog?.clearDone(body);
		buttonState(ui.testSend, 'idle');

		const kind = recipientKind(template);
		const recipient = RECIPIENTS[kind];
		const me = memberById(model.signedIn);
		ui.testModal.setAttribute('data-kind', kind);
		ui.testToLabel.textContent = recipient.label;
		ui.testHelp.textContent =
			template.type === 'canned'
				? 'It arrives as an email, so you can read it as the customer would.'
				: recipient.help;
		ui.testError.textContent = recipient.error;
		/* The contact detail sits in the label itself, because the shared hint
       text is too faint in a few palettes. */
		ui.testPeople.innerHTML = model.team
			.map((member) => {
				const contact = recipient.contact(member);
				const label = `${member.name}, ${kind === 'device' ? member.role : contact}`;
				return `<li data-value="${htmlSafe(contact)}" data-label="${htmlSafe(label)}">${htmlSafe(label)}</li>`;
			})
			.join('');
		ui.testTo.value = recipient.contact(me);
		ui.testTo.classList.remove('is-invalid');
		setOptions(ui.testPersona, personaOptions(), model.personaId);
		drawTestPeek();
		dialogFor(ui.testModal).show();
	}

	function drawTestPeek() {
		const template = activeTemplate();
		if (!template) return;
		const draft = editorCopy(template);
		const values = mergeValues(personaById(ui.testPersona.value));
		const label = model.unsaved.has(template.id) ? 'Your unsaved version' : `v${liveVersion(template).number}`;
		const subject = draft.subject ? `<p class="mt-test-subject">[Test] ${fillHtml(draft.subject, values)}</p>` : '';
		ui.testPeek.innerHTML = `<p class="mt-test-label">${label}</p>${subject}<div class="mt-test-body">${fillHtml(draft.body, values)}</div>`;
	}

	function sendTest() {
		const template = activeTemplate();
		if (!template) return;
		const recipient = RECIPIENTS[ui.testModal.getAttribute('data-kind')];
		const to = ui.testTo.value.trim();
		const valid = recipient.accepts(to);
		ui.testTo.classList.toggle('is-invalid', !valid);
		ui.testTo.setAttribute('aria-invalid', String(!valid));
		if (!valid) {
			ui.testTo.focus();
			return;
		}
		const draft = editorCopy(template);
		buttonState(ui.testSend, 'loading');
		server
			.test(template.id, { to, sample: ui.testPersona.value, subject: draft.subject, body: draft.body })
			.then(() => {
				buttonState(ui.testSend, 'success');
				const arrival = recipient.arrival(to);
				window.Basalt.dialog?.done(pick('.modal-content', ui.testModal), arrival);
				announce(`Test sent. ${arrival}`);
			})
			.catch(() => {
				buttonState(ui.testSend, 'error');
				setTimeout(() => buttonState(ui.testSend, 'idle'), 1600);
				notify({
					tone: 'danger',
					icon: 'bi-wifi-off',
					title: 'The test did not go out',
					text: 'The server did not answer. Try again in a moment.',
				});
				announce('The test did not go out.');
			});
	}

	/* Model lookups */

	function activeTemplate() {
		return templateById(model.activeId);
	}

	function templateById(id) {
		return model.templates.find((t) => t.id === id) || null;
	}

	function memberById(id) {
		return model.team.find((member) => member.id === id) || null;
	}

	function kindById(id) {
		return model.kinds.find((kind) => kind.id === id) || model.kinds[0];
	}

	function categoryById(id) {
		return model.categories.find((category) => category.id === id) || model.categories[0];
	}

	function personaById(id) {
		return model.personas.find((persona) => persona.id === id) || model.personas[0];
	}

	function liveVersion(template) {
		return template.versions[0];
	}

	function recentSends(template) {
		return sum(template.perWeek.slice(-4));
	}

	function earlierSends(template) {
		return sum(template.perWeek.slice(0, 4));
	}

	function shortName(member) {
		if (!member) return 'Someone';
		return member.id === model.signedIn ? 'You' : member.name.split(' ')[0];
	}

	/* The library after search, filters and sort. */
	function shownTemplates() {
		return model.templates.filter(passes).sort(ORDERINGS[model.order]);
	}

	function passes(template) {
		const { kind, category, status, text } = model.filter;
		if (kind !== 'all' && template.type !== kind) return false;
		if (category !== 'all' && template.category !== category) return false;
		if (STATUS_TESTS[status] && !STATUS_TESTS[status](template.status)) return false;
		return !text || matchesWords(template, text);
	}

	/* Every word of the search has to appear somewhere: saved or draft name,
     subject, text, shortcut, type or category. */
	function matchesWords(template, text) {
		const draft = editorCopy(template);
		const haystack = [
			template.name,
			draft.name,
			draft.subject,
			draft.body,
			template.shortcut ? `/${template.shortcut}` : '',
			kindById(template.type).name,
			categoryById(template.category).name,
		]
			.join(' ')
			.toLowerCase();
		return text
			.toLowerCase()
			.split(/\s+/)
			.filter(Boolean)
			.every((word) => haystack.includes(word));
	}

	function filtering() {
		const { text, kind, category, status } = model.filter;
		return Boolean(text || kind !== 'all' || category !== 'all' || status !== 'active');
	}

	/* Drafts */

	function savedCopy(template) {
		const version = liveVersion(template);
		return {
			name: template.name,
			category: template.category,
			shortcut: template.shortcut || '',
			subject: version.subject || '',
			body: version.body,
			live: template.status === 'live',
		};
	}

	/* The editor shows the template's unsaved draft when there is one. */
	function editorCopy(template) {
		return model.unsaved.get(template.id) || savedCopy(template);
	}

	function changedKeys(template, draft) {
		const saved = savedCopy(template);
		return Object.keys(saved).filter((key) => saved[key] !== draft[key]);
	}

	/* Merge fields */

	function fieldsIn(text) {
		return [...new Set(Array.from(String(text || '').matchAll(MERGE_FIELD), (match) => match[1]))];
	}

	/** The persona's values plus the sender's first name, keyed by field. */
	function mergeValues(persona) {
		const values = { ...persona?.fills };
		const me = memberById(model.signedIn);
		if (me) values['agent.first_name'] = me.name.split(' ')[0];
		return values;
	}

	/* Text as HTML with each field replaced by its marked-up value. A field
     the persona has no value for, or a name that is no field at all, stays
     as it was typed. */
	function fillHtml(text, values) {
		const source = String(text || '');
		let html = '';
		let cursor = 0;
		for (const match of source.matchAll(MERGE_FIELD)) {
			html += `${htmlSafe(source.slice(cursor, match.index))}${tokenMarkup(match[0], match[1], values)}`;
			cursor = match.index + match[0].length;
		}
		return `${html}${htmlSafe(source.slice(cursor))}`;
	}

	function tokenMarkup(raw, key, values) {
		if (!knownFields.has(key))
			return `<span class="mt-token mt-token-unknown" title="Not a merge field">${htmlSafe(raw)}</span>`;
		if (!values[key])
			return `<span class="mt-token mt-token-missing" title="No sample value">${htmlSafe(raw)}</span>`;
		return `<span class="mt-token mt-token-filled" title="{{${htmlSafe(key)}}}">${htmlSafe(values[key])}</span>`;
	}

	function fillText(text, values) {
		return String(text || '').replace(MERGE_FIELD, (raw, key) =>
			knownFields.has(key) && values[key] ? values[key] : raw,
		);
	}

	/* Requests */

	function pause(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/* A write that fails in the offline demo, after the given delay. */
	function commit(answer, delay = 160) {
		return pause(delay).then(() => {
			if (scenario === 'offline') throw new Error('The server did not answer');
			return answer;
		});
	}

	/** Runs a request; on failure undoes the optimistic change, redraws and says so, then rejects. */
	function guarded(request, action, undo) {
		return request.catch(() => {
			undo?.();
			redraw();
			notify({
				tone: 'danger',
				icon: 'bi-wifi-off',
				title: `Could not ${action}`,
				text: 'Nothing was changed. Try again in a moment.',
			});
			announce(`Could not ${action}. Nothing was changed.`);
			throw new Error('failed');
		});
	}

	/* Shared parts from basalt.js */

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function announce(text) {
		window.Basalt.announce?.(text);
	}

	function buttonState(button, phase, label) {
		window.Basalt.buttonState?.(button, phase, label);
	}

	function enhance(scope) {
		window.Basalt.avatars?.(scope);
		window.Basalt.tips?.(scope);
		window.Basalt.buttons?.(scope);
	}

	function dialogFor(node) {
		return bootstrap.Modal.getOrCreateInstance(node);
	}

	function pickValue(select, value) {
		select.value = value;
		window.Basalt.select?.refresh?.(select);
	}

	function setOptions(select, options, value) {
		select.innerHTML = options
			.map(({ value: optionValue, label, hint, dot }) => {
				const extras = `${hint ? ` data-hint="${htmlSafe(hint)}"` : ''}${dot ? ` data-dot="${htmlSafe(dot)}"` : ''}`;
				return `<option value="${htmlSafe(optionValue)}"${extras}>${htmlSafe(label)}</option>`;
			})
			.join('');
		pickValue(select, value);
	}

	function categoryOptions() {
		return model.categories.map((category) => ({
			value: category.id,
			label: category.name,
			dot: `var(--basalt-series-${category.hue})`,
		}));
	}

	function personaOptions() {
		return model.personas.map((persona) => ({ value: persona.id, label: persona.name, hint: persona.hint }));
	}

	/* Small helpers */

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
	}

	function sum(numbers) {
		return numbers.reduce((total, n) => total + n, 0);
	}

	function counted(count, singular, pluralForm = `${singular}s`) {
		return `${count.toLocaleString('en-US')} ${count === 1 ? singular : pluralForm}`;
	}

	function figure(n) {
		return n >= 10000 ? compactNumber.format(n) : n.toLocaleString('en-US');
	}

	function percent(ratio) {
		return `${Math.round(ratio * 100)}%`;
	}

	function copyOf(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function freshId(prefix) {
		return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
	}

	/* Dates on the demo clock */

	function demoNow() {
		return new Date(SEED.today).getTime() + (Date.now() - bootedAt);
	}

	/** The demo's current moment as a local ISO string without a zone. */
	function stampNow() {
		const moment = new Date(demoNow());
		return new Date(moment.getTime() - moment.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
	}

	function monthDay(iso) {
		const date = new Date(iso);
		const year = date.getFullYear() === new Date(SEED.today).getFullYear() ? '' : ` ${date.getFullYear()}`;
		return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}${year}`;
	}

	function timeOfDay(iso) {
		const date = new Date(iso);
		const hours = date.getHours();
		return `${hours % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
	}

	/* "just now", minutes, "today" or "yesterday" with a time, days, then a date. */
	function relative(iso) {
		const minutesAgo = Math.round((demoNow() - new Date(iso).getTime()) / 60000);
		if (minutesAgo < 1) return 'just now';
		if (minutesAgo < 60) return `${minutesAgo} min ago`;
		const midnight = new Date(demoNow());
		midnight.setHours(0, 0, 0, 0);
		const date = new Date(iso);
		const dayGap = Math.floor(
			(midnight - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000,
		);
		if (dayGap <= 0) return `today, ${timeOfDay(iso)}`;
		if (dayGap === 1) return `yesterday, ${timeOfDay(iso)}`;
		return dayGap < 7 ? `${dayGap} days ago` : monthDay(iso);
	}

	/* The compact form used in list rows: now, 5m, 3h, 2d, then a date. */
	function terse(iso) {
		const minutesAgo = Math.round((demoNow() - new Date(iso).getTime()) / 60000);
		if (minutesAgo < 1) return 'now';
		if (minutesAgo < 60) return `${minutesAgo}m`;
		if (minutesAgo < 1440) return `${Math.round(minutesAgo / 60)}h`;
		const dayGap = Math.round(minutesAgo / 1440);
		return dayGap < 7 ? `${dayGap}d` : monthDay(iso);
	}

	/* Elements */

	/** Every element the script touches, found once. Dialogs and the drawer live outside the page root. */
	function gatherElements() {
		const hook = (name, scope = shell) => pick(`[data-mt-${name}]`, scope);
		const nodeById = (id) => document.getElementById(id);
		return {
			app: hook('app'),
			listPane: hook('list-pane'),
			count: hook('count'),
			search: hook('search'),
			sort: hook('sort'),
			kindFilter: hook('types'),
			categoryFilter: hook('category'),
			statusFilter: hook('status'),
			skeleton: hook('skeleton'),
			loadingText: hook('loading-text'),
			rows: hook('items'),
			listNote: hook('list-note'),
			pager: hook('pager'),
			pagePosition: hook('page-pos'),

			detail: hook('detail'),
			detailSkeleton: hook('detail-skeleton'),
			detailState: hook('detail-state'),
			sheet: hook('tpl'),
			sheetIcon: hook('tpl-icon'),
			sheetTitle: hook('tpl-title'),
			sheetMeta: hook('tpl-meta'),
			presence: hook('presence'),
			versionBadge: hook('version-label'),
			archiveLabel: hook('archive-label'),
			deleteRow: hook('delete-row'),
			archivedNote: hook('archived-note'),
			writeTab: nodeById('mt-tab-write'),
			usageTab: nodeById('mt-tab-usage'),

			form: hook('editor'),
			name: nodeById('mt-name'),
			category: nodeById('mt-cat'),
			shortcutField: hook('shortcut-wrap'),
			shortcut: nodeById('mt-shortcut'),
			triggerField: hook('trigger-wrap'),
			trigger: hook('trigger'),
			subjectField: hook('subject-wrap'),
			subjectLabel: hook('subject-label'),
			subject: nodeById('mt-subject'),
			bodyLabel: hook('body-label'),
			body: nodeById('mt-body'),
			insertButton: hook('insert-btn'),
			insertMenu: hook('insert-menu'),
			sms: hook('sms'),
			smsCount: hook('sms-count'),
			smsSegments: hook('sms-seg'),
			smsBar: hook('sms-bar'),
			smsNote: hook('sms-note'),
			fieldChips: hook('used-fields'),
			live: nodeById('mt-live'),
			liveHelp: hook('live-help'),
			saveState: hook('dirty'),
			discard: hook('discard'),
			save: hook('save'),
			saveLabel: hook('save-label'),
			persona: hook('sample'),
			preview: hook('preview'),
			previewFoot: hook('preview-foot'),
			usage: hook('usage'),

			history: nodeById('mt-history'),
			historySub: hook('history-sub', document),
			versionList: hook('versions', document),
			versionView: hook('version-view', document),
			versionRestore: hook('version-restore', document),

			newModal: nodeById('mt-new'),
			newForm: hook('new-form', document),
			newKinds: hook('new-types', document),
			newName: nodeById('mt-new-name'),
			newCategory: nodeById('mt-new-category'),
			newFrom: nodeById('mt-new-from'),

			testModal: nodeById('mt-test'),
			testForm: hook('test-form', document),
			testTo: nodeById('mt-test-to'),
			testToLabel: hook('test-to-label', document),
			testHelp: hook('test-help', document),
			testError: hook('test-error', document),
			testPeople: hook('test-people', document),
			testPersona: nodeById('mt-test-sample'),
			testPeek: hook('test-peek', document),
			testSend: hook('test-send', document),

			deleteModal: nodeById('mt-delete'),
			deleteTitle: hook('delete-title', document),
			deleteHold: hook('delete-hold', document),
			keysModal: nodeById('mt-keys'),
		};
	}

	start();

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
