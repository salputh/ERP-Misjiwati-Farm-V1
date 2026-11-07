/**
 * Component script for the richer empty states. It loads after assets/basalt/js/basalt.js, and
 * only on the pages that use it; documentation.html#page-map lists them.
 */

/**
 * Behavior for the richer empty states shown on empty-states.html: a
 * drop zone that glows while a file hovers ('basalt:files'), a setup
 * checklist with a progress ring (el.basaltChecklistReset(done)), a retry
 * countdown that can be paused or skipped, an offline notice that tracks
 * the connection, and pictures that draw themselves in once seen.
 * Markup inserted later is picked up by window.Basalt.empty.init(root).
 */
(() => {
	'use strict';
	const EMPTY_KINDS = {
		'[data-basalt-drop]': mountDropZone,
		'[data-basalt-checklist]': mountChecklist,
		'[data-basalt-retry]': mountRetry,
		'[data-basalt-offline]': mountOfflineNotice,
		'[data-basalt-empty-animate]': mountDrawIn,
	};

	function start() {
		window.Basalt.empty = { init: scanEmptyStates };
		document.addEventListener('DOMContentLoaded', () => scanEmptyStates());
	}

	/**
	 * Sets up every empty-state widget found inside a part of the page.
	 * @param {ParentNode} [scope=document] Where to look; widgets already set up are skipped.
	 */
	function scanEmptyStates(scope) {
		const area = scope || document;
		for (const [selector, mount] of Object.entries(EMPTY_KINDS)) {
			for (const node of area.querySelectorAll(selector)) mount(node);
		}
	}

	/* Shared helpers. */
	function prefersStill() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/** Marks a node as set up under the given dataset flag; false if it already was. */
	function claim(node, flag) {
		if (node.dataset[flag]) return false;
		node.dataset[flag] = 'true';
		return true;
	}

	/** Fills a progress ring drawn with a 100-unit dash to the given share (0 to 1). */
	function fillRing(circle, share) {
		if (!circle) return;
		const bounded = Math.min(Math.max(share, 0), 1);
		circle.style.strokeDashoffset = String(100 - bounded * 100);
	}

	/* Drop zone: [data-basalt-drop] glows with .is-over while a file is held
     over it, and a drop or a pick through [data-basalt-drop-browse] (which
     opens the hidden [data-basalt-drop-input]) fires 'basalt:files' with
     the chosen files in detail.files. */
	function mountDropZone(zone) {
		if (!claim(zone, 'basaltDropReady')) return;
		const picker = zone.querySelector('[data-basalt-drop-input]');
		const browseButton = zone.querySelector('[data-basalt-drop-browse]');
		/* dragenter and dragleave fire for every child crossed, so count them. */
		let nesting = 0;

		const dragHandlers = {
			dragenter(event) {
				if (!carriesFiles(event)) return;
				event.preventDefault();
				nesting += 1;
				zone.classList.add('is-over');
			},
			dragover(event) {
				if (!carriesFiles(event)) return;
				event.preventDefault();
				event.dataTransfer.dropEffect = 'copy';
			},
			dragleave() {
				nesting = Math.max(0, nesting - 1);
				if (nesting === 0) zone.classList.remove('is-over');
			},
			drop(event) {
				if (!carriesFiles(event)) return;
				event.preventDefault();
				nesting = 0;
				zone.classList.remove('is-over');
				announceFiles(event.dataTransfer.files);
			},
		};
		for (const [type, handler] of Object.entries(dragHandlers)) zone.addEventListener(type, handler);

		if (!browseButton || !picker) return;
		browseButton.addEventListener('click', () => picker.click());
		picker.addEventListener('change', () => {
			announceFiles(picker.files);
			picker.value = '';
		});

		function carriesFiles(event) {
			return Array.from(event.dataTransfer?.types ?? []).includes('Files');
		}

		function announceFiles(list) {
			if (!list?.length) return;
			const detail = { files: [...list] };
			zone.dispatchEvent(new CustomEvent('basalt:files', { bubbles: true, detail }));
		}
	}

	/* Setup checklist: a [data-basalt-checklist-do] button inside a
     [data-basalt-checklist-item] row ticks that row off. The ring and the
     count keep up, the last tick swaps the list for the finish block, and
     each change fires 'basalt:checklist' with detail.done and detail.total. */
	function mountChecklist(panel) {
		if (!claim(panel, 'basaltChecklistReady')) return;
		const rows = [...panel.querySelectorAll('[data-basalt-checklist-item]')];
		const parts = {
			ring: panel.querySelector('[data-basalt-checklist-ring]'),
			tally: panel.querySelector('[data-basalt-checklist-count]'),
			steps: panel.querySelector('.basalt-empty-steps'),
			wrapUp: panel.querySelector('[data-basalt-checklist-finish]'),
		};

		panel.addEventListener('click', (event) => {
			const doButton = event.target.closest('[data-basalt-checklist-do]');
			if (doButton) tickOff(doButton);
		});

		/** Puts the checklist back with the first `completed` rows ticked. */
		panel.basaltChecklistReset = function resetChecklist(completed) {
			for (const [position, row] of rows.entries()) {
				const ticked = position < completed;
				row.classList.toggle('is-done', ticked);
				const doneTag = row.querySelector('.basalt-empty-steps-done');
				if (!ticked && doneTag) doneTag.replaceWith(makeDoButton(row));
			}
			if (parts.steps) parts.steps.hidden = false;
			if (parts.wrapUp) parts.wrapUp.hidden = true;
			report();
		};

		/* Keep each row's button wording so a reset can rebuild it. */
		for (const row of rows) {
			const original = row.querySelector('[data-basalt-checklist-do]');
			if (original) row.setAttribute('data-label', original.textContent.trim());
		}
		report();

		function tickOff(doButton) {
			const row = doButton.closest('[data-basalt-checklist-item]');
			row.classList.add('is-done', 'is-fresh');
			setTimeout(() => row.classList.remove('is-fresh'), 260);
			const doneTag = document.createElement('span');
			doneTag.textContent = 'Done';
			doneTag.className = 'basalt-empty-steps-done';
			doButton.replaceWith(doneTag);
			report();

			const nextRow = rows.find((candidate) => !candidate.classList.contains('is-done'));
			if (nextRow) {
				nextRow.querySelector('[data-basalt-checklist-do]')?.focus();
				return;
			}
			if (!parts.wrapUp) return;
			setTimeout(
				() => {
					if (parts.steps) parts.steps.hidden = true;
					parts.wrapUp.hidden = false;
					parts.wrapUp.querySelector('button, a')?.focus();
				},
				prefersStill() ? 0 : 450,
			);
		}

		function makeDoButton(row) {
			const button = document.createElement('button');
			button.className = 'btn btn-sm btn-outline-secondary';
			button.type = 'button';
			button.textContent = row.getAttribute('data-label') || 'Do this';
			button.setAttribute('data-basalt-checklist-do', '');
			return button;
		}

		function report() {
			const total = rows.length;
			const done = rows.filter((row) => row.classList.contains('is-done')).length;
			fillRing(parts.ring, done / total);
			if (parts.tally)
				parts.tally.textContent = done === total ? `All ${total} done` : `${done} of ${total} done`;
			panel.dispatchEvent(new CustomEvent('basalt:checklist', { bubbles: true, detail: { done, total } }));
		}
	}

	/* Retry countdown: [data-basalt-retry] counts down from
     data-basalt-retry-seconds and then fires 'basalt:retry' carrying
     detail.attempt and detail.done(ok). The page reports back through
     done(); a false result starts the count over. Pause and Try now are
     optional, and the clock stands still while the panel is off screen
     or the tab is in the background. */
	function mountRetry(panel) {
		if (!claim(panel, 'basaltRetryReady')) return;
		const fullCount = parseInt(panel.getAttribute('data-basalt-retry-seconds'), 10) || 10;
		const ui = {
			badge: panel.querySelector('[data-basalt-retry-status]'),
			line: panel.querySelector('[data-basalt-retry-text]'),
			ring: panel.querySelector('[data-basalt-retry-ring]'),
			tryNow: panel.querySelector('[data-basalt-retry-now]'),
			hold: panel.querySelector('[data-basalt-retry-pause]'),
			attemptLabel: panel.querySelector('[data-basalt-retry-attempt]'),
		};
		const attemptWording = ui.attemptLabel ? ui.attemptLabel.textContent : '';
		const clock = {
			secondsLeft: fullCount,
			attempt: 1,
			timeout: null,
			paused: false,
			busy: false,
			onScreen: false,
		};

		ui.tryNow?.addEventListener('click', tryAgain);
		ui.hold?.addEventListener('click', () => {
			clock.paused = !clock.paused;
			ui.hold.setAttribute('aria-pressed', String(clock.paused));
			ui.hold.textContent = clock.paused ? 'Resume' : 'Pause';
			paint();
			schedule();
		});
		document.addEventListener('visibilitychange', schedule);
		if ('IntersectionObserver' in window) {
			const watcher = new IntersectionObserver(([entry]) => {
				clock.onScreen = entry.isIntersecting;
				schedule();
			});
			watcher.observe(panel);
		} else {
			clock.onScreen = true;
		}

		/** Starts the count over from attempt one. */
		panel.basaltRetryReset = function restartRetry() {
			Object.assign(clock, { attempt: 1, secondsLeft: fullCount, busy: false });
			if (ui.attemptLabel) ui.attemptLabel.textContent = attemptWording;
			paint();
			schedule();
		};
		paint();
		schedule();

		function shouldCount() {
			return !(clock.paused || clock.busy || !clock.onScreen || document.hidden || panel.hidden);
		}

		function setLine(words) {
			if (ui.line) ui.line.textContent = words;
		}

		function paint() {
			fillRing(ui.ring, clock.secondsLeft / fullCount);
			if (clock.busy) return;
			const left = clock.secondsLeft;
			const unit = left === 1 ? 'second' : 'seconds';
			setLine(clock.paused ? `Paused. Trying again in ${left} seconds` : `Trying again in ${left} ${unit}`);
		}

		/** Queues the next one-second step, or nothing when the clock should be still. */
		function schedule() {
			clearTimeout(clock.timeout);
			if (!shouldCount()) return;
			clock.timeout = setTimeout(() => {
				if (!shouldCount()) return;
				clock.secondsLeft -= 1;
				paint();
				if (clock.secondsLeft > 0) schedule();
				else tryAgain();
			}, 1000);
		}

		function tryAgain() {
			clearTimeout(clock.timeout);
			clock.busy = true;
			ui.badge?.classList.add('is-trying');
			if (ui.tryNow) ui.tryNow.disabled = true;
			setLine('Trying now');
			panel.setAttribute('aria-busy', 'true');
			let settled = false;

			function done(ok) {
				if (settled) return;
				settled = true;
				clock.busy = false;
				panel.removeAttribute('aria-busy');
				ui.badge?.classList.remove('is-trying');
				if (ui.tryNow) ui.tryNow.disabled = false;
				if (ok) return;
				clock.attempt += 1;
				if (ui.attemptLabel)
					ui.attemptLabel.textContent = attemptWording.replace(/Attempt \d+/, `Attempt ${clock.attempt}`);
				clock.secondsLeft = fullCount;
				paint();
				schedule();
			}

			panel.dispatchEvent(
				new CustomEvent('basalt:retry', { bubbles: true, detail: { attempt: clock.attempt, done } }),
			);
		}
	}

	/* Offline notice: inside [data-basalt-offline], [data-basalt-offline-show]
     appears while the browser has no connection and
     [data-basalt-offline-hide] while it has one. Changes fire
     'basalt:offline' and 'basalt:online'. panel.basaltOffline.force(true,
     false or null) overrides what the browser says; null hands it back. */
	function mountOfflineNotice(panel) {
		if (!claim(panel, 'basaltOfflineReady')) return;
		const whenOffline = panel.querySelector('[data-basalt-offline-show]');
		const whenOnline = panel.querySelector('[data-basalt-offline-hide]');
		const recheck = panel.querySelector('[data-basalt-offline-check]');
		const note = panel.querySelector('[data-basalt-offline-status]');
		let override = null;
		let shown = null;

		for (const type of ['online', 'offline']) window.addEventListener(type, render);
		recheck?.addEventListener('click', () => {
			recheck.disabled = true;
			if (note) note.textContent = 'Checking…';
			setTimeout(finishRecheck, 900);
		});

		panel.basaltOffline = {
			/** Pretends to be offline (true) or online (false); null follows the browser again. */
			force(state) {
				override = state;
				render();
			},
			isOffline,
		};
		render();

		function isOffline() {
			return override === null ? !navigator.onLine : override;
		}

		function render() {
			const offline = isOffline();
			if (whenOffline) whenOffline.hidden = !offline;
			if (whenOnline) whenOnline.hidden = offline;
			if (shown !== null && shown !== offline) {
				panel.dispatchEvent(new CustomEvent(offline ? 'basalt:offline' : 'basalt:online', { bubbles: true }));
			}
			shown = offline;
		}

		function finishRecheck() {
			recheck.disabled = false;
			render();
			if (!isOffline() || !note) return;
			const at = new Date();
			const minutes = String(at.getMinutes()).padStart(2, '0');
			note.textContent = `Still offline. Checked at ${at.getHours()}:${minutes}`;
			panel.dispatchEvent(new CustomEvent('basalt:offline-checked', { bubbles: true }));
		}
	}

	/* Draw-in picture: [data-basalt-empty-animate] plays its drawing once,
     the first time half of it is in view. With reduced motion, or no
     IntersectionObserver, it simply starts out drawn. */
	function mountDrawIn(picture) {
		if (!claim(picture, 'basaltAnimateReady')) return;
		if (prefersStill() || !('IntersectionObserver' in window)) return;
		picture.classList.add('is-armed');
		const watcher = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;
				picture.classList.add('is-in');
				watcher.disconnect();
			},
			{ threshold: 0.5 },
		);
		watcher.observe(picture);
	}

	start();
})();
