/**
 * Drives invoice-details.html, the single-invoice view a customer would receive,
 * plus the balance still open, the history of the bill and its attachments.
 * The ?id= query (for example #4015) chooses which bill to show, and
 * every invoice number on Invoices, Receipts, Income and Transactions links
 * here. A missing or unknown id falls back to the subscription renewal that
 * falls due next.
 *
 * Records come from window.Basalt.data.billing (assets/basalt/js/data/multipurpose/billing.js);
 * point billing.find() at your own store and keep the same record shape.
 */
(() => {
	'use strict';

	const page = pick('[data-ivc-root]', document);
	const book = window.Basalt.data?.billing;
	if (!page || !book) return;

	const TODAY_ISO = book.today;
	const everyInvoice = book.invoices();
	const bootstrapApi = window.bootstrap;

	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DAY_MS = 86400000;
	const twoDecimals = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

	/* How a settled payment method is spoken of in the history list. */
	const METHOD_WORDS = { ach: 'ACH', wire: 'wire', check: 'check', card: 'card' };

	/* The four lifecycle states a record may carry into the page. */
	const RECORD_STATES = { sent: 'sent', draft: 'draft', paid: 'paid', void: 'void' };

	/* Pill color, icon and wording for every status the page can reach. */
	const STATUS_LOOK = {
		draft: { tone: 'partial', glyph: 'bi-pencil', word: 'Draft' },
		partial: { tone: 'partial', glyph: 'bi-pie-chart-fill', word: 'Part paid' },
		sent: { tone: 'partial', glyph: 'bi-send', word: 'Sent' },
		paid: { tone: 'paid', glyph: 'bi-check-circle-fill', word: 'Paid' },
		void: { tone: 'void', glyph: 'bi-slash-circle', word: 'Void' },
	};

	/* Toast kinds map onto the .ivc-toast-* rules in invoice-details.css. */
	const TOAST_GLYPHS = {
		info: 'bi-info-circle-fill',
		done: 'bi-check-circle-fill',
		warn: 'bi-exclamation-triangle-fill',
		problem: 'bi-exclamation-octagon-fill',
	};

	/* Attachment icons by file extension; anything unlisted gets a plain page. */
	const FILE_GLYPHS = new Map(
		Object.entries({
			'bi-file-earmark-pdf': ['pdf'],
			'bi-file-earmark-spreadsheet': ['xls', 'xlsx', 'csv'],
			'bi-file-earmark-word': ['doc', 'docx'],
			'bi-file-earmark-image': ['png', 'jpg', 'jpeg', 'gif', 'webp'],
			'bi-file-earmark-zip': ['zip', 'rar', '7z'],
		}).flatMap(([glyph, extensions]) => extensions.map((ext) => [ext, glyph])),
	);
	const SIZE_UNITS = ['B', 'KB', 'MB', 'GB'];

	const shown = chooseInvoice();

	/* Filled in by start(): every money and status figure is drawn from ledger. */
	let ledger;
	let dueOn;
	let toastShelf;

	function start() {
		paintInvoice(shown);

		toastShelf = pick('.ivc-toast-region', document) || makeToastShelf();
		ledger = {
			total: Number.parseFloat(page.dataset.ivcTotal) || 0,
			paid: Number.parseFloat(page.dataset.ivcPaid) || 0,
			status: page.dataset.ivcStatus || 'sent',
		};
		dueOn = page.dataset.ivcDue;

		wireQuickActions();
		wireRecordDialog();
		wireEmailDialog();
		wireRecurringDialog();
		wirePaidDialog();
		wireVoidDialog();
		wireAttachments();

		refresh(false);
	}

	/** The requested invoice, else the renewal falling due soonest. */
	function chooseInvoice() {
		const upcoming = everyInvoice
			.filter((bill) => bill.state === 'sent' && bill.due >= TODAY_ISO)
			.sort((left, right) => left.due.localeCompare(right.due));
		const asked = book.find(new URLSearchParams(location.search).get('id'));
		return asked || upcoming.find((bill) => bill.kind === 'renewal') || upcoming[0] || everyInvoice[0];
	}

	/* Formatting shared by the document and the live figures. */

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return `${value ?? ''}`.replace(/[&<>"']/g, (ch) => entities[ch]);
	}

	/** Dollars with cents; negatives take a true minus sign. */
	function dollars(amount) {
		const sign = amount < 0 ? '−' : '';
		return `${sign}$${twoDecimals.format(Math.abs(amount))}`;
	}

	function parseDay(iso) {
		const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
		return new Date(year, month - 1, day);
	}

	function spellDay(iso) {
		const when = parseDay(iso);
		return `${MONTH_ABBR[when.getMonth()]} ${when.getDate()}, ${when.getFullYear()}`;
	}

	function customerLink(acct) {
		return `company-details.html?id=${encodeURIComponent(acct)}`;
	}

	/* Writing the chosen invoice into the page and its dialogs. */

	function putHtml(selector, html) {
		const target = pick(selector, document);
		if (target) target.innerHTML = html;
	}

	/**
	 * Copies one invoice record into every place that names it: the summary
	 * band, the paper document, the history, the files, the sibling invoices
	 * and the dialogs. Also stamps the figures start() reads back off the root.
	 */
	function paintInvoice(bill) {
		const settled = bill.paid ? bill.amount : 0;
		page.setAttribute('data-ivc-total', bill.amount);
		page.setAttribute('data-ivc-paid', settled);
		page.setAttribute('data-ivc-status', RECORD_STATES[bill.state]);
		page.setAttribute('data-ivc-due', bill.due);
		document.title = `${bill.no} · Basalt`;

		paintSummary(bill, settled);
		paintPaper(bill, settled);
		putHtml('[data-ivc-log]', historyFor(bill).map(historyItem).join(''));
		putHtml('[data-ivc-files]', attachmentsFor(bill).map(attachmentItem).join(''));
		paintSiblings(bill);
		paintDialogs(bill, settled);
	}

	function paintSummary(bill, settled) {
		const heading = pick('.ivc-summary-title', document);
		heading.firstChild.textContent = `${bill.no} `;

		const accountHref = bill.acct ? customerLink(bill.acct) : 'invoices.html';
		const purchaseBit = bill.purchase ? ` · <a href="${customerLink(bill.acct)}">${bill.purchase}</a>` : '';
		putHtml(
			'.ivc-summary-sub',
			`<a href="${accountHref}">${htmlSafe(bill.customer)}</a> · ${htmlSafe(bill.item)}${purchaseBit}`,
		);
		putHtml(
			'.ivc-summary-meta > span:first-child',
			`<strong data-ivc-paid-text>${dollars(settled)}</strong> paid of ${dollars(bill.amount)}`,
		);
	}

	function paintPaper(bill, settled) {
		putHtml('.ivc-doc-title-num', bill.no);

		const attention = `Attn: ${htmlSafe(bill.contact)}${bill.title ? `, ${htmlSafe(bill.title)}` : ''}`;
		const postal = bill.address.map(htmlSafe).join('<br>');
		putHtml(
			'.ivc-billto',
			`<p class="ivc-label">Billed to</p><p class="ivc-billto-name">${htmlSafe(bill.customer)}</p><p>${attention}<br>${postal}<br>${htmlSafe(bill.email)}</p>`,
		);

		const reference = bill.purchase
			? ['Purchase', `<a href="${customerLink(bill.acct)}">${bill.purchase}</a>`]
			: ['Account no.', htmlSafe(bill.accountNo)];
		const facts = [
			['Issued', bill.issued ? spellDay(bill.issued) : 'Not sent yet'],
			['Due', spellDay(bill.due)],
			['Terms', bill.terms === 30 ? 'Net 30' : 'Due on receipt'],
			reference,
			['Currency', 'USD'],
		];
		putHtml('.ivc-meta', facts.map(([term, detail]) => `<div><dt>${term}</dt><dd>${detail}</dd></div>`).join(''));

		putHtml('.ivc-items tbody', bill.lines.map(lineRow).join(''));
		putHtml('.ivc-totals-list', totalsFor(bill, settled).join(''));

		const quote = `<strong>${bill.no}</strong>${bill.purchase ? ` and <strong>${bill.purchase}</strong>` : ''}`;
		putHtml('.ivc-totals-note', `Please quote ${quote} on every payment so it is matched without a query.`);
		putHtml('.ivc-signature-meta', `Neal Carson, Finance Director · ${spellDay(bill.issued || bill.saved)}`);
	}

	function lineRow(line) {
		const extended = Math.round(line.qty * line.unit * 100) / 100;
		const figures = [line.qty, dollars(line.unit), dollars(extended)]
			.map((figure) => `<td class="ivc-items-num">${figure}</td>`)
			.join('');
		return `<tr><td><strong>${htmlSafe(line.name)}</strong><span>${htmlSafe(line.desc)}</span></td><td>${htmlSafe(line.period)}</td>${figures}</tr>`;
	}

	/** The totals ladder from subtotal down to the balance still owed. */
	function totalsFor(bill, settled) {
		const rung = (term, detail, rowClass = '', detailHook = '') =>
			`<div${rowClass ? ` class="${rowClass}"` : ''}><dt>${term}</dt><dd${detailHook ? ` ${detailHook}` : ''}>${detail}</dd></div>`;
		const ladder = [rung('Subtotal', dollars(bill.subtotal))];
		if (bill.discount) ladder.push(rung(htmlSafe(bill.discount.label), dollars(-bill.discount.amount)));
		if (bill.shipping) {
			const carriage = bill.shipping.amount ? dollars(bill.shipping.amount) : 'Free';
			ladder.push(rung(`Shipping, ${htmlSafe(bill.shipping.label)}`, carriage));
		}
		ladder.push(
			rung(bill.tax ? htmlSafe(bill.tax.label) : 'Tax', dollars(bill.tax ? bill.tax.amount : 0)),
			rung('Total', dollars(bill.amount), 'is-total'),
			rung('Paid', dollars(-settled), '', 'data-ivc-paid-row'),
			rung('Balance due', dollars(bill.amount - settled), 'is-balance', 'data-ivc-balance'),
		);
		return ladder;
	}

	/** Every recorded event on the bill, latest at the top. */
	function historyFor(bill) {
		const firstName = bill.contact.split(' ')[0];
		const milestones = [
			bill.issued
				? { text: `Sent to ${bill.email}`, on: bill.issued, tone: '' }
				: { text: 'Saved as a draft by John Armstrong', on: bill.saved, tone: '' },
			bill.opened && { text: `Opened by ${bill.customer}`, on: bill.opened, tone: 'view' },
			bill.reminded && { text: `Reminder sent to ${firstName}`, on: bill.reminded, tone: '' },
			bill.declined && {
				text: `Card payment declined · ${bill.declined.card}`,
				on: bill.declined.on,
				tone: 'void',
			},
			bill.paid && {
				text: `Payment received · ${dollars(bill.amount)} by ${METHOD_WORDS[bill.paid.method]}`,
				on: bill.paid.on,
				tone: 'paid',
			},
			bill.state === 'void' && { text: `Voided: ${bill.why}`, on: bill.issued, tone: 'void' },
		];
		return milestones.filter(Boolean).sort((left, right) => right.on.localeCompare(left.on));
	}

	function historyItem({ text, on, tone }) {
		const toneClass = tone ? ` class="is-${tone}"` : '';
		return `<li${toneClass}><span>${htmlSafe(text)}</span><time datetime="${on}">${spellDay(on)}</time></li>`;
	}

	/** The paperwork that shipped with the bill, as [file name, size] pairs. */
	function attachmentsFor(bill) {
		if (bill.purchase) {
			const tag = bill.purchase.toLowerCase();
			return [
				[`order-form-${tag}.pdf`, '96 KB'],
				[`scope-of-work-${tag}.pdf`, '74 KB'],
			];
		}
		const seats = bill.lines[0].desc.split(' ')[0];
		return [
			[`renewal-terms-${bill.acct}.pdf`, '188 KB'],
			[`seat-schedule-${seats}.csv`, '18 KB'],
		];
	}

	function attachmentItem([fileName, size]) {
		const glyph = fileName.endsWith('.csv') ? 'bi-file-earmark-spreadsheet' : 'bi-file-earmark-pdf';
		return `<li>${fileRowHtml(glyph, htmlSafe(fileName), size)}</li>`;
	}

	/** Up to four more bills for the same customer, each with its status pill. */
	function paintSiblings(bill) {
		const siblings = everyInvoice
			.filter((other) => other.customer === bill.customer && other.no !== bill.no)
			.slice(0, 4);
		putHtml('.ivc-related-title', `Other invoices for ${htmlSafe(bill.customer)}`);
		if (!siblings.length) {
			putHtml(
				'.ivc-related',
				`<li class="ivc-related-none">No other invoices since ${spellDay(book.since)}.</li>`,
			);
			return;
		}
		putHtml(
			'.ivc-related',
			siblings
				.map((other) => {
					const [tone, word] = siblingPill(other);
					return `<li><a href="invoice-details.html?id=${encodeURIComponent(other.no)}"><span>${other.no}</span><span>${dollars(other.amount)}</span><span class="ivc-pill ivc-pill-${tone}">${word}</span></a></li>`;
				})
				.join(''),
		);
	}

	function siblingPill(other) {
		if (other.state === 'paid') return ['paid', 'Paid'];
		if (other.state === 'sent' && other.due < TODAY_ISO) return ['overdue', 'Overdue'];
		if (other.state === 'void') return ['void', 'Void'];
		return ['partial', other.state === 'draft' ? 'Draft' : 'Sent'];
	}

	/* The dialogs quote the same invoice, and the email form comes prefilled. */
	function paintDialogs(bill, settled) {
		const firstName = bill.contact.split(' ')[0];
		const purchaseNote = bill.purchase ? `purchase ${bill.purchase}` : '';

		putHtml('[data-ivc-record-no]', bill.no);
		putHtml('[data-ivc-void-no]', bill.no);
		putHtml('[data-ivc-void-ask]', bill.no);
		putHtml('[data-ivc-recurring-to]', htmlSafe(bill.email));
		putHtml('[data-ivc-paid-ref]', purchaseNote ? `against ${bill.purchase}` : `from ${htmlSafe(bill.customer)}`);

		const prefill = {
			'ivc-email-to': bill.email,
			'ivc-email-subject': `Fieldline invoice ${bill.no} · ${bill.item}`,
			'ivc-email-msg': `${firstName},\n\nAttached is ${bill.no} for ${bill.item}${purchaseNote ? `, ${purchaseNote}` : ''}. ${dollars(bill.amount - settled)} is due on ${spellDay(bill.due)}.\n\nNils Carson\nFinance, Fieldline Inc.`,
		};
		for (const [fieldId, text] of Object.entries(prefill)) {
			const field = document.getElementById(fieldId);
			if (field) field.value = text;
		}
	}

	/* Live figures: the summary band, stamp and buttons follow the ledger. */

	function pick(selector, scope = page) {
		return scope.querySelector(selector);
	}

	function outstanding() {
		return Math.max(0, Math.round((ledger.total - ledger.paid) * 100) / 100);
	}

	/**
	 * Redraws everything that depends on the ledger. Pass true to replay the
	 * stamp animation after a payment or a void.
	 */
	function refresh(restamp) {
		const owed = outstanding();
		const look = STATUS_LOOK[ledger.status] || STATUS_LOOK.sent;
		const isVoid = ledger.status === 'void';

		const pill = pick('[data-ivc-pill]');
		if (pill) {
			pill.className = `ivc-pill ivc-pill-${look.tone}`;
			pill.innerHTML = `<i class="bi ${look.glyph}"></i> ${look.word}`;
		}

		const headline = pick('[data-ivc-balance-big]');
		const caption = pick('[data-ivc-balance-label]');
		if (headline) headline.textContent = dollars(isVoid ? 0 : owed);
		if (caption) caption.textContent = isVoid ? 'written off' : owed === 0 ? 'nothing due' : 'due';

		paintProgress();
		paintFigures(owed);
		paintStamp(look, restamp);
		pick('.ivc-paper')?.classList.toggle('is-void', isVoid);
		lockButtons();
		paintCountdown();
	}

	function paintProgress() {
		const share = ledger.total ? Math.min(100, Math.round((ledger.paid / ledger.total) * 100)) : 0;
		pick('[data-ivc-progress-bar]')?.style.setProperty('--paid', `${share}%`);
		pick('[data-ivc-progress]')?.setAttribute('aria-valuenow', share);
	}

	function paintFigures(owed) {
		const writes = [
			[pick('[data-ivc-paid-text]'), dollars(ledger.paid)],
			[pick('[data-ivc-paid-row]'), `−${dollars(ledger.paid)}`],
			[pick('[data-ivc-balance]'), dollars(owed)],
			[pick('[data-ivc-record-balance]', document), dollars(owed)],
			[pick('[data-ivc-paid-balance]', document), dollars(owed)],
		];
		for (const [node, text] of writes) {
			if (node) node.textContent = text;
		}
	}

	function paintStamp(look, restamp) {
		const stamp = pick('[data-ivc-stamp]');
		if (!stamp) return;
		const stillOpen = ledger.status === 'sent' || ledger.status === 'draft';
		stamp.className = `ivc-stamp ivc-stamp-${ledger.status === 'sent' ? 'partial' : look.tone}`;
		stamp.hidden = stillOpen;
		const stampWord = pick('[data-ivc-stamp-text]');
		if (stampWord) stampWord.textContent = look.word;
		if (!restamp) return;
		void stamp.offsetWidth;
		stamp.classList.add('is-restamp');
	}

	/* Paid and voided bills take no more money; a voided one is not sent again either. */
	function lockButtons() {
		const closed = ledger.status === 'paid' || ledger.status === 'void';
		for (const button of pickAll(
			'[data-ivc-action="record"], [data-ivc-action="paid"], [data-ivc-action="void"]',
			page,
		)) {
			button.disabled = closed;
		}
		if (ledger.status !== 'void') return;
		for (const button of pickAll('[data-ivc-action="email"], [data-ivc-action="recurring"]', page)) {
			button.disabled = true;
		}
	}

	function paintCountdown() {
		const badge = pick('[data-ivc-countdown]');
		if (!badge) return;
		const { tone, html } = countdownFace();
		badge.classList.remove('is-overdue', 'is-paid');
		if (tone) badge.classList.add(tone);
		badge.innerHTML = html;
	}

	/** The class and wording the due-date badge should carry right now. */
	function countdownFace() {
		if (ledger.status === 'paid')
			return { tone: 'is-paid', html: '<i class="bi bi-check-circle-fill"></i> Paid in full' };
		if (ledger.status === 'void') return { tone: '', html: '<i class="bi bi-slash-circle"></i> Voided' };

		const dueDay = parseDay(dueOn);
		const daysLeft = Math.round((dueDay - parseDay(TODAY_ISO)) / DAY_MS);
		if (daysLeft < 0) {
			const late = -daysLeft;
			return {
				tone: 'is-overdue',
				html: `<i class="bi bi-exclamation-triangle-fill"></i> Overdue by ${late} day${late === 1 ? '' : 's'}`,
			};
		}
		if (daysLeft === 0) return { tone: '', html: '<i class="bi bi-clock"></i> Due today' };
		const shortDate = `${MONTH_ABBR[dueDay.getMonth()]} ${dueDay.getDate()}`;
		return {
			tone: '',
			html: `<i class="bi bi-clock"></i> Due ${shortDate} · in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
		};
	}

	/* History entries and payments made from this screen. */

	function prependHistory(text, tone) {
		const list = pick('[data-ivc-log]');
		if (!list) return;
		const entry = document.createElement('li');
		entry.className = tone ? `is-new is-${tone}` : 'is-new';
		const words = document.createElement('span');
		words.textContent = text;
		const stamp = document.createElement('time');
		stamp.textContent = spellDay(TODAY_ISO);
		entry.append(words, stamp);
		list.prepend(entry);
	}

	/** Books a payment, redraws, and reports whether nothing is owed now. */
	function takePayment(amount, method) {
		ledger.paid = Math.round((ledger.paid + amount) * 100) / 100;
		const cleared = outstanding() === 0;
		ledger.status = cleared ? 'paid' : 'partial';
		prependHistory(`Payment received · ${dollars(amount)}${method ? ` by ${method}` : ''}`, 'paid');
		refresh(true);
		return cleared;
	}

	/* Toast notices in a polite live region at the foot of the body. */

	function makeToastShelf() {
		const shelf = document.createElement('div');
		shelf.className = 'ivc-toast-region';
		shelf.setAttribute('aria-live', 'polite');
		document.body.appendChild(shelf);
		return shelf;
	}

	/**
	 * Shows a short notice. Kinds: info for work in progress, done for a
	 * finished action, warn for something to notice, problem for a failure.
	 */
	function notify(message, kind = 'info', lingerMs = 3200) {
		const toast = document.createElement('div');
		toast.className = `ivc-toast ivc-toast-${kind}`;
		toast.innerHTML = `<i class="bi ${TOAST_GLYPHS[kind] || TOAST_GLYPHS.info}"></i><span></span>`;
		pick('span', toast).textContent = message;
		toastShelf.appendChild(toast);
		setTimeout(() => {
			toast.classList.add('is-out');
			setTimeout(() => toast.remove(), 250);
		}, lingerMs);
		return toast;
	}

	/* Header buttons and the five dialogs. */

	function wireQuickActions() {
		const download = pick('[data-ivc-action="download"]');
		download?.addEventListener('click', () => {
			notify('Rendering the PDF…', 'info', 1900);
			download.disabled = true;
			setTimeout(() => {
				notify(`Saved invoice-${shown.no}.pdf to your downloads`, 'done');
				download.disabled = false;
			}, 2000);
		});
		pick('[data-ivc-action="print"]')?.addEventListener('click', () => window.print());
		pick('[data-ivc-action="duplicate"]')?.addEventListener('click', () =>
			notify(`Copied to a new draft for ${shown.customer}`, 'info'),
		);
	}

	function wireRecordDialog() {
		const dialog = document.getElementById('invoice-record-modal');
		const dialogForm = document.getElementById('invoice-record-form');
		if (!dialog || !dialogForm || !bootstrapApi) return;

		const modal = new bootstrapApi.Modal(dialog);
		const amountField = pick('#ivc-pay-amount', dialogForm);
		const dateField = pick('#ivc-pay-date', dialogForm);
		const methodField = pick('#ivc-pay-method', dialogForm);
		const problem = pick('[data-ivc-record-error]', dialogForm);
		const fillOwed = pick('[data-ivc-record-full]', dialogForm);

		const flag = (message) => {
			problem.textContent = message || '';
			problem.hidden = !message;
			amountField.classList.toggle('is-invalid', Boolean(message));
		};

		pick('[data-ivc-action="record"]')?.addEventListener('click', () => {
			amountField.value = outstanding().toFixed(2);
			dateField.value = TODAY_ISO;
			flag('');
			modal.show();
		});
		fillOwed?.addEventListener('click', () => {
			amountField.value = outstanding().toFixed(2);
			flag('');
		});
		amountField.addEventListener('input', () => flag(''));

		dialogForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const received = Math.round(parseFloat(amountField.value) * 100) / 100;
			if (!(received > 0)) return flag('Enter the amount you received.');
			if (received > outstanding()) return flag(`That is more than the ${dollars(outstanding())} still due.`);
			modal.hide();
			const cleared = takePayment(received, methodField.value);
			notify(
				cleared
					? 'Paid in full. Nothing left to collect.'
					: `${dollars(received)} recorded. ${dollars(outstanding())} still due.`,
				'done',
			);
		});
	}

	/**
	 * Hooks a validated form dialog to its header button; onSend runs once the
	 * form passes and the dialog has closed.
	 */
	function wireFormDialog(dialogId, formId, action, onSend) {
		const dialog = document.getElementById(dialogId);
		const dialogForm = document.getElementById(formId);
		if (!dialog || !dialogForm || !bootstrapApi) return;

		const modal = new bootstrapApi.Modal(dialog);
		pick(`[data-ivc-action="${action}"]`)?.addEventListener('click', () => modal.show());
		dialogForm.addEventListener('submit', (event) => {
			event.preventDefault();
			if (!dialogForm.checkValidity()) {
				dialogForm.classList.add('was-validated');
				return;
			}
			onSend(dialogForm, modal);
		});
	}

	function wireEmailDialog() {
		wireFormDialog('invoice-email-modal', 'invoice-email-form', 'email', (dialogForm, modal) => {
			const recipient = pick('#ivc-email-to', dialogForm).value.trim();
			modal.hide();
			dialogForm.classList.remove('was-validated');
			prependHistory(`Sent to ${recipient}`, null);
			notify(`On its way to ${recipient}`, 'done');
		});
	}

	function wireRecurringDialog() {
		wireFormDialog('invoice-recurring-modal', 'invoice-recurring-form', 'recurring', (dialogForm, modal) => {
			const cycle = pick('#ivc-rec-freq', dialogForm).value;
			modal.hide();
			dialogForm.classList.remove('was-validated');
			notify(`Now billing on a ${cycle} cycle`, 'info');
		});
	}

	function wirePaidDialog() {
		const dialog = document.getElementById('invoice-paid-modal');
		if (!dialog || !bootstrapApi) return;
		const modal = new bootstrapApi.Modal(dialog);
		pick('[data-ivc-action="paid"]')?.addEventListener('click', () => modal.show());
		pick('[data-ivc-confirm="paid"]', dialog)?.addEventListener('click', () => {
			modal.hide();
			takePayment(outstanding(), null);
			notify('Paid in full. Nothing left to collect.', 'done');
		});
	}

	/* Voiding waits until the invoice number has been typed into the guard field. */
	function wireVoidDialog() {
		const dialog = document.getElementById('invoice-void-modal');
		if (!dialog || !bootstrapApi) return;
		const modal = new bootstrapApi.Modal(dialog);
		const confirm = pick('[data-ivc-confirm="void"]', dialog);
		const guard = pick('#ivc-void-input', dialog);
		const wanted = () => (pick('[data-ivc-void-no]', dialog)?.textContent || '').replace(/\D/g, '');
		const armConfirm = () => {
			if (confirm && guard) confirm.disabled = guard.value.replace(/\D/g, '') !== wanted();
		};

		guard?.addEventListener('input', armConfirm);
		pick('[data-ivc-action="void"]')?.addEventListener('click', () => {
			if (guard) guard.value = '';
			armConfirm();
			modal.show();
		});
		confirm?.addEventListener('click', () => {
			if (confirm.disabled) return;
			ledger.status = 'void';
			modal.hide();
			prependHistory('Invoice voided', 'void');
			refresh(true);
			notify('Voided, and the customer has been told', 'warn');
		});
	}

	/* Attachments: drop zone, file picker and per-row removal. */

	function wireAttachments() {
		const zone = pick('[data-ivc-drop]');
		const list = pick('[data-ivc-files]');
		const picker = pick('[data-ivc-file-input]');
		const openPicker = () => picker?.click();

		/* One delegated listener serves the starting rows and any added later. */
		list?.addEventListener('click', (event) => {
			event.target.closest('.ivc-files-remove')?.closest('li').remove();
		});

		if (zone) {
			zone.addEventListener('click', openPicker);
			zone.addEventListener('keydown', (event) => {
				if (event.key !== 'Enter' && event.key !== ' ') return;
				event.preventDefault();
				openPicker();
			});
			const dragStates = { dragenter: true, dragover: true, dragleave: false, drop: false };
			for (const [type, hovering] of Object.entries(dragStates)) {
				zone.addEventListener(type, (event) => {
					event.preventDefault();
					zone.classList.toggle('is-drag', hovering);
				});
			}
			zone.addEventListener('drop', (event) => attachFiles(list, event.dataTransfer?.files));
		}

		picker?.addEventListener('change', (event) => {
			attachFiles(list, event.target.files);
			picker.value = '';
		});
	}

	function attachFiles(list, files) {
		if (!files?.length) return;
		if (list) {
			for (const upload of files) {
				const row = document.createElement('li');
				row.innerHTML = fileRowHtml(
					glyphForFile(upload.name),
					htmlSafe(upload.name),
					readableSize(upload.size),
				);
				list.appendChild(row);
			}
		}
		notify(`${files.length} file${files.length === 1 ? '' : 's'} attached`, 'done');
	}

	/** One attachment row; safeName must already be HTML-escaped. */
	function fileRowHtml(glyph, safeName, size) {
		return `<i class="bi ${glyph}"></i><span class="ivc-files-name">${safeName}</span><span class="ivc-files-size">${size}</span><button type="button" class="ivc-files-remove" aria-label="Remove ${safeName}"><i class="bi bi-x-lg"></i></button>`;
	}

	function glyphForFile(fileName) {
		const extension = (fileName.split('.').pop() || '').toLowerCase();
		return FILE_GLYPHS.get(extension) || 'bi-file-earmark-text';
	}

	function readableSize(bytes) {
		if (!bytes) return '—';
		let scaled = bytes;
		let step = 0;
		while (scaled >= 1024 && step < SIZE_UNITS.length - 1) {
			scaled /= 1024;
			step += 1;
		}
		return `${scaled.toFixed(scaled < 10 && step > 0 ? 1 : 0)} ${SIZE_UNITS[step]}`;
	}

	start();

	/* DOM lookups, shared by every helper above. */
	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
