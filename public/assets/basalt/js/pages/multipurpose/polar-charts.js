/**
 * Basalt - Polar area charts page
 * Eleven Chart.js polar area charts. Colors are read from
 * the --basalt-* tokens each time a chart is built, and every
 * built chart is rebuilt on basalt:appearance, so palette,
 * mode, background and Flat all reach the canvases.
 */
(() => {
	'use strict';
	const page = pick('[data-polars-root]');
	if (!page || typeof Chart === 'undefined') return;

	const root = document.documentElement;
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const FONT = "'Schibsted Grotesk', sans-serif";

	function start() {
		for (const btn of pickAll('[data-polars-filter]', page)) {
			btn.addEventListener('click', () => {
				for (const b of pickAll('[data-polars-filter]', page)) {
					b.setAttribute('aria-pressed', String(b === btn));
				}

				applyFilter(btn.getAttribute('data-polars-filter'));
			});
		}
	}

	/* Color helpers */
	function token(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/* Tokens are #rrggbb or rgba(); Chart.js needs plain strings it can parse,
     so mixing is done here rather than with CSS color-mix(). */
	function parse(c) {
		const s = String(c || '').trim();
		let m = /^#([0-9a-f]{3})$/i.exec(s);
		if (m)
			return m[1]
				.split('')
				.map((h) => parseInt(h + h, 16))
				.concat(1);
		m = /^#([0-9a-f]{6})$/i.exec(s);
		if (m) {
			const n = parseInt(m[1], 16);
			return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
		}
		m = /^rgba?\(([^)]+)\)$/i.exec(s);
		if (m) {
			const p = m[1].split(',').map((v) => parseFloat(v));
			return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
		}
		return [128, 128, 128, 1];
	}

	function tint(c, a) {
		const [r, g, b] = parse(c);
		return `rgba(${r}, ${g}, ${b}, ${a})`;
	}

	function mix(a, b, share) {
		const x = parse(a);
		const y = parse(b);

		function ch(i) {
			return Math.round(x[i] * share + y[i] * (1 - share));
		}

		return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
	}

	function flat() {
		return root.getAttribute('data-basalt-gradients') === 'off';
	}

	function palette() {
		const text = token('--basalt-copy', '#12233a');
		const muted = token('--basalt-copy-muted', '#5f7186');
		const series = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => token(`--basalt-series-${n}`, '#2b6fd4'));
		return {
			series,
			text,
			/* Same recipe as --polars-quiet in polar-charts.css: small gray text
         that still clears 4.5:1 on the lighter palettes. */
			quiet: mix(muted, text, 0.82),
			grid: tint(text, 0.09),
			surface: token('--basalt-plane', '#ffffff'),
			border: token('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
		};
	}

	/* A fill that deepens from the center outwards. With gradients off it is
     one flat tint, the same as every other gradient on the page.
     Pass a second color and the fill turns into it toward the rim. */
	function radial(color, inner, outer, rim) {
		return (context) => {
			const r = context.chart.scales.r;
			if (flat() || !r || !r.drawingArea) return tint(rim || color, (inner + outer) / 2);
			const g = context.chart.ctx.createRadialGradient(
				r.xCenter,
				r.yCenter,
				0,
				r.xCenter,
				r.yCenter,
				r.drawingArea,
			);
			g.addColorStop(0, tint(color, inner));
			g.addColorStop(1, tint(rim || color, outer));
			return g;
		};
	}

	/* Shared options */
	function merge(base, extra) {
		const out = Object.assign({}, base);

		for (const k of Object.keys(extra || {})) {
			const v = extra[k];
			const b = out[k];
			out[k] =
				v && typeof v === 'object' && !Array.isArray(v) && b && typeof b === 'object' && !Array.isArray(b)
					? merge(b, v)
					: v;
		}

		return out;
	}

	function options(t, animate, extra) {
		return merge(
			{
				responsive: true,
				maintainAspectRatio: false,
				animation: animate ? { duration: 500, easing: 'easeOutQuart' } : false,
				layout: { padding: 4 },
				elements: { arc: { borderWidth: 1.5, borderColor: t.surface, hoverBorderColor: t.surface } },
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: t.surface,
						titleColor: t.text,
						bodyColor: t.text,
						borderColor: t.border,
						borderWidth: 1,
						padding: 10,
						cornerRadius: 8,
						boxPadding: 4,
						usePointStyle: true,
						titleFont: { family: FONT, size: 12, weight: '600' },
						bodyFont: { family: FONT, size: 12 },
					},
				},
				scales: {
					r: {
						beginAtZero: true,
						grid: { color: t.grid },
						angleLines: { display: false },
						ticks: { display: false },
						pointLabels: { display: false, color: t.quiet, font: { family: FONT, size: 11.5 }, padding: 6 },
					},
				},
			},
			extra,
		);
	}

	/* Labels drawn round the outside of the circle, in the quiet text color. */
	function outside(t, extra) {
		return {
			scales: {
				r: { pointLabels: Object.assign({ display: true, centerPointLabels: true, color: t.quiet }, extra) },
			},
		};
	}

	/* A pill with a text label, drawn onto the canvas over the chart. Its
     background is the card surface, so the text never sits on a slice color. */
	function pill(ctx, t, x, y, label) {
		ctx.save();
		ctx.font = `600 11px ${FONT}`;
		const w = ctx.measureText(label).width + 14;
		const h = 20;
		const left = x - w / 2;
		const top = y - h / 2;
		ctx.fillStyle = t.surface;
		ctx.strokeStyle = t.border;
		ctx.lineWidth = 1;
		ctx.beginPath();
		if (ctx.roundRect) ctx.roundRect(left, top, w, h, 10);
		else ctx.rect(left, top, w, h);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = t.text;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(label, left + 7, top + h / 2 + 0.5);
		ctx.restore();
	}

	/* Demo data */
	/* One shop, several angles on it. September's 503 orders are the same
     week the line charts page plots day by day. */
	const DATA = {
		months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
		/* Trial signups a month: busy in the off-season, quiet in summer. */
		trials: [212, 196, 160, 128, 104, 86, 78, 82, 121, 158, 204, 236],
		targetRegions: ['Mid-Atlantic', 'Mountain', 'Great Lakes', 'New England', 'Southwest', 'Plains'],
		/* Share of the monthly sales target reached, in percent. */
		target: [112, 104, 96, 101, 88, 79],
		weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
		august: [58, 63, 66, 70, 79, 64, 60],
		september: [62, 68, 71, 75, 86, 70, 71],
		/* Orders by hour of an average day. Sums to 72. */
		hours: [1, 1, 0, 0, 0, 1, 1, 2, 3, 4, 5, 5, 6, 5, 4, 4, 4, 5, 6, 5, 4, 3, 2, 1],
		/* Share of customers (the slice's angle) and average order (its reach). */
		segments: [
			['Occasional', 38, 31],
			['Returning', 27, 44],
			['Subscribers', 21, 58],
			['Gift buyers', 9, 72],
			['Office accounts', 5, 118],
		],
		/* Accounts by industry, largest first. Sums to 2,140. */
		trades: [
			['Home care', 762],
			['Pet care', 399],
			['Photography', 370],
			['Cleaning', 217],
			['Landscaping', 172],
			['Property care', 115],
			['Movers', 105],
		],
		/* Share of MRR by product. Sums to 100. */
		revenue: [
			['Pro', 41],
			['Max', 24],
			['Basic', 19],
			['Routing', 6],
			['SMS credits', 6],
			['Portal', 4],
		],
		directions: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
		/* Deliveries last month by direction from the warehouse and distance. */
		wind: [
			['Under 3 mi', [42, 30, 26, 38, 51, 34, 22, 28]],
			['3 to 10 mi', [30, 22, 18, 26, 40, 28, 14, 19]],
			['Over 10 mi', [12, 8, 6, 14, 22, 16, 5, 7]],
		],
		/* Where new signups came from, in percent. Sums to 100. */
		channels: [
			['Search', 24],
			['Partners', 19],
			['Email', 16],
			['Social', 14],
			['Events', 11],
			['Content', 9],
			['Marketplace', 7],
		],
		/* The busiest ship-to cities, in orders a day. */
		cities: [
			['Eugene', 44],
			['Ann Arbor', 31],
			['Minot', 36],
			['Dubuque', 27],
			['Flagstaff', 22],
			['Duluth', 33],
		],
		/* Staff by team. Sums to 38. */
		teams: [
			['Support', 9],
			['Engineering', 8],
			['Onboarding', 7],
			['Sales', 6],
			['Product', 4],
			['Design', 4],
		],
	};

	function names(rows) {
		return rows.map((r) => r[0]);
	}

	function values(rows) {
		return rows.map((r) => r[1]);
	}

	function hourLabel(h) {
		return `${String(h).padStart(2, '0')}:00`;
	}

	/* Chart builders */
	let startAngle = -30;

	const BUILD = {
		seasonal(t, animate) {
			const c = t.series[1];
			return {
				type: 'polarArea',
				data: {
					labels: DATA.months,
					datasets: [
						{
							label: 'Trial signups',
							data: DATA.trials,
							backgroundColor: radial(t.series[2], 0.25, 0.85, c),
							hoverBackgroundColor: c,
						},
					],
				},
				options: options(
					t,
					animate,
					merge(outside(t), {
						plugins: { tooltip: { callbacks: { label: (item) => ` ${item.raw} trial signups` } } },
					}),
				),
			};
		},

		target(t, animate) {
			const c = t.series[0];

			function reached(v) {
				return v >= 100;
			}

			return {
				type: 'polarArea',
				data: {
					labels: DATA.targetRegions,
					datasets: [
						{
							label: 'Of target',
							data: DATA.target,
							backgroundColor: DATA.target.map((v) => (reached(v) ? tint(c, 0.85) : tint(c, 0.32))),
							hoverBackgroundColor: DATA.target.map((v) => (reached(v) ? c : tint(c, 0.5))),
						},
					],
				},
				options: options(
					t,
					animate,
					merge(outside(t), {
						scales: { r: { max: 125 } },
						plugins: {
							tooltip: {
								callbacks: {
									label: (item) => ` ${item.raw}% of target${reached(item.raw) ? ', reached' : ''}`,
								},
							},
						},
					}),
				),
				plugins: [
					{
						id: 'polarsTargetRing',
						afterDatasetsDraw(chart) {
							const r = chart.scales.r;
							const dist = r.getDistanceFromCenterForValue(100);
							const ctx = chart.ctx;
							ctx.save();
							ctx.strokeStyle = t.text;
							ctx.lineWidth = 1.5;
							ctx.setLineDash([5, 4]);
							ctx.beginPath();
							ctx.arc(r.xCenter, r.yCenter, dist, 0, Math.PI * 2);
							ctx.stroke();
							ctx.restore();
							pill(ctx, t, r.xCenter, r.yCenter - dist, 'Target');
						},
					},
				],
			};
		},

		period(t, animate, canvas) {
			const which = canvas.getAttribute('data-polars-period');
			const data = DATA[which] || DATA.september;
			const c = which === 'august' ? t.series[3] : t.series[0];
			const max = Math.max(...DATA.august.concat(DATA.september));
			return {
				type: 'polarArea',
				data: {
					labels: DATA.weekdays,
					datasets: [{ label: 'Orders', data, backgroundColor: tint(c, 0.7), hoverBackgroundColor: c }],
				},
				options: options(
					t,
					animate,
					merge(outside(t), {
						scales: {
							r: {
								/* Both charts share one scale, so a longer slice means more orders. */
								max: Math.ceil(max / 20) * 20,
								ticks: {
									display: true,
									stepSize: 50,
									color: t.quiet,
									font: { family: FONT, size: 10.5 },
									backdropColor: t.surface,
									backdropPadding: 2,
									z: 2,
								},
							},
						},
						plugins: { tooltip: { callbacks: { label: (item) => ` ${item.raw} orders` } } },
					}),
				),
			};
		},

		hours(t, animate) {
			const c = t.series[7];
			const top = Math.max(...DATA.hours);
			return {
				type: 'polarArea',
				data: {
					labels: DATA.hours.map((_, h) => hourLabel(h)),
					datasets: [
						{
							label: 'Orders',
							data: DATA.hours,
							/* Busier hours are drawn stronger as well as longer. */
							backgroundColor: DATA.hours.map((v) => tint(c, 0.3 + 0.6 * (v / top))),
							hoverBackgroundColor: c,
							borderWidth: 1,
						},
					],
				},
				options: options(
					t,
					animate,
					merge(
						outside(t, {
							/* Only every sixth hour is named, like the marks on a clock face. */
							callback: (label, i) => (i % 6 === 0 ? label : ''),
						}),
						{
							plugins: {
								tooltip: {
									callbacks: {
										title: (items) =>
											`${items[0].label} to ${hourLabel((items[0].dataIndex + 1) % 24)}`,
										label: (item) => ` ${item.raw} ${item.raw === 1 ? 'order' : 'orders'}`,
									},
								},
							},
						},
					),
				),
			};
		},

		sizes(t, animate) {
			const rows = DATA.segments;
			return {
				type: 'polarArea',
				data: {
					labels: names(rows),
					datasets: [
						{
							label: 'Average order',
							data: rows.map((r) => r[2]),
							/* Each slice's angle is its share of customers. */
							angle: rows.map((r) => r[1] * 3.6),
							/* Scriptable options can't sit inside an array, so one function
               picks the slice's color and builds its fill. */
							backgroundColor: (context) => radial(t.series[context.dataIndex], 0.35, 0.9)(context),
							hoverBackgroundColor: rows.map((_, i) => t.series[i]),
						},
					],
				},
				options: options(t, animate, {
					plugins: {
						tooltip: {
							callbacks: {
								label: (item) =>
									` ${rows[item.dataIndex][1]}% of customers, $${item.raw} average order`,
							},
						},
					},
				}),
			};
		},

		sorted(t, animate) {
			const rows = DATA.trades;
			const c = t.series[3];
			return {
				type: 'polarArea',
				data: {
					labels: names(rows),
					datasets: [
						{
							label: 'Accounts',
							data: values(rows),
							backgroundColor: radial(t.series[1], 0.3, 0.9, c),
							hoverBackgroundColor: c,
						},
					],
				},
				options: options(
					t,
					animate,
					merge(
						outside(t, {
							color: t.text,
							font: { family: FONT, size: 11.5, weight: '600' },
							callback: (label, i) => [label, String(rows[i][1])],
						}),
						{
							plugins: { tooltip: { callbacks: { label: (item) => ` ${item.raw} accounts` } } },
						},
					),
				),
			};
		},

		angle(t, animate) {
			const rows = DATA.revenue;
			return {
				type: 'polarArea',
				data: {
					labels: names(rows),
					datasets: [
						{
							label: 'Share of MRR',
							data: values(rows),
							backgroundColor: rows.map((_, i) => tint(t.series[i], 0.8)),
							hoverBackgroundColor: rows.map((_, i) => t.series[i]),
						},
					],
				},
				options: options(t, animate, {
					scales: { r: { startAngle } },
					plugins: { tooltip: { callbacks: { label: (item) => ` ${item.raw}% of MRR` } } },
				}),
			};
		},

		wind(t, animate) {
			/* Polar datasets share one set of angles, so the distance bands are
         drawn as running totals, nearest band on top. */
			const bands = DATA.wind;
			const totals = bands.map((_, b) =>
				DATA.directions.map((_, i) => bands.slice(0, b + 1).reduce((s, band) => s + band[1][i], 0)),
			);
			return {
				type: 'polarArea',
				data: {
					labels: DATA.directions,
					datasets: bands.map(([name], b) => ({
						label: name,
						data: totals[b],
						backgroundColor: t.series[b],
						hoverBackgroundColor: t.series[b],
					})),
				},
				options: options(
					t,
					animate,
					merge(outside(t, { color: t.text, font: { family: FONT, size: 11.5, weight: '600' } }), {
						interaction: { mode: 'index', intersect: true },
						scales: { r: { startAngle: -22.5 } },
						plugins: {
							tooltip: {
								itemSort: (a, b) => a.datasetIndex - b.datasetIndex,
								callbacks: {
									title: (items) => `Heading ${items[0].label}`,
									label: (item) =>
										` ${bands[item.datasetIndex][0]}: ${bands[item.datasetIndex][1][item.dataIndex]}`,
								},
							},
						},
					}),
				),
			};
		},

		side(t, animate) {
			const rows = DATA.channels;
			return {
				type: 'polarArea',
				data: {
					labels: names(rows),
					datasets: [
						{
							label: 'Signups',
							data: values(rows),
							backgroundColor: rows.map((_, i) => tint(t.series[i], 0.8)),
							hoverBackgroundColor: rows.map((_, i) => t.series[i]),
						},
					],
				},
				options: options(t, animate, {
					plugins: { tooltip: { callbacks: { label: (item) => ` ${item.raw}% of signups` } } },
				}),
			};
		},

		multi(t, animate) {
			const rows = DATA.cities;
			return {
				type: 'polarArea',
				data: {
					labels: names(rows),
					datasets: [
						{
							label: 'Orders a day',
							data: values(rows),
							backgroundColor: rows.map((_, i) => tint(t.series[i], 0.75)),
							hoverBackgroundColor: rows.map((_, i) => t.series[i]),
						},
					],
				},
				options: options(t, animate, {
					plugins: { tooltip: { callbacks: { label: (item) => ` ${item.raw} orders a day` } } },
				}),
			};
		},

		basic(t, animate) {
			const c = t.series[2];
			return {
				type: 'polarArea',
				data: {
					labels: names(DATA.teams),
					datasets: [
						{
							label: 'Staff',
							data: values(DATA.teams),
							backgroundColor: tint(c, 0.6),
							hoverBackgroundColor: c,
						},
					],
				},
				options: options(t, animate, {
					plugins: { tooltip: { callbacks: { label: (item) => ` ${item.raw} people` } } },
				}),
			};
		},
	};

	/* Build on first sight, rebuild on theme change */
	const charts = new Map();

	function build(canvas, animate) {
		const make = BUILD[canvas.getAttribute('data-polars-chart')];
		if (!make) return;
		const old = charts.get(canvas);
		if (old) old.destroy();
		charts.set(canvas, new Chart(canvas, make(palette(), animate && !reduceMotion, canvas)));
	}

	const canvases = Array.from(pickAll('canvas[data-polars-chart]', page));
	if ('IntersectionObserver' in window) {
		const io = new IntersectionObserver(
			(entries) => {
				entries.forEach((e) => {
					if (!e.isIntersecting) return;
					io.unobserve(e.target);
					build(e.target, true);
				});
			},
			{ rootMargin: '80px 0px' },
		);

		for (const c of canvases) {
			io.observe(c);
		}
	} else {
		for (const c of canvases) {
			build(c, false);
		}
	}

	document.addEventListener('basalt:appearance', () => {
		/* Tokens change with the attribute, so the next frame reads the new ones. */
		requestAnimationFrame(() => charts.forEach((_, canvas) => build(canvas, false)));
	});

	/* Start angle picker */
	const picker = pick('[data-polars-picker]', page);
	if (picker) {
		picker.addEventListener('click', (e) => {
			const btn = e.target.closest('[data-polars-angle]');
			if (!btn) return;
			startAngle = Number(btn.getAttribute('data-polars-angle'));

			for (const b of pickAll('[data-polars-angle]', picker)) {
				b.setAttribute('aria-pressed', String(b === btn));
			}

			const canvas = pick('[data-polars-chart="angle"]', page);
			const chart = canvas && charts.get(canvas);
			if (!chart) return;
			chart.options.scales.r.startAngle = startAngle;
			chart.update(reduceMotion ? 'none' : undefined);
		});
	}

	/* Filter chips */
	const grid = pick('[data-polars-grid]', page);
	const cards = Array.from(pickAll('.polars-card', grid));
	const count = pick('[data-polars-count]', page);

	/* One chip per chart type; "all" shows every card. */
	function applyFilter(group) {
		const shown = [];

		for (const card of cards) {
			const on = group === 'all' || card.getAttribute('data-polars-kind') === group;
			card.classList.toggle('is-hidden', !on);
			card.classList.remove('is-alone');
			if (on) shown.push(card);
		}

		grid.classList.toggle('is-filtered', group !== 'all');
		if (group !== 'all') {
			/* Cards that share a row in a filtered view; an odd one out spans it. */
			const halves = shown.filter((c) => !c.classList.contains('polars-card-full'));
			if (halves.length % 2) halves[halves.length - 1].classList.add('is-alone');
		}
		if (count) count.textContent = shown.length + (shown.length === 1 ? ' chart' : ' charts');
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
