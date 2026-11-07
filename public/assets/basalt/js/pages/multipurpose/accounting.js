/**
 * Accounting (accounting.html).
 *
 * One ledger shown two ways: the chart of accounts with every balance as of
 * today, and the October journal that moved those balances. Nothing is
 * stored twice. A balance is always the September close plus the posted
 * October lines, so the two summary cards, the chart, both drawers and the
 * trial balance line agree with each other, and posting a draft updates
 * them all in one pass.
 *
 * To plug in a real ledger, replace LEDGER and JOURNAL below.
 */
(() => {
	'use strict';

	/* A button at a limit says why in its tooltip instead of going dead. */
	const atLimit = (button, reason) => (window.Basalt?.limit || ((b, r) => (b.disabled = Boolean(r))))(button, reason);

	const page = pick('[data-acc-root]');
	if (!page) return;

	const TODAY = '2026-10-09';
	const SIGNED_IN = 'John Armstrong';
	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/* An open group of the chart lists this many accounts before "Show all". */
	const PREVIEW_ROWS = 4;

	/* The five kinds of account and the code block each one owns: 1xxxx
     assets, 2xxxx liabilities, 3xxxx equity, 4xxxx revenue, 5xxxx and 6xxxx
     expenses. `side` is the side a balance normally sits on. */
	const KINDS = {
		assets: { label: 'Assets', side: 'debit', glyph: 'bank', lowest: 10000, highest: 19999 },
		liabilities: {
			label: 'Liabilities',
			side: 'credit',
			glyph: 'credit-card-2-back',
			lowest: 20000,
			highest: 29999,
		},
		equity: { label: 'Equity', side: 'credit', glyph: 'pie-chart', lowest: 30000, highest: 39999 },
		revenue: { label: 'Revenue', side: 'credit', glyph: 'graph-up-arrow', lowest: 40000, highest: 49999 },
		expenses: { label: 'Expenses', side: 'debit', glyph: 'receipt', lowest: 50000, highest: 69999 },
	};

	/**
	 * One account. `opening` is its balance at the September close (Sep 30,
	 * 2026) on its normal side; revenue and expenses cover January through
	 * September, the same months the Finance dashboard reports. An account
	 * whose balance sits on the other side (Accumulated Depreciation, a
	 * contra asset) names that side explicitly.
	 */
	function account(code, kind, name, note, opening, extra) {
		return { code, kind, name, note, opening, side: KINDS[kind].side, ...extra };
	}

	const LEDGER = [
		account('10100', 'assets', 'Operating Account', 'Northbank checking ***5182', 2806094.6, {
			goTo: ['transactions.html', 'Bank transactions'],
		}),
		account('10200', 'assets', 'Payroll Account', 'Northbank checking ***2207', 48200),
		account('10300', 'assets', 'Reserve Savings', 'Northbank savings ***2915', 1500000),
		account('11100', 'assets', 'Accounts Receivable', 'Invoices customers have not paid yet', 80996.48, {
			goTo: ['invoices.html', 'Unpaid invoices'],
		}),
		account('11500', 'assets', 'Prepaid Expenses', 'Insurance and annual software paid ahead', 38400),
		account('12100', 'assets', 'Prepaid SMS Credit', 'Text messages bought ahead, at cost', 142600, {
			goTo: ['finance-reports.html', 'Balance sheet'],
		}),
		account('15100', 'assets', 'Computers & Equipment', 'Laptops, test devices and office kit', 286500),
		account('15900', 'assets', 'Accumulated Depreciation', 'Wear on equipment to date', 118750, { side: 'credit' }),
		account('20100', 'liabilities', 'Accounts Payable', 'Supplier bills not paid yet', 96480),
		account('20300', 'liabilities', 'Company Cards', 'Card spend, settled on the 20th', 52310),
		account('21100', 'liabilities', 'Sales Tax Payable', 'Collected on add-on sales, paid monthly', 9840),
		account('21300', 'liabilities', 'Payroll Taxes Payable', 'Withheld from pay, paid on the 15th', 21600),
		account('22100', 'liabilities', 'Deferred Revenue', 'Annual plans paid ahead, earned monthly', 1183000, {
			goTo: ['subscriptions.html', 'Subscriptions'],
		}),
		account('30100', 'equity', 'Share Capital', 'Paid in by shareholders', 2000000),
		account('33100', 'equity', 'Retained Earnings', 'Profit kept from earlier years', 486611.08),
		account('41100', 'revenue', 'Subscription Revenue', 'Basic, Pro and Max plans', 7333100, {
			goTo: ['subscriptions.html', 'Subscriptions'],
		}),
		account('41300', 'revenue', 'Add-on Revenue', 'SMS packs, phone lines and storage', 305500, {
			goTo: ['income.html', 'Income by source'],
		}),
		account('41500', 'revenue', 'Onboarding & Training', 'Setup projects and live training', 349100),
		account('51100', 'expenses', 'Hosting & Infrastructure', 'Cloud servers, storage and backups', 1250700),
		account('51300', 'expenses', 'SMS & Phone Line Costs', 'What the texts and lines cost us', 180200),
		account('51500', 'expenses', 'Payment Processing Fees', 'Card fees on plans and add-on sales', 245200),
		account('61100', 'expenses', 'Salaries & Benefits', 'Pay, health cover and pensions', 3792400, {
			goTo: ['payroll.html', 'Payroll'],
		}),
		account('62100', 'expenses', 'Rent & Office', 'Office rent, insurance and utilities', 248600),
		account('62300', 'expenses', 'Software & Tools', 'Tools the team works in', 318900),
		account('63100', 'expenses', 'Marketing & Events', 'Ads, trade shows and sponsorships', 562800),
		account('64100', 'expenses', 'Professional Fees', 'Legal, audit and tax advice', 99750),
		account('66100', 'expenses', 'Depreciation', 'Monthly wear on equipment', 61650),
		account('69100', 'expenses', 'Income Tax', 'Estimated tax on profit', 293300),
	];

	/** A journal line: money into (debit) or out of (credit) one account. */
	function debit(code, amount) {
		return { code, debit: amount };
	}

	function credit(code, amount) {
		return { code, credit: amount };
	}

	/**
	 * One journal entry. A draft is saved but changes no balance until it is
	 * posted; `stamped` is the day it was posted, or saved while a draft.
	 */
	function entry(id, date, memo, source, author, status, lines, goTo) {
		return { id, date, memo, source, author, status, stamped: date, lines, goTo };
	}

	const JOURNAL = [
		entry('#401', '2026-10-01', 'October plans charged to cards', 'Billing', 'Billing sync', 'posted', [
			debit('10100', 720915.4),
			debit('51500', 21964.6),
			credit('41100', 742880),
		]),
		entry('#402', '2026-10-01', 'Annual plans earned in October', 'Schedule', 'Monthly schedule', 'posted', [
			debit('22100', 136400),
			credit('41100', 136400),
		]),
		entry(
			'#403',
			'2026-10-07',
			'Payment from Oakhaven Studio',
			'Bank feed',
			'Gregory Devin',
			'posted',
			[debit('10100', 1693.87), credit('11100', 1693.87)],
			['invoice-details.html?id=%235431', 'Open invoice #5431'],
		),
		entry('#404', '2026-10-02', 'Office rent, October', 'Manual', 'Gregory Devin', 'posted', [
			debit('62100', 21300),
			credit('10100', 21300),
		]),
		entry(
			'#405',
			'2026-10-03',
			'2.1M SMS credits billed by Relaywave',
			'Supplier bill',
			'Hope Stout',
			'posted',
			[debit('12100', 16480), credit('20100', 16480)],
			['finance-reports.html', 'Open bills to pay'],
		),
		entry(
			'#406',
			'2026-10-05',
			'Add-on sales, week 40',
			'In-app billing',
			'Billing sync',
			'posted',
			[
				debit('10100', 16340),
				debit('51300', 8920),
				credit('41300', 15130),
				credit('21100', 1210),
				credit('12100', 8920),
			],
			['receipts.html', 'Open card receipts'],
		),
		entry('#407', '2026-10-06', 'Cash moved to the payroll account', 'Manual', SIGNED_IN, 'posted', [
			debit('10200', 260000),
			credit('10100', 260000),
		]),
		entry(
			'#408',
			'2026-10-06',
			'Payroll, October 1 to 15',
			'Payroll',
			'Payroll sync',
			'posted',
			[debit('61100', 318400), credit('10200', 254700), credit('21300', 63700)],
			['payroll.html', 'Open payroll'],
		),
		entry('#409', '2026-10-06', 'September sales tax paid', 'Bank feed', 'Gregory Devin', 'posted', [
			debit('21100', 9840),
			credit('10100', 9840),
		]),
		entry('#410', '2026-10-07', 'Cloud hosting, October', 'Card feed', 'Hope Stout', 'posted', [
			debit('51100', 41250),
			credit('20300', 41250),
		]),
		entry('#411', '2026-10-07', 'Software subscriptions, October', 'Card feed', 'Hope Stout', 'posted', [
			debit('62300', 18640),
			credit('20300', 18640),
		]),
		entry('#412', '2026-10-08', 'Depreciation, October', 'Schedule', 'Monthly schedule', 'draft', [
			debit('66100', 6850),
			credit('15900', 6850),
		]),
		entry('#413', '2026-10-08', 'Insurance used in October', 'Manual', 'Gregory Devin', 'draft', [
			debit('62100', 2400),
			credit('11500', 2400),
		]),
		entry('#414', '2026-10-08', 'OnSite Expo Evanston stand', 'Manual', 'Gregory Devin', 'draft', [
			debit('63100', 11800),
			credit('20100', 11800),
		]),
	];

	/* What changes as the page is used. */
	let nextNumber = 415;
	let highlightId = null;
	let drawerAccount = null;
	let drawerEntry = null;
	let lineCounter = 0;
	/* Which groups of the chart are unfolded, and which list every account
     rather than the first few. Assets starts unfolded. A search or a kind
     filter unfolds every matching group regardless. */
	const unfolded = new Set(['assets']);
	const showingAll = new Set();

	/* The drawers and dialogs sit outside the page root. */
	const accountDrawer = document.getElementById('acc-account');
	const entryDrawer = document.getElementById('acc-entry');
	const entryDialog = document.getElementById('acc-entry-modal');
	const accountDialog = document.getElementById('acc-account-modal');

	/**
	 * Wires every control and draws the page.
	 */
	function start() {
		wireChartControls();
		wireJournalControls();
		wireRowClicks();
		wireAccountDrawer();
		wireEntryDrawer();
		wireEntryForm();
		wireAccountForm();
		paintAll();
	}

	function paintAll() {
		paintSummary();
		paintChart();
		paintJournal();
	}

	/* Lookups. Every hook on the page is a data-acc-* attribute. */

	function hook(name, within = page) {
		return pick(`[data-acc-${name}]`, within);
	}

	function hookAll(name, within = page) {
		return [...pickAll(`[data-acc-${name}]`, within)];
	}

	function hookValue(prefix, key, within = page) {
		return pick(`[data-acc-${prefix}="${key}"]`, within);
	}

	function offcanvasOf(element) {
		return window.bootstrap.Offcanvas.getOrCreateInstance(element);
	}

	function modalOf(element) {
		return window.bootstrap.Modal.getOrCreateInstance(element);
	}

	function showTab(id) {
		const tab = document.getElementById(id);
		if (tab && !tab.classList.contains('active')) window.bootstrap.Tab.getOrCreateInstance(tab).show();
	}

	function toastNote(options) {
		window.Basalt.toasts?.push(options);
	}

	function queryMatches(text, query) {
		if (window.Basalt?.matchesQuery) return window.Basalt.matchesQuery(text, query);
		return text.toLowerCase().includes(query.toLowerCase());
	}

	/* Formatting. */

	function htmlSafe(value) {
		const swap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (char) => swap[char]);
	}

	function roundCents(amount) {
		return Math.round(amount * 100) / 100;
	}

	function signOf(amount) {
		return amount < 0 ? '−$' : '$';
	}

	function asMoney(amount) {
		return (
			signOf(amount) +
			Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
		);
	}

	/** $2.81M, $48k, $980: the summary cards have no room for cents. */
	function asShortMoney(amount) {
		const size = Math.abs(amount);
		let digits;
		if (size >= 1e6) digits = `${(size / 1e6).toFixed(2)}M`;
		else if (size >= 1e3) digits = `${Math.round(size / 1e3)}k`;
		else digits = String(Math.round(size));
		return signOf(amount) + digits;
	}

	function shortDate(iso) {
		const [, month, day] = iso.split('-');
		return `${MONTH_NAMES[Number(month) - 1]} ${Number(day)}`;
	}

	function fullDate(iso) {
		return `${shortDate(iso)}, ${iso.slice(0, 4)}`;
	}

	function countOf(amount, singular, pluralForm = `${singular}s`) {
		return `${amount} ${amount === 1 ? singular : pluralForm}`;
	}

	/* Ledger arithmetic. Every balance is derived, never stored. */

	function accountByCode(code) {
		return LEDGER.find((candidate) => candidate.code === code);
	}

	function entryById(id) {
		return JOURNAL.find((candidate) => candidate.id === id);
	}

	function sumOf(list, pickAmount) {
		return roundCents(list.reduce((total, item) => total + (pickAmount(item) || 0), 0));
	}

	function entryDebits(record) {
		return sumOf(record.lines, (line) => line.debit);
	}

	function entryCredits(record) {
		return sumOf(record.lines, (line) => line.credit);
	}

	function postedEntries() {
		return JOURNAL.filter((record) => record.status === 'posted');
	}

	/** What one line does to an account, measured on the account's own side. */
	function lineEffect(ledgerAccount, line) {
		const towardDebit = (line.debit || 0) - (line.credit || 0);
		return roundCents(ledgerAccount.side === 'debit' ? towardDebit : -towardDebit);
	}

	/** How far the posted October lines have moved an account. */
	function octoberMovement(ledgerAccount) {
		let moved = 0;
		for (const record of postedEntries()) {
			for (const line of record.lines) {
				if (line.code === ledgerAccount.code) moved += lineEffect(ledgerAccount, line);
			}
		}
		return roundCents(moved);
	}

	function balanceToday(ledgerAccount) {
		return roundCents(ledgerAccount.opening + octoberMovement(ledgerAccount));
	}

	/** The balance as it counts toward the account's kind: a contra account
      takes away from the group it sits in. */
	function isContra(ledgerAccount) {
		return ledgerAccount.side !== KINDS[ledgerAccount.kind].side;
	}

	function groupedBalance(ledgerAccount) {
		return (isContra(ledgerAccount) ? -1 : 1) * balanceToday(ledgerAccount);
	}

	function accountsOfKind(kind) {
		return LEDGER.filter((candidate) => candidate.kind === kind);
	}

	function kindTotal(kind) {
		return sumOf(accountsOfKind(kind), groupedBalance);
	}

	function sortedByCode(accounts) {
		return [...accounts].sort((one, two) => one.code.localeCompare(two.code));
	}

	function newestFirst(entries) {
		return [...entries].sort((one, two) => (two.date + two.id).localeCompare(one.date + one.id));
	}

	function oldestFirst(entries) {
		return [...entries].sort((one, two) => (one.date + one.id).localeCompare(two.date + two.id));
	}

	/* The two summary cards, the drafts notice and the tab counts. Assets
     always equal liabilities plus equity plus this year's profit (revenue
     less expenses, not yet closed into equity), so both balance-sheet bars
     come out the same length. */

	function paintFigure(key, text) {
		hookValue('fig', key).textContent = text;
	}

	function paintSegment(key, share) {
		hookValue('seg', key).style.setProperty('--acc-w', `${(Math.max(0, share) * 100).toFixed(2)}%`);
	}

	function paintSummary() {
		const assets = kindTotal('assets');
		const liabilities = kindTotal('liabilities');
		const equity = kindTotal('equity');
		const revenue = kindTotal('revenue');
		const expenses = kindTotal('expenses');
		const profit = roundCents(revenue - expenses);

		paintFigure('assets', asShortMoney(assets));
		paintFigure('liabilities', asShortMoney(liabilities));
		paintFigure('equity', asShortMoney(equity));
		paintFigure('profit-share', asShortMoney(profit));
		paintSegment('assets', 1);
		paintSegment('liabilities', liabilities / assets);
		paintSegment('equity', equity / assets);
		paintSegment('profit', profit / assets);

		paintFigure('profit', asShortMoney(profit));
		paintFigure('margin', `${Math.round((profit / revenue) * 1000) / 10}% of revenue`);
		paintFigure('revenue', asShortMoney(revenue));
		paintFigure('expenses', asShortMoney(expenses));
		paintSegment('revenue', 1);
		paintSegment('expenses', expenses / revenue);
		const [costliest] = accountsOfKind('expenses').sort((one, two) => balanceToday(two) - balanceToday(one));
		hookValue('fig', 'cost').innerHTML =
			`Biggest cost: <button type="button" class="acc-open" data-acc-account-open="${costliest.code}">${htmlSafe(costliest.name)}</button>, ${Math.round((balanceToday(costliest) / expenses) * 100)}% of expenses.`;

		const drafts = JOURNAL.filter((record) => record.status === 'draft');
		hook('drafts').hidden = !drafts.length;
		hook('drafts-text').textContent =
			drafts.length === 1
				? 'One draft is waiting to be posted. It leaves the balances alone until then.'
				: `${drafts.length} drafts are waiting to be posted. They leave the balances alone until then.`;

		hookValue('count', 'accounts').textContent = LEDGER.length;
		hookValue('count', 'entries').textContent = JOURNAL.length;
		hookValue('count', 'drafts').textContent = drafts.length;
	}

	/* The chart of accounts: one tbody per kind, each headed by a row that
     folds its accounts away. */

	function chosenKind() {
		return pick('[aria-pressed="true"]', hook('chart-type')).getAttribute('data-acc-type');
	}

	function chooseKind(kind) {
		for (const chip of hookAll('type', hook('chart-type'))) {
			chip.setAttribute('aria-pressed', String(chip.getAttribute('data-acc-type') === kind));
		}
	}

	function monthCellMarkup(ledgerAccount) {
		const moved = octoberMovement(ledgerAccount) * (isContra(ledgerAccount) ? -1 : 1);
		if (!moved) return '<span class="acc-amount acc-amount-quiet">—</span>';
		return `<span class="acc-amount">${moved > 0 ? '+' : ''}${asMoney(moved)}</span>`;
	}

	function accountRowMarkup(ledgerAccount, visible) {
		const classes = `acc-row${ledgerAccount.code === highlightId ? ' is-fresh' : ''}`;
		return (
			`<tr class="${classes}" data-acc-account="${ledgerAccount.code}"${visible ? '' : ' hidden'}>` +
			`<td class="acc-col-code"><span class="acc-code">${ledgerAccount.code}</span></td>` +
			`<td class="acc-cell-name"><button type="button" class="acc-open" data-acc-account-open="${ledgerAccount.code}">${htmlSafe(ledgerAccount.name)}</button><span class="acc-sub">${htmlSafe(ledgerAccount.note)}</span></td>` +
			`<td class="acc-col-month text-end">${monthCellMarkup(ledgerAccount)}</td>` +
			`<td class="acc-cell-bal text-end"><span class="acc-amount">${asMoney(groupedBalance(ledgerAccount))}</span></td></tr>`
		);
	}

	function groupMarkup(kind, matching, forcedOpen) {
		const open = forcedOpen || unfolded.has(kind);
		const everyRow = forcedOpen || showingAll.has(kind) || matching.length <= PREVIEW_ROWS;
		const rows = everyRow ? matching : matching.slice(0, PREVIEW_ROWS);
		const headRow =
			`<tr class="acc-group"><th scope="rowgroup" colspan="3" class="acc-cell-name">` +
			`<button type="button" class="acc-group-toggle" data-acc-fold="${kind}" aria-expanded="${open}"${forcedOpen ? ' disabled' : ''}>` +
			`<i class="bi bi-chevron-down acc-group-chevron" aria-hidden="true"></i><span class="acc-group-name">${KINDS[kind].label}</span>` +
			`<span class="acc-group-count">${countOf(accountsOfKind(kind).length, 'account')}</span></button></th>` +
			`<td class="text-end acc-cell-bal"><span class="acc-amount">${asMoney(kindTotal(kind))}</span></td></tr>`;
		const moreRow =
			open && !forcedOpen && matching.length > PREVIEW_ROWS
				? `<tr class="acc-more"><td colspan="4"><button type="button" class="acc-more-btn" data-acc-more="${kind}">${everyRow ? 'Show fewer' : `Show all ${matching.length} accounts`}</button></td></tr>`
				: '';
		return headRow + rows.map((ledgerAccount) => accountRowMarkup(ledgerAccount, open)).join('') + moreRow;
	}

	function paintChart() {
		const table = hook('chart');
		for (const body of pickAll('tbody', table)) body.remove();

		const query = hook('chart-search').value.trim();
		const kindFilter = chosenKind();
		const forcedOpen = Boolean(query) || kindFilter !== 'all';
		let shown = 0;

		for (const kind of Object.keys(KINDS)) {
			if (kindFilter !== 'all' && kindFilter !== kind) continue;
			const matching = sortedByCode(
				accountsOfKind(kind).filter(
					(candidate) =>
						!query || queryMatches(`${candidate.code} ${candidate.name} ${candidate.note}`, query),
				),
			);
			if (!matching.length) continue;
			shown += matching.length;
			const body = document.createElement('tbody');
			body.className = `acc-type-${kind}`;
			body.innerHTML = groupMarkup(kind, matching, forcedOpen);
			table.appendChild(body);
		}
		highlightId = null;

		hook('chart-summary').textContent =
			shown === LEDGER.length ? countOf(shown, 'account') : `${shown} of ${LEDGER.length} accounts`;

		/* One button serves every group: it reads Expand all until each group
       is open and complete. */
		const allOpen = forcedOpen || Object.keys(KINDS).every((kind) => unfolded.has(kind) && showingAll.has(kind));
		const foldAll = hook('fold-all');
		foldAll.hidden = forcedOpen || !shown;
		foldAll.dataset.expanded = String(allOpen);
		foldAll.lastElementChild.textContent = allOpen ? 'Collapse all' : 'Expand all';
		foldAll.firstElementChild.className = `bi ${allOpen ? 'bi-arrows-collapse' : 'bi-arrows-expand'} me-1`;

		table.hidden = !shown;
		const empty = hook('chart-empty');
		empty.hidden = Boolean(shown);
		empty.innerHTML = shown
			? ''
			: window.Basalt.emptyState({
					query,
					noun: 'accounts',
					text: kindFilter !== 'all' ? 'Check the spelling, or look in every type.' : '',
				});

		paintTrialBalance(shown);
	}

	/** Every debit balance against every credit balance; they must agree. */
	function paintTrialBalance(shown) {
		let debits = 0;
		let credits = 0;
		for (const ledgerAccount of LEDGER) {
			const onDebitSide = balanceToday(ledgerAccount) * (ledgerAccount.side === 'debit' ? 1 : -1);
			if (onDebitSide > 0) debits += onDebitSide;
			else credits -= onDebitSide;
		}
		const agree = Math.abs(roundCents(debits) - roundCents(credits)) < 0.005;
		hook('check').hidden = !shown || !agree;
		hook('check-text').textContent = `The books balance: ${asMoney(roundCents(debits))} in debits and in credits.`;
	}

	function wireChartControls() {
		hook('chart-search').addEventListener('input', paintChart);

		hook('chart').addEventListener('click', (clickEvent) => {
			const moreButton = clickEvent.target.closest('[data-acc-more]');
			if (moreButton) {
				const kind = moreButton.getAttribute('data-acc-more');
				window.Basalt.slide(hook('chart').parentElement, () => {
					toggleIn(showingAll, kind);
					paintChart();
				});
				hookValue('more', kind, hook('chart'))?.focus();
				return;
			}
			const foldButton = clickEvent.target.closest('[data-acc-fold]');
			if (!foldButton) return;
			const kind = foldButton.getAttribute('data-acc-fold');
			window.Basalt.slide(hook('chart').parentElement, () => {
				toggleIn(unfolded, kind);
				showingAll.delete(kind);
				paintChart();
			});
			hookValue('fold', kind, hook('chart'))?.focus();
		});

		hook('fold-all').addEventListener('click', () => {
			window.Basalt.slide(hook('chart').parentElement, () => {
				if (hook('fold-all').dataset.expanded === 'true') {
					unfolded.clear();
					showingAll.clear();
				} else {
					for (const kind of Object.keys(KINDS)) {
						unfolded.add(kind);
						showingAll.add(kind);
					}
				}
				paintChart();
			});
		});

		hook('chart-type').addEventListener('click', (clickEvent) => {
			const chip = clickEvent.target.closest('[data-acc-type]');
			if (!chip) return;
			chooseKind(chip.getAttribute('data-acc-type'));
			paintChart();
		});
	}

	function toggleIn(set, value) {
		if (set.has(value)) set.delete(value);
		else set.add(value);
	}

	/* The journal: October's entries, newest first, filtered by status and
     by search. */

	function statusPillMarkup(record) {
		return record.status === 'posted'
			? '<span class="basalt-status basalt-status-success basalt-status-dot">Posted</span>'
			: '<span class="basalt-status basalt-status-warning basalt-status-dot">Draft</span>';
	}

	function chosenStatus() {
		return pick('input[name="acc-status"]:checked', page)?.value || 'all';
	}

	/** "Dr Operating Account +2": the first account on one side, and how
      many more lines sit on it. */
	function sideSummaryMarkup(record, side) {
		const lines = record.lines.filter((line) => line[side]);
		const others = lines.length > 1 ? ` <span class="acc-dc-more">+${lines.length - 1}</span>` : '';
		const [short, long] = side === 'debit' ? ['Dr', 'Debit'] : ['Cr', 'Credit'];
		return `<span class="acc-dc"><span class="acc-dc-side"><span aria-hidden="true">${short}</span><span class="visually-hidden">${long}</span></span><span>${htmlSafe(accountByCode(lines[0].code).name)}${others}</span></span>`;
	}

	function journalSearchText(record) {
		const accountNames = record.lines.map((line) => `${line.code} ${accountByCode(line.code).name}`);
		return [record.id, record.memo, record.source, record.author, ...accountNames].join(' ');
	}

	function entryRowMarkup(record) {
		const classes = `acc-row${record.id === highlightId ? ' is-fresh' : ''}`;
		return (
			`<tr class="${classes}" data-acc-entry="${record.id}">` +
			`<td class="acc-col-date"><span class="acc-date">${shortDate(record.date)}</span></td>` +
			`<td class="acc-cell-entry"><button type="button" class="acc-open" data-acc-entry-open="${record.id}">${htmlSafe(record.memo)}</button><span class="acc-sub">${record.id} · ${htmlSafe(record.source)}</span></td>` +
			`<td class="acc-col-lines">${sideSummaryMarkup(record, 'debit')}${sideSummaryMarkup(record, 'credit')}</td>` +
			`<td class="acc-col-amount text-end"><span class="acc-amount">${asMoney(entryDebits(record))}</span></td>` +
			`<td class="acc-col-status">${statusPillMarkup(record)}</td></tr>`
		);
	}

	function paintJournal() {
		const query = hook('journal-search').value.trim();
		const status = chosenStatus();
		const inStatus = JOURNAL.filter((record) => status === 'all' || record.status === status);
		const rows = newestFirst(inStatus.filter((record) => !query || queryMatches(journalSearchText(record), query)));
		hook('journal-summary').textContent =
			rows.length === inStatus.length
				? countOf(rows.length, 'entry', 'entries')
				: `${rows.length} of ${inStatus.length} entries`;

		const body = hook('journal');
		if (!rows.length) {
			const panel = query
				? window.Basalt.emptyState({ query, noun: 'entries' })
				: '<div class="basalt-empty basalt-empty-compact"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi bi-journal-check"></i></span><h3 class="basalt-empty-title">No drafts waiting</h3><p class="basalt-empty-text">Everything in October is posted. Drafts you save show here until they are posted.</p></div>';
			body.innerHTML = `<tr class="basalt-empty-row"><td colspan="5">${panel}</td></tr>`;
			return;
		}
		body.innerHTML = rows.map(entryRowMarkup).join('');
		highlightId = null;
	}

	function wireJournalControls() {
		hook('journal-search').addEventListener('input', paintJournal);
		for (const radio of pickAll('input[name="acc-status"]', page)) {
			radio.addEventListener('change', paintJournal);
		}

		/* The drafts notice jumps to the journal with only drafts showing. */
		hook('review').addEventListener('click', () => {
			pick('#acc-status-draft', page).checked = true;
			hook('journal-search').value = '';
			paintJournal();
			const tab = document.getElementById('acc-tab-journal');
			window.bootstrap.Tab.getOrCreateInstance(tab).show();
			const stillness = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			tab.scrollIntoView({ behavior: stillness ? 'auto' : 'smooth', block: 'start' });
		});
	}

	/* Rows open their record. The name inside each row is a real button, so
     the keyboard gets there too; a click elsewhere on the row does the
     same. Buttons inside one drawer close it before opening the other. */

	function wireRowClicks() {
		document.addEventListener('click', (clickEvent) => {
			const accountButton = clickEvent.target.closest('[data-acc-account-open]');
			if (accountButton) {
				clickEvent.preventDefault();
				if (entryDrawer.contains(accountButton)) offcanvasOf(entryDrawer).hide();
				openAccountDrawer(accountButton.getAttribute('data-acc-account-open'));
				return;
			}
			const entryButton = clickEvent.target.closest('[data-acc-entry-open]');
			if (entryButton) {
				clickEvent.preventDefault();
				if (accountDrawer.contains(entryButton)) offcanvasOf(accountDrawer).hide();
				openEntryDrawer(entryButton.getAttribute('data-acc-entry-open'));
				return;
			}
			if (clickEvent.target.closest('a, button, input, select, label')) return;
			const row = clickEvent.target.closest('.acc-row');
			if (!row || !page.contains(row)) return;
			if (row.hasAttribute('data-acc-account')) openAccountDrawer(row.getAttribute('data-acc-account'));
			else if (row.hasAttribute('data-acc-entry')) openEntryDrawer(row.getAttribute('data-acc-entry'));
		});
	}

	/* The account drawer: today's balance and every posted line that moved
     it this month. */

	function accountPart(key) {
		return hookValue('a', key, accountDrawer);
	}

	function goToLinkMarkup(link, goTo) {
		link.hidden = !goTo;
		if (!goTo) return;
		link.href = goTo[0];
		link.innerHTML = `${htmlSafe(goTo[1])} <i class="bi bi-arrow-right" aria-hidden="true"></i>`;
	}

	function movementRowMarkup(record, amount) {
		return `<li class="acc-d-move"><span class="acc-d-move-date">${shortDate(record.date)}</span><span class="acc-d-move-what"><button type="button" class="acc-open" data-acc-entry-open="${record.id}">${htmlSafe(record.memo)}</button><span class="acc-sub">${record.id}</span></span><span class="acc-amount">${amount > 0 ? '+' : ''}${asMoney(amount)}</span></li>`;
	}

	function openAccountDrawer(code) {
		const ledgerAccount = accountByCode(code);
		drawerAccount = ledgerAccount;
		const kind = KINDS[ledgerAccount.kind];
		for (const name of Object.keys(KINDS))
			accountDrawer.classList.toggle(`acc-type-${name}`, name === ledgerAccount.kind);

		accountPart('icon').innerHTML = `<i class="bi bi-${kind.glyph}"></i>`;
		accountPart('name').textContent = ledgerAccount.name;
		accountPart('sub').textContent = `${ledgerAccount.code} · ${kind.label}`;
		const today = balanceToday(ledgerAccount);
		const moved = octoberMovement(ledgerAccount);
		const change = moved
			? `${moved > 0 ? 'up ' : 'down '}${asMoney(Math.abs(moved))} since the September close.`
			: 'the same as at the September close.';
		accountPart('lead').innerHTML =
			`<strong>${asMoney(today)}</strong> ${ledgerAccount.side} balance today, ${change}`;
		accountPart('detail').textContent = ledgerAccount.note;

		const moves = [];
		for (const record of oldestFirst(postedEntries())) {
			for (const line of record.lines) {
				if (line.code === ledgerAccount.code)
					moves.push(movementRowMarkup(record, lineEffect(ledgerAccount, line)));
			}
		}
		accountPart('moves').innerHTML =
			`<li class="acc-d-move acc-d-move-edge"><span class="acc-d-move-date">Sep 30</span><span class="acc-d-move-what">At the September close</span><span class="acc-amount">${asMoney(ledgerAccount.opening)}</span></li>${
				moves.length
					? moves.join('')
					: '<li class="acc-d-empty">Nothing posted to this account in October yet.</li>'
			}<li class="acc-d-move acc-d-move-total"><span class="acc-d-move-date">Today</span><span class="acc-d-move-what">Balance</span><span class="acc-amount">${asMoney(today)}</span></li>`;

		goToLinkMarkup(accountPart('link'), ledgerAccount.goTo);
		offcanvasOf(accountDrawer).show();
	}

	function wireAccountDrawer() {
		accountPart('new-entry').addEventListener('click', () => {
			const code = drawerAccount?.code;
			offcanvasOf(accountDrawer).hide();
			openEntryForm(code);
		});
	}

	/* The entry drawer: the lines of one entry and what can be done with it.
     A draft can be posted or deleted; a posted entry can only be reversed. */

	function entryPart(key) {
		return hookValue('e', key, entryDrawer);
	}

	function entryAction(key) {
		return hookValue('e-act', key, entryDrawer);
	}

	function amountCellMarkup(amount, side) {
		return `<td class="text-end" data-side="${side}">${amount ? `<span class="acc-amount">${asMoney(amount)}</span>` : ''}</td>`;
	}

	function openEntryDrawer(id) {
		const record = entryById(id);
		if (!record) return;
		drawerEntry = record;
		const isDraft = record.status === 'draft';
		entryPart('memo').textContent = record.memo;
		entryPart('sub').textContent = `${record.id} · ${fullDate(record.date)}`;
		entryPart('status').innerHTML = statusPillMarkup(record);
		entryPart('stp-text').textContent = isDraft
			? 'Saved but not posted. The balances change once it is posted.'
			: 'Part of the books. To undo it, post a reversing entry.';
		entryPart('lines').innerHTML = record.lines
			.map((line) => {
				const ledgerAccount = accountByCode(line.code);
				return `<tr><td><button type="button" class="acc-open" data-acc-account-open="${ledgerAccount.code}">${htmlSafe(ledgerAccount.name)}</button><span class="acc-sub">${ledgerAccount.code}</span></td>${amountCellMarkup(line.debit, 'Dr')}${amountCellMarkup(line.credit, 'Cr')}</tr>`;
			})
			.join('');
		entryPart('dr').innerHTML = `<span class="acc-amount">${asMoney(entryDebits(record))}</span>`;
		entryPart('cr').innerHTML = `<span class="acc-amount">${asMoney(entryCredits(record))}</span>`;
		entryPart('source').textContent = record.source;
		entryPart('by').textContent = record.author;
		entryPart('when-label').textContent = isDraft ? 'Saved' : 'Posted';
		entryPart('when').textContent = fullDate(record.stamped);
		goToLinkMarkup(entryPart('link'), record.goTo);
		entryAction('delete').hidden = !isDraft;
		entryAction('post').hidden = !isDraft;
		entryAction('reverse').hidden = isDraft;
		offcanvasOf(entryDrawer).show();
	}

	function closeEntryDrawer() {
		offcanvasOf(entryDrawer).hide();
	}

	/** The same lines with debit and credit swapped. */
	function reversedLines(lines) {
		return lines.map((line) => (line.debit ? credit(line.code, line.debit) : debit(line.code, line.credit)));
	}

	function wireEntryDrawer() {
		entryAction('post').addEventListener('click', () => {
			const record = drawerEntry;
			record.status = 'posted';
			record.stamped = TODAY;
			highlightId = record.id;
			closeEntryDrawer();
			paintAll();
			toastNote({ tone: 'success', title: `${record.id} posted`, text: 'The balances it touches are updated.' });
		});

		entryAction('delete').addEventListener('click', () => {
			const record = drawerEntry;
			JOURNAL.splice(JOURNAL.indexOf(record), 1);
			closeEntryDrawer();
			paintAll();
			toastNote({
				tone: 'success',
				title: 'Draft deleted',
				text: `${record.id}, ${record.memo}, is gone. Nothing in the books changed.`,
			});
		});

		entryAction('reverse').addEventListener('click', () => {
			const record = drawerEntry;
			const reversal = entry(
				`#${nextNumber++}`,
				TODAY,
				`Reversal of ${record.id}`,
				'Manual',
				SIGNED_IN,
				'draft',
				reversedLines(record.lines),
			);
			JOURNAL.push(reversal);
			highlightId = reversal.id;
			closeEntryDrawer();
			paintAll();
			toastNote({
				tone: 'success',
				title: 'Reversal saved as a draft',
				text: `${reversal.id} undoes ${record.id} once it is posted.`,
			});
		});
	}

	/* The new-entry dialog: a date, a description and a list of lines that
     must balance before it can be posted. */

	function formPart(key) {
		return hookValue('f', key, entryDialog);
	}

	function lineRows() {
		return [...pickAll('.acc-line', formPart('lines'))];
	}

	function accountOptionsMarkup(selected) {
		const groups = Object.keys(KINDS).map((kind) => {
			const options = sortedByCode(accountsOfKind(kind))
				.map(
					(ledgerAccount) =>
						`<option value="${ledgerAccount.code}"${ledgerAccount.code === selected ? ' selected' : ''} data-hint="${ledgerAccount.code}">${htmlSafe(ledgerAccount.name)}</option>`,
				)
				.join('');
			return `<optgroup label="${KINDS[kind].label}">${options}</optgroup>`;
		});
		return `<option value="">Choose an account</option>${groups.join('')}`;
	}

	function amountFieldMarkup(side, label, number) {
		const id = `acc-line-${side === 'dr' ? 'Dr' : 'Cr'}${number}`;
		return `<div class="acc-line-${side}"><label class="acc-line-label" for="${id}">${label}</label><input type="text" class="form-control" id="${id}" inputmode="decimal" placeholder="0.00" autocomplete="off" data-acc-line="${side}" aria-label="${label}, line ${number}"></div>`;
	}

	function appendLine(code) {
		const number = ++lineCounter;
		const row = document.createElement('li');
		row.className = 'acc-line';
		row.innerHTML = `<div class="acc-line-acct"><label class="visually-hidden" for="acc-line-acct-${number}">Account, line ${number}</label><select class="form-select" id="acc-line-acct-${number}" data-basalt-select="search" data-acc-line="acct">${accountOptionsMarkup(code)}</select></div>${amountFieldMarkup(
			'dr',
			'Debit',
			number,
		)}${amountFieldMarkup(
			'cr',
			'Credit',
			number,
		)}<button type="button" class="btn acc-line-remove" data-acc-line="remove" aria-label="Remove line ${number}"><i class="bi bi-x-lg" aria-hidden="true"></i></button>`;
		formPart('lines').appendChild(row);
		syncRemoveButtons();
		return row;
	}

	/** An entry needs two lines, so the remove buttons wait for a third. */
	function syncRemoveButtons() {
		const rows = lineRows();
		for (const row of rows)
			atLimit(hookValue('line', 'remove', row), rows.length <= 2 ? 'An entry needs at least two lines' : '');
	}

	function amountIn(input) {
		const parsed = parseFloat(String(input.value).replace(/[^0-9.]/g, ''));
		return Number.isFinite(parsed) && parsed > 0 ? roundCents(parsed) : 0;
	}

	function readLines() {
		return lineRows().map((row) => ({
			code: hookValue('line', 'acct', row).value,
			debit: amountIn(hookValue('line', 'dr', row)),
			credit: amountIn(hookValue('line', 'cr', row)),
		}));
	}

	function setBalanceState(className, html) {
		const state = formPart('state');
		state.classList.remove('is-ok', 'is-off', 'is-error');
		if (className) state.classList.add(className);
		state.innerHTML = html;
	}

	/** Adds the lines up, shows the totals and says whether they balance. */
	function paintTotals() {
		const lines = readLines();
		const debits = sumOf(lines, (line) => line.debit);
		const credits = sumOf(lines, (line) => line.credit);
		formPart('dr').textContent = asMoney(debits);
		formPart('cr').textContent = asMoney(credits);
		if (!debits && !credits) setBalanceState('', 'Add the amounts');
		else if (debits === credits)
			setBalanceState('is-ok', '<i class="bi bi-check2-circle" aria-hidden="true"></i>Balanced');
		else
			setBalanceState(
				'is-off',
				`<i class="bi bi-exclamation-circle" aria-hidden="true"></i>Off by ${asMoney(Math.abs(debits - credits))}`,
			);
		return { lines, debits, credits };
	}

	function openEntryForm(code) {
		const form = hook('entry-form', entryDialog);
		form.reset();
		for (const field of pickAll('.is-invalid', form)) field.classList.remove('is-invalid');
		formPart('lines').innerHTML = '';
		appendLine(code || '');
		appendLine('');
		formPart('date').value = TODAY;
		paintTotals();
		modalOf(entryDialog).show();
	}

	function lineProblem(used, mode, balanced) {
		if (used.length < 2) return 'Add at least two lines with amounts.';
		if (used.some((line) => !line.code)) return 'Choose an account on every line with an amount.';
		if (mode === 'post' && !balanced)
			return 'Debits and credits must match before posting. Save it as a draft for now.';
		return '';
	}

	function submitEntry(submitEvent) {
		submitEvent.preventDefault();
		const mode = submitEvent.submitter?.value === 'draft' ? 'draft' : 'post';
		const memo = formPart('memo');
		const date = formPart('date');
		const memoMissing = !memo.value.trim();
		const dateOff = !date.value || date.value < date.min || date.value > date.max;
		memo.classList.toggle('is-invalid', memoMissing);
		date.classList.toggle('is-invalid', dateOff);

		const totals = paintTotals();
		const used = totals.lines.filter((line) => line.debit || line.credit);
		const problem = lineProblem(used, mode, totals.debits === totals.credits);
		if (problem)
			setBalanceState('is-error', `<i class="bi bi-exclamation-circle" aria-hidden="true"></i>${problem}`);
		if (memoMissing) {
			memo.focus();
			return;
		}
		if (dateOff) {
			date.focus();
			return;
		}
		if (problem) {
			pick('.acc-line input', formPart('lines'))?.focus();
			return;
		}

		const lines = used.map((line) => (line.debit ? debit(line.code, line.debit) : credit(line.code, line.credit)));
		const record = entry(
			`#${nextNumber++}`,
			date.value,
			memo.value.trim(),
			'Manual',
			SIGNED_IN,
			mode === 'post' ? 'posted' : 'draft',
			lines,
		);
		record.stamped = TODAY;
		JOURNAL.push(record);
		highlightId = record.id;
		modalOf(entryDialog).hide();
		paintAll();
		showTab('acc-tab-journal');
		toastNote({
			tone: 'success',
			title: mode === 'post' ? `${record.id} posted` : `${record.id} saved as a draft`,
			text:
				mode === 'post'
					? 'The balances it touches are updated.'
					: 'Post it when it is ready; the balances wait until then.',
		});
	}

	function wireEntryForm() {
		const lines = formPart('lines');

		/* A line is a debit or a credit, never both: typing on one side
       clears the other. */
		lines.addEventListener('input', (inputEvent) => {
			const side = inputEvent.target.getAttribute('data-acc-line');
			if (side === 'dr' || side === 'cr') {
				const otherSide = hookValue(
					'line',
					side === 'dr' ? 'cr' : 'dr',
					inputEvent.target.closest('.acc-line'),
				);
				if (inputEvent.target.value) otherSide.value = '';
			}
			paintTotals();
		});
		lines.addEventListener('change', paintTotals);

		lines.addEventListener('click', (clickEvent) => {
			const removeButton = clickEvent.target.closest('[data-acc-line="remove"]');
			if (!removeButton || removeButton.disabled) return;
			const row = removeButton.closest('.acc-line');
			const neighbor = row.nextElementSibling || row.previousElementSibling;
			row.remove();
			syncRemoveButtons();
			paintTotals();
			if (neighbor) hookValue('line', 'dr', neighbor).focus();
		});

		formPart('add-line').addEventListener('click', () => {
			const row = appendLine('');
			paintTotals();
			const focusTarget = pick('.basalt-select-trigger', row) || pick('select', row);
			focusTarget?.focus();
		});

		for (const opener of hookAll('new-entry')) opener.addEventListener('click', () => openEntryForm(''));
		entryDialog.addEventListener('shown.bs.modal', () => formPart('memo').focus());
		for (const field of [formPart('memo'), formPart('date')]) {
			field.addEventListener('input', () => field.classList.remove('is-invalid'));
		}
		hook('entry-form', entryDialog).addEventListener('submit', submitEntry);
	}

	/* The new-account dialog: a kind, a five-digit code inside that kind's
     block, and a name nobody has used. */

	function accountField(key) {
		return hookValue('n', key, accountDialog);
	}

	/** The next free code in the kind's block, a hundred above the last. */
	function suggestCode(kind) {
		const taken = accountsOfKind(kind).map((ledgerAccount) => Number(ledgerAccount.code));
		let candidate = Math.max(...taken) + 100;
		while (taken.includes(candidate)) candidate += 100;
		return String(Math.min(candidate, KINDS[kind].highest));
	}

	function paintCodeHelp() {
		const kind = KINDS[accountField('type').value];
		accountField('code-help').textContent = `${kind.label}: ${kind.lowest}–${kind.highest}`;
	}

	function codeProblem(code, kind) {
		if (!/^\d{5}$/.test(code)) return 'Use five digits.';
		if (Number(code) < kind.lowest || Number(code) > kind.highest)
			return `${kind.label} use codes from ${kind.lowest} to ${kind.highest}.`;
		const taken = accountByCode(code);
		return taken ? `${code} is already ${taken.name}.` : '';
	}

	function nameProblem(name) {
		if (!name) return 'Give the account a name.';
		const taken = LEDGER.some((ledgerAccount) => ledgerAccount.name.toLowerCase() === name.toLowerCase());
		return taken ? 'There is already an account with this name.' : '';
	}

	function submitAccount(submitEvent) {
		submitEvent.preventDefault();
		const kindName = accountField('type').value;
		const kind = KINDS[kindName];
		const code = accountField('code').value.trim();
		const name = accountField('name').value.trim();
		const badCode = codeProblem(code, kind);
		const badName = nameProblem(name);
		accountField('code-err').textContent = badCode;
		accountField('name-err').textContent = badName;
		accountField('code').classList.toggle('is-invalid', Boolean(badCode));
		accountField('name').classList.toggle('is-invalid', Boolean(badName));
		if (badCode) {
			accountField('code').focus();
			return;
		}
		if (badName) {
			accountField('name').focus();
			return;
		}

		LEDGER.push(
			account(code, kindName, name, accountField('detail').value.trim() || `Added today by ${SIGNED_IN}`, 0),
		);
		highlightId = code;
		modalOf(accountDialog).hide();
		hook('chart-search').value = '';
		chooseKind('all');
		paintAll();
		showTab('acc-tab-chart');
		toastNote({
			tone: 'success',
			title: `${name} added`,
			text: `Code ${code}, under ${kind.label}. It is ready for entries.`,
		});
	}

	function wireAccountForm() {
		const form = hook('account-form', accountDialog);

		accountField('type').addEventListener('change', () => {
			accountField('code').value = suggestCode(accountField('type').value);
			accountField('code').classList.remove('is-invalid');
			paintCodeHelp();
		});

		accountDialog.addEventListener('show.bs.modal', () => {
			form.reset();
			for (const field of pickAll('.is-invalid', form)) field.classList.remove('is-invalid');
			accountField('type').value = 'expenses';
			accountField('code').value = suggestCode('expenses');
			paintCodeHelp();
		});
		accountDialog.addEventListener('shown.bs.modal', () => accountField('name').focus());

		for (const field of [accountField('name'), accountField('code')]) {
			field.addEventListener('input', () => field.classList.remove('is-invalid'));
		}
		form.addEventListener('submit', submitAccount);
	}

	start();

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
