/**
 * Basalt - Slideshow page
 * Filter chips and copy buttons. The slideshow itself
 * ([data-basalt-slides] and window.Basalt.slides) lives in basalt.js.
 * Plain ES6, no libraries.
 */
(() => {
	'use strict';
	const page = pick('[data-ss-root]', document);
	if (!page) return;

	function start() {
		for (const btn of pickAll('[data-ss-copy]')) {
			btn.addEventListener('click', () => {
				const pre = pick('pre', btn.parentElement);
				if (!pre) return;
				copyText(pre.textContent.trim()).then(() => {
					const icon = pick('.bi', btn);
					btn.lastChild.textContent = ' Copied';
					if (icon) icon.className = 'bi bi-check2';
					clearTimeout(btn._ssTimer);
					btn._ssTimer = setTimeout(() => {
						btn.lastChild.textContent = ' Copy';
						if (icon) icon.className = 'bi bi-clipboard';
					}, 1800);
				});
			});
		}
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
		const grid = pick('[data-ss-grid]');
		const count = pick('[data-ss-count]');
		if (!grid) return;
		const cards = pickAll('.ss-card', grid);
		function apply(group) {
			const shown = [];

			for (const card of cards) {
				const on = group === 'all' || card.getAttribute('data-ss-group') === group;
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
				if (c.classList.contains('ss-card-full')) close();
				else run.push(c);
			}

			close();
			if (count) count.textContent = plural(shown.length, 'slideshow type', 'slideshow types');
		}

		for (const btn of pickAll('[data-ss-filter]')) {
			btn.addEventListener('click', () => {
				for (const b of pickAll('[data-ss-filter]')) {
					b.setAttribute('aria-pressed', String(b === btn));
				}

				apply(btn.getAttribute('data-ss-filter'));
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
