/**
 * Basalt - Report Builder (report-builder.html)
 * One flow from top to bottom: pick a measure, how to split it, the
 * months and any filters; the preview draws it as a chart and a table
 * as you go; Save puts it in the Reports library.
 *
 * Data: assets/basalt/js/data/multipurpose/report-figures.js (Fieldline's month-end
 * figures by plan, region and channel, built on plans.js) and
 * assets/basalt/js/data/multipurpose/reports.js (the saved reports in the library).
 * Reports saved here are kept in this browser so the list survives a
 * reload; in your app, POST them to your reports API instead (see
 * save() below).
 *
 * The chart is plain Chart.js 4: colors are read from the --basalt-*
 * tokens each time it is built, and it is rebuilt on
 * basalt:appearance.
 */
(() => {
	'use strict';
	const root = pick('[data-rb-root]');
	const F = window.Basalt.data && window.Basalt.data.reportFigures;
	if (!root || !F) return;
	const LIB = (window.Basalt.data && window.Basalt.data.reports) || { reports: [] };

	function start() {
		el.saved.addEventListener('click', (e) => {
			const b = e.target.closest('[data-rb-load]');
			if (b) {
				load(b.dataset.rbLoad);
				return;
			}
			if (e.target.closest('a')) return;
			const tr = e.target.closest('tr[data-rb-id]');
			if (!tr) return;
			const link = pick('a.rb-row-name', tr);
			if (!link) {
				load(tr.dataset.rbId);
				return;
			}
			if (e.metaKey || e.ctrlKey) window.open(link.href, '_blank', 'noopener');
			else location.href = link.href;
		});

		/* Save */
		const dialog = document.getElementById('rb-save-dialog');
		const form = pick('[data-rb-save-form]', dialog);
		const nameInput = pick('[data-rb-save-name]', dialog);
		pick('[data-rb-save]', root).addEventListener('click', () => {
			nameInput.value = autoTitle();
			nameInput.classList.remove('is-invalid');
			bootstrap.Modal.getOrCreateInstance(dialog).show();
		});
		dialog.addEventListener('shown.bs.modal', () => {
			nameInput.focus();
			nameInput.select();
		});
		nameInput.addEventListener('input', () => nameInput.classList.remove('is-invalid'));
		form.addEventListener('submit', (e) => {
			e.preventDefault();
			const name = nameInput.value.trim();
			if (!name) {
				nameInput.classList.add('is-invalid');
				nameInput.focus();
				return;
			}
			const share = (pick('input[name="rbShare"]:checked', dialog) || {}).value || 'me';
			/* In your app: POST /api/reports { name, settings, share } and use the id it returns. */
			const report = {
				id: `rb-${Date.now().toString(36)}`,
				name,
				updated: TODAY,
				share,
				settings: Object.assign({}, state),
			};
			mine = [report].concat(mine).slice(0, 12);
			writeSaved(mine);
			loadedId = report.id;
			renderSaved();
			bootstrap.Modal.getOrCreateInstance(dialog).hide();
			toast({
				tone: 'success',
				title: 'Saved to Reports',
				text: name + (share === 'team' ? ', shared with the team.' : ', visible to you only.'),
				actions: [
					{
						label: 'Open Reports',
						onClick: () => {
							location.href = 'reports.html';
						},
					},
				],
			});
			announce(`${name} saved`);
		});

		/* Export */
		pick('[data-rb-export]', root).addEventListener('click', () => {
			const r = compute();
			const m = r.m;
			let rows;
			if (state.split === 'month') {
				rows = [['Month', m.label]];
				for (let i = r.a; i <= r.b; i++) rows.push([monLong(F.months[i]), Math.round(r.total[i])]);
			} else {
				rows = [
					['Month'].concat(
						r.groups.map((g) => g.name),
						['Total'],
					),
				];
				for (let i = r.a; i <= r.b; i++)
					rows.push(
						[monLong(F.months[i])].concat(
							r.groups.map((g) => Math.round(g.data[i])),
							[Math.round(r.total[i])],
						),
					);
			}
			const csv = rows
				.map((x) => x.map((v) => (/[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(','))
				.join('\r\n');
			const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
			const a = document.createElement('a');
			a.href = url;
			a.download = `${autoTitle()
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')}.csv`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
			toast({
				tone: 'success',
				icon: 'bi-download',
				title: 'Report exported',
				text: `${autoTitle()}, ${periodText(r.a, r.b)} as CSV.`,
			});
		});

		/* Start */
		syncControls();
		renderSaved();
		const first = compute();
		render(false);
		if (chart) chart.destroy();
		chart = null;
		/* Draw the preview when it scrolls into view. */
		if ('IntersectionObserver' in window) {
			const io = new IntersectionObserver(
				(entries) => {
					if (!entries.some((x) => x.isIntersecting)) return;
					io.disconnect();
					draw(compute(), lastAnimate);
				},
				{ rootMargin: '120px 0px' },
			);
			io.observe(el.canvas);
		} else draw(first, false);
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(s) {
		return String(s).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	const ME = 'ja';
	const TODAY = '2026-10-09';
	const STORE_KEY = 'basalt-report-builder-saved';

	/* Formatting */
	const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const MONTH = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	];

	function monShort(ym) {
		return `${MON[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}`;
	}

	function monLong(ym) {
		return `${MONTH[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}`;
	}

	function monTick(ym) {
		return MON[Number(ym.slice(5)) - 1];
	}

	function dayShort(s) {
		const [y, m, d] = s.split('-').map(Number);
		return `${MON[m - 1]} ${d}${String(y) === TODAY.slice(0, 4) ? '' : `, ${y}`}`;
	}

	function num(n) {
		return Math.round(n).toLocaleString('en-US');
	}

	function measure(id) {
		return F.measures.find((m) => m.id === id);
	}

	function fmt(v, m) {
		return m.unit === 'money' ? `$${num(v)}` : num(v);
	}
	function short(v, m) {
		const pre = m.unit === 'money' ? '$' : '';
		const a = Math.abs(v);
		if (a >= 1e6) return `${pre + (v / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, '')}M`;
		if (a >= 1e4) return `${pre + Math.round(v / 1e3)}k`;
		if (a >= 1e3) return `${pre + (v / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
		return pre + Math.round(v);
	}

	function pct(a, b) {
		return b ? (a / b - 1) * 100 : null;
	}

	function changeHtml(p, cls) {
		if (p === null || !isFinite(p)) return '<span class="rb-quiet">–</span>';
		const r = Math.round(p * 10) / 10;
		if (r === 0) return '<span class="rb-quiet">No change</span>';
		return `<span class="${cls || ''}${r > 0 ? ' rb-up' : ' rb-down'}">${r > 0 ? '+' : '−'}${Math.abs(r).toFixed(1)}%</span>`;
	}

	/* Splits */
	const SPLITS = {
		month: { label: 'Month only', of: null, list: [] },
		plan: { label: 'Plan', of: 'plan', list: F.plans },
		region: { label: 'Region', of: 'region', list: F.regions },
		channel: { label: 'Channel', of: 'channel', list: F.channels },
		billing: { label: 'Billing', of: 'billing', list: F.billing },
	};
	/* Each group keeps its own color wherever it appears; the plan colors
     are the plans' own, as on Subscription Plans. */
	const SLOT = {
		plan: (g) => F.plans.find((p) => p.id === g.id).tone,
		region: (g, i) => [1, 3, 5, 2][i],
		channel: (g, i) => [1, 5][i],
		billing: (g, i) => [1, 3][i],
	};

	/* State */
	const DEFAULTS = {
		measure: 'mrr',
		split: 'plan',
		period: '12',
		from: '2026-01',
		to: '2026-09',
		plan: 'all',
		region: 'all',
		channel: 'all',
		show: 'a',
	};
	const state = Object.assign({}, DEFAULTS);
	let loadedId = null;

	const LAST = F.months.length - 1;
	function range() {
		if (state.period === 'custom') {
			let a = F.months.indexOf(state.from);
			let b = F.months.indexOf(state.to);
			if (a < 0) a = 0;
			if (b < 0) b = LAST;
			if (a > b) [a, b] = [b, a];
			return [a, b];
		}
		if (state.period === 'ytd') return [F.months.indexOf(`${F.months[LAST].slice(0, 4)}-01`), LAST];
		const n = Number(state.period);
		return [LAST - n + 1, LAST];
	}
	function periodText(a, b) {
		if (a === b) return monLong(F.months[a]);
		return `${F.months[a].slice(0, 4) === F.months[b].slice(0, 4) ? MON[Number(F.months[a].slice(5)) - 1] : monShort(F.months[a])} to ${monShort(F.months[b])}`;
	}

	/* The figures for the current settings: one series per group (or one
     total), each a value per month across every month held. */
	function compute() {
		const m = measure(state.measure);
		const sp = SPLITS[state.split];
		const cells = F.cells.filter(
			(c) =>
				(state.plan === 'all' || c.plan === state.plan) &&
				(state.region === 'all' || c.region === state.region) &&
				(state.channel === 'all' || c.channel === state.channel),
		);

		function zero() {
			return F.months.map(() => 0);
		}

		const total = zero();
		const groups = sp.of
			? sp.list.map((g, i) => ({ id: g.id, name: g.name, slot: SLOT[state.split](g, i), data: zero() }))
			: [];

		for (const c of cells) {
			const v = c.values[m.id];
			v.forEach((x, i) => {
				total[i] += x;
				if (state.split === 'billing') {
					groups[0].data[i] += x * (1 - c.annual);
					groups[1].data[i] += x * c.annual;
				} else if (sp.of) {
					groups.find((g) => g.id === c[sp.of]).data[i] += x;
				}
			});
		}

		const [a, b] = range();
		const len = b - a + 1;
		const prev = a - len >= 0 ? [a - len, a - 1] : null;

		function over(arr, r) {
			return m.kind === 'stock' ? arr[r[1]] : arr.slice(r[0], r[1] + 1).reduce((s, x) => s + x, 0);
		}

		const shown = groups.filter((g) => g.data.slice(a, b + 1).some((x) => x > 0.5));

		for (const g of shown) {
			g.value = over(g.data, [a, b]);
			g.prev = prev ? over(g.data, prev) : null;
		}

		return {
			m,
			sp,
			a,
			b,
			prev,
			total,
			value: over(total, [a, b]),
			prevValue: prev ? over(total, prev) : null,
			groups: shown,
			empty: !total.slice(a, b + 1).some((x) => x > 0.5),
		};
	}

	/* Words */
	function filterWords() {
		const parts = [];
		if (state.plan !== 'all') parts.push(`${F.plans.find((p) => p.id === state.plan).name} plan`);
		if (state.region !== 'all') parts.push(F.regions.find((r) => r.id === state.region).name);
		if (state.channel !== 'all') parts.push(F.channels.find((c) => c.id === state.channel).name);
		return parts;
	}
	function autoTitle() {
		const m = measure(state.measure);
		return m.short + (state.split === 'month' ? ' by month' : ` by ${SPLITS[state.split].label.toLowerCase()}`);
	}

	/* Elements */
	const el = {
		fields: {},
		custom: pickAll('[data-rb-custom]', root),
		from: pick('[data-rb-from]', root),
		to: pick('[data-rb-to]', root),
		show: pickAll('[data-rb-show]', root),
		showLabel: (v) => pick(`[data-rb-show-label="${v}"]`, root),
		reset: pick('[data-rb-reset]', root),
		title: pick('[data-rb-title]', root),
		desc: pick('[data-rb-desc]', root),
		total: pick('[data-rb-total]', root),
		change: pick('[data-rb-change]', root),
		legend: pick('[data-rb-legend]', root),
		chartbox: pick('[data-rb-chartbox]', root),
		canvas: pick('[data-rb-chart]', root),
		nodata: pick('[data-rb-nodata]', root),
		tablewrap: pick('[data-rb-tablewrap]', root),
		caption: pick('[data-rb-caption]', root),
		thead: pick('[data-rb-thead]', root),
		tbody: pick('[data-rb-tbody]', root),
		tfoot: pick('[data-rb-tfoot]', root),
		saved: pick('[data-rb-saved]', root),
		live: pick('[data-rb-live]', root),
	};

	for (const k of ['measure', 'split', 'period', 'plan', 'region', 'channel']) {
		el.fields[k] = pick(`[data-rb="${k}"]`, root);
	}

	function announce(t) {
		el.live.textContent = '';
		setTimeout(() => {
			el.live.textContent = t;
		}, 40);
	}

	/* Chart */
	const FONT = getComputedStyle(document.body).fontFamily || 'sans-serif';

	function token(n, f) {
		return window.Basalt.token ? window.Basalt.token(n, f) : f;
	}

	function series(slot) {
		return token(`--basalt-series-${slot}`, '#6d3fe0');
	}

	function rgba(hex, al) {
		const x = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
		if (!x) return hex;
		const n = parseInt(x[1], 16);
		return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${al})`;
	}
	function mix(p, q, w) {
		const pa = /^#?([0-9a-f]{6})$/i.exec((p || '').trim());
		const pb = /^#?([0-9a-f]{6})$/i.exec((q || '').trim());
		if (!pa || !pb) return p;
		const x = parseInt(pa[1], 16);
		const y = parseInt(pb[1], 16);

		function ch(s) {
			return Math.round(((x >> s) & 255) * w + ((y >> s) & 255) * (1 - w));
		}

		return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
	}
	function palette() {
		const text = token('--basalt-copy', '#12233a');
		return {
			text,
			quiet: mix(token('--basalt-copy-muted', '#5f7186'), text, 0.72),
			surface: token('--basalt-plane', '#ffffff'),
			border: token('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			grid: rgba(/^#[0-9a-f]{6}$/i.test(text) ? text : '#12233a', 0.07),
		};
	}

	/* What the chart draws for the current settings. */
	function kind() {
		return state.split === 'month'
			? state.show === 'a'
				? 'line'
				: 'columns'
			: state.show === 'a'
				? 'stacked'
				: 'ranked';
	}

	function config(r, animate) {
		const t = palette();
		const m = r.m;
		const k = kind();
		const months = F.months.slice(r.a, r.b + 1);
		const labels = months.map((ym, i) =>
			i === 0 || ym.endsWith('-01') ? [monTick(ym), ym.slice(0, 4)] : monTick(ym),
		);
		const tick = { color: t.quiet, font: { family: FONT, size: 11.5 }, padding: 8 };
		const tooltip = {
			backgroundColor: t.surface,
			titleColor: t.text,
			bodyColor: t.text,
			footerColor: t.text,
			borderColor: t.border,
			borderWidth: 1,
			padding: 10,
			cornerRadius: 8,
			boxPadding: 4,
			usePointStyle: true,
			titleFont: { family: FONT, size: 12, weight: '600' },
			bodyFont: { family: FONT, size: 12 },
			footerFont: { family: FONT, size: 12, weight: '600' },
		};
		const base = {
			responsive: true,
			maintainAspectRatio: false,
			animation: animate ? { duration: 500, easing: 'easeOutQuart' } : false,
			interaction: { mode: 'index', intersect: false },
			plugins: { legend: { display: false }, tooltip },
			elements: {
				point: { radius: 0, hoverRadius: 5, hoverBorderWidth: 2, hoverBorderColor: t.surface },
				line: { borderWidth: 2.5, borderCapStyle: 'round', borderJoinStyle: 'round' },
			},
			scales: {
				x: {
					grid: { display: false },
					border: { display: false },
					ticks: Object.assign({ maxRotation: 0, autoSkipPadding: 12 }, tick),
				},
				y: {
					beginAtZero: m.kind === 'flow' || k !== 'line',
					grid: { color: t.grid },
					border: { display: false },
					ticks: Object.assign({ maxTicksLimit: 5, callback: (v) => short(v, m) }, tick),
				},
			},
		};
		if (k === 'ranked') {
			const gs = r.groups.slice().sort((x, y) => y.value - x.value);
			return {
				type: 'bar',
				data: {
					labels: gs.map((g) => g.name),
					datasets: [
						{
							label: m.short,
							data: gs.map((g) => Math.round(g.value)),
							backgroundColor: gs.map((g) => series(g.slot)),
							borderRadius: 6,
							borderSkipped: 'start',
							maxBarThickness: 34,
						},
					],
				},
				options: Object.assign({}, base, {
					indexAxis: 'y',
					interaction: { mode: 'nearest', axis: 'y', intersect: false },
					plugins: {
						legend: { display: false },
						tooltip: Object.assign({}, tooltip, {
							callbacks: {
								label: (it) =>
									` ${fmt(it.parsed.x, m)}${r.value ? `, ${Math.round((it.parsed.x / r.value) * 100)}% of the total` : ''}`,
							},
						}),
					},
					scales: {
						x: {
							beginAtZero: true,
							grid: { color: t.grid },
							border: { display: false },
							ticks: Object.assign({ maxTicksLimit: 5, callback: (v) => short(v, m) }, tick),
						},
						y: {
							grid: { display: false },
							border: { display: false },
							ticks: Object.assign({}, tick, {
								color: t.text,
								font: { family: FONT, size: 12, weight: '600' },
							}),
						},
					},
				}),
			};
		}
		if (k === 'stacked') {
			return {
				type: 'bar',
				data: {
					labels,
					datasets: r.groups.map((g, i) => ({
						label: g.name,
						data: g.data.slice(r.a, r.b + 1).map(Math.round),
						backgroundColor: series(g.slot),
						borderColor: t.surface,
						borderWidth: { top: 2 },
						borderSkipped: 'bottom',
						borderRadius: i === r.groups.length - 1 ? { topLeft: 5, topRight: 5 } : 0,
						maxBarThickness: 40,
					})),
				},
				options: Object.assign({}, base, {
					plugins: {
						legend: { display: false },
						tooltip: Object.assign({}, tooltip, {
							callbacks: {
								title: (it) => monLong(months[it[0].dataIndex]),
								label: (it) => ` ${it.dataset.label}: ${fmt(it.parsed.y, m)}`,
								labelColor: (it) => ({
									borderColor: series(r.groups[it.datasetIndex].slot),
									backgroundColor: series(r.groups[it.datasetIndex].slot),
								}),
								footer: (it) =>
									`Total ${fmt(
										it.reduce((s, x) => s + x.parsed.y, 0),
										m,
									)}`,
							},
						}),
					},
					scales: {
						x: Object.assign({}, base.scales.x, { stacked: true }),
						y: Object.assign({}, base.scales.y, { stacked: true, beginAtZero: true }),
					},
				}),
			};
		}
		/* Month only: the total, with the period before dashed behind it. */
		const c = series(1);
		const cur = r.total.slice(r.a, r.b + 1).map(Math.round);
		const datasets = [];
		if (k === 'line') {
			const fill = window.Basalt.chartFill(
				[
					[0, rgba(c, 0.22)],
					[1, rgba(c, 0)],
				],
				{ flat: rgba(c, 0.12) },
			);
			datasets.push({
				label: periodText(r.a, r.b),
				data: cur,
				borderColor: c,
				backgroundColor: fill,
				pointBackgroundColor: c,
				fill: 'start',
				tension: 0.35,
			});
			if (r.prev)
				datasets.push({
					label: periodText(r.prev[0], r.prev[1]),
					data: r.total.slice(r.prev[0], r.prev[1] + 1).map(Math.round),
					borderColor: t.quiet,
					backgroundColor: t.quiet,
					pointBackgroundColor: t.quiet,
					borderWidth: 1.5,
					borderDash: [5, 5],
					fill: false,
					tension: 0.35,
				});
		} else {
			datasets.push({
				label: periodText(r.a, r.b),
				data: cur,
				backgroundColor: c,
				borderRadius: 5,
				borderSkipped: 'start',
				maxBarThickness: 40,
			});
			if (r.prev)
				datasets.push({
					label: periodText(r.prev[0], r.prev[1]),
					data: r.total.slice(r.prev[0], r.prev[1] + 1).map(Math.round),
					backgroundColor: rgba(c, 0.28),
					borderRadius: 5,
					borderSkipped: 'start',
					maxBarThickness: 40,
				});
		}
		const pm = r.prev ? F.months.slice(r.prev[0], r.prev[1] + 1) : [];
		return {
			type: k === 'line' ? 'line' : 'bar',
			data: { labels, datasets },
			options: Object.assign({}, base, {
				plugins: {
					legend: { display: false },
					tooltip: Object.assign({}, tooltip, {
						callbacks: {
							title: (it) => monLong(months[it[0].dataIndex]),
							label: (it) =>
								` ${it.datasetIndex ? monShort(pm[it.dataIndex]) : monShort(months[it.dataIndex])}: ${fmt(it.parsed.y, m)}`,
						},
					}),
				},
			}),
		};
	}

	let chart = null;
	const lastAnimate = true;
	function draw(r, animate) {
		if (typeof Chart === 'undefined') return;
		if (chart) {
			chart.destroy();
			chart = null;
		}
		if (r.empty) return;
		chart = new Chart(
			el.canvas,
			config(r, animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches),
		);
	}
	document.addEventListener('basalt:appearance', () => requestAnimationFrame(() => render(false)));

	/* Preview */
	function paintLegend(r) {
		const k = kind();
		let html = '';
		if (k === 'stacked')
			html = r.groups
				.map(
					(g) =>
						`<li><span class="rb-legend-dot" style="background:${series(g.slot)}" aria-hidden="true"></span>${htmlSafe(g.name)}</li>`,
				)
				.join('');
		else if (k === 'line' || k === 'columns') {
			html = `<li><span class="rb-legend-dot" style="background:${series(1)}" aria-hidden="true"></span>${htmlSafe(periodText(r.a, r.b))}</li>`;
			if (r.prev)
				html += `<li>${k === 'line' ? '<span class="rb-legend-dash" aria-hidden="true"></span>' : `<span class="rb-legend-dot" style="background:${rgba(series(1), 0.28)}" aria-hidden="true"></span>`}${htmlSafe(periodText(r.prev[0], r.prev[1]))}</li>`;
		}
		el.legend.innerHTML = html;
	}

	function paintTable(r) {
		const m = r.m;
		const name = htmlSafe(m.short);
		if (state.split === 'month') {
			el.caption.textContent = `${m.long} each month, ${periodText(r.a, r.b)}, with the change on the month before`;
			el.thead.innerHTML = `<tr><th scope="col">Month</th><th scope="col" class="rb-col-num rb-r">${name}</th><th scope="col" class="rb-col-change rb-r">Change</th></tr>`;
			const rows = [];
			for (let i = r.b; i >= r.a; i--) {
				const before = i > 0 ? r.total[i - 1] : null;
				rows.push(
					`<tr><th scope="row" class="fw-semibold"><span class="rb-mon-long">${htmlSafe(monLong(F.months[i]))}</span><span class="rb-mon-short">${htmlSafe(monShort(F.months[i]))}</span></th><td class="rb-r">${fmt(r.total[i], m)}</td><td class="rb-r">${changeHtml(before === null ? null : pct(r.total[i], before))}</td></tr>`,
				);
			}
			el.tbody.innerHTML = rows.join('');
			el.tfoot.innerHTML = `<tr><th scope="row">${m.kind === 'stock' ? `At ${htmlSafe(monShort(F.months[r.b]))}` : 'Total'}</th><td class="rb-r">${fmt(r.value, m)}</td><td class="rb-r">${changeHtml(r.prevValue === null ? null : pct(r.value, r.prevValue))}</td></tr>`;
			return;
		}
		const gs = r.groups.slice().sort((x, y) => y.value - x.value);
		const at = m.kind === 'stock' ? `at ${monShort(F.months[r.b])}` : periodText(r.a, r.b);
		el.caption.textContent = `${m.long} by ${SPLITS[state.split].label.toLowerCase()}, ${at}, with each one's share and the change on the period before`;
		el.thead.innerHTML = `<tr><th scope="col">${htmlSafe(SPLITS[state.split].label)}</th><th scope="col" class="rb-col-num rb-r">${name}</th><th scope="col" class="rb-col-share rb-r">Share</th><th scope="col" class="rb-col-change rb-r">Change</th></tr>`;
		el.tbody.innerHTML = gs
			.map((g) => {
				const share = r.value ? (g.value / r.value) * 100 : 0;
				const c = series(g.slot);
				return `<tr><th scope="row"><span class="rb-group"><span class="rb-group-dot" style="background:${c}" aria-hidden="true"></span><span class="rb-group-name">${htmlSafe(g.name)}</span></span></th><td class="rb-r">${fmt(g.value, m)}</td><td class="rb-r rb-cell-share"><span class="rb-share"><span class="rb-share-bar" aria-hidden="true"><span style="width:${share.toFixed(1)}%;background:${c}"></span></span>${Math.round(share)}%</span></td><td class="rb-r">${changeHtml(g.prev === null ? null : pct(g.value, g.prev))}</td></tr>`;
			})
			.join('');
		el.tfoot.innerHTML = `<tr><th scope="row">Total</th><td class="rb-r">${fmt(r.value, m)}</td><td class="rb-r rb-cell-share">100%</td><td class="rb-r">${changeHtml(r.prevValue === null ? null : pct(r.value, r.prevValue))}</td></tr>`;
	}

	function render(animate) {
		const r = compute();
		const m = r.m;
		const fw = filterWords();
		el.title.textContent = autoTitle();
		el.desc.textContent = [m.long, periodText(r.a, r.b)]
			.concat(fw.length ? fw : ['every plan, region and channel'])
			.join(' · ');
		pick('[data-rb-headline]', root).hidden = r.empty;
		if (r.empty) {
			el.legend.innerHTML = '';
			el.chartbox.hidden = true;
			el.tablewrap.hidden = true;
			el.nodata.hidden = false;
			el.nodata.innerHTML = `<div class="basalt-empty basalt-empty-compact rb-nodata"><span class="rb-nodata-icon" aria-hidden="true"><i class="bi bi-funnel"></i></span><h3 class="basalt-empty-title">Nothing to count</h3><p class="basalt-empty-text">${state.plan === 'free' && (m.unit === 'money' || m.id === 'accounts' || m.id === 'seats' || m.id === 'signups') ? `Free accounts pay nothing, so they have no ${htmlSafe(m.short.toLowerCase())}.` : `These filters leave no ${htmlSafe(m.short.toLowerCase())} in ${htmlSafe(periodText(r.a, r.b))}.`}</p><div class="basalt-empty-actions"><button type="button" class="btn btn-sm btn-outline-secondary" data-rb-clear>Clear filters</button></div></div>`;
			draw(r, false);
			return r;
		}
		el.chartbox.hidden = false;
		el.tablewrap.hidden = false;
		el.nodata.hidden = true;
		el.total.textContent = fmt(r.value, m);
		const lenWord = r.b - r.a + 1 === 1 ? 'month' : `${r.b - r.a + 1} months`;
		el.change.innerHTML =
			r.prevValue === null
				? m.kind === 'stock'
					? `At ${htmlSafe(monShort(F.months[r.b]))}`
					: `Across ${lenWord}`
				: `${changeHtml(pct(r.value, r.prevValue))} on the ${lenWord === 'month' ? 'month' : lenWord} before`;
		el.canvas.setAttribute(
			'aria-label',
			`${autoTitle()}, ${periodText(r.a, r.b)}. The same numbers are in the table below.`,
		);
		paintLegend(r);
		paintTable(r);
		draw(r, animate);
		return r;
	}

	/* Controls */
	function syncControls() {
		const month = state.split === 'month';
		el.showLabel('a').textContent = month ? 'Line' : 'Over time';
		el.showLabel('b').textContent = month ? 'Columns' : 'Ranked';
		el.show.forEach((x) => {
			x.checked = x.value === state.show;
		});
		el.custom.forEach((f) => {
			f.hidden = state.period !== 'custom';
		});
		el.reset.hidden = state.plan === 'all' && state.region === 'all' && state.channel === 'all';
	}

	for (const k of Object.keys(el.fields)) {
		el.fields[k].addEventListener('change', () => {
			if (state[k] === el.fields[k].value) return;
			state[k] = el.fields[k].value;
			loadedId = null;
			syncControls();
			render(true);
			markLoaded();
		});
	}

	el.show.forEach((x) =>
		x.addEventListener('change', () => {
			if (x.checked) {
				state.show = x.value;
				render(true);
			}
		}),
	);
	function onDate(which) {
		return (e) => {
			const v = (e.detail && e.detail.value) || '';
			if (!v) return;
			state[which] = v.slice(0, 7);
			render(true);
		};
	}
	el.from.addEventListener('change', onDate('from'));
	el.to.addEventListener('change', onDate('to'));
	function clearFilters() {
		for (const k of ['plan', 'region', 'channel']) {
			state[k] = 'all';
			el.fields[k].value = 'all';
			el.fields[k].dispatchEvent(new Event('change', { bubbles: true }));
		}

		syncControls();
		render(true);
		announce('Showing every plan, region and channel again');
	}
	el.reset.addEventListener('click', clearFilters);
	el.nodata.addEventListener('click', (e) => {
		if (e.target.closest('[data-rb-clear]')) clearFilters();
	});

	/* Saved reports */
	/* Library reports the builder can open: their measure and split
     translated to the builder's names. */
	const METRIC = { mrr: 'mrr', new: 'new', accounts: 'accounts', seats: 'seats' };
	const SPLIT = { none: 'month', plan: 'plan', region: 'region', segment: 'channel', billing: 'billing' };
	const SHOW = { line: 'a', columns: 'b', stacked: 'a', share: 'a', bars: 'b', ring: 'b', bullet: 'b' };
	function readSaved() {
		try {
			const v = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
			return Array.isArray(v) ? v : [];
		} catch {
			return [];
		}
	}
	function writeSaved(list) {
		try {
			localStorage.setItem(STORE_KEY, JSON.stringify(list));
		} catch {
			/* private window: kept for this visit only */
		}
	}
	let mine = readSaved();
	function library() {
		return LIB.reports
			.filter((x) => x.owner === ME && METRIC[x.metric] && SPLIT[x.breakdown])
			.map((x) => ({
				id: x.id,
				name: x.name,
				updated: x.updated,
				lib: true,
				settings: Object.assign({}, DEFAULTS, {
					measure: METRIC[x.metric],
					split: SPLIT[x.breakdown],
					show: SHOW[x.kind] || 'a',
				}),
			}));
	}
	function whatText(s) {
		const m = measure(s.measure);
		return m.short + (s.split === 'month' ? ' by month' : ` by ${SPLITS[s.split].label.toLowerCase()}`);
	}
	function renderSaved() {
		if (window.bootstrap && bootstrap.Tooltip)
			for (const t of pickAll('[data-bs-toggle="tooltip"]', el.saved)) {
				const i = bootstrap.Tooltip.getInstance(t);
				if (i) {
					if (i.tip && i.tip.classList.contains('show')) i.hide();
					else if (!i.tip) i.dispose();
				}
			}
		const rows = mine.concat(library()).sort((a, b) => b.updated.localeCompare(a.updated));
		el.saved.innerHTML = rows
			.map((x) => {
				const href = x.lib ? `report-details.html?id=${encodeURIComponent(x.id)}` : '';
				return `<tr class="rb-row${x.id === loadedId ? ' is-loaded' : ''}" data-rb-id="${htmlSafe(x.id)}"><td>${href ? `<a class="rb-row-name" href="${href}">${htmlSafe(x.name)}</a>` : `<span class="rb-row-name">${htmlSafe(x.name)}</span>`}${x.lib ? '' : '<span class="basalt-status basalt-status-primary rb-new">New</span>'}<span class="rb-row-what-inline">${htmlSafe(whatText(x.settings))}</span></td><td class="rb-cell-what">${htmlSafe(whatText(x.settings))}</td><td class="rb-cell-when">${htmlSafe(dayShort(x.updated))}</td><td><span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-rb-load="${htmlSafe(x.id)}" aria-label="Load into the builder: ${htmlSafe(x.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Load into the builder"><i class="bi bi-sliders" aria-hidden="true"></i></button>${href ? `<a class="btn btn-icon btn-sm" href="${href}" aria-label="Open full page: ${htmlSafe(x.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>` : '<span class="btn btn-icon btn-sm rb-noicon" aria-hidden="true"><i class="bi bi-arrows-angle-expand"></i></span>'}</span></td></tr>`;
			})
			.join('');
		if (window.Basalt.tips) window.Basalt.tips(el.saved);
	}
	function markLoaded() {
		for (const tr of pickAll('tr[data-rb-id]', el.saved)) {
			tr.classList.toggle('is-loaded', tr.dataset.rbId === loadedId);
		}
	}

	function load(id) {
		const x = mine.concat(library()).find((y) => y.id === id);
		if (!x) return;
		const s = Object.assign({}, DEFAULTS, x.settings);
		Object.assign(state, s);

		for (const k of ['measure', 'split', 'period', 'plan', 'region', 'channel']) {
			el.fields[k].value = s[k];
			el.fields[k].dispatchEvent(new Event('change', { bubbles: true }));
		}

		if (window.Basalt.datepicker) {
			window.Basalt.datepicker.set(el.from, `${s.from}-01`);
			window.Basalt.datepicker.set(el.to, `${s.to}-01`);
		}
		loadedId = id;
		syncControls();
		render(true);
		markLoaded();
		pick('#rb-setup-title', root).scrollIntoView({
			behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
			block: 'start',
		});
		toast({ tone: 'info', icon: 'bi-sliders', title: 'Loaded into the builder', text: x.name });
	}

	/* A row opens the report's full page, like its name; a report saved
     here has no page yet, so its row loads it into the builder. */
	start();
})();
