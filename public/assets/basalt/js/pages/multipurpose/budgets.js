/**
 * Basalt - Budgets
 * One list of yearly budgets drives the year card, the
 * spending line, the budget tiles and the drawer, so every
 * number on the page agrees. The budgets and the clock
 * come from assets/basalt/js/data/multipurpose/budgets.js, shared with Budget
 * Details; fill that file from your backend.
 */
(() => {
	'use strict';
	const page = pick('[data-bgt-root]');
	if (!page) return;

	function start() {
		drawYear();
		/* Spent and forecast count up from zero once, as the page opens. */
		window.Basalt.countUp?.(pickAll('.bgt-year-value', page));
		drawTiles();
		buildTrend(true);
		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() => {
				buildTrend(false);
				if (monthsChart) buildMonths();
			});
		});
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function htmlSafe(v) {
		return String(v).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function money(n) {
		return `$${Math.round(n).toLocaleString('en-US')}`;
	}

	function short(n) {
		return n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : money(n);
	}

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/* The shared budget record
	   assets/basalt/js/data/multipurpose/budgets.js holds the clock, the owners and every
	   budget, so Budget Details shows the same figures. */
	const D = window.Basalt.data.budgets;
	const TODAY = D.today;
	const YEAR = D.year;
	const MONTH = D.month;
	const PACE = D.pace;
	const MONTH_PART = D.monthPart;
	const PEOPLE = D.people;
	const BUDGETS = D.budgets;
	const TRANSACTIONS = D.transactions;
	const STATUS = D.statuses;
	const figures = D.figures;

	function stateTag(s) {
		return `<span class="basalt-status basalt-status-${STATUS[s].tone}">${STATUS[s].label}</span>`;
	}

	function toneVar(b) {
		return `var(--basalt-series-${b.tone})`;
	}

	function css(name, fallback) {
		return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
	}

	function parse(c) {
		const s = String(c || '').trim();
		let m = /^#([0-9a-f]{6})$/i.exec(s);
		if (m) {
			const n = parseInt(m[1], 16);
			return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
		}
		m = /^#([0-9a-f]{3})$/i.exec(s);
		if (m) return m[1].split('').map((h) => parseInt(h + h, 16));
		m = /^rgba?\(([^)]+)\)$/i.exec(s);
		if (m)
			return m[1]
				.split(',')
				.slice(0, 3)
				.map((v) => parseFloat(v));
		return [128, 128, 128];
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

	const FONT = "'Schibsted Grotesk', sans-serif";

	function chartLook() {
		const text = css('--basalt-copy', '#12233a');
		return {
			text,
			quiet: mix(css('--basalt-copy-muted', '#5f7186'), text, 0.82),
			grid: tint(text, 0.07),
			surface: css('--basalt-plane', '#ffffff'),
			border: css('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
		};
	}
	function tooltip(look, callbacks) {
		return {
			backgroundColor: look.surface,
			titleColor: look.text,
			bodyColor: look.text,
			footerColor: look.text,
			borderColor: look.border,
			borderWidth: 1,
			padding: 10,
			cornerRadius: 8,
			boxPadding: 4,
			usePointStyle: true,
			titleFont: { family: FONT, size: 12, weight: '600' },
			bodyFont: { family: FONT, size: 12 },
			callbacks,
		};
	}

	/* The year so far */
	function totals() {
		return BUDGETS.reduce(
			(t, b) => {
				const f = figures(b);
				t.amount += b.amount;
				t.spent += f.spent;
				t.forecast += f.forecast;
				return t;
			},
			{ amount: 0, spent: 0, forecast: 0 },
		);
	}

	function openButton(b) {
		return `<button type="button" class="bgt-link" data-bgt-open="${b.key}">${htmlSafe(b.name)}</button>`;
	}

	function listWords(items) {
		return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
	}

	function drawYear() {
		const t = totals();
		const gap = t.amount - t.forecast;
		const over = BUDGETS.filter((b) => figures(b).status === 'over');
		const status = pick('[data-bgt-year-status]', page);
		status.className = `basalt-status basalt-status-${gap < 0 ? 'danger' : 'success'}`;
		status.textContent = gap < 0 ? 'Over budget' : 'Under budget';
		pick('[data-bgt-year-title]', page).textContent =
			gap < 0 ? `On course to go ${money(-gap)} over` : `On course to finish ${money(gap)} under`;
		pick('[data-bgt-year-lede]', page).innerHTML =
			`${Math.round(PACE * 100)}% of the year has gone. ${over.length ? `${listWords(over.map(openButton)) + (over.length === 1 ? ' is' : ' are')} on course to go over.` : 'Every budget is on course.'}`;
		pick('[data-bgt-fig="spent"]', page).textContent = short(t.spent);
		pick('[data-bgt-fig="spent-note"]', page).textContent =
			`${Math.round((t.spent / t.amount) * 100)}% of ${short(t.amount)}`;
		pick('[data-bgt-fig="forecast"]', page).textContent = short(t.forecast);
		pick('[data-bgt-trend]', page).setAttribute(
			'aria-label',
			`Line chart of spending added up through ${YEAR} against an even pace to the budget. ${short(t.spent)} spent by ${TODAY.toLocaleDateString('en-US', { month: 'long' })} ${TODAY.getDate()} against ${short(t.amount)} for the year; the forecast ends the year at ${short(t.forecast)}.`,
		);
	}

	/* Spending through the year
	   A linear month axis: 0 is January 1 and 12 is December 31, so today
	   sits part-way through its month. */
	const trendCanvas = pick('[data-bgt-trend]', page);
	let trend = null;

	function trendSeries() {
		const spentPoints = [{ x: 0, y: 0 }];
		let run = 0;
		for (let m = 0; m < MONTH; m++) {
			run += BUDGETS.reduce((s, b) => s + (b.months[m] || 0), 0);
			spentPoints.push({ x: m + 1, y: run });
		}
		run += BUDGETS.reduce((s, b) => s + b.now, 0);
		const now = { x: MONTH + MONTH_PART, y: run };
		spentPoints.push(now);
		const pace = BUDGETS.reduce((s, b) => s + figures(b).pace, 0);
		const forecastPoints = [now];
		let ahead = run + pace * (1 - MONTH_PART);
		for (let m = MONTH + 1; m <= 12; m++) {
			forecastPoints.push({ x: m, y: ahead });
			ahead += pace;
		}
		const amount = BUDGETS.reduce((s, b) => s + b.amount, 0);
		return {
			spentPoints,
			forecastPoints,
			planPoints: [
				{ x: 0, y: 0 },
				{ x: 12, y: amount },
			],
			amount,
		};
	}

	function pointName(x) {
		if (x === 0) return `Start of ${YEAR}`;
		if (Number.isInteger(x))
			return `End of ${new Date(YEAR, x - 1, 1).toLocaleDateString('en-US', { month: 'long' })}`;
		return `${TODAY.toLocaleDateString('en-US', { month: 'long' })} ${TODAY.getDate()}, today`;
	}

	function buildTrend(animate) {
		if (typeof Chart === 'undefined' || !trendCanvas) return;
		if (trend) trend.destroy();
		const look = chartLook();
		const spent = css('--basalt-series-1', '#2b6fd4');
		const plan = css('--basalt-series-3', '#1fc6a8');
		const s = trendSeries();
		const step = s.amount > 2000000 ? 1000000 : 500000;
		const tick = { color: look.quiet, font: { family: FONT, size: 11.5 }, padding: 6 };
		trend = new Chart(trendCanvas, {
			type: 'line',
			data: {
				datasets: [
					{
						label: 'Spent',
						data: s.spentPoints,
						borderColor: spent,
						backgroundColor: tint(spent, 0.14),
						fill: 'origin',
						borderWidth: 2.5,
						tension: 0.25,
						pointRadius: (c) => (c.dataIndex === s.spentPoints.length - 1 ? 4 : 0),
						pointBackgroundColor: spent,
						pointHoverRadius: 5,
					},
					{
						label: 'Forecast',
						data: s.forecastPoints,
						borderColor: spent,
						borderDash: [6, 5],
						borderWidth: 2,
						tension: 0.25,
						pointRadius: 0,
						pointHoverRadius: 5,
						fill: false,
					},
					{
						label: 'Budget',
						data: s.planPoints,
						borderColor: plan,
						borderWidth: 2,
						pointRadius: 0,
						pointHoverRadius: 0,
						fill: false,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: animate && !reduce.matches ? { duration: 500, easing: 'easeOutQuart' } : false,
				animations: { x: false },
				interaction: { mode: 'nearest', intersect: false, axis: 'x' },
				plugins: {
					legend: { display: false },
					tooltip: Object.assign(
						tooltip(look, {
							title: (items) => pointName(items[0].parsed.x),
							label: (c) => ` ${c.dataset.label}: ${money(c.parsed.y)}`,
						}),
						{ filter: (item) => item.dataset.label !== 'Budget' },
					),
				},
				scales: {
					x: {
						type: 'linear',
						min: 0,
						max: 12,
						grid: { display: false },
						border: { display: false },
						ticks: Object.assign(
							{
								stepSize: 1,
								autoSkip: true,
								autoSkipPadding: 12,
								maxRotation: 0,
								callback: (v) => MONTHS[v] || '',
							},
							tick,
						),
					},
					y: {
						beginAtZero: true,
						max: Math.ceil(s.amount / step) * step,
						grid: { color: look.grid },
						border: { display: false },
						ticks: Object.assign(
							{ stepSize: step, callback: (v) => (v === 0 ? '$0' : `$${v / 1000000}M`) },
							tick,
						),
					},
				},
			},
		});
	}

	/* Every budget
	   One tile each, closest to going over first. The small bars are each
	   month's spending; the dashed line is the monthly budget. */
	const tiles = pick('[data-bgt-tiles]', page);
	let firstDraw = true;

	function gapNote(f) {
		if (f.gap < 0) return `${money(-f.gap)} over`;
		return `${money(f.gap)} to spare`;
	}

	function spark(b) {
		const values = b.months.concat([b.now]);
		const monthly = b.amount / 12;
		const top = Math.max(monthly, Math.max(...values)) * 1.08;
		return `<div class="bgt-spark" data-bgt-spark="${b.key}" aria-hidden="true" style="--bgt-limit: ${((monthly / top) * 100).toFixed(1)}%">${values.map((v, i) => `<span class="bgt-spark-bar${i === values.length - 1 ? ' is-now' : ''}" data-bgt-bar="${i}" style="--bgt-h: ${Math.max(2, (v / top) * 100).toFixed(1)}%"></span>`).join('')}</div><div class="bgt-spark-axis" aria-hidden="true"><span>${MONTHS[0]}</span><span class="bgt-spark-read"></span><span>${MONTHS[values.length - 1]}</span></div>`;
	}

	/* Pointing at a month's bar reads it out under the bars: what was spent,
	   and how far it sits from the monthly budget (the dashed line). The open
	   month is read as "so far". */
	function readBar(bar) {
		const spark = bar.closest('[data-bgt-spark]');
		const b = BUDGETS.find((x) => x.key === spark.dataset.bgtSpark);
		if (!b) return;
		const i = Number(bar.dataset.bgtBar);
		const values = b.months.concat([b.now]);
		const monthly = b.amount / 12;
		const open = i === values.length - 1;
		const diff = values[i] - monthly;
		const note = open ? 'so far' : diff > 0 ? `${money(diff)} over` : `${money(-diff)} under`;
		for (const other of pickAll('.bgt-spark-bar.is-lit', tiles)) other.classList.remove('is-lit');
		bar.classList.add('is-lit');
		spark.classList.add('is-reading');
		const read = pick('.bgt-spark-read', spark.parentElement);
		read.textContent = `${MONTHS[i]} ${money(values[i])}, ${note}`;
		read.classList.toggle('is-over', !open && diff > 0);
	}

	function clearBar(spark) {
		spark.classList.remove('is-reading');
		for (const bar of pickAll('.is-lit', spark)) bar.classList.remove('is-lit');
		pick('.bgt-spark-read', spark.parentElement).textContent = '';
	}

	/* The whole height of the strip counts, so a short month is as easy to
	   point at as a tall one. */
	tiles.addEventListener('pointermove', (e) => {
		const spark = e.target.closest('[data-bgt-spark]');
		if (!spark) return;
		const bars = pickAll('[data-bgt-bar]', spark);
		const box = spark.getBoundingClientRect();
		const at = Math.min(
			bars.length - 1,
			Math.max(0, Math.floor(((e.clientX - box.left) / box.width) * bars.length)),
		);
		if (!bars[at].classList.contains('is-lit')) readBar(bars[at]);
	});
	tiles.addEventListener('pointerout', (e) => {
		const spark = e.target.closest('[data-bgt-spark]');
		if (spark && !spark.contains(e.relatedTarget)) clearBar(spark);
	});

	/* A budget made on this page lives only in memory, so it has a quick
     view but no full page yet. */
	function fullHref(b) {
		return b.draft ? '' : `budget-details.html?id=${encodeURIComponent(b.key)}`;
	}

	function tile(b, f) {
		const used = Math.min(100, f.used * 100);
		const href = fullHref(b);
		return `<article class="card basalt-box bgt-tile" data-bgt-tile="${b.key}" style="--bgt-tone: ${toneVar(b)}"><div class="bgt-tile-top"><span class="bgt-tile-icon" aria-hidden="true"><i class="bi bi-${b.icon}"></i></span>${stateTag(f.status)}<span class="basalt-row-actions bgt-tile-actions"><button type="button" class="btn btn-icon btn-sm" data-bgt-open="${b.key}" aria-label="Quick view: ${htmlSafe(b.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>${href ? `<a class="btn btn-icon btn-sm" href="${href}" aria-label="Open full page: ${htmlSafe(b.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>` : ''}</span></div><h3 class="bgt-tile-name">${href ? `<a class="bgt-tile-open" href="${href}">${htmlSafe(b.name)}</a>` : htmlSafe(b.name)}</h3><p class="bgt-tile-owner">${htmlSafe(PEOPLE[b.owner].name)}</p><p class="bgt-tile-spent"><span class="bgt-tile-amount">${money(f.spent)}</span> <span class="bgt-tile-of">of ${money(b.amount)}</span></p><div class="bgt-used"><div class="bgt-meter" aria-hidden="true"><span class="bgt-meter-fill" data-bgt-used="${used.toFixed(1)}%"${firstDraw && !reduce.matches ? '' : ` style="--bgt-used: ${used.toFixed(1)}%"`}></span><span class="bgt-meter-pace"></span></div><span class="bgt-used-pct">${Math.round(f.used * 100)}%</span></div>${spark(b)}<p class="bgt-tile-foot"><span class="bgt-tile-fc">${money(f.forecast)} forecast</span><span class="bgt-tile-gap${f.gap < 0 ? ' is-over' : ''}">${gapNote(f)}</span></p></article>`;
	}

	/* An even number of tiles keeps every row level, so the payroll note
     fills the last cell when the budgets come to an odd number. */
	const NOTE = `<div class="card basalt-box bgt-tile bgt-tile-note"><span class="bgt-tile-icon" aria-hidden="true"><i class="bi bi-people"></i></span><h3 class="bgt-tile-name">Payroll is not a budget</h3><p class="bgt-tile-owner">Salaries and taxes are committed costs, so they are run and tracked on their own page.</p><a class="btn btn-outline-secondary btn-sm" href="payroll.html">Open Payroll</a></div>`;

	function drawTiles() {
		const list = BUDGETS.map((b) => ({ b, f: figures(b) })).sort(
			(x, y) => y.f.forecast / y.b.amount - x.f.forecast / x.b.amount,
		);
		tiles.innerHTML = list.map((r) => tile(r.b, r.f)).join('') + (list.length % 2 ? NOTE : '');
		if (window.Basalt.tips) window.Basalt.tips(tiles);
		if (firstDraw && !reduce.matches) {
			requestAnimationFrame(() =>
				requestAnimationFrame(() => {
					for (const el of pickAll('[data-bgt-used]', tiles)) {
						el.style.setProperty('--bgt-used', el.dataset.bgtUsed);
					}
				}),
			);
		}
		firstDraw = false;
	}

	page.style.setProperty('--bgt-pace', `${(PACE * 100).toFixed(1)}%`);
	pick('[data-bgt-pace-note]', page).textContent = `${Math.round(PACE * 100)}% of the way through the year.`;

	/* Budget drawer */
	const drawer = document.getElementById('bgt-drawer');

	function d(name) {
		return pick(`[data-bgt-d="${name}"]`, drawer);
	}

	let current = null;
	let monthsChart = null;
	let breakdown = 'quarter';

	function lead(b, f) {
		if (!f.spent)
			return `Nothing spent yet. All <strong>${money(b.amount)}</strong> is there for the rest of the year.`;
		const start = `<strong>${money(f.spent)}</strong> of ${money(b.amount)} used (${Math.round(f.used * 100)}%), with ${Math.round(PACE * 100)}% of the year gone. At the last three months’ pace it ends the year `;
		if (f.status === 'over') return `${start}<strong>${money(-f.gap)} over</strong>.`;
		if (f.status === 'near') return `${start}with only <strong>${money(f.gap)} to spare</strong>.`;
		return `${start}with <strong>${money(f.gap)} to spare</strong>.`;
	}

	function drawRank() {
		const b = current;
		const list = d('rank');
		if (breakdown === 'quarter') {
			const quarter = b.amount / 4;
			const all = b.months.concat([b.now]);
			const rows = [];
			for (let q = 0; q * 3 < all.length; q++) {
				const spent = all.slice(q * 3, q * 3 + 3).reduce((s, v) => s + v, 0);
				const running = q * 3 + 2 >= MONTH;
				const today = `${MONTHS[MONTH]} ${TODAY.getDate()}`;
				const span = !running
					? `${MONTHS[q * 3]} to ${MONTHS[q * 3 + 2]}`
					: q * 3 === MONTH
						? `1 to ${today}`
						: `${MONTHS[q * 3]} to ${today}`;
				rows.push(
					`<li class="bgt-rank-item${spent > quarter ? ' is-over' : ''}"><span class="bgt-rank-name">Q${q + 1}${running ? ' so far' : ''}, ${span}</span><span class="bgt-rank-value">${money(spent)} <span class="bgt-rank-of">of ${money(quarter)}</span></span><span class="bgt-rank-bar" aria-hidden="true"><span style="--bgt-w: ${Math.min(100, (spent / quarter) * 100).toFixed(1)}%"></span></span>${spent > quarter ? `<span class="bgt-rank-note">${money(spent - quarter)} over the quarter’s budget</span>` : ''}</li>`,
				);
			}
			list.innerHTML = rows.join('');
			return;
		}
		const f = figures(b);
		if (!b.costs.length) {
			list.innerHTML =
				'<li class="bgt-rank-item"><span class="bgt-rank-note">Nothing spent against this budget yet.</span></li>';
			return;
		}
		const named = b.costs.reduce((s, c) => s + c[1], 0);
		const rows = b.costs.concat([['Everything else', f.spent - named]]);
		const top = Math.max(...rows.map((c) => c[1]));
		list.innerHTML = rows
			.map(
				(c) =>
					`<li class="bgt-rank-item"><span class="bgt-rank-name">${htmlSafe(c[0])}</span><span class="bgt-rank-value">${money(c[1])}</span><span class="bgt-rank-bar" aria-hidden="true"><span style="--bgt-w: ${((c[1] / top) * 100).toFixed(1)}%"></span></span></li>`,
			)
			.join('');
	}

	function buildMonths() {
		if (typeof Chart === 'undefined' || !current) return;
		if (monthsChart) monthsChart.destroy();
		const b = current;
		const look = chartLook();
		const tone = css(`--basalt-series-${b.tone}`, '#2b6fd4');
		const values = b.months.concat([b.now]);
		const labels = MONTHS.slice(0, values.length);
		const monthly = b.amount / 12;
		const tick = { color: look.quiet, font: { family: FONT, size: 11 }, padding: 4 };
		monthsChart = new Chart(d('chart'), {
			data: {
				labels,
				datasets: [
					{
						type: 'bar',
						label: 'Spent',
						data: values,
						backgroundColor: values.map((_, i) => (i === values.length - 1 ? tint(tone, 0.45) : tone)),
						borderRadius: 4,
						borderSkipped: false,
						maxBarThickness: 22,
						order: 2,
					},
					{
						type: 'line',
						label: 'Monthly budget',
						data: labels.map(() => monthly),
						borderColor: mix(look.quiet, look.surface, 0.7),
						borderDash: [4, 4],
						borderWidth: 1.5,
						pointRadius: 0,
						pointHoverRadius: 0,
						order: 1,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: reduce.matches ? false : { duration: 500, easing: 'easeOutQuart' },
				interaction: { mode: 'index', intersect: false },
				plugins: {
					legend: { display: false },
					tooltip: tooltip(look, {
						title: (items) =>
							items[0].label +
							(items[0].dataIndex === values.length - 1 ? `, 1 to ${TODAY.getDate()}` : ''),
						label: (c) => ` ${c.dataset.label}: ${money(c.parsed.y)}`,
					}),
				},
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: Object.assign({ maxRotation: 0, autoSkip: false }, tick),
					},
					y: {
						beginAtZero: true,
						grid: { color: look.grid },
						border: { display: false },
						ticks: Object.assign(
							{ maxTicksLimit: 4, callback: (v) => (v === 0 ? '$0' : `$${Math.round(v / 1000)}k`) },
							tick,
						),
					},
				},
			},
		});
		d('chart').setAttribute(
			'aria-label',
			`Bar chart of ${b.name} spending each month of ${YEAR} against its monthly budget of ${money(monthly)}.`,
		);
	}

	function showSheet(key) {
		current = BUDGETS.find((b) => b.key === key);
		if (!current) return;
		const b = current;
		const f = figures(b);
		const who = PEOPLE[b.owner];
		drawer.style.setProperty('--bgt-tone', toneVar(b));
		d('name').textContent = b.name;
		d('full').hidden = !fullHref(b);
		d('full').setAttribute('href', fullHref(b) || 'budget-details.html');
		d('owner').innerHTML =
			`Owner: <a href="employee-details.html">${htmlSafe(who.name)}</a>, ${htmlSafe(who.title)}`;
		d('status').innerHTML = stateTag(f.status);
		d('lead').innerHTML = lead(b, f);
		d('link').setAttribute('href', b.link.href);
		d('link').textContent = b.link.label;
		drawRank();
		bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
	}

	drawer.addEventListener('shown.bs.offcanvas', buildMonths);
	drawer.addEventListener('hidden.bs.offcanvas', () => {
		if (monthsChart) {
			monthsChart.destroy();
			monthsChart = null;
		}
	});

	for (const r of pickAll('input[name="bgt-break"]', drawer)) {
		r.addEventListener('change', () => {
			if (!r.checked) return;
			breakdown = r.value;
			drawRank();
		});
	}

	/* A tile opens the budget's full page, like its name does (Cmd/Ctrl or
     middle click: a new tab). The quick-view icon and the names in the
     year card open the drawer, and so does a tile for a budget made here,
     which has no full page yet. */
	function onTileClick(e) {
		const btn = e.target.closest('[data-bgt-open]');
		if (btn) {
			if (e.detail > 0) btn.blur();
			showSheet(btn.dataset.bgtOpen);
			return;
		}
		const card = e.target.closest('[data-bgt-tile]');
		if (!card || e.target.closest('a, button')) return;
		const link = pick('.bgt-tile-open', card);
		if (!link) {
			if (e.button === 0) showSheet(card.dataset.bgtTile);
			return;
		}
		if (e.metaKey || e.ctrlKey || e.button === 1) window.open(link.href, '_blank', 'noopener');
		else location.href = link.href;
	}
	page.addEventListener('click', onTileClick);
	page.addEventListener('auxclick', (e) => {
		if (e.button === 1 && !e.target.closest('button')) onTileClick(e);
	});

	/* New and edit budget */
	const dialog = document.getElementById('bgt-dialog');
	const form = pick('[data-bgt-form]', dialog);

	function f(name) {
		return pick(`[data-bgt-f="${name}"]`, dialog);
	}

	let editing = null;

	f('owner').innerHTML = Object.keys(PEOPLE)
		.map((id) => `<option value="${id}">${htmlSafe(PEOPLE[id].name)}</option>`)
		.join('');

	function amountOf() {
		return parseInt(String(f('amount').value).replace(/[^0-9]/g, ''), 10) || 0;
	}

	function hint() {
		const a = amountOf();
		f('hint').textContent = a
			? `Split evenly, that is ${money(a / 12)} a month.`
			: 'Split evenly across the twelve months.';
	}
	function refreshSelects() {
		if (window.Basalt.select && window.Basalt.select.refresh) {
			window.Basalt.select.refresh(f('owner'));
			window.Basalt.select.refresh(f('alert'));
		}
	}

	function openDialog(b) {
		editing = b || null;
		form.reset();

		for (const el of pickAll('.is-invalid', form)) {
			el.classList.remove('is-invalid');
		}

		f('title').textContent = b ? 'Edit budget' : 'New budget';
		f('sub').textContent = b
			? `Changes cover all of ${YEAR}. Past spending stays.`
			: 'A yearly limit, split evenly by month.';
		f('save').textContent = b ? 'Save changes' : 'Create budget';
		f('name').value = b ? b.name : '';
		f('amount').value = b ? b.amount.toLocaleString('en-US') : '';
		f('owner').value = b ? b.owner : 'rd';
		f('alert').value = b ? b.alert : 'forecast';
		refreshSelects();
		hint();
		bootstrap.Modal.getOrCreateInstance(dialog).show();
	}

	f('amount').addEventListener('input', () => {
		f('amount').classList.remove('is-invalid');
		hint();
	});
	f('amount').addEventListener('blur', () => {
		const a = amountOf();
		if (a) f('amount').value = a.toLocaleString('en-US');
	});
	f('name').addEventListener('input', () => f('name').classList.remove('is-invalid'));
	dialog.addEventListener('shown.bs.modal', () => f('name').focus());

	form.addEventListener('submit', (e) => {
		e.preventDefault();
		const name = f('name').value.trim();
		const amount = amountOf();
		f('name').classList.toggle('is-invalid', !name);
		f('amount').classList.toggle('is-invalid', !amount);
		const bad = pick('.is-invalid', form);
		if (bad) {
			bad.focus();
			return;
		}

		if (editing) {
			Object.assign(editing, { name, amount, owner: f('owner').value, alert: f('alert').value });
			toast({
				tone: 'success',
				title: `${name} saved`,
				text: `${money(amount)} for ${YEAR}, owned by ${PEOPLE[editing.owner].name}.`,
			});
		} else {
			BUDGETS.push({
				key: `b${Date.now()}`,
				name,
				icon: 'wallet2',
				tone: (BUDGETS.length % 8) + 1,
				owner: f('owner').value,
				amount,
				alert: f('alert').value,
				months: BUDGETS[0].months.map(() => 0),
				now: 0,
				costs: [],
				recent: [],
				history: [],
				link: TRANSACTIONS,
				draft: true,
			});
			toast({
				tone: 'success',
				title: `${name} budget created`,
				text: `${money(amount)} for ${YEAR}. ${PEOPLE[f('owner').value].name} is the owner.`,
			});
		}
		bootstrap.Modal.getInstance(dialog).hide();
		redraw();
	});

	pick('[data-bgt-new]', page).addEventListener('click', () => openDialog(null));
	pick('[data-bgt-edit]', drawer).addEventListener('click', () => {
		const b = current;
		drawer.addEventListener('hidden.bs.offcanvas', () => openDialog(b), { once: true });
		bootstrap.Offcanvas.getInstance(drawer).hide();
	});

	/* Export */
	pick('[data-bgt-export]', page).addEventListener('click', () => {
		toast({
			tone: 'success',
			title: 'Budgets exported',
			text: `All ${BUDGETS.length} budgets, with spending month by month, were saved as a CSV to your downloads.`,
		});
	});

	/* Draw */
	function redraw() {
		drawYear();
		drawTiles();
		buildTrend(false);
	}

	start();
})();
