/**
 * Connection detail page for a single linked service, loaded only by
 * connection-details.html. It fills in the header, the reason the link
 * needs attention, the health chart, the account card, the activity
 * timeline, the flow list, the settings form and the disconnect step.
 *
 * connections.html sends visitors here with ?id=<slug>; an unknown or
 * missing slug falls back to Xero. Swap the CONNECTIONS records for a
 * request to your own backend and route the button handlers to your API.
 * Toasts, button states, copy, steppers, enhanced selects and the hold
 * confirm are provided by basalt.js.
 */
(() => {
	'use strict';

	const root = pick('[data-idt-root]');
	if (!root || typeof bootstrap === 'undefined') return;

	/*
	 * Sample records. The page pretends it is Friday, October 9, 2026 at
	 * 2:12 pm. Each record lists who the service is, how its last week went
	 * as [sent, failed] pairs from Fri Oct 2 to Thu Oct 8, the flows it runs
	 * (a flow with a gate reads as off when that setting is off), its own
	 * settings, and either a fixed history or lines the seeded feed fills in.
	 * A record with a backfill has no week yet and reports import progress.
	 */
	const DEMO_NOW = new Date(2026, 9, 9, 14, 12);
	const CUSTOMER_NAMES = ['Lumora AI', 'Oakhaven Studio', 'Avocet Robotics', 'Highpoint Outfitters'];
	const KIT_ITEMS = [
		'2 × Welcome Pack, Large',
		'Quick-start Guides',
		'4 × Card Box',
		'Name Badges',
		'3 × Card Pack',
		'Training Workbook',
		'Price List Pack',
		'Visit Folders',
	];
	const LEDGER = {
		200: 'Sales',
		210: 'Add-on sales',
		220: 'Subscription income',
		230: 'Services income',
		404: 'Bank fees',
		405: 'Payment processing',
	};

	/* What each kind of service may read or do, and the one thing it is kept away from. */
	const ACCESS = {
		payments: {
			may: ['Read orders and their totals', 'Take payments and make refunds', 'See payouts to the bank'],
			never: 'It never sees staff passwords or visit notes',
		},
		shipping: {
			may: ['Read orders and delivery addresses', 'Buy postage labels', 'Add tracking numbers to orders'],
			never: 'It never sees payments or customer phone numbers',
		},
		books: {
			may: ['Read sales, fees and refunds', 'Create invoices and daily totals'],
			never: 'It never sees card numbers or staff passwords',
		},
		marketing: {
			may: ['Read customers who said yes to marketing', 'Read what they bought and when'],
			never: 'It never sees payments or customers who said no',
		},
		selling: {
			may: ['Read and update products and prices', 'Create orders and seat plans'],
			never: 'It never sees card numbers or staff passwords',
		},
		help: {
			may: ['Read customers and their orders', 'Post notes on an order'],
			never: 'It never sees card numbers or staff passwords',
		},
	};

	const CONNECTIONS = [
		{
			slug: 'stripe',
			title: 'Stripe',
			initials: 'St',
			series: 1,
			area: 'payments',
			vital: true,
			blurb: 'Card payments. Takes payment for seat plans and add-on orders.',
			state: 'ok',
			linkedOn: 'Mar 14, 2023',
			minsSince: 2,
			cadence: 'live',
			login: 'payments@fieldline.app',
			tenant: ['Stripe account', 'Fieldline Inc.'],
			console: 'https://dashboard.stripe.com',
			daily: [
				[988, 10],
				[665, 8],
				[660, 7],
				[1028, 16],
				[995, 11],
				[1108, 5],
				[1130, 9],
			],
			healthNote:
				'Most failures were cards the customer’s bank turned down. The customer is asked to pay again; nothing is lost.',
			loss: 'Card payments stop at checkout and renewal',
			moves: [
				{
					way: 'to',
					icon: 'bi-credit-card',
					label: 'Seat plan and add-on charges',
					detail: 'Each one as it happens',
				},
				{ way: 'to', icon: 'bi-arrow-counterclockwise', label: 'Refunds', detail: 'Made from the order page' },
				{
					way: 'from',
					icon: 'bi-bank',
					label: 'Payouts to the bank',
					detail: (picked) =>
						`${{ day: 'Every day', week: 'Every Monday', month: 'On the 1st of each month' }[picked.payout]}, shown on Transactions`,
				},
			],
			extras: [
				{
					name: 'payout',
					kind: 'select',
					label: 'Pay out to the bank',
					choices: [
						['day', 'Every day'],
						['week', 'Every week'],
						['month', 'Every month'],
					],
					initial: 'day',
				},
				{
					name: 'receipts',
					kind: 'switch',
					label: 'Email a receipt',
					help: 'Stripe emails the customer after each payment.',
					initial: true,
				},
			],
			lines: [
				'Took {money} for order #{order}',
				'Took {money} for a seat plan renewal',
				'Took {money} for order #{order}',
				'Payout of {payout} on its way to the bank',
			],
			miss: { index: 2, text: 'Refund for order #4231 declined by the bank' },
		},
		{
			slug: 'paypal',
			title: 'PayPal',
			initials: 'Pp',
			series: 4,
			area: 'payments',
			blurb: 'Payments. PayPal and Pay Later at add-on checkout.',
			state: 'ok',
			linkedOn: 'Jun 6, 2023',
			minsSince: 6,
			cadence: 'live',
			login: 'orders@fieldline.app',
			tenant: ['PayPal account', 'Fieldline Sales'],
			console: 'https://www.paypal.com',
			daily: [
				[160, 0],
				[117, 2],
				[95, 1],
				[183, 1],
				[174, 1],
				[186, 1],
				[176, 2],
			],
			healthNote: 'A handful of payments timed out at PayPal. Each went through on a later try.',
			loss: 'PayPal leaves add-on checkout',
			moves: [
				{
					way: 'from',
					icon: 'bi-wallet2',
					label: 'PayPal and Pay Later payments',
					detail: (picked) => `Pay Later offered over ${picked.payLater}`,
				},
				{ way: 'to', icon: 'bi-arrow-counterclockwise', label: 'Refunds', detail: 'Made from the order page' },
				{ way: 'from', icon: 'bi-bank', label: 'Payouts', detail: 'Shown on Transactions' },
			],
			extras: [
				{
					name: 'payLater',
					kind: 'select',
					label: 'Offer Pay Later over',
					choices: [
						['$150', '$150'],
						['$250', '$250'],
						['$500', '$500'],
					],
					initial: '$250',
				},
				{
					name: 'autoRefund',
					kind: 'switch',
					label: 'Refund canceled orders',
					help: 'When an order is canceled before it ships.',
					initial: true,
				},
			],
			lines: [
				'Took {money} for order #{order}',
				'Took {money} for order #{order}',
				'Refunded order #{order} in full',
			],
		},
		{
			slug: 'shippo',
			title: 'Shippo',
			initials: 'Sh',
			series: 2,
			area: 'shipping',
			blurb: 'Postage labels. Compares carrier prices and prints labels.',
			state: 'failing',
			linkedOn: 'May 22, 2023',
			minsSince: 47,
			cadence: '15',
			stubborn: 1,
			login: 'fulfillment@fieldline.app',
			tenant: ['Shippo account', 'Fieldline Sales'],
			console: 'https://apps.goshippo.com',
			problem: ['Shippo stopped answering this morning.', '3 labels failed to print. Nothing was lost.'],
			recovery: ['Printed the 3 labels that failed this morning', 'The 3 failed labels have been printed.'],
			daily: [
				[242, 0],
				[192, 0],
				[158, 0],
				[273, 0],
				[263, 15],
				[248, 25],
				[213, 60],
			],
			healthNote: 'Shippo began timing out on Tuesday. Failed labels print again as soon as it answers.',
			loss: 'Labels have to be bought by hand',
			moves: [
				{
					way: 'to',
					icon: 'bi-box-seam',
					label: 'Parcels to ship',
					detail: 'Weight, size and address from the order',
				},
				{
					way: 'from',
					icon: 'bi-printer',
					label: 'Postage labels',
					detail: (picked) =>
						picked.carrier === 'cheapest'
							? 'The cheapest carrier for each parcel'
							: `Always ${picked.carrier === 'usps' ? 'USPS Priority Mail' : 'UPS Ground'}`,
				},
				{
					way: 'from',
					icon: 'bi-truck',
					label: 'Tracking numbers',
					detail: 'Added to the order and the customer email',
				},
			],
			extras: [
				{
					name: 'carrier',
					kind: 'select',
					label: 'Buy labels from',
					choices: [
						['cheapest', 'Cheapest each time'],
						['usps', 'USPS Priority Mail'],
						['ups', 'UPS Ground'],
					],
					initial: 'cheapest',
				},
				{
					name: 'insure',
					kind: 'switch',
					label: 'Insure the welcome packs',
					help: 'Adds cover to any parcel worth over $400.',
					initial: true,
				},
			],
			history: [
				[12, 'failed', 'Could not check for new orders: Shippo did not answer'],
				[27, 'failed', 'Could not check for new orders: Shippo did not answer'],
				[47, 'ok', 'Label bought for order #4322, 2 × Welcome Pack, Large'],
				[212, 'failed', 'Label for order #4317 failed: Shippo did not answer'],
				[227, 'failed', 'Label for order #4315 failed: Shippo did not answer'],
				[242, 'failed', 'Label for order #4309 failed: Shippo did not answer'],
				[257, 'ok', 'Label bought for order #4306, Training Workbook'],
				[272, 'ok', 'Tracking added to order #4298'],
				[287, 'ok', 'Label bought for order #4301, 4 × Card Box'],
				[302, 'ok', 'Tracking added to order #4290'],
				[1212, 'ok', 'Label for order #4284 bought on a new try'],
				[1227, 'failed', 'Label for order #4284 failed: Shippo did not answer'],
			],
		},
		{
			slug: 'usps',
			title: 'USPS',
			initials: 'Us',
			series: 5,
			area: 'shipping',
			blurb: 'Postage. Ground Advantage and Priority Mail rates at checkout.',
			state: 'ok',
			linkedOn: 'May 22, 2023',
			minsSince: 9,
			cadence: '15',
			login: 'fulfillment@fieldline.app',
			tenant: ['USPS account', 'Fieldline Sales'],
			console: 'https://www.usps.com',
			daily: [
				[327, 2],
				[218, 3],
				[182, 2],
				[332, 4],
				[325, 1],
				[352, 4],
				[316, 3],
			],
			healthNote: 'The odd rate request timed out. Checkout used the last known rate instead.',
			loss: 'USPS rates leave add-on checkout',
			moves: [
				{
					way: 'to',
					icon: 'bi-calculator',
					label: 'Parcel details',
					detail: 'Weight and address, for a live rate',
				},
				{
					way: 'from',
					icon: 'bi-tag',
					label: 'Postage rates',
					detail: (picked) =>
						`${{ ground: 'Ground Advantage', priority: 'Priority Mail', both: 'Ground Advantage and Priority Mail' }[picked.service]} at checkout`,
				},
				{
					way: 'from',
					icon: 'bi-geo-alt',
					label: 'Delivery updates',
					detail: 'Marked on the order',
					gate: 'tracking',
				},
			],
			extras: [
				{
					name: 'service',
					kind: 'select',
					label: 'Rates at checkout',
					choices: [
						['both', 'Both services'],
						['ground', 'Ground Advantage'],
						['priority', 'Priority Mail'],
					],
					initial: 'both',
				},
				{
					name: 'tracking',
					kind: 'switch',
					label: 'Mark deliveries on orders',
					help: 'The order shows Delivered as soon as USPS says so.',
					initial: true,
				},
			],
			lines: [
				'Rates shown for order #{order}',
				'Order #{order} delivered',
				'Tracking updated for order #{order}',
			],
		},
		{
			slug: 'xero',
			title: 'Xero',
			initials: 'Xe',
			series: 3,
			area: 'books',
			blurb: 'Accounting. Sends sales, fees and refunds to the books each hour.',
			state: 'expiring',
			linkedOn: 'Jan 15, 2024',
			minsSince: 12,
			cadence: '60',
			login: 'accounts@fieldline.app',
			tenant: ['Xero organization', 'Fieldline Inc.'],
			console: 'https://go.xero.com',
			signInEnds: ['Oct 12, 2026', 'In 3 days'],
			problem: ['The sign-in runs out on Oct 12, in 3 days.', 'After that, sales stop reaching the books.'],
			daily: [
				[86, 0],
				[61, 0],
				[54, 0],
				[88, 0],
				[92, 0],
				[92, 3],
				[89, 5],
			],
			healthNote:
				'Every failure this week was Xero refusing the old sign-in. Each one went through on a later try.',
			settingsBlurb:
				'How often it syncs, where each sale lands in the books, and what happens when a send fails.',
			mirrorHelp: 'Invoices paid in Xero are marked paid here too.',
			loss: 'Sales stop reaching Xero',
			moves: [
				{
					way: 'to',
					icon: 'bi-receipt',
					label: 'Sales from seat plans and add-ons',
					detail: (picked) => `${LEDGER[picked.seats]} and ${LEDGER[picked.store].toLowerCase()}`,
				},
				{
					way: 'to',
					icon: 'bi-credit-card',
					label: 'Card fees and refunds',
					detail: (picked) => `Stripe and PayPal fees, as ${LEDGER[picked.fees].toLowerCase()}`,
				},
				{
					way: 'to',
					icon: 'bi-calendar-check',
					label: 'A daily total',
					detail: 'One summary entry after midnight',
					gate: 'daily',
				},
				{
					way: 'from',
					icon: 'bi-check2-square',
					label: 'Invoices paid in Xero',
					detail: 'Marked paid in Fieldline too',
					gate: 'twoWay',
				},
			],
			extras: [
				{
					name: 'seats',
					kind: 'select',
					label: 'Seat plan sales go to',
					choices: ledgerChoices(200, 220, 230),
					initial: '220',
				},
				{
					name: 'store',
					kind: 'select',
					label: 'Add-on sales go to',
					choices: ledgerChoices(200, 210, 230),
					initial: '210',
				},
				{
					name: 'fees',
					kind: 'select',
					label: 'Card fees go to',
					choices: ledgerChoices(404, 405),
					initial: '404',
				},
				{
					name: 'daily',
					kind: 'switch',
					label: 'Send a daily total',
					help: 'One summary entry just after midnight.',
					initial: true,
				},
			],
			history: [
				[12, 'ok', 'Sent 18 sales and 1 refund to the books'],
				[72, 'ok', 'Sent 46 sales, with the 11:00 am and 12:00 pm sales on a new try'],
				[132, 'failed', 'Could not send the 12:00 pm sales: sign-in needs renewing'],
				[192, 'failed', 'Could not send the 11:00 am sales: sign-in needs renewing'],
				[252, 'ok', 'Sent 26 sales and 2 refunds to the books'],
				[312, 'ok', 'Created 3 invoices for Max renewals'],
				[372, 'ok', 'Sent 12 sales to the books'],
				[847, 'ok', 'Sent the daily total for Oct 8: $29,140 in sales'],
				[972, 'ok', 'Sent 4 sales to the books'],
				[1152, 'ok', 'Marked 9 invoices paid after they were paid in Xero'],
				[1272, 'failed', 'Could not send the 5:00 pm sales: sign-in needs renewing'],
				[1332, 'ok', 'Sent 31 sales to the books'],
			],
		},
		{
			slug: 'taxjar',
			title: 'TaxJar',
			initials: 'Tj',
			series: 6,
			area: 'books',
			blurb: 'Sales tax. Works out sales tax on every invoice and add-on order.',
			state: 'ok',
			linkedOn: 'Jan 15, 2024',
			minsSince: 4,
			cadence: 'live',
			login: 'accounts@fieldline.app',
			tenant: ['TaxJar account', 'Fieldline Inc.'],
			console: 'https://app.taxjar.com',
			daily: [
				[138, 3],
				[98, 1],
				[96, 4],
				[148, 0],
				[172, 1],
				[161, 0],
				[164, 0],
			],
			healthNote: 'A few addresses could not be placed exactly. Those orders were taxed by ZIP code instead.',
			loss: 'Sales tax is no longer worked out',
			moves: [
				{
					way: 'to',
					icon: 'bi-receipt',
					label: 'Invoices and add-on orders',
					detail: 'Address and items for each one',
				},
				{
					way: 'from',
					icon: 'bi-percent',
					label: 'Sales tax',
					detail: (picked) =>
						picked.collect === 'nexus'
							? 'In states where Fieldline must collect'
							: 'In every state Fieldline ships to',
				},
				{
					way: 'from',
					icon: 'bi-file-earmark-text',
					label: 'Monthly returns',
					detail: (picked) => (picked.file ? 'Filed and paid for you' : 'Ready to download each month'),
				},
			],
			extras: [
				{
					name: 'collect',
					kind: 'select',
					label: 'Collect tax in',
					choices: [
						['nexus', 'States you must collect in'],
						['all', 'Every state you ship to'],
					],
					initial: 'nexus',
				},
				{
					name: 'file',
					kind: 'switch',
					label: 'File returns for me',
					help: 'TaxJar files and pays each month’s return.',
					initial: false,
				},
			],
			lines: [
				'Sales tax worked out for order #{order}',
				'Sales tax worked out for invoice #26-{invoice}',
				'Sales tax worked out for order #{order}',
			],
		},
		{
			slug: 'mailchimp',
			title: 'Mailchimp',
			initials: 'Mc',
			series: 7,
			area: 'marketing',
			blurb: 'Email newsletter. Keeps the list in step with trial and paying accounts.',
			state: 'ok',
			linkedOn: 'Apr 3, 2023',
			minsSince: 18,
			cadence: '60',
			login: 'marketing@fieldline.app',
			tenant: ['Mailchimp account', 'Fieldline'],
			console: 'https://login.mailchimp.com',
			daily: [
				[389, 5],
				[276, 4],
				[275, 2],
				[469, 2],
				[422, 3],
				[445, 3],
				[468, 6],
			],
			healthNote: 'Every failure was an email address that bounces. Those are skipped, not tried again.',
			loss: 'The newsletter list stops updating',
			moves: [
				{
					way: 'to',
					icon: 'bi-person-plus',
					label: 'Customers who said yes',
					detail: (picked) =>
						`Added to ${{ news: 'Fieldline news', store: 'Add-on buyers', both: 'both lists' }[picked.list]}`,
				},
				{
					way: 'to',
					icon: 'bi-arrow-repeat',
					label: 'Plan changes',
					detail: 'Trial, paying and canceled tags kept current',
					gate: 'trials',
				},
				{
					way: 'from',
					icon: 'bi-envelope-open',
					label: 'Unsubscribes',
					detail: 'Marked on the customer here too',
				},
			],
			extras: [
				{
					name: 'list',
					kind: 'select',
					label: 'Add customers to',
					choices: [
						['news', 'Fieldline news'],
						['store', 'Add-on buyers'],
						['both', 'Both lists'],
					],
					initial: 'both',
				},
				{
					name: 'trials',
					kind: 'switch',
					label: 'Tag plan changes',
					help: 'Trial, paying and canceled tags follow each account.',
					initial: true,
				},
			],
			lines: [
				'Added {n} new customers to the newsletter list',
				'Tagged {n} accounts that moved from trial to paying',
				'Marked {small} unsubscribes on their customers',
			],
			miss: { index: 4, text: 'Skipped 1 contact with an email address that bounces' },
		},
		{
			slug: 'twilio',
			title: 'Twilio',
			initials: 'Tw',
			series: 8,
			area: 'marketing',
			blurb: 'Text messages. Texts customers when their welcome pack ships.',
			state: 'paused',
			pauseLine: 'Paused by Nia on Monday',
			linkedOn: 'Aug 19, 2024',
			linkedBy: 'Nia Edwards',
			minsSince: 5621,
			cadence: 'live',
			login: 'orders@fieldline.app',
			tenant: ['Twilio account', 'Fieldline Sales'],
			console: 'https://console.twilio.com',
			daily: [
				[92, 1],
				[51, 0],
				[46, 0],
				[46, 0],
				[0, 0],
				[0, 0],
				[0, 0],
			],
			healthNote:
				'Nothing has been sent since Nia paused it on Monday. Texts for new shipments are not being sent.',
			loss: 'Shipping texts stop',
			moves: [
				{ way: 'to', icon: 'bi-chat-text', label: 'Shipping texts', detail: 'Sent when a welcome pack ships' },
				{ way: 'from', icon: 'bi-check2-all', label: 'Delivery receipts', detail: 'Marked on the order' },
				{ way: 'from', icon: 'bi-reply', label: 'Replies', detail: 'Shown in Messages' },
			],
			extras: [
				{
					name: 'from',
					kind: 'select',
					label: 'Send texts from',
					choices: [
						['number', '+1 415 555 0142'],
						['name', 'Fieldline (sender name)'],
					],
					initial: 'number',
				},
				{
					name: 'quiet',
					kind: 'switch',
					label: 'Quiet hours',
					help: 'No texts between 9:00 pm and 8:00 am, local time.',
					initial: true,
				},
			],
			history: [
				[5612, 'info', 'Paused by Nia Edwards', 'bi-pause-circle'],
				[5621, 'ok', 'Sent a shipping text for order #4231'],
				[5667, 'ok', 'Sent a shipping text for order #4228'],
				[5716, 'ok', 'Delivery receipt for order #4228'],
				[5738, 'ok', 'Sent a shipping text for order #4224'],
				[5785, 'ok', 'Reply from Avocet Robotics about order #4224'],
				[5822, 'ok', 'Sent a shipping text for order #4219'],
				[5900, 'ok', 'Sent a shipping text for order #4216'],
			],
		},
		{
			slug: 'analytics',
			title: 'Google Analytics',
			initials: 'Ga',
			series: 5,
			area: 'marketing',
			blurb: 'Site visits. Shows which ads and emails bring in trials and orders.',
			state: 'ok',
			linkedOn: 'Mar 14, 2023',
			minsSince: 1,
			cadence: 'live',
			login: 'marketing@fieldline.app',
			tenant: ['Property', 'fieldline.app'],
			console: 'https://analytics.google.com',
			daily: [
				[826, 1],
				[592, 1],
				[567, 1],
				[931, 2],
				[992, 2],
				[936, 5],
				[911, 0],
			],
			healthNote: 'Almost everything went through. A few visits arrived too late in the day to count.',
			loss: 'Visits and conversions stop being counted',
			moves: [
				{
					way: 'to',
					icon: 'bi-flag',
					label: 'Trial sign-ups',
					detail: (picked) => (picked.goal === 'store' ? 'Counted as visits only' : 'Counted as conversions'),
				},
				{
					way: 'to',
					icon: 'bi-bag-check',
					label: 'Add-on orders',
					detail: (picked) =>
						picked.goal === 'trial'
							? 'Counted as visits only'
							: 'Counted as conversions, with what was bought',
				},
				{
					way: 'from',
					icon: 'bi-bar-chart',
					label: 'Visits by source',
					detail: 'Shown on Marketing Analytics',
				},
			],
			extras: [
				{
					name: 'goal',
					kind: 'select',
					label: 'Count as a conversion',
					choices: [
						['both', 'Trials and orders'],
						['trial', 'Trial sign-ups'],
						['store', 'Add-on orders'],
					],
					initial: 'both',
				},
				{
					name: 'ads',
					kind: 'switch',
					label: 'Share with Google Ads',
					help: 'Conversions show up in your ad reports.',
					initial: true,
				},
			],
			lines: [
				'Counted a trial sign-up from the autumn email',
				'Order #{order} traced back to a search ad',
				'Counted a trial sign-up from a search ad',
				'Order #{order} traced back to the autumn email',
			],
		},
		{
			slug: 'chargebee',
			title: 'Chargebee',
			initials: 'Cb',
			series: 1,
			area: 'selling',
			blurb: 'Seat billing. Monthly and annual seat plans, renewals and upgrades.',
			state: 'syncing',
			linkedOn: 'Today, 9:30 am',
			minsSince: 0,
			cadence: 'live',
			login: 'billing@fieldline.app',
			tenant: ['Chargebee site', 'fieldline-billing'],
			console: 'https://app.chargebee.com',
			backfill: { done: 1186, total: 1853, eta: 'About 40 min' },
			healthNote: 'Bringing in two years of past invoices. New renewals come through as they happen meanwhile.',
			mirrorHelp: 'Plan changes made here go back to Chargebee.',
			loss: 'Seat renewals stop coming in',
			moves: [
				{
					way: 'from',
					icon: 'bi-people',
					label: 'Seat plans and add-ons',
					detail: 'Renewals, upgrades and seat changes',
				},
				{
					way: 'from',
					icon: 'bi-receipt',
					label: 'Invoices',
					detail: (picked) =>
						picked.plans === 'all'
							? 'Seat plans and add-ons, with their payments'
							: 'Seat plans only, with their payments',
				},
				{
					way: 'to',
					icon: 'bi-pencil-square',
					label: 'Plan changes made here',
					detail: 'Sent back to Chargebee',
					gate: 'twoWay',
				},
			],
			extras: [
				{
					name: 'plans',
					kind: 'select',
					label: 'Bring in',
					choices: [
						['all', 'Plans and add-ons'],
						['seats', 'Seat plans only'],
					],
					initial: 'all',
				},
				{
					name: 'dunning',
					kind: 'switch',
					label: 'Retry failed card payments',
					help: 'Chargebee tries again over 7 days.',
					initial: true,
				},
			],
			history: [
				[7, 'ok', 'Brought in 212 past invoices'],
				[17, 'ok', 'Renewed 14 seat plans'],
				[52, 'ok', 'Brought in 240 past invoices'],
				[92, 'ok', 'Brought in 236 past invoices'],
				[162, 'ok', 'Renewed 21 seat plans'],
				[187, 'ok', 'Brought in 248 past invoices'],
				[237, 'ok', 'Brought in 250 past invoices'],
				[282, 'info', 'Connected by John Armstrong, with two years of past invoices', 'bi-plug'],
			],
		},
		{
			slug: 'zendesk',
			title: 'Zendesk',
			initials: 'Zd',
			series: 2,
			area: 'help',
			blurb: 'Customer help. Puts the account and its plan next to every support email.',
			state: 'ok',
			linkedOn: 'Oct 9, 2023',
			minsSince: 3,
			cadence: 'live',
			login: 'support@fieldline.app',
			tenant: ['Help desk', 'fieldline.zendesk.com'],
			console: 'https://www.zendesk.com',
			daily: [
				[53, 1],
				[35, 2],
				[33, 0],
				[55, 0],
				[60, 0],
				[57, 0],
				[56, 0],
			],
			healthNote: 'Three lookups timed out on Friday and Saturday. Each went through on a later try.',
			loss: 'Support emails lose the account beside them',
			moves: [
				{ way: 'to', icon: 'bi-person-vcard', label: 'Account and plan', detail: 'Beside every support email' },
				{
					way: 'to',
					icon: 'bi-bag',
					label: 'Recent add-on orders',
					detail: (picked) =>
						picked.orders === 'three' ? 'The last three for the customer' : 'The last order only',
				},
				{
					way: 'from',
					icon: 'bi-sticky',
					label: 'Notes on an order',
					detail: 'Posted from Zendesk',
					gate: 'notes',
				},
			],
			extras: [
				{
					name: 'orders',
					kind: 'select',
					label: 'Orders beside an email',
					choices: [
						['three', 'Last three'],
						['one', 'Last one'],
					],
					initial: 'three',
				},
				{
					name: 'notes',
					kind: 'switch',
					label: 'Post order notes',
					help: 'Notes added in Zendesk appear on the order.',
					initial: true,
				},
			],
			lines: [
				'Customer email linked to order #{order}',
				'Showed {company}’s plan beside a new email',
				'Customer email linked to order #{order}',
			],
		},
		{
			slug: 'slack',
			title: 'Slack',
			initials: 'Sl',
			series: 4,
			area: 'help',
			blurb: 'Team chat. Posts big deals, big orders and low stock to the team.',
			state: 'ok',
			linkedOn: 'Feb 12, 2024',
			minsSince: 21,
			cadence: 'live',
			login: 'team@fieldline.app',
			tenant: ['Workspace', 'fieldline.slack.com'],
			console: 'https://app.slack.com',
			daily: [
				[44, 0],
				[35, 0],
				[28, 0],
				[44, 1],
				[47, 0],
				[47, 0],
				[47, 0],
			],
			healthNote: 'One post failed when a channel was renamed. It went through on the next try.',
			loss: 'Posts to the team stop',
			moves: [
				{ way: 'to', icon: 'bi-trophy', label: 'New Max deals', detail: 'Posted to #sales' },
				{
					way: 'to',
					icon: 'bi-bag-check',
					label: 'Big add-on orders',
					detail: (picked) => `Over ${picked.big}, posted to #orders`,
				},
				{
					way: 'to',
					icon: 'bi-box-seam',
					label: 'Low welcome packs',
					detail: 'Posted to #ops under 20 left',
					gate: 'stock',
				},
			],
			extras: [
				{
					name: 'big',
					kind: 'select',
					label: 'Post orders over',
					choices: [
						['$1,000', '$1,000'],
						['$2,500', '$2,500'],
						['$4,000', '$4,000'],
					],
					initial: '$2,500',
				},
				{
					name: 'stock',
					kind: 'switch',
					label: 'Warn when stock runs low',
					help: 'Posts to #ops when a pack drops under 20.',
					initial: true,
				},
			],
			lines: [
				'Posted a big order to #orders: {pack}',
				'Posted a new Max deal to #sales: {company}',
				'Posted a big order to #orders: {pack}',
			],
		},
	];

	/* Fixed wording shared by the header, the facts and the settings. */
	const CADENCE = { live: 'As they happen', 15: 'Every 15 minutes', 60: 'Every hour', night: 'Once a night' };
	const BADGES = {
		ok: ['success', 'Working'],
		syncing: ['info', 'First sync'],
		expiring: ['warning', 'Sign in soon'],
		failing: ['danger', 'Failing'],
		paused: ['', 'Paused'],
		off: ['danger', 'Disconnected'],
	};
	const HERO_BUTTON = {
		ok: ['bi-arrow-repeat', 'Sync now'],
		syncing: ['bi-arrow-repeat', 'Bringing in'],
		expiring: ['bi-box-arrow-in-right', 'Sign in again'],
		failing: ['bi-arrow-clockwise', 'Try again'],
		paused: ['bi-play-circle', 'Resume syncing'],
		off: ['bi-plug', 'Connect again'],
	};
	const EVENT_GLYPHS = { ok: 'bi-check2', failed: 'bi-x-lg', info: 'bi-info-lg' };
	const DAY_TICKS = ['Fri 2', 'Sat 3', 'Sun 4', 'Mon 5', 'Tue 6', 'Wed 7', 'Thu 8'];
	const TIMELINE_PREVIEW = 6;
	const CHART_FONT = "'Schibsted Grotesk', sans-serif";
	const FALLBACK_SERIES = '#2bb3a3';

	/* The connection on show, and the page parts the handlers keep touching. */
	const service = resolveConnection(new URLSearchParams(location.search).get('id'));
	service.prior = service.state;
	const ui = {};
	const settingRows = buildSettingRows();
	let healthChart = null;
	let timelineOpen = false;

	/** Wires the page once: identity, listeners, the settings form, then the first render. */
	function start() {
		collectParts();
		paintIdentity();
		bindTimeline();
		bindHeroActions();
		bindDisconnect();
		mountSettings();

		refreshCards();
		paintSettingValues();
		paintTimeline();
		beginHealth();
		playOnSight(ui.timeline);
		playOnSight(ui.flows);
		playOnSight(pick('[data-idt="perms"]', root));
	}

	function collectParts() {
		Object.assign(ui, {
			tags: pick('[data-idt="tags"]', root),
			notice: pick('[data-idt="notice"]', root),
			facts: pick('[data-idt="facts"]', root),
			menu: pick('[data-idt="menu"]', root),
			hero: pick('[data-idt-primary]', root),
			endCard: pick('.idt-card-end', root),
			flows: pick('[data-idt="flows"]', root),
			ring: pick('[data-idt="ring"]', root),
			healthNote: pick('[data-idt="health-note"]', root),
			canvas: pick('[data-idt-chart]', root),
			timeline: pick('[data-idt="feed"]', root),
			timelineEmpty: pick('[data-idt-feed-empty]', root),
			onlyProblems: pick('[data-idt-problems]', root),
			timelineToggle: pick('[data-idt-more]', root),
			dialog: document.getElementById('idt-disconnect'),
			settingsForm: pick('[data-idt-settings]', root),
			editToggle: pick('[data-idt-edit]', root),
		});
		ui.settingsList = pick('[data-idt="settings"]', ui.settingsForm);
		ui.settingsFoot = pick('[data-idt-settings-foot]', ui.settingsForm);
		ui.settingsStatus = pick('[data-idt-settings-status]', ui.settingsForm);
	}

	/* The identity parts are written once; nothing on the page changes them later. */

	/** Writes the name, initials, color, access list and hook address that never change on this visit. */
	function paintIdentity() {
		const { title, initials, series, slug } = service;
		root.style.setProperty('--idt-tone', `var(--basalt-series-${series})`);
		pick('[data-idt="abbr"]', root).textContent = initials;
		pick('[data-idt="name"]', root).textContent = title;
		pick('[data-idt="about"]', root).textContent = service.blurb;
		for (const nameSlot of pickAll('[data-idt-name]')) nameSlot.textContent = title;
		pick('[data-idt="stops"]').textContent = service.loss;
		pick('[data-idt="menu-btn"]', root).setAttribute('aria-label', `More for ${title}`);
		pick('#idt-hook').value = `https://api.fieldline.app/hooks/${slug}/${initials.toLowerCase()}7f3c${series}e9`;

		const access = ACCESS[service.area];
		const allowed = access.may.map(
			(line) => `<li><i class="bi bi-check2-circle" aria-hidden="true"></i>${htmlSafe(line)}</li>`,
		);
		pick('[data-idt="perms"]', root).innerHTML =
			`${allowed.join('')}<li class="is-never"><i class="bi bi-shield-lock" aria-hidden="true"></i>${htmlSafe(access.never)}</li>`;
		document.title = `${title} connection · Basalt`;
	}

	/** Redraws everything that depends on the connection state. */
	function refreshCards() {
		paintHeader();
		paintFacts();
		paintFlows();
	}

	/* The header, the notice and the account card all follow the connection state. */

	function paintHeader() {
		const { state } = service;
		ui.tags.innerHTML = `${stateBadge()}<span class="idt-tags-when">${htmlSafe(headerSubline())}</span>`;

		const [icon, caption] = HERO_BUTTON[state];
		const importing = state === 'syncing';
		pick('[data-idt-primary-icon]', ui.hero).className = `bi ${icon}`;
		pick('[data-idt-primary-label]', ui.hero).textContent = caption;
		ui.hero.disabled = importing;
		ui.hero.classList.toggle('btn-primary', !importing);
		ui.hero.classList.toggle('btn-outline-secondary', importing);

		ui.menu.innerHTML = overflowItems().join('');
		paintNotice();
		ui.endCard.hidden = state === 'off';
	}

	/** Builds the "…" menu for the current state; disconnected links lose the destructive entry. */
	function overflowItems() {
		const { state, title } = service;
		const menuLines = [];
		if (state === 'expiring') menuLines.push(menuButton('sync', 'bi-arrow-repeat', 'Sync now'));
		if (['ok', 'expiring', 'failing', 'syncing'].includes(state))
			menuLines.push(menuButton('pause', 'bi-pause-circle', 'Pause syncing'));
		menuLines.push(
			`<li><a class="dropdown-item" href="${service.console}" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right" aria-hidden="true"></i>Open ${htmlSafe(title)}<span class="visually-hidden"> (opens in a new tab)</span></a></li>`,
			'<li><a class="dropdown-item" href="connections.html"><i class="bi bi-plugin" aria-hidden="true"></i>All connections</a></li>',
		);
		if (state === 'off') return menuLines;
		menuLines.push(
			'<li><hr class="dropdown-divider"></li>',
			menuButton('disconnect', 'bi-plug', 'Disconnect', ' idt-danger-item'),
		);
		return menuLines;
	}

	function menuButton(act, icon, caption, extraClass = '') {
		return `<li><button type="button" class="dropdown-item${extraClass}" data-idt-act="${act}"><i class="bi ${icon}" aria-hidden="true"></i>${caption}</button></li>`;
	}

	/* The slim line under the header only appears for states that need a word of explanation. */
	function paintNotice() {
		const { title } = service;
		const reasons = {
			expiring: () => ['warning', 'bi-key', ...service.problem],
			failing: () => ['danger', 'bi-exclamation-octagon', ...service.problem],
			paused: () => [
				'',
				'bi-pause-circle',
				'Syncing is paused.',
				`Nothing is sent to ${title} until you resume it.`,
			],
			off: () => [
				'',
				'bi-plug',
				`${title} is disconnected.`,
				`Past records stay in Fieldline and in ${title}. Connect again to pick up where it stopped.`,
			],
		};
		const explain = reasons[service.state]?.();
		ui.notice.hidden = !explain;
		if (!explain) return;
		const [tone, icon, lead, rest] = explain;
		ui.notice.className = tone ? `idt-notice idt-notice-${tone}` : 'idt-notice';
		ui.notice.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i><span><strong>${htmlSafe(lead)}</strong> ${htmlSafe(rest)}</span>`;
	}

	function stateBadge() {
		const [tone, caption] = BADGES[service.state];
		const classes = ['basalt-status', 'basalt-status-dot'];
		if (tone) classes.push(`basalt-status-${tone}`);
		if (service.state === 'syncing') classes.push('basalt-status-live');
		return `<span class="${classes.join(' ')}">${caption}</span>`;
	}

	function headerSubline() {
		const lines = {
			paused: () => service.pauseLine || 'Paused by you just now',
			off: () => 'Not syncing',
			syncing: () => `${backfillShare()}% of past records in`,
			failing: () => `Last worked ${sinceWords(service.minsSince)}`,
		};
		return lines[service.state]?.() ?? `Synced ${sinceWords(service.minsSince)}`;
	}

	/** Fills the account card: tenant, login, sign-in lifetime, last sync and who linked it. */
	function paintFacts() {
		const [syncMain, syncSmall] = lastSyncPair();
		const signIn = signInRow();
		const rows = [
			[service.tenant[0], htmlSafe(service.tenant[1])],
			['Signed in as', htmlSafe(service.login)],
			[signIn.term, `${htmlSafe(signIn.main)}${annotation(signIn.aside, signIn.warn)}`],
			['Last sync', `${htmlSafe(syncMain)}<small>${htmlSafe(syncSmall)}</small>`],
			['Connected', `${htmlSafe(service.linkedOn)}<small>By ${htmlSafe(service.linkedBy)}</small>`],
		];
		ui.facts.innerHTML = rows
			.map(([term, detail]) => `<div><dt>${htmlSafe(term)}</dt><dd>${detail}</dd></div>`)
			.join('');
	}

	function annotation(text, warn) {
		if (!text) return '';
		return `<small${warn ? ' class="is-warn"' : ''}>${htmlSafe(text)}</small>`;
	}

	function signInRow() {
		if (service.state === 'off') return { term: 'Sign-in', main: 'Signed out', aside: '' };
		if (!service.signInEnds) return { term: 'Sign-in', main: 'Stays signed in', aside: 'Renews by itself' };
		const [date, inWords] = service.signInEnds;
		return { term: 'Sign-in runs out', main: date, aside: inWords, warn: service.state === 'expiring' };
	}

	function lastSyncPair() {
		const minutes = service.minsSince;
		switch (service.state) {
			case 'off':
				return ['Not syncing', 'Disconnected just now'];
			case 'paused':
				return [
					minutes > 1440 ? clockLabel(minutes) : upperFirst(sinceWords(minutes)),
					'Nothing is sent until you resume it',
				];
			case 'failing':
				return [
					`Last worked ${sinceWords(minutes)}`,
					`Trying again ${CADENCE[service.prefs.every].toLowerCase()}`,
				];
			default:
				return [upperFirst(sinceWords(minutes)), upcomingRun()];
		}
	}

	function upcomingRun() {
		const cadence = service.prefs.every;
		if (cadence === 'live') return 'Sends each change as it happens';
		if (cadence === 'night') return 'Next run tonight at 12:05 am';
		const period = Number(cadence);
		return `${CADENCE[cadence]}, next in ${period - (service.minsSince % period)} min`;
	}

	/* Flow notes read the current settings, so a saved change shows here at once. */

	function paintFlows() {
		const prefs = service.prefs;
		ui.flows.innerHTML = service.moves
			.map((move, index) => {
				const disabled = Boolean(move.gate) && !prefs[move.gate];
				let detail = 'Turned off in settings';
				if (!disabled) detail = typeof move.detail === 'function' ? move.detail(prefs) : move.detail;
				const outbound = move.way === 'to';
				const direction = `<span class="idt-flow-dir"><i class="bi ${outbound ? 'bi-arrow-right' : 'bi-arrow-left'}" aria-hidden="true"></i>${outbound ? 'To' : 'From'} ${htmlSafe(service.title)}</span>`;
				return [
					`<li class="idt-flow idt-flow-${index + 1}${disabled ? ' is-off' : ''}">`,
					`<span class="idt-flow-icon" aria-hidden="true"><i class="bi ${move.icon}"></i></span>`,
					`<span class="idt-flow-text"><span class="idt-flow-name">${htmlSafe(move.label)}</span><span class="idt-flow-note">${direction} · ${htmlSafe(detail)}</span></span>`,
					'</li>',
				].join('');
			})
			.join('');
	}

	/* Health shows either the week behind the service or, on its first day, the import progress. */

	/** Starts the ring fill and, for a service with a week behind it, the bar chart once it scrolls near. */
	function beginHealth() {
		const share = paintHealth();
		/* The rate and the two counts roll up from zero; the busiest day is a date. */
		window.Basalt.countUp?.([
			pick('[data-idt="rate"]', root),
			...pickAll('[data-idt="health-facts"] dd', root).slice(0, 2),
		]);
		/* Waiting a frame lets the ring animate from empty to its share. */
		requestAnimationFrame(() => {
			ui.ring.style.strokeDashoffset = String(100 - share);
		});
		if (service.backfill) return;

		if (!('IntersectionObserver' in window)) {
			drawChart(false);
		} else {
			const watcher = new IntersectionObserver(
				([entry]) => {
					if (!entry.isIntersecting) return;
					watcher.disconnect();
					drawChart(true);
				},
				{ rootMargin: '80px 0px' },
			);
			watcher.observe(ui.canvas);
		}
		document.addEventListener('basalt:appearance', () => {
			if (healthChart) requestAnimationFrame(() => drawChart(false));
		});
	}

	/**
	 * Writes the headline figure, the facts list and the ring tone.
	 * @returns {number} the percentage the ring should fill to
	 */
	function paintHealth() {
		ui.healthNote.textContent = service.healthNote;
		return service.backfill ? paintImportProgress() : paintWeek();
	}

	function paintImportProgress() {
		const { done, total, eta } = service.backfill;
		const share = backfillShare();
		writeHook('health-desc', `Bringing in past records from ${service.title} for the first time.`);
		writeHook('rate', `${share}%`);
		writeHook('rate-label', 'of past invoices brought in');
		setHealthFacts([
			['Brought in', withCommas(done)],
			['To go', withCommas(total - done)],
			['Time left', eta],
		]);
		pick('[data-idt-week]', root).hidden = true;
		pick('[data-idt-legend]', root).hidden = true;
		pick('[data-idt-first]', root).hidden = false;
		ringTone('var(--basalt-info)');
		return share;
	}

	function paintWeek() {
		let sent = 0;
		let failed = 0;
		let peakIndex = 0;
		let peakVolume = -Infinity;
		for (const [index, [passed, missed]] of service.daily.entries()) {
			sent += passed;
			failed += missed;
			if (passed + missed > peakVolume) {
				peakVolume = passed + missed;
				peakIndex = index;
			}
		}
		const successRate = Math.round((sent / (sent + failed)) * 1000) / 10;

		writeHook('health-desc', `Every record sent to or from ${service.title} in the last 7 days.`);
		writeHook('rate', `${successRate.toFixed(1)}%`);
		setHealthFacts([
			['Records', withCommas(sent + failed)],
			['Failed', withCommas(failed), failed > 0],
			['Busiest day', longDay(DAY_TICKS[peakIndex])],
		]);
		ui.canvas.setAttribute(
			'aria-label',
			`Records sent each day from October 2 to 8. ${withCommas(sent)} went through and ${withCommas(failed)} failed.`,
		);
		ringTone(successRate < 97 ? 'var(--basalt-danger)' : 'var(--basalt-success)');
		return successRate;
	}

	function writeHook(hook, text) {
		pick(`[data-idt="${hook}"]`, root).textContent = text;
	}

	function setHealthFacts(pairs) {
		pick('[data-idt="health-facts"]', root).innerHTML = pairs
			.map(
				([term, figure, alarming]) =>
					`<div><dt>${term}</dt><dd${alarming ? ' class="idt-bad"' : ''}>${htmlSafe(figure)}</dd></div>`,
			)
			.join('');
	}

	function ringTone(value) {
		ui.ring.closest('svg').style.setProperty('--basalt-tone', value);
	}

	function backfillShare() {
		return Math.round((service.backfill.done / service.backfill.total) * 100);
	}

	function longDay(tick) {
		return tick.replace(' ', ', Oct ');
	}

	/** Builds, or rebuilds after a theme change, the stacked bars for the week. */
	function drawChart(animate) {
		if (typeof Chart === 'undefined') return;
		const ink = themeToken('--basalt-copy', '#12233a');
		const tickInk = blend(themeToken('--basalt-copy-muted', '#5f7186'), ink, 0.82);
		const failColor = themeToken('--basalt-danger', '#ef4d63');
		const passVar = passingSeries(failColor);
		const passColor = themeToken(passVar, FALLBACK_SERIES);
		root.style.setProperty('--idt-bar', `var(${passVar})`);

		const ticks = (extra) => ({ color: tickInk, font: { family: CHART_FONT, size: 11 }, ...extra });
		const barSet = (label, values, color) => ({
			label,
			data: values,
			stack: 's',
			backgroundColor: color,
			hoverBackgroundColor: color,
			borderRadius: 4,
			borderSkipped: false,
			maxBarThickness: 40,
		});

		healthChart?.destroy();
		healthChart = new Chart(ui.canvas, {
			type: 'bar',
			data: {
				labels: DAY_TICKS,
				datasets: [
					barSet(
						'Went through',
						service.daily.map((day) => day[0]),
						passColor,
					),
					barSet(
						'Failed',
						service.daily.map((day) => day[1]),
						failColor,
					),
				],
			},
			options: {
				maintainAspectRatio: false,
				responsive: true,
				animation: animate && !prefersStill() ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { intersect: false, mode: 'index' },
				scales: {
					x: {
						stacked: true,
						border: { display: false },
						grid: { display: false },
						ticks: ticks({ maxRotation: 0 }),
					},
					y: {
						stacked: true,
						border: { display: false },
						grid: { color: tint(ink, 0.07) },
						ticks: ticks({ maxTicksLimit: 5, callback: (value) => withCommas(value) }),
					},
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: themeToken('--basalt-plane', '#ffffff'),
						borderColor: themeToken('--basalt-edge-strong', '#cccccc'),
						borderWidth: 1,
						titleColor: ink,
						bodyColor: ink,
						titleFont: { family: CHART_FONT, size: 12, weight: '600' },
						bodyFont: { family: CHART_FONT, size: 12 },
						padding: 10,
						cornerRadius: 8,
						boxPadding: 4,
						usePointStyle: true,
						callbacks: {
							title: (points) => longDay(points[0].label),
							label: (point) => ` ${point.dataset.label}: ${withCommas(point.parsed.y)}`,
						},
					},
				},
			},
		});
	}

	/*
	 * Bars that went through wear the service's own series color, unless the
	 * palette turns that color into something close to red. Then the series
	 * color furthest from the failure red takes over.
	 */
	function passingSeries(failColor) {
		const own = `--basalt-series-${service.series}`;
		if (distance(themeToken(own, FALLBACK_SERIES), failColor) > 150) return own;
		let pickedVar = own;
		let widest = 0;
		for (let n = 1; n <= 8; n++) {
			const candidate = `--basalt-series-${n}`;
			const spread = distance(themeToken(candidate, FALLBACK_SERIES), failColor);
			if (spread > widest) {
				widest = spread;
				pickedVar = candidate;
			}
		}
		return pickedVar;
	}

	/* The timeline shows six entries until it is expanded, and can narrow to failures. */

	function bindTimeline() {
		ui.timeline.setAttribute('aria-label', `Recent activity for ${service.title}`);
		ui.onlyProblems.addEventListener('change', () => {
			timelineOpen = false;
			paintTimeline();
		});
		ui.timelineToggle.addEventListener('click', () => {
			window.Basalt.slide(ui.timeline, () => {
				timelineOpen = !timelineOpen;
				paintTimeline();
			});
		});
	}

	function paintTimeline() {
		const matching = ui.onlyProblems.checked
			? service.events.filter((event) => event.kind === 'failed')
			: service.events;
		const visible = timelineOpen ? matching : matching.slice(0, TIMELINE_PREVIEW);
		ui.timeline.innerHTML = visible.map(eventItem).join('');
		ui.timeline.hidden = matching.length === 0;
		ui.timelineEmpty.hidden = matching.length > 0;

		const toggle = ui.timelineToggle;
		toggle.hidden = matching.length <= TIMELINE_PREVIEW;
		toggle.textContent = timelineOpen ? 'Show fewer' : `See all ${matching.length}`;
		toggle.setAttribute('aria-expanded', String(timelineOpen));
	}

	function eventItem({ kind, text, when, glyph, fresh }) {
		const classes = ['idt-event'];
		if (kind !== 'ok') classes.push(`is-${kind}`);
		if (fresh) classes.push('is-fresh');
		const srLead = kind === 'failed' ? '<span class="visually-hidden">Failed: </span>' : '';
		return [
			`<li class="${classes.join(' ')}">`,
			`<span class="idt-event-icon" aria-hidden="true"><i class="bi ${glyph || EVENT_GLYPHS[kind]}"></i></span>`,
			`<div class="idt-event-body"><p class="idt-event-text">${srLead}${htmlSafe(text)}</p><span class="idt-event-time">${htmlSafe(when)}</span></div>`,
			'</li>',
		].join('');
	}

	/** Puts a new entry at the top of the timeline and lets only that one play the pop. */
	function logEvent(entry) {
		for (const earlier of service.events) earlier.fresh = false;
		service.events.unshift({ fresh: true, when: 'Just now', ...entry });
		paintTimeline();
	}

	/* The header button does whatever the current state calls for; the menu holds the rest. */

	function bindHeroActions() {
		const byState = {
			expiring: renewSignIn,
			failing: retryNow,
			ok: syncByHand,
			paused: (button) => {
				togglePause(false);
				button.focus();
			},
		};
		ui.hero.addEventListener('click', () => {
			if (ui.hero.disabled) return;
			(byState[service.state] || reconnect)(ui.hero);
		});

		ui.menu.addEventListener('click', (event) => {
			const chosen = event.target.closest('[data-idt-act]');
			if (!chosen) return;
			const act = chosen.getAttribute('data-idt-act');
			if (act === 'disconnect') return openDisconnect();
			if (act === 'sync') return syncByHand(ui.hero);
			if (act !== 'pause') return;
			togglePause(true);
			if (!ui.hero.disabled) ui.hero.focus();
		});
	}

	/**
	 * Runs one header action: the button spins for `delay`, `settle` updates
	 * the record and names the result, the button shows that result while the
	 * follow-up (timeline entry, toast) runs, then it resets.
	 */
	async function performStep(button, busyLabel, delay, settle) {
		setButton(button, 'loading', busyLabel);
		await wait(delay);
		const result = settle();
		setButton(button, result.state, result.label);
		result.then();
		await wait(result.hold ?? 900);
		setButton(button, 'idle');
		if (!result.keepCards) refreshCards();
	}

	function renewSignIn(button) {
		return performStep(button, 'Signing in', 1100, () => {
			Object.assign(service, { state: 'ok', signInEnds: ['Apr 9, 2027', 'In 6 months'], minsSince: 0 });
			return {
				state: 'success',
				label: 'Signed in',
				then: () => {
					logEvent({ kind: 'info', glyph: 'bi-key', text: 'Signed in again by John Armstrong' });
					ui.healthNote.textContent = `This week’s failures were ${service.title} refusing the old sign-in. With the new one, sends go through as normal.`;
					notify({
						tone: 'success',
						title: `${service.title} is signed in again`,
						text: 'Sales will keep reaching the books until Apr 9, 2027.',
						duration: 5000,
					});
				},
			};
		});
	}

	/* A failing service may refuse the first retries; each refusal is logged and the cards stay as they are. */
	function retryNow(button) {
		return performStep(button, 'Trying', 1100, () => {
			const { title } = service;
			if (service.stubborn > 0) {
				service.stubborn -= 1;
				return {
					state: 'error',
					label: 'Still failing',
					hold: 1600,
					keepCards: true,
					then: () => {
						logEvent({ kind: 'failed', text: `Tried again: ${title} did not answer` });
						notify({
							tone: 'danger',
							title: `${title} is still not answering`,
							text: 'Nothing was lost. Try once more in a moment.',
							duration: 7000,
						});
					},
				};
			}
			Object.assign(service, { state: 'ok', minsSince: 0 });
			const [logLine, toastLine] = service.recovery;
			return {
				state: 'success',
				label: 'Working',
				then: () => {
					logEvent({ kind: 'ok', text: logLine });
					notify({ tone: 'success', title: `${title} is working again`, text: toastLine, duration: 5000 });
				},
			};
		});
	}

	function syncByHand(button) {
		return performStep(button, 'Syncing', 900, () => {
			service.minsSince = 0;
			return {
				state: 'success',
				label: 'Synced',
				then: () => {
					logEvent({ kind: 'ok', text: 'Synced by hand: everything was up to date' });
					speak(`${service.title} synced just now.`);
				},
			};
		});
	}

	function reconnect(button) {
		return performStep(button, 'Connecting', 1100, () => {
			/* Linking again starts clean: a new sign-in and a working state. */
			service.state = 'ok';
			if (service.signInEnds) service.signInEnds = ['Apr 9, 2027', 'In 6 months'];
			service.minsSince = 0;
			return {
				state: 'success',
				label: 'Connected',
				then: () => {
					logEvent({ kind: 'info', glyph: 'bi-plug', text: 'Connected again by John Armstrong' });
					notify({
						tone: 'success',
						icon: 'bi-plug',
						title: `${service.title} is connected again`,
						text: 'Anything from while it was off is on its way.',
						duration: 5000,
					});
				},
			};
		});
	}

	/**
	 * Pauses or resumes syncing. The toast offers Undo, which flips it back
	 * without a second toast.
	 */
	function togglePause(pausing, silent) {
		if (pausing) {
			Object.assign(service, { prior: service.state, state: 'paused', pauseLine: '' });
		} else {
			service.state = service.prior === 'paused' ? 'ok' : service.prior;
			service.minsSince = 0;
		}
		refreshCards();
		if (silent) return;
		notify({
			tone: pausing ? 'warning' : 'success',
			icon: pausing ? 'bi-pause-circle' : 'bi-play-circle',
			title: `${service.title}${pausing ? ' paused' : ' is syncing again'}`,
			text: pausing
				? 'Nothing is sent or received until you resume it.'
				: 'Anything that came in while it was paused is on its way.',
			duration: 6000,
			actions: [{ label: 'Undo', onClick: () => togglePause(!pausing, true) }],
		});
	}

	/* Disconnecting needs a held button in the dialog, and its toast can undo it. */

	function bindDisconnect() {
		pick('[data-idt-disconnect]', root).addEventListener('click', openDisconnect);
		pick('[data-idt-hold]', ui.dialog).addEventListener('basalt:confirm', () => {
			const restoreTo = service.state;
			service.state = 'off';
			bootstrap.Modal.getOrCreateInstance(ui.dialog).hide();
			refreshCards();
			notify({
				tone: 'success',
				icon: 'bi-plug',
				title: `${service.title} disconnected`,
				text: 'Nothing more is sent. Connect again at any time.',
				duration: 8000,
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							service.state = restoreTo;
							refreshCards();
							speak(`${service.title} connected again`);
						},
					},
				],
			});
		});
		ui.dialog.addEventListener('hidden.bs.modal', () => ui.hero.focus());
	}

	function openDisconnect() {
		bootstrap.Modal.getOrCreateInstance(ui.dialog).show();
	}

	/*
	 * Settings rows run from the shared cadence, through the service's own
	 * choices and switches, to alerts and the retry count. Edit reveals every
	 * field at once, Save validates and keeps the changes, and Cancel or
	 * Escape restores the read-only view.
	 */

	/** Lists every settings row in display order, shared rows around the service's own. */
	function buildSettingRows() {
		const ownOfKind = (kind) => service.extras.filter((extra) => extra.kind === kind);
		return [
			{ name: 'every', kind: 'select', label: 'Check for changes', choices: Object.entries(CADENCE) },
			...ownOfKind('select'),
			{
				name: 'twoWay',
				kind: 'switch',
				label: 'Send changes both ways',
				help: service.mirrorHelp || `Edits made here go back to ${service.title} too.`,
			},
			...ownOfKind('switch'),
			{
				name: 'alert',
				kind: 'switch',
				label: 'Tell me when it fails',
				help: 'Email the ops team after three failed tries in a row.',
			},
			{
				name: 'retries',
				kind: 'stepper',
				label: 'Tries before giving up',
				help: '1 to 10. Each try waits a little longer.',
			},
		];
	}

	function mountSettings() {
		const { settingsForm: form, settingsList, editToggle } = ui;
		pick('[data-idt="settings-desc"]', root).textContent =
			service.settingsBlurb || 'How often it syncs, what it sends, and what happens when a send fails.';
		settingsList.innerHTML = settingRows.map(settingRow).join('');
		if (window.Basalt.stepper) {
			for (const stepper of pickAll('[data-basalt-stepper]', settingsList)) window.Basalt.stepper(stepper);
		}
		ui.retryInput = pick('#idt-set-retries');
		ui.retryError = pick('#idt-set-retries-error');

		editToggle.addEventListener('click', () => {
			loadFormValues();
			showEditor(true);
			reportPending();
			form.elements.every.focus();
		});
		pick('[data-idt-cancel]', form).addEventListener('click', leaveEditor);
		form.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape' || ui.settingsFoot.hidden) return;
			if (event.target.closest('.dropdown-menu, [aria-expanded="true"]')) return;
			event.preventDefault();
			leaveEditor();
		});
		form.addEventListener('input', reportPending);
		form.addEventListener('change', reportPending);
		form.addEventListener('submit', saveSettings);
		ui.retryInput.addEventListener('input', hideRetryError);
	}

	function saveSettings(event) {
		event.preventDefault();
		const draft = readFormValues();
		if (!(draft.retries >= 1 && draft.retries <= 10)) {
			ui.retryError.hidden = false;
			ui.retryInput.setAttribute('aria-invalid', 'true');
			ui.retryInput.focus();
			return;
		}
		const edits = pendingRows().length;
		service.prefs = draft;
		paintSettingValues();
		refreshCards();
		leaveEditor();
		if (!edits) {
			notify({ tone: 'info', title: 'Nothing to save', text: 'The settings are as they were.', duration: 3000 });
			return;
		}
		notify({
			tone: 'success',
			title: `Settings saved for ${service.title}`,
			text: `${countWord(edits, 'change', 'changes')} saved. It checks for changes ${CADENCE[draft.every].toLowerCase()}.`,
			duration: 4000,
		});
	}

	/** Markup for one row: label (with help when there is some), read-only value, hidden control. */
	function settingRow(row) {
		const fieldId = `idt-set-${row.name}`;
		const label = `<label class="idt-set-label" for="${fieldId}">${htmlSafe(row.label)}</label>`;
		const help = row.help ? `<p class="idt-set-help" id="${fieldId}-help">${htmlSafe(row.help)}</p>` : '';
		const heading = help ? `<div>${label}${help}</div>` : label;
		return `<div class="idt-set-row">${heading}<p class="idt-set-value" data-idt-value="${row.name}"></p><div class="idt-set-field" hidden>${settingControl(row, fieldId)}</div></div>`;
	}

	function settingControl(row, fieldId) {
		if (row.kind === 'select') {
			const choices = row.choices
				.map(([value, caption]) => `<option value="${htmlSafe(value)}">${htmlSafe(caption)}</option>`)
				.join('');
			return `<select class="form-select" id="${fieldId}" name="${row.name}">${choices}</select>`;
		}
		if (row.kind === 'switch') {
			const described = row.help ? ` aria-describedby="${fieldId}-help"` : '';
			return `<div class="form-check form-switch mb-0"><input class="form-check-input" type="checkbox" role="switch" id="${fieldId}" name="${row.name}"${described}></div>`;
		}
		return [
			'<div class="basalt-stepper basalt-stepper-sm" data-basalt-stepper>',
			'<button type="button" class="basalt-stepper-btn" data-basalt-step="-1" aria-label="One try fewer"><i class="bi bi-dash" aria-hidden="true"></i></button>',
			`<input type="number" class="basalt-stepper-input" id="${fieldId}" name="${row.name}" min="1" max="10" inputmode="numeric" aria-describedby="${fieldId}-help ${fieldId}-error">`,
			'<button type="button" class="basalt-stepper-btn" data-basalt-step="1" aria-label="One try more"><i class="bi bi-plus" aria-hidden="true"></i></button>',
			`</div><p class="idt-error" id="${fieldId}-error" hidden>Pick a number from 1 to 10.</p>`,
		].join('');
	}

	function paintSettingValues() {
		for (const row of settingRows) {
			pick(`[data-idt-value="${row.name}"]`, ui.settingsForm).textContent = readableValue(row);
		}
	}

	function readableValue(row) {
		const stored = service.prefs[row.name];
		if (row.kind === 'switch') return stored ? 'On' : 'Off';
		if (row.kind === 'stepper') return countWord(stored, 'try', 'tries');
		return row.choices.find(([value]) => value === String(stored))[1];
	}

	function readFormValues() {
		const controls = ui.settingsForm.elements;
		const readers = {
			switch: (control) => control.checked,
			stepper: (control) => parseInt(control.value, 10),
			select: (control) => control.value,
		};
		return Object.fromEntries(settingRows.map((row) => [row.name, readers[row.kind](controls[row.name])]));
	}

	function loadFormValues() {
		const controls = ui.settingsForm.elements;
		for (const { name, kind } of settingRows) {
			const control = controls[name];
			if (kind === 'switch') control.checked = service.prefs[name];
			else control.value = service.prefs[name];
		}
	}

	function pendingRows() {
		const draft = readFormValues();
		return settingRows.filter(({ name }) => String(draft[name]) !== String(service.prefs[name]));
	}

	function reportPending() {
		const unsaved = pendingRows().length;
		ui.settingsStatus.textContent = unsaved
			? `${countWord(unsaved, 'change', 'changes')} not saved yet`
			: 'No changes yet';
	}

	function showEditor(editing) {
		for (const value of pickAll('.idt-set-value', ui.settingsForm)) value.hidden = editing;
		for (const slot of pickAll('.idt-set-field', ui.settingsForm)) slot.hidden = !editing;
		ui.settingsFoot.hidden = !editing;
		ui.editToggle.hidden = editing;
		ui.editToggle.setAttribute('aria-expanded', String(editing));
	}

	function hideRetryError() {
		ui.retryError.hidden = true;
		ui.retryInput.removeAttribute('aria-invalid');
	}

	function leaveEditor() {
		hideRetryError();
		showEditor(false);
		ui.editToggle.focus();
	}

	/* Turning a sample record into the working state the page reads from. */

	/**
	 * Finds the record for a slug (Xero when there is no match) and prepares
	 * its working state: timeline entries, default settings and who linked it.
	 */
	function resolveConnection(slug) {
		const record =
			CONNECTIONS.find((entry) => entry.slug === slug) || CONNECTIONS.find((entry) => entry.slug === 'xero');
		record.linkedBy ||= 'John Armstrong';
		const raw = record.history || seededHistory(record);
		record.events = raw.map(([minutesAgo, kind, text, glyph]) => ({
			kind,
			text,
			when: clockLabel(minutesAgo),
			glyph,
		}));
		record.prefs = {
			every: record.cadence,
			twoWay: record.area === 'books' || record.area === 'selling',
			alert: Boolean(record.vital) || record.state === 'failing',
			retries: record.vital ? 5 : 3,
		};
		for (const extra of record.extras) record.prefs[extra.name] = extra.initial;
		return record;
	}

	/*
	 * Services without a written history get twelve entries from a seeded
	 * generator, so the timeline is the same on every visit. Placeholders are
	 * filled in a fixed order, which keeps the number sequence stable.
	 */
	function seededHistory(record) {
		const nextRandom = seededRandom(20261009 + record.series * 31 + record.slug.length);
		const within = (low, high) => Math.floor(low + nextRandom() * (high - low + 1));
		const fillers = [
			['{money}', () => `$${within(29, 649)}.${String(within(0, 99)).padStart(2, '0')}`],
			['{payout}', () => `$${withCommas(within(9, 38) * 1000 + within(0, 999))}`],
			['{order}', () => within(4290, 4388)],
			['{invoice}', () => String(within(1400, 1460))],
			['{small}', () => within(1, 4)],
			['{n}', () => within(2, 14)],
			['{company}', () => CUSTOMER_NAMES[within(0, CUSTOMER_NAMES.length - 1)]],
			['{pack}', () => KIT_ITEMS[within(0, KIT_ITEMS.length - 1)]],
		];
		const fixedGaps = { 15: 15, 60: 60 };
		const gapAfter = () => fixedGaps[record.cadence] ?? within(4, 26);

		const backlog = [];
		let minutesAgo = record.minsSince;
		for (let position = 0; position < 12; position++) {
			if (record.miss?.index === position) {
				backlog.push([minutesAgo, 'failed', record.miss.text]);
			} else {
				let line = record.lines[position % record.lines.length];
				for (const [token, produce] of fillers) line = line.replace(token, produce);
				backlog.push([minutesAgo, 'ok', line]);
			}
			minutesAgo += gapAfter();
		}
		return backlog;
	}

	/** A small deterministic generator (mulberry32) returning floats in [0, 1). */
	function seededRandom(seed) {
		let state = seed >>> 0;
		return () => {
			state = (state + 0x6d2b79f5) >>> 0;
			let mixed = Math.imul(state ^ (state >>> 15), state | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	function ledgerChoices(...codes) {
		return codes.map((code) => [String(code), `${code} · ${LEDGER[code]}`]);
	}

	/* Dates, durations and counts in the wording the page uses. */

	/** "Today, 2:00 pm", "Yesterday, 9:41 am" or "Wed, Oct 7, 4:05 pm", counted back from the demo clock. */
	function clockLabel(minutesAgo) {
		const moment = new Date(DEMO_NOW.getTime() - minutesAgo * 60000);
		const midnight = (date) => new Date(date).setHours(0, 0, 0, 0);
		const daysBack = Math.round((midnight(DEMO_NOW) - midnight(moment)) / 86400000);
		const hour = moment.getHours();
		const time = `${hour % 12 || 12}:${String(moment.getMinutes()).padStart(2, '0')} ${hour < 12 ? 'am' : 'pm'}`;
		if (daysBack === 0) return `Today, ${time}`;
		if (daysBack === 1) return `Yesterday, ${time}`;
		return `${moment.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
	}

	function sinceWords(minutes) {
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes} min ago`;
		if (minutes < 1440) return `${Math.floor(minutes / 60)} h ago`;
		const wholeDays = Math.floor(minutes / 1440);
		return `${wholeDays} ${minutes < 2880 ? 'day' : 'days'} ago`;
	}

	function countWord(count, one, many) {
		return `${count} ${count === 1 ? one : many}`;
	}

	function upperFirst(text) {
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value).replace(/[&<>"']/g, (char) => entities[char]);
	}

	function withCommas(value) {
		return Number(value).toLocaleString('en-US');
	}

	/* The chart needs real color values, so tokens are read and mixed here. */

	function themeToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** Reads #rgb, #rrggbb, rgb() or rgba() into three channels; anything else is mid gray. */
	function rgbParts(color) {
		const text = String(color || '').trim();
		const short = text.match(/^#([0-9a-f]{3})$/i);
		if (short) return [...short[1]].map((digit) => parseInt(digit + digit, 16));
		const long = text.match(/^#([0-9a-f]{6})$/i);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
		}
		const functional = text.match(/^rgba?\(([^)]+)\)$/i);
		if (functional) return functional[1].split(',').slice(0, 3).map(parseFloat);
		return [128, 128, 128];
	}

	function blend(first, second, weight) {
		const a = rgbParts(first);
		const b = rgbParts(second);
		const mixed = Array.from({ length: 3 }, (_, i) => Math.round(a[i] * weight + b[i] * (1 - weight)));
		return `rgb(${mixed.join(', ')})`;
	}

	function tint(color, alpha) {
		return `rgba(${rgbParts(color).join(', ')}, ${alpha})`;
	}

	function distance(first, second) {
		const a = rgbParts(first);
		const b = rgbParts(second);
		return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
	}

	/**
	 * The first time a list is on screen, its rows rise in one after another.
	 * Rows drawn again later (a filter, Show all) appear as they are.
	 * @param {HTMLElement|null} list
	 */
	function playOnSight(list) {
		if (!list || prefersStill() || !('IntersectionObserver' in window)) return;
		list.classList.add('is-waiting');
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				list.classList.replace('is-waiting', 'is-drawing');
				const runs = list
					.getAnimations({ subtree: true })
					.filter((run) => run.animationName?.startsWith('idt-rise') || run.animationName === 'idt-rail');
				Promise.allSettled(runs.map((run) => run.finished)).then(() => list.classList.remove('is-drawing'));
			},
			{ threshold: 0.3 },
		);
		watch.observe(list);
	}

	/* Lookups and thin wrappers around the shared basalt.js helpers. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function prefersStill() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function wait(ms) {
		return new Promise((resolve) => {
			setTimeout(resolve, prefersStill() ? Math.min(ms, 250) : ms);
		});
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function speak(message) {
		window.Basalt.announce?.(message);
	}

	function setButton(button, state, label) {
		window.Basalt.buttonState?.(button, state, label);
	}

	start();
})();
