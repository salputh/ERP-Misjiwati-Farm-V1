/**
 * Basalt - Finance dashboard
 * One monthly ledger drives the profit and loss ring and
 * list and the revenue and costs chart, so they always
 * agree. The cash line reads month-end bank balances.
 * Unpaid invoices send a reminder, and AI suggestions
 * are worked out from the same figures. In a real deployment,
 * replace LEDGER and CASH with figures from your
 * accounting system and bank feed.
 */
(() => {
	'use strict';
	const page = pick('[data-fin-root]');
	if (!page) return;

	function start() {
		wireIdeas();

		/* Export */
		pick('[data-fin-export]').addEventListener('click', () => {
			toast({
				tone: 'success',
				title: 'Finance summary exported',
				text: 'September’s figures were saved as a PDF to your downloads.',
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

	function money(n) {
		return (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
	}

	function share(part, whole) {
		return `${Math.round((part / whole) * 100)}%`;
	}

	/* Ledger
	   October 2025 to September 2026, in dollars. Revenue is
	   subscriptions, add-ons such as SMS packs, and onboarding
	   services; costs are everything spent, tax included. */
	const MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
	const LEDGER = {
		subscriptions: [721500, 734800, 748200, 760100, 772900, 785400, 799000, 811600, 826300, 842700, 858900, 876200],
		addons: [71200, 88400, 102600, 64300, 70800, 79500, 85100, 92700, 81400, 84200, 89600, 98600],
		services: [31600, 29800, 24100, 33500, 35200, 36800, 38400, 37900, 39200, 41300, 43200, 43600],
		cogs: [192000, 201400, 205900, 196200, 201800, 207300, 212600, 217000, 219800, 226500, 230100, 236900],
		eng: [268000, 271500, 274200, 282900, 286400, 289100, 293800, 297200, 301500, 305800, 303400, 312400],
		sm: [162400, 170100, 158300, 171600, 175200, 178900, 181400, 184700, 186000, 190200, 192500, 198700],
		ga: [78100, 79400, 80200, 80900, 81600, 82300, 83000, 83800, 84500, 84900, 85100, 86300],
		tax: [26000, 27400, 32800, 26500, 28100, 30300, 31900, 33500, 32600, 33800, 37900, 38700],
	};
	const COSTS = ['cogs', 'eng', 'sm', 'ga', 'tax'];

	function at(key, i) {
		return LEDGER[key][i];
	}

	function revenueOf(i) {
		return at('subscriptions', i) + at('addons', i) + at('services', i);
	}

	function costsOf(i) {
		return COSTS.reduce((t, k) => t + at(k, i), 0);
	}

	/* Cash in the three bank accounts at each month end, then this
     morning. Today's figure matches the Transactions page. */
	const CASH = [
		3214900, 3358600, 3571400, 3402800, 3516300, 3688900, 3804100, 3972600, 4061200, 4238500, 4462700, 4354295,
		4822100,
	];

	/* Chart helpers */
	const FONT = "'Schibsted Grotesk', sans-serif";

	function token(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	function parse(c) {
		const s = String(c || '').trim();
		let m = /^#([0-9a-f]{6})$/i.exec(s);
		if (m) {
			const n = parseInt(m[1], 16);
			return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
		}
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

	function mix(a, b, part) {
		const x = parse(a);
		const y = parse(b);

		function ch(i) {
			return Math.round(x[i] * part + y[i] * (1 - part));
		}

		return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
	}

	function short(v) {
		return v === 0 ? '$0' : `$${v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${Math.round(v / 1000)}k`}`;
	}

	function series(n) {
		return token(`--basalt-series-${n}`, '#2b6fd4');
	}

	function look() {
		const text = token('--basalt-copy', '#12233a');
		return {
			text,
			grid: tint(text, 0.07),
			tick: {
				color: mix(token('--basalt-copy-muted', '#5f7186'), text, 0.82),
				font: { family: FONT, size: 11.5 },
				padding: 6,
			},
			tooltip: {
				backgroundColor: token('--basalt-plane', '#ffffff'),
				titleColor: text,
				bodyColor: text,
				footerColor: text,
				borderColor: token('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
				borderWidth: 1,
				padding: 10,
				cornerRadius: 8,
				boxPadding: 4,
				usePointStyle: true,
				titleFont: { family: FONT, size: 12, weight: '600' },
				bodyFont: { family: FONT, size: 12 },
				footerFont: { family: FONT, size: 12, weight: '600' },
			},
		};
	}

	function motion(animate) {
		return animate && !reduce.matches ? { duration: 500, easing: 'easeOutQuart' } : false;
	}

	/* Cash in bank */
	const cashCanvas = pick('[data-fin-cash]', page);
	let cashChart = null;
	function buildCash(animate) {
		if (cashChart) cashChart.destroy();
		const L = look();
		const tone = series(1);

		/* The wash runs from the top of the plot to its floor, so every month
		   gets some color under the line; one even tint with gradients off. */
		const fill = window.Basalt.chartFill(
			[
				[0, tint(tone, 0.3)],
				[1, tint(tone, 0.04)],
			],
			{ flat: tint(tone, 0.14) },
		);

		cashChart = new Chart(cashCanvas, {
			type: 'line',
			data: {
				labels: MONTHS.concat('Today'),
				datasets: [
					{
						label: 'Cash in bank',
						data: CASH.slice(),
						borderColor: tone,
						backgroundColor: fill,
						fill: true,
						borderWidth: 2.5,
						tension: 0.35,
						pointRadius: CASH.map((_, i) => (i === CASH.length - 1 ? 4.5 : 0)),
						pointBackgroundColor: tone,
						pointBorderColor: token('--basalt-plane', '#ffffff'),
						pointBorderWidth: 2,
						pointHoverRadius: 5,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: motion(animate),
				interaction: { mode: 'index', intersect: false },
				plugins: {
					legend: { display: false },
					tooltip: Object.assign({}, L.tooltip, {
						callbacks: {
							title: (items) =>
								items[0].dataIndex === CASH.length - 1
									? 'Today, Oct 9, 2026'
									: `End of ${items[0].label} ${items[0].dataIndex < 3 ? '2025' : '2026'}`,
							label: (c) => ` ${money(c.parsed.y)}`,
						},
					}),
				},
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: Object.assign({ maxRotation: 0, autoSkipPadding: 10 }, L.tick),
					},
					y: {
						min: 3000000,
						max: 5000000,
						grid: { color: L.grid },
						border: { display: false },
						ticks: Object.assign({ stepSize: 500000, callback: short }, L.tick),
					},
				},
			},
		});
	}

	/* Profit and loss
	   Each period is a run of months in the ledger. The ring shows
	   where the revenue went, net profit last. */
	const PERIODS = {
		month: { from: 11, to: 12, words: 'September 2026, closed on October 6.' },
		quarter: { from: 9, to: 12, words: 'July to September 2026.' },
		year: { from: 3, to: 12, words: 'January to September 2026.' },
	};
	const SLICES = [
		['cogs', 1],
		['eng', 4],
		['sm', 2],
		['ga', 7],
		['tax', 8],
		['net', 3],
	];
	const ringCanvas = pick('[data-fin-ring]', page);
	ringCanvas.addEventListener('mouseleave', () => ringCenter());
	const table = pick('[data-fin-pl-table]', page);
	let ringChart = null;
	let period = 'month';

	function statement(key) {
		const p = PERIODS[key];
		function sum(fn) {
			let t = 0;
			for (let i = p.from; i < p.to; i++) t += fn(i);
			return t;
		}
		const s = { revenue: sum(revenueOf) };

		for (const k of COSTS) {
			s[k] = sum((i) => at(k, i));
		}

		s.net = s.revenue - COSTS.reduce((t, k) => t + s[k], 0);
		return s;
	}

	/* The ring's middle names the slice under the pointer, and goes back to
	   the net profit once the pointer leaves. */
	function ringCenter(index) {
		const [label, value, note] = [...pick('.fin-ring-center', ringCanvas.parentElement).children];
		ringCenter.resting ??= [label.textContent, value.textContent, note.textContent];
		const s = statement(period);
		const slice = SLICES[index];
		if (!slice) {
			const net = statement(period).net;
			[label.textContent, value.textContent, note.textContent] = [
				ringCenter.resting[0],
				money(net),
				`${share(net, s.revenue)} of revenue`,
			];
			return;
		}
		label.textContent = ringChart.data.labels[index];
		value.textContent = money(s[slice[0]]);
		note.textContent = `${share(s[slice[0]], s.revenue)} of revenue`;
	}

	function makeRing(animate) {
		if (ringChart) ringChart.destroy();
		const s = statement(period);
		ringChart = new Chart(ringCanvas, {
			type: 'doughnut',
			data: {
				labels: SLICES.map(([k]) =>
					pick('th', pick(`[data-fin-pl="${k}"]`, table).closest('tr'))
						.textContent.replace(/\s+/g, ' ')
						.trim(),
				),
				datasets: [
					{
						data: SLICES.map(([k]) => s[k]),
						backgroundColor: SLICES.map(([, n]) => series(n)),
						borderColor: token('--basalt-plane', '#ffffff'),
						borderWidth: 2,
						hoverOffset: 4,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				cutout: '74%',
				layout: { padding: 6 },
				animation:
					animate && !reduce.matches ? { duration: 500, easing: 'easeOutQuart', animateRotate: true } : false,
				onHover: (event, slices) => ringCenter(slices[0]?.index),
				plugins: {
					legend: { display: false },
					tooltip: { enabled: false },
				},
			},
		});
	}

	function drawStatement(key) {
		period = key;
		const s = statement(key);
		pick('[data-fin-pl="revenue"]', table).textContent = money(s.revenue);

		for (const k of COSTS) {
			pick(`[data-fin-pl="${k}"]`, table).textContent = money(-s[k]);
			pick(`[data-fin-share="${k}"]`, table).textContent = share(s[k], s.revenue);
		}

		for (const el of pickAll('[data-fin-pl="net"]', page)) {
			el.textContent = money(s.net);
		}

		pick('[data-fin-share="net"]', table).textContent = share(s.net, s.revenue);
		pick('[data-fin-pl="net-margin"]', page).textContent = `${((s.net / s.revenue) * 100).toFixed(1)}% of revenue`;
		pick('[data-fin-pl-desc]', page).textContent = PERIODS[key].words;
		if (ringChart) {
			ringChart.data.datasets[0].data = SLICES.map(([k]) => s[k]);
			ringChart.update(reduce.matches ? 'none' : undefined);
		}
		if (!reduce.matches) {
			table.classList.remove('is-changing');
			void table.offsetWidth;
			table.classList.add('is-changing');
		}
	}

	for (const r of pickAll('input[name="fin-period"]', page)) {
		r.addEventListener('change', () => {
			if (r.checked) drawStatement(r.value);
		});
	}

	table.addEventListener('animationend', () => table.classList.remove('is-changing'));

	/* Revenue and costs */
	const trendCanvas = pick('[data-fin-chart]', page);
	let trendChart = null;
	function buildTrend(animate) {
		if (trendChart) trendChart.destroy();
		const L = look();
		/* A round top a little above the highest month, so the axis doesn't
       jump to the next half million. */
		const top = Math.ceil(Math.max(...MONTHS.map((_, i) => revenueOf(i))) / 300000) * 300000;
		const bar = {
			borderRadius: 4,
			borderSkipped: false,
			maxBarThickness: 18,
			categoryPercentage: 0.62,
			barPercentage: 0.9,
		};
		trendChart = new Chart(trendCanvas, {
			type: 'bar',
			data: {
				labels: MONTHS.slice(),
				datasets: [
					Object.assign(
						{ label: 'Revenue', data: MONTHS.map((_, i) => revenueOf(i)), backgroundColor: series(1) },
						bar,
					),
					Object.assign(
						{ label: 'Costs', data: MONTHS.map((_, i) => costsOf(i)), backgroundColor: series(7) },
						bar,
					),
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: motion(animate),
				interaction: { mode: 'index', intersect: false },
				plugins: {
					legend: { display: false },
					tooltip: Object.assign({}, L.tooltip, {
						callbacks: {
							title: (items) => `${items[0].label} ${items[0].dataIndex < 3 ? '2025' : '2026'}`,
							label: (c) => ` ${c.dataset.label}: ${money(c.parsed.y)}`,
							footer: (items) =>
								`Profit: ${money(revenueOf(items[0].dataIndex) - costsOf(items[0].dataIndex))}`,
						},
					}),
				},
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: Object.assign({ maxRotation: 0, autoSkipPadding: 10 }, L.tick),
					},
					y: {
						beginAtZero: true,
						max: top,
						grid: { color: L.grid },
						border: { display: false },
						ticks: Object.assign({ stepSize: 300000, callback: short }, L.tick),
					},
				},
			},
		});
	}

	/* Each chart draws when it first scrolls into view, and again
     without motion when the theme or palette changes. */
	const charts = [
		[cashCanvas, buildCash],
		[ringCanvas, makeRing],
		[trendCanvas, buildTrend],
	];
	const built = new Set();
	if (typeof Chart !== 'undefined') {
		if ('IntersectionObserver' in window) {
			const io = new IntersectionObserver(
				(entries) => {
					entries.forEach((e) => {
						if (!e.isIntersecting) return;
						io.unobserve(e.target);
						const entry = charts.find(([c]) => c === e.target);
						entry[1](true);
						built.add(entry[0]);
					});
				},
				{ rootMargin: '80px 0px' },
			);

			for (const [c] of charts) {
				io.observe(c);
			}
		} else
			for (const [c, build] of charts) {
				build(false);
				built.add(c);
			}
		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() =>
				charts.forEach(([c, build]) => {
					if (built.has(c)) build(false);
				}),
			);
		});
	}

	/* Unpaid invoices */
	for (const btn of pickAll('[data-fin-remind]', page)) {
		btn.addEventListener('click', () => {
			if (btn.classList.contains('is-sent')) return;
			btn.classList.add('is-sent');
			btn.setAttribute('aria-disabled', 'true');
			btn.textContent = 'Reminded';
			toast({
				tone: 'success',
				title: `Reminder sent to ${btn.dataset.finRemind}`,
				text: 'They’ll get the invoice again with a link to pay online.',
			});
		});
	}

	/* AI suggestions
	   Worked out from LEDGER, CASH and the invoice and bank lists on
	   the page, problems first. Each links to the page where
	   it is done; Dismiss brings in the next. Nothing is stored. */
	function suggestions() {
		const ideas = [];
		const last = MONTHS.length - 1;
		const profit = revenueOf(last) - costsOf(last);
		const cashChange = CASH[last] - CASH[last - 1];
		if (cashChange < 0) {
			ideas.push({
				id: 'cash-dip',
				kind: 'problem',
				icon: 'bi-bank',
				title: 'Cash fell in September',
				why: `Down ${short(-cashChange)} despite ${short(profit)} profit.`,
				href: 'transactions.html',
				go: 'Bank',
			});
		}
		const late = pickAll('[aria-labelledby="fin-owed-title"] tbody tr', page).find((row) =>
			/late/.test(pick('.basalt-status', row)?.textContent),
		);
		if (late) {
			ideas.push({
				id: 'late',
				kind: 'problem',
				icon: 'bi-receipt',
				title: `Chase ${pick('.fin-table-name', late).textContent.trim()}`,
				why: `${pick('.fin-table-amount', late).textContent.trim().replace(/\.00$/, '')}, ${pick('.basalt-status', late).textContent.trim()}.`,
				href: 'invoices.html',
				go: 'Invoices',
			});
		}
		const loose = pickAll('.fin-moves-row', page).find((row) => pick('.fin-chip-none', row));
		if (loose) {
			ideas.push({
				id: 'loose',
				kind: 'problem',
				icon: 'bi-tag',
				title: `Categorize ${pick('.fin-moves-who', loose).textContent.trim()}`,
				why: `${pick('.fin-moves-amount', loose).textContent.trim()} on ${pick('.fin-moves-date', loose).textContent.trim()}, no category.`,
				href: 'transactions.html',
				go: 'Bank',
			});
		}
		const margin = profit / revenueOf(last);
		const yearRevenue = MONTHS.reduce((sum, _, i) => sum + revenueOf(i), 0);
		const yearMargin = MONTHS.reduce((sum, _, i) => sum + revenueOf(i) - costsOf(i), 0) / yearRevenue;
		if (margin > yearMargin) {
			ideas.push({
				id: 'margin',
				kind: 'win',
				icon: 'bi-graph-up-arrow',
				title: 'September margin beat the year',
				why: `${(margin * 100).toFixed(1)}% net, ${(yearMargin * 100).toFixed(1)}% over 12 months.`,
				href: 'finance-reports.html',
				go: 'Reports',
			});
		}
		const plans = LEDGER.subscriptions;
		ideas.push({
			id: 'plans',
			kind: 'win',
			icon: 'bi-arrow-repeat',
			title: `Subscriptions up ${Math.round((plans[last] / plans[0] - 1) * 100)}% in a year`,
			why: `${money(plans[last])} in ${MONTHS[last]}, ${money(plans[0])} in ${MONTHS[0]}.`,
			href: 'revenue-insights.html',
			go: 'Revenue',
		});
		ideas.push({
			id: 'cash',
			kind: 'win',
			icon: 'bi-bank',
			title: `Cash up ${short(CASH[CASH.length - 1] - CASH[0])} in a year`,
			why: `${money(CASH[CASH.length - 1])} in the bank this morning.`,
			href: 'transactions.html',
			go: 'Bank',
		});
		return [...ideas.filter((idea) => idea.kind === 'problem'), ...ideas.filter((idea) => idea.kind !== 'problem')];
	}

	function htmlSafe(value) {
		const holder = document.createElement('span');
		holder.textContent = value;
		return holder.innerHTML;
	}

	function wireIdeas() {
		const list = pick('[data-fin-ideas]', page);
		const wait = pick('[data-fin-thinking]', page);
		if (!list) return;
		const queue = suggestions();
		const shown = queue.splice(0, 4);
		const draw = () => {
			list.innerHTML = shown
				.map(
					(idea, at) =>
						`<li class="basalt-idea${idea.kind === 'problem' ? ' is-problem' : ''}" style="--i: ${at}" data-idea="${idea.id}"><span class="basalt-idea-icon" aria-hidden="true"><i class="bi ${idea.icon}"></i></span><p class="basalt-idea-title">${htmlSafe(idea.title)}</p><p class="basalt-idea-why"><span class="basalt-idea-kind">${idea.kind === 'problem' ? 'Problem' : 'Working'}</span>${htmlSafe(idea.why)}</p><span class="basalt-idea-actions"><a href="${idea.href}" class="btn btn-outline-secondary btn-sm">${idea.go}</a><button type="button" class="btn btn-sm fin-idea-drop" data-fin-drop aria-label="Dismiss" title="Dismiss"><i class="bi bi-x-lg" aria-hidden="true"></i></button></span></li>`,
				)
				.join('');
			if (!shown.length) list.innerHTML = `<li class="fin-ideas-done">Nothing else for now.</li>`;
		};
		setTimeout(
			() => {
				wait.hidden = true;
				list.hidden = false;
				draw();
			},
			reduce.matches ? 200 : 500,
		);
		list.addEventListener('click', (event) => {
			const row = event.target.closest('[data-idea]');
			if (!row || !event.target.closest('[data-fin-drop]')) return;
			shown.splice(
				shown.findIndex((idea) => idea.id === row.dataset.idea),
				1,
			);
			if (queue.length) shown.push(queue.shift());
			draw();
		});
	}

	start();
})();
