/**
 * Tooltips and popovers page (tooltips.html). Drives the demos around
 * the components: the kind chips, the snippet copy buttons, the sample
 * order, stock table, toolbar and column the upgraded variants act on.
 * The components themselves (window.Basalt.tips and the [data-basalt-*]
 * attributes) are set up by basalt.js. Plain ES6, no libraries.
 */
(() => {
	'use strict';

	if (!window.bootstrap) return;
	const BsTooltip = window.bootstrap.Tooltip;
	const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

	const demoPage = pick('[data-tt-root]', document);
	if (!demoPage) return;

	/* How long a line takes to fade before it leaves the order, and how long
     a snippet button says "Copied" before it reads "Copy" again. */
	const FADE_MS = 220;
	const COPIED_MS = 1800;

	/* The pending "Copy" reset of each snippet button. */
	const copyResets = new WeakMap();

	/** Wires every demo on the page, in the order the cards rely on. */
	function start() {
		setUpKindChips();
		setUpSnippetCopy();
		setUpTourLauncher();
		setUpOrderLines();
		setUpEditInPlace();
		setUpFormatToolbar();
		setUpColumnSlider();
		setUpPinnedTones();
	}

	/* Lookups scoped to the page unless another scope is given. */

	function pick(selector, scope = demoPage) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = demoPage) {
		return [...scope.querySelectorAll(selector)];
	}

	function counted(n, singular, pluralForm) {
		return `${n} ${n === 1 ? singular : pluralForm}`;
	}

	/* Kind chips: each card lists its kinds in data-tt-groups; "all" shows
     every card. */

	function setUpKindChips() {
		const cardGrid = pick('[data-tt-grid]');
		if (!cardGrid) return;
		const tally = pick('[data-tt-count]');
		const demoCards = pickAll('.tt-card', cardGrid);

		function showKind(wantedKind) {
			const shownCards = demoCards.filter((demoCard) => {
				const kinds = (demoCard.getAttribute('data-tt-groups') || '').split(/\s+/);
				const keep = wantedKind === 'all' || kinds.includes(wantedKind);
				demoCard.classList.toggle('is-hidden', !keep);
				demoCard.classList.remove('is-alone');
				return keep;
			});
			markLoneCards(shownCards);
			if (tally) tally.textContent = counted(shownCards.length, 'type', 'types');
			/* Pinned tooltips follow their buttons into the new layout. */
			requestAnimationFrame(() => {
				for (const pinned of pickAll('[data-tt-pinned]')) BsTooltip.getInstance(pinned)?.update();
			});
		}

		const kindChips = pickAll('[data-tt-filter]');
		for (const chipButton of kindChips) {
			chipButton.addEventListener('click', () => {
				for (const each of kindChips) each.setAttribute('aria-pressed', String(each === chipButton));
				showKind(chipButton.getAttribute('data-tt-filter'));
			});
		}
		showKind('all');
	}

	/**
	 * Full-width cards split the visible ones into runs; the last card of a
	 * run with an odd count takes the whole row instead of sitting alone.
	 */
	function markLoneCards(shownCards) {
		let run = [];
		function closeRun() {
			if (run.length % 2) run[run.length - 1].classList.add('is-alone');
			run = [];
		}
		for (const demoCard of shownCards) {
			if (demoCard.classList.contains('tt-card-full')) closeRun();
			else run.push(demoCard);
		}
		closeRun();
	}

	/* Snippet copy buttons: the label reads "Copied" for a moment. */

	function setUpSnippetCopy() {
		for (const button of pickAll('[data-tt-copy]')) {
			button.addEventListener('click', () => {
				const snippetPre = pick('pre', button.parentElement);
				if (snippetPre) window.Basalt.copyText(snippetPre.textContent.trim()).then(() => flashCopied(button));
			});
		}
	}

	function flashCopied(button) {
		const glyph = pick('.bi', button);
		function showLabel(labelText, glyphClass) {
			button.lastChild.textContent = labelText;
			if (glyph) glyph.className = glyphClass;
		}
		showLabel(' Copied', 'bi bi-check2');
		clearTimeout(copyResets.get(button));
		copyResets.set(
			button,
			setTimeout(() => showLabel(' Copy', 'bi bi-clipboard'), COPIED_MS),
		);
	}

	/* The header's tour button scrolls to the tour card and starts it. */

	function setUpTourLauncher() {
		const launcher = pick('[data-tt-tour-hero]', document);
		const tourCard = document.getElementById('tt-tour-card');
		const scope = tourCard?.querySelector('[data-basalt-tour]');
		if (!launcher || !scope) return;

		launcher.addEventListener('click', () => {
			const showAll = pick('[data-tt-filter="all"]');
			if (tourCard.classList.contains('is-hidden') && showAll) showAll.click();
			const still = motionQuery.matches;
			tourCard.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' });
			setTimeout(() => scope.basaltTourStart(), still ? 0 : 450);
		});

		/* The sample status chips act as one single-choice group. */
		const statusChips = pickAll('.tt-mini-chip', scope);
		for (const chipButton of statusChips) {
			chipButton.addEventListener('click', () => {
				for (const each of statusChips) each.setAttribute('aria-pressed', String(each === chipButton));
			});
		}
	}

	/* Confirm popover: order lines come off after a confirm, with undo. */

	function setUpOrderLines() {
		const orderDemo = pick('[data-tt-cart]');
		if (!orderDemo) return;
		const [lineList, emptyNote, undoStrip, undoMessage, undoButton, orderTotal, emptyButton] = [
			'lines',
			'empty',
			'undo',
			'undo-text',
			'undo-btn',
			'total',
			'clear',
		].map((hook) => pick(`[data-tt-${hook}]`, orderDemo));
		/* The line taken off most recently, and the line it sat before. */
		let lastTaken = null;

		function recount() {
			const dollars = pickAll('[data-tt-line]', lineList).reduce(
				(running, line) => running + Number(pick('[data-tt-price]', line).getAttribute('data-tt-price')),
				0,
			);
			orderTotal.textContent = `$${dollars.toFixed(2)}`;
			const isEmpty = !lineList.children.length;
			emptyNote.hidden = !isEmpty;
			lineList.hidden = isEmpty;
			emptyButton.disabled = isEmpty;
		}

		function takeOff(line, afterwards) {
			function finish() {
				line.remove();
				recount();
				afterwards?.();
			}
			line.classList.add('is-leaving');
			if (motionQuery.matches) finish();
			else setTimeout(finish, FADE_MS);
		}

		lineList.addEventListener('basalt:confirm', (event) => {
			const line = event.target.closest('[data-tt-line]');
			if (!line) return;
			lastTaken = { line, before: line.nextElementSibling };
			takeOff(line, () => {
				undoMessage.textContent = `${pick('.tt-line-name', line).textContent} removed.`;
				undoStrip.hidden = false;
				undoButton.focus();
			});
		});

		undoButton.addEventListener('click', () => {
			if (!lastTaken) return;
			const { line, before } = lastTaken;
			line.classList.remove('is-leaving');
			if (before?.parentNode === lineList) lineList.insertBefore(line, before);
			else lineList.append(line);
			lastTaken = null;
			undoStrip.hidden = true;
			recount();
			pick('[data-basalt-popconfirm]', line)?.focus();
		});

		emptyButton.addEventListener('basalt:confirm', () => {
			for (const line of pickAll('[data-tt-line]', lineList)) line.remove();
			lastTaken = null;
			undoStrip.hidden = true;
			recount();
			emptyNote.setAttribute('tabindex', '-1');
			emptyNote.focus();
		});
	}

	/* Edit-in-place: a saved value is written back beside its pencil and
     announced in the note under the table. */

	function setUpEditInPlace() {
		const note = pick('[data-tt-edit-status]');
		demoPage.addEventListener('basalt:edit', (event) => {
			const pencil = event.target;
			const key = pencil.getAttribute('data-tt-edit');
			const valueCell = key && pick(`[data-tt-edit-out="${key}"]`);
			if (!valueCell) return;
			const before = pencil.getAttribute('data-basalt-edit-prefix') || '';
			const unit = pencil.getAttribute('data-basalt-edit-suffix') || '';
			valueCell.textContent = `${before}${event.detail.value}${unit ? ` ${unit}` : ''}`;
			valueCell.classList.add('is-saved');
			setTimeout(() => valueCell.classList.remove('is-saved'), 1400);
			if (note)
				note.textContent = `Saved: ${pencil.getAttribute('aria-label').replace(/^Edit /, '')} is now ${valueCell.textContent}.`;
		});
	}

	/* Shortcut toolbar: bold, italic and underline toggle on the sample note. */

	function setUpFormatToolbar() {
		const toolbar = pick('[data-tt-toolbar]');
		const note = document.getElementById('tt-editor');
		if (!toolbar || !note) return;
		for (const button of pickAll('[data-tt-fmt]', toolbar)) {
			button.addEventListener('click', () => {
				const pressed = button.getAttribute('aria-pressed') !== 'true';
				button.setAttribute('aria-pressed', String(pressed));
				note.classList.toggle(button.getAttribute('data-tt-fmt'), pressed);
			});
		}
	}

	/* Overflow tooltip: the slider sets the column width, and the note under
     the table says how many names are cut off at that width. */

	function setUpColumnSlider() {
		const widthSlider = pick('[data-tt-col]');
		const truncTable = pick('[data-tt-trunc]');
		if (!widthSlider || !truncTable) return;
		const readout = pick('[data-tt-col-out]');
		const summary = pick('[data-tt-trunc-count]');
		const nameLabels = pickAll('[data-basalt-truncate-tip]', truncTable);

		function describe() {
			if (!summary) return;
			const clipped = nameLabels.filter((label) => label.classList.contains('is-truncated')).length;
			summary.textContent = clipped
				? `${clipped} of ${nameLabels.length} ${clipped === 1 ? 'name is' : 'names are'} cut off. Hover or tab to one to read it.`
				: 'Every name fits, so none of them has a tooltip.';
		}

		/* Many labels report at once while the column moves; describe once a frame. */
		let pendingFrame = 0;
		truncTable.addEventListener('basalt:truncate', () => {
			cancelAnimationFrame(pendingFrame);
			pendingFrame = requestAnimationFrame(describe);
		});
		widthSlider.addEventListener('input', () => {
			truncTable.style.setProperty('--tt-col', `${widthSlider.value}px`);
			if (readout) readout.textContent = `${widthSlider.value} px`;
		});
		describe();
	}

	/* Tooltip tones: the switch keeps every tone's tooltip open at once. */

	function setUpPinnedTones() {
		const toneBox = pick('[data-tt-tones]');
		const pinSwitch = pick('[data-tt-pin]');
		if (!toneBox || !pinSwitch) return;
		const triggers = pickAll('[data-bs-toggle="tooltip"]', toneBox);

		/* Each tooltip is rebuilt inside the card, so pinned ones scroll with it. */
		function pinAll(pinned) {
			for (const trigger of triggers) {
				BsTooltip.getInstance(trigger)?.dispose();
				const tip = new BsTooltip(trigger, { container: toneBox, trigger: pinned ? 'manual' : 'hover focus' });
				trigger.toggleAttribute('data-tt-pinned', pinned);
				if (pinned) tip.show();
			}
		}

		pinSwitch.addEventListener('change', () => pinAll(pinSwitch.checked));
		pinAll(pinSwitch.checked);
	}

	start();
})();
