/**
 * The doughnut gallery (donut-charts.html, marked [data-donuts-root]): ten
 * Chart.js doughnuts plus the chips that filter them. Every chart reads its
 * colors from the --basalt-* tokens at build time and is built again on
 * basalt:appearance, so palette, light or dark mode, background and the
 * Flat setting all carry onto the canvases.
 */
(() => {
	'use strict';

	const gallery = pick('[data-donuts-root]');
	if (!gallery || typeof Chart === 'undefined') return;

	const TYPEFACE = "'Schibsted Grotesk', sans-serif";
	const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* One shop seen from several sides. The 503 orders and 248 accounts are
     the same ones the other chart pages refer to. */
	const FIGURES = {
		/* Share of this month's goal, in the order the four tiles appear. */
		goalShares: [85, 81, 88, 64],
		channelNames: ['Web store', 'Subscriptions', 'Wholesale', 'Marketplace', 'Mobile app', 'Point of sale'],
		/* Q3 sales in $k: 356 in all, split 42/21/14/11/8/4 percent. */
		channelSales: [149.5, 74.8, 49.8, 39.2, 28.5, 14.2],
		onTimeRate: 96,
		onTimeGoal: 95,
		regions: ['Northeast', 'Midwest', 'West', 'South'],
		/* Percent of orders per region; each quarter sums to 100. */
		regionMixByQuarter: [
			['Q1', [46, 26, 16, 12]],
			['Q2', [43, 26, 19, 12]],
			['Q3', [40, 25, 23, 12]],
		],
		ticketStates: [
			['Solved', 77],
			['Waiting on customer', 22],
			['Open', 14],
			['Escalated', 7],
		],
		dealOutcomes: ['Won', 'Lost', 'Pending', 'No decision'],
		/* Deal counts for Q2 (96 in all) and Q3 (100). */
		dealsByQuarter: [
			[24, 38, 18, 16],
			[31, 33, 22, 14],
		],
		planAccounts: [
			['Free', 72],
			['Basic', 88],
			['Pro', 56],
			['Max', 32],
		],
		bookedK: 119,
		targetK: 140,
		productMix: [
			['Travel Planner', 48],
			['Customer Portal', 31],
			['SMS credits', 21],
		],
		deviceShares: [
			['Phone', 58],
			['Desktop', 34],
			['Other', 8],
		],
	};
	const channelSum = FIGURES.channelSales.reduce((sum, value) => sum + value, 0);

	/* Live charts keyed by their canvas, so a theme change can rebuild each. */
	const liveCharts = new Map();
	const cutoutRange = pick('[data-donuts-cutout]', gallery);
	const centerText = {
		label: pick('[data-donuts-center-label]', gallery),
		value: pick('[data-donuts-center-value]', gallery),
		note: pick('[data-donuts-center-note]', gallery),
	};
	const channelRows = [...pickAll('[data-donuts-slice]', gallery)];
	let highlighted = -1;

	/* Recipes keyed by each canvas's data-donuts-chart value; each takes the
     resolved colors, whether to animate, and the canvas itself. */
	const RECIPES = {
		ring: progressRing,
		hover: channelBreakdown,
		gauge: onTimeGauge,
		rings: regionRings,
		rounded: ticketSegments,
		compare: dealQuarter,
		cutout: planCutout,
		center: bookedTotal,
		gradient: productGradient,
		basic: deviceSplit,
	};

	start();

	function start() {
		watchCanvases();
		document.addEventListener('basalt:appearance', () => {
			/* The tokens follow the theme attribute, so wait a frame to read them. */
			requestAnimationFrame(() => {
				for (const canvas of liveCharts.keys()) render(canvas, false);
			});
		});
		wireChannelList();
		wireCutoutRange();
		wireFilterChips();
	}

	/* Building and rebuilding. */

	function render(canvas, animate) {
		const recipe = RECIPES[canvas.getAttribute('data-donuts-chart')];
		if (!recipe) return;
		liveCharts.get(canvas)?.destroy();
		liveCharts.set(canvas, new Chart(canvas, recipe(paletteNow(), animate && !calm, canvas)));
	}

	/** Each canvas is built, with its entry animation, the first time it nears the viewport. */
	function watchCanvases() {
		const canvases = [...pickAll('canvas[data-donuts-chart]', gallery)];
		if (!('IntersectionObserver' in window)) {
			for (const canvas of canvases) render(canvas, false);
			return;
		}
		const watcher = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					watcher.unobserve(entry.target);
					render(entry.target, true);
				}
			},
			{ rootMargin: '80px 0px' },
		);
		for (const canvas of canvases) watcher.observe(canvas);
	}

	/* Colors. Chart.js wants strings it can parse, so blending happens here
     rather than through CSS color-mix(). Tokens are hex or rgb(a). */

	function cssToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** Splits a hex or rgb(a) color into [red, green, blue, alpha]; mid gray if unreadable. */
	function toRgba(color) {
		const text = String(color || '').trim();
		const shortHex = /^#([0-9a-f]{3})$/i.exec(text);
		if (shortHex) return [...[...shortHex[1]].map((digit) => parseInt(digit + digit, 16)), 1];
		const longHex = /^#([0-9a-f]{6})$/i.exec(text);
		if (longHex) {
			const packed = parseInt(longHex[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 1];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(text);
		if (functional) {
			const [red, green, blue, alpha] = functional[1].split(',').map((part) => parseFloat(part));
			return [red, green, blue, alpha === undefined ? 1 : alpha];
		}
		return [128, 128, 128, 1];
	}

	function translucent(color, alpha) {
		const [red, green, blue] = toRgba(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	/** Weighted blend of two colors; weight is how much of the first survives. */
	function blend(first, second, weight) {
		const near = toRgba(first);
		const far = toRgba(second);
		const [red, green, blue] = [0, 1, 2].map((slot) => Math.round(near[slot] * weight + far[slot] * (1 - weight)));
		return `rgb(${red}, ${green}, ${blue})`;
	}

	function paletteNow() {
		const ink = cssToken('--basalt-copy', '#12233a');
		return {
			series: Array.from({ length: 8 }, (_, slot) => cssToken(`--basalt-series-${slot + 1}`, '#2b6fd4')),
			text: ink,
			/* Matches --donuts-quiet in the stylesheet: small gray that keeps
         4.5:1 on the lighter palettes. */
			quiet: blend(cssToken('--basalt-copy-muted', '#5f7186'), ink, 0.82),
			/* The unfilled part of a ring, as --donuts-track. */
			track: translucent(ink, 0.09),
			surface: cssToken('--basalt-plane', '#ffffff'),
			border: cssToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
		};
	}

	function flatMode() {
		return document.documentElement.getAttribute('data-basalt-gradients') === 'off';
	}

	/* Option and dataset pieces every recipe starts from. */

	function isPlainObject(value) {
		return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
	}

	/** Copies base and lays extra over it, merging nested plain objects instead of replacing them. */
	function layered(base, extra) {
		const result = { ...base };
		for (const [key, value] of Object.entries(extra || {})) {
			result[key] = isPlainObject(value) && isPlainObject(result[key]) ? layered(result[key], value) : value;
		}
		return result;
	}

	function chartOptions(colors, animate, extra) {
		const tooltip = {
			backgroundColor: colors.surface,
			titleColor: colors.text,
			bodyColor: colors.text,
			borderColor: colors.border,
			borderWidth: 1,
			padding: 10,
			cornerRadius: 8,
			boxPadding: 4,
			usePointStyle: true,
			titleFont: { family: TYPEFACE, size: 12, weight: '600' },
			bodyFont: { family: TYPEFACE, size: 12 },
		};
		return layered(
			{
				responsive: true,
				maintainAspectRatio: false,
				animation: animate ? { duration: 500, easing: 'easeOutQuart', animateRotate: true } : false,
				layout: { padding: 8 },
				plugins: { legend: { display: false }, tooltip },
			},
			extra,
		);
	}

	/* Slices are parted by a thin line in the card color and lift a little on hover. */
	function sliceDataset(colors, extra) {
		return {
			borderColor: colors.surface,
			borderWidth: 2,
			hoverBorderColor: colors.surface,
			hoverOffset: 6,
			...extra,
		};
	}

	/* One value against the rest of its ring, the rest drawn as a quiet track. */
	function meterDataset(colors, fill, value, extra) {
		return {
			data: [value, 100 - value],
			backgroundColor: [fill, colors.track],
			hoverBackgroundColor: [fill, colors.track],
			borderWidth: 0,
			...extra,
		};
	}

	function noTooltip(extra) {
		return { plugins: { tooltip: { enabled: false } }, ...extra };
	}

	function tooltipLabel(format) {
		return { plugins: { tooltip: { callbacks: { label: format } } } };
	}

	function thousands(value) {
		return `$${value.toFixed(1).replace(/\.0$/, '')}k`;
	}

	/** Writes a figure and a caption into a doughnut's hole in the card's text colors. */
	function writeInHole(context, colors, x, y, figure, caption, size) {
		context.save();
		context.textAlign = 'center';
		context.textBaseline = 'alphabetic';
		context.fillStyle = colors.text;
		context.font = `700 ${size}px ${TYPEFACE}`;
		context.fillText(figure, x, y);
		context.fillStyle = colors.quiet;
		context.font = `500 12px ${TYPEFACE}`;
		context.fillText(caption, x, y + 20);
		context.restore();
	}

	/* The recipes, in the order their cards appear. */

	function progressRing(colors, animate, canvas) {
		const tile = Number(canvas.getAttribute('data-donuts-ring')) || 0;
		return {
			type: 'doughnut',
			data: { datasets: [meterDataset(colors, colors.series[tile], FIGURES.goalShares[tile])] },
			options: chartOptions(colors, animate, noTooltip({ cutout: '80%', layout: { padding: 2 }, events: [] })),
		};
	}

	/* The center label already names the hovered slice, so no tooltip here. */
	function channelBreakdown(colors, animate) {
		return {
			type: 'doughnut',
			data: {
				labels: FIGURES.channelNames,
				datasets: [
					sliceDataset(colors, {
						label: 'Q3 revenue',
						data: FIGURES.channelSales,
						backgroundColor: colors.series.slice(0, 6),
					}),
				],
			},
			options: chartOptions(colors, animate, noTooltip({ cutout: '70%' })),
			plugins: [
				{
					id: 'donutsFollow',
					afterEvent(chart) {
						const [first] = chart.getActiveElements();
						highlight(first ? first.index : -1);
					},
				},
			],
		};
	}

	/* The band runs from one ramp color into the next as it fills, like a
     dial, with a short stroke across it at the target; Flat keeps one color.
     The gray track is painted whole underneath, so on load the band sweeps
     left to right across it while the figure in the middle counts up with it. */
	function onTimeGauge(colors, animate) {
		const start = colors.series[2];
		const end = colors.series[0];
		const fill = (context) => {
			if (context.dataIndex !== 0) return 'transparent';
			const area = context.chart.chartArea;
			if (flatMode() || !area) return start;
			const gradient = context.chart.ctx.createLinearGradient(area.left, 0, area.right, 0);
			gradient.addColorStop(0, start);
			gradient.addColorStop(1, end);
			return gradient;
		};

		return {
			type: 'doughnut',
			data: {
				labels: ['On time', 'Late'],
				datasets: [
					meterDataset(colors, start, FIGURES.onTimeRate, {
						circumference: 180,
						rotation: 270,
						backgroundColor: fill,
						hoverBackgroundColor: fill,
					}),
				],
			},
			options: chartOptions(
				colors,
				animate,
				noTooltip({
					cutout: '76%',
					layout: { padding: { top: 12, left: 8, right: 8, bottom: 8 } },
					events: [],
					animation: animate ? { duration: 500, easing: 'easeOutCubic', animateRotate: true } : false,
				}),
			),
			plugins: [
				{
					id: 'donutsGauge',
					beforeDatasetsDraw: (chart) => drawGaugeTrack(chart, colors),
					afterDraw: (chart) => drawGaugeMark(chart, colors),
				},
			],
		};
	}

	/* Chart.js grows the band from the left end, so the sweep only needs a
     track that is already whole. Its ends are taken from the band's final
     geometry, which does not move while the band fills. */
	function drawGaugeTrack(chart, colors) {
		const band = chart.getDatasetMeta(0).data[0];
		if (!band) return;
		const { x, y, innerRadius, outerRadius } = band.getProps(['x', 'y', 'innerRadius', 'outerRadius'], true);
		const context = chart.ctx;
		context.save();
		context.fillStyle = colors.track;
		context.beginPath();
		context.arc(x, y, outerRadius, Math.PI, Math.PI * 2);
		context.arc(x, y, innerRadius, Math.PI * 2, Math.PI, true);
		context.closePath();
		context.fill();
		context.restore();
	}

	function drawGaugeMark(chart, colors) {
		const band = chart.getDatasetMeta(0).data[0];
		if (!band) return;
		const { x, y, innerRadius, outerRadius } = band.getProps(['x', 'y', 'innerRadius', 'outerRadius'], true);
		/* The figure follows the band as it sweeps: the share of the half
       circle it covers right now. */
		const { startAngle, endAngle } = band.getProps(['startAngle', 'endAngle']);
		const shown = Math.min(FIGURES.onTimeRate, Math.round(((endAngle - startAngle) / Math.PI) * 100));
		const context = chart.ctx;
		const angle = Math.PI + Math.PI * (FIGURES.onTimeGoal / 100);
		const pointAt = (radius) => [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];

		context.save();
		context.strokeStyle = colors.text;
		context.lineWidth = 2;
		context.lineCap = 'round';
		context.beginPath();
		context.moveTo(...pointAt(innerRadius - 5));
		context.lineTo(...pointAt(outerRadius + 5));
		context.stroke();
		context.restore();

		const size = Math.max(22, Math.min(30, innerRadius * 0.34));
		writeInHole(
			context,
			colors,
			x,
			y - 22,
			`${Math.max(0, shown)}%`,
			`on time, target ${FIGURES.onTimeGoal}%`,
			size,
		);
	}

	/* Chart.js puts the first dataset on the outside, so the newest quarter leads. */
	function regionRings(colors, animate) {
		const newestFirst = [...FIGURES.regionMixByQuarter].reverse();
		return {
			type: 'doughnut',
			data: {
				labels: FIGURES.regions,
				datasets: newestFirst.map(([quarter, shares]) =>
					sliceDataset(colors, {
						label: quarter,
						data: shares,
						backgroundColor: colors.series.slice(0, 4),
						hoverOffset: 0,
					}),
				),
			},
			options: chartOptions(colors, animate, {
				cutout: '28%',
				plugins: {
					tooltip: {
						callbacks: {
							title: (hovered) => hovered[0].dataset.label,
							label: (hovered) => ` ${hovered.label}: ${hovered.parsed}% of orders`,
						},
					},
				},
			}),
		};
	}

	function ticketSegments(colors, animate) {
		return {
			type: 'doughnut',
			data: {
				labels: FIGURES.ticketStates.map(([state]) => state),
				datasets: [
					{
						label: 'Tickets',
						data: FIGURES.ticketStates.map(([, total]) => total),
						backgroundColor: colors.series.slice(0, 4),
						borderWidth: 0,
						borderRadius: 8,
						spacing: 4,
						hoverOffset: 6,
					},
				],
			},
			options: chartOptions(colors, animate, {
				cutout: '74%',
				...tooltipLabel((hovered) => ` ${hovered.parsed} tickets`),
			}),
		};
	}

	function dealQuarter(colors, animate, canvas) {
		const later = Number(canvas.getAttribute('data-donuts-quarter')) || 0;
		return {
			type: 'doughnut',
			data: {
				labels: FIGURES.dealOutcomes,
				datasets: [
					sliceDataset(colors, {
						label: later ? 'Q3' : 'Q2',
						data: FIGURES.dealsByQuarter[later],
						backgroundColor: colors.series.slice(0, 4),
					}),
				],
			},
			options: chartOptions(colors, animate, {
				cutout: '72%',
				...tooltipLabel((hovered) => ` ${hovered.parsed} deals`),
			}),
		};
	}

	function planCutout(colors, animate) {
		return {
			type: 'doughnut',
			data: {
				labels: FIGURES.planAccounts.map(([plan]) => plan),
				datasets: [
					sliceDataset(colors, {
						label: 'Accounts',
						data: FIGURES.planAccounts.map(([, accounts]) => accounts),
						backgroundColor: colors.series.slice(0, 4),
					}),
				],
			},
			options: chartOptions(colors, animate, {
				cutout: `${cutoutRange ? cutoutRange.value : 60}%`,
				...tooltipLabel((hovered) => ` ${hovered.parsed} accounts`),
			}),
		};
	}

	function bookedTotal(colors, animate) {
		const { bookedK, targetK } = FIGURES;
		return {
			type: 'doughnut',
			data: {
				labels: ['Booked', 'Still to go'],
				datasets: [
					meterDataset(colors, colors.series[7], 0, { data: [bookedK, targetK - bookedK], hoverOffset: 0 }),
				],
			},
			options: chartOptions(colors, animate, {
				cutout: '76%',
				...tooltipLabel((hovered) => ` ${thousands(hovered.parsed)}`),
			}),
			plugins: [
				{
					id: 'donutsCenterTotal',
					afterDraw(chart) {
						const area = chart.chartArea;
						if (!area) return;
						const percent = Math.round((bookedK / targetK) * 100);
						const middleX = (area.left + area.right) / 2;
						const middleY = (area.top + area.bottom) / 2 + 2;
						writeInHole(
							chart.ctx,
							colors,
							middleX,
							middleY,
							thousands(bookedK),
							`${percent}% of target`,
							28,
						);
					},
				},
			],
		};
	}

	/* Each slice fades from a paler inner edge to its full color outside. */
	function productGradient(colors, animate) {
		const fills = colors.series.slice(0, 3);
		const solid = (context) => fills[context.dataIndex] || fills[0];
		return {
			type: 'doughnut',
			data: {
				labels: FIGURES.productMix.map(([product]) => product),
				datasets: [
					sliceDataset(colors, {
						label: 'Revenue',
						data: FIGURES.productMix.map(([, share]) => share),
						backgroundColor(context) {
							const color = solid(context);
							const { chart } = context;
							const arcs = chart.getDatasetMeta(0).controller;
							const area = chart.chartArea;
							if (flatMode() || !area || !arcs || !arcs.outerRadius) return color;
							const cx = (area.left + area.right) / 2;
							const cy = (area.top + area.bottom) / 2;
							const gradient = chart.ctx.createRadialGradient(
								cx,
								cy,
								arcs.innerRadius,
								cx,
								cy,
								arcs.outerRadius,
							);
							gradient.addColorStop(0, blend(color, colors.surface, 0.4));
							gradient.addColorStop(1, color);
							return gradient;
						},
						hoverBackgroundColor: solid,
					}),
				],
			},
			options: chartOptions(colors, animate, {
				cutout: '58%',
				...tooltipLabel((hovered) => ` ${hovered.parsed}% of revenue`),
			}),
		};
	}

	function deviceSplit(colors, animate) {
		return {
			type: 'doughnut',
			data: {
				labels: FIGURES.deviceShares.map(([device]) => device),
				datasets: [
					sliceDataset(colors, {
						label: 'Orders',
						data: FIGURES.deviceShares.map(([, share]) => share),
						backgroundColor: colors.series.slice(0, 3),
					}),
				],
			},
			options: chartOptions(
				colors,
				animate,
				tooltipLabel((hovered) => ` ${hovered.parsed}% of orders`),
			),
		};
	}

	/* Channel card: the hole text and the list follow whichever slice is
     hovered on the chart, and hovering or focusing a list row lights its slice. */

	/** Shows one channel (by index) in the hole and the list, or the Q3 total for -1. */
	function highlight(index) {
		if (index === highlighted) return;
		highlighted = index;
		if (centerText.value) {
			const whole = index < 0;
			centerText.label.textContent = whole ? 'Q3 revenue' : FIGURES.channelNames[index];
			centerText.value.textContent = thousands(whole ? channelSum : FIGURES.channelSales[index]);
			centerText.note.textContent = whole
				? `${FIGURES.channelNames.length} channels`
				: `${Math.round((FIGURES.channelSales[index] / channelSum) * 100)}% of revenue`;
		}
		for (const row of channelRows) {
			row.classList.toggle('is-active', Number(row.getAttribute('data-donuts-slice')) === index);
		}
	}

	function wireChannelList() {
		const canvas = pick('[data-donuts-chart="hover"]', gallery);
		const select = (index) => {
			const chart = canvas && liveCharts.get(canvas);
			if (chart) {
				chart.setActiveElements(index < 0 ? [] : [{ datasetIndex: 0, index }]);
				chart.update(calm ? 'none' : undefined);
			}
			highlight(index);
		};

		for (const row of channelRows) {
			const index = Number(row.getAttribute('data-donuts-slice'));
			row.addEventListener('mouseenter', () => select(index));
			row.addEventListener('focus', () => select(index));
			row.addEventListener('mouseleave', () => select(-1));
			row.addEventListener('blur', () => select(-1));
		}
	}

	/* Dragging the range resizes the hole of the cutout chart in place. */
	function wireCutoutRange() {
		if (!cutoutRange) return;
		const readout = pick('[data-donuts-cutout-out]', gallery);
		cutoutRange.addEventListener('input', () => {
			if (readout) readout.textContent = `${cutoutRange.value}%`;
			const canvas = pick('[data-donuts-chart="cutout"]', gallery);
			const chart = canvas && liveCharts.get(canvas);
			if (!chart) return;
			chart.options.cutout = `${cutoutRange.value}%`;
			chart.update('none');
		});
	}

	/* Chips: one per chart kind, plus "all". In a filtered view an unpaired
     half-width card stretches across its row. */
	function wireFilterChips() {
		const grid = pick('[data-donuts-grid]', gallery);
		const cards = [...pickAll('.donuts-card', grid)];
		const tally = pick('[data-donuts-count]', gallery);
		const chips = pickAll('[data-donuts-filter]', gallery);

		const showKind = (kind) => {
			const everything = kind === 'all';
			const visible = cards.filter((card) => {
				const match = everything || card.getAttribute('data-donuts-kind') === kind;
				card.classList.toggle('is-hidden', !match);
				card.classList.remove('is-alone');
				return match;
			});
			grid.classList.toggle('is-filtered', !everything);
			if (!everything) {
				const halves = visible.filter((card) => !card.classList.contains('donuts-card-full'));
				if (halves.length % 2) halves.at(-1).classList.add('is-alone');
			}
			if (tally) tally.textContent = `${visible.length}${visible.length === 1 ? ' chart' : ' charts'}`;
		};

		for (const chip of chips) {
			chip.addEventListener('click', () => {
				for (const other of pickAll('[data-donuts-filter]', gallery)) {
					other.setAttribute('aria-pressed', String(other === chip));
				}
				showKind(chip.getAttribute('data-donuts-filter'));
			});
		}
	}

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
