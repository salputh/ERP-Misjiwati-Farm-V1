/**
 * Demo data for reconciliation.html, published as
 * window.Basalt.data.reconciliation. It covers Fieldline's Operating Account
 * at Northbank (ending 5182) one month at a time: what the bank statement
 * says, and which entry in the books each statement line ties to.
 *
 * September 2026 has not been closed yet. It ends on the September 30
 * balance that Accounting and Transactions open with, and its customer
 * receipts are the September payments billing.js records, invoice for
 * invoice and cent for cent.
 *
 * Every line is in one of three states. "matched" lines already point at a
 * journal entry. "suggested" lines have an entry of equal amount waiting for
 * a yes, with a confidence score from 0 to 100. "review" lines have nothing
 * in the books yet, so someone has to find a match or book a new entry.
 *
 * accounts.js and billing.js must load first. For real data, hand back your
 * own statement and ledger matches in these same shapes.
 */
(() => {
	'use strict';

	const invoiceBook = window.Basalt.data?.billing;
	if (!invoiceBook) throw new Error('reconciliation.js needs billing.js loaded ahead of it.');

	const BANK_ACCOUNT = { name: 'Operating Account', bank: 'Northbank', last4: '5182', code: '10100' };
	const PREPARER = 'John Armstrong';
	const SEPTEMBER_ENDING = 2806094.6;

	/* Accounting's journal stops at #414, so entries booked on this page
     continue from 415. */
	const FIRST_FREE_ENTRY = 415;

	/* The income and expense accounts from the chart on accounting.html,
     where a line without a match can be booked. The codes ascend, so
     Object.entries hands them back in this order. */
	const POSTING_ACCOUNTS = {
		41100: 'Subscription Revenue',
		41300: 'Add-on Revenue',
		41500: 'Onboarding & Training',
		51100: 'Hosting & Infrastructure',
		51300: 'SMS & Phone Line Costs',
		51500: 'Payment Processing Fees',
		61100: 'Salaries & Benefits',
		62100: 'Rent & Office',
		62300: 'Software & Tools',
		63100: 'Marketing & Events',
		64100: 'Professional Fees',
	};

	/* Where the "open" link on a matched entry takes the reader. */
	const DESTINATIONS = {
		books: { href: 'accounting.html', link: 'Open in Accounting' },
		cards: { href: 'receipts.html', link: 'Open card receipts' },
		payroll: { href: 'payroll.html', link: 'Open payroll' },
		plans: { href: 'subscriptions.html', link: 'Open subscriptions' },
	};

	/* September 2026, line by line in statement order. */
	const SEPTEMBER_STATEMENT = [
		{
			date: '2026-09-01',
			who: 'Card renewals payout',
			method: 'payout',
			amount: 702486.2,
			memo: 'NBK CR PAYOUT 01SEP RENEWALS',
			...matched('#358'),
			entry: entryFor(
				'September plans charged to cards',
				'1,862 accounts on monthly plans, after card fees',
				'plans',
			),
		},
		{
			date: '2026-09-01',
			who: 'Harborside Properties',
			method: 'debit',
			amount: -21300,
			memo: 'NBK DD HARBORSIDE PROP SEP',
			...matched('#359'),
			entry: entryFor('Office rent, September', 'Booked to Rent & Office', 'books'),
		},
		payrollTransfer('2026-09-02', -258000, 'September 1 to 15', matched('#360')),
		{
			date: '2026-09-05',
			who: 'Gale Energy',
			method: 'debit',
			amount: -1790,
			memo: 'NBK DD GALE ENERGY 7730412',
			...matched('#362'),
			entry: entryFor('Office power, August', 'Booked to Rent & Office', 'books'),
		},
		addOnPayout(36, '07', 15880, matched('#364')),
		{
			date: '2026-09-08',
			who: 'State Revenue Office',
			method: 'debit',
			amount: -9420,
			memo: 'NBK DD STATE REV SALES TAX',
			...matched('#365'),
			entry: entryFor('August sales tax paid', 'Clears Sales Tax Payable', 'books'),
		},
		invoiceReceipt('#5420', matched('#367')),
		invoiceReceipt('#5424', matched('#369')),
		addOnPayout(37, '14', 16120, matched('#371')),
		invoiceReceipt('#5415', matched('#372')),
		invoiceReceipt('#5425', matched('#374')),
		payrollTransfer('2026-09-17', -256800, 'September 16 to 30', matched('#375')),
		invoiceReceipt('#2349', matched('#376')),
		invoiceReceipt('#5429', matched('#377')),
		invoiceReceipt('#5416', matched('#378')),
		invoiceReceipt('#2091', matched('#379')),
		addOnPayout(38, '21', 16410, matched('#381')),
		invoiceReceipt('#5418', matched('#382')),
		invoiceReceipt('#5419', matched('#384')),

		/* From here on the books either hold a likely match waiting for a yes,
       or nothing at all yet. */
		{
			date: '2026-09-24',
			who: 'Volt Film & Photo',
			acct: 'volt',
			method: 'ach',
			amount: 5174,
			memo: 'NBK TRF CR VOLT FILM PHOTO',
			state: 'review',
			hint: 'No invoice number in the reference. Volt has one open invoice for this amount.',
		},
		{
			date: '2026-09-25',
			who: 'Brightway Insurance',
			method: 'debit',
			amount: -2140,
			memo: 'NBK DD BRIGHTWAY INS 55021',
			state: 'review',
			cat: '62100',
			hint: 'The October office insurance premium. No bill for it is in the books.',
		},
		{
			date: '2026-09-26',
			who: 'Bluepeak Studios',
			acct: 'bluepeak',
			method: 'ach',
			amount: 447,
			memo: 'NBK TRF CR BLUEPEAK STUDIOS',
			state: 'review',
			hint: 'Paid a day after the invoice went out, without its number.',
		},
		invoiceReceipt('#5448', suggested('#391', 98, 'Same amount, and the invoice number is in the reference.')),
		addOnPayout(39, '28', 16290, suggested('#393', 96, 'Same amount as the week 39 payout report.')),
		invoiceReceipt('#5422', suggested('#394', 91, 'Same amount and the same payee name.')),
		invoiceReceipt('#5446', suggested('#395', 87, 'Same amount, and check 3891 was logged against it.')),
		{
			date: '2026-09-29',
			who: 'Cloudhaven Hosting',
			method: 'debit',
			amount: -4312.4,
			memo: 'NBK DD CLOUDHAVEN 88213',
			...suggested('#396', 74, 'Same amount. The bill is dated three days earlier.'),
			entry: entryFor('Bill CH-88213', 'Cloudhaven Hosting, backups and storage for September', 'books'),
		},
		invoiceReceipt('#5456', suggested('#398', 99, 'Same amount, and the invoice number is in the reference.')),
		{
			date: '2026-09-30',
			who: 'Northbank',
			method: 'fee',
			amount: -45,
			memo: 'NBK ACCOUNT FEE SEP',
			state: 'review',
			cat: '51500',
			hint: 'The monthly account fee. It is taken by the bank, so there is no bill.',
		},
	];

	/* Supplier bills sitting in the books unpaid, offered by "Find a match"
     next to the unpaid invoices. */
	const UNPAID_BILLS = [
		supplierBill('BX-2231', 'Northgate Expo', 'Expo stand, saved as a draft', '2026-09-28', -11800),
		supplierBill('CH-88402', 'Cloudhaven Hosting', 'Servers for October', '2026-09-30', -4180),
		supplierBill('LL-2611', 'Lakeview Legal', 'Terms redlining', '2026-09-29', -3250),
	];

	/**
	 * Builds the month list and puts the read API on window.Basalt.data. The
	 * list functions hand out deep copies, so a page can edit what it gets.
	 */
	function publish() {
		const monthList = monthHistory();

		window.Basalt.data = window.Basalt.data || {};
		window.Basalt.data.reconciliation = {
			today: invoiceBook.today,
			me: PREPARER,
			account: BANK_ACCOUNT,
			categories: Object.entries(POSTING_ACCOUNTS),
			nextEntry: FIRST_FREE_ENTRY,
			months: () => monthList.map(detached),
			openEntries: () => unclearedEntries().map(detached),
		};
	}

	/* The builders below shape the statement lines, so repeated kinds of
     line are written once. */

	/** The booking fields of a line already tied to journal entry `entryId`. */
	function matched(entryId) {
		return { state: 'matched', je: entryId };
	}

	/** The booking fields of a line with a proposed entry and the reason for it. */
	function suggested(entryId, confidence, why) {
		return { state: 'suggested', je: entryId, confidence, why };
	}

	/** The book entry a line points at, with the link for its `destination`. */
	function entryFor(title, detail, destination) {
		return { title, detail, ...DESTINATIONS[destination] };
	}

	/* Each week's add-on card sales land as one payout; `day` is two digits. */
	function addOnPayout(week, day, amount, booking) {
		return {
			date: `2026-09-${day}`,
			who: `Card payout, week ${week}`,
			method: 'payout',
			amount,
			memo: `NBK CR PAYOUT ${day}SEP ADDONS W${week}`,
			...booking,
			entry: entryFor(`Add-on sales, week ${week}`, 'Add-on Revenue, plus the sales tax collected', 'cards'),
		};
	}

	/* Twice a month cash moves to the payroll account ending 2207. */
	function payrollTransfer(date, amount, period, booking) {
		return {
			date,
			who: 'Transfer to Payroll',
			method: 'own',
			amount,
			memo: 'NBK TRF TO 2207 PAYROLL',
			...booking,
			entry: entryFor('Cash moved to the payroll account', `For net pay, ${period}`, 'payroll'),
		};
	}

	/**
	 * A customer paying one of billing.js's invoices. Date, payer, amount and
	 * the bank's memo all follow from the invoice; `booking` is laid over the
	 * result, and its own `entry` fields over the invoice link.
	 */
	function invoiceReceipt(invoiceNo, booking) {
		const invoice = invoiceBook.find(invoiceNo);
		if (!invoice) throw new Error(`billing.js has no invoice ${invoiceNo}.`);

		const settlement = invoice.paid;
		const isCheck = settlement && settlement.method === 'check';
		const channel = settlement && settlement.method === 'wire' ? 'WIRE' : 'TRF';
		const receipt = {
			date: settlement ? settlement.on : booking.date,
			who: invoice.customer,
			acct: invoice.acct,
			method: isCheck ? 'check' : settlement ? settlement.method : 'ach',
			amount: invoice.amount,
			memo: isCheck
				? `NBK CHK DEP ${settlement.from.replace(/\D/g, '')}`
				: `NBK ${channel} CR ${bankPayerName(invoice.customer)} ${invoiceNo.replace(/-/g, '')}`,
			entry: {
				title: `Payment for ${invoiceNo}`,
				detail: `${invoice.customer}, ${invoice.item}`,
				href: `invoice-details.html?id=${encodeURIComponent(invoiceNo)}`,
				link: 'Open invoice',
			},
		};
		return { ...receipt, ...booking, entry: { ...receipt.entry, ...booking.entry } };
	}

	/* The bank prints a payer as at most 18 capitals and spaces. */
	function bankPayerName(customer) {
		return customer
			.toUpperCase()
			.replace(/[^A-Z ]/g, '')
			.replace(/\s+/g, ' ')
			.slice(0, 18)
			.trim();
	}

	/**
	 * The open month first, then the locked ones. September's opening balance
	 * is whatever its ending balance less its lines comes to, and August
	 * closes on that same figure.
	 */
	function monthHistory() {
		const septemberStart = toCents(SEPTEMBER_ENDING - toCents(statementTotal(SEPTEMBER_STATEMENT)));
		return [
			{
				...calendarMonth('2026-09', 'September', 30),
				state: 'open',
				open: septemberStart,
				close: SEPTEMBER_ENDING,
				lines: SEPTEMBER_STATEMENT,
			},
			{
				...calendarMonth('2026-08', 'August', 31),
				state: 'done',
				open: 2604117.85,
				close: septemberStart,
				count: 27,
				by: PREPARER,
				on: '2026-09-04',
			},
			{
				...calendarMonth('2026-07', 'July', 31),
				state: 'done',
				open: 2481930.4,
				close: 2604117.85,
				count: 25,
				by: PREPARER,
				on: '2026-08-05',
			},
		];
	}

	/** Key, labels and first and last day for month `key` ("YYYY-MM"). */
	function calendarMonth(key, name, lastDay) {
		return { key, label: `${name} ${key.slice(0, 4)}`, short: name, from: `${key}-01`, to: `${key}-${lastDay}` };
	}

	function statementTotal(lines) {
		let sum = 0;
		for (const line of lines) sum += line.amount;
		return sum;
	}

	function toCents(value) {
		return Math.round(value * 100) / 100;
	}

	/**
	 * What "Find a match" can pick from: invoices sent by September 30 that
	 * are still unpaid, followed by the unpaid supplier bills.
	 */
	function unclearedEntries() {
		const candidates = [];
		for (const invoice of invoiceBook.invoices()) {
			const stillOwed = invoice.state === 'sent' && invoice.issued <= '2026-09-30';
			if (!stillOwed) continue;
			candidates.push({
				id: invoice.no,
				kind: 'invoice',
				title: `Invoice ${invoice.no}`,
				who: invoice.customer,
				acct: invoice.acct,
				detail: invoice.item,
				date: invoice.issued,
				amount: invoice.amount,
				href: `invoice-details.html?id=${encodeURIComponent(invoice.no)}`,
			});
		}
		return [...candidates, ...UNPAID_BILLS];
	}

	function supplierBill(id, who, detail, date, amount) {
		return { id, kind: 'bill', title: `Bill ${id}`, who, detail, date, amount, href: 'accounting.html' };
	}

	/* A plain-data copy, so changes on the page never reach the source. */
	function detached(value) {
		return JSON.parse(JSON.stringify(value));
	}

	publish();
})();
