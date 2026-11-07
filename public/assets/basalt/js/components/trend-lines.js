/**
 * Component script for trend lines and spark readouts. It loads after assets/basalt/js/basalt.js, and
 * only on the pages that use it; documentation.html#page-map lists them.
 */

/**
 * Trend lines for figure tiles, as on social-dashboard.html and the Blog.
 * window.Basalt.trendline(holder, values, options) draws a smooth line
 * with a soft fill under it and a dot on the latest value. Pointing along
 * it, or the arrow keys once it has focus, read each point out:
 *   labels    what each point is, e.g. "Week of Sep 27"
 *   format    turns a value into the text shown for it
 *   name      opens the description screen readers hear
 *   onRead    called with (index, value, label) as a point is read, and
 *             with (null) when reading stops; given it, the page shows
 *             the reading itself and the bubble over the line stays away
 * Drawing again into the same holder replaces the line.
 */
(() => {
	'use strict';
	const HIGH = 40;
	let made = 0;

	function draw(holder, values, options = {}) {
		if (!holder || values.length < 2) return;
		const { labels = [], format = String, name = 'Trend', onRead } = options;
		const low = Math.min(...values);
		const range = Math.max(...values) - low || 1;
		const points = values.map((value, at) => [(at / (values.length - 1)) * 100, 34 - ((value - low) / range) * 28]);
		const line = smoothPath(points);
		const fill = `fill-${(made += 1)}`;
		const [endX, endY] = points.at(-1);
		holder.classList.add('basalt-trendline');
		holder.classList.toggle('has-own-readout', Boolean(onRead));
		holder.tabIndex = 0;
		holder.setAttribute('role', 'group');
		holder.setAttribute('aria-roledescription', 'chart');
		holder.setAttribute(
			'aria-label',
			`${name}: from ${format(values[0])} to ${format(values.at(-1))}. Use the arrow keys to read each point.`,
		);
		holder.innerHTML = `<svg viewBox="0 0 100 ${HIGH}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${fill}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity="0.26"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs><path class="basalt-trendline-fill" d="${line} L100,${HIGH} L0,${HIGH} Z" fill="url(#${fill})"/><path class="basalt-trendline-line" d="${line}"/></svg><span class="basalt-trendline-end" style="left: ${endX}%; top: ${(endY / HIGH) * 100}%" aria-hidden="true"></span><span class="basalt-trendline-guide" aria-hidden="true"></span><span class="basalt-trendline-dot" aria-hidden="true"></span><span class="basalt-trendline-tip" aria-hidden="true"><strong></strong><span></span></span><span class="visually-hidden" aria-live="polite"></span>`;
		const guide = holder.querySelector('.basalt-trendline-guide');
		const dot = holder.querySelector('.basalt-trendline-dot');
		const tip = holder.querySelector('.basalt-trendline-tip');
		const spoken = holder.querySelector('[aria-live]');
		let current = -1;

		function show(at) {
			current = Math.max(0, Math.min(values.length - 1, at));
			const [x, y] = points[current];
			holder.classList.add('is-reading');
			guide.style.left = `${x}%`;
			dot.style.left = `${x}%`;
			dot.style.top = `${(y / HIGH) * 100}%`;
			tip.style.left = `${x}%`;
			tip.dataset.side = x < 18 ? 'start' : x > 82 ? 'end' : 'middle';
			tip.firstChild.textContent = format(values[current]);
			tip.lastChild.textContent = labels[current] || '';
			spoken.textContent = `${labels[current] ? `${labels[current]}: ` : ''}${format(values[current])}`;
			onRead?.(current, values[current], labels[current] || '');
		}

		function hide() {
			if (current < 0) return;
			current = -1;
			holder.classList.remove('is-reading');
			onRead?.(null);
		}

		holder.onpointermove = (event) => {
			const box = holder.getBoundingClientRect();
			show(Math.round(((event.clientX - box.left) / box.width) * (values.length - 1)));
		};
		holder.onpointerleave = hide;
		holder.onblur = hide;
		holder.onkeydown = (event) => {
			const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -values.length, End: values.length };
			if (!(event.key in moves)) return;
			event.preventDefault();
			show(current < 0 ? values.length - 1 : current + moves[event.key]);
		};
	}

	/** A curve through every point that never swings past its neighbors. */
	function smoothPath(points) {
		let path = `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`;
		for (let at = 0; at < points.length - 1; at += 1) {
			const [x0, y0] = points[Math.max(0, at - 1)];
			const [x1, y1] = points[at];
			const [x2, y2] = points[at + 1];
			const [x3, y3] = points[Math.min(points.length - 1, at + 2)];
			const between = (value, a, b) => Math.min(Math.max(value, Math.min(a, b)), Math.max(a, b));
			const c1y = between(y1 + (y2 - y0) / 6, y1, y2);
			const c2y = between(y2 - (y3 - y1) / 6, y1, y2);
			path += ` C${(x1 + (x2 - x0) / 6).toFixed(2)},${c1y.toFixed(2)} ${(x2 - (x3 - x1) / 6).toFixed(2)},${c2y.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}`;
		}
		return path;
	}

	window.Basalt.trendline = draw;
})();

/**
 * Readouts for Chart.js spark lines under a headline figure. Spread
 * window.Basalt.sparkReadout(options) into a spark chart's options and
 * pointing along the line shows that point in the card: the figure takes
 * the point's value and the note under it says which point it is; leaving
 * the line puts both back.
 *   value   the element holding the headline figure
 *   note    the element under it (its markup is restored on leave)
 *   labels  what each point is, e.g. "Week of Sep 27"
 *   format  turns a point's value into the figure's text
 */
(() => {
	'use strict';

	function readout({ value, note, labels = [], format = String }) {
		let resting = null;
		const restore = (chart) => {
			if (!resting) return;
			value.textContent = resting[0];
			if (note) note.innerHTML = resting[1];
			resting = null;
			chart.canvas.style.cursor = '';
		};
		return {
			events: ['mousemove', 'mouseout', 'touchstart', 'touchmove'],
			interaction: { mode: 'index', intersect: false },
			onHover(event, active, chart) {
				if (!value) return;
				if (!active.length || event.type === 'mouseout') {
					restore(chart);
					return;
				}
				if (!resting) {
					resting = [value.textContent, note ? note.innerHTML : ''];
					chart.canvas.addEventListener('mouseleave', () => restore(chart), { once: true });
				}
				const at = active[0].index;
				const point = chart.data.datasets[0].data[at];
				if (point == null) return;
				value.textContent = format(point);
				if (note) note.textContent = labels[at] ?? '';
				chart.canvas.style.cursor = 'crosshair';
			},
		};
	}

	window.Basalt.sparkReadout = readout;
})();
