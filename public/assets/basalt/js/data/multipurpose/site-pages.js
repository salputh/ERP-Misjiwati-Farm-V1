/**
 * The Fieldline marketing site as seen from the CMS. Each page carries its
 * address, owner, workflow state, last month of traffic, search snippet,
 * edit log and the stack of sections it is built from. pages.html lists
 * them and page-editor.html (?id=pg-pricing) opens one, both through
 * window.Basalt.data.sitePages, so the two screens always agree. Swap this
 * file for an endpoint that returns the same shape to use real pages.
 */
(() => {
	'use strict';

	/* Site areas, in the order the public menu lists them. Every area owns a
     numbered chart color, which keeps its badge in step with the palette. */
	const areas = [
		{ id: 'product', name: 'Product', tone: 1 },
		{ id: 'resources', name: 'Resources', tone: 2 },
		{ id: 'campaigns', name: 'Campaigns', tone: 5 },
		{ id: 'company', name: 'Company', tone: 3 },
		{ id: 'legal', name: 'Legal', tone: 4 },
	];

	/* Where an area's pages surface. Menu pages are public and linked from the
     header, footer pages are public but left out of it, and unlisted pages
     open only from a direct link. */
	const placement = {
		product: 'menu',
		resources: 'menu',
		company: 'menu',
		campaigns: 'unlisted',
		legal: 'footer',
	};

	/* Page templates. A distinct icon and chart color per template lets the
     list tiles be told apart before anyone reads them. */
	const layouts = [
		{ id: 'Landing', icon: 'bi-window', tone: 1 },
		{ id: 'Article', icon: 'bi-file-text', tone: 3 },
		{ id: 'Guide', icon: 'bi-journal-bookmark', tone: 2 },
		{ id: 'Directory', icon: 'bi-grid-3x2-gap', tone: 8 },
		{ id: 'Campaign', icon: 'bi-megaphone', tone: 5 },
		{ id: 'Legal', icon: 'bi-file-earmark-ruled', tone: 4 },
	];

	/* Page owners and the job shown under each name; the owner picker keeps
     this order. */
	const people = Object.fromEntries([
		['John Armstrong', 'Chief Technology Officer'],
		['Paige Drake', 'Content lead'],
		['Erin Slater', 'Product marketing'],
		['Reid Hollis', 'Sales marketing'],
		['Sharon Oakley', 'Customer education'],
		['Brittany Fenn', 'Customer content'],
		['Abe Boone', 'People team'],
		['Sandra Barlow', 'Legal counsel'],
	]);

	/* The pages themselves, filed under their area. A page is published unless
     it names another status; only published pages carry traffic: visits over
     the last 30 days, change as a percent against the 30 days before, and
     exits as the share of visits that went on to each next step. The log is
     [date, who, what], newest first. The outline lists the sections top to
     bottom, each with its kind (see page-editor.js) and its content. */
	const pagesByArea = {
		/* The pages that sell the app, from the home page down to add-ons. */
		product: [
			{
				id: 'pg-home',
				title: 'Home',
				path: '/',
				layout: 'Landing',
				owner: 'Paige Drake',
				since: '2024-03-04',
				edited: '2026-10-02',
				visits: 24180,
				change: 8,
				exits: { 'Opened Pricing': 34, 'Started a free trial': 21, 'Opened Features': 18 },
				snippet: [
					'Fieldline: scheduling for teams that work on site',
					'Book visits, plan the day and get paid from one app. Fieldline runs the working day for cleaning, care and pet care teams.',
				],
				log: [
					['2026-10-02', 'Paige Drake', 'Swapped the hero photo for the team shot'],
					['2026-09-24', 'John Armstrong', 'Updated the customer logos'],
					['2026-09-11', 'Paige Drake', 'Shortened the opening line'],
				],
				outline: [
					{
						kind: 'hero',
						eyebrow: 'Scheduling for on-site teams',
						headline: 'Run the whole working day from one app',
						text: 'Book visits, plan the day, send your team and get paid, for cleaning, care and pet care teams.',
						button: 'Start a free trial',
					},
					{
						kind: 'image',
						picture: 'board',
						caption: 'The schedule board on a Monday morning',
						alt: 'Schedule board with the day’s visits for six team members',
					},
					{
						kind: 'list',
						heading: 'Why teams switch',
						items: [
							['One board for every visit', 'Urgent requests, visits and quotes in one place'],
							['An app your team likes', 'Works offline, in gloves, in a basement'],
							['Paid on the day', 'Invoices and card payments at the door'],
						],
					},
					{
						kind: 'quote',
						quote: 'We dropped two spreadsheets and a whiteboard the week we moved to Fieldline.',
						name: 'Hope Nugent',
						role: 'Care manager, Oakhaven Studio',
					},
					{
						kind: 'cta',
						headline: 'See it with your own jobs',
						text: 'Try Fieldline free for 14 days, no card needed.',
						button: 'Start a free trial',
						second: 'Get a demo',
					},
				],
			},
			{
				id: 'pg-features',
				title: 'Features',
				path: '/features',
				layout: 'Landing',
				owner: 'Erin Slater',
				since: '2024-03-04',
				edited: '2026-09-28',
				visits: 19640,
				change: 3,
				exits: { 'Opened Pricing': 41, 'Started a free trial': 17, 'Opened Integrations': 12 },
				snippet: [
					'Features: schedule board, mobile app and invoicing',
					'See the schedule board, the team app, quotes and invoices, and how they work together for a team that works on site.',
				],
				log: [
					['2026-09-28', 'Erin Slater', 'Added the offline mode section'],
					['2026-09-14', 'Erin Slater', 'New screenshots of the schedule board'],
				],
				outline: [
					{
						kind: 'hero',
						eyebrow: 'Features',
						headline: 'Everything between the phone call and the payment',
						text: 'The schedule board, the team app, quotes and invoices, working as one.',
						button: 'Start a free trial',
					},
					{
						kind: 'list',
						heading: 'In the office',
						items: [
							['Schedule board', 'Drag visits between people and days'],
							['Quotes and invoices', 'Sent the same day as the visit'],
							['Reports', 'Revenue, visits and repeat calls at a glance'],
						],
					},
					{
						kind: 'image',
						picture: 'app',
						caption: 'The team app, with offline mode',
						alt: 'Team app showing a visit checklist on a phone',
					},
					{
						kind: 'text',
						heading: 'Works without a signal',
						body: '<p>Visits, checklists and photos save on the phone in a basement with no signal, and sync once the phone is back in range.</p>',
					},
					{
						kind: 'cta',
						headline: 'Ready to see it?',
						text: 'Book a 30-minute demo with your own jobs.',
						button: 'Get a demo',
						second: 'Start a free trial',
					},
				],
			},
			{
				id: 'pg-pricing',
				title: 'Pricing',
				path: '/pricing',
				layout: 'Landing',
				owner: 'Reid Hollis',
				since: '2024-03-04',
				edited: '2026-10-06',
				visits: 15230,
				change: 12,
				exits: { 'Started a free trial': 38, 'Opened Fieldline for Enterprise': 14, 'Booked a demo': 9 },
				snippet: [
					'Pricing: Free, Basic, Pro and Max plans',
					'Free for up to 3 people, then from $15 per seat a month, with two months free on annual billing. Compare all four.',
				],
				log: [
					['2026-10-06', 'Reid Hollis', 'Added annual prices to the plan cards'],
					['2026-09-17', 'Reid Hollis', 'Rewrote the SMS credits question'],
					['2026-09-03', 'Paige Drake', 'Fixed a typo in the Max column'],
					['2026-08-21', 'Reid Hollis', 'Hid the schedule board picture'],
					['2026-07-09', 'Paige Drake', 'Moved the questions above the call to action'],
				],
				outline: [
					{
						kind: 'hero',
						eyebrow: 'Pricing',
						headline: 'Plans that grow with your on-site team',
						text: 'Pay per seat each month, or get two months free when you pay for the year.',
						button: 'Start a free trial',
					},
					{ kind: 'plans', heading: 'Pick a plan', highlight: 'growth', annual: true },
					{
						kind: 'text',
						heading: 'Every plan includes',
						body: '<p>The team app, unlimited visits and customers, and support by email and chat.</p><ul><li>No setup fees</li><li>Cancel any time</li><li>Free import from your spreadsheets</li></ul>',
					},
					{
						kind: 'list',
						heading: 'Add-ons',
						items: [
							['Travel Planner', '$6 per seat a month'],
							['Customer Portal', '$4 per seat a month'],
							['SMS credits', '$25 for 1,000 texts'],
						],
					},
					{
						kind: 'image',
						hidden: true,
						picture: 'board',
						caption: 'The schedule board on the Pro plan',
						alt: 'Schedule board with the day’s visits for four team members',
					},
					{
						kind: 'quote',
						quote: 'We dropped two spreadsheets and a whiteboard the week we moved to Fieldline.',
						name: 'Hope Nugent',
						role: 'Care manager, Oakhaven Studio',
					},
					{
						kind: 'faq',
						heading: 'Questions about plans',
						items: [
							[
								'Can I switch plans later?',
								'Yes. Move up or down at any time and the next invoice adjusts.',
							],
							[
								'How do SMS credits work?',
								'Credits come in packs of 1,000 for $25 and never run out. Each text to a customer uses one.',
							],
							[
								'Can I try it for free?',
								'Every plan starts with 14 days free, and you don’t need a card.',
							],
						],
					},
					{
						kind: 'cta',
						headline: 'Ready to fill your calendar?',
						text: 'Try Fieldline free for 14 days.',
						button: 'Start a free trial',
						second: 'Get a demo',
					},
				],
			},
			{
				id: 'pg-portal',
				title: 'Customer Portal',
				path: '/features/customer-portal',
				layout: 'Landing',
				owner: 'Erin Slater',
				since: '2025-05-12',
				edited: '2026-09-19',
				visits: 4310,
				change: -4,
				exits: { 'Opened Pricing': 29, 'Started a free trial': 12, 'Opened Features': 11 },
				snippet: [
					'Customer Portal for on-site service teams: online booking, invoices and payments',
					'Let customers book visits, approve quotes and pay invoices online, with your logo and colors. Included as an add-on on every plan.',
				],
				log: [
					['2026-09-19', 'Erin Slater', 'Added the payment screenshots'],
					['2026-08-30', 'Erin Slater', 'Changed the price to $4 a seat'],
				],
				outline: [
					{
						kind: 'hero',
						eyebrow: 'Customer Portal',
						headline: 'Let customers book, approve and pay online',
						text: 'A portal with your logo and colors, for $4 a seat a month on any plan.',
						button: 'Start a free trial',
					},
					{
						kind: 'image',
						picture: 'app',
						caption: 'Paying an invoice from a phone',
						alt: 'Customer Portal payment page on a phone',
					},
					{
						kind: 'list',
						heading: 'What customers can do',
						items: [
							['Book a visit', 'Pick from the slots you offer'],
							['Approve a quote', 'With one tap, from the email'],
							['Pay an invoice', 'By card, even on one bar of signal'],
						],
					},
					{
						kind: 'faq',
						heading: 'Questions',
						items: [
							[
								'Can it use our own address?',
								'Yes, such as book.yourcompany.com, with the padlock in place.',
							],
							['Which plans include it?', 'It is an add-on for Basic, Pro and Max.'],
						],
					},
					{
						kind: 'cta',
						headline: 'Give customers a better way in',
						text: '',
						button: 'Start a free trial',
						second: '',
					},
				],
			},
			{
				id: 'pg-travel',
				title: 'Travel Planner',
				path: '/features/travel-planner',
				layout: 'Landing',
				owner: 'Erin Slater',
				status: 'scheduled',
				since: '2026-09-21',
				edited: '2026-10-07',
				goLive: '2026-10-14',
				time: '09:00',
				snippet: [
					'Travel Planner: shorter drives, more visits a day',
					'Plan every day in seconds around traffic, skills and lunch breaks. Teams on the beta fitted in one more visit per person a day.',
				],
				log: [
					['2026-10-07', 'John Armstrong', 'Scheduled for Oct 14 at 9:00 am'],
					['2026-10-07', 'Reid Hollis', 'Approved the page'],
					['2026-10-05', 'Erin Slater', 'Added the before and after day maps'],
				],
				outline: [
					{
						kind: 'hero',
						eyebrow: 'New: Travel Planner',
						headline: 'Shorter drives, more visits a day',
						text: 'Plan every day in seconds around traffic, skills and lunch breaks.',
						button: 'Start a free trial',
					},
					{
						kind: 'image',
						picture: 'route',
						caption: 'Before and after: one cleaner’s Tuesday',
						alt: 'Two maps of the day side by side, the second one shorter',
					},
					{
						kind: 'list',
						heading: 'How it plans',
						items: [
							['Traffic', 'Live and typical, by time of day'],
							['Skills', 'Only people who can do the visit'],
							['Breaks', 'Lunch windows each person picks'],
						],
					},
					{
						kind: 'quote',
						quote: 'Our crews fitted in one more visit a day from the first week.',
						name: 'Robyn Daniels',
						role: 'Office manager, Copperleaf Design',
					},
					{
						kind: 'cta',
						headline: 'Add it to any plan',
						text: '$6 per seat a month.',
						button: 'Start a free trial',
						second: 'Get a demo',
					},
				],
			},
			{
				id: 'pg-integrations',
				title: 'Integrations',
				path: '/integrations',
				layout: 'Directory',
				owner: 'Reid Hollis',
				since: '2024-06-18',
				edited: '2026-08-19',
				visits: 3760,
				change: 2,
				exits: { 'Opened an integration': 46, 'Left the site': 21, 'Opened Pricing': 15 },
				snippet: ['Integrations: accounting, payments and calendars', ''],
				log: [
					['2026-08-19', 'Reid Hollis', 'Added the Xero and Stripe cards'],
					['2026-07-30', 'Reid Hollis', 'Sorted the cards by category'],
				],
				outline: [
					{
						kind: 'hero',
						eyebrow: 'Integrations',
						headline: 'Works with the tools you already use',
						text: 'Accounting, payments and calendars, connected in a few clicks.',
						button: 'See all integrations',
					},
					{
						kind: 'list',
						heading: 'Most used',
						items: [
							['Xero', 'Invoices and payments, synced nightly'],
							['Stripe', 'Card payments in the app and portal'],
							['Google Calendar', 'Each person’s day, on their own phone'],
						],
					},
					{
						kind: 'text',
						heading: 'Build your own',
						body: '<p>Our API covers visits, customers, invoices and car stock, with webhooks for every change.</p>',
					},
					{
						kind: 'cta',
						headline: 'Missing one?',
						text: 'Tell us what you use and we will look at it.',
						button: 'Suggest an integration',
						second: '',
					},
				],
			},
			{
				id: 'pg-enterprise',
				title: 'Fieldline for Enterprise',
				path: '/enterprise',
				layout: 'Landing',
				owner: 'Reid Hollis',
				since: '2024-09-09',
				edited: '2026-09-02',
				visits: 7420,
				change: 5,
				exits: { 'Opened Pricing': 22, 'Booked a demo': 19, 'Opened Security': 13 },
				snippet: [
					'Fieldline for Enterprise: many regions, one schedule',
					'Single sign-on, regional scheduling teams, audit logs and a named success manager for on-site service companies with 200 seats or more.',
				],
				log: [
					['2026-09-02', 'Reid Hollis', 'Added the Highpoint Outfitters quote'],
					['2026-08-21', 'Paige Drake', 'Tightened the opening section'],
				],
				outline: [
					{
						kind: 'hero',
						eyebrow: 'Enterprise',
						headline: 'Many regions, one schedule',
						text: 'For on-site service companies with 200 seats or more.',
						button: 'Talk to sales',
					},
					{
						kind: 'list',
						heading: 'Built for larger teams',
						items: [
							['Single sign-on', 'With your own directory'],
							['Regional scheduling', 'Each region runs its own board'],
							['Audit logs', 'Every change, kept for two years'],
							['Success manager', 'A named person who knows your account'],
						],
					},
					{
						kind: 'quote',
						quote: 'Two hundred carers across three provinces, and one schedule everyone trusts.',
						name: 'Graham Pike',
						role: 'IT and systems lead, Highpoint Outfitters',
					},
					{
						kind: 'cta',
						headline: 'Plan your rollout with us',
						text: '',
						button: 'Talk to sales',
						second: 'See security',
					},
				],
			},
			{
				id: 'pg-addons',
				title: 'Add-ons & Services',
				path: '/add-ons',
				layout: 'Directory',
				owner: 'Erin Slater',
				since: '2025-02-10',
				edited: '2026-09-21',
				visits: 6050,
				change: 21,
				exits: { 'Opened Onboarding Package': 24, 'Booked a training session': 27, 'Opened Pricing': 8 },
				snippet: [
					'Add-ons & Services: onboarding, training and more',
					'Onboarding, live training, travel planning and text credits, set up by the Fieldline team so your crew is ready on day one.',
				],
				log: [
					['2026-09-21', 'Erin Slater', 'Added the SMS credits'],
					['2026-09-09', 'Reid Hollis', 'New photos for Live Training'],
				],
				outline: [
					{
						kind: 'hero',
						eyebrow: 'Add-ons & Services',
						headline: 'Setup and training from the people who built it',
						text: 'Onboarding, live training, travel planning and text credits, in one place.',
						button: 'See services',
					},
					{
						kind: 'list',
						heading: 'Popular with new teams',
						items: [
							['Onboarding Package', '$1,250'],
							['Live Training Session', '$350'],
							['Travel Planner', '$6 a seat a month'],
							['SMS Credits, 1,000', '$25'],
						],
					},
					{
						kind: 'image',
						picture: 'app',
						caption: 'A live training session on a video call',
						alt: 'A trainer showing the schedule board on a call',
					},
					{
						kind: 'faq',
						heading: 'Questions',
						items: [
							[
								'Who runs the onboarding?',
								'An onboarding manager, who imports your customers and trains the team.',
							],
							['Can I cancel an add-on?', 'Any time, from the end of the month.'],
						],
					},
				],
			},
		],
		/* Guides, stories and help that keep customers learning. */
		resources: [
			{
				id: 'pg-guides',
				title: 'On-site Team Guides',
				path: '/guides',
				layout: 'Guide',
				owner: 'Sharon Oakley',
				since: '2024-04-22',
				edited: '2026-09-24',
				visits: 11870,
				change: 6,
				exits: { 'Opened a guide chapter': 48, 'Started a free trial': 9, 'Opened the blog': 14 },
				snippet: [
					'On-site Team Guides: scheduling, pricing and hiring',
					'Free guides for owners and office managers of on-site teams: scheduling, pricing maintenance plans, hiring and getting paid on time.',
				],
				log: [
					['2026-09-24', 'Sharon Oakley', 'Added the chapter on maintenance plans'],
					['2026-09-02', 'Sharon Oakley', 'Updated the hiring checklist'],
				],
				outline: [
					{
						kind: 'hero',
						eyebrow: 'Guides',
						headline: 'Free guides for running an on-site team',
						text: 'Scheduling, pricing, hiring and getting paid on time.',
						button: 'Browse the guides',
					},
					{
						kind: 'list',
						heading: 'Chapters',
						items: [
							['A schedule that survives Monday', '12 min read'],
							['Pricing maintenance plans', '9 min read'],
							['Hiring your next team member', '11 min read'],
							['Getting paid on the day', '8 min read'],
						],
					},
					{
						kind: 'text',
						heading: 'Written by people who do the work',
						body: '<p>Every guide is checked by an office manager or owner who runs an on-site team today.</p>',
					},
					{
						kind: 'cta',
						headline: 'Get new chapters by email',
						text: 'One email a month, no more.',
						button: 'Sign up',
						second: '',
					},
				],
			},
			{
				id: 'pg-stories',
				title: 'Customer Stories',
				path: '/customers',
				layout: 'Article',
				owner: 'Brittany Fenn',
				since: '2024-05-06',
				edited: '2026-09-30',
				visits: 5980,
				change: 9,
				exits: { 'Opened a story': 52, 'Opened Pricing': 13, 'Started a free trial': 8 },
				snippet: [
					'Customer Stories: how on-site teams run on Fieldline',
					'How Oakhaven Studio, Avocet Robotics and other local businesses cut complaints, filled their calendars and stopped chasing invoices.',
				],
				log: [
					['2026-09-30', 'Brittany Fenn', 'Added the Oakhaven Studio story'],
					['2026-09-12', 'Brittany Fenn', 'Moved Avocet Robotics to the top'],
				],
				outline: [
					{
						kind: 'hero',
						eyebrow: 'Customer Stories',
						headline: 'How on-site teams run on Fieldline',
						text: 'Real numbers from real businesses, in their own words.',
						button: 'Start a free trial',
					},
					{
						kind: 'list',
						heading: 'Latest stories',
						items: [
							['Oakhaven Studio', 'Halved its complaints'],
							['Avocet Robotics', 'Doubled its grooming visits'],
							['Harborline AI', 'Eight weeks of new rounds'],
						],
					},
					{
						kind: 'quote',
						quote: 'Customers would rather tap a time than talk to us.',
						name: 'Allison Nance',
						role: 'Owner, Avocet Robotics',
					},
					{ kind: 'cta', headline: 'Write the next one', text: '', button: 'Start a free trial', second: '' },
				],
			},
			{
				id: 'pg-webinars',
				title: 'Webinars',
				path: '/webinars',
				layout: 'Directory',
				owner: 'Sharon Oakley',
				status: 'review',
				since: '2026-09-22',
				edited: '2026-10-05',
				reviewer: 'Paige Drake',
				snippet: [
					'Webinars: live sessions for on-site service teams',
					'Free live sessions every month on scheduling, travel and getting paid faster, with recordings of past sessions for your whole team.',
				],
				log: [
					['2026-10-05', 'Sharon Oakley', 'Sent to Paige Drake for review'],
					['2026-10-01', 'Sharon Oakley', 'Added the October sessions'],
				],
				outline: [
					{
						kind: 'hero',
						eyebrow: 'Webinars',
						headline: 'Live sessions for on-site service teams',
						text: 'Free every month, with recordings for your whole team.',
						button: 'Save a seat',
					},
					{
						kind: 'list',
						heading: 'October',
						items: [
							['Travel Planner in practice', 'Tue, Oct 13, 4:00 pm'],
							['Getting paid faster', 'Thu, Oct 22, 4:00 pm'],
						],
					},
					{
						kind: 'text',
						heading: 'Past sessions',
						body: '<p>Every recording stays online, with the slides and a short summary.</p>',
					},
					{
						kind: 'cta',
						headline: 'Never miss one',
						text: 'We send one reminder the day before.',
						button: 'Sign up',
						second: '',
					},
				],
			},
			{
				id: 'pg-help',
				title: 'Help Center',
				path: '/help',
				layout: 'Directory',
				owner: 'Sharon Oakley',
				since: '2024-03-04',
				edited: '2026-09-15',
				visits: 9140,
				change: -2,
				exits: { 'Opened an article': 61, 'Contacted support': 11, 'Signed in to the app': 17 },
				snippet: [
					'Help Center: answers about accounts and billing',
					'Step-by-step answers about your account, plans and billing, the team app and your add-ons, plus how to reach our support team.',
				],
				log: [
					['2026-09-15', 'Sharon Oakley', 'Added the add-on refunds topic'],
					['2026-08-28', 'Sharon Oakley', 'Renamed Billing to Plans and billing'],
				],
				outline: [
					{
						kind: 'hero',
						eyebrow: 'Help Center',
						headline: 'How can we help?',
						text: 'Answers about your account, plans, the app and add-ons.',
						button: 'Search help',
					},
					{
						kind: 'list',
						heading: 'Topics',
						items: [
							['Plans and billing', '42 articles'],
							['The team app', '58 articles'],
							['Add-ons and refunds', '17 articles'],
						],
					},
					{
						kind: 'faq',
						heading: 'Asked most this week',
						items: [
							['How do I add a seat?', 'Settings, then Team, then Add person.'],
							['Why are someone’s visits missing?', 'Open the app, then Settings, then Sync now.'],
						],
					},
					{
						kind: 'cta',
						headline: 'Still stuck?',
						text: 'Our support team answers within two hours on weekdays.',
						button: 'Message support',
						second: '',
					},
				],
			},
		],
		/* Time-boxed offers, shared by link and kept off the menu. */
		campaigns: [
			{
				id: 'pg-winter',
				title: 'Home Care Winter Kit',
				path: '/home-care-winter',
				layout: 'Campaign',
				owner: 'Brittany Fenn',
				status: 'review',
				since: '2026-09-25',
				edited: '2026-10-03',
				reviewer: 'Reid Hollis',
				snippet: [
					'Home Care Winter Kit: templates for the cold months',
					'Checklists, text templates and a booking calendar setup that help home care teams get through the first cold weeks without missed visits.',
				],
				log: [
					['2026-10-03', 'Brittany Fenn', 'Sent to Reid Hollis for review'],
					['2026-10-02', 'Brittany Fenn', 'Added the winter checklist download'],
				],
				outline: [
					{
						kind: 'hero',
						eyebrow: 'For home care teams',
						headline: 'Get through the first cold weeks',
						text: 'Checklists, text templates and a booking setup for the cold months.',
						button: 'Get the kit',
					},
					{
						kind: 'list',
						heading: 'In the kit',
						items: [
							['Winter checklist', 'Twelve checks, ready to import'],
							['Text templates', 'For reminders and delays'],
							['Booking calendar setup', 'Slots by neighborhood'],
						],
					},
					{
						kind: 'quote',
						quote: 'If a client is going to struggle this winter, we want to find out in October, with us there.',
						name: 'Graham Pike',
						role: 'Highpoint Outfitters',
					},
					{
						kind: 'cta',
						headline: 'Free for every home care team',
						text: '',
						button: 'Get the kit',
						second: '',
					},
				],
			},
			{
				id: 'pg-refer',
				title: 'Refer a Business',
				path: '/refer',
				layout: 'Campaign',
				owner: 'Brittany Fenn',
				since: '2026-06-02',
				edited: '2026-09-08',
				visits: 1720,
				change: 31,
				exits: { 'Sent a referral': 26, 'Opened Pricing': 12, 'Left the site': 30 },
				snippet: [
					'Refer a business and get a month of Fieldline free',
					'Know a local business that still schedules on paper? Send them to Fieldline, and you both get a month free once they subscribe.',
				],
				log: [
					['2026-09-08', 'Brittany Fenn', 'Raised the reward to one month'],
					['2026-08-14', 'Paige Drake', 'Shortened the form to two fields'],
				],
				outline: [
					{
						kind: 'hero',
						eyebrow: 'Refer a business',
						headline: 'Know a team still on paper?',
						text: 'Send them to Fieldline and you both get a month free once they subscribe.',
						button: 'Send a referral',
					},
					{
						kind: 'list',
						heading: 'How it works',
						items: [
							['Send', 'Their name and email, nothing else'],
							['They try it', '14 days free, no card'],
							['You both save', 'A month free each, once they subscribe'],
						],
					},
					{
						kind: 'faq',
						heading: 'Questions',
						items: [['Is there a limit?', 'No. Every business that subscribes earns you a month.']],
					},
					{
						kind: 'cta',
						headline: 'Send your first referral',
						text: '',
						button: 'Send a referral',
						second: '',
					},
				],
			},
			{
				id: 'pg-paper',
				title: 'Switch from Paper',
				path: '/switch-from-paper',
				layout: 'Campaign',
				owner: 'Erin Slater',
				since: '2026-04-15',
				edited: '2026-08-27',
				visits: 2480,
				change: -6,
				exits: { 'Started a free trial': 19, 'Booked a demo': 7, 'Opened Pricing': 16 },
				snippet: [
					'Switch from paper schedules in one week',
					'Move your customers, visits and price list into Fieldline in a week, with a free setup call and help importing your spreadsheets.',
				],
				log: [
					['2026-08-27', 'Erin Slater', 'Added the import video'],
					['2026-07-18', 'Erin Slater', 'Changed the offer to a free setup call'],
				],
				outline: [
					{
						kind: 'hero',
						eyebrow: 'Switch from paper',
						headline: 'Off paper schedules in one week',
						text: 'We move your customers, visits and price list in for you.',
						button: 'Book a setup call',
					},
					{
						kind: 'list',
						heading: 'Your first week',
						items: [
							['Day 1', 'A setup call and your spreadsheets'],
							['Day 3', 'Customers and prices imported'],
							['Day 5', 'Your team on the app'],
						],
					},
					{
						kind: 'image',
						picture: 'app',
						caption: 'Importing a spreadsheet of customers',
						alt: 'Import screen showing columns being matched',
					},
					{
						kind: 'cta',
						headline: 'Start with a free setup call',
						text: '',
						button: 'Book a setup call',
						second: 'Start a free trial',
					},
				],
			},
		],
		/* Who builds Fieldline, who it hires and how to reach sales. */
		company: [
			{
				id: 'pg-about',
				title: 'About Fieldline',
				path: '/about',
				layout: 'Article',
				owner: 'John Armstrong',
				since: '2024-03-04',
				edited: '2026-07-28',
				visits: 3140,
				change: 1,
				exits: { 'Opened Careers': 18, 'Opened Customer Stories': 12, 'Left the site': 34 },
				snippet: [
					'About Fieldline: built with and for on-site teams',
					'Fieldline started in a cleaning firm’s office in 2019. Today 120 people build scheduling software for more than 2,000 on-site teams.',
				],
				log: [
					['2026-07-28', 'John Armstrong', 'Updated the team photo'],
					['2026-07-02', 'Paige Drake', 'Added the 2026 numbers'],
				],
				outline: [
					{
						kind: 'hero',
						eyebrow: 'About',
						headline: 'Built with and for on-site teams',
						text: 'Fieldline started in a cleaning firm’s office in 2019.',
						button: 'See open roles',
					},
					{
						kind: 'text',
						heading: 'Our story',
						body: '<p>Today 120 people build scheduling software for more than 2,000 on-site teams, from two-person cleaning firms to regional home care agencies.</p>',
					},
					{
						kind: 'image',
						picture: 'board',
						caption: 'The team in Minot',
						alt: 'The Fieldline team in the Minot office',
					},
					{ kind: 'cta', headline: 'Come and work with us', text: '', button: 'See open roles', second: '' },
				],
			},
			{
				id: 'pg-careers',
				title: 'Careers',
				path: '/careers',
				layout: 'Landing',
				owner: 'Abe Boone',
				status: 'draft',
				since: '2026-09-29',
				edited: '2026-10-07',
				snippet: [
					'Careers at Fieldline: build software for on-site teams',
					'Open roles in engineering, support and sales across the Midwest and the Northeast, with a trial shift instead of a take-home test.',
				],
				log: [
					['2026-10-07', 'Abe Boone', 'Added the support roles in the Midwest'],
					['2026-09-29', 'Abe Boone', 'Started the page'],
				],
				outline: [
					{
						kind: 'hero',
						eyebrow: 'Careers',
						headline: 'Build software for on-site teams',
						text: 'Open roles in engineering, support and sales.',
						button: 'See open roles',
					},
					{
						kind: 'list',
						heading: 'Open roles',
						items: [
							['Support specialist, Akron', 'Six roles, from January'],
							['Senior engineer, mobile', 'Remote, Midwest'],
							['Account executive', 'Boulder'],
						],
					},
					{
						kind: 'text',
						heading: 'How we hire',
						body: '<p>A paid trial shift instead of a take-home test, and an honest talk at the end about how it went.</p>',
					},
					{
						kind: 'cta',
						headline: 'Not the right role yet?',
						text: 'Leave your email and we write when one opens.',
						button: 'Keep me posted',
						second: '',
					},
				],
			},
			{
				id: 'pg-contact',
				title: 'Contact Sales',
				path: '/contact',
				layout: 'Landing',
				owner: 'Reid Hollis',
				since: '2024-03-04',
				edited: '2026-09-11',
				visits: 2890,
				change: 4,
				exits: { 'Sent the contact form': 33, 'Booked a demo': 21, 'Opened Pricing': 10 },
				snippet: [
					'Contact Sales: talk to someone who knows on-site work',
					'Book a 30-minute call with our sales team to see Fieldline with your own visits, or ask about plans for teams of 50 seats or more.',
				],
				log: [
					['2026-09-11', 'Reid Hollis', 'Added the calendar to book a call'],
					['2026-08-25', 'Reid Hollis', 'Removed the phone number field'],
				],
				outline: [
					{
						kind: 'hero',
						eyebrow: 'Contact Sales',
						headline: 'Talk to someone who knows on-site work',
						text: 'Book a 30-minute call to see Fieldline with your own visits.',
						button: 'Book a call',
					},
					{
						kind: 'list',
						heading: 'On the call',
						items: [
							['Your visits', 'We load a week of your real work'],
							['Your questions', 'Pricing, rollout and training'],
							['No pressure', 'Thirty minutes, then it is up to you'],
						],
					},
					{
						kind: 'quote',
						quote: 'The call used our own Monday. That sold it.',
						name: 'Cameron Reid',
						role: 'Operations manager, Bluepeak Studios',
					},
					{
						kind: 'cta',
						headline: '50 seats or more?',
						text: 'Ask about Max.',
						button: 'Book a call',
						second: '',
					},
				],
			},
		],
		/* The agreements and the security page linked from the footer. */
		legal: [
			{
				id: 'pg-terms',
				title: 'Subscriber Terms',
				path: '/legal/terms',
				layout: 'Legal',
				owner: 'Sandra Barlow',
				since: '2024-03-04',
				edited: '2026-06-22',
				visits: 2050,
				change: 0,
				exits: { 'Opened Privacy Notice': 24, 'Signed up': 15, 'Left the site': 41 },
				snippet: [
					'Subscriber Terms | Fieldline',
					'The agreement between Fieldline and the businesses that use it: accounts, billing, acceptable use, data and how either side can end it.',
				],
				log: [
					['2026-06-22', 'Sandra Barlow', 'Updated the billing section for annual plans'],
					['2026-02-10', 'Sandra Barlow', 'Added the add-on terms'],
				],
				outline: [
					{
						kind: 'text',
						heading: 'Subscriber Terms',
						body: '<p>The agreement between Fieldline and the businesses that use it.</p><ul><li>Accounts and billing</li><li>Acceptable use</li><li>Your data</li><li>Ending the agreement</li></ul>',
					},
					{
						kind: 'text',
						heading: 'Add-on terms',
						body: '<p>Add-ons can be switched off at any time and stop at the end of that month.</p>',
					},
					{
						kind: 'text',
						heading: 'Billing',
						body: '<p>Plans are billed per seat, monthly or yearly. Yearly plans get two months free and renew on the same date each year.</p>',
					},
					{
						kind: 'faq',
						heading: 'Common questions',
						items: [
							[
								'Can we cancel a yearly plan early?',
								'Yes. Unused full months are refunded to the card on file.',
							],
							[
								'Who owns our data?',
								'You do. Export it at any time, and it is deleted 30 days after you leave.',
							],
						],
					},
				],
			},
			{
				id: 'pg-privacy',
				title: 'Privacy Notice',
				path: '/legal/privacy',
				layout: 'Legal',
				owner: 'Sandra Barlow',
				since: '2024-03-04',
				edited: '2026-06-22',
				visits: 1380,
				change: -1,
				exits: { 'Opened Subscriber Terms': 19, 'Opened Security': 14, 'Left the site': 44 },
				snippet: [
					'Privacy Notice | Fieldline',
					'What we collect about you and your customers, why, how long we keep it, who processes it for us and how to ask for a copy or deletion.',
				],
				log: [
					['2026-06-22', 'Sandra Barlow', 'Added our new email provider'],
					['2026-03-30', 'Sandra Barlow', 'Clarified location data from the app'],
				],
				outline: [
					{
						kind: 'text',
						heading: 'Privacy Notice',
						body: '<p>What we collect about you and your customers, why, and how long we keep it.</p>',
					},
					{
						kind: 'list',
						heading: 'Who processes data for us',
						items: [
							['Hosting', 'Oregon and Virginia'],
							['Email', 'Our email provider'],
							['Payments', 'Stripe'],
						],
					},
					{
						kind: 'text',
						heading: 'Your rights',
						body: '<p>Ask for a copy of your data, or for it to be deleted, from your account settings.</p>',
					},
				],
			},
			{
				id: 'pg-security',
				title: 'Security',
				path: '/security',
				layout: 'Legal',
				owner: 'Sandra Barlow',
				since: '2025-01-20',
				edited: '2026-05-14',
				visits: 940,
				change: 7,
				exits: {
					'Downloaded the SOC 2 summary': 31,
					'Opened Fieldline for Enterprise': 17,
					'Left the site': 29,
				},
				snippet: ['Security at Fieldline', 'How we keep your data safe.'],
				log: [
					['2026-05-14', 'Sandra Barlow', 'Added the SOC 2 Type II report'],
					['2026-02-02', 'Sandra Barlow', 'Listed our hosting regions'],
				],
				outline: [
					{
						kind: 'hero',
						eyebrow: 'Security',
						headline: 'How we keep your data safe',
						text: '',
						button: 'Download the SOC 2 summary',
					},
					{
						kind: 'list',
						heading: 'In place',
						items: [
							['SOC 2 Type II', 'Audited every year'],
							['Encryption', 'In transit and at rest'],
							['Access', 'Granted per ticket, removed when it closes'],
						],
					},
					{
						kind: 'text',
						heading: 'Where your data lives',
						body: '<p>Customers in the West are hosted in Oregon; everyone else in Virginia. Backups are restored as a test every month.</p>',
					},
					{
						kind: 'cta',
						headline: 'Found a problem?',
						text: 'Write to security@fieldline.app and we reply within one working day.',
						button: 'Report a problem',
						second: '',
					},
				],
			},
		],
	};

	/** Turns the drafts above into the records the pages read and publishes them. */
	function publishSitePages() {
		const records = areas.flatMap((area) => pagesByArea[area.id].map((draft) => toRecord(draft, area.id)));
		window.Basalt.data ||= {};
		window.Basalt.data.sitePages = { sections: areas, layouts, people, pages: records };
	}

	/**
	 * Expands one page draft into a full record: area and visibility filled in,
	 * exits as [label, percent] pairs, the log as [who, what, date] and every
	 * outline entry as a numbered block.
	 * @param {object} draft A page as written in pagesByArea.
	 * @param {string} area The id of the area it is filed under.
	 */
	function toRecord(draft, area) {
		const {
			since,
			exits,
			snippet: [seoTitle, seoText],
			log,
			outline,
			...page
		} = draft;
		const record = {
			...page,
			section: area,
			status: page.status ?? 'published',
			created: since,
			visits: page.visits ?? 0,
			seo: { title: seoTitle, desc: seoText },
			changes: log.map(([when, who, what]) => [who, what, when]),
			blocks: outline.map(toBlock),
			visibility: placement[area] === 'unlisted' ? 'unlisted' : 'public',
			inMenu: placement[area] === 'menu',
		};
		return exits ? { ...record, next: Object.entries(exits) } : record;
	}

	/** Splits an outline entry into the block shape the editor works with. */
	function toBlock({ kind, hidden = false, ...content }, index) {
		return { id: `b${index + 1}`, type: kind, hidden, data: content };
	}

	publishSitePages();
})();
