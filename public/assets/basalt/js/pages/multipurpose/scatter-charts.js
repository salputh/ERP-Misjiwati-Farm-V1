/**
 * Draws the thirteen scatter and bubble charts on scatter-charts.html with
 * Chart.js, plus the controls that steer them: the month player, the distance
 * band, the group and city pickers and the chart-type filter. Colors come from
 * the --basalt-* custom properties whenever a chart is made, and every chart
 * on screen is made again on basalt:appearance, so palette, light or dark,
 * background and the flat setting all carry through to the canvases.
 */
(() => {
	'use strict';

	const board = pick('[data-scatters-root]');
	if (!board || typeof Chart === 'undefined') return;

	const html = document.documentElement;
	const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const TYPEFACE = "'Schibsted Grotesk', sans-serif";

	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const MONTH_FULL = [
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
	const FAMILIES = ['Plans', 'Add-ons', 'Integrations', 'Bundles'];

	/* Which ramp color each family wears. These four stay the easiest to tell
     apart in every one of the nine palettes. */
	const FAMILY_RAMP = [0, 1, 4, 7];

	/* Month-by-month multipliers that bend a product's straight line from its
     January figures to its December ones. */
	const CURVES = {
		flat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
		yearend: [1, 0.9, 0.9, 0.95, 1.1, 1, 0.95, 0.95, 1, 1.1, 1.8, 2.6],
		summer: [0.85, 0.85, 0.95, 1.05, 1.2, 1.35, 1.45, 1.35, 1.1, 0.95, 0.9, 0.9],
		winter: [1.2, 1.15, 1.05, 0.95, 0.85, 0.8, 0.8, 0.85, 0.95, 1.05, 1.15, 1.25],
	};

	/* The ten Fieldline products in the player. accounts and weekly hold the
     January and December values; price is what one account pays a month. */
	const CATALOG = [
		{ name: 'Basic', family: 0, accounts: [690, 760], weekly: [30, 41], price: 49, curve: 'flat' },
		{ name: 'Pro', family: 0, accounts: [620, 700], weekly: [47, 52], price: 210, curve: 'flat' },
		{ name: 'Max', family: 0, accounts: [140, 150], weekly: [64, 68], price: 3200, curve: 'flat' },
		{ name: 'Travel Planner', family: 1, accounts: [240, 390], weekly: [30, 41], price: 120, curve: 'summer' },
		{ name: 'Customer Portal', family: 1, accounts: [300, 330], weekly: [44, 42], price: 60, curve: 'flat' },
		{ name: 'SMS credits', family: 1, accounts: [380, 450], weekly: [55, 60], price: 45, curve: 'summer' },
		{ name: 'Accounting sync', family: 2, accounts: [160, 200], weekly: [33, 38], price: 80, curve: 'yearend' },
		{ name: 'Calendar sync', family: 2, accounts: [210, 205], weekly: [40, 39], price: 60, curve: 'winter' },
		{ name: 'Basic bundle', family: 3, accounts: [300, 560], weekly: [62, 71], price: 70, curve: 'flat' },
		{ name: 'Fleet bundle', family: 3, accounts: [90, 250], weekly: [50, 66], price: 180, curve: 'flat' },
	];

	/* Twelve monthly positions per product, keyed by product name. */
	const TIMELINE = (() => {
		const next = mulberry(2024);
		return Object.fromEntries(CATALOG.map((item) => [item.name, yearOf(item, next)]));
	})();

	/* Forty products for the quadrant chart. Lower prices tend to bring buyers
     back more often, though plenty of them break the rule. */
	const REPEAT_POINTS = (() => {
		const next = mulberry(71);
		return Array.from({ length: 40 }, () => {
			const price = Math.exp(Math.log(5) + next() * Math.log(56 / 5));
			const share = bound(62 - 11 * Math.log(price) + normal(next) * 13 + 18, 4, 80);
			return { x: toPlaces(price, 2), y: toPlaces(share, 1) };
		});
	})();

	/* A month of days, each with its ad spend and the orders that followed. */
	const SPEND_DAYS = (() => {
		const next = mulberry(9);
		return Array.from({ length: 30 }, () => {
			const spend = 40 + next() * 260;
			return { x: Math.round(spend), y: Math.round(40 + 0.11 * spend + normal(next) * 4.5) };
		});
	})();

	/* Three carriers: hours at the door, extra hours per km, and how far a
     single delivery strays from that. ramp is the carrier's chart color. */
	const COURIERS = [
		{ name: 'Parcelwise', ramp: 0, base: 14, perKm: 0.07, spread: 5 },
		{ name: 'Northline', ramp: 2, base: 20, perKm: 0.085, spread: 6 },
		{ name: 'Swift Post', ramp: 4, base: 9, perKm: 0.055, spread: 11 },
	];

	/* 120 deliveries dealt to the carriers in turn. */
	const SHIPMENTS = (() => {
		const next = mulberry(313);
		return Array.from({ length: 120 }, (_, n) => {
			const courier = COURIERS[n % 3];
			const km = Math.round(8 + next() * 585);
			const hours = Math.round(bound(courier.base + courier.perKm * km + normal(next) * courier.spread, 6, 96));
			return { ref: `#${4810 + n}`, courier: n % 3, name: courier.name, ramp: courier.ramp, x: km, y: hours };
		});
	})();

	/* Four kinds of shopper, each as [mean, spread] for orders a year and for
     the average basket. */
	const SHOPPER_TYPES = [
		{ name: 'Subscribers', ramp: 0, orders: [12, 1.5], basket: [32, 5] },
		{ name: 'Regulars', ramp: 1, orders: [6.5, 1.3], basket: [52, 8] },
		{ name: 'Deal hunters', ramp: 4, orders: [4, 1.2], basket: [20, 4] },
		{ name: 'Gift buyers', ramp: 7, orders: [1.7, 0.6], basket: [92, 12] },
	];

	const SHOPPERS = (() => {
		const next = mulberry(55);
		return SHOPPER_TYPES.map(({ orders, basket }) =>
			Array.from({ length: 30 }, () => ({
				x: toPlaces(bound(orders[0] + normal(next) * orders[1], 1, 16), 1),
				y: toPlaces(bound(basket[0] + normal(next) * basket[1], 8, 122), 0),
			})),
		);
	})();

	/* Five cities, each as [mean, spread] for visits a week and days to pay. */
	const TOWNS = [
		{ name: 'Bismarck', visits: [40, 12], payDays: [8, 2] },
		{ name: 'Toledo', visits: [25, 8], payDays: [11, 2.5] },
		{ name: 'Lincoln', visits: [30, 9], payDays: [10, 2.5] },
		{ name: 'Duluth', visits: [18, 6], payDays: [14, 3] },
		{ name: 'Olympia', visits: [22, 7], payDays: [12, 3.5] },
	];

	/* Twelve accounts per city. */
	const TOWN_POINTS = (() => {
		const next = mulberry(1207);
		return TOWNS.map(({ visits, payDays }) =>
			Array.from({ length: 12 }, () => ({
				x: toPlaces(bound(visits[0] + normal(next) * visits[1], 4, 80), 0),
				y: toPlaces(bound(payDays[0] + normal(next) * payDays[1], 3, 24), 0),
			})),
		);
	})();

	/* Growth on last year and margin, both in percent, with MRR in $k. */
	const EARNERS = [
		{ name: 'Max', growth: 26, margin: 70, mrr: 390 },
		{ name: 'Pro', growth: 18, margin: 66, mrr: 148 },
		{ name: 'Travel Planner', growth: 42, margin: 52, mrr: 47 },
		{ name: 'Basic', growth: 3, margin: 58, mrr: 38 },
		{ name: 'SMS credits', growth: 9, margin: 24, mrr: 21 },
		{ name: 'Customer Portal', growth: 12, margin: 63, mrr: 20 },
		{ name: 'Onboarding', growth: -4, margin: 30, mrr: 12 },
		{ name: 'Training', growth: 14, margin: 44, mrr: 10 },
	];

	/* Where parcels go: days on the road, share on time and orders a month,
     split between zones near the warehouse and those across the country. */
	const DESTINATIONS = {
		near: [
			{ name: 'Great Lakes', days: 1.2, onTime: 97, orders: 2100 },
			{ name: 'Plains', days: 1.9, onTime: 95, orders: 1650 },
			{ name: 'Mid-Atlantic', days: 2.6, onTime: 92, orders: 900 },
			{ name: 'New England', days: 3.3, onTime: 89, orders: 700 },
			{ name: 'Southeast', days: 4.1, onTime: 84, orders: 180 },
		],
		far: [
			{ name: 'Mountain', days: 4.6, onTime: 90, orders: 420 },
			{ name: 'Southwest', days: 5.4, onTime: 87, orders: 510 },
			{ name: 'Pacific Northwest', days: 6.3, onTime: 82, orders: 300 },
			{ name: 'Alaska and Hawaii', days: 8.6, onTime: 72, orders: 160 },
		],
	};

	/* Weekday orders bunch around three times of day; the share of draws that
     lands before each cut-off picks the peak. */
	const WEEKDAY_PEAKS = [
		{ below: 0.55, hour: 7.9, spread: 0.6 },
		{ below: 0.78, hour: 12.6, spread: 0.7 },
		{ below: Infinity, hour: 20.4, spread: 1.1 },
	];

	/* Last month's 400 orders as hour of day and basket value. Seven in every
     twenty fall on a weekend. */
	const BASKETS = (() => {
		const next = mulberry(400);
		const split = { weekday: [], weekend: [] };
		for (let n = 0; n < 400; n += 1) {
			const weekend = n % 20 < 7;
			const { hour, basket } = weekend ? weekendOrder(next) : weekdayOrder(next);
			split[weekend ? 'weekend' : 'weekday'].push({
				x: toPlaces(bound(hour, 0, 23.9), 2),
				y: Math.round(bound(basket, 6, 146)),
			});
		}
		return split;
	})();

	/* Thousands of sessions and the share that converted, January first. */
	const TRAFFIC = [
		[31, 5.1],
		[32.5, 5.2],
		[34, 5.0],
		[35, 4.9],
		[37, 4.6],
		[39.5, 4.3],
		[42, 4.1],
		[43.5, 4.2],
		[41, 4.8],
		[40, 5.3],
		[42, 5.6],
		[44, 5.8],
	];

	/* Postage, typical days, and the fastest and slowest tenth of deliveries.
     The three carriers from the band chart keep the same ramp colors. */
	const COURIER_RANGES = [
		{ name: 'Economy Mail', cost: 3.2, typical: 5, fast: 3, slow: 9, ramp: 3 },
		{ name: 'Swift Post', cost: 4.8, typical: 4, fast: 2, slow: 7, ramp: 4 },
		{ name: 'Parcelwise', cost: 6.5, typical: 2.5, fast: 2, slow: 4, ramp: 0 },
		{ name: 'Northline', cost: 9.6, typical: 2, fast: 1.5, slow: 3, ramp: 2 },
		{ name: 'Courier Plus', cost: 12.4, typical: 1.5, fast: 1, slow: 2, ramp: 5 },
	];

	/* Thirty-six products, nine per family, as price and units a month. Each
     family has its own price range; the log chart needs room on both axes. */
	const PRICE_POINTS = (() => {
		const next = mulberry(36);
		const ranges = [
			[11, 34],
			[4, 260],
			[5, 22],
			[19, 48],
		];
		const families = ranges.map(() => []);
		for (let n = 0; n < 36; n += 1) {
			const [cheapest, dearest] = ranges[n % 4];
			const price = Math.exp(Math.log(cheapest) + next() * Math.log(dearest / cheapest));
			const units = (7200 / price ** 1.05) * Math.exp(normal(next) * 0.35);
			families[n % 4].push({ x: toPlaces(price, 2), y: Math.max(3, Math.round(units)) });
		}
		return families;
	})();

	/* Forty parcels as weight and postage. */
	const WEIGHTS = (() => {
		const next = mulberry(40);
		return Array.from({ length: 40 }, () => {
			const kg = 0.3 + next() * 4.7;
			return { x: toPlaces(kg, 2), y: toPlaces(3.2 + 2.3 * kg + normal(next) * 0.6, 2) };
		});
	})();

	/* What the controls have chosen. pointed is the product under the pointer
     in the player; focus is the lit shopper group, -1 for none. */
	const view = {
		month: 11,
		traced: 'Fleet bundle',
		pointed: '',
		town: 0,
		focus: -1,
		low: 150,
		high: 300,
	};

	/* brushing is true while a band is being dragged; focusPinned when a group
     was lit from its key rather than by pointing. */
	let brushing = false;
	let focusPinned = false;
	let brushAnchor = 0;
	let ticker = null;

	/* Every chart drawn so far, by its canvas. */
	const live = new Map();
	const ui = {};

	/* The value of each canvas's data-scatters-chart picks how it is made. */
	const RECIPES = {
		gapminder: timelineChart,
		quadrants: quadrantChart,
		trend: trendChart,
		brush: bandChart,
		clusters: shopperChart,
		highlight: townChart,
		labels: earnerChart,
		bubble: destinationChart,
		density: basketChart,
		connected: trafficChart,
		errors: courierChart,
		log: priceChart,
		basic: weightChart,
	};

	/* Finds the controls, wires each card's behavior, then draws the charts as
     their cards come near the screen. */
	function start() {
		Object.assign(ui, {
			grid: hook('grid'),
			count: hook('count'),
			monthSlider: hook('month'),
			monthName: hook('month-name'),
			monthTotal: hook('month-total'),
			play: hook('play'),
			playLabel: hook('play-label'),
			trace: hook('follow'),
			low: hook('from'),
			high: hook('to'),
			lowOut: hook('from-out'),
			highOut: hook('to-out'),
			bandSum: hook('brush-sum'),
			bandRange: hook('brush-band'),
			bandStats: hook('brush-stats'),
			bandRows: hook('brush-rows'),
			picker: hook('picker'),
		});

		mountFilter();
		mountPlayer();
		mountBand();
		mountShopperKey();
		mountTownPicker();
		watchCanvases();

		document.addEventListener('basalt:appearance', () => {
			/* The new tokens are only readable once the attribute has landed, so
         wait a frame before drawing again. */
			requestAnimationFrame(() => {
				for (const canvas of live.keys()) draw(canvas, false);
			});
		});
	}

	function hook(name) {
		return pick(`[data-scatters-${name}]`, board);
	}

	/* Charts are made the first time their card nears the screen. */

	function watchCanvases() {
		const canvases = [...pickAll('canvas[data-scatters-chart]', board)];
		if (!('IntersectionObserver' in window)) {
			for (const canvas of canvases) draw(canvas, false);
			return;
		}
		const watcher = new IntersectionObserver(
			(entries, observer) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					observer.unobserve(entry.target);
					draw(entry.target, true);
				}
			},
			{ rootMargin: '80px 0px' },
		);
		for (const canvas of canvases) watcher.observe(canvas);
	}

	/** Makes (or remakes) the chart on one canvas from the current colors. */
	function draw(canvas, animate) {
		const recipe = RECIPES[canvas.getAttribute('data-scatters-chart')];
		if (!recipe) return;
		const previous = live.get(canvas);
		if (previous) previous.destroy();
		live.set(canvas, new Chart(canvas, recipe(readColors(), animate && !calm, canvas)));
	}

	function chartNamed(name) {
		return live.get(pick(`[data-scatters-chart="${name}"]`, board));
	}

	/* The chip row only hides and shows cards; nothing is redrawn. */

	function mountFilter() {
		const chips = pickAll('[data-scatters-filter]', board);
		for (const chip of chips) {
			chip.addEventListener('click', () => {
				for (const other of chips) other.setAttribute('aria-pressed', String(other === chip));
				showKind(chip.getAttribute('data-scatters-filter'));
			});
		}
	}

	/** Shows the cards of one chart type, or every card for "all". */
	function showKind(kind) {
		if (!ui.grid) return;
		const everything = kind === 'all';
		const cards = [...pickAll('.scatters-card', ui.grid)];
		const shown = cards.filter((card) => everything || card.getAttribute('data-scatters-kind') === kind);

		for (const card of cards) {
			card.classList.toggle('is-hidden', !shown.includes(card));
			card.classList.remove('is-alone');
		}
		ui.grid.classList.toggle('is-filtered', !everything);

		/* In a filtered view cards pair up; a half-width card left without a
       partner stretches across the row. */
		if (!everything) {
			const paired = shown.filter(
				(card) =>
					!card.classList.contains('scatters-card-full') ||
					card.classList.contains('scatters-card-full-in-all'),
			);
			if (paired.length % 2) paired[paired.length - 1].classList.add('is-alone');
		}
		if (ui.count) ui.count.textContent = `${shown.length} ${shown.length === 1 ? 'chart' : 'charts'}`;
	}

	/* The player steps the bubbles through the year, one month at a time. */

	function mountPlayer() {
		ui.play?.addEventListener('click', () => (ticker ? halt() : play()));
		ui.monthSlider?.addEventListener('input', () => {
			halt();
			showMonth(Number(ui.monthSlider.value), true);
		});
		ui.trace?.addEventListener('change', () => {
			view.traced = ui.trace.value;
			chartNamed('gapminder')?.update('none');
		});
		const canvas = pick('[data-scatters-chart="gapminder"]', board);
		canvas?.addEventListener('pointerleave', () => {
			if (!view.pointed) return;
			view.pointed = '';
			live.get(canvas)?.update('none');
		});
		showMonth(view.month, false);
	}

	/** Moves the player to a month and slides the bubbles there. */
	function showMonth(month, animate) {
		view.month = bound(month, 0, 11);
		const full = MONTH_FULL[view.month];
		if (ui.monthSlider) {
			ui.monthSlider.value = String(view.month);
			ui.monthSlider.setAttribute('aria-valuetext', full);
		}
		if (ui.monthName) ui.monthName.textContent = full;
		if (ui.monthTotal) {
			const total = CATALOG.reduce((sum, item) => sum + TIMELINE[item.name][view.month].mrr, 0);
			ui.monthTotal.textContent = `${dollars(total)} MRR from ten products`;
		}

		const chart = chartNamed('gapminder');
		if (!chart) return;
		for (const set of chart.data.datasets) {
			for (const point of set.data) {
				const { x, y, mrr } = TIMELINE[point.product][view.month];
				Object.assign(point, { x, y, mrr, r: bubbleRadius(mrr, chart.width) });
			}
		}
		chart.update(animate && !calm ? undefined : 'none');
	}

	function play() {
		/* Pressing play on December starts the year over. */
		if (view.month >= 11) showMonth(0, true);
		paintPlayButton(true);
		ticker = setInterval(
			() => {
				showMonth(view.month + 1, true);
				if (view.month >= 11) halt();
			},
			calm ? 1400 : 1100,
		);
	}

	function halt() {
		if (ticker) clearInterval(ticker);
		ticker = null;
		if (ui.play) paintPlayButton(false);
	}

	function paintPlayButton(playing) {
		ui.play.setAttribute('aria-pressed', String(playing));
		pick('.bi', ui.play).className = playing ? 'bi bi-pause-fill' : 'bi bi-play-fill';
		if (ui.playLabel) ui.playLabel.textContent = playing ? 'Pause' : 'Play';
	}

	/** Bubble radius for an MRR figure; narrow charts get smaller bubbles. */
	function bubbleRadius(mrr, width) {
		return Math.sqrt(mrr) * 0.05 * bound(width / 1100, 0.55, 1);
	}

	/* The band can be dragged on the chart or set with the two sliders. */

	function mountBand() {
		if (ui.low && ui.high) {
			ui.low.addEventListener('input', () => {
				const km = Number(ui.low.value);
				setBand(km, Math.max(km, view.high), true);
			});
			ui.high.addEventListener('input', () => {
				const km = Number(ui.high.value);
				setBand(Math.min(km, view.low), km, true);
			});
		}

		const canvas = pick('[data-scatters-chart="brush"]', board);
		if (canvas) {
			canvas.addEventListener('pointerdown', (event) => startBrush(canvas, event));
			canvas.addEventListener('pointermove', (event) => {
				if (!brushing) return;
				const chart = live.get(canvas);
				if (chart) setBand(brushAnchor, kmAtPointer(canvas, chart, event), true);
			});
			canvas.addEventListener('pointerup', endBrush);
			canvas.addEventListener('pointercancel', endBrush);
		}
		paintBand(false);
	}

	function startBrush(canvas, event) {
		const chart = live.get(canvas);
		if (!chart || event.button > 0) return;
		const offset = event.clientX - canvas.getBoundingClientRect().left;
		const { left, right } = chart.chartArea;
		if (offset < left - 4 || offset > right + 4) return;
		brushing = true;
		brushAnchor = kmAtPointer(canvas, chart, event);
		canvas.setPointerCapture(event.pointerId);
		chart.tooltip.setActiveElements([], { x: 0, y: 0 });
		setBand(brushAnchor, brushAnchor, true);
	}

	function endBrush() {
		if (!brushing) return;
		brushing = false;
		/* A plain click leaves a band with no width, so open it up a little. */
		if (view.high - view.low < 20) setBand(view.low - 30, view.low + 30, true);
	}

	function kmAtPointer(canvas, chart, event) {
		return chart.scales.x.getValueForPixel(event.clientX - canvas.getBoundingClientRect().left);
	}

	/** Stores a band in either order, snapped to 10 km inside 0-600. */
	function setBand(one, other, redraw) {
		const ends = [one, other].map((km) => bound(Math.round(km / 10) * 10, 0, 600));
		view.low = Math.min(...ends);
		view.high = Math.max(...ends);
		paintBand(redraw);
	}

	/** Brings the sliders, the summary and the table in line with the band. */
	function paintBand(redraw) {
		const { low, high } = view;
		for (const [input, km] of [
			[ui.low, low],
			[ui.high, high],
		]) {
			if (!input) continue;
			input.value = String(km);
			input.setAttribute('aria-valuetext', `${km} km`);
		}
		if (ui.lowOut) ui.lowOut.textContent = `${low} km`;
		if (ui.highOut) ui.highOut.textContent = `${high} km`;

		const inside = SHIPMENTS.filter((item) => item.x >= low && item.x <= high);
		if (ui.bandSum) ui.bandSum.textContent = `${inside.length} ${inside.length === 1 ? 'order' : 'orders'}`;
		if (ui.bandRange) ui.bandRange.textContent = `Between ${low} and ${high} km`;
		if (ui.bandStats) {
			ui.bandStats.replaceChildren(
				...bandFigures(inside).flatMap(([term, value]) => [textNode('dt', term), textNode('dd', value)]),
			);
		}
		if (ui.bandRows) ui.bandRows.replaceChildren(...slowestRows(inside));

		if (redraw) chartNamed('brush')?.update('none');
	}

	function bandFigures(inside) {
		if (!inside.length)
			return [
				['Average time', '-'],
				['Within two days', '-'],
				['Slowest', '-'],
			];
		const hours = inside.map((item) => item.y);
		const total = hours.reduce((sum, value) => sum + value, 0);
		const quick = hours.filter((value) => value <= 48).length;
		return [
			['Average time', `${Math.round(total / inside.length)} hours`],
			['Within two days', `${Math.round((quick / inside.length) * 100)}%`],
			['Slowest', `${Math.max(...hours)} hours`],
		];
	}

	/** Table rows for the six slowest deliveries, or one row saying none. */
	function slowestRows(inside) {
		const slowest = [...inside].sort((a, b) => b.y - a.y).slice(0, 6);
		if (!slowest.length) {
			const cell = textNode('td', 'No orders in this band');
			cell.colSpan = 3;
			const row = document.createElement('tr');
			row.append(cell);
			return [row];
		}
		return slowest.map((item) => {
			const swatch = document.createElement('span');
			swatch.setAttribute('aria-hidden', 'true');
			swatch.className = `scatters-key-dot scatters-c${item.ramp + 1}`;
			const tag = document.createElement('span');
			tag.className = 'scatters-brush-id';
			tag.append(swatch, item.ref);
			const first = document.createElement('td');
			first.title = item.name;
			first.append(tag);
			const row = document.createElement('tr');
			row.append(first, textNode('td', item.x), textNode('td', item.y));
			return row;
		});
	}

	function textNode(tag, text) {
		const node = document.createElement(tag);
		node.textContent = text;
		return node;
	}

	/* Key buttons light a shopper group; chips pick the city to bring forward. */

	function mountShopperKey() {
		for (const key of pickAll('[data-scatters-group]', board)) {
			const index = Number(key.getAttribute('data-scatters-group'));
			key.addEventListener('click', () => {
				focusPinned = view.focus !== index;
				lightGroup(focusPinned ? index : -1);
			});
		}
		pick('[data-scatters-chart="clusters"]', board)?.addEventListener('pointerleave', () => {
			if (!focusPinned && view.focus >= 0) lightGroup(-1);
		});
	}

	/** Lights one shopper group (-1 for none) in the key and on the chart. */
	function lightGroup(index) {
		view.focus = index;
		for (const key of pickAll('[data-scatters-group]', board)) {
			key.setAttribute('aria-pressed', String(Number(key.getAttribute('data-scatters-group')) === index));
		}
		chartNamed('clusters')?.update('none');
	}

	function mountTownPicker() {
		ui.picker?.addEventListener('click', (event) => {
			const chosen = event.target.closest('[data-scatters-pick]');
			if (!chosen) return;
			view.town = Number(chosen.getAttribute('data-scatters-pick'));
			for (const chip of pickAll('[data-scatters-pick]', ui.picker)) {
				chip.setAttribute('aria-pressed', String(chip === chosen));
			}

			const chart = chartNamed('highlight');
			if (!chart) return;
			const colors = readColors();
			for (const [index, set] of chart.data.datasets.entries()) {
				Object.assign(set, townLook(colors, index === view.town));
			}
			chart.update(calm ? 'none' : undefined);
		});
	}

	/** The point styling that sets the chosen city apart from the rest. */
	function townLook(colors, chosen) {
		return {
			pointRadius: chosen ? 5.5 : 4,
			pointBackgroundColor: chosen ? colors.ramp[0] : colors.dim,
			pointHoverBackgroundColor: chosen ? colors.ramp[0] : colors.soft,
			order: chosen ? 0 : 1,
		};
	}

	/* Each recipe returns a full Chart.js config for one canvas. */

	/* Bubbles over time: products move month by month, the traced one leaves
     a trail of past months behind it and wears a name tag. */
	function timelineChart(colors, animate, canvas) {
		const width = canvas.parentElement.clientWidth;
		const hue = (family) => colors.ramp[FAMILY_RAMP[family]];
		const spotlight = () => view.pointed || view.traced;

		/* Bubbles fade toward a highlight up and to the left, like light on
       glass. With gradients off they take a flat fill. */
		function glassFill(context, element, color, opacity) {
			if (gradientsOff() || !element || !Number.isFinite(element.x)) return fade(color, opacity);
			const radius = Math.max(1, element.options ? element.options.radius : 10);
			const shine = context.createRadialGradient(
				element.x - radius * 0.35,
				element.y - radius * 0.35,
				radius * 0.1,
				element.x,
				element.y,
				radius,
			);
			shine.addColorStop(0, fade(color, opacity * 0.45));
			shine.addColorStop(1, fade(color, opacity));
			return shine;
		}

		return {
			type: 'bubble',
			data: {
				datasets: FAMILIES.map((family, index) => ({
					label: family,
					data: CATALOG.filter((item) => item.family === index).map((item) => {
						const now = TIMELINE[item.name][view.month];
						return {
							product: item.name,
							family: index,
							x: now.x,
							y: now.y,
							r: bubbleRadius(now.mrr, width),
							mrr: now.mrr,
						};
					}),
					borderColor: hue(index),
					borderWidth: 1.5,
					hoverBorderWidth: 2,
					hoverRadius: 2,
					backgroundColor: (context) => {
						if (!context.raw) return fade(hue(index), 0.7);
						const lead = spotlight();
						const opacity = !lead || lead === context.raw.product ? 0.88 : 0.55;
						return glassFill(context.chart.ctx, context.element, hue(index), opacity);
					},
					hoverBackgroundColor: fade(hue(index), 0.95),
				})),
			},
			options: baseConfig(colors, animate, 'Accounts', 'Used weekly', {
				layout: { padding: { top: 14, right: 16 } },
				animation: animate ? { duration: 500, easing: 'easeInOutCubic' } : false,
				plugins: {
					tooltip: {
						callbacks: {
							title: (items) => items[0].raw.product,
							label: ({ raw }) => ` ${raw.x} accounts, ${raw.y}% weekly, ${dollars(raw.mrr)} MRR`,
						},
					},
				},
				scales: {
					x: { min: 0, max: 800, ticks: { stepSize: 100 } },
					y: { min: 0, max: 80, ticks: { stepSize: 20, callback: (value) => `${value}%` } },
				},
				onHover(event, hits, chart) {
					const under = hits.length
						? chart.data.datasets[hits[0].datasetIndex].data[hits[0].index].product
						: '';
					if (under === view.pointed) return;
					view.pointed = under;
					chart.update('none');
				},
				onResize(chart, size) {
					for (const set of chart.data.datasets) {
						for (const point of set.data) point.r = bubbleRadius(point.mrr, size.width);
					}
				},
			}),
			plugins: [
				{
					id: 'scattersTrail',
					beforeDatasetsDraw(chart) {
						const lead = spotlight();
						if (!lead || !TIMELINE[lead]) return;
						const past = TIMELINE[lead].slice(0, view.month + 1);
						const color = hue(past[0].family);
						const {
							ctx,
							scales: { x, y },
						} = chart;
						const stops = past.map((stop) => [
							x.getPixelForValue(stop.x),
							y.getPixelForValue(stop.y),
							stop.mrr,
						]);

						ctx.save();
						ctx.strokeStyle = fade(color, 0.55);
						ctx.lineWidth = 1.5;
						ctx.lineJoin = 'round';
						tracePath(ctx, stops);
						ctx.stroke();

						/* Each earlier month is a small ring, sized by that month's MRR. */
						for (const [px, py, mrr] of stops.slice(0, -1)) {
							ctx.beginPath();
							ctx.arc(px, py, Math.max(2.5, bubbleRadius(mrr, chart.width) * 0.35), 0, Math.PI * 2);
							ctx.fillStyle = colors.card;
							ctx.fill();
							ctx.strokeStyle = fade(color, 0.7);
							ctx.lineWidth = 1.25;
							ctx.stroke();
						}
						ctx.restore();
					},
					afterDatasetsDraw(chart) {
						const lead = spotlight();
						if (!lead) return;
						let element = null;
						let point = null;
						for (const [index, set] of chart.data.datasets.entries()) {
							const at = set.data.findIndex((item) => item.product === lead);
							if (at < 0) continue;
							element = chart.getDatasetMeta(index).data[at];
							point = set.data[at];
						}
						if (!element || !point) return;
						const { left, right } = chart.chartArea;
						const radius = element.options ? element.options.radius : 10;
						drawTag(
							chart.ctx,
							colors,
							element.x,
							element.y - radius - 6,
							`${lead} · ${thousands(point.mrr)}`,
							left,
							right,
						);
					},
				},
			],
		};
	}

	/* Quadrants: split at the median price and median repeat share. */
	function quadrantChart(colors, animate) {
		const midPrice = middleOf(REPEAT_POINTS.map((point) => point.x));
		const midShare = middleOf(REPEAT_POINTS.map((point) => point.y));
		const QUARTERS = {
			0: { title: 'Loyal favorites', brief: 'Favorites' },
			2: { title: 'Everyday staples', brief: 'Staples' },
			4: { title: 'Try once', brief: 'Try once' },
			5: { title: 'Big one-offs', brief: 'One-offs' },
		};

		/* The ramp position doubles as the quadrant key; top right takes the
       first color. */
		function quarterOf(point) {
			const dear = point.x >= midPrice;
			if (point.y >= midShare) return dear ? 0 : 2;
			return dear ? 5 : 4;
		}

		const shades = REPEAT_POINTS.map((point) => colors.ramp[quarterOf(point)]);

		return {
			type: 'scatter',
			data: {
				datasets: [
					{
						label: 'Products',
						data: REPEAT_POINTS,
						pointRadius: 5,
						pointHoverRadius: 7,
						pointBackgroundColor: shades,
						pointHoverBackgroundColor: [...shades],
					},
				],
			},
			options: baseConfig(colors, animate, 'Price', 'Buyers who came back', {
				layout: { padding: { top: 8, right: 12 } },
				plugins: {
					tooltip: {
						callbacks: {
							title: (items) => QUARTERS[quarterOf(items[0].raw)].title,
							label: ({ raw }) => ` $${raw.x.toFixed(2)}, ${raw.y}% came back`,
						},
					},
				},
				scales: {
					x: { min: 0, max: 60, ticks: { stepSize: 10, callback: (value) => `$${value}` } },
					y: { min: 0, max: 100, ticks: { stepSize: 25, callback: (value) => `${value}%` } },
				},
			}),
			plugins: [
				{
					id: 'scattersQuadrants',
					beforeDatasetsDraw(chart) {
						const {
							ctx,
							chartArea: area,
							scales: { x, y },
						} = chart;
						const splitX = x.getPixelForValue(midPrice);
						const splitY = y.getPixelForValue(midShare);
						ctx.save();
						/* A faint wash marks the corner every product wants to be in. */
						ctx.fillStyle = fade(colors.ramp[0], 0.06);
						ctx.fillRect(splitX, area.top, area.right - splitX, splitY - area.top);
						ctx.strokeStyle = colors.edge;
						ctx.setLineDash([4, 4]);
						ctx.lineWidth = 1;
						ctx.beginPath();
						ctx.moveTo(splitX, area.top);
						ctx.lineTo(splitX, area.bottom);
						ctx.moveTo(area.left, splitY);
						ctx.lineTo(area.right, splitY);
						ctx.stroke();
						ctx.restore();
					},
					afterDatasetsDraw(chart) {
						const { ctx, chartArea: area } = chart;
						/* Below 460px of plot the tags drop their counts and use short names. */
						const roomy = area.right - area.left > 460;
						const corners = [
							[2, 'left', 'top'],
							[0, 'right', 'top'],
							[4, 'left', 'bottom'],
							[5, 'right', 'bottom'],
						];
						for (const [quarter, side, edge] of corners) {
							const text = roomy
								? `${QUARTERS[quarter].title} · ${REPEAT_POINTS.filter((point) => quarterOf(point) === quarter).length}`
								: QUARTERS[quarter].brief;
							const px = side === 'left' ? area.left + 8 : area.right - 8;
							const py = edge === 'top' ? area.top + 8 + 20 : area.bottom - 8;
							drawTag(ctx, colors, px, py, text, area.left, area.right, side);
						}
					},
				},
			],
		};
	}

	/* Trend line: daily dots with a dashed least-squares fit across them. */
	function trendChart(colors, animate) {
		const line = fitLine(SPEND_DAYS);
		const [start, end] = [0, 320];
		const at = (spend) => ({ x: spend, y: line.intercept + line.slope * spend });

		return {
			type: 'scatter',
			data: {
				datasets: [
					solidDots(colors.ramp[1], { label: 'Days', data: SPEND_DAYS, pointRadius: 4.5 }),
					{
						type: 'line',
						label: 'Fit',
						data: [at(start), at(end)],
						borderColor: colors.ramp[0],
						borderWidth: 2,
						borderDash: [6, 5],
						pointRadius: 0,
						pointHoverRadius: 0,
					},
				],
			},
			options: baseConfig(colors, animate, 'Ad spend', 'Orders', {
				layout: { padding: { top: 8, right: 10 } },
				plugins: {
					tooltip: {
						filter: (item) => item.datasetIndex === 0,
						callbacks: { title: () => '', label: ({ raw }) => ` $${raw.x} spent, ${raw.y} orders` },
					},
				},
				scales: {
					x: { min: start, max: end, ticks: { stepSize: 80, callback: (value) => `$${value}` } },
					y: { min: 30, max: 90, ticks: { stepSize: 15 } },
				},
			}),
			plugins: [
				{
					id: 'scattersR2',
					afterDatasetsDraw(chart) {
						const { left, right, top } = chart.chartArea;
						drawTag(
							chart.ctx,
							colors,
							left + 8,
							top + 26,
							`r² = ${line.r2.toFixed(2)}`,
							left,
							right,
							'left',
						);
					},
				},
			],
		};
	}

	/* Range select: dots outside the chosen distance band fade back. */
	function bandChart(colors, animate) {
		const inBand = (point) => point.x >= view.low && point.x <= view.high;

		return {
			type: 'scatter',
			data: {
				datasets: COURIERS.map(({ name, ramp }, index) => {
					const color = colors.ramp[ramp];
					return {
						label: name,
						data: SHIPMENTS.filter((item) => item.courier === index),
						pointRadius: 4,
						pointHoverRadius: 6,
						pointBackgroundColor: (context) =>
							context.raw && inBand(context.raw) ? color : fade(color, 0.22),
						pointHoverBackgroundColor: color,
						borderColor: color,
					};
				}),
			},
			options: baseConfig(colors, animate, 'Distance (km)', 'Hours in transit', {
				layout: { padding: { top: 8, right: 12 } },
				plugins: {
					tooltip: {
						filter: () => !brushing,
						callbacks: {
							title: (items) => (items.length ? `${items[0].raw.ref} · ${items[0].raw.name}` : ''),
							label: ({ raw }) => ` ${raw.x} km, ${raw.y} hours`,
						},
					},
				},
				scales: {
					x: { min: 0, max: 600, ticks: { stepSize: 100 } },
					y: { min: 0, max: 100, ticks: { stepSize: 25 } },
				},
			}),
			plugins: [
				{
					id: 'scattersBand',
					beforeDatasetsDraw(chart) {
						const {
							ctx,
							chartArea: area,
							scales: { x },
						} = chart;
						const from = x.getPixelForValue(view.low);
						const to = x.getPixelForValue(view.high);
						ctx.save();
						ctx.fillStyle = fade(colors.accent, 0.1);
						ctx.fillRect(from, area.top, Math.max(1, to - from), area.bottom - area.top);
						ctx.strokeStyle = fade(colors.accent, 0.6);
						ctx.lineWidth = 1.5;
						ctx.beginPath();
						for (const edge of [from, to]) {
							ctx.moveTo(edge, area.top);
							ctx.lineTo(edge, area.bottom);
						}
						ctx.stroke();
						ctx.restore();
					},
				},
			],
		};
	}

	/* Clusters: each shopper group sits inside a soft outline (its convex
     hull); the lit group stands out and the others step back. */
	function shopperChart(colors, animate) {
		const hue = (index) => colors.ramp[SHOPPER_TYPES[index].ramp];
		const showing = (index) => view.focus < 0 || view.focus === index;

		return {
			type: 'scatter',
			data: {
				datasets: SHOPPER_TYPES.map(({ name }, index) => ({
					label: name,
					data: SHOPPERS[index],
					pointRadius: 4.5,
					pointHoverRadius: 6.5,
					pointBackgroundColor: () => (showing(index) ? hue(index) : fade(hue(index), 0.18)),
					pointHoverBackgroundColor: hue(index),
					borderColor: hue(index),
				})),
			},
			options: baseConfig(colors, animate, 'Orders a year', 'Average basket', {
				layout: { padding: { top: 8, right: 12 } },
				plugins: {
					tooltip: {
						callbacks: {
							title: (items) => items[0].dataset.label,
							label: ({ raw }) => ` ${raw.x} orders a year, $${raw.y} a basket`,
						},
					},
				},
				scales: {
					x: { min: 0, max: 16, ticks: { stepSize: 4 } },
					y: { min: 0, max: 125, ticks: { stepSize: 25, callback: (value) => `$${value}` } },
				},
				onHover(event, hits) {
					const under = hits.length ? hits[0].datasetIndex : -1;
					if (under !== view.focus && !focusPinned) lightGroup(under);
				},
			}),
			plugins: [
				{
					id: 'scattersHulls',
					beforeDatasetsDraw(chart) {
						const {
							ctx,
							scales: { x, y },
						} = chart;
						ctx.save();
						for (const [index, group] of SHOPPERS.entries()) {
							const outline = hullOf(
								group.map((point) => [x.getPixelForValue(point.x), y.getPixelForValue(point.y)]),
							);
							if (outline.length < 3) continue;
							const lit = view.focus === index;
							const [wash, rim] = lit ? [0.14, 0.6] : showing(index) ? [0.07, 0.3] : [0.03, 0.1];
							tracePath(ctx, outline);
							ctx.closePath();
							ctx.fillStyle = fade(hue(index), wash);
							ctx.fill();
							ctx.strokeStyle = fade(hue(index), rim);
							ctx.lineWidth = 1.25;
							ctx.lineJoin = 'round';
							ctx.stroke();
						}
						ctx.restore();
					},
				},
			],
		};
	}

	/* Highlight one: the chosen city in the first ramp color, the rest gray. */
	function townChart(colors, animate) {
		return {
			type: 'scatter',
			data: {
				datasets: TOWNS.map(({ name }, index) => ({
					label: name,
					data: TOWN_POINTS[index],
					pointHoverRadius: 7,
					...townLook(colors, index === view.town),
				})),
			},
			options: baseConfig(colors, animate, 'Visits a week', 'Days to pay', {
				layout: { padding: { top: 8, right: 12 } },
				plugins: {
					tooltip: {
						callbacks: {
							title: (items) => items[0].dataset.label,
							label: ({ raw }) => ` ${raw.x} visits a week, pays in ${raw.y} days`,
						},
					},
				},
				scales: {
					x: { min: 0, max: 80, ticks: { stepSize: 20 } },
					y: { min: 0, max: 25, ticks: { stepSize: 5 } },
				},
			}),
		};
	}

	/* Labeled bubbles: every product named beside its bubble. */
	function earnerChart(colors, animate, canvas) {
		const sizeFor = (mrr, width) => Math.sqrt(mrr) * 1.6 * bound(width / 800, 0.6, 1);
		const width = canvas.parentElement.clientWidth;

		return {
			type: 'bubble',
			data: {
				datasets: [
					{
						label: 'Products',
						data: EARNERS.map(({ name, growth, margin, mrr }) => ({
							name,
							x: growth,
							y: margin,
							mrr,
							r: sizeFor(mrr, width),
						})),
						backgroundColor: EARNERS.map((_, index) => fade(colors.ramp[index], 0.78)),
						hoverBackgroundColor: EARNERS.map((_, index) => colors.ramp[index]),
						borderColor: EARNERS.map((_, index) => colors.ramp[index]),
						borderWidth: 1.5,
						hoverRadius: 2,
					},
				],
			},
			options: baseConfig(colors, animate, 'Growth on last year', 'Margin', {
				layout: { padding: { top: 10, right: 16 } },
				plugins: {
					tooltip: {
						callbacks: {
							title: (items) => items[0].raw.name,
							label: ({ raw }) => ` ${signed(raw.x)}% growth, ${raw.y}% margin, $${raw.mrr}k MRR`,
						},
					},
				},
				scales: {
					x: { min: -10, max: 50, ticks: { stepSize: 10, callback: (value) => `${signed(value)}%` } },
					y: { min: 15, max: 75, ticks: { stepSize: 15, callback: (value) => `${value}%` } },
				},
				onResize(chart, size) {
					for (const point of chart.data.datasets[0].data) point.r = sizeFor(point.mrr, size.width);
				},
			}),
			plugins: [
				{
					id: 'scattersNames',
					afterDatasetsDraw(chart) {
						const points = chart.data.datasets[0].data;
						const marks = chart.getDatasetMeta(0).data.map((element, index) => ({
							text: points[index].name,
							x: element.x,
							y: element.y,
							r: element.options.radius,
						}));
						/* Largest first, so the biggest earners claim the best spots. */
						marks.sort((a, b) => b.r - a.r);
						placeNames(chart.ctx, colors, chart.chartArea, marks);
					},
				},
			],
		};
	}

	/* Bubble size: delivery regions, near and far, sized by orders. */
	function destinationChart(colors, animate, canvas) {
		const sizeFor = (orders, width) => Math.sqrt(orders) * 0.5 * bound(width / 420, 0.7, 1.2);
		const width = canvas.parentElement.clientWidth;
		const groups = [
			['Near the warehouse', DESTINATIONS.near, 1],
			['Across the country', DESTINATIONS.far, 5],
		];

		return {
			type: 'bubble',
			data: {
				datasets: groups.map(([label, places, ramp]) => ({
					label,
					data: places.map(({ name, days, onTime, orders }) => ({
						name,
						x: days,
						y: onTime,
						orders,
						r: sizeFor(orders, width),
					})),
					backgroundColor: fade(colors.ramp[ramp], 0.55),
					hoverBackgroundColor: fade(colors.ramp[ramp], 0.85),
					borderColor: colors.ramp[ramp],
					borderWidth: 1.5,
					hoverRadius: 2,
				})),
			},
			options: baseConfig(colors, animate, 'Days to arrive', 'On time', {
				layout: { padding: { top: 10, right: 14 } },
				plugins: {
					tooltip: {
						callbacks: {
							title: (items) => items[0].raw.name,
							label: ({ raw }) =>
								` ${raw.x} days, ${raw.y}% on time, ${raw.orders.toLocaleString()} orders`,
						},
					},
				},
				scales: {
					x: { min: 0, max: 10, ticks: { stepSize: 2 } },
					y: {
						min: 60,
						max: 104,
						ticks: { stepSize: 10, callback: (value) => (value > 100 ? '' : `${value}%`) },
					},
				},
				onResize(chart, size) {
					for (const set of chart.data.datasets) {
						for (const point of set.data) point.r = sizeFor(point.orders, size.width);
					}
				},
			}),
		};
	}

	/* Density: see-through dots, so busy hours darken where they pile up. */
	function basketChart(colors, animate) {
		const sets = [
			['Weekday', BASKETS.weekday, colors.ramp[0], 0.3],
			['Weekend', BASKETS.weekend, colors.ramp[4], 0.34],
		];

		return {
			type: 'scatter',
			data: {
				datasets: sets.map(([label, data, color, opacity]) =>
					solidDots(fade(color, opacity), {
						label,
						data,
						pointRadius: 3.5,
						pointHoverRadius: 5.5,
						pointHoverBackgroundColor: color,
					}),
				),
			},
			options: baseConfig(colors, animate, 'Time of day', 'Basket value', {
				layout: { padding: { top: 8, right: 12 } },
				plugins: {
					tooltip: {
						callbacks: {
							title: (items) => items[0].dataset.label,
							label: ({ raw }) => {
								const hour = Math.floor(raw.x);
								const minutes = Math.round((raw.x - hour) * 60);
								return ` ${twoDigits(hour)}:${twoDigits(minutes === 60 ? 59 : minutes)}, $${raw.y}`;
							},
						},
					},
				},
				scales: {
					x: { min: 0, max: 24, ticks: { stepSize: 3, callback: (value) => `${twoDigits(value)}:00` } },
					y: { min: 0, max: 150, ticks: { stepSize: 50, callback: (value) => `$${value}` } },
				},
			}),
		};
	}

	/* Connected: the months joined in order, the color drifting from the
     third ramp color in January to the first in December. */
	function trafficChart(colors, animate) {
		const shadeAt = (index) => blend(colors.ramp[0], colors.ramp[2], index / 11);
		const months = TRAFFIC.map(([sessions, rate], index) => ({ x: sessions, y: rate, month: index }));
		const MARKED = [
			[0, -10, 0, 'right'],
			[6, 0, 16, 'center'],
			[11, -10, 0, 'right'],
		];

		return {
			type: 'scatter',
			data: {
				datasets: [
					{
						label: 'Months',
						data: months,
						showLine: true,
						borderWidth: 2,
						tension: 0.3,
						segment: { borderColor: (part) => shadeAt(part.p1DataIndex) },
						pointRadius: 4.5,
						pointHoverRadius: 6.5,
						pointBackgroundColor: months.map((_, index) => shadeAt(index)),
						pointHoverBackgroundColor: months.map((_, index) => shadeAt(index)),
						pointBorderColor: colors.card,
						pointBorderWidth: 1.5,
					},
				],
			},
			options: baseConfig(colors, animate, 'Sessions', 'Conversion', {
				layout: { padding: { top: 10, right: 14 } },
				plugins: {
					tooltip: {
						callbacks: {
							title: (items) => MONTH_FULL[items[0].raw.month],
							label: ({ raw }) => ` ${raw.x}k sessions, ${raw.y.toFixed(1)}% converted`,
						},
					},
				},
				scales: {
					x: { min: 28, max: 48, ticks: { stepSize: 4, callback: (value) => `${value}k` } },
					y: { min: 3.5, max: 6.5, ticks: { stepSize: 0.5, callback: (value) => `${value.toFixed(1)}%` } },
				},
			}),
			plugins: [
				{
					id: 'scattersMonths',
					afterDatasetsDraw(chart) {
						const elements = chart.getDatasetMeta(0).data;
						for (const [index, dx, dy, align] of MARKED) {
							const element = elements[index];
							if (element)
								drawHaloText(
									chart.ctx,
									colors,
									MONTH_ABBR[index],
									element.x + dx,
									element.y + dy,
									align,
								);
						}
					},
				},
			],
		};
	}

	/* Error bars: a dot for the typical delivery and a whisker from the
     fastest tenth to the slowest. */
	function courierChart(colors, animate) {
		const carriers = COURIER_RANGES.map(({ name, cost, typical, fast, slow, ramp }) => ({
			name,
			x: cost,
			y: typical,
			fast,
			slow,
			ramp,
		}));
		const shades = carriers.map((item) => colors.ramp[item.ramp]);

		return {
			type: 'scatter',
			data: {
				datasets: [
					{
						label: 'Carriers',
						data: carriers,
						pointRadius: 6,
						pointHoverRadius: 8,
						pointBackgroundColor: shades,
						pointHoverBackgroundColor: [...shades],
						pointBorderColor: colors.card,
						pointBorderWidth: 2,
					},
				],
			},
			options: baseConfig(colors, animate, 'Postage per parcel', 'Days to arrive', {
				layout: { padding: { top: 10, right: 14 } },
				plugins: {
					tooltip: {
						callbacks: {
							title: (items) => items[0].raw.name,
							label: ({ raw }) =>
								` $${raw.x.toFixed(2)}, usually ${raw.y} days (${raw.fast} to ${raw.slow})`,
						},
					},
				},
				scales: {
					x: { min: 0, max: 16, ticks: { stepSize: 4, callback: (value) => `$${value}` } },
					y: { min: 0, max: 10, ticks: { stepSize: 2 } },
				},
			}),
			plugins: [
				{
					id: 'scattersWhiskers',
					beforeDatasetsDraw(chart) {
						const {
							ctx,
							scales: { x, y },
						} = chart;
						ctx.save();
						ctx.lineWidth = 2;
						ctx.lineCap = 'round';
						for (const item of carriers) {
							const px = x.getPixelForValue(item.x);
							const top = y.getPixelForValue(item.slow);
							const bottom = y.getPixelForValue(item.fast);
							ctx.strokeStyle = fade(colors.ramp[item.ramp], 0.75);
							ctx.beginPath();
							ctx.moveTo(px, top);
							ctx.lineTo(px, bottom);
							for (const cap of [top, bottom]) {
								ctx.moveTo(px - 6, cap);
								ctx.lineTo(px + 6, cap);
							}
							ctx.stroke();
						}
						ctx.restore();
					},
					afterDatasetsDraw(chart) {
						const {
							ctx,
							scales: { x, y },
						} = chart;
						const marks = carriers.map((item) => ({
							text: item.name,
							x: x.getPixelForValue(item.x),
							y: y.getPixelForValue(item.y),
							r: 7,
						}));
						/* Points along each whisker count as obstacles, so no name lands
             on top of a bar. */
						const whiskers = [];
						for (const item of carriers) {
							for (let days = item.fast; days <= item.slow; days += 0.25) {
								whiskers.push({ x: x.getPixelForValue(item.x), y: y.getPixelForValue(days), r: 5 });
							}
						}
						placeNames(ctx, colors, chart.chartArea, marks, 500, whiskers);
					},
				},
			],
		};
	}

	/* Log scale: price against units a month, both axes logarithmic. */
	function priceChart(colors, animate) {
		const tickIf = (shown, format) => (value) => (shown.includes(value) ? format(value) : '');

		return {
			type: 'scatter',
			data: {
				datasets: FAMILIES.map((family, index) =>
					solidDots(colors.ramp[FAMILY_RAMP[index]], {
						label: family,
						data: PRICE_POINTS[index],
						pointRadius: 4.5,
						pointHoverRadius: 6.5,
					}),
				),
			},
			options: baseConfig(colors, animate, 'Price (log)', 'Units a month (log)', {
				layout: { padding: { top: 8, right: 14 } },
				plugins: {
					tooltip: {
						callbacks: {
							title: (items) => items[0].dataset.label,
							label: ({ raw }) => ` $${raw.x.toFixed(2)}, ${raw.y.toLocaleString()} a month`,
						},
					},
				},
				scales: {
					x: {
						type: 'logarithmic',
						min: 3,
						max: 300,
						ticks: { callback: tickIf([3, 10, 30, 100, 300], (value) => `$${value}`) },
					},
					y: {
						type: 'logarithmic',
						min: 10,
						max: 5000,
						ticks: { callback: tickIf([10, 100, 1000], (value) => value.toLocaleString()) },
					},
				},
			}),
		};
	}

	/* Basic: one set of dots and nothing more. */
	function weightChart(colors, animate) {
		return {
			type: 'scatter',
			data: { datasets: [solidDots(colors.ramp[7], { label: 'Parcels', data: WEIGHTS })] },
			options: baseConfig(colors, animate, 'Weight (kg)', 'Postage', {
				plugins: {
					tooltip: {
						callbacks: { title: () => '', label: ({ raw }) => ` ${raw.x} kg, $${raw.y.toFixed(2)}` },
					},
				},
				scales: {
					x: { min: 0, max: 6, ticks: { stepSize: 1 } },
					y: { min: 0, max: 18, ticks: { stepSize: 6, callback: (value) => `$${value}` } },
				},
			}),
		};
	}

	/* Settings every recipe shares. */

	/**
	 * Options every chart starts from, with `extra` merged in on top. Both axes
	 * carry numbers on a scatter chart, so both get a quiet title.
	 */
	function baseConfig(colors, animate, xTitle, yTitle, extra) {
		const tickStyle = { color: colors.soft, font: { family: TYPEFACE, size: 11.5 }, padding: 8 };
		const axisTitle = (text) => ({
			display: !!text,
			text,
			color: colors.soft,
			font: { family: TYPEFACE, size: 11.5, weight: '500' },
			padding: { top: 6, bottom: 2 },
		});

		return overlaid(
			{
				responsive: true,
				maintainAspectRatio: false,
				animation: animate ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'nearest', intersect: true },
				layout: { padding: { top: 6, right: 8 } },
				elements: {
					point: {
						radius: 4,
						hoverRadius: 6,
						hitRadius: 5,
						borderWidth: 0,
						hoverBorderWidth: 2,
						hoverBorderColor: colors.card,
					},
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: colors.card,
						titleColor: colors.ink,
						bodyColor: colors.ink,
						borderColor: colors.edge,
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
						type: 'linear',
						grid: { display: false },
						border: { color: colors.rule },
						ticks: { maxRotation: 0, maxTicksLimit: 7, ...tickStyle },
						title: axisTitle(xTitle),
					},
					y: {
						grid: { color: colors.rule },
						border: { display: false },
						ticks: { maxTicksLimit: 6, ...tickStyle },
						title: axisTitle(yTitle),
					},
				},
			},
			extra,
		);
	}

	/** A dataset of plain dots that all share one color. */
	function solidDots(color, extra) {
		return {
			backgroundColor: color,
			borderColor: color,
			pointBackgroundColor: color,
			pointHoverBackgroundColor: color,
			...extra,
		};
	}

	/** Copies `base`, merging nested plain objects from `overrides` key by key. */
	function overlaid(base, overrides) {
		const result = { ...base };
		for (const [key, value] of Object.entries(overrides || {})) {
			result[key] = isPlainObject(value) && isPlainObject(result[key]) ? overlaid(result[key], value) : value;
		}
		return result;
	}

	function isPlainObject(value) {
		return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
	}

	/* Colors are plain strings, since the canvas cannot read CSS variables. */

	/** The chart colors for the active theme, read fresh from the tokens. */
	function readColors() {
		const ink = readVar('--basalt-copy', '#12233a');
		const muted = readVar('--basalt-copy-muted', '#5f7186');
		return {
			ramp: Array.from({ length: 8 }, (_, n) => readVar(`--basalt-series-${n + 1}`, '#2b6fd4')),
			ink,
			/* The canvas twin of --scatters-quiet in scatter-charts.css: muted gray
         nudged toward the text color so small labels keep 4.5:1. */
			soft: blend(muted, ink, 0.82),
			dim: fade(ink, 0.18),
			rule: fade(ink, 0.07),
			card: readVar('--basalt-plane', '#ffffff'),
			edge: readVar('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			accent: readVar('--basalt-hue', '#2b6fd4'),
		};
	}

	function readVar(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	function gradientsOff() {
		return html.getAttribute('data-basalt-gradients') === 'off';
	}

	/**
	 * Red, green, blue and alpha of a #rgb, #rrggbb or rgb()/rgba() string.
	 * Chart.js wants finished color strings, so tinting and mixing happen here
	 * instead of through CSS color-mix().
	 */
	function channels(color) {
		const text = String(color || '').trim();
		const short = /^#([0-9a-f]{3})$/i.exec(text);
		if (short) return [...[...short[1]].map((digit) => parseInt(digit + digit, 16)), 1];
		const long = /^#([0-9a-f]{6})$/i.exec(text);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 1];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(text);
		if (functional) {
			const parts = functional[1].split(',').map((part) => parseFloat(part));
			return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
		}
		return [128, 128, 128, 1];
	}

	function fade(color, opacity) {
		const [red, green, blue] = channels(color);
		return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
	}

	/** `weight` of the first color, the rest of the second. */
	function blend(first, second, weight) {
		const a = channels(first);
		const b = channels(second);
		const mixed = [0, 1, 2].map((i) => Math.round(a[i] * weight + b[i] * (1 - weight)));
		return `rgb(${mixed.join(', ')})`;
	}

	/* Shapes and text the plugins paint straight onto the canvas. */

	function tracePath(ctx, points) {
		ctx.beginPath();
		for (const [index, [px, py]] of points.entries()) {
			if (index) ctx.lineTo(px, py);
			else ctx.moveTo(px, py);
		}
	}

	/**
	 * A rounded tag with a label, painted on the canvas. (x, y) is the middle
	 * of its lower edge, or a lower corner when `align` is 'left' or 'right';
	 * the tag is pushed back inside `minX`..`maxX`.
	 */
	function drawTag(ctx, colors, x, y, text, minX, maxX, align) {
		const height = 20;
		ctx.save();
		ctx.font = `600 11px ${TYPEFACE}`;
		const width = ctx.measureText(text).width + 14;
		const start = { left: x, right: x - width }[align] ?? x - width / 2;
		const left = bound(start, minX, maxX - width);
		const top = y - height;
		ctx.fillStyle = colors.card;
		ctx.strokeStyle = colors.edge;
		ctx.lineWidth = 1;
		ctx.beginPath();
		if (ctx.roundRect) ctx.roundRect(left, top, width, height, 10);
		else ctx.rect(left, top, width, height);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = colors.ink;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(text, left + 7, top + height / 2 + 0.5);
		ctx.restore();
	}

	/** Text written straight on the plot, outlined in the card color so it
      stays legible where it crosses a dot or a line. */
	function drawHaloText(ctx, colors, text, x, y, align, weight) {
		ctx.save();
		ctx.font = `${weight || 600} 11.5px ${TYPEFACE}`;
		ctx.textAlign = align || 'left';
		ctx.textBaseline = 'middle';
		ctx.lineJoin = 'round';
		ctx.lineWidth = 4;
		ctx.strokeStyle = colors.card;
		ctx.strokeText(text, x, y);
		ctx.fillStyle = colors.ink;
		ctx.fillText(text, x, y);
		ctx.restore();
	}

	/**
	 * Writes a name beside each mark without two names overlapping. Every mark
	 * tries right, left, above and below; the first spot inside the plot that
	 * touches no placed name and no mark wins, else the one touching fewest
	 * marks. A name that would still cover another is skipped (its tooltip
	 * keeps it). `marks` and `obstacles` are { text, x, y, r } in pixels.
	 */
	function placeNames(ctx, colors, area, marks, weight, obstacles) {
		const solids = [...marks, ...(obstacles || [])];
		const taken = [];
		const height = 14;
		ctx.save();
		ctx.font = `${weight || 600} 11.5px ${TYPEFACE}`;

		for (const mark of marks) {
			const width = ctx.measureText(mark.text).width;
			const gap = mark.r + 6;
			let winner = null;
			let lowest = Infinity;

			for (const spot of spotsAround(mark, width, height, gap)) {
				const box = spot.box;
				const fits =
					box.l >= area.left - 2 && box.r <= area.right + 10 && box.t >= area.top - 4 && box.b <= area.bottom;
				const cost =
					(fits ? 0 : 100) +
					taken.filter((other) => boxesMeet(other, box)).length * 10 +
					solids.filter((other) => other !== mark && boxMeetsCircle(box, other)).length;
				if (cost < lowest) {
					winner = spot;
					lowest = cost;
				}
			}

			if (!winner || lowest >= 10) continue;
			taken.push(winner.box);
			drawHaloText(ctx, colors, mark.text, winner.x, winner.y, winner.align, weight);
		}
		ctx.restore();
	}

	/** The four places a name can go: right, left, above, below the mark. */
	function spotsAround(mark, width, height, gap) {
		const { x, y } = mark;
		return [
			{
				x: x + gap,
				y,
				align: 'left',
				box: { l: x + gap, r: x + gap + width, t: y - height / 2, b: y + height / 2 },
			},
			{
				x: x - gap,
				y,
				align: 'right',
				box: { l: x - gap - width, r: x - gap, t: y - height / 2, b: y + height / 2 },
			},
			{
				x,
				y: y - gap - height / 2 + 2,
				align: 'center',
				box: { l: x - width / 2, r: x + width / 2, t: y - gap - height, b: y - gap },
			},
			{
				x,
				y: y + gap + height / 2 - 2,
				align: 'center',
				box: { l: x - width / 2, r: x + width / 2, t: y + gap, b: y + gap + height },
			},
		];
	}

	function boxesMeet(a, b) {
		return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
	}

	function boxMeetsCircle(box, circle) {
		const nearX = bound(circle.x, box.l, box.r);
		const nearY = bound(circle.y, box.t, box.b);
		return (nearX - circle.x) ** 2 + (nearY - circle.y) ** 2 < (circle.r + 2) ** 2;
	}

	/** Convex hull of pixel points, by Andrew's monotone chain. */
	function hullOf(points) {
		const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
		if (sorted.length < 3) return sorted;
		const lower = halfHull(sorted);
		const upper = halfHull([...sorted].reverse());
		return [...lower.slice(0, -1), ...upper.slice(0, -1)];
	}

	function halfHull(points) {
		const kept = [];
		for (const point of points) {
			while (kept.length >= 2 && turn(kept[kept.length - 2], kept[kept.length - 1], point) <= 0) kept.pop();
			kept.push(point);
		}
		return kept;
	}

	function turn(origin, a, b) {
		return (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0]);
	}

	function fitLine(points) {
		const count = points.length;
		let sumX = 0;
		let sumY = 0;
		for (const point of points) {
			sumX += point.x;
			sumY += point.y;
		}
		const meanX = sumX / count;
		const meanY = sumY / count;
		let both = 0;
		let acrossX = 0;
		let acrossY = 0;
		for (const point of points) {
			both += (point.x - meanX) * (point.y - meanY);
			acrossX += (point.x - meanX) ** 2;
			acrossY += (point.y - meanY) ** 2;
		}
		const slope = both / acrossX;
		return { slope, intercept: meanY - slope * meanX, r2: (both * both) / (acrossX * acrossY) };
	}

	/* The demo data is made from seeded noise, so it never changes. */

	/** One product's twelve months, bent by its seasonal curve plus noise. */
	function yearOf(item, next) {
		const {
			name,
			family,
			accounts: [firstAcc, lastAcc],
			weekly: [firstUse, lastUse],
			price,
			curve,
		} = item;
		return MONTH_ABBR.map((_, month) => {
			const progress = month / 11;
			const count = Math.round(
				(firstAcc + (lastAcc - firstAcc) * progress) * CURVES[curve][month] * (1 + normal(next) * 0.035),
			);
			const use = toPlaces(bound(firstUse + (lastUse - firstUse) * progress + normal(next) * 1.1, 1, 90), 1);
			return { product: name, family, x: count, y: use, mrr: count * price };
		});
	}

	/* Weekend orders: a third come mid-morning, the rest anywhere from nine
     to ten at night, with bigger baskets than in the week. */
	function weekendOrder(next) {
		const hour = next() < 0.35 ? 10.5 + normal(next) * 1.2 : 9 + next() * 13;
		return { hour, basket: Math.exp(Math.log(50) + normal(next) * 0.35) };
	}

	function weekdayOrder(next) {
		const draw = next();
		const peak = WEEKDAY_PEAKS.find((candidate) => draw < candidate.below);
		const hour = peak.hour + normal(next) * peak.spread;
		return { hour, basket: Math.exp(Math.log(34) + normal(next) * 0.33) };
	}

	/**
	 * mulberry32: a tiny seeded generator. The same seed gives the same
	 * numbers on every load, so the demo charts never shift.
	 */
	function mulberry(seed) {
		let state = seed >>> 0;
		return () => {
			state = (state + 0x6d2b79f5) | 0;
			let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
			mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	/** A standard normal draw (Box-Muller) from a uniform generator. */
	function normal(next) {
		let u = next();
		while (!u) u = next();
		return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
	}

	/* Small number and text helpers. */

	function bound(value, low, high) {
		return Math.max(low, Math.min(high, value));
	}

	function toPlaces(value, places) {
		const scale = 10 ** (places || 0);
		return Math.round(value * scale) / scale;
	}

	function middleOf(values) {
		const sorted = [...values].sort((a, b) => a - b);
		const half = sorted.length >> 1;
		return sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2;
	}

	function dollars(value) {
		return `$${Number(value).toLocaleString()}`;
	}

	function thousands(value) {
		return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
	}

	function signed(value) {
		return `${value > 0 ? '+' : ''}${value}`;
	}

	function twoDigits(value) {
		return String(value).padStart(2, '0');
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
