/**
 * Buttons page (buttons.html). Everything here is page furniture:
 * the kind filter over the card grid, the copy buttons on the code
 * snippets, the three pretend network calls behind the loading
 * buttons, the "play every state" button in the page head, and the
 * small readouts under the confirm, segmented, speed dial, like and
 * shortcut demos. The button mechanics they react to (state
 * classes, hold and two-step confirm, the segmented thumb, the speed
 * dial, copy, shortcut keys) are basalt.js's.
 */
(() => {
	'use strict';

	const scene = pick('[data-bt-root]', document);
	if (!scene || !window.bootstrap) return;

	/* How long the pretend calls take, and how long results stay on screen. */
	const SAVE_TAKES = 1400;
	const SYNC_TAKES = 1300;
	const EXPORT_STEPS = 20;
	const EXPORT_STEP_TAKES = 90;
	const RESULT_STAYS = 2400;
	const PLAY_ALL_STAYS = 2200;
	const COPIED_STAYS = 1800;
	const LINE_LEAVES_IN = 240;
	const COUNT_UP_TAKES = 420;

	/* The segmented demo's readout, keyed by the radio value. */
	const PERIOD_TOTALS = {
		day: { total: 58, caption: 'orders today' },
		week: { total: 412, caption: 'orders this week' },
		month: { total: 1764, caption: 'orders this month' },
		year: { total: 20318, caption: 'orders this year' },
	};

	/* Which pretend call each loading button starts, by its data-bt-load. */
	const PRETEND_CALLS = { save: pretendSave, export: pretendExport, sync: pretendSync };

	/* Timers kept per button, so a second click cancels the first one's reset. */
	const copiedTimers = new WeakMap();
	const resultTimers = new WeakMap();
	const loadingNote = pick('[data-bt-load-log]');
	let syncAttempts = 0;

	/**
	 * Wires every demo on the page. Each piece checks for its own markup,
	 * so a card that is removed from the page costs nothing here.
	 */
	function start() {
		mountKindFilter();
		mountSnippetCopy();
		mountLoadingButtons();
		mountPlayAll();
		mountHoldReadout();
		mountBasket();
		mountSegmentedReadout();
		mountDialReadout();
		mountLikeCounter();
		mountShortcutReadout();
	}

	/* The kind filter: chips at the top, cards hidden or shown below. */

	function mountKindFilter() {
		const deck = pick('[data-bt-grid]');
		if (!deck) return;
		const tally = pick('[data-bt-count]');
		const specimens = pickAll('.bt-card', deck);
		const kindChips = pickAll('[data-bt-filter]');

		function showKind(kind) {
			const kept = specimens.filter((card) => {
				const kinds = (card.getAttribute('data-bt-groups') || '').split(/\s+/);
				const keep = kind === 'all' || kinds.includes(kind);
				card.classList.toggle('is-hidden', !keep);
				card.classList.remove('is-alone');
				return keep;
			});
			widenOddOnesOut(kept);
			if (tally) tally.textContent = countOf(kept.length, 'button type', 'button types');
		}

		for (const pressedChip of kindChips) {
			pressedChip.addEventListener('click', () => {
				for (const eachChip of kindChips)
					eachChip.setAttribute('aria-pressed', String(eachChip === pressedChip));
				showKind(pressedChip.getAttribute('data-bt-filter'));
			});
		}
		showKind('all');
	}

	/**
	 * Half-width cards sit two to a row between the full-width ones. A run
	 * of them with an odd length would leave a gap, so its last card is
	 * widened to take the whole row.
	 */
	function widenOddOnesOut(specimens) {
		const runs = [[]];
		for (const card of specimens) {
			if (card.classList.contains('bt-card-full')) runs.push([]);
			else runs[runs.length - 1].push(card);
		}
		for (const run of runs) {
			if (run.length % 2) run[run.length - 1].classList.add('is-alone');
		}
	}

	/* Copy buttons on the code snippets. */

	function mountSnippetCopy() {
		for (const button of pickAll('[data-bt-copy]')) {
			button.addEventListener('click', () => copySnippet(button));
		}
	}

	function copySnippet(button) {
		const codeBlock = pick('pre', button.parentElement);
		if (!codeBlock) return;
		window.Basalt.copyText(codeBlock.textContent.trim()).then(() => {
			relabelCopy(button, 'bi bi-check2', ' Copied');
			clearTimeout(copiedTimers.get(button));
			copiedTimers.set(
				button,
				setTimeout(() => relabelCopy(button, 'bi bi-clipboard', ' Copy'), COPIED_STAYS),
			);
		});
	}

	function relabelCopy(button, iconClasses, label) {
		const glyph = pick('.bi', button);
		button.lastChild.textContent = label;
		if (glyph) glyph.className = iconClasses;
	}

	/* Loading buttons: three pretend calls and the button that plays them all. */

	function mountLoadingButtons() {
		for (const button of pickAll('[data-bt-load]')) {
			button.addEventListener('click', () => play(button));
		}
	}

	function mountPlayAll() {
		const trigger = pick('[data-bt-play-all]', document);
		if (!trigger) return;
		trigger.addEventListener('click', () => {
			Basalt.buttonState(trigger, 'loading');
			const heading = pick('#bt-loading-title');
			if (heading)
				heading
					.closest('.bt-card')
					.scrollIntoView({ behavior: motionIsReduced() ? 'auto' : 'smooth', block: 'center' });
			Promise.all(pickAll('[data-bt-load]').map((button) => play(button))).then(() => {
				Basalt.buttonState(trigger, 'success');
				setTimeout(() => Basalt.buttonState(trigger, 'idle'), PLAY_ALL_STAYS);
			});
		});
	}

	/**
	 * Starts the button's pretend call and, once it has succeeded, books
	 * the return to idle. A button already busy is left alone. Always
	 * returns a promise, so "play all" can wait on every button.
	 */
	function play(button) {
		const call = PRETEND_CALLS[button.getAttribute('data-bt-load')];
		if (!call || button.classList.contains('is-loading')) return Promise.resolve();
		clearTimeout(resultTimers.get(button));
		return call(button).then(() => {
			if (!button.classList.contains('is-success')) return;
			resultTimers.set(
				button,
				setTimeout(() => Basalt.buttonState(button, 'idle'), RESULT_STAYS),
			);
		});
	}

	async function pretendSave(button) {
		Basalt.buttonState(button, 'loading');
		await pause(SAVE_TAKES);
		Basalt.buttonState(button, 'success');
		tellLoading(`Changes saved at ${clockNow()}.`);
	}

	async function pretendExport(button) {
		Basalt.buttonState(button, 'loading');
		for (let stepsDone = 1; stepsDone <= EXPORT_STEPS; stepsDone += 1) {
			await pause(EXPORT_STEP_TAKES);
			Basalt.buttonProgress(button, stepsDone / EXPORT_STEPS);
		}
		Basalt.buttonState(button, 'success');
		tellLoading('312 orders exported to orders-september.csv.');
	}

	/* Every other attempt fails, so the error state gets its turn. */
	async function pretendSync(button) {
		Basalt.buttonState(button, 'loading');
		await pause(SYNC_TAKES);
		syncAttempts += 1;
		const failed = syncAttempts % 2 === 1;
		Basalt.buttonState(button, failed ? 'error' : 'success');
		tellLoading(
			failed
				? "The warehouse didn't answer. Press the button again to retry."
				: 'Stock synced: 48 products updated.',
		);
	}

	function tellLoading(message) {
		if (loadingNote) loadingNote.textContent = message;
	}

	function clockNow() {
		return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
	}

	/* Hold to confirm: the readout says what was done, and Undo takes it back. */

	function mountHoldReadout() {
		const note = pick('[data-bt-hold-log]');
		const undo = pick('[data-bt-hold-undo]');
		let heldDown = null;

		for (const button of pickAll('[data-bt-hold]')) {
			button.addEventListener('basalt:confirm', () => {
				heldDown = button;
				if (note) note.textContent = button.getAttribute('data-bt-hold');
				if (undo) undo.hidden = false;
			});
		}
		if (!undo) return;
		undo.addEventListener('click', () => {
			if (!heldDown) return;
			heldDown.classList.remove('is-done');
			heldDown.style.setProperty('--basalt-hold', '0');
			if (note) note.textContent = 'Undone. Nothing was deleted.';
			undo.hidden = true;
			heldDown.focus();
			heldDown = null;
		});
	}

	/* Two-step confirm: lines leave the basket, and Undo puts the last one back. */

	function mountBasket() {
		const note = pick('[data-bt-cart-log]');
		const undo = pick('[data-bt-cart-undo]');
		const basketLines = pickAll('[data-bt-cart-row]');
		let takenOut = null;

		function stillIn() {
			return countOf(basketLines.filter((basketLine) => !basketLine.hidden).length, 'item', 'items');
		}

		for (const basketLine of basketLines) {
			pick('[data-basalt-confirm]', basketLine).addEventListener('basalt:confirm', () => {
				basketLine.classList.add('is-gone');
				setTimeout(
					() => {
						basketLine.hidden = true;
						basketLine.classList.remove('is-gone');
						takenOut = basketLine;
						if (note)
							note.textContent = `${basketLine.getAttribute('data-bt-cart-row')} removed. ${stillIn()} left.`;
						if (undo) {
							undo.hidden = false;
							undo.focus();
						}
					},
					motionIsReduced() ? 0 : LINE_LEAVES_IN,
				);
			});
		}
		if (!undo) return;
		undo.addEventListener('click', () => {
			if (!takenOut) return;
			takenOut.hidden = false;
			if (note) note.textContent = `Put back. ${stillIn()} in the basket.`;
			undo.hidden = true;
			pick('[data-basalt-confirm]', takenOut).focus();
			takenOut = null;
		});
	}

	/* Segmented control: the figure counts up to the period's total. */

	function mountSegmentedReadout() {
		const radios = pick('[data-bt-seg]');
		const figure = pick('[data-bt-seg-num]');
		const caption = pick('[data-bt-seg-text]');
		if (!radios || !figure) return;
		let showing = 412;
		let ticket = 0;

		radios.addEventListener('change', (event) => {
			const period = PERIOD_TOTALS[event.target.value];
			if (!period) return;
			caption.textContent = period.caption;
			cancelAnimationFrame(ticket);
			const startValue = showing;
			const startedAt = performance.now();
			const atOnce = motionIsReduced();

			function stepFigure(now) {
				const progress = atOnce ? 1 : Math.min(1, (now - startedAt) / COUNT_UP_TAKES);
				showing = Math.round(startValue + (period.total - startValue) * settle(progress));
				figure.textContent = showing.toLocaleString('en-US');
				if (progress < 1) ticket = requestAnimationFrame(stepFigure);
			}
			ticket = requestAnimationFrame(stepFigure);
		});
	}

	/* Fast at first, then easing into the final figure. */
	function settle(progress) {
		return 1 - Math.pow(1 - progress, 3);
	}

	/* Readouts that only echo the button pressed. */

	function mountDialReadout() {
		const note = pick('[data-bt-dial-log]');
		for (const dialAction of pickAll('[data-bt-dial-pick]')) {
			dialAction.addEventListener('click', () => {
				if (note) note.textContent = `You picked: ${dialAction.getAttribute('data-bt-dial-pick')}.`;
			});
		}
	}

	function mountShortcutReadout() {
		const note = pick('[data-bt-kbd-log]');
		for (const button of pickAll('[data-bt-kbd]')) {
			button.addEventListener('click', () => {
				if (note) note.textContent = `${button.getAttribute('data-bt-kbd')}.`;
			});
		}
	}

	function mountLikeCounter() {
		const button = pick('[data-bt-like]');
		const figure = pick('[data-bt-like-num]');
		if (!button || !figure) return;
		button.addEventListener('click', () => {
			figure.textContent = button.classList.contains('active') ? '129' : '128';
		});
	}

	/* Small helpers the pieces above share. */

	function pick(selector, scope = scene) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = scene) {
		return [...scope.querySelectorAll(selector)];
	}

	function countOf(total, one, several) {
		return `${total} ${total === 1 ? one : several}`;
	}

	function pause(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	function motionIsReduced() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	start();
})();
