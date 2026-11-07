/**
 * What Fieldline charged its customers and what came back, exposed as
 * window.Basalt.data.billing.
 *
 * Two sources feed the ledger. Plan bills are taken from the accounts file
 * (window.Basalt.data.accounts.bills) and joined by renewals that went out,
 * or sit as drafts, ahead of a renewal day. Everything else is a one-off
 * order placed outside the plan: text credits, training, set-up work and
 * imports. Invoices start on August 17; payments are kept from September 26.
 *
 * The Invoices, Invoice, Receipts, Income and Transactions pages, plus the
 * reports, all read this one ledger, so a number shows the same customer,
 * lines and total wherever it appears, and invoice-details.html?id=<number> can open
 * any of them. accounts.js has to be loaded first. Swapping in a real billing
 * back end means returning its invoices and payments here in these shapes.
 */
(() => {
	'use strict';
	const accounts = window.Basalt.data?.accounts;
	if (!accounts) throw new Error('billing.js depends on accounts.js; include that script earlier.');

	/* The ledger is read as of a fixed demo moment rather than the real clock,
     and only covers invoices issued, and payments taken, inside its window.
     The window is published as it stands. */
	const DEMO_NOW = '2026-10-09T10:40';
	const WINDOW = { today: DEMO_NOW.slice(0, 10), since: '2026-08-17', paidSince: '2026-09-26' };

	const MONTH_LABELS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
	const { plans: plansById, addOns: addOnsById } = accounts;

	/* How each plan bill was followed up, per account: how many days passed
     before the customer opened it, and when the latest reminder went. */
	const FOLLOW_UP = {
		harborline: [1],
		brightline: [2],
		clearwater: [2],
		redline: [1],
		larchwood: [1],
		aspenhollow: [3, '2026-09-30'],
		copperleaf: [1, '2026-09-29'],
		luminary: [4, '2026-10-06'],
	};

	/* Renewals raised before their renewal day. "sent" went out thirty days
     early; a draft is held back, Lumora AI's for a bigger seat count still
     being quoted and Polar Air's until it goes out on October 12. */
	const EARLY_RENEWALS = {
		redline: 'sent',
		larchwood: 'sent',
		ironbridge: 'sent',
		lumoraai: {
			draftedOn: '2026-10-07',
			seats: 94,
			note: 'Waiting on the renewal quote #437 for 94 seats.',
		},
		polarair: { draftedOn: '2026-10-08' },
	};

	/* Customers who settle by wire rather than ACH. Everyone else pays by
     ACH from one of the US banks below. */
	const WIRE_PAYERS = new Set(
		'oakhaven avocet highpoint copperleaf ironbridge brightline evergreen polarair solaris tidewater halden downland vistalandscaping aspenhollow fernhill valleypetcare rainier luminary northbrook tamara clearview skerry clearwater alder oakmont brookside'.split(
			' ',
		),
	);

	/* Where transfers are drawn from. */
	const BANKS = [
		'Frost',
		'Capital One',
		'Bank of America',
		'U.S. Bank',
		'Truist',
		'PNC Bank',
		'Fifth Third',
		'KeyBank',
	];

	/* State sales tax on one-off orders: [label, percent], by the state in
     the customer's address. States with no sales tax are left out. */
	const SALES_TAX = {
		AL: ['Alabama sales tax 4%', 4],
		AR: ['Arkansas sales tax 6.5%', 6.5],
		AZ: ['Arizona sales tax 5.6%', 5.6],
		CA: ['California sales tax 7.25%', 7.25],
		CO: ['Colorado sales tax 2.9%', 2.9],
		CT: ['Connecticut sales tax 6.35%', 6.35],
		DC: ['District of Columbia sales tax 6%', 6],
		FL: ['Florida sales tax 6%', 6],
		GA: ['Georgia sales tax 4%', 4],
		HI: ['Hawaii general excise tax 4%', 4],
		IA: ['Iowa sales tax 6%', 6],
		ID: ['Idaho sales tax 6%', 6],
		IL: ['Illinois sales tax 6.25%', 6.25],
		IN: ['Indiana sales tax 7%', 7],
		KS: ['Kansas sales tax 6.5%', 6.5],
		KY: ['Kentucky sales tax 6%', 6],
		LA: ['Louisiana sales tax 5%', 5],
		MA: ['Massachusetts sales tax 6.25%', 6.25],
		MD: ['Maryland sales tax 6%', 6],
		ME: ['Maine sales tax 5.5%', 5.5],
		MI: ['Michigan sales tax 6%', 6],
		MN: ['Minnesota sales tax 6.875%', 6.875],
		MO: ['Missouri sales tax 4.225%', 4.225],
		MS: ['Mississippi sales tax 7%', 7],
		NC: ['North Carolina sales tax 4.75%', 4.75],
		ND: ['North Dakota sales tax 5%', 5],
		NE: ['Nebraska sales tax 5.5%', 5.5],
		NJ: ['New Jersey sales tax 6.625%', 6.625],
		NM: ['New Mexico gross receipts tax 4.875%', 4.875],
		NV: ['Nevada sales tax 6.85%', 6.85],
		NY: ['New York sales tax 4%', 4],
		OH: ['Ohio sales tax 5.75%', 5.75],
		OK: ['Oklahoma sales tax 4.5%', 4.5],
		PA: ['Pennsylvania sales tax 6%', 6],
		RI: ['Rhode Island sales tax 7%', 7],
		SC: ['South Carolina sales tax 6%', 6],
		SD: ['South Dakota sales tax 4.2%', 4.2],
		TN: ['Tennessee sales tax 7%', 7],
		TX: ['Texas sales tax 6.25%', 6.25],
		UT: ['Utah sales tax 4.85%', 4.85],
		VA: ['Virginia sales tax 4.3%', 4.3],
		VT: ['Vermont sales tax 6%', 6],
		WA: ['Washington sales tax 6.5%', 6.5],
		WI: ['Wisconsin sales tax 5%', 5],
		WV: ['West Virginia sales tax 6%', 6],
		WY: ['Wyoming sales tax 4%', 4],
	};

	/* The catalog of one-off items: [name, what it covers, price, kind].
     Onboarding and training count as a service, the rest as an extra. */
	const CATALOG = {
		onboarding: ['Onboarding package', 'Set-up, data import and two sessions', 1250, 'service'],
		training: ['Live training session', 'Two hours online, up to 12 people', 350, 'service'],
		setup: ['Office set-up call', 'One hour with an onboarding specialist', 89, 'extra'],
		staff: ['Staff onboarding', 'App set-up and a call for one team', 119, 'extra'],
		import: ['Data import', 'Customers, addresses and price list', 649, 'extra'],
		profiles: ['Staff profile import', 'Up to 25 staff from a spreadsheet', 49, 'extra'],
		course: ['Scheduler course', 'Four online lessons for one scheduler', 429, 'extra'],
		form: ['Custom form build', 'One visit form built to your layout', 189, 'extra'],
		report: ['Report template', 'One report built for the office', 149, 'extra'],
		sms: ['SMS credit pack', '1,000 text messages', 25, 'extra'],
		phone: ['Extra phone line', 'A text-back number for a year', 59, 'extra'],
		storage: ['Extra storage, 10 GB', 'Photos and files, for a year', 39, 'extra'],
	};

	/* Transfers that came in by ACH from a customer who usually wires. */
	const ACH = { by: 'ach' };

	/* One-off orders, newest day first. Each row is [order number without
     its #, account, "item count" pairs, how it was paid]. */
	const ORDER_DAYS = [
		[
			'2026-10-09',
			[
				['0483', 'valleypetcare', 'staff 6', invoiced(30)],
				['0482', 'redline', 'staff 8', carded('Mastercard 3826', '08:05', '95900')],
			],
		],
		[
			'2026-10-08',
			[
				['0481', 'volt', 'training 2, report 1', invoiced(30)],
				['0480', 'cornerstone', 'onboarding 1, training 1', invoiced(30)],
				['0479', 'polarair', 'sms 28', carded('Visa 7903', '10:40', '90117')],
				['0478', 'oakhaven', 'training 6', invoiced(30)],
			],
		],
		[
			'2026-10-07',
			[
				['0477', 'avocet', 'sms 4', invoiced(30)],
				['0476', 'clearview', 'phone 6', carded('Mastercard 6483', '13:40', '92385')],
				['0475', 'lakeside', 'training 1, sms 4', carded('Mastercard 1514', '10:20', '98057')],
				['0474', 'highpoint', 'sms 20', invoiced(7, '2026-10-07 09:50', ACH)],
			],
		],
		[
			'2026-10-06',
			[
				['0473', 'moorings', 'phone 3, sms 4', carded('Visa 1087', '15:20', '91236')],
				['0472', 'ironbridge', 'report 2, form 1', invoiced(30)],
				['0471', 'lumoraai', 'sms 20', refused('Visa 5644', '09:45')],
			],
		],
		[
			'2026-10-05',
			[
				['0470', 'brightline', 'import 1, course 4', carded('Amex 3391', '16:10', '93458')],
				['0469', 'bluepeak', 'training 1, form 1, report 1', invoiced(30)],
				['0468', 'millrace', 'onboarding 2, training 8, import 1', invoiced(30)],
				['0467', 'rainier', 'form 4', invoiced(30)],
			],
		],
		[
			'2026-10-04',
			[
				['0466', 'halden', 'training 4', invoiced(7)],
				['0465', 'volt', 'form 3', invoiced(30)],
			],
		],
		[
			'2026-10-03',
			[
				['0464', 'valleypetcare', 'import 1, course 3', invoiced(30)],
				['0463', 'copperleaf', 'sms 10', carded('Amex 1219', '11:20', '98203')],
				['0462', 'downland', 'profiles 4', carded('Mastercard 7055', '09:50', '95182')],
			],
		],
		[
			'2026-10-02',
			[
				['0461', 'redline', 'training 2, report 1, sms 4', carded('Mastercard 2142', '15:30', '93623')],
				['0460', 'fernhill', 'phone 2, sms 4', invoiced(30)],
				['0459', 'brightwater', 'training 1', carded('Amex 7285', '09:15', '99277')],
			],
		],
		[
			'2026-10-01',
			[
				['0458', 'cornerstone', 'course 8, training 4, import 1', invoiced(30)],
				['0457', 'avocet', 'training 2', invoiced(30)],
			],
		],
		[
			'2026-09-30',
			[
				['0456', 'highpoint', 'training 1', invoiced(7, '2026-09-30 14:40', ACH)],
				['0455', 'oakhaven', 'sms 16', invoiced(30)],
			],
		],
		[
			'2026-09-29',
			[
				['0454', 'moorings', 'sms 12', invoiced(30)],
				['0453', 'evergreen', 'training 2', carded('Amex 6383', '09:10', '93269')],
			],
		],
		[
			'2026-09-28',
			[
				['0452', 'brightline', 'profiles 5', carded('Mastercard 1472', '16:20', '91269')],
				['0451', 'tidewater', 'storage 8', carded('Visa 8078', '13:00', '91572')],
				['0450', 'solaris', 'staff 5', carded('Visa 4709', '10:40', '91467')],
				['0449', 'polarair', 'training 2', carded('Visa 8639', '08:30', '93069')],
			],
		],
		[
			'2026-09-27',
			[
				['0448', 'highpoint', 'storage 10', invoiced(7, '2026-09-27 12:50', ACH)],
				['0447', 'larchwood', 'form 2', carded('Visa 4157', '09:05', '93046')],
			],
		],
		[
			'2026-09-26',
			[
				['0446', 'northbrook', 'profiles 5', invoiced(7, '2026-09-29 10:15', { check: '3891' })],
				['0445', 'clearview', 'course 3', carded('Amex 4552', '12:30', '95425')],
			],
		],
		['2026-09-25', [['0443', 'bluepeak', 'report 3', invoiced(30)]]],
		[
			'2026-09-24',
			[
				['0442', 'brightwater', 'import 2', carded('Visa 5190', '16:05', '93679')],
				['0440', 'volt', 'onboarding 1, training 4, course 6', invoiced(30)],
			],
		],
		['2026-09-23', [['0438', 'rainier', 'setup 4', invoiced(30)]]],
		[
			'2026-09-22',
			[
				['0436', 'lumoraai', 'course 6, training 4', invoiced(30)],
				['0435', 'tamara', 'report 4', invoiced(30)],
			],
		],
		[
			'2026-09-21',
			[
				['0434', 'harborline', 'course 6', invoiced(30)],
				['0433', 'valleypetcare', 'phone 5', invoiced(30)],
			],
		],
		['2026-09-19', [['0431', 'oakhaven', 'import 1, training 1, sms 20', invoiced(30, '2026-10-07 11:00')]]],
		[
			'2026-09-18',
			[
				['0430', 'polarair', 'import 1, training 1, sms 4', invoiced(30, '2026-10-06 11:00')],
				['0429', 'ironbridge', 'import 1, sms 8', invoiced(7, '2026-09-18 09:41')],
			],
		],
		['2026-09-15', [['0426', 'bluepeak', 'onboarding 1', invoiced(30, '2026-10-03 11:00')]]],
		['2026-09-14', [['0425', 'evergreen', 'course 2, form 1', invoiced(7, '2026-09-17 10:15', { check: '2829' })]]],
		['2026-09-13', [['0424', 'highpoint', 'import 1, training 1, sms 8', invoiced(7, '2026-09-13 11:54', ACH)]]],
		['2026-09-11', [['0422', 'moorings', 'training 1, sms 4', invoiced(30, '2026-09-29 11:00')]]],
		['2026-09-07', [['0420', 'copperleaf', 'training 1', invoiced(7, '2026-09-10 10:15', { check: '0650' })]]],
		['2026-09-05', [['0419', 'avocet', 'import 1, training 1, sms 2', invoiced(30, '2026-09-23 11:00')]]],
		['2026-09-04', [['0418', 'oakhaven', 'training 1, sms 4', invoiced(30, '2026-09-22 11:00')]]],
		['2026-08-31', [['0416', 'fernhill', 'training 2, setup 1, sms 4', invoiced(30, '2026-09-18 11:00')]]],
		['2026-08-28', [['0415', 'polarair', 'training 1, sms 4', invoiced(30, '2026-09-15 11:00')]]],
	];

	/* Orders refunded this month: [order, refunded on, "item count" pairs,
     reason, what happened]. */
	const REFUNDED = [
		[
			'#449',
			'2026-10-07',
			'training 1',
			'Session not held',
			'The second session clashed with a public holiday and they chose not to book another. Refunded to the card.',
		],
		[
			'#442',
			'2026-10-02',
			'import 1',
			'Charged twice',
			'The office paid again when the page timed out. The second data import was refunded to the card.',
		],
	];

	/* The one card charge under dispute. The training it paid for did take
     place, run by the trainer named here; the customer's contact attended. */
	const DISPUTED = {
		'#461': {
			opened: '2026-10-08',
			due: '2026-10-18',
			reason: 'Service not received',
			held: '2026-10-06',
			by: 'Courtney Lowry',
			session: '#260461',
		},
	};

	publish();

	/** Works out the ledger once and hangs the read-only API on window.Basalt.data. */
	function publish() {
		const orders = ORDER_DAYS.flatMap(([day, rows]) => rows.map((row) => placeOrder(day, row)));
		const ledger = [...planInvoices(), ...orderInvoices(orders)].map((invoice) =>
			Object.assign(invoice, totalsOf(invoice)),
		);
		ledger.sort((a, b) => listedOn(b).localeCompare(listedOn(a)) || b.no.localeCompare(a.no));
		const received = paymentsFor(ledger, orders);
		const orderNumbered = (no) => orders.find((order) => order.no === no);

		window.Basalt.data = window.Basalt.data || {};
		window.Basalt.data.billing = {
			...WINDOW,

			/** Every invoice, newest first, as fresh copies a page may change. */
			invoices() {
				return ledger.map(detached);
			},

			/** One invoice by its number, or null when there is none. */
			find(no) {
				const match = ledger.find((invoice) => invoice.no === no) ?? olderBill(no);
				return match ? detached(match) : null;
			},

			/** Payments taken since paidSince, newest first. */
			payments() {
				return received.map(detached);
			},

			/** A one-off order by its number, with lines and totals, or null. */
			purchase(no) {
				const order = orderNumbered(no);
				if (!order) return null;
				const { account, on, kind, item, lines, tax } = order;
				return detached({
					no,
					acct: account.id,
					customer: account.name,
					on,
					kind,
					item,
					lines,
					tax,
					...totalsOf(order),
				});
			},

			/** Orders paid back this month, newest first. */
			refunds() {
				return REFUNDED.map((row) => refundOf(orderNumbered(row[0]), row));
			},

			/** Who an account's invoices are addressed to, or null for an unknown id. */
			billTo(id) {
				const account = accounts.find(id);
				return account ? { name: account.name, account: account.id, ...recipientOf(account) } : null;
			},
		};
	}

	/* Plan invoices. A renewal is dated thirty days before the renewal day and
     falls due on it; it charges twelve months of the plan and its add-ons at
     the monthly price the accounts file bills. Seat top-ups are charged once,
     for the rest of the current year, and fall due thirty days later. */

	/** Plan bills for every paying account, followed by its early renewal if any. */
	function planInvoices() {
		return accounts
			.list()
			.filter((account) => account.status !== 'trial')
			.flatMap((account) => {
				const header = { ...invoiceHeader(account), tax: null, terms: 30 };
				const seatsOverTime = accounts.history(account);
				const issued = accounts
					.bills(account)
					.filter((bill) => shifted(bill.at, { days: -30 }) >= WINDOW.since)
					.map((bill) => billInvoice(account, header, bill, seatsOverTime));
				const early = EARLY_RENEWALS[account.id];
				if (early && account.status !== 'canceling')
					issued.push(earlyInvoice(account, header, early, seatsOverTime.length));
				return issued;
			});
	}

	/** A subscription bill from before the listing window, built the same
	    way as the ones in it, or null when no account has that number. */
	function olderBill(no) {
		for (const account of accounts.list()) {
			const bill = accounts.bills(account).find((entry) => entry.no === no);
			if (!bill) continue;
			const header = { ...invoiceHeader(account), tax: null, terms: 30 };
			const invoice = billInvoice(account, header, bill, accounts.history(account));
			return Object.assign(invoice, totalsOf(invoice));
		}
		return null;
	}

	/** Who an invoice is for: the account, its billing contact and address. */
	function invoiceHeader(account) {
		const { contact, title, email } = recipientOf(account);
		return {
			acct: account.id,
			accountNo: account.no,
			customer: account.name,
			contact,
			title,
			email,
			address: account.address,
		};
	}

	/** Turns one bill from the accounts file into an invoice. */
	function billInvoice(account, header, bill, seatsOverTime) {
		const planName = plansById[account.plan].name;
		const topUp = /more seats/.test(bill.what);
		const [openedAfter, remindedOn] = FOLLOW_UP[account.id] ?? [];
		const paidByCard = isCardPayer(account);
		const invoice = {
			...header,
			no: bill.no,
			kind: topUp ? 'seats' : 'renewal',
			item: topUp
				? bill.what.replace(/^(\d+) more seats.*/, `${planName}, $1 more seats`)
				: `${planName} plan, ${bill.what.toLowerCase()}`,
			lines: topUp
				? [topUpLine(account, bill)]
				: yearOfService(
						account,
						(seatsOverTime.find(([on]) => on === bill.at) ?? seatsOverTime.at(-1))[1],
						bill.at,
					),
			issued: topUp ? bill.at : shifted(bill.at, { days: -30 }),
			due: topUp ? shifted(bill.at, { days: 30 }) : bill.at,
			state: bill.state === 'paid' ? 'paid' : 'sent',
		};
		if (openedAfter) invoice.opened = shifted(invoice.issued, { days: openedAfter });
		if (remindedOn) invoice.reminded = remindedOn;

		if (bill.state === 'paid') {
			const on = topUp ? shifted(bill.at, { days: 7 }) : bill.at;
			const method = paidByCard ? 'card' : usualTransfer(account);
			invoice.paid = {
				on,
				at: `${on} 10:${padded(10 + (accountSerial(account) % 40))}`,
				method,
				from: paidByCard ? `Visa ending ${account.pay.slice(-4)}` : bankFor(account, invoice.no, method),
				id: transactionRef(invoice.no),
			};
		} else if (paidByCard) {
			invoice.declined = {
				on: bill.at,
				card: `Visa ending ${account.pay.slice(-4)}`,
				id: transactionRef(invoice.no),
			};
		}
		return invoice;
	}

	/** A renewal raised ahead of the account's next renewal day, sent or drafted. */
	function earlyInvoice(account, header, early, billCount) {
		const seats = early.seats || account.seats;
		const yearNo = Math.round((toDate(account.renews) - toDate(account.since)) / (365.25 * 864e5)) + 1;
		const invoice = {
			...header,
			no: renewalNumber(account, billCount),
			kind: 'renewal',
			item: `${plansById[account.plan].name} plan, year ${yearNo}, ${seats} seats`,
			lines: yearOfService(account, seats, account.renews),
			due: account.renews,
		};
		if (early !== 'sent')
			return Object.assign(invoice, { state: 'draft', saved: early.draftedOn, note: early.note || '' });

		const issued = shifted(account.renews, { days: -30 });
		Object.assign(invoice, { state: 'sent', issued });
		const openedOn = FOLLOW_UP[account.id]?.[0] && shifted(issued, { days: FOLLOW_UP[account.id][0] });
		if (openedOn && openedOn <= WINDOW.today) invoice.opened = openedOn;
		return invoice;
	}

	/** Twelve months of the plan, then any add-ons, from the given day. */
	function yearOfService(account, seats, startsOn) {
		const period = `${shortDay(startsOn)}–${longDay(shifted(startsOn, { years: 1, days: -1 }))}`;
		const plan = plansById[account.plan];
		const months = (name, desc, unit) => ({ name, desc, period, qty: 12, unit });
		const lines = [
			months(
				`${plan.name} plan`,
				`${seats} seats, billed yearly at ten months’ price`,
				toCents(((plan.price * 10) / 12) * seats),
			),
		];
		for (const key of ['route', 'portal']) {
			const { name, per } = addOnsById[key];
			if (account[key]) lines.push(months(name, `${seats} seats at $${per} a month`, per * seats));
		}
		if (account.sms) {
			const { name, per } = addOnsById.sms;
			lines.push(
				months(name, `${(account.sms * 1000).toLocaleString('en-US')} messages a month`, per * account.sms),
			);
		}
		return lines;
	}

	/** The single line of a seat top-up, running to the day before renewal. */
	function topUpLine({ plan, renews }, { what, at, amount }) {
		return {
			name: `${plansById[plan].name} plan, added seats`,
			desc: what,
			period: `${shortDay(at)}–${longDay(shifted(renews, { days: -1 }))}`,
			qty: 1,
			unit: amount,
		};
	}

	/** The number an early renewal gets, built from the account and its bill count. */
	function renewalNumber({ renews, no }, billCount) {
		const serial = 1000 + ((accountSerial({ no }) * 37 + billCount * 11) % 9000);
		return `#${serial}`;
	}

	/* One-off orders. Orders paid by card never get an invoice; the rest are
     invoiced the day they are placed and are due after their terms. */

	/** Expands an order row into its account, lines, label and tax. */
	function placeOrder(on, [serial, accountId, picks, pay]) {
		const account = accounts.find(accountId);
		const counts = parsePicks(picks);
		const lines = counts.map(([key, qty]) => {
			const [name, desc, unit] = CATALOG[key];
			return { name, desc, period: `Bought ${longDay(on)}`, qty, unit, key };
		});
		const [firstKey, firstQty] = counts[0];
		const subtotal = lines.reduce((sum, line) => sum + line.qty * line.unit, 0);
		return {
			no: `#${Number(serial)}`,
			account,
			on,
			pay: typeof pay === 'function' ? pay(on) : pay,
			lines,
			kind: counts.every(([key]) => CATALOG[key][3] === 'service') ? 'service' : 'extra',
			item:
				counts.length > 1
					? `${CATALOG[firstKey][0]} and ${counts.length - 1} more`
					: `${CATALOG[firstKey][0]} ×${firstQty}`,
			tax: taxLine(account, subtotal),
		};
	}

	/** Invoices for the orders bought on terms within the listing window. */
	function orderInvoices(orders) {
		return orders
			.filter(({ pay, on }) => !pay.card && on >= WINDOW.since)
			.map(({ no, account, on, pay, item, lines, tax }) => {
				const invoice = {
					no: `#${5000 + Number(no.replace(/\D/g, ''))}`,
					kind: 'purchase',
					purchase: no,
					...invoiceHeader(account),
					item,
					lines: lines.map((line) => ({ ...line })),
					tax,
					terms: pay.terms,
					issued: on,
					due: shifted(on, { days: pay.terms }),
					state: pay.paid ? 'paid' : 'sent',
				};
				const nextDay = shifted(on, { days: 1 });
				if (nextDay <= WINDOW.today) invoice.opened = nextDay;
				if (pay.paid) {
					const method = pay.check ? 'check' : pay.by || usualTransfer(account);
					invoice.paid = {
						on: pay.paid.slice(0, 10),
						at: pay.paid,
						method,
						from: pay.check ? `Check no. ${pay.check}` : bankFor(account, invoice.no, method),
						id: transactionRef(invoice.no),
					};
				}
				return invoice;
			});
	}

	/** An order on payment terms, with when and how it was settled once paid. */
	function invoiced(terms, paid, how) {
		return { terms, paid, ...how };
	}

	/** A card payment taken on the order day at the given time. */
	function carded(card, time, ref) {
		return (on) => ({ card, paid: `${on} ${time}`, ref: `#${ref}` });
	}

	/** A card that was turned down on the order day at the given time. */
	function refused(card, time) {
		return (on) => ({ card, declined: `${on} ${time}` });
	}

	/** Reads "training 2, sms 4" as [['training', 2], ['sms', 4]]. */
	function parsePicks(text) {
		return text.split(', ').map((pick) => {
			const [key, count] = pick.split(' ');
			return [key, Number(count)];
		});
	}

	/** The tax an order owes in the customer's state, or null where none applies. */
	function taxLine(account, subtotal) {
		const state = /, ([A-Z]{2}) /.exec(account.address[1] || '');
		const [label, percent] = (state && SALES_TAX[state[1]]) || [];
		return label ? { label, amount: toCents((subtotal * percent) / 100) } : null;
	}

	/** Builds one refund from its order: the lines given back and their tax. */
	function refundOf({ account, kind, pay }, [no, on, picks, reason, note]) {
		const lines = parsePicks(picks).map(([key, qty]) => {
			const [name, , unit] = CATALOG[key];
			return { name, desc: `${qty} at $${unit.toLocaleString('en-US')}`, amount: qty * unit };
		});
		const subtotal = lines.reduce((sum, { amount }) => sum + amount, 0);
		return {
			no,
			on,
			acct: account.id,
			customer: account.name,
			kind,
			reason,
			note,
			card: pay.card ? pay.card.slice(-4) : null,
			lines,
			tax: taxLine(account, subtotal),
		};
	}

	/* Payments. Invoice settlements and failed card renewals come first, then
     card orders; the stable sort keeps that order for equal times. */

	/** Every payment inside the window, newest first. */
	function paymentsFor(ledger, orders) {
		const received = [];
		const listed = (on) => on >= WINDOW.paidSince;
		for (const { paid, declined, acct, customer, no, amount } of ledger) {
			const header = { acct, customer, for: ['invoice', no] };
			if (paid && listed(paid.on) && paid.at.replace(' ', 'T') <= DEMO_NOW) {
				received.push({
					id: paid.id,
					at: paid.at,
					...header,
					method: paid.method,
					from: paid.from,
					amount,
					state: 'ok',
				});
			}
			if (declined && listed(declined.on)) {
				received.push({
					id: declined.id,
					at: `${declined.on} 06:00`,
					...header,
					method: 'card',
					from: declined.card,
					amount,
					state: 'failed',
					why: 'The bank declined the card at renewal: not enough funds.',
				});
			}
		}

		for (const order of orders.filter(({ pay }) => pay.card)) {
			const { pay, account } = order;
			const charge = {
				acct: account.id,
				customer: account.name,
				for: ['purchase', order.no],
				method: 'card',
				from: pay.card.replace(/ (\d{4})$/, ' ending $1'),
				amount: totalsOf(order).amount,
			};
			if (pay.paid && listed(pay.paid)) {
				received.push(withDispute(order, { id: pay.ref, at: pay.paid, state: 'ok', ...charge }));
			} else if (pay.declined && listed(pay.declined)) {
				received.push({
					id: transactionRef(order.no),
					at: pay.declined,
					state: 'failed',
					why: 'The bank declined the card: not enough funds.',
					...charge,
				});
			}
		}
		return received.sort((a, b) => b.at.localeCompare(a.at));
	}

	/** Marks a card payment as disputed when its order is on the dispute list. */
	function withDispute({ no, account: { people } }, payment) {
		const dispute = DISPUTED[no];
		if (!dispute) return payment;
		const [given, ...rest] = (people.find((person) => person.main) || people[0]).name.split(' ');
		payment.state = 'disputed';
		payment.dispute = { attended: [`${given[0]}.`, ...rest].join(' '), ...dispute };
		return payment;
	}

	/* Shared helpers: who gets billed, how money moves, totals and dates. */

	/** The person invoices go to: accounts payable first, then the main contact. */
	function recipientOf({ people }) {
		const person = people.find(({ role }) => role === 'billing') || people.find(({ main }) => main) || people[0];
		return { contact: person.name, title: person.title, email: person.email };
	}

	function isCardPayer({ pay }) {
		return (pay || '').startsWith('Card');
	}

	/** Most customers pay by ACH; the ones on the wire list send a wire. */
	function usualTransfer(account) {
		return WIRE_PAYERS.has(account.id) ? 'wire' : 'ach';
	}

	function accountSerial({ no }) {
		return Number(no.replace(/\D/g, ''));
	}

	/** The bank a transfer came from; ACH payments also show four account digits. */
	function bankFor(account, seedText, method) {
		const draw = seededDraws(seedText);
		const bank = BANKS[Math.floor(draw() * BANKS.length)];
		if (method !== 'ach') return bank;
		return `${bank} ···${1000 + Math.floor(draw() * 9000)}`;
	}

	function transactionRef(seedText) {
		const draw = seededDraws(`${seedText}:txn`);
		return `#9${padded(Math.floor(draw() * 10000), 4)}`;
	}

	/**
	 * A repeatable stream of numbers in [0, 1) for a given text, so every page
	 * draws the same bank and reference for the same invoice. The text is hashed
	 * with FNV-1a and the hash drives a mulberry32 generator.
	 */
	function seededDraws(seedText) {
		let state = [...seedText].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261);
		return function draw() {
			state = (state + 0x6d2b79f5) >>> 0;
			let mixed = Math.imul(state ^ (state >>> 15), state | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32;
		};
	}

	/** Subtotal and amount due, worked out in whole cents to avoid drift. */
	function totalsOf({ lines, discount, shipping, tax }) {
		const cents = (value) => Math.round(value * 100);
		const subtotal = lines.reduce((sum, { qty, unit }) => sum + cents(qty * unit), 0);
		const due =
			subtotal -
			(discount ? cents(discount.amount) : 0) +
			(shipping ? cents(shipping.amount) : 0) +
			(tax ? cents(tax.amount) : 0);
		return { subtotal: subtotal / 100, amount: due / 100 };
	}

	function listedOn({ issued, saved }) {
		return issued || saved;
	}

	function detached(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function toCents(value) {
		return Math.round(value * 100) / 100;
	}

	function padded(value, width = 2) {
		return String(value).padStart(width, '0');
	}

	function toDate(day) {
		const [year, month, date] = day.slice(0, 10).split('-').map(Number);
		return new Date(year, month - 1, date);
	}

	function toDay(date) {
		return `${date.getFullYear()}-${padded(date.getMonth() + 1)}-${padded(date.getDate())}`;
	}

	/** Moves a "YYYY-MM-DD" day by whole years first, then by days. */
	function shifted(day, { years = 0, days = 0 }) {
		const moved = toDate(day);
		if (years) moved.setFullYear(moved.getFullYear() + years);
		if (days) moved.setDate(moved.getDate() + days);
		return toDay(moved);
	}

	/** "Sep 5", the form a billing period starts with. */
	function shortDay(day) {
		const [, month, date] = day.slice(0, 10).split('-').map(Number);
		return `${MONTH_LABELS[month - 1]} ${date}`;
	}

	/** "Sep 5, 2026". */
	function longDay(day) {
		return `${shortDay(day)}, ${day.slice(0, 4)}`;
	}
})();
