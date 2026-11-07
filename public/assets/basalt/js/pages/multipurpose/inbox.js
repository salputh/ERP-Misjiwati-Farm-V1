/**
 * Inbox page script, loaded by inbox.html only.
 *
 * Messages with the team, one to one or in small groups: the thread list
 * sorts pinned and unread first, and an open thread handles presence,
 * search, replies, reactions, attachments with previews, typing and read
 * receipts, edits, deletes that can be undone, @mentions and one draft
 * per thread.
 *
 * Hooking up a real backend takes two changes. SAMPLE below is every
 * record the page draws; return the same shape from your server, or let
 * server.fetchAll() request it. Each server method is then the one place
 * an action talks to the backend: the page changes at once and rolls the
 * change back, with an error toast, if the call is rejected.
 *
 * Shared basalt.js parts in use: Headers, the segmented control, context
 * and command menus, avatars with presence dots, undo toasts, hold to
 * confirm, loading and copy buttons, tooltips, skeletons, empty states.
 *
 * For demos, ?state=empty opens a brand-new inbox and ?state=error makes
 * the first load fail until Try again is pressed.
 */
(() => {
	'use strict';

	const host = pick('[data-dm-root]');
	if (!host) return;

	/* The sample clock reads Friday, October 9, 2026 at 10:42 am, and every
     sample time is placed relative to it so day labels stay correct. A
     live app reads new Date() instead. */
	const SAMPLE_CLOCK = new Date(2026, 9, 9, 10, 42);

	/* Everything the page shows comes from this one object. Swap in your
     own records with the same shape. */
	const SAMPLE = {
		me: 'ja',
		/* utc is the hour offset from UTC today, which drives each person's
       local clock. userId points at their record on employee-user-details.html;
       leave it out and the profile shows no link. */
		people: [
			{
				id: 'ja',
				userId: 'ja',
				name: 'John Armstrong',
				title: 'IT and systems manager',
				team: 'Operations',
				presence: 'online',
				city: 'Evanston',
				utc: -5,
				email: 'john.armstrong@fieldline.app',
			},
			{
				id: 'pr',
				userId: 'pr',
				name: 'Connie Reese',
				title: 'Support lead',
				team: 'Support',
				presence: 'online',
				city: 'Boulder',
				utc: -6,
				email: 'connie.reese@fieldline.app',
			},
			{
				id: 'hw',
				userId: 'hw',
				name: 'Leslie Whitlock',
				title: 'Product manager, Travel Planner',
				team: 'Product',
				presence: 'online',
				city: 'Stamford',
				utc: -4,
				email: 'leslie.whitlock@fieldline.app',
			},
			{
				id: 'ev',
				userId: 'ev',
				name: 'Elise Vick',
				title: 'Customer success lead',
				team: 'Success',
				presence: 'away',
				city: 'Akron',
				utc: -4,
				email: 'elise.vick@fieldline.app',
			},
			{
				id: 'th',
				userId: 'th',
				name: 'Todd Hatcher',
				title: 'Senior mobile engineer',
				team: 'Engineering',
				presence: 'busy',
				city: 'Chattanooga',
				utc: -4,
				email: 'trent.hatcher@fieldline.app',
			},
			{
				id: 'mb',
				userId: 'mb',
				name: 'Quentin Cook',
				title: 'Account executive',
				team: 'Sales',
				presence: 'online',
				city: 'Evanston',
				utc: -5,
				email: 'quentin.cook@fieldline.app',
			},
			{
				id: 'rd',
				userId: 'rd',
				name: 'Robyn Daniels',
				title: 'Finance controller',
				team: 'Finance',
				presence: 'offline',
				lastSeen: onDay(0, '09:07'),
				city: 'Waco',
				utc: -5,
				email: 'robyn.daniels@fieldline.app',
			},
			{
				id: 'cr',
				userId: 'cr',
				name: 'Cameron Reid',
				title: 'Marketing lead',
				team: 'Marketing',
				presence: 'away',
				city: 'La Crosse',
				utc: -5,
				email: 'cameron.reid@fieldline.app',
			},
			{
				id: 'km',
				userId: 'mk',
				name: 'Thomas Morrison',
				title: 'Solutions engineer, West',
				team: 'Sales',
				presence: 'offline',
				lastSeen: onDay(-1, '19:20'),
				city: 'Olympia',
				utc: -7,
				email: 'thomas.morrison@fieldline.app',
			},
			{
				id: 'ab',
				userId: 'ab',
				name: 'Alexis Boone',
				title: 'Support specialist',
				team: 'Support',
				presence: 'online',
				city: 'Atlanta',
				utc: -4,
				email: 'alexis.boone@fieldline.app',
			},
			{
				id: 'ds',
				userId: 'ds',
				name: 'Darryl Sanders',
				title: 'Platform engineer',
				team: 'Engineering',
				presence: 'offline',
				lastSeen: onDay(0, '08:15'),
				city: 'Toledo',
				utc: -4,
				email: 'darryl.sanders@fieldline.app',
			},
			{
				id: 'gl',
				userId: 'gl',
				name: 'Courtney Lowry',
				title: 'Onboarding specialist',
				team: 'Success',
				presence: 'online',
				city: 'Syracuse',
				utc: -4,
				email: 'courtney.lowry@fieldline.app',
			},
			{
				id: 'op',
				userId: 'op',
				name: 'Gerald Pritchard',
				title: 'Sales development rep',
				team: 'Sales',
				presence: 'away',
				city: 'Boston',
				utc: -4,
				email: 'gerald.pritchard@fieldline.app',
			},
			{
				id: 'nf',
				userId: 'nfe',
				name: 'Sandra Franklin',
				title: 'Product designer',
				team: 'Product',
				presence: 'online',
				city: 'Sarasota',
				utc: -4,
				email: 'sandra.franklin@fieldline.app',
			},
		],

		/* Attachments referenced by messages. preview holds what the viewer draws. */
		files: [
			{
				id: 'f-lumoraai',
				name: 'lumoraai-sync-errors.csv',
				kind: 'sheet',
				size: 18432,
				preview: {
					columns: ['Time', 'Carer', 'Visit', 'Note length', 'Device'],
					rows: [
						['Oct 6, 7:42 am', 'D. Zimmerman', 'Overnight care #4471', '2,316', 'Android 14'],
						['Oct 6, 9:15 am', 'R. Sawyer', 'Weekly check-in #4475', '2,880', 'Android 14'],
						['Oct 7, 8:03 am', 'D. Zimmerman', 'Hospital discharge #4490', '3,104', 'Android 14'],
						['Oct 7, 1:27 pm', 'L. Merritt', 'Overnight care #4493', '2,212', 'Android 14'],
						['Oct 8, 10:51 am', 'M. Ingram', 'Respite visit #4502', '2,540', 'Android 14'],
					],
					more: '36 more rows',
				},
			},
			{
				id: 'f-lakeside',
				name: 'lakeside-rounds-before-after.png',
				kind: 'image',
				size: 412000,
				preview: {
					art: 'rounds',
					caption: 'Tuesday rounds for Lakeside Apparel: before (dashed) and with Travel Planner (solid).',
				},
			},
			{
				id: 'f-avocet',
				name: 'avocet-seat-plan.pdf',
				kind: 'pdf',
				size: 236000,
				preview: {
					title: 'Avocet Robotics: seat plan for 2027',
					lines: [
						['Today', '22 seats on Pro, Duluth'],
						['January', 'Move to Max, same 22 seats'],
						['February', 'Dayton branch opens, 8 seats'],
						['Total', '30 seats on Max, Customer Portal for every customer'],
						['Billing', 'Annual, starting February 1'],
					],
				},
			},
			{
				id: 'f-close',
				name: 'september-close-summary.xlsx',
				kind: 'sheet',
				size: 64200,
				preview: {
					columns: ['Measure', 'August', 'September'],
					rows: [
						['MRR', '$858k', '$880k'],
						['Paying accounts', '2,096', '2,140'],
						['Net revenue retention', '111%', '112%'],
						['Monthly active users', '46,900', '48,200'],
					],
				},
			},
			{
				id: 'f-templates',
				name: 'late-arrival-replies.docx',
				kind: 'doc',
				size: 31800,
				preview: {
					title: 'Replies: staff running late',
					lines: [
						[
							'Under 15 minutes',
							'{name} from our team is running a little behind and is now due at {time}. Follow along here: {tracker link}',
						],
						[
							'Over 15 minutes',
							'Sorry, {name} from our team is held up on an earlier visit. New arrival window: {window}. Reply 1 to keep it or 2 to rebook.',
						],
						[
							'Rebooked',
							'Done. You are booked for {day} between {window}. We will text when your team member is on the way.',
						],
					],
				},
			},
		],

		conversations: [
			{
				id: 'c-connie',
				with: ['pr'],
				pinned: true,
				unread: 2,
				messages: [
					{
						id: 'm1',
						by: 'pr',
						at: onDay(-1, '16:12'),
						text: 'Heads up: Lumora AI opened a priority ticket. Six of their carers say visit notes are not syncing back from the app.',
					},
					{ id: 'm2', by: 'ja', at: onDay(-1, '16:15'), text: 'Is it everyone on 2.31, or only Android?' },
					{
						id: 'm3',
						by: 'pr',
						at: onDay(-1, '16:21'),
						text: 'Android only so far. The iPhone carers are fine. I have asked them for device logs.',
					},
					{
						id: 'm4',
						by: 'ja',
						at: onDay(-1, '16:22'),
						text: "Bring Todd in when the logs land. Lumora AI renews in November, so let's not let this sit.",
						reactions: { '👍': ['pr'] },
					},
					{
						id: 'm5',
						by: 'pr',
						at: onDay(0, '09:58'),
						text: 'Logs are in. 41 failed syncs since Tuesday, all on Android 14.',
						files: ['f-lumoraai'],
					},
					{
						id: 'm6',
						by: 'pr',
						at: onDay(0, '10:02'),
						text: 'Todd thinks the offline queue drops notes over 2,000 characters. Their carers write long notes on overnight visits.',
					},
					{
						id: 'm7',
						by: 'ja',
						at: onDay(0, '10:05'),
						replyTo: 'm5',
						text: 'That fits. Every failure in the file is an overnight or a discharge visit.',
					},
					{
						id: 'm8',
						by: 'pr',
						at: onDay(0, '10:29'),
						text: '@John Armstrong can you approve a 20% credit on their October invoice? Their scheduler retyped notes for three days.',
					},
					{
						id: 'm9',
						by: 'pr',
						at: onDay(0, '10:31'),
						text: 'I told them we would have a fix or a workaround by Monday.',
					},
				],
			},
			{
				id: 'c-leslie',
				with: ['hw'],
				pinned: true,
				unread: 1,
				messages: [
					{
						id: 'm20',
						by: 'hw',
						at: onDay(-2, '14:05'),
						text: 'Week one numbers from the Travel Planner beta are in, from Lakeside Apparel.',
					},
					{ id: 'm21', by: 'hw', at: onDay(-2, '14:06'), text: '', files: ['f-lakeside'] },
					{
						id: 'm22',
						by: 'hw',
						at: onDay(-2, '14:07'),
						text: 'Same 14 walkers and the same dogs. Travel time is down 18%, and they fitted in 9 more walks over the week.',
						reactions: { '🎉': ['ja'], '🚀': ['ja'] },
					},
					{
						id: 'm23',
						by: 'ja',
						at: onDay(-2, '14:20'),
						text: 'Great first week. Did their schedulers override many of the suggested rounds?',
					},
					{
						id: 'm24',
						by: 'hw',
						at: onDay(-2, '14:34'),
						text: 'Only 6 overrides out of 212 rounds, mostly same-day walks that were booked mid-morning.',
					},
					{
						id: 'm25',
						by: 'ja',
						at: onDay(-1, '09:12'),
						text: 'Could Lakeside be the case study for the add-on launch? Worth asking Cameron to talk to them.',
					},
					{
						id: 'm26',
						by: 'hw',
						at: onDay(-1, '09:40'),
						replyTo: 'm25',
						text: "Already asked. Their operations manager said yes, as long as we don't name their walkers.",
						reactions: { '🙌': ['ja'] },
					},
					{
						id: 'm27',
						by: 'hw',
						at: onDay(0, '08:55'),
						text: "Draft pricing for the add-on: $6 a seat each month on Pro, included on Max. Can we talk it through before Tuesday's review?",
					},
				],
			},
			{
				id: 'c-elise',
				with: ['ev'],
				unread: 3,
				messages: [
					{ id: 'm30', by: 'ja', at: onDay(-1, '13:30'), text: 'How did the Avocet Robotics check-in go?' },
					{
						id: 'm31',
						by: 'ev',
						at: onDay(-1, '15:02'),
						text: 'Really well. They want to move from Pro to Max in January, for Travel Planner and the Customer Portal.',
						reactions: { '🎉': ['ja'] },
					},
					{
						id: 'm32',
						by: 'ev',
						at: onDay(0, '09:15'),
						text: 'Seat plan attached. 22 seats today and 30 by February, when their Dayton branch opens.',
						files: ['f-avocet'],
					},
					{
						id: 'm33',
						by: 'ev',
						at: onDay(0, '09:16'),
						text: 'On annual billing that is 30 seats × $58 × 10 months, so $17,400 a year.',
					},
					{
						id: 'm34',
						by: 'ev',
						at: onDay(0, '09:18'),
						text: 'They asked if we would hold the Pro price for the 8 new seats until Dayton opens. I would say yes for the first quarter only. @John Armstrong are you OK with that?',
					},
				],
			},
			{
				id: 'c-trent',
				with: ['th'],
				messages: [
					{
						id: 'm40',
						by: 'th',
						at: onDay(0, '10:12'),
						text: 'Found it. On Android the offline queue cuts any note over 2,048 characters, and then the sync rejects the whole visit.',
					},
					{ id: 'm41', by: 'ja', at: onDay(0, '10:14'), text: 'Can you fix it without a full release?' },
					{
						id: 'm42',
						by: 'th',
						at: onDay(0, '10:20'),
						text: 'Hotfix 2.31.1 is building now. Long notes get split up on the phone and joined again on the server.',
					},
					{
						id: 'm43',
						by: 'ja',
						at: onDay(0, '10:22'),
						text: 'Put it on the beta channel first, and tell Connie so Lumora AI knows.',
						status: 'read',
						readAt: onDay(0, '10:23'),
						reactions: { '👍': ['th'] },
					},
				],
			},
			{
				id: 'c-travis',
				with: ['mb'],
				draft: 'Can you send me the Oakhaven quote before Monday? I want to check the SMS credits line',
				messages: [
					{
						id: 'm50',
						by: 'mb',
						at: onDay(-1, '11:05'),
						text: 'Oakhaven Studio booked a Customer Portal demo for Tuesday at 2. All 64 seats, across Stamford and Plattsburgh.',
					},
					{
						id: 'm51',
						by: 'mb',
						at: onDay(-1, '11:07'),
						text: 'The portal is what they care about most. Their customers keep calling to ask when the carer will turn up.',
					},
					{
						id: 'm52',
						by: 'ja',
						at: onDay(-1, '11:30'),
						text: 'Show them the arrival window texts as well. Those use SMS credits, so put them in the quote.',
					},
					{
						id: 'm53',
						by: 'mb',
						at: onDay(-1, '11:41'),
						text: 'Will do. The portal is $4 a seat, so I will quote it on all 64 seats.',
						reactions: { '👍': ['ja'] },
					},
				],
			},
			{
				id: 'c-robyn',
				with: ['rd'],
				muted: true,
				messages: [
					{
						id: 'm60',
						by: 'rd',
						at: onDay(-1, '17:48'),
						text: 'September close is done. MRR ended at $880k across 2,140 paying accounts.',
					},
					{ id: 'm61', by: 'rd', at: onDay(-1, '17:49'), text: '', files: ['f-close'] },
					{
						id: 'm62',
						by: 'rd',
						at: onDay(-1, '17:52'),
						text: 'Net revenue retention is 112%. Most of the growth came from Max upgrades in the Northeast.',
					},
					{
						id: 'm63',
						by: 'ja',
						at: onDay(-1, '18:05'),
						text: "Thanks Robyn, that is a good month. Let's share the summary at Monday's all-hands.",
						status: 'read',
						readAt: onDay(0, '08:02'),
					},
				],
			},
			{
				id: 'c-cameron',
				with: ['cr'],
				messages: [
					{
						id: 'm70',
						by: 'cr',
						at: onDay(-2, '10:15'),
						text: 'The landing page for the webinar is up: https://fieldline.app/webinars/scheduling-in-ten-minutes',
					},
					{
						id: 'm71',
						by: 'cr',
						at: onDay(-2, '10:16'),
						text: 'Could you read the speaker bio before the invite goes to 9,400 contacts?',
					},
					{
						id: 'm72',
						by: 'ja',
						at: onDay(-2, '11:02'),
						text: 'Read it. Swap "industry-leading" for a number: 2,140 companies schedule their teams on Fieldline.',
					},
					{
						id: 'm73',
						by: 'cr',
						at: onDay(-2, '11:05'),
						replyTo: 'm72',
						text: 'Much better. Changed it, and the invite goes out Monday at 9 am Eastern.',
					},
					{
						id: 'm74',
						by: 'cr',
						at: onDay(-1, '16:30'),
						text: '312 registrations so far. The operations lead at Brightline Photography signed up too.',
						reactions: { '🎉': ['ja'] },
					},
				],
			},
			{
				id: 'c-thomas',
				with: ['km'],
				messages: [
					{
						id: 'm80',
						by: 'km',
						at: onDay(-1, '18:40'),
						text: 'Downland Cloud in Cheyenne is nearly out of SMS credits. 300 left, and they send about 900 a week.',
					},
					{
						id: 'm81',
						by: 'km',
						at: onDay(-1, '18:42'),
						text: 'Their office manager asked if we can top them up today and put it on the next invoice.',
					},
					{
						id: 'm82',
						by: 'ja',
						at: onDay(-1, '19:15'),
						text: 'Yes, add 5,000 credits and bill them on the October invoice. Tell them about automatic top-ups too.',
						status: 'delivered',
					},
				],
			},
			{
				id: 'c-alexis',
				with: ['ab'],
				messages: [
					{
						id: 'm90',
						by: 'ab',
						at: onDay(0, '07:50'),
						text: 'Morning! I rewrote the replies for "staff running late". They are shorter now and link to the Customer Portal tracker.',
					},
					{ id: 'm91', by: 'ab', at: onDay(0, '07:51'), text: '', files: ['f-templates'] },
					{
						id: 'm92',
						by: 'ja',
						at: onDay(0, '08:02'),
						text: 'These read much better. Go ahead and switch them on.',
						status: 'read',
						readAt: onDay(0, '08:03'),
					},
					{ id: 'm93', by: 'ab', at: onDay(0, '08:03'), text: 'Done 🙌' },
				],
			},
			{
				id: 'c-darryl',
				with: ['ds'],
				archived: true,
				messages: [
					{
						id: 'm100',
						by: 'ds',
						at: onDay(-8, '15:10'),
						text: "The write-up for Tuesday's 22-minute outage is ready: https://status.fieldline.app/incidents/2026-09-29",
					},
					{ id: 'm101', by: 'ja', at: onDay(-8, '15:30'), text: 'Clear and honest. Publish it.' },
					{
						id: 'm102',
						by: 'ds',
						at: onDay(-8, '15:33'),
						text: 'Published. I also added an alert so the task queue warns us before it backs up again.',
						reactions: { '👏': ['ja'] },
					},
				],
			},
			{
				id: 'c-courtney',
				with: ['gl'],
				archived: true,
				messages: [
					{
						id: 'm110',
						by: 'gl',
						at: onDay(-4, '09:20'),
						text: 'Oakmont Gardens finished onboarding. All 6 gardeners are on the mobile app and their first week is fully scheduled.',
					},
					{
						id: 'm111',
						by: 'ja',
						at: onDay(-4, '09:45'),
						text: 'Nice work. Ask them for a review once they have had a full month.',
						status: 'read',
						readAt: onDay(-4, '09:46'),
					},
				],
			},
		],

		/* Canned answers each teammate sends back while the demo runs. */
		replies: {
			pr: ['Thanks. I will let Lumora AI know before lunch.', 'Got it, I will update the ticket.'],
			hw: ['Works for me. I will send an invite for Monday morning.', 'Sounds good.'],
			ev: ['Great, I will send Avocet the Max quote today.', 'Thanks John.'],
			th: ['On it. I will post in the release channel once it is on beta.'],
			mb: ['Sure, the quote will be with you by Monday morning.'],
			cr: ['Thanks! I will add that to the invite.'],
			ab: ['Will do.'],
			gl: ['Sounds good, thanks John.'],
			nf: ['Happy to help. Send it over.'],
			op: ['Thanks, I will follow up today.'],
		},

		/* One message lands a little after the page opens, to show live delivery. */
		incoming: {
			after: 14000,
			conversation: 'c-alexis',
			by: 'ab',
			text: "Lumora AI's scheduler just called back. They are happy to wait until Monday if the credit is confirmed today.",
		},

		emoji: [
			'👍',
			'🙌',
			'🎉',
			'✅',
			'👀',
			'🙏',
			'😂',
			'😊',
			'🔥',
			'💡',
			'⚠️',
			'❤️',
			'👏',
			'🚀',
			'📌',
			'🤝',
			'😅',
			'🤔',
			'🔧',
			'📅',
		],
	};

	/* Words, icons and limits the page reuses. */
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
	const PRESENCE_WORDS = { online: 'Online', away: 'Away', busy: 'Busy, notifications paused', offline: 'Offline' };
	const DELIVERY = {
		sending: { icon: 'bi-clock', text: 'Sending…' },
		sent: { icon: 'bi-check2', text: 'Sent' },
		delivered: { icon: 'bi-check2-all', text: 'Delivered' },
		read: { icon: 'bi-check2-all', text: 'Read' },
		failed: { icon: 'bi-exclamation-circle', text: 'Not sent' },
	};
	const FILE_GLYPHS = {
		sheet: 'bi-file-earmark-spreadsheet',
		pdf: 'bi-file-earmark-pdf',
		doc: 'bi-file-earmark-text',
		image: 'bi-file-earmark-image',
	};
	const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	const URL_PATTERN = /https?:\/\/[^\s<]+[^\s<.,;:!?)"']/g;
	const GROUP_GAP_MS = 6 * 60000;
	const EMOJI_COLUMNS = 5;
	const MAX_RECIPIENTS = 5;
	const DRAFTS_KEY = 'basalt-messages-drafts';
	const PROFILE_KEY = 'basalt-messages-profile';
	const NEW_MESSAGE_BUTTON =
		'<button type="button" class="btn btn-sm btn-primary" data-dm-new><i class="bi bi-pencil-square me-1" aria-hidden="true"></i>New message</button>';
	const HEAD_DOT = '<span class="dm-thread-dot" aria-hidden="true">·</span>';

	/* Stand-ins for the backend, one method per action. Each answers after a
     short pause; replace a body with a fetch() to your API and resolve
     with the same value. ?state=error rejects the first fetchAll(). */
	const demoMode = new URLSearchParams(location.search).get('state');
	let fetchCount = 0;

	const server = {
		/* GET /api/conversations?include=messages: every thread with its messages. */
		fetchAll() {
			fetchCount += 1;
			if (demoMode === 'error' && fetchCount === 1) {
				return pause(400).then(() => {
					throw new Error('The server did not answer');
				});
			}
			if (demoMode === 'empty') return pause(300, { ...SAMPLE, conversations: [], files: [] });
			return pause(300, SAMPLE);
		},
		/* POST /api/conversations/:id/messages with { text, replyTo, files } */
		post(threadId, message) {
			return pause(350, { id: message.id });
		},
		/* PATCH /api/messages/:id with { text } */
		revise(threadId, messageId, text) {
			return pause(200);
		},
		/* DELETE /api/messages/:id */
		discard(threadId, messageId) {
			return pause(200);
		},
		/* POST /api/messages/:id/restore */
		undiscard(threadId, messageId) {
			return pause(200);
		},
		/* PUT, or DELETE when turning off, /api/messages/:id/reactions/:emoji */
		setReaction(threadId, messageId, emoji, on) {
			return pause(150);
		},
		/* POST /api/conversations/:id/read */
		read(threadId) {
			return pause(120);
		},
		/* POST /api/conversations/:id/unread */
		unread(threadId) {
			return pause(120);
		},
		/* PUT or DELETE /api/conversations/:id/pin */
		setPinned(threadId, on) {
			return pause(150);
		},
		/* PUT or DELETE /api/conversations/:id/mute */
		setMuted(threadId, on) {
			return pause(150);
		},
		/* PUT or DELETE /api/conversations/:id/archive */
		setArchived(threadId, on) {
			return pause(150);
		},
		/* DELETE /api/conversations/:id */
		drop(threadId) {
			return pause(250);
		},
		/* POST /api/conversations with { with: personIds } */
		open(personIds) {
			return pause(450, { id: `c-${Date.now().toString(36)}` });
		},
		/* PUT /api/conversations/:id/draft with { text } */
		keepDraft(threadId, text) {
			return pause(100);
		},
		/* POST /api/uploads as multipart form data */
		upload(file) {
			return pause(500, { id: `f-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}` });
		},
		/* GET /api/files/:id, which answers with a signed link */
		download(fileId) {
			return pause(800);
		},
	};

	/* localStorage can be switched off, as in a private window, so every
     read and write is allowed to fail quietly. */
	const memory = {
		read(key) {
			try {
				return localStorage.getItem(key);
			} catch {
				return null;
			}
		},
		write(key, value) {
			try {
				localStorage.setItem(key, value);
			} catch {
				/* nothing to keep it in */
			}
		},
	};

	const bootedAt = Date.now();
	let serial = 0;

	/* What the screen shows right now. */
	const page = {
		isLoading: true,
		loadFailed: null,
		folder: 'all',
		searchText: '',
		openId: null,
		replyingTo: null,
		editingId: null,
		typists: {},
		firstUnread: {},
		queued: {},
		profileOn: memory.read(PROFILE_KEY) !== 'off',
		cursorId: null,
		visibleIds: [],
	};

	/* The records, copied out of whatever the server sent. */
	let roster = new Map();
	let attachments = new Map();
	let threads = [];
	let cannedAnswers = {};
	const savedDrafts = readSavedDrafts();

	/* Short-lived bits of interaction state. */
	let sharedTab = 'files';
	let pendingDeleteId = null;
	let menuThreadId = null;
	let menuMessageId = null;
	let draftDelay = 0;
	let searchDelay = 0;
	let arrivalTimer = 0;
	let dragCount = 0;
	let mentionPick = null;
	let reactTarget = null;
	let emojiAnchor = null;
	let previewed = null;
	let pickerReady = false;
	const recipients = [];

	const ui = {
		board: pick('[data-dm-app]', host),
		threadList: pick('[data-dm-convs]', host),
		listBlank: pick('[data-dm-list-empty]', host),
		matchLine: pick('[data-dm-count-line]', host),
		searchBox: pick('[data-dm-search]', host),
		teamLine: pick('[data-dm-team-line]', host),
		darkToggle: pick('[data-dm-theme]', host),
		threadSection: pick('[data-dm-thread]', host),
		header: pick('[data-dm-head]', host),
		headerAvatar: pick('[data-dm-head-avatar]', host),
		headerName: pick('[data-dm-head-name]', host),
		headerMeta: pick('[data-dm-head-meta]', host),
		pinButton: pick('[data-dm-pin]', host),
		profileButton: pick('[data-dm-profile-toggle]', host),
		scroller: pick('[data-dm-log]', host),
		messageList: pick('[data-dm-messages]', host),
		threadBlank: pick('[data-dm-thread-empty]', host),
		jumpButton: pick('[data-dm-jump]', host),
		form: pick('[data-dm-composer]', host),
		textarea: pick('[data-dm-input]', host),
		textareaLabel: pick('[data-dm-input-label]', host),
		contextBar: pick('[data-dm-context]', host),
		queueList: pick('[data-dm-pending]', host),
		filePicker: pick('[data-dm-file-input]', host),
		mentionList: pick('[data-dm-mention]', host),
		draftLabel: pick('[data-dm-draft-note]', host),
		sendText: pick('[data-dm-send-label]', host),
		emojiButton: pick('[data-dm-emoji-btn]', host),
		emojiPanel: pick('[data-dm-emoji]', host),
		emojiGrid: pick('[data-dm-emoji-grid]', host),
		liveRegion: pick('[data-dm-live]', host),
		profilePanel: pick('#dm-profile'),
		profileContent: pick('[data-dm-profile]', host),
		threadMenu: pick('#dm-conv-menu'),
		messageMenu: pick('#dm-message-menu'),
		composeDialog: pick('#dm-new-dialog'),
		teamPicker: pick('#dm-new-dialog [data-dm-people]'),
		teamOptions: pick('#dm-new-dialog [data-dm-people-list]'),
		recipientError: pick('#dm-new-dialog [data-dm-new-err]'),
		startButton: pick('#dm-new-dialog [data-dm-new-submit]'),
		previewDialog: pick('#dm-preview'),
		deleteDialog: pick('#dm-delete-dialog'),
		shortcutsDialog: pick('#dm-keys'),
	};

	/** Binds every control once, then starts the first load. */
	function start() {
		ui.emojiGrid.innerHTML = SAMPLE.emoji
			.map(
				(emoji) =>
					`<button type="button" class="dm-emoji-btn" data-dm-emoji-pick="${emoji}" tabindex="-1">${emoji}</button>`,
			)
			.join('');
		wireList();
		wireThread();
		wireProfile();
		wireMenus();
		wireComposer();
		wireAttachments();
		wireMentions();
		wireEmoji();
		wirePreview();
		wireCompose();
		wireSearch();
		wireWorkspace();
		document.addEventListener('keydown', handleShortcut);
		window.addEventListener('beforeunload', () => {
			if (page.openId) flushDraft(page.openId);
		});
		reflectTheme();
		reflectProfileState();
		fetchInbox();
	}

	/* Event wiring, one function per area of the screen. */

	function wireList() {
		ui.threadList.addEventListener('click', (event) => {
			const more = event.target.closest('.dm-conv-more');
			if (more) {
				openContextFrom(more);
				return;
			}
			const row = event.target.closest('[data-dm-open]');
			if (row) openThread(row.dataset.dmOpen, { focus: isSinglePane() ? 'thread' : null });
		});

		/* The list is one tab stop; arrows, Home and End move inside it. */
		ui.threadList.addEventListener('keydown', (event) => {
			const current = event.target.closest('.dm-conv');
			if (!current) return;
			const rows = pickAll('.dm-conv', ui.threadList);
			const target = listMoveTarget(event.key, rows.indexOf(current), rows.length);
			if (target < 0) return;
			event.preventDefault();
			for (const row of rows) row.tabIndex = -1;
			rows[target].tabIndex = 0;
			rows[target].focus();
		});

		ui.board.addEventListener('click', (event) => {
			if (!event.target.closest('[data-dm-back]')) return;
			showPane('list');
			pick(`[data-dm-open="${page.openId}"]`, ui.threadList)?.focus();
		});

		ui.listBlank.addEventListener('click', (event) => {
			if (event.target.closest('[data-dm-clear-search]')) resetSearch();
			else if (event.target.closest('[data-dm-show-all]')) switchFolder('all');
			else if (event.target.closest('[data-dm-retry]')) fetchInbox();
		});
	}

	function wireThread() {
		ui.scroller.addEventListener('scroll', () => refreshJump(), { passive: true });
		ui.jumpButton.addEventListener('click', () => {
			ui.scroller.scrollTo({ top: ui.scroller.scrollHeight, behavior: prefersStill() ? 'auto' : 'smooth' });
			ui.textarea.focus();
		});

		ui.messageList.addEventListener('click', handleMessageClick);
		ui.messageList.addEventListener('keydown', (event) => {
			const row = event.target.closest('.dm-row[data-msg]');
			if (!row || event.target !== row || event.ctrlKey || event.metaKey || event.altKey) return;
			handleRowKey(event, row);
		});

		pick('[data-dm-del-hold]', ui.deleteDialog).addEventListener('basalt:confirm', deleteConfirmed);

		ui.pinButton.addEventListener('click', () => {
			const thread = threadById(page.openId);
			if (thread) pinThread(thread.id, !thread.pinned);
		});

		for (const button of pickAll('[data-dm-head-act]', host)) {
			button.addEventListener('click', () => {
				const thread = threadById(page.openId);
				if (!thread) return;
				const actions = {
					unread: () => markThread(thread.id, true),
					mute: () => muteThread(thread.id, !thread.muted),
					archive: () => archiveThread(thread.id, !thread.archived),
					delete: () => askToDelete(thread.id),
				};
				actions[button.dataset.dmHeadAct]?.();
			});
		}
	}

	function wireProfile() {
		ui.profileContent.addEventListener('change', (event) => {
			const field = event.target;
			if (field.matches('[data-dm-mute-switch]')) {
				muteThread(page.openId, field.checked);
				return;
			}
			if (!field.matches('[data-dm-shared]')) return;
			sharedTab = field.value;
			drawProfile();
			document.getElementById(field.id)?.focus();
		});
		ui.profileContent.addEventListener('click', (event) => {
			if (event.target.closest('[data-dm-delete-conv]')) askToDelete(page.openId);
			const fileButton = event.target.closest('[data-dm-file]');
			if (fileButton) showPreview(fileButton.dataset.dmFile);
		});
		ui.profileButton.addEventListener('click', () => flipProfile());
		ui.profilePanel.addEventListener('shown.bs.offcanvas', () => reflectProfileState());
		ui.profilePanel.addEventListener('hidden.bs.offcanvas', () => reflectProfileState());
		window.matchMedia('(min-width: 1200px)').addEventListener('change', () => reflectProfileState());
	}

	/* Both context menus fill in their labels as they open, then act on
     whatever row they were opened from. */
	function wireMenus() {
		ui.threadMenu.addEventListener('basalt:context', (event) => {
			menuThreadId = event.detail.target?.dataset.conv;
			const thread = threadById(menuThreadId);
			if (!thread) {
				ui.threadMenu.classList.remove('show');
				return;
			}
			const labels = {
				pin: thread.pinned ? 'Unpin' : 'Pin',
				read: thread.unread ? 'Mark as read' : 'Mark as unread',
				mute: thread.muted ? 'Unmute' : 'Mute',
				archive: thread.archived ? 'Move to inbox' : 'Archive',
			};
			for (const [key, text] of Object.entries(labels)) {
				pick(`[data-dm-menu-label="${key}"]`, ui.threadMenu).textContent = text;
			}
		});
		ui.threadMenu.addEventListener('basalt:pick', (event) => {
			const thread = threadById(menuThreadId);
			if (!thread) return;
			const actions = {
				pin: () => pinThread(thread.id, !thread.pinned),
				read: () => markThread(thread.id, !thread.unread),
				mute: () => muteThread(thread.id, !thread.muted),
				archive: () => archiveThread(thread.id, !thread.archived),
				delete: () => setTimeout(() => askToDelete(thread.id), 0),
			};
			actions[event.detail.item.dataset.dmAct]?.();
		});

		ui.messageMenu.addEventListener('basalt:context', (event) => {
			menuMessageId = event.detail.target?.dataset.msg;
			const message = findMessage(threadById(page.openId), menuMessageId);
			if (!message) {
				ui.messageMenu.classList.remove('show');
				return;
			}
			const ownAndSettled = sentByMe(message) && message.status !== 'sending';
			for (const item of pickAll('[data-dm-own-only]', ui.messageMenu)) item.hidden = !ownAndSettled;
			pick('[data-dm-mact="copy"]', ui.messageMenu).closest('li').hidden = !message.text;
		});
		ui.messageMenu.addEventListener('basalt:pick', (event) => {
			const id = menuMessageId;
			const actions = {
				reply: () => setTimeout(() => beginReply(id), 0),
				react: () => {
					const row = pick(`[data-msg="${id}"]`, ui.messageList);
					setTimeout(() => showEmoji('react', pick('[data-dm-tool="react"]', row) || row, id), 0);
				},
				copy: () => copyMessageText(id),
				edit: () => setTimeout(() => beginEdit(id), 0),
				delete: () => removeMessage(id),
			};
			actions[event.detail.item.dataset.dmMact]?.();
		});
	}

	function wireComposer() {
		ui.textarea.addEventListener('input', () => {
			fitTextarea();
			readMentionQuery();
			if (page.editingId) return;
			clearTimeout(draftDelay);
			const id = page.openId;
			draftDelay = setTimeout(() => {
				flushDraft(id);
				drawDraftLabel();
				drawList();
			}, 600);
		});
		ui.textarea.addEventListener('keydown', handleComposerKey);
		ui.form.addEventListener('submit', (event) => {
			event.preventDefault();
			sendFromComposer();
		});
		pick('[data-dm-context-cancel]', ui.contextBar).addEventListener('click', () => {
			endContext();
			ui.textarea.focus();
		});
	}

	function wireAttachments() {
		ui.queueList.addEventListener('click', (event) => {
			const button = event.target.closest('[data-dm-unattach]');
			if (!button) return;
			const queue = page.queued[page.openId] || [];
			const index = queue.findIndex((file) => file.id === button.dataset.dmUnattach);
			if (index >= 0) {
				say(`Removed ${queue[index].name}`);
				queue.splice(index, 1);
			}
			drawQueue();
			ui.textarea.focus();
		});
		pick('[data-dm-attach]', host).addEventListener('click', () => ui.filePicker.click());
		ui.filePicker.addEventListener('change', () => {
			attachFiles(ui.filePicker.files);
			ui.filePicker.value = '';
		});

		/* Files dragged over the open thread can be dropped straight in. The
       counter copes with dragenter and dragleave firing for every child. */
		const zone = ui.threadSection;
		zone.addEventListener('dragenter', (event) => {
			const types = Array.from(event.dataTransfer?.types || []);
			if (!page.openId || !event.dataTransfer || !types.includes('Files')) return;
			dragCount += 1;
			zone.classList.add('is-dropping');
		});
		zone.addEventListener('dragover', (event) => {
			if (zone.classList.contains('is-dropping')) event.preventDefault();
		});
		zone.addEventListener('dragleave', () => {
			dragCount = Math.max(0, dragCount - 1);
			if (!dragCount) zone.classList.remove('is-dropping');
		});
		zone.addEventListener('drop', (event) => {
			if (!zone.classList.contains('is-dropping')) return;
			event.preventDefault();
			dragCount = 0;
			zone.classList.remove('is-dropping');
			attachFiles(event.dataTransfer.files);
		});
	}

	function wireMentions() {
		/* Pressing on a suggestion must not blur the textarea first. */
		ui.mentionList.addEventListener('mousedown', (event) => event.preventDefault());
		ui.mentionList.addEventListener('click', (event) => {
			const item = event.target.closest('[data-dm-mention-pick]');
			if (item) insertMention(Number(item.dataset.dmMentionPick));
		});
		ui.textarea.addEventListener('blur', () => setTimeout(dismissMentions, 120));
		ui.textarea.addEventListener('click', () => readMentionQuery());
		pick('[data-dm-mention-btn]', host).addEventListener('click', () => {
			const value = ui.textarea.value;
			const caret = ui.textarea.selectionStart || value.length;
			const token = caret > 0 && !/\s$/.test(value.slice(0, caret)) ? ' @' : '@';
			ui.textarea.value = `${value.slice(0, caret)}${token}${value.slice(caret)}`;
			ui.textarea.focus();
			ui.textarea.setSelectionRange(caret + token.length, caret + token.length);
			readMentionQuery();
		});
	}

	function wireEmoji() {
		ui.emojiButton.addEventListener('click', () => {
			if (ui.emojiPanel.classList.contains('show')) hideEmoji(true);
			else showEmoji('composer', ui.emojiButton);
		});
		ui.emojiPanel.addEventListener('click', (event) => {
			const button = event.target.closest('[data-dm-emoji-pick]');
			if (!button) return;
			if (reactTarget) reactWith(button.dataset.dmEmojiPick);
			else insertEmoji(button.dataset.dmEmojiPick);
		});
		ui.emojiPanel.addEventListener('keydown', handleEmojiKey);
		document.addEventListener('pointerdown', (event) => {
			const inside = ui.emojiPanel.contains(event.target) || (emojiAnchor && emojiAnchor.contains(event.target));
			if (ui.emojiPanel.classList.contains('show') && !inside) hideEmoji(false);
		});
		window.addEventListener('resize', () => hideEmoji(false));
		ui.scroller.addEventListener('scroll', () => hideEmoji(false), { passive: true });
	}

	function wirePreview() {
		pick('[data-dm-pv-show]', ui.previewDialog).addEventListener('click', () => {
			if (!previewed?.where) return;
			const { thread, message } = previewed.where;
			window.bootstrap.Modal.getOrCreateInstance(ui.previewDialog).hide();
			ui.previewDialog.addEventListener(
				'hidden.bs.modal',
				() => {
					if (thread.archived && page.folder !== 'archived') switchFolder('archived');
					openThread(thread.id);
					revealMessage(message.id);
				},
				{ once: true },
			);
		});
		pick('[data-dm-pv-download]', ui.previewDialog).addEventListener('click', (event) => {
			const button = event.currentTarget;
			if (!previewed) return;
			window.Basalt.buttonState(button, 'loading');
			server
				.download(previewed.file.id)
				.then(() => {
					window.Basalt.buttonState(button, 'success');
					setTimeout(() => window.Basalt.buttonState(button, 'idle'), 1800);
				})
				.catch(() => window.Basalt.buttonState(button, 'error'));
		});
	}

	function wireCompose() {
		ui.teamPicker.addEventListener('basalt:command', (event) => {
			const id = event.detail.value;
			const index = recipients.indexOf(id);
			if (index >= 0) {
				recipients.splice(index, 1);
				say(`Removed ${who(id).name}`);
			} else if (recipients.length >= MAX_RECIPIENTS) {
				say('Five people is the most for a group');
				notify({
					tone: 'warning',
					title: 'Five people at most',
					text: 'For a bigger group, use a channel in Chat.',
					duration: 4000,
				});
				return;
			} else {
				recipients.push(id);
				say(`Added ${who(id).name}. ${countOf(recipients.length, 'person', 'people')} so far.`);
			}
			drawRecipients();
			ui.teamPicker.basaltCommand?.reset();
		});
		pick('[data-dm-picked]', ui.composeDialog).addEventListener('click', (event) => {
			const chip = event.target.closest('[data-dm-unpick]');
			if (!chip) return;
			recipients.splice(recipients.indexOf(chip.dataset.dmUnpick), 1);
			say(`Removed ${who(chip.dataset.dmUnpick).name}`);
			drawRecipients();
			pick('.basalt-command-input', ui.teamPicker).focus();
		});
		pick('[data-dm-new-form]', ui.composeDialog).addEventListener('submit', submitCompose);
		ui.composeDialog.addEventListener('shown.bs.modal', () => {
			pick('.basalt-command-input', ui.teamPicker)?.focus();
		});
	}

	function wireSearch() {
		ui.searchBox.addEventListener('input', () => {
			clearTimeout(searchDelay);
			searchDelay = setTimeout(() => {
				page.searchText = ui.searchBox.value;
				drawList();
				if (page.openId) drawThread({ scroll: 'keep' });
			}, 120);
		});
		ui.searchBox.addEventListener('keydown', handleSearchKey);
		for (const radio of pickAll('[data-dm-filter]', host)) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				page.folder = radio.value;
				drawList();
			});
		}
	}

	/* The workspace menu at the top of the list, plus the empty-state
     buttons that start a new message, all reach the host element. */
	function wireWorkspace() {
		host.addEventListener('click', (event) => {
			const target = event.target;
			if (target.closest('[data-dm-new]')) startCompose();
			if (target.closest('[data-dm-theme]'))
				window.Basalt.setTheme(window.Basalt.getTheme() === 'dark' ? 'light' : 'dark');
			else if (target.closest('[data-dm-search-open]')) setTimeout(jumpToSearch, 0);
			else if (target.closest('[data-dm-read-all]') && !page.isLoading && !page.loadFailed) markAllRead();
		});
		document.addEventListener('basalt:appearance', reflectTheme);
	}

	/* The thread list: filtering, search, rows and the counts above it. */

	function inFolder(thread) {
		if (page.folder === 'archived') return thread.archived;
		if (thread.archived) return false;
		return page.folder !== 'unread' || thread.unread > 0 || thread.id === page.openId;
	}

	/**
	 * Whether a thread matches the search, and what matched: a message, a
	 * file, or (with neither set) the people in it.
	 */
	function searchHit(thread, needle) {
		if (!needle) return { found: true };
		const term = needle.toLowerCase();
		const about = membersOf(thread)
			.map((person) => `${person.name} ${person.title} ${person.team}`)
			.join(' ')
			.toLowerCase();
		if (about.includes(term)) return { found: true };
		const message = thread.messages.findLast((item) => item.text.toLowerCase().includes(term));
		if (message) return { found: true, message };
		const file = thread.messages
			.flatMap((item) => (item.files || []).map((id) => attachments.get(id)))
			.find((candidate) => candidate && candidate.name.toLowerCase().includes(term));
		return file ? { found: true, file } : { found: false };
	}

	/** Threads for the current folder and search, pinned first in the plain inbox view. */
	function visibleThreads() {
		const needle = page.searchText.trim();
		const pinnedFirst = page.folder === 'all' && !needle;
		return threads
			.filter(inFolder)
			.map((thread) => ({ thread, hit: searchHit(thread, needle) }))
			.filter((entry) => entry.hit.found)
			.sort(
				(a, b) =>
					(pinnedFirst ? b.thread.pinned - a.thread.pinned : 0) ||
					lastActivity(b.thread) - lastActivity(a.thread),
			);
	}

	function drawList() {
		ui.threadList.setAttribute('aria-busy', String(page.isLoading));
		if (page.isLoading) {
			ui.threadList.innerHTML = listPlaceholder();
			ui.listBlank.hidden = true;
			ui.matchLine.hidden = false;
			ui.matchLine.textContent = 'Loading conversations…';
			return;
		}
		if (page.loadFailed) {
			ui.threadList.innerHTML = '';
			ui.listBlank.innerHTML = listNotice('error');
			ui.listBlank.hidden = false;
			ui.matchLine.textContent = '';
			ui.matchLine.hidden = true;
			return;
		}
		const entries = visibleThreads();
		const needle = page.searchText.trim();
		page.visibleIds = entries.map((entry) => entry.thread.id);
		ui.threadList.innerHTML = listRowsHtml(entries, needle);
		drawAvatars(ui.threadList);
		/* Only one row is tabbable: the open thread, else the first. */
		const tabStop = pick('.dm-conv.is-active', ui.threadList) || pick('.dm-conv', ui.threadList);
		if (tabStop) tabStop.tabIndex = 0;
		if (entries.length) {
			ui.listBlank.hidden = true;
		} else {
			ui.listBlank.innerHTML = listNotice(needle ? 'search' : threads.length ? page.folder : 'none');
			ui.listBlank.hidden = false;
		}
		ui.matchLine.textContent = needle
			? `${countOf(entries.length, 'conversation')} match${entries.length === 1 ? 'es' : ''} “${needle}”`
			: '';
		ui.matchLine.hidden = !needle;
		drawTallies();
	}

	/**
	 * Heads the plain inbox with Pinned, and adds Recent wherever an unpinned
	 * row follows a pinned one (or opens the list), when both kinds exist.
	 */
	function listRowsHtml(entries, needle) {
		const mixed = entries.some((entry) => entry.thread.pinned) && entries.some((entry) => !entry.thread.pinned);
		if (page.folder !== 'all' || needle || !mixed) return entries.map((entry) => threadRowHtml(entry)).join('');
		const parts = [groupHeading('Pinned')];
		let afterPinned = true;
		for (const entry of entries) {
			if (!entry.thread.pinned && afterPinned) parts.push(groupHeading('Recent'));
			afterPinned = Boolean(entry.thread.pinned);
			parts.push(threadRowHtml(entry));
		}
		return parts.join('');
	}

	function groupHeading(label) {
		return `<li class="dm-convs-group" aria-hidden="true">${label}</li>`;
	}

	function threadRowHtml({ thread, hit }) {
		const members = membersOf(thread);
		const title = threadTitle(thread);
		const isCurrent = thread.id === page.openId;
		const needle = page.searchText.trim();
		const stamp = lastActivity(thread);
		const spoken = [
			thread.unread && countOf(thread.unread, 'unread message'),
			thread.with.length === 1 && (PRESENCE_WORDS[members[0].presence] || 'Offline'),
			thread.pinned && 'pinned',
			thread.muted && 'muted',
			savedDrafts[thread.id] && !isCurrent && 'has a draft',
		].filter(Boolean);
		const rowClasses = [
			'dm-conv',
			thread.unread && 'is-unread',
			isCurrent && 'is-active',
			thread.muted && 'is-muted',
		]
			.filter(Boolean)
			.join(' ');
		const preview = hit.file
			? `File: ${markMatches(htmlSafe(hit.file.name), needle)}`
			: previewLine(thread, hit.message);
		const flags = [
			thread.muted ? '<i class="bi bi-bell-slash"></i>' : '',
			thread.pinned ? '<i class="bi bi-pin-angle-fill"></i>' : '',
			thread.unread ? `<span class="dm-conv-badge">${thread.unread}</span>` : '',
		].join('');
		return [
			`<li data-conv="${thread.id}" class="dm-convs-row">`,
			`<button class="${rowClasses}" type="button" tabindex="-1" data-dm-open="${thread.id}"${isCurrent ? ' aria-current="true"' : ''}>`,
			`<span class="dm-conv-avatar">${threadAvatar(thread)}</span>`,
			'<span class="dm-conv-main">',
			`<span class="dm-conv-top"><span class="dm-conv-name">${markMatches(htmlSafe(title), needle)}</span><time datetime="${stamp.toISOString()}" class="dm-conv-time">${listStamp(stamp)}</time></span>`,
			`<span class="dm-conv-bottom"><span class="dm-conv-snippet">${preview}</span><span aria-hidden="true" class="dm-conv-flags">${flags}</span></span>`,
			'</span>',
			`<span class="visually-hidden">, ${htmlSafe(spoken.join(', '))}</span>`,
			'</button>',
			`<button class="dm-conv-more" type="button" tabindex="-1" aria-label="Actions for ${htmlSafe(title)}"><i aria-hidden="true" class="bi bi-three-dots-vertical"></i></button>`,
			'</li>',
		].join('');
	}

	/** The second line of a row: a draft, the search hit, or the latest message. */
	function previewLine(thread, match) {
		const draft = savedDrafts[thread.id];
		if (draft && thread.id !== page.openId && !match)
			return `<span class="dm-conv-draft">Draft:</span> ${htmlSafe(draft)}`;
		const message = match || latestIn(thread);
		if (!message) return '<span class="dm-conv-quiet">No messages yet</span>';
		let speaker = '';
		if (sentByMe(message)) speaker = 'You: ';
		else if (thread.with.length > 1) speaker = `${givenName(who(message.by).name)}: `;
		let text = message.text;
		if (!text && message.files?.length) {
			const only = message.files.length === 1;
			text = `Sent ${only ? (attachments.get(message.files[0]) || { name: 'a file' }).name : countOf(message.files.length, 'file')}`;
		}
		return `${htmlSafe(speaker)}${markMatches(htmlSafe(text), page.searchText.trim())}`;
	}

	function listPlaceholder() {
		const row =
			'<li class="dm-convs-row dm-convs-row-skeleton" aria-hidden="true"><span class="basalt-skeleton basalt-skeleton-circle"></span><span class="dm-skel-lines"><span class="basalt-skeleton basalt-skeleton-text dm-skel-name"></span><span class="basalt-skeleton basalt-skeleton-text basalt-skeleton-sm"></span></span></li>';
		return row.repeat(7);
	}

	function listNotice(kind) {
		const needle = htmlSafe(page.searchText.trim());
		const narrowed = page.folder !== 'all';
		const notices = {
			error: {
				tone: 'danger',
				icon: 'bi-wifi-off',
				title: 'Your conversations did not load',
				text: 'The server did not answer. Nothing you sent is lost; this only affects what you can see here.',
				actions:
					'<button type="button" class="btn btn-sm btn-primary" data-dm-retry><i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Try again</button>',
			},
			none: {
				icon: 'bi-chat-square-text',
				title: 'No conversations yet',
				text: 'Message someone on the team and the conversation shows up here.',
				actions: NEW_MESSAGE_BUTTON,
			},
			search: {
				icon: 'bi-search',
				title: `Nothing matches “${needle}”`,
				text: `Search looks at names, roles, teams, messages and file names${narrowed ? ' in this view only' : ''}.`,
				actions: `<button type="button" class="btn btn-sm btn-outline-secondary" data-dm-clear-search>Clear the search</button>${narrowed ? '<button type="button" class="btn btn-sm btn-outline-secondary" data-dm-show-all>Search the inbox</button>' : ''}`,
			},
			unread: {
				tone: 'success',
				icon: 'bi-check2-all',
				title: 'You are all caught up',
				text: 'Nothing unread. New messages show up here until you open them.',
			},
			archived: {
				icon: 'bi-archive',
				title: 'Nothing archived',
				text: 'Archive a conversation to tidy your inbox. It comes back when someone writes in it.',
			},
			all: {
				icon: 'bi-inbox',
				title: 'Your inbox is clear',
				text: 'Everything is archived. Start a new message, or look in Archived.',
				actions: NEW_MESSAGE_BUTTON,
			},
		};
		return emptyStateHtml(notices[kind], { compact: true, alert: kind === 'error' });
	}

	/** One empty-state block, shared by the list (compact) and the thread (large icon). */
	function emptyStateHtml(notice, { compact = false, alert = false } = {}) {
		const boxClasses = [
			'basalt-empty',
			compact && 'basalt-empty-compact',
			notice.tone && `basalt-empty-${notice.tone}`,
			'dm-empty',
			!compact && 'dm-empty-thread',
		]
			.filter(Boolean)
			.join(' ');
		const iconClasses = compact ? 'dm-empty-icon' : 'dm-empty-icon dm-empty-icon-lg';
		const actions = notice.actions ? `<div class="basalt-empty-actions">${notice.actions}</div>` : '';
		return `<div class="${boxClasses}"${alert ? ' role="alert"' : ''}><span aria-hidden="true" class="${iconClasses}"><i class="bi ${notice.icon}"></i></span><h3 class="basalt-empty-title">${notice.title}</h3><p class="basalt-empty-text">${notice.text}</p>${actions}</div>`;
	}

	/** Filter badges and the "unread, online" line under the workspace name. */
	function drawTallies() {
		const inbox = threads.filter((thread) => !thread.archived);
		const unreadTotal = inbox.reduce((sum, thread) => sum + thread.unread, 0);
		const unreadThreads = inbox.filter((thread) => thread.unread).length;
		pick('[data-dm-count="unread"]', host).textContent = unreadThreads || '';
		pick('[data-dm-count="archived"]', host).textContent = threads.length - inbox.length || '';
		if (page.isLoading || page.loadFailed) {
			ui.teamLine.textContent = 'Inbox';
			return;
		}
		const online = Array.from(roster.values()).filter(
			(person) => person.id !== SAMPLE.me && person.presence === 'online',
		).length;
		ui.teamLine.textContent = `${unreadTotal ? `${unreadTotal} unread, ` : ''}${online} online`;
	}

	/* Avatars and message text. */

	function avatarMarkup(person, size, withDot) {
		const face = `<span data-basalt-avatar data-name="${htmlSafe(person.name)}" class="basalt-avatar${size ? ` basalt-avatar-${size}` : ''}" aria-hidden="true"></span>`;
		if (!withDot) return face;
		return `<span class="basalt-avatar-status">${face}<span aria-hidden="true" class="basalt-avatar-status-dot basalt-avatar-status-dot-${htmlSafe(person.presence)}"></span></span>`;
	}

	/** One person gets a presence dot; a group shows its first two faces overlapped. */
	function threadAvatar(thread) {
		if (thread.with.length === 1) return avatarMarkup(who(thread.with[0]), undefined, true);
		const faces = membersOf(thread)
			.slice(0, 2)
			.map((person) => avatarMarkup(person, 'xs'))
			.join('');
		return `<span class="dm-duo" aria-hidden="true">${faces}</span>`;
	}

	function drawAvatars(scope) {
		if (window.Basalt.avatars) window.Basalt.avatars(scope);
	}

	/**
	 * Escapes a message, then turns links and @mentions into markup and
	 * marks search hits. Links and mentions are parked behind NUL-delimited
	 * tokens first, so the later passes cannot touch their markup.
	 */
	function messageHtml(text, query) {
		const parked = [];
		function park(markup) {
			parked.push(markup);
			return `\u0000${parked.length - 1}\u0000`;
		}
		let html = htmlSafe(text).replace(URL_PATTERN, (url) =>
			park(`<a href="${url}" target="_blank" rel="noopener">${url.replace(/^https?:\/\//, '')}</a>`),
		);
		for (const person of roster.values()) {
			const tag = `@${htmlSafe(person.name)}`;
			if (!html.includes(tag)) continue;
			const mentionClass = person.id === SAMPLE.me ? 'dm-at dm-at-me' : 'dm-at';
			html = html.split(tag).join(park(`<span class="${mentionClass}">${tag}</span>`));
		}
		if (query) html = markMatches(html, query);
		// eslint-disable-next-line no-control-regex -- control characters mark text parked during the rewrite
		return html.replace(/\u0000(\d+)\u0000/g, (token, index) => parked[index]).replace(/\n/g, '<br>');
	}

	/** Wraps search hits in <mark>, skipping tags and parked tokens. */
	function markMatches(html, query) {
		const needle = query.trim();
		if (!needle) return html;
		const literal = htmlSafe(needle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const pattern = new RegExp(`(${literal})`, 'gi');
		return (
			html
				// eslint-disable-next-line no-control-regex -- control characters mark text parked during the rewrite
				.split(/(<[^>]+>|\u0000\d+\u0000)/)
				.map((part) =>
					part.startsWith('<') || part.startsWith('\u0000') ? part : part.replace(pattern, '<mark>$1</mark>'),
				)
				.join('')
		);
	}

	function urlsIn(text) {
		return text.match(URL_PATTERN) || [];
	}

	/* The open thread: header, messages, receipts and the jump button. */

	function drawHeader() {
		const thread = threadById(page.openId);
		ui.header.hidden = !thread;
		if (!thread) return;
		const members = membersOf(thread);
		const solo = thread.with.length === 1;
		ui.headerAvatar.innerHTML = solo
			? avatarMarkup(members[0], null, true)
			: `<span class="dm-duo dm-duo-lg" aria-hidden="true">${members
					.slice(0, 2)
					.map((person) => avatarMarkup(person, 'sm'))
					.join('')}</span>`;
		ui.headerName.textContent = threadTitle(thread);
		if (solo) {
			const person = members[0];
			const muted = thread.muted
				? `${HEAD_DOT}<span><i class="bi bi-bell-slash me-1" aria-hidden="true"></i>Muted</span>`
				: '';
			ui.headerMeta.innerHTML = `<span class="dm-presence dm-presence-${person.presence}">${htmlSafe(presenceLine(person))}</span>${HEAD_DOT}${htmlSafe(person.title)}${muted}`;
		} else {
			ui.headerMeta.textContent = `${countOf(members.length + 1, 'person', 'people')}, you included${thread.muted ? ' · Muted' : ''}`;
		}
		drawAvatars(ui.headerAvatar);
		ui.pinButton.setAttribute('aria-pressed', String(!!thread.pinned));
		ui.pinButton.setAttribute('aria-label', thread.pinned ? 'Unpin conversation' : 'Pin conversation');
		pick('i', ui.pinButton).className = `bi ${thread.pinned ? 'bi-pin-angle-fill' : 'bi-pin-angle'}`;
		pick('[data-dm-mute-label]', host).textContent = thread.muted ? 'Unmute notifications' : 'Mute notifications';
		pick('[data-dm-archive-label]', host).textContent = thread.archived ? 'Move to inbox' : 'Archive';
		reflectProfileState();
	}

	/**
	 * Redraws the open thread. scroll is 'new' (to the first unread),
	 * 'bottom', 'keep', or left out to follow the bottom only when the
	 * reader was already there.
	 */
	function drawThread({ scroll } = {}) {
		const thread = threadById(page.openId);
		ui.board.classList.toggle('has-thread', !!thread);
		if (page.isLoading) {
			ui.header.hidden = true;
			ui.form.hidden = true;
			ui.messageList.innerHTML = threadPlaceholder();
			ui.messageList.setAttribute('aria-busy', 'true');
			ui.threadBlank.hidden = true;
			return;
		}
		ui.messageList.setAttribute('aria-busy', 'false');
		drawHeader();
		if (!thread) {
			ui.messageList.innerHTML = '';
			ui.form.hidden = true;
			ui.jumpButton.hidden = true;
			ui.threadBlank.innerHTML = threadNotice(page.loadFailed ? 'error' : threads.length ? 'pick' : 'none');
			ui.threadBlank.hidden = false;
			drawProfile();
			return;
		}
		const wasNearBottom = distanceFromBottom() < 80;
		const savedTop = ui.scroller.scrollTop;
		ui.messageList.innerHTML = logHtml(thread);
		for (const message of thread.messages) delete message.flash;
		drawAvatars(ui.messageList);
		ui.threadBlank.innerHTML = thread.messages.length ? '' : threadNotice('fresh');
		ui.threadBlank.hidden = thread.messages.length > 0;
		ui.form.hidden = false;
		/* One message stays tabbable: the keyboard cursor, else the newest. */
		const cursorRow =
			(page.cursorId && pick(`[data-msg="${page.cursorId}"]`, ui.messageList)) ||
			pickAll('.dm-row[data-msg]', ui.messageList).pop();
		if (cursorRow) cursorRow.tabIndex = 0;
		restoreScroll(scroll, wasNearBottom, savedTop);
		refreshJump();
		drawProfile();
	}

	function restoreScroll(mode, wasNearBottom, savedTop) {
		if (mode === 'new') {
			const divider = pick('.dm-new-line', ui.messageList);
			ui.scroller.scrollTop = divider ? Math.max(0, divider.offsetTop - 24) : ui.scroller.scrollHeight;
			return;
		}
		const toBottom = mode === 'bottom' || (mode !== 'keep' && wasNearBottom);
		ui.scroller.scrollTop = toBottom ? ui.scroller.scrollHeight : savedTop;
	}

	function distanceFromBottom() {
		return ui.scroller.scrollHeight - ui.scroller.scrollTop - ui.scroller.clientHeight;
	}

	/** Every message with day dividers between them, plus the typing row. */
	function logHtml(thread) {
		const lastOwn = thread.messages.findLast((message) => sentByMe(message));
		let html = '';
		let previous = null;
		let dayOnScreen = null;
		for (const message of thread.messages) {
			const day = midnightOf(message.at);
			if (day !== dayOnScreen) {
				html += `<li class="dm-day"><h3 class="dm-day-label">${dayHeading(message.at)}</h3></li>`;
				dayOnScreen = day;
				previous = null;
			}
			html += messageRowHtml(thread, message, previous, message === lastOwn);
			previous = message;
		}
		const typist = page.typists[thread.id];
		if (typist) html += typingRowHtml(who(typist));
		return html;
	}

	/** A new group starts with a new sender, a reply, a new day or a six-minute pause. */
	function opensGroup(message, previous) {
		if (!previous || previous.by !== message.by || message.replyTo) return true;
		return message.at - previous.at > GROUP_GAP_MS || dayGap(previous.at) !== dayGap(message.at);
	}

	function messageRowHtml(thread, message, previous, isLastOwn) {
		const own = sentByMe(message);
		const sender = who(message.by);
		const leads = opensGroup(message, previous);
		const name = own ? 'You' : sender.name;
		const rowClasses = [
			'dm-row',
			own && 'dm-row-mine',
			leads && 'dm-row-start',
			message.id === page.editingId && 'is-editing',
			message.flash && 'is-flash',
		]
			.filter(Boolean)
			.join(' ');
		const byline = leads
			? `<p class="dm-row-by"><span class="dm-row-name">${htmlSafe(name)}</span> <time datetime="${message.at.toISOString()}" class="dm-row-time">${clockLabel(message.at)}</time></p>`
			: `<p class="visually-hidden">${htmlSafe(name)}, ${clockLabel(message.at)}</p>`;
		const bubble = message.text
			? `<div class="dm-bubble">${messageHtml(message.text, page.searchText.trim())}${message.edited ? ' <span class="dm-bubble-edited">(edited)</span>' : ''}</div>`
			: '';
		const files = (message.files || []).map((id) => attachments.get(id)).filter(Boolean);
		const fileList = files.length
			? `<ul aria-label="Files" class="dm-files">${files.map((file) => attachmentTile(file)).join('')}</ul>`
			: '';
		const divider =
			page.firstUnread[thread.id] === message.id
				? '<li aria-hidden="true" class="dm-new-line"><span>New</span></li>'
				: '';
		return [
			divider,
			`<li class="${rowClasses}" tabindex="-1" data-msg="${message.id}">`,
			`<span class="dm-row-side">${!own && leads ? avatarMarkup(sender, 'sm') : ''}</span>`,
			`<div class="dm-row-body">${byline}${quoteHtml(thread, message)}${bubble}${fileList}${reactionBar(message)}${receiptHtml(message, isLastOwn)}</div>`,
			messageToolsHtml(),
			'</li>',
		].join('');
	}

	function messageToolsHtml() {
		const tools = [
			['react', 'Add a reaction', 'bi-emoji-smile'],
			['reply', 'Reply', 'bi-reply'],
			['more', 'More', 'bi-three-dots'],
		];
		const buttons = tools.map(
			([tool, title, icon]) =>
				`<button type="button" class="dm-tool" title="${title}" data-dm-tool="${tool}" tabindex="-1"><i class="bi ${icon}"></i></button>`,
		);
		return `<div aria-hidden="true" class="dm-tools">${buttons.join('')}</div>`;
	}

	function quoteHtml(thread, message) {
		if (!message.replyTo) return '';
		const source = findMessage(thread, message.replyTo);
		if (!source) return '<p class="dm-quote dm-quote-gone">The original message was deleted</p>';
		const author = sentByMe(source) ? 'You' : who(source.by).name;
		return `<button type="button" data-dm-goto="${source.id}" class="dm-quote"><span class="dm-quote-by">${htmlSafe(author)}</span><span class="dm-quote-text">${htmlSafe(quotedText(source))}</span></button>`;
	}

	/** Delivery state shows under your newest message, and always while sending or failed. */
	function receiptHtml(message, isLastOwn) {
		const state = sentByMe(message) && message.status ? DELIVERY[message.status] : null;
		if (!state) return '';
		const failed = message.status === 'failed';
		const read = message.status === 'read';
		if (!isLastOwn && !failed && message.status !== 'sending') return '';
		const readTime = read && message.readAt ? ` ${clockLabel(message.readAt)}` : '';
		const retry = failed ? ' <button type="button" class="dm-link" data-dm-resend>Try again</button>' : '';
		return `<p class="dm-row-status${failed ? ' is-failed' : ''}${read ? ' is-read' : ''}"><i aria-hidden="true" class="bi ${state.icon}"></i>${state.text}${readTime}${retry}</p>`;
	}

	function reactionBar(message) {
		const used = Object.entries(message.reactions || {}).filter(([, voters]) => voters.length);
		if (!used.length) return '';
		const chips = used.map(([emoji, voters]) => {
			const mine = voters.includes(SAMPLE.me);
			const names = voters.map((id) => (id === SAMPLE.me ? 'you' : who(id).name)).join(' and ');
			const label = `${htmlSafe(emoji)} from ${htmlSafe(names)}${mine ? '. Remove yours' : '. Add yours'}`;
			return `<button type="button" class="dm-react${mine ? ' is-mine' : ''}" aria-label="${label}" aria-pressed="${mine}" data-dm-react="${htmlSafe(emoji)}"><span class="dm-react-emoji" aria-hidden="true">${emoji}</span><span class="dm-react-n" aria-hidden="true">${voters.length}</span></button>`;
		});
		return `<div class="dm-reacts">${chips.join('')}</div>`;
	}

	function typingRowHtml(person) {
		const dots =
			'<span class="basalt-loading-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
		return `<li class="dm-row dm-row-start dm-row-typing"><span class="dm-row-side">${avatarMarkup(person, 'sm')}</span><div class="dm-row-body"><span role="status" class="basalt-typing">${dots}<span class="visually-hidden">${htmlSafe(givenName(person.name))} is typing</span></span></div></li>`;
	}

	function threadPlaceholder() {
		return [false, true, false, false, true]
			.map((own, index) => {
				const side = own ? '' : '<span class="basalt-skeleton basalt-skeleton-circle dm-skel-av"></span>';
				return `<li class="dm-row dm-row-start dm-row-skeleton${own ? ' dm-row-mine' : ''}" aria-hidden="true"><span class="dm-row-side">${side}</span><div class="dm-row-body"><span class="basalt-skeleton dm-skel-bubble dm-skel-bubble-${index + 1}"></span></div></li>`;
			})
			.join('');
	}

	function threadNotice(kind) {
		const notices = {
			pick: {
				icon: 'bi-chat-square-text',
				title: 'Pick a conversation',
				text: 'Choose someone on the left, or start a new message. Press J and K to move through the list.',
			},
			none: {
				icon: 'bi-people',
				title: 'Say hello to the team',
				text: 'Start a conversation with anyone at Fieldline, one to one or in a small group.',
				actions: NEW_MESSAGE_BUTTON,
			},
			error: {
				tone: 'danger',
				icon: 'bi-wifi-off',
				title: 'Nothing to show yet',
				text: 'Your conversations appear here once they load.',
			},
			fresh: {
				icon: 'bi-hand-thumbs-up',
				title: 'This is the start of the conversation',
				text: 'Write the first message below. Files and @mentions work here too.',
			},
		};
		return emptyStateHtml(notices[kind]);
	}

	/** Shows the jump button once the reader is well above the newest message. */
	function refreshJump(label) {
		const far = distanceFromBottom() > 160;
		const caption = pick('[data-dm-jump-label]', host);
		if (label) caption.textContent = label;
		else if (!far) caption.textContent = 'Latest messages';
		ui.jumpButton.hidden = !far || !page.openId;
	}

	/* Attachments as tiles in a message. */

	function fileGlyph(file) {
		return FILE_GLYPHS[file.kind] || 'bi-file-earmark';
	}

	function attachmentTile(file) {
		const size = byteLabel(file.size);
		const name = htmlSafe(file.name);
		const label = `Preview ${name}, ${size}`;
		if (file.kind === 'image') {
			const picture = file.url
				? `<img src="${htmlSafe(file.url)}" alt="">`
				: drawingSvg(file.preview && file.preview.art);
			return `<li><button type="button" aria-label="${label}" data-dm-file="${file.id}" class="dm-file dm-file-image"><span class="dm-file-pic">${picture}</span><span class="dm-file-caption"><span class="dm-file-name">${name}</span><span class="dm-file-size">${size}</span></span></button></li>`;
		}
		const note = file.uploading ? ' · uploading…' : ' · Preview';
		return `<li><button type="button" aria-label="${label}" data-dm-file="${file.id}" class="dm-file"><span aria-hidden="true" class="dm-file-icon dm-file-icon-${file.kind}"><i class="bi ${fileGlyph(file)}"></i></span><span class="dm-file-text"><span class="dm-file-name">${name}</span><span class="dm-file-size">${size}${note}</span></span></button></li>`;
	}

	/** Small drawings that stand in for sample images, tinted by the palette. */
	function drawingSvg(art, large) {
		if (art !== 'rounds')
			return '<svg class="dm-art" viewBox="0 0 240 150" aria-hidden="true"><rect class="dm-art-ground" width="240" height="150" rx="8"></rect></svg>';
		return [
			`<svg class="dm-art" viewBox="0 0 240 150" role="img" aria-label="Map of two rounds across town"${large ? '' : ' aria-hidden="true"'}>`,
			'<rect class="dm-art-ground" width="240" height="150" rx="8"></rect>',
			'<path class="dm-art-road" d="M0 40 H240 M0 104 H240 M58 0 V150 M150 0 V150 M200 0 V150"></path>',
			'<path class="dm-art-water" d="M170 112 C190 100 230 110 240 126 V150 H150 C152 132 160 118 170 112Z"></path>',
			'<path class="dm-art-before" d="M30 125 L58 104 L58 40 L150 40 L150 104 L200 104 L200 40 L214 22"></path>',
			'<path class="dm-art-after" d="M30 125 L58 104 L150 104 L200 104 L200 40 L214 22"></path>',
			'<circle class="dm-art-stop" cx="30" cy="125" r="6"></circle>',
			'<circle class="dm-art-stop" cx="104" cy="104" r="5"></circle>',
			'<circle class="dm-art-stop" cx="200" cy="72" r="5"></circle>',
			'<circle class="dm-art-stop dm-art-stop-end" cx="214" cy="22" r="6"></circle>',
			'</svg>',
		].join('');
	}

	/* The profile column: who is in the thread, shared files and links. */

	function drawProfile() {
		const thread = threadById(page.openId);
		if (page.isLoading) {
			ui.profileContent.innerHTML =
				'<div class="dm-profile-skel" aria-hidden="true"><span class="basalt-skeleton basalt-skeleton-circle dm-skel-big"></span><span class="basalt-skeleton basalt-skeleton-title"></span><span class="basalt-skeleton basalt-skeleton-text"></span><span class="basalt-skeleton basalt-skeleton-block"></span></div>';
			return;
		}
		if (!thread) {
			ui.profileContent.innerHTML =
				'<p class="dm-profile-none">Open a conversation to see who is in it and what has been shared.</p>';
			return;
		}
		const members = membersOf(thread);
		const files = [];
		const links = [];
		for (const message of thread.messages) {
			for (const id of message.files || []) {
				const file = attachments.get(id);
				if (file) files.push({ file, message });
			}
			for (const url of urlsIn(message.text)) links.push({ url, message });
		}
		files.reverse();
		links.reverse();
		const card = members.length === 1 ? personCardHtml(members[0]) : groupCardHtml(thread, members);
		const panel = sharedTab === 'files' ? sharedFilesHtml(files) : sharedLinksHtml(links);
		ui.profileContent.innerHTML = `${card}${sharedTabsHtml(files.length, links.length)}<div class="dm-profile-panel">${panel}</div>${profileSettingsHtml(thread)}`;
		drawAvatars(ui.profileContent);
		if (window.Basalt.buttons) window.Basalt.buttons(ui.profileContent);
	}

	function personCardHtml(person) {
		const fullPage = person.userId
			? `<a href="${profileHref(person)}" class="btn btn-sm btn-outline-secondary dm-card-full"><i class="bi bi-arrows-angle-expand me-1" aria-hidden="true"></i>Open full page</a>`
			: '';
		const email = htmlSafe(person.email);
		const facts = [
			`<li><i aria-hidden="true" class="bi bi-circle-fill dm-presence-dot dm-presence-dot-${person.presence}"></i>${htmlSafe(presenceLine(person))}</li>`,
			`<li><i aria-hidden="true" class="bi bi-clock"></i>${htmlSafe(theirClock(person))}</li>`,
			`<li class="dm-card-email"><i aria-hidden="true" class="bi bi-envelope"></i><a href="mailto:${email}">${email}</a><button type="button" aria-label="Copy email address" data-basalt-copy="${email}" class="btn btn-icon dm-icon-btn dm-icon-btn-sm"><i aria-hidden="true" class="bi bi-copy"></i></button></li>`,
		].join('');
		return `<div class="dm-card"><span class="dm-card-avatar">${avatarMarkup(person, 'xl', true)}</span><h3 class="dm-card-name">${htmlSafe(person.name)}</h3><p class="dm-card-title">${htmlSafe(person.title)} · ${htmlSafe(person.team)}</p>${fullPage}<ul class="dm-card-facts">${facts}</ul></div>`;
	}

	function groupCardHtml(thread, members) {
		const everyone = [who(SAMPLE.me), ...members];
		return `<div class="dm-card dm-card-group"><h3 class="dm-card-name">${htmlSafe(threadTitle(thread))}</h3><p class="dm-card-title">${countOf(members.length + 1, 'person', 'people')}</p><ul class="dm-members">${everyone.map((person) => memberItemHtml(person)).join('')}</ul></div>`;
	}

	function memberItemHtml(person) {
		const label = `${htmlSafe(person.name)}${person.id === SAMPLE.me ? ' (you)' : ''}`;
		const name = person.userId
			? `<a href="${profileHref(person)}" class="dm-members-name dm-members-link">${label}</a>`
			: `<span class="dm-members-name">${label}</span>`;
		return `<li>${avatarMarkup(person, 'sm', true)}<span>${name}<span class="dm-members-role">${htmlSafe(person.title)}</span></span></li>`;
	}

	function sharedTabsHtml(fileCount, linkCount) {
		const tabs = [
			['files', 'Files', fileCount],
			['links', 'Links', linkCount],
		].map(([value, label, count]) =>
			[
				`<input type="radio" class="btn-check" name="dm-shared" id="dm-shared-${value}" value="${value}" data-dm-shared${sharedTab === value ? ' checked' : ''}>`,
				`<label for="dm-shared-${value}" class="basalt-segmented-option">${label} <span class="dm-filter-count">${count}</span></label>`,
			].join(''),
		);
		return `<div data-basalt-segmented class="basalt-segmented basalt-segmented-sm basalt-segmented-block dm-profile-tabs" role="radiogroup" aria-label="Shared in this conversation">${tabs.join('')}</div>`;
	}

	function sharedFilesHtml(entries) {
		if (!entries.length)
			return '<p class="dm-profile-none">No files yet. Attach one with the paper clip, or drop it on the conversation.</p>';
		const items = entries.map(({ file, message }) => {
			const sender = sentByMe(message) ? 'You' : givenName(who(message.by).name);
			return `<li><button type="button" data-dm-file="${file.id}" class="dm-shared-item"><span aria-hidden="true" class="dm-file-icon dm-file-icon-${file.kind}"><i class="bi ${fileGlyph(file)}"></i></span><span class="dm-shared-text"><span class="dm-shared-name">${htmlSafe(file.name)}</span><span class="dm-shared-meta">${byteLabel(file.size)} · ${htmlSafe(sender)}, ${listStamp(message.at)}</span></span></button></li>`;
		});
		return `<ul class="dm-shared">${items.join('')}</ul>`;
	}

	function sharedLinksHtml(entries) {
		if (!entries.length)
			return '<p class="dm-profile-none">No links yet. Any web address in a message is collected here.</p>';
		const items = entries.map(({ url, message }) => {
			const site = url.replace(/^https?:\/\//, '').split('/')[0];
			const path = url.replace(/^https?:\/\/[^/]+/, '') || site;
			return `<li><a href="${htmlSafe(url)}" class="dm-shared-item" target="_blank" rel="noopener"><span aria-hidden="true" class="dm-file-icon dm-file-icon-link"><i class="bi bi-link-45deg"></i></span><span class="dm-shared-text"><span class="dm-shared-name">${htmlSafe(path)}</span><span class="dm-shared-meta">${htmlSafe(site)} · ${listStamp(message.at)}</span></span></a></li>`;
		});
		return `<ul class="dm-shared">${items.join('')}</ul>`;
	}

	function profileSettingsHtml(thread) {
		const muteSwitch = `<div class="form-check form-switch"><input type="checkbox" id="dm-mute-switch" class="form-check-input" role="switch" data-dm-mute-switch${thread.muted ? ' checked' : ''}><label for="dm-mute-switch" class="form-check-label">Mute notifications</label></div>`;
		const remove =
			'<button type="button" data-dm-delete-conv class="btn btn-sm btn-outline-secondary dm-danger-btn"><i aria-hidden="true" class="bi bi-trash3 me-1"></i>Delete conversation</button>';
		return `<div class="dm-profile-settings">${muteSwitch}${remove}</div>`;
	}

	/* On wide screens the profile toggle shows or hides a column and is
     remembered; below that it opens the side sheet. */

	function reflectProfileState() {
		const open = hasProfileColumn() ? page.profileOn : ui.profilePanel.classList.contains('show');
		ui.profileButton.setAttribute('aria-expanded', String(open));
		ui.board.classList.toggle('is-profile-off', !page.profileOn);
	}

	function flipProfile() {
		if (!page.openId) return;
		if (!hasProfileColumn()) {
			if (window.bootstrap) window.bootstrap.Offcanvas.getOrCreateInstance(ui.profilePanel).toggle();
			return;
		}
		page.profileOn = !page.profileOn;
		memory.write(PROFILE_KEY, page.profileOn ? 'on' : 'off');
		reflectProfileState();
		say(page.profileOn ? 'Profile shown' : 'Profile hidden');
	}

	/* Opening threads and moving between them. */

	/**
	 * Makes a thread the open one. focus is 'composer', 'list' or 'thread'
	 * (the back button on narrow screens); keepHash leaves the URL alone.
	 */
	function openThread(id, { keepHash = false, focus = null } = {}) {
		const thread = threadById(id);
		if (!thread) return;
		const switching = page.openId !== id;
		if (page.openId && switching) {
			flushDraft(page.openId);
			delete page.firstUnread[page.openId];
		}
		page.openId = id;
		if (switching) {
			page.replyingTo = null;
			page.editingId = null;
			page.cursorId = null;
		}
		if (thread.unread) clearUnread(thread);
		if (!keepHash) history.replaceState(null, '', `#${id}`);
		showPane('thread');
		drawList();
		drawThread({ scroll: switching ? 'new' : 'keep' });
		fillComposer();
		const focusers = {
			composer: () => ui.textarea.focus(),
			list: () => pick(`[data-dm-open="${id}"]`, ui.threadList)?.focus(),
			thread: () => {
				if (isSinglePane()) pick('[data-dm-back]', ui.header).focus();
			},
		};
		focusers[focus]?.();
	}

	/** Remembers where the unread run starts, so the thread can show a New divider. */
	function clearUnread(thread) {
		const firstFresh = thread.messages[thread.messages.length - thread.unread];
		if (firstFresh) page.firstUnread[thread.id] = firstFresh.id;
		const previousCount = thread.unread;
		thread.unread = 0;
		server.read(thread.id).catch(
			rollbackWith('mark the conversation as read', () => {
				thread.unread = previousCount;
			}),
		);
	}

	/* J and K step through the list as it is drawn. The row to scroll to and
     announce is read again after opening, since opening redraws the list. */
	function stepThread(direction) {
		if (!page.visibleIds.length) return;
		const last = page.visibleIds.length - 1;
		const current = page.visibleIds.indexOf(page.openId);
		let index = Math.max(0, Math.min(last, current + direction));
		if (current < 0) index = direction > 0 ? 0 : last;
		openThread(page.visibleIds[index]);
		pick(`[data-dm-open="${page.visibleIds[index]}"]`, ui.threadList)?.scrollIntoView({ block: 'nearest' });
		say(threadTitle(threadById(page.visibleIds[index])));
	}

	function listMoveTarget(key, index, count) {
		const targets = {
			ArrowDown: Math.min(count - 1, index + 1),
			ArrowUp: Math.max(0, index - 1),
			Home: 0,
			End: count - 1,
		};
		return Object.hasOwn(targets, key) ? targets[key] : -1;
	}

	/** Context menus open below a button as if it had been right-clicked. */
	function openContextFrom(button) {
		const box = button.getBoundingClientRect();
		button.dispatchEvent(
			new MouseEvent('contextmenu', {
				bubbles: true,
				cancelable: true,
				clientX: box.left,
				clientY: box.bottom + 4,
			}),
		);
	}

	/* Thread actions. Each one changes the screen first, then tells the
     server, and undoes itself with a toast if the server says no. */

	function rollbackWith(action, undo) {
		return () => {
			if (undo) undo();
			drawList();
			drawThread({ scroll: 'keep' });
			notify({
				tone: 'danger',
				title: `Could not ${action}`,
				text: 'Nothing was changed. Try again in a moment.',
			});
		};
	}

	function redrawKeepingScroll() {
		drawList();
		drawThread({ scroll: 'keep' });
	}

	function showListOnly() {
		showPane('list');
		drawList();
		drawThread();
	}

	function redrawIfOpen(thread) {
		if (page.openId === thread.id) drawThread();
	}

	function pinThread(id, on) {
		const thread = threadById(id);
		if (!thread) return;
		thread.pinned = on;
		drawList();
		if (id === page.openId) drawHeader();
		say(`${on ? 'Pinned ' : 'Unpinned '}${threadTitle(thread)}`);
		server.setPinned(id, on).catch(
			rollbackWith(on ? 'pin the conversation' : 'unpin the conversation', () => {
				thread.pinned = !on;
			}),
		);
	}

	function muteThread(id, on) {
		const thread = threadById(id);
		if (!thread) return;
		thread.muted = on;
		drawList();
		if (id === page.openId) {
			drawHeader();
			const toggle = pick('[data-dm-mute-switch]', ui.profileContent);
			if (toggle) toggle.checked = on;
		}
		const title = threadTitle(thread);
		notify({
			tone: 'info',
			icon: on ? 'bi-bell-slash' : 'bi-bell',
			title: on ? `Muted ${title}` : 'Notifications back on',
			text: on
				? 'New messages still arrive here, without a sound or a pop-up.'
				: `You will be told about new messages from ${title}.`,
			duration: 4000,
		});
		server.setMuted(id, on).catch(
			rollbackWith(on ? 'mute the conversation' : 'unmute the conversation', () => {
				thread.muted = !on;
			}),
		);
	}

	function markThread(id, unread) {
		const thread = threadById(id);
		if (!thread) return;
		const previousCount = thread.unread;
		thread.unread = unread ? Math.max(1, previousCount) : 0;
		if (unread && id === page.openId) {
			/* Marking the open thread unread closes it, the way you would set
         an email aside to come back to later. */
			page.openId = null;
			showPane('list');
			history.replaceState(null, '', `${location.pathname}${location.search}`);
		}
		drawList();
		drawThread();
		say(`${unread ? 'Marked as unread: ' : 'Marked as read: '}${threadTitle(thread)}`);
		(unread ? server.unread(id) : server.read(id)).catch(
			rollbackWith('change the unread mark', () => {
				thread.unread = previousCount;
			}),
		);
	}

	function archiveThread(id, on) {
		const thread = threadById(id);
		if (!thread) return;
		const wasOpen = page.openId === id;
		const next = wasOpen && !isSinglePane() ? neighborOf(id) : null;
		thread.archived = on;
		if (wasOpen && page.folder !== 'archived' && on) {
			page.openId = null;
			if (next) openThread(next, { focus: 'list' });
			else showListOnly();
		} else {
			redrawKeepingScroll();
		}

		function putBack() {
			thread.archived = !on;
			server.setArchived(id, !on);
			if (wasOpen) openThread(id, { focus: 'list' });
			else redrawKeepingScroll();
			say(`Put back ${threadTitle(thread)}`);
		}

		notify({
			tone: 'success',
			icon: on ? 'bi-archive' : 'bi-inbox',
			title: on ? `Archived ${threadTitle(thread)}` : `Moved ${threadTitle(thread)} to the inbox`,
			text: on ? 'It comes back to the inbox when someone writes.' : '',
			actions: [{ label: 'Undo', onClick: putBack }],
		});
		server.setArchived(id, on).catch(
			rollbackWith(on ? 'archive the conversation' : 'move it to the inbox', () => {
				thread.archived = !on;
			}),
		);
	}

	/** Fills in and opens the hold-to-delete dialog for one thread. */
	function askToDelete(id) {
		const thread = threadById(id);
		if (!thread) return;
		pendingDeleteId = id;
		const fileCount = thread.messages.reduce((sum, message) => sum + (message.files || []).length, 0);
		pick('[data-dm-del-title]', ui.deleteDialog).textContent =
			`Delete your conversation with ${threadTitle(thread)}?`;
		pick('[data-dm-del-list]', ui.deleteDialog).innerHTML = [
			`<li><i aria-hidden="true" class="bi bi-chat-square-text"></i>${countOf(thread.messages.length, 'message')}</li>`,
			fileCount
				? `<li><i aria-hidden="true" class="bi bi-paperclip"></i>${countOf(fileCount, 'file')} in your copy</li>`
				: '',
			'<li><i aria-hidden="true" class="bi bi-info-circle"></i>This cannot be undone</li>',
		].join('');
		if (ui.profilePanel.classList.contains('show'))
			window.bootstrap.Offcanvas.getOrCreateInstance(ui.profilePanel).hide();
		window.bootstrap.Modal.getOrCreateInstance(ui.deleteDialog).show();
	}

	function deleteConfirmed() {
		const id = pendingDeleteId;
		const thread = threadById(id);
		if (!thread) return;
		const index = threads.indexOf(thread);
		const next = page.openId === id ? neighborOf(id) : page.openId;
		threads.splice(index, 1);
		delete savedDrafts[id];
		writeDrafts();
		/* Let the hold button show Deleted for a moment before the dialog goes. */
		setTimeout(() => {
			window.bootstrap.Modal.getOrCreateInstance(ui.deleteDialog).hide();
			page.openId = null;
			if (next && !isSinglePane()) openThread(next, { focus: 'list' });
			else showListOnly();
		}, 350);
		say(`Deleted the conversation with ${threadTitle(thread)}`);
		server.drop(id).catch(() => {
			threads.splice(index, 0, thread);
			drawList();
			notify({
				tone: 'danger',
				title: 'Could not delete the conversation',
				text: 'It is back in your inbox. Try again in a moment.',
			});
		});
	}

	/* Single messages: clicks, keys, reply, edit, react and delete. */

	function handleMessageClick(event) {
		const target = event.target;
		const quote = target.closest('[data-dm-goto]');
		if (quote) {
			revealMessage(quote.dataset.dmGoto);
			return;
		}
		const fileButton = target.closest('[data-dm-file]');
		if (fileButton) {
			showPreview(fileButton.dataset.dmFile);
			return;
		}
		const row = target.closest('.dm-row[data-msg]');
		if (!row) return;
		const id = row.dataset.msg;
		const chip = target.closest('[data-dm-react]');
		if (chip) {
			flipReaction(id, chip.dataset.dmReact);
			return;
		}
		if (target.closest('[data-dm-resend]')) {
			retrySend(id);
			return;
		}
		const tool = target.closest('[data-dm-tool]');
		if (!tool) return;
		const tools = {
			reply: () => beginReply(id),
			react: () => showEmoji('react', tool, id),
			more: () => openContextFrom(tool),
		};
		tools[tool.dataset.dmTool]?.();
	}

	/**
	 * Keys on a focused message: arrows, Home and End move; R replies;
	 * E edits and Delete removes your own; Escape returns to the composer;
	 * Enter opens the first file.
	 */
	function handleRowKey(event, row) {
		const rows = pickAll('.dm-row[data-msg]', ui.messageList);
		const index = rows.indexOf(row);
		const id = row.dataset.msg;
		const message = findMessage(threadById(page.openId), id);
		const own = Boolean(message && sentByMe(message));
		const key = event.key;
		if (key === 'ArrowDown' || key === 'ArrowUp') {
			event.preventDefault();
			const next = index + (key === 'ArrowDown' ? 1 : -1);
			if (next >= rows.length) ui.textarea.focus();
			else if (rows[next]) moveCursorTo(rows[next]);
		} else if (key === 'Home' || key === 'End') {
			event.preventDefault();
			moveCursorTo(rows[key === 'Home' ? 0 : rows.length - 1]);
		} else if (key === 'r' || key === 'R') {
			event.preventDefault();
			event.stopPropagation();
			beginReply(id);
		} else if ((key === 'e' || key === 'E') && own) {
			event.preventDefault();
			event.stopPropagation();
			beginEdit(id);
		} else if ((key === 'Delete' || key === 'Backspace') && own) {
			event.preventDefault();
			removeMessage(id);
		} else if (key === 'Escape') {
			event.preventDefault();
			ui.textarea.focus();
		} else if (key === 'Enter') {
			const fileButton = pick('[data-dm-file]', row);
			if (!fileButton) return;
			event.preventDefault();
			showPreview(fileButton.dataset.dmFile);
		}
	}

	/** Scrolls a message into view, flashes it and puts the keyboard on it. */
	function revealMessage(id) {
		const row = pick(`[data-msg="${id}"]`, ui.messageList);
		if (!row) return;
		row.scrollIntoView({ block: 'center', behavior: prefersStill() ? 'auto' : 'smooth' });
		row.classList.remove('is-flash');
		/* Reading the width forces a reflow, so the flash animation restarts. */
		void row.offsetWidth;
		row.classList.add('is-flash');
		setTimeout(() => row.classList.remove('is-flash'), 1700);
		moveCursorTo(row);
	}

	function moveCursorTo(row) {
		for (const other of pickAll('.dm-row[data-msg]', ui.messageList)) other.tabIndex = -1;
		row.tabIndex = 0;
		row.focus({ preventScroll: false });
		page.cursorId = row.dataset.msg;
	}

	function beginReply(messageId) {
		const message = findMessage(threadById(page.openId), messageId);
		if (!message) return;
		page.editingId = null;
		page.replyingTo = messageId;
		drawContextBar();
		ui.textarea.focus();
		say(`Replying to ${sentByMe(message) ? 'your message' : who(message.by).name}`);
	}

	function beginEdit(messageId) {
		const message = findMessage(threadById(page.openId), messageId);
		if (!message || !sentByMe(message) || message.status === 'sending') return;
		page.replyingTo = null;
		page.editingId = messageId;
		ui.textarea.value = message.text;
		drawContextBar();
		drawThread({ scroll: 'keep' });
		fitTextarea();
		ui.textarea.focus();
		const end = ui.textarea.value.length;
		ui.textarea.setSelectionRange(end, end);
		say('Editing your message. Enter saves, Escape stops.');
	}

	/** Leaves reply or edit mode; an edit hands the box back to the thread's draft. */
	function endContext(silent) {
		const wasEditing = page.editingId;
		page.replyingTo = null;
		page.editingId = null;
		if (wasEditing) {
			ui.textarea.value = savedDrafts[page.openId] || '';
			fitTextarea();
			drawThread({ scroll: 'keep' });
		}
		drawContextBar();
		if (!silent) say(wasEditing ? 'Stopped editing' : 'Stopped replying');
	}

	/** The strip above the composer that says what you are replying to or editing. */
	function drawContextBar() {
		const editing = Boolean(page.editingId);
		const message = findMessage(threadById(page.openId), page.editingId || page.replyingTo);
		ui.contextBar.hidden = !message;
		ui.sendText.textContent = editing ? 'Save' : 'Send';
		if (!message) return;
		pick('[data-dm-context-icon]', ui.contextBar).className = `bi ${editing ? 'bi-pencil' : 'bi-reply'}`;
		pick('[data-dm-context-title]', ui.contextBar).textContent = editing
			? 'Editing your message'
			: `Replying to ${sentByMe(message) ? 'yourself' : who(message.by).name}`;
		pick('[data-dm-context-quote]', ui.contextBar).textContent = quotedText(message);
		pick('[data-dm-context-cancel]', ui.contextBar).setAttribute(
			'aria-label',
			editing ? 'Stop editing' : 'Stop replying',
		);
	}

	function flipReaction(messageId, emoji) {
		const thread = threadById(page.openId);
		const message = findMessage(thread, messageId);
		if (!message) return;
		message.reactions = message.reactions || {};
		const voters = (message.reactions[emoji] = message.reactions[emoji] || []);
		const adding = !voters.includes(SAMPLE.me);
		if (adding) voters.push(SAMPLE.me);
		else voters.splice(voters.indexOf(SAMPLE.me), 1);
		drawThread({ scroll: 'keep' });
		say(`${adding ? 'Added ' : 'Removed '}${emoji}`);
		server.setReaction(thread.id, messageId, emoji, adding).catch(
			rollbackWith('change the reaction', () => {
				const current = message.reactions[emoji];
				if (adding) current.splice(current.indexOf(SAMPLE.me), 1);
				else current.push(SAMPLE.me);
			}),
		);
	}

	function removeMessage(messageId) {
		const thread = threadById(page.openId);
		const message = findMessage(thread, messageId);
		if (!message || !sentByMe(message)) return;
		const index = thread.messages.indexOf(message);
		thread.messages.splice(index, 1);
		if (page.replyingTo === messageId || page.editingId === messageId) endContext(true);
		const neighbor = thread.messages[index] || thread.messages[index - 1];
		page.cursorId = neighbor ? neighbor.id : null;
		drawList();
		drawThread({ scroll: 'keep' });

		function restore() {
			thread.messages.splice(Math.min(index, thread.messages.length), 0, message);
			message.flash = true;
			drawList();
			if (page.openId === thread.id) drawThread({ scroll: 'keep' });
		}

		const excerpt = message.text.length > 60 ? `${message.text.slice(0, 57)}…` : message.text;
		notify({
			tone: 'success',
			icon: 'bi-trash3',
			title: 'Message deleted',
			text: message.text ? `“${excerpt}”` : '',
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						restore();
						server.undiscard(thread.id, messageId);
						say('Message put back');
					},
				},
			],
		});
		server.discard(thread.id, messageId).catch(rollbackWith('delete the message', restore));
	}

	function copyMessageText(messageId) {
		const message = findMessage(threadById(page.openId), messageId);
		if (!message || !window.Basalt.copyText) return;
		window.Basalt.copyText(message.text).then(
			() => notify({ tone: 'success', icon: 'bi-clipboard-check', title: 'Copied the message', duration: 2500 }),
			() => notify({ tone: 'danger', title: 'Could not copy', text: 'Your browser blocked the clipboard.' }),
		);
	}

	/* The composer: drafts, sending, delivery and replies. */

	/** Saves what is in the box as the thread's draft, unless an edit is in progress. */
	function flushDraft(id) {
		clearTimeout(draftDelay);
		if (!id || page.editingId) return;
		const before = savedDrafts[id] || '';
		const text = ui.textarea.value;
		if (text.trim()) savedDrafts[id] = text;
		else delete savedDrafts[id];
		writeDrafts();
		const after = savedDrafts[id] || '';
		if (after !== before) server.keepDraft(id, after).catch(() => {});
	}

	function drawDraftLabel() {
		ui.draftLabel.textContent = savedDrafts[page.openId] && !page.editingId ? 'Draft saved. ' : '';
	}

	/** Loads the open thread's draft (or the message being edited) into the box. */
	function fillComposer() {
		const thread = threadById(page.openId);
		if (!thread) return;
		ui.textarea.value = page.editingId
			? findMessage(thread, page.editingId)?.text || ''
			: savedDrafts[thread.id] || '';
		const addressee = thread.with.length === 1 ? givenName(who(thread.with[0]).name) : threadTitle(thread);
		ui.textarea.placeholder = `Message ${addressee}`;
		ui.textareaLabel.textContent = `Message ${threadTitle(thread)}`;
		fitTextarea();
		drawContextBar();
		drawQueue();
		drawDraftLabel();
		dismissMentions();
	}

	/* The box grows with its text up to 180px, then scrolls. */
	function fitTextarea() {
		ui.textarea.style.height = 'auto';
		ui.textarea.style.height = `${Math.min(ui.textarea.scrollHeight, 180)}px`;
	}

	function handleComposerKey(event) {
		const key = event.key;
		if (!ui.mentionList.hidden) {
			const mentionKeys = {
				ArrowDown: () => shiftMention(1),
				ArrowUp: () => shiftMention(-1),
				Enter: () => insertMention(),
				Tab: () => insertMention(),
				Escape: () => {
					event.stopPropagation();
					dismissMentions();
				},
			};
			if (Object.hasOwn(mentionKeys, key)) {
				event.preventDefault();
				mentionKeys[key]();
				return;
			}
		}
		if (key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			sendFromComposer();
			return;
		}
		if (key === 'Escape' && (page.replyingTo || page.editingId)) {
			event.preventDefault();
			event.stopPropagation();
			endContext();
			return;
		}
		if (key !== 'ArrowUp' || page.editingId) return;
		/* Up in an empty box edits your last settled message, or failing that
       moves the keyboard onto the newest message. */
		if (!ui.textarea.value) {
			const thread = threadById(page.openId);
			const lastOwn =
				thread &&
				thread.messages.findLast(
					(message) => sentByMe(message) && message.status !== 'sending' && message.status !== 'failed',
				);
			if (lastOwn) {
				event.preventDefault();
				beginEdit(lastOwn.id);
				return;
			}
		}
		if (ui.textarea.selectionStart !== 0 || ui.textarea.selectionEnd !== 0) return;
		const rows = pickAll('.dm-row[data-msg]', ui.messageList);
		if (rows.length && !ui.textarea.value) {
			event.preventDefault();
			moveCursorTo(rows[rows.length - 1]);
		}
	}

	function sendFromComposer() {
		const thread = threadById(page.openId);
		if (!thread) return;
		const text = ui.textarea.value.replace(/\s+$/, '');
		if (page.editingId) {
			saveEdit(thread, text);
			return;
		}
		const queue = page.queued[thread.id] || [];
		if (!text.trim() && !queue.length) {
			ui.textarea.focus();
			return;
		}
		if (queue.some((file) => file.uploading)) {
			notify({
				tone: 'info',
				title: 'Still uploading',
				text: 'The message goes once your files are up.',
				duration: 3000,
			});
			return;
		}
		const message = {
			id: makeId('m'),
			by: SAMPLE.me,
			at: clockNow(),
			text: text.trim() ? text : '',
			status: 'sending',
		};
		if (queue.length) message.files = queue.map((file) => file.id);
		if (page.replyingTo) message.replyTo = page.replyingTo;
		thread.messages.push(message);
		page.queued[thread.id] = [];
		page.replyingTo = null;
		page.cursorId = null;
		delete savedDrafts[thread.id];
		writeDrafts();
		ui.textarea.value = '';
		fitTextarea();
		if (thread.archived) {
			thread.archived = false;
			server.setArchived(thread.id, false);
		}
		drawContextBar();
		drawQueue();
		drawDraftLabel();
		drawList();
		drawThread({ scroll: 'bottom' });
		dispatchMessage(thread, message);
	}

	function saveEdit(thread, text) {
		const message = findMessage(thread, page.editingId);
		if (!message) {
			endContext(true);
			return;
		}
		if (!text.trim() && !message.files?.length) {
			notify({
				tone: 'warning',
				title: 'A message cannot be empty',
				text: 'To remove it, use Delete in the message menu.',
				duration: 4000,
			});
			return;
		}
		if (text !== message.text) {
			const previous = { text: message.text, edited: message.edited };
			message.text = text;
			message.edited = true;
			server.revise(thread.id, message.id, text).catch(
				rollbackWith('save your edit', () => {
					Object.assign(message, previous);
				}),
			);
			say('Message saved');
		}
		page.editingId = null;
		ui.textarea.value = savedDrafts[thread.id] || '';
		fitTextarea();
		drawContextBar();
		drawList();
		drawThread({ scroll: 'keep' });
		drawDraftLabel();
	}

	/** Sends a message and walks it through sent and delivered. */
	function dispatchMessage(thread, message) {
		server
			.post(thread.id, message)
			.then(() => {
				message.status = 'sent';
				redrawIfOpen(thread);
				if (who(thread.with[0]).presence === 'offline') return;
				setTimeout(() => {
					if (message.status !== 'sent') return;
					message.status = 'delivered';
					redrawIfOpen(thread);
				}, 500);
				playAnswer(thread, message);
			})
			.catch(() => {
				message.status = 'failed';
				redrawIfOpen(thread);
				notify({
					tone: 'danger',
					title: 'Your message was not sent',
					text: 'Check your connection, then use Try again under the message.',
				});
			});
	}

	function retrySend(messageId) {
		const thread = threadById(page.openId);
		const message = findMessage(thread, messageId);
		if (!message) return;
		message.status = 'sending';
		drawThread();
		dispatchMessage(thread, message);
	}

	/* Demo only: the other person reads your message, types for a moment,
     then answers with the next canned line. */
	function playAnswer(thread, message) {
		const speaker = thread.with[0];
		const lines = cannedAnswers[speaker];
		if (!lines || !lines.length || who(speaker).presence === 'offline') return;
		setTimeout(() => {
			if (!threadById(thread.id)) return;
			if (message.status === 'delivered' || message.status === 'sent') {
				message.status = 'read';
				message.readAt = clockNow();
			}
			page.typists[thread.id] = speaker;
			redrawIfOpen(thread);
		}, 1300);
		setTimeout(() => {
			if (!threadById(thread.id)) return;
			delete page.typists[thread.id];
			const text = lines.shift();
			acceptIncoming(thread, { id: makeId('m'), by: speaker, at: clockNow(), text });
		}, 3600);
	}

	/** Adds a message from someone else, counting it unread unless the thread is on screen. */
	function acceptIncoming(thread, message) {
		thread.messages.push(message);
		const sender = who(message.by);
		if (thread.archived) thread.archived = false;
		const watching =
			page.openId === thread.id && !document.hidden && (!isSinglePane() || ui.board.dataset.view === 'thread');
		if (!watching) thread.unread += 1;
		drawList();
		if (page.openId === thread.id) {
			const far = distanceFromBottom() > 160;
			drawThread();
			if (far) refreshJump(`New message from ${givenName(sender.name)}`);
		}
		/* Clearing the live region first makes a repeat of the same words announce again. */
		ui.liveRegion.textContent = '';
		setTimeout(() => {
			ui.liveRegion.textContent = watching
				? `${sender.name} says: ${message.text}`
				: `New message from ${sender.name}${thread.muted ? ', muted' : ''}: ${message.text}`;
		}, 50);
		if (watching || thread.muted) return;
		notify({
			tone: 'info',
			icon: 'bi-chat-square-text',
			title: sender.name,
			text: message.text,
			duration: 6000,
			actions: [
				{
					label: 'Open',
					onClick: () => {
						if (thread.archived) switchFolder('all');
						openThread(thread.id, { focus: 'composer' });
					},
				},
			],
		});
	}

	/* Attachments waiting in the composer. */

	function attachFiles(fileList) {
		const thread = threadById(page.openId);
		if (!thread || !fileList.length) return;
		const queue = (page.queued[thread.id] = page.queued[thread.id] || []);
		for (const upload of Array.from(fileList)) queueUpload(thread, queue, upload);
		drawQueue();
		say(`${countOf(fileList.length, 'file')} attached`);
		ui.textarea.focus();
	}

	function queueUpload(thread, queue, upload) {
		const kind = fileKind(upload);
		const file = {
			id: makeId('f'),
			name: upload.name,
			size: upload.size,
			kind,
			uploading: true,
			url: kind === 'image' ? URL.createObjectURL(upload) : null,
			preview: {
				lines: [
					['File', upload.name],
					['Size', byteLabel(upload.size)],
				],
				title: upload.name,
			},
		};
		attachments.set(file.id, file);
		queue.push(file);
		server
			.upload(upload)
			.then(() => {
				file.uploading = false;
				if (page.openId === thread.id) drawQueue();
			})
			.catch(() => {
				queue.splice(queue.indexOf(file), 1);
				drawQueue();
				notify({ tone: 'danger', title: `Could not upload ${file.name}`, text: 'Try attaching it again.' });
			});
	}

	function fileKind(upload) {
		if (/^image\//.test(upload.type)) return 'image';
		if (/pdf$/i.test(upload.name)) return 'pdf';
		return /\.(csv|xlsx?|numbers)$/i.test(upload.name) ? 'sheet' : 'doc';
	}

	function drawQueue() {
		const queue = page.queued[page.openId] || [];
		ui.queueList.hidden = !queue.length;
		ui.queueList.innerHTML = queue
			.map((file) => {
				const name = htmlSafe(file.name);
				return `<li class="basalt-removable basalt-tone-primary dm-pending"><i aria-hidden="true" class="bi ${fileGlyph(file)}"></i><span class="dm-pending-name">${name}</span><span class="dm-pending-size">${file.uploading ? 'uploading…' : byteLabel(file.size)}</span><button type="button" aria-label="Remove ${name}" data-dm-unattach="${file.id}" class="basalt-removable-remove"><i aria-hidden="true" class="bi bi-x"></i></button></li>`;
			})
			.join('');
	}

	/* @mention suggestions under the composer. */

	/** Opens the suggestions when the caret sits right after "@" and a partial name. */
	function readMentionQuery() {
		const caret = ui.textarea.selectionStart;
		const typed = ui.textarea.value.slice(0, caret);
		const match = typed.match(/(^|\s)@([^\s@]{0,20})$/);
		if (!match) {
			dismissMentions();
			return;
		}
		const term = match[2].toLowerCase();
		const options = Array.from(roster.values())
			.filter((person) => person.id !== SAMPLE.me && nameStartsWith(person.name, term))
			.slice(0, 6);
		if (!options.length) {
			dismissMentions();
			return;
		}
		mentionPick = { start: caret - match[2].length - 1, end: caret, options, index: 0 };
		ui.mentionList.innerHTML = options
			.map((person, index) => {
				const active = index === 0;
				return `<li id="dm-mention-${person.id}" class="dm-mention-item${active ? ' is-active' : ''}" role="option" aria-selected="${active}" data-dm-mention-pick="${index}">${avatarMarkup(person, 'xs', true)}<span class="dm-mention-name">${htmlSafe(person.name)}</span><span class="dm-mention-role">${htmlSafe(person.team)}</span></li>`;
			})
			.join('');
		drawAvatars(ui.mentionList);
		ui.mentionList.hidden = false;
		ui.textarea.setAttribute('aria-controls', 'dm-mention-list');
		ui.textarea.setAttribute('aria-activedescendant', `dm-mention-${options[0].id}`);
	}

	function nameStartsWith(name, term) {
		const lower = name.toLowerCase();
		return lower.split(' ').some((word) => word.startsWith(term)) || lower.startsWith(term);
	}

	function shiftMention(step) {
		if (!mentionPick) return;
		const count = mentionPick.options.length;
		mentionPick.index = (mentionPick.index + step + count) % count;
		for (const [index, item] of pickAll('.dm-mention-item', ui.mentionList).entries()) {
			const active = index === mentionPick.index;
			item.classList.toggle('is-active', active);
			item.setAttribute('aria-selected', String(active));
		}
		ui.textarea.setAttribute('aria-activedescendant', `dm-mention-${mentionPick.options[mentionPick.index].id}`);
	}

	function insertMention(index) {
		if (!mentionPick) return;
		const person = mentionPick.options[index ?? mentionPick.index];
		const value = ui.textarea.value;
		const inserted = `@${person.name} `;
		const caret = mentionPick.start + inserted.length;
		ui.textarea.value = `${value.slice(0, mentionPick.start)}${inserted}${value.slice(mentionPick.end)}`;
		dismissMentions();
		ui.textarea.focus();
		ui.textarea.setSelectionRange(caret, caret);
		ui.textarea.dispatchEvent(new Event('input'));
		say(`Mentioned ${person.name}`);
	}

	function dismissMentions() {
		mentionPick = null;
		ui.mentionList.hidden = true;
		ui.textarea.removeAttribute('aria-activedescendant');
		ui.textarea.removeAttribute('aria-controls');
	}

	/* The emoji panel, used both for the composer and for reactions. */

	/** mode 'react' targets messageId; any other mode inserts into the composer. */
	function showEmoji(mode, anchor, messageId) {
		const reacting = mode === 'react';
		reactTarget = reacting ? messageId : null;
		emojiAnchor = anchor;
		pick('[data-dm-emoji-title]', ui.emojiPanel).textContent = reacting
			? 'React to the message'
			: 'Add to your message';
		ui.emojiPanel.classList.add('show');
		placeEmojiPanel(anchor);
		if (!reacting) ui.emojiButton.setAttribute('aria-expanded', 'true');
		const reactions = reactTarget ? findMessage(threadById(page.openId), reactTarget)?.reactions || {} : {};
		const buttons = pickAll('.dm-emoji-btn', ui.emojiPanel);
		for (const [index, button] of buttons.entries()) {
			const emoji = button.dataset.dmEmojiPick;
			const own = Boolean(reactTarget) && (reactions[emoji] || []).includes(SAMPLE.me);
			button.setAttribute('aria-label', `${emoji}${own ? ', yours, press to remove' : ''}`);
			button.classList.toggle('is-on', own);
			button.tabIndex = index === 0 ? 0 : -1;
		}
		buttons[0].focus();
	}

	/* Above the anchor when it fits, otherwise below, and never off the side. */
	function placeEmojiPanel(anchor) {
		const box = anchor.getBoundingClientRect();
		const width = ui.emojiPanel.offsetWidth;
		const height = ui.emojiPanel.offsetHeight;
		const viewport = document.documentElement.clientWidth;
		const above = box.top - height - 6;
		ui.emojiPanel.style.left = `${Math.max(8, Math.min(box.left, viewport - width - 8))}px`;
		ui.emojiPanel.style.top = `${above < 8 ? box.bottom + 6 : above}px`;
	}

	function hideEmoji(refocus) {
		if (!ui.emojiPanel.classList.contains('show')) return;
		ui.emojiPanel.classList.remove('show');
		ui.emojiButton.setAttribute('aria-expanded', 'false');
		if (!refocus) return;
		if (!reactTarget) {
			ui.textarea.focus();
			return;
		}
		const row = pick(`[data-msg="${reactTarget}"]`, ui.messageList);
		if (row) moveCursorTo(row);
	}

	function reactWith(emoji) {
		const id = reactTarget;
		hideEmoji(false);
		flipReaction(id, emoji);
		const row = pick(`[data-msg="${id}"]`, ui.messageList);
		if (row) moveCursorTo(row);
	}

	function insertEmoji(emoji) {
		const value = ui.textarea.value;
		const from = ui.textarea.selectionStart ?? value.length;
		const to = ui.textarea.selectionEnd ?? value.length;
		ui.textarea.value = `${value.slice(0, from)}${emoji}${value.slice(to)}`;
		hideEmoji(true);
		ui.textarea.setSelectionRange(from + emoji.length, from + emoji.length);
		ui.textarea.dispatchEvent(new Event('input'));
	}

	/** Arrow keys walk the five-column grid; Escape and Tab close it. */
	function handleEmojiKey(event) {
		if (event.key === 'Escape' || event.key === 'Tab') {
			event.preventDefault();
			event.stopPropagation();
			hideEmoji(true);
			return;
		}
		const buttons = pickAll('.dm-emoji-btn', ui.emojiPanel);
		const index = buttons.indexOf(document.activeElement);
		const last = buttons.length - 1;
		const targets = {
			ArrowRight: Math.min(last, index + 1),
			ArrowLeft: Math.max(0, index - 1),
			ArrowDown: Math.min(last, index + EMOJI_COLUMNS),
			ArrowUp: Math.max(0, index - EMOJI_COLUMNS),
			Home: 0,
			End: last,
		};
		const target = Object.hasOwn(targets, event.key) ? targets[event.key] : -1;
		if (target < 0) return;
		event.preventDefault();
		for (const button of buttons) button.tabIndex = -1;
		buttons[target].tabIndex = 0;
		buttons[target].focus();
	}

	/* The file preview dialog. */

	function showPreview(fileId) {
		const file = attachments.get(fileId);
		if (!file) return;
		const where = locateFile(fileId);
		previewed = { file, where };
		const dialog = ui.previewDialog;
		const sharedBy = where
			? ` · Shared by ${sentByMe(where.message) ? 'you' : who(where.message.by).name} ${sinceLabel(where.message.at)}`
			: '';
		pick('[data-dm-pv-name]', dialog).textContent = file.name;
		pick('[data-dm-pv-icon]', dialog).innerHTML = `<i class="bi ${fileGlyph(file)}"></i>`;
		pick('[data-dm-pv-sub]', dialog).textContent = `${byteLabel(file.size)}${sharedBy}`;
		pick('[data-dm-pv-body]', dialog).innerHTML = previewBodyHtml(file);
		pick('[data-dm-pv-show]', dialog).hidden = !where;
		window.Basalt.buttonState(pick('[data-dm-pv-download]', dialog), 'idle');
		window.bootstrap.Modal.getOrCreateInstance(dialog).show();
	}

	function previewBodyHtml(file) {
		const details = file.preview || {};
		if (file.kind === 'image') return imagePreviewHtml(file, details);
		if (file.kind === 'sheet' && details.columns) return tablePreviewHtml(details);
		const lines = (details.lines || [])
			.map(([term, text]) => `<div><dt>${htmlSafe(term)}</dt><dd>${htmlSafe(text)}</dd></div>`)
			.join('');
		return `<article class="dm-pv-page"><h3 class="dm-pv-page-title">${htmlSafe(details.title || file.name)}</h3><dl class="dm-pv-page-lines">${lines}</dl></article>`;
	}

	function imagePreviewHtml(file, details) {
		const picture = file.url
			? `<img src="${htmlSafe(file.url)}" alt="${htmlSafe(file.name)}">`
			: drawingSvg(details.art, true);
		const caption = details.caption ? `<figcaption>${htmlSafe(details.caption)}</figcaption>` : '';
		const legend =
			details.art === 'rounds'
				? '<ul class="dm-pv-legend"><li><span aria-hidden="true" class="dm-pv-key dm-pv-key-before"></span>Before: 41 miles</li><li><span aria-hidden="true" class="dm-pv-key dm-pv-key-after"></span>With Travel Planner: 33 miles</li></ul>'
				: '';
		return `<figure class="dm-pv-image">${picture}${caption}</figure>${legend}`;
	}

	function tablePreviewHtml(details) {
		const head = details.columns.map((heading) => `<th scope="col">${htmlSafe(heading)}</th>`).join('');
		const body = details.rows
			.map((cells) => `<tr>${cells.map((cell) => `<td>${htmlSafe(cell)}</td>`).join('')}</tr>`)
			.join('');
		const more = details.more ? `<p class="dm-pv-more">${htmlSafe(details.more)} in the full file</p>` : '';
		return `<div class="table-responsive dm-pv-table"><table class="table table-sm mb-0"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${more}`;
	}

	/* The new message dialog. */

	/** Builds the people list in the dialog, grouped by team in A to Z order. */
	function fillTeamPicker() {
		const byTeam = {};
		for (const person of roster.values()) {
			if (person.id === SAMPLE.me) continue;
			(byTeam[person.team] = byTeam[person.team] || []).push(person);
		}
		ui.teamOptions.innerHTML = Object.keys(byTeam)
			.sort()
			.map((team, index) => {
				const options = byTeam[team].map((person) => teamOptionHtml(person)).join('');
				return `<div class="basalt-command-group" role="group" aria-labelledby="dm-people-g-${index}"><div id="dm-people-g-${index}" class="basalt-command-heading">${htmlSafe(team)}</div>${options}</div>`;
			})
			.join('');
		drawAvatars(ui.teamOptions);
		if (!pickerReady && window.Basalt.command) {
			window.Basalt.command(ui.teamPicker);
			pickerReady = true;
		}
	}

	function teamOptionHtml(person) {
		return [
			`<div id="dm-person-${person.id}" class="basalt-command-item dm-people-item" role="option" aria-selected="false" data-value="${person.id}" data-keywords="${htmlSafe(`${person.team} ${person.city}`)}">`,
			`<span aria-hidden="true" class="basalt-command-icon dm-people-av">${avatarMarkup(person, 'xs', true)}</span>`,
			`<span class="basalt-command-text"><span class="basalt-command-title">${htmlSafe(person.name)}</span><span class="basalt-command-sub">${htmlSafe(person.title)}</span></span>`,
			`<span data-dm-person-hint class="basalt-command-hint dm-people-hint">${htmlSafe(shortPresence(person))}</span>`,
			'</div>',
		].join('');
	}

	/** Chips for the chosen people, their state in the list, and the submit label. */
	function drawRecipients() {
		pick('[data-dm-picked]', ui.composeDialog).innerHTML = recipients
			.map((id) => {
				const name = htmlSafe(who(id).name);
				return `<li><span class="basalt-removable basalt-tone-primary">${name}<button type="button" aria-label="Remove ${name}" data-dm-unpick="${id}" class="basalt-removable-remove"><i aria-hidden="true" class="bi bi-x"></i></button></span></li>`;
			})
			.join('');
		pick('[data-dm-picked-none]', ui.composeDialog).hidden = recipients.length > 0;
		for (const option of pickAll('.dm-people-item', ui.teamOptions)) {
			const chosen = recipients.includes(option.dataset.value);
			option.classList.toggle('is-picked', chosen);
			pick('[data-dm-person-hint]', option).innerHTML = chosen
				? '<i class="bi bi-check-lg me-1" aria-hidden="true"></i>Added'
				: htmlSafe(shortPresence(who(option.dataset.value)));
		}
		const existing = recipients.length ? threadWith(recipients) : null;
		pick('[data-dm-new-submit-label]', ui.composeDialog).textContent = existing
			? 'Open conversation'
			: 'Start conversation';
		if (recipients.length) ui.recipientError.classList.remove('d-block');
	}

	function startCompose(preset) {
		if (page.isLoading || page.loadFailed) return;
		recipients.length = 0;
		if (preset) recipients.push(preset);
		pick('[data-dm-new-text]', ui.composeDialog).value = '';
		ui.recipientError.classList.remove('d-block');
		window.Basalt.buttonState(ui.startButton, 'idle');
		drawRecipients();
		window.bootstrap.Modal.getOrCreateInstance(ui.composeDialog).show();
	}

	/* Starting a thread that already exists just opens it. */
	function submitCompose(event) {
		event.preventDefault();
		if (!recipients.length) {
			ui.recipientError.classList.add('d-block');
			say('Add at least one person.');
			pick('.basalt-command-input', ui.teamPicker).focus();
			return;
		}
		const text = pick('[data-dm-new-text]', ui.composeDialog).value.trim();
		const existing = threadWith(recipients);
		if (existing) {
			finishCompose(existing, text);
			return;
		}
		window.Basalt.buttonState(ui.startButton, 'loading');
		const personIds = recipients.slice();
		server
			.open(personIds)
			.then((reply) => {
				const thread = { id: reply.id, with: personIds, unread: 0, created: clockNow(), messages: [] };
				threads.unshift(thread);
				window.Basalt.buttonState(ui.startButton, 'success');
				setTimeout(() => finishCompose(thread, text), 400);
			})
			.catch(() => {
				window.Basalt.buttonState(ui.startButton, 'error');
				notify({ tone: 'danger', title: 'Could not start the conversation', text: 'Try again in a moment.' });
			});
	}

	/** Once the dialog has closed, shows the thread in the inbox and sends any opening line. */
	function finishCompose(thread, text) {
		window.bootstrap.Modal.getOrCreateInstance(ui.composeDialog).hide();
		ui.composeDialog.addEventListener(
			'hidden.bs.modal',
			() => {
				if (thread.archived) thread.archived = false;
				page.searchText = '';
				ui.searchBox.value = '';
				switchFolder('all', true);
				openThread(thread.id, { focus: 'composer' });
				if (!text) return;
				ui.textarea.value = text;
				sendFromComposer();
			},
			{ once: true },
		);
	}

	/* Search and the Inbox, Unread and Archived folders. */

	function handleSearchKey(event) {
		const key = event.key;
		if (key === 'Escape') {
			if (!ui.searchBox.value) {
				ui.searchBox.blur();
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			resetSearch();
			return;
		}
		if (key !== 'ArrowDown' && key !== 'Enter') return;
		const firstRow = pick('.dm-conv', ui.threadList);
		if (!firstRow) return;
		event.preventDefault();
		if (key === 'Enter') openThread(firstRow.dataset.dmOpen, { focus: 'composer' });
		else firstRow.focus();
	}

	function resetSearch() {
		ui.searchBox.value = '';
		page.searchText = '';
		drawList();
		drawThread({ scroll: 'keep' });
		ui.searchBox.focus();
	}

	/**
	 * Changes folder through its radio when that radio is not already on,
	 * so the segmented control and the list stay in step.
	 */
	function switchFolder(folder, silent) {
		page.folder = folder;
		const radio = pick(`[data-dm-filter][value="${folder}"]`, host);
		if (radio && !radio.checked) {
			radio.checked = true;
			radio.dispatchEvent(new Event('change', { bubbles: true }));
			return;
		}
		drawList();
		if (!silent) say(ui.matchLine.textContent || countOf(page.visibleIds.length, 'conversation'));
	}

	/* The workspace menu and page-wide shortcuts. */

	function jumpToSearch() {
		if (isSinglePane()) showPane('list');
		ui.searchBox.focus();
		ui.searchBox.select();
	}

	function markAllRead() {
		const unreadThreads = threads.filter((thread) => thread.unread);
		if (!unreadThreads.length) {
			notify({
				tone: 'info',
				icon: 'bi-check2-all',
				title: 'Nothing unread',
				text: 'Every conversation is already read.',
				duration: 3000,
			});
			return;
		}
		const counts = unreadThreads.map((thread) => thread.unread);
		for (const thread of unreadThreads) thread.unread = 0;
		drawList();
		say(`Marked ${countOf(unreadThreads.length, 'conversation')} as read`);
		Promise.all(unreadThreads.map((thread) => server.read(thread.id))).catch(
			rollbackWith('mark everything as read', () => {
				for (const [index, thread] of unreadThreads.entries()) thread.unread = counts[index];
			}),
		);
	}

	function reflectTheme() {
		ui.darkToggle.setAttribute(
			'aria-pressed',
			String(window.Basalt.getTheme && window.Basalt.getTheme() === 'dark'),
		);
	}

	/* Single-key shortcuts. They stay quiet while typing, while a dialog or
     menu is open, and until the inbox has loaded. */
	function handleShortcut(event) {
		if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || isTypingTarget(event.target)) return;
		if (pick('.modal.show, .offcanvas.show:not(.dm-profile), .dropdown-menu.show')) return;
		if (page.isLoading || page.loadFailed) return;
		const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
		const anywhere = {
			'/': () => jumpToSearch(),
			c: () => startCompose(),
			j: () => stepThread(1),
			k: () => stepThread(-1),
			'?': () => window.bootstrap.Modal.getOrCreateInstance(ui.shortcutsDialog).show(),
		};
		if (Object.hasOwn(anywhere, key)) {
			event.preventDefault();
			anywhere[key]();
			return;
		}
		if (!page.openId) return;
		const onMessage = event.target.closest && event.target.closest('.dm-row[data-msg]');
		const thread = threadById(page.openId);
		const inThread = {
			r: onMessage ? null : () => replyToLatest(thread),
			e: onMessage ? null : () => archiveThread(thread.id, !thread.archived),
			u: () => markThread(page.openId, true),
			p: () => pinThread(thread.id, !thread.pinned),
			i: () => flipProfile(),
		};
		const action = Object.hasOwn(inThread, key) ? inThread[key] : null;
		if (!action) return;
		event.preventDefault();
		action();
	}

	/** R replies to the newest message from someone else, or your own if there is none. */
	function replyToLatest(thread) {
		const target = thread.messages.findLast((message) => !sentByMe(message)) || latestIn(thread);
		if (target) beginReply(target.id);
		else ui.textarea.focus();
	}

	/* Loading. The page keeps its own copies of the records, so optimistic
     edits never reach back into SAMPLE. */

	function fetchInbox() {
		page.isLoading = true;
		page.loadFailed = null;
		drawList();
		drawThread();
		drawProfile();
		server
			.fetchAll()
			.then(applyInbox)
			.catch(() => {
				page.isLoading = false;
				page.loadFailed = true;
				drawList();
				drawThread();
				say('Your conversations did not load.');
			});
	}

	function applyInbox(data) {
		adopt(data);
		page.isLoading = false;
		if (!pickerReady) fillTeamPicker();
		const fromHash = location.hash.slice(1);
		const start = threadById(fromHash) ? fromHash : defaultThreadId();
		if (start && threadById(start).archived) page.folder = 'archived';
		if (page.folder !== 'all') {
			const radio = pick(`[data-dm-filter][value="${page.folder}"]`, host);
			radio.checked = true;
			radio.dispatchEvent(new Event('change', { bubbles: true }));
		}
		if (start) {
			openThread(start, { keepHash: !fromHash });
		} else {
			drawList();
			drawThread();
		}
		if (isSinglePane()) showPane(start && fromHash ? 'thread' : 'list');
		scheduleArrival(data.incoming);
	}

	/** Wide screens open the top thread straight away; narrow ones show the list. */
	function defaultThreadId() {
		if (isSinglePane()) return null;
		const first = visibleThreads()[0];
		return first ? first.thread.id : null;
	}

	function adopt(data) {
		roster = new Map(data.people.map((person) => [person.id, { ...person }]));
		attachments = new Map(data.files.map((file) => [file.id, { ...file }]));
		threads = data.conversations.map((source) => ({
			unread: 0,
			pinned: false,
			muted: false,
			archived: false,
			...source,
			with: source.with.slice(),
			messages: source.messages.map((message) => cloneMessage(message, data.me)),
		}));
		cannedAnswers = structuredClone(data.replies || {});
		/* A draft that ships with the data is used only when this browser has
       never stored drafts of its own. */
		for (const source of data.conversations) {
			if (source.draft && !(source.id in savedDrafts) && memory.read(DRAFTS_KEY) == null)
				savedDrafts[source.id] = source.draft;
		}
	}

	/** Own messages without a status count as read a minute after sending. */
	function cloneMessage(message, me) {
		const own = message.by === me;
		return {
			...message,
			status: own ? message.status || 'read' : undefined,
			readAt: message.readAt || (own ? new Date(message.at.getTime() + 60000) : undefined),
			reactions: structuredClone(message.reactions || {}),
		};
	}

	function scheduleArrival(incoming) {
		clearTimeout(arrivalTimer);
		if (!incoming || !threadById(incoming.conversation)) return;
		arrivalTimer = setTimeout(() => {
			const thread = threadById(incoming.conversation);
			if (thread)
				acceptIncoming(thread, { id: makeId('m'), by: incoming.by, at: clockNow(), text: incoming.text });
		}, incoming.after);
	}

	function readSavedDrafts() {
		try {
			return JSON.parse(memory.read(DRAFTS_KEY) || '{}') || {};
		} catch {
			return {};
		}
	}

	function writeDrafts() {
		memory.write(DRAFTS_KEY, JSON.stringify(savedDrafts));
	}

	/* Lookups over the loaded records. */

	function who(id) {
		return roster.get(id) || { id, name: 'Someone', title: '', team: '', presence: 'offline', city: '', utc: 0 };
	}

	function threadById(id) {
		return threads.find((thread) => thread.id === id);
	}

	function membersOf(thread) {
		return thread.with.map((id) => who(id));
	}

	function threadTitle(thread) {
		if (thread.with.length === 1) return who(thread.with[0]).name;
		return thread.with.map((id) => givenName(who(id).name)).join(', ');
	}

	function latestIn(thread) {
		return thread.messages.at(-1);
	}

	function lastActivity(thread) {
		return latestIn(thread)?.at || thread.created || clockNow();
	}

	function sentByMe(message) {
		return message.by === SAMPLE.me;
	}

	function findMessage(thread, id) {
		return thread?.messages.find((message) => message.id === id);
	}

	/** A reply quotes the text, or the first file's name for a file-only message. */
	function quotedText(message) {
		if (message.text) return message.text;
		return message.files?.length ? (attachments.get(message.files[0]) || { name: 'A file' }).name : '';
	}

	function presenceLine(person) {
		if (person.presence === 'offline' && person.lastSeen) return `Last seen ${sinceLabel(person.lastSeen)}`;
		return PRESENCE_WORDS[person.presence] || 'Offline';
	}

	function shortPresence(person) {
		return PRESENCE_WORDS[person.presence].split(',')[0];
	}

	/** The other person's wall clock, with the day named when it differs from ours. */
	function theirClock(person) {
		const shiftHours = person.utc - who(SAMPLE.me).utc;
		const there = new Date(clockNow().getTime() + shiftHours * 3600000);
		const dayWord = { '-1': ' tomorrow', 1: ' yesterday' }[dayGap(there)] || '';
		return `${clockLabel(there)}${dayWord} in ${person.city}`;
	}

	/** Which thread the selection moves to once this one leaves the list. */
	function neighborOf(id) {
		const index = page.visibleIds.indexOf(id);
		return page.visibleIds[index + 1] || page.visibleIds[index - 1] || null;
	}

	function threadWith(personIds) {
		const key = personIds.slice().sort().join(',');
		return threads.find((thread) => thread.with.slice().sort().join(',') === key) || null;
	}

	function locateFile(fileId) {
		for (const thread of threads) {
			const message = thread.messages.find((item) => (item.files || []).includes(fileId));
			if (message) return { thread, message };
		}
		return null;
	}

	/* Small general helpers. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function pause(ms, value) {
		return new Promise((resolve) => {
			setTimeout(() => resolve(value), ms);
		});
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch]);
	}

	function say(text) {
		if (window.Basalt.announce) window.Basalt.announce(text);
	}

	function notify(options) {
		if (!window.Basalt.toasts) return null;
		return window.Basalt.toasts.push(options);
	}

	function countOf(count, one, many) {
		return `${count} ${count === 1 ? one : many || `${one}s`}`;
	}

	function prefersStill() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/* Below 992px the list and the open thread take turns on screen. */
	function isSinglePane() {
		return window.matchMedia('(max-width: 991.98px)').matches;
	}

	/* From 1200px the profile is a column rather than a side sheet. */
	function hasProfileColumn() {
		return window.matchMedia('(min-width: 1200px)').matches;
	}

	function showPane(name) {
		ui.board.setAttribute('data-view', name);
	}

	function clockNow() {
		return new Date(SAMPLE_CLOCK.getTime() + (Date.now() - bootedAt));
	}

	/** Places a sample time on a day relative to the clock: onDay(-1, '16:12') is yesterday at 4:12 pm. */
	function onDay(dayShift, time) {
		const [hours, minutes] = time.split(':').map(Number);
		return new Date(
			SAMPLE_CLOCK.getFullYear(),
			SAMPLE_CLOCK.getMonth(),
			SAMPLE_CLOCK.getDate() + dayShift,
			hours,
			minutes,
		);
	}

	function makeId(prefix) {
		return `${prefix}${Date.now().toString(36)}${(serial++).toString(36)}`;
	}

	function givenName(wholeName) {
		return String(wholeName).split(' ')[0];
	}

	function profileHref(person) {
		return `employee-user-details.html?id=${encodeURIComponent(person.userId)}`;
	}

	function isTypingTarget(node) {
		return node && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName));
	}

	/* Dates and sizes as the page writes them. */

	function midnightOf(date) {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
	}

	function dayGap(date) {
		return Math.round((midnightOf(clockNow()) - midnightOf(date)) / 86400000);
	}

	function clockLabel(date) {
		const hours = date.getHours();
		const minutes = String(date.getMinutes()).padStart(2, '0');
		return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'am' : 'pm'}`;
	}

	/** Divider text in the thread: Today, Yesterday, a weekday, then a full date. */
	function dayHeading(date) {
		const gap = dayGap(date);
		if (gap === 0) return 'Today';
		if (gap === 1) return 'Yesterday';
		const weekday = WEEKDAY_NAMES[date.getDay()];
		return gap < 7 ? weekday : `${weekday}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
	}

	/** The compact stamp at the end of a list row. */
	function listStamp(date) {
		const gap = dayGap(date);
		if (gap === 0) return clockLabel(date);
		if (gap === 1) return 'Yesterday';
		if (gap < 7) return WEEKDAY_NAMES[date.getDay()].slice(0, 3);
		return `${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
	}

	function sinceLabel(date) {
		const gap = dayGap(date);
		let day = `${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
		if (gap === 0) day = 'today';
		else if (gap === 1) day = 'yesterday';
		return `${day} at ${clockLabel(date)}`;
	}

	function byteLabel(bytes) {
		if (bytes < 1024) return `${bytes} B`;
		return bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
	}

	start();
})();
