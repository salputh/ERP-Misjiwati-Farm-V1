/**
 * Staff expense claims for expenses.html and expense-details.html. Both
 * pages read this one ledger, so a claim keeps the same claimant, amount,
 * receipt and status wherever it shows up, and a link to
 * expense-details.html?id=<claim id> lands on the claim that was clicked.
 *
 * Published as window.Basalt.data.expenses: the demo clock (today) and the
 * coming Friday payout (nextPayout), the signed-in admin (me) and the person
 * who signs off their own claims (myApprover), the category rules
 * (categories), status labels and tones (statuses), each claimant's job,
 * payout account and staff number (people), customer ids for
 * company-details.html (customers), thirty days of claims (claims), and
 * approverOf(claim). A live backend fills the same shapes and reads both
 * dates from the real clock.
 */
(() => {
	'use strict';

	const signedIn = 'John Armstrong';
	const signedInApprover = 'Hope Stout';

	/* Each category caps a single claim at its limit. Meals are also held to
     perHead for every diner, hotel stays to perNight for every night, and
     mileage is repaid at perMile. The key order is the order the category
     breakdown lists them in. */
	const categoryRules = {
		travel: { icon: 'bi-airplane', label: 'Travel', perNight: 250, limit: 800 },
		meals: { icon: 'bi-cup-straw', label: 'Meals', perHead: 50, limit: 400 },
		training: { icon: 'bi-mortarboard', label: 'Training', limit: 1000 },
		events: { icon: 'bi-easel', label: 'Events', limit: 500 },
		equipment: { icon: 'bi-phone', label: 'Equipment', limit: 500 },
		mileage: { icon: 'bi-car-front', label: 'Mileage', perMile: 0.7, limit: 400 },
		software: { icon: 'bi-window-stack', label: 'Software', limit: 200 },
	};

	/* A status pill pairs a word with one of the shared status tones. */
	const statusTones = {
		waiting: { tone: 'warning', label: 'Waiting' },
		queried: { tone: 'info', label: 'Queried' },
		approved: { tone: 'success', label: 'Approved' },
		paid: { tone: 'primary', label: 'Paid' },
		rejected: { tone: 'danger', label: 'Rejected' },
	};

	/* Everyone who files or decides claims. The middle value is the last four
     digits of the account their payout lands in, the last is the staff
     number that employee-details.html?id= opens. The same people, titles and
     numbers live in the roster in assets/basalt/js/data/multipurpose/people.js. */
	const claimants = roster([
		['Courtney Lowry', 'Onboarding specialist', '2093', '#147'],
		['Leslie Ashby', 'Customer success manager', '3958', '#189'],
		['Quentin Cook', 'Account executive', '7710', '#133'],
		['Todd Hatcher', 'Senior mobile engineer', '0548', '#117'],
		['Connie Reese', 'Support lead', '3361', '#111'],
		['Tony Aldridge', 'Customer success manager', '8124', '#139'],
		['Alexis Boone', 'Support specialist', '9184', '#143'],
		['Ike Parsons', 'Support specialist', '6627', '#167'],
		['Carrie Dillon', 'Onboarding specialist', '4417', '#177'],
		['Elise Vick', 'Customer success lead', '1205', '#115'],
		['Ben Pearce', 'Support specialist', '8852', '#211'],
		['Hope Stout', 'Billing specialist', '5039', '#153'],
		['John Armstrong', 'IT and systems manager', '2746', '#125'],
	]);

	/* Customer names as claims spell them, mapped to their customer page id. */
	const customerIds = Object.fromEntries([
		['Lumora AI', 'lumoraai'],
		['Oakhaven Studio', 'oakhaven'],
		['Avocet Robotics', 'avocet'],
		['Highpoint Outfitters', 'highpoint'],
		['Lakeside Apparel', 'lakeside'],
		['Rainier Mobility', 'rainier'],
		['Vista Landscaping', 'vistalandscaping'],
		['Aspen Hollow Pets', 'aspenhollow'],
	]);

	/* Thirty days of claims, grouped by where each one stands. A claim goes
     Waiting, then Approved, then Paid; it can also be Queried back to the
     person who filed it, or end Rejected. heads, nights and miles are what
     the per-diner, per-night and per-mile rules are checked against, and
     thread carries any replies after the claimant's note as
     [when, who, text]. A claim leaves sent out when it was filed the day
     the money was spent, paidWith out when it went on a personal card, and
     customer, note or receipt out when it has none. */
	const ledger = [
		...stamp('waiting', [
			{
				id: '#461',
				who: 'Courtney Lowry',
				cat: 'travel',
				amount: 412.8,
				spent: '2026-10-07',
				nights: 2,
				desc: 'Hotel for the Highpoint Outfitters training',
				customer: 'Highpoint Outfitters',
				note: 'Two nights in Concord to train their Keene schedulers.',
				receipt: scanned(
					'Bow River Hotel',
					'Concord, NH',
					'bow-river-hotel-folio.pdf',
					['2 nights, Oct 5 to Oct 7', 378.0],
					['City tax', 34.8],
				),
			},
			{
				id: '#460',
				who: 'Leslie Ashby',
				cat: 'meals',
				amount: 186.4,
				spent: '2026-10-06',
				heads: 4,
				desc: 'Lunch with the Lumora AI team',
				customer: 'Lumora AI',
				note: 'Renewal talk with Carla, Hailey and Dean, four of us.',
				receipt: scanned(
					'Larimer Grill',
					'Boulder, CO',
					'larimer-grill-1006.jpg',
					['Lunch for 4', 158.0],
					['Tip', 28.4],
				),
			},
			{
				id: '#458',
				who: 'Todd Hatcher',
				cat: 'equipment',
				amount: 429.0,
				spent: '2026-10-05',
				desc: 'Test phone for the staff app',
				note: 'Mid-range Android, to test offline mode on a real phone.',
			},
			{
				id: '#457',
				who: 'Connie Reese',
				cat: 'software',
				amount: 96.0,
				spent: '2026-10-03',
				desc: 'Screen recorder, one year',
				note: 'For the how-to videos in the help center.',
				receipt: scanned('Clipwise', 'Online', 'clipwise-invoice.pdf', ['Pro plan, 12 months', 96.0]),
			},
			{
				id: '#455',
				who: 'Tony Aldridge',
				cat: 'travel',
				amount: 138.8,
				spent: '2026-10-02',
				desc: 'Return flight to Duluth for Avocet Robotics',
				customer: 'Avocet Robotics',
				note: 'Going through the Max proposal with Addison.',
				receipt: scanned('Skyway Air', 'Bismarck to Duluth', 'skyway-duluth.pdf', ['Return fare', 138.8]),
			},
		]),

		...stamp('queried', [
			{
				id: '#452',
				who: 'Ike Parsons',
				cat: 'travel',
				amount: 64.2,
				spent: '2026-09-29',
				paidWith: 'Cash',
				desc: 'Taxi from Akron airport',
				note: 'Arriving for the Spanish help center week with Elise.',
				queried: { on: '2026-09-30', text: 'Please attach the taxi receipt. A photo of it is fine.' },
				thread: [
					[
						'2026-10-01T08:42',
						'Ike Parsons',
						'The driver only had a card machine slip. I’ll ask the taxi company for a copy.',
					],
				],
			},
			{
				id: '#450',
				who: 'Carrie Dillon',
				cat: 'meals',
				amount: 318.75,
				spent: '2026-09-28',
				heads: 5,
				desc: 'Dinner after the Vista Landscaping refresher',
				customer: 'Vista Landscaping',
				note: 'Team dinner with their founder and field leads.',
				receipt: scanned(
					'Olive & Ash',
					'Durham, NC',
					'olive-ash-0928.jpg',
					['Dinner for 5', 271.0],
					['Tip', 47.75],
				),
				queried: { on: '2026-09-30', text: 'That is $64 a head and the limit is $50. Who was there?' },
				thread: [
					[
						'2026-09-30T17:20',
						'Jeffrey McKay',
						'I was there too. It was their whole field team, the night the refresher ended.',
					],
				],
			},
		]),

		...stamp('approved', [
			{
				id: '#449',
				who: 'Courtney Lowry',
				cat: 'travel',
				amount: 386.4,
				spent: '2026-09-26',
				sent: '2026-09-27',
				approved: '2026-10-01',
				desc: 'Return flight to Concord',
				customer: 'Highpoint Outfitters',
				note: 'Booked early for the October training.',
				receipt: scanned(
					'Skyway Air',
					'Syracuse to Concord',
					'skyway-booking.pdf',
					['Return fare', 352.0],
					['Seat and bag', 34.4],
				),
			},
			{
				id: '#447',
				who: 'Elise Vick',
				cat: 'training',
				amount: 450.0,
				spent: '2026-09-25',
				approved: '2026-09-30',
				desc: 'Scheduling certification course',
				note: 'Level 2, so I can run customer workshops.',
				receipt: scanned('Customer Success School', 'Online', 'css-course-invoice.pdf', [
					'Level 2 course and exam',
					450.0,
				]),
			},
			{
				id: '#446',
				who: 'Quentin Cook',
				cat: 'events',
				amount: 210.0,
				spent: '2026-09-24',
				approved: '2026-09-29',
				desc: 'Badge reader hire, BookWell Expo',
				receipt: scanned(
					'ExpoTech Rentals',
					'Evanston, IL',
					'expotech-rental.pdf',
					['2 readers, 3 days', 180.0],
					['Delivery', 30.0],
				),
			},
			{
				id: '#445',
				who: 'Quentin Cook',
				cat: 'mileage',
				amount: 130.2,
				spent: '2026-09-23',
				approved: '2026-09-29',
				miles: 186,
				paidWith: 'Own car',
				desc: 'Mileage, 186 miles of customer visits',
				receipt: scanned('Mileage log', 'Sep 14 to Sep 23', 'mileage-sep-travis.pdf', [
					'186 miles at $0.70',
					130.2,
				]),
			},
			{
				id: '#444',
				who: 'Ben Pearce',
				cat: 'mileage',
				amount: 149.8,
				spent: '2026-09-22',
				approved: '2026-09-28',
				miles: 214,
				paidWith: 'Own car',
				desc: 'Mileage, 214 miles of site visits',
				customer: 'Oakhaven Studio',
				note: 'Sat with Oakhaven Studio’s schedulers at both branches in my first week.',
				receipt: scanned('Mileage log', 'Sep 14 to Sep 22', 'mileage-sep-ben.pdf', [
					'214 miles at $0.70',
					149.8,
				]),
			},
			{
				id: '#443',
				who: 'John Armstrong',
				cat: 'meals',
				amount: 264.5,
				spent: '2026-09-21',
				sent: '2026-09-22',
				approved: '2026-09-28',
				approver: 'Hope Stout',
				heads: 6,
				desc: 'Lunch for the single sign-on rollout',
				note: 'Six of us from IT and Support, the day sign-on went live for everyone.',
				receipt: scanned(
					'Hythe Street Grill',
					'Evanston, IL',
					'hythe-street-grill-0921.jpg',
					['Lunch for 6', 228.0],
					['Tip', 36.5],
				),
			},
		]),

		...stamp('rejected', [
			{
				id: '#451',
				who: 'Todd Hatcher',
				cat: 'equipment',
				amount: 279.0,
				spent: '2026-09-29',
				desc: 'Noise-canceling headphones',
				note: 'For calls from the open office.',
				receipt: scanned('Soundbay', 'Online', 'soundbay-order.pdf', ['Headphones', 279.0]),
				rejected: { on: '2026-09-30', text: 'Headsets come from IT. Ask John for one from the spares.' },
				thread: [['2026-09-30T17:05', 'Todd Hatcher', 'Thanks, I’ll ask John.']],
			},
		]),

		...stamp('paid', [
			{
				id: '#441',
				who: 'Alexis Boone',
				cat: 'travel',
				amount: 684.0,
				spent: '2026-09-19',
				sent: '2026-09-20',
				approved: '2026-09-22',
				paid: '2026-10-02',
				nights: 3,
				desc: 'Hotel for BookWell Expo, three nights',
				receipt: scanned(
					'Lakeshore Hotel',
					'Evanston, IL',
					'lakeshore-folio.pdf',
					['3 nights, Sep 16 to Sep 19', 621.0],
					['City tax', 63.0],
				),
			},
			{
				id: '#440',
				who: 'Todd Hatcher',
				cat: 'equipment',
				amount: 119.97,
				spent: '2026-09-18',
				approved: '2026-09-21',
				paid: '2026-10-02',
				desc: 'USB-C hubs for the test bench',
				receipt: scanned('Bench Supply Co.', 'Online', 'bench-supply-order.pdf', [
					'USB-C hub, 3 at $39.99',
					119.97,
				]),
			},
			{
				id: '#438',
				who: 'Ike Parsons',
				cat: 'training',
				amount: 340.0,
				spent: '2026-09-17',
				approved: '2026-09-21',
				paid: '2026-10-02',
				desc: 'Support writing course',
				note: 'Writing help articles in Spanish.',
				receipt: scanned('Clear Words Academy', 'Online', 'clear-words-invoice.pdf', ['4-week course', 340.0]),
			},
			{
				id: '#437',
				who: 'Connie Reese',
				cat: 'events',
				amount: 395.0,
				spent: '2026-09-16',
				approved: '2026-09-21',
				paid: '2026-10-02',
				desc: 'Booth banners for BookWell Expo',
				receipt: scanned(
					'PrintHouse',
					'Evanston, IL',
					'printhouse-invoice.pdf',
					['2 roll-up banners', 360.0],
					['Rush fee', 35.0],
				),
			},
			{
				id: '#436',
				who: 'Carrie Dillon',
				cat: 'meals',
				amount: 142.3,
				spent: '2026-09-15',
				sent: '2026-09-16',
				approved: '2026-09-17',
				paid: '2026-09-25',
				heads: 3,
				desc: 'Dinner with the Aspen Hollow Pets team',
				customer: 'Aspen Hollow Pets',
				note: 'Three of us, after the scheduler training.',
				receipt: scanned(
					'The Copper Table',
					'Amarillo, TX',
					'copper-table-0915.jpg',
					['Dinner for 3', 124.0],
					['Tip', 18.3],
				),
			},
			{
				id: '#434',
				who: 'Elise Vick',
				cat: 'travel',
				amount: 228.6,
				spent: '2026-09-12',
				sent: '2026-09-14',
				approved: '2026-09-15',
				paid: '2026-09-18',
				desc: 'Rental car for the Rainier Mobility visit',
				customer: 'Rainier Mobility',
				receipt: scanned(
					'Valley Car Rental',
					'Lansing, MI',
					'valley-rental.pdf',
					['2 days', 186.0],
					['Fuel', 42.6],
				),
			},
			{
				id: '#433',
				who: 'Hope Stout',
				cat: 'software',
				amount: 45.0,
				spent: '2026-09-10',
				approved: '2026-09-11',
				paid: '2026-09-18',
				desc: 'Receipt capture app, one year',
				note: 'Scans supplier bills straight into the books.',
				receipt: scanned('ScanSnap Cloud', 'Online', 'scan-app-invoice.pdf', ['Annual plan', 45.0]),
			},
		]),
	];

	publish();

	/** Hangs the ledger on window.Basalt.data next to whatever other data files put there. */
	function publish() {
		window.Basalt.data ||= {};
		window.Basalt.data.expenses = {
			today: '2026-10-08',
			nextPayout: '2026-10-09',
			me: signedIn,
			myApprover: signedInApprover,
			categories: categoryRules,
			statuses: statusTones,
			people: claimants,
			customers: customerIds,
			claims: ledger,
			approverOf: deciderFor,
		};
	}

	/**
	 * Names who rules on a claim: whoever the claim itself names, otherwise
	 * the signed-in admin, unless the claim is the admin's own, which goes to
	 * their approver.
	 */
	function deciderFor(entry) {
		if (entry.approver) return entry.approver;
		return entry.who === signedIn ? signedInApprover : signedIn;
	}

	/**
	 * Fills the fields most claims share and sets the status of a group, so
	 * every published claim carries sent, customer, paidWith, note and receipt
	 * even when its line above leaves them out.
	 */
	function stamp(status, group) {
		return group.map((entry) => ({
			sent: entry.spent,
			customer: '',
			paidWith: 'Personal card',
			note: '',
			receipt: null,
			...entry,
			status,
		}));
	}

	/** Builds a receipt: the shop, where it was, the scanned file, then each [line, amount]. */
	function scanned(shop, where, file, ...lines) {
		return { shop, where, file, lines };
	}

	/** Turns [name, role, bank, staff] rows into the lookup keyed by name. */
	function roster(rows) {
		const byName = {};
		for (const [name, role, bank, staff] of rows) byName[name] = { role, bank, staff };
		return byName;
	}
})();
