/**
 * Loaders page (loaders.html). Runs the kind chips over the card grid,
 * the copy button under every snippet, and each small demo that plays a
 * wait: skeleton cards and table, the staged job, the panel veil, loading
 * buttons, the top bar, the typing bubble, refresh arrows and the search
 * box. Basalt.buttonState and Basalt.copyText come from basalt.js; the
 * loaders themselves are styled in basalt.css.
 */
(() => {
	'use strict';

	const stage = pick('[data-ld-root]', document);
	if (!stage) return;

	/* How long each step of the staged job pretends to work, in order. */
	const STEP_LENGTHS = [1300, 1900, 1500, 1000];

	/* What the search box can find, name and price, as the server would return it. */
	const CATALOG = [
		{ name: 'Sculpted Shoulder Blazer', price: '$1,290' },
		{ name: 'Draped Column Gown', price: '$2,150' },
		{ name: 'Tiered Organza Dress', price: '$1,680' },
		{ name: 'Two-Tone Oxfords', price: '$850' },
		{ name: 'Leather Trench Coat', price: '$3,200' },
		{ name: 'Shield Sunglasses', price: '$520' },
		{ name: 'Cat-Eye Sunglasses', price: '$465' },
		{ name: 'E-Gift Card, $250', price: '$250' },
	];

	const ESCAPED = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

	/* Demos that can be played again collect a replay function here; the
     header button runs them all in page order. */
	const replays = [];

	/**
	 * Wires every demo on the page, then the header's replay button.
	 */
	function start() {
		wireKindChips();
		wireCopyButtons();
		wireSkeletonCards();
		wireSkeletonTable();
		wireStagedJob();
		wirePanelVeil();
		wireLoadingButtons();
		wireLoadbar();
		wireTypingBubble();
		wireRefreshArrows();
		wireSearchBox();
		pick('[data-ld-replay]', document)?.addEventListener('click', () => {
			for (const again of replays) again();
		});
	}

	function pick(selector, scope = stage) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = stage) {
		return [...scope.querySelectorAll(selector)];
	}

	/**
	 * Looks up several nodes under one scope at once, by name to selector.
	 */
	function partsOf(scope, selectors) {
		return Object.fromEntries(Object.entries(selectors).map(([name, selector]) => [name, pick(selector, scope)]));
	}

	function pause(ms) {
		return new Promise((wake) => setTimeout(wake, ms));
	}

	function countOf(total, single, several) {
		return `${total} ${total === 1 ? single : several}`;
	}

	function markBusy(box, busy) {
		box.classList.toggle('is-loading', busy);
		box.setAttribute('aria-busy', String(busy));
	}

	/* The chips show one kind of loader at a time. Half-width cards pair up
     between the full-width ones; a lone card at the end of a run spans the
     whole row so the grid has no hole. */
	function wireKindChips() {
		const { grid, counter } = partsOf(stage, { grid: '[data-ld-grid]', counter: '[data-ld-count]' });
		if (!grid) return;
		const cards = pickAll('.ld-card', grid);
		const chips = pickAll('[data-ld-filter]');

		function showKind(kind) {
			const visible = cards.filter((card) => {
				const keep = kind === 'all' || card.dataset.ldKind === kind;
				card.classList.toggle('is-hidden', !keep);
				card.classList.remove('is-alone');
				return keep;
			});

			let unpaired = null;
			for (const card of visible) {
				if (card.classList.contains('ld-card-full')) {
					unpaired?.classList.add('is-alone');
					unpaired = null;
				} else {
					unpaired = unpaired ? null : card;
				}
			}
			unpaired?.classList.add('is-alone');

			if (counter) counter.textContent = countOf(visible.length, 'loader type', 'loader types');
		}

		function press(chip) {
			for (const other of chips) other.setAttribute('aria-pressed', String(other === chip));
			showKind(chip.dataset.ldFilter);
		}

		for (const chip of chips) chip.addEventListener('click', () => press(chip));
		showKind('all');
	}

	/* Each snippet's button copies the <pre> beside it and says so for a moment. */
	function wireCopyButtons() {
		for (const button of pickAll('[data-ld-copy]')) {
			let revert = null;
			button.addEventListener('click', () => {
				const snippet = pick('pre', button.parentElement);
				if (!snippet) return;
				window.Basalt.copyText(snippet.textContent.trim()).then(() => {
					const glyph = pick('.bi', button);
					button.lastChild.textContent = ' Copied';
					if (glyph) glyph.className = 'bi bi-check2';
					clearTimeout(revert);
					revert = setTimeout(() => {
						button.lastChild.textContent = ' Copy';
						if (glyph) glyph.className = 'bi bi-clipboard';
					}, 1800);
				});
			});
		}
	}

	/**
	 * Makes a loadable box pretend to fetch: busy with one status line, then
	 * settled with another after `delay` ms. Returns the function that starts
	 * it; a restart cancels the pending settle.
	 */
	function pretendLoad(box, status, waitingText, settledText, delay) {
		let pending = null;
		return () => {
			clearTimeout(pending);
			markBusy(box, true);
			status.textContent = waitingText;
			pending = setTimeout(() => {
				markBusy(box, false);
				status.textContent = settledText;
			}, delay);
		};
	}

	/* Skeleton cards, with a radio row that swaps the shapes' motion class. */
	function wireSkeletonCards() {
		const root = pick('[data-ld-skel]');
		if (!root) return;
		const { box, status, loadButton } = partsOf(root, {
			box: '[data-ld-skel-box]',
			status: '[data-ld-skel-status]',
			loadButton: '[data-ld-skel-load]',
		});
		const bones = pickAll('.basalt-skeleton', box);
		const reload = pretendLoad(box, status, 'Loading products…', '3 products loaded', 2200);

		for (const radio of pickAll('input[name="ld-skel-motion"]', root)) {
			radio.addEventListener('change', () => {
				for (const bone of bones) {
					bone.classList.remove('basalt-skeleton-pulse', 'basalt-skeleton-still');
					if (radio.value) bone.classList.add(radio.value);
				}
				/* A new motion is only visible while the shapes are showing. */
				if (!box.classList.contains('is-loading')) reload();
			});
		}

		loadButton.addEventListener('click', reload);
		reload();
		replays.push(reload);
	}

	function wireSkeletonTable() {
		const root = pick('[data-ld-table]');
		if (!root) return;
		const { box, status, loadButton } = partsOf(root, {
			box: '[data-ld-table-box]',
			status: '[data-ld-table-status]',
			loadButton: '[data-ld-table-load]',
		});
		const reload = pretendLoad(box, status, 'Loading orders…', '5 latest orders', 2600);
		loadButton.addEventListener('click', reload);
		reload();
		replays.push(reload);
	}

	/* The staged job walks its steps one after another. A running clock
     shows elapsed time; Cancel bumps the attempt number so a stale run
     stops at its next await. */
	function wireStagedJob() {
		const root = pick('[data-ld-stages]');
		if (!root) return;
		const steps = pickAll('.basalt-stages-item', root);
		const { clock, outcome, announcer, startButton, cancelButton } = partsOf(root, {
			clock: '[data-ld-stages-clock]',
			outcome: '[data-ld-stages-done]',
			announcer: '[data-ld-stages-live]',
			startButton: '[data-ld-stages-start]',
			cancelButton: '[data-ld-stages-cancel]',
		});
		let attempt = 0;
		let clockTimer = null;

		function seconds(ms) {
			return `${(ms / 1000).toFixed(1)} s`;
		}

		function stopClock() {
			clearInterval(clockTimer);
			clockTimer = null;
		}

		function settle(startLabel) {
			const focusWasOnCancel = document.activeElement === cancelButton;
			startButton.disabled = false;
			cancelButton.disabled = true;
			pick('span', startButton).textContent = startLabel;
			if (focusWasOnCancel) startButton.focus();
		}

		async function build() {
			const mine = ++attempt;
			for (const step of steps) {
				step.classList.remove('is-active', 'is-done');
				pick('[data-time]', step).textContent = '';
			}
			outcome.hidden = true;

			const began = performance.now();
			stopClock();
			clockTimer = setInterval(() => {
				clock.textContent = `Running · ${seconds(performance.now() - began)}`;
			}, 100);
			startButton.disabled = true;
			cancelButton.disabled = false;
			cancelButton.focus();

			for (const [index, step] of steps.entries()) {
				const stepBegan = performance.now();
				step.classList.add('is-active');
				announcer.textContent = pick('span:nth-child(2)', step).textContent.trim();
				await pause(STEP_LENGTHS[index]);
				if (mine !== attempt) return;
				step.classList.replace('is-active', 'is-done');
				pick('[data-time]', step).textContent = seconds(performance.now() - stepBegan);
			}

			stopClock();
			clock.textContent = `Finished in ${seconds(performance.now() - began)}`;
			outcome.hidden = false;
			announcer.textContent = 'Report ready.';
			settle('Build it again');
		}

		startButton.addEventListener('click', build);
		cancelButton.addEventListener('click', () => {
			attempt += 1;
			stopClock();
			for (const step of steps) step.classList.remove('is-active');
			clock.textContent = 'Canceled';
			announcer.textContent = 'Report canceled.';
			settle('Build the report');
		});
	}

	/* The veil covers one panel; the content under it goes inert and focus
     lands on Cancel so the keyboard has somewhere to be. */
	function wirePanelVeil() {
		const panel = pick('[data-ld-overlay]');
		if (!panel) return;
		const { covered, recountButton, cancelButton, veilText, stamp } = partsOf(panel, {
			covered: '[data-ld-overlay-content]',
			recountButton: '[data-ld-overlay-go]',
			cancelButton: '[data-ld-overlay-cancel]',
			veilText: '[data-ld-overlay-text]',
			stamp: '[data-ld-overlay-meta]',
		});
		const figures = pickAll('[data-ld-overlay-list] strong', panel);
		let settleTimer = null;

		/* The veil's sentence is only announced while the veil is up. */
		veilText.textContent = '';

		function lift(note) {
			clearTimeout(settleTimer);
			panel.classList.remove('is-busy');
			panel.removeAttribute('aria-busy');
			covered.inert = false;
			veilText.textContent = '';
			stamp.textContent = note;
			recountButton.focus();
		}

		recountButton.addEventListener('click', () => {
			panel.classList.add('is-busy');
			panel.setAttribute('aria-busy', 'true');
			covered.inert = true;
			veilText.textContent = 'Counting stock…';
			cancelButton.focus();
			settleTimer = setTimeout(() => {
				for (const figure of figures) {
					const drift = Math.round(Math.random() * 12 - 6);
					figure.textContent = `${parseInt(figure.textContent.trim(), 10) + drift} units`;
				}
				lift('Counted just now');
			}, 2400);
		});
		cancelButton.addEventListener('click', () => lift('Recount canceled'));
	}

	/* Loading buttons run busy, then done or failed, then back to idle. A
     button with a data-failed label is the one that always fails. */
	function wireLoadingButtons() {
		const root = pick('[data-ld-lbtn]');
		if (!root) return;
		const announcer = pick('[data-ld-lbtn-live]', root);

		for (const button of pickAll('[data-ld-lbtn-go]', root)) {
			button.addEventListener('click', async () => {
				if (button.getAttribute('aria-disabled') === 'true') return;
				const willFail = button.hasAttribute('data-failed');
				const busyLabel = button.dataset.busy;
				Basalt.buttonState(button, 'loading', busyLabel);
				announcer.textContent = busyLabel;
				await pause(1600);
				const endLabel = willFail ? button.dataset.failed : button.dataset.done;
				Basalt.buttonState(button, willFail ? 'failed' : 'done', endLabel);
				announcer.textContent = endLabel;
				await pause(willFail ? 2600 : 1800);
				Basalt.buttonState(button, 'idle');
			});
		}
	}

	/* The top bar creeps toward 90% in shrinking steps and fills on finish,
     which happens on its own after a while or when Finish now is pressed. */
	function wireLoadbar() {
		const root = pick('[data-ld-loadbar]');
		if (!root) return;
		const { frame, bar, openButton, finishButton, status } = partsOf(root, {
			frame: '[data-ld-frame]',
			bar: '[data-ld-loadbar-bar]',
			openButton: '[data-ld-loadbar-start]',
			finishButton: '[data-ld-loadbar-done]',
			status: '[data-ld-loadbar-status]',
		});
		let progress = 0;
		let creep = null;
		let autoFinish = null;

		function moveTo(value) {
			progress = value;
			bar.style.setProperty('--loadbar-value', value);
		}

		function land() {
			clearInterval(creep);
			clearTimeout(autoFinish);
			bar.classList.add('is-done');
			moveTo(100);
			frame.classList.remove('is-loading');
			status.textContent = 'Orders page loaded';
			if (document.activeElement === finishButton) openButton.focus();
			finishButton.disabled = true;
			openButton.disabled = false;
		}

		openButton.addEventListener('click', () => {
			bar.classList.remove('is-done');
			bar.classList.add('is-active');
			moveTo(0);
			frame.classList.add('is-loading');
			status.textContent = 'Loading the orders page…';
			openButton.disabled = true;
			finishButton.disabled = false;
			finishButton.focus();
			requestAnimationFrame(() => moveTo(12));
			creep = setInterval(() => moveTo(progress + (90 - progress) * 0.12), 300);
			autoFinish = setTimeout(land, 4200);
		});
		finishButton.addEventListener('click', land);
		bar.addEventListener('transitionend', (event) => {
			if (event.propertyName !== 'opacity' || !bar.classList.contains('is-done')) return;
			bar.classList.remove('is-active');
			moveTo(0);
		});
	}

	function wireTypingBubble() {
		const root = pick('[data-ld-typing]');
		if (!root) return;
		const { dotsRow, answer, againButton } = partsOf(root, {
			dotsRow: '[data-ld-typing-dots]',
			answer: '[data-ld-typing-reply]',
			againButton: '[data-ld-typing-again]',
		});
		let answerTimer = null;

		function askAgain() {
			clearTimeout(answerTimer);
			answer.hidden = true;
			dotsRow.hidden = false;
			answerTimer = setTimeout(() => {
				dotsRow.hidden = true;
				answer.hidden = false;
			}, 2600);
		}

		againButton.addEventListener('click', askAgain);
		askAgain();
		replays.push(askAgain);
	}

	/* Each refresh arrow is tied to a figure and a note by its data-target. */
	function wireRefreshArrows() {
		const root = pick('[data-ld-refresh]');
		if (!root) return;

		for (const arrow of pickAll('[data-ld-refresh-go]', root)) {
			const target = arrow.dataset.target;
			const figure = pick(`[data-ld-refresh-value="${target}"]`, root);
			const note = pick(`[data-ld-refresh-note="${target}"]`, root);
			arrow.addEventListener('click', async () => {
				if (arrow.classList.contains('is-spinning')) return;
				arrow.classList.add('is-spinning');
				arrow.setAttribute('aria-busy', 'true');
				note.textContent = 'Updating…';
				await pause(1300);
				const bump = 1 + Math.round(Math.random() * 4);
				figure.textContent = String(parseInt(figure.textContent.trim(), 10) + bump);
				note.textContent = 'Updated just now';
				arrow.classList.remove('is-spinning');
				arrow.removeAttribute('aria-busy');
			});
		}
	}

	/* Typing in the search box shows the spinner, waits a beat for the
     "server", then lists the first four matches with the query marked. */
	function wireSearchBox() {
		const root = pick('[data-ld-search]');
		if (!root) return;
		const { field, summary, results } = partsOf(root, {
			field: '[data-ld-search-box]',
			summary: '[data-ld-search-count]',
			results: '[data-ld-search-results]',
		});
		const input = pick('input', field);
		let replyTimer = null;
		let request = 0;

		function htmlSafe(text) {
			return text.replace(/[&<>"]/g, (ch) => ESCAPED[ch]);
		}

		function showMatches(query) {
			const needle = query.toLowerCase();
			const matches = CATALOG.filter((item) => item.name.toLowerCase().includes(needle));
			const marker = query ? new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig') : null;

			results.innerHTML = matches
				.slice(0, 4)
				.map((item) => {
					const shown = htmlSafe(item.name);
					return `<li><span>${marker ? shown.replace(marker, '<mark>$1</mark>') : shown}</span><span>${item.price}</span></li>`;
				})
				.join('');
			if (!matches.length)
				results.innerHTML = `<li><span>Nothing matches “${htmlSafe(query)}”</span><span></span></li>`;

			summary.textContent = query
				? `${countOf(matches.length, 'product matches', 'products match')} “${query}”`
				: countOf(CATALOG.length, 'product', 'products');
		}

		input.addEventListener('input', () => {
			const query = input.value.trim();
			const mine = ++request;
			clearTimeout(replyTimer);
			field.classList.add('is-loading');
			results.setAttribute('aria-busy', 'true');
			summary.textContent = 'Searching…';
			replyTimer = setTimeout(() => {
				if (mine !== request) return;
				field.classList.remove('is-loading');
				results.setAttribute('aria-busy', 'false');
				showMatches(query);
			}, 700);
		});
		showMatches('');
	}

	start();
})();
