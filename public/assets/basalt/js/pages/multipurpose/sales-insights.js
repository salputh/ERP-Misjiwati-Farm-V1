/**
 * The Sales page (sales-insights.html): everything inside [data-so-root].
 *
 * It reports on what Fieldline customers bought: first subscriptions,
 * upgrades, extra seats and add-ons, and renewals, either paid for online
 * without help (self-serve) or closed by an account executive (sales-led).
 *
 * Bringing your own numbers: put your records in dataset.orders (their
 * fields are listed above generateOrders) or let backend.fetchRange() ask
 * your server for them, then point each backend method at a real endpoint.
 * Every figure, chart and row is derived from the same records, so no two
 * parts of the page can disagree.
 *
 * Add ?state=loading, ?state=empty or ?state=error to the address to
 * preview the waiting, blank and failed screens; after a failure the retry
 * button succeeds.
 *
 * The charts follow recipes from the chart pages: a stacked total
 * (charts-mixed), a bullet (charts-bar), an annotated line and sparklines
 * (charts-line) and bubbles on log axes (charts-scatter). They take their
 * colors from the --basalt-* tokens whenever they draw, and draw again on
 * basalt:appearance. The page header, command menu, segmented control,
 * selects, tabs, filter chips, pager, drawer, tooltips, toasts, skeletons,
 * empty states and live region all come from basalt.js.
 */
(() => {
	'use strict';

	const page = pick('[data-so-root]', document);
	if (!page || typeof Chart === 'undefined') return;

	/* The sample business. Orders are never typed out: generateOrders() grows
     them from these settings with a seeded generator, so each visit shows
     the same history. */
	const dataset = {
		/* First and last day on record. A live app would use today as the last. */
		opens: '2024-10-01',
		closes: '2026-09-30',
		seed: 4107,

		/* Seat prices per month. Paying for a year up front costs ten months. */
		plans: [
			{ id: 'starter', name: 'Basic', perMonth: 15, perYear: 150 },
			{ id: 'growth', name: 'Pro', perMonth: 32, perYear: 320 },
			{ id: 'enterprise', name: 'Max', perMonth: 58, perYear: 580, floor: 2500 },
		],
		/* Charged per seat, per account, or per text message in prepaid bundles. */
		extras: [
			{ name: 'Travel Planner', seatMonthly: 8 },
			{ name: 'Customer Portal', accountMonthly: 199 },
			{ name: 'SMS credits', messageRate: 0.02, bundles: [10000, 25000, 50000, 100000] },
		],
		regions: [
			{ id: 'northeast', name: 'Northeast', abbr: 'Northeast', share: 0.45 },
			{ id: 'midwest', name: 'Midwest', abbr: 'Midwest', share: 0.31 },
			{ id: 'west', name: 'West', abbr: 'West', share: 0.16 },
			{ id: 'south', name: 'South', abbr: 'South', share: 0.08 },
		],
		channels: [
			{ id: 'self', name: 'Self-serve' },
			{ id: 'sales', name: 'Sales-led' },
		],
		kinds: [
			{ id: 'new', name: 'New' },
			{ id: 'expansion', name: 'Expansion' },
			{ id: 'renewal', name: 'Renewal' },
		],
		/* Account executives, each working one territory. */
		sellers: [
			{ name: 'Isabel Ashby', region: 'northeast' },
			{ name: 'Caleb Finley', region: 'northeast' },
			{ name: 'Carly Bridges', region: 'midwest' },
			{ name: 'Reggie Doyle', region: 'midwest' },
			{ name: 'Mae Morrow', region: 'west' },
			{ name: 'Valerie Ogden', region: 'south' },
		],
		/* A customer is called by one word from the first list and one phrase
       from the second. */
		nameParts: [
			[
				'Alderline',
				'Bluepeak',
				'Brightfield',
				'Cobalt',
				'Cresthaven',
				'Driftwood',
				'Elmstone',
				'Fernway',
				'Foxglove',
				'Granite',
				'Hollowell',
				'Ironbark',
				'Avocet',
				'Larchmont',
				'Lakeside',
				'Mapleton',
				'Oakhaven',
				'Northstar',
				'Northgate',
				'Oakridge',
				'Larchwood',
				'Quarry',
				'Redwater',
				'Ridgeline',
				'Silverline',
				'Stonebridge',
				'Highpoint',
				'Trueline',
				'Upland',
				'Valley',
				'Waypoint',
				'Westbrook',
				'Keystone',
				'Zenith',
				'Ashgrove',
				'Copperfield',
			],
			[
				'Care & Support',
				'Pet Care',
				'Studios',
				'Cleaning',
				'Care',
				'Home Help',
				'Pet Sitting Co',
				'Photography',
				'Home Care Group',
				'Janitorial',
				'Senior Care Team',
				'Home Services',
				'Facility Services',
				'Dog Walking Club',
				'Film & Photography',
				'Commercial Cleaning',
				'Nursing Services',
				'Movers',
				'Relocations',
				'Property Services',
			],
		],
		/* For each kind and channel: orders per day when the record opens, how
       much that has grown by the last day and, for sales-led deals, the
       share that is won (first day, last day). Weekends, months and
       quarter ends bend the curve further. */
		streams: [
			{ kind: 'new', channel: 'self', daily: 1.1, lift: 0.75 },
			{ kind: 'new', channel: 'sales', daily: 0.28, lift: 0.7, close: [0.27, 0.35] },
			{ kind: 'expansion', channel: 'self', daily: 1.1, lift: 0.8 },
			{ kind: 'expansion', channel: 'sales', daily: 0.18, lift: 0.8, close: [0.5, 0.58] },
			{ kind: 'renewal', channel: 'self', daily: 0.95, lift: 0.7 },
			{ kind: 'renewal', channel: 'sales', daily: 0.17, lift: 0.7 },
		],
		/* A weight for each month, starting with January. */
		months: [1.05, 1, 1.08, 1, 1, 1.06, 0.92, 0.88, 1.04, 1.02, 1, 0.85],
		/* generateOrders() fills this in; your own records go here instead. */
		orders: [],
	};

	/* Days are whole numbers counted from dataset.opens, so a range is just
     two numbers and an order's date is one. */
	const dayOne = isoToDate(dataset.opens);
	const finalDay = dateToDay(isoToDate(dataset.closes));
	const lastDate = dayToDate(finalDay);

	const planById = keyById(dataset.plans);
	const regionById = keyById(dataset.regions);
	const channelById = keyById(dataset.channels);
	const kindById = keyById(dataset.kinds);

	const quickRanges = [
		{
			id: '7d',
			name: 'Last 7 days',
			hint: 'A week to date',
			keywords: 'week',
			span: () => ({ from: finalDay - 6, to: finalDay }),
		},
		{
			id: '30d',
			name: 'Last 30 days',
			hint: 'About a month',
			keywords: 'month',
			span: () => ({ from: finalDay - 29, to: finalDay }),
		},
		{
			id: '90d',
			name: 'Last 90 days',
			hint: 'About a quarter',
			keywords: 'quarter three months',
			span: () => ({ from: finalDay - 89, to: finalDay }),
		},
		{
			id: 'qtd',
			name: 'This quarter',
			hint: 'From the first of the quarter',
			keywords: 'quarter to date',
			span: () => ({
				from: dateToDay(new Date(lastDate.getFullYear(), Math.floor(lastDate.getMonth() / 3) * 3, 1)),
				to: finalDay,
			}),
		},
		{
			id: 'ytd',
			name: 'Year to date',
			hint: 'From January 1',
			keywords: 'year this',
			span: () => ({ from: dateToDay(new Date(lastDate.getFullYear(), 0, 1)), to: finalDay }),
		},
		{
			id: '12m',
			name: 'Last 12 months',
			hint: 'A full year',
			keywords: 'year annual twelve',
			span: () => ({ from: sameDayLastYear(finalDay) + 1, to: finalDay }),
		},
	];
	const quickRangeById = keyById(quickRanges);

	const STATUS_BADGES = {
		paid: ['Paid', 'success'],
		invoiced: ['Invoiced', 'info'],
		overdue: ['Overdue', 'danger'],
		retrying: ['Card retrying', 'warning'],
	};
	const KIND_TONES = { new: 1, expansion: 2, renewal: 3 };
	const FONT_STACK = "'Schibsted Grotesk', sans-serif";
	const AXIS_FONT = { family: FONT_STACK, size: 11.5 };
	const EMPTY_ART =
		'<svg class="basalt-illo basalt-illo-float" viewBox="0 0 160 120" aria-hidden="true" focusable="false"><ellipse class="basalt-illo-shadow" cx="80" cy="110" rx="46" ry="5"/><rect class="basalt-illo-card" x="30" y="16" width="100" height="82" rx="10"/><rect class="basalt-illo-mute" x="44" y="66" width="12" height="18" rx="3"/><rect class="basalt-illo-mute" x="62" y="54" width="12" height="30" rx="3"/><rect class="basalt-illo-mute" x="80" y="60" width="12" height="24" rx="3"/><rect class="basalt-illo-mute" x="98" y="44" width="12" height="40" rx="3"/><rect class="basalt-illo-mute" x="44" y="28" width="40" height="6" rx="3"/></svg>';

	/* ?state= picks a demo screen; it is carried along in every address. */
	const demoMode = new URLSearchParams(location.search).get('state') || '';
	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* What the visitor is looking at. The range, comparison and filters live
     in the address; the table's own choices do not. */
	const settings = readSettings(new URLSearchParams(location.search));
	const listing = { kind: 'all', term: '', order: { by: 'id', way: 'desc' }, slice: null, rows: [] };
	const pagerSetup = { total: 0, noun: 'orders', render: paintRows };
	const ui = {};
	const liveCharts = new Map();
	const drawnOnce = new Set();

	let report = null;
	let watcher = null;
	let pager = null;
	let requestsMade = 0;
	let latestRequest = 0;
	let typingTimer = 0;
	let openIndex = -1;
	let returnFocus = null;
	let tilesCounted = false;

	/* Each backend method stands for one request. The demo answers from
     dataset after a short pause; replace the bodies with fetch() calls and
     keep what they resolve to. */
	const backend = {
		/* GET /api/orders?from=&to=&compareFrom=&compareTo=&plan=&region=&channel=
       resolves to { current: [order], previous: [order] | null }: the won
       orders and lost sales-led deals in each range that pass the filters.
       The page does its own adding up. */
		fetchRange(request) {
			requestsMade += 1;
			if (demoMode === 'loading') return new Promise(() => {});
			return pause(demoMode ? 700 : 320).then(() => {
				if (demoMode === 'error' && requestsMade === 1) throw new Error('The server did not answer');
				if (demoMode === 'empty') return { current: [], previous: request.compare ? [] : null };
				return {
					current: ordersWithin(request.from, request.to, request.filters),
					previous: request.compare
						? ordersWithin(request.compare.from, request.compare.to, request.filters)
						: null,
				};
			});
		},
		/* GET /api/orders/:id resolves to one order with its lines. */
		fetchOrder(id) {
			return pause(60).then(() => dataset.orders.find((order) => order.id === id));
		},
		/* POST /api/orders/export with { ids } resolves to CSV text or a link. */
		exportCsv(rows) {
			return pause(150).then(() => csvFrom(rows));
		},
		/* POST /api/orders/:id/receipt resolves once the copy is on its way. */
		emailReceipt(id) {
			return pause(300).then(() => id);
		},
	};

	/** Grows the dataset, builds the generated controls, binds every handler and asks for the first report. */
	function start() {
		dataset.orders = generateOrders(dataset);
		collectParts();
		watcher =
			'IntersectionObserver' in window
				? new IntersectionObserver(revealCharts, { rootMargin: '80px 0px' })
				: null;
		document.addEventListener('basalt:appearance', () => requestAnimationFrame(() => redrawCharts(false)));

		buildRangeMenu();
		buildFilterMenus();
		bindControls();
		ui.notice.addEventListener('click', onNoticeAction);
		page.addEventListener('click', (event) => {
			const drill = event.target.closest('[data-so-drill]');
			if (drill) showBucketOrders(+drill.getAttribute('data-so-drill'));
		});
		buildKindTabs();
		bindListing();
		bindDrawer();
		bindExports();

		requestReport();
	}

	function collectParts() {
		Object.assign(ui, {
			board: pick('[data-so-board]'),
			notice: pick('[data-so-state]'),
			rangeButton: pick('[data-so-range-btn]'),
			fromField: pick('[data-so-from]'),
			toField: pick('[data-so-to]'),
			rangeError: pick('[data-so-custom-error]'),
			filters: Object.fromEntries(
				pickAll('[data-so-filter]').map((menu) => [menu.getAttribute('data-so-filter'), menu]),
			),
			resetButton: pick('[data-so-reset]'),
			canvases: pickAll('canvas[data-so-chart]'),
			kindTabs: pick('[data-so-types]'),
			tbody: pick('[data-so-rows]'),
			noRows: pick('[data-so-rows-empty]'),
			search: pick('[data-so-search]'),
			appliedChips: pick('[data-so-applied]'),
			pagerBox: pick('[data-so-pager]'),
			pageSize: pick('#so-per'),
			drawer: pick('[data-so-drawer]'),
		});
	}

	/* Small DOM and text helpers. */

	function pick(selector, scope = page) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = page) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => entities[char]);
	}

	function notify(message) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(message) : null;
	}

	function announce(text) {
		if (window.Basalt.announce) window.Basalt.announce(text);
	}

	function keyById(items) {
		return Object.fromEntries(items.map((item) => [item.id, item]));
	}

	function pause(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/* Numbers and dates as the page writes them. Negative amounts use a true
     minus sign. */

	function dollars(amount) {
		return `${amount < 0 ? '−' : ''}$${Math.abs(Math.round(amount)).toLocaleString('en-US')}`;
	}

	/** $1.25M, $48.2k or $310: short enough for a tile, a tick or a bar label. */
	function compactMoney(amount) {
		const size = Math.abs(amount);
		const minus = amount < 0 ? '−' : '';
		function tidy(text) {
			return text.replace(/\.0+$/, '');
		}
		if (size >= 1e6) return `${minus}$${tidy((size / 1e6).toFixed(size >= 1e7 ? 1 : 2))}M`;
		if (size >= 1e3) return `${minus}$${tidy((size / 1e3).toFixed(size >= 1e5 ? 0 : 1))}k`;
		return `${minus}$${Math.round(size)}`;
	}

	function whole(number) {
		return Math.round(number).toLocaleString('en-US');
	}

	function percent(share) {
		return `${(share * 100).toFixed(1)}%`;
	}

	function signOf(number) {
		if (number > 0) return '+';
		return number < 0 ? '−' : '';
	}

	function signedMoney(amount) {
		return signOf(amount) + compactMoney(Math.abs(amount)).replace('−', '');
	}

	function signedPercent(ratio, digits = 1) {
		return `${signOf(ratio)}${Math.abs(ratio * 100).toFixed(digits)}%`;
	}

	/** The relative change from before to now, or null when before is zero. */
	function growthRatio(now, before) {
		return before ? (now - before) / before : null;
	}

	function longDate(day, format) {
		return dayToDate(day).toLocaleDateString(
			'en-US',
			format || { month: 'short', day: 'numeric', year: 'numeric' },
		);
	}

	function shortDate(day) {
		return longDate(day, { month: 'short', day: 'numeric' });
	}

	function rangeText(span) {
		return `${longDate(span.from)} – ${longDate(span.to)}`;
	}

	function totalValue(orders) {
		return orders.reduce((running, order) => running + order.value, 0);
	}

	/* Day numbers, dates and ISO strings. */

	function isoToDate(iso) {
		const [year, month, date] = iso.split('-').map(Number);
		return new Date(year, month - 1, date);
	}

	function dayToDate(day) {
		return new Date(dayOne.getFullYear(), dayOne.getMonth(), dayOne.getDate() + day);
	}

	function dateToDay(date) {
		const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		return Math.round((midnight - dayOne) / 864e5);
	}

	function dayToIso(day) {
		const date = dayToDate(day);
		function twoDigits(number) {
			return String(number).padStart(2, '0');
		}
		return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
	}

	function sameDayLastYear(day) {
		const date = dayToDate(day);
		return dateToDay(new Date(date.getFullYear() - 1, date.getMonth(), date.getDate()));
	}

	/* The sample orders.

     Each record looks like
       { id, day, account, region, channel, type, plan, seats, billing,
         value, lines: [[label, amount]], detail, rep, cycle, outcome,
         status }
     day      days since dataset.opens (convert your own dates with dateToDay)
     value    yearly contract value in dollars, the sum of its lines
     outcome  'won', or 'lost' for a sales-led deal that never closed; lost
              deals are not orders and only feed the win rate
     status   paid, invoiced, overdue, retrying or lost */

	/** A small seeded generator (mulberry32): the same seed gives the same run of numbers. */
	function seededRandom(seed) {
		let state = seed >>> 0;
		return () => {
			state = (state + 0x6d2b79f5) >>> 0;
			let mixed = state;
			mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	/**
	 * Plays the record forward one day at a time, drawing a Poisson number
	 * of arrivals from every stream, and numbers the result in order.
	 * @param {object} source the sample settings
	 * @returns {object[]} won orders and lost deals, oldest first
	 */
	function generateOrders(source) {
		const random = seededRandom(source.seed);
		const made = [];

		function anyOf(list) {
			return list[Math.floor(random() * list.length)];
		}

		function rollBetween(low, high) {
			return low + Math.floor(random() * (high - low + 1));
		}

		function odds(share) {
			return random() < share;
		}

		function planNamed(id) {
			return source.plans.find((plan) => plan.id === id);
		}

		function sumLines(lines) {
			return lines.reduce((running, line) => running + line[1], 0);
		}

		function arrivals(mean) {
			const threshold = Math.exp(-mean);
			let count = 0;
			let product = 1;
			do {
				count += 1;
				product *= random();
			} while (product > threshold);
			return count - 1;
		}

		function territory() {
			let roll = random();
			for (const region of source.regions) {
				roll -= region.share;
				if (roll <= 0) return region.id;
			}
			return source.regions[0].id;
		}

		function seatsLine(plan, seats, billing) {
			const yearly = billing === 'annual' ? plan.perYear : plan.perMonth * 12;
			return [
				`${plan.name} plan, ${seats} seats, billed ${billing === 'annual' ? 'yearly' : 'monthly'}`,
				seats * yearly,
			];
		}

		/* An add-on as an order line, priced for twelve months. */
		function extraLine(extra, seats) {
			if (extra.seatMonthly) return [`${extra.name}, ${seats} seats`, extra.seatMonthly * 12 * seats];
			if (extra.accountMonthly)
				return [`${extra.name}, $${extra.accountMonthly} a month`, extra.accountMonthly * 12];
			const messages = anyOf(extra.bundles);
			return [
				`${extra.name}, ${messages.toLocaleString('en-US')} messages`,
				Math.round(messages * extra.messageRate),
			];
		}

		/* A sales-led Max contract never comes in under the plan's floor. */
		function enforceFloor(order, plan) {
			if (!plan.floor) return;
			const subtotal = sumLines(order.lines);
			const yearlyFloor = plan.floor * 12;
			if (subtotal < yearlyFloor)
				order.lines.push([
					`${plan.name} minimum, $${plan.floor.toLocaleString('en-US')} a month`,
					yearlyFloor - subtotal,
				]);
		}

		/* The three kinds of purchase. Each sets the plan, seats, lines and
       detail, and the random draws happen in a fixed order. */
		const purchases = {
			new(order, viaSales) {
				const plan = viaSales
					? planNamed(odds(0.4) ? 'growth' : 'enterprise')
					: planNamed(odds(0.68) ? 'starter' : 'growth');
				if (viaSales) order.seats = plan.id === 'growth' ? rollBetween(20, 60) : rollBetween(40, 160);
				else order.seats = plan.id === 'starter' ? rollBetween(3, 12) : rollBetween(6, 25);
				if (!viaSales) order.billing = odds(plan.id === 'starter' ? 0.62 : 0.45) ? 'monthly' : 'annual';
				order.lines.push(seatsLine(plan, order.seats, order.billing));
				if (viaSales && odds(0.45)) order.lines.push(extraLine(anyOf(source.extras.slice(0, 2)), order.seats));
				order.detail = `New ${plan.name} subscription`;
				return plan;
			},
			expansion(order, viaSales) {
				const roll = random();
				if (roll < 0.55) {
					const plan = viaSales
						? planNamed(odds(0.35) ? 'growth' : 'enterprise')
						: planNamed(odds(0.55) ? 'starter' : 'growth');
					order.seats = viaSales ? rollBetween(10, 45) : rollBetween(2, 8);
					if (!viaSales) order.billing = odds(0.5) ? 'monthly' : 'annual';
					order.lines.push(seatsLine(plan, order.seats, order.billing));
					order.detail = `Added ${order.seats} seats`;
					return plan;
				}
				if (roll < 0.8) {
					const previous = planNamed(viaSales ? 'growth' : 'starter');
					const plan = planNamed(viaSales ? 'enterprise' : 'growth');
					order.seats = viaSales ? rollBetween(25, 100) : rollBetween(5, 20);
					order.lines.push(seatsLine(plan, order.seats, order.billing));
					order.lines.push([
						`${previous.name} plan credit, ${order.seats} seats`,
						-order.seats * previous.perYear,
					]);
					order.detail = `Upgraded ${previous.name} to ${plan.name}`;
					return plan;
				}
				const plan = viaSales ? planNamed(odds(0.3) ? 'growth' : 'enterprise') : planNamed('growth');
				order.seats = viaSales ? rollBetween(30, 140) : rollBetween(6, 25);
				const extra = anyOf(source.extras);
				order.lines.push(extraLine(extra, order.seats));
				order.detail = `Added ${extra.name}`;
				return plan;
			},
			renewal(order, viaSales) {
				const plan = viaSales
					? planNamed(odds(0.45) ? 'growth' : 'enterprise')
					: planNamed(odds(0.6) ? 'starter' : 'growth');
				if (viaSales) order.seats = plan.id === 'growth' ? rollBetween(20, 70) : rollBetween(35, 150);
				else order.seats = plan.id === 'starter' ? rollBetween(3, 12) : rollBetween(6, 28);
				order.lines.push(seatsLine(plan, order.seats, order.billing));
				if (viaSales && odds(0.5)) order.lines.push(extraLine(anyOf(source.extras.slice(0, 2)), order.seats));
				order.detail = 'Renewed for a year';
				return plan;
			},
		};

		/* Where the money stands on the last day of the record. */
		function paymentStatus(order, viaSales) {
			const age = finalDay - order.day;
			if (order.outcome === 'lost') return 'lost';
			if (!viaSales) return age <= 14 && odds(0.04) ? 'retrying' : 'paid';
			if (age <= 30) return odds(0.55) ? 'invoiced' : 'paid';
			if (age <= 75) return odds(0.07) ? 'overdue' : 'paid';
			return 'paid';
		}

		function makeOrder(stream, day, progress) {
			const viaSales = stream.channel === 'sales';
			const order = {
				day,
				channel: stream.channel,
				type: stream.kind,
				region: territory(),
				billing: 'annual',
				lines: [],
			};
			order.account = `${anyOf(source.nameParts[0])} ${anyOf(source.nameParts[1])}`;
			const plan = purchases[stream.kind](order, viaSales);
			order.plan = plan.id;
			if (viaSales) {
				const discount = {
					new: () => rollBetween(6, 18),
					renewal: () => rollBetween(5, 12),
					expansion: () => rollBetween(0, 10),
				}[stream.kind]();
				const subtotal = sumLines(order.lines);
				if (discount)
					order.lines.push([`Contract discount, ${discount}%`, -Math.round((subtotal * discount) / 100)]);
				if (stream.kind !== 'expansion') enforceFloor(order, plan);
				order.rep = anyOf(source.sellers.filter((seller) => seller.region === order.region)).name;
				order.cycle = {
					new: () => rollBetween(20, 75),
					expansion: () => rollBetween(10, 40),
					renewal: () => rollBetween(15, 30),
				}[stream.kind]();
			}
			order.value = Math.round(sumLines(order.lines));
			order.outcome = 'won';
			if (stream.close && !odds(stream.close[0] + (stream.close[1] - stream.close[0]) * progress))
				order.outcome = 'lost';
			order.status = paymentStatus(order, viaSales);
			return order;
		}

		for (let day = 0; day <= finalDay; day += 1) {
			const date = dayToDate(day);
			const progress = day / finalDay;
			const weekend = date.getDay() === 0 || date.getDay() === 6;
			const quarterClose = date.getMonth() % 3 === 2 && date.getDate() >= 20;
			const monthWeight = source.months[date.getMonth()];
			for (const stream of source.streams) {
				const viaSales = stream.channel === 'sales';
				const mean =
					stream.daily *
					(1 + stream.lift * progress) *
					monthWeight *
					(weekend ? (viaSales ? 0.1 : 0.6) : 1) *
					(viaSales && quarterClose ? 1.6 : 1);
				for (let left = arrivals(mean); left > 0; left -= 1) made.push(makeOrder(stream, day, progress));
			}
		}

		const nextNumber = { won: 24001, lost: 8001 };
		for (const order of made) {
			order.id = order.outcome === 'won' ? `#${nextNumber.won++}` : `#${nextNumber.lost++}`;
		}
		return made;
	}

	function ordersWithin(from, to, filters) {
		return dataset.orders.filter(
			(order) =>
				order.day >= from &&
				order.day <= to &&
				(!filters.plan || order.plan === filters.plan) &&
				(!filters.region || order.region === filters.region) &&
				(!filters.channel || order.channel === filters.channel),
		);
	}

	/* The address. Anything left at its default stays out of it. */

	function readSettings(address) {
		function validDay(key) {
			const value = address.get(key);
			if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
			const day = dateToDay(isoToDate(value));
			return day >= 0 && day <= finalDay ? day : null;
		}

		function known(lookup, key) {
			return lookup[address.get(key)] ? address.get(key) : '';
		}

		const chosen = {
			range: known(quickRangeById, 'range') || '12m',
			from: null,
			to: null,
			compare: ['prev', 'year', 'off'].includes(address.get('compare')) ? address.get('compare') : 'prev',
			plan: known(planById, 'plan'),
			region: known(regionById, 'region'),
			channel: known(channelById, 'channel'),
		};
		const from = validDay('from');
		const to = validDay('to');
		if (address.get('range') === 'custom' && from != null && to != null && from <= to) {
			Object.assign(chosen, { range: 'custom', from, to });
		}
		return chosen;
	}

	function writeAddress() {
		const address = new URLSearchParams();
		if (demoMode) address.set('state', demoMode);
		if (settings.range !== '12m') address.set('range', settings.range);
		if (settings.range === 'custom') {
			address.set('from', dayToIso(settings.from));
			address.set('to', dayToIso(settings.to));
		}
		if (settings.compare !== 'prev') address.set('compare', settings.compare);
		for (const key of ['plan', 'region', 'channel']) {
			if (settings[key]) address.set(key, settings[key]);
		}
		const query = address.toString();
		history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash);
	}

	function hasFilters() {
		return settings.plan || settings.region || settings.channel;
	}

	function clearFilters() {
		settings.plan = '';
		settings.region = '';
		settings.channel = '';
	}

	/* Ranges, comparisons and the buckets a range is cut into. */

	function currentSpan() {
		if (settings.range === 'custom') return { from: settings.from, to: settings.to };
		return (quickRangeById[settings.range] || quickRangeById['12m']).span();
	}

	/** The range to compare with, flagged partial when it reaches back before the first record. */
	function comparisonFor(mode, span) {
		if (mode === 'off') return null;
		const other =
			mode === 'year'
				? { from: sameDayLastYear(span.from), to: sameDayLastYear(span.to) }
				: { from: span.from - (span.to - span.from + 1), to: span.from - 1 };
		/* Nothing exists before the first day, so comparing with it would read
       as growth that never happened. */
		if (other.from < 0) other.partial = true;
		return other;
	}

	function grainFor(span) {
		const days = span.to - span.from + 1;
		if (days <= 31) return 'day';
		return days <= 120 ? 'week' : 'month';
	}

	/** Cuts a range into days, weeks counted from its first day, or calendar months. */
	function splitRange(span, grain) {
		const crossesYear = dayToDate(span.from).getFullYear() !== dayToDate(span.to).getFullYear();
		const describe = {
			day: (first) => ({
				to: first,
				label: shortDate(first),
				long: longDate(first, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
			}),
			week(first) {
				const to = Math.min(span.to, first + 6);
				return {
					to,
					label: shortDate(first),
					long: to === first + 6 ? `Week of ${longDate(first)}` : `${shortDate(first)} – ${longDate(to)}`,
				};
			},
			month(first) {
				const date = dayToDate(first);
				const monthEnd = dateToDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
				const to = Math.min(span.to, monthEnd);
				const full = first === dateToDay(new Date(date.getFullYear(), date.getMonth(), 1)) && to === monthEnd;
				return {
					to,
					label:
						date.toLocaleDateString('en-US', { month: 'short' }) +
						(crossesYear ? ` ’${String(date.getFullYear()).slice(2)}` : ''),
					long: full
						? date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
						: `${shortDate(first)} – ${longDate(to)}`,
				};
			},
		};
		const pieces = [];
		for (let first = span.from; first <= span.to;) {
			const { to, label, long } = describe[grain](first);
			pieces.push({ from: first, to, label, long });
			first = to + 1;
		}
		return pieces;
	}

	/* Adding up. */

	/* Win rate counts sales-led new business and expansion only. */
	function countsAsDeal(order) {
		return order.channel === 'sales' && order.type !== 'renewal';
	}

	function tally(orders) {
		const won = orders.filter((order) => order.outcome === 'won');
		const deals = orders.filter(countsAsDeal);
		const dealsWon = deals.filter((order) => order.outcome === 'won').length;
		const value = totalValue(won);
		const byType = {};
		for (const kind of dataset.kinds) byType[kind.id] = totalValue(won.filter((order) => order.type === kind.id));
		return {
			won,
			value,
			orders: won.length,
			average: won.length ? value / won.length : 0,
			dealsWon,
			dealsLost: deals.length - dealsWon,
			rate: deals.length ? dealsWon / deals.length : null,
			byType,
		};
	}

	function tallyEach(orders, buckets) {
		return buckets.map((bucket) => ({
			bucket,
			...tally(orders.filter((order) => order.day >= bucket.from && order.day <= bucket.to)),
		}));
	}

	/** Works out, once per load, every figure the charts, tiles and tables read. */
	function buildReport(data, chosen) {
		const span = currentSpan();
		const against = comparisonFor(chosen.compare, span);
		const grain = grainFor(span);
		const rateGrain = grain === 'day' ? 'week' : grain;
		const earlier = data.previous && against && !against.partial ? data.previous : null;
		const now = tally(data.current);
		const before = earlier ? tally(earlier) : null;

		const plans = dataset.plans
			.filter((plan) => !chosen.plan || plan.id === chosen.plan)
			.map((plan) => {
				const sold = now.won.filter((order) => order.plan === plan.id);
				return {
					plan,
					value: totalValue(sold),
					orders: sold.length,
					prev: before ? totalValue(before.won.filter((order) => order.plan === plan.id)) : null,
				};
			});

		const spots = [];
		for (const channel of dataset.channels) {
			for (const region of dataset.regions) {
				const sold = now.won.filter((order) => order.channel === channel.id && order.region === region.id);
				if (!sold.length) continue;
				const value = totalValue(sold);
				spots.push({ region, channel, orders: sold.length, value, average: value / sold.length });
			}
		}

		return {
			span,
			against,
			grain,
			rateGrain,
			compared: !!earlier,
			compareName: chosen.compare === 'year' ? 'Same period last year' : 'Previous period',
			now,
			before,
			buckets: tallyEach(data.current, splitRange(span, grain)),
			priorBuckets: earlier ? tallyEach(earlier, splitRange(against, grain)) : null,
			rateBuckets: tallyEach(data.current, splitRange(span, rateGrain)),
			priorRateBuckets: earlier ? tallyEach(earlier, splitRange(against, rateGrain)) : null,
			plans,
			spots,
		};
	}

	function compareWords() {
		return report.compareName === 'Previous period' ? 'previous period' : 'same period last year';
	}

	function noDealsAnywhere() {
		return report.now.rate == null && !(report.before && report.before.rate != null);
	}

	/* The range menu, the filter menus and the controls around them. */

	function buildRangeMenu() {
		const items = quickRanges.map((preset) =>
			[
				`<div class="basalt-command-item" role="option" id="so-range-${preset.id}" aria-selected="false" data-value="${preset.id}" data-keywords="${htmlSafe(preset.keywords)}">`,
				'<span class="basalt-command-icon" aria-hidden="true"><i class="bi bi-calendar-range"></i></span>',
				`<span class="basalt-command-text"><span class="basalt-command-title">${htmlSafe(preset.name)}</span><span class="basalt-command-sub">${htmlSafe(preset.hint)}</span></span>`,
				'<span class="basalt-command-hint so-range-now" data-so-now hidden><i class="bi bi-check2" aria-hidden="true"></i>Showing</span>',
				'</div>',
			].join(''),
		);
		pick('[data-so-range-list]').innerHTML =
			`<div class="basalt-command-group" role="group" aria-labelledby="so-range-head"><div class="basalt-command-heading" id="so-range-head">Ranges</div>${items.join('')}</div>`;
		for (const field of [ui.fromField, ui.toField]) {
			field.min = dataset.opens;
			field.max = dataset.closes;
		}
	}

	function buildFilterMenus() {
		const choices = {
			plan: ['All plans', dataset.plans],
			region: ['All regions', dataset.regions],
			channel: ['All channels', dataset.channels],
		};
		for (const [key, [anyLabel, items]] of Object.entries(choices)) {
			const options = items.map((item) => `<option value="${item.id}">${htmlSafe(item.name)}</option>`).join('');
			ui.filters[key].innerHTML = `<option value="">${anyLabel}</option>${options}`;
		}
	}

	function bindControls() {
		page.addEventListener('basalt:command', (event) => {
			if (!event.target.closest('[data-so-range-command]')) return;
			const id = event.detail && event.detail.value;
			if (!quickRangeById[id]) return;
			settings.range = id;
			applyChange(`Showing ${quickRangeById[id].name.toLowerCase()}`);
		});
		pick('[data-so-custom]').addEventListener('submit', onCustomRange);
		pick('[data-so-compare]').addEventListener('change', (event) => {
			const choice = event.target;
			if (!choice.matches('input[name="so-compare"]') || choice.value === settings.compare) return;
			settings.compare = choice.value;
			if (settings.compare === 'off') applyChange('Comparison off');
			else
				applyChange(
					`Comparing with the ${settings.compare === 'year' ? 'same period last year' : 'previous period'}`,
				);
		});
		for (const [key, menu] of Object.entries(ui.filters)) {
			menu.addEventListener('change', () => {
				if (menu.value === settings[key]) return;
				settings[key] = menu.value;
				applyChange();
			});
		}
		ui.resetButton.addEventListener('click', () => {
			clearFilters();
			applyChange('Showing every sale again');
			ui.filters.plan.focus();
		});
		pick('[data-so-compare-on]').addEventListener('click', () => {
			settings.compare = 'prev';
			applyChange('Comparing with the previous period');
		});
	}

	function onCustomRange(event) {
		event.preventDefault();
		const { fromField, toField, rangeError } = ui;
		const first = fromField.value ? dateToDay(isoToDate(fromField.value)) : NaN;
		const last = toField.value ? dateToDay(isoToDate(toField.value)) : NaN;
		const problem = customRangeProblem(first, last);
		rangeError.hidden = !problem;
		rangeError.textContent = problem;
		for (const field of [fromField, toField]) {
			field.classList.toggle('is-invalid', !!problem);
			field.setAttribute('aria-invalid', String(!!problem));
		}
		if (problem) {
			(Number.isFinite(first) ? toField : fromField).focus();
			return;
		}
		Object.assign(settings, { range: 'custom', from: first, to: last });
		if (window.bootstrap) bootstrap.Dropdown.getOrCreateInstance(ui.rangeButton).hide();
		ui.rangeButton.focus();
		applyChange(`Showing ${rangeText({ from: first, to: last })}`);
	}

	function customRangeProblem(first, last) {
		if (!Number.isFinite(first) || !Number.isFinite(last)) return 'Pick both a start and an end date.';
		if (first > last) return 'The start date has to come before the end date.';
		if (first < 0 || last > finalDay) return `Records run from ${longDate(0)} to ${longDate(finalDay)}.`;
		return '';
	}

	/** Brings the range button, menus, comparison and reset link in line with the settings. */
	function showSettings() {
		const span = currentSpan();
		const custom = settings.range === 'custom';
		const name = custom ? 'Custom range' : quickRangeById[settings.range].name;
		pick('[data-so-range-label]').textContent = name;
		pick('[data-so-range-dates]').textContent = rangeText(span);
		ui.rangeButton.setAttribute('aria-label', `Date range: ${custom ? 'custom' : name}, ${rangeText(span)}`);
		for (const item of pickAll('[data-so-range-list] [data-value]')) {
			pick('[data-so-now]', item).hidden = item.getAttribute('data-value') !== settings.range;
		}
		ui.fromField.value = dayToIso(span.from);
		ui.toField.value = dayToIso(span.to);

		const radio = pick(`[data-so-compare] input[value="${settings.compare}"]`);
		if (radio && !radio.checked) {
			radio.checked = true;
			radio.dispatchEvent(new Event('change', { bubbles: true }));
		}
		for (const [key, menu] of Object.entries(ui.filters)) {
			if (menu.value === settings[key]) continue;
			menu.value = settings[key];
			if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(menu);
		}
		ui.resetButton.hidden = !hasFilters();
	}

	/* Loading a report, and the screens shown when there is none. */

	function applyChange(note) {
		listing.slice = null;
		writeAddress();
		requestReport(note);
	}

	function requestReport(note) {
		showSettings();
		const ticket = ++latestRequest;
		const span = currentSpan();
		const against = comparisonFor(settings.compare, span);
		const { board } = ui;
		board.hidden = false;
		ui.notice.hidden = true;
		board.classList.add('is-loading');
		board.setAttribute('aria-busy', 'true');
		backend
			.fetchRange({
				from: span.from,
				to: span.to,
				compare: against && !against.partial ? against : null,
				filters: { plan: settings.plan, region: settings.region, channel: settings.channel },
			})
			.then((data) => {
				if (ticket !== latestRequest) return;
				board.classList.remove('is-loading');
				board.setAttribute('aria-busy', 'false');
				if (!data.current.length) {
					showNothing();
					return;
				}
				report = buildReport(data, settings);
				paintReport();
				if (note)
					announce(`${note}. ${compactMoney(report.now.value)} from ${whole(report.now.orders)} orders.`);
			})
			.catch(() => {
				if (ticket === latestRequest) showFailure();
			});
	}

	function showNotice(tone, title, textHtml, actions) {
		ui.board.hidden = true;
		ui.notice.hidden = false;
		const toneClass = tone ? ` basalt-empty-${tone}` : '';
		ui.notice.innerHTML = `<div class="basalt-empty basalt-empty-framed${toneClass}"><div class="basalt-empty-art">${EMPTY_ART}</div><h2 class="basalt-empty-title">${title}</h2><p class="basalt-empty-text">${textHtml}</p><div class="basalt-empty-actions">${actions}</div></div>`;
	}

	function showNothing() {
		const filtered = hasFilters();
		const clearButton =
			'<button type="button" class="btn btn-primary btn-sm" data-so-act="clear"><i class="bi bi-x-circle" aria-hidden="true"></i>Clear filters</button>';
		const yearButton =
			'<button type="button" class="btn btn-outline-secondary btn-sm" data-so-act="year"><i class="bi bi-calendar-range" aria-hidden="true"></i>Show the last 12 months</button>';
		showNotice(
			'',
			`No orders in ${htmlSafe(rangeText(currentSpan()))}`,
			filtered
				? 'Nothing was ordered with these filters in this range. Clear the filters or pick a longer range.'
				: 'Nothing was ordered in this range yet. Pick a longer range to see earlier orders.',
			(filtered ? clearButton : '') + yearButton,
		);
		announce('No orders in this range');
	}

	function showFailure() {
		ui.board.classList.remove('is-loading');
		showNotice(
			'danger',
			'The orders did not load',
			'The server did not answer. Your range and filters are kept, so trying again picks up where you were.',
			'<button type="button" class="btn btn-primary btn-sm" data-so-act="retry"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i>Try again</button>',
		);
		notify({ tone: 'danger', title: 'Sales did not load', text: 'Check your connection and try again.' });
	}

	function onNoticeAction(event) {
		const button = event.target.closest('[data-so-act]');
		if (!button) return;
		const actions = {
			retry: () => requestReport('Loaded'),
			clear() {
				clearFilters();
				applyChange('Showing every sale again');
			},
			year() {
				settings.range = '12m';
				applyChange('Showing the last 12 months');
			},
		};
		const run = actions[button.getAttribute('data-so-act')];
		if (run) run();
	}

	/* Painting the board: wording, tiles, chart descriptions and the number
     tables, then the charts and the orders list. */

	function paintReport() {
		paintWording();
		paintTiles();
		paintTrendFacts();
		paintMoves();
		paintPlanFacts();
		paintRateFacts();
		paintRegionFacts();

		redrawCharts(true);
		if (watcher) {
			for (const canvas of ui.canvases) {
				if (!drawnOnce.has(canvas)) watcher.observe(canvas);
			}
		}
		refreshListing();
	}

	function paintWording() {
		const fills = {
			'[data-so-compare-name]': report.compareName,
			'[data-so-compare-lower]': compareWords(),
			'[data-so-grain]': report.grain,
			'[data-so-rate-grain]': report.rateGrain,
		};
		for (const [selector, words] of Object.entries(fills)) {
			for (const node of pickAll(selector)) node.textContent = words;
		}
		for (const node of pickAll('[data-so-compare-only]')) node.hidden = !report.compared;

		const { compared, against } = report;
		let status = 'No comparison';
		if (compared) status = `Compared with ${rangeText(against)}`;
		else if (against && against.partial) status = `No comparison: records start ${longDate(0)}`;
		pick('[data-so-status]').textContent = status;
	}

	function paintTiles() {
		const { now, before, buckets, grain, rateGrain } = report;
		const tiles = {
			value: [compactMoney(now.value), now.value, before && before.value],
			orders: [whole(now.orders), now.orders, before && before.orders],
			aov: [dollars(now.average), now.average, before && before.average],
			rate: [now.rate == null ? 'No deals' : percent(now.rate), now.rate, before && before.rate],
		};
		for (const [key, [shown, current, earlier]] of Object.entries(tiles)) {
			const tile = pick(`[data-so-kpi="${key}"]`);
			pick('[data-so-kpi-value]', tile).textContent = shown;
			pick('[data-so-kpi-delta]', tile).innerHTML = changeBadge(key, current, earlier);
		}
		/* The four figures count up from zero on the first report only. */
		if (!tilesCounted) {
			tilesCounted = true;
			window.Basalt.countUp?.(pickAll('[data-so-kpi-value]'));
		}

		const first = buckets[0];
		const last = buckets[buckets.length - 1];
		const sparkNames = {
			value: `Order value for each ${grain}, from ${compactMoney(first.value)} to ${compactMoney(last.value)}`,
			orders: `Orders for each ${grain}, from ${first.orders} to ${last.orders}`,
			aov: `Average order value for each ${grain}, ending at ${dollars(last.average)}`,
			rate: `Sales-led win rate for each ${rateGrain}${now.rate == null ? ', no deals in this view' : `, ${percent(now.rate)} over the range`}`,
		};
		for (const [key, words] of Object.entries(sparkNames)) {
			pick(`[data-so-spark="${key}"]`).setAttribute('aria-label', words);
		}
	}

	/** The change line under a headline number: arrow, amount and what it was before. */
	function changeBadge(kind, now, before) {
		if (!report.compared) {
			const why = report.against && report.against.partial ? `Records start ${longDate(0)}` : 'No comparison';
			return `<span class="so-delta so-delta-none">${why}</span>`;
		}
		if (now == null || before == null) return '<span class="so-delta so-delta-none">Nothing to compare</span>';

		let shift;
		let words;
		if (kind === 'rate') {
			shift = now - before;
			words = `${shift >= 0 ? '+' : '−'}${Math.abs(shift * 100).toFixed(1)} pts`;
		} else {
			shift = growthRatio(now, before);
			if (shift == null) return '<span class="so-delta so-delta-none">New this period</span>';
			words = signedPercent(shift);
		}

		let direction = 'down';
		if (Math.abs(shift) < 0.0005) direction = 'flat';
		else if (shift > 0) direction = 'up';
		const arrows = { up: 'bi-arrow-up-right', down: 'bi-arrow-down-right', flat: 'bi-arrow-right' };
		const formats = { value: compactMoney, aov: compactMoney, rate: percent };
		const earlier = (formats[kind] || whole)(before);
		return `<span class="so-delta so-delta-${direction}"><i class="bi ${arrows[direction]}" aria-hidden="true"></i>${words}</span><span class="so-delta-was">vs ${earlier}</span>`;
	}

	function paintTrendFacts() {
		const { now, buckets, priorBuckets, compared, compareName, grain, span } = report;
		const peak = buckets.reduce((best, bucket) => (bucket.value > best.value ? bucket : best), buckets[0]);
		pick('[data-so-chart="trend"]').setAttribute(
			'aria-label',
			`Stacked bars of order value by type for each ${grain} from ${rangeText(span)}. ${compactMoney(now.value)} in all: new ${compactMoney(now.byType.new)}, expansion ${compactMoney(now.byType.expansion)}, renewal ${compactMoney(now.byType.renewal)}. Highest in ${peak.bucket.long} at ${compactMoney(peak.value)}.`,
		);

		const rows = buckets.map((bucket, index) => {
			const earlier = compared ? (priorBuckets[index] ? dollars(priorBuckets[index].value) : 'no data') : null;
			const listButton = `<button type="button" class="so-link" data-so-drill="${index}">List orders<span class="visually-hidden"> for ${htmlSafe(bucket.bucket.long)}</span></button>`;
			const { byType } = bucket;
			return [
				bucket.bucket.long,
				dollars(byType.new),
				dollars(byType.expansion),
				dollars(byType.renewal),
				dollars(bucket.value),
				earlier,
				whole(bucket.orders),
				listButton,
			];
		});
		fillNumbers(
			'trend',
			['Period', 'New', 'Expansion', 'Renewal', 'Total', compared ? compareName : null, 'Orders', ''],
			rows,
		);
	}

	/* What moved order value: a row per kind with its change against the
     comparison, each bar scaled to the biggest move. */
	function paintMoves() {
		const { now, before, compared, compareName } = report;
		pick('[data-so-moves-off]').hidden = compared;
		const panel = pick('[data-so-moves]');
		panel.hidden = !compared;

		if (!compared) {
			panel.innerHTML = '';
			fillNumbers(
				'moves',
				['Type', 'This period'],
				dataset.kinds.map((kind) => [kind.name, dollars(now.byType[kind.id])]),
			);
			return;
		}

		function moveOf(id) {
			return now.byType[id] - before.byType[id];
		}

		const biggest = Math.max(...dataset.kinds.map((kind) => Math.abs(moveOf(kind.id))), 1);
		const net = now.value - before.value;
		const rows = dataset.kinds.map((kind) => {
			const move = moveOf(kind.id);
			const side = move >= 0 ? 'up' : 'down';
			const width = Math.max(2, (Math.abs(move) / biggest) * 100).toFixed(1);
			return `<li class="so-moves-row"><span class="so-moves-name">${htmlSafe(kind.name)}</span><span class="so-moves-track" aria-hidden="true"><span class="so-moves-bar so-moves-bar-${side}" style="width:${width}%"></span></span><span class="so-moves-amount so-moves-amount-${side}">${signedMoney(move)}</span></li>`;
		});
		const ends = `<p class="so-moves-ends"><span>${htmlSafe(compareName)} <strong>${compactMoney(before.value)}</strong></span><i class="bi bi-arrow-right" aria-hidden="true"></i><span>This period <strong>${compactMoney(now.value)}</strong></span><span class="so-moves-net">${net >= 0 ? 'Up ' : 'Down '}${compactMoney(Math.abs(net))}</span></p>`;
		panel.innerHTML = `${ends}<ul class="so-moves-list">${rows.join('')}</ul>`;

		function plusMinus(amount) {
			return (amount >= 0 ? '+' : '') + dollars(amount);
		}

		const table = dataset.kinds.map((kind) => [
			kind.name,
			dollars(before.byType[kind.id]),
			dollars(now.byType[kind.id]),
			plusMinus(moveOf(kind.id)),
		]);
		table.push(['Total', dollars(before.value), dollars(now.value), plusMinus(net)]);
		fillNumbers('moves', ['Type', compareName, 'This period', 'Change'], table);
	}

	function paintPlanFacts() {
		const parts = report.plans.map(
			(row) =>
				`${row.plan.name} ${compactMoney(row.value)}${row.prev != null ? ` against ${compactMoney(row.prev)}` : ''}`,
		);
		pick('[data-so-chart="plans"]').setAttribute('aria-label', `Order value by plan: ${parts.join(', ')}.`);
		pick('[data-so-plan-facts]').innerHTML = report.plans
			.map((row) => {
				const average = compactMoney(row.orders ? row.value / row.orders : 0);
				return `<div><dt>${htmlSafe(row.plan.name)}</dt><dd>${compactMoney(row.value)}<span>${whole(row.orders)} orders, ${average} average</span></dd></div>`;
			})
			.join('');
	}

	function paintRateFacts() {
		const { now, rateBuckets, priorRateBuckets, compared, compareName, rateGrain } = report;
		const empty = noDealsAnywhere();
		const notice = pick('[data-so-rate-none]');
		notice.hidden = !empty;
		pick('[data-so-chart="rate"]').parentElement.classList.toggle('is-off', empty);
		pick('.basalt-empty-text', notice).textContent =
			settings.plan === 'starter'
				? 'Basic is only bought online. Pick another plan to see deals.'
				: 'Only self-serve orders match these filters. Change the channel to see deals.';
		pick('[data-so-chart="rate"]').setAttribute(
			'aria-label',
			empty
				? 'No sales-led deals in this view'
				: `Sales-led win rate for each ${rateGrain}, ${percent(now.rate || 0)} over the range from ${now.dealsWon} won and ${now.dealsLost} lost deals.`,
		);

		const rows = rateBuckets.map((bucket, index) => {
			const prior = priorRateBuckets && priorRateBuckets[index];
			const earlier = compared ? (prior && prior.rate != null ? percent(prior.rate) : 'no deals') : null;
			return [
				bucket.bucket.long,
				whole(bucket.dealsWon),
				whole(bucket.dealsLost),
				bucket.rate == null ? 'no deals' : percent(bucket.rate),
				earlier,
			];
		});
		fillNumbers('rate', ['Period', 'Won', 'Lost', 'Win rate', compared ? compareName : null], rows);
	}

	function paintRegionFacts() {
		const { spots } = report;
		const largest = spots.reduce((top, spot) => (!top || spot.value > top.value ? spot : top), null);
		const largestWords = largest
			? `${largest.region.name} ${largest.channel.name.toLowerCase()}, ${compactMoney(largest.value)}`
			: 'none';
		pick('[data-so-chart="regions"]').setAttribute(
			'aria-label',
			`Bubble chart of orders against average order size for ${spots.length} region and channel pairs. Largest: ${largestWords}.`,
		);
		fillNumbers(
			'regions',
			['Region', 'Channel', 'Orders', 'Average', 'Value'],
			spots.map((spot) => [
				spot.region.name,
				spot.channel.name,
				whole(spot.orders),
				dollars(spot.average),
				dollars(spot.value),
			]),
		);
	}

	/**
	 * Writes the small table of figures behind a chart into its details.
	 * A null heading drops that column. On a phone each row stacks, so every
	 * figure after the first carries its column name in data-label.
	 */
	function fillNumbers(key, headings, rows) {
		const kept = headings.map((heading) => heading !== null);
		const names = headings.filter((heading) => heading !== null);
		function row(cells, tag) {
			return cells
				.filter((_, index) => kept[index])
				.map((cell, index) => {
					let attributes = index ? ' class="text-end"' : '';
					if (tag === 'th') attributes += ' scope="col"';
					else if (index && names[index]) attributes += ` data-label="${htmlSafe(names[index])}"`;
					return `<${tag}${attributes}>${cell}</${tag}>`;
				})
				.join('');
		}

		const wide = names.length > 5 ? ' so-table-wide' : '';
		const body = rows.map((cells) => `<tr>${row(cells, 'td')}</tr>`).join('');
		pick(`[data-so-numbers="${key}"]`).innerHTML =
			`<table class="table table-sm so-table so-table-numbers${wide}"><thead><tr>${row(headings, 'th')}</tr></thead><tbody>${body}</tbody></table>`;
	}

	/* Charts. Each canvas is drawn the first time it scrolls near the
     screen, then again on new data and on every theme change. */

	function revealCharts(entries) {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			watcher.unobserve(entry.target);
			drawnOnce.add(entry.target);
			drawChart(entry.target, true);
		}
	}

	function redrawCharts(animate) {
		const targets = watcher ? drawnOnce : ui.canvases;
		for (const canvas of targets) drawChart(canvas, animate);
	}

	function drawChart(canvas, animate) {
		if (!report) return;
		const kind = canvas.getAttribute('data-so-chart');
		const recipe = chartRecipes[kind];
		const existing = liveCharts.get(canvas);
		if (existing) {
			existing.destroy();
			liveCharts.delete(canvas);
		}
		if (!recipe || (kind === 'rate' && noDealsAnywhere())) return;
		liveCharts.set(canvas, new Chart(canvas, recipe(paletteNow(), animate && !calmMotion, canvas)));
	}

	/* Colors, read fresh from the tokens on every draw. */

	function token(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** Splits a hex or rgb()/rgba() color into [red, green, blue, alpha]; anything else becomes mid gray. */
	function rgbaParts(color) {
		const text = String(color || '').trim();
		const shortHex = /^#([0-9a-f]{3})$/i.exec(text);
		if (shortHex) return [...shortHex[1].split('').map((digit) => parseInt(digit + digit, 16)), 1];
		const longHex = /^#([0-9a-f]{6})$/i.exec(text);
		if (longHex) {
			const packed = parseInt(longHex[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 1];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(text);
		if (functional) {
			const numbers = functional[1].split(',').map((part) => parseFloat(part));
			return [numbers[0], numbers[1], numbers[2], numbers.length > 3 ? numbers[3] : 1];
		}
		return [128, 128, 128, 1];
	}

	function translucent(color, alpha) {
		const [red, green, blue] = rgbaParts(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	function blend(first, second, weight) {
		const a = rgbaParts(first);
		const b = rgbaParts(second);
		const [red, green, blue] = [0, 1, 2].map((channel) =>
			Math.round(a[channel] * weight + b[channel] * (1 - weight)),
		);
		return `rgb(${red}, ${green}, ${blue})`;
	}

	function paletteNow() {
		const ink = token('--basalt-copy', '#12233a');
		const muted = token('--basalt-copy-muted', '#5f7186');
		const card = token('--basalt-plane', '#ffffff');
		return {
			series: [1, 2, 3, 4, 5, 6, 7, 8].map((step) => token(`--basalt-series-${step}`, '#2b6fd4')),
			text: ink,
			surface: card,
			/* Mixed the same way as --so-quiet in sales-insights.css. */
			quiet: blend(muted, ink, 0.82),
			rest: translucent(ink, 0.34),
			track: blend(ink, card, 0.07),
			grid: translucent(ink, 0.07),
			border: token('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
		};
	}

	/* Shared chart settings and the small pieces the recipes are built from. */

	/** Merges plain objects key by key; arrays, functions and plain values in the override win outright. */
	function layered(base, override) {
		const merged = { ...base };
		function isPlain(value) {
			return value && typeof value === 'object' && !Array.isArray(value);
		}

		for (const [key, value] of Object.entries(override || {})) {
			merged[key] = isPlain(value) && isPlain(merged[key]) ? layered(merged[key], value) : value;
		}
		return merged;
	}

	function chartDefaults(colors, animate, extra) {
		const ticks = { color: colors.quiet, font: AXIS_FONT, padding: 8 };
		const tooltip = {
			backgroundColor: colors.surface,
			titleColor: colors.text,
			bodyColor: colors.text,
			footerColor: colors.quiet,
			borderColor: colors.border,
			borderWidth: 1,
			padding: 10,
			cornerRadius: 8,
			boxPadding: 4,
			usePointStyle: true,
			titleFont: { family: FONT_STACK, size: 12, weight: '600' },
			bodyFont: { family: FONT_STACK, size: 12 },
			footerFont: { family: FONT_STACK, size: 11.5, weight: '600' },
		};
		return layered(
			{
				responsive: true,
				maintainAspectRatio: false,
				animation: animate ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				layout: { padding: { top: 6, right: 6 } },
				elements: {
					line: { borderWidth: 2.5, borderCapStyle: 'round', borderJoinStyle: 'round' },
					point: { radius: 0, hoverRadius: 5, hoverBorderWidth: 2, hoverBorderColor: colors.surface },
					bar: { borderRadius: 6, borderSkipped: 'start' },
				},
				plugins: { legend: { display: false }, tooltip },
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: { maxRotation: 0, autoSkipPadding: 12, ...ticks },
					},
					y: {
						grid: { color: colors.grid },
						border: { display: false },
						ticks: { maxTicksLimit: 5, ...ticks },
					},
				},
			},
			extra,
		);
	}

	/* A top-to-bottom fade across the plot; with gradients off, one plain
	   color: `flat`, or the first stop. */
	function fadeDown(stops, flat) {
		return window.Basalt.chartFill(stops, { flat });
	}

	function areaFill(color, strength) {
		return fadeDown(
			[
				[0, translucent(color, strength || 0.26)],
				[1, translucent(color, 0)],
			],
			translucent(color, 0.12),
		);
	}

	/** A line drawn over bars, with optional hollow points in the card color. */
	function overlayLine(color, settingsForLine) {
		return {
			type: 'line',
			order: 0,
			borderColor: color,
			backgroundColor: color,
			pointBackgroundColor: color,
			pointHoverBackgroundColor: color,
			tension: 0.35,
			...settingsForLine,
		};
	}

	function hollowPoints(colors, color, radius) {
		return {
			pointRadius: radius,
			pointHoverRadius: 5.5,
			pointBackgroundColor: colors.surface,
			pointBorderColor: color,
			pointBorderWidth: 2,
			pointHoverBackgroundColor: color,
			pointHoverBorderColor: colors.surface,
		};
	}

	/** The dotted comparison line shared by the trend and win rate charts. */
	function comparisonLine(colors, data, extra) {
		return overlayLine(colors.rest, {
			label: report.compareName,
			data,
			borderWidth: 1.75,
			borderDash: [2, 4],
			order: 1,
			pointHoverBackgroundColor: colors.rest,
			...extra,
		});
	}

	/** Rounds up to a 1, 2, 2.5 or 5 step so the axis ends on a tidy value. */
	function tidyCeiling(value) {
		if (value <= 0) return 1;
		const scale = Math.pow(10, Math.floor(Math.log10(value)));
		const leading = value / scale;
		const step = [1, 2, 2.5, 5].find((candidate) => leading <= candidate) || 10;
		return step * scale;
	}

	function pointerCursor(event, hits) {
		if (event.native && event.native.target) event.native.target.style.cursor = hits.length ? 'pointer' : 'default';
	}

	/**
	 * Draws a rounded label on the canvas: card color behind body text so it
	 * reads in every palette, with an optional colored dot in front.
	 * (x, y) is the middle of its bottom edge unless align says left or right,
	 * and the pill is kept inside bounds.
	 */
	function drawPill(ctx, colors, x, y, label, bounds, align, dot) {
		ctx.save();
		ctx.font = `600 11px ${FONT_STACK}`;
		const dotRoom = dot ? 12 : 0;
		const width = ctx.measureText(label).width + 16 + dotRoom;
		const height = 21;
		const anchors = { left: x, right: x - width };
		const left = Math.max(
			bounds.left,
			Math.min(align in anchors ? anchors[align] : x - width / 2, bounds.right - width),
		);
		const top = Math.max(bounds.top, y - height);
		ctx.fillStyle = colors.surface;
		ctx.strokeStyle = colors.border;
		ctx.lineWidth = 1;
		ctx.beginPath();
		if (ctx.roundRect) ctx.roundRect(left, top, width, height, 10.5);
		else ctx.rect(left, top, width, height);
		ctx.fill();
		ctx.stroke();
		if (dot) {
			ctx.fillStyle = dot;
			ctx.beginPath();
			ctx.arc(left + 11, top + height / 2, 3.5, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.fillStyle = colors.text;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(label, left + 8 + dotRoom, top + height / 2 + 0.5);
		ctx.restore();
	}

	/** Writes a small bold figure centered above a point. */
	function drawFigure(ctx, color, label, x, y) {
		ctx.save();
		ctx.font = `600 11.5px ${FONT_STACK}`;
		ctx.fillStyle = color;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'bottom';
		ctx.fillText(label, x, y);
		ctx.restore();
	}

	function ratePoint(bucket) {
		return bucket.rate == null ? null : Math.round(bucket.rate * 1000) / 10;
	}

	/* One recipe per data-so-chart value. Each takes the theme colors and
     whether to animate, and returns a Chart.js config. */
	const chartRecipes = {
		/* Sparklines under the headline numbers (charts-line, spark). */
		spark(colors, animate, canvas) {
			const key = canvas.getAttribute('data-so-spark');
			const readers = {
				value: (bucket) => bucket.value,
				orders: (bucket) => bucket.orders,
				aov: (bucket) => (bucket.orders ? Math.round(bucket.average) : null),
			};
			const points = (key === 'rate' ? report.rateBuckets : report.buckets).map(readers[key] || ratePoint);
			const color = colors.series[0];
			const final = points.length - 1;
			return {
				type: 'line',
				data: {
					labels: points.map((_, index) => index),
					datasets: [
						{
							data: points,
							borderColor: color,
							borderWidth: 2,
							/* The area runs down to the card's foot in a faint tint. */
							backgroundColor: window.Basalt.chartFill(
								[
									[0, translucent(color, 0.22)],
									[1, translucent(color, 0.06)],
								],
								{ flat: translucent(color, 0.12) },
							),
							fill: true,
							tension: 0.35,
							spanGaps: true,
							pointRadius: (context) => (context.dataIndex === final ? 3 : 0),
							pointHoverRadius: 4,
							pointBackgroundColor: color,
							pointBorderWidth: 0,
						},
					],
				},
				options: chartDefaults(colors, animate, {
					layout: { autoPadding: false, padding: { top: 4, right: 0, bottom: 0, left: 0 } },
					plugins: { tooltip: { enabled: false } },
					/* Pointing along the line shows that stretch in the tile. */
					...window.Basalt.sparkReadout?.({
						value: pick('[data-so-kpi-value]', canvas.closest('[data-so-kpi]')),
						note: pick('[data-so-kpi-delta]', canvas.closest('[data-so-kpi]')),
						labels: (key === 'rate' ? report.rateBuckets : report.buckets).map(
							(entry) => entry.bucket.long,
						),
						format: {
							value: compactMoney,
							orders: whole,
							aov: dollars,
							rate: (point) => `${point.toFixed(1)}%`,
						}[key],
					}),
					scales: { x: { display: false }, y: { display: false, grace: '12%' } },
				}),
			};
		},

		/* Stacked bars with the total on top (charts-mixed, stacked) and the
       comparison total as a dotted line (charts-mixed, forecast). */
		trend(colors, animate) {
			const buckets = report.buckets;
			const totals = buckets.map((bucket) => bucket.value);
			const prior = report.priorBuckets
				? buckets.map((_, index) => (report.priorBuckets[index] ? report.priorBuckets[index].value : null))
				: null;
			const topLayer = dataset.kinds.length - 1;
			const growth = report.compared ? growthRatio(report.now.value, report.before.value) : null;
			const ceiling = tidyCeiling(
				Math.max(1, ...totals, ...(prior || []).filter((value) => value != null)) * 1.08,
			);

			const layers = dataset.kinds.map((kind, index) => {
				const color = colors.series[index];
				return {
					type: 'bar',
					label: kind.name,
					data: buckets.map((bucket) => bucket.byType[kind.id]),
					stack: 'value',
					backgroundColor:
						index === 0
							? fadeDown([
									[0, translucent(color, 0.95)],
									[1, translucent(color, 0.72)],
								])
							: translucent(color, 0.9),
					hoverBackgroundColor: color,
					borderRadius: index === topLayer ? { topLeft: 6, topRight: 6 } : 0,
					borderColor: colors.surface,
					borderWidth: index === 0 ? 0 : { bottom: 2 },
					borderSkipped: false,
					barPercentage: 0.62,
					categoryPercentage: 0.8,
					maxBarThickness: 40,
					order: 2,
				};
			});
			const total = overlayLine(colors.text, {
				label: 'Total',
				data: totals,
				stack: 'total',
				tension: 0.3,
				borderWidth: 2,
				...hollowPoints(colors, colors.text, buckets.length > 16 ? 0 : 3.5),
			});
			const datasets = [total, ...layers];
			if (prior) datasets.push(comparisonLine(colors, prior, { stack: 'prev', tension: 0.3 }));

			return {
				type: 'bar',
				data: { labels: buckets.map((bucket) => bucket.bucket.label), datasets },
				options: chartDefaults(colors, animate, {
					layout: { padding: { top: 30 } },
					onClick: (event, hits) => {
						if (hits.length) showBucketOrders(hits[0].index);
					},
					onHover: pointerCursor,
					plugins: {
						tooltip: {
							itemSort: (a, b) => {
								if (a.datasetIndex === 0) return 1;
								return b.datasetIndex === 0 ? -1 : b.datasetIndex - a.datasetIndex;
							},
							callbacks: {
								title: (items) => buckets[items[0].dataIndex].bucket.long,
								label: (item) =>
									` ${item.dataset.label}: ${item.parsed.y == null ? 'no data' : dollars(item.parsed.y)}`,
								footer: (items) => `${whole(buckets[items[0].dataIndex].orders)} orders`,
							},
						},
					},
					scales: {
						x: { stacked: true },
						y: {
							stacked: true,
							beginAtZero: true,
							max: ceiling,
							ticks: { callback: (value) => compactMoney(value) },
						},
					},
				}),
				plugins: [
					{
						id: 'salesTotals',
						afterDatasetsDraw(chart) {
							const { ctx, chartArea: area } = chart;
							if (buckets.length <= 13 && area.right - area.left > 520) {
								for (const [index, point] of chart.getDatasetMeta(0).data.entries()) {
									drawFigure(ctx, colors.text, compactMoney(totals[index]), point.x, point.y - 9);
								}
							}
							if (growth == null) return;
							const words = `${growth >= 0 ? 'Up ' : 'Down '}${Math.abs(growth * 100).toFixed(1)}% on the ${compareWords()}`;
							drawPill(
								ctx,
								colors,
								area.left + 4,
								area.top - 4,
								words,
								{ left: area.left, right: area.right, top: 0 },
								'left',
								colors.text,
							);
						},
					},
				],
			};
		},

		/* A bullet per plan (charts-bar, bullet): this period as the bar, the
       comparison as an upright mark across it. */
		plans(colors, animate) {
			const rows = report.plans;
			const ceiling = tidyCeiling(Math.max(1, ...rows.map((row) => Math.max(row.value, row.prev || 0))) * 1.12);
			const barShape = { borderSkipped: false, categoryPercentage: 1, grouped: false };
			return {
				type: 'bar',
				data: {
					labels: rows.map((row) => row.plan.name),
					datasets: [
						{
							...barShape,
							label: 'This period',
							data: rows.map((row) => row.value),
							backgroundColor: colors.series[0],
							hoverBackgroundColor: colors.series[0],
							borderRadius: 4,
							barPercentage: 0.36,
							order: 0,
						},
						{
							...barShape,
							label: 'Track',
							data: rows.map(() => ceiling),
							backgroundColor: colors.track,
							hoverBackgroundColor: colors.track,
							borderRadius: 6,
							barPercentage: 0.74,
							order: 1,
						},
					],
				},
				options: chartDefaults(colors, animate, {
					indexAxis: 'y',
					interaction: { mode: 'index', intersect: false, axis: 'y' },
					layout: { padding: { right: 4 } },
					onClick: (event, hits) => {
						if (hits.length) filterToPlan(rows[hits[0].index].plan.id);
					},
					onHover: pointerCursor,
					plugins: {
						tooltip: {
							filter: (item) => item.datasetIndex === 0,
							callbacks: {
								label: (item) => {
									const row = rows[item.dataIndex];
									const earlier = row.prev != null ? `, ${dollars(row.prev)} before` : '';
									return ` ${dollars(row.value)} from ${whole(row.orders)} orders${earlier}`;
								},
							},
						},
					},
					scales: {
						x: {
							max: ceiling,
							beginAtZero: true,
							grid: { display: true, color: colors.grid },
							ticks: { maxTicksLimit: 5, callback: (value) => compactMoney(value) },
						},
						y: { grid: { display: false }, ticks: { autoSkip: false } },
					},
				}),
				plugins: [
					{
						id: 'salesPlanMarks',
						afterDatasetsDraw(chart) {
							const {
								ctx,
								scales: { x },
							} = chart;
							ctx.save();
							for (const [index, track] of chart.getDatasetMeta(1).data.entries()) {
								const row = rows[index];
								const halfHeight = track.height / 2;
								if (row.prev != null) {
									const markX = x.getPixelForValue(row.prev);
									ctx.strokeStyle = colors.text;
									ctx.lineWidth = 2.5;
									ctx.lineCap = 'round';
									ctx.beginPath();
									ctx.moveTo(markX, track.y - halfHeight + 3);
									ctx.lineTo(markX, track.y + halfHeight - 3);
									ctx.stroke();
								}
								const ratio = row.prev != null ? growthRatio(row.value, row.prev) : null;
								ctx.fillStyle = colors.text;
								ctx.font = `600 11px ${FONT_STACK}`;
								ctx.textAlign = 'right';
								ctx.textBaseline = 'middle';
								ctx.fillText(
									ratio == null ? compactMoney(row.value) : signedPercent(ratio, 0),
									track.x - 8,
									track.y + 0.5,
								);
							}
							ctx.restore();
						},
					},
				],
			};
		},

		/* An annotated line (charts-line): the win rate, its latest value in a
       pill, and the comparison dotted behind it. */
		rate(colors, animate) {
			const buckets = report.rateBuckets;
			const color = colors.series[4];
			const points = buckets.map(ratePoint);
			const prior = report.priorRateBuckets
				? buckets.map((_, index) =>
						report.priorRateBuckets[index] ? ratePoint(report.priorRateBuckets[index]) : null,
					)
				: null;
			const known = [...points, ...(prior || [])].filter((value) => value != null);
			const ceiling = Math.min(100, Math.ceil((Math.max(10, ...known) + 8) / 10) * 10);
			const latest = points.reduce((found, value, index) => (value == null ? found : index), -1);
			const datasets = [
				overlayLine(color, {
					label: 'Win rate',
					data: points,
					spanGaps: true,
					fill: true,
					backgroundColor: areaFill(color, 0.2),
					...hollowPoints(colors, color, buckets.length > 16 ? 0 : 3.5),
				}),
			];
			if (prior) datasets.push(comparisonLine(colors, prior, { spanGaps: true }));
			return {
				type: 'line',
				data: { labels: buckets.map((bucket) => bucket.bucket.label), datasets },
				options: chartDefaults(colors, animate, {
					layout: { padding: { top: 28, right: 10 } },
					plugins: {
						tooltip: {
							callbacks: {
								title: (items) => buckets[items[0].dataIndex].bucket.long,
								label: (item) =>
									` ${item.dataset.label}: ${item.parsed.y == null ? 'no deals' : `${item.parsed.y}%`}`,
								footer: (items) => {
									const bucket = buckets[items[0].dataIndex];
									return `${bucket.dealsWon} won, ${bucket.dealsLost} lost`;
								},
							},
						},
					},
					scales: {
						y: {
							min: 0,
							max: ceiling,
							ticks: { stepSize: ceiling > 50 ? 20 : 10, callback: (value) => `${value}%` },
						},
					},
				}),
				plugins: [
					{
						id: 'salesRateNote',
						afterDatasetsDraw(chart) {
							const point = chart.getDatasetMeta(0).data[latest];
							if (!point || latest < 0) return;
							const { ctx, chartArea: area } = chart;
							drawPill(
								ctx,
								colors,
								point.x,
								point.y - 12,
								`${points[latest]}% in ${buckets[latest].bucket.label}`,
								{ left: area.left, right: area.right + 8, top: 0 },
								'right',
								color,
							);
						},
					},
				],
			};
		},

		/* Bubbles on two log axes (charts-scatter, bubble and log): one per
       region and channel, sized by total value. */
		regions(colors, animate) {
			const spots = report.spots;
			function tone(spot) {
				return spot.channel.id === 'self' ? colors.series[3] : colors.series[5];
			}

			const heaviest = Math.max(1, ...spots.map((spot) => spot.value));
			const valueTicks = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
			const countTicks = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
			function onlyWithin(list) {
				return (scale) => {
					scale.ticks = list
						.filter((value) => value >= scale.min && value <= scale.max)
						.map((value) => ({ value }));
				};
			}

			return {
				type: 'bubble',
				data: {
					datasets: [
						{
							label: 'Region and channel',
							data: spots.map((spot) => ({
								x: spot.orders,
								y: spot.average,
								r: 4 + 13 * Math.sqrt(spot.value / heaviest),
							})),
							backgroundColor: spots.map((spot) => translucent(tone(spot), 0.55)),
							hoverBackgroundColor: spots.map((spot) => translucent(tone(spot), 0.8)),
							borderColor: spots.map(tone),
							borderWidth: 1.5,
						},
					],
				},
				options: chartDefaults(colors, animate, {
					interaction: { mode: 'nearest', intersect: true },
					layout: { padding: { top: 12, right: 14 } },
					plugins: {
						tooltip: {
							callbacks: {
								title: (items) => {
									const spot = spots[items[0].dataIndex];
									return `${spot.region.name}, ${spot.channel.name.toLowerCase()}`;
								},
								label: (item) => {
									const spot = spots[item.dataIndex];
									return [
										` ${whole(spot.orders)} orders, ${compactMoney(spot.value)} in all`,
										` ${dollars(spot.average)} on average`,
									];
								},
							},
						},
					},
					scales: {
						x: {
							type: 'logarithmic',
							min: Math.max(0.8, Math.min(...spots.map((spot) => spot.orders)) / 2),
							max: Math.max(...spots.map((spot) => spot.orders), 10) * 2,
							grid: { display: true, color: colors.grid },
							afterBuildTicks: onlyWithin(countTicks),
							ticks: { callback: (value) => whole(value) },
							title: { display: true, text: 'Orders (log scale)', color: colors.quiet, font: AXIS_FONT },
						},
						y: {
							type: 'logarithmic',
							min: Math.min(...spots.map((spot) => spot.average), 1000) / 1.8,
							max: Math.max(...spots.map((spot) => spot.average), 2000) * 1.8,
							afterBuildTicks: onlyWithin(valueTicks),
							ticks: { callback: (value) => compactMoney(value) },
							title: {
								display: true,
								text: 'Average order (log scale)',
								color: colors.quiet,
								font: AXIS_FONT,
							},
						},
					},
				}),
				plugins: [
					{
						id: 'salesSpotNames',
						afterDatasetsDraw(chart) {
							labelBubbles(chart, spots, colors);
						},
					},
				],
			};
		},
	};

	/**
	 * Names each bubble by its region. A name tries the right, left, below
	 * and above its bubble (then the corners and further out) and takes the
	 * first place that stays inside the plot without covering a bubble or
	 * a name already placed.
	 */
	function labelBubbles(chart, spots, colors) {
		const { ctx, chartArea: area } = chart;
		const bubbles = chart.getDatasetMeta(0).data;
		function radiusOf(bubble) {
			return bubble.options ? bubble.options.radius : 8;
		}

		const occupied = bubbles.map((bubble) => {
			const radius = radiusOf(bubble);
			return { l: bubble.x - radius, r: bubble.x + radius, t: bubble.y - radius, b: bubble.y + radius };
		});
		function overlaps(box) {
			return occupied.some((other) => box.l < other.r && box.r > other.l && box.t < other.b && box.b > other.t);
		}

		function fits(box) {
			return box.l >= area.left && box.r <= area.right + 10 && box.t >= area.top - 10 && box.b <= area.bottom;
		}

		const lineHeight = 14;

		for (const [index, bubble] of bubbles.entries()) {
			const name = spots[index].region.abbr;
			const radius = radiusOf(bubble);
			ctx.save();
			ctx.font = `600 11px ${FONT_STACK}`;
			const width = ctx.measureText(name).width;
			const corners = [
				[bubble.x + radius + 4, bubble.y - lineHeight / 2],
				[bubble.x - radius - 4 - width, bubble.y - lineHeight / 2],
				[bubble.x - width / 2, bubble.y + radius + 2],
				[bubble.x - width / 2, bubble.y - radius - 2 - lineHeight],
				[bubble.x + radius * 0.7, bubble.y + radius * 0.7],
				[bubble.x - radius * 0.7 - width, bubble.y - radius * 0.7 - lineHeight],
				[bubble.x - width / 2, bubble.y + radius + 2 + lineHeight],
				[bubble.x - width / 2, bubble.y - radius - 2 - lineHeight * 2],
			];
			const places = corners.map(([l, t]) => ({ l, r: l + width, t, b: t + lineHeight }));

			/* The bubble's own box is set aside while its name looks for room. */
			const ownBox = occupied[index];
			occupied[index] = { l: 0, r: 0, t: 0, b: 0 };
			const place = places.find((box) => fits(box) && !overlaps(box)) || places.find(fits) || places[0];
			occupied[index] = ownBox;
			occupied.push(place);

			ctx.textAlign = 'left';
			ctx.textBaseline = 'middle';
			ctx.lineWidth = 3;
			ctx.lineJoin = 'round';
			ctx.strokeStyle = colors.surface;
			ctx.strokeText(name, place.l, place.t + lineHeight / 2);
			ctx.fillStyle = colors.text;
			ctx.fillText(name, place.l, place.t + lineHeight / 2);
			ctx.restore();
		}
	}

	function filterToPlan(id) {
		if (settings.plan === id) return;
		settings.plan = id;
		applyChange(`Filtered to the ${planById[id].name} plan`);
	}

	/* The orders list: type tabs, search, sorting, a bucket picked from the
     trend chart, and the pager. */

	function buildKindTabs() {
		const tabs = [{ id: 'all', name: 'All' }, ...dataset.kinds];
		ui.kindTabs.innerHTML = tabs
			.map(({ id, name }) => {
				const first = id === 'all';
				return `<button class="nav-link${first ? ' active' : ''}" id="so-type-${id}" data-bs-toggle="tab" data-bs-target="#so-orders-panel" type="button" role="tab" aria-controls="so-orders-panel" aria-selected="${first}" data-so-type="${id}"${first ? '' : ' tabindex="-1"'}>${htmlSafe(name)} <span class="basalt-tabs-count" data-so-type-count>0</span></button>`;
			})
			.join('');
	}

	function bindListing() {
		ui.kindTabs.addEventListener('shown.bs.tab', (event) => {
			const kind = event.target.getAttribute('data-so-type');
			if (!kind || kind === listing.kind) return;
			listing.kind = kind;
			pick('#so-orders-panel').setAttribute('aria-labelledby', event.target.id);
			refreshListing(true);
		});
		/* Should Bootstrap's tab script be missing, the buttons still switch the list. */
		ui.kindTabs.addEventListener('click', (event) => {
			const tab = event.target.closest('[data-so-type]');
			if (!tab || window.bootstrap) return;
			listing.kind = tab.getAttribute('data-so-type');
			refreshListing(true);
		});

		ui.search.addEventListener('input', () => {
			clearTimeout(typingTimer);
			typingTimer = setTimeout(() => {
				listing.term = ui.search.value.trim().toLowerCase();
				refreshListing(true);
			}, 160);
		});

		for (const heading of pickAll('[data-so-sort]')) {
			pick('button', heading).addEventListener('click', () => {
				const by = heading.getAttribute('data-so-sort');
				listing.order = { by, way: nextSortWay(by) };
				refreshListing(true);
			});
		}

		pick('[data-so-rows-clear]').addEventListener('click', () => {
			ui.search.value = '';
			listing.term = '';
			listing.slice = null;
			const allTab = pick('#so-type-all');
			if (window.bootstrap) {
				bootstrap.Tab.getOrCreateInstance(allTab).show();
			} else {
				listing.kind = 'all';
				refreshListing(true);
			}
			refreshListing(true);
			ui.search.focus();
		});

		ui.tbody.addEventListener('click', (event) => {
			const quickView = event.target.closest('[data-so-open]');
			const row = event.target.closest('[data-so-row]');
			if (quickView) showOrder(+quickView.getAttribute('data-so-open'));
			else if (row && !event.target.closest('a, button')) showOrder(+row.getAttribute('data-so-row'));
		});
	}

	/* A second click on the sorted column flips it. A new column starts
     newest or largest first, except accounts, which start at A. */
	function nextSortWay(by) {
		if (listing.order.by === by) return listing.order.way === 'desc' ? 'asc' : 'desc';
		return by === 'account' ? 'asc' : 'desc';
	}

	const sorters = {
		id: (a, b) => a.day - b.day || (a.id < b.id ? -1 : 1),
		account: (a, b) => a.account.localeCompare(b.account) || a.day - b.day,
		seats: (a, b) => a.seats - b.seats || a.day - b.day,
		value: (a, b) => a.value - b.value || a.day - b.day,
	};

	/** Lists the orders of one trend bucket and moves the reader to the table. */
	function showBucketOrders(index) {
		if (!report || !report.buckets[index]) return;
		const { from, to, long } = report.buckets[index].bucket;
		listing.slice = { from, to, label: long };
		refreshListing(true);
		const title = pick('#so-orders-title');
		title.scrollIntoView({ behavior: calmMotion ? 'auto' : 'smooth', block: 'start' });
		title.focus({ preventScroll: true });
		announce(`Showing orders for ${long}`);
	}

	function matchingOrders() {
		if (!report) return [];
		const { term, slice } = listing;
		return report.now.won.filter((order) => {
			if (slice && (order.day < slice.from || order.day > slice.to)) return false;
			return (
				!term || `${order.id} ${order.account} ${order.rep || ''} ${order.detail}`.toLowerCase().includes(term)
			);
		});
	}

	/**
	 * Recounts the tabs, sorts and filters the rows and hands them to the pager.
	 * @param {boolean} [byUser] announce the result, as the visitor asked for it
	 */
	function refreshListing(byUser) {
		const matching = matchingOrders();
		for (const tab of pickAll('[data-so-type]', ui.kindTabs)) {
			const kind = tab.getAttribute('data-so-type');
			const size = kind === 'all' ? matching.length : matching.filter((order) => order.type === kind).length;
			pick('[data-so-type-count]', tab).textContent = whole(size);
		}
		/* New counts change the tab widths, so the tabs measure themselves again. */
		const tabStrip = ui.kindTabs.closest('.basalt-tabs');
		if (tabStrip && tabStrip.basaltTabs) tabStrip.basaltTabs.refresh();

		const { by, way } = listing.order;
		const compareRows = sorters[by];
		const rows = matching.filter((order) => listing.kind === 'all' || order.type === listing.kind);
		rows.sort(way === 'asc' ? compareRows : (a, b) => compareRows(b, a));
		listing.rows = rows;

		for (const heading of pickAll('[data-so-sort]')) {
			const active = heading.getAttribute('data-so-sort') === by;
			if (active) heading.setAttribute('aria-sort', way === 'asc' ? 'ascending' : 'descending');
			else heading.removeAttribute('aria-sort');
			let icon = 'bi-arrow-down-up';
			if (active) icon = way === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
			pick('.so-sort-icon', heading).className = `bi so-sort-icon ${icon}`;
		}

		if (window.Basalt.drawer && window.Basalt.drawer.applied) {
			const chipList = listing.slice
				? [
						{
							label: listing.slice.label,
							remove() {
								listing.slice = null;
								refreshListing(true);
							},
						},
					]
				: [];
			window.Basalt.drawer.applied(ui.appliedChips, chipList, null, ui.search);
		}

		const empty = !rows.length;
		ui.noRows.hidden = !empty;
		pick('.so-scroll').hidden = empty;
		ui.pagerBox.hidden = empty;
		if (empty) {
			pick('[data-so-rows-empty-text]').textContent = listing.term
				? `Nothing matches “${ui.search.value.trim()}” here. Try an order number, an account or a rep.`
				: 'No orders of this type in the range.';
			if (byUser) announce('No orders match');
			return;
		}

		pagerSetup.total = rows.length;
		if (!pager) {
			pager = window.Basalt.pager ? window.Basalt.pager(ui.pagerBox, pagerSetup) : null;
			if (!pager) paintRows(1, rows.length);
			return;
		}
		const rowsPerPage = parseInt(ui.pageSize.value, 10) || 10;
		pager.setTotal(Math.max(1, Math.ceil(rows.length / rowsPerPage)));
		pager.set(1);
		ui.pageSize.dispatchEvent(new Event('change'));
		if (byUser) announce(`${whole(rows.length)} orders`);
	}

	function paymentPill(order) {
		const [label, tone] = STATUS_BADGES[order.status] || ['Paid', 'success'];
		return `<span class="basalt-status basalt-status-dot basalt-status-${tone}">${label}</span>`;
	}

	function kindBadge(order) {
		return `<span class="badge basalt-badge-as-dot basalt-badge-tone-${KIND_TONES[order.type]}">${kindById[order.type].name}</span>`;
	}

	/** Writes rows from to to (1-based, inclusive) of the sorted list; the pager calls it. */
	function paintRows(from, to) {
		function sub(text) {
			return `<span class="so-sub">${text}</span>`;
		}

		ui.tbody.innerHTML = listing.rows
			.slice(from - 1, to)
			.map((order, offset) => {
				const position = from - 1 + offset;
				const cells = [
					`<td><a class="so-link" href="invoices.html">${order.id}</a>${sub(longDate(order.day))}</td>`,
					`<td><a class="so-strong so-account" href="company-details.html">${htmlSafe(order.account)}</a>${sub(htmlSafe(regionById[order.region].name))}</td>`,
					`<td>${htmlSafe(planById[order.plan].name)}${sub(order.billing === 'annual' ? 'Yearly' : 'Monthly')}</td>`,
					`<td>${kindBadge(order)}${sub(htmlSafe(order.detail))}</td>`,
					`<td>${channelById[order.channel].name}${order.rep ? sub(htmlSafe(order.rep)) : ''}</td>`,
					`<td class="text-end">${whole(order.seats)}</td>`,
					`<td class="text-end so-strong">${dollars(order.value)}</td>`,
					`<td>${paymentPill(order)}</td>`,
					`<td class="so-col-act"><span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-so-open="${position}" aria-label="Quick view: order ${order.id}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="invoices.html" aria-label="Open full page: order ${order.id}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span></td>`,
				];
				return `<tr data-so-row="${position}">${cells.join('')}</tr>`;
			})
			.join('');
		if (window.Basalt.tips) window.Basalt.tips(ui.tbody);
	}

	/* The order drawer. Alt+Up and Alt+Down step through the rows in their
     current order, and closing it returns focus to where it came from. */

	function drawerPart(name) {
		return pick(`[data-so-d="${name}"]`, ui.drawer);
	}

	function bindDrawer() {
		const { drawer } = ui;
		for (const button of pickAll('[data-so-d-step]', drawer)) {
			button.addEventListener('click', () => stepOrder(+button.getAttribute('data-so-d-step')));
		}
		drawer.addEventListener('keydown', (event) => {
			if (!event.altKey) return;
			const steps = { ArrowUp: -1, ArrowDown: 1 };
			if (!(event.key in steps)) return;
			event.preventDefault();
			stepOrder(steps[event.key]);
		});
		drawer.addEventListener('hidden.bs.offcanvas', () => {
			/* Back to the quick view button of the last order shown, when that row is on screen. */
			const button = pick(`[data-so-open="${openIndex}"]`, ui.tbody);
			if (button) button.focus();
			else if (returnFocus && returnFocus.isConnected) returnFocus.focus();
		});
		pick('[data-so-d-copy]', drawer).addEventListener('click', () => {
			const order = listing.rows[openIndex];
			if (!order) return;
			function confirmCopy() {
				return notify({ tone: 'success', title: `Copied ${order.id}`, duration: 2500 });
			}

			if (window.Basalt.copyText)
				Promise.resolve(window.Basalt.copyText(order.id)).then(confirmCopy, confirmCopy);
			else confirmCopy();
		});
		pick('[data-so-d-receipt]', drawer).addEventListener('click', (event) => {
			const order = listing.rows[openIndex];
			const button = event.currentTarget;
			if (!order) return;
			button.disabled = true;
			backend
				.emailReceipt(order.id)
				.then(() =>
					notify({
						tone: 'success',
						title: 'Receipt sent',
						text: `A copy of ${order.id} went to the billing contact at ${order.account}.`,
					}),
				)
				.catch(() =>
					notify({ tone: 'danger', title: 'The receipt was not sent', text: 'Try again in a moment.' }),
				)
				.then(() => {
					button.disabled = false;
				});
		});
	}

	function stepOrder(direction) {
		const count = listing.rows.length;
		if (!count) return;
		showOrder((openIndex + direction + count) % count, direction);
	}

	/** What happened to an order, oldest first, as [day, words] pairs. */
	function orderHistory(order) {
		const viaSales = order.channel === 'sales';
		const events = viaSales
			? [
					[order.cycle ? order.day - order.cycle : order.day, `Deal opened by ${order.rep}`],
					[order.day - Math.round(order.cycle / 3), 'Quote sent'],
					[order.day, 'Contract signed'],
				]
			: [[order.day, 'Checked out online']];
		const closing = {
			paid: [Math.min(finalDay, order.day + (viaSales ? 14 : 0)), viaSales ? 'Invoice paid' : 'Card charged'],
			invoiced: [order.day, 'Invoice sent, due in 30 days'],
			overdue: [order.day + 30, 'Invoice overdue, reminder sent'],
			retrying: [order.day, 'Card declined, retrying in 3 days'],
		};
		if (Object.hasOwn(closing, order.status)) events.push(closing[order.status]);
		return events;
	}

	/**
	 * Fills the drawer with one order of the current list and opens it.
	 * @param {number} index position in listing.rows
	 * @param {number} [direction] -1 or 1 when stepping, so the content slides the right way
	 */
	function showOrder(index, direction) {
		const row = listing.rows[index];
		if (!row) return;
		openIndex = index;
		backend.fetchOrder(row.id).then((order) => {
			if (openIndex !== index || !order) return;
			const { drawer } = ui;
			drawerPart('title').textContent = `Order ${order.id}`;
			drawerPart('sub').textContent = `${order.account}, ${regionById[order.region].name}`;
			drawerPart('full').href = 'invoices.html';
			drawerPart('pos').textContent = `${index + 1} of ${whole(listing.rows.length)}`;
			drawerPart('body').innerHTML = orderDetails(order);

			drawer.classList.toggle('is-back', direction < 0);
			if (direction) {
				for (const block of pickAll('.offcanvas-body > *', drawer)) {
					block.style.animation = 'none';
					void block.offsetWidth;
					block.style.animation = '';
				}
			}
			const offcanvas = window.bootstrap && bootstrap.Offcanvas.getOrCreateInstance(drawer);
			if (offcanvas && !drawer.classList.contains('show')) {
				returnFocus = document.activeElement;
				offcanvas.show();
			}
		});
	}

	function orderDetails(order) {
		function fact(term, detail) {
			return `<div><dt>${term}</dt><dd>${detail}</dd></div>`;
		}

		const facts = [
			fact('Ordered', longDate(order.day)),
			fact(
				'Plan',
				`${htmlSafe(planById[order.plan].name)}, ${order.billing === 'annual' ? 'billed yearly' : 'billed monthly'}`,
			),
			fact('Seats', whole(order.seats)),
			fact('Channel', `${channelById[order.channel].name}${order.rep ? `, ${htmlSafe(order.rep)}` : ''}`),
			order.cycle ? fact('Days to close', order.cycle) : '',
			fact('Region', regionById[order.region].name),
		].join('');
		const lines = order.lines
			.map(([label, amount]) => `<li><span>${htmlSafe(label)}</span><span>${dollars(amount)}</span></li>`)
			.join('');
		const history = orderHistory(order)
			.map(
				([day, words]) =>
					`<li><span class="so-timeline-when">${longDate(day, { month: 'short', day: 'numeric' })}</span>${htmlSafe(words)}</li>`,
			)
			.join('');
		return [
			`<div class="so-d-top"><p class="so-d-value">${dollars(order.value)}<span>a year</span></p>${paymentPill(order)}</div>`,
			`<p class="so-d-what">${kindBadge(order)}${htmlSafe(order.detail)}</p>`,
			`<dl class="so-facts">${facts}</dl>`,
			`<h3 class="so-d-head">What was bought</h3><ul class="so-lines">${lines}<li class="so-lines-total"><span>Yearly value</span><span>${dollars(order.value)}</span></li></ul>`,
			`<h3 class="so-d-head">History</h3><ol class="so-timeline">${history}</ol>`,
			'<p class="so-d-links"><a class="so-link" href="company-details.html"><i class="bi bi-building" aria-hidden="true"></i>Open the account</a><a class="so-link" href="invoice-details.html"><i class="bi bi-receipt" aria-hidden="true"></i>View the invoice</a></p>',
		].join('');
	}

	/* Exporting rows as CSV and copying a link to this view. */

	function csvFrom(orders) {
		function cell(value) {
			const text = String(value == null ? '' : value);
			return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
		}

		const header = [
			'Order',
			'Date',
			'Account',
			'Region',
			'Plan',
			'Billing',
			'Type',
			'Detail',
			'Channel',
			'Rep',
			'Seats',
			'Value (USD a year)',
			'Status',
		];
		const records = orders.map((order) => [
			order.id,
			dayToIso(order.day),
			order.account,
			regionById[order.region].name,
			planById[order.plan].name,
			order.billing,
			kindById[order.type].name,
			order.detail,
			channelById[order.channel].name,
			order.rep || '',
			order.seats,
			order.value,
			(STATUS_BADGES[order.status] || ['Paid'])[0],
		]);
		return [header, ...records].map((record) => record.map(cell).join(',')).join('\r\n');
	}

	function saveFile(fileName, contents) {
		const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = fileName;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	function bindExports() {
		for (const button of pickAll('[data-so-export]')) {
			button.addEventListener('click', exportOrders);
		}
	}

	/** Exports the orders table as it stands, with its search and filters. */
	function exportOrders() {
		if (!report) {
			notify({ tone: 'warning', title: 'Nothing to export yet', text: 'Wait for the orders to load.' });
			return;
		}
		const rows = listing.rows;
		if (!rows.length) {
			notify({ tone: 'warning', title: 'No orders to export', text: 'Change the search or filters first.' });
			return;
		}
		const { from, to } = report.span;
		const fileName = `orders-${dayToIso(from)}-to-${dayToIso(to)}.csv`;
		backend
			.exportCsv(rows)
			.then((csv) => {
				saveFile(fileName, csv);
				notify({ tone: 'success', title: `Exported ${whole(rows.length)} orders`, text: fileName });
			})
			.catch(() =>
				notify({ tone: 'danger', title: 'The export did not finish', text: 'Try again in a moment.' }),
			);
	}

	start();
})();
