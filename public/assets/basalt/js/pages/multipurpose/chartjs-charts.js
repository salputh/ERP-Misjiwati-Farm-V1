/**
 * Drives chartjs-charts.html, the one page that walks through every chart
 * type Chart.js ships. Besides the thirteen charts it handles what the single
 * type pages skip: a month range switch, a bar chart that follows an editable
 * table, a legend that hides pie slices, a feed that ticks every two seconds
 * and a tooltip drawn in HTML. Colors come from the --basalt-* tokens when a
 * chart is made, so a theme change simply makes every chart again.
 */
(() => {
	'use strict';

	const cjsRoot = pick('[data-cjs-root]');
	if (!cjsRoot || typeof Chart === 'undefined') return;

	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const TYPEFACE = "'Schibsted Grotesk', sans-serif";
	const AXIS_FONT = { family: TYPEFACE, size: 11.5 };
	const FEED_LENGTH = 30;
	const FEED_STEP_MS = 2000;
	const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

	/* Sample figures. Name-to-number maps keep their key order on screen, and
     the catalog, channel and spark entries name the ramp slot that colors them. */
	const FIGURES = {
		yearMonths: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
		recurringK: [571, 590, 604, 622, 631, 640, 652, 664, 681, 690, 702, 715],
		seatsByPlan: { Free: 88, Basic: 74, Pro: 52, Max: 34 },
		catalog: [
			{
				family: 'Plans',
				slot: 0,
				items: [
					['Basic', 19, 70, 410],
					['Pro', 49, 74, 300],
					['Max', 89, 76, 120],
				],
			},
			{
				family: 'Add-ons',
				slot: 2,
				items: [
					['Travel Planner', 29, 62, 220],
					['Customer Portal', 15, 66, 180],
					['SMS credits', 9, 34, 260],
				],
			},
			{
				family: 'Services',
				slot: 7,
				items: [
					['Onboarding', 48, 29, 70],
					['Training', 34, 36, 90],
					['Custom setup', 79, 24, 45],
					['Priority support', 25, 52, 130],
				],
			},
		],
		salesPercent: { Pro: 31, Max: 25, Basic: 24, 'Add-ons': 20 },
		weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
		/* Every weekday sums to the 9,030 store sessions shown on the Line charts page. */
		trafficSources: [
			{ source: 'Search', slot: 0, daily: [520, 560, 640, 610, 650, 390, 370] },
			{ source: 'Direct', slot: 1, daily: [300, 320, 350, 360, 340, 210, 200] },
			{ source: 'Email', slot: 4, daily: [240, 260, 330, 320, 330, 170, 160] },
			{ source: 'Social', slot: 7, daily: [173, 202, 237, 243, 257, 142, 146] },
		],
		skills: ['Craft', 'Ownership', 'Teamwork', 'Communication', 'Mentoring', 'Delivery'],
		scoresThisQuarter: [74, 80, 83, 72, 78, 84],
		scoresLastQuarter: [70, 76, 78, 70, 71, 79],
		plansStarted: [18, 21, 19, 24, 22, 27, 23, 30, 26, 20, 17, 24],
		weeklyTrends: {
			reviews: { slot: 0, weeks: [37, 38, 53, 56, 63, 64, 68, 68, 68, 61, 52, 52, 47, 32] },
			returns: { slot: 2, weeks: [12, 11, 13, 10, 9, 9, 8, 10, 9, 7, 8, 7, 6, 6] },
			tickets: { slot: 4, weeks: [41, 44, 39, 46, 52, 48, 55, 51, 58, 54, 60, 57, 63, 61] },
		},
		peopleByTeam: { Engineering: 7, Sales: 10, Operations: 11, Support: 7, Product: 8, Design: 10 },
		lastSixMonths: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
		allOrders: [454, 484, 517, 522, 506, 504],
		returningOrders: [335, 364, 354, 301, 271, 329],
	};

	/* Which recipe each data-cjs-chart value is drawn with. */
	const RECIPES = {
		range: recurringRevenueLine,
		doughnut: planRing,
		scatter: healthScatter,
		bubble: catalogBubbles,
		table: shippedBars,
		pie: salesPie,
		live: feedLine,
		stacked: trafficStack,
		radar: skillsRadar,
		area: plansArea,
		spark: trendSpark,
		polar: headcountPolar,
		mixed: ordersCombo,
	};

	const usage = scatterAccounts();
	const trendAt = leastSquares(usage);
	const ticker = seedFeed();
	const feedRandom = seededRandom(97);
	const cellInputs = [...pickAll('[data-cjs-table] input[data-cjs-cell]', cjsRoot)];
	const feedReadout = pick('[data-cjs-live-value]', cjsRoot);

	/* What the visitor chose survives every rebuild of the charts. */
	const drawn = new Map();
	const mutedSlices = new Set();
	let monthsShown = 6;
	let feedRequested = !calmMotion;
	let feedVisible = false;
	let feedInterval = 0;

	function start() {
		observeCanvases();
		followTheme();
		wireRangeSwitch();
		wireOrderTable();
		wireSliceLegend();
		wireFeed();
		paintSwatches();
		wireTypeFilter();
	}

	/* A chart is made the first time its canvas nears the viewport. */
	function observeCanvases() {
		const targets = pickAll('canvas[data-cjs-chart]', cjsRoot);
		if (!('IntersectionObserver' in window)) {
			for (const plot of targets) drawCanvas(plot, false);
			return;
		}
		const watcher = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					watcher.unobserve(entry.target);
					drawCanvas(entry.target, true);
				}
			},
			{ rootMargin: '80px 0px' },
		);
		for (const plot of targets) watcher.observe(plot);
	}

	/* The token values switch with the theme attribute, so they are read a frame later. */
	function followTheme() {
		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() => {
				for (const plot of drawn.keys()) drawCanvas(plot, false);
				paintSwatches();
			});
		});
	}

	/**
	 * Makes (or remakes) the chart on one canvas.
	 * @param {HTMLCanvasElement} plot
	 * @param {boolean} animated false paints at once; later updates still move.
	 */
	function drawCanvas(plot, animated) {
		const chartKind = plot.getAttribute('data-cjs-chart');
		const recipe = RECIPES[chartKind];
		if (!recipe) return;
		drawn.get(plot)?.destroy();
		const setup = recipe(readInks(), plot);
		const entrance = setup.options.animation;
		if (!animated) setup.options.animation = false;
		const built = new Chart(plot, setup);
		if (!animated) built.config.options.animation = entrance;
		if (chartKind === 'pie' && mutedSlices.size) {
			for (const index of mutedSlices) built.toggleDataVisibility(index);
			built.update('none');
		}
		drawn.set(plot, built);
		if (chartKind === 'live') syncFeed();
	}

	function drawnChart(chartKind) {
		const plot = pick(`[data-cjs-chart="${chartKind}"]`, cjsRoot);
		return plot ? drawn.get(plot) : null;
	}

	function redraw(built) {
		built.update(calmMotion ? 'none' : undefined);
	}

	function wireRangeSwitch() {
		const switcher = pick('[data-cjs-range]', cjsRoot);
		if (!switcher) return;
		switcher.addEventListener('click', (event) => {
			const chosen = event.target.closest('[data-cjs-months]');
			if (!chosen) return;
			monthsShown = Number(chosen.getAttribute('data-cjs-months'));
			for (const option of pickAll('[data-cjs-months]', switcher)) {
				option.setAttribute('aria-pressed', String(option === chosen));
			}
			const built = drawnChart('range');
			if (!built) return;
			built.data.labels = FIGURES.yearMonths.slice(-monthsShown);
			built.data.datasets[0].data = FIGURES.recurringK.slice(-monthsShown);
			redraw(built);
		});
	}

	function wireOrderTable() {
		const sheet = pick('[data-cjs-table]', cjsRoot);
		if (!sheet) return;
		const sumCell = pick('[data-cjs-total]', cjsRoot);
		sheet.addEventListener('input', () => {
			const shipped = cellValues();
			if (sumCell) sumCell.textContent = shipped.reduce((sum, value) => sum + value, 0).toLocaleString();
			const built = drawnChart('table');
			if (!built) return;
			built.data.datasets[0].data = shipped;
			redraw(built);
		});
	}

	/* Each cell is clamped to 0-999; anything unreadable counts as zero. */
	function cellValues() {
		return cellInputs.map((input) => {
			const whole = parseInt(input.value, 10);
			return Number.isFinite(whole) ? Math.max(0, Math.min(999, whole)) : 0;
		});
	}

	/* One slice always stays, or the pie would have nothing left to divide. */
	function wireSliceLegend() {
		const sliceBar = pick('[data-cjs-toggles]', cjsRoot);
		if (!sliceBar) return;
		sliceBar.addEventListener('click', (event) => {
			const toggle = event.target.closest('[data-cjs-slice]');
			if (!toggle) return;
			const index = Number(toggle.getAttribute('data-cjs-slice'));
			const hide = !mutedSlices.has(index);
			if (hide && mutedSlices.size >= Object.keys(FIGURES.salesPercent).length - 1) return;
			mutedSlices[hide ? 'add' : 'delete'](index);
			toggle.setAttribute('aria-pressed', String(!hide));
			const built = drawnChart('pie');
			if (!built) return;
			built.toggleDataVisibility(index);
			redraw(built);
		});
	}

	/* The swatch labels print each ramp token's current hex value. */
	function paintSwatches() {
		for (const hexCell of pickAll('[data-cjs-hex]', cjsRoot)) {
			hexCell.textContent = readToken(
				`--basalt-series-${hexCell.getAttribute('data-cjs-hex')}`,
				'',
			).toLowerCase();
		}
	}

	function wireTypeFilter() {
		const cardGrid = pick('[data-cjs-grid]', cjsRoot);
		const tally = pick('[data-cjs-count]', cjsRoot);
		const tiles = [...pickAll('.cjs-card', cardGrid)];
		const typeButtons = pickAll('[data-cjs-filter]', cjsRoot);
		for (const typeButton of typeButtons) {
			typeButton.addEventListener('click', () => {
				for (const peer of typeButtons) peer.setAttribute('aria-pressed', String(peer === typeButton));
				showKind(typeButton.getAttribute('data-cjs-filter'));
			});
		}

		/* "all" shows every card. In a narrowed view a half-width card left
       without a partner stretches across its row. */
		function showKind(chartKind) {
			const everything = chartKind === 'all';
			const visible = [];
			for (const article of tiles) {
				const fits = everything || article.getAttribute('data-cjs-kind') === chartKind;
				article.classList.toggle('is-hidden', !fits);
				article.classList.remove('is-alone');
				if (fits) visible.push(article);
			}
			cardGrid.classList.toggle('is-filtered', !everything);
			if (!everything) {
				const paired = visible.filter((article) => !article.classList.contains('cjs-card-full'));
				if (paired.length % 2) paired.at(-1).classList.add('is-alone');
			}
			if (tally) tally.textContent = `${visible.length} ${visible.length === 1 ? 'chart' : 'charts'}`;
		}
	}

	/* Runs on its own unless the device asks for less motion, and only while
     the chart exists, is on screen and the tab is in front. */
	function wireFeed() {
		const button = pick('[data-cjs-live-toggle]', cjsRoot);
		const plot = pick('[data-cjs-chart="live"]', cjsRoot);
		if (feedReadout) feedReadout.textContent = String(ticker.readings.at(-1));
		if (button) {
			button.textContent = feedRequested ? 'Pause' : 'Start';
			button.addEventListener('click', () => {
				feedRequested = !feedRequested;
				button.textContent = feedRequested ? 'Pause' : 'Start';
				syncFeed();
			});
		}
		if (plot && 'IntersectionObserver' in window) {
			new IntersectionObserver((entries) => {
				feedVisible = entries.at(-1).isIntersecting;
				syncFeed();
			}).observe(plot);
		} else {
			feedVisible = true;
		}
		document.addEventListener('visibilitychange', syncFeed);
	}

	function syncFeed() {
		const shouldRun = feedRequested && feedVisible && !document.hidden && Boolean(drawnChart('live'));
		if (shouldRun === Boolean(feedInterval)) return;
		if (shouldRun) {
			feedInterval = window.setInterval(advanceFeed, FEED_STEP_MS);
		} else {
			window.clearInterval(feedInterval);
			feedInterval = 0;
		}
	}

	/* Drops the oldest reading, adds a new one, and moves the chart along with it. */
	function advanceFeed() {
		const reading = stepCount(ticker.readings.at(-1), feedRandom);
		const stamp = timeLabel(Date.now());
		slide(ticker.stamps, stamp);
		slide(ticker.readings, reading);
		if (feedReadout) feedReadout.textContent = String(reading);
		const built = drawnChart('live');
		if (!built) return;
		slide(built.data.labels, stamp);
		slide(built.data.datasets[0].data, reading);
		redraw(built);
	}

	function slide(list, value) {
		list.push(value);
		list.shift();
	}

	/* The first minute of readings, ending now, one every two seconds. */
	function seedFeed() {
		const random = seededRandom(31);
		const now = Date.now();
		const stamps = [];
		const readings = [];
		let reading = 9;
		for (let back = FEED_LENGTH - 1; back >= 0; back -= 1) {
			reading = stepCount(reading, random);
			stamps.push(timeLabel(now - back * FEED_STEP_MS));
			readings.push(reading);
		}
		return { stamps, readings };
	}

	/* A small random step that drifts back toward nine, kept between 2 and 18. */
	function stepCount(previous, random) {
		const drift = (random() - 0.5) * 5 + (9 - previous) * 0.2;
		return Math.max(2, Math.min(18, Math.round(previous + drift)));
	}

	function timeLabel(epochMs) {
		return new Date(epochMs)
			.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
			.toLowerCase();
	}

	/* A Park-Miller generator, so the scatter and the first minute of the feed
     come out the same on every visit. */
	function seededRandom(seed) {
		let state = seed;
		return () => {
			state = (state * 16807) % 2147483647;
			return (state - 1) / 2147483646;
		};
	}

	/* Thirty accounts; the more hours one spends in the product, the healthier it tends to be. */
	function scatterAccounts() {
		const random = seededRandom(7);
		const points = [];
		while (points.length < 30) {
			const hours = Math.round(3 + random() * 34);
			const health = Math.round(30 + hours * 1.45 + (random() - 0.5) * 30);
			points.push({ x: hours, y: Math.max(8, Math.min(98, health)) });
		}
		return points;
	}

	/**
	 * The straight line that best fits the points, by least squares.
	 * @returns {(x: number) => number} the line's y at x, to one decimal.
	 */
	function leastSquares(points) {
		const pointCount = points.length;
		let sumX = 0;
		let sumY = 0;
		let sumXY = 0;
		let sumXX = 0;
		for (const { x, y } of points) {
			sumX += x;
			sumY += y;
			sumXY += x * y;
			sumXX += x * x;
		}
		const slope = (pointCount * sumXY - sumX * sumY) / (pointCount * sumXX - sumX * sumX);
		const intercept = (sumY - slope * sumX) / pointCount;
		return (x) => Math.round((intercept + slope * x) * 10) / 10;
	}

	function readToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/* The colors one chart is made with, read fresh from the theme. */
	function readInks() {
		const bodyInk = readToken('--basalt-copy', '#12233a');
		const subdued = readToken('--basalt-copy-muted', '#5f7186');
		return {
			ramp: Array.from({ length: 8 }, (_, slot) => readToken(`--basalt-series-${slot + 1}`, '#2b6fd4')),
			ink: bodyInk,
			/* The same mix as --cjs-quiet in chartjs-charts.css. */
			soft: blend(subdued, bodyInk, 0.82),
			rule: translucent(bodyInk, 0.07),
			paper: readToken('--basalt-plane', '#ffffff'),
			edge: readToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
		};
	}

	/* Tokens arrive as #rgb, #rrggbb or rgb()/rgba(). Chart.js wants strings it
     can read itself, so colors are mixed here instead of with color-mix(). */
	function channelsOf(color) {
		const value = String(color || '').trim();
		const short = value.match(/^#([0-9a-f]{3})$/i);
		if (short) return [...short[1]].map((digit) => parseInt(digit + digit, 16)).concat(1);
		const long = value.match(/^#([0-9a-f]{6})$/i);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 1];
		}
		const functional = value.match(/^rgba?\(([^)]+)\)$/i);
		if (!functional) return [128, 128, 128, 1];
		const pieces = functional[1].split(',').map((part) => parseFloat(part));
		return [pieces[0], pieces[1], pieces[2], pieces.length > 3 ? pieces[3] : 1];
	}

	function translucent(color, alpha) {
		const [red, green, blue] = channelsOf(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	/** Mixes two colors; weight is the share taken from the first. */
	function blend(first, second, weight) {
		const one = channelsOf(first);
		const two = channelsOf(second);
		const [red, green, blue] = [0, 1, 2].map((at) => Math.round(one[at] * weight + two[at] * (1 - weight)));
		return `rgb(${red}, ${green}, ${blue})`;
	}

	/**
	 * A scriptable vertical fade from topColor to bottomColor across the plot
	 * area. With gradients switched off it is one plain color, `flat`.
	 */
	function verticalWash(topColor, bottomColor, flat) {
		return window.Basalt.chartFill(
			[
				[0, topColor],
				[1, bottomColor],
			],
			{ flat },
		);
	}

	/* An area fill that fades out toward the axis, one light tint when gradients are off. */
	function fadingFill(color) {
		return verticalWash(translucent(color, 0.28), translucent(color, 0), translucent(color, 0.12));
	}

	function isBranch(value) {
		return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
	}

	/** Deep-copies plain objects from over onto under; arrays and functions replace. */
	function overlay(under, over = {}) {
		const result = { ...under };
		for (const [key, value] of Object.entries(over)) {
			result[key] = isBranch(value) && isBranch(result[key]) ? overlay(result[key], value) : value;
		}
		return result;
	}

	/* Options shared by the charts drawn on x and y axes. */
	function axisOptions(inks, extra) {
		const tickStyle = { color: inks.soft, font: AXIS_FONT, padding: 8 };
		const preset = {
			responsive: true,
			maintainAspectRatio: false,
			animation: calmMotion ? false : { duration: 500, easing: 'easeOutQuart' },
			interaction: { mode: 'index', intersect: false },
			layout: { padding: { top: 6, right: 6 } },
			elements: {
				line: { borderWidth: 2, borderCapStyle: 'round', borderJoinStyle: 'round' },
				point: { radius: 0, hoverRadius: 5, hoverBorderWidth: 2, hoverBorderColor: inks.paper },
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					backgroundColor: inks.paper,
					borderColor: inks.edge,
					borderWidth: 1,
					cornerRadius: 8,
					padding: 10,
					boxPadding: 4,
					usePointStyle: true,
					titleColor: inks.ink,
					titleFont: { family: TYPEFACE, size: 12, weight: '600' },
					bodyColor: inks.ink,
					bodyFont: { family: TYPEFACE, size: 12 },
				},
			},
			scales: {
				x: {
					border: { display: false },
					grid: { display: false },
					ticks: { maxRotation: 0, autoSkipPadding: 12, ...tickStyle },
				},
				y: {
					border: { display: false },
					grid: { color: inks.rule },
					ticks: { maxTicksLimit: 5, ...tickStyle },
				},
			},
		};
		return overlay(preset, extra);
	}

	/* Pie, doughnut, polar area and radar have no x/y scales, and their
     tooltip follows the slice under the pointer. */
	function radialOptions(inks, extra) {
		const { scales, ...rest } = axisOptions(inks, { interaction: { mode: 'nearest', intersect: true } });
		return overlay(rest, extra);
	}

	function axisCaption(inks, caption) {
		return {
			display: true,
			text: caption,
			color: inks.soft,
			font: AXIS_FONT,
			padding: { top: 6, bottom: 2 },
		};
	}

	/* The filled line used by the revenue, feed and new-plan charts. */
	function filledLine(color, name, values, tension) {
		return {
			label: name,
			data: values,
			tension,
			fill: 'start',
			borderColor: color,
			backgroundColor: fadingFill(color),
			pointBackgroundColor: color,
			pointHoverBackgroundColor: color,
		};
	}

	/* The recipes below each return a full Chart.js config for one data-cjs-chart value. */

	function recurringRevenueLine(inks) {
		const line = filledLine(inks.ramp[0], 'MRR', FIGURES.recurringK.slice(-monthsShown), 0.3);
		return {
			type: 'line',
			data: { labels: FIGURES.yearMonths.slice(-monthsShown), datasets: [line] },
			options: axisOptions(inks, {
				plugins: { tooltip: { callbacks: { label: ({ parsed }) => ` $${parsed.y}k a month` } } },
				scales: { y: { ticks: { callback: (value) => `$${value}k` } } },
			}),
		};
	}

	/* The ring prints the account total and its caption in the hole. */
	function planRing(inks) {
		const accountsTotal = Object.values(FIGURES.seatsByPlan).reduce((sum, seats) => sum + seats, 0);
		const centerTotal = {
			id: 'ringCenter',
			afterDraw(built) {
				const arc = built.getDatasetMeta(0).data[0];
				if (!arc) return;
				const { ctx } = built;
				ctx.save();
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.font = `700 24px ${TYPEFACE}`;
				ctx.fillStyle = inks.ink;
				ctx.fillText(String(accountsTotal), arc.x, arc.y - 8);
				ctx.font = `500 12px ${TYPEFACE}`;
				ctx.fillStyle = inks.soft;
				ctx.fillText('accounts', arc.x, arc.y + 14);
				ctx.restore();
			},
		};
		return {
			type: 'doughnut',
			data: {
				labels: Object.keys(FIGURES.seatsByPlan),
				datasets: [
					{
						data: Object.values(FIGURES.seatsByPlan),
						backgroundColor: inks.ramp.slice(0, 4),
						borderColor: inks.paper,
						borderWidth: 3,
						hoverOffset: 4,
					},
				],
			},
			options: radialOptions(inks, {
				cutout: '70%',
				layout: { padding: 6 },
				plugins: {
					tooltip: {
						callbacks: {
							label: ({ label: plan, parsed }) =>
								` ${plan}: ${parsed} (${Math.round((parsed / accountsTotal) * 100)}%)`,
						},
					},
				},
			}),
			plugins: [centerTotal],
		};
	}

	function healthScatter(inks) {
		const dot = inks.ramp[4];
		return {
			type: 'scatter',
			data: {
				datasets: [
					{
						label: 'Accounts',
						data: usage,
						backgroundColor: translucent(dot, 0.7),
						borderColor: dot,
						borderWidth: 1,
						pointRadius: 4.5,
						pointHoverRadius: 6,
					},
					{
						type: 'line',
						label: 'Trend',
						data: [0, 40].map((x) => ({ x, y: trendAt(x) })),
						borderColor: inks.soft,
						borderDash: [6, 5],
						borderWidth: 1.5,
						pointRadius: 0,
						pointHoverRadius: 0,
					},
				],
			},
			options: axisOptions(inks, {
				interaction: { mode: 'nearest', intersect: true },
				plugins: {
					tooltip: {
						filter: ({ datasetIndex }) => datasetIndex === 0,
						callbacks: {
							title: () => '',
							label: ({ parsed }) => ` ${parsed.x} hours a week, health ${parsed.y}`,
						},
					},
				},
				scales: {
					x: {
						type: 'linear',
						min: 0,
						max: 40,
						ticks: { stepSize: 10 },
						title: axisCaption(inks, 'Active hours a week'),
					},
					y: { min: 0, max: 100, ticks: { stepSize: 25 }, title: axisCaption(inks, 'Health score') },
				},
			}),
		};
	}

	/* Bubble area tracks units sold, so the radius follows its square root. */
	function catalogBubbles(inks) {
		const families = FIGURES.catalog.map(({ family, slot, items }) => ({
			label: family,
			data: items.map(([name, x, y, sold]) => ({ x, y, r: Math.round(Math.sqrt(sold) * 0.75), name, sold })),
			backgroundColor: translucent(inks.ramp[slot], 0.5),
			borderColor: inks.ramp[slot],
			borderWidth: 1.5,
			hoverBorderWidth: 2,
		}));
		return {
			type: 'bubble',
			data: { datasets: families },
			options: axisOptions(inks, {
				interaction: { mode: 'nearest', intersect: true },
				layout: { padding: { top: 10, right: 12 } },
				plugins: {
					tooltip: {
						callbacks: {
							title: ([first]) => first?.raw.name ?? '',
							label: ({ raw }) => ` $${raw.x}, ${raw.y}% margin, ${raw.sold} sold`,
						},
					},
				},
				scales: {
					x: {
						type: 'linear',
						min: 0,
						max: 100,
						ticks: { stepSize: 25, callback: (value) => `$${value}` },
						title: axisCaption(inks, 'Price'),
					},
					y: {
						min: 20,
						max: 80,
						ticks: { stepSize: 20, callback: (value) => `${value}%` },
						title: axisCaption(inks, 'Margin'),
					},
				},
			}),
		};
	}

	/* Bars shade from the first ramp color down into the second, and each
     prints its own value above it in the text color. */
	function shippedBars(inks) {
		const lead = inks.ramp[0];
		const valueLabels = {
			id: 'barTops',
			afterDatasetsDraw(built) {
				const { ctx } = built;
				const figures = built.data.datasets[0].data;
				ctx.save();
				ctx.font = `600 11.5px ${TYPEFACE}`;
				ctx.fillStyle = inks.ink;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'bottom';
				for (const [index, bar] of built.getDatasetMeta(0).data.entries()) {
					ctx.fillText(String(figures[index]), bar.x, bar.y - 6);
				}
				ctx.restore();
			},
		};
		return {
			type: 'bar',
			data: {
				labels: cellInputs.map((input) => input.getAttribute('data-cjs-cell')),
				datasets: [
					{
						label: 'Orders shipped',
						data: cellValues(),
						backgroundColor: verticalWash(lead, blend(inks.ramp[1], lead, 0.75), lead),
						hoverBackgroundColor: blend(lead, inks.ink, 0.85),
						borderRadius: 6,
						maxBarThickness: 48,
					},
				],
			},
			options: axisOptions(inks, {
				layout: { padding: { top: 22 } },
				plugins: { tooltip: { callbacks: { label: ({ parsed }) => ` ${parsed.y} orders` } } },
				scales: { y: { beginAtZero: true, suggestedMax: 600 } },
			}),
			plugins: [valueLabels],
		};
	}

	/* With slices hidden, the tooltip gives each share of what is left. */
	function salesPie(inks) {
		return {
			type: 'pie',
			data: {
				labels: Object.keys(FIGURES.salesPercent),
				datasets: [
					{
						data: Object.values(FIGURES.salesPercent),
						backgroundColor: inks.ramp.slice(0, 4),
						borderColor: inks.paper,
						borderWidth: 2,
						hoverOffset: 4,
					},
				],
			},
			options: radialOptions(inks, {
				layout: { padding: 6 },
				plugins: {
					tooltip: {
						callbacks: {
							label({ chart: owner, dataset, label: group, parsed }) {
								const visibleSum = dataset.data.reduce(
									(sum, value, index) => (owner.getDataVisibility(index) ? sum + value : sum),
									0,
								);
								if (visibleSum === 100) return ` ${group}: ${parsed}%`;
								return ` ${group}: ${Math.round((parsed / visibleSum) * 100)}% of what is shown`;
							},
						},
					},
				},
			}),
		};
	}

	function feedLine(inks) {
		const line = filledLine(inks.ramp[1], 'Orders a minute', [...ticker.readings], 0.35);
		return {
			type: 'line',
			data: { labels: [...ticker.stamps], datasets: [line] },
			options: axisOptions(inks, {
				animation: calmMotion ? false : { duration: 450, easing: 'easeOutQuad' },
				plugins: { tooltip: { callbacks: { label: ({ parsed }) => ` ${parsed.y} orders a minute` } } },
				scales: {
					x: { ticks: { maxTicksLimit: 4 } },
					y: { min: 0, suggestedMax: 20, ticks: { stepSize: 5 } },
				},
			}),
		};
	}

	/* Only the top segment of each column gets rounded corners; hovering
     shows the HTML tooltip instead of the canvas one. */
	function trafficStack(inks, plot) {
		const bubble = tooltipBox(plot.parentElement);
		const topIndex = FIGURES.trafficSources.length - 1;
		return {
			type: 'bar',
			data: {
				labels: FIGURES.weekdays,
				datasets: FIGURES.trafficSources.map(({ source, slot, daily }, index) => {
					const onTop = index === topIndex;
					return {
						label: source,
						data: daily,
						backgroundColor: inks.ramp[slot],
						borderColor: inks.paper,
						borderWidth: { top: onTop ? 0 : 1 },
						borderSkipped: 'bottom',
						borderRadius: onTop ? { topLeft: 5, topRight: 5 } : 0,
						maxBarThickness: 40,
						/* Colors this source's dot in the HTML tooltip. */
						tipClass: `cjs-c${slot + 1}`,
					};
				}),
			},
			options: axisOptions(inks, {
				plugins: {
					tooltip: {
						enabled: false,
						external: ({ chart: owner, tooltip }) => placeTooltip(owner, tooltip, bubble),
					},
				},
				scales: {
					x: { stacked: true },
					y: { stacked: true, ticks: { callback: (value) => (value >= 1000 ? `${value / 1000}k` : value) } },
				},
			}),
		};
	}

	function skillsRadar(inks) {
		const now = inks.ramp[2];
		return {
			type: 'radar',
			data: {
				labels: FIGURES.skills,
				datasets: [
					{
						label: 'This quarter',
						data: FIGURES.scoresThisQuarter,
						backgroundColor: translucent(now, 0.2),
						borderColor: now,
						borderWidth: 2,
						pointBackgroundColor: now,
						pointRadius: 3,
					},
					{
						label: 'Last quarter',
						data: FIGURES.scoresLastQuarter,
						backgroundColor: 'transparent',
						borderColor: inks.soft,
						borderDash: [5, 4],
						borderWidth: 1.5,
						pointBackgroundColor: inks.soft,
						pointRadius: 0,
						pointHoverRadius: 3,
					},
				],
			},
			options: radialOptions(inks, {
				interaction: { mode: 'index', intersect: false },
				scales: {
					r: {
						suggestedMin: 50,
						suggestedMax: 100,
						grid: { color: inks.rule },
						angleLines: { color: inks.rule },
						pointLabels: { color: inks.soft, font: AXIS_FONT },
						ticks: { display: false, stepSize: 10 },
					},
				},
			}),
		};
	}

	function plansArea(inks) {
		return {
			type: 'line',
			data: {
				labels: FIGURES.yearMonths,
				datasets: [filledLine(inks.ramp[7], 'New plans', FIGURES.plansStarted, 0.4)],
			},
			options: axisOptions(inks, {
				plugins: { tooltip: { callbacks: { label: ({ parsed }) => ` ${parsed.y} new plans` } } },
				scales: { y: { beginAtZero: true, suggestedMax: 35 } },
			}),
		};
	}

	/* A bare line with no axes or tooltip; only the latest week gets a dot. */
	function trendSpark(inks, plot) {
		const { weeks, slot } =
			FIGURES.weeklyTrends[plot.getAttribute('data-cjs-spark')] || FIGURES.weeklyTrends.reviews;
		const hue = inks.ramp[slot];
		const finalWeek = weeks.length - 1;
		return {
			type: 'line',
			data: {
				labels: weeks.map((_, week) => week),
				datasets: [
					{
						data: weeks,
						tension: 0.35,
						fill: 'start',
						borderColor: hue,
						backgroundColor: fadingFill(hue),
						pointBackgroundColor: hue,
						pointBorderWidth: 0,
						pointRadius: ({ dataIndex }) => (dataIndex === finalWeek ? 3 : 0),
					},
				],
			},
			options: axisOptions(inks, {
				layout: { padding: { top: 4, right: 4, bottom: 2, left: 2 } },
				plugins: { tooltip: { enabled: false } },
				scales: { x: { display: false }, y: { display: false } },
			}),
		};
	}

	function headcountPolar(inks) {
		return {
			type: 'polarArea',
			data: {
				labels: Object.keys(FIGURES.peopleByTeam),
				datasets: [
					{
						data: Object.values(FIGURES.peopleByTeam),
						backgroundColor: inks.ramp.slice(0, 6).map((hue) => translucent(hue, 0.75)),
						borderColor: inks.paper,
						borderWidth: 2,
					},
				],
			},
			options: radialOptions(inks, {
				layout: { padding: 4 },
				plugins: {
					tooltip: { callbacks: { label: ({ label: team, parsed }) => ` ${team}: ${parsed.r} people` } },
				},
				scales: {
					r: {
						beginAtZero: true,
						grid: { color: inks.rule },
						ticks: { display: false, stepSize: 3 },
					},
				},
			}),
		};
	}

	/* The repeat-order line is drawn over the bars by giving it the lower order. */
	function ordersCombo(inks) {
		const column = inks.ramp[0];
		const trace = inks.ramp[4];
		return {
			type: 'bar',
			data: {
				labels: FIGURES.lastSixMonths,
				datasets: [
					{
						type: 'line',
						order: 0,
						label: 'Repeat orders',
						data: FIGURES.returningOrders,
						tension: 0.3,
						backgroundColor: trace,
						borderColor: trace,
						pointBackgroundColor: trace,
						pointBorderColor: inks.paper,
						pointBorderWidth: 2,
						pointRadius: 4,
					},
					{
						type: 'bar',
						order: 1,
						label: 'All orders',
						data: FIGURES.allOrders,
						backgroundColor: translucent(column, 0.85),
						hoverBackgroundColor: column,
						borderRadius: 5,
						maxBarThickness: 36,
					},
				],
			},
			options: axisOptions(inks, { scales: { y: { beginAtZero: true, suggestedMax: 600 } } }),
		};
	}

	/* Labels go into innerHTML, so the four markup characters are escaped first. */
	function htmlSafe(value) {
		return String(value).replace(/[&<>"]/g, (character) => ESCAPES[character]);
	}

	/* Finds or adds the tooltip element inside the chart's box, hidden for now. */
	function tooltipBox(holder) {
		let bubble = pick('.cjs-tip', holder);
		if (!bubble) {
			bubble = document.createElement('div');
			bubble.setAttribute('aria-hidden', 'true');
			bubble.className = 'cjs-tip';
			holder.appendChild(bubble);
		}
		bubble.classList.remove('is-on');
		return bubble;
	}

	/**
	 * Fills the HTML tooltip for the hovered day, topmost channel first, and
	 * sets it beside the column on whichever side has room inside the box.
	 */
	function placeTooltip(owner, tooltip, bubble) {
		const day = tooltip.dataPoints?.[0]?.dataIndex;
		if (!tooltip.opacity || day === undefined) {
			bubble.classList.remove('is-on');
			return;
		}
		const layers = owner.data.datasets;
		const dayTotal = layers.reduce((sum, layer) => sum + layer.data[day], 0);
		let rows = '';
		for (const layer of [...layers].reverse()) {
			const visits = layer.data[day];
			rows +=
				`<li class="${layer.tipClass}"><span class="cjs-key-dot"></span><span>${htmlSafe(layer.label)}</span>` +
				`<span class="cjs-tip-num">${visits.toLocaleString()}</span>` +
				`<span class="cjs-tip-share">${Math.round((visits / dayTotal) * 100)}%</span></li>`;
		}
		bubble.innerHTML =
			`<p class="cjs-tip-title"><span>${htmlSafe(owner.data.labels[day])}</span>` +
			`<span>${dayTotal.toLocaleString()}</span></p><ul class="cjs-tip-rows">${rows}</ul>`;

		const holderBox = owner.canvas.parentElement;
		const spaceX = holderBox.clientWidth - bubble.offsetWidth;
		const spaceY = holderBox.clientHeight - bubble.offsetHeight;
		const offset = 14;
		const rightSide = tooltip.caretX + offset;
		const preferred =
			rightSide + bubble.offsetWidth > holderBox.clientWidth
				? tooltip.caretX - offset - bubble.offsetWidth
				: rightSide;
		const left = Math.max(0, Math.min(preferred, spaceX));
		const top = Math.max(0, Math.min(tooltip.caretY - bubble.offsetHeight / 2, spaceY));
		bubble.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
		bubble.classList.add('is-on');
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
