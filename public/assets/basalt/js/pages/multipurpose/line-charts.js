/**
 * Line charts page (line-charts.html). Draws fifteen Chart.js line charts
 * for one shop, each the first time its card scrolls into view. Every
 * color is read from the --basalt-* tokens at draw time, and a
 * basalt:appearance redraws whatever is on screen, so palette, mode,
 * background and the Flat switch all reach the canvases. Also runs the
 * state picker on the highlight chart and the kind chips over the grid.
 */
(() => {
	'use strict';

	const stage = pick('[data-lines-root]');
	if (!stage || typeof Chart === 'undefined') return;

	const html = document.documentElement;
	const stillPreferred = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const TYPEFACE = "'Schibsted Grotesk', sans-serif";

	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const SHOP_HOURS = [
		'6 am',
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
	];
	const TRIAL_MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
	const WEEK_LABELS = Array.from({ length: 12 }, (_, i) => `Week ${i + 1}`);

	/* One shop seen from several angles. The week of 503 orders and 9,030
     sessions is the same week the other chart pages refer back to; MRR
     is in $k and Jul + Aug + Sep come to 2,031; deals closed per quarter
     come to 15, 16 and 17 against a Q4 target of 19. */
	const SHOP = {
		dailyRevenue: [3421, 3969, 4072, 4690, 4450, 5067, 5410, 4793, 5376, 4758, 4724, 4724],
		ordersByDay: [62, 68, 71, 75, 86, 70, 71],
		sessionsByDay: [1233, 1342, 1557, 1533, 1577, 912, 876],
		staffByHour: [2, 3, 5, 5, 6, 6, 8, 8, 6, 5, 5, 6, 4, 3, 2],
		regions: [
			['Northeast', [330, 366, 415, 294, 381, 383, 303, 377, 426]],
			['Midwest', [177, 197, 220, 162, 192, 216, 182, 209, 223]],
			['West', [125, 118, 118, 153, 145, 138, 151, 200, 207]],
			['South', [92, 106, 113, 133, 132, 130, 139, 132, 121]],
		],
		mrr: {
			actual: [512, 530, 548, 571, 590, 622, 665, 676],
			expected: [690, 712, 731, 758],
			high: [702, 736, 768, 808],
			low: [678, 690, 696, 712],
		},
		trialsByMonth: [58, 51, 43, 45, 54, 62, 70, 73, 75, 74, 77, 69],
		payingAccounts: [243, 240, 235, 237, 233, 224, 219],
		channelSessions: {
			search: [2100, 2200, 2200, 2400, 2300, 2500, 2600, 2500, 2700, 2800, 2700, 2900],
			direct: [1400, 1400, 1500, 1400, 1500, 1500, 1600, 1500, 1600, 1600, 1700, 1600],
			ads: [1000, 1000, 1000, 1200, 1200, 1200, 900, 900, 900, 1100, 1100, 1100],
			email: [600, 900, 500, 800, 600, 1000, 600, 900, 700, 1100, 700, 1000],
			referral: [300, 300, 400, 400, 400, 500, 500, 600, 700, 700, 800, 900],
			social: [800, 800, 700, 700, 600, 600, 600, 500, 500, 500, 400, 400],
		},
		states: [
			['California', [180, 184, 190, 188, 195, 201, 198, 206, 210, 215, 212, 220]],
			['Texas', [96, 98, 97, 101, 99, 104, 108, 107, 111, 110, 114, 118]],
			['New York', [84, 82, 86, 85, 88, 87, 86, 90, 89, 91, 90, 93]],
			['Colorado', [52, 55, 58, 61, 66, 70, 74, 79, 83, 88, 92, 97]],
			['Florida', [64, 62, 60, 61, 58, 57, 55, 56, 53, 52, 51, 50]],
			['Oregon', [30, 31, 30, 32, 31, 33, 32, 34, 33, 35, 34, 36]],
		],
		signupsByWeek: [118, 139, 124, 151, 138, 163, 150, 174, 161, 183, 172, 194],
		deals: {
			closed: [4, 5, 6, 5, 5, 6, 6, 5, 6],
			target: [5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 7],
			lastYear: [3, 4, 4, 4, 5, 4, 5, 5, 4, 6, 5, 6],
		},
		deliveryDays: [
			2.8, 3.1, 2.6, 3.4, 3.9, 4.4, 3.2, 2.9, 2.7, 3.0, 3.6, 4.2, 4.6, 3.8, 3.1, 2.4, 2.2, 1.8, 2.6, 3.0, 2.9,
		],
		orderValue: [38.2, 39.0, 38.6, 40.1, 41.3, 40.8, 42.0, 43.4, 44.1],
	};

	/* Which ramp color each channel's small multiple takes, so six small
     charts read as six different things rather than one repeated. */
	const CHANNEL_SLOT = { search: 0, direct: 1, ads: 2, email: 3, referral: 7, social: 6 };

	/* Daily active accounts: a gentle climb, a weekend dip and a little
     day-to-day wobble, worked out from the real dates so weekends land on
     weekends and the series is the same on every load. */
	const recentDays = datesBackFrom(30);
	const dailyAccounts = recentDays.map((date, i) => {
		const weekend = date.getDay() === 0 || date.getDay() === 6;
		return Math.round(150 + i * 1.2 + (weekend ? -13 : 0) + Math.sin(i * 1.3) * 3);
	});
	const weeklyAverage = dailyAccounts.map((_, i) => {
		if (i < 6) return null;
		const window7 = dailyAccounts.slice(i - 6, i + 1);
		return Math.round(window7.reduce((sum, n) => sum + n, 0) / 7);
	});

	/* Chart instances by canvas, and the state the highlight chart brings forward. */
	const drawn = new Map();
	let spotlight = 3;

	/**
	 * Watches every canvas and draws it on first sight, redraws on theme
	 * change, then wires the state picker and the kind chips.
	 */
	function start() {
		const canvases = Array.from(pickAll('canvas[data-lines-chart]', stage));

		if (!('IntersectionObserver' in window)) {
			for (const canvas of canvases) draw(canvas, false);
		} else {
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
			for (const canvas of canvases) watcher.observe(canvas);
		}

		/* The tokens change with the attribute, so the next frame reads the new ones. */
		document.addEventListener('basalt:appearance', () => requestAnimationFrame(redrawAll));

		wireStatePicker();
		wireKindChips();
	}

	function redrawAll() {
		for (const canvas of [...drawn.keys()]) draw(canvas, false);
	}

	function draw(canvas, withMotion) {
		const recipe = RECIPES[canvas.dataset.linesChart];
		if (!recipe) return;
		drawn.get(canvas)?.destroy();
		drawn.set(canvas, new Chart(canvas, recipe(inkFromTokens(), withMotion && !stillPreferred, canvas)));
	}

	function token(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/**
	 * Splits a token value into [r, g, b, a]. Tokens arrive as #rgb,
	 * #rrggbb or rgb()/rgba(); Chart.js wants plain strings it can parse,
	 * so mixing happens here rather than through CSS color-mix().
	 */
	function channels(color) {
		const text = String(color || '').trim();
		const shortHex = /^#([0-9a-f]{3})$/i.exec(text);
		if (shortHex) return [...shortHex[1]].map((digit) => parseInt(`${digit}${digit}`, 16)).concat(1);
		const longHex = /^#([0-9a-f]{6})$/i.exec(text);
		if (longHex) {
			const packed = parseInt(longHex[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 1];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(text);
		if (functional) {
			const [r, g, b, a = 1] = functional[1].split(',').map((part) => parseFloat(part));
			return [r, g, b, a];
		}
		return [128, 128, 128, 1];
	}

	function tint(color, alpha) {
		return `rgba(${channels(color).slice(0, 3).join(', ')}, ${alpha})`;
	}

	function blend(color, into, share) {
		const from = channels(color);
		const toward = channels(into);
		const [r, g, b] = [0, 1, 2].map((i) => Math.round(from[i] * share + toward[i] * (1 - share)));
		return `rgb(${r}, ${g}, ${b})`;
	}

	/* The colors one draw uses, read fresh so a theme change is picked up.
     quiet is the same recipe as --lines-quiet in line-charts.css: small
     gray text that still clears 4.5:1 on the lighter palettes. */
	function inkFromTokens() {
		const text = token('--basalt-copy', '#12233a');
		const muted = token('--basalt-copy-muted', '#5f7186');
		return {
			series: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => token(`--basalt-series-${n}`, '#2b6fd4')),
			text,
			quiet: blend(muted, text, 0.82),
			rest: tint(text, 0.2),
			grid: tint(text, 0.07),
			surface: token('--basalt-plane', '#ffffff'),
			border: token('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			success: token('--basalt-success', '#12c08f'),
			danger: token('--basalt-danger', '#ef4d63'),
		};
	}

	function isPlainObject(value) {
		return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
	}

	/* Deep-merges plain objects; arrays and scalars in `extra` replace. */
	function layer(base, extra) {
		const merged = { ...base };
		for (const [key, value] of Object.entries(extra || {})) {
			merged[key] = isPlainObject(value) && isPlainObject(merged[key]) ? layer(merged[key], value) : value;
		}
		return merged;
	}

	function chartOptions(ink, withMotion, extra) {
		const tickStyle = { color: ink.quiet, font: { family: TYPEFACE, size: 11.5 }, padding: 8 };
		return layer(
			{
				responsive: true,
				maintainAspectRatio: false /* the box sets the height */,
				animation: withMotion ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { intersect: false, mode: 'index' },
				layout: { padding: { top: 6, right: 6 } },
				elements: {
					line: { borderWidth: 2, borderCapStyle: 'round', borderJoinStyle: 'round' },
					point: { radius: 0, hoverRadius: 5, hoverBorderWidth: 2, hoverBorderColor: ink.surface },
				},
				plugins: {
					legend: { display: false } /* legends are HTML, in the card */,
					tooltip: {
						backgroundColor: ink.surface,
						titleColor: ink.text,
						bodyColor: ink.text,
						borderColor: ink.border,
						borderWidth: 1,
						padding: 10,
						cornerRadius: 8,
						boxPadding: 4,
						usePointStyle: true,
						titleFont: { family: TYPEFACE, size: 12, weight: '600' },
						bodyFont: { family: TYPEFACE, size: 12 },
					},
				},
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: { maxRotation: 0, autoSkipPadding: 12, ...tickStyle },
					},
					y: {
						grid: { color: ink.grid },
						border: { display: false },
						ticks: { maxTicksLimit: 5, ...tickStyle },
					},
				},
			},
			extra,
		);
	}

	/* A dataset in one color, with its point markers only on hover. */
	function stroke(color, extra) {
		return {
			borderColor: color,
			backgroundColor: color,
			pointBackgroundColor: color,
			pointHoverBackgroundColor: color,
			tension: 0.3,
			...extra,
		};
	}

	function datesBackFrom(count) {
		const now = Date.now();
		return Array.from({ length: count }, (_, i) => {
			const date = new Date(now);
			date.setDate(date.getDate() - (count - 1 - i));
			return date;
		});
	}

	function shortDate(date) {
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function dollars(amount) {
		return `$${Number(amount).toLocaleString()}`;
	}

	/**
	 * Draws a small labeled pill on the canvas, centered on x and sitting
	 * above y, kept inside the given left and right edges.
	 */
	function drawPill(ctx, ink, x, y, label, edgeLeft, edgeRight) {
		ctx.save();
		ctx.font = `600 11px ${TYPEFACE}`;
		const width = ctx.measureText(label).width + 14;
		const height = 20;
		const left = Math.max(edgeLeft, Math.min(x - width / 2, edgeRight - width));
		const top = y - height;
		ctx.fillStyle = ink.surface;
		ctx.strokeStyle = ink.border;
		ctx.lineWidth = 1;
		ctx.beginPath();
		if (ctx.roundRect) ctx.roundRect(left, top, width, height, 10);
		else ctx.rect(left, top, width, height);
		ctx.fill();
		ctx.stroke();
		Object.assign(ctx, { fillStyle: ink.text, textAlign: 'left', textBaseline: 'middle' });
		ctx.fillText(label, left + 7, top + height / 2 + 0.5);
		ctx.restore();
	}

	/* One recipe per data-lines-chart value. Each takes the current ink,
     whether to animate, and the canvas, and returns a Chart.js config. */
	const RECIPES = {
		spark(ink, withMotion, canvas) {
			const conversion = SHOP.ordersByDay.map(
				(orders, i) => +((orders / SHOP.sessionsByDay[i]) * 100).toFixed(1),
			);
			const series = {
				revenue: [SHOP.dailyRevenue, 0],
				orders: [SHOP.ordersByDay, 1],
				sessions: [SHOP.sessionsByDay, 2],
				conversion: [conversion, 3],
			};
			const [points, slot] = series[canvas.dataset.linesSpark] || series.orders;
			const lastIndex = points.length - 1;
			return {
				type: 'line',
				data: {
					labels: points.map((_, i) => i),
					datasets: [
						stroke(ink.series[slot], {
							data: points,
							borderWidth: 2,
							pointRadius: (point) => (point.dataIndex === lastIndex ? 3 : 0),
							pointBorderWidth: 0,
						}),
					],
				},
				options: chartOptions(ink, withMotion, {
					layout: { padding: { top: 4, bottom: 4, left: 2, right: 4 } },
					interaction: { intersect: false, mode: 'index' },
					plugins: { tooltip: { enabled: false } },
					scales: { y: { display: false }, x: { display: false } },
				}),
			};
		},

		time(ink, withMotion) {
			return {
				type: 'line',
				data: {
					labels: recentDays.map(shortDate),
					datasets: [
						stroke(ink.series[0], { label: 'Accounts', data: dailyAccounts, tension: 0.25 }),
						{
							label: '7-day average',
							data: weeklyAverage,
							borderColor: ink.rest,
							borderWidth: 1.5,
							pointRadius: 0,
							pointHoverRadius: 0,
							tension: 0.4,
						},
					],
				},
				options: chartOptions(ink, withMotion, {
					scales: { x: { ticks: { maxTicksLimit: 7 } } },
				}),
			};
		},

		stepped(ink, withMotion) {
			return {
				type: 'line',
				data: {
					labels: SHOP_HOURS,
					datasets: [stroke(ink.series[2], { label: 'On the floor', data: SHOP.staffByHour, stepped: true })],
				},
				options: chartOptions(ink, withMotion, {
					scales: {
						x: { ticks: { maxTicksLimit: 5 } },
						y: { beginAtZero: true, suggestedMax: 10, ticks: { stepSize: 2 } },
					},
				}),
			};
		},

		multi(ink, withMotion) {
			return {
				type: 'line',
				data: {
					labels: MONTH_NAMES.slice(0, 9),
					datasets: SHOP.regions.map(([name, orders], i) =>
						stroke(ink.series[i], { label: name, data: orders }),
					),
				},
				options: chartOptions(ink, withMotion, { scales: { y: { beginAtZero: true } } }),
			};
		},

		indexed(ink, withMotion) {
			function rebased(values) {
				return values.map((value) => Math.round((value / values[0]) * 100));
			}

			return {
				type: 'line',
				data: {
					labels: WEEKDAYS,
					datasets: [
						stroke(ink.series[0], { label: 'Sessions', data: rebased(SHOP.sessionsByDay) }),
						stroke(ink.series[4], { label: 'Orders', data: rebased(SHOP.ordersByDay) }),
						{
							label: 'Monday level',
							data: WEEKDAYS.map(() => 100),
							borderColor: ink.rest,
							borderWidth: 1,
							borderDash: [3, 4],
							pointRadius: 0,
							pointHoverRadius: 0,
						},
					],
				},
				options: chartOptions(ink, withMotion, {
					plugins: { tooltip: { filter: (item) => item.datasetIndex < 2 } },
					scales: { y: { suggestedMin: 60, suggestedMax: 145 } },
				}),
			};
		},

		forecast(ink, withMotion) {
			const { actual, expected, high, low } = SHOP.mrr;
			const knownMonths = actual.length;
			const joinAt = knownMonths - 1;
			const lastKnown = actual[joinAt];
			const color = ink.series[0];

			/* The forecast series start on the last known month so they join
         the actual line, with nulls before it. */
			function fromJoin(values) {
				return MONTH_NAMES.map((_, i) => (i < joinAt ? null : [lastKnown, ...values][i - joinAt]));
			}

			const highBand = fromJoin(high);
			const lowBand = fromJoin(low);
			return {
				type: 'line',
				data: {
					labels: MONTH_NAMES,
					datasets: [
						{
							label: 'High',
							data: highBand,
							borderWidth: 0,
							pointRadius: 0,
							pointHoverRadius: 0,
							backgroundColor: 'transparent',
							tension: 0.3,
						},
						{
							label: 'Low',
							data: lowBand,
							borderWidth: 0,
							pointRadius: 0,
							pointHoverRadius: 0,
							fill: '-1',
							backgroundColor: tint(color, 0.16),
							tension: 0.3,
						},
						stroke(color, { label: 'Forecast', data: fromJoin(expected), borderDash: [6, 5] }),
						stroke(color, {
							label: 'Actual',
							data: [...actual, ...Array(12 - knownMonths).fill(null)],
							borderWidth: 2.5,
						}),
					],
				},
				options: chartOptions(ink, withMotion, {
					plugins: {
						tooltip: {
							filter: (item) =>
								item.dataset.label === 'Actual' ||
								(item.dataset.label === 'Forecast' && item.dataIndex > joinAt),
							callbacks: {
								label: (item) =>
									item.dataset.label === 'Forecast'
										? ` Forecast: $${item.parsed.y}k, likely $${lowBand[item.dataIndex]}k to $${highBand[item.dataIndex]}k`
										: ` Actual: $${item.parsed.y}k`,
							},
						},
					},
					scales: { y: { ticks: { callback: (value) => `$${value}k` } } },
				}),
				plugins: [
					{
						id: 'linesToday',
						/* A quiet dotted divider where the known months end. */
						beforeDatasetsDraw({ ctx, chartArea: { top, bottom }, scales }) {
							const x = scales.x.getPixelForValue(joinAt);
							ctx.save();
							ctx.strokeStyle = ink.border;
							ctx.setLineDash([2, 4]);
							ctx.beginPath();
							ctx.moveTo(x, top);
							ctx.lineTo(x, bottom);
							ctx.stroke();
							ctx.setLineDash([]);
							Object.assign(ctx, {
								fillStyle: ink.quiet,
								font: `500 11px ${TYPEFACE}`,
								textAlign: 'left',
								textBaseline: 'top',
							});
							ctx.fillText('Forecast', x + 8, top + 2);
							ctx.restore();
						},
					},
				],
			};
		},

		annotated(ink, withMotion) {
			const trials = SHOP.trialsByMonth;
			const peak = trials.indexOf(Math.max(...trials));
			const trough = trials.indexOf(Math.min(...trials));
			const callouts = [
				[peak, `Best · ${trials[peak]}`],
				[trough, `Low · ${trials[trough]}`],
			];
			return {
				type: 'line',
				data: {
					labels: TRIAL_MONTHS,
					datasets: [
						stroke(ink.series[1], {
							label: 'Trials started',
							data: trials,
							pointRadius: trials.map((_, i) => (i === peak || i === trough ? 5 : 0)),
							pointBorderColor: ink.surface,
							pointBorderWidth: 2,
						}),
					],
				},
				options: chartOptions(ink, withMotion, {
					layout: { padding: { top: 30 } },
					scales: { y: { suggestedMin: 20, suggestedMax: 90 } },
				}),
				plugins: [
					{
						id: 'linesCallouts',
						afterDatasetsDraw(instance) {
							const points = instance.getDatasetMeta(0).data;
							const { left, right } = instance.chartArea;
							for (const [index, label] of callouts) {
								const point = points[index];
								if (point) drawPill(instance.ctx, ink, point.x, point.y - 10, label, left, right);
							}
						},
					},
				],
			};
		},

		labeled(ink, withMotion) {
			return {
				type: 'line',
				data: {
					labels: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
					datasets: [
						stroke(ink.series[3], {
							label: 'Paying accounts',
							data: SHOP.payingAccounts,
							pointRadius: 4,
							pointBorderColor: ink.surface,
							pointBorderWidth: 2,
						}),
					],
				},
				options: chartOptions(ink, withMotion, {
					layout: { padding: { top: 24, left: 8, right: 14 } },
					plugins: { tooltip: { enabled: false } },
					scales: { y: { suggestedMin: 200, suggestedMax: 255 } },
				}),
				plugins: [
					{
						id: 'linesValues',
						afterDatasetsDraw(instance) {
							const { ctx } = instance;
							const values = instance.data.datasets[0].data;
							ctx.save();
							Object.assign(ctx, {
								fillStyle: ink.text,
								font: `600 11.5px ${TYPEFACE}`,
								textAlign: 'center',
								textBaseline: 'bottom',
							});
							for (const [i, point] of instance.getDatasetMeta(0).data.entries()) {
								ctx.fillText(String(values[i]), point.x, point.y - 9);
							}
							ctx.restore();
						},
					},
				],
			};
		},

		multiple(ink, withMotion, canvas) {
			const channel = canvas.dataset.linesChannel;
			const sessions = SHOP.channelSessions[channel] || [];
			const ceiling = Math.max(...Object.values(SHOP.channelSessions).map((series) => Math.max(...series)));
			const lastIndex = sessions.length - 1;
			return {
				type: 'line',
				data: {
					labels: WEEK_LABELS,
					datasets: [
						stroke(ink.series[CHANNEL_SLOT[channel] || 0], {
							label: 'Sessions',
							data: sessions,
							borderWidth: 1.75,
							tension: 0.25,
							pointRadius: (point) => (point.dataIndex === lastIndex ? 2.5 : 0),
						}),
					],
				},
				options: chartOptions(ink, withMotion, {
					layout: { padding: { top: 4, right: 4, left: 2, bottom: 2 } },
					plugins: {
						tooltip: { callbacks: { label: (item) => ` ${item.parsed.y.toLocaleString()} sessions` } },
					},
					scales: { x: { display: false }, y: { display: false, min: 0, max: ceiling * 1.05 } },
				}),
			};
		},

		highlight(ink, withMotion) {
			const weeks = SHOP.states[0][1].length;
			return {
				type: 'line',
				data: {
					labels: WEEK_LABELS,
					datasets: SHOP.states.map(([name, orders], i) => {
						const chosen = i === spotlight;
						return {
							label: name,
							data: orders,
							borderColor: chosen ? ink.series[0] : ink.rest,
							pointBackgroundColor: chosen ? ink.series[0] : ink.rest,
							pointHoverBackgroundColor: ink.series[0],
							borderWidth: chosen ? 3 : 1.5,
							order: chosen ? 0 : 1,
							tension: 0.3,
						};
					}),
				},
				options: chartOptions(ink, withMotion, {
					layout: { padding: { top: 28, right: 12 } },
					interaction: { mode: 'nearest', intersect: false, axis: 'x' },
					plugins: {
						tooltip: {
							mode: 'index',
							filter: (item) => item.datasetIndex === spotlight,
						},
					},
					scales: {
						x: { ticks: { maxTicksLimit: 6, callback: (_, i) => `Wk ${i + 1}` } },
						y: { beginAtZero: true },
					},
				}),
				plugins: [
					{
						id: 'linesEndLabel',
						/* Names the chosen line where it ends, in text color. */
						afterDatasetsDraw(instance) {
							const endPoint = instance.getDatasetMeta(spotlight)?.data[weeks - 1];
							if (!endPoint) return;
							const { left, right } = instance.chartArea;
							const [name, orders] = SHOP.states[spotlight];
							drawPill(
								instance.ctx,
								ink,
								endPoint.x,
								endPoint.y - 10,
								`${name} · ${orders[weeks - 1]}`,
								left,
								right + 12,
							);
						},
					},
				],
			};
		},

		smooth(ink, withMotion) {
			return {
				type: 'line',
				data: {
					labels: WEEK_LABELS,
					datasets: [
						stroke(ink.series[7], {
							label: 'Curved',
							data: SHOP.signupsByWeek,
							tension: 0.4,
							borderWidth: 2.5,
						}),
						{
							label: 'Straight',
							data: SHOP.signupsByWeek,
							borderColor: ink.rest,
							borderWidth: 1.5,
							tension: 0,
							pointRadius: 0,
							pointHoverRadius: 0,
						},
					],
				},
				options: chartOptions(ink, withMotion, {
					plugins: { tooltip: { filter: (item) => item.datasetIndex === 0 } },
					scales: { x: { ticks: { maxTicksLimit: 6, callback: (_, i) => `Wk ${i + 1}` } } },
				}),
			};
		},

		dashed(ink, withMotion) {
			const { closed, target, lastYear } = SHOP.deals;
			return {
				type: 'line',
				data: {
					labels: MONTH_NAMES,
					datasets: [
						stroke(ink.series[0], { label: 'This year', data: closed, borderWidth: 2.5, tension: 0.25 }),
						stroke(ink.series[4], { label: 'Target', data: target, borderDash: [6, 5], stepped: 'middle' }),
						stroke(ink.series[3], {
							label: 'Last year',
							data: lastYear,
							borderDash: [1, 5],
							borderWidth: 2.5,
							tension: 0.25,
						}),
					],
				},
				options: chartOptions(ink, withMotion, {
					scales: { y: { beginAtZero: true, suggestedMax: 8, ticks: { stepSize: 2 } } },
				}),
			};
		},

		target(ink, withMotion) {
			const days = SHOP.deliveryDays;
			/* The line itself is neutral so the late markers stand out in every
         palette, including the red ones where series 1 and danger are close. */
			const lineColor = ink.quiet;

			function isLate(value) {
				return value > 4;
			}

			return {
				type: 'line',
				data: {
					labels: datesBackFrom(days.length).map(shortDate),
					datasets: [
						stroke(lineColor, {
							label: 'Average days',
							data: days,
							pointRadius: days.map((value) => (isLate(value) ? 5 : 0)),
							pointBackgroundColor: days.map((value) => (isLate(value) ? ink.danger : lineColor)),
							pointBorderColor: ink.surface,
							pointBorderWidth: 2,
							tension: 0.25,
						}),
					],
				},
				options: chartOptions(ink, withMotion, {
					plugins: {
						tooltip: {
							callbacks: {
								label: (item) => ` ${item.parsed.y} days${isLate(item.parsed.y) ? ', late' : ''}`,
							},
						},
					},
					scales: {
						x: { ticks: { maxTicksLimit: 6 } },
						y: { min: 0, max: 6, ticks: { stepSize: 2, callback: (value) => `${value}d` } },
					},
				}),
				plugins: [
					{
						id: 'linesBand',
						beforeDatasetsDraw({ ctx, chartArea, scales }) {
							const bandTop = scales.y.getPixelForValue(4);
							const bandBottom = scales.y.getPixelForValue(2);
							ctx.save();
							ctx.fillStyle = tint(ink.success, 0.13);
							ctx.fillRect(
								chartArea.left,
								bandTop,
								chartArea.right - chartArea.left,
								bandBottom - bandTop,
							);
							ctx.strokeStyle = tint(ink.success, 0.55);
							ctx.setLineDash([4, 4]);
							ctx.lineWidth = 1;
							for (const edge of [bandTop, bandBottom]) {
								ctx.beginPath();
								ctx.moveTo(chartArea.left, edge);
								ctx.lineTo(chartArea.right, edge);
								ctx.stroke();
							}
							ctx.restore();
						},
					},
				],
			};
		},

		filled(ink, withMotion) {
			const lineColor = ink.series[1];
			/* A second ramp color the fill drifts into, and the line with it. */
			const driftColor = ink.series[0];

			function gradientsOff() {
				return html.getAttribute('data-basalt-gradients') === 'off';
			}

			return {
				type: 'line',
				data: {
					labels: datesBackFrom(12).map(shortDate),
					datasets: [
						stroke(lineColor, {
							label: 'Revenue',
							data: SHOP.dailyRevenue,
							fill: 'start',
							tension: 0.35,
							borderColor({ chart: { ctx, chartArea } }) {
								if (!chartArea || gradientsOff()) return lineColor;
								const sweep = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
								sweep.addColorStop(0, lineColor);
								sweep.addColorStop(1, driftColor);
								return sweep;
							},
							backgroundColor: window.Basalt.chartFill(
								[
									[0, tint(lineColor, 0.3)],
									[0.55, tint(driftColor, 0.12)],
									[1, tint(driftColor, 0)],
								],
								{ flat: tint(lineColor, 0.14) },
							),
						}),
					],
				},
				options: chartOptions(ink, withMotion, {
					plugins: { tooltip: { callbacks: { label: (item) => ` ${dollars(item.parsed.y)}` } } },
					scales: {
						x: { ticks: { maxTicksLimit: 6 } },
						y: { ticks: { callback: (value) => `$${(value / 1000).toFixed(1)}k` } },
					},
				}),
			};
		},

		basic(ink, withMotion) {
			return {
				type: 'line',
				data: {
					labels: MONTH_NAMES.slice(0, 9),
					datasets: [stroke(ink.series[4], { label: 'Average order', data: SHOP.orderValue, tension: 0 })],
				},
				options: chartOptions(ink, withMotion, {
					plugins: { tooltip: { callbacks: { label: (item) => ` $${item.parsed.y.toFixed(2)}` } } },
					scales: { x: { ticks: { maxTicksLimit: 5 } }, y: { ticks: { callback: (value) => `$${value}` } } },
				}),
			};
		},
	};

	/* The picker above the highlight chart recolors its datasets in place
     rather than redrawing, so the lines slide between states. */
	function wireStatePicker() {
		const picker = pick('[data-lines-picker]', stage);
		if (!picker) return;

		picker.addEventListener('click', (event) => {
			const choice = event.target.closest('[data-lines-pick]');
			if (!choice) return;
			spotlight = Number(choice.dataset.linesPick);
			for (const other of pickAll('[data-lines-pick]', picker)) {
				other.setAttribute('aria-pressed', String(other === choice));
			}

			const chart = drawn.get(pick('[data-lines-chart="highlight"]', stage));
			if (!chart) return;
			const ink = inkFromTokens();
			for (const [i, dataset] of chart.data.datasets.entries()) {
				const chosen = i === spotlight;
				dataset.borderColor = chosen ? ink.series[0] : ink.rest;
				dataset.pointBackgroundColor = chosen ? ink.series[0] : ink.rest;
				dataset.borderWidth = chosen ? 3 : 1.5;
				dataset.order = chosen ? 0 : 1;
			}
			chart.update(stillPreferred ? 'none' : undefined);
		});
	}

	/* The chips hide cards rather than rebuild them. A filtered view drops
     the 8/4 rhythm for plain halves, and an odd card at the end spans the
     row on its own. */
	function wireKindChips() {
		const grid = pick('[data-lines-grid]', stage);
		if (!grid) return;
		const cards = Array.from(pickAll('.lines-card', grid));
		const counter = pick('[data-lines-count]', stage);
		const chips = Array.from(pickAll('[data-lines-filter]', stage));

		function showKind(kind) {
			const filtering = kind !== 'all';
			const visible = cards.filter((card) => {
				const keep = !filtering || card.dataset.linesKind === kind;
				card.classList.toggle('is-hidden', !keep);
				card.classList.remove('is-alone');
				return keep;
			});

			grid.classList.toggle('is-filtered', filtering);
			if (filtering) {
				const halves = visible.filter(
					(card) =>
						!card.classList.contains('lines-card-full') ||
						card.classList.contains('lines-card-full-in-all'),
				);
				if (halves.length % 2) halves.at(-1).classList.add('is-alone');
			}
			if (counter) counter.textContent = `${visible.length}${visible.length === 1 ? ' chart' : ' charts'}`;
		}

		function press(chip) {
			for (const other of chips) other.setAttribute('aria-pressed', String(other === chip));
			showKind(chip.dataset.linesFilter);
		}

		for (const chip of chips) chip.addEventListener('click', () => press(chip));
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
