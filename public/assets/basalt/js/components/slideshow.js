/**
 * Component script for slideshows. It loads after assets/basalt/js/basalt.js, and
 * only on the pages that use it; documentation.html#page-map lists them.
 */

/**
 * Slideshows, as shown on slideshow.html. [data-basalt-slides] wraps a
 * .basalt-slides-track of .basalt-slides-item slides; the track scrolls
 * and snaps, so swiping needs no script. Inside it, any of these work:
 *   [data-basalt-slides-prev] / [data-basalt-slides-next]   step one slide,
 *       wrapping round at the ends
 *   [data-basalt-slides-dots]    filled with a dot per position
 *   [data-basalt-slides-count]   shows "2 / 5"
 *   [data-basalt-slides-go="2"]  jumps to that slide (thumbnails)
 *   [data-basalt-slides-progress]   fills while it waits to move on
 * data-basalt-slides-auto="6000" moves on by itself every 6 seconds,
 * pausing while pointed at, focused or out of sight, and never for
 * readers who ask for less motion. Arrow keys step while focus is inside.
 * Fires 'basalt:slide' with { index, count } when the slide changes.
 * window.Basalt.slides(root) wires slideshows added later.
 */
(() => {
	'use strict';
	const wired = new WeakSet();
	const still = window.matchMedia('(prefers-reduced-motion: reduce)');

	function wire(root) {
		if (wired.has(root)) return;
		wired.add(root);
		const track = root.querySelector('.basalt-slides-track');
		if (!track) return;
		const slides = [...track.children];
		const dotsBox = root.querySelector('[data-basalt-slides-dots]');
		const countBox = root.querySelector('[data-basalt-slides-count]');
		const progress = root.querySelector('[data-basalt-slides-progress]');
		const wait = Number(root.getAttribute('data-basalt-slides-auto')) || 0;
		let current = -1;
		let timer = null;
		let held = false;

		for (const [at, slide] of slides.entries()) {
			slide.setAttribute('role', 'group');
			slide.setAttribute('aria-roledescription', 'slide');
			slide.setAttribute('aria-label', `${at + 1} of ${slides.length}`);
		}

		/* How many slides show at once, and so how many places there are to be. */
		function places() {
			const step = slides[1] ? slides[1].offsetLeft - slides[0].offsetLeft : track.clientWidth;
			const shown = Math.max(1, Math.round((track.clientWidth + 1) / step));
			return Math.max(1, slides.length - shown + 1);
		}

		function place() {
			const step = slides[1] ? slides[1].offsetLeft - slides[0].offsetLeft : track.clientWidth || 1;
			return Math.min(places() - 1, Math.round(track.scrollLeft / step));
		}

		function goTo(index) {
			const count = places();
			const target = (index + count) % count;
			track.scrollTo({ left: slides[target].offsetLeft - slides[0].offsetLeft });
		}

		function drawDots() {
			if (dotsBox) {
				const count = places();
				dotsBox.innerHTML = Array.from(
					{ length: count },
					(_, at) =>
						`<button type="button" class="basalt-slides-dot" aria-label="Go to ${at + 1} of ${count}" data-basalt-slides-go="${at}"></button>`,
				).join('');
			}
			current = -1;
			settle();
		}

		/* Marks the place reached: dots, count, thumbnails and the event. */
		function settle() {
			const now = place();
			if (now === current) return;
			current = now;
			const count = places();
			for (const go of root.querySelectorAll('[data-basalt-slides-go]')) {
				if (Number(go.dataset.basaltSlidesGo) === now) go.setAttribute('aria-current', 'true');
				else go.removeAttribute('aria-current');
			}
			if (countBox) countBox.textContent = `${now + 1} / ${count}`;
			root.dispatchEvent(new CustomEvent('basalt:slide', { bubbles: true, detail: { index: now, count } }));
			restart();
		}

		function restart() {
			if (!wait || still.matches) return;
			clearTimeout(timer);
			if (progress) {
				progress.classList.remove('is-running');
				void progress.offsetWidth;
				progress.classList.add('is-running');
			}
			if (!held) timer = setTimeout(() => goTo(current + 1), wait);
		}

		function hold(on) {
			held = on;
			progress?.classList.toggle('is-paused', on);
			if (on) clearTimeout(timer);
			else restart();
		}

		let frame = 0;
		track.addEventListener('scroll', () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(settle);
		});
		root.addEventListener('click', (event) => {
			const hit = event.target.closest(
				'[data-basalt-slides-prev], [data-basalt-slides-next], [data-basalt-slides-go]',
			);
			if (!hit) return;
			if (hit.hasAttribute('data-basalt-slides-go')) goTo(Number(hit.dataset.basaltSlidesGo));
			else goTo(current + (hit.hasAttribute('data-basalt-slides-next') ? 1 : -1));
		});
		root.addEventListener('keydown', (event) => {
			if (event.target.closest('input, textarea, select')) return;
			const way = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
			if (!way) return;
			event.preventDefault();
			goTo(current + way);
		});
		if (wait) {
			if (progress) progress.style.setProperty('--basalt-slides-wait', `${wait}ms`);
			root.addEventListener('pointerenter', () => hold(true));
			root.addEventListener('pointerleave', () => hold(false));
			root.addEventListener('focusin', () => hold(true));
			root.addEventListener('focusout', (event) => {
				if (!root.contains(event.relatedTarget)) hold(false);
			});
			document.addEventListener('visibilitychange', () => hold(document.hidden));
		}
		new ResizeObserver(() => requestAnimationFrame(drawDots)).observe(track);
		drawDots();
	}

	function wireAll(scope = document) {
		for (const root of scope.querySelectorAll('[data-basalt-slides]')) wire(root);
	}

	window.Basalt.slides = wireAll;
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => wireAll());
	else wireAll();
})();
