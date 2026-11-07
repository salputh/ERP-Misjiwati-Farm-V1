/**
 * Vitals strip: a Healthcare page header that reads like a bedside
 * monitor. One deep panel in the palette's primary, up to four live
 * readings in large light type, and the day's heartbeat running along
 * its foot. Any page can use it with its own readings; everything it
 * shows comes from data-* attributes:
 *
 *   <section class="hc-vstrip" data-hc-vstrip aria-label="..."
 *            data-beat="4,6,7,7,7,6,3"   arrivals per step so far
 *            data-beat-from="8" data-beat-to="18" data-beat-step="0.5"
 *            data-beat-now="11.33">       hours, 24-hour clock
 *     <p class="hc-vstrip-title">Right now, 11:20</p>
 *     <dl class="hc-vstrip-reads">
 *       <div data-vstrip-read data-value="41" data-of="86" data-label="arrived" data-tone="success"></div>
 *       <div data-vstrip-read data-value="11" data-unit="min" data-label="average wait" data-tone="warning"></div>
 *       <div data-vstrip-read data-prefix="$" data-value="172.5" data-unit="k" data-label="collected"></div>
 *     </dl>
 *   </section>
 *
 * data-hint, when set, explains the reading in a hint beside its label.
 * data-tone is a palette token: success, warning, danger, info, hue or
 * series-1 to series-8. Hovering or focusing a reading fires
 * "hc-vstrip-focus" on the strip with detail.index (-1 when it leaves),
 * so a page can light the matching chart. Figures count up and the beat
 * fades in once Basalt.settled has resolved and the strip is in view.
 * window.Basalt.vitalsStrip(strip) draws one strip again after its data changes.
 */
(() => {
	'use strict';

	const still = window.matchMedia('(prefers-reduced-motion: reduce)');
	const settled = (window.Basalt && window.Basalt.settled) || Promise.resolve();
	const TOKENS = /^(success|warning|danger|info|hue|series-[1-8])$/;

	function start() {
		for (const strip of document.querySelectorAll('[data-hc-vstrip]')) draw(strip);
	}

	/** Writes the strip's readings and beat from its attributes, then plays them in. */
	function draw(strip) {
		const title = strip.querySelector('.hc-vstrip-title');
		if (title && !title.querySelector('.hc-vstrip-live'))
			title.insertAdjacentHTML('afterbegin', '<span class="hc-vstrip-live" aria-hidden="true"></span>');
		const reads = [...strip.querySelectorAll('[data-vstrip-read]')];
		reads.forEach((read, i) => {
			const d = read.dataset;
			const value = Number(d.value);
			const extra = d.of ? `of ${fmt(Number(d.of))}` : d.unit || '';
			read.className = 'hc-vstrip-read';
			read.tabIndex = 0;
			if (TOKENS.test(d.tone || '')) read.style.setProperty('--tone', `var(--basalt-${d.tone})`);
			read.innerHTML = `
				<dt${d.hint ? ` data-basalt-hint="${d.hint.replace(/"/g, '&quot;')}"` : ''}><span class="hc-vstrip-mark" aria-hidden="true"></span>${d.label || ''}</dt>
				<dd>${d.prefix ? `<span class="hc-vstrip-num">${d.prefix}</span>` : ''}<span data-vstrip-num class="hc-vstrip-num">${fmt(value)}</span>${extra ? `<small>${extra}</small>` : ''}</dd>`;
			const say = (index) => strip.dispatchEvent(new CustomEvent('hc-vstrip-focus', { detail: { index } }));
			read.onpointerenter = read.onfocus = () => say(i);
			read.onpointerleave = read.onblur = () => say(-1);
		});
		drawBeat(strip);
		play(strip);
	}

	/** The arrivals as a heartbeat along the foot of the panel: a beat per
	 * step, as tall as that step's count; flat and faint after now. */
	function drawBeat(strip) {
		let svg = strip.querySelector('.hc-vstrip-beat');
		const counts = (strip.dataset.beat || '').split(',').filter(Boolean).map(Number);
		if (!counts.length) {
			svg?.remove();
			return;
		}
		if (!svg) {
			strip.insertAdjacentHTML(
				'afterbegin',
				'<svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true" class="hc-vstrip-beat"></svg>',
			);
			svg = strip.querySelector('.hc-vstrip-beat');
		}
		const from = Number(strip.dataset.beatFrom || 0);
		const to = Number(strip.dataset.beatTo || 24);
		const step = Number(strip.dataset.beatStep || 1);
		const now = Number(strip.dataset.beatNow || from + counts.length * step);
		const top = Math.max(...counts, 1);
		const x = (t) => ((t - from) / (to - from)) * 1000;
		const w = Math.min(14, (1000 / ((to - from) / step)) * 0.3);
		const base = 86;
		let d = `M0,${base}`;
		counts.forEach((c, i) => {
			const cx = x(from + (i + 0.5) * step);
			const peak = base - 6 - (c / top) * 78;
			d += ` L${(cx - w).toFixed(1)},${base} L${(cx - w / 2).toFixed(1)},${base + 5} L${cx.toFixed(1)},${peak.toFixed(1)} L${(cx + w / 2).toFixed(1)},${base + 9} L${(cx + w).toFixed(1)},${base}`;
		});
		const n = x(now).toFixed(1);
		d += ` L${n},${base}`;
		svg.innerHTML = `
			<path d="${d}" vector-effect="non-scaling-stroke" class="hc-vstrip-past" />
			<path d="M${n},${base} L1000,${base}" vector-effect="non-scaling-stroke" class="hc-vstrip-future" />`;
	}

	/** Holds the strip on zero, then counts and fades in once the page has
	 * settled and the strip is on screen. */
	function play(strip) {
		const nums = [...strip.querySelectorAll('[data-vstrip-num]')];
		if (still.matches) return;
		strip.classList.add('is-held');
		for (const n of nums) n.textContent = '0';
		settled.then(() =>
			onSight(strip, () => {
				requestAnimationFrame(() => strip.classList.remove('is-held'));
				/* A strip drawn again since keeps only its new figures. */
				for (const n of nums) if (n.isConnected) tween(n, Number(n.closest('[data-value]').dataset.value));
			}),
		);
	}

	function tween(n, to) {
		const began = performance.now();
		const step = (now) => {
			const t = Math.min(1, (now - began) / 800);
			const at = to * (1 - Math.pow(1 - t, 3));
			n.textContent = fmt(t < 1 ? (Number.isInteger(to) ? Math.round(at) : Math.round(at * 10) / 10) : to);
			if (t < 1 && n.isConnected) requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	}

	function onSight(el, run) {
		if (!window.IntersectionObserver) {
			run();
			return;
		}
		const sight = new IntersectionObserver((entries) => {
			if (!entries.some((entry) => entry.isIntersecting)) return;
			sight.disconnect();
			run();
		});
		sight.observe(el);
	}

	function fmt(value) {
		return Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 });
	}

	window.Basalt = window.Basalt || {};
	window.Basalt.vitalsStrip = draw;
	start();
})();
