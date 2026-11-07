/**
 * Mixed charts (mixed-charts.html).
 *
 * Ten Chart.js charts that put bars, lines, areas, bands and points on one
 * canvas each. Every chart is drawn the first time its card scrolls into
 * view, reading its colors from the --basalt-* tokens at that moment, and is
 * drawn again without animation on basalt:appearance, so a new palette, a
 * mode switch, a background change or Flat all reach the canvases. The chips
 * above the grid only hide cards. Nothing here is shared with other pages.
 */
(() => {
	'use strict';

	const TYPEFACE = "'Schibsted Grotesk', sans-serif";
	const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const SLOW_TICKET_DAYS = 5;
	const PROMO_WINDOW = [14, 20];
	const WEEKEND_CAPACITY = 60;
	const WEEKDAY_CAPACITY = 90;
	const stillMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/*
	 * Figures for Fieldline, the scheduling product the other chart pages
	 * describe: sold self-serve and through sales, with three paid add-ons.
	 * Revenue and costs are in $k; the last three revenue months are forecast.
	 * Support reasons add up to 400 messages for the quarter. Trials per
	 * weekday start on Sunday, as Date.getDay() counts.
	 */
	const FIGURES = {
		revenue: [42, 45, 51, 48, 55, 58, 54, 61, 66],
		forecast: [69, 73, 81],
		forecastLow: [63, 64, 68],
		forecastHigh: [75, 82, 94],
		budget: [38, 38, 40, 40, 42, 42, 44, 44, 46],
		costs: [36.2, 37.4, 40.4, 42.1, 43.2, 41.5, 42.9, 46.6, 45.1],
		reasons: [
			['Sync', 'Mobile app sync', 142],
			['Travel', 'Travel time errors', 88],
			['SMS', 'SMS delivery', 61],
			['Plan', 'Plan change', 44],
			['Refund', 'Refund request', 29],
			['Login', 'Trouble logging in', 18],
			['Other', 'Other', 18],
		],
		weekday: [71, 62, 68, 71, 75, 86, 70],
		channelMonths: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
		channels: [
			['Travel Planner', [22, 24, 25, 27, 28, 30]],
			['Customer Portal', [16, 15, 18, 17, 19, 21]],
			['SMS credits', [10, 11, 12, 13, 14, 15]],
		],
		newCustomers: [142, 138, 131, 136, 128, 124],
		returning: [96, 108, 117, 131, 139, 152],
		spend: [6, 6.5, 7, 8, 9, 10, 11.5, 13, 14],
		paidRate: [31, 30.5, 30, 28.5, 27, 26, 24.5, 23, 22],
	};

	/*
	 * Series derived from the figures above. Dates run up to today, so the
	 * daily charts always end on the day the page is opened.
	 */
	const ticketDots = ticketSamples();
	const ticketWeeks = weeklySpread(ticketDots);
	const capacityDays = recentDays(14);
	const ticketsPerDay = capacityDays.map((day, index) => FIGURES.weekday[day.getDay()] + (index >= 7 ? 4 : 0));
	const capacityPerDay = capacityDays.map((day) => (fallsOnWeekend(day) ? WEEKEND_CAPACITY : WEEKDAY_CAPACITY));
	const pricingDays = recentDays(28);
	const seatPrice = pricingDays.map((_, index) => (inPromo(index) ? 19.5 : 24));
	const seatsPerDay = seatSamples(pricingDays.length);
	const trialWindow = recentDays(35);
	const trialsAll = trialWindow.map((day, index) =>
		Math.round(FIGURES.weekday[day.getDay()] - 8 + index * 0.3 + Math.sin(index * 1.7) * 4),
	);
	const trialsSmoothed = trialsAll.map((_, index) => weekMean(trialsAll, index));
	const trialDaysShown = trialWindow.slice(7);
	const trialsShown = trialsAll.slice(7);
	const trialsAverageShown = trialsSmoothed.slice(7);

	/* The canvases that have been drawn, so a theme change can redraw them. */
	const drawn = new Map();
	let mixedPage;

	/**
	 * Finds the page, draws each chart when it first comes into view, redraws
	 * on theme changes and wires the filter chips.
	 */
	function start() {
		mixedPage = pick('[data-mixed-root]');
		if (!mixedPage || typeof Chart === 'undefined') return;

		const plots = Array.from(pickAll('canvas[data-mixed-chart]', mixedPage));
		if ('IntersectionObserver' in window) {
			const watcher = new IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						if (!entry.isIntersecting) continue;
						watcher.unobserve(entry.target);
						paintChart(entry.target, true);
					}
				},
				{ rootMargin: '80px 0px' },
			);
			for (const plot of plots) watcher.observe(plot);
		} else {
			for (const plot of plots) paintChart(plot, false);
		}

		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() => {
				for (const plot of drawn.keys()) paintChart(plot, false);
			});
		});

		wireFilter();
	}

	/**
	 * Builds the recipe named by the canvas with the current theme colors,
	 * replacing any chart already on it.
	 */
	function paintChart(plot, animated) {
		const recipe = RECIPES[plot.getAttribute('data-mixed-chart')];
		if (!recipe) return;
		drawn.get(plot)?.destroy();
		const theme = tokensNow();
		const config = recipe(theme, animated && !stillMotion, plot);
		config.plugins = [...(config.plugins || []), glowPlugin(theme)];
		drawn.set(plot, new Chart(plot, config));
	}

	/*
	 * Colors. Tokens arrive as #rrggbb or rgba() strings and Chart.js wants
	 * plain strings back, so the mixing happens here instead of in CSS.
	 */

	function themeToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	function rgbaOf(color) {
		const value = String(color || '').trim();
		const short = /^#([0-9a-f]{3})$/i.exec(value);
		if (short) return [...short[1]].map((digit) => parseInt(digit + digit, 16)).concat(1);
		const long = /^#([0-9a-f]{6})$/i.exec(value);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 1];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(value);
		if (functional) {
			const triplet = functional[1].split(',').map((part) => parseFloat(part));
			return [triplet[0], triplet[1], triplet[2], triplet.length > 3 ? triplet[3] : 1];
		}
		return [128, 128, 128, 1];
	}

	function alphaOf(color, alpha) {
		const [red, green, blue] = rgbaOf(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	function blend(front, back, share) {
		const a = rgbaOf(front);
		const b = rgbaOf(back);
		const part = (index) => Math.round(a[index] * share + b[index] * (1 - share));
		return `rgb(${part(0)}, ${part(1)}, ${part(2)})`;
	}

	function tokensNow() {
		const ink = themeToken('--basalt-copy', '#12233a');
		const dim = themeToken('--basalt-copy-muted', '#5f7186');
		return {
			series: [1, 2, 3, 4, 5, 6, 7, 8].map((step) => themeToken(`--basalt-series-${step}`, '#2b6fd4')),
			text: ink,
			quiet: blend(dim, ink, 0.82),
			rest: alphaOf(ink, 0.3),
			grid: alphaOf(ink, 0.07),
			surface: themeToken('--basalt-plane', '#ffffff'),
			border: themeToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			success: themeToken('--basalt-success', '#12c08f'),
			danger: themeToken('--basalt-danger', '#ef4d63'),
			warning: themeToken('--basalt-warning', '#f5a524'),
		};
	}

	function isFlat() {
		return document.documentElement.getAttribute('data-basalt-gradients') === 'off';
	}

	/*
	 * Options every chart starts from. A recipe passes its own overrides,
	 * which are merged in depth so one tooltip callback or one axis can be
	 * swapped without repeating the rest.
	 */

	function isPlainObject(value) {
		return !!value && typeof value === 'object' && !Array.isArray(value);
	}

	function foldInto(base, overrides) {
		const result = { ...base };
		for (const [key, value] of Object.entries(overrides || {})) {
			result[key] = isPlainObject(value) && isPlainObject(result[key]) ? foldInto(result[key], value) : value;
		}
		return result;
	}

	const tickTypeface = { family: TYPEFACE, size: 11.5 };

	function axisTicks(theme, overrides) {
		return { color: theme.quiet, font: tickTypeface, padding: 8, ...overrides };
	}

	function stockOptions(theme, animated, overrides) {
		const stock = {
			responsive: true,
			maintainAspectRatio: false,
			animation: animated ? { duration: 500, easing: 'easeOutQuart' } : false,
			interaction: { mode: 'index', intersect: false },
			layout: { padding: { top: 6, right: 6 } },
			elements: {
				line: { borderWidth: 2.5, borderCapStyle: 'round', borderJoinStyle: 'round' },
				point: { radius: 0, hoverRadius: 5, hoverBorderWidth: 2, hoverBorderColor: theme.surface },
				bar: { borderRadius: 6, borderSkipped: 'start' },
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					backgroundColor: theme.surface,
					titleColor: theme.text,
					bodyColor: theme.text,
					footerColor: theme.quiet,
					borderColor: theme.border,
					borderWidth: 1,
					padding: 10,
					cornerRadius: 8,
					boxPadding: 4,
					usePointStyle: true,
					titleFont: { family: TYPEFACE, size: 12, weight: '600' },
					bodyFont: { family: TYPEFACE, size: 12 },
					footerFont: { family: TYPEFACE, size: 11.5, weight: '600' },
				},
			},
			scales: {
				x: {
					grid: { display: false },
					border: { display: false },
					ticks: axisTicks(theme, { maxRotation: 0, autoSkipPadding: 12 }),
				},
				y: {
					grid: { color: theme.grid },
					border: { display: false },
					ticks: axisTicks(theme, { maxTicksLimit: 5 }),
				},
			},
		};
		return foldInto(stock, overrides);
	}

	/*
	 * Fills. A vertical fade is built per draw over the plot area; with
	 * gradients off, bars and areas come out flat.
	 */

	/* A top-to-bottom fade across the plot; with gradients off, one plain
	   color: `flat`, or the first stop. */
	function verticalFade(stops, flat) {
		return window.Basalt.chartFill(stops, { flat });
	}

	function barFade(color, topAlpha = 0.95, bottomAlpha = 0.42) {
		return verticalFade([
			[0, alphaOf(color, topAlpha)],
			[1, alphaOf(color, bottomAlpha)],
		]);
	}

	function areaFade(color, strength = 0.26) {
		return verticalFade([
			[0, alphaOf(color, isFlat() ? 0.12 : strength)],
			[1, alphaOf(color, 0)],
		]);
	}

	/* Datasets: bars sit behind (order 2), lines ride on top (order 0). */

	function barSeries(color, overrides) {
		return {
			type: 'bar',
			backgroundColor: barFade(color),
			hoverBackgroundColor: color,
			barPercentage: 0.58,
			categoryPercentage: 0.8,
			maxBarThickness: 30,
			order: 2,
			...overrides,
		};
	}

	function lineSeries(color, overrides) {
		return {
			type: 'line',
			order: 0,
			borderColor: color,
			backgroundColor: color,
			pointBackgroundColor: color,
			pointHoverBackgroundColor: color,
			tension: 0.35,
			...overrides,
		};
	}

	function hollowPoints(theme, color, radius = 3.5) {
		return {
			pointRadius: radius,
			pointHoverRadius: 5.5,
			pointBackgroundColor: theme.surface,
			pointBorderColor: color,
			pointBorderWidth: 2,
			pointHoverBackgroundColor: color,
			pointHoverBorderColor: theme.surface,
		};
	}

	function bandSeries(label, data, overrides) {
		return { type: 'line', label, data, borderWidth: 0, pointRadius: 0, pointHoverRadius: 0, ...overrides };
	}

	function onlyLast(index, radius) {
		return (context) => (context.dataIndex === index ? radius : 0);
	}

	/*
	 * Notes drawn straight onto the canvas: a bordered pill in the card color
	 * with body text and an optional series dot, kept inside the edges it is
	 * given, and plain text in body or quiet gray.
	 */

	function drawPill(ctx, theme, x, y, label, bounds, options = {}) {
		const dotWidth = options.dot ? 12 : 0;
		const pillHeight = 21;
		ctx.save();
		ctx.font = `600 11px ${TYPEFACE}`;
		const width = ctx.measureText(label).width + 16 + dotWidth;
		const wanted = options.align === 'left' ? x : options.align === 'right' ? x - width : x - width / 2;
		const left = Math.max(bounds.left, Math.min(wanted, bounds.right - width));
		const top = Math.max(bounds.top ?? -Infinity, y - pillHeight);
		ctx.fillStyle = theme.surface;
		ctx.strokeStyle = theme.border;
		ctx.lineWidth = 1;
		ctx.beginPath();
		if (ctx.roundRect) ctx.roundRect(left, top, width, pillHeight, 10.5);
		else ctx.rect(left, top, width, pillHeight);
		ctx.fill();
		ctx.stroke();
		if (options.dot) {
			ctx.fillStyle = options.dot;
			ctx.beginPath();
			ctx.arc(left + 11, top + pillHeight / 2, 3.5, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.fillStyle = theme.text;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(label, left + 8 + dotWidth, top + pillHeight / 2 + 0.5);
		ctx.restore();
		return { left, top, w: width, h: pillHeight };
	}

	function drawLabel(ctx, color, label, x, y, align = 'left', weight = 600, baseline = 'bottom') {
		ctx.save();
		ctx.font = `${weight} 11.5px ${TYPEFACE}`;
		ctx.fillStyle = color;
		ctx.textAlign = align;
		ctx.textBaseline = baseline;
		ctx.fillText(label, x, y);
		ctx.restore();
	}

	function measure(ctx, label) {
		ctx.save();
		ctx.font = `600 11.5px ${TYPEFACE}`;
		const width = ctx.measureText(label).width;
		ctx.restore();
		return width;
	}

	function roundedBox(ctx, x, y, width, height, radius) {
		ctx.beginPath();
		if (ctx.roundRect) ctx.roundRect(x, y, width, height, radius);
		else ctx.rect(x, y, width, height);
		ctx.fill();
	}

	/**
	 * A plugin for the notes drawn over a chart. Hooks get the context and
	 * the plot area along with the chart: `before` runs under the datasets,
	 * `after` over them and `last` over everything.
	 */
	function overlay(id, hooks) {
		const plugin = { id };
		const hookNames = { before: 'beforeDatasetsDraw', after: 'afterDatasetsDraw', last: 'afterDraw' };
		for (const [short, hookName] of Object.entries(hookNames)) {
			if (hooks[short]) plugin[hookName] = (chart) => hooks[short](chart, chart.ctx, chart.chartArea);
		}
		return plugin;
	}

	/**
	 * Lines with a `glow` color get a soft shadow in that color; other lines
	 * get a thin halo in the card color so they stay readable over bars of
	 * the same hue. Flat mode keeps only the halo.
	 */
	function glowPlugin(theme) {
		return {
			id: 'mixedGlow',
			beforeDatasetDraw(chart, args) {
				if (args.meta.type !== 'line') return;
				const lineData = chart.data.datasets[args.index];
				const ctx = chart.ctx;
				ctx.save();
				if (lineData.glow && !isFlat()) {
					ctx.shadowColor = alphaOf(lineData.glow, 0.45);
					ctx.shadowBlur = 10;
					ctx.shadowOffsetY = 4;
				} else {
					ctx.shadowColor = theme.surface;
					ctx.shadowBlur = 5;
				}
			},
			afterDatasetDraw(chart, args) {
				if (args.meta.type !== 'line') return;
				chart.ctx.restore();
			},
		};
	}

	/* Numbers, dates and the sample generators behind the derived series. */

	function thousands(value) {
		return `$${value}k`;
	}

	function percent(value) {
		return `${value}%`;
	}

	function recentDays(count) {
		const now = new Date();
		return Array.from({ length: count }, (_, index) => {
			const day = new Date(now);
			day.setDate(now.getDate() - (count - 1 - index));
			return day;
		});
	}

	function shortDay(day) {
		return day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function fullDay(day) {
		return day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
	}

	function fallsOnWeekend(day) {
		return day.getDay() === 0 || day.getDay() === 6;
	}

	function inPromo(index) {
		return index >= PROMO_WINDOW[0] && index <= PROMO_WINDOW[1];
	}

	function tenths(value) {
		return Math.round(value * 10) / 10;
	}

	function mean(values) {
		return values.reduce((sum, value) => sum + value, 0) / values.length;
	}

	/** A fixed-seed generator, so the dots land in the same places on every load. */
	function pseudoRandom(seed) {
		let seedState = seed;
		return () => {
			seedState = (seedState * 16807) % 2147483647;
			return (seedState - 1) / 2147483646;
		};
	}

	/** Six tickets a week for twelve weeks, drifting faster, with the odd slow one. */
	function ticketSamples() {
		const roll = pseudoRandom(20);
		const points = [];
		for (let week = 1; week <= 12; week += 1) {
			const middle = 3.4 - (week - 1) * 0.07;
			for (let ticketIndex = 0; ticketIndex < 6; ticketIndex += 1) {
				const slow = roll() > 0.9 ? 2 + roll() * 1.6 : 0;
				const taken = Math.max(1, middle + (roll() - 0.5) * 1.6 + slow);
				points.push({ x: week + (ticketIndex - 2.5) * 0.09, y: tenths(taken) });
			}
		}
		return points;
	}

	/** Per week: the median and the second to fifth ticket of the six. */
	function weeklySpread(points) {
		return Array.from({ length: 12 }, (_, week) => {
			const ascending = points
				.slice(week * 6, week * 6 + 6)
				.map((point) => point.y)
				.sort((a, b) => a - b);
			return {
				x: week + 1,
				median: tenths((ascending[2] + ascending[3]) / 2),
				low: ascending[1],
				high: ascending[4],
			};
		});
	}

	/** New seats a day: a promotion week in the middle, and a higher floor after it. */
	function seatSamples(count) {
		const roll = pseudoRandom(7);
		return Array.from({ length: count }, (_, index) => {
			const floor = inPromo(index) ? 84 : index > PROMO_WINDOW[1] ? 46 : 40;
			return Math.round(floor + (roll() - 0.5) * 12);
		});
	}

	/** The trailing seven-day mean, or null for the first six days. */
	function weekMean(values, index) {
		if (index < 6) return null;
		return tenths(mean(values.slice(index - 6, index + 1)));
	}

	/*
	 * One recipe per canvas, keyed by its data-mixed-chart value. Each takes
	 * the theme colors and whether to animate, and returns a Chart.js config.
	 */
	const RECIPES = {
		/* Bars for the months in hand, then a dashed forecast inside its band. */
		forecast(theme, animated) {
			const barColor = theme.series[0];
			const lineColor = theme.series[4];
			const known = FIGURES.revenue.length;
			const seam = known - 1;
			const continued = (values) =>
				MONTH_SHORT.map((_, index) =>
					index < seam ? null : index === seam ? FIGURES.revenue[seam] : values[index - known],
				);
			const booked = MONTH_SHORT.map((_, index) => (index < known ? FIGURES.revenue[index] : null));
			const hideKnownForecast = (item) =>
				item.parsed.y !== null &&
				!['High', 'Low'].includes(item.dataset.label) &&
				!(item.dataset.label === 'Forecast' && item.dataIndex < known);
			const likelyRange = (items) => {
				const index = items[0].dataIndex;
				return index < known
					? ''
					: `Likely ${thousands(FIGURES.forecastLow[index - known])} to ${thousands(FIGURES.forecastHigh[index - known])}`;
			};
			return {
				type: 'bar',
				data: {
					labels: MONTH_SHORT,
					datasets: [
						lineSeries(lineColor, {
							label: 'Forecast',
							data: continued(FIGURES.forecast),
							borderDash: [6, 5],
							tension: 0.3,
							glow: lineColor,
							...hollowPoints(theme, lineColor),
							pointRadius: onlyLast(11, 4.5),
						}),
						bandSeries('High', continued(FIGURES.forecastHigh), {
							fill: '+1',
							backgroundColor: alphaOf(lineColor, isFlat() ? 0.14 : 0.18),
							tension: 0.3,
							order: 1,
						}),
						bandSeries('Low', continued(FIGURES.forecastLow), { fill: false, tension: 0.3, order: 1 }),
						barSeries(barColor, {
							label: 'Revenue',
							data: booked,
							grouped: false,
							barPercentage: 0.56,
							maxBarThickness: 44,
						}),
					],
				},
				options: stockOptions(theme, animated, {
					layout: { padding: { top: 30, right: 8 } },
					plugins: {
						tooltip: {
							filter: hideKnownForecast,
							callbacks: {
								label: (item) => ` ${item.dataset.label}: ${thousands(item.parsed.y)}`,
								footer: likelyRange,
							},
						},
					},
					scales: {
						x: { ticks: { maxTicksLimit: 12 } },
						y: { beginAtZero: true, max: 100, ticks: { stepSize: 25, callback: thousands } },
					},
				}),
				plugins: [
					overlay('mixedForecastNotes', {
						after: (chart, ctx, area) => {
							const december = chart.getDatasetMeta(0).data[11];
							if (!december) return;
							drawPill(
								ctx,
								theme,
								december.x,
								december.y - 12,
								`Dec · ${thousands(FIGURES.forecast[2])} forecast`,
								{ left: area.left, right: area.right + 6, top: 0 },
								{ dot: lineColor },
							);
						},
					}),
				],
			};
		},

		/* Spend bars under a stepped budget line; months over budget go red. */
		budget(theme, animated) {
			const barColor = theme.series[7];
			const overBy = (index) => tenths(FIGURES.costs[index] - FIGURES.budget[index]);
			const withinFill = barFade(barColor);
			const overFill = barFade(theme.danger);
			return {
				type: 'bar',
				data: {
					labels: MONTH_SHORT.slice(0, FIGURES.budget.length),
					datasets: [
						lineSeries(theme.text, {
							label: 'Budget',
							data: FIGURES.budget,
							borderColor: theme.rest,
							borderWidth: 2,
							borderDash: [6, 5],
							stepped: 'middle',
							pointRadius: 0,
							pointHoverRadius: 0,
						}),
						barSeries(barColor, {
							label: 'Spend',
							data: FIGURES.costs,
							maxBarThickness: 34,
							backgroundColor: (context) =>
								overBy(context.dataIndex) > 0 ? overFill(context) : withinFill(context),
							hoverBackgroundColor: FIGURES.costs.map((_, index) =>
								overBy(index) > 0 ? theme.danger : barColor,
							),
						}),
					],
				},
				options: stockOptions(theme, animated, {
					interaction: { mode: 'index', intersect: false },
					plugins: {
						tooltip: {
							itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
							callbacks: {
								label: (item) => ` ${item.dataset.label}: ${thousands(item.parsed.y)}`,
								footer: (items) => {
									const gap = overBy(items[0].dataIndex);
									return gap > 0 ? `Over by ${thousands(gap)}` : `Under by ${thousands(-gap)}`;
								},
							},
						},
					},
					scales: { y: { min: 0, max: 50, ticks: { stepSize: 25, callback: thousands } } },
				}),
			};
		},

		/* Every ticket as a dot, the middle half of each week as a band, and the
       weekly median as the line through it. */
		scatter(theme, animated) {
			const color = theme.series[3];
			const latest = ticketWeeks[ticketWeeks.length - 1];
			const isSlow = (context) => context.raw && context.raw.y > SLOW_TICKET_DAYS;
			const weekPoints = (key) => ticketWeeks.map((week) => ({ x: week.x, y: week[key] }));
			const oddWeeksOnly = (value) => (Number.isInteger(value) && value % 2 === 1 ? `Wk ${value}` : '');
			return {
				type: 'scatter',
				data: {
					datasets: [
						lineSeries(color, {
							label: 'Weekly median',
							data: weekPoints('median'),
							glow: color,
							...hollowPoints(theme, color, 0),
							pointRadius: onlyLast(11, 4.5),
						}),
						bandSeries('High', weekPoints('high'), {
							tension: 0.35,
							fill: '+1',
							backgroundColor: alphaOf(color, isFlat() ? 0.14 : 0.16),
							order: 2,
						}),
						bandSeries('Low', weekPoints('low'), { tension: 0.35, fill: false, order: 2 }),
						{
							label: 'Ticket',
							data: ticketDots,
							order: 1,
							pointRadius: (context) => (isSlow(context) ? 4 : 3),
							pointHoverRadius: 5.5,
							pointBackgroundColor: (context) => (isSlow(context) ? theme.danger : alphaOf(color, 0.5)),
							pointBorderColor: (context) => (isSlow(context) ? theme.surface : 'transparent'),
							pointBorderWidth: 1.5,
							pointHoverBackgroundColor: (context) => (isSlow(context) ? theme.danger : color),
						},
					],
				},
				options: stockOptions(theme, animated, {
					layout: { padding: { top: 26, right: 10 } },
					interaction: { mode: 'nearest', intersect: true },
					plugins: {
						tooltip: {
							filter: (item) => item.dataset.label === 'Ticket' || item.dataset.label === 'Weekly median',
							callbacks: {
								title: (items) => `Week ${Math.round(items[0].parsed.x)}`,
								label: (item) =>
									item.dataset.label === 'Ticket'
										? ` One ticket: ${item.parsed.y} days`
										: ` Median: ${item.parsed.y} days`,
							},
						},
					},
					scales: {
						x: {
							type: 'linear',
							min: 0.5,
							max: 12.5,
							ticks: { stepSize: 1, autoSkip: true, maxTicksLimit: 7, callback: oddWeeksOnly },
						},
						y: { min: 1, max: 7, ticks: { stepSize: 2, callback: (value) => `${value}d` } },
					},
				}),
				plugins: [
					overlay('mixedNow', {
						after: (chart, ctx, area) => {
							const { x } = chart.scales;
							const end = chart.getDatasetMeta(0).data[11];
							if (!end) return;
							drawPill(
								ctx,
								theme,
								x.getPixelForValue(12) + 6,
								end.y + 36,
								`Median now ${latest.median} days`,
								{ left: area.left, right: area.right + 10, top: 0 },
								{ align: 'right', dot: color },
							);
						},
					}),
				],
			};
		},

		/* Price in the upper panel, new seats in the lower one, and the promo
       week shaded through both. */
		'stacked-axes'(theme, animated) {
			const priceColor = theme.series[5];
			const seatColor = theme.series[1];
			const beforePromo = seatsPerDay.slice(0, PROMO_WINDOW[0]);
			const duringPromo = seatsPerDay.slice(PROMO_WINDOW[0], PROMO_WINDOW[1] + 1);
			const lift = (mean(duringPromo) / mean(beforePromo)).toFixed(1);
			const stackedAxis = (weight, overrides) => ({
				type: 'linear',
				position: 'left',
				stack: 'panel',
				stackWeight: weight,
				offset: true,
				...overrides,
			});
			return {
				type: 'bar',
				data: {
					labels: pricingDays.map(shortDay),
					datasets: [
						lineSeries(priceColor, {
							label: 'Price',
							data: seatPrice,
							yAxisID: 'price',
							stepped: 'middle',
							tension: 0,
							fill: 'start',
							backgroundColor: areaFade(priceColor, 0.14),
							glow: priceColor,
						}),
						barSeries(seatColor, {
							label: 'New seats',
							data: seatsPerDay,
							yAxisID: 'seats',
							barPercentage: 0.62,
							categoryPercentage: 0.9,
							maxBarThickness: 16,
							borderRadius: 4,
						}),
					],
				},
				options: stockOptions(theme, animated, {
					layout: { padding: { top: 30 } },
					plugins: {
						tooltip: {
							callbacks: {
								title: (items) => fullDay(pricingDays[items[0].dataIndex]),
								label: (item) =>
									item.dataset.label === 'Price'
										? ` Price: $${item.parsed.y.toFixed(2)}`
										: ` New seats: ${item.parsed.y}`,
								footer: (items) => (inPromo(items[0].dataIndex) ? 'Promo week' : ''),
							},
						},
					},
					/* Stacked axes draw bottom-up in the order listed; the blank one in
             the middle keeps the panels apart. */
					scales: {
						x: { ticks: { maxTicksLimit: 8 } },
						y: { display: false },
						seats: stackedAxis(2, {
							min: 0,
							max: 100,
							grid: { color: theme.grid },
							border: { display: false },
							ticks: axisTicks(theme, { stepSize: 50 }),
						}),
						gap: stackedAxis(0.35, {
							grid: { display: false },
							border: { display: false },
							ticks: { display: false },
						}),
						price: stackedAxis(1.6, {
							min: 18,
							max: 26,
							grid: { color: theme.grid },
							border: { display: false },
							ticks: axisTicks(theme, { stepSize: 4, callback: (value) => `$${value}` }),
						}),
					},
				}),
				plugins: [
					overlay('mixedPromo', {
						before: (chart, ctx, area) => {
							const { x } = chart.scales;
							const halfSlot = (x.getPixelForValue(1) - x.getPixelForValue(0)) / 2;
							const promoStart = x.getPixelForValue(PROMO_WINDOW[0]) - halfSlot;
							const promoEnd = x.getPixelForValue(PROMO_WINDOW[1]) + halfSlot;
							ctx.save();
							ctx.fillStyle = alphaOf(theme.warning, 0.1);
							roundedBox(
								ctx,
								promoStart,
								area.top - 22,
								promoEnd - promoStart,
								area.bottom - area.top + 22,
								8,
							);
							ctx.restore();
						},
						after: (chart, ctx, area) => {
							const { x, price, seats } = chart.scales;
							const middle =
								(x.getPixelForValue(PROMO_WINDOW[0]) + x.getPixelForValue(PROMO_WINDOW[1])) / 2;
							const wholeWidth = { left: area.left, right: area.right, top: 0 };
							const afterName = area.left + 2 + measure(ctx, 'Price per seat') + 10;
							drawPill(
								ctx,
								theme,
								middle,
								area.top - 2,
								'Promo · $19.50 a seat',
								{ left: afterName, right: area.right, top: 0 },
								{ dot: theme.warning },
							);
							drawPill(
								ctx,
								theme,
								middle,
								seats.getPixelForValue(100) + 4,
								`${lift}× the seats a day`,
								wholeWidth,
								{ dot: seatColor },
							);
							drawLabel(ctx, theme.quiet, 'Price per seat', area.left + 2, price.top - 6, 'left');
							drawLabel(ctx, theme.quiet, 'New seats', area.left + 2, seats.top - 4, 'left');
						},
					}),
				],
			};
		},

		/* Three products stacked, with the total written above each month. */
		stacked(theme, animated) {
			const monthTotals = FIGURES.channelMonths.map((_, month) =>
				FIGURES.channels.reduce((sum, channel) => sum + channel[1][month], 0),
			);
			const topmost = FIGURES.channels.length - 1;
			const productBars = FIGURES.channels.map(([name, values], index) =>
				barSeries(theme.series[index], {
					label: name,
					data: values,
					stack: 'revenue',
					backgroundColor:
						index === 0 ? barFade(theme.series[index], 0.95, 0.72) : alphaOf(theme.series[index], 0.9),
					borderRadius: index === topmost ? { topLeft: 7, topRight: 7 } : 0,
					borderColor: theme.surface,
					borderWidth: index === 0 ? 0 : { bottom: 2 },
					borderSkipped: false,
					barPercentage: 0.56,
					maxBarThickness: 40,
				}),
			);
			const totalLine = lineSeries(theme.text, {
				label: 'Total',
				data: monthTotals,
				stack: 'total',
				tension: 0.3,
				borderWidth: 2,
				...hollowPoints(theme, theme.text),
			});
			const growth = Math.round((monthTotals[monthTotals.length - 1] / monthTotals[0] - 1) * 100);
			const totalFirst = (a, b) =>
				a.datasetIndex === 0 ? 1 : b.datasetIndex === 0 ? -1 : b.datasetIndex - a.datasetIndex;
			return {
				type: 'bar',
				data: { labels: FIGURES.channelMonths, datasets: [totalLine, ...productBars] },
				options: stockOptions(theme, animated, {
					layout: { padding: { top: 30 } },
					plugins: {
						tooltip: {
							itemSort: totalFirst,
							callbacks: { label: (item) => ` ${item.dataset.label}: ${thousands(item.parsed.y)}` },
						},
					},
					scales: {
						x: { stacked: true },
						y: { stacked: true, beginAtZero: true, max: 80, ticks: { stepSize: 20, callback: thousands } },
					},
				}),
				plugins: [
					overlay('mixedTotals', {
						after: (chart, ctx, area) => {
							const points = chart.getDatasetMeta(0).data;
							for (const [index, point] of points.entries())
								drawLabel(
									ctx,
									theme.text,
									thousands(monthTotals[index]),
									point.x,
									point.y - 9,
									'center',
								);
							drawPill(
								ctx,
								theme,
								area.left + 4,
								area.top + 4,
								`Total up ${growth}% since April`,
								{ left: area.left, right: area.right, top: 0 },
								{ align: 'left', dot: theme.text },
							);
						},
					}),
				],
			};
		},

		/* Thin pale daily bars so the seven-day average reads first. */
		average(theme, animated) {
			const color = theme.series[7];
			const lastIndex = trialsShown.length - 1;
			return {
				type: 'bar',
				data: {
					labels: trialDaysShown.map(shortDay),
					datasets: [
						lineSeries(color, {
							label: '7-day average',
							data: trialsAverageShown,
							borderWidth: 2.75,
							tension: 0.45,
							fill: 'origin',
							backgroundColor: areaFade(color, 0.22),
							glow: color,
							...hollowPoints(theme, color, 0),
							pointRadius: onlyLast(lastIndex, 5),
							pointBorderWidth: 2.5,
						}),
						barSeries(color, {
							label: 'Trials',
							data: trialsShown,
							backgroundColor: barFade(color, 0.45, 0.12),
							hoverBackgroundColor: alphaOf(color, 0.8),
							barPercentage: 0.5,
							categoryPercentage: 1,
							maxBarThickness: 10,
							borderRadius: 4,
						}),
					],
				},
				options: stockOptions(theme, animated, {
					layout: { padding: { top: 30, right: 8 } },
					plugins: {
						tooltip: {
							itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
							callbacks: {
								title: (items) => fullDay(trialDaysShown[items[0].dataIndex]),
								label: (item) => ` ${item.dataset.label}: ${item.parsed.y}`,
							},
						},
					},
					scales: {
						x: { ticks: { maxTicksLimit: 5 } },
						y: { beginAtZero: true, max: 100, ticks: { stepSize: 25 } },
					},
				}),
				plugins: [
					overlay('mixedLatest', {
						after: (chart, ctx, area) => {
							const end = chart.getDatasetMeta(0).data[lastIndex];
							if (!end) return;
							drawPill(
								ctx,
								theme,
								end.x,
								end.y - 12,
								`Today · ${Math.round(trialsAverageShown[lastIndex])} a day on average`,
								{ left: area.left, right: area.right + 8, top: 0 },
								{ align: 'right', dot: color },
							);
						},
					}),
				],
			};
		},

		/* Tickets in one calm color, with the part the team could not answer
       that day stacked on top in the warning color. */
		area(theme, animated) {
			const color = theme.series[0];
			const answered = ticketsPerDay.map((value, index) => Math.min(value, capacityPerDay[index]));
			const overflow = ticketsPerDay.map((value, index) => Math.max(0, value - capacityPerDay[index]));
			const worstDay = overflow.indexOf(Math.max(...overflow));
			const roundTop = { topLeft: 6, topRight: 6 };
			return {
				type: 'bar',
				data: {
					labels: capacityDays.map(shortDay),
					datasets: [
						{
							type: 'line',
							label: 'Team capacity',
							data: capacityPerDay,
							stack: 'capacity',
							order: 3,
							stepped: 'middle',
							fill: 'start',
							borderColor: theme.rest,
							borderWidth: 1.5,
							borderDash: [4, 4],
							pointRadius: 0,
							pointHoverRadius: 0,
							backgroundColor: alphaOf(theme.text, 0.05),
						},
						barSeries(color, {
							label: 'Answered same day',
							data: answered,
							stack: 'tickets',
							barPercentage: 0.56,
							maxBarThickness: 24,
							borderRadius: (context) => (overflow[context.dataIndex] ? 0 : roundTop),
							borderSkipped: false,
						}),
						barSeries(theme.warning, {
							label: 'Over capacity',
							data: overflow.map((value) => value || null),
							stack: 'tickets',
							barPercentage: 0.56,
							maxBarThickness: 24,
							backgroundColor: theme.warning,
							borderRadius: roundTop,
							borderSkipped: false,
						}),
					],
				},
				options: stockOptions(theme, animated, {
					layout: { padding: { top: 26 } },
					plugins: {
						tooltip: {
							filter: (item) => item.parsed.y !== null,
							itemSort: (a, b) => a.datasetIndex - b.datasetIndex,
							callbacks: {
								title: (items) => fullDay(capacityDays[items[0].dataIndex]),
								label: (item) => ` ${item.dataset.label}: ${item.parsed.y}`,
								footer: (items) => {
									const index = items[0].dataIndex;
									const waiting = overflow[index] ? `, ${overflow[index]} wait for the next day` : '';
									return `${ticketsPerDay[index]} tickets in all${waiting}`;
								},
							},
						},
					},
					scales: {
						x: { stacked: true, ticks: { maxTicksLimit: 7 } },
						y: { stacked: true, beginAtZero: true, max: 120, ticks: { stepSize: 30 } },
					},
				}),
				plugins: [
					overlay('mixedOverflow', {
						after: (chart, ctx, area) => {
							const bar = chart.getDatasetMeta(2).data[worstDay];
							if (!bar || !overflow[worstDay]) return;
							drawPill(
								ctx,
								theme,
								bar.x,
								bar.y - 8,
								`+${overflow[worstDay]} wait for the next day`,
								{ left: area.left, right: area.right + 6, top: 0 },
								{ dot: theme.warning },
							);
						},
					}),
				],
			};
		},

		/* Reasons by share with a running total; the few inside 80% keep the
       color and the long tail fades. */
		pareto(theme, animated) {
			const color = theme.series[2];
			const allMessages = FIGURES.reasons.reduce((sum, reason) => sum + reason[2], 0);
			const shares = FIGURES.reasons.map((reason) => Math.round((reason[2] / allMessages) * 1000) / 10);
			let soFar = 0;
			const cumulative = shares.map((share) => {
				soFar += share;
				return tenths(soFar);
			});
			const vital = cumulative.findIndex((value) => value >= 80);
			const strongFill = barFade(color);
			const faintFill = barFade(color, 0.34, 0.14);
			return {
				type: 'bar',
				data: {
					labels: FIGURES.reasons.map((reason) => reason[0]),
					datasets: [
						lineSeries(theme.text, {
							label: 'Running total',
							data: cumulative,
							tension: 0.3,
							borderWidth: 2,
							...hollowPoints(theme, theme.text),
						}),
						barSeries(color, {
							label: 'Share',
							data: shares,
							barPercentage: 0.62,
							maxBarThickness: 40,
							backgroundColor: (context) =>
								context.dataIndex <= vital ? strongFill(context) : faintFill(context),
							hoverBackgroundColor: (context) =>
								context.dataIndex <= vital ? color : alphaOf(color, 0.55),
						}),
					],
				},
				options: stockOptions(theme, animated, {
					layout: { padding: { top: 26 } },
					plugins: {
						tooltip: {
							itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
							callbacks: {
								title: (items) => FIGURES.reasons[items[0].dataIndex][1],
								label: (item) =>
									item.dataset.label === 'Share'
										? ` ${FIGURES.reasons[item.dataIndex][2]} messages, ${item.parsed.y}%`
										: ` Running total: ${item.parsed.y}%`,
							},
						},
					},
					scales: {
						x: { ticks: { autoSkip: false, maxRotation: 50 } },
						y: { min: 0, max: 100, ticks: { stepSize: 25, callback: percent } },
					},
				}),
				plugins: [
					overlay('mixedEighty', {
						before: (chart, ctx, area) => {
							const { y } = chart.scales;
							const mark = y.getPixelForValue(80);
							ctx.save();
							ctx.strokeStyle = theme.rest;
							ctx.lineWidth = 1.25;
							ctx.setLineDash([2, 4]);
							ctx.beginPath();
							ctx.moveTo(area.left, mark);
							ctx.lineTo(area.right, mark);
							ctx.stroke();
							ctx.restore();
						},
						after: (chart, ctx, area) => {
							const point = chart.getDatasetMeta(0).data[vital];
							if (!point) return;
							drawPill(
								ctx,
								theme,
								point.x + 10,
								point.y + 26,
								`Top ${vital + 1} · ${Math.round(cumulative[vital])}% of messages`,
								{ left: area.left, right: area.right + 6, top: 0 },
								{ align: 'left', dot: color },
							);
						},
					}),
				],
			};
		},

		/* Spend on the left axis, conversion on the right, each named above its
       own column of numbers in its own color. */
		dual(theme, animated) {
			const barColor = theme.series[0];
			const lineColor = theme.series[4];
			const lastIndex = FIGURES.spend.length - 1;
			const sideAxis = (position, overrides) => ({
				type: 'linear',
				position,
				border: { display: false },
				...overrides,
			});
			return {
				type: 'bar',
				data: {
					labels: MONTH_SHORT.slice(0, FIGURES.spend.length),
					datasets: [
						lineSeries(lineColor, {
							label: 'Trials that paid',
							data: FIGURES.paidRate,
							yAxisID: 'rate',
							glow: lineColor,
							...hollowPoints(theme, lineColor),
						}),
						barSeries(barColor, {
							label: 'Ad spend',
							data: FIGURES.spend,
							yAxisID: 'spend',
							maxBarThickness: 34,
						}),
					],
				},
				options: stockOptions(theme, animated, {
					layout: { padding: { top: 34 } },
					plugins: {
						tooltip: {
							itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
							callbacks: {
								label: (item) =>
									item.dataset.yAxisID === 'rate'
										? ` Trials that paid: ${item.parsed.y}%`
										: ` Ad spend: ${thousands(item.parsed.y)}`,
							},
						},
					},
					/* Four steps on both axes, so the two sets of gridlines agree. */
					scales: {
						y: { display: false },
						spend: sideAxis('left', {
							min: 0,
							max: 16,
							grid: { color: theme.grid },
							ticks: axisTicks(theme, { stepSize: 4, callback: thousands }),
						}),
						rate: sideAxis('right', {
							min: 0,
							max: 40,
							grid: { drawOnChartArea: false },
							ticks: axisTicks(theme, { stepSize: 10, callback: percent }),
						}),
					},
				}),
				plugins: [
					overlay('mixedAxisNames', {
						last: (chart, ctx, area) => {
							const { scales } = chart;
							const baseline = area.top - 20;
							ctx.save();
							ctx.fillStyle = barColor;
							roundedBox(ctx, scales.spend.left, baseline - 10, 8, 10, 2);
							ctx.restore();
							drawLabel(ctx, theme.quiet, 'Ad spend', scales.spend.left + 13, baseline, 'left');
							const nameWidth = measure(ctx, 'Trials that paid');
							ctx.save();
							ctx.strokeStyle = lineColor;
							ctx.lineWidth = 2.5;
							ctx.lineCap = 'round';
							ctx.beginPath();
							ctx.moveTo(scales.rate.right - nameWidth - 24, baseline - 5);
							ctx.lineTo(scales.rate.right - nameWidth - 8, baseline - 5);
							ctx.stroke();
							ctx.restore();
							drawLabel(ctx, theme.quiet, 'Trials that paid', scales.rate.right, baseline, 'right');
						},
						after: (chart, ctx, area) => {
							const points = chart.getDatasetMeta(0).data;
							const bounds = { left: area.left, right: area.right, top: area.top - 8 };
							if (points[0])
								drawPill(
									ctx,
									theme,
									points[0].x,
									points[0].y - 12,
									`${FIGURES.paidRate[0]}% paid in Jan`,
									bounds,
									{ dot: lineColor },
								);
							if (points[lastIndex])
								drawPill(
									ctx,
									theme,
									points[lastIndex].x,
									points[lastIndex].y - 12,
									`${FIGURES.paidRate[lastIndex]}% in Sep`,
									bounds,
									{ align: 'right', dot: lineColor },
								);
						},
					}),
				],
			};
		},

		/* New customers as bars with returning customers as the line, marking
       the month the line overtakes. */
		'bar-line'(theme, animated) {
			const barColor = theme.series[2];
			const lineColor = theme.series[7];
			const overtake = FIGURES.returning.findIndex((value, index) => value > FIGURES.newCustomers[index]);
			const lastIndex = FIGURES.returning.length - 1;
			return {
				type: 'bar',
				data: {
					labels: FIGURES.channelMonths,
					datasets: [
						lineSeries(lineColor, {
							label: 'Returning',
							data: FIGURES.returning,
							glow: lineColor,
							tension: 0.35,
							clip: false,
							...hollowPoints(theme, lineColor, 4),
						}),
						barSeries(barColor, {
							label: 'New',
							data: FIGURES.newCustomers,
							barPercentage: 0.6,
							maxBarThickness: 30,
						}),
					],
				},
				options: stockOptions(theme, animated, {
					layout: { padding: { top: 30, right: 10 } },
					plugins: {
						tooltip: {
							itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
							callbacks: { label: (item) => ` ${item.dataset.label}: ${item.parsed.y} customers` },
						},
					},
					scales: { y: { beginAtZero: true, max: 200, ticks: { stepSize: 50 } } },
				}),
				plugins: [
					overlay('mixedCross', {
						after: (chart, ctx, area) => {
							const points = chart.getDatasetMeta(0).data;
							const bounds = { left: area.left, right: area.right + 10, top: 0 };
							if (overtake > -1 && points[overtake])
								drawPill(
									ctx,
									theme,
									points[overtake].x + 8,
									points[overtake].y - 14,
									'Returning overtake new',
									bounds,
									{ align: 'right', dot: lineColor },
								);
							const end = points[lastIndex];
							if (end && lastIndex !== overtake)
								drawLabel(
									ctx,
									theme.text,
									String(FIGURES.returning[lastIndex]),
									end.x,
									end.y - 10,
									'center',
								);
						},
					}),
				],
			};
		},
	};

	/*
	 * Filter chips: one per chart type, plus All. Filtering hides cards; in a
	 * filtered view the 8/4 rhythm gives way to halves, and an odd last card
	 * spans its row. The count under the chips is read out as it changes.
	 */

	function wireFilter() {
		const choices = Array.from(pickAll('[data-mixed-filter]', mixedPage));
		for (const choice of choices) {
			choice.addEventListener('click', () => {
				for (const sibling of choices) sibling.setAttribute('aria-pressed', String(sibling === choice));
				showKind(choice.getAttribute('data-mixed-filter'));
			});
		}
	}

	function showKind(kind) {
		const cardGrid = pick('[data-mixed-grid]', mixedPage);
		const tally = pick('[data-mixed-count]', mixedPage);
		const everything = kind === 'all';
		const visible = [];
		for (const card of pickAll('.mixed-card', cardGrid)) {
			const shown = everything || card.getAttribute('data-mixed-kind') === kind;
			card.classList.toggle('is-hidden', !shown);
			card.classList.remove('is-alone');
			if (shown) visible.push(card);
		}
		cardGrid.classList.toggle('is-filtered', !everything);
		if (!everything) {
			const halves = visible.filter(
				(card) =>
					!card.classList.contains('mixed-card-full') || card.classList.contains('mixed-card-full-in-all'),
			);
			if (halves.length % 2) halves[halves.length - 1].classList.add('is-alone');
		}
		if (tally) tally.textContent = `${visible.length} chart${visible.length === 1 ? '' : 's'}`;
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
