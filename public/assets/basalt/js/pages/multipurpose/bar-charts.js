/**
 * Bar chart gallery for bar-charts.html.
 *
 * Thirteen Chart.js recipes share one set of options and one color
 * reading. A canvas is drawn the first time it scrolls into view, and
 * every drawn canvas is thrown away and drawn again on basalt:appearance,
 * which is how a palette, mode, background or Flat switch reaches the
 * pixels. The week picker and the filter chips are plain DOM work.
 */
(() => {
	'use strict';

	const stage = pick('[data-bars-root]');
	const stillMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const TYPEFACE = "'Schibsted Grotesk', sans-serif";

	/* Every chart on the page belongs to one shop, the same one the line
     charts page draws; this week's 503 orders is its sparkline week. */
	const FIXTURE = {
		weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
		ordersByWeek: { now: [62, 68, 71, 75, 86, 70, 71], before: [58, 64, 66, 70, 79, 74, 68] },
		springToFall: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
		channels: [
			['Search', [23, 26, 28, 22, 24, 27, 22]],
			['Social', [24, 20, 19, 19, 20, 22, 26]],
			['Content', [13, 15, 16, 16, 16, 18, 17]],
			['Partner', [9, 10, 11, 12, 12, 11, 12]],
		],
		/* Q3 sales beside the target, both in $k: name, sold, goal. */
		targets: [
			['Basic', 38, 45],
			['Pro', 118, 110],
			['Max', 61, 70],
			['Add-ons', 55, 50],
		],
		reasons: [
			['Where is my order?', 142],
			['Change delivery address', 96],
			['Pause a subscription', 81],
			['Damaged in transit', 47],
			['Refund request', 39],
			['Wholesale inquiry', 22],
		],
		yearFromOctober: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
		netSubscribers: [18, 12, -6, 9, 14, -11, -4, 21, 16, 8, -3, 24],
		plans: ['Basic', 'Pro', 'Max', 'Add-ons'],
		/* One row per quarter, one number per plan. */
		quarterTotals: [
			['Q1', [1111, 594, 361, 311]],
			['Q2', [1058, 570, 436, 395]],
			['Q3', [1106, 614, 558, 402]],
		],
		aprilToSeptember: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
		orderShare: [
			['Web store', [67, 68, 69, 66, 65, 63]],
			['Mobile app', [27, 26, 26, 28, 29, 31]],
			['Point of sale', [6, 6, 5, 6, 6, 6]],
		],
		threeWeeks: [62, 68, 71, 75, 86, 70, 71, 64, 70, 73, 78, 88, 74, 69, 66, 72, 74, 80, 91, 76, 72],
		/* Order value per month as a [10th, 90th] percentile pair, in $. */
		valueSpread: [
			[24, 88],
			[26, 94],
			[29, 103],
			[27, 112],
			[31, 121],
			[34, 129],
			[36, 138],
		],
		regions: [
			['northeast', [330, 366, 415, 294, 381, 383, 303, 377, 426]],
			['midwest', [177, 197, 220, 162, 192, 216, 182, 209, 223]],
			['west', [125, 118, 118, 153, 145, 138, 151, 200, 207]],
			['south', [92, 106, 113, 133, 132, 130, 139, 132, 121]],
		],
		repeatRate: [
			['Basic', 64],
			['Pro', 58],
			['Max', 91],
			['SMS credits', 21],
			['Portal', 34],
		],
		shippedByCity: [
			['Eugene', 447],
			['Ann Arbor', 392],
			['Minot', 358],
			['Dubuque', 296],
			['Duluth', 204],
			['Olympia', 163],
		],
		januaryToSeptember: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
		revenueK: [41.2, 44.0, 47.3, 45.1, 49.4, 52.0, 55.6, 53.2, 58.4],
	};

	const drawn = new Map();
	let activeWeek = 'now';

	/**
	 * Wires the page: lazy drawing, redraw on theme change, the week picker
	 * and the filter chips. Nothing happens without the root or Chart.js.
	 */
	function start() {
		if (!stage || typeof Chart === 'undefined') return;

		const sheets = Array.from(pickAll('canvas[data-bars-chart]', stage));
		if ('IntersectionObserver' in window) {
			const watcher = new IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						if (!entry.isIntersecting) continue;
						watcher.unobserve(entry.target);
						draw(entry.target, true);
					}
				},
				{ rootMargin: '80px 0px' },
			);
			for (const sheet of sheets) watcher.observe(sheet);
		} else {
			for (const sheet of sheets) draw(sheet, false);
		}

		/* The attribute flips before the tokens settle, so the redraw waits a
       frame to read the new colors. */
		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() => {
				for (const sheet of drawn.keys()) draw(sheet, false);
			});
		});

		pick('[data-bars-picker]', stage)?.addEventListener('click', pickWeek);

		for (const chip of pickAll('[data-bars-filter]', stage)) {
			chip.addEventListener('click', () => {
				for (const other of pickAll('[data-bars-filter]', stage)) {
					other.setAttribute('aria-pressed', String(other === chip));
				}
				showKind(chip.getAttribute('data-bars-filter'));
			});
		}
	}

	/**
	 * Draws (or redraws) one canvas from the recipe its data attribute names.
	 * @param {HTMLCanvasElement} sheet
	 * @param {boolean} animated - false on redraws, and always under reduced motion
	 */
	function draw(sheet, animated) {
		const recipe = RECIPES[sheet.getAttribute('data-bars-chart')];
		if (!recipe) return;
		drawn.get(sheet)?.destroy();
		drawn.set(sheet, new Chart(sheet, recipe(readColors(), animated && !stillMotion, sheet)));
	}

	/* Theme colors. Tokens arrive as #rrggbb or rgba(); Chart.js wants plain
     color strings, so the blending is done on channel numbers here rather
     than with color-mix() in CSS. */

	function readToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/**
	 * Splits a color string into [r, g, b, a]; unknown input reads as gray.
	 * @param {string} color
	 * @returns {number[]}
	 */
	function channels(color) {
		const raw = String(color || '').trim();
		const functional = /^rgba?\(([^)]+)\)$/i.exec(raw);
		if (functional) {
			const parts = functional[1].split(',').map((part) => parseFloat(part));
			return [parts[0], parts[1], parts[2], parts[3] ?? 1];
		}
		const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
		if (!hex) return [128, 128, 128, 1];
		const digits = hex[1].length === 3 ? hex[1].replace(/./g, '$&$&') : hex[1];
		const packed = parseInt(digits, 16);
		return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 1];
	}

	function translucent(color, alpha) {
		const [red, green, blue] = channels(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	/**
	 * Blends two colors: `weight` of the first, the rest of the second.
	 * @returns {string} an rgb() string
	 */
	function blend(first, second, weight) {
		const from = channels(first);
		const to = channels(second);
		const [red, green, blue] = [0, 1, 2].map((slot) => Math.round(from[slot] * weight + to[slot] * (1 - weight)));
		return `rgb(${red}, ${green}, ${blue})`;
	}

	/* Read fresh on every draw, so a theme change is one redraw away. */
	function readColors() {
		const ink = readToken('--basalt-copy', '#12233a');
		const faded = readToken('--basalt-copy-muted', '#5f7186');
		const plane = readToken('--basalt-plane', '#ffffff');
		return {
			series: Array.from({ length: 8 }, (_, slot) => readToken(`--basalt-series-${slot + 1}`, '#2b6fd4')),
			ink,
			plane,
			/* The same mix as --bars-quiet in bar-charts.css: muted text nudged
         toward the body color until it clears 4.5:1 on the light palettes. */
			quiet: blend(faded, ink, 0.82),
			rest: blend(ink, plane, 0.16),
			track: blend(ink, plane, 0.07),
			grid: translucent(ink, 0.07),
			border: readToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			success: readToken('--basalt-success', '#12c08f'),
			danger: readToken('--basalt-danger', '#ef4d63'),
		};
	}

	/* Shared configuration. Each recipe starts from chartOptions() and layers
     its own overrides on top with a deep merge. */

	function isPlainObject(value) {
		return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
	}

	/**
	 * Copies `base` and lays `overrides` over it, descending into plain
	 * objects on both sides; arrays and everything else are replaced whole.
	 */
	function layer(base, overrides) {
		const result = { ...base };
		for (const [key, incoming] of Object.entries(overrides || {})) {
			result[key] =
				isPlainObject(incoming) && isPlainObject(result[key]) ? layer(result[key], incoming) : incoming;
		}
		return result;
	}

	function chartOptions(colors, animated, overrides) {
		const tickStyle = { color: colors.quiet, font: { family: TYPEFACE, size: 11.5 }, padding: 8 };
		const labelFont = { family: TYPEFACE, size: 12 };
		return layer(
			{
				responsive: true,
				maintainAspectRatio: false,
				animation: animated ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				layout: { padding: { top: 6, right: 6 } },
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: colors.plane,
						titleColor: colors.ink,
						bodyColor: colors.ink,
						borderColor: colors.border,
						borderWidth: 1,
						padding: 10,
						cornerRadius: 8,
						boxPadding: 4,
						usePointStyle: true,
						pointStyle: 'rectRounded',
						titleFont: { ...labelFont, weight: '600' },
						bodyFont: labelFont,
					},
				},
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: { maxRotation: 0, autoSkipPadding: 12, ...tickStyle },
					},
					y: {
						grid: { color: colors.grid },
						border: { display: false },
						ticks: { maxTicksLimit: 5, ...tickStyle },
						beginAtZero: true,
					},
				},
			},
			overrides,
		);
	}

	/* Sideways charts: the grid moves to the value axis and the category
     axis shows every label. */
	function sidewaysOptions(colors, animated, overrides) {
		return chartOptions(
			colors,
			animated,
			layer(
				{
					indexAxis: 'y',
					interaction: { mode: 'index', intersect: false, axis: 'y' },
					scales: {
						x: {
							grid: { display: true, color: colors.grid },
							ticks: { maxTicksLimit: 5 },
							beginAtZero: true,
						},
						y: { grid: { display: false }, ticks: { maxTicksLimit: 12, autoSkip: false } },
					},
				},
				overrides,
			),
		);
	}

	function barSeries(color, overrides) {
		return {
			backgroundColor: color,
			hoverBackgroundColor: color,
			borderRadius: 6,
			borderSkipped: 'start',
			maxBarThickness: 44,
			...overrides,
		};
	}

	/**
	 * Tick callback that splits a long category name across two lines on a
	 * narrow chart, breaking where the halves come out most even. A plain
	 * function, because Chart.js binds the scale to `this`.
	 * @param {number} limit - names up to this many characters stay whole
	 */
	function twoLineTicks(limit) {
		return function (value) {
			const name = String(this.getLabelForValue(value));
			if (this.chart.width >= 520 || name.length <= limit || !name.includes(' ')) return name;
			const words = name.split(' ');
			let cut = 1;
			let imbalance = Infinity;
			for (let at = 1; at < words.length; at += 1) {
				const skew = Math.abs(words.slice(0, at).join(' ').length - words.slice(at).join(' ').length);
				if (skew < imbalance) {
					imbalance = skew;
					cut = at;
				}
			}
			return [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
		};
	}

	function dollars(amount) {
		return `$${Number(amount).toLocaleString()}`;
	}

	/* Canvas overlays: things Chart.js does not draw by itself. */

	/**
	 * A plugin that writes each bar's value beside it, in text color on the
	 * card surface so it reads whatever the bar color is.
	 * @param {(value: number, index: number) => string} format
	 * @param {{dataset?: number, gap?: number}} [settings]
	 */
	function valueOverlay(colors, format, settings) {
		const { dataset, gap } = { dataset: 0, gap: 7, ...settings };
		return {
			id: 'barsValues',
			afterDatasetsDraw(chart) {
				const { ctx } = chart;
				const values = chart.data.datasets[dataset].data;
				const sideways = chart.options.indexAxis === 'y';
				ctx.save();
				ctx.fillStyle = colors.ink;
				ctx.font = `600 11.5px ${TYPEFACE}`;
				ctx.textAlign = sideways ? 'left' : 'center';
				ctx.textBaseline = sideways ? 'middle' : 'bottom';
				for (const [index, bar] of chart.getDatasetMeta(dataset).data.entries()) {
					const caption = format(values[index], index);
					if (sideways) ctx.fillText(caption, bar.x + gap, bar.y + 0.5);
					else ctx.fillText(caption, bar.x, bar.y - gap);
				}
				ctx.restore();
			},
		};
	}

	/**
	 * Paints a small outlined badge with a text label, centered on x unless
	 * that would push it past either edge.
	 */
	function drawBadge(ctx, colors, x, y, caption, minLeft, maxRight) {
		ctx.save();
		ctx.font = `600 11px ${TYPEFACE}`;
		const width = ctx.measureText(caption).width + 14;
		const height = 20;
		const left = Math.max(minLeft, Math.min(x - width / 2, maxRight - width));
		const top = y - height / 2;
		ctx.fillStyle = colors.plane;
		ctx.strokeStyle = colors.border;
		ctx.lineWidth = 1;
		ctx.beginPath();
		if (ctx.roundRect) ctx.roundRect(left, top, width, height, 10);
		else ctx.rect(left, top, width, height);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = colors.ink;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(caption, left + 7, top + height / 2 + 0.5);
		ctx.restore();
	}

	/* Short date labels for the last `count` days, ending today. */
	function recentDays(count) {
		const today = new Date();
		return Array.from({ length: count }, (_, offset) => {
			const day = new Date(today);
			day.setDate(today.getDate() - (count - 1 - offset));
			return day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		});
	}

	function signed(amount) {
		return `${amount > 0 ? '+' : ''}${amount}`;
	}

	/* The recipes, keyed by data-bars-chart. Each takes the theme colors,
     whether to animate, and the canvas, and returns a Chart.js config. */
	const RECIPES = {
		stacked(colors, animated) {
			const top = FIXTURE.channels.length - 1;
			return {
				type: 'bar',
				data: {
					labels: FIXTURE.springToFall,
					/* The top piece of each column is the only one with rounded
             corners; the others carry a thin surface-colored seam. */
					datasets: FIXTURE.channels.map(([name, values], slot) =>
						barSeries(colors.series[slot], {
							label: name,
							data: values,
							borderRadius: slot === top ? { topLeft: 6, topRight: 6 } : 0,
							borderSkipped: false,
							borderWidth: { top: slot === top ? 0 : 1.5 },
							borderColor: colors.plane,
						}),
					),
				},
				options: chartOptions(colors, animated, {
					scales: { x: { stacked: true }, y: { stacked: true } },
					plugins: {
						tooltip: {
							itemSort: (first, second) => second.datasetIndex - first.datasetIndex,
							callbacks: {
								footer: (items) => `Total: ${items.reduce((sum, item) => sum + item.parsed.y, 0)}`,
							},
							footerColor: colors.ink,
							footerFont: { family: TYPEFACE, size: 12, weight: '600' },
						},
					},
				}),
			};
		},

		bullet(colors, animated) {
			const trackEnd = 150;
			return {
				type: 'bar',
				data: {
					labels: FIXTURE.targets.map(([name]) => name),
					datasets: [
						barSeries(colors.series[0], {
							label: 'Sales',
							data: FIXTURE.targets.map(([, sold]) => sold),
							barPercentage: 0.34,
							categoryPercentage: 1,
							borderRadius: 4,
							grouped: false,
							order: 0,
						}),
						{
							label: 'Track',
							data: FIXTURE.targets.map(() => trackEnd),
							backgroundColor: colors.track,
							hoverBackgroundColor: colors.track,
							borderRadius: 6,
							barPercentage: 0.72,
							categoryPercentage: 1,
							grouped: false,
							order: 1,
						},
					],
				},
				options: sidewaysOptions(colors, animated, {
					layout: { padding: { right: 4 } },
					plugins: {
						tooltip: {
							filter: (item) => item.datasetIndex === 0,
							callbacks: {
								label: (item) =>
									` $${item.parsed.x}k of a $${FIXTURE.targets[item.dataIndex][2]}k target`,
							},
						},
					},
					scales: {
						x: {
							max: trackEnd,
							grid: { display: false },
							ticks: { stepSize: 50, callback: (value) => `$${value}k` },
						},
						y: { ticks: { callback: twoLineTicks(10) } },
					},
				}),
				plugins: [
					{
						id: 'barsTargets',
						afterDatasetsDraw(chart) {
							const {
								ctx,
								scales: { x: axis },
							} = chart;
							ctx.save();
							for (const [index, track] of chart.getDatasetMeta(1).data.entries()) {
								const [, sold, goal] = FIXTURE.targets[index];
								const goalX = axis.getPixelForValue(goal);
								const reach = track.height / 2;
								/* The goal is a short upright stroke across the track. */
								ctx.strokeStyle = colors.ink;
								ctx.lineWidth = 2.5;
								ctx.lineCap = 'round';
								ctx.beginPath();
								ctx.moveTo(goalX, track.y - reach + 3);
								ctx.lineTo(goalX, track.y + reach - 3);
								ctx.stroke();
								/* The shortfall or overshoot sits at the end of the track. */
								ctx.fillStyle = colors.ink;
								ctx.font = `600 11px ${TYPEFACE}`;
								ctx.textAlign = 'right';
								ctx.textBaseline = 'middle';
								ctx.fillText(
									`${signed(Math.round(((sold - goal) / goal) * 100))}%`,
									track.x - 8,
									track.y + 0.5,
								);
							}
							ctx.restore();
						},
					},
				],
			};
		},

		basic(colors, animated) {
			/* Saturday and Sunday take a second hue so the weekend stands apart. */
			const dayColors = FIXTURE.weekdays.map((_, slot) => colors.series[slot >= 5 ? 2 : 0]);
			return {
				type: 'bar',
				data: {
					labels: FIXTURE.weekdays,
					datasets: [
						barSeries(colors.series[0], {
							label: 'Orders',
							data: [...FIXTURE.ordersByWeek[activeWeek]],
							backgroundColor: dayColors,
							hoverBackgroundColor: dayColors,
							barPercentage: 0.62,
						}),
					],
				},
				options: chartOptions(colors, animated, {
					scales: { y: { suggestedMax: 100 } },
				}),
			};
		},

		horizontal(colors, animated) {
			const rowColors = FIXTURE.reasons.map((_, slot) => colors.series[slot % colors.series.length]);
			return {
				type: 'bar',
				data: {
					labels: FIXTURE.reasons.map(([reason]) => reason),
					datasets: [
						barSeries(colors.series[0], {
							label: 'Messages',
							data: FIXTURE.reasons.map(([, total]) => total),
							backgroundColor: rowColors,
							hoverBackgroundColor: rowColors,
							barPercentage: 0.7,
						}),
					],
				},
				options: sidewaysOptions(colors, animated, {
					layout: { padding: { right: 36 } },
					scales: { x: { display: false, max: 150 }, y: { ticks: { callback: twoLineTicks(14) } } },
				}),
				plugins: [valueOverlay(colors, (value) => String(value))],
			};
		},

		negative(colors, animated) {
			const signColors = FIXTURE.netSubscribers.map((change) => (change < 0 ? colors.danger : colors.success));
			function onZero(line) {
				return line.tick?.value === 0;
			}
			return {
				type: 'bar',
				data: {
					labels: FIXTURE.yearFromOctober,
					datasets: [
						barSeries(colors.success, {
							label: 'Net change',
							data: FIXTURE.netSubscribers,
							backgroundColor: signColors,
							hoverBackgroundColor: signColors,
							barPercentage: 0.62,
						}),
					],
				},
				options: chartOptions(colors, animated, {
					plugins: {
						tooltip: { callbacks: { label: (item) => ` ${signed(item.parsed.y)} subscribers` } },
					},
					scales: {
						y: {
							suggestedMin: -15,
							suggestedMax: 30,
							ticks: { stepSize: 10, callback: signed },
							/* The zero line is drawn heavier than the rest of the grid. */
							grid: {
								color: (line) => (onZero(line) ? colors.border : colors.grid),
								lineWidth: (line) => (onZero(line) ? 1.5 : 1),
							},
						},
					},
				}),
			};
		},

		grouped(colors, animated) {
			return {
				type: 'bar',
				data: {
					labels: FIXTURE.plans,
					datasets: FIXTURE.quarterTotals.map(([quarter, values], slot) =>
						barSeries(colors.series[slot], {
							label: quarter,
							data: values,
							borderRadius: 4,
							barPercentage: 0.86,
							categoryPercentage: 0.7,
						}),
					),
				},
				options: chartOptions(colors, animated, {
					scales: { y: { ticks: { callback: (value) => Number(value).toLocaleString() } } },
				}),
			};
		},

		percent(colors, animated) {
			const top = FIXTURE.orderShare.length - 1;
			return {
				type: 'bar',
				data: {
					labels: FIXTURE.aprilToSeptember,
					datasets: FIXTURE.orderShare.map(([channel, values], slot) =>
						barSeries(colors.series[slot], {
							label: channel,
							data: values,
							borderRadius: slot === top ? { topLeft: 6, topRight: 6 } : 0,
							borderSkipped: false,
							borderWidth: { top: slot === top ? 0 : 1.5 },
							borderColor: colors.plane,
							barPercentage: 0.66,
						}),
					),
				},
				options: chartOptions(colors, animated, {
					plugins: {
						tooltip: {
							itemSort: (first, second) => second.datasetIndex - first.datasetIndex,
							callbacks: { label: (item) => ` ${item.dataset.label}: ${item.parsed.y}%` },
						},
					},
					scales: {
						x: { stacked: true },
						y: { stacked: true, max: 100, ticks: { stepSize: 25, callback: (value) => `${value}%` } },
					},
				}),
			};
		},

		reference(colors, animated) {
			const days = FIXTURE.threeWeeks;
			const mean = days.reduce((sum, orders) => sum + orders, 0) / days.length;
			const strong = colors.series[2];
			const faint = blend(strong, colors.plane, 0.42);
			const dayColors = days.map((orders) => (orders >= mean ? strong : faint));
			return {
				type: 'bar',
				data: {
					labels: recentDays(days.length),
					datasets: [
						barSeries(strong, {
							label: 'Orders',
							data: days,
							backgroundColor: dayColors,
							hoverBackgroundColor: dayColors,
							borderRadius: 4,
							barPercentage: 0.72,
						}),
					],
				},
				options: chartOptions(colors, animated, {
					layout: { padding: { right: 62 } },
					scales: { x: { ticks: { maxTicksLimit: 6 } }, y: { suggestedMax: 100 } },
				}),
				plugins: [
					{
						id: 'barsAverage',
						afterDatasetsDraw(chart) {
							const {
								ctx,
								chartArea: area,
								scales: { y: axis },
							} = chart;
							const lineY = axis.getPixelForValue(mean);
							ctx.save();
							ctx.strokeStyle = colors.ink;
							ctx.lineWidth = 1.5;
							ctx.setLineDash([5, 4]);
							ctx.beginPath();
							ctx.moveTo(area.left, lineY);
							ctx.lineTo(area.right + 4, lineY);
							ctx.stroke();
							ctx.restore();
							/* The badge sits in the right margin, level with the line. */
							drawBadge(
								ctx,
								colors,
								area.right + 8,
								lineY,
								`Avg ${Math.round(mean)}`,
								area.right + 8,
								chart.width,
							);
						},
					},
				],
			};
		},

		range(colors, animated) {
			return {
				type: 'bar',
				data: {
					labels: FIXTURE.springToFall,
					datasets: [
						barSeries(colors.series[4], {
							label: 'Order value',
							data: FIXTURE.valueSpread,
							borderRadius: 999,
							borderSkipped: false,
							barPercentage: 0.4,
						}),
					],
				},
				options: chartOptions(colors, animated, {
					plugins: {
						tooltip: { callbacks: { label: (item) => ` $${item.raw[0]} to $${item.raw[1]}` } },
					},
					scales: {
						y: {
							beginAtZero: false,
							suggestedMin: 0,
							suggestedMax: 150,
							ticks: { stepSize: 50, callback: (value) => `$${value}` },
						},
					},
				}),
			};
		},

		multiple(colors, animated, sheet) {
			const wanted = sheet.getAttribute('data-bars-series');
			const slot = Math.max(
				0,
				FIXTURE.regions.findIndex(([key]) => key === wanted),
			);
			const values = FIXTURE.regions.find(([key]) => key === wanted)?.[1] || [];
			const hue = colors.series[slot];
			const muted = blend(hue, colors.plane, 0.5);
			/* Only the latest month is solid; the rest are half-strength. */
			const monthColors = values.map((_, at) => (at === values.length - 1 ? hue : muted));
			return {
				type: 'bar',
				data: {
					labels: FIXTURE.januaryToSeptember,
					datasets: [
						barSeries(hue, {
							label: 'Orders',
							data: values,
							backgroundColor: monthColors,
							hoverBackgroundColor: hue,
							borderRadius: 3,
							barPercentage: 0.78,
							categoryPercentage: 0.9,
						}),
					],
				},
				options: chartOptions(colors, animated, {
					layout: { padding: { top: 4, right: 2, left: 2, bottom: 2 } },
					plugins: { tooltip: { callbacks: { label: (item) => ` ${item.parsed.y} orders` } } },
					scales: { x: { display: false }, y: { display: false, min: 0, max: 440 } },
				}),
			};
		},

		labels(colors, animated) {
			const productColors = FIXTURE.repeatRate.map((_, slot) => colors.series[slot % colors.series.length]);
			return {
				type: 'bar',
				data: {
					labels: FIXTURE.repeatRate.map(([product]) => product),
					datasets: [
						barSeries(colors.series[0], {
							label: 'Repeat purchase',
							data: FIXTURE.repeatRate.map(([, rate]) => rate),
							backgroundColor: productColors,
							hoverBackgroundColor: productColors,
							barPercentage: 0.6,
						}),
					],
				},
				options: chartOptions(colors, animated, {
					layout: { padding: { top: 24 } },
					plugins: { tooltip: { enabled: false } },
					scales: {
						x: { ticks: { autoSkip: false, callback: twoLineTicks(9) } },
						y: { display: false, max: 100 },
					},
				}),
				plugins: [valueOverlay(colors, (value) => `${value}%`)],
			};
		},

		sorted(colors, animated) {
			const ranked = [...FIXTURE.shippedByCity].sort(([, a], [, b]) => b - a);
			const lead = colors.series[1];
			/* The leader keeps the full color; each city after it drifts further
         toward a second hue and fades toward the card surface. */
			const cityColors = ranked.map((_, place) =>
				place === 0
					? lead
					: blend(blend(lead, colors.series[3], place / (ranked.length - 1)), colors.plane, 0.3),
			);
			return {
				type: 'bar',
				data: {
					labels: ranked.map(([city]) => city),
					datasets: [
						barSeries(lead, {
							label: 'Orders shipped',
							data: ranked.map(([, shipped]) => shipped),
							backgroundColor: cityColors,
							hoverBackgroundColor: lead,
							barPercentage: 0.66,
						}),
					],
				},
				options: chartOptions(colors, animated, {
					scales: {
						x: { ticks: { autoSkip: false, maxRotation: 40 } },
						y: { suggestedMax: 500, ticks: { stepSize: 100 } },
					},
				}),
			};
		},

		gradient(colors, animated) {
			const hue = colors.series[0];
			return {
				type: 'bar',
				data: {
					labels: FIXTURE.januaryToSeptember,
					datasets: [
						barSeries(hue, {
							label: 'Revenue',
							data: FIXTURE.revenueK,
							barPercentage: 0.62,
							maxBarThickness: 56,
							backgroundColor: window.Basalt.chartFill([
								[0, hue],
								[1, blend(colors.series[1], colors.plane, 0.3)],
							]),
							hoverBackgroundColor: hue,
						}),
					],
				},
				options: chartOptions(colors, animated, {
					plugins: {
						tooltip: { callbacks: { label: (item) => ` ${dollars(Math.round(item.parsed.y * 1000))}` } },
					},
					scales: { y: { ticks: { callback: (value) => `$${value}k` } } },
				}),
			};
		},
	};

	/* The week picker swaps the basic chart's data in place. */
	function pickWeek(event) {
		const choice = event.target.closest('[data-bars-week]');
		if (!choice) return;
		activeWeek = choice.getAttribute('data-bars-week');
		for (const option of pickAll('[data-bars-week]', event.currentTarget)) {
			option.setAttribute('aria-pressed', String(option === choice));
		}
		const chart = drawn.get(pick('[data-bars-chart="basic"]', stage));
		if (!chart) return;
		chart.data.datasets[0].data = [...FIXTURE.ordersByWeek[activeWeek]];
		chart.update(stillMotion ? 'none' : undefined);
	}

	/**
	 * Shows the cards of one kind ("all" shows every card) and updates the
	 * live count. In a filtered view the cards pair up in halves, so a last
	 * card without a partner is stretched across the row.
	 * @param {string} kind - a data-bars-kind value, or "all"
	 */
	function showKind(kind) {
		const board = pick('[data-bars-grid]', stage);
		const everyCard = pickAll('.bars-card', board);
		const filtered = kind !== 'all';
		const visible = [];
		for (const card of everyCard) {
			const shown = !filtered || card.getAttribute('data-bars-kind') === kind;
			card.classList.toggle('is-hidden', !shown);
			card.classList.remove('is-alone');
			if (shown) visible.push(card);
		}
		board.classList.toggle('is-filtered', filtered);
		if (filtered) {
			const paired = visible.filter(
				(card) =>
					!card.classList.contains('bars-card-full') || card.classList.contains('bars-card-full-in-all'),
			);
			if (paired.length % 2) paired.at(-1).classList.add('is-alone');
		}
		const tally = pick('[data-bars-count]', stage);
		if (tally) tally.textContent = `${visible.length} ${visible.length === 1 ? 'chart' : 'charts'}`;
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
