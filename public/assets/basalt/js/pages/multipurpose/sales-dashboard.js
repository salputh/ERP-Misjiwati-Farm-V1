/**
 * Basalt - Sales dashboard (sales-dashboard.html)
 * Every chart on the page is drawn from DATA below:
 *   goal  a half ring: how much of October's target is sold
 *   today sales so far today, hour by hour
 *   week  sales each day this week; today is the paler bar
 *   pace  sales each day of the month, or each month of the year,
 *         against the target and the same period before (Month / Year
 *         switch); the open day or month is the paler bar
 *   mix   a ring with its list beside it: October so far, split by
 *         plan or region (the switch picks which)
 * Export downloads every figure on the page as a CSV file. AI
 * suggestions are worked out from DATA and the purchases table.
 *
 * The demo is set on Friday, October 9, 2026 at 10:40, the same moment
 * as the rest of the demo. Amounts are in thousands of dollars and reconcile
 * with the figures in the first row: today $17.6k (last Friday had
 * $16.0k by 10:40), this week (Mon 5 to Fri 9) $178.9k against $165.1k
 * for the same days and hours last week, October so far $286.6k of the
 * $980k target, and each split of the ring adds up to that same
 * $286.6k. Add-ons are Travel Planner, Customer Portal, SMS credit packs
 * and onboarding and training sessions billed in October, before tax.
 * To use your own figures, fill DATA from your API in the same shape.
 * Charts are drawn again on basalt:appearance, so they follow the
 * palette and dark mode.
 */
(() => {
	'use strict';
	const root = pick('[data-sl-root]');
	if (!root || typeof window.Chart === 'undefined') return;

	const DAYS = Array.from({ length: 31 }, (_, i) => `Oct ${i + 1}`);
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	const DATA = {
		goal: { sold: 286.6, target: 980 },
		/* Running total at each hour from 7:00 am, and now. */
		today: {
			labels: ['7:00 am', '8:00 am', '9:00 am', '10:00 am', '10:40 am'],
			values: [0, 2.6, 8.3, 14.2, 17.6],
		},
		week: {
			labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
			values: [39.4, 41.3, 40.2, 40.4, 17.6],
			open: 4,
		},
		pace: {
			month: {
				title: 'October, day by day',
				desc: 'Sales each day, against the daily target and September.',
				aria: 'October sales each day, against the daily target and September',
				labels: DAYS,
				actualName: 'October',
				beforeName: 'September',
				/* Oct 1-9; the 9th is today, still open, so its bar is paler. */
				actual: [36.8, 34.2, 19.6, 17.1, 39.4, 41.3, 40.2, 40.4, 17.6],
				open: 8,
				/* The $980k target spread evenly over 31 days. */
				target: DAYS.map(() => 31.6),
				/* September, $941k over 30 days. */
				before: [
					35.7, 33.7, 32.7, 35.3, 19.0, 17.6, 33.8, 36.4, 35.8, 33.6, 35.1, 19.7, 18.7, 34.0, 36.6, 37.6,
					35.1, 35.0, 20.0, 19.8, 35.1, 36.3, 38.8, 37.2, 35.4, 20.0, 20.7, 36.8, 36.3, 39.2,
				],
			},
			year: {
				title: '2026, month by month',
				desc: 'Sales each month, against the monthly target and 2025.',
				aria: '2026 sales each month, against the monthly target and 2025',
				labels: MONTHS,
				actualName: '2026',
				beforeName: '2025',
				/* January to September; October so far ($286.6k) is the open bar. */
				actual: [712, 728, 751, 774, 796, 818, 846, 872, 941, 286.6],
				open: 9,
				target: [700, 715, 735, 755, 780, 805, 830, 860, 925, 980, 1010, 1040],
				before: [548, 556, 572, 590, 604, 622, 640, 660, 712, 738, 752, 786],
			},
		},
		mix: {
			line: {
				name: 'plan',
				items: [
					['Pro plans', 88.3],
					['Max plans', 107.8],
					['Basic plans', 48.3],
					['Add-ons', 42.2],
				],
			},
			region: {
				name: 'region',
				items: [
					['Northeast', 174.6],
					['Midwest', 67.5],
					['West', 30.8],
					['South', 13.7],
				],
			},
		},
	};

	const state = { period: 'month', split: 'line' };
	const charts = {};
	const FONT = "'Schibsted Grotesk', sans-serif";

	function start() {
		for (const input of pickAll('[data-sl-period]', root)) {
			input.addEventListener('change', () => {
				if (!input.checked) return;
				state.period = input.value;
				paintPace();
				drawPace(true);
			});
		}

		for (const input of pickAll('[data-sl-split]', root)) {
			input.addEventListener('change', () => {
				if (!input.checked) return;
				state.split = input.value;
				drawMix(true);
			});
		}

		pick('[data-sl-export]', root).addEventListener('click', downloadCsv);
		pick('[data-sl-chart="mix"]', root).addEventListener('mouseleave', () => mixCenter());

		const checkedPeriod = pick('[data-sl-period]:checked', root);
		const checkedSplit = pick('[data-sl-split]:checked', root);
		if (checkedPeriod) state.period = checkedPeriod.value;
		if (checkedSplit) state.split = checkedSplit.value;
		paintPace();
		drawGoal(true);
		drawToday(true);
		drawWeek(true);
		drawPace(true);
		drawMix(true);
		wireIdeas();

		document.addEventListener('basalt:appearance', () =>
			requestAnimationFrame(() => {
				drawGoal(false);
				drawToday(false);
				drawWeek(false);
				drawPace(false);
				drawMix(false);
			}),
		);
	}

	/* Theme */
	function token(name, fallback) {
		return window.Basalt.token(name, fallback);
	}

	function mix(a, b, weight) {
		return `color-mix(in srgb, ${a} ${Math.round(weight * 100)}%, ${b})`;
	}
	/* Canvas can't parse color-mix(), so resolve it through a probe element. */
	const probe = document.createElement('span');
	probe.hidden = true;
	root.appendChild(probe);
	function resolve(color) {
		probe.style.color = color;
		return getComputedStyle(probe).color;
	}
	function theme() {
		const text = token('--basalt-copy', '#191430');
		const surface = token('--basalt-plane', '#ffffff');
		return {
			text,
			surface,
			quiet: resolve(mix(token('--basalt-copy-muted', '#6e6790'), text, 0.72)),
			grid: resolve(mix(text, 'transparent', 0.07)),
			border: token('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			/* The page keeps to the palette's violets: slots 1, 2, 4 and 7, then
			   the deep primary. */
			series: [
				...[1, 2, 4, 7].map((i) => token(`--basalt-series-${i}`, '#6d3fe0')),
				token('--basalt-hue-deep', '#4e23b8'),
			],
			/* Each small picture keeps a color of its own, matching its tile's icon. */
			today: token('--basalt-series-7', '#9c5ce8'),
			week: token('--basalt-series-1', '#6d3fe0'),
			before: token('--basalt-series-4', '#b8a9f0'),
		};
	}
	/* The color itself at opacity a. Fading toward plain transparent would
	   pass through gray on a canvas, so the color keeps its own red, green
	   and blue all the way down to zero. */
	function alpha(color, a) {
		const channels = resolve(color).match(/rgba?\(([^)]+)\)/);
		if (!channels) return resolve(mix(color, 'transparent', a));
		const [red, green, blue] = channels[1].split(',').map((part) => part.trim());
		return `rgba(${red}, ${green}, ${blue}, ${a})`;
	}

	/* Formatting */
	function money(k) {
		if (k >= 1000) return `$${(k / 1000).toFixed(2)}M`;
		return `$${k.toFixed(1)}k`;
	}

	function tooltip(t) {
		return {
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
		};
	}

	/* Pace chart */
	function drawPace(animate) {
		const canvas = pick('[data-sl-chart="pace"]', root);
		const t = theme();
		const d = DATA.pace[state.period];
		const actualColor = t.series[0];
		const targetColor = t.quiet;
		const beforeColor = alpha(t.before, 0.8);
		const tick = { color: t.quiet, font: { family: FONT, size: 11.5 }, padding: 8 };
		if (charts.pace) charts.pace.destroy();
		charts.pace = new Chart(canvas, {
			type: 'line',
			data: {
				labels: d.labels,
				datasets: [
					{
						type: 'bar',
						label: d.actualName,
						data: d.actual,
						backgroundColor: d.actual.map((_, i) => (i === d.open ? alpha(actualColor, 0.4) : actualColor)),
						hoverBackgroundColor: actualColor,
						borderRadius: 4,
						borderSkipped: 'start',
						maxBarThickness: 28,
						categoryPercentage: 0.72,
						order: 3,
					},
					{
						label: 'Target',
						data: d.target,
						borderColor: targetColor,
						pointBackgroundColor: targetColor,
						borderWidth: 2,
						borderDash: [6, 5],
						fill: false,
						tension: 0,
						order: 1,
					},
					{
						label: d.beforeName,
						data: d.before,
						borderColor: beforeColor,
						pointBackgroundColor: beforeColor,
						borderWidth: 2,
						fill: false,
						order: 2,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: animate ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				layout: { padding: { top: 6, right: 6 } },
				elements: {
					line: { tension: 0.3, borderJoinStyle: 'round' },
					point: { radius: 0, hoverRadius: 5, hoverBorderWidth: 2, hoverBorderColor: t.surface },
				},
				plugins: {
					legend: { display: false },
					tooltip: Object.assign(tooltip(t), {
						callbacks: {
							label: (c) =>
								` ${c.dataset.label}${c.datasetIndex === 0 && c.dataIndex === d.open ? ' so far' : ''}: ${money(c.parsed.y)}`,
						},
					}),
				},
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: Object.assign({ maxRotation: 0, autoSkip: true, autoSkipPadding: 16 }, tick),
					},
					y: {
						beginAtZero: true,
						grid: { color: t.grid },
						border: { display: false },
						ticks: Object.assign(
							{ maxTicksLimit: 6, callback: (v) => (v >= 1000 ? `$${v / 1000}M` : `$${v}k`) },
							tick,
						),
					},
				},
			},
		});
	}

	function paintPace() {
		const d = DATA.pace[state.period];
		function set(sel, text) {
			pick(sel, root).textContent = text;
		}
		set('[data-sl-pace-title]', d.title);
		set('[data-sl-pace-desc]', d.desc);
		set('[data-sl-key="actual"]', d.actualName);
		set('[data-sl-key="before"]', d.beforeName);
		pick('[data-sl-chart="pace"]', root).setAttribute('aria-label', d.aria);
	}

	/* October target: a half ring */
	/* The gray track is painted whole underneath, so on load the band sweeps
	   left to right across it while the figures in the middle count up with
	   it. The band's ends come from its final geometry, which does not move
	   while it fills. */
	function drawGoal(animate) {
		const canvas = pick('[data-sl-chart="goal"]', root);
		const t = theme();
		const g = DATA.goal;
		const pct = pick('.sl-goal-pct', root);
		const of = pick('.sl-goal-of', root);
		const full = g.sold / g.target;
		const soldFill = window.Basalt.chartFill(
			[
				[0, t.series[0]],
				[1, t.series[1]],
			],
			{ across: true },
		);
		if (charts.goal) charts.goal.destroy();
		charts.goal = new Chart(canvas, {
			type: 'doughnut',
			data: {
				datasets: [
					{
						data: [g.sold, g.target - g.sold],
						/* The sold part runs from the first chart color into the second. */
						backgroundColor: (c) => (c.dataIndex === 1 ? 'transparent' : soldFill(c)),
						borderWidth: 0,
						borderRadius: (c) => (c.dataIndex === 0 ? 10 : 0),
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				rotation: -90,
				circumference: 180,
				cutout: '78%',
				events: [],
				animation: animate ? { duration: 500, easing: 'easeOutCubic', animateRotate: true } : false,
				plugins: { legend: { display: false }, tooltip: { enabled: false } },
			},
			plugins: [
				{
					id: 'slGoalTrack',
					beforeDatasetsDraw(chart) {
						const band = chart.getDatasetMeta(0).data[0];
						if (!band) return;
						const { x, y, innerRadius, outerRadius } = band.getProps(
							['x', 'y', 'innerRadius', 'outerRadius'],
							true,
						);
						const ctx = chart.ctx;
						ctx.save();
						ctx.fillStyle = alpha(t.text, 0.08);
						ctx.beginPath();
						ctx.arc(x, y, outerRadius, Math.PI, Math.PI * 2);
						ctx.arc(x, y, innerRadius, Math.PI * 2, Math.PI, true);
						ctx.closePath();
						ctx.fill();
						ctx.restore();
					},
					/* The figures follow the band: the share of the half ring it covers now. */
					afterDraw(chart) {
						const band = chart.getDatasetMeta(0).data[0];
						if (!band || !pct) return;
						const { startAngle, endAngle } = band.getProps(['startAngle', 'endAngle']);
						const share = Math.min(full, Math.max(0, (endAngle - startAngle) / Math.PI));
						pct.textContent = `${Math.round(share * 100)}%`;
						if (of) of.textContent = `${money(g.target * share)} of ${money(g.target).replace('.0k', 'k')}`;
					},
				},
			],
		});
		/* The card is still being laid out when the gauge is first built, and
		   the resize that follows skips the animation; start the sweep again
		   once it has its size. */
		if (animate) {
			requestAnimationFrame(() => {
				charts.goal.reset();
				charts.goal.update();
			});
		}
	}

	/* Today and this week: two small pictures */
	function drawToday(animate) {
		const canvas = pick('[data-sl-chart="today"]', root);
		const t = theme();
		const d = DATA.today;
		const color = t.today;
		const light = alpha(t.today, 0.45);
		if (charts.today) charts.today.destroy();
		charts.today = new Chart(canvas, {
			type: 'line',
			data: {
				labels: d.labels,
				datasets: [
					{
						label: 'Today',
						data: d.values,
						/* The line deepens from a pale tone of its color into the full
						   color as the day climbs; the fill under it fades from top to
						   bottom, down to a faint tint at the card's edge. With gradients
						   off both are plain. */
						borderColor: window.Basalt.chartFill(
							[
								[0, light],
								[1, color],
							],
							{ flat: color, across: true },
						),
						borderWidth: 2.5,
						tension: 0.35,
						fill: true,
						backgroundColor: window.Basalt.chartFill(
							[
								[0, alpha(color, 0.26)],
								[0.6, alpha(light, 0.14)],
								[1, alpha(color, 0.06)],
							],
							{ flat: alpha(color, 0.12) },
						),
						pointRadius: (c) => (c.dataIndex === d.values.length - 1 ? 4.5 : 0),
						pointBackgroundColor: color,
						pointBorderColor: alpha(color, 0.22),
						pointBorderWidth: 6,
						pointHoverRadius: 4,
					},
				],
			},
			options: sparkOptions(t, animate, (c) => ` By ${c.label}: ${money(c.parsed.y)}`),
		});
	}

	function drawWeek(animate) {
		const canvas = pick('[data-sl-chart="week"]', root);
		const t = theme();
		const d = DATA.week;
		if (charts.week) charts.week.destroy();
		charts.week = new Chart(canvas, {
			type: 'bar',
			data: {
				labels: d.labels,
				datasets: [
					{
						label: 'This week',
						data: d.values,
						backgroundColor: d.values.map((_, i) => (i === d.open ? alpha(t.week, 0.4) : t.week)),
						hoverBackgroundColor: t.week,
						borderRadius: 5,
						borderSkipped: 'start',
						categoryPercentage: 0.7,
						barPercentage: 0.9,
					},
				],
			},
			options: sparkOptions(
				t,
				animate,
				(c) => ` ${c.label}${c.dataIndex === d.open ? ' so far' : ''}: ${money(c.parsed.y)}`,
			),
		});
	}

	function sparkOptions(t, animate, label) {
		return {
			responsive: true,
			maintainAspectRatio: false,
			animation: animate ? { duration: 500, easing: 'easeOutQuart' } : false,
			interaction: { mode: 'index', intersect: false },
			layout: { autoPadding: false, padding: { top: 6, right: 0, bottom: 0, left: 0 } },
			plugins: {
				legend: { display: false },
				tooltip: Object.assign(tooltip(t), { displayColors: false, callbacks: { label } }),
			},
			scales: {
				x: { display: false },
				y: { display: false, beginAtZero: true },
			},
		};
	}

	/* Ring + list */
	function drawMix(animate) {
		const canvas = pick('[data-sl-chart="mix"]', root);
		const t = theme();
		const d = DATA.mix[state.split];
		const colors = d.items.map((_, i) => t.series[i % t.series.length]);
		if (charts.mix) charts.mix.destroy();
		charts.mix = new Chart(canvas, {
			type: 'doughnut',
			data: {
				labels: d.items.map((x) => x[0]),
				datasets: [
					{
						data: d.items.map((x) => x[1]),
						backgroundColor: colors,
						hoverBackgroundColor: colors,
						borderColor: t.surface,
						hoverBorderColor: t.surface,
						borderWidth: 3,
						hoverOffset: 6,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				cutout: '74%',
				layout: { padding: 6 },
				animation: animate ? { duration: 500, easing: 'easeOutQuart' } : false,
				onHover: (event, slices) => mixCenter(slices[0]?.index),
				plugins: {
					legend: { display: false },
					tooltip: { enabled: false },
				},
			},
		});
		canvas.setAttribute('aria-label', `October sales by ${d.name}`);
		mixCenter();

		const total = d.items.reduce((sum, x) => sum + x[1], 0);
		const list = pick('[data-sl-mix-list]', root);
		list.replaceChildren(
			...d.items.map((x, i) => {
				const li = document.createElement('li');
				li.className = 'sl-mix-item';
				li.style.setProperty('--sl-swatch', colors[i]);
				li.innerHTML = `<span class="sl-mix-swatch" aria-hidden="true"></span><span class="sl-mix-name"></span><span class="sl-mix-value"></span><span class="sl-mix-share"></span>`;
				pick('.sl-mix-name', li).textContent = x[0];
				pick('.sl-mix-value', li).textContent = money(x[1]);
				pick('.sl-mix-share', li).textContent = `${Math.round((x[1] / total) * 100)}%`;
				return li;
			}),
		);
	}

	/* The ring's middle names the slice under the pointer, and goes back to
	   October's total once the pointer leaves the ring. */
	function mixCenter(index) {
		const items = DATA.mix[state.split].items;
		const total = items.reduce((sum, x) => sum + x[1], 0);
		const item = items[index];
		pick('.sl-mix-total', root).textContent = money(item ? item[1] : total);
		pick('.sl-mix-caption', root).textContent = item
			? `${item[0]} · ${Math.round((item[1] / total) * 100)}%`
			: 'October so far';
	}

	/* Export */
	function downloadCsv() {
		const rows = [['Section', 'Item', 'Amount ($k)']];
		rows.push(['October target', 'Sold so far', DATA.goal.sold]);
		rows.push(['October target', 'Target', DATA.goal.target]);
		DATA.today.labels.forEach((label, i) => rows.push(['Today', `By ${label}`, DATA.today.values[i]]));
		DATA.week.labels.forEach((label, i) =>
			rows.push(['This week', label + (i === DATA.week.open ? ' so far' : ''), DATA.week.values[i]]),
		);

		for (const key of ['month', 'year']) {
			const d = DATA.pace[key];
			d.labels.forEach((label, i) => {
				if (d.actual[i] != null)
					rows.push([d.title, `${label}, ${d.actualName}${i === d.open ? ' so far' : ''}`, d.actual[i]]);
				rows.push([d.title, `${label}, target`, d.target[i]]);
			});
		}

		for (const key of Object.keys(DATA.mix)) {
			DATA.mix[key].items.forEach((x) => rows.push([`October so far by ${DATA.mix[key].name}`, x[0], x[1]]));
		}

		const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
		const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = 'sales-2026-10-08.csv';
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
		if (window.Basalt.toasts) {
			window.Basalt.toasts.push({
				tone: 'success',
				icon: 'bi-download',
				title: 'Sales exported',
				text: 'sales-2026-10-08.csv is in your downloads.',
			});
		}
	}

	/* AI suggestions: worked out from DATA and the purchases table,
	   problems first. Each links to the page where it is done; Dismiss
	   brings in the next. Nothing is stored. */
	function suggestions() {
		const ideas = [];
		const unpaid = purchaseRows().find((row) => row.status === 'Awaiting payment');
		if (unpaid) {
			ideas.push({
				id: 'unpaid',
				kind: 'problem',
				icon: 'bi-receipt',
				title: `Chase ${unpaid.account}'s ${unpaid.total}`,
				why: `${unpaid.id} still awaits payment.`,
				href: 'invoices.html',
				go: 'Invoices',
			});
		}
		const month = DATA.pace.month;
		const weekend = [];
		const weekday = [];
		month.actual.forEach((amount, i) => {
			if (i === month.open) return;
			const day = new Date(2026, 9, i + 1).getDay();
			(day === 0 || day === 6 ? weekend : weekday).push(amount);
		});
		const perWeekend = average(weekend);
		const perWeekday = average(weekday);
		if (weekend.length && perWeekend < perWeekday * 0.6) {
			ideas.push({
				id: 'weekend',
				kind: 'problem',
				icon: 'bi-calendar-week',
				title: 'Weekends sell half as much',
				why: `${money(perWeekend)} a day, weekdays ${money(perWeekday)}.`,
				href: 'sales-insights.html',
				go: 'Analytics',
			});
		}
		const year = DATA.pace.year;
		const closed = year.open - 1;
		const growth = Math.round((year.actual[closed] / year.before[closed] - 1) * 100);
		if (growth > 0) {
			ideas.push({
				id: 'year',
				kind: 'win',
				icon: 'bi-graph-up-arrow',
				title: `${new Date(2026, closed).toLocaleString('en-US', { month: 'long' })} beat ${year.beforeName} by ${growth}%`,
				why: `$${Math.round(year.actual[closed])}k against $${Math.round(year.before[closed])}k last year.`,
				href: 'revenue-insights.html',
				go: 'Revenue',
			});
		}
		const plans = DATA.mix.line.items;
		const total = plans.reduce((sum, item) => sum + item[1], 0);
		const [leader, leads] = [...plans].sort((left, right) => right[1] - left[1])[0];
		ideas.push({
			id: 'plan',
			kind: 'win',
			icon: 'bi-gem',
			title: `${leader} lead October`,
			why: `${money(leads)}, ${Math.round((leads / total) * 100)}% of sales so far.`,
			href: 'subscription-plans.html',
			go: 'Plans',
		});
		const goal = DATA.goal;
		const ahead = goal.sold - (goal.target / DAYS.length) * (month.open + 1);
		if (ahead > 0) {
			const left = DAYS.length - month.open - 1;
			ideas.push({
				id: 'pace',
				kind: 'win',
				icon: 'bi-bullseye',
				title: 'Ahead of October pace',
				why: `${money(ahead)} ahead; ${money((goal.target - goal.sold) / left)} a day hits ${money(goal.target).replace('.0k', 'k')}.`,
				href: 'deal-pipeline.html',
				go: 'Pipeline',
			});
		}
		const week = DATA.week;
		const full = week.values.filter((_, i) => i !== week.open);
		ideas.push({
			id: 'week',
			kind: 'win',
			icon: 'bi-calendar-check',
			title: `${money(average(week.values) * week.values.length)} sold this week`,
			why: `${money(average(full))} a day, ${week.labels[0]} to ${week.labels[full.length - 1]}.`,
			href: 'sales-insights.html',
			go: 'Analytics',
		});
		return [...ideas.filter((idea) => idea.kind === 'problem'), ...ideas.filter((idea) => idea.kind !== 'problem')];
	}

	function average(list) {
		return list.reduce((sum, amount) => sum + amount, 0) / (list.length || 1);
	}

	/** The Latest purchases table as plain values: number, account, total and status. */
	function purchaseRows() {
		return [...pickAll('.sl-orders tbody tr', root)].map((row) => ({
			id: pick('.sl-orders-id', row)?.textContent.trim(),
			account: pick('.sl-orders-name', row)?.textContent.trim(),
			total: pick('.sl-orders-total', row)?.textContent.trim(),
			status: pick('.sl-orders-status', row)?.textContent.trim(),
		}));
	}

	function htmlSafe(value) {
		const holder = document.createElement('span');
		holder.textContent = value;
		return holder.innerHTML;
	}

	function wireIdeas() {
		const list = pick('[data-sl-ideas]', root);
		const wait = pick('[data-sl-thinking]', root);
		if (!list) return;
		const queue = suggestions();
		const shown = queue.splice(0, 4);
		const draw = () => {
			list.innerHTML = shown
				.map(
					(idea, at) =>
						`<li class="basalt-idea${idea.kind === 'problem' ? ' is-problem' : ''}" style="--i: ${at}" data-idea="${idea.id}"><span class="basalt-idea-icon" aria-hidden="true"><i class="bi ${idea.icon}"></i></span><p class="basalt-idea-title">${htmlSafe(idea.title)}</p><p class="basalt-idea-why"><span class="basalt-idea-kind">${idea.kind === 'problem' ? 'Problem' : 'Working'}</span>${htmlSafe(idea.why)}</p><span class="basalt-idea-actions"><a href="${idea.href}" class="btn btn-outline-secondary btn-sm">${idea.go}</a><button type="button" class="btn btn-sm sl-idea-drop" data-sl-drop aria-label="Dismiss" title="Dismiss"><i class="bi bi-x-lg" aria-hidden="true"></i></button></span></li>`,
				)
				.join('');
			if (!shown.length) list.innerHTML = `<li class="sl-ideas-done">Nothing else for now.</li>`;
		};
		setTimeout(
			() => {
				wait.hidden = true;
				list.hidden = false;
				draw();
			},
			window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 200 : 500,
		);
		list.addEventListener('click', (event) => {
			const row = event.target.closest('[data-idea]');
			if (!row || !event.target.closest('[data-sl-drop]')) return;
			shown.splice(
				shown.findIndex((idea) => idea.id === row.dataset.idea),
				1,
			);
			if (queue.length) shown.push(queue.shift());
			draw();
		});
	}

	/* Wiring */
	start();

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
