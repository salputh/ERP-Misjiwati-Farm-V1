/**
 * Basalt: what offcanvas.html does on its own.
 * The chips that filter the card grid, the Copy buttons under each code
 * sample, the small confirmation that appears bottom right, and the four
 * working demos (filter drawer, record drawer, bottom sheet, resizable
 * drawer). The panel mechanics themselves, window.Basalt.drawer and the
 * data-basalt-* panel kinds, are shared and live in basalt.js.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-oc-root]');
	if (!pageRoot || !window.bootstrap) return;

	const { recordNav: stepRecords, applied: paintAppliedChips } = window.Basalt.drawer;

	/* How long a Copy button reads "Copied", how long the confirmation
     stays up, and how long a drag has to settle before the width note
     is rewritten. */
	const COPIED_FOR = 1800;
	const FLASH_FOR = 2600;
	const WIDTH_NOTE_DELAY = 120;

	const RANGE_LABEL = { 7: 'Last 7 days', 30: 'Last 30 days' };
	const STATE_TONE = { Active: 'success', Trial: 'info', 'On hold': 'warning' };
	const RECORD_FIELDS = ['name', 'kind', 'plan', 'spend', 'orders', 'contact', 'email'];
	const NO_FILTERS = { status: [], region: '', days: '', standing: false };
	const STARTING_FILTERS = { status: ['awaiting', 'packed'], region: '', days: '', standing: false };

	const flashBox = pick('[data-oc-flash-box]', pageRoot);
	const flashLine = pick('[data-oc-flash-text]', pageRoot);
	let flashTimer = 0;
	const copyTimers = new WeakMap();

	function start() {
		wireChips();
		wireCopyButtons();
		document.addEventListener('click', (event) => {
			const trigger = event.target.closest('[data-oc-flash]');
			if (trigger) flash(trigger.getAttribute('data-oc-flash'));
		});
		wireFilterDrawer();
		wireRecordDrawer();
		wireBottomSheet();
		wireWidthNote();
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function countOf(amount, singular, pluralForm) {
		return `${amount} ${amount === 1 ? singular : pluralForm}`;
	}

	function offcanvasOf(element) {
		return bootstrap.Offcanvas.getOrCreateInstance(element);
	}

	/**
	 * Shows a short confirmation bottom right and hides it again after a
	 * moment. A second message replaces the first and restarts the clock.
	 * @param {string} message
	 */
	function flash(message) {
		if (!flashBox) return;
		flashLine.textContent = message;
		flashBox.hidden = false;
		clearTimeout(flashTimer);
		flashTimer = setTimeout(() => {
			flashBox.hidden = true;
		}, FLASH_FOR);
	}

	/* The chips above the grid show one group of cards at a time. Cards
     pair up two to a row at desktop width, so a card left without a
     partner before a full-width card, or at the end, is marked to take
     the whole row. */
	function wireChips() {
		const cardGrid = pick('[data-oc-grid]', pageRoot);
		if (!cardGrid) return;
		const groupChips = pickAll('[data-oc-filter]', pageRoot);
		const panelCards = pickAll('.oc-card', cardGrid);
		const shownCount = pick('[data-oc-count]', pageRoot);

		function showGroup(group) {
			const shownCards = panelCards.filter((card) => {
				const cardGroups = (card.getAttribute('data-oc-groups') ?? '').split(/\s+/);
				const shown = group === 'all' || cardGroups.includes(group);
				card.classList.toggle('is-hidden', !shown);
				card.classList.remove('is-alone');
				return shown;
			});

			let pairable = [];
			const settlePairs = () => {
				if (pairable.length % 2) pairable[pairable.length - 1].classList.add('is-alone');
				pairable = [];
			};
			for (const card of shownCards) {
				if (card.classList.contains('oc-card-full')) settlePairs();
				else pairable.push(card);
			}
			settlePairs();

			if (shownCount) shownCount.textContent = countOf(shownCards.length, 'panel type', 'panel types');
		}

		for (const groupChip of groupChips) {
			groupChip.addEventListener('click', () => {
				for (const sibling of groupChips) sibling.setAttribute('aria-pressed', String(sibling === groupChip));
				showGroup(groupChip.getAttribute('data-oc-filter'));
			});
		}
		showGroup('all');
	}

	/* Each Copy button puts the <pre> beside it on the clipboard and reads
     "Copied" with a check mark for a moment. */
	function wireCopyButtons() {
		for (const button of pickAll('[data-oc-copy]', pageRoot)) {
			button.addEventListener('click', () => {
				const codeSample = pick('pre', button.parentElement);
				if (!codeSample) return;
				window.Basalt.copyText(codeSample.textContent.trim()).then(() => setCopyState(button, true));
			});
		}
	}

	function setCopyState(button, copied) {
		const glyph = pick('.bi', button);
		button.lastChild.textContent = copied ? ' Copied' : ' Copy';
		if (glyph) glyph.className = copied ? 'bi bi-check2' : 'bi bi-clipboard';
		clearTimeout(copyTimers.get(button));
		if (copied)
			copyTimers.set(
				button,
				setTimeout(() => setCopyState(button, false), COPIED_FOR),
			);
	}

	/* The filter drawer. The form is a draft: counts in the drawer follow
     every change, but the order list only changes on Show, and closing
     the drawer any other way puts the form back to what is applied. */
	function wireFilterDrawer() {
		const demo = pick('[data-oc-filterdemo]', pageRoot);
		const filterPanel = pick('#oc-filter');
		if (!demo || !filterPanel) return;

		const filterForm = pick('[data-oc-filter-form]', filterPanel);
		const showButton = pick('[data-oc-filter-submit]', filterPanel);
		const statusBoxes = pickAll('input[name="status"]', filterForm);
		const orderRows = pickAll('.oc-order', demo);
		const orderCount = pick('[data-oc-filter-count]', demo);
		const badge = pick('[data-oc-filter-badge]', demo);
		const chipBox = pick('[data-oc-applied]', demo);
		const emptyNote = pick('[data-oc-none]', demo);
		const opener = pick('[data-bs-target="#oc-filter"]', demo);

		const labelForStatus = Object.fromEntries(
			statusBoxes.map((box) => [
				box.value,
				pick(`label[for="${box.id}"]`, filterForm).firstChild.textContent.trim(),
			]),
		);
		let liveFilters = readForm();

		function readForm() {
			return {
				status: statusBoxes.filter((box) => box.checked).map((box) => box.value),
				region: filterForm.elements.region.value,
				days: filterForm.elements.days.value,
				standing: filterForm.elements.standing.checked,
			};
		}

		function fillForm(filters) {
			for (const box of statusBoxes) box.checked = filters.status.includes(box.value);
			filterForm.elements.region.value = filters.region;
			for (const radio of pickAll('input[name="days"]', filterForm)) radio.checked = radio.value === filters.days;
			filterForm.elements.standing.checked = filters.standing;
		}

		/**
		 * Whether an order row survives a set of filters. With `ignoreStatus`
		 * the status boxes are left out, which is how each box counts what it
		 * alone would leave.
		 */
		function survives(row, filters, ignoreStatus) {
			const { status: wanted, region: area, days: within, standing: standingOnly } = filters;
			if (!ignoreStatus && wanted.length && !wanted.includes(row.dataset.status)) return false;
			if (area && row.dataset.region !== area) return false;
			if (within && Number(row.dataset.days) > Number(within)) return false;
			if (standingOnly && row.dataset.standing !== '1') return false;
			return true;
		}

		function previewCounts() {
			const draft = readForm();
			const matching = orderRows.filter((row) => survives(row, draft)).length;
			showButton.textContent = matching ? `Show ${countOf(matching, 'order', 'orders')}` : 'No orders match';
			for (const perStatus of pickAll('[data-oc-count-for]', filterForm)) {
				const statusValue = perStatus.getAttribute('data-oc-count-for');
				perStatus.textContent = String(
					orderRows.filter((row) => row.dataset.status === statusValue && survives(row, draft, true)).length,
				);
			}
		}

		function commitFilters(filters) {
			liveFilters = filters;
			let shown = 0;
			for (const row of orderRows) {
				const kept = survives(row, filters);
				row.hidden = !kept;
				if (kept) shown += 1;
			}
			orderCount.textContent = countOf(shown, 'order', 'orders');
			emptyNote.hidden = shown > 0;

			const appliedChips = filters.status.map((value) => ({
				label: labelForStatus[value],
				remove: () =>
					commitFilters({ ...liveFilters, status: liveFilters.status.filter((kept) => kept !== value) }),
			}));
			if (filters.region)
				appliedChips.push({
					label: filters.region,
					remove: () => commitFilters({ ...liveFilters, region: '' }),
				});
			if (filters.days)
				appliedChips.push({
					label: RANGE_LABEL[filters.days],
					remove: () => commitFilters({ ...liveFilters, days: '' }),
				});
			if (filters.standing)
				appliedChips.push({
					label: 'Standing orders',
					remove: () => commitFilters({ ...liveFilters, standing: false }),
				});

			badge.hidden = !appliedChips.length;
			badge.textContent = String(appliedChips.length);
			opener.setAttribute('aria-label', appliedChips.length ? `Filters, ${appliedChips.length} on` : 'Filters');
			paintAppliedChips(chipBox, appliedChips, () => commitFilters(NO_FILTERS), opener);
			fillForm(filters);
			previewCounts();
		}

		filterForm.addEventListener('change', previewCounts);
		filterForm.addEventListener('input', previewCounts);
		filterForm.addEventListener('reset', () => setTimeout(previewCounts, 0));
		filterForm.addEventListener('submit', (event) => {
			event.preventDefault();
			commitFilters(readForm());
			offcanvasOf(filterPanel).hide();
		});
		filterPanel.addEventListener('show.bs.offcanvas', () => {
			fillForm(liveFilters);
			previewCounts();
		});
		pick('[data-oc-filter-clear]', demo).addEventListener('click', () => {
			commitFilters(NO_FILTERS);
			opener.focus();
		});
		commitFilters(STARTING_FILTERS);
	}

	/* The record drawer opens on the customer whose row was clicked and
     steps through the rest without closing. The row on show is marked
     behind the drawer, and gets the focus back once it closes. */
	function wireRecordDrawer() {
		const recordPanel = pick('#oc-record');
		if (!recordPanel) return;
		const rowButtons = pickAll('[data-oc-record]', pageRoot);
		const customerRecords = pickAll('[data-oc-cust-data] li', pageRoot).map((item) => ({ ...item.dataset }));
		const fieldSlot = (key) => pick(`[data-oc-r="${key}"]`, recordPanel);

		const stepper = stepRecords(recordPanel, customerRecords.length, (index) => {
			const customer = customerRecords[index];
			const avatar = fieldSlot('initials');
			avatar.textContent = customer.initials;
			avatar.className = `oc-av oc-av-lg oc-av-${customer.tone}`;
			for (const key of RECORD_FIELDS) fieldSlot(key).textContent = customer[key];
			const stateBadge = fieldSlot('state');
			stateBadge.textContent = customer.state;
			stateBadge.className = `basalt-status basalt-status-dot basalt-status-${STATE_TONE[customer.state] ?? 'primary'}`;
			for (const [position, button] of rowButtons.entries())
				button.classList.toggle('is-current', position === index);
		});

		recordPanel.addEventListener('show.bs.offcanvas', (event) => {
			const openAt = event.relatedTarget ? Number(event.relatedTarget.getAttribute('data-oc-record')) : 0;
			stepper.go(openAt, 0);
		});
		recordPanel.addEventListener('hidden.bs.offcanvas', () => {
			const lastShown = rowButtons[stepper.at];
			for (const button of rowButtons) button.classList.remove('is-current');
			/* Bootstrap has just handed focus to the row that opened the drawer;
         the row of the record you ended on takes it from there. */
			setTimeout(() => {
				lastShown?.focus();
			}, 0);
		});
	}

	/* The bottom sheet totals the quantities as they change and names the
     count on its button. Adding reports through the confirmation. */
	function wireBottomSheet() {
		const sheet = pick('#oc-sheet');
		if (!sheet) return;
		const picks = pick('[data-oc-picks]', sheet);
		const totalLine = pick('[data-oc-total]', sheet);
		const addButton = pick('[data-oc-add]', sheet);
		let chosen = 0;

		function tallyPicks() {
			let dollars = 0;
			chosen = 0;
			for (const pickRow of pickAll('.oc-pick', picks)) {
				const quantity = Math.max(0, parseInt(pick('input', pickRow).value, 10) || 0);
				chosen += quantity;
				dollars += quantity * Number(pickRow.getAttribute('data-price'));
			}
			totalLine.textContent = chosen
				? `${countOf(chosen, 'item', 'items')} · $${dollars.toFixed(2)}`
				: 'Nothing chosen yet';
			addButton.textContent = chosen ? `Add ${countOf(chosen, 'item', 'items')}` : 'Add to order';
			addButton.disabled = !chosen;
		}

		picks.addEventListener('change', tallyPicks);
		picks.addEventListener('input', tallyPicks);
		picks.addEventListener('click', () => setTimeout(tallyPicks, 0));
		addButton.addEventListener('click', () => flash(`${countOf(chosen, 'item', 'items')} added to the order`));
		tallyPicks();
	}

	/* The resizable drawer reports its width in the subtitle once a drag
     has settled. */
	function wireWidthNote() {
		const resizePanel = pick('#oc-resize');
		if (!resizePanel) return;
		const note = pick('[data-oc-width-note]', resizePanel);
		let settle = 0;
		resizePanel.addEventListener('basalt:resize', (event) => {
			clearTimeout(settle);
			settle = setTimeout(() => {
				note.textContent = `${event.detail.width}px wide. Drag the left edge to resize.`;
			}, WIDTH_NOTE_DELAY);
		});
	}

	start();
})();
