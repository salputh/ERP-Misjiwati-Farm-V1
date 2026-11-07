/**
 * Runs new-invoice.html: the editing form sits on the left and, on the
 * right, the sheet the customer will get, redrawn on every change. That
 * sheet borrows its styling from the Invoice Details page (invoice-details.css).
 *
 * The billable catalog is assembled from shared data: plans and add-ons
 * from accounts.js, and set-up, training and other extras from the lines
 * already on billing.js invoices, priced as those invoices price them.
 * Sales tax follows the account's address (sales-tax.js) and applies to
 * extras only; plans and add-ons go out untaxed, as subscriptions do.
 *
 * Open new-invoice.html?customer=<account id> to preselect an account.
 * Save and Send end in a toast in this demo; a real app would post the
 * form to its billing backend at those two points.
 */
(() => {
	'use strict';

	const page = pick('[data-inew-root]');
	if (!page) return;
	const { accounts: accountBook, billing: billingBook, salesTax: taxBook } = window.Basalt.data || {};
	if (!accountBook || !billingBook || !taxBook) return;

	const TODAY_ISO = billingBook.today;
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const twoDecimals = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

	/* Terms the dropdown offers as fixed day counts; anything else is custom. */
	const PRESET_TERMS = ['30', '15', '7', '0'];

	/* Extras are listed in selling order: set-up, then training, then the rest. */
	const EXTRA_SEQUENCE = [
		'onboarding',
		'setup',
		'staff',
		'import',
		'profiles',
		'training',
		'course',
		'form',
		'report',
		'sms',
		'phone',
		'storage',
	];

	const catalog = buildCatalog();
	/* Trial accounts cannot be invoiced, so they never reach the picker. */
	const billable = accountBook
		.list()
		.filter((account) => account.status !== 'trial')
		.sort((left, right) => left.name.localeCompare(right.name));
	const suggestedNumber = nextInvoiceNumber();

	const customerPicker = formPart('customer');
	const termsPicker = formPart('terms');
	const issuedPicker = formPart('issued');
	const duePicker = formPart('due');
	const discountField = formPart('discount');
	const lineList = pick('[data-inew-lines]', page);
	const linesProblem = pick('[data-inew-lines-error]', page);
	const dueProblem = pick('#inew-due-error');
	const discountUnit = pick('[data-inew-discount-unit]', page);
	const addButton = pick('[data-inew-add]', page);
	const sendDialog = pick('#inew-send');
	const datePicker = window.Basalt.datepicker;

	/* The whole editor reads from this one object; the DOM only mirrors it. */
	const draft = {
		account: null,
		issuedOn: TODAY_ISO,
		dueOn: shiftDays(TODAY_ISO, 30),
		lines: [],
		discountMode: 'pct',
	};
	let lineSerial = 1;
	/* Raised while the code moves the due date itself, so its echo is ignored. */
	let settingDue = false;

	function start() {
		customerPicker.innerHTML = `<option value="" selected>Choose a customer</option>${billable.map(customerOption).join('')}`;
		formPart('number').value = suggestedNumber;

		wireLines();
		wireCustomer();
		wireDates();
		wireDiscount();
		for (const partName of ['number', 'note', 'terms-text']) {
			formPart(partName).addEventListener('input', () => {
				markInvalid(formPart(partName), false);
				recalculate();
			});
		}
		wireDraftButton();
		wireSendDialog();

		if (document.readyState === 'complete') firstPaint();
		else document.addEventListener('DOMContentLoaded', firstPaint);
	}

	/* Sets the dates, applies any ?customer=, and draws the starting state. */
	function firstPaint() {
		datePicker.set(issuedPicker, draft.issuedOn);
		moveDue(draft.dueOn);
		const requested = new URLSearchParams(window.location.search).get('customer');
		if (requested && findAccount(requested)) {
			customerPicker.value = requested;
			draft.account = findAccount(requested);
		}
		appendLine('', 1);
		renderLines();
		renderContact();
		recalculate();
	}

	/* Catalog, accounts and numbering, all derived from the shared data. */

	/**
	 * Everything that can go on a line. group is plan, addon or extra; only
	 * extras are taxable. Plans and add-ons are priced per seat per month.
	 */
	function buildCatalog() {
		const offerings = [];
		for (const [code, plan] of Object.entries(accountBook.plans)) {
			offerings.push({
				code: `plan-${code}`,
				label: `${plan.name} plan`,
				detail: 'Per seat, one month',
				price: plan.price,
				group: 'plan',
				hint: `$${plan.price} a seat a month`,
			});
		}
		for (const code of ['route', 'portal']) {
			const addOn = accountBook.addOns[code];
			offerings.push({
				code: `addon-${code}`,
				label: addOn.name,
				detail: 'Add-on, per seat, one month',
				price: addOn.per,
				group: 'addon',
				hint: `$${addOn.per} a seat a month`,
			});
		}

		const firstSeen = new Map();
		for (const invoice of billingBook.invoices()) {
			for (const line of invoice.lines) {
				if (line.key && !firstSeen.has(line.key)) firstSeen.set(line.key, line);
			}
		}
		const unlisted = [...firstSeen.keys()].filter((code) => !EXTRA_SEQUENCE.includes(code));
		for (const code of [...EXTRA_SEQUENCE, ...unlisted]) {
			const exemplar = firstSeen.get(code);
			if (!exemplar) continue;
			offerings.push({
				code: `extra-${code}`,
				label: exemplar.name,
				detail: exemplar.desc,
				price: exemplar.unit,
				group: 'extra',
				hint: `$${exemplar.unit.toLocaleString('en-US')} each`,
			});
		}
		return offerings;
	}

	/** Follows the Invoices page: invoices made by hand number up from 7001, skipping any in use. */
	function nextInvoiceNumber() {
		const taken = new Set(billingBook.invoices().map((invoice) => Number(invoice.no.replace(/\D/g, ''))));
		let next = 7001;
		while (taken.has(next)) next += 1;
		return `#${next}`;
	}

	function findItem(code) {
		return catalog.find((entry) => entry.code === code) || null;
	}

	function findAccount(id) {
		return billable.find((account) => account.id === id) || null;
	}

	function currentTax() {
		return draft.account ? taxBook.forAccount(draft.account) : null;
	}

	/* Line items: markup, editing and removal. */

	function appendLine(code, quantity) {
		const item = findItem(code);
		const line = {
			id: lineSerial++,
			itemKey: item ? item.code : '',
			quantity: quantity || 1,
			unitPrice: item ? item.price : '',
			taxed: Boolean(item && item.group === 'extra' && currentTax()),
		};
		draft.lines.push(line);
		return line;
	}

	function lineFor(row) {
		const id = Number(row.getAttribute('data-inew-line'));
		return draft.lines.find((line) => line.id === id);
	}

	/** Redraws every row; focusId moves focus to that row's item picker. */
	function renderLines(focusId) {
		lineList.innerHTML = draft.lines.map(lineMarkup).join('');
		const single = draft.lines.length < 2;
		for (const remover of pickAll('.inew-line-remove', lineList)) remover.hidden = single;
		window.Basalt.tips?.(lineList);
		if (!focusId) return;
		const itemSelect = pick(`[data-inew-line="${focusId}"]`, lineList)?.querySelector('[data-inew-l="item"]');
		if (itemSelect) focusableFor(itemSelect).focus();
	}

	function lineMarkup(line, index) {
		const idStem = `inew-line-${line.id}`;
		const ordinal = index + 1;
		const shownPrice = line.unitPrice === '' ? '' : line.unitPrice.toFixed(2);
		const textCell = (part, caption, mode, value) =>
			`<div class="inew-line-${part}"><label for="${idStem}${caption}" class="inew-line-label">${caption}</label><input data-inew-l="${part}" id="${idStem}${caption}" type="text" inputmode="${mode}" value="${value}" class="form-control inew-num"></div>`;

		return (
			`<li data-inew-line="${line.id}" class="inew-line">` +
			`<div class="inew-line-item"><label for="${idStem}Item" class="visually-hidden">Item, line ${ordinal}</label><select data-basalt-select="search" data-inew-l="item" id="${idStem}Item" class="form-select">${itemOptions(line.itemKey)}</select></div>${textCell(
				'qty',
				'Qty',
				'numeric',
				line.quantity,
			)}${textCell(
				'price',
				'Price',
				'decimal',
				shownPrice,
			)}<div class="inew-line-tax"><label for="${idStem}Tax" class="inew-line-label">Tax</label><select data-inew-l="tax" id="${idStem}Tax" class="form-select">${taxOptions(line)}</select></div>` +
			`<div class="inew-line-amount"><span aria-hidden="true" class="inew-line-label">Amount</span><p data-inew-l="amount" class="inew-num">${dollars(extendedPrice(line))}</p></div>` +
			`<button data-inew-remove data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Remove line" aria-label="Remove line ${ordinal}" type="button" class="btn btn-icon btn-sm inew-line-remove"><i aria-hidden="true" class="bi bi-x-lg"></i></button>` +
			`</li>`
		);
	}

	function itemOptions(chosen) {
		const choices = catalog.map(
			(entry) =>
				`<option value="${entry.code}" data-hint="${htmlSafe(entry.hint)}"${entry.code === chosen ? ' selected' : ''}>${htmlSafe(entry.label)}</option>`,
		);
		return `<option value=""${chosen ? '' : ' selected'}>Choose an item</option>${choices.join('')}`;
	}

	function taxOptions(line) {
		const rate = currentTax();
		const rateChoice = rate
			? `<option value="rate" data-hint="${htmlSafe(rate.label)}"${line.taxed ? ' selected' : ''}>${rate.rate}%</option>`
			: '';
		return `<option value="none"${line.taxed ? '' : ' selected'}>No tax</option>${rateChoice}`;
	}

	function customerOption(account) {
		return `<option value="${htmlSafe(account.id)}" data-hint="${htmlSafe(account.no)}">${htmlSafe(account.name)}</option>`;
	}

	/** Quantity times price to the cent, or zero while either is unreadable. */
	function extendedPrice(line) {
		const quantity = readNumber(line.quantity);
		const price = typeof line.unitPrice === 'number' ? line.unitPrice : NaN;
		return Number.isFinite(quantity) && Number.isFinite(price) ? roundCents(quantity * price) : 0;
	}

	function wireLines() {
		lineList.addEventListener('change', (event) => {
			const row = event.target.closest('[data-inew-line]');
			if (!row) return;
			const line = lineFor(row);
			const onChange = {
				item: () => pickItem(line, row, event.target.value),
				tax: () => {
					line.taxed = event.target.value === 'rate';
				},
				price: () => {
					const typed = readNumber(event.target.value);
					if (Number.isFinite(typed)) event.target.value = roundCents(typed).toFixed(2);
				},
			};
			onChange[event.target.getAttribute('data-inew-l')]?.();
			recalculate();
		});

		lineList.addEventListener('input', (event) => {
			const row = event.target.closest('[data-inew-line]');
			if (!row) return;
			const line = lineFor(row);
			const part = event.target.getAttribute('data-inew-l');
			if (part === 'qty') line.quantity = event.target.value;
			if (part === 'price') {
				const typed = readNumber(event.target.value);
				line.unitPrice = Number.isFinite(typed) ? roundCents(typed) : '';
			}
			markInvalid(event.target, false);
			recalculate();
		});

		lineList.addEventListener('click', (event) => {
			const remover = event.target.closest('[data-inew-remove]');
			if (remover) dropLine(remover);
		});

		addButton.addEventListener('click', () => {
			const line = appendLine('', 1);
			renderLines(line.id);
			linesProblem.hidden = true;
			speak(`Line ${draft.lines.length} added.`);
			recalculate();
		});
	}

	/* A newly chosen item brings its own price and tax default with it. */
	function pickItem(line, row, code) {
		const item = findItem(code);
		line.itemKey = item ? item.code : '';
		if (!item) return;
		line.unitPrice = item.price;
		line.taxed = item.group === 'extra' && Boolean(currentTax());
		pick('[data-inew-l="price"]', row).value = item.price.toFixed(2);
		pick('[data-inew-l="tax"]', row).value = line.taxed ? 'rate' : 'none';
	}

	/* Removing a row hands focus to the row now in its place, or to Add line. */
	function dropLine(remover) {
		const row = remover.closest('[data-inew-line]');
		const id = Number(row.getAttribute('data-inew-line'));
		const index = draft.lines.findIndex((line) => line.id === id);
		if (window.bootstrap) bootstrap.Tooltip.getInstance(remover)?.dispose();
		draft.lines.splice(index, 1);
		renderLines();
		const successor = pickAll('[data-inew-line]', lineList)[Math.min(index, draft.lines.length - 1)];
		const nextFocus = successor ? pick('[data-inew-l="qty"]', successor) : addButton;
		nextFocus?.focus();
		speak('Line removed.');
		recalculate();
	}

	/* Customer, dates and discount. */

	function wireCustomer() {
		customerPicker.addEventListener('change', () => {
			draft.account = findAccount(customerPicker.value);
			markInvalid(customerPicker, false);
			/* A new address may carry a new rate, which extras pick up by default. */
			const rate = currentTax();
			for (const line of draft.lines) {
				const item = findItem(line.itemKey);
				line.taxed = Boolean(rate && item && item.group === 'extra');
			}
			renderLines();
			renderContact();
			recalculate();
		});
	}

	function renderContact() {
		const recipient = draft.account ? billingBook.billTo(draft.account.id) : null;
		formPart('contact').textContent = recipient
			? `Goes to ${recipient.contact}, ${recipient.title.charAt(0).toLowerCase()}${recipient.title.slice(1)}, at ${recipient.email}.`
			: 'The invoice goes to the account’s billing contact.';
	}

	function wireDates() {
		termsPicker.addEventListener('change', () => {
			dueFromTerms();
			validateDue();
			recalculate();
		});

		issuedPicker.addEventListener('change', (event) => {
			if (settingDue) return;
			draft.issuedOn = event.detail?.value || datePicker.get(issuedPicker) || draft.issuedOn;
			dueFromTerms();
			validateDue();
			recalculate();
		});

		duePicker.addEventListener('change', (event) => {
			if (settingDue) return;
			draft.dueOn = event.detail?.value || datePicker.get(duePicker) || draft.dueOn;
			const daysApart = Math.round((parseDay(draft.dueOn) - parseDay(draft.issuedOn)) / 864e5);
			termsPicker.value = PRESET_TERMS.find((days) => Number(days) === daysApart) || 'custom';
			validateDue();
			recalculate();
		});
	}

	function dueFromTerms() {
		if (termsPicker.value === 'custom') return;
		moveDue(shiftDays(draft.issuedOn, Number(termsPicker.value)));
	}

	function moveDue(iso) {
		settingDue = true;
		datePicker.set(duePicker, iso);
		settingDue = false;
		draft.dueOn = iso;
	}

	/** Flags a due date earlier than the issue date; true when the dates are fine. */
	function validateDue() {
		const backwards = draft.dueOn < draft.issuedOn;
		markInvalid(pick('input.form-control', duePicker), backwards);
		dueProblem.textContent = backwards ? 'The due date is before the issue date.' : '';
		dueProblem.hidden = !backwards;
		return !backwards;
	}

	function termsLabel() {
		const choice = termsPicker.value;
		if (choice === 'custom') return `Due ${shortDay(draft.dueOn)}`;
		return Number(choice) ? `Net ${choice}` : 'Due on receipt';
	}

	function wireDiscount() {
		for (const toggle of pickAll('[data-inew-discount-kind]', page)) {
			toggle.addEventListener('change', () => {
				draft.discountMode = toggle.value;
				discountUnit.textContent = toggle.value === 'pct' ? '%' : '$';
				discountField.value = '0';
				recalculate();
			});
		}
		discountField.addEventListener('input', () => {
			markInvalid(discountField, false);
			recalculate();
		});
	}

	/* Money: the running figures, both totals panels and the preview sheet. */

	/**
	 * Subtotal, discount, tax and total for the current draft. The discount
	 * shrinks the taxable amount in proportion before the rate is applied.
	 */
	function tally() {
		const rate = currentTax();
		const subtotal = roundCents(draft.lines.reduce((sum, line) => sum + extendedPrice(line), 0));
		const taxable = draft.lines
			.filter((line) => line.taxed && rate)
			.reduce((sum, line) => sum + extendedPrice(line), 0);
		const typed = readNumber(discountField.value);
		const requested = Number.isFinite(typed) && typed >= 0 ? typed : 0;
		const byPercent = draft.discountMode === 'pct';
		const discount = byPercent
			? roundCents((subtotal * Math.min(requested, 100)) / 100)
			: roundCents(Math.min(requested, subtotal));
		const kept = subtotal ? 1 - discount / subtotal : 1;
		const tax = rate ? roundCents((taxable * kept * rate.rate) / 100) : 0;
		return {
			subtotal,
			discount,
			percent: byPercent ? Math.min(requested, 100) : null,
			tax,
			taxLabel: rate ? rate.label : '',
			total: roundCents(subtotal - discount + tax),
		};
	}

	/** Totals as dl rows; the paper copy adds a balance-due line. */
	function totalsMarkup(figures, onPaper) {
		const row = (term, detail, rowClass) =>
			`<div${rowClass ? ` class="${rowClass}"` : ''}><dt>${term}</dt><dd>${detail}</dd></div>`;
		const percentNote = figures.percent != null ? ` ${+figures.percent.toFixed(2)}%` : '';
		return [
			row('Subtotal', dollars(figures.subtotal)),
			figures.discount ? row(`Discount${percentNote}`, `−${dollars(figures.discount)}`) : '',
			row(htmlSafe(figures.taxLabel || 'Tax'), dollars(figures.tax)),
			row('Total', dollars(figures.total), 'is-total'),
			onPaper ? row('Balance due', dollars(figures.total), 'is-balance') : '',
		].join('');
	}

	function recalculate() {
		const figures = tally();
		for (const row of pickAll('[data-inew-line]', lineList)) {
			pick('[data-inew-l="amount"]', row).textContent = dollars(extendedPrice(lineFor(row)));
		}
		pick('[data-inew-totals]', page).innerHTML = totalsMarkup(figures, false);
		renderSheet(figures);
	}

	function renderSheet(figures) {
		const account = draft.account;
		sheetPart('number').textContent = formPart('number').value.trim() || 'No number';
		sheetPart('billto').innerHTML =
			`<p class="ivc-label">Billed to</p>${account ? addressMarkup(account) : '<p class="ivc-billto-name">Customer</p><p>Choose a customer and their address shows here.</p>'}`;
		sheetPart('issued').textContent = longDay(draft.issuedOn);
		sheetPart('due').textContent = longDay(draft.dueOn);
		sheetPart('terms').textContent = termsLabel();
		sheetPart('account').textContent = account ? account.no : '–';

		const filled = draft.lines.filter((line) => findItem(line.itemKey));
		sheetPart('items').innerHTML = filled.length
			? filled.map(sheetRow).join('')
			: '<tr class="inew-items-empty"><td colspan="5">Lines you add show here.</td></tr>';
		sheetPart('totals').innerHTML = totalsMarkup(figures, true);

		const note = formPart('note').value.trim();
		sheetPart('note').hidden = !note;
		sheetPart('note').textContent = note;
		sheetPart('terms-text').textContent = formPart('terms-text').value.trim();
		sheetPart('signed').textContent = `Neal Carson, Finance Director · ${longDay(draft.issuedOn)}`;
	}

	function addressMarkup(account) {
		const recipient = billingBook.billTo(account.id);
		return `<p class="ivc-billto-name">${htmlSafe(account.name)}</p><p>Attn: ${htmlSafe(recipient.contact)}, ${htmlSafe(recipient.title)}<br>${account.address.map(htmlSafe).join('<br>')}<br>${htmlSafe(recipient.email)}</p>`;
	}

	function sheetRow(line) {
		const item = findItem(line.itemKey);
		const quantity = readNumber(line.quantity);
		const figureCells = [
			Number.isFinite(quantity) ? quantity.toLocaleString('en-US') : '–',
			typeof line.unitPrice === 'number' ? dollars(line.unitPrice) : '–',
			dollars(extendedPrice(line)),
		]
			.map((figure) => `<td class="ivc-items-num">${figure}</td>`)
			.join('');
		const taxNote = line.taxed && currentTax() ? ', taxed' : '';
		return `<tr><td><strong>${htmlSafe(item.label)}</strong><span>${htmlSafe(item.detail)}${taxNote}</span></td><td>${htmlSafe(servicePeriod(item))}</td>${figureCells}</tr>`;
	}

	/* Extras are a one-off purchase; plans and add-ons cover one month ahead. */
	function servicePeriod(item) {
		if (!item) return '';
		if (item.group === 'extra') return `Bought ${longDay(draft.issuedOn)}`;
		const periodEnd = shiftDays(nextMonth(draft.issuedOn), -1);
		return `${shortDay(draft.issuedOn)}–${longDay(periodEnd)}`;
	}

	/* Validation, saving and sending. */

	/**
	 * Marks every problem and focuses the first one. A draft only needs a
	 * customer and a number; complete adds the lines, the total and the dates.
	 * Returns true when nothing is wrong.
	 */
	function validate(complete) {
		let firstProblem = null;
		const judge = (control, wrong, focusOn = control) => {
			markInvalid(control, wrong);
			if (wrong && !firstProblem) firstProblem = focusOn;
		};

		judge(customerPicker, !draft.account, focusableFor(customerPicker));
		judge(formPart('number'), !formPart('number').value.trim());
		if (complete) {
			let usableLine = false;
			for (const line of draft.lines) {
				if (!line.itemKey && draft.lines.length > 1 && line.unitPrice === '') continue;
				const row = pick(`[data-inew-line="${line.id}"]`, lineList);
				const itemPicker = pick('[data-inew-l="item"]', row);
				const quantity = readNumber(line.quantity);
				const noItem = !line.itemKey;
				const badQuantity = !(quantity > 0);
				const badPrice = !(typeof line.unitPrice === 'number' && line.unitPrice >= 0);
				judge(itemPicker, noItem, focusableFor(itemPicker));
				judge(pick('[data-inew-l="qty"]', row), badQuantity);
				judge(pick('[data-inew-l="price"]', row), badPrice);
				if (!noItem && !badQuantity && !badPrice) usableLine = true;
			}
			const linesOkay = usableLine && tally().total > 0;
			linesProblem.hidden = linesOkay;
			if (!linesOkay && !firstProblem) firstProblem = addButton;
			if (!validateDue() && !firstProblem) firstProblem = pick('input.form-control', duePicker);
		}
		firstProblem?.focus();
		return !firstProblem;
	}

	function wireDraftButton() {
		pick('[data-inew-draft]', page).addEventListener('click', () => {
			if (!validate(false)) {
				notify({ tone: 'warning', title: 'Not saved yet', text: 'A draft needs a customer and a number.' });
				return;
			}
			notify({
				tone: 'success',
				icon: 'bi-floppy',
				title: `${formPart('number').value.trim()} saved as a draft`,
				text: `${dollars(tally().total)} for ${draft.account.name}. It waits under Drafts on Invoices.`,
				actions: [backToListAction()],
			});
		});
	}

	/* Send asks once more in a small dialog, with the billing email prefilled. */
	function wireSendDialog() {
		const sendForm = pick('[data-inew-send-form]', sendDialog);

		pick('[data-inew-send]', page).addEventListener('click', () => {
			if (!validate(true)) {
				notify({ tone: 'warning', title: 'Not ready to send', text: 'Fix the fields marked in red first.' });
				return;
			}
			const recipient = billingBook.billTo(draft.account.id);
			sendPart('title').textContent = `Send ${formPart('number').value.trim()}?`;
			sendPart('sub').textContent =
				`${dollars(tally().total)} to ${draft.account.name}, due ${longDay(draft.dueOn)}.`;
			sendPart('to').value = recipient.email;
			sendPart('help').textContent = `${recipient.contact} gets it with the PDF attached.`;
			markInvalid(sendPart('to'), false);
			bootstrap.Modal.getOrCreateInstance(sendDialog).show();
		});

		sendDialog.addEventListener('shown.bs.modal', () => sendPart('to').focus());

		sendForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const address = sendPart('to');
			const valid = address.value.trim() && address.checkValidity();
			markInvalid(address, !valid);
			if (!valid) {
				address.focus();
				return;
			}
			bootstrap.Modal.getOrCreateInstance(sendDialog).hide();
			notify({
				tone: 'success',
				icon: 'bi-send',
				title: `${formPart('number').value.trim()} sent`,
				text: `To ${address.value.trim()}. ${dollars(tally().total)} is due ${longDay(draft.dueOn)}.`,
				actions: [backToListAction()],
			});
		});
	}

	function backToListAction() {
		return {
			label: 'Go to invoices',
			onClick: () => {
				window.location.href = 'invoices.html';
			},
		};
	}

	/* Lookups and small shared helpers. */

	function formPart(key) {
		return pick(`[data-inew-f="${key}"]`, page);
	}

	function sheetPart(key) {
		return pick(`[data-inew-p="${key}"]`, page);
	}

	function sendPart(key) {
		return pick(`[data-inew-s="${key}"]`, sendDialog);
	}

	/* An enhanced select is reached through the button drawn right after it. */
	function focusableFor(select) {
		const sibling = select.nextElementSibling;
		return sibling && sibling.matches('button, [tabindex]') ? sibling : select;
	}

	function markInvalid(control, wrong) {
		control.classList.toggle('is-invalid', wrong);
		if (!wrong) {
			control.removeAttribute('aria-invalid');
			return;
		}
		control.setAttribute('aria-invalid', 'true');
	}

	function speak(message) {
		const liveRegion = pick('[data-inew-live]', page);
		if (liveRegion) liveRegion.textContent = message;
	}

	function notify(options) {
		return window.Basalt.toasts?.push(options) ?? null;
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return `${value ?? ''}`.replace(/[&<>"']/g, (ch) => entities[ch]);
	}

	/** Reads a typed figure, ignoring $, %, commas and spaces; NaN if unreadable. */
	function readNumber(raw) {
		const reading = parseFloat(`${raw}`.replace(/[$,%\s]/g, ''));
		return Number.isFinite(reading) ? reading : NaN;
	}

	function roundCents(amount) {
		return Math.round(amount * 100) / 100;
	}

	/** Dollars with cents; negatives take a true minus sign. */
	function dollars(amount) {
		return `${amount < 0 ? '−' : ''}$${twoDecimals.format(Math.abs(amount))}`;
	}

	/* Dates travel as YYYY-MM-DD and are read at local noon to dodge DST edges. */

	function parseDay(iso) {
		const [year, month, day] = iso.split('-').map(Number);
		return new Date(year, month - 1, day, 12);
	}

	function toIso(when) {
		const twoDigits = (part) => `${part}`.padStart(2, '0');
		return `${when.getFullYear()}-${twoDigits(when.getMonth() + 1)}-${twoDigits(when.getDate())}`;
	}

	function shiftDays(iso, days) {
		const when = parseDay(iso);
		when.setDate(when.getDate() + days);
		return toIso(when);
	}

	function nextMonth(iso) {
		const when = parseDay(iso);
		when.setMonth(when.getMonth() + 1);
		return toIso(when);
	}

	function longDay(iso) {
		const when = parseDay(iso);
		return `${MONTH_ABBR[when.getMonth()]} ${when.getDate()}, ${when.getFullYear()}`;
	}

	function shortDay(iso) {
		const when = parseDay(iso);
		return `${MONTH_ABBR[when.getMonth()]} ${when.getDate()}`;
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
