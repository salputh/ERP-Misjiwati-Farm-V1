/**
 * Drives announcement-details.html, the full-page view of a single post that
 * opens from its title (or the quick view's full-page link) on
 * announcements.html.
 *
 * The page shows the message the way its audience receives it, with an
 * in-place editor for the text, how far it has traveled (a ring and a bar
 * per team), who is still to read it, who it is for and how it is delivered,
 * the team's comments and a dated record of every change. It handles staff
 * and customer posts alike, whether live, scheduled, a draft or archived.
 *
 * Connecting a backend: the post comes from the ?id= in the address (the
 * on-call roster post when there is none), and server.getPost is the one read.
 * Every other change goes through sendToServer(action, payload). The screen
 * changes at once and is put back, with an error toast, if that call fails;
 * open the page with ?state=offline to watch it happen.
 *
 * basalt.js supplies the detail header, segmented control, avatars, toasts
 * with undo, hold-to-confirm, loading buttons, menus and tooltips.
 */
(() => {
	'use strict';

	if (!pick('[data-ad-root]')) return;

	/* The sample posts, people and numbers, matching announcements.html. Stamps
     are written "YYYY-MM-DD HH:MM" and read in the viewer's own time zone. */
	const SAMPLE = {
		/* The demo pretends it is this moment, as the list page does. A real
       install reads the actual clock instead. */
		pretendNow: '2026-10-02 10:20',
		viewerId: 'ja',
		pickableTeams: ['Support', 'Success', 'Sales', 'Product', 'Engineering', 'Marketing', 'Finance'],

		/* Staff grouped under their team, each as [id, full name, job title]. */
		staff: {
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
				['zb', 'Jill Ellery', 'Marketing Lead'],
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

		/* Everyone a customer post can reach, with the list page's figures:
       48,200 monthly active users at 2,140 paying accounts. Each plan
       carries its share of those users and of those accounts. */
		customerBase: {
			roles: {
				office: { name: 'Office staff', hint: 'Schedulers and managers', users: 12200 },
				tech: { name: 'On-site staff', hint: 'Mobile app', users: 36000 },
			},
			payingAccounts: 2140,
			plans: {
				Basic: { users: 0.22, accounts: 0.46 },
				Pro: { users: 0.48, accounts: 0.4 },
				Max: { users: 0.3, accounts: 0.14 },
			},
			regions: { Northeast: 0.52, Midwest: 0.26, West: 0.14, South: 0.08 },
		},

		/* One record per row of announcements.html; the address picks which.
       switches lists the options that are on: confirm, pin, comments, email.
       audience is { staff: [teams] }, where no teams means everyone on staff,
       or { customers: { roles, plans, regions } }. html keeps to the tags
       the editor writes: p, strong, em, ul, ol, li and a. archiveOn is the
       day it leaves the feed, or '' for never.
       Staff posts name who has not opened it (unread) and who opened it
       without confirming (unconfirmed). Customer posts give the share of
       people who opened it, the share of accounts that confirmed, and the
       accounts furthest behind as [account, plan, opened, people].
       discussion rows are [id, stamp, author, text, id it answers] and
       changes rows are [icon, stamp, who, what], newest first. */
		posts: [
			{
				id: 'welcome-lori',
				state: 'live',
				writer: 'rk',
				stamp: '2026-10-02 09:15',
				title: 'Welcome Luna Rhodes to Support',
				switches: 'comments',
				archiveOn: '',
				audience: { staff: [] },
				html: '<p>Luna joins us on <strong>Monday, October 5</strong> from Sarasota to lead Support for the South.</p><ul><li>Phone hours in English and Spanish, 8 am to 6 pm Central time</li><li>First week: onboarding with Casey, then the Support roster</li></ul><p>Say hello in the comments.</p>',
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
				reacted: [],
				discussion: [
					['c1', '2026-10-02 09:32', 'tb', 'Bienvenida, Luna! Sending you my Spanish saved replies.'],
					[
						'c2',
						'2026-10-02 09:58',
						'mo',
						'Great news. Three accounts in Texas asked for phone support this quarter.',
					],
				],
				changes: [
					['bi-send', '2026-10-02 09:15', 'rk', 'published it to all staff, in the app'],
					['bi-file-earmark-plus', '2026-10-01 17:20', 'rk', 'started it as a draft'],
				],
			},
			{
				id: 'oncall-rota',
				state: 'live',
				writer: 'rk',
				stamp: '2026-10-01 11:30',
				title: 'New on-call roster from Oct 5',
				switches: 'confirm pin comments email',
				archiveOn: '2026-11-02',
				audience: { staff: ['Support', 'Engineering'] },
				html: '<p>From Monday, nights and weekends are covered by <strong>one person from Support and one from Engineering</strong>.</p><ul><li>Shifts run Monday 9 am to Monday 9 am</li><li>Support takes the first call</li><li>On-call pay goes up to $250 a week</li></ul><p>Your dates are in the <a href="schedule.html">team schedule</a>.</p>',
				unread: ['ys', 'ky', 'ln', 'fo'],
				unconfirmed: ['dn', 'mb', 'rt'],
				tally: { up: 12, heart: 2, party: 1 },
				reacted: [],
				discussion: [
					['c1', '2026-10-01 12:05', 'mv', 'Can we swap weeks between ourselves?'],
					['c2', '2026-10-01 12:20', 'rk', 'Yes, then update the schedule.', 'c1'],
				],
				changes: [
					['bi-pin-angle', '2026-10-01 11:31', 'rk', 'pinned it to the top of the list'],
					[
						'bi-send',
						'2026-10-01 11:30',
						'rk',
						'published it to Support and Engineering, in the app and by email',
					],
					['bi-patch-check', '2026-10-01 10:48', 'rk', 'asked readers to confirm'],
					['bi-pencil', '2026-09-30 16:15', 'dk', 'added the on-call pay line'],
					['bi-file-earmark-plus', '2026-09-30 15:40', 'rk', 'started it as a draft'],
				],
			},
			{
				id: 'q3-wrap',
				state: 'live',
				writer: 'ja',
				stamp: '2026-09-30 17:00',
				title: 'Q3 wrap-up: $880k MRR',
				switches: 'comments email',
				archiveOn: '',
				audience: { staff: [] },
				html: '<p>We closed September at <strong>$880k MRR</strong> and <strong>2,140 paying accounts</strong>. Thank you, all of you.</p><ul><li>48,200 people used Fieldline in September, up 9%</li><li>The Midwest passed 500 paying accounts</li></ul><p>Q4 planning notes go out on October 9.</p>',
				unread: ['ys', 'ik', 'ad', 'ln', 'sa', 'fr', 'ky'],
				unconfirmed: [],
				tally: { up: 31, heart: 8, party: 22 },
				reacted: [],
				discussion: [['c1', '2026-09-30 17:24', 'dc', 'The Midwest passing 500 is huge. Thank you, Paula.']],
				changes: [
					['bi-send', '2026-09-30 17:00', 'ja', 'published it to all staff, in the app and by email'],
					['bi-pencil', '2026-09-30 15:10', 'ng', 'checked the figures'],
					['bi-file-earmark-plus', '2026-09-30 14:30', 'ja', 'started it as a draft'],
				],
			},
			{
				id: 'release-6-4',
				state: 'live',
				writer: 'ps',
				stamp: '2026-09-29 15:00',
				title: 'Fieldline 6.4: smarter lunch breaks',
				switches: 'pin comments email',
				archiveOn: '',
				audience: {
					customers: {
						roles: ['office'],
						plans: ['Basic', 'Pro', 'Max'],
						regions: ['Northeast', 'Midwest', 'West', 'South'],
					},
				},
				html: '<p><strong>Travel Planner now plans each team member’s day around their lunch break.</strong></p><ul><li>Set a lunch window under Settings, Working hours</li><li>Visits that cannot fit before the break move after it</li><li>Drag the break on the day view like a visit</li></ul>',
				opened: 0.64,
				accountsConfirmed: 0,
				behind: [
					['Larchwood AI', 'Max', 5, 24],
					['Harborside Florals Co.', 'Pro', 2, 11],
					['Millrace Ceramics Co.', 'Pro', 2, 9],
					['Copperline Audio', 'Basic', 1, 6],
					['Sunvale Studios', 'Basic', 0, 4],
				],
				tally: { up: 312, heart: 96, party: 41 },
				reacted: ['party'],
				discussion: [
					['c1', '2026-09-29 16:10', 'mg', 'Lakeside Apparel already set lunch windows for all 22 walkers.'],
					['c2', '2026-09-30 09:05', 'rk', 'The saved reply for lunch windows is live in Support.'],
				],
				changes: [
					['bi-pin-angle', '2026-09-29 15:01', 'ps', 'pinned it to the top of the list'],
					[
						'bi-send',
						'2026-09-29 15:00',
						'ps',
						'published it to office staff at every customer, in the app and by email',
					],
					['bi-pencil', '2026-09-28 11:00', 'aj', 'added the line about dragging the break'],
					['bi-file-earmark-plus', '2026-09-25 10:15', 'ps', 'started it as a draft'],
				],
			},
			{
				id: 'app-6-4',
				state: 'live',
				writer: 'aj',
				stamp: '2026-09-29 15:05',
				title: 'Mobile 6.4: offline visit notes',
				switches: 'comments',
				archiveOn: '',
				audience: {
					customers: {
						roles: ['tech'],
						plans: ['Basic', 'Pro', 'Max'],
						regions: ['Northeast', 'Midwest', 'West', 'South'],
					},
				},
				html: '<p>Your staff can now <strong>write visit notes with no signal</strong>. Notes upload as soon as the phone is back online.</p><ul><li>Draw on visit photos to point out a detail</li><li>Needs iOS 16 or Android 11</li></ul>',
				opened: 0.47,
				accountsConfirmed: 0,
				behind: [
					['Northgate Analytics', 'Max', 21, 64],
					['Brightline Photography', 'Pro', 6, 23],
					['Tidewater Pet Sitting Co.', 'Pro', 4, 18],
					['Avocet Mobility Group', 'Basic', 1, 7],
				],
				tally: { up: 488, heart: 130, party: 52 },
				reacted: [],
				discussion: [
					['c1', '2026-09-30 11:16', 'tb', 'Brightline asked whether it works on older Android phones.'],
					['c2', '2026-09-30 11:40', 'sl', 'Android 10 support comes in 6.5.', 'c1'],
				],
				changes: [
					[
						'bi-send',
						'2026-09-29 15:05',
						'aj',
						'published it to on-site staff at every customer, in the app',
					],
					['bi-file-earmark-plus', '2026-09-28 16:30', 'aj', 'started it as a draft'],
				],
			},
			{
				id: 'sms-sender',
				state: 'live',
				writer: 'mg',
				stamp: '2026-09-24 10:00',
				title: 'Midwest SMS sender rules from Nov 1',
				switches: 'confirm comments email',
				archiveOn: '2026-11-02',
				audience: { customers: { roles: ['office'], plans: ['Basic', 'Pro', 'Max'], regions: ['Midwest'] } },
				html: '<p>From <strong>November 1</strong>, texts from Midwest accounts only go out under a registered sender name.</p><ul><li>Register yours under Settings, SMS, Sender name</li><li>It is free and takes two working days</li></ul><p>Please confirm so we know your account is ready.</p>',
				opened: 0.71,
				accountsConfirmed: 0.48,
				behind: [
					['Northlight Photography', 'Max', 4, 19],
					['Harborside Florals Co.', 'Pro', 1, 11],
					['Brightline Photography', 'Pro', 2, 8],
					['Calder Type Kiln Services', 'Basic', 0, 4],
				],
				tally: { up: 64, heart: 3, party: 0 },
				reacted: [],
				discussion: [
					['c1', '2026-09-28 15:30', 'vh', '214 sender names registered so far, all within two days.'],
				],
				changes: [
					[
						'bi-send',
						'2026-09-24 10:00',
						'mg',
						'published it to office staff in the Midwest, in the app and by email',
					],
					['bi-patch-check', '2026-09-23 17:40', 'mg', 'asked customers to confirm'],
					['bi-file-earmark-plus', '2026-09-23 16:05', 'mg', 'started it as a draft'],
				],
			},
			{
				id: 'annual-offer',
				state: 'live',
				writer: 'dc',
				stamp: '2026-09-25 14:00',
				title: 'Annual billing: two months free',
				switches: 'comments',
				archiveOn: '2026-11-01',
				audience: { staff: ['Sales', 'Success'] },
				html: '<p>Accounts that move to annual billing before <strong>October 31</strong> get two months free, on any plan.</p><ul><li>Quote it from the pricing page</li><li>Billing applies the discount on the first invoice</li></ul>',
				unread: ['jk', 'hs'],
				unconfirmed: [],
				tally: { up: 9, heart: 0, party: 3 },
				reacted: [],
				discussion: [
					['c1', '2026-09-25 15:10', 'ob', 'Does it apply to renewals in October?'],
					['c2', '2026-09-25 15:26', 'dc', 'Yes, if they sign by October 31.', 'c1'],
				],
				changes: [
					['bi-send', '2026-09-25 14:00', 'dc', 'published it to Sales and Success, in the app'],
					['bi-file-earmark-plus', '2026-09-25 11:20', 'dc', 'started it as a draft'],
				],
			},
			{
				id: 'security-keys',
				state: 'live',
				writer: 'dk',
				stamp: '2026-09-22 09:30',
				title: 'Security keys for everyone by Oct 30',
				switches: 'confirm comments email',
				archiveOn: '2026-10-31',
				audience: { staff: [] },
				html: '<p>From <strong>October 30</strong>, signing in to our admin tools needs a physical security key.</p><ul><li>Two keys per person are on their way</li><li>Add both, then confirm below</li><li>Keep the spare one at home</li></ul>',
				unread: ['ys', 'fr', 'ik', 'sa'],
				unconfirmed: ['ja', 'mo', 'lw', 'ci', 'gf', 'vh'],
				tally: { up: 21, heart: 1, party: 0 },
				reacted: [],
				discussion: [
					['c1', '2026-09-28 10:02', 'lw', 'Mine arrived with only one key in the box.'],
					['c2', '2026-09-28 10:30', 'dk', 'Sorry, a second batch ships on Monday.', 'c1'],
				],
				changes: [
					['bi-send', '2026-09-22 09:30', 'dk', 'published it to all staff, in the app and by email'],
					['bi-patch-check', '2026-09-22 09:12', 'dk', 'asked readers to confirm'],
					['bi-file-earmark-plus', '2026-09-21 16:45', 'dk', 'started it as a draft'],
				],
			},
			{
				id: 'west-team',
				state: 'live',
				writer: 'mg',
				stamp: '2026-09-15 08:30',
				title: 'Hello from our Flagstaff team',
				switches: 'comments',
				archiveOn: '',
				audience: { staff: [] },
				html: '<p>Hope Stout (Success) and Walt Zook (Engineering) started this week in Flagstaff. They cover customers in the West from 8 am to 6 pm local time.</p>',
				unread: ['ik'],
				unconfirmed: [],
				tally: { up: 18, heart: 14, party: 11 },
				reacted: ['heart'],
				discussion: [['c1', '2026-09-15 09:40', 'hs', 'Thank you for the welcome, everyone.']],
				changes: [
					['bi-send', '2026-09-15 08:30', 'mg', 'published it to all staff, in the app'],
					['bi-file-earmark-plus', '2026-09-14 17:10', 'mg', 'started it as a draft'],
				],
			},
			{
				id: 'spanish',
				state: 'live',
				writer: 'mo',
				stamp: '2026-09-10 13:00',
				title: 'Now in Spanish',
				switches: 'comments email',
				archiveOn: '',
				audience: {
					customers: {
						roles: ['office', 'tech'],
						plans: ['Basic', 'Pro', 'Max'],
						regions: ['South'],
					},
				},
				html: '<p>The web app and the mobile app are now in <strong>Spanish</strong>. Each person picks their language under Profile, Language.</p>',
				opened: 0.58,
				accountsConfirmed: 0,
				behind: [
					['Solaris Photography', 'Pro', 10, 38],
					['Caring Hands Home Care', 'Pro', 6, 27],
					['Andes Outfitters', 'Basic', 2, 9],
				],
				tally: { up: 140, heart: 77, party: 35 },
				reacted: [],
				discussion: [],
				changes: [
					[
						'bi-send',
						'2026-09-10 13:00',
						'mo',
						'published it to customers in the South, in the app and by email',
					],
					['bi-file-earmark-plus', '2026-09-09 11:25', 'mo', 'started it as a draft'],
				],
			},
			{
				id: 'maintenance-oct-11',
				state: 'scheduled',
				writer: 'dk',
				stamp: '2026-10-05 09:00',
				title: 'Planned maintenance on Oct 11',
				switches: 'confirm comments email',
				archiveOn: '2026-10-12',
				audience: {
					customers: {
						roles: ['office'],
						plans: ['Basic', 'Pro', 'Max'],
						regions: ['Northeast', 'Midwest', 'West', 'South'],
					},
				},
				html: '<p>Fieldline will be <strong>read-only for up to two hours</strong> on Sunday, October 11, from 2 to 4 am UTC.</p><ul><li>Staff can see their day but not close visits</li><li>Work done offline uploads when we are back</li></ul>',
				tally: {},
				reacted: [],
				discussion: [['c1', '2026-10-01 16:02', 'rk', 'Support will have two extra people on that Sunday.']],
				changes: [
					['bi-calendar-event', '2026-10-01 15:40', 'dk', 'scheduled it for Oct 5 at 9:00 am'],
					['bi-file-earmark-plus', '2026-10-01 15:20', 'dk', 'started it as a draft'],
				],
			},
			{
				id: 'offsite',
				state: 'scheduled',
				writer: 'ja',
				stamp: '2026-10-06 08:00',
				title: 'Office closed Oct 12 for the offsite',
				switches: 'comments email',
				archiveOn: '2026-10-13',
				audience: { staff: [] },
				html: '<p>The whole team spends <strong>Monday, October 12</strong> together. Support runs the weekend roster for the day.</p><ul><li>Coaches leave at 8:30 am</li><li>Tell Finance about food allergies by October 7</li></ul>',
				tally: {},
				reacted: [],
				discussion: [],
				changes: [
					['bi-calendar-event', '2026-10-01 18:05', 'ja', 'scheduled it for Oct 6 at 8:00 am'],
					['bi-file-earmark-plus', '2026-10-01 17:30', 'ja', 'started it as a draft'],
				],
			},
			{
				id: 'beta-6-5',
				state: 'scheduled',
				writer: 'aj',
				stamp: '2026-10-08 16:00',
				title: 'Mobile 6.5 beta is open',
				switches: 'comments',
				archiveOn: '',
				audience: { customers: { roles: ['tech'], plans: ['Pro', 'Max'], regions: ['Northeast'] } },
				html: '<p>Try the next version early: <strong>voice notes on visits</strong> and quicker signatures. Turn it on under Settings, Mobile app.</p>',
				tally: {},
				reacted: [],
				discussion: [],
				changes: [
					['bi-calendar-event', '2026-10-02 09:50', 'aj', 'scheduled it for Oct 8 at 4:00 pm'],
					['bi-file-earmark-plus', '2026-10-01 14:00', 'aj', 'started it as a draft'],
				],
			},
			{
				id: 'portal-redesign',
				state: 'draft',
				writer: 'ps',
				stamp: '2026-10-01 16:40',
				title: 'A new look for the Customer Portal',
				switches: 'comments email',
				archiveOn: '',
				audience: {
					customers: {
						roles: ['office'],
						plans: ['Pro', 'Max'],
						regions: ['Northeast', 'Midwest', 'West', 'South'],
					},
				},
				html: '<p>In November the Customer Portal gets a cleaner design and <strong>real arrival windows</strong> for online booking. Your logo and links carry over.</p>',
				tally: {},
				reacted: [],
				discussion: [
					['c1', '2026-10-01 17:05', 'mf', 'Can we add a screenshot once the booking page is final?'],
					['c2', '2026-10-01 17:12', 'ps', 'Yes. I will hold the post until then.', 'c1'],
				],
				changes: [
					['bi-pencil', '2026-10-01 16:40', 'ps', 'edited the draft'],
					['bi-file-earmark-plus', '2026-09-30 11:05', 'ps', 'started it as a draft'],
				],
			},
			{
				id: 'release-6-3',
				state: 'archived',
				writer: 'tc',
				stamp: '2026-08-25 15:00',
				title: 'Fieldline 6.3: pause recurring visits',
				switches: 'comments email',
				archiveOn: '2026-09-25',
				audience: {
					customers: {
						roles: ['office'],
						plans: ['Basic', 'Pro', 'Max'],
						regions: ['Northeast', 'Midwest', 'West', 'South'],
					},
				},
				html: '<p>Pause a recurring visit while a customer is away. It picks up again on the date you choose.</p>',
				opened: 0.81,
				accountsConfirmed: 0,
				behind: [['Copperline Audio', 'Basic', 2, 6]],
				tally: { up: 205, heart: 61, party: 12 },
				reacted: [],
				discussion: [],
				changes: [
					['bi-archive', '2026-09-25 09:00', 'tc', 'archived it'],
					[
						'bi-send',
						'2026-08-25 15:00',
						'tc',
						'published it to office staff at every customer, in the app and by email',
					],
					['bi-file-earmark-plus', '2026-08-21 10:30', 'tc', 'started it as a draft'],
				],
			},
			{
				id: 'summer-fridays',
				state: 'archived',
				writer: 'ja',
				stamp: '2026-08-28 09:00',
				title: 'Summer Fridays end Sep 4',
				switches: 'comments',
				archiveOn: '2026-09-11',
				audience: { staff: [] },
				html: '<p>Thanks for a good summer. Normal Friday hours are back from September 11.</p>',
				unread: [],
				unconfirmed: [],
				tally: { up: 14, heart: 2, party: 0 },
				reacted: [],
				discussion: [],
				changes: [
					['bi-archive', '2026-09-11 09:00', 'ja', 'archived it'],
					['bi-send', '2026-08-28 09:00', 'ja', 'published it to all staff, in the app'],
					['bi-file-earmark-plus', '2026-08-27 16:20', 'ja', 'started it as a draft'],
				],
			},
		],

		/* A reader who opens a post while this page is showing it, so the
       live parts have something to do. */
		liveReads: [{ afterSeconds: 16, post: 'oncall-rota', reader: 'ky', confirms: true }],
	};

	/* Each change reaches the server as one request, listed here with how
     long the demo takes to answer it:
       update     PATCH  /api/announcements/:id
       pin        PUT or DELETE /api/announcements/:id/pin
       archive    POST   /api/announcements/:id/archive
       restore    POST   /api/announcements/:id/restore
       duplicate  POST   /api/announcements/:id/duplicate
       remove     DELETE /api/announcements/:id
       react      PUT or DELETE /api/announcements/:id/reactions/:key
       comment    POST   /api/announcements/:id/comments
       uncomment  DELETE /api/announcements/:id/comments/:commentId
       publish    POST   /api/announcements/:id/publish
       remind     POST   /api/announcements/:id/reminders */
	const ANSWER_MS = {
		update: 350,
		pin: 150,
		archive: 200,
		restore: 200,
		duplicate: 300,
		remove: 250,
		react: 120,
		comment: 300,
		uncomment: 200,
		publish: 300,
		remind: 700,
	};
	const goOffline = new URLSearchParams(location.search).get('state') === 'offline';

	const server = {
		/* GET /api/announcements/:id. Without a match the on-call post opens. */
		getPost(postId) {
			const match = SAMPLE.posts.find((raw) => raw.id === postId);
			return Promise.resolve(match || SAMPLE.posts.find((raw) => raw.id === 'oncall-rota'));
		},
	};

	const FIRST_ROWS = 8;
	const TEAM_BARS = 4;
	const DAY_MS = 86400000;
	const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/* Bootstrap Icons has no filled stars, so Celebrate keeps one icon. */
	const REACTIONS = [
		{ key: 'up', name: 'Thumbs up', idle: 'bi-hand-thumbs-up', active: 'bi-hand-thumbs-up-fill' },
		{ key: 'heart', name: 'Love it', idle: 'bi-heart', active: 'bi-heart-fill' },
		{ key: 'party', name: 'Celebrate', idle: 'bi-stars', active: 'bi-stars' },
	];
	const STATE_BADGES = {
		live: ['Live', 'success'],
		scheduled: ['Scheduled', 'info'],
		draft: ['Draft', ''],
		archived: ['Archived', ''],
	};

	/* The paste filter keeps these tags, renaming b and i to their
     semantic forms, so outside styles and scripts never reach readers. */
	const KEPT_TAGS = {
		P: 'p',
		STRONG: 'strong',
		B: 'strong',
		EM: 'em',
		I: 'em',
		UL: 'ul',
		OL: 'ol',
		LI: 'li',
		A: 'a',
		BR: 'br',
	};

	const onApple = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
	const pretendStart = readStamp(SAMPLE.pretendNow);
	const openedAt = Date.now();

	const staffById = new Map();
	for (const [team, members] of Object.entries(SAMPLE.staff)) {
		for (const [id, name, title] of members) staffById.set(id, { id, name, team, title });
	}

	/* The post being shown, and the parts of the screen that are not part
     of the post itself. */
	let article = null;
	let commentSerial = 1;
	let savedRange = null;
	const view = {
		readerFilter: 'waiting',
		showAllReaders: false,
		replyingTo: null,
		editingPost: false,
		editingAudience: false,
		arrivals: new Set(),
	};

	const pageHead = {
		title: pick('[data-ad="title"]'),
		byline: pick('[data-ad="sub"]'),
		tags: pick('[data-ad="tags"]'),
		primary: pick('[data-ad-primary]'),
		more: pick('[data-ad-more]'),
		menu: pick('[data-ad="menu"]'),
		notice: pick('[data-ad="notice"]'),
	};
	const postCard = {
		desc: pick('[data-ad="post-desc"]'),
		reading: pick('[data-ad-view]'),
		from: pick('[data-ad="from"]'),
		heading: pick('[data-ad="letter-title"]'),
		message: pick('[data-ad="body"]'),
		confirmLine: pick('[data-ad="letter-ack"]'),
		reactions: pick('[data-ad="reactions"]'),
		editButton: pick('[data-ad-edit]'),
		form: pick('[data-ad-form]'),
	};
	const editor = {
		title: pick('[data-ad-f="title"]'),
		titleError: pick('#ad-title-error'),
		titleCount: pick('[data-ad-title-count]'),
		frame: pick('[data-ad-editor]'),
		body: pick('[data-ad-body]'),
		bodyError: pick('[data-ad-body-error]'),
		notify: pick('[data-ad-f="notify"]'),
		note: pick('[data-ad-edit-note]'),
		linkButton: pick('[data-ad-link]'),
		linkForm: pick('[data-ad-linkform]'),
		linkInput: pick('[data-ad-link-url]'),
		linkError: pick('[data-ad-link-error]'),
	};
	const reachCard = {
		card: pick('.ad-card-reach'),
		desc: pick('[data-ad="reach-desc"]'),
		ring: pick('[data-ad="ring"]'),
		subhead: pick('[data-ad="reach-sub"]'),
		bars: pick('[data-ad="teams"]'),
		restNote: pick('[data-ad="teams-more"]'),
		reminder: pick('[data-ad="reminded"]'),
	};
	const readersCard = {
		card: pick('.ad-card-readers'),
		heading: pick('#ad-readers-title'),
		desc: pick('[data-ad="readers-desc"]'),
		switcher: pick('[data-ad="filter"]'),
		caption: pick('[data-ad="readers-caption"]'),
		columns: pick('[data-ad="readers-head"]'),
		rows: pick('[data-ad="readers"]'),
		table: pick('.ad-table'),
		empty: pick('[data-ad="readers-empty"]'),
		foot: pick('[data-ad="readers-foot"]'),
		footNote: pick('[data-ad="readers-note"]'),
		toggle: pick('[data-ad-readers-more]'),
	};
	const audienceCard = {
		facts: pick('[data-ad="audience"]'),
		editButton: pick('[data-ad-aud-edit]'),
		form: pick('[data-ad-aud-form]'),
		pickers: pick('[data-ad-picks]'),
		sendField: pick('[data-ad-send-field]'),
		sendDate: pick('[data-ad-send-date]'),
		sendTime: pick('[data-ad-send-time]'),
		sendError: pick('[data-ad-send-error]'),
		archiveDay: pick('[data-ad-o="until"]'),
		archiveError: pick('[data-ad-until-error]'),
	};
	const thread = {
		desc: pick('[data-ad="comments-desc"]'),
		list: pick('[data-ad="comments"]'),
		form: pick('[data-ad-reply-form]'),
		target: pick('[data-ad-reply-to]'),
		input: pick('[data-ad-reply-text]'),
		error: pick('[data-ad-reply-error]'),
		hint: pick('[data-ad-keys]'),
	};
	const timeline = pick('[data-ad="activity"]');
	const liveRegion = pick('[data-ad-live]');

	/* Binds every control while the post is still on its way, then paints
     the page once it arrives and starts the simulated live reads. */
	function start() {
		try {
			document.execCommand('defaultParagraphSeparator', false, 'p');
		} catch {
			/* Older engines lack the command; their default is fine. */
		}
		thread.hint.textContent = `${onApple ? '⌘' : 'Ctrl'} + Enter sends`;

		wirePageHead();
		wireReactions();
		wireEditor();
		wireReaders();
		wireAudience();
		wireComments();
		window.addEventListener('beforeunload', warnBeforeLeaving);

		server.getPost(new URLSearchParams(location.search).get('id')).then((raw) => {
			article = prepare(raw);
			commentSerial = article.discussion.length + 1;
			/* With nobody left to wait for, open on everyone rather than on an
         empty list. */
			if (!tallyReach().waiting.length) view.readerFilter = 'everyone';
			paintAll();
			scheduleLiveReads();
		});
	}

	function paintAll() {
		paintPageHead();
		paintPost();
		paintReach();
		paintReaders();
		paintAudience();
		paintComments();
		paintTimeline();
	}

	/* prepare() turns a sample record into the working copy the page edits.
     On a staff post, the read and confirm times are spread between the
     moment it went out and now; a real server sends them instead. */
	function prepare(raw) {
		const switches = new Set(raw.switches.split(' '));
		const { staff, customers } = raw.audience;
		const working = {
			id: raw.id,
			title: raw.title,
			writer: raw.writer,
			state: raw.state,
			at: readStamp(raw.stamp),
			until: raw.archiveOn,
			ack: switches.has('confirm'),
			pinned: switches.has('pin'),
			comments: switches.has('comments'),
			email: switches.has('email'),
			message: raw.html,
			audience: staff
				? { who: 'staff', teams: staff.slice() }
				: {
						who: 'customers',
						roles: customers.roles.slice(),
						plans: customers.plans.slice(),
						regions: customers.regions.slice(),
					},
			reads: new Map(),
			openedShare: raw.opened || 0,
			confirmedShare: raw.accountsConfirmed || 0,
			behind: (raw.behind || []).map((row) => row.slice()),
			tally: { up: 0, heart: 0, party: 0, ...raw.tally },
			mine: new Set(raw.reacted),
			discussion: raw.discussion.map(([id, stamp, by, text, parent]) => ({
				id,
				by,
				at: readStamp(stamp),
				text,
				replyTo: parent || null,
			})),
			changes: raw.changes.map(([icon, stamp, by, text]) => ({ at: readStamp(stamp), by, icon, text })),
			remindedAt: null,
			remindedCount: 0,
		};
		if (staff && raw.unread) spreadReads(working, raw);
		return working;
	}

	/* The writer reads first; everyone else follows in a fixed but
     scattered order, bunched toward the start like real reading. */
	function spreadReads(working, raw) {
		const unread = new Set(raw.unread);
		const unconfirmed = new Set(raw.unconfirmed);
		const readers = staffIn(working.audience.teams).filter((member) => !unread.has(member.id));
		readers.sort((a, b) => (b.id === working.writer) - (a.id === working.writer) || scatter(a.id) - scatter(b.id));
		const span = Math.min(clockNow() - working.at, 4 * DAY_MS) * 0.96;
		for (const [place, member] of readers.entries()) {
			const readAt = new Date(working.at.getTime() + span * (place / readers.length) ** 2);
			readAt.setSeconds(0, 0);
			const confirmedAt =
				working.ack && !unconfirmed.has(member.id)
					? new Date(readAt.getTime() + (1 + (place % 4)) * 60000)
					: null;
			working.reads.set(member.id, { readAt, confirmedAt });
		}
	}

	/** A stable pseudo-random number for an id, used only to shuffle readers. */
	function scatter(id) {
		let mixed = 7;
		for (const letter of id) mixed = (mixed * 31 + letter.charCodeAt(0)) % 997;
		return mixed;
	}

	/* These answer who the post is for, who has read it and how far it reaches. */

	function staffMember(id) {
		return staffById.get(id) || { id, name: 'Someone', team: '', title: '' };
	}

	/** Staff on the given teams; an empty list means all of them. */
	function staffIn(teams) {
		return Array.from(staffById.values()).filter((member) => !teams.length || teams.includes(member.team));
	}

	function audienceStaff() {
		return isCustomerPost() ? [] : staffIn(article.audience.teams);
	}

	function isCustomerPost() {
		return article.audience.who === 'customers';
	}

	function inFeed() {
		return article.state === 'live';
	}

	function hasGoneOut() {
		return article.state === 'live' || article.state === 'archived';
	}

	function hasRead(id) {
		return article.reads.has(id);
	}

	function hasConfirmed(id) {
		return Boolean(article.reads.get(id)?.confirmedAt);
	}

	/** Done means confirmed when the post asks for it, read otherwise. */
	function isSettled(id) {
		return article.ack ? hasConfirmed(id) : hasRead(id);
	}

	function waitingNouns() {
		return isCustomerPost() ? ['account', 'accounts'] : ['person', 'people'];
	}

	/**
	 * Read and confirm figures for the post. Customer posts count people
	 * for opening and accounts for confirming. waiting is who a reminder
	 * goes to: staff still to read or confirm, or the accounts furthest behind.
	 */
	function tallyReach() {
		if (isCustomerPost()) {
			const { users, accounts } = estimateReach(article.audience);
			return {
				total: users,
				read: Math.round(users * article.openedShare),
				accounts,
				confirmed: Math.round(accounts * article.confirmedShare),
				waiting: article.behind,
			};
		}
		const everyone = audienceStaff();
		return {
			total: everyone.length,
			read: everyone.filter((member) => hasRead(member.id)).length,
			confirmed: everyone.filter((member) => hasConfirmed(member.id)).length,
			waiting: everyone.filter((member) => !isSettled(member.id)),
		};
	}

	/** About how many people, and at how many accounts, a customer audience reaches. */
	function estimateReach(audience) {
		const base = SAMPLE.customerBase;
		const regionShare = addShares(audience.regions, (region) => base.regions[region]);
		let roleUsers = 0;
		for (const role of audience.roles) roleUsers += base.roles[role].users;
		const users =
			Math.round((roleUsers * addShares(audience.plans, (plan) => base.plans[plan].users) * regionShare) / 10) *
			10;
		const accounts = Math.round(
			base.payingAccounts * addShares(audience.plans, (plan) => base.plans[plan].accounts) * regionShare,
		);
		return { users, accounts };
	}

	function addShares(keys, shareOf) {
		let sum = 0;
		for (const key of keys) sum += shareOf(key) || 0;
		return sum;
	}

	/** "Support and Engineering", "All staff" or "Customers: office staff in the Midwest". */
	function describeAudience(audience) {
		if (audience.who === 'staff') return audience.teams.length ? joinWords(audience.teams) : 'All staff';
		const base = SAMPLE.customerBase;
		let words =
			audience.roles.length === 2
				? 'Customers'
				: `Customers: ${base.roles[audience.roles[0]].name.toLowerCase()}`;
		if (audience.plans.length < Object.keys(base.plans).length) words += ` on ${joinWords(audience.plans)}`;
		if (audience.regions.length < Object.keys(base.regions).length)
			words += ` in the ${joinWords(audience.regions)}`;
		return words;
	}

	function describeReach(audience) {
		if (audience.who === 'staff') return countOf(staffIn(audience.teams).length, 'person', 'people');
		const { users, accounts } = estimateReach(audience);
		return `about ${countOf(users, 'person', 'people')} at ${countOf(accounts, 'account')}`;
	}

	/* The page header carries the title, byline, tags, one main action, the
     more menu and the notice for a post that is out of the feed. */

	function paintPageHead() {
		document.title = `${article.title} · Basalt`;
		pageHead.title.textContent = article.title;
		pageHead.byline.textContent = `${staffMember(article.writer).name} · ${bylineWhen()} · ${describeAudience(article.audience)}`;
		pageHead.tags.innerHTML = headTags().join('');
		paintPrimaryAction();
		pageHead.menu.innerHTML = menuEntries().join('');

		const notice = noticeFor(article.state);
		pageHead.notice.hidden = !notice;
		pageHead.notice.innerHTML = notice
			? `<i class="bi ${notice[0]}" aria-hidden="true"></i><span>${htmlSafe(notice[1])}</span>`
			: '';
	}

	/** When it went out, or when it will, or when the draft was last touched. */
	function bylineWhen() {
		const lead = { scheduled: 'Goes out', draft: 'Edited' }[article.state];
		return lead ? `${lead} ${inSentence(longWhen(article.at))}` : longWhen(article.at);
	}

	function headTags() {
		const [label, tone] = STATE_BADGES[article.state];
		const tags = [
			`<span class="basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}">${label}</span>`,
		];
		if (article.pinned && inFeed()) tags.push(tagChip('bi-pin-angle-fill', 'Pinned'));
		if (article.ack) tags.push(tagChip('bi-patch-check', 'Asks readers to confirm'));
		if (article.email) tags.push(tagChip('bi-envelope', 'Also by email'));
		return tags;
	}

	function tagChip(icon, text) {
		return `<span class="ad-tag"><i class="bi ${icon}" aria-hidden="true"></i>${text}</span>`;
	}

	/* One main action at a time: put back an archived post, send one that
     has not gone out, or remind whoever is still behind. Only the reminder
     uses the loading states, and a button mid-request is left alone. */
	function paintPrimaryAction() {
		const button = pageHead.primary;
		if (button.getAttribute('aria-busy') === 'true') return;
		const behind = tallyReach().waiting.length;
		button.hidden = false;
		button.classList.toggle('btn-loading', article.state === 'live');
		let action = null;
		if (article.state === 'archived') action = 'restore';
		else if (!hasGoneOut()) action = 'publish';
		else if (behind) action = 'remind';
		if (!action) {
			button.hidden = true;
			return;
		}
		button.dataset.adAct = action;
		button.innerHTML = primaryLabel(action, behind);
	}

	function primaryLabel(action, behind) {
		if (action === 'restore') return '<i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Put back';
		if (action === 'publish') return '<i class="bi bi-send me-1" aria-hidden="true"></i>Publish now';
		const [one, many] = waitingNouns();
		const states = [
			['idle', `<i class="bi bi-bell" aria-hidden="true"></i>Remind ${countOf(behind, one, many)}`],
			['busy', '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>Sending'],
			['done', '<i class="bi bi-check2" aria-hidden="true"></i>Reminder sent'],
			['fail', '<i class="bi bi-exclamation-circle" aria-hidden="true"></i>Not sent'],
		];
		return states
			.map(([state, inner]) => `<span class="btn-loading-state btn-loading-${state}">${inner}</span>`)
			.join('');
	}

	function menuEntries() {
		const lines = [];
		if (inFeed())
			lines.push(
				menuButton(
					'pin',
					article.pinned ? 'bi-pin-angle-fill' : 'bi-pin-angle',
					article.pinned ? 'Unpin' : 'Pin to the top',
				),
			);
		lines.push(
			menuButton('copy', 'bi-link-45deg', 'Copy link'),
			menuButton('duplicate', 'bi-copy', 'Duplicate as a draft'),
		);
		if (inFeed()) lines.push(menuButton('archive', 'bi-archive', 'Archive'));
		lines.push(
			'<li><hr class="dropdown-divider"></li>',
			menuButton('delete', 'bi-trash3', 'Delete…', 'ad-danger-item'),
		);
		return lines;
	}

	function menuButton(action, icon, text, extraClass = '') {
		return `<li><button data-ad-act="${action}" type="button" class="dropdown-item${extraClass ? ` ${extraClass}` : ''}"><i class="bi ${icon}" aria-hidden="true"></i>${text}</button></li>`;
	}

	/** The slim line under the header saying why a post is not in the feed. */
	function noticeFor(state) {
		if (state === 'archived')
			return ['bi-archive', 'Archived. It has left every feed but keeps its readers, comments and history.'];
		if (state === 'scheduled')
			return [
				'bi-calendar-event',
				`Scheduled for ${inSentence(longWhen(article.at))}. It will reach ${describeReach(article.audience)}.`,
			];
		if (state === 'draft') return ['bi-pencil-square', 'Draft. Only admins can see it until it is published.'];
		return null;
	}

	function wirePageHead() {
		const primaryActions = { remind: sendReminder, publish: publishNow };
		pageHead.primary.addEventListener('click', () => {
			if (pageHead.primary.getAttribute('aria-busy') === 'true') return;
			(primaryActions[pageHead.primary.dataset.adAct] || restoreNow)();
		});

		const menuActions = {
			pin: flipPin,
			copy: copyAddress,
			duplicate: duplicateAsDraft,
			archive: archiveNow,
			delete: () => bootstrap.Modal.getOrCreateInstance(pick('#ad-delete')).show(),
		};
		pageHead.menu.addEventListener('click', (event) => {
			const choice = event.target.closest('[data-ad-act]');
			if (!choice) return;
			bootstrap.Dropdown.getOrCreateInstance(pageHead.more).hide();
			const action = choice.dataset.adAct;
			menuActions[action]?.();
			if (action !== 'delete') pageHead.more.focus({ preventScroll: true });
		});

		pick('[data-ad-delete-hold]').addEventListener('basalt:confirm', () => {
			const dialog = () => bootstrap.Modal.getOrCreateInstance(pick('#ad-delete'));
			sendToServer('remove', { id: article.id }).then(
				() => {
					view.editingPost = false;
					dialog().hide();
					popToast({
						tone: 'success',
						icon: 'bi-trash3',
						title: 'Deleted',
						text: 'Taking you back to Announcements.',
					});
					setTimeout(() => {
						location.href = 'announcements.html';
					}, 1200);
				},
				() => {
					dialog().hide();
					popToast({
						tone: 'danger',
						title: 'Could not delete the post',
						text: 'Nothing was changed. Try again in a moment.',
					});
				},
			);
		});
	}

	/* Each header action changes the page first and asks the server after;
     rollbackOnError() puts things back if the server says no. */

	function sendReminder() {
		const button = pageHead.primary;
		const recipients = tallyReach().waiting.map((entry) => (isCustomerPost() ? entry[0] : entry.id));
		const [one, many] = waitingNouns();
		window.Basalt.buttonState(button, 'loading');
		sendToServer('remind', { id: article.id, recipients })
			.then(() => {
				window.Basalt.buttonState(button, 'success');
				article.remindedAt = clockNow();
				article.remindedCount = recipients.length;
				logChange('bi-bell', `reminded ${countOf(recipients.length, one, many)}`);
				paintReach();
				paintTimeline();
				popToast({
					tone: 'success',
					icon: 'bi-bell',
					title: 'Reminder sent',
					text: `Sent to ${countOf(recipients.length, one, many)} in the app${article.email ? ' and by email.' : '.'}`,
				});
				setTimeout(() => {
					window.Basalt.buttonState(button, 'idle');
					paintPageHead();
				}, 1400);
			})
			.catch(() => {
				window.Basalt.buttonState(button, 'error');
				popToast({
					tone: 'danger',
					title: 'The reminder was not sent',
					text: 'Nobody was notified. Try again in a moment.',
				});
				setTimeout(() => {
					window.Basalt.buttonState(button, 'idle');
				}, 2200);
			});
	}

	function flipPin() {
		const pinning = !article.pinned;
		article.pinned = pinning;
		const change = logChange(
			pinning ? 'bi-pin-angle' : 'bi-pin',
			pinning ? 'pinned it to the top of the list' : 'unpinned it',
		);
		paintAll();
		say(pinning ? 'Pinned to the top' : 'Unpinned');
		sendToServer('pin', { id: article.id, pinned: pinning }).catch(
			rollbackOnError(pinning ? 'pin the post' : 'unpin the post', () => {
				article.pinned = !pinning;
				forgetChange(change);
			}),
		);
	}

	function copyAddress() {
		const address = location.href.split('#')[0];
		window.Basalt.copyText?.(address).then(
			() => popToast({ tone: 'success', icon: 'bi-link-45deg', title: 'Link copied', text: article.title }),
			() => popToast({ tone: 'danger', title: 'Could not copy the link', text: address }),
		);
	}

	function duplicateAsDraft() {
		sendToServer('duplicate', { id: article.id }).then(
			() =>
				popToast({
					tone: 'success',
					icon: 'bi-copy',
					title: 'Draft created',
					text: `A copy of “${article.title}” is waiting in Drafts.`,
				}),
			() => popToast({ tone: 'danger', title: 'Could not duplicate the post', text: 'Try again in a moment.' }),
		);
	}

	function archiveNow() {
		closeOpenForms();
		article.state = 'archived';
		const change = logChange('bi-archive', 'archived it');
		paintAll();
		const takeBack = () => {
			article.state = 'live';
			forgetChange(change);
			paintAll();
			sendToServer('restore', { id: article.id }).catch(
				rollbackOnError('put the post back', () => {
					article.state = 'archived';
				}),
			);
		};
		popToast({
			tone: 'primary',
			icon: 'bi-archive',
			title: 'Archived',
			text: article.title,
			actions: [{ label: 'Undo', onClick: takeBack }],
		});
		sendToServer('archive', { id: article.id }).catch(
			rollbackOnError('archive the post', () => {
				article.state = 'live';
				forgetChange(change);
			}),
		);
	}

	/* A scheduled post or a draft goes out now, so nobody has read it yet. */
	function publishNow() {
		closeOpenForms();
		const { state, at, reads, openedShare, confirmedShare, behind } = article;
		Object.assign(article, {
			state: 'live',
			at: clockNow(),
			reads: new Map(),
			openedShare: 0,
			confirmedShare: 0,
			behind: [],
		});
		const change = logChange(
			'bi-send',
			`published it to ${describeAudience(article.audience)}${article.email ? ', in the app and by email' : ', in the app'}`,
		);
		paintAll();
		pageHead.more.focus({ preventScroll: true });
		popToast({
			tone: 'success',
			icon: 'bi-send',
			title: 'Published',
			text: `It reaches ${describeReach(article.audience)}.`,
		});
		sendToServer('publish', { id: article.id }).catch(
			rollbackOnError('publish the post', () => {
				Object.assign(article, { state, at, reads, openedShare, confirmedShare, behind });
				forgetChange(change);
			}),
		);
	}

	function restoreNow() {
		article.state = 'live';
		const change = logChange('bi-arrow-counterclockwise', 'put it back');
		paintAll();
		pageHead.more.focus({ preventScroll: true });
		popToast({
			tone: 'success',
			icon: 'bi-arrow-counterclockwise',
			title: 'Put back',
			text: `${article.title} is live again.`,
		});
		sendToServer('restore', { id: article.id }).catch(
			rollbackOnError('put the post back', () => {
				article.state = 'archived';
				forgetChange(change);
			}),
		);
	}

	function closeOpenForms() {
		if (view.editingPost) stopEditing();
		if (view.editingAudience) stopAudienceEdit();
	}

	/**
	 * Builds the handler for a refused request: run the undo, repaint and
	 * say what could not be done.
	 */
	function rollbackOnError(what, undo) {
		return () => {
			undo?.();
			paintAll();
			popToast({
				tone: 'danger',
				title: `Could not ${what}`,
				text: 'Nothing was changed. Check your connection and try again.',
			});
		};
	}

	/* The post card shows the message as its readers see it, then reactions. */

	function paintPost() {
		const forCustomers = isCustomerPost();
		const { teams } = article.audience;
		const readers = forCustomers ? 'customers' : teams.length ? joinWords(teams) : 'all staff';
		const channel = `${forCustomers ? ' in the Fieldline app' : ' in the app'}${article.email ? ' and by email.' : '.'}`;
		postCard.desc.textContent = `As ${readers}${hasGoneOut() ? ' see it' : ' will see it'}${channel}`;

		const writer = staffMember(article.writer);
		postCard.from.innerHTML = `<span data-basalt-avatar data-name="${htmlSafe(writer.name)}" aria-hidden="true" class="basalt-avatar basalt-avatar-sm"></span><span class="ad-letter-who"><span class="ad-letter-name">${htmlSafe(writer.name)}</span><span class="ad-letter-meta">${htmlSafe(writer.title)} · ${htmlSafe(longWhen(article.at))}</span></span>`;
		window.Basalt.avatars?.(postCard.from);
		postCard.heading.textContent = article.title;
		postCard.message.innerHTML = article.message;
		postCard.confirmLine.hidden = !article.ack;
		paintReactions();
	}

	/* Reactions only open once the post is live, as on the list page. */
	function paintReactions() {
		const strip = postCard.reactions;
		dropTooltips(strip);
		strip.hidden = !inFeed();
		strip.innerHTML = REACTIONS.map((reaction) => {
			const pressed = article.mine.has(reaction.key);
			const total = article.tally[reaction.key];
			return `<button data-ad-react="${reaction.key}" aria-pressed="${pressed}" aria-label="${reaction.name}, ${countOf(total, 'reaction')}" data-bs-toggle="tooltip" data-bs-title="${reaction.name}" type="button" class="ad-react"><i class="bi ${pressed ? reaction.active : reaction.idle}" aria-hidden="true"></i><span>${formatCount(total)}</span></button>`;
		}).join('');
		window.Basalt.tips?.(strip);
	}

	function dropTooltips(scope) {
		if (!window.bootstrap) return;
		for (const holder of pickAll('[data-bs-toggle="tooltip"]', scope)) {
			bootstrap.Tooltip.getInstance(holder)?.dispose();
		}
	}

	function wireReactions() {
		postCard.reactions.addEventListener('click', (event) => {
			const button = event.target.closest('[data-ad-react]');
			if (!button) return;
			const key = button.dataset.adReact;
			const adding = !article.mine.has(key);
			setReaction(key, adding);
			paintReactions();
			pick(`[data-ad-react="${key}"]`, postCard.reactions).focus({ preventScroll: true });
			sendToServer('react', { id: article.id, key, on: adding }).catch(() => {
				setReaction(key, !adding);
				paintReactions();
				popToast({ tone: 'danger', title: 'Could not save your reaction', text: 'Try again in a moment.' });
			});
		});
	}

	function setReaction(key, on) {
		if (on) {
			article.mine.add(key);
			article.tally[key] += 1;
		} else {
			article.mine.delete(key);
			article.tally[key] = Math.max(0, article.tally[key] - 1);
		}
	}

	/* The post is edited in place through a title field, a contenteditable
     body with a small toolbar and link form, and an optional note to readers. */

	function wireEditor() {
		for (const button of pickAll('[data-ad-cmd]', editor.frame)) {
			button.addEventListener('click', () => runCommand(button.dataset.adCmd));
		}
		editor.body.addEventListener('input', () => {
			keepSelection();
			editor.frame.classList.remove('is-invalid');
			editor.bodyError.hidden = true;
			editor.body.removeAttribute('aria-invalid');
		});
		for (const type of ['keyup', 'mouseup']) {
			editor.body.addEventListener(type, () => {
				keepSelection();
				reflectToolbar();
			});
		}
		editor.body.addEventListener('paste', pasteTidied);

		editor.linkButton.addEventListener('mousedown', keepSelection);
		editor.linkButton.addEventListener('click', () => toggleLinkForm(editor.linkForm.hidden));
		pick('[data-ad-link-add]').addEventListener('click', applyLink);
		pick('[data-ad-link-remove]').addEventListener('click', () => {
			toggleLinkForm(false);
			runCommand('unlink');
		});
		editor.linkInput.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				applyLink();
			} else if (event.key === 'Escape') {
				event.preventDefault();
				toggleLinkForm(false);
				bringBackSelection();
			}
		});
		editor.linkInput.addEventListener('input', () => {
			editor.linkInput.classList.remove('is-invalid');
			editor.linkError.hidden = true;
		});

		editor.title.addEventListener('input', () => {
			showTitleCount();
			editor.title.classList.remove('is-invalid');
			editor.titleError.hidden = true;
		});
		postCard.editButton.addEventListener('click', startEditing);
		pick('[data-ad-cancel]').addEventListener('click', stopEditing);
		submitOnModEnter(postCard.form, postCard.form);
		postCard.form.addEventListener('submit', saveEdit);
	}

	function startEditing() {
		view.editingPost = true;
		editor.title.value = article.title;
		editor.body.innerHTML = article.message;
		editor.notify.checked = false;
		const notes = {
			live: `Saving updates it for ${describeReach(article.audience)}.`,
			archived: 'It stays archived.',
			scheduled: `It still goes out ${inSentence(longWhen(article.at))}.`,
			draft: 'It stays a draft until you publish it.',
		};
		editor.note.textContent = notes[article.state];
		/* Only the readers of a live post can be told that it changed. */
		editor.notify.closest('.ad-field').hidden = !inFeed();
		showTitleCount();
		toggleLinkForm(false);
		savedRange = null;
		postCard.reading.hidden = true;
		postCard.editButton.hidden = true;
		postCard.form.hidden = false;
		editor.title.focus();
	}

	function stopEditing() {
		view.editingPost = false;
		postCard.form.hidden = true;
		postCard.reading.hidden = false;
		postCard.editButton.hidden = false;
		editor.title.classList.remove('is-invalid');
		editor.frame.classList.remove('is-invalid');
		editor.titleError.hidden = true;
		editor.bodyError.hidden = true;
		postCard.editButton.focus({ preventScroll: true });
	}

	function saveEdit(event) {
		event.preventDefault();
		const title = editor.title.value.trim();
		const message = tidyHtml(editor.body.innerHTML);
		let firstProblem = null;
		if (!title) {
			editor.title.classList.add('is-invalid');
			editor.titleError.hidden = false;
			firstProblem = editor.title;
		}
		if (!plainText(message)) {
			editor.frame.classList.add('is-invalid');
			editor.bodyError.hidden = false;
			editor.body.setAttribute('aria-invalid', 'true');
			firstProblem = firstProblem || editor.body;
		}
		if (firstProblem) {
			firstProblem.focus();
			return;
		}
		if (title === article.title && message === article.message) {
			stopEditing();
			return;
		}

		const previous = { title: article.title, message: article.message };
		const notify = editor.notify.checked && inFeed();
		Object.assign(article, { title, message });
		const change = logChange('bi-pencil', `edited the post${notify ? ' and told readers' : ''}`);
		stopEditing();
		paintAll();
		popToast({
			tone: 'success',
			icon: 'bi-check2',
			title: 'Post updated',
			text: notify ? 'Readers see a note that it changed.' : 'The change is live for everyone.',
		});
		sendToServer('update', { id: article.id, title, body: message, notify }).catch(
			rollbackOnError('save the post', () => {
				Object.assign(article, previous);
				forgetChange(change);
			}),
		);
	}

	function hasUnsavedText() {
		return (
			view.editingPost &&
			(editor.title.value.trim() !== article.title || tidyHtml(editor.body.innerHTML) !== article.message)
		);
	}

	function warnBeforeLeaving(event) {
		if (!hasUnsavedText()) return;
		event.preventDefault();
		event.returnValue = '';
	}

	function showTitleCount() {
		editor.titleCount.textContent = `A few words reads best. ${editor.title.value.length} of 60 characters.`;
	}

	/* The toolbar works on the last selection inside the body, which is kept
     here because clicking a button or the link field moves focus away. */
	function keepSelection() {
		const selection = window.getSelection();
		if (selection.rangeCount && editor.body.contains(selection.anchorNode))
			savedRange = selection.getRangeAt(0).cloneRange();
	}

	function bringBackSelection() {
		editor.body.focus();
		if (!savedRange || !editor.body.contains(savedRange.startContainer)) return;
		const selection = window.getSelection();
		selection.removeAllRanges();
		selection.addRange(savedRange);
	}

	function runCommand(command, value) {
		bringBackSelection();
		try {
			document.execCommand(command, false, value || null);
		} catch {
			/* An engine without this command leaves the text as it was. */
		}
		keepSelection();
		reflectToolbar();
	}

	/** Lights the toolbar buttons that match the formatting at the caret. */
	function reflectToolbar() {
		const selection = window.getSelection();
		if (!selection.rangeCount || !editor.body.contains(selection.anchorNode)) return;
		for (const button of pickAll('[data-ad-cmd][aria-pressed]', editor.frame)) {
			let active;
			try {
				active = document.queryCommandState(button.dataset.adCmd);
			} catch {
				active = false;
			}
			button.setAttribute('aria-pressed', String(active));
		}
	}

	function pasteTidied(event) {
		const clipboard = event.clipboardData;
		if (!clipboard) return;
		event.preventDefault();
		const markup = clipboard.getData('text/html');
		if (markup) document.execCommand('insertHTML', false, tidyHtml(markup));
		else document.execCommand('insertText', false, clipboard.getData('text/plain'));
	}

	/* The link button opens a one-line address form under the toolbar,
     filled in when the caret already sits inside a link. */
	function toggleLinkForm(open) {
		editor.linkForm.hidden = !open;
		editor.linkButton.setAttribute('aria-expanded', String(open));
		editor.linkError.hidden = true;
		editor.linkInput.classList.remove('is-invalid');
		if (!open) return;
		const start = savedRange?.startContainer;
		const host = start && (start.nodeType === 1 ? start : start.parentElement);
		const link = host?.closest('a');
		editor.linkInput.value = link ? link.getAttribute('href') : '';
		editor.linkInput.focus();
	}

	function applyLink() {
		const address = editor.linkInput.value.trim();
		if (!isSafeLink(address)) {
			editor.linkInput.classList.add('is-invalid');
			editor.linkError.hidden = false;
			editor.linkInput.focus();
			return;
		}
		toggleLinkForm(false);
		if (!savedRange || savedRange.collapsed) {
			bringBackSelection();
			document.execCommand(
				'insertHTML',
				false,
				`<a href="${htmlSafe(address)}">${htmlSafe(address.replace(/^mailto:/, ''))}</a>`,
			);
		} else {
			runCommand('createLink', address);
		}
		keepSelection();
	}

	function isSafeLink(href) {
		return /^(https?:\/\/|mailto:|#|[\w-]+\.html(#[\w-]*)?$)/.test(href || '');
	}

	/** Rebuilds editor or pasted HTML from the kept tags only. */
	function tidyHtml(markup) {
		const holder = document.createElement('div');
		holder.innerHTML = markup;
		return tidyChildren(holder)
			.replace(/<p>(\s|<br>)*<\/p>/g, '')
			.trim();
	}

	function tidyChildren(parent) {
		let result = '';
		for (const node of parent.childNodes) result += tidyNode(node);
		return result;
	}

	function tidyNode(node) {
		if (node.nodeType === Node.TEXT_NODE) return htmlSafe(node.textContent);
		if (node.nodeType !== Node.ELEMENT_NODE) return '';
		const inner = tidyChildren(node);
		if (node.tagName === 'DIV') return inner ? `<p>${inner}</p>` : '';
		const tag = KEPT_TAGS[node.tagName];
		if (!tag) return inner;
		if (tag === 'br') return '<br>';
		if (tag !== 'a') return `<${tag}>${inner}</${tag}>`;
		const href = node.getAttribute('href');
		return isSafeLink(href) ? `<a href="${htmlSafe(href)}">${inner}</a>` : inner;
	}

	function plainText(markup) {
		const holder = document.createElement('div');
		holder.innerHTML = markup;
		return holder.textContent.trim();
	}

	/* The reach card draws a ring, then a bar per team or one for accounts. */

	function paintReach() {
		reachCard.card.hidden = !hasGoneOut();
		if (!hasGoneOut()) return;
		const figures = tallyReach();
		reachCard.ring.innerHTML = ringMarkup(figures);
		if (isCustomerPost()) paintAccountReach(figures);
		else paintTeamReach(figures);

		const [one, many] = waitingNouns();
		let reminder = '';
		if (article.remindedAt)
			reminder = `Last reminder went to ${countOf(article.remindedCount, one, many)} ${inSentence(longWhen(article.remindedAt))}.`;
		else if (inFeed() && figures.waiting.length) reminder = 'No reminders sent yet.';
		reachCard.reminder.textContent = reminder;
		reachCard.reminder.hidden = !reachCard.reminder.textContent.trim();
	}

	/* Customers confirm per account, so confirming gets a bar of its own. */
	function paintAccountReach(figures) {
		const confirmNote = article.ack
			? `, ${percent(figures.confirmed, figures.accounts)}% of accounts confirmed.`
			: '.';
		reachCard.desc.textContent = `${percent(figures.read, figures.total)}% of ${formatCount(figures.total)} people have opened it${confirmNote}`;
		reachCard.subhead.hidden = !article.ack;
		reachCard.subhead.textContent = 'Confirmed';
		reachCard.bars.innerHTML = article.ack
			? teamBar(
					'Accounts',
					`${formatCount(figures.confirmed)} of ${formatCount(figures.accounts)}`,
					percent(figures.confirmed, figures.accounts),
					null,
				)
			: '';
		reachCard.restNote.hidden = true;
	}

	/* With more than TEAM_BARS teams, the ones furthest behind get bars and
     the rest are named in one line underneath. */
	function paintTeamReach(figures) {
		if (!figures.waiting.length)
			reachCard.desc.textContent = article.ack ? 'Everyone has read and confirmed it.' : 'Everyone has read it.';
		else
			reachCard.desc.textContent = `${figures.read} of ${figures.total} have read it${article.ack ? `, ${figures.confirmed} confirmed.` : '.'}`;

		const members = audienceStaff();
		let teams = [...new Set(members.map((member) => member.team))].map((name) => {
			const inTeam = members.filter((member) => member.team === name);
			return {
				name,
				size: inTeam.length,
				read: inTeam.filter((member) => hasRead(member.id)).length,
				confirmed: inTeam.filter((member) => hasConfirmed(member.id)).length,
			};
		});
		const crowded = teams.length > TEAM_BARS;
		let others = [];
		if (crowded) {
			const progress = (team) => (article.ack ? team.confirmed : team.read) / team.size;
			teams.sort((a, b) => progress(a) - progress(b) || b.size - a.size);
			others = teams.slice(TEAM_BARS).map((team) => team.name);
			teams = teams.slice(0, TEAM_BARS);
		}
		reachCard.subhead.hidden = false;
		reachCard.subhead.textContent = crowded ? 'Teams furthest behind' : 'By team';
		reachCard.restNote.hidden = !crowded;
		reachCard.restNote.textContent = crowded ? `${joinWords(others)} are further along.` : '';
		reachCard.bars.innerHTML = teams
			.map((team) =>
				teamBar(
					team.name,
					`${team.read} of ${team.size} read`,
					percent(team.read, team.size),
					article.ack ? percent(team.confirmed, team.size) : null,
				),
			)
			.join('');
	}

	/**
	 * The ring and its legend. A staff post that asks for confirmation
	 * splits into confirmed and read-only; anything else shows read
	 * (opened, for customers) against not yet.
	 */
	function ringMarkup(figures) {
		const forCustomers = isCustomerPost();
		const split = article.ack && !forCustomers;
		const circumference = 2 * Math.PI * 46;
		const segments = split
			? [
					['confirmed', figures.confirmed],
					['read', figures.read - figures.confirmed],
				]
			: [['read-only', figures.read]];
		let drawn = 0;
		let arcs = '';
		for (const [tone, amount] of segments) {
			const length = figures.total ? (amount / figures.total) * circumference : 0;
			if (length)
				arcs += `<circle cx="60" cy="60" r="46" stroke-dasharray="${length.toFixed(2)} ${circumference.toFixed(2)}" stroke-dashoffset="${(-drawn).toFixed(2)}" class="ad-ring-arc ad-ring-arc-${tone}"></circle>`;
			drawn += length;
		}

		const verb = forCustomers ? 'opened' : 'read';
		const unopened = ['none', 'Not opened', figures.total - figures.read];
		const legend = split
			? [
					['confirmed', 'Confirmed', figures.confirmed],
					['read', 'Read, not confirmed', figures.read - figures.confirmed],
					unopened,
				]
			: [['read-only', forCustomers ? 'Opened' : 'Read', figures.read], unopened];
		const keyRows = legend
			.map(
				([tone, label, amount]) =>
					`<li><span class="ad-key ad-key-${tone}" aria-hidden="true"></span><span class="ad-legend-label">${label}</span><span class="ad-legend-n">${formatCount(amount)}</span></li>`,
			)
			.join('');
		const readShare = percent(figures.read, figures.total);
		const spoken = `${readShare}% ${verb}${split ? `, ${percent(figures.confirmed, figures.total)}% confirmed` : ''}`;

		return [
			`<div role="img" aria-label="${spoken}" class="ad-ring">`,
			`<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="46" class="ad-ring-track"></circle>${arcs}</svg>`,
			`<span aria-hidden="true" class="ad-ring-center"><span class="ad-ring-value">${readShare}%</span><span class="ad-ring-label">${verb}</span></span>`,
			`</div><ul class="ad-legend">${keyRows}</ul>`,
		].join('');
	}

	/** One labeled bar; confirmedShare is null when there is nothing to confirm. */
	function teamBar(name, note, readShare, confirmedShare) {
		const fill =
			confirmedShare == null
				? `<span style="width:${readShare}%" class="ad-bar-read-only"></span>`
				: `<span style="width:${readShare}%" class="ad-bar-read"></span><span style="width:${confirmedShare}%" class="ad-bar-confirmed"></span>`;
		return `<li class="ad-team"><p class="ad-team-line"><span class="ad-team-name">${htmlSafe(name)}</span><span class="ad-team-n">${htmlSafe(note)}</span></p><div aria-hidden="true" class="ad-bar">${fill}</div></li>`;
	}

	/* The readers card lists who is still to read or confirm, or everyone it
     went to; customer posts list the accounts furthest behind instead. */

	function wireReaders() {
		readersCard.switcher.addEventListener('change', (event) => {
			if (!event.target.matches('[data-ad-filter]')) return;
			view.readerFilter = event.target.value;
			view.showAllReaders = false;
			paintReaders();
			pick('[data-ad-filter]:checked', readersCard.switcher)?.focus({ preventScroll: true });
		});
		readersCard.toggle.addEventListener('click', () => {
			window.Basalt.slide(readersCard.table.parentElement, () => {
				view.showAllReaders = !view.showAllReaders;
				paintReaders();
			});
			readersCard.toggle.focus({ preventScroll: true });
		});
	}

	function paintReaders() {
		readersCard.card.hidden = !hasGoneOut();
		if (!hasGoneOut()) return;
		if (isCustomerPost()) {
			paintAccounts();
			return;
		}

		const figures = tallyReach();
		readersCard.heading.textContent = 'Readers';
		readersCard.desc.textContent = article.audience.teams.length
			? `Everyone it went to, ${countOf(figures.total, 'person', 'people')} in ${describeAudience(article.audience)}.`
			: `Everyone it went to, all ${figures.total} staff.`;
		readersCard.caption.textContent = 'People this post went to, with when they read and confirmed it';
		readersCard.columns.innerHTML = headRow([
			['Person'],
			['Team', 'ad-col-team'],
			['Status'],
			['Read', 'ad-col-when'],
		]);
		readersCard.switcher.hidden = false;
		buildSwitcherOnce();
		pick('[data-ad-n="waiting"]', readersCard.switcher).textContent = figures.waiting.length;
		pick('[data-ad-n="everyone"]', readersCard.switcher).textContent = figures.total;

		const ordered = sortedReaders();
		const visible = view.showAllReaders ? ordered : ordered.slice(0, FIRST_ROWS);
		readersCard.rows.innerHTML = visible.map(readerRow).join('');
		window.Basalt.avatars?.(readersCard.rows);

		const nobody = !ordered.length;
		readersCard.table.hidden = nobody;
		readersCard.empty.hidden = !nobody;
		readersCard.empty.innerHTML = nobody
			? emptyNote(
					'Nobody left to wait for',
					article.ack ? 'Everyone has read and confirmed it.' : 'Everyone has read it.',
				)
			: '';
		readersCard.foot.hidden = ordered.length <= FIRST_ROWS;
		if (ordered.length <= FIRST_ROWS) return;
		readersCard.footNote.textContent = view.showAllReaders
			? `Showing all ${ordered.length} people.`
			: `Showing ${FIRST_ROWS} of ${ordered.length} people.`;
		readersCard.toggle.textContent = view.showAllReaders ? 'Show fewer' : `Show all ${ordered.length}`;
		readersCard.toggle.setAttribute('aria-expanded', String(view.showAllReaders));
	}

	/* The switch is drawn once so its sliding thumb survives; afterwards
     only its two counts change. */
	function buildSwitcherOnce() {
		const switcher = readersCard.switcher;
		if (switcher.children.length) return;
		const options = [
			['waiting', 'Still waiting'],
			['everyone', 'Everyone'],
		];
		switcher.innerHTML = options
			.map(
				([value, label]) =>
					`<input data-ad-filter type="radio" name="adFilter" id="ad-filter-${value}" value="${value}" class="btn-check"${view.readerFilter === value ? ' checked' : ''}><label for="ad-filter-${value}" class="basalt-segmented-option">${label} <span data-ad-n="${value}" class="ad-seg-n"></span></label>`,
			)
			.join('');
		window.Basalt.buttons?.(switcher.parentElement);
	}

	/* Still waiting puts the unopened first, then sorts by team and name;
     everyone puts the latest readers first. */
	function sortedReaders() {
		const everyone = audienceStaff();
		if (view.readerFilter === 'waiting') {
			return everyone
				.filter((member) => !isSettled(member.id))
				.sort(
					(a, b) =>
						hasRead(a.id) - hasRead(b.id) || a.team.localeCompare(b.team) || a.name.localeCompare(b.name),
				);
		}
		const readTime = (member) => (hasRead(member.id) ? article.reads.get(member.id).readAt.getTime() : -Infinity);
		return everyone.slice().sort((a, b) => readTime(b) - readTime(a) || a.name.localeCompare(b.name));
	}

	function readerRow(member) {
		const read = article.reads.get(member.id);
		const shownName = member.id === SAMPLE.viewerId ? `${member.name} (you)` : member.name;
		const when = read
			? `<time datetime="${read.readAt.toISOString()}">${htmlSafe(shortWhen(read.readAt))}</time>`
			: '<span class="ad-quiet">Not yet</span>';
		const person = `<div class="ad-who"><span data-basalt-avatar data-name="${htmlSafe(member.name)}" aria-hidden="true" class="basalt-avatar basalt-avatar-sm"></span><span class="ad-who-text"><a href="employee-details.html" class="ad-who-name">${htmlSafe(shownName)}</a><span class="ad-who-meta">${htmlSafe(member.title)}<span class="ad-who-team"> · ${htmlSafe(member.team)}</span></span></span></div>`;
		return `<tr${view.arrivals.has(member.id) ? ' class="is-new"' : ''}><td>${person}</td><td class="ad-col-team">${htmlSafe(member.team)}</td><td>${readerBadge(member.id)}</td><td class="ad-col-when">${when}</td></tr>`;
	}

	function readerBadge(id) {
		let tone = 'success';
		let label = article.ack ? 'Confirmed' : 'Read';
		if (!hasRead(id)) [tone, label] = ['warning', 'Not opened'];
		else if (article.ack && !hasConfirmed(id)) [tone, label] = ['info', 'Not confirmed'];
		return `<span class="basalt-status basalt-status-dot basalt-status-${tone}">${label}</span>`;
	}

	/* A customer post can reach thousands of people, so the card shows the
     accounts where the fewest have opened it. */
	function paintAccounts() {
		const accounts = article.behind;
		readersCard.heading.textContent = 'Accounts furthest behind';
		readersCard.desc.textContent = accounts.length ? 'Where the fewest people have opened it.' : '';
		readersCard.caption.textContent = 'The accounts where the fewest people have opened this post';
		readersCard.columns.innerHTML = headRow([['Account'], ['Plan', 'ad-col-team'], ['Opened', 'ad-col-opened']]);
		readersCard.switcher.hidden = true;
		readersCard.rows.innerHTML = accounts
			.map(
				([name, plan, opened, people]) =>
					`<tr><td><div class="ad-who"><span data-basalt-avatar data-name="${htmlSafe(name)}" aria-hidden="true" class="basalt-avatar basalt-avatar-sm basalt-avatar-rounded"></span><span class="ad-who-text"><a href="company-details.html" class="ad-who-name">${htmlSafe(name)}</a><span class="ad-who-meta ad-who-team">${htmlSafe(plan)}</span></span></div></td><td class="ad-col-team">${htmlSafe(plan)}</td><td class="ad-col-opened"><span class="ad-opened"><span aria-hidden="true" class="ad-bar"><span style="width:${percent(opened, people)}%" class="ad-bar-read-only"></span></span><span class="ad-opened-n">${opened} of ${people}</span></span></td></tr>`,
			)
			.join('');
		window.Basalt.avatars?.(readersCard.rows);
		readersCard.table.hidden = !accounts.length;
		readersCard.empty.hidden = Boolean(accounts.length);
		readersCard.empty.innerHTML = accounts.length
			? ''
			: emptyNote('No accounts stand out', 'Every account is opening it at about the same rate.');
		readersCard.foot.hidden = true;
	}

	function headRow(columns) {
		const cells = columns.map(
			([label, className]) => `<th scope="col"${className ? ` class="${className}"` : ''}>${label}</th>`,
		);
		return `<tr>${cells.join('')}</tr>`;
	}

	function emptyNote(title, text) {
		return `<div class="basalt-empty basalt-empty-compact ad-empty"><span aria-hidden="true" class="ad-empty-icon"><i class="bi bi-check2-all"></i></span><h3 class="basalt-empty-title">${title}</h3><p class="basalt-empty-text">${text}</p></div>`;
	}

	/* The audience card lists facts, and becomes a single form while editing. */

	function paintAudience() {
		const audience = article.audience;
		const base = SAMPLE.customerBase;
		const archiveDay = readStamp(article.until);
		const reachNote = `<span class="ad-fact-note">${htmlSafe(describeReach(audience))}</span>`;
		const facts = [];
		if (audience.who === 'staff') {
			facts.push(['Teams', `${chipList(audience.teams.length ? audience.teams : ['All staff'])}${reachNote}`]);
		} else {
			facts.push(
				['Customers', `${chipList(audience.roles.map((role) => base.roles[role].name))}${reachNote}`],
				[
					'Plans',
					audience.plans.length === Object.keys(base.plans).length ? 'Every plan' : chipList(audience.plans),
				],
				[
					'Regions',
					audience.regions.length === Object.keys(base.regions).length
						? 'Every region'
						: chipList(audience.regions),
				],
			);
		}
		const sentLabel = { scheduled: 'Goes out', draft: 'Last edited' }[article.state] || 'Published';
		facts.push(
			[sentLabel, htmlSafe(longWhen(article.at))],
			['Delivery', article.email ? 'In the app and by email' : 'In the app only'],
		);
		let confirmation = 'Not asked';
		if (article.ack)
			confirmation =
				audience.who === 'staff' ? 'Readers confirm they have read it' : 'Each account confirms it has read it';
		facts.push(['Confirmation', confirmation]);
		if (article.state !== 'archived') facts.push(['Pinned', article.pinned ? 'At the top of the list' : 'No']);
		let comments = 'Off';
		if (article.comments) comments = audience.who === 'staff' ? 'On for the team' : 'On, only the team sees them';
		facts.push(
			['Comments', comments],
			[
				article.state === 'archived' ? 'Archived' : 'Archive on',
				archiveDay ? htmlSafe(fullDate(archiveDay)) : 'Not set',
			],
		);
		audienceCard.facts.innerHTML = facts
			.map(([term, detail]) => `<div class="ad-fact"><dt>${term}</dt><dd>${detail}</dd></div>`)
			.join('');
		audienceCard.editButton.hidden = article.state === 'archived' || view.editingAudience;
	}

	function chipList(labels) {
		return `<span class="ad-chips">${labels.map((label) => `<span class="ad-chip">${htmlSafe(label)}</span>`).join('')}</span>`;
	}

	function wireAudience() {
		audienceCard.editButton.addEventListener('click', startAudienceEdit);
		pick('[data-ad-aud-cancel]').addEventListener('click', stopAudienceEdit);
		audienceCard.pickers.addEventListener('change', (event) => {
			const fieldset = event.target.closest('[data-ad-group]');
			if (fieldset) pick('.ad-error', fieldset).hidden = true;
			previewReach();
		});
		audienceCard.archiveDay.addEventListener('input', () => {
			audienceCard.archiveError.hidden = true;
			audienceCard.archiveDay.classList.remove('is-invalid');
		});
		for (const input of [audienceCard.sendDate, audienceCard.sendTime]) {
			input.addEventListener('input', () => {
				audienceCard.sendError.hidden = true;
				audienceCard.sendDate.classList.remove('is-invalid');
				audienceCard.sendTime.classList.remove('is-invalid');
			});
		}
		audienceCard.form.addEventListener('submit', saveAudience);
	}

	/* The form covers who it goes to, the option switches, the send time
     (a scheduled post only) and the archive day. */
	function startAudienceEdit() {
		view.editingAudience = true;
		buildPickers();
		for (const input of pickAll('[data-ad-o]', audienceCard.form)) {
			const key = input.dataset.adO;
			if (input.type === 'checkbox') input.checked = !!article[key];
			else input.value = article[key] || '';
		}
		/* Pinning only means something for a post that is in the feed. */
		pick('[data-ad-o="pinned"]', audienceCard.form).closest('.form-check').hidden = !inFeed();
		audienceCard.archiveDay.min = dateValue(new Date(clockNow().getTime() + DAY_MS));
		audienceCard.sendField.hidden = article.state !== 'scheduled';
		audienceCard.sendDate.min = dateValue(clockNow());
		audienceCard.sendDate.value = dateValue(article.at);
		audienceCard.sendTime.value = `${twoDigits(article.at.getHours())}:${twoDigits(article.at.getMinutes())}`;
		audienceCard.archiveError.hidden = true;
		audienceCard.sendError.hidden = true;
		for (const input of [audienceCard.archiveDay, audienceCard.sendDate, audienceCard.sendTime]) {
			input.classList.remove('is-invalid');
		}
		previewReach();
		audienceCard.facts.hidden = true;
		audienceCard.editButton.hidden = true;
		audienceCard.form.hidden = false;
		pick('input', audienceCard.pickers).focus();
	}

	function stopAudienceEdit() {
		view.editingAudience = false;
		audienceCard.form.hidden = true;
		audienceCard.facts.hidden = false;
		audienceCard.editButton.hidden = false;
		audienceCard.editButton.focus({ preventScroll: true });
	}

	/* Teams for a staff post; roles, plans and regions for a customer post. */
	function buildPickers() {
		const audience = article.audience;
		const base = SAMPLE.customerBase;
		const teams = SAMPLE.pickableTeams;
		const fieldsets =
			audience.who === 'staff'
				? [
						pickerSet(
							'teams',
							'Teams',
							checkboxGrid(
								'adTeam',
								teams.map((team) => [team, team]),
								audience.teams.length ? audience.teams : teams,
							),
							'Pick at least one team.',
						),
					]
				: [
						pickerSet(
							'roles',
							'Customers',
							checkboxGrid(
								'adRole',
								Object.entries(base.roles).map(([role, info]) => [role, info.name, info.hint]),
								audience.roles,
							),
							'Pick who should see it.',
						),
						pickerSet(
							'plans',
							'Plans',
							checkboxGrid(
								'adPlan',
								Object.keys(base.plans).map((plan) => [plan, plan]),
								audience.plans,
							),
							'Pick at least one plan.',
						),
						pickerSet(
							'regions',
							'Regions',
							checkboxGrid(
								'adRegion',
								Object.keys(base.regions).map((region) => [region, region]),
								audience.regions,
							),
							'Pick at least one region.',
						),
					];
		audienceCard.pickers.innerHTML = `${fieldsets.join('')}<p data-ad-reach aria-live="polite" class="ad-note"></p>`;
	}

	function pickerSet(key, legend, inner, error) {
		return `<fieldset data-ad-group="${key}" class="ad-field"><legend class="form-label">${legend}</legend>${inner}<p class="ad-error" hidden>${error}</p></fieldset>`;
	}

	/** Checkboxes from [value, label, hint] rows, ticking the chosen values. */
	function checkboxGrid(name, rows, chosen) {
		const boxes = rows.map(([value, label, hint], place) => {
			const id = `${name}${place}`;
			const extra = hint ? `<span class="ad-check-hint">${htmlSafe(hint)}</span>` : '';
			return `<div class="form-check"><input type="checkbox" name="${name}" id="${id}" value="${htmlSafe(value)}" class="form-check-input"${chosen.includes(value) ? ' checked' : ''}><label for="${id}" class="form-check-label">${htmlSafe(label)}${extra}</label></div>`;
		});
		return `<div class="ad-checks">${boxes.join('')}</div>`;
	}

	function checkedValues(name) {
		return pickAll(`input[name="${name}"]:checked`, audienceCard.pickers).map((input) => input.value);
	}

	/**
	 * The audience the form describes, and the groups left empty. Ticking
	 * every team is the same as all staff.
	 */
	function audienceFromForm() {
		if (article.audience.who === 'staff') {
			const teams = checkedValues('adTeam');
			return {
				audience: { who: 'staff', teams: teams.length === SAMPLE.pickableTeams.length ? [] : teams },
				missing: teams.length ? [] : ['teams'],
			};
		}
		const audience = {
			who: 'customers',
			roles: checkedValues('adRole'),
			plans: checkedValues('adPlan'),
			regions: checkedValues('adRegion'),
		};
		return { audience, missing: ['roles', 'plans', 'regions'].filter((key) => !audience[key].length) };
	}

	function previewReach() {
		const { audience, missing } = audienceFromForm();
		pick('[data-ad-reach]', audienceCard.pickers).textContent = missing.length
			? ''
			: `Reaches ${describeReach(audience)}.`;
	}

	function saveAudience(event) {
		event.preventDefault();
		const { audience, missing } = audienceFromForm();
		const options = {};
		for (const input of pickAll('[data-ad-o]', audienceCard.form)) {
			options[input.dataset.adO] = input.type === 'checkbox' ? input.checked : input.value;
		}

		let firstProblem = null;
		for (const key of missing) {
			const fieldset = pick(`[data-ad-group="${key}"]`, audienceCard.pickers);
			pick('.ad-error', fieldset).hidden = false;
			firstProblem = firstProblem || pick('input', fieldset);
		}
		let sendAt = article.at;
		if (article.state === 'scheduled') {
			const { sendDate, sendTime } = audienceCard;
			sendAt = sendDate.value && sendTime.value ? readStamp(`${sendDate.value} ${sendTime.value}`) : null;
			if (!sendAt || sendAt <= clockNow()) {
				audienceCard.sendError.hidden = false;
				sendDate.classList.add('is-invalid');
				sendTime.classList.add('is-invalid');
				firstProblem = firstProblem || sendDate;
			}
		}
		if (options.until && options.until < audienceCard.archiveDay.min) {
			audienceCard.archiveError.hidden = false;
			audienceCard.archiveDay.classList.add('is-invalid');
			firstProblem = firstProblem || audienceCard.archiveDay;
		}
		if (firstProblem) {
			firstProblem.focus();
			return;
		}

		const summary = describeChanges(audience, sendAt, options);
		if (!summary.length) {
			stopAudienceEdit();
			return;
		}
		const { ack, pinned, comments, email, until } = article;
		const previous = { audience: article.audience, at: article.at, ack, pinned, comments, email, until };
		Object.assign(article, options, { audience, at: sendAt });
		const change = logChange('bi-sliders', joinWords(summary));
		stopAudienceEdit();
		paintAll();
		popToast({ tone: 'success', icon: 'bi-check2', title: 'Saved', text: 'Audience and delivery updated.' });
		sendToServer('update', { id: article.id, audience, at: sendAt, ...options }).catch(
			rollbackOnError('save the audience', () => {
				Object.assign(article, previous);
				forgetChange(change);
			}),
		);
	}

	/** Each difference between the post and the form, worded for the history. */
	function describeChanges(audience, sendAt, options) {
		const said = [];
		if (JSON.stringify(audience) !== JSON.stringify(article.audience))
			said.push(`changed the audience to ${describeAudience(audience)}`);
		if (sendAt.getTime() !== article.at.getTime()) said.push(`moved it to ${longWhen(sendAt)}`);
		const toggles = [
			['ack', 'asked readers to confirm', 'stopped asking readers to confirm'],
			['pinned', 'pinned it', 'unpinned it'],
			['comments', 'turned comments on', 'turned comments off'],
			['email', 'turned on email', 'turned off email'],
		];
		for (const [key, turnedOn, turnedOff] of toggles) {
			if (options[key] !== article[key]) said.push(options[key] ? turnedOn : turnedOff);
		}
		if (options.until !== article.until)
			said.push(
				options.until
					? `set it to archive on ${monthDay(readStamp(options.until))}`
					: 'cleared the archive date',
			);
		return said;
	}

	/* The comment card holds the thread, the reply target and the composer. */

	function wireComments() {
		thread.list.addEventListener('click', (event) => {
			const reply = event.target.closest('[data-ad-reply]');
			if (reply) {
				view.replyingTo = reply.dataset.adReply;
				paintReplyTarget();
				thread.input.focus();
				return;
			}
			const remove = event.target.closest('[data-ad-cdel]');
			if (remove) removeComment(remove.dataset.adCdel);
		});
		thread.target.addEventListener('click', (event) => {
			if (!event.target.closest('[data-ad-reply-cancel]')) return;
			view.replyingTo = null;
			paintReplyTarget();
			thread.input.focus();
		});
		thread.input.addEventListener('input', () => {
			thread.error.hidden = true;
			thread.input.classList.remove('is-invalid');
		});
		submitOnModEnter(thread.input, thread.form);
		thread.form.addEventListener('submit', addComment);
	}

	function paintComments() {
		const total = article.discussion.length;
		let summary = 'Comments are off. Earlier ones stay here.';
		if (article.comments)
			summary = total
				? `${countOf(total, 'comment')} from the team, oldest first.`
				: 'No comments yet. Start the conversation.';
		thread.desc.textContent = summary;
		thread.list.hidden = !total;
		thread.list.innerHTML = article.discussion.map((comment) => commentItem(comment)).join('');
		window.Basalt.avatars?.(thread.list);
		thread.form.hidden = !article.comments;
		paintReplyTarget();
	}

	function commentItem(comment) {
		const author = staffMember(comment.by);
		const mine = comment.by === SAMPLE.viewerId;
		const parent = comment.replyTo ? article.discussion.find((other) => other.id === comment.replyTo) : null;
		const answering = parent
			? `<p class="ad-comment-re"><i class="bi bi-reply" aria-hidden="true"></i>Replying to ${htmlSafe(parent.by === SAMPLE.viewerId ? 'you' : staffMember(parent.by).name)}</p>`
			: '';
		const buttons = [
			article.comments
				? `<button data-ad-reply="${htmlSafe(comment.id)}" type="button" class="btn btn-link btn-sm ad-link">Reply</button>`
				: '',
			mine
				? `<button data-ad-cdel="${htmlSafe(comment.id)}" type="button" class="btn btn-link btn-sm ad-link">Delete</button>`
				: '',
		].join('');
		const head = `<p class="ad-comment-head"><span class="ad-comment-name">${htmlSafe(mine ? 'You' : author.name)}</span><time datetime="${comment.at.toISOString()}">${htmlSafe(longWhen(comment.at))}</time></p>`;
		return [
			`<li class="ad-comment${comment.isNew ? ' is-new' : ''}">`,
			`<span data-basalt-avatar data-name="${htmlSafe(author.name)}" aria-hidden="true" class="basalt-avatar basalt-avatar-sm"></span>`,
			`<div class="ad-comment-body">${head}${answering}<p class="ad-comment-text">${htmlSafe(comment.text)}</p><div class="ad-comment-actions">${buttons}</div></div>`,
			'</li>',
		].join('');
	}

	function paintReplyTarget() {
		const target = view.replyingTo && article.discussion.find((comment) => comment.id === view.replyingTo);
		thread.target.hidden = !target;
		thread.target.innerHTML = target
			? `<i class="bi bi-reply" aria-hidden="true"></i>Replying to ${htmlSafe(target.by === SAMPLE.viewerId ? 'yourself' : staffMember(target.by).name)}<button data-ad-reply-cancel type="button" class="btn btn-link btn-sm ad-link">Cancel</button>`
			: '';
	}

	function addComment(event) {
		event.preventDefault();
		const text = thread.input.value.trim();
		if (!text) {
			thread.error.hidden = false;
			thread.input.classList.add('is-invalid');
			thread.input.focus();
			return;
		}
		const comment = {
			id: `c${commentSerial++}`,
			by: SAMPLE.viewerId,
			at: clockNow(),
			text,
			replyTo: view.replyingTo,
			isNew: true,
		};
		article.discussion.push(comment);
		view.replyingTo = null;
		thread.input.value = '';
		paintComments();
		say('Comment added');
		sendToServer('comment', { id: article.id, text, replyTo: comment.replyTo }).catch(
			rollbackOnError('add your comment', () => {
				article.discussion = article.discussion.filter((other) => other !== comment);
				thread.input.value = text;
			}),
		);
	}

	/* Deleting is undoable from the toast, and undone for you if the
     server refuses. Either way the comment returns to its old place. */
	function removeComment(commentId) {
		const place = article.discussion.findIndex((comment) => comment.id === commentId);
		if (place < 0) return;
		const [removed] = article.discussion.splice(place, 1);
		removed.isNew = false;
		paintComments();
		thread.input.focus();
		const putBack = () => {
			article.discussion.splice(Math.min(place, article.discussion.length), 0, removed);
			paintComments();
		};
		popToast({
			tone: 'primary',
			icon: 'bi-trash3',
			title: 'Comment deleted',
			actions: [{ label: 'Undo', onClick: putBack }],
		});
		sendToServer('uncomment', { id: article.id, commentId }).catch(rollbackOnError('delete the comment', putBack));
	}

	/* The history card lists every change to the post, newest first. */

	function logChange(icon, text) {
		const change = { at: clockNow(), by: SAMPLE.viewerId, icon, text };
		article.changes.unshift(change);
		return change;
	}

	function forgetChange(change) {
		article.changes = article.changes.filter((other) => other !== change);
	}

	function paintTimeline() {
		timeline.innerHTML = article.changes
			.map((change) => {
				const who = change.by === SAMPLE.viewerId ? 'You' : staffMember(change.by).name;
				return `<li class="ad-feed-item"><span aria-hidden="true" class="ad-feed-icon"><i class="bi ${change.icon}"></i></span><div><p class="ad-feed-text"><strong>${htmlSafe(who)}</strong> ${htmlSafe(change.text)}</p><p class="ad-feed-when"><time datetime="${change.at.toISOString()}">${htmlSafe(longWhen(change.at))}</time></p></div></li>`;
			})
			.join('');
	}

	/* A simulated reader can open the post while the page is showing it. */

	function scheduleLiveReads() {
		for (const visit of SAMPLE.liveReads) {
			if (visit.post !== article.id) continue;
			setTimeout(() => recordLiveRead(visit.reader, visit.confirms), visit.afterSeconds * 1000);
		}
	}

	function recordLiveRead(readerId, confirms) {
		if (!inFeed() || hasRead(readerId) || !audienceStaff().some((member) => member.id === readerId)) return;
		const moment = clockNow();
		article.reads.set(readerId, { readAt: moment, confirmedAt: confirms ? moment : null });
		view.arrivals.add(readerId);
		paintPageHead();
		paintReach();
		paintReaders();
		say(`${staffMember(readerId).name} just ${confirms && article.ack ? 'read and confirmed' : 'read'} the post`);
	}

	/* The demo clock starts at SAMPLE.pretendNow and runs on from there;
     a real install swaps clockNow() for new Date(). */

	/** Reads a "YYYY-MM-DD HH:MM" stamp (time optional) as local time. */
	function readStamp(stamp) {
		if (!stamp) return null;
		const [day, time = '00:00'] = String(stamp).split(' ');
		const [year, month, date] = day.split('-').map(Number);
		const [hours, minutes] = time.split(':').map(Number);
		return new Date(year, month - 1, date, hours, minutes);
	}

	function clockNow() {
		return new Date(pretendStart.getTime() + (Date.now() - openedAt));
	}

	function midnight(date) {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
	}

	/** Whole days from the date to today: 1 is yesterday, -1 tomorrow. */
	function daysBefore(date) {
		return Math.round((midnight(clockNow()) - midnight(date)) / DAY_MS);
	}

	function twoDigits(number) {
		return String(number).padStart(2, '0');
	}

	function clockText(date) {
		const hours = date.getHours();
		return `${hours % 12 || 12}:${twoDigits(date.getMinutes())} ${hours < 12 ? 'am' : 'pm'}`;
	}

	function monthDay(date) {
		return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
	}

	/** "Today at 9:15 am", "Tomorrow at 9:00 am" or "Wed, Sep 30 at 3:40 pm". */
	function longWhen(date) {
		const near = { 0: 'Today', 1: 'Yesterday', '-1': 'Tomorrow' }[daysBefore(date)];
		return near
			? `${near} at ${clockText(date)}`
			: `${WEEKDAY_NAMES[date.getDay()]}, ${monthDay(date)} at ${clockText(date)}`;
	}

	/** The shorter table form: "Today, 9:40 am" or "Oct 1, 11:34 am". */
	function shortWhen(date) {
		const near = { 0: 'Today', 1: 'Yesterday' }[daysBefore(date)];
		return `${near || monthDay(date)}, ${clockText(date)}`;
	}

	function fullDate(date) {
		return `${WEEKDAY_NAMES[date.getDay()]}, ${monthDay(date)}, ${date.getFullYear()}`;
	}

	/** The value a date input expects: YYYY-MM-DD. */
	function dateValue(date) {
		return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
	}

	/** Lowercases a leading Today, Yesterday or Tomorrow for mid-sentence use. */
	function inSentence(text) {
		return /^(Today|Yesterday|Tomorrow)/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
	}

	/* Small helpers used throughout the file. */

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

	function formatCount(value) {
		return Number(value).toLocaleString('en-US');
	}

	/** "1 person", "12 people", "3 comments". */
	function countOf(amount, singular, pluralForm) {
		return `${formatCount(amount)} ${amount === 1 ? singular : pluralForm || `${singular}s`}`;
	}

	function percent(part, whole) {
		return whole ? Math.round((part / whole) * 100) : 0;
	}

	/** "A", "A and B", "A, B and C". */
	function joinWords(words) {
		if (words.length < 2) return words.join('');
		return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
	}

	/** Ctrl+Enter, or Cmd+Enter on a Mac, inside target submits the form. */
	function submitOnModEnter(target, form) {
		target.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
			event.preventDefault();
			form.requestSubmit();
		});
	}

	function say(text) {
		if (liveRegion) liveRegion.textContent = text;
	}

	function popToast(options) {
		return window.Basalt.toasts?.push(options);
	}

	function pause(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Stands in for one request to the server: resolves after ANSWER_MS for
	 * the action, or rejects a little later under ?state=offline. The
	 * payload is what a real request would carry.
	 */
	function sendToServer(action, payload) {
		const delay = ANSWER_MS[action];
		if (!goOffline) return pause(delay);
		return pause(delay + 250).then(() => {
			throw new Error('offline');
		});
	}

	start();
})();
