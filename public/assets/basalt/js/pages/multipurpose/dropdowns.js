/**
 * Dropdowns demo page (dropdowns.html). Wires the filter chipList over
 * the card cardGrid, the copy button under each codeBlock and the one-line
 * logs beneath the demos. The menu widgets themselves (command menu,
 * searchable list, multi-select, submenus, context menu, confirm item,
 * typeahead) are built by basalt.js; this file only reacts to them.
 */
(() => {
	'use strict';

	const demoRoot = pick('[data-dd-root]', document);
	if (!demoRoot || !window.bootstrap) return;

	const COPIED_FOR_MS = 1800;
	const DISCOUNT_CODE = 'VANKIT-15';
	const VISITS_IN_TOTAL = 124;
	const VISITS_BY_TYPE = { repair: 64, maintenance: 38, install: 22 };

	/**
	 * Wires every demo on the page. Each piece checks for its own markup,
	 * so a card can be removed from the page without touching this file.
	 */
	function start() {
		wireFilterChips();
		wireCopyButtons();
		wireCommandMenu();
		wirePackerPicker();
		wireFilterPanel();
		wireSubmenu();
		wireContextMenu();
		wireRichItems();
		wireConfirmItem();
		wireDiscountForm();
	}

	function pick(selector, scope = demoRoot) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = demoRoot) {
		return [...scope.querySelectorAll(selector)];
	}

	function scrollMode() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
	}

	function isTypingIn(node) {
		return node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName);
	}

	/* The chips show one kind of dropdown at a time. Cards pair up two to
     a row on wide screens, so an odd card at the end of a run, or right
     before a full-width card, is widened to fill its row. */
	function wireFilterChips() {
		const cardGrid = pick('[data-dd-grid]');
		const countLine = pick('[data-dd-count]');
		if (!cardGrid) return;
		const cardList = pickAll('.dd-card', cardGrid);
		const chipList = pickAll('[data-dd-filter]');

		function showKind(kind) {
			const kept = cardList.filter((card) => {
				const kinds = (card.getAttribute('data-dd-groups') ?? '').split(/\s+/);
				const stays = kind === 'all' || kinds.includes(kind);
				card.classList.toggle('is-hidden', !stays);
				card.classList.remove('is-alone');
				return stays;
			});
			widenOddCards(kept);
			if (countLine) countLine.textContent = `${kept.length} dropdown type${kept.length === 1 ? '' : 's'}`;
		}

		for (const filterChip of chipList) {
			filterChip.addEventListener('click', () => {
				for (const sibling of chipList) sibling.setAttribute('aria-pressed', String(sibling === filterChip));
				showKind(filterChip.getAttribute('data-dd-filter'));
			});
		}

		showKind('all');
	}

	function widenOddCards(cardList) {
		let inRun = 0;
		let lastInRun = null;

		function endRun() {
			if (inRun % 2 === 1) lastInRun.classList.add('is-alone');
			inRun = 0;
		}

		for (const card of cardList) {
			if (card.classList.contains('dd-card-full')) {
				endRun();
				continue;
			}
			inRun += 1;
			lastInRun = card;
		}

		endRun();
	}

	/* Each snippet's button copies the <pre> beside it and says so for a
     moment. */
	function wireCopyButtons() {
		for (const button of pickAll('[data-dd-copy]')) {
			button.addEventListener('click', () => {
				const codeBlock = pick('pre', button.parentElement);
				if (!codeBlock) return;
				window.Basalt.copyText(codeBlock.textContent.trim()).then(() => confirmCopy(button));
			});
		}
	}

	function confirmCopy(button) {
		const glyph = pick('.bi', button);
		relabelCopy(button, glyph, ' Copied', 'bi bi-check2');
		clearTimeout(button._ddCopyReset);
		button._ddCopyReset = setTimeout(() => relabelCopy(button, glyph, ' Copy', 'bi bi-clipboard'), COPIED_FOR_MS);
	}

	function relabelCopy(button, glyph, text, glyphClass) {
		button.lastChild.textContent = text;
		if (glyph) glyph.className = glyphClass;
	}

	/* The command menu lives in a dropdown on the card and inline beside
     it. The page header button and the "/" key open the dropdown one;
     the "try" chips type into the inline one. */
	function wireCommandMenu() {
		const log = pick('[data-dd-command-log]');
		const inlineMenu = pick('.basalt-command-inline');
		const launcher = pick('[data-dd-command-toggle]');

		demoRoot.addEventListener('basalt:command', ({ detail }) => {
			if (log) log.textContent = `You chose: ${detail.value}.`;
		});

		for (const tryChip of pickAll('[data-dd-try]')) {
			tryChip.addEventListener('click', () => {
				const textField = pick('.basalt-command-input', inlineMenu);
				textField.value = tryChip.getAttribute('data-dd-try');
				textField.dispatchEvent(new Event('input', { bubbles: true }));
				textField.focus();
			});
		}

		function reveal() {
			if (!launcher) return;
			launcher.closest('.dd-card').scrollIntoView({ block: 'center', behavior: scrollMode() });
			bootstrap.Dropdown.getOrCreateInstance(launcher).show();
		}

		pick('[data-dd-open-command]', document)?.addEventListener('click', reveal);
		document.addEventListener('keydown', (event) => {
			if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
			if (isTypingIn(event.target)) return;
			event.preventDefault();
			reveal();
		});
	}

	/* Picking a teammate from the searchable menu puts their name and
     initials on the button. */
	function wirePackerPicker() {
		const packerMenu = pick('[data-dd-assign]');
		if (!packerMenu) return;
		const nameSlot = pick('[data-dd-assign-name]', packerMenu);
		const avatarSlot = pick('[data-dd-assign-avatar]', packerMenu);
		const log = pick('[data-dd-assign-log]');

		packerMenu.addEventListener('basalt:pick', ({ detail }) => {
			nameSlot.textContent = detail.value;
			avatarSlot.className = `basalt-dd-avatar basalt-dd-avatar-${detail.item.getAttribute('data-tone')}`;
			avatarSlot.textContent = detail.item.getAttribute('data-initials');
			if (log) log.textContent = `Order #3086 will be packed by ${detail.value}.`;
		});
	}

	/* The filter panel is a form in a menu. Its choices are remembered
     when it opens and put back if it closes without Apply. */
	function wireFilterPanel() {
		const filterHolder = pick('[data-dd-fpanel]');
		if (!filterHolder) return;
		const filterForm = pick('[data-dd-filter-form]', filterHolder);
		const opener = pick('[data-bs-toggle="dropdown"]', filterHolder);
		const badge = pick('[data-dd-filter-count]', filterHolder);
		const totalSlot = pick('[data-dd-filter-total]', filterHolder);
		const log = pick('[data-dd-filter-log]');
		let remembered = null;
		let applied = false;

		function choices() {
			return {
				types: pickAll('input[name="type"]', filterForm)
					.filter((box) => box.checked)
					.map((box) => box.value),
				unassigned: filterForm.elements.unassigned.checked,
				min: filterForm.elements.min.value,
				max: filterForm.elements.max.value,
			};
		}

		function putBack(chosen) {
			for (const box of pickAll('input[name="type"]', filterForm)) box.checked = chosen.types.includes(box.value);
			filterForm.elements.unassigned.checked = chosen.unassigned;
			filterForm.elements.min.value = chosen.min;
			filterForm.elements.max.value = chosen.max;
		}

		function showTotal() {
			totalSlot.textContent = `${visitsMatching(choices())}`;
		}

		function closePanel() {
			bootstrap.Dropdown.getOrCreateInstance(opener).hide();
			opener.focus();
		}

		filterForm.addEventListener('input', showTotal);
		filterForm.addEventListener('change', showTotal);
		opener.addEventListener('show.bs.dropdown', () => {
			remembered = choices();
			applied = false;
			showTotal();
		});
		opener.addEventListener('shown.bs.dropdown', () => pick('input', filterForm)?.focus());
		opener.addEventListener('hide.bs.dropdown', () => {
			if (!applied && remembered) putBack(remembered);
		});
		pick('[data-dd-filter-reset]', filterForm).addEventListener('click', () => {
			putBack({ types: [], unassigned: false, min: '', max: '' });
			showTotal();
		});
		pick('[data-dd-filter-cancel]', filterForm).addEventListener('click', closePanel);
		filterForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const chosen = choices();
			const active = activeFilters(chosen);
			applied = true;
			badge.textContent = active;
			badge.hidden = !active;
			opener.setAttribute('aria-label', `Filters, ${active ? `${active} on` : 'none on'}`);
			if (log)
				log.textContent = active
					? `Showing ${visitsMatching(chosen)} visits: ${describeFilters(chosen).join(', ')}.`
					: `Showing all ${VISITS_IN_TOTAL} visits.`;
			closePanel();
		});
	}

	/* A made-up but steady count, so the Apply button answers every
     change. */
	function visitsMatching(chosen) {
		let visits = chosen.types.length
			? chosen.types.reduce((sum, type) => sum + VISITS_BY_TYPE[type], 0)
			: VISITS_IN_TOTAL;
		if (chosen.unassigned) visits = Math.round(visits * 0.22);
		const floor = parseFloat(chosen.min) || 0;
		const ceiling = parseFloat(chosen.max) || 0;
		if (floor) visits = Math.round(visits * Math.max(0.1, 1 - floor / 1500));
		if (ceiling) visits = Math.round(visits * Math.min(1, Math.max(0.1, ceiling / 900)));
		return visits;
	}

	function activeFilters(chosen) {
		return chosen.types.length + (chosen.unassigned ? 1 : 0) + (chosen.min || chosen.max ? 1 : 0);
	}

	function describeFilters(chosen) {
		const phrases = [];
		if (chosen.types.length) phrases.push(chosen.types.join(' and '));
		if (chosen.unassigned) phrases.push('unassigned');
		if (chosen.min || chosen.max)
			phrases.push(`$${chosen.min || '0'} to ${chosen.max ? `$${chosen.max}` : 'any value'}`);
		return phrases;
	}

	/* A pick in the nested menu is logged and closes the whole thing. */
	function wireSubmenu() {
		const submenuRoot = pick('[data-dd-sub-root]');
		const log = pick('[data-dd-sub-log]');
		if (!submenuRoot) return;
		const opener = pick('[data-bs-toggle="dropdown"]', submenuRoot);

		for (const choice of pickAll('[data-dd-sub-pick]', submenuRoot)) {
			choice.addEventListener('click', () => {
				if (log) log.textContent = `${choice.getAttribute('data-dd-sub-pick')}.`;
				bootstrap.Dropdown.getOrCreateInstance(opener).hide();
				opener.focus();
			});
		}
	}

	/* The context menu tells us which row was right-clicked. */
	function wireContextMenu() {
		const menu = document.getElementById('dd-ctx-menu');
		const log = pick('[data-dd-ctx-log]');
		if (!menu) return;

		menu.addEventListener('basalt:pick', ({ detail }) => {
			const row = detail.target;
			if (log && row)
				log.textContent = `${detail.item.getAttribute('data-dd-ctx')} order ${row.getAttribute('data-dd-order')}.`;
		});
	}

	function wireRichItems() {
		const log = pick('[data-dd-rich-log]');

		for (const choice of pickAll('[data-dd-rich]')) {
			choice.addEventListener('click', () => {
				if (log) log.textContent = `New ${choice.getAttribute('data-dd-rich').toLowerCase()} started.`;
			});
		}
	}

	function wireConfirmItem() {
		const deleter = pick('[data-dd-delete]');
		const log = pick('[data-dd-delete-log]');
		if (!deleter) return;

		deleter.addEventListener('basalt:confirm', () => {
			if (log) log.textContent = 'Bar Loafers deleted. It is in the bin for 30 days.';
		});
	}

	/* The discount form knows one code; anything else is turned down. */
	function wireDiscountForm() {
		const discountForm = pick('[data-dd-discount]');
		if (!discountForm) return;
		const note = pick('[data-dd-discount-msg]', discountForm);
		const textField = pick('input', discountForm);

		discountForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const typedCode = textField.value.trim().toUpperCase();
			const accepted = typedCode === DISCOUNT_CODE;
			note.classList.toggle('is-good', accepted);
			note.textContent = verdictFor(typedCode);
			textField.setAttribute('aria-invalid', String(Boolean(typedCode) && !accepted));
		});
	}

	function verdictFor(typedCode) {
		if (!typedCode) return 'Type a code first.';
		if (typedCode === DISCOUNT_CODE) return '15% off applied to this order.';
		return `"${typedCode}" isn't a code we know. Try ${DISCOUNT_CODE}.`;
	}

	start();
})();
