/**
 * Sample free trials: businesses testing Fieldline for two weeks before
 * they pay. The Trials list (trials.html), the single-trial view
 * (trial-details.html) and the AI assistant (ai-assistant.html) read it.
 *
 * Several of these businesses also live in assets/basalt/js/data/multipurpose/accounts.js as
 * trial accounts (Alder & Sons Tailors, Oakmont Gardens and others). A
 * record that names its account borrows the name, city, plan, seat count
 * and trial dates from that file, so the two never disagree; here it only
 * carries what the trial screens need besides. The remaining records are
 * sign-ups that never turned into accounts.
 *
 * Published as window.Basalt.data.trials:
 *   today, length          the demo date and the trial length in days
 *   plans, industries      lookup tables keyed by plan and industry
 *   milestones, templates  the four set-up steps and the nudge emails
 *   list()                 copies of every trial, active ones on top
 *   find(id)               a copy of one trial, or null
 *   day(trial)             the current trial day, from 1 to 14
 *   ends(trial)            the closing date as YYYY-MM-DD
 *   done(trial)            the number of set-up steps completed
 *   next(trial)            the first open step, or null
 *   price(plan, seats, yearly)  the monthly bill after conversion
 *   count(n, industry)     "1 move" or "42 moves"
 *   date(iso, withDay)     "Oct 9" or "Fri, Oct 9"
 *   addDays(iso, n), between(fromIso, toIso)  plain date arithmetic
 *
 * Swap in real sign-ups by filling SIGNUPS in the same shape. The demo
 * treats October 9, 2026 as the current day.
 */
(() => {
	'use strict';

	const DEMO_DAY = '2026-10-09';
	const TRIAL_DAYS = 14;
	const MS_PER_DAY = 86400000;
	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const accountBook = window.Basalt.data?.accounts;

	/* Seat prices per month match the pricing page; paying for a year
     up front is charged as ten months. */
	const PLAN_TABLE = {
		starter: { tone: 3, name: 'Basic', price: 15 },
		growth: { tone: 1, name: 'Pro', price: 32 },
		enterprise: { tone: 2, name: 'Max', price: 58 },
	};

	/* Industries mirror accounts.js; `visit` is the plural each one uses
     when it counts its bookings. */
	const INDUSTRY_TABLE = {
		homecare: { visit: 'visits', name: 'Home care', tone: 1, icon: 'bi-house-heart-fill' },
		petcare: { visit: 'visits', name: 'Pet care', tone: 2, icon: 'bi-heart-fill' },
		photography: { visit: 'shoots', name: 'Photography', tone: 3, icon: 'bi-camera-fill' },
		cleaning: { visit: 'cleans', name: 'Cleaning', tone: 4, icon: 'bi-stars' },
		landscaping: { visit: 'visits', name: 'Landscaping', tone: 5, icon: 'bi-tree-fill' },
		property: { visit: 'visits', name: 'Property care', tone: 6, icon: 'bi-building-fill' },
		moving: { visit: 'moves', name: 'Movers', tone: 7, icon: 'bi-box-seam-fill' },
	};

	/* Every trial is scored against these four steps. Teams that finish
     all of them inside the first week almost always convert. */
	const SETUP_STEPS = [
		{
			key: 'team',
			icon: 'bi-people',
			label: 'Added their team',
			tip: 'Invite the people who do the visits, so they see their day in the app.',
		},
		{
			key: 'visit',
			icon: 'bi-calendar-check',
			label: 'Booked a first visit',
			tip: 'Put one real booking on the schedule and send it to someone.',
		},
		{
			key: 'reminder',
			icon: 'bi-chat-dots',
			label: 'Sent a reminder',
			tip: 'Turn on text reminders, so customers hear the day before.',
		},
		{
			key: 'invoice',
			icon: 'bi-receipt',
			label: 'Sent an invoice',
			tip: 'Send an invoice straight from a finished visit.',
		},
	];

	/* Nudge emails, keyed by purpose. The pages replace {first} with the
     contact's first name, {ends} with the closing date and {tip} with the
     hint for the next open step. */
	const NUDGE_EMAILS = {
		setup: {
			subject: 'One step left in your Fieldline trial',
			label: 'Finish setting up',
			body: 'Hi {first},\n\nYou are nearly set up. Next: {tip}\n\nIt takes about five minutes. Reply here if anything gets in the way.',
		},
		ending: {
			subject: 'Your Fieldline trial ends {ends}',
			label: 'Your trial ends soon',
			body: 'Hi {first},\n\nYour trial ends {ends}. Add a card to keep everything you have set up; nothing is lost.\n\nReply here if you need a few more days.',
		},
		help: {
			subject: 'Want a hand with Fieldline?',
			label: 'Need a hand?',
			body: 'Hi {first},\n\nWe can set it up with you on a 20-minute call: your team, your first bookings and reminders.\n\nPick any time that suits you.',
		},
	};

	/* Order sets how the list breaks ties: active trials, then paying
     ones, then the ones that lapsed. */
	const STATUS_ORDER = { running: 0, converted: 1, ended: 2 };

	/* Trial fields a linked account supplies, mapped to the account's own
     field names. */
	const FROM_ACCOUNT = {
		name: 'name',
		industry: 'trade',
		city: 'city',
		region: 'region',
		plan: 'plan',
		seats: 'seats',
		started: 'since',
		until: 'statusOn',
	};

	/* The records, in the order the pages expect. Fields:
     id                   the link key, as in trial-details.html?id=alder
     account              the matching accounts.js id, when there is one
     name, industry, city, region, plan, seats, started, email
                          present only when there is no account to borrow from
     status               running, converted or ended
     closed               when a converted or ended trial finished
     paid                 converted only: [plan, seats, 'yearly' or 'monthly']
     reason               ended only: the explanation the team gave
     signedIn, bookings   people who have signed in; bookings on the schedule
     steps                the first date each set-up step happened
     people               [name, role, job title, last sign-in], where role
                          is Owner, Admin or Member as in the workspace
     activity             [date, event, kind], latest first; kind is one of
                          start, team, visit, reminder, invoice, nudge, idle,
                          paid, ended or note
     nudges               the dates nudge emails went out */
	const SIGNUPS = [
		/* Still inside their two weeks. */
		{
			id: 'maple',
			status: 'running',
			name: 'Maple Lane Pet Sitting',
			industry: 'petcare',
			plan: 'starter',
			seats: 4,
			city: 'Eugene, OR',
			region: 'West',
			email: 'courtney@maplelanepets.com',
			started: '2026-09-26',
			signedIn: 1,
			bookings: 1,
			nudges: ['2026-10-07'],
			steps: { visit: '2026-09-26' },
			people: [['Courtney Whitman', 'Owner', 'Owner', '2026-09-30']],
			activity: [
				['2026-10-07', 'Nudge sent: your trial ends Saturday.', 'nudge'],
				['2026-09-30', 'Courtney signed in for the last time so far.', 'idle'],
				['2026-09-26', 'Booked a first visit, a weekend dog sit.', 'visit'],
				['2026-09-26', 'Courtney Whitman started the trial.', 'start'],
			],
		},
		{
			id: 'oakmont',
			account: 'oakmont',
			status: 'running',
			signedIn: 2,
			bookings: 3,
			nudges: ['2026-10-06'],
			steps: { team: '2026-09-27', visit: '2026-09-28' },
			people: [
				['Nia Edwards', 'Owner', 'Director', '2026-09-28'],
				['Ralph Morgan', 'Member', 'Gardener', '2026-09-28'],
			],
			activity: [
				['2026-10-06', 'Nudge sent: an offer of a short set-up call.', 'nudge'],
				['2026-09-28', 'Nia booked 3 garden visits.', 'visit'],
				['2026-09-27', 'Nia Edwards started the trial and added Ralph.', 'start'],
			],
		},
		{
			id: 'brightnest',
			status: 'running',
			name: 'Lucent Nest AI',
			industry: 'cleaning',
			plan: 'starter',
			seats: 5,
			city: 'Waco, TX',
			region: 'South',
			email: 'dana@lucentnest.com',
			started: '2026-09-28',
			signedIn: 2,
			bookings: 9,
			nudges: ['2026-10-05'],
			steps: { visit: '2026-09-28', reminder: '2026-10-01' },
			people: [
				['Dana Price', 'Owner', 'Owner', '2026-10-08'],
				['Robyn Mosley', 'Admin', 'Office assistant', '2026-10-06'],
			],
			activity: [
				['2026-10-05', 'Nudge sent: add your cleaners.', 'nudge'],
				['2026-10-01', 'Sent the first text reminders.', 'reminder'],
				['2026-09-28', 'Booked the first cleaning round.', 'visit'],
				['2026-09-28', 'Dana Price started the trial and added Robyn.', 'start'],
			],
		},
		{
			id: 'brookside',
			account: 'brookside',
			status: 'running',
			signedIn: 5,
			bookings: 38,
			nudges: [],
			steps: { team: '2026-09-29', visit: '2026-09-29', reminder: '2026-09-30', invoice: '2026-10-03' },
			people: [
				['Forrest Decker', 'Owner', 'Owner', '2026-10-09'],
				['Casey Gaines', 'Admin', 'Office coordinator', '2026-10-09'],
				['Ike Rudd', 'Member', 'Dog walker', '2026-10-08'],
				['Tara Baird', 'Member', 'Pet sitter', '2026-10-08'],
				['Ben Landry', 'Member', 'Dog walker', '2026-10-07'],
			],
			activity: [
				['2026-10-07', 'Forrest asked about yearly billing.', 'note'],
				['2026-10-03', 'Sent the first invoice, for a week of walks.', 'invoice'],
				['2026-09-30', 'Text reminders turned on for every visit.', 'reminder'],
				['2026-09-29', 'Forrest Decker started the trial and added 4 people.', 'start'],
			],
		},
		{
			id: 'sunvale',
			account: 'sunvale',
			status: 'running',
			signedIn: 13,
			bookings: 54,
			nudges: [],
			steps: { team: '2026-09-30', visit: '2026-10-01', reminder: '2026-10-02' },
			people: [
				['Ann Lyons', 'Owner', 'Studio operations manager', '2026-10-09'],
				['Travis Toll', 'Admin', 'IT lead', '2026-10-08'],
				['Jade Beck', 'Member', 'Photographer', '2026-10-08'],
				['Isaac Hanson', 'Member', 'Photographer', '2026-10-07'],
			],
			activity: [
				['2026-10-08', 'Travis turned on single sign-on for a test group.', 'note'],
				['2026-10-02', 'First reminders went out for Saturday’s shoots.', 'reminder'],
				['2026-10-01', 'Booked the first shoot.', 'visit'],
				['2026-09-30', 'Ann Lyons started the trial and added 12 people.', 'start'],
			],
		},
		{
			id: 'coastline',
			account: 'coastline',
			status: 'running',
			signedIn: 7,
			bookings: 61,
			nudges: [],
			steps: { team: '2026-10-01', visit: '2026-10-02', invoice: '2026-10-06' },
			people: [
				['Ray Downing', 'Owner', 'Owner', '2026-10-09'],
				['Tasha Greene', 'Admin', 'Office manager', '2026-10-09'],
				['Lance Bishop', 'Member', 'Team lead', '2026-10-08'],
				['Beck Peck', 'Member', 'Mover', '2026-10-07'],
			],
			activity: [
				['2026-10-06', 'Sent the first invoice, for a two-bedroom move.', 'invoice'],
				['2026-10-03', 'Imported 1,240 customers from a spreadsheet.', 'note'],
				['2026-10-02', 'Booked the first move.', 'visit'],
				['2026-10-01', 'Ray Downing started the trial and added 6 people.', 'start'],
			],
		},
		{
			id: 'willowbank',
			status: 'running',
			name: 'Willowbank Studio',
			industry: 'homecare',
			plan: 'growth',
			seats: 7,
			city: 'Minot, ND',
			region: 'Midwest',
			email: 'leslie@willowbankstudio.com',
			started: '2026-10-03',
			signedIn: 6,
			bookings: 27,
			nudges: [],
			steps: { team: '2026-10-03', visit: '2026-10-04', reminder: '2026-10-06' },
			people: [
				['Leslie Shaw', 'Owner', 'Care manager', '2026-10-09'],
				['Tom Pickering', 'Admin', 'Care coordinator', '2026-10-09'],
				['Amira Khan', 'Member', 'Caregiver', '2026-10-08'],
				['Joe Barker', 'Member', 'Caregiver', '2026-10-08'],
			],
			activity: [
				['2026-10-08', 'Tom moved four visits to a new caregiver.', 'visit'],
				['2026-10-06', 'Text reminders turned on for families.', 'reminder'],
				['2026-10-04', 'Booked the first home visit.', 'visit'],
				['2026-10-03', 'Leslie Shaw started the trial and added 5 people.', 'start'],
			],
		},
		{
			id: 'alder',
			account: 'alder',
			status: 'running',
			signedIn: 8,
			bookings: 42,
			nudges: [],
			steps: { team: '2026-10-05', visit: '2026-10-05', reminder: '2026-10-07' },
			people: [
				['Conor Alder', 'Owner', 'Owner', '2026-10-09'],
				['Addison Byrne', 'Admin', 'Office manager', '2026-10-09'],
				['Seth Kavanagh', 'Member', 'Team lead', '2026-10-08'],
				['Nicole Doyle', 'Member', 'Mover', '2026-10-08'],
			],
			activity: [
				['2026-10-09', 'Addison booked 6 moves for next week.', 'visit'],
				['2026-10-07', 'First text reminders went out for 11 moves.', 'reminder'],
				['2026-10-05', 'Booked the first move, for Oct 6.', 'visit'],
				['2026-10-05', 'Conor Alder started the trial and added 7 people.', 'start'],
			],
		},
		{
			id: 'northshore',
			status: 'running',
			name: 'Northshore Studios',
			industry: 'photography',
			plan: 'growth',
			seats: 6,
			city: 'Santa Fe, NM',
			region: 'West',
			email: 'martha@northshorestudios.com',
			started: '2026-10-07',
			signedIn: 3,
			bookings: 4,
			nudges: [],
			steps: { team: '2026-10-07', visit: '2026-10-08' },
			people: [
				['Martha Walker', 'Owner', 'Lead photographer', '2026-10-09'],
				['Olga Ashby', 'Admin', 'Studio manager', '2026-10-08'],
				['Rory Nance', 'Member', 'Photographer', '2026-10-08'],
			],
			activity: [
				['2026-10-08', 'Booked the first shoot, a family session.', 'visit'],
				['2026-10-07', 'Martha Walker started the trial and added 2 people.', 'start'],
			],
		},

		/* Became customers this month; billing starts on the conversion date. */
		{
			id: 'redwood',
			status: 'converted',
			closed: '2026-10-08',
			paid: ['growth', 8, 'yearly'],
			name: 'Redwood Studios',
			industry: 'photography',
			plan: 'growth',
			seats: 8,
			city: 'San Diego, CA',
			region: 'West',
			email: 'jon@redwoodstudios.com',
			started: '2026-09-25',
			signedIn: 8,
			bookings: 47,
			nudges: [],
			steps: { team: '2026-09-25', visit: '2026-09-26', reminder: '2026-09-29', invoice: '2026-10-01' },
			people: [
				['Jon Quigley', 'Owner', 'Owner', '2026-10-09'],
				['Kelly Moss', 'Admin', 'Studio manager', '2026-10-09'],
				['Russ Sexton', 'Member', 'Photographer', '2026-10-08'],
				['Lucy Toll', 'Member', 'Photographer', '2026-10-08'],
			],
			activity: [
				['2026-10-08', 'Converted to Pro with 8 seats, billed yearly.', 'paid'],
				['2026-10-01', 'Sent the first invoice, for a wedding shoot.', 'invoice'],
				['2026-09-29', 'Text reminders turned on for every shoot.', 'reminder'],
				['2026-09-25', 'Jon Quigley started the trial and added 7 people.', 'start'],
			],
		},
		{
			id: 'bayview',
			status: 'converted',
			closed: '2026-10-06',
			paid: ['starter', 6, 'monthly'],
			name: 'Bayview Eyewear',
			industry: 'petcare',
			plan: 'starter',
			seats: 6,
			city: 'Bellingham, WA',
			region: 'West',
			email: 'elsie@bayvieweyewear.com',
			started: '2026-09-26',
			signedIn: 6,
			bookings: 33,
			nudges: [],
			steps: { team: '2026-09-26', visit: '2026-09-27', reminder: '2026-09-27', invoice: '2026-10-02' },
			people: [
				['Elsie Collins', 'Owner', 'Owner', '2026-10-09'],
				['Barnaby Hicks', 'Member', 'Dog walker', '2026-10-08'],
				['Jill Dixon', 'Member', 'Pet sitter', '2026-10-08'],
			],
			activity: [
				['2026-10-06', 'Converted to Basic with 6 seats, billed monthly.', 'paid'],
				['2026-10-02', 'Sent the first invoice, for a week of walks.', 'invoice'],
				['2026-09-27', 'Booked the first visit and sent its reminder.', 'reminder'],
				['2026-09-26', 'Elsie Collins started the trial and added 5 people.', 'start'],
			],
		},
		{
			id: 'stonegate',
			status: 'converted',
			closed: '2026-10-02',
			paid: ['growth', 12, 'yearly'],
			name: 'Stonegate Security',
			industry: 'property',
			plan: 'growth',
			seats: 12,
			city: 'Stamford, CT',
			region: 'Northeast',
			email: 'gerald@stonegatesecurity.com',
			started: '2026-09-18',
			signedIn: 11,
			bookings: 96,
			nudges: ['2026-09-30'],
			steps: { team: '2026-09-18', visit: '2026-09-19', reminder: '2026-09-22', invoice: '2026-09-25' },
			people: [
				['Gerald Clarke', 'Owner', 'Owner', '2026-10-09'],
				['Zoey Ali', 'Admin', 'Scheduler', '2026-10-09'],
				['Greg Kerr', 'Member', 'Team lead', '2026-10-08'],
				['Leah Ware', 'Member', 'Caretaker', '2026-10-08'],
			],
			activity: [
				['2026-10-02', 'Converted to Pro with 12 seats, billed yearly.', 'paid'],
				['2026-09-30', 'Nudge sent: your trial ends Friday.', 'nudge'],
				['2026-09-25', 'Sent the first invoice, for a gutter clean.', 'invoice'],
				['2026-09-18', 'Gerald Clarke started the trial and added 10 people.', 'start'],
			],
		},

		/* Lapsed without converting. */
		{
			id: 'lakemont',
			status: 'ended',
			closed: '2026-10-04',
			reason: 'Staying on paper until the spring.',
			name: 'Lakemont Gardens',
			industry: 'landscaping',
			plan: 'starter',
			seats: 5,
			city: 'La Crosse, WI',
			region: 'Midwest',
			email: 'cameron@lakemontgardens.com',
			started: '2026-09-20',
			signedIn: 1,
			bookings: 2,
			nudges: ['2026-10-01'],
			steps: { visit: '2026-09-21' },
			people: [['Cameron Reid', 'Owner', 'Owner', '2026-09-22']],
			activity: [
				['2026-10-04', 'The trial ended. Cameron is staying on paper until the spring.', 'ended'],
				['2026-10-01', 'Nudge sent: your trial ends Sunday.', 'nudge'],
				['2026-09-21', 'Booked 2 garden visits.', 'visit'],
				['2026-09-20', 'Cameron Reid started the trial.', 'start'],
			],
		},
	];

	publish();

	/** Attaches the trials API to the shared demo-data namespace. */
	function publish() {
		window.Basalt.data = window.Basalt.data || {};
		window.Basalt.data.trials = {
			today: DEMO_DAY,
			length: TRIAL_DAYS,
			plans: PLAN_TABLE,
			industries: INDUSTRY_TABLE,
			milestones: SETUP_STEPS,
			templates: NUDGE_EMAILS,
			list: allTrials,
			find: trialById,
			day: trialDay,
			ends: closingDate,
			done: stepsDone,
			next: nextStep,
			price: monthlyCost,
			count: countBookings,
			date: shortDate,
			addDays: shiftDate,
			between: spanInDays,
		};
	}

	/* Reading the records. Both return fresh copies, so a page may change
     what it gets without touching the source. */

	/**
	 * Every trial, active ones first by closing date, then the finished ones
	 * with the most recent close on top.
	 * @returns {object[]}
	 */
	function allTrials() {
		return SIGNUPS.map(overlayAccount).sort(byStatusThenDate);
	}

	/**
	 * @param {string} id
	 * @returns {object|null} the resolved trial, or null for an unknown id
	 */
	function trialById(id) {
		const record = SIGNUPS.find((entry) => entry.id === id);
		return record ? overlayAccount(record) : null;
	}

	function byStatusThenDate(left, right) {
		const rankGap = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
		if (rankGap) return rankGap;
		return left.status === 'running'
			? left.until.localeCompare(right.until)
			: right.closed.localeCompare(left.closed);
	}

	/**
	 * Deep-copies a record and, when it points at an account that exists,
	 * overlays the account's identity and trial dates. A dangling account
	 * id is cleared to null so pages never link to a missing account.
	 * @param {object} record
	 * @returns {object}
	 */
	function overlayAccount(record) {
		const trial = JSON.parse(JSON.stringify(record));
		const bookEntry = trial.account && accountBook ? accountBook.find(trial.account) : null;
		if (bookEntry) {
			for (const [field, source] of Object.entries(FROM_ACCOUNT)) trial[field] = bookEntry[source];
			trial.email = (bookEntry.people.find((person) => person.main) || bookEntry.people[0]).email;
		} else if (trial.account) {
			trial.account = null;
		}
		trial.until ||= shiftDate(trial.started, TRIAL_DAYS);
		trial.steps ||= {};
		return trial;
	}

	/* Questions a page asks about one resolved trial. */

	/** The trial day it is now, or was on the closing date, kept within 1 to 14. */
	function trialDay(trial) {
		const upTo = trial.status === 'running' ? DEMO_DAY : trial.closed;
		const elapsed = spanInDays(trial.started, upTo) + 1;
		return Math.max(1, Math.min(TRIAL_DAYS, elapsed));
	}

	function closingDate(trial) {
		return trial.until;
	}

	function stepsDone(trial) {
		return SETUP_STEPS.filter((step) => trial.steps[step.key]).length;
	}

	function nextStep(trial) {
		return SETUP_STEPS.find((step) => !trial.steps[step.key]) ?? null;
	}

	/**
	 * The monthly bill for a plan once the trial converts.
	 * @param {string} plan  a key of the plan table
	 * @param {number} seats
	 * @param {boolean} yearly  annual billing, charged as ten months over twelve
	 * @returns {number}
	 */
	function monthlyCost(plan, seats, yearly) {
		const fullRate = PLAN_TABLE[plan].price * seats;
		if (!yearly) return fullRate;
		return Math.round((fullRate * 10) / 12);
	}

	/**
	 * A booking count in the industry's own word, singular for exactly one.
	 * @param {number} n
	 * @param {string} industry
	 * @returns {string} for example "1 move" or "42 moves"
	 */
	function countBookings(n, industry) {
		const plural = INDUSTRY_TABLE[industry].visit;
		const noun = n === 1 ? plural.slice(0, -1) : plural;
		return `${n} ${noun}`;
	}

	/* Date helpers. Dates travel as YYYY-MM-DD strings and are read as
     local midnight, so day counts never drift across time zones. */

	function parseDay(text) {
		const [year, month, dayOfMonth] = text.split('-').map(Number);
		return new Date(year, month - 1, dayOfMonth);
	}

	function formatDay(when) {
		const pad = (value) => String(value).padStart(2, '0');
		return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
	}

	/** Moves an ISO date by a whole number of days and returns it as ISO. */
	function shiftDate(text, days) {
		const when = parseDay(text);
		when.setDate(when.getDate() + days);
		return formatDay(when);
	}

	/** Whole days from the first ISO date to the second. */
	function spanInDays(fromText, toText) {
		return Math.round((parseDay(toText) - parseDay(fromText)) / MS_PER_DAY);
	}

	/** "Oct 9", or "Fri, Oct 9" when withDay is set. */
	function shortDate(text, withDay) {
		const when = parseDay(text);
		const monthAndDay = `${MONTH_NAMES[when.getMonth()]} ${when.getDate()}`;
		return withDay ? `${WEEKDAY_NAMES[when.getDay()]}, ${monthAndDay}` : monthAndDay;
	}
})();
