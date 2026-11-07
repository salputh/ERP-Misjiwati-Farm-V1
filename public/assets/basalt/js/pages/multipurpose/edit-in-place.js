/**
 * The seven editable tables on edit-in-place.html. Each card names its
 * demo with data-edit-demo, and the script builds the rows from the sample
 * data below: a supplier catalog edited one cell at a time with undo, an
 * account list edited a row at a time, a supplies kit with steppers and
 * switches, orders picked across pages and moved in bulk, an invoice that
 * adds itself up, a front page ordered by drag or arrows, and a price
 * review that shows every change before it is applied. The chips at the
 * top hide every card of another kind. Nothing talks to a server; a save
 * only changes what is on screen. Plain Bootstrap .table markup.
 */
(() => {
	'use strict';

	/* A button at a limit says why in its tooltip instead of going dead. */
	const atLimit = (button, reason) => (window.Basalt?.limit || ((b, r) => (b.disabled = Boolean(r))))(button, reason);

	const pageRoot = pick('[data-edit-root]');
	if (!pageRoot) return;

	const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	const SORT_ICONS = { ascending: 'bi-chevron-up', descending: 'bi-chevron-down', none: 'bi-chevron-expand' };
	const SORT_STATES = { asc: 'ascending', desc: 'descending' };
	const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const SKU_SHAPE = /^[A-Z]{3}-\d{4}$/;
	const UNDO_DEPTH = 20;
	const LOW_STOCK = 3;
	const ORDERS_PER_PAGE = 6;
	const TAX_RATE = 0.08;

	/* Supplier catalog: what each column is called, how it is edited and
     what makes a typed value wrong. A check returns the message or ''. */
	const CATALOG_CATEGORIES = ['Clothing', 'Accessories', 'Extras', 'Services'];
	const CATALOG_COLUMNS = {
		product: { label: 'Product', editor: 'text', check: (text) => (text.trim() ? '' : 'Give the product a name') },
		sku: {
			label: 'Supplier SKU',
			editor: 'text',
			upper: true,
			check: (text) => (SKU_SHAPE.test(text) ? '' : 'Use three letters and four digits, like TGL-4410'),
		},
		category: { label: 'Category', editor: 'select', options: CATALOG_CATEGORIES },
		cost: {
			label: 'Unit cost',
			editor: 'money',
			check: (text) => (Number(text) >= 1 ? '' : 'Enter a cost of at least $1'),
		},
		restock: { label: 'Next restock', editor: 'date', check: () => '' },
	};
	const CATALOG_FIELDS = Object.keys(CATALOG_COLUMNS);
	const CATALOG_CELL_CLASSES = { product: 'edit-strong edit-wide', cost: 'text-end' };
	const CATALOG_ROWS = [
		[1, 'Sculpted Shoulder Blazer', 'LMH-4410', 'Clothing', 412, '2026-10-14'],
		[2, 'Draped Column Gown', 'LMH-4505', 'Clothing', 268, '2026-10-09'],
		[3, 'Tiered Organza Dress', 'CDM-2210', 'Clothing', 64, '2026-10-21'],
		[4, 'Chalk-Stripe Suit', 'VLN-3302', 'Clothing', 108, '2026-11-04'],
		[5, 'Leather Trench Coat', 'VLN-1180', 'Clothing', 86, '2026-10-12'],
		[6, 'Bar Loafers', 'MRL-0920', 'Clothing', 31, '2026-10-07'],
		[7, 'Two-Tone Oxfords', 'MRL-0049', 'Accessories', 22, '2026-10-16'],
		[8, 'Cat-Eye Sunglasses', 'FKT-6040', 'Accessories', 47, '2026-10-28'],
		[9, 'Shield Sunglasses', 'FKT-6012', 'Accessories', 18, '2026-10-08'],
	].map(([id, product, sku, category, cost, restock]) => ({ id, product, sku, category, cost, restock }));

	/* Account owners, with the tone of each status pill. */
	const PLAN_NAMES = ['Basic', 'Pro', 'Max'];
	const OWNER_STATES = { Active: 'success', 'Past due': 'warning', Canceled: 'muted' };
	const ACCOUNT_OWNERS = [
		[1, 'Robyn Daniels', 'robyn@oakhavenstudio.com', 'Pro', 'Active'],
		[2, 'Travis Webb', 'travis.webb@larchwoodstudios.com', 'Max', 'Active'],
		[3, 'Carly Zimmerman', 'carly@lakesideapparel.com', 'Basic', 'Past due'],
		[4, 'Dev McCarthy', 'dev@ironbridgefintech.com', 'Pro', 'Active'],
		[5, 'Carla Jensen', 'carla.jensen@harborlineai.com', 'Basic', 'Canceled'],
	].map(([id, name, email, plan, state]) => ({ id, name, email, plan, state }));

	/* The supplies kit in one care worker's car. */
	const CAR_SUPPLIES = [
		[1, 'Nitrile gloves, box of 100', 'Bin A2', 6, true],
		[2, 'Hand sanitizer, 500 ml', 'Bin A4', 3, true],
		[3, 'Blood pressure cuff', 'Shelf C1', 0, false],
		[4, 'Wet wipes, pack of 80', 'Shelf B1', 24, false],
		[5, 'Digital thermometer', 'Shelf C3', 2, true],
	].map(([id, name, bin, count, auto]) => ({ id, name, bin, count, auto }));

	/* Marlo orders waiting to be packed, newest first, and the pill tone
     for each status. */
	const ORDER_TONES = {
		Pending: 'warning',
		Packed: 'info',
		Shipped: 'primary',
		Delivered: 'success',
		'On hold': 'danger',
	};
	const OPEN_ORDERS = [
		{
			id: 7342,
			status: 'Pending',
			customer: 'Sandra Franklin',
			placed: '2026-10-05',
			total: 4280,
			items: 'Sculpted Shoulder Blazer x2, Two-Tone Oxfords x2',
		},
		{
			id: 7341,
			status: 'Pending',
			customer: 'Sabrina Kavanagh',
			placed: '2026-10-05',
			total: 1000,
			items: 'E-Gift Card ($250) x4',
		},
		{
			id: 7340,
			status: 'Pending',
			customer: 'Patricia Pemberton',
			placed: '2026-10-04',
			total: 5650,
			items: 'Leather Trench Coat, Chalk-Stripe Suit',
		},
		{
			id: 7339,
			status: 'Packed',
			customer: 'Eleanor Fairweather',
			placed: '2026-10-04',
			total: 6450,
			items: 'Draped Column Gown x3',
		},
		{
			id: 7338,
			status: 'Pending',
			customer: 'Phyllis Delaney',
			placed: '2026-10-04',
			total: 2545,
			items: 'Cat-Eye Sunglasses, Shield Sunglasses x4',
		},
		{
			id: 7337,
			status: 'Packed',
			customer: 'Christopher Vance',
			placed: '2026-10-03',
			total: 3950,
			items: 'Bar Loafers x5',
		},
		{
			id: 7336,
			status: 'Shipped',
			customer: 'Natalie Tanner',
			placed: '2026-10-03',
			total: 10080,
			items: 'Tiered Organza Dress x6',
		},
		{
			id: 7335,
			status: 'On hold',
			customer: 'Leslie Whitlock',
			placed: '2026-10-02',
			total: 2140,
			items: 'Sculpted Shoulder Blazer, Two-Tone Oxfords',
		},
		{
			id: 7334,
			status: 'Shipped',
			customer: 'Cheryl Sorensen',
			placed: '2026-10-02',
			total: 1040,
			items: 'Shield Sunglasses x2',
		},
		{
			id: 7333,
			status: 'Shipped',
			customer: 'Rochelle Fairbanks',
			placed: '2026-10-01',
			total: 5160,
			items: 'Sculpted Shoulder Blazer x4',
		},
		{
			id: 7332,
			status: 'Delivered',
			customer: 'Iva Blackwood',
			placed: '2026-10-01',
			total: 1040,
			items: 'Bar Loafers, E-Gift Card ($250)',
		},
		{
			id: 7331,
			status: 'Delivered',
			customer: 'Georgia Webster',
			placed: '2026-09-30',
			total: 7590,
			items: 'Tiered Organza Dress x3, Two-Tone Oxfords x3',
		},
		{
			id: 7330,
			status: 'Delivered',
			customer: 'Travis Daugherty',
			placed: '2026-09-30',
			total: 4900,
			items: 'Chalk-Stripe Suit x2',
		},
		{
			id: 7329,
			status: 'Delivered',
			customer: 'Benjamin Hartley',
			placed: '2026-09-29',
			total: 2670,
			items: 'Draped Column Gown, Shield Sunglasses',
		},
		{
			id: 7328,
			status: 'Delivered',
			customer: 'Rodney Forbes',
			placed: '2026-09-29',
			total: 6400,
			items: 'Leather Trench Coat x2',
		},
		{
			id: 7327,
			status: 'On hold',
			customer: 'Sandra Franklin',
			placed: '2026-09-28',
			total: 930,
			items: 'Cat-Eye Sunglasses x2',
		},
		{
			id: 7326,
			status: 'Delivered',
			customer: 'Sabrina Kavanagh',
			placed: '2026-09-28',
			total: 5880,
			items: 'Draped Column Gown x2, Bar Loafers x2',
		},
		{
			id: 7325,
			status: 'Delivered',
			customer: 'Christopher Vance',
			placed: '2026-09-28',
			total: 2500,
			items: 'E-Gift Card ($250) x10',
		},
	];

	/* Invoice #3117: item, quantity, unit price. Ids are handed out as
     lines are built, so an added line never reuses one. */
	const INVOICE_LINES = [
		['Team Lead Course', 8, 649],
		['Staff Profile Import', 8, 49],
		['Onboarding Package', 1, 1250],
		['Live Training Session', 2, 350],
	];

	/* Products on the Marlo shop's front page, in the order they show. */
	const FRONT_PAGE = [
		[1, 'Sculpted Shoulder Blazer', 'Clothing'],
		[2, 'Express Delivery Pass', 'Extras'],
		[3, 'Tiered Organza Dress', 'Clothing'],
		[4, 'Made-to-Measure Tailoring', 'Services'],
		[5, 'Aftercare Plan, monthly', 'Extras'],
		[6, 'Chalk-Stripe Suit', 'Clothing'],
	].map(([id, name, shelf]) => ({ id, name, shelf }));

	/* The January price review: today's price, and the new one starts equal. */
	const PRICE_REVIEW = [
		[1, 'Two-Tone Oxfords', 'ML-OXFD', 49],
		[2, 'Cat-Eye Sunglasses', 'ML-CATE', 89],
		[3, 'Shield Sunglasses', 'ML-SHLD', 39],
		[4, 'Bar Loafers', 'ML-LOAF', 59],
		[5, 'E-Gift Card, $250', 'FL-SMS1K', 25],
	].map(([id, name, sku, today]) => ({ id, name, sku, today, next: today }));

	/* Each demo by the name its card carries in data-edit-demo. */
	const DEMOS = {
		catalog: wireCatalog,
		customers: wireOwners,
		stock: wireSupplies,
		orders: wireOrders,
		invoice: wireInvoice,
		shelf: wireFrontPage,
		prices: wirePriceReview,
	};

	function start() {
		for (const [demoName, wire] of Object.entries(DEMOS)) {
			const demo = pick(`[data-edit-demo="${demoName}"]`, pageRoot);
			if (demo) wire(demo);
		}
		wireFilter();
	}

	/** The first match of each selector inside scope, in the order asked. */
	function within(scope, ...selectors) {
		return selectors.map((selector) => pick(selector, scope));
	}

	function make(tag, props = {}) {
		return Object.assign(document.createElement(tag), props);
	}

	/**
	 * A template tag for row markup written across several lines: every line
	 * break and the indent after it are dropped from the literal parts, so
	 * the layout here never puts whitespace between tags. Values are kept
	 * as they are.
	 */
	function oneLine(literals, ...values) {
		const flat = literals.map((chunk) => chunk.replace(/\n\s*/g, ''));
		let woven = flat[0];
		for (const [index, value] of values.entries()) woven += `${value}${flat[index + 1]}`;
		return woven;
	}

	function dollars(figure, digits = 0) {
		return `$${Number(figure || 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
	}

	function htmlSafe(text) {
		return String(text ?? '').replace(/[&<>"']/g, (mark) => HTML_ESCAPES[mark]);
	}

	/** "2026-10-14" as "Oct 14"; noon keeps the day from slipping across zones. */
	function shortDate(isoDay) {
		if (!isoDay) return '';
		return new Date(`${isoDay}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	/**
	 * Reads what someone typed into a money box ("1,240.5", "$12") as a
	 * number rounded to cents, or NaN for anything that is not a price.
	 * Money boxes are text fields with a $ in front, so there are no spin
	 * arrows to fight.
	 */
	function parseMoney(typed) {
		const bare = String(typed ?? '').replace(/[$,\s]/g, '');
		return /^\d*\.?\d+$|^\d+\.$/.test(bare) ? Math.round(parseFloat(bare) * 100) / 100 : NaN;
	}

	function plural(figure, word, words = `${word}s`) {
		return `${figure} ${figure === 1 ? word : words}`;
	}

	function compareValues(left, right) {
		if (typeof left === 'number' && typeof right === 'number') return left - right;
		return String(left).localeCompare(String(right));
	}

	function glyphHtml(glyphName) {
		return `<i aria-hidden="true" class="bi ${glyphName}"></i>`;
	}

	function badgeHtml(tone, text) {
		return `<span class="edit-badge edit-tone-${tone}">${text}</span>`;
	}

	function iconButtonHtml(attrs, glyphName) {
		return `<button ${attrs} type="button" class="btn btn-sm btn-outline-secondary edit-icon-btn">${glyphHtml(glyphName)}</button>`;
	}

	function moneyFieldHtml(extraClass, figure, label, attrs = '') {
		return oneLine`
      <div class="input-group input-group-sm edit-money-field">
        <span aria-hidden="true" class="input-group-text">$</span>
        <input${attrs} aria-label="${htmlSafe(label)}" type="text" value="${Number(figure).toFixed(2)}" autocomplete="off" class="form-control ${extraClass}" inputmode="decimal">
      </div>`;
	}

	/** The shared stepper from basalt.js, which binds it once it is in the page. */
	function stepperHtml(figure, floor, ceiling, label, fewerLabel, moreLabel, attrs = '') {
		return oneLine`
      <div data-basalt-stepper class="basalt-stepper basalt-stepper-sm">
        <button data-basalt-step="-1" aria-label="${htmlSafe(fewerLabel)}" type="button" class="basalt-stepper-btn">${glyphHtml('bi-dash-lg')}</button>
        <input${attrs} aria-label="${htmlSafe(label)}" type="number" min="${floor}" max="${ceiling}" value="${figure}" class="basalt-stepper-input" inputmode="numeric">
        <button data-basalt-step="1" aria-label="${htmlSafe(moreLabel)}" type="button" class="basalt-stepper-btn">${glyphHtml('bi-plus-lg')}</button>
      </div>`;
	}

	function bindSteppers(scope) {
		if (!window.Basalt.stepper) return;
		for (const stepper of pickAll('[data-basalt-stepper]', scope)) window.Basalt.stepper(stepper);
	}

	function rowOf(scope, id) {
		return pick(`tr[data-id="${id}"]`, scope);
	}

	function idOf(node) {
		return Number(node.closest('tr').getAttribute('data-id'));
	}

	/* Restarting the animation needs the class off, a layout flush, then on again. */
	function flashRow(tableRow) {
		tableRow.classList.remove('is-flash');
		void tableRow.offsetWidth;
		tableRow.classList.add('is-flash');
	}

	/**
	 * Header sort buttons. One column is active at a time; clicking it
	 * again flips the direction. The sorting object is shared with the
	 * demo's own redraw, which runs once the headers are updated.
	 */
	function wireSort(tableNode, sorting, redraw) {
		const headerCells = [...pickAll('thead th[aria-sort]', tableNode)];
		for (const sortButton of pickAll('.edit-sort', tableNode)) {
			sortButton.addEventListener('click', () => {
				const key = sortButton.getAttribute('data-sort');
				sorting.dir = sorting.key === key && sorting.dir === 'asc' ? 'desc' : 'asc';
				sorting.key = key;
				for (const headerCell of headerCells) {
					const leads = pick('.edit-sort', headerCell) === sortButton;
					const ariaSort = leads ? SORT_STATES[sorting.dir] : 'none';
					headerCell.setAttribute('aria-sort', ariaSort);
					const arrow = pick('.edit-sort .bi', headerCell);
					if (arrow) arrow.className = `bi ${SORT_ICONS[ariaSort]}`;
				}
				redraw();
			});
		}
	}

	/**
	 * Supplier catalog: inline cells. A cell is a button that opens the
	 * editor for its column; Enter keeps the change, Escape drops it, Tab
	 * keeps it and moves on. Edits wait on the row until Save, Discard puts
	 * the saved values back, and Undo (or Ctrl+Z outside a field) steps
	 * back through the last twenty edits.
	 */
	function wireCatalog(demo) {
		const tableNode = pick('table', demo);
		const [tableBody, statusLine, searchBox, saveButton, discardButton, undoButton] = within(
			demo,
			'tbody',
			'[data-edit-status]',
			'[data-edit-search]',
			'[data-edit-save]',
			'[data-edit-discard]',
			'[data-edit-undo]',
		);
		const catalog = CATALOG_ROWS;
		const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));
		const sorting = { key: 'product', dir: 'asc' };
		const history = [];
		let searchText = '';
		let savedCount = 0;

		function savedCopy(entry) {
			return Object.fromEntries(CATALOG_FIELDS.map((fieldName) => [fieldName, entry[fieldName]]));
		}

		function isDirty(entry) {
			return CATALOG_FIELDS.some((fieldName) => String(entry[fieldName]) !== String(entry.saved[fieldName]));
		}

		function formatCell(fieldName, raw) {
			if (fieldName === 'cost') return dollars(raw, Number.isInteger(raw) ? 0 : 2);
			if (fieldName === 'restock') return raw ? shortDate(raw) : 'Not set';
			return raw;
		}

		function cellHtml(entry, fieldName) {
			const shownText = formatCell(fieldName, entry[fieldName]);
			const classes = fieldName === 'sku' ? 'edit-cell edit-mono' : 'edit-cell';
			return oneLine`
        <button data-field="${fieldName}" aria-label="${htmlSafe(`${CATALOG_COLUMNS[fieldName].label}, ${shownText}. Edit`)}" type="button" class="${classes}">
          <span>${htmlSafe(shownText)}</span>${glyphHtml('bi-pencil')}
        </button>`;
		}

		function flagHtml(entry) {
			return isDirty(entry) ? badgeHtml('warning', 'Edited') : '';
		}

		function rowHtml(entry) {
			const cellMarkup = CATALOG_FIELDS.map(
				(fieldName) =>
					`<td class="${CATALOG_CELL_CLASSES[fieldName] ?? 'edit-nowrap'}">${cellHtml(entry, fieldName)}</td>`,
			).join('');
			return `<tr${isDirty(entry) ? ' class="is-dirty"' : ''} data-id="${entry.id}">${cellMarkup}<td data-flag class="edit-nowrap">${flagHtml(entry)}</td></tr>`;
		}

		function redraw() {
			const needle = searchText.trim().toLowerCase();
			const showing = catalog.filter(
				(entry) =>
					!needle || [entry.product, entry.sku, entry.category].join(' ').toLowerCase().includes(needle),
			);
			showing.sort(
				(left, right) =>
					compareValues(left[sorting.key], right[sorting.key]) * (sorting.dir === 'asc' ? 1 : -1),
			);
			tableBody.innerHTML = showing.length
				? showing.map(rowHtml).join('')
				: `<tr class="edit-empty"><td colspan="6">No products match "${htmlSafe(searchText)}"</td></tr>`;
			reportState();
		}

		function reportState() {
			const dirtyCount = catalog.filter(isDirty).length;
			saveButton.disabled = discardButton.disabled = dirtyCount === 0;
			undoButton.disabled = history.length === 0;
			if (dirtyCount)
				statusLine.innerHTML = `<strong>${plural(dirtyCount, 'line')}</strong> edited and not saved yet`;
			else statusLine.textContent = savedCount ? `Saved ${plural(savedCount, 'line')}` : 'No unsaved changes';
		}

		function refreshRow(entry) {
			const tableRow = rowOf(tableBody, entry.id);
			if (!tableRow) return;
			tableRow.classList.toggle('is-dirty', isDirty(entry));
			pick('[data-flag]', tableRow).innerHTML = flagHtml(entry);
		}

		/* Builds the control for a column: a select, a money box, or a plain
       input of the column's type. Returns the control and what to mount. */
		function makeEditor(column, fieldName, before) {
			if (column.editor === 'select') {
				const selectBox = make('select', { className: 'form-select form-select-sm' });
				for (const optionName of column.options)
					selectBox.add(new Option(optionName, optionName, false, optionName === before));
				return { control: selectBox, mountable: selectBox };
			}
			if (column.editor === 'money') {
				const scratch = make('div', { innerHTML: moneyFieldHtml('edit-money-input', before, column.label) });
				const moneyGroup = scratch.firstElementChild;
				return { control: pick('input', moneyGroup), mountable: moneyGroup };
			}
			const box = make('input', {
				className:
					fieldName === 'sku' ? 'form-control form-control-sm edit-mono' : 'form-control form-control-sm',
				type: column.editor,
				value: before,
			});
			return { control: box, mountable: box };
		}

		function startEditing(cellButton) {
			const cellNode = cellButton.parentElement;
			const entry = catalogById.get(idOf(cellNode));
			const fieldName = cellButton.getAttribute('data-field');
			const column = CATALOG_COLUMNS[fieldName];
			const before = entry[fieldName];
			const { control, mountable } = makeEditor(column, fieldName, before);
			control.setAttribute('aria-label', column.label);
			const editorShell = make('div', { className: 'edit-editor' });
			const complaint = make('div', {
				className: 'invalid-feedback',
				id: `edit-err-${entry.id}-${fieldName}`,
				hidden: true,
			});
			editorShell.append(mountable, complaint);
			cellNode.replaceChildren(editorShell);
			control.focus();
			if (column.editor === 'text' || column.editor === 'money') control.select();
			let settled = false;

			function showProblem(wording) {
				complaint.textContent = wording;
				complaint.hidden = false;
				control.classList.add('is-invalid');
				control.setAttribute('aria-invalid', 'true');
				control.setAttribute('aria-describedby', complaint.id);
			}

			/**
			 * Closes the editor. With keep, the value is checked first and a
			 * bad one stays open (returns false). stride moves focus to the
			 * cell that many places along; without it the same cell is focused.
			 */
			function settle(keep, stride = 0) {
				if (settled) return true;
				let edited = control.value;
				if (column.upper) edited = edited.toUpperCase().trim();
				if (column.editor === 'money') edited = parseMoney(edited);
				if (keep) {
					const wording = column.check ? column.check(String(edited)) : '';
					if (wording) {
						showProblem(wording);
						return false;
					}
				}
				settled = true;
				if (keep && String(edited) !== String(before)) {
					entry[fieldName] = edited;
					history.push({ id: entry.id, fieldName, before, after: edited });
					if (history.length > UNDO_DEPTH) history.shift();
					savedCount = 0;
				}
				cellNode.innerHTML = cellHtml(entry, fieldName);
				refreshRow(entry);
				reportState();
				const cellButtons = [...pickAll('.edit-cell', tableBody)];
				const own = pick('.edit-cell', cellNode);
				const landing = stride ? cellButtons[cellButtons.indexOf(own) + stride] : own;
				landing?.focus();
				return true;
			}

			const keyHandlers = {
				Enter: () => settle(true),
				Escape: (event) => {
					event.stopPropagation();
					settle(false);
				},
				Tab: (event) => {
					if (!settle(true, event.shiftKey ? -1 : 1)) control.focus();
				},
			};
			control.addEventListener('keydown', (event) => {
				const respond = keyHandlers[event.key];
				if (!respond) return;
				event.preventDefault();
				respond(event);
			});
			control.addEventListener('input', () => {
				if (!control.classList.contains('is-invalid')) return;
				control.classList.remove('is-invalid');
				control.removeAttribute('aria-invalid');
				complaint.hidden = true;
			});
			/* Clicking away from a bad value drops it rather than trapping focus. */
			control.addEventListener('blur', () => {
				setTimeout(() => {
					if (!settled && !settle(true)) settle(false);
				}, 0);
			});
		}

		function stepBack() {
			const lastEdit = history.pop();
			if (!lastEdit) return;
			const entry = catalogById.get(lastEdit.id);
			entry[lastEdit.fieldName] = lastEdit.before;
			savedCount = 0;
			redraw();
			const tableRow = rowOf(tableBody, entry.id);
			if (tableRow) flashRow(tableRow);
			statusLine.textContent = `Undid ${CATALOG_COLUMNS[lastEdit.fieldName].label.toLowerCase()} on ${entry.product}`;
			undoButton.disabled = history.length === 0;
		}

		function saveAll() {
			const dirtyRows = catalog.filter(isDirty);
			for (const entry of dirtyRows) entry.saved = savedCopy(entry);
			savedCount = dirtyRows.length;
			history.length = 0;
			redraw();
		}

		function discardAll() {
			const dirtyCount = catalog.filter(isDirty).length;
			for (const entry of catalog) Object.assign(entry, entry.saved);
			history.length = 0;
			savedCount = 0;
			redraw();
			statusLine.textContent = `Put back ${plural(dirtyCount, 'line')}`;
		}

		for (const entry of catalog) entry.saved = savedCopy(entry);
		tableBody.addEventListener('click', ({ target }) => {
			const cellButton = target.closest('.edit-cell');
			if (cellButton) startEditing(cellButton);
		});
		demo.addEventListener('keydown', (event) => {
			const undoKeys = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z';
			if (!undoKeys || event.target.closest('.edit-editor, input, select')) return;
			event.preventDefault();
			stepBack();
		});
		undoButton.addEventListener('click', stepBack);
		saveButton.addEventListener('click', saveAll);
		discardButton.addEventListener('click', discardAll);
		searchBox.addEventListener('input', () => {
			searchText = searchBox.value;
			redraw();
		});
		wireSort(tableNode, sorting, redraw);
		redraw();
	}

	/**
	 * Account owners: whole-row editing. Edit swaps the row for a small
	 * form; Save checks the name and email first and Cancel (or Escape)
	 * puts the old row back untouched.
	 */
	function wireOwners(demo) {
		const [tableBody, statusLine] = within(demo, 'tbody', '[data-edit-status]');
		const people = ACCOUNT_OWNERS;
		let openId = null;

		function optionsHtml(names, chosen) {
			return names
				.map((optionName) => `<option${optionName === chosen ? ' selected' : ''}>${optionName}</option>`)
				.join('');
		}

		function viewRowHtml(person) {
			return oneLine`
        <tr data-id="${person.id}">
          <td class="edit-wide"><span class="edit-strong">${htmlSafe(person.name)}</span><span class="edit-sub">${htmlSafe(person.email)}</span></td>
          <td><span class="edit-plan">${htmlSafe(person.plan)}</span>${badgeHtml(OWNER_STATES[person.state], person.state)}</td>
          <td class="text-end"><button data-act="edit" aria-label="Edit ${htmlSafe(person.name)}" type="button" class="btn btn-sm btn-outline-secondary">Edit</button></td>
        </tr>`;
		}

		function formRowHtml(person) {
			return oneLine`
        <tr data-id="${person.id}" class="is-picked">
          <td>
            <div class="edit-row-form">
              <input aria-label="Name" name="name" value="${htmlSafe(person.name)}" class="form-control form-control-sm">
              <input aria-label="Email" aria-describedby="cus-err-${person.id}" name="email" type="email" value="${htmlSafe(person.email)}" class="form-control form-control-sm">
              <div id="cus-err-${person.id}" class="invalid-feedback"></div>
            </div>
          </td>
          <td>
            <div class="edit-row-form edit-row-form-narrow">
              <select aria-label="Plan" name="plan" class="form-select form-select-sm">${optionsHtml(PLAN_NAMES, person.plan)}</select>
              <select aria-label="Status" name="state" class="form-select form-select-sm">${optionsHtml(Object.keys(OWNER_STATES), person.state)}</select>
            </div>
          </td>
          <td class="text-end">
            <div class="edit-actions">
              <button data-act="save" type="button" class="btn btn-sm btn-primary">Save</button>
              <button data-act="cancel" type="button" class="btn btn-sm btn-outline-secondary">Cancel</button>
            </div>
          </td>
        </tr>`;
		}

		function redraw() {
			tableBody.innerHTML = people
				.map((person) => (person.id === openId ? formRowHtml(person) : viewRowHtml(person)))
				.join('');
		}

		function headline() {
			const activeCount = people.filter((person) => person.state === 'Active').length;
			return `${plural(people.length, 'account')}, ${activeCount} active`;
		}

		function focusEditButton(id) {
			pick(`tr[data-id="${id}"] [data-act="edit"]`, tableBody)?.focus();
		}

		function closeForm(person) {
			openId = null;
			redraw();
			statusLine.textContent = headline();
			focusEditButton(person.id);
		}

		function keepForm(tableRow, person) {
			const typed = (fieldName) => pick(`[name="${fieldName}"]`, tableRow).value.trim();
			const [nameBox, emailBox, complaint] = within(
				tableRow,
				'[name="name"]',
				'[name="email"]',
				'.invalid-feedback',
			);
			for (const box of [nameBox, emailBox]) {
				box.classList.remove('is-invalid');
				box.removeAttribute('aria-invalid');
			}
			const fault = !typed('name')
				? [nameBox, 'Add a name']
				: !EMAIL_SHAPE.test(typed('email'))
					? [emailBox, 'Check the email address']
					: null;
			if (fault) {
				const [box, wording] = fault;
				box.classList.add('is-invalid');
				box.setAttribute('aria-invalid', 'true');
				box.setAttribute('aria-describedby', complaint.id);
				complaint.textContent = wording;
				complaint.style.display = 'block';
				box.focus();
				return;
			}
			Object.assign(person, {
				name: typed('name'),
				email: typed('email'),
				plan: typed('plan'),
				state: typed('state'),
			});
			openId = null;
			redraw();
			flashRow(rowOf(tableBody, person.id));
			statusLine.textContent = `Saved ${person.name}. ${headline()}`;
			focusEditButton(person.id);
		}

		const handlers = {
			edit: (tableRow, person) => {
				openId = person.id;
				redraw();
				pick(`tr[data-id="${person.id}"] [name="name"]`, tableBody).focus();
				statusLine.textContent = `Editing ${person.name}`;
			},
			cancel: (tableRow, person) => closeForm(person),
			save: keepForm,
		};

		tableBody.addEventListener('click', ({ target }) => {
			const actionButton = target.closest('[data-act]');
			if (!actionButton) return;
			const tableRow = actionButton.closest('tr');
			const person = people.find((candidate) => candidate.id === idOf(tableRow));
			handlers[actionButton.getAttribute('data-act')](tableRow, person);
		});
		tableBody.addEventListener('keydown', (event) => {
			const tableRow = event.target.closest('tr.is-picked');
			if (!tableRow) return;
			const person = people.find((candidate) => candidate.id === idOf(tableRow));
			if (event.key === 'Escape') closeForm(person);
			else if (event.key === 'Enter' && event.target.matches('input')) {
				event.preventDefault();
				keepForm(tableRow, person);
			}
		});
		redraw();
		statusLine.textContent = headline();
	}

	/**
	 * Supplies kit: steppers and switches that save the moment they change.
	 * The shared stepper clamps to its min and max and fires change on the
	 * input for the buttons and for typing, so one listener covers all three.
	 */
	function wireSupplies(demo) {
		const [tableBody, statusLine] = within(demo, 'tbody', '[data-edit-status]');
		const supplies = CAR_SUPPLIES;

		function levelBadge(count) {
			if (count === 0) return badgeHtml('danger', 'Out of stock');
			return count <= LOW_STOCK ? badgeHtml('warning', 'Running low') : badgeHtml('success', 'In stock');
		}

		function rowHtml(part) {
			return oneLine`
        <tr data-id="${part.id}">
          <td><span class="edit-strong">${part.name}</span><span class="edit-sub">${part.bin}</span><span data-level class="edit-level">${levelBadge(part.count)}</span></td>
          <td class="text-end">${stepperHtml(part.count, 0, 999, `Number of ${part.name} in the car`, `One fewer ${part.name}`, `One more ${part.name}`)}</td>
          <td class="text-end"><div class="form-check form-switch"><input aria-label="Reorder ${part.name} automatically" role="switch" type="checkbox"${part.auto ? ' checked' : ''} class="form-check-input"></div></td>
        </tr>`;
		}

		function report(lead) {
			const onAuto = supplies.filter((part) => part.auto).length;
			const lowCount = supplies.filter((part) => part.count > 0 && part.count <= LOW_STOCK).length;
			const outCount = supplies.filter((part) => part.count === 0).length;
			statusLine.innerHTML = `${lead ? `${htmlSafe(lead)}. ` : ''}<strong>${onAuto} on auto reorder</strong>, ${lowCount} running low, ${outCount} out of stock`;
		}

		function setCount(tableRow, part, typed) {
			part.count = Math.max(0, Math.min(999, Math.round(Number(typed) || 0)));
			pick('.basalt-stepper-input', tableRow).value = part.count;
			pick('[data-level]', tableRow).innerHTML = levelBadge(part.count);
			report(`${part.name}: ${part.count} in the car`);
		}

		tableBody.innerHTML = supplies.map(rowHtml).join('');
		for (const part of supplies) {
			const tableRow = rowOf(tableBody, part.id);
			pick('.basalt-stepper-input', tableRow).addEventListener('change', ({ target }) =>
				setCount(tableRow, part, target.value),
			);
			pick('[role="switch"]', tableRow).addEventListener('change', ({ target }) => {
				part.auto = target.checked;
				report(`${part.name}${part.auto ? ' reorders automatically' : ' is on manual reorder'}`);
			});
		}
		bindSteppers(tableBody);
		report();
	}

	/**
	 * Orders to pack: selection, bulk status, paging. Picked order ids live
	 * in a Set, so they survive a search, a sort or a change of page. The
	 * header checkbox picks or clears the page on screen, and a click on a
	 * row away from its controls checks it too.
	 */
	function wireOrders(demo) {
		const tableNode = pick('table', demo);
		const [tableBody, statusLine, searchBox, pageBox, batchBar, pickedLabel, bulkPicker, pagerList] = within(
			demo,
			'tbody',
			'[data-edit-status]',
			'[data-edit-search]',
			'[data-edit-select-page]',
			'[data-edit-bulk]',
			'[data-edit-selected]',
			'[data-edit-bulk-status]',
			'[data-edit-pages]',
		);
		const sales = OPEN_ORDERS;
		const sorting = { key: 'id', dir: 'desc' };
		const picked = new Set();
		let searchText = '';
		let pageNumber = 1;
		let onScreen = [];

		function matching() {
			const needle = searchText.trim().toLowerCase();
			const showing = sales.filter(
				(sale) =>
					!needle ||
					`#${sale.id} ${sale.customer} ${sale.items} ${sale.status}`.toLowerCase().includes(needle),
			);
			return showing.sort(
				(left, right) =>
					compareValues(left[sorting.key], right[sorting.key]) * (sorting.dir === 'asc' ? 1 : -1),
			);
		}

		function rowHtml(sale) {
			const isPicked = picked.has(sale.id);
			return oneLine`
        <tr${isPicked ? ' class="is-picked"' : ''} data-id="${sale.id}">
          <td class="edit-check"><input aria-label="Select order #${sale.id}" type="checkbox"${isPicked ? ' checked' : ''} class="form-check-input"></td>
          <td><span class="edit-mono">#${sale.id}</span></td>
          <td class="edit-nowrap">${htmlSafe(sale.customer)}</td>
          <td class="edit-wide">${htmlSafe(sale.items)}</td>
          <td class="edit-nowrap">${shortDate(sale.placed)}</td>
          <td class="text-end">${dollars(sale.total, 2)}</td>
          <td>${badgeHtml(ORDER_TONES[sale.status], sale.status)}</td>
        </tr>`;
		}

		function pagerItemHtml(label, target, { leads = false, disabled = false, aria = '' } = {}) {
			const itemClasses = ['page-item', leads && 'active', disabled && 'disabled'].filter(Boolean).join(' ');
			const stateAttrs = `${disabled ? ' disabled' : ''}${leads ? ' aria-current="page"' : ''}${aria ? ` aria-label="${aria}"` : ''}`;
			return `<li class="${itemClasses}"><button data-page="${target}"${stateAttrs} type="button" class="page-link">${label}</button></li>`;
		}

		function redrawPager(pageCount) {
			const pagerItems = [
				pagerItemHtml(glyphHtml('bi-chevron-left'), pageNumber - 1, {
					disabled: pageNumber === 1,
					aria: 'Previous page',
				}),
			];
			for (let number = 1; number <= pageCount; number += 1) {
				pagerItems.push(
					pagerItemHtml(String(number), number, { leads: number === pageNumber, aria: `Page ${number}` }),
				);
			}
			pagerItems.push(
				pagerItemHtml(glyphHtml('bi-chevron-right'), pageNumber + 1, {
					disabled: pageNumber === pageCount,
					aria: 'Next page',
				}),
			);
			pagerList.innerHTML = pagerItems.join('');
		}

		function redraw(flashIds) {
			const showing = matching();
			const pageCount = Math.max(1, Math.ceil(showing.length / ORDERS_PER_PAGE));
			pageNumber = Math.min(pageNumber, pageCount);
			const pageStart = (pageNumber - 1) * ORDERS_PER_PAGE;
			onScreen = showing.slice(pageStart, pageStart + ORDERS_PER_PAGE);
			tableBody.innerHTML = onScreen.length
				? onScreen.map(rowHtml).join('')
				: `<tr class="edit-empty"><td colspan="7">No orders match "${htmlSafe(searchText)}"</td></tr>`;
			if (flashIds) {
				for (const tableRow of pickAll('tr[data-id]', tableBody)) {
					if (flashIds.has(idOf(tableRow))) flashRow(tableRow);
				}
			}
			const pickedHere = onScreen.filter((sale) => picked.has(sale.id)).length;
			pageBox.checked = onScreen.length > 0 && pickedHere === onScreen.length;
			pageBox.indeterminate = pickedHere > 0 && pickedHere < onScreen.length;
			pageBox.disabled = onScreen.length === 0;
			batchBar.hidden = picked.size === 0;
			pickedLabel.textContent = `${picked.size} selected`;
			statusLine.textContent = showing.length
				? `${pageStart + 1}–${pageStart + onScreen.length} of ${plural(showing.length, 'order')}`
				: 'No orders to show';
			redrawPager(pageCount);
		}

		function applyBulkStatus() {
			const nextStatus = bulkPicker.value;
			const ids = new Set(picked);
			for (const sale of sales) {
				if (ids.has(sale.id)) sale.status = nextStatus;
			}
			picked.clear();
			redraw(ids);
			statusLine.textContent = `${plural(ids.size, 'order')} now ${nextStatus.toLowerCase()}. ${statusLine.textContent}`;
			searchBox.focus();
		}

		pagerList.addEventListener('click', ({ target }) => {
			const pageButton = target.closest('[data-page]');
			if (!pageButton || pageButton.disabled) return;
			pageNumber = Number(pageButton.getAttribute('data-page'));
			redraw();
			const landing =
				pick(`[data-page="${pageNumber}"][aria-current]`, pagerList) || pick('[aria-current]', pagerList);
			landing?.focus();
		});
		tableBody.addEventListener('change', ({ target }) => {
			if (!target.matches('input[type="checkbox"]')) return;
			const id = idOf(target);
			picked[target.checked ? 'add' : 'delete'](id);
			redraw();
			pick(`tr[data-id="${id}"] input`, tableBody)?.focus();
		});
		tableBody.addEventListener('click', ({ target }) => {
			const tableRow = target.closest('tr[data-id]');
			if (!tableRow || target.closest('input, button, a')) return;
			const box = pick('input[type="checkbox"]', tableRow);
			box.checked = !box.checked;
			box.dispatchEvent(new Event('change', { bubbles: true }));
		});
		pageBox.addEventListener('change', () => {
			const allPicked = onScreen.every((sale) => picked.has(sale.id));
			for (const sale of onScreen) picked[allPicked ? 'delete' : 'add'](sale.id);
			redraw();
			pageBox.focus();
		});
		pick('[data-edit-bulk-apply]', demo).addEventListener('click', applyBulkStatus);
		pick('[data-edit-bulk-clear]', demo).addEventListener('click', () => {
			picked.clear();
			redraw();
			pageBox.focus();
		});
		searchBox.addEventListener('input', () => {
			searchText = searchBox.value;
			pageNumber = 1;
			redraw();
		});
		wireSort(tableNode, sorting, () => {
			pageNumber = 1;
			redraw();
		});
		redraw();
	}

	/**
	 * Invoice: open fields, live totals. Typing updates the totals as you
	 * go; the stepper buttons fire change, and so does leaving a price,
	 * which is when the box is tidied to cents. The last line cannot be
	 * removed.
	 */
	function wireInvoice(demo) {
		const [tableBody, statusLine] = within(demo, 'tbody', '[data-edit-status]');
		const sums = Object.fromEntries(
			['sub', 'tax', 'total'].map((sumName) => [sumName, pick(`[data-edit-sum="${sumName}"]`, demo)]),
		);
		let lastId = 0;
		const billLines = INVOICE_LINES.map(([item, qty, price]) => ({ id: ++lastId, item, qty, price }));

		function lineName(line, index) {
			return line.item || `line ${index + 1}`;
		}

		function lineHtml(line, index) {
			return oneLine`
        <tr data-id="${line.id}">
          <td><input data-f="item" aria-label="Item on line ${index + 1}" value="${htmlSafe(line.item)}" placeholder="Item name" class="form-control form-control-sm"></td>
          <td class="edit-num">${stepperHtml(line.qty, 0, 999, `Quantity of ${lineName(line, index)}`, 'One fewer', 'One more', ' data-f="qty"')}</td>
          <td class="edit-num">${moneyFieldHtml('edit-price', line.price, `Unit price of ${lineName(line, index)}`, ' data-f="price"')}</td>
          <td data-amount class="text-end edit-strong">${dollars(line.qty * line.price, 2)}</td>
          <td class="text-end">${iconButtonHtml(`data-remove aria-label="Remove line ${index + 1}"`, 'bi-x-lg')}</td>
        </tr>`;
		}

		function addUp() {
			const beforeTax = billLines.reduce((sum, line) => sum + line.qty * line.price, 0);
			const unitCount = billLines.reduce((sum, line) => sum + line.qty, 0);
			sums.sub.textContent = dollars(beforeTax, 2);
			sums.tax.textContent = dollars(beforeTax * TAX_RATE, 2);
			sums.total.textContent = dollars(beforeTax * (1 + TAX_RATE), 2);
			statusLine.innerHTML = `${plural(billLines.length, 'line')}, ${plural(unitCount, 'unit')}, <strong>${dollars(beforeTax * (1 + TAX_RATE), 2)}</strong> due`;
			for (const removeButton of pickAll('[data-remove]', tableBody))
				atLimit(removeButton, billLines.length === 1 ? 'A bill keeps at least one line' : '');
		}

		function redraw() {
			tableBody.innerHTML = billLines.map(lineHtml).join('');
			bindSteppers(tableBody);
			addUp();
		}

		function readField(target, tidy) {
			const fieldName = target.getAttribute('data-f');
			if (!fieldName) return;
			const tableRow = target.closest('tr');
			const line = billLines.find((candidate) => candidate.id === idOf(tableRow));
			if (fieldName === 'item') {
				line.item = target.value;
				const itemName = lineName(line, billLines.indexOf(line));
				pick('[data-f="qty"]', tableRow).setAttribute('aria-label', `Quantity of ${itemName}`);
				pick('[data-f="price"]', tableRow).setAttribute('aria-label', `Unit price of ${itemName}`);
				return;
			}
			if (fieldName === 'price') {
				const typedPrice = parseMoney(target.value);
				if (!Number.isNaN(typedPrice)) line.price = typedPrice;
				if (tidy) target.value = line.price.toFixed(2);
			} else {
				line.qty = Math.max(0, Math.round(Number(target.value) || 0));
			}
			pick('[data-amount]', tableRow).textContent = dollars(line.qty * line.price, 2);
			addUp();
		}

		function removeLine(removeButton) {
			const index = billLines.findIndex((candidate) => candidate.id === idOf(removeButton));
			const [gone] = billLines.splice(index, 1);
			redraw();
			pickAll('[data-remove]', tableBody)[Math.min(index, billLines.length - 1)]?.focus();
			statusLine.innerHTML = `Removed ${htmlSafe(gone.item || 'a blank line')}. ${statusLine.innerHTML}`;
		}

		tableBody.addEventListener('input', ({ target }) => readField(target, false));
		tableBody.addEventListener('change', ({ target }) => readField(target, true));
		tableBody.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' || !event.target.matches('[data-f="price"]')) return;
			event.preventDefault();
			readField(event.target, true);
		});
		tableBody.addEventListener('click', ({ target }) => {
			const removeButton = target.closest('[data-remove]');
			if (removeButton && billLines.length > 1) removeLine(removeButton);
		});
		pick('[data-edit-add]', demo).addEventListener('click', () => {
			billLines.push({ id: ++lastId, item: '', qty: 1, price: 0 });
			redraw();
			pick('tr:last-child [data-f="item"]', tableBody).focus();
		});
		redraw();
	}

	/**
	 * Shop front page: drag a row by its handle or use the arrows. The row
	 * being dragged fades, the row under the pointer shows a drop line, and
	 * after an arrow move focus stays on a working arrow of the same row.
	 */
	function wireFrontPage(demo) {
		const [tableBody, statusLine] = within(demo, 'tbody', '[data-edit-status]');
		const lineup = FRONT_PAGE;
		let lifted = null;

		function rowHtml(product, index) {
			const safeName = htmlSafe(product.name);
			return oneLine`
        <tr data-id="${product.id}" draggable="true">
          <td class="edit-pos"><span title="Drag to reorder" class="edit-handle">${glyphHtml('bi-grip-vertical')}${index + 1}</span></td>
          <td class="edit-strong">${safeName}</td>
          <td class="edit-nowrap">${product.shelf}</td>
          <td class="text-end">
            <div class="edit-actions">
              ${iconButtonHtml(`data-move="-1" aria-label="Move ${safeName} up"${index === 0 ? ' disabled' : ''}`, 'bi-arrow-up')}
              ${iconButtonHtml(`data-move="1" aria-label="Move ${safeName} down"${index === lineup.length - 1 ? ' disabled' : ''}`, 'bi-arrow-down')}
            </div>
          </td>
        </tr>`;
		}

		function redraw() {
			tableBody.innerHTML = lineup.map(rowHtml).join('');
		}

		function place(product, index) {
			lineup.splice(lineup.indexOf(product), 1);
			lineup.splice(index, 0, product);
			redraw();
			statusLine.innerHTML = `<strong>${htmlSafe(product.name)}</strong> is now number ${index + 1} on the front page`;
			const tableRow = rowOf(tableBody, product.id);
			if (tableRow) flashRow(tableRow);
		}

		function clearDropMarks() {
			for (const marked of pickAll('.is-drop-target', tableBody)) marked.classList.remove('is-drop-target');
		}

		tableBody.addEventListener('click', ({ target }) => {
			const arrow = target.closest('[data-move]');
			if (!arrow || arrow.disabled) return;
			const direction = Number(arrow.getAttribute('data-move'));
			const id = idOf(arrow);
			const product = lineup.find((candidate) => candidate.id === id);
			place(product, lineup.indexOf(product) + direction);
			const tableRow = rowOf(tableBody, id);
			const sameArrow = pick(`[data-move="${direction}"]`, tableRow);
			(sameArrow.disabled ? pick(`[data-move="${-direction}"]`, tableRow) : sameArrow).focus();
		});
		tableBody.addEventListener('dragstart', (event) => {
			const tableRow = event.target.closest('tr[data-id]');
			if (!tableRow) return;
			lifted = tableRow;
			tableRow.classList.add('is-dragging');
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', tableRow.getAttribute('data-id'));
		});
		tableBody.addEventListener('dragover', (event) => {
			const tableRow = event.target.closest('tr[data-id]');
			if (!lifted || !tableRow) return;
			event.preventDefault();
			clearDropMarks();
			if (tableRow !== lifted) tableRow.classList.add('is-drop-target');
		});
		tableBody.addEventListener('drop', (event) => {
			const tableRow = event.target.closest('tr[data-id]');
			if (!lifted || !tableRow) return;
			event.preventDefault();
			const fromIndex = lineup.findIndex((candidate) => candidate.id === idOf(lifted));
			const toIndex = lineup.findIndex((candidate) => candidate.id === idOf(tableRow));
			if (fromIndex !== toIndex) place(lineup[fromIndex], toIndex);
		});
		tableBody.addEventListener('dragend', () => {
			lifted = null;
			for (const marked of pickAll('.is-dragging, .is-drop-target', tableBody))
				marked.classList.remove('is-dragging', 'is-drop-target');
		});
		redraw();
	}

	/**
	 * January price review: edit, review, apply. Each row shows the change
	 * against today's price; nothing is live until Apply, and a row can go
	 * back on its own. A typed value that is not a price above zero falls
	 * back to today's.
	 */
	function wirePriceReview(demo) {
		const [tableBody, statusLine, applyButton, revertAllButton] = within(
			demo,
			'tbody',
			'[data-edit-status]',
			'[data-edit-apply]',
			'[data-edit-revert-all]',
		);
		const priceList = PRICE_REVIEW;

		function isChanged(product) {
			return Math.abs(product.next - product.today) > 0.001;
		}

		function changeBadge(product) {
			if (!isChanged(product)) return badgeHtml('muted', 'No change');
			const percent = ((product.next - product.today) / product.today) * 100;
			const rising = percent > 0;
			return badgeHtml(rising ? 'warning' : 'success', `${rising ? '+' : '−'}${Math.abs(percent).toFixed(1)}%`);
		}

		function rowHtml(product) {
			return oneLine`
        <tr${isChanged(product) ? ' class="is-dirty"' : ''} data-id="${product.id}">
          <td class="edit-wide"><span class="edit-strong">${product.name}</span><span class="edit-sub">${product.sku}, today ${dollars(product.today, 2)}</span></td>
          <td class="edit-num">${moneyFieldHtml('edit-price', product.next, `New price for ${product.name}`)}</td>
          <td data-change>${changeBadge(product)}</td>
          <td class="text-end">${iconButtonHtml(`data-revert aria-label="Revert ${product.name}" title="Revert"${isChanged(product) ? '' : ' disabled'}`, 'bi-arrow-counterclockwise')}</td>
        </tr>`;
		}

		function report(lead) {
			const changed = priceList.filter(isChanged);
			applyButton.disabled = revertAllButton.disabled = changed.length === 0;
			applyButton.textContent = changed.length ? `Apply ${plural(changed.length, 'price')}` : 'Apply prices';
			if (lead || changed.length === 0) {
				statusLine.textContent = lead || 'Type a new price to see the change';
				return;
			}
			const average =
				(changed.reduce((sum, product) => sum + (product.next - product.today) / product.today, 0) /
					changed.length) *
				100;
			statusLine.innerHTML = `<strong>${plural(changed.length, 'price')} changed</strong>, ${average >= 0 ? 'up ' : 'down '}${Math.abs(average).toFixed(1)}% on average`;
		}

		function redraw() {
			tableBody.innerHTML = priceList.map(rowHtml).join('');
			report();
		}

		function readPrice(target, tidy) {
			if (!target.matches('input')) return;
			const tableRow = target.closest('tr');
			const product = priceList.find((candidate) => candidate.id === idOf(tableRow));
			const typedPrice = parseMoney(target.value);
			product.next = typedPrice > 0 ? typedPrice : product.today;
			if (tidy) target.value = product.next.toFixed(2);
			tableRow.classList.toggle('is-dirty', isChanged(product));
			pick('[data-change]', tableRow).innerHTML = changeBadge(product);
			pick('[data-revert]', tableRow).disabled = !isChanged(product);
			report();
		}

		tableBody.addEventListener('input', ({ target }) => readPrice(target, false));
		tableBody.addEventListener('change', ({ target }) => readPrice(target, true));
		tableBody.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' || !event.target.matches('input')) return;
			event.preventDefault();
			readPrice(event.target, true);
		});
		tableBody.addEventListener('click', ({ target }) => {
			const revertButton = target.closest('[data-revert]');
			if (!revertButton) return;
			const id = idOf(revertButton);
			const product = priceList.find((candidate) => candidate.id === id);
			product.next = product.today;
			redraw();
			pick(`tr[data-id="${id}"] input`, tableBody).focus();
			report(`${product.name} is back to ${dollars(product.today, 2)}`);
		});
		revertAllButton.addEventListener('click', () => {
			for (const product of priceList) product.next = product.today;
			redraw();
			report('Every price is back to today’s');
		});
		applyButton.addEventListener('click', () => {
			const changed = priceList.filter(isChanged);
			for (const product of changed) product.today = product.next;
			redraw();
			for (const product of changed) flashRow(rowOf(tableBody, product.id));
			report(`New prices are live for ${plural(changed.length, 'product')}`);
		});
		redraw();
	}

	/**
	 * The chips hide every card of another group. The keyboard card has
	 * data-edit-extra and shows only with All. In a filtered view the
	 * wide and narrow cards fall back to plain halves, and an odd half at
	 * the end takes the whole row.
	 */
	function wireFilter() {
		const deck = pick('[data-edit-grid]', pageRoot);
		const tiles = [...pickAll('.edit-card', deck)];
		const tally = pick('[data-edit-count]', pageRoot);
		const filterChips = [...pickAll('[data-edit-filter]', pageRoot)];

		function showGroup(groupName) {
			const kept = tiles.filter((tile) => {
				const extra = tile.hasAttribute('data-edit-extra');
				const showing = groupName === 'all' || (!extra && tile.getAttribute('data-edit-group') === groupName);
				tile.classList.toggle('is-hidden', !showing);
				tile.classList.remove('is-alone');
				return showing;
			});
			deck.classList.toggle('is-filtered', groupName !== 'all');
			if (groupName !== 'all') {
				const halves = kept.filter((tile) => !tile.classList.contains('edit-card-full'));
				if (halves.length % 2) halves.at(-1).classList.add('is-alone');
			}
			const demoCount = kept.filter((tile) => tile.hasAttribute('data-edit-demo')).length;
			if (tally) tally.textContent = `${demoCount} table${demoCount === 1 ? '' : 's'}`;
		}

		for (const chipButton of filterChips) {
			chipButton.addEventListener('click', () => {
				for (const sibling of filterChips) sibling.setAttribute('aria-pressed', String(sibling === chipButton));
				showGroup(chipButton.getAttribute('data-edit-filter'));
			});
		}
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
