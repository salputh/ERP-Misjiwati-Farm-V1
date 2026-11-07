/**
 * Basalt - Breadcrumbs page
 * Filter chips, copy buttons and the "Fold again" button on
 * the collapsed trail. The breadcrumb behavior itself (the
 * collapsed trail) lives in basalt.js. Plain ES6, no
 * libraries.
 */

/* PAGE - the Breadcrumbs demo page */
(() => {
	'use strict';
	const page = pick('[data-bc-root]', document);
	if (!page) return;

	function start() {
		for (const btn of pickAll('[data-bc-copy]')) {
			btn.addEventListener('click', () => {
				const pre = pick('pre', btn.parentElement);
				if (!pre) return;
				copyText(pre.textContent.trim()).then(() => {
					const icon = pick('.bi', btn);
					btn.lastChild.textContent = ' Copied';
					if (icon) icon.className = 'bi bi-check2';
					clearTimeout(btn._bcTimer);
					btn._bcTimer = setTimeout(() => {
						btn.lastChild.textContent = ' Copy';
						if (icon) icon.className = 'bi bi-clipboard';
					}, 1800);
				});
			});
		}

		/* Collapsed trail: fold it again
		   Opening the trail removes its "…" button. Folding again puts
		   back a fresh copy of the trail and lets basalt.js fold it. */
		(function refold() {
			const holder = pick('[data-bc-collapse]');
			const btn = pick('[data-bc-refold]');
			if (!holder || !btn) return;
			/* Every trail as written, before basalt.js folded it. */
			const fresh = Array.from(pickAll('nav', holder)).map((nav) => {
				const c = nav.cloneNode(true);

				for (const b of pickAll('.basalt-breadcrumb-more', c)) {
					b.closest('li').remove();
				}

				for (const li of pickAll('.is-folded', c)) {
					li.classList.remove('is-folded');
				}

				return c;
			});
			holder.addEventListener('basalt:breadcrumbopen', () => {
				btn.hidden = false;
			});
			btn.addEventListener('click', () => {
				holder.replaceChildren(...fresh.map((n) => n.cloneNode(true)));
				if (window.Basalt.text) window.Basalt.text(holder);
				btn.hidden = true;
				const more = pick('.basalt-breadcrumb-more', holder);
				if (more) more.focus();
			});
		})();

		/* Compact trail: the width slider */
		(function resize() {
			const range = pick('[data-bc-width]');
			const out = pick('[data-bc-width-out]');
			const frame = pick('[data-bc-frame]');
			if (!range || !frame) return;

			/* The slider never goes past the room the card has, so the
	       number beside it is always the width you see. */
			function fit() {
				const box = frame.parentElement;
				const cs = getComputedStyle(box);
				const inner = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
				const room = Math.floor(inner / 10) * 10;
				const max = Math.max(Number(range.min), Math.min(720, room));
				range.max = String(max);
				if (Number(range.value) > max) range.value = String(max);
			}

			function set() {
				frame.style.width = `${range.value}px`;
				out.textContent = `${range.value}px`;
			}

			range.addEventListener('input', set);
			window.addEventListener('resize', () => {
				fit();
				set();
			});
			fit();
			set();
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
		const grid = pick('[data-bc-grid]');
		const count = pick('[data-bc-count]');
		if (!grid) return;
		const cards = pickAll('.bc-card', grid);
		function apply(group) {
			const shown = [];

			for (const card of cards) {
				const on = group === 'all' || card.getAttribute('data-bc-group') === group;
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
				if (c.classList.contains('bc-card-full')) close();
				else run.push(c);
			}

			close();
			if (count) count.textContent = plural(shown.length, 'breadcrumb type', 'breadcrumb types');
		}

		for (const btn of pickAll('[data-bc-filter]')) {
			btn.addEventListener('click', () => {
				for (const b of pickAll('[data-bc-filter]')) {
					b.setAttribute('aria-pressed', String(b === btn));
				}

				apply(btn.getAttribute('data-bc-filter'));
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
