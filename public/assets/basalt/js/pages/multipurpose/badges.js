/**
 * Basalt - Badges page
 * The page's filter chips, copy buttons and demos. The badge
 * behavior it shows ([data-basalt-removables],
 * [data-basalt-status-menu], window.Basalt.count) lives in
 * basalt.js. Plain ES6, no libraries.
 */
(() => {
	'use strict';
	/* Page only */
	const page = pick('[data-bdg-root]', document);
	if (!page) return;

	function start() {
		for (const btn of pickAll('[data-bdg-copy]')) {
			btn.addEventListener('click', () => {
				const pre = pick('pre', btn.parentElement);
				if (!pre) return;
				copyText(pre.textContent.trim()).then(() => {
					const icon = pick('.bi', btn);
					btn.lastChild.textContent = ' Copied';
					if (icon) icon.className = 'bi bi-check2';
					clearTimeout(btn._bdgTimer);
					btn._bdgTimer = setTimeout(() => {
						btn.lastChild.textContent = ' Copy';
						if (icon) icon.className = 'bi bi-clipboard';
					}, 1800);
				});
			});
		}

		/* Removable badge demo */
		(function removables() {
			const root = pick('[data-basalt-removables]');
			if (!root) return;
			const status = pick('[data-bdg-rm-status]', root);
			/* Fewer filters, more visits: a made-up count for the demo. */
			const shown = [48, 31, 19, 12, 7, 4];
			root.addEventListener('basalt:removableschange', (e) => {
				const n = e.detail.items.length;
				if (status) status.textContent = n ? `Showing ${shown[n]} of 48 visits` : 'Showing all 48 visits';
			});
		})();

		/* Counter demo */
		(function counters() {
			const root = pick('[data-bdg-counter]');
			if (!root) return;
			const counts = { bell: 3, chat: 12, bag: 1 };

			function badge(k) {
				return pick(`[data-bdg-count-for="${k}"]`, root);
			}

			function render() {
				for (const k of Object.keys(counts)) {
					const el = badge(k);
					Basalt.count(el, counts[k]);
					const btn = pick('[data-bdg-count-btn]', el.parentElement);
					const n = counts[k];
					const unit = btn.dataset.bdgCountUnit;
					const words = unit === 'item' ? plural(n, 'item', 'items') : n ? `${n} ${unit}` : 'all read';
					btn.setAttribute('aria-label', `${btn.dataset.bdgCountBtn}, ${words}`);
				}
			}

			for (const b of pickAll('[data-bdg-count-add]', root)) {
				b.addEventListener('click', () => {
					const n = parseInt(b.dataset.bdgCountAdd, 10);
					counts.bell += n;
					counts.chat += n > 1 ? n : 0;
					counts.bag += 1;
					render();
				});
			}

			const clear = pick('[data-bdg-count-clear]', root);
			if (clear)
				clear.addEventListener('click', () => {
					counts.bell = 0;
					counts.chat = 0;
					render();
				});

			/* The icon buttons themselves read their count, like opening the panel would. */
			for (const b of pickAll('[data-bdg-count-btn]', root)) {
				b.addEventListener('click', () => {
					const key = pick('.basalt-count', b.parentElement).dataset.bdgCountFor;
					if (key !== 'bag') {
						counts[key] = 0;
						render();
					}
				});
			}

			render();
		})();

		/* Toggle badge demo */
		(function toggles() {
			const root = pick('[data-bdg-toggles]');
			if (!root) return;
			const btns = pickAll('.basalt-badge-toggle', root);
			const items = pickAll('[data-type]', root);
			const count = pick('[data-bdg-toggle-count]', root);
			function apply() {
				const on = btns.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.bdgType);
				let n = 0;

				for (const li of items) {
					const show = !on.length || on.includes(li.dataset.type);
					li.hidden = !show;
					if (show) n++;
				}

				if (count) count.textContent = plural(n, 'product', 'products') + (on.length ? ' shown' : '');
			}

			for (const b of btns) {
				b.addEventListener('click', () => {
					b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
					apply();
				});
			}

			apply();
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
		const grid = pick('[data-bdg-grid]');
		const count = pick('[data-bdg-count]');
		if (!grid) return;
		const cards = pickAll('.bdg-card', grid);
		function apply(group) {
			const shown = [];

			for (const card of cards) {
				const groups = (card.getAttribute('data-bdg-groups') || '').split(/\s+/);
				const on = group === 'all' || groups.includes(group);
				card.classList.toggle('is-hidden', !on);
				card.classList.remove('is-alone');
				if (on) shown.push(card);
			}

			/* Half-width cards pair up between the full-width ones; an odd one
         out at the end of a run takes the whole row. */
			let run = [];
			function close() {
				if (run.length % 2) run[run.length - 1].classList.add('is-alone');
				run = [];
			}

			for (const c of shown) {
				if (c.classList.contains('bdg-card-full')) close();
				else run.push(c);
			}

			close();
			if (count) count.textContent = plural(shown.length, 'badge type', 'badge types');
		}

		for (const btn of pickAll('[data-bdg-filter]')) {
			btn.addEventListener('click', () => {
				for (const b of pickAll('[data-bdg-filter]')) {
					b.setAttribute('aria-pressed', String(b === btn));
				}

				apply(btn.getAttribute('data-bdg-filter'));
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
