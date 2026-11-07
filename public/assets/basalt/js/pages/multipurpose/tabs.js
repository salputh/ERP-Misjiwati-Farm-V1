/**
 * Drives the demos on tabs.html: the group chips that narrow the card
 * grid, the snippet copy buttons, the underline/pill switch, the segmented
 * range and layout pickers, the width slider and the closable order tabs.
 * The tab component itself (window.Basalt.tabs) is defined in basalt.js.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-tb-root]', document);
	if (!pageRoot || !window.bootstrap) return;

	/* Figures for the segmented range picker: revenue, orders, average order. */
	const RANGE_FIGURES = {
		day: ['$6,940', '14', '$495.71'],
		week: ['$41,380', '83', '$498.55'],
		month: ['$172,600', '362', '$476.80'],
		year: ['$1,904,200', '4,118', '$462.41'],
	};

	/* Orders the "new tab" button cycles through on the closable demo. */
	const SAMPLE_ORDERS = [
		{ id: '1051', buyer: 'Iva Blackwood', items: '3 × Two-Tone Oxfords', total: '$2,566.00' },
		{ id: '1052', buyer: 'Natalie Tanner', items: 'a pair of Cat-Eye Sunglasses', total: '$481.00' },
		{ id: '1053', buyer: 'Sabrina Kavanagh', items: '2 × Draped Column Gown', total: '$4,316.00' },
		{ id: '1054', buyer: 'Georgia Webster', items: 'a Leather Trench Coat', total: '$3,216.00' },
	];

	const COPY_RESET_MS = 1800;
	const copyResets = new WeakMap();

	function start() {
		wireGroupChips();
		wireSnippetCopy();
		wireIndicatorStyle();
		wireSegmentedPickers();
		wirePreviewWidth();
		wireClosableTabs();
	}

	/* Small lookups, always scoped to the demo page unless told otherwise. */
	function pick(selector, scope = pageRoot) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = pageRoot) {
		return [...scope.querySelectorAll(selector)];
	}

	function countLabel(total, singular, plural) {
		return `${total} ${total === 1 ? singular : plural}`;
	}

	/* Group chips: pressing one shows only the cards of that group. */
	function wireGroupChips() {
		const board = pick('[data-tb-grid]');
		if (!board) return;
		const tally = pick('[data-tb-count]');
		const tiles = pickAll('.tb-card', board);
		const chips = pickAll('[data-tb-filter]');

		function showGroup(wanted) {
			const visible = tiles.filter((tile) => {
				const match = wanted === 'all' || tile.getAttribute('data-tb-group') === wanted;
				tile.classList.toggle('is-hidden', !match);
				tile.classList.remove('is-alone');
				return match;
			});
			markLoneHalves(visible);
			if (tally) tally.textContent = countLabel(visible.length, 'tab type', 'tab types');
		}

		for (const chip of chips) {
			chip.addEventListener('click', () => {
				for (const other of chips) other.setAttribute('aria-pressed', String(other === chip));
				showGroup(chip.getAttribute('data-tb-filter'));
			});
		}

		showGroup('all');
	}

	/**
	 * Half-width cards sit two to a row between the full-width ones. When a
	 * stretch of them has an odd count, its last card spans the whole row.
	 */
	function markLoneHalves(visible) {
		let stretch = [];
		function settle() {
			if (stretch.length % 2 === 1) stretch.at(-1).classList.add('is-alone');
			stretch = [];
		}
		for (const tile of visible) {
			if (tile.classList.contains('tb-card-full')) settle();
			else stretch.push(tile);
		}
		settle();
	}

	/* Copy buttons put the neighboring snippet on the clipboard and confirm. */
	function wireSnippetCopy() {
		for (const button of pickAll('[data-tb-copy]')) {
			button.addEventListener('click', () => {
				const snippet = pick('pre', button.parentElement);
				if (!snippet) return;
				window.Basalt.copyText(snippet.textContent.trim()).then(() => confirmCopied(button));
			});
		}
	}

	function confirmCopied(button) {
		const glyph = pick('.bi', button);
		function setState(word, glyphClass) {
			button.lastChild.textContent = ` ${word}`;
			if (glyph) glyph.className = glyphClass;
		}
		setState('Copied', 'bi bi-check2');
		clearTimeout(copyResets.get(button));
		copyResets.set(
			button,
			setTimeout(() => setState('Copy', 'bi bi-clipboard'), COPY_RESET_MS),
		);
	}

	/* The indicator radios switch the sliding marker between underline and pill. */
	function wireIndicatorStyle() {
		const strip = pick('[data-tb-style-target]');
		if (!strip) return;
		const classEcho = pick('[data-tb-style-class]');

		for (const option of pickAll('input[name="tb-style"]')) {
			option.addEventListener('change', () => {
				if (!option.checked) return;
				const asPill = option.value === 'pill';
				strip.classList.toggle('basalt-tabs-pill', asPill);
				if (classEcho) classEcho.textContent = asPill ? ' basalt-tabs-pill' : '';
				strip.basaltTabs?.refresh();
			});
		}
	}

	/* Segmented controls: one swaps the range figures, the other the product layout. */
	function wireSegmentedPickers() {
		const slots = pickAll('[data-tb-fig]');
		for (const option of pickAll('input[name="tb-range"]')) {
			option.addEventListener('change', () => {
				if (!option.checked) return;
				for (const [position, figure] of RANGE_FIGURES[option.value].entries()) {
					if (slots[position]) slots[position].textContent = figure;
				}
			});
		}

		const catalog = pick('[data-tb-products]');
		for (const option of pickAll('input[name="tb-view"]')) {
			option.addEventListener('change', () => {
				if (option.checked && catalog) catalog.classList.toggle('tb-products-list', option.value === 'list');
			});
		}
	}

	/* The width slider narrows the overflow preview so its tabs start to scroll. */
	function wirePreviewWidth() {
		const slider = pick('[data-tb-width]');
		const preview = pick('[data-tb-frame]');
		if (!slider || !preview) return;
		const readout = pick('[data-tb-width-out]');

		function resize() {
			const percent = `${slider.value}%`;
			preview.style.maxWidth = percent;
			if (readout) readout.textContent = percent;
		}
		slider.addEventListener('input', resize);
		resize();
	}

	/* Closable tabs: open sample orders, close them, bring the last one back. */
	function wireClosableTabs() {
		const host = pick('[data-tb-closable]');
		if (!host || !window.Basalt.tabs) return;
		const tabs = window.Basalt.tabs(host);
		const panelHost = pick('[data-tb-closable-panels]');
		const liveRegion = pick('[data-tb-closable-status]');
		const restoreButton = pick('[data-tb-reopen]');
		let opened = 0;

		function syncRestore() {
			restoreButton.disabled = tabs.closed() === 0;
		}

		function announce(message) {
			liveRegion.textContent = message;
		}

		pick('[data-tb-add]', host).addEventListener('click', () => {
			const order = SAMPLE_ORDERS[opened % SAMPLE_ORDERS.length];
			opened += 1;
			tabs.add({
				label: `Order #${order.id}`,
				panels: panelHost,
				html: `<p class="tb-text"><strong>${order.buyer}</strong> ordered ${order.items} for <strong>${order.total}</strong>. Paid by card, waiting to be packed.</p>`,
			});
		});

		restoreButton.addEventListener('click', () => {
			tabs.reopen();
			syncRestore();
		});

		host.addEventListener('basalt:tabclose', ({ detail }) => {
			announce(`Closed ${detail.label}`);
			syncRestore();
		});
		host.addEventListener('basalt:tabadd', ({ detail }) => announce(`Opened ${detail.label}`));
		host.addEventListener('basalt:tabreopen', ({ detail }) => announce(`Reopened ${detail.label}`));

		syncRestore();
	}

	start();
})();
