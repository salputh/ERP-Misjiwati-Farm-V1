/**
 * Error Details (error-details.html).
 *
 * Shows one group of errors or warnings from the Event log on its own page:
 * how often it fires, who it hits, the stack trace or the latest event, the
 * releases it appeared in, and the status, owner and priority a team member
 * can edit. The Event log opens this page with ?id=<group>; every group it
 * lists has an entry in CATALOG below, with the same events the log shows
 * for its last hour, so both pages tell one story.
 *
 * A real deployment would swap groupFor(id) for a fetch from the error
 * service. The shared pieces come from basalt.js: the segmented control,
 * the styled select, toasts, clipboard copy and the screen reader announcer.
 */
(() => {
	'use strict';

	const shell = pick('[data-ed-root]', document);
	if (!shell) return;

	/* The demo clock stands at the same fixed moment as the Event log
     (Sep 29, 2026, 14:32:10) and moves forward in real time from there. */
	const DEMO_MOMENT = new Date(2026, 8, 29, 14, 32, 10).getTime();
	const openedAt = Date.now();
	const ONE_MINUTE = 60000;

	const PREVIEW_ROWS = 6;
	const CUSTOMER_PAGE = 'company-details.html';
	const TYPEFACE = "'Schibsted Grotesk', sans-serif";

	/* Where an event comes from: the full name for prose, the short one for
     release names. */
	const ORIGINS = {
		portal: ['Customer portal', 'Portal'],
		planner: ['Travel planner', 'Planner'],
		invoicing: ['Invoices and payments', 'Billing'],
		mobile: ['Mobile sync', 'Mobile'],
		email: ['Email', 'Email'],
		checkout: ['Web checkout', 'Checkout'],
		schedule: ['Schedule board', 'Schedule'],
		sms: ['SMS reminders', 'SMS'],
	};

	/* Two weeks of history, oldest first; the last day is today. */
	const FORTNIGHT = [
		'Sep 16',
		'Sep 17',
		'Sep 18',
		'Sep 19',
		'Sep 20',
		'Sep 21',
		'Sep 22',
		'Sep 23',
		'Sep 24',
		'Sep 25',
		'Sep 26',
		'Sep 27',
		'Sep 28',
		'Sep 29',
	];

	/* One release a week. A release owns the days from `fromDay` up to the
     next release. */
	const RELEASES = [
		{ tag: '2026.9.15', shipped: 'Sep 15, 16:20', shippedBy: 'Rory Beasley', fromDay: 0 },
		{ tag: '2026.9.22', shipped: 'Sep 22, 10:40', shippedBy: 'Forrest Murphy', fromDay: 6 },
		{ tag: '2026.9.29', shipped: 'Sep 29, 11:05', shippedBy: 'Rory Beasley', fromDay: 13 },
	];

	const TEAM = {
		ka: { name: 'Jim Atkins', role: 'Site reliability engineer', initials: 'JA', tone: 3 },
		so: { name: 'Rory Beasley', role: 'Backend engineer', initials: 'RO', tone: 1 },
		lm: { name: 'Forrest Murphy', role: 'Backend engineer', initials: 'FM', tone: 5 },
		ds: { name: 'Darryl Sanders', role: 'Platform engineer', initials: 'DS', tone: 2 },
		as: { name: 'Alicia Bowen', role: 'Engineering manager', initials: 'AB', tone: 4 },
	};

	const URGENCY = {
		low: { label: 'Low', glyph: 'bi-arrow-down' },
		medium: { label: 'Medium', glyph: 'bi-dash-lg' },
		high: { label: 'High', glyph: 'bi-arrow-up' },
	};

	const STATUS_PILL = {
		open: { tone: 'basalt-status-primary', label: 'Open' },
		muted: { tone: '', label: 'Muted' },
		resolved: { tone: 'basalt-status-success', label: 'Resolved' },
	};

	const SEAT_PRICE = { Basic: 15, Pro: 32, Max: 58 };

	/**
	 * A column of the Sample events table.
	 *
	 * @param {string} heading What the column header says; also the value it
	 *   shows unless `extra.key` names another one.
	 * @param {string} shape who | link | money | split | num | text.
	 * @param {object} [extra] page (for links), hideBelow ('md' tucks the value
	 *   under the name on narrow screens, 'sm' drops it on phones), display
	 *   (a function that rewrites the value).
	 */
	function column(heading, shape, extra) {
		return { heading, key: heading, shape, ...extra };
	}

	/**
	 * One line of a stack trace, with an optional excerpt of the source.
	 *
	 * @param {string} caller The function name.
	 * @param {string} location file:line.
	 * @param {boolean} ours True for Fieldline's own code.
	 * @param {Array} [excerpt] [first line number, failing line number, ...lines]
	 */
	function stackFrame(caller, location, ours, excerpt) {
		return { caller, location, ours, excerpt };
	}

	/**
	 * One row of the activity feed.
	 *
	 * @param {string} tone note | owner | alert | done, or '' for a neutral icon.
	 */
	function moment(tone, glyph, html, stamp, quote) {
		return { tone, glyph, html, stamp, quote };
	}

	/* Every group the Event log links to. Per group:
       values        the names of an event's values, in the order after its time
       target        what an event hits: the value, a card heading, nouns,
                     the page the name links to, and the verb for the ranking
       halves        the two colors of the chart and bars; byRepeat means the
                     second color marks a target that was hit before
       table         the Sample events columns
       fortnight     [events, second-color events] per day, two weeks
       debut         index into FORTNIGHT of the first sighting
       measure       the third figure in At a glance, worked out from the hour
       crash         the stack trace (errors); logSite is the logging line
                     (warnings)
       hourOverride  replaces the pace worked out for the last hour */
	const CATALOG = {
		payTimeout: {
			headline: 'Invoice payment timed out after 10 seconds',
			kind: 'error',
			origin: 'portal',
			state: 'open',
			assignee: 'ka',
			urgency: 'high',
			sinceNote: 'Open again since Sep 27, when it came back after a fix.',
			values: ['Invoice', 'Amount', 'Customer', 'Attempt'],
			target: {
				key: 'Customer',
				heading: 'Customers hit',
				nouns: ['customer'],
				page: CUSTOMER_PAGE,
				verbs: 'failed',
			},
			halves: {
				first: 'Will try again',
				second: 'Gave up after three tries',
				secondWord: 'gave up',
				isSecond: (row) => row.Attempt === '3 of 3',
			},
			table: [
				column('Customer', 'who'),
				column('Invoice', 'link', { page: 'invoice-details.html', hideBelow: 'md' }),
				column('Amount', 'money'),
				column('Try', 'split', {
					key: 'Attempt',
					display: (row) => (row.Attempt === '3 of 3' ? 'Gave up' : row.Attempt),
					hideBelow: 'sm',
				}),
			],
			because: ', while the payment gateway was slow',
			debut: 0,
			debutTime: '10:03',
			fortnight: [
				[2, 1],
				[1, 0],
				[0, 0],
				[0, 0],
				[1, 0],
				[0, 0],
				[0, 0],
				[3, 1],
				[0, 0],
				[1, 0],
				[0, 0],
				[2, 1],
				[1, 0],
				[39, 15],
			],
			fortnightNote: 'Fifty since it was first seen on Sep 16. Before today it never passed three a day.',
			measure(sample) {
				const abandoned = sample.filter(this.halves.isSecond);
				const lost = abandoned.reduce((sum, row) => sum + numberIn(row.Amount), 0);
				return [
					'bi-credit-card',
					'Payments that gave up',
					dollars(lost),
					`${countOf(abandoned.length, 'invoice')}, after three tries`,
				];
			},
			crash: {
				name: 'GatewayTimeoutError',
				message: 'No reply from the payment gateway within 10000 ms',
				stack: [
					stackFrame('chargeCard', 'payments/charge.js:88', true, [
						86,
						88,
						'async function chargeCard(invoice, card) {',
						'  const charge = { amount: invoice.total, card: card.token };',
						'  const reply = await gateway.charge(charge, { timeout: 10000 });',
						'  return reply.id;',
						'}',
					]),
					stackFrame('payInvoice', 'portal/pay-invoice.js:141', true),
					stackFrame('handle', 'server/portal.js:57', true),
					stackFrame('fetch', 'node_modules/undici/index.js:109', false),
				],
			},
			requestId: 'req_08c9eff7d8e2',
			history: [
				moment(
					'note',
					'bi-chat-left-text',
					'<strong>Jim Atkins</strong> added a note',
					'Today, 14:06',
					'The gateway’s status page confirms slow replies from 13:48 to 13:57. Asked them for the incident report.',
				),
				moment(
					'owner',
					'bi-person-check',
					'<strong>Jim Atkins</strong> took it, priority High',
					'Today, 13:58',
				),
				moment(
					'alert',
					'bi-envelope-exclamation',
					'Emailed ops@fieldline.app: more than 5 errors in a minute',
					'Today, 13:52',
				),
				moment(
					'alert',
					'bi-arrow-counterclockwise',
					'Opened again by itself: it happened after being resolved',
					'Sep 27, 09:12',
				),
				moment(
					'done',
					'bi-check2-circle',
					'<strong>Forrest Murphy</strong> marked it resolved',
					'Sep 26, 17:40',
					'Retries now wait longer between tries.',
				),
			],
			samples: [
				['14:32:06', '#30836', '$2283.75', 'Bluepeak Studios', '1 of 3'],
				['14:28:12', '#30830', '$2004.70', 'Highpoint Outfitters', '3 of 3'],
				['14:12:44', '#30805', '$1786.52', 'Avocet Robotics', '3 of 3'],
				['13:56:08', '#30778', '$768.08', 'Cornerstone Logistics', '1 of 3'],
				['13:56:07', '#30774', '$518.49', 'Polaris Running Co. Group', '3 of 3'],
				['13:55:34', '#30772', '$490.29', 'Highpoint Data Works', '1 of 3'],
				['13:55:25', '#30773', '$488.77', 'Northgate Analytics', '1 of 3'],
				['13:55:09', '#30767', '$1597.82', 'Bluepeak Studios', '2 of 3'],
				['13:54:56', '#30769', '$794.33', 'Northgate Analytics', '2 of 3'],
				['13:54:41', '#30766', '$321.37', 'Polaris Running Co. Group', '1 of 3'],
				['13:54:37', '#30765', '$911.10', 'Polaris Running Co. Group', '1 of 3'],
				['13:54:36', '#30768', '$757.73', 'Lakeside Apparel', '2 of 3'],
				['13:54:18', '#30771', '$2250.72', 'Highpoint Outfitters', '2 of 3'],
				['13:54:17', '#30764', '$1501.02', 'Cornerstone Logistics', '3 of 3'],
				['13:54:13', '#30770', '$1619.67', 'Oakhaven Studio', '2 of 3'],
				['13:53:29', '#30762', '$1270.49', 'Bluepeak Studios', '1 of 3'],
				['13:53:15', '#30763', '$532.65', 'Polaris Running Co. Group', '3 of 3'],
				['13:52:54', '#30759', '$2719.66', 'Evergreen Landscaping', '3 of 3'],
				['13:52:54', '#30754', '$2448.17', 'Lakeside Apparel', '2 of 3'],
				['13:52:38', '#30753', '$1101.46', 'Northgate Analytics', '3 of 3'],
				['13:52:28', '#30752', '$1240.85', 'Bluepeak Studios', '2 of 3'],
				['13:52:27', '#30750', '$536.64', 'Highpoint Data Works', '3 of 3'],
				['13:52:24', '#30757', '$200.21', 'Highpoint Data Works', '2 of 3'],
				['13:52:19', '#30758', '$2608.59', 'Highpoint Outfitters', '2 of 3'],
				['13:52:16', '#30751', '$548.63', 'Copperleaf Design', '3 of 3'],
				['13:52:13', '#30755', '$1282.74', 'Lakeside Apparel', '3 of 3'],
				['13:52:09', '#30745', '$624.54', 'Ironbridge Fintech', '2 of 3'],
				['13:51:47', '#30747', '$168.34', 'Polaris Running Co. Group', '3 of 3'],
				['13:51:34', '#30748', '$1879.85', 'Northgate Analytics', '2 of 3'],
				['13:51:30', '#30749', '$1089.71', 'Highpoint Data Works', '3 of 3'],
				['13:51:23', '#30746', '$2009.65', 'Larchwood Studios', '1 of 3'],
				['13:51:07', '#30741', '$651.63', 'Avocet Robotics', '2 of 3'],
				['13:50:46', '#30744', '$1124.54', 'Highpoint Outfitters', '2 of 3'],
				['13:50:23', '#30737', '$1983.50', 'Avocet Robotics', '3 of 3'],
				['13:50:21', '#30739', '$2294.27', 'Highpoint Data Works', '3 of 3'],
				['13:50:15', '#30742', '$554.84', 'Lakeside Apparel', '2 of 3'],
			],
		},

		label: {
			headline: 'Could not plan a day: the visit address was not found on the map',
			kind: 'error',
			origin: 'planner',
			state: 'open',
			assignee: 'ds',
			urgency: 'medium',
			sinceNote: 'Open since it was first seen on Sep 22.',
			values: ['Visit', 'Customer', 'ZIP code', 'Territory'],
			target: {
				key: 'Customer',
				heading: 'Customers hit',
				nouns: ['customer'],
				page: CUSTOMER_PAGE,
				verbs: ['visit', 'visits'],
			},
			halves: {
				first: 'First time for a customer',
				second: 'Same customer again',
				secondWord: 'again',
				byRepeat: true,
			},
			table: [
				column('Customer', 'who'),
				column('Visit', 'text', { hideBelow: 'md' }),
				column('Territory', 'text'),
				column('ZIP code', 'text', { hideBelow: 'sm' }),
			],
			debut: 6,
			debutTime: '11:20',
			fortnight: [
				[0, 0],
				[0, 0],
				[0, 0],
				[0, 0],
				[0, 0],
				[0, 0],
				[3, 1],
				[5, 2],
				[4, 1],
				[6, 2],
				[2, 0],
				[1, 0],
				[7, 2],
				[19, 5],
			],
			fortnightNote: 'A few most days since the Sep 22 release; today is the busiest yet.',
			measure(sample) {
				return [
					'bi-geo-alt',
					'Visits left unplanned',
					String(sample.length),
					`In ${uniqueCount(sample, (row) => row.Territory)} territories`,
				];
			},
			crash: {
				name: 'GeocodeError',
				message: 'Map service says "street number not found"',
				stack: [
					stackFrame('locate', 'planner/geocode.js:212', true, [
						210,
						212,
						'async function locate(visit) {',
						'  const hits = await maps.geocode(visit.address, { region: visit.zip });',
						'  if (!hits.length) throw new GeocodeError(hits.reason);',
						'  return hits[0].point;',
						'}',
					]),
					stackFrame('planDay', 'planner/plan.js:64', true),
					stackFrame('runQueue', 'jobs/queue.js:39', true),
				],
			},
			requestId: 'req_11954305115b',
			history: [
				moment(
					'note',
					'bi-chat-left-text',
					'<strong>Darryl Sanders</strong> added a note',
					'Today, 13:40',
					'All of these are on new-build streets. The map data update on Oct 1 should fix most of them.',
				),
				moment(
					'owner',
					'bi-person-check',
					'<strong>Darryl Sanders</strong> took it, priority Medium',
					'Sep 23, 09:15',
				),
			],
			samples: [
				['14:27:31', '#18323', 'Avocet Robotics', '97214', 'North'],
				['14:19:18', '#18311', 'Cornerstone Logistics', '97214', 'East'],
				['14:02:37', '#18284', 'Brightline Photography', '78704', 'Downtown'],
				['13:59:40', '#18280', 'Highpoint Outfitters', '10027', 'Downtown'],
				['13:58:37', '#18278', 'Avocet Robotics', '78704', 'North'],
				['13:55:13', '#18274', 'Northgate Analytics', '94110', 'East'],
				['13:54:11', '#18273', 'Brightline Photography', '94110', 'Lakeshore'],
				['13:49:37', '#18264', 'Avocet Robotics', '78704', 'Westside'],
				['13:49:25', '#18266', 'Cornerstone Logistics', '10027', 'North'],
				['13:47:04', '#18258', 'Bluepeak Studios', '10027', 'Downtown'],
				['13:38:42', '#18245', 'Ironbridge Fintech', '98103', 'East'],
				['13:38:15', '#18248', 'Highpoint Data Works', '94110', 'Lakeshore'],
			],
		},

		renewal: {
			headline: 'Plan renewal failed because the saved card has expired',
			kind: 'error',
			origin: 'invoicing',
			state: 'open',
			assignee: '',
			urgency: 'medium',
			sinceNote: 'Open since Sep 18. Each customer gets an email to update their card.',
			values: ['Customer', 'Plan', 'Card', 'Next try'],
			target: {
				key: 'Customer',
				heading: 'Customers hit',
				nouns: ['customer'],
				page: CUSTOMER_PAGE,
				verbs: 'failed',
			},
			halves: {
				first: 'Basic plan',
				second: 'Pro plan',
				secondWord: 'on Pro',
				isSecond: (row) => !/^Basic/.test(row.Plan),
			},
			table: [column('Customer', 'who'), column('Plan', 'split'), column('Card', 'text', { hideBelow: 'md' })],
			debut: 2,
			debutTime: '02:10',
			fortnight: [
				[0, 0],
				[0, 0],
				[4, 2],
				[3, 1],
				[2, 1],
				[0, 0],
				[0, 0],
				[5, 2],
				[3, 1],
				[2, 1],
				[4, 2],
				[1, 0],
				[3, 1],
				[8, 3],
			],
			fortnightNote: 'A few most days since Sep 18, whenever a renewal meets an expired card.',
			measure(sample) {
				let monthly = 0;
				for (const row of sample) {
					const plan = /^(\w+), (\d+) seats/.exec(row.Plan);
					if (plan) monthly += SEAT_PRICE[plan[1]] * Number(plan[2]);
				}
				return [
					'bi-arrow-repeat',
					'Monthly revenue at risk',
					dollars(monthly, true),
					`${countOf(sample.length, 'renewal')} waiting on a new card`,
				];
			},
			crash: {
				name: 'CardExpired',
				message: 'Card expired 08/2026',
				stack: [
					stackFrame('renew', 'billing/renew.js:97', true, [
						95,
						97,
						'async function renew(account) {',
						'  const card = await cards.default(account.id);',
						'  if (card.expired) throw new CardExpired(card.expiry);',
						'  return charge(account, card, account.plan.monthly);',
						'}',
					]),
					stackFrame('nightlyRenewals', 'jobs/renewals.js:22', true),
				],
			},
			requestId: 'req_6cb7b161ac53',
			history: [
				moment(
					'alert',
					'bi-envelope-exclamation',
					'Emailed 4 customers a link to update their card',
					'Today, 14:24',
				),
				moment(
					'note',
					'bi-chat-left-text',
					'<strong>Alicia Bowen</strong> added a note',
					'Sep 26, 11:30',
					'Billing should remind customers a week before the card expires, not after.',
				),
			],
			samples: [
				['14:23:42', 'Brightline Photography', 'Basic, 6 seats', 'Visa ending 7678', 'in 24 hours'],
				['14:22:47', 'Northgate Analytics', 'Pro, 32 seats', 'Visa ending 4592', 'in 24 hours'],
				['13:51:00', 'Larchwood Studios', 'Basic, 6 seats', 'Visa ending 1225', 'in 24 hours'],
				['13:44:49', 'Larchwood Studios', 'Pro, 14 seats', 'Visa ending 1292', 'in 24 hours'],
				['13:42:28', 'Polaris Running Co. Group', 'Pro, 14 seats', 'Visa ending 6309', 'in 24 hours'],
			],
		},

		stockSync: {
			headline: 'Offline changes from a team member’s phone failed to sync',
			kind: 'error',
			origin: 'mobile',
			state: 'open',
			assignee: 'lm',
			urgency: 'high',
			sinceNote: 'Open since Sep 24. Devices try again by themselves.',
			values: ['Team member', 'App', 'Waiting', 'Reply'],
			target: {
				key: 'Team member',
				heading: 'Staff hit',
				nouns: ['team member'],
				page: 'employee-details.html',
				verbs: 'failed',
			},
			halves: {
				first: 'iPhone app, v4.2',
				second: 'Android app, v4.2',
				secondWord: 'on Android',
				isSecond: (row) => row.App === 'Android app, v4.2',
			},
			table: [
				column('Team member', 'who'),
				column('App', 'split', { hideBelow: 'sm' }),
				column('Waiting', 'num'),
			],
			because: ', while the sync server was down',
			debut: 8,
			debutTime: '07:42',
			fortnight: [
				[0, 0],
				[0, 0],
				[0, 0],
				[0, 0],
				[0, 0],
				[0, 0],
				[0, 0],
				[0, 0],
				[1, 0],
				[0, 0],
				[0, 0],
				[2, 1],
				[0, 0],
				[27, 11],
			],
			fortnightNote: 'Rare until today, when the sync server went down at 14:16.',
			measure(sample) {
				const queued = sample.reduce((sum, row) => sum + numberIn(row.Waiting), 0);
				return [
					'bi-cloud-arrow-up',
					'Changes waiting to sync',
					queued.toLocaleString('en-US'),
					`On ${uniqueCount(sample, (row) => row['Team member'] + row.App)} devices`,
				];
			},
			crash: {
				name: 'SyncError',
				message: 'Sync server replied 502 Bad Gateway',
				stack: [
					stackFrame('pushChanges', 'mobile/sync.js:58', true, [
						56,
						58,
						'async function pushChanges(device, changes) {',
						"  const res = await api.post('/sync', { device: device.id, changes });",
						"  if (!res.ok) throw new SyncError(res.status + ' ' + res.statusText);",
						'  return res.json();',
						'}',
					]),
					stackFrame('syncDevice', 'mobile/sync.js:21', true),
					stackFrame('onReconnect', 'mobile/connection.js:14', true),
				],
			},
			requestId: 'req_06ff0a72f50d',
			history: [
				moment(
					'note',
					'bi-chat-left-text',
					'<strong>Forrest Murphy</strong> added a note',
					'Today, 14:24',
					'The sync server ran out of memory and restarted at 14:19. Devices send their changes again by themselves; watching the queue.',
				),
				moment(
					'owner',
					'bi-person-check',
					'<strong>Forrest Murphy</strong> took it, priority High',
					'Today, 14:20',
				),
				moment(
					'alert',
					'bi-envelope-exclamation',
					'Emailed ops@fieldline.app: more than 5 errors in a minute',
					'Today, 14:17',
				),
			],
			samples: [
				['14:19:55', 'Pamela Roach', 'iPhone app, v4.2', '19 changes', '502 Bad Gateway'],
				['14:19:28', 'Gerald Pratt', 'iPhone app, v4.2', '19 changes', '502 Bad Gateway'],
				['14:19:22', 'Gerald Pratt', 'iPhone app, v4.2', '19 changes', '502 Bad Gateway'],
				['14:19:16', 'Erin Kerr', 'Android app, v4.2', '7 changes', '502 Bad Gateway'],
				['14:19:15', 'Gerald Pratt', 'Android app, v4.2', '22 changes', '502 Bad Gateway'],
				['14:19:08', 'Gerald Pratt', 'Android app, v4.2', '14 changes', '502 Bad Gateway'],
				['14:19:02', 'Lance Bishop', 'iPhone app, v4.2', '17 changes', '502 Bad Gateway'],
				['14:19:01', 'Dana Whitfield', 'iPhone app, v4.2', '13 changes', '502 Bad Gateway'],
				['14:18:43', 'Dana Whitfield', 'iPhone app, v4.2', '22 changes', '502 Bad Gateway'],
				['14:18:28', 'Pamela Roach', 'Android app, v4.2', '16 changes', '502 Bad Gateway'],
				['14:18:15', 'Gerald Pratt', 'Android app, v4.2', '11 changes', '502 Bad Gateway'],
				['14:18:14', 'Erin Kerr', 'Android app, v4.2', '21 changes', '502 Bad Gateway'],
				['14:18:07', 'Jamal Pearce', 'iPhone app, v4.2', '5 changes', '502 Bad Gateway'],
				['14:18:05', 'Erin Kerr', 'iPhone app, v4.2', '23 changes', '502 Bad Gateway'],
				['14:17:57', 'Pamela Roach', 'Android app, v4.2', '7 changes', '502 Bad Gateway'],
				['14:17:57', 'Pamela Roach', 'iPhone app, v4.2', '18 changes', '502 Bad Gateway'],
				['14:17:51', 'Dana Whitfield', 'iPhone app, v4.2', '24 changes', '502 Bad Gateway'],
				['14:17:48', 'Gerald Pratt', 'iPhone app, v4.2', '11 changes', '502 Bad Gateway'],
				['14:17:46', 'Travis Yoder', 'Android app, v4.2', '6 changes', '502 Bad Gateway'],
				['14:17:14', 'Pamela Roach', 'iPhone app, v4.2', '23 changes', '502 Bad Gateway'],
				['14:16:41', 'Travis Yoder', 'iPhone app, v4.2', '4 changes', '502 Bad Gateway'],
				['14:16:25', 'Dana Whitfield', 'iPhone app, v4.2', '5 changes', '502 Bad Gateway'],
				['14:16:22', 'Gerald Pratt', 'Android app, v4.2', '21 changes', '502 Bad Gateway'],
				['13:54:02', 'Gerald Pratt', 'Android app, v4.2', '17 changes', '502 Bad Gateway'],
			],
		},

		bounce: {
			headline: 'Invoice email bounced',
			kind: 'error',
			origin: 'email',
			state: 'open',
			assignee: '',
			urgency: 'low',
			sinceNote: 'Open since Sep 16. A full mailbox gets the email again the next day.',
			values: ['Invoice', 'Customer', 'Sent to', 'Reason'],
			target: {
				key: 'Customer',
				heading: 'Customers hit',
				nouns: ['customer'],
				page: CUSTOMER_PAGE,
				verbs: 'bounced',
			},
			halves: {
				first: 'Mailbox full',
				second: 'Address does not exist',
				secondWord: 'no such address',
				isSecond: (row) => row.Reason === 'Address does not exist',
			},
			table: [
				column('Customer', 'who'),
				column('Invoice', 'link', { page: 'invoice-details.html', hideBelow: 'md' }),
				column('Reason', 'split', { hideBelow: 'sm' }),
			],
			debut: 0,
			debutTime: '08:31',
			fortnight: [
				[1, 1],
				[0, 0],
				[2, 1],
				[1, 0],
				[0, 0],
				[0, 0],
				[1, 0],
				[0, 0],
				[1, 1],
				[2, 1],
				[0, 0],
				[0, 0],
				[1, 0],
				[4, 1],
			],
			fortnightNote: 'One or two on most days since Sep 16.',
			measure(sample) {
				const unknown = sample.filter(this.halves.isSecond).length;
				return [
					'bi-envelope-x',
					'Invoices not delivered',
					String(sample.length),
					`${unknown} to an address that does not exist`,
				];
			},
			crash: {
				name: 'BounceNotice',
				message: '550 5.1.1 recipient rejected',
				stack: [
					stackFrame('onBounce', 'email/webhooks.js:44', true, [
						42,
						44,
						'function onBounce(event) {',
						'  const invoice = invoices.byMessage(event.messageId);',
						"  throw new BounceNotice(event.code + ' ' + event.reason, { invoice });",
						'}',
					]),
					stackFrame('receive', 'server/email.js:18', true),
				],
			},
			requestId: 'req_a04a6bbddcb1',
			history: [
				moment(
					'note',
					'bi-chat-left-text',
					'<strong>Alicia Bowen</strong> added a note',
					'Today, 13:55',
					'Full mailboxes get the invoice again tomorrow. Oakhaven Studio’s billing address needs updating by hand.',
				),
			],
			samples: [
				['14:29:40', '#30832', 'Cornerstone Logistics', 'd•••@cornerstonelogistics.com', 'Mailbox full'],
				['14:26:10', '#30828', 'Brightline Photography', 'd•••@brightlinephotography.com', 'Mailbox full'],
				['13:47:41', '#30732', 'Oakhaven Studio', 'o•••@oakhavenstudio.com', 'Address does not exist'],
			],
		},

		noPrice: {
			headline: 'Checkout page failed: one of its options has no price',
			kind: 'error',
			origin: 'checkout',
			state: 'resolved',
			closedAt: '14:05',
			closedBy: 'Darryl Sanders',
			assignee: 'ds',
			urgency: 'high',
			sinceNote: 'Open since Sep 23.',
			values: ['Product', 'Option', 'Page'],
			target: {
				key: 'Product',
				heading: 'Products hit',
				nouns: ['product'],
				page: 'price-tiers.html',
				verbs: 'failed',
			},
			halves: {
				first: 'Scheduler Course',
				second: 'Custom Form Build',
				isSecond: (row) => row.Product === 'Custom Form Build',
			},
			table: [column('Product', 'who'), column('Page', 'text', { hideBelow: 'md' })],
			debut: 7,
			debutTime: '08:47',
			fortnight: [
				[0, 0],
				[0, 0],
				[0, 0],
				[0, 0],
				[0, 0],
				[0, 0],
				[0, 0],
				[6, 2],
				[9, 4],
				[7, 3],
				[4, 1],
				[3, 1],
				[8, 3],
				[11, 5],
			],
			fortnightNote: 'Started after the Sep 22 checkout release; none since the fix at 14:05.',
			hourOverride: 'Both before the fix at 14:05',
			measure() {
				const sinceDebut = this.fortnight.slice(this.debut).reduce((sum, day) => sum + day[0], 0);
				return [
					'bi-cart-x',
					'Failed pages since Sep 23',
					String(sinceDebut),
					'Every one before the fix at 14:05',
				];
			},
			crash: {
				name: 'TypeError',
				message: "Cannot read properties of undefined (reading 'amount')",
				stack: [
					stackFrame('priceLabel', 'extras/product.js:131', true, [
						129,
						131,
						'function priceLabel(option) {',
						'  const price = option.prices[currency];',
						"  return money(price.amount) + ' each';",
						'}',
					]),
					stackFrame('renderOptions', 'extras/product.js:88', true),
					stackFrame('productPage', 'server/extras.js:73', true),
				],
			},
			requestId: 'req_7f84f0171df8',
			history: [
				moment(
					'done',
					'bi-check2-circle',
					'<strong>Darryl Sanders</strong> marked it resolved',
					'Today, 14:05',
					'An option without its own price now uses the product’s price.',
				),
				moment(
					'owner',
					'bi-person-check',
					'<strong>Darryl Sanders</strong> took it, priority High',
					'Sep 23, 10:12',
				),
				moment(
					'alert',
					'bi-envelope-exclamation',
					'Emailed ops@fieldline.app: more than 5 errors in a minute',
					'Sep 23, 09:58',
				),
			],
			samples: [
				['13:41:08', 'Scheduler Course', '2 places, recorded', '/extras/scheduler-course'],
				['13:33:45', 'Custom Form Build', '2 places, recorded', '/extras/custom-form-build'],
			],
		},

		expiredCode: {
			headline: 'Customer tried a discount code that has expired',
			kind: 'warn',
			origin: 'checkout',
			state: 'open',
			assignee: '',
			urgency: 'low',
			sinceNote: 'Open since Sep 22, the day after SPRINGTEAMS ended.',
			values: ['Code', 'Cart', 'Customer'],
			target: {
				key: 'Customer',
				heading: 'Customers hit',
				nouns: ['customer'],
				page: CUSTOMER_PAGE,
				verbs: ['try', 'tries'],
			},
			halves: {
				first: 'Other codes',
				second: 'SPRINGTEAMS',
				secondWord: 'SPRINGTEAMS',
				isSecond: (row) => row.Code === 'SPRINGTEAMS',
			},
			table: [column('Customer', 'who'), column('Code', 'split', { hideBelow: 'sm' }), column('Cart', 'money')],
			debut: 6,
			debutTime: '08:05',
			fortnight: [
				[0, 0],
				[0, 0],
				[0, 0],
				[0, 0],
				[0, 0],
				[0, 0],
				[5, 5],
				[8, 6],
				[6, 5],
				[9, 7],
				[7, 5],
				[4, 3],
				[6, 4],
				[12, 8],
			],
			fortnightNote: 'Since SPRINGTEAMS ended on Sep 21, most of these are customers still trying it.',
			measure(sample) {
				const cartTotal = sample.reduce((sum, row) => sum + numberIn(row.Cart), 0);
				return [
					'bi-tag',
					'Carts with an old code',
					dollars(cartTotal),
					`${sample.filter(this.halves.isSecond).length} of them tried SPRINGTEAMS`,
				];
			},
			logSite: stackFrame('applyCode', 'billing/discounts.js:74', true, [
				71,
				74,
				'function applyCode(cart, code) {',
				'  const promo = promos.find(code);',
				'  if (promo.expired) {',
				"    log.warn('discount.expired', { code, cart: cart.total });",
				'    return cart;',
			]),
			requestId: 'req_91212cbc9723',
			history: [
				moment(
					'note',
					'bi-chat-left-text',
					'<strong>Alicia Bowen</strong> added a note',
					'Sep 24, 15:10',
					'SPRINGTEAMS ended on Sep 21. Marketing is taking it off the spring emails.',
				),
			],
			samples: [
				['14:30:09', 'SPRINGTEAMS', '$407.78', 'Highpoint Data Works'],
				['14:29:23', 'ANNUAL2FREE', '$196.41', 'Oakhaven Studio'],
				['14:25:55', 'TRIAL20', '$56.73', 'Harborline AI'],
				['14:10:57', 'SPRINGTEAMS', '$348.53', 'Oakhaven Studio'],
				['13:58:05', 'SPRINGTEAMS', '$465.92', 'Brightline Photography'],
				['13:43:25', 'FIRSTSEAT', '$469.55', 'Highpoint Data Works'],
				['13:37:24', 'SPRINGTEAMS', '$321.90', 'Harborline AI'],
			],
		},

		noImage: {
			headline: 'Company logo not found on the customer portal',
			kind: 'warn',
			origin: 'portal',
			state: 'muted',
			mutedUntil: DEMO_MOMENT + 38 * ONE_MINUTE,
			assignee: 'as',
			urgency: 'low',
			sinceNote: 'Open since Sep 16.',
			values: ['File', 'Page'],
			enrich(row) {
				row.Portal = wordsFromSlug(row.Page.replace('/portal/', ''));
			},
			target: {
				key: 'Portal',
				heading: 'Portals hit',
				nouns: ['portal'],
				page: CUSTOMER_PAGE,
				verbs: ['event', 'events'],
			},
			halves: {
				first: 'First time for a portal',
				second: 'Same portal again',
				secondWord: 'again',
				byRepeat: true,
			},
			table: [column('Portal', 'who'), column('File', 'text', { hideBelow: 'md' })],
			debut: 0,
			debutTime: '09:02',
			fortnight: [
				[6, 2],
				[8, 3],
				[5, 1],
				[2, 0],
				[1, 0],
				[7, 2],
				[9, 3],
				[6, 2],
				[8, 3],
				[5, 1],
				[3, 1],
				[2, 0],
				[9, 3],
				[14, 5],
			],
			fortnightNote: 'Every day since the move on Sep 16, mostly the same few portals.',
			measure(sample) {
				return [
					'bi-image',
					'Portals without a logo',
					String(uniqueCount(sample, (row) => row.Portal)),
					'They show the plain Fieldline mark',
				];
			},
			logSite: stackFrame('logoUrl', 'portal/branding.js:42', true, [
				40,
				42,
				'function logoUrl(account) {',
				'  const file = storage.find(account.logo);',
				"  if (!file) log.warn('portal.logo_missing', { file: account.logo });",
				'  return file ? file.url : DEFAULT_LOGO;',
				'}',
			]),
			requestId: 'req_ea85595f1b4c',
			history: [
				moment('', 'bi-bell-slash', '<strong>John Armstrong</strong> muted it until 15:10', 'Today, 14:10'),
				moment(
					'note',
					'bi-chat-left-text',
					'<strong>Alicia Bowen</strong> added a note',
					'Sep 17, 09:30',
					'Logos uploaded before the move on Sep 16 were lost. Customers are being asked to upload them again.',
				),
				moment(
					'owner',
					'bi-person-check',
					'<strong>Alicia Bowen</strong> took it, priority Low',
					'Sep 17, 09:24',
				),
			],
			samples: [
				['14:18:40', 'copperleaf-cleaning-logo-1.png', '/portal/copperleaf-cleaning'],
				['14:15:13', 'highpoint-home-care-logo-2.png', '/portal/highpoint-home-care'],
				['14:15:09', 'larchwood-studios-logo-3.png', '/portal/larchwood-studios'],
				['14:15:04', 'evergreen-landscaping-logo-3.png', '/portal/evergreen-landscaping'],
				['14:08:06', 'northgate-care-logo-1.png', '/portal/northgate-care'],
				['13:57:38', 'copperleaf-cleaning-logo-1.png', '/portal/copperleaf-cleaning'],
				['13:55:59', 'evergreen-landscaping-logo-2.png', '/portal/evergreen-landscaping'],
				['13:55:27', 'polaris-home-care-group-logo-2.png', '/portal/polaris-home-care-group'],
				['13:47:02', 'brightline-photography-logo-3.png', '/portal/brightline-photography'],
				['13:41:08', 'brightline-photography-logo-3.png', '/portal/brightline-photography'],
				['13:34:58', 'moorings-property-group-logo-2.png', '/portal/moorings-property-group'],
			],
		},

		slowSearch: {
			headline: 'Visit search on the schedule board took longer than 2 seconds',
			kind: 'warn',
			origin: 'schedule',
			state: 'open',
			assignee: 'so',
			urgency: 'medium',
			sinceNote: 'Open since Sep 16.',
			values: ['Searched for', 'Took'],
			target: { key: 'Searched for', heading: 'Slow searches', nouns: ['search', 'searches'], verbs: 'slow' },
			halves: {
				first: '2 to 3 seconds',
				second: '3 seconds or more',
				secondWord: 'over 3 s',
				isSecond: (row) => numberIn(row.Took) >= 3,
			},
			table: [column('Searched for', 'who'), column('Took', 'split')],
			debut: 0,
			debutTime: '08:14',
			fortnight: [
				[3, 1],
				[4, 1],
				[2, 0],
				[0, 0],
				[0, 0],
				[5, 2],
				[6, 2],
				[4, 1],
				[3, 1],
				[5, 2],
				[1, 0],
				[0, 0],
				[4, 1],
				[7, 2],
			],
			fortnightNote: 'A few on most weekdays, and quiet at weekends.',
			measure(sample) {
				const slowest = Math.max(...sample.map((row) => numberIn(row.Took)));
				return [
					'bi-hourglass-split',
					'Slowest search',
					`${slowest.toFixed(1)} s`,
					'The aim is under 2 seconds',
				];
			},
			logSite: stackFrame('searchVisits', 'schedule/search.js:117', true, [
				114,
				117,
				'  const started = performance.now();',
				'  const visits = await db.visits.search(query);',
				'  const took = performance.now() - started;',
				"  if (took > 2000) log.warn('schedule.slow_search', { query, took });",
				'  return visits;',
			]),
			requestId: 'req_2a50134d5da0',
			history: [
				moment(
					'note',
					'bi-chat-left-text',
					'<strong>Rory Beasley</strong> added a note',
					'Today, 11:20',
					'Slow when a word matches many old visits. An index on visit notes is in review.',
				),
				moment(
					'owner',
					'bi-person-check',
					'<strong>Rory Beasley</strong> took it, priority Medium',
					'Sep 25, 10:05',
				),
			],
			samples: [
				['14:21:48', '"end of tenancy"', '2.1 s'],
				['13:59:26', '"parking"', '3.0 s'],
				['13:56:52', '"family portrait"', '2.9 s'],
				['13:52:55', '"family portrait"', '3.4 s'],
				['13:44:13', '"parking"', '2.2 s'],
			],
		},

		declined: {
			headline: "Card declined by the customer's bank",
			kind: 'warn',
			origin: 'invoicing',
			state: 'open',
			assignee: '',
			urgency: 'low',
			sinceNote: 'Open since Sep 16. Declines are normal; this group keeps count.',
			values: ['Invoice', 'Customer', 'Reason'],
			target: {
				key: 'Customer',
				heading: 'Customers hit',
				nouns: ['customer'],
				page: CUSTOMER_PAGE,
				verbs: 'declined',
			},
			halves: {
				first: 'Bank said no',
				second: 'Card reported lost',
				secondWord: 'card lost',
				isSecond: (row) => row.Reason === 'Card reported lost',
			},
			table: [
				column('Customer', 'who'),
				column('Invoice', 'link', { page: 'invoice-details.html', hideBelow: 'md' }),
				column('Reason', 'split', { hideBelow: 'sm' }),
			],
			debut: 0,
			debutTime: '07:12',
			fortnight: [
				[11, 1],
				[14, 2],
				[9, 1],
				[4, 0],
				[3, 0],
				[12, 1],
				[15, 2],
				[13, 1],
				[10, 1],
				[12, 2],
				[6, 0],
				[4, 1],
				[14, 2],
				[18, 3],
			],
			fortnightNote: 'Ten to fifteen on most weekdays and fewer at weekends, as usual for card payments.',
			measure(sample) {
				const lostCards = sample.filter(this.halves.isSecond).length;
				return [
					'bi-credit-card-2-back',
					'Invoices declined',
					String(sample.length),
					`${countOf(lostCards, 'card')} reported lost`,
				];
			},
			logSite: stackFrame('onDecline', 'billing/charge.js:64', true, [
				62,
				64,
				'function onDecline(invoice, reply) {',
				'  invoices.markUnpaid(invoice.id);',
				"  log.warn('card.declined', { invoice: invoice.number, reason: reply.reason });",
				"  return mail.send('update-card', invoice.customer);",
				'}',
			]),
			requestId: 'req_b5bac64c946d',
			history: [
				moment(
					'note',
					'bi-chat-left-text',
					'<strong>Alicia Bowen</strong> added a note',
					'Sep 20, 16:00',
					'Expected: the bank said no. Each customer gets the usual email to update their card.',
				),
			],
			samples: [
				['14:22:11', '#30822', 'Highpoint Outfitters', 'Insufficient funds'],
				['14:21:17', '#30821', 'Harborline AI', 'Insufficient funds'],
				['14:21:05', '#30819', 'Ironbridge Fintech', 'Do not honor'],
				['14:17:24', '#30815', 'Copperleaf Design', 'Do not honor'],
				['14:14:25', '#30808', 'Copperleaf Design', 'Card reported lost'],
				['14:13:13', '#30806', 'Highpoint Data Works', 'Insufficient funds'],
				['14:11:16', '#30802', 'Polaris Running Co. Group', 'Do not honor'],
				['13:59:12', '#30786', 'Oakhaven Studio', 'Card reported lost'],
				['13:58:17', '#30782', 'Harborline AI', 'Do not honor'],
				['13:57:51', '#30781', 'Larchwood Studios', 'Do not honor'],
				['13:50:45', '#30743', 'Oakhaven Studio', 'Do not honor'],
				['13:49:46', '#30735', 'Cornerstone Logistics', 'Card reported lost'],
				['13:38:09', '#30723', 'Evergreen Landscaping', 'Do not honor'],
			],
		},

		lowStock: {
			headline: 'An account is running low on SMS credits',
			kind: 'warn',
			origin: 'sms',
			state: 'open',
			assignee: 'as',
			urgency: 'low',
			sinceNote: 'Open since Sep 16. Each account gets a reminder to top up.',
			values: ['Customer', 'Left', 'Sends'],
			target: {
				key: 'Customer',
				heading: 'Customers hit',
				nouns: ['customer'],
				page: CUSTOMER_PAGE,
				verbs: ['alert', 'alerts'],
			},
			halves: {
				first: 'A day or more left',
				second: 'Runs out within a day',
				secondWord: 'under a day',
				isSecond: (row) => numberIn(row.Left) < numberIn(row.Sends),
			},
			table: [
				column('Customer', 'who'),
				column('Credits left', 'split', { key: 'Left' }),
				column('Sends', 'text', { hideBelow: 'md' }),
			],
			debut: 0,
			debutTime: '09:40',
			fortnight: [
				[4, 2],
				[5, 3],
				[3, 1],
				[1, 0],
				[1, 0],
				[5, 3],
				[6, 4],
				[5, 3],
				[4, 2],
				[6, 4],
				[2, 1],
				[1, 0],
				[7, 4],
				[13, 9],
			],
			fortnightNote: 'A handful on most weekdays, as busy accounts use up their credits.',
			measure(sample) {
				const daysLeft = (row) => numberIn(row.Left) / numberIn(row.Sends);
				const soonest = [...sample].sort((one, two) => daysLeft(one) - daysLeft(two))[0];
				return [
					'bi-chat-dots',
					'Runs out soonest',
					soonest.Left,
					`${soonest.Customer}, in about ${Math.round(daysLeft(soonest) * 24)} hours`,
				];
			},
			logSite: stackFrame('checkBalance', 'sms/credits.js:29', true, [
				27,
				29,
				'function checkBalance(account) {',
				'  const left = account.smsCredits;',
				"  if (left < account.dailySends * 2) log.warn('sms.credits_low', { left });",
				'  return left;',
				'}',
			]),
			requestId: 'req_c15fe4cff817',
			history: [
				moment('alert', 'bi-envelope-exclamation', 'Sent a top-up reminder to 6 accounts', 'Today, 14:31'),
				moment(
					'owner',
					'bi-person-check',
					'<strong>Alicia Bowen</strong> took it, priority Low',
					'Sep 21, 10:00',
				),
			],
			samples: [
				['14:30:53', 'Avocet Robotics', '62 credits', '46 a day'],
				['14:30:15', 'Highpoint Outfitters', '68 credits', '116 a day'],
				['14:27:00', 'Copperleaf Design', '74 credits', '46 a day'],
				['14:21:38', 'Ironbridge Fintech', '59 credits', '62 a day'],
				['14:06:58', 'Avocet Robotics', '82 credits', '88 a day'],
				['14:06:52', 'Copperleaf Design', '86 credits', '108 a day'],
				['14:05:15', 'Evergreen Landscaping', '76 credits', '75 a day'],
				['13:41:55', 'Avocet Robotics', '80 credits', '108 a day'],
				['13:41:50', 'Copperleaf Design', '47 credits', '53 a day'],
				['13:36:40', 'Highpoint Outfitters', '90 credits', '101 a day'],
				['13:35:15', 'Brightline Photography', '42 credits', '81 a day'],
			],
		},
	};

	/* What the page knows once the group is chosen. Filled by mount() and
     read by every paint function after it. */
	let group;
	let origin;
	let isFailure;
	let events;
	let ranking;
	let releaseRows;
	let timeline;
	let triage;
	let cluster;
	let cadence;
	let newest;
	let newestMs;
	let recentCount;

	let barChart = null;
	let range = 'hour';
	const expanded = { events: false, customers: false };

	/**
	 * Reads the group from the URL, derives everything the cards need, wires
	 * every control and paints the page once.
	 */
	function start() {
		group = groupFor(new URLSearchParams(location.search).get('id'));
		origin = ORIGINS[group.origin];
		isFailure = group.kind === 'error';
		shell.classList.add(`ed-page-${group.kind}`);

		events = group.samples.map(eventFromRow);
		markSecondHalf();
		ranking = rankTargets();
		releaseRows = releasesTouched();
		timeline = [...group.history, firstSightingMoment()];
		triage = {
			status: group.state,
			until: group.mutedUntil || 0,
			owner: group.assignee,
			priority: group.urgency,
			resolvedAt: group.closedAt || '',
			resolvedBy: group.closedBy || '',
		};

		cluster = busiestStretch();
		cadence = `about one every ${Math.round(60 / events.length)} minutes`;
		newest = events[0];
		newestMs = new Date(DEMO_MOMENT).setHours(...newest.time.split(':').map(Number));
		recentCount = events.filter((row) => row.time >= `${clockOf(DEMO_MOMENT - 5 * ONE_MINUTE)}:10`).length;

		paintHeader();
		wireStatusActions();
		wireTriageForm();
		wireTraceCopy();
		paintEventsFrame();
		wireShowMore();
		paintReleases();
		wireNoteForm();
		paintLegend();
		wireChartControls();

		paintStatus();
		paintGlance();
		paintTrace();
		paintEvents();
		paintRanking();
		paintTimeline();
		paintChart(true);

		/* First view only: the figures count up (the fourth is a time), and
		   the trace, tables, ranking and feed come in row by row. */
		window.Basalt.countUp?.(pickAll('.ed-fig-value', slot('figs')).slice(0, 3));
		for (const name of ['trace', 'releases', 'events', 'customers', 'activity']) playOnSight(slot(name));

		/* A mute runs out by itself; look once a minute. */
		setInterval(() => {
			if (triage.status === 'muted') paintStatus();
		}, ONE_MINUTE);
	}

	/* DOM and shared-helper shorthands. */

	function pick(selector, scope = shell) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = shell) {
		return [...scope.querySelectorAll(selector)];
	}

	/** The element the page marks with data-ed="name". */
	function slot(name) {
		return pick(`[data-ed="${name}"]`);
	}

	/** The button the page marks with data-ed-act="name". */
	function action(name) {
		return pick(`[data-ed-act="${name}"]`);
	}

	function paintPill(pill, classes, label) {
		pill.className = classes;
		pill.textContent = label;
	}

	function prefersStillness() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/**
	 * Marks a block to play its entrance the first time it is on screen; the
	 * styles say what moves. Later repaints of the block show it as it is.
	 * @param {HTMLElement} block
	 */
	function playOnSight(block) {
		if (prefersStillness() || !('IntersectionObserver' in window)) return;
		block.classList.add('is-waiting');
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				block.classList.replace('is-waiting', 'is-drawing');
				const runs = block
					.getAnimations({ subtree: true })
					.filter((run) => run.animationName?.startsWith('ed-in-'));
				Promise.allSettled(runs.map((run) => run.finished)).then(() => block.classList.remove('is-drawing'));
			},
			{ threshold: 0.2 },
		);
		watch.observe(block);
	}

	function sayAloud(text) {
		window.Basalt.announce?.(text);
	}

	function toastNote(options) {
		window.Basalt.toasts?.push(options);
	}

	function putOnClipboard(text) {
		return window.Basalt.copyText?.(text) ?? Promise.resolve();
	}

	function cssToken(name, fallback) {
		return window.Basalt.token?.(name, fallback) ?? fallback;
	}

	/* Text and number formatting. */

	function safeText(value) {
		const swap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (char) => swap[char]);
	}

	function countOf(amount, singular, pluralForm = `${singular}s`) {
		return `${amount} ${amount === 1 ? singular : pluralForm}`;
	}

	function capitalized(text) {
		return text.replace(/^./, (char) => char.toUpperCase());
	}

	function numberIn(text) {
		return parseFloat(String(text).replace(/[^0-9.]/g, '')) || 0;
	}

	function dollars(amount, wholeOnly = false) {
		const digits = wholeOnly ? 0 : 2;
		return `$${amount.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
	}

	function uniqueCount(list, keyOf) {
		return new Set(list.map(keyOf)).size;
	}

	function wordsFromSlug(slug) {
		return slug
			.split('-')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	/* Time: the demo clock and the two ways a time is written. Log times keep
     their 24-hour form; prose uses 12-hour times. */

	function demoNow() {
		return DEMO_MOMENT + (Date.now() - openedAt);
	}

	function twoDigits(amount) {
		return String(amount).padStart(2, '0');
	}

	function clockOf(ms) {
		const at = new Date(ms);
		return `${twoDigits(at.getHours())}:${twoDigits(at.getMinutes())}`;
	}

	/** Rewrites every "14:05" in a text as "2:05 pm"; times with seconds stay. */
	function toTwelveHour(text) {
		return String(text).replace(
			/\b([01]\d|2[0-3]):([0-5]\d)\b(?!:\d)/g,
			(whole, hour, minute) => `${hour % 12 || 12}:${minute}${hour < 12 ? ' am' : ' pm'}`,
		);
	}

	/** "1:52 and 1:58 pm" when both sit in the same half of the day. */
	function hourRange(start, end) {
		const from = toTwelveHour(start);
		const to = toTwelveHour(end);
		return from.slice(-2) === to.slice(-2) ? `${from.slice(0, -3)} and ${to}` : `${from} and ${to}`;
	}

	/* Shaping the group's data. */

	function groupFor(id) {
		return Object.keys(CATALOG).includes(id) ? CATALOG[id] : CATALOG.payTimeout;
	}

	function eventFromRow(row) {
		const [time, ...rest] = row;
		const event = { time };
		for (const [index, name] of group.values.entries()) event[name] = rest[index];
		group.enrich?.(event);
		return event;
	}

	/** Flags each event that takes the second color; by repeat, that is a
      target already hit by an older event. */
	function markSecondHalf() {
		const { halves, target } = group;
		for (const [index, event] of events.entries()) {
			event.second = halves.byRepeat
				? events.slice(index + 1).some((older) => older[target.key] === event[target.key])
				: halves.isSecond(event);
		}
	}

	function rankTargets() {
		const tally = new Map();
		for (const event of events) {
			const name = event[group.target.key];
			const entry = tally.get(name) || { name, count: 0, second: 0 };
			entry.count += 1;
			if (event.second) entry.second += 1;
			tally.set(name, entry);
		}
		return [...tally.values()].sort(
			(one, two) => two.count - one.count || two.second - one.second || one.name.localeCompare(two.name),
		);
	}

	/** The releases with events of this group, newest first. */
	function releasesTouched() {
		const rows = RELEASES.map((release, index) => {
			const endDay = RELEASES[index + 1]?.fromDay ?? FORTNIGHT.length;
			let count = 0;
			for (let day = Math.max(release.fromDay, group.debut); day < endDay; day++)
				count += group.fortnight[day][0];
			return {
				name: `${origin[1]} ${release.tag}`,
				shipped: release.shipped,
				shippedBy: release.shippedBy,
				count,
				debut: group.debut >= release.fromDay && group.debut < endDay,
			};
		});
		return rows.filter((row, index) => row.count > 0 || RELEASES[index].fromDay >= group.debut).reverse();
	}

	function firstSightingMoment() {
		const debutRelease = releaseRows.find((row) => row.debut);
		return moment(
			'',
			'bi-flag',
			`First seen, in ${debutRelease ? debutRelease.name : origin[1]}`,
			`${FORTNIGHT[group.debut]}, ${group.debutTime}`,
		);
	}

	function minuteKey(event) {
		return event.time.slice(0, 5);
	}

	/** The busiest seven minutes of the hour, when they hold at least half
      of its events; otherwise null. */
	function busiestStretch() {
		let best = null;
		for (const event of events) {
			const start = minuteKey(event);
			const [hour, minute] = start.split(':').map(Number);
			const stop = `${twoDigits(hour + Math.floor((minute + 6) / 60))}:${twoDigits((minute + 6) % 60)}`;
			const within = events.filter((other) => minuteKey(other) >= start && minuteKey(other) <= stop);
			if (!best || within.length > best.count) best = { count: within.length, start, end: minuteKey(within[0]) };
		}
		return events.length >= 6 && best.count >= events.length / 2 ? best : null;
	}

	/* The header. */

	function paintHeader() {
		const lifetime = group.fortnight.reduce((sum, day) => sum + day[0], 0);
		slot('title').textContent = group.headline;
		slot('desc').textContent =
			`${origin[0]} · first seen ${FORTNIGHT[group.debut]}, 2026 · ${countOf(lifetime, 'event')} in all`;
		paintPill(
			slot('level'),
			`basalt-status basalt-status-dot ${isFailure ? 'basalt-status-danger' : 'basalt-status-warning'}`,
			isFailure ? 'Error' : 'Warning',
		);
	}

	/* Status: the header pill, the notice under it, the Status and owner card
     and the buttons that move it along. */

	function currentStatus() {
		if (triage.status === 'muted' && triage.until <= demoNow()) {
			triage.status = 'open';
			triage.until = 0;
		}
		return triage.status;
	}

	function statusCaption(status) {
		const captions = {
			muted: () => `Until ${toTwelveHour(clockOf(triage.until))}, then it opens again.`,
			resolved: () => `By ${safeText(triage.resolvedBy)} at ${toTwelveHour(triage.resolvedAt)}.`,
			open: () => group.sinceNote,
		};
		return captions[status]();
	}

	function avatarMarkup(person) {
		return `<span class="basalt-avatar basalt-avatar-tone-${person.tone}" aria-hidden="true">${person.initials}</span>`;
	}

	function personMarkup(person) {
		if (!person) return '<span class="ed-facts-empty">Nobody yet</span>';
		return `<span class="ed-person">${avatarMarkup(person)}<span><a class="ed-name" href="employee-user-details.html">${safeText(person.name)}</a><span class="ed-sub">${safeText(person.role)}</span></span></span>`;
	}

	function paintStatus() {
		const status = currentStatus();
		const { tone, label } = STATUS_PILL[status];
		const owner = TEAM[triage.owner];

		paintPill(slot('stp-pill'), `basalt-status ${tone}`, label);
		slot('owner-tag').innerHTML = owner
			? `Assigned to <strong>${safeText(owner.name)}</strong>`
			: 'Nobody assigned yet';

		action('resolve').innerHTML =
			status === 'resolved'
				? '<i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Reopen'
				: '<i class="bi bi-check2 me-1" aria-hidden="true"></i>Mark resolved';
		action('mute').disabled = status === 'resolved';
		slot('mute-label').textContent = status === 'muted' ? 'Unmute' : 'Mute for an hour';

		const notice = slot('notice');
		notice.hidden = status === 'open';
		notice.className = `ed-notice${status === 'resolved' ? ' ed-notice-success' : ''}`;
		if (status === 'muted')
			notice.innerHTML = `<i class="bi bi-bell-slash" aria-hidden="true"></i><span>Muted until ${toTwelveHour(clockOf(triage.until))}. New events still count, but nobody gets an email.</span>`;
		if (status === 'resolved')
			notice.innerHTML = `<i class="bi bi-check2-circle" aria-hidden="true"></i><span>Resolved at ${toTwelveHour(triage.resolvedAt)}. If it happens again, it opens by itself and emails the team.</span>`;

		const urgency = URGENCY[triage.priority];
		slot('triage-view').innerHTML =
			`<div><dt>Status</dt><dd class="ed-facts-stack"><span class="basalt-status ${tone}">${label}</span><span class="ed-facts-note">${statusCaption(status)}</span></dd></div>` +
			`<div><dt>Assigned to</dt><dd>${personMarkup(owner)}</dd></div>` +
			`<div><dt>Priority</dt><dd><span class="ed-prio ed-prio-${triage.priority}"><i class="bi ${urgency.glyph}" aria-hidden="true"></i>${urgency.label}</span></dd></div>`;
	}

	/** Moves the group to another status and says what happened, in words
      that follow "John Armstrong". */
	function transitionTo(status) {
		triage.until = status === 'muted' ? demoNow() + 60 * ONE_MINUTE : 0;
		triage.resolvedAt = status === 'resolved' ? clockOf(demoNow()) : '';
		triage.resolvedBy = status === 'resolved' ? 'John Armstrong' : '';
		triage.status = status;
		const said = {
			open: 'reopened it',
			muted: `muted it until ${toTwelveHour(clockOf(triage.until))}`,
			resolved: 'marked it resolved',
		};
		return said[status];
	}

	function switchState(status, toastTitle) {
		const before = { ...triage };
		const said = transitionTo(status);
		const glyphs = { open: 'bi-arrow-counterclockwise', muted: 'bi-bell-slash', resolved: 'bi-check2-circle' };
		paintStatus();
		logMoment(
			moment(status === 'resolved' ? 'done' : '', glyphs[status], `<strong>John Armstrong</strong> ${said}`),
		);
		toastNote({
			tone: status === 'resolved' ? 'success' : 'info',
			title: toastTitle,
			text: group.headline,
			actions: [
				{
					label: 'Undo',
					onClick() {
						Object.assign(triage, before);
						timeline.shift();
						paintStatus();
						paintTimeline();
						sayAloud('Undone');
					},
				},
			],
		});
	}

	function wireStatusActions() {
		action('resolve').addEventListener('click', () => {
			if (currentStatus() === 'resolved') switchState('open', 'Group reopened');
			else switchState('resolved', 'Marked resolved');
		});
		action('mute').addEventListener('click', () => {
			if (currentStatus() === 'muted') switchState('open', 'Group unmuted');
			else switchState('muted', 'Muted for an hour');
		});
		action('link').addEventListener('click', () => {
			const permalink = location.href.split('#')[0];
			putOnClipboard(permalink).then(() => toastNote({ tone: 'success', title: 'Link copied', duration: 2500 }));
		});
	}

	/* Editing status, owner and priority together in the Status and owner
     card. */

	function wireTriageForm() {
		const facts = slot('triage-view');
		const editor = slot('triage-form');
		const editButton = action('edit');
		const ownerPicker = slot('owner-select');

		function tickRadio(name, value) {
			const radio = pick(`input[name="${name}"][value="${value}"]`, editor);
			radio.checked = true;
			radio.dispatchEvent(new Event('change', { bubbles: true }));
		}

		function beginEditing() {
			facts.hidden = true;
			editor.hidden = false;
			editButton.hidden = true;
			tickRadio('ed-f-status', currentStatus());
			tickRadio('ed-f-priority', triage.priority);
			ownerPicker.value = triage.owner;
			window.Basalt.select?.refresh?.(ownerPicker);
			pick('input[name="ed-f-status"]:checked', editor)?.focus();
		}

		function endEditing() {
			editor.hidden = true;
			facts.hidden = false;
			editButton.hidden = false;
			editButton.focus();
		}

		function saveEdits(submitEvent) {
			submitEvent.preventDefault();
			const status = pick('input[name="ed-f-status"]:checked', editor).value;
			const priority = pick('input[name="ed-f-priority"]:checked', editor).value;
			const owner = ownerPicker.value;
			const changes = [];
			if (owner !== triage.owner) changes.push(owner ? `gave it to ${TEAM[owner].name}` : 'left it unassigned');
			if (priority !== triage.priority) changes.push(`set priority ${URGENCY[priority].label}`);
			if (status !== currentStatus()) changes.push(transitionTo(status));
			triage.owner = owner;
			triage.priority = priority;
			paintStatus();
			endEditing();
			if (!changes.length) {
				sayAloud('Nothing changed');
				return;
			}
			const summary = changes.join(', ');
			logMoment(moment('owner', 'bi-pencil', `<strong>John Armstrong</strong> ${summary}`));
			toastNote({ tone: 'success', title: 'Saved', text: `${capitalized(summary)}.`, duration: 4000 });
		}

		editButton.addEventListener('click', beginEditing);
		action('cancel').addEventListener('click', endEditing);
		editor.addEventListener('submit', saveEdits);
	}

	/* At a glance: four figures worked out from the hour. */

	function paintGlance() {
		const repeatTargets = ranking.filter((entry) => entry.count > 1).length;
		const quietMinutes = Math.round((DEMO_MOMENT - newestMs) / ONE_MINUTE);
		const hourNote = group.hourOverride
			? toTwelveHour(group.hourOverride)
			: cluster
				? `${cluster.count} of them between ${hourRange(cluster.start, cluster.end)}`
				: capitalized(cadence);
		const measured = group.measure(events).map((part, index) => (index === 3 ? toTwelveHour(part) : part));
		const figures = [
			['bi-lightning-charge', 'This hour', countOf(events.length, 'event'), hourNote],
			[
				'bi-people',
				group.target.heading,
				String(ranking.length),
				repeatTargets ? `${repeatTargets} of them more than once` : 'Each one once',
			],
			measured,
			[
				'bi-clock-history',
				'Last seen',
				toTwelveHour(newest.time.slice(0, 5)),
				recentCount
					? `<span class="ed-fig-live">${recentCount} in the last five minutes</span>`
					: `None in the last ${quietMinutes} minutes`,
			],
		];
		slot('figs').innerHTML = figures
			.map(
				([glyph, label, value, note], index) =>
					`<div class="ed-fig ed-fig-${index + 1}"><dt class="ed-fig-label"><i class="bi ${glyph}" aria-hidden="true"></i>${safeText(label)}</dt><dd class="ed-fig-value">${safeText(value)}</dd><dd class="ed-fig-note">${index === 3 ? note : safeText(note)}</dd></div>`,
			)
			.join('');
	}

	/* The stack trace, or for a warning the latest event and where it is
     logged. */

	function excerptMarkup(frame) {
		const [firstLine, failingLine, ...lines] = frame.excerpt;
		const rows = lines
			.map((line, offset) => {
				const number = firstLine + offset;
				const inner = `<span class="ed-code-ln">${number}</span>${safeText(line)}`;
				return number === failingLine
					? `<mark class="ed-code-row ed-code-hit">${inner}</mark>`
					: `<span class="ed-code-row">${inner}</span>`;
			})
			.join('');
		const [file] = frame.location.split(':');
		return `<pre class="ed-code" tabindex="0" role="region" aria-label="Source around line ${failingLine} of ${safeText(file)}"><code>${rows}</code></pre>`;
	}

	function frameMarkup(frame) {
		const badge = frame.ours ? '<span class="ed-frame-tag">Our code</span>' : '';
		return `<li class="ed-frame${frame.ours ? ' is-app' : ''}"><p class="ed-frame-line"><span class="ed-frame-fn">${safeText(frame.caller)}</span><span class="ed-frame-file">${safeText(frame.location)}</span>${badge}</p>${frame.excerpt ? excerptMarkup(frame) : ''}</li>`;
	}

	function plainTrace() {
		if (!group.crash) {
			const lines = group.values.map((name) => `${name}: ${newest[name]}`);
			return [group.headline, ...lines, `Request ID: ${group.requestId}`].join('\n');
		}
		const calls = group.crash.stack.map((frame) => `    at ${frame.caller} (${frame.location})`);
		return [`${group.crash.name}: ${group.crash.message}`, ...calls].join('\n');
	}

	function paintTrace() {
		const body = slot('trace');
		const title = slot('trace-title');
		const caption = slot('trace-desc');
		if (group.crash) {
			title.textContent = 'Stack trace';
			caption.textContent = `From the latest event, at ${newest.time}. Fieldline’s own code is marked.`;
			body.innerHTML =
				`<div class="ed-exc"><p class="ed-exc-type">${safeText(group.crash.name)}</p><p class="ed-exc-msg">${safeText(group.crash.message)}</p></div>` +
				`<ol class="ed-frames" aria-label="Stack frames, where it failed first">${group.crash.stack.map(frameMarkup).join('')}</ol>` +
				`<p class="ed-trace-foot">Same trace in all ${countOf(events.length, 'event')} this hour · Request <code>${group.requestId}</code></p>`;
			return;
		}
		title.textContent = 'Latest event';
		caption.textContent = `At ${newest.time}. Warnings are logged without a stack trace.`;
		const facts = group.values
			.map((name) => `<div><dt>${safeText(name)}</dt><dd>${safeText(newest[name])}</dd></div>`)
			.join('');
		body.innerHTML =
			`<div class="ed-exc"><p class="ed-exc-type">Warning</p><p class="ed-exc-msg">${safeText(group.headline)}</p></div>` +
			`<dl class="ed-facts ed-facts-event">${facts}<div><dt>Request ID</dt><dd><code class="ed-req">${group.requestId}</code></dd></div></dl>` +
			`<h3 class="ed-section ed-logged">Where it is logged</h3><ol class="ed-frames" aria-label="Where it is logged">${frameMarkup(group.logSite)}</ol>`;
	}

	function wireTraceCopy() {
		action('copy-trace').addEventListener('click', () => {
			putOnClipboard(plainTrace()).then(() =>
				toastNote({
					tone: 'success',
					title: group.crash ? 'Stack trace copied' : 'Event copied',
					duration: 2500,
				}),
			);
		});
	}

	/* Sample events: the hour's events, six at a time. */

	function columnClasses(spec) {
		const hide = { md: 'ed-col-md', sm: 'ed-col-sm' }[spec.hideBelow];
		const numeric = spec.shape === 'money' || spec.shape === 'num';
		return [hide, numeric ? 'text-end' : ''].filter(Boolean).join(' ');
	}

	function targetLink(name, extraClass = '') {
		const classes = extraClass ? `ed-name ${extraClass}` : 'ed-name';
		return group.target.page
			? `<a class="${classes}" href="${group.target.page}">${safeText(name)}</a>`
			: `<span class="${classes}">${safeText(name)}</span>`;
	}

	function cellMarkup(spec, event) {
		const value = event[spec.key];
		const classes = columnClasses(spec);
		const renderers = {
			who() {
				const tucked = group.table.find((other) => other.hideBelow === 'md');
				return `<td class="ed-cell-wrap">${targetLink(value)}<span class="ed-sub">${tucked ? safeText(event[tucked.key]) : ''}<span class="ed-sub-time">${tucked ? ' · ' : ''}${event.time}</span></span></td>`;
			},
			link: () => `<td class="${classes}"><a class="ed-link" href="${spec.page}">${safeText(value)}</a></td>`,
			money: () => `<td class="${classes}">${dollars(numberIn(value))}</td>`,
			split: () =>
				`<td class="${classes}"><span class="ed-try${event.second ? ' ed-try-b' : ''}">${safeText(spec.display ? spec.display(event) : value)}</span></td>`,
		};
		const render = renderers[spec.shape] || (() => `<td class="${classes}">${safeText(value)}</td>`);
		return render();
	}

	function paintEventsFrame() {
		const headers = group.table
			.map((spec) => `<th scope="col" class="${columnClasses(spec)}">${safeText(spec.heading)}</th>`)
			.join('');
		slot('events-head').innerHTML = `<tr><th scope="col" class="ed-col-time">Time</th>${headers}</tr>`;
		slot('events-desc').textContent =
			events.length > PREVIEW_ROWS
				? `The latest of ${events.length} this hour, newest first.`
				: `${countOf(events.length, 'event')} this hour, newest first.`;
	}

	function paintMoreButton(which, total) {
		const button = pick(`[data-ed-more="${which}"]`);
		button.hidden = total <= PREVIEW_ROWS;
		button.textContent = expanded[which] ? 'Show fewer' : `Show all ${total}`;
		button.setAttribute('aria-expanded', String(expanded[which]));
	}

	function paintEvents() {
		const rows = expanded.events ? events : events.slice(0, PREVIEW_ROWS);
		slot('events').innerHTML = rows
			.map(
				(event) =>
					`<tr><td class="ed-time ed-col-time">${event.time}</td>${group.table.map((spec) => cellMarkup(spec, event)).join('')}</tr>`,
			)
			.join('');
		paintMoreButton('events', events.length);
	}

	/* Who it hit: each target with a bar for its share of the hour. */

	function verbFor(count) {
		const { verbs } = group.target;
		return Array.isArray(verbs) ? verbs[count === 1 ? 0 : 1] : verbs;
	}

	function nounPhrase(count) {
		return countOf(count, ...group.target.nouns);
	}

	function rankItemMarkup(entry, longest) {
		const firstShare = entry.count - entry.second;
		const secondWord =
			entry.second && group.halves.secondWord ? ` · ${entry.second} ${group.halves.secondWord}` : '';
		const segments =
			(entry.second
				? `<span class="ed-rank-seg ed-rank-seg-b" style="width:${(entry.second / longest) * 100}%"></span>`
				: '') +
			(firstShare
				? `<span class="ed-rank-seg ed-rank-seg-a" style="width:${(firstShare / longest) * 100}%"></span>`
				: '');
		return `<li class="ed-rank-item">${targetLink(entry.name, 'ed-rank-name')}<span class="ed-rank-count"><strong>${entry.count}</strong> ${verbFor(entry.count)}${secondWord}</span><span class="ed-rank-bar" aria-hidden="true">${segments}</span></li>`;
	}

	function paintRanking() {
		const longest = ranking[0].count;
		const rows = expanded.customers ? ranking : ranking.slice(0, PREVIEW_ROWS);
		slot('cust-title').textContent = group.target.heading;
		slot('cust-desc').textContent = `${capitalized(nounPhrase(ranking.length))}, most events first.`;
		slot('customers').innerHTML = rows.map((entry) => rankItemMarkup(entry, longest)).join('');
		paintMoreButton('customers', ranking.length);
	}

	function wireShowMore() {
		const repaint = { events: paintEvents, customers: paintRanking };
		/* The events table slides inside its card body, the ranking list on its own. */
		const region = { events: slot('events').closest('table').parentElement, customers: slot('customers') };
		for (const button of pickAll('[data-ed-more]')) {
			button.addEventListener('click', () => {
				const which = button.getAttribute('data-ed-more');
				window.Basalt.slide(region[which], () => {
					expanded[which] = !expanded[which];
					repaint[which]();
				});
			});
		}
	}

	/* Releases, inside the Status and owner card. */

	function paintReleases() {
		slot('rel-caption').textContent = `${origin[0]} releases where this happened`;
		slot('releases').innerHTML = releaseRows
			.map((row, index) => {
				const pill =
					index === 0
						? '<span class="basalt-status ed-rel-pill">Latest</span>'
						: row.debut
							? '<span class="basalt-status ed-rel-pill">First seen</span>'
							: '';
				return `<tr><td class="ed-cell-wrap"><span class="ed-rel-name">${safeText(row.name)}</span>${pill}<span class="ed-sub">${toTwelveHour(row.shipped)}</span></td><td class="ed-col-by">${toTwelveHour(row.shipped)}<span class="ed-meta">by ${safeText(row.shippedBy)}</span></td><td class="text-end">${row.count}</td></tr>`;
			})
			.join('');
	}

	/* Activity: the feed and the note box beside it. */

	function logMoment(item) {
		timeline.unshift({ ...item, stamp: item.stamp || `Today, ${clockOf(demoNow())}` });
		paintTimeline();
	}

	function paintTimeline() {
		slot('activity').innerHTML = timeline
			.map((item) => {
				const glyphClass = item.tone ? `ed-feed-icon ed-feed-icon-${item.tone}` : 'ed-feed-icon';
				const quote = item.quote
					? `<span class="ed-feed-quote">${safeText(toTwelveHour(item.quote))}</span>`
					: '';
				return `<li class="ed-feed-item"><span class="${glyphClass}" aria-hidden="true"><i class="bi ${item.glyph}"></i></span><p class="ed-feed-text mb-0"><span>${toTwelveHour(item.html)}</span>${quote}<span class="ed-feed-time">${toTwelveHour(item.stamp)}</span></p></li>`;
			})
			.join('');
	}

	function wireNoteForm() {
		const noteBox = slot('note-form');
		const noteField = slot('note');
		noteBox.addEventListener('submit', (submitEvent) => {
			submitEvent.preventDefault();
			const text = noteField.value.trim();
			noteField.classList.toggle('is-invalid', !text);
			if (!text) {
				noteField.focus();
				return;
			}
			logMoment(
				moment('note', 'bi-chat-left-text', '<strong>John Armstrong</strong> added a note', undefined, text),
			);
			noteField.value = '';
			toastNote({ tone: 'success', title: 'Note added', duration: 2500 });
		});
		noteField.addEventListener('input', () => noteField.classList.remove('is-invalid'));
	}

	/* How often: a stacked bar chart of the last hour by minute, or the last
     two weeks by day. */

	function paintLegend() {
		slot('legend').innerHTML =
			`<li><span class="ed-legend-swatch ed-tone-a" aria-hidden="true"></span>${safeText(group.halves.first)}</li>` +
			`<li><span class="ed-legend-swatch ed-tone-b" aria-hidden="true"></span>${safeText(group.halves.second)}</li>`;
		pick('[data-ed-chart]').setAttribute(
			'aria-label',
			`Events over time, split into ${group.halves.first.toLowerCase()} and ${group.halves.second.toLowerCase()}.`,
		);
	}

	/** Chart.js paints on a canvas, so a token has to become plain rgba(). */
	function tint(color, alpha) {
		const raw = String(color || '').trim();
		let channels = [128, 128, 128];
		const hex = /^#([0-9a-f]{6})$/i.exec(raw);
		if (hex) {
			const packed = parseInt(hex[1], 16);
			channels = [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
		}
		const rgb = /^rgba?\(([^)]+)\)$/i.exec(raw);
		if (rgb)
			channels = rgb[1]
				.split(',')
				.slice(0, 3)
				.map((part) => parseFloat(part));
		return `rgba(${channels.join(', ')}, ${alpha})`;
	}

	function chartSeries() {
		if (range === 'days') {
			return {
				labels: FORTNIGHT,
				second: group.fortnight.map((day) => day[1]),
				first: group.fortnight.map((day) => day[0] - day[1]),
			};
		}
		const lastMinute = Math.floor(DEMO_MOMENT / ONE_MINUTE) * ONE_MINUTE;
		const labels = [];
		for (let back = 59; back >= 0; back--) labels.push(clockOf(lastMinute - back * ONE_MINUTE));
		const first = labels.map(() => 0);
		const second = labels.map(() => 0);
		for (const event of events) {
			const slot = labels.indexOf(minuteKey(event));
			if (slot < 0) continue;
			if (event.second) second[slot] += 1;
			else first[slot] += 1;
		}
		return { labels, first, second };
	}

	function paintOftenCaption() {
		let caption;
		if (range === 'days') caption = toTwelveHour(group.fortnightNote);
		else if (group.hourOverride)
			caption = `${countOf(events.length, 'event')} this hour. ${toTwelveHour(group.hourOverride)}.`;
		else if (cluster)
			caption = `${cluster.count} of the ${events.length} came between ${hourRange(cluster.start, cluster.end)}${group.because || ''}.`;
		else caption = `${countOf(events.length, 'event')} this hour, ${cadence}${group.because || ''}.`;
		slot('often-desc').textContent = caption;
	}

	function paintChart(animate) {
		paintOftenCaption();
		if (!window.Chart) return;
		barChart?.destroy();

		const ink = cssToken('--basalt-copy', '#12233a');
		const quiet = cssToken('--basalt-copy-muted', '#5f7186');
		const series = chartSeries();
		const perDay = range === 'days';
		const tickStyle = { color: quiet, font: { family: TYPEFACE, size: 11.5 }, padding: 6 };
		const barStyle = {
			borderRadius: 3,
			borderSkipped: false,
			stack: 'all',
			barPercentage: perDay ? 0.6 : 0.78,
			categoryPercentage: 0.92,
		};
		const [firstToken, secondToken] = isFailure
			? ['--basalt-warning', '--basalt-danger']
			: ['--basalt-series-1', '--basalt-warning'];
		const tooltipStyle = {
			backgroundColor: cssToken('--basalt-plane', '#ffffff'),
			titleColor: ink,
			bodyColor: ink,
			borderColor: cssToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			borderWidth: 1,
			padding: 10,
			cornerRadius: 8,
			boxPadding: 4,
			usePointStyle: true,
			titleFont: { family: TYPEFACE, size: 12, weight: '600' },
			bodyFont: { family: TYPEFACE, size: 12 },
		};

		/* Minute labels show on the tens; day labels every other day. */
		function tickLabel(value, index) {
			const label = series.labels[index];
			if (perDay) return (FORTNIGHT.length - 1 - index) % 2 === 0 ? label : '';
			return label.endsWith('0') ? label : '';
		}

		barChart = new Chart(pick('[data-ed-chart]'), {
			type: 'bar',
			data: {
				labels: series.labels,
				datasets: [
					{
						...barStyle,
						label: group.halves.second,
						data: series.second,
						backgroundColor: cssToken(secondToken, '#ef4d63'),
					},
					{
						...barStyle,
						label: group.halves.first,
						data: series.first,
						backgroundColor: cssToken(firstToken, '#f5a524'),
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: animate && !prefersStillness() ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { intersect: false, mode: 'index' },
				plugins: { legend: { display: false }, tooltip: tooltipStyle },
				scales: {
					x: {
						stacked: true,
						grid: { display: false },
						border: { display: false },
						ticks: { ...tickStyle, maxRotation: 0, autoSkip: false, callback: tickLabel },
					},
					y: {
						stacked: true,
						beginAtZero: true,
						grid: { color: tint(ink, 0.08) },
						border: { display: false },
						ticks: { ...tickStyle, maxTicksLimit: 4, precision: 0 },
					},
				},
			},
		});
	}

	function wireChartControls() {
		pick('[data-ed-span]').addEventListener('change', (changeEvent) => {
			range = changeEvent.target.value;
			paintChart(true);
			sayAloud(range === 'days' ? 'Showing the last 14 days' : 'Showing the last hour');
		});
		document.addEventListener('basalt:appearance', repaintForTheme);
	}

	/** The palette changed under the chart; redraw it once the new colors are in place. */
	function repaintForTheme() {
		requestAnimationFrame(() => barChart && paintChart(false));
	}

	start();
})();
