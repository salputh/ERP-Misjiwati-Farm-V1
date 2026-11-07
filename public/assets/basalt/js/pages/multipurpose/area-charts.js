/**
 * Area chart gallery (area-charts.html, the element marked
 * [data-areas-root]).
 *
 * Sixteen Chart.js canvases across thirteen area-chart styles. Each one
 * is drawn the first time it scrolls near the viewport, with colors read
 * fresh from the --basalt-* tokens, and redrawn whenever basalt:appearance
 * fires so palette, light or dark mode, background and Flat all carry
 * through. The chips at the top narrow the gallery to one style.
 */
(() => {
	'use strict';

	const gallery = pick('[data-areas-root]');
	if (!gallery || typeof Chart === 'undefined') return;

	const html = document.documentElement;
	const stillMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const TYPE = "'Schibsted Grotesk', sans-serif";

	/* Sample figures for Fieldline, seen from several sides. Revenue is in
     $k, and the monthly sums behind the stacked chart are the very ones
     the basic and year-over-year charts plot. */
	const FIGURES = {
		trailingMonths: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
		months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
		categories: [
			['Basic', [128, 130, 131, 133, 135, 137, 139, 141, 143, 145, 148, 150]],
			['Pro', [262, 268, 275, 281, 288, 295, 302, 309, 316, 324, 332, 340]],
			['Max', [205, 212, 220, 226, 233, 241, 248, 256, 264, 273, 281, 290]],
			['Add-ons', [62, 65, 68, 71, 74, 77, 80, 84, 88, 92, 96, 100]],
		],
		/* Orders per channel, with the series color slot last. The shares
       run from 46/30/14/10 at the start to 36/25/27/12 at the end. */
		channels: [
			['Search', [230, 236, 262, 214, 222, 231, 226, 238, 237, 240, 246, 252], 0],
			['Direct', [150, 152, 170, 139, 144, 150, 148, 154, 158, 162, 168, 175], 4],
			['Email', [70, 82, 104, 84, 96, 110, 118, 132, 146, 158, 172, 189], 2],
			['Social', [50, 52, 60, 48, 52, 58, 60, 64, 70, 74, 78, 84], 7],
		],
		lastYear: [520, 535, 549, 563, 578, 592, 606, 620, 638, 657, 675, 694],
		sparks: {
			accounts: [
				[2018, 2027, 2036, 2049, 2058, 2069, 2080, 2091, 2103, 2116, 2127, 2140],
				0,
				(v) => v.toLocaleString(),
			],
			jobs: [[36.2, 37.0, 37.4, 38.1, 37.6, 38.8, 39.0, 39.6, 39.1, 40.2, 40.5, 41.2], 1, (v) => `${v}k visits`],
			churn: [[1.5, 1.6, 1.7, 1.6, 1.5, 1.4, 1.4, 1.3, 1.3, 1.2, 1.2, 1.1], 2, (v) => `${v}%`],
			arpa: [[396, 397, 398, 400, 401, 402, 403, 405, 406, 408, 409, 411], 3, (v) => `$${v}`],
		},
		net: [2.4, 3.1, 1.8, -0.9, 2.7, 3.4, -3.8, 1.2, 2.9, 3.6, -1.4, 2.2, 4.1, 3.3, 2.8, 4.6],
		/* Hours from order to dispatch: best, usual and worst case per day. */
		fastest: [1.5, 2, 1, 1.5, 2.5, 3, 2, 1.5, 1, 2, 2, 2.5, 3, 2, 1.5, 1, 1.5, 2, 1.5, 1, 1.5],
		typical: [6, 7, 5, 6, 8, 9, 7, 6, 5, 6, 7, 8, 9, 7, 6, 5, 6, 7, 6, 5, 6],
		slowest: [14, 16, 12, 15, 19, 26, 17, 14, 12, 13, 16, 18, 21, 16, 14, 11, 13, 15, 14, 12, 13],
		/* Daily sign-ups for the current month and the one before. */
		thisDaily: [
			6, 8, 7, 9, 5, 4, 8, 10, 9, 11, 7, 6, 9, 12, 10, 8, 11, 9, 7, 10, 13, 11, 9, 12, 10, 8, 11, 12, 9, 10, 11,
		],
		lastDaily: [5, 6, 6, 7, 4, 3, 6, 8, 7, 8, 6, 5, 7, 9, 8, 6, 8, 7, 5, 8, 9, 8, 7, 9, 8, 6, 8, 9, 7, 8, 8],
		stock: [120, 112, 98, 90, 76, 64, 52, 40, 31, 18, 122, 110, 96, 84, 70, 58, 44, 30, 118, 106, 94],
		hours: [
			'7 am',
			'8 am',
			'9 am',
			'10 am',
			'11 am',
			'12 pm',
			'1 pm',
			'2 pm',
			'3 pm',
			'4 pm',
			'5 pm',
			'6 pm',
			'7 pm',
			'8 pm',
			'9 pm',
			'10 pm',
		],
		visitors: [40, 85, 160, 240, 320, 385, 412, 360, 300, 260, 270, 300, 340, 355, 250, 120],
		phone: [2100, 2250, 2380, 2520, 2710, 2800, 2950, 3020, 3180, 3260, 3350, 3480],
		desktop: [2900, 2860, 2780, 2700, 2650, 2600, 2580, 2540, 2500, 2470, 2450, 2420],
	};

	const WEEK_NAMES = Array.from({ length: 12 }, (_, index) => `Week ${index + 1}`);
	const monthlyRevenue = FIGURES.trailingMonths.map((_, month) =>
		FIGURES.categories.reduce((sum, [, values]) => sum + values[month], 0),
	);
	const revenueThisYear = monthlyRevenue.slice(3);

	/* Orders packed per day: Mondays run hot, Sundays quiet, plus a small
     wobble. Built from real dates so weekdays fall on weekdays. */
	const DAILY_LIMIT = 120;
	const WEEKDAY_LOAD = [48, 116, 104, 97, 93, 86, 61];
	const packingDays = recentDays(21);
	const packedPerDay = packingDays.map((day, index) =>
		Math.min(120, Math.round(WEEKDAY_LOAD[day.getDay()] + Math.sin(index * 1.7) * 4)),
	);

	/* Store sessions across four weeks, with the sale in week three. */
	const SALE_START = 14;
	const SALE_END = 20;
	const SALE_BOOST = [520, 840, 1010, 1160, 970, 630, 370];
	const sessionDays = recentDays(28);
	const sessionCounts = sessionDays.map((day, index) => {
		const restDay = day.getDay() === 0 || day.getDay() === 6;
		const usual = (restDay ? 980 : 1320) + Math.round(Math.sin(index * 1.1) * 30);
		return usual + (index >= SALE_START && index <= SALE_END ? SALE_BOOST[index - SALE_START] : 0);
	});

	/* Which recipe serves each data-areas-chart value. */
	const BUILDERS = {
		stacked: stackedConfig,
		share: shareConfig,
		spark: sparkConfig,
		net: netConfig,
		range: rangeConfig,
		cumulative: cumulativeConfig,
		stepped: steppedConfig,
		smooth: smoothConfig,
		limit: limitConfig,
		period: periodConfig,
		overlap: overlapConfig,
		basic: basicConfig,
		yoy: yoyConfig,
	};

	/* Live Chart.js instances, keyed by their canvas. */
	const drawn = new Map();

	/** Draws charts as they near the viewport, redraws them on theme
      changes and binds the filter chips. */
	function start() {
		const targets = [...pickAll('canvas[data-areas-chart]', gallery)];
		if ('IntersectionObserver' in window) {
			const watcher = new IntersectionObserver(
				(sightings) => {
					for (const sighting of sightings) {
						if (!sighting.isIntersecting) continue;
						watcher.unobserve(sighting.target);
						draw(sighting.target, true);
					}
				},
				{ rootMargin: '80px 0px' },
			);
			for (const target of targets) watcher.observe(target);
		} else {
			for (const target of targets) draw(target, false);
		}

		document.addEventListener('basalt:appearance', () => {
			/* The tokens switch with the attribute, so wait a frame to read them. */
			requestAnimationFrame(() => {
				for (const target of drawn.keys()) draw(target, false);
			});
		});

		const chips = pickAll('[data-areas-filter]', gallery);
		for (const chip of chips) {
			chip.addEventListener('click', () => {
				for (const other of chips) other.setAttribute('aria-pressed', String(other === chip));
				showOnly(chip.getAttribute('data-areas-filter'));
			});
		}
	}

	function draw(canvas, animate) {
		const recipe = BUILDERS[canvas.getAttribute('data-areas-chart')];
		if (!recipe) return;
		drawn.get(canvas)?.destroy();
		drawn.set(canvas, new Chart(canvas, recipe(paletteNow(), animate && !stillMotion, canvas)));
	}

	/** Hides every card that is not of the chosen style ("all" keeps all). */
	function showOnly(style) {
		const board = pick('[data-areas-grid]', gallery);
		const tally = pick('[data-areas-count]', gallery);
		let visible = 0;

		for (const card of pickAll('.areas-card', board)) {
			const keep = style === 'all' || card.getAttribute('data-areas-kind') === style;
			card.classList.toggle('is-hidden', !keep);
			if (keep) visible += 1;
		}

		board.classList.toggle('is-filtered', style !== 'all');
		if (tally) tally.textContent = `${visible}${visible === 1 ? ' chart' : ' charts'}`;
	}

	/* Colors. Tokens arrive as #rgb, #rrggbb or rgba(), and Chart.js wants
     strings it can parse itself, so blending happens here rather than
     through CSS color-mix(). */

	function tokenValue(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	function rgbaParts(color) {
		const source = String(color || '').trim();
		const short = /^#([0-9a-f]{3})$/i.exec(source);
		if (short) return [...short[1].split('').map((digit) => parseInt(digit + digit, 16)), 1];
		const long = /^#([0-9a-f]{6})$/i.exec(source);
		if (long) {
			const bits = parseInt(long[1], 16);
			return [(bits >> 16) & 255, (bits >> 8) & 255, bits & 255, 1];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(source);
		if (!functional) return [128, 128, 128, 1];
		const parts = functional[1].split(',').map((part) => parseFloat(part));
		return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
	}

	function fade(color, alpha) {
		const [red, green, blue] = rgbaParts(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	function between(front, back, weight) {
		const near = rgbaParts(front);
		const far = rgbaParts(back);
		const [red, green, blue] = [0, 1, 2].map((i) => Math.round(near[i] * weight + far[i] * (1 - weight)));
		return `rgb(${red}, ${green}, ${blue})`;
	}

	/** Every color a chart needs, read from the live theme. */
	function paletteNow() {
		const ink = tokenValue('--basalt-copy', '#12233a');
		return {
			hues: [1, 2, 3, 4, 5, 6, 7, 8].map((slot) => tokenValue(`--basalt-series-${slot}`, '#2b6fd4')),
			ink,
			/* The same mix as --areas-quiet in area-charts.css: small gray type
         that keeps 4.5:1 on pale palettes. */
			soft: between(tokenValue('--basalt-copy-muted', '#5f7186'), ink, 0.82),
			baseline: fade(ink, 0.22),
			rules: fade(ink, 0.07),
			card: tokenValue('--basalt-plane', '#ffffff'),
			edge: tokenValue('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			good: tokenValue('--basalt-success', '#12c08f'),
			bad: tokenValue('--basalt-danger', '#ef4d63'),
		};
	}

	function isFlat() {
		return html.getAttribute('data-basalt-gradients') === 'off';
	}

	/** The standard area fill: dense under the line, thinning toward the
	    axis. With Flat on it is one even, lighter wash. A second color makes
	    the fill shift into it on the way down. */
	function verticalFade(color, strength, blendInto) {
		const peak = strength || 0.32;
		const stops = [[0, fade(color, peak)]];
		if (blendInto) stops.push([0.6, fade(blendInto, peak * 0.4)]);
		stops.push([1, fade(blendInto || color, 0.02)]);
		return window.Basalt.chartFill(stops, { flat: fade(color, peak * 0.5) });
	}

	/* Shared configuration pieces. */

	function isPlainObject(value) {
		return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
	}

	/** Deep-merges overrides into a copy of defaults; arrays are replaced. */
	function layerSettings(defaults, overrides) {
		const merged = { ...defaults };
		for (const [key, value] of Object.entries(overrides || {})) {
			merged[key] =
				isPlainObject(value) && isPlainObject(merged[key]) ? layerSettings(merged[key], value) : value;
		}
		return merged;
	}

	function sharedOptions(theme, animate, overrides) {
		const axisText = { color: theme.soft, font: { family: TYPE, size: 11.5 }, padding: 8 };
		const defaults = {
			responsive: true,
			maintainAspectRatio: false,
			animation: animate ? { duration: 500, easing: 'easeOutQuart' } : false,
			interaction: { mode: 'index', intersect: false },
			layout: { padding: { top: 6, right: 6 } },
			elements: {
				line: { borderWidth: 2, borderCapStyle: 'round', borderJoinStyle: 'round' },
				point: { radius: 0, hoverRadius: 5, hoverBorderWidth: 2, hoverBorderColor: theme.card },
			},
			plugins: {
				legend: { display: false },
				filler: { propagate: false },
				tooltip: {
					backgroundColor: theme.card,
					titleColor: theme.ink,
					bodyColor: theme.ink,
					borderColor: theme.edge,
					borderWidth: 1,
					padding: 10,
					cornerRadius: 8,
					boxPadding: 4,
					usePointStyle: true,
					titleFont: { family: TYPE, size: 12, weight: '600' },
					bodyFont: { family: TYPE, size: 12 },
				},
			},
			scales: {
				x: {
					grid: { display: false },
					border: { display: false },
					ticks: { maxRotation: 0, autoSkipPadding: 12, ...axisText },
				},
				y: {
					grid: { color: theme.rules },
					border: { display: false },
					ticks: { maxTicksLimit: 5, ...axisText },
				},
			},
		};
		return layerSettings(defaults, overrides);
	}

	/** One filled series; its point markers appear only on hover. */
	function filledSeries(color, overrides) {
		return {
			borderColor: color,
			backgroundColor: verticalFade(color),
			pointBackgroundColor: color,
			pointHoverBackgroundColor: color,
			fill: 'origin',
			tension: 0.3,
			...overrides,
		};
	}

	/** Layered series for the stacked and share charts. */
	function layer(label, data, color, extras) {
		return {
			label,
			data,
			...extras,
			borderColor: color,
			backgroundColor: fade(color, 0.62),
			pointBackgroundColor: color,
			borderWidth: 1.5,
		};
	}

	function footerStyle(theme) {
		return { footerColor: theme.ink, footerFont: { family: TYPE, size: 12, weight: '600' } };
	}

	/* Labels and number formats. */

	function recentDays(total) {
		const now = new Date();
		return Array.from({ length: total }, (_, index) => {
			const day = new Date(now);
			day.setDate(now.getDate() - (total - 1 - index));
			return day;
		});
	}

	function shortDate(day) {
		return day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function thousands(value) {
		return `$${value}k`;
	}

	function weekTick(value, index) {
		return `Wk ${index + 1}`;
	}

	function runningTotal(values) {
		let sum = 0;
		return values.map((value) => (sum += value));
	}

	/** Draws a labeled tag on the card color, so its text never lands on
      a chart color; it is held inside the given left and right edges. */
	function drawTag(ctx, theme, centerX, bottomY, text, minX, maxX) {
		const height = 20;
		ctx.save();
		ctx.font = `600 11px ${TYPE}`;
		const width = ctx.measureText(text).width + 14;
		const x = Math.max(minX, Math.min(centerX - width / 2, maxX - width));
		const y = bottomY - height;

		ctx.fillStyle = theme.card;
		ctx.strokeStyle = theme.edge;
		ctx.lineWidth = 1;
		ctx.beginPath();
		if (ctx.roundRect) ctx.roundRect(x, y, width, height, 10);
		else ctx.rect(x, y, width, height);
		ctx.fill();
		ctx.stroke();

		ctx.fillStyle = theme.ink;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(text, x + 7, y + height / 2 + 0.5);
		ctx.restore();
	}

	/* One recipe per chart style. Each takes the theme, whether to
     animate and the canvas, and returns a full Chart.js config. */

	function stackedConfig(theme, animate) {
		return {
			type: 'line',
			data: {
				labels: FIGURES.trailingMonths,
				datasets: FIGURES.categories.map(([label, data], index) =>
					layer(label, data, theme.hues[index], { fill: index ? '-1' : 'origin', tension: 0.3 }),
				),
			},
			options: sharedOptions(theme, animate, {
				plugins: {
					tooltip: {
						itemSort: (first, second) => second.datasetIndex - first.datasetIndex,
						callbacks: {
							label: (item) => ` ${item.dataset.label}: ${thousands(item.parsed.y)}`,
							footer: (items) =>
								items.length ? `Total: ${thousands(monthlyRevenue[items[0].dataIndex])}` : '',
						},
						...footerStyle(theme),
					},
				},
				scales: {
					y: { stacked: true, beginAtZero: true, ticks: { callback: (value) => thousands(value) } },
				},
			}),
		};
	}

	function shareConfig(theme, animate) {
		const perMonth = FIGURES.channels[0][1].map((_, month) =>
			FIGURES.channels.reduce((sum, [, orders]) => sum + orders[month], 0),
		);
		return {
			type: 'line',
			data: {
				labels: FIGURES.trailingMonths,
				datasets: FIGURES.channels.map(([label, orders, slot], index) =>
					layer(
						label,
						orders.map((value, month) => +((value / perMonth[month]) * 100).toFixed(1)),
						theme.hues[slot],
						{ orders, fill: index ? '-1' : 'origin', tension: 0.25 },
					),
				),
			},
			options: sharedOptions(theme, animate, {
				plugins: {
					tooltip: {
						itemSort: (first, second) => second.datasetIndex - first.datasetIndex,
						callbacks: {
							label: (item) =>
								` ${item.dataset.label}: ${Math.round(item.parsed.y)}%, ${item.dataset.orders[item.dataIndex]} orders`,
						},
					},
				},
				scales: {
					x: { ticks: { maxTicksLimit: 4 } },
					y: { stacked: true, min: 0, max: 100, ticks: { stepSize: 25, callback: (value) => `${value}%` } },
				},
			}),
		};
	}

	function sparkConfig(theme, animate, canvas) {
		const [values, slot, format] =
			FIGURES.sparks[canvas.getAttribute('data-areas-spark')] || FIGURES.sparks.accounts;
		const color = theme.hues[slot];
		const finalIndex = values.length - 1;
		const low = Math.min(...values);
		const high = Math.max(...values);
		const spread = high - low;
		return {
			type: 'line',
			data: {
				labels: WEEK_NAMES,
				datasets: [
					filledSeries(color, {
						label: 'Value',
						data: values,
						fill: 'start',
						backgroundColor: verticalFade(color, 0.38),
						borderWidth: 2,
						pointRadius: ({ dataIndex }) => (dataIndex === finalIndex ? 3 : 0),
						pointBorderWidth: 0,
					}),
				],
			},
			options: sharedOptions(theme, animate, {
				layout: { padding: { top: 4, bottom: 0, left: 0, right: 4 } },
				plugins: {
					tooltip: {
						displayColors: false,
						callbacks: { label: (item) => ` ${format(item.parsed.y)}` },
					},
				},
				scales: {
					x: { display: false },
					/* Head room under the lowest value keeps some fill in view. */
					y: { display: false, min: low - spread * 0.6, max: high + spread * 0.08 },
				},
			}),
		};
	}

	function netConfig(theme, animate) {
		const markerColors = FIGURES.net.map((value) => (value < 0 ? theme.bad : theme.good));
		return {
			type: 'line',
			data: {
				labels: FIGURES.net.map((_, index) => `Week ${index + 1}`),
				datasets: [
					{
						label: 'Net cash',
						data: FIGURES.net,
						borderColor: theme.soft,
						borderWidth: 1.5,
						pointBackgroundColor: markerColors,
						pointHoverBackgroundColor: [...markerColors],
						tension: 0.3,
						cubicInterpolationMode: 'monotone',
						fill: { target: 'origin', above: fade(theme.good, 0.32), below: fade(theme.bad, 0.32) },
					},
				],
			},
			options: sharedOptions(theme, animate, {
				plugins: {
					tooltip: {
						callbacks: {
							label: ({ parsed: { y } }) =>
								y < 0 ? ` Spent $${Math.abs(y)}k more than came in` : ` Kept $${y}k`,
						},
					},
				},
				scales: {
					x: { ticks: { maxTicksLimit: 4, callback: weekTick } },
					y: {
						suggestedMin: -5,
						suggestedMax: 5,
						ticks: {
							stepSize: 2.5,
							callback: (value) => (value < 0 ? `-$${Math.abs(value)}k` : `$${value}k`),
						},
						grid: { color: ({ tick }) => (tick && tick.value === 0 ? theme.baseline : theme.rules) },
					},
				},
			}),
		};
	}

	function rangeConfig(theme, animate) {
		const hue = theme.hues[2];
		const edgeLine = {
			borderColor: fade(hue, 0.45),
			borderWidth: 1,
			pointRadius: 0,
			pointHoverRadius: 0,
			tension: 0.3,
		};
		return {
			type: 'line',
			data: {
				labels: recentDays(FIGURES.typical.length).map(shortDate),
				datasets: [
					{
						label: 'Slowest',
						data: FIGURES.slowest,
						...edgeLine,
						backgroundColor: 'transparent',
						fill: false,
					},
					{
						label: 'Fastest',
						data: FIGURES.fastest,
						...edgeLine,
						backgroundColor: fade(hue, isFlat() ? 0.16 : 0.2),
						fill: '-1',
					},
					{
						label: 'Typical',
						data: FIGURES.typical,
						borderColor: hue,
						backgroundColor: hue,
						pointBackgroundColor: hue,
						pointHoverBackgroundColor: hue,
						borderWidth: 2.5,
						fill: false,
						tension: 0.3,
					},
				],
			},
			options: sharedOptions(theme, animate, {
				plugins: {
					tooltip: {
						filter: ({ datasetIndex }) => datasetIndex === 2,
						callbacks: {
							label: ({ dataIndex: day }) => [
								` Typical: ${FIGURES.typical[day]} hours`,
								` Range: ${FIGURES.fastest[day]} to ${FIGURES.slowest[day]} hours`,
							],
						},
					},
				},
				scales: {
					x: { ticks: { maxTicksLimit: 6 } },
					y: {
						beginAtZero: true,
						suggestedMax: 28,
						ticks: { stepSize: 8, callback: (value) => `${value}h` },
					},
				},
			}),
		};
	}

	function cumulativeConfig(theme, animate) {
		const now = new Date();
		const monthLength = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
		const dayLabels = Array.from({ length: monthLength }, (_, index) =>
			shortDate(new Date(now.getFullYear(), now.getMonth(), index + 1)),
		);
		const current = runningTotal(FIGURES.thisDaily.slice(0, now.getDate()));
		const previous = runningTotal(FIGURES.lastDaily.slice(0, monthLength));
		return {
			type: 'line',
			data: {
				labels: dayLabels,
				datasets: [
					filledSeries(theme.hues[0], { label: 'This month', data: current, tension: 0.2, borderWidth: 2.5 }),
					{
						label: 'Last month',
						data: previous,
						borderColor: theme.baseline,
						backgroundColor: theme.baseline,
						borderWidth: 1.5,
						pointRadius: 0,
						pointHoverRadius: 0,
						fill: false,
						tension: 0.2,
					},
				],
			},
			options: sharedOptions(theme, animate, {
				layout: { padding: { top: 30, right: 10 } },
				plugins: {
					tooltip: {
						callbacks: {
							label: ({ datasetIndex, dataIndex, parsed }) =>
								datasetIndex === 1
									? ` Last month: ${parsed.y} by this day`
									: ` This month: ${parsed.y}, ${FIGURES.thisDaily[dataIndex]} that day`,
						},
					},
				},
				scales: {
					x: { ticks: { maxTicksLimit: 6 } },
					y: { beginAtZero: true },
				},
			}),
			plugins: [
				{
					/* Names the running total at the point where today ends it. */
					id: 'areasSoFar',
					afterDatasetsDraw(chart) {
						const point = chart.getDatasetMeta(0).data[current.length - 1];
						if (!point) return;
						const { left, right } = chart.chartArea;
						drawTag(
							chart.ctx,
							theme,
							point.x,
							point.y - 10,
							`${current[current.length - 1]} so far`,
							left,
							right + 10,
						);
					},
				},
			],
		};
	}

	function steppedConfig(theme, animate) {
		return {
			type: 'line',
			data: {
				labels: recentDays(FIGURES.stock.length).map(shortDate),
				datasets: [
					filledSeries(theme.hues[6], {
						label: 'Credits',
						data: FIGURES.stock,
						stepped: 'before',
						fill: 'start',
					}),
				],
			},
			options: sharedOptions(theme, animate, {
				plugins: { tooltip: { callbacks: { label: (item) => ` ${item.parsed.y}k credits` } } },
				scales: {
					x: { ticks: { maxTicksLimit: 4 } },
					y: {
						beginAtZero: true,
						suggestedMax: 140,
						ticks: { stepSize: 40, callback: (value) => (value ? `${value}k` : value) },
					},
				},
			}),
		};
	}

	function smoothConfig(theme, animate) {
		const hue = theme.hues[7];
		return {
			type: 'line',
			data: {
				labels: FIGURES.hours,
				datasets: [
					filledSeries(hue, {
						label: 'Visitors',
						data: FIGURES.visitors,
						tension: 0.45,
						cubicInterpolationMode: 'monotone',
						fill: 'start',
						borderWidth: 2.5,
						backgroundColor: verticalFade(hue, 0.32, theme.hues[1]),
					}),
				],
			},
			options: sharedOptions(theme, animate, {
				plugins: { tooltip: { callbacks: { label: (item) => ` ${item.parsed.y} visitors` } } },
				scales: {
					x: { ticks: { maxTicksLimit: 5 } },
					y: { beginAtZero: true, suggestedMax: 450, ticks: { stepSize: 150 } },
				},
			}),
		};
	}

	function limitConfig(theme, animate) {
		return {
			type: 'line',
			data: {
				labels: packingDays.map(shortDate),
				datasets: [
					filledSeries(theme.hues[3], { label: 'Packed', data: packedPerDay, tension: 0.25 }),
					{
						label: 'Capacity',
						data: packedPerDay.map(() => DAILY_LIMIT),
						borderColor: theme.soft,
						borderWidth: 1.5,
						borderDash: [6, 5],
						pointRadius: 0,
						pointHoverRadius: 0,
						backgroundColor: 'transparent',
						fill: { target: 0, above: fade(theme.ink, 0.06), below: 'transparent' },
					},
				],
			},
			options: sharedOptions(theme, animate, {
				layout: { padding: { top: 28 } },
				plugins: {
					tooltip: {
						filter: ({ datasetIndex }) => datasetIndex === 0,
						callbacks: {
							label: ({ parsed: { y } }) => {
								const headroom = DAILY_LIMIT - y;
								return [` Packed: ${y}`, headroom ? ` Spare: ${headroom}` : ' At capacity'];
							},
						},
					},
				},
				scales: {
					x: { ticks: { maxTicksLimit: 6 } },
					y: { beginAtZero: true, max: DAILY_LIMIT, ticks: { stepSize: 40 } },
				},
			}),
			plugins: [
				{
					id: 'areasCapacity',
					afterDatasetsDraw({ ctx, chartArea: box, scales: { y } }) {
						drawTag(
							ctx,
							theme,
							box.right,
							y.getPixelForValue(DAILY_LIMIT) - 6,
							`Capacity ${DAILY_LIMIT}`,
							box.left,
							box.right,
						);
					},
				},
			],
		};
	}

	function periodConfig(theme, animate) {
		const inSale = (index) => index >= SALE_START && index <= SALE_END;
		return {
			type: 'line',
			data: {
				labels: sessionDays.map(shortDate),
				datasets: [filledSeries(theme.hues[1], { label: 'Sessions', data: sessionCounts, tension: 0.3 })],
			},
			options: sharedOptions(theme, animate, {
				layout: { padding: { top: 30 } },
				plugins: {
					tooltip: {
						callbacks: {
							label: (item) =>
								` ${item.parsed.y.toLocaleString()} sessions${inSale(item.dataIndex) ? ', sale week' : ''}`,
						},
					},
				},
				scales: {
					x: { ticks: { maxTicksLimit: 7 } },
					y: {
						beginAtZero: true,
						ticks: { callback: (value) => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value) },
					},
				},
			}),
			plugins: [
				{
					id: 'areasSaleWeek',
					/* Shades the sale days and fences them with dashed rules. */
					beforeDatasetsDraw({ ctx, chartArea: box, scales: { x } }) {
						const halfStep = (x.getPixelForValue(1) - x.getPixelForValue(0)) / 2;
						const left = Math.max(box.left, x.getPixelForValue(SALE_START) - halfStep);
						const right = Math.min(box.right, x.getPixelForValue(SALE_END) + halfStep);
						ctx.save();
						ctx.fillStyle = fade(theme.ink, 0.05);
						ctx.fillRect(left, box.top, right - left, box.bottom - box.top);
						ctx.strokeStyle = theme.edge;
						ctx.setLineDash([3, 4]);
						ctx.lineWidth = 1;
						for (const edgeX of [left, right]) {
							ctx.beginPath();
							ctx.moveTo(edgeX, box.top);
							ctx.lineTo(edgeX, box.bottom);
							ctx.stroke();
						}
						ctx.restore();
					},
					afterDatasetsDraw({ ctx, chartArea: box, scales: { x } }) {
						const middle = (x.getPixelForValue(SALE_START) + x.getPixelForValue(SALE_END)) / 2;
						drawTag(ctx, theme, middle, box.top - 4, 'Autumn sale', box.left, box.right);
					},
				},
			],
		};
	}

	function overlapConfig(theme, animate) {
		const [phone, desktop] = [theme.hues[1], theme.hues[3]];
		return {
			type: 'line',
			data: {
				labels: WEEK_NAMES,
				datasets: [
					filledSeries(phone, {
						label: 'Phone',
						data: FIGURES.phone,
						backgroundColor: verticalFade(phone, 0.3),
					}),
					filledSeries(desktop, {
						label: 'Desktop',
						data: FIGURES.desktop,
						backgroundColor: verticalFade(desktop, 0.3),
					}),
				],
			},
			options: sharedOptions(theme, animate, {
				plugins: {
					tooltip: {
						callbacks: { label: (item) => ` ${item.dataset.label}: ${item.parsed.y.toLocaleString()}` },
					},
				},
				scales: {
					x: { ticks: { maxTicksLimit: 4, callback: weekTick } },
					y: {
						beginAtZero: true,
						ticks: { callback: (value) => (value >= 1000 ? `${value / 1000}k` : value) },
					},
				},
			}),
		};
	}

	function basicConfig(theme, animate) {
		return {
			type: 'line',
			data: {
				labels: FIGURES.months.slice(0, revenueThisYear.length),
				datasets: [filledSeries(theme.hues[2], { label: 'Revenue', data: revenueThisYear })],
			},
			options: sharedOptions(theme, animate, {
				plugins: { tooltip: { callbacks: { label: (item) => ` ${thousands(item.parsed.y)}` } } },
				scales: {
					x: { ticks: { maxTicksLimit: 5 } },
					y: { beginAtZero: true, ticks: { callback: (value) => thousands(value) } },
				},
			}),
		};
	}

	function yoyConfig(theme, animate) {
		const lastYearColor = theme.soft;
		return {
			type: 'line',
			data: {
				labels: FIGURES.months,
				datasets: [
					filledSeries(theme.hues[0], { label: 'This year', data: revenueThisYear, borderWidth: 2.5 }),
					{
						label: 'Last year',
						data: FIGURES.lastYear,
						borderColor: lastYearColor,
						backgroundColor: lastYearColor,
						pointBackgroundColor: lastYearColor,
						pointHoverBackgroundColor: lastYearColor,
						borderWidth: 1.5,
						borderDash: [5, 5],
						fill: false,
						tension: 0.3,
					},
				],
			},
			options: sharedOptions(theme, animate, {
				plugins: {
					tooltip: {
						callbacks: {
							label: (item) => ` ${item.dataset.label}: ${thousands(item.parsed.y)}`,
							footer: ([first]) => {
								const month = first ? first.dataIndex : -1;
								if (month < 0 || month >= revenueThisYear.length) return '';
								const change = revenueThisYear[month] - FIGURES.lastYear[month];
								return `${change >= 0 ? 'Up ' : 'Down '}${thousands(Math.abs(change))}`;
							},
						},
						...footerStyle(theme),
					},
				},
				scales: {
					y: { beginAtZero: true, ticks: { callback: (value) => thousands(value) } },
				},
			}),
		};
	}

	start();

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
