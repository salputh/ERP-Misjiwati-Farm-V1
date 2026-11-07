/**
 * Team chat for chat.html, a full-window app that starts wherever the page
 * carries [data-chat-root]. The workspace menu above the channel list stands
 * in for the header an ordinary admin page would have.
 *
 * It covers the Fieldline workspace end to end: public and private rooms, a
 * directory to find and join them, threads in a side panel, pins, saved
 * messages, mentions, reactions, unread markers, per-channel settings and a
 * composer that formats text and completes @people, #channels and /commands.
 *
 * Wiring it to a real backend:
 *   1. SAMPLE_WORKSPACE holds the whole workspace. Swap it for your own
 *      payload, or make server.fetchWorkspace() request it; the markup holds
 *      no channels, messages or people of its own.
 *   2. Each method on `server` stands for a single request. The page updates
 *      itself optimistically, calls the method, and rolls back with an error
 *      toast when the promise rejects.
 *   3. Push messages from other people through deliver(message). The demo
 *      drives it from timers; a socket handler is the natural home for it.
 *
 * Add one of these to the address to see the edge cases:
 *   ?state=empty   the signed-in person belongs to no channel
 *   ?state=error   the first load fails, which shows the Try again state
 *   ?state=flaky   every write fails, which shows each rollback
 *
 * Shared pieces it leans on from basalt.js: headers, toasts with undo, the
 * drawer, dialogs, hold-to-confirm, the command menu, segmented controls,
 * styled selects, suggestion lists, tag input, avatars with presence, count
 * pills, the context menu, pagination, skeletons, empty states, tooltips,
 * copy and loading buttons, and the polite live region.
 */
(() => {
	'use strict';

	const chatRoot = pick('[data-chat-root]');
	if (!chatRoot) return;

	/*
	 * The demo workspace. Field notes for anyone replacing it:
	 * - now: the moment the demo treats as the present; a live app uses new Date().
	 * - me: the id of the signed-in person.
	 * - people: presence is one of online, away, busy or offline.
	 * - channels: private ones get a lock; joined says whether "me" belongs;
	 *   lastRead marks where unread begins; notify is all, mentions or none;
	 *   words are highlighted whenever they appear.
	 * - messages: text understands *bold*, _italic_, ~strike~, `code`,
	 *   ```fenced code```, "> " quotes, "- " bullets, [label](https://…),
	 *   @handle and #channel. reactions map an emoji to who picked it, and
	 *   replies hold the thread in the same shape.
	 * - incoming: messages that show up `in` seconds after load, standing in
	 *   for a socket.
	 * - answers: who writes back after your first post in each channel.
	 */
	const SAMPLE_WORKSPACE = {
		now: '2026-10-02T10:42:00',
		me: 'john',
		link: 'https://chat.fieldline.app/',
		people: [
			{
				id: 'john',
				name: 'John Armstrong',
				title: 'Chief Technology Officer',
				team: 'Engineering',
				presence: 'online',
			},
			{ id: 'leslie', name: 'Leslie Ashby', title: 'Support lead', team: 'Support', presence: 'online' },
			{ id: 'randall', name: 'Otis Vaughan', title: 'Support engineer', team: 'Support', presence: 'online' },
			{ id: 'mae', name: 'Mae Morrow', title: 'Support, West', team: 'Support', presence: 'away' },
			{
				id: 'courtney',
				name: 'Courtney Nugent',
				title: 'Customer success manager',
				team: 'Success',
				presence: 'online',
			},
			{ id: 'travis', name: 'Quentin Cook', title: 'Account executive', team: 'Sales', presence: 'busy' },
			{ id: 'pamela', name: 'Pamela Leach', title: 'Sales lead, Midwest', team: 'Sales', presence: 'online' },
			{
				id: 'leah',
				name: 'Leah Beck',
				title: 'Product manager, scheduling',
				team: 'Product',
				presence: 'online',
			},
			{ id: 'isaac', name: 'Isaac Hanson', title: 'Product designer', team: 'Product', presence: 'away' },
			{ id: 'russ', name: 'Russ Sexton', title: 'Engineering lead', team: 'Engineering', presence: 'online' },
			{ id: 'tom', name: 'Tom Becker', title: 'Mobile engineer', team: 'Engineering', presence: 'online' },
			{ id: 'ann', name: 'Ann Franklin', title: 'Backend engineer', team: 'Engineering', presence: 'offline' },
			{ id: 'sandra', name: 'Sandra Bledsoe', title: 'Release manager', team: 'Engineering', presence: 'online' },
			{
				id: 'mallory',
				name: 'Mallory Martin',
				title: 'Product marketing',
				team: 'Marketing',
				presence: 'online',
			},
			{ id: 'marshall', name: 'Marshall Wick', title: 'Finance manager', team: 'Finance', presence: 'offline' },
			{ id: 'releases', name: 'Fieldline Releases', title: 'App', team: 'Apps', presence: 'online', bot: true },
		],
		channels: [
			{
				id: 'support',
				name: 'support',
				private: false,
				joined: true,
				lastRead: '2026-10-02T09:05',
				topic: 'Escalations from the help desk. Ticket number first, one thread per customer.',
				description: 'Where Support brings customer problems that need Engineering, Product or a decision.',
				createdBy: 'leslie',
				created: '2024-02-12',
				notify: 'all',
				muted: false,
				words: ['outage'],
				members: ['john', 'leslie', 'randall', 'mae', 'courtney', 'tom', 'russ', 'leah', 'ann', 'sandra'],
			},
			{
				id: 'schedule-feedback',
				name: 'schedule-feedback',
				private: false,
				joined: true,
				lastRead: '2026-10-01T17:00',
				topic: 'What customers say about the schedule board and bookings. Vote with 👍, Product reviews it every Monday.',
				description: 'Feedback from customers and their staff, in one place so Product can spot patterns.',
				createdBy: 'leah',
				created: '2025-01-20',
				notify: 'mentions',
				muted: false,
				words: [],
				members: ['john', 'leah', 'isaac', 'leslie', 'courtney', 'pamela', 'travis', 'mallory', 'russ'],
			},
			{
				id: 'releases',
				name: 'releases',
				private: false,
				joined: true,
				lastRead: '2026-10-01T16:30',
				topic: 'What shipped and when. Web every Tuesday, mobile every second Thursday.',
				description:
					'Release notes for the web app and the mobile app, posted by the release bot and the release manager.',
				createdBy: 'sandra',
				created: '2023-06-05',
				notify: 'mentions',
				muted: false,
				words: ['hotfix'],
				members: [
					'john',
					'leslie',
					'randall',
					'mae',
					'courtney',
					'travis',
					'pamela',
					'leah',
					'isaac',
					'russ',
					'tom',
					'ann',
					'sandra',
					'mallory',
					'marshall',
				],
			},
			{
				id: 'sales',
				name: 'sales',
				private: false,
				joined: true,
				lastRead: '2026-10-02T10:30',
				topic: 'Deals, pricing questions and wins. Quote list prices from the pricing page.',
				description: 'For the sales team and anyone who helps close a deal.',
				createdBy: 'travis',
				created: '2023-06-05',
				notify: 'all',
				muted: false,
				words: [],
				members: ['john', 'travis', 'pamela', 'marshall', 'courtney', 'mallory', 'leah'],
			},
			{
				id: 'random',
				name: 'random',
				private: false,
				joined: true,
				lastRead: '2026-10-01T12:00',
				topic: 'Everything that is not work. Be kind.',
				description: 'Desks, bikes, lost water bottles and Friday plans.',
				createdBy: 'john',
				created: '2023-06-05',
				notify: 'none',
				muted: true,
				words: [],
				members: [
					'john',
					'leslie',
					'randall',
					'mae',
					'courtney',
					'travis',
					'pamela',
					'leah',
					'isaac',
					'russ',
					'tom',
					'ann',
					'sandra',
					'mallory',
					'marshall',
				],
			},
			{
				id: 'inc-sms-delays',
				name: 'inc-sms-delays',
				private: true,
				joined: true,
				lastRead: '2026-10-02T10:00',
				topic: 'Incident October 1: SMS reminders late in the Midwest. Resolved 2:52 pm UTC. Postmortem Tuesday.',
				description: 'Incident channel. Keep it to facts and actions; the postmortem covers the why.',
				createdBy: 'ann',
				created: '2026-10-01',
				notify: 'all',
				muted: false,
				words: [],
				members: ['john', 'ann', 'russ', 'leslie', 'tom', 'sandra'],
			},
			{
				id: 'q4-pricing',
				name: 'q4-pricing',
				private: true,
				joined: true,
				lastRead: '2026-10-02T08:00',
				topic: 'Travel Planner pricing for Q4. Decision by October 9.',
				description: 'Private while the numbers are being worked out.',
				createdBy: 'marshall',
				created: '2026-09-21',
				notify: 'all',
				muted: false,
				words: [],
				members: ['john', 'pamela', 'travis', 'marshall', 'leah', 'mallory'],
			},

			/* Public rooms John has not joined yet; the browser offers them. */
			{
				id: 'engineering',
				name: 'engineering',
				private: false,
				joined: false,
				topic: 'Architecture, on-call and the build.',
				description: 'The engineering team. Ask anything; tag the on-call engineer for production problems.',
				createdBy: 'russ',
				created: '2023-06-05',
				members: ['russ', 'tom', 'ann', 'sandra', 'leah'],
			},
			{
				id: 'mobile-app',
				name: 'mobile-app',
				private: false,
				joined: false,
				topic: 'The staff app on iOS and Android.',
				description: 'Builds, test devices and app store reviews.',
				createdBy: 'tom',
				created: '2024-03-04',
				members: ['tom', 'sandra', 'isaac', 'russ'],
			},
			{
				id: 'travel-planner',
				name: 'travel-planner',
				private: false,
				joined: false,
				topic: 'The Travel Planner add-on.',
				description: 'Roadmap, customer requests and results for Travel Planner.',
				createdBy: 'leah',
				created: '2025-05-12',
				members: ['leah', 'russ', 'pamela', 'travis', 'courtney', 'mallory', 'ann'],
			},
			{
				id: 'customer-portal',
				name: 'customer-portal',
				private: false,
				joined: false,
				topic: 'The Customer Portal add-on.',
				description: 'Where the portal team shares releases and what customers ask for.',
				createdBy: 'isaac',
				created: '2025-08-18',
				members: ['isaac', 'leah', 'courtney', 'leslie'],
			},
			{
				id: 'west-team',
				name: 'west-team',
				private: false,
				joined: false,
				topic: 'West: Bellingham, WA and Missoula, MT.',
				description: 'For the West team and anyone working with customers there.',
				createdBy: 'mae',
				created: '2025-02-03',
				members: ['mae', 'courtney', 'travis'],
			},
			{
				id: 'midwest-team',
				name: 'midwest-team',
				private: false,
				joined: false,
				topic: 'Midwest: St. Cloud, Lincoln and Toledo.',
				description: 'Trade shows, trials and local questions for the Midwest.',
				createdBy: 'pamela',
				created: '2024-09-09',
				members: ['pamela', 'marshall', 'leslie', 'mallory'],
			},
			{
				id: 'wins',
				name: 'wins',
				private: false,
				joined: false,
				topic: 'New customers, renewals and kind words.',
				description: 'Good news only.',
				createdBy: 'travis',
				created: '2023-11-14',
				members: ['travis', 'pamela', 'courtney', 'mallory', 'marshall', 'leslie', 'leah', 'russ'],
			},
			{
				id: 'marketing-launches',
				name: 'marketing-launches',
				private: false,
				joined: false,
				topic: 'Launch plans, newsletters and case studies.',
				description: 'What marketing is putting out and when.',
				createdBy: 'mallory',
				created: '2024-04-22',
				members: ['mallory', 'leah', 'pamela'],
			},
			{
				id: 'new-starters',
				name: 'new-starters',
				private: false,
				joined: false,
				topic: 'Say hello to people in their first weeks.',
				description: 'Questions from new starters, answered by everyone.',
				createdBy: 'leslie',
				created: '2024-01-08',
				members: ['leslie', 'courtney', 'sandra', 'marshall', 'randall'],
			},

			/* Closed rooms, readable but locked. */
			{
				id: 'free-plan-launch',
				name: 'free-plan-launch',
				private: false,
				joined: false,
				archived: '2026-04-14',
				topic: 'Launching the Free plan.',
				description: 'Planning for the Free plan launch in April.',
				createdBy: 'mallory',
				created: '2026-01-19',
				members: ['mallory', 'leah', 'travis', 'pamela', 'marshall'],
			},
			{
				id: 'summer-offsite-2026',
				name: 'summer-offsite-2026',
				private: false,
				joined: false,
				archived: '2026-08-30',
				topic: 'The team week in Akron.',
				description: 'Travel, rooms and the agenda for the summer offsite.',
				createdBy: 'isaac',
				created: '2026-05-04',
				members: ['isaac', 'leslie', 'russ', 'mallory', 'courtney', 'tom', 'mae'],
			},
		],
		messages: [
			/* #support: escalations, plus the Android notification thread. */
			{
				id: 's0',
				ch: 'support',
				by: 'leslie',
				at: '2026-09-14T09:00',
				pinned: true,
				text: 'How we escalate in this channel:\n- Ticket number in the first line\n- One thread per customer, so updates stay together\n- Tag the on-call engineer for anything that stops visits reaching staff',
			},
			{
				id: 's1',
				ch: 'support',
				by: 'leslie',
				at: '2026-10-01T14:12',
				reactions: { '👀': ['tom', 'russ'] },
				text: 'Heads up: three customers say their staff on Android are not getting visit notifications since this morning. *Lakeside Apparel & Walks*, *Brightline Photography* and *Larchwood Optics* so far. Tickets #48211, #48215 and #48219.',
				replies: [
					{
						id: 's1r1',
						by: 'tom',
						at: '2026-10-01T14:20',
						text: 'Looking. Is it everyone on Android or only some phones?',
					},
					{
						id: 's1r2',
						by: 'randall',
						at: '2026-10-01T14:26',
						text: "Only Android 15 as far as I can tell. Lakeside's staff on older phones are fine.",
					},
					{
						id: 's1r3',
						by: 'tom',
						at: '2026-10-01T15:02',
						reactions: { '🙌': ['leslie', 'randall'] },
						text: 'Found it. 5.14.0 registers the notification channel after sign-in on Android 15, so the first push after an update is dropped and the channel is never made. The fix is small.',
					},
					{
						id: 's1r4',
						by: 'russ',
						at: '2026-10-01T15:05',
						text: "Let's ship it as 5.14.1 tomorrow morning. @sandra can you fit it into the release check?",
					},
					{
						id: 's1r5',
						by: 'sandra',
						at: '2026-10-01T16:40',
						text: 'Yes. The build is in review with Google Play, staged rollout from 9:00 am tomorrow.',
					},
					{
						id: 's1r6',
						by: 'tom',
						at: '2026-10-02T09:18',
						text: '5.14.1 is live for 20% of Android users. Ask affected staff to update and open the app once.',
					},
				],
			},
			{
				id: 's2',
				ch: 'support',
				by: 'courtney',
				at: '2026-10-01T14:48',
				reactions: { '✅': ['randall'] },
				text: "Oakhaven Studio asked if they can move all of one carer's visits at once when someone calls in sick. Is there a way today, or is that a feature request?",
				replies: [
					{
						id: 's2r1',
						by: 'randall',
						at: '2026-10-01T14:55',
						text: "There is: on the schedule board, filter by carer, Shift+click to select the visits, then drag them onto the other carer's row. I'll send them the help article.",
					},
					{
						id: 's2r2',
						by: 'courtney',
						at: '2026-10-01T15:10',
						text: 'Perfect, thank you. Sent it with a short video.',
					},
				],
			},
			{
				id: 's3',
				ch: 'support',
				by: 'randall',
				at: '2026-10-01T16:05',
				text: "Northgate Analytics cannot export last month's invoices to CSV. The button spins forever. Ticket #48230.",
				replies: [
					{
						id: 's3r1',
						by: 'ann',
						at: '2026-10-01T16:22',
						text: 'Their export has 11,400 rows and hits the 60 second limit. I ran it by hand and sent the file to Otis.',
					},
					{ id: 's3r2', by: 'randall', at: '2026-10-01T16:30', text: 'Got it and forwarded it. Thanks Ann.' },
					{
						id: 's3r3',
						by: 'russ',
						at: '2026-10-01T16:31',
						text: 'Logged as `ENG-2291` so large exports run in the background and email a link when they are ready.',
					},
				],
			},
			{
				id: 's4',
				ch: 'support',
				by: 'mae',
				at: '2026-10-02T08:47',
				text: 'Morning from the West. Overnight: 14 tickets, all answered. One for the team: Moorings City Photography in Bellingham wants Washington sales tax on its own invoice line. Who looks after invoice templates?',
				replies: [
					{
						id: 's4r1',
						by: 'courtney',
						at: '2026-10-02T09:02',
						text: "Finance owns the templates. I'll bring Marshall in and reply on the ticket.",
					},
				],
			},
			{
				id: 's5',
				ch: 'support',
				by: 'leslie',
				at: '2026-10-02T09:12',
				reactions: { '👍': ['courtney'] },
				text: '@john can you approve a one-month credit for Lakeside Apparel & Walks? They are on Pro with 18 seats, so it comes to *$576*. They lost a morning of visits to the notification bug.',
			},
			{
				id: 's6',
				ch: 'support',
				by: 'tom',
				at: '2026-10-02T09:20',
				reactions: { '🚀': ['leslie', 'randall', 'russ'] },
				text: '5.14.1 crash-free sessions are at 99.8%. Going to 100% of Android users at 1:00 pm if nothing changes.',
			},
			{
				id: 's7',
				ch: 'support',
				by: 'randall',
				at: '2026-10-02T09:41',
				reactions: { '🎉': ['leslie', 'tom'] },
				text: 'Larchwood Optics confirms notifications are back after updating. Closing #48219.',
			},
			{
				id: 's8',
				ch: 'support',
				by: 'courtney',
				at: '2026-10-02T10:05',
				text: 'Brightline Photography would like a call about the outage. Can someone from Engineering join for 15 minutes at 2pm? @tom @russ',
			},

			/* #schedule-feedback */
			{
				id: 'd1',
				ch: 'schedule-feedback',
				by: 'leah',
				at: '2026-09-30T11:30',
				pinned: true,
				files: [{ name: 'schedule-feedback-week-39.pdf', size: 421888 }],
				text: 'Monday review is done. Top three this week:\n- Color visits by type on the board\n- A faster map for teams with 100+ staff\n- A printable day sheet per team member\nNotes are in the PDF.',
			},
			{
				id: 'd2',
				ch: 'schedule-feedback',
				by: 'pamela',
				at: '2026-10-01T10:14',
				reactions: { '👍': ['travis', 'courtney', 'leslie', 'isaac'] },
				text: 'From Brightline Photography (Pro, 64 seats):\n> We would love the board to color shoots by type. Same-day shoots should jump out.\n👍 if you have heard the same.',
			},
			{
				id: 'd3',
				ch: 'schedule-feedback',
				by: 'courtney',
				at: '2026-10-01T15:40',
				reactions: { '👀': ['russ'] },
				text: 'Northgate Analytics again on the map: with 120 carers it takes 8 to 10 seconds to load in the morning. They start scheduling at 6:30 am, so it hurts.',
				replies: [
					{
						id: 'd3r1',
						by: 'russ',
						at: '2026-10-01T15:52',
						text: 'We can see it on their account. Grouping nearby pins should get it under 2 seconds. Planned for 2026.42.',
					},
					{
						id: 'd3r2',
						by: 'courtney',
						at: '2026-10-01T16:03',
						text: "I'll tell them mid-October rather than a date.",
					},
				],
			},
			{
				id: 'd4',
				ch: 'schedule-feedback',
				by: 'isaac',
				at: '2026-10-02T08:55',
				reactions: { '❤️': ['leah', 'pamela'] },
				files: [{ name: 'board-visit-colors-v1.png', size: 1887436 }],
				text: 'First pass at color by visit type. Same-day is the only red; everything else uses the visit type colors customers already pick in Settings.',
				replies: [
					{
						id: 'd4r1',
						by: 'leah',
						at: '2026-10-02T09:10',
						text: 'Love that it reuses their colors. Can we check it with color-blind schedulers in mind? A small icon on same-day visits would help.',
					},
					{
						id: 'd4r2',
						by: 'isaac',
						at: '2026-10-02T09:24',
						text: 'Good call. Adding a siren icon and checking it in the simulator.',
					},
				],
			},
			{
				id: 'd5',
				ch: 'schedule-feedback',
				by: 'travis',
				at: '2026-10-02T09:31',
				reactions: { '👍': ['leslie', 'courtney'] },
				text: 'Lakeside Apparel & Walks wants a printable day sheet per walker. Some of their walkers still like paper on the round.',
			},
			{
				id: 'd6',
				ch: 'schedule-feedback',
				by: 'mallory',
				at: '2026-10-02T10:02',
				text: 'If color by visit type ships this quarter, it is a great story for the November newsletter. @leah is 2026.44 realistic?',
			},
			{
				id: 'd7',
				ch: 'schedule-feedback',
				by: 'leah',
				at: '2026-10-02T10:20',
				text: "Realistic for a beta with five customers. I'd keep it out of the newsletter until then.",
			},

			/* #releases */
			{
				id: 'r0',
				ch: 'releases',
				by: 'sandra',
				at: '2026-09-24T10:00',
				pinned: true,
				text: 'Release calendar for Q4: *web every Tuesday*, *mobile every second Thursday*. Code freeze is the day before at 4:00 pm.',
			},
			{
				id: 'r1',
				ch: 'releases',
				by: 'releases',
				at: '2026-09-29T10:00',
				reactions: { '🎉': ['leslie', 'leah', 'pamela', 'russ', 'courtney', 'john'] },
				text: '*Fieldline 2026.40* is live in every region.\n- Travel Planner now respects staff break windows\n- Customer Portal: customers can reschedule inside the window you allow\n- Schedule board: select several visits and drag them together\n- 23 fixes, including the time zone bug on recurring visits',
				replies: [
					{
						id: 'r1r1',
						by: 'leslie',
						at: '2026-09-29T10:14',
						text: 'Does the reschedule window apply to existing bookings or only new ones?',
					},
					{
						id: 'r1r2',
						by: 'leah',
						at: '2026-09-29T10:20',
						text: 'All bookings, from today. The default is 24 hours before the visit; customers can change it in Settings under Customer Portal.',
					},
				],
			},
			{
				id: 'r2',
				ch: 'releases',
				by: 'releases',
				at: '2026-10-01T11:00',
				reactions: { '🚀': ['tom', 'mallory'] },
				text: '*Fieldline mobile 5.14.0* is rolling out on iOS and Android.\n- Offline mode keeps photos until the phone has signal\n- Faster visit list on phones with 200+ visits\n- Sign-off screen in 14 languages',
			},
			{
				id: 'r3',
				ch: 'releases',
				by: 'releases',
				at: '2026-10-02T09:05',
				text: '*Fieldline mobile 5.14.1* hotfix, staged rollout on Android at 20%.\n- Fixes visit notifications not arriving on Android 15 after updating',
			},
			{
				id: 'r4',
				ch: 'releases',
				by: 'sandra',
				at: '2026-10-02T09:40',
				reactions: { '✅': ['russ', 'tom'] },
				text: 'Release check for 2026.41 starts Monday at 10:00 am. Freeze is 4:00 pm today, so merge anything for Tuesday before then.',
			},

			/* #sales */
			{
				id: 'a1',
				ch: 'sales',
				by: 'travis',
				at: '2026-10-01T09:30',
				reactions: { '🎉': ['pamela', 'john', 'marshall', 'courtney', 'mallory'] },
				text: 'Signed: *Harborview Facilities*, Max, 85 seats, annual. That is $4,930 a month, and they want Travel Planner for every team.',
				replies: [
					{
						id: 'a1r1',
						by: 'marshall',
						at: '2026-10-01T09:41',
						text: "Annual on Max bills 10 months, so the first invoice is $49,300 plus the add-on. I'll send it Monday.",
					},
					{
						id: 'a1r2',
						by: 'travis',
						at: '2026-10-01T09:45',
						text: 'Thanks Marshall. The Travel Planner quote is on the deal.',
					},
				],
			},
			{
				id: 'a2',
				ch: 'sales',
				by: 'pamela',
				at: '2026-10-01T13:15',
				text: 'Midwest this week: 6 demos and 2 trials started, Norwood Electric and Kessler Home Systems. Both are 20 to 40 seats, most likely Pro.',
			},
			{
				id: 'a3',
				ch: 'sales',
				by: 'mallory',
				at: '2026-10-01T16:50',
				pinned: true,
				saved: true,
				reactions: { '🙌': ['travis', 'pamela'] },
				text: 'New case study: how Oakhaven Studio cut travel time by 18% with Travel Planner. Use it in follow-ups: [Oakhaven Studio case study](https://fieldline.app/customers/oakhaven-care)',
			},
			{
				id: 'a4',
				ch: 'sales',
				by: 'courtney',
				at: '2026-10-02T08:30',
				reactions: { '🙌': ['travis'] },
				text: 'Expansion: Lakeside Apparel & Walks is adding 6 seats after the outage call went well. Moving them from 18 to 24 on Pro.',
			},
			{
				id: 'a5',
				ch: 'sales',
				by: 'travis',
				at: '2026-10-02T09:58',
				text: 'Quick check before I send a quote: Pro annual is $32 × 10 months, so $320 per seat a year? Two months free.',
			},
			{
				id: 'a6',
				ch: 'sales',
				by: 'marshall',
				at: '2026-10-02T10:03',
				reactions: { '👍': ['travis'] },
				text: 'Right. $320 per seat a year, billed up front.',
			},

			/* #random */
			{
				id: 'x1',
				ch: 'random',
				by: 'mallory',
				at: '2026-10-01T12:10',
				text: 'The new standing desks are here. First come, first served by the window.',
			},
			{
				id: 'x2',
				ch: 'random',
				by: 'tom',
				at: '2026-10-01T12:40',
				reactions: { '🚲': ['russ', 'leah', 'isaac'] },
				text: 'Bike to work week starts Monday. 11 of us have signed up so far; the sheet is on the wiki.',
			},
			{
				id: 'x3',
				ch: 'random',
				by: 'isaac',
				at: '2026-10-02T09:15',
				reactions: { '🙌': ['leslie', 'mallory', 'tom'] },
				text: 'Demo day is today at 3:00 pm. Five teams, five minutes each. Snacks in the kitchen.',
			},
			{
				id: 'x4',
				ch: 'random',
				by: 'pamela',
				at: '2026-10-02T10:10',
				reactions: { '❄️': ['mae'] },
				text: 'St. Cloud says hi. First snow of the year this morning.',
			},
			{
				id: 'x5',
				ch: 'random',
				by: 'leslie',
				at: '2026-10-02T10:30',
				text: 'Lost and found: a blue water bottle with a Fieldline sticker. It is on the support desk.',
			},

			/* #inc-sms-delays, private */
			{
				id: 'i1',
				ch: 'inc-sms-delays',
				by: 'ann',
				at: '2026-10-01T14:08',
				pinned: true,
				text: 'Declaring an incident: SMS reminders to customers in the Midwest are 20 to 40 minutes late. Our SMS provider shows a queue backlog. Started about 2:05 pm UTC.',
			},
			{
				id: 'i2',
				ch: 'inc-sms-delays',
				by: 'russ',
				at: '2026-10-01T14:15',
				text: "Thanks Ann. I'll lead this one. @leslie can Support post a status page update?",
			},
			{
				id: 'i3',
				ch: 'inc-sms-delays',
				by: 'leslie',
				at: '2026-10-01T14:19',
				text: 'Posted:\n> Some SMS reminders in the Midwest are arriving late. Email reminders are not affected.',
			},
			{
				id: 'i4',
				ch: 'inc-sms-delays',
				by: 'ann',
				at: '2026-10-01T14:52',
				reactions: { '🙏': ['russ', 'leslie', 'tom'] },
				text: 'The provider has cleared the backlog and delivery is back under 10 seconds. Resolved at 2:52 pm UTC. 3,412 messages were late, none were lost.',
			},
			{
				id: 'i5',
				ch: 'inc-sms-delays',
				by: 'john',
				at: '2026-10-01T15:30',
				reactions: { '👍': ['russ', 'ann'] },
				text: "Thanks all. Postmortem on Tuesday, please. Let's also look at a second SMS provider for the Midwest.",
			},
			{
				id: 'i6',
				ch: 'inc-sms-delays',
				by: 'ann',
				at: '2026-10-02T09:50',
				saved: true,
				files: [{ name: 'postmortem-2026-10-01-sms.docx', size: 88064 }],
				text: 'Postmortem draft is ready for review.',
			},

			/* #q4-pricing, private */
			{
				id: 'q1',
				ch: 'q4-pricing',
				by: 'marshall',
				at: '2026-09-30T16:00',
				pinned: true,
				text: 'Numbers for the pricing talk, end of September: *$880k MRR*, *2,140 paying accounts*, *112% NRR*.',
			},
			{
				id: 'q2',
				ch: 'q4-pricing',
				by: 'leah',
				at: '2026-10-01T11:20',
				text: 'Travel Planner usage: 41% of Pro accounts and 78% of Max accounts turn it on in their first month.',
			},
			{
				id: 'q3',
				ch: 'q4-pricing',
				by: 'pamela',
				at: '2026-10-01T11:35',
				text: 'In the Midwest the add-on is the main reason Pro customers ask about Max.',
			},
			{
				id: 'q4',
				ch: 'q4-pricing',
				by: 'travis',
				at: '2026-10-02T09:44',
				text: '@john we need your call: does Travel Planner stay an add-on on Pro, or become Max only? Decision by October 9.',
			},

			/* One or two posts in each room John is not part of. */
			{
				id: 'e1',
				ch: 'engineering',
				by: 'russ',
				at: '2026-10-02T08:40',
				text: 'Architecture review moves to Wednesday. `ENG-2291` (background exports) is first on the list.',
			},
			{
				id: 'e2',
				ch: 'engineering',
				by: 'ann',
				at: '2026-10-02T09:55',
				text: 'On call hands over to Tom at 5:00 pm. Quiet night apart from the SMS follow-up.',
			},
			{
				id: 'mb1',
				ch: 'mobile-app',
				by: 'tom',
				at: '2026-10-01T17:20',
				text: '5.14.1 is uploaded. Thanks to everyone who tested on Android 15 phones today.',
			},
			{
				id: 'ro1',
				ch: 'travel-planner',
				by: 'leah',
				at: '2026-09-30T14:00',
				text: 'Break windows shipped in 2026.40. Next up: skills-based planning, so a carer without a license is never sent to a visit that needs a car.',
			},
			{
				id: 'cp1',
				ch: 'customer-portal',
				by: 'isaac',
				at: '2026-09-29T11:00',
				text: 'Rescheduling is live. 312 customers rescheduled on the first day and 9 asked for help.',
			},
			{
				id: 'ap1',
				ch: 'west-team',
				by: 'mae',
				at: '2026-10-02T08:10',
				text: "Moorings City Photography's trial ends next Friday. 22 photographers across Bellingham and Cheyenne.",
			},
			{
				id: 'eu1',
				ch: 'midwest-team',
				by: 'pamela',
				at: '2026-10-01T08:30',
				text: 'The trade show in Lincoln is booked for November 12 and 13. We need two people on the stand.',
			},
			{
				id: 'w1',
				ch: 'wins',
				by: 'travis',
				at: '2026-10-01T09:35',
				reactions: { '🎉': ['pamela', 'courtney', 'mallory', 'leslie'] },
				text: 'Harborview Facilities signed: 85 seats on Max.',
			},
			{
				id: 'ml1',
				ch: 'marketing-launches',
				by: 'mallory',
				at: '2026-09-30T15:00',
				text: 'The launch plan for color by visit type stays a draft until Product sets a date.',
			},
			{
				id: 'ns1',
				ch: 'new-starters',
				by: 'leslie',
				at: '2026-09-28T09:00',
				text: 'Welcome to the three people starting on Monday. Your first-week checklist is pinned in each team channel.',
			},
			{
				id: 'g1',
				ch: 'free-plan-launch',
				by: 'mallory',
				at: '2026-04-14T16:00',
				text: 'The Free plan is out. Thank you, everyone. Archiving this channel next week.',
			},
			{
				id: 'so1',
				ch: 'summer-offsite-2026',
				by: 'isaac',
				at: '2026-08-28T12:00',
				text: 'Photos from the offsite are in the shared drive. Thanks for a great week in Akron.',
			},
		],
		incoming: [
			{
				in: 9,
				ch: 'support',
				by: 'leslie',
				text: 'Lakeside just confirmed their staff are getting visits again. Thanks @tom.',
			},
			{
				in: 28,
				ch: 'schedule-feedback',
				by: 'isaac',
				text: 'Version two with the clock icon on same-day visits.',
				files: [{ name: 'board-visit-colors-v2.png', size: 1951232 }],
			},
		],
		answers: {
			support: { by: 'leslie', text: "Thanks John, I'll let the customer know." },
			'schedule-feedback': { by: 'leah', text: "Thanks, adding it to Monday's review." },
			releases: { by: 'sandra', text: 'Noted, thanks.' },
			sales: { by: 'travis', text: 'On it.' },
			random: { by: 'mallory', text: 'Ha, agreed.' },
			'inc-sms-delays': { by: 'russ', text: "Thanks. I'll add it to the postmortem." },
			'q4-pricing': { by: 'pamela', text: "Thanks John. I'll tell the Midwest team once it is final." },
			thread: { text: 'Thanks John.' },
		},
	};

	/* The reaction picker and the composer offer these, read out by their labels. */
	const REACTION_EMOJI = [
		'👍',
		'❤️',
		'🎉',
		'🙌',
		'👀',
		'✅',
		'🙏',
		'🚀',
		'😂',
		'🤔',
		'😬',
		'🔥',
		'💯',
		'👏',
		'⚠️',
		'📌',
	];
	const EMOJI_LABELS = {
		'👍': 'thumbs up',
		'❤️': 'heart',
		'🎉': 'party',
		'🙌': 'raised hands',
		'👀': 'eyes',
		'✅': 'check mark',
		'🙏': 'thank you',
		'🚀': 'rocket',
		'😂': 'laughing',
		'🤔': 'thinking',
		'😬': 'grimace',
		'🔥': 'fire',
		'💯': 'hundred',
		'👏': 'clapping',
		'⚠️': 'warning',
		'📌': 'pin',
		'🚲': 'bicycle',
		'❄️': 'snowflake',
	};

	/* Typing a slash at the start of the composer lists these. */
	const SLASH_COMMANDS = [
		{ name: 'topic', args: '[new topic]', text: 'Set the channel topic' },
		{ name: 'invite', args: '@name', text: 'Add someone to this channel' },
		{ name: 'remind', args: '[what]', text: 'Remind yourself at 3pm today' },
		{ name: 'mute', args: '', text: 'Mute or unmute this channel' },
		{ name: 'away', args: '', text: 'Set your status to away' },
		{ name: 'shrug', args: '[message]', text: 'Add ¯\\_(ツ)_/¯ to your message' },
		{ name: 'leave', args: '', text: 'Leave this channel' },
		{ name: 'shortcuts', args: '', text: 'Show the keyboard shortcuts' },
	];

	const MONTH_NAMES = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	];
	const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const FILE_FAMILY_ICONS = {
		image: 'bi-file-earmark-image',
		pdf: 'bi-file-earmark-pdf',
		doc: 'bi-file-earmark-text',
		sheet: 'bi-file-earmark-spreadsheet',
		other: 'bi-file-earmark',
	};
	const PRESENCE_PHRASE = { online: 'online', away: 'away', busy: 'in do not disturb', offline: 'offline' };
	const ROWS_PER_PAGE = 6;
	const demoMode = new URLSearchParams(location.search).get('state');

	/* The loaded workspace, two lookups into it, and everything the screen remembers. */
	let workspace = null;
	const peopleById = new Map();
	const channelsById = new Map();
	const session = {
		isLoading: true,
		loadError: null,
		openId: null,
		/* The first unread message at the moment the channel was opened. */
		markerId: null,
		/* Set once "Mark unread from here" is used, so opening does not clear it. */
		holdUnread: false,
		/* thread {id}, details {tab}, search, mentions or saved; null when closed. */
		side: null,
		/* The message that j and k move from. */
		cursorId: null,
		editingId: null,
		draftsByChannel: {},
		/* Files picked for the composer and not sent yet. */
		attachments: [],
		searchText: '',
		searchScope: 'all',
		searchFrom: '',
		searchHits: null,
		isSearching: false,
		memberQuery: '',
		/* Channels and threads where the demo has already written back. */
		repliedTo: {},
		catalog: { q: '', filter: 'all', sort: 'members', page: 1 },
		invitees: [],
		/* New arrivals below the visible part of the feed. */
		unseenCount: 0,
	};

	let clockBase = new Date(SAMPLE_WORKSPACE.now);
	const pageOpenedAt = Date.now();
	let loadAttempts = 0;
	let idCounter = 0;
	let completion = null;
	let typingHide = 0;
	let searchDebounce = 0;
	let searchTicket = 0;
	let emojiTarget = null;
	let emojiOpener = null;
	let contextMessageId = null;
	let contextReplyId = null;
	let pendingArchive = null;
	let settingsChannel = null;
	let jumpSignature = '';

	/* Every node the script reads or writes, looked up once. */
	const dom = {
		app: pick('[data-chat-app]', chatRoot),
		lists: {
			public: pick('[data-chat-list="public"]', chatRoot),
			private: pick('[data-chat-list="private"]', chatRoot),
		},
		views: pick('[data-chat-views]', chatRoot),
		teamLine: pick('[data-chat-team-line]', chatRoot),
		statusBtn: pick('.cht-me-btn', chatRoot),
		themeItem: pick('[data-chat-theme]', chatRoot),
		search: pick('[data-chat-search]', chatRoot),
		searchForm: pick('[data-chat-search-form]', chatRoot),
		title: pick('[data-chat-title]', chatRoot),
		topic: pick('[data-chat-topic]', chatRoot),
		tools: pick('[data-chat-head-tools]', chatRoot),
		people: pick('[data-chat-head-people]', chatRoot),
		pinCount: pick('[data-chat-pin-count]', chatRoot),
		muteLabel: pick('[data-chat-mute-label]', chatRoot),
		banner: pick('[data-chat-banner]', chatRoot),
		feed: pick('[data-chat-feed]', chatRoot),
		jump: pick('[data-chat-jump-new]', chatRoot),
		jumpLabel: pick('[data-chat-jump-label]', chatRoot),
		typing: pick('[data-chat-typing]', chatRoot),
		readonly: pick('[data-chat-readonly]', chatRoot),
		composer: pick('[data-chat-composer]', chatRoot),
		input: pick('[data-chat-input]', chatRoot),
		inputLabel: pick('[data-chat-input-label]', chatRoot),
		suggest: pick('[data-chat-suggest]', chatRoot),
		send: pick('[data-chat-send]', chatRoot),
		files: pick('[data-chat-files]', chatRoot),
		fileInput: pick('[data-chat-file-input]', chatRoot),
		panel: pick('[data-chat-panel]', chatRoot),
		panelTitle: pick('[data-chat-panel-title]', chatRoot),
		panelSub: pick('[data-chat-panel-sub]', chatRoot),
		panelBody: pick('[data-chat-panel-body]', chatRoot),
		panelContent: pick('[data-chat-panel-content]', chatRoot),
		tabs: pick('[data-chat-details-tabs]', chatRoot),
		filters: pick('[data-chat-search-filters]', chatRoot),
		from: pick('[data-chat-from]', chatRoot),
		threadParent: pick('[data-chat-thread-parent]', chatRoot),
		threadCount: pick('[data-chat-thread-count]', chatRoot),
		thread: pick('[data-chat-thread-list]', chatRoot),
		reply: pick('[data-chat-reply]', chatRoot),
		replyInput: pick('[data-chat-reply-input]', chatRoot),
		replySend: pick('[data-chat-reply-send]', chatRoot),
		alsoSend: pick('[data-chat-also-send]', chatRoot),
		alsoLabel: pick('[data-chat-also-label]', chatRoot),
		membersTools: pick('[data-chat-members-tools]', chatRoot),
		addMember: pick('[data-chat-add-member]', chatRoot),
		addMemberMsg: pick('[data-chat-add-member-msg]', chatRoot),
		memberFilter: pick('[data-chat-member-filter]', chatRoot),
		memberOptions: pick('[data-chat-member-options]', chatRoot),
		peopleOptions: pick('[data-chat-people-options]', chatRoot),
		menu: pick('#cht-msg-menu'),
		replyMenu: pick('#cht-reply-menu'),
		emoji: pick('[data-chat-emoji]', chatRoot),
		emojiGrid: pick('[data-chat-emoji-grid]', chatRoot),
		emojiTitle: pick('[data-chat-emoji-title]', chatRoot),
		jumpHost: pick('[data-chat-jump-host]', chatRoot),
	};
	const liveRegion = pick('[data-chat-live]', chatRoot);
	const directory = {
		list: pick('[data-chat-browse-list]', chatRoot),
		empty: pick('[data-chat-browse-empty]', chatRoot),
		count: pick('[data-chat-browse-count]', chatRoot),
		pages: pick('[data-chat-browse-pages]', chatRoot),
		search: pick('[data-chat-browse-search]', chatRoot),
		sort: pick('[data-chat-browse-sort]', chatRoot),
		pager: null,
	};
	const createForm = {
		form: pick('[data-chat-new-form]', chatRoot),
		name: pick('[data-chat-new-name]', chatRoot),
		prefix: pick('[data-chat-new-prefix]', chatRoot),
		error: pick('[data-chat-new-error]', chatRoot),
		desc: pick('[data-chat-new-desc]', chatRoot),
		people: pick('[data-chat-new-people]', chatRoot),
		picked: pick('[data-chat-new-picked]', chatRoot),
		submit: pick('[data-chat-new-submit]', chatRoot),
	};
	const settingsForm = {
		drawer: pick('#cht-settings'),
		form: pick('[data-chat-settings-form]', chatRoot),
		sub: pick('[data-chat-settings-sub]', chatRoot),
		name: pick('[data-chat-set-name]', chatRoot),
		prefix: pick('[data-chat-set-prefix]', chatRoot),
		error: pick('[data-chat-set-error]', chatRoot),
		topic: pick('[data-chat-set-topic]', chatRoot),
		desc: pick('[data-chat-set-desc]', chatRoot),
		mute: pick('[data-chat-set-mute]', chatRoot),
		words: pick('[data-chat-set-words]', chatRoot),
		save: pick('[data-chat-set-save]', chatRoot),
	};
	const narrowQuery = window.matchMedia('(max-width: 991.98px)');

	/*
	 * The only place that would talk to a server. Each method resolves after a
	 * short pause in the demo; the comment beside it names the request it
	 * replaces.
	 */
	const server = {
		/* GET /api/chat returns the workspace in the SAMPLE_WORKSPACE shape. */
		fetchWorkspace() {
			loadAttempts += 1;
			if (demoMode === 'error' && loadAttempts === 1)
				return later(600).then(() => {
					throw new Error('The server did not answer');
				});
			const copy = JSON.parse(JSON.stringify(SAMPLE_WORKSPACE));
			if (demoMode === 'empty') {
				for (const room of copy.channels) {
					room.joined = false;
					room.members = room.members.filter((personKey) => personKey !== copy.me);
				}
				for (const message of copy.messages) delete message.saved;
			}
			return later(550, copy);
		},
		/* GET /api/search?q=&channel=&from= */
		searchMessages(term, options) {
			return later(180, searchInMemory(term, options));
		},
		/* POST /api/channels/:id/messages with { text, files } */
		postMessage(targetChannel, payload) {
			return persist(260);
		},
		/* POST /api/messages/:id/replies with { text, alsoSend } */
		postReply(threadId, payload) {
			return persist(260);
		},
		/* PATCH /api/messages/:id with { text } */
		updateMessage(messageId, content) {
			return persist(200);
		},
		/* DELETE /api/messages/:id */
		removeMessage(messageId) {
			return persist(200);
		},
		/* POST /api/messages/:id/restore, behind the Undo button */
		undoRemove(messageId) {
			return persist(200);
		},
		/* PUT or DELETE /api/messages/:id/reactions/:emoji */
		setReaction(messageId, symbol, enabled) {
			return persist(120);
		},
		/* PUT or DELETE /api/messages/:id/pin */
		setPin(messageId, enabled) {
			return persist(150);
		},
		/* PUT or DELETE /api/me/saved/:id */
		setSaved(messageId, enabled) {
			return persist(120);
		},
		/* POST /api/channels/:id/read with { at } */
		setLastRead(targetChannel, stamp) {
			return persist(100);
		},
		/* POST /api/channels with { name, description, private, members } */
		addChannel(record) {
			return persist(700);
		},
		/* PATCH /api/channels/:id with any of name, topic, description, notify, muted, words */
		patchChannel(channelKey, patch) {
			return persist(500);
		},
		/* POST /api/channels/:id/members/me */
		joinChannel(channelKey) {
			return persist(600);
		},
		/* DELETE /api/channels/:id/members/me */
		leaveChannel(channelKey) {
			return persist(200);
		},
		/* POST /api/channels/:id/members with { personId } */
		addPerson(channelKey, memberKey) {
			return persist(200);
		},
		/* DELETE /api/channels/:id/members/:personId */
		removePerson(channelKey, memberKey) {
			return persist(200);
		},
		/* POST /api/channels/:id/archive, or /unarchive to undo it */
		setArchived(channelKey, enabled) {
			return persist(300);
		},
		/* PUT /api/me/status with { presence } */
		setPresence(status) {
			return persist(100);
		},
		/* POST /api/me/reminders with { text, at } */
		addReminder(content, stamp) {
			return persist(150);
		},
	};

	/* Bind every control once, then ask for the workspace. */
	function start() {
		dom.emojiGrid.innerHTML = REACTION_EMOJI.map(
			(glyph) =>
				`<button type="button" class="cht-emoji-btn" data-e="${glyph}" aria-label="${htmlSafe(EMOJI_LABELS[glyph])}" tabindex="-1">${glyph}</button>`,
		).join('');
		wireComposer();
		wireFeed();
		wireEmojiPicker();
		wireMessageMenus();
		wireSidePanel();
		wireSearch();
		wireWorkspaceChrome();
		wireDirectory();
		wireCreateDialog();
		wireSettings();
		wireKeyboard();
		wireViewport();
		reflectTheme();
		labelModifierKeys();
		loadWorkspace();
	}

	/* The message box, its reply twin in the thread, and the buttons around them. */
	function wireComposer() {
		dom.suggest.addEventListener('mousedown', (event) => event.preventDefault());
		dom.suggest.addEventListener('click', (event) => {
			const option = event.target.closest('[data-i]');
			if (option) acceptCompletion(+option.getAttribute('data-i'));
		});

		dom.input.addEventListener('input', () => {
			fitTextarea(dom.input);
			syncSendButton();
			showCompletions(dom.input);
		});
		dom.input.addEventListener('keydown', (event) =>
			handleComposerKey(event, dom.input, () => dom.composer.requestSubmit()),
		);
		dom.input.addEventListener('blur', () =>
			setTimeout(() => {
				if (document.activeElement !== dom.input) hideCompletions();
			}, 120),
		);
		dom.input.addEventListener('click', () => showCompletions(dom.input));
		dom.replyInput.addEventListener('input', () => {
			fitTextarea(dom.replyInput);
			syncReplyButton();
			showCompletions(dom.replyInput);
		});
		dom.replyInput.addEventListener('keydown', (event) =>
			handleComposerKey(event, dom.replyInput, () => dom.reply.requestSubmit()),
		);
		dom.replyInput.addEventListener('blur', () =>
			setTimeout(() => {
				if (document.activeElement !== dom.replyInput) hideCompletions();
			}, 120),
		);

		for (const button of pickAll('[data-chat-fmt]', chatRoot)) {
			button.addEventListener('mousedown', (event) => event.preventDefault());
			button.addEventListener('click', () => wrapSelection(dom.input, button.getAttribute('data-chat-fmt')));
		}
		for (const button of pickAll('[data-chat-insert]', chatRoot)) {
			button.addEventListener('click', () => insertTrigger(button.getAttribute('data-chat-insert')));
		}

		pick('[data-chat-attach]', chatRoot).addEventListener('click', () => dom.fileInput.click());
		dom.fileInput.addEventListener('change', () => {
			for (const file of Array.from(dom.fileInput.files).slice(0, 5)) {
				session.attachments.push({ name: file.name, size: file.size });
			}
			dom.fileInput.value = '';
			drawPendingFiles();
			announce(`${countOf(session.attachments.length, 'file')} ready to send`);
			dom.input.focus();
		});
		dom.files.addEventListener('click', (event) => {
			const removeButton = event.target.closest('[data-chat-file-remove]');
			if (!removeButton) return;
			const [removed] = session.attachments.splice(+removeButton.getAttribute('data-chat-file-remove'), 1);
			drawPendingFiles();
			announce(`Removed ${removed.name}`);
			dom.input.focus();
		});

		dom.composer.addEventListener('submit', sendFromComposer);
		dom.reply.addEventListener('submit', sendFromThread);
	}

	/* The message list: inline editing, the roving cursor, clicks, right-clicks and scroll. */
	function wireFeed() {
		dom.feed.addEventListener('submit', (event) => {
			if (!event.target.matches('[data-chat-edit-form]')) return;
			event.preventDefault();
			endEdit(true);
		});
		dom.feed.addEventListener('keydown', (event) => {
			if (!event.target.matches('[data-chat-edit-input]')) return;
			if (event.key === 'Escape') {
				event.preventDefault();
				event.stopPropagation();
				endEdit(false);
			} else if (event.key === 'Enter' && !event.shiftKey) {
				event.preventDefault();
				endEdit(true);
			}
		});
		dom.feed.addEventListener('focusin', (event) => {
			const owner = event.target.closest('.cht-msg[data-msg]');
			if (owner && owner.getAttribute('data-msg') !== session.cursorId)
				placeCursor(owner.getAttribute('data-msg'), false);
		});
		dom.feed.addEventListener('click', (event) => {
			if (handleMessageClick(event)) return;
			if (event.target.closest('[data-chat-retry]')) loadWorkspace();
		});
		/* Day lines, the intro and links keep the browser's own menu. */
		dom.feed.addEventListener(
			'contextmenu',
			(event) => {
				const article = event.target.closest('.cht-msg[data-msg]');
				if (!article || session.editingId === article.getAttribute('data-msg') || event.target.closest('a'))
					event.stopImmediatePropagation();
			},
			true,
		);
		dom.feed.addEventListener(
			'scroll',
			() => {
				if (dom.jump.hidden || !isScrolledToEnd()) return;
				dom.jump.hidden = true;
				session.unseenCount = 0;
				markChannelRead(activeChannel());
				drawSidebar();
			},
			{ passive: true },
		);
	}

	/* The floating emoji grid: picking, arrow keys, and closing when focus or the window moves. */
	function wireEmojiPicker() {
		dom.emoji.addEventListener('click', (event) => {
			const button = event.target.closest('[data-e]');
			if (button) applyPickedEmoji(button.getAttribute('data-e'));
		});
		dom.emoji.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' || event.key === 'Tab') {
				event.preventDefault();
				event.stopPropagation();
				hideEmojiPicker(true);
				return;
			}
			const emojiButtons = pickAll('.cht-emoji-btn', dom.emoji);
			const total = emojiButtons.length;
			const focusIndex = emojiButtons.indexOf(document.activeElement);
			const perRow = 8;
			const moves = {
				ArrowRight: () => (focusIndex + 1) % total,
				ArrowLeft: () => (focusIndex - 1 + total) % total,
				ArrowDown: () => Math.min(total - 1, focusIndex + perRow),
				ArrowUp: () => Math.max(0, focusIndex - perRow),
				Home: () => 0,
				End: () => total - 1,
			};
			if (!moves[event.key]) return;
			event.preventDefault();
			const nextIndex = moves[event.key]();
			for (const [slot, button] of emojiButtons.entries())
				button.setAttribute('tabindex', slot === nextIndex ? '0' : '-1');
			emojiButtons[nextIndex].focus();
		});
		document.addEventListener('pointerdown', (event) => {
			if (
				dom.emoji.hidden ||
				dom.emoji.contains(event.target) ||
				event.target.closest('[data-chat-reaction-add],[data-chat-emoji-insert]')
			)
				return;
			hideEmojiPicker(false);
		});
		window.addEventListener('resize', () => hideEmojiPicker(false));
		pick('[data-chat-emoji-insert]', chatRoot).addEventListener('click', (event) => {
			if (!dom.emoji.hidden) {
				hideEmojiPicker(true);
				return;
			}
			showEmojiPicker(event.currentTarget, { input: dom.input });
		});
	}

	/* The two context menus: one for channel messages, a shorter one for thread replies. */
	function wireMessageMenus() {
		dom.menu.addEventListener('basalt:context', (event) => {
			contextMessageId = event.detail.target.getAttribute('data-msg');
			const found = lookupMessage(contextMessageId);
			const fromMe = found && isSelf(found.msg.by);
			for (const item of pickAll('[data-chat-own-only]', dom.menu)) item.hidden = !fromMe;
			pick('[data-chat-pin-label]', dom.menu).textContent = found.msg.pinned ? 'Unpin' : 'Pin to channel';
			pick('[data-chat-save-label]', dom.menu).textContent = found.msg.saved
				? 'Remove from saved'
				: 'Save for later';
			const channel = activeChannel();
			pick('[data-chat-msg-act="unread"]', dom.menu).closest('li').hidden = !channel || !channel.joined;
			pick('[data-chat-msg-act="pin"]', dom.menu).closest('li').hidden =
				!channel || !channel.joined || !!channel.archived;
		});
		dom.menu.addEventListener('basalt:pick', (event) => {
			const action = event.detail.item.getAttribute('data-chat-msg-act');
			const messageId = contextMessageId;
			setTimeout(() => runMessageAction(action, messageId), 0);
		});

		dom.thread.addEventListener(
			'contextmenu',
			(event) => {
				if (!event.target.closest('.cht-msg[data-msg]')) event.stopImmediatePropagation();
			},
			true,
		);
		dom.replyMenu.addEventListener('basalt:context', (event) => {
			contextReplyId = event.detail.target.getAttribute('data-msg');
			const found = lookupMessage(contextReplyId);
			for (const item of pickAll('[data-chat-own-only]', dom.replyMenu))
				item.hidden = !(found && isSelf(found.msg.by));
		});
		dom.replyMenu.addEventListener('basalt:pick', (event) => {
			const action = event.detail.item.getAttribute('data-chat-reply-act');
			const messageId = contextReplyId;
			const replyActions = {
				react: () => openReactionPicker(messageId),
				link: () => copyMessageLink(messageId),
				delete: () => removeOwnMessage(messageId),
			};
			setTimeout(() => replyActions[action]?.(), 0);
		});
	}

	/* Clicks and keys inside the side panel, plus the member tools above it. */
	function wireSidePanel() {
		dom.panelBody.addEventListener('click', (event) => {
			if (handleMessageClick(event)) return;
			const routes = [
				['[data-chat-goto-msg]', (button) => goToResult(button.getAttribute('data-chat-goto-msg'))],
				[
					'[data-chat-remove-member]',
					(button) => dropMember(activeChannel(), button.getAttribute('data-chat-remove-member')),
				],
				[
					'[data-chat-clear-search]',
					() => {
						dom.search.value = '';
						session.searchText = '';
						session.searchHits = null;
						drawSidePanel();
						dom.search.focus();
					},
				],
				[
					'[data-chat-widen]',
					() => {
						session.searchScope = 'all';
						session.searchFrom = '';
						const everywhere = pick('#cht-scope-all');
						everywhere.checked = true;
						everywhere.dispatchEvent(new Event('change', { bubbles: true }));
						dom.from.value = '';
						startSearch();
					},
				],
				[
					'[data-chat-clear-member-filter]',
					() => {
						dom.memberFilter.value = '';
						session.memberQuery = '';
						drawSidePanel();
						dom.memberFilter.focus();
					},
				],
			];
			for (const [selector, run] of routes) {
				const button = event.target.closest(selector);
				if (button) {
					run(button);
					return;
				}
			}
		});

		/* Up and down walk the result rows; past the first one, focus returns to search. */
		dom.panelContent.addEventListener('keydown', (event) => {
			if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
			const stops = pickAll('.cht-result-go, .cht-filelist-item', dom.panelContent);
			const focusIndex = stops.indexOf(document.activeElement);
			if (focusIndex < 0) return;
			event.preventDefault();
			const neighbor = stops[focusIndex + (event.key === 'ArrowDown' ? 1 : -1)];
			if (neighbor) neighbor.focus();
			else if (event.key === 'ArrowUp' && session.side.type === 'search') dom.search.focus();
		});

		dom.memberFilter.addEventListener('input', () => {
			session.memberQuery = dom.memberFilter.value;
			drawSidePanel();
		});
		dom.addMember.addEventListener('change', addMemberFromField);

		dom.tabs.addEventListener('keydown', (event) => {
			const tabButtons = pickAll('[data-chat-tab]', dom.tabs);
			const focusIndex = tabButtons.indexOf(document.activeElement);
			if (focusIndex < 0) return;
			const total = tabButtons.length;
			const moves = {
				ArrowRight: () => (focusIndex + 1) % total,
				ArrowLeft: () => (focusIndex - 1 + total) % total,
				Home: () => 0,
				End: () => total - 1,
			};
			if (!moves[event.key]) return;
			event.preventDefault();
			tabButtons[moves[event.key]()].click();
		});
	}

	/* The search field over the channel list and the filters inside its panel. */
	function wireSearch() {
		dom.searchForm.addEventListener('submit', (event) => {
			event.preventDefault();
			if (!workspace) return;
			clearTimeout(searchDebounce);
			session.searchText = dom.search.value;
			revealSearchPanel();
			startSearch();
		});
		dom.search.addEventListener('input', () => {
			session.searchText = dom.search.value;
			clearTimeout(searchDebounce);
			if (!workspace) return;
			if (!session.searchText.trim()) {
				session.searchHits = null;
				if (isPanel('search')) drawSidePanel();
				return;
			}
			searchDebounce = setTimeout(() => {
				revealSearchPanel();
				startSearch();
			}, 250);
		});
		dom.search.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				event.stopPropagation();
				if (dom.search.value) {
					dom.search.value = '';
					session.searchText = '';
					session.searchHits = null;
					if (isPanel('search')) drawSidePanel();
				} else if (isPanel('search')) hideSidePanel(true);
				return;
			}
			if (event.key !== 'ArrowDown' || !isPanel('search')) return;
			const firstResult = pick('.cht-result-go', dom.panelContent);
			if (firstResult) {
				event.preventDefault();
				firstResult.focus();
			}
		});
		for (const radio of pickAll('[data-chat-scope]', chatRoot)) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				session.searchScope = radio.value;
				startSearch();
			});
		}
		dom.from.addEventListener('change', () => {
			session.searchFrom = dom.from.value;
			startSearch();
		});
	}

	/*
	 * One delegated click handler for the app frame: channel rows, view toggles,
	 * panel buttons, the workspace and channel menus. The first selector that
	 * matches wins, so the order below matters.
	 */
	function wireWorkspaceChrome() {
		const routes = [
			[
				'[data-chat-room]',
				(button) => showChannel(button.getAttribute('data-chat-room'), { focus: isNarrow() ? 'title' : null }),
			],
			['[data-chat-view]', (button) => toggleListView(button.getAttribute('data-chat-view'))],
			['[data-chat-panel-open]', (button) => toggleDetails(button)],
			['[data-chat-panel-close]', () => hideSidePanel()],
			[
				'[data-chat-tab]',
				(button) => {
					session.side.tab = button.getAttribute('data-chat-tab');
					drawSidePanel();
					button.focus();
				},
			],
			[
				'[data-chat-back-list]',
				() => {
					switchPane('list');
					const activeRow = pick('.cht-nav.is-active', dom.app);
					if (activeRow) activeRow.focus();
				},
			],
			['[data-chat-open-browser]', () => showDirectory()],
			['[data-chat-open-new]', () => showCreateDialog()],
			['[data-chat-shortcuts-open]', () => dialogFor('cht-keys').show()],
			['[data-chat-jump-open]', () => showJumpMenu()],
			['[data-chat-read-all]', () => markAllRead()],
			['[data-chat-status-open]', () => showStatusMenu()],
			['[data-chat-theme]', () => window.Basalt.setTheme(window.Basalt.getTheme() === 'dark' ? 'light' : 'dark')],
			['[data-chat-join]', (button) => enterChannel(button.getAttribute('data-chat-join'), button)],
			[
				'[data-chat-unarchive]',
				(button) => setArchived(channelsById.get(button.getAttribute('data-chat-unarchive')), false),
			],
			[
				'[data-chat-jump-new]',
				() => {
					dom.feed.scrollTop = dom.feed.scrollHeight;
					dom.jump.hidden = true;
					session.unseenCount = 0;
					markChannelRead(activeChannel());
					drawSidebar();
				},
			],
			[
				'[data-chat-group-toggle]',
				(button) => {
					const expand = button.getAttribute('aria-expanded') !== 'true';
					button.setAttribute('aria-expanded', String(expand));
					const list = document.getElementById(button.getAttribute('aria-controls'));
					window.Basalt.slide(list, () => {
						list.hidden = !expand;
					});
				},
			],
			['[data-chat-act]', (button) => runChannelAction(button.getAttribute('data-chat-act'))],
		];
		chatRoot.addEventListener('click', (event) => {
			/* Until the first load lands there is nothing to act on. */
			if (!workspace) return;
			for (const [selector, run] of routes) {
				const button = event.target.closest(selector);
				if (button) {
					run(button);
					return;
				}
			}
		});

		pick('[data-chat-archive-hold]', chatRoot).addEventListener('basalt:confirm', () => {
			const channel = pendingArchive;
			if (!channel) return;
			setTimeout(() => dialogFor('cht-archive').hide(), 350);
			setArchived(channel, true);
		});
		pick('.cht-me', chatRoot).addEventListener('basalt:presencechange', (event) => {
			const { presence } = event.detail;
			myself().presence = presence;
			drawTeamLine();
			if (isPanel('details')) drawSidePanel();
			server
				.setPresence(presence)
				.catch(() =>
					popToast({ tone: 'danger', title: 'Could not change your status', text: 'Try again in a moment.' }),
				);
		});
		document.addEventListener('basalt:appearance', reflectTheme);
	}

	/* The channel directory dialog: its search, filters, sort and row buttons. */
	function wireDirectory() {
		directory.search.addEventListener('input', () => {
			session.catalog.q = directory.search.value;
			restartDirectory();
		});
		for (const radio of pickAll('[data-chat-browse-filter]', chatRoot)) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				session.catalog.filter = radio.value;
				restartDirectory();
			});
		}
		directory.sort.addEventListener('change', () => {
			session.catalog.sort = directory.sort.value;
			drawDirectory();
		});

		const browserDialog = pick('#cht-browser');
		browserDialog.addEventListener('click', (event) => {
			const openButton = event.target.closest('[data-chat-browse-open]');
			if (openButton) {
				dialogFor('cht-browser').hide();
				showChannel(openButton.getAttribute('data-chat-browse-open'), { focus: 'title' });
				return;
			}
			if (!event.target.closest('[data-chat-browse-clear]')) return;
			directory.search.value = '';
			session.catalog.q = '';
			drawDirectory();
			directory.search.focus();
		});
		browserDialog.addEventListener('shown.bs.modal', () => directory.search.focus());
	}

	/* The New channel dialog. */
	function wireCreateDialog() {
		createForm.name.addEventListener('input', () => {
			const field = createForm.name;
			const caret = field.selectionStart;
			const cleaned = toSlug(field.value);
			if (cleaned !== field.value) {
				const trimmed = field.value.length - cleaned.length;
				field.value = cleaned;
				field.setSelectionRange(Math.max(0, caret - trimmed), Math.max(0, caret - trimmed));
			}
			if (!field.classList.contains('is-invalid')) return;
			const issue = nameError(cleaned);
			createForm.error.textContent = issue;
			createForm.error.classList.toggle('d-block', !!issue);
			field.classList.toggle('is-invalid', !!issue);
			if (!issue) field.removeAttribute('aria-invalid');
		});
		for (const radio of pickAll('[data-chat-new-vis]', chatRoot)) {
			radio.addEventListener('change', () => {
				createForm.prefix.innerHTML = `<i class="bi ${radio.value === 'private' && radio.checked ? 'bi-lock' : 'bi-hash'}"></i>`;
			});
		}
		createForm.people.addEventListener('change', () => {
			const typed = simplify(createForm.people.value.trim());
			if (!typed) return;
			const candidates = Array.from(peopleById.values()).filter(
				(candidate) => !candidate.bot && !isSelf(candidate.id),
			);
			const person =
				candidates.find((candidate) => simplify(candidate.name) === typed) ||
				candidates.find((candidate) => simplify(candidate.name).startsWith(typed));
			if (person && !session.invitees.includes(person.id)) {
				session.invitees.push(person.id);
				drawInvitees();
				announce(`Added ${person.name}`);
			}
			createForm.people.value = '';
		});
		createForm.picked.addEventListener('click', (event) => {
			const button = event.target.closest('[data-chat-unpick]');
			if (!button) return;
			session.invitees = session.invitees.filter(
				(personKey) => personKey !== button.getAttribute('data-chat-unpick'),
			);
			drawInvitees();
			createForm.people.focus();
		});
		createForm.form.addEventListener('submit', submitNewChannel);
		pick('#cht-new').addEventListener('shown.bs.modal', () => createForm.name.focus());
	}

	/* The channel settings drawer. */
	function wireSettings() {
		settingsForm.name.addEventListener('input', () => {
			const field = settingsForm.name;
			const cleaned = toSlug(field.value);
			if (cleaned !== field.value) field.value = cleaned;
			if (!field.classList.contains('is-invalid')) return;
			const issue = nameError(cleaned, settingsChannel);
			settingsForm.error.textContent = issue;
			settingsForm.error.classList.toggle('d-block', !!issue);
			field.classList.toggle('is-invalid', !!issue);
		});
		settingsForm.drawer.addEventListener('shown.bs.offcanvas', () => settingsForm.name.focus());
		/* Without this, focus would be left on a button inside the closed drawer. */
		settingsForm.drawer.addEventListener('hidden.bs.offcanvas', () => {
			const focused = document.activeElement;
			if (focused && focused !== document.body && !settingsForm.drawer.contains(focused)) return;
			if (!dom.composer.hidden) dom.input.focus();
			else dom.title.focus();
		});
		settingsForm.form.addEventListener('submit', submitSettings);
	}

	/*
	 * Keyboard shortcuts. Ctrl+K (Cmd+K on a Mac) is caught on window in the
	 * capture phase so the page-wide command palette never sees it here.
	 */
	function wireKeyboard() {
		dom.jumpHost.addEventListener('basalt:command', (event) => {
			const choice = event.detail.value;
			dialogFor('cht-jump').hide();
			if (choice.indexOf('ch:') === 0) {
				showChannel(choice.slice(3), { focus: 'composer' });
				return;
			}
			const jumpActions = {
				'act:new': () => showCreateDialog(),
				'act:browse': () => showDirectory(),
				'act:read': () => markAllRead(),
				'act:mentions': () => showSidePanel({ type: 'mentions' }),
				'act:keys': () => setTimeout(() => dialogFor('cht-keys').show(), 320),
			};
			jumpActions[choice]?.();
		});
		window.addEventListener(
			'keydown',
			(event) => {
				if (
					!workspace ||
					session.isLoading ||
					!(event.ctrlKey || event.metaKey) ||
					event.altKey ||
					event.key.toLowerCase() !== 'k'
				)
					return;
				event.preventDefault();
				event.stopPropagation();
				showJumpMenu();
			},
			true,
		);
		document.addEventListener('keydown', handleShortcut);
	}

	/* Width changes on tablets and phones, and links that point at a channel. */
	function wireViewport() {
		if (narrowQuery.addEventListener) narrowQuery.addEventListener('change', handleWidthChange);
		window.addEventListener('hashchange', () => {
			const target = readHash();
			if (target && workspace) showChannel(target.id, { msg: target.msg, noHash: true });
		});
	}

	/* Loading. Skeletons go up first; the workspace then opens the right channel. */

	function loadWorkspace() {
		session.isLoading = true;
		session.loadError = null;
		dom.app.setAttribute('aria-busy', 'true');
		drawSidebar();
		drawChannel();
		server
			.fetchWorkspace()
			.then((payload) => {
				indexWorkspace(payload);
				session.isLoading = false;
				dom.app.setAttribute('aria-busy', 'false');
				const target = readHash();
				const firstChannel = target ? target.id : defaultChannelId();
				if (firstChannel) showChannel(firstChannel, { msg: target && target.msg, noHash: !target });
				else {
					drawChannel();
					drawSidebar();
				}
				if (isNarrow() && !target) switchPane('list');
				queueIncoming();
			})
			.catch((reason) => {
				session.isLoading = false;
				session.loadError = reason;
				dom.app.setAttribute('aria-busy', 'false');
				drawSidebar();
				drawChannel();
				announce('Chat did not load.');
			});
	}

	/* #support when you are in it, otherwise the first of your channels by name. */
	function defaultChannelId() {
		const support = channelsById.get('support');
		if (support && support.joined) return 'support';
		const [firstByName] = myChannels().sort((left, right) => left.name.localeCompare(right.name));
		return firstByName && firstByName.id;
	}

	function indexWorkspace(payload) {
		workspace = payload;
		clockBase = new Date(payload.now);
		peopleById.clear();
		channelsById.clear();
		for (const person of payload.people) peopleById.set(person.id, person);
		for (const room of payload.channels) channelsById.set(room.id, room);
		/* Search can be narrowed to one author; the list comes from the people above. */
		dom.from.innerHTML = `<option value="">From anyone</option>${payload.people.map((person) => `<option value="${htmlSafe(person.id)}">${htmlSafe(isSelf(person.id) ? `${person.name} (you)` : person.name)}</option>`).join('')}`;
		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(dom.from);
		if (!directory.pager && window.Basalt.pagination) {
			directory.pager = window.Basalt.pagination(directory.pages, {
				total: 1,
				current: 1,
				label: 'Page',
				onChange(pageNumber) {
					session.catalog.page = pageNumber;
					drawDirectory();
				},
			});
		}
		drawInvitees();
	}

	/* Plays the demo's scheduled arrivals, each preceded by a typing hint. */
	function queueIncoming() {
		if (demoMode === 'empty' || demoMode === 'flaky') return;
		for (const message of workspace.incoming || []) {
			setTimeout(() => {
				const channel = channelsById.get(message.ch);
				if (!channel || !channel.joined || channel.archived) return;
				showTypingFor(message.ch, message.by);
				setTimeout(() => {
					clearTyping();
					deliver(message);
				}, 1800);
			}, message.in * 1000);
		}
	}

	/* Questions asked of the workspace. */

	function myself() {
		return peopleById.get(workspace.me);
	}

	function isSelf(personKey) {
		return workspace && personKey === workspace.me;
	}

	/** Falls back to a quiet stand-in, so a removed account never breaks a row. */
	function personFor(personKey) {
		return peopleById.get(personKey) || { id: personKey, name: 'Someone', title: '', presence: 'offline' };
	}

	function firstName(personKey) {
		return personFor(personKey).name.split(' ')[0];
	}

	function activeChannel() {
		return channelsById.get(session.openId) || null;
	}

	/** Live (not deleted) top-level messages of one channel, oldest first. */
	function roomFeed(channelKey) {
		return workspace.messages
			.filter((message) => message.ch === channelKey && !message.deleted)
			.sort((left, right) => asDate(left.at) - asDate(right.at));
	}

	/**
	 * Finds a message or a thread reply by id.
	 * @returns {{msg: object, parent: object|null}|null} parent is the thread head for replies.
	 */
	function lookupMessage(messageId) {
		for (const message of workspace.messages) {
			if (message.id === messageId) return { msg: message, parent: null };
			const reply = (message.replies || []).find((candidate) => candidate.id === messageId);
			if (reply) return { msg: reply, parent: message };
		}
		return null;
	}

	function myChannels() {
		return Array.from(channelsById.values()).filter((room) => room.joined && !room.archived);
	}

	function namesMe(message) {
		return new RegExp(`@${workspace.me}\\b`).test(message.text);
	}

	/** Counts what arrived after lastRead, and how much of it mentions you. */
	function unreadTally(channel) {
		if (!channel.joined || channel.archived) return { count: 0, mentions: 0 };
		const readAt = asDate(channel.lastRead || 0);
		const newer = roomFeed(channel.id).filter(
			(message) => !isSelf(message.by) && message.kind !== 'event' && asDate(message.at) > readAt,
		);
		return { count: newer.length, mentions: newer.filter(namesMe).length };
	}

	/* Mentions of you across joined channels and their threads, newest first. */
	function mentionHits() {
		const matches = [];
		for (const message of workspace.messages) {
			const channel = channelsById.get(message.ch);
			if (!channel || !channel.joined || message.deleted) continue;
			if (namesMe(message) && !isSelf(message.by)) matches.push({ msg: message, parent: null });
			for (const reply of message.replies || []) {
				if (!reply.deleted && namesMe(reply) && !isSelf(reply.by))
					matches.push({ msg: reply, parent: message });
			}
		}
		return newestFirst(matches);
	}

	function savedHits() {
		const matches = [];
		for (const message of workspace.messages) {
			if (message.deleted) continue;
			if (message.saved) matches.push({ msg: message, parent: null });
			for (const reply of message.replies || []) {
				if (reply.saved && !reply.deleted) matches.push({ msg: reply, parent: message });
			}
		}
		return newestFirst(matches);
	}

	function newestFirst(matches) {
		return matches.sort((left, right) => asDate(right.msg.at) - asDate(left.msg.at));
	}

	/* The newest message time in a channel, or its creation date when it is silent. */
	function latestActivity(channel) {
		const livePosts = workspace.messages.filter((message) => message.ch === channel.id && !message.deleted);
		if (!livePosts.length) return channel.created;
		return livePosts.reduce(
			(latest, message) => (asDate(message.at) > asDate(latest) ? message.at : latest),
			livePosts[0].at,
		);
	}

	/*
	 * Message text to HTML. The text is escaped first; fenced code is set aside
	 * before anything else so its contents are never formatted, then lines are
	 * grouped into paragraphs, bullet lists and quotes.
	 */
	function renderMarkup(content, options) {
		const fences = [];
		const escaped = htmlSafe(content).replace(/```\n?([\s\S]*?)\n?```/g, (whole, codeText) => {
			fences.push(`<pre class="cht-pre"><code>${codeText}</code></pre>`);
			return `\u0003${fences.length - 1}\u0003`;
		});
		let html = '';
		let paragraph = [];
		let bullets = null;
		let quoted = null;

		function flushBlock() {
			if (paragraph.length) {
				html += `<p>${paragraph.map((entry) => inlineMarkup(entry, options)).join('<br>')}</p>`;
				paragraph = [];
			}
			if (bullets) {
				html += `<ul>${bullets.map((entry) => `<li>${inlineMarkup(entry, options)}</li>`).join('')}</ul>`;
				bullets = null;
			}
			if (quoted) {
				html += `<blockquote>${quoted.map((entry) => inlineMarkup(entry, options)).join('<br>')}</blockquote>`;
				quoted = null;
			}
		}

		for (const textLine of escaped.split('\n')) {
			// eslint-disable-next-line no-control-regex -- control characters mark text parked during the rewrite
			const fenced = textLine.match(/^\u0003(\d+)\u0003$/);
			if (fenced) {
				flushBlock();
				html += fences[+fenced[1]];
				continue;
			}
			const bullet = textLine.match(/^- (.*)$/);
			if (bullet) {
				if (!bullets) {
					flushBlock();
					bullets = [];
				}
				bullets.push(bullet[1]);
				continue;
			}
			const quoteMatch = textLine.match(/^&gt; ?(.*)$/);
			if (quoteMatch) {
				if (!quoted) {
					flushBlock();
					quoted = [];
				}
				quoted.push(quoteMatch[1]);
				continue;
			}
			if (bullets || quoted) flushBlock();
			paragraph.push(textLine);
		}
		flushBlock();
		// eslint-disable-next-line no-control-regex -- control characters mark text parked during the rewrite
		return html.replace(/\u0003(\d+)\u0003/g, (whole, index) => fences[+index]);
	}

	/*
	 * Inline formatting for one escaped line. Code, links, mentions and channel
	 * names are parked behind placeholders while the emphasis rules run, so an
	 * underscore inside a URL never turns into italics.
	 */
	function inlineMarkup(source, options) {
		const kept = [];
		function stash(html) {
			kept.push(html);
			return `\u0001${kept.length - 1}\u0002`;
		}
		let line = source;
		line = line.replace(/`([^`\n]+)`/g, (whole, excerpt) => stash(`<code>${excerpt}</code>`));
		line = line.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (whole, linkLabel, href) =>
			stash(`<a rel="noopener" target="_blank" href="${href}">${linkLabel}</a>`),
		);
		line = line.replace(
			/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g,
			(whole, lead, href) => `${lead}${stash(`<a rel="noopener" target="_blank" href="${href}">${href}</a>`)}`,
		);
		line = line.replace(/(^|[\s(>])@([a-z][a-z0-9.-]*)/gi, (whole, lead, handle) => {
			const person = peopleById.get(handle.toLowerCase());
			if (!person) return whole;
			return `${lead}${stash(`<span class="cht-mention${isSelf(person.id) ? ' is-me' : ''}">@${htmlSafe(person.name)}</span>`)}`;
		});
		line = line.replace(/(^|[\s(])#([a-z0-9][a-z0-9-]*[a-z0-9])/g, (whole, lead, slugText) => {
			const channel = Array.from(channelsById.values()).find((room) => room.name === slugText);
			if (!channel) return whole;
			return `${lead}${stash(`<button type="button" class="cht-chref" data-chat-goto="${htmlSafe(channel.id)}">#${htmlSafe(channel.name)}</button>`)}`;
		});
		line = line.replace(/(^|[^\w*])\*([^*\n]+)\*(?!\w)/g, '$1<strong>$2</strong>');
		line = line.replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>');
		line = line.replace(/(^|[^\w~])~([^~\n]+)~(?!\w)/g, '$1<del>$2</del>');
		if (options && options.words && options.words.length) {
			const alternatives = options.words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
			line = line.replace(
				new RegExp(`(^|[^\\w])(${alternatives})(?![\\w])`, 'gi'),
				'$1<mark class="cht-hl">$2</mark>',
			);
		}
		if (options && options.query) line = highlightTerms(line, options.query);
		// eslint-disable-next-line no-control-regex -- control characters mark text parked during the rewrite
		return line.replace(/\u0001(\d+)\u0002/g, (whole, index) => kept[+index]);
	}

	/* Marks each search word in the text between tags, never inside one. */
	function highlightTerms(html, term) {
		const terms = term
			.trim()
			.split(/\s+/)
			.filter((word) => word.length > 1)
			.map((word) => htmlSafe(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
		if (!terms.length) return html;
		const pattern = new RegExp(`(${terms.join('|')})`, 'gi');
		return (
			html
				// eslint-disable-next-line no-control-regex -- control characters mark text parked during the rewrite
				.split(/(<[^>]+>|\u0001\d+\u0002)/)
				.map((chunk) =>
					chunk.charAt(0) === '<' || chunk.charAt(0) === '\u0001'
						? chunk
						: chunk.replace(pattern, '<mark>$1</mark>'),
				)
				.join('')
		);
	}

	/* One line of plain text, for toasts, search and the live region. */
	function toPlain(content) {
		return String(content)
			.replace(/```[\s\S]*?```/g, '[code]')
			.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
			.replace(/@([a-z]+)/gi, (whole, handle) =>
				peopleById.get(handle.toLowerCase()) ? `@${peopleById.get(handle.toLowerCase()).name}` : whole,
			)
			.replace(/[*_~`]/g, '')
			.replace(/^> /gm, '')
			.replace(/^- /gm, '')
			.replace(/\n+/g, ' ');
	}

	/* The channel list on the left. */

	function drawSidebar() {
		if (session.isLoading) {
			const skeletonRow =
				'<li class="cht-nav cht-nav-skel" aria-hidden="true"><span class="basalt-skeleton basalt-skeleton-circle cht-skel-icon"></span><span class="basalt-skeleton basalt-skeleton-text"></span></li>';
			dom.lists.public.innerHTML = skeletonRow.repeat(5);
			dom.lists.private.innerHTML = skeletonRow.repeat(2);
			return;
		}
		if (session.loadError) {
			dom.lists.public.innerHTML = '';
			dom.lists.private.innerHTML = '';
			return;
		}
		const alphabetical = myChannels().sort((left, right) => left.name.localeCompare(right.name));
		const publicOnes = alphabetical.filter((room) => !room.private);
		const privateOnes = alphabetical.filter((room) => room.private);
		dom.lists.public.innerHTML = publicOnes.length
			? publicOnes.map(channelRow).join('')
			: '<li class="cht-list-none">No channels yet. Browse them below, or start one.</li>';
		dom.lists.private.innerHTML = privateOnes.length
			? privateOnes.map(channelRow).join('')
			: '<li class="cht-list-none">Private channels you are added to show here.</li>';

		/* A channel you are only previewing (not joined, or archived) gets a temporary row. */
		const channel = activeChannel();
		if (channel && (!channel.joined || channel.archived)) {
			dom.lists.public.insertAdjacentHTML(
				'beforeend',
				channelRow(channel).replace('class="cht-nav', 'class="cht-nav cht-nav-preview'),
			);
		}

		drawViewCounts();
		drawTeamLine();
	}

	/* Counters on the Mentions and Saved buttons, and which of the two is pressed. */
	function drawViewCounts() {
		const mentionCount = mentionHits().filter(
			(hit) =>
				asDate(hit.msg.at) > asDate(channelsById.get(hit.parent ? hit.parent.ch : hit.msg.ch).lastRead || 0),
		).length;
		const savedCount = savedHits().length;
		pick('[data-chat-view-count="mentions"]', dom.views).innerHTML = mentionCount
			? `<span class="basalt-count-pill basalt-count-pill-danger">${mentionCount}</span>`
			: '';
		pick('[data-chat-view-count="saved"]', dom.views).innerHTML = savedCount
			? `<span class="basalt-count-pill">${savedCount}</span>`
			: '';
		pick('[data-chat-view="mentions"]', dom.views).setAttribute(
			'aria-label',
			`Mentions${mentionCount ? `, ${mentionCount} new` : ''}`,
		);
		pick('[data-chat-view="saved"]', dom.views).setAttribute(
			'aria-label',
			`Saved, ${countOf(savedCount, 'message')}`,
		);
		for (const button of pickAll('[data-chat-view]', dom.views)) {
			const pressed = isPanel(button.getAttribute('data-chat-view'));
			button.classList.toggle('is-active', !!pressed);
			button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
		}
	}

	/* "N of M online" under the workspace name; apps are left out of both numbers. */
	function drawTeamLine() {
		const humans = Array.from(peopleById.values()).filter((person) => !person.bot);
		const onlineCount = humans.filter((person) => person.presence === 'online').length;
		dom.teamLine.textContent = `${onlineCount} of ${humans.length} online`;
	}

	/**
	 * One row of the channel list. The badge shows mentions in red; a plain
	 * count only appears when the channel notifies on every message.
	 */
	function channelRow(channel) {
		const tally = unreadTally(channel);
		const isCurrent = channel.id === session.openId;
		const isUnread = !channel.muted && tally.count > 0;
		const showsCount = isUnread && (tally.mentions > 0 || channel.notify === 'all');
		const hasDraft = session.draftsByChannel[channel.id] && channel.id !== session.openId;
		const spoken = [
			channel.name,
			channel.private ? ', private' : '',
			channel.muted ? ', muted' : '',
			tally.mentions ? `, ${countOf(tally.mentions, 'mention')}` : '',
			isUnread ? `, ${tally.count} unread` : '',
			hasDraft ? ', draft' : '',
		].join('');
		let badge = '';
		if (tally.mentions) badge = `<span class="basalt-count-pill basalt-count-pill-danger">${tally.mentions}</span>`;
		else if (showsCount) badge = `<span class="basalt-count-pill">${tally.count}</span>`;
		return `<li><button type="button" class="cht-nav${isCurrent ? ' is-active' : ''}${isUnread ? ' is-unread' : ''}${channel.muted ? ' is-muted' : ''}" data-chat-room="${htmlSafe(channel.id)}"${isCurrent ? ' aria-current="page"' : ''} aria-label="${htmlSafe(spoken)}"><i class="bi ${channelGlyph(channel)}" aria-hidden="true"></i><span class="cht-nav-name">${htmlSafe(channel.name)}</span><span class="cht-nav-end" aria-hidden="true">${hasDraft ? '<i class="bi bi-pencil cht-nav-draft"></i>' : ''}${channel.muted ? '<i class="bi bi-bell-slash cht-nav-muted"></i>' : ''}${badge}</span></button></li>`;
	}

	function channelGlyph(channel) {
		if (channel.archived) return 'bi-archive';
		return channel.private ? 'bi-lock' : 'bi-hash';
	}

	/**
	 * An avatar for a person. Apps get a rocket instead of initials, and never
	 * a presence dot.
	 * @param {string} sizeClass xs or sm
	 * @param {boolean} [showPresence]
	 */
	function faceMarkup(personKey, sizeClass, showPresence) {
		const person = personFor(personKey);
		const faceHtml = person.bot
			? `<span class="basalt-avatar basalt-avatar-${sizeClass} cht-bot" aria-hidden="true"><i class="bi bi-rocket-takeoff"></i></span>`
			: `<span class="basalt-avatar basalt-avatar-${sizeClass}" data-basalt-avatar data-name="${htmlSafe(person.name)}" aria-hidden="true"></span>`;
		if (!showPresence || person.bot) return faceHtml;
		const dotClass = person.presence === 'offline' ? '' : ` basalt-avatar-status-dot-${person.presence}`;
		return `<span class="basalt-avatar-status">${faceHtml}<span class="basalt-avatar-status-dot${dotClass}"></span></span>`;
	}

	/* The open channel: header, banner, feed and the composer's label. */

	function drawChannel(options) {
		drawHeader();
		drawBanner();
		drawFeed(options);
		const channel = activeChannel();
		if (!channel) return;
		dom.input.placeholder = `Message #${channel.name}`;
		dom.inputLabel.textContent = `Message #${channel.name}`;
	}

	function drawHeader() {
		const channel = activeChannel();
		if (!channel) {
			dom.title.textContent = session.isLoading ? '' : session.loadError ? 'Chat' : 'Channels';
			if (session.isLoading)
				dom.title.innerHTML =
					'<span class="basalt-skeleton basalt-skeleton-title cht-skel-title"></span><span class="visually-hidden">Loading channel</span>';
			dom.topic.textContent = '';
			dom.tools.hidden = true;
			return;
		}
		dom.title.innerHTML = `<i class="bi ${channelGlyph(channel)}" aria-hidden="true"></i><span>${htmlSafe(channel.name)}</span>${channel.private ? '<span class="visually-hidden">, private channel</span>' : ''}${channel.muted ? '<i class="bi bi-bell-slash cht-head-muted" role="img" aria-label="Muted"></i>' : ''}`;
		dom.topic.textContent = channel.topic || '';
		dom.topic.title = channel.topic || '';
		dom.tools.hidden = false;

		/* You first, then the order the channel already keeps. */
		const roster = channel.members.slice().sort((left, right) => (isSelf(left) ? -1 : isSelf(right) ? 1 : 0));
		dom.people.innerHTML = `<span class="basalt-avatar-group cht-head-faces" aria-hidden="true">${roster
			.slice(0, 3)
			.map((personKey) => faceMarkup(personKey, 'xs'))
			.join('')}</span><span class="cht-head-n">${roster.length}</span>`;
		dom.people.setAttribute('aria-label', `Members, ${roster.length}`);
		paintAvatars(dom.people);

		const pinned = roomFeed(channel.id).filter((message) => message.pinned).length;
		dom.pinCount.textContent = pinned || '';
		pick('[data-chat-panel-open="pinned"]', dom.tools).setAttribute('aria-label', `Pinned messages, ${pinned}`);
		dom.muteLabel.textContent = channel.muted ? 'Unmute channel' : 'Mute channel';

		/* Outside members only get Copy link; dividers follow the same rule. */
		const manageable = channel.joined && !channel.archived;
		for (const button of pickAll('[data-chat-channel-menu] [data-chat-act]', chatRoot)) {
			button.closest('li').hidden = !manageable && button.getAttribute('data-chat-act') !== 'copy-link';
		}
		for (const rule of pickAll('[data-chat-channel-menu] hr', chatRoot)) rule.closest('li').hidden = !manageable;
	}

	/* Archived and not-joined channels swap the composer for a read-only notice. */
	function drawBanner() {
		const channel = activeChannel();
		if (!channel || (channel.joined && !channel.archived)) {
			dom.banner.hidden = true;
			dom.readonly.hidden = true;
			dom.composer.hidden = !channel;
			return;
		}
		dom.composer.hidden = true;
		dom.banner.hidden = false;
		if (channel.archived) {
			dom.banner.innerHTML = `<i class="bi bi-archive" aria-hidden="true"></i><span>#${htmlSafe(channel.name)} was archived on ${dayText(channel.archived)}. Every message is still here to read.</span>`;
			dom.readonly.innerHTML = `<p class="cht-readonly-text">This channel is read only.</p><button type="button" class="btn btn-outline-secondary btn-sm" data-chat-unarchive="${htmlSafe(channel.id)}"><i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Unarchive</button>`;
		} else {
			dom.banner.innerHTML = `<i class="bi bi-eye" aria-hidden="true"></i><span>You are looking at #${htmlSafe(channel.name)}. Join it to post and to see it in your list.</span>`;
			dom.readonly.innerHTML = `<p class="cht-readonly-text">${countOf(channel.members.length, 'member')} · ${htmlSafe(channel.description || '')}</p><button type="button" class="btn btn-primary btn-sm btn-loading btn-loading-swap" data-chat-join="${htmlSafe(channel.id)}"><span class="btn-loading-icon"><i class="bi bi-plus-lg" aria-hidden="true"></i></span><span class="btn-loading-label">Join channel</span></button>`;
		}
		dom.readonly.hidden = false;
	}

	/**
	 * Redraws the feed.
	 * @param {{toMarker?: boolean, bottom?: boolean, keep?: boolean}} [options]
	 *   toMarker scrolls to the New line, bottom to the end, keep holds the
	 *   reader where they were unless they were already at the end.
	 */
	function drawFeed(options) {
		const scroll = options || {};
		disposeTooltips(dom.feed);
		if (session.isLoading) {
			dom.feed.setAttribute('aria-busy', 'true');
			dom.feed.innerHTML = feedPlaceholder();
			return;
		}
		dom.feed.setAttribute('aria-busy', 'false');
		if (session.loadError) {
			dom.feed.innerHTML = blankSlate('error');
			return;
		}
		const channel = activeChannel();
		if (!channel) {
			dom.feed.innerHTML = blankSlate('nochannels');
			dom.feed.removeAttribute('aria-label');
			return;
		}
		dom.feed.setAttribute('aria-label', `Messages in #${channel.name}`);
		const stickToEnd = scroll.keep ? isScrolledToEnd() : false;
		const scrollBefore = dom.feed.scrollTop;
		const messages = roomFeed(channel.id);
		dom.feed.innerHTML = feedMarkup(channel, messages);
		for (const message of messages) delete message.fresh;

		/* Tab lands on the cursor message, or on the newest one when there is no cursor. */
		if (!pick('.cht-msg[tabindex="0"]', dom.feed)) {
			const messageEls = pickAll('.cht-msg[data-msg]', dom.feed);
			if (messageEls.length) messageEls[messageEls.length - 1].setAttribute('tabindex', '0');
		}
		paintAvatars(dom.feed);
		mountTooltips(dom.feed);

		if (scroll.toMarker) {
			const markerNode = pick('[data-chat-marker]', dom.feed);
			dom.feed.scrollTop = markerNode ? Math.max(0, markerNode.offsetTop - 80) : dom.feed.scrollHeight;
		} else if (scroll.bottom || stickToEnd) {
			dom.feed.scrollTop = dom.feed.scrollHeight;
		} else if (scroll.keep) {
			dom.feed.scrollTop = scrollBefore;
		}
	}

	/*
	 * The feed's HTML. Short channels open with an intro; a day line starts
	 * each day, and the New line sits before the first unread message.
	 * Consecutive posts by one person within five minutes collapse into a
	 * group, unless the earlier one has replies or reactions.
	 */
	function feedMarkup(channel, messages) {
		let html = messages.length < 4 ? channelIntro(channel) : '';
		let lastDayHeading = '';
		let previousMessage = null;
		for (const message of messages) {
			const dayHeading = dayText(message.at, true);
			let newGroup = false;
			if (dayHeading !== lastDayHeading) {
				html += `<div role="article" aria-label="${htmlSafe(dayHeading)}" class="cht-day"><span>${htmlSafe(dayHeading)}</span></div>`;
				lastDayHeading = dayHeading;
				newGroup = true;
			}
			if (session.markerId === message.id) {
				html +=
					'<div role="article" aria-label="New messages" class="cht-new" data-chat-marker><span>New</span></div>';
				newGroup = true;
			}
			const isGrouped = !newGroup && continuesGroup(previousMessage, message);
			html += messageMarkup(message, { grouped: isGrouped });
			previousMessage = message;
		}
		return html;
	}

	function continuesGroup(earlier, message) {
		if (!earlier || earlier.kind === 'event' || message.kind === 'event' || earlier.by !== message.by) return false;
		if (asDate(message.at) - asDate(earlier.at) >= 5 * 60000) return false;
		return !(earlier.replies && earlier.replies.length) && !Object.keys(earlier.reactions || {}).length;
	}

	function isScrolledToEnd() {
		return dom.feed.scrollHeight - dom.feed.scrollTop - dom.feed.clientHeight < 80;
	}

	/**
	 * One message as an article, or a one-line note for events like joins.
	 * @param {object} message
	 * @param {{grouped?: boolean, inThread?: boolean, flat?: boolean, parent?: object, dayInTime?: boolean}} [options]
	 *   flat is the thread's head copy (no toolbar, no tab stop); inThread is a
	 *   reply; dayInTime prints the day next to the time.
	 */
	function messageMarkup(message, options) {
		const view = options || {};
		if (message.kind === 'event') {
			return `<div class="cht-event" id="dm-${htmlSafe(message.id)}" data-msg="${htmlSafe(message.id)}"><i class="bi ${message.icon || 'bi-info-circle'}" aria-hidden="true"></i><span>${renderMarkup(message.text)}</span><time class="cht-event-time" datetime="${htmlSafe(message.at)}">${clockText(message.at)}</time></div>`;
		}
		const person = personFor(message.by);
		const channel = channelsById.get(view.parent ? view.parent.ch : message.ch);
		const watchWords = channel && channel.words ? channel.words : [];
		const stateClasses = {
			'is-grouped': view.grouped,
			'is-mention': namesMe(message) && !isSelf(message.by),
			'is-pinned': message.pinned,
			'is-sending': message.sending,
			'is-fresh': message.fresh,
			'is-cursor': session.cursorId === message.id,
		};
		const classes = ['cht-msg', ...Object.keys(stateClasses).filter((name) => stateClasses[name])];
		const headingId = `dm-${message.id}-meta`;
		const bodyMarkup =
			session.editingId === message.id
				? editFormMarkup(message)
				: `<div class="cht-msg-text">${renderMarkup(message.text, { words: watchWords })}${message.edited ? ' <span class="cht-msg-edited">(edited)</span>' : ''}</div>`;
		const sideMarkup = view.grouped
			? `<time class="cht-msg-stamp" datetime="${htmlSafe(message.at)}" aria-hidden="true">${clockText(message.at).replace(/ (am|pm)$/, '')}</time>`
			: faceMarkup(message.by, 'sm');
		const badges = [
			message.pinned && !view.inThread
				? '<span class="cht-msg-flag"><i class="bi bi-pin-angle-fill" aria-hidden="true"></i>Pinned</span>'
				: '',
			message.saved
				? '<span class="cht-msg-flag"><i class="bi bi-bookmark-fill" aria-hidden="true"></i>Saved</span>'
				: '',
			message.sending ? '<span class="cht-msg-flag">Sending</span>' : '',
		].join('');
		const tabStop = view.flat ? '' : ` tabindex="${session.cursorId === message.id ? '0' : '-1'}"`;
		return `<article class="${classes.join(' ')}" id="dm-${htmlSafe(message.id)}" data-msg="${htmlSafe(message.id)}"${tabStop} aria-labelledby="${headingId}"><div class="cht-msg-side">${sideMarkup}</div><div class="cht-msg-body"><div class="cht-msg-meta${view.grouped ? ' visually-hidden' : ''}" id="${headingId}"><span class="cht-msg-name">${htmlSafe(person.name)}</span>${person.bot ? '<span class="badge cht-app-badge">App</span>' : ''}<time class="cht-msg-time" datetime="${htmlSafe(message.at)}">${view.dayInTime ? whenText(message.at) : clockText(message.at)}</time>${badges}</div>${bodyMarkup}${attachmentList(message)}${reactionBar(message)}${view.inThread || view.flat ? '' : threadSummary(message)}</div>${messageToolbar(message, view)}</article>`;
	}

	function editFormMarkup(message) {
		return `<form class="cht-edit" data-chat-edit-form="${htmlSafe(message.id)}"><label class="visually-hidden" for="edit-${htmlSafe(message.id)}">Edit message</label><textarea class="cht-input cht-input-edit" id="edit-${htmlSafe(message.id)}" rows="2" data-chat-edit-input>${htmlSafe(message.text)}</textarea><div class="cht-edit-bar"><span class="cht-edit-hint"><kbd>Enter</kbd> saves, <kbd>Esc</kbd> cancels</span><button type="button" class="btn btn-outline-secondary btn-sm" data-chat-edit-cancel>Cancel</button><button type="submit" class="btn btn-primary btn-sm">Save</button></div></form>`;
	}

	/* Hover toolbar: replies get two buttons, feed messages four, the thread head none. */
	function messageToolbar(message, view) {
		if (view.inThread) {
			return `<div role="toolbar" aria-label="Reply actions" class="cht-msg-actions"><button type="button" tabindex="-1" data-chat-reaction-add="${htmlSafe(message.id)}" aria-label="Add a reaction"><i class="bi bi-emoji-smile" aria-hidden="true"></i></button><button type="button" tabindex="-1" data-chat-more aria-label="More actions"><i class="bi bi-three-dots" aria-hidden="true"></i></button></div>`;
		}
		if (view.flat) return '';
		const pinLabel = message.pinned ? 'Unpin' : 'Pin to channel';
		return `<div role="toolbar" aria-label="Message actions" class="cht-msg-actions"><button type="button" tabindex="-1" data-chat-reaction-add="${htmlSafe(message.id)}" aria-label="Add a reaction" data-bs-toggle="tooltip" data-bs-title="Add a reaction"><i class="bi bi-emoji-smile" aria-hidden="true"></i></button><button type="button" tabindex="-1" data-chat-open-thread="${htmlSafe(message.id)}" aria-label="Reply in thread" data-bs-toggle="tooltip" data-bs-title="Reply in thread"><i class="bi bi-chat-left-text" aria-hidden="true"></i></button><button type="button" tabindex="-1" data-chat-pin="${htmlSafe(message.id)}" aria-label="${pinLabel}" data-bs-toggle="tooltip" data-bs-title="${pinLabel}"><i class="bi ${message.pinned ? 'bi-pin-angle-fill' : 'bi-pin-angle'}" aria-hidden="true"></i></button><button type="button" tabindex="-1" data-chat-more aria-label="More actions" data-bs-toggle="tooltip" data-bs-title="More"><i class="bi bi-three-dots" aria-hidden="true"></i></button></div>`;
	}

	/* Reaction chips, each naming who reacted, plus the add button at the end. */
	function reactionBar(message) {
		const reactions = message.reactions || {};
		const glyphs = Object.keys(reactions).filter((glyph) => reactions[glyph].length);
		if (!glyphs.length) return '';
		const reactionChips = glyphs.map((glyph) => {
			const reactors = reactions[glyph];
			const includesMe = reactors.includes(workspace.me);
			const reactorNames = reactors.map((personKey) => (isSelf(personKey) ? 'you' : personFor(personKey).name));
			const nameList =
				reactorNames.length > 1
					? `${reactorNames.slice(0, -1).join(', ')} and ${reactorNames[reactorNames.length - 1]}`
					: reactorNames[0];
			const spokenName = EMOJI_LABELS[glyph] || glyph;
			const tipText = `${nameList} reacted with ${spokenName}`;
			return `<button type="button" class="cht-react${includesMe ? ' is-mine' : ''}" aria-pressed="${includesMe}" data-chat-reaction="${htmlSafe(message.id)}" data-emoji="${htmlSafe(glyph)}" aria-label="${htmlSafe(`${spokenName}, ${reactors.length}. ${tipText}. ${includesMe ? 'Remove yours' : 'Add yours'}`)}" data-bs-toggle="tooltip" data-bs-title="${htmlSafe(tipText)}"><span class="cht-react-e" aria-hidden="true">${glyph}</span><span class="cht-react-n" aria-hidden="true">${reactors.length}</span></button>`;
		});
		return `<div class="cht-reacts">${reactionChips.join('')}<button type="button" class="cht-react cht-react-add" data-chat-reaction-add="${htmlSafe(message.id)}" aria-label="Add a reaction" data-bs-toggle="tooltip" data-bs-title="Add a reaction"><i class="bi bi-emoji-smile" aria-hidden="true"></i><i class="bi bi-plus cht-react-plus" aria-hidden="true"></i></button></div>`;
	}

	function fileFamily(extension) {
		if (/png|jpe?g|gif|webp/.test(extension)) return 'image';
		if (extension === 'pdf') return 'pdf';
		if (/docx?/.test(extension)) return 'doc';
		return /xlsx?|csv/.test(extension) ? 'sheet' : 'other';
	}

	function attachmentList(message) {
		if (!message.files || !message.files.length) return '';
		const items = message.files.map((file, index) => {
			const extension = (file.name.split('.').pop() || '').toLowerCase();
			const family = fileFamily(extension);
			return `<li class="cht-attach-item cht-attach-${family}"><span class="cht-attach-icon" aria-hidden="true"><i class="bi ${FILE_FAMILY_ICONS[family]}"></i></span><span class="cht-attach-text"><span class="cht-attach-name">${htmlSafe(file.name)}</span><span class="cht-attach-meta">${htmlSafe(extension.toUpperCase())} · ${sizeText(file.size)}</span></span><button type="button" class="btn btn-icon cht-attach-get" data-chat-download="${htmlSafe(message.id)}:${index}" aria-label="Download ${htmlSafe(file.name)}"><i class="bi bi-download" aria-hidden="true"></i></button></li>`;
		});
		return `<ul class="cht-attach">${items.join('')}</ul>`;
	}

	/* The "N replies" link under a message: up to three faces and when the last reply came. */
	function threadSummary(message) {
		const replies = (message.replies || []).filter((reply) => !reply.deleted);
		if (!replies.length) return '';
		const faces = Array.from(new Set(replies.map((reply) => reply.by))).slice(0, 3);
		const latest = replies[replies.length - 1];
		const lastReply = whenText(latest.at).replace('Today at', 'today at').replace('Yesterday at', 'yesterday at');
		return `<button type="button" class="cht-threadlink" data-chat-open-thread="${htmlSafe(message.id)}"><span class="cht-threadlink-faces" aria-hidden="true">${faces.map((personKey) => faceMarkup(personKey, 'xs')).join('')}</span><span class="cht-threadlink-n">${countOf(replies.length, 'reply', 'replies')}</span><span class="cht-threadlink-last">Last reply ${lastReply}</span><i class="bi bi-chevron-right cht-threadlink-go" aria-hidden="true"></i></button>`;
	}

	function feedPlaceholder() {
		let html = '';
		for (let row = 0; row < 5; row++) {
			html += `<div class="cht-msg cht-msg-skel" aria-hidden="true"><div class="cht-msg-side"><span class="basalt-skeleton basalt-skeleton-circle cht-skel-avatar"></span></div><div class="cht-msg-body"><span class="basalt-skeleton basalt-skeleton-text cht-skel-name"></span><span class="basalt-skeleton basalt-skeleton-text"></span>${row % 2 ? '<span class="basalt-skeleton basalt-skeleton-text cht-skel-short"></span>' : ''}</div></div>`;
		}
		return html;
	}

	/**
	 * The empty and error states used in the feed and the side panel.
	 * @param {'error'|'nochannels'|'search'|'searchhint'|'mentions'|'saved'|'pinned'|'files'|'members'} variant
	 */
	function blankSlate(variant) {
		const spec = emptySpec(variant);
		return `<div class="basalt-empty basalt-empty-compact${spec.tone ? ` basalt-empty-${spec.tone}` : ''} cht-empty"${variant === 'error' ? ' role="alert"' : ''}><span class="cht-empty-icon" aria-hidden="true"><i class="bi ${spec.icon}"></i></span><h3 class="basalt-empty-title">${spec.title}</h3><p class="basalt-empty-text">${spec.text}</p>${spec.actions ? `<div class="basalt-empty-actions">${spec.actions}</div>` : ''}</div>`;
	}

	/* Only the variant asked for is built, since several read live search state. */
	function emptySpec(variant) {
		const specs = {
			error: () => ({
				tone: 'danger',
				icon: 'bi-wifi-off',
				title: 'Chat did not load',
				text: 'The server did not answer. Nothing you sent is lost; this only affects what you can see.',
				actions:
					'<button type="button" class="btn btn-sm btn-primary" data-chat-retry><i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Try again</button>',
			}),
			nochannels: () => ({
				icon: 'bi-chat-square-dots',
				title: 'You are not in any channels yet',
				text: "Channels keep a team's conversation in one place. Join the ones you need, or start your own.",
				actions:
					'<button type="button" class="btn btn-sm btn-primary" data-chat-open-browser><i class="bi bi-compass me-1" aria-hidden="true"></i>Browse channels</button><button type="button" class="btn btn-sm btn-outline-secondary" data-chat-open-new><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>New channel</button>',
			}),
			search: () => ({
				icon: 'bi-search',
				title: `Nothing matches “${htmlSafe(session.searchText.trim())}”`,
				text: `Search looks at messages and thread replies${session.searchScope === 'here' ? ' in this channel' : ' in the channels you are in'}${session.searchFrom ? ` from ${htmlSafe(personFor(session.searchFrom).name)}` : ''}. Check the spelling or widen the search.`,
				actions: `<button type="button" class="btn btn-sm btn-outline-secondary" data-chat-clear-search>Clear the search</button>${session.searchScope === 'here' || session.searchFrom ? '<button type="button" class="btn btn-sm btn-outline-secondary" data-chat-widen>Search everything</button>' : ''}`,
			}),
			searchhint: () => ({
				icon: 'bi-search',
				title: 'Search every channel',
				text: 'Type at least two letters. Try a customer name, a ticket number or a version like 5.14.',
			}),
			mentions: () => ({
				icon: 'bi-at',
				title: 'No mentions yet',
				text: `When someone writes @${htmlSafe(workspace ? myself().name : 'your name')}, the message waits here.`,
			}),
			saved: () => ({
				icon: 'bi-bookmark',
				title: 'Nothing saved',
				text: 'Save a message from its menu, or press S on it, to keep it here for later.',
			}),
			pinned: () => ({
				icon: 'bi-pin-angle',
				title: 'Nothing pinned yet',
				text: 'Pin the messages everyone should be able to find: a process, a link, a decision. Press P on a message.',
			}),
			files: () => ({
				icon: 'bi-paperclip',
				title: 'No files yet',
				text: 'Files shared in this channel are listed here.',
			}),
			members: () => ({
				icon: 'bi-people',
				title: `Nobody matches “${htmlSafe(session.memberQuery)}”`,
				text: 'Filter looks at names, job titles and teams.',
				actions:
					'<button type="button" class="btn btn-sm btn-outline-secondary" data-chat-clear-member-filter>Clear the filter</button>',
			}),
		};
		return specs[variant]();
	}

	/* The welcome block at the top of a channel with only a few messages. */
	function channelIntro(channel) {
		const founderName = isSelf(channel.createdBy) ? 'You' : personFor(channel.createdBy).name;
		const startedWhen = dayDistance(channel.created) === 0 ? 'today' : `on ${dayText(channel.created)}`;
		const actions =
			channel.joined && !channel.archived
				? '<div class="cht-intro-actions"><button type="button" class="btn btn-sm btn-outline-secondary" data-chat-panel-open="members"><i class="bi bi-person-plus me-1" aria-hidden="true"></i>Add people</button><button type="button" class="btn btn-sm btn-outline-secondary" data-chat-act="settings"><i class="bi bi-pencil me-1" aria-hidden="true"></i>Edit the description</button></div>'
				: '';
		return `<div class="cht-intro"><span class="cht-intro-icon" aria-hidden="true"><i class="bi ${channelGlyph(channel)}"></i></span><h3 class="cht-intro-title">This is the very beginning of #${htmlSafe(channel.name)}</h3><p class="cht-intro-text">${htmlSafe(founderName)} started this ${channel.private ? 'private ' : ''}channel ${startedWhen}. ${htmlSafe(channel.description || '')}</p>${actions}</div>`;
	}

	/* Moving between channels. */

	/**
	 * Opens a channel, keeping the draft of the one being left.
	 * @param {{msg?: string, noHash?: boolean, focus?: 'composer'|'title'|null}} [options]
	 *   msg scrolls to and flashes that message; noHash leaves the address alone.
	 */
	function showChannel(channelKey, options) {
		const opening = options || {};
		const channel = channelsById.get(channelKey);
		if (!channel) return;
		if (session.openId && session.openId !== channelKey) {
			const draft = dom.input.value;
			if (draft.trim()) session.draftsByChannel[session.openId] = draft;
			else delete session.draftsByChannel[session.openId];
			session.attachments = [];
			drawPendingFiles();
		}
		const switched = session.openId !== channelKey;
		session.openId = channelKey;
		session.editingId = null;
		session.unseenCount = 0;
		dom.jump.hidden = true;
		hideCompletions();
		if (switched) resetForChannel(channel);
		drawChannel({ toMarker: switched && !opening.msg, bottom: !switched });
		if (channel.joined && !channel.archived) markChannelRead(channel);
		drawSidebar();
		if (!opening.noHash) writeHash(channel, opening.msg);
		if (isNarrow()) switchPane('channel');
		if (opening.msg) flashMessage(opening.msg);
		if (opening.focus === 'composer' && !dom.composer.hidden) dom.input.focus();
		else if (opening.focus === 'title') dom.title.focus();
	}

	/* A different channel starts fresh: new marker, its own draft, no thread or details open. */
	function resetForChannel(channel) {
		session.holdUnread = false;
		session.cursorId = null;
		const readAt = asDate(channel.lastRead || 0);
		const firstNew = channel.joined
			? roomFeed(channel.id).find(
					(message) => !isSelf(message.by) && message.kind !== 'event' && asDate(message.at) > readAt,
				)
			: null;
		session.markerId = firstNew ? firstNew.id : null;
		dom.input.value = session.draftsByChannel[channel.id] || '';
		fitTextarea(dom.input);
		syncSendButton();
		if (isPanel('thread') || isPanel('details')) hideSidePanel(true);
	}

	/** Moves lastRead up to the newest message. always overrides "Mark unread". */
	function markChannelRead(channel, always) {
		if (!channel || !channel.joined) return;
		if (session.holdUnread && !always) return;
		const messages = roomFeed(channel.id);
		const newestAt = messages.length ? messages[messages.length - 1].at : localStamp(clockNow());
		if (asDate(channel.lastRead || 0) >= asDate(newestAt)) return;
		const previousRead = channel.lastRead;
		channel.lastRead = newestAt;
		server.setLastRead(channel.id, newestAt).catch(() => {
			channel.lastRead = previousRead;
			drawSidebar();
		});
	}

	/* The address carries #channel or #channel/message, so a link opens the same place. */
	function writeHash(channel, anchorId) {
		const hash = `#${channel.name}${anchorId ? `/${anchorId}` : ''}`;
		if (location.hash !== hash) history.replaceState(null, '', hash);
	}

	function readHash() {
		const raw = decodeURIComponent(location.hash.slice(1));
		if (!raw) return null;
		const [channelName, messagePart] = raw.split('/');
		const channel = Array.from(channelsById.values()).find((room) => room.name === channelName);
		return channel ? { id: channel.id, msg: messagePart } : null;
	}

	/* Brings a message into view with a brief highlight. A reply opens its thread instead. */
	function flashMessage(messageId) {
		const found = lookupMessage(messageId);
		if (!found) return;
		if (found.parent) {
			showThread(found.parent.id, { focusReply: messageId });
			return;
		}
		const messageNode = document.getElementById(`dm-${messageId}`);
		if (!messageNode) return;
		placeCursor(messageId, true);
		messageNode.classList.remove('is-flash');
		void messageNode.offsetWidth;
		messageNode.classList.add('is-flash');
	}

	/* Below the large breakpoint only one pane shows: list, channel or panel. */
	function switchPane(pane) {
		dom.app.setAttribute('data-view', pane);
	}

	function handleWidthChange() {
		if (!narrowQuery.matches) return;
		if (session.side) switchPane('panel');
		else if (dom.app.getAttribute('data-view') === 'panel') switchPane('channel');
	}

	/* The side panel, which hosts threads, channel details, search, mentions and saved. */

	function isPanel(type) {
		return session.side && session.side.type === type;
	}

	/**
	 * @param {{type: string, id?: string, tab?: string}} panel
	 * @param {{focus?: false|HTMLElement}} [options] false keeps focus where it is.
	 */
	function showSidePanel(panel, options) {
		const opening = options || {};
		session.side = panel;
		dom.panel.hidden = false;
		dom.app.classList.add('has-panel');
		drawSidePanel();
		drawSidebar();
		if (isNarrow()) switchPane('panel');
		if (opening.focus === false) return;
		const focusTarget =
			opening.focus ||
			(panel.type === 'details' ? pick(`[data-chat-tab="${panel.tab}"]`, dom.tabs) : dom.panelTitle);
		if (!focusTarget) return;
		if (focusTarget === dom.panelTitle) focusTarget.setAttribute('tabindex', '-1');
		focusTarget.focus({ preventScroll: true });
	}

	/** Closes the panel and, unless silently, returns focus to whatever opened it. */
	function hideSidePanel(silently) {
		if (!session.side) return;
		const closing = session.side;
		session.side = null;
		dom.panel.hidden = true;
		dom.app.classList.remove('has-panel');
		drawSidebar();
		if (isNarrow()) switchPane(activeChannel() ? 'channel' : 'list');
		if (silently) return;
		const returnTo = panelOpener(closing);
		if (returnTo && returnTo.offsetParent) returnTo.focus();
		else if (dom.input.offsetParent) dom.input.focus();
	}

	function panelOpener(closing) {
		if (closing.type === 'thread') return document.getElementById(`dm-${closing.id}`);
		if (closing.type === 'search') return dom.search;
		if (closing.type === 'mentions' || closing.type === 'saved')
			return pick(`[data-chat-view="${closing.type}"]`, dom.views);
		const tabButton = closing.tab === 'members' || closing.tab === 'pinned' ? closing.tab : 'about';
		return pick(`[data-chat-panel-open="${tabButton}"]`, dom.tools);
	}

	function drawSidePanel() {
		const panel = session.side;
		if (!panel) return;
		disposeTooltips(dom.panelBody);
		const channel = activeChannel();
		const threadMode = panel.type === 'thread';
		for (const part of [dom.threadParent, dom.threadCount, dom.thread, dom.reply]) part.hidden = !threadMode;
		dom.tabs.hidden = panel.type !== 'details';
		dom.filters.hidden = panel.type !== 'search';
		dom.membersTools.hidden = !(
			panel.type === 'details' &&
			panel.tab === 'members' &&
			channel &&
			channel.joined &&
			!channel.archived
		);
		dom.panelContent.hidden = threadMode;
		dom.panel.setAttribute('data-panel', panel.type);
		if (panel.type === 'details') {
			dom.panelBody.setAttribute('role', 'tabpanel');
			dom.panelBody.setAttribute(
				'aria-labelledby',
				`cht-tab-${panel.tab.charAt(0).toUpperCase()}${panel.tab.slice(1)}`,
			);
		} else {
			dom.panelBody.removeAttribute('role');
			dom.panelBody.removeAttribute('aria-labelledby');
		}
		if (threadMode) drawThread();
		else if (panel.type === 'details') drawDetails();
		else if (panel.type === 'search') drawSearch();
		else drawMessageList(panel.type);
		paintAvatars(dom.panelBody);
		mountTooltips(dom.panelBody);
	}

	function revealSearchPanel() {
		if (!isPanel('search')) showSidePanel({ type: 'search' }, { focus: false });
	}

	function toggleListView(viewName) {
		if (isPanel(viewName)) hideSidePanel();
		else showSidePanel({ type: viewName });
	}

	/* Header buttons toggle their details tab; the same button inside the panel only switches to it. */
	function toggleDetails(button) {
		const tabName = button.getAttribute('data-chat-panel-open');
		if (
			isPanel('details') &&
			session.side.tab === tabName &&
			dom.app.contains(button) &&
			!dom.panel.contains(button)
		) {
			hideSidePanel();
			return;
		}
		showSidePanel({ type: 'details', tab: tabName });
		if (tabName === 'members' && !dom.membersTools.hidden && button.closest('.cht-intro')) dom.addMember.focus();
	}

	/**
	 * Opens a thread beside its channel.
	 * @param {{focusReply?: string, focus?: false}} [options] focusReply highlights
	 *   one reply; otherwise the reply box takes focus when there is one.
	 */
	function showThread(messageId, options) {
		const opening = options || {};
		const found = lookupMessage(messageId);
		if (!found || found.parent) return;
		if (found.msg.ch !== session.openId) showChannel(found.msg.ch, { noHash: false });
		showSidePanel({ type: 'thread', id: messageId }, { focus: false });
		if (opening.focusReply) {
			const replyNode = document.getElementById(`dm-${opening.focusReply}`);
			if (!replyNode) return;
			replyNode.setAttribute('tabindex', '-1');
			replyNode.focus();
			replyNode.classList.add('is-flash');
		} else if (opening.focus !== false && !dom.reply.hidden) {
			dom.replyInput.focus();
		} else {
			dom.panelTitle.focus();
		}
	}

	function drawThread() {
		const found = lookupMessage(session.side.id);
		if (!found || found.msg.deleted) {
			hideSidePanel(true);
			return;
		}
		const head = found.msg;
		const channel = channelsById.get(head.ch);
		dom.panelTitle.textContent = 'Thread';
		dom.panelSub.textContent = `#${channel.name}`;
		dom.threadParent.innerHTML = messageMarkup(head, { flat: true, dayInTime: true });
		const replies = (head.replies || []).filter((reply) => !reply.deleted);
		dom.threadCount.innerHTML = `<span>${replies.length ? countOf(replies.length, 'reply', 'replies') : 'No replies yet'}</span>`;
		dom.thread.innerHTML = replies
			.map((reply) =>
				messageMarkup(reply, { inThread: true, parent: head, dayInTime: dayDistance(reply.at) !== 0 }),
			)
			.join('');
		dom.thread.setAttribute('aria-label', 'Replies');
		dom.reply.hidden = !(channel.joined && !channel.archived);
		dom.alsoLabel.textContent = `Also send to #${channel.name}`;
		dom.replyInput.placeholder = `Reply to ${isSelf(head.by) ? 'your message' : firstName(head.by)}`;
		syncReplyButton();
	}

	/* Channel details, one tab at a time: about, members, pinned and files. */
	function drawDetails() {
		const channel = activeChannel();
		const activeTab = session.side.tab;
		dom.panelTitle.textContent = 'Details';
		dom.panelSub.textContent = `#${channel.name}`;
		for (const tabButton of pickAll('[data-chat-tab]', dom.tabs)) {
			const selected = tabButton.getAttribute('data-chat-tab') === activeTab;
			tabButton.classList.toggle('active', selected);
			tabButton.setAttribute('aria-selected', String(selected));
			tabButton.setAttribute('tabindex', selected ? '0' : '-1');
		}
		pick('[data-chat-tab-n="members"]', dom.tabs).textContent = channel.members.length;
		const pinned = roomFeed(channel.id).filter((message) => message.pinned);
		pick('[data-chat-tab-n="pinned"]', dom.tabs).textContent = pinned.length || '';
		const tabBuilders = {
			about: () => aboutTab(channel),
			members: () => membersTab(channel),
			pinned: () =>
				pinned.length
					? `<ul class="cht-results">${pinned
							.slice()
							.reverse()
							.map((message) => resultRow({ msg: message, parent: null }, { unpin: true }))
							.join('')}</ul>`
					: blankSlate('pinned'),
			files: () => filesTab(channel),
		};
		dom.panelContent.innerHTML = tabBuilders[activeTab] ? tabBuilders[activeTab]() : '';
		if (window.Basalt.buttons) window.Basalt.buttons(dom.panelContent);
	}

	function aboutTab(channel) {
		const founderName = isSelf(channel.createdBy) ? 'you' : personFor(channel.createdBy).name;
		const channelLink = `${SAMPLE_WORKSPACE.link}c/${channel.name}`;
		const alertsText = { all: 'Every message', mentions: 'Only mentions', none: 'Nothing' }[
			channel.notify || 'all'
		];
		const rows = [
			['Topic', channel.topic ? htmlSafe(channel.topic) : '<span class="cht-quiet">No topic yet</span>'],
			[
				'Description',
				channel.description
					? htmlSafe(channel.description)
					: '<span class="cht-quiet">No description yet</span>',
			],
			[
				'Visibility',
				channel.private
					? '<i class="bi bi-lock me-1" aria-hidden="true"></i>Private: only members can see it'
					: '<i class="bi bi-hash me-1" aria-hidden="true"></i>Public: anyone at Fieldline can join',
			],
			channel.joined ? ['Notifications', `${alertsText}${channel.muted ? ', muted' : ''}`] : null,
			['Created', `By ${htmlSafe(founderName)} on ${dayText(channel.created)}`],
		].filter(Boolean);
		const linkRow = `<div class="cht-about-row"><dt>Link</dt><dd class="cht-about-link"><code>${htmlSafe(channelLink)}</code><button type="button" class="btn btn-sm btn-outline-secondary btn-copy btn-copy-icon" data-basalt-copy="${htmlSafe(channelLink)}" aria-label="Copy channel link" data-bs-toggle="tooltip" data-bs-title="Copy link" data-basalt-copy-done="Copied"><i class="bi bi-copy" aria-hidden="true"></i></button></dd></div>`;
		const settingsButton =
			channel.joined && !channel.archived
				? '<button type="button" class="btn btn-outline-secondary btn-sm w-100" data-chat-act="settings"><i class="bi bi-sliders me-1" aria-hidden="true"></i>Channel settings</button>'
				: '';
		return `<dl class="cht-about">${rows.map(([term, detail]) => `<div class="cht-about-row"><dt>${term}</dt><dd>${detail}</dd></div>`).join('')}${linkRow}</dl>${settingsButton}`;
	}

	/* Members, you first and the rest by name, filtered by name, title or team. */
	function membersTab(channel) {
		const needle = simplify(session.memberQuery.trim());
		const roster = channel.members
			.slice()
			.sort((left, right) =>
				isSelf(left) ? -1 : isSelf(right) ? 1 : personFor(left).name.localeCompare(personFor(right).name),
			);
		const shownIds = roster.filter(
			(personKey) =>
				!needle ||
				simplify(
					`${personFor(personKey).name} ${personFor(personKey).title} ${personFor(personKey).team}`,
				).includes(needle),
		);
		dom.memberOptions.innerHTML = Array.from(peopleById.values())
			.filter((person) => !person.bot && !channel.members.includes(person.id))
			.map(
				(person) =>
					`<li data-value="${htmlSafe(person.name)}" data-hint="${htmlSafe(person.title)}">${htmlSafe(person.name)}</li>`,
			)
			.join('');
		if (!shownIds.length) return blankSlate('members');
		const removable = channel.joined && !channel.archived;
		const rows = shownIds.map((personKey) => {
			const person = personFor(personKey);
			const removeButton =
				!isSelf(personKey) && removable
					? `<button type="button" class="btn btn-icon cht-person-remove" data-chat-remove-member="${htmlSafe(personKey)}" aria-label="Remove ${htmlSafe(person.name)} from #${htmlSafe(channel.name)}" data-bs-toggle="tooltip" data-bs-title="Remove from channel"><i class="bi bi-person-dash" aria-hidden="true"></i></button>`
					: '';
			return `<li class="cht-person">${faceMarkup(personKey, 'sm', true)}<span class="cht-person-text"><span class="cht-person-name">${htmlSafe(person.name)}${isSelf(personKey) ? ' <span class="cht-quiet">(you)</span>' : ''}</span><span class="cht-person-meta">${htmlSafe(person.title)} · ${PRESENCE_PHRASE[person.presence]}</span></span>${removeButton}</li>`;
		});
		const total = countOf(roster.length, 'member');
		return `<p class="cht-panel-count">${needle ? `${shownIds.length} of ${total}` : total}</p><ul class="cht-people">${rows.join('')}</ul>`;
	}

	/* Every attachment in the channel, newest first. */
	function filesTab(channel) {
		const shared = [];
		for (const message of roomFeed(channel.id)) {
			for (const file of message.files || []) shared.push({ file, message });
		}
		if (!shared.length) return blankSlate('files');
		const rows = shared
			.reverse()
			.map(
				({ file, message }) =>
					`<li><button type="button" class="cht-filelist-item" data-chat-goto-msg="${htmlSafe(message.id)}"><i class="bi bi-file-earmark" aria-hidden="true"></i><span class="cht-filelist-text"><span class="cht-filelist-name">${htmlSafe(file.name)}</span><span class="cht-filelist-meta">${sizeText(file.size)} · ${htmlSafe(personFor(message.by).name)} · ${dayText(message.at)}</span></span></button></li>`,
			);
		return `<ul class="cht-filelist">${rows.join('')}</ul>`;
	}

	/**
	 * One row in search results, mentions, saved or pinned. Block tags are
	 * flattened and links turned to text, since the whole row is a button.
	 * @param {{msg: object, parent: object|null}} hit
	 * @param {{query?: string, unpin?: boolean, unsave?: boolean}} [options]
	 */
	function resultRow(hit, options) {
		const row = options || {};
		const message = hit.msg;
		const channel = channelsById.get(hit.parent ? hit.parent.ch : message.ch);
		const excerpt = renderMarkup(message.text, { query: row.query || '' })
			.replace(/<\/?(p|ul|li|blockquote|pre)[^>]*>/g, ' ')
			.replace(/<button[^>]*>([^<]*)<\/button>/g, '<span class="cht-chref">$1</span>')
			.replace(/<a [^>]*>([^<]*)<\/a>/g, '$1');
		const unpinButton = row.unpin
			? `<button type="button" class="btn btn-icon cht-result-x" data-chat-pin="${htmlSafe(message.id)}" aria-label="Unpin this message" data-bs-toggle="tooltip" data-bs-title="Unpin"><i class="bi bi-pin-angle-fill" aria-hidden="true"></i></button>`
			: '';
		const unsaveButton = row.unsave
			? `<button type="button" class="btn btn-icon cht-result-x" data-chat-save="${htmlSafe(message.id)}" aria-label="Remove from saved" data-bs-toggle="tooltip" data-bs-title="Remove from saved"><i class="bi bi-bookmark-x" aria-hidden="true"></i></button>`
			: '';
		return `<li class="cht-result"><button type="button" class="cht-result-go" data-chat-goto-msg="${htmlSafe(message.id)}"><span class="cht-result-head">${faceMarkup(message.by, 'xs')}<span class="cht-result-name">${htmlSafe(personFor(message.by).name)}</span><span class="cht-result-where">#${htmlSafe(channel.name)}${hit.parent ? ', thread' : ''} · ${whenText(message.at)}</span></span><span class="cht-result-text">${excerpt}</span></button>${unpinButton}${unsaveButton}</li>`;
	}

	function drawMessageList(kindOfList) {
		const mentionsList = kindOfList === 'mentions';
		const matches = mentionsList ? mentionHits() : savedHits();
		dom.panelTitle.textContent = mentionsList ? 'Mentions' : 'Saved';
		dom.panelSub.textContent = mentionsList
			? 'Messages that name you'
			: `${countOf(matches.length, 'message')} to come back to`;
		dom.panelContent.innerHTML = matches.length
			? `<ul class="cht-results">${matches.map((hit) => resultRow(hit, { unsave: kindOfList === 'saved' })).join('')}</ul>`
			: blankSlate(kindOfList);
	}

	/* A result was clicked: open its channel, and its thread when it is a reply. */
	function goToResult(messageId) {
		const found = lookupMessage(messageId);
		if (!found) return;
		const channelKey = found.parent ? found.parent.ch : found.msg.ch;
		const restorePanel = session.side.type !== 'details';
		const previousPanel = session.side;
		showChannel(channelKey, { msg: found.parent ? null : messageId });
		if (found.parent) {
			showThread(found.parent.id, { focusReply: messageId });
			return;
		}
		if (restorePanel && !isNarrow()) showSidePanel(previousPanel, { focus: false });
		placeCursor(messageId, true);
	}

	/* Search. */

	/**
	 * Every word has to appear in the text, the author's name or a file name.
	 * @param {{channel: string|null, from: string}} filters channel limits the
	 *   search to one room; without it only joined rooms are searched.
	 */
	function searchInMemory(term, filters) {
		const terms = simplify(term).split(/\s+/).filter(Boolean);
		const matches = [];
		function isHit(message) {
			const haystack = simplify(
				`${toPlain(message.text)} ${personFor(message.by).name} ${(message.files || []).map((file) => file.name).join(' ')}`,
			);
			return terms.every((word) => haystack.includes(word)) && (!filters.from || message.by === filters.from);
		}
		for (const message of workspace.messages) {
			const channel = channelsById.get(message.ch);
			if (!channel || message.deleted || message.kind === 'event') continue;
			if (filters.channel ? message.ch !== filters.channel : !channel.joined) continue;
			if (isHit(message)) matches.push({ msg: message, parent: null });
			for (const reply of message.replies || []) {
				if (!reply.deleted && isHit(reply)) matches.push({ msg: reply, parent: message });
			}
		}
		return newestFirst(matches);
	}

	/* Runs the current query. A ticket drops answers that come back after a newer request. */
	function startSearch() {
		const term = session.searchText.trim();
		if (term.length < 2) {
			session.searchHits = null;
			if (isPanel('search')) drawSidePanel();
			return;
		}
		const ticket = ++searchTicket;
		session.isSearching = true;
		if (isPanel('search')) drawSidePanel();
		server
			.searchMessages(term, {
				channel: session.searchScope === 'here' ? session.openId : null,
				from: session.searchFrom,
			})
			.then((results) => {
				if (ticket !== searchTicket) return;
				session.isSearching = false;
				session.searchHits = results;
				if (isPanel('search')) drawSidePanel();
				announce(results.length ? `${countOf(results.length, 'message')} found` : 'No messages found');
			});
	}

	function drawSearch() {
		dom.panelTitle.textContent = 'Search';
		const term = session.searchText.trim();
		dom.panelSub.textContent = term ? `“${term}”` : 'Messages and replies';
		if (term.length < 2) {
			dom.panelContent.innerHTML = blankSlate('searchhint');
			return;
		}
		if (session.isSearching && !session.searchHits) {
			dom.panelContent.innerHTML = `<ul class="cht-results" aria-hidden="true">${'<li class="cht-result cht-result-skel"><span class="basalt-skeleton basalt-skeleton-text cht-skel-name"></span><span class="basalt-skeleton basalt-skeleton-text"></span></li>'.repeat(3)}</ul>`;
			return;
		}
		const results = session.searchHits || [];
		dom.panelContent.innerHTML = results.length
			? `<p class="cht-panel-count" aria-live="polite">${countOf(results.length, 'result')}</p><ul class="cht-results">${results.map((hit) => resultRow(hit, { query: term })).join('')}</ul>`
			: blankSlate('search');
	}

	/* The composer. */

	function fitTextarea(field) {
		field.style.height = 'auto';
		field.style.height = `${Math.min(field.scrollHeight + 2, 220)}px`;
	}

	function syncSendButton() {
		dom.send.disabled = !dom.input.value.trim() && !session.attachments.length;
	}

	function syncReplyButton() {
		dom.replySend.disabled = !dom.replyInput.value.trim();
	}

	function drawPendingFiles() {
		dom.files.hidden = !session.attachments.length;
		dom.files.innerHTML = session.attachments
			.map(
				(file, index) =>
					`<li class="cht-files-item"><i class="bi bi-file-earmark" aria-hidden="true"></i><span class="cht-files-name">${htmlSafe(file.name)}</span><span class="cht-files-size">${sizeText(file.size)}</span><button type="button" class="btn btn-icon cht-files-x" data-chat-file-remove="${index}" aria-label="Remove ${htmlSafe(file.name)}"><i class="bi bi-x-lg" aria-hidden="true"></i></button></li>`,
			)
			.join('');
		syncSendButton();
	}

	/* The @, # and / buttons: a slash replaces the box, the others go in at the caret. */
	function insertTrigger(trigger) {
		const field = dom.input;
		field.focus();
		if (trigger === '/') {
			field.value = '/';
			field.setSelectionRange(1, 1);
		} else {
			const caret = field.selectionStart;
			const spacer = caret && !/\s/.test(field.value.charAt(caret - 1)) ? ' ' : '';
			field.setRangeText(`${spacer}${trigger}`, caret, field.selectionEnd, 'end');
		}
		field.dispatchEvent(new Event('input', { bubbles: true }));
	}

	/**
	 * Applies a formatting button to the selection. Inline styles wrap it and
	 * keep it selected; link and code block insert a template with the part to
	 * edit selected; list and quote prefix every selected line.
	 * @param {'bold'|'italic'|'strike'|'code'|'link'|'block'|'list'|'quote'} mode
	 */
	function wrapSelection(field, mode) {
		const selStart = field.selectionStart;
		const selEnd = field.selectionEnd;
		const selected = field.value.slice(selStart, selEnd);
		const wrapper = { bold: '*', italic: '_', strike: '~', code: '`' }[mode];
		if (mode !== 'link' && mode !== 'block' && !wrapper) {
			const marker = mode === 'list' ? '- ' : '> ';
			const lineHead = field.value.lastIndexOf('\n', selStart - 1) + 1;
			const prefixed = field.value
				.slice(lineHead, selEnd)
				.split('\n')
				.map((row) => `${marker}${row}`)
				.join('\n');
			field.setRangeText(prefixed, lineHead, selEnd, 'end');
			field.focus();
			field.dispatchEvent(new Event('input', { bubbles: true }));
			return;
		}
		let insert;
		let selectFrom;
		let selectTo;
		if (wrapper) {
			insert = `${wrapper}${selected}${wrapper}`;
			selectFrom = selStart + 1;
			selectTo = selStart + 1 + selected.length;
		} else if (mode === 'link') {
			const linkText = selected || 'link text';
			insert = `[${linkText}](https://)`;
			selectFrom = selStart + linkText.length + 3;
			selectTo = selectFrom + 8;
		} else {
			insert = `\`\`\`\n${selected || ''}\n\`\`\``;
			selectFrom = selStart + 4;
			selectTo = selectFrom + selected.length;
		}
		field.setRangeText(insert, selStart, selEnd, 'end');
		field.focus();
		field.setSelectionRange(selectFrom, selectTo);
		field.dispatchEvent(new Event('input', { bubbles: true }));
	}

	/*
	 * Completion for @people, #channels and /commands. A slash only counts at
	 * the very start of the main composer; @ and # count after a space or at
	 * the start of the text.
	 */
	function triggerAt(field) {
		const textBefore = field.value.slice(0, field.selectionStart);
		const slashMatch = textBefore.match(/^\/([a-z]*)$/i);
		if (slashMatch && field === dom.input) return { kind: '/', q: slashMatch[1], from: 0 };
		const matchResult = textBefore.match(/(^|\s)([@#])([\w.-]*)$/);
		if (!matchResult) return null;
		return { kind: matchResult[2], q: matchResult[3], from: textBefore.length - matchResult[3].length - 1 };
	}

	function completionChoices(token) {
		const needle = simplify(token.q);
		const channel = activeChannel();
		const inChannel = (personKey) => !!(channel && channel.members.includes(personKey));
		if (token.kind === '@') {
			return Array.from(peopleById.values())
				.filter(
					(person) =>
						!person.bot &&
						!isSelf(person.id) &&
						(simplify(person.name)
							.split(' ')
							.some((word) => word.startsWith(needle)) ||
							simplify(person.id).startsWith(needle)),
				)
				.sort(
					(left, right) =>
						(channel && channel.members.includes(right.id)) -
							(channel && channel.members.includes(left.id)) || left.name.localeCompare(right.name),
				)
				.slice(0, 6)
				.map((person) => ({
					value: `@${person.id} `,
					label: person.name,
					hint: `${channel && !inChannel(person.id) ? 'Not in this channel · ' : ''}${person.title}`,
					face: person.id,
				}));
		}
		if (token.kind === '#') {
			return Array.from(channelsById.values())
				.filter(
					(room) => !room.archived && (room.joined || !room.private) && simplify(room.name).includes(needle),
				)
				.slice(0, 6)
				.map((room) => ({
					value: `#${room.name} `,
					label: room.name,
					hint: room.joined ? room.topic : 'Not joined',
					icon: channelGlyph(room),
				}));
		}
		return SLASH_COMMANDS.filter((command) => command.name.startsWith(needle)).map((command) => ({
			value: `/${command.name} `,
			label: `/${command.name}${command.args ? ` ${command.args}` : ''}`,
			hint: command.text,
			icon: 'bi-slash-square',
		}));
	}

	/* Opens or refreshes the list above whichever box is being typed in. */
	function showCompletions(field) {
		const token = triggerAt(field);
		if (!token) {
			hideCompletions();
			return;
		}
		const choices = completionChoices(token);
		if (!choices.length) {
			hideCompletions();
			return;
		}
		completion = { kind: token.kind, from: token.from, items: choices, active: 0, target: field };
		const owner = field === dom.input ? dom.composer : dom.reply;
		if (dom.suggest.parentElement !== owner) owner.prepend(dom.suggest);
		const heading = { '@': 'People', '#': 'Channels', '/': 'Commands' }[token.kind];
		const options = choices.map(
			(option, index) =>
				`<div class="cht-suggest-item${index === 0 ? ' is-active' : ''}" role="option" id="cht-sug-${index}" aria-selected="${index === 0}" data-i="${index}">${option.face ? faceMarkup(option.face, 'xs') : `<span class="cht-suggest-icon" aria-hidden="true"><i class="bi ${option.icon}"></i></span>`}<span class="cht-suggest-label">${htmlSafe(option.label)}</span><span class="cht-suggest-hint">${htmlSafe(option.hint)}</span></div>`,
		);
		dom.suggest.innerHTML = `<p class="cht-suggest-head" aria-hidden="true">${heading}</p>${options.join('')}`;
		dom.suggest.hidden = false;
		paintAvatars(dom.suggest);
		field.setAttribute('aria-controls', 'cht-suggest');
		field.setAttribute('aria-activedescendant', 'cht-sug-0');
	}

	function stepCompletion(step) {
		if (!completion) return;
		const total = completion.items.length;
		completion.active = (completion.active + step + total) % total;
		for (const [index, option] of pickAll('.cht-suggest-item', dom.suggest).entries()) {
			option.classList.toggle('is-active', index === completion.active);
			option.setAttribute('aria-selected', String(index === completion.active));
		}
		completion.target.setAttribute('aria-activedescendant', `cht-sug-${completion.active}`);
		const activeNode = pick(`#cht-sug-${completion.active}`);
		if (activeNode) activeNode.scrollIntoView({ block: 'nearest' });
	}

	/** Replaces the typed trigger with the chosen value; without an index, the highlighted one. */
	function acceptCompletion(choice) {
		if (!completion) return;
		const chosen = completion.items[choice == null ? completion.active : choice];
		const field = completion.target;
		field.setRangeText(chosen.value, completion.from, field.selectionStart, 'end');
		hideCompletions();
		field.focus();
		field.dispatchEvent(new Event('input', { bubbles: true }));
	}

	function hideCompletions() {
		if (!completion) {
			dom.suggest.hidden = true;
			return;
		}
		completion.target.removeAttribute('aria-activedescendant');
		completion = null;
		dom.suggest.hidden = true;
		dom.suggest.innerHTML = '';
	}

	/**
	 * Keys shared by the composer and the reply box: the completion list
	 * first, then Ctrl/Cmd+B and +I, Enter to send (not inside an open code
	 * fence), and Up on an empty composer to edit your last message.
	 * @param {() => void} send submits the box the key was pressed in.
	 */
	function handleComposerKey(event, field, send) {
		if (completion && completion.target === field) {
			const listKeys = {
				ArrowDown: () => stepCompletion(1),
				ArrowUp: () => stepCompletion(-1),
				Enter: () => acceptCompletion(),
				Tab: () => acceptCompletion(),
				Escape: () => {
					event.stopPropagation();
					hideCompletions();
				},
			};
			if (listKeys[event.key]) {
				event.preventDefault();
				listKeys[event.key]();
				return;
			}
		}
		if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === 'b' || event.key === 'i')) {
			event.preventDefault();
			wrapSelection(field, event.key === 'b' ? 'bold' : 'italic');
			return;
		}
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			const textBefore = field.value.slice(0, field.selectionStart);
			if ((textBefore.match(/```/g) || []).length % 2 === 1) return;
			event.preventDefault();
			send();
			return;
		}
		if (event.key === 'ArrowUp' && field === dom.input && !field.value) {
			const ownMessages = roomFeed(session.openId).filter(
				(message) => isSelf(message.by) && message.kind !== 'event',
			);
			if (!ownMessages.length) return;
			event.preventDefault();
			beginEdit(ownMessages[ownMessages.length - 1].id);
		}
	}

	function makeId(prefix) {
		idCounter += 1;
		return `${prefix}${Date.now().toString(36)}${idCounter}`;
	}

	/*
	 * Posts the composer's text and files. The message shows at once marked as
	 * sending; if the request fails it is taken out again and the text goes
	 * back in the box, unless something new was typed meanwhile.
	 */
	function sendFromComposer(event) {
		event.preventDefault();
		const channel = activeChannel();
		if (!channel || !channel.joined || channel.archived) return;
		const content = dom.input.value.replace(/\s+$/, '');
		if (!content.trim() && !session.attachments.length) return;
		if (/^\/\w+/.test(content.trim())) {
			runSlash(content.trim());
			return;
		}
		const outgoing = {
			id: makeId('m'),
			ch: channel.id,
			by: workspace.me,
			at: localStamp(clockNow()),
			text: content,
			files: session.attachments.slice(),
			reactions: {},
			replies: [],
			sending: true,
			fresh: true,
		};
		workspace.messages.push(outgoing);
		const savedText = dom.input.value;
		const savedFiles = session.attachments.slice();
		dom.input.value = '';
		session.attachments = [];
		delete session.draftsByChannel[channel.id];
		fitTextarea(dom.input);
		drawPendingFiles();
		session.markerId = null;
		markChannelRead(channel, true);
		drawFeed({ bottom: true });
		drawSidebar();
		server
			.postMessage(channel.id, outgoing)
			.then(() => {
				delete outgoing.sending;
				const messageNode = document.getElementById(`dm-${outgoing.id}`);
				if (messageNode) {
					messageNode.classList.remove('is-sending');
					const flag = pick('.cht-msg-flag:last-child', messageNode);
					if (flag && flag.textContent.trim() === 'Sending') flag.remove();
				}
				announce(`Sent to #${channel.name}`);
				scheduleAnswer(channel.id, null);
			})
			.catch(() => {
				workspace.messages.splice(workspace.messages.indexOf(outgoing), 1);
				if (session.openId === channel.id) {
					if (!dom.input.value) {
						dom.input.value = savedText;
						session.attachments = savedFiles;
						fitTextarea(dom.input);
						drawPendingFiles();
					}
					drawFeed({ keep: true });
				}
				popToast({
					tone: 'danger',
					title: 'Your message was not sent',
					text: 'It is back in the box so you can try again.',
				});
			});
	}

	/* Posts a thread reply, and a copy to the channel when "Also send" is ticked. */
	function sendFromThread(event) {
		event.preventDefault();
		if (!isPanel('thread')) return;
		const found = lookupMessage(session.side.id);
		const content = dom.replyInput.value.replace(/\s+$/, '');
		if (!content.trim() || !found) return;
		const head = found.msg;
		const channel = channelsById.get(head.ch);
		const newReply = {
			id: makeId('r'),
			by: workspace.me,
			at: localStamp(clockNow()),
			text: content,
			reactions: {},
			fresh: true,
		};
		head.replies = head.replies || [];
		head.replies.push(newReply);
		let mirror = null;
		if (dom.alsoSend.checked) {
			mirror = {
				id: makeId('m'),
				ch: channel.id,
				by: workspace.me,
				at: newReply.at,
				text: `${content}\n_Replied to a thread_`,
				reactions: {},
				replies: [],
			};
			workspace.messages.push(mirror);
		}
		dom.replyInput.value = '';
		dom.alsoSend.checked = false;
		fitTextarea(dom.replyInput);
		drawThread();
		paintAvatars(dom.panelBody);
		dom.thread.scrollIntoView({ block: 'end' });
		dom.panelBody.scrollTop = dom.panelBody.scrollHeight;
		drawFeed({ keep: true });
		server
			.postReply(head.id, { text: content, alsoSend: !!mirror })
			.then(() => {
				announce('Reply sent');
				scheduleAnswer(channel.id, head.id);
			})
			.catch(() => {
				head.replies.splice(head.replies.indexOf(newReply), 1);
				if (mirror) workspace.messages.splice(workspace.messages.indexOf(mirror), 1);
				if (!dom.replyInput.value) dom.replyInput.value = content;
				if (session.side && session.side.id === head.id) drawSidePanel();
				drawFeed({ keep: true });
				popToast({
					tone: 'danger',
					title: 'Your reply was not sent',
					text: 'It is back in the box so you can try again.',
				});
			});
	}

	/* A one-line system note in the feed, such as "You joined #sales". */
	function logEvent(channel, content, glyphClass) {
		const note = {
			id: makeId('ev'),
			ch: channel.id,
			kind: 'event',
			by: workspace.me,
			at: localStamp(clockNow()),
			text: content,
			icon: glyphClass,
		};
		workspace.messages.push(note);
		return note;
	}

	/* Handles a line that starts with a known /command instead of posting it. */
	function runSlash(commandLine) {
		const channel = activeChannel();
		const [, rawName, rawArgument] = commandLine.match(/^\/(\w+)\s*([\s\S]*)$/);
		const commandName = rawName.toLowerCase();
		const argument = rawArgument.trim();
		function resetComposer() {
			dom.input.value = '';
			fitTextarea(dom.input);
			syncSendButton();
			hideCompletions();
		}
		if (!SLASH_COMMANDS.some((entry) => entry.name === commandName)) {
			popToast({
				tone: 'warning',
				title: `There is no /${commandName} command`,
				text: 'Type / to see the commands you can use.',
			});
			return;
		}
		const handlers = {
			topic() {
				if (!argument) {
					popToast({ tone: 'warning', title: 'Add the new topic after /topic' });
					return;
				}
				resetComposer();
				saveChannel(channel, { topic: argument }, 'Topic changed');
				logEvent(channel, `You set the topic: ${argument}`, 'bi-chat-quote');
				drawFeed({ bottom: true });
			},
			invite() {
				const handle = (argument.match(/@?([\w.-]+)/) || [])[1];
				const person =
					handle &&
					(peopleById.get(handle.toLowerCase()) ||
						Array.from(peopleById.values()).find((candidate) =>
							simplify(candidate.name).startsWith(simplify(handle)),
						));
				if (!person) {
					popToast({
						tone: 'warning',
						title: 'Who should join?',
						text: 'Write /invite and then @ with their name.',
					});
					return;
				}
				resetComposer();
				inviteMember(channel, person.id);
			},
			remind() {
				resetComposer();
				const remindAt = new Date(clockNow());
				remindAt.setHours(15, 0, 0, 0);
				const what = argument || `Look at #${channel.name}`;
				server
					.addReminder(what, localStamp(remindAt))
					.then(() =>
						popToast({ tone: 'success', icon: 'bi-alarm', title: 'Reminder set for 3:00 pm', text: what }),
					)
					.catch(() =>
						popToast({ tone: 'danger', title: 'The reminder was not set', text: 'Try again in a moment.' }),
					);
			},
			mute() {
				resetComposer();
				flipMute(channel);
			},
			away() {
				resetComposer();
				changePresence('away');
			},
			shrug() {
				dom.input.value = `${argument ? `${argument} ` : ''}¯\\_(ツ)_/¯`;
				dom.composer.requestSubmit();
			},
			leave() {
				resetComposer();
				quitChannel(channel);
			},
			shortcuts() {
				resetComposer();
				dialogFor('cht-keys').show();
			},
		};
		handlers[commandName]();
	}

	/* Replies from other people. The demo fakes them with timers; a socket would call deliver(). */

	function showTypingFor(channelKey, author) {
		if (channelKey !== session.openId) return;
		dom.typing.innerHTML = `<span class="basalt-typing cht-typing"><span class="basalt-loading-dots" aria-hidden="true"><span></span><span></span><span></span></span></span><span class="cht-typing-text">${htmlSafe(personFor(author).name)} is typing</span>`;
		dom.typing.classList.add('is-on');
		clearTimeout(typingHide);
		typingHide = setTimeout(clearTyping, 4000);
	}

	function clearTyping() {
		dom.typing.classList.remove('is-on');
		dom.typing.innerHTML = '';
	}

	/*
	 * After your first post in a channel, or your first reply in a thread,
	 * someone answers once. Thread answers come from the head's author, or the
	 * first other person in the thread when you started it.
	 */
	function scheduleAnswer(channelKey, threadId) {
		const answerKey = threadId ? `thread:${threadId}` : channelKey;
		if (session.repliedTo[answerKey] || demoMode === 'flaky') return;
		session.repliedTo[answerKey] = true;
		if (threadId) {
			const head = lookupMessage(threadId).msg;
			const author = isSelf(head.by) ? (head.replies.find((reply) => !isSelf(reply.by)) || {}).by : head.by;
			if (!author) return;
			setTimeout(
				() =>
					deliver({
						ch: channelKey,
						parent: threadId,
						by: author,
						text: SAMPLE_WORKSPACE.answers.thread.text,
					}),
				2600,
			);
			return;
		}
		const answer = SAMPLE_WORKSPACE.answers[channelKey];
		if (!answer) return;
		setTimeout(() => showTypingFor(channelKey, answer.by), 900);
		setTimeout(() => {
			clearTyping();
			deliver({ ch: channelKey, by: answer.by, text: answer.text });
		}, 3200);
	}

	/**
	 * Adds a message from someone else.
	 * @param {{ch: string, by: string, text: string, files?: object[], parent?: string}} message
	 *   parent makes it a reply in that thread.
	 */
	function deliver(message) {
		const channel = channelsById.get(message.ch);
		if (!channel) return;
		const incoming = {
			id: makeId('in'),
			ch: message.ch,
			by: message.by,
			at: localStamp(clockNow()),
			text: message.text,
			files: message.files || [],
			reactions: {},
			replies: [],
		};
		if (message.parent) {
			deliverReply(channel, message, incoming);
			return;
		}
		workspace.messages.push(incoming);
		if (session.openId === channel.id) {
			const wasAtEnd = isScrolledToEnd();
			incoming.fresh = true;
			drawFeed({ keep: true });
			if (wasAtEnd && !document.hidden) {
				markChannelRead(channel);
			} else {
				session.unseenCount += 1;
				dom.jumpLabel.textContent = countOf(session.unseenCount, 'new message');
				dom.jump.hidden = false;
			}
		}
		drawSidebar();
		if (!channel.muted) announce(`${personFor(message.by).name} in #${channel.name}: ${toPlain(message.text)}`);
	}

	function deliverReply(channel, message, incoming) {
		const found = lookupMessage(message.parent);
		if (!found) return;
		delete incoming.ch;
		delete incoming.replies;
		found.msg.replies.push(incoming);
		if (isPanel('thread') && session.side.id === message.parent) {
			incoming.fresh = true;
			drawThread();
			paintAvatars(dom.panelBody);
			dom.panelBody.scrollTop = dom.panelBody.scrollHeight;
		}
		if (session.openId === channel.id) drawFeed({ keep: true });
		announce(`${personFor(message.by).name} replied in the thread: ${toPlain(message.text)}`);
	}

	/*
	 * Actions on one message. Each one changes the page straight away, then
	 * tells the server; when the server refuses, the change is reverted and
	 * an error toast explains what did not happen.
	 */

	/** Builds the catch handler: undo the change, redraw, and say what failed. */
	function rollbackWith(actionText, revert) {
		return () => {
			if (revert) revert();
			redrawAll();
			popToast({
				tone: 'danger',
				title: `Could not ${actionText}`,
				text: 'Nothing was changed. Try again in a moment.',
			});
		};
	}

	function redrawAll() {
		drawSidebar();
		drawHeader();
		drawFeed({ keep: true });
		if (session.side) drawSidePanel();
	}

	/** Redraws everything and, if focus was inside that message, puts it back on the same control. */
	function redrawKeepingFocus(messageId, selector) {
		const focused = document.activeElement;
		const wasInPanel = dom.panel.contains(focused);
		const focusInside = focused && focused.closest && focused.closest(`[data-msg="${messageId}"]`);
		redrawAll();
		if (!focusInside) return;
		const messageNode = pick(`[data-msg="${messageId}"]`, wasInPanel ? dom.panelBody : dom.feed);
		const focusTarget = messageNode && ((selector && pick(selector, messageNode)) || messageNode);
		if (focusTarget) focusTarget.focus();
	}

	function flipReaction(messageId, symbol) {
		const found = lookupMessage(messageId);
		if (!found) return;
		const message = found.msg;
		message.reactions = message.reactions || {};
		const adding = !(message.reactions[symbol] || []).includes(workspace.me);
		toggleReactor(message, symbol, adding);
		server
			.setReaction(messageId, symbol, adding)
			.catch(
				rollbackWith(adding ? 'add the reaction' : 'remove the reaction', () =>
					toggleReactor(message, symbol, !adding),
				),
			);
		redrawKeepingFocus(messageId, `[data-emoji="${symbol}"]`);
		announce(`${adding ? 'Added ' : 'Removed '}${EMOJI_LABELS[symbol] || symbol}`);
	}

	/* Adds or removes you under one emoji; an emoji nobody uses any more is dropped. */
	function toggleReactor(message, symbol, adding) {
		message.reactions[symbol] = message.reactions[symbol] || [];
		const reactors = message.reactions[symbol];
		if (adding) reactors.push(workspace.me);
		else reactors.splice(reactors.indexOf(workspace.me), 1);
		if (!reactors.length) delete message.reactions[symbol];
	}

	function flipPin(messageId) {
		const found = lookupMessage(messageId);
		if (!found || found.parent) return;
		const message = found.msg;
		message.pinned = !message.pinned;
		const adding = message.pinned;
		server.setPin(messageId, adding).catch(
			rollbackWith(adding ? 'pin the message' : 'unpin the message', () => {
				message.pinned = !adding;
			}),
		);
		redrawKeepingFocus(messageId);
		popToast({
			tone: adding ? 'success' : 'primary',
			icon: adding ? 'bi-pin-angle-fill' : 'bi-pin-angle',
			title: adding ? `Pinned to #${channelsById.get(message.ch).name}` : 'Unpinned',
			actions: [
				{
					label: 'Undo',
					onClick() {
						message.pinned = !adding;
						server.setPin(messageId, !adding);
						redrawAll();
					},
				},
			],
		});
	}

	function flipSaved(messageId) {
		const found = lookupMessage(messageId);
		if (!found) return;
		const message = found.msg;
		message.saved = !message.saved;
		const adding = message.saved;
		server.setSaved(messageId, adding).catch(
			rollbackWith(adding ? 'save the message' : 'remove it from saved', () => {
				message.saved = !adding;
			}),
		);
		redrawKeepingFocus(messageId);
		announce(adding ? 'Saved for later' : 'Removed from saved');
	}

	/* Only your own messages can be deleted, and the toast offers them back. */
	function removeOwnMessage(messageId) {
		const found = lookupMessage(messageId);
		if (!found || !isSelf(found.msg.by)) return;
		const message = found.msg;
		message.deleted = true;
		server.removeMessage(messageId).catch(
			rollbackWith('delete the message', () => {
				message.deleted = false;
			}),
		);
		if (isPanel('thread') && session.side.id === messageId) hideSidePanel(true);
		redrawAll();
		popToast({
			tone: 'primary',
			icon: 'bi-trash3',
			title: found.parent ? 'Reply deleted' : 'Message deleted',
			text: toPlain(message.text).slice(0, 80),
			actions: [
				{
					label: 'Undo',
					onClick() {
						message.deleted = false;
						server.undoRemove(messageId);
						redrawAll();
						announce('Put back');
					},
				},
			],
		});
		if (!found.parent) dom.input.focus();
	}

	/* Swaps a message for an edit box. Replies are not edited in place; asking for one only ends any edit. */
	function beginEdit(messageId) {
		const found = lookupMessage(messageId);
		if (!found || !isSelf(found.msg.by) || found.msg.kind === 'event') return;
		session.editingId = found.parent ? null : messageId;
		if (found.parent) return;
		drawFeed({ keep: true });
		const field = pick('[data-chat-edit-input]', dom.feed);
		if (!field) return;
		fitTextarea(field);
		field.focus();
		field.setSelectionRange(field.value.length, field.value.length);
		field.scrollIntoView({ block: 'nearest' });
	}

	/** Leaves edit mode; with commit, a changed, non-empty text is saved. */
	function endEdit(commit) {
		const messageId = session.editingId;
		if (!messageId) return;
		const found = lookupMessage(messageId);
		const field = pick('[data-chat-edit-input]', dom.feed);
		const content = field ? field.value.replace(/\s+$/, '') : '';
		session.editingId = null;
		if (commit && found && content.trim() && content !== found.msg.text) {
			const previous = { text: found.msg.text, edited: found.msg.edited };
			found.msg.text = content;
			found.msg.edited = true;
			server
				.updateMessage(messageId, content)
				.catch(rollbackWith('save your edit', () => Object.assign(found.msg, previous)));
			announce('Message edited');
		}
		drawFeed({ keep: true });
		placeCursor(messageId, true);
	}

	/* Moves lastRead to just before this message and keeps it there until the channel is read again. */
	function unreadFrom(messageId) {
		const found = lookupMessage(messageId);
		if (!found || found.parent) return;
		const channel = channelsById.get(found.msg.ch);
		const previousRead = channel.lastRead;
		channel.lastRead = localStamp(new Date(asDate(found.msg.at).getTime() - 1000));
		session.holdUnread = true;
		session.markerId = messageId;
		server.setLastRead(channel.id, channel.lastRead).catch(
			rollbackWith('mark it unread', () => {
				channel.lastRead = previousRead;
			}),
		);
		drawFeed({ keep: true });
		drawSidebar();
		announce('Marked unread from this message');
	}

	function copyMessageLink(messageId) {
		const found = lookupMessage(messageId);
		const channel = channelsById.get(found.parent ? found.parent.ch : found.msg.ch);
		const address = `${location.origin}${location.pathname}#${channel.name}/${messageId}`;
		copyText(address)
			.then(() =>
				popToast({
					tone: 'success',
					icon: 'bi-link-45deg',
					title: 'Link copied',
					text: `It opens this message in #${channel.name}.`,
				}),
			)
			.catch(() => popToast({ tone: 'warning', title: 'Could not copy the link', text: address }));
	}

	function copyText(value) {
		return window.Basalt.copyText ? window.Basalt.copyText(value) : Promise.reject();
	}

	/* The context menu's choices, run on the next tick so the menu can close first. */
	function runMessageAction(action, messageId) {
		if (!messageId) return;
		const actions = {
			thread: () => showThread(messageId),
			react: () => openReactionPicker(messageId),
			pin: () => flipPin(messageId),
			save: () => flipSaved(messageId),
			link: () => copyMessageLink(messageId),
			unread: () => unreadFrom(messageId),
			edit: () => beginEdit(messageId),
			delete: () => removeOwnMessage(messageId),
		};
		actions[action]?.();
	}

	/**
	 * Clicks that mean the same thing in the feed and in the side panel.
	 * @returns {boolean} true when the click was handled here.
	 */
	function handleMessageClick(event) {
		const routes = [
			[
				'[data-chat-reaction]',
				(button) => flipReaction(button.getAttribute('data-chat-reaction'), button.getAttribute('data-emoji')),
			],
			[
				'[data-chat-reaction-add]',
				(button) => {
					if (!dom.emoji.hidden && emojiOpener === button) hideEmojiPicker(true);
					else showEmojiPicker(button, { msg: button.getAttribute('data-chat-reaction-add') });
				},
			],
			['[data-chat-open-thread]', (button) => showThread(button.getAttribute('data-chat-open-thread'))],
			['[data-chat-pin]', (button) => flipPin(button.getAttribute('data-chat-pin'))],
			['[data-chat-save]', (button) => flipSaved(button.getAttribute('data-chat-save'))],
			['[data-chat-goto]', (button) => showChannel(button.getAttribute('data-chat-goto'), { focus: 'title' })],
			[
				'[data-chat-download]',
				(button) => {
					const [messageId, slot] = button.getAttribute('data-chat-download').split(':');
					const file = lookupMessage(messageId).msg.files[+slot];
					popToast({
						tone: 'info',
						icon: 'bi-download',
						title: `Downloading ${file.name}`,
						text: sizeText(file.size),
					});
				},
			],
			/* The ... button opens the same context menu a right-click would, just below it. */
			[
				'[data-chat-more]',
				(button) => {
					const bounds = button.getBoundingClientRect();
					button.dispatchEvent(
						new MouseEvent('contextmenu', {
							bubbles: true,
							cancelable: true,
							clientX: bounds.left - 150,
							clientY: bounds.bottom + 4,
						}),
					);
				},
			],
			['[data-chat-edit-cancel]', () => endEdit(false)],
		];
		for (const [selector, run] of routes) {
			const button = event.target.closest(selector);
			if (button) {
				run(button);
				return true;
			}
		}
		return false;
	}

	/* The keyboard cursor: one message at a time holds tabindex 0 and the is-cursor class. */

	function placeCursor(messageId, andFocus) {
		const oldCursor = session.cursorId && document.getElementById(`dm-${session.cursorId}`);
		if (oldCursor) oldCursor.classList.remove('is-cursor');
		for (const other of pickAll('.cht-msg[tabindex="0"]', dom.feed)) other.setAttribute('tabindex', '-1');
		session.cursorId = messageId;
		const messageNode = messageId && document.getElementById(`dm-${messageId}`);
		if (!messageNode) return;
		messageNode.classList.add('is-cursor');
		messageNode.setAttribute('tabindex', '0');
		if (!andFocus) return;
		messageNode.focus({ preventScroll: true });
		messageNode.scrollIntoView({ block: 'nearest', behavior: prefersStill() ? 'auto' : 'smooth' });
	}

	/* With no cursor yet, j starts just above the New line (or the newest message) and k at the end. */
	function stepCursor(step) {
		const order = pickAll('.cht-msg[data-msg]', dom.feed).map((item) => item.getAttribute('data-msg'));
		if (!order.length) return;
		let position = order.indexOf(session.cursorId);
		if (position < 0) {
			const markerIndex = session.markerId && order.indexOf(session.markerId);
			if (step <= 0) position = order.length;
			else position = markerIndex > 0 ? markerIndex - 1 : order.length - 2;
		}
		placeCursor(order[Math.max(0, Math.min(order.length - 1, position + step))], true);
	}

	function activeMessageId() {
		const focused = document.activeElement;
		const owner = focused && focused.closest && focused.closest('[data-msg]');
		return owner ? owner.getAttribute('data-msg') : session.cursorId;
	}

	/* The emoji picker, shared by reactions and the composer's emoji button. */

	/**
	 * Opens the picker beside its button, kept inside the viewport.
	 * @param {{msg: string}|{input: HTMLTextAreaElement}} purpose react to a message, or type into a box.
	 */
	function showEmojiPicker(opener, purpose) {
		emojiTarget = purpose;
		emojiOpener = opener;
		dom.emojiTitle.textContent = purpose.msg ? 'Add a reaction' : 'Add an emoji';
		dom.emoji.hidden = false;
		opener.scrollIntoView({ block: 'nearest' });
		const bounds = opener.getBoundingClientRect();
		const width = dom.emoji.offsetWidth;
		const height = dom.emoji.offsetHeight;
		const viewportWidth = document.documentElement.clientWidth;
		const above = bounds.top - height - 6;
		const topPx = above < 8 ? bounds.bottom + 6 : above;
		dom.emoji.style.left = `${Math.max(8, Math.min(bounds.left, viewportWidth - width - 8))}px`;
		dom.emoji.style.top = `${Math.max(8, Math.min(topPx, document.documentElement.clientHeight - height - 8))}px`;
		const emojiButtons = pickAll('.cht-emoji-btn', dom.emoji);
		for (const [index, button] of emojiButtons.entries()) button.setAttribute('tabindex', index ? '-1' : '0');
		emojiButtons[0].focus();
	}

	function hideEmojiPicker(restoreFocus) {
		if (dom.emoji.hidden) return;
		dom.emoji.hidden = true;
		if (restoreFocus && emojiOpener && emojiOpener.isConnected) emojiOpener.focus();
		emojiTarget = null;
	}

	/* The picker opened from a menu or the A key, anchored on the message's own add button. */
	function openReactionPicker(messageId) {
		const messageNode = document.getElementById(`dm-${messageId}`);
		showEmojiPicker(pick('[data-chat-reaction-add]', messageNode) || messageNode, { msg: messageId });
	}

	/* Picking an emoji you already reacted with does not take it back; it only refocuses. */
	function applyPickedEmoji(symbol) {
		const purpose = emojiTarget;
		hideEmojiPicker(false);
		if (!purpose.msg) {
			const textbox = purpose.input;
			textbox.focus();
			textbox.setRangeText(symbol, textbox.selectionStart, textbox.selectionEnd, 'end');
			textbox.dispatchEvent(new Event('input', { bubbles: true }));
			return;
		}
		const found = lookupMessage(purpose.msg);
		const alreadyMine =
			found &&
			found.msg.reactions &&
			found.msg.reactions[symbol] &&
			found.msg.reactions[symbol].includes(workspace.me);
		if (found && !alreadyMine) flipReaction(purpose.msg, symbol);
		else if (emojiOpener && emojiOpener.isConnected) emojiOpener.focus();
		const messageNode = document.getElementById(`dm-${purpose.msg}`);
		const chipButton = messageNode && pick(`[data-emoji="${symbol}"]`, messageNode);
		if (chipButton) chipButton.focus();
	}

	/* Channel-level actions: settings, mute, leave, archive, join and membership. */

	/** The channel menu's choices. Copy link is the only one offered outside members. */
	function runChannelAction(action) {
		const channel = activeChannel();
		if (!channel) return;
		const actions = {
			settings: () => showSettings(channel),
			mute: () => flipMute(channel),
			read: () => {
				markChannelRead(channel, true);
				session.holdUnread = false;
				drawSidebar();
				announce(`#${channel.name} marked as read`);
			},
			'copy-link': () => {
				const address = `${SAMPLE_WORKSPACE.link}c/${channel.name}`;
				copyText(address)
					.then(() =>
						popToast({
							tone: 'success',
							icon: 'bi-link-45deg',
							title: 'Channel link copied',
							text: address,
						}),
					)
					.catch(() => popToast({ tone: 'warning', title: 'Could not copy the link', text: address }));
			},
			leave: () => quitChannel(channel),
			archive: () => confirmArchive(channel),
		};
		actions[action]?.();
	}

	/**
	 * Applies a change to a channel, then saves it; on failure the old values
	 * come back and the returned promise rejects.
	 * @param {string} [doneMessage] read out once the server agrees.
	 */
	function saveChannel(channel, patch, doneMessage) {
		const previous = {};
		for (const [field, value] of Object.entries(patch)) {
			previous[field] = channel[field];
			channel[field] = value;
		}
		redrawAll();
		return server
			.patchChannel(channel.id, patch)
			.then(() => {
				if (doneMessage) announce(doneMessage);
			})
			.catch((reason) => {
				Object.assign(channel, previous);
				redrawAll();
				popToast({
					tone: 'danger',
					title: `Could not save #${channel.name}`,
					text: 'The channel is as it was. Try again in a moment.',
				});
				throw reason;
			});
	}

	function flipMute(channel) {
		const muting = !channel.muted;
		saveChannel(channel, { muted: muting }).catch(() => {});
		popToast({
			tone: 'primary',
			icon: muting ? 'bi-bell-slash' : 'bi-bell',
			title: `${muting ? 'Muted #' : 'Unmuted #'}${channel.name}`,
			text: muting ? 'It stays in your list without bold or counts.' : 'New messages show in bold again.',
			actions: [
				{
					label: 'Undo',
					onClick() {
						saveChannel(channel, { muted: !muting }).catch(() => {});
					},
				},
			],
		});
	}

	/* Where to go after leaving or archiving: the first other channel by name. */
	function fallbackChannel(channel) {
		const others = myChannels()
			.filter((room) => room.id !== channel.id)
			.sort((left, right) => left.name.localeCompare(right.name));
		return others[0] || null;
	}

	function showFallback(channel) {
		const successor = fallbackChannel(channel);
		if (successor) {
			showChannel(successor.id);
			return;
		}
		session.openId = null;
		drawChannel();
		drawSidebar();
	}

	function quitChannel(channel) {
		if (!channel || !channel.joined) return;
		const previous = { joined: channel.joined, members: channel.members.slice() };
		channel.joined = false;
		channel.members = channel.members.filter((personKey) => !isSelf(personKey));
		function revert() {
			channel.joined = previous.joined;
			channel.members = previous.members;
		}
		server.leaveChannel(channel.id).catch(
			rollbackWith(`leave #${channel.name}`, () => {
				revert();
				showChannel(channel.id);
			}),
		);
		closeSettings();
		showFallback(channel);
		popToast({
			tone: 'primary',
			icon: 'bi-box-arrow-right',
			title: `You left #${channel.name}`,
			text: channel.private
				? 'Someone in it will need to add you back.'
				: 'You can join again from Browse channels.',
			actions: [
				{
					label: 'Undo',
					onClick() {
						revert();
						server.joinChannel(channel.id);
						showChannel(channel.id);
						announce(`Back in #${channel.name}`);
					},
				},
			],
		});
	}

	/* Archiving asks first, in a dialog with a hold-to-confirm button. */
	function confirmArchive(channel) {
		pendingArchive = channel;
		pick('[data-chat-archive-title]', chatRoot).textContent = `Archive #${channel.name}?`;
		pick('[data-chat-archive-text]', chatRoot).textContent =
			`Its ${countOf(roomFeed(channel.id).length, 'message')} stay readable, nobody can post, and it leaves the list for all ${countOf(channel.members.length, 'member')}.`;
		closeSettings();
		dialogFor('cht-archive').show();
	}

	/** Archives (archiving true) or restores a channel. Restoring puts you back in it. */
	function setArchived(channel, archiving) {
		const previous = channel.archived;
		channel.archived = archiving ? localStamp(clockNow()).slice(0, 10) : undefined;
		if (!archiving) channel.joined = channel.members.includes(workspace.me) || channel.joined;
		server.setArchived(channel.id, archiving).catch(
			rollbackWith(archiving ? `archive #${channel.name}` : `unarchive #${channel.name}`, () => {
				channel.archived = previous;
			}),
		);
		if (!archiving) {
			if (!channel.members.includes(workspace.me)) channel.members.push(workspace.me);
			channel.joined = true;
			showChannel(channel.id);
			popToast({
				tone: 'success',
				icon: 'bi-arrow-counterclockwise',
				title: `#${channel.name} is back`,
				text: 'Everyone in it can post again.',
			});
			return;
		}
		showFallback(channel);
		popToast({
			tone: 'primary',
			icon: 'bi-archive',
			title: `Archived #${channel.name}`,
			text: 'Find it under Archived in Browse channels.',
			actions: [
				{
					label: 'Undo',
					onClick() {
						channel.archived = previous;
						server.setArchived(channel.id, false);
						showChannel(channel.id);
						announce(`#${channel.name} is back`);
					},
				},
			],
		});
	}

	/**
	 * Joins a channel, from the banner or a directory row.
	 * @param {HTMLButtonElement} [trigger] the button that shows Joining, Joined or Try again.
	 */
	function enterChannel(channelKey, trigger) {
		const channel = channelsById.get(channelKey);
		if (!channel || channel.joined) return Promise.resolve();
		const showState = (state, label) => {
			if (trigger && window.Basalt.buttonState) window.Basalt.buttonState(trigger, state, label);
		};
		showState('loading', 'Joining');
		return server
			.joinChannel(channelKey)
			.then(() => {
				channel.joined = true;
				if (!channel.members.includes(workspace.me)) channel.members.push(workspace.me);
				channel.lastRead = localStamp(clockNow());
				logEvent(channel, `You joined #${channel.name}`, 'bi-box-arrow-in-right');
				showState('success', 'Joined');
				drawSidebar();
				if (session.openId === channelKey) {
					drawChannel({ bottom: true });
					dom.input.focus();
				}
				announce(`Joined #${channel.name}`);
				/* In the directory the row says Joined for a moment before it turns into Open. */
				if (!trigger || !trigger.closest('#cht-browser')) {
					drawDirectory();
					return;
				}
				setTimeout(() => {
					const hadFocus =
						document.activeElement === trigger ||
						!document.activeElement ||
						document.activeElement === document.body;
					drawDirectory();
					const openButton = pick(`[data-chat-browse-open="${channelKey}"]`, directory.list);
					if (hadFocus && openButton) openButton.focus();
				}, 700);
			})
			.catch(() => {
				showState('error', 'Try again');
				popToast({ tone: 'danger', title: `Could not join #${channel.name}`, text: 'Try again in a moment.' });
			});
	}

	function inviteMember(channel, memberKey) {
		if (!channel || channel.members.includes(memberKey)) {
			announce(`${personFor(memberKey).name} is already in #${channel.name}`);
			return;
		}
		channel.members.push(memberKey);
		const note = logEvent(channel, `You added @${memberKey} to #${channel.name}`, 'bi-person-plus');
		server.addPerson(channel.id, memberKey).catch(
			rollbackWith(`add ${personFor(memberKey).name}`, () => {
				channel.members.splice(channel.members.indexOf(memberKey), 1);
				note.deleted = true;
			}),
		);
		redrawAll();
		drawFeed({ bottom: true });
		announce(`Added ${personFor(memberKey).name} to #${channel.name}`);
	}

	/* Focus moves to the next Remove button, or to the filter once the list has none. */
	function dropMember(channel, memberKey) {
		const position = channel.members.indexOf(memberKey);
		if (position < 0) return;
		channel.members.splice(position, 1);
		function revert() {
			if (!channel.members.includes(memberKey)) channel.members.splice(position, 0, memberKey);
		}
		server.removePerson(channel.id, memberKey).catch(rollbackWith(`remove ${personFor(memberKey).name}`, revert));
		redrawAll();
		const nextFocus = pick('[data-chat-remove-member]', dom.panelContent) || dom.memberFilter;
		if (nextFocus) nextFocus.focus();
		popToast({
			tone: 'primary',
			icon: 'bi-person-dash',
			title: `Removed ${personFor(memberKey).name}`,
			text: `from #${channel.name}`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						revert();
						server.addPerson(channel.id, memberKey);
						redrawAll();
					},
				},
			],
		});
	}

	/*
	 * The Add people field under the members tab. An exact name wins; a partial
	 * name only counts when it fits one person.
	 */
	function addMemberFromField() {
		const typed = dom.addMember.value.trim();
		if (!typed) return;
		const channel = activeChannel();
		const humans = Array.from(peopleById.values()).filter((candidate) => !candidate.bot);
		const partial = humans.filter((candidate) => simplify(candidate.name).includes(simplify(typed)));
		const person =
			humans.find((candidate) => simplify(candidate.name) === simplify(typed)) ||
			(partial.length === 1 ? partial[0] : null);
		if (!person) {
			dom.addMemberMsg.textContent = `Nobody at Fieldline is called “${typed}”.`;
			return;
		}
		if (channel.members.includes(person.id)) {
			dom.addMemberMsg.textContent = `${person.name} is already in #${channel.name}.`;
			dom.addMember.value = '';
			return;
		}
		dom.addMember.value = '';
		dom.addMemberMsg.textContent = `Added ${person.name}.`;
		inviteMember(channel, person.id);
		dom.addMember.focus();
	}

	/* Your presence: the dot on your avatar, its label, the menu's checked item and the team line. */
	function changePresence(presence) {
		const profile = myself();
		const previousPresence = profile.presence;
		profile.presence = presence;
		const choice = pick(`.cht-me [data-presence="${presence}"]`, chatRoot);
		const statusDot = pick('.cht-me [data-basalt-presence-dot]', chatRoot);
		const label = choice.textContent.trim();
		statusDot.classList.remove(
			'basalt-avatar-status-dot-online',
			'basalt-avatar-status-dot-away',
			'basalt-avatar-status-dot-busy',
		);
		statusDot.classList.add(`basalt-avatar-status-dot-${presence}`);
		pick('.cht-me [data-basalt-presence-label]', chatRoot).textContent = label;
		for (const option of pickAll('.cht-me [data-presence]', chatRoot)) {
			option.classList.toggle('active', option === choice);
			if (option === choice) option.setAttribute('aria-current', 'true');
			else option.removeAttribute('aria-current');
		}
		pick('.cht-me-btn', chatRoot).setAttribute('aria-label', `Your status: ${label}. Change status`);
		drawTeamLine();
		if (isPanel('details')) drawSidePanel();
		server.setPresence(presence).catch(
			rollbackWith('change your status', () => {
				profile.presence = previousPresence;
			}),
		);
		announce(`Your status is now ${label}`);
	}

	/* Set your status opens the menu on your avatar a tick later, so the click that closed the workspace menu cannot close it too. */
	function showStatusMenu() {
		setTimeout(() => {
			window.bootstrap.Dropdown.getOrCreateInstance(dom.statusBtn).show();
			const activeItem = pick('.cht-me .dropdown-item.active', chatRoot);
			if (activeItem) activeItem.focus();
		}, 0);
	}

	function reflectTheme() {
		dom.themeItem.setAttribute('aria-pressed', String(window.Basalt.getTheme() === 'dark'));
	}

	/* Apple keyboards get the command symbol in shortcut hints. */
	function labelModifierKeys() {
		if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) return;
		for (const hint of pickAll('[data-chat-mod-key]', chatRoot)) hint.textContent = '⌘K';
	}

	/* Reads every channel with unread messages; Undo restores each old position. */
	function markAllRead() {
		const cleared = [];
		for (const room of myChannels()) {
			if (!unreadTally(room).count) continue;
			cleared.push([room, room.lastRead]);
			markChannelRead(room, true);
		}
		session.holdUnread = false;
		drawSidebar();
		if (!cleared.length) {
			announce('Nothing unread');
			return;
		}
		popToast({
			tone: 'success',
			icon: 'bi-check2-all',
			title: `Marked ${countOf(cleared.length, 'channel')} as read`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						for (const [room, stamp] of cleared) {
							room.lastRead = stamp;
							server.setLastRead(room.id, stamp);
						}
						drawSidebar();
					},
				},
			],
		});
	}

	/* The channel directory. Private rooms only appear when you are in them. */

	function directoryRows() {
		const prefs = session.catalog;
		const needle = simplify(prefs.q.trim());
		const filters = {
			open: (room) => !room.joined && !room.archived,
			archived: (room) => !!room.archived,
		};
		const keep = filters[prefs.filter] || ((room) => !room.archived);
		const listing = Array.from(channelsById.values())
			.filter((room) => !room.private || room.joined)
			.filter(keep)
			.filter((room) => !needle || simplify(`${room.name} ${room.topic} ${room.description}`).includes(needle));
		const comparators = {
			name: (left, right) => left.name.localeCompare(right.name),
			active: (left, right) => asDate(latestActivity(right)) - asDate(latestActivity(left)),
		};
		return listing.sort(
			comparators[prefs.sort] ||
				((left, right) => right.members.length - left.members.length || left.name.localeCompare(right.name)),
		);
	}

	function restartDirectory() {
		session.catalog.page = 1;
		if (directory.pager) directory.pager.set(1);
		drawDirectory();
	}

	function drawDirectory() {
		if (!workspace || !directory.pager) return;
		const listing = directoryRows();
		const pageCount = Math.max(1, Math.ceil(listing.length / ROWS_PER_PAGE));
		directory.pager.setTotal(pageCount);
		const pageNumber = Math.min(session.catalog.page, pageCount);
		session.catalog.page = pageNumber;
		const pageRows = listing.slice((pageNumber - 1) * ROWS_PER_PAGE, pageNumber * ROWS_PER_PAGE);
		directory.pages.closest('nav').hidden = pageCount < 2;
		directory.count.textContent = listing.length
			? `${countOf(listing.length, 'channel')}${pageCount > 1 ? `, page ${pageNumber} of ${pageCount}` : ''}`
			: '';
		disposeTooltips(directory.list);
		directory.list.innerHTML = pageRows.map(directoryRow).join('');
		directory.empty.hidden = !!listing.length;
		directory.list.hidden = !listing.length;
		if (!listing.length) directory.empty.innerHTML = directoryEmpty();
	}

	function directoryRow(room) {
		let controls;
		if (room.archived)
			controls = `<button type="button" class="btn btn-outline-secondary btn-sm" data-chat-browse-open="${htmlSafe(room.id)}" aria-label="View #${htmlSafe(room.name)}">View</button>`;
		else if (room.joined)
			controls = `<button type="button" class="btn btn-outline-secondary btn-sm" data-chat-browse-open="${htmlSafe(room.id)}" aria-label="Open #${htmlSafe(room.name)}">Open</button>`;
		else
			controls = `<button type="button" class="btn btn-outline-secondary btn-sm" data-chat-browse-open="${htmlSafe(room.id)}" aria-label="Preview #${htmlSafe(room.name)}">Preview</button><button type="button" class="btn btn-primary btn-sm btn-loading btn-loading-swap" data-chat-join="${htmlSafe(room.id)}" aria-label="Join #${htmlSafe(room.name)}"><span class="btn-loading-icon"><i class="bi bi-plus-lg" aria-hidden="true"></i></span><span class="btn-loading-label">Join</span></button>`;
		/* "active today", "active yesterday", or "active October 1" with the month capitalized. */
		const activity = room.archived
			? `archived ${dayText(room.archived)}`
			: `active ${dayText(latestActivity(room))
					.toLowerCase()
					.replace(/^([a-z]+ \d)/, (head) => head.charAt(0).toUpperCase() + head.slice(1))}`;
		const joinedBadge =
			room.joined && !room.archived
				? '<span class="badge cht-joined"><i class="bi bi-check2" aria-hidden="true"></i>Joined</span>'
				: '';
		return `<li class="cht-brow"><div class="cht-brow-main"><h3 class="cht-brow-name"><i class="bi ${channelGlyph(room)}" aria-hidden="true"></i>${htmlSafe(room.name)}${joinedBadge}</h3><p class="cht-brow-desc">${htmlSafe(room.description || room.topic || '')}</p><p class="cht-brow-meta">${countOf(room.members.length, 'member')} · ${activity}</p></div><div class="cht-brow-actions">${controls}</div></li>`;
	}

	function directoryEmpty() {
		const query = session.catalog.q.trim();
		if (query) {
			return `<div class="basalt-empty basalt-empty-compact cht-empty"><span class="cht-empty-icon" aria-hidden="true"><i class="bi bi-search"></i></span><h3 class="basalt-empty-title">No channel matches “${htmlSafe(query)}”</h3><p class="basalt-empty-text">Search looks at names and descriptions. You could start it yourself.</p><div class="basalt-empty-actions"><button type="button" class="btn btn-sm btn-outline-secondary" data-chat-browse-clear>Clear the search</button><button type="button" class="btn btn-sm btn-primary" data-chat-open-new><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>New channel</button></div></div>`;
		}
		const archivedView = session.catalog.filter === 'archived';
		return `<div class="basalt-empty basalt-empty-compact cht-empty"><span class="cht-empty-icon" aria-hidden="true"><i class="bi ${archivedView ? 'bi-archive' : 'bi-check2-circle'}"></i></span><h3 class="basalt-empty-title">${archivedView ? 'Nothing archived' : 'You are in every channel'}</h3><p class="basalt-empty-text">${archivedView ? 'Archived channels show here, read only.' : 'Every public channel is already in your list.'}</p></div>`;
	}

	function showDirectory() {
		if (!workspace) return;
		closeOpenDialogs();
		drawDirectory();
		dialogFor('cht-browser').show();
	}

	function closeOpenDialogs() {
		for (const dialog of pickAll('.modal.show', chatRoot)) window.bootstrap.Modal.getInstance(dialog).hide();
	}

	/* Creating a channel. */

	/* Lowercase letters, digits and single hyphens, at most 40 characters. */
	function toSlug(raw) {
		return raw
			.toLowerCase()
			.replace(/[^a-z0-9\s_-]/g, '')
			.replace(/[\s_]+/g, '-')
			.replace(/-{2,}/g, '-')
			.slice(0, 40);
	}

	/**
	 * The problem with a proposed name, or an empty string when it is fine.
	 * @param {object} [existing] the channel being renamed, which may keep its own name.
	 */
	function nameError(candidate, existing) {
		if (!candidate) return 'Give the channel a name.';
		if (candidate.length < 2) return 'Use at least two characters.';
		if (/^-|-$/.test(candidate)) return 'Start and end with a letter or number.';
		const clash = Array.from(channelsById.values()).find((room) => room.name === candidate && room !== existing);
		return clash ? `#${candidate} already exists${clash.archived ? ', archived' : ''}. Pick another name.` : '';
	}

	/* Marks a name field invalid with its message and moves focus to it. */
	function flagNameError(form, issue) {
		form.error.textContent = issue;
		form.error.classList.add('d-block');
		form.name.classList.add('is-invalid');
		form.name.setAttribute('aria-invalid', 'true');
		form.name.focus();
	}

	function clearNameError(form) {
		form.name.classList.remove('is-invalid');
		form.name.removeAttribute('aria-invalid');
		form.error.classList.remove('d-block');
	}

	/* Opens the dialog clean; when another dialog is closing, it waits for it to finish. */
	function showCreateDialog() {
		if (!workspace) return;
		closeOpenDialogs();
		createForm.form.reset();
		clearNameError(createForm);
		session.invitees = [];
		drawInvitees();
		if (window.Basalt.buttonState) window.Basalt.buttonState(createForm.submit, 'idle');
		createForm.prefix.innerHTML = '<i class="bi bi-hash"></i>';
		setTimeout(() => dialogFor('cht-new').show(), pick('.modal.show', chatRoot) ? 320 : 0);
	}

	/* The people picked so far, and the suggestions for those still left to pick. */
	function drawInvitees() {
		createForm.picked.innerHTML = session.invitees
			.map(
				(personKey) =>
					`<li class="cht-picked-item">${faceMarkup(personKey, 'xs')}<span>${htmlSafe(personFor(personKey).name)}</span><button type="button" class="btn btn-icon cht-picked-x" data-chat-unpick="${htmlSafe(personKey)}" aria-label="Remove ${htmlSafe(personFor(personKey).name)}"><i class="bi bi-x" aria-hidden="true"></i></button></li>`,
			)
			.join('');
		createForm.picked.hidden = !session.invitees.length;
		paintAvatars(createForm.picked);
		dom.peopleOptions.innerHTML = Array.from(peopleById.values())
			.filter((person) => !person.bot && !isSelf(person.id) && !session.invitees.includes(person.id))
			.map(
				(person) =>
					`<li data-value="${htmlSafe(person.name)}" data-hint="${htmlSafe(person.title)}">${htmlSafe(person.name)}</li>`,
			)
			.join('');
	}

	function submitNewChannel(event) {
		event.preventDefault();
		if (createForm.submit.getAttribute('aria-busy') === 'true') return;
		const cleanName = toSlug(createForm.name.value).replace(/^-+|-+$/g, '');
		createForm.name.value = cleanName;
		const issue = nameError(cleanName);
		if (issue) {
			flagNameError(createForm, issue);
			return;
		}
		const isPrivate = pick('[data-chat-new-vis]:checked', chatRoot).value === 'private';
		const channel = {
			id: `c-${cleanName}`,
			name: cleanName,
			private: isPrivate,
			joined: true,
			lastRead: localStamp(clockNow()),
			topic: '',
			description: createForm.desc.value.trim(),
			createdBy: workspace.me,
			created: localStamp(clockNow()).slice(0, 10),
			notify: 'all',
			muted: false,
			words: [],
			members: [workspace.me, ...session.invitees],
		};
		window.Basalt.buttonState(createForm.submit, 'loading');
		server
			.addChannel(channel)
			.then(() => {
				channelsById.set(channel.id, channel);
				workspace.channels.push(channel);
				if (session.invitees.length)
					logEvent(
						channel,
						`You added ${session.invitees.map((personKey) => `@${personKey}`).join(', ')}`,
						'bi-person-plus',
					);
				window.Basalt.buttonState(createForm.submit, 'success');
				setTimeout(() => {
					dialogFor('cht-new').hide();
					showChannel(channel.id, { focus: 'composer' });
					popToast({
						tone: 'success',
						icon: isPrivate ? 'bi-lock' : 'bi-hash',
						title: `Created #${cleanName}`,
						text: session.invitees.length
							? `${countOf(session.invitees.length + 1, 'member')}, including you.`
							: 'Add people from the channel details.',
					});
				}, 450);
			})
			.catch(() => {
				window.Basalt.buttonState(createForm.submit, 'error');
				popToast({
					tone: 'danger',
					title: `Could not create #${cleanName}`,
					text: 'Nothing was made. Try again in a moment.',
				});
				setTimeout(() => window.Basalt.buttonState(createForm.submit, 'idle'), 1800);
			});
	}

	/* Channel settings, in the drawer. */

	function showSettings(channel) {
		settingsChannel = channel;
		closeOpenDialogs();
		settingsForm.sub.textContent = `#${channel.name} · ${countOf(channel.members.length, 'member')}`;
		settingsForm.name.value = channel.name;
		clearNameError(settingsForm);
		settingsForm.prefix.innerHTML = `<i class="bi ${channel.private ? 'bi-lock' : 'bi-hash'}"></i>`;
		settingsForm.topic.value = channel.topic || '';
		settingsForm.desc.value = channel.description || '';
		settingsForm.mute.checked = !!channel.muted;
		const radio = pick(`[data-chat-set-notify][value="${channel.notify || 'all'}"]`, chatRoot);
		radio.checked = true;
		radio.dispatchEvent(new Event('change', { bubbles: true }));
		if (settingsForm.words.basaltTags) settingsForm.words.basaltTags.set(channel.words || []);
		if (window.Basalt.buttonState) window.Basalt.buttonState(settingsForm.save, 'idle');
		window.bootstrap.Offcanvas.getOrCreateInstance(settingsForm.drawer).show();
	}

	function closeSettings() {
		const instance = window.bootstrap && window.bootstrap.Offcanvas.getInstance(settingsForm.drawer);
		if (instance) instance.hide();
	}

	/* Saves the drawer. A rename leaves a note in the feed and updates the address. */
	function submitSettings(event) {
		event.preventDefault();
		const channel = settingsChannel;
		if (!channel || settingsForm.save.getAttribute('aria-busy') === 'true') return;
		const cleanName = toSlug(settingsForm.name.value).replace(/^-+|-+$/g, '');
		const issue = nameError(cleanName, channel);
		if (issue) {
			flagNameError(settingsForm, issue);
			return;
		}
		const patch = {
			name: cleanName,
			topic: settingsForm.topic.value.trim(),
			description: settingsForm.desc.value.trim(),
			notify: pick('[data-chat-set-notify]:checked', chatRoot).value,
			muted: settingsForm.mute.checked,
			words: settingsForm.words.basaltTags ? settingsForm.words.basaltTags.get() : channel.words,
		};
		const oldName = cleanName !== channel.name ? channel.name : null;
		window.Basalt.buttonState(settingsForm.save, 'loading');
		saveChannel(channel, patch)
			.then(() => {
				if (oldName) {
					logEvent(channel, `You renamed the channel from #${oldName} to #${cleanName}`, 'bi-pencil');
					drawFeed({ bottom: true });
					writeHash(channel);
				}
				window.Basalt.buttonState(settingsForm.save, 'success');
				setTimeout(() => {
					closeSettings();
					popToast({
						tone: 'success',
						icon: 'bi-check2',
						title: `Saved #${channel.name}`,
						text: oldName
							? `Links to #${oldName} still work.`
							: 'Everyone in the channel sees the changes.',
					});
				}, 400);
			})
			.catch(() => {
				window.Basalt.buttonState(settingsForm.save, 'error');
				setTimeout(() => window.Basalt.buttonState(settingsForm.save, 'idle'), 1800);
			});
	}

	/* The jump menu (Ctrl+K). */

	/*
	 * The list is only rebuilt when channels change (joined, renamed, added),
	 * so a search typed earlier is not thrown away. Unread hints are refreshed
	 * on every open.
	 */
	function showJumpMenu() {
		if (!workspace) return;
		const reachable = Array.from(channelsById.values()).filter(
			(room) => !room.archived && (room.joined || !room.private),
		);
		const signature = reachable.map((room) => `${room.id}${room.name}${room.joined}`).join('|');
		if (signature !== jumpSignature) {
			jumpSignature = signature;
			dom.jumpHost.innerHTML = jumpMenuMarkup(reachable);
			window.Basalt.command(pick('[data-basalt-command]', dom.jumpHost));
		}
		for (const option of pickAll('.basalt-command-item[data-value^="ch:"]', dom.jumpHost)) {
			const room = channelsById.get(option.getAttribute('data-value').slice(3));
			if (!room || !room.joined) continue;
			const tally = unreadTally(room);
			let hintNode = pick('.basalt-command-hint', option);
			if (!hintNode) {
				hintNode = document.createElement('span');
				hintNode.className = 'basalt-command-hint';
				option.appendChild(hintNode);
			}
			hintNode.textContent = tally.mentions
				? countOf(tally.mentions, 'mention')
				: tally.count && !room.muted
					? `${tally.count} unread`
					: '';
		}
		closeOpenDialogs();
		dialogFor('cht-jump').show();
	}

	function jumpMenuMarkup(reachable) {
		const byName = (left, right) => left.name.localeCompare(right.name);
		const memberOf = reachable.filter((room) => room.joined).sort(byName);
		const notMemberOf = reachable.filter((room) => !room.joined).sort(byName);
		const otherGroup = notMemberOf.length
			? `<div class="basalt-command-group" role="group" aria-labelledby="cht-jump-g2"><div class="basalt-command-heading" id="cht-jump-g2">Other channels</div>${notMemberOf.map((room) => commandItem(`ch:${room.id}`, channelGlyph(room), room.name, 'Not joined', room.topic)).join('')}</div>`
			: '';
		const actionItems = [
			commandItem('act:new', 'bi-plus-lg', 'New channel', '', 'create add'),
			commandItem('act:browse', 'bi-compass', 'Browse channels', '', 'find join'),
			commandItem('act:read', 'bi-check2-all', 'Mark everything as read', '', 'unread clear'),
			commandItem('act:mentions', 'bi-at', 'Show mentions', '', 'me'),
			commandItem('act:keys', 'bi-keyboard', 'Keyboard shortcuts', '?', 'keys help'),
		].join('');
		return `<div class="basalt-command" data-basalt-command><div class="basalt-command-search"><i class="bi bi-search" aria-hidden="true"></i><input type="text" class="basalt-command-input" role="combobox" aria-expanded="true" aria-controls="cht-jump-list" aria-autocomplete="list" aria-label="Jump to a channel" placeholder="Jump to a channel or an action" autocomplete="off" spellcheck="false"><kbd class="basalt-command-esc">Esc</kbd></div><div class="basalt-command-list" id="cht-jump-list" role="listbox" aria-label="Channels and actions"><div class="basalt-command-group" role="group" aria-labelledby="cht-jump-g1"><div class="basalt-command-heading" id="cht-jump-g1">Your channels</div>${memberOf.map((room) => commandItem(`ch:${room.id}`, channelGlyph(room), room.name, '', room.topic)).join('')}</div>${otherGroup}<div class="basalt-command-group" role="group" aria-labelledby="cht-jump-g3"><div class="basalt-command-heading" id="cht-jump-g3">Actions</div>${actionItems}</div></div><div class="basalt-command-empty" hidden><p>Nothing matches “<span data-basalt-command-term></span>”.</p></div></div>`;
	}

	/**
	 * One option in the jump menu.
	 * @param {string} optionValue ch:<id> for a channel, act:<name> for an action.
	 * @param {string} [keywords] extra words the filter matches against.
	 */
	function commandItem(optionValue, glyphClass, labelText, hintText, keywords) {
		return `<div class="basalt-command-item" role="option" id="cht-jump-${htmlSafe(optionValue.replace(/[^a-z0-9-]/gi, '-'))}" aria-selected="false" data-value="${htmlSafe(optionValue)}" data-keywords="${htmlSafe(keywords || '')}"><span class="basalt-command-icon" aria-hidden="true"><i class="bi ${glyphClass}"></i></span><span class="basalt-command-label">${htmlSafe(labelText)}</span>${hintText ? `<span class="basalt-command-hint">${htmlSafe(hintText)}</span>` : ''}</div>`;
	}

	/* Single-key shortcuts. */

	function isTypingTarget(node) {
		return node && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName));
	}

	/*
	 * Alt+Up/Down walk the channel list (public first, then private), with
	 * Shift skipping to the next channel that has unread messages.
	 */
	function cycleChannel(step, onlyUnread) {
		const ordered = myChannels().sort(
			(left, right) => left.private - right.private || left.name.localeCompare(right.name),
		);
		if (!ordered.length) return;
		let position = ordered.findIndex((room) => room.id === session.openId);
		for (let tries = 0; tries < ordered.length; tries++) {
			position = (position + step + ordered.length) % ordered.length;
			const room = ordered[position];
			if (onlyUnread && !(unreadTally(room).count && !room.muted)) continue;
			showChannel(room.id);
			const button = pick(`[data-chat-room="${room.id}"]`, dom.app);
			if (button && dom.app.contains(document.activeElement) && document.activeElement.closest('.cht-side'))
				button.focus();
			return;
		}
		announce('No unread channels');
	}

	/*
	 * Page-wide keys while no dialog or drawer is open. Escape closes the most
	 * recent layer, or marks the channel read when nothing is open. Letters
	 * act on the focused message: r reply, a react, p pin, s save, e edit.
	 */
	function handleShortcut(event) {
		if (!workspace || session.isLoading) return;
		const origin = event.target;
		if (pick('.modal.show, .offcanvas.show')) return;
		if (event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
			event.preventDefault();
			cycleChannel(event.key === 'ArrowDown' ? 1 : -1, event.shiftKey);
			return;
		}
		if (event.key === 'Escape') {
			handleEscape(event, origin);
			return;
		}
		if (isTypingTarget(origin) || event.ctrlKey || event.metaKey || event.altKey) return;
		if (origin.closest && origin.closest('.dropdown-menu, [role="toolbar"], [role="tablist"], .cht-emoji')) return;
		const { key } = event;
		if (key === '/') {
			event.preventDefault();
			dom.search.focus();
			dom.search.select();
			return;
		}
		if (key === '?') {
			event.preventDefault();
			dialogFor('cht-keys').show();
			return;
		}
		if (key === 'c' || key === 'C') {
			if (!dom.composer.hidden) {
				event.preventDefault();
				dom.input.focus();
			}
			return;
		}
		if (key === 'j' || key === 'k') {
			event.preventDefault();
			stepCursor(key === 'j' ? 1 : -1);
			return;
		}
		const messageId = activeMessageId();
		const found = messageId && lookupMessage(messageId);
		if (!found) return;
		const isReply = !!found.parent;
		const letterActions = {
			r: !isReply && (() => showThread(messageId)),
			a: () => openReactionPicker(messageId),
			p: !isReply && (() => flipPin(messageId)),
			s: () => flipSaved(messageId),
			e: isSelf(found.msg.by) && !isReply && (() => beginEdit(messageId)),
		};
		const run = letterActions[key];
		if (!run) return;
		event.preventDefault();
		run();
	}

	function handleEscape(event, origin) {
		if (!dom.emoji.hidden) {
			hideEmojiPicker(true);
			return;
		}
		if (dom.menu.classList.contains('show') || dom.replyMenu.classList.contains('show')) return;
		if (session.side && (!isTypingTarget(origin) || dom.panel.contains(origin))) {
			event.preventDefault();
			hideSidePanel();
			return;
		}
		if (isTypingTarget(origin) && origin !== dom.input) return;
		const channel = activeChannel();
		if (!channel || !unreadTally(channel).count) return;
		markChannelRead(channel, true);
		session.holdUnread = false;
		drawSidebar();
		announce(`#${channel.name} marked as read`);
	}

	/* Small shared utilities. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => entities[char]);
	}

	function popToast(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	/** "1 reply", "3 replies"; the plural defaults to the singular plus s. */
	function countOf(count, singular, pluralForm) {
		return `${count} ${count === 1 ? singular : pluralForm || `${singular}s`}`;
	}

	function prefersStill() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function isNarrow() {
		return window.matchMedia('(max-width: 991.98px)').matches;
	}

	/* Lowercase with accents removed, so "José" matches "jose". */
	function simplify(value) {
		return String(value || '')
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '');
	}

	/* Empties the live region first, so the same sentence twice is still spoken. */
	function announce(sentence) {
		liveRegion.textContent = '';
		setTimeout(() => {
			liveRegion.textContent = sentence;
		}, 40);
	}

	function dialogFor(dialogId) {
		return window.bootstrap ? window.bootstrap.Modal.getOrCreateInstance(document.getElementById(dialogId)) : null;
	}

	/* Bootstrap tooltips on redrawn content are disposed first, or one can be left floating over a row that is gone. */
	function disposeTooltips(container) {
		const tooltipApi = window.bootstrap && window.bootstrap.Tooltip;
		if (!tooltipApi) return;
		for (const trigger of pickAll('[data-bs-toggle="tooltip"]', container)) {
			const tip = tooltipApi.getInstance(trigger);
			if (tip) tip.dispose();
		}
	}

	function mountTooltips(container) {
		if (window.Basalt.tips) window.Basalt.tips(container);
	}

	function paintAvatars(container) {
		if (window.Basalt.avatars) window.Basalt.avatars(container);
	}

	/* Demo stand-ins for network calls. */

	function later(delayMs, result) {
		return new Promise((finish) => setTimeout(() => finish(result), delayMs));
	}

	/* A write. With ?state=flaky every one of them fails, to show the rollbacks. */
	function persist(delayMs) {
		if (demoMode !== 'flaky') return later(delayMs);
		return later(delayMs).then(() => {
			throw new Error('The server did not answer');
		});
	}

	/* Dates and sizes. The demo clock starts at SAMPLE_WORKSPACE.now and runs at real speed. */

	function clockNow() {
		return new Date(clockBase.getTime() + (Date.now() - pageOpenedAt));
	}

	function asDate(value) {
		return value instanceof Date ? value : new Date(value);
	}

	/* A local timestamp in the same shape as the seed data (no time zone). */
	function localStamp(when) {
		function twoDigits(number) {
			return String(number).padStart(2, '0');
		}
		return `${when.getFullYear()}-${twoDigits(when.getMonth() + 1)}-${twoDigits(when.getDate())}T${twoDigits(when.getHours())}:${twoDigits(when.getMinutes())}:${twoDigits(when.getSeconds())}`;
	}

	function clockText(value) {
		const when = asDate(value);
		const minutes = String(when.getMinutes()).padStart(2, '0');
		const meridiem = when.getHours() < 12 ? 'am' : 'pm';
		return `${when.getHours() % 12 || 12}:${minutes} ${meridiem}`;
	}

	function midnightOf(when) {
		return new Date(when.getFullYear(), when.getMonth(), when.getDate()).getTime();
	}

	function dayDistance(value) {
		return Math.round((midnightOf(clockNow()) - midnightOf(asDate(value))) / 86400000);
	}

	/**
	 * Today, Yesterday, or the date; the year only when it is not this one.
	 * @param {boolean} [withWeekday] names the weekday for the rest of the past week.
	 */
	function dayText(value, withWeekday) {
		const when = asDate(value);
		const distance = dayDistance(when);
		if (distance === 0) return 'Today';
		if (distance === 1) return 'Yesterday';
		if (withWeekday && distance > 0 && distance < 7)
			return `${WEEKDAY_NAMES[when.getDay()]}, ${MONTH_NAMES[when.getMonth()]} ${when.getDate()}`;
		const dateLabel = `${MONTH_NAMES[when.getMonth()]} ${when.getDate()}`;
		return when.getFullYear() === clockNow().getFullYear() ? dateLabel : `${dateLabel}, ${when.getFullYear()}`;
	}

	function whenText(value) {
		return `${dayText(value)} at ${clockText(value)}`;
	}

	function sizeText(bytes) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
		return `${(bytes / 1048576).toFixed(1)} MB`;
	}

	start();
})();
