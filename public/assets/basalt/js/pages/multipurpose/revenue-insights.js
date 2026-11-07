/**
 * The Revenue dashboard on revenue-insights.html, mounted on [data-rv-root].
 *
 * Fieldline sells scheduling software to teams that work on site: three
 * paid plans (Basic, Pro and Max), four regions, and two ways of buying
 * (self-serve by card, or sales-led on a contract). This script turns that
 * subscription book into MRR with a six month outlook, the movements behind
 * each month, plan and billing mix, revenue per account against revenue lost,
 * and what was invoiced, collected, failed and recovered.
 *
 * Bringing your own numbers: either replace SAMPLE with real figures or
 * point backend.revenue() at a server. The markup holds no figures at all;
 * everything is drawn from that one answer, and each backend method is a
 * single request.
 *
 * The other states can be previewed with a query string: ?state=empty,
 * ?state=error (only the first request fails, so Try again recovers) and
 * ?state=loading (the skeletons never clear). A real server makes it moot.
 *
 * Shared parts come from basalt.js: hero, segmented controls, styled
 * selects, the command menu, filter chips, tabs, pagination, the record
 * drawer, tooltips, toasts, skeletons, empty states and the live region.
 * The charts are built the way the Charts pages build theirs: colors are
 * read from the --basalt-* tokens at build time, a chart is first drawn
 * when it scrolls near the screen, and every drawn chart is rebuilt when
 * basalt:appearance fires.
 */
(() => {
	'use strict';

	const page = pick('[data-rv-root]', document);
	if (!page) return;

	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const TYPEFACE = "'Schibsted Grotesk', sans-serif";

	/*
	 * Sample book of subscriptions. Swap it for your own.
	 *
	 * These are the rules the book follows rather than the figures it
	 * produces. composeHistory() runs them through a seeded generator to get
	 * 36 months, so every load looks identical and every total reconciles:
	 * the plans add up to the company line, the five movements account for
	 * every change in MRR, and each failed payment in the ledger is one the
	 * collections chart has already counted.
	 *
	 * Per plan, arpa is the opening revenue per account and opening the MRR
	 * of the first month; annual is the share billed yearly, addOns the share
	 * of MRR from paid extras, fail the share of card charges that bounce;
	 * rates are monthly movements as a share of MRR, and slot picks the
	 * chart color (1 to 8). Regions carry their share of opening MRR and how
	 * much faster they grow and lose than the Northeast. Channels are
	 * self-serve (card, in the app) and sales-led (on contract).
	 */
	const SAMPLE = {
		seed: 20261002,
		/* October 2023, with months counted from zero. */
		startsAt: [2023, 9],
		/* Runs to September 2026, the last month that has closed. */
		monthCount: 36,
		outlookMonths: 6,
		grossMargin: 0.81,
		lifetimeCap: 60,
		/* Seats are $15 on Basic, $32 on Pro and $58 on Max each month, Max
       has a $2,500 monthly floor, and paying yearly gives two months free. */
		plans: [
			{
				id: 'starter',
				name: 'Basic',
				slot: 3,
				arpa: 99,
				seatPrice: 15,
				opening: 66600,
				annual: 0.29,
				addOns: 0.04,
				fail: 0.036,
				written: 0.33,
				rates: { new: 0.023, expansion: 0.0094, reactivation: 0.002, contraction: 0.002, churn: 0.009 },
			},
			{
				id: 'growth',
				name: 'Pro',
				slot: 5,
				arpa: 398,
				seatPrice: 32,
				opening: 144500,
				annual: 0.55,
				addOns: 0.09,
				fail: 0.019,
				written: 0.26,
				rates: { new: 0.0162, expansion: 0.0135, reactivation: 0.0008, contraction: 0.0015, churn: 0.0035 },
			},
			{
				id: 'enterprise',
				name: 'Max',
				slot: 1,
				arpa: 2165,
				seatPrice: 58,
				opening: 154000,
				annual: 0.91,
				addOns: 0.12,
				fail: 0.004,
				written: 0.1,
				rates: { new: 0.0115, expansion: 0.014, reactivation: 0.0003, contraction: 0.0012, churn: 0.0015 },
			},
		],
		/* Leavers are smaller than the typical account: one that cancels pays
       this fraction of its plan's revenue per account. */
		leaverSize: 0.5,
		/* Closing figures shared with the other Analytics pages, so they all
       agree. settleToTargets() pulls the generated months onto them. */
		targets: {
			/* MRR in September 2025. */
			lastYearMrr: 655000,
			/* MRR per plan in September 2026. */
			mrr: { starter: 158000, growth: 361000, enterprise: 361000 },
			accounts: { starter: 1190, growth: 790, enterprise: 160 },
			/* Expansion plus reactivation over the trailing twelve months, as a
         share of MRR a year earlier. */
			expansionShare: 0.19,
			/* Contraction plus churn over the same months: 93% gross retention
         and 112% net. */
			lossShare: 0.07,
		},
		regions: [
			{ id: 'northeast', name: 'Northeast', share: 0.47, grow: 1, lose: 1, annual: 0 },
			{ id: 'midwest', name: 'Midwest', share: 0.3, grow: 0.92, lose: 0.86, annual: 0.04 },
			{ id: 'west', name: 'West', share: 0.15, grow: 1.24, lose: 1.12, annual: -0.03 },
			{ id: 'south', name: 'South', share: 0.08, grow: 1.12, lose: 1.3, annual: -0.07 },
		],
		channels: [
			{ id: 'self', name: 'Self-serve', annual: -0.05, cardShare: 1 },
			{ id: 'sales', name: 'Sales-led', annual: 0.1, cardShare: 0.25 },
		],
		/* How each plan's opening MRR divides between the channels. Nobody
       buys Max without the sales team. */
		channelMix: {
			starter: { self: 0.9, sales: 0.1 },
			growth: { self: 0.38, sales: 0.62 },
			enterprise: { self: 0, sales: 1 },
		},
		/* Pull of new business in each calendar month, starting in January. */
		seasonality: [1.18, 1.02, 1.1, 0.96, 0.94, 1, 0.84, 0.8, 1.08, 1.1, 1, 0.82],
		/* Where annual renewals fall, starting in January. The twelve weights
       total 12, so a year of invoices matches a year of annual MRR. */
		renewals: [1.9, 0.8, 0.9, 1.1, 0.8, 1, 0.9, 0.7, 1, 1, 0.8, 1.1],
		movements: [
			{ id: 'new', name: 'New', sign: 1, icon: 'bi-stars', slot: 1 },
			{ id: 'expansion', name: 'Expansion', sign: 1, icon: 'bi-arrow-up-right', slot: 3 },
			{ id: 'reactivation', name: 'Reactivation', sign: 1, icon: 'bi-arrow-counterclockwise', slot: 6 },
			{ id: 'contraction', name: 'Contraction', sign: -1, icon: 'bi-arrow-down-right', tone: 'warning' },
			{ id: 'churn', name: 'Churn', sign: -1, icon: 'bi-box-arrow-right', tone: 'danger' },
		],
		payments: {
			statuses: [
				{ tone: 'success', id: 'retry', name: 'Paid on a retry' },
				{ tone: 'info', id: 'card', name: 'Paid after a card update' },
				{ tone: 'warning', id: 'retrying', name: 'Still retrying' },
				{ tone: 'danger', id: 'written', name: 'Written off' },
			],
			/* Share of failures still in the retry cycle, by how many months
         ago they failed. */
			stillRetrying: [0.46, 0.08],
			/* Of the settled failures, the share a scheduled retry collects; the
         remainder either get a new card or are written off (plan.written). */
			retryWins: 0.68,
			declines: [
				'Insufficient funds',
				'Card expired',
				'Bank declined the charge',
				'Card reported lost',
				'Needs 3-D Secure approval',
			],
		},
		names: {
			lead: [
				'Alder',
				'Brightline',
				'Cinder',
				'Driftwood',
				'Brazier',
				'Fernhill',
				'Granite',
				'Halyard',
				'Ironbark',
				'Avocet',
				'Glint',
				'Oakhaven',
				'Northgate',
				'Oakridge',
				'Larchwood',
				'Quarry',
				'Redwood',
				'Saltmarsh',
				'Tidewater',
				'Upland',
				'Vantage',
				'Westbrook',
				'Yellowfin',
				'Zephyr',
				'Ashford',
				'Bluestem',
				'Copperleaf',
				'Eastwind',
				'Foxglove',
				'Goldcrest',
				'Inkwell',
				'Larkspur',
				'Mosaic',
				'Stratus',
				'Orchard',
				'Parallel',
				'Millrace',
				'Sable',
				'Thistle',
				'Verity',
				'Wren',
				'Lattice',
			],
			tail: [
				'Home Care',
				'Pet Care',
				'Studios',
				'Cleaning Co',
				'Care Services',
				'Home Services',
				'Carers',
				'Facilities',
				'Property Care',
				'Movers',
				'Pet Sitting',
				'Walkers',
				'Care',
				'Photography',
				'Care at Home',
				'Garden Care',
				'Property Services',
				'Removals',
				'Film and Photo',
				'Moving and Storage',
			],
		},
		/* Paid extras: Travel Planner at $8 a seat, Customer Portal at $199
       an account, and SMS credits billed by use. */
		extras: ['Travel Planner', 'Customer Portal', 'SMS credits'],
		leaveReasons: [
			'Moved to another scheduling tool',
			'Budget was cut',
			'Seasonal staff laid off',
			'Staff stopped using the mobile app',
			'Bought by a larger company',
			'Company closed',
		],
		accountManagers: [
			'Dana Whitfield',
			'Todd Ingram',
			'Phyllis Riggs',
			'Chad Barlow',
			'Hope Stout',
			'Travis Bartlett',
		],
		/* Entries in the Saved views menu; each one sets the range, the
       comparison and the filters together. */
		savedViews: [
			{
				id: 'board',
				icon: 'bi-easel',
				title: 'Board pack',
				sub: 'Last 12 months against the year before',
				set: { preset: '12m', compare: 'yoy', plan: '', region: '', segment: '' },
			},
			{
				id: 'enterprise',
				icon: 'bi-building',
				title: 'Max book',
				sub: 'Max, last 12 months',
				set: { preset: '12m', compare: 'prev', plan: 'enterprise', region: '', segment: '' },
			},
			{
				id: 'selfserve',
				icon: 'bi-cursor',
				title: 'Self-serve health',
				sub: 'Self-serve, last 6 months',
				set: { preset: '6m', compare: 'prev', plan: '', region: '', segment: 'self' },
			},
			{
				id: 'midwest',
				icon: 'bi-geo-alt',
				title: 'Midwest this year',
				sub: 'Midwest, year to date against last year',
				set: { preset: 'ytd', compare: 'yoy', plan: '', region: 'midwest', segment: '' },
			},
			{
				id: 'west',
				icon: 'bi-signpost',
				title: 'Growth in the West',
				sub: 'Pro plan, West, last quarter',
				set: { preset: '3m', compare: 'prev', plan: 'growth', region: 'west', segment: '' },
			},
		],
	};

	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const MOVE_IDS = SAMPLE.movements.map((move) => move.id);
	const PLAN_BY_ID = keyed(SAMPLE.plans);
	const REGION_BY_ID = keyed(SAMPLE.regions);
	const CHANNEL_BY_ID = keyed(SAMPLE.channels);
	const MOVE_BY_ID = keyed(SAMPLE.movements);
	const STATUS_BY_ID = keyed(SAMPLE.payments.statuses);
	const REGION_SHORT = { northeast: 'Northeast', midwest: 'Midwest', west: 'West', south: 'South' };
	const MINUS_SIGN = '−';
	/* Where an account name leads. The demo ships one account page; in an
     app this would be /accounts/:id. */
	const ACCOUNT_PAGE = 'company-details.html';
	const PREVIEW_STATE = new URLSearchParams(location.search).get('state') || '';

	const HISTORY = composeHistory(SAMPLE);
	const LATEST = HISTORY.months.length - 1;
	const STARTING_STATE = {
		preset: '12m',
		from: LATEST - 11,
		to: LATEST,
		compare: 'prev',
		plan: '',
		region: '',
		segment: '',
	};

	/* What the visitor has picked, and the figures worked out from the last
     answer for that pick (null while nothing matches). */
	const choice = { ...STARTING_STATE };
	let report = null;
	let requestCount = 0;
	let latestRequest = 0;
	let quietSync = false;
	let tables = null;

	const controls = {
		board: pick('[data-rv-board]'),
		from: pick('[data-rv-from]'),
		to: pick('[data-rv-to]'),
		compare: pick('[data-rv-compare]'),
		plan: pick('[data-rv-filter="plan"]'),
		region: pick('[data-rv-filter="region"]'),
		customRange: pick('[data-rv-custom]'),
		chips: pick('[data-rv-applied]'),
	};

	const drawer = pick('[data-rv-drawer]');
	const drawerParts = {
		body: pick('[data-rv-r="body"]', drawer),
		link: pick('[data-rv-r="link"]', drawer),
		badge: pick('[data-rv-r="icon"]', drawer),
		title: pick('[data-rv-r="title"]', drawer),
		sub: pick('[data-rv-r="sub"]', drawer),
	};
	const opened = { kind: 'moves', at: 0, list: [], accounts: [] };

	const liveCharts = new Map();
	const drawnOnce = new Set();
	const sightings =
		'IntersectionObserver' in window ? new IntersectionObserver(onSighting, { rootMargin: '80px 0px' }) : null;

	/*
	 * Wires the page: canvases wait to be seen, the drawer and both ledger
	 * tables get their handlers, the controls are filled and bound, and the
	 * first request goes out.
	 */
	function start() {
		for (const canvas of pickAll('canvas[data-rv-chart]')) watchCanvas(canvas);
		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() => rebuildCharts(false));
		});

		tables = {
			moves: createLedger(pick('[data-rv-table="moves"]'), MOVEMENT_TABLE),
			failed: createLedger(pick('[data-rv-table="failed"]'), PAYMENT_TABLE),
		};

		bindDrawer();
		for (const button of pickAll('[data-rv-export="summary"]')) {
			button.addEventListener('click', () => downloadCsv('summary'));
		}

		fillControls();
		bindControls();
		syncControls();
		requery();
	}

	/*
	 * The history: the shape backend.revenue() answers with.
	 *
	 *   months   [{ key: '2026-09', y, m, label: 'Sep 2026', short: 'Sep' }]
	 *   cells    one per plan, region and channel, each holding a value per
	 *            month for mrr, accounts and annualShare, the five movements,
	 *            the accounts they moved (newLogos, lostLogos, backLogos) and
	 *            billing (billed, failed, recovered, written, retrying).
	 *   failed   one entry per failed card charge: { id, month, day, account,
	 *            plan, region, segment, amount, attempts, status, decline }
	 *
	 * A real backend sends the same structure; composeHistory() is only here
	 * because the demo has nothing to ask.
	 */
	function composeHistory(spec) {
		const draw = randomStream(spec.seed);
		const months = calendarFor(spec);
		const cells = [];
		const failed = [];
		const invoices = { last: 20410 };

		for (const plan of spec.plans) {
			for (const region of spec.regions) {
				for (const channel of spec.channels) {
					const mix = spec.channelMix[plan.id][channel.id];
					if (!mix) continue;
					cells.push(simulateCell(spec, months, draw, { plan, region, channel, mix }, failed, invoices));
				}
			}
		}

		settleToTargets(spec, cells);
		return { months, cells, failed };
	}

	/** Month records from the first month of the sample, one per month. */
	function calendarFor(spec) {
		const [firstYear, firstMonth] = spec.startsAt;
		return Array.from({ length: spec.monthCount }, (_, offset) => {
			const y = firstYear + Math.floor((firstMonth + offset) / 12);
			const m = (firstMonth + offset) % 12;
			return {
				key: `${y}-${String(m + 1).padStart(2, '0')}`,
				y,
				m,
				label: `${MONTH_ABBR[m]} ${y}`,
				short: MONTH_ABBR[m],
			};
		});
	}

	/**
	 * Plays one plan, region and channel forward month by month, appending
	 * any failed charges it produces to `failed`.
	 */
	function simulateCell(spec, months, draw, slice, failed, invoices) {
		const { plan, region, channel, mix } = slice;
		const cell = {
			plan: plan.id,
			region: region.id,
			segment: channel.id,
			mrr: [],
			accounts: [],
			annualShare: [],
			newLogos: [],
			lostLogos: [],
			backLogos: [],
			billed: [],
			failed: [],
			recovered: [],
			written: [],
			retrying: [],
		};
		for (const id of MOVE_IDS) cell[id] = [];

		let mrr = Math.round((plan.opening * region.share * mix) / 10) * 10;
		let accounts = Math.max(1, Math.round(mrr / plan.arpa));

		for (let at = 0; at < spec.monthCount; at += 1) {
			const calMonth = months[at].m;
			const opening = mrr;
			const monthMoves = {
				new: swing(opening, plan.rates.new, region.grow * spec.seasonality[calMonth], draw),
				expansion: swing(opening, plan.rates.expansion, 1, draw),
				reactivation: swing(opening, plan.rates.reactivation, 1, draw),
				contraction: swing(opening, plan.rates.contraction, region.lose, draw),
				churn: swing(opening, plan.rates.churn, region.lose, draw),
			};
			const perAccount = opening / accounts;
			const gained = Math.max(monthMoves.new ? 1 : 0, Math.round(monthMoves.new / (perAccount * 0.85)));
			const returned = Math.max(
				monthMoves.reactivation ? 1 : 0,
				Math.round(monthMoves.reactivation / perAccount),
			);
			const left = Math.min(
				accounts - 1,
				Math.max(monthMoves.churn ? 1 : 0, Math.round(monthMoves.churn / (perAccount * spec.leaverSize))),
			);

			for (const id of MOVE_IDS) cell[id].push(monthMoves[id]);

			mrr =
				opening +
				monthMoves.new +
				monthMoves.expansion +
				monthMoves.reactivation -
				monthMoves.contraction -
				monthMoves.churn;
			accounts = accounts + gained + returned - left;
			cell.newLogos.push(gained);
			cell.backLogos.push(returned);
			cell.lostLogos.push(left);
			cell.mrr.push(mrr);
			cell.accounts.push(accounts);
			const yearlyShare = Math.min(
				0.98,
				Math.max(0.05, plan.annual + region.annual + channel.annual + at * 0.0022),
			);
			cell.annualShare.push(yearlyShare);

			/* Monthly plans invoice every month; annual ones when they renew. */
			const invoiced = Math.round(mrr * (1 - yearlyShare) + mrr * yearlyShare * spec.renewals[calMonth]);
			cell.billed.push(invoiced);

			const outcome = failCharges(spec, draw, {
				at,
				plan,
				region,
				channel,
				yearlyShare,
				failed,
				invoices,
				goal: invoiced * channel.cardShare * plan.fail * (0.7 + draw() * 0.6),
				typical: mrr / accounts,
			});
			cell.failed.push(outcome.failed);
			cell.recovered.push(outcome.recovered);
			cell.written.push(outcome.written);
			cell.retrying.push(outcome.retrying);
		}
		return cell;
	}

	/** One month's movement: a rate of the opening MRR, jittered, to the $10. */
	function swing(opening, rate, factor, draw) {
		return Math.round((opening * rate * factor * (0.72 + draw() * 0.56)) / 10) * 10;
	}

	/**
	 * Draws failed card charges for one month until they reach the month's
	 * goal, settles each one, and returns the amounts by outcome.
	 */
	function failCharges(spec, draw, month) {
		const { at, plan, region, channel, yearlyShare, failed, invoices, goal, typical } = month;
		const stillOpen = spec.payments.stillRetrying[spec.monthCount - 1 - at] || 0;
		const settledAs = { failed: 0, recovered: 0, written: 0, retrying: 0 };
		let drawn = 0;

		while (drawn < goal) {
			const yearly = draw() < yearlyShare * 0.25;
			const charge = Math.max(9, Math.round(typical * (yearly ? 12 : 1) * (0.65 + draw() * 0.7)));
			if (drawn > 0 && drawn + charge > goal * 1.2) break;
			drawn += charge;

			const status = draw() < stillOpen ? 'retrying' : settleCharge(spec, plan, draw());
			const attempts = attemptsFor(status, draw);
			const customer = Math.floor(draw() * 100000);
			invoices.last += 1 + Math.floor(draw() * 3);
			const day = 1 + Math.floor(draw() * 27);
			failed.push({
				id: `#${invoices.last}`,
				month: at,
				day,
				account: customerName(customer),
				plan: plan.id,
				region: region.id,
				segment: channel.id,
				amount: charge,
				yearly,
				attempts,
				status,
				decline: spec.payments.declines[Math.floor(draw() * spec.payments.declines.length)],
			});

			settledAs.failed += charge;
			if (status === 'written') settledAs.written += charge;
			else if (status === 'retrying') settledAs.retrying += charge;
			else settledAs.recovered += charge;
		}
		return settledAs;
	}

	/** Where a charge that is no longer retrying ended up. */
	function settleCharge(spec, plan, roll) {
		if (roll < plan.written) return 'written';
		return roll < plan.written + (1 - plan.written) * spec.payments.retryWins ? 'retry' : 'card';
	}

	/** How many charge attempts a failed payment took, by its outcome. */
	function attemptsFor(status, draw) {
		if (status === 'written') return 4;
		const base = { retry: 2, card: 3 }[status] || 1;
		return base + Math.floor(draw() * 2);
	}

	/*
	 * Random months wander, so the sample settles the gap in its largest
	 * cell: September 2025 MRR through that month's new business, then the
	 * trailing year of expansion and of losses, then each plan's September
	 * 2026 MRR and paying accounts. A correction changes one movement and
	 * every later month of MRR together, so the movements still explain
	 * every change.
	 */
	function settleToTargets(spec, cells) {
		const goal = spec.targets;
		if (!goal || !cells.length) return;
		const closing = spec.monthCount - 1;
		const yearBefore = closing - 12;

		function totalAt(group, field, at) {
			return group.reduce((sum, cell) => sum + cell[field][at], 0);
		}
		function trailingYear(group, fields) {
			return group.reduce(
				(sum, cell) =>
					sum +
					fields.reduce(
						(inner, field) => inner + cell[field].slice(yearBefore + 1).reduce((x, y) => x + y, 0),
						0,
					),
				0,
			);
		}
		function biggest(group, at, field) {
			return group.reduce((best, cell) => (cell[field][at] > best[field][at] ? cell : best));
		}
		function correct(cell, field, at, delta) {
			const direction = spec.movements.find((move) => move.id === field).sign;
			cell[field][at] += delta * direction;
			for (let later = at; later < cell.mrr.length; later += 1) cell.mrr[later] += delta;
		}

		correct(
			biggest(cells, yearBefore, 'new'),
			'new',
			yearBefore,
			goal.lastYearMrr - totalAt(cells, 'mrr', yearBefore),
		);
		correct(
			biggest(cells, closing, 'expansion'),
			'expansion',
			closing,
			Math.round(goal.expansionShare * goal.lastYearMrr) - trailingYear(cells, ['expansion', 'reactivation']),
		);
		correct(
			biggest(cells, closing, 'churn'),
			'churn',
			closing,
			trailingYear(cells, ['contraction', 'churn']) - Math.round(goal.lossShare * goal.lastYearMrr),
		);

		for (const plan of spec.plans) {
			const mine = cells.filter((cell) => cell.plan === plan.id);
			if (!mine.length) continue;
			const anchor = biggest(mine, closing, 'new');
			correct(anchor, 'new', closing, goal.mrr[plan.id] - totalAt(mine, 'mrr', closing));
			const shortfall = goal.accounts[plan.id] - totalAt(mine, 'accounts', closing);
			anchor.accounts[closing] += shortfall;
			if (anchor.newLogos[closing] + shortfall >= 0) anchor.newLogos[closing] += shortfall;
			else anchor.lostLogos[closing] -= shortfall;
		}
	}

	/** Mulberry32: the same seed always gives the same run of numbers. */
	function randomStream(seed) {
		let state = seed >>> 0;
		return function next() {
			state = (state + 0x6d2b79f5) >>> 0;
			let mixed = state;
			mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	/** FNV-1a over a string, used to seed one row's account split. */
	function fingerprint(text) {
		let value = 2166136261;
		for (const char of text) {
			value ^= char.charCodeAt(0);
			value = Math.imul(value, 16777619);
		}
		return value >>> 0;
	}

	function customerName(number) {
		const { lead, tail } = SAMPLE.names;
		const first = lead[number % lead.length];
		const second = tail[Math.floor(number / lead.length) % tail.length];
		return `${first} ${second}`;
	}

	/*
	 * The backend: every method returns a Promise. The demo answers from
	 * HISTORY after a short delay; replace the bodies with fetch() calls and
	 * keep what they resolve to.
	 */
	const backend = {
		/**
		 * GET /api/revenue?from=2025-10&to=2026-09&plan=growth&region=midwest&segment=sales
		 * resolves to { months, cells, failed } for the filters. The demo sends
		 * every month; a server only needs the range, the months it is compared
		 * with, and the six closed months the outlook is read from.
		 */
		revenue(range, filters) {
			requestCount += 1;
			if (PREVIEW_STATE === 'loading') return new Promise(() => {});
			return pause(requestCount === 1 ? 650 : 320).then(() => {
				if (PREVIEW_STATE === 'error' && requestCount === 1) throw new Error('The server did not answer');
				if (PREVIEW_STATE === 'empty') return { months: HISTORY.months, cells: [], failed: [] };
				function fitsFilters(item) {
					return (
						(!filters.plan || item.plan === filters.plan) &&
						(!filters.region || item.region === filters.region) &&
						(!filters.segment || item.segment === filters.segment)
					);
				}
				return {
					months: HISTORY.months,
					cells: HISTORY.cells.filter(fitsFilters),
					failed: HISTORY.failed.filter(fitsFilters),
				};
			});
		},

		/**
		 * GET /api/revenue/movements/:month/:plan/:region/:segment/:type
		 * resolves to the accounts behind one ledger row: [{ name, detail, amount }].
		 */
		accountsFor(row) {
			return Promise.resolve(splitAcrossAccounts(row));
		},

		/**
		 * POST /api/revenue/exports { kind, rows } resolves to a file to save.
		 * The demo writes the CSV in the browser; `name` describes the contents
		 * and becomes part of the file name, e.g. "moves-2025-10-to-2026-09".
		 */
		csvFile(name, rows) {
			return Promise.resolve({ filename: `revenue-${name}.csv`, csv: csvText(rows) });
		},
	};

	function pause(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/* How each kind of movement describes one account's part in it. */
	const MOVE_DETAIL = {
		new(seats, plan, draw) {
			return `Started on ${seats} seats${draw() < plan.annual ? ', billed yearly' : ', billed monthly'}`;
		},
		expansion(seats, plan, draw) {
			return draw() < 0.62 ? `Added ${seats} seats` : `Added ${oneOf(SAMPLE.extras, draw)}`;
		},
		reactivation(seats, plan, draw) {
			return `Came back after ${2 + Math.floor(draw() * 9)} months away`;
		},
		contraction(seats, plan, draw) {
			return draw() < 0.7 ? `Removed ${seats} seats` : `Dropped ${oneOf(SAMPLE.extras, draw)}`;
		},
		churn(seats, plan, draw) {
			return oneOf(SAMPLE.leaveReasons, draw);
		},
	};

	/*
	 * The demo's stand-in for the accounts behind one movement row. It
	 * divides the row's amount among its accounts so the parts add up to it
	 * to the dollar; a server would list the real accounts instead.
	 */
	function splitAcrossAccounts(row) {
		const draw = randomStream(fingerprint(row.key));
		const plan = PLAN_BY_ID[row.plan];
		const weights = Array.from({ length: Math.max(1, row.accounts) }, () => 0.25 + draw() * draw() * 3);
		const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
		const size = Math.abs(row.amount);
		const shares = weights.map((weight) => Math.max(10, Math.round((size * weight) / weightSum / 10) * 10));
		/* Rounding leaves a few dollars over or under; the largest share absorbs them. */
		const leftover = size - shares.reduce((sum, share) => sum + share, 0);
		shares[shares.indexOf(Math.max(...shares))] += leftover;
		const managed = row.segment === 'sales';
		const describe = MOVE_DETAIL[row.type] || MOVE_DETAIL.churn;

		const accounts = shares.map((share, position) => {
			const seats = Math.max(1, Math.round(share / plan.seatPrice));
			let detail = describe(seats, plan, draw);
			if (managed) detail += ` · ${oneOf(SAMPLE.accountManagers, draw)}`;
			return {
				name: customerName(Math.floor(draw() * 100000) + position),
				detail,
				amount: share * Math.sign(row.amount || 1),
			};
		});
		return accounts.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
	}

	function oneOf(list, draw) {
		return list[Math.floor(draw() * list.length)];
	}

	/*
	 * Number formats. Money comes short ($1.24M, $86.5k) or in full
	 * ($86,512); a negative amount always takes a true minus sign, and a
	 * positive one takes a plus only when asked for.
	 */
	function signFor(value, signed) {
		if (value < 0) return MINUS_SIGN;
		return signed && value > 0 ? '+' : '';
	}

	function shortMoney(value, signed) {
		const size = Math.abs(value);
		const sign = signFor(value, signed);
		if (size >= 1e6) return `${sign}$${(size / 1e6).toFixed(size >= 1e8 ? 1 : 2)}M`;
		if (size >= 1e3) return `${sign}$${(size / 1e3).toFixed(size >= 1e5 ? 0 : 1)}k`;
		return `${sign}$${Math.round(size).toLocaleString('en-US')}`;
	}

	function fullMoney(value, signed) {
		return `${signFor(value, signed)}$${Math.round(Math.abs(value)).toLocaleString('en-US')}`;
	}

	function whole(value) {
		return Math.round(value).toLocaleString('en-US');
	}

	function percent(share, places = 1) {
		return `${(share * 100).toFixed(places ?? 1)}%`;
	}

	function signedPercent(share, places = 1) {
		return `${signFor(share, true)}${Math.abs(share * 100).toFixed(places ?? 1)}%`;
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value).replace(/[&<>"']/g, (char) => entities[char]);
	}

	/*
	 * Time spans. A preset turns into first and last month indexes, the
	 * comparison is either the stretch just before or the same months a
	 * year earlier, and a span reads as "Oct 2025 to Sep 2026".
	 */
	function monthsFor(picked) {
		const spans = {
			'3m': () => [LATEST - 2, LATEST],
			'6m': () => [LATEST - 5, LATEST],
			ytd: () => [
				HISTORY.months.findIndex((month) => month.y === HISTORY.months[LATEST].y && month.m === 0),
				LATEST,
			],
			custom: () => [Math.min(picked.from, picked.to), Math.max(picked.from, picked.to)],
		};
		return Object.hasOwn(spans, picked.preset) ? spans[picked.preset]() : [LATEST - 11, LATEST];
	}

	function comparisonFor(range, mode) {
		if (mode === 'none') return { range: null, name: '', why: 'Comparison off' };
		const yearly = mode === 'yoy';
		const length = range[1] - range[0] + 1;
		const earlier = yearly ? [range[0] - 12, range[1] - 12] : [range[0] - length, range[0] - 1];
		const name = yearly ? 'same months last year' : 'previous period';
		return earlier[0] < 0
			? { range: null, name, why: 'No earlier months to compare with' }
			: { range: earlier, name };
	}

	function describeSpan(range) {
		const [first, last] = range.map((at) => HISTORY.months[at].label);
		return range[0] === range[1] ? first : `${first} to ${last}`;
	}

	function comparisonName() {
		return choice.compare === 'yoy' ? 'Last year' : 'Previous period';
	}

	/*
	 * Everything the page shows is computed here, from one backend answer
	 * and the current choice of range, comparison and filters.
	 */
	function summarize(answer) {
		const range = monthsFor(choice);
		const against = comparisonFor(range, choice.compare);
		const cells = answer.cells;
		const monthTotal = answer.months.length;
		const monthly = companyLine(cells, monthTotal);
		const shown = indexesOf(range);

		function sumOver(field, span) {
			return indexesOf(span).reduce((sum, at) => sum + monthly[field][at], 0);
		}

		function periodFigures(span) {
			if (!span) return null;
			const billed = sumOver('billed', span);
			const collected = sumOver('collected', span);
			const open = monthly.open[span[0]];
			const moves = {};
			for (const id of MOVE_IDS) moves[id] = sumOver(id, span);
			return {
				mrr: monthly.mrr[span[1]],
				open,
				arr: monthly.mrr[span[1]] * 12,
				net: sumOver('net', span),
				arpa: monthly.arpa[span[1]],
				accounts: monthly.accounts[span[1]],
				billed,
				collected,
				rate: billed ? collected / billed : 0,
				nrr: open
					? (open +
							sumOver('expansion', span) +
							sumOver('reactivation', span) -
							sumOver('contraction', span) -
							sumOver('churn', span)) /
						open
					: 0,
				moves,
				failed: sumOver('failed', span),
				recovered: sumOver('recovered', span),
				written: sumOver('written', span),
				retrying: sumOver('retrying', span),
			};
		}

		const projection = projectAhead(monthly.mrr, monthTotal);
		return {
			range,
			against,
			monthly,
			now: periodFigures(range),
			before: periodFigures(against.range),
			shown,
			shownBefore: indexesOf(against.range),
			outlook: projection.points,
			outlookMonths: projection.months,
			hasOutlook: range[1] === monthTotal - 1,
			trend: projection.trend,
			plans: planSummaries(cells, monthly, range),
			groups: planRegionGroups(cells, range),
			movementRows: movementRowsFor(cells, shown),
			paymentRows: answer.failed.filter((charge) => charge.month >= range[0] && charge.month <= range[1]),
		};
	}

	/** Month indexes from the first to the last of a range, or none. */
	function indexesOf(span) {
		return span ? Array.from({ length: span[1] - span[0] + 1 }, (_, step) => span[0] + step) : [];
	}

	/**
	 * Adds every cell into one company-wide series per field, then works out
	 * net movement, opening MRR, cash collected, collection rate and revenue
	 * per account for each month.
	 */
	function companyLine(cells, monthTotal) {
		const line = {};
		for (const field of ['mrr', 'accounts', 'billed', 'failed', 'recovered', 'written', 'retrying', ...MOVE_IDS]) {
			const sums = new Array(monthTotal).fill(0);
			for (const cell of cells) {
				for (let at = 0; at < monthTotal; at += 1) sums[at] += cell[field][at];
			}
			line[field] = sums;
		}
		line.net = line.mrr.map(
			(_, at) =>
				line.new[at] + line.expansion[at] + line.reactivation[at] - line.contraction[at] - line.churn[at],
		);
		line.open = line.mrr.map((value, at) => value - line.net[at]);
		line.collected = line.billed.map((value, at) => value - line.failed[at] + line.recovered[at]);
		line.rate = line.billed.map((value, at) => (value ? line.collected[at] / value : 0));
		line.arpa = line.mrr.map((value, at) => (line.accounts[at] ? value / line.accounts[at] : 0));
		return line;
	}

	/*
	 * The outlook carries the average monthly growth of the last six closed
	 * months forward. Its band is a little over one standard deviation
	 * either side, widening with the square root of the months ahead.
	 */
	function projectAhead(mrr, monthTotal) {
		const rates = [];
		for (let at = monthTotal - 6; at < monthTotal; at += 1) {
			if (mrr[at - 1]) rates.push(mrr[at] / mrr[at - 1] - 1);
		}
		const trend = rates.length ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : 0;
		const deviation = rates.length
			? Math.sqrt(rates.reduce((sum, rate) => sum + (rate - trend) * (rate - trend), 0) / rates.length)
			: 0;
		const spread = Math.max(deviation, 0.006) * 1.28;
		const closing = HISTORY.months[monthTotal - 1];

		const points = [];
		const months = [];
		for (let ahead = 1; ahead <= SAMPLE.outlookMonths; ahead += 1) {
			const mid = mrr[monthTotal - 1] * Math.pow(1 + trend, ahead);
			points.push({
				mid,
				low: mid * (1 - spread * Math.sqrt(ahead)),
				high: mid * (1 + spread * Math.sqrt(ahead)),
			});
			const m = (closing.m + ahead) % 12;
			const y = closing.y + Math.floor((closing.m + ahead) / 12);
			months.push({ label: `${MONTH_ABBR[m]} ${y}`, short: MONTH_ABBR[m], m, y });
		}
		return { points, months, trend };
	}

	/** Revenue that was there at the start of a month, before it moved. */
	function openingOf(cell, at) {
		return (
			cell.mrr[at] -
			(cell.new[at] + cell.expansion[at] + cell.reactivation[at] - cell.contraction[at] - cell.churn[at])
		);
	}

	/*
	 * One summary per plan that has cells: its MRR line, the annual and
	 * monthly split and accounts at the end of the range, the share of MRR
	 * lost a month, and the lifetime value that loss implies.
	 */
	function planSummaries(cells, monthly, range) {
		const last = range[1];
		const months = indexesOf(range);
		return SAMPLE.plans
			.filter((plan) => cells.some((cell) => cell.plan === plan.id))
			.map((plan) => {
				const mine = cells.filter((cell) => cell.plan === plan.id);
				const mrr = monthly.mrr.map((_, at) => mine.reduce((sum, cell) => sum + cell.mrr[at], 0));
				const annual = mine.reduce((sum, cell) => sum + cell.mrr[last] * cell.annualShare[last], 0);
				const accounts = mine.reduce((sum, cell) => sum + cell.accounts[last], 0);
				const lost = months.reduce(
					(sum, at) => sum + mine.reduce((inner, cell) => inner + cell.contraction[at] + cell.churn[at], 0),
					0,
				);
				const opening = months.reduce(
					(sum, at) => sum + mine.reduce((inner, cell) => inner + openingOf(cell, at), 0),
					0,
				);
				const loss = opening ? lost / opening : 0;
				const arpa = accounts ? mrr[last] / accounts : 0;
				const lifetime = Math.min(SAMPLE.lifetimeCap, loss ? 1 / loss : SAMPLE.lifetimeCap);
				return {
					plan,
					mrr,
					annual,
					accounts,
					arpa,
					loss,
					monthly: mrr[last] - annual,
					ltv: arpa * SAMPLE.grossMargin * lifetime,
					capped: lifetime >= SAMPLE.lifetimeCap,
				};
			});
	}

	/** One bubble per plan and region with revenue at the end of the range. */
	function planRegionGroups(cells, range) {
		const last = range[1];
		const byPair = new Map();
		for (const cell of cells) {
			const pair = `${cell.plan}|${cell.region}`;
			if (!byPair.has(pair)) byPair.set(pair, []);
			byPair.get(pair).push(cell);
		}

		const groups = [];
		for (const pairCells of byPair.values()) {
			const mrr = pairCells.reduce((sum, cell) => sum + cell.mrr[last], 0);
			const accounts = pairCells.reduce((sum, cell) => sum + cell.accounts[last], 0);
			let lost = 0;
			let opening = 0;
			for (const at of indexesOf(range)) {
				for (const cell of pairCells) {
					lost += cell.contraction[at] + cell.churn[at];
					opening += openingOf(cell, at);
				}
			}
			if (mrr > 0) {
				groups.push({
					plan: pairCells[0].plan,
					region: pairCells[0].region,
					mrr,
					accounts,
					arpa: accounts ? mrr / accounts : 0,
					loss: opening ? lost / opening : 0,
				});
			}
		}
		return groups;
	}

	/** Ledger rows: one per month, plan, region, channel and movement. */
	function movementRowsFor(cells, months) {
		const accountsField = { new: 'newLogos', churn: 'lostLogos', reactivation: 'backLogos' };
		const rows = [];
		for (const at of months) {
			for (const cell of cells) {
				for (const type of MOVE_IDS) {
					const amount = cell[type][at];
					if (!amount) continue;
					const perAccount = cell.accounts[at] ? cell.mrr[at] / cell.accounts[at] : 1;
					const accounts = accountsField[type]
						? cell[accountsField[type]][at]
						: Math.max(1, Math.round(amount / (perAccount * 0.22)));
					rows.push({
						key: [HISTORY.months[at].key, cell.plan, cell.region, cell.segment, type].join('|'),
						month: at,
						plan: cell.plan,
						region: cell.region,
						segment: cell.segment,
						type,
						amount: amount * MOVE_BY_ID[type].sign,
						accounts,
					});
				}
			}
		}
		return rows;
	}

	/*
	 * Chart toolkit: colors from the theme tokens, the options every chart
	 * starts from, and the few canvas drawing helpers the plugins share. It
	 * mirrors the conventions on the Charts pages.
	 */
	const TICK_FONT = { family: TYPEFACE, size: 11.5 };

	function readToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** Red, green, blue and alpha from a hex or rgb()/rgba() color. */
	function rgbaParts(color) {
		const raw = String(color || '').trim();
		const short = /^#([0-9a-f]{3})$/i.exec(raw);
		if (short) return [...short[1]].map((digit) => parseInt(digit + digit, 16)).concat(1);
		const long = /^#([0-9a-f]{6})$/i.exec(raw);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 1];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(raw);
		if (functional) {
			const parts = functional[1].split(',').map((part) => parseFloat(part));
			return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
		}
		return [128, 128, 128, 1];
	}

	function translucent(color, alpha) {
		const [red, green, blue] = rgbaParts(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	/** `share` of the first color with the rest from the second. */
	function blend(first, second, share) {
		const a = rgbaParts(first);
		const b = rgbaParts(second);
		const [red, green, blue] = [0, 1, 2].map((part) => Math.round(a[part] * share + b[part] * (1 - share)));
		return `rgb(${red}, ${green}, ${blue})`;
	}

	function gradientsOff() {
		return document.documentElement.getAttribute('data-basalt-gradients') === 'off';
	}

	function chartColors() {
		const ink = readToken('--basalt-copy', '#12233a');
		const muted = readToken('--basalt-copy-muted', '#5f7186');
		return {
			series: [1, 2, 3, 4, 5, 6, 7, 8].map((slot) => readToken(`--basalt-series-${slot}`, '#2b6fd4')),
			text: ink,
			quiet: blend(muted, ink, 0.82),
			rest: translucent(ink, 0.3),
			grid: translucent(ink, 0.07),
			surface: readToken('--basalt-plane', '#ffffff'),
			border: readToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			success: readToken('--basalt-success', '#12c08f'),
			danger: readToken('--basalt-danger', '#ef4d63'),
			warning: readToken('--basalt-warning', '#f5a524'),
		};
	}

	function planHue(colors, id) {
		return colors.series[PLAN_BY_ID[id].slot - 1];
	}

	function moveHue(colors, id) {
		const move = MOVE_BY_ID[id];
		return move.tone ? colors[move.tone] : colors.series[move.slot - 1];
	}

	function isPlainObject(value) {
		return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
	}

	/** Copies `extra` over `base`, merging nested plain objects key by key. */
	function layerOptions(base, extra) {
		const merged = { ...base };
		for (const [key, value] of Object.entries(extra || {})) {
			merged[key] = isPlainObject(value) && isPlainObject(merged[key]) ? layerOptions(merged[key], value) : value;
		}
		return merged;
	}

	function tickStyle(colors, extra) {
		return { color: colors.quiet, font: TICK_FONT, padding: 8, ...extra };
	}

	/** The options every chart on the page starts from, with `extra` on top. */
	function chartDefaults(colors, animate, extra) {
		return layerOptions(
			{
				responsive: true,
				maintainAspectRatio: false,
				animation: animate ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				layout: { padding: { top: 6, right: 6 } },
				elements: {
					line: { borderWidth: 2.5, borderCapStyle: 'round', borderJoinStyle: 'round' },
					point: { radius: 0, hoverRadius: 5, hoverBorderWidth: 2, hoverBorderColor: colors.surface },
					bar: { borderRadius: 5, borderSkipped: 'start' },
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: colors.surface,
						borderColor: colors.border,
						borderWidth: 1,
						titleColor: colors.text,
						bodyColor: colors.text,
						footerColor: colors.text,
						titleFont: { family: TYPEFACE, size: 12, weight: '600' },
						bodyFont: { family: TYPEFACE, size: 12 },
						footerFont: { family: TYPEFACE, size: 11.5, weight: '600' },
						padding: 10,
						boxPadding: 4,
						cornerRadius: 8,
						usePointStyle: true,
					},
				},
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: tickStyle(colors, { maxRotation: 0, autoSkipPadding: 12 }),
					},
					y: {
						grid: { color: colors.grid },
						border: { display: false },
						ticks: tickStyle(colors, { maxTicksLimit: 5 }),
					},
				},
			},
			extra,
		);
	}

	/* A top-to-bottom fade across the plot; with gradients off, one plain
	   color: `flat`, or the first stop. */
	function verticalGradient(stops, flat) {
		return window.Basalt.chartFill(stops, { flat });
	}

	function barGradient(color) {
		return verticalGradient([
			[0, translucent(color, 0.95)],
			[1, translucent(color, 0.5)],
		]);
	}

	function areaGradient(color, strength) {
		return verticalGradient(
			[
				[0, translucent(color, strength || 0.24)],
				[1, translucent(color, 0)],
			],
			translucent(color, 0.12),
		);
	}

	function barSeries(color, extra) {
		return {
			type: 'bar',
			order: 2,
			backgroundColor: barGradient(color),
			hoverBackgroundColor: color,
			barPercentage: 0.62,
			categoryPercentage: 0.8,
			maxBarThickness: 34,
			...extra,
		};
	}

	function lineSeries(color, extra) {
		return {
			type: 'line',
			order: 0,
			tension: 0.32,
			borderColor: color,
			backgroundColor: color,
			pointBackgroundColor: color,
			pointHoverBackgroundColor: color,
			...extra,
		};
	}

	/** Points drawn as rings: the card color inside, the series color round it. */
	function hollowPoints(colors, color, radius = 3.5) {
		return {
			pointRadius: radius ?? 3.5,
			pointHoverRadius: 5.5,
			pointBorderWidth: 2,
			pointBackgroundColor: colors.surface,
			pointBorderColor: color,
			pointHoverBackgroundColor: color,
			pointHoverBorderColor: colors.surface,
		};
	}

	/**
	 * A label on a rounded tag with the card color behind body text, so it
	 * reads on every palette. (x, y) is the middle of the tag's lower edge;
	 * `align` pins its left or right edge there instead, and the tag is kept
	 * inside `box`.
	 */
	function drawTag(ctx, colors, x, y, label, box, { align, dot } = {}) {
		ctx.save();
		ctx.font = `600 11px ${TYPEFACE}`;
		const dotRoom = dot ? 12 : 0;
		const width = ctx.measureText(label).width + 16 + dotRoom;
		const height = 21;
		const anchored = { left: x, right: x - width }[align] ?? x - width / 2;
		const left = Math.max(box.left, Math.min(anchored, box.right - width));
		const top = Math.max(box.top ?? -Infinity, y - height);

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

	function drawCaption(ctx, color, label, x, y, align = 'left') {
		ctx.save();
		ctx.font = `600 11.5px ${TYPEFACE}`;
		ctx.fillStyle = color;
		ctx.textAlign = align;
		ctx.textBaseline = 'bottom';
		ctx.fillText(label, x, y);
		ctx.restore();
	}

	/* Lines carry a soft shadow in their own color, or a thin card-colored
     edge when gradients are turned off. */
	function lineHalo(colors) {
		return {
			id: 'rvLineHalo',
			beforeDatasetDraw(chart, args) {
				if (args.meta.type !== 'line') return;
				const dataset = chart.data.datasets[args.index];
				const { ctx } = chart;
				ctx.save();
				if (dataset.halo && !gradientsOff()) {
					ctx.shadowColor = translucent(dataset.halo, 0.4);
					ctx.shadowBlur = 10;
					ctx.shadowOffsetY = 4;
					return;
				}
				ctx.shadowColor = colors.surface;
				ctx.shadowBlur = 5;
			},
			afterDatasetDraw(chart, args) {
				if (args.meta.type === 'line') chart.ctx.restore();
			},
		};
	}

	/** A value axis whose floor, ceiling and step all land on round numbers. */
	function roundAxis(low, high, format) {
		const rough = Math.max(1, (high - low) / 5);
		const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
		const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rough);
		const color = blend(readToken('--basalt-copy-muted', '#5f7186'), readToken('--basalt-copy', '#12233a'), 0.82);
		return {
			min: Math.max(0, Math.floor(low / step) * step),
			max: Math.ceil(high / step) * step,
			ticks: { font: TICK_FONT, padding: 8, stepSize: step, callback: format, color },
		};
	}

	/** Month ticks, with the year underneath on the first month and on each January. */
	function monthTicks(indexes) {
		return indexes.map((at, position) => {
			const month = HISTORY.months[at];
			return position === 0 || month.m === 0 ? [month.short, String(month.y)] : month.short;
		});
	}

	/*
	 * One recipe per data-rv-chart value. Each takes the colors, whether to
	 * animate, and the canvas, and returns a Chart.js config (or null when
	 * there is nothing to draw).
	 */
	const CHART_RECIPES = {
		/* Closed months as bars, the outlook as a dashed line inside a band,
       and the comparison stretch as a thin dotted line, after the forecast
       chart on charts-mixed. */
		forecast(colors, animate) {
			const shot = report;
			const barColor = colors.series[0];
			const outlookColor = colors.series[7];
			const closedMonths = shot.shown.length;
			const aheadCount = shot.hasOutlook ? shot.outlook.length : 0;
			const seam = closedMonths - 1;
			const aheadTicks = shot.hasOutlook
				? shot.outlookMonths.map((month, position) =>
						month.m === 0 || position === 0 ? [month.short, String(month.y)] : month.short,
					)
				: [];
			const labels = [...monthTicks(shot.shown), ...aheadTicks];
			const blanks = new Array(aheadCount).fill(null);
			const closed = [...shot.shown.map((at) => shot.monthly.mrr[at]), ...blanks];
			const earlier = shot.shownBefore.length
				? [...shot.shownBefore.map((at) => shot.monthly.mrr[at]), ...blanks]
				: [];

			function outlookLine(field) {
				return labels.map((_, position) => {
					if (position < seam) return null;
					return position === seam
						? shot.monthly.mrr[shot.shown[seam]]
						: shot.outlook[position - closedMonths][field];
				});
			}

			const datasets = [
				barSeries(barColor, {
					label: 'MRR',
					data: closed,
					grouped: false,
					barPercentage: 0.6,
					maxBarThickness: 40,
				}),
			];
			if (earlier.length) {
				datasets.push(
					lineSeries(colors.rest, {
						label: comparisonName(),
						data: earlier,
						order: 1,
						borderWidth: 1.75,
						borderDash: [2, 4],
						pointHoverBackgroundColor: colors.rest,
					}),
				);
			}
			if (aheadCount) {
				datasets.push(
					lineSeries(outlookColor, {
						label: 'Forecast',
						data: outlookLine('mid'),
						borderDash: [6, 5],
						halo: outlookColor,
						...hollowPoints(colors, outlookColor),
						pointRadius: (context) => (context.dataIndex === labels.length - 1 ? 4.5 : 0),
					}),
					{
						type: 'line',
						label: 'High',
						data: outlookLine('high'),
						order: 1,
						tension: 0.32,
						fill: '+1',
						backgroundColor: translucent(outlookColor, gradientsOff() ? 0.14 : 0.18),
						borderWidth: 0,
						pointRadius: 0,
						pointHoverRadius: 0,
					},
					{
						type: 'line',
						label: 'Low',
						data: outlookLine('low'),
						order: 1,
						tension: 0.32,
						fill: false,
						borderWidth: 0,
						pointRadius: 0,
						pointHoverRadius: 0,
					},
				);
			}
			const plotted = [...closed, ...earlier, ...(aheadCount ? outlookLine('high') : [])].filter(
				(value) => value != null,
			);

			return {
				type: 'bar',
				data: { labels, datasets },
				options: chartDefaults(colors, animate, {
					layout: { padding: { top: 30, right: 8 } },
					plugins: {
						tooltip: {
							filter: (item) =>
								item.parsed.y != null &&
								!['High', 'Low'].includes(item.dataset.label) &&
								!(item.dataset.label === 'Forecast' && item.dataIndex < closedMonths),
							callbacks: {
								title: ([first]) =>
									first.dataIndex < closedMonths
										? HISTORY.months[shot.shown[first.dataIndex]].label
										: shot.outlookMonths[first.dataIndex - closedMonths].label,
								label: (item) => ` ${item.dataset.label}: ${fullMoney(item.parsed.y)}`,
								footer: ([first]) => {
									const at = first.dataIndex;
									if (at >= closedMonths) {
										const point = shot.outlook[at - closedMonths];
										return `Likely ${shortMoney(point.low)} to ${shortMoney(point.high)}`;
									}
									return earlier[at] != null
										? `${signedPercent(closed[at] / earlier[at] - 1)} on the ${shot.against.name}`
										: '';
								},
							},
						},
					},
					scales: {
						x: { ticks: { maxTicksLimit: 14 } },
						y: roundAxis(Math.min(...plotted) * 0.85, Math.max(...plotted) * 1.04, (value) =>
							shortMoney(value),
						),
					},
				}),
				plugins: [
					{
						id: 'rvOutlookMarks',
						beforeDatasetsDraw(chart) {
							if (!aheadCount) return;
							const {
								ctx,
								chartArea: area,
								scales: { x },
							} = chart;
							const divider = (x.getPixelForValue(seam) + x.getPixelForValue(seam + 1)) / 2;
							ctx.save();
							ctx.strokeStyle = colors.rest;
							ctx.lineWidth = 1;
							ctx.setLineDash([3, 4]);
							ctx.beginPath();
							ctx.moveTo(divider, area.top - 18);
							ctx.lineTo(divider, area.bottom);
							ctx.stroke();
							ctx.restore();
							drawCaption(ctx, colors.quiet, 'Closed', divider - 8, area.top - 16, 'right');
							drawCaption(ctx, colors.quiet, 'Forecast', divider + 8, area.top - 16, 'left');
						},
						afterDatasetsDraw(chart) {
							const { ctx, chartArea: area } = chart;
							const bounds = { left: area.left, right: area.right + 6, top: 0 };
							const lastBar = chart.getDatasetMeta(0).data[seam];
							if (lastBar && !aheadCount) {
								drawTag(
									ctx,
									colors,
									lastBar.x,
									lastBar.y - 10,
									`${HISTORY.months[shot.shown[seam]].short} · ${shortMoney(closed[seam])}`,
									bounds,
									{ align: 'right', dot: barColor },
								);
							}
							if (!aheadCount) return;
							const outlookMeta = chart.getDatasetMeta(
								datasets.findIndex((dataset) => dataset.label === 'Forecast'),
							);
							const finalPoint = outlookMeta?.data[labels.length - 1];
							if (finalPoint) {
								drawTag(
									ctx,
									colors,
									finalPoint.x,
									finalPoint.y - 12,
									`${shot.outlookMonths[aheadCount - 1].short} · ${shortMoney(shot.outlook[aheadCount - 1].mid)}`,
									bounds,
									{ align: 'right', dot: outlookColor },
								);
							}
						},
					},
				],
			};
		},

		/* Gains stacked above zero and losses below, with the net as a line,
       after the negative and stacked bars on charts-bar. */
		movement(colors, animate) {
			const shot = report;
			const datasets = SAMPLE.movements.map((move) => {
				const hue = moveHue(colors, move.id);
				return barSeries(hue, {
					label: move.name,
					movement: move.id,
					data: shot.shown.map((at) => shot.monthly[move.id][at] * move.sign),
					stack: 'moves',
					backgroundColor: translucent(hue, 0.88),
					hoverBackgroundColor: hue,
					borderColor: colors.surface,
					borderWidth: 1,
					borderRadius: 3,
					borderSkipped: false,
					barPercentage: 0.66,
					maxBarThickness: 36,
				});
			});
			datasets.push(
				lineSeries(colors.text, {
					label: 'Net new MRR',
					data: shot.shown.map((at) => shot.monthly.net[at]),
					tension: 0.25,
					borderWidth: 2,
					...hollowPoints(colors, colors.text, 3),
				}),
			);

			function barUnder(event, chart) {
				return chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, false)[0];
			}
			function onZero(context) {
				return context.tick?.value === 0;
			}

			return {
				type: 'bar',
				data: { labels: monthTicks(shot.shown), datasets },
				options: chartDefaults(colors, animate, {
					onClick: (event, active, chart) => {
						const hit = barUnder(event, chart);
						if (!hit) return;
						drillInto({
							type: chart.data.datasets[hit.datasetIndex].movement || '',
							month: shot.shown[hit.index],
						});
					},
					onHover: (event, active, chart) => {
						chart.canvas.style.cursor = barUnder(event, chart) ? 'pointer' : 'default';
					},
					plugins: {
						tooltip: {
							itemSort: (a, b) => a.datasetIndex - b.datasetIndex,
							filter: (item) => item.parsed.y !== 0,
							callbacks: {
								title: ([first]) => HISTORY.months[shot.shown[first.dataIndex]].label,
								label: (item) => ` ${item.dataset.label}: ${fullMoney(item.parsed.y, true)}`,
								footer: () => 'Select a bar to open it in the ledger',
							},
						},
					},
					scales: {
						x: { stacked: true },
						y: {
							stacked: true,
							grid: {
								color: (context) => (onZero(context) ? colors.rest : colors.grid),
								lineWidth: (context) => (onZero(context) ? 1.5 : 1),
							},
							ticks: { callback: (value) => shortMoney(value, true) },
						},
					},
				}),
			};
		},

		/* A small multiple per plan, after charts-line. */
		plan(colors, animate, canvas) {
			const shot = report;
			const planId = canvas.getAttribute('data-rv-plan');
			const summary = shot.plans.find((entry) => entry.plan.id === planId);
			if (!summary) return null;
			const hue = planHue(colors, planId);
			const values = shot.shown.map((at) => summary.mrr[at]);
			const earlier = shot.shownBefore.map((at) => summary.mrr[at]);
			const floor = Math.min(...values, ...earlier);
			const ceiling = Math.max(...values, ...earlier);
			const band = ceiling - floor;

			const datasets = [
				lineSeries(hue, {
					label: summary.plan.name,
					data: values,
					fill: 'start',
					backgroundColor: areaGradient(hue, 0.3),
					borderWidth: 2,
					halo: hue,
					pointRadius: (context) => (context.dataIndex === values.length - 1 ? 3 : 0),
				}),
			];
			if (earlier.length) {
				datasets.push(
					lineSeries(colors.rest, {
						label: comparisonName(),
						data: earlier,
						borderWidth: 1.5,
						borderDash: [2, 4],
						pointHoverBackgroundColor: colors.rest,
					}),
				);
			}

			return {
				type: 'line',
				data: { labels: shot.shown.map((at) => HISTORY.months[at].label), datasets },
				options: chartDefaults(colors, animate, {
					layout: { padding: { top: 6, right: 6, bottom: 2, left: 2 } },
					plugins: {
						tooltip: {
							callbacks: { label: (item) => ` ${item.dataset.label}: ${fullMoney(item.parsed.y)}` },
						},
					},
					scales: {
						x: { display: false },
						y: { display: false, min: floor - band * 0.25 - 1, max: ceiling + band * 0.08 + 1 },
					},
				}),
			};
		},

		/* Annual against monthly billing as 100% stacked horizontal bars,
       after the percent bars on charts-bar. */
		interval(colors, animate) {
			const shot = report;
			const rows = shot.plans.map((entry) => ({
				name: entry.plan.name,
				monthly: entry.monthly,
				annual: entry.annual,
			}));
			if (shot.plans.length > 1) {
				rows.unshift({
					name: 'All plans',
					monthly: shot.plans.reduce((sum, entry) => sum + entry.monthly, 0),
					annual: shot.plans.reduce((sum, entry) => sum + entry.annual, 0),
				});
			}
			function shareOf(row, field) {
				return row.monthly + row.annual ? (row[field] / (row.monthly + row.annual)) * 100 : 0;
			}
			const annualColor = colors.series[0];
			const monthlyColor = colors.series[2];
			const shared = { borderSkipped: false, barPercentage: 0.62, maxBarThickness: 30 };

			return {
				type: 'bar',
				data: {
					labels: rows.map((row) => row.name),
					datasets: [
						{
							...shared,
							label: 'Annual',
							field: 'annual',
							data: rows.map((row) => shareOf(row, 'annual')),
							backgroundColor: translucent(annualColor, 0.9),
							hoverBackgroundColor: annualColor,
							borderColor: colors.surface,
							borderWidth: { right: 2 },
							borderRadius: { topLeft: 6, bottomLeft: 6 },
						},
						{
							...shared,
							label: 'Monthly',
							field: 'monthly',
							data: rows.map((row) => shareOf(row, 'monthly')),
							backgroundColor: translucent(monthlyColor, 0.55),
							hoverBackgroundColor: translucent(monthlyColor, 0.8),
							borderRadius: { topRight: 6, bottomRight: 6 },
						},
					],
				},
				options: chartDefaults(colors, animate, {
					indexAxis: 'y',
					interaction: { mode: 'index', axis: 'y', intersect: false },
					layout: { padding: { top: 4, right: 10 } },
					plugins: {
						tooltip: {
							callbacks: {
								label: (item) =>
									` ${item.dataset.label}: ${item.parsed.x.toFixed(0)}%, ${shortMoney(rows[item.dataIndex][item.dataset.field])} MRR`,
							},
						},
					},
					scales: {
						x: {
							stacked: true,
							min: 0,
							max: 100,
							grid: { display: true, color: colors.grid },
							ticks: { stepSize: 25, callback: (value) => `${value}%` },
						},
						y: {
							stacked: true,
							grid: { display: false },
							ticks: { color: colors.text, font: { family: TYPEFACE, size: 12, weight: '600' } },
						},
					},
				}),
				plugins: [
					{
						id: 'rvAnnualShareTags',
						afterDatasetsDraw(chart) {
							const { ctx, chartArea: area } = chart;
							for (const [position, bar] of chart.getDatasetMeta(0).data.entries()) {
								if (bar.x - area.left < 54) continue;
								drawTag(
									ctx,
									colors,
									area.left + 6,
									bar.y + 10.5,
									`${Math.round(shareOf(rows[position], 'annual'))}%`,
									{ left: area.left, right: area.right },
									{ align: 'left' },
								);
							}
						},
					},
				],
			};
		},

		/* Revenue per account across on a log scale, revenue lost a month up
       the side (lower is better, so that axis runs downwards), bubble area
       for MRR, after the quadrant bubbles on charts-scatter. */
		quadrant(colors, animate) {
			const shot = report;
			const groups = shot.groups;
			const largest = Math.max(...groups.map((group) => group.mrr));
			const across = groups.map((group) => group.arpa).sort((a, b) => a - b);
			const down = groups.map((group) => group.loss * 100).sort((a, b) => a - b);
			const middleX = median(across);
			const middleY = median(down);
			const logLow = Math.log10(across[0] || 100);
			const logHigh = Math.log10(across[across.length - 1] || 10000);
			const logPad = Math.max(0.2, (logHigh - logLow) * 0.12);
			/* Leave room at the edges so the biggest bubbles are never clipped. */
			const highest = down[down.length - 1] || 3;
			const lowest = down[0] || 0;
			const reach = Math.max(0.5, highest - lowest);
			const roundTicks = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];

			const datasets = SAMPLE.plans
				.filter((plan) => groups.some((group) => group.plan === plan.id))
				.map((plan) => {
					const hue = planHue(colors, plan.id);
					return {
						label: plan.name,
						data: groups
							.filter((group) => group.plan === plan.id)
							.map((group) => ({
								x: group.arpa,
								y: group.loss * 100,
								r: 6 + 20 * Math.sqrt(group.mrr / largest),
								group,
							})),
						backgroundColor: translucent(hue, 0.55),
						hoverBackgroundColor: translucent(hue, 0.8),
						borderColor: hue,
						borderWidth: 1.5,
					};
				});

			return {
				type: 'bubble',
				data: { datasets },
				options: chartDefaults(colors, animate, {
					interaction: { mode: 'nearest', intersect: true },
					layout: { padding: { top: 30, right: 14 } },
					plugins: {
						tooltip: {
							callbacks: {
								title: ([first]) =>
									`${PLAN_BY_ID[first.raw.group.plan].name}, ${REGION_BY_ID[first.raw.group.region].name}`,
								label: ({ raw: { group } }) => [
									` ${fullMoney(group.arpa)} per account`,
									` ${(group.loss * 100).toFixed(2)}% of MRR lost a month`,
									` ${shortMoney(group.mrr)} MRR from ${whole(group.accounts)} accounts`,
								],
							},
						},
					},
					scales: {
						x: {
							type: 'logarithmic',
							min: Math.pow(10, logLow - logPad),
							max: Math.pow(10, logHigh + logPad),
							grid: { display: true, color: colors.grid },
							title: {
								display: true,
								text: 'Revenue per account (log scale)',
								color: colors.quiet,
								font: TICK_FONT,
							},
							ticks: tickStyle(colors, {
								maxRotation: 0,
								autoSkip: true,
								callback: (value) => {
									if (!roundTicks.includes(Math.round(value))) return '';
									return value >= 1000 ? `$${value / 1000}k` : `$${value}`;
								},
							}),
						},
						y: {
							reverse: true,
							...roundAxis(
								Math.max(0, lowest - reach * 0.3),
								highest + reach * 0.22,
								(value) => `${Number(value).toFixed(1)}%`,
							),
							title: { display: true, text: 'MRR lost a month', color: colors.quiet, font: TICK_FONT },
						},
					},
				}),
				plugins: [
					{
						id: 'rvQuadrantGuides',
						beforeDatasetsDraw(chart) {
							const {
								ctx,
								chartArea: area,
								scales: { x, y },
							} = chart;
							const splitX = x.getPixelForValue(middleX);
							const splitY = y.getPixelForValue(middleY);
							ctx.save();
							ctx.fillStyle = translucent(colors.series[0], 0.06);
							ctx.fillRect(splitX, area.top, area.right - splitX, splitY - area.top);
							ctx.strokeStyle = colors.border;
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
						afterDraw(chart) {
							const { ctx, chartArea: area } = chart;
							const bounds = { left: area.left, right: area.right };
							const [bigSteady, smallSteady, smallLeaky, bigLeaky] =
								area.right - area.left > 380
									? ['Large and steady', 'Small and steady', 'Small and leaky', 'Large but leaky']
									: ['Large, steady', 'Small, steady', 'Small, leaky', 'Large, leaky'];
							/* The two steady corners are named above the plot, clear of the bubbles. */
							drawTag(ctx, colors, area.right, area.top - 5, bigSteady, bounds, { align: 'right' });
							drawTag(ctx, colors, area.left, area.top - 5, smallSteady, bounds, { align: 'left' });
							drawTag(ctx, colors, area.left + 6, area.bottom - 6, smallLeaky, bounds, { align: 'left' });
							drawTag(ctx, colors, area.right - 6, area.bottom - 6, bigLeaky, bounds, { align: 'right' });
						},
					},
				],
			};
		},

		/* Invoiced as a wide pale bar in the collected color with collected
       solid inside it, over a lower panel of failed card charges in a soft
       rose and what retries won back in a solid bar of its own color. */
		collections(colors, animate) {
			const shot = report;
			const cashColor = colors.series[0];
			const wonColor = colors.series[2];
			function perMonth(field, sign = 1) {
				return shot.shown.map((at) => sign * shot.monthly[field][at]);
			}
			const invoiced = perMonth('billed');
			const failed = perMonth('failed', -1);
			const ceiling = Math.max(...invoiced) * 1.08;
			const floor = Math.min(...failed) * 1.15 || -1;
			const failedAxis = roundAxis(0, -floor).max;
			const cashAxis = roundAxis(0, ceiling);

			return {
				type: 'bar',
				data: {
					labels: monthTicks(shot.shown),
					datasets: [
						barSeries(colors.text, {
							label: 'Invoiced',
							data: invoiced,
							yAxisID: 'cash',
							grouped: false,
							order: 3,
							backgroundColor: translucent(cashColor, 0.16),
							hoverBackgroundColor: translucent(cashColor, 0.24),
							borderWidth: 0,
							borderRadius: 6,
							barPercentage: 0.78,
							maxBarThickness: 48,
						}),
						barSeries(cashColor, {
							label: 'Collected',
							data: perMonth('collected'),
							yAxisID: 'cash',
							grouped: false,
							borderRadius: 4,
							barPercentage: 0.4,
							maxBarThickness: 22,
						}),
						barSeries(colors.danger, {
							label: 'Failed',
							data: failed,
							yAxisID: 'gap',
							grouped: false,
							order: 3,
							backgroundColor: translucent(colors.danger, 0.2),
							hoverBackgroundColor: translucent(colors.danger, 0.3),
							borderWidth: 0,
							borderRadius: 4,
							barPercentage: 0.62,
							maxBarThickness: 32,
						}),
						barSeries(wonColor, {
							label: 'Won back',
							data: perMonth('recovered', -1),
							yAxisID: 'gap',
							grouped: false,
							backgroundColor: wonColor,
							borderRadius: 3,
							barPercentage: 0.34,
							maxBarThickness: 18,
						}),
					],
				},
				options: chartDefaults(colors, animate, {
					layout: { padding: { top: 26 } },
					plugins: {
						tooltip: {
							callbacks: {
								title: ([first]) => HISTORY.months[shot.shown[first.dataIndex]].label,
								label: (item) => ` ${item.dataset.label}: ${fullMoney(Math.abs(item.parsed.y))}`,
								footer: ([first]) =>
									`${percent(shot.monthly.rate[shot.shown[first.dataIndex]], 2)} of invoices collected`,
							},
						},
					},
					scales: {
						y: { display: false },
						gap: {
							type: 'linear',
							position: 'left',
							stack: 'panel',
							stackWeight: 1.3,
							offset: true,
							min: -failedAxis,
							max: 0,
							grid: { color: (context) => (context.tick?.value === 0 ? colors.rest : colors.grid) },
							border: { display: false },
							ticks: tickStyle(colors, {
								stepSize: failedAxis,
								callback: (value) => shortMoney(Math.abs(value)),
							}),
						},
						space: {
							type: 'linear',
							position: 'left',
							stack: 'panel',
							stackWeight: 0.55,
							offset: true,
							grid: { display: false },
							border: { display: false },
							ticks: { display: false },
						},
						cash: {
							type: 'linear',
							position: 'left',
							stack: 'panel',
							stackWeight: 3,
							min: 0,
							max: cashAxis.max,
							grid: { color: colors.grid },
							border: { display: false },
							ticks: tickStyle(colors, {
								stepSize: cashAxis.ticks.stepSize * 2,
								callback: (value) => shortMoney(value),
							}),
						},
					},
				}),
				plugins: [
					{
						id: 'rvPanelTitles',
						afterDatasetsDraw(chart) {
							const {
								ctx,
								scales: { cash, gap },
							} = chart;
							drawCaption(ctx, colors.quiet, 'Invoiced and collected', cash.left, cash.top - 10, 'left');
							drawCaption(ctx, colors.quiet, 'Failed card payments', gap.left, gap.top - 6, 'left');
						},
					},
				],
			};
		},
	};

	/** The middle value of a sorted list, or 0 for an empty one. */
	function median(sorted) {
		if (!sorted.length) return 0;
		const half = sorted.length / 2;
		return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[half - 1] + sorted[half]) / 2;
	}

	/*
	 * Chart lifecycle. A canvas is drawn the first time it comes near the
	 * screen; after that it is redrawn on every new answer and theme change.
	 * Canvases that left the page (the plan multiples are replaced on each
	 * answer) are destroyed and forgotten.
	 */
	function drawChart(canvas, animate) {
		if (!report) return;
		const recipe = CHART_RECIPES[canvas.getAttribute('data-rv-chart')];
		if (!recipe) return;
		liveCharts.get(canvas)?.destroy();
		const colors = chartColors();
		const config = recipe(colors, animate && !calmMotion, canvas);
		if (!config) return;
		config.plugins = [...(config.plugins || []), lineHalo(colors)];
		liveCharts.set(canvas, new Chart(canvas, config));
	}

	function onSighting(entries) {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			sightings.unobserve(entry.target);
			drawnOnce.add(entry.target);
			drawChart(entry.target, true);
		}
	}

	function watchCanvas(canvas) {
		if (sightings) {
			sightings.observe(canvas);
			return;
		}
		drawnOnce.add(canvas);
		drawChart(canvas, false);
	}

	function forgetCanvas(canvas) {
		liveCharts.get(canvas)?.destroy();
		liveCharts.delete(canvas);
		drawnOnce.delete(canvas);
	}

	function rebuildCharts(animate) {
		for (const canvas of liveCharts.keys()) {
			if (!canvas.isConnected) forgetCanvas(canvas);
		}
		for (const canvas of drawnOnce) drawChart(canvas, animate);
	}

	/*
	 * Rendering: the hero figures, the four headline cards, the figures and
	 * keys around each chart, the failed payment outcomes, the plan
	 * multiples and the "Show the numbers" tables.
	 */
	function paintBoard() {
		paintHero();
		paintHeadlines();
		paintForecastCard();
		paintMovementCard();
		paintBillingKey();
		paintLifetimeCard();
		paintCollectionsKey();
		paintOutcome();
		paintMultiples();
		paintNumberTables();
		nameCanvases();
	}

	function paintHero() {
		pick('[data-rv-fig="arr"]').textContent = shortMoney(report.now.arr);
		pick('[data-rv-fig="nrr"]').textContent = percent(report.now.nrr);
		pick('[data-rv-fig="accounts"]').textContent = whole(report.now.accounts);
	}

	function changeBetween(current, earlier) {
		if (earlier == null || !isFinite(earlier) || earlier === 0) return null;
		return (current - earlier) / Math.abs(earlier);
	}

	/** The shared up, down or level chip; `unit` 'pts' shows percentage points. */
	function trendChip(change, unit) {
		if (change == null) return '<span class="basalt-trend basalt-trend-flat">No comparison</span>';
		const direction = Math.abs(change) < 0.0005 ? 'flat' : change > 0 ? 'up' : 'down';
		const look = {
			up: { icon: 'bi-arrow-up-right', word: 'Up' },
			down: { icon: 'bi-arrow-down-right', word: 'Down' },
			flat: { icon: 'bi-arrow-right', word: 'Level' },
		}[direction];
		const size = Math.abs(change * 100);
		const amount = unit === 'pts' ? `${size.toFixed(2)} pts` : `${size.toFixed(1)}%`;
		return `<span class="basalt-trend basalt-trend-${direction}"><i aria-hidden="true" class="bi ${look.icon}"></i><span class="visually-hidden">${look.word}</span>${amount}</span>`;
	}

	/** Draws a headline card's line with the template's trendline: pointing
	 * along it shows that month in the card, and leaving puts the period back. */
	function traceSpark(card, values, months, format) {
		const holder = pick('.basalt-trend-card-spark', card);
		if (!holder || values.length < 2 || !window.Basalt.trendline) return;
		const valueText = pick('[data-rv-kpi-value]', card);
		const delta = pick('[data-rv-kpi-delta]', card);
		const resting = [valueText.textContent, delta.innerHTML];
		holder.removeAttribute('aria-hidden');
		window.Basalt.trendline(holder, values, {
			labels: months,
			format,
			name: pick('.basalt-trend-card-label', card).textContent,
			onRead: (at, value, label) => {
				if (at === null) {
					[valueText.textContent, delta.innerHTML] = resting;
					return;
				}
				valueText.textContent = format(value);
				delta.innerHTML = `<span class="basalt-trend-card-vs">${htmlSafe(label)}</span><span class="rv-kpi-sub">&nbsp;</span>`;
			},
		});
	}

	function paintHeadlines() {
		const { now, before, against, shown, monthly } = report;
		const versus = before ? `vs ${against.name}` : htmlSafe(against.why);
		const headlines = [
			{
				id: 'mrr',
				format: shortMoney,
				value: shortMoney(now.mrr),
				change: before && changeBetween(now.mrr, before.mrr),
				unit: '',
				line: monthly.mrr,
				note: before ? `was ${shortMoney(before.mrr)}` : '',
			},
			{
				id: 'net',
				format: (value) => shortMoney(value, true),
				value: shortMoney(now.net, true),
				change: before && changeBetween(now.net, before.net),
				unit: '',
				line: monthly.net,
				note: before ? `was ${shortMoney(before.net, true)}` : '',
			},
			{
				id: 'arpa',
				format: fullMoney,
				value: fullMoney(now.arpa),
				change: before && changeBetween(now.arpa, before.arpa),
				unit: '',
				line: monthly.arpa,
				note: before ? `was ${fullMoney(before.arpa)}` : '',
			},
			{
				id: 'collected',
				format: (value) => percent(value, 2),
				value: percent(now.rate, 2),
				change: before && now.rate - before.rate,
				unit: 'pts',
				line: monthly.rate,
				note: `${shortMoney(now.collected)} of ${shortMoney(now.billed)}`,
			},
		];
		for (const card of headlines) {
			const node = pick(`[data-rv-kpi="${card.id}"]`);
			const chip = before ? trendChip(card.change, card.unit) : '';
			const note = card.note ? `<span class="rv-kpi-sub">${card.note}</span>` : '';
			pick('[data-rv-kpi-value]', node).textContent = card.value;
			pick('[data-rv-kpi-delta]', node).innerHTML =
				`${chip} <span class="basalt-trend-card-vs">${versus}</span>${note}`;
			traceSpark(
				node,
				shown.map((at) => card.line[at]),
				shown.map((at) => HISTORY.months[at].label),
				card.format,
			);
		}
	}

	/* Chart keys are HTML lists. Each swatch takes its color from a class
     that points at a token, so it follows the palette without a redraw. */
	function keyList(entries) {
		return entries
			.map(
				({ color, shape, label }) =>
					`<li class="${color}"><span class="rv-key-${shape}"></span>${htmlSafe(label)}</li>`,
			)
			.join('');
	}

	function seriesClass(slot) {
		return `rv-c${slot}`;
	}

	function statPair(term, value, valueClass) {
		return `<div><dt>${term}</dt><dd${valueClass ? ` class="${valueClass}"` : ''}>${value}</dd></div>`;
	}

	function paintForecastCard() {
		const { now, before, against, range, hasOutlook, outlook, outlookMonths, trend, shownBefore } = report;
		const end = outlook[outlook.length - 1];
		const parts = [statPair(`MRR at ${HISTORY.months[range[1]].label}`, shortMoney(now.mrr))];
		if (hasOutlook) {
			parts.push(
				statPair(`Forecast for ${outlookMonths[outlookMonths.length - 1].label}`, shortMoney(end.mid)),
				statPair('Likely range', `${shortMoney(end.low)} to ${shortMoney(end.high)}`),
				statPair('Recent growth', `${signedPercent(trend, 2)} a month`),
			);
		} else {
			parts.push(
				statPair('Forecast', `Shown when the range ends in ${HISTORY.months[LATEST].label}`, 'rv-stats-note'),
			);
		}
		if (before)
			parts.push(statPair(`Against the ${against.name}`, signedPercent(changeBetween(now.mrr, before.mrr))));
		pick('[data-rv-stats="forecast"]').innerHTML = parts.join('');

		const key = [{ shape: 'bar', color: seriesClass(1), label: 'MRR' }];
		if (shownBefore.length) key.push({ shape: 'line rv-key-line-dotted', color: 'rv-cr', label: comparisonName() });
		if (hasOutlook) {
			key.push(
				{ shape: 'line rv-key-line-dashed', color: seriesClass(8), label: 'Forecast' },
				{ shape: 'band', color: seriesClass(8), label: 'Likely range' },
			);
		}
		pick('[data-rv-key="forecast"]').innerHTML = keyList(key);
	}

	function flowStep(label, value, modifier, note) {
		return `<li class="rv-flow-item ${modifier || ''}"><span class="rv-flow-label">${label}</span><span class="rv-flow-value">${value}</span>${note ? `<span class="rv-flow-sub">${note}</span>` : ''}</li>`;
	}

	function paintMovementCard() {
		const { now, range } = report;
		function ofOpening(id) {
			return now.open ? `${percent(now.moves[id] / now.open)} of opening` : '';
		}
		const flowSteps = SAMPLE.movements.map((move) =>
			flowStep(
				move.name,
				shortMoney(now.moves[move.id] * move.sign, true),
				`rv-flow-item-${move.sign > 0 ? 'gain' : 'loss'}`,
				ofOpening(move.id),
			),
		);
		pick('[data-rv-flow]').innerHTML = [
			flowStep('Opening MRR', shortMoney(now.open), 'rv-flow-item-total', HISTORY.months[range[0]].label),
			...flowSteps,
			flowStep(
				'Closing MRR',
				shortMoney(now.mrr),
				'rv-flow-item-total',
				`${signedPercent(now.open ? now.net / now.open : 0)} net`,
			),
		].join('');

		const key = SAMPLE.movements.map((move) => ({
			shape: 'bar',
			color: move.tone ? `rv-c-${move.tone}` : seriesClass(move.slot),
			label: move.name,
		}));
		key.push({ shape: 'line', color: 'rv-ct', label: 'Net new MRR' });
		pick('[data-rv-key="movement"]').innerHTML = keyList(key);
	}

	function billingTotals(plans) {
		return plans.reduce(
			(sum, entry) => ({ annual: sum.annual + entry.annual, monthly: sum.monthly + entry.monthly }),
			{ annual: 0, monthly: 0 },
		);
	}

	function paintBillingKey() {
		const sums = billingTotals(report.plans);
		pick('[data-rv-key="interval"]').innerHTML = keyList([
			{ shape: 'bar', color: seriesClass(1), label: `Annual ${shortMoney(sums.annual)}` },
			{ shape: 'bar rv-key-bar-soft', color: seriesClass(3), label: `Monthly ${shortMoney(sums.monthly)}` },
		]);
	}

	function paintLifetimeCard() {
		const plans = report.plans;
		pick('[data-rv-stats="ltv"]').innerHTML = plans
			.map(({ plan, ltv, arpa, loss, capped }) => {
				const detail = `${fullMoney(arpa)} a month, ${(loss * 100).toFixed(2)}% lost${capped ? ', capped at 5 years' : ''}`;
				return `<div class="${seriesClass(plan.slot)}"><dt>${htmlSafe(plan.name)} lifetime value</dt><dd>${shortMoney(ltv)}</dd><dd class="rv-stats-sub">${detail}</dd></div>`;
			})
			.join('');
		pick('[data-rv-key="quadrant"]').innerHTML = keyList(
			plans.map(({ plan }) => ({ shape: 'dot', color: seriesClass(plan.slot), label: plan.name })),
		);
	}

	function paintCollectionsKey() {
		pick('[data-rv-key="collections"]').innerHTML = keyList([
			{ shape: 'bar rv-key-bar-pale', color: seriesClass(1), label: 'Invoiced' },
			{ shape: 'bar', color: seriesClass(1), label: 'Collected' },
			{ shape: 'bar rv-key-bar-pale', color: 'rv-c-danger', label: 'Failed' },
			{ shape: 'bar', color: seriesClass(3), label: 'Won back' },
		]);
	}

	/* Where the failed card payments in the range ended up: a split bar,
     then one button per outcome that opens it in the ledger. */
	function paintOutcome() {
		const box = pick('[data-rv-outcome]');
		const charges = report.paymentRows;
		const failedTotal = report.now.failed;
		if (!failedTotal) {
			box.innerHTML = '<p class="rv-outcome-none">No card payments failed in this range.</p>';
			return;
		}

		const outcomes = SAMPLE.payments.statuses;
		const tally = Object.fromEntries(outcomes.map((status) => [status.id, { amount: 0, n: 0 }]));
		for (const charge of charges) {
			tally[charge.status].amount += charge.amount;
			tally[charge.status].n += 1;
		}

		const slices = outcomes
			.map(
				(status) =>
					`<span data-rv-grow="${tally[status.id].amount}" class="rv-outcome-seg rv-tone-${status.tone}"></span>`,
			)
			.join('');
		const choices = outcomes
			.map((status) => {
				const { amount, n } = tally[status.id];
				return (
					`<li class="rv-tone-${status.tone}"><button data-rv-status="${status.id}" type="button" class="rv-outcome-pick">` +
					`<span aria-hidden="true" class="rv-outcome-dot"></span><span class="rv-outcome-name">${htmlSafe(status.name)}</span>` +
					`<span class="rv-outcome-amt">${shortMoney(amount)}</span><span class="rv-outcome-n">${whole(n)} ${n === 1 ? 'payment' : 'payments'}</span></button></li>`
				);
			})
			.join('');
		const spoken = outcomes.map((status) => `${status.name} ${shortMoney(tally[status.id].amount)}`).join(', ');

		box.innerHTML =
			`<p class="rv-outcome-title"><strong>${whole(charges.length)}</strong> card payments failed, worth <strong>${shortMoney(failedTotal)}</strong>. ${percent(report.now.recovered / failedTotal, 0)} has been won back so far.</p>` +
			`<div role="img" aria-label="${htmlSafe(spoken)}" class="rv-outcome-bar">${slices}</div><ul class="rv-outcome-list">${choices}</ul>`;

		/* Segment widths go in through the DOM rather than a style attribute. */
		for (const segment of pickAll('[data-rv-grow]', box))
			segment.style.flexGrow = segment.getAttribute('data-rv-grow');
	}

	/* One small figure per plan. The previous ones are torn down first so
     their charts and observers do not linger. */
	function paintMultiples() {
		const box = pick('[data-rv-multiples]');
		const { plans, range, now, shownBefore, against } = report;
		const companyMrr = now.mrr || 1;
		const [startLabel, endLabel] = range.map((at) => HISTORY.months[at].label);

		for (const canvas of pickAll('canvas', box)) {
			forgetCanvas(canvas);
			sightings?.unobserve(canvas);
		}

		box.innerHTML = plans
			.map(({ plan, mrr, accounts }) => {
				const closing = mrr[range[1]];
				const earlier = shownBefore.length ? mrr[against.range[1]] : null;
				const spoken = `${htmlSafe(plan.name)} MRR from ${shortMoney(mrr[range[0]])} in ${startLabel} to ${shortMoney(closing)} in ${endLabel}`;
				return (
					`<figure class="rv-multiple ${seriesClass(plan.slot)}">` +
					`<figcaption class="rv-multiple-head"><span class="rv-multiple-name">${htmlSafe(plan.name)}</span><span class="rv-multiple-share">${percent(closing / companyMrr, 0)} of MRR</span></figcaption>` +
					`<p class="rv-multiple-value">${shortMoney(closing)} ${earlier != null ? trendChip(changeBetween(closing, earlier)) : ''}</p>` +
					`<p class="rv-multiple-meta">${whole(accounts)} accounts · add-ons ${shortMoney(closing * plan.addOns)}</p>` +
					`<div class="rv-chart rv-chart-mini"><canvas data-rv-chart="plan" data-rv-plan="${plan.id}" role="img" aria-label="${spoken}"></canvas><div aria-hidden="true" class="rv-chart-ghost basalt-skeleton basalt-skeleton-block"></div></div>` +
					'</figure>'
				);
			})
			.join('');
		for (const canvas of pickAll('canvas', box)) watchCanvas(canvas);
	}

	/** A compact table: the first column labels the row, the rest are right-aligned figures. */
	function numberTable(headings, rows) {
		const head = headings
			.map((heading, column) => `<th scope="col"${column ? ' class="text-end"' : ''}>${heading}</th>`)
			.join('');
		const body = rows
			.map(
				([label, ...figures]) =>
					`<tr><th scope="row">${label}</th>${figures.map((figure) => `<td class="text-end">${figure}</td>`).join('')}</tr>`,
			)
			.join('');
		return `<table class="table table-sm rv-table rv-table-data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
	}

	function paintNumberTables() {
		const { shown, shownBefore, monthly, hasOutlook, outlook, outlookMonths, plans, groups, now, range } = report;
		const compared = Boolean(shownBefore.length);
		function monthName(at) {
			return HISTORY.months[at].label;
		}

		const forecastRows = shown.map((at, position) => [
			monthName(at),
			fullMoney(monthly.mrr[at]),
			...(compared ? [fullMoney(monthly.mrr[shownBefore[position]])] : []),
		]);
		if (hasOutlook) {
			for (const [position, point] of outlook.entries()) {
				forecastRows.push([
					`${outlookMonths[position].label} (forecast)`,
					`${fullMoney(point.mid)} (${shortMoney(point.low)} to ${shortMoney(point.high)})`,
					...(compared ? [''] : []),
				]);
			}
		}

		const markupByCard = {
			forecast: numberTable(['Month', 'MRR', ...(compared ? [comparisonName()] : [])], forecastRows),
			movement: numberTable(
				['Month', ...SAMPLE.movements.map((move) => move.name), 'Net'],
				shown.map((at) => [
					monthName(at),
					...SAMPLE.movements.map((move) => fullMoney(monthly[move.id][at] * move.sign, true)),
					fullMoney(monthly.net[at], true),
				]),
			),
			plans: numberTable(
				['Plan', 'MRR', 'Share', 'Accounts', 'Per account'],
				plans.map((entry) => [
					entry.plan.name,
					fullMoney(entry.mrr[range[1]]),
					percent(entry.mrr[range[1]] / (now.mrr || 1)),
					whole(entry.accounts),
					fullMoney(entry.arpa),
				]),
			),
			interval: numberTable(
				['Plan', 'Annual', 'Monthly', 'Annual share'],
				plans.map((entry) => [
					entry.plan.name,
					fullMoney(entry.annual),
					fullMoney(entry.monthly),
					percent(entry.annual / (entry.annual + entry.monthly || 1), 0),
				]),
			),
			quadrant: numberTable(
				['Plan and region', 'Per account', 'Lost a month', 'MRR', 'Accounts'],
				groups.map((group) => [
					`${PLAN_BY_ID[group.plan].name}, ${REGION_BY_ID[group.region].name}`,
					fullMoney(group.arpa),
					`${(group.loss * 100).toFixed(2)}%`,
					fullMoney(group.mrr),
					whole(group.accounts),
				]),
			),
			collections: numberTable(
				['Month', 'Invoiced', 'Collected', 'Failed', 'Won back', 'Rate'],
				shown.map((at) => [
					monthName(at),
					fullMoney(monthly.billed[at]),
					fullMoney(monthly.collected[at]),
					fullMoney(monthly.failed[at]),
					fullMoney(monthly.recovered[at]),
					percent(monthly.rate[at], 2),
				]),
			),
		};
		for (const [name, markup] of Object.entries(markupByCard)) pick(`[data-rv-data="${name}"]`).innerHTML = markup;
	}

	/* Each canvas gets an accessible name that says what its chart shows. */
	function nameCanvases() {
		const { range, monthly, now, hasOutlook, outlook, outlookMonths, plans, groups } = report;
		const [first, last] = range.map((at) => HISTORY.months[at].label);
		const end = outlook[outlook.length - 1];
		const sums = billingTotals(plans);
		function annualShare(entry) {
			return percent(entry.annual / (entry.annual + entry.monthly || 1), 0);
		}
		const arpas = groups.map((group) => group.arpa);
		const losses = groups.map((group) => group.loss);

		const names = {
			forecast: `MRR from ${shortMoney(monthly.mrr[range[0]])} in ${first} to ${shortMoney(now.mrr)} in ${last}${
				hasOutlook
					? `, forecast to reach ${shortMoney(end.mid)} by ${outlookMonths[outlookMonths.length - 1].label}, likely between ${shortMoney(end.low)} and ${shortMoney(end.high)}`
					: ''
			}`,
			movement: `From ${first} to ${last}: ${SAMPLE.movements.map((move) => `${move.name.toLowerCase()} ${shortMoney(now.moves[move.id] * move.sign, true)}`).join(', ')}, net ${shortMoney(now.net, true)}`,
			interval: `${annualShare(sums)} of MRR is billed annually. ${plans.map((entry) => `${entry.plan.name} ${annualShare(entry)}`).join(', ')}`,
			quadrant: `${groups.length} plan and region groups. Revenue per account runs from ${shortMoney(Math.min(...arpas))} to ${shortMoney(Math.max(...arpas))}, monthly revenue lost from ${(Math.min(...losses) * 100).toFixed(1)}% to ${(Math.max(...losses) * 100).toFixed(1)}%`,
			collections: `${shortMoney(now.billed)} invoiced and ${shortMoney(now.collected)} collected from ${first} to ${last}, ${percent(now.rate, 2)}. ${shortMoney(now.failed)} of card payments failed and ${shortMoney(now.recovered)} was won back.`,
		};
		for (const [kind, text] of Object.entries(names)) {
			pick(`canvas[data-rv-chart="${kind}"]`)?.setAttribute('aria-label', text);
		}
	}

	/*
	 * The ledger: two tables that sort, search, filter by type and month,
	 * and page. Each is described by a config below and run by
	 * createLedger(); the configs only say what differs between them.
	 */
	const MOVEMENT_TABLE = {
		kind: 'moves',
		noun: 'rows',
		totalLabel: 'net',
		signed: true,
		emptyTitle: 'No movements match',
		sort: { key: 'month', dir: 'desc' },
		newestFirst: ['month', 'accounts', 'amount'],
		types: SAMPLE.movements,
		typeOf: (row) => row.type,
		searchText: (row) =>
			[
				HISTORY.months[row.month].label,
				PLAN_BY_ID[row.plan].name,
				REGION_BY_ID[row.region].name,
				CHANNEL_BY_ID[row.segment].name,
				MOVE_BY_ID[row.type].name,
			]
				.join(' ')
				.toLowerCase(),
		sortBy: {
			plan: (row) => PLAN_BY_ID[row.plan].name,
			region: (row) => REGION_BY_ID[row.region].name,
			segment: (row) => CHANNEL_BY_ID[row.segment].name,
			type: (row) => MOVE_BY_ID[row.type].name,
		},
		row(entry, position) {
			const move = MOVE_BY_ID[entry.type];
			const tone = move.sign > 0 ? 'success' : move.tone;
			return (
				`<tr><td><button data-rv-open="${position}" type="button" class="rv-link">${HISTORY.months[entry.month].label}</button></td>` +
				`<td>${htmlSafe(PLAN_BY_ID[entry.plan].name)}</td><td>${htmlSafe(REGION_SHORT[entry.region])}</td><td>${htmlSafe(CHANNEL_BY_ID[entry.segment].name)}</td>` +
				`<td><span class="basalt-status basalt-status-${tone}">${htmlSafe(move.name)}</span></td>` +
				`<td class="text-end rv-num">${whole(entry.accounts)}</td><td class="text-end rv-num rv-strong">${fullMoney(entry.amount, true)}</td></tr>`
			);
		},
	};

	const PAYMENT_TABLE = {
		kind: 'failed',
		noun: 'payments',
		totalLabel: 'worth',
		signed: false,
		emptyTitle: 'No failed payments match',
		sort: { key: 'date', dir: 'desc' },
		newestFirst: ['date', 'attempts', 'amount'],
		types: SAMPLE.payments.statuses,
		typeOf: (row) => row.status,
		searchText: (row) =>
			[
				row.id,
				row.account,
				PLAN_BY_ID[row.plan].name,
				REGION_BY_ID[row.region].name,
				STATUS_BY_ID[row.status].name,
				HISTORY.months[row.month].label,
			]
				.join(' ')
				.toLowerCase(),
		sortBy: {
			date: (row) => row.month * 100 + row.day,
			plan: (row) => PLAN_BY_ID[row.plan].name,
			status: (row) => STATUS_BY_ID[row.status].name,
		},
		row(entry, position) {
			const status = STATUS_BY_ID[entry.status];
			const yearly = entry.yearly ? ' <span class="rv-quiet">yearly</span>' : '';
			return (
				`<tr><td><button data-rv-open="${position}" type="button" class="rv-link rv-mono">${entry.id}</button></td>` +
				`<td><a href="${ACCOUNT_PAGE}" class="rv-strong rv-account">${htmlSafe(entry.account)}</a></td>` +
				`<td>${htmlSafe(PLAN_BY_ID[entry.plan].name)}${yearly}</td><td>${chargeDate(entry)}</td><td class="text-end rv-num">${entry.attempts}</td>` +
				`<td><span class="basalt-status basalt-status-${status.tone}">${htmlSafe(status.name)}</span></td>` +
				`<td class="text-end rv-num rv-strong">${fullMoney(entry.amount)}</td></tr>`
			);
		},
	};

	const ROWS_PER_PAGE = 10;

	/**
	 * Runs one ledger table inside its tab pane. Returns the handle the rest
	 * of the page uses: fill() with new rows, narrow() to preset filters,
	 * clear() them, and visible() for the rows that pass.
	 */
	function createLedger(pane, config) {
		const parts = {
			body: pick('[data-rv-body]', pane),
			search: pick('[data-rv-search]', pane),
			type: pick('[data-rv-type]', pane),
			month: pick('[data-rv-month]', pane),
			summary: pick('[data-rv-summary]', pane),
			pager: pick('[data-rv-pager]', pane),
		};
		const filters = { text: '', type: '', month: '' };
		let sorting = { ...config.sort };
		let everything = [];
		let passing = [];
		let pagination = null;
		let typingTimer = 0;

		for (const type of config.types) {
			parts.type.insertAdjacentHTML('beforeend', `<option value="${type.id}">${htmlSafe(type.name)}</option>`);
		}

		parts.search.addEventListener('input', () => {
			clearTimeout(typingTimer);
			typingTimer = setTimeout(() => {
				filters.text = parts.search.value;
				update();
			}, 120);
		});
		parts.type.addEventListener('change', () => {
			filters.type = parts.type.value;
			update();
		});
		parts.month.addEventListener('change', () => {
			filters.month = parts.month.value;
			update();
		});
		for (const button of pickAll('th[data-rv-sort] .rv-sort', pane)) {
			button.addEventListener('click', () => {
				const key = button.closest('th').getAttribute('data-rv-sort');
				if (sorting.key === key) sorting = { key, dir: sorting.dir === 'asc' ? 'desc' : 'asc' };
				else sorting = { key, dir: config.newestFirst.includes(key) ? 'desc' : 'asc' };
				update(true);
			});
		}
		parts.body.addEventListener('click', (event) => {
			const opener = event.target.closest('[data-rv-open]');
			if (opener) openRecord(config.kind, Number(opener.getAttribute('data-rv-open')));
		});
		pick(`[data-rv-export="${config.kind}"]`).addEventListener('click', () => downloadCsv(config.kind));

		function sortValue(row, key) {
			return config.sortBy[key] ? config.sortBy[key](row) : row[key];
		}

		/** Filters and sorts, refreshes the headers and tab count, then shows a page. */
		function update(stayOnPage) {
			const needle = filters.text.trim().toLowerCase();
			passing = everything.filter(
				(row) =>
					(!filters.type || config.typeOf(row) === filters.type) &&
					(filters.month === '' || String(row.month) === filters.month) &&
					(!needle || config.searchText(row).includes(needle)),
			);
			const direction = sorting.dir === 'asc' ? 1 : -1;
			passing.sort((a, b) => {
				const left = sortValue(a, sorting.key);
				const right = sortValue(b, sorting.key);
				return (left < right ? -1 : left > right ? 1 : 0) * direction || b.month - a.month;
			});

			for (const columnHead of pickAll('th[data-rv-sort]', pane)) {
				const active = columnHead.getAttribute('data-rv-sort') === sorting.key;
				const ascending = sorting.dir === 'asc';
				if (active) columnHead.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');
				else columnHead.removeAttribute('aria-sort');
				const arrow = active ? (ascending ? 'bi-arrow-up' : 'bi-arrow-down') : 'bi-arrow-down-up';
				pick('.rv-sort-icon', columnHead).className = `bi rv-sort-icon ${arrow}`;
			}

			const pageCount = Math.max(1, Math.ceil(passing.length / ROWS_PER_PAGE));
			if (pagination) pagination.setTotal(pageCount);
			else
				pagination = window.Basalt.pagination(parts.pager, {
					total: pageCount,
					label: 'Page',
					onChange: showPage,
				});
			if (!stayOnPage && pagination.get() !== 1) pagination.set(1);
			else showPage();

			const countBadge = pick(`[data-rv-tab-count="${config.kind}"]`);
			if (countBadge) countBadge.textContent = whole(passing.length);
		}

		function showPage() {
			const offset = ((pagination ? pagination.get() : 1) - 1) * ROWS_PER_PAGE;
			const slice = passing.slice(offset, offset + ROWS_PER_PAGE);
			const pagerNav = parts.pager.closest('nav');

			if (!slice.length) {
				parts.body.innerHTML =
					`<tr><td colspan="7" class="rv-table-empty"><div class="basalt-empty basalt-empty-compact"><p class="basalt-empty-title">${htmlSafe(config.emptyTitle)}</p>` +
					'<p class="basalt-empty-text">Try another search, or clear the filters on this table.</p>' +
					'<div class="basalt-empty-actions"><button data-rv-clear-table type="button" class="btn btn-sm btn-outline-secondary">Clear table filters</button></div></div></td></tr>';
				parts.summary.textContent = `0 ${config.noun}`;
				pick('[data-rv-clear-table]', parts.body).addEventListener('click', () => {
					clear();
					parts.search.focus();
				});
				pagerNav.hidden = true;
				return;
			}

			pagerNav.hidden = passing.length <= ROWS_PER_PAGE;
			parts.body.innerHTML = slice.map((row, at) => config.row(row, offset + at)).join('');
			const sum = passing.reduce((total, row) => total + row.amount, 0);
			parts.summary.innerHTML = `<strong>${whole(offset + 1)}–${whole(offset + slice.length)}</strong> of ${whole(passing.length)} ${config.noun} · ${config.totalLabel} <strong>${shortMoney(sum, config.signed)}</strong>`;
		}

		function clear() {
			Object.assign(filters, { text: '', type: '', month: '' });
			parts.search.value = '';
			parts.type.value = '';
			parts.month.value = '';
			update();
		}

		/* New rows from an answer. The month filter lists the months in the
       range, newest first, and keeps its pick if that month is still there. */
		function fill(rows, months) {
			everything = rows;
			const previousMonth = filters.month;
			const options = [...months]
				.reverse()
				.map((at) => `<option value="${at}">${HISTORY.months[at].label}</option>`)
				.join('');
			parts.month.innerHTML = `<option value="">Every month</option>${options}`;
			filters.month = months.includes(Number(previousMonth)) ? previousMonth : '';
			parts.month.value = filters.month;
			window.Basalt.select?.refresh?.(parts.month);
			update();
		}

		function narrow(preset) {
			if ('type' in preset) {
				filters.type = preset.type;
				parts.type.value = preset.type;
			}
			if ('month' in preset) {
				filters.month = preset.month === '' ? '' : String(preset.month);
				parts.month.value = filters.month;
			}
			if ('q' in preset) {
				filters.text = preset.q;
				parts.search.value = preset.q;
			}
			update();
		}

		return { fill, narrow, clear, visible: () => passing };
	}

	/** "Sep 14, 2026" for a failed charge, `daysLater` days on if given. */
	function chargeDate(charge, daysLater = 0) {
		const month = HISTORY.months[charge.month];
		const date = new Date(month.y, month.m, charge.day + daysLater);
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
	}

	function fillLedgers() {
		tables.moves.fill(report.movementRows, report.shown);
		tables.failed.fill(report.paymentRows, report.shown);
	}

	/*
	 * Opens the ledger on a preset filter: from a bar in the movement chart,
	 * an outcome under the collections chart, or the command menu.
	 */
	function drillInto({ kind = 'moves', type, month }) {
		const tab = pick(`[data-rv-tab="${kind}"]`);
		if (tab && window.bootstrap) bootstrap.Tab.getOrCreateInstance(tab).show();
		const ledger = tables[kind];
		ledger.narrow({ type: type || '', month: month ?? '', q: '' });

		const card = pick('#rv-ledger');
		card.scrollIntoView({ behavior: calmMotion ? 'auto' : 'smooth', block: 'start' });
		card.focus({ preventScroll: true });

		const picked = (kind === 'failed' ? STATUS_BY_ID[type] : MOVE_BY_ID[type])?.name;
		const when = month != null ? ` in ${HISTORY.months[month].label}` : '';
		speak(`Ledger showing ${picked ? picked.toLowerCase() : 'every row'}${when}: ${ledger.visible().length} rows`);
	}

	/*
	 * The record drawer shows one ledger row at a time: the accounts behind
	 * a movement, or the retry history of a failed payment. Alt with the
	 * arrow keys, or the drawer's own buttons, step through the rows that
	 * were showing when it opened.
	 */
	function bindDrawer() {
		pick('[data-basalt-record-prev]', drawer).addEventListener('click', () => stepRecord(-1));
		pick('[data-basalt-record-next]', drawer).addEventListener('click', () => stepRecord(1));
		drawer.addEventListener('keydown', (event) => {
			if (!event.altKey) return;
			const step = { ArrowUp: -1, ArrowDown: 1 }[event.key];
			if (!step) return;
			event.preventDefault();
			stepRecord(step);
		});
		pick('[data-rv-r-export]', drawer).addEventListener('click', exportRecord);
	}

	function openRecord(kind, at) {
		Object.assign(opened, { kind, at, list: tables[kind].visible().slice() });
		paintRecord();
		if (window.bootstrap) bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
	}

	function stepRecord(by) {
		const total = opened.list.length;
		if (!total) return;
		opened.at = (opened.at + by + total) % total;
		drawer.classList.toggle('is-back', by < 0);
		paintRecord();
	}

	function fact(term, value) {
		return `<div><dt>${term}</dt><dd>${value}</dd></div>`;
	}

	const DRAWER_HINT =
		'<p class="rv-drawer-hint"><kbd>Alt</kbd> <kbd>↑</kbd> <kbd>↓</kbd> step through the ledger</p>';

	function paintRecord() {
		const entry = opened.list[opened.at];
		if (!entry) return;
		pick('[data-basalt-record-pos]', drawer).textContent = `${opened.at + 1} of ${opened.list.length}`;
		if (opened.kind === 'moves') paintMovementRecord(entry);
		else paintPaymentRecord(entry);
	}

	function paintMovementRecord(entry) {
		const move = MOVE_BY_ID[entry.type];
		drawerParts.badge.className = `rv-drawer-badge rv-tone-${move.sign > 0 ? 'success' : move.tone}`;
		drawerParts.badge.innerHTML = `<i class="bi ${move.icon}"></i>`;
		drawerParts.title.textContent = `${move.name} in ${PLAN_BY_ID[entry.plan].name}`;
		drawerParts.sub.textContent = [
			REGION_BY_ID[entry.region].name,
			CHANNEL_BY_ID[entry.segment].name,
			HISTORY.months[entry.month].label,
		].join(' · ');
		drawerParts.link.href = 'companies.html?stage=customer';
		drawerParts.link.innerHTML = '<i aria-hidden="true" class="bi bi-people me-1"></i>Open customers';
		const monthTotal = report.monthly[entry.type][entry.month] * move.sign;

		backend.accountsFor(entry).then((accounts) => {
			opened.accounts = accounts;
			const listed = accounts.slice(0, 8);
			const others = accounts.slice(8);
			const othersSum = others.reduce((sum, account) => sum + account.amount, 0);
			const facts =
				fact('MRR change', fullMoney(entry.amount, true)) +
				fact('Accounts', whole(entry.accounts)) +
				fact('Per account', fullMoney(entry.amount / Math.max(1, entry.accounts), true)) +
				fact('Share of the month', percent(monthTotal ? entry.amount / monthTotal : 0));
			const items = listed
				.map(
					(account) =>
						`<li><span class="rv-accounts-who"><a href="${ACCOUNT_PAGE}" class="rv-accounts-name rv-account">${htmlSafe(account.name)}</a>` +
						`<span class="rv-accounts-detail">${htmlSafe(account.detail)}</span></span><span class="rv-accounts-amt">${fullMoney(account.amount, true)}</span></li>`,
				)
				.join('');
			const remainder = others.length
				? `<p class="rv-drawer-more">And ${whole(others.length)} smaller ${others.length === 1 ? 'account' : 'accounts'}, ${fullMoney(othersSum, true)} between them.</p>`
				: '';
			drawerParts.body.innerHTML = `<dl class="rv-facts">${facts}</dl><h3 class="rv-drawer-sub">Accounts behind this number</h3><ul class="rv-accounts">${items}</ul>${remainder}${DRAWER_HINT}`;
		});
	}

	function paintPaymentRecord(entry) {
		const status = STATUS_BY_ID[entry.status];
		drawerParts.badge.className = `rv-drawer-badge rv-tone-${status.tone}`;
		drawerParts.badge.innerHTML = '<i class="bi bi-credit-card"></i>';
		drawerParts.title.textContent = entry.account;
		drawerParts.sub.textContent = [
			entry.id,
			`${PLAN_BY_ID[entry.plan].name}${entry.yearly ? ', billed yearly' : ''}`,
			REGION_BY_ID[entry.region].name,
		].join(' · ');
		drawerParts.link.href = ACCOUNT_PAGE;
		drawerParts.link.innerHTML = '<i aria-hidden="true" class="bi bi-arrows-angle-expand me-1"></i>Open full page';
		opened.accounts = [{ name: entry.account, detail: entry.id, amount: entry.amount }];

		const facts =
			fact('Amount', fullMoney(entry.amount)) +
			fact('Failed on', chargeDate(entry)) +
			fact('Tries', entry.attempts) +
			fact('Channel', CHANNEL_BY_ID[entry.segment].name);
		drawerParts.body.innerHTML =
			`<span class="basalt-status basalt-status-${status.tone}">${htmlSafe(status.name)}</span><dl class="rv-facts">${facts}</dl>` +
			`<h3 class="rv-drawer-sub">What happened</h3><ol class="rv-steps">${retryTimeline(entry).join('')}</ol>${DRAWER_HINT}`;
	}

	/*
	 * The charge history of a failed payment: the first charge, each retry
	 * a few days apart, and how it ended. A card update shows up just
	 * before the retry that it made succeed.
	 */
	function retryTimeline(entry) {
		const offsets = [0, 3, 5, 7];
		const lastWords = {
			retry: { result: 'Paid', tone: 'success' },
			card: { result: 'Paid with the new card', tone: 'success' },
			written: { result: 'Declined. Written off and the account was paused', tone: 'danger' },
		};
		const stepList = [];
		function step(tone, daysLater, text) {
			return `<li class="rv-steps-item rv-tone-${tone}"><span aria-hidden="true" class="rv-steps-dot"></span><span class="rv-steps-when">${chargeDate(entry, daysLater)}</span><span class="rv-steps-what">${text}</span></li>`;
		}

		for (let attempt = 0; attempt < entry.attempts; attempt += 1) {
			const ending = attempt === entry.attempts - 1 ? lastWords[entry.status] : null;
			const result = ending ? ending.result : attempt === 0 ? entry.decline : 'Declined again';
			const label = attempt === 0 ? 'First charge' : `Retry ${attempt}`;
			stepList.push(
				step(ending ? ending.tone : 'danger', offsets[attempt] || 0, `${label}: ${htmlSafe(result)}`),
			);
			if (entry.status === 'card' && attempt === entry.attempts - 2) {
				stepList.push(step('info', (offsets[attempt] || 0) + 1, 'Customer updated their card'));
			}
		}
		if (entry.status === 'retrying')
			stepList.push(step('warning', offsets[entry.attempts] || 9, 'Next retry is booked'));
		return stepList;
	}

	function exportRecord() {
		const entry = opened.list[opened.at];
		const rows = [
			['Account', 'Detail', 'MRR change'],
			...opened.accounts.map((account) => [account.name, account.detail, account.amount]),
		];
		const name =
			opened.kind === 'moves'
				? [entry.type, entry.plan, entry.region, entry.segment, HISTORY.months[entry.month].key].join('-')
				: entry.id.toLowerCase();
		backend.csvFile(name, rows).then((file) => {
			saveFile(file);
			const count = opened.accounts.length;
			notify('success', 'Export ready', `${file.filename} has ${count}${count === 1 ? ' row.' : ' rows.'}`);
		});
	}

	/* CSV downloads: the month-by-month summary, or whichever ledger rows
     currently pass that table's filters. */
	function downloadCsv(kind) {
		if (!report) return;
		const { monthly, shown, range } = report;
		const sheets = {
			summary: () => [
				[
					'Month',
					'MRR',
					'New',
					'Expansion',
					'Reactivation',
					'Contraction',
					'Churn',
					'Net new MRR',
					'Accounts',
					'Revenue per account',
					'Invoiced',
					'Collected',
					'Failed',
					'Won back',
				],
				...shown.map((at) => [
					HISTORY.months[at].key,
					monthly.mrr[at],
					monthly.new[at],
					monthly.expansion[at],
					monthly.reactivation[at],
					-monthly.contraction[at],
					-monthly.churn[at],
					monthly.net[at],
					monthly.accounts[at],
					Math.round(monthly.arpa[at]),
					monthly.billed[at],
					monthly.collected[at],
					monthly.failed[at],
					monthly.recovered[at],
				]),
			],
			moves: () => [
				['Month', 'Plan', 'Region', 'Channel', 'Movement', 'Accounts', 'MRR change'],
				...tables.moves
					.visible()
					.map((row) => [
						HISTORY.months[row.month].key,
						PLAN_BY_ID[row.plan].name,
						REGION_BY_ID[row.region].name,
						CHANNEL_BY_ID[row.segment].name,
						MOVE_BY_ID[row.type].name,
						row.accounts,
						row.amount,
					]),
			],
			failed: () => [
				['Invoice', 'Account', 'Plan', 'Region', 'Channel', 'Failed on', 'Tries', 'Status', 'Amount'],
				...tables.failed
					.visible()
					.map((row) => [
						row.id,
						row.account,
						PLAN_BY_ID[row.plan].name,
						REGION_BY_ID[row.region].name,
						CHANNEL_BY_ID[row.segment].name,
						chargeDate(row),
						row.attempts,
						STATUS_BY_ID[row.status].name,
						row.amount,
					]),
			],
		};
		const rows = (sheets[kind] || sheets.failed)();
		if (rows.length < 2) {
			notify('warning', 'Nothing to export', 'There are no rows for these filters.');
			return;
		}
		backend
			.csvFile(`${kind}-${HISTORY.months[range[0]].key}-to-${HISTORY.months[range[1]].key}`, rows)
			.then((file) => {
				saveFile(file);
				notify('success', 'Export ready', `${file.filename} has ${whole(rows.length - 1)} rows.`);
			});
	}

	/*
	 * Controls: range presets, the custom months, the comparison, the plan,
	 * region and channel filters, saved views and reset. Any change goes
	 * back to the backend through requery().
	 */
	function fillControls() {
		for (const plan of SAMPLE.plans) {
			controls.plan.insertAdjacentHTML('beforeend', `<option value="${plan.id}">${htmlSafe(plan.name)}</option>`);
		}
		for (const region of SAMPLE.regions) {
			controls.region.insertAdjacentHTML(
				'beforeend',
				`<option value="${region.id}">${htmlSafe(region.name)}</option>`,
			);
		}
		const newestFirst = HISTORY.months
			.map((month, at) => `<option value="${at}">${month.label}</option>`)
			.reverse()
			.join('');
		controls.from.innerHTML = newestFirst;
		controls.to.innerHTML = newestFirst;
		pick('[data-rv-views-list]').innerHTML = commandMenu();
	}

	/** One row in the Saved views command menu. */
	function commandRow({ id, value, icon, title, sub, keywords, primary }) {
		const iconClasses = primary ? 'basalt-command-icon basalt-command-icon-primary' : 'basalt-command-icon';
		return (
			`<div id="${id}" data-value="${value}"${keywords ? ` data-keywords="${keywords}"` : ''} role="option" aria-selected="false" class="basalt-command-item">` +
			`<span aria-hidden="true" class="${iconClasses}"><i class="bi ${icon}"></i></span>` +
			`<span class="basalt-command-text"><span class="basalt-command-title">${htmlSafe(title)}</span><span class="basalt-command-sub">${htmlSafe(sub)}</span></span></div>`
		);
	}

	function commandGroup(headingId, heading, rows) {
		return `<div role="group" aria-labelledby="${headingId}" class="basalt-command-group"><div id="${headingId}" class="basalt-command-heading">${heading}</div>${rows.join('')}</div>`;
	}

	/* The saved views first, then three quick actions. */
	function commandMenu() {
		const views = SAMPLE.savedViews.map((view) =>
			commandRow({
				id: `rv-view-${view.id}`,
				value: `view:${view.id}`,
				icon: view.icon,
				title: view.title,
				sub: view.sub,
			}),
		);
		const quickActions = [
			{
				id: 'rv-act-export',
				value: 'act:export',
				keywords: 'csv download',
				icon: 'bi-download',
				title: 'Export the summary',
				sub: 'Month by month, as CSV',
			},
			{
				id: 'rv-act-failed',
				value: 'act:failed',
				keywords: 'cards declined retry',
				icon: 'bi-credit-card',
				title: 'Payments still retrying',
				sub: 'Open them in the ledger',
			},
			{
				id: 'rv-act-reset',
				value: 'act:reset',
				keywords: 'clear default',
				icon: 'bi-arrow-counterclockwise',
				title: 'Reset everything',
				sub: 'Last 12 months, all plans and regions',
			},
		].map((action) => commandRow({ ...action, primary: true }));
		return commandGroup('rv-views-h1', 'Saved views', views) + commandGroup('rv-views-h2', 'Actions', quickActions);
	}

	function bindControls() {
		pick('[data-rv-preset]').addEventListener('change', (event) => {
			if (quietSync || !event.target.matches('.btn-check')) return;
			if (event.target.value === 'custom') [choice.from, choice.to] = monthsFor(choice);
			choice.preset = event.target.value;
			controls.customRange.hidden = choice.preset !== 'custom';
			requery();
		});

		for (const select of [controls.from, controls.to]) {
			select.addEventListener('change', () => {
				if (quietSync) return;
				choice.from = Number(controls.from.value);
				choice.to = Number(controls.to.value);
				if (choice.from > choice.to) {
					[choice.from, choice.to] = [choice.to, choice.from];
					syncControls();
				}
				requery();
			});
		}

		controls.compare.addEventListener('change', () => {
			if (quietSync) return;
			choice.compare = controls.compare.value;
			requery();
		});
		for (const field of ['plan', 'region']) {
			controls[field].addEventListener('change', () => {
				if (quietSync) return;
				choice[field] = controls[field].value;
				paintChips();
				requery();
			});
		}
		pick('[data-rv-segment]').addEventListener('change', (event) => {
			if (quietSync || !event.target.matches('.btn-check')) return;
			choice.segment = event.target.value;
			paintChips();
			requery();
		});

		for (const button of pickAll('[data-rv-reset]')) button.addEventListener('click', resetAll);
		pick('[data-rv-retry]').addEventListener('click', () => requery());
		pick('[data-rv-views]').addEventListener('basalt:command', (event) => runCommand(event.detail.value || ''));
		pick('[data-rv-outcome]').addEventListener('click', (event) => {
			const outcome = event.target.closest('[data-rv-status]');
			if (outcome) drillInto({ kind: 'failed', type: outcome.getAttribute('data-rv-status') });
		});
	}

	/* A saved view replaces the whole choice; the actions export, reset or
     jump to the payments that are still retrying. */
	function runCommand(value) {
		if (value.startsWith('view:')) {
			const view = SAMPLE.savedViews.find((entry) => `view:${entry.id}` === value);
			if (!view) return;
			Object.assign(choice, STARTING_STATE, view.set);
			clearLedgerFilters();
			syncControls();
			requery().then(() => notify('info', view.title, view.sub));
			return;
		}
		const handlers = {
			'act:export': () => downloadCsv('summary'),
			'act:reset': () => resetAll(),
			'act:failed': () => drillInto({ kind: 'failed', type: 'retrying' }),
		};
		handlers[value]?.();
	}

	/* Saved views and reset start both ledger tables from scratch as well. */
	function clearLedgerFilters() {
		tables.moves.clear();
		tables.failed.clear();
	}

	function resetAll() {
		Object.assign(choice, STARTING_STATE);
		clearLedgerFilters();
		syncControls();
		requery();
	}

	/*
	 * Makes every control show the current choice. The change events this
	 * fires for the segmented controls are ignored by our own handlers
	 * while quietSync is set.
	 */
	function syncControls() {
		quietSync = true;
		for (const [group, value] of [
			['[data-rv-preset]', choice.preset],
			['[data-rv-segment]', choice.segment],
		]) {
			const radio = pick(`${group} .btn-check[value="${value}"]`);
			if (radio && !radio.checked) {
				radio.checked = true;
				radio.dispatchEvent(new Event('change', { bubbles: true }));
			}
		}
		controls.compare.value = choice.compare;
		controls.plan.value = choice.plan;
		controls.region.value = choice.region;
		controls.customRange.hidden = choice.preset !== 'custom';
		const [first, last] = monthsFor(choice);
		controls.from.value = String(first);
		controls.to.value = String(last);
		quietSync = false;
		paintChips();
	}

	/* Removable chips for the plan, region and channel filters in use. */
	function paintChips() {
		const chipList = [
			['plan', 'Plan', PLAN_BY_ID],
			['region', 'Region', REGION_BY_ID],
			['segment', 'Channel', CHANNEL_BY_ID],
		]
			.filter(([field]) => choice[field])
			.map(([field, title, lookup]) => ({
				label: `${title}: ${lookup[choice[field]].name}`,
				remove: () => {
					choice[field] = '';
					syncControls();
					requery();
				},
			}));
		window.Basalt.drawer?.applied(
			controls.chips,
			chipList,
			() => {
				Object.assign(choice, { plan: '', region: '', segment: '' });
				syncControls();
				requery();
			},
			controls.plan,
		);
		controls.chips.hidden = !chipList.length;
	}

	function paintSpan() {
		const range = monthsFor(choice);
		const against = comparisonFor(range, choice.compare);
		const length = range[1] - range[0] + 1;
		const versus = against.range ? ` · against ${describeSpan(against.range)}` : ` · ${htmlSafe(against.why)}`;
		pick('[data-rv-span]').innerHTML =
			`<strong>${describeSpan(range)}</strong> · ${length} ${length === 1 ? 'month' : 'months'}${versus}`;
	}

	/*
	 * Asks the backend for the current choice and redraws the board. Only
	 * the newest request may paint, so a slow answer never overwrites a
	 * later one.
	 */
	function requery() {
		const request = ++latestRequest;
		paintSpan();
		showMode('loading');
		const { plan, region, segment } = choice;
		return backend
			.revenue(monthsFor(choice), { plan, region, segment })
			.then((answer) => {
				if (request !== latestRequest) return;
				if (!answer.cells.length) {
					showNothing();
					return;
				}
				report = summarize(answer);
				showMode('ready');
				paintBoard();
				fillLedgers();
				rebuildCharts(true);
				speak(
					`Showing ${describeSpan(report.range)}. MRR ${shortMoney(report.now.mrr)}, net new ${shortMoney(report.now.net, true)}.`,
				);
			})
			.catch((error) => {
				if (request !== latestRequest) return;
				pick('[data-rv-error-text]').textContent =
					`${error?.message ? `${error.message}. ` : ''}Nothing on this page has changed.`;
				showMode('error');
				notify('danger', 'Revenue did not load', 'Check the connection and try again.');
			});
	}

	function showNothing() {
		const named = [
			choice.plan && PLAN_BY_ID[choice.plan].name,
			choice.region && REGION_BY_ID[choice.region].name,
			choice.segment && CHANNEL_BY_ID[choice.segment].name.toLowerCase(),
		].filter(Boolean);
		const hint =
			choice.plan === 'enterprise' && choice.segment === 'self'
				? 'Max is only sold by the sales team.'
				: 'Try a wider filter.';
		pick('[data-rv-empty-text]').textContent = named.length
			? `Nothing was billed for ${named.join(', ')}. ${hint}`
			: 'There is no revenue to show yet. Figures appear here after the first invoice.';
		report = null;
		showMode('empty');
		speak('No revenue for these filters');
	}

	/** Switches between loading, ready, empty and error. */
	function showMode(mode) {
		const blocked = mode === 'error' || mode === 'empty';
		const loading = mode === 'loading';
		pick('[data-rv-error]').hidden = mode !== 'error';
		pick('[data-rv-empty]').hidden = mode !== 'empty';
		controls.board.hidden = blocked;
		controls.board.classList.toggle('is-loading', loading);
		controls.board.setAttribute('aria-busy', String(loading));
	}

	/* Small DOM, file and announcement helpers. */
	function pick(selector, scope = page) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = page) {
		return [...scope.querySelectorAll(selector)];
	}

	function keyed(list) {
		return Object.fromEntries(list.map((item) => [item.id, item]));
	}

	/** Quotes a CSV field only when it holds a quote, comma or line break. */
	function csvField(value) {
		const text = value == null ? '' : String(value);
		return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
	}

	function csvText(rows) {
		return rows.map((row) => row.map(csvField).join(',')).join('\r\n');
	}

	function saveFile(file) {
		const href = URL.createObjectURL(new Blob([file.csv], { type: 'text/csv;charset=utf-8' }));
		const link = Object.assign(document.createElement('a'), { href, download: file.filename });
		document.body.append(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(href), 1000);
	}

	function notify(tone, title, text) {
		window.Basalt.toasts?.push({ tone, title, text, duration: 4200 });
	}

	function speak(text) {
		window.Basalt.announce?.(text);
	}

	start();
})();
