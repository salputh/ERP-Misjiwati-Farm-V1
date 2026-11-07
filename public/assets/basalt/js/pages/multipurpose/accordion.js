/**
 * Accordion showcase, used by accordion.html.
 * Bootstrap's collapse plugin does the opening and closing. What this file
 * adds is everything the page layers on top: the family chips, the copy
 * buttons under each snippet, the searchable FAQ, expand and collapse all,
 * the stepped form, the panels that load on first open, the indicator and
 * size switches, the sideways row and the hero button that opens the lot.
 * Nothing here needs a library beyond Bootstrap itself.
 */
(() => {
	'use strict';

	const stage = pick('[data-ac-root]', document);
	if (!stage || !window.bootstrap) return;

	const COPIED_RESET_MS = 1800;
	const LAZY_DELAY_MS = 900;
	const wideScreen = window.matchMedia('(min-width: 768px)');
	const copyTimers = new WeakMap();
	/* Demos that need a word after the hero button flips every panel at once. */
	const afterOpenAll = [];

	function start() {
		mountFamilyChips();
		mountCopyButtons();
		mountFaq();
		mountExpandAll();
		mountSteps();
		mountLazyPanels();
		mountClassSwitch('ac-ind', '[data-ac-ind-target]', '[data-ac-ind-class]');
		mountClassSwitch('ac-size', '[data-ac-size-target]', '[data-ac-size-class]');
		mountSidewaysRow();
		mountHeroToggle();
	}

	/* Small shared helpers. */

	function pick(selector, scope = stage) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = stage) {
		return [...scope.querySelectorAll(selector)];
	}

	function tally(n, single, several) {
		return `${n} ${n === 1 ? single : several}`;
	}

	function capitalize(text) {
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	function collapseApi(panel) {
		return bootstrap.Collapse.getOrCreateInstance(panel, { toggle: false });
	}

	function headerButton(panel) {
		return pick(`[data-bs-target="#${panel.id}"]`);
	}

	/**
	 * Puts a panel straight into its open or shut state, the same classes and
	 * attributes Bootstrap leaves behind after animating, with no animation.
	 * Useful when many panels have to change together.
	 */
	function forceState(panel, opened) {
		const header = headerButton(panel);
		panel.classList.toggle('show', opened);
		if (!header) return;
		header.classList.toggle('collapsed', !opened);
		header.setAttribute('aria-expanded', String(opened));
	}

	/* Family chips above the grid. */

	function mountFamilyChips() {
		const grid = pick('[data-ac-grid]');
		if (!grid) return;
		const counter = pick('[data-ac-count]');
		const cards = pickAll('.ac-card', grid);
		const chips = pickAll('[data-ac-filter]');

		function showFamily(family) {
			const kept = cards.filter((card) => {
				const families = (card.getAttribute('data-ac-groups') || '').split(/\s+/);
				const belongs = family === 'all' || families.includes(family);
				card.classList.toggle('is-hidden', !belongs);
				card.classList.remove('is-alone');
				return belongs;
			});
			markOddOnes(kept);
			if (counter) counter.textContent = tally(kept.length, 'accordion type', 'accordion types');
		}

		for (const choice of chips) {
			choice.addEventListener('click', () => {
				for (const other of chips) other.setAttribute('aria-pressed', String(other === choice));
				showFamily(choice.getAttribute('data-ac-filter'));
			});
		}

		showFamily('all');
	}

	/**
	 * Half-width cards sit in pairs between the full-width ones. When a run of
	 * halves has an odd count, its last card stretches across the row.
	 */
	function markOddOnes(cards) {
		const runs = [[]];

		for (const card of cards) {
			if (card.classList.contains('ac-card-full')) runs.push([]);
			else runs.at(-1).push(card);
		}

		for (const run of runs) {
			if (run.length % 2) run.at(-1).classList.add('is-alone');
		}
	}

	/* Copy buttons on the snippets. */

	function mountCopyButtons() {
		for (const button of pickAll('[data-ac-copy]')) {
			button.addEventListener('click', () => copySnippet(button));
		}
	}

	function copySnippet(button) {
		const snippet = pick('pre', button.parentElement);
		if (!snippet) return;
		window.Basalt.copyText(snippet.textContent.trim()).then(() => {
			showCopied(button, true);
			clearTimeout(copyTimers.get(button));
			copyTimers.set(
				button,
				setTimeout(() => showCopied(button, false), COPIED_RESET_MS),
			);
		});
	}

	function showCopied(button, justCopied) {
		const glyph = pick('.bi', button);
		button.lastChild.textContent = justCopied ? ' Copied' : ' Copy';
		if (glyph) glyph.className = justCopied ? 'bi bi-check2' : 'bi bi-clipboard';
	}

	/* The FAQ with a search box. */

	function mountFaq() {
		const faq = pick('[data-ac-faq]');
		if (!faq) return;
		const field = pick('[data-ac-faq-input]', faq);
		const counter = pick('[data-ac-faq-count]', faq);
		const nothing = pick('[data-ac-faq-empty]', faq);
		const echo = pick('[data-ac-faq-term]', faq);
		/* Each entry remembers its untouched markup and whether it began open,
       so clearing the box can put everything back. */
		const entries = pickAll('[data-ac-faq-item]', faq).map((item) => {
			const panel = pick('.accordion-collapse', item);
			return {
				item,
				panel,
				beganOpen: panel.classList.contains('show'),
				copy: pickAll('[data-ac-hl]', item).map((node) => [node, node.innerHTML]),
			};
		});

		function search() {
			const typed = field.value.trim();
			const words = typed.toLowerCase().split(/\s+/).filter(Boolean);
			const kept = [];

			for (const entry of entries) {
				for (const [node, html] of entry.copy) node.innerHTML = html;
				const haystack = entry.item.textContent.trim().toLowerCase();
				const matches = !words.length || words.every((word) => haystack.includes(word));
				entry.item.hidden = !matches;
				if (matches) kept.push(entry.item);
				if (matches && words.length) {
					for (const [node] of entry.copy) highlight(node, words);
				}
				forceState(entry.panel, words.length ? matches : entry.beganOpen);
			}

			markEnds(kept);
			nothing.hidden = kept.length > 0;
			if (echo) echo.textContent = typed;
			counter.textContent = words.length
				? `${kept.length} of ${entries.length} match`
				: tally(entries.length, 'question', 'questions');
		}

		function searchFor(text) {
			field.value = text;
			search();
			field.focus();
		}

		function markEnds(visible) {
			for (const entry of entries) entry.item.classList.remove('is-first', 'is-last');
			if (!visible.length) return;
			visible[0].classList.add('is-first');
			visible.at(-1).classList.add('is-last');
		}

		field.addEventListener('input', search);
		field.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && field.value) searchFor('');
		});

		for (const suggestion of pickAll('[data-ac-try]', faq)) {
			suggestion.addEventListener('click', () => searchFor(suggestion.getAttribute('data-ac-try')));
		}

		pick('[data-ac-faq-clear]', faq).addEventListener('click', () => searchFor(''));
		markEnds(entries.map((entry) => entry.item));
	}

	/**
	 * Wraps every case-insensitive hit for the words inside a node in <mark>,
	 * leaving the surrounding text nodes as they were.
	 */
	function highlight(node, words) {
		const pattern = new RegExp(
			`(${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
			'gi',
		);
		const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
		const textNodes = [];
		while (walker.nextNode()) textNodes.push(walker.currentNode);

		for (const textNode of textNodes) {
			const pieces = textNode.nodeValue.split(pattern);
			if (pieces.length < 2) continue;
			const replacement = document.createDocumentFragment();

			for (const [index, piece] of pieces.entries()) {
				if (!piece) continue;
				if (index % 2 === 0) {
					replacement.append(piece);
					continue;
				}
				const hit = document.createElement('mark');
				hit.textContent = piece;
				replacement.append(hit);
			}

			textNode.replaceWith(replacement);
		}
	}

	/* Expand all and collapse all from outside the accordion. */

	function mountExpandAll() {
		const block = pick('[data-ac-controlled]');
		if (!block) return;
		const panels = pickAll('.accordion-collapse', block);
		const readout = pick('[data-ac-ctl-status]', block);
		const buttons = {
			show: pick('[data-ac-ctl="show"]', block),
			hide: pick('[data-ac-ctl="hide"]', block),
		};

		function isOpenOrOpening(panel) {
			return panel.classList.contains('show') || headerButton(panel).getAttribute('aria-expanded') === 'true';
		}

		function refresh() {
			const openCount = panels.filter(isOpenOrOpening).length;
			readout.textContent = `${openCount} of ${panels.length} open`;
			buttons.show.disabled = openCount === panels.length;
			buttons.hide.disabled = openCount === 0;
		}

		for (const [method, button] of Object.entries(buttons)) {
			button.addEventListener('click', () => {
				for (const panel of panels) collapseApi(panel)[method]();
				refresh();
			});
		}

		block.addEventListener('shown.bs.collapse', refresh);
		block.addEventListener('hidden.bs.collapse', refresh);
		afterOpenAll.push(refresh);
		refresh();
	}

	/* The stepped order form. */

	function mountSteps() {
		const block = pick('[data-ac-stepped]');
		if (!block) return;
		const steps = pickAll('[data-ac-step]', block);
		const outcome = pick('[data-ac-step-done]', block);

		function choiceIn(step) {
			const picked = pick('input[type="radio"]:checked', step);
			return picked ? picked.value : (pick('select', step)?.value ?? '');
		}

		function advance(index) {
			const step = steps[index];
			const following = steps[index + 1];
			step.classList.add('is-done');
			pick('[data-ac-step-sum]', step).textContent = capitalize(choiceIn(step));
			if (!following) {
				collapseApi(pick('.accordion-collapse', step)).hide();
				announce();
				return;
			}
			const header = pick('.accordion-button', following);
			header.disabled = false;
			collapseApi(pick('.accordion-collapse', following)).show();
			header.focus();
		}

		function announce() {
			const [piece, extra, speed] = steps.map(choiceIn);
			const tick = document.createElement('i');
			const restart = document.createElement('button');
			tick.className = 'bi bi-check2-circle';
			tick.setAttribute('aria-hidden', 'true');
			restart.type = 'button';
			restart.className = 'btn btn-sm btn-outline-secondary';
			restart.textContent = 'Start over';
			restart.addEventListener('click', startOver);
			outcome.replaceChildren(tick, `Order set: ${piece}, ${extra}, delivered ${speed}.`, restart);
		}

		function startOver() {
			outcome.replaceChildren();

			for (const [index, step] of steps.entries()) {
				step.classList.remove('is-done');
				pick('[data-ac-step-sum]', step).textContent = 'Not chosen yet';
				pick('.accordion-button', step).disabled = index > 0;
			}

			collapseApi(pick('.accordion-collapse', steps[0])).show();
			pick('.accordion-button', steps[0]).focus();
		}

		for (const [index, step] of steps.entries()) {
			pick('[data-ac-step-next]', step).addEventListener('click', () => advance(index));
		}
	}

	/* Panels that fetch their content the first time they open. */

	function mountLazyPanels() {
		const block = pick('[data-ac-lazy]');
		if (!block) return;
		const panels = pickAll('[data-ac-lazy-src]', block);
		const counter = pick('[data-ac-lazy-count]', block);
		const pending = new Map();

		function stateWord(panel) {
			return pick('[data-ac-lazy-state]', headerButton(panel));
		}

		function tell() {
			const ready = panels.filter((panel) => panel.dataset.loaded === 'true').length;
			counter.textContent = `${ready} of ${panels.length} loaded`;
		}

		function fetchInto(panel) {
			if (panel.dataset.loaded) return;
			const body = pick('[data-ac-lazy-body]', panel);
			panel.dataset.loaded = 'loading';
			body.setAttribute('aria-busy', 'true');
			body.innerHTML =
				'<div class="ac-skel"><span></span><span></span><span></span></div><span class="visually-hidden">Loading</span>';
			stateWord(panel).textContent = 'Loading';
			pending.set(
				panel,
				setTimeout(() => {
					const source = pick(`[data-ac-lazy-tpl="${panel.dataset.acLazySrc}"]`, block);
					body.replaceChildren(source.content.cloneNode(true));
					body.removeAttribute('aria-busy');
					panel.dataset.loaded = 'true';
					stateWord(panel).textContent = 'Loaded';
					tell();
				}, LAZY_DELAY_MS),
			);
		}

		function forget(panel) {
			const body = pick('[data-ac-lazy-body]', panel);
			clearTimeout(pending.get(panel));
			collapseApi(panel).hide();
			delete panel.dataset.loaded;
			body.replaceChildren();
			body.removeAttribute('aria-busy');
			stateWord(panel).textContent = 'Not loaded';
		}

		for (const panel of panels) {
			panel.addEventListener('show.bs.collapse', (event) => {
				if (event.target === panel) fetchInto(panel);
			});
		}

		pick('[data-ac-lazy-reset]', block).addEventListener('click', () => {
			for (const panel of panels) forget(panel);
			tell();
		});

		afterOpenAll.push(() => {
			for (const panel of panels) {
				if (panel.classList.contains('show')) fetchInto(panel);
			}
		});
	}

	/**
	 * A radio group that swaps one class on a demo accordion (indicator style,
	 * size) and writes the class into the snippet; the default option is the
	 * empty value and adds nothing.
	 */
	function mountClassSwitch(groupName, targetSelector, snippetSelector) {
		const target = pick(targetSelector);
		const radios = pickAll(`input[name="${groupName}"]`);
		if (!target || !radios.length) return;
		const snippet = pick(snippetSelector);
		const classNames = radios.map((radio) => radio.value).filter(Boolean);

		function applyChoice(radio) {
			target.classList.remove(...classNames);
			if (radio.value) target.classList.add(radio.value);
			if (snippet) snippet.textContent = radio.value ? ` ${radio.value}` : '';
		}

		for (const radio of radios) {
			radio.addEventListener('change', () => {
				if (radio.checked) applyChoice(radio);
			});
		}

		const checked = radios.find((radio) => radio.checked);
		if (checked) applyChoice(checked);
	}

	/* The sideways row of tabs. */

	function mountSidewaysRow() {
		const row = pick('[data-ac-horizontal]');
		if (!row) return;
		const panels = pickAll('.ac-h-panel', row);

		/* One tab is always open. A click on the open tab is swallowed during the
       capture phase, before Bootstrap's document handler can close it. */
		window.addEventListener(
			'click',
			(event) => {
				const tab = event.target.closest?.('.ac-h-btn');
				if (!tab || !row.contains(tab)) return;
				const panel = pick(tab.getAttribute('data-bs-target'), document);
				if (panel?.classList.contains('show') || panel?.classList.contains('collapsing'))
					event.stopPropagation();
			},
			true,
		);

		/* Wide screens animate the width; a phone stacks the row and animates height. */
		function fitWidth() {
			for (const panel of panels) panel.classList.toggle('collapse-horizontal', wideScreen.matches);
		}

		wideScreen.addEventListener('change', fitWidth);
		fitWidth();
	}

	/**
	 * The hero button opens or closes every panel on the page by setting the
	 * state directly, so panels sharing a parent can all stay open. Sideways
	 * tabs, disabled headers and hidden FAQ results are skipped.
	 */
	function mountHeroToggle() {
		const trigger = pick('[data-ac-open-all]', document);
		if (!trigger) return;
		const caption = pick('span', trigger);
		const glyph = pick('.bi', trigger);
		let everythingOpen = false;

		trigger.addEventListener('click', () => {
			everythingOpen = !everythingOpen;

			for (const panel of pickAll('.accordion .accordion-collapse')) {
				const header = headerButton(panel);
				if (!header || header.disabled || panel.closest('[hidden]')) continue;
				window.Basalt.slide(panel, () => forceState(panel, everythingOpen));
			}

			for (const hook of afterOpenAll) hook();

			caption.textContent = everythingOpen ? 'Close every panel' : 'Open every panel';
			glyph.className = `bi ${everythingOpen ? 'bi-arrows-collapse' : 'bi-arrows-expand'} me-1`;
		});
	}

	start();
})();
