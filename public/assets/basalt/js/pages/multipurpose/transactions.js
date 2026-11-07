/**
 * Transactions page (transactions.html): the Northbank feed since
 * October 1 and how each line sits against the books.
 *
 * A line is in one of three states. Matched means a journal entry
 * already covers it. Match found means an invoice or bill of the same
 * amount is waiting for someone to confirm. No match means a person
 * has to book it, either to one category or split over several.
 *
 * BANK_ACCOUNTS and FEED hold the demo records. A real deployment swaps
 * them for the bank feed and the ledger's suggestions and keeps the
 * field names, because nothing else on the page is read.
 *
 * The figures line up with the Accounting page: an account's book
 * balance is its September 30 figure plus every matched line, which
 * lands on the same Operating, Payroll and Reserve totals as the chart
 * of accounts. The bank's own balance also counts the unmatched lines,
 * so the two drift apart until everything is matched.
 */
(() => {
	'use strict';

	const stage = pick('[data-ldg-root]');
	if (!stage) return;

	/* The demo's clock. A live page reads new Date() instead. */
	const DEMO_DAY = '2026-10-09';
	const SIGNED_IN = 'John Armstrong';

	/* `opening` is the September 30 balance. `trail` lists each day's close
     from September 9 to 30 for the sparkline; October's days come from
     the feed itself. */
	const BANK_ACCOUNTS = [
		{
			key: 'operating',
			name: 'Operating Account',
			short: 'Operating',
			kind: 'Checking',
			last4: '5182',
			opening: 2806094.6,
			trail: [
				2968934.6, 2975284.6, 3001634.6, 3001634.6, 3001634.6, 3024054.6, 2977554.6, 2980374.6, 3003274.6,
				2745924.6, 2745924.6, 2745924.6, 2763804.6, 2775554.6, 2791254.6, 2796304.6, 2811004.6, 2811004.6,
				2811004.6, 2822344.6, 2834544.6, 2806094.6,
			],
		},
		{
			key: 'payroll',
			name: 'Payroll Account',
			short: 'Payroll',
			kind: 'Checking',
			last4: '2207',
			opening: 48200,
			trail: [
				48200, 48200, 48200, 48200, 48200, 48200, 48200, 48200, 48200, 299500, 299500, 299500, 48200, 48200,
				48200, 48200, 48200, 48200, 48200, 48200, 48200, 48200,
			],
		},
		{
			key: 'reserve',
			name: 'Reserve Savings',
			short: 'Reserve',
			kind: 'Savings',
			last4: '2915',
			opening: 1500000,
			trail: [
				1496900, 1496900, 1496900, 1496900, 1496900, 1496900, 1496900, 1496900, 1496900, 1496900, 1496900,
				1496900, 1496900, 1496900, 1496900, 1496900, 1496900, 1496900, 1496900, 1496900, 1496900, 1500000,
			],
		},
	];

	const ACCOUNT_ICONS = { operating: 'bank', payroll: 'people', reserve: 'piggy-bank' };

	/* The income and expense accounts a line may be booked to, keyed by
     their code in the chart of accounts. */
	const LEDGER_CATEGORIES = {
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

	/* One record per bank movement, money in positive and money out
     negative. `match` is the booking already in the ledger; `suggest` is
     a record of the same amount that still wants confirming; `cat` is
     the category to offer first when there is neither, with `hint`
     giving the reason. */
	const FEED = [
		{
			date: '2026-10-01',
			time: '09:10',
			acct: 'operating',
			who: 'Card renewals payout',
			method: 'payout',
			amount: 720915.4,
			ref: 'October run',
			memo: 'NBK CR PAYOUT 01OCT RENEWALS',
			match: {
				title: 'October plans charged to cards',
				detail: '1,874 accounts on monthly plans, after $21,964.60 in card fees',
				entry: '#401',
				href: 'subscriptions.html',
				link: 'Open subscriptions',
			},
		},
		{
			date: '2026-10-02',
			time: '08:05',
			acct: 'operating',
			who: 'Harborside Properties',
			method: 'debit',
			amount: -21300,
			ref: 'Rent, October',
			memo: 'NBK DD HARBORSIDE PROP OCT',
			match: {
				title: 'Office rent, October',
				detail: 'Booked to Rent & Office',
				entry: '#404',
				href: 'accounting.html',
				link: 'Open in Accounting',
			},
		},
		{
			date: '2026-10-05',
			time: '07:30',
			acct: 'operating',
			who: 'Gale Energy',
			method: 'debit',
			amount: -1860,
			ref: 'Office power',
			memo: 'NBK DD GALE ENERGY 7730412',
			cat: '62100',
			hint: 'Gale Energy went to Rent & Office in September.',
		},
		{
			date: '2026-10-05',
			time: '09:15',
			acct: 'operating',
			who: 'Card payout, week 40',
			method: 'payout',
			amount: 16340,
			ref: 'Week 40',
			memo: 'NBK CR PAYOUT 05OCT ADDONS W40',
			match: {
				title: 'Add-on sales, week 40',
				detail: 'Add-on Revenue, plus the sales tax collected',
				entry: '#406',
				href: 'receipts.html',
				link: 'Open card receipts',
			},
		},
		{
			date: '2026-10-05',
			time: '13:48',
			acct: 'operating',
			who: 'Larchwood Studios',
			customer: 'larchwood',
			method: 'transfer',
			amount: 1800,
			ref: '#5752',
			memo: 'NBK TRF CR LARCHWOOD INV 5752',
			suggest: {
				title: 'Invoice #5752',
				detail: 'Larchwood Studios, Basic plan renewal, due Oct 29',
				why: 'Same amount, and the invoice number is in the reference.',
				href: 'invoice-details.html?id=%235752',
				link: 'Open invoice',
			},
		},
		{
			date: '2026-10-06',
			time: '09:00',
			acct: 'operating',
			who: 'Transfer to Payroll',
			method: 'own',
			amount: -260000,
			ref: '···2207',
			transfer: true,
			memo: 'NBK TRF TO 2207 PAYROLL',
			match: {
				title: 'Cash moved to the payroll account',
				detail: 'For net pay, October 1 to 15',
				entry: '#407',
				href: 'accounting.html',
				link: 'Open in Accounting',
			},
		},
		{
			date: '2026-10-06',
			time: '09:00',
			acct: 'payroll',
			who: 'Transfer from Operating',
			method: 'own',
			amount: 260000,
			ref: '···5182',
			transfer: true,
			memo: 'NBK TRF FROM 5182',
			match: {
				title: 'Cash moved to the payroll account',
				detail: 'For net pay, October 1 to 15',
				entry: '#407',
				href: 'accounting.html',
				link: 'Open in Accounting',
			},
		},
		{
			date: '2026-10-06',
			time: '11:20',
			acct: 'operating',
			who: 'State Revenue Office',
			method: 'debit',
			amount: -9840,
			ref: 'Sales tax, Sep',
			memo: 'NBK DD STATE REV SALES TAX',
			match: {
				title: 'September sales tax paid',
				detail: 'Clears Sales Tax Payable',
				entry: '#409',
				href: 'accounting.html',
				link: 'Open in Accounting',
			},
		},
		{
			date: '2026-10-06',
			time: '12:30',
			acct: 'payroll',
			who: 'Payroll, October 1 to 15',
			method: 'batch',
			amount: -254700,
			ref: 'Net pay',
			memo: 'NBK PAYROLL BATCH 06OCT',
			match: {
				title: 'Payroll, October 1 to 15',
				detail: 'Net pay; $63,700 held back for payroll taxes',
				entry: '#408',
				href: 'payroll.html',
				link: 'Open payroll',
			},
		},
		{
			date: '2026-10-07',
			time: '10:05',
			acct: 'operating',
			who: 'Harborline AI',
			customer: 'moorings',
			method: 'transfer',
			amount: 318,
			ref: 'SMS packs',
			memo: 'NBK TRF CR HARBOR PROPERTY',
			suggest: {
				title: 'Invoice #5454',
				detail: 'Harborline AI, 12 SMS packs, due Oct 29',
				why: 'Same amount and the same payee name.',
				href: 'invoice-details.html?id=%235454',
				link: 'Open invoice',
			},
		},
		{
			date: '2026-10-07',
			time: '11:00',
			acct: 'operating',
			who: 'Oakhaven Studio',
			customer: 'oakhaven',
			method: 'transfer',
			amount: 1693.87,
			ref: '#5431',
			memo: 'NBK WIRE CR OAKHAVEN STUDIO INV 5431',
			match: {
				title: 'Invoice #5431',
				detail: 'Order #431, paid in full',
				entry: '#403',
				href: 'invoice-details.html?id=%235431',
				link: 'Open invoice',
			},
		},
		{
			date: '2026-10-08',
			time: '09:40',
			acct: 'operating',
			who: 'Northgate Expo',
			method: 'transfer',
			amount: -11800,
			ref: 'BX-2231',
			memo: 'NBK TRF BRIGHTLINE BX2231',
			suggest: {
				title: 'Bill BX-2231',
				detail: 'OnSite Expo Evanston stand, saved as draft entry #414',
				entry: '#414',
				why: 'Same amount, and the bill number is in the reference.',
				href: 'accounting.html',
				link: 'Open in Accounting',
			},
		},
		{
			date: '2026-10-08',
			time: '15:10',
			acct: 'operating',
			who: 'Lakeview Legal',
			method: 'transfer',
			amount: -3250,
			ref: 'Contract review',
			memo: 'NBK TRF LAKEVIEW LEGAL 2611',
			cat: '',
			hint: 'Nothing from Lakeview Legal has been booked before.',
		},
	];

	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const COUNT_WORDS = [
		'no',
		'one',
		'two',
		'three',
		'four',
		'five',
		'six',
		'seven',
		'eight',
		'nine',
		'ten',
		'eleven',
		'twelve',
		'thirteen',
	];

	const HOW_PAID = {
		transfer: { word: 'Bank transfer', how: 'by bank transfer' },
		debit: { word: 'Direct debit', how: 'by direct debit' },
		payout: { word: 'Card payout', how: 'as a card payout' },
		batch: { word: 'Batch payment', how: 'as a batch payment' },
		own: { word: 'Own transfer', how: 'as a transfer between our own accounts' },
	};

	const MATCH_STATES = {
		matched: { word: 'Matched', tone: 'success', icon: 'check2' },
		found: { word: 'Match found', tone: 'info', icon: 'link-45deg' },
		none: { word: 'No match', tone: 'warning', icon: 'question-lg' },
	};

	/* Every line gets a number in feed order; the balances come later. */
	const feed = FEED.map((record, index) => ({ id: index + 1, ...record }));

	/* The Accounting page stops at #414, so new entries follow on. */
	let journalCounter = 415;

	const view = { tab: 'all', account: '', query: '', sortKey: 'date', sortDir: 'desc' };
	let visibleLines = [];
	let highlightedId = null;
	let findDelay;

	/* The drawer's own state: the line it shows, whether a suggested match
     was set aside, and the list the arrows step through. */
	let openLine = null;
	let choosingCategory = false;
	let stepList = [];
	let onlyOpenOnes = false;

	const drawerNode = document.getElementById('ldg-drawer');
	const importNode = document.getElementById('ldg-import');
	const drawerCtl = window.bootstrap ? bootstrap.Offcanvas.getOrCreateInstance(drawerNode) : null;
	const importCtl = window.bootstrap ? bootstrap.Modal.getOrCreateInstance(importNode) : null;

	const ui = {
		backlogText: pick('[data-ldg-todo-desc]', stage),
		backlogNumber: pick('[data-ldg-todo-num]', stage),
		backlogUnit: pick('[data-ldg-todo-unit]', stage),
		backlogBar: pick('[data-ldg-todo-bar]', stage),
		backlogLegend: pick('[data-ldg-todo-legend]', stage),
		matchNext: pick('[data-ldg-next]', stage),
		acceptAll: pick('[data-ldg-accept]', stage),
		acceptLabel: pick('[data-ldg-accept-label]', stage),
		accounts: pick('[data-ldg-accts]', stage),
		accountsNote: pick('[data-ldg-accts-foot]', stage),
		rows: pick('[data-ldg-body]', stage),
		tableWrap: pick('[data-ldg-table-wrap]', stage),
		search: pick('[data-ldg-search]', stage),
		count: pick('[data-ldg-count]', stage),
		chips: pick('[data-ldg-applied]', stage),
		noHits: pick('[data-ldg-empty="search"]', stage),
		allDone: pick('[data-ldg-empty="done"]', stage),
		listSummary: pick('[data-ldg-list-sum]', stage),
		listTotals: pick('[data-ldg-foot]', stage),
		categoryForm: pick('[data-ldg-cat]', drawerNode),
		singleCategory: pick('[data-ldg-cat-one]', drawerNode),
		categorySelect: pick('[data-ldg-cat-select]', drawerNode),
		categoryHint: pick('[data-ldg-cat-hint]', drawerNode),
		splitBox: pick('[data-ldg-split]', drawerNode),
		splitLines: pick('[data-ldg-split-lines]', drawerNode),
		splitRemainder: pick('[data-ldg-split-left]', drawerNode),
		splitToggle: pick('[data-ldg-split-toggle]', drawerNode),
		importForm: pick('[data-ldg-import]', importNode),
	};
	ui.importFile = pick('[data-ldg-import-file]', ui.importForm);

	/* The stepper belongs to the shared drawer code; it asks the count
     object for its size each time, so the list may change underneath. */
	const stepper = window.Basalt.drawer
		? window.Basalt.drawer.recordNav(drawerNode, { valueOf: () => Math.max(1, stepList.length) }, (index) => {
				if (stepList[index]) showLine(stepList[index]);
			})
		: null;

	/**
	 * Fills in the running balances, draws every panel and wires the
	 * controls. Called once at the bottom of the file.
	 */
	function start() {
		settleBalances();
		ui.accounts.addEventListener('click', onAccountClick);
		ui.search.addEventListener('input', onSearchInput);
		pick('[data-ldg-clear]', stage).addEventListener('click', clearSearch);

		for (const button of pickAll('[data-ldg-sort]', stage)) {
			button.addEventListener('click', () => reorder(button.getAttribute('data-ldg-sort')));
		}

		for (const tab of pickAll('[data-ldg-tab]', stage)) {
			tab.addEventListener('shown.bs.tab', () => {
				view.tab = tab.getAttribute('data-ldg-tab');
				pick('#ldg-list-panel').setAttribute('aria-labelledby', tab.id);
				paintLines();
			});
		}

		ui.matchNext.addEventListener('click', startMatching);
		ui.rows.addEventListener('click', onRowClick);
		ui.acceptAll.addEventListener('click', acceptEverySuggestion);
		wireDrawer();
		wireImport();
		paintBacklog();
		paintAccounts();
		paintLines();
		/* The open count and the balances count up from zero once, as the page opens. */
		window.Basalt.countUp?.([ui.backlogNumber, ...pickAll('.ldg-acct-value', ui.accounts)]);
	}

	/* Small helpers shared by every section. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function safe(value) {
		const swap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (ch) => swap[ch]);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function sayAloud(text) {
		window.Basalt.announce?.(text);
	}

	function shortDate(iso) {
		return `${MONTH_NAMES[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
	}

	function roundMoney(value) {
		return Math.round(value * 100) / 100;
	}

	function dollars(value) {
		return `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function signedDollars(value) {
		return `${value < 0 ? '−' : '+'}${dollars(value)}`;
	}

	/** Millions and thousands in a few characters, for the accounts note. */
	function compactDollars(value) {
		const size = Math.abs(value);
		if (size >= 1e6) return `$${(size / 1e6).toFixed(2)}M`;
		if (size >= 1e3) return `$${(size / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
		return `$${Math.round(size)}`;
	}

	function countWords(count, singular, plural) {
		const noun = count === 1 ? singular : plural || `${singular}s`;
		return `${COUNT_WORDS[count] ?? count} ${noun}`;
	}

	function capitalize(text) {
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	function readAmount(raw) {
		return roundMoney(parseFloat(String(raw).replace(/[$,\s]/g, '')));
	}

	function categoryName(code) {
		return LEDGER_CATEGORIES[code] ?? '';
	}

	function accountByKey(key) {
		return BANK_ACCOUNTS.find((account) => account.key === key);
	}

	function accountTone(account) {
		return BANK_ACCOUNTS.indexOf(account) + 1;
	}

	function matchStateOf(line) {
		if (line.match) return 'matched';
		return line.suggest ? 'found' : 'none';
	}

	function unmatched(line) {
		return !line.match;
	}

	function chronological(a, b) {
		return (a.date + a.time).localeCompare(b.date + b.time) || a.id - b.id;
	}

	function sumOf(list, read) {
		return list.reduce((total, item) => total + read(item), 0);
	}

	function linesOf(account) {
		return feed.filter((line) => line.acct === account.key);
	}

	function unmatchedLines() {
		return feed.filter(unmatched).sort(chronological);
	}

	/* Walks each account oldest first and stores the balance after every line. */
	function settleBalances() {
		const running = Object.fromEntries(BANK_ACCOUNTS.map((account) => [account.key, account.opening]));

		for (const line of [...feed].sort(chronological)) {
			running[line.acct] = roundMoney(running[line.acct] + line.amount);
			line.balance = running[line.acct];
		}
	}

	function feedBalance(account) {
		return roundMoney(account.opening + sumOf(linesOf(account), (line) => line.amount));
	}

	/* The "Still to match" card. */

	function paintBacklog() {
		const open = feed.filter(unmatched).length;
		const booked = feed.length - open;
		ui.backlogNumber.textContent = open;
		ui.backlogUnit.textContent = open === 1 ? 'line' : 'lines';
		ui.backlogText.textContent = open
			? `${booked} of ${feed.length} bank lines since October 1 are in the books.`
			: 'Every bank line since October 1 is in the books.';
		ui.matchNext.hidden = !open;

		const groups = ['found', 'none', 'matched']
			.map((key) => {
				const members = feed.filter((line) => matchStateOf(line) === key);
				return { key, size: members.length, total: sumOf(members, (line) => Math.abs(line.amount)) };
			})
			.filter((group) => group.size);

		ui.backlogBar.innerHTML = groups
			.map((group) => `<span class="ldg-todo-seg ldg-st-${group.key}" style="flex-grow:${group.size}"></span>`)
			.join('');
		ui.backlogLegend.innerHTML = groups
			.map(
				(group) =>
					`<li class="ldg-todo-item ldg-st-${group.key}"><span class="ldg-todo-icon" aria-hidden="true"><i class="bi bi-${MATCH_STATES[group.key].icon}"></i></span><span class="ldg-todo-label">${MATCH_STATES[group.key].word}</span><span class="ldg-todo-count">${group.size}</span><span class="ldg-todo-sum">${dollars(group.total)}</span></li>`,
			)
			.join('');
	}

	/* The bank accounts card. */

	/** Thirty closing balances: September from the trail, October from the feed. */
	function dailyClosings(account) {
		const closings = [...account.trail];
		const mine = linesOf(account);

		for (let dayNumber = 1; dayNumber <= Number(DEMO_DAY.slice(8, 10)); dayNumber++) {
			const iso = `2026-10-${String(dayNumber).padStart(2, '0')}`;
			const upToDay = mine.filter((line) => line.date <= iso);
			closings.push(roundMoney(account.opening + sumOf(upToDay, (line) => line.amount)));
		}

		return closings;
	}

	function trendSvg(values, gradientId) {
		const width = 240;
		const height = 52;
		const inset = 3;
		/* The floor sits at least a quarter under the peak, so a small step
       such as a month's interest stays small instead of filling the box. */
		const top = Math.max(...values);
		const floor = Math.min(Math.min(...values), top * 0.75);
		const range = top - floor || 1;
		const points = values.map((value, index) => [
			(index / (values.length - 1)) * width,
			inset + (1 - (value - floor) / range) * (height - inset * 2),
		]);
		const path = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
		const [endX, endY] = points[points.length - 1];
		/* The fill fades downward, so a flat balance reads as a line rather than a block. */
		return `<svg class="ldg-spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs><linearGradient id="ldg-spark-${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop class="ldg-spark-stop" offset="0"/><stop class="ldg-spark-stop ldg-spark-stop-end" offset="1"/></linearGradient></defs><path class="ldg-spark-area" fill="url(#ldg-spark-${gradientId})" d="${path} L${width} ${height} L0 ${height} Z"/><path class="ldg-spark-line" d="${path}"/><path class="ldg-spark-dot" d="M${endX.toFixed(1)} ${endY.toFixed(1)} h0"/></svg>`;
	}

	function accountStateHtml(account) {
		const mine = linesOf(account);
		const open = mine.filter(unmatched).length;
		if (!mine.length) return '<span class="ldg-acct-state">No lines since Oct 1</span>';
		if (open)
			return `<span class="ldg-acct-state ldg-acct-state-open">${capitalize(countWords(open, 'line'))} to match</span>`;
		return '<span class="ldg-acct-state ldg-acct-state-done"><i class="bi bi-check2" aria-hidden="true"></i>All matched</span>';
	}

	function accountTileHtml(account) {
		const closings = dailyClosings(account);
		const first = closings[0];
		const latest = closings[closings.length - 1];
		return `<button type="button" class="ldg-acct ldg-tone-${accountTone(account)}" aria-pressed="${view.account === account.key}" data-ldg-acct="${account.key}"><span class="ldg-acct-icon" aria-hidden="true"><i class="bi bi-${ACCOUNT_ICONS[account.key] ?? 'bank'}"></i></span><span class="ldg-acct-id"><span class="ldg-acct-name">${safe(account.name)}</span><span class="ldg-acct-kind">${safe(account.kind)} ···${account.last4}</span></span>${trendSvg(closings, account.key)}<span class="visually-hidden">Balance ${dollars(first)} on September 9 and ${dollars(latest)} today.</span><span class="ldg-acct-end"><span class="ldg-acct-value">${dollars(feedBalance(account))}</span>${accountStateHtml(account)}</span></button>`;
	}

	function paintAccounts() {
		ui.accounts.innerHTML = BANK_ACCOUNTS.map(accountTileHtml).join('');
		const inBank = sumOf(BANK_ACCOUNTS, feedBalance);
		const movement = sumOf(
			feed.filter((line) => !line.transfer),
			(line) => line.amount,
		);
		const sign = movement < 0 ? '−' : '+';
		ui.accountsNote.innerHTML = `Together <strong>${compactDollars(inBank)}</strong> in the bank, <strong class="${movement < 0 ? '' : 'ldg-amt-in'}">${sign}${compactDollars(movement)}</strong> since October 1.`;
	}

	function pressAccountTiles(key) {
		for (const tile of pickAll('[data-ldg-acct]', ui.accounts)) {
			tile.setAttribute('aria-pressed', String(tile.getAttribute('data-ldg-acct') === key));
		}
	}

	function onAccountClick(event) {
		const tile = event.target.closest('[data-ldg-acct]');
		if (!tile) return;
		const key = tile.getAttribute('data-ldg-acct');
		view.account = view.account === key ? '' : key;
		pressAccountTiles(view.account);
		paintLines();
		sayAloud(view.account ? `Showing ${accountByKey(view.account).name} only` : 'Showing every account');
	}

	/** The applied-filter chip removes the account without an announcement. */
	function chooseAccount(key) {
		view.account = key;
		pressAccountTiles(key);
		paintLines();
	}

	/* The bank lines table: scope, order and drawing. */

	function searchText(line) {
		const booking = line.match || line.suggest || {};
		const size = Math.abs(line.amount);
		const parts = [
			line.who,
			line.ref,
			line.memo,
			booking.title,
			booking.detail,
			booking.entry,
			HOW_PAID[line.method].word,
			size.toFixed(2),
			size.toLocaleString('en-US', { minimumFractionDigits: 2 }),
			String(size),
		];
		return parts.join(' ').toLowerCase();
	}

	function withinScope(line) {
		if (view.account && line.acct !== view.account) return false;
		if (!view.query) return true;
		const haystack = searchText(line);
		return view.query
			.toLowerCase()
			.split(/\s+/)
			.every((word) => haystack.includes(word.replace(/^\$/, '')));
	}

	function withinTab(line) {
		const tests = { open: unmatched, matched: (item) => Boolean(item.match) };
		return tests[view.tab] ? tests[view.tab](line) : true;
	}

	function inOrder(list) {
		const direction = view.sortDir === 'asc' ? 1 : -1;
		const compare =
			view.sortKey === 'amount' ? (a, b) => a.amount - b.amount || chronological(a, b) : chronological;
		return [...list].sort((a, b) => compare(a, b) * direction);
	}

	function stateBadge(line) {
		const state = MATCH_STATES[matchStateOf(line)];
		return `<span class="basalt-status basalt-status-dot basalt-status-${state.tone}">${state.word}</span>`;
	}

	/** The arrow tile: in, out, or a move between our own accounts. */
	function directionBadge(line, large, hook) {
		const way = line.transfer ? 'own' : line.amount > 0 ? 'in' : 'out';
		const glyph = { own: 'arrow-left-right', in: 'arrow-down-left', out: 'arrow-up-right' }[way];
		const classes = `ldg-mark ldg-mark-${way}${large ? ' ldg-mark-lg' : ''}`;
		return `<span${hook ? ` data-ldg-d="${hook}"` : ''} class="${classes}" aria-hidden="true"><i class="bi bi-${glyph}"></i></span>`;
	}

	function actionCellHtml(line) {
		if (unmatched(line))
			return `<button type="button" class="btn btn-sm btn-outline-primary ldg-go-btn" data-ldg-open="${line.id}" tabindex="-1">Match</button>`;
		return `<button type="button" class="btn btn-icon btn-sm" data-ldg-peek="${line.id}" aria-label="Quick view: ${safe(line.who)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>`;
	}

	/** The account's name with its colored square; `extra` goes inside the span. */
	function accountTag(account, extra) {
		return `<span class="ldg-acct-tag ldg-tone-${accountTone(account)}">${safe(account.short)}${extra ?? ''}</span>`;
	}

	function rowHtml(line, freshId) {
		const account = accountByKey(line.acct);
		const classes = ['ldg-row'];
		if (line.id === highlightedId) classes.push('is-selected');
		if (line.id === freshId) classes.push('is-fresh');
		const under = HOW_PAID[line.method].word + (line.ref ? ` · ${safe(line.ref)}` : '');
		const cells = [
			`<td class="ldg-col-date"><span class="ldg-date">${shortDate(line.date)}</span></td>`,
			`<td class="ldg-col-who"><div class="ldg-who">${directionBadge(line)}<div class="ldg-who-text"><button type="button" class="ldg-who-name" data-ldg-open="${line.id}">${safe(line.who)}</button><span class="ldg-sub">${under}</span><span class="ldg-row-facts"><span class="ldg-row-date">${shortDate(line.date)}</span>${accountTag(account)}</span></div></div></td>`,
			`<td class="ldg-col-acct">${accountTag(account, ` <span class="ldg-quiet">···${account.last4}</span>`)}</td>`,
			`<td class="ldg-col-status">${stateBadge(line)}</td>`,
			`<td class="ldg-col-amt"><span class="ldg-amt${line.amount > 0 ? ' ldg-amt-in' : ''}">${signedDollars(line.amount)}</span></td>`,
			`<td class="ldg-col-bal"><span class="ldg-quiet">${dollars(line.balance)}</span></td>`,
			`<td class="ldg-col-go">${actionCellHtml(line)}</td>`,
		];
		return `<tr class="${classes.join(' ')}" data-ldg-id="${line.id}">${cells.join('')}</tr>`;
	}

	function totalsHtml(list) {
		const inflow = sumOf(
			list.filter((line) => line.amount > 0 && !line.transfer),
			(line) => line.amount,
		);
		const outflow = sumOf(
			list.filter((line) => line.amount < 0 && !line.transfer),
			(line) => -line.amount,
		);
		const parts = [];
		if (inflow) parts.push(`In <strong>${dollars(inflow)}</strong>`);
		if (outflow) parts.push(`${inflow ? 'out' : 'Out'} <strong>${dollars(outflow)}</strong>`);
		if (list.some((line) => line.transfer)) {
			parts.push(
				parts.length
					? 'transfers between our own accounts left out'
					: 'Transfers between our own accounts only',
			);
		}
		return parts.join(' · ');
	}

	function countLabel(showing, total) {
		if (showing === total) return `${showing} ${showing === 1 ? 'line' : 'lines'}`;
		return `${showing} of ${total} lines`;
	}

	/**
	 * Redraws the table for the current tab, account and search. `freshId`
	 * is a line that just changed and gets a short highlight.
	 */
	function paintLines(freshId) {
		const scoped = feed.filter(withinScope);
		const list = inOrder(scoped.filter(withinTab));
		visibleLines = list;
		const empty = !list.length;
		const everythingMatched = empty && view.tab === 'open' && !view.query;
		ui.tableWrap.hidden = empty;
		ui.noHits.hidden = !empty || everythingMatched;
		ui.allDone.hidden = !everythingMatched;
		const inTabTotal = feed.filter(
			(line) => (!view.account || line.acct === view.account) && withinTab(line),
		).length;
		ui.count.textContent = empty ? '' : countLabel(list.length, inTabTotal);
		ui.rows.innerHTML = list.map((line) => rowHtml(line, freshId)).join('');
		ui.listTotals.hidden = empty;
		ui.listTotals.innerHTML = totalsHtml(list);
		paintSortHeaders();
		paintTabCounts();
		paintChips();
		window.Basalt.tips?.(ui.rows);
	}

	function paintSortHeaders() {
		for (const header of pickAll('[data-ldg-th]', stage)) {
			const active = header.getAttribute('data-ldg-th') === view.sortKey;
			const glyph = pick('.bi', header);
			if (active) {
				header.setAttribute('aria-sort', view.sortDir === 'asc' ? 'ascending' : 'descending');
				glyph.className = `bi ${view.sortDir === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down'}`;
			} else {
				header.removeAttribute('aria-sort');
				glyph.className = 'bi bi-arrow-down-up ldg-sort-idle';
			}
		}
	}

	function paintTabCounts() {
		const scoped = feed.filter((line) => !view.account || line.acct === view.account);
		const counts = {
			all: scoped.length,
			open: scoped.filter(unmatched).length,
			matched: scoped.filter((line) => line.match).length,
		};

		for (const [key, count] of Object.entries(counts)) {
			pick(`[data-ldg-tab-count="${key}"]`, stage).textContent = count;
		}

		const suggestions = feed.filter((line) => !line.match && line.suggest).length;
		ui.acceptAll.hidden = !suggestions;
		ui.acceptLabel.textContent = suggestions === 1 ? 'Accept 1 suggestion' : `Accept ${suggestions} suggestions`;
		const open = feed.filter(unmatched).length;
		const tail = open ? `, <strong>${countWords(open, 'line')} still to match</strong>.` : ', every one matched.';
		ui.listSummary.innerHTML = `${capitalize(countWords(feed.length, 'line'))} from the bank feed since October 1${tail}`;
	}

	function paintChips() {
		if (!window.Basalt.drawer) return;
		const chips = view.account ? [{ label: accountByKey(view.account).name, remove: () => chooseAccount('') }] : [];
		window.Basalt.drawer.applied(ui.chips, chips, null, ui.search);
	}

	function onSearchInput() {
		clearTimeout(findDelay);
		findDelay = setTimeout(() => {
			view.query = ui.search.value.trim();
			paintLines();
		}, 160);
	}

	function clearSearch() {
		ui.search.value = '';
		view.query = '';
		paintLines();
		ui.search.focus();
	}

	function reorder(key) {
		if (view.sortKey === key) {
			view.sortDir = view.sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			view.sortKey = key;
			view.sortDir = 'desc';
		}
		paintLines();
	}

	/* The Match button and the quick view icon open the drawer; a click
     anywhere else on the row goes to the line's own page. */
	function onRowClick(event) {
		const row = event.target.closest('.ldg-row');
		if (!row) return;
		const id = Number(row.getAttribute('data-ldg-id'));
		if (event.target.closest('.ldg-go-btn, [data-ldg-peek]')) {
			openFromList(id);
			return;
		}
		const href = `transaction-details.html?id=${encodeURIComponent(id)}`;
		if (event.metaKey || event.ctrlKey) window.open(href, '_blank', 'noopener');
		else location.href = href;
	}

	/* The drawer: one line and how it gets into the books. */

	function slot(key) {
		return pick(`[data-ldg-d="${key}"]`, drawerNode);
	}

	function wireDrawer() {
		slot('other').addEventListener('click', () => {
			choosingCategory = !choosingCategory;
			paintBooking();
			if (choosingCategory) ui.categorySelect.focus();
		});
		slot('save').addEventListener('click', saveBooking);
		slot('undo').addEventListener('click', undoBooking);
		ui.splitToggle.addEventListener('click', () => toggleSplit(ui.splitBox.hidden));
		pick('[data-ldg-split-add]', drawerNode).addEventListener('click', () => {
			addSplitLine('', 0);
			paintRemainder();
			pick('select', ui.splitLines.lastElementChild).focus();
		});
		ui.splitLines.addEventListener('input', paintRemainder);
		ui.splitLines.addEventListener('click', (event) => {
			const remove = event.target.closest('[data-ldg-split-remove]');
			if (!remove) return;
			remove.closest('li').remove();
			paintRemainder();
			pick('select', ui.splitLines.firstElementChild).focus();
		});
		ui.categorySelect.addEventListener('change', () => ui.categorySelect.classList.remove('is-invalid'));
		ui.splitLines.addEventListener('change', (event) => {
			if (event.target.matches('select')) event.target.classList.remove('is-invalid');
		});

		/* Toasts move to the middle while the drawer is open, clear of its buttons. */
		drawerNode.addEventListener('show.bs.offcanvas', () => parkToasts('bottom-center'));
		drawerNode.addEventListener('shown.bs.offcanvas', () => slot('name').focus());
		drawerNode.addEventListener('hidden.bs.offcanvas', onDrawerClosed);
	}

	function parkToasts(where) {
		window.Basalt.toasts?.position?.(where);
	}

	function categoryOptions(chosen) {
		const first = `<option value=""${chosen ? '' : ' selected'}>Pick a category</option>`;
		const rest = Object.entries(LEDGER_CATEGORIES).map(
			([code, name]) =>
				`<option value="${code}"${code === chosen ? ' selected' : ''} data-hint="${code}">${safe(name)}</option>`,
		);
		return first + rest.join('');
	}

	function summarySentence(line) {
		const way = line.amount > 0 ? 'came in' : 'went out';
		return `<strong>${dollars(line.amount)}</strong> ${way} ${HOW_PAID[line.method].how} on ${shortDate(line.date)}.`;
	}

	function bookingCard(booking, kind) {
		const glyph = kind === 'matched' ? 'check2-circle' : 'link-45deg';
		let meta = '';
		if (kind === 'matched' && booking.entry)
			meta = `<span class="ldg-match-meta">Journal entry ${safe(booking.entry)}${booking.by ? `, by ${safe(booking.by)}` : ''}</span>`;
		if (kind === 'found') meta = `<span class="ldg-match-meta">${safe(booking.why)}</span>`;
		return `<div class="ldg-match ldg-match-${kind}"><span class="ldg-match-icon" aria-hidden="true"><i class="bi bi-${glyph}"></i></span><div class="ldg-match-text"><span class="ldg-match-title">${safe(booking.title)}</span><span class="ldg-match-detail">${safe(booking.detail)}</span>${meta}</div></div>`;
	}

	function addSplitLine(code, amount) {
		const item = document.createElement('li');
		item.className = 'ldg-split-line';
		const ordinal = ui.splitLines.children.length + 1;
		item.innerHTML = `<select class="form-select ldg-cat-select" aria-label="Category for line ${ordinal}" data-ldg-split-cat>${categoryOptions(code)}</select><div class="input-group ldg-amount"><span class="input-group-text">$</span><input type="text" class="form-control" inputmode="decimal" placeholder="0.00" aria-label="Amount for line ${ordinal}" value="${amount ? amount.toFixed(2) : ''}" data-ldg-split-amt></div><button type="button" class="btn btn-icon ldg-split-remove" aria-label="Remove line ${ordinal}" data-ldg-split-remove><i class="bi bi-x-lg" aria-hidden="true"></i></button>`;
		ui.splitLines.append(item);
		window.Basalt.select?.(pick('select', item));
	}

	function paintRemainder() {
		if (!openLine) return;
		const assigned = sumOf(pickAll('[data-ldg-split-amt]', ui.splitLines), (field) => readAmount(field.value) || 0);
		const remainder = roundMoney(Math.abs(openLine.amount) - assigned);
		ui.splitRemainder.classList.toggle('is-off', remainder !== 0);
		if (remainder === 0) ui.splitRemainder.textContent = `Adds up to ${dollars(openLine.amount)}`;
		else if (remainder > 0) ui.splitRemainder.textContent = `${dollars(remainder)} left to assign`;
		else ui.splitRemainder.textContent = `${dollars(remainder)} too much`;

		const tooFewToRemove = ui.splitLines.children.length < 3;
		for (const remove of pickAll('[data-ldg-split-remove]', ui.splitLines)) {
			remove.hidden = tooFewToRemove;
		}
	}

	function toggleSplit(on) {
		ui.splitBox.hidden = !on;
		ui.singleCategory.hidden = on;
		ui.splitToggle.textContent = on ? 'Book it to one category' : 'Split across categories';
		if (on && !ui.splitLines.children.length) {
			addSplitLine(ui.categorySelect.value, Math.abs(openLine.amount));
			addSplitLine('', 0);
		}
		paintRemainder();
	}

	function resetCategoryForm(line) {
		ui.categorySelect.innerHTML = categoryOptions(line.cat || '');
		window.Basalt.select?.refresh(ui.categorySelect);
		ui.categorySelect.classList.remove('is-invalid');
		ui.categoryHint.textContent = line.hint || '';
		ui.categoryHint.hidden = !line.hint;
		ui.splitLines.innerHTML = '';
		ui.splitRemainder.textContent = '';
		toggleSplit(false);
	}

	/** Puts one line into the drawer and marks its row in the table. */
	function showLine(line) {
		openLine = line;
		choosingCategory = false;
		const account = accountByKey(line.acct);
		slot('mark').outerHTML = directionBadge(line, true, 'mark');
		slot('name').textContent = line.who;
		slot('sub').textContent = `${account.short} ···${account.last4} · ${shortDate(line.date)}`;
		slot('full').href = `transaction-details.html?id=${encodeURIComponent(line.id)}`;
		slot('status').innerHTML = stateBadge(line);
		slot('lead').innerHTML = summarySentence(line);
		slot('memo').textContent = line.memo;
		slot('balance').textContent = dollars(line.balance);
		slot('cust-row').hidden = !line.customer;
		slot('cust').textContent = line.who;
		if (line.customer) slot('cust').href = `company-details.html?id=${encodeURIComponent(line.customer)}`;
		resetCategoryForm(line);
		paintBooking();
		highlightedId = line.id;

		for (const row of pickAll('.ldg-row', ui.rows)) {
			row.classList.toggle('is-selected', Number(row.getAttribute('data-ldg-id')) === line.id);
		}
	}

	function paintBooking() {
		const line = openLine;
		const state = choosingCategory ? 'none' : matchStateOf(line);
		const cards = {
			matched: () => bookingCard(line.match, 'matched'),
			found: () => bookingCard(line.suggest, 'found'),
		};
		slot('match-title').textContent = state === 'found' ? 'Suggested match' : 'In the books';
		slot('match').innerHTML = cards[state] ? cards[state]() : '';
		slot('match').hidden = state === 'none';
		ui.categoryForm.hidden = state !== 'none';
		slot('undo').hidden = state !== 'matched';
		slot('other').hidden = !(line.suggest && !line.match);
		slot('other').textContent = choosingCategory ? 'Use the suggestion' : 'Pick a category';
		const openLink = slot('open');
		openLink.hidden = state !== 'matched';
		if (state === 'matched') {
			openLink.href = line.match.href;
			openLink.textContent = line.match.link;
		}
		const save = slot('save');
		save.hidden = state === 'matched';
		save.innerHTML = `<i class="bi bi-check2 me-1" aria-hidden="true"></i>${state === 'found' ? 'Confirm match' : 'Save'}`;
	}

	/* Stepping runs through the lines on screen in their order, or through
     the unmatched ones only when the visitor pressed "Match next". */

	function stepTo(index) {
		if (stepper) stepper.go(index, 0);
		else showLine(stepList[index]);
		pick('.basalt-drawer-nav', drawerNode).hidden = stepList.length < 2;
	}

	function openFromList(id) {
		onlyOpenOnes = false;
		stepList = [...visibleLines];
		const index = stepList.findIndex((line) => line.id === id);
		if (index < 0 || !drawerCtl) return;
		stepTo(index);
		drawerCtl.show();
	}

	function startMatching() {
		stepList = unmatchedLines();
		if (!stepList.length) {
			notify({
				tone: 'success',
				icon: 'bi-check2-circle',
				title: 'Nothing to match',
				text: 'Every bank line is in the books.',
			});
			return;
		}
		onlyOpenOnes = true;
		stepTo(0);
		drawerCtl?.show();
	}

	function onDrawerClosed() {
		parkToasts('bottom-end');
		const row = highlightedId && pick(`.ldg-row[data-ldg-id="${highlightedId}"]`, ui.rows);
		highlightedId = null;
		openLine = null;

		for (const each of pickAll('.ldg-row', ui.rows)) {
			each.classList.remove('is-selected');
		}

		if (row) pick('.ldg-who-name', row).focus();
		else if (!ui.allDone.hidden) pick('.basalt-empty-title', ui.allDone).focus();
	}

	/* Saving, undoing and moving on. */

	function freshEntry() {
		return { entry: `#${journalCounter}`, by: SIGNED_IN, href: 'accounting.html', link: 'Open in Accounting' };
	}

	/**
	 * Reads the category form into a booking. Returns null after marking
	 * the fields that still need attention.
	 */
	function collectBooking() {
		const line = openLine;
		if (ui.splitBox.hidden) {
			if (!ui.categorySelect.value) {
				ui.categorySelect.classList.add('is-invalid');
				ui.categorySelect.focus();
				return null;
			}
			const code = ui.categorySelect.value;
			return { cat: code, title: categoryName(code), detail: `Account ${code}, booked by hand`, ...freshEntry() };
		}

		const parts = pickAll('.ldg-split-line', ui.splitLines).map((item) => ({
			select: pick('select', item),
			amount: pick('[data-ldg-split-amt]', item),
		}));
		let firstBad = null;

		for (const part of parts) {
			const hasCategory = Boolean(part.select.value);
			const hasAmount = readAmount(part.amount.value) > 0;
			part.select.classList.toggle('is-invalid', !hasCategory);
			part.amount.classList.toggle('is-invalid', !hasAmount);
			firstBad ??= !hasCategory ? part.select : !hasAmount ? part.amount : null;
		}

		if (firstBad) {
			firstBad.focus();
			return null;
		}
		const assigned = roundMoney(sumOf(parts, (part) => readAmount(part.amount.value)));
		if (assigned !== roundMoney(Math.abs(line.amount))) {
			paintRemainder();
			parts[0].amount.focus();
			sayAloud(ui.splitRemainder.textContent.trim());
			return null;
		}
		return {
			cat: parts[0].select.value,
			title: `Split across ${countWords(parts.length, 'category', 'categories')}`,
			detail: parts
				.map((part) => `${categoryName(part.select.value)} ${dollars(readAmount(part.amount.value))}`)
				.join(', '),
			...freshEntry(),
		};
	}

	function acceptSuggestion(line) {
		line.match = { entry: line.suggest.entry || `#${journalCounter++}`, by: SIGNED_IN, ...line.suggest };
		line.suggest = null;
	}

	function saveBooking() {
		const line = openLine;
		if (!line) return;
		let bookedAs;
		if (line.suggest && !choosingCategory) {
			bookedAs = line.suggest.title;
			acceptSuggestion(line);
		} else {
			const booking = collectBooking();
			if (!booking) return;
			journalCounter++;
			line.prevSuggest = line.suggest || null;
			line.match = booking;
			line.suggest = null;
			bookedAs = booking.title;
		}
		refreshAfter(line, `Matched to ${bookedAs}.`);
		moveOn(line);
	}

	function undoBooking() {
		const line = openLine;
		if (line.match.cat) {
			line.suggest = line.prevSuggest || null;
			line.cat = line.match.cat;
		} else {
			line.suggest = line.match;
		}
		line.match = null;
		refreshAfter(line, 'It is back in To match.');
		stepList = onlyOpenOnes ? unmatchedLines() : [...visibleLines];
		const index = stepList.findIndex((item) => item.id === line.id);
		if (index >= 0) stepTo(index);
		else showLine(line);
		slot('save').focus();
	}

	function refreshAfter(line, text) {
		paintBacklog();
		paintAccounts();
		paintLines(line.id);
		notify({
			tone: line.match ? 'success' : 'info',
			icon: line.match ? 'bi-check2-circle' : 'bi-arrow-counterclockwise',
			title: `${line.match ? 'Matched: ' : 'Match undone: '}${line.who}`,
			text,
		});
	}

	/** After a save, carry on to the next unmatched line, wrapping around. */
	function moveOn(line) {
		const wasAt = Math.max(
			0,
			stepList.findIndex((item) => item.id === line.id),
		);
		stepList = onlyOpenOnes ? unmatchedLines() : [...visibleLines];
		const fromHere = [...stepList.slice(wasAt), ...stepList.slice(0, wasAt)];
		const following = fromHere.find((item) => unmatched(item) && item.id !== line.id);
		if (following) {
			stepTo(stepList.indexOf(following));
			slot('name').focus();
			return;
		}
		const stillHere = stepList.findIndex((item) => item.id === line.id);
		if (stillHere >= 0) {
			stepTo(stillHere);
			slot('open').focus();
			return;
		}
		drawerCtl?.hide();
	}

	/* "Accept suggestions": every found match at once. */

	function acceptEverySuggestion() {
		const accepted = feed.filter((line) => !line.match && line.suggest);

		for (const line of accepted) {
			acceptSuggestion(line);
		}

		paintBacklog();
		paintAccounts();
		paintLines();
		const names = accepted
			.map((line) => line.who)
			.join(', ')
			.replace(/, ([^,]*)$/, ' and $1');
		notify({
			tone: 'success',
			icon: 'bi-check2-all',
			title: `${capitalize(countWords(accepted.length, 'line'))} matched`,
			text: `${names}.`,
		});
		/* The button is gone now, so focus lands on whatever comes next. */
		(ui.matchNext.hidden ? pick('.basalt-tabs-list .nav-link.active', stage) : ui.matchNext).focus();
	}

	/* The import dialog: pick an account, choose a statement file. */

	function wireImport() {
		pick('[data-ldg-import-accts]', ui.importForm).innerHTML = BANK_ACCOUNTS.map(
			(account, index) =>
				`<label class="basalt-choice-card ldg-tile"><input class="basalt-choice-card-input" type="radio" name="txnImportAcct" value="${account.key}"${index ? '' : ' checked'}><span class="basalt-choice-card-icon" aria-hidden="true"><i class="bi bi-${ACCOUNT_ICONS[account.key] ?? 'bank'}"></i></span><span class="basalt-choice-card-title">${safe(account.name)}</span><span class="basalt-choice-card-text">···${account.last4}</span></label>`,
		).join('');
		importNode.addEventListener('show.bs.modal', () => {
			ui.importForm.reset();
			ui.importFile.classList.remove('is-invalid');
		});
		ui.importFile.addEventListener('change', () => ui.importFile.classList.remove('is-invalid'));
		ui.importForm.addEventListener('submit', onImportSubmit);
	}

	function onImportSubmit(event) {
		event.preventDefault();
		if (!ui.importFile.files.length) {
			ui.importFile.classList.add('is-invalid');
			ui.importFile.focus();
			return;
		}
		const account = accountByKey(pick('input[name="txnImportAcct"]:checked', ui.importForm).value);
		const already = linesOf(account).length;
		importCtl?.hide();
		const tail = already ? `: its ${countWords(already, 'line')} since October 1 came in with the feed.` : '.';
		notify({
			tone: 'info',
			icon: 'bi-file-earmark-check',
			title: 'Statement checked',
			text: `${ui.importFile.files[0].name} holds nothing new for ${account.name}${tail}`,
		});
	}

	start();
})();
