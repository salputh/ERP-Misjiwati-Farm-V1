/**
 * Every Fieldline project in one place. Projects, Project Details, Teams,
 * Team Details and the timesheet pages all read these records, so a project
 * shows the same people, milestones, open work and history wherever it
 * appears. Team members are roster ids from data/multipurpose/people.js, and a customer
 * project points at an account id from data/multipurpose/accounts.js.
 *
 * Published on window.Basalt.data.projects:
 *   TODAY        the demo's fixed date, Friday, October 9, 2026
 *   list         the records, in the order the pages list them
 *   find(id)     the record with that id, or null
 *   summary(p)   the compact record the list views draw
 *   when(at)     a feed time such as "Yesterday, 4:15 pm"
 *
 * Progress is never stored. Each milestone counts the tasks already
 * finished toward it, and every task still open is listed below it, so
 * done plus open is always the true total. Swap in records from a real
 * project tool by keeping the same fields.
 */
(() => {
	'use strict';

	const TODAY = '2026-10-09';
	const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/*
	 * A record reads top to bottom as the details page does: who and what,
	 * then the goal, the milestones in date order, the open tasks as
	 * [title, milestone id, assignee, due], the files as
	 * [name, bytes, uploader, date] and the feed, newest first, as
	 * [person, icon, HTML, time]. Feed HTML is written here by hand and
	 * never built from anything a visitor types. A project that is off
	 * track says why in its note.
	 */
	const ALL_PROJECTS = [
		{
			id: 'route',
			status: 'on-track',
			name: 'Travel Planner 2.0',
			area: 'Product',
			tone: 1,
			icon: 'bi-signpost-split',
			start: '2026-08-17',
			team: ['hw', 'lm', 'nfe', 'fr'],
			goal: 'Plan each team’s day in one click: the best order of visits, live traffic, and a new plan when a visit runs late or is canceled.',
			milestones: [
				reached('spec', 'Spec signed off', '2026-09-04', 8),
				reached('pilot', 'Pilot with our own schedulers', '2026-09-25', 12),
				ahead('beta', 'Beta for 20 accounts', 'Beta', '2026-10-14', 10),
				ahead('help', 'Help articles and in-app tour', 'Help and tour', '2026-10-30', 4),
				ahead('release', 'General release', 'Release', '2026-11-17', 2),
			],
			tasks: [
				['Day map loads slowly on old phones', 'beta', 'lm', '2026-10-07'],
				['Invite the 20 beta accounts', 'beta', 'hw', '2026-10-12'],
				['Test days with more than 40 visits', 'beta', 'fr', '2026-10-13'],
				['Beta feedback form in the app', 'beta', 'nfe', '2026-10-13'],
				['Fix visit order when one is canceled', 'release', 'lm', '2026-10-16'],
				['In-app tour, first three steps', 'help', 'nfe', '2026-10-20'],
				['Write “Plan a day’s visits” article', 'help', 'hw', '2026-10-23'],
				['Screenshots for the help articles', 'help', 'nfe', '2026-10-26'],
				['Short video of re-planning a day', 'help', 'hw', '2026-10-28'],
				['Check the tour on phones', 'help', 'fr', '2026-10-29'],
				['Live traffic data for the Midwest', 'release', 'lm', '2026-11-06'],
				['Load test with 500 teams', 'release', 'lm', '2026-11-10'],
				['Release notes and customer email', 'release', 'hw', '2026-11-12'],
				['Final test pass', 'release', 'fr', '2026-11-16'],
			],
			files: [
				['Travel Planner 2.0 spec.pdf', 2400000, 'hw', '2026-09-04'],
				['Pilot results.pdf', 1100000, 'hw', '2026-09-28'],
				['Beta accounts.xlsx', 86000, 'hw', '2026-10-06'],
				['Help article outline.docx', 54000, 'hw', '2026-10-07'],
				['New day map designs.png', 3800000, 'nfe', '2026-10-09'],
			],
			feed: [
				['lm', 'bi-check2-circle', 'finished <strong>live travel times</strong>', '2026-10-09T11:05'],
				['fr', 'bi-bug', 'logged a <strong>map pin bug</strong>', '2026-10-09T09:40'],
				['nfe', 'bi-image', 'uploaded <strong>day map designs</strong>', '2026-10-09T09:15'],
				['hw', 'bi-people', 'picked the <strong>20 beta accounts</strong>', '2026-10-08T16:15'],
				[
					'hw',
					'bi-envelope',
					'invited <a href="company-details.html?id=lumoraai">Lumora AI</a> to the beta',
					'2026-10-08T11:05',
				],
				['lm', 'bi-bug', 'reported <strong>slow maps</strong> on old phones', '2026-10-07T16:30'],
				['ao', 'bi-chat-square-text', 'shared <strong>interview notes</strong>', '2026-10-06T14:30'],
				['ja', 'bi-calendar-event', 'moved the release to <strong>Nov 17</strong>', '2026-10-05T14:10'],
				['hw', 'bi-flag', 'wrapped up the <strong>pilot</strong>', '2026-09-25T17:20'],
				['hw', 'bi-flag', 'signed off the <strong>spec</strong>', '2026-09-04T15:45'],
				kickoff('hw', '2026-08-17'),
			],
		},

		{
			id: 'store',
			status: 'at-risk',
			name: 'Portal relaunch',
			area: 'Customer Portal',
			tone: 5,
			icon: 'bi-person-badge',
			start: '2026-08-24',
			team: ['dk', 'ja', 'gl', 'lo', 'pr'],
			note: 'Booking page photos slipped a week, and the self-booking page waits on them.',
			goal: 'Relaunch the Customer Portal with self-booking for new clients, saved cards and a checkout that suits accounts with several branches.',
			milestones: [
				reached('catalog', 'New booking layout', '2026-09-11', 14),
				reached('checkout', 'Checkout with saved cards', '2026-10-02', 16),
				ahead('kit', 'Self-booking page live', 'Self-booking', '2026-10-16', 6),
				ahead('email', 'Relaunch email to every account', 'Launch email', '2026-10-27', 2),
			],
			tasks: [
				['Checkout drops the PO number when a voucher is applied', 'kit', 'dk', '2026-10-08'],
				['Photograph a booking made on a customer’s phone', 'kit', 'gl', '2026-10-12'],
				['Self-booking page with a time picker', 'kit', 'dk', '2026-10-12'],
				['Check 500 booking links from the old portal', 'kit', 'lo', '2026-10-12'],
				['Booking shows the wrong length in the cart', 'kit', 'dk', '2026-10-13'],
				['Write the page copy for repeat bookings', 'kit', 'gl', '2026-10-13'],
				['Price the portal for teams', 'kit', 'ja', '2026-10-14'],
				['Booking photos load blurry on phones', 'kit', 'dk', '2026-10-15'],
				['Launch email with the three new features', 'email', 'pr', '2026-10-15'],
				['Proofread the launch email', 'email', 'pr', '2026-10-20'],
				['Book the support cover for launch weekend', 'email', 'lo', '2026-10-22'],
				['Relaunch banner on the portal home page', 'email', 'dk', '2026-10-23'],
			],
			files: [
				['Portal price sheet.xlsx', 64000, 'ja', '2026-09-28'],
				['Booking photos, first round.jpg', 2900000, 'gl', '2026-10-06'],
				['Launch email draft.docx', 48000, 'pr', '2026-10-07'],
			],
			feed: [
				['dk', 'bi-exclamation-triangle', 'flagged the <strong>photos</strong> as late', '2026-10-09T11:30'],
				['pr', 'bi-pencil', 'drafted the <strong>launch email</strong>', '2026-10-07T15:20'],
				['gl', 'bi-image', 'uploaded <strong>booking photos</strong>', '2026-10-06T15:10'],
				['dk', 'bi-flag', 'reached <strong>saved cards</strong>', '2026-10-02T16:00'],
				['ja', 'bi-check2-circle', 'finished <strong>card checkout</strong>', '2026-10-02T13:10'],
				['dk', 'bi-flag', 'reached <strong>New booking layout</strong>', '2026-09-11T14:30'],
				kickoff('dk', '2026-08-24'),
			],
		},

		{
			id: 'web',
			status: 'on-track',
			name: 'Website refresh',
			area: 'Marketing site',
			tone: 2,
			icon: 'bi-window',
			start: '2026-09-07',
			team: ['cr', 'sr', 'dk'],
			goal: 'A faster marketing site that explains Fieldline industry by industry and sends visitors to a free trial or a demo.',
			milestones: [
				reached('home', 'Homepage and menu', '2026-09-30', 7),
				ahead('pricing', 'New pricing page', 'Pricing page', '2026-10-22', 3),
				ahead('stories', 'Customer stories', 'Stories', '2026-11-06', 1),
				ahead('launch', 'Launch', null, '2026-11-16', 0),
			],
			tasks: [
				['Pricing table for Basic, Pro and Max', 'pricing', 'dk', '2026-10-16'],
				['Annual price switch on the pricing page', 'pricing', 'dk', '2026-10-19'],
				['Answers for the pricing questions', 'pricing', 'sr', '2026-10-20'],
				['Interview Highpoint Outfitters for their story', 'stories', 'sr', '2026-10-23'],
				['Customer stories page by industry', 'stories', 'sr', '2026-10-30'],
				['Compress the large photos on the home page', 'launch', 'dk', '2026-11-04'],
				['Rewrite the About page', 'launch', 'cr', '2026-11-06'],
				['Footer links overlap on small phones', 'launch', 'dk', '2026-11-10'],
				['Cookie banner in plain English', 'launch', 'cr', '2026-11-12'],
			],
			files: [
				['Homepage design.png', 3100000, 'dk', '2026-09-22'],
				['Pricing page copy.docx', 41000, 'cr', '2026-10-05'],
			],
			feed: [
				['dk', 'bi-image', 'shared <strong>pricing wireframes</strong>', '2026-10-08T14:15'],
				['cr', 'bi-pencil-square', 'wrote the <strong>pricing page copy</strong>', '2026-10-05T11:40'],
				['sr', 'bi-pencil-square', 'drafted three <strong>customer stories</strong>', '2026-10-02T16:50'],
				['cr', 'bi-flag', 'reached <strong>Homepage and menu</strong>', '2026-09-30T15:20'],
				kickoff('cr', '2026-09-07'),
			],
		},

		{
			id: 'onboard',
			status: 'on-track',
			name: 'Onboarding playbook',
			area: 'Customer team',
			tone: 3,
			icon: 'bi-journal-check',
			start: '2026-09-01',
			team: ['gl', 'cd', 'ev', 'ta'],
			goal: 'One playbook that gets every new account live inside 30 days, the same way every time.',
			milestones: [
				reached('script', 'Kick-off call script', '2026-09-18', 5),
				ahead('checklist', 'Self-serve setup checklist', 'Checklist', '2026-10-12', 4),
				ahead('videos', 'Training videos for schedulers', 'Videos', '2026-10-30', 2),
				ahead('handover', 'Handover to support', 'Handover', '2026-11-13', 1),
			],
			tasks: [
				['Kick-off form with team sizes and service areas', 'checklist', 'gl', '2026-10-12'],
				['Onboarding checklist on the account page', 'checklist', 'gl', '2026-10-12'],
				['Training schedule for October', 'videos', 'cd', '2026-10-14'],
				['Record the schedule board video', 'videos', 'cd', '2026-10-21'],
				['Record the staff app video', 'videos', 'cd', '2026-10-28'],
				['Spanish voice-over for the videos', 'videos', 'cd', '2026-10-29'],
				['Handover note template for Support', 'handover', 'ev', '2026-11-06'],
				['Agree the handover rules with Connie', 'handover', 'ta', '2026-11-10'],
			],
			files: [
				['Kick-off call script.docx', 36000, 'gl', '2026-09-18'],
				['Scheduler quick-start guide.pdf', 1400000, 'gl', '2026-10-09'],
			],
			feed: [
				['gl', 'bi-check2-circle', 'finished the <strong>quick-start guide</strong>', '2026-10-09T10:20'],
				['ev', 'bi-calendar-event', 'moved the <strong>setup checklist</strong>', '2026-10-06T14:15'],
				['cd', 'bi-person-plus', 'took over the <strong>training videos</strong>', '2026-10-05T09:00'],
				['gl', 'bi-flag', 'reached <strong>Kick-off call script</strong>', '2026-09-18T16:00'],
				kickoff('gl', '2026-09-01'),
			],
		},

		{
			id: 'sunvale',
			status: 'on-track',
			name: 'Sunvale Studios rollout',
			area: 'Customer rollout',
			tone: 4,
			icon: 'bi-camera',
			customer: { id: 'sunvale', name: 'Sunvale Studios' },
			start: '2026-09-30',
			team: ['nf', 'gl', 'ja'],
			goal: 'Get all 15 Sunvale Studios photographers booking on Fieldline before their Max trial ends on October 30.',
			milestones: [
				reached('import', 'Shoots and customers imported', '2026-10-02', 8),
				reached('training', 'Scheduler training', '2026-10-06', 9),
				reached('pilot', 'Two pilot teams live', '2026-10-08', 8),
				ahead('live', 'All 15 photographers live', 'Go live', '2026-10-19', 3),
				ahead('review', 'Trial review', 'Review', '2026-10-28', 0),
			],
			tasks: [
				['Install the app on the second wave of phones', 'live', 'nf', '2026-10-13'],
				['Train the Roseville schedulers', 'live', 'gl', '2026-10-14'],
				['Import the spring wedding bookings', 'live', 'nf', '2026-10-15'],
				['Turn on arrival-window texts', 'live', 'gl', '2026-10-16'],
				['Check timesheets after week one', 'live', 'nf', '2026-10-19'],
				['Usage report for the review', 'review', 'nf', '2026-10-26'],
				['Book the trial review call', 'review', 'ja', '2026-10-27'],
			],
			files: [
				['Sunvale customer list.csv', 240000, 'nf', '2026-10-01'],
				['Scheduler training slides.pdf', 3200000, 'gl', '2026-10-05'],
			],
			feed: [
				['nf', 'bi-flag', 'got <strong>two pilot teams</strong> live', '2026-10-08T17:40'],
				['gl', 'bi-flag', 'finished <strong>scheduler training</strong>', '2026-10-06T15:50'],
				['nf', 'bi-flag', 'imported <strong>shoots and customers</strong>', '2026-10-02T12:30'],
				[
					'nf',
					'bi-kanban',
					'started the rollout with <a href="company-details.html?id=sunvale">Sunvale Studios</a>',
					'2026-09-30T10:00',
				],
			],
		},

		{
			id: 'portal',
			status: 'at-risk',
			name: 'Customer Portal redesign',
			area: 'Product',
			tone: 6,
			icon: 'bi-person-workspace',
			start: '2026-08-03',
			team: ['lg', 'yt', 'nfe'],
			note: 'The payment provider’s new API is two weeks late, which delays Pay online.',
			goal: 'A portal where customers book a visit, see their visitor on the way, and pay the invoice in a minute.',
			milestones: [
				reached('interviews', 'Interviews with 8 customers', '2026-08-28', 4),
				reached('design', 'New design approved', '2026-09-18', 6),
				ahead('invoices', 'Invoices in the portal', 'Invoices', '2026-10-09', 3),
				ahead('pay', 'Pay online', 'Pay online', '2026-11-02', 1),
				ahead('release', 'Release', null, '2026-12-01', 0),
			],
			tasks: [
				['Invoice email links open the portal', 'invoices', 'yt', '2026-10-09'],
				['Filter invoices by branch', 'invoices', 'yt', '2026-10-12'],
				['Pay online screens', 'pay', 'nfe', '2026-10-16'],
				['Card form with the new payment API', 'pay', 'yt', '2026-10-20'],
				['Saved cards for repeat customers', 'pay', 'yt', '2026-10-27'],
				['Receipts after paying', 'pay', 'yt', '2026-10-29'],
				['Usability test with 5 customers', 'pay', 'lg', '2026-10-30'],
				['Accessibility pass on every screen', 'release', 'yt', '2026-11-13'],
				['Beta with 10 accounts', 'release', 'lg', '2026-11-16'],
				['Help articles for the new portal', 'release', 'lg', '2026-11-20'],
				['Final test pass', 'release', 'nfe', '2026-11-25'],
				['Release notes and customer email', 'release', 'lg', '2026-11-27'],
			],
			files: [
				['Customer interviews, summary.pdf', 890000, 'lg', '2026-08-28'],
				['Portal designs v3.png', 4100000, 'nfe', '2026-09-18'],
				['Pay online screens.png', 2600000, 'nfe', '2026-10-05'],
			],
			feed: [
				['yt', 'bi-check2-circle', 'finished the <strong>invoice list</strong>', '2026-10-09T10:45'],
				[
					'lg',
					'bi-exclamation-triangle',
					'flagged the <strong>payment API</strong> as late',
					'2026-10-08T15:20',
				],
				['nfe', 'bi-brush', 'shared the <strong>Pay online</strong> screens', '2026-10-05T16:40'],
				['lg', 'bi-flag', 'reached <strong>New design approved</strong>', '2026-09-18T14:00'],
				['lg', 'bi-flag', 'finished <strong>8 customer interviews</strong>', '2026-08-28T17:00'],
				kickoff('lg', '2026-08-03'),
			],
		},

		{
			id: 'eu',
			status: 'blocked',
			name: 'Midwest data region',
			area: 'Engineering',
			tone: 8,
			icon: 'bi-hdd-network',
			start: '2026-07-20',
			team: ['as', 'ds', 'ka', 'im', 'pd'],
			note: 'Waiting on the signed Kalamazoo hosting contract. Legal expects it by October 15.',
			goal: 'Keep Midwest customers’ data in Kalamazoo, so state agencies in the region can sign without a data transfer clause.',
			milestones: [
				reached('plan', 'Plan and budget approved', '2026-08-07', 6),
				ahead('contract', 'Hosting contract signed', 'Contract', '2026-10-05', 4),
				ahead('cedarrapids', 'App running in Kalamazoo', 'Kalamazoo', '2026-11-06', 7),
				ahead('move', 'First customers moved', 'First moves', '2026-11-30', 2),
			],
			tasks: [
				['Sign the Kalamazoo hosting contract', 'contract', 'as', '2026-10-05'],
				['Data processing terms for Midwest customers', 'contract', 'pd', '2026-10-09'],
				['Load test the Kalamazoo cluster', 'cedarrapids', 'ka', '2026-10-23'],
				['Move file storage to the Midwest bucket', 'cedarrapids', 'ds', '2026-10-28'],
				['Region switch in the admin settings', 'cedarrapids', 'im', '2026-10-30'],
				['Backups kept in the Midwest', 'cedarrapids', 'ds', '2026-11-03'],
				['Pick the first ten customers to move', 'move', 'as', '2026-11-12'],
				['Move plan for each customer', 'move', 'im', '2026-11-20'],
				['Security sign-off', 'move', 'pd', '2026-11-25'],
				['Tell the first customers the date', 'move', 'as', '2026-11-27'],
			],
			files: [
				['Midwest region plan.pdf', 1700000, 'as', '2026-08-07'],
				['Kalamazoo setup, security review.pdf', 640000, 'pd', '2026-10-08'],
			],
			feed: [
				['as', 'bi-slash-circle', 'flagged the <strong>hosting contract</strong>', '2026-10-09T09:30'],
				['pd', 'bi-shield-check', 'finished the <strong>security review</strong>', '2026-10-08T18:05'],
				['ds', 'bi-check2-circle', 'finished <strong>database copies</strong>', '2026-10-06T13:50'],
				['ka', 'bi-activity', 'set up <strong>uptime checks</strong>', '2026-10-05T10:15'],
				['as', 'bi-flag', 'got the <strong>budget approved</strong>', '2026-08-07T15:00'],
				kickoff('as', '2026-07-20'),
			],
		},

		{
			id: 'volt',
			status: 'on-track',
			name: 'Volt travel planning',
			area: 'Customer rollout',
			tone: 7,
			icon: 'bi-building-up',
			customer: { id: 'volt', name: 'Volt Film & Photo' },
			start: '2026-09-07',
			team: ['ev', 'mb', 'nf'],
			goal: 'Switch on Travel Planner for all 52 Volt Film & Photo seats and train the schedulers at their three studios.',
			milestones: [
				reached('seats', 'Travel Planner on for 52 seats', '2026-09-24', 10),
				reached('studios', 'Training at 3 studios', '2026-10-06', 10),
				ahead('signoff', 'Volt Film sign-off', 'Sign-off', '2026-10-13', 2),
			],
			tasks: [
				['Send the studio usage report', 'signoff', 'ev', '2026-10-12'],
				['Sign-off call with Volt Film & Photo', 'signoff', 'mb', '2026-10-13'],
			],
			files: [['Volt studio days, before and after.pdf', 1250000, 'nf', '2026-10-07']],
			feed: [
				['mb', 'bi-calendar-event', 'booked the <strong>sign-off call</strong>', '2026-10-09T09:05'],
				['nf', 'bi-file-earmark-text', 'shared <strong>before and after</strong> plans', '2026-10-07T12:10'],
				['ev', 'bi-flag', 'trained <strong>3 studios</strong>', '2026-10-06T16:30'],
				['ev', 'bi-flag', 'switched on <strong>52 seats</strong>', '2026-09-24T11:00'],
				kickoff('ev', '2026-09-07'),
			],
		},

		{
			id: 'sms',
			status: 'not-started',
			name: 'Two-way SMS replies',
			area: 'Product',
			tone: 2,
			icon: 'bi-chat-dots',
			start: '2026-10-19',
			team: ['og', 'th', 'jp', 'so'],
			goal: 'Let customers answer the arrival text, and show their reply on the visit so the team member sees it.',
			milestones: [
				ahead('spec', 'Spec signed off', 'Spec', '2026-10-23', 0),
				ahead('visit', 'Replies show on the visit', 'On the visit', '2026-11-20', 0),
				ahead('release', 'Release', null, '2026-12-14', 0),
			],
			tasks: [
				['Write the reply rules', 'spec', 'og', '2026-10-21'],
				['Load test the reply hooks', 'spec', 'so', '2026-10-22'],
				['Design the reply bubble on the visit screen', 'spec', 'th', '2026-10-23'],
				['Show replies on the visit screen', 'visit', 'th', '2026-11-13'],
				['Tell the scheduler about a reply', 'visit', 'jp', '2026-11-16'],
				['Reply from the staff app', 'visit', 'jp', '2026-11-18'],
				['Beta with 5 accounts', 'release', 'og', '2026-12-04'],
				['Release notes', 'release', 'og', '2026-12-11'],
			],
			files: [['SMS replies, first sketch.png', 980000, 'th', '2026-10-06']],
			feed: [
				['og', 'bi-list-check', 'split the work into <strong>8 tasks</strong>', '2026-10-08T14:40'],
				['th', 'bi-chat-square-text', 'shared the <strong>reply screen</strong> plan', '2026-10-06T10:30'],
				['so', 'bi-hdd-network', 'checked the <strong>SMS provider</strong>', '2026-10-05T15:15'],
			],
		},

		/* The two finished projects close the list, with nothing left open. */
		{
			id: 'help',
			status: 'done',
			name: 'Help center rewrite',
			area: 'Support',
			tone: 4,
			icon: 'bi-life-preserver',
			start: '2026-07-27',
			team: ['pr', 'yh', 'nd'],
			goal: 'Rewrite the most-read help articles so every one answers its question in the first line.',
			milestones: [
				reached('top', '40 most-read articles', '2026-08-21', 14),
				reached('shots', 'Screenshots of the new app', '2026-09-11', 10),
				reached('live', 'Published', '2026-10-02', 6),
			],
			tasks: [],
			files: [
				['Help center style guide.pdf', 520000, 'pr', '2026-07-30'],
				['Article list with owners.xlsx', 38000, 'yh', '2026-08-03'],
			],
			feed: [
				['pr', 'bi-flag', 'published the <strong>new help center</strong>', '2026-10-02T11:00'],
				['nd', 'bi-image', 'added <strong>new screenshots</strong>', '2026-09-11T16:20'],
				['yh', 'bi-flag', 'reached <strong>40 most-read articles</strong>', '2026-08-21T15:30'],
				kickoff('pr', '2026-07-27'),
			],
		},

		{
			id: 'pricing',
			status: 'done',
			name: 'Annual plan pricing',
			area: 'Marketing',
			tone: 6,
			icon: 'bi-tag',
			start: '2026-08-17',
			team: ['cr', 'ew', 'rd'],
			goal: 'Offer every plan billed yearly, with two months free, from the September renewals on.',
			milestones: [
				reached('prices', 'Prices agreed', '2026-09-02', 8),
				reached('page', 'Pricing page and emails', '2026-09-23', 10),
				reached('live', 'Live for renewals', '2026-09-30', 6),
			],
			tasks: [],
			files: [
				['Annual pricing model.xlsx', 120000, 'rd', '2026-08-28'],
				['Renewal email.docx', 32000, 'cr', '2026-09-21'],
			],
			feed: [
				['cr', 'bi-flag', 'marked <strong>Annual plan pricing</strong> as done', '2026-09-30T17:00'],
				['ew', 'bi-envelope', 'sent the <strong>renewal email</strong> to Sales', '2026-09-23T10:30'],
				['rd', 'bi-check2-circle', 'agreed the <strong>annual prices</strong>', '2026-09-02T12:00'],
				kickoff('cr', '2026-08-17'),
			],
		},
	];

	/** Hands the records and their readers to the pages. */
	function publish() {
		const hub = (window.Basalt.data ||= {});
		hub.projects = { TODAY, list: ALL_PROJECTS, find, summary, when };
	}

	/* Record builders. They keep the literals above short and leave out a
     field entirely when the source had no value for it. */

	/** A milestone already behind the team; `done` is its finished task count. */
	function reached(id, name, date, done) {
		return { id, name, date, done, reached: true };
	}

	/**
	 * A milestone still ahead. `label` is the shorter name the task filter
	 * shows; pass null when the full name is short enough on its own.
	 */
	function ahead(id, name, label, date, done) {
		const milestone = { id, name, date, done };
		if (label) milestone.short = label;
		return milestone;
	}

	/** The opening feed line every project gets at 9:00 am on its start day. */
	function kickoff(person, day) {
		return [person, 'bi-kanban', 'started the project', `${day}T09:00`];
	}

	/* Readers the pages call. */

	/** @returns {object|null} the project record with this id */
	function find(id) {
		return ALL_PROJECTS.find((project) => project.id === id) ?? null;
	}

	/**
	 * The flat shape the list pages draw: task counts instead of task lists,
	 * the customer split into a name and an id, a copy of the team, and each
	 * milestone as [name, 'YYYY-MM-DD', reached].
	 */
	function summary(project) {
		const { customer, milestones, tasks } = project;
		const finished = milestones.reduce((sum, milestone) => sum + milestone.done, 0);
		return {
			id: project.id,
			name: project.name,
			area: project.area,
			icon: project.icon,
			tone: project.tone,
			status: project.status,
			note: project.note,
			customer: customer ? customer.name : '',
			customerId: customer ? customer.id : '',
			team: [...project.team],
			start: project.start,
			done: finished,
			total: finished + tasks.length,
			milestones: milestones.map(({ name, date, reached: hit }) => [name, date, Boolean(hit)]),
		};
	}

	/**
	 * Turns a feed stamp ('2026-10-08T16:15') into the label the feeds show,
	 * measured against TODAY: "Today, 10:42 am", "Yesterday, 4:15 pm", or
	 * "Tue, Oct 6, 2:15 pm" for anything further off.
	 */
	function when(stamp) {
		const moment = calendarDay(stamp.split('T')[0]);
		const elapsed = Math.round((calendarDay(TODAY) - moment) / 864e5);
		const nearby = { 0: 'Today', 1: 'Yesterday' };
		const day =
			nearby[elapsed] ?? `${WEEKDAYS[moment.getDay()]}, ${MONTH_NAMES[moment.getMonth()]} ${moment.getDate()}`;
		return `${day}, ${twelveHour(stamp.split('T')[1])}`;
	}

	/** Midnight local time on an ISO 'YYYY-MM-DD' day. */
	function calendarDay(iso) {
		const [year, month, dayOfMonth] = iso.split('-').map(Number);
		return new Date(year, month - 1, dayOfMonth);
	}

	/** '16:05' becomes '4:05 pm'. */
	function twelveHour(clock) {
		const [hours, minutes] = clock.split(':').map(Number);
		return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'am' : 'pm'}`;
	}

	publish();
})();
