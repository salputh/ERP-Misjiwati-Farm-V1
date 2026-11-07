/**
 * The announcements page (announcements.html): news for the Fieldline team
 * and release notes for customers. Each post knows who it reaches, when it
 * goes out, who has opened it and who has confirmed it, and it gathers
 * reactions and comments from the team.
 *
 * Connecting a backend: SAMPLE below has the shape the page expects, so
 * either replace it or have server.fetchAll() request it. Each method on
 * `server` is the one place an action talks to the backend. The page
 * changes first, and if a request fails it rolls back and shows a toast.
 *
 * Query switches for trying the other states: ?state=empty shows no
 * posts, ?state=error fails the first load only, and ?state=offline fails
 * every save so the rollback is visible.
 *
 * Shared parts it relies on, all from basalt.js: page headers, styled
 * selects, segmented controls, avatars, toasts with an undo, hold to
 * confirm, the drawer, loading buttons, skeletons, empty states and
 * tooltips.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-ann-root]');
	if (!pageRoot) return;

	/* The whole sample payload. Times are "YYYY-MM-DD HH:MM" in the
     viewer's own zone; a real feed only has to keep the same shape. */
	const SAMPLE = {
		clock: '2026-10-02 10:20',
		viewer: 'ja',
		company: 'Fieldline',
		teams: ['Support', 'Success', 'Sales', 'Product', 'Engineering', 'Marketing', 'Finance'],

		/* Everyone on staff, grouped by team: [id, name, job title]. */
		people: {
			Leadership: [['ja', 'John Armstrong', 'Chief Technology Officer']],
			Support: [
				['rk', 'Robyn Klein', 'Head of Support'],
				['tb', 'Todd Butler', 'Support specialist'],
				['ah', 'Alexis Hardin', 'Support specialist'],
				['lm', 'Forrest Murphy', 'Support specialist'],
				['kp', 'Thomas Roe', 'Support engineer'],
				['sv', 'Pamela Vick', 'Support specialist'],
				['dn', 'Marshall Cannon', 'Support specialist'],
				['ew', 'Becky Walsh', 'Support team lead'],
				['ys', 'Barry Şahin', 'Support specialist'],
			],
			Success: [
				['mg', 'Hailey Gates', 'Head of Customer Success'],
				['ob', 'Candace Ashby', 'Account manager'],
				['rn', 'Rex Volk', 'Account manager'],
				['cl', 'Casey Lambert', 'Onboarding specialist'],
				['bt', 'Ben Turner', 'Account manager'],
				['hs', 'Hope Stout', 'Account manager'],
			],
			Sales: [
				['dc', 'Russell Cole', 'VP of Sales'],
				['pm', 'Paula Malone', 'Account executive'],
				['jk', 'Jake Zimmerman', 'Account executive'],
				['nr', 'Nina Fleming', 'Sales development'],
				['sa', 'Rory Aldridge', 'Account executive'],
				['lw', 'Lucy Garner', 'Sales development'],
				['mo', 'Ike Zeller', 'Account executive'],
				['gf', 'Courtney Fischer', 'Sales operations'],
			],
			Product: [
				['ps', 'Connie Sexton', 'Head of Product'],
				['aj', 'Jamie Jensen', 'Product manager'],
				['mf', 'Elsie Faulkner', 'Product designer'],
				['tc', 'Theo Clarke', 'Product manager'],
				['ir', 'Jean Reid', 'Product designer'],
			],
			Engineering: [
				['dk', 'Dana Beck', 'Head of Engineering'],
				['mv', 'Earl Briggs', 'Backend engineer'],
				['sl', 'Sara Lancaster', 'Mobile engineer'],
				['ap', 'Ace Dixon', 'Backend engineer'],
				['jh', 'Jacob Hobbs', 'Site reliability'],
				['ec', 'Elise McKay', 'Frontend engineer'],
				['wz', 'Walt Zook', 'Backend engineer'],
				['fo', 'Fred Odom', 'Mobile engineer'],
				['mb', 'Max Bauer', 'Frontend engineer'],
				['ln', 'Leah Kerr', 'QA engineer'],
				['rt', 'Gavin Carlson', 'Site reliability'],
				['ky', 'Kip Hammond', 'Data engineer'],
			],
			Marketing: [
				['zb', 'Jill Ellery', 'Marketing director'],
				['ci', 'Charles Irving', 'Content lead'],
				['ad', 'Allie Dalton', 'Product marketing'],
				['fr', 'Felicia Ross', 'Lifecycle marketing'],
			],
			Finance: [
				['ng', 'Silas Buckley', 'Finance lead'],
				['vh', 'Vera Harmon', 'Billing specialist'],
				['ik', 'Ira Knowles', 'Accountant'],
			],
		},

		/* The customer base a release note can reach, as of late September:
       48,200 monthly active users across 2,140 paying accounts. Plan and
       region figures are shares of the whole. */
		customerBase: {
			accounts: 2140,
			roles: {
				office: { name: 'Office staff', note: 'Schedulers and managers', users: 12200 },
				tech: { name: 'On-site staff', note: 'Mobile app', users: 36000 },
			},
			plans: {
				Basic: { users: 0.22, accounts: 0.46 },
				Pro: { users: 0.48, accounts: 0.4 },
				Max: { users: 0.3, accounts: 0.14 },
			},
			regions: { Northeast: 0.52, Midwest: 0.26, West: 0.14, South: 0.08 },
		},

		/* audience is { kind: 'staff', teams } (no teams means everyone) or
       { kind: 'customers', roles, plans, regions }. A staff post names who
       has not opened it (unread) and who opened it without confirming
       (unconfirmed). A customer post gives the share of people who opened
       it, the share of accounts that confirmed, and the accounts that are
       furthest behind. Comments are [id, time, author, text, parent id]. */
		posts: [
			{
				id: 'welcome-lori',
				title: 'Welcome Luna Rhodes to Support',
				writer: 'rk',
				status: 'live',
				dated: '2026-10-02 09:15',
				pinned: false,
				askConfirm: false,
				commentsOn: true,
				byEmail: false,
				audience: { kind: 'staff', teams: [] },
				body: 'Luna joins us on **Monday, October 5** from Sarasota to lead Support for the South.\n\n- Phone hours in English and Spanish, 8 am to 6 pm Central time\n- First week: onboarding with Casey, then the Support roster\n\nSay hello in the comments.',
				unread: [
					'ja',
					'dc',
					'pm',
					'jk',
					'sa',
					'lw',
					'ng',
					'vh',
					'ik',
					'zb',
					'ad',
					'fr',
					'mv',
					'ap',
					'jh',
					'wz',
					'fo',
					'mb',
					'ky',
					'hs',
					'ob',
				],
				unconfirmed: [],
				tally: { up: 6, heart: 9, party: 4 },
				myReactions: [],
				discussion: [
					['c1', '2026-10-02 09:32', 'tb', 'Bienvenida, Luna! Sending you my Spanish saved replies.'],
					[
						'c2',
						'2026-10-02 09:58',
						'mo',
						'Great news. Three accounts in Texas asked for phone support this quarter.',
					],
				],
			},
			{
				id: 'oncall-rota',
				title: 'New on-call roster from Oct 5',
				writer: 'rk',
				status: 'live',
				dated: '2026-10-01 11:30',
				pinned: true,
				askConfirm: true,
				commentsOn: true,
				byEmail: true,
				audience: { kind: 'staff', teams: ['Support', 'Engineering'] },
				body: 'From Monday, nights and weekends are covered by **one person from Support and one from Engineering**.\n\n- Shifts run Monday 9 am to Monday 9 am\n- Support takes the first call\n- On-call pay goes up to $250 a week\n\nYour dates are in the [team schedule](schedule.html).',
				unread: ['ys', 'ky', 'ln', 'fo'],
				unconfirmed: ['dn', 'mb', 'rt'],
				tally: { up: 12, heart: 2, party: 1 },
				myReactions: [],
				discussion: [
					['c1', '2026-10-01 12:05', 'mv', 'Can we swap weeks between ourselves?'],
					['c2', '2026-10-01 12:20', 'rk', 'Yes, then update the schedule.', 'c1'],
				],
			},
			{
				id: 'q3-wrap',
				title: 'Q3 wrap-up: $880k MRR',
				writer: 'ja',
				status: 'live',
				dated: '2026-09-30 17:00',
				pinned: false,
				askConfirm: false,
				commentsOn: true,
				byEmail: true,
				audience: { kind: 'staff', teams: [] },
				body: 'We closed September at **$880k MRR** and **2,140 paying accounts**. Thank you, all of you.\n\n- 48,200 people used Fieldline in September, up 9%\n- The Midwest passed 500 paying accounts\n\nQ4 planning notes go out on October 9.',
				unread: ['ys', 'ik', 'ad', 'ln', 'sa', 'fr', 'ky'],
				unconfirmed: [],
				tally: { up: 31, heart: 8, party: 22 },
				myReactions: [],
				discussion: [['c1', '2026-09-30 17:24', 'dc', 'The Midwest passing 500 is huge. Thank you, Paula.']],
			},
			{
				id: 'release-6-4',
				title: 'Fieldline 6.4: smarter lunch breaks',
				writer: 'ps',
				status: 'live',
				dated: '2026-09-29 15:00',
				pinned: true,
				askConfirm: false,
				commentsOn: true,
				byEmail: true,
				audience: {
					kind: 'customers',
					roles: ['office'],
					plans: ['Basic', 'Pro', 'Max'],
					regions: ['Northeast', 'Midwest', 'West', 'South'],
				},
				body: '**Travel Planner now plans each team member’s day around their lunch break.**\n\n- Set a lunch window under Settings, Working hours\n- Visits that cannot fit before the break move after it\n- Drag the break on the day view like a visit',
				openedShare: 0.64,
				confirmedShare: 0,
				behind: [
					{ name: 'Larchwood AI', plan: 'Max', opened: 5, of: 24 },
					{ name: 'Harborside Florals Co.', plan: 'Pro', opened: 2, of: 11 },
					{ name: 'Millrace Ceramics Co.', plan: 'Pro', opened: 2, of: 9 },
					{ name: 'Copperline Audio', plan: 'Basic', opened: 1, of: 6 },
					{ name: 'Sunvale Studios', plan: 'Basic', opened: 0, of: 4 },
				],
				tally: { up: 312, heart: 96, party: 41 },
				myReactions: ['party'],
				discussion: [
					['c1', '2026-09-29 16:10', 'mg', 'Lakeside Apparel already set lunch windows for all 22 walkers.'],
					['c2', '2026-09-30 09:05', 'rk', 'The saved reply for lunch windows is live in Support.'],
				],
			},
			{
				id: 'app-6-4',
				title: 'Mobile 6.4: offline visit notes',
				writer: 'aj',
				status: 'live',
				dated: '2026-09-29 15:05',
				pinned: false,
				askConfirm: false,
				commentsOn: true,
				byEmail: false,
				audience: {
					kind: 'customers',
					roles: ['tech'],
					plans: ['Basic', 'Pro', 'Max'],
					regions: ['Northeast', 'Midwest', 'West', 'South'],
				},
				body: 'Your staff can now **write visit notes with no signal**. Notes upload as soon as the phone is back online.\n\n- Draw on visit photos to point out a detail\n- Needs iOS 16 or Android 11',
				openedShare: 0.47,
				confirmedShare: 0,
				behind: [
					{ name: 'Northgate Analytics', plan: 'Max', opened: 21, of: 64 },
					{ name: 'Brightline Photography', plan: 'Pro', opened: 6, of: 23 },
					{ name: 'Tidewater Pet Sitting Co.', plan: 'Pro', opened: 4, of: 18 },
					{ name: 'Avocet Mobility Group', plan: 'Basic', opened: 1, of: 7 },
				],
				tally: { up: 488, heart: 130, party: 52 },
				myReactions: [],
				discussion: [
					['c1', '2026-09-30 11:16', 'tb', 'Brightline asked whether it works on older Android phones.'],
					['c2', '2026-09-30 11:40', 'sl', 'Android 10 support comes in 6.5.', 'c1'],
				],
			},
			{
				id: 'sms-sender',
				title: 'Midwest SMS sender rules from Nov 1',
				writer: 'mg',
				status: 'live',
				dated: '2026-09-24 10:00',
				pinned: false,
				askConfirm: true,
				commentsOn: true,
				byEmail: true,
				audience: {
					kind: 'customers',
					roles: ['office'],
					plans: ['Basic', 'Pro', 'Max'],
					regions: ['Midwest'],
				},
				body: 'From **November 1**, texts from Midwest accounts only go out under a registered sender name.\n\n- Register yours under Settings, SMS, Sender name\n- It is free and takes two working days\n\nPlease confirm so we know your account is ready.',
				openedShare: 0.71,
				confirmedShare: 0.48,
				behind: [
					{ name: 'Northlight Photography', plan: 'Max', opened: 4, of: 19 },
					{ name: 'Harborside Florals Co.', plan: 'Pro', opened: 1, of: 11 },
					{ name: 'Brightline Photography', plan: 'Pro', opened: 2, of: 8 },
					{ name: 'Calder Type Kiln Services', plan: 'Basic', opened: 0, of: 4 },
				],
				tally: { up: 64, heart: 3, party: 0 },
				myReactions: [],
				discussion: [
					['c1', '2026-09-28 15:30', 'vh', '214 sender names registered so far, all within two days.'],
				],
			},
			{
				id: 'annual-offer',
				title: 'Annual billing: two months free',
				writer: 'dc',
				status: 'live',
				dated: '2026-09-25 14:00',
				pinned: false,
				askConfirm: false,
				commentsOn: true,
				byEmail: false,
				audience: { kind: 'staff', teams: ['Sales', 'Success'] },
				body: 'Accounts that move to annual billing before **October 31** get two months free, on any plan.\n\n- Quote it from the pricing page\n- Billing applies the discount on the first invoice',
				unread: ['jk', 'hs'],
				unconfirmed: [],
				tally: { up: 9, heart: 0, party: 3 },
				myReactions: [],
				discussion: [
					['c1', '2026-09-25 15:10', 'ob', 'Does it apply to renewals in October?'],
					['c2', '2026-09-25 15:26', 'dc', 'Yes, if they sign by October 31.', 'c1'],
				],
			},
			{
				id: 'security-keys',
				title: 'Security keys for everyone by Oct 30',
				writer: 'dk',
				status: 'live',
				dated: '2026-09-22 09:30',
				pinned: false,
				askConfirm: true,
				commentsOn: true,
				byEmail: true,
				audience: { kind: 'staff', teams: [] },
				body: 'From **October 30**, signing in to our admin tools needs a physical security key.\n\n- Two keys per person are on their way\n- Add both, then confirm below\n- Keep the spare one at home',
				unread: ['ys', 'fr', 'ik', 'sa'],
				unconfirmed: ['ja', 'mo', 'lw', 'ci', 'gf', 'vh'],
				tally: { up: 21, heart: 1, party: 0 },
				myReactions: [],
				discussion: [
					['c1', '2026-09-28 10:02', 'lw', 'Mine arrived with only one key in the box.'],
					['c2', '2026-09-28 10:30', 'dk', 'Sorry, a second batch ships on Monday.', 'c1'],
				],
			},
			{
				id: 'west-team',
				title: 'Hello from our Flagstaff team',
				writer: 'mg',
				status: 'live',
				dated: '2026-09-15 08:30',
				pinned: false,
				askConfirm: false,
				commentsOn: true,
				byEmail: false,
				audience: { kind: 'staff', teams: [] },
				body: 'Hope Stout (Success) and Walt Zook (Engineering) started this week in Flagstaff. They cover customers in the West from 8 am to 6 pm local time.',
				unread: ['ik'],
				unconfirmed: [],
				tally: { up: 18, heart: 14, party: 11 },
				myReactions: ['heart'],
				discussion: [['c1', '2026-09-15 09:40', 'hs', 'Thank you for the welcome, everyone.']],
			},
			{
				id: 'spanish',
				title: 'Now in Spanish',
				writer: 'mo',
				status: 'live',
				dated: '2026-09-10 13:00',
				pinned: false,
				askConfirm: false,
				commentsOn: true,
				byEmail: true,
				audience: {
					kind: 'customers',
					roles: ['office', 'tech'],
					plans: ['Basic', 'Pro', 'Max'],
					regions: ['South'],
				},
				body: 'The web app and the mobile app are now in **Spanish**. Each person picks their language under Profile, Language.',
				openedShare: 0.58,
				confirmedShare: 0,
				behind: [
					{ name: 'Solaris Photography', plan: 'Pro', opened: 10, of: 38 },
					{ name: 'Caring Hands Home Care', plan: 'Pro', opened: 6, of: 27 },
					{ name: 'Andes Outfitters', plan: 'Basic', opened: 2, of: 9 },
				],
				tally: { up: 140, heart: 77, party: 35 },
				myReactions: [],
				discussion: [],
			},
			{
				id: 'maintenance-oct-11',
				title: 'Planned maintenance on Oct 11',
				writer: 'dk',
				status: 'scheduled',
				dated: '2026-10-05 09:00',
				pinned: false,
				askConfirm: true,
				commentsOn: true,
				byEmail: true,
				audience: {
					kind: 'customers',
					roles: ['office'],
					plans: ['Basic', 'Pro', 'Max'],
					regions: ['Northeast', 'Midwest', 'West', 'South'],
				},
				body: 'Fieldline will be **read-only for up to two hours** on Sunday, October 11, from 2 to 4 am UTC.\n\n- Staff can see their day but not close visits\n- Work done offline uploads when we are back',
				tally: {},
				myReactions: [],
				discussion: [['c1', '2026-10-01 16:02', 'rk', 'Support will have two extra people on that Sunday.']],
			},
			{
				id: 'offsite',
				title: 'Office closed Oct 12 for the offsite',
				writer: 'ja',
				status: 'scheduled',
				dated: '2026-10-06 08:00',
				pinned: false,
				askConfirm: false,
				commentsOn: true,
				byEmail: true,
				audience: { kind: 'staff', teams: [] },
				body: 'The whole team spends **Monday, October 12** together. Support runs the weekend roster for the day.\n\n- Coaches leave at 8:30 am\n- Tell Finance about food allergies by October 7',
				tally: {},
				myReactions: [],
				discussion: [],
			},
			{
				id: 'beta-6-5',
				title: 'Mobile 6.5 beta is open',
				writer: 'aj',
				status: 'scheduled',
				dated: '2026-10-08 16:00',
				pinned: false,
				askConfirm: false,
				commentsOn: true,
				byEmail: false,
				audience: { kind: 'customers', roles: ['tech'], plans: ['Pro', 'Max'], regions: ['Northeast'] },
				body: 'Try the next version early: **voice notes on visits** and quicker signatures. Turn it on under Settings, Mobile app.',
				tally: {},
				myReactions: [],
				discussion: [],
			},
			{
				id: 'portal-redesign',
				title: 'A new look for the Customer Portal',
				writer: 'ps',
				status: 'draft',
				dated: '2026-10-01 16:40',
				pinned: false,
				askConfirm: false,
				commentsOn: true,
				byEmail: true,
				audience: {
					kind: 'customers',
					roles: ['office'],
					plans: ['Pro', 'Max'],
					regions: ['Northeast', 'Midwest', 'West', 'South'],
				},
				body: 'In November the Customer Portal gets a cleaner design and **real arrival windows** for online booking. Your logo and links carry over.',
				tally: {},
				myReactions: [],
				discussion: [
					['c1', '2026-10-01 17:05', 'mf', 'Can we add a screenshot once the booking page is final?'],
					['c2', '2026-10-01 17:12', 'ps', 'Yes. I will hold the post until then.', 'c1'],
				],
			},
			{
				id: 'release-6-3',
				title: 'Fieldline 6.3: pause recurring visits',
				writer: 'tc',
				status: 'archived',
				dated: '2026-08-25 15:00',
				pinned: false,
				askConfirm: false,
				commentsOn: true,
				byEmail: true,
				audience: {
					kind: 'customers',
					roles: ['office'],
					plans: ['Basic', 'Pro', 'Max'],
					regions: ['Northeast', 'Midwest', 'West', 'South'],
				},
				body: 'Pause a recurring visit while a customer is away. It picks up again on the date you choose.',
				openedShare: 0.81,
				confirmedShare: 0,
				behind: [{ name: 'Copperline Audio', plan: 'Basic', opened: 2, of: 6 }],
				tally: { up: 205, heart: 61, party: 12 },
				myReactions: [],
				discussion: [],
			},
			{
				id: 'summer-fridays',
				title: 'Summer Fridays end Sep 4',
				writer: 'ja',
				status: 'archived',
				dated: '2026-08-28 09:00',
				pinned: false,
				askConfirm: false,
				commentsOn: true,
				byEmail: false,
				audience: { kind: 'staff', teams: [] },
				body: 'Thanks for a good summer. Normal Friday hours are back from September 11.',
				unread: [],
				unconfirmed: [],
				tally: { up: 14, heart: 2, party: 0 },
				myReactions: [],
				discussion: [],
			},
		],

		/* Scripted activity, so the live parts move while the page is open.
       `after` is seconds from the moment the feed arrives. */
		happenings: [
			{
				after: 9,
				post: 'q3-wrap',
				type: 'comment',
				who: 'ng',
				text: 'The Q3 board pack is in the Finance folder.',
			},
			{ after: 16, post: 'oncall-rota', type: 'read', who: 'ky', confirmed: true },
			{
				after: 24,
				post: 'welcome-lori',
				type: 'comment',
				who: 'ec',
				text: 'Welcome, Luna! Happy to walk you through the schedule board.',
			},
		],
	};

	/* Stand-ins for the backend. Each resolves after a short pause; a real
     version swaps the body for a request and keeps what it resolves to. */
	const demoSwitch = new URLSearchParams(location.search).get('state');
	let failFirstLoad = demoSwitch === 'error';

	const server = {
		/** GET /api/announcements, the posts, staff and audience figures. */
		fetchAll() {
			if (failFirstLoad) {
				failFirstLoad = false;
				return pause(600).then(() => {
					throw new Error('The server did not answer');
				});
			}
			const payload = JSON.parse(JSON.stringify(SAMPLE));
			if (demoSwitch === 'empty') {
				payload.posts = [];
				payload.happenings = [];
			}
			return pause(500, payload);
		},
		/* POST /api/announcements with the post */
		create(draft) {
			return settle(450);
		},
		/* PATCH /api/announcements/:id with the changed fields */
		update(id, changes) {
			return settle(350);
		},
		/* POST /api/announcements/:id/publish */
		publish(id) {
			return settle(300);
		},
		/* PUT or DELETE /api/announcements/:id/pin */
		setPinned(id, pinned) {
			return settle(150);
		},
		/* POST /api/announcements/:id/archive */
		archive(id) {
			return settle(200);
		},
		/* POST /api/announcements/:id/restore */
		unarchive(id) {
			return settle(200);
		},
		/* DELETE /api/announcements/:id */
		destroy(id) {
			return settle(250);
		},
		/* POST /api/announcements/:id/read */
		markSeen(id) {
			return settle(100);
		},
		/* POST /api/announcements/:id/acknowledge */
		confirmRead(id) {
			return settle(250);
		},
		/* PUT or DELETE /api/announcements/:id/reactions/:key */
		setReaction(id, key, chosen) {
			return settle(120);
		},
		/* POST /api/announcements/:id/comments with the text and the parent */
		postComment(id, comment) {
			return settle(300);
		},
		/* DELETE /api/announcements/:id/comments/:commentId */
		dropComment(id, commentId) {
			return settle(200);
		},
		/* POST /api/announcements/:id/reminders with the people or accounts */
		nudge(id, recipientsList) {
			return settle(700);
		},
	};

	/* Fixed vocabulary. */
	const VISIBLE_ROWS = 7;
	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const REACTION_KINDS = [
		{ key: 'up', name: 'Thumbs up', idle: 'bi-hand-thumbs-up', chosen: 'bi-hand-thumbs-up-fill' },
		{ key: 'heart', name: 'Love it', idle: 'bi-heart', chosen: 'bi-heart-fill' },
		{ key: 'party', name: 'Celebrate', idle: 'bi-stars', chosen: 'bi-stars' },
	];
	const STATUS_LOOK = {
		live: { tone: 'success', text: 'Live' },
		scheduled: { tone: 'info', text: 'Scheduled' },
		draft: { tone: '', text: 'Draft' },
		archived: { tone: '', text: 'Archived' },
	};
	/* Editor buttons: what goes before and after the selection, and the
     filler used when nothing is selected. */
	const MARKUP_FOR = {
		bold: { open: '**', close: '**', filler: 'bold text' },
		italic: { open: '_', close: '_', filler: 'italic text' },
		list: { open: '\n- ', close: '', filler: 'List item' },
		link: { open: '[', close: '](https://)', filler: 'link text' },
	};

	/* The demo keeps its own "now", which starts at SAMPLE.clock and runs
     on with the real one. A live app uses new Date() instead. */
	const sampleStart = readStamp(SAMPLE.clock);
	const pageOpenedAt = Date.now();

	/* What the page is showing. feed is the loaded payload. */
	let feed = null;
	const staffById = new Map();
	const view = {
		posts: [],
		statusFilter: 'all',
		audienceFilter: 'any',
		search: '',
		showAll: false,
		loading: true,
		failed: null,
		openId: null,
		panelMode: 'post',
		previewIn: 'web',
		commentsShown: false,
		replyingTo: null,
		unsent: {},
		editingId: null,
		returnTo: null,
		afterHide: null,
	};

	/* Elements the page owns. */
	const list = {
		rows: pick('[data-ann-rows]'),
		table: pick('[data-ann-table]'),
		empty: pick('[data-ann-empty]'),
		summary: pick('[data-ann-summary]'),
		foot: pick('[data-ann-foot]'),
		footNote: pick('[data-ann-foot-note]'),
		more: pick('[data-ann-more]'),
		search: pick('[data-ann-search]'),
		statusSelect: pick('[data-ann-status]'),
		audienceSelect: pick('[data-ann-audience-filter]'),
		politeRegion: pick('[data-ann-live]'),
		liveFigure: pick('[data-ann-fig="live"]'),
		readFigure: pick('[data-ann-fig="read"]'),
		owedFigure: pick('[data-ann-fig="ack"]'),
	};
	const drawer = pick('#ann-post');
	const panel = {
		title: pick('[data-ann-d="title"]', drawer),
		byline: pick('[data-ann-d="sub"]', drawer),
		fullLink: pick('[data-ann-d="full"]', drawer),
		body: pick('[data-ann-d="body"]', drawer),
		foot: pick('[data-ann-d="foot"]', drawer),
	};
	const composer = pick('[data-ann-form]');
	const composerDialog = pick('#ann-compose');
	const composerSubmit = pick('[data-ann-submit]', composer);
	const deleteDialog = pick('#ann-delete');
	const holdToDelete = pick('[data-ann-delete-hold]');

	/* Bookkeeping that outlives a single render. */
	let commentCount = 0;
	let searchDelay = 0;
	let fillTimer = 0;
	const scriptedTimers = [];
	let pendingDeleteId = null;
	let deleteWentThrough = false;
	let justSavedId = null;

	start();

	/** Binds every listener once, then asks for the feed. */
	function start() {
		bindList();
		bindPanel();
		bindDeleteDialog();
		bindComposer();
		document.addEventListener('keydown', onShortcut);
		loadFeed();
	}

	/* The feed arrives once at start and again on Retry. */

	function loadFeed() {
		view.loading = true;
		view.failed = null;
		repaint();
		server
			.fetchAll()
			.then((payload) => {
				adopt(payload);
				view.loading = false;
				repaint();
				playHappenings();
				openFromHash();
			})
			.catch(() => {
				view.loading = false;
				view.failed = true;
				repaint();
				say('Announcements did not load.');
			});
	}

	/* A link that ends in #post-id opens that post, switching the list to
     Archived first when that is where the post lives. */
	function openFromHash() {
		const wanted = decodeURIComponent((location.hash || '').slice(1));
		const post = wanted && findPost(wanted);
		if (!post) return;
		if (post.status === 'archived') {
			view.statusFilter = 'archived';
			chooseOption(list.statusSelect, 'archived');
			paintList();
		}
		showPost(post.id);
	}

	/** Takes the payload in and turns each post into its working form. */
	function adopt(payload) {
		feed = payload;
		staffById.clear();
		for (const [team, members] of Object.entries(payload.people)) {
			for (const [id, name, role] of members) staffById.set(id, { id, name, team, role });
		}
		view.posts = payload.posts.map(toWorkingPost);
	}

	/** Parses times, fills gaps and turns id lists into sets. */
	function toWorkingPost(raw) {
		const post = { ...raw };
		post.dated = readStamp(raw.dated);
		post.tally = { up: 0, heart: 0, party: 0, ...raw.tally };
		post.myReactions = new Set(raw.myReactions || []);
		post.discussion = (raw.discussion || []).map(([id, stamp, author, text, parentId]) => ({
			id,
			author,
			posted: readStamp(stamp),
			text,
			parentId: parentId || null,
		}));
		if (post.audience.kind !== 'staff') {
			post.openedShare = raw.openedShare || 0;
			post.confirmedShare = raw.confirmedShare || 0;
			post.behind = (raw.behind || []).map((row) => ({ ...row }));
			return post;
		}
		post.unread = new Set(raw.unread || audienceOf(post).map((member) => member.id));
		post.unconfirmed = new Set(raw.unconfirmed || []);
		return post;
	}

	/* The list card: its search, two filters, the rows and the footer. */

	function bindList() {
		list.rows.addEventListener('click', onRowClick);
		list.rows.addEventListener('auxclick', (event) => {
			if (event.button !== 1 || event.target.closest('button')) return;
			onRowClick(event);
		});

		list.search.addEventListener('input', () => {
			clearTimeout(searchDelay);
			searchDelay = setTimeout(() => {
				view.search = list.search.value;
				paintList();
				if (view.search.trim()) speakPolitely(`${countOf(visiblePosts().length, 'post')} found`);
			}, 120);
		});
		list.search.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape' || !list.search.value) return;
			event.preventDefault();
			emptySearch();
		});

		list.statusSelect.addEventListener('change', () => {
			view.statusFilter = list.statusSelect.value;
			view.showAll = false;
			paintList();
		});
		list.audienceSelect.addEventListener('change', () => {
			view.audienceFilter = list.audienceSelect.value;
			view.showAll = false;
			paintList();
		});
		list.more.addEventListener('click', () => {
			window.Basalt.slide(list.table.parentElement, () => {
				view.showAll = !view.showAll;
				paintList();
			});
		});

		/* Buttons inside empty states and the header, found by their hook. */
		const pageButtons = [
			['[data-ann-retry]', loadFeed],
			['[data-ann-clear]', emptySearch],
			['[data-ann-clear-filters]', resetFilters],
			['[data-ann-compose]', () => openComposer(null)],
		];
		pageRoot.addEventListener('click', (event) => {
			const hit = pageButtons.find(([hook]) => event.target.closest(hook));
			if (hit) hit[1]();
		});
	}

	/* A row leads to the post's own page, as its title does, and a new tab
     with Cmd, Ctrl or the middle button. Only the panel icon opens the
     quick view. */
	function onRowClick(event) {
		if (event.target.closest('a')) return;
		const quickView = event.target.closest('[data-ann-open]');
		if (quickView) {
			showPost(quickView.dataset.annOpen);
			return;
		}
		const titleLink = event.target.closest('tr[data-ann-id]')?.querySelector('.ann-row-link');
		if (!titleLink) return;
		const newTab = event.metaKey || event.ctrlKey || event.button === 1;
		if (newTab) window.open(titleLink.href, '_blank', 'noopener');
		else location.href = titleLink.href;
	}

	function emptySearch() {
		list.search.value = '';
		view.search = '';
		paintList();
		list.search.focus();
	}

	function resetFilters() {
		view.statusFilter = 'all';
		view.audienceFilter = 'any';
		chooseOption(list.statusSelect, 'all');
		chooseOption(list.audienceSelect, 'any');
		paintList();
	}

	/** Sets a select and lets the styled select and our listener know. */
	function chooseOption(select, value) {
		if (select.value === value) return;
		select.value = value;
		select.dispatchEvent(new Event('change', { bubbles: true }));
	}

	function repaint() {
		paintFigures();
		paintList();
	}

	/* The three header figures: live posts, the team's average read share
     across live staff posts, and the confirmations still owed. */
	function paintFigures() {
		const ready = feed && !view.loading && !view.failed;
		const live = ready ? view.posts.filter((post) => post.status === 'live') : [];
		const staffPosts = live.filter((post) => post.audience.kind === 'staff');
		const shares = staffPosts.map((post) => {
			const numbers = readFigures(post);
			return numbers.total ? numbers.read / numbers.total : 0;
		});
		let owed = 0;
		for (const post of staffPosts) {
			if (!post.askConfirm) continue;
			const numbers = readFigures(post);
			owed += numbers.total - numbers.confirmed;
		}
		const average = shares.length
			? Math.round((shares.reduce((total, share) => total + share, 0) / shares.length) * 100)
			: 0;
		list.liveFigure.textContent = ready ? formatCount(live.length) : '–';
		list.readFigure.textContent = ready ? `${average}%` : '–';
		list.owedFigure.textContent = ready ? formatCount(owed) : '–';
	}

	function paintList() {
		list.summary.textContent = summaryLine();
		list.rows.setAttribute('aria-busy', String(view.loading));

		if (view.loading) {
			list.table.hidden = false;
			list.rows.innerHTML = placeholderRows();
			list.empty.hidden = true;
			list.foot.hidden = true;
			return;
		}
		if (view.failed) {
			list.table.hidden = true;
			list.rows.innerHTML = '';
			list.empty.innerHTML = blankNote('error');
			list.empty.hidden = false;
			list.foot.hidden = true;
			return;
		}

		const matching = visiblePosts();
		const onScreen = view.showAll ? matching : matching.slice(0, VISIBLE_ROWS);
		list.rows.innerHTML = onScreen.map(rowMarkup).join('');
		window.Basalt.tips?.(list.rows);

		const reason = matching.length ? null : whyEmpty();
		list.table.hidden = !!reason;
		list.empty.hidden = !reason;
		list.empty.innerHTML = reason ? blankNote(reason) : '';

		/* Past the first rows, a quiet footer offers the rest. */
		const overflow = matching.length > VISIBLE_ROWS;
		list.foot.hidden = !overflow;
		if (!overflow) return;
		list.footNote.textContent = view.showAll
			? `Showing all ${matching.length} posts.`
			: `Showing the first ${VISIBLE_ROWS} of ${matching.length} posts.`;
		list.more.textContent = view.showAll ? 'Show fewer' : `Show all ${matching.length}`;
		list.more.setAttribute('aria-expanded', String(view.showAll));
	}

	function whyEmpty() {
		if (!view.posts.length) return 'none';
		return view.search.trim() ? 'search' : 'filter';
	}

	/** The sentence under the card title, counting what the list holds. */
	function summaryLine() {
		if (view.loading) return 'Loading posts…';
		if (view.failed) return 'Posts could not be loaded.';
		const counts = { live: 0, scheduled: 0, draft: 0 };
		for (const post of view.posts) {
			if (post.status in counts) counts[post.status] += 1;
		}
		const pieces = [];
		if (counts.live) pieces.push(`${counts.live} live`);
		if (counts.scheduled) pieces.push(`${counts.scheduled} scheduled`);
		if (counts.draft) pieces.push(countOf(counts.draft, 'draft'));
		return pieces.length ? `${joinWords(pieces)}. Pinned posts stay at the top.` : 'Nothing posted yet.';
	}

	function visiblePosts() {
		return view.posts.filter(passesFilters).sort(listOrder);
	}

	function passesFilters(post) {
		const statusOk = view.statusFilter === 'all' ? post.status !== 'archived' : post.status === view.statusFilter;
		if (!statusOk) return false;
		if (view.audienceFilter !== 'any' && post.audience.kind !== view.audienceFilter) return false;
		const terms = view.search.trim().toLowerCase();
		if (!terms) return true;
		const haystack = [post.title, stripMarks(post.body), personFor(post.writer).name, audienceLong(post.audience)]
			.join(' ')
			.toLowerCase();
		return terms.split(/\s+/).every((term) => haystack.includes(term));
	}

	/* Pinned live posts lead, then the newest; scheduled posts carry future
     dates, so they come before the rest. */
	function listOrder(first, second) {
		const pinnedFirst = (second.status === 'live' && second.pinned) - (first.status === 'live' && first.pinned);
		return pinnedFirst || second.dated - first.dated;
	}

	function rowMarkup(post) {
		const pageLink = `announcement-details.html?id=${encodeURIComponent(post.id)}`;
		const audience = htmlSafe(audienceShort(post.audience));
		const pinMark =
			post.pinned && post.status === 'live'
				? `${icon('bi-pin-angle-fill ann-pin')}<span class="visually-hidden">Pinned: </span>`
				: '';
		const postCell = [
			`<p class="ann-row-title">${pinMark}<a href="${pageLink}" class="ann-row-link">${htmlSafe(post.title)}</a></p>`,
			`<p class="ann-row-meta">${htmlSafe(personFor(post.writer).name)} · ${htmlSafe(shortWhen(post))}<span class="ann-row-aud-inline"> · ${audience}</span></p>`,
		].join('');
		const actions = [
			`<button data-ann-open="${htmlSafe(post.id)}" aria-label="Quick view: ${htmlSafe(post.title)}" data-bs-title="Quick view" data-bs-toggle="tooltip" data-bs-trigger="hover" class="btn btn-icon btn-sm" type="button">${icon('bi-layout-sidebar-inset-reverse')}</button>`,
			`<a href="${pageLink}" aria-label="Open full page: ${htmlSafe(post.title)}" data-bs-title="Open full page" data-bs-toggle="tooltip" data-bs-trigger="hover" class="btn btn-icon btn-sm">${icon('bi-arrows-angle-expand')}</a>`,
		].join('');
		const cells = [
			['ann-row-post', postCell],
			['ann-row-aud', `<span class="ann-aud">${icon(audienceIcon(post.audience))}${audience}</span>`],
			['ann-row-status', stateBadge(post)],
			['ann-row-read', readCell(post)],
			['ann-row-open', `<span class="basalt-row-actions">${actions}</span>`],
		];
		const opened = post.id === view.openId ? ' is-open' : '';
		return `<tr data-ann-id="${htmlSafe(post.id)}" class="ann-row${opened}">${cells.map(([cls, inner]) => `<td class="${cls}">${inner}</td>`).join('')}</tr>`;
	}

	function readCell(post) {
		if (notSentYet(post)) return '<span class="ann-quiet">Not sent yet</span>';
		const numbers = readFigures(post);
		const share = percentOf(numbers.read, numbers.total);
		const meter = `<span aria-hidden="true" class="ann-meter"><span style="width:${share}%"></span></span>`;
		return `<span class="ann-read"><span class="ann-read-label">Read </span>${meter}<span class="ann-read-n">${share}%</span></span>`;
	}

	function stateBadge(post) {
		const look = STATUS_LOOK[post.status];
		const tone = look.tone ? ` basalt-status-${look.tone}` : '';
		return `<span class="basalt-status basalt-status-dot${tone}">${look.text}</span>`;
	}

	function shortWhen(post) {
		const prefix = { scheduled: 'Goes out', draft: 'Edited' }[post.status];
		return prefix ? `${prefix} ${lowerRelative(shortDay(post.dated))}` : shortDay(post.dated);
	}

	function placeholderRows() {
		const bar = (extra) => `<span class="basalt-skeleton basalt-skeleton-text${extra}"></span>`;
		const row = [
			'<tr aria-hidden="true" class="ann-row ann-row-skeleton">',
			`<td class="ann-row-post">${bar(' ann-skel-mid')}${bar(' basalt-skeleton-sm ann-skel-short')}</td>`,
			`<td class="ann-row-aud">${bar('')}</td>`,
			`<td class="ann-row-status">${bar('')}</td>`,
			`<td class="ann-row-read">${bar('')}</td>`,
			'<td class="ann-row-open"></td></tr>',
		].join('');
		return row.repeat(6);
	}

	/** The block shown in place of the table: a load error, no posts at
      all, a search with no hits, or filters that leave nothing. */
	function blankNote(reason) {
		const filtersOn = view.statusFilter !== 'all' || view.audienceFilter !== 'any';
		const looks = {
			error: () => ({
				tone: 'danger',
				glyph: 'bi-cloud-slash',
				heading: 'Announcements did not load',
				text: 'The server did not answer. Nothing is lost; this only affects what you can see here.',
				buttons: `<button data-ann-retry class="btn btn-sm btn-primary" type="button">${icon('bi-arrow-clockwise me-1')}Try again</button>`,
			}),
			none: () => ({
				glyph: 'bi-megaphone',
				heading: 'Nothing announced yet',
				text: 'Share news with the team, or tell customers what is new. You choose who sees each post.',
				buttons: `<button data-ann-compose class="btn btn-sm btn-primary" type="button">${icon('bi-pencil-square me-1')}Write the first one</button>`,
			}),
			search: () => ({
				glyph: 'bi-search',
				heading: `No posts match “${htmlSafe(view.search.trim())}”`,
				text: `Search looks at titles, the message, authors and audiences${filtersOn ? ' in this view only' : ''}.`,
				buttons: `<button data-ann-clear class="btn btn-sm btn-outline-secondary" type="button">Clear the search</button>${
					filtersOn
						? '<button data-ann-clear-filters class="btn btn-sm btn-outline-secondary" type="button">Search everything</button>'
						: ''
				}`,
			}),
			filter: () => {
				const nouns = {
					all: 'posts',
					live: 'live posts',
					scheduled: 'scheduled posts',
					draft: 'drafts',
					archived: 'archived posts',
				};
				const forWhom = { any: '', staff: ' for the team', customers: ' for customers' }[view.audienceFilter];
				return {
					glyph: 'bi-funnel',
					heading: `No ${nouns[view.statusFilter]}${forWhom}`,
					text:
						view.statusFilter === 'archived'
							? 'Archived posts leave every feed but keep their history.'
							: 'Try another filter.',
					buttons:
						'<button data-ann-clear-filters class="btn btn-sm btn-outline-secondary" type="button">Show all posts</button>',
				};
			},
		};
		const look = looks[reason]();
		const tone = look.tone ? ` basalt-empty-${look.tone}` : '';
		const role = reason === 'error' ? ' role="alert"' : '';
		return [
			`<div${role} class="basalt-empty basalt-empty-compact${tone} ann-empty">`,
			`<span aria-hidden="true" class="ann-empty-icon"><i class="bi ${look.glyph}"></i></span>`,
			`<h3 class="basalt-empty-title">${look.heading}</h3>`,
			`<p class="basalt-empty-text">${look.text}</p>`,
			look.buttons ? `<div class="basalt-empty-actions">${look.buttons}</div>` : '',
			'</div>',
		].join('');
	}

	/* The side panel shows one post, or its customer preview, and owns
     the clicks inside it. */

	function bindPanel() {
		drawer.addEventListener('shown.bs.offcanvas', () => panel.title.focus());
		drawer.addEventListener('hide.bs.offcanvas', () => retireTooltips(drawer));
		drawer.addEventListener('hidden.bs.offcanvas', onPanelHidden);
		drawer.addEventListener('click', onPanelClick);
		drawer.addEventListener('change', (event) => {
			const choice = event.target.closest('[data-ann-view]');
			if (!choice?.checked) return;
			view.previewIn = choice.value;
			const stage = pick('[data-ann-preview]', panel.body);
			if (stage) stage.innerHTML = mockup(findPost(view.openId), view.previewIn);
		});
		drawer.addEventListener('input', (event) => {
			if (!event.target.matches('[data-ann-reply-text]')) return;
			view.unsent[view.openId] = event.target.value;
			event.target.classList.remove('is-invalid');
			event.target.removeAttribute('aria-invalid');
		});
		drawer.addEventListener('submit', (event) => {
			if (!event.target.matches('[data-ann-reply-form]')) return;
			event.preventDefault();
			postComment(findPost(view.openId));
		});
		drawer.addEventListener('keydown', (event) => {
			const sendKeys = event.key === 'Enter' && (event.ctrlKey || event.metaKey);
			if (!sendKeys || !event.target.matches('[data-ann-reply-text]')) return;
			event.preventDefault();
			postComment(findPost(view.openId));
		});
	}

	function showPost(id) {
		const post = findPost(id);
		if (!post) return;
		if (view.openId !== id) {
			view.commentsShown = false;
			view.replyingTo = null;
		}
		view.openId = id;
		view.panelMode = 'post';
		if (unreadByMe(post)) {
			post.unread.delete(feed.viewer);
			server.markSeen(post.id).catch(() => {
				post.unread.add(feed.viewer);
				repaint();
			});
		}
		setHash(`#${post.id}`);
		paintPanel();
		repaint();
		offcanvas().show();
	}

	/* Closing normally clears the hash and returns focus to the row. When a
     dialog asked for the room, the panel steps aside and the dialog runs. */
	function onPanelHidden() {
		const closedId = view.openId;
		if (view.afterHide) {
			const next = view.afterHide;
			view.afterHide = null;
			next();
			return;
		}
		view.openId = null;
		setHash(location.pathname + location.search);
		paintList();
		const rowButton = closedId && pick(`[data-ann-open="${CSS.escape(closedId)}"]`, list.rows);
		if (rowButton) rowButton.focus();
		else list.search.focus();
	}

	function setHash(target) {
		try {
			history.replaceState(null, '', target);
		} catch {
			/* file:// pages refuse replaceState; the hash is only a nicety. */
		}
	}

	/** Hides the panel first, then runs next (a dialog that needs the screen). */
	function afterPanelCloses(next) {
		if (!panelShowing()) {
			next();
			return;
		}
		view.afterHide = next;
		offcanvas().hide();
	}

	function onPanelClick(event) {
		const post = findPost(view.openId);
		if (!post) return;
		const target = event.target;

		const actionButton = target.closest('[data-ann-act]');
		if (actionButton) {
			/* A menu item shuts its menu, then focus goes back to the toggle. */
			const fromMenu = !!actionButton.closest('.dropdown-menu');
			const toggle = fromMenu ? pick('[data-k="more"]', panel.foot) : null;
			if (toggle) bootstrap.Dropdown.getOrCreateInstance(toggle).hide();
			doAction(actionButton.dataset.annAct, post, actionButton);
			const focusLost =
				!drawer.contains(document.activeElement) || !!document.activeElement.closest('.dropdown-menu');
			if (toggle && panelShowing() && focusLost) pick('[data-k="more"]', panel.foot)?.focus();
			return;
		}

		const reaction = target.closest('[data-ann-react]');
		if (reaction) {
			flipReaction(post, reaction.dataset.annReact);
			return;
		}
		if (target.closest('[data-ann-toggle-comments]')) {
			window.Basalt.slide(pick('[data-ann-comments]', panel.body), () => {
				view.commentsShown = !view.commentsShown;
				repaintComments(post);
			});
			if (view.commentsShown && !post.discussion.length) focusCommentBox();
			return;
		}
		if (target.closest('[data-ann-back]')) {
			view.panelMode = 'post';
			paintPanel();
			panel.title.focus();
			return;
		}
		const replyButton = target.closest('[data-ann-reply]');
		if (replyButton || target.closest('[data-ann-reply-cancel]')) {
			view.replyingTo = replyButton ? replyButton.dataset.annReply : null;
			repaintComments(post);
			focusCommentBox();
			return;
		}
		const removeButton = target.closest('[data-ann-cdel]');
		if (removeButton) removeComment(post, removeButton.dataset.annCdel);
	}

	function paintPanel() {
		const post = findPost(view.openId);
		if (!post) return;
		holdFocus(() => {
			retireTooltips(drawer);
			panel.title.textContent = post.title;
			panel.byline.textContent = panelByline(post);
			panel.fullLink.href = `announcement-details.html?id=${encodeURIComponent(post.id)}`;
			panel.body.innerHTML =
				view.panelMode === 'preview' && isCustomerPost(post) ? previewPane(post) : postPane(post);
			panel.foot.innerHTML = panelFooter(post);
			enhance(drawer);
		});
	}

	/** Redraws only the read figures and the footer, for live changes. */
	function paintReads(post) {
		if (!post || post.id !== view.openId || view.panelMode !== 'post') return;
		const box = pick('[data-ann-reads]', panel.body);
		if (!box) return;
		holdFocus(() => {
			box.innerHTML = readsSection(post);
			const reminding = pick('[data-ann-act="remind"][aria-busy="true"]', panel.foot);
			if (!reminding) panel.foot.innerHTML = panelFooter(post);
			enhance(box);
			enhance(panel.foot);
		});
	}

	function repaintComments(post) {
		repaintSlot('[data-ann-comments]', commentsSection(post));
	}

	function repaintSlot(selector, markup) {
		const slot = pick(selector, panel.body);
		if (!slot) return;
		holdFocus(() => {
			retireTooltips(slot);
			slot.innerHTML = markup;
			enhance(slot);
		});
	}

	/** Runs a redraw of panel content and puts focus back on the control
      that had it, matched by data-k, caret included for the comment box. */
	function holdFocus(redraw) {
		const active = document.activeElement;
		const key = active && drawer.contains(active) ? active.getAttribute('data-k') : null;
		const caret = key === 'reply-text' ? [active.selectionStart, active.selectionEnd] : null;
		redraw();
		if (!key) return;
		const again = pick(`[data-k="${key}"]`, drawer);
		if (!again) {
			panel.title.focus({ preventScroll: true });
			return;
		}
		again.focus({ preventScroll: true });
		if (caret) again.setSelectionRange(caret[0], caret[1]);
	}

	/* A tooltip that is still showing or fading is only asked to hide;
     disposing it mid-fade makes Bootstrap's own callback throw. */
	function retireTooltips(scope) {
		if (!window.bootstrap) return;
		for (const trigger of pickAll('[data-bs-toggle="tooltip"]', scope)) {
			const tooltip = bootstrap.Tooltip.getInstance(trigger);
			if (!tooltip) continue;
			if (!tooltip.tip) {
				tooltip.dispose();
				continue;
			}
			if (tooltip.tip.classList.contains('show')) tooltip.hide();
		}
	}

	/** Lets basalt.js dress new markup: avatars, loading buttons, tips, menus. */
	function enhance(scope) {
		window.Basalt.avatars?.(scope);
		window.Basalt.buttons?.(scope);
		window.Basalt.tips?.(scope);
		window.Basalt.menus?.(scope);
	}

	function offcanvas() {
		return bootstrap.Offcanvas.getOrCreateInstance(drawer);
	}

	function panelShowing() {
		return drawer.classList.contains('show') || drawer.classList.contains('showing');
	}

	function panelByline(post) {
		const name = personFor(post.writer).name;
		const prefix = { scheduled: 'Goes out', draft: 'Edited' }[post.status];
		return prefix
			? `${name} · ${prefix} ${lowerRelative(longWhen(post.dated))}`
			: `${name} · ${longWhen(post.dated)}`;
	}

	/* The panel's post view is built from the parts below, in order. */

	function postPane(post) {
		const readsHeading = notSentYet(post)
			? 'Not sent yet'
			: post.status === 'archived'
				? 'Before it was archived'
				: 'Who has read it';
		const pinnedFact =
			post.pinned && post.status === 'live'
				? `<span class="ann-aud">${icon('bi-pin-angle-fill ann-pin')}Pinned</span>`
				: '';
		return [
			`<div class="ann-d-facts">${stateBadge(post)}<span class="ann-aud">${icon(audienceIcon(post.audience))}${htmlSafe(audienceLong(post.audience))}</span>${pinnedFact}</div>`,
			confirmAsk(post),
			`<div class="ann-prose">${renderMessage(post.body)}</div>`,
			`<div data-ann-reactions>${reactionRow(post)}</div>`,
			`<section aria-labelledby="ann-reads-title" class="ann-d-section"><h3 id="ann-reads-title" class="ann-d-h">${readsHeading}</h3><div data-ann-reads>${readsSection(post)}</div></section>`,
			`<section aria-labelledby="ann-comments-title" class="ann-d-section"><h3 id="ann-comments-title" class="ann-d-h">Comments</h3><div data-ann-comments>${commentsSection(post)}</div></section>`,
		].join('');
	}

	/* The confirm ask shows only to someone in the audience who still owes it. */
	function confirmAsk(post) {
		if (!post.askConfirm || post.status !== 'live' || !includesMe(post)) return '';
		const owes = post.unconfirmed.has(feed.viewer) || post.unread.has(feed.viewer);
		if (!owes) return '';
		return `<div aria-label="Confirm you have read this" role="group" class="ann-ack">${icon('bi-patch-exclamation')}<p class="ann-ack-text">${htmlSafe(personFor(post.writer).name)} asked everyone to confirm.</p><button data-ann-act="ack" data-k="ack" class="btn btn-sm btn-outline-primary" type="button">I have read this</button></div>`;
	}

	function reactionRow(post) {
		if (post.status !== 'live') return '';
		const buttons = REACTION_KINDS.map((kind) => {
			const chosen = post.myReactions.has(kind.key);
			const count = post.tally[kind.key];
			return `<button data-ann-react="${kind.key}" data-k="react-${kind.key}" aria-pressed="${chosen}" aria-label="${kind.name}, ${countOf(count, 'reaction')}" data-bs-title="${kind.name}" data-bs-toggle="tooltip" class="ann-react" type="button">${icon(chosen ? kind.chosen : kind.idle)}<span>${formatCount(count)}</span></button>`;
		});
		return `<div aria-label="Reactions" role="group" class="ann-reactions">${buttons.join('')}</div>`;
	}

	/** One bar for the read share, with the confirmed share drawn inside. */
	function shareBar(readShare, confirmedShare) {
		const inner =
			confirmedShare == null ? '' : `<span style="width:${confirmedShare}%" class="ann-bar-ack"></span>`;
		return `<div aria-hidden="true" class="ann-bar"><span style="width:${readShare}%" class="ann-bar-read"></span>${inner}</div>`;
	}

	function readsSection(post) {
		if (notSentYet(post)) {
			const channels = post.byEmail ? ', in the app and by email.' : ', in the app.';
			return `<p class="ann-d-line">Reaches ${htmlSafe(reachLine(post.audience))}${channels}</p>`;
		}
		return isCustomerPost(post) ? customerReads(post) : staffReads(post);
	}

	function staffReads(post) {
		const numbers = readFigures(post);
		const confirmedPart = post.askConfirm
			? `<span aria-hidden="true" class="ann-d-sep">·</span><span aria-hidden="true" class="ann-key ann-key-ack"></span>Confirmed <strong>${numbers.confirmed} of ${numbers.total}</strong>`
			: '';
		const parts = [
			`<p class="ann-d-line"><span aria-hidden="true" class="ann-key ann-key-read"></span>Read <strong>${numbers.read} of ${numbers.total}</strong>${confirmedPart}</p>`,
			shareBar(
				percentOf(numbers.read, numbers.total),
				post.askConfirm ? percentOf(numbers.confirmed, numbers.total) : null,
			),
		];

		/* The team that trails the most, in one quiet sentence. */
		const byTeam = [];
		for (const team of feed.teams) {
			const members = numbers.members.filter((member) => member.team === team);
			if (members.length)
				byTeam.push({
					team,
					read: members.filter((member) => !post.unread.has(member.id)).length,
					size: members.length,
				});
		}
		const trailing = byTeam
			.filter((row) => row.read < row.size)
			.sort((a, b) => a.read / a.size - b.read / b.size)[0];
		if (byTeam.length > 1 && trailing)
			parts.push(
				`<p class="ann-d-note">${htmlSafe(trailing.team)} is furthest behind, with ${trailing.read} of ${trailing.size} read.</p>`,
			);
		if (post.status !== 'live') return parts.join('');

		const owing = stillOwing(post);
		parts.push('<p class="ann-d-label">Still waiting on</p>');
		if (!owing.length) {
			parts.push(
				`<p class="ann-d-note">${icon('bi-check2-all me-1')}Nobody. ${post.askConfirm ? 'Everyone has confirmed.' : 'Everyone has read it.'}</p>`,
			);
			return parts.join('');
		}
		const firstFew = owing.slice(0, 3).map((id) => {
			const member = personFor(id);
			const name = id === feed.viewer ? `${member.name} (you)` : member.name;
			return `<li>${avatarFor(id)}<span class="ann-people-who"><span class="ann-people-name">${htmlSafe(name)}</span><span class="ann-people-meta">${htmlSafe(member.team)}</span></span></li>`;
		});
		parts.push(`<ul class="ann-people">${firstFew.join('')}</ul>`);
		if (owing.length > 3) parts.push(`<p class="ann-d-note">and ${owing.length - 3} more</p>`);
		parts.push(lastNudgeNote(post));
		return parts.join('');
	}

	function customerReads(post) {
		const numbers = readFigures(post);
		const confirmedPart = post.askConfirm
			? `<span aria-hidden="true" class="ann-d-sep">·</span><span aria-hidden="true" class="ann-key ann-key-ack"></span>Confirmed by <strong>${percentOf(numbers.confirmed, numbers.accounts)}%</strong> of accounts`
			: '';
		const parts = [
			`<p class="ann-d-line"><span aria-hidden="true" class="ann-key ann-key-read"></span>Opened by <strong>${percentOf(numbers.read, numbers.total)}%</strong> of ${formatCount(numbers.total)} people${confirmedPart}</p>`,
			shareBar(
				percentOf(numbers.read, numbers.total),
				post.askConfirm ? percentOf(numbers.confirmed, numbers.accounts) : null,
			),
		];
		if (post.status !== 'live') return parts.join('');

		parts.push('<p class="ann-d-label">Furthest behind</p>');
		if (!post.behind.length) {
			parts.push('<p class="ann-d-note">No accounts stand out yet.</p>');
			return parts.join('');
		}
		const firstFew = post.behind
			.slice(0, 3)
			.map(
				(account) =>
					`<li><span data-basalt-avatar data-name="${htmlSafe(account.name)}" aria-hidden="true" class="basalt-avatar basalt-avatar-sm basalt-avatar-rounded"></span><span class="ann-people-who"><span class="ann-people-name">${htmlSafe(account.name)}</span><span class="ann-people-meta">${account.opened} of ${account.of} opened</span></span></li>`,
			);
		parts.push(`<ul class="ann-people">${firstFew.join('')}</ul>`);
		if (post.behind.length > 3)
			parts.push(
				`<p class="ann-d-note">and ${countOf(post.behind.length - 3, 'more account', 'more accounts')}</p>`,
			);
		parts.push(lastNudgeNote(post));
		return parts.join('');
	}

	function lastNudgeNote(post) {
		return post.nudgedAt
			? `<p class="ann-d-note">Last reminder sent ${htmlSafe(lowerRelative(longWhen(post.nudgedAt)))}.</p>`
			: '';
	}

	function avatarFor(id) {
		return `<span data-basalt-avatar data-name="${htmlSafe(personFor(id).name)}" aria-hidden="true" class="basalt-avatar basalt-avatar-sm"></span>`;
	}

	/* Comments stay folded until someone asks to see them. */

	function commentsSection(post) {
		const total = post.discussion.length;
		if (!post.commentsOn && !total) return '<p class="ann-d-note">Comments are off for this post.</p>';
		const teamOnly = isCustomerPost(post) ? ' Only the team sees these.' : '';

		if (!view.commentsShown) {
			const lead = total ? `${countOf(total, 'comment')} from the team.` : 'No comments yet.';
			return `<p class="ann-d-line">${lead}${htmlSafe(teamOnly)} <button data-ann-toggle-comments data-k="comments" aria-expanded="false" class="btn btn-link ann-link" type="button">${total ? 'Show them' : 'Write one'}</button></p>`;
		}
		const lead = total ? `${countOf(total, 'comment')}.` : 'No comments yet.';
		const thread = total
			? `<ol class="ann-comments">${post.discussion.map((comment) => commentItem(post, comment)).join('')}</ol>`
			: '';
		return `<p class="ann-d-line">${lead}${htmlSafe(teamOnly)} <button data-ann-toggle-comments data-k="comments" aria-expanded="true" class="btn btn-link ann-link" type="button">Hide</button></p>${thread}${commentBox(post)}`;
	}

	function commentItem(post, comment) {
		const mine = comment.author === feed.viewer;
		const parent = comment.parentId ? post.discussion.find((other) => other.id === comment.parentId) : null;
		const replyLine = parent
			? `<p class="ann-comment-re">${icon('bi-reply')}Replying to ${htmlSafe(parent.author === feed.viewer ? 'you' : personFor(parent.author).name)}</p>`
			: '';
		const replyButton = post.commentsOn
			? `<button data-ann-reply="${htmlSafe(comment.id)}" data-k="reply-${htmlSafe(comment.id)}" class="btn btn-link btn-sm ann-link" type="button">Reply</button>`
			: '';
		const deleteButton = mine
			? `<button data-ann-cdel="${htmlSafe(comment.id)}" data-k="cdel-${htmlSafe(comment.id)}" class="btn btn-link btn-sm ann-link" type="button">Delete</button>`
			: '';
		const head = `<p class="ann-comment-head"><span class="ann-comment-name">${htmlSafe(mine ? 'You' : personFor(comment.author).name)}</span><time datetime="${comment.posted.toISOString()}">${htmlSafe(longWhen(comment.posted))}</time></p>`;
		return `<li class="ann-comment${comment.fresh ? ' is-new' : ''}">${avatarFor(comment.author)}<div class="ann-comment-body">${head}${replyLine}<p class="ann-comment-text">${htmlSafe(comment.text)}</p><div class="ann-comment-actions">${replyButton}${deleteButton}</div></div></li>`;
	}

	function commentBox(post) {
		if (!post.commentsOn) return '';
		const parent = view.replyingTo && post.discussion.find((comment) => comment.id === view.replyingTo);
		const replyNote = parent
			? `<p class="ann-reply-to">${icon('bi-reply')}Replying to ${htmlSafe(parent.author === feed.viewer ? 'yourself' : personFor(parent.author).name)}<button data-ann-reply-cancel data-k="reply-cancel" class="btn btn-link btn-sm ann-link" type="button">Cancel</button></p>`
			: '';
		return [
			`<form data-ann-reply-form novalidate class="ann-reply">${replyNote}`,
			'<label for="ann-reply-text" class="visually-hidden">Write a comment</label>',
			`<textarea id="ann-reply-text" data-ann-reply-text data-k="reply-text" placeholder="Write a comment" rows="2" class="form-control">${htmlSafe(view.unsent[post.id] || '')}</textarea>`,
			'<div class="ann-reply-foot"><span class="ann-reply-hint"><kbd>Ctrl</kbd> <kbd>Enter</kbd> sends</span><button data-k="reply-send" class="btn btn-sm btn-outline-primary" type="submit">Comment</button></div>',
			'</form>',
		].join('');
	}

	/* Customers get a preview of the post in the app, the browser or email. */

	function previewPane(post) {
		const modes = [
			['mobile', 'Mobile app'],
			['web', 'Web app'],
			['email', 'Email'],
		];
		const options = modes.map(([mode, label]) => {
			const checked = view.previewIn === mode ? ' checked' : '';
			return `<input id="ann-view-${mode}" name="annView" value="${mode}" data-ann-view data-k="view-${mode}" class="btn-check" type="radio"${checked}><label for="ann-view-${mode}" class="basalt-segmented-option">${label}</label>`;
		});
		return [
			`<button data-ann-back data-k="back" class="btn btn-link ann-link ann-back" type="button">${icon('bi-arrow-left me-1')}Back to the post</button>`,
			'<h3 class="ann-d-h">What customers see</h3>',
			`<p class="ann-d-note ann-d-note-lead">${htmlSafe(audienceLong(post.audience))}, ${htmlSafe(reachLine(post.audience))}.</p>`,
			`<div data-basalt-segmented aria-label="Show it in" role="radiogroup" class="basalt-segmented basalt-segmented-sm basalt-segmented-block ann-views">${options.join('')}</div>`,
			`<div data-ann-preview>${mockup(post, view.previewIn)}</div>`,
		].join('');
	}

	/** The post as it lands in the mobile app, the web app or an inbox. */
	function mockup(post, mode) {
		const confirmChip = post.askConfirm ? '<span class="ann-mock-btn">I have read this</span>' : '';
		const card = `<div class="ann-mock-card"><p class="ann-mock-title">${htmlSafe(post.title)}</p><div class="ann-prose ann-prose-mock">${renderMessage(post.body)}</div>${confirmChip}</div>`;
		const builders = {
			mobile: () => [
				'<div aria-label="The post in the Fieldline mobile app" role="img" class="ann-phone">',
				'<div class="ann-phone-bar"><span>9:41</span><span><i class="bi bi-reception-4"></i> <i class="bi bi-battery-full"></i></span></div>',
				'<div class="ann-phone-app"><span class="ann-phone-brand"><i class="bi bi-geo-alt-fill"></i>Fieldline</span><i class="bi bi-bell-fill"></i></div>',
				`<div class="ann-phone-screen">${card}<div class="ann-mock-job"><i class="bi bi-calendar-check"></i><span>Next visit: deep clean, 11:30 am</span></div></div>`,
				'</div>',
			],
			web: () => [
				'<div aria-label="The post in the Fieldline web app" role="img" class="ann-web">',
				'<div class="ann-web-top"><span class="ann-web-dots"><i></i><i></i><i></i></span><span class="ann-web-url">app.fieldline.app/schedule</span></div>',
				'<div class="ann-web-body"><div class="ann-web-nav"><span class="ann-web-logo"><i class="bi bi-geo-alt-fill"></i></span><i class="bi bi-calendar3"></i><i class="bi bi-map"></i><i class="bi bi-people"></i></div>',
				'<div class="ann-web-main"><div class="ann-web-head"><span>Schedule board</span><span class="ann-web-bell"><i class="bi bi-bell"></i><b>1</b></span></div><div class="ann-web-rows"><i></i><i></i><i></i><i></i></div>',
				`<div class="ann-web-panel">${card}</div></div></div></div>`,
			],
			email: () => emailMockup(post),
		};
		return (builders[mode] || builders.email)().join('');
	}

	function emailMockup(post) {
		const regions = post.audience.regions;
		const onlyRegion = regions.length === 1 ? regions[0] : '';
		const sampleAccount =
			{ Midwest: 'Brightline Photography', South: 'Solaris Photography' }[onlyRegion] || 'Northgate Analytics';
		const company = htmlSafe(feed.company);
		return [
			'<div class="ann-mail"><dl class="ann-mail-head">',
			`<div><dt>From</dt><dd>${htmlSafe(personFor(post.writer).name)} at ${company}</dd></div>`,
			`<div><dt>To</dt><dd>Office admin, ${htmlSafe(sampleAccount)}</dd></div>`,
			`<div><dt>Subject</dt><dd><strong>${htmlSafe(post.title)}</strong></dd></div></dl>`,
			`<div class="ann-mail-body"><p class="ann-mail-brand">${icon('bi-geo-alt-fill')}${company}</p><div class="ann-prose ann-prose-mock">${renderMessage(post.body)}</div>`,
			post.askConfirm ? '<p><span class="ann-mock-btn">Confirm you have read this</span></p>' : '',
			'</div>',
			post.byEmail
				? ''
				: `<p class="ann-mail-off">${icon('bi-info-circle')}This post is not set to go by email.</p>`,
			'</div>',
		];
	}

	/* The panel footer holds a menu, Edit, and one main action. */

	function panelFooter(post) {
		const live = post.status === 'live';
		const entries = [];
		if (live)
			entries.push(
				menuEntry(
					'pin',
					post.pinned ? 'bi-pin-angle-fill' : 'bi-pin-angle',
					post.pinned ? 'Unpin' : 'Pin to the top',
				),
			);
		entries.push(menuEntry('copy', 'bi-link-45deg', 'Copy link'));
		if (isCustomerPost(post)) entries.push(menuEntry('preview', 'bi-eye', 'See it as customers do'));
		entries.push(menuEntry('duplicate', 'bi-copy', 'Duplicate as a draft'));
		if (live) entries.push(menuEntry('archive', 'bi-archive', 'Archive'));
		entries.push('<li><hr class="dropdown-divider"></li>');
		entries.push(menuEntry('delete', 'bi-trash3', 'Delete…', 'ann-danger-item'));
		const menu = `<div class="dropup ann-d-menu"><button data-k="more" aria-label="More for this post" aria-expanded="false" data-bs-toggle="dropdown" class="btn btn-outline-secondary ann-d-more" type="button">${icon('bi-three-dots')}</button><ul class="dropdown-menu">${entries.join('')}</ul></div>`;
		return menu + mainActions(post);
	}

	function mainActions(post) {
		if (post.status === 'archived') {
			return `<button data-ann-act="restore" data-k="restore" class="btn btn-primary" type="button">${icon('bi-arrow-counterclockwise me-1')}Put back</button>`;
		}
		if (post.status !== 'live') {
			const editLabel = post.status === 'scheduled' ? 'Change' : 'Edit';
			return `<button data-ann-act="edit" data-k="edit" class="btn btn-outline-secondary" type="button">${editLabel}</button><button data-ann-act="publish" data-k="publish" class="btn btn-primary" type="button">${icon('bi-send me-1')}Publish now</button>`;
		}
		const owing = stillOwing(post).length;
		const nouns = isCustomerPost(post) ? ['account', 'accounts'] : ['person', 'people'];
		return `<button data-ann-act="edit" data-k="edit" class="btn btn-outline-secondary" type="button">Edit</button>${owing ? reminderButton(owing, nouns) : ''}`;
	}

	function menuEntry(action, glyph, label, extraClass) {
		const cls = extraClass ? `dropdown-item ${extraClass}` : 'dropdown-item';
		return `<li><button data-ann-act="${action}" class="${cls}" type="button">${icon(glyph)}${label}</button></li>`;
	}

	function reminderButton(count, [one, many]) {
		const states = [
			['btn-loading-idle', `${icon('bi-bell')}Remind ${countOf(count, one, many)}`],
			['btn-loading-busy', '<span aria-hidden="true" class="spinner-border spinner-border-sm"></span>Sending'],
			['btn-loading-done', `${icon('bi-check2')}Reminder sent`],
			['btn-loading-fail', `${icon('bi-exclamation-circle')}Not sent`],
		];
		return `<button data-ann-act="remind" data-k="remind" class="btn btn-primary btn-loading" type="button">${states.map(([cls, inner]) => `<span class="btn-loading-state ${cls}">${inner}</span>`).join('')}</button>`;
	}

	/* Every action below changes the page at once, then calls the server,
     and puts things back with an error toast if that call fails. */

	function doAction(action, post, button) {
		const handlers = {
			pin: () => flipPin(post),
			edit: () => leavePanelFor(post, () => openComposer(post)),
			duplicate: () => leavePanelFor(post, () => openComposer(post, { duplicate: true })),
			archive: () => archivePost(post),
			restore: () => restorePost(post),
			delete: () => leavePanelFor(post, () => askToDelete(post)),
			preview: () => {
				view.panelMode = 'preview';
				view.previewIn = post.audience.roles.includes('office') ? 'web' : 'mobile';
				paintPanel();
				panel.title.focus();
			},
			copy: () => copyPostLink(post),
			ack: () => confirmReading(post),
			publish: () => publishPost(post),
			remind: () => sendReminder(post, button),
		};
		handlers[action]?.();
	}

	/* Dialogs opened from the panel bring the same post back when they close. */
	function leavePanelFor(post, openDialog) {
		view.returnTo = post.id;
		afterPanelCloses(openDialog);
	}

	/** Builds the catch handler: undo the change, redraw, explain. */
	function rollback(what, undo) {
		return () => {
			undo?.();
			repaint();
			if (panelShowing()) paintPanel();
			notify({
				tone: 'danger',
				title: `Could not ${what}`,
				text: 'Nothing was changed. Check your connection and try again.',
			});
		};
	}

	function copyPostLink(post) {
		const address = `${location.href.split('#')[0]}#${post.id}`;
		if (!window.Basalt.copyText) return;
		window.Basalt.copyText(address).then(
			() => {
				notify({ tone: 'success', icon: 'bi-link-45deg', title: 'Link copied', text: post.title });
				say('Link copied');
			},
			() => notify({ tone: 'danger', title: 'Could not copy the link', text: address }),
		);
	}

	function flipPin(post) {
		if (post.status !== 'live') return;
		const pinned = !post.pinned;
		post.pinned = pinned;
		server.setPinned(post.id, pinned).catch(
			rollback(pinned ? 'pin the post' : 'unpin the post', () => {
				post.pinned = !pinned;
			}),
		);
		repaint();
		paintPanel();
		say(pinned ? 'Pinned to the top' : 'Unpinned');
	}

	function archivePost(post) {
		if (post.status === 'archived') return;
		const previous = post.status;
		const bringBack = () => {
			post.status = previous;
		};
		post.status = 'archived';
		post.priorStatus = previous;
		server.archive(post.id).catch(rollback('archive the post', bringBack));
		if (panelShowing()) offcanvas().hide();
		repaint();
		notify({
			tone: 'primary',
			icon: 'bi-archive',
			title: 'Archived',
			text: post.title,
			actions: [
				{
					label: 'Undo',
					onClick() {
						bringBack();
						server.unarchive(post.id).catch(
							rollback('put the post back', () => {
								post.status = 'archived';
							}),
						);
						repaint();
						say('Put back');
					},
				},
			],
		});
		say(`Archived ${post.title}`);
	}

	function restorePost(post) {
		const target = post.priorStatus && post.priorStatus !== 'archived' ? post.priorStatus : 'live';
		post.status = target;
		server.unarchive(post.id).catch(
			rollback('put the post back', () => {
				post.status = 'archived';
			}),
		);
		repaint();
		paintPanel();
		notify({
			tone: 'success',
			icon: 'bi-arrow-counterclockwise',
			title: 'Put back',
			text: `${post.title} is ${STATUS_LOOK[target].text.toLowerCase()} again.`,
		});
	}

	function flipReaction(post, key) {
		const adding = !post.myReactions.has(key);
		const applyReaction = (add) => {
			if (add) {
				post.myReactions.add(key);
				post.tally[key] += 1;
				return;
			}
			post.myReactions.delete(key);
			post.tally[key] = Math.max(0, post.tally[key] - 1);
		};
		applyReaction(adding);
		server.setReaction(post.id, key, adding).catch(() => {
			applyReaction(!adding);
			repaintSlot('[data-ann-reactions]', reactionRow(post));
			notify({ tone: 'danger', title: 'Could not save your reaction', text: 'Try again in a moment.' });
		});
		repaintSlot('[data-ann-reactions]', reactionRow(post));
	}

	function confirmReading(post) {
		const hadNotOpened = post.unread.has(feed.viewer);
		post.unread.delete(feed.viewer);
		post.unconfirmed.delete(feed.viewer);
		server.confirmRead(post.id).catch(
			rollback('save your confirmation', () => {
				post.unconfirmed.add(feed.viewer);
				if (hadNotOpened) post.unread.add(feed.viewer);
			}),
		);
		repaint();
		paintPanel();
		panel.title.focus({ preventScroll: true });
		say(`Thanks. You confirmed you have read ${post.title}`);
	}

	function sendReminder(post, button) {
		const recipientsList = stillOwing(post);
		const setButton = (stateName) => window.Basalt.buttonState?.(button, stateName);
		setButton('loading');
		server
			.nudge(post.id, recipientsList)
			.then(() => {
				setButton('success');
				post.nudgedAt = currentTime();
				const text = isCustomerPost(post)
					? `Emailed the admins at ${countOf(recipientsList.length, 'account')}.`
					: `Sent to ${countOf(recipientsList.length, 'person', 'people')} in the app and by email.`;
				notify({ tone: 'success', icon: 'bi-bell', title: 'Reminder sent', text });
				setTimeout(() => {
					if (button.isConnected) setButton('idle');
					paintReads(post);
				}, 1400);
			})
			.catch(() => {
				setButton('error');
				notify({
					tone: 'danger',
					title: 'The reminder was not sent',
					text: 'Nobody was notified. Try again in a moment.',
				});
				setTimeout(() => {
					if (button.isConnected) setButton('idle');
				}, 2200);
			});
	}

	function publishPost(post) {
		const previous = { status: post.status, dated: post.dated };
		post.status = 'live';
		post.dated = currentTime();
		startFresh(post);
		server.publish(post.id).catch(
			rollback('publish the post', () => {
				post.status = previous.status;
				post.dated = previous.dated;
			}),
		);
		if (view.statusFilter !== 'all' && view.statusFilter !== 'live') {
			view.statusFilter = 'live';
			chooseOption(list.statusSelect, 'live');
		}
		repaint();
		paintPanel();
		notify({
			tone: 'success',
			icon: 'bi-send-check',
			title: 'Published',
			text: `Sent to ${reachLine(post.audience)}.`,
		});
		say(`Published ${post.title}`);
		startFilling();
	}

	/* A post that has only just gone out: nobody but the author has seen it. */
	function startFresh(post) {
		if (post.audience.kind === 'staff') {
			post.unread = new Set(
				audienceOf(post)
					.map((member) => member.id)
					.filter((id) => id !== post.writer),
			);
			post.unconfirmed = new Set();
		} else {
			post.openedShare = 0;
			post.confirmedShare = 0;
			post.behind = [];
		}
		post.tally = { up: 0, heart: 0, party: 0 };
		post.myReactions = new Set();
		post.sentMs = Date.now();
	}

	/* Writing, replying to and removing comments. */

	function focusCommentBox() {
		const box = pick('[data-ann-reply-text]', panel.body);
		if (!box) return;
		box.focus();
		box.setSelectionRange(box.value.length, box.value.length);
	}

	function postComment(post) {
		const box = pick('[data-ann-reply-text]', panel.body);
		if (!post || !box) return;
		const text = box.value.trim();
		if (!text) {
			box.classList.add('is-invalid');
			box.setAttribute('aria-invalid', 'true');
			say('Write something first');
			box.focus();
			return;
		}
		commentCount += 1;
		const comment = {
			id: `n${commentCount}`,
			author: feed.viewer,
			posted: currentTime(),
			text,
			parentId: view.replyingTo,
			fresh: true,
		};
		post.discussion.push(comment);
		view.unsent[post.id] = '';
		view.replyingTo = null;
		repaintComments(post);
		focusCommentBox();
		say('Comment posted');
		server.postComment(post.id, { text, parentId: comment.parentId }).catch(() => {
			post.discussion = post.discussion.filter((other) => other !== comment);
			view.unsent[post.id] = text;
			if (post.id === view.openId) repaintComments(post);
			notify({
				tone: 'danger',
				title: 'Your comment was not posted',
				text: 'It is back in the box so you can send it again.',
			});
		});
		settleFreshComments(post);
	}

	/* The highlight plays once; later redraws show the comment plainly. */
	function settleFreshComments(post) {
		for (const comment of post.discussion) delete comment.fresh;
	}

	function removeComment(post, commentId) {
		const position = post.discussion.findIndex((comment) => comment.id === commentId);
		if (position < 0) return;
		const [removed] = post.discussion.splice(position, 1);
		const putBack = () => post.discussion.splice(Math.min(position, post.discussion.length), 0, removed);
		repaintComments(post);
		focusCommentBox();
		server.dropComment(post.id, commentId).catch(() => {
			putBack();
			if (post.id === view.openId) repaintComments(post);
			notify({
				tone: 'danger',
				title: 'Could not delete the comment',
				text: 'It is still there. Try again in a moment.',
			});
		});
		const preview = removed.text.length > 60 ? `${removed.text.slice(0, 57)}…` : removed.text;
		notify({
			tone: 'primary',
			icon: 'bi-trash3',
			title: 'Comment removed',
			text: preview,
			actions: [
				{
					label: 'Undo',
					onClick() {
						putBack();
						server.postComment(post.id, { text: removed.text, parentId: removed.parentId });
						if (post.id === view.openId) repaintComments(post);
						say('Comment put back');
					},
				},
			],
		});
	}

	/* Deleting happens in its own dialog, behind a held press. */

	function bindDeleteDialog() {
		deleteDialog.addEventListener('shown.bs.modal', () => holdToDelete.focus());
		holdToDelete.addEventListener('basalt:confirm', onDeleteConfirmed);
		deleteDialog.addEventListener('hidden.bs.modal', () => {
			const backTo = view.returnTo;
			view.returnTo = null;
			pendingDeleteId = null;
			if (!deleteWentThrough && backTo && findPost(backTo)) {
				showPost(backTo);
				return;
			}
			view.openId = null;
			paintList();
			list.search.focus();
		});
	}

	function askToDelete(post) {
		pendingDeleteId = post.id;
		deleteWentThrough = false;
		pick('[data-ann-delete-text]').textContent =
			`“${post.title}” disappears from every feed, with its ${countOf(post.discussion.length, 'comment')} and its read history. This cannot be undone.`;
		openDialog('#ann-delete');
	}

	function onDeleteConfirmed() {
		const post = findPost(pendingDeleteId);
		if (!post) return;
		const position = view.posts.indexOf(post);
		view.posts.splice(position, 1);
		deleteWentThrough = true;
		server.destroy(post.id).catch(
			rollback('delete the post', () => {
				view.posts.splice(position, 0, post);
			}),
		);
		setTimeout(() => {
			closeDialog('#ann-delete');
			repaint();
			notify({ tone: 'success', icon: 'bi-trash3', title: 'Post deleted', text: post.title });
			say(`Deleted ${post.title}`);
		}, 450);
	}

	/* One composer serves new posts, edits and duplicates. */

	function bindComposer() {
		composerDialog.addEventListener('shown.bs.modal', () => {
			field('title').focus();
			for (const segmented of pickAll('[data-basalt-segmented]', composer))
				segmented.dispatchEvent(new Event('change'));
		});
		/* Closing goes back to the post it came from, or to the one just saved. */
		composerDialog.addEventListener('hidden.bs.modal', () => {
			const backTo = justSavedId || view.returnTo;
			view.returnTo = null;
			justSavedId = null;
			if (backTo && findPost(backTo)) showPost(backTo);
			else pick('[data-ann-compose]').focus();
		});
		composer.addEventListener('input', syncComposer);
		composer.addEventListener('change', syncComposer);
		composer.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
			event.preventDefault();
			composer.requestSubmit();
		});
		pick('.ann-editor-bar', composer).addEventListener('click', onFormatClick);
		composer.addEventListener('submit', onComposerSubmit);
	}

	function field(name) {
		return pick(`[data-ann-f="${name}"]`, composer);
	}

	/** Fills the composer for a new post, an edit or a duplicate, and opens it. */
	function openComposer(post, { duplicate = false } = {}) {
		if (!feed) return;
		const editing = post && !duplicate ? post : null;
		if (!post) view.returnTo = null;
		view.editingId = editing ? editing.id : null;
		justSavedId = null;
		composer.classList.remove('was-validated');
		for (const flagged of pickAll('.is-invalid', composer)) flagged.classList.remove('is-invalid');
		pick('[data-ann-aud-error]', composer).classList.remove('d-block');
		pick('#ann-date-error').classList.remove('d-block');
		fillPickers();

		field('title').value = post ? post.title : '';
		field('body').value = post ? post.body : '';
		const audience = post ? post.audience : { kind: 'staff', teams: [] };
		if (audience.kind === 'customers') {
			checkRadio('annAud', 'customers');
			tickValues('role', audience.roles);
			tickValues('plan', audience.plans);
			tickValues('region', audience.regions);
		} else {
			checkRadio('annAud', audience.teams && audience.teams.length ? 'teams' : 'all');
			tickValues('team', audience.teams || []);
		}

		const keepTime = post && post.status === 'scheduled' && !duplicate;
		const sendAt = keepTime ? post.dated : comingMondayMorning();
		field('date').value = dateValue(sendAt);
		field('time').value = timeValue(sendAt);
		field('date').min = dateValue(currentTime());
		checkRadio('annWhen', startingWhen(editing, duplicate));

		field('ack').checked = !!(post && post.askConfirm);
		field('pinned').checked = !!(post && post.pinned && !duplicate);
		field('comments').checked = post ? post.commentsOn !== false : true;
		field('email').checked = !!(post && post.byEmail);
		pick('[data-ann-when-field]', composer).hidden = editingSentPost();
		pick('[data-ann-form-title]', composer).textContent = editing
			? 'Edit announcement'
			: duplicate
				? 'Duplicate as a draft'
				: 'New announcement';
		window.Basalt.buttonState?.(composerSubmit, 'idle');
		syncComposer();
		openDialog('#ann-compose');
	}

	function startingWhen(editing, duplicate) {
		if (duplicate) return 'draft';
		if (!editing) return 'now';
		return { scheduled: 'later', draft: 'draft' }[editing.status] || 'now';
	}

	/* New posts default to 9 am on the next Monday. */
	function comingMondayMorning() {
		const monday = new Date(currentTime());
		monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7));
		monday.setHours(9, 0, 0, 0);
		return monday;
	}

	/* Rebuilds the four pick lists from the feed, keeping their legends. */
	function fillPickers() {
		const base = feed.customerBase;
		const refill = (hook, options) => {
			const fieldset = pick(hook, composer);
			for (const old of pickAll('.ann-pick', fieldset)) old.remove();
			fieldset.insertAdjacentHTML('beforeend', options.join(''));
		};
		refill(
			'[data-ann-teams]',
			feed.teams.map((team) =>
				pickOption(
					'team',
					team,
					team,
					`${audienceOf({ audience: { kind: 'staff', teams: [team] } }).length} people`,
					false,
				),
			),
		);
		refill(
			'[data-ann-roles]',
			Object.entries(base.roles).map(([key, role]) => pickOption('role', key, role.name, role.note, true)),
		);
		refill(
			'[data-ann-plans]',
			planNames().map((plan) => pickOption('plan', plan, plan, '', true)),
		);
		refill(
			'[data-ann-regions]',
			regionNames().map((region) => pickOption('region', region, region, '', true)),
		);
	}

	function pickOption(group, value, label, hint, checked) {
		const hintMarkup = hint ? `<span class="ann-pick-hint">${htmlSafe(hint)}</span>` : '';
		return `<label class="ann-pick"><input name="${group}" value="${htmlSafe(value)}" data-ann-pick="${group}" class="form-check-input" type="checkbox"${checked ? ' checked' : ''}><span class="ann-pick-name">${htmlSafe(label)}</span>${hintMarkup}</label>`;
	}

	function tickedValues(group) {
		return pickAll(`[data-ann-pick="${group}"]:checked`, composer).map((box) => box.value);
	}

	function tickValues(group, values) {
		for (const box of pickAll(`[data-ann-pick="${group}"]`, composer)) box.checked = values.includes(box.value);
	}

	function checkRadio(name, value) {
		const radio = pick(`input[name="${name}"][value="${value}"]`, composer);
		if (!radio) return;
		radio.checked = true;
		radio.dispatchEvent(new Event('change', { bubbles: true }));
	}

	/** Reads the composer into one plain object. */
	function composerValues() {
		const audienceChoice = pick('[data-ann-aud]:checked', composer)?.value || 'all';
		const audience =
			audienceChoice === 'customers'
				? {
						kind: 'customers',
						roles: tickedValues('role'),
						plans: tickedValues('plan'),
						regions: tickedValues('region'),
					}
				: { kind: 'staff', teams: audienceChoice === 'teams' ? tickedValues('team') : [] };
		return {
			title: field('title').value.trim(),
			body: field('body').value.replace(/\s+$/, ''),
			audience,
			audienceChoice,
			timing: pick('[data-ann-when]:checked', composer)?.value || 'now',
			day: field('date').value,
			clockTime: field('time').value,
			askConfirm: field('ack').checked,
			pinned: field('pinned').checked,
			commentsOn: field('comments').checked,
			byEmail: field('email').checked,
		};
	}

	function audienceChosen(values) {
		const { audienceChoice, audience } = values;
		if (audienceChoice === 'teams') return audience.teams.length > 0;
		if (audienceChoice === 'customers')
			return audience.roles.length && audience.plans.length && audience.regions.length;
		return true;
	}

	/* A post that has already gone out keeps its timing; only its words
     and options can change. */
	function editingSentPost() {
		const post = view.editingId && findPost(view.editingId);
		return !!post && (post.status === 'live' || post.status === 'archived');
	}

	/** Keeps the composer's hints, panels and button in step with its fields. */
	function syncComposer() {
		if (!feed) return;
		const values = composerValues();
		for (const audiencePanel of pickAll('[data-ann-aud-panel]', composer))
			audiencePanel.hidden = audiencePanel.dataset.annAudPanel !== values.audienceChoice;

		pick('[data-ann-title-count]', composer).textContent =
			`A few words reads best. ${values.title.length} of 60 characters.`;
		const chosen = audienceChosen(values);
		pick('[data-ann-reach]', composer).textContent = chosen
			? `Reaches ${reachLine(values.audience)}.`
			: 'Nobody yet. Pick who should see it.';
		if (chosen) pick('[data-ann-aud-error]', composer).classList.remove('d-block');

		const sent = editingSentPost();
		pick('[data-ann-schedule]', composer).hidden = values.timing !== 'later';
		const submitLook = sent
			? { label: 'Save changes', glyph: 'bi-check2' }
			: {
					later: { label: 'Schedule', glyph: 'bi-clock' },
					draft: { label: 'Save draft', glyph: 'bi-file-earmark' },
				}[values.timing] || { label: 'Publish now', glyph: 'bi-send' };
		pick('[data-ann-submit-label]', composer).textContent = submitLook.label;
		pick('[data-ann-submit-icon]', composer).className = `bi ${submitLook.glyph}`;
		const showsSendTime = !sent && values.timing === 'later' && values.day && values.clockTime;
		pick('[data-ann-form-note]', composer).textContent = showsSendTime
			? `Goes out ${lowerRelative(longWhen(readStamp(`${values.day} ${values.clockTime}`)))}.`
			: '';
	}

	/* The formatting buttons wrap the selection in the editor. */
	function onFormatClick(event) {
		const button = event.target.closest('[data-ann-fmt]');
		if (!button) return;
		const editor = field('body');
		const { open, close, filler } = MARKUP_FOR[button.dataset.annFmt];
		const from = editor.selectionStart;
		const to = editor.selectionEnd;
		const words = editor.value.slice(from, to) || filler;
		const lineStart = from === 0 || editor.value.charAt(from - 1) === '\n';
		const before = lineStart ? open.replace(/^\n/, '') : open;
		editor.setRangeText(before + words + close, from, to, 'end');
		editor.focus();
		editor.setSelectionRange(from + before.length, from + before.length + words.length);
		syncComposer();
	}

	function onComposerSubmit(event) {
		event.preventDefault();
		if (composerSubmit.getAttribute('aria-busy') === 'true') return;
		const values = composerValues();
		let firstProblem = null;
		const mark = (input, ok) => {
			input.classList.toggle('is-invalid', !ok);
			input.setAttribute('aria-invalid', String(!ok));
			if (!ok && !firstProblem) firstProblem = input;
		};

		mark(field('title'), !!values.title);
		if (!audienceChosen(values)) {
			pick('[data-ann-aud-error]', composer).classList.add('d-block');
			firstProblem = firstProblem || pick('[data-ann-aud]:checked', composer);
		}
		mark(field('body'), !!values.body.trim());
		const existing = view.editingId ? findPost(view.editingId) : null;
		const sent = editingSentPost();
		let sendAt = currentTime();
		const dateError = pick('#ann-date-error');
		if (values.timing === 'later' && !sent) {
			sendAt = readStamp(`${values.day} ${values.clockTime || '09:00'}`);
			const inFuture = !!values.day && sendAt > currentTime();
			mark(field('date'), inFuture);
			dateError.classList.toggle('d-block', !inFuture);
		} else {
			dateError.classList.remove('d-block');
		}
		if (firstProblem) {
			firstProblem.focus();
			say('Some fields need a look');
			return;
		}

		const changes = {
			title: values.title,
			body: values.body,
			audience: values.audience,
			askConfirm: values.askConfirm,
			pinned: values.pinned,
			commentsOn: values.commentsOn,
			byEmail: values.byEmail,
		};
		const status = sent ? existing.status : { later: 'scheduled', draft: 'draft' }[values.timing] || 'live';
		const { post, undo } = existing
			? applyEdit(existing, changes, status, sent, sendAt)
			: addPost(changes, status, sendAt);
		keepInView(post, status);
		repaint();

		window.Basalt.buttonState?.(composerSubmit, 'loading');
		const request = existing ? server.update(post.id, changes) : server.create(changes);
		request
			.then(() => {
				window.Basalt.buttonState?.(composerSubmit, 'success');
				justSavedId = post.id;
				setTimeout(() => {
					closeDialog('#ann-compose');
					const outcome = savedOutcome(post, status, sent);
					notify({ tone: 'success', icon: outcome.glyph, title: outcome.title, text: outcome.text });
					say(outcome.title);
					if (status === 'live' && !existing) startFilling();
				}, 350);
			})
			.catch(() => {
				undo();
				repaint();
				window.Basalt.buttonState?.(composerSubmit, 'error');
				pick('[data-ann-form-note]', composer).textContent =
					'Not saved: the server did not answer. Your text is still here.';
				notify({
					tone: 'danger',
					title: 'Could not save the announcement',
					text: 'Nothing was sent. Your text is still in the composer.',
				});
				setTimeout(() => window.Basalt.buttonState?.(composerSubmit, 'idle'), 2400);
			});
	}

	/** Writes the composer into an existing post and returns its undo. */
	function applyEdit(post, changes, status, sent, sendAt) {
		const snapshot = { ...post };
		const audienceMoved = JSON.stringify(post.audience) !== JSON.stringify(changes.audience);
		Object.assign(post, changes, { status });
		if (!sent) post.dated = status === 'scheduled' ? sendAt : currentTime();
		if (status === 'live' && snapshot.status !== 'live') {
			startFresh(post);
		} else if (audienceMoved && post.audience.kind === 'staff' && snapshot.audience.kind === 'staff') {
			/* People already in the audience keep their read state; anyone new starts unread. */
			const before = new Set(audienceOf({ audience: snapshot.audience }).map((member) => member.id));
			post.unread = new Set(
				audienceOf(post)
					.map((member) => member.id)
					.filter((id) => !before.has(id) || snapshot.unread.has(id)),
			);
		} else if (audienceMoved) {
			startFresh(post);
		}
		const undo = () => {
			for (const key of Object.keys(post)) delete post[key];
			Object.assign(post, snapshot);
		};
		return { post, undo };
	}

	/** Adds a brand new post from the composer and returns its undo. */
	function addPost(changes, status, sendAt) {
		const post = toWorkingPost({
			...changes,
			id: `post-${Date.now().toString(36)}`,
			writer: feed.viewer,
			status,
			dated: '2026-01-01 00:00',
			tally: {},
			myReactions: [],
			discussion: [],
		});
		post.dated = status === 'scheduled' ? sendAt : currentTime();
		if (status === 'live') startFresh(post);
		view.posts.push(post);
		const undo = () => {
			view.posts = view.posts.filter((other) => other !== post);
		};
		return { post, undo };
	}

	/* Loosens the filters and search just enough for a saved post to show. */
	function keepInView(post, status) {
		const fits = view.statusFilter === 'all' ? status !== 'archived' : view.statusFilter === status;
		if (!fits) {
			view.statusFilter = status === 'archived' ? 'archived' : 'all';
			chooseOption(list.statusSelect, view.statusFilter);
		}
		if (view.audienceFilter !== 'any' && view.audienceFilter !== post.audience.kind) {
			view.audienceFilter = 'any';
			chooseOption(list.audienceSelect, 'any');
		}
		if (view.search && !passesFilters(post)) {
			view.search = '';
			list.search.value = '';
		}
	}

	/* The toast after a save. Its icon follows the status, edits included. */
	function savedOutcome(post, status, sent) {
		const glyph = { live: 'bi-send-check', scheduled: 'bi-clock' }[status] || 'bi-check2-circle';
		if (sent) return { glyph, title: 'Changes saved', text: post.title };
		if (status === 'live') return { glyph, title: 'Published', text: `Sent to ${reachLine(post.audience)}.` };
		if (status === 'scheduled')
			return { glyph, title: 'Scheduled', text: `Goes out ${lowerRelative(longWhen(post.dated))}.` };
		return { glyph, title: 'Draft saved', text: post.title };
	}

	function openDialog(selector) {
		bootstrap.Modal.getOrCreateInstance(pick(selector)).show();
	}

	function closeDialog(selector) {
		bootstrap.Modal.getOrCreateInstance(pick(selector)).hide();
	}

	/* Shortcuts are single keys, ignored while typing, inside a menu or
     under a dialog. With the panel open they act on its post; otherwise
     they act on the page. */

	function onShortcut(event) {
		if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.target.closest?.('input, textarea, select, [contenteditable="true"], .dropdown-menu')) return;
		if (pick('.modal.show')) return;
		if (!feed || view.loading) return;

		const post = panelShowing() ? findPost(view.openId) : null;
		if (post) {
			const forPost = postShortcut(event.key, post);
			if (forPost) {
				event.preventDefault();
				forPost();
			}
			return;
		}
		if (pick('.offcanvas.show:not(.basalt-mainmenu)')) return;
		const forPage = {
			'/': () => {
				list.search.focus();
				list.search.select();
			},
			c: () => openComposer(null),
			'?': () => openDialog('#ann-keys'),
		}[event.key];
		if (!forPage) return;
		event.preventDefault();
		forPage();
	}

	/** What E, P and A do to the open post, or null when the key means nothing. */
	function postShortcut(key, post) {
		const archived = post.status === 'archived';
		if (key === 'e') return archived ? null : () => doAction('edit', post);
		if (key === 'p') return () => flipPin(post);
		if (key === 'a') return () => (archived ? restorePost(post) : archivePost(post));
		return null;
	}

	/* Scripted team comments and reads land while the page is open. A real
     push channel (a WebSocket or server-sent events) calls the same two
     receivers. */

	function playHappenings() {
		for (const timer of scriptedTimers) clearTimeout(timer);
		scriptedTimers.length = 0;
		for (const happening of feed.happenings || []) {
			scriptedTimers.push(
				setTimeout(() => {
					const post = findPost(happening.post);
					if (!post || post.status !== 'live') return;
					if (happening.type === 'comment') commentArrived(post, happening.who, happening.text);
					else if (happening.type === 'read') readArrived(post, happening.who, !!happening.confirmed);
				}, happening.after * 1000),
			);
		}
		startFilling();
	}

	function commentArrived(post, author, text) {
		commentCount += 1;
		post.discussion.push({
			id: `l${commentCount}`,
			author,
			posted: currentTime(),
			text,
			parentId: null,
			fresh: true,
		});
		if (post.id === view.openId && view.panelMode === 'post') repaintComments(post);
		settleFreshComments(post);
		speakPolitely(`New comment from ${personFor(author).name} on “${post.title}”`);
	}

	function readArrived(post, readerId, confirmed) {
		if (post.audience.kind !== 'staff' || !post.unread.has(readerId)) return;
		post.unread.delete(readerId);
		if (post.askConfirm && !confirmed) post.unconfirmed.add(readerId);
		else post.unconfirmed.delete(readerId);
		repaint();
		paintReads(post);
	}

	/* Recently sent posts fill up as people open them, a little each tick,
     until nothing is left to fill. */
	function startFilling() {
		if (fillTimer) return;
		fillTimer = setInterval(() => {
			if (document.hidden || !feed) return;
			const recent = view.posts.filter(
				(post) => post.status === 'live' && (post.sentMs || currentTime() - post.dated < 4 * 3600000),
			);
			let stillFilling = false;
			for (const post of recent) {
				if (post.audience.kind === 'staff') {
					const waiting = [...post.unread].filter((id) => id !== feed.viewer);
					if (!waiting.length) continue;
					stillFilling = true;
					if (Math.random() < 0.55)
						readArrived(post, waiting[Math.floor(Math.random() * waiting.length)], Math.random() < 0.7);
					continue;
				}
				if (post.openedShare >= 0.3) continue;
				stillFilling = true;
				post.openedShare = Math.min(0.3, post.openedShare + 0.004 + Math.random() * 0.01);
				if (post.askConfirm)
					post.confirmedShare = Math.min(post.openedShare * 0.7, post.confirmedShare + Math.random() * 0.006);
				repaint();
				paintReads(post);
			}
			if (stillFilling) return;
			clearInterval(fillTimer);
			fillTimer = 0;
		}, 4500);
	}

	/* Who a post reaches and how far it has been read. */

	function personFor(id) {
		return staffById.get(id) || { id, name: 'Someone', team: '', role: '' };
	}

	function findPost(id) {
		return view.posts.find((post) => post.id === id);
	}

	/** Staff a post reaches; customer posts have no named readers. */
	function audienceOf(post) {
		const { audience } = post;
		if (audience.kind !== 'staff') return [];
		const everyone = [...staffById.values()];
		if (!audience.teams || !audience.teams.length) return everyone;
		return everyone.filter((member) => audience.teams.includes(member.team));
	}

	function planNames() {
		return Object.keys(feed.customerBase.plans);
	}

	function regionNames() {
		return Object.keys(feed.customerBase.regions);
	}

	/* Estimated people and accounts for a customer audience. */
	function customerReach(audience) {
		const base = feed.customerBase;
		const userShare = audience.plans.reduce((total, plan) => total + (base.plans[plan]?.users || 0), 0);
		const accountShare = audience.plans.reduce((total, plan) => total + (base.plans[plan]?.accounts || 0), 0);
		const regionShare = audience.regions.reduce((total, region) => total + (base.regions[region] || 0), 0);
		const roleUsers = audience.roles.reduce((total, role) => total + base.roles[role].users, 0);
		return {
			users: Math.round((roleUsers * userShare * regionShare) / 10) * 10,
			accounts: Math.round(base.accounts * accountShare * regionShare),
		};
	}

	/* For a row: "All staff", "Sales, Success", "3 teams" or "Customers". */
	function audienceShort(audience) {
		if (audience.kind !== 'staff') return 'Customers';
		const teams = audience.teams || [];
		if (!teams.length) return 'All staff';
		return teams.length > 2 ? `${teams.length} teams` : teams.join(', ');
	}

	/* For the panel, in full: "Customers: office staff on Pro and Max". */
	function audienceLong(audience) {
		if (audience.kind === 'staff')
			return audience.teams && audience.teams.length ? joinWords(audience.teams) : 'All staff';
		const base = feed.customerBase;
		let text =
			audience.roles.length === 2
				? 'Customers'
				: `Customers: ${base.roles[audience.roles[0]].name.toLowerCase()}`;
		if (audience.plans.length < planNames().length) text += ` on ${joinWords(audience.plans)}`;
		if (audience.regions.length < regionNames().length) text += ` in the ${joinWords(audience.regions)}`;
		return text;
	}

	function reachLine(audience) {
		if (audience.kind === 'staff') return countOf(audienceOf({ audience }).length, 'person', 'people');
		const reach = customerReach(audience);
		return `about ${countOf(reach.users, 'person', 'people')} at ${countOf(reach.accounts, 'account')}`;
	}

	function audienceIcon(audience) {
		return audience.kind === 'staff' ? 'bi-people' : 'bi-buildings';
	}

	function isCustomerPost(post) {
		return post.audience.kind === 'customers';
	}

	function notSentYet(post) {
		return post.status === 'scheduled' || post.status === 'draft';
	}

	function includesMe(post) {
		return post.audience.kind === 'staff' && audienceOf(post).some((member) => member.id === feed.viewer);
	}

	function unreadByMe(post) {
		return post.status === 'live' && includesMe(post) && post.unread.has(feed.viewer);
	}

	/** Read and confirmed counts: people for staff posts, estimates for
      customer posts (confirmed there counts accounts). */
	function readFigures(post) {
		if (post.audience.kind !== 'staff') {
			const reach = customerReach(post.audience);
			return {
				total: reach.users,
				read: Math.round(reach.users * post.openedShare),
				accounts: reach.accounts,
				confirmed: Math.round(reach.accounts * post.confirmedShare),
			};
		}
		const members = audienceOf(post);
		const readers = members.filter((member) => !post.unread.has(member.id));
		const confirmed = post.askConfirm ? readers.filter((member) => !post.unconfirmed.has(member.id)).length : 0;
		return { total: members.length, read: readers.length, confirmed, members };
	}

	/* Whom a reminder reaches: staff who have not opened the post, plus,
     when it asks for confirmation, those who have not confirmed. For a
     customer post, the accounts furthest behind. */
	function stillOwing(post) {
		if (isCustomerPost(post)) return post.behind.map((account) => account.name);
		const owes = (member) => post.unread.has(member.id) || (post.askConfirm && post.unconfirmed.has(member.id));
		return audienceOf(post)
			.filter(owes)
			.map((member) => member.id);
	}

	/* Posts use a small piece of Markdown: **bold**, _italic_, "- " list
     items and [text](address) links. */

	function renderMessage(source) {
		const blocks = [];
		let paragraph = [];
		let bullets = null;
		const closeParagraph = () => {
			if (!paragraph.length) return;
			blocks.push(`<p>${inlineMarks(paragraph.join(' '))}</p>`);
			paragraph = [];
		};
		const closeBullets = () => {
			if (!bullets) return;
			blocks.push(`<ul>${bullets.map((item) => `<li>${inlineMarks(item)}</li>`).join('')}</ul>`);
			bullets = null;
		};

		for (const rawLine of htmlSafe(source).split('\n')) {
			const line = rawLine.trim();
			if (!line) {
				closeParagraph();
				closeBullets();
			} else if (/^[-*]\s/.test(line)) {
				closeParagraph();
				bullets = bullets || [];
				bullets.push(line.replace(/^[-*]\s+/, ''));
			} else {
				closeBullets();
				paragraph.push(line.replace(/^#{2,3}\s+/, ''));
			}
		}
		closeParagraph();
		closeBullets();
		return blocks.join('');
	}

	/* Links are kept only for web, mail, in-page and local page addresses. */
	function inlineMarks(text) {
		const safeHref = /^(https?:\/\/|mailto:|#|[\w-]+\.html(#[\w-]*)?$)/;
		return text
			.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
			.replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>')
			.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (whole, label, href) =>
				safeHref.test(href) ? `<a href="${href}">${label}</a>` : label,
			);
	}

	function stripMarks(source) {
		return String(source)
			.replace(/\*\*|__|^#{2,3}\s+|^[-*]\s+/gm, '')
			.replace(/(^|[\s(])_([^_\n]+)_/g, '$1$2')
			.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
	}

	/* Dates come in as local stamps and go out as short, friendly text. */

	function readStamp(stamp) {
		const [day, clock] = String(stamp).split(' ');
		const [year, month, date] = day.split('-').map(Number);
		const [hours, minutes] = (clock || '00:00').split(':').map(Number);
		return new Date(year, month - 1, date, hours, minutes);
	}

	function currentTime() {
		return new Date(sampleStart.getTime() + (Date.now() - pageOpenedAt));
	}

	/** Whole calendar days from the date to today; negative is the future. */
	function agoDays(date) {
		const midnight = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
		return Math.round((midnight(currentTime()) - midnight(date)) / 86400000);
	}

	function relativeDay(date) {
		return { 0: 'Today', 1: 'Yesterday', '-1': 'Tomorrow' }[agoDays(date)];
	}

	function monthDay(date) {
		return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
	}

	function clockLabel(date) {
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const half = date.getHours() < 12 ? 'am' : 'pm';
		return `${date.getHours() % 12 || 12}:${minutes} ${half}`;
	}

	/* For a row: "Today", "Yesterday", "Tomorrow" or "Sep 15". */
	function shortDay(date) {
		return relativeDay(date) || monthDay(date);
	}

	/* In full: "Today at 9:15 am" or "Tue, Sep 29 at 3:00 pm". */
	function longWhen(date) {
		const relative = relativeDay(date);
		const day = relative || `${WEEKDAY_NAMES[date.getDay()]}, ${monthDay(date)}`;
		return `${day} at ${clockLabel(date)}`;
	}

	/* "Today" reads "today" once it follows other words. */
	function lowerRelative(text) {
		return /^(Yesterday|Tomorrow|Today)/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
	}

	function dateValue(date) {
		return [date.getFullYear(), twoDigits(date.getMonth() + 1), twoDigits(date.getDate())].join('-');
	}

	function timeValue(date) {
		return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
	}

	function twoDigits(number) {
		return String(number).padStart(2, '0');
	}

	/* Lookups, escaping and other small pieces used throughout. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (char) => entities[char]);
	}

	function icon(classes) {
		return `<i aria-hidden="true" class="bi ${classes}"></i>`;
	}

	function formatCount(number) {
		return Number(number).toLocaleString('en-US');
	}

	/** "1 post", "3 posts", or with an irregular plural, "2 people". */
	function countOf(number, one, many) {
		return `${formatCount(number)} ${number === 1 ? one : many || `${one}s`}`;
	}

	function percentOf(part, whole) {
		return whole ? Math.round((part / whole) * 100) : 0;
	}

	/* "Sales", "Sales and Success", "Sales, Success and Finance". */
	function joinWords(words) {
		if (words.length < 2) return words.join('');
		return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
	}

	function say(text) {
		window.Basalt.announce?.(text);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	/* The page's own polite region, cleared first so a repeat is read again. */
	function speakPolitely(text) {
		list.politeRegion.textContent = '';
		setTimeout(() => {
			list.politeRegion.textContent = text;
		}, 60);
	}

	function pause(ms, value) {
		return new Promise((resolve) => setTimeout(() => resolve(value), ms));
	}

	/* Saves succeed after a pause, or all fail with ?state=offline. */
	function settle(ms) {
		if (demoSwitch !== 'offline') return pause(ms);
		return pause(ms + 250).then(() => {
			throw new Error('offline');
		});
	}
})();
