/**
 * Demo data for transaction-details.html, published as
 * window.Basalt.data.transactions. It holds everything the Northbank feed
 * has delivered since October 1 and how each item ended up in the books.
 * The order and the figures mirror the Transactions list, so the n in
 * transaction-details.html?id=<n> is simply the item's position here,
 * counted from 1.
 *
 * What the page can read:
 *   today, me    the date the demo pretends it is, and who is signed in
 *   accounts     Fieldline's three bank accounts, opening at Sep 30
 *   categories   income and expense codes an item may be filed under
 *   ledger       every code an item may be posted to
 *   lines        the feed items, earliest first, each with an id and the
 *                running balance of its account
 *   find(id)     a single item, or null when the id is unknown
 *
 * match says who tied an item to the books and when; suggest is a pairing
 * nobody has approved yet. records lists the invoices, bills, receipts
 * and journal entries an item points to, and notes and files hang off the
 * item itself. Swap in your own feed and ledger in the same shapes.
 */
(() => {
	'use strict';

	const DEMO_DATE = '2026-10-09';
	const SIGNED_IN = 'John Armstrong';

	const BANK_ACCOUNTS = [
		{
			key: 'operating',
			code: '10100',
			name: 'Operating Account',
			short: 'Operating',
			last4: '5182',
			kind: 'Checking',
			open: 2806094.6,
		},
		{
			key: 'payroll',
			code: '10200',
			name: 'Payroll Account',
			short: 'Payroll',
			last4: '2207',
			kind: 'Checking',
			open: 48200,
		},
		{
			key: 'reserve',
			code: '10300',
			name: 'Reserve Savings',
			short: 'Reserve',
			last4: '2915',
			kind: 'Savings',
			open: 1500000,
		},
	];

	/* Revenue codes first, then costs of service, then operating costs,
     exactly as the chart of accounts lists them. */
	const FILING_CODES = codeTable(`
    41100 Subscription Revenue
    41300 Add-on Revenue
    41500 Onboarding & Training
    51100 Hosting & Infrastructure
    51300 SMS & Phone Line Costs
    51500 Payment Processing Fees
    61100 Salaries & Benefits
    62100 Rent & Office
    62300 Software & Tools
    63100 Marketing & Events
    64100 Professional Fees
  `);

	/* Balance-sheet codes an item can also land on: the bank accounts
     themselves, money owed in either direction, and tax collected. */
	const POSTING_CODES = [
		...FILING_CODES,
		...codeTable(`
    10100 Operating Account
    10200 Payroll Account
    11100 Accounts Receivable
    20100 Accounts Payable
    21100 Sales Tax Payable
  `),
	];

	/* Where each kind of linked record lives when nothing more specific
     is given. */
	const RECORD_PAGES = {
		entry: 'accounting.html',
		bill: 'accounting.html',
		subs: 'subscriptions.html',
		receipt: 'receipts.html',
		payroll: 'payroll.html',
	};

	const FEED = [
		/* October 1 to 5: the renewal payout, rent and the first bills. */
		{
			acct: 'operating',
			date: '2026-10-01',
			time: '09:10',
			method: 'payout',
			who: 'Card renewals payout',
			amount: 720915.4,
			ref: 'October run',
			memo: 'NBK CR PAYOUT 01OCT RENEWALS',
			cat: '41100',
			match: booked(
				'#401',
				'October plans charged to cards',
				'1,874 accounts on monthly plans, after $21,964.60 in card fees',
				'Billing sync',
				'2026-10-01T09:12',
			),
			records: [
				pointer('entry', '#401', 'October plans charged to cards'),
				pointer('subs', 'Monthly renewals', '1,874 accounts on monthly plans'),
				pointer('receipt', 'Card receipts', 'The card payments in this payout'),
			],
			notes: [
				remark(
					'Robyn Daniels',
					'2026-10-01T10:05',
					'Card fees came to 2.96% of the run, the same as September.',
				),
			],
			files: [upload('northbank-payout-01oct.csv', '412 KB', 'Billing sync', '2026-10-01T09:12')],
		},
		{
			acct: 'operating',
			date: '2026-10-02',
			time: '08:05',
			method: 'debit',
			who: 'Harborside Properties',
			amount: -21300,
			ref: 'Rent, October',
			memo: 'NBK DD HARBORSIDE PROP OCT',
			cat: '62100',
			match: booked(
				'#404',
				'Office rent, October',
				'Booked to Rent & Office',
				'Gregory Devin',
				'2026-10-02T11:30',
			),
			records: [
				pointer('entry', '#404', 'Office rent, October'),
				pointer('bill', 'Harborside, October rent', 'Waco office, 4th floor'),
			],
			notes: [],
			files: [upload('harborside-rent-oct-2026.pdf', '186 KB', 'Gregory Devin', '2026-10-02T11:28')],
		},
		{
			acct: 'operating',
			date: '2026-10-05',
			time: '07:30',
			method: 'debit',
			who: 'Gale Energy',
			amount: -1860,
			ref: 'Office power',
			memo: 'NBK DD GALE ENERGY 7730412',
			cat: '',
			guess: '62100',
			hint: 'Gale Energy went to Rent & Office in September.',
			records: [],
			notes: [
				remark(
					'Hope Stout',
					'2026-10-05T09:40',
					'The office power bill. It is higher than usual because of the September heat.',
				),
			],
			files: [upload('gale-energy-sep-2026.pdf', '94 KB', 'Hope Stout', '2026-10-05T09:38')],
		},
		{
			acct: 'operating',
			date: '2026-10-05',
			time: '09:15',
			method: 'payout',
			who: 'Card payout, week 40',
			amount: 16340,
			ref: 'Week 40',
			memo: 'NBK CR PAYOUT 05OCT ADDONS W40',
			cat: '41300',
			match: booked(
				'#406',
				'Add-on sales, week 40',
				'Add-on Revenue, plus the sales tax collected',
				'Billing sync',
				'2026-10-05T09:17',
			),
			records: [
				pointer('entry', '#406', 'Add-on sales, week 40'),
				pointer('receipt', 'Card receipts', 'SMS packs, phone lines and storage'),
			],
			notes: [],
			files: [],
		},
		{
			acct: 'operating',
			date: '2026-10-05',
			time: '13:48',
			method: 'transfer',
			who: 'Larchwood Studios',
			customer: 'larchwood',
			amount: 1800,
			ref: '#5752',
			memo: 'NBK TRF CR LARCHWOOD INV 5752',
			cat: '',
			suggest: {
				title: 'Invoice #5752',
				detail: 'Larchwood Studios, Basic plan renewal, due Oct 29',
				cat: '11100',
				at: '2026-10-05T13:49',
				why: 'Same amount, and the invoice number is in the reference.',
			},
			records: [
				unconfirmed(
					pointer('invoice', '#5752', 'Basic plan renewal, due Oct 29', 'invoice-details.html?id=%235752'),
				),
			],
			notes: [
				remark('Gregory Devin', '2026-10-06T08:55', 'Sasha said they paid early to keep this year’s price.'),
			],
			files: [],
		},

		/* October 6: cash moved across for payroll, which went out the same
       day, plus the September sales tax. Items 6 and 7 are the two legs
       of one transfer and point at each other through twin. */
		{
			acct: 'operating',
			date: '2026-10-06',
			time: '09:00',
			method: 'own',
			who: 'Transfer to Payroll',
			amount: -260000,
			ref: '···2207',
			memo: 'NBK TRF TO 2207 PAYROLL',
			cat: '10200',
			transfer: true,
			twin: 7,
			match: payrollFunding(),
			records: [
				pointer('entry', '#407', 'Cash moved to the payroll account'),
				pointer(
					'line',
					'Transfer from Operating',
					'The same money arriving in Payroll ···2207',
					'transaction-details.html?id=7',
				),
			],
			notes: [],
			files: [],
		},
		{
			acct: 'payroll',
			date: '2026-10-06',
			time: '09:00',
			method: 'own',
			who: 'Transfer from Operating',
			amount: 260000,
			ref: '···5182',
			memo: 'NBK TRF FROM 5182',
			cat: '10100',
			transfer: true,
			twin: 6,
			match: payrollFunding(),
			records: [
				pointer('entry', '#407', 'Cash moved to the payroll account'),
				pointer(
					'line',
					'Transfer to Payroll',
					'The same money leaving Operating ···5182',
					'transaction-details.html?id=6',
				),
			],
			notes: [],
			files: [],
		},
		{
			acct: 'operating',
			date: '2026-10-06',
			time: '11:20',
			method: 'debit',
			who: 'State Revenue Office',
			amount: -9840,
			ref: 'Sales tax, Sep',
			memo: 'NBK DD STATE REV SALES TAX',
			cat: '21100',
			match: booked(
				'#409',
				'September sales tax paid',
				'Clears Sales Tax Payable',
				'Gregory Devin',
				'2026-10-06T14:10',
			),
			records: [pointer('entry', '#409', 'September sales tax paid')],
			notes: [],
			files: [upload('sales-tax-return-sep-2026.pdf', '238 KB', 'Gregory Devin', '2026-10-06T14:08')],
		},
		{
			acct: 'payroll',
			date: '2026-10-06',
			time: '12:30',
			method: 'batch',
			who: 'Payroll, October 1 to 15',
			amount: -254700,
			ref: 'Net pay',
			memo: 'NBK PAYROLL BATCH 06OCT',
			cat: '61100',
			match: booked(
				'#408',
				'Payroll, October 1 to 15',
				'Net pay; $63,700 held back for payroll taxes',
				'Payroll sync',
				'2026-10-06T12:31',
			),
			records: [
				pointer('entry', '#408', 'Payroll, October 1 to 15'),
				pointer('payroll', 'Payroll run', 'Net pay for October 1 to 15'),
				pointer(
					'line',
					'Transfer from Operating',
					'The cash that paid for it',
					'transaction-details.html?id=7',
				),
			],
			notes: [],
			files: [upload('payroll-summary-oct-1-15.pdf', '322 KB', 'Payroll sync', '2026-10-06T12:31')],
		},

		/* October 7 and 8: customer payments coming in, and the bills that
       still need someone to decide where they go. */
		{
			acct: 'operating',
			date: '2026-10-07',
			time: '10:05',
			method: 'transfer',
			who: 'Harborline AI',
			customer: 'moorings',
			amount: 318,
			ref: 'SMS packs',
			memo: 'NBK TRF CR HARBOR PROPERTY',
			cat: '',
			suggest: {
				title: 'Invoice #5454',
				detail: 'Harborline AI, 12 SMS packs, due Oct 29',
				cat: '11100',
				at: '2026-10-07T10:06',
				why: 'Same amount and the same payee name.',
			},
			records: [
				unconfirmed(
					pointer('invoice', '#5454', '12 SMS credit packs, due Oct 29', 'invoice-details.html?id=%235454'),
				),
			],
			notes: [],
			files: [],
		},
		{
			acct: 'operating',
			date: '2026-10-07',
			time: '11:00',
			method: 'transfer',
			who: 'Oakhaven Studio',
			customer: 'oakhaven',
			amount: 1693.87,
			ref: '#5431',
			memo: 'NBK WIRE CR OAKHAVEN STUDIO INV 5431',
			cat: '11100',
			match: booked('#403', 'Invoice #5431', 'Order #431, paid in full', 'Gregory Devin', '2026-10-07T13:15'),
			records: [
				pointer('invoice', '#5431', 'Data import and 2 more, paid in full', 'invoice-details.html?id=%235431'),
				pointer('receipt', '#92524', 'Wire from RBC Royal Bank', 'receipt-details.html?id=%2392524'),
				pointer('entry', '#403', 'Payment from Oakhaven Studio'),
			],
			notes: [
				remark(
					'Gregory Devin',
					'2026-10-07T13:16',
					'Paid by wire in Canadian dollars; the bank converted it to the invoice amount.',
				),
			],
			files: [],
		},
		{
			acct: 'operating',
			date: '2026-10-08',
			time: '09:40',
			method: 'transfer',
			who: 'Northgate Expo',
			amount: -11800,
			ref: 'BX-2231',
			memo: 'NBK TRF BRIGHTLINE BX2231',
			cat: '',
			suggest: {
				title: 'Bill BX-2231',
				detail: 'OnSite Expo Evanston stand, saved as draft entry #414',
				cat: '63100',
				entry: '#414',
				at: '2026-10-08T09:41',
				why: 'Same amount, and the bill number is in the reference.',
			},
			records: [
				unconfirmed(pointer('bill', 'BX-2231', 'OnSite Expo Evanston stand')),
				unconfirmed(pointer('entry', '#414', 'Draft entry for the stand')),
			],
			notes: [
				remark(
					'Gregory Devin',
					'2026-10-08T10:20',
					'This is the full stand fee. The booth furniture comes on a separate bill.',
				),
			],
			files: [upload('brightline-BX-2231.pdf', '148 KB', 'Gregory Devin', '2026-10-08T10:18')],
		},
		{
			acct: 'operating',
			date: '2026-10-08',
			time: '15:10',
			method: 'transfer',
			who: 'Lakeview Legal',
			amount: -3250,
			ref: 'Contract advice',
			memo: 'NBK TRF LAKEVIEW LEGAL 2611',
			cat: '',
			guess: '',
			hint: 'Nothing from Lakeview Legal has been booked before.',
			records: [],
			notes: [
				remark(
					'Robyn Daniels',
					'2026-10-08T16:02',
					'Contract advice for the Lumora AI renewal. Professional Fees, I think.',
				),
			],
			files: [],
		},
	];

	publish();

	/** Numbers the feed, works out balances and hands the result to the pages. */
	function publish() {
		for (const [position, feedItem] of FEED.entries()) feedItem.id = position + 1;
		stampBalances();

		window.Basalt.data = window.Basalt.data || {};
		window.Basalt.data.transactions = {
			today: DEMO_DATE,
			me: SIGNED_IN,
			accounts: BANK_ACCOUNTS,
			categories: FILING_CODES,
			ledger: POSTING_CODES,
			lines: FEED,
			find: itemById,
		};
	}

	/**
	 * Gives every item the balance its own account shows right after it.
	 * Items are replayed in time order, falling back to feed order when
	 * two share a minute, and each account starts from its Sep 30 figure.
	 */
	function stampBalances() {
		const balances = Object.fromEntries(BANK_ACCOUNTS.map((account) => [account.key, account.open]));
		const chronological = [...FEED].sort(
			(first, second) =>
				`${first.date}${first.time}`.localeCompare(`${second.date}${second.time}`) || first.id - second.id,
		);

		for (const feedItem of chronological) {
			feedItem.balance = Math.round((balances[feedItem.acct] + feedItem.amount) * 100) / 100;
			balances[feedItem.acct] = feedItem.balance;
		}
	}

	/**
	 * Looks an item up by id. The id may arrive as a number or as text
	 * straight from the query string.
	 * @param {number|string} id
	 * @returns {object|null}
	 */
	function itemById(id) {
		const wanted = String(id);
		return FEED.find((feedItem) => String(feedItem.id) === wanted) ?? null;
	}

	/**
	 * Turns a block of "code name" rows into [code, name] pairs.
	 * @param {string} table one account per line, code first
	 * @returns {string[][]}
	 */
	function codeTable(table) {
		return table
			.trim()
			.split('\n')
			.map((row) => {
				const cleaned = row.trim();
				const gap = cleaned.indexOf(' ');
				return [cleaned.slice(0, gap), cleaned.slice(gap + 1)];
			});
	}

	/** The journal entry an item was confirmed against, and by whom. */
	function booked(entry, title, detail, by, at) {
		return { entry, title, detail, by, at };
	}

	/* Both legs of the payroll funding transfer share one entry, so each
     leg gets its own copy of it. */
	function payrollFunding() {
		return booked(
			'#407',
			'Cash moved to the payroll account',
			'For net pay, October 1 to 15',
			'John Armstrong',
			'2026-10-06T09:05',
		);
	}

	/**
	 * A record the item links to. Without an href it opens the page that
	 * keeps records of that kind.
	 */
	function pointer(kind, title, detail, href = RECORD_PAGES[kind]) {
		return { kind, title, detail, href };
	}

	/** Marks a linked record as proposed by the bank rules, not yet approved. */
	function unconfirmed(record) {
		return { ...record, suggested: true };
	}

	function remark(who, at, text) {
		return { who, at, text };
	}

	function upload(name, size, who, at) {
		return { name, size, who, at };
	}
})();
