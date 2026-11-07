/**
 * Invoices page (invoices.html): every invoice Fieldline has sent, what is
 * still owed and how late it is, and the reminders that chase it. The
 * "Money owed" card splits the open balance by due date, one column per
 * band, and pressing a column narrows the list to it; the tabs pick a
 * status, and each row opens the invoice itself (invoice-details.html?id=<number>).
 *
 * Records come from the shared billing book (window.Basalt.data.billing,
 * assets/basalt/js/data/multipurpose/billing.js): plan renewals from the accounts file plus the
 * one-off purchases billed on invoice, the ledger the Invoice, Receipts and
 * Income pages also read. For a real app, hand back your billing system's
 * invoices in the same shapes. Status is derived, never stored: a sent
 * invoice whose due date has passed counts as overdue.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-ivs-root]');
	const book = window.Basalt.data && window.Basalt.data.billing;
	if (!pageRoot || !book) return;

	const TODAY_ISO = book.today;
	const BOOK_START = book.since;
	const SIGNATURE = 'John Armstrong';
	const PAGE_SIZE = 10;
	const DAY_MS = 86400000;
	const SHORT_MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
	const LONG_MONTHS = 'January February March April May June July August September October November December'.split(
		' ',
	);
	const SMALL_NUMBERS = 'no one two three four five six seven eight nine ten'.split(' ');
	/* How a payment method reads in a sentence. */
	const METHOD_WORDS = { ach: 'bank transfer', wire: 'wire', check: 'check', card: 'card' };
	/* The order the tabs come in, and the word and pill tone of each status. */
	const STATUS_ORDER = ['all', 'overdue', 'sent', 'draft', 'paid', 'void'];
	const STATUS_LOOK = {
		overdue: { word: 'Overdue', tone: 'danger' },
		sent: { word: 'Sent', tone: 'info' },
		draft: { word: 'Draft', tone: 'primary' },
		paid: { word: 'Paid', tone: 'success' },
		void: { word: 'Void', tone: '' },
	};
	/* "Needs action first": overdue, drafts, sent, then paid and void. */
	const ATTENTION_RANK = { overdue: 0, draft: 1, sent: 2, paid: 3, void: 4 };
	const TONE_LABEL = { friendly: 'friendly', firm: 'firm', final: 'final notice' };
	/* What a tab says when it has nothing to list and no search is typed. */
	const EMPTY_TAB_TEXT = {
		overdue: 'Every invoice is paid on time. Nothing to chase.',
		draft: 'No drafts. New invoices you save without sending wait here.',
		sent: 'Nothing is waiting to be paid.',
		paid: 'No invoice is paid yet.',
		void: 'No invoice has been voided.',
	};

	/* The "Money owed" columns, late ones first, then those still to come;
     "Today" is drawn where the late ones end. */
	const BANDS = [
		{
			key: 'late3',
			label: '22+ days late',
			name: 'Over 3 weeks late',
			late: true,
			holds: (r) => statusOf(r) === 'overdue' && daysLate(r) > 21,
		},
		{
			key: 'late2',
			label: '8–21 days late',
			name: '8 to 21 days late',
			late: true,
			holds: (r) => statusOf(r) === 'overdue' && daysLate(r) > 7 && daysLate(r) <= 21,
		},
		{
			key: 'late1',
			label: '1–7 days late',
			name: 'Up to a week late',
			late: true,
			holds: (r) => statusOf(r) === 'overdue' && daysLate(r) <= 7,
		},
		{
			key: 'due1',
			label: 'Next 14 days',
			name: 'Due in the next 2 weeks',
			holds: (r) => statusOf(r) === 'sent' && daysToGo(r) <= 14,
		},
		{
			key: 'due2',
			label: 'In 15–28 days',
			name: 'Due in 15 to 28 days',
			holds: (r) => statusOf(r) === 'sent' && daysToGo(r) > 14 && daysToGo(r) <= 28,
		},
		{
			key: 'due3',
			label: 'Later',
			name: 'Due after 4 weeks',
			holds: (r) => statusOf(r) === 'sent' && daysToGo(r) > 28,
		},
	];

	/* One comparison per choice of the order menu. */
	const ORDERINGS = {
		attention(a, b) {
			const rank = ATTENTION_RANK[statusOf(a)] - ATTENTION_RANK[statusOf(b)];
			if (rank) return rank;
			if (['overdue', 'sent'].includes(statusOf(a))) return a.due.localeCompare(b.due);
			return startedOn(b).localeCompare(startedOn(a));
		},
		newest: (a, b) => startedOn(b).localeCompare(startedOn(a)) || b.no.localeCompare(a.no),
		due: (a, b) => (a.due || '9999').localeCompare(b.due || '9999'),
		amount: (a, b) => b.amount - a.amount,
	};

	/* Customers by account id, kept from the first invoice that names them. */
	const customerBook = {};
	/* The records, copied so the page can change them freely. A record has
     state draft, sent, paid or void; a draft carries only its terms (days
     to pay once sent) and the day it was saved. opened is when the customer
     first opened the email, reminded the latest reminder, paid the day the
     money came and how, declined the day a card on file was refused. */
	const records = book.invoices().map(copyRecord);
	/* Invoices made here number up from 7001, skipping any in use. */
	const taken = new Set(records.map((r) => Number(r.no.replace(/\D/g, ''))));
	let serial = 7001;
	while (taken.has(serial)) serial += 1;

	/* What the list shows: tab, search, order, how many rows and which band. */
	const listView = { tab: 'all', query: '', order: 'attention', shown: PAGE_SIZE, band: null };
	/* Every record that passes the current view, in order. */
	let listed = [];
	/* The band columns grow in on the first draw only. */
	let bandsDrawnOnce = false;

	const agingRow = pick('[data-ivs-aging]', pageRoot);
	const remindOverdueButton = pick('[data-ivs-remind-all]', pageRoot);
	const ui = {
		rows: pick('[data-ivs-body]', pageRoot),
		tableWrap: pick('[data-ivs-table-wrap]', pageRoot),
		search: pick('[data-ivs-search]', pageRoot),
		order: pick('[data-ivs-sort]', pageRoot),
		tally: pick('[data-ivs-total]', pageRoot),
		empty: pick('[data-ivs-empty]', pageRoot),
		moreRow: pick('[data-ivs-more-wrap]', pageRoot),
		moreButton: pick('[data-ivs-more]', pageRoot),
		moreText: pick('[data-ivs-more-label]', pageRoot),
		panel: pick('#ivs-panel', pageRoot),
		bandChip: pick('[data-ivs-band-clear]', pageRoot),
		bandText: pick('[data-ivs-band-label]', pageRoot),
		clearSearch: pick('[data-ivs-clear]', pageRoot),
	};

	const reminder = dialogParts('#ivs-remind', '[data-ivs-remind-form]');
	const sweep = dialogParts('#ivs-remind-all', '[data-ivs-all-form]');
	const creator = dialogParts('#ivs-new', '[data-ivs-new-form]');
	const sweepList = pick('[data-ivs-all="list"]', sweep.box);
	/* The invoice the reminder dialog is about, and the control that opened it. */
	let remindTarget = null;
	let returnFocusTo = null;
	/* Which submit button sent the new-invoice form. */
	let createMode = 'send';

	/** Wires the list controls, the rows and the three dialogs, then draws. */
	function start() {
		wireListControls();
		ui.rows.addEventListener('click', onRowClick);
		wireReminderDialog();
		wireSweepDialog();
		wireCreateDialog();
		redrawAll();
	}

	/* Drawing. */

	function redrawAll(freshNo) {
		drawSummary();
		drawRows(freshNo);
	}

	/** The totals, the band columns, the tab counts and the remind button. */
	function drawSummary() {
		const owedNow = records.filter((r) => r.state === 'sent');
		const lateOnes = owedNow.filter((r) => statusOf(r) === 'overdue');
		const notDue = owedNow.filter((r) => statusOf(r) === 'sent');
		const paidLately = records.filter((r) => r.state === 'paid' && dayGap(r.paid.on, TODAY_ISO) <= 30);
		const figures = {
			open: wholeDollars(totalOf(owedNow)),
			late: wholeDollars(totalOf(lateOnes)),
			'late-n': counted(lateOnes.length, 'invoice'),
			due: wholeDollars(totalOf(notDue)),
			'due-n': counted(notDue.length, 'invoice'),
			paid: wholeDollars(totalOf(paidLately)),
			'paid-n': counted(paidLately.length, 'invoice'),
		};
		for (const [slot, figure] of Object.entries(figures)) {
			pick(`[data-ivs-fig="${slot}"]`, pageRoot).textContent = figure;
		}

		const draftCount = records.filter((r) => r.state === 'draft').length;
		const sentCount = records.length - draftCount;
		pick('[data-ivs-sum]', pageRoot).textContent =
			`${upperFirst(spelled(sentCount, 'invoice'))} sent since ${longDay(BOOK_START)}${
				draftCount ? `, and ${spelled(draftCount, 'draft')} waiting to go.` : '.'
			}`;

		drawBands(owedNow);

		const perStatus = { all: records.length };
		for (const r of records) perStatus[statusOf(r)] = (perStatus[statusOf(r)] || 0) + 1;
		for (const tab of STATUS_ORDER) pick(`[data-ivs-count="${tab}"]`, pageRoot).textContent = perStatus[tab] || 0;

		remindOverdueButton.disabled = !lateOnes.length;
	}

	/** One column per band, its bar as tall as its share of the largest band. */
	function drawBands(owedNow) {
		agingRow.classList.toggle('is-settled', bandsDrawnOnce);
		bandsDrawnOnce = true;
		const sums = BANDS.map((band) => {
			const inBand = owedNow.filter(band.holds);
			return { band, count: inBand.length, owed: totalOf(inBand) };
		});
		const tallest = Math.max(...sums.map((sum) => sum.owed)) || 1;
		agingRow.innerHTML = sums
			.map(({ band, count, owed }, i) => {
				const startsComing = i > 0 && !band.late && sums[i - 1].band.late;
				const divider = startsComing
					? '<span aria-hidden="true" class="ivs-aging-today"><span>Today</span></span>'
					: '';
				return (
					`${divider}<button data-ivs-band="${band.key}" aria-pressed="${listView.band === band.key}" aria-label="${band.name}: ${wholeDollars(owed)}, ${counted(count, 'invoice')}" type="button" class="ivs-aging-col ivs-band-${band.key}" style="--ivs-h:${(owed / tallest).toFixed(3)}"${count ? '' : ' disabled'}>` +
					`<span class="ivs-aging-track"><span class="ivs-aging-amt">${wholeDollars(owed)}</span><span class="ivs-aging-bar"></span></span>` +
					`<span class="ivs-aging-label">${band.label}</span><span class="ivs-aging-n">${counted(count, 'invoice')}</span></button>`
				);
			})
			.join('');
	}

	/** The table, its empty state, the band chip, the count and "Show more". */
	function drawRows(freshNo) {
		listed = records.filter(passesView).sort(ORDERINGS[listView.order]);
		const nothing = listed.length === 0;
		ui.tableWrap.hidden = nothing;
		ui.empty.hidden = !nothing;
		if (nothing) fillEmptyState();

		const band = bandByKey(listView.band);
		ui.bandChip.hidden = !band;
		ui.bandText.textContent = band ? band.name : '';
		ui.tally.textContent = nothing ? '' : counted(listed.length, 'invoice');

		const onPage = listed.slice(0, listView.shown);
		ui.rows.innerHTML = onPage.map((r) => rowMarkup(r, r.no === freshNo)).join('');
		const leftOver = listed.length - onPage.length;
		ui.moreRow.hidden = leftOver <= 0;
		ui.moreText.textContent = `Show ${Math.min(leftOver, PAGE_SIZE)} more`;
	}

	function fillEmptyState() {
		let hint;
		if (listView.query) hint = `Try a customer name, an invoice number such as ${records[0].no}, or an item.`;
		else if (listView.band)
			hint = `No ${listView.tab === 'all' ? '' : `${STATUS_LOOK[listView.tab].word.toLowerCase()} `}invoice is in this band. Clear the band to see the rest.`;
		else hint = EMPTY_TAB_TEXT[listView.tab] || '';
		pick('[data-ivs-empty-title]', pageRoot).textContent = listView.query ? 'No invoice matches' : 'Nothing here';
		pick('[data-ivs-empty-text]', pageRoot).textContent = hint;
		ui.clearSearch.hidden = !listView.query;
	}

	function passesView(r) {
		if (listView.tab !== 'all' && statusOf(r) !== listView.tab) return false;
		if (listView.band && !bandByKey(listView.band).holds(r)) return false;
		if (!listView.query) return true;
		const searchable = searchText(r);
		return window.Basalt && window.Basalt.matchesQuery
			? window.Basalt.matchesQuery(searchable, listView.query)
			: searchable.toLowerCase().includes(listView.query.toLowerCase());
	}

	function searchText(r) {
		const { name, contact } = customerOf(r);
		return [r.no, name, contact, r.item, STATUS_LOOK[statusOf(r)].word].join(' ');
	}

	/* Row markup. */

	function rowMarkup(r, fresh) {
		const statusKey = statusOf(r);
		const customer = htmlSafe(customerOf(r).name);
		const issuedNote = r.issued ? `Issued ${shortDay(r.issued)}` : 'Not sent yet';
		const issuedCell = r.issued
			? `<span class="ivs-date">${shortDay(r.issued)}</span>`
			: '<span class="ivs-date ivs-date-none">Not sent</span>';
		return (
			`<tr data-ivs-no="${r.no}" class="ivs-row ivs-row-${statusKey}${fresh ? ' is-fresh' : ''}">` +
			`<td class="ivs-col-who"><div class="ivs-who">${initialsTile(r)}<div class="ivs-who-text">` +
			`<a href="${invoiceLink(r)}" class="ivs-who-name">${customer}</a>` +
			`<span class="ivs-sub">${r.no} · ${htmlSafe(r.item)}</span>` +
			`<span class="ivs-row-issued">${issuedNote}</span></div></div></td>` +
			`<td class="ivs-col-issued">${issuedCell}</td>` +
			`<td class="ivs-col-due">${dueMarkup(r)}</td>` +
			`<td class="ivs-col-status">${pillMarkup(statusKey)}<span class="ivs-sub">${htmlSafe(latestEvent(r))}</span></td>` +
			`<td class="ivs-col-amt"><span class="ivs-amt${statusKey === 'void' ? ' ivs-amt-void' : ''}">${dollarsAndCents(r.amount)}</span></td>` +
			`<td class="ivs-col-act"><div class="ivs-actions">${quickAction(statusKey)}${rowMenu(r, statusKey)}</div></td></tr>`
		);
	}

	function initialsTile(r) {
		const { name } = customerOf(r);
		return `<span aria-hidden="true" class="basalt-avatar ivs-mark basalt-avatar-tone-${toneIndex(name)}">${htmlSafe(monogram(name))}</span>`;
	}

	function pillMarkup(statusKey) {
		const { word, tone } = STATUS_LOOK[statusKey];
		return `<span class="basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}">${word}</span>`;
	}

	/** The due column: the date, then what that date means today. */
	function dueMarkup(r) {
		const statusKey = statusOf(r);
		if (statusKey === 'draft')
			return `<span class="ivs-date">Net ${r.terms}</span><span class="ivs-sub">Once sent</span>`;
		const noteFor = {
			overdue: () => `<span class="ivs-sub ivs-sub-late">${counted(daysLate(r), 'day')} late</span>`,
			sent: () => `<span class="ivs-sub">${dueWhen(r)}</span>`,
			paid: () => `<span class="ivs-sub">Paid ${shortDay(r.paid.on)}</span>`,
		};
		const note = noteFor[statusKey] ? noteFor[statusKey]() : '<span class="ivs-sub">Not owed</span>';
		return `<span class="ivs-date">${shortDay(r.due)}</span>${note}`;
	}

	function dueWhen(r) {
		const ahead = daysToGo(r);
		if (ahead === 0) return 'Due today';
		if (ahead === 1) return 'Due tomorrow';
		return `In ${ahead} days`;
	}

	/** Under the pill: the last thing that happened to the invoice. */
	function latestEvent(r) {
		const statusKey = statusOf(r);
		if (statusKey === 'draft') return `Saved ${shortDay(r.saved)}`;
		if (statusKey === 'paid') return `By ${r.paid.by}`;
		if (statusKey === 'void') return r.why;
		if (r.reminded) return `Reminded ${r.reminded === TODAY_ISO ? 'today' : shortDay(r.reminded)}`;
		if (r.declined) return `Card declined ${shortDay(r.declined)}`;
		return r.opened ? `Opened ${shortDay(r.opened)}` : 'Not opened yet';
	}

	/** The one button a row needs most, if it needs one. */
	function quickAction(statusKey) {
		function actionButton(act, glyphName, caption) {
			return `<button data-ivs-act="${act}" type="button" class="btn btn-sm btn-outline-secondary ivs-act"><i aria-hidden="true" class="bi ${glyphName} me-1"></i>${caption}</button>`;
		}
		if (statusKey === 'overdue') return actionButton('remind', 'bi-bell', 'Remind');
		if (statusKey === 'draft') return actionButton('send', 'bi-send', 'Send');
		return '';
	}

	function rowMenu(r, statusKey) {
		const owing = statusKey === 'overdue' || statusKey === 'sent';
		function entry(act, glyphName, caption, danger) {
			return `<li><button data-ivs-act="${act}" type="button" class="dropdown-item${danger ? ' ivs-danger-item' : ''}"><i aria-hidden="true" class="bi ${glyphName}"></i>${caption}</button></li>`;
		}
		const divider = '<li><hr class="dropdown-divider"></li>';
		const menuItems = [
			`<li><a href="${invoiceLink(r)}" class="dropdown-item"><i aria-hidden="true" class="bi bi-receipt"></i>Open invoice</a></li>`,
			`<li><a href="company-details.html?id=${encodeURIComponent(r.acct)}" class="dropdown-item"><i aria-hidden="true" class="bi bi-person-vcard"></i>Open customer</a></li>`,
			entry('pdf', 'bi-download', 'Download PDF'),
		];
		if (statusKey === 'sent') menuItems.push(entry('remind', 'bi-bell', 'Send a reminder'));
		if (owing) menuItems.push(entry('paid', 'bi-check2-circle', 'Mark as paid'));
		if (statusKey === 'draft') menuItems.push(divider + entry('delete', 'bi-trash3', 'Delete draft', true));
		if (owing) menuItems.push(divider + entry('void', 'bi-slash-circle', 'Void invoice', true));
		return (
			`<div class="dropdown ivs-menu"><button data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="More for ${r.no}, ${htmlSafe(customerOf(r).name)}" type="button" class="btn btn-icon ivs-more-btn"><i aria-hidden="true" class="bi bi-three-dots"></i></button>` +
			`<ul class="dropdown-menu dropdown-menu-end">${menuItems.join('')}</ul></div>`
		);
	}

	/* The list controls: tabs, bands, search, order, clear and "Show more". */

	function wireListControls() {
		for (const tab of pickAll('[data-ivs-tab]', pageRoot)) {
			tab.addEventListener('shown.bs.tab', () => {
				listView.tab = tab.getAttribute('data-ivs-tab');
				listView.shown = PAGE_SIZE;
				ui.panel.setAttribute('aria-labelledby', tab.id);
				drawRows();
			});
		}

		agingRow.addEventListener('click', (event) => {
			const column = event.target.closest('[data-ivs-band]');
			if (column) toggleBand(column.getAttribute('data-ivs-band'));
		});
		ui.bandChip.addEventListener('click', () => {
			toggleBand(listView.band);
			ui.search.focus({ focusVisible: false });
		});

		let typingTimer;
		ui.search.addEventListener('input', () => {
			clearTimeout(typingTimer);
			typingTimer = setTimeout(() => {
				listView.query = ui.search.value.trim();
				listView.shown = PAGE_SIZE;
				drawRows();
			}, 160);
		});
		ui.order.addEventListener('change', () => {
			listView.order = ui.order.value;
			listView.shown = PAGE_SIZE;
			drawRows();
		});
		ui.clearSearch.addEventListener('click', () => {
			ui.search.value = '';
			listView.query = '';
			drawRows();
			ui.search.focus();
		});
		ui.moreButton.addEventListener('click', () => {
			const firstAdded = listView.shown;
			window.Basalt.slide(ui.tableWrap, () => {
				listView.shown += PAGE_SIZE;
				drawRows();
			});
			ui.rows.children[firstAdded]?.querySelector('.ivs-who-name')?.focus();
		});
	}

	/**
	 * A "Money owed" column narrows the list to its band; pressing it again,
	 * or the chip by the search box, brings every band back.
	 */
	function toggleBand(key) {
		listView.band = listView.band === key ? null : key;
		listView.shown = PAGE_SIZE;
		for (const column of pickAll('[data-ivs-band]', agingRow)) {
			column.setAttribute('aria-pressed', String(column.getAttribute('data-ivs-band') === listView.band));
		}
		if (listView.band && listView.tab !== 'all') switchTab('all');
		else drawRows();
		speak(
			listView.band
				? `Showing ${counted(listed.length, 'invoice')}, ${bandByKey(listView.band).name.toLowerCase()}.`
				: 'Showing every invoice.',
		);
	}

	function switchTab(tabKey) {
		const tab = pick(`[data-ivs-tab="${tabKey}"]`, pageRoot);
		if (tab && listView.tab !== tabKey) bootstrap.Tab.getOrCreateInstance(tab).show();
	}

	/* Rows: the whole row opens the invoice, while its buttons and menu do
     their own thing. */

	function onRowClick(event) {
		const row = event.target.closest('[data-ivs-no]');
		if (!row) return;
		const record = recordByNo(row.getAttribute('data-ivs-no'));
		const actButton = event.target.closest('[data-ivs-act]');
		if (actButton) {
			perform(actButton.getAttribute('data-ivs-act'), record, actButton);
			return;
		}
		if (!event.target.closest('a, button, .dropdown-menu')) window.location.href = invoiceLink(record);
	}

	/** Carries out a row action; the ones that change a record offer an undo. */
	function perform(act, r, trigger) {
		if (act === 'remind') {
			openReminder(r, trigger);
			return;
		}
		if (act === 'send') {
			Object.assign(r, { state: 'sent', issued: TODAY_ISO, due: shiftDays(TODAY_ISO, r.terms) });
			redrawAll(r.no);
			notify({
				tone: 'success',
				icon: 'bi-send',
				title: `${r.no} sent`,
				text: `${customerOf(r).contact} has it at ${customerOf(r).email}. It is due ${longDay(r.due)}.`,
			});
			return;
		}
		if (act === 'pdf') {
			notify({
				tone: 'success',
				icon: 'bi-download',
				title: 'PDF ready',
				text: `${r.no} saved as ${r.no.toLowerCase()}.pdf.`,
			});
			return;
		}

		const priorState = { ...r };
		const atIndex = records.indexOf(r);
		const undo = [{ label: 'Undo', onClick: () => putBack(act, r, priorState, atIndex) }];
		const { name } = customerOf(r);
		if (act === 'paid') {
			r.state = 'paid';
			r.paid = { on: TODAY_ISO, by: 'bank transfer' };
			redrawAll(r.no);
			notify({
				tone: 'success',
				icon: 'bi-check2-circle',
				title: `${r.no} marked as paid`,
				text: `${dollarsAndCents(r.amount)} from ${name}, received today.`,
				actions: undo,
			});
		} else if (act === 'void') {
			r.state = 'void';
			r.why = `Voided ${shortDay(TODAY_ISO)}`;
			redrawAll();
			notify({
				tone: 'info',
				icon: 'bi-slash-circle',
				title: `${r.no} voided`,
				text: `${name} no longer owes ${dollarsAndCents(r.amount)}.`,
				actions: undo,
			});
		} else if (act === 'delete') {
			records.splice(atIndex, 1);
			redrawAll();
			notify({
				tone: 'info',
				icon: 'bi-trash3',
				title: 'Draft deleted',
				text: `${r.no} for ${name} is gone.`,
				actions: undo,
			});
		}
	}

	/** Puts a record back as it was before `act`, then says so. */
	function putBack(act, r, priorState, atIndex) {
		if (act === 'delete') {
			records.splice(atIndex, 0, r);
		} else {
			for (const prop of Object.keys(r)) {
				if (!(prop in priorState)) delete r[prop];
			}
			Object.assign(r, priorState);
		}
		redrawAll();
		speak(`${r.no} is back as it was.`);
	}

	/* The reminder dialog: one email about one open invoice. */

	function wireReminderDialog() {
		for (const radio of pickAll('input[name="ivsTone"]', reminder.box)) {
			radio.addEventListener('change', () => {
				if (remindTarget) reminderField('msg').value = draftEmail(remindTarget, radio.value);
			});
		}

		reminder.box.addEventListener('hidden.bs.modal', () => {
			/* Back to where the visitor was, without a ring from a mouse click. */
			const row = returnFocusTo && returnFocusTo.closest('[data-ivs-no]');
			const focusBack =
				row && document.body.contains(returnFocusTo) ? returnFocusTo : row && pick('.ivs-who-name', row);
			if (focusBack) focusBack.focus({ focusVisible: false });
			returnFocusTo = null;
		});

		reminder.form.addEventListener('submit', (event) => {
			event.preventDefault();
			const address = reminderField('to');
			const messageField = reminderField('msg');
			const addressOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.value.trim());
			const bodyOk = messageField.value.trim().length > 0;
			markInvalid(address, !addressOk);
			markInvalid(messageField, !bodyOk);
			if (!addressOk || !bodyOk) {
				(addressOk ? messageField : address).focus();
				return;
			}
			const r = remindTarget;
			r.reminded = TODAY_ISO;
			const tone = pick('input[name="ivsTone"]:checked', reminder.box).value;
			reminder.modal.hide();
			redrawAll(r.no);
			const extras = [
				pick('#ivs-remind-pdf').checked && 'the PDF',
				pick('#ivs-remind-link').checked && 'a link to pay',
			].filter(Boolean);
			notify({
				tone: 'success',
				icon: 'bi-bell',
				title: 'Reminder sent',
				text: `${upperFirst(TONE_LABEL[tone])} email to ${address.value.trim()}${extras.length ? `, with ${extras.join(' and ')}` : ''}.`,
			});
		});
	}

	function reminderField(key) {
		return pick(`[data-ivs-r="${key}"]`, reminder.box);
	}

	function openReminder(r, trigger) {
		remindTarget = r;
		returnFocusTo = trigger;
		const { name, email } = customerOf(r);
		reminderField('sub').textContent = `${r.no} to ${name}`;
		const history = r.reminded
			? ` Last reminder ${r.reminded === TODAY_ISO ? 'today' : longDay(r.reminded)}.`
			: ' No reminder sent yet.';
		const timing =
			statusOf(r) === 'overdue'
				? `<span class="ivs-lead-late">${counted(daysLate(r), 'day')} late</span>`
				: `due ${longDay(r.due)}`;
		reminderField('lead').innerHTML =
			`<strong>${dollarsAndCents(r.amount)}</strong> for ${htmlSafe(r.item)}, ${timing}.${history}`;
		reminderField('to').value = email;
		const tone = suggestedTone(r);
		for (const radio of pickAll('input[name="ivsTone"]', reminder.box)) radio.checked = radio.value === tone;
		reminderField('tone-hint').textContent =
			statusOf(r) === 'overdue'
				? `Suggested: ${TONE_LABEL[tone]}, for ${counted(daysLate(r), 'day')} late. Choosing another tone rewrites the message.`
				: 'It is not due yet, so a friendly note fits. Choosing another tone rewrites the message.';
		reminderField('msg').value = draftEmail(r, tone);
		pick('#ivs-remind-pdf').checked = true;
		pick('#ivs-remind-link').checked = true;
		clearInvalidIn(reminder.form);
		reminder.modal.show();
	}

	/** The reminder email for `r` in the chosen tone. */
	function draftEmail(r, tone) {
		const greeting = `Hi ${customerOf(r).contact.split(' ')[0]},\n\n`;
		const signOff = `\n\nThanks,\n${SIGNATURE}\nFieldline`;
		const owed = dollarsAndCents(r.amount);
		if (statusOf(r) !== 'overdue') {
			return `${greeting}A quick note that invoice ${r.no} for ${owed} is due on ${longDay(r.due)}. If it is already scheduled, thank you, and please ignore this email.${signOff}`;
		}
		const lateBy = counted(daysLate(r), 'day');
		if (tone === 'friendly') {
			return `${greeting}A friendly reminder that invoice ${r.no} for ${owed} was due on ${longDay(r.due)}. If it is already on its way, thank you, and please ignore this email.${signOff}`;
		}
		if (tone === 'firm') {
			return `${greeting}Invoice ${r.no} for ${owed} is now ${lateBy} past its due date of ${longDay(r.due)}. Please arrange payment this week, or reply to let us know when to expect it.${signOff}`;
		}
		return `${greeting}This is a final reminder about invoice ${r.no} for ${owed}, now ${lateBy} overdue. If payment has not reached us by ${longDay(shiftDays(TODAY_ISO, 7))}, your Fieldline workspace will switch to read-only until it is settled.\n\nPlease reply if anything on the invoice needs correcting.\n\n${SIGNATURE}\nFieldline`;
	}

	/** The tone a reminder takes by how late the invoice is. */
	function suggestedTone(r) {
		if (statusOf(r) !== 'overdue' || daysLate(r) < 7) return 'friendly';
		return daysLate(r) < 21 ? 'firm' : 'final';
	}

	/* The sweep dialog: remind every overdue invoice at once. */

	function wireSweepDialog() {
		remindOverdueButton.addEventListener('click', () => {
			const lateOnes = records
				.filter((r) => statusOf(r) === 'overdue')
				.sort((a, b) => a.due.localeCompare(b.due));
			pick('[data-ivs-all="legend"]', sweep.box).textContent =
				`${upperFirst(spelled(lateOnes.length, 'overdue invoice'))}, ${dollarsAndCents(totalOf(lateOnes))}`;
			sweepList.innerHTML = lateOnes
				.map((r, i) => {
					const doneToday = r.reminded === TODAY_ISO;
					return (
						`<li class="ivs-pick"><input id="ivs-pick-${i}" type="checkbox" value="${r.no}" class="form-check-input"${doneToday ? '' : ' checked'}>` +
						`<label for="ivs-pick-${i}" class="ivs-pick-text"><span class="ivs-pick-name">${htmlSafe(customerOf(r).name)}</span>` +
						`<span class="ivs-sub">${r.no} · ${counted(daysLate(r), 'day')} late · ${doneToday ? 'reminded today' : TONE_LABEL[suggestedTone(r)]}</span></label>` +
						`<span class="ivs-pick-amt">${dollarsAndCents(r.amount)}</span></li>`
					);
				})
				.join('');
			sweep.form.classList.remove('is-picking-none');
			sweep.modal.show();
		});
		sweep.box.addEventListener('hidden.bs.modal', () => remindOverdueButton.focus({ focusVisible: false }));
		sweepList.addEventListener('change', () => sweep.form.classList.remove('is-picking-none'));

		sweep.form.addEventListener('submit', (event) => {
			event.preventDefault();
			const chosen = [...pickAll('input:checked', sweepList)].map((box) => recordByNo(box.value));
			if (!chosen.length) {
				sweep.form.classList.add('is-picking-none');
				pick('input', sweepList).focus();
				return;
			}
			for (const r of chosen) r.reminded = TODAY_ISO;
			sweep.modal.hide();
			redrawAll();
			notify({
				tone: 'success',
				icon: 'bi-bell',
				title: `${upperFirst(spelled(chosen.length, 'reminder'))} sent`,
				text: `To ${chosen.map((r) => customerOf(r).name).join(', ')}.`,
			});
		});
	}

	/* The new-invoice dialog: one line for one customer, sent now or kept as
     a draft. */

	function wireCreateDialog() {
		const customerSelect = creatorField('customer');
		const itemSelect = creatorField('item');
		const amountField = creatorField('amount');
		const byName = Object.keys(customerBook).sort((a, b) =>
			customerBook[a].name.localeCompare(customerBook[b].name),
		);
		customerSelect.innerHTML = `<option value="" hidden selected>Choose a customer</option>${byName
			.map((id) => `<option value="${id}">${htmlSafe(customerBook[id].name)}</option>`)
			.join('')}`;

		customerSelect.addEventListener('change', () => {
			showRecipient();
			markInvalid(customerSelect, false);
		});
		itemSelect.addEventListener('change', fillListPrice);
		for (const radio of pickAll('input[name="ivsTerms"]', creator.box))
			radio.addEventListener('change', showDueDate);

		creator.box.addEventListener('show.bs.modal', () => {
			creator.form.reset();
			customerSelect.value = '';
			clearInvalidIn(creator.form);
			fillListPrice();
			showRecipient();
			showDueDate();
		});
		for (const submitter of pickAll('[data-ivs-n-mode]', creator.box)) {
			submitter.addEventListener('click', () => {
				createMode = submitter.getAttribute('data-ivs-n-mode');
			});
		}

		creator.form.addEventListener('submit', (event) => {
			event.preventDefault();
			const accountId = customerSelect.value;
			const typed = parseFloat(amountField.value.replace(/[$,\s]/g, ''));
			const hasCustomer = Boolean(accountId);
			const hasAmount = typed > 0;
			markInvalid(customerSelect, !hasCustomer);
			markInvalid(amountField, !hasAmount);
			if (!hasCustomer) {
				/* The searchable select draws its own button right after the select. */
				const selectButton = customerSelect.nextElementSibling;
				if (selectButton && selectButton.focus) selectButton.focus();
				return;
			}
			if (!hasAmount) {
				amountField.focus();
				return;
			}
			addInvoice(accountId, itemSelect.value, typed);
		});
	}

	function creatorField(key) {
		return pick(`[data-ivs-n="${key}"]`, creator.box);
	}

	function chosenTerms() {
		return +pick('input[name="ivsTerms"]:checked', creator.box).value;
	}

	function showRecipient() {
		const customer = customerBook[creatorField('customer').value];
		creatorField('contact').textContent = customer ? `Goes to ${customer.contact} at ${customer.email}.` : '';
	}

	function showDueDate() {
		const terms = chosenTerms();
		creatorField('due').textContent = terms
			? `Due ${longDay(shiftDays(TODAY_ISO, terms))} if it is sent today.`
			: 'Due the day it is sent.';
	}

	/* Items with a fixed price fill the amount; the others leave it blank. */
	function fillListPrice() {
		const option = creatorField('item').selectedOptions[0];
		creatorField('amount').value = option && option.dataset.price ? (+option.dataset.price).toFixed(2) : '';
	}

	function addInvoice(accountId, itemName, typedAmount) {
		const terms = chosenTerms();
		const r = {
			no: `#${serial}`,
			acct: accountId,
			item: itemName,
			amount: Math.round(typedAmount * 100) / 100,
			terms,
		};
		taken.add(serial);
		while (taken.has(serial)) serial += 1;
		const asDraft = createMode === 'draft';
		Object.assign(
			r,
			asDraft
				? { state: 'draft', saved: TODAY_ISO }
				: { state: 'sent', issued: TODAY_ISO, due: shiftDays(TODAY_ISO, terms) },
		);
		records.unshift(r);
		creator.modal.hide();
		if (listView.tab !== 'all' && listView.tab !== statusOf(r)) switchTab('all');
		redrawAll(r.no);
		const openIt = [
			{
				label: 'Open',
				onClick: () => {
					window.location.href = invoiceLink(r);
				},
			},
		];
		const { name, contact } = customerOf(r);
		notify(
			asDraft
				? {
						tone: 'success',
						icon: 'bi-receipt',
						title: `${r.no} saved as a draft`,
						text: `${dollarsAndCents(r.amount)} for ${name}. Send it when it is ready.`,
						actions: openIt,
					}
				: {
						tone: 'success',
						icon: 'bi-send',
						title: `${r.no} sent`,
						text: `${dollarsAndCents(r.amount)} to ${contact}, due ${longDay(r.due)}.`,
						actions: openIt,
					},
		);
	}

	/* Facts about one invoice. */

	/** A page copy of a billing record, its payment and decline kept as dates. */
	function copyRecord(bookRow) {
		customerBook[bookRow.acct] = customerBook[bookRow.acct] || {
			name: bookRow.customer,
			contact: bookRow.contact,
			email: bookRow.email,
		};
		const pageCopy = {
			no: bookRow.no,
			acct: bookRow.acct,
			item: bookRow.item,
			amount: bookRow.amount,
			state: bookRow.state,
			terms: bookRow.terms,
		};
		for (const prop of ['saved', 'issued', 'due', 'opened', 'reminded', 'why']) {
			if (bookRow[prop]) pageCopy[prop] = bookRow[prop];
		}
		if (bookRow.paid) pageCopy.paid = { on: bookRow.paid.on, by: METHOD_WORDS[bookRow.paid.method] };
		if (bookRow.declined) pageCopy.declined = bookRow.declined.on;
		return pageCopy;
	}

	function statusOf(r) {
		return r.state === 'sent' && r.due < TODAY_ISO ? 'overdue' : r.state;
	}

	function daysLate(r) {
		return dayGap(r.due, TODAY_ISO);
	}

	function daysToGo(r) {
		return dayGap(TODAY_ISO, r.due);
	}

	function startedOn(r) {
		return r.issued || r.saved;
	}

	function customerOf(r) {
		return customerBook[r.acct];
	}

	function recordByNo(no) {
		return records.find((r) => r.no === no);
	}

	function bandByKey(key) {
		return BANDS.find((band) => band.key === key);
	}

	function invoiceLink(r) {
		return `invoice-details.html?id=${encodeURIComponent(r.no)}`;
	}

	function totalOf(subset) {
		return subset.reduce((sum, r) => sum + r.amount, 0);
	}

	/* Dates arrive as YYYY-MM-DD and are read as local days. */

	function asDate(isoDay) {
		const [year, month, date] = isoDay.split('-').map(Number);
		return new Date(year, month - 1, date);
	}

	function asIso(when) {
		return [when.getFullYear(), when.getMonth() + 1, when.getDate()]
			.map((part) => String(part).padStart(2, '0'))
			.join('-');
	}

	function shiftDays(isoDay, dayCount) {
		const when = asDate(isoDay);
		when.setDate(when.getDate() + dayCount);
		return asIso(when);
	}

	function dayGap(fromDay, toDay) {
		return Math.round((asDate(toDay) - asDate(fromDay)) / DAY_MS);
	}

	function shortDay(isoDay) {
		const when = asDate(isoDay);
		return `${SHORT_MONTHS[when.getMonth()]} ${when.getDate()}`;
	}

	function longDay(isoDay) {
		const when = asDate(isoDay);
		return `${LONG_MONTHS[when.getMonth()]} ${when.getDate()}`;
	}

	/* Words and numbers. */

	function dollarsAndCents(raw) {
		return `$${raw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function wholeDollars(raw) {
		return `$${Math.round(raw).toLocaleString('en-US')}`;
	}

	/** "1 invoice", "3 invoices"; `many` only when the plural is irregular. */
	function counted(n, one, many) {
		return `${n} ${n === 1 ? one : many || `${one}s`}`;
	}

	/** Like counted(), with numbers up to ten spelled out ("no drafts"). */
	function spelled(n, one, many) {
		return `${SMALL_NUMBERS[n] || n} ${n === 1 ? one : many || `${one}s`}`;
	}

	function upperFirst(phrase) {
		return phrase.charAt(0).toUpperCase() + phrase.slice(1);
	}

	function monogram(personName) {
		return personName
			.replace(/[^A-Za-z ]/g, '')
			.split(' ')
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0])
			.join('')
			.toUpperCase();
	}

	/** A steady avatar tone, 1 to 6, from the letters of a name. */
	function toneIndex(personName) {
		let codeSum = 0;
		for (const glyph of personName) codeSum += glyph.charCodeAt(0);
		return (codeSum % 6) + 1;
	}

	function htmlSafe(raw) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(raw == null ? '' : raw).replace(/[&<>"']/g, (ch) => entities[ch]);
	}

	/* Page services from basalt.js, each optional. */

	function notify(payload) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(payload) : null;
	}

	function speak(sentence) {
		window.Basalt.announce?.(sentence);
	}

	/* Dialogs and their fields. */

	function dialogParts(dialogSelector, formSelector) {
		const box = pick(dialogSelector);
		return { box, form: pick(formSelector, box), modal: bootstrap.Modal.getOrCreateInstance(box) };
	}

	function markInvalid(input, invalid) {
		input.classList.toggle('is-invalid', invalid);
		if (invalid) input.setAttribute('aria-invalid', 'true');
		else input.removeAttribute('aria-invalid');
	}

	function clearInvalidIn(formNode) {
		for (const flagged of pickAll('.is-invalid', formNode)) markInvalid(flagged, false);
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
