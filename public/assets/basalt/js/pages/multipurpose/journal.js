/**
 * Manual journal for the Fieldline books, behind journal.html (the queue and
 * the full list) and journal-entry-details.html (a single entry). These are
 * the entries finance types in by hand; billing, bank and payroll post their
 * own. An entry starts as a draft, goes up for approval, then posts, and a
 * posted one is undone by a mirror entry rather than edited.
 *
 * Both pages share one ledger, kept in sessionStorage for the visit, so an
 * approval on one page shows on the other. To wire in real data, swap CHART
 * for your chart of accounts and STARTER_ENTRIES for your journal; the shape
 * of each record is described above them.
 */
(() => {
	'use strict';

	const queueHost = pick('[data-jn-root]');
	const entryHost = pick('[data-jd-root]');
	if (!queueHost && !entryHost) return;

	/* The date the demo treats as today, and the person signed in. That person
     is also the approver for everyone else's entries. */
	const DEMO_TODAY = '2026-10-09';
	const SIGNED_IN = 'John Armstrong';

	/* The demo clock: each action stamps a time three minutes after the last,
     counting from 14:05 on DEMO_TODAY. The step count survives reloads. */
	let clockSteps = 0;

	const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const FULL_MONTH_NAMES = [
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

	/* The finance team, with the avatar tone and job title shown beside a name. */
	const TEAM = {
		'John Armstrong': { tone: 1, role: 'Finance lead' },
		'Gregory Devin': { tone: 2, role: 'Senior accountant' },
		'Hope Stout': { tone: 3, role: 'Payables' },
		'Dawn Fischer': { tone: 4, role: 'Bookkeeper' },
		'Marshall Ashby': { tone: 5, role: 'Payroll' },
	};

	/* Account groups in the order the account picker lists them. */
	const ACCOUNT_GROUPS = {
		assets: 'Assets',
		liabilities: 'Liabilities',
		equity: 'Equity',
		revenue: 'Revenue',
		expenses: 'Expenses',
	};

	/* The chart of accounts, grouped and coded exactly as on the Accounting
     page so a code means the same thing in both places. */
	const CHART = Object.entries({
		assets: {
			10100: 'Operating Account',
			10200: 'Payroll Account',
			10300: 'Reserve Savings',
			11100: 'Accounts Receivable',
			11500: 'Prepaid Expenses',
			12100: 'Prepaid SMS Credit',
			15100: 'Computers & Equipment',
			15900: 'Accumulated Depreciation',
		},
		liabilities: {
			20100: 'Accounts Payable',
			20300: 'Company Cards',
			21100: 'Sales Tax Payable',
			21300: 'Payroll Taxes Payable',
			22100: 'Deferred Revenue',
		},
		equity: { 30100: 'Share Capital', 33100: 'Retained Earnings' },
		revenue: { 41100: 'Subscription Revenue', 41300: 'Add-on Revenue', 41500: 'Onboarding & Training' },
		expenses: {
			51100: 'Hosting & Infrastructure',
			51300: 'SMS & Phone Line Costs',
			51500: 'Payment Processing Fees',
			61100: 'Salaries & Benefits',
			62100: 'Rent & Office',
			62300: 'Software & Tools',
			63100: 'Marketing & Events',
			64100: 'Professional Fees',
			66100: 'Depreciation',
			69100: 'Income Tax',
		},
	}).flatMap(([group, accounts]) => Object.entries(accounts).map(([code, name]) => ({ code, type: group, name })));

	/* The account picker's options never change, so they are built once. */
	const ACCOUNT_MENU = `<option value="">Choose an account</option>${Object.entries(ACCOUNT_GROUPS)
		.map(([group, heading]) => {
			const options = CHART.filter((account) => account.type === group)
				.map(
					(account) =>
						`<option value="${account.code}" data-hint="${account.code}">${htmlSafe(account.name)}</option>`,
				)
				.join('');
			return `<optgroup label="${heading}">${options}</optgroup>`;
		})
		.join('')}`;

	/* How each status reads in full, in the compact table pill, and its tone. */
	const STATES = {
		waiting: { label: 'Waiting for approval', short: 'Waiting', tone: 'warning' },
		draft: { label: 'Draft', short: 'Draft', tone: '' },
		posted: { label: 'Posted', short: 'Posted', tone: 'success' },
		reversed: { label: 'Reversed', short: 'Reversed', tone: 'info' },
	};

	/* What each kind of trail step says on the details page, and its dot color. */
	const TRAIL_STEPS = {
		created: { tone: 'neutral', describe: (step) => `Drafted by ${step.by}` },
		submitted: { tone: 'info', describe: (step) => `Submitted for approval by ${step.by}` },
		sentback: { tone: 'warning', describe: (step) => `Sent back by ${step.by}` },
		approved: { tone: 'success', describe: (step) => `Approved and posted by ${step.by}` },
		reversed: { tone: 'danger', describe: (step) => `Reversed by ${step.by}` },
	};

	/* A button's action, as the status it moves the entry to and the trail
     step it leaves behind. */
	const MOVES = {
		approve: ['posted', 'approved'],
		sendback: ['draft', 'sentback'],
		submit: ['waiting', 'submitted'],
	};

	/* The action buttons used in the drawer footer and the details header. */
	const ACTION_BUTTONS = {
		sendback: { look: 'btn-outline-secondary', icon: 'bi-reply', label: 'Send back' },
		approve: { look: 'btn-primary', icon: 'bi-check2', label: 'Approve' },
		submit: { look: 'btn-primary', icon: 'bi-send', label: 'Submit for approval' },
		reverse: { look: 'btn-outline-secondary', icon: 'bi-arrow-counterclockwise', label: 'Reverse' },
	};

	/* The sample journal. Each record carries its lines as [code, debit,
     credit], its attachments and notes, and a trail of steps written here as
     [kind, person, time, note] and stored as objects. */
	const STARTER_ENTRIES = [
		{
			id: '#419',
			status: 'draft',
			date: '2026-10-09',
			by: SIGNED_IN,
			memo: 'Sales commissions, September',
			lines: [debit('61100', 23650), credit('10200', 23650)],
			files: [attachment('commissions-sep-2026.xlsx', '52 KB')],
			notes: [
				note(SIGNED_IN, '2026-10-09T08:30', 'Holding this until the last two Sales-led deals are confirmed.'),
			],
			trail: [['created', SIGNED_IN, '2026-10-09T08:22']],
		},
		{
			id: '#418',
			status: 'waiting',
			date: '2026-10-09',
			by: 'Dawn Fischer',
			memo: 'Audit fees, third quarter',
			lines: [debit('64100', 18500), credit('20100', 18500)],
			files: [attachment('harlow-audit-q3-estimate.pdf', '184 KB')],
			notes: [
				note(
					'Dawn Fischer',
					'2026-10-09T09:12',
					'Harlow & Reid quoted $18,500 for the Q3 review. Their bill comes in November.',
				),
			],
			trail: [
				['created', 'Dawn Fischer', '2026-10-09T09:05'],
				['submitted', 'Dawn Fischer', '2026-10-09T09:14'],
			],
		},
		{
			id: '#417',
			status: 'waiting',
			date: '2026-10-08',
			by: 'Dawn Fischer',
			memo: 'Onboarding fees billed ahead',
			lines: [debit('41500', 7200), credit('22100', 7200)],
			files: [attachment('onboarding-schedule-oct.xlsx', '38 KB')],
			notes: [
				note(
					'Dawn Fischer',
					'2026-10-08T15:33',
					'Three customers paid for November setup projects. Moving it to deferred until the work is done.',
				),
			],
			trail: [
				['created', 'Dawn Fischer', '2026-10-08T15:20'],
				['submitted', 'Dawn Fischer', '2026-10-08T15:31'],
			],
		},
		{
			id: '#416',
			status: 'waiting',
			date: '2026-10-07',
			by: 'Hope Stout',
			memo: 'Laptops for the support team',
			lines: [debit('15100', 14280), credit('20300', 14280)],
			files: [attachment('brightline-order-55120.pdf', '96 KB')],
			notes: [
				note(
					'Hope Stout',
					'2026-10-07T16:40',
					'Twelve laptops for the new support hires, paid on the company card.',
				),
			],
			trail: [
				['created', 'Hope Stout', '2026-10-07T16:30'],
				['submitted', 'Hope Stout', '2026-10-07T16:42'],
			],
		},
		{
			id: '#415',
			status: 'draft',
			date: '2026-10-07',
			by: 'Dawn Fischer',
			memo: 'Card fees moved out of software',
			lines: [debit('51500', 1284.5), credit('62300', 1284.5)],
			files: [attachment('card-statement-sep.pdf', '146 KB')],
			notes: [],
			trail: [
				['created', 'Dawn Fischer', '2026-10-06T14:10'],
				['submitted', 'Dawn Fischer', '2026-10-06T14:12'],
				[
					'sentback',
					'Gregory Devin',
					'2026-10-07T09:30',
					'Split it: $842.10 of this is hosting, not card fees.',
				],
			],
		},
		{
			id: '#414',
			status: 'waiting',
			date: '2026-10-08',
			by: 'Gregory Devin',
			memo: 'OnSite Expo Evanston stand',
			lines: [debit('63100', 11800), credit('20100', 11800)],
			files: [attachment('onsite-expo-stand-invoice.pdf', '212 KB')],
			notes: [],
			trail: [
				['created', 'Gregory Devin', '2026-10-08T11:02'],
				['submitted', 'Gregory Devin', '2026-10-08T11:05'],
			],
		},
		{
			id: '#413',
			status: 'waiting',
			date: '2026-10-08',
			by: 'Gregory Devin',
			memo: 'Insurance used in October',
			lines: [debit('62100', 2400), credit('11500', 2400)],
			files: [attachment('insurance-schedule-2026.xlsx', '24 KB')],
			notes: [],
			trail: [
				['created', 'Gregory Devin', '2026-10-08T10:38'],
				['submitted', 'Gregory Devin', '2026-10-08T10:41'],
			],
		},
		{
			id: '#407',
			status: 'posted',
			date: '2026-10-06',
			by: SIGNED_IN,
			approvedBy: 'Gregory Devin',
			memo: 'Cash moved to the payroll account',
			lines: [debit('10200', 260000), credit('10100', 260000)],
			files: [attachment('northbank-transfer-1006.pdf', '41 KB')],
			notes: [
				note(
					SIGNED_IN,
					'2026-10-06T08:55',
					'Covers the October 1 to 15 payroll and the payroll taxes due on the 15th.',
				),
			],
			trail: [
				['created', SIGNED_IN, '2026-10-06T08:50'],
				['submitted', SIGNED_IN, '2026-10-06T08:52'],
				['approved', 'Gregory Devin', '2026-10-06T09:15'],
			],
		},
		{
			id: '#404',
			status: 'posted',
			date: '2026-10-02',
			by: 'Gregory Devin',
			approvedBy: SIGNED_IN,
			memo: 'Office rent, October',
			lines: [debit('62100', 21300), credit('10100', 21300)],
			files: [attachment('lakeside-lease-oct.pdf', '128 KB')],
			notes: [],
			trail: [
				['created', 'Gregory Devin', '2026-10-01T16:05'],
				['submitted', 'Gregory Devin', '2026-10-01T16:06'],
				['approved', SIGNED_IN, '2026-10-02T08:40'],
			],
		},
		{
			id: '#400',
			status: 'posted',
			date: '2026-10-01',
			by: 'Hope Stout',
			approvedBy: SIGNED_IN,
			memo: 'Design tools, annual plan',
			lines: [debit('11500', 12000), debit('62300', 1000), credit('20300', 13000)],
			files: [attachment('figment-annual-receipt.pdf', '64 KB')],
			notes: [
				note(
					'Hope Stout',
					'2026-10-01T11:20',
					'Twelve seats for a year. One month is used now, the rest is prepaid.',
				),
			],
			trail: [
				['created', 'Hope Stout', '2026-10-01T11:12'],
				['submitted', 'Hope Stout', '2026-10-01T11:21'],
				['approved', SIGNED_IN, '2026-10-01T14:02'],
			],
		},
		{
			id: '#399',
			status: 'posted',
			date: '2026-09-30',
			by: 'Hope Stout',
			approvedBy: SIGNED_IN,
			memo: 'Insurance for the fourth quarter',
			lines: [debit('11500', 7200), credit('10100', 7200)],
			files: [attachment('policy-renewal-q4.pdf', '310 KB')],
			notes: [],
			trail: [
				['created', 'Hope Stout', '2026-09-30T10:02'],
				['submitted', 'Hope Stout', '2026-09-30T10:04'],
				['approved', SIGNED_IN, '2026-09-30T13:45'],
			],
		},
		{
			id: '#398',
			status: 'posted',
			date: '2026-09-30',
			by: 'Dawn Fischer',
			approvedBy: SIGNED_IN,
			memo: 'Hosting credit from Stratus Cloud',
			lines: [debit('20300', 3600), credit('51100', 3600)],
			files: [attachment('stratus-credit-note-0930.pdf', '58 KB')],
			notes: [],
			trail: [
				['created', 'Dawn Fischer', '2026-09-30T09:15'],
				['submitted', 'Dawn Fischer', '2026-09-30T09:17'],
				['approved', SIGNED_IN, '2026-09-30T13:41'],
			],
		},
		{
			id: '#396',
			status: 'posted',
			date: '2026-09-29',
			by: 'Gregory Devin',
			approvedBy: SIGNED_IN,
			memo: 'OnSite Expo deposit',
			lines: [debit('11500', 5000), credit('10100', 5000)],
			files: [],
			notes: [],
			trail: [
				['created', 'Gregory Devin', '2026-09-29T15:30'],
				['submitted', 'Gregory Devin', '2026-09-29T15:31'],
				['approved', SIGNED_IN, '2026-09-29T17:02'],
			],
		},
		{
			id: '#395',
			status: 'posted',
			date: '2026-09-25',
			by: 'Hope Stout',
			approvedBy: 'Gregory Devin',
			memo: 'Contract review fees',
			lines: [debit('64100', 6750), credit('20100', 6750)],
			files: [attachment('calder-legal-sep.pdf', '87 KB')],
			notes: [],
			trail: [
				['created', 'Hope Stout', '2026-09-25T13:50'],
				['submitted', 'Hope Stout', '2026-09-25T13:52'],
				['approved', 'Gregory Devin', '2026-09-25T16:20'],
			],
		},
		{
			id: '#393',
			status: 'posted',
			date: '2026-09-22',
			by: 'Hope Stout',
			approvedBy: SIGNED_IN,
			memo: 'Office chairs and desks',
			lines: [debit('15100', 9860), credit('20300', 9860)],
			files: [attachment('northdesk-order-7781.pdf', '102 KB')],
			notes: [],
			trail: [
				['created', 'Hope Stout', '2026-09-22T10:10'],
				['submitted', 'Hope Stout', '2026-09-22T10:12'],
				['approved', SIGNED_IN, '2026-09-22T11:30'],
			],
		},
		{
			id: '#392',
			status: 'posted',
			date: '2026-09-21',
			by: 'Marshall Ashby',
			approvedBy: SIGNED_IN,
			memo: 'Employer taxes, September bonus',
			lines: [debit('61100', 1840.25), credit('21300', 1500), credit('10200', 340.25)],
			files: [attachment('bonus-taxes-sep.xlsx', '19 KB')],
			notes: [],
			trail: [
				['created', 'Marshall Ashby', '2026-09-21T09:40'],
				['submitted', 'Marshall Ashby', '2026-09-21T09:44'],
				['approved', SIGNED_IN, '2026-09-21T12:05'],
			],
		},
		{
			id: '#389',
			status: 'posted',
			date: '2026-09-19',
			by: 'Gregory Devin',
			approvedBy: SIGNED_IN,
			reverses: '#388',
			memo: 'Reversal of #388',
			lines: [debit('20100', 4950), credit('63100', 4950)],
			files: [],
			notes: [],
			trail: [
				['created', 'Gregory Devin', '2026-09-19T10:08'],
				['approved', SIGNED_IN, '2026-09-19T10:30'],
			],
		},
		{
			id: '#388',
			status: 'reversed',
			date: '2026-09-18',
			by: 'Gregory Devin',
			approvedBy: SIGNED_IN,
			reversal: '#389',
			memo: 'Design contractor, September',
			lines: [debit('63100', 4950), credit('20100', 4950)],
			files: [attachment('studio-pell-invoice-212.pdf', '75 KB')],
			notes: [
				note(
					'Gregory Devin',
					'2026-09-19T10:05',
					'Booked twice. The bill was already in from the payables feed.',
				),
			],
			trail: [
				['created', 'Gregory Devin', '2026-09-18T14:00'],
				['submitted', 'Gregory Devin', '2026-09-18T14:02'],
				['approved', SIGNED_IN, '2026-09-18T16:10'],
				['reversed', 'Gregory Devin', '2026-09-19T10:08'],
			],
		},
	].map((record) => ({
		...record,
		trail: record.trail.map(([kind, person, when, remark]) => trailStep(kind, person, when, remark)),
	}));

	/* The ledger both pages work on, restored from this visit when there is
     one. A private window that refuses storage simply starts fresh. */
	const STORE_KEY = 'basalt-journal';
	const ledger = loadLedger();

	start();

	/* Each page mounts only the part its own markup asks for. */

	function start() {
		if (queueHost) mountJournal(queueHost);
		if (entryHost) mountEntry(entryHost);
	}

	/**
	 * journal.html: the status tiles, the approval queue, the full list with
	 * its search and filter, the quick-view drawer and the new-entry dialog.
	 * Approving or sending back happens right in the row, with Undo on the toast.
	 */
	function mountJournal(root) {
		const ui = {
			tiles: pick('[data-jn-glance]', root),
			queue: pick('[data-jn-waiting]', root),
			queueTable: pick('[data-jn-waiting-table]', root),
			queueEmpty: pick('[data-jn-waiting-empty]', root),
			queueSummary: pick('[data-jn-waiting-sub]', root),
			selectAll: pick('[data-jn-pick-all]', root),
			approveSelected: pick('[data-jn-approve-picked]', root),
			rows: pick('[data-jn-all]', root),
			rowsTable: pick('[data-jn-all-table]', root),
			rowsEmpty: pick('[data-jn-all-empty]', root),
			rowsSummary: pick('[data-jn-all-sub]', root),
			rowsCount: pick('[data-jn-all-foot]', root),
			searchBox: pick('[data-jn-search]', root),
			statusFilter: pick('[data-jn-filter]', root),
			liveRegion: pick('[data-jn-live]', root),
		};
		const view = { query: '', filter: 'all', selected: new Set(), highlight: null, peeking: null };
		const peekPanel = document.getElementById('jn-entry');
		const composer = document.getElementById('jn-new');
		const composerForm = pick('[data-jn-form]', composer);
		let lineCounter = 0;

		/* Each click target in the page body, checked in this order. The row
       itself comes last so its buttons and links keep their own behavior. */
		const clickRoutes = [
			['[data-jn-new]', () => openComposer()],
			[
				'[data-jn-export]',
				() =>
					notify({
						tone: 'success',
						icon: 'bi-file-earmark-spreadsheet',
						title: 'Export ready',
						text: `journal-2026-10.csv has ${countOf(ledger.length, 'entry', 'entries')}, one row per line.`,
					}),
			],
			['[data-jn-tile]', (button) => applyTile(button.getAttribute('data-jn-tile'))],
			['[data-jn-clear]', () => clearFilters()],
			['[data-jn-approve-picked]', () => approveSelection()],
			[
				'[data-jn-act]',
				(button) => {
					const entry = entryById(button.closest('tr').getAttribute('data-jn-entry'));
					if (entry) runMove(entry, button.getAttribute('data-jn-act'), false);
				},
			],
			['[data-jn-quick]', (button) => openPeek(button.getAttribute('data-jn-quick'))],
		];

		root.addEventListener('click', (event) => {
			for (const [selector, handle] of clickRoutes) {
				const hit = event.target.closest(selector);
				if (hit) return handle(hit);
			}
			const row = event.target.closest('tr[data-jn-entry]');
			if (!row || event.target.closest('a, button, input, label')) return;
			const entry = entryById(row.getAttribute('data-jn-entry'));
			if (entry) followLink(entryHref(entry), event);
		});

		root.addEventListener('change', (event) => {
			const input = event.target;
			if (input === ui.selectAll) return toggleWholeQueue(input.checked);
			if (input.hasAttribute('data-jn-pick')) return toggleOne(input);
			if (input.name === 'jn-status') {
				view.filter = input.value;
				paintTiles();
				paintList();
			}
		});

		ui.searchBox.addEventListener('input', () => {
			view.query = ui.searchBox.value;
			paintList();
		});

		peekPanel.addEventListener('click', (event) => {
			const button = event.target.closest('[data-jn-d-act]');
			const entry = button && entryById(view.peeking);
			if (!entry) return;
			peekDrawer().hide();
			runMove(entry, button.getAttribute('data-jn-d-act'), true);
		});

		wireComposer();
		repaint();
		/* The four counts rise from zero once, as the page opens. */
		window.Basalt.countUp?.(pickAll('.jn-tile-value', ui.tiles));

		/* Painting turns the ledger into tiles, queue rows and list rows. */

		function repaint() {
			paintTiles();
			paintQueue();
			paintList();
			if (view.peeking && peekPanel.classList.contains('show')) paintPeek();
			persist();
		}

		function paintTiles() {
			const withStatus = (status) => ledger.filter((entry) => entry.status === status);
			const sumOf = (entries) => formatAmount(entries.reduce((sum, entry) => sum + debitSum(entry), 0));
			const reversed = withStatus('reversed');
			const groups = {
				waiting: ['Waiting for approval', withStatus('waiting')],
				draft: ['Drafts', withStatus('draft')],
				posted: ['Posted in October', withStatus('posted').filter((entry) => entry.date >= '2026-10-01')],
				reversed: ['Reversed', reversed],
			};
			ui.tiles.innerHTML = Object.entries(groups)
				.map(([key, [label, entries]]) => {
					const footnote = key === 'reversed' && !reversed.length ? 'None this period' : sumOf(entries);
					return `<li><button type="button" class="jn-tile jn-tile-${key}" data-jn-tile="${key}" aria-pressed="${view.filter === key}"><span class="jn-tile-label">${label}</span><span class="jn-tile-value">${entries.length}</span><span class="jn-tile-sub">${footnote}</span></button></li>`;
				})
				.join('');
		}

		function paintQueue() {
			const queued = ledger
				.filter((entry) => entry.status === 'waiting')
				.sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id));
			const queuedIds = new Set(queued.map((entry) => entry.id));
			for (const id of [...view.selected]) {
				if (!queuedIds.has(id)) view.selected.delete(id);
			}

			ui.queue.innerHTML = queued.map(queueRow).join('');
			armTooltips(ui.queue);
			ui.queueTable.hidden = !queued.length;
			ui.queueEmpty.hidden = queued.length > 0;
			ui.queueSummary.textContent = queued.length
				? `${countOf(queued.length, 'entry', 'entries')} for ${formatAmount(queued.reduce((sum, entry) => sum + debitSum(entry), 0))}, oldest first. Nothing reaches the books until it is approved.`
				: 'Entries land here when someone submits them.';

			const chosen = view.selected.size;
			ui.selectAll.disabled = !queued.length;
			ui.selectAll.checked = queued.length > 0 && chosen === queued.length;
			ui.selectAll.indeterminate = chosen > 0 && chosen < queued.length;
			ui.approveSelected.hidden = !chosen;
			pick('[data-jn-picked-label]', ui.approveSelected).textContent = `Approve ${chosen} selected`;
		}

		function paintList() {
			const shown = filteredEntries();
			ui.rows.innerHTML = shown.map(listRow).join('');
			armTooltips(ui.rows);
			ui.rowsTable.hidden = !shown.length;
			ui.rowsEmpty.hidden = shown.length > 0;

			const span = ledger.some((entry) => entry.date < '2026-10-01') ? 'September and October' : 'October';
			ui.rowsSummary.textContent = `${countOf(ledger.length, 'manual entry', 'manual entries')} in ${span}, newest first. Open a row for the whole entry.`;
			ui.rowsCount.hidden = !shown.length;
			ui.rowsCount.textContent =
				shown.length === ledger.length
					? `Showing all ${countOf(shown.length, 'entry', 'entries')}`
					: `Showing ${shown.length} of ${countOf(ledger.length, 'entry', 'entries')}`;
		}

		function filteredEntries() {
			const query = view.query.trim();
			const searchable = (entry) =>
				[
					entry.id,
					entry.memo,
					entry.by,
					accountsSearchText(entry),
					STATES[entry.status].label,
					formatAmount(debitSum(entry)),
				].join(' ');
			return ledger
				.filter((entry) => view.filter === 'all' || entry.status === view.filter)
				.filter((entry) => !query || queryHits(searchable(entry), query))
				.sort(byNewest);
		}

		/* Both tables build their rows from the same shell, cell and button helpers. */

		function queueRow(entry) {
			const memo = htmlSafe(entry.memo);
			const owner = htmlSafe(entry.by.split(' ')[0]);
			const checkbox = `<input class="form-check-input" type="checkbox" aria-label="Select ${memo}" data-jn-pick="${entry.id}"${view.selected.has(entry.id) ? ' checked' : ''}>`;
			const buttons = [
				`<button type="button" class="btn btn-outline-secondary btn-sm" data-jn-act="sendback" aria-label="Send back: ${memo}"${tooltipAttrs(`Return it to ${owner}`)}>Send back</button>`,
				`<button type="button" class="btn btn-outline-primary btn-sm" data-jn-act="approve" aria-label="Approve: ${memo}">Approve</button>`,
				peekButton(entry),
			].join('');
			return rowShell(entry, [
				cell('pick', checkbox, 'jn-pick'),
				cell('desc', titleLink(entry), 'jn-ellip'),
				cell('accts', accountsMarkup(entry), 'jn-ellip jn-quiet'),
				cell('amount', formatAmount(debitSum(entry)), 'text-end jn-num'),
				cell('who', personChip(entry.by)),
				cell('act', `<span class="jn-acts">${buttons}</span>`, 'text-end'),
			]);
		}

		function listRow(entry) {
			const fullPage = `<a class="btn btn-icon btn-sm" href="${entryHref(entry)}" aria-label="Open full page: ${htmlSafe(entry.memo)}"${tooltipAttrs('Open full page')}><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>`;
			return rowShell(entry, [
				cell('date', shortDate(entry.date), 'jn-quiet'),
				cell('ref', entry.id, 'jn-ref'),
				cell('desc', titleLink(entry), 'jn-ellip'),
				cell('accts', accountsMarkup(entry), 'jn-ellip jn-quiet'),
				cell('amount', formatAmount(debitSum(entry)), 'text-end jn-num'),
				cell('status', stateBadge(entry.status, true)),
				cell('who', personChip(entry.by)),
				cell('go', `<span class="basalt-row-actions">${peekButton(entry)}${fullPage}</span>`, 'text-end'),
			]);
		}

		function rowShell(entry, cells) {
			return `<tr data-jn-entry="${entry.id}" class="jn-row${view.highlight === entry.id ? ' is-fresh' : ''}">${cells.join('')}</tr>`;
		}

		function cell(name, content, classes) {
			return `<td${classes ? ` class="${classes}"` : ''} data-cell="${name}">${content}</td>`;
		}

		function titleLink(entry) {
			return `<a class="jn-link" href="${entryHref(entry)}">${htmlSafe(entry.memo)}</a>`;
		}

		function peekButton(entry) {
			return `<button type="button" class="btn btn-icon btn-sm" data-jn-quick="${entry.id}" aria-label="Quick view: ${htmlSafe(entry.memo)}"${tooltipAttrs('Quick view')}><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>`;
		}

		/* Tiles, the status filter and the queue checkboxes change what is shown or chosen. */

		function applyTile(key) {
			view.filter = view.filter === key ? 'all' : key;
			const radio = pick(`input[value="${view.filter}"]`, ui.statusFilter);
			if (radio) radio.checked = true;
			paintTiles();
			paintList();
			if (view.filter !== 'all') {
				const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
				pick('#jn-all').scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
			}
			say(
				view.filter === 'all'
					? 'Showing every entry.'
					: `Showing ${STATES[view.filter].label.toLowerCase()} entries.`,
			);
		}

		function clearFilters() {
			view.query = '';
			view.filter = 'all';
			ui.searchBox.value = '';
			pick('input[value="all"]', ui.statusFilter).checked = true;
			paintTiles();
			paintList();
			ui.searchBox.focus();
		}

		function toggleWholeQueue(on) {
			if (on) {
				for (const entry of ledger) {
					if (entry.status === 'waiting') view.selected.add(entry.id);
				}
			} else {
				view.selected.clear();
			}
			paintQueue();
		}

		/* Repainting replaces the checkbox, so focus goes back to its stand-in. */
		function toggleOne(box) {
			const id = box.getAttribute('data-jn-pick');
			if (box.checked) view.selected.add(id);
			else view.selected.delete(id);
			paintQueue();
			pick(`[data-jn-pick="${id}"]`, ui.queue)?.focus();
		}

		/* Approvals and send-backs happen in place and can be undone from the toast. */

		/**
		 * Applies one row or drawer action. The row drops out of the queue, focus
		 * moves to the next row's Approve button, and the toast offers Undo.
		 */
		function runMove(entry, action, fromPeek) {
			const position = pickAll('tr', ui.queue).findIndex((row) => row.getAttribute('data-jn-entry') === entry.id);
			const saved = cloneEntry(entry);
			moveEntry(entry, action);
			view.selected.delete(entry.id);
			repaint();
			if (!fromPeek && position > -1) focusQueueRow(position);

			const owner = entry.by.split(' ')[0];
			const wording = {
				approve: ['success', 'bi-check2-circle', 'approved', `${entry.memo} is posted to the books. `],
				sendback: ['info', 'bi-reply', 'sent back', `${entry.memo} is a draft again, with ${owner}. `],
				submit: ['success', 'bi-send', 'submitted', `${entry.memo} is waiting for approval. `],
			}[action];
			const [tone, icon, verb, lead] = wording;
			notify({
				tone,
				icon,
				title: `${entry.id} ${verb}`,
				text: lead + queueRemainder(),
				actions: [
					{
						label: 'Undo',
						onClick() {
							rollBack(entry, saved);
							repaint();
							say(`Undone: ${entry.memo} is back where it was.`);
						},
					},
				],
			});
		}

		function approveSelection() {
			const chosen = ledger.filter((entry) => view.selected.has(entry.id));
			if (!chosen.length) return;
			const saved = chosen.map((entry) => [entry, cloneEntry(entry)]);
			for (const entry of chosen) moveEntry(entry, 'approve');
			view.selected.clear();
			repaint();
			pick('#jn-waiting-title').focus({ preventScroll: true });

			const amount = formatAmount(chosen.reduce((sum, entry) => sum + debitSum(entry), 0));
			notify({
				tone: 'success',
				icon: 'bi-check2-all',
				title: `${countOf(chosen.length, 'entry', 'entries')} approved`,
				text: `${amount} posted to the books. ${queueRemainder()}`,
				actions: [
					{
						label: 'Undo',
						onClick() {
							for (const [entry, earlier] of saved) rollBack(entry, earlier);
							repaint();
							say('Approvals undone.');
						},
					},
				],
			});
		}

		function queueRemainder() {
			const left = ledger.filter((entry) => entry.status === 'waiting').length;
			return left ? `${countOf(left, 'entry', 'entries')} left to approve.` : 'Nothing left to approve.';
		}

		function focusQueueRow(position) {
			const queueRows = pickAll('tr', ui.queue);
			const target = queueRows[Math.min(position, queueRows.length - 1)];
			const approve = target && pick('[data-jn-act="approve"]', target);
			(approve || pick('#jn-waiting-title')).focus({ preventScroll: true });
		}

		/* The quick view is refilled each time it opens or its entry changes. */

		function peekDrawer() {
			return window.bootstrap.Offcanvas.getOrCreateInstance(peekPanel);
		}

		function openPeek(id) {
			view.peeking = id;
			paintPeek();
			peekDrawer().show();
		}

		function peekPart(name) {
			return pick(`[data-jn-d="${name}"]`, peekPanel);
		}

		function paintPeek() {
			const entry = entryById(view.peeking);
			if (!entry) return;
			peekPart('title').textContent = entry.memo;
			peekPart('sub').textContent = `${entry.id} · ${fullDate(entry.date)}`;
			peekPart('full').href = entryHref(entry);
			peekPart('body').innerHTML = peekState(entry) + peekLines(entry) + peekFacts(entry);

			const closer =
				'<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="offcanvas">Close</button>';
			const footers = {
				waiting: () => actionButtons(['sendback', 'approve'], 'data-jn-d-act', false),
				draft: () => closer + actionButtons(['submit'], 'data-jn-d-act', false),
			};
			peekPart('foot').innerHTML = footers[entry.status]?.() ?? closer;
		}

		function peekState(entry) {
			return `<div class="jn-d-section"><div class="jn-d-state">${stateBadge(entry.status)}<p class="jn-d-text">${htmlSafe(standing(entry))}</p></div></div>`;
		}

		function peekLines(entry) {
			const head =
				'<thead><tr><th scope="col">Account</th><th scope="col" class="text-end">Debit</th><th scope="col" class="text-end">Credit</th></tr></thead>';
			const foot = `<tfoot><tr><th scope="row">Total</th><td class="text-end">${formatAmount(debitSum(entry))}</td><td class="text-end">${formatAmount(creditSum(entry))}</td></tr></tfoot>`;
			return `<section class="jn-d-section" aria-labelledby="jn-d-lines"><h3 class="jn-d-heading" id="jn-d-lines">Lines</h3><table class="table jn-d-lines"><caption class="visually-hidden">Debit and credit lines</caption>${head}<tbody>${lineRows(entry, false)}</tbody>${foot}</table></section>`;
		}

		function peekFacts(entry) {
			const waiting = entry.status === 'waiting';
			let signer = '<span class="jn-quiet">Not yet</span>';
			if (waiting) signer = personChip(approverFor(entry));
			else if (entry.approvedBy) signer = personChip(entry.approvedBy);
			const attached = entry.files.length
				? entry.files.map((doc) => htmlSafe(doc.name)).join(', ')
				: '<span class="jn-quiet">None</span>';
			const pairs = [
				['Made by', personChip(entry.by)],
				[waiting ? 'Waiting on' : 'Approved by', signer],
				['Period', periodLabel(entry.date)],
				['Attachments', attached, 'jn-ellip-block'],
			];
			const terms = pairs
				.map(
					([term, value, wrap]) =>
						`<div><dt>${term}</dt><dd${wrap ? ` class="${wrap}"` : ''}>${value}</dd></div>`,
				)
				.join('');
			return `<section class="jn-d-section" aria-labelledby="jn-d-facts"><h3 class="jn-d-heading" id="jn-d-facts">Details</h3><dl class="jn-d-facts">${terms}</dl></section>`;
		}

		/* One sentence on where the entry stands, shown under its status pill. */
		function standing(entry) {
			const latest = entry.trail[entry.trail.length - 1];
			if (entry.status === 'waiting')
				return `Waiting for ${awaitingPhrase(entry)} since ${dateAndTime(latest.at)}.`;
			if (entry.status === 'draft') {
				return latest.what === 'sentback'
					? `Sent back by ${latest.by}: “${latest.note}”`
					: 'Not submitted yet. It leaves the books alone until it is approved.';
			}
			if (entry.status === 'reversed')
				return `Undone by ${entry.reversal}. Both stay in the books, so the history is kept.`;
			if (entry.reverses) return `Undoes ${entry.reverses}, with the same lines the other way around.`;
			return `In the books since ${dateAndTime(latest.at)}.`;
		}

		/* The new entry dialog starts over with two empty lines every time it opens. */

		function field(name) {
			return pick(`[data-jn-f="${name}"]`, composer);
		}

		function wireComposer() {
			const lineList = field('lines');

			/* A line is either a debit or a credit: typing on one side empties the other. */
			lineList.addEventListener('input', (event) => {
				const side = event.target.getAttribute('data-jn-line');
				const opposite = { dr: 'cr', cr: 'dr' }[side];
				if (opposite && event.target.value) {
					pick(`[data-jn-line="${opposite}"]`, event.target.closest('.jn-line')).value = '';
				}
				tallyLines();
			});
			lineList.addEventListener('change', tallyLines);
			lineList.addEventListener('click', (event) => {
				const remover = event.target.closest('[data-jn-line="remove"]');
				if (!remover || remover.disabled) return;
				const line = remover.closest('.jn-line');
				const neighbor = line.nextElementSibling || line.previousElementSibling;
				line.remove();
				lockLastTwo();
				tallyLines();
				if (neighbor) pick('[data-jn-line="dr"]', neighbor).focus();
			});

			field('add-line').addEventListener('click', () => {
				const line = appendLine();
				tallyLines();
				(pick('.basalt-select-trigger', line) || pick('select', line))?.focus();
			});
			field('browse').addEventListener('click', () => field('picker').click());
			field('picker').addEventListener('change', () => {
				const picked = field('picker').files?.[0];
				if (picked) field('file').value = picked.name;
			});

			composer.addEventListener('shown.bs.modal', () => field('memo').focus());
			field('memo').addEventListener('input', () => field('memo').classList.remove('is-invalid'));
			composerForm.addEventListener('submit', submitComposer);
		}

		function openComposer() {
			composerForm.reset();
			for (const flagged of pickAll('.is-invalid', composerForm)) flagged.classList.remove('is-invalid');
			field('lines').innerHTML = '';
			appendLine();
			appendLine();
			window.Basalt.datepicker?.set(field('date'), DEMO_TODAY);
			tallyLines();
			window.bootstrap.Modal.getOrCreateInstance(composer).show();
		}

		function appendLine() {
			lineCounter += 1;
			const n = lineCounter;
			const amountBox = (key, label) =>
				`<div class="jn-line-${key.toLowerCase()}"><label class="jn-line-label" for="jn-line-${key}${n}">${label}</label><input type="text" class="form-control" id="jn-line-${key}${n}" inputmode="decimal" placeholder="0.00" autocomplete="off" data-jn-line="${key.toLowerCase()}"></div>`;
			const line = document.createElement('li');
			line.className = 'jn-line';
			line.innerHTML = [
				`<div class="jn-line-acct"><label class="visually-hidden" for="jn-line-acct-${n}">Account, line ${n}</label><select class="form-select" id="jn-line-acct-${n}" data-basalt-select="search" data-jn-line="acct">${ACCOUNT_MENU}</select></div>`,
				amountBox('Dr', 'Debit'),
				amountBox('Cr', 'Credit'),
				`<button type="button" class="btn jn-line-remove" data-jn-line="remove" aria-label="Remove line ${n}"><i class="bi bi-x-lg" aria-hidden="true"></i></button>`,
			].join('');
			field('lines').appendChild(line);
			lockLastTwo();
			return line;
		}

		/* An entry needs two lines, so the remove buttons stop at two. */
		function lockLastTwo() {
			const present = pickAll('.jn-line', field('lines'));
			for (const line of present) pick('[data-jn-line="remove"]', line).disabled = present.length <= 2;
		}

		function readAmount(input) {
			const parsed = parseFloat(String(input.value).replace(/[^0-9.]/g, ''));
			return Number.isFinite(parsed) && parsed > 0 ? roundCents(parsed) : 0;
		}

		function readLines() {
			return pickAll('.jn-line', field('lines')).map((line) => ({
				code: pick('[data-jn-line="acct"]', line).value,
				dr: readAmount(pick('[data-jn-line="dr"]', line)),
				cr: readAmount(pick('[data-jn-line="cr"]', line)),
			}));
		}

		/**
		 * Adds up both sides as the user types and says whether they balance or
		 * which side falls short, and by how much.
		 * @returns {{parsed: Array, dr: number, cr: number}}
		 */
		function tallyLines() {
			const parsed = readLines();
			const dr = roundCents(parsed.reduce((sum, line) => sum + line.dr, 0));
			const cr = roundCents(parsed.reduce((sum, line) => sum + line.cr, 0));
			field('dr').textContent = formatAmount(dr);
			field('cr').textContent = formatAmount(cr);

			const verdict = field('state');
			verdict.classList.remove('is-ok', 'is-off', 'is-error');
			if (!dr && !cr) {
				verdict.textContent = 'Add the amounts';
			} else if (dr === cr) {
				verdict.classList.add('is-ok');
				verdict.innerHTML = '<i class="bi bi-check2-circle" aria-hidden="true"></i>Balanced';
			} else {
				verdict.classList.add('is-off');
				verdict.innerHTML = `<i class="bi bi-exclamation-circle" aria-hidden="true"></i>${dr > cr ? 'Credits' : 'Debits'} short by ${formatAmount(Math.abs(dr - cr))}`;
			}
			return { parsed, dr, cr };
		}

		/* The two submit buttons share this handler: Save draft keeps the entry
       as a draft, Submit sends it for approval and insists it balances. */
		function submitComposer(event) {
			event.preventDefault();
			const asDraft = event.submitter?.value === 'draft';
			const status = asDraft ? 'draft' : 'waiting';
			const memoBox = field('memo');
			const dateBox = pick('input[type="text"]', field('date'));
			const pickedDate = window.Basalt.datepicker ? window.Basalt.datepicker.get(field('date')) : '';
			const memoMissing = !memoBox.value.trim();
			const dateWrong = !pickedDate || (dateBox && !dateBox.checkValidity());
			memoBox.classList.toggle('is-invalid', memoMissing);

			const tally = tallyLines();
			const filled = tally.parsed.filter((line) => line.dr || line.cr);
			const linesProblem = linesComplaint(filled, tally, asDraft);
			if (linesProblem) {
				const verdict = field('state');
				verdict.classList.remove('is-ok', 'is-off');
				verdict.classList.add('is-error');
				verdict.innerHTML = `<i class="bi bi-exclamation-circle" aria-hidden="true"></i>${linesProblem}`;
			}
			if (memoMissing) return memoBox.focus();
			if (dateWrong) return dateBox?.focus();
			if (linesProblem) return pick('.jn-line input', field('lines'))?.focus();

			const stamp = nextStamp();
			const attachmentName = field('file').value.trim();
			const created = {
				id: upcomingId(),
				date: pickedDate,
				memo: memoBox.value.trim(),
				by: SIGNED_IN,
				status,
				lines: filled.map((line) => [line.code, line.dr, line.cr]),
				files: attachmentName ? [{ name: attachmentName, size: '—' }] : [],
				notes: [],
				trail: asDraft
					? [trailStep('created', SIGNED_IN, stamp)]
					: [trailStep('created', SIGNED_IN, stamp), trailStep('submitted', SIGNED_IN, stamp)],
			};
			ledger.push(created);
			view.highlight = created.id;
			window.bootstrap.Modal.getOrCreateInstance(composer).hide();
			repaint();
			notify({
				tone: 'success',
				icon: asDraft ? 'bi-journal-check' : 'bi-send',
				title: `${created.id}${asDraft ? ' saved as a draft' : ' submitted'}`,
				text: asDraft
					? 'Submit it when it is ready. The books wait until then.'
					: 'It waits for Gregory Devin to approve it.',
				actions: [
					{
						label: 'Undo',
						onClick() {
							ledger.splice(ledger.indexOf(created), 1);
							repaint();
							say(`${created.id} removed.`);
						},
					},
				],
			});
		}

		function linesComplaint(filled, tally, asDraft) {
			if (filled.length < 2) return 'Add at least two lines with amounts.';
			if (filled.some((line) => !line.code)) return 'Choose an account on every line with an amount.';
			if (!asDraft && tally.dr !== tally.cr)
				return 'Debits and credits must match before it goes for approval. Save a draft for now.';
			return '';
		}

		function say(message) {
			announceTo(ui.liveRegion, message);
		}
	}

	/**
	 * journal-entry-details.html: one entry with its facts, lines, approval
	 * trail, attachments and notes. The entry comes from ?id=, or the newest
	 * one when the id is missing or unknown.
	 */
	function mountEntry(root) {
		const liveRegion = pick('[data-jd-live]', root);
		const reverseDialog = document.getElementById('jd-reverse');
		const picker = pick('[data-jd-picker]', root);
		const noteComposer = pick('[data-jd-note-form]', root);
		const noteBox = pick('[data-jd-note]', root);
		const noteError = pick('[data-jd-note-error]', root);
		const entry = entryById(new URLSearchParams(location.search).get('id')) || [...ledger].sort(byNewest)[0];

		root.addEventListener('click', (event) => {
			const actionButton = event.target.closest('[data-jd-act]');
			if (actionButton) {
				const action = actionButton.getAttribute('data-jd-act');
				return action === 'reverse' ? confirmReverse() : runMove(action);
			}
			const download = event.target.closest('[data-jd-download]');
			if (download) {
				const doc = entry.files[Number(download.getAttribute('data-jd-download'))];
				if (doc) notify({ tone: 'success', icon: 'bi-download', title: 'Downloaded', text: doc.name });
				return;
			}
			if (event.target.closest('[data-jd-attach]')) picker.click();
		});

		picker.addEventListener('change', (event) => {
			const upload = event.target.files?.[0];
			if (!upload) return;
			const kilobytes = Math.max(1, Math.round(upload.size / 1024));
			entry.files.push({
				name: upload.name,
				size: kilobytes >= 1024 ? `${(kilobytes / 1024).toFixed(1)} MB` : `${kilobytes} KB`,
			});
			event.target.value = '';
			paint();
			notify({ tone: 'success', icon: 'bi-paperclip', title: 'File attached', text: upload.name });
		});

		noteBox.addEventListener('input', () => {
			noteError.hidden = true;
			noteBox.classList.remove('is-invalid');
		});
		noteComposer.addEventListener('submit', (event) => {
			event.preventDefault();
			const written = noteBox.value.trim();
			if (!written) {
				noteError.hidden = false;
				noteBox.classList.add('is-invalid');
				noteBox.focus();
				return;
			}
			entry.notes.push({ by: SIGNED_IN, at: nextStamp(), text: written, fresh: true });
			noteBox.value = '';
			paint();
			say('Note added.');
		});

		reverseSlot('go').addEventListener('click', () => {
			const saved = cloneEntry(entry);
			const mirror = postReversal(entry);
			window.bootstrap.Modal.getOrCreateInstance(reverseDialog).hide();
			paint();
			slot('title').focus({ preventScroll: true });
			notify({
				tone: 'success',
				icon: 'bi-arrow-counterclockwise',
				title: `${entry.id} reversed`,
				text: `${mirror.id} undoes it, posted today.`,
				actions: [
					{
						label: 'Undo',
						onClick() {
							ledger.splice(ledger.indexOf(mirror), 1);
							rollBack(entry, saved);
							paint();
							say('Reversal undone.');
						},
					},
				],
			});
		});

		paint();

		function slot(name) {
			return pick(`[data-jd="${name}"]`, root);
		}

		function reverseSlot(name) {
			return pick(`[data-jd-rv="${name}"]`, reverseDialog);
		}

		function say(message) {
			announceTo(liveRegion, message);
		}

		function paint() {
			const debits = debitSum(entry);
			const gap = roundCents(debits - creditSum(entry));
			const booked = entry.status === 'posted' || entry.status === 'reversed';

			document.title = `${entry.id} · Basalt`;
			slot('title').textContent = entry.memo;
			slot('sub').textContent = `${entry.id} · Manual entry by ${entry.by}`;
			slot('tags').innerHTML = headerTags();
			slot('actions').innerHTML = headerActions();
			slot('facts').innerHTML = factList();
			slot('lines').innerHTML = lineRows(entry, true);
			slot('dr').textContent = formatAmount(debits);
			slot('cr').textContent = formatAmount(creditSum(entry));
			slot('lines-desc').textContent =
				`${countOf(entry.lines.length, 'line')}, debits first. ${booked ? `Posted to the ${periodLabel(entry.date)} books.` : 'Nothing moves in the books until it is approved.'}`;

			const check = slot('check');
			check.classList.toggle('is-off', Boolean(gap));
			pick('.bi', check).className = `bi ${gap ? 'bi-exclamation-circle' : 'bi-check2-circle'}`;
			slot('check-text').textContent = gap
				? `Off by ${formatAmount(Math.abs(gap))}. It can go for approval once both sides match.`
				: `Balanced. Debits and credits both come to ${formatAmount(debits)}.`;

			slot('trail').innerHTML = trailItems();
			slot('files').innerHTML = fileItems();
			slot('files-none').hidden = entry.files.length > 0;
			slot('notes').innerHTML = noteItems();
			slot('notes-none').hidden = entry.notes.length > 0;
			for (const added of entry.notes) delete added.fresh;
			armTooltips(root);
			persist();
		}

		function headerTags() {
			const links = [
				[entry.reversal, `Undone by ${entry.reversal}`],
				[entry.reverses, `Undoes ${entry.reverses}`],
			]
				.filter(([target]) => target)
				.map(
					([target, label]) =>
						`<a class="jd-link" href="journal-entry-details.html?id=${encodeURIComponent(target)}">${label}</a>`,
				);
			return stateBadge(entry.status) + links.join('');
		}

		function headerActions() {
			if (entry.status === 'waiting') return actionButtons(['sendback', 'approve'], 'data-jd-act', true);
			if (entry.status === 'draft') return actionButtons(['submit'], 'data-jd-act', true);
			if (entry.status === 'posted' && !entry.reverses) return actionButtons(['reverse'], 'data-jd-act', true);
			return '';
		}

		/* Five facts across the top. Values holding markup (people) skip escaping. */
		function factList() {
			const waiting = entry.status === 'waiting';
			const roleOf = (person) => TEAM[person]?.role;
			let signer = { main: '<span class="jn-quiet">Not yet</span>', sub: 'Needs approval first' };
			if (waiting) signer = { main: personChip(approverFor(entry)), sub: 'Approver' };
			else if (entry.approvedBy) signer = { main: personChip(entry.approvedBy), sub: roleOf(entry.approvedBy) };

			let lineage = 'Journal reference';
			if (entry.reverses) lineage = `Undoes ${entry.reverses}`;
			else if (entry.reversal) lineage = `Undone by ${entry.reversal}`;

			const facts = [
				{ term: 'Date', main: htmlSafe(fullDate(entry.date)), sub: periodLabel(entry.date) },
				{
					term: 'Amount',
					main: htmlSafe(formatAmount(debitSum(entry))),
					sub: countOf(entry.lines.length, 'line'),
				},
				{ term: 'Made by', main: personChip(entry.by), sub: roleOf(entry.by) || '' },
				{ term: waiting ? 'Waiting on' : 'Approved by', ...signer },
				{ term: 'Reference', main: htmlSafe(entry.id), sub: lineage },
			];
			return facts
				.map(
					({ term, main, sub }) =>
						`<div class="jd-fact"><dt>${term}</dt><dd><span class="jd-fact-main">${main}</span><span class="jd-fact-sub">${htmlSafe(sub)}</span></dd></div>`,
				)
				.join('');
		}

		function trailItems() {
			const items = entry.trail.map((step) => {
				const kind = TRAIL_STEPS[step.what];
				const remark = step.note ? `<span class="jd-step-note">“${htmlSafe(step.note)}”</span>` : '';
				return `<li class="jd-step jd-step-${kind.tone}"><span class="jd-step-what">${htmlSafe(kind.describe(step))}</span>${remark}<span class="jd-step-when">${dateAndTime(step.at)}</span></li>`;
			});
			const pending = {
				waiting: [`Waiting for ${awaitingPhrase(entry)}`, 'Posts to the books once approved'],
				draft: ['Not submitted yet', `${htmlSafe(entry.by)} submits it when it is ready`],
			}[entry.status];
			if (pending)
				items.push(
					`<li class="jd-step jd-step-wait"><span class="jd-step-what">${pending[0]}</span><span class="jd-step-when">${pending[1]}</span></li>`,
				);
			return items.join('');
		}

		function fileItems() {
			const icons = {
				pdf: 'bi-file-earmark-pdf',
				xlsx: 'bi-file-earmark-spreadsheet',
				csv: 'bi-file-earmark-spreadsheet',
			};
			return entry.files
				.map((doc, index) => {
					const extension = (/\.([^.]+)$/.exec(doc.name)?.[1] || '').toLowerCase();
					const icon = icons[extension] || 'bi-file-earmark';
					const name = htmlSafe(doc.name);
					return `<li class="jd-file"><span class="jd-file-icon" aria-hidden="true"><i class="bi ${icon}"></i></span><span class="jd-file-text"><span class="jd-file-name">${name}</span><span class="jd-file-size">${htmlSafe(doc.size)}</span></span><button type="button" class="btn btn-icon btn-sm" data-jd-download="${index}" aria-label="Download ${name}"${tooltipAttrs('Download')}><i class="bi bi-download" aria-hidden="true"></i></button></li>`;
				})
				.join('');
		}

		function noteItems() {
			return entry.notes
				.map(
					(item) =>
						`<li class="jd-note${item.fresh ? ' is-fresh' : ''}"><p class="jd-note-text">${htmlSafe(item.text)}</p><p class="jd-note-meta">${htmlSafe(item.by)} · ${dateAndTime(item.at)}</p></li>`,
				)
				.join('');
		}

		/* Approve, send back or submit; then focus the first new action, or the title. */
		function runMove(action) {
			const saved = cloneEntry(entry);
			moveEntry(entry, action);
			paint();
			(pick('[data-jd-act]', slot('actions')) || slot('title')).focus({ preventScroll: true });
			const outcomes = {
				approve: ['success', 'bi-check2-circle', 'approved', `Posted to the ${periodLabel(entry.date)} books.`],
				sendback: ['info', 'bi-reply', 'sent back', `It is a draft again, with ${entry.by}.`],
				submit: ['success', 'bi-send', 'submitted', `It waits for ${approverFor(entry)} to approve it.`],
			};
			const [tone, icon, verb, message] = outcomes[action];
			notify({
				tone,
				icon,
				title: `${entry.id} ${verb}`,
				text: message,
				actions: [
					{
						label: 'Undo',
						onClick() {
							rollBack(entry, saved);
							paint();
							say('Undone.');
						},
					},
				],
			});
		}

		/* The confirm dialog names the mirror entry and lists each line flipped. */
		function confirmReverse() {
			reverseSlot('title').textContent = `Reverse ${entry.id}?`;
			reverseSlot('text').textContent =
				`A new entry, ${upcomingId()}, posts the same lines the other way around, dated today. Both stay in the books.`;
			reverseSlot('list').innerHTML = entry.lines
				.map(([code, dr, cr]) => {
					const flipped = dr ? `credit ${formatAmount(dr)}` : `debit ${formatAmount(cr)}`;
					return `<li><i class="bi bi-arrow-left-right" aria-hidden="true"></i>${htmlSafe(accountFor(code).name)}, ${flipped}</li>`;
				})
				.join('');
			window.bootstrap.Modal.getOrCreateInstance(reverseDialog).show();
		}
	}

	/* Everything from here reads or changes the shared ledger, whichever page is open. */

	function loadLedger() {
		let restored;
		try {
			const stored = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null');
			restored = Array.isArray(stored?.entries) ? stored.entries : null;
			if (stored?.tick) clockSteps = stored.tick;
		} catch {
			restored = null;
		}
		return restored || JSON.parse(JSON.stringify(STARTER_ENTRIES));
	}

	function persist() {
		try {
			sessionStorage.setItem(STORE_KEY, JSON.stringify({ entries: ledger, tick: clockSteps }));
		} catch {
			/* Storage is off, as in some private windows; edits last until reload. */
		}
	}

	function entryById(id) {
		return ledger.find((entry) => entry.id === id);
	}

	function upcomingId() {
		const highest = Math.max(...ledger.map((entry) => Number(entry.id.replace(/\D/g, ''))));
		return `#${highest + 1}`;
	}

	function entryHref(entry) {
		return `journal-entry-details.html?id=${encodeURIComponent(entry.id)}`;
	}

	function byNewest(a, b) {
		return (b.date + b.id).localeCompare(a.date + a.id);
	}

	function debitSum(entry) {
		return roundCents(entry.lines.reduce((sum, line) => sum + (line[1] || 0), 0));
	}

	function creditSum(entry) {
		return roundCents(entry.lines.reduce((sum, line) => sum + (line[2] || 0), 0));
	}

	/* A deep copy taken before a change, so Undo can put every field back. */
	function cloneEntry(entry) {
		return JSON.parse(JSON.stringify(entry));
	}

	/* Undo restores in place, keeping the same object every view refers to. */
	function rollBack(entry, saved) {
		for (const key of Object.keys(entry)) delete entry[key];
		Object.assign(entry, saved);
	}

	/** Moves an entry on by one of the MOVES actions and logs the step. */
	function moveEntry(entry, action) {
		const move = MOVES[action];
		if (!move) return;
		const [status, kind] = move;
		entry.status = status;
		if (status === 'posted') entry.approvedBy = SIGNED_IN;
		if (status !== 'posted' && status !== 'reversed') delete entry.approvedBy;
		entry.trail.push(trailStep(kind, SIGNED_IN, nextStamp()));
	}

	/**
	 * Posts a mirror entry with each line's debit and credit swapped, dated
	 * today, and marks the original as reversed by it.
	 * @returns {object} the new entry
	 */
	function postReversal(original) {
		const stamp = nextStamp();
		const mirror = {
			id: upcomingId(),
			date: DEMO_TODAY,
			memo: `Reversal of ${original.id}`,
			by: SIGNED_IN,
			status: 'posted',
			approvedBy: SIGNED_IN,
			reverses: original.id,
			lines: original.lines.map(([code, dr, cr]) => [code, cr, dr]),
			files: [],
			notes: [],
			trail: [trailStep('created', SIGNED_IN, stamp), trailStep('approved', SIGNED_IN, stamp)],
		};
		ledger.push(mirror);
		original.status = 'reversed';
		original.reversal = mirror.id;
		original.trail.push(trailStep('reversed', SIGNED_IN, stamp));
		return mirror;
	}

	/* Whoever did not write the entry approves it; the signed-in lead's own
     entries go to Gregory Devin. */
	function approverFor(entry) {
		return entry.by === SIGNED_IN ? 'Gregory Devin' : SIGNED_IN;
	}

	/* The signed-in person reads their own pending approval as "your approval". */
	function awaitingPhrase(entry) {
		const approver = approverFor(entry);
		return approver === SIGNED_IN ? 'your approval' : approver;
	}

	function nextStamp() {
		clockSteps += 3;
		const minutes = 14 * 60 + 5 + clockSteps;
		const pad = (value) => String(value).padStart(2, '0');
		return `${DEMO_TODAY}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
	}

	/* Small builders that keep STARTER_ENTRIES short enough to scan. */

	function debit(code, amount) {
		return [code, amount, 0];
	}

	function credit(code, amount) {
		return [code, 0, amount];
	}

	function attachment(name, size) {
		return { name, size };
	}

	function note(by, at, body) {
		return { by, at, text: body };
	}

	function trailStep(what, by, at, remark) {
		return { what, by, at, note: remark || '' };
	}

	/* Both pages draw lines, accounts, pills and people with these helpers. */

	function accountFor(code) {
		return CHART.find((account) => account.code === code) || { code, type: 'assets', name: `Account ${code}` };
	}

	/**
	 * Line rows for the drawer (account and amounts) or the details page,
	 * which adds the code before the account and its group after it.
	 */
	function lineRows(entry, detailed) {
		return entry.lines
			.map(([code, dr, cr]) => {
				const account = accountFor(code);
				const codeCell = detailed ? `<td class="jd-col-code jn-quiet">${account.code}</td>` : '';
				const groupCell = detailed
					? `<td class="jd-col-type jn-quiet">${ACCOUNT_GROUPS[account.type]}</td>`
					: '';
				return `<tr>${codeCell}<td class="jn-ellip"><span class="jn-acct">${htmlSafe(account.name)}</span></td>${groupCell}<td class="text-end">${dr ? formatAmount(dr) : ''}</td><td class="text-end">${cr ? formatAmount(cr) : ''}</td></tr>`;
			})
			.join('');
	}

	/* The accounts in one cell: the first debited, an arrow, the first
     credited, each with "+n" when that side has more lines. */
	function accountsMarkup(entry) {
		const sideName = (column) => {
			const touched = entry.lines.filter((line) => line[column]);
			if (!touched.length) return '';
			const extra = touched.length > 1 ? ` +${touched.length - 1}` : '';
			return accountFor(touched[0][0]).name + extra;
		};
		return `${htmlSafe(sideName(1))} <span class="jn-arrow" aria-hidden="true">→</span><span class="visually-hidden">to</span> ${htmlSafe(sideName(2))}`;
	}

	function accountsSearchText(entry) {
		return entry.lines.map(([code]) => `${accountFor(code).name} ${code}`).join(' ');
	}

	function stateBadge(status, compact) {
		const meta = STATES[status];
		const toneClass = meta.tone ? ` basalt-status-${meta.tone}` : '';
		return `<span class="basalt-status basalt-status-dot${toneClass}">${compact ? meta.short : meta.label}</span>`;
	}

	function actionButtons(kinds, hook, small) {
		return kinds
			.map((kind) => {
				const { look, icon, label } = ACTION_BUTTONS[kind];
				return `<button type="button" class="btn ${look}${small ? ' btn-sm' : ''}" ${hook}="${kind}"><i class="bi ${icon} me-1" aria-hidden="true"></i>${label}</button>`;
			})
			.join('');
	}

	function personChip(name) {
		const tone = TEAM[name]?.tone || 6;
		const letters = name
			.split(' ')
			.map((part) => part[0])
			.join('')
			.slice(0, 2);
		return `<span class="jn-who"><span class="basalt-avatar basalt-avatar-xs basalt-avatar-tone-${tone}" aria-hidden="true">${htmlSafe(letters)}</span><span class="jn-who-name">${htmlSafe(name)}</span></span>`;
	}

	function tooltipAttrs(label) {
		return ` data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="${label}"`;
	}

	/* General helpers that know nothing about journal entries. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function armTooltips(scope) {
		window.Basalt.tips?.(scope);
	}

	/* Screen readers hear the message again even when it repeats, because the
     region is emptied first and refilled a beat later. */
	function announceTo(region, message) {
		region.textContent = '';
		setTimeout(() => {
			region.textContent = message;
		}, 50);
	}

	/* A modifier key or the middle button opens the entry in a new tab. */
	function followLink(href, event) {
		if (event.metaKey || event.ctrlKey || event.button === 1) window.open(href, '_blank', 'noopener');
		else location.href = href;
	}

	function queryHits(haystack, query) {
		if (window.Basalt?.matchesQuery) return window.Basalt.matchesQuery(haystack, query);
		return haystack.toLowerCase().includes(query.toLowerCase());
	}

	function roundCents(amount) {
		return Math.round(amount * 100) / 100;
	}

	function formatAmount(amount) {
		const digits = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		return `${amount < 0 ? '−' : ''}$${digits}`;
	}

	function countOf(howMany, singular, pluralForm) {
		return `${howMany} ${howMany === 1 ? singular : pluralForm || `${singular}s`}`;
	}

	/* Dates are read straight from ISO strings, so no time zone can shift them. */

	function shortDate(iso) {
		const [, month, day] = iso.slice(0, 10).split('-');
		return `${SHORT_MONTH_NAMES[Number(month) - 1]} ${Number(day)}`;
	}

	function fullDate(iso) {
		return `${shortDate(iso)}, ${iso.slice(0, 4)}`;
	}

	function dateAndTime(iso) {
		const hour = Number(iso.slice(11, 13));
		return `${fullDate(iso)}, ${hour % 12 || 12}:${iso.slice(14, 16)} ${hour < 12 ? 'AM' : 'PM'}`;
	}

	function periodLabel(iso) {
		return `${FULL_MONTH_NAMES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
	}
})();
