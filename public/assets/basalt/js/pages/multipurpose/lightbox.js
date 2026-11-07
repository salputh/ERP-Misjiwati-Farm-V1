/**
 * Basalt - Lightbox page
 * Filter chips, copy buttons and the "Open from code"
 * example. The lightbox itself (window.Basalt.lightbox and
 * [data-basalt-lightbox]) lives in basalt.js. Plain ES6, no
 * libraries.
 */

/* PAGE - the Lightbox demo page */
(() => {
	'use strict';
	const page = pick('[data-lb-root]', document);
	if (!page) return;

	function start() {
		for (const btn of pickAll('[data-lb-copy]')) {
			btn.addEventListener('click', () => {
				const pre = pick('pre', btn.parentElement);
				if (!pre) return;
				copyText(pre.textContent.trim()).then(() => {
					const icon = pick('.bi', btn);
					btn.lastChild.textContent = ' Copied';
					if (icon) icon.className = 'bi bi-check2';
					clearTimeout(btn._lbTimer);
					btn._lbTimer = setTimeout(() => {
						btn.lastChild.textContent = ' Copy';
						if (icon) icon.className = 'bi bi-clipboard';
					}, 1800);
				});
			});
		}

		/* Open from code */
		(function tour() {
			const btn = pick('[data-lb-tour]');
			const seen = pick('[data-lb-seen]');
			if (!btn || !window.Basalt.lightbox) return;

			function photo(id, h) {
				return window.Basalt.photo(id, 1600, h);
			}

			const SCREENS = [
				{
					src: photo('assets/basalt/images/multipurpose/lunch-break.svg', 1067),
					title: 'Lunch on the route',
					caption: 'Travel Planner leaves room for lunch',
					alt: 'A lunch box and a flask on the passenger seat of a van',
				},
				{
					src: photo('assets/basalt/images/multipurpose/offline-mode.svg', 1066),
					title: 'Offline mode',
					caption: 'The app keeps working without signal',
					alt: 'A phone on a fence post above the hills, a work bag at its foot',
				},
				{
					src: photo('assets/basalt/images/multipurpose/two-hour-windows.svg', 1067),
					title: 'Arrival windows',
					caption: 'Two hours, set for every visit',
					alt: 'A white clock with a violet wedge over two hours',
				},
			];
			let watching = false;
			btn.addEventListener('click', () => {
				window.Basalt.lightbox.open(SCREENS, 0);
				if (watching) return;
				watching = true;
				/* The viewer says which screen it shows; the line under the button follows. */
				document.addEventListener('basalt:lightbox', (e) => {
					const i = SCREENS.indexOf(e.detail.item);
					if (i !== -1 && seen)
						seen.textContent = `Last shown: ${e.detail.item.title}, ${i + 1} of ${SCREENS.length}.`;
				});
			});
		})();
	}

	function pick(selector, scope = page) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = page) {
		return [...scope.querySelectorAll(selector)];
	}

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many}`;
	}

	/* Filter chips */
	(function filters() {
		const grid = pick('[data-lb-grid]');
		const count = pick('[data-lb-count]');
		if (!grid) return;
		const cards = pickAll('.lb-card', grid);
		function apply(group) {
			const shown = [];

			for (const card of cards) {
				const on = group === 'all' || card.getAttribute('data-lb-group') === group;
				card.classList.toggle('is-hidden', !on);
				card.classList.remove('is-alone');
				if (on) shown.push(card);
			}

			/* A card left without a partner in its row takes the full width. */
			let run = [];
			function close() {
				if (run.length % 2) run[run.length - 1].classList.add('is-alone');
				run = [];
			}

			for (const c of shown) {
				if (c.classList.contains('lb-card-full')) close();
				else run.push(c);
			}

			close();
			if (count) count.textContent = plural(shown.length, 'lightbox type', 'lightbox types');
		}

		for (const btn of pickAll('[data-lb-filter]')) {
			btn.addEventListener('click', () => {
				for (const b of pickAll('[data-lb-filter]')) {
					b.setAttribute('aria-pressed', String(b === btn));
				}

				apply(btn.getAttribute('data-lb-filter'));
			});
		}

		apply('all');
	})();

	/* Copy buttons */
	function copyText(text) {
		return window.Basalt.copyText(text);
	}

	start();
})();
