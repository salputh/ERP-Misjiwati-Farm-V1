/**
 * The Fieldline customer book: every company that pays for Fieldline or
 * is trying it, kept in a single place so a customer reads the same on
 * every screen (plan, seats, city, account lead, contacts, dates).
 * Companies, Company Details, Buyers, Buyer Details, Subscriptions,
 * Subscription Details, CRM and Segments all draw on it.
 *
 * A shipped product would load these from its back end; meanwhile the
 * records spell out which fields those screens depend on.
 *
 * Exposed as window.Basalt.data.accounts:
 *   today                          the date the demo treats as now
 *   plans, addOns, trades, owners  lookup tables the records refer to
 *   list()           a private copy of the whole book, safe to edit
 *   find(id)         one account by id or retired alias, else null
 *   person(key)      { person, account } for a contact key, else null
 *   mrr(account)     monthly revenue right now; trials bring in 0
 *   listMrr(account) monthly revenue at full price, trial or not
 *   history(account) paid seat counts over time, earliest first
 *   bills(account)   subscription invoices, latest first
 *   personKey(name), slug(text), zoneName(tz)
 */
(() => {
	'use strict';

	/* The demo is frozen on one calendar day. A live build would read the
     clock instead. Trials run two weeks, and invoice years are measured
     in average Julian years. */
	const CALENDAR = { today: '2026-10-09', trialDays: 14, yearMs: 31557600000 };

	/* Seat prices are monthly list prices. Every account here is invoiced
     once a year for ten months, so each seat costs ten twelfths of the
     list price a month. Add-ons are not discounted; SMS is sold in
     bundles of 1,000 messages a month. */
	const SEAT_PRICES = {
		starter: { name: 'Basic', price: 15 },
		growth: { name: 'Pro', price: 32 },
		enterprise: { name: 'Max', price: 58 },
	};
	const EXTRAS = {
		route: { name: 'Travel Planner', per: 6 },
		portal: { name: 'Customer Portal', per: 4 },
		sms: { name: 'SMS credits', per: 25 },
	};

	/* Industries, each with the Bootstrap Icon on its company tile and the
     chart tone used for it. */
	const SECTORS = [
		{ id: 'homecare', name: 'Home care', tone: 1, icon: 'bi-house-heart-fill' },
		{ id: 'petcare', name: 'Pet care', tone: 2, icon: 'bi-heart-fill' },
		{ id: 'photography', name: 'Photography', tone: 3, icon: 'bi-camera-fill' },
		{ id: 'cleaning', name: 'Cleaning', tone: 4, icon: 'bi-stars' },
		{ id: 'landscaping', name: 'Landscaping', tone: 5, icon: 'bi-tree-fill' },
		{ id: 'property', name: 'Property care', tone: 6, icon: 'bi-building-fill' },
		{ id: 'moving', name: 'Movers', tone: 7, icon: 'bi-box-seam-fill' },
	];

	/* Fieldline staff who can be named as an account's lead. */
	const ACCOUNT_LEADS = [
		'John Armstrong',
		'Leslie Ashby',
		'Quentin Cook',
		'Tony Aldridge',
		'Elise Vick',
		'Thomas Morrison',
		'Jeffrey McKay',
	];

	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/* Field guide, one record per company.
     Identity: id is the link key (company-details.html?id=lumoraai) and
     alias lists older ids that still resolve. health scores 0-100 from
     seat use, tickets and payments (null before the first weekly score);
     owner is the account lead.
     Plan: seats are paid for, used were active this week; route, portal
     and sms are add-ons, sms counted in monthly bundles. status is active,
     trial, pastdue or canceling; statusOn dates a trial's end, a failed
     charge or the final day. since is the first paid day (a trial's start)
     and renews the yearly renewal, or the last day when canceling.
     Billing: no is printed on invoices, sub is the id on subscriptions.html.
     Place: tz is an IANA zone used for local times.
     people are contacts (see contact() below). deals are open
     opportunities; value is added yearly revenue and people pairs a
     contact key with their part. renewal is a quote that is out.
     activity rows read [date, who, what, kind, contacts], latest first;
     orders are one-off purchases such as SMS packs, onboarding, training
     or imports, as [number, date, item, total, state]. store, where known,
     is [lifetime purchase spend, order count], and note explains a status
     on the subscription views. */
	const BOOK = [
		/* Customers on paid yearly plans, overdue and departing ones included. */
		{
			id: 'lumoraai',
			name: 'Lumora AI',
			trade: 'homecare',
			health: 91,
			tickets: 0,
			owner: 'Leslie Ashby',
			plan: 'enterprise',
			seats: 86,
			used: 81,
			route: true,
			status: 'active',
			since: '2022-11-02',
			renews: '2026-11-02',
			no: '#10482',
			sub: '#30418',
			pay: 'Bank transfer, 30 days',
			po: 'PO-NP-4471',
			branches: 'Boulder, Aurora, Boulder',
			region: 'West',
			tz: 'America/Denver',
			city: 'Boulder, CO',
			phone: '+1 303 555 0100',
			site: 'lumoraai.com',
			address: ['1550 Wewatta St', 'Boulder, CO 80202', 'United States'],
			note: 'Renewal quote sent on Oct 6 for 94 seats. Carla signs it.',
			seatHistory: [
				['2022-11-02', 60, 'Started on Max with 60 seats and Travel Planner'],
				['2023-11-02', 70, 'Renewed with 70 seats'],
				['2024-05-14', 76, 'Added 6 seats for the Aurora branch'],
				['2024-11-02', 80, 'Renewed with 80 seats'],
				['2025-11-02', 84, 'Renewed with 84 seats'],
				['2026-08-21', 86, 'Added 2 seats for new carers'],
			],
			renewal: {
				quote: '#437',
				seats: 94,
				sent: '2026-10-06',
				opened: '2026-10-07',
				signer: 'carla-malone',
			},
			people: [
				contact('Hailey Zimmerman', 'Operations manager', 'champion', '+1 303 555 0126', {
					main: true,
					since: '2022-11-02',
					mobile: '+1 720 555 0181',
					replies: 'Answers email within the hour on weekdays.',
					note: 'Buys the SMS credit packs and owns the subscription. Asked for eight more seats at the renewal.',
				}),
				contact('Carla Malone', 'Operations director', 'decision', '+1 303 555 0142', {
					since: '2022-11-02',
					mobile: '+1 720 555 0193',
					replies: 'Usually answers email the same day.',
					note: 'Signs the renewal. Wants it on one invoice with any new seats.',
				}),
				contact('Dean Whitfield', 'Scheduling lead', 'admin', '+1 303 555 0167', {
					hours: [6, 15],
					since: '2023-02-14',
					replies: 'Quickest on the phone before 9:00 am.',
					note: 'Starts at 6:00 am with the first visits. Runs the workspace settings.',
				}),
				contact('Ruth Boyle', 'Accounts payable', 'billing', '+1 303 555 0118', {
					since: '2024-01-08',
					replies: 'Answers email within a day.',
					note: 'Pays by bank transfer on 30-day terms. Wants add-ons on their own invoice line.',
				}),
			],
			deals: [
				{
					name: 'Eight more carer seats',
					stage: 'negotiation',
					value: 4640,
					closes: '2026-10-23',
					plan: 'enterprise',
					seats: 94,
					next: 'Carla signs the renewal quote with the eight new seats on it.',
					people: [
						['carla-malone', 'Signs'],
						['hailey-zimmerman', 'Asked for it'],
						['ruth-boyle', 'Pays'],
					],
				},
				{
					name: 'Customer Portal for 86 seats',
					stage: 'proposal',
					value: 4128,
					closes: '2026-11-20',
					plan: 'enterprise',
					seats: 86,
					next: 'Dean names the office staff for a 30-day trial.',
					people: [
						['carla-malone', 'Signs'],
						['dean-whitfield', 'Sets it up'],
					],
				},
			],
			activity: [
				[
					'2026-10-07',
					'Carla Malone',
					'Opened the renewal quote for the second time.',
					'update',
					['carla-malone'],
				],
				[
					'2026-10-06',
					'Leslie Ashby',
					'Sent the renewal quote for 94 seats on Max.',
					'email',
					['carla-malone', 'hailey-zimmerman'],
				],
				[
					'2026-10-06',
					'Hailey Zimmerman',
					'Bought 20 SMS credit packs for reminders.',
					'update',
					['hailey-zimmerman'],
				],
				[
					'2026-10-01',
					'Hailey Zimmerman',
					'Asked to add eight carer seats at the renewal.',
					'email',
					['hailey-zimmerman'],
				],
				[
					'2026-09-29',
					'Leslie Ashby',
					'Showed Dean the Customer Portal for the office team.',
					'call',
					['dean-whitfield'],
				],
				[
					'2026-09-12',
					'Leslie Ashby',
					'Quarterly review: map load times are better since August.',
					'meeting',
					['carla-malone', 'hailey-zimmerman'],
				],
				['2026-09-04', 'Ruth Boyle', 'Confirmed the bank details before the renewal.', 'email', ['ruth-boyle']],
				['2026-08-21', 'Dean Whitfield', 'Added 2 seats for new carers.', 'update', ['dean-whitfield']],
				[
					'2026-08-03',
					'John Armstrong',
					'Carla mentioned a second branch in Boulder next spring.',
					'note',
					['carla-malone'],
				],
				[
					'2026-07-22',
					'Leslie Ashby',
					'Talked Carla through slow map loading on the schedule board.',
					'call',
					['carla-malone'],
				],
				[
					'2026-06-12',
					'Leslie Ashby',
					'Quarterly review: planned hiring for the summer.',
					'meeting',
					['carla-malone', 'hailey-zimmerman'],
				],
				[
					'2026-06-01',
					'Hailey Zimmerman',
					'Asked how carers see their visits offline.',
					'call',
					['hailey-zimmerman'],
				],
				[
					'2026-04-02',
					'Leslie Ashby',
					'Set up single sign-on for the office team with Dean.',
					'call',
					['dean-whitfield'],
				],
				['2026-03-10', 'Leslie Ashby', 'Moved Ruth to paying by bank transfer.', 'call', ['ruth-boyle']],
			],
			orders: [['#471', '2026-10-06', '20 SMS credit packs', 500, 'placed']],
		},
		{
			id: 'oakhaven',
			name: 'Oakhaven Studio',
			trade: 'homecare',
			health: 84,
			tickets: 1,
			owner: 'Quentin Cook',
			plan: 'enterprise',
			seats: 64,
			used: 58,
			status: 'active',
			since: '2022-05-02',
			renews: '2027-05-02',
			no: '#10217',
			sub: '#30425',
			branches: 'Stamford, Plattsburgh',
			region: 'Northeast',
			tz: 'America/New_York',
			city: 'Stamford, CT',
			phone: '+1 203 555 0100',
			site: 'oakhavenstudio.com',
			address: ['220 Juniper St, Suite 1400', 'Stamford, CT 06901', 'United States'],
			people: [
				contact('Todd Bishop', 'Owner', 'decision', '+1 203 555 0124', {
					main: true,
					note: 'Opening a second branch. Prefers a call to a long email.',
				}),
				contact('Lindsay Kinney', 'Care manager', 'champion', '+1 203 555 0181', {
					hours: [7, 16],
					note: 'Runs 30 carers and asked for the Customer Portal.',
				}),
				contact('Lyle Reeves', 'IT manager', 'admin', '+1 203 555 0136', {
					note: 'Looks after sign-in and anything that touches their accounts system.',
				}),
			],
			deals: [
				{
					name: 'Customer Portal for all 64 seats',
					stage: 'discovery',
					value: 3072,
					closes: '2026-12-15',
					plan: 'enterprise',
					seats: 64,
					next: 'Price the portal for both branches.',
					people: [
						['trent-bishop', 'Signs'],
						['lindsay-kinney', 'Asked for it'],
					],
				},
			],
			activity: [
				[
					'2026-10-08',
					'Lindsay Kinney',
					'Booked 6 training sessions for the new hires.',
					'update',
					['lindsay-kinney'],
				],
				[
					'2026-10-01',
					'Quentin Cook',
					'Demoed the Customer Portal to the care team.',
					'meeting',
					['lindsay-kinney'],
				],
				['2026-09-18', 'Lyle Reeves', 'Turned on single sign-on for every carer.', 'update', ['lyle-reeves']],
				[
					'2026-08-27',
					'Quentin Cook',
					'Agreed a call with Todd in November about the second branch.',
					'call',
					['trent-bishop'],
				],
			],
			orders: [
				['#478', '2026-10-08', '6 training sessions', 2373, 'paid'],
				['#455', '2026-10-05', '16 SMS credit packs', 452, 'picking'],
				['#431', '2026-09-19', 'Data import, training, 20 SMS packs', 1693.87, 'picking'],
				['#418', '2026-09-04', '1 training session, 4 SMS packs', 508.5, 'delivered'],
			],
			store: [21480, 108],
		},
		{
			id: 'avocet',
			name: 'Avocet Robotics',
			trade: 'petcare',
			health: 86,
			tickets: 0,
			owner: 'Tony Aldridge',
			plan: 'growth',
			seats: 22,
			used: 21,
			status: 'active',
			since: '2024-11-20',
			renews: '2026-11-20',
			no: '#11806',
			sub: '#30432',
			branches: 'Duluth',
			region: 'Midwest',
			tz: 'America/Chicago',
			city: 'Duluth, MN',
			phone: '+1 218 555 0100',
			site: 'avocetrobotics.com',
			address: ['1418 Birch St, Unit 4', 'Duluth, MN 55802', 'United States'],
			people: [
				contact('Addison Brennan', 'Managing director', 'decision', '+1 218 555 0177', {
					main: true,
					note: 'Weighing Max for audit logs and single sign-on.',
				}),
				contact('Chester Doyle', 'Office manager', 'billing', '+1 218 555 0109', {
					note: 'Needs a purchase order number on every invoice.',
				}),
			],
			deals: [
				{
					name: 'Move to Max at 22 seats',
					stage: 'proposal',
					value: 5720,
					closes: '2026-11-20',
					plan: 'enterprise',
					seats: 22,
					next: 'Go through the proposal with Addison and answer the photo question.',
					people: [
						['addison-brennan', 'Signs'],
						['chester-doyle', 'Pays'],
					],
				},
			],
			activity: [
				[
					'2026-10-08',
					'Chester Doyle',
					'Bought 4 SMS credit packs for reminders.',
					'update',
					['chester-doyle'],
				],
				[
					'2026-10-05',
					'Tony Aldridge',
					'Sent the Max proposal with audit logs and SSO.',
					'email',
					['addison-brennan'],
				],
				[
					'2026-09-21',
					'Addison Brennan',
					'Asked how long visit photos are kept.',
					'email',
					['addison-brennan'],
				],
				[
					'2026-09-16',
					'Tony Aldridge',
					'Quarterly review: Addison wants audit logs before the renewal.',
					'meeting',
					['addison-brennan'],
				],
				[
					'2026-09-03',
					'Tony Aldridge',
					'Sent the September invoice with their PO number.',
					'email',
					['chester-doyle'],
				],
			],
			orders: [
				['#477', '2026-10-08', '4 SMS credit packs', 123, 'paid'],
				['#457', '2026-10-07', '2 training sessions', 861, 'paid'],
				['#419', '2026-09-05', 'Data import, training, 2 SMS packs', 1290.27, 'delivered'],
			],
			store: [880, 7],
		},
		{
			id: 'highpoint',
			name: 'Highpoint Outfitters',
			trade: 'homecare',
			health: 88,
			tickets: 0,
			owner: 'John Armstrong',
			plan: 'enterprise',
			seats: 31,
			used: 29,
			portal: true,
			status: 'active',
			since: '2020-12-08',
			renews: '2026-12-08',
			no: '#10044',
			sub: '#30439',
			limit: 25000,
			pay: 'Bank transfer, 30 days',
			flag: 'Flagship account',
			branches: 'Concord, Scranton, Keene',
			region: 'Northeast',
			tz: 'America/New_York',
			city: 'Concord, NH',
			phone: '+1 603 555 0100',
			site: 'highpointoutfitters.com',
			address: ['PO Box 6532', 'Concord, NH 03301', 'United States'],
			people: [
				contact('Connie Sexton', 'Operations director', 'champion', '+1 603 555 0192', {
					main: true,
					note: 'Main contact for the account. Buys SMS credits in bulk.',
				}),
				contact('Dan Mercer', 'Purchasing manager', 'decision', '+1 603 555 0137', {
					note: 'Signs anything over $10k. Likes a one-page summary.',
				}),
				contact('Marie Tremblay', 'Accounts payable', 'billing', '+1 603 555 0152', {
					note: 'Pays on 30-day terms, by bank transfer.',
				}),
				contact('Joel Fowler', 'Scranton branch lead', 'admin', '+1 570 555 0164', {
					note: 'Runs the Scranton office and its weekly roster.',
				}),
			],
			deals: [
				{
					name: '12 seats for the Portsmouth branch',
					stage: 'discovery',
					value: 6960,
					closes: '2027-01-15',
					plan: 'enterprise',
					seats: 43,
					next: 'Price 12 more seats once the Portsmouth lease is signed.',
					people: [
						['dan-mercer', 'Signs'],
						['connie-sexton', 'Asked for it'],
					],
				},
			],
			quotes: [
				{
					id: '#442',
					title: 'Portsmouth set-up',
					meta: '12 staff set-ups',
					sent: '2026-10-02',
					expires: '2026-10-22',
					amount: 9804,
				},
			],
			booking: {
				title: 'Portsmouth team training',
				meta: 'Live Training, 9 carers',
				on: '2027-01-14',
				amount: 350,
			},
			activity: [
				[
					'2026-10-08',
					'John Armstrong',
					'Portsmouth branch opens in January. Dan signs off the set-up quote by the 22nd.',
					'note',
					['dan-mercer'],
				],
				[
					'2026-10-07',
					'Connie Sexton',
					'Bought SMS credits for the Keene reminders.',
					'update',
					['connie-sexton'],
				],
				[
					'2026-10-06',
					'John Armstrong',
					'Planned the December renewal. They want a price for 12 more seats once Portsmouth opens.',
					'call',
					['connie-sexton'],
				],
				[
					'2026-10-05',
					'Alexis Boone',
					'Day plan skipped a visit on two Keene rounds. Fixed the same day and the ticket closed.',
					'note',
					[],
				],
				[
					'2026-10-02',
					'Quentin Cook',
					'Sent quote #442 for the Portsmouth set-up: onboarding, training and 12 seats.',
					'email',
					['dan-mercer'],
				],
				[
					'2026-09-24',
					'John Armstrong',
					'Quarterly review. Visits per week are up a third since the summer.',
					'meeting',
					['connie-sexton', 'dan-mercer'],
				],
				[
					'2026-09-17',
					'Hope Stout',
					'Sent the receipt for the seats added in September, paid by bank transfer.',
					'email',
					['marie-tremblay'],
				],
				[
					'2026-09-15',
					'Quentin Cook',
					'Scranton wants a second training session for staff. Added to the next order.',
					'call',
					['joel-fowler'],
				],
				[
					'2026-09-02',
					'Courtney Lowry',
					'Scheduling training in Concord for nine office staff.',
					'meeting',
					['connie-sexton'],
				],
			],
			team: [
				['John Armstrong', 'Account owner'],
				['Quentin Cook', 'Account executive'],
				['Alexis Boone', 'Support'],
				['Hope Stout', 'Billing'],
			],
			orders: [
				['#474', '2026-10-07', '20 SMS credit packs', 525, 'paid'],
				['#456', '2026-10-06', '1 training session', 367.5, 'picking'],
				['#424', '2026-09-13', 'Data import, 1 training, 8 SMS packs', 1258.95, 'paid'],
			],
			store: [16920, 82],
		},
		{
			id: 'lakeside',
			name: 'Lakeside Apparel',
			trade: 'petcare',
			health: 82,
			tickets: 0,
			owner: 'Leslie Ashby',
			plan: 'growth',
			seats: 30,
			used: 29,
			status: 'active',
			since: '2023-07-10',
			renews: '2027-07-10',
			no: '#11342',
			sub: '#30446',
			region: 'Midwest',
			tz: 'America/Chicago',
			city: 'Minneapolis, MN',
			phone: '+1 612 555 0100',
			site: 'lakesideapparel.com',
			address: ['3100 Hennepin Ave S', 'Minneapolis, MN 55408', 'United States'],
			people: [
				contact('Mae Morrow', 'General manager', 'decision', '+1 612 555 0177', {
					main: true,
					note: 'Uses 29 of 30 seats every week. Likes short updates.',
				}),
				contact('Gerald Gallagher', 'Scheduler', 'admin', '+1 612 555 0109', {
					hours: [7, 16],
					note: 'Imported 6,200 customer addresses in August.',
				}),
			],
			deals: [],
			activity: [
				['2026-09-24', 'Leslie Ashby', 'Health check: 29 of 30 seats used every week.', 'call', ['mae-morrow']],
				[
					'2026-09-17',
					'Gerald Gallagher',
					'Booked a training session for two new walkers.',
					'update',
					['gerald-gallagher'],
				],
				['2026-09-09', 'Mae Morrow', 'Thanked the team for the dog-walk visit form.', 'email', ['mae-morrow']],
				[
					'2026-08-19',
					'Leslie Ashby',
					'Cleaned up the duplicates left by the address import.',
					'email',
					['gerald-gallagher'],
				],
			],
			orders: [
				['#428', '2026-09-17', 'Training, data import, 4 SMS packs', 1174.56, 'picking'],
				['#414', '2026-08-24', '1 training session', 350, 'canceled'],
			],
			store: [10280, 58],
		},
		{
			id: 'larchwood',
			name: 'Larchwood Studios',
			trade: 'photography',
			health: 74,
			tickets: 1,
			owner: 'Quentin Cook',
			plan: 'starter',
			seats: 12,
			used: 12,
			status: 'active',
			since: '2024-10-29',
			renews: '2026-10-29',
			no: '#12290',
			sub: '#30453',
			region: 'West',
			tz: 'America/Los_Angeles',
			city: 'Eugene, OR',
			phone: '+1 503 555 0100',
			site: 'larchwoodstudios.com',
			address: ['915 SE Hawthorne Blvd', 'Eugene, OR 97214', 'United States'],
			people: [
				contact('Jordan Pike', 'Owner', 'decision', '+1 503 555 0138', {
					main: true,
					note: 'Renews on October 29. Wants recurring shoots and quotes.',
				}),
				contact('Sasha Klein', 'Office coordinator', 'billing', '+1 503 555 0172', {
					note: 'Pays by card. Asked for one invoice a year.',
				}),
			],
			deals: [
				{
					name: 'Move to Pro at 12 seats',
					stage: 'proposal',
					value: 2040,
					closes: '2026-10-29',
					plan: 'growth',
					seats: 12,
					next: 'Jordan decides before the renewal on the 29th.',
					people: [
						['jordan-pike', 'Signs'],
						['sasha-klein', 'Pays'],
					],
				},
			],
			activity: [
				['2026-10-02', 'Quentin Cook', 'Sent the Pro proposal before the renewal.', 'email', ['jordan-pike']],
				['2026-09-22', 'Jordan Pike', 'Asked for recurring shoots and quotes.', 'call', ['jordan-pike']],
				[
					'2026-09-12',
					'Sasha Klein',
					'Canceled an SMS pack order placed twice by mistake.',
					'update',
					['sasha-klein'],
				],
				['2026-09-01', 'Quentin Cook', 'Renewal reminder sent, 60 days out.', 'email', ['sasha-klein']],
			],
			orders: [['#423', '2026-09-12', '4 SMS credit packs', 100, 'canceled']],
			store: [3520, 24],
		},
		{
			id: 'moorings',
			alias: ['harborpest'],
			name: 'Harborline AI',
			trade: 'property',
			health: 79,
			tickets: 0,
			owner: 'John Armstrong',
			plan: 'growth',
			seats: 18,
			used: 17,
			sms: 2,
			status: 'active',
			since: '2024-06-03',
			renews: '2027-06-03',
			no: '#11520',
			sub: '#30460',
			region: 'South',
			tz: 'America/New_York',
			city: 'Tampa, FL',
			phone: '+1 813 555 0100',
			site: 'harborlineai.com',
			address: ['4802 W Kennedy Blvd', 'Tampa, FL 33609', 'United States'],
			people: [
				contact('Denise Quigley', 'Owner', 'decision', '+1 813 555 0164', {
					main: true,
					note: 'Busy season. Decides within a week once she has the numbers.',
				}),
				contact('Travis Teague', 'Rounds manager', 'champion', '+1 813 555 0145', {
					hours: [7, 16],
					note: 'Reminders cut missed visits by a third on his rounds.',
				}),
			],
			deals: [
				{
					name: 'SMS credits, 10,000 a month',
					stage: 'proposal',
					value: 3000,
					closes: '2026-10-27',
					plan: 'growth',
					seats: 18,
					next: 'Denise wants the numbers on missed visits first.',
					people: [
						['denise-quigley', 'Signs'],
						['travis-teague', 'Asked for it'],
					],
				},
			],
			activity: [
				[
					'2026-10-05',
					'Travis Teague',
					'Bought 12 SMS credit packs for reminders.',
					'update',
					['travis-teague'],
				],
				[
					'2026-10-03',
					'John Armstrong',
					'Quoted 10,000 SMS credits a month for visit reminders.',
					'email',
					['denise-quigley'],
				],
				[
					'2026-09-17',
					'John Armstrong',
					'Travis shared how reminders cut missed visits by a third.',
					'call',
					['travis-teague'],
				],
				[
					'2026-08-30',
					'John Armstrong',
					'Set up text reminders for the Tampa rounds.',
					'call',
					['denise-quigley'],
				],
			],
			orders: [
				['#454', '2026-10-05', '12 SMS credit packs', 318, 'dispatched'],
				['#422', '2026-09-11', '1 training, 4,000 SMS', 450, 'delivered'],
			],
			store: [2940, 21],
		},
		{
			id: 'copperleaf',
			name: 'Copperleaf Design',
			trade: 'cleaning',
			health: 41,
			tickets: 3,
			owner: 'Tony Aldridge',
			plan: 'growth',
			seats: 26,
			used: 19,
			status: 'pastdue',
			statusOn: '2026-09-26',
			invoice: '#904',
			since: '2024-09-26',
			renews: '2027-09-26',
			no: '#11177',
			sub: '#30467',
			pay: 'Card ending 3196',
			region: 'Midwest',
			tz: 'America/Chicago',
			city: 'Ames, IA',
			phone: '+1 515 555 0500',
			site: 'copperleafdesign.com',
			address: ['12 Hickory St', 'Ames, IA 50010', 'United States'],
			note: 'The card ending 3196 was declined on Sep 26. Gail asked to pay by bank transfer instead.',
			people: [
				contact('Leslie Price', 'Operations manager', 'decision', '+1 515 555 0571', {
					main: true,
					note: 'Interested in the Customer Portal for all 26 seats.',
				}),
				contact('Fred Andrews', 'Team lead', 'champion', '+1 515 555 0588', {
					note: 'Trains every new cleaner on the app himself.',
				}),
				contact('Gail Lowe', 'Bookkeeper', 'billing', '+1 515 555 0523', {
					hours: [9, 15],
					note: 'Works until 3:00 pm. Best reached in the morning.',
				}),
			],
			deals: [
				{
					name: 'Customer Portal for 26 seats',
					stage: 'discovery',
					value: 1248,
					closes: '2026-12-04',
					plan: 'growth',
					seats: 26,
					next: 'Wait until the overdue renewal is paid.',
					people: [
						['leslie-price', 'Signs'],
						['fred-andrews', 'Asked for it'],
					],
				},
			],
			activity: [
				[
					'2026-10-04',
					'Tony Aldridge',
					'Introduced the Customer Portal to Leslie.',
					'meeting',
					['leslie-price'],
				],
				[
					'2026-09-29',
					'Tony Aldridge',
					'Reminded Gail about the unpaid renewal, #904.',
					'email',
					['gail-lowe'],
				],
				['2026-09-27', 'Gail Lowe', 'Asked to pay by bank transfer instead of card.', 'email', ['gail-lowe']],
				['2026-09-24', 'Fred Andrews', 'Asked for a checklist for each room type.', 'call', ['fred-andrews']],
				[
					'2026-09-07',
					'Tony Aldridge',
					'Ran a live training session for the new team leads.',
					'meeting',
					['fred-andrews'],
				],
			],
			orders: [['#420', '2026-09-07', 'Live training session', 430.5, 'delivered']],
			store: [1460, 12],
		},
		{
			id: 'ironbridge',
			name: 'Ironbridge Fintech',
			trade: 'cleaning',
			health: 70,
			tickets: 0,
			owner: 'Tony Aldridge',
			plan: 'starter',
			seats: 9,
			used: 8,
			status: 'active',
			since: '2025-11-02',
			renews: '2026-11-02',
			no: '#12613',
			sub: '#30474',
			region: 'Midwest',
			tz: 'America/Chicago',
			city: 'Minot, ND',
			phone: '+1 701 555 0100',
			site: 'ironbridgefintech.com',
			address: ['48 4th Ave', 'Minot, ND 58701', 'United States'],
			people: [
				contact('Leon Marsh', 'Director', 'decision', '+1 701 555 0142', {
					main: true,
					note: 'Renews on November 2. Steady use, no open issues.',
				}),
				contact('Kerry Wade', 'Scheduler', 'admin', '+1 701 555 0167', {
					note: 'Moves seats to new starters as the team changes.',
				}),
			],
			deals: [],
			activity: [
				[
					'2026-10-06',
					'Tony Aldridge',
					'Booked a renewal call with Leon for October 20.',
					'call',
					['leon-marsh'],
				],
				['2026-09-25', 'Kerry Wade', 'Moved two seats to new starters.', 'email', ['kerry-wade']],
				['2026-09-18', 'Kerry Wade', 'Bought a data import and SMS credits.', 'update', ['kerry-wade']],
				[
					'2026-09-04',
					'Tony Aldridge',
					'First-year review: steady use, no open issues.',
					'meeting',
					['leon-marsh'],
				],
			],
			orders: [['#429', '2026-09-18', 'Data import, 8 SMS credit packs', 1018.8, 'paid']],
		},
		{
			id: 'brightline',
			name: 'Brightline Photography',
			trade: 'photography',
			health: 87,
			tickets: 0,
			owner: 'Thomas Morrison',
			plan: 'growth',
			seats: 34,
			used: 33,
			status: 'active',
			since: '2023-09-18',
			renews: '2027-09-18',
			no: '#11468',
			sub: '#30481',
			branches: 'Olympia, Bellingham',
			region: 'West',
			tz: 'America/Los_Angeles',
			city: 'Olympia, WA',
			phone: '+1 360 555 0100',
			site: 'brightlinephoto.com',
			address: ['44 Laurel St', 'Olympia, WA 98501', 'United States'],
			people: [
				contact('Carl Jensen', 'Managing director', 'decision', '+1 360 555 0153', {
					main: true,
					note: 'Calls in his morning work best: he is on Pacific time.',
				}),
				contact('Amy Combs', 'Operations lead', 'champion', '+1 360 555 0179', {
					note: 'Hiring ten assistants in November.',
				}),
			],
			deals: [
				{
					name: 'Ten more photographer seats',
					stage: 'negotiation',
					value: 3200,
					closes: '2026-10-30',
					plan: 'growth',
					seats: 44,
					next: 'Carl signs the order form for the ten assistants.',
					people: [
						['carl-jensen', 'Signs'],
						['amy-combs', 'Asked for it'],
					],
				},
			],
			activity: [
				['2026-10-05', 'Thomas Morrison', 'Sent the order form for ten more seats.', 'email', ['carl-jensen']],
				[
					'2026-09-26',
					'Thomas Morrison',
					'Planned onboarding for the ten assistants with Amy.',
					'call',
					['amy-combs'],
				],
				[
					'2026-09-08',
					'Thomas Morrison',
					'Set up the Bellingham branch as a second team.',
					'meeting',
					['amy-combs'],
				],
			],
			orders: [],
		},
		{
			id: 'evergreen',
			name: 'Evergreen Landscaping',
			trade: 'landscaping',
			health: 76,
			tickets: 0,
			owner: 'Thomas Morrison',
			plan: 'starter',
			seats: 14,
			used: 13,
			status: 'active',
			since: '2025-01-20',
			renews: '2027-01-20',
			no: '#12355',
			sub: '#30488',
			region: 'West',
			tz: 'America/Denver',
			city: 'Santa Fe, NM',
			phone: '+1 505 555 0100',
			site: 'evergreenlandscaping.com',
			address: ['15 Aspen St', 'Santa Fe, NM 87501', 'United States'],
			people: [
				contact('Martha Tate', 'Owner', 'decision', '+1 505 555 0127', {
					main: true,
					note: 'Fall rush: weekly visits up 40% since August.',
				}),
				contact('Rory Whitcombe', 'Team lead', 'admin', '+1 505 555 0184', {
					hours: [7, 16],
					note: 'Plans the mowing rounds for six crews.',
				}),
			],
			deals: [],
			activity: [
				['2026-10-02', 'Rory Whitcombe', 'Bought SMS credits for the new crews.', 'update', ['rory-whitcombe']],
				[
					'2026-09-28',
					'Thomas Morrison',
					'Fall review with Martha: weekly visits up 40%.',
					'call',
					['martha-tate'],
				],
				[
					'2026-09-14',
					'Thomas Morrison',
					'Answered Rory about recurring mowing rounds.',
					'email',
					['rory-whitcombe'],
				],
			],
			orders: [['#453', '2026-10-02', '2 training sessions', 805, 'delivered']],
		},
		{
			id: 'cornerstone',
			name: 'Cornerstone Logistics',
			trade: 'moving',
			health: 77,
			tickets: 0,
			owner: 'Quentin Cook',
			plan: 'growth',
			seats: 20,
			used: 18,
			status: 'active',
			since: '2024-05-22',
			renews: '2027-05-22',
			no: '#11733',
			sub: '#30495',
			region: 'South',
			tz: 'America/Chicago',
			city: 'Plano, TX',
			phone: '+1 214 555 0100',
			site: 'cornerstonelogistics.com',
			address: ['2200 Ross Ave', 'Plano, TX 75201', 'United States'],
			people: [
				contact('Bill Hargrove', 'President', 'decision', '+1 214 555 0119', {
					main: true,
					note: 'Wants moves planned before peak season.',
				}),
				contact('Tasha Reid', 'Estimator', 'champion', '+1 214 555 0172', {
					note: 'Writes quotes on site. Uses photo checklists in every home.',
				}),
			],
			deals: [
				{
					name: 'Travel Planner for 20 seats',
					stage: 'discovery',
					value: 1440,
					closes: '2026-12-01',
					plan: 'growth',
					seats: 20,
					next: 'Show Bill a peak-season day plan.',
					people: [
						['bill-hargrove', 'Signs'],
						['tasha-reid', 'Tries it first'],
					],
				},
			],
			activity: [
				[
					'2026-09-30',
					'Quentin Cook',
					'First call with Bill about Travel Planner for peak season.',
					'meeting',
					['bill-hargrove'],
				],
				[
					'2026-09-16',
					'Quentin Cook',
					'Tasha has photo checklists on every survey now.',
					'call',
					['tasha-reid'],
				],
				['2026-09-02', 'Tasha Reid', 'Bought 2,000 SMS credits for move-day alerts.', 'update', ['tasha-reid']],
			],
			orders: [['#417', '2026-09-02', '2,000 SMS credits', 58, 'delivered']],
			store: [410, 3],
		},
		{
			id: 'polarair',
			name: 'Polaris Running Co. Group',
			trade: 'homecare',
			health: 82,
			tickets: 0,
			owner: 'Thomas Morrison',
			plan: 'growth',
			seats: 16,
			used: 15,
			sms: 2,
			status: 'active',
			since: '2024-11-11',
			renews: '2026-11-11',
			no: '#11931',
			sub: '#30502',
			region: 'West',
			tz: 'America/Phoenix',
			city: 'Flagstaff, AZ',
			phone: '+1 928 555 0100',
			site: 'polarisrunningco.com',
			address: ['10 Spruce St, Suite 512', 'Flagstaff, AZ 86001', 'United States'],
			renewal: { quote: '#440', seats: 22, sent: '2026-10-06', signer: 'derrick-yost' },
			people: [
				contact('Derrick Yost', 'Care operations manager', 'decision', '+1 928 555 0148', {
					main: true,
					note: 'Two new home care contracts start in November.',
				}),
				contact('Liz Wynn Tan', 'Finance executive', 'billing', '+1 928 555 0163', {
					hours: [9, 18],
					note: 'Needs invoices with sales tax on its own line.',
				}),
			],
			deals: [
				{
					name: 'Six more carer seats',
					stage: 'proposal',
					value: 1920,
					closes: '2026-11-11',
					plan: 'growth',
					seats: 22,
					next: 'Add the six seats to the renewal quote.',
					people: [
						['derrick-yost', 'Signs'],
						['li-wen-tan', 'Pays'],
					],
				},
			],
			activity: [
				[
					'2026-10-06',
					'Thomas Morrison',
					'Sent the renewal quote with six more seats.',
					'email',
					['derrick-yost'],
				],
				[
					'2026-09-18',
					'Liz Wynn Tan',
					'Bought a data import, training and SMS credits.',
					'update',
					['li-wen-tan'],
				],
				['2026-09-07', 'Thomas Morrison', 'Sent Liz Wynn the yearly billing options.', 'email', ['li-wen-tan']],
			],
			orders: [
				['#430', '2026-09-18', 'Data import, 1 training, SMS', 1197.91, 'dispatched'],
				['#415', '2026-08-28', 'Live training, 4 SMS packs', 490.5, 'delivered'],
			],
			store: [4780, 29],
		},
		{
			id: 'bluepeak',
			name: 'Bluepeak Studios',
			trade: 'photography',
			health: 78,
			tickets: 1,
			owner: 'John Armstrong',
			plan: 'enterprise',
			seats: 42,
			used: 38,
			status: 'active',
			since: '2022-06-30',
			renews: '2027-07-01',
			no: '#10655',
			sub: '#30509',
			pay: 'Bank transfer, 30 days',
			region: 'West',
			tz: 'America/Denver',
			city: 'Boulder, CO',
			phone: '+1 303 555 0200',
			site: 'bluepeakstudios.com',
			address: ['3001 Brighton Blvd', 'Boulder, CO 80216', 'United States'],
			people: [
				contact('Rachel Beck', 'Chief executive', 'decision', '+1 303 555 0124', {
					main: true,
					note: 'Reading the Customer Portal order form this week.',
				}),
				contact('Andre Mills', 'Systems administrator', 'admin', '+1 303 555 0181', {
					note: 'Connected QuickBooks for invoice sync.',
				}),
				contact('Pamela Rudd', 'Controller', 'billing', '+1 303 555 0136', {
					note: 'Approves any purchase over $2,000.',
				}),
			],
			deals: [
				{
					name: 'Customer Portal for 42 seats',
					stage: 'negotiation',
					value: 2016,
					closes: '2026-10-21',
					plan: 'enterprise',
					seats: 42,
					next: 'Rachel returns the signed order form.',
					people: [
						['rachel-beck', 'Signs'],
						['pamela-rudd', 'Pays'],
					],
				},
			],
			activity: [
				[
					'2026-10-07',
					'John Armstrong',
					'Sent Rachel the Customer Portal order form.',
					'email',
					['rachel-beck'],
				],
				['2026-09-27', 'Andre Mills', 'Connected QuickBooks for invoice sync.', 'update', ['andre-mills']],
				[
					'2026-09-15',
					'Pamela Rudd',
					'Paid for the onboarding package for the new office.',
					'update',
					['pamela-rudd'],
				],
				[
					'2026-09-10',
					'John Armstrong',
					'Quarterly review with Rachel and Pamela.',
					'meeting',
					['rachel-beck', 'pamela-rudd'],
				],
			],
			orders: [['#426', '2026-09-15', 'Onboarding package', 1375, 'delivered']],
			store: [7120, 41],
		},
		{
			id: 'solaris',
			name: 'Solaris Photography',
			trade: 'photography',
			health: 80,
			tickets: 0,
			owner: 'Jeffrey McKay',
			plan: 'growth',
			seats: 24,
			used: 22,
			status: 'active',
			since: '2024-07-25',
			renews: '2027-07-25',
			no: '#11602',
			sub: '#30516',
			region: 'South',
			tz: 'America/New_York',
			city: 'Knoxville, TN',
			phone: '+1 865 555 0100',
			site: 'solarisphoto.com',
			address: ['1500 Magnolia St', 'Knoxville, TN 37902', 'United States'],
			people: [
				contact('Randall Hatcher', 'Studio director', 'decision', '+1 865 555 0142', {
					main: true,
					note: 'Asking about audit logs and SSO before moving to Max.',
				}),
				contact('Luna Padgett', 'Coordinator', 'admin', '+1 865 555 0167', {
					note: 'Switched the workspace to Spanish for the crews.',
				}),
			],
			deals: [
				{
					name: 'Move to Max at 24 seats',
					stage: 'discovery',
					value: 6240,
					closes: '2027-01-25',
					plan: 'enterprise',
					seats: 24,
					next: 'Send Randall the security overview.',
					people: [['randall-hatcher', 'Signs']],
				},
			],
			activity: [
				[
					'2026-10-02',
					'Jeffrey McKay',
					'Discovery call with Randall about audit logs and SSO.',
					'meeting',
					['randall-hatcher'],
				],
				[
					'2026-09-20',
					'Jeffrey McKay',
					'Helped Luna switch the workspace to Spanish.',
					'email',
					['lori-padgett'],
				],
				[
					'2026-09-05',
					'Jeffrey McKay',
					'Shared two case studies from Tennessee.',
					'email',
					['randall-hatcher'],
				],
			],
			orders: [],
		},
		{
			id: 'tidewater',
			name: 'Tidewater Swimwear',
			trade: 'petcare',
			health: 81,
			tickets: 0,
			owner: 'John Armstrong',
			plan: 'starter',
			seats: 8,
			used: 8,
			status: 'active',
			since: '2025-02-27',
			renews: '2027-02-27',
			no: '#12408',
			sub: '#30523',
			region: 'Northeast',
			tz: 'America/New_York',
			city: 'Buffalo, NY',
			phone: '+1 716 555 0100',
			site: 'tidewaterswimwear.com',
			address: ['1600 Walnut St', 'Buffalo, NY 14202', 'United States'],
			people: [
				contact('Ian MacLeod', 'Owner', 'decision', '+1 716 555 0118', {
					main: true,
					hours: [7, 16],
					note: 'Adding a seat for each new dog walker.',
				}),
			],
			deals: [],
			activity: [
				['2026-09-26', 'Ian MacLeod', 'Added a seat for a new dog walker.', 'update', ['ian-macleod']],
				[
					'2026-09-11',
					'John Armstrong',
					'Sent Ian the winter same-day visit template.',
					'email',
					['ian-macleod'],
				],
				['2026-08-21', 'John Armstrong', 'Six-month check-in with Ian, all good.', 'call', ['ian-macleod']],
			],
			orders: [],
		},
		{
			id: 'halden',
			name: 'Halden Robotics',
			trade: 'moving',
			health: 75,
			tickets: 1,
			owner: 'Elise Vick',
			plan: 'growth',
			seats: 15,
			used: 14,
			status: 'active',
			since: '2025-04-09',
			renews: '2027-04-09',
			no: '#12521',
			sub: '#30530',
			region: 'Midwest',
			tz: 'America/Chicago',
			city: 'Topeka, KS',
			phone: '+1 785 555 0100',
			site: 'haldenrobotics.com',
			address: ['18 Chestnut St', 'Topeka, KS 66603', 'United States'],
			people: [
				contact('Cheryl Halden', 'Owner', 'decision', '+1 785 555 0193', {
					main: true,
					hours: [7, 16],
					note: 'Set up winter moving checklists for every crew.',
				}),
				contact('Marvin Dahl', 'Project lead', 'champion', '+1 785 555 0145', {
					note: 'Wants move photos in the customer report.',
				}),
			],
			deals: [],
			activity: [
				[
					'2026-10-01',
					'Elise Vick',
					'Set up winter moving checklists with Cheryl.',
					'meeting',
					['cheryl-halden'],
				],
				['2026-09-24', 'Marvin Dahl', 'Booked 4 training sessions for the crews.', 'update', ['marvin-dahl']],
				['2026-09-18', 'Marvin Dahl', 'Asked for move photos in the customer report.', 'call', ['marvin-dahl']],
			],
			orders: [['#466', '2026-09-24', '4 training sessions', 1750, 'placed']],
		},
		{
			id: 'millrace',
			name: 'Millrace Ceramics',
			trade: 'cleaning',
			health: 68,
			tickets: 1,
			owner: 'Quentin Cook',
			plan: 'growth',
			seats: 28,
			used: 24,
			status: 'active',
			since: '2023-12-09',
			renews: '2026-12-09',
			no: '#11285',
			sub: '#30537',
			region: 'Midwest',
			tz: 'America/Chicago',
			city: 'Evanston, IL',
			phone: '+1 312 555 0100',
			site: 'millraceceramics.com',
			address: ['1040 W Fulton Market', 'Evanston, IL 60607', 'United States'],
			people: [
				contact('Angela Ashby', 'Owner', 'decision', '+1 312 555 0138', {
					main: true,
					note: 'Renewal review booked for November 18.',
				}),
				contact('Tom Vance', 'Area supervisor', 'champion', '+1 312 555 0172', {
					hours: [6, 15],
					note: 'Crews lose 40 minutes a day driving between offices.',
				}),
				contact('Robyn Duffy', 'Payroll and billing', 'billing', '+1 312 555 0153', {
					note: 'Runs payroll on Fridays, so call another day.',
				}),
			],
			deals: [
				{
					name: 'Travel Planner for 28 seats',
					stage: 'proposal',
					value: 2016,
					closes: '2026-11-18',
					plan: 'growth',
					seats: 28,
					next: 'Tom reports back on the North Side trial.',
					people: [
						['angela-ashby', 'Signs'],
						['tom-vance', 'Asked for it'],
					],
				},
			],
			activity: [
				[
					'2026-10-03',
					'Quentin Cook',
					'Sent Tom a Travel Planner trial for the North Side crews.',
					'email',
					['tom-vance'],
				],
				['2026-09-24', 'Tom Vance', 'Crews lose 40 minutes a day between offices.', 'call', ['tom-vance']],
				[
					'2026-09-09',
					'Quentin Cook',
					'Booked the renewal review with Angela for November 18.',
					'meeting',
					['angela-ashby'],
				],
				[
					'2026-08-28',
					'Quentin Cook',
					'Sent Robyn the new invoice layout with crew hours.',
					'email',
					['robyn-duffy'],
				],
			],
			orders: [],
		},
		{
			id: 'downland',
			name: 'Downland Cloud',
			trade: 'property',
			health: 73,
			tickets: 0,
			owner: 'Thomas Morrison',
			plan: 'starter',
			seats: 10,
			used: 9,
			status: 'active',
			since: '2025-03-03',
			renews: '2027-03-03',
			no: '#12447',
			sub: '#30544',
			region: 'West',
			tz: 'America/Denver',
			city: 'Cheyenne, WY',
			phone: '+1 307 555 0100',
			site: 'downlandcloud.com',
			address: ['88 Poplar St', 'Cheyenne, WY 82001', 'United States'],
			people: [
				contact('Paul Hendry', 'Owner', 'decision', '+1 307 555 0127', {
					main: true,
					note: 'Asked about move-out inspection templates.',
				}),
				contact('Jess Moana', 'Admin', 'billing', '+1 307 555 0184', {
					note: 'Downloads the invoices at the end of each month.',
				}),
			],
			deals: [],
			activity: [
				['2026-09-29', 'Jess Moana', 'Downloaded the September invoices.', 'update', ['jess-moana']],
				[
					'2026-09-15',
					'Thomas Morrison',
					'Showed Paul repair notes on the visit form.',
					'meeting',
					['paul-hendry'],
				],
				['2026-08-25', 'Paul Hendry', 'Asked about move-out inspection templates.', 'email', ['paul-hendry']],
			],
			orders: [],
		},
		{
			id: 'vistalandscaping',
			name: 'Vista Landscaping',
			trade: 'landscaping',
			health: 43,
			tickets: 1,
			owner: 'Jeffrey McKay',
			plan: 'starter',
			seats: 11,
			used: 6,
			status: 'active',
			since: '2025-11-28',
			renews: '2026-11-24',
			no: '#12688',
			sub: '#30551',
			region: 'South',
			tz: 'America/New_York',
			city: 'Durham, NC',
			phone: '+1 919 555 0200',
			site: 'vistalandscaping.com',
			address: ['1193 Dogwood St', 'Durham, NC 27701', 'United States'],
			note: 'Only 6 of 11 seats used since July. Carrie asked for training before the renewal.',
			people: [
				contact('Carrie Rankin', 'Founder', 'decision', '+1 919 555 0219', {
					main: true,
					note: 'Fewer visits logged since July. Renews on November 24.',
				}),
				contact('Alan Gates', 'Team lead', 'admin', '+1 919 555 0263', {
					note: 'Helped run the refresher for the garden crews.',
				}),
			],
			deals: [],
			activity: [
				[
					'2026-10-05',
					'Jeffrey McKay',
					'Booked the renewal call with Carrie for October 21.',
					'call',
					['carrie-rankin'],
				],
				[
					'2026-09-22',
					'Carrie Rankin',
					'Fewer visits logged since July; asked for training.',
					'email',
					['carrie-rankin'],
				],
				[
					'2026-09-08',
					'Jeffrey McKay',
					'Ran a refresher for the garden crews with Alan.',
					'meeting',
					['alan-gates'],
				],
			],
			orders: [],
		},
		{
			id: 'aspenhollow',
			name: 'Aspen Hollow Pets',
			trade: 'petcare',
			health: 39,
			tickets: 2,
			owner: 'Jeffrey McKay',
			plan: 'growth',
			seats: 19,
			used: 13,
			status: 'pastdue',
			statusOn: '2026-09-19',
			invoice: '#897',
			since: '2024-09-19',
			renews: '2027-09-19',
			no: '#11589',
			sub: '#30558',
			region: 'South',
			tz: 'America/Chicago',
			city: 'Amarillo, TX',
			phone: '+1 806 555 0100',
			site: 'aspenhollowpets.com',
			address: ['1208 Cypress St', 'Amarillo, TX 79101', 'United States'],
			note: 'The bank transfer for the Sep 19 renewal has not arrived. Two reminders sent.',
			people: [
				contact('Floyd Snyder', 'General manager', 'decision', '+1 806 555 0127', {
					main: true,
					note: 'Opening a branch in Wilmington next year.',
				}),
				contact('Valeria Muñoz', 'Administration', 'billing', '+1 806 555 0184', {
					note: 'Wants invoices by email and by mail.',
				}),
			],
			deals: [
				{
					name: 'Five more pet sitter seats',
					stage: 'discovery',
					value: 1600,
					closes: '2027-01-15',
					plan: 'growth',
					seats: 24,
					next: 'Size the Wilmington branch once the renewal is paid.',
					people: [['floyd-snyder', 'Signs']],
				},
			],
			activity: [
				['2026-10-04', 'Floyd Snyder', 'Opening a branch in Wilmington next year.', 'call', ['floyd-snyder']],
				['2026-09-30', 'Jeffrey McKay', 'Second reminder to Valeria about #897.', 'email', ['valeria-munoz']],
				[
					'2026-09-22',
					'Jeffrey McKay',
					'First reminder to Valeria about the renewal payment.',
					'email',
					['valeria-munoz'],
				],
				[
					'2026-09-03',
					'Jeffrey McKay',
					'Quarterly review with Floyd, usage steady.',
					'meeting',
					['floyd-snyder'],
				],
			],
			orders: [],
		},
		{
			id: 'fernhill',
			name: 'Fernhill Gardens',
			trade: 'landscaping',
			health: 84,
			tickets: 0,
			owner: 'Elise Vick',
			plan: 'growth',
			seats: 21,
			used: 20,
			status: 'active',
			since: '2025-07-14',
			renews: '2027-07-14',
			no: '#12734',
			sub: '#30565',
			region: 'Midwest',
			tz: 'America/Chicago',
			city: 'La Crosse, WI',
			phone: '+1 608 555 0100',
			site: 'fernhillgardens.com',
			address: ['21 Hawthorne St', 'La Crosse, WI 54601', 'United States'],
			people: [
				contact('Jean Ross', 'Director', 'decision', '+1 608 555 0153', {
					main: true,
					note: 'Wants crew hours shown on the invoice.',
				}),
				contact('Cameron Fraser', 'Head gardener', 'champion', '+1 608 555 0179', {
					hours: [7, 16],
					note: 'Plans the winter maintenance rounds.',
				}),
			],
			deals: [],
			activity: [
				[
					'2026-09-30',
					'Elise Vick',
					'Set up winter maintenance rounds with Cameron.',
					'meeting',
					['cameron-fraser'],
				],
				['2026-09-16', 'Jean Ross', 'Asked for crew hours on the invoice.', 'call', ['jean-ross']],
				['2026-08-29', 'Elise Vick', 'Sent Jean the invoice layout options.', 'email', ['jean-ross']],
			],
			orders: [],
		},
		{
			id: 'harborline',
			name: 'Moorings Line Studios',
			trade: 'photography',
			health: 66,
			tickets: 2,
			owner: 'Leslie Ashby',
			plan: 'enterprise',
			seats: 58,
			used: 44,
			status: 'active',
			since: '2022-09-19',
			renews: '2027-09-19',
			no: '#10731',
			sub: '#30572',
			pay: 'Bank transfer, 30 days',
			branches: 'Boston, Worcester',
			region: 'Northeast',
			tz: 'America/New_York',
			city: 'Boston, MA',
			phone: '+1 617 555 0100',
			site: 'harborline-studios.com',
			address: ['250 Fallow St', 'Boston, MA 02210', 'United States'],
			people: [
				contact('Courtney Whitman', 'Operations manager', 'decision', '+1 617 555 0163', {
					main: true,
					note: 'Wants the Worcester team using the app every day.',
				}),
				contact('Neil Osborne', 'IT lead', 'admin', '+1 617 555 0129', {
					note: 'Looks after sign-in and the team’s phones.',
				}),
			],
			deals: [],
			activity: [
				['2026-10-02', 'Leslie Ashby', 'Seat use is down at the Worcester branch. Booked a visit.', 'note', []],
				[
					'2026-09-23',
					'Leslie Ashby',
					'Two open tickets about offline mode on location shoots.',
					'call',
					['neil-osborne'],
				],
				[
					'2026-09-10',
					'Leslie Ashby',
					'Quarterly review with Courtney Whitman.',
					'meeting',
					['courtney-whitman'],
				],
			],
			orders: [],
		},
		{
			id: 'redline',
			name: 'Redline Motion',
			trade: 'property',
			health: 89,
			tickets: 0,
			owner: 'Quentin Cook',
			plan: 'growth',
			seats: 42,
			used: 40,
			sms: 4,
			status: 'active',
			since: '2022-10-11',
			renews: '2026-10-11',
			no: '#10783',
			sub: '#30579',
			region: 'South',
			tz: 'America/Chicago',
			city: 'Plano, TX',
			phone: '+1 214 555 0300',
			site: 'redlineproperty.com',
			address: ['1717 Fenner St', 'Plano, TX 75201', 'United States'],
			note: 'Renews on Oct 11 at the same size. Curtis signed the quote on Oct 1.',
			renewal: {
				quote: '#429',
				seats: 42,
				sent: '2026-09-24',
				opened: '2026-09-25',
				signed: '2026-10-01',
				signer: 'curtis-rowe',
			},
			people: [
				contact('Curtis Rowe', 'Operations manager', 'decision', '+1 214 555 0102', {
					main: true,
					note: 'Signed the renewal on October 1. Seven branches across Texas.',
				}),
				contact('Nina Roe', 'Office manager', 'billing', '+1 214 555 0177', {
					note: 'Pays the renewal invoice by card.',
				}),
			],
			deals: [],
			activity: [
				['2026-10-01', 'Curtis Rowe', 'Signed the renewal quote for 42 seats.', 'update', ['curtis-rowe']],
				['2026-09-24', 'Quentin Cook', 'Sent the renewal quote at the same size.', 'email', ['curtis-rowe']],
				['2026-09-12', 'Quentin Cook', 'Checked the card on file with Nina.', 'call', ['nina-roe']],
			],
			orders: [],
		},
		{
			id: 'cedarfell',
			name: 'Cedar Fell Landscaping',
			trade: 'landscaping',
			health: 63,
			tickets: 1,
			owner: 'Leslie Ashby',
			plan: 'starter',
			seats: 14,
			used: 11,
			status: 'active',
			since: '2025-02-17',
			renews: '2027-02-17',
			no: '#12376',
			sub: '#30586',
			region: 'South',
			tz: 'America/New_York',
			city: 'Raleigh, NC',
			phone: '+1 919 555 0100',
			site: 'cedarfelllandscaping.com',
			address: ['410 Glenwood Ave', 'Raleigh, NC 27603', 'United States'],
			people: [
				contact('Gerald Pruitt', 'Crew manager', 'decision', '+1 919 555 0143', {
					main: true,
					note: 'Three crews over the winter, six in spring.',
				}),
			],
			deals: [],
			activity: [
				[
					'2026-09-25',
					'Leslie Ashby',
					'Gerald asked how to pause seats over the winter.',
					'call',
					['gerald-pruitt'],
				],
				[
					'2026-08-28',
					'Leslie Ashby',
					'Sent Gerald the guide to recurring visits.',
					'email',
					['gerald-pruitt'],
				],
			],
			orders: [],
		},
		{
			id: 'ironwood',
			name: 'Ironwood Studio',
			trade: 'moving',
			health: 28,
			tickets: 2,
			owner: 'Quentin Cook',
			plan: 'starter',
			seats: 12,
			used: 6,
			status: 'canceling',
			statusOn: '2026-10-31',
			since: '2025-10-31',
			renews: '2026-10-31',
			no: '#12569',
			sub: '#30593',
			region: 'South',
			tz: 'America/Chicago',
			city: 'Nashville, TN',
			phone: '+1 615 555 0100',
			site: 'ironwoodstudio.com',
			address: ['900 Division St', 'Nashville, TN 37203', 'United States'],
			note: 'Moving to the system their franchise group uses. Ends on Oct 31.',
			people: [
				contact('Wade Collins', 'Owner', 'decision', '+1 615 555 0138', {
					main: true,
					note: 'Joining a franchise group that runs its own system.',
				}),
			],
			deals: [],
			activity: [
				['2026-10-02', 'Wade Collins', 'Asked to cancel at the end of the term.', 'email', ['wade-collins']],
				[
					'2026-09-21',
					'Quentin Cook',
					'Exit call: they are joining a franchise group.',
					'call',
					['wade-collins'],
				],
			],
			orders: [],
		},
		{
			id: 'valleypetcare',
			name: 'Valley Pet Care',
			trade: 'petcare',
			health: 85,
			tickets: 0,
			owner: 'Elise Vick',
			plan: 'growth',
			seats: 33,
			used: 31,
			status: 'active',
			since: '2023-01-23',
			renews: '2027-01-23',
			no: '#11214',
			sub: '#30600',
			region: 'Midwest',
			tz: 'America/Chicago',
			city: 'Lincoln, NE',
			phone: '+1 402 555 0100',
			site: 'valleypetcare.com',
			address: ['30 Sycamore St', 'Lincoln, NE 68508', 'United States'],
			people: [
				contact('Pieter van den Dahl', 'Owner', 'decision', '+1 402 555 0121', {
					main: true,
					note: 'Second-generation owner. Likes a call more than email.',
				}),
				contact('Sanne de Vries', 'Planning lead', 'champion', '+1 402 555 0184', {
					note: 'Plans visits for 30 pet sitters a day.',
				}),
			],
			deals: [],
			activity: [
				[
					'2026-09-27',
					'Sanne de Vries',
					'Shared the new dog-walk visit checklist with the team.',
					'update',
					['sanne-de-vries'],
				],
				[
					'2026-09-14',
					'Elise Vick',
					'Quarterly review with Pieter and Sanne.',
					'meeting',
					['pieter-van-den-dahl', 'sanne-de-vries'],
				],
			],
			orders: [],
		},
		{
			id: 'rainier',
			name: 'Rainier Mobility',
			trade: 'homecare',
			health: 58,
			tickets: 2,
			owner: 'Elise Vick',
			plan: 'enterprise',
			seats: 54,
			used: 39,
			status: 'active',
			since: '2022-12-06',
			renews: '2026-12-06',
			no: '#10612',
			sub: '#30607',
			pay: 'Bank transfer, 30 days',
			region: 'Midwest',
			tz: 'America/Detroit',
			city: 'Lansing, MI',
			phone: '+1 517 555 0100',
			site: 'rainiermobility.com',
			address: ['61 Walnut St', 'Lansing, MI 48933', 'United States'],
			note: 'Seat use is down to 39 of 54. Jacob wants their EIN on every invoice.',
			people: [
				contact('Jacob Becker', 'Head of care', 'decision', '+1 517 555 0176', {
					main: true,
					note: 'Wants their EIN on every invoice.',
				}),
				contact('Dawn Harrell', 'Accounts', 'billing', '+1 517 555 0142', {
					note: 'Pays by bank transfer at the end of the month.',
				}),
			],
			deals: [],
			activity: [
				[
					'2026-10-01',
					'Elise Vick',
					'Asked Jacob why seat use fell after the summer.',
					'call',
					['jacob-becker'],
				],
				[
					'2026-09-19',
					'Dawn Harrell',
					'Asked for their EIN on the renewal invoice.',
					'email',
					['dawn-harrell'],
				],
			],
			orders: [],
		},
		{
			id: 'luminary',
			name: 'Luminary Photography',
			trade: 'photography',
			health: 47,
			tickets: 1,
			owner: 'Elise Vick',
			plan: 'starter',
			seats: 11,
			used: 8,
			status: 'pastdue',
			statusOn: '2026-10-03',
			invoice: '#926',
			since: '2025-10-03',
			renews: '2027-10-03',
			no: '#12802',
			sub: '#30614',
			pay: 'Card ending 0417',
			region: 'Midwest',
			tz: 'America/Chicago',
			city: 'Peoria, IL',
			phone: '+1 309 555 0100',
			site: 'luminaryphoto.com',
			address: ['14 Laurel St', 'Peoria, IL 61602', 'United States'],
			note: 'The card ending 0417 expired at the end of September. A payment link went out on Oct 4.',
			people: [
				contact('Camille Roux', 'Office manager', 'decision', '+1 309 555 0129', {
					main: true,
					note: 'Updating the company card this week.',
				}),
			],
			deals: [],
			activity: [
				['2026-10-04', 'Elise Vick', 'Sent Camille a payment link for the renewal.', 'email', ['camille-roux']],
				['2026-10-03', 'Elise Vick', 'The renewal charge failed: the card has expired.', 'note', []],
			],
			orders: [],
		},
		{
			id: 'northbrook',
			name: 'Northbrook Cleaning',
			trade: 'cleaning',
			health: 81,
			tickets: 0,
			owner: 'Elise Vick',
			plan: 'growth',
			seats: 21,
			used: 20,
			status: 'active',
			since: '2023-11-02',
			renews: '2026-11-02',
			no: '#11873',
			sub: '#30621',
			region: 'Midwest',
			tz: 'America/Chicago',
			city: 'Des Moines, IA',
			phone: '+1 515 555 0100',
			site: 'northbrookcleaning.com',
			address: ['6 Birch St', 'Des Moines, IA 50309', 'United States'],
			people: [
				contact('Erik Lawson', 'Owner', 'decision', '+1 515 555 0168', {
					main: true,
					note: 'Renews on November 2. Happy at the same size.',
				}),
			],
			deals: [],
			activity: [
				['2026-10-05', 'Elise Vick', 'Sent Erik the renewal reminder.', 'email', ['erik-lawson']],
				['2026-09-08', 'Elise Vick', 'Check-in call: no changes for next year.', 'call', ['erik-lawson']],
			],
			orders: [],
		},
		{
			id: 'tamara',
			name: 'Tamara Skincare Services',
			trade: 'homecare',
			health: 52,
			tickets: 2,
			owner: 'Thomas Morrison',
			plan: 'enterprise',
			seats: 40,
			used: 26,
			status: 'active',
			since: '2023-03-01',
			renews: '2027-03-01',
			no: '#11410',
			sub: '#30628',
			pay: 'Bank transfer, 30 days',
			region: 'West',
			tz: 'America/Denver',
			city: 'Provo, UT',
			phone: '+1 801 555 0100',
			site: 'tamaraskincare.com',
			address: ['231 Juniper St', 'Provo, UT 84601', 'United States'],
			people: [
				contact('Yui Takeda', 'Care planning manager', 'decision', '+1 801 555 0183', {
					main: true,
					note: 'Wants the app in Spanish for the care teams.',
				}),
			],
			deals: [],
			activity: [
				[
					'2026-09-30',
					'Thomas Morrison',
					'Showed Yui the Spanish visit forms in the beta.',
					'meeting',
					['yui-takeda'],
				],
				['2026-09-12', 'Thomas Morrison', 'Two tickets about the address format on invoices.', 'note', []],
			],
			orders: [],
		},
		{
			id: 'clearview',
			name: 'Clearview Windows',
			trade: 'cleaning',
			health: 78,
			tickets: 0,
			owner: 'Jeffrey McKay',
			plan: 'growth',
			seats: 22,
			used: 21,
			status: 'active',
			since: '2024-02-26',
			renews: '2027-02-26',
			no: '#11651',
			sub: '#30635',
			region: 'South',
			tz: 'America/Chicago',
			city: 'Little Rock, AR',
			phone: '+1 501 555 0100',
			site: 'clearviewwindows.com',
			address: ['3233 Magnolia St', 'Little Rock, AR 72201', 'United States'],
			people: [
				contact('Marilyn Lynch', 'Coordinator', 'decision', '+1 501 555 0147', {
					main: true,
					note: 'Books high-rise visits a month ahead.',
				}),
			],
			deals: [],
			activity: [
				[
					'2026-09-21',
					'Jeffrey McKay',
					'Marilyn asked for safety checklists on high-rise visits.',
					'call',
					['marilyn-lynch'],
				],
			],
			orders: [],
		},
		{
			id: 'brightwater',
			name: 'Brightwater Studios',
			trade: 'photography',
			health: 74,
			tickets: 1,
			owner: 'John Armstrong',
			plan: 'growth',
			seats: 19,
			used: 17,
			status: 'active',
			since: '2024-03-04',
			renews: '2027-03-04',
			no: '#11259',
			sub: '#30642',
			region: 'South',
			tz: 'America/New_York',
			city: 'Tampa, FL',
			phone: '+1 813 555 0200',
			site: 'brightwaterstudios.com',
			address: ['3001 N Shoal Dr', 'Tampa, FL 33607', 'United States'],
			people: [
				contact('Dawn Zeller', 'Studio coordinator', 'decision', '+1 813 555 0121', {
					main: true,
					note: 'Asked to move a training session to November.',
				}),
			],
			deals: [],
			activity: [
				[
					'2026-10-03',
					'Dawn Zeller',
					'Asked to move the training session to November.',
					'email',
					['dawn-zeller'],
				],
				['2026-09-10', 'John Armstrong', 'Check-in call with Dawn, no issues.', 'call', ['dawn-zeller']],
			],
			orders: [['#459', '2026-09-22', '1 training session', 374.5, 'delivered']],
		},
		{
			id: 'volt',
			name: 'Volt Film & Photo',
			trade: 'photography',
			health: 40,
			tickets: 3,
			owner: 'Quentin Cook',
			plan: 'growth',
			seats: 52,
			used: 47,
			route: true,
			status: 'active',
			since: '2024-02-11',
			renews: '2027-02-11',
			no: '#11390',
			sub: '#30684',
			region: 'Midwest',
			tz: 'America/Chicago',
			city: 'Evanston, IL',
			phone: '+1 312 555 0400',
			site: 'voltfilmphoto.com',
			address: ['820 W Jackson Blvd', 'Evanston, IL 60607', 'United States'],
			note: 'Three support tickets this month about slow travel times, and a card dispute on an SMS pack.',
			people: [
				contact('Jamal Zeller', 'Operations manager', 'decision', '+1 312 555 0190', {
					main: true,
					note: 'Unhappy with travel times since the September update.',
				}),
			],
			deals: [],
			activity: [
				[
					'2026-10-06',
					'Quentin Cook',
					'Called Jamal about the three travel-time tickets.',
					'call',
					['jamal-zeller'],
				],
				['2026-09-29', 'Jamal Zeller', 'Disputed a card charge on an SMS pack.', 'email', ['jamal-zeller']],
			],
			orders: [],
		},
		{
			id: 'skerry',
			name: 'Skerry Design',
			trade: 'homecare',
			health: 42,
			tickets: 1,
			owner: 'Elise Vick',
			plan: 'growth',
			seats: 22,
			used: 21,
			status: 'active',
			since: '2025-05-16',
			renews: '2027-05-16',
			no: '#12460',
			sub: '#30691',
			region: 'Midwest',
			tz: 'America/Chicago',
			city: 'Topeka, KS',
			phone: '+1 785 555 0200',
			site: 'skerrydesign.com',
			address: ['2 Spruce St', 'Topeka, KS 66603', 'United States'],
			note: 'Shawn told Elise they are trying another tool for travel planning.',
			people: [
				contact('Shawn Norton', 'Owner', 'decision', '+1 785 555 0242', {
					main: true,
					note: 'Trying another travel planner alongside Fieldline.',
				}),
			],
			deals: [],
			activity: [
				[
					'2026-09-30',
					'Elise Vick',
					'Shawn is trying another tool for travel planning.',
					'call',
					['shawn-norton'],
				],
			],
			orders: [],
		},
		{
			id: 'desertbloom',
			name: 'Desert Briar Landscaping',
			trade: 'landscaping',
			health: 34,
			tickets: 0,
			owner: 'Leslie Ashby',
			plan: 'starter',
			seats: 12,
			used: 5,
			status: 'active',
			since: '2025-04-11',
			renews: '2027-04-11',
			no: '#12517',
			sub: '#30698',
			region: 'West',
			tz: 'America/Los_Angeles',
			city: 'Las Vegas, NV',
			phone: '+1 702 555 0100',
			site: 'desertbriarland.com',
			address: ['3200 W Sahara Ave', 'Las Vegas, NV 89102', 'United States'],
			note: 'Two sign-ins in the last 30 days, both by Earl.',
			people: [
				contact('Earl Rudd', 'Owner', 'decision', '+1 702 555 0133', {
					main: true,
					note: 'Crews still work from paper visit sheets.',
				}),
			],
			deals: [],
			activity: [
				['2026-09-25', 'Leslie Ashby', 'Offered Earl a set-up call for the crews.', 'email', ['earl-rudd']],
			],
			orders: [],
		},
		{
			id: 'prairie',
			name: 'Prairie Pet Sitting Co.',
			trade: 'petcare',
			health: 30,
			tickets: 0,
			owner: 'Quentin Cook',
			plan: 'starter',
			seats: 6,
			used: 6,
			status: 'canceling',
			statusOn: '2026-10-26',
			since: '2022-10-26',
			renews: '2026-10-26',
			no: '#10790',
			sub: '#30705',
			region: 'Midwest',
			tz: 'America/Chicago',
			city: 'Wichita, KS',
			phone: '+1 316 555 0100',
			site: 'prairiepetsitting.com',
			address: ['155 N Mercer St', 'Wichita, KS 67202', 'United States'],
			note: 'The business was sold. The new owner uses another system.',
			people: [
				contact('Dale Larsen', 'Owner', 'decision', '+1 316 555 0147', {
					main: true,
					note: 'Sold the business; stays on until the end of October.',
				}),
			],
			deals: [],
			activity: [
				[
					'2026-09-28',
					'Dale Larsen',
					'Asked to cancel: the new owner uses another system.',
					'email',
					['dale-larsen'],
				],
			],
			orders: [],
		},
		{
			id: 'clearwater',
			name: 'Clearwater Surf Co.',
			trade: 'petcare',
			health: 55,
			tickets: 1,
			owner: 'Tony Aldridge',
			plan: 'starter',
			seats: 8,
			used: 8,
			status: 'pastdue',
			statusOn: '2026-10-05',
			invoice: '#938',
			since: '2025-10-05',
			renews: '2027-10-05',
			no: '#12941',
			sub: '#30712',
			pay: 'Card ending 7781',
			region: 'Midwest',
			tz: 'America/Chicago',
			city: 'Ames, IA',
			phone: '+1 515 555 0300',
			site: 'clearwatersurf.com',
			address: ['9 Walnut St', 'Ames, IA 50010', 'United States'],
			note: 'The card ending 7781 was declined twice. Peter is calling his bank.',
			people: [
				contact('Peter Hughes', 'Owner', 'decision', '+1 515 555 0317', {
					main: true,
					note: 'Calling his bank about the declined card.',
				}),
			],
			deals: [],
			activity: [
				[
					'2026-10-06',
					'Tony Aldridge',
					'Reminded Peter about the declined renewal.',
					'email',
					['peter-hughes'],
				],
			],
			orders: [],
		},

		/* Fourteen-day trials. Each ends with a card on file or a lapsed
       workspace, so none has a renewal date, a deal or an order yet. */
		trialAccount({
			id: 'alder',
			name: 'Alder & Sons Tailors',
			trade: 'moving',
			health: null,
			tickets: 0,
			owner: 'Elise Vick',
			plan: 'growth',
			seats: 9,
			used: 8,
			statusOn: '2026-10-19',
			since: '2026-10-05',
			no: '#13018',
			sub: '#30649',
			region: 'Midwest',
			tz: 'America/Chicago',
			city: 'Duluth, MN',
			phone: '+1 218 555 0300',
			site: 'alderandsons.com',
			address: ['7 Hawthorne St', 'Duluth, MN 55802', 'United States'],
			note: 'Four days in: 8 of 9 seats signed in and 42 moves scheduled.',
			people: [
				contact('Conor Alder', 'Owner', 'decision', '+1 218 555 0383', {
					main: true,
					note: 'Third generation of the family firm.',
				}),
			],
			activity: [
				[
					'2026-10-05',
					'Elise Vick',
					'Welcome call with Conor to set up the workspace.',
					'call',
					['conor-alder'],
				],
			],
		}),
		trialAccount({
			id: 'oakmont',
			name: 'Oakmont Gardens',
			trade: 'landscaping',
			health: 38,
			tickets: 1,
			owner: 'Elise Vick',
			plan: 'starter',
			seats: 6,
			used: 2,
			statusOn: '2026-10-11',
			since: '2026-09-27',
			no: '#12997',
			sub: '#30656',
			region: 'Midwest',
			tz: 'America/Chicago',
			city: 'Oshkosh, WI',
			phone: '+1 920 555 0100',
			site: 'oakmontgardens.com',
			address: ['30 Cypress St', 'Oshkosh, WI 54901', 'United States'],
			note: 'No sign-in since the second day of the trial.',
			people: [
				contact('Nia Edwards', 'Director', 'decision', '+1 920 555 0154', {
					main: true,
					note: 'Signed up after a webinar; busy with fall cleanups.',
				}),
			],
			activity: [
				['2026-10-06', 'Elise Vick', 'Emailed Nia to offer a short set-up call.', 'email', ['nia-edwards']],
			],
		}),
		trialAccount({
			id: 'brookside',
			name: 'Brookside Books',
			trade: 'petcare',
			health: 81,
			tickets: 0,
			owner: 'Leslie Ashby',
			plan: 'starter',
			seats: 5,
			used: 5,
			statusOn: '2026-10-13',
			since: '2026-09-29',
			no: '#13004',
			sub: '#30663',
			region: 'Northeast',
			tz: 'America/New_York',
			city: 'Bangor, ME',
			phone: '+1 207 555 0100',
			site: 'brooksidebooks.com',
			address: ['250 Aspen St', 'Bangor, ME 04401', 'United States'],
			note: 'Signed in every day of the trial. 38 visits scheduled.',
			people: [
				contact('Forrest Decker', 'Owner', 'decision', '+1 207 555 0109', {
					main: true,
					note: 'Asked about yearly billing before the trial ends.',
				}),
			],
			activity: [
				['2026-10-07', 'Leslie Ashby', 'Forrest asked about yearly billing.', 'call', ['forrest-decker']],
			],
		}),
		trialAccount({
			id: 'sunvale',
			name: 'Sunvale Studios',
			trade: 'photography',
			health: 77,
			tickets: 0,
			owner: 'John Armstrong',
			plan: 'enterprise',
			seats: 15,
			used: 13,
			statusOn: '2026-10-14',
			since: '2026-09-30',
			no: '#13011',
			sub: '#30670',
			region: 'West',
			tz: 'America/Los_Angeles',
			city: 'Sacramento, CA',
			phone: '+1 916 555 0100',
			site: 'sunvalestudios.com',
			address: ['1201 K St', 'Sacramento, CA 95814', 'United States'],
			note: 'Testing single sign-on with their IT team. Security review on Oct 13.',
			people: [
				contact('Ann Lyons', 'Studio operations manager', 'decision', '+1 916 555 0131', {
					main: true,
					note: 'Security review with their IT team on October 13.',
				}),
			],
			activity: [
				['2026-10-02', 'John Armstrong', 'Set up single sign-on testing with Ann.', 'meeting', ['ann-lyons']],
			],
		}),
		trialAccount({
			id: 'coastline',
			name: 'Coastline Surf Co.',
			trade: 'moving',
			health: 72,
			tickets: 0,
			owner: 'Leslie Ashby',
			plan: 'growth',
			seats: 8,
			used: 7,
			statusOn: '2026-10-15',
			since: '2026-10-01',
			no: '#13025',
			sub: '#30677',
			region: 'South',
			tz: 'America/New_York',
			city: 'Norfolk, VA',
			phone: '+1 757 555 0100',
			site: 'coastlinesurfco.com',
			address: ['150 W Fenner St', 'Norfolk, VA 23510', 'United States'],
			note: 'Imported 1,240 customers and scheduled 61 moves.',
			people: [
				contact('Ray Downing', 'Owner', 'decision', '+1 757 555 0196', {
					main: true,
					note: 'Moving off spreadsheets before peak season.',
				}),
			],
			activity: [['2026-10-03', 'Leslie Ashby', 'Helped Ray import his customer list.', 'call', ['ray-downing']]],
		}),
	];

	/**
	 * Completes every record, then hangs the book and its helpers on
	 * window.Basalt.data.accounts. The lookup tables are shared as they are;
	 * accounts always leave as copies.
	 */
	function publish() {
		for (const account of BOOK) fillDefaults(account);
		const shelf = window.Basalt.data || (window.Basalt.data = {});
		shelf.accounts = {
			today: CALENDAR.today,
			plans: SEAT_PRICES,
			addOns: EXTRAS,
			trades: SECTORS,
			owners: ACCOUNT_LEADS,
			list: listAccounts,
			find: findAccount,
			person: findContact,
			mrr: monthlyRevenue,
			listMrr: monthlyListPrice,
			history: seatTimeline,
			bills: invoicesFor,
			personKey,
			slug,
			zoneName,
		};
	}

	/* Building and completing records. */

	/**
	 * A contact at a customer. Optional fields ride along in `more`: main
	 * marks the primary contact, hours is the working day as [start, end],
	 * and since, mobile, replies and note fill in the buyer's profile.
	 */
	function contact(name, title, role, phone, more) {
		return { name, title, role, phone, ...more };
	}

	/** A company on a trial: no renewal date, deals or orders exist yet. */
	function trialAccount(fields) {
		return { ...fields, status: 'trial', renews: null, deals: [], orders: [] };
	}

	/* Gives add-on flags a definite value and each contact a key, a work
     address on the company's domain and a default 8-to-5 day. */
	function fillDefaults(account) {
		account.route = Boolean(account.route);
		account.portal = Boolean(account.portal);
		account.sms = account.sms || 0;
		for (const buyer of account.people) {
			buyer.key = personKey(buyer.name);
			buyer.email ||= `${stripAccents(buyer.name.split(' ')[0].toLowerCase())}@${account.site}`;
			buyer.hours ||= [8, 17];
		}
	}

	/* Reading the book. Nothing leaves without being copied first. */

	function listAccounts() {
		return BOOK.map((account) => detach(account));
	}

	function findAccount(id) {
		const hit = BOOK.find((account) => account.id === id || account.alias?.includes(id));
		return hit ? detach(hit) : null;
	}

	function findContact(key) {
		for (const account of BOOK) {
			const buyer = account.people.find((entry) => entry.key === key);
			if (buyer) return { person: detach(buyer), account: detach(account) };
		}
		return null;
	}

	function detach(value) {
		return JSON.parse(JSON.stringify(value));
	}

	/* Money. Amounts are rounded to the cent at the same steps the
     subscriptions page rounds them, so totals agree everywhere. */

	/**
	 * Monthly revenue at full price: ten twelfths of the seat price for
	 * each seat, then every add-on in full. Trials are priced as if paid.
	 */
	function monthlyListPrice(account) {
		const quantities = {
			route: account.route ? account.seats : 0,
			portal: account.portal ? account.seats : 0,
			sms: account.sms || 0,
		};
		let sum = roundToCents(((SEAT_PRICES[account.plan].price * 10) / 12) * account.seats);
		for (const [extra, count] of Object.entries(quantities)) sum += EXTRAS[extra].per * count;
		return roundToCents(sum);
	}

	/** Monthly revenue as billed today, which is nothing during a trial. */
	function monthlyRevenue(account) {
		if (account.status === 'trial') return 0;
		return monthlyListPrice(account);
	}

	function roundToCents(amount) {
		return Math.round(amount * 100) / 100;
	}

	/* Seats and invoices over time. */

	/**
	 * Paid seat counts as [date, seats, what happened], earliest first.
	 * A record without a written history is assumed to have renewed every
	 * year, each earlier year about a tenth smaller than the next.
	 */
	function seatTimeline(account) {
		if (account.seatHistory) return account.seatHistory.map((row) => [...row]);
		const planName = SEAT_PRICES[account.plan].name;
		if (account.status === 'trial') {
			return [
				[
					account.since,
					account.seats,
					`Started a ${CALENDAR.trialDays}-day trial of ${planName} with ${account.seats} seats`,
				],
			];
		}
		const anniversaries = [];
		for (let day = account.since; day <= CALENDAR.today; day = shiftYears(day, 1)) anniversaries.push(day);
		return anniversaries.map((day, step) => {
			const yearsBack = anniversaries.length - 1 - step;
			const seats = Math.max(1, Math.round(account.seats * (1 - 0.1 * yearsBack)));
			return [
				day,
				seats,
				step === 0 ? `Started on ${planName} with ${seats} seats` : `Renewed with ${seats} seats`,
			];
		});
	}

	/**
	 * Subscription invoices, latest first. Each renewal day bills a full
	 * year; seats added mid-term are billed for the rest of that term. A
	 * renewal that failed shows up once, as the unpaid invoice at the end.
	 */
	function invoicesFor(account) {
		if (account.status === 'trial') return [];
		const seatRows = seatTimeline(account);
		const failed = account.status === 'pastdue';
		const invoices = [];

		function yearlyCharge(seats) {
			return roundToCents(monthlyListPrice({ ...account, seats }) * 12);
		}

		for (const [step, [day, seats, what]] of seatRows.entries()) {
			if (failed && day === account.statusOn) continue;
			const number = invoiceNumber(account, day, step);
			if (step === 0 || what.startsWith('Renewed')) {
				invoices.push({
					no: number,
					at: day,
					what: `Year ${termYear(account, day)}, ${seats} seats`,
					amount: yearlyCharge(seats),
					state: 'paid',
				});
				continue;
			}
			const before = seatRows[step - 1][1];
			const termEnd = nextAnniversary(account.since, day);
			const share = (parseDay(termEnd) - parseDay(day)) / (parseDay(termEnd) - parseDay(shiftYears(termEnd, -1)));
			invoices.push({
				no: number,
				at: day,
				what: `${seats - before} more seats to ${shortDate(termEnd)}`,
				amount: roundToCents((yearlyCharge(seats) - yearlyCharge(before)) * share),
				state: 'paid',
			});
		}

		if (failed) {
			const due = account.statusOn;
			invoices.push({
				no: account.invoice || invoiceNumber(account, due, seatRows.length),
				at: due,
				what: `Year ${termYear(account, due)}, ${account.seats} seats`,
				amount: yearlyCharge(account.seats),
				state: 'unpaid',
			});
		}
		return invoices.sort((left, right) => right.at.localeCompare(left.at));
	}

	/* Invoice numbers mix the account number with the row's position, so
     they look issued rather than counted. */
	function invoiceNumber(account, day, step) {
		const serial = 1000 + ((Number(account.no.replace(/\D/g, '')) * 37 + step * 11) % 9000);
		return `#${serial}`;
	}

	/** Which year of the subscription a day falls in, counting from 1. */
	function termYear(account, day) {
		return Math.round((parseDay(day) - parseDay(account.since)) / CALENDAR.yearMs) + 1;
	}

	/** The first anniversary of `since` that comes after `day`. */
	function nextAnniversary(since, day) {
		let candidate = since;
		while (candidate <= day) candidate = shiftYears(candidate, 1);
		return candidate;
	}

	/* Calendar days are 'YYYY-MM-DD' strings, read as local midnight. */

	function parseDay(day) {
		const [fullYear, month, date] = day.split('-').map(Number);
		return new Date(fullYear, month - 1, date);
	}

	function formatDay(when) {
		return `${when.getFullYear()}-${twoDigits(when.getMonth() + 1)}-${twoDigits(when.getDate())}`;
	}

	function twoDigits(part) {
		return String(part).padStart(2, '0');
	}

	function shiftYears(day, years) {
		const when = parseDay(day);
		when.setFullYear(when.getFullYear() + years);
		return formatDay(when);
	}

	/** 'YYYY-MM-DD' as a short label such as "Nov 2". */
	function shortDate(day) {
		return `${MONTH_ABBR[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;
	}

	/* Names and keys. */

	/** Lowercase, accent-free words joined by hyphens: "Todd Bishop" → "trent-bishop". */
	function slug(text) {
		return stripAccents(String(text).toLowerCase())
			.split(/[^a-z0-9]+/)
			.filter(Boolean)
			.join('-');
	}

	/** The key a contact is linked by. */
	function personKey(name) {
		return slug(name);
	}

	function stripAccents(text) {
		return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
	}

	/**
	 * The everyday name of a time zone, such as "Mountain Time" or
	 * "Central Time", without a season in it.
	 */
	function zoneName(tz) {
		const zoneLabel = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'long' })
			.formatToParts(new Date(2026, 0, 15))
			.find((part) => part.type === 'timeZoneName')?.value;
		if (zoneLabel === undefined) return tz;
		return zoneLabel.replace(/ (Standard|Daylight|Summer|Mean)( Time)?$/, ' Time').replace(/ Standard /, ' ');
	}

	publish();
})();
