/**
 * Behavior for the ten demo tables on table-basics.html.
 *
 * Each table opts into one feature through a data-tb-* attribute (sorting,
 * paging, search, row selection, inline price editing, footer totals,
 * expandable rows, grouped rows), and the page-level chips filter the cards
 * and toggle Bootstrap's table classes on the playground. Every feature is
 * wired on its own, so any one of them can be copied onto another table.
 */
(() => {
	'use strict';
	const host = pick('[data-tb-root]');
	if (!host) return;

	/* Chevrons for the three states of a sortable column. */
	const SORT_ICONS = { none: 'bi-chevron-expand', ascending: 'bi-chevron-up', descending: 'bi-chevron-down' };
	/* Bordered and borderless cancel each other out, so turning one on turns the other off. */
	const RIVAL_CLASSES = { 'table-bordered': 'table-borderless', 'table-borderless': 'table-bordered' };
	/* What a bulk action writes into the status pill of each picked plan. */
	const BULK_STATES = {
		pause: { label: 'Paused', tone: 'tb-tone-neutral' },
		resume: { label: 'Active', tone: 'tb-tone-success' },
	};
	const FREE_DELIVERY_OVER = 500;
	const DELIVERY_FEE = 15;
	const NUMERIC = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

	/* Wires every feature once, in the order the tables appear on the page. */
	function start() {
		wireCardFilter();
		wireClassToggles();
		for (const table of pickAll('table[data-tb-sortable]', host)) wireSorting(table);
		for (const table of pickAll('table[data-tb-paged]', host)) wirePaging(table);
		for (const input of pickAll('[data-tb-search]', host)) wireSearch(input);
		for (const table of pickAll('table[data-tb-selectable]', host)) wireSelection(table);
		for (const table of pickAll('table[data-tb-editable]', host)) wireEditing(table);
		for (const table of pickAll('table[data-tb-totals]', host)) wireTotals(table);
		for (const button of pickAll('[data-tb-expand]', host)) wireExpander(button);
		for (const button of pickAll('[data-tb-group-toggle]', host)) wireGroupToggle(button);
	}

	/* Small formatting helpers. */

	function dollars(amount) {
		return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function countOf(amount, singular, pluralForm) {
		return `${amount} ${amount === 1 ? singular : pluralForm}`;
	}

	function makeButton(label, className, onClick) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = className;
		button.textContent = label;
		if (onClick) button.addEventListener('click', onClick);
		return button;
	}

	function rowName(row) {
		return pick('th', row).textContent.trim();
	}

	/** The chips above the grid show one group of cards at a time. */
	function wireCardFilter() {
		const grid = pick('[data-tb-grid]', host);
		const cards = [...pickAll('.tb-card', grid)];
		const counter = pick('[data-tb-count]', host);
		const chips = [...pickAll('[data-tb-filter]', host)];

		function showGroup(group) {
			const kept = [];
			for (const card of cards) {
				const groups = (card.getAttribute('data-tb-group') || '').split(' ');
				const shown = group === 'all' || groups.includes(group);
				card.classList.toggle('is-hidden', !shown);
				card.classList.remove('is-alone');
				if (shown) kept.push(card);
			}
			/* A half-width card left without a partner in its row stretches across it. */
			let waiting = null;
			for (const card of kept) {
				if (!card.classList.contains('tb-card-half')) {
					waiting?.classList.add('is-alone');
					waiting = null;
				} else {
					waiting = waiting ? null : card;
				}
			}
			waiting?.classList.add('is-alone');
			if (counter) counter.textContent = countOf(kept.length, 'table', 'tables');
		}

		for (const chip of chips) {
			chip.addEventListener('click', () => {
				for (const other of chips) other.setAttribute('aria-pressed', String(other === chip));
				showGroup(chip.getAttribute('data-tb-filter'));
			});
		}
	}

	/** Pressed chips add Bootstrap table classes to the playground and print the class list. */
	function wireClassToggles() {
		const playground = pick('[data-tb-playground]', host);
		const readout = pick('[data-tb-classline]', host);
		const toggles = [...pickAll('[data-tb-class]', host)];

		function pressed(toggle) {
			return toggle.getAttribute('aria-pressed') === 'true';
		}

		function applyClasses() {
			const names = ['table'];
			for (const toggle of toggles) {
				const name = toggle.getAttribute('data-tb-class');
				playground.classList.toggle(name, pressed(toggle));
				if (pressed(toggle)) names.push(name);
			}
			if (readout) readout.textContent = names.join(' ');
		}

		for (const toggle of toggles) {
			toggle.addEventListener('click', () => {
				const name = toggle.getAttribute('data-tb-class');
				const turningOn = !pressed(toggle);
				toggle.setAttribute('aria-pressed', String(turningOn));
				const rival = turningOn && RIVAL_CLASSES[name];
				if (rival)
					toggles
						.find((other) => other.getAttribute('data-tb-class') === rival)
						?.setAttribute('aria-pressed', 'false');
				applyClasses();
			});
		}

		if (playground) applyClasses();
	}

	/** Reads a cell for sorting: data-sort wins over the text; numbers come back as numbers. */
	function orderKey(row, column, kind) {
		const cell = row.children[column];
		const raw = cell ? (cell.getAttribute('data-sort') || cell.textContent.trim()).trim() : '';
		if (kind !== 'num') return raw.toLowerCase();
		const number = parseFloat(raw.replace(/[^0-9.-]/g, ''));
		return Number.isNaN(number) ? 0 : number;
	}

	/** Header buttons sort the body rows and announce the order through a status line. */
	function wireSorting(table) {
		const body = table.tBodies[0];
		const headers = [...pickAll('thead th', table)];
		const status = table.closest('.card-body')?.querySelector('[data-tb-sort-status]');

		function markHeaders(active, direction) {
			for (const header of headers) {
				if (!pick('[data-tb-sort]', header)) continue;
				const state = header === active ? direction : 'none';
				header.setAttribute('aria-sort', state);
				const chevron = pick('.bi', header);
				if (chevron) chevron.className = `bi ${SORT_ICONS[state]}`;
			}
		}

		function orderBy(header, column, button) {
			const kind = button.getAttribute('data-tb-sort');
			const direction = header.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
			const sign = direction === 'ascending' ? 1 : -1;
			markHeaders(header, direction);
			const rows = [...body.rows].filter((row) => !row.classList.contains('tb-empty'));
			rows.sort((left, right) => {
				const a = orderKey(left, column, kind);
				const b = orderKey(right, column, kind);
				return sign * (kind === 'num' ? a - b : NUMERIC.compare(a, b));
			});
			body.append(...rows);
			if (status) status.textContent = `Sorted by ${button.textContent.trim()}, ${direction}`;
			table.dispatchEvent(new CustomEvent('tb:sorted'));
		}

		for (const [column, header] of headers.entries()) {
			const button = pick('[data-tb-sort]', header);
			if (button) button.addEventListener('click', () => orderBy(header, column, button));
		}
	}

	/** Rows per page, a range readout and a numbered pager under the table. */
	function wirePaging(table) {
		const card = table.closest('.card-body');
		const pager = pick('[data-tb-pages]', card);
		const range = pick('[data-tb-page-status]', card);
		const sizeSelect = pick('[data-tb-page-size]', card);
		const noun = table.getAttribute('data-tb-noun') || 'row';
		let pageSize = parseInt(table.getAttribute('data-tb-paged'), 10) || 10;
		let pageNumber = 1;

		/** One pager entry. edge is 'prev' or 'next' for the chevron buttons. */
		function entry(text, target, { active = false, disabled = false, edge = null, label = null } = {}) {
			const item = document.createElement('li');
			item.className = `page-item${active ? ' active' : ''}${disabled ? ' disabled' : ''}`;
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'page-link';
			if (edge) {
				button.innerHTML = `<i class="bi bi-chevron-${edge === 'prev' ? 'left' : 'right'}" aria-hidden="true"></i>`;
				button.setAttribute('data-edge', edge);
			} else {
				button.textContent = text;
			}
			if (label) button.setAttribute('aria-label', label);
			if (active) button.setAttribute('aria-current', 'page');
			if (disabled) button.disabled = true;
			button.addEventListener('click', () => {
				showPage(target);
				refocus(edge);
			});
			item.append(button);
			return item;
		}

		/* The pager is rebuilt on every click, so focus is put back on the matching button. */
		function refocus(edge) {
			const current = pick('[aria-current="page"]', pager);
			const wanted = edge ? pick(`[data-edge="${edge}"]`, pager) : current;
			const button = wanted && (wanted.disabled ? current : wanted);
			button?.focus();
		}

		function showPage(wanted) {
			const rows = [...table.tBodies[0].rows];
			const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
			pageNumber = Math.min(Math.max(1, wanted), pageCount);
			const from = (pageNumber - 1) * pageSize;
			const to = Math.min(from + pageSize, rows.length);
			for (const [index, row] of rows.entries()) row.hidden = index < from || index >= to;
			range.textContent = rows.length
				? `${from + 1}–${to} of ${countOf(rows.length, noun, `${noun}s`)}`
				: `No ${noun}s to show`;

			const entries = [
				entry('Previous', pageNumber - 1, { disabled: pageNumber === 1, edge: 'prev', label: 'Previous page' }),
			];
			for (let number = 1; number <= pageCount; number += 1) {
				entries.push(entry(String(number), number, { active: number === pageNumber, label: `Page ${number}` }));
			}
			entries.push(
				entry('Next', pageNumber + 1, { disabled: pageNumber === pageCount, edge: 'next', label: 'Next page' }),
			);
			pager.replaceChildren(...entries);
		}

		if (sizeSelect) {
			sizeSelect.value = String(pageSize);
			sizeSelect.addEventListener('change', () => {
				pageSize = parseInt(sizeSelect.value, 10) || pageSize;
				showPage(1);
			});
		}
		table.addEventListener('tb:sorted', () => showPage(1));
		showPage(1);
	}

	/** A text box (and an optional trade select) that hides rows which do not match. */
	function wireSearch(input) {
		const table = document.getElementById(input.getAttribute('aria-controls'));
		const card = input.closest('.card-body');
		const tradeSelect = pick('[data-tb-trade]', card);
		const counter = pick('[data-tb-search-count]', card);
		const emptyRow = pick('.tb-empty', table);
		const termOut = pick('[data-tb-search-term]', table);
		const clearButton = pick('[data-tb-search-clear]', table);
		const rows = [...table.tBodies[0].rows].filter((row) => row !== emptyRow);

		function filterRows() {
			const needle = input.value.trim().toLowerCase();
			const trade = tradeSelect ? tradeSelect.value : '';
			let matched = 0;
			for (const row of rows) {
				const textHit = !needle || row.textContent.trim().toLowerCase().includes(needle);
				const tradeHit = !trade || row.getAttribute('data-trade') === trade;
				row.hidden = !(textHit && tradeHit);
				if (!row.hidden) matched += 1;
			}
			emptyRow.hidden = matched > 0;
			if (termOut) {
				const parts = [needle ? `"${input.value.trim()}"` : '', trade ? `${trade} supplies` : ''];
				termOut.textContent = parts.filter(Boolean).join(' in ');
			}
			const all = countOf(rows.length, 'supply', 'supplies');
			counter.textContent = matched === rows.length ? all : `${matched} of ${all}`;
		}

		input.addEventListener('input', filterRows);
		tradeSelect?.addEventListener('change', filterRows);
		clearButton?.addEventListener('click', () => {
			input.value = '';
			if (tradeSelect) tradeSelect.value = '';
			filterRows();
			input.focus();
		});
		filterRows();
	}

	/** A header checkbox, one per row, a count and bulk buttons that act on the picked rows. */
	function wireSelection(table) {
		const card = table.closest('.card-body');
		const headBox = pick('[data-tb-select-all]', table);
		const boxes = [...pickAll('[data-tb-select-row]', table)];
		const counter = pick('[data-tb-select-count]', card);
		const bulkButtons = [...pickAll('[data-tb-bulk-action]', card)];

		function pickedBoxes() {
			return boxes.filter((box) => box.checked);
		}

		function reflect() {
			const picked = pickedBoxes();
			for (const box of boxes) box.closest('tr').classList.toggle('table-active', box.checked);
			headBox.checked = picked.length === boxes.length;
			headBox.indeterminate = picked.length > 0 && picked.length < boxes.length;
			counter.textContent = picked.length
				? `${countOf(picked.length, 'plan', 'plans')} selected`
				: 'None selected';
			for (const button of bulkButtons) button.disabled = picked.length === 0;
		}

		function setAll(checked) {
			for (const box of boxes) box.checked = checked;
			reflect();
		}

		headBox.addEventListener('change', () => setAll(headBox.checked));
		for (const box of boxes) box.addEventListener('change', reflect);

		for (const button of bulkButtons) {
			button.addEventListener('click', () => {
				const change = BULK_STATES[button.getAttribute('data-tb-bulk-action')];
				const picked = pickedBoxes();
				if (change) {
					for (const box of picked) {
						const pill = pick('[data-tb-status] .tb-tone', box.closest('tr'));
						pill.textContent = change.label;
						pill.className = `badge tb-tone ${change.tone}`;
					}
				}
				setAll(false);
				if (change)
					counter.textContent = `${countOf(picked.length, 'plan', 'plans')} ${change.label.toLowerCase()}`;
				headBox.focus();
			});
		}

		reflect();
	}

	/** Edit turns the price cells of a row into inputs; Save checks them, Cancel puts the old text back. */
	function wireEditing(table) {
		const status = pick('[data-tb-edit-status]', table.closest('.card-body'));

		function beginEdit(row) {
			const open = pick('tr.tb-editing', table);
			if (open && open !== row) cancelEdit(open);
			const name = rowName(row);
			row.classList.add('tb-editing');
			for (const cell of pickAll('[data-tb-edit]', row)) {
				const current = cell.textContent.trim();
				cell.dataset.tbOld = current;
				const field = document.createElement('input');
				field.type = 'text';
				field.inputMode = 'decimal';
				field.className = 'form-control form-control-sm tb-price';
				field.value = current.replace('$', '');
				field.setAttribute('aria-label', `${name}, ${cell.getAttribute('data-tb-edit')}`);
				cell.replaceChildren(field);
			}
			pick('.tb-actions', row).replaceChildren(
				makeButton('Save', 'btn btn-primary btn-sm', () => saveEdit(row)),
				makeButton('Cancel', 'btn btn-outline-secondary btn-sm', () => cancelEdit(row)),
			);
			const firstField = pick('input', row);
			firstField.focus();
			firstField.select();
		}

		/** Puts the row back to text (the new values, or the old ones) and returns its Edit button. */
		function endEdit(row, values) {
			row.classList.remove('tb-editing');
			for (const [index, cell] of pickAll('[data-tb-edit]', row).entries()) {
				cell.textContent = values ? values[index] : cell.dataset.tbOld;
				delete cell.dataset.tbOld;
			}
			const editButton = makeButton('Edit', 'btn btn-outline-secondary btn-sm', null);
			editButton.setAttribute('data-tb-edit-start', '');
			editButton.setAttribute('aria-label', `Edit ${rowName(row)} prices`);
			pick('.tb-actions', row).replaceChildren(editButton);
			return editButton;
		}

		function saveEdit(row) {
			const fields = [...pickAll('.tb-price', row)];
			const faulty = fields.find(
				(field) => !(parseFloat(field.value) > 0) || !/^\s*\$?\d+(\.\d{1,2})?\s*$/.test(field.value),
			);
			for (const field of fields) {
				field.classList.toggle('is-invalid', field === faulty);
				field.setAttribute('aria-invalid', String(field === faulty));
			}
			if (faulty) {
				status.textContent = 'Enter a price above zero, like 89.00.';
				faulty.focus();
				return;
			}
			const values = fields.map((field) => dollars(parseFloat(field.value.replace('$', ''))));
			const name = rowName(row);
			endEdit(row, values).focus();
			status.textContent = `Saved ${name} at ${values.join(' and ')}.`;
		}

		function cancelEdit(row) {
			const editButton = endEdit(row, null);
			status.textContent = 'No changes made.';
			return editButton;
		}

		/* One listener covers every Edit button, including those rebuilt after a save. */
		table.addEventListener('click', (event) => {
			const button = event.target.closest('[data-tb-edit-start]');
			if (button) beginEdit(button.closest('tr'));
		});
		table.addEventListener('keydown', (event) => {
			if (!event.target.classList.contains('tb-price')) return;
			const row = event.target.closest('tr');
			if (event.key === 'Enter') {
				event.preventDefault();
				saveEdit(row);
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				cancelEdit(row).focus();
			}
		});
	}

	/** Quantity steppers feed line totals, a subtotal, delivery and the grand total in the footer. */
	function wireTotals(table) {
		const note = pick('[data-tb-ship-note]', table.closest('.card-body'));

		function footCell(key) {
			return pick(`[data-tb-sum="${key}"]`, table);
		}

		function recalculate() {
			let subtotal = 0;
			for (const row of pickAll('tbody tr', table)) {
				const typed = parseInt(pick('[data-tb-qty]', row).value, 10);
				const quantity = Number.isNaN(typed) || typed < 0 ? 0 : typed;
				const lineSum = quantity * parseFloat(row.getAttribute('data-tb-price'));
				pick('[data-tb-line]', row).textContent = dollars(lineSum);
				subtotal += lineSum;
			}
			const delivery = subtotal === 0 || subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
			footCell('sub').textContent = dollars(subtotal);
			footCell('ship').textContent = delivery ? dollars(delivery) : 'Free';
			footCell('total').textContent = dollars(subtotal + delivery);
			if (note) {
				note.textContent =
					subtotal >= FREE_DELIVERY_OVER
						? `Delivery is free over ${dollars(FREE_DELIVERY_OVER)}.`
						: `Add ${dollars(FREE_DELIVERY_OVER - subtotal)} more for free delivery.`;
			}
		}

		/* Typing raises input; the stepper buttons raise change. */
		table.addEventListener('input', recalculate);
		table.addEventListener('change', recalculate);
		recalculate();
	}

	/**
	 * A chevron button shows or hides the detail row it controls; aria-expanded tells screen readers which.
	 * A table row cannot clip its height, so the cell's content goes into a plain box that slides.
	 */
	function wireExpander(button) {
		const detail = document.getElementById(button.getAttribute('aria-controls'));
		const cell = detail.cells[0];
		const box = document.createElement('div');
		box.append(...cell.childNodes);
		cell.append(box);
		button.addEventListener('click', () => {
			const opening = button.getAttribute('aria-expanded') !== 'true';
			button.setAttribute('aria-expanded', String(opening));
			window.Basalt.slide(box, () => {
				detail.hidden = !opening;
			});
		});
	}

	/** A group header folds or unfolds every other row in its tbody, sliding the box around the table. */
	function wireGroupToggle(button) {
		const body = button.closest('tbody');
		const frame = body.closest('table').parentElement;
		button.addEventListener('click', () => {
			const opening = button.getAttribute('aria-expanded') !== 'true';
			button.setAttribute('aria-expanded', String(opening));
			window.Basalt.slide(frame, () => {
				for (const row of body.rows) {
					if (!row.classList.contains('tb-group')) row.hidden = !opening;
				}
			});
		});
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
