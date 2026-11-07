/**
 * Draws the thirteen cards on the advanced charts page (apex-charts.html)
 * with stock Chart.js and a few small canvas plugins of its own. Every
 * color is looked up from the --basalt-* tokens when a chart is drawn, and
 * a basalt:appearance redraws all of them, so the palette, light or dark
 * mode, the background choice and Flat mode all carry onto the canvases.
 */
(() => {
	'use strict';

	const view = pick('[data-advanced-root]');
	if (!view || typeof Chart === 'undefined') return;

	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const TYPEFACE = "'Schibsted Grotesk', sans-serif";

	/* The shop the other chart pages describe: 503 orders out of 9,030
     sessions in one week, and $119k of store revenue for September. */
	const DAY_TICKS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
	const CLOCK = Array.from({ length: 24 }, (_, hour) => hour);

	/* Weekdays peak at lunch and again after work; weekends start late and
     stay busy through the afternoon. */
	const WEEK_ORDERS = [62, 68, 71, 75, 86, 70, 71];
	const WORKDAY_CURVE = [1, 0.5, 0, 0, 0, 0.5, 1, 3, 5, 6, 6, 7, 10, 9, 6, 5, 5, 6, 8, 11, 10, 6, 3, 1.5];
	const WEEKEND_CURVE = [1.5, 1, 0.5, 0, 0, 0, 0.5, 1, 3, 6, 8, 10, 10, 9, 8, 7, 6, 5, 6, 7, 6, 4, 2.5, 1.5];
	const hourlyOrders = WEEK_ORDERS.map((dayTotal, dayIndex) => apportion(dayTotal, curveFor(dayIndex)));
	const busiestCell = Math.max(...hourlyOrders.flat());
	/* Friday has 1,577 sessions, and people start browsing before they buy. */
	const fridayVisits = apportion(
		1577,
		[8, 5, 3, 2, 2, 4, 10, 22, 38, 48, 52, 58, 72, 70, 60, 55, 56, 62, 80, 96, 92, 70, 44, 22],
	);

	const GOALS = [
		{ actual: 119, goal: 125, poorUpTo: 100, fairUpTo: 118.75, scale: 150, hue: 0 },
		{ actual: 2698, goal: 2600, poorUpTo: 2080, fairUpTo: 2470, scale: 3000, hue: 2 },
		{ actual: 44.1, goal: 45, poorUpTo: 36, fairUpTo: 42.75, scale: 54, hue: 7 },
		{ actual: 91, goal: 95, poorUpTo: 85, fairUpTo: 93, scale: 100, hue: 1 },
	];

	const BRIDGE = [
		{ name: 'August', tick: 'Aug', start: 0, end: 104, sum: true },
		{ name: ['New', 'customers'], tick: 'New', start: 104, end: 122.2 },
		{ name: ['More', 'subscribers'], tick: 'Subs', start: 122.2, end: 128.6 },
		{ name: ['Price', 'change'], tick: 'Price', start: 128.6, end: 131.7 },
		{ name: 'Refunds', tick: 'Refund', start: 131.7, end: 127.4 },
		{ name: ['Lost', 'customers'], tick: 'Lost', start: 127.4, end: 119 },
		{ name: 'September', tick: 'Sep', start: 0, end: 119, sum: true },
	];

	const REGIONS = [
		{
			name: 'Northeast',
			tick: 'Northeast',
			phrase: 'the Northeast',
			accounts: [
				{ client: 'Yarrow Health', ref: '#01042', acv: 86400 },
				{ client: 'Tandem Services', ref: '#01197', acv: 61200 },
				{ client: 'Arbor Retail Group', ref: '#01358', acv: 47880 },
				{ client: 'Juniper Retail', ref: '#01566', acv: 34560 },
			],
		},
		{
			name: 'Midwest',
			tick: 'Midwest',
			phrase: 'the Midwest',
			accounts: [
				{ client: 'Umber Media', ref: '#01084', acv: 72720 },
				{ client: 'Sorrel Instruments', ref: '#01233', acv: 58320 },
				{ client: 'Reed Analytics', ref: '#01470', acv: 44640 },
				{ client: 'Vellum Studios', ref: '#01612', acv: 31680 },
			],
		},
		{
			name: 'West',
			tick: 'West',
			phrase: 'the West',
			accounts: [
				{ client: 'Calder Logistics', ref: '#01126', acv: 93600 },
				{ client: 'Selkirk Freight', ref: '#01305', acv: 39960 },
				{ client: 'Oriel Education', ref: '#01688', acv: 27720 },
			],
		},
		{
			name: 'South',
			tick: 'South',
			phrase: 'the South',
			accounts: [
				{ client: 'Pike Insurance', ref: '#01159', acv: 68040 },
				{ client: 'Harrow Energy', ref: '#01421', acv: 41040 },
				{ client: 'Fathom Software', ref: '#01734', acv: 22680 },
			],
		},
	];
	const regionSums = REGIONS.map(({ accounts }) => accounts.reduce((sum, account) => sum + account.acv, 0));

	const checkoutDays = daysEndingToday(18);
	const FAILED_CHECKOUTS = [84, 80, 94, 90, 83, 75, 79, 66, 74, 70, 53, 66, 57, 44, 56, 53, 47, 43];
	const MILESTONES = [
		{ at: 3, note: 'Release 5.1' },
		{ at: 7, note: 'Card gateway outage' },
		{ at: 11, note: 'Bot filter turned on' },
		{ at: 15, note: 'New checkout released' },
	];

	const STAGES = [
		{ stage: 'Sessions', people: 9030 },
		{ stage: 'Viewed a product', people: 5418 },
		{ stage: 'Added to basket', people: 1626 },
		{ stage: 'Started checkout', people: 812 },
		{ stage: 'Ordered', people: 503 },
	];

	const MONTH_TICKS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
	const PLANS = [
		{ plan: 'Basic', orders: [330, 366, 415, 294, 381, 383, 303, 377, 426] },
		{ plan: 'Pro', orders: [177, 197, 220, 162, 192, 216, 182, 209, 223] },
		{ plan: 'Max', orders: [92, 106, 113, 133, 132, 130, 139, 132, 121] },
		{ plan: 'Add-ons', orders: [125, 118, 118, 153, 145, 138, 151, 200, 207] },
	];

	const COHORTS = [
		{ month: 'Mar', joined: 388, kept: [44, 36, 33, 30, 28, 27] },
		{ month: 'Apr', joined: 412, kept: [46, 38, 34, 31, 29] },
		{ month: 'May', joined: 386, kept: [48, 39, 35, 33] },
		{ month: 'Jun', joined: 431, kept: [51, 42, 38] },
		{ month: 'Jul', joined: 468, kept: [53, 45] },
		{ month: 'Aug', joined: 452, kept: [55] },
	];

	/* Checkout response times over 45 days: a slow rise and fall with a
     little day-to-day jitter on top. */
	const latencyDays = daysEndingToday(45);
	const latencies = latencyDays.map((_, day) => Math.round(112 + 36 * Math.sin(day / 7) + ((day * 37) % 23)));
	const LAST_DAY = latencyDays.length - 1;

	/* Twenty-six weeks of daily orders that end on today; the grid starts on
     a Monday, so the days still ahead this week are left blank. */
	const GRID_WEEKS = 26;
	const ORDER_STEPS = [56, 68, 80, 94];
	const STEP_SHARES = [0.12, 0.32, 0.54, 0.76, 1];
	const DAY_LIFT = [0.88, 0.95, 0.99, 1.04, 1.2, 0.97, 0.97];
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const gridStart = new Date(today);
	gridStart.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (GRID_WEEKS - 1) * 7);
	const orderGrid = Array.from({ length: GRID_WEEKS }, (_, week) =>
		DAY_TICKS.map((_, weekday) => gridDay(week, weekday)),
	);
	const monthTicks = monthStarts();

	/* The live load chart opens on a soft wave and drifts from there. */
	const readings = Array.from({ length: 24 }, (_, second) =>
		Math.round(38 + 12 * Math.sin(second / 3) + ((second * 29) % 9)),
	);
	const secondTicks = readings.map((_, second) => (second === 23 ? 'Now' : `${second - 23}s`));

	const WEEKLY_BOXES = [88, 90, 97, 96, 90, 92, 104, 102, 96, 102, 103, 113, 121, 124, 123, 134];

	/* What the visitor has picked so far, shared by the charts and controls. */
	const state = {
		region: 0,
		plan: 0,
		from: 0,
		to: LAST_DAY,
		streaming: !calmMotion,
		streamVisible: false,
	};
	const drawn = new Map();

	const RECIPES = {
		bullet: goalRecipe,
		heatmap: hourGridRecipe,
		plugin: latestPointRecipe,
		waterfall: bridgeRecipe,
		drill: regionRecipe,
		events: milestoneRecipe,
		live: streamRecipe,
		calendar: dayGridRecipe,
		funnel: stageRecipe,
		dynamic: planRecipe,
		zoom: latencyRecipe,
		sync: twinRecipe,
	};

	const retentionBody = pick('[data-advanced-cohort-body]', view);
	const regionButtons = [...pickAll('[data-advanced-region]', view)];
	const accountBody = pick('[data-advanced-drill-body]', view);
	const accountCaption = pick('[data-advanced-drill-caption]', view);
	const planButtons = [...pickAll('[data-advanced-category]', view)];
	const streamCanvas = pick('[data-advanced-chart="live"]', view);
	const streamToggle = pick('[data-advanced-live-toggle]', view);
	const streamStatus = pick('[data-advanced-live-status]', view);
	const streamLabel = pick('[data-advanced-live-label]', view);
	const latencyCanvas = pick('[data-advanced-chart="zoom"]', view);
	const latencyRange = pick('[data-advanced-zoom-range]', view);

	/** Draws each chart once it comes near the screen and wires every control. */
	function start() {
		drawWhenSeen();
		paintRetention();
		document.addEventListener('basalt:appearance', redrawAll);
		wireRegions();
		wirePlans();
		wireStream();
		wireLatencyZoom();
		wireTwins();
		wireChips();
	}

	/* Drawing, and redrawing when the theme moves. */

	function drawWhenSeen() {
		const canvases = [...pickAll('canvas[data-advanced-chart]', view)];
		const retention = pick('[data-advanced-cohort]', view);
		const canObserve = 'IntersectionObserver' in window;

		if (canObserve) {
			const sentry = new IntersectionObserver(
				(entries) => {
					for (const { isIntersecting, target } of entries) {
						if (!isIntersecting) continue;
						sentry.unobserve(target);
						if (target === retention) retention.classList.add('is-drawn');
						else draw(target, true);
					}
				},
				{ rootMargin: '80px 0px' },
			);
			for (const canvas of canvases) sentry.observe(canvas);
			if (retention && !calmMotion) sentry.observe(retention);
		} else {
			for (const canvas of canvases) draw(canvas, false);
		}

		if (retention && (calmMotion || !canObserve)) retention.classList.add('is-drawn');
	}

	/** Builds (or rebuilds) the chart its data-advanced-chart name asks for. */
	function draw(canvas, animate) {
		const recipe = RECIPES[canvas.getAttribute('data-advanced-chart')];
		if (!recipe) return;
		drawn.get(canvas)?.destroy();
		drawn.set(canvas, new Chart(canvas, recipe(readPalette(), animate && !calmMotion, canvas)));
	}

	function chartNamed(name) {
		const canvas = pick(`[data-advanced-chart="${name}"]`, view);
		return canvas ? drawn.get(canvas) : null;
	}

	/* The theme attribute is already swapped when the event fires, so wait a
     frame and the tokens read back with their new values. */
	function redrawAll() {
		requestAnimationFrame(() => {
			for (const canvas of drawn.keys()) draw(canvas, false);
			paintRetention();
		});
	}

	/* Region drill-down: the bar chart and the account table move together. */

	function wireRegions() {
		for (const button of regionButtons) {
			button.addEventListener('click', () => pickRegion(Number(button.getAttribute('data-advanced-region'))));
		}

		const canvas = pick('[data-advanced-chart="drill"]', view);
		canvas?.addEventListener('click', (event) => {
			const chart = drawn.get(canvas);
			if (!chart) return;
			const [bar] = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
			if (bar) pickRegion(bar.index);
		});

		pickRegion(state.region);
	}

	function pickRegion(index) {
		state.region = index;
		for (const button of regionButtons) {
			button.setAttribute('aria-pressed', String(Number(button.getAttribute('data-advanced-region')) === index));
		}

		const { phrase, accounts } = REGIONS[index];
		if (accountCaption) accountCaption.textContent = `Accounts in ${phrase}`;
		accountBody?.replaceChildren(...accounts.map(accountRow));

		const chart = chartNamed('drill');
		if (!chart) return;
		const tones = regionTones(readPalette());
		Object.assign(chart.data.datasets[0], { backgroundColor: tones, hoverBackgroundColor: tones });
		chart.update(calmMotion ? 'none' : undefined);
	}

	function accountRow({ client, ref, acv }) {
		const row = document.createElement('tr');
		row.append(textCell(client), textCell(ref), textCell(`$${acv.toLocaleString()}`, 'text-end'));
		return row;
	}

	function textCell(text, className) {
		const cell = document.createElement('td');
		if (className) cell.className = className;
		cell.textContent = text;
		return cell;
	}

	/** The picked region keeps the full first ramp color; the rest fade back. */
	function regionTones(look) {
		return REGIONS.map((_, index) =>
			index === state.region ? look.ramp[0] : blend(look.ramp[0], look.paper, 0.38),
		);
	}

	/* Plan picker: one line chart whose data and color follow the pick. */

	function wirePlans() {
		for (const button of planButtons) button.addEventListener('click', () => choosePlan(button));
	}

	function choosePlan(picked) {
		state.plan = Number(picked.getAttribute('data-advanced-category'));
		for (const button of planButtons) button.setAttribute('aria-pressed', String(button === picked));

		const chart = chartNamed('dynamic');
		if (!chart) return;
		const color = readPalette().ramp[state.plan];
		const { plan, orders } = PLANS[state.plan];
		Object.assign(chart.data.datasets[0], {
			label: plan,
			data: orders.slice(),
			borderColor: color,
			pointBackgroundColor: color,
			pointHoverBackgroundColor: color,
			backgroundColor: fadingFill(color),
		});
		chart.update(calmMotion ? 'none' : undefined);
	}

	/* Live load: a reading a second, held while paused, off screen or in a
     background tab. Visitors who prefer less motion start paused. */

	function wireStream() {
		setStreaming(state.streaming);
		streamToggle?.addEventListener('click', () => setStreaming(!state.streaming));

		if (streamCanvas && 'IntersectionObserver' in window) {
			new IntersectionObserver(([entry]) => {
				state.streamVisible = entry.isIntersecting;
			}).observe(streamCanvas);
		} else {
			state.streamVisible = true;
		}

		window.setInterval(nextReading, 1000);
	}

	function setStreaming(running) {
		state.streaming = running;
		if (streamToggle) streamToggle.textContent = running ? 'Pause' : 'Resume';
		if (streamLabel) streamLabel.textContent = running ? 'Streaming' : 'Paused';
		streamStatus?.classList.toggle('is-paused', !running);
	}

	function nextReading() {
		if (!state.streaming || !state.streamVisible || document.hidden) return;
		const chart = streamCanvas && drawn.get(streamCanvas);
		if (!chart) return;
		const drift = (Math.random() - 0.5) * 16;
		readings.push(Math.round(clamp(readings[readings.length - 1] + drift, 12, 88)));
		readings.shift();
		chart.data.datasets[0].data = readings.slice();
		chart.update('none');
	}

	/* Latency zoom: buttons, Ctrl + wheel (or a pinch) and a sideways drag
     all move the same window of days. */

	function wireLatencyZoom() {
		for (const button of pickAll('[data-advanced-zoom]', view)) {
			button.addEventListener('click', () => {
				const action = button.getAttribute('data-advanced-zoom');
				if (action === 'reset') {
					state.from = 0;
					state.to = LAST_DAY;
					showWindow();
					return;
				}
				stepZoom(action === 'in' ? 1 : -1);
			});
		}
		if (latencyCanvas) wirePan(latencyCanvas);
		showWindow();
	}

	/* An ordinary wheel still scrolls the page; only Ctrl + wheel zooms. */
	function wirePan(canvas) {
		let grip = null;

		canvas.addEventListener(
			'wheel',
			(event) => {
				if (!event.ctrlKey) return;
				event.preventDefault();
				stepZoom(event.deltaY < 0 ? 1 : -1);
			},
			{ passive: false },
		);

		canvas.addEventListener('pointerdown', (event) => {
			const chart = drawn.get(canvas);
			const shown = state.to - state.from;
			if (!chart || shown >= LAST_DAY) return;
			grip = { startX: event.clientX, from: state.from, to: state.to, perDay: chart.chartArea.width / shown };
			canvas.setPointerCapture(event.pointerId);
			canvas.classList.add('is-dragging');
		});

		canvas.addEventListener('pointermove', (event) => {
			if (!grip) return;
			const moved = clamp(
				Math.round((grip.startX - event.clientX) / grip.perDay),
				-grip.from,
				LAST_DAY - grip.to,
			);
			if (grip.from + moved === state.from) return;
			state.from = grip.from + moved;
			state.to = grip.to + moved;
			showWindow();
		});

		function release() {
			grip = null;
			canvas.classList.remove('is-dragging');
		}
		canvas.addEventListener('pointerup', release);
		canvas.addEventListener('pointercancel', release);
	}

	/** Narrows the window by 15% (never under a week) or widens it by 20%. */
	function stepZoom(direction) {
		const shown = state.to - state.from;
		if (direction < 0) {
			const grow = Math.max(2, Math.round(shown * 0.2));
			state.from = Math.max(0, state.from - grow);
			state.to = Math.min(LAST_DAY, state.to + grow);
		} else {
			if (shown <= 6) return;
			const trim = Math.max(1, Math.round(shown * 0.15));
			state.from += trim;
			state.to -= trim;
		}
		showWindow();
	}

	function showWindow() {
		const { from, to } = state;
		if (latencyRange) {
			latencyRange.textContent =
				to - from >= LAST_DAY
					? 'All 45 days'
					: `${shortDate(latencyDays[from])} to ${shortDate(latencyDays[to])}`;
		}
		const chart = latencyCanvas && drawn.get(latencyCanvas);
		if (!chart) return;
		Object.assign(chart.options.scales.x, { min: from, max: to });
		chart.update('none');
	}

	/* Twin charts: hovering an hour on one opens the same hour on the other. */

	function wireTwins() {
		const twins = [...pickAll('[data-advanced-chart="sync"]', view)];
		for (const canvas of twins) {
			const partner = twins.find((other) => other !== canvas);
			if (!partner) continue;
			canvas.addEventListener('pointermove', (event) => {
				const source = drawn.get(canvas);
				const mirror = drawn.get(partner);
				if (!source || !mirror) return;
				const [point] = source.getElementsAtEventForMode(event, 'index', { intersect: false }, true);
				if (point) highlight(mirror, [{ datasetIndex: 0, index: point.index }]);
			});
			canvas.addEventListener('pointerleave', () => {
				const mirror = drawn.get(partner);
				if (mirror) highlight(mirror, []);
			});
		}
	}

	function highlight(chart, active) {
		chart.setActiveElements(active);
		chart.tooltip.setActiveElements(active, { x: 0, y: 0 });
		chart.update('none');
	}

	/* Filter chips: one per kind of chart, plus "all". */

	function wireChips() {
		const board = pick('[data-advanced-grid]', view);
		const cards = [...pickAll('.advanced-card', board)];
		const counter = pick('[data-advanced-count]', view);
		const chips = [...pickAll('[data-advanced-filter]', view)];

		for (const chip of chips) {
			chip.addEventListener('click', () => {
				for (const other of chips) other.setAttribute('aria-pressed', String(other === chip));
				showKind(chip.getAttribute('data-advanced-filter'));
			});
		}

		function showKind(kind) {
			const everything = kind === 'all';
			const kept = cards.filter((card) => everything || card.getAttribute('data-advanced-kind') === kind);
			for (const card of cards) {
				card.classList.toggle('is-hidden', !kept.includes(card));
				card.classList.remove('is-alone');
			}
			board.classList.toggle('is-filtered', !everything);

			/* Half-width cards pair up in a filtered view; a leftover one takes
         the whole row. */
			const halves = everything ? [] : kept.filter((card) => !card.classList.contains('advanced-card-full'));
			if (halves.length % 2) halves[halves.length - 1].classList.add('is-alone');

			if (counter) counter.textContent = `${kept.length} ${kept.length === 1 ? 'chart' : 'charts'}`;
		}
	}

	/* Cohort retention table, painted as HTML rather than on a canvas. */

	function paintRetention() {
		if (!retentionBody) return;
		const look = readPalette();
		const columns = COHORTS[0].kept.length;
		const rows = COHORTS.map(({ month, joined, kept }, rowIndex) => {
			const heading = document.createElement('th');
			heading.scope = 'row';
			const note = document.createElement('span');
			note.className = 'advanced-cohort-count';
			note.textContent = `${joined} new`;
			heading.append(month, note);

			const row = document.createElement('tr');
			row.append(heading);
			for (let column = 0; column < columns; column += 1) {
				row.append(retentionCell(look, kept[column], rowIndex + column));
			}
			return row;
		});
		retentionBody.replaceChildren(...rows);
	}

	/** One retention cell; `step` staggers its fade-in along the diagonal. */
	function retentionCell(look, percent, step) {
		const cell = document.createElement('td');
		if (percent === undefined) return cell;
		const { fill, ink } = legibleTint(look, percent);
		cell.style.backgroundColor = fill;
		cell.style.color = ink;
		cell.style.setProperty('--advanced-i', String(step));
		cell.textContent = `${percent}%`;
		return cell;
	}

	/**
	 * A higher share gets a deeper tint, written in whichever of the text or
	 * surface color reads better on it. While neither reaches 4.5:1 the tint
	 * steps back toward the surface.
	 */
	function legibleTint(look, percent) {
		let depth = 0.12 + 0.88 * clamp((percent - 24) / 34, 0, 1);
		let pair = inkOn(look, blend(look.ramp[7], look.paper, depth));
		while (contrastRatio(pair.ink, pair.fill) < 4.5 && depth > 0.1) {
			depth -= 0.04;
			pair = inkOn(look, blend(look.ramp[7], look.paper, depth));
		}
		return pair;
	}

	function inkOn(look, fill) {
		const ink = contrastRatio(look.ink, fill) >= contrastRatio(look.paper, fill) ? look.ink : look.paper;
		return { fill, ink };
	}

	/* Chart recipes. Each takes the palette, whether to animate and its
     canvas, and returns a Chart.js config. */

	/* A goal tile. CSS draws the poor, fair and good bands as one rounded
     track behind the canvas; the chart adds the bar and the target tick. */
	function goalRecipe(look, animate, canvas) {
		const slot = Number(canvas.getAttribute('data-advanced-bullet')) || 0;
		const { actual, goal, poorUpTo, fairUpTo, scale, hue } = GOALS[slot] || GOALS[0];
		const along = (amount) => `${((amount / scale) * 100).toFixed(2)}%`;
		canvas.parentElement.style.setProperty('--advanced-band-1', along(poorUpTo));
		canvas.parentElement.style.setProperty('--advanced-band-2', along(fairUpTo));

		const targetTick = {
			id: 'goalTick',
			afterDatasetsDraw({ ctx, chartArea, scales }) {
				const x = Math.round(scales.x.getPixelForValue(goal));
				ctx.save();
				Object.assign(ctx, { strokeStyle: look.ink, lineWidth: 3, lineCap: 'round' });
				ctx.beginPath();
				ctx.moveTo(x, chartArea.top + 2);
				ctx.lineTo(x, chartArea.bottom - 2);
				ctx.stroke();
				ctx.restore();
			},
		};

		const bar = {
			data: [actual],
			backgroundColor: look.ramp[hue],
			barPercentage: 0.34,
			categoryPercentage: 1,
			borderRadius: 999,
			borderSkipped: false,
		};
		return {
			type: 'bar',
			data: { labels: [''], datasets: [bar] },
			options: chartOptions(look, animate, {
				indexAxis: 'y',
				layout: { padding: 0 },
				animation: animate ? { duration: 500, easing: 'easeOutQuart', delay: 150 } : false,
				plugins: { tooltip: { enabled: false } },
				scales: { y: { display: false }, x: { display: false, min: 0, max: scale } },
			}),
			plugins: [targetTick],
		};
	}

	/* Orders by weekday and hour: 24 stacked one-unit bars per row, each
     tinted by how many orders fell in that hour. */
	function hourGridRecipe(look, animate) {
		const shadeFor = (count) =>
			blend(look.ramp[0], look.paper, count === 0 ? 0.05 : 0.12 + 0.88 * (count / busiestCell));
		const columnFor = (hour) => {
			const shades = DAY_TICKS.map((_, day) => shadeFor(hourlyOrders[day][hour]));
			return {
				label: clock(hour),
				data: DAY_TICKS.map(() => 1),
				backgroundColor: shades,
				hoverBackgroundColor: DAY_TICKS.map((_, day) => shadeFor(hourlyOrders[day][hour])),
				borderColor: look.paper,
				hoverBorderColor: look.ink,
				borderWidth: 1.5,
				hoverBorderWidth: 2,
				borderRadius: 4,
				borderSkipped: false,
				barPercentage: 1,
				categoryPercentage: 1,
			};
		};

		return {
			type: 'bar',
			data: { labels: DAY_TICKS, datasets: CLOCK.map(columnFor) },
			options: chartOptions(look, false, {
				indexAxis: 'y',
				interaction: { mode: 'nearest', intersect: true },
				layout: { padding: { top: 0, right: 4 } },
				...cellReveal(animate, look, 500, 22),
				plugins: {
					tooltip: {
						usePointStyle: false,
						displayColors: false,
						callbacks: {
							title: ([first]) => `${DAY_NAMES[first.dataIndex]}, ${clock(first.datasetIndex)}`,
							label: ({ dataIndex, datasetIndex }) => {
								const count = hourlyOrders[dataIndex][datasetIndex];
								return ` ${count} ${count === 1 ? 'order' : 'orders'}`;
							},
						},
					},
				},
				scales: {
					y: { stacked: true, grid: { display: false }, ticks: { autoSkip: false } },
					x: { stacked: true, min: 0, max: 24, ticks: { stepSize: 3, callback: (value) => clock(value) } },
				},
			}),
		};
	}

	/* Weekly boxes shipped, with a custom plugin that rings the newest point
     and pins a label above it. */
	function latestPointRecipe(look, animate) {
		const color = look.ramp[2];
		const newest = WEEKLY_BOXES[WEEKLY_BOXES.length - 1];
		const ringNewest = {
			id: 'newestRing',
			afterDatasetsDraw(chart) {
				const point = chart.getDatasetMeta(0).data.at(-1);
				if (!point) return;
				const { ctx, chartArea } = chart;
				ctx.save();
				ctx.fillStyle = tint(color, 0.2);
				ctx.beginPath();
				ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
				ctx.fill();
				Object.assign(ctx, { fillStyle: color, strokeStyle: look.paper, lineWidth: 2 });
				ctx.beginPath();
				ctx.arc(point.x, point.y, 4.5, 0, Math.PI * 2);
				ctx.fill();
				ctx.stroke();
				ctx.restore();
				drawTag(ctx, look, point.x, point.y - 16, `This week · ${newest}`, chartArea.left, chartArea.right + 8);
			},
		};

		return {
			type: 'line',
			data: {
				labels: WEEKLY_BOXES.map((_, week) => `Week ${week + 23}`),
				datasets: [
					lineSeries(color, {
						label: 'Boxes',
						data: WEEKLY_BOXES,
						fill: 'start',
						backgroundColor: fadingFill(color),
						tension: 0.35,
					}),
				],
			},
			options: chartOptions(look, animate, {
				layout: { padding: { top: 34, right: 10 } },
				scales: {
					y: { suggestedMin: 60 },
					x: { ticks: { maxTicksLimit: 4, callback: (_, week) => `Wk ${week + 23}` } },
				},
			}),
			plugins: [ringNewest],
		};
	}

	/* August to September revenue as a bridge: floating bars for each change,
     dashed steps between them and the change written over each bar. Narrow
     cards switch to one-word ticks and bare figures so labels never touch. */
	function bridgeRecipe(look, animate) {
		const cramped = (chart) => chart.width < 480;
		const rise = ({ start, end }) => end >= start;
		const thousands = (amount) => `$${Math.round(amount * 10) / 10}k`;
		const fullNote = (step) =>
			step.sum ? thousands(step.end) : `${rise(step) ? '+' : '−'}${thousands(Math.abs(step.end - step.start))}`;
		const shortNote = (step) =>
			step.sum
				? String(step.end)
				: `${rise(step) ? '+' : '−'}${Math.round(Math.abs(step.end - step.start) * 10) / 10}`;
		const tones = BRIDGE.map((step) => {
			if (step.sum) return look.faint;
			return rise(step) ? look.gain : look.loss;
		});

		const connectors = {
			id: 'bridgeSteps',
			afterDatasetsDraw(chart) {
				const {
					ctx,
					scales: { y },
				} = chart;
				const bars = chart.getDatasetMeta(0).data;
				const small = cramped(chart);
				ctx.save();
				Object.assign(ctx, { strokeStyle: look.faint, globalAlpha: 0.55, lineWidth: 1 });
				ctx.setLineDash([3, 3]);
				for (let index = 0; index < bars.length - 1; index += 1) {
					const [left, right] = [bars[index], bars[index + 1]];
					const level = y.getPixelForValue(BRIDGE[index].end);
					ctx.beginPath();
					ctx.moveTo(left.x + left.width / 2, level);
					ctx.lineTo(right.x - right.width / 2, level);
					ctx.stroke();
				}
				ctx.setLineDash([]);
				Object.assign(ctx, {
					globalAlpha: 1,
					fillStyle: look.ink,
					font: `600 ${small ? 10 : 11}px ${TYPEFACE}`,
					textAlign: 'center',
					textBaseline: 'bottom',
				});
				for (const [index, bar] of bars.entries()) {
					const step = BRIDGE[index];
					ctx.fillText(
						small ? shortNote(step) : fullNote(step),
						bar.x,
						y.getPixelForValue(Math.max(step.start, step.end)) - 6,
					);
				}
				ctx.restore();
			},
		};

		return {
			type: 'bar',
			data: {
				labels: BRIDGE.map(({ name }) => name),
				datasets: [
					{
						label: 'Revenue',
						data: BRIDGE.map(({ start, end }) => [start, end]),
						backgroundColor: tones,
						hoverBackgroundColor: BRIDGE.map((_, index) => tones[index]),
						barPercentage: 0.62,
						borderRadius: 4,
						borderSkipped: false,
					},
				],
			},
			options: chartOptions(look, animate, {
				interaction: { mode: 'nearest', intersect: true },
				layout: { padding: { top: 26 } },
				plugins: {
					tooltip: {
						displayColors: false,
						callbacks: {
							title: ([first]) => [].concat(BRIDGE[first.dataIndex].name).join(' '),
							label: ({ dataIndex }) => ` ${fullNote(BRIDGE[dataIndex])}`,
						},
					},
				},
				scales: {
					y: {
						min: 90,
						max: 140,
						ticks: { stepSize: 10, maxTicksLimit: 6, callback: (value) => `$${value}k` },
					},
					x: {
						ticks: {
							autoSkip: false,
							font: ({ chart }) => ({ family: TYPEFACE, size: cramped(chart) ? 10 : 11 }),
							callback(_, index) {
								return cramped(this.chart) ? BRIDGE[index].tick : BRIDGE[index].name;
							},
						},
					},
				},
			}),
			plugins: [connectors],
		};
	}

	/* Contract value by region; clicking a bar opens that region's table. */
	function regionRecipe(look, animate) {
		const tones = regionTones(look);
		return {
			type: 'bar',
			data: {
				labels: REGIONS.map(({ tick }) => tick),
				datasets: [
					{
						label: 'Annual contract value',
						data: regionSums,
						backgroundColor: tones,
						hoverBackgroundColor: tones,
						barPercentage: 0.6,
						borderRadius: 5,
					},
				],
			},
			options: chartOptions(look, animate, {
				interaction: { mode: 'nearest', intersect: true },
				onHover: (event, hits) => {
					event.native.target.style.cursor = hits.length ? 'pointer' : 'default';
				},
				plugins: {
					tooltip: {
						displayColors: false,
						callbacks: {
							title: ([first]) => REGIONS[first.dataIndex].name,
							label: ({ parsed, dataIndex }) =>
								` $${parsed.y.toLocaleString()} across ${REGIONS[dataIndex].accounts.length} accounts`,
						},
					},
				},
				scales: {
					y: { beginAtZero: true, ticks: { callback: (value) => `$${value / 1000}k` } },
					x: { ticks: { autoSkip: false } },
				},
			}),
		};
	}

	/* Failed checkouts with numbered markers where something changed; the
     tooltip names the change on the matching day. */
	function milestoneRecipe(look, animate) {
		const color = look.ramp[7];
		const markers = {
			id: 'milestoneMarkers',
			afterDatasetsDraw({ ctx, chartArea, scales }) {
				const { top, bottom } = chartArea;
				ctx.save();
				for (const [order, { at }] of MILESTONES.entries()) {
					const x = scales.x.getPixelForValue(at);
					Object.assign(ctx, { strokeStyle: look.faint, globalAlpha: 0.6, lineWidth: 1 });
					ctx.setLineDash([4, 4]);
					ctx.beginPath();
					ctx.moveTo(x, top - 4);
					ctx.lineTo(x, bottom);
					ctx.stroke();
					ctx.setLineDash([]);
					Object.assign(ctx, { globalAlpha: 1, fillStyle: look.paper, lineWidth: 1.5 });
					ctx.beginPath();
					ctx.arc(x, top - 16, 10, 0, Math.PI * 2);
					ctx.fill();
					ctx.stroke();
					Object.assign(ctx, {
						fillStyle: look.ink,
						font: `700 11px ${TYPEFACE}`,
						textAlign: 'center',
						textBaseline: 'middle',
					});
					ctx.fillText(String(order + 1), x, top - 15.5);
				}
				ctx.restore();
			},
		};

		return {
			type: 'line',
			data: {
				labels: checkoutDays.map(shortDate),
				datasets: [
					lineSeries(color, {
						label: 'Failed checkouts',
						data: FAILED_CHECKOUTS,
						fill: 'start',
						backgroundColor: fadingFill(color),
						tension: 0.3,
					}),
				],
			},
			options: chartOptions(look, animate, {
				layout: { padding: { top: 34, right: 14, left: 4 } },
				plugins: {
					tooltip: {
						callbacks: {
							label: ({ parsed }) => ` ${parsed.y} failed`,
							afterBody: ([first]) => {
								const order = MILESTONES.findIndex(({ at }) => at === first.dataIndex);
								return order < 0 ? '' : `${order + 1}. ${MILESTONES[order].note}`;
							},
						},
					},
				},
				scales: {
					y: { beginAtZero: true, suggestedMax: 100 },
					x: { ticks: { maxTicksLimit: 6 } },
				},
			}),
			plugins: [markers],
		};
	}

	function streamRecipe(look, animate) {
		const color = look.ramp[0];
		return {
			type: 'line',
			data: {
				labels: secondTicks,
				datasets: [
					lineSeries(color, {
						label: 'Load',
						data: readings.slice(),
						fill: 'start',
						backgroundColor: fadingFill(color),
						tension: 0.3,
					}),
				],
			},
			options: chartOptions(look, animate, {
				plugins: { tooltip: { callbacks: { label: ({ parsed }) => ` ${parsed.y}% load` } } },
				scales: {
					y: { min: 0, max: 100, ticks: { stepSize: 25, callback: (value) => `${value}%` } },
					x: { ticks: { maxTicksLimit: 4 } },
				},
			}),
		};
	}

	/* Daily orders as a calendar grid. It uses the third ramp hue (the same
     one as .advanced-scale-c3) so it does not echo the hour grid. */
	function dayGridRecipe(look, animate) {
		const CLEAR = 'rgba(0, 0, 0, 0)';
		const ifCounted = (day, color) => (day.orders === null ? CLEAR : color);
		const shadeFor = (day) => ifCounted(day, blend(look.ramp[2], look.paper, STEP_SHARES[orderStep(day.orders)]));
		const dayAt = ({ datasetIndex, dataIndex }) => orderGrid[datasetIndex][dataIndex];

		return {
			type: 'bar',
			data: {
				labels: DAY_TICKS,
				datasets: orderGrid.map((week, index) => ({
					label: `Week ${index + 1}`,
					data: week.map(() => 1),
					backgroundColor: week.map(shadeFor),
					hoverBackgroundColor: week.map(shadeFor),
					borderColor: week.map((day) => ifCounted(day, look.paper)),
					hoverBorderColor: week.map((day) => ifCounted(day, look.ink)),
					borderWidth: 2,
					hoverBorderWidth: 2,
					borderRadius: 4,
					borderSkipped: false,
					barPercentage: 1,
					categoryPercentage: 1,
				})),
			},
			options: chartOptions(look, false, {
				indexAxis: 'y',
				interaction: { mode: 'nearest', intersect: true },
				layout: { padding: { top: 0, right: 2 } },
				...cellReveal(animate, look, 450, 30),
				plugins: {
					tooltip: {
						displayColors: false,
						filter: (item) => dayAt(item).orders !== null,
						callbacks: {
							title: ([first]) =>
								dayAt(first).date.toLocaleDateString('en-US', {
									weekday: 'short',
									month: 'short',
									day: 'numeric',
								}),
							label: (item) => ` ${dayAt(item).orders} orders`,
						},
					},
				},
				scales: {
					y: {
						stacked: true,
						grid: { display: false },
						ticks: { autoSkip: false, callback: (_, row) => (row % 2 ? '' : DAY_TICKS[row]) },
					},
					x: {
						stacked: true,
						position: 'top',
						min: 0,
						max: GRID_WEEKS,
						afterBuildTicks: (axis) => {
							axis.ticks = monthTicks.map(({ value }) => ({ value }));
						},
						ticks: {
							autoSkip: false,
							align: 'start',
							callback: (value) => monthTicks.find((mark) => mark.value === value)?.label || '',
						},
					},
				},
			}),
		};
	}

	/* The checkout funnel as centered bars. Each stage leans from the third
     ramp color toward the first as it gets lighter, so the drop reads as a
     change of stage and not only of size. */
	function stageRecipe(look, animate) {
		const sessions = STAGES[0].people;
		const lastStage = STAGES.length - 1;
		const tones = STAGES.map((_, index) =>
			blend(blend(look.ramp[2], look.ramp[0], index / lastStage), look.paper, 1 - index * 0.14),
		);
		const percentOf = (part, whole) => Math.round((part / whole) * 100);
		const sideNote = (index) => {
			const { people } = STAGES[index];
			return index === 0
				? sessions.toLocaleString()
				: `${people.toLocaleString()} · ${percentOf(people, STAGES[index - 1].people)}%`;
		};

		const notes = {
			id: 'stageNotes',
			afterDatasetsDraw(chart) {
				const { ctx } = chart;
				ctx.save();
				Object.assign(ctx, {
					fillStyle: look.ink,
					font: `600 11.5px ${TYPEFACE}`,
					textAlign: 'left',
					textBaseline: 'middle',
				});
				for (const [index, bar] of chart.getDatasetMeta(0).data.entries())
					ctx.fillText(sideNote(index), bar.x + 10, bar.y);
				ctx.restore();
			},
		};

		return {
			type: 'bar',
			data: {
				labels: STAGES.map(({ stage }) => stage),
				datasets: [
					{
						label: 'People',
						data: STAGES.map(({ people }) => [-people / 2, people / 2]),
						backgroundColor: tones,
						hoverBackgroundColor: tones,
						barPercentage: 0.78,
						categoryPercentage: 1,
						borderRadius: 4,
						borderSkipped: false,
					},
				],
			},
			options: chartOptions(look, animate, {
				indexAxis: 'y',
				interaction: { mode: 'nearest', axis: 'y', intersect: false },
				layout: { padding: { right: 4 } },
				plugins: {
					tooltip: {
						displayColors: false,
						callbacks: {
							label: ({ dataIndex }) => {
								const { people } = STAGES[dataIndex];
								const lines = [
									` ${people.toLocaleString()} people, ${percentOf(people, sessions)}% of sessions`,
								];
								if (dataIndex > 0)
									lines.push(
										` ${percentOf(people, STAGES[dataIndex - 1].people)}% of the step before`,
									);
								return lines;
							},
						},
					},
				},
				scales: {
					y: { grid: { display: false }, ticks: { color: look.ink, padding: 10 } },
					x: { display: false, min: -sessions / 2, max: sessions * 0.95 },
				},
			}),
			plugins: [notes],
		};
	}

	function planRecipe(look, animate) {
		const { plan, orders } = PLANS[state.plan];
		const color = look.ramp[state.plan];
		return {
			type: 'line',
			data: {
				labels: MONTH_TICKS,
				datasets: [
					lineSeries(color, {
						label: plan,
						data: orders.slice(),
						fill: 'start',
						backgroundColor: fadingFill(color),
						tension: 0.35,
					}),
				],
			},
			options: chartOptions(look, animate, {
				plugins: {
					tooltip: { callbacks: { label: ({ dataset, parsed }) => ` ${dataset.label}: ${parsed.y} orders` } },
				},
				scales: { y: { beginAtZero: true, suggestedMax: 450 } },
			}),
		};
	}

	function latencyRecipe(look, animate) {
		const color = look.ramp[1];
		return {
			type: 'line',
			data: {
				labels: latencyDays.map(shortDate),
				datasets: [
					lineSeries(color, {
						label: 'Response time',
						data: latencies,
						fill: 'start',
						backgroundColor: fadingFill(color),
						tension: 0.3,
					}),
				],
			},
			options: chartOptions(look, animate, {
				plugins: { tooltip: { callbacks: { label: ({ parsed }) => ` ${parsed.y} ms` } } },
				scales: {
					y: { min: 60, max: 200, ticks: { stepSize: 35, callback: (value) => `${value} ms` } },
					x: { min: state.from, max: state.to, ticks: { maxTicksLimit: 6 } },
				},
			}),
		};
	}

	/* Friday sessions (slot 0) and Friday orders (slot 1), hour by hour. */
	function twinRecipe(look, animate, canvas) {
		const slot = Number(canvas.getAttribute('data-advanced-sync'));
		const visits = slot === 0;
		const color = look.ramp[slot];
		const unit = (count) => {
			if (visits) return 'sessions';
			return count === 1 ? 'order' : 'orders';
		};
		return {
			type: 'line',
			data: {
				labels: CLOCK.map(clock),
				datasets: [
					lineSeries(color, {
						label: visits ? 'Sessions' : 'Orders',
						data: visits ? fridayVisits : hourlyOrders[4],
						fill: 'start',
						backgroundColor: fadingFill(color),
						cubicInterpolationMode: 'monotone',
					}),
				],
			},
			options: chartOptions(look, animate, {
				plugins: { tooltip: { callbacks: { label: ({ parsed }) => ` ${parsed.y} ${unit(parsed.y)}` } } },
				scales: {
					y: { beginAtZero: true },
					x: { ticks: { maxTicksLimit: 7 } },
				},
			}),
		};
	}

	/* Options every chart starts from, and the pieces recipes share. */

	/** The house defaults, deep-merged with whatever the recipe overrides. */
	function chartOptions(look, animate, overrides) {
		const tickStyle = { color: look.faint, padding: 8, font: { family: TYPEFACE, size: 11.5 } };
		const tooltip = {
			backgroundColor: look.paper,
			borderColor: look.edge,
			borderWidth: 1,
			titleColor: look.ink,
			bodyColor: look.ink,
			titleFont: { family: TYPEFACE, size: 12, weight: '600' },
			bodyFont: { family: TYPEFACE, size: 12 },
			padding: 10,
			boxPadding: 4,
			cornerRadius: 8,
			usePointStyle: true,
		};
		return layer(
			{
				maintainAspectRatio: false,
				responsive: true,
				animation: animate ? { duration: 500, easing: 'easeOutQuart' } : false,
				layout: { padding: { top: 6, right: 6 } },
				interaction: { intersect: false, mode: 'index' },
				elements: {
					point: { radius: 0, hoverRadius: 5, hoverBorderWidth: 2, hoverBorderColor: look.paper },
					line: { borderWidth: 2, borderCapStyle: 'round', borderJoinStyle: 'round' },
				},
				plugins: { tooltip, legend: { display: false } },
				scales: {
					y: {
						border: { display: false },
						grid: { color: look.gridline },
						ticks: { ...tickStyle, maxTicksLimit: 5 },
					},
					x: {
						border: { display: false },
						grid: { display: false },
						ticks: { ...tickStyle, maxRotation: 0, autoSkipPadding: 12 },
					},
				},
			},
			overrides,
		);
	}

	/** Copies `base`, folding `extra` in; nested plain objects merge, the rest replace. */
	function layer(base, extra) {
		const merged = { ...base };
		for (const [key, value] of Object.entries(extra)) {
			merged[key] = isBranch(value) && isBranch(merged[key]) ? layer(merged[key], value) : value;
		}
		return merged;
	}

	function isBranch(value) {
		return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
	}

	/* The two grid charts fade their cells in one column at a time instead
     of letting bars grow out of the axis. */
	function cellReveal(animate, look, duration, stagger) {
		if (!animate) return { animation: false, animations: {} };
		return {
			animation: {
				duration,
				easing: 'easeOutQuad',
				delay: ({ type, datasetIndex }) => (type === 'data' ? datasetIndex * stagger : 0),
			},
			animations: {
				x: { duration: 0 },
				base: { duration: 0 },
				width: { duration: 0 },
				colors: { from: look.paper },
			},
		};
	}

	function lineSeries(color, extra) {
		return {
			borderColor: color,
			backgroundColor: color,
			pointBackgroundColor: color,
			pointHoverBackgroundColor: color,
			tension: 0.3,
			...extra,
		};
	}

	/* An area fill that fades out toward the axis; under Flat mode a pale even tint. */
	function fadingFill(color) {
		return window.Basalt.chartFill(
			[
				[0, tint(color, 0.26)],
				[1, tint(color, 0)],
			],
			{ flat: tint(color, 0.12) },
		);
	}

	/* A rounded label drawn on the canvas in surface and text colors, so it
     looks the same in every palette. It slides sideways to stay inside
     `minLeft` and `maxRight`. */
	function drawTag(ctx, look, centerX, bottom, text, minLeft, maxRight) {
		const height = 20;
		ctx.save();
		ctx.font = `600 11px ${TYPEFACE}`;
		const width = ctx.measureText(text).width + 14;
		const left = Math.max(minLeft, Math.min(centerX - width / 2, maxRight - width));
		const top = bottom - height;
		Object.assign(ctx, { fillStyle: look.paper, strokeStyle: look.edge, lineWidth: 1 });
		ctx.beginPath();
		if (ctx.roundRect) ctx.roundRect(left, top, width, height, 10);
		else ctx.rect(left, top, width, height);
		ctx.fill();
		ctx.stroke();
		Object.assign(ctx, { fillStyle: look.ink, textAlign: 'left', textBaseline: 'middle' });
		ctx.fillText(text, left + 7, top + height / 2 + 0.5);
		ctx.restore();
	}

	/* Colors. Chart.js wants strings it can parse itself, so tints and mixes
     are worked out here rather than handed over as CSS color-mix(). */

	function readPalette() {
		const ink = token('--basalt-copy', '#12233a');
		const paper = token('--basalt-plane', '#ffffff');
		return {
			ink,
			paper,
			/* The same mix as --advanced-quiet in apex-charts.css: small gray
         text that still passes 4.5:1 on the lightest palettes. */
			faint: blend(token('--basalt-copy-muted', '#5f7186'), ink, 0.82),
			gridline: tint(ink, 0.07),
			edge: token('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			gain: token('--basalt-success', '#12c08f'),
			loss: token('--basalt-danger', '#ef4d63'),
			ramp: [1, 2, 3, 4, 5, 6, 7, 8].map((slot) => token(`--basalt-series-${slot}`, '#2b6fd4')),
		};
	}

	function token(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** Reads #rgb, #rrggbb, rgb() or rgba() into [red, green, blue, alpha]; anything else is mid gray. */
	function channels(color) {
		const text = String(color || '').trim();
		const short = text.match(/^#([0-9a-f]{3})$/i);
		if (short) return [...short[1]].map((digit) => parseInt(digit + digit, 16)).concat(1);
		const long = text.match(/^#([0-9a-f]{6})$/i);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 1];
		}
		const functional = text.match(/^rgba?\(([^)]+)\)$/i);
		if (functional) {
			const [red, green, blue, alpha = 1] = functional[1].split(',').map((part) => parseFloat(part));
			return [red, green, blue, alpha];
		}
		return [128, 128, 128, 1];
	}

	function tint(color, alpha) {
		const [red, green, blue] = channels(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	/** Mixes two colors; `weight` is how much of `front` survives. */
	function blend(front, back, weight) {
		const over = channels(front);
		const under = channels(back);
		const [red, green, blue] = [0, 1, 2].map((slot) =>
			Math.round(over[slot] * weight + under[slot] * (1 - weight)),
		);
		return `rgb(${red}, ${green}, ${blue})`;
	}

	function contrastRatio(first, second) {
		const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
		return (lighter + 0.05) / (darker + 0.05);
	}

	function relativeLuminance(color) {
		const [red, green, blue] = channels(color).map((channel) => {
			const unit = channel / 255;
			return unit <= 0.03928 ? unit / 12.92 : Math.pow((unit + 0.055) / 1.055, 2.4);
		});
		return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
	}

	/* Demo data helpers. */

	/* Friday evenings run busier than the other weekdays. */
	function curveFor(dayIndex) {
		const curve = [...(dayIndex >= 5 ? WEEKEND_CURVE : WORKDAY_CURVE)];
		if (dayIndex === 4) {
			curve[19] += 3;
			curve[20] += 3;
		}
		return curve;
	}

	/**
	 * Splits `total` in proportion to `weights` into whole numbers that still
	 * add up to it: each part is rounded down, and the units left over go to
	 * the parts that lost the most.
	 */
	function apportion(total, weights) {
		const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
		const exact = weights.map((weight) => (weight / weightSum) * total);
		const parts = exact.map((value) => Math.floor(value));
		let spare = total - parts.reduce((sum, part) => sum + part, 0);
		const byLoss = exact
			.map((value, index) => ({ index, loss: value - Math.floor(value) }))
			.sort((a, b) => b.loss - a.loss);
		for (const { index } of byLoss) {
			if (spare <= 0) break;
			parts[index] += 1;
			spare -= 1;
		}
		return parts;
	}

	function daysEndingToday(count) {
		const now = new Date();
		return Array.from({ length: count }, (_, index) => {
			const day = new Date(now);
			day.setDate(now.getDate() - (count - 1 - index));
			return day;
		});
	}

	/* A sale lifts weeks 12 and 13; days after today carry no count. */
	function gridDay(week, weekday) {
		const date = new Date(gridStart);
		date.setDate(gridStart.getDate() + week * 7 + weekday);
		if (date > today) return { date, orders: null };
		const sale = week === 12 || week === 13 ? 1.32 : 1;
		const noise = (((week * 7 + weekday) * 53) % 17) - 8;
		return { date, orders: Math.round((64 + week * 0.45) * DAY_LIFT[weekday] * sale + noise) };
	}

	function orderStep(orders) {
		return ORDER_STEPS.filter((floor) => orders >= floor).length;
	}

	/* Ticks for the calendar's top axis: one wherever a new month begins. The
     first is dropped when the second follows it too closely to fit. */
	function monthStarts() {
		const marks = [];
		for (const [week, days] of orderGrid.entries()) {
			const month = days[0].date.getMonth();
			if (week > 0 && month === orderGrid[week - 1][0].date.getMonth()) continue;
			marks.push({ value: week, label: days[0].date.toLocaleDateString('en-US', { month: 'short' }) });
		}
		if (marks.length > 1 && marks[1].value - marks[0].value < 3) marks.shift();
		return marks;
	}

	function shortDate(date) {
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function clock(hour) {
		return `${String(hour).padStart(2, '0')}:00`;
	}

	function clamp(value, low, high) {
		return Math.max(low, Math.min(high, value));
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
