/**
 * Basalt - Investing (investing.html)
 * One portfolio of stocks, funds and crypto, drawn from BOOK below:
 *   by size    every holding as a block sized by its value
 *   candles    the last sixty trading days, with the largest holdings
 *   value      the portfolio's value each day for a year; the chart shows
 *              the stretch picked by the range switch or by the window on
 *              the strip under it, which can be dragged or stretched
 *   holdings   what is owned, searched, filtered by type and sorted, each
 *              with its last 30 days as a sparkline
 *   allocation a ring of the three types with its list
 *   watchlist  prices followed but not owned, with the year's range
 *
 * Prices are as of the close on Thursday, October 8, 2026. The daily
 * history is a smooth made-up walk that ends exactly on today's total, so
 * the chart, the holdings and the ring always agree. In your app, fill
 * BOOK from your broker or market data API in the same shape.
 */
(() => {
	'use strict';
	const root = pick('[data-pfo-root]', document);
	if (!root || typeof window.Chart === 'undefined') return;

	const TODAY = new Date(2026, 9, 8);
	/* The month the first money went in. */
	const STARTED = 'March 2023';
	const DAYS = 365;

	/* shares, price now, price a day ago, average cost per share. */
	const BOOK = {
		holdings: [
			{
				ticker: 'VTI',
				name: 'Total Stock Market ETF',
				type: 'fund',
				shares: 210,
				price: 312.8,
				prev: 310.95,
				cost: 248.4,
			},
			{ ticker: 'BTC', name: 'Bitcoin', type: 'crypto', shares: 0.62, price: 104250, prev: 102180, cost: 61400 },
			{ ticker: 'AAPL', name: 'Apple', type: 'stock', shares: 120, price: 241.3, prev: 243.05, cost: 176.2 },
			{
				ticker: 'VXUS',
				name: 'Total International ETF',
				type: 'fund',
				shares: 380,
				price: 68.1,
				prev: 67.84,
				cost: 58.9,
			},
			{ ticker: 'NVDA', name: 'Nvidia', type: 'stock', shares: 150, price: 172.4, prev: 168.9, cost: 94.5 },
			{ ticker: 'ETH', name: 'Ethereum', type: 'crypto', shares: 6.4, price: 3820, prev: 3755, cost: 2640 },
			{
				ticker: 'BND',
				name: 'Total Bond Market ETF',
				type: 'fund',
				shares: 300,
				price: 73.4,
				prev: 73.46,
				cost: 72.1,
			},
			{ ticker: 'MSFT', name: 'Microsoft', type: 'stock', shares: 45, price: 468.2, prev: 465.6, cost: 402.75 },
			{ ticker: 'COST', name: 'Costco', type: 'stock', shares: 18, price: 912.5, prev: 918.3, cost: 788 },
			{ ticker: 'SOL', name: 'Solana', type: 'crypto', shares: 85, price: 182, prev: 186.4, cost: 141 },
		],
		/* low and high: the past year's range. */
		watch: [
			{ ticker: 'AMZN', name: 'Amazon', type: 'stock', price: 226.4, prev: 222.1, low: 168.2, high: 242.5 },
			{ ticker: 'GOOGL', name: 'Alphabet', type: 'stock', price: 198.7, prev: 199.9, low: 146.1, high: 207.3 },
			{ ticker: 'TSLA', name: 'Tesla', type: 'stock', price: 284.6, prev: 271.3, low: 182.4, high: 402.1 },
			{ ticker: 'VOO', name: 'S&P 500 ETF', type: 'fund', price: 598.3, prev: 595.8, low: 491.6, high: 603.2 },
			{
				ticker: 'SCHD',
				name: 'US Dividend Equity ETF',
				type: 'fund',
				price: 28.9,
				prev: 28.95,
				low: 25.4,
				high: 29.7,
			},
			{ ticker: 'LINK', name: 'Chainlink', type: 'crypto', price: 21.8, prev: 22.9, low: 10.6, high: 29.4 },
			{ ticker: 'AVAX', name: 'Avalanche', type: 'crypto', price: 31.2, prev: 30.1, low: 17.9, high: 52.8 },
		],
	};

	const TYPES = {
		stock: { label: 'Stocks', tone: 1 },
		fund: { label: 'Funds', tone: 3 },
		crypto: { label: 'Crypto', tone: 5 },
	};

	const state = {
		seed: 11,
		from: DAYS - 182,
		to: DAYS - 1,
		sort: { key: 'value', up: false },
		alerts: new Set(['TSLA']),
	};

	let history = [];
	let labels = [];
	let mainChart = null;
	let overview = null;

	function start() {
		for (const h of BOOK.holdings) {
			h.value = h.shares * h.price;
			h.gain = h.shares * (h.price - h.cost);
			h.spark = walk(30, h.price, 0.018);
		}
		history = valueHistory();
		labels = history.map((_, i) => {
			const d = new Date(TODAY);
			d.setDate(d.getDate() - (DAYS - 1 - i));
			return d;
		});
		drawFigures();
		buildCharts();
		wireRange();
		wireBrush();
		drawTree();
		wireCandles();
		wireHoldings();
		drawMix();
		drawMovers();
		wireWatch();
		pick('[data-pfo-export]').addEventListener('click', exportCsv);
		document.addEventListener('basalt:appearance', () => {
			buildCharts();
		});
	}

	/* Helpers */
	function pick(selector, scope = root) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = root) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return String(value).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function money(n, cents = false) {
		return n.toLocaleString('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: cents ? 2 : 0,
			maximumFractionDigits: cents ? 2 : 0,
		});
	}

	function price(n) {
		return money(n, n < 1000);
	}

	function signed(n, fn) {
		return `${n >= 0 ? '+' : '−'}${fn(Math.abs(n))}`;
	}

	function pct(n) {
		return `${(n * 100).toFixed(2)}%`;
	}

	function day(d) {
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function token(name) {
		return getComputedStyle(root).getPropertyValue(name).trim();
	}

	function total() {
		return BOOK.holdings.reduce((s, h) => s + h.value, 0);
	}

	function random() {
		state.seed = (state.seed * 16807) % 2147483647;
		return (state.seed - 1) / 2147483646;
	}

	/** n points of a gentle random walk that ends exactly on `end`. */
	function walk(n, end, wobble) {
		const steps = [1];
		for (let i = 1; i < n; i++) steps.push(steps[i - 1] * (1 + (random() - 0.48) * wobble));
		const scale = end / steps[n - 1];
		return steps.map((v) => v * scale);
	}

	/* A year of daily values: a slow climb with a dip in the spring, ending on today's total. */
	function valueHistory() {
		const end = total();
		const raw = [];
		let v = 1;
		for (let i = 0; i < DAYS; i++) {
			const spring = i > 150 && i < 200 ? -0.0028 : 0;
			v *= 1 + 0.0011 + spring + (random() - 0.5) * 0.014;
			raw.push(v);
		}
		const scale = end / raw[DAYS - 1];
		return raw.map((x) => Math.round(x * scale * 100) / 100);
	}

	/* Headline figures */
	function drawFigures() {
		const now = total();
		const before = BOOK.holdings.reduce((s, h) => s + h.shares * h.prev, 0);
		const cost = BOOK.holdings.reduce((s, h) => s + h.shares * h.cost, 0);
		pick('[data-pfo-total]').textContent = money(now, true);
		const move = now - before;
		const today = pick('[data-pfo-today]');
		today.textContent = `${signed(move, (n) => money(n, true))} (${signed(move / before, pct)}) today`;
		today.classList.toggle('is-down', move < 0);
		pick('[data-pfo-fig="cost"]').textContent = money(cost);
		pick('[data-pfo-started]').textContent = STARTED;
		const gain = pick('[data-pfo-fig="gain"]');
		gain.textContent = `${signed(now - cost, money)} (${signed((now - cost) / cost, pct)})`;
		gain.classList.toggle('is-up', now >= cost);
		gain.classList.toggle('is-down', now < cost);
		drawRangeFigures();
	}

	function drawRangeFigures() {
		const a = history[state.from];
		const b = history[state.to];
		const range = pick('[data-pfo-fig="range"]');
		range.textContent = `${signed(b - a, money)} (${signed((b - a) / a, pct)})`;
		range.classList.toggle('is-down', b < a);
		range.classList.toggle('is-up', b >= a);
		pick('[data-pfo-span]').textContent = `${day(labels[state.from])} to ${day(labels[state.to])}`;
	}

	/* Charts: the main line, and the overview strip under it. */
	function buildCharts() {
		const line = token('--basalt-series-1');
		const grid = token('--basalt-edge');
		const quiet = token('--basalt-copy-muted');
		if (mainChart) mainChart.destroy();
		if (overview) overview.destroy();
		const canvas = pick('[data-pfo-chart]');
		mainChart = new window.Chart(canvas, {
			type: 'line',
			data: {
				labels: [],
				datasets: [
					{
						data: [],
						borderColor: line,
						borderWidth: 2,
						pointRadius: 0,
						pointHoverRadius: 4,
						tension: 0.25,
						fill: true,
						backgroundColor: fade(line),
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: { duration: 300 },
				interaction: { mode: 'index', intersect: false },
				scales: {
					x: { grid: { display: false }, ticks: { color: quiet, maxTicksLimit: 7, maxRotation: 0 } },
					y: {
						grid: { color: grid },
						border: { display: false },
						ticks: { color: quiet, maxTicksLimit: 5, callback: (v) => `$${Math.round(v / 1000)}k` },
					},
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						displayColors: false,
						callbacks: {
							title: (items) => day(labels[state.from + items[0].dataIndex]),
							label: (item) => money(item.parsed.y, true),
						},
					},
				},
			},
		});
		overview = new window.Chart(pick('[data-pfo-overview]'), {
			type: 'line',
			data: {
				labels: history.map((_, i) => i),
				datasets: [{ data: history, borderColor: quiet, borderWidth: 1, pointRadius: 0, tension: 0.25 }],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				events: [],
				scales: { x: { display: false }, y: { display: false } },
				plugins: { legend: { display: false }, tooltip: { enabled: false } },
			},
		});
		showRange();
	}

	/** A fill under the line that fades from the line's color to nothing; one light tint with gradients off. */
	function fade(color) {
		return window.Basalt.chartFill(
			[
				[0, hexAlpha(color, 0.22)],
				[1, hexAlpha(color, 0)],
			],
			{ flat: hexAlpha(color, 0.12) },
		);
	}

	/** A token color with an alpha, for chart fills. */
	function hexAlpha(color, alpha) {
		const probe = document.createElement('canvas').getContext('2d');
		probe.fillStyle = color;
		const hex = probe.fillStyle;
		if (!hex.startsWith('#')) return color;
		const n = parseInt(hex.slice(1), 16);
		return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
	}

	function showRange() {
		const slice = history.slice(state.from, state.to + 1);
		mainChart.data.labels = labels
			.slice(state.from, state.to + 1)
			.map((d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
		mainChart.data.datasets[0].data = slice;
		mainChart.update();
		const win = pick('[data-pfo-window]');
		win.style.setProperty('--pfo-from', `${(state.from / (DAYS - 1)) * 100}%`);
		win.style.setProperty('--pfo-to', `${(state.to / (DAYS - 1)) * 100}%`);
		drawRangeFigures();
	}

	/* Sixty trading days. The card shows the whole portfolio or one holding
     (picked with the chips), over a month or three of daily candles or six
     months of weekly ones. Pointing at, tapping or arrowing through the chart
     reads one candle at a time; each change grows the candles out of their
     open price once the page has settled. */
	const candle = {
		ticker: 'all',
		range: '3m',
		days: [],
		at: -1,
		ready: false,
		frame: 0,
		geometry: null,
	};
	const CANDLE_RANGES = {
		'1m': { title: 'One month, day by day', unit: 'day', count: 21, span: 'over the month' },
		'3m': { title: 'Sixty trading days', unit: 'day', count: 60, span: 'over 60 days' },
		'6m': { title: 'Six months, week by week', unit: 'week', count: 26, span: 'over 26 weeks' },
	};
	const calm = window.matchMedia('(prefers-reduced-motion: reduce)');

	function wireCandles() {
		drawChips();
		const svg = pick('[data-pfo-candles]');
		const plot = pick('.pfo-candle-plot');
		pick('[data-pfo-chips]').addEventListener('click', (event) => {
			const chip = event.target.closest('[data-pfo-chip]');
			if (chip) chooseHolding(chip.dataset.pfoChip);
		});
		pick('[data-pfo-chips]').addEventListener('keydown', moveChip);
		for (const input of pickAll('[data-pfo-candle-range]')) {
			input.addEventListener('change', () => {
				candle.range = input.value;
				showCandles();
			});
		}
		svg.addEventListener('pointermove', (event) => pointAt(event.clientX));
		svg.addEventListener('pointerdown', (event) => pointAt(event.clientX));
		plot.addEventListener('pointerleave', (event) => {
			if (event.pointerType === 'mouse') clearCandle();
		});
		svg.addEventListener('keydown', stepCandle);
		svg.addEventListener('blur', clearCandle);
		showCandles();
		window.Basalt.settled.then(() => {
			candle.ready = true;
			svg.classList.add('is-drawn');
			grow();
		});
		new ResizeObserver(() => drawCandles(1)).observe(plot);
	}

	/** A steady number in [0, 1) for day i, so a day's high and low never change. */
	function jitter(i) {
		const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
		return x - Math.floor(x);
	}

	/** A seeded generator per name, so a holding's past is the same on every visit. */
	function seeded(name) {
		let s = [...name].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 2147483647, 7) || 1;
		return () => {
			s = (s * 16807) % 2147483647;
			return (s - 1) / 2147483646;
		};
	}

	/* A holding's daily value for the year: a seeded walk that ends on
     yesterday's close (shares × previous price) and today's value, so its
     last candle is the move its chip shows. */
	function holdingHistory(h) {
		const next = seeded(h.ticker);
		const wobble = h.type === 'crypto' ? 0.032 : h.type === 'fund' ? 0.008 : 0.016;
		const raw = [1];
		for (let i = 1; i < DAYS - 1; i++) raw.push(raw[i - 1] * (1 + 0.0006 + (next() - 0.5) * wobble));
		const scale = (h.shares * h.prev) / raw[DAYS - 2];
		return [...raw.map((v) => v * scale), h.value];
	}

	/* Daily candles from a series of closes: each day opens at the close
     before it, and its high and low reach a little past. Weekends are skipped. */
	function dailyCandles(values) {
		const days = [];
		for (let i = 1; i < DAYS; i++) {
			const weekday = labels[i].getDay();
			if (weekday === 0 || weekday === 6) continue;
			const open = values[i - 1];
			const close = values[i];
			days.push({
				at: labels[i],
				open,
				close,
				high: Math.max(open, close) * (1 + jitter(i) * 0.006),
				low: Math.min(open, close) * (1 - jitter(i + 400) * 0.006),
			});
		}
		return days;
	}

	/* Weekly candles: each week opens on its first weekday and closes on its last. */
	function weeklyCandles(days) {
		const weeks = [];
		for (const d of days) {
			const last = weeks[weeks.length - 1];
			const monday = new Date(d.at);
			monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
			if (last && last.key === monday.getTime()) {
				last.close = d.close;
				last.high = Math.max(last.high, d.high);
				last.low = Math.min(last.low, d.low);
				last.to = d.at;
			} else {
				weeks.push({
					key: monday.getTime(),
					at: d.at,
					to: d.at,
					open: d.open,
					close: d.close,
					high: d.high,
					low: d.low,
				});
			}
		}
		return weeks;
	}

	function candleSeries() {
		const holding = BOOK.holdings.find((h) => h.ticker === candle.ticker);
		if (holding && !holding.daily) holding.daily = holdingHistory(holding);
		const daily = dailyCandles(holding ? holding.daily : history);
		const range = CANDLE_RANGES[candle.range];
		const series = range.unit === 'week' ? weeklyCandles(daily) : daily;
		return series.slice(-range.count);
	}

	function candleWhen(d) {
		const short = (x) => x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		return CANDLE_RANGES[candle.range].unit === 'week' ? `Week of ${short(d.at)}` : day(d.at);
	}

	/* Draws the candles. At t below 1 each candle is part way from its open
     price to its full shape. */
	function drawCandles(t = 1) {
		const svg = pick('[data-pfo-candles]');
		const W = svg.clientWidth;
		const H = svg.clientHeight;
		const days = candle.days;
		if (!W || !H || !days.length) return;
		const top = Math.max(...days.map((d) => d.high));
		const bottom = Math.min(...days.map((d) => d.low));
		const pad = (top - bottom) * 0.08 || top * 0.01;
		const max = top + pad;
		const min = bottom - pad;
		const left = 52;
		const foot = 22;
		const y = (v) => ((max - v) / (max - min)) * (H - foot);
		const slot = (W - left) / days.length;
		const body = Math.max(2, Math.min(16, slot * 0.62));
		const short = (v) => (v >= 10000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v).toLocaleString('en-US')}`);
		const ticks = [0, 1, 2, 3].map((k) => min + ((max - min) * (k + 0.5)) / 4);
		let s = ticks
			.map(
				(v) =>
					`<line class="pfo-candle-grid" x1="${left}" x2="${W}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"></line><text class="pfo-candle-tick" x="${left - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${short(v)}</text>`,
			)
			.join('');
		const every = Math.ceil(days.length / (W < 500 ? 4 : 6));
		days.forEach((d, i) => {
			const x = left + slot * (i + 0.5);
			const grown = (v) => d.open + (v - d.open) * t;
			const close = grown(d.close);
			const yTop = y(Math.max(d.open, close));
			const tall = Math.max(1.5, Math.abs(y(d.open) - y(close)));
			s += `<g class="pfo-candle${d.close >= d.open ? ' is-up' : ' is-down'}${i === candle.at ? ' is-on' : ''}"><line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${y(grown(d.high)).toFixed(1)}" y2="${y(grown(d.low)).toFixed(1)}"></line><rect x="${(x - body / 2).toFixed(1)}" y="${yTop.toFixed(1)}" width="${body.toFixed(1)}" height="${tall.toFixed(1)}" rx="1.5"></rect></g>`;
			if (i % every === 0)
				s += `<text class="pfo-candle-tick" x="${x.toFixed(1)}" y="${H - 4}" text-anchor="middle">${d.at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</text>`;
		});
		if (candle.at >= 0 && candle.at < days.length) {
			const x = left + slot * (candle.at + 0.5);
			s += `<line class="pfo-candle-cross" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="0" y2="${H - foot}"></line>`;
		}
		svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
		svg.innerHTML = s;
		candle.geometry = { left, slot, W, y };
	}

	/* Grows the candles out of their open price over 300ms. */
	function grow() {
		cancelAnimationFrame(candle.frame);
		if (!candle.ready || calm.matches) {
			drawCandles(1);
			return;
		}
		const began = performance.now();
		const step = (now) => {
			const p = Math.min(1, (now - began) / 300);
			drawCandles(1 - (1 - p) ** 3);
			if (p < 1) candle.frame = requestAnimationFrame(step);
		};
		candle.frame = requestAnimationFrame(step);
	}

	/* The title, description, figure and chart for the current holding and range. */
	function showCandles() {
		const range = CANDLE_RANGES[candle.range];
		candle.days = candleSeries();
		candle.at = -1;
		pick('[data-pfo-candle-tip]').hidden = true;
		const days = candle.days;
		const holding = BOOK.holdings.find((h) => h.ticker === candle.ticker);
		pick('[data-pfo-candle-title]').textContent = holding
			? `${holding.ticker}, ${range.title.toLowerCase()}`
			: range.title;
		pick('[data-pfo-candle-desc]').textContent =
			`One candle a ${range.unit}: the body runs from open to close, the line from low to high.`;
		const ups = days.filter((d) => d.close >= d.open).length;
		const change = days[days.length - 1].close - days[0].open;
		const name = holding ? `${holding.ticker} · ` : '';
		pick('[data-pfo-candle-sum]').innerHTML =
			`${name}${signed(change, money)}<small>${range.span}, up on ${ups} of ${days.length} ${range.unit}s</small>`;
		pick('[data-pfo-candles]').setAttribute(
			'aria-label',
			`${holding ? holding.name : 'Portfolio value'} as ${range.unit === 'week' ? 'weekly' : 'daily'} candles, ${day(days[0].at)} to ${day(days[days.length - 1].at)}`,
		);
		grow();
	}

	/* Points at the candle nearest a screen x. */
	function pointAt(clientX) {
		const g = candle.geometry;
		if (!g) return;
		const box = pick('[data-pfo-candles]').getBoundingClientRect();
		const i = Math.floor((clientX - box.left - g.left) / g.slot);
		showCandle(Math.max(0, Math.min(candle.days.length - 1, i)));
	}

	function showCandle(i) {
		candle.at = i;
		drawCandles(1);
		const d = candle.days[i];
		const g = candle.geometry;
		const tip = pick('[data-pfo-candle-tip]');
		const move = d.close - d.open;
		const rows = [
			['Open', money(d.open, d.open < 1000)],
			['High', money(d.high, d.high < 1000)],
			['Low', money(d.low, d.low < 1000)],
			['Close', money(d.close, d.close < 1000)],
		];
		tip.innerHTML =
			`<b>${htmlSafe(candleWhen(d))}</b><dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` +
			`<span class="pfo-candle-tip-move${move < 0 ? ' is-down' : ''}">${signed(move, (n) => money(n, n < 1000))} (${signed(move / d.open, pct)})</span>`;
		tip.hidden = false;
		const x = g.left + g.slot * (i + 0.5);
		tip.classList.toggle('is-left', x > g.W * 0.6);
		tip.style.setProperty('--pfo-tip-x', `${x}px`);
		pick('[data-pfo-candle-live]').textContent =
			`${candleWhen(d)}: opened ${rows[0][1]}, high ${rows[1][1]}, low ${rows[2][1]}, closed ${rows[3][1]}, ${signed(move / d.open, pct)}.`;
	}

	function clearCandle() {
		if (candle.at < 0) return;
		candle.at = -1;
		pick('[data-pfo-candle-tip]').hidden = true;
		drawCandles(1);
	}

	function stepCandle(event) {
		const last = candle.days.length - 1;
		const moves = { ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity };
		if (event.key === 'Escape') {
			clearCandle();
			return;
		}
		if (!(event.key in moves)) return;
		event.preventDefault();
		const from = candle.at < 0 ? (moves[event.key] > 0 ? -1 : last + 1) : candle.at;
		showCandle(Math.max(0, Math.min(last, from + moves[event.key])));
	}

	/* The chips: the whole portfolio, then the six largest holdings with
     today's move. They work as one choice; the arrows move between them. */
	function drawChips() {
		const top = [...BOOK.holdings].sort((a, b) => b.value - a.value).slice(0, 6);
		const all = `<button type="button" data-pfo-chip="all" aria-pressed="true" class="pfo-chip"><b>All holdings</b><span class="pfo-chip-value">${money(total())}</span></button>`;
		pick('[data-pfo-chips]').innerHTML =
			all +
			top
				.map((h) => {
					const m = (h.price - h.prev) / h.prev;
					return `<button type="button" data-pfo-chip="${htmlSafe(h.ticker)}" aria-pressed="false" tabindex="-1" class="pfo-chip"><b>${htmlSafe(h.ticker)}</b><span class="pfo-chip-value">${money(h.value)}</span><span class="pfo-chip-move${m < 0 ? ' is-down' : ''}"><span aria-hidden="true">${m < 0 ? '▼' : '▲'}</span><span class="visually-hidden">${m < 0 ? 'down' : 'up'}</span> ${Math.abs(m * 100).toFixed(1)}%</span></button>`;
				})
				.join('');
	}

	function chooseHolding(ticker) {
		candle.ticker = ticker;
		for (const chip of pickAll('[data-pfo-chip]')) {
			const on = chip.dataset.pfoChip === ticker;
			chip.setAttribute('aria-pressed', String(on));
			chip.tabIndex = on ? 0 : -1;
		}
		showCandles();
	}

	function moveChip(event) {
		const chips = pickAll('[data-pfo-chip]');
		const now = chips.indexOf(document.activeElement);
		if (now < 0) return;
		const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
		const next = step
			? (now + step + chips.length) % chips.length
			: event.key === 'Home'
				? 0
				: event.key === 'End'
					? chips.length - 1
					: -1;
		if (next < 0) return;
		event.preventDefault();
		chips[next].focus();
		chooseHolding(chips[next].dataset.pfoChip);
	}

	/* What is owned, by size: the holdings split into three columns of
     blocks, each as big as its share; small blocks keep only the ticker. */
	function drawTree() {
		const box = pick('[data-pfo-tree]');
		const sum = total();
		const items = [...BOOK.holdings].sort((a, b) => b.value - a.value);
		const columns = [items.slice(0, 2), items.slice(2, 5), items.slice(5)];
		box.innerHTML = columns
			.map((column) => {
				const blocks = column
					.map((h) => {
						const m = (h.price - h.prev) / h.prev;
						const share = Math.round((h.value / sum) * 100);
						return `<li class="pfo-tree-block is-${h.type}" title="${htmlSafe(h.name)}"><span class="pfo-tree-ticker">${htmlSafe(h.ticker)}</span><span class="pfo-tree-value">${money(h.value)} · ${share}%</span><span class="pfo-tree-move">${m < 0 ? '▼' : '▲'} ${Math.abs(m * 100).toFixed(1)}% today</span></li>`;
					})
					.join('');
				return `<ul class="pfo-tree-column">${blocks}</ul>`;
			})
			.join('');
		const blocks = pickAll('.pfo-tree-block', box);
		const flat = columns.flat();
		blocks.forEach((el, i) => el.style.setProperty('--pfo-grow', flat[i].value.toFixed(0)));
		pickAll('.pfo-tree-column', box).forEach((el, i) =>
			el.style.setProperty('--pfo-grow', columns[i].reduce((n, h) => n + h.value, 0).toFixed(0)),
		);
	}

	/* The range switch sets the window to the last N days. */
	function wireRange() {
		for (const input of pickAll('[data-pfo-range]')) {
			input.addEventListener('change', () => {
				state.to = DAYS - 1;
				state.from = Math.max(0, DAYS - Number(input.value));
				showRange();
			});
		}
	}

	function clearRangeSwitch() {
		for (const input of pickAll('[data-pfo-range]')) input.checked = false;
	}

	/* The window on the strip: drag its middle to move it, an edge to stretch
     it. Arrow keys move an edge by a day, or a week with Shift. */
	function wireBrush() {
		const brush = pick('[data-pfo-brush]');
		const win = pick('[data-pfo-window]');
		const MIN = 14;
		let drag = null;
		function dayAt(x) {
			const box = brush.getBoundingClientRect();
			return Math.round(((x - box.left) / box.width) * (DAYS - 1));
		}
		brush.addEventListener('pointerdown', (event) => {
			const edge = event.target.closest('[data-pfo-edge]');
			const at = dayAt(event.clientX);
			if (edge) drag = { kind: edge.dataset.pfoEdge };
			else if (event.target === win) drag = { kind: 'move', offset: at - state.from };
			else {
				const width = state.to - state.from;
				state.from = Math.max(0, Math.min(DAYS - 1 - width, at - Math.round(width / 2)));
				state.to = state.from + width;
				drag = { kind: 'move', offset: at - state.from };
				clearRangeSwitch();
				showRange();
			}
			brush.setPointerCapture(event.pointerId);
			brush.classList.add('is-dragging');
		});
		brush.addEventListener('pointermove', (event) => {
			if (!drag) return;
			const at = Math.max(0, Math.min(DAYS - 1, dayAt(event.clientX)));
			if (drag.kind === 'from') state.from = Math.min(at, state.to - MIN);
			if (drag.kind === 'to') state.to = Math.max(at, state.from + MIN);
			if (drag.kind === 'move') {
				const width = state.to - state.from;
				state.from = Math.max(0, Math.min(DAYS - 1 - width, at - drag.offset));
				state.to = state.from + width;
			}
			clearRangeSwitch();
			showRange();
		});
		function stop() {
			drag = null;
			brush.classList.remove('is-dragging');
		}
		brush.addEventListener('pointerup', stop);
		brush.addEventListener('pointercancel', stop);
		for (const edge of pickAll('[data-pfo-edge]', brush)) {
			edge.addEventListener('keydown', (event) => {
				const step = event.shiftKey ? 7 : 1;
				const move = { ArrowLeft: -step, ArrowRight: step }[event.key];
				if (!move) return;
				event.preventDefault();
				if (edge.dataset.pfoEdge === 'from')
					state.from = Math.max(0, Math.min(state.to - MIN, state.from + move));
				else state.to = Math.min(DAYS - 1, Math.max(state.from + MIN, state.to + move));
				clearRangeSwitch();
				showRange();
			});
		}
	}

	/* Holdings */
	function wireHoldings() {
		wireSparkHover(pick('[data-pfo-hold-search]').closest('section') || document);
		pick('[data-pfo-hold-search]').addEventListener('input', drawHoldings);
		pick('[data-pfo-hold-show]').addEventListener('change', drawHoldings);
		for (const th of pickAll('[data-pfo-sort]')) {
			pick('button', th).addEventListener('click', () => {
				const key = th.dataset.pfoSort;
				state.sort = { key, up: state.sort.key === key ? !state.sort.up : key === 'name' };
				drawHoldings();
			});
		}
		pick('[data-pfo-holdings]').addEventListener('click', (event) => {
			if (!event.target.closest('[data-pfo-hold-reset]')) return;
			pick('[data-pfo-hold-search]').value = '';
			pick('[data-pfo-hold-show]').value = 'all';
			drawHoldings();
		});
		drawHoldings();
	}

	function sparkline(values, up) {
		const lo = Math.min(...values);
		const hi = Math.max(...values);
		const pts = values
			.map(
				(v, i) =>
					`${((i / (values.length - 1)) * 96 + 2).toFixed(1)},${(26 - ((v - lo) / (hi - lo || 1)) * 22).toFixed(1)}`,
			)
			.join(' ');
		return `<span class="pfo-spark-wrap" data-pfo-spark="${values.map((v) => v.toFixed(2)).join(',')}"><svg viewBox="0 0 100 30" class="pfo-spark${up ? '' : ' is-down'}" aria-hidden="true"><polyline points="${pts}"></polyline></svg><span class="pfo-spark-dot" hidden></span><span class="pfo-spark-tip" hidden></span></span>`;
	}

	/** Pointing along a holding's sparkline shows that day's price on it:
	 * a dot on the line and the date and price beside it. */
	function wireSparkHover(table) {
		table.addEventListener('pointermove', (event) => {
			const wrap = event.target.closest('[data-pfo-spark]');
			if (!wrap) return;
			const values = wrap.dataset.pfoSpark.split(',').map(Number);
			const box = wrap.getBoundingClientRect();
			const at = Math.round(
				Math.min(1, Math.max(0, (event.clientX - box.left - box.width * 0.02) / (box.width * 0.96))) *
					(values.length - 1),
			);
			const lo = Math.min(...values);
			const hi = Math.max(...values);
			const x = 0.02 + (at / (values.length - 1)) * 0.96;
			const y = (26 - ((values[at] - lo) / (hi - lo || 1)) * 22) / 30;
			const day = new Date(TODAY);
			day.setDate(day.getDate() - (values.length - 1 - at));
			const dot = pick('.pfo-spark-dot', wrap);
			const tip = pick('.pfo-spark-tip', wrap);
			dot.style.setProperty('--x', x);
			dot.style.setProperty('--y', y);
			tip.textContent = `${day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${price(values[at])}`;
			dot.hidden = false;
			tip.hidden = false;
		});
		table.addEventListener('pointerout', (event) => {
			const wrap = event.target.closest('[data-pfo-spark]');
			if (!wrap || wrap.contains(event.relatedTarget)) return;
			pick('.pfo-spark-dot', wrap).hidden = true;
			pick('.pfo-spark-tip', wrap).hidden = true;
		});
	}

	function drawHoldings() {
		const q = pick('[data-pfo-hold-search]').value.trim().toLowerCase();
		const type = pick('[data-pfo-hold-show]').value;
		const { key, up } = state.sort;
		const rows = BOOK.holdings
			.filter((h) => type === 'all' || h.type === type)
			.filter((h) => !q || `${h.ticker} ${h.name}`.toLowerCase().includes(q))
			.sort((a, b) => {
				const d = key === 'name' ? a.ticker.localeCompare(b.ticker) : a[key] - b[key];
				return up ? d : -d;
			});
		const sum = total();
		pick('[data-pfo-hold-sum]').textContent =
			`${BOOK.holdings.length} holdings. The biggest three make up ${Math.round(
				([...BOOK.holdings]
					.sort((a, b) => b.value - a.value)
					.slice(0, 3)
					.reduce((s, h) => s + h.value, 0) /
					sum) *
					100,
			)}% of the value.`;
		pick('[data-pfo-hold-count]').textContent = `${rows.length} of ${BOOK.holdings.length}`;
		for (const th of pickAll('[data-pfo-sort]')) {
			const on = th.dataset.pfoSort === key;
			pick('.bi', th).className =
				`bi ${on ? (up ? 'bi-arrow-up' : 'bi-arrow-down') : 'bi-arrow-down-up pfo-sort-idle'}`;
			if (on) th.setAttribute('aria-sort', up ? 'ascending' : 'descending');
			else th.removeAttribute('aria-sort');
		}
		const body = pick('[data-pfo-holdings]');
		if (!rows.length) {
			body.innerHTML = `<tr><td colspan="5"><div class="basalt-empty basalt-empty-compact"><h3 class="basalt-empty-title">No holdings here</h3><p class="basalt-empty-text">Nothing you own matches that search and type.</p><div class="basalt-empty-actions"><button data-pfo-hold-reset type="button" class="btn btn-outline-secondary btn-sm">Show all holdings</button></div></div></td></tr>`;
			return;
		}
		body.innerHTML = rows
			.map((h) => {
				const dayMove = (h.price - h.prev) / h.prev;
				const monthUp = h.spark[h.spark.length - 1] >= h.spark[0];
				const gainPct = (h.price - h.cost) / h.cost;
				return `<tr><td><a href="transactions.html" class="pfo-hold"><span class="pfo-hold-mark tone-series-${TYPES[h.type].tone}" aria-hidden="true">${htmlSafe(h.ticker.slice(0, 4))}</span><span class="pfo-hold-text"><span class="pfo-hold-name">${htmlSafe(h.name)}</span><span class="pfo-hold-sub">${htmlSafe(h.ticker)} · ${h.shares.toLocaleString('en-US')} ${h.type === 'crypto' ? 'coins' : 'shares'}</span></span></a></td><td class="pfo-num pfo-col-price">${price(h.price)}<span class="pfo-move${dayMove < 0 ? ' is-down' : ''}">${signed(dayMove, pct)}</span></td><td class="pfo-col-spark">${sparkline(h.spark, monthUp)}</td><td class="pfo-num pfo-strong">${money(h.value)}</td><td class="pfo-num pfo-col-gain"><span class="pfo-gain${h.gain < 0 ? ' is-down' : ''}">${signed(h.gain, money)}</span><span class="pfo-move${gainPct < 0 ? ' is-down' : ''}">${signed(gainPct, pct)}</span></td></tr>`;
			})
			.join('');
	}

	/* Allocation ring */
	function drawMix() {
		const sum = total();
		const parts = Object.entries(TYPES).map(([key, t]) => ({
			key,
			...t,
			value: BOOK.holdings.filter((h) => h.type === key).reduce((s, h) => s + h.value, 0),
			count: BOOK.holdings.filter((h) => h.type === key).length,
		}));
		const svg = pick('[data-pfo-ring]');
		const r = 80;
		const c = 2 * Math.PI * r;
		let at = 0;
		svg.innerHTML = `<circle class="pfo-ring-track" cx="100" cy="100" r="${r}"></circle>${parts
			.map((p) => {
				const len = (p.value / sum) * c;
				const seg = `<circle data-pfo-part="${p.key}" class="pfo-ring-seg tone-series-${p.tone}" cx="100" cy="100" r="${r}" stroke-dasharray="${Math.max(0, len - 3).toFixed(2)} ${c.toFixed(2)}" stroke-dashoffset="${(-at).toFixed(2)}"></circle>`;
				at += len;
				return seg;
			})
			.join('')}`;
		const list = pick('[data-pfo-mix]');
		list.innerHTML = parts
			.map(
				(p) =>
					`<li data-pfo-part="${p.key}" class="pfo-mix-row" tabindex="0"><span class="pfo-key tone-series-${p.tone}" aria-hidden="true"></span><span class="pfo-mix-name">${p.label}<span class="pfo-mix-sub">${p.count} holdings</span></span><span class="pfo-mix-value">${money(p.value)}<span class="pfo-mix-sub">${Math.round((p.value / sum) * 100)}%</span></span></li>`,
			)
			.join('');
		const top = [...parts].sort((a, b) => b.value - a.value)[0];
		pick('[data-pfo-mix-read]').textContent =
			`${top.label} hold the most, ${Math.round((top.value / sum) * 100)}% of the portfolio.`;
		function showCenter(p) {
			pick('[data-pfo-ring-label]').textContent = p ? p.label : 'Total';
			pick('[data-pfo-ring-value]').textContent = p ? `${Math.round((p.value / sum) * 100)}%` : money(sum);
		}
		showCenter();
		const box = pick('.pfo-mix');
		for (const el of pickAll('[data-pfo-part]', box)) {
			const p = parts.find((x) => x.key === el.dataset.pfoPart);
			const on = () => {
				box.classList.add('is-lit');
				for (const x of pickAll(`[data-pfo-part="${p.key}"]`, box)) x.classList.add('is-on');
				showCenter(p);
			};
			const off = () => {
				box.classList.remove('is-lit');
				for (const x of pickAll('.is-on', box)) x.classList.remove('is-on');
				showCenter();
			};
			el.addEventListener('pointerenter', on);
			el.addEventListener('pointerleave', off);
			el.addEventListener('focus', on);
			el.addEventListener('blur', off);
		}
	}

	/* The four holdings that moved most since yesterday's close, either way. */
	function drawMovers() {
		const move = (h) => (h.price - h.prev) / h.prev;
		pick('[data-pfo-movers]').innerHTML = [...BOOK.holdings]
			.sort((a, b) => Math.abs(move(b)) - Math.abs(move(a)))
			.slice(0, 4)
			.map((h) => {
				const m = move(h);
				const change = h.shares * (h.price - h.prev);
				return `<li class="pfo-mover"><span class="pfo-hold-mark tone-series-${TYPES[h.type].tone}" aria-hidden="true">${htmlSafe(h.ticker.slice(0, 4))}</span><span class="pfo-hold-text"><span class="pfo-hold-name">${htmlSafe(h.name)}</span><span class="pfo-hold-sub">${signed(change, money)} on your ${h.type === 'crypto' ? 'coins' : 'shares'}</span></span><span class="pfo-mover-pct${m < 0 ? ' is-down' : ''}">${signed(m, pct)}</span></li>`;
			})
			.join('');
	}

	/* Watchlist */
	function wireWatch() {
		pick('[data-pfo-watch-search]').addEventListener('input', drawWatch);
		pick('[data-pfo-watch-show]').addEventListener('change', drawWatch);
		pick('[data-pfo-watch-sort]').addEventListener('change', drawWatch);
		pick('[data-pfo-watch]').addEventListener('click', (event) => {
			const bell = event.target.closest('[data-pfo-alert]');
			if (bell) {
				const t = bell.dataset.pfoAlert;
				const on = !state.alerts.has(t);
				if (on) state.alerts.add(t);
				else state.alerts.delete(t);
				drawWatch();
				toast({
					tone: on ? 'success' : 'info',
					title: on ? `Alert on for ${t}: a 5% move in a day` : `Alert off for ${t}`,
				});
			}
			if (event.target.closest('[data-pfo-watch-reset]')) {
				pick('[data-pfo-watch-search]').value = '';
				pick('[data-pfo-watch-show]').value = 'all';
				drawWatch();
			}
		});
		drawWatch();
	}

	function drawWatch() {
		const q = pick('[data-pfo-watch-search]').value.trim().toLowerCase();
		const type = pick('[data-pfo-watch-show]').value;
		const by = pick('[data-pfo-watch-sort]').value;
		const place = (w) => (w.price - w.low) / (w.high - w.low);
		const move = (w) => (w.price - w.prev) / w.prev;
		const rows = BOOK.watch
			.filter((w) => type === 'all' || w.type === type)
			.filter((w) => !q || `${w.ticker} ${w.name}`.toLowerCase().includes(q))
			.sort((a, b) => {
				if (by === 'name') return a.ticker.localeCompare(b.ticker);
				if (by === 'low') return place(a) - place(b);
				return Math.abs(move(b)) - Math.abs(move(a));
			});
		pick('[data-pfo-watch-count]').textContent = `${rows.length} of ${BOOK.watch.length}`;
		const list = pick('[data-pfo-watch]');
		if (!rows.length) {
			list.innerHTML = `<li class="pfo-watch-empty"><div class="basalt-empty basalt-empty-compact"><h3 class="basalt-empty-title">Nothing here</h3><p class="basalt-empty-text">No watched prices match that search and type.</p><div class="basalt-empty-actions"><button data-pfo-watch-reset type="button" class="btn btn-outline-secondary btn-sm">Show the whole list</button></div></div></li>`;
			return;
		}
		list.innerHTML = rows
			.map((w) => {
				const m = move(w);
				const at = Math.round(place(w) * 100);
				const on = state.alerts.has(w.ticker);
				return `<li class="pfo-watch-row"><span class="pfo-hold-mark tone-series-${TYPES[w.type].tone}" aria-hidden="true">${htmlSafe(w.ticker.slice(0, 4))}</span><span class="pfo-hold-text"><span class="pfo-hold-name">${htmlSafe(w.name)}</span><span class="pfo-hold-sub">${htmlSafe(w.ticker)} · ${TYPES[w.type].label}</span></span><span class="pfo-watch-price">${price(w.price)}<span class="pfo-move${m < 0 ? ' is-down' : ''}">${signed(m, pct)}</span></span><span class="pfo-watch-range" role="img" aria-label="${at}% of the way from the year's low of ${price(w.low)} to its high of ${price(w.high)}"><span class="pfo-watch-track"><span class="pfo-watch-dot value-${at}"></span></span><span class="pfo-watch-ends"><span>${price(w.low)}</span><span>${price(w.high)}</span></span></span><button data-pfo-alert="${w.ticker}" aria-pressed="${on}" type="button" class="btn btn-icon btn-sm pfo-alert${on ? ' is-on' : ''}" aria-label="${on ? 'Turn off' : 'Turn on'} the price alert for ${w.ticker}"><i class="bi ${on ? 'bi-bell-fill' : 'bi-bell'}" aria-hidden="true"></i></button></li>`;
			})
			.join('');
	}

	/* Export */
	function exportCsv() {
		const lines = [['Ticker', 'Name', 'Type', 'Shares', 'Price', 'Value', 'Average cost', 'Gain']];
		for (const h of BOOK.holdings) {
			lines.push([
				h.ticker,
				h.name,
				TYPES[h.type].label,
				h.shares,
				h.price,
				h.value.toFixed(2),
				h.cost,
				h.gain.toFixed(2),
			]);
		}
		const csv = lines.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
		link.download = 'portfolio-2026-10-08.csv';
		link.click();
		URL.revokeObjectURL(link.href);
		toast({ tone: 'success', title: 'Portfolio exported as CSV' });
	}

	start();
})();
