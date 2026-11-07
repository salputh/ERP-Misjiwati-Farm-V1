/**
 * Basalt - Radar charts page
 * Twelve Chart.js radar charts. Colors are read from the
 * --basalt-* tokens each time a chart is built, and every
 * built chart is rebuilt on basalt:appearance, so palette,
 * mode, background and Flat all reach the canvases.
 */
(() => {
	'use strict';
	const page = pick('[data-radars-root]');
	if (!page || typeof Chart === 'undefined') return;

	const root = document.documentElement;
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const FONT = "'Schibsted Grotesk', sans-serif";

	function start() {
		for (const btn of pickAll('[data-radars-filter]', page)) {
			btn.addEventListener('click', () => {
				for (const b of pickAll('[data-radars-filter]', page)) {
					b.setAttribute('aria-pressed', String(b === btn));
				}

				applyFilter(btn.getAttribute('data-radars-filter'));
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

	function palette() {
		const text = token('--basalt-copy', '#12233a');
		const muted = token('--basalt-copy-muted', '#5f7186');
		const series = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => token(`--basalt-series-${n}`, '#2b6fd4'));
		return {
			series,
			text,
			/* Same recipe as --radars-quiet in radar-charts.css: small gray text
         that still clears 4.5:1 on the lighter palettes. */
			quiet: mix(muted, text, 0.82),
			rest: tint(text, 0.28),
			grid: tint(text, 0.09),
			surface: token('--basalt-plane', '#ffffff'),
			border: token('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
		};
	}

	function flat() {
		return root.getAttribute('data-basalt-gradients') === 'off';
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
				interaction: { mode: 'index', intersect: false },
				layout: { padding: 4 },
				elements: {
					line: { borderWidth: 2, borderJoinStyle: 'round' },
					point: {
						radius: 3,
						hoverRadius: 5,
						borderWidth: 0,
						hoverBorderWidth: 2,
						hoverBorderColor: t.surface,
					},
				},
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
						min: 0,
						max: 100,
						angleLines: { color: t.grid },
						grid: { color: t.grid },
						pointLabels: { color: t.quiet, font: { family: FONT, size: 11.5 }, padding: 8 },
						/* Ring values sit on a surface-colored backdrop when shown, so they
             stay readable over a fill. */
						ticks: {
							display: false,
							stepSize: 20,
							color: t.quiet,
							backdropColor: t.surface,
							backdropPadding: 2,
							font: { family: FONT, size: 10.5 },
						},
					},
				},
			},
			extra,
		);
	}

	/* One outline with its own points. */
	function shape(color, extra) {
		return Object.assign(
			{
				borderColor: color,
				backgroundColor: tint(color, 0.12),
				pointBackgroundColor: color,
				pointHoverBackgroundColor: color,
				fill: true,
			},
			extra,
		);
	}

	/* A quiet dashed outline for a reference shape (a target, an old version). */
	function reference(t, extra) {
		return Object.assign(
			{
				borderColor: t.quiet,
				borderWidth: 1.5,
				borderDash: [5, 4],
				backgroundColor: 'transparent',
				fill: false,
				pointRadius: 0,
				pointHoverRadius: 3,
				pointBackgroundColor: t.quiet,
				pointHoverBackgroundColor: t.quiet,
			},
			extra,
		);
	}

	/* Demo data */
	const DATA = {
		audit: {
			labels: ['Performance', 'Accessibility', 'Best practice', 'SEO', 'Design', 'Content'],
			scores: [82, 84, 87, 91, 91, 94],
		},
		vendors: {
			labels: ['Delivery rate', 'Uptime', 'Latency', 'Coverage', 'Compliance', 'Price'],
			sets: [
				['Relaywave', [95, 91, 87, 81, 75, 69]],
				['Signalpost', [78, 81, 89, 72, 78, 90]],
				['Textbridge', [77, 85, 87, 78, 82, 85]],
			],
		},
		training: {
			labels: ['Scheduling', 'Travel', 'Invoicing', 'Compliance', 'Speed', 'Service'],
			pass: [75, 75, 70, 90, 70, 80],
			elaine: [82, 64, 78, 94, 61, 88],
		},
		review: {
			labels: ['Craft', 'Ownership', 'Teamwork', 'Communication', 'Mentoring', 'Delivery'],
			scores: [9, 8, 8, 8, 7, 7],
		},
		shops: {
			labels: ['Footfall', 'Basket size', 'Repeat visits', 'Reviews', 'Online pickups', 'Service speed'],
			sets: [
				['Downtown', [92, 64, 71, 78, 85, 60]],
				['Moorings', [58, 88, 84, 90, 42, 81]],
			],
		},
		usage: {
			labels: ['Scheduling', 'Travel', 'Invoicing', 'Portal', 'SMS'],
			trades: {
				hvac: [4.5, 2.5, 4, 4.5, 3.5],
				plumbing: [3.5, 3.5, 4, 3.5, 3.5],
				electrical: [2, 4, 4, 3, 3.5],
				cleaning: [5, 3, 3.5, 4, 4],
				landscaping: [1.5, 5, 3, 3.5, 4.5],
			},
		},
		survey: {
			labels: ['Taste', 'Freshness', 'Packaging', 'Delivery', 'Price', 'Support'],
			scores: [92, 88, 74, 69, 63, 81],
		},
		jobs: {
			labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
			/* Thousands of visits a month across every account. */
			thousands: [410, 380, 300, 220, 160, 120, 110, 130, 210, 300, 380, 460],
		},
		team: {
			labels: ['Frontend', 'Backend', 'Infra', 'Data', 'Testing', 'Security'],
			people: [
				['Abe Boone', [65, 74, 82, 66, 76, 89]],
				['Trent Franklin', [72, 92, 82, 58, 53, 69]],
				['Derek Haas', [51, 61, 63, 73, 78, 88]],
				['Andrea Wood', [65, 74, 89, 89, 95, 93]],
			],
		},
		checkout: {
			labels: ['Load speed', 'Completion', 'Mobile use', 'Trust', 'Clarity', 'Payment options'],
			before: [48, 55, 40, 62, 58, 50],
			after: [82, 74, 79, 76, 85, 70],
		},
		providers: {
			labels: ['Uptime', 'Support', 'Docs', 'Pricing', 'API', 'Security'],
			northpay: [88, 78, 90, 66, 84, 92],
			ledgerly: [86, 80, 72, 88, 79, 76],
		},
		courier: {
			labels: ['On time', 'Tracking', 'Care', 'Price', 'Coverage', 'Returns'],
			scores: [86, 78, 72, 64, 90, 70],
		},
	};

	/* Chart builders */
	let picked = 0;

	const BUILD = {
		scored(t, animate) {
			const c = t.series[0];
			return {
				type: 'radar',
				data: {
					labels: DATA.audit.labels,
					datasets: [shape(c, { label: 'Score', data: DATA.audit.scores, backgroundColor: tint(c, 0.16) })],
				},
				options: options(t, animate),
			};
		},

		multi(t, animate) {
			return {
				type: 'radar',
				data: {
					labels: DATA.vendors.labels,
					datasets: DATA.vendors.sets.map(([name, data], i) =>
						shape(t.series[i], { label: name, data, backgroundColor: tint(t.series[i], 0.07) }),
					),
				},
				options: options(t, animate),
			};
		},

		target(t, animate) {
			const { pass, elaine } = DATA.training;
			const c = t.series[7];

			function short(i) {
				return elaine[i] < pass[i];
			}

			return {
				type: 'radar',
				data: {
					labels: DATA.training.labels,
					datasets: [
						shape(c, {
							label: 'Elaine',
							data: elaine,
							pointRadius: elaine.map((_, i) => (short(i) ? 5 : 3)),
							pointBackgroundColor: elaine.map((_, i) => (short(i) ? t.surface : c)),
							pointBorderColor: c,
							pointBorderWidth: elaine.map((_, i) => (short(i) ? 2 : 0)),
						}),
						reference(t, { label: 'Pass mark', data: pass }),
					],
				},
				options: options(t, animate, {
					plugins: {
						tooltip: {
							callbacks: {
								label: (item) =>
									item.datasetIndex === 0
										? ` Elaine: ${item.raw}${short(item.dataIndex) ? ', below the mark' : ''}`
										: ` Pass mark: ${item.raw}`,
							},
						},
					},
				}),
			};
		},

		scale(t, animate) {
			const c = t.series[3];
			return {
				type: 'radar',
				data: {
					labels: DATA.review.labels,
					datasets: [shape(c, { label: 'Q3 review', data: DATA.review.scores })],
				},
				options: options(t, animate, {
					plugins: { tooltip: { callbacks: { label: (item) => ` ${item.raw} out of 10` } } },
					/* A ring every two points, a number on every other ring so the
             labels never touch in a small card. */
					scales: {
						r: { max: 10, ticks: { display: true, stepSize: 2, callback: (v) => (v % 4 === 2 ? v : '') } },
					},
				}),
			};
		},

		highlight(t, animate) {
			return {
				type: 'radar',
				data: {
					labels: DATA.shops.labels,
					datasets: DATA.shops.sets.map(([name, data], i) => highlightStyle(t, i, { label: name, data })),
				},
				options: options(t, animate),
			};
		},

		multiple(t, animate, canvas) {
			const key = canvas.getAttribute('data-radars-trade');
			/* One ramp color per industry, so the five shapes read as five industries. */
			const c = t.series[{ hvac: 0, plumbing: 2, electrical: 4, cleaning: 7, landscaping: 1 }[key] || 0];
			return {
				type: 'radar',
				data: {
					labels: DATA.usage.labels,
					datasets: [
						shape(c, {
							label: 'Score',
							data: DATA.usage.trades[key] || [],
							pointRadius: 2,
							backgroundColor: tint(c, 0.16),
						}),
					],
				},
				options: options(t, animate, {
					layout: { padding: 6 },
					plugins: { tooltip: { callbacks: { label: (item) => ` ${item.raw} out of 5` } } },
					scales: {
						r: {
							max: 5,
							ticks: { stepSize: 1 },
							pointLabels: { font: { size: 10.5 }, padding: 4 },
						},
					},
				}),
			};
		},

		filled(t, animate) {
			const c = t.series[1];
			return {
				type: 'radar',
				data: {
					labels: DATA.survey.labels,
					datasets: [
						shape(c, {
							label: 'Score',
							data: DATA.survey.scores,
							backgroundColor(context) {
								const r = context.chart.scales.r;
								if (!r || !r.drawingArea) return tint(c, 0.22);
								/* Flat mode drops the fade and keeps one even tint. */
								if (flat()) return tint(c, 0.22);
								const g = context.chart.ctx.createRadialGradient(
									r.xCenter,
									r.yCenter,
									0,
									r.xCenter,
									r.yCenter,
									r.drawingArea,
								);
								g.addColorStop(0, tint(c, 0.04));
								g.addColorStop(1, tint(c, 0.42));
								return g;
							},
						}),
					],
				},
				options: options(t, animate),
			};
		},

		circular(t, animate) {
			const c = t.series[2];
			return {
				type: 'radar',
				data: {
					labels: DATA.jobs.labels,
					datasets: [
						shape(c, { label: 'Visits booked', data: DATA.jobs.thousands, tension: 0.3, pointRadius: 2.5 }),
					],
				},
				options: options(t, animate, {
					plugins: { tooltip: { callbacks: { label: (item) => ` ${item.raw}k visits` } } },
					scales: { r: { max: 500, grid: { circular: true }, ticks: { stepSize: 100 } } },
				}),
			};
		},

		team(t, animate) {
			return {
				type: 'radar',
				data: {
					labels: DATA.team.labels,
					datasets: DATA.team.people.map(([name, data], i) =>
						shape(t.series[i], {
							label: name,
							data,
							backgroundColor: tint(t.series[i], 0.05),
							pointRadius: 2.5,
						}),
					),
				},
				options: options(t, animate),
			};
		},

		before(t, animate) {
			const c = t.series[1];
			return {
				type: 'radar',
				data: {
					labels: DATA.checkout.labels,
					datasets: [
						shape(c, { label: 'New checkout', data: DATA.checkout.after, backgroundColor: tint(c, 0.18) }),
						reference(t, { label: 'Old checkout', data: DATA.checkout.before }),
					],
				},
				options: options(t, animate, {
					plugins: {
						tooltip: {
							callbacks: {
								afterBody: (items) => {
									const i = items[0] ? items[0].dataIndex : 0;
									return `Up ${DATA.checkout.after[i] - DATA.checkout.before[i]} points`;
								},
							},
						},
					},
				}),
			};
		},

		styles(t, animate) {
			const a = t.series[0];
			const b = t.series[4];
			return {
				type: 'radar',
				data: {
					labels: DATA.providers.labels,
					datasets: [
						shape(a, {
							label: 'Northpay',
							data: DATA.providers.northpay,
							backgroundColor: tint(a, 0.06),
							pointStyle: 'triangle',
							pointRadius: 5,
							hoverRadius: 7,
						}),
						shape(b, {
							label: 'Ledgerly',
							data: DATA.providers.ledgerly,
							backgroundColor: tint(b, 0.06),
							pointStyle: 'rectRot',
							pointRadius: 5,
							hoverRadius: 7,
						}),
					],
				},
				options: options(t, animate),
			};
		},

		basic(t, animate) {
			const c = t.series[2];
			return {
				type: 'radar',
				data: {
					labels: DATA.courier.labels,
					datasets: [shape(c, { label: 'Score', data: DATA.courier.scores, fill: false })],
				},
				options: options(t, animate),
			};
		},
	};

	/* The picked shop in color and on top, the other one in gray. */
	function highlightStyle(t, i, ds) {
		const on = i === picked;
		const c = on ? t.series[0] : t.rest;
		return Object.assign(ds, {
			borderColor: c,
			pointBackgroundColor: c,
			pointHoverBackgroundColor: c,
			backgroundColor: on ? tint(t.series[0], 0.16) : 'transparent',
			borderWidth: on ? 2.5 : 1.5,
			pointRadius: on ? 3 : 0,
			fill: on,
			order: on ? 0 : 1,
		});
	}

	/* Build on first sight, rebuild on theme change */
	const charts = new Map();

	function build(canvas, animate) {
		const make = BUILD[canvas.getAttribute('data-radars-chart')];
		if (!make) return;
		const old = charts.get(canvas);
		if (old) old.destroy();
		charts.set(canvas, new Chart(canvas, make(palette(), animate && !reduceMotion, canvas)));
	}

	const canvases = Array.from(pickAll('canvas[data-radars-chart]', page));
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

	/* Highlight picker */
	const picker = pick('[data-radars-picker]', page);
	if (picker) {
		picker.addEventListener('click', (e) => {
			const btn = e.target.closest('[data-radars-pick]');
			if (!btn) return;
			picked = Number(btn.getAttribute('data-radars-pick'));

			for (const b of pickAll('[data-radars-pick]', picker)) {
				b.setAttribute('aria-pressed', String(b === btn));
			}

			const canvas = pick('[data-radars-chart="highlight"]', page);
			const chart = canvas && charts.get(canvas);
			if (!chart) return;
			const t = palette();
			chart.data.datasets.forEach((ds, i) => highlightStyle(t, i, ds));
			chart.update(reduceMotion ? 'none' : undefined);
		});
	}

	/* Filter chips */
	const grid = pick('[data-radars-grid]', page);
	const cards = Array.from(pickAll('.radars-card', grid));
	const count = pick('[data-radars-count]', page);

	/* One chip per chart type; "all" shows every card. */
	function applyFilter(group) {
		let shown = 0;

		for (const card of cards) {
			const on = group === 'all' || card.getAttribute('data-radars-kind') === group;
			card.classList.toggle('is-hidden', !on);
			if (on) shown += 1;
		}

		grid.classList.toggle('is-filtered', group !== 'all');
		if (count) count.textContent = shown + (shown === 1 ? ' chart' : ' charts');
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
