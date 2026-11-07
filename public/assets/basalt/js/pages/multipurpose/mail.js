/**
 * The mail app on mail.html, mounted wherever [data-ml-root] sits.
 *
 * It runs one person's Fieldline mailbox: folders and labels, an inbox
 * listed whole, by priority or split into sections, conversations that
 * fold their middle, a reply box that docks under the open thread, a
 * composer with drafts and send-later, snooze, bulk moves you can undo,
 * and search that filters can narrow.
 *
 * Bringing your own mail: replace DEMO with what your backend sends, or
 * let api.load() fetch it, since no message lives in the markup. Then give
 * each api method a real request. The page updates itself first, calls
 * the api, and rolls the change back with an error toast if that fails.
 *
 * Add ?state=empty, ?state=error or ?state=offline to the address to see
 * an empty mailbox, a first load that fails until Try again, or every
 * save failing and being rolled back.
 *
 * basalt.js supplies the parts: Headers, toasts with undo, the side
 * sheet, dialogs, hold to confirm, segmented controls, tabs, styled
 * selects, suggestions, tag inputs, avatars and presence, menus, the mini
 * pager, loading buttons, copy, tooltips, skeletons, empty states and the
 * live region.
 */
(() => {
	'use strict';

	const appRoot = pick('[data-ml-root]');
	if (!appRoot) return;

	/* The demo's clock reads Friday, October 2, 2026, 10:40 when the page
     opens and runs on from there. A live mailbox would use new Date(). */
	const DEMO_NOW = new Date(2026, 9, 2, 10, 40);

	/* Everything the page draws comes from this one object. Times are in
     the owner's zone, written as 'YYYY-MM-DD HH:MM'. */
	const DEMO = {
		me: 'ja',

		/* The From menu offers these addresses. */
		sendAs: [
			{ email: 'john.armstrong@fieldline.app', name: 'John Armstrong' },
			{ email: 'success@fieldline.app', name: 'Fieldline Customer Success' },
			{ email: 'billing@fieldline.app', name: 'Fieldline Billing' },
		],

		/* kind is one of team, customer, partner, vendor, system or spam. */
		people: [
			{
				id: 'ja',
				name: 'John Armstrong',
				email: 'john.armstrong@fieldline.app',
				title: 'Chief Technology Officer',
				org: 'Fieldline',
				kind: 'team',
				presence: 'online',
			},
			{
				id: 'go',
				name: 'Courtney Nugent',
				email: 'courtney.nugent@fieldline.app',
				title: 'Customer success manager',
				org: 'Fieldline',
				kind: 'team',
				presence: 'online',
			},
			{
				id: 'da',
				name: 'Dave Aldridge',
				email: 'dave@fieldline.app',
				title: 'Head of customer success',
				org: 'Fieldline',
				kind: 'team',
				presence: 'away',
			},
			{
				id: 'lb',
				name: 'Lucy Barlow',
				email: 'lucy.barlow@fieldline.app',
				title: 'Account executive',
				org: 'Fieldline',
				kind: 'team',
				presence: 'busy',
			},
			{
				id: 'hk',
				name: 'Hope Dougherty',
				email: 'hope@fieldline.app',
				title: 'Finance lead',
				org: 'Fieldline',
				kind: 'team',
				presence: 'online',
			},
			{
				id: 'om',
				name: 'Gerald Mercer',
				email: 'gerald@fieldline.app',
				title: 'Product lead',
				org: 'Fieldline',
				kind: 'team',
				presence: 'offline',
			},
			{
				id: 'mo',
				name: 'Marcia Olsen',
				email: 'marcia@fieldline.app',
				title: 'Marketing lead',
				org: 'Fieldline',
				kind: 'team',
				presence: 'away',
			},
			{
				id: 'tr',
				name: 'Todd Roach',
				email: 'trent@fieldline.app',
				title: 'Revenue operations',
				org: 'Fieldline',
				kind: 'team',
				presence: 'offline',
			},
			{
				id: 'ic',
				name: 'Carly Caldwell',
				email: 'carly@fieldline.app',
				title: 'Support lead',
				org: 'Fieldline',
				kind: 'team',
				presence: 'online',
			},
			{
				id: 'sw',
				name: 'Rory Whitfield',
				email: 'rory.whitfield@fieldline.app',
				title: 'Engineering manager',
				org: 'Fieldline',
				kind: 'team',
				presence: 'busy',
			},
			{
				id: 'all',
				name: 'Everyone at Fieldline',
				email: 'everyone@fieldline.app',
				title: 'Mailing list',
				org: 'Fieldline',
				kind: 'team',
			},
			{
				id: 'sup',
				name: 'Fieldline Support',
				email: 'support@fieldline.app',
				title: 'Shared inbox',
				org: 'Fieldline',
				kind: 'team',
			},

			{
				id: 'cm',
				name: 'Carla Malone',
				email: 'carla.malone@northgateanalytics.com',
				title: 'Operations director',
				org: 'Northgate Analytics',
				kind: 'customer',
				account: 'ngcare',
			},
			{
				id: 'df',
				name: 'Dwayne Foster',
				email: 'dwayne@lakesideapparel.com',
				title: 'Office manager',
				org: 'Lakeside Apparel & Walks',
				kind: 'customer',
				account: 'lpd',
			},
			{
				id: 'pr',
				name: 'Connie Reese',
				email: 'connie.reese@oakhavenstudio.com',
				title: 'Scheduling lead',
				org: 'Oakhaven Studio',
				kind: 'customer',
				account: 'mer',
			},
			{
				id: 'jk',
				name: 'Jordan Kaye',
				email: 'jordan.kaye@brightline-photo.com',
				title: 'Chief operating officer',
				org: 'Brightline Photography',
				kind: 'customer',
				account: 'bel',
			},
			{
				id: 'ap',
				name: 'Ann Palmer',
				email: 'accounts@larchwoodgames.com',
				title: 'Accounts',
				org: 'Larchwood Games',
				kind: 'customer',
				account: 'pcp',
			},
			{
				id: 'ms',
				name: 'Elaine Sorensen',
				email: 'elaine@millraceceramics.com',
				title: 'Owner',
				org: 'Millrace Ceramics',
				kind: 'customer',
				account: 'rbc',
			},
			{
				id: 'ln',
				name: 'Lance Newman',
				email: 'lance@mooringsknitworks.com',
				title: 'General manager',
				org: 'Moorings Knitworks Co',
				kind: 'customer',
				account: 'hcc',
			},
			{
				id: 'vr',
				name: 'Valerie Rudd',
				email: 'vrudd@gulfcoastgroup.com',
				title: 'Operations director',
				org: 'Gulf Coast Group',
				kind: 'customer',
				account: 'gtm',
			},

			{
				id: 'ro',
				name: 'Jeffrey Bishop',
				email: 'jeffrey@fieldpay.io',
				title: 'Partnerships',
				org: 'FieldPay',
				kind: 'partner',
			},
			{
				id: 'qb',
				name: 'Quillbooks Marketplace',
				email: 'marketplace@quillbooks.com',
				title: 'App marketplace team',
				org: 'Quillbooks',
				kind: 'partner',
			},

			{
				id: 'bill',
				name: 'Fieldline Billing',
				email: 'billing-robot@fieldline.app',
				title: 'Automated sender',
				org: 'Fieldline',
				kind: 'system',
			},
			{
				id: 'stat',
				name: 'Fieldline Status',
				email: 'status@fieldline.app',
				title: 'Automated sender',
				org: 'Fieldline',
				kind: 'system',
			},
			{
				id: 'sec',
				name: 'Fieldline Security',
				email: 'security@fieldline.app',
				title: 'Automated sender',
				org: 'Fieldline',
				kind: 'system',
			},
			{
				id: 'lp',
				name: 'Ledgerly Payments',
				email: 'payouts@ledgerly.com',
				title: 'Card payments provider',
				org: 'Ledgerly',
				kind: 'vendor',
			},
			{
				id: 'fsw',
				name: 'Home Services Weekly',
				email: 'editor@homeservicesweekly.com',
				title: 'Newsletter',
				org: 'Home Services Weekly',
				kind: 'vendor',
			},
			{
				id: 'smd',
				name: 'SaaS Metrics Digest',
				email: 'digest@saasmetrics.news',
				title: 'Newsletter',
				org: 'SaaS Metrics Digest',
				kind: 'vendor',
			},
			{
				id: 'sc',
				name: 'SoftCompare Reviews',
				email: 'reviews@softcompare.com',
				title: 'Software review site',
				org: 'SoftCompare',
				kind: 'vendor',
			},
			{
				id: 'expo',
				name: 'Small Biz Expo',
				email: 'exhibitors@smallbizexpo.com',
				title: 'Trade show',
				org: 'Small Biz Expo',
				kind: 'vendor',
			},
			{ id: 'gc', name: 'Reward Desk', email: 'winner@gc-rewards.biz', title: '', org: '', kind: 'spam' },
			{ id: 'rr', name: 'RankRocket', email: 'grow@rankrocket.biz', title: '', org: '', kind: 'spam' },
		],

		/* The accounts behind the person sheet; mrr is dollars a month. */
		accounts: [
			{
				id: 'ngcare',
				name: 'Northgate Analytics',
				plan: 'Pro',
				seats: 48,
				mrr: 1536,
				region: 'Northeast',
				channel: 'Sales-led',
				renews: '2026-10-15',
				owner: 'go',
				health: 'good',
				addons: ['Customer Portal'],
			},
			{
				id: 'lpd',
				name: 'Lakeside Apparel & Walks',
				plan: 'Pro',
				seats: 18,
				mrr: 576,
				region: 'Midwest',
				channel: 'Self-serve',
				renews: '2027-02-01',
				owner: 'go',
				health: 'watch',
				addons: ['SMS credits'],
			},
			{
				id: 'mer',
				name: 'Oakhaven Studio',
				plan: 'Max',
				seats: 64,
				mrr: 3712,
				region: 'Northeast',
				channel: 'Sales-led',
				renews: '2027-04-30',
				owner: 'da',
				health: 'good',
				addons: ['Travel Planner', 'Customer Portal'],
			},
			{
				id: 'bel',
				name: 'Brightline Photography',
				plan: 'Pro',
				seats: 72,
				mrr: 2304,
				region: 'West',
				channel: 'Sales-led',
				renews: '2026-11-30',
				owner: 'lb',
				health: 'good',
				addons: ['SMS credits'],
			},
			{
				id: 'pcp',
				name: 'Larchwood Games',
				plan: 'Basic',
				seats: 9,
				mrr: 135,
				region: 'West',
				channel: 'Self-serve',
				renews: '2026-10-14',
				owner: null,
				health: 'good',
				addons: [],
			},
			{
				id: 'rbc',
				name: 'Millrace Ceramics',
				plan: 'Basic',
				seats: 12,
				mrr: 180,
				region: 'Midwest',
				channel: 'Self-serve',
				renews: '2027-03-08',
				owner: null,
				health: 'good',
				addons: ['SMS credits'],
			},
			{
				id: 'hcc',
				name: 'Moorings Knitworks Co',
				plan: 'Pro',
				seats: 22,
				mrr: 704,
				region: 'Midwest',
				channel: 'Self-serve',
				renews: '2026-10-06',
				owner: 'go',
				health: 'risk',
				addons: ['Customer Portal'],
			},
			{
				id: 'gtm',
				name: 'Gulf Coast Group',
				plan: 'Trial',
				seats: 40,
				mrr: 0,
				region: 'South',
				channel: 'Sales-led',
				renews: null,
				owner: 'lb',
				health: 'trial',
				addons: [],
			},
		],

		/* tone is one of the eight chart colors. */
		labels: [
			{ id: 'customers', name: 'Customers', tone: 1 },
			{ id: 'renewals', name: 'Renewals', tone: 2 },
			{ id: 'partners', name: 'Partners', tone: 3 },
			{ id: 'finance', name: 'Finance', tone: 4 },
			{ id: 'product', name: 'Product', tone: 5 },
			{ id: 'team', name: 'Team', tone: 6 },
		],

		/* Every conversation lives in one box: inbox, archive, sent (mail
       only you wrote), spam or trash. category is its Split inbox section,
       and each file on a message is { name, size in bytes }. */
		threads: [
			{
				id: 't-ngcare-annual',
				subject: 'Renewal: moving to annual on Pro',
				box: 'inbox',
				category: 'primary',
				labels: ['customers', 'renewals'],
				starred: false,
				important: true,
				messages: [
					{
						id: 'm101',
						from: 'go',
						to: ['cm'],
						cc: ['ja'],
						at: '2026-09-29 15:10',
						files: [{ name: 'Northgate-annual-quote.pdf', size: 188416 }],
						text: "Hi Carla,\n\nAs promised on Monday's call, here is the annual option for your renewal on October 15.\n\nYou're on Pro with 48 seats today, billed monthly at $1,536. On annual billing you pay for ten months instead of twelve, so the year comes to $15,360 rather than $18,432.\n\nThe quote is attached. If the seat count changes before the 15th, tell me and I'll redo it.\n\nBest,\nGrace",
					},
					{
						id: 'm102',
						from: 'cm',
						to: ['go'],
						cc: ['ja'],
						at: '2026-10-01 17:46',
						text: "Thanks Courtney. We're in for annual. Two things before I can get the PO signed:\n\n• We'd like Travel Planner for the 12 schedulers at the Eastfield branch. Can it go on the same invoice?\n• Finance wants the invoice split between our two companies: 30 seats on Northgate Analytics Inc. and 18 on Northgate Eastfield.\n\nIf both work, I can have the PO signed by Wednesday.\n\nCarla",
					},
					{
						id: 'm103',
						from: 'cm',
						to: ['ja'],
						cc: ['go'],
						at: '2026-10-02 09:52',
						unread: true,
						files: [{ name: 'Northgate-PO-draft.pdf', size: 98304 }],
						text: "John,\n\nOne more thing I forgot to put in my note to Courtney: the 15th falls on our payroll run. Could the annual term start on the 16th instead? A day's difference, but it saves our accounts team a headache.\n\nThe draft PO is attached so you can check the wording.\n\nThanks,\nCarla",
					},
				],
			},
			{
				id: 't-lpd-sms',
				subject: 'SMS reminders stopped going out on Tuesday',
				box: 'inbox',
				category: 'primary',
				labels: ['customers'],
				starred: false,
				important: true,
				messages: [
					{
						id: 'm201',
						from: 'df',
						to: ['sup'],
						cc: ['ja'],
						at: '2026-10-02 08:31',
						files: [{ name: 'reminder-log.png', size: 421888 }],
						text: 'Hello,\n\nSince Tuesday none of our appointment reminders have gone out by text. Customers are calling to ask if the walker is still coming, and we had two visits yesterday where nobody was home.\n\nNothing changed on our side. A screenshot of the reminder log is attached: every row from Tuesday says "Not sent".\n\nCan someone look at this today? Thursday and Friday are our busiest days.\n\nDwayne Foster\nOffice manager, Lakeside Apparel & Walks',
					},
					{
						id: 'm202',
						from: 'ic',
						to: ['df'],
						cc: ['ja'],
						at: '2026-10-02 09:14',
						text: "Hi Dwayne,\n\nFound it. Your SMS credits ran out on Tuesday morning and auto top-up was off, so the reminders queued instead of sending. That one is on us: the low-credit warning went to an address that no longer works.\n\nI've added 2,000 credits to the account at no charge, and the 46 queued reminders for today and Monday went out at 9:10 am. I'd suggest turning auto top-up on in Settings > Billing so this can't happen again.\n\nSorry about yesterday.\n\nInes",
					},
					{
						id: 'm203',
						from: 'df',
						to: ['ic'],
						cc: ['ja'],
						at: '2026-10-02 10:21',
						unread: true,
						text: "That's fixed it, reminders are going out again. Thank you Carly.\n\nCould someone change the billing contact to me so we get the warnings next time? It still lists Karen, who left in June.\n\nDwayne",
					},
				],
			},
			{
				id: 't-release',
				subject: '4.18.2 is out: sync fix and faster visit search',
				box: 'inbox',
				category: 'primary',
				labels: ['product'],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm301',
						from: 'sw',
						to: ['all'],
						at: '2026-10-02 08:05',
						unread: true,
						text: "Morning all,\n\n4.18.2 went out at 7:40 am to every region. What changed:\n\n• Sync tasks recover on their own after a database failover, which caused Thursday's Oakhaven Studio issue\n• Visit search on the schedule board is about three times faster on large accounts\n• Fixed: customer signatures were saved upside down on some Android phones\n\nNothing for customers to do.\n\nSam",
					},
				],
			},
			{
				id: 't-renewals-digest',
				subject: 'Renewals in the next 14 days: 4 accounts',
				box: 'inbox',
				category: 'updates',
				labels: ['renewals'],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm401',
						from: 'bill',
						to: ['ja'],
						at: '2026-10-02 07:00',
						unread: true,
						text: 'Good morning John,\n\nThese accounts renew in the next 14 days:\n\n• Moorings Knitworks Co, Pro, 22 seats, Tue, Oct 6, owner Courtney Nugent. Health: at risk\n• Larchwood Games, Basic, 9 seats, Wed, Oct 14, no owner\n• Northgate Analytics, Pro, 48 seats, Thu, Oct 15, owner Courtney Nugent\n• Highpoint Studios, Max, 64 seats, Fri, Oct 16, owner Dave Aldridge\n\nThe renewals report has the full list and the value of each.\n\nFieldline Billing',
					},
				],
			},
			{
				id: 't-payout',
				subject: 'Your payout of $212,480.16 is on its way',
				box: 'inbox',
				category: 'updates',
				labels: ['finance'],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm501',
						from: 'lp',
						to: ['ja'],
						at: '2026-10-02 06:12',
						unread: true,
						text: 'A payout of $212,480.16 will reach the bank account ending 4471 on Monday, October 5.\n\nIt covers card payments captured from September 25 to October 1, less $6,371.40 in fees.\n\nLedgerly Payments',
					},
				],
			},
			{
				id: 't-oakhaven-sync',
				subject: "Caregivers can't see tomorrow's visits in the app",
				box: 'inbox',
				category: 'primary',
				labels: ['customers'],
				starred: true,
				important: true,
				messages: [
					{
						id: 'm601',
						from: 'pr',
						to: ['ja'],
						at: '2026-10-01 16:05',
						text: "John,\n\nSince about 3:00 pm none of our caregivers can see Friday's visits in the mobile app. The schedule board shows them fine. We have 31 people out tomorrow and they need their rounds tonight.\n\nPriya Reese\nScheduling lead, Oakhaven Studio",
					},
					{
						id: 'm602',
						from: 'ja',
						to: ['pr'],
						cc: ['sw'],
						at: '2026-10-01 16:22',
						text: "Connie, thanks for the quick heads-up. Rory's team is on it now, and I'll write again within the hour whatever we find.\n\nJohn",
					},
					{
						id: 'm603',
						from: 'sw',
						to: ['pr'],
						cc: ['ja'],
						at: '2026-10-01 17:30',
						text: "Hi Connie,\n\nA sync task for accounts in the Midwest region stopped at 2:52 pm after a database failover. It's running again and the backlog cleared at 5:24 pm.\n\nCaregivers need to pull down once to refresh; after that tomorrow's visits are there. The fix for the cause ships in 4.18.2 tonight.\n\nSam Whitfield\nEngineering, Fieldline",
					},
					{
						id: 'm604',
						from: 'pr',
						to: ['sw'],
						cc: ['ja'],
						at: '2026-10-01 17:58',
						text: 'Confirmed, all 31 can see their rounds. Thanks both, that was quick.\n\nPriya',
					},
				],
			},
			{
				id: 't-brightline',
				subject: 'Brightline Photography: Max quote needs your sign-off',
				box: 'inbox',
				category: 'primary',
				labels: ['customers'],
				starred: false,
				important: true,
				messages: [
					{
						id: 'm701',
						from: 'lb',
						to: ['ja'],
						at: '2026-10-01 14:20',
						files: [{ name: 'Brightline-Max-quote-v3.pdf', size: 225280 }],
						text: "John,\n\nBrightline want to move from Pro (72 seats) to Max with 120 seats from December 1, when they take on the Westbrook contract.\n\nList price is 120 × $58 = $6,960 a month, or $69,600 a year on annual. Jordan has asked for 8% off on a two-year term. That's within my limit for one year, not for two, so it needs you.\n\nQuote v3 is attached. They'd like an answer by Tuesday.\n\nLucy",
					},
				],
			},
			{
				id: 't-sept-close',
				subject: 'September close: $880k MRR',
				box: 'inbox',
				category: 'primary',
				labels: ['finance'],
				starred: true,
				important: false,
				messages: [
					{
						id: 'm801',
						from: 'hk',
						to: ['ja'],
						at: '2026-10-01 09:40',
						files: [{ name: 'Sept-2026-close-pack.xlsx', size: 1258291 }],
						text: 'John,\n\nSeptember is closed. The headlines:\n\n• MRR $880k, up from $861k in August\n• 2,140 paying accounts\n• Net revenue retention 112%\n• 48,200 monthly active users\n\nThe pack is attached with the regional split. One thing to look at: Basic churn in the South was higher than usual, mostly small cleaning companies in their first three months.\n\nHana',
					},
					{
						id: 'm802',
						from: 'ja',
						to: ['hk'],
						at: '2026-10-01 10:05',
						text: 'Thanks Hope. Could you add Basic churn by signup month to the pack before it goes to the board?\n\nJohn',
					},
					{
						id: 'm803',
						from: 'hk',
						to: ['ja'],
						at: '2026-10-01 10:31',
						text: "Will do, you'll have it by Monday lunchtime.\n\nHana",
					},
				],
			},
			{
				id: 't-roadmap',
				subject: 'Q4 roadmap review moves to Tuesday, Oct 6',
				box: 'inbox',
				category: 'primary',
				labels: ['product', 'team'],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm901',
						from: 'om',
						to: ['ja', 'sw', 'lb', 'da', 'hk'],
						at: '2026-10-01 11:02',
						files: [{ name: 'Q4-roadmap-draft.pdf', size: 1048576 }],
						text: 'Hi all,\n\nThe Q4 roadmap review moves from Monday to Tuesday, October 6, 2:00 to 3:30 pm, so Rory can join after the release.\n\nThe draft is attached. The three bets I want us to agree on:\n\n• Travel Planner for bookings that run over several days\n• Customer Portal payments, with FieldPay\n• Offline mode for staff in low-signal areas\n\nPlease add comments to the draft before Monday evening.\n\nOwen',
					},
				],
			},
			{
				id: 't-fsw-41',
				subject: "The schedule board isn't going anywhere",
				box: 'inbox',
				category: 'newsletters',
				labels: [],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm1001',
						from: 'fsw',
						to: ['ja'],
						at: '2026-10-01 07:15',
						unread: true,
						text: "Home Services Weekly, issue 141\n\nEvery few years someone says the schedule board is finished and planning software will plan the whole day on its own. We asked 60 schedulers at cleaning and home care companies what they actually do at 7:30 am. Most still move a third of the day's visits by hand before the first car leaves.\n\nAlso this week: what the new EU rules on care worker hours mean for scheduling, and three ways to cut no-access visits.\n\nRead the full issue on our website.",
					},
				],
			},
			{
				id: 't-status',
				subject: 'Resolved: delayed push notifications on Android',
				box: 'inbox',
				category: 'updates',
				labels: [],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm1101',
						from: 'stat',
						to: ['ja'],
						at: '2026-10-01 22:10',
						text: 'Resolved at 10:04 pm.\n\nFrom 8:41 to 10:04 pm, push notifications to the Android staff app arrived up to 25 minutes late. Visits, schedules and messages were not affected and nothing was lost.\n\nThe cause was a certificate change at our notification provider. A full report follows within two working days.\n\nFieldline Status',
					},
				],
			},
			{
				id: 't-moorings-seats',
				subject: 'Seats for next year',
				box: 'inbox',
				category: 'primary',
				labels: ['customers', 'renewals'],
				starred: false,
				important: true,
				messages: [
					{
						id: 'm1201',
						from: 'ln',
						to: ['ja'],
						cc: ['go'],
						at: '2026-09-30 13:12',
						text: "Hi John,\n\nAhead of our renewal on the 6th: we lost the council contract in July, so we're down to 11 cleaners. Can we drop to 14 seats and keep Pro? I'd rather keep the Customer Portal than move to Basic.\n\nLuis Newman\nGeneral manager, Moorings Knitworks Co",
					},
				],
			},
			{
				id: 't-dele-watch',
				subject: 'Two accounts to watch before renewal',
				box: 'inbox',
				category: 'primary',
				labels: ['customers', 'renewals'],
				starred: false,
				important: true,
				messages: [
					{
						id: 'm1301',
						from: 'da',
						to: ['ja'],
						at: '2026-09-30 10:20',
						text: "John,\n\nTwo renewals I'm worried about:\n\nHarbor Cleaning Co (Pro, 22 seats, renews Oct 6). Active cleaners fell from 19 to 11 over the summer. Lance says they lost a contract rather than being unhappy, but they will probably drop seats.\n\nCoastline Property Care (Pro, 30 seats, renews Oct 28). Five tickets about travel times in September. Travel Planner would fix most of it, and I'd like to offer them a three-month trial.\n\nCan we talk about the trial on Monday?\n\nDele",
					},
				],
			},
			{
				id: 't-fieldpay',
				subject: 'Joint webinar in November?',
				box: 'inbox',
				category: 'primary',
				labels: ['partners'],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm1401',
						from: 'ro',
						to: ['ja'],
						cc: ['mo'],
						at: '2026-09-30 11:15',
						text: "Hi John,\n\nSince the FieldPay integration went live in August, 214 Fieldline accounts have connected it, and they're collecting invoices four days faster on average.\n\nWe'd like to run a joint webinar in November for cleaning and pet care owners: \"Get paid on the day of the visit\". We'd bring a customer story and you'd bring one too. Marcia, copied, ran the last one with us.\n\nAre you open to it? Two dates work for us: 12 or November 19.\n\nRafael Bishop\nPartnerships, FieldPay",
					},
					{
						id: 'm1402',
						from: 'mo',
						to: ['ro'],
						cc: ['ja'],
						at: '2026-09-30 14:02',
						text: "Jeffrey, count us in. The 19th suits us better, as the 12th clashes with our Pro plan launch email. I can ask Lakeside Apparel to be our story; they've used FieldPay since week one.\n\nJohn, shout if you'd rather not.\n\nMargit",
					},
				],
			},
			{
				id: 't-webinar',
				subject: 'Webinar recap: 412 sign-ups, 38 trials',
				box: 'inbox',
				category: 'primary',
				labels: ['team'],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm1501',
						from: 'mo',
						to: ['ja'],
						at: '2026-09-30 16:40',
						text: 'Hi John,\n\nTuesday\'s webinar, "Five scheduling habits that save an hour a day", in numbers:\n\n• 412 sign-ups, 187 watched live\n• 38 new trials in the 48 hours after\n• Most asked question: can staff reorder their own visits? Not yet; Gerald has it on the list\n\nThe recording is on the website. The next one is with FieldPay in November.\n\nMargit',
					},
				],
			},
			{
				id: 't-smd',
				subject: 'NRR benchmarks for vertical SaaS, Q3',
				box: 'inbox',
				category: 'newsletters',
				labels: [],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm1601',
						from: 'smd',
						to: ['ja'],
						at: '2026-09-30 08:00',
						text: 'This quarter we looked at 140 vertical software companies with $5M to $50M in annual revenue.\n\nMedian net revenue retention was 104%. The top quarter sat above 115%, and nearly all of them sell add-ons per seat rather than as flat fees.\n\nAlso inside: why annual billing discounts above two months rarely pay for themselves.',
					},
				],
			},
			{
				id: 't-larchwood',
				subject: 'Invoice #20931 charged twice',
				box: 'inbox',
				category: 'primary',
				labels: ['customers', 'finance'],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm1701',
						from: 'ap',
						to: ['ja'],
						at: '2026-09-29 08:45',
						files: [{ name: 'card-statement-sep.pdf', size: 145408 }],
						text: 'Hi,\n\nOur card was charged $135.00 twice on September 28 for invoice #20931. The statement is attached. Please refund the second charge.\n\nAna Palmer\nAccounts, Larchwood Games',
					},
					{
						id: 'm1702',
						from: 'ja',
						to: ['ap'],
						cc: ['hk'],
						at: '2026-09-29 09:30',
						text: 'Hi Ann, sorry about this. Hope from our finance team is copied and will sort the refund today.\n\nJohn',
					},
					{
						id: 'm1703',
						from: 'hk',
						to: ['ap'],
						cc: ['ja'],
						at: '2026-09-29 11:02',
						text: "Hi Ann,\n\nThe second charge of $135.00 is refunded and should show on your statement in 5 to 10 working days. The reference is #30412.\n\nThe cause was a retry on our side after a timeout, and it's fixed.\n\nHana",
					},
				],
			},
			{
				id: 't-board-pack',
				subject: 'Board pack: please check the regional split',
				box: 'inbox',
				category: 'primary',
				labels: ['finance'],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm1801',
						from: 'tr',
						to: ['ja'],
						at: '2026-09-28 15:30',
						text: "John,\n\nThe Q3 board pack is ready for you to read. Can you check slide 6? The Midwest looks low at 21% of MRR, but that's because two Max accounts moved their billing address to Texas in August. I've added a footnote; tell me if you'd rather restate the numbers.\n\nTomás",
					},
				],
			},
			{
				id: 't-millrace',
				subject: 'Thank you from Millrace Ceramics',
				box: 'inbox',
				category: 'primary',
				labels: ['customers'],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm1901',
						from: 'ms',
						to: ['ja'],
						at: '2026-09-28 03:20',
						files: [{ name: 'millrace-team.jpg', size: 2516582 }],
						text: "Hi John,\n\nIt's been six months since we moved our 12 cleaners onto Fieldline, and I wanted to say thanks. We used to lose most of Monday morning building the week's roster. Now it takes Elsie about forty minutes.\n\nA photo of the team is attached. They insisted.\n\nMaya Sorensen\nOwner, Millrace Ceramics, Cheyenne",
					},
				],
			},
			{
				id: 't-signin',
				subject: 'New sign-in to your Fieldline admin account',
				box: 'inbox',
				category: 'updates',
				labels: [],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm2001',
						from: 'sec',
						to: ['ja'],
						at: '2026-09-28 07:58',
						text: "We noticed a new sign-in to john.armstrong@fieldline.app.\n\nWhen: Monday, September 28, 7:56 am\nDevice: Chrome on macOS\nWhere: Boulder, United States\n\nIf this was you, there's nothing to do. If not, reset your password and turn on two-step sign-in now.\n\nFieldline Security",
					},
				],
			},
			{
				id: 't-review',
				subject: 'You have a new 5-star review',
				box: 'inbox',
				category: 'updates',
				labels: [],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm2101',
						from: 'sc',
						to: ['ja'],
						at: '2026-09-27 18:00',
						text: '"Our schedulers stopped using the whiteboard in week two."\n\nReviewer: office manager at a pet care company with 11 to 50 employees.\n\nYou can reply to the review from your vendor dashboard.\n\nSoftCompare Reviews',
					},
				],
			},
			{
				id: 't-gulf',
				subject: 'Demo in Spanish for Gulf Coast Group?',
				box: 'inbox',
				category: 'primary',
				labels: ['customers'],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm2201',
						from: 'lb',
						to: ['ja'],
						at: '2026-09-25 12:10',
						text: "John,\n\nGulf Coast Group (Knoxville, 40 caregivers, home care) want a demo in Spanish next week. Their trial started Monday and they've already built 300 visits. Valerie, their operations director, asked whether the staff app is in Spanish. It is, but the Customer Portal isn't yet.\n\nCould Todd run the demo? He's the only one of us who's fluent.\n\nLucy",
					},
					{
						id: 'm2202',
						from: 'ja',
						to: ['tr'],
						cc: ['lb'],
						at: '2026-09-25 15:40',
						text: 'Todd, could you take this one? Lucy has the details.\n\nJohn',
					},
					{
						id: 'm2203',
						from: 'tr',
						to: ['ja'],
						cc: ['lb'],
						at: '2026-09-25 16:12',
						text: "Happy to. Wednesday, October 7 at 10:00 am Knoxville time works for me, and I'll send Valerie the invite.\n\nTomás",
					},
				],
			},

			/* These two are snoozed and come back to the inbox at snoozeUntil. */
			{
				id: 't-quillbooks',
				subject: 'Your Quillbooks app listing is due for review',
				box: 'inbox',
				category: 'primary',
				labels: ['partners'],
				starred: false,
				important: false,
				snoozeUntil: '2026-10-05 09:00',
				messages: [
					{
						id: 'm2301',
						from: 'qb',
						to: ['ja'],
						at: '2026-09-29 09:00',
						text: "Hello Fieldline team,\n\nEvery listing on the Quillbooks App Marketplace is reviewed once a year, and yours is due by October 15.\n\nPlease check that the listing's screenshots, pricing and support contact are up to date, and accept the partner terms again in your partner dashboard.\n\nQuillbooks Marketplace team",
					},
				],
			},
			{
				id: 't-expo',
				subject: 'Booth invoice #7731: Small Biz Expo 2027',
				box: 'inbox',
				category: 'updates',
				labels: ['finance'],
				starred: false,
				important: false,
				snoozeUntil: '2026-10-06 09:00',
				messages: [
					{
						id: 'm2401',
						from: 'expo',
						to: ['ja'],
						at: '2026-09-24 10:30',
						files: [{ name: '#7731.pdf', size: 77824 }],
						text: 'Thank you for booking booth B14 at Small Biz Expo 2027 in Plano, March 9 to 11.\n\nThe deposit of $4,200 is due by October 9. Invoice #7731 is attached.\n\nSmall Biz Expo exhibitor team',
					},
				],
			},

			/* Already archived. */
			{
				id: 't-portal-beta',
				subject: 'Customer Portal beta: the first 20 accounts',
				box: 'archive',
				category: 'primary',
				labels: ['product'],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm2501',
						from: 'om',
						to: ['ja', 'da'],
						at: '2026-09-10 10:00',
						text: 'The first 20 accounts are on the Customer Portal beta. Twelve of them have already sent a booking link to their own customers. Most asked for: letting customers pay a deposit when they book.\n\nOwen',
					},
				],
			},
			{
				id: 't-payout-prev',
				subject: 'Your payout of $198,904.55 is on its way',
				box: 'archive',
				category: 'updates',
				labels: ['finance'],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm2601',
						from: 'lp',
						to: ['ja'],
						at: '2026-09-25 06:10',
						text: 'A payout of $198,904.55 will reach the bank account ending 4471 on Monday, September 28.\n\nLedgerly Payments',
					},
				],
			},
			{
				id: 't-churn-notes',
				subject: 'August churn review notes',
				box: 'archive',
				category: 'primary',
				labels: ['customers'],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm2701',
						from: 'da',
						to: ['ja'],
						at: '2026-09-03 17:20',
						text: 'Notes from the August churn review: 31 accounts left, 24 of them on Basic. The top reason was "too small to need it" (11), then price (7) and moving to a bigger system (5).\n\nDele',
					},
				],
			},

			/* Written by you and never received, so it only shows in Sent. */
			{
				id: 't-sent-rory',
				subject: 'Incident report for Oakhaven Studio',
				box: 'sent',
				category: 'primary',
				labels: ['customers'],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm2801',
						from: 'ja',
						to: ['sw'],
						at: '2026-10-02 08:20',
						text: "Rory, could you write up Thursday's sync issue for Connie at Oakhaven Studio by Tuesday? Plain words, what happened, and what stops it happening again.\n\nThanks,\nJohn",
					},
				],
			},

			/* Caught by the spam filter. */
			{
				id: 't-spam-gift',
				subject: 'Claim your $500 gift card today',
				box: 'spam',
				category: 'primary',
				labels: [],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm2901',
						from: 'gc',
						to: ['ja'],
						at: '2026-10-01 23:12',
						unread: true,
						text: 'Congratulations! You were chosen to receive a $500 gift card. Confirm your details within 24 hours to claim it.',
					},
				],
			},
			{
				id: 't-spam-seo',
				subject: 'Rank first on search in 7 days',
				box: 'spam',
				category: 'primary',
				labels: [],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm3001',
						from: 'rr',
						to: ['ja'],
						at: '2026-09-30 05:40',
						text: "We looked at fieldline.app and found 38 problems holding your site back. Reply YES and we'll fix them all this week.",
					},
				],
			},

			/* Deleted and waiting out its 30 days. */
			{
				id: 't-fsw-40',
				subject: 'Five ways to cut no-access visits',
				box: 'trash',
				category: 'newsletters',
				labels: [],
				starred: false,
				important: false,
				messages: [
					{
						id: 'm3101',
						from: 'fsw',
						to: ['ja'],
						at: '2026-09-24 07:15',
						text: 'Home Services Weekly, issue 140\n\nConfirmation texts the day before, a photo of the team member, and a 30-minute arrival window: the three habits that cut no-access visits the most.',
					},
				],
			},
		],

		/* Unsent drafts reopen in the composer; replyTo ties one to its conversation. */
		drafts: [
			{
				id: 'd1',
				replyTo: 't-moorings-seats',
				to: ['lance@mooringsknitworks.com'],
				cc: ['courtney.nugent@fieldline.app'],
				bcc: [],
				subject: 'Re: Seats for next year',
				updated: '2026-10-01 18:20',
				html: '<p>Hi Lance,</p><p>Yes, you can drop to 14 seats and stay on Pro. That brings the monthly bill to $448, and you keep the Customer Portal. On annual billing at renewal it would be $4,480 for the year.</p>',
			},
			{
				id: 'd2',
				replyTo: null,
				to: ['gerald@fieldline.app'],
				cc: [],
				bcc: [],
				subject: 'Agenda for the roadmap review',
				updated: '2026-09-30 17:05',
				html: "<p>Gerald, three things I'd like on Tuesday's agenda:</p><ul><li>Offline mode: what's the smallest version we can ship</li><li></li></ul>",
			},
		],

		/* Waiting for their send time. */
		scheduled: [
			{
				id: 's1',
				replyTo: null,
				to: ['connie.reese@oakhavenstudio.com'],
				cc: [],
				bcc: [],
				subject: 'Your September summary',
				sendAt: '2026-10-05 08:30',
				from: 'john.armstrong@fieldline.app',
				html: "<p>Hi Connie,</p><p>Your September in Fieldline: 31 caregivers completed 2,418 visits, 94% of them on time. Travel Planner saved an average of 22 minutes per caregiver per day.</p><p>After Thursday's sync issue I've asked Rory for a written report, which you'll have by Tuesday.</p><p>John</p>",
			},
		],

		/* Canned replies; {first} turns into the first recipient's first name. */
		templates: [
			{
				id: 'onit',
				name: "Thanks, we're on it",
				html: "<p>Hi {first},</p><p>Thanks for letting us know. I've passed this to the right team and you'll hear back from us today.</p><p>John</p>",
			},
			{
				id: 'annual',
				name: 'Annual billing offer',
				html: '<p>Hi {first},</p><p>If you move to annual billing at renewal, you pay for ten months instead of twelve, with the same seats and add-ons. I can send a quote with the exact figure today.</p><p>John</p>',
			},
			{
				id: 'checkin',
				name: 'Book a check-in call',
				html: '<p>Hi {first},</p><p>Could we find 30 minutes next week to go over how the team is using Fieldline? Any slot that suits you is fine; just reply with a time.</p><p>John</p>',
			},
			{
				id: 'topup',
				name: 'Turn on SMS auto top-up',
				html: "<p>Hi {first},</p><p>To keep reminders going out, turn on auto top-up in Settings &gt; Billing &gt; SMS credits. We'll add 1,000 credits whenever you drop below 200.</p><p>John</p>",
			},
		],

		/* Mail that turns up while the page is open, handed out by api.poll(). */
		incoming: [
			{
				thread: 't-moorings-seats',
				message: {
					id: 'm1202',
					from: 'ln',
					to: ['ja'],
					cc: ['go'],
					text: "Hi John,\n\nJust checking you saw this before Tuesday? If 14 seats works, I'll update our purchase order today.\n\nLuis",
				},
			},
		],
	};

	/* The URL can ask for another demo state; a real server makes this go. */
	const DEMO_STATE = new URLSearchParams(location.search).get('state') || '';

	/* The folders on the rail, top to bottom. */
	const RAIL_FOLDERS = [
		{ id: 'inbox', name: 'Inbox', icon: 'bi-inbox' },
		{ id: 'starred', name: 'Starred', icon: 'bi-star' },
		{ id: 'snoozed', name: 'Snoozed', icon: 'bi-alarm' },
		{ id: 'sent', name: 'Sent', icon: 'bi-send' },
		{ id: 'scheduled', name: 'Scheduled', icon: 'bi-clock-history' },
		{ id: 'drafts', name: 'Drafts', icon: 'bi-file-earmark-text' },
		{ id: 'archive', name: 'Archive', icon: 'bi-archive' },
		{ id: 'spam', name: 'Spam', icon: 'bi-exclamation-octagon' },
		{ id: 'trash', name: 'Trash', icon: 'bi-trash3' },
	];

	/* A folder name answers one question about a conversation. */
	const FOLDER_RULES = {
		inbox: (convo) => convo.box === 'inbox' && !isSnoozed(convo),
		starred: (convo) => convo.starred && outsideBins(convo),
		snoozed: (convo) => isSnoozed(convo) && outsideBins(convo),
		sent: (convo) => includesMine(convo) && outsideBins(convo),
		archive: (convo) => convo.box === 'archive',
		spam: (convo) => convo.box === 'spam',
		trash: (convo) => convo.box === 'trash',
	};

	/* Drafts and scheduled mail are rows of their own kind; every other folder lists conversations. */
	const ROW_KIND_BY_FOLDER = { drafts: 'draft', scheduled: 'scheduled' };

	const ROWS_PER_PAGE = 15;

	/* How long a sent message waits, so Undo can still take it back. */
	const UNDO_WINDOW = 5000;

	const MOVE_COPY = {
		archive: ['Archived', 'archive'],
		inbox: ['Moved to the inbox', 'move it to the inbox'],
		spam: ['Reported as spam', 'report spam'],
		trash: ['Moved to the trash', 'move it to the trash'],
	};

	/* The only tags a written message keeps; the rest are unwrapped or dropped. */
	const KEPT_TAGS = {
		P: 1,
		DIV: 1,
		BR: 1,
		B: 1,
		STRONG: 1,
		I: 1,
		EM: 1,
		U: 1,
		UL: 1,
		OL: 1,
		LI: 1,
		A: 1,
		BLOCKQUOTE: 1,
		SPAN: 1,
	};

	const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/* The demo clock starts counting from here. */
	const openedAt = Date.now();

	/* One pane on tablets and phones: the list, or the conversation sliding
     over it. The query matches the breakpoint in mail.css. */
	const narrowQuery = window.matchMedia('(max-width: 991.98px)');

	/* The page's only door to a server. Each method returns a Promise, and
     the demo settles it from memory after a short pause. Put a fetch() in
     each body and resolve with the same shapes. */
	let loadTries = 0;
	let nextIncoming = 0;
	const api = {
		/* GET /api/mail, answered with { me, sendAs, people, accounts, labels, threads, drafts, scheduled, templates } */
		load() {
			loadTries += 1;
			return pause(500).then(() => {
				if (DEMO_STATE === 'error' && loadTries === 1) throw new Error('The server did not answer');
				const mailboxCopy = copyDeep(DEMO);
				delete mailboxCopy.incoming;
				if (DEMO_STATE === 'empty') {
					mailboxCopy.threads = [];
					mailboxCopy.drafts = [];
					mailboxCopy.scheduled = [];
				}
				return mailboxCopy;
			});
		},
		/* GET /api/mail/changes?since=<time>, answered with the [{ thread, message }] that came in since */
		poll() {
			return pause(700).then(() => {
				if (DEMO_STATE) return [];
				const queuedArrival = DEMO.incoming[nextIncoming];
				if (!queuedArrival) return [];
				nextIncoming += 1;
				return [copyDeep(queuedArrival)];
			});
		},
		/* PATCH /api/threads { ids, read }: every message in them changes */
		markRead(idList, asRead) {
			return fakeWrite({ ids: idList, read: asRead });
		},
		/* PATCH /api/threads/:id { starred } */
		star(rowId, isStarred) {
			return fakeWrite({ id: rowId, starred: isStarred });
		},
		/* PATCH /api/threads/:id { important } */
		setImportant(rowId, isImportant) {
			return fakeWrite({ id: rowId, important: isImportant });
		},
		/* POST /api/threads/move { ids, box }, where box is inbox, archive, spam or trash */
		move(idList, place) {
			return fakeWrite({ ids: idList, box: place });
		},
		/* POST /api/threads/snooze { ids, until }; a null until wakes them now */
		snooze(idList, wakeAt) {
			return fakeWrite({ ids: idList, until: wakeAt });
		},
		/* PATCH /api/threads/labels { ids, add, remove } */
		setLabels(idList, adding, removing) {
			return fakeWrite({ ids: idList, add: adding, remove: removing });
		},
		/* POST /api/labels { name, tone }, answered with the stored label */
		createLabel(newLabel) {
			return fakeWrite(copyDeep(newLabel));
		},
		/* DELETE /api/threads { ids }: gone for good, from the trash or spam */
		destroy(idList) {
			return fakeWrite(idList.slice());
		},
		/* POST /api/messages { from, to, cc, bcc, subject, html, files, replyTo }, answered with the sent message */
		send(payload) {
			return fakeWrite(copyDeep(payload));
		},
		/* PUT /api/drafts/:id with the draft, answered with what was stored */
		saveDraft(record) {
			return fakeWrite(copyDeep(record));
		},
		/* DELETE /api/drafts/:id */
		deleteDraft(rowId) {
			return fakeWrite(rowId);
		},
		/* POST /api/scheduled with the message and { sendAt }, answered with the scheduled copy */
		schedule(payload) {
			return fakeWrite(copyDeep(payload));
		},
		/* DELETE /api/scheduled/:id, which turns it back into a draft */
		cancelScheduled(rowId) {
			return fakeWrite(rowId);
		},
		/* GET /api/attachments/:message/:name returns the file */
		download(messageKey, attachment) {
			return fakeWrite({ messageId: messageKey, name: attachment.name });
		},
	};

	/* What the page is showing right now. */
	const mailbox = {
		loading: true,
		error: false,
		me: '',
		sendAs: [],
		people: [],
		accounts: [],
		labels: [],
		threads: [],
		drafts: [],
		scheduled: [],
		templates: [],
		/* inbox, starred, snoozed, sent, scheduled, drafts, archive, spam, trash or label:<id> */
		folder: 'inbox',
		/* How the inbox is listed: all, priority or split. */
		view: 'all',
		split: 'primary',
		query: '',
		filters: blankFilters(),
		page: 1,
		/* The conversation, draft or scheduled message open in the reader. */
		current: null,
		/* The row keyboard focus rests on. */
		cursor: null,
		selected: new Set(),
		lastChecked: null,
		/* Listed ids, in the order they appear. */
		shown: [],
		/* On one pane, true while the conversation covers the list. */
		reading: false,
		/* Folded messages that have been opened. */
		expanded: new Set(),
		/* The conversation the reply box is docked under. */
		replyFor: null,
		/* Rows that just arrived and light up once. */
		fresh: new Set(),
	};

	/* Handles on the markup that never changes. */
	const dom = {
		app: pick('[data-ml-app]', appRoot),
		rail: pick('#ml-rail'),
		folders: pick('[data-ml-folders]', appRoot),
		labels: pick('[data-ml-labels]', appRoot),
		team: pick('[data-ml-team]', appRoot),
		list: pick('[data-ml-list]', appRoot),
		title: pick('[data-ml-title]', appRoot),
		sub: pick('[data-ml-sub]', appRoot),
		view: pick('[data-ml-view]', appRoot),
		search: pick('[data-ml-search]', appRoot),
		filterBtn: pick('[data-ml-filter-btn]', appRoot),
		filterForm: pick('[data-ml-filter-form]', appRoot),
		filterCount: pick('[data-ml-filter-count]', appRoot),
		chips: pick('[data-ml-chips]', appRoot),
		split: pick('[data-ml-split]', appRoot),
		selectAll: pick('[data-ml-select-all]', appRoot),
		idle: pick('[data-ml-tools-idle]', appRoot),
		bulk: pick('[data-ml-bulk]', appRoot),
		bulkCount: pick('[data-ml-bulk-count]', appRoot),
		emptyBox: pick('[data-ml-empty-box]', appRoot),
		range: pick('[data-ml-range]', appRoot),
		prev: pick('[data-ml-prev]', appRoot),
		next: pick('[data-ml-next]', appRoot),
		scroll: pick('[data-ml-scroll]', appRoot),
		rows: pick('[data-ml-rows]', appRoot),
		empty: pick('[data-ml-empty]', appRoot),
		reader: pick('[data-ml-reader]', appRoot),
		holder: pick('[data-ml-holder]', appRoot),
		reply: pick('[data-ml-reply]', appRoot),
		peopleList: pick('[data-ml-people-list]', appRoot),
		themeItem: pick('[data-ml-theme]', appRoot),
	};
	const liveRegion = pick('[data-ml-live]', appRoot);
	const personPanel = pick('#ml-person');

	const replyBox = {
		form: dom.reply,
		tags: pick('[data-ml-r-tags]', dom.reply),
		body: pick('[data-ml-r-body]', dom.reply),
		files: pick('[data-ml-r-files]', dom.reply),
		fileInput: pick('[data-ml-r-file]', dom.reply),
		note: pick('[data-ml-r-note]', dom.reply),
		modeLabel: pick('[data-ml-r-mode-label]', dom.reply),
		modeIcon: pick('[data-ml-r-mode-icon]', dom.reply),
		mode: 'reply',
		attached: [],
		texts: {} /* unsent words, kept per conversation */,
	};

	const composerDialog = pick('#ml-compose');
	const composer = {
		form: pick('[data-ml-compose-form]', composerDialog),
		title: pick('[data-ml-c-title]', composerDialog),
		saved: pick('[data-ml-c-saved]', composerDialog),
		from: pick('[data-ml-c-from]', composerDialog),
		to: pick('[data-ml-tags="to"]', composerDialog),
		cc: pick('[data-ml-tags="cc"]', composerDialog),
		bcc: pick('[data-ml-tags="bcc"]', composerDialog),
		subject: pick('[data-ml-c-subject]', composerDialog),
		body: pick('[data-ml-c-body]', composerDialog),
		files: pick('[data-ml-c-files]', composerDialog),
		fileInput: pick('[data-ml-c-file]', composerDialog),
		sched: pick('[data-ml-c-sched]', composerDialog),
		draftId: null,
		replyTo: null,
		attached: [],
		dirty: false,
		sending: false,
		timer: 0,
	};
	const laterPanel = pick('[data-ml-schedule]', composerDialog);
	const snoozeDialog = pick('#ml-snooze-dialog');
	const labelDialog = pick('#ml-label-dialog');

	/* Small bits of in-flight state the handlers share. */
	let sheetPerson = null;
	let doomedIds = [];
	let snoozeTargets = [];
	let autoReadTimer = 0;
	let typingTimer = 0;
	let goChord = 0;

	/**
	 * Binds every control once and asks for the mailbox. The tag inputs get
	 * their .basaltTags from basalt.js on DOMContentLoaded, well before the
	 * first load answers and anything is written into them.
	 */
	function start() {
		bindDeleteDialog();
		bindPersonSheet();
		bindReplyBox();
		bindComposer();
		bindSchedulePanel();
		appRoot.addEventListener('click', onRootClick);
		appRoot.addEventListener('change', onRootChange);
		appRoot.addEventListener('mousedown', (event) => {
			mailbox._shift = event.shiftKey;
		});
		bindSnoozeDialog();
		bindLabelDialog();
		bindSearch();
		bindInboxViews();
		dom.rows.addEventListener('keydown', onRowKeydown);
		document.addEventListener('keydown', onShortcut);
		/* For the demo, one new message turns up while the page is open. */
		setTimeout(() => {
			if (!mailbox.loading && !mailbox.error) api.poll().then(fileIncoming);
		}, 45000);

		for (const tagField of [composer.to, composer.cc, composer.bcc, replyBox.tags]) bindRecipientField(tagField);
		bindTemplates(pick('[data-ml-templates]', composerDialog), (template) =>
			insertTemplate(composer.body, template, chipsIn(composer.to)),
		);
		bindTemplates(pick('[data-ml-templates]', replyBox.form), (template) =>
			insertTemplate(replyBox.body, template, chipsIn(replyBox.tags)),
		);
		if (narrowQuery.addEventListener) narrowQuery.addEventListener('change', onBreakpoint);
		document.addEventListener('basalt:appearance', reflectTheme);
		reflectTheme();
		/* Shortcut hints show the modifier key this keyboard actually has. */
		if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
			for (const keyLabel of pickAll('[data-ml-mod-key]', appRoot)) keyLabel.textContent = '⌘';
		}
		fetchMailbox();
	}

	/* Asks for the whole mailbox and fills the pickers that depend on it. */
	function fetchMailbox() {
		mailbox.loading = true;
		mailbox.error = false;
		drawEverything();
		api.load()
			.then((loaded) => {
				mailbox.me = loaded.me;
				mailbox.sendAs = loaded.sendAs;
				mailbox.people = loaded.people;
				mailbox.accounts = loaded.accounts;
				mailbox.labels = loaded.labels;
				mailbox.threads = loaded.threads;
				mailbox.drafts = loaded.drafts;
				mailbox.scheduled = loaded.scheduled;
				mailbox.templates = loaded.templates;
				mailbox.loading = false;
				listContacts();
				listLabelOptions();
				listTemplates(pick('[data-ml-templates]', composerDialog));
				listTemplates(pick('[data-ml-templates]', replyBox.form));
				composer.from.innerHTML = mailbox.sendAs
					.map(
						(sender) =>
							`<option value="${htmlSafe(sender.email)}" data-hint="${htmlSafe(sender.name)}">${htmlSafe(sender.email)}</option>`,
					)
					.join('');
				if (window.Basalt.select) window.Basalt.select.refresh(composer.from);
				drawEverything();
				if (!isSinglePane() && mailbox.shown.length) openRow(mailbox.shown[0], { focus: false, noRead: true });
				announce(`Mail loaded. ${dom.sub.textContent}.`);
			})
			.catch(() => {
				mailbox.loading = false;
				mailbox.error = true;
				drawEverything();
				announce('Your mail did not load. Try again.');
			});
	}

	/* Files mail that arrived since the last look and points it out once. */
	function fileIncoming(arrivals) {
		let added = 0;
		for (const arrival of arrivals) {
			const convo = threadById(arrival.thread);
			const msgItem = Object.assign({ at: writeStamp(clockNow()), unread: true }, arrival.message);
			if (convo) {
				if (convo.messages.some((each) => each.id === msgItem.id)) continue;
				convo.messages.push(msgItem);
				if (convo.box !== 'inbox') convo.box = 'inbox';
				convo.snoozeUntil = null;
			} else {
				mailbox.threads.push({
					id: arrival.thread,
					subject: arrival.subject || '(no subject)',
					box: 'inbox',
					category: 'primary',
					labels: [],
					starred: false,
					important: false,
					messages: [msgItem],
				});
			}
			mailbox.fresh.add(arrival.thread);
			added += 1;
		}
		if (!added) return 0;
		const openId = mailbox.current;
		drawRail();
		drawList();
		if (openId && openId === arrivals[0].thread) withScrollKept(() => drawReader());
		const firstArrival = arrivals[0];
		const sender = contactFor(firstArrival.message.from);
		const convo = threadById(firstArrival.thread);
		announce(`New message from ${sender.name}: ${convo.subject}.`);
		notify({
			tone: 'primary',
			icon: 'bi-envelope',
			title: `New message from ${sender.name}`,
			text: convo.subject,
			duration: 6000,
			actions: [
				{
					label: 'Open',
					onClick: () => {
						if (mailbox.folder !== 'inbox') goToFolder('inbox', { noOpen: true });
						openRow(firstArrival.thread);
					},
				},
			],
		});
		return added;
	}

	/* The Check mail button: poll now and report what came back. */
	function pollNow(checkBtn) {
		if (mailbox.loading || mailbox.error) {
			if (mailbox.error) fetchMailbox();
			return;
		}
		if (checkBtn && window.Basalt.buttonState) window.Basalt.buttonState(checkBtn, 'loading', 'Checking');
		api.poll()
			.then((arrivals) => {
				const howMany = fileIncoming(arrivals);
				if (checkBtn && window.Basalt.buttonState)
					window.Basalt.buttonState(
						checkBtn,
						'success',
						howMany ? countOf(howMany, 'new message') : 'No new mail',
					);
				if (!howMany) announce('No new mail.');
			})
			.catch(() => {
				if (checkBtn && window.Basalt.buttonState) window.Basalt.buttonState(checkBtn, 'error', 'Try again');
				notify({ tone: 'danger', title: 'Could not check for mail', text: "The mail server didn't answer." });
			})
			.then(() => {
				if (checkBtn && window.Basalt.buttonState)
					setTimeout(() => window.Basalt.buttonState(checkBtn, 'idle'), 1800);
			});
	}

	/* Redraws the three columns from state, rail first. */
	function drawEverything() {
		drawRail();
		drawList();
		drawReader();
	}

	/* Unread and waiting counts the rail and headings show. */
	function tallies() {
		const liveOnes = mailbox.threads;
		return {
			inbox: liveOnes.filter((convo) => belongsIn(convo, 'inbox') && hasUnread(convo)).length,
			snoozed: liveOnes.filter((convo) => belongsIn(convo, 'snoozed')).length,
			scheduled: mailbox.scheduled.length,
			drafts: mailbox.drafts.length,
			spam: liveOnes.filter((convo) => convo.box === 'spam').length,
		};
	}

	/* Folders, labels and the teammates who are around. */
	function drawRail() {
		const tally = tallies();
		dom.folders.innerHTML = RAIL_FOLDERS.map((folder) => {
			const howMany = tally[folder.id] || 0;
			const isHere = mailbox.folder === folder.id;
			const countHint =
				folder.id === 'inbox'
					? `${howMany} unread`
					: folder.id === 'drafts'
						? countOf(howMany, 'draft')
						: countOf(howMany, 'conversation');
			return `<li><button type="button" class="ml-place${folder.id === 'inbox' && howMany ? ' has-unread' : ''}" data-ml-folder="${folder.id}"${isHere ? ' aria-current="page"' : ''}><i class="bi ${folder.icon}${isHere && folder.id === 'starred' ? '-fill' : ''}" aria-hidden="true"></i><span class="ml-place-name">${folder.name}</span>${howMany ? `<span class="ml-place-count"><span aria-hidden="true">${howMany}</span><span class="visually-hidden">, ${countHint}</span></span>` : ''}</button></li>`;
		}).join('');
		dom.labels.innerHTML = mailbox.labels
			.map((labelEntry) => {
				const folderKey = `label:${labelEntry.id}`;
				const howMany = mailbox.threads.filter(
					(convo) => belongsIn(convo, folderKey) && hasUnread(convo),
				).length;
				return `<li><button type="button" class="ml-place" data-ml-folder="${folderKey}"${mailbox.folder === folderKey ? ' aria-current="page"' : ''}><span class="ml-dot ml-tone-${labelEntry.tone}" aria-hidden="true"></span><span class="ml-place-name">${htmlSafe(labelEntry.name)}</span>${howMany ? `<span class="ml-place-count"><span aria-hidden="true">${howMany}</span><span class="visually-hidden">, ${howMany} unread</span></span>` : ''}</button></li>`;
			})
			.join('');
		const PRESENCE_WORDS = { online: 'Online', away: 'Away', busy: 'In a meeting', offline: 'Offline' };
		dom.team.innerHTML = mailbox.people
			.filter((person) => person.kind === 'team' && person.presence && person.id !== mailbox.me)
			.map(
				(person) =>
					`<li><button type="button" class="ml-team-who" data-ml-person="${htmlSafe(person.id)}" aria-label="${htmlSafe(person.name)}, ${PRESENCE_WORDS[person.presence].toLowerCase()}" data-bs-toggle="tooltip" data-bs-title="${htmlSafe(person.name)}, ${PRESENCE_WORDS[person.presence].toLowerCase()}"><span class="basalt-avatar-status"><span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(person.name)}" aria-hidden="true"></span>${person.presence !== 'offline' ? `<span class="basalt-avatar-status-dot basalt-avatar-status-dot-${person.presence}"></span>` : ''}</span></button></li>`,
			)
			.join('');
		if (window.Basalt.tips) window.Basalt.tips(dom.team);
		dom.team.closest('.ml-rail-note').hidden = !dom.team.children.length;
		if (window.Basalt.avatars) window.Basalt.avatars(dom.team);
		/* Like any mail app, the tab title carries the unread count. */
		document.title = `${tally.inbox ? `(${tally.inbox}) ` : ''}Mail · Basalt`;
	}

	/* The list column: heading, rows, empty state and pager. */
	function drawList() {
		if (!mailbox.loading && !mailbox.error) mailbox.shown = rowsToList().map((each) => each.id);
		drawListHead();
		if (mailbox.loading) {
			dom.rows.setAttribute('aria-busy', 'true');
			dom.rows.innerHTML = loadingRows();
			dom.empty.hidden = true;
			dom.range.textContent = '';
			dom.prev.disabled = dom.next.disabled = true;
			return;
		}
		dom.rows.setAttribute('aria-busy', 'false');
		if (mailbox.error) {
			dom.rows.innerHTML = '';
			dom.empty.innerHTML = emptyMarkup('error');
			dom.empty.hidden = false;
			dom.range.textContent = '';
			dom.prev.disabled = dom.next.disabled = true;
			drawToolbar();
			return;
		}
		const allRows = rowsToList();
		mailbox.shown = allRows.map((each) => each.id);
		const pageCount = Math.max(1, Math.ceil(allRows.length / ROWS_PER_PAGE));
		mailbox.page = Math.min(Math.max(1, mailbox.page), pageCount);
		const offset = (mailbox.page - 1) * ROWS_PER_PAGE;
		const pageRows = allRows.slice(offset, offset + ROWS_PER_PAGE);
		/* When the open conversation moves, its page stays in view. */
		if (!mailbox.cursor || !pageRows.some((each) => each.id === mailbox.cursor))
			mailbox.cursor = (pageRows.find((each) => each.id === mailbox.current) || pageRows[0] || {}).id || null;
		dom.rows.innerHTML = pageRows
			.map((listed) =>
				listed.kind === 'thread' ? conversationRow(threadById(listed.id), listed) : outgoingRow(listed),
			)
			.join('');
		if (window.Basalt.avatars) window.Basalt.avatars(dom.rows);
		mailbox.fresh.clear();
		if (!allRows.length) {
			let rowKind = mailbox.folder;
			if (isSearching()) rowKind = 'search';
			else if (isLabelView(rowKind)) rowKind = 'label';
			else if (
				rowKind === 'inbox' &&
				mailbox.view === 'split' &&
				mailbox.threads.some((convo) => belongsIn(convo, 'inbox'))
			)
				rowKind = 'split';
			dom.empty.innerHTML = emptyMarkup(rowKind);
			dom.empty.hidden = false;
		} else {
			dom.empty.hidden = true;
			dom.empty.innerHTML = '';
		}
		dom.range.textContent = allRows.length
			? `${offset + 1}–${Math.min(allRows.length, offset + ROWS_PER_PAGE)} of ${allRows.length}`
			: '';
		dom.prev.disabled = mailbox.page <= 1;
		dom.next.disabled = mailbox.page >= pageCount;
		dom.prev.parentElement.hidden = allRows.length <= ROWS_PER_PAGE && !allRows.length;
		drawToolbar();
	}

	/* The heading over the list: title, count, inbox controls and filter chips. */
	function drawListHead() {
		const folderId = mailbox.folder;
		dom.title.textContent = searchesAll() ? 'All mail' : titleOf(folderId);
		const tally = tallies();
		let subtitle;
		if (mailbox.loading) subtitle = 'Loading…';
		else if (mailbox.error) subtitle = '';
		else if (isSearching()) subtitle = countOf(mailbox.shown.length, 'result');
		else if (folderId === 'inbox') subtitle = tally.inbox ? `${tally.inbox} unread` : 'All read';
		else if (folderId === 'drafts') subtitle = countOf(mailbox.drafts.length, 'draft');
		else if (folderId === 'scheduled') subtitle = `${countOf(mailbox.scheduled.length, 'message')} waiting to send`;
		else subtitle = countOf(mailbox.shown.length, 'conversation');
		dom.sub.textContent = subtitle;
		dom.view.hidden = folderId !== 'inbox' || isSearching();
		dom.split.hidden = !(folderId === 'inbox' && mailbox.view === 'split' && !isSearching());
		if (!dom.split.hidden) {
			for (const splitKey of ['primary', 'updates', 'newsletters']) {
				const howMany = mailbox.threads.filter(
					(convo) => belongsIn(convo, 'inbox') && convo.category === splitKey && hasUnread(convo),
				).length;
				const badgeEl = pick(`[data-ml-split-count="${splitKey}"]`, dom.split);
				badgeEl.innerHTML = howMany ? `${howMany}<span class="visually-hidden"> unread</span>` : '';
				badgeEl.hidden = !howMany;
			}

			if (dom.split.basaltTabs) dom.split.basaltTabs.refresh();
		}
		/* Each filter in use becomes a chip that removes it. */
		const activeFilters = mailbox.filters;
		const chipList = [];
		if (activeFilters.from) chipList.push(['from', 'From', activeFilters.from]);
		if (activeFilters.label)
			chipList.push(['label', 'Label', (labelById(activeFilters.label) || {}).name || activeFilters.label]);
		if (activeFilters.when)
			chipList.push([
				'when',
				'Received',
				{ today: 'Today', week: 'Last 7 days', month: 'Last 30 days' }[activeFilters.when],
			]);
		if (activeFilters.unread) chipList.push(['unread', 'Only', 'Unread']);
		if (activeFilters.files) chipList.push(['files', 'Only', 'With attachments']);
		if (activeFilters.everywhere && isSearching()) chipList.push(['everywhere', 'In', 'Every folder']);
		dom.chips.hidden = !chipList.length;
		dom.chips.innerHTML = chipList
			.map(
				([splitKey, caption, raw]) =>
					`<li><span class="basalt-removable basalt-tone-primary"><span class="basalt-removable-key">${htmlSafe(caption)}</span>${htmlSafe(raw)}<button type="button" class="basalt-removable-remove" aria-label="Remove filter ${htmlSafe(caption)}: ${htmlSafe(raw)}" data-ml-unfilter="${splitKey}"><i class="bi bi-x" aria-hidden="true"></i></button></span></li>`,
			)
			.join('');
		const inUse = chipList.filter((each) => each[0] !== 'everywhere').length;
		dom.filterCount.hidden = !inUse;
		dom.filterCount.textContent = inUse;
		dom.filterBtn.setAttribute('aria-label', inUse ? `Filters, ${inUse} in use` : 'Filters');
	}

	/* The select-all box and the bulk toolbar, fitted to the folder. */
	function drawToolbar() {
		const rowKind = rowKindFor(mailbox.folder);
		const visibleIds = pickAll('[data-ml-check]', dom.rows).map((tickbox) => tickbox.getAttribute('data-ml-check'));

		/* Rows that left the list leave the selection too. */
		for (const rowId of Array.from(mailbox.selected)) {
			if (!mailbox.shown.includes(rowId)) mailbox.selected.delete(rowId);
		}

		const howMany = mailbox.selected.size;
		dom.selectAll.hidden = rowKind !== 'thread' || mailbox.loading || mailbox.error || !visibleIds.length;
		dom.selectAll.checked = howMany > 0 && visibleIds.every((rowId) => mailbox.selected.has(rowId));
		dom.selectAll.indeterminate = howMany > 0 && !dom.selectAll.checked;
		dom.bulk.hidden = !howMany;
		dom.idle.hidden = !!howMany;
		dom.bulkCount.textContent = howMany ? `${howMany} selected` : '';
		const folderId = mailbox.folder;

		function toggleBulkButton(verb, isOn) {
			const button = pick(`[data-ml-bulk="${verb}"]`, dom.bulk);
			button.hidden = !isOn;
			button.disabled = !isOn;
		}

		toggleBulkButton('archive', folderId !== 'archive' && folderId !== 'trash' && folderId !== 'spam');
		toggleBulkButton(
			'inbox',
			folderId === 'archive' || folderId === 'trash' || folderId === 'spam' || folderId === 'snoozed',
		);
		toggleBulkButton('snooze', folderId !== 'trash' && folderId !== 'spam' && folderId !== 'snoozed');
		toggleBulkButton('spam', folderId !== 'spam' && folderId !== 'trash');
		toggleBulkButton('trash', folderId !== 'trash');
		toggleBulkButton('destroy', folderId === 'trash' || folderId === 'spam');
		pick('[data-ml-bulk="inbox"]', dom.bulk).setAttribute(
			'aria-label',
			folderId === 'spam'
				? 'Not spam, move to inbox'
				: folderId === 'snoozed'
					? 'Unsnooze, back to inbox'
					: 'Move to inbox',
		);
		/* The first button still showing is the toolbar's single tab stop. */
		const shownButtons = pickAll('button', dom.bulk).filter((candidate) => !candidate.hidden);
		for (const [pos, button] of shownButtons.entries()) button.setAttribute('tabindex', pos === 0 ? '0' : '-1');
		const snoozeButton = pick('[data-ml-bulk="snooze"]', dom.bulk);
		const mondayPreset = snoozeChoices().find((preset) => preset.id === 'monday');
		if (mondayPreset) {
			snoozeButton.setAttribute('aria-label', `Snooze until ${laterLabel(mondayPreset.at)}`);
			snoozeButton.setAttribute('data-bs-title', `Snooze until ${laterLabel(mondayPreset.at)}`);
		}
		const snoozeTip = window.bootstrap && bootstrap.Tooltip.getInstance(snoozeButton);
		if (snoozeTip && mondayPreset)
			snoozeTip.setContent({ '.tooltip-inner': `Snooze until ${laterLabel(mondayPreset.at)}` });
		const canEmpty =
			(folderId === 'trash' || folderId === 'spam') && mailbox.threads.some((convo) => convo.box === folderId);
		dom.emptyBox.hidden = !canEmpty;
		dom.emptyBox.innerHTML = canEmpty
			? `<i class="bi bi-x-octagon me-1" aria-hidden="true"></i>Empty ${folderId} now`
			: '';
		const readAllBtn = pick('[data-ml-read-all]', dom.idle);
		readAllBtn.hidden = rowKind !== 'thread';
	}

	/* One conversation row, with a section heading above it when Priority starts a group. */
	function conversationRow(convo, listed) {
		const isUnreadRow = hasUnread(convo);
		const isCurrentRow = mailbox.current === convo.id;
		const ticked = mailbox.selected.has(convo.id);
		const msgItem = latestMessage(convo);
		const shownMsg = mailbox.folder === 'sent' ? latestFromMe(convo) || msgItem : msgItem;
		const msgCount = convo.messages.length;
		const timeMarkup =
			isSnoozed(convo) && mailbox.folder === 'snoozed'
				? `<span class="ml-row-time ml-row-time-snooze"><i class="bi bi-alarm" aria-hidden="true"></i>${htmlSafe(laterShort(convo.snoozeUntil))}</span>`
				: `<span class="ml-row-time">${htmlSafe(rowTime(shownMsg.at))}</span>`;
		const author = mailbox.folder === 'sent' ? contactFor(mailbox.me) : contactFor(msgItem.from);
		const faceName =
			mailbox.folder === 'sent' && latestFromMe(convo) ? contactFor(latestFromMe(convo).to[0]).name : author.name;
		const boxChip =
			searchesAll() && !belongsIn(convo, mailbox.folder)
				? `<span class="ml-chip ml-chip-box">${htmlSafe(whereItLives(convo))}</span>`
				: '';
		return `${listed.section ? `<li class="ml-section" role="presentation"><span class="ml-section-name">${htmlSafe(listed.section)}</span><span class="ml-section-count">${listed.sectionCount}</span></li>` : ''}<li class="ml-row${isUnreadRow ? ' is-unread' : ''}${isCurrentRow ? ' is-current' : ''}${ticked ? ' is-checked' : ''}${mailbox.fresh.has(convo.id) ? ' is-fresh' : ''}" data-ml-row="${htmlSafe(convo.id)}"><input class="form-check-input ml-row-check" type="checkbox" tabindex="-1"${ticked ? ' checked' : ''} aria-label="Select: ${htmlSafe(convo.subject)}" data-ml-check="${htmlSafe(convo.id)}"><button type="button" class="ml-row-open" data-ml-open="${htmlSafe(convo.id)}"${isCurrentRow ? ' aria-current="true"' : ''} tabindex="${mailbox.cursor === convo.id ? '0' : '-1'}"><span class="basalt-avatar basalt-avatar-sm ml-row-avatar" data-basalt-avatar data-name="${htmlSafe(faceName)}" aria-hidden="true"></span><span class="ml-row-main"><span class="ml-row-top">${isUnreadRow ? '<span class="visually-hidden">Unread. </span>' : ''}<span class="ml-row-from">${htmlSafe(rowNames(convo))}</span>${msgCount > 1 ? `<span class="ml-row-n">${msgCount}<span class="visually-hidden"> messages</span></span>` : ''}${timeMarkup}</span><span class="ml-row-subject">${convo.important ? '<i class="bi bi-bookmark-fill ml-row-imp" aria-hidden="true"></i><span class="visually-hidden">Important. </span>' : ''}${htmlSafe(convo.subject)}</span><span class="ml-row-snip">${htmlSafe(previewText(msgItem))}</span><span class="ml-row-meta">${boxChip}${chipsFor(convo)}${hasAttachments(convo) ? '<span class="ml-row-clip"><i class="bi bi-paperclip" aria-hidden="true"></i><span class="visually-hidden">Has attachments</span></span>' : ''}</span></span></button><button type="button" class="ml-row-star${convo.starred ? ' is-on' : ''}" tabindex="-1" aria-pressed="${convo.starred}" aria-label="Star: ${htmlSafe(convo.subject)}" data-ml-star="${htmlSafe(convo.id)}"><i class="bi bi-star${convo.starred ? '-fill' : ''}" aria-hidden="true"></i></button><span class="ml-row-hover" aria-hidden="true">${convo.box === 'inbox' ? '<button type="button" class="ml-row-act" tabindex="-1" title="Archive" data-ml-row-act="archive"><i class="bi bi-archive"></i></button>' : ''}<button type="button" class="ml-row-act" tabindex="-1" title="${isUnreadRow ? 'Mark as read' : 'Mark as unread'}" data-ml-row-act="${isUnreadRow ? 'read' : 'unread'}"><i class="bi bi-envelope${isUnreadRow ? '-open' : ''}"></i></button>${convo.box !== 'trash' ? '<button type="button" class="ml-row-act" tabindex="-1" title="Move to trash" data-ml-row-act="trash"><i class="bi bi-trash3"></i></button>' : ''}</span></li>`;
	}

	/* One draft or scheduled message row. */
	function outgoingRow(listed) {
		const entry = listed.kind === 'draft' ? draftById(listed.id) : scheduledById(listed.id);
		const isCurrentRow = mailbox.current === entry.id;
		const recipientText = entry.to.length
			? entry.to.map((address) => contactFor(address).name).join(', ')
			: '(no one yet)';
		const timeMarkup = listed.kind === 'draft' ? rowTime(entry.updated) : laterShort(entry.sendAt);
		return `<li class="ml-row ml-row-compose${isCurrentRow ? ' is-current' : ''}" data-ml-row="${htmlSafe(entry.id)}"><span class="ml-row-check ml-row-check-blank" aria-hidden="true"></span><button type="button" class="ml-row-open" data-ml-open="${htmlSafe(entry.id)}"${isCurrentRow ? ' aria-current="true"' : ''} tabindex="${mailbox.cursor === entry.id ? '0' : '-1'}"><span class="basalt-avatar basalt-avatar-sm ml-row-avatar" data-basalt-avatar data-name="${htmlSafe(entry.to.length ? contactFor(entry.to[0]).name : 'New message')}" aria-hidden="true"></span><span class="ml-row-main"><span class="ml-row-top"><span class="ml-row-from">To: ${htmlSafe(recipientText)}</span><span class="ml-row-time${listed.kind === 'scheduled' ? ' ml-row-time-snooze' : ''}">${listed.kind === 'scheduled' ? '<i class="bi bi-clock-history" aria-hidden="true"></i>' : ''}${htmlSafe(timeMarkup)}</span></span><span class="ml-row-subject">${htmlSafe(entry.subject || '(no subject)')}</span><span class="ml-row-snip">${htmlSafe(plainText(entry.html).slice(0, 160) || 'Nothing written yet')}</span><span class="ml-row-meta"><span class="ml-chip ml-chip-${listed.kind}">${listed.kind === 'draft' ? 'Draft' : `Sends ${htmlSafe(laterLabel(entry.sendAt))}`}</span></span></span></button></li>`;
	}

	function chipsFor(convo, limit) {
		const ownLabels = convo.labels
			.map(labelById)
			.filter(Boolean)
			.filter((labelEntry) => !(isLabelView(mailbox.folder) && mailbox.folder === `label:${labelEntry.id}`));
		const visibleLabels = ownLabels.slice(0, limit || 2);
		return (
			visibleLabels
				.map(
					(labelEntry) =>
						`<span class="ml-chip ml-tone-${labelEntry.tone}">${htmlSafe(labelEntry.name)}</span>`,
				)
				.join('') +
			(ownLabels.length > visibleLabels.length
				? `<span class="ml-chip ml-chip-more">+${ownLabels.length - visibleLabels.length}</span>`
				: '')
		);
	}

	/* Who the row names: recipients in Sent, otherwise up to three recent senders. */
	function rowNames(convo) {
		if (mailbox.folder === 'sent') {
			const mine = latestFromMe(convo);
			return `To: ${mine ? mine.to.map((recipient) => contactFor(recipient).name).join(', ') : ''}`;
		}
		const senderIds = [];
		for (const msgItem of convo.messages) {
			if (!senderIds.includes(msgItem.from)) senderIds.push(msgItem.from);
		}
		if (senderIds.length === 1) return isSelf(senderIds[0]) ? 'me' : contactFor(senderIds[0]).name;
		return senderIds.slice(-3).map(givenName).join(', ');
	}

	function latestFromMe(convo) {
		return (
			convo.messages
				.slice()
				.reverse()
				.find((msgItem) => isSelf(msgItem.from)) || null
		);
	}

	function previewText(msgItem) {
		return (msgItem.text ? msgItem.text.replace(/\s+/g, ' ') : plainText(msgItem.html)).slice(0, 160);
	}

	function whereItLives(convo) {
		if (isSnoozed(convo)) return 'Snoozed';
		return { inbox: 'Inbox', archive: 'Archive', sent: 'Sent', spam: 'Spam', trash: 'Trash' }[convo.box] || '';
	}

	function loadingRows() {
		let htmlOut = '';
		for (let pos = 0; pos < 7; pos++) {
			htmlOut += `<li class="ml-row ml-row-skeleton" aria-hidden="true"><span class="basalt-skeleton basalt-skeleton-circle ml-skel-av"></span><span class="ml-skel-lines"><span class="basalt-skeleton basalt-skeleton-text ml-skel-a"></span><span class="basalt-skeleton basalt-skeleton-text ml-skel-b"></span><span class="basalt-skeleton basalt-skeleton-text ml-skel-c"></span></span></li>`;
		}
		return htmlOut;
	}

	/* Every empty state the list can show, picked by what is missing. */
	function emptyMarkup(rowKind) {
		const labelTitle = isLabelView(mailbox.folder) ? titleOf(mailbox.folder) : '';
		const sectionName = { primary: 'Primary', updates: 'Updates', newsletters: 'Newsletters' }[mailbox.split];
		const spec = {
			error: {
				tone: 'danger',
				icon: 'bi-cloud-slash',
				title: "Your mail didn't load",
				text: "The mail server didn't answer. Nothing is lost; this only affects what you can see here.",
				actions:
					'<button type="button" class="btn btn-sm btn-primary" data-ml-retry><i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Try again</button>',
			},
			search: {
				icon: 'bi-search',
				title: mailbox.query.trim()
					? `No mail matches “${htmlSafe(mailbox.query.trim())}”`
					: 'No mail matches these filters',
				text: searchesAll()
					? 'Every folder was searched. Check the spelling, or loosen the filters.'
					: `Only ${htmlSafe(titleOf(mailbox.folder))} was searched.`,
				actions:
					(mailbox.query.trim()
						? '<button type="button" class="btn btn-sm btn-outline-secondary" data-ml-clear-search>Clear the search</button>'
						: '') +
					(hasFilters()
						? '<button type="button" class="btn btn-sm btn-outline-secondary" data-ml-clear-filters>Clear filters</button>'
						: '') +
					(!searchesAll()
						? '<button type="button" class="btn btn-sm btn-primary" data-ml-everywhere>Search every folder</button>'
						: ''),
			},
			inbox: {
				tone: 'success',
				icon: 'bi-check2-circle',
				title: "You're all caught up",
				text: 'New mail lands here. Snoozed conversations come back on their own.',
				actions:
					'<button type="button" class="btn btn-sm btn-primary" data-ml-compose><i class="bi bi-pencil-square me-1" aria-hidden="true"></i>Compose</button>',
			},
			split: {
				icon: 'bi-inbox',
				title: `Nothing in ${htmlSafe(sectionName)}`,
				text: 'Mail sorted into this section shows up here.',
			},
			starred: {
				icon: 'bi-star',
				title: 'Nothing starred',
				text: 'Star a conversation, or press S on it, to keep it close.',
			},
			snoozed: {
				icon: 'bi-alarm',
				title: 'Nothing snoozed',
				text: 'Press B on a conversation to send it away until a better time.',
			},
			sent: { icon: 'bi-send', title: 'Nothing sent yet', text: 'Mail you send shows up here.' },
			scheduled: {
				icon: 'bi-clock-history',
				title: 'Nothing scheduled',
				text: 'Use the arrow beside Send to pick when a message goes out.',
			},
			drafts: {
				icon: 'bi-file-earmark-text',
				title: 'No drafts',
				text: 'Anything you start writing is kept here until you send it.',
			},
			archive: {
				icon: 'bi-archive',
				title: 'The archive is empty',
				text: 'Archived conversations leave the inbox but stay searchable.',
			},
			spam: {
				tone: 'success',
				icon: 'bi-shield-check',
				title: 'No spam',
				text: 'Messages in spam are deleted after 30 days.',
			},
			trash: {
				tone: 'success',
				icon: 'bi-trash3',
				title: 'The trash is empty',
				text: 'Conversations in the trash are deleted after 30 days.',
			},
			label: {
				icon: 'bi-tag',
				title: `Nothing labeled ${htmlSafe(labelTitle)}`,
				text: "Add the label from a conversation's Labels menu.",
			},
		}[rowKind];
		return `<div class="basalt-empty basalt-empty-compact${spec.tone ? ` basalt-empty-${spec.tone}` : ''} ml-empty"${rowKind === 'error' ? ' role="alert"' : ''}><span class="ml-empty-icon${spec.tone ? ` ml-empty-icon-${spec.tone}` : ''}" aria-hidden="true"><i class="bi ${spec.icon}"></i></span><h3 class="basalt-empty-title">${spec.title}</h3><p class="basalt-empty-text">${spec.text}</p>${spec.actions ? `<div class="basalt-empty-actions">${spec.actions}</div>` : ''}</div>`;
	}

	/* The reader column, for whatever is open. */
	function drawReader() {
		if (mailbox.loading) {
			drawReaderLoading();
			return;
		}
		if (mailbox.error || !mailbox.current) {
			drawReaderIdle();
			layoutPanes();
			return;
		}
		const rowKind = rowKindFor(mailbox.folder);
		if (threadById(mailbox.current)) drawConversation(threadById(mailbox.current));
		else if (rowKind === 'scheduled' && scheduledById(mailbox.current))
			drawScheduled(scheduledById(mailbox.current));
		else {
			mailbox.current = null;
			drawReaderIdle();
		}
		layoutPanes();
	}

	/* A conversation: toolbar, heading, folded messages and the reply bar. */
	function drawConversation(convo) {
		stowReplyBox();
		const place = convo.box;
		const labelOptions = mailbox.labels
			.map(
				(labelEntry) =>
					`<li><label class="dropdown-item ml-labelpick"><input class="form-check-input" type="checkbox" data-ml-label-toggle="${htmlSafe(labelEntry.id)}"${convo.labels.includes(labelEntry.id) ? ' checked' : ''}><span class="ml-dot ml-tone-${labelEntry.tone}" aria-hidden="true"></span>${htmlSafe(labelEntry.name)}</label></li>`,
			)
			.join('');
		const snoozeOptions = `${snoozeChoices()
			.map(
				(preset) =>
					`<li><button type="button" class="dropdown-item ml-snooze-item" data-ml-snooze="${htmlSafe(writeStamp(preset.at))}"><span>${htmlSafe(preset.name)}</span><span class="ml-snooze-item-when">${htmlSafe(preset.id === 'later' || preset.id === 'tomorrow' ? clockTime(preset.at) : `${WEEKDAYS[preset.at.getDay()]}, ${MONTH_NAMES[preset.at.getMonth()]} ${preset.at.getDate()}, ${clockTime(preset.at)}`)}</span></button></li>`,
			)
			.join(
				'',
			)}<li><hr class="dropdown-divider"></li><li><button type="button" class="dropdown-item" data-ml-snooze-pick><i class="bi bi-calendar3" aria-hidden="true"></i>Pick a date and time…</button></li>`;
		const toolbar = [];
		if (place === 'inbox' && !isSnoozed(convo))
			toolbar.push(toolButton('archive', 'bi-archive', 'Archive', ' aria-keyshortcuts="E"'));
		if (place === 'archive' || place === 'sent') toolbar.push(toolButton('inbox', 'bi-inbox', 'Move to inbox'));
		if (place === 'spam')
			toolbar.push(
				'<button type="button" class="btn btn-sm btn-outline-secondary" data-ml-act="inbox"><i class="bi bi-shield-check me-1" aria-hidden="true"></i>Not spam</button>',
			);
		if (place === 'trash')
			toolbar.push(
				'<button type="button" class="btn btn-sm btn-outline-secondary" data-ml-act="inbox"><i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Restore</button>',
			);
		if (isSnoozed(convo))
			toolbar.push(
				'<button type="button" class="btn btn-sm btn-outline-secondary" data-ml-act="unsnooze"><i class="bi bi-alarm me-1" aria-hidden="true"></i>Unsnooze</button>',
			);
		else if (place !== 'trash' && place !== 'spam') {
			toolbar.push(
				`<div class="dropdown"><button type="button" class="btn btn-icon btn-sm" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Snooze" aria-keyshortcuts="B" data-ml-snooze-btn><i class="bi bi-alarm" aria-hidden="true"></i></button><ul class="dropdown-menu ml-snooze-menu"><li><h3 class="dropdown-header">Snooze until</h3></li>${snoozeOptions}</ul></div>`,
			);
		}
		toolbar.push(toolButton('unread', 'bi-envelope', 'Mark as unread', ' aria-keyshortcuts="Shift+U"'));
		if (place !== 'spam' && place !== 'trash') {
			toolbar.push(
				`<div class="dropdown"><button type="button" class="btn btn-icon btn-sm" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false" aria-label="Labels"><i class="bi bi-tag" aria-hidden="true"></i></button><ul class="dropdown-menu ml-label-menu"><li><h3 class="dropdown-header">Labels</h3></li>${labelOptions}<li><hr class="dropdown-divider"></li><li><button type="button" class="dropdown-item" data-ml-new-label><i class="bi bi-plus-lg" aria-hidden="true"></i>New label</button></li></ul></div>`,
			);
		}
		if (place !== 'spam' && place !== 'trash')
			toolbar.push(toolButton('spam', 'bi-exclamation-octagon', 'Report spam'));
		if (place === 'trash' || place === 'spam')
			toolbar.push(toolButton('destroy', 'bi-x-octagon', 'Delete forever'));
		else toolbar.push(toolButton('trash', 'bi-trash3', 'Move to trash', ' aria-keyshortcuts="#"'));
		toolbar.push(
			`<div class="dropdown"><button type="button" class="btn btn-icon btn-sm" data-bs-toggle="dropdown" aria-expanded="false" aria-label="More actions"><i class="bi bi-three-dots" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end"><li><button type="button" class="dropdown-item" data-ml-act="important"><i class="bi bi-bookmark${convo.important ? '-x' : ''}" aria-hidden="true"></i>${convo.important ? 'Not important' : 'Mark as important'}</button></li><li><button type="button" class="dropdown-item" data-ml-act="read"><i class="bi bi-envelope-open" aria-hidden="true"></i>Mark as read</button></li><li><button type="button" class="dropdown-item" data-ml-act="link"><i class="bi bi-link-45deg" aria-hidden="true"></i>Copy link to conversation</button></li></ul></div>`,
		);

		/* Long threads fold their middle. The first message shows as a line;
       the last one, unread ones and any you opened stay open. */
		const msgCount = convo.messages.length;

		function staysOpen(msgItem, pos) {
			return (
				mailbox.expanded.has(msgItem.id) ||
				msgItem.unread ||
				msgItem.pending ||
				pos === msgCount - 1 ||
				msgCount <= 2
			);
		}

		let messageList = '';
		let foldedRun = [];

		function emitFolded() {
			if (foldedRun.length >= 2) {
				messageList += `<li class="ml-msg ml-msg-as-more"><button type="button" class="ml-more" data-ml-expand-many="${foldedRun.map((msgItem) => msgItem.id).join(',')}"><span class="ml-more-n">${foldedRun.length}</span>earlier messages</button></li>`;
			} else {
				for (const msgItem of foldedRun)
					messageList += messageMarkup(convo, msgItem, convo.messages.indexOf(msgItem), true);
			}
			foldedRun = [];
		}

		for (const [pos, msgItem] of convo.messages.entries()) {
			if (staysOpen(msgItem, pos)) {
				emitFolded();
				messageList += messageMarkup(convo, msgItem, pos, false);
			} else if (pos === 0) messageList += messageMarkup(convo, msgItem, pos, true);
			else foldedRun.push(msgItem);
		}
		emitFolded();

		const labelChipsMarkup = convo.labels
			.map(labelById)
			.filter(Boolean)
			.map(
				(labelEntry) =>
					`<li><span class="ml-chip ml-chip-as-x ml-tone-${labelEntry.tone}">${htmlSafe(labelEntry.name)}<button type="button" class="ml-chip-x" aria-label="Remove label ${htmlSafe(labelEntry.name)}" data-ml-unlabel="${htmlSafe(labelEntry.id)}"><i class="bi bi-x" aria-hidden="true"></i></button></span></li>`,
			)
			.join('');
		const banners = [];
		if (isSnoozed(convo))
			banners.push(
				`<p class="ml-note"><i class="bi bi-alarm" aria-hidden="true"></i>Snoozed until ${htmlSafe(laterLabel(convo.snoozeUntil))}. It comes back to the top of the inbox then.</p>`,
			);
		if (place === 'spam')
			banners.push(
				'<p class="ml-note ml-note-warn"><i class="bi bi-exclamation-octagon" aria-hidden="true"></i>This looks like spam: the sender isn\'t in your contacts and the message asks you to act fast. Links and replies are turned off.</p>',
			);
		if (place === 'trash')
			banners.push(
				'<p class="ml-note"><i class="bi bi-trash3" aria-hidden="true"></i>In the trash. It\'s deleted for good after 30 days.</p>',
			);
		const pendingDraft = mailbox.drafts.find((saved) => saved.replyTo === convo.id);
		if (pendingDraft)
			banners.push(
				`<p class="ml-note ml-note-draft"><i class="bi bi-file-earmark-text" aria-hidden="true"></i>You have a draft reply to this conversation. <button type="button" class="btn btn-link btn-sm ml-link" data-ml-open-draft="${htmlSafe(pendingDraft.id)}">Open the draft</button></p>`,
			);

		const replyable = place !== 'spam' && place !== 'trash';
		const subjectId = `ml-subj-${convo.id}`;
		dom.reader.innerHTML = `<article class="ml-read" aria-labelledby="${subjectId}" data-ml-thread="${htmlSafe(convo.id)}"><div class="ml-read-bar">${backButton()}<div class="ml-read-tools" role="toolbar" aria-label="Conversation actions" data-basalt-toolbar data-basalt-tip-group>${toolbar.join('')}</div>${stepperMarkup()}</div><div class="ml-read-scroll" data-ml-read-scroll><header class="ml-read-head"><div class="ml-read-title"><h2 class="ml-read-subject" id="${subjectId}" tabindex="-1">${htmlSafe(convo.subject)}</h2><button type="button" class="ml-read-star${convo.starred ? ' is-on' : ''}" aria-pressed="${convo.starred}" aria-label="Star this conversation" aria-keyshortcuts="S" data-ml-act="star"><i class="bi bi-star${convo.starred ? '-fill' : ''}" aria-hidden="true"></i></button></div><ul class="ml-read-labels" aria-label="Labels">${convo.important ? '<li><span class="ml-chip ml-chip-imp"><i class="bi bi-bookmark-fill" aria-hidden="true"></i>Important</span></li>' : ''}<li><span class="ml-chip ml-chip-box">${htmlSafe(whereItLives(convo))}</span></li>${labelChipsMarkup}</ul>${banners.join('')}</header><ol class="ml-msgs" aria-label="${countOf(msgCount, 'message')}">${messageList}</ol>${replyable ? `<div class="ml-replybar" data-ml-replybar><button type="button" class="btn btn-outline-secondary btn-sm" data-ml-reply-open="reply" aria-keyshortcuts="R"><i class="bi bi-reply me-1" aria-hidden="true"></i>Reply</button>${everyoneOn(convo).length > 1 ? '<button type="button" class="btn btn-outline-secondary btn-sm" data-ml-reply-open="all" aria-keyshortcuts="A"><i class="bi bi-reply-all me-1" aria-hidden="true"></i>Reply all</button>' : ''}<button type="button" class="btn btn-outline-secondary btn-sm" data-ml-reply-open="forward" aria-keyshortcuts="F"><i class="bi bi-forward me-1" aria-hidden="true"></i>Forward</button></div><div class="ml-reply-slot" data-ml-reply-slot></div>` : ''}</div></article>`;
		if (window.Basalt.avatars) window.Basalt.avatars(dom.reader);
		if (window.Basalt.tips) window.Basalt.tips(dom.reader);
		if (window.Basalt.menus) window.Basalt.menus(dom.reader);
		/* If you were writing a reply here, the box comes back with it. */
		if (mailbox.replyFor === convo.id && replyable) dockReplyBox();
	}

	/* A scheduled message, read-only until you choose to edit it. */
	function drawScheduled(queued) {
		stowReplyBox();
		const subjectId = `ml-subj-${queued.id}`;
		dom.reader.innerHTML = `<article class="ml-read" aria-labelledby="${subjectId}"><div class="ml-read-bar">${backButton()}<div class="ml-read-tools"><button type="button" class="btn btn-sm btn-outline-secondary" data-ml-sched-edit="${htmlSafe(queued.id)}"><i class="bi bi-pencil me-1" aria-hidden="true"></i>Edit</button><button type="button" class="btn btn-sm btn-outline-secondary ml-danger-btn" data-ml-sched-cancel="${htmlSafe(queued.id)}"><i class="bi bi-x-circle me-1" aria-hidden="true"></i>Cancel send</button></div>${stepperMarkup()}</div><div class="ml-read-scroll"><header class="ml-read-head"><div class="ml-read-title"><h2 class="ml-read-subject" id="${subjectId}" tabindex="-1">${htmlSafe(queued.subject || '(no subject)')}</h2></div><p class="ml-note ml-note-sched"><i class="bi bi-clock-history" aria-hidden="true"></i>Sends ${htmlSafe(laterLabel(queued.sendAt))}. Editing it takes it off the schedule until you send or schedule it again.</p></header><ol class="ml-msgs"><li class="ml-msg"><div class="ml-msg-head"><span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="John Armstrong" aria-hidden="true"></span><div class="ml-msg-who"><p class="ml-msg-from"><span class="ml-msg-name">John Armstrong (me)</span><span class="ml-msg-email">${htmlSafe(queued.from || contactFor(mailbox.me).email)}</span></p><p class="ml-msg-to">to ${htmlSafe(queued.to.map((address) => contactFor(address).name).join(', '))}${queued.cc.length ? `, cc ${htmlSafe(queued.cc.map((address) => contactFor(address).name).join(', '))}` : ''}</p></div></div><div class="ml-msg-body">${tidyHtml(queued.html)}</div></li></ol></div></article>`;
		if (window.Basalt.avatars) window.Basalt.avatars(dom.reader);
	}

	/* One message, full or folded to a single line. */
	function messageMarkup(convo, msgItem, pos, folded) {
		const person = contactFor(msgItem.from);
		const toText = (msgItem.to || [])
			.map((recipient) => (isSelf(recipient) ? 'me' : contactFor(recipient).name))
			.join(', ');
		const ccNames = (msgItem.cc || [])
			.map((recipient) => (isSelf(recipient) ? 'me' : contactFor(recipient).name))
			.join(', ');
		const bodyHtml = msgItem.html ? msgItem.html : paragraphsFrom(msgItem.text);
		const fileItems = (msgItem.files || [])
			.map((attachedFile) => {
				const look = fileLook(attachedFile.name);
				return `<li class="ml-file"><span class="ml-file-ico ml-g-${look.tone}" aria-hidden="true"><i class="bi ${look.icon}"></i></span><span class="ml-file-text"><span class="ml-file-name">${htmlSafe(attachedFile.name)}</span><span class="ml-file-size">${sizeText(attachedFile.size)}</span></span><button type="button" class="btn btn-icon btn-sm" aria-label="Download ${htmlSafe(attachedFile.name)}" data-ml-download="${htmlSafe(msgItem.id)}" data-ml-file="${htmlSafe(attachedFile.name)}"><i class="bi bi-download" aria-hidden="true"></i></button></li>`;
			})
			.join('');
		const headingId = `ml-msg-${msgItem.id}`;
		if (folded) {
			return `<li class="ml-msg is-collapsed${msgItem.unread ? ' is-unread' : ''}"><button type="button" class="ml-msg-fold" data-ml-expand="${htmlSafe(msgItem.id)}" aria-expanded="false"><span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(person.name)}" aria-hidden="true"></span><span class="ml-msg-fold-main"><span class="ml-msg-name">${htmlSafe(isSelf(msgItem.from) ? 'John Armstrong (me)' : person.name)}</span><span class="ml-msg-snip">${htmlSafe(previewText(msgItem))}</span></span><span class="ml-msg-time">${htmlSafe(rowTime(msgItem.at))}</span></button></li>`;
		}
		return `<li class="ml-msg${msgItem.pending ? ' is-pending' : ''}"><div class="ml-msg-head"><span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(person.name)}" aria-hidden="true"></span><div class="ml-msg-who"><p class="ml-msg-from" id="${headingId}">${isSelf(msgItem.from) ? '<span class="ml-msg-name">John Armstrong (me)</span>' : `<button type="button" class="ml-msg-name ml-msg-name-btn" data-ml-person="${htmlSafe(person.id)}" aria-label="${htmlSafe(person.name)}, show details">${htmlSafe(person.name)}</button>`}<span class="ml-msg-email">${htmlSafe(person.email)}</span>${person.kind === 'customer' && accountById(person.account) ? `<span class="ml-chip ml-chip-org">${htmlSafe(accountById(person.account).name)}</span>` : ''}</p><p class="ml-msg-to"><span>to ${htmlSafe(toText || 'me')}${ccNames ? `, cc ${htmlSafe(ccNames)}` : ''}</span><span class="ml-msg-time">${msgItem.pending ? '<span class="ml-msg-sending"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>Sending</span>' : `<time datetime="${htmlSafe(msgItem.at.replace(' ', 'T'))}" title="${htmlSafe(fullDate(msgItem.at))}">${htmlSafe(messageTime(msgItem.at))}</time>`}</span></p></div>${msgItem.pending ? '' : `<div class="dropdown ml-msg-more"><button type="button" class="btn btn-icon btn-sm" data-bs-toggle="dropdown" aria-expanded="false" aria-label="More for this message"><i class="bi bi-three-dots-vertical" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end"><li><button type="button" class="dropdown-item" data-ml-msg-reply="reply" data-ml-msg="${htmlSafe(msgItem.id)}"><i class="bi bi-reply" aria-hidden="true"></i>Reply</button></li><li><button type="button" class="dropdown-item" data-ml-msg-reply="all" data-ml-msg="${htmlSafe(msgItem.id)}"><i class="bi bi-reply-all" aria-hidden="true"></i>Reply all</button></li><li><button type="button" class="dropdown-item" data-ml-msg-reply="forward" data-ml-msg="${htmlSafe(msgItem.id)}"><i class="bi bi-forward" aria-hidden="true"></i>Forward</button></li><li><hr class="dropdown-divider"></li><li><button type="button" class="dropdown-item" data-ml-copy-email="${htmlSafe(person.email)}"><i class="bi bi-copy" aria-hidden="true"></i>Copy ${htmlSafe(person.email)}</button></li>${pos > 0 || convo.messages.length > 1 ? `<li><button type="button" class="dropdown-item" data-ml-msg-unread="${htmlSafe(msgItem.id)}"><i class="bi bi-envelope" aria-hidden="true"></i>Mark unread from here</button></li>` : ''}</ul></div>`}</div><div class="ml-msg-body">${bodyHtml}</div>${fileItems ? `<div class="ml-msg-files"><p class="ml-msg-files-title">${countOf(msgItem.files.length, 'attachment')}</p><ul class="ml-files ml-files-read">${fileItems}</ul></div>` : ''}</li>`;
	}

	function toolButton(verb, glyph, labelText, attrs) {
		return `<button type="button" class="btn btn-icon btn-sm" data-ml-act="${verb}" aria-label="${htmlSafe(labelText)}" data-bs-toggle="tooltip" data-bs-title="${htmlSafe(labelText)}"${attrs || ''}><i class="bi ${glyph}" aria-hidden="true"></i></button>`;
	}

	/* The snooze choices from now: later today (before 4 pm), tomorrow, Monday and a week out, without repeats. */
	function snoozeChoices() {
		const rightNow = clockNow();
		function atHour(day, hour, minute) {
			const moment = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute || 0);
			return moment;
		}
		const result = [];
		if (rightNow.getHours() < 16) result.push({ id: 'later', name: 'Later today', at: atHour(rightNow, 17) });
		const tomorrow = new Date(rightNow);
		tomorrow.setDate(rightNow.getDate() + 1);
		result.push({ id: 'tomorrow', name: 'Tomorrow', at: atHour(tomorrow, 8) });
		const nextMonday = new Date(rightNow);
		nextMonday.setDate(rightNow.getDate() + ((8 - rightNow.getDay()) % 7 || 7));
		result.push({ id: 'monday', name: WEEKDAY_NAMES[1], at: atHour(nextMonday, 8) });
		const nextWeek = new Date(rightNow);
		nextWeek.setDate(rightNow.getDate() + 7);
		result.push({ id: 'week', name: 'In a week', at: atHour(nextWeek, 8) });
		const seenTimes = new Set();
		return result.filter((preset) => {
			const stampMs = preset.at.getTime();
			if (seenTimes.has(stampMs)) return false;
			seenTimes.add(stampMs);
			return true;
		});
	}

	function stepperMarkup() {
		const pos = mailbox.shown.indexOf(mailbox.current);
		return `<div class="ml-read-nav">${pos > -1 ? `<span class="ml-read-pos">${pos + 1} of ${mailbox.shown.length}</span>` : ''}<button type="button" class="btn btn-icon btn-sm" data-ml-step="-1" aria-label="Newer conversation" aria-keyshortcuts="K"${pos <= 0 ? ' disabled' : ''}><i class="bi bi-chevron-up" aria-hidden="true"></i></button><button type="button" class="btn btn-icon btn-sm" data-ml-step="1" aria-label="Older conversation" aria-keyshortcuts="J"${pos < 0 || pos >= mailbox.shown.length - 1 ? ' disabled' : ''}><i class="bi bi-chevron-down" aria-hidden="true"></i></button></div>`;
	}

	function backButton() {
		return `<button type="button" class="btn btn-icon btn-sm ml-read-back" data-ml-back aria-label="Back to ${htmlSafe(titleOf(mailbox.folder))}" aria-keyshortcuts="U"><i class="bi bi-arrow-left" aria-hidden="true"></i></button>`;
	}

	/* Brings the reply box back to its hiding place before the reader is redrawn. */
	function stowReplyBox() {
		if (dom.reply.parentElement !== dom.holder) dom.holder.appendChild(dom.reply);
	}

	function drawReaderIdle() {
		stowReplyBox();
		const listed = mailbox.shown.length;
		dom.reader.innerHTML = `<div class="ml-read ml-read-none"><div class="basalt-empty basalt-empty-compact ml-empty"><span class="ml-empty-icon" aria-hidden="true"><i class="bi bi-envelope-paper"></i></span><h2 class="basalt-empty-title">${mailbox.loading || mailbox.error ? 'Waiting for your mail' : listed ? 'Pick a conversation' : 'Nothing to read here'}</h2><p class="basalt-empty-text">${mailbox.loading || mailbox.error ? 'Conversations open here once the mailbox loads.' : listed ? 'Use <kbd>J</kbd> and <kbd>K</kbd> to move through the list, <kbd>Enter</kbd> to open.' : 'Pick another folder, or write something new.'}</p></div></div>`;
	}

	function drawReaderLoading() {
		stowReplyBox();
		dom.reader.innerHTML = `<div class="ml-read" aria-hidden="true"><div class="ml-read-scroll"><div class="ml-read-head"><span class="basalt-skeleton basalt-skeleton-title ml-skel-title"></span></div><div class="ml-msg"><div class="ml-msg-head"><span class="basalt-skeleton basalt-skeleton-circle ml-skel-av"></span><span class="ml-skel-lines"><span class="basalt-skeleton basalt-skeleton-text ml-skel-a"></span><span class="basalt-skeleton basalt-skeleton-text ml-skel-c"></span></span></div><span class="basalt-skeleton basalt-skeleton-text"></span><span class="basalt-skeleton basalt-skeleton-text"></span><span class="basalt-skeleton basalt-skeleton-text ml-skel-b"></span></div></div></div>`;
	}

	/* One pane shows the list or the conversation, never both. */
	function isSinglePane() {
		return narrowQuery.matches;
	}

	function layoutPanes() {
		const covering = mailbox.reading && !!mailbox.current && isSinglePane();
		dom.app.setAttribute('data-view', covering ? 'read' : 'list');
		dom.list.inert = covering;
		dom.reader.inert = isSinglePane() && !covering;
	}

	/* Below 992px the rail is a drawer; it closes once you have picked something. */
	function closeRailDrawer() {
		const railDrawer = window.bootstrap && bootstrap.Offcanvas.getInstance(dom.rail);
		if (railDrawer && dom.rail.classList.contains('show')) railDrawer.hide();
	}

	/* Crossing the breakpoint re-lays the panes, and two panes always open something. */
	function onBreakpoint() {
		layoutPanes();
		if (!isSinglePane()) closeRailDrawer();
		if (!isSinglePane() && !mailbox.current && mailbox.shown.length && rowKindFor(mailbox.folder) === 'thread')
			openRow(mailbox.shown[0], { focus: false, noRead: true });
	}

	/* The Dark mode switch in the workspace menu mirrors the theme. */
	function reflectTheme() {
		return dom.themeItem.setAttribute('aria-pressed', String(window.Basalt.getTheme() === 'dark'));
	}

	/* Switches folders. Search and filters reset unless keepSearch says
     otherwise; with two panes the first conversation opens too. */
	function goToFolder(folderId, settings) {
		mailbox.folder = folderId;
		mailbox.page = 1;
		mailbox.selected.clear();
		mailbox.current = null;
		mailbox.cursor = null;
		mailbox.reading = false;
		if (!(settings && settings.keepSearch)) {
			mailbox.query = '';
			dom.search.value = '';
			mailbox.filters = blankFilters();
			syncFilterForm();
		}
		drawEverything();
		/* Two panes behave like a desktop mail app and open the first conversation. */
		if (
			!isSinglePane() &&
			rowKindFor(folderId) === 'thread' &&
			mailbox.shown.length &&
			!(settings && settings.noOpen)
		)
			openRow(mailbox.shown[0], { focus: false, noRead: true });
		closeRailDrawer();
		announce(`${titleOf(folderId)}. ${dom.sub.textContent}`);
	}

	/**
	 * Opens a conversation, draft or scheduled message by id. With
	 * settings.focus false, focus stays put; settings.noRead leaves it
	 * unread for a moment, for conversations opened on your behalf.
	 */
	function openRow(rowId, settings = {}) {
		if (rowKindFor(mailbox.folder) === 'draft' || draftById(rowId)) {
			openComposer({ draftId: rowId });
			return;
		}
		if (mailbox.replyFor && mailbox.replyFor !== rowId) stashReply();
		mailbox.current = rowId;
		mailbox.cursor = rowId;
		mailbox.reading = true;
		const convo = threadById(rowId);
		clearTimeout(autoReadTimer);
		if (convo && !settings.noRead && hasUnread(convo)) setReadState([rowId], true, { quiet: true });
		/* Opened on your behalf, it counts as read after a moment on screen. */
		else if (convo && settings.noRead && hasUnread(convo)) {
			autoReadTimer = setTimeout(() => {
				if (mailbox.current !== rowId || !hasUnread(convo)) return;
				setReadState([rowId], true, { quiet: true });
				drawRail();
				drawList();
				withScrollKept(() => drawReader());
			}, 2500);
		}
		/* Turn to the page that holds it. */
		const pos = mailbox.shown.indexOf(rowId);
		if (pos > -1) mailbox.page = Math.floor(pos / ROWS_PER_PAGE) + 1;
		drawList();
		drawReader();
		drawRail();
		if (settings.focus !== false) {
			const heading = pick('.ml-read-subject', dom.reader);
			if (heading && isSinglePane()) heading.focus({ preventScroll: true });
		}
		const rowNode = pick(`[data-ml-row="${selectorSafe(rowId)}"]`, dom.rows);
		if (rowNode) rowNode.scrollIntoView({ block: 'nearest', behavior: prefersStill() ? 'auto' : 'smooth' });
		const scroller = pick('[data-ml-read-scroll]', dom.reader);
		if (scroller) scroller.scrollTop = 0;
	}

	function selectorSafe(rowId) {
		return window.CSS && CSS.escape ? CSS.escape(rowId) : rowId;
	}

	/* J and K: the next or previous row, opened in place or, on one pane, just focused. */
	function stepBy(delta, settings) {
		if (!mailbox.shown.length) return;
		const origin = mailbox.current && mailbox.shown.includes(mailbox.current) ? mailbox.current : mailbox.cursor;
		let pos = mailbox.shown.indexOf(origin);
		pos = pos < 0 ? 0 : Math.min(mailbox.shown.length - 1, Math.max(0, pos + delta));
		const rowId = mailbox.shown[pos];
		/* The one-pane list moves a cursor and waits for Enter. */
		if (
			(isSinglePane() && !mailbox.reading && !(settings && settings.open)) ||
			rowKindFor(mailbox.folder) === 'draft'
		) {
			mailbox.cursor = rowId;
			const targetPage = Math.floor(pos / ROWS_PER_PAGE) + 1;
			if (targetPage !== mailbox.page) {
				mailbox.page = targetPage;
				drawList();
			}

			for (const button of pickAll('.ml-row-open', dom.rows)) {
				button.setAttribute('tabindex', button.getAttribute('data-ml-open') === rowId ? '0' : '-1');
			}

			const button = pick(`[data-ml-open="${selectorSafe(rowId)}"]`, dom.rows);
			if (button) button.focus();
			return;
		}
		openRow(rowId, { focus: false });
		const button = pick(`[data-ml-open="${selectorSafe(rowId)}"]`, dom.rows);
		if (button && dom.list.contains(document.activeElement)) button.focus();
	}

	function returnToList() {
		mailbox.reading = false;
		layoutPanes();
		const button =
			pick(`[data-ml-open="${selectorSafe(mailbox.current || mailbox.cursor || '')}"]`, dom.rows) ||
			pick('.ml-row-open', dom.rows);
		if (button) button.focus();
	}

	/* When conversations leave the list, the reader moves on to a neighbor. */
	function moveOnFrom(idList, listedBefore) {
		if (!mailbox.current || !idList.includes(mailbox.current)) {
			drawEverything();
			return;
		}
		const openIndex = listedBefore.indexOf(mailbox.current);
		const survivors = listedBefore.filter((rowId) => !idList.includes(rowId) && mailbox.shown.includes(rowId));
		drawList();
		const neighborId = survivors.length
			? listedBefore.slice(openIndex + 1).find((rowId) => survivors.includes(rowId)) ||
				survivors[survivors.length - 1]
			: null;
		if (neighborId && !isSinglePane()) openRow(neighborId, { focus: false });
		else {
			mailbox.current = null;
			mailbox.reading = false;
			drawEverything();
			if (isSinglePane()) returnToList();
		}
	}

	/* Redraws the reader without losing its scroll position. */
	function withScrollKept(redraw) {
		const scroller = pick('[data-ml-read-scroll]', dom.reader);
		const savedTop = scroller ? scroller.scrollTop : 0;
		redraw();
		const scrollerAfter = pick('[data-ml-read-scroll]', dom.reader);
		if (scrollerAfter) scrollerAfter.scrollTop = savedTop;
	}

	/* Opening folded messages redraws the reader, so the new list of
     messages eases from the height the old one had. */
	function unfoldMessages() {
		const fromHeight = pick('.ml-msgs', dom.reader)?.getBoundingClientRect().height;
		withScrollKept(() => drawReader());
		const list = pick('.ml-msgs', dom.reader);
		if (!list || !fromHeight || prefersStill()) return;
		list.animate(
			[
				{ height: `${fromHeight}px`, overflow: 'hidden' },
				{ height: `${list.getBoundingClientRect().height}px`, overflow: 'hidden' },
			],
			{ duration: 260, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
		);
	}

	function focusMessage(rowId) {
		const heading = document.getElementById(`ml-msg-${rowId}`);
		if (heading) {
			const messageEl = heading.closest('.ml-msg');
			messageEl.setAttribute('tabindex', '-1');
			messageEl.focus({ preventScroll: false });
		}
	}

	/**
	 * Sends an api call and, if it fails, runs rollback, redraws and says
	 * what could not be done.
	 */
	function attempt(request, failedTask, undoLocal) {
		return request.catch(() => {
			if (undoLocal) undoLocal();
			drawEverything();
			notify({
				tone: 'danger',
				title: `Could not ${failedTask}`,
				text: 'Nothing was changed. Try again in a moment.',
			});
			announce(`Could not ${failedTask}. Nothing was changed.`);
		});
	}

	/* Read or unread; settings.fromMsg marks unread from that message on, settings.quiet skips the redraw. */
	function setReadState(idList, asRead, settings) {
		const unreadBefore = idList.map((rowId) => [
			rowId,
			threadById(rowId).messages.map((msgItem) => !!msgItem.unread),
		]);
		for (const rowId of idList) {
			const convo = threadById(rowId);
			if (asRead) {
				for (const msgItem of convo.messages) msgItem.unread = false;
			} else if (settings && settings.fromMsg) {
				let isOn = false;
				for (const msgItem of convo.messages) {
					if (msgItem.id === settings.fromMsg) isOn = true;
					if (isOn) msgItem.unread = true;
				}
			} else latestMessage(convo).unread = true;
		}
		if (!(settings && settings.quiet)) {
			drawEverything();
			announce(`${countOf(idList.length, 'conversation')} marked as ${asRead ? 'read' : 'unread'}.`);
		}
		attempt(
			api.markRead(idList, asRead),
			`mark ${idList.length > 1 ? 'them' : 'it'} as ${asRead ? 'read' : 'unread'}`,
			() => {
				for (const [rowId, unreadFlags] of unreadBefore) {
					for (const [pos, msgItem] of threadById(rowId).messages.entries())
						msgItem.unread = unreadFlags[pos];
				}
			},
		);
	}

	function flipStar(rowId) {
		const convo = threadById(rowId);
		if (!convo) return;
		convo.starred = !convo.starred;
		drawEverything();
		announce(convo.starred ? 'Starred.' : 'Star removed.');
		attempt(api.star(rowId, convo.starred), convo.starred ? 'add the star' : 'remove the star', () => {
			convo.starred = !convo.starred;
		});
	}

	function flipImportant(rowId) {
		const convo = threadById(rowId);
		convo.important = !convo.important;
		drawEverything();
		announce(convo.important ? 'Marked as important.' : 'Marked as not important.');
		attempt(api.setImportant(rowId, convo.important), 'change that', () => {
			convo.important = !convo.important;
		});
	}

	/* Moves conversations to a box with Undo. Any move wakes a snoozed one. */
	function relocate(idList, place) {
		idList = idList.filter((rowId) => threadById(rowId));
		if (!idList.length) return;
		const listedBefore = mailbox.shown.slice();
		const snapshotBefore = idList.map((rowId) => {
			const convo = threadById(rowId);
			return [rowId, convo.box, convo.snoozeUntil || null];
		});
		for (const rowId of idList) {
			const convo = threadById(rowId);
			convo.box = place;
			convo.snoozeUntil = null;
			mailbox.selected.delete(rowId);
		}
		moveOnFrom(idList, listedBefore);
		const copyPair = MOVE_COPY[place];
		const subjectText =
			idList.length === 1 ? `“${threadById(idList[0]).subject}”` : countOf(idList.length, 'conversation');

		function putBack() {
			for (const [rowId, oldBox, oldSnooze] of snapshotBefore) {
				const convo = threadById(rowId);
				if (convo) {
					convo.box = oldBox;
					convo.snoozeUntil = oldSnooze;
				}
			}
		}

		notify({
			tone: 'success',
			icon:
				place === 'trash'
					? 'bi-trash3'
					: place === 'spam'
						? 'bi-exclamation-octagon'
						: place === 'archive'
							? 'bi-archive'
							: 'bi-inbox',
			title: copyPair[0],
			text: subjectText,
			duration: 7000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						putBack();
						drawEverything();
						announce(`Undone. ${subjectText} is back.`);
						const restored = Promise.all(
							snapshotBefore.map(([rowId, oldBox, oldSnooze]) =>
								oldSnooze ? api.snooze([rowId], oldSnooze) : api.move([rowId], oldBox),
							),
						);
						attempt(restored, `put ${idList.length > 1 ? 'them' : 'it'} back`, () => {
							for (const rowId of idList) {
								const convo = threadById(rowId);
								if (convo) {
									convo.box = place;
									convo.snoozeUntil = null;
								}
							}
						});
					},
				},
			],
		});
		announce(`${copyPair[0]}: ${subjectText}. Undo is in the notification.`);
		attempt(api.move(idList, place), copyPair[1], putBack);
	}

	/* Snoozes until a time, or wakes them now when until is null. */
	function putOff(idList, wakeAt) {
		idList = idList.filter((rowId) => threadById(rowId));
		if (!idList.length) return;
		const listedBefore = mailbox.shown.slice();
		const snapshotBefore = idList.map((rowId) => [
			rowId,
			threadById(rowId).snoozeUntil || null,
			threadById(rowId).box,
		]);
		for (const rowId of idList) {
			const convo = threadById(rowId);
			convo.snoozeUntil = wakeAt;
			if (convo.box !== 'inbox' && wakeAt) convo.box = 'inbox';
			mailbox.selected.delete(rowId);
		}

		function putBack() {
			for (const [rowId, oldSnooze, oldBox] of snapshotBefore) {
				const convo = threadById(rowId);
				if (convo) {
					convo.snoozeUntil = oldSnooze;
					convo.box = oldBox;
				}
			}
		}

		const subjectText =
			idList.length === 1 ? `“${threadById(idList[0]).subject}”` : countOf(idList.length, 'conversation');
		if (wakeAt) {
			moveOnFrom(idList, listedBefore);
			notify({
				tone: 'success',
				icon: 'bi-alarm',
				title: `Snoozed until ${laterLabel(wakeAt)}`,
				text: subjectText,
				duration: 7000,
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							putBack();
							drawEverything();
							announce(`Undone. ${subjectText} is back.`);
							attempt(api.snooze(idList, null), 'unsnooze it');
						},
					},
				],
			});
			announce(`Snoozed until ${laterLabel(wakeAt)}. Undo is in the notification.`);
		} else {
			moveOnFrom(idList, listedBefore);
			notify({ tone: 'success', icon: 'bi-inbox', title: 'Back in the inbox', text: subjectText });
			announce(`${subjectText} is back in the inbox.`);
		}
		attempt(api.snooze(idList, wakeAt), wakeAt ? 'snooze it' : 'unsnooze it', putBack);
	}

	/* Adds or removes one label on conversations. */
	function applyLabel(idList, tagId, isOn) {
		const snapshotBefore = idList.map((rowId) => [rowId, threadById(rowId).labels.slice()]);
		for (const rowId of idList) {
			const convo = threadById(rowId);
			if (isOn && !convo.labels.includes(tagId)) convo.labels.push(tagId);
			if (!isOn) convo.labels = convo.labels.filter((other) => other !== tagId);
		}
		const labelEntry = labelById(tagId);
		/* Only the list and rail redraw, so an open Labels menu stays open. */
		drawRail();
		drawList();
		const chipList = pick('.ml-read-labels', dom.reader);
		if (chipList && idList.includes(mailbox.current)) {
			const convo = threadById(mailbox.current);
			const retained = pickAll('li', chipList)
				.slice(0, convo.important ? 2 : 1)
				.map((each) => each.outerHTML)
				.join('');
			chipList.innerHTML =
				retained +
				convo.labels
					.map(labelById)
					.filter(Boolean)
					.map(
						(each) =>
							`<li><span class="ml-chip ml-chip-as-x ml-tone-${each.tone}">${htmlSafe(each.name)}<button type="button" class="ml-chip-x" aria-label="Remove label ${htmlSafe(each.name)}" data-ml-unlabel="${htmlSafe(each.id)}"><i class="bi bi-x" aria-hidden="true"></i></button></span></li>`,
					)
					.join('');
			const rowBox = pick(`[data-ml-label-toggle="${selectorSafe(tagId)}"]`, dom.reader);
			if (rowBox) rowBox.checked = isOn;
		}
		announce(isOn ? `Label ${labelEntry.name} added.` : `Label ${labelEntry.name} removed.`);
		attempt(
			api.setLabels(idList, isOn ? [tagId] : [], isOn ? [] : [tagId]),
			`${isOn ? 'add' : 'remove'} the label`,
			() => {
				for (const [rowId, savedLabels] of snapshotBefore) threadById(rowId).labels = savedLabels;
			},
		);
	}

	/* Opens the hold-to-confirm dialog for deleting for good. */
	function askDeleteForever(idList, titleText) {
		doomedIds = idList.slice();
		pick('[data-ml-destroy-title]').textContent =
			titleText ||
			`Delete ${idList.length === 1 ? `“${threadById(idList[0]).subject}”` : countOf(idList.length, 'conversation')} forever?`;
		pick('[data-ml-destroy-text]').textContent = "They're removed from every folder and can't be brought back.";
		bootstrap.Modal.getOrCreateInstance(pick('#ml-destroy-dialog')).show();
	}

	function bindDeleteDialog() {
		pick('[data-ml-destroy-go]').addEventListener('basalt:confirm', () => {
			const idList = doomedIds.slice();
			const listedBefore = mailbox.shown.slice();
			const removedPairs = idList.map((rowId) => [mailbox.threads.indexOf(threadById(rowId)), threadById(rowId)]);
			mailbox.threads = mailbox.threads.filter((convo) => !idList.includes(convo.id));

			for (const rowId of idList) {
				mailbox.selected.delete(rowId);
			}

			setTimeout(() => bootstrap.Modal.getOrCreateInstance(pick('#ml-destroy-dialog')).hide(), 450);
			moveOnFrom(idList, listedBefore);
			notify({
				tone: 'success',
				icon: 'bi-x-octagon',
				title: 'Deleted forever',
				text: countOf(idList.length, 'conversation'),
			});
			announce(`${countOf(idList.length, 'conversation')} deleted forever.`);
			attempt(api.destroy(idList), `delete ${idList.length > 1 ? 'them' : 'it'}`, () => {
				for (const [pos, convo] of removedPairs.sort((left, right) => left[0] - right[0])) {
					mailbox.threads.splice(pos, 0, convo);
				}
			});
		});
	}

	/* A toolbar button acting on everything selected. */
	function runBulk(action) {
		const idList = Array.from(mailbox.selected);
		if (!idList.length) return;
		if (action === 'read' || action === 'unread') {
			setReadState(idList, action === 'read');
			mailbox.selected.clear();
			drawList();
			return;
		}
		if (action === 'snooze') {
			const mondayPreset = snoozeChoices().find((preset) => preset.id === 'monday');
			putOff(idList, writeStamp(mondayPreset.at));
			return;
		}
		if (action === 'destroy') {
			askDeleteForever(idList);
			return;
		}
		if (action === 'inbox' && mailbox.folder === 'snoozed') {
			putOff(idList, null);
			return;
		}
		relocate(idList, action);
	}

	/* A button on the open conversation's toolbar. */
	function runThreadAction(action) {
		const rowId = mailbox.current;
		if (!threadById(rowId)) return;
		const handlers = {
			archive: () => relocate([rowId], 'archive'),
			trash: () => relocate([rowId], 'trash'),
			spam: () => relocate([rowId], 'spam'),
			inbox: () => relocate([rowId], 'inbox'),
			unsnooze: () => putOff([rowId], null),
			unread: () => {
				setReadState([rowId], false);
				leaveIfOnePane();
			},
			read: () => setReadState([rowId], true),
			star: () => flipStar(rowId),
			important: () => flipImportant(rowId),
			destroy: () => askDeleteForever([rowId]),
			link: () => copyOut(`${location.href.split('#')[0]}#${rowId}`, 'Link copied'),
		};
		if (Object.hasOwn(handlers, action)) handlers[action]();
	}

	/* Like most mail apps, marking the open conversation unread returns to the list. */
	function leaveIfOnePane() {
		if (isSinglePane()) returnToList();
	}

	function fetchAttachment(letterId, fileName, downloadControl) {
		const convo = threadById(mailbox.current);
		const msgItem = convo && convo.messages.find((each) => each.id === letterId);
		const attachedFile = msgItem && (msgItem.files || []).find((each) => each.name === fileName);
		if (!attachedFile) return;
		downloadControl.disabled = true;
		announce(`Downloading ${fileName}.`);
		api.download(letterId, attachedFile)
			.then(() => {
				notify({
					tone: 'success',
					icon: 'bi-download',
					title: 'Downloaded',
					text: `${fileName}, ${sizeText(attachedFile.size)}`,
					duration: 4000,
				});
			})
			.catch(() =>
				notify({ tone: 'danger', title: `Could not download ${fileName}`, text: 'Try again in a moment.' }),
			)
			.then(() => {
				downloadControl.disabled = false;
			});
	}

	/* Pulls a message off the schedule and opens it as a draft. */
	function reopenScheduled(rowId) {
		const queued = scheduledById(rowId);
		if (!queued) return;
		mailbox.scheduled = mailbox.scheduled.filter((each) => each.id !== rowId);
		const saved = {
			id: freshId('d'),
			replyTo: queued.replyTo,
			to: queued.to,
			cc: queued.cc,
			bcc: queued.bcc,
			subject: queued.subject,
			html: queued.html,
			files: queued.files || [],
			from: queued.from,
			updated: writeStamp(clockNow()),
		};
		mailbox.drafts.unshift(saved);
		mailbox.current = null;
		drawEverything();
		openComposer({ draftId: saved.id });
		announce('Taken off the schedule while you edit it.');
		attempt(api.cancelScheduled(rowId), 'take it off the schedule', () => {
			mailbox.scheduled.push(queued);
			mailbox.drafts = mailbox.drafts.filter((each) => each.id !== saved.id);
		});
	}

	/* Calls off a scheduled send; the message waits in Drafts. */
	function unschedule(rowId) {
		const queued = scheduledById(rowId);
		if (!queued) return;
		const listedBefore = mailbox.shown.slice();
		mailbox.scheduled = mailbox.scheduled.filter((each) => each.id !== rowId);
		const saved = {
			id: freshId('d'),
			replyTo: queued.replyTo,
			to: queued.to,
			cc: queued.cc,
			bcc: queued.bcc,
			subject: queued.subject,
			html: queued.html,
			files: queued.files || [],
			from: queued.from,
			updated: writeStamp(clockNow()),
		};
		mailbox.drafts.unshift(saved);
		moveOnFrom([rowId], listedBefore);
		notify({
			tone: 'success',
			icon: 'bi-x-circle',
			title: 'Send canceled',
			text: "It's in Drafts now.",
			duration: 7000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						mailbox.drafts = mailbox.drafts.filter((each) => each.id !== saved.id);
						mailbox.scheduled.push(queued);
						drawEverything();
						attempt(api.schedule(queued), 'schedule it again');
					},
				},
			],
		});
		announce('Send canceled. The message is in Drafts.');
		attempt(api.cancelScheduled(rowId), 'cancel the send', () => {
			mailbox.scheduled.push(queued);
			mailbox.drafts = mailbox.drafts.filter((each) => each.id !== saved.id);
		});
	}

	function copyOut(clipText, doneTitle) {
		const inFlight = window.Basalt.copyText
			? window.Basalt.copyText(clipText)
			: navigator.clipboard.writeText(clipText);
		Promise.resolve(inFlight)
			.then(() => {
				notify({
					tone: 'success',
					icon: 'bi-clipboard-check',
					title: doneTitle,
					text: clipText,
					duration: 3000,
				});
				announce(`${doneTitle}.`);
			})
			.catch(() =>
				notify({ tone: 'danger', title: 'Could not copy', text: 'Your browser blocked the clipboard.' }),
			);
	}

	/* The side sheet for a sender: contact, their account and recent mail. */
	function showPerson(personRef) {
		const person = contactFor(personRef);
		sheetPerson = person;
		const avatar = pick('[data-ml-p="avatar"]', personPanel);
		avatar.setAttribute('data-name', person.name);
		if (window.Basalt.avatar) window.Basalt.avatar(avatar);
		pick('[data-ml-p="name"]', personPanel).textContent = person.name;
		pick('[data-ml-p="sub"]', personPanel).textContent = [person.title, person.org].filter(Boolean).join(', ');
		const customerRecord = accountById(person.account);
		const PRESENCE_WORDS = { online: 'Online now', away: 'Away', busy: 'In a meeting', offline: 'Offline' };
		let htmlOut = `<section class="ml-p-sec"><h3 class="ml-p-title">Contact</h3><dl class="ml-p-dl"><div><dt>Email</dt><dd><span class="ml-p-email">${htmlSafe(person.email)}</span><button type="button" class="btn btn-icon btn-sm" data-basalt-copy="${htmlSafe(person.email)}" aria-label="Copy ${htmlSafe(person.email)}" data-bs-toggle="tooltip" data-bs-title="Copy" data-basalt-copy-done="Copied"><i class="bi bi-copy" aria-hidden="true"></i></button></dd></div>${person.presence ? `<div><dt>Status</dt><dd><span class="basalt-avatar-status ml-p-dot"><span class="basalt-avatar-status-dot basalt-avatar-status-dot-${person.presence}"></span></span>${PRESENCE_WORDS[person.presence]}</dd></div>` : ''}${person.kind === 'system' ? '<div><dt>Sender</dt><dd>Sent automatically by Fieldline</dd></div>' : ''}</dl></section>`;
		if (customerRecord) {
			const ownerName = customerRecord.owner ? contactFor(customerRecord.owner).name : 'No owner';
			const healthBadge = {
				good: ['Healthy', 'success'],
				watch: ['Keep an eye on', 'warning'],
				risk: ['At risk', 'danger'],
				trial: ['On trial', 'info'],
			}[customerRecord.health];
			const renewal = customerRecord.renews ? readStamp(customerRecord.renews) : null;
			const daysLeft = renewal ? dayGap(renewal, clockNow()) : null;
			htmlOut += `<section class="ml-p-sec"><h3 class="ml-p-title">Account</h3><div class="ml-acct"><p class="ml-acct-name">${htmlSafe(customerRecord.name)}<span class="ml-health ml-health-${healthBadge[1]}">${healthBadge[0]}</span></p><dl class="ml-acct-figs"><div><dt>Plan</dt><dd>${htmlSafe(customerRecord.plan)}</dd></div><div><dt>Seats</dt><dd>${customerRecord.seats}</dd></div><div><dt>${customerRecord.plan === 'Trial' ? 'Trial seats' : 'MRR'}</dt><dd>${customerRecord.plan === 'Trial' ? customerRecord.seats : dollars(customerRecord.mrr)}</dd></div></dl><dl class="ml-p-dl">${renewal ? `<div><dt>Renews</dt><dd>${WEEKDAYS[renewal.getDay()]}, ${MONTH_NAMES[renewal.getMonth()]} ${renewal.getDate()}, ${renewal.getFullYear()}${daysLeft >= 0 && daysLeft <= 30 ? ` <span class="ml-soon">in ${countOf(daysLeft, 'day')}</span>` : ''}</dd></div>` : ''}<div><dt>Region</dt><dd>${htmlSafe(customerRecord.region)}, ${htmlSafe(customerRecord.channel)}</dd></div><div><dt>Owner</dt><dd>${htmlSafe(ownerName)}</dd></div><div><dt>Add-ons</dt><dd>${customerRecord.addons.length ? customerRecord.addons.map(htmlSafe).join(', ') : 'None'}</dd></div></dl><a class="btn btn-sm btn-outline-secondary mt-2" href="company-details.html"><i class="bi bi-building me-1" aria-hidden="true"></i>Open the customer record</a></div></section>`;
		}
		const withThem = mailbox.threads
			.filter(
				(convo) =>
					convo.box !== 'trash' &&
					convo.box !== 'spam' &&
					convo.messages.some((msgItem) =>
						[msgItem.from]
							.concat(msgItem.to || [], msgItem.cc || [])
							.some((recipient) => contactFor(recipient).id === person.id),
					),
			)
			.sort((left, right) => latestTime(right) - latestTime(left))
			.slice(0, 5);
		if (withThem.length) {
			htmlOut += `<section class="ml-p-sec"><h3 class="ml-p-title">Recent conversations</h3><ul class="ml-p-threads">${withThem.map((convo) => `<li><button type="button" class="ml-p-thread" data-ml-p-open="${htmlSafe(convo.id)}"><span class="ml-p-thread-subj">${htmlSafe(convo.subject)}</span><span class="ml-p-thread-when">${htmlSafe(rowTime(latestMessage(convo).at))} · ${htmlSafe(whereItLives(convo))}</span></button></li>`).join('')}</ul></section>`;
		}
		pick('[data-ml-p="body"]', personPanel).innerHTML = htmlOut;
		if (window.Basalt.buttons) window.Basalt.buttons(personPanel);
		if (window.Basalt.tips) window.Basalt.tips(personPanel);
		pick('[data-ml-p-write]', personPanel).hidden =
			person.kind === 'system' || person.kind === 'spam' || person.id === mailbox.me;
		bootstrap.Offcanvas.getOrCreateInstance(personPanel).show();
	}

	function bindPersonSheet() {
		personPanel.addEventListener('click', (event) => {
			const sheetLink = event.target.closest('[data-ml-p-open]');
			if (sheetLink) {
				const rowId = sheetLink.getAttribute('data-ml-p-open');
				bootstrap.Offcanvas.getOrCreateInstance(personPanel).hide();
				const convo = threadById(rowId);
				if (convo && !mailbox.shown.includes(rowId))
					goToFolder(
						convo.box === 'archive'
							? 'archive'
							: isSnoozed(convo)
								? 'snoozed'
								: convo.box === 'sent'
									? 'sent'
									: 'inbox',
						{ noOpen: true },
					);
				openRow(rowId);
			}
		});
		pick('[data-ml-p-copy]', personPanel).addEventListener('click', () => {
			if (!sheetPerson) return;
			copyOut(sheetPerson.email, 'Email copied');
		});
		pick('[data-ml-p-write]', personPanel).addEventListener('click', () => {
			if (!sheetPerson) return;
			const address = sheetPerson.email;
			bootstrap.Offcanvas.getOrCreateInstance(personPanel).hide();
			openComposer({ to: [address] });
		});
	}

	/* The people the To, Cc and Bcc fields suggest. */
	function listContacts() {
		dom.peopleList.innerHTML = mailbox.people
			.filter((person) => person.kind !== 'system' && person.kind !== 'spam' && person.id !== mailbox.me)
			.map(
				(person) =>
					`<li data-value="${htmlSafe(person.email)}" data-label="${htmlSafe(person.name)}" data-hint="${htmlSafe(person.email)}">${htmlSafe(person.name)}</li>`,
			)
			.join('');
	}

	/* The tag input and the suggestion box share one text field, and picking
     a suggestion turns into a recipient chip. */
	function bindRecipientField(tagField) {
		const textField = pick('.basalt-tags-input', tagField);
		if (!textField || tagField._mlWired) return;
		tagField._mlWired = true;

		function addChip(address) {
			if (!tagField.basaltTags) return;
			const chipValues = tagField.basaltTags.get();
			if (!chipValues.some((each) => each.toLowerCase() === address.toLowerCase()))
				tagField.basaltTags.set(chipValues.concat(address));
			textField.value = '';
		}

		/* Enter on a highlighted suggestion takes its address before the tag
       input can turn the half-typed text into a chip. */
		tagField.addEventListener(
			'keydown',
			(event) => {
				if (event.target !== textField || event.key !== 'Enter') return;
				const highlightedId = textField.getAttribute('aria-activedescendant');
				const option = highlightedId && document.getElementById(highlightedId);
				if (!option || textField.getAttribute('aria-expanded') !== 'true') return;
				const hintNode = pick('.basalt-select-popup-hint', option);
				const address = hintNode ? hintNode.textContent.trim() : '';
				if (!address) return;
				event.preventDefault();
				event.stopPropagation();
				addChip(address);
				textField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
			},
			true,
		);
		/* Clicking a suggestion fills the field with its address. */
		textField.addEventListener('change', () => {
			const typed = textField.value.trim();
			if (typed && personByEmail(typed)) addChip(typed);
		});
		/* Addresses that cannot be sent to are marked. */
		tagField.addEventListener('change', () => {
			for (const tagChip of pickAll('.basalt-tags-tag', tagField)) {
				const valid = looksLikeEmail(tagChip.getAttribute('data-value'));
				tagChip.classList.toggle('is-bad', !valid);
				const person = personByEmail(tagChip.getAttribute('data-value'));
				tagChip.title = valid ? (person ? person.name : '') : 'Not an email address';
			}
		});
		tagField.addEventListener('basalt:tags-duplicate', () => announce('Already added.'));
	}

	function chipsIn(tagField) {
		return tagField && tagField.basaltTags ? tagField.basaltTags.get() : [];
	}

	/* Whatever is still typed in the field becomes a chip before sending. */
	function flushTyped(tagField) {
		const textField = pick('.basalt-tags-input', tagField);
		if (textField && textField.value.trim() && tagField.basaltTags) {
			const typed = textField.value.trim();
			tagField.basaltTags.set(tagField.basaltTags.get().concat(typed));
			textField.value = '';
		}
	}

	/* Formatting buttons, links and Ctrl+Enter for an .ml-editor. */
	function bindEditor(container, whenSending) {
		const editorField = pick('[contenteditable]', container);

		for (const fmtBtn of pickAll('[data-ml-fmt]', container)) {
			fmtBtn.addEventListener('mousedown', (event) => event.preventDefault());
			fmtBtn.addEventListener('click', () => {
				editorField.focus();
				const command = fmtBtn.getAttribute('data-ml-fmt');
				if (command === 'link') {
					const linkUrl = window.prompt('Link address', 'https://');
					if (linkUrl && /^(https?:|mailto:)/i.test(linkUrl))
						document.execCommand('createLink', false, linkUrl);
				} else document.execCommand(command, false, null);
				reflectFormatting(container);
			});
		}

		editorField.addEventListener('keyup', () => reflectFormatting(container));
		editorField.addEventListener('mouseup', () => reflectFormatting(container));
		editorField.addEventListener('keydown', (event) => {
			if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
				event.preventDefault();
				whenSending();
			}
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault();
				pick('[data-ml-fmt="link"]', container).click();
			}
		});
		/* Pasting brings plain text, so another app's styling stays behind. */
		editorField.addEventListener('paste', (event) => {
			const pasted = event.clipboardData && event.clipboardData.getData('text/plain');
			if (pasted == null) return;
			event.preventDefault();
			document.execCommand('insertText', false, pasted);
		});
	}

	/* Lights the formatting buttons that match the caret. */
	function reflectFormatting(container) {
		for (const command of ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList']) {
			const button = pick(`[data-ml-fmt="${command}"]`, container);
			if (!button) continue;
			let isOn;
			try {
				isOn = document.queryCommandState(command);
			} catch {
				isOn = false;
			}
			button.setAttribute('aria-pressed', String(isOn));
			button.classList.toggle('is-on', isOn);
		}
	}

	function listTemplates(menuEl) {
		menuEl.innerHTML = `<li><h3 class="dropdown-header">Insert a template</h3></li>${mailbox.templates.map((template) => `<li><button type="button" class="dropdown-item" data-ml-template="${htmlSafe(template.id)}"><i class="bi bi-file-earmark-text" aria-hidden="true"></i>${htmlSafe(template.name)}</button></li>`).join('')}`;
	}

	function bindTemplates(menuEl, whenPicked) {
		menuEl.addEventListener('click', (event) => {
			const button = event.target.closest('[data-ml-template]');
			if (button)
				whenPicked(
					mailbox.templates.find((template) => template.id === button.getAttribute('data-ml-template')),
				);
		});
	}

	/* Drops a template into a message, greeting its first recipient. */
	function insertTemplate(editorEl, template, addressees) {
		editorEl.focus();
		const htmlOut = fillTemplate(template, addressees);
		if (isEmptyHtml(editorEl.innerHTML)) editorEl.innerHTML = htmlOut;
		else document.execCommand('insertHTML', false, htmlOut);
		editorEl.dispatchEvent(new Event('input', { bubbles: true }));
		announce(`Template ${template.name} added.`);
	}

	function fillTemplate(template, addressees) {
		const greetName = addressees.length ? contactFor(addressees[0]).name.split(' ')[0] : 'there';
		return template.html.replace(/\{first\}/g, htmlSafe(looksLikeEmail(greetName) ? 'there' : greetName));
	}

	function attachmentList(fileItems) {
		return fileItems
			.map((attachedFile, pos) => {
				const look = fileLook(attachedFile.name);
				return `<li class="ml-file"><span class="ml-file-ico ml-g-${look.tone}" aria-hidden="true"><i class="bi ${look.icon}"></i></span><span class="ml-file-text"><span class="ml-file-name">${htmlSafe(attachedFile.name)}</span><span class="ml-file-size">${sizeText(attachedFile.size)}</span></span><button type="button" class="btn btn-icon btn-sm" aria-label="Remove ${htmlSafe(attachedFile.name)}" data-ml-unattach="${pos}"><i class="bi bi-x-lg" aria-hidden="true"></i></button></li>`;
			})
			.join('');
	}

	function isEmptyHtml(source) {
		return !plainText(source) && !/<(img|li)/i.test(source || '');
	}

	/**
	 * Sends with a few seconds to change your mind. outgoing holds from, to,
	 * cc, bcc, subject, html, files, replyTo and draftId; onDone(canceled)
	 * runs once it is settled.
	 */
	function dispatch(outgoing, onDone) {
		let convo = outgoing.replyTo && threadById(outgoing.replyTo);
		let isNew = false;
		const sentMessage = {
			id: freshId('m'),
			from: mailbox.me,
			to: outgoing.to,
			cc: outgoing.cc,
			at: writeStamp(clockNow()),
			html: tidyHtml(outgoing.html),
			files: outgoing.files,
			pending: true,
		};
		if (convo) convo.messages.push(sentMessage);
		else {
			convo = {
				id: freshId('t'),
				subject: outgoing.subject || '(no subject)',
				box: 'sent',
				category: 'primary',
				labels: [],
				starred: false,
				important: false,
				messages: [sentMessage],
			};
			mailbox.threads.push(convo);
			isNew = true;
		}
		const convoId = convo.id;
		if (mailbox.current === convoId) drawReader();
		drawList();
		drawRail();
		const nameSet = outgoing.to.map((address) => contactFor(address).name).join(', ');
		let canceled = false;
		notify({
			tone: 'info',
			icon: 'bi-send',
			title: `Sending to ${nameSet}`,
			text: 'You have a few seconds to undo.',
			duration: UNDO_WINDOW,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						canceled = true;
					},
				},
			],
			onClose: () => {
				if (canceled) {
					/* Undone: the message comes off the thread and the words go back in front of you. */
					const liveThread = threadById(convoId);
					if (liveThread)
						liveThread.messages = liveThread.messages.filter((each) => each.id !== sentMessage.id);
					if (isNew) mailbox.threads = mailbox.threads.filter((each) => each.id !== convoId);
					drawEverything();
					announce('Sending undone. Your message is open again.');
					if (onDone) onDone(true);
					return;
				}
				api.send(Object.assign({}, outgoing, { id: sentMessage.id }))
					.then(() => {
						sentMessage.pending = false;
						sentMessage.at = writeStamp(clockNow());
						const liveThread = threadById(convoId);
						if (liveThread && liveThread.box === 'trash') liveThread.box = 'inbox';
						drawEverything();
						announce(`Message sent to ${nameSet}.`);
						if (onDone) onDone(false);
					})
					.catch(() => {
						const liveThread = threadById(convoId);
						if (liveThread)
							liveThread.messages = liveThread.messages.filter((each) => each.id !== sentMessage.id);
						if (isNew) mailbox.threads = mailbox.threads.filter((each) => each.id !== convoId);
						mailbox.drafts.unshift({
							id: freshId('d'),
							replyTo: outgoing.replyTo || null,
							to: outgoing.to,
							cc: outgoing.cc,
							bcc: outgoing.bcc,
							subject: outgoing.subject,
							html: outgoing.html,
							files: outgoing.files,
							updated: writeStamp(clockNow()),
						});
						drawEverything();
						notify({
							tone: 'danger',
							title: "Your message wasn't sent",
							text: "The mail server didn't answer. It's saved in Drafts so you can send it again.",
						});
						announce('Your message was not sent. It is saved in Drafts.');
					});
			},
		});
		announce('Sending. Undo is in the notification.');
	}

	/* Everyone on a message except you, once each. */
	function everyoneOn(convo, sourceMsg) {
		const msgItem = sourceMsg || latestMessage(convo);
		const addresses = [msgItem.from]
			.concat(msgItem.to || [], msgItem.cc || [])
			.map((recipient) => contactFor(recipient).email)
			.filter((address) => address !== contactFor(mailbox.me).email);
		return Array.from(new Set(addresses));
	}

	/* Who a reply goes to: the sender, everyone, or nobody yet for a forward. */
	function replyRecipients(convo, replyMode, sourceMsg) {
		const msgItem =
			sourceMsg ||
			convo.messages
				.slice()
				.reverse()
				.find((each) => !isSelf(each.from)) ||
			latestMessage(convo);
		if (replyMode === 'forward') return [];
		if (replyMode === 'all') return everyoneOn(convo, msgItem);
		return isSelf(msgItem.from)
			? (msgItem.to || []).map((recipient) => contactFor(recipient).email)
			: [contactFor(msgItem.from).email];
	}

	/* Docks the reply box under the open conversation and hides the reply bar. */
	function dockReplyBox() {
		const dock = pick('[data-ml-reply-slot]', dom.reader);
		if (!dock) return false;
		dock.appendChild(dom.reply);
		const replyBar = pick('[data-ml-replybar]', dom.reader);
		if (replyBar) replyBar.hidden = true;
		return true;
	}

	/* Reply, reply all or forward: sets the recipients and, to forward, quotes the message and its files. */
	function switchReplyMode(replyMode, convo, sourceMsg) {
		replyBox.mode = replyMode;
		replyBox.modeLabel.textContent = { reply: 'Reply', all: 'Reply all', forward: 'Forward' }[replyMode];
		replyBox.modeIcon.className = `bi ${{ reply: 'bi-reply', all: 'bi-reply-all', forward: 'bi-forward' }[replyMode]}`;
		replyBox.tags.basaltTags.set(replyRecipients(convo, replyMode, sourceMsg));
		if (replyMode === 'forward') {
			const msgItem = sourceMsg || latestMessage(convo);
			const person = contactFor(msgItem.from);
			const quote = `<p><br></p><blockquote><p>Forwarded message from ${htmlSafe(person.name)} &lt;${htmlSafe(person.email)}&gt;, ${htmlSafe(fullDate(msgItem.at))}<br>Subject: ${htmlSafe(convo.subject)}</p>${msgItem.html ? tidyHtml(msgItem.html) : paragraphsFrom(msgItem.text)}</blockquote>`;
			if (isEmptyHtml(replyBox.body.innerHTML) || /^<p><br><\/p><blockquote>/.test(replyBox.body.innerHTML))
				replyBox.body.innerHTML = quote;
			replyBox.attached = (msgItem.files || []).map((attachedFile) => Object.assign({}, attachedFile));
		} else if (/^<p><br><\/p><blockquote>/.test(replyBox.body.innerHTML)) {
			replyBox.body.innerHTML = '';
			replyBox.attached = [];
		}
		replyBox.files.innerHTML = attachmentList(replyBox.attached);
	}

	function startReply(replyMode, sourceId) {
		const convo = threadById(mailbox.current);
		if (!convo || convo.box === 'spam' || convo.box === 'trash') return;
		const sourceMsg = sourceId ? convo.messages.find((msgItem) => msgItem.id === sourceId) : null;
		if (mailbox.replyFor !== convo.id) {
			replyBox.body.innerHTML = replyBox.texts[convo.id] || '';
			replyBox.attached = [];
		}
		mailbox.replyFor = convo.id;
		if (!dockReplyBox()) return;
		switchReplyMode(replyMode, convo, sourceMsg);
		replyBox.note.textContent = '';
		replyBox.form.classList.remove('was-validated');
		replyBox.tags.classList.remove('is-invalid');
		const dock = pick('[data-ml-reply-slot]', dom.reader);
		dock.scrollIntoView({ block: 'nearest', behavior: prefersStill() ? 'auto' : 'smooth' });
		if (replyMode === 'forward') pick('.basalt-tags-input', replyBox.tags).focus();
		else {
			replyBox.body.focus();
			const caretRange = document.createRange();
			caretRange.selectNodeContents(replyBox.body);
			caretRange.collapse(replyMode === 'forward');
			const caretSel = window.getSelection();
			caretSel.removeAllRanges();
			caretSel.addRange(caretRange);
		}
		announce(
			`${{ reply: 'Replying', all: 'Replying to everyone', forward: 'Forwarding' }[replyMode]} to ${convo.subject}.`,
		);
	}

	function stashReply() {
		if (mailbox.replyFor)
			replyBox.texts[mailbox.replyFor] = isEmptyHtml(replyBox.body.innerHTML) ? '' : replyBox.body.innerHTML;
	}

	/* Closes the reply box; discarding keeps an Undo for what was written. */
	function endReply(throwAway) {
		const rowId = mailbox.replyFor;
		if (throwAway && rowId) {
			const written = replyBox.body.innerHTML;
			delete replyBox.texts[rowId];
			replyBox.body.innerHTML = '';
			if (!isEmptyHtml(written)) {
				notify({
					tone: 'success',
					icon: 'bi-trash3',
					title: 'Reply discarded',
					duration: 6000,
					actions: [
						{
							label: 'Undo',
							onClick: () => {
								replyBox.texts[rowId] = written;
								if (mailbox.current === rowId) startReply(replyBox.mode);
							},
						},
					],
				});
			}
		}
		mailbox.replyFor = null;
		stowReplyBox();
		const replyBar = pick('[data-ml-replybar]', dom.reader);
		if (replyBar) {
			replyBar.hidden = false;
			const button = pick('button', replyBar);
			if (button) button.focus();
		}
	}

	function sendReply() {
		const convo = threadById(mailbox.replyFor);
		if (!convo) return;
		flushTyped(replyBox.tags);
		const sendTo = chipsIn(replyBox.tags);
		const invalid = !sendTo.length || sendTo.some((each) => !looksLikeEmail(each));
		replyBox.tags.classList.toggle('is-invalid', invalid);
		pick('#ml-r-to-err').textContent = !sendTo.length
			? 'Add at least one person to send to.'
			: 'Fix the addresses marked in red.';
		pick('#ml-r-to-err').classList.toggle('d-block', invalid);
		if (invalid) {
			pick('.basalt-tags-input', replyBox.tags).focus();
			announce(pick('#ml-r-to-err').textContent.trim());
			return;
		}
		if (isEmptyHtml(replyBox.body.innerHTML)) {
			replyBox.note.textContent = 'Write something first.';
			replyBox.body.focus();
			return;
		}
		const htmlOut = replyBox.body.innerHTML;
		const replyMode = replyBox.mode;
		const outgoing = {
			from: contactFor(mailbox.me).email,
			to: sendTo,
			cc: [],
			bcc: [],
			subject: `${replyMode === 'forward' ? 'Fwd: ' : 'Re: '}${convo.subject.replace(/^(re|fwd):\s*/i, '')}`,
			html: htmlOut,
			files: replyBox.attached.slice(),
			replyTo: replyMode === 'forward' ? null : convo.id,
		};
		const convoId = convo.id;
		delete replyBox.texts[convoId];
		replyBox.body.innerHTML = '';
		replyBox.attached = [];
		replyBox.files.innerHTML = '';
		mailbox.replyFor = null;
		stowReplyBox();
		dispatch(outgoing, (canceled) => {
			if (!canceled) return;
			replyBox.texts[convoId] = htmlOut;
			if (mailbox.current === convoId) {
				drawReader();
				startReply(replyMode);
			}
		});
		drawReader();
	}

	function bindReplyBox() {
		replyBox.form.addEventListener('submit', (event) => {
			event.preventDefault();
			sendReply();
		});

		for (const button of pickAll('[data-ml-r-mode]', replyBox.form)) {
			button.addEventListener('click', () => {
				const convo = threadById(mailbox.replyFor);
				if (convo) switchReplyMode(button.getAttribute('data-ml-r-mode'), convo);
			});
		}

		pick('[data-ml-r-discard]', replyBox.form).addEventListener('click', () => endReply(true));
		pick('[data-ml-r-attach]', replyBox.form).addEventListener('click', () => replyBox.fileInput.click());
		replyBox.fileInput.addEventListener('change', () => {
			for (const attachedFile of Array.from(replyBox.fileInput.files || [])) {
				replyBox.attached.push({ name: attachedFile.name, size: attachedFile.size });
			}

			replyBox.fileInput.value = '';
			replyBox.files.innerHTML = attachmentList(replyBox.attached);
			announce(`${countOf(replyBox.attached.length, 'file')} attached.`);
		});
		replyBox.files.addEventListener('click', (event) => {
			const button = event.target.closest('[data-ml-unattach]');
			if (!button) return;
			const attachedFile = replyBox.attached.splice(+button.getAttribute('data-ml-unattach'), 1)[0];
			replyBox.files.innerHTML = attachmentList(replyBox.attached);
			announce(`${attachedFile.name} removed.`);
		});
		replyBox.form.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && !event.defaultPrevented && !pick('.dropdown-menu.show')) {
				event.preventDefault();
				stashReply();
				endReply(false);
			}
			if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && event.target.closest('.basalt-tags')) {
				event.preventDefault();
				sendReply();
			}
		});
		bindEditor(pick('.ml-editor', replyBox.form), sendReply);
	}

	function composerModal() {
		return bootstrap.Modal.getOrCreateInstance(composerDialog);
	}

	/* Shows the Cc or Bcc row and hides the button that asked for it. */
	function revealRow(rowName, isOn) {
		const rowNode = pick(`[data-ml-c-row="${rowName}"]`, composerDialog);
		rowNode.hidden = !isOn;
		const button = pick(`[data-ml-c-show="${rowName}"]`, composerDialog);
		button.setAttribute('aria-expanded', String(isOn));
		button.hidden = isOn;
	}

	/* Opens the composer blank, prefilled from settings, or on a saved draft. */
	function openComposer(settings = {}) {
		const saved = settings.draftId ? draftById(settings.draftId) : null;
		composer.draftId = saved ? saved.id : null;
		composer.replyTo = saved ? saved.replyTo : settings.replyTo || null;
		composer.title.textContent = saved ? 'Draft' : 'New message';
		composer.from.value = (saved && saved.from) || settings.from || mailbox.sendAs[0].email;
		composer.to.basaltTags.set(saved ? saved.to : settings.to || []);
		composer.cc.basaltTags.set(saved ? saved.cc : []);
		composer.bcc.basaltTags.set(saved ? saved.bcc : []);
		revealRow('cc', !!(saved && saved.cc.length));
		revealRow('bcc', !!(saved && saved.bcc.length));
		composer.subject.value = saved ? saved.subject : settings.subject || '';
		composer.body.innerHTML = saved ? tidyHtml(saved.html) : settings.html || '';
		composer.attached = saved && saved.files ? saved.files.slice() : [];
		composer.files.innerHTML = attachmentList(composer.attached);
		composer.saved.textContent = saved ? `Last saved ${rowTime(saved.updated)}.` : 'Drafts save as you type.';
		composer.sched.hidden = true;
		composer.form.classList.remove('was-validated');
		composer.to.classList.remove('is-invalid');
		composer.dirty = false;
		composer.sending = false;
		composerModal().show();
	}

	function readComposer() {
		flushTyped(composer.to);
		flushTyped(composer.cc);
		flushTyped(composer.bcc);
		return {
			from: composer.from.value,
			to: chipsIn(composer.to),
			cc: chipsIn(composer.cc),
			bcc: chipsIn(composer.bcc),
			subject: composer.subject.value.trim(),
			html: composer.body.innerHTML,
			files: composer.attached.slice(),
			replyTo: composer.replyTo,
		};
	}

	function isComposerEmpty(values) {
		return (
			!values.to.length &&
			!values.cc.length &&
			!values.bcc.length &&
			!values.subject &&
			isEmptyHtml(values.html) &&
			!values.files.length
		);
	}

	/* Keeps the message as a draft, quietly while typing or out loud on close. */
	function keepDraft(silently) {
		clearTimeout(composer.timer);
		const formValues = readComposer();
		if (isComposerEmpty(formValues)) return null;
		let saved = composer.draftId && draftById(composer.draftId);
		const snapshotBefore = saved ? copyDeep(saved) : null;
		if (!saved) {
			saved = { id: freshId('d') };
			mailbox.drafts.unshift(saved);
			composer.draftId = saved.id;
		}
		Object.assign(saved, formValues, { updated: writeStamp(clockNow()) });
		composer.dirty = false;
		if (mailbox.folder === 'drafts') drawList();
		drawRail();
		const rowId = saved.id;
		api.saveDraft(saved)
			.then(() => {
				if (silently && composer.draftId === rowId)
					composer.saved.textContent = `Draft saved at ${clockTime(clockNow())}.`;
			})
			.catch(() => {
				if (snapshotBefore) Object.assign(draftById(rowId) || {}, snapshotBefore);
				if (silently && composer.draftId === rowId)
					composer.saved.textContent = "Couldn't save the draft. It's still here while this window is open.";
			});
		return saved;
	}

	function closeComposer() {
		if (composer.sending) {
			composerModal().hide();
			return;
		}
		const kept = keepDraft(false);
		composer.sending = true;
		composerModal().hide();
		if (kept) {
			notify({
				tone: 'success',
				icon: 'bi-file-earmark-text',
				title: 'Saved to Drafts',
				text: kept.subject || '(no subject)',
				duration: 5000,
				actions: [{ label: 'Open Drafts', ghost: true, onClick: () => goToFolder('drafts') }],
			});
		}
	}

	function discardComposer() {
		const rowId = composer.draftId;
		const saved = rowId && draftById(rowId);
		const copyOf = saved ? copyDeep(saved) : readComposer();
		if (saved) mailbox.drafts = mailbox.drafts.filter((each) => each.id !== rowId);
		composer.dirty = false;
		composer.sending = true;
		composerModal().hide();
		drawEverything();
		if (!isComposerEmpty(copyOf)) {
			notify({
				tone: 'success',
				icon: 'bi-trash3',
				title: 'Draft discarded',
				text: copyOf.subject || '(no subject)',
				duration: 7000,
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							const restored = Object.assign(
								{ id: rowId || freshId('d'), updated: writeStamp(clockNow()) },
								copyOf,
							);
							mailbox.drafts.unshift(restored);
							drawEverything();
							openComposer({ draftId: restored.id });
						},
					},
				],
			});
		}
		if (rowId)
			attempt(api.deleteDraft(rowId), 'discard the draft', () => {
				if (saved) mailbox.drafts.unshift(saved);
			});
	}

	function checkRecipients(formValues) {
		const invalid =
			!formValues.to.length ||
			formValues.to.concat(formValues.cc, formValues.bcc).some((each) => !looksLikeEmail(each));
		composer.to.classList.toggle('is-invalid', invalid);
		const errorNote = pick('[data-ml-c-to-err]', composerDialog);
		errorNote.textContent = !formValues.to.length
			? 'Add at least one person to send to.'
			: 'Fix the addresses marked in red.';
		errorNote.classList.toggle('d-block', invalid);
		if (invalid) {
			pick('.basalt-tags-input', composer.to).focus();
			announce(errorNote.textContent.trim());
		}
		return !invalid;
	}

	function sendFromComposer() {
		const formValues = readComposer();
		if (!checkRecipients(formValues)) return;
		if (!formValues.subject && isEmptyHtml(formValues.html)) {
			composer.saved.textContent = 'Add a subject or a message first.';
			composer.subject.focus();
			return;
		}
		const rowId = composer.draftId;
		const saved = rowId && draftById(rowId);
		if (saved) mailbox.drafts = mailbox.drafts.filter((each) => each.id !== rowId);
		composer.sending = true;
		composerModal().hide();
		drawEverything();
		if (rowId) api.deleteDraft(rowId).catch(() => {});
		dispatch(formValues, (canceled) => {
			if (!canceled) return;
			const restored = Object.assign({ id: rowId || freshId('d'), updated: writeStamp(clockNow()) }, formValues);
			mailbox.drafts.unshift(restored);
			drawEverything();
			openComposer({ draftId: restored.id });
		});
	}

	function sendLater(when) {
		const formValues = readComposer();
		if (!checkRecipients(formValues)) return false;
		const rowId = composer.draftId;
		const saved = rowId && draftById(rowId);
		if (saved) mailbox.drafts = mailbox.drafts.filter((each) => each.id !== rowId);
		const queued = Object.assign({ id: freshId('s'), sendAt: writeStamp(when) }, formValues);
		mailbox.scheduled.push(queued);
		composer.sending = true;
		composerModal().hide();
		drawEverything();
		notify({
			tone: 'success',
			icon: 'bi-clock-history',
			title: `Scheduled for ${laterLabel(queued.sendAt)}`,
			text: queued.subject || '(no subject)',
			duration: 7000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						mailbox.scheduled = mailbox.scheduled.filter((each) => each.id !== queued.id);
						const restored = Object.assign(
							{ id: rowId || freshId('d'), updated: writeStamp(clockNow()) },
							formValues,
						);
						mailbox.drafts.unshift(restored);
						drawEverything();
						openComposer({ draftId: restored.id });
						attempt(api.cancelScheduled(queued.id), 'cancel it');
					},
				},
				{
					label: 'View',
					ghost: true,
					onClick: () => {
						goToFolder('scheduled');
						openRow(queued.id);
					},
				},
			],
		});
		announce(`Scheduled for ${laterLabel(queued.sendAt)}.`);
		attempt(api.schedule(queued), 'schedule it', () => {
			mailbox.scheduled = mailbox.scheduled.filter((each) => each.id !== queued.id);
			mailbox.drafts.unshift(
				Object.assign({ id: rowId || freshId('d'), updated: writeStamp(clockNow()) }, formValues),
			);
		});
		if (rowId) api.deleteDraft(rowId).catch(() => {});
		return true;
	}

	/* Typing schedules a quiet save. */
	function markChanged() {
		composer.dirty = true;
		clearTimeout(composer.timer);
		composer.saved.textContent = 'Saving…';
		composer.timer = setTimeout(() => keepDraft(true), 900);
	}

	function bindComposer() {
		composerDialog.addEventListener('hidden.bs.modal', () => {
			composer.sending = false;
			clearTimeout(composer.timer);
		});
		composerDialog.addEventListener('shown.bs.modal', () => {
			const focusTarget = !composer.to.basaltTags.get().length
				? pick('.basalt-tags-input', composer.to)
				: !composer.subject.value
					? composer.subject
					: composer.body;
			focusTarget.focus();
		});
		composer.form.addEventListener('submit', (event) => {
			event.preventDefault();
			sendFromComposer();
		});
		pick('[data-ml-c-close]', composerDialog).addEventListener('click', closeComposer);
		composerDialog.addEventListener('keydown', (event) => {
			if (
				event.key === 'Escape' &&
				!event.defaultPrevented &&
				!pick('.dropdown-menu.show') &&
				!pick('.basalt-select-popup.is-open')
			) {
				event.preventDefault();
				closeComposer();
			}
			if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.target.isContentEditable) {
				event.preventDefault();
				sendFromComposer();
			}
		});
		pick('[data-ml-c-discard]', composerDialog).addEventListener('click', discardComposer);

		for (const button of pickAll('[data-ml-c-show]', composerDialog)) {
			button.addEventListener('click', () => {
				const rowName = button.getAttribute('data-ml-c-show');
				revealRow(rowName, true);
				pick('.basalt-tags-input', pick(`[data-ml-c-row="${rowName}"]`, composerDialog)).focus();
			});
		}

		composer.body.addEventListener('input', markChanged);
		composer.subject.addEventListener('input', markChanged);

		for (const tagField of [composer.to, composer.cc, composer.bcc]) {
			tagField.addEventListener('change', (event) => {
				if (event.target.classList.contains('basalt-tags-input') && composerDialog.classList.contains('show'))
					markChanged();
			});
		}

		pick('[data-ml-c-attach]', composerDialog).addEventListener('click', () => composer.fileInput.click());
		composer.fileInput.addEventListener('change', () => {
			for (const attachedFile of Array.from(composer.fileInput.files || [])) {
				composer.attached.push({ name: attachedFile.name, size: attachedFile.size });
			}

			composer.fileInput.value = '';
			composer.files.innerHTML = attachmentList(composer.attached);
			announce(`${countOf(composer.attached.length, 'file')} attached.`);
			markChanged();
		});
		composer.files.addEventListener('click', (event) => {
			const button = event.target.closest('[data-ml-unattach]');
			if (!button) return;
			const attachedFile = composer.attached.splice(+button.getAttribute('data-ml-unattach'), 1)[0];
			composer.files.innerHTML = attachmentList(composer.attached);
			announce(`${attachedFile.name} removed.`);
			markChanged();
		});
		bindEditor(pick('[data-ml-editor]', composerDialog), sendFromComposer);
	}

	/* The send-later menu: three presets and a date and time of your own. */
	function prepareLaterMenu() {
		const rightNow = clockNow();
		const nextMonday = new Date(rightNow);
		nextMonday.setDate(rightNow.getDate() + ((8 - rightNow.getDay()) % 7 || 7));
		const tomorrow = new Date(rightNow);
		tomorrow.setDate(rightNow.getDate() + 1);

		function atHour(day, hour) {
			return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0);
		}

		const choices = [
			['Tomorrow morning', atHour(tomorrow, 8)],
			['Monday morning', atHour(nextMonday, 8)],
			['Monday afternoon', atHour(nextMonday, 13)],
		].filter(
			(preset, pos, pairs) => pairs.findIndex((other) => other[1].getTime() === preset[1].getTime()) === pos,
		);
		pick('[data-ml-schedule-presets]', laterPanel).innerHTML = choices
			.map(
				([presetName, day]) =>
					`<li><button type="button" class="dropdown-item ml-snooze-item" data-ml-sched-at="${writeStamp(day)}"><span>${presetName}</span><span class="ml-snooze-item-when">${WEEKDAYS[day.getDay()]}, ${MONTH_NAMES[day.getMonth()]} ${day.getDate()}, ${clockTime(day)}</span></button></li>`,
			)
			.join('');
		const dateInput = pick('[data-ml-sched-date]', laterPanel);
		dateInput.min = writeStamp(rightNow).slice(0, 10);
		dateInput.value = writeStamp(nextMonday).slice(0, 10);
		pick('[data-ml-sched-time]', laterPanel).value = '08:00';
		pick('[data-ml-sched-err]', laterPanel).hidden = true;
	}

	function bindSchedulePanel() {
		laterPanel.parentElement.addEventListener('show.bs.dropdown', prepareLaterMenu);
		laterPanel.addEventListener('click', (event) => {
			const button = event.target.closest('[data-ml-sched-at]');
			if (button) {
				bootstrap.Dropdown.getOrCreateInstance(pick('.dropdown-toggle-split', composerDialog)).hide();
				sendLater(readStamp(button.getAttribute('data-ml-sched-at')));
			}
		});
		pick('[data-ml-sched-go]', laterPanel).addEventListener('click', () => {
			const dateValue = pick('[data-ml-sched-date]', laterPanel).value;
			const timeValue = pick('[data-ml-sched-time]', laterPanel).value;
			const picked = dateValue && timeValue ? readStamp(`${dateValue} ${timeValue}`) : null;
			const errorNote = pick('[data-ml-sched-err]', laterPanel);
			if (!picked || picked <= clockNow()) {
				errorNote.hidden = false;
				announce(errorNote.textContent.trim());
				return;
			}
			errorNote.hidden = true;
			bootstrap.Dropdown.getOrCreateInstance(pick('.dropdown-toggle-split', composerDialog)).hide();
			sendLater(picked);
		});
	}

	/* Snooze to a date and time you pick. */
	function askSnoozeTime(idList) {
		snoozeTargets = idList.slice();
		const rightNow = clockNow();
		const dateInput = pick('[data-ml-snooze-date]', snoozeDialog);
		const tomorrow = new Date(rightNow);
		tomorrow.setDate(rightNow.getDate() + 1);
		dateInput.min = writeStamp(rightNow).slice(0, 10);
		dateInput.value = writeStamp(tomorrow).slice(0, 10);
		pick('[data-ml-snooze-time]', snoozeDialog).value = '08:00';
		pick('[data-ml-snooze-form]', snoozeDialog).classList.remove('was-validated');
		pick('[data-ml-snooze-time]', snoozeDialog).setCustomValidity('');
		bootstrap.Modal.getOrCreateInstance(snoozeDialog).show();
	}

	function bindSnoozeDialog() {
		pick('[data-ml-snooze-form]', snoozeDialog).addEventListener('submit', (event) => {
			event.preventDefault();
			const formNode = event.currentTarget;
			const dateValue = pick('[data-ml-snooze-date]', snoozeDialog).value;
			const timeValue = pick('[data-ml-snooze-time]', snoozeDialog).value;
			const picked = dateValue && timeValue ? readStamp(`${dateValue} ${timeValue}`) : null;
			pick('[data-ml-snooze-time]', snoozeDialog).setCustomValidity(
				!picked || picked <= clockNow() ? 'Pick a time after now.' : '',
			);
			formNode.classList.add('was-validated');
			if (!formNode.checkValidity()) return;
			bootstrap.Modal.getOrCreateInstance(snoozeDialog).hide();
			putOff(snoozeTargets, writeStamp(picked));
		});
	}

	/* A new label, with the first unused color picked for it. */
	function askNewLabel() {
		const formNode = pick('[data-ml-label-form]', labelDialog);
		formNode.reset();
		formNode.classList.remove('was-validated');
		const takenTones = mailbox.labels.map((labelEntry) => labelEntry.tone);
		const unusedTone = [1, 2, 3, 4, 5, 6, 7, 8].find((toneNo) => !takenTones.includes(toneNo)) || 7;
		pick('[data-ml-swatches]', labelDialog).innerHTML = [1, 2, 3, 4, 5, 6, 7, 8]
			.map(
				(toneNo) =>
					`<input type="radio" class="btn-check" name="tone" id="ml-tone-${toneNo}" value="${toneNo}" aria-label="Color ${toneNo}"${toneNo === unusedTone ? ' checked' : ''}><label class="ml-swatch ml-tone-${toneNo}" for="ml-tone-${toneNo}" title="Color ${toneNo}"></label>`,
			)
			.join('');
		closeRailDrawer();
		bootstrap.Modal.getOrCreateInstance(labelDialog).show();
	}

	function bindLabelDialog() {
		labelDialog.addEventListener('shown.bs.modal', () => pick('[data-ml-label-name]', labelDialog).focus());
		pick('[data-ml-label-form]', labelDialog).addEventListener('submit', (event) => {
			event.preventDefault();
			const formNode = event.currentTarget;
			const textField = pick('[data-ml-label-name]', labelDialog);
			const labelName = textField.value.trim();
			const nameClash = mailbox.labels.some(
				(newLabel) => newLabel.name.toLowerCase() === labelName.toLowerCase(),
			);
			textField.setCustomValidity(
				!labelName
					? 'Give the label a name.'
					: nameClash
						? `There is already a label called ${labelName}.`
						: '',
			);
			pick('[data-ml-label-err]', labelDialog).textContent =
				textField.validationMessage || 'Give the label a name.';
			formNode.classList.add('was-validated');
			if (!formNode.checkValidity()) {
				textField.focus();
				return;
			}
			const colorNo = +((pick('[name="tone"]:checked', formNode) || {}).value || 1);
			const newLabel = {
				id: `${labelName
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/^-|-$/g, '')}-${Date.now().toString(36).slice(-3)}`,
				name: labelName,
				tone: colorNo,
			};
			mailbox.labels.push(newLabel);
			bootstrap.Modal.getOrCreateInstance(labelDialog).hide();
			/* Made from an open conversation, the label goes straight onto it. */
			const openConvo = mailbox.current && threadById(mailbox.current);
			if (openConvo) applyLabel([mailbox.current], newLabel.id, true);
			drawEverything();
			notify({
				tone: 'success',
				icon: 'bi-tag',
				title: 'Label created',
				text: `${labelName}${openConvo ? ', added to this conversation' : ''}`,
			});
			attempt(api.createLabel(newLabel), 'create the label', () => {
				mailbox.labels = mailbox.labels.filter((each) => each.id !== newLabel.id);
				for (const convo of mailbox.threads) convo.labels = convo.labels.filter((each) => each !== newLabel.id);
			});
		});
	}

	/* The search box answers as you type; the Filters menu applies on submit. */
	function bindSearch() {
		dom.search.addEventListener('input', () => {
			clearTimeout(typingTimer);
			typingTimer = setTimeout(() => {
				mailbox.query = dom.search.value;
				mailbox.page = 1;
				mailbox.current = null;
				drawEverything();
				if (!isSinglePane() && mailbox.shown.length && rowKindFor(mailbox.folder) === 'thread')
					openRow(mailbox.shown[0], { focus: false, noRead: true });
				if (mailbox.query.trim()) announce(`${dom.sub.textContent} for ${mailbox.query.trim()}.`);
			}, 160);
		});
		dom.search.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				if (dom.search.value) {
					dom.search.value = '';
					dom.search.dispatchEvent(new Event('input'));
				} else dom.search.blur();
			}
			if (event.key === 'ArrowDown' || event.key === 'Enter') {
				const button = pick('.ml-row-open', dom.rows);
				if (button) {
					event.preventDefault();
					clearTimeout(typingTimer);
					mailbox.query = dom.search.value;
					drawList();
					(pick('.ml-row-open', dom.rows) || button).focus();
				}
			}
		});
		dom.filterBtn.parentElement.addEventListener('show.bs.dropdown', syncFilterForm);
		dom.filterForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const controls = dom.filterForm.elements;
			mailbox.filters = {
				from: controls.from.value.trim(),
				label: controls.label.value,
				when: controls.when.value,
				unread: controls.unread.checked,
				files: controls.files.checked,
				everywhere: controls.everywhere.checked,
			};
			mailbox.page = 1;
			mailbox.current = null;
			bootstrap.Dropdown.getOrCreateInstance(dom.filterBtn).hide();
			drawEverything();
			if (!isSinglePane() && mailbox.shown.length && rowKindFor(mailbox.folder) === 'thread')
				openRow(mailbox.shown[0], { focus: false, noRead: true });
			announce(`Filters applied. ${dom.sub.textContent}.`);
		});
		pick('[data-ml-filter-reset]', dom.filterForm).addEventListener('click', () => {
			dom.filterForm.reset();

			for (const selectBox of pickAll('select', dom.filterForm)) selectBox.value = '';
		});
		pick('[data-ml-filter-cancel]', dom.filterForm).addEventListener('click', () =>
			bootstrap.Dropdown.getOrCreateInstance(dom.filterBtn).hide(),
		);
	}

	/* An empty set of filters. */
	function blankFilters() {
		return { from: '', label: '', when: '', unread: false, files: false, everywhere: false };
	}

	function syncFilterForm() {
		const filterFormEl = dom.filterForm;
		filterFormEl.elements.from.value = mailbox.filters.from;
		filterFormEl.elements.label.value = mailbox.filters.label;
		filterFormEl.elements.when.value = mailbox.filters.when;
		filterFormEl.elements.unread.checked = mailbox.filters.unread;
		filterFormEl.elements.files.checked = mailbox.filters.files;
		filterFormEl.elements.everywhere.checked = mailbox.filters.everywhere;
	}

	function listLabelOptions() {
		const selectEl = pick('[data-ml-filter-label]', dom.filterForm);
		selectEl.innerHTML = `<option value="">Any label</option>${mailbox.labels.map((labelEntry) => `<option value="${htmlSafe(labelEntry.id)}" data-dot="series-${labelEntry.tone}">${htmlSafe(labelEntry.name)}</option>`).join('')}`;
		if (window.Basalt.select) window.Basalt.select.refresh(selectEl);
	}

	/* The All, Priority and Split switch, and the Split sections under it. */
	function bindInboxViews() {
		dom.view.addEventListener('change', (event) => {
			if (!event.target.matches('.btn-check')) return;
			mailbox.view = event.target.value;
			mailbox.page = 1;
			mailbox.current = null;
			drawEverything();
			if (dom.split.basaltTabs) dom.split.basaltTabs.refresh();
			if (!isSinglePane() && mailbox.shown.length) openRow(mailbox.shown[0], { focus: false, noRead: true });
			announce(
				{
					all: 'All mail, newest first.',
					priority: 'Priority inbox: important and unread first, then starred, then everything else.',
					split: 'Split inbox: Primary, Updates and Newsletters.',
				}[mailbox.view],
			);
		});
		dom.split.addEventListener('change', (event) => {
			if (!event.target.matches('.btn-check')) return;
			mailbox.split = event.target.value;
			mailbox.page = 1;
			mailbox.current = null;
			drawEverything();
			if (!isSinglePane() && mailbox.shown.length) openRow(mailbox.shown[0], { focus: false, noRead: true });
			announce(`${event.target.nextElementSibling.textContent.trim()}. ${dom.sub.textContent}`);
		});
	}

	function isLabelView(folderId) {
		return folderId.indexOf('label:') === 0;
	}

	function rowKindFor(folderId) {
		return Object.hasOwn(ROW_KIND_BY_FOLDER, folderId) ? ROW_KIND_BY_FOLDER[folderId] : 'thread';
	}

	function titleOf(folderId) {
		if (isLabelView(folderId)) {
			const labelEntry = labelById(folderId.slice(6));
			return labelEntry ? labelEntry.name : 'Label';
		}
		const railFolder = RAIL_FOLDERS.find((folder) => folder.id === folderId);
		return railFolder ? railFolder.name : 'Mail';
	}

	/* Spam and trash sit outside every other folder. */
	function outsideBins(convo) {
		return convo.box !== 'trash' && convo.box !== 'spam';
	}

	function belongsIn(convo, folderId) {
		if (isLabelView(folderId)) return convo.labels.includes(folderId.slice(6)) && outsideBins(convo);
		return Object.hasOwn(FOLDER_RULES, folderId) ? FOLDER_RULES[folderId](convo) : false;
	}

	/* The rows in display order; Priority adds a heading where each group starts. */
	function rowsToList() {
		const folderId = mailbox.folder;
		if (rowKindFor(folderId) === 'draft') {
			return mailbox.drafts
				.filter(
					(entry) =>
						!isSearching() ||
						`${entry.subject} ${entry.to.join(' ')} ${plainText(entry.html)}`
							.toLowerCase()
							.includes(mailbox.query.toLowerCase().trim()),
				)
				.sort((left, right) => readStamp(right.updated) - readStamp(left.updated))
				.map((entry) => ({ kind: 'draft', id: entry.id }));
		}
		if (rowKindFor(folderId) === 'scheduled') {
			return mailbox.scheduled
				.slice()
				.sort((left, right) => readStamp(left.sendAt) - readStamp(right.sendAt))
				.map((entry) => ({ kind: 'scheduled', id: entry.id }));
		}
		let convos = mailbox.threads.filter(
			(convo) =>
				(searchesAll() ? convo.box !== 'trash' || folderId === 'trash' : belongsIn(convo, folderId)) &&
				passesFilters(convo),
		);
		convos.sort((left, right) =>
			folderId === 'snoozed'
				? readStamp(left.snoozeUntil) - readStamp(right.snoozeUntil)
				: latestTime(right) - latestTime(left),
		);
		if (folderId === 'inbox' && !isSearching() && mailbox.view === 'split')
			convos = convos.filter((convo) => convo.category === mailbox.split);
		if (folderId === 'inbox' && !isSearching() && mailbox.view === 'priority') {
			const urgentGroup = convos.filter((convo) => convo.important && hasUnread(convo));
			const starredGroup = convos.filter((convo) => convo.starred && !urgentGroup.includes(convo));
			const restGroup = convos.filter((convo) => !urgentGroup.includes(convo) && !starredGroup.includes(convo));
			const result = [];

			for (const [nameText, group] of [
				['Important and unread', urgentGroup],
				['Starred', starredGroup],
				['Everything else', restGroup],
			]) {
				if (!group.length) continue;
				for (const [pos, convo] of group.entries())
					result.push({
						kind: 'thread',
						id: convo.id,
						section: pos === 0 ? nameText : '',
						sectionCount: group.length,
					});
			}

			return result;
		}
		return convos.map((convo) => ({ kind: 'thread', id: convo.id }));
	}

	/* All the text a search can match in one conversation, lowercased. */
	function searchText(convo) {
		const nameSet = new Set();
		for (const msgItem of convo.messages) {
			for (const recipient of [msgItem.from].concat(msgItem.to || [], msgItem.cc || [])) {
				const person = contactFor(recipient);
				nameSet.add(`${person.name} ${person.email} ${person.org || ''}`);
			}
		}
		const bodyText = convo.messages
			.map(
				(msgItem) =>
					`${msgItem.text || plainText(msgItem.html)} ${(msgItem.files || []).map((attachedFile) => attachedFile.name).join(' ')}`,
			)
			.join(' ');
		return `${convo.subject} ${Array.from(nameSet).join(' ')} ${bodyText} ${convo.labels.map((labelEntry) => (labelById(labelEntry) || {}).name).join(' ')}`.toLowerCase();
	}

	function passesFilters(convo) {
		const filterSet = mailbox.filters;
		if (filterSet.unread && !hasUnread(convo)) return false;
		if (filterSet.files && !hasAttachments(convo)) return false;
		if (filterSet.label && !convo.labels.includes(filterSet.label)) return false;
		if (filterSet.from) {
			const needle = filterSet.from.toLowerCase();
			if (
				!convo.messages.some((msgItem) => {
					const person = contactFor(msgItem.from);
					return `${person.name} ${person.email} ${person.org || ''}`.toLowerCase().includes(needle);
				})
			)
				return false;
		}
		if (filterSet.when) {
			const withinDays = { today: 0, week: 7, month: 30 }[filterSet.when];
			const daysOld = dayGap(clockNow(), latestTime(convo));
			if (daysOld > withinDays) return false;
		}
		if (mailbox.query.trim()) {
			const corpus = searchText(convo);
			if (
				!mailbox.query
					.toLowerCase()
					.split(/\s+/)
					.filter(Boolean)
					.every((word) => corpus.includes(word))
			)
				return false;
		}
		return true;
	}

	function hasFilters() {
		const filterSet = mailbox.filters;
		return !!(filterSet.from || filterSet.label || filterSet.when || filterSet.unread || filterSet.files);
	}

	function isSearching() {
		return !!mailbox.query.trim() || hasFilters();
	}

	function searchesAll() {
		return isSearching() && mailbox.filters.everywhere;
	}

	/* One click handler for the whole app, matched from the most specific control out. */
	function onRootClick(event) {
		const clicked = event.target;
		const folderBtn = clicked.closest('[data-ml-folder]');
		if (folderBtn) {
			goToFolder(folderBtn.getAttribute('data-ml-folder'));
			return;
		}
		if (clicked.closest('[data-ml-compose]')) {
			if (!mailbox.sendAs.length) return;
			closeRailDrawer();
			openComposer();
			return;
		}
		if (clicked.closest('[data-ml-keys]')) {
			closeRailDrawer();
			bootstrap.Modal.getOrCreateInstance(pick('#ml-keys')).show();
			return;
		}
		if (clicked.closest('[data-ml-theme]')) {
			window.Basalt.setTheme(window.Basalt.getTheme() === 'dark' ? 'light' : 'dark');
			return;
		}
		if (clicked.closest('[data-ml-new-label]')) {
			askNewLabel();
			return;
		}
		if (clicked.closest('[data-ml-retry]')) {
			fetchMailbox();
			return;
		}
		if (clicked.closest('[data-ml-refresh]')) {
			pollNow();
			return;
		}
		if (clicked.closest('[data-ml-check-mail]')) {
			closeRailDrawer();
			pollNow();
			return;
		}
		const personBtn = clicked.closest('[data-ml-person]');
		if (personBtn) {
			showPerson(personBtn.getAttribute('data-ml-person'));
			return;
		}

		/* Ways out of a search that found nothing. */
		if (clicked.closest('[data-ml-clear-search]')) {
			mailbox.query = '';
			dom.search.value = '';
			mailbox.page = 1;
			drawEverything();
			dom.search.focus();
			return;
		}
		if (clicked.closest('[data-ml-clear-filters]')) {
			mailbox.filters = blankFilters();
			syncFilterForm();
			drawEverything();
			return;
		}
		if (clicked.closest('[data-ml-everywhere]')) {
			mailbox.filters.everywhere = true;
			syncFilterForm();
			mailbox.page = 1;
			drawEverything();
			announce(`${dom.sub.textContent} in every folder.`);
			return;
		}
		const unfilterBtn = clicked.closest('[data-ml-unfilter]');
		if (unfilterBtn) {
			const filterKey = unfilterBtn.getAttribute('data-ml-unfilter');
			mailbox.filters[filterKey] = typeof mailbox.filters[filterKey] === 'boolean' ? false : '';
			syncFilterForm();
			mailbox.page = 1;
			drawEverything();
			dom.search.focus();
			announce(`Filter removed. ${dom.sub.textContent}`);
			return;
		}

		/* Rows, the pager and the list toolbar. */
		const starBtn = clicked.closest('[data-ml-star]');
		if (starBtn) {
			flipStar(starBtn.getAttribute('data-ml-star'));
			return;
		}
		const rowActBtn = clicked.closest('[data-ml-row-act]');
		if (rowActBtn) {
			const rowId = rowActBtn.closest('[data-ml-row]').getAttribute('data-ml-row');
			const rowAction = rowActBtn.getAttribute('data-ml-row-act');
			if (rowAction === 'archive' || rowAction === 'trash') relocate([rowId], rowAction);
			else setReadState([rowId], rowAction === 'read');
			return;
		}
		const openRowBtn = clicked.closest('[data-ml-open]');
		if (openRowBtn) {
			const rowId = openRowBtn.getAttribute('data-ml-open');
			if (event.shiftKey || event.metaKey || event.ctrlKey) {
				toggleTick(rowId, event.shiftKey);
				return;
			}
			openRow(rowId);
			return;
		}
		if (clicked.closest('[data-ml-prev]')) {
			mailbox.page -= 1;
			mailbox.cursor = null;
			drawList();
			dom.scroll.scrollTop = 0;
			announce(`Page ${mailbox.page}. ${dom.range.textContent}`);
			return;
		}
		if (clicked.closest('[data-ml-next]')) {
			mailbox.page += 1;
			mailbox.cursor = null;
			drawList();
			dom.scroll.scrollTop = 0;
			announce(`Page ${mailbox.page}. ${dom.range.textContent}`);
			return;
		}
		if (clicked.closest('[data-ml-read-all]')) {
			const idList = rowsToList()
				.filter((each) => each.kind === 'thread' && hasUnread(threadById(each.id)))
				.map((each) => each.id);
			if (!idList.length) {
				announce('Everything here is already read.');
				notify({ tone: 'info', title: 'Nothing unread here', duration: 3000 });
				return;
			}
			setReadState(idList, true);
			notify({
				tone: 'success',
				icon: 'bi-envelope-open',
				title: `${countOf(idList.length, 'conversation')} marked as read`,
				duration: 6000,
				actions: [{ label: 'Undo', onClick: () => setReadState(idList, false) }],
			});
			return;
		}
		if (clicked.closest('[data-ml-empty-box]')) {
			const place = mailbox.folder;
			askDeleteForever(
				mailbox.threads.filter((each) => each.box === place).map((each) => each.id),
				`Empty the ${place} now?`,
			);
			return;
		}
		const bulkBtn = clicked.closest('[data-ml-bulk]');
		if (bulkBtn) {
			runBulk(bulkBtn.getAttribute('data-ml-bulk'));
			return;
		}

		/* The open conversation. */
		if (clicked.closest('[data-ml-back]')) {
			returnToList();
			return;
		}
		const stepButton = clicked.closest('[data-ml-step]');
		if (stepButton) {
			stepBy(+stepButton.getAttribute('data-ml-step'), { open: true });
			return;
		}
		const actionBtn = clicked.closest('[data-ml-act]');
		if (actionBtn) {
			runThreadAction(actionBtn.getAttribute('data-ml-act'));
			return;
		}
		const snoozeBtn = clicked.closest('[data-ml-snooze]');
		if (snoozeBtn) {
			putOff([mailbox.current], snoozeBtn.getAttribute('data-ml-snooze'));
			return;
		}
		if (clicked.closest('[data-ml-snooze-pick]')) {
			askSnoozeTime([mailbox.current]);
			return;
		}
		const unlabelBtn = clicked.closest('[data-ml-unlabel]');
		if (unlabelBtn) {
			applyLabel([mailbox.current], unlabelBtn.getAttribute('data-ml-unlabel'), false);
			return;
		}
		const expandBtn = clicked.closest('[data-ml-expand]');
		if (expandBtn) {
			mailbox.expanded.add(expandBtn.getAttribute('data-ml-expand'));
			unfoldMessages();
			focusMessage(expandBtn.getAttribute('data-ml-expand'));
			return;
		}
		const expandAllBtn = clicked.closest('[data-ml-expand-many]');
		if (expandAllBtn) {
			const idList = expandAllBtn.getAttribute('data-ml-expand-many').split(',');

			for (const rowId of idList) {
				mailbox.expanded.add(rowId);
			}

			unfoldMessages();
			focusMessage(idList[0]);
			return;
		}
		const replyBtn = clicked.closest('[data-ml-reply-open]');
		if (replyBtn) {
			startReply(replyBtn.getAttribute('data-ml-reply-open'));
			return;
		}
		const msgReplyBtn = clicked.closest('[data-ml-msg-reply]');
		if (msgReplyBtn) {
			startReply(msgReplyBtn.getAttribute('data-ml-msg-reply'), msgReplyBtn.getAttribute('data-ml-msg'));
			return;
		}
		const msgUnreadBtn = clicked.closest('[data-ml-msg-unread]');
		if (msgUnreadBtn) {
			setReadState([mailbox.current], false, { fromMsg: msgUnreadBtn.getAttribute('data-ml-msg-unread') });
			return;
		}
		const copyEmailBtn = clicked.closest('[data-ml-copy-email]');
		if (copyEmailBtn) {
			copyOut(copyEmailBtn.getAttribute('data-ml-copy-email'), 'Email copied');
			return;
		}
		const fileBtn = clicked.closest('[data-ml-download]');
		if (fileBtn) {
			fetchAttachment(fileBtn.getAttribute('data-ml-download'), fileBtn.getAttribute('data-ml-file'), fileBtn);
			return;
		}
		const draftBtn = clicked.closest('[data-ml-open-draft]');
		if (draftBtn) {
			openComposer({ draftId: draftBtn.getAttribute('data-ml-open-draft') });
			return;
		}
		const schedEditBtn = clicked.closest('[data-ml-sched-edit]');
		if (schedEditBtn) {
			reopenScheduled(schedEditBtn.getAttribute('data-ml-sched-edit'));
			return;
		}
		const schedCancelBtn = clicked.closest('[data-ml-sched-cancel]');
		if (schedCancelBtn) {
			unschedule(schedCancelBtn.getAttribute('data-ml-sched-cancel'));
		}
	}

	/* Label boxes in the reader's Labels menu, row checkboxes and select-all. */
	function onRootChange(event) {
		const labelBox = event.target.closest('[data-ml-label-toggle]');
		if (labelBox) {
			applyLabel([mailbox.current], labelBox.getAttribute('data-ml-label-toggle'), labelBox.checked);
			return;
		}
		const rowBox = event.target.closest('[data-ml-check]');
		if (rowBox) {
			toggleTick(rowBox.getAttribute('data-ml-check'), !!mailbox._shift, rowBox.checked);
			return;
		}
		if (event.target === dom.selectAll) {
			const idList = pickAll('[data-ml-check]', dom.rows).map((each) => each.getAttribute('data-ml-check'));

			for (const rowId of idList) {
				if (dom.selectAll.checked) mailbox.selected.add(rowId);
				else mailbox.selected.delete(rowId);
			}

			drawList();
			announce(
				dom.selectAll.checked ? `${countOf(idList.length, 'conversation')} selected.` : 'Selection cleared.',
			);
		}
	}

	/* Ticks a row, or with range a run of rows from the last one ticked. */
	function toggleTick(rowId, extend, isOn) {
		const shouldTick = isOn == null ? !mailbox.selected.has(rowId) : isOn;
		if (extend && mailbox.lastChecked && mailbox.shown.includes(mailbox.lastChecked)) {
			const startAt = mailbox.shown.indexOf(mailbox.lastChecked);
			const endAt = mailbox.shown.indexOf(rowId);

			for (const each of mailbox.shown.slice(Math.min(startAt, endAt), Math.max(startAt, endAt) + 1)) {
				if (threadById(each)) {
					if (shouldTick) mailbox.selected.add(each);
					else mailbox.selected.delete(each);
				}
			}
		} else if (shouldTick) mailbox.selected.add(rowId);
		else mailbox.selected.delete(rowId);
		mailbox.lastChecked = rowId;
		drawList();
		announce(mailbox.selected.size ? `${mailbox.selected.size} selected.` : 'Selection cleared.');
	}

	/* Arrow keys walk the rows; Space ticks one. */
	function onRowKeydown(event) {
		const focusedBtn = event.target.closest('.ml-row-open');
		if (!focusedBtn) return;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const rowButtons = pickAll('.ml-row-open', dom.rows);
			const pos = rowButtons.indexOf(focusedBtn) + (event.key === 'ArrowDown' ? 1 : -1);
			const landing = rowButtons[Math.max(0, Math.min(rowButtons.length - 1, pos))];

			for (const each of rowButtons) {
				each.setAttribute('tabindex', each === landing ? '0' : '-1');
			}

			mailbox.cursor = landing.getAttribute('data-ml-open');
			landing.focus();
		} else if (event.key === ' ' && threadById(focusedBtn.getAttribute('data-ml-open'))) {
			event.preventDefault();
			toggleTick(focusedBtn.getAttribute('data-ml-open'), event.shiftKey);
			const sameRow = pick(`[data-ml-open="${selectorSafe(focusedBtn.getAttribute('data-ml-open'))}"]`, dom.rows);
			if (sameRow) sameRow.focus();
		}
	}

	/* Mail shortcuts, the Gmail set. G then a letter jumps to a folder. */
	function onShortcut(event) {
		if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
		if (pick('.modal.show, .offcanvas.show, .dropdown-menu.show')) return;
		if (mailbox.loading || mailbox.error) return;
		const pressed = event.key;
		if (goChord) {
			clearTimeout(goChord);
			goChord = 0;
			const dest = { i: 'inbox', s: 'starred', d: 'drafts', t: 'sent', a: 'archive' }[pressed.toLowerCase()];
			if (dest) {
				event.preventDefault();
				goToFolder(dest);
			}
			return;
		}
		const convo = mailbox.current && threadById(mailbox.current);
		const picked = Array.from(mailbox.selected);
		const affected = picked.length ? picked : convo ? [convo.id] : [];
		const onKey = {
			j: () => {
				event.preventDefault();
				stepBy(1);
			},
			k: () => {
				event.preventDefault();
				stepBy(-1);
			},
			Enter: () => openFromKey(),
			o: () => openFromKey(),
			u: () => {
				if (isSinglePane() && mailbox.reading) {
					event.preventDefault();
					returnToList();
					return;
				}
				const button = pick('.ml-row-open[tabindex="0"]', dom.rows);
				if (button) {
					event.preventDefault();
					button.focus();
				}
			},
			'/': () => {
				event.preventDefault();
				dom.search.focus();
				dom.search.select();
			},
			'?': () => {
				event.preventDefault();
				bootstrap.Modal.getOrCreateInstance(pick('#ml-keys')).show();
			},
			g: () => {
				goChord = setTimeout(() => {
					goChord = 0;
				}, 1200);
			},
			x: () => {
				const rowId = mailbox.cursor || mailbox.current;
				if (rowId && threadById(rowId)) {
					event.preventDefault();
					toggleTick(rowId);
				}
			},
			s: () => {
				if (convo) {
					event.preventDefault();
					flipStar(convo.id);
				}
			},
			e: () => {
				if (affected.length && mailbox.folder !== 'archive') {
					event.preventDefault();
					relocate(affected, 'archive');
				}
			},
			'#': () => {
				if (!affected.length) return;
				event.preventDefault();
				if (mailbox.folder === 'trash') askDeleteForever(affected);
				else relocate(affected, 'trash');
			},
			'!': () => {
				if (affected.length && mailbox.folder !== 'spam') {
					event.preventDefault();
					relocate(affected, 'spam');
				}
			},
			U: () => {
				if (affected.length) {
					event.preventDefault();
					setReadState(affected, false);
					if (!picked.length) leaveIfOnePane();
				}
			},
			I: () => {
				if (affected.length) {
					event.preventDefault();
					setReadState(affected, true);
				}
			},
			b: () => {
				const snoozeToggle = pick('[data-ml-snooze-btn]', dom.reader);
				if (!snoozeToggle) return;
				event.preventDefault();
				bootstrap.Dropdown.getOrCreateInstance(snoozeToggle).show();
				const firstChoice = pick('.ml-snooze-menu .dropdown-item', dom.reader);
				if (firstChoice) firstChoice.focus();
			},
			r: () => {
				if (convo) {
					event.preventDefault();
					startReply('reply');
				}
			},
			a: () => {
				if (convo) {
					event.preventDefault();
					startReply(everyoneOn(convo).length > 1 ? 'all' : 'reply');
				}
			},
			f: () => {
				if (convo) {
					event.preventDefault();
					startReply('forward');
				}
			},
			Escape: () => {
				if (mailbox.selected.size) {
					mailbox.selected.clear();
					drawList();
					announce('Selection cleared.');
				}
			},
		};

		/* Enter on another control keeps its own meaning; O and Enter on a row open it. */
		function openFromKey() {
			if (
				pressed === 'Enter' &&
				event.target.closest('button, a, input, [role="tab"]') &&
				!event.target.closest('.ml-row-open')
			)
				return;
			const rowId = event.target.closest('.ml-row-open')
				? event.target.closest('.ml-row-open').getAttribute('data-ml-open')
				: mailbox.cursor;
			if (rowId) {
				event.preventDefault();
				openRow(rowId);
			}
		}

		if (Object.hasOwn(onKey, pressed)) onKey[pressed]();
	}

	/* Lookups into the loaded mailbox; each answers null when nothing matches. */
	function personById(personId) {
		return mailbox.people.find((person) => person.id === personId) || null;
	}

	function personByEmail(address) {
		return mailbox.people.find((person) => person.email.toLowerCase() === String(address).toLowerCase()) || null;
	}

	/* An address on a message is either a person id or a bare email. */
	function contactFor(pointer) {
		const known = personById(pointer) || personByEmail(pointer);
		if (known) return known;
		const address = String(pointer);
		return { id: address, name: address, email: address, title: '', org: '', kind: 'other' };
	}

	function isSelf(pointer) {
		return contactFor(pointer).id === mailbox.me;
	}

	function givenName(pointer) {
		return isSelf(pointer) ? 'me' : contactFor(pointer).name.split(' ')[0];
	}

	function accountById(accountId) {
		return mailbox.accounts.find((customerRecord) => customerRecord.id === accountId) || null;
	}

	function labelById(labelKey) {
		return mailbox.labels.find((labelEntry) => labelEntry.id === labelKey) || null;
	}

	function threadById(threadId) {
		return mailbox.threads.find((convo) => convo.id === threadId) || null;
	}

	function draftById(draftId) {
		return mailbox.drafts.find((entry) => entry.id === draftId) || null;
	}

	function scheduledById(schedId) {
		return mailbox.scheduled.find((entry) => entry.id === schedId) || null;
	}

	function latestMessage(convo) {
		return convo.messages[convo.messages.length - 1];
	}

	function latestTime(convo) {
		return readStamp(latestMessage(convo).at);
	}

	function hasUnread(convo) {
		return convo.messages.some((msgItem) => msgItem.unread);
	}

	function hasAttachments(convo) {
		return convo.messages.some((msgItem) => msgItem.files && msgItem.files.length);
	}

	function includesMine(convo) {
		return convo.messages.some((msgItem) => isSelf(msgItem.from) && !msgItem.pending);
	}

	function isSnoozed(convo) {
		return !!convo.snoozeUntil;
	}

	/* The demo's idea of now, ticking on from DEMO_NOW. */
	function clockNow() {
		return new Date(DEMO_NOW.getTime() + (Date.now() - openedAt));
	}

	/* Reads 'YYYY-MM-DD HH:MM' as local time; a Date passes straight through. */
	function readStamp(raw) {
		if (raw instanceof Date) return raw;
		const pieces = String(raw).match(/(\d+)-(\d+)-(\d+)(?:[ T](\d+):(\d+))?/);
		if (!pieces) return new Date(raw);
		return new Date(+pieces[1], +pieces[2] - 1, +pieces[3], +(pieces[4] || 0), +(pieces[5] || 0));
	}

	/* The reverse of readStamp. */
	function writeStamp(day) {
		function twoDigits(num) {
			return String(num).padStart(2, '0');
		}

		return `${day.getFullYear()}-${twoDigits(day.getMonth() + 1)}-${twoDigits(day.getDate())} ${twoDigits(day.getHours())}:${twoDigits(day.getMinutes())}`;
	}

	function clockTime(day) {
		return `${day.getHours() % 12 || 12}:${String(day.getMinutes()).padStart(2, '0')}${day.getHours() < 12 ? ' am' : ' pm'}`;
	}

	function midnightOf(day) {
		return new Date(day.getFullYear(), day.getMonth(), day.getDate());
	}

	function dayGap(left, right) {
		return Math.round((midnightOf(left) - midnightOf(right)) / 86400000);
	}

	/* List times: 9:52 am, Yesterday, Wed, or Sep 25. */
	function rowTime(when) {
		const day = readStamp(when);
		const gap = dayGap(clockNow(), day);
		if (gap === 0) return clockTime(day);
		if (gap === 1) return 'Yesterday';
		if (gap > 1 && gap < 7) return WEEKDAYS[day.getDay()];
		return `${MONTH_NAMES[day.getMonth()]} ${day.getDate()}${day.getFullYear() !== clockNow().getFullYear() ? `, ${day.getFullYear()}` : ''}`;
	}

	/* Message times: 9:52 am (48 mins ago) today, Thu, Oct 1, 5:58 pm before. */
	function messageTime(when) {
		const day = readStamp(when);
		const minutes = Math.round((clockNow() - day) / 60000);
		if (dayGap(clockNow(), day) === 0) {
			const agoText =
				minutes < 1
					? 'just now'
					: minutes < 60
						? `${countOf(minutes, 'min')} ago`
						: `${countOf(Math.round(minutes / 60), 'hour')} ago`;
			return `${clockTime(day)} (${agoText})`;
		}
		return `${WEEKDAYS[day.getDay()]}, ${MONTH_NAMES[day.getMonth()]} ${day.getDate()}, ${clockTime(day)}`;
	}

	function fullDate(when) {
		const day = readStamp(when);
		return `${WEEKDAY_NAMES[day.getDay()]}, ${MONTH_NAMES[day.getMonth()]} ${day.getDate()}, ${day.getFullYear()}, ${clockTime(day)}`;
	}

	/* Snooze and send-later times: Today, Tomorrow, then the weekday and date. */
	function laterLabel(when) {
		const day = readStamp(when);
		const gap = dayGap(day, clockNow());
		if (gap === 0) return `Today, ${clockTime(day)}`;
		if (gap === 1) return `Tomorrow, ${clockTime(day)}`;
		return `${WEEKDAYS[day.getDay()]}, ${MONTH_NAMES[day.getMonth()]} ${day.getDate()}, ${clockTime(day)}`;
	}

	function laterShort(when) {
		const day = readStamp(when);
		const gap = dayGap(day, clockNow());
		if (gap === 0) return clockTime(day);
		if (gap === 1) return `Tomorrow ${clockTime(day)}`;
		if (gap < 7) return `${WEEKDAYS[day.getDay()]} ${clockTime(day)}`;
		return `${MONTH_NAMES[day.getMonth()]} ${day.getDate()}`;
	}

	function sizeText(bytes) {
		if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
		return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	}

	function fileLook(fileName) {
		const extension = String(fileName).split('.').pop().toLowerCase();
		if (extension === 'pdf') return { icon: 'bi-file-earmark-pdf', tone: 'pdf' };
		if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'].includes(extension))
			return { icon: 'bi-file-earmark-image', tone: 'image' };
		if (['xlsx', 'xls', 'csv', 'numbers'].includes(extension))
			return { icon: 'bi-file-earmark-spreadsheet', tone: 'sheet' };
		if (['doc', 'docx', 'txt', 'pages'].includes(extension)) return { icon: 'bi-file-earmark-text', tone: 'doc' };
		if (['zip', 'rar', '7z'].includes(extension)) return { icon: 'bi-file-earmark-zip', tone: 'other' };
		return { icon: 'bi-file-earmark', tone: 'other' };
	}

	function dollars(amount) {
		return `$${Number(amount).toLocaleString('en-US')}`;
	}

	function isTypingTarget(node) {
		return !!node && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName));
	}

	function looksLikeEmail(raw) {
		return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(raw).trim());
	}

	/* Demo text turns into paragraphs, and runs of "• " lines into a list. */
	function paragraphsFrom(sourceText) {
		return String(sourceText || '')
			.split(/\n{2,}/)
			.map((block) => {
				const textLines = block.split('\n');
				if (textLines.every((line) => /^•\s/.test(line)))
					return `<ul>${textLines.map((line) => `<li>${htmlSafe(line.replace(/^•\s*/, ''))}</li>`).join('')}</ul>`;
				return `<p>${textLines.map(htmlSafe).join('<br>')}</p>`;
			})
			.join('');
	}

	/* What was written in the editor, cut back to plain formatting and safe links. */
	function tidyHtml(source) {
		const scratchDoc = new DOMParser().parseFromString(`<div>${String(source || '')}</div>`, 'text/html');

		function prune(parent) {
			for (const childNode of Array.from(parent.childNodes)) {
				if (childNode.nodeType === 3) continue;
				if (childNode.nodeType !== 1 || !KEPT_TAGS[childNode.tagName]) {
					if (childNode.nodeType === 1 && !/^(SCRIPT|STYLE|IFRAME|OBJECT)$/.test(childNode.tagName)) {
						prune(childNode);
						childNode.replaceWith(...Array.from(childNode.childNodes));
					} else childNode.remove();
					continue;
				}

				for (const attr of Array.from(childNode.attributes)) {
					const keepIt =
						childNode.tagName === 'A' && attr.name === 'href' && /^(https?:|mailto:)/i.test(attr.value);
					if (!keepIt) childNode.removeAttribute(attr.name);
				}

				if (childNode.tagName === 'A') {
					childNode.setAttribute('target', '_blank');
					childNode.setAttribute('rel', 'noopener');
				}
				prune(childNode);
			}
		}

		const wrapper = scratchDoc.body.firstChild;
		prune(wrapper);
		return wrapper.innerHTML;
	}

	function plainText(source) {
		const scratch = document.createElement('div');
		scratch.innerHTML = String(source || '')
			.replace(/<\/(p|li|div)>/gi, ' </$1>')
			.replace(/<br\s*\/?>/gi, ' ');
		return (scratch.textContent || '').replace(/\s+/g, ' ').trim();
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(raw) {
		return String(raw == null ? '' : raw).replace(
			/[&<>"']/g,
			(ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
		);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function countOf(amount, single, multiple) {
		return `${amount} ${amount === 1 ? single : multiple || `${single}s`}`;
	}

	function prefersStill() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function copyDeep(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function freshId(head) {
		return `${head}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
	}

	/* Speaks through the shared live region, or the page's own when basalt.js is missing. */
	function announce(message) {
		if (window.Basalt.announce) window.Basalt.announce(message);
		else if (liveRegion) liveRegion.textContent = message;
	}

	/* A delay that resolves with settled. */
	function pause(delay, settled) {
		return new Promise((finish) => setTimeout(() => finish(settled), delay));
	}

	/* A demo write: a short wait, and a failure every time in offline mode. */
	function fakeWrite(settled) {
		return pause(160).then(() => {
			if (DEMO_STATE === 'offline') throw new Error('The server did not answer');
			return settled;
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
	else start();
})();
