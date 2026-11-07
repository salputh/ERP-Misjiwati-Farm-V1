/**
 * Responsive tables, used by tables-on-mobile.html.
 * The seven layouts are container queries in the stylesheet and need no
 * script. This file covers what still needs a hand: sortable headers, the
 * order list with its search, paging and selection, the note under the
 * column-priority table, expandable rows, the scroll nudges beside the
 * pinned column, the column pager, inline stock edits and the chip filters.
 */
(() => {
	'use strict';

	const stage = pick('[data-rt-root]');
	if (!stage) return;

	const ORDERS_PER_PAGE = 6;
	const PAGED_BELOW_PX = 480;
	const SHIPPABLE = new Set(['Paid', 'Packing']);
	const SORT_GLYPHS = { ascending: 'bi-chevron-up', descending: 'bi-chevron-down', none: 'bi-chevron-expand' };
	const stillMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

	function start() {
		mountPhonePreview();
		mountOrders();
		mountAccounts();
		mountSubscriptions();
		mountMonthGrid();
		mountInvoices();
		mountStock();
		mountVisitTypes();
		mountPatternChips();
	}

	/* Small shared helpers. */

	function tally(n, single, several) {
		return `${n} ${n === 1 ? single : several}`;
	}

	function clamp(n, low, high) {
		return Math.min(high, Math.max(low, n));
	}

	function pressOnly(chosen, group) {
		for (const member of group) member.setAttribute('aria-pressed', String(member === chosen));
	}

	/* Sorting, shared by every table with .rt-sort buttons in its header. */

	/**
	 * A cell sorts by its data-rt-value when it carries one, else by its text.
	 * Anything that reads as a number (currency signs and commas aside) sorts
	 * numerically; the rest sorts case-insensitively.
	 */
	function sortKeyOf(row, column) {
		const cell = row.children[column];
		if (!cell) return '';
		const raw = cell.getAttribute('data-rt-value') ?? cell.textContent.trim();
		const asNumber = Number(raw.replace(/[$,]/g, ''));
		return raw !== '' && !Number.isNaN(asNumber) ? asNumber : raw.toLowerCase();
	}

	function orderOf(left, right) {
		if (typeof left === 'number' && typeof right === 'number') return left - right;
		return String(left).localeCompare(String(right));
	}

	function paintSortState(table, activeHeader, direction) {
		for (const header of pickAll('thead th[aria-sort]', table)) {
			const state = header === activeHeader ? direction : 'none';
			const glyph = pick('.rt-sort .bi', header);
			header.setAttribute('aria-sort', state);
			if (glyph) glyph.className = `bi ${SORT_GLYPHS[state]}`;
		}
	}

	function reorderBy(table, header, direction) {
		const body = table.tBodies[0];
		const column = [...header.parentElement.children].indexOf(header);
		const sign = direction === 'ascending' ? 1 : -1;
		const sorted = [...body.rows].sort((a, b) => sign * orderOf(sortKeyOf(a, column), sortKeyOf(b, column)));
		body.append(...sorted);
		paintSortState(table, header, direction);
	}

	/* A sorted header flips on the next click; a fresh one starts ascending. */
	function wireSortButtons(table, onSorted) {
		for (const button of pickAll('.rt-sort', table)) {
			button.addEventListener('click', () => {
				const header = button.closest('th');
				const direction = header.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
				reorderBy(table, header, direction);
				onSorted?.(header, direction);
			});
		}
	}

	/* The phone-width toggle on every card. */

	function mountPhonePreview() {
		for (const toggle of pickAll('[data-rt-phone]', stage)) {
			const frame = pick('[data-rt-frame]', toggle.closest('.card-body'));
			toggle.addEventListener('click', () => {
				const narrow = toggle.getAttribute('aria-pressed') !== 'true';
				toggle.setAttribute('aria-pressed', String(narrow));
				frame.classList.toggle('is-phone', narrow);
			});
		}
	}

	/* 1. Orders: search, status, sort, paging and row selection. */

	function mountOrders() {
		const table = pick('[data-rt-orders]', stage);
		if (!table) return;
		const frame = table.closest('[data-rt-frame]');
		const body = table.tBodies[0];
		const everyRow = [...body.rows];
		const field = pick('[data-rt-search]', frame);
		const statusPick = pick('[data-rt-status]', frame);
		const sortPick = pick('[data-rt-sort-select]', frame);
		const summary = pick('[data-rt-range]', frame);
		const pager = pick('[data-rt-pages]', frame);
		const nothing = pick('[data-rt-empty]', frame);
		const headBox = pick('[data-rt-all]', frame);
		const batchBar = pick('[data-rt-bulk]', frame);
		const batchCount = pick('[data-rt-selected]', frame);
		let pageNo = 1;

		function boxOf(row) {
			return pick('.rt-check input', row);
		}

		function filtered() {
			const needle = field.value.trim().toLowerCase();
			const wanted = statusPick.value;
			return [...body.rows].filter(
				(row) =>
					(!wanted || row.getAttribute('data-rt-status') === wanted) &&
					(!needle || row.textContent.trim().toLowerCase().includes(needle)),
			);
		}

		function onScreen() {
			return [...body.rows].filter((row) => !row.hidden);
		}

		function draw() {
			const hits = filtered();
			const pageCount = Math.max(1, Math.ceil(hits.length / ORDERS_PER_PAGE));
			pageNo = Math.min(pageNo, pageCount);
			const first = (pageNo - 1) * ORDERS_PER_PAGE;
			const onPage = new Set(hits.slice(first, first + ORDERS_PER_PAGE));

			for (const row of everyRow) row.hidden = !onPage.has(row);

			nothing.hidden = hits.length > 0;
			table.hidden = hits.length === 0;
			summary.textContent = hits.length
				? `${first + 1}–${Math.min(first + ORDERS_PER_PAGE, hits.length)} of ${tally(hits.length, 'order', 'orders')}`
				: 'No orders to show';
			drawPager(pageCount, hits.length > 0);
			syncChecks();
		}

		function drawPager(pageCount, anyRows) {
			pager.replaceChildren();
			if (!anyRows) return;
			const stops = [
				{ label: 'Previous page', goTo: pageNo - 1, arrow: 'left' },
				...Array.from({ length: pageCount }, (_, i) => ({ label: `Page ${i + 1}`, goTo: i + 1 })),
				{ label: 'Next page', goTo: pageNo + 1, arrow: 'right' },
			];
			for (const stop of stops) pager.append(pagerItem(stop, pageCount));
		}

		function pagerItem({ label, goTo, arrow }, pageCount) {
			const item = document.createElement('li');
			const button = document.createElement('button');
			const isCurrent = !arrow && goTo === pageNo;
			button.type = 'button';
			button.className = 'page-link';
			button.disabled = goTo < 1 || goTo > pageCount;
			button.setAttribute('aria-label', label);
			if (arrow) button.innerHTML = `<i class="bi bi-chevron-${arrow}" aria-hidden="true"></i>`;
			else button.textContent = String(goTo);
			if (isCurrent) button.setAttribute('aria-current', 'page');
			item.className = ['page-item', isCurrent && 'active', button.disabled && 'disabled']
				.filter(Boolean)
				.join(' ');
			button.addEventListener('click', () => {
				pageNo = goTo;
				draw();
				pick('[aria-current="page"]', pager)?.focus();
			});
			item.append(button);
			return item;
		}

		function syncChecks() {
			const visibleBoxes = onScreen().map(boxOf);
			const ticked = visibleBoxes.filter((box) => box.checked).length;
			let chosen = 0;
			headBox.checked = ticked > 0 && ticked === visibleBoxes.length;
			headBox.indeterminate = ticked > 0 && ticked < visibleBoxes.length;

			for (const row of everyRow) {
				const on = boxOf(row).checked;
				row.classList.toggle('is-selected', on);
				if (on) chosen += 1;
			}

			batchBar.hidden = chosen === 0;
			batchCount.textContent = `${tally(chosen, 'order', 'orders')} selected`;
		}

		function fromFirstPage() {
			pageNo = 1;
			draw();
		}

		function shipChosen() {
			for (const row of everyRow) {
				const box = boxOf(row);
				if (!box.checked) continue;
				box.checked = false;
				const cell = pick('[data-label="Status"]', row);
				if (!SHIPPABLE.has(cell.getAttribute('data-rt-value'))) continue;
				row.setAttribute('data-rt-status', 'shipped');
				cell.setAttribute('data-rt-value', 'Shipped');
				cell.innerHTML = '<span class="rt-pill rt-pill-info">Shipped</span>';
			}

			draw();
		}

		field.addEventListener('input', fromFirstPage);
		statusPick.addEventListener('change', fromFirstPage);
		pick('[data-rt-reset]', frame).addEventListener('click', () => {
			field.value = '';
			statusPick.value = '';
			fromFirstPage();
			field.focus();
		});

		body.addEventListener('change', (event) => {
			if (event.target.matches('.rt-check input')) syncChecks();
		});
		headBox.addEventListener('change', () => {
			for (const row of onScreen()) boxOf(row).checked = headBox.checked;
			syncChecks();
		});
		pick('[data-rt-clear]', frame).addEventListener('click', () => {
			for (const row of everyRow) boxOf(row).checked = false;
			syncChecks();
		});
		pick('[data-rt-ship]', frame).addEventListener('click', shipChosen);

		/* The header buttons and the phone-only sort menu share one sort. */
		wireSortButtons(table, (header, direction) => {
			const key = pick('.rt-sort', header).getAttribute('data-rt-sort');
			const choice = [...sortPick.options].find((option) => option.value === `${key}:${direction}`);
			if (choice) sortPick.value = choice.value;
			fromFirstPage();
		});
		sortPick.addEventListener('change', () => {
			const [key, direction] = sortPick.value.split(':');
			reorderBy(table, pick(`[data-rt-sort="${key}"]`, table).closest('th'), direction);
			fromFirstPage();
		});

		draw();
	}

	/* 2. Accounts: a note naming the columns the frame has tucked away. */

	function mountAccounts() {
		const table = pick('[data-rt-customers]', stage);
		if (!table) return;
		const frame = table.closest('[data-rt-frame]');
		const note = pick('[data-rt-hidden-note]', frame);
		const toggle = pick('[data-rt-show-all]', frame);
		const ranked = [...pickAll('thead th[data-rt-prio]', table)];
		let lastNote = '';
		wireSortButtons(table);

		function wording(widened, tucked) {
			if (widened) return 'Every column shown, scroll sideways to see them';
			if (!tucked.length) return 'All columns shown';
			const names = tucked.map((header) => header.textContent.trim().toLowerCase()).join(', ');
			return `${tally(tucked.length, 'column', 'columns')} hidden to fit: ${names}`;
		}

		function describe() {
			const tucked = ranked.filter((header) => getComputedStyle(header).display === 'none');
			const widened = table.classList.contains('is-all');
			const text = wording(widened, tucked);
			toggle.hidden = !tucked.length && !widened;
			if (text === lastNote) return;
			note.textContent = text;
			lastNote = text;
		}

		toggle.addEventListener('click', () => {
			const widened = table.classList.toggle('is-all');
			toggle.setAttribute('aria-pressed', String(widened));
			toggle.textContent = widened ? 'Fit to width' : 'Show every column';
			describe();
		});
		new ResizeObserver(() => requestAnimationFrame(describe)).observe(frame);
	}

	/* 3. Subscriptions: a detail row under each account. */

	function mountSubscriptions() {
		const table = pick('[data-rt-subs]', stage);
		if (!table) return;
		const frame = table.closest('[data-rt-frame]');
		const toggles = [...pickAll('.rt-expand', table)];
		const master = pick('[data-rt-expand-all]', frame);

		/* The row itself cannot clip its height, so the facts list inside it slides. */
		function reveal(toggle, open) {
			const detail = document.getElementById(toggle.getAttribute('aria-controls'));
			window.Basalt.slide(pick('.rt-facts', detail), () => {
				detail.hidden = !open;
			});
			toggle.setAttribute('aria-expanded', String(open));
			toggle.closest('tr').classList.toggle('is-open', open);
		}

		function syncMaster() {
			const allOpen = toggles.every((toggle) => toggle.getAttribute('aria-expanded') === 'true');
			master.textContent = allOpen ? 'Collapse all' : 'Expand all';
			master.setAttribute('aria-pressed', String(allOpen));
		}

		for (const toggle of toggles) {
			toggle.addEventListener('click', () => {
				reveal(toggle, toggle.getAttribute('aria-expanded') !== 'true');
				syncMaster();
			});
		}

		master.addEventListener('click', () => {
			const open = master.getAttribute('aria-pressed') !== 'true';
			for (const toggle of toggles) reveal(toggle, open);
			syncMaster();
		});
	}

	/* 4. Visits by month: the pinned column, its shadow and the nudge buttons. */

	function mountMonthGrid() {
		const table = pick('[data-rt-jobs]', stage);
		if (!table) return;
		const frame = table.closest('[data-rt-frame]');
		const shade = pick('[data-rt-shadow]', frame);
		const scroller = pick('.rt-scroll', shade);
		const [back, forward] = pickAll('[data-rt-nudge]', frame);
		wireSortButtons(table);

		function paintEdges() {
			const end = scroller.scrollWidth - scroller.clientWidth;
			const atStart = scroller.scrollLeft <= 1;
			const atEnd = scroller.scrollLeft >= end - 1;
			shade.classList.toggle('is-scrolled', !atStart);
			shade.classList.toggle('has-more', !atEnd);
			back.disabled = atStart;
			forward.disabled = atEnd;
		}

		for (const nudge of [back, forward]) {
			nudge.addEventListener('click', () => {
				const distance =
					Math.max(scroller.clientWidth * 0.6, 160) * Number(nudge.getAttribute('data-rt-nudge'));
				scroller.scrollBy({ left: distance, behavior: stillMotion.matches ? 'auto' : 'smooth' });
			});
		}

		scroller.addEventListener('scroll', paintEdges, { passive: true });
		new ResizeObserver(() => requestAnimationFrame(paintEdges)).observe(scroller);
	}

	/* 5. Invoices: one column at a time when the frame is narrow. */

	function mountInvoices() {
		const table = pick('[data-rt-invoices]', stage);
		if (!table) return;
		const frame = table.closest('[data-rt-frame]');
		const strip = pick('[data-rt-colpager]', frame);
		const caption = pick('[data-rt-col-label]', frame);
		const [back, forward] = pickAll('[data-rt-col-step]', strip);
		const headers = [...pickAll('thead th[data-rt-col]', table)];
		let column = 1;

		function showColumn() {
			for (const cell of pickAll('[data-rt-col]', table)) {
				cell.classList.toggle('is-current', cell.getAttribute('data-rt-col') === String(column));
			}

			caption.textContent = `${headers[column - 1].textContent.trim()}, ${column} of ${headers.length}`;
			back.disabled = column === 1;
			forward.disabled = column === headers.length;
		}

		function judgeWidth() {
			const cramped = frame.clientWidth < PAGED_BELOW_PX;
			if (cramped === table.classList.contains('rt-paged')) return;
			table.classList.toggle('rt-paged', cramped);
			strip.hidden = !cramped;
		}

		for (const stepper of [back, forward]) {
			stepper.addEventListener('click', () => {
				column = clamp(column + Number(stepper.getAttribute('data-rt-col-step')), 1, headers.length);
				showColumn();
			});
		}

		showColumn();
		new ResizeObserver(() => requestAnimationFrame(judgeWidth)).observe(frame);
	}

	/* 6. Warehouse stock: row spacing and the inline count editor. */

	function mountStock() {
		const table = pick('[data-rt-gear]', stage);
		if (!table) return;
		const frame = table.closest('[data-rt-frame]');
		const note = pick('[data-rt-gear-note]', frame);
		const spacing = pickAll('[data-rt-density]', frame);

		for (const option of spacing) {
			option.addEventListener('click', () => {
				pressOnly(option, spacing);
				table.setAttribute('data-density', option.getAttribute('data-rt-density'));
			});
		}

		function thresholdOf(row) {
			return Number(row.getAttribute('data-rt-reorder'));
		}

		/* While a row is being edited the count lives in the stepper's input. */
		function stockOf(row) {
			const live = pick('.basalt-stepper-input', row);
			return Number(live?.value ?? pick('[data-rt-edit]', row).textContent.trim());
		}

		function levelOf(count, threshold) {
			if (count === 0) return ['Out', 'danger'];
			if (count <= threshold) return ['Low', 'warning'];
			return ['In stock', 'success'];
		}

		function paintLevel(row) {
			const [word, tone] = levelOf(stockOf(row), thresholdOf(row));
			pick('[data-rt-state]', row).innerHTML = `<span class="rt-pill rt-pill-${tone}">${word}</span>`;
		}

		function tallyLow() {
			const low = [...table.tBodies[0].rows].filter((row) => stockOf(row) <= thresholdOf(row)).length;
			note.textContent = low ? `${tally(low, 'item', 'items')} to reorder` : 'Nothing to reorder';
		}

		function stepButton(step, label) {
			const button = document.createElement('button');
			const glyph = document.createElement('i');
			button.type = 'button';
			button.className = 'basalt-stepper-btn';
			button.setAttribute('data-basalt-step', String(step));
			button.tabIndex = -1;
			button.setAttribute('aria-label', label);
			glyph.className = `bi bi-${step < 0 ? 'dash' : 'plus'}-lg`;
			glyph.setAttribute('aria-hidden', 'true');
			button.append(glyph);
			return button;
		}

		/**
		 * Swaps the count button for the shared plus and minus stepper. The level
		 * pill and the reorder note follow every change; Enter or leaving the
		 * field keeps the number, Escape restores the old one.
		 */
		function showEditor(button) {
			const row = button.closest('tr');
			const name = pick('.rt-strong', row).textContent.trim();
			const before = button.textContent.trim();
			const stepper = document.createElement('div');
			const field = document.createElement('input');
			const closeOn = new Map([
				['Enter', true],
				['Escape', false],
			]);
			let closed = false;

			stepper.className = 'basalt-stepper basalt-stepper-sm rt-edit-stepper';
			stepper.setAttribute('data-basalt-stepper', '');
			field.type = 'number';
			field.className = 'basalt-stepper-input';
			field.min = '0';
			field.max = '999';
			field.step = '1';
			field.inputMode = 'numeric';
			field.setAttribute('aria-label', `Stock for ${name}. Enter to save, Escape to cancel`);
			field.value = before;
			stepper.append(stepButton(-1, `One fewer ${name}`), field, stepButton(1, `One more ${name}`));

			button.replaceWith(stepper);
			window.Basalt.stepper?.(stepper);
			field.focus();
			field.select();

			function closeEditor(keep) {
				if (closed) return;
				closed = true;
				const rounded = Math.max(0, Math.round(Number(field.value)));
				const usable = keep && field.value !== '' && !Number.isNaN(rounded);
				button.textContent = usable ? String(rounded) : before;
				button.setAttribute('aria-label', `Change stock for ${name}, now ${button.textContent}`);
				stepper.replaceWith(button);
				paintLevel(row);
				tallyLow();
				button.focus();
			}

			/* The plus and minus buttons must not steal focus, or the edit would end. */
			stepper.addEventListener('mousedown', (event) => {
				if (event.target.closest('button')) event.preventDefault();
			});
			field.addEventListener('change', () => {
				paintLevel(row);
				tallyLow();
			});
			field.addEventListener('keydown', (event) => {
				if (!closeOn.has(event.key)) return;
				event.preventDefault();
				closeEditor(closeOn.get(event.key));
			});
			field.addEventListener('blur', () => closeEditor(true));
		}

		table.addEventListener('click', (event) => {
			const button = event.target.closest('[data-rt-edit]');
			if (button) showEditor(button);
		});
		tallyLow();
	}

	/* 7. Visit types: the industry chips. */

	function mountVisitTypes() {
		const table = pick('[data-rt-jobtypes]', stage);
		if (!table) return;
		const frame = table.closest('[data-rt-frame]');
		const counter = pick('[data-rt-trade-count]', frame);
		const chips = pickAll('[data-rt-trade]', frame);

		for (const chip of chips) {
			chip.addEventListener('click', () => {
				const trade = chip.getAttribute('data-rt-trade');
				let kept = 0;
				pressOnly(chip, chips);

				for (const row of table.tBodies[0].rows) {
					const fits = trade === 'all' || row.getAttribute('data-rt-type') === trade;
					row.hidden = !fits;
					if (fits) kept += 1;
				}

				counter.textContent = tally(kept, 'visit type', 'visit types');
			});
		}
	}

	/* The pattern chips above the grid. */

	function mountPatternChips() {
		const grid = pick('[data-rt-grid]', stage);
		if (!grid) return;
		const cards = [...pickAll('.rt-card', grid)];
		const counter = pick('[data-rt-count]', stage);
		const chips = pickAll('[data-rt-filter]', stage);

		function showKind(kind) {
			const kept = cards.filter((card) => {
				const fits = kind === 'all' || card.getAttribute('data-rt-kind') === kind;
				card.classList.toggle('is-hidden', !fits);
				card.classList.remove('is-alone');
				return fits;
			});
			const halves = kept.filter((card) => !card.classList.contains('rt-card-full'));
			grid.classList.toggle('is-filtered', kind !== 'all');
			if (kind !== 'all' && halves.length % 2) halves.at(-1).classList.add('is-alone');
			counter.textContent = tally(kept.length, 'table', 'tables');
		}

		for (const chip of chips) {
			chip.addEventListener('click', () => {
				pressOnly(chip, chips);
				showKind(chip.getAttribute('data-rt-filter'));
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
