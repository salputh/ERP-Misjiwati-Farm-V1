/**
 * Fieldline's sales book: every deal, quote and lead that the sales
 * screens show. Leads, Lead Details, Deals, Deal Details, the Deal
 * Pipeline, Quotes and Quote Details all read it, so one deal keeps
 * its company, value, stage, close date, owner and contacts wherever
 * it turns up, and any link to it lands on the same record.
 *
 * Upsell deals belong to an existing customer and borrow most of their
 * facts (company, city, owner, stage, close date, contacts, next step)
 * from assets/basalt/js/data/multipurpose/accounts.js, which must load before this file.
 * That keeps them in step with Companies, Company Details and CRM.
 *
 * Published as window.Basalt.data.deals:
 *   stages, owners, sources, lostReasons, products   lookup tables
 *   list()          every deal, as a copy the page is free to edit
 *   find(id)        a deal by number (#2021) or by the slug of its
 *                   title (move-to-enterprise-at-22-seats); null if none
 *   yearly(d)       the yearly revenue a deal brings in
 *   quotes()        plan quotes followed by services quotes
 *   quote(id)       a single quote, or null
 *   leads()         every lead
 *   lead(id)        a single lead, or null
 *   ownerUrl(name)  where a teammate's profile lives on employee-user-details.html
 *
 * Pricing: plans bill once a year and a seat-year costs ten months
 * (Pro at $32 a seat a month comes to $320 a seat a year), add-ons bill
 * all twelve, and courses and set-up work are paid once. A real app
 * would fetch each page's slice from the server; these shapes are the
 * contract the pages are written against.
 */
(() => {
	'use strict';

	const accounts = window.Basalt.data?.accounts;
	const AS_OF = '2026-10-09';

	/* Each pipeline step, with the odds that a deal sitting there signs
     and the tone the sales pages paint it in. */
	const PIPELINE = [
		['discovery', 'Discovery', 10, 2],
		['proposal', 'Proposal', 30, 4],
		['negotiation', 'Negotiation', 60, 8],
		['signature', 'Out for signature', 90, 1],
		['signed', 'Signed', 100, 'won'],
	].map(([id, name, chance, tone]) => ({ id, name, chance, tone }));

	/* Fieldline sellers who can own a deal, mapped to the id of their
     profile on employee-user-details.html. */
	const SELLER_LOGINS = {
		'John Armstrong': 'ja',
		'Leslie Ashby': 'hb',
		'Quentin Cook': 'mb',
		'Tony Aldridge': 'ta',
		'Elise Vick': 'ev',
		'Thomas Morrison': 'mk',
		'Jeffrey McKay': 'rf',
	};
	const ORIGINS = [
		'Quarterly review',
		'Customer request',
		'Inbound request',
		'Referral',
		'Industry event',
		'Reseller partner',
		'Outbound',
	];
	const LOSS_CAUSES = [
		'Chose a cheaper tool',
		'Chose another tool',
		'Staying on paper for now',
		'No budget this year',
		'Went quiet',
	];

	/* The price list behind every deal line and quote line. On plans and
     add-ons (sub: true) price is one seat for a year and month is that
     seat for a month; on courses and set-up work it is one item. */
	const CATALOG = {
		'FL-STA': { name: 'Basic plan', icon: 'bi-person', tone: 2, price: 150, month: 15, months: 10, sub: true },
		'FL-GRO': { name: 'Pro plan', icon: 'bi-people', tone: 1, price: 320, month: 32, months: 10, sub: true },
		'FL-ENT': { name: 'Max plan', icon: 'bi-buildings', tone: 3, price: 580, month: 58, months: 10, sub: true },
		'FL-UPG': {
			name: 'Pro upgrade, per seat',
			icon: 'bi-arrow-up-circle',
			tone: 1,
			price: 170,
			month: 17,
			months: 10,
			sub: true,
		},
		'FL-UPE': {
			name: 'Max upgrade, per seat',
			icon: 'bi-arrow-up-circle',
			tone: 3,
			price: 260,
			month: 26,
			months: 10,
			sub: true,
		},
		'FL-ROUTE': {
			name: 'Travel Planner',
			icon: 'bi-signpost-split',
			tone: 5,
			price: 72,
			month: 6,
			months: 12,
			sub: true,
		},
		'FL-PORTAL': {
			name: 'Customer Portal',
			icon: 'bi-person-badge',
			tone: 6,
			price: 48,
			month: 4,
			months: 12,
			sub: true,
		},
		'FL-SMS': {
			name: 'SMS credits, 1,000 a month',
			icon: 'bi-chat-dots',
			tone: 4,
			unit: 'bundle',
			price: 300,
			month: 25,
			months: 12,
			sub: true,
		},
		'FL-TAB10': { name: 'Team Lead Course', icon: 'bi-mortarboard', tone: 1, price: 649, device: true },
		'FL-PH5': { name: 'Scheduler Course', icon: 'bi-calendar-week', tone: 1, price: 429, device: true },
		'FL-GPS': { name: 'Staff Onboarding', icon: 'bi-person-plus', tone: 2, price: 119 },
		'FL-PRN': { name: 'Custom Form Build', icon: 'bi-ui-checks', tone: 3, price: 189 },
		'FL-SCN': { name: 'Report Template', icon: 'bi-file-earmark-text', tone: 3, price: 149 },
		'FL-CRD': { name: 'Extra Phone Line', icon: 'bi-telephone', tone: 4, price: 59 },
		'FL-MNT': { name: 'Staff Profile Import', icon: 'bi-person-vcard', tone: 7, price: 49 },
		'FL-DCK': { name: 'Office Setup Call', icon: 'bi-headset', tone: 7, price: 89 },
		'FL-BAT': { name: 'Extra Storage, 10 GB', icon: 'bi-cloud-plus', tone: 8, price: 39 },
		'FL-ONB': { name: 'Onboarding Program', icon: 'bi-rocket-takeoff', tone: 2, price: 1200, service: true },
		'FL-TRN': { name: 'Live Training Session', icon: 'bi-easel', tone: 8, price: 350, service: true },
	};
	const SKU_BY_PLAN = { starter: 'FL-STA', growth: 'FL-GRO', enterprise: 'FL-ENT' };
	const PLAN_LABEL = { starter: 'Basic', growth: 'Pro', enterprise: 'Max' };

	/* Deal records, grouped by where they stand.
       id       deal number, the key every link carries
       acct     the customer an upsell is for; that account's deal of
                the same name supplies stage, close date, owner, people
                and next step
       kind     new, seats, upgrade or addon
       lines    recurring items as [sku, seats or bundles], priced a year
       oneOff   courses and set-up work billed once, as [sku, quantity]
       people   new customers only, as [name, job title, role in the deal]
       next     [next step, due date]
       history  [date, who, what happened, icon], latest first
       reached  when each stage was reached, where that is recorded
       quote    the quote sent for this deal
       lead     the lead this deal grew out of
       why      [icon, what they are after], for the unusual ones */
	const DEAL_SEEDS = [
		/* Upsells to customers we already have. */
		{
			id: '#2017',
			acct: 'lumoraai',
			name: 'Eight more carer seats',
			kind: 'seats',
			lines: [['FL-ENT', 8]],
			created: '2026-10-01',
			source: 'Customer request',
			quote: '#437',
			due: '2026-10-14',
			reached: { discovery: '2026-10-01', proposal: '2026-10-06', negotiation: '2026-10-07' },
			history: [
				['2026-10-07', 'Carla Malone', 'Opened the renewal quote for the second time.', 'eye'],
				['2026-10-06', 'Leslie Ashby', 'Sent the renewal quote for 94 seats on Max.', 'envelope'],
				['2026-10-01', 'Hailey Zimmerman', 'Asked to add eight carer seats at the renewal.', 'chat'],
			],
		},
		{
			id: '#2016',
			acct: 'lumoraai',
			name: 'Customer Portal for 86 seats',
			kind: 'addon',
			lines: [['FL-PORTAL', 86]],
			created: '2026-09-29',
			source: 'Quarterly review',
			quote: '#454',
			due: '2026-10-16',
			history: [
				['2026-10-02', 'Leslie Ashby', 'Sent the Customer Portal proposal for 86 seats.', 'envelope'],
				['2026-09-29', 'Leslie Ashby', 'Showed Dean the Customer Portal for the office team.', 'display'],
			],
		},
		{
			id: '#2015',
			acct: 'oakhaven',
			name: 'Customer Portal for all 64 seats',
			kind: 'addon',
			lines: [['FL-PORTAL', 64]],
			created: '2026-10-01',
			source: 'Customer request',
			due: '2026-10-16',
			history: [['2026-10-01', 'Quentin Cook', 'Demoed the Customer Portal to the care team.', 'display']],
		},
		{
			id: '#2021',
			acct: 'avocet',
			name: 'Move to Max at 22 seats',
			kind: 'upgrade',
			lines: [['FL-UPE', 22]],
			created: '2026-09-16',
			source: 'Quarterly review',
			quote: '#458',
			due: '2026-10-14',
			reached: { discovery: '2026-09-16', proposal: '2026-10-05' },
			why: [
				['bi-journal-check', 'Audit logs'],
				['bi-shield-lock', 'Single sign-on'],
				['bi-images', 'Visit photos kept 7 years'],
			],
			todo: [
				{ text: 'Follow up on the proposal with Addison', due: '2026-10-12' },
				{ text: 'Answer how long visit photos are kept', due: '2026-10-14' },
				{ text: 'Ask Chester for a purchase order number', due: '2026-10-21' },
				{ text: 'Send the Max proposal', due: '2026-10-05', done: true },
			],
			files: [
				['Max proposal.pdf', 421888, '2026-10-05'],
				['Security overview.pdf', 1258291, '2026-10-05'],
				['Plan comparison.xlsx', 38912, '2026-09-30'],
			],
			history: [
				['2026-10-07', 'Addison Brennan', 'Opened the proposal for the second time.', 'eye'],
				['2026-10-05', 'Tony Aldridge', 'Sent the Max proposal with audit logs and SSO.', 'envelope'],
				['2026-09-21', 'Addison Brennan', 'Asked how long visit photos are kept.', 'chat'],
				['2026-09-16', 'Tony Aldridge', 'Opened the deal after the quarterly review.', 'flag'],
			],
		},
		{
			id: '#2013',
			acct: 'highpoint',
			name: '12 seats for the Portsmouth branch',
			kind: 'seats',
			lines: [['FL-ENT', 12]],
			created: '2026-10-06',
			source: 'Quarterly review',
			due: '2026-10-23',
			history: [
				[
					'2026-10-08',
					'John Armstrong',
					'Portsmouth opens in January. Dan signs off the training by the 22nd.',
					'note',
				],
				[
					'2026-10-06',
					'John Armstrong',
					'Planned the renewal: a price for 12 more seats once Portsmouth opens.',
					'calendar',
				],
			],
		},
		{
			id: '#2019',
			acct: 'larchwood',
			name: 'Move to Pro at 12 seats',
			kind: 'upgrade',
			lines: [['FL-UPG', 12]],
			created: '2026-09-22',
			source: 'Customer request',
			quote: '#453',
			due: '2026-10-20',
			why: [
				['bi-arrow-repeat', 'Recurring shoots'],
				['bi-file-earmark-text', 'Quotes on the go'],
				['bi-ui-checks', 'Custom shoot forms'],
			],
			history: [
				['2026-10-02', 'Quentin Cook', 'Sent the Pro proposal before the renewal.', 'envelope'],
				['2026-09-22', 'Jordan Pike', 'Asked for recurring shoots and quotes.', 'chat'],
			],
		},
		{
			id: '#2026',
			acct: 'moorings',
			name: 'SMS credits, 10,000 a month',
			kind: 'addon',
			lines: [['FL-SMS', 10]],
			created: '2026-09-17',
			source: 'Customer request',
			quote: '#455',
			due: '2026-10-13',
			history: [
				['2026-10-03', 'John Armstrong', 'Quoted 10,000 SMS credits a month for visit reminders.', 'envelope'],
				['2026-09-17', 'Travis Teague', 'Reminders cut missed visits by a third.', 'chat'],
			],
		},
		{
			id: '#2023',
			acct: 'copperleaf',
			name: 'Customer Portal for 26 seats',
			kind: 'addon',
			lines: [['FL-PORTAL', 26]],
			created: '2026-10-04',
			source: 'Customer request',
			due: '2026-10-21',
			history: [['2026-10-04', 'Tony Aldridge', 'Introduced the Customer Portal to Leslie.', 'display']],
		},
		{
			id: '#2024',
			acct: 'brightline',
			name: 'Ten more photographer seats',
			kind: 'seats',
			lines: [['FL-GRO', 10]],
			created: '2026-09-26',
			source: 'Customer request',
			quote: '#459',
			due: '2026-10-16',
			history: [
				['2026-10-05', 'Thomas Morrison', 'Sent the order form for ten more seats.', 'envelope'],
				['2026-09-26', 'Amy Combs', 'Hiring ten assistants in November.', 'chat'],
			],
		},
		{
			id: '#2028',
			acct: 'polarair',
			name: 'Six more carer seats',
			kind: 'seats',
			lines: [['FL-GRO', 6]],
			created: '2026-09-23',
			source: 'Customer request',
			quote: '#440',
			due: '2026-10-13',
			history: [
				['2026-10-06', 'Thomas Morrison', 'Sent the renewal quote with six more seats.', 'envelope'],
				['2026-09-23', 'Derrick Yost', 'Two new home care contracts start in November.', 'chat'],
			],
		},
		{
			id: '#2009',
			acct: 'bluepeak',
			name: 'Customer Portal for 42 seats',
			kind: 'addon',
			lines: [['FL-PORTAL', 42]],
			created: '2026-09-10',
			source: 'Quarterly review',
			quote: '#462',
			due: '2026-10-14',
			history: [
				['2026-10-07', 'John Armstrong', 'Sent Rachel the Customer Portal order form.', 'envelope'],
				['2026-10-01', 'Pamela Rudd', 'A purchase order is needed before signing.', 'chat'],
				['2026-09-10', 'John Armstrong', 'Quarterly review with Rachel and Pamela.', 'calendar'],
			],
		},
		{
			id: '#2030',
			acct: 'solaris',
			name: 'Move to Max at 24 seats',
			kind: 'upgrade',
			lines: [['FL-UPE', 24]],
			created: '2026-10-02',
			source: 'Customer request',
			due: '2026-10-14',
			history: [
				['2026-10-02', 'Jeffrey McKay', 'Discovery call with Randall about audit logs and SSO.', 'calendar'],
			],
		},
		{
			id: '#2029',
			acct: 'millrace',
			name: 'Travel Planner for 28 seats',
			kind: 'addon',
			lines: [['FL-ROUTE', 28]],
			created: '2026-09-24',
			source: 'Customer request',
			quote: '#457',
			due: '2026-10-24',
			history: [
				['2026-10-03', 'Quentin Cook', 'Sent Tom a Travel Planner trial for the North Side crews.', 'envelope'],
				['2026-09-24', 'Tom Vance', 'Crews lose 40 minutes a day driving between offices.', 'chat'],
			],
		},
		{
			id: '#2027',
			acct: 'cornerstone',
			name: 'Travel Planner for 20 seats',
			kind: 'addon',
			lines: [['FL-ROUTE', 20]],
			created: '2026-09-30',
			source: 'Quarterly review',
			due: '2026-11-02',
			history: [
				[
					'2026-09-30',
					'Quentin Cook',
					'First call with Bill about Travel Planner for moving season.',
					'calendar',
				],
			],
		},
		{
			id: '#2032',
			acct: 'aspenhollow',
			name: 'Five more pet sitter seats',
			kind: 'seats',
			lines: [['FL-GRO', 5]],
			created: '2026-10-04',
			source: 'Customer request',
			due: '2026-10-28',
			history: [['2026-10-04', 'Floyd Snyder', 'Opening a branch in Wilmington next year.', 'chat']],
		},
		{
			id: '#2011',
			acct: 'ironbridge',
			name: 'Move to Pro at 9 seats',
			kind: 'upgrade',
			lines: [['FL-UPG', 9]],
			created: '2026-09-18',
			source: 'Customer request',
			closes: '2026-11-02',
			stage: 'lost',
			lost: '2026-10-05',
			lostFrom: 'proposal',
			reason: 'No budget this year',
			people: [['leon-marsh', 'Decided']],
			history: [
				['2026-10-05', 'Leon Marsh', 'Staying on Basic: Pro is over budget this year.', 'chat'],
				['2026-09-25', 'Tony Aldridge', 'Sent the Pro proposal.', 'envelope'],
			],
		},

		/* New business with the contract out for signature. */
		{
			id: '#2041',
			company: 'Granite Fell Climbing',
			city: 'Salt Lake City, UT',
			kind: 'new',
			plan: 'enterprise',
			seats: 80,
			stage: 'signature',
			closes: '2026-10-14',
			owner: 'John Armstrong',
			oneOff: [
				['FL-TAB10', 20],
				['FL-ONB', 1],
			],
			created: '2026-09-08',
			source: 'Inbound request',
			quote: '#447',
			today: 'Two tools that don’t talk to each other',
			people: [
				['Dana Holloway', 'Chief executive', 'Signs'],
				['Luke Garrity', 'Scheduling manager', 'Champion'],
			],
			next: ['Dana signs after Thursday’s board call.', '2026-10-09'],
			history: [
				['2026-10-07', 'Dana Holloway', 'Opened the contract twice.', 'eye'],
				['2026-10-06', 'John Armstrong', 'Sent the contract for signature.', 'pen'],
				['2026-09-29', 'John Armstrong', 'Agreed 80 seats and 20 lead courses on the call.', 'check'],
			],
		},
		{
			id: '#2038',
			company: 'Spillway Analytics Group',
			city: 'Tacoma, WA',
			kind: 'new',
			plan: 'growth',
			seats: 45,
			stage: 'signature',
			closes: '2026-10-16',
			owner: 'Leslie Ashby',
			oneOff: [
				['FL-SCN', 10],
				['FL-ONB', 1],
			],
			created: '2026-09-14',
			source: 'Referral',
			quote: '#448',
			today: 'Whiteboard and phone calls',
			people: [
				['Brooke Shepherd', 'Owner', 'Signs'],
				['Earl Duffy', 'Care manager', 'Champion'],
			],
			next: ['Brooke signs once her business partner has read it.', '2026-10-12'],
			history: [
				['2026-10-05', 'Leslie Ashby', 'Sent the contract for signature.', 'pen'],
				['2026-09-30', 'Brooke Shepherd', 'Agreed to start with 45 seats.', 'chat'],
			],
		},
		{
			id: '#2031',
			company: 'Redwood Vision AI',
			city: 'Sacramento, CA',
			kind: 'new',
			plan: 'growth',
			seats: 30,
			lines: [
				['FL-GRO', 30],
				['FL-ROUTE', 30],
			],
			stage: 'signature',
			closes: '2026-10-03',
			owner: 'Leslie Ashby',
			oneOff: [['FL-ONB', 1]],
			created: '2026-09-02',
			source: 'Industry event',
			quote: '#446',
			today: 'Visits planned by hand',
			people: [['Lance Bishop', 'General manager', 'Signs']],
			next: ['Lance hasn’t opened it since September 29. Call him.', '2026-10-08'],
			history: [
				['2026-09-29', 'Lance Bishop', 'Opened the contract once.', 'eye'],
				['2026-09-26', 'Leslie Ashby', 'Sent the contract for signature.', 'pen'],
				['2026-09-18', 'Leslie Ashby', 'Travel trial saved crews 35 minutes a day.', 'check'],
			],
		},

		/* New business still being negotiated. */
		{
			id: '#2036',
			company: 'Bayline Shoes',
			city: 'Syracuse, NY',
			kind: 'new',
			plan: 'enterprise',
			seats: 120,
			stage: 'negotiation',
			closes: '2026-11-27',
			owner: 'Quentin Cook',
			oneOff: [
				['FL-ONB', 1],
				['FL-TRN', 4],
			],
			created: '2026-09-08',
			source: 'Outbound',
			quote: '#444',
			today: 'An old booking system on one office PC',
			people: [
				['Erin Walsh', 'VP of operations', 'Signs'],
				['Stuart Riggs', 'IT director', 'Security review'],
			],
			next: ['Answer legal’s comments on the data terms.', '2026-10-19'],
			history: [
				['2026-10-06', 'Erin Walsh', 'Sent back legal’s comments on the data terms.', 'chat'],
				['2026-09-22', 'Quentin Cook', 'Sent the proposal for 120 seats on Max.', 'envelope'],
			],
		},
		{
			id: '#2033',
			company: 'Hartley & Sons Leather',
			city: 'Minot, ND',
			kind: 'new',
			plan: 'growth',
			seats: 40,
			stage: 'negotiation',
			closes: '2026-10-24',
			owner: 'Tony Aldridge',
			oneOff: [['FL-ONB', 1]],
			created: '2026-09-21',
			source: 'Inbound request',
			quote: '#449',
			today: 'Paper visit sheets',
			people: [
				['Graham Hartley', 'Owner', 'Signs'],
				['Kate Hartley', 'Office manager', 'Billing'],
			],
			next: ['Agree monthly billing for the first three months.', '2026-10-13'],
			history: [
				['2026-10-05', 'Graham Hartley', 'Asked for monthly billing to start.', 'chat'],
				['2026-09-30', 'Tony Aldridge', 'Sent the proposal for 40 seats.', 'envelope'],
			],
		},
		{
			id: '#2046',
			alias: ['ironbark-roofing'],
			company: 'Ironbark Bikes',
			city: 'Olympia, WA',
			kind: 'new',
			plan: 'growth',
			seats: 26,
			stage: 'negotiation',
			closes: '2026-10-28',
			owner: 'Thomas Morrison',
			created: '2026-09-15',
			source: 'Inbound request',
			quote: '#445',
			today: 'Spreadsheets and a shared calendar',
			people: [['Elsie Kerr', 'Operations manager', 'Signs']],
			next: ['Confirm the seat count before the contract goes out.', '2026-10-12'],
			history: [
				['2026-10-07', 'Thomas Morrison', 'Agreed a start date of November 2.', 'check'],
				['2026-10-01', 'Elsie Kerr', 'Accepted the proposal.', 'chat'],
				['2026-09-21', 'Thomas Morrison', 'Demo for the office team.', 'calendar'],
			],
		},
		{
			id: '#2043',
			company: 'Andes Outfitters',
			city: 'Macon, GA',
			kind: 'new',
			plan: 'growth',
			seats: 16,
			stage: 'negotiation',
			closes: '2026-10-23',
			owner: 'Jeffrey McKay',
			created: '2026-09-14',
			source: 'Inbound request',
			quote: '#443',
			today: 'WhatsApp groups per crew',
			people: [['Paula Voight', 'Operations manager', 'Signs']],
			next: ['Send the contract in Spanish.', '2026-10-12'],
			history: [
				['2026-10-05', 'Jeffrey McKay', 'Terms agreed; their lawyer is reading the contract.', 'check'],
				['2026-09-21', 'Paula Voight', 'Chose Pro over Max for now.', 'chat'],
			],
		},

		/* New business with a proposal in their hands. */
		{
			id: '#2040',
			company: 'Atlas Facility Services',
			city: 'Rockford, IL',
			kind: 'new',
			plan: 'enterprise',
			seats: 60,
			stage: 'proposal',
			closes: '2026-12-17',
			owner: 'Elise Vick',
			oneOff: [['FL-ONB', 1]],
			created: '2026-09-17',
			source: 'Inbound request',
			quote: '#450',
			lead: '#1044',
			today: 'Contracts tracked in spreadsheets',
			people: [
				['Javier Molina', 'Finance director', 'Signs'],
				['Luna Farmer', 'Head of operations', 'Champion'],
			],
			next: ['Present to the board on November 4.', '2026-11-04'],
			history: [
				['2026-10-01', 'Elise Vick', 'Sent the Max proposal for 60 seats.', 'envelope'],
				['2026-09-17', 'Luna Farmer', 'Asked for a Spanish workspace.', 'chat'],
			],
		},
		{
			id: '#2035',
			company: 'Swan River Photography',
			city: 'Chico, CA',
			kind: 'new',
			plan: 'growth',
			seats: 26,
			stage: 'proposal',
			closes: '2026-11-06',
			owner: 'Thomas Morrison',
			oneOff: [['FL-ONB', 1]],
			created: '2026-09-24',
			source: 'Inbound request',
			quote: '#452',
			lead: '#1049',
			today: 'Paper shoot forms',
			people: [['Ralph Morgan', 'Operations manager', 'Signs']],
			next: ['Demo the shoot forms to the two supervisors.', '2026-10-15'],
			history: [
				['2026-10-02', 'Thomas Morrison', 'Sent the proposal for 26 seats.', 'envelope'],
				['2026-09-24', 'Thomas Morrison', 'Turned Ralph’s lead into a deal.', 'flag'],
			],
		},
		{
			id: '#2039',
			company: 'Red Valley Gardens',
			city: 'Key West, FL',
			kind: 'new',
			plan: 'starter',
			seats: 15,
			stage: 'proposal',
			closes: '2026-10-28',
			owner: 'Jeffrey McKay',
			created: '2026-09-26',
			source: 'Inbound request',
			quote: '#456',
			today: 'A notebook in each car',
			people: [['Ike Quinlan', 'Founder', 'Signs']],
			next: ['Send the Spanish onboarding guide.', '2026-10-14'],
			history: [['2026-10-03', 'Jeffrey McKay', 'Sent the Basic proposal for 15 seats.', 'envelope']],
		},
		{
			id: '#2045',
			company: 'Westbrook Facilities',
			city: 'Atlanta, GA',
			kind: 'new',
			plan: 'enterprise',
			seats: 70,
			stage: 'proposal',
			closes: '2026-11-27',
			owner: 'John Armstrong',
			oneOff: [['FL-ONB', 1]],
			created: '2026-09-10',
			source: 'Outbound',
			quote: '#461',
			today: 'Three tools across three regions',
			people: [['Monica Hale', 'VP of operations', 'Signs']],
			next: ['Security review call with their IT team on October 16.', '2026-10-16'],
			history: [
				['2026-10-07', 'John Armstrong', 'Sent the Max proposal for 70 seats.', 'envelope'],
				['2026-09-22', 'John Armstrong', 'Two-hour workshop with the scheduling team.', 'calendar'],
			],
		},
		{
			id: '#2047',
			company: 'Lakewood Studio',
			city: 'Topeka, KS',
			kind: 'new',
			plan: 'enterprise',
			seats: 30,
			stage: 'proposal',
			closes: '2026-11-06',
			owner: 'Elise Vick',
			created: '2026-09-18',
			source: 'Reseller partner',
			quote: '#451',
			today: 'Paper visit sheets',
			people: [['Bethany Byrd', 'Managing director', 'Signs']],
			next: ['Answer the question on where data is hosted.', '2026-10-14'],
			history: [
				['2026-10-01', 'Elise Vick', 'Sent the proposal with hosting in the US.', 'envelope'],
				['2026-09-18', 'Bethany Byrd', 'Replacing paper visit sheets before winter.', 'chat'],
			],
		},
		{
			id: '#2048',
			alias: ['bluewater-electrical'],
			company: 'Bluewater Photography',
			city: 'Minot, ND',
			kind: 'new',
			plan: 'enterprise',
			seats: 82,
			stage: 'proposal',
			closes: '2026-10-19',
			owner: 'Elise Vick',
			created: '2026-09-10',
			source: 'Inbound request',
			quote: '#460',
			today: 'A booking tool they have outgrown',
			people: [['Tom Nugent', 'Studio manager', 'Signs']],
			next: ['Send the single sign-on set-up guide their IT asked for.', '2026-10-12'],
			history: [
				['2026-10-06', 'Elise Vick', 'Sent the Max proposal for 82 seats.', 'envelope'],
				['2026-09-28', 'Tom Nugent', 'Trial finished across both studios.', 'check'],
				['2026-09-10', 'Elise Vick', 'Started a 30-day trial.', 'flag'],
			],
		},

		/* New business at the discovery stage. */
		{
			id: '#2042',
			company: 'Vista Wash Co.',
			city: 'Topeka, KS',
			kind: 'new',
			plan: 'growth',
			seats: 18,
			stage: 'discovery',
			closes: '2026-12-10',
			owner: 'Elise Vick',
			created: '2026-10-05',
			source: 'Reseller partner',
			lead: '#1063',
			today: 'Paper visit sheets',
			people: [['Kathy Schultz', 'Managing director', 'Signs']],
			next: ['Show the winter rounds workflow.', '2026-10-22'],
			history: [['2026-10-05', 'Elise Vick', 'First call: 18 cleaners on paper visit sheets.', 'calendar']],
		},
		{
			id: '#2044',
			company: 'Harlow Photography',
			city: 'Cincinnati, OH',
			kind: 'new',
			plan: 'growth',
			seats: 22,
			stage: 'discovery',
			closes: '2027-01-20',
			owner: 'Elise Vick',
			created: '2026-10-02',
			source: 'Industry event',
			lead: '#1055',
			today: 'Shoots passed on by phone',
			people: [['Mara Kendall', 'Director', 'Signs']],
			next: ['Book a discovery call with the two site leads.', '2026-10-27'],
			history: [
				['2026-10-02', 'Elise Vick', 'Turned Mara’s lead from the Small Business Expo into a deal.', 'flag'],
			],
		},
		{
			id: '#2049',
			company: 'Palmetto Pools',
			city: 'Charleston, SC',
			kind: 'new',
			plan: 'growth',
			seats: 22,
			stage: 'discovery',
			closes: '2026-12-04',
			owner: 'Leslie Ashby',
			created: '2026-10-03',
			source: 'Inbound request',
			today: 'Weekly rounds on paper',
			people: [['Gina Carlson', 'Owner', 'Signs']],
			next: ['Set up a trial workspace for two crews.', '2026-10-15'],
			history: [
				['2026-10-05', 'Leslie Ashby', 'First call: 22 pool cleaners across three counties.', 'calendar'],
				['2026-10-03', 'Gina Carlson', 'Asked for a demo through the website.', 'chat'],
			],
		},
		{
			id: '#2050',
			company: 'Sunridge Tutors',
			city: 'Bellingham, WA',
			kind: 'new',
			plan: 'growth',
			seats: 26,
			stage: 'discovery',
			closes: '2027-01-22',
			owner: 'Thomas Morrison',
			created: '2026-10-06',
			source: 'Industry event',
			today: 'Lessons booked in a spreadsheet',
			people: [['Forrest Walsh', 'Operations manager', 'Signs']],
			next: ['Discovery call on October 14.', '2026-10-14'],
			history: [
				['2026-10-06', 'Thomas Morrison', 'Met Forrest at the Small Business Expo in Bellingham.', 'calendar'],
			],
		},

		/* Won this quarter. */
		{
			id: '#2034',
			company: 'Buckeye Print Co.',
			city: 'Columbus, OH',
			kind: 'new',
			plan: 'enterprise',
			seats: 50,
			stage: 'signed',
			signed: '2026-10-07',
			closes: '2026-10-10',
			owner: 'John Armstrong',
			oneOff: [
				['FL-TAB10', 10],
				['FL-ONB', 1],
			],
			created: '2026-08-24',
			source: 'Inbound request',
			today: 'Paper visit sheets',
			afterWin: 'Kick-off call with Shelby on October 13.',
			people: [['Shelby Kessler', 'Chief operating officer', 'Signed']],
			history: [
				['2026-10-07', 'Shelby Kessler', 'Signed the contract.', 'pen'],
				['2026-10-02', 'John Armstrong', 'Sent the contract for signature.', 'pen'],
			],
		},
		{
			id: '#2037',
			company: 'Brookfield Bakehouse',
			city: 'Dayton, OH',
			kind: 'new',
			plan: 'growth',
			seats: 24,
			stage: 'signed',
			signed: '2026-10-05',
			closes: '2026-10-09',
			owner: 'Tony Aldridge',
			oneOff: [['FL-ONB', 1]],
			created: '2026-09-01',
			source: 'Referral',
			today: 'Paper visit sheets',
			afterWin: 'Training for the office team on October 15.',
			people: [['Nicole Kelly', 'Managing director', 'Signed']],
			history: [
				['2026-10-05', 'Nicole Kelly', 'Signed the contract.', 'pen'],
				['2026-09-30', 'Tony Aldridge', 'Sent the contract for signature.', 'pen'],
			],
		},
		{
			id: '#2014',
			company: 'Sentinel Fire & Safety',
			city: 'Pittsburgh, PA',
			kind: 'new',
			plan: 'enterprise',
			seats: 34,
			stage: 'signed',
			signed: '2026-10-08',
			closes: '2026-10-08',
			owner: 'Leslie Ashby',
			created: '2026-08-18',
			source: 'Outbound',
			today: 'Inspection reports in Word',
			afterWin: 'Kick-off call on October 12.',
			people: [['Mark Dwyer', 'Operations director', 'Signed']],
			history: [
				['2026-10-08', 'Mark Dwyer', 'Signed a one-year contract for 34 seats.', 'pen'],
				['2026-09-24', 'Leslie Ashby', 'Sent the final contract.', 'pen'],
			],
		},
		{
			id: '#2018',
			company: 'Hollis Dog Walking',
			city: 'Omaha, NE',
			kind: 'new',
			plan: 'growth',
			seats: 12,
			stage: 'signed',
			signed: '2026-10-02',
			closes: '2026-10-02',
			owner: 'Quentin Cook',
			created: '2026-09-09',
			source: 'Inbound request',
			today: 'A paper diary',
			afterWin: 'Import their 3,800 customer addresses.',
			people: [['Ray Hollis', 'Owner', 'Signed']],
			history: [
				['2026-10-02', 'Ray Hollis', 'Signed the order form and paid by card.', 'pen'],
				['2026-09-28', 'Quentin Cook', 'Sent the order form.', 'envelope'],
			],
		},
		{
			id: '#2020',
			company: 'Fairway Irrigation',
			city: 'Boise, ID',
			kind: 'new',
			plan: 'growth',
			seats: 20,
			stage: 'signed',
			signed: '2026-10-06',
			closes: '2026-10-10',
			owner: 'Tony Aldridge',
			created: '2026-09-11',
			source: 'Referral',
			today: 'Spreadsheets',
			afterWin: 'Training for the booking office on October 14.',
			people: [['Holly Barnes', 'Managing director', 'Signed']],
			history: [
				['2026-10-06', 'Holly Barnes', 'Signed four days early to start before spring planning.', 'pen'],
				['2026-09-30', 'Tony Aldridge', 'Agreed the start date.', 'check'],
			],
		},

		/* Lost this quarter, with the reason they gave. */
		{
			id: '#2025',
			company: 'Valley Denim Co.',
			city: 'Fresno, CA',
			kind: 'new',
			plan: 'growth',
			seats: 35,
			stage: 'lost',
			lost: '2026-10-06',
			lostFrom: 'proposal',
			reason: 'Chose a cheaper tool',
			closes: '2026-10-20',
			owner: 'Quentin Cook',
			created: '2026-09-12',
			source: 'Inbound request',
			today: 'A cheaper scheduling app',
			people: [['Gary Dunn', 'Owner', 'Decided']],
			history: [
				['2026-10-06', 'Gary Dunn', 'Went with a cheaper tool for this year.', 'chat'],
				['2026-09-25', 'Quentin Cook', 'Sent the proposal for 35 seats.', 'envelope'],
			],
		},
		{
			id: '#2012',
			company: 'Crestline Movers',
			city: 'Tulsa, OK',
			kind: 'new',
			plan: 'growth',
			seats: 25,
			stage: 'lost',
			lost: '2026-10-03',
			lostFrom: 'proposal',
			reason: 'Chose another tool',
			closes: '2026-10-20',
			owner: 'Quentin Cook',
			created: '2026-09-04',
			source: 'Outbound',
			today: 'The tool their supplier bundles in',
			people: [['Dale Spencer', 'Owner', 'Decided']],
			history: [
				['2026-10-03', 'Dale Spencer', 'Went with a tool their supplier bundles in.', 'chat'],
				['2026-09-19', 'Quentin Cook', 'Sent the Pro proposal.', 'envelope'],
			],
		},
		{
			id: '#2022',
			company: 'Seaside Pools',
			city: 'Santa Cruz, CA',
			kind: 'new',
			plan: 'starter',
			seats: 10,
			stage: 'lost',
			lost: '2026-10-03',
			lostFrom: 'discovery',
			reason: 'Staying on paper for now',
			closes: '2026-11-01',
			owner: 'Thomas Morrison',
			created: '2026-09-20',
			source: 'Inbound request',
			today: 'Paper visit cards',
			people: [['Tina Reilly', 'Owner', 'Decided']],
			history: [['2026-10-03', 'Tina Reilly', 'Staying on paper visit cards for the summer.', 'chat']],
		},
	];

	/* Plan quotes are sent for a deal or a renewal and price the plan,
     its add-ons and any one-off work for the first year. Services
     quotes price Fieldline courses and set-up work for one customer and
     turn into a purchase when accepted. The two share one number range.
     Timestamps are local "YYYY-MM-DD HH:MM", views lists each time the
     buyer opened the quote, and valid counts the days the prices hold. */
	const PLAN_QUOTE_SEEDS = [
		{
			id: '#429',
			acct: 'redline',
			renewal: true,
			status: 'accepted',
			sent: '2026-09-24 14:00',
			views: ['2026-09-25 08:30'],
			closed: '2026-10-01 11:15',
		},
		{
			id: '#437',
			deal: '#2017',
			renewal: true,
			sent: '2026-10-06 10:20',
			views: ['2026-10-06 15:10', '2026-10-07 11:25'],
		},
		{ id: '#440', deal: '#2028', renewal: true, sent: '2026-10-06 09:30', views: [] },
		{ id: '#443', deal: '#2043', sent: '2026-09-21 16:00', views: ['2026-09-22 09:10', '2026-10-05 10:30'] },
		{ id: '#444', deal: '#2036', sent: '2026-09-22 11:00', views: ['2026-09-24 14:20', '2026-10-06 09:45'] },
		{ id: '#445', deal: '#2046', sent: '2026-09-24 17:30', views: ['2026-09-25 08:15', '2026-10-01 10:05'] },
		{ id: '#446', deal: '#2031', sent: '2026-09-26 10:00', views: ['2026-09-29 08:40'] },
		{
			id: '#447',
			deal: '#2041',
			sent: '2026-09-29 15:30',
			views: ['2026-09-30 09:00', '2026-10-07 08:50', '2026-10-07 17:20'],
		},
		{ id: '#448', deal: '#2038', sent: '2026-09-30 10:15', views: ['2026-09-30 13:40', '2026-10-05 16:00'] },
		{ id: '#449', deal: '#2033', sent: '2026-09-30 14:00', views: ['2026-10-01 09:20', '2026-10-05 08:55'] },
		{ id: '#450', deal: '#2040', sent: '2026-10-01 09:00', views: ['2026-10-02 11:30'] },
		{ id: '#451', deal: '#2047', sent: '2026-10-01 13:45', views: ['2026-10-03 10:10'] },
		{ id: '#452', deal: '#2035', sent: '2026-10-02 10:30', views: [] },
		{ id: '#453', deal: '#2019', sent: '2026-10-02 16:00', views: ['2026-10-05 09:40'] },
		{ id: '#454', deal: '#2016', sent: '2026-10-02 11:20', views: ['2026-10-03 08:30'] },
		{ id: '#455', deal: '#2026', sent: '2026-10-03 09:30', views: ['2026-10-03 12:10'] },
		{ id: '#456', deal: '#2039', sent: '2026-10-03 15:00', views: [] },
		{ id: '#457', deal: '#2029', sent: '2026-10-03 11:00', views: ['2026-10-04 08:20'] },
		{ id: '#458', deal: '#2021', sent: '2026-10-05 10:40', views: ['2026-10-06 09:15', '2026-10-07 14:30'] },
		{ id: '#459', deal: '#2024', sent: '2026-10-05 08:30', views: ['2026-10-06 07:50'] },
		{ id: '#460', deal: '#2048', sent: '2026-10-06 15:20', views: [] },
		{ id: '#461', deal: '#2045', sent: '2026-10-07 10:00', views: [] },
		{ id: '#462', deal: '#2009', sent: '2026-10-07 13:10', views: ['2026-10-08 09:05'] },
	];

	/* Fieldline staff who sell services, keyed by the id the quotes use. */
	const SERVICE_REPS = {
		reid: { name: 'Reid Hollis', role: 'Head of Services Sales', tone: 1 },
		paige: { name: 'Paige Drake', role: 'Solutions Advisor', tone: 3 },
		neal: { name: 'Neal Carson', role: 'Account Manager', tone: 2 },
		brittany: { name: 'Brittany Fenn', role: 'Solutions Advisor', tone: 4 },
	};
	/* Buying terms per customer: who orders services, the tax their
     invoices carry, and whether they pay by card or on invoice (days). */
	const BUYING_TERMS = {
		lumoraai: { buyer: 'hailey-zimmerman', tax: ['Colorado sales tax 2.9%', 0.029], terms: 30, tone: 1 },
		oakhaven: { buyer: 'connie-nandakumar', tax: ['Connecticut sales tax 6.35%', 0.0635], terms: 30, tone: 2 },
		avocet: { buyer: 'chester-doyle', tax: ['Minnesota sales tax 6.875%', 0.06875], terms: 30, tone: 3 },
		highpoint: { buyer: 'connie-sexton', tax: ['No sales tax in New Hampshire', 0], terms: 30, tone: 4 },
		lakeside: {
			buyer: 'gerald-gallagher',
			tax: ['Minnesota sales tax 6.875%', 0.06875],
			terms: 'card',
			card: 'Amex ending 1007',
			tone: 5,
		},
		brightline: {
			buyer: 'amy-combs',
			tax: ['Washington sales tax 6.5%', 0.065],
			terms: 'card',
			card: 'Visa ending 2864',
			tone: 6,
		},
		ironbridge: { buyer: 'kerry-wade', tax: ['North Dakota sales tax 5%', 0.05], terms: 30, tone: 7 },
		larchwood: {
			buyer: 'sasha-klein',
			tax: ['No sales tax in Oregon', 0],
			terms: 'card',
			card: 'Visa ending 5521',
			tone: 8,
		},
		moorings: { buyer: 'travis-teague', tax: ['Florida sales tax 6%', 0.06], terms: 30, tone: 2 },
		polarair: {
			buyer: 'li-wen-tan',
			tax: ['Arizona sales tax 5.6%', 0.056],
			terms: 'card',
			card: 'Mastercard ending 6034',
			tone: 3,
		},
		bluepeak: { buyer: 'pamela-rudd', tax: ['Colorado sales tax 2.9%', 0.029], terms: 30, tone: 4 },
		cedarfell: {
			buyer: 'gerald-pruitt',
			tax: ['North Carolina sales tax 4.75%', 0.0475],
			terms: 'card',
			card: 'Visa ending 7710',
			tone: 5,
		},
		copperleaf: { buyer: 'leslie-price', tax: ['Iowa sales tax 6%', 0.06], terms: 30, tone: 6 },
		millrace: { buyer: 'tom-vance', tax: ['Illinois sales tax 6.25%', 0.0625], terms: 30, tone: 7 },
		rainier: { buyer: 'jacob-becker', tax: ['Michigan sales tax 6%', 0.06], terms: 30, tone: 8 },
		tidewater: {
			buyer: 'ian-macleod',
			tax: ['New York sales tax 4%', 0.04],
			terms: 'card',
			card: 'Mastercard ending 2290',
			tone: 1,
		},
	};
	/* Services quotes, newest number first. An accepted quote that became
     a purchase carries that purchase number from the customer's orders. */
	const SERVICE_QUOTE_SEEDS = [
		{
			id: '#442',
			acct: 'highpoint',
			to: 'dan-mercer',
			rep: 'reid',
			status: 'sent',
			sent: '2026-10-02 10:30',
			valid: 20,
			views: ['2026-10-02 14:05', '2026-10-06 09:20'],
			lines: [
				['FL-TAB10', 12],
				['FL-MNT', 12],
				['FL-GPS', 12],
			],
			note: 'Dan, here are the 12 starter packs for the Portsmouth branch: a course, an import and onboarding for each person.',
		},
		{
			id: '#433',
			acct: 'ironbridge',
			rep: 'neal',
			status: 'draft',
			edited: '2026-10-08 16:40',
			valid: 30,
			lines: [
				['FL-PH5', 9],
				['FL-CRD', 9],
				['FL-TRN', 1],
			],
		},
		{
			id: '#432',
			acct: 'lakeside',
			rep: 'brittany',
			status: 'draft',
			edited: '2026-10-08 11:15',
			valid: 14,
			lines: [
				['FL-PH5', 10],
				['FL-CRD', 10],
			],
		},
		{
			id: '#431',
			acct: 'lumoraai',
			rep: 'reid',
			status: 'sent',
			sent: '2026-10-07 11:05',
			valid: 30,
			views: ['2026-10-07 15:40', '2026-10-08 09:12'],
			lines: [
				['FL-TAB10', 24],
				['FL-MNT', 24],
				['FL-DCK', 6],
			],
			versions: [
				{
					n: 1,
					saved: '2026-10-05 10:30',
					summary: '20 courses with imports',
					lines: [
						['FL-TAB10', 20],
						['FL-MNT', 20],
					],
					note: 'Hailey, here are the courses and imports for the new care teams we discussed on Friday.',
				},
				{
					n: 2,
					saved: '2026-10-06 16:20',
					summary: '4 more courses, 6 office set-up calls added',
					lines: [
						['FL-TAB10', 24],
						['FL-MNT', 24],
						['FL-DCK', 6],
					],
					note: 'Hailey, as discussed: 24 courses for the new care teams, with imports, and six set-up calls for the Boulder and Boulder offices.',
				},
			],
		},
		{
			id: '#430',
			acct: 'larchwood',
			rep: 'paige',
			status: 'sent',
			sent: '2026-10-05 14:30',
			valid: 14,
			views: [],
			lines: [
				['FL-PH5', 8],
				['FL-CRD', 8],
				['FL-BAT', 8],
			],
		},
		{
			id: '#428',
			acct: 'avocet',
			rep: 'reid',
			status: 'accepted',
			sent: '2026-10-02 10:00',
			valid: 14,
			views: ['2026-10-02 14:20', '2026-10-07 09:05'],
			closed: '2026-10-07 14:50',
			order: '#477',
			lines: [['FL-CRD', 4]],
		},
		{
			id: '#426',
			acct: 'polarair',
			rep: 'brittany',
			status: 'sent',
			sent: '2026-10-01 09:40',
			valid: 14,
			views: ['2026-10-02 08:15'],
			reminders: ['2026-10-08 09:00'],
			lines: [
				['FL-GPS', 12],
				['FL-TRN', 1],
			],
		},
		{
			id: '#425',
			acct: 'highpoint',
			rep: 'paige',
			status: 'accepted',
			sent: '2026-10-01 15:00',
			valid: 14,
			views: ['2026-10-02 09:00', '2026-10-06 16:30'],
			closed: '2026-10-07 08:20',
			order: '#474',
			lines: [['FL-SCN', 4]],
		},
		{
			id: '#424',
			acct: 'cedarfell',
			rep: 'neal',
			status: 'sent',
			sent: '2026-09-28 16:10',
			valid: 14,
			views: ['2026-09-29 08:30', '2026-10-05 11:02', '2026-10-08 17:45'],
			reminders: ['2026-10-05 09:00'],
			lines: [
				['FL-TAB10', 6],
				['FL-PRN', 3],
				['FL-SCN', 3],
			],
		},
		{
			id: '#423',
			acct: 'rainier',
			rep: 'neal',
			status: 'accepted',
			sent: '2026-09-30 11:00',
			valid: 30,
			views: ['2026-10-01 08:40', '2026-10-06 13:15'],
			closed: '2026-10-07 16:05',
			lines: [
				['FL-TAB10', 8],
				['FL-GPS', 8],
				['FL-MNT', 8],
			],
		},
		{
			id: '#422',
			acct: 'copperleaf',
			rep: 'brittany',
			status: 'declined',
			sent: '2026-09-28 09:30',
			valid: 14,
			views: ['2026-09-28 13:10', '2026-10-02 10:25'],
			closed: '2026-10-06 14:20',
			reason: 'Chose a cheaper course',
			lines: [
				['FL-TAB10', 15],
				['FL-MNT', 15],
			],
		},
		{
			id: '#421',
			acct: 'moorings',
			rep: 'reid',
			status: 'sent',
			sent: '2026-09-24 15:00',
			valid: 30,
			views: ['2026-09-25 10:10'],
			lines: [
				['FL-TAB10', 12],
				['FL-MNT', 12],
				['FL-ONB', 1],
			],
		},
		{
			id: '#420',
			acct: 'oakhaven',
			rep: 'reid',
			status: 'accepted',
			sent: '2026-09-29 13:30',
			valid: 14,
			views: ['2026-09-30 08:05'],
			closed: '2026-10-08 08:40',
			order: '#478',
			lines: [['FL-TAB10', 6]],
		},
		{
			id: '#419',
			acct: 'brightline',
			rep: 'paige',
			status: 'sent',
			sent: '2026-09-25 10:30',
			valid: 14,
			views: ['2026-09-26 12:00'],
			reminders: ['2026-10-06 09:00'],
			lines: [
				['FL-SCN', 10],
				['FL-PRN', 4],
			],
		},
		{
			id: '#418',
			acct: 'millrace',
			rep: 'paige',
			status: 'expired',
			sent: '2026-09-20 10:00',
			valid: 14,
			views: ['2026-09-21 09:00'],
			reminders: ['2026-09-30 09:00'],
			lines: [
				['FL-SCN', 6],
				['FL-PRN', 2],
			],
		},
		{
			id: '#416',
			acct: 'bluepeak',
			rep: 'brittany',
			status: 'accepted',
			sent: '2026-09-22 14:00',
			valid: 30,
			views: ['2026-09-23 10:45', '2026-10-01 11:10'],
			closed: '2026-10-05 12:40',
			order: '#469',
			lines: [
				['FL-GPS', 4],
				['FL-MNT', 4],
			],
		},
		{
			id: '#414',
			acct: 'tidewater',
			rep: 'neal',
			status: 'declined',
			sent: '2026-09-16 14:15',
			valid: 30,
			views: ['2026-09-17 09:30'],
			closed: '2026-09-30 11:10',
			reason: 'Budget moved to next year',
			lines: [
				['FL-PH5', 12],
				['FL-CRD', 12],
				['FL-TRN', 1],
			],
		},
	];

	/* Leads: businesses that have shown interest but do not pay yet.
       fit      a 0 to 100 match with the plans, plus the reason
       reply    minutes until the first answer; via names the referrer
       reasons  what speaks for them (good: true) and what to watch for
       next     the step planned for a lead that is still open
       trial    on a trial: per-day visits as [date, scheduled, done],
                the number of people who signed in, and what "done"
                counts for this team
       deal     what a converted lead turned into
       history  [when, who, what, icon, message text], earliest first */
	const LEAD_RECORDS = [
		{
			id: '#1088',
			name: 'Renee Calloway',
			title: 'Care Manager',
			company: 'Briarwood Studio',
			city: 'Raleigh, NC',
			email: 'renee.calloway@briarwoodstudio.com',
			phone: '+1 919 555 0143',
			source: 'website',
			stage: 'new',
			fit: 88,
			why: '26 carers across two offices, all booked by phone today.',
			plan: 'growth',
			seats: 26,
			addons: ['route'],
			owner: '',
			received: '2026-10-08T12:10',
			message: '26 carers across two offices, all booked by phone. Could you show us how scheduling would work?',
			reasons: [
				{ good: true, title: 'Right size.', text: '26 carers sits well inside Pro.' },
				{
					good: true,
					title: 'Clear need.',
					text: 'Phone booking across two offices is what the schedule and Travel Planner fix.',
				},
				{ good: false, title: 'Two offices.', text: 'Check whether each office plans its own day.' },
			],
			next: {
				what: 'Reply with a schedule demo',
				note: 'Show both offices on one board.',
				date: '2026-10-08',
				time: '16:00',
			},
			history: [['2026-10-08T12:10', 'Renee Calloway', 'Sent the website form.', 'form']],
		},
		{
			id: '#1087',
			name: 'Megan Doyle',
			title: 'Scheduler',
			company: 'Blue Ridge Cycles',
			city: 'Asheville, NC',
			email: 'megan@blueridgecycles.com',
			phone: '+1 828 555 0172',
			source: 'search',
			stage: 'new',
			fit: 54,
			why: 'Eleven dog walkers. Asked about the price before the features.',
			plan: 'starter',
			seats: 11,
			addons: [],
			owner: '',
			received: '2026-10-08T13:55',
			message:
				'What would it cost for 11 dog walkers? We mostly need a shared calendar and visit notes on the phone.',
			reasons: [
				{ good: true, title: 'Simple need.', text: 'A shared calendar and visit notes are all in Basic.' },
				{ good: false, title: 'Price first.', text: 'She asked about cost before the features.' },
				{ good: false, title: 'Not the one who signs.', text: 'Megan schedules; find out who decides.' },
			],
			next: {
				what: 'Reply with Basic pricing',
				note: 'Include the shared calendar tour.',
				date: '2026-10-08',
				time: '16:30',
			},
			history: [['2026-10-08T13:55', 'Megan Doyle', 'Asked for prices from the search ad.', 'form']],
		},
		{
			id: '#1085',
			name: 'Melvin Thornton',
			title: 'Owner',
			company: 'Glint Photography',
			city: 'Memphis, TN',
			email: 'melvin@glintphotography.com',
			phone: '+1 901 555 0185',
			source: 'search',
			stage: 'new',
			fit: 61,
			why: 'Nine photographers on small home shoots. Wants to pay in reais.',
			plan: 'starter',
			seats: 9,
			addons: [],
			owner: 'Jeffrey McKay',
			received: '2026-10-08T09:40',
			message:
				'Nine photographers on small home shoots. Is there a plan without travel planning, and can you bill us in reais?',
			reasons: [
				{ good: true, title: 'Fits Basic.', text: 'Small home shoots, no travel planning needed.' },
				{ good: false, title: 'Currency.', text: 'Wants to be billed in reais.' },
			],
			next: {
				what: 'Reply about billing in reais',
				note: 'Check with finance first.',
				date: '2026-10-09',
				time: '10:00',
			},
			history: [['2026-10-08T09:40', 'Melvin Thornton', 'Asked about plans from the search ad.', 'form']],
		},
		{
			id: '#1081',
			name: 'Harvey Reid',
			title: 'Operations Director',
			company: 'Bulwark Movers',
			city: 'Mankato, MN',
			email: 'h.reid@bulwarkmovers.com',
			phone: '+1 507 555 0181',
			source: 'event',
			via: 'Small Business Expo',
			stage: 'new',
			fit: 79,
			why: '34 movers and three supervisors. Met the team at the expo.',
			plan: 'growth',
			seats: 34,
			addons: [],
			owner: 'Tony Aldridge',
			received: '2026-10-07T16:25',
			message: 'Good to meet you at the Small Business Expo. We would like a demo for our three supervisors.',
			reasons: [
				{ good: true, title: 'Right size.', text: '34 movers fits Pro well.' },
				{ good: true, title: 'Warm start.', text: 'He met the team at the expo and asked for a demo.' },
				{ good: false, title: 'Three people decide.', text: 'Get all three supervisors on the demo.' },
			],
			next: {
				what: 'Book a demo for the supervisors',
				note: 'All three on one call.',
				date: '2026-10-09',
				time: '11:00',
			},
			history: [
				['2026-10-07T16:25', 'Harvey Reid', 'Left his details at the Small Business Expo stand.', 'event'],
			],
		},
		{
			id: '#1079',
			name: 'Howard Mack',
			title: 'Office Manager',
			company: 'Keystone Ceramics',
			city: 'Provo, UT',
			email: 'h.mack@keystoneceramics.com',
			phone: '+1 801 555 0179',
			source: 'referral',
			via: 'Polaris Running Co. Group',
			stage: 'contacted',
			fit: 72,
			why: '14 staff on site. Customers should book their own inspections.',
			plan: 'growth',
			seats: 14,
			addons: ['portal'],
			owner: 'Thomas Morrison',
			reply: 140,
			received: '2026-10-06T02:30',
			message:
				'Polaris told us about Fieldline. We want customers to book their own inspections online. Is that possible?',
			reasons: [
				{ good: true, title: 'Clear need.', text: 'Self-booking is what the Customer Portal does.' },
				{ good: true, title: 'Referred.', text: 'Polaris Running Co. Group is a happy customer.' },
				{ good: false, title: 'Who signs?', text: 'Ask who approves the budget.' },
			],
			next: {
				what: 'Show the booking page on a call',
				note: 'Customers book their own inspections.',
				date: '2026-10-09',
				time: '09:00',
			},
			history: [
				['2026-10-06T02:30', 'Howard Mack', 'Sent the website form.', 'form'],
				[
					'2026-10-06T04:50',
					'Thomas Morrison',
					'Sent the Pro price sheet and a Customer Portal video.',
					'email',
				],
			],
		},
		{
			id: '#1076',
			name: 'Charles Mosley',
			title: 'Care Coordinator',
			company: 'Desert Sun Solar',
			city: 'Tucson, AZ',
			email: 'cmendez@desertsunsolar.com',
			phone: '+1 520 555 0176',
			source: 'website',
			stage: 'contacted',
			fit: 69,
			why: '22 carers. Decision after the summer season.',
			plan: 'growth',
			seats: 22,
			addons: [],
			owner: 'Leslie Ashby',
			reply: 55,
			received: '2026-10-05T18:20',
			message: 'Summer is our busy season and we lose track of visits. Can carers see their day on a phone?',
			reasons: [
				{ good: true, title: 'Phone first.', text: 'Each carer’s day on a phone is the heart of Pro.' },
				{ good: false, title: 'Timing.', text: 'No decision until the summer season ends.' },
			],
			next: {
				what: 'Check in after the season',
				note: 'They decide once summer ends.',
				date: '2026-10-20',
				time: '10:00',
			},
			history: [
				['2026-10-05T18:20', 'Charles Mosley', 'Sent the website form.', 'form'],
				['2026-10-05T19:15', 'Leslie Ashby', 'Replied with the mobile app tour.', 'email'],
				['2026-10-07T10:30', 'Leslie Ashby', 'Call: they decide once the season ends.', 'call'],
			],
		},
		{
			id: '#1072',
			name: 'Candace Hartnett',
			title: 'General Manager',
			company: 'Bluegum Pools',
			city: 'Cheyenne, WY',
			email: 'candace@bluegumpools.com',
			phone: '+1 307 555 0172',
			source: 'webinar',
			stage: 'contacted',
			fit: 58,
			why: '12 staff, 400 pools a week on repeat visits.',
			plan: 'starter',
			seats: 12,
			addons: [],
			owner: 'Thomas Morrison',
			reply: 180,
			received: '2026-10-02T09:10',
			message:
				'Watched the scheduling webinar. We service 400 pools a week with 12 staff. Does Basic handle repeat visits?',
			reasons: [
				{ good: true, title: 'Repeat visits.', text: 'Basic handles weekly rounds.' },
				{ good: false, title: 'Busy rounds.', text: '400 visits a week may need Travel Planner.' },
			],
			next: {
				what: 'Send a repeat-visit example',
				note: 'Weekly rounds for 400 pools.',
				date: '2026-10-10',
				time: '09:00',
			},
			history: [
				['2026-10-02T09:10', 'Candace Hartnett', 'Asked a question after the scheduling webinar.', 'webinar'],
				['2026-10-02T12:10', 'Thomas Morrison', 'Explained repeat visits on Basic.', 'email'],
			],
		},
		{
			id: '#1070',
			name: 'Addison Gallagher',
			title: 'Owner',
			company: 'Gallagher Bikes',
			city: 'Duluth, MN',
			email: 'addison@gallagherbikes.com',
			phone: '+1 218 555 0170',
			source: 'webinar',
			stage: 'contacted',
			fit: 47,
			why: 'Six people. Mainly wants to share one grooming room.',
			plan: 'starter',
			seats: 6,
			addons: [],
			owner: 'Tony Aldridge',
			reply: 75,
			received: '2026-10-01T14:05',
			message: 'Small team of six. We mainly want to stop booking the grooming room twice.',
			reasons: [
				{ good: true, title: 'Clear problem.', text: 'Booking shared equipment stops the double bookings.' },
				{ good: false, title: 'Small team.', text: 'Six people on Basic.' },
			],
			next: { what: 'Follow up on the equipment guide', note: '', date: '2026-10-12', time: '10:00' },
			history: [
				['2026-10-01T14:05', 'Addison Gallagher', 'Asked a question after the scheduling webinar.', 'webinar'],
				['2026-10-01T15:20', 'Tony Aldridge', 'Sent the shared equipment guide.', 'email'],
			],
		},
		{
			id: '#1068',
			name: 'Marshall McCall',
			title: 'Director',
			company: 'Alpine Domicile',
			city: 'Peoria, IL',
			email: 'm.mccall@alpinedomicile.com',
			phone: '+1 309 555 0168',
			source: 'partner',
			via: 'TechnoPro Distribution',
			stage: 'qualified',
			fit: 84,
			why: '48 home care staff. Needs Spanish and a customer portal.',
			plan: 'enterprise',
			seats: 48,
			addons: ['route', 'portal'],
			owner: 'Elise Vick',
			reply: 65,
			received: '2026-09-29T08:30',
			message:
				'Our reseller TechnoPro suggested Fieldline. We have 48 home care staff and need Spanish and our own customer portal.',
			reasons: [
				{ good: true, title: 'Right size.', text: '48 carers is a full Max team.' },
				{ good: true, title: 'Partner-led.', text: 'TechnoPro sets it up and supports them in Spanish.' },
				{ good: false, title: 'Language.', text: 'The portal must be in Spanish from day one.' },
			],
			next: {
				what: 'Send the quote with the Spanish portal',
				note: 'TechnoPro joins the call.',
				date: '2026-10-09',
				time: '14:00',
			},
			history: [
				['2026-09-29T08:30', 'TechnoPro Distribution', 'Passed on Marshall’s details.', 'partner'],
				['2026-09-29T09:35', 'Elise Vick', 'Booked a call for September 30.', 'email'],
				['2026-10-06T10:00', 'Elise Vick', 'Demo for the care managers. Portal in Spanish is a must.', 'demo'],
			],
		},
		{
			id: '#1066',
			name: 'Steve Newton',
			title: 'Chief Operating Officer',
			company: 'Kingsley Facilities Group',
			city: 'Fort Collins, CO',
			email: 'steve.newton@kingsleyfacilities.com',
			phone: '+1 970 555 0166',
			source: 'website',
			stage: 'qualified',
			fit: 91,
			why: '75 maintenance staff on contracts with response times.',
			plan: 'enterprise',
			seats: 75,
			addons: ['route'],
			owner: 'Tony Aldridge',
			reply: 40,
			received: '2026-09-28T07:15',
			message:
				'We run 75 maintenance staff on contracts with four shopping centers. We need response times and proof of every visit.',
			reasons: [
				{ good: true, title: 'Big team.', text: '75 staff on Max.' },
				{ good: true, title: 'Clear need.', text: 'Response times and visit proof come with Max.' },
				{ good: true, title: 'Moving fast.', text: 'Discovery call four days after the form.' },
			],
			next: {
				what: 'Send the Max quote',
				note: 'Include response-time reports.',
				date: '2026-10-09',
				time: '09:30',
			},
			history: [
				['2026-09-28T07:15', 'Steve Newton', 'Sent the website form.', 'form'],
				['2026-09-28T07:55', 'Tony Aldridge', 'Replied and booked a discovery call.', 'email'],
				['2026-10-02T13:00', 'Tony Aldridge', 'Discovery call: wants the Max visit reports.', 'call'],
			],
		},
		{
			id: '#1064',
			name: 'Francis Becker',
			title: 'Head of Care',
			company: 'Becker Machine Shop',
			city: 'Dubuque, IA',
			email: 'f.becker@beckermachineshop.com',
			phone: '+1 563 555 0164',
			source: 'partner',
			via: 'TechnoPro Distribution',
			stage: 'qualified',
			fit: 80,
			why: '30 carers. Plans every round by hand each morning.',
			plan: 'growth',
			seats: 30,
			addons: ['route'],
			owner: 'Elise Vick',
			reply: 120,
			received: '2026-09-26T11:00',
			message:
				'Thirty carers, and every round is planned by hand each morning. Our reseller says Travel Planner could save an hour a day.',
			reasons: [
				{ good: true, title: 'Ready to buy.', text: 'Asked for a quote on 30 seats.' },
				{ good: true, title: 'Clear saving.', text: 'Travel Planner replaces planning by hand.' },
				{ good: false, title: 'Through a reseller.', text: 'TechnoPro sets the final price.' },
			],
			next: {
				what: 'Send the quote for 30 seats',
				note: 'Pro with Travel Planner.',
				date: '2026-10-08',
				time: '17:00',
			},
			history: [
				['2026-09-26T11:00', 'TechnoPro Distribution', 'Passed on Francis’s details.', 'partner'],
				['2026-09-26T13:00', 'Elise Vick', 'Sent a Travel Planner case study.', 'email'],
				['2026-10-05T15:00', 'Elise Vick', 'Call: ready for a quote on 30 seats.', 'call'],
			],
		},
		{
			id: '#1061',
			name: 'Ben Carlisle',
			title: 'Operations Manager',
			company: 'Frontier Outdoor',
			city: 'Boulder, CO',
			email: 'ben.carlisle@frontieroutdoor.com',
			phone: '+1 303 555 0161',
			source: 'search',
			stage: 'trial',
			trialEnds: '2026-10-16',
			fit: 82,
			why: '38 carers. Comparing three tools before Q4.',
			plan: 'growth',
			seats: 38,
			addons: [],
			owner: 'John Armstrong',
			reply: 35,
			received: '2026-09-25T16:40',
			message: 'We are comparing three scheduling tools before Q4. Can we try it with our real visits?',
			reasons: [
				{ good: true, title: 'Right size.', text: '38 carers fits Pro well.' },
				{ good: true, title: 'Busy trial.', text: '33 of 38 carers signed in during the trial.' },
				{ good: false, title: 'Comparing tools.', text: 'Two others are on his list until Q4.' },
			],
			next: {
				what: 'Halfway review with Ben',
				note: 'Before he scores the three tools.',
				date: '2026-10-09',
				time: '15:00',
			},
			trial: {
				active: 33,
				done: 'Visits done',
				days: [
					['2026-10-02', 9, 9],
					['2026-10-03', 0, 0],
					['2026-10-04', 0, 0],
					['2026-10-05', 26, 24],
					['2026-10-06', 31, 29],
					['2026-10-07', 34, 31],
					['2026-10-08', 29, 12],
				],
			},
			history: [
				['2026-09-25T16:40', 'Ben Carlisle', 'Asked for a trial from the search ad.', 'form'],
				['2026-09-25T17:15', 'John Armstrong', 'Replied and set up a call.', 'email'],
				['2026-10-02T09:00', 'John Armstrong', 'Started a 14-day Pro trial.', 'trial'],
			],
		},
		{
			id: '#1059',
			name: 'Connie Strickland',
			title: 'Founder',
			company: 'Spark & Shutter Studio',
			city: 'Stamford, CT',
			email: 'connie@sparkandshutter.com',
			phone: '+1 203 555 0159',
			source: 'referral',
			via: 'Oakhaven Studio',
			stage: 'trial',
			trialEnds: '2026-10-12',
			fit: 76,
			why: '18 photographers and hiring every month.',
			plan: 'growth',
			seats: 18,
			addons: [],
			owner: 'Quentin Cook',
			reply: 90,
			received: '2026-09-22T10:20',
			message: 'Todd at Oakhaven Studio recommends you. We are 18 photographers and growing fast.',
			reasons: [
				{ good: true, title: 'Referred.', text: 'Oakhaven Studio recommended us.' },
				{ good: true, title: 'Growing.', text: 'Hiring every month, so the seats will grow.' },
				{ good: false, title: 'Short on time.', text: 'Connie runs everything herself; keep setup light.' },
			],
			next: {
				what: 'Call Connie about new hires',
				note: 'Seats for this month’s starters.',
				date: '2026-10-10',
				time: '11:00',
			},
			trial: {
				active: 16,
				done: 'Visits done',
				days: [
					['2026-09-28', 4, 4],
					['2026-09-29', 12, 11],
					['2026-09-30', 14, 13],
					['2026-10-01', 15, 14],
					['2026-10-02', 13, 13],
					['2026-10-03', 2, 2],
					['2026-10-04', 0, 0],
					['2026-10-05', 16, 15],
					['2026-10-06', 17, 15],
					['2026-10-07', 18, 16],
					['2026-10-08', 15, 7],
				],
			},
			history: [
				['2026-09-22T10:20', 'Connie Strickland', 'Sent the website form.', 'form'],
				['2026-09-22T11:50', 'Quentin Cook', 'Replied with a demo video.', 'email'],
				['2026-09-28T14:00', 'Quentin Cook', 'Started a 14-day Pro trial.', 'trial'],
			],
		},
		{
			id: '#1057',
			name: 'Tom Whitaker',
			title: 'Managing Director',
			company: 'Whitaker Engineering',
			city: 'Marquette, MI',
			email: 'tom@whitakereng.com',
			phone: '+1 906 555 0157',
			source: 'event',
			via: 'Small Business Expo',
			stage: 'trial',
			trialEnds: '2026-10-09',
			fit: 87,
			why: '42 carers. Every visit needs a signed report.',
			plan: 'enterprise',
			seats: 42,
			addons: ['portal'],
			owner: 'John Armstrong',
			reply: 25,
			received: '2026-09-18T15:30',
			message:
				'We look after 900 clients on care contracts. Every visit needs a signed report for the client’s family.',
			reasons: [
				{ good: true, title: 'Right size.', text: '42 carers sits well inside what Max is built for.' },
				{
					good: true,
					title: 'Clear need.',
					text: 'Signed visit reports come with Max and the Customer Portal.',
				},
				{ good: true, title: 'Busy trial.', text: '37 of 42 carers signed in during the trial.' },
				{
					good: false,
					title: 'Finance signs off.',
					text: 'Tom decides, but anything over $25,000 a year goes to finance.',
				},
			],
			next: {
				what: 'Call Tom and his finance lead',
				note: 'Agree the quote before the trial ends.',
				date: '2026-10-09',
				time: '10:00',
			},
			trial: {
				active: 37,
				done: 'Signed reports',
				days: [
					['2026-09-25', 6, 6],
					['2026-09-26', 0, 0],
					['2026-09-27', 0, 0],
					['2026-09-28', 14, 13],
					['2026-09-29', 19, 17],
					['2026-09-30', 22, 20],
					['2026-10-01', 24, 22],
					['2026-10-02', 21, 19],
					['2026-10-03', 3, 3],
					['2026-10-04', 0, 0],
					['2026-10-05', 28, 26],
					['2026-10-06', 31, 28],
					['2026-10-07', 33, 30],
					['2026-10-08', 30, 14],
				],
			},
			history: [
				['2026-09-18T15:30', 'Tom Whitaker', 'Booked a demo at the Small Business Expo.', 'event'],
				[
					'2026-09-18T15:55',
					'John Armstrong',
					'Sent the signed report template.',
					'email',
					'Hi Tom, good to meet you at the stand. Here is the visit report our care customers send to families, signed on the phone at the end of each visit.',
				],
				[
					'2026-09-25T10:00',
					'John Armstrong',
					'Started a 14-day Max trial.',
					'trial',
					'42 seats with the Customer Portal. Tom’s three supervisors are setting up the first week’s care rounds.',
				],
			],
		},

		{
			id: '#1063',
			name: 'Kathy Schultz',
			title: 'Managing Director',
			company: 'Vista Wash Co.',
			city: 'Topeka, KS',
			email: 'kathy@vistawash.com',
			phone: '+1 785 555 0163',
			source: 'partner',
			via: 'TechnoPro Distribution',
			stage: 'converted',
			converted: '2026-10-05',
			deal: '#2042',
			fit: 83,
			why: '18 cleaners on paper visit sheets.',
			plan: 'growth',
			seats: 18,
			addons: [],
			owner: 'Elise Vick',
			reply: 85,
			received: '2026-09-27T09:00',
			message: 'Eighteen cleaners on paper visit sheets. Winter cover is where we lose the most time.',
			reasons: [
				{ good: true, title: 'Clear need.', text: 'Paper visit sheets slow down every winter round.' },
				{ good: true, title: 'Partner-led.', text: 'TechnoPro handles setup in Kansas.' },
			],
			history: [
				['2026-09-27T09:00', 'TechnoPro Distribution', 'Passed on Kathy’s details.', 'partner'],
				['2026-09-27T10:25', 'Elise Vick', 'Replied and booked a first call.', 'email'],
				['2026-10-05T11:00', 'Elise Vick', 'Converted to a Pro deal for 18 seats.', 'deal'],
			],
		},
		{
			id: '#1055',
			name: 'Mara Kendall',
			title: 'Director',
			company: 'Harlow Photography',
			city: 'Cincinnati, OH',
			email: 'mara.kendall@harlowphotography.com',
			phone: '+1 513 555 0155',
			source: 'event',
			via: 'Small Business Expo',
			stage: 'converted',
			converted: '2026-10-02',
			deal: '#2044',
			fit: 78,
			why: '22 photographers across two sites.',
			plan: 'growth',
			seats: 22,
			addons: [],
			owner: 'Elise Vick',
			reply: 150,
			received: '2026-09-17T13:10',
			message: 'Two sites, 22 photographers. We would like to see how shoots move between site leads.',
			reasons: [
				{ good: true, title: 'Right size.', text: '22 photographers fits Pro well.' },
				{ good: false, title: 'Two sites.', text: 'Shoots move between site leads; set up both teams.' },
			],
			history: [
				['2026-09-17T13:10', 'Mara Kendall', 'Left her details at the Small Business Expo stand.', 'event'],
				['2026-09-17T15:40', 'Elise Vick', 'Replied with a short tour.', 'email'],
				['2026-10-02T16:00', 'Elise Vick', 'Converted to a Pro deal for 22 seats.', 'deal'],
			],
		},
		{
			id: '#1049',
			name: 'Ralph Morgan',
			title: 'Operations Manager',
			company: 'Swan River Photography',
			city: 'Chico, CA',
			email: 'ralph@swanriverphotography.com',
			phone: '+1 530 555 0149',
			source: 'search',
			stage: 'converted',
			converted: '2026-09-24',
			deal: '#2035',
			fit: 81,
			why: '26 photographers and two supervisors.',
			plan: 'growth',
			seats: 26,
			addons: [],
			owner: 'Thomas Morrison',
			reply: 110,
			received: '2026-09-15T08:45',
			message: 'We have 26 photographers. The supervisors want shoot forms they can change themselves.',
			reasons: [
				{ good: true, title: 'Right size.', text: '26 photographers fits Pro well.' },
				{ good: true, title: 'Clear need.', text: 'Supervisors can change shoot forms themselves on Pro.' },
			],
			history: [
				['2026-09-15T08:45', 'Ralph Morgan', 'Asked for a demo from the search ad.', 'form'],
				['2026-09-15T10:35', 'Thomas Morrison', 'Replied and booked a demo.', 'email'],
				['2026-09-24T09:30', 'Thomas Morrison', 'Converted to a Pro deal for 26 seats.', 'deal'],
			],
		},
		{
			id: '#1044',
			name: 'Luna Farmer',
			title: 'Head of Operations',
			company: 'Atlas Facility Services',
			city: 'Rockford, IL',
			email: 'luna.farmer@atlasfacility.com',
			phone: '+1 815 555 0144',
			source: 'website',
			stage: 'converted',
			converted: '2026-09-17',
			deal: '#2040',
			fit: 89,
			why: '60 staff on cleaning and repair contracts.',
			plan: 'enterprise',
			seats: 60,
			addons: [],
			owner: 'Elise Vick',
			reply: 60,
			received: '2026-09-09T10:00',
			message: 'We manage 60 staff on cleaning and repair contracts. We need the workspace in Spanish.',
			reasons: [
				{ good: true, title: 'Big team.', text: '60 staff on Max.' },
				{ good: false, title: 'Language.', text: 'The workspace has to be in Spanish.' },
			],
			history: [
				['2026-09-09T10:00', 'Luna Farmer', 'Sent the website form.', 'form'],
				['2026-09-09T11:00', 'Elise Vick', 'Replied in Spanish and booked a call.', 'email'],
				['2026-09-17T12:00', 'Elise Vick', 'Converted to a Max deal for 60 seats.', 'deal'],
			],
		},

		{
			id: '#1074',
			name: 'Ross McKenzie',
			title: 'Partner',
			company: 'McKenzie Cleaning',
			city: 'La Crosse, WI',
			email: 'ross@mckenziecleaning.com',
			phone: '+1 608 555 0174',
			source: 'website',
			stage: 'notnow',
			reason: 'Revisit next quarter',
			parked: '2026-10-04',
			fit: 64,
			why: '16 cleaners. Busy season runs to December.',
			plan: 'growth',
			seats: 16,
			addons: [],
			owner: 'Tony Aldridge',
			reply: 95,
			received: '2026-10-03T08:20',
			message: 'Interested, but nothing changes before our busy season ends in December.',
			reasons: [
				{ good: true, title: 'Interested.', text: '16 cleaners, a good size for Pro.' },
				{ good: false, title: 'Timing.', text: 'Nothing changes before December.' },
			],
			history: [
				['2026-10-03T08:20', 'Ross McKenzie', 'Sent the website form.', 'form'],
				['2026-10-03T09:55', 'Tony Aldridge', 'Replied with the Pro tour.', 'email'],
				['2026-10-04T11:00', 'Tony Aldridge', 'Not now: revisit next quarter.', 'pause'],
			],
		},
		{
			id: '#1058',
			name: 'Alan Callahan',
			title: 'Owner',
			company: 'Callahan Gardens',
			city: 'Durham, NC',
			email: 'alan@callahangardens.com',
			phone: '+1 919 555 0158',
			source: 'webinar',
			stage: 'notnow',
			reason: 'Staying on paper or spreadsheets',
			parked: '2026-09-30',
			fit: 42,
			why: 'Eight gardeners, one car.',
			plan: 'starter',
			seats: 8,
			addons: [],
			owner: 'Jeffrey McKay',
			reply: 210,
			received: '2026-09-23T15:00',
			message: 'Eight gardeners and one car. Is it worth it for a team our size?',
			reasons: [
				{ good: false, title: 'Small team.', text: 'Eight gardeners and one car.' },
				{ good: false, title: 'Happy on paper.', text: 'Staying on spreadsheets this year.' },
			],
			history: [
				['2026-09-23T15:00', 'Alan Callahan', 'Asked a question after the scheduling webinar.', 'webinar'],
				['2026-09-23T18:30', 'Jeffrey McKay', 'Replied with Basic pricing.', 'email'],
				['2026-09-30T10:00', 'Jeffrey McKay', 'Not now: staying on spreadsheets this year.', 'pause'],
			],
		},
		{
			id: '#1051',
			name: 'Sandra Hanson',
			title: 'Owner',
			company: 'Cedar Cleaning Co.',
			city: 'Hattiesburg, MS',
			email: 'sandra@cedarcleaning.com',
			phone: '+1 601 555 0151',
			source: 'search',
			stage: 'notnow',
			reason: 'Too small for now',
			parked: '2026-09-21',
			fit: 38,
			why: 'Four cleaners on fixed weekly rounds.',
			plan: 'starter',
			seats: 4,
			addons: [],
			owner: 'Elise Vick',
			reply: 45,
			received: '2026-09-20T09:15',
			message: 'Four cleaners on the same weekly rounds. We need a simple shared calendar.',
			reasons: [
				{ good: true, title: 'Simple need.', text: 'A shared calendar is in Basic.' },
				{ good: false, title: 'Very small.', text: 'Four cleaners on fixed rounds.' },
			],
			history: [
				['2026-09-20T09:15', 'Sandra Hanson', 'Asked for prices from the search ad.', 'form'],
				['2026-09-20T10:00', 'Elise Vick', 'Replied with Basic pricing.', 'email'],
				['2026-09-21T09:00', 'Elise Vick', 'Not now: too small for now.', 'pause'],
			],
		},
	];

	publish();

	/** Shapes every record once and hangs the read API on window.Basalt.data. */
	function publish() {
		const shapedDeals = DEAL_SEEDS.map(shapeDeal);
		const quotes = accounts
			? [
					...PLAN_QUOTE_SEEDS.map((seed) => shapePlanQuote(seed, shapedDeals)),
					...SERVICE_QUOTE_SEEDS.map(shapeServiceQuote),
				]
			: [];

		window.Basalt.data = window.Basalt.data || {};
		window.Basalt.data.deals = {
			today: AS_OF,
			stages: PIPELINE,
			owners: Object.keys(SELLER_LOGINS),
			sources: ORIGINS,
			lostReasons: LOSS_CAUSES,
			products: CATALOG,
			planSku: SKU_BY_PLAN,
			reps: SERVICE_REPS,
			list: () => shapedDeals.map((record) => freshCopy(record)),
			find: (key) =>
				freshCopyOrNull(shapedDeals.find((record) => record.id === key || record.slugs.includes(key))),
			yearly: annualValue,
			slug: toSlug,
			ownerUrl: teammateLink,
			quotes: () => quotes.map((quote) => freshCopy(quote)),
			quote: (key) => freshCopyOrNull(quotes.find((quote) => quote.id === key)),
			leads: () => LEAD_RECORDS.map((lead) => freshCopy(lead)),
			lead: (key) => freshCopyOrNull(LEAD_RECORDS.find((lead) => lead.id === key)),
		};
	}

	/* Deals. */

	/**
	 * Turns a deal seed into the record pages read. An upsell takes the
	 * customer's own facts; a new business deal fills in its title,
	 * plan line and contact emails from the seed.
	 */
	function shapeDeal(seed) {
		const record = freshCopy(seed);
		const account = record.acct && accounts ? accounts.find(record.acct) : null;

		if (account) fillFromAccount(record, account);
		else fillProspect(record);

		record.customer = Boolean(account);
		record.oneOff ||= [];
		record.value = annualValue(record);
		record.slugs = [toSlug(record.title), ...(record.alias || [])];
		for (const scratch of ['name', 'due', 'alias']) delete record[scratch];
		return record;
	}

	/** Copies what the customer account already knows onto an upsell deal. */
	function fillFromAccount(record, account) {
		const twin = account.deals.find((entry) => entry.name === record.name) || {};
		const contactFor = (key) => account.people.find((person) => person.key === key) || account.people[0];

		record.company = account.name;
		record.city = account.city;
		record.owner ||= account.owner;
		record.stage ||= twin.stage;
		record.closes ||= twin.closes;
		record.title = record.name;
		record.plan = twin.plan || (record.kind === 'upgrade' ? 'growth' : account.plan);
		record.seats = twin.seats || account.seats;
		record.next = twin.next ? [twin.next, record.due] : null;
		record.people = (record.people || twin.people || []).map(([key, part]) => {
			const contact = contactFor(key);
			return {
				name: contact.name,
				title: contact.title,
				part,
				email: contact.email,
				phone: contact.phone,
				key: contact.key,
			};
		});
		record.current = {
			plan: account.plan,
			seats: account.seats,
			route: account.route,
			portal: account.portal,
			sms: account.sms,
			renews: account.renews,
		};
	}

	/** Completes a new business deal: a default title and plan line, and an email per contact. */
	function fillProspect(record) {
		record.title ||= `${PLAN_LABEL[record.plan]} for ${record.seats} seats`;
		record.lines ||= [[SKU_BY_PLAN[record.plan], record.seats]];
		const domain = webDomain(record.company);
		record.people = record.people.map(([name, title, part]) => {
			const mailbox = toSlug(name.split(' ')[0]);
			return { name, title, part, email: `${mailbox}@${domain}` };
		});
	}

	/** Sums what a deal's recurring lines bring in over a year. */
	function annualValue(record) {
		let sum = 0;
		for (const [sku, count] of record.lines) sum += CATALOG[sku].price * count;
		return sum;
	}

	/* Quotes. */

	/**
	 * Builds a plan quote: the customer and buyer it goes to, the person
	 * sending it, its lines, and the status and covering note it shows.
	 * A renewal reprices the full coming year at the renewed size.
	 */
	function shapePlanQuote(seed, shapedDeals) {
		const quote = freshCopy(seed);
		const sourceDeal = quote.deal ? shapedDeals.find((entry) => entry.id === quote.deal) : null;
		const account = accounts ? accounts.find(sourceDeal ? sourceDeal.acct || '' : quote.acct) : null;

		quote.kind = 'plan';
		quote.valid ||= 30;
		quote.reminders ||= [];
		if (quote.renewal) {
			const seats = account.renewal ? account.renewal.seats : account.seats;
			quote.lines = [
				[SKU_BY_PLAN[sourceDeal ? sourceDeal.plan : account.plan], seats],
				account.route && ['FL-ROUTE', seats],
				account.portal && ['FL-PORTAL', seats],
				account.sms && ['FL-SMS', account.sms],
			].filter(Boolean);
			quote.title = `Renewal, ${seats} seats`;
		} else {
			quote.lines = [...sourceDeal.lines, ...sourceDeal.oneOff];
			quote.title = sourceDeal.title;
		}

		quote.acct = account ? account.id : null;
		quote.company = sourceDeal ? sourceDeal.company : account.name;
		quote.city = sourceDeal ? sourceDeal.city : account.city;
		quote.address = account ? account.address : [quote.city];
		quote.dealStage = sourceDeal ? sourceDeal.stage : null;
		quote.closes = sourceDeal ? sourceDeal.closes : null;
		/* A signed plan starts on the renewal date, or on the close date for a deal. */
		quote.starts = quote.renewal ? account.renews : sourceDeal.closes;
		quote.owner = sourceDeal ? sourceDeal.owner : account.owner;
		quote.rep = { name: quote.owner, role: SELLER_LOGINS[quote.owner] ? 'Account owner' : 'Fieldline' };

		const signer = pickSigner(quote, sourceDeal, account);
		quote.buyer = {
			name: signer.name,
			title: signer.title,
			email: signer.email,
			phone: signer.phone || '',
			key: account ? signer.key : null,
		};
		quote.status ||= { signed: 'accepted', lost: 'declined' }[sourceDeal?.stage] || 'sent';
		quote.account = account ? accountSummary(account) : null;
		quote.pay = account?.pay || 'Yearly invoice, 30 days';
		quote.note ||= coveringNote(quote);
		return quote;
	}

	/** The person a plan quote is addressed to: the renewal signer, else whoever signs the deal. */
	function pickSigner(quote, sourceDeal, account) {
		const renewalSigner =
			quote.renewal && account?.renewal
				? account.people.find((person) => person.key === account.renewal.signer)
				: undefined;
		if (renewalSigner) return renewalSigner;
		if (!sourceDeal) return undefined;
		return sourceDeal.people.find((person) => ['Signs', 'Signed'].includes(person.part)) || sourceDeal.people[0];
	}

	/** The default message on a plan quote, addressed by first name. */
	function coveringNote(quote) {
		const [firstName] = quote.buyer.name.split(' ');
		if (!quote.renewal)
			return `${firstName}, here is the quote for ${quote.company}: ${quote.title}, as we discussed.`;
		const seatPhrase = quote.title.slice('Renewal, '.length);
		return `${firstName}, here is the renewal for the coming year at ${seatPhrase}, at this year’s prices.`;
	}

	/** Builds a services quote from its seed and the customer's buying terms. */
	function shapeServiceQuote(seed) {
		const quote = freshCopy(seed);
		const account = accounts.find(quote.acct);
		const terms = BUYING_TERMS[quote.acct];
		const buyerKey = quote.to || terms.buyer;
		const buyer = account.people.find((person) => person.key === buyerKey) || account.people[0];

		quote.kind = 'store';
		quote.company = account.name;
		quote.city = account.city;
		quote.address = account.address;
		quote.buyer = { name: buyer.name, title: buyer.title, email: buyer.email, phone: buyer.phone, key: buyer.key };
		quote.rep = { id: quote.rep, ...SERVICE_REPS[quote.rep] };
		quote.tax = terms.tax;
		quote.terms = terms.terms;
		quote.card = terms.card || '';
		quote.tone = terms.tone;
		quote.account = accountSummary(account);
		return quote;
	}

	/** The plan, size and tenure of a customer, as quote headers show it. */
	function accountSummary(account) {
		return { plan: PLAN_LABEL[account.plan], seats: account.seats, since: account.since, sub: account.sub };
	}

	/* Shared helpers. */

	/** A deep, plain-data copy, so a page can edit what it gets freely. */
	function freshCopy(value) {
		return JSON.parse(JSON.stringify(value));
	}

	/** A copy of the match, or null when nothing matched. */
	function freshCopyOrNull(record) {
		return record ? freshCopy(record) : null;
	}

	/** Lower-case, accent-free, dash-joined form of a name, as used in links. */
	function toSlug(text) {
		const plain = String(text)
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '');
		return plain
			.split(/[^a-z0-9]+/)
			.filter(Boolean)
			.join('-');
	}

	/** The profile page of a seller, or the bare page when they have none. */
	function teammateLink(name) {
		const login = SELLER_LOGINS[name];
		return login ? `employee-user-details.html?id=${encodeURIComponent(login)}` : 'employee-user-details.html';
	}

	/** A made-up web domain for a new customer, from its name. */
	function webDomain(company) {
		return `${toSlug(company).replaceAll('-', '')}.com`;
	}
})();
