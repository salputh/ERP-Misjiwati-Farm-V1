/**
 * Background jobs screen (background-jobs.html): one row per queue, a bar chart of
 * finished and failed work, the jobs that gave up, the full job table and a
 * side panel for a single job. Nothing is fetched. A seeded generator invents
 * the backlog, so each visit opens on the same picture, and a two-second beat
 * stands in for the job server. Swap seedBacklog() and advanceClock() for
 * calls to a real server and the painting code can stay as it is.
 */
(() => {
	'use strict';

	const screen = pick('[data-jb-root]');
	if (!screen) return;

	const MINUTE_MS = 60000;
	const BEAT_MS = 2000;
	const OPENED_AT = Date.now();
	const CHART_TYPEFACE = "'Schibsted Grotesk', sans-serif";
	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const random = mulberry(20260929);

	/* The six queues in the order their rows appear. `finished` and
     `perMinute` move with the beat; everything else is shop configuration. */
	const QUEUES = [
		{
			key: 'orders',
			title: 'Orders and exports',
			blurb: 'Packing slips and exports',
			glyph: 'bi-receipt',
			series: 1,
			workers: 4,
			perWorker: 2.4,
			earlier: 612,
		},
		{
			key: 'email',
			title: 'Emails',
			blurb: 'Order updates, cart reminders',
			glyph: 'bi-envelope-paper',
			series: 2,
			workers: 6,
			perWorker: 3.6,
			earlier: 4380,
		},
		{
			key: 'stock',
			title: 'Stock sync',
			blurb: 'Warehouse stock levels',
			glyph: 'bi-box-seam',
			series: 3,
			workers: 2,
			perWorker: 2.2,
			earlier: 1204,
			stalled: true,
			reconnects: 0,
		},
		{
			key: 'photos',
			title: 'Product photos',
			blurb: 'Resizing and thumbnails',
			glyph: 'bi-images',
			series: 4,
			workers: 3,
			perWorker: 1.3,
			earlier: 318,
		},
		{
			key: 'subs',
			title: 'Subscriptions',
			blurb: 'Membership renewals',
			glyph: 'bi-arrow-repeat',
			series: 5,
			workers: 2,
			perWorker: 1.5,
			earlier: 146,
		},
		{
			key: 'reports',
			title: 'Reports',
			blurb: 'Sales and tax summaries',
			glyph: 'bi-file-earmark-spreadsheet',
			series: 6,
			workers: 1,
			perWorker: 0.4,
			earlier: 12,
			paused: true,
			pauseNote: 'For Elaine Zeller’s stock count',
		},
	];
	const QUEUE_BY_KEY = Object.fromEntries(
		QUEUES.map((queue) => [queue.key, Object.assign(queue, { finished: 0, perMinute: 0 })]),
	);

	const SHOPPERS = [
		'Sandra Franklin',
		'Ruth Abernathy',
		'Phyllis Delaney',
		'Travis Daugherty',
		'Patricia Pemberton',
		'Benjamin Hartley',
		'Cheryl Sorensen',
		'Sabrina Kavanagh',
		'Eleanor Fairweather',
		'Iva Blackwood',
		'Christopher Vance',
		'Georgia Webster',
		'Natalie Tanner',
		'Rochelle Fairbanks',
	];
	const SKU_OF = {
		'Sculpted Shoulder Blazer': 'ML-BLAZ',
		'Draped Column Gown': 'ML-GOWN',
		'Tiered Organza Dress': 'ML-ORGZ',
		'Chalk-Stripe Suit': 'ML-SUIT',
		'Leather Trench Coat': 'ML-TRCH',
		'Bar Loafers': 'ML-LOAF',
		'Two-Tone Oxfords': 'ML-OXFD',
		'Cat-Eye Sunglasses': 'ML-CATE',
		'Shield Sunglasses': 'ML-SHLD',
	};
	const GARMENTS = Object.keys(SKU_OF);
	const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	/* What each queue gets asked to do. A recipe draws its random parts in
     reading order, which is what keeps the seeded backlog stable. */
	const RECIPES = {
		orders: [
			() => ({
				title: 'Export orders to accounting',
				trigger: 'Schedule: nightly order export',
				payload: { date: 'today', orders: intBetween(40, 180), format: 'csv', send_to: 'billing@marlo.com' },
			}),
			() => {
				const order = orderNumber();
				return {
					title: `Packing slip for order ${order}`,
					trigger: `Order ${order} paid`,
					payload: { order, items: intBetween(1, 6), printer: 'Packing bench 2' },
				};
			},
			() => {
				const order = orderNumber();
				return {
					title: `Book courier pickup for order ${order}`,
					trigger: `Order ${order} packed`,
					payload: { order, courier: 'DPD', parcels: intBetween(1, 3) },
				};
			},
		],
		email: [
			() => {
				const shopper = pickFrom(SHOPPERS);
				const order = orderNumber();
				return {
					title: `Order confirmation to ${shopper}`,
					trigger: `Order ${order} paid`,
					payload: { to: inboxFor(shopper), template: 'order-confirmation', order },
				};
			},
			() => {
				const shopper = pickFrom(SHOPPERS);
				const order = orderNumber();
				return {
					title: `Shipping update to ${shopper}`,
					trigger: `Order ${order} shipped`,
					payload: {
						to: inboxFor(shopper),
						template: 'shipped',
						order,
						tracking: `DPD ${intBetween(1000000, 9999999)}`,
					},
				};
			},
			() => {
				const shopper = pickFrom(SHOPPERS);
				return {
					title: `Basket reminder to ${shopper}`,
					trigger: 'Schedule: basket reminders',
					payload: {
						to: inboxFor(shopper),
						template: 'basket-reminder',
						basket_value: `$${intBetween(49, 649)}.00`,
					},
				};
			},
			() => {
				const shopper = pickFrom(SHOPPERS);
				return {
					title: `Renewal notice to ${shopper}`,
					trigger: 'Schedule: subscription renewals',
					payload: { to: inboxFor(shopper), template: 'renewal-notice', renews_on: 'Oct 3' },
				};
			},
		],
		stock: [
			() => {
				const garment = pickFrom(GARMENTS);
				return {
					title: `Sync stock for ${garment}`,
					trigger: 'Schedule: stock sync every 10 minutes',
					payload: { sku: SKU_OF[garment], warehouse: 'Eugene', direction: 'pull' },
				};
			},
			() => ({
				title: 'Pull stock counts from the warehouse',
				trigger: 'Schedule: stock sync every 10 minutes',
				payload: { warehouse: 'Eugene', skus: intBetween(80, 140) },
			}),
		],
		photos: [
			() => {
				const garment = pickFrom(GARMENTS);
				return {
					title: `Resize photos for ${garment}`,
					trigger: 'Upload by Abby Morrow',
					payload: { product: garment, photos: intBetween(2, 8), sizes: [1600, 800, 400] },
				};
			},
			() => {
				const garment = pickFrom(GARMENTS);
				return {
					title: `Make thumbnails for ${garment}`,
					trigger: 'Upload by Tom Becker',
					payload: { product: garment, photos: intBetween(1, 4), size: 240 },
				};
			},
		],
		subs: [
			() => {
				const shopper = pickFrom(SHOPPERS);
				return {
					title: `Charge the Aftercare Plan renewal for ${shopper}`,
					trigger: 'Schedule: subscription renewals',
					payload: { customer: shopper, plan: 'Aftercare Plan, 6 months', amount: '$150.00' },
				};
			},
			() => {
				const shopper = pickFrom(SHOPPERS);
				return {
					title: `Pause the Aftercare Plan for ${shopper}`,
					trigger: `${shopper} from their account`,
					payload: {
						customer: shopper,
						add_on: 'Aftercare Plan',
						from: 'October',
						reason: 'Away for winter',
					},
				};
			},
		],
		reports: [
			() => ({
				title: 'Daily sales summary',
				trigger: 'Schedule: daily at 7:00 am',
				payload: { day: 'yesterday', send_to: ['elaine@marlo.com', 'tom@marlo.com'] },
			}),
			() => ({
				title: 'Sales tax report for September',
				trigger: 'Elaine Zeller',
				payload: { month: '2026-09', regions: ['OR', 'WA', 'CA'] },
			}),
		],
	};

	/* How a job in each queue goes wrong: the one-liner for lists, the plain
     explanation for the panel, and the stack a developer would want. */
	const FAILURES = {
		orders: {
			summary: 'Courier system unavailable (503)',
			message:
				'The courier did not take the booking. Their system answered "503 Service Unavailable", which usually clears within the hour.',
			trace: 'CourierError: 503 Service Unavailable\n    at DpdClient.bookPickup (jobs/courier/book.js:58:11)\n    at async runJob (worker/run.js:41:5)\n    at async Worker.next (worker/loop.js:22:7)',
		},
		email: {
			summary: 'Mailbox full, the email came back',
			message:
				"The customer's mailbox is full, so their email provider sent the message back. Trying again later may work once they clear some space.",
			trace: 'SmtpError: 552 5.2.2 Mailbox full\n    at Mailer.send (jobs/email/send.js:112:9)\n    at async runJob (worker/run.js:41:5)\n    at async Worker.next (worker/loop.js:22:7)',
		},
		stock: {
			summary: 'Warehouse did not answer within 30 s',
			message:
				'The warehouse system did not answer within 30 seconds. The stock levels in the shop were left as they were.',
			trace: 'TimeoutError: no answer from warehouse after 30000 ms\n    at WarehouseClient.levels (jobs/stock/sync.js:84:13)\n    at async runJob (worker/run.js:41:5)\n    at async Worker.next (worker/loop.js:22:7)',
		},
		photos: {
			summary: 'Photo is over the 25 MB limit',
			message:
				'The photo is 48 MB, over the 25 MB limit. Export a smaller copy and upload it again; the product keeps its old photos until then.',
			trace: 'ImageError: input is 50331648 bytes, limit is 26214400\n    at resize (jobs/photos/resize.js:31:9)\n    at async runJob (worker/run.js:41:5)',
		},
		subs: {
			summary: 'Card declined, not enough funds',
			message:
				'The card was declined for insufficient funds. The customer has been emailed a link to update their card, and the club is on hold.',
			trace: 'PaymentError: card_declined (insufficient_funds)\n    at Payments.charge (jobs/subs/renew.js:77:15)\n    at async runJob (worker/run.js:41:5)',
		},
		reports: {
			summary: 'Ran out of memory',
			message:
				'The report ran out of memory while adding up the month. Splitting it by region usually fixes this.',
			trace: 'RangeError: Array buffer allocation failed\n    at buildTaxReport (jobs/reports/tax.js:140:21)\n    at async runJob (worker/run.js:41:5)',
		},
	};

	/* Shortest and longest run, in seconds, for one job in each queue. */
	const RUN_SECONDS = {
		orders: [2, 40],
		email: [0.4, 3],
		stock: [3, 25],
		photos: [5, 60],
		subs: [1, 6],
		reports: [30, 300],
	};

	/* Three tries, the first wait one minute, each later wait four times longer. */
	const RETRY_POLICY = { allowed: 3, firstWaitMinutes: 1, growing: true };

	const STATUS_LOOK = {
		running: { tone: 'info', label: 'Running' },
		waiting: { tone: '', label: 'Waiting' },
		failed: { tone: 'danger', label: 'Failed' },
		done: { tone: 'success', label: 'Finished' },
		canceled: { tone: '', label: 'Canceled' },
	};

	/* The single button at the end of a row depends on what can still happen. */
	const CANCEL_BUTTON = { hook: 'data-jb-cancel', verb: 'Cancel', tip: 'Cancel', glyph: 'bi-x-circle' };
	const RETRY_BUTTON = { hook: 'data-jb-retry-row', verb: 'Retry', tip: 'Retry', glyph: 'bi-arrow-clockwise' };
	const ROW_BUTTONS = {
		running: CANCEL_BUTTON,
		waiting: CANCEL_BUTTON,
		failed: RETRY_BUTTON,
		canceled: RETRY_BUTTON,
		done: { hook: 'data-jb-open', verb: 'Open', tip: 'Details', glyph: 'bi-chevron-right' },
	};

	const EMPTY_TABS = {
		running: {
			glyph: 'bi-cpu',
			heading: 'Nothing is running',
			text: 'Every worker is free. New jobs start the moment they arrive.',
			extra: '',
		},
		waiting: {
			glyph: 'bi-hourglass',
			heading: 'Nothing is waiting',
			text: 'Jobs are picked up as soon as they arrive.',
			extra: '',
		},
		failed: {
			glyph: 'bi-check2-circle',
			heading: 'No failed jobs',
			text: 'Everything either finished or is still trying.',
			extra: ' basalt-empty-success',
		},
		done: {
			glyph: 'bi-inbox',
			heading: 'Nothing has finished yet',
			text: 'Finished jobs show up here.',
			extra: '',
		},
		canceled: {
			glyph: 'bi-x-circle',
			heading: 'Nothing was canceled',
			text: 'Jobs you cancel stay here so you can run them again.',
			extra: '',
		},
		all: {
			glyph: 'bi-inbox',
			heading: 'No jobs yet',
			text: 'Jobs appear here the moment something starts one.',
			extra: '',
		},
	};

	const LOG_LOOK = {
		bad: { glyph: 'bi-x-lg', dot: ' jb-d-attempt-dot-bad' },
		ok: { glyph: 'bi-check-lg', dot: ' jb-d-attempt-dot-ok' },
		run: { glyph: 'bi-play-fill', dot: ' jb-d-attempt-dot-run' },
		wait: { glyph: 'bi-hourglass', dot: '' },
	};

	const RANGES = {
		'30m': { phrase: 'in the last 30 minutes', unit: 'minute' },
		'24h': { phrase: 'in the last 24 hours', unit: 'hour' },
		'7d': { phrase: 'in the last 7 days', unit: 'day' },
	};

	/* The jobs the Run dialog can start on demand, keyed by the option value. */
	const PRESETS = {
		export: {
			queue: 'orders',
			title: "Export today's orders",
			payload: { date: 'today', format: 'csv', send_to: 'billing@marlo.com' },
		},
		stock: {
			queue: 'stock',
			title: 'Sync stock with the warehouse',
			payload: { warehouse: 'Eugene', skus: 128 },
		},
		slips: {
			queue: 'orders',
			title: 'Print packing slips for paid orders',
			payload: { orders: 14, printer: 'Packing bench 2' },
		},
		basket: {
			queue: 'email',
			title: 'Send basket reminders',
			payload: { customers: 38, template: 'basket-reminder' },
		},
		renew: {
			queue: 'subs',
			title: "Charge today's subscription renewals",
			payload: { renewals: 23, total: '$782.00' },
		},
		photos: {
			queue: 'photos',
			title: 'Resize new product photos',
			payload: { photos: 12, sizes: [1600, 800, 400] },
		},
		report: { queue: 'reports', title: 'Build the daily sales summary', payload: { day: 'yesterday' } },
	};

	const RECONNECT_FACES = [
		['idle', '<i class="bi bi-plug" aria-hidden="true"></i>', 'Reconnect'],
		['busy', '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>', 'Connecting'],
		['done', '<i class="bi bi-check2" aria-hidden="true"></i>', 'Connected'],
		['fail', '<i class="bi bi-exclamation-circle" aria-hidden="true"></i>', 'No answer'],
	];

	/* Widths of the placeholder bars in each table column while rows load. */
	const GHOST_CELLS = [
		[['1rem']],
		[['14rem'], ['6rem', ' basalt-skeleton-sm mt-2']],
		[['7rem']],
		[['5rem']],
		[['4rem']],
		[['3rem', ' ms-auto']],
		[['2.5rem', ' ms-auto']],
		[],
	];

	const jobs = [];
	const trend = { '30m': blankSeries(), '24h': blankSeries(), '7d': blankSeries() };
	const view = { tab: 'all', term: '', queue: '', page: 1, perPage: 12 };
	const selectedIds = new Set();
	let pageRows = [];
	let listedUntil = OPENED_AT;
	let pageButtons = null;
	let knownPages = 1;
	let listsReady = false;
	let failedSignature = '';
	let pausedEarlier = null;
	let lastCleared = [];
	let chartRange = '30m';
	let barChart = null;
	let liveOn = true;
	let beatTimer = 0;
	let typingTimer = 0;
	let panelJobs = [];
	let panelJob = null;
	let panelStepper = null;

	const ui = {
		queueList: pick('[data-jb-queues]', screen),
		pauseEvery: pick('[data-jb-pause-all]', screen),
		canvas: pick('[data-jb-chart]', screen),
		failedList: pick('[data-jb-failed]', screen),
		failedEmpty: pick('[data-jb-failed-empty]', screen),
		retryAll: pick('[data-jb-retry-all]', screen),
		clearOpen: pick('[data-jb-clear-open]', screen),
		clearDialog: pick('#jb-clear'),
		clearHold: pick('[data-jb-clear-hold]'),
		rows: pick('[data-jb-body]', screen),
		search: pick('[data-jb-search]', screen),
		queueFilter: pick('[data-jb-queue-filter]', screen),
		perPage: pick('[data-jb-per]', screen),
		pageLinks: pick('[data-jb-pages]', screen),
		rangeText: pick('[data-jb-range]', screen),
		listCount: pick('[data-jb-list-count]', screen),
		selection: pick('[data-jb-bulk]', screen),
		pageCheck: pick('[data-jb-check-page]', screen),
		freshButton: pick('[data-jb-fresh]', screen),
		panel: pick('#jb-job'),
		runMenu: pick('[data-jb-command]'),
		liveButton: pick('[data-jb-live]', screen),
		livePill: pick('[data-jb-live-pill]', screen),
	};

	/* Seeds the data in a fixed order (backlog, then pace, then history, as the
     random source demands), wires every section and paints a loading frame. */
	function start() {
		seedBacklog();
		for (const queue of QUEUES) queue.perMinute = samplePace(queue);
		seedTrend();

		ui.queueList.innerHTML = QUEUES.map(queueRowMarkup).join('');
		for (const queue of QUEUES) {
			ui.queueFilter.append(new Option(queue.title, queue.key));
		}

		wireQueues();
		wireChart();
		wireFailed();
		wireTable();
		wirePanel();
		wireRunMenu();
		wireLive();

		ui.rows.innerHTML = Array.from({ length: 8 }, ghostRowMarkup).join('');
		ui.rangeText.textContent = 'Loading jobs';
		paintFigures();
		paintQueues();
		paintTabCounts();
		paintChartSummary();
		syncPauseEvery();

		/* Rows and failed jobs hold skeletons for a moment, as they would while a
       real job server answers. */
		setTimeout(
			() => {
				listsReady = true;
				refresh(true);
				setLiveUpdates(true);
			},
			calmMotion.matches ? 250 : 700,
		);
	}

	/** Repaints every section; `full` also rebuilds the table rather than patching it. */
	function refresh(full) {
		paintFigures();
		paintQueues();
		paintTabCounts();
		paintFailed(full);
		if (full) paintList();
		else patchDrawnRows();
		paintChartSummary();
		syncPauseEvery();
	}

	/* Seeded data: the backlog of 150 jobs, newest first. The first 26 are
     recent enough to still be running or waiting; the rest have settled. */

	function seedBacklog() {
		const draw = [
			'email',
			'email',
			'email',
			'email',
			'orders',
			'orders',
			'stock',
			'stock',
			'photos',
			'subs',
			'reports',
		];
		const settledSoFar = { failed: 0, canceled: 0 };
		let addedAt = OPENED_AT;
		for (let index = 0; index < 150; index += 1) {
			const recent = index < 26;
			addedAt -= (recent ? random() * 0.45 : 3 + random() * 13) * MINUTE_MS;
			const queue = QUEUE_BY_KEY[pickFrom(draw)];
			const job = createJob(queue.key, addedAt);
			if (recent) seedRecentJob(job, queue, index);
			else seedSettledJob(job, queue, settledSoFar);
			jobs.push(job);
		}
	}

	function seedRecentJob(job, queue, index) {
		const busy = jobs.filter((other) => other.queue === queue.key && other.status === 'running').length;
		if (isWorking(queue) && busy < queue.workers) {
			beginJob(job, Math.min(OPENED_AT - 2000, job.addedAt + random() * 0.3 * MINUTE_MS));
			job.progress = 0.08 + random() * 0.7;
			return;
		}
		if (queue.key !== 'stock' || index <= 18) return;
		/* Waiting for another go after the warehouse stopped answering. */
		job.tries = 1;
		job.log.push({
			tone: 'bad',
			at: job.addedAt + 0.1 * MINUTE_MS,
			headline: 'Try 1 failed',
			detail: FAILURES.stock.summary,
		});
		job.nextTryAt = OPENED_AT + intBetween(2, 9) * MINUTE_MS;
	}

	/** Ends an older job as failed (at most seven), canceled (three) or finished. */
	function seedSettledJob(job, queue, settledSoFar) {
		const roll = random();
		const seconds = sampleRunSeconds(job.queue);
		const startedAt = job.addedAt;
		const failure = FAILURES[queue.key];

		if (settledSoFar.failed < 7 && roll < 0.07 && (queue.key !== 'reports' || settledSoFar.failed < 1)) {
			settledSoFar.failed += 1;
			let tryAt = startedAt + 0.2 * MINUTE_MS;
			for (let attempt = 1; attempt <= 3; attempt += 1) {
				job.log.push({ tone: 'bad', at: tryAt, headline: `Try ${attempt} failed`, detail: failure.summary });
				tryAt += 4 ** (attempt - 1) * MINUTE_MS;
			}
			Object.assign(job, { status: 'failed', allowed: 3, tries: 3, endedAt: tryAt - 0.9 * MINUTE_MS, seconds });
			job.worker = workerName(queue, queue.workers);
			return;
		}

		if (settledSoFar.canceled < 3 && roll > 0.975) {
			settledSoFar.canceled += 1;
			job.status = 'canceled';
			job.endedAt = startedAt + 0.5 * MINUTE_MS;
			job.log.push({ tone: 'bad', at: job.endedAt, headline: 'Canceled', detail: 'by Tom Becker' });
			return;
		}

		const neededSecondTry = roll > 0.9;
		job.status = 'done';
		job.tries = neededSecondTry ? 2 : 1;
		job.worker = workerName(queue, queue.workers);
		if (neededSecondTry) {
			job.log.push({
				tone: 'bad',
				at: startedAt + 0.1 * MINUTE_MS,
				headline: 'Try 1 failed',
				detail: failure.summary,
			});
		}
		job.seconds = seconds;
		job.endedAt = startedAt + (neededSecondTry ? 1.1 * MINUTE_MS : 0) + seconds * 1000;
		job.log.push({
			tone: 'ok',
			at: job.endedAt,
			headline: `Try ${job.tries} finished`,
			detail: `took ${formatDuration(seconds)}`,
		});
	}

	/* History for each chart range. The 30-minute series keeps moving with the
     beat; the day and week ones are drawn once. */
	function seedTrend() {
		const pace = totalPace();
		const minutes = trend['30m'];
		for (let back = 29; back >= 0; back -= 1) {
			const current = back === 0;
			minutes.labels.push(clockTime(OPENED_AT - back * MINUTE_MS));
			minutes.finished.push(current ? 0 : Math.round(pace * (0.75 + random() * 0.5)));
			minutes.failed.push(current ? 0 : random() < 0.28 ? intBetween(1, 3) : 0);
		}

		const hours = trend['24h'];
		const hourNow = new Date(OPENED_AT).getHours();
		for (let back = 23; back >= 0; back -= 1) {
			const hour = (hourNow - back + 24) % 24;
			/* Quiet at night, busy mid-morning and after work. */
			const daily = 0.25 + 0.75 * Math.max(0, Math.sin(((hour - 5) / 19) * Math.PI));
			hours.labels.push(`${twoDigits(hour)}:00`);
			hours.finished.push(Math.round(pace * 60 * daily * (0.8 + random() * 0.4)));
			hours.failed.push(intBetween(2, 22));
		}

		const days = trend['7d'];
		for (let back = 6; back >= 0; back -= 1) {
			const day = new Date(OPENED_AT - back * 24 * 60 * MINUTE_MS);
			days.labels.push(`${WEEKDAYS[day.getDay()]} ${day.getDate()}`);
			days.finished.push(Math.round(pace * 60 * 14 * (0.8 + random() * 0.35)));
			days.failed.push(intBetween(40, 180));
		}
	}

	function blankSeries() {
		return { labels: [], finished: [], failed: [] };
	}

	/* Job records and the rules that move them between states. */

	/**
	 * A new waiting job for a queue. The recipe and the id are always drawn,
	 * even when `overrides` replaces their text, so the random sequence holds.
	 */
	function createJob(queueKey, addedAt, overrides) {
		const recipe = pickFrom(RECIPES[queueKey])();
		return {
			id: `job_${hexDigits(6)}`,
			queue: queueKey,
			title: recipe.title,
			payload: recipe.payload,
			trigger: recipe.trigger,
			addedAt,
			status: 'waiting',
			progress: 0,
			tries: 0,
			allowed: RETRY_POLICY.allowed,
			log: [],
			seconds: null,
			worker: '',
			startedAt: 0,
			endedAt: 0,
			nextTryAt: 0,
			...overrides,
		};
	}

	function beginJob(job, at) {
		const queue = QUEUE_BY_KEY[job.queue];
		job.status = 'running';
		job.progress = job.progress || 0;
		job.tries += 1;
		job.startedAt = at || Date.now();
		job.worker = workerName(queue, Math.max(1, queue.workers));
		job.log.push({
			tone: 'run',
			at: job.startedAt,
			headline: `Try ${job.tries} started`,
			detail: `on ${job.worker}`,
		});
	}

	function workerName(queue, highest) {
		return `${queue.key}-worker-${intBetween(1, highest)}`;
	}

	/** Starts waiting jobs, oldest first, until every worker in the queue is busy. */
	function staffQueue(queue) {
		if (!isWorking(queue)) return;
		const busy = countRunning(queue.key);
		const now = Date.now();
		const line = jobs
			.filter((job) => job.queue === queue.key && job.status === 'waiting' && !(job.nextTryAt > now))
			.sort((a, b) => a.addedAt - b.addedAt);
		for (const job of line.slice(0, Math.max(0, queue.workers - busy))) {
			job.nextTryAt = 0;
			beginJob(job);
		}
	}

	/** Puts failed or canceled jobs back in line and returns the ones it moved. */
	function requeue(list, note) {
		const revived = list.filter((job) => job.status === 'failed' || job.status === 'canceled');
		for (const job of revived) {
			Object.assign(job, {
				status: 'waiting',
				allowed: job.tries + RETRY_POLICY.allowed,
				progress: 0,
				nextTryAt: 0,
				endedAt: null,
			});
			job.log.push({
				tone: 'run',
				at: Date.now(),
				headline: 'Sent back to the queue',
				detail: `by you${note ? `, ${note}` : ''}`,
			});
		}
		for (const key of new Set(revived.map((job) => job.queue))) staffQueue(QUEUE_BY_KEY[key]);
		return revived;
	}

	/** Cancels the running or waiting jobs in `list` and returns what undo needs. */
	function cancelJobs(list) {
		const undo = [];
		for (const job of list) {
			if (job.status !== 'running' && job.status !== 'waiting') continue;
			undo.push({ job, status: job.status, progress: job.progress });
			job.status = 'canceled';
			job.endedAt = Date.now();
			job.log.push({ tone: 'bad', at: job.endedAt, headline: 'Canceled', detail: 'by you' });
		}
		for (const queue of QUEUES) staffQueue(queue);
		return undo;
	}

	function restoreCanceled(undo) {
		for (const { job, status, progress } of undo) {
			Object.assign(job, { status, progress, endedAt: null });
			job.log.pop();
		}
		refresh(true);
	}

	function retryWait(attempt) {
		return RETRY_POLICY.firstWaitMinutes * (RETRY_POLICY.growing ? 4 ** (attempt - 1) : 1);
	}

	function isWorking(queue) {
		return !queue.paused && !queue.stalled;
	}

	/** Jobs a minute for the queue: zero when stopped, halved when idle. */
	function samplePace(queue) {
		if (!isWorking(queue)) return 0;
		const busy = countRunning(queue.key);
		return queue.workers * queue.perWorker * (0.85 + random() * 0.3) * (busy ? 1 : 0.5);
	}

	function totalPace() {
		return QUEUES.reduce((sum, queue) => sum + queue.perMinute, 0);
	}

	function sampleRunSeconds(queueKey) {
		const [shortest, longest] = RUN_SECONDS[queueKey];
		return shortest + random() * (longest - shortest);
	}

	function countRunning(queueKey) {
		return jobs.filter((job) => job.queue === queueKey && job.status === 'running').length;
	}

	/** How many jobs sit in each status, among those that pass `keep`. */
	function tallyJobs(keep) {
		const sums = { all: 0, running: 0, waiting: 0, failed: 0, done: 0, canceled: 0 };
		for (const job of jobs) {
			if (!keep(job)) continue;
			sums.all += 1;
			sums[job.status] += 1;
		}
		return sums;
	}

	function tallyQueue(queueKey) {
		return tallyJobs((job) => !queueKey || job.queue === queueKey);
	}

	function findJob(id) {
		return jobs.find((job) => job.id === id);
	}

	function failedNewestFirst() {
		return jobs
			.filter((job) => job.status === 'failed')
			.sort((a, b) => (b.endedAt || b.addedAt) - (a.endedAt || a.addedAt));
	}

	/* The hero figures and the queue rows. Rows are built once; live data
     only rewrites their text, so focus inside a row (the workers stepper,
     say) is never lost. */

	function paintFigures() {
		const sums = tallyQueue();
		for (const status of ['running', 'waiting', 'failed']) {
			nudge(pick(`[data-jb-fig="${status}"]`, screen), whole(sums[status]));
		}
	}

	/** Writes a new value and, motion allowing, gives it a small lift. */
	function nudge(target, value) {
		if (!target || target.textContent.trim() === String(value)) return;
		target.textContent = value;
		if (calmMotion.matches) return;
		target.classList.remove('jb-bump');
		void target.offsetWidth;
		target.classList.add('jb-bump');
	}

	function queueRowMarkup(queue) {
		const title = htmlSafe(queue.title);
		const workersId = `jb-w-${queue.key}`;
		const stepButton = (step, words, glyph) =>
			`<button class="basalt-stepper-btn" type="button" aria-label="${words} for ${title}" data-basalt-step="${step}"><i class="bi ${glyph}" aria-hidden="true"></i></button>`;
		const stepper = [
			stepButton(-1, 'One worker fewer', 'bi-dash-lg'),
			`<input class="basalt-stepper-input" id="${workersId}" type="number" inputmode="numeric" min="1" max="12" value="${queue.workers}" data-jb-q-workers>`,
			stepButton(1, 'One worker more', 'bi-plus-lg'),
		].join('');
		const faces = RECONNECT_FACES.map(
			([state, mark, words]) => `<span class="btn-loading-state btn-loading-${state}">${mark}${words}</span>`,
		).join('');
		const identity =
			`<span class="jb-queue-icon" aria-hidden="true"><i class="bi ${queue.glyph}"></i></span>` +
			`<div class="jb-queue-main"><h3 class="jb-queue-name">${title} <span class="basalt-status basalt-status-dot" data-jb-q-state></span></h3><p class="jb-queue-line" data-jb-q-line>${htmlSafe(queue.blurb)}</p></div>`;
		const controls =
			`<div class="jb-queue-ctrl">` +
			`<div class="jb-queue-workers"><label class="jb-queue-workers-label" for="${workersId}">Workers</label><div class="basalt-stepper basalt-stepper-sm" data-basalt-stepper>${stepper}</div></div>` +
			`<div class="jb-queue-act"><button class="btn btn-outline-secondary btn-sm" type="button" data-jb-q-pause></button><button class="btn btn-outline-secondary btn-sm btn-loading" type="button" data-jb-q-reconnect hidden>${faces}</button></div>` +
			'</div>';
		return `<li class="jb-queue" data-jb-q="${queue.key}" style="${toneStyle(queue)}">${identity}<p class="jb-queue-stats" data-jb-q-stats></p>${controls}</li>`;
	}

	function paintQueues() {
		for (const queue of QUEUES) paintQueue(queue);
	}

	function paintQueue(queue) {
		const row = pick(`[data-jb-q="${queue.key}"]`, ui.queueList);
		const sums = tallyQueue(queue.key);
		const [tone, label] = queueHealth(queue, sums);
		const badge = pick('[data-jb-q-state]', row);
		badge.className = [
			'basalt-status',
			'basalt-status-dot',
			tone && `basalt-status-${tone}`,
			tone === 'success' && !calmMotion.matches && 'basalt-status-live',
		]
			.filter(Boolean)
			.join(' ');
		badge.textContent = label;
		row.classList.toggle('is-paused', Boolean(queue.paused));
		row.classList.toggle('is-stalled', Boolean(queue.stalled));

		const figures = pick('[data-jb-q-stats]', row);
		const summary = queueFiguresMarkup(queue, sums);
		if (figures.innerHTML !== summary) figures.innerHTML = summary;

		const blurb = pick('[data-jb-q-line]', row);
		blurb.textContent = queueBlurb(queue);
		blurb.classList.toggle('is-alert', Boolean(queue.stalled));

		const pauseButton = pick('[data-jb-q-pause]', row);
		pauseButton.hidden = Boolean(queue.stalled);
		pick('[data-jb-q-reconnect]', row).hidden = !queue.stalled;
		const face = queue.paused
			? '<i class="bi bi-play-fill me-1" aria-hidden="true"></i>Resume'
			: '<i class="bi bi-pause-fill me-1" aria-hidden="true"></i>Pause';
		if (pauseButton.innerHTML !== face) pauseButton.innerHTML = face;
		pauseButton.setAttribute('aria-label', `${queue.paused ? 'Resume' : 'Pause'} ${queue.title}`);
	}

	function queueHealth(queue, sums) {
		if (queue.stalled) return ['danger', 'Stalled'];
		if (queue.paused) return ['warning', 'Paused'];
		if (sums.waiting > queue.workers * 2) return ['warning', 'Backed up'];
		if (!sums.running) return ['', 'Idle'];
		return ['success', 'Running'];
	}

	/**
	 * The pace and the three counts, one cell each so they line up under
	 * the column heads. Each cell carries its own word, which shows only
	 * when the row is stacked and the heads are gone; a zero is dimmed in
	 * the columns and left out of the stacked line, which says so when
	 * every figure is zero.
	 */
	function queueFiguresMarkup(queue, sums) {
		const pace = queue.perMinute > 0 ? paceText(queue.perMinute) : '0';
		const cells = [
			[pace, ' a minute', queue.perMinute > 0, ''],
			[whole(sums.running), ' running', sums.running > 0, ''],
			[whole(sums.waiting), ' waiting', sums.waiting > 0, ''],
			[whole(sums.failed), ' failed', sums.failed > 0, ' is-bad'],
		];
		const idle = cells.some(([, , some]) => some) ? '' : '<span class="jb-queue-idle">Nothing to do</span>';
		return (
			cells
				.map(
					([figure, words, some, tone]) =>
						`<span class="jb-queue-figure${some ? tone : ' is-zero'}">${figure}<span class="jb-queue-figure-word">${words}</span></span>`,
				)
				.join('') + idle
		);
	}

	/** What the queue does, unless something about it needs saying instead. */
	function queueBlurb(queue) {
		if (queue.stalled) {
			return queue.reconnects
				? 'Still no answer, try again in a minute'
				: `No answer since ${clockTime(OPENED_AT - 23 * MINUTE_MS)}, jobs are safe`;
		}
		if (queue.paused && queue.pauseNote) return queue.pauseNote;
		return queue.blurb;
	}

	function paceText(perMinute) {
		return perMinute >= 10 ? whole(perMinute) : perMinute.toFixed(1);
	}

	function toneStyle(queue) {
		return `--jb-tone: var(--basalt-series-${queue.series})`;
	}

	function wireQueues() {
		ui.queueList.addEventListener('change', (event) => {
			const field = event.target.closest('[data-jb-q-workers]');
			if (!field) return;
			const queue = QUEUE_BY_KEY[field.closest('[data-jb-q]').getAttribute('data-jb-q')];
			const workers = parseInt(field.value, 10);
			if (!workers || workers === queue.workers) return;
			queue.workers = workers;
			staffQueue(queue);
			queue.perMinute = samplePace(queue);
			refresh();
			say(`${queue.title} now has ${countOf(workers, 'worker')}.`);
		});

		ui.queueList.addEventListener('click', (event) => {
			const row = event.target.closest('[data-jb-q]');
			if (!row) return;
			const queue = QUEUE_BY_KEY[row.getAttribute('data-jb-q')];
			if (event.target.closest('[data-jb-q-pause]')) togglePause(queue);
			const reconnect = event.target.closest('[data-jb-q-reconnect]');
			if (reconnect && !reconnect.classList.contains('is-loading')) tryReconnect(queue, reconnect, row);
		});

		ui.pauseEvery.addEventListener('click', () => {
			if (ui.pauseEvery.getAttribute('aria-pressed') === 'true') {
				setQueuesPaused(QUEUES, false);
				notify({ tone: 'success', title: 'Every queue is running', text: 'Waiting jobs are being picked up.' });
				return;
			}
			pausedEarlier = QUEUES.filter((queue) => queue.paused).map((queue) => queue.key);
			setQueuesPaused(QUEUES, true);
			notify({
				tone: 'warning',
				title: 'Every queue is paused',
				text: 'Running jobs finish; nothing new starts until you resume.',
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							setQueuesPaused(
								QUEUES.filter((queue) => !pausedEarlier.includes(queue.key)),
								false,
							);
						},
					},
				],
			});
		});
	}

	function togglePause(queue) {
		setQueuesPaused([queue], !queue.paused);
		const nowPaused = queue.paused;
		notify({
			tone: nowPaused ? 'warning' : 'success',
			title: `${queue.title}${nowPaused ? ' paused' : ' running again'}`,
			text: nowPaused ? 'Jobs keep arriving and wait until you resume it.' : 'Waiting jobs are being picked up.',
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						setQueuesPaused([queue], !nowPaused);
					},
				},
			],
		});
	}

	/** Pausing lets running jobs finish; resuming clears the note and refills workers. */
	function setQueuesPaused(list, paused) {
		for (const queue of list) {
			queue.paused = paused;
			if (!paused) {
				queue.pauseNote = '';
				staffQueue(queue);
			}
			queue.perMinute = samplePace(queue);
		}
		refresh();
		syncPauseEvery();
	}

	function syncPauseEvery() {
		const allStopped = QUEUES.every((queue) => queue.paused || queue.stalled);
		ui.pauseEvery.setAttribute('aria-pressed', String(allStopped));
		pick('[data-jb-pause-all-label]', ui.pauseEvery).textContent = allStopped
			? 'Resume every queue'
			: 'Pause every queue';
		pick('.bi', ui.pauseEvery).className = `bi ${allStopped ? 'bi-play-fill' : 'bi-pause-fill'} me-1`;
	}

	/* The warehouse ignores the first reconnect, so the error state can be
     seen, and answers the second. */
	function tryReconnect(queue, button, row) {
		window.Basalt.buttonState(button, 'loading');
		setTimeout(
			() => {
				queue.reconnects += 1;
				if (queue.reconnects < 2) {
					window.Basalt.buttonState(button, 'error');
					paintQueue(queue);
					notify({
						tone: 'danger',
						title: 'Still no answer from the warehouse',
						text: 'Nothing was lost. Give it a minute and try again.',
					});
					setTimeout(() => window.Basalt.buttonState(button, 'idle'), 2200);
					return;
				}
				window.Basalt.buttonState(button, 'success');
				setTimeout(() => reconnected(queue, button, row), calmMotion.matches ? 300 : 900);
			},
			calmMotion.matches ? 400 : 1400,
		);
	}

	function reconnected(queue, button, row) {
		window.Basalt.buttonState(button, 'idle');
		queue.stalled = false;
		const { waiting } = tallyQueue(queue.key);
		staffQueue(queue);
		queue.perMinute = samplePace(queue);
		refresh();
		if ([button, document.body].includes(document.activeElement)) pick('[data-jb-q-pause]', row).focus();
		notify({
			tone: 'success',
			title: 'Stock sync is connected again',
			text: `${countOf(waiting, 'waiting job')} are being picked up now.`,
		});
	}

	/* The bar chart of finished and failed jobs, and the totals under it. */

	function wireChart() {
		for (const choice of pickAll('input[name="jb-range"]', screen)) {
			choice.addEventListener('change', () => {
				if (!choice.checked) return;
				chartRange = choice.value;
				drawChart(true);
				paintChartSummary();
			});
		}

		/* The chart waits until it is about to scroll into view. */
		if (ui.canvas && 'IntersectionObserver' in window) {
			const watcher = new IntersectionObserver(
				(sightings) => {
					if (!sightings.some((sighting) => sighting.isIntersecting)) return;
					watcher.disconnect();
					drawChart(true);
				},
				{ rootMargin: '80px 0px' },
			);
			watcher.observe(ui.canvas);
		} else if (ui.canvas) {
			drawChart(false);
		}

		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() => {
				if (barChart) drawChart(false);
			});
		});
	}

	function drawChart(animated) {
		if (typeof Chart === 'undefined' || !ui.canvas) return;
		barChart?.destroy();
		const ink = chartInks();
		const series = trend[chartRange];
		const tickStyle = { color: ink.quiet, font: { family: CHART_TYPEFACE, size: 11.5 }, padding: 6 };
		const bars = (label, values, color) => ({
			label,
			data: values.slice(),
			backgroundColor: color,
			borderRadius: 4,
			borderSkipped: false,
			maxBarThickness: 26,
			stack: 'jobs',
		});
		const tooltip = {
			backgroundColor: ink.surface,
			borderColor: ink.border,
			borderWidth: 1,
			titleColor: ink.text,
			bodyColor: ink.text,
			titleFont: { family: CHART_TYPEFACE, size: 12, weight: '600' },
			bodyFont: { family: CHART_TYPEFACE, size: 12 },
			padding: 10,
			cornerRadius: 8,
			boxPadding: 4,
			usePointStyle: true,
			callbacks: { label: (item) => ` ${item.dataset.label}: ${whole(item.parsed.y)}` },
		};
		barChart = new Chart(ui.canvas, {
			type: 'bar',
			data: {
				labels: series.labels.slice(),
				datasets: [bars('Finished', series.finished, ink.finished), bars('Failed', series.failed, ink.failed)],
			},
			options: {
				maintainAspectRatio: false,
				responsive: true,
				animation: animated && !calmMotion.matches ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { intersect: false, mode: 'index' },
				plugins: { legend: { display: false }, tooltip },
				scales: {
					x: {
						stacked: true,
						border: { display: false },
						grid: { display: false },
						ticks: { maxRotation: 0, autoSkipPadding: 14, ...tickStyle },
					},
					y: {
						stacked: true,
						beginAtZero: true,
						border: { display: false },
						grid: { color: ink.grid },
						ticks: { maxTicksLimit: 5, callback: (value) => whole(value), ...tickStyle },
					},
				},
			},
		});
	}

	function chartInks() {
		const text = themeToken('--basalt-copy', '#12233a');
		return {
			text,
			quiet: blend(themeToken('--basalt-copy-muted', '#5f7186'), text, 0.82),
			grid: tint(text, 0.07),
			surface: themeToken('--basalt-plane', '#ffffff'),
			border: themeToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			/* Green and red on purpose: the first series color is itself red in Scarlet. */
			finished: themeToken('--basalt-success', '#12c08f'),
			failed: themeToken('--basalt-danger', '#ef4d63'),
		};
	}

	function paintChartSummary() {
		const series = trend[chartRange];
		const { phrase, unit } = RANGES[chartRange];
		const finished = sumOf(series.finished);
		const failed = sumOf(series.failed);
		const successShare = finished + failed ? (finished / (finished + failed)) * 100 : 100;
		const busiest = QUEUES.reduce((best, queue) =>
			queue.earlier + queue.finished > best.earlier + best.finished ? queue : best,
		);
		const stat = (key) => pick(`[data-jb-stat="${key}"]`, screen);
		pick('[data-jb-chart-sum]', screen).textContent =
			`${whole(finished)} jobs finished and ${whole(failed)} failed ${phrase}.`;
		stat('done').textContent = whole(finished);
		stat('failed').textContent = whole(failed);
		stat('rate').textContent = `${successShare.toFixed(1)}%`;
		stat('busiest').textContent = busiest.title;
		ui.canvas.setAttribute(
			'aria-label',
			`Bar chart: ${whole(finished)} jobs finished and ${whole(failed)} failed ${phrase}, split by ${unit}.`,
		);
	}

	/* Only the 30-minute view follows the beat; the others stay as drawn. */
	function feedLiveChart() {
		if (!barChart || chartRange !== '30m') return;
		const series = trend['30m'];
		const [finishedBars, failedBars] = barChart.data.datasets;
		barChart.data.labels = series.labels.slice();
		finishedBars.data = series.finished.slice();
		failedBars.data = series.failed.slice();
		barChart.update(calmMotion.matches ? 'none' : undefined);
	}

	/* Chart.js wants concrete colors, so tokens are mixed here in script. */
	const COLOR_READERS = [
		[/^#([0-9a-f]{3})$/i, (digits) => [...digits].map((digit) => parseInt(digit + digit, 16))],
		[
			/^#([0-9a-f]{6})$/i,
			(digits) => {
				const packed = parseInt(digits, 16);
				return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
			},
		],
		[
			/^rgba?\(([^)]+)\)$/i,
			(inside) =>
				inside
					.split(',')
					.slice(0, 3)
					.map((part) => parseFloat(part)),
		],
	];

	function rgbParts(color) {
		const text = String(color || '').trim();
		for (const [pattern, read] of COLOR_READERS) {
			const found = pattern.exec(text);
			if (found) return read(found[1]);
		}
		return [128, 128, 128];
	}

	function tint(color, alpha) {
		const [red, green, blue] = rgbParts(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	/** Mixes `share` of the first color into the second. */
	function blend(first, second, share) {
		const top = rgbParts(first);
		const bottom = rgbParts(second);
		const [red, green, blue] = [0, 1, 2].map((slot) => Math.round(top[slot] * share + bottom[slot] * (1 - share)));
		return `rgb(${red}, ${green}, ${blue})`;
	}

	function themeToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/* Jobs that used up their tries: the short list, Retry all, and clearing
     them behind a press-and-hold. */

	function wireFailed() {
		ui.failedList.addEventListener('click', (event) => {
			const button = event.target.closest('[data-jb-retry]');
			if (!button) return;
			const job = findJob(button.getAttribute('data-jb-retry'));
			const sendBack = () => {
				requeue([job]);
				refresh();
				notify({
					tone: 'success',
					title: 'Sent back to the queue',
					text:
						job.title +
						(QUEUE_BY_KEY[job.queue].stalled
							? ' will run once the warehouse answers.'
							: ' is running again.'),
					actions: [
						{
							label: 'Open job',
							ghost: true,
							onClick: () => {
								showJob(job.id);
							},
						},
					],
				});
			};
			if (calmMotion.matches) {
				sendBack();
				return;
			}
			button.closest('li').classList.add('is-leaving');
			setTimeout(sendBack, 260);
		});

		ui.retryAll.addEventListener('click', () => {
			const list = failedNewestFirst();
			if (!list.length || ui.retryAll.classList.contains('is-loading')) return;
			window.Basalt.buttonState(ui.retryAll, 'loading');
			setTimeout(
				() => {
					requeue(list, 'all at once');
					window.Basalt.buttonState(ui.retryAll, 'success');
					refresh();
					notify({
						tone: 'success',
						title: `${countOf(list.length, 'job')} sent back`,
						text: 'They start again as workers free up.',
					});
					setTimeout(() => window.Basalt.buttonState(ui.retryAll, 'idle'), 1600);
				},
				calmMotion.matches ? 300 : 900,
			);
		});

		if (ui.clearDialog) wireClearDialog(ui.clearDialog);
	}

	function wireClearDialog(dialog) {
		dialog.addEventListener('show.bs.modal', () => {
			const list = failedNewestFirst();
			const named = list
				.slice(0, 4)
				.map((job) => `<li><i class="bi bi-x-circle" aria-hidden="true"></i>${htmlSafe(job.title)}</li>`);
			if (list.length > 4)
				named.push(`<li><i class="bi bi-three-dots" aria-hidden="true"></i>and ${list.length - 4} more</li>`);
			pick('[data-jb-clear-title]', dialog).textContent = `Clear ${countOf(list.length, 'failed job')}?`;
			pick('[data-jb-clear-list]', dialog).innerHTML = named.join('');
		});

		dialog.addEventListener('hidden.bs.modal', () => {
			window.Basalt.dialog.clearDone(pick('.modal-content', dialog));
			ui.clearHold.classList.remove('is-done');
			ui.clearHold.style.removeProperty('--basalt-hold');
		});

		ui.clearHold.addEventListener('basalt:confirm', () => {
			lastCleared = failedNewestFirst();
			for (const job of lastCleared) jobs.splice(jobs.indexOf(job), 1);
			const cleared = lastCleared.length;
			setTimeout(
				() => {
					window.Basalt.dialog.done(
						pick('.modal-content', dialog),
						`${countOf(cleared, 'failed job')}${cleared === 1 ? ' is' : ' are'} off the list. Nothing else was changed.`,
					);
					refresh(true);
					notify({
						tone: 'success',
						title: `${countOf(cleared, 'failed job')} cleared`,
						actions: [{ label: 'Undo', onClick: undoClear }],
					});
				},
				calmMotion.matches ? 0 : 250,
			);
		});
	}

	/* Undo brings back whatever the latest clear removed. */
	function undoClear() {
		jobs.push(...lastCleared);
		jobs.sort((a, b) => b.addedAt - a.addedAt);
		lastCleared = [];
		refresh(true);
	}

	function paintFailed(force) {
		if (!listsReady) return;
		const list = failedNewestFirst();
		const counter = pick('[data-jb-failed-count]', screen);
		counter.textContent = list.length;
		counter.className = `basalt-count-pill jb-count ${list.length ? 'basalt-count-pill-danger' : 'basalt-count-pill-success'}`;
		ui.retryAll.disabled = !list.length;
		ui.clearOpen.disabled = !list.length;

		const signature = list.map((job) => job.id).join(',');
		if (signature === failedSignature && !force) {
			for (const stamp of pickAll('[data-jb-failed-ago]', ui.failedList)) {
				const job = findJob(stamp.getAttribute('data-jb-failed-ago'));
				if (job) stamp.textContent = timeAgo(job.endedAt || job.addedAt);
			}
			return;
		}

		const hadFocus = ui.failedList.contains(document.activeElement);
		failedSignature = signature;
		ui.failedList.removeAttribute('aria-busy');
		ui.failedList.hidden = !list.length;
		ui.failedEmpty.hidden = Boolean(list.length);
		const items = list.slice(0, 5).map(failedItemMarkup);
		if (list.length > 5) {
			items.push(
				`<li class="jb-failed-item jb-failed-more"><span></span><p class="jb-failed-meta mb-0">${countOf(list.length - 5, 'more failed job')} in the list below, under Failed.</p><span></span></li>`,
			);
		}
		ui.failedList.innerHTML = items.join('');
		if (!hadFocus) return;
		const firstLink = pick('[data-jb-open]', ui.failedList);
		(firstLink || pick('.basalt-empty-title', ui.failedEmpty)).focus();
	}

	function failedItemMarkup(job) {
		const queue = QUEUE_BY_KEY[job.queue];
		const title = htmlSafe(job.title);
		const meta = `${htmlSafe(queue.title)} · gave up <span data-jb-failed-ago="${job.id}">${timeAgo(job.endedAt || job.addedAt)}</span> · ${countOf(job.tries, 'try', 'tries')}`;
		return (
			`<li class="jb-failed-item" data-jb-failed-id="${job.id}">` +
			`<span class="jb-failed-icon" aria-hidden="true"><i class="bi ${queue.glyph}"></i></span>` +
			`<div class="jb-failed-main"><button class="jb-failed-open" type="button" data-jb-open="${job.id}">${title}</button><p class="jb-failed-err">${htmlSafe(FAILURES[job.queue].summary)}</p><p class="jb-failed-meta">${meta}</p></div>` +
			`<button class="btn btn-outline-secondary btn-sm" type="button" aria-label="Retry ${title}" data-jb-retry="${job.id}"><i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Retry</button>` +
			'</li>'
		);
	}

	/* The job table: tabs, search, queue filter, checked rows, paging. Live
     changes are written into rows already on screen; a full rebuild happens
     only when the set of rows changes. */

	function wireTable() {
		ui.rows.addEventListener('change', (event) => {
			const box = event.target.closest('[data-jb-pick]');
			if (!box) return;
			const id = box.getAttribute('data-jb-pick');
			if (box.checked) selectedIds.add(id);
			else selectedIds.delete(id);
			box.closest('tr').classList.toggle('is-picked', box.checked);
			paintSelection();
		});

		ui.pageCheck.addEventListener('change', () => {
			const on = ui.pageCheck.checked;
			for (const job of pageRows) {
				if (on) selectedIds.add(job.id);
				else selectedIds.delete(job.id);
			}
			for (const box of pickAll('[data-jb-pick]', ui.rows)) {
				box.checked = on;
				box.closest('tr').classList.toggle('is-picked', box.checked);
			}
			paintSelection();
		});

		ui.rows.addEventListener('click', (event) => {
			const cancelButton = event.target.closest('[data-jb-cancel]');
			const retryButton = event.target.closest('[data-jb-retry-row]');
			if (cancelButton) {
				const undo = cancelJobs([findJob(cancelButton.getAttribute('data-jb-cancel'))]);
				refresh();
				announceCancel(undo);
			}
			if (retryButton) {
				const job = findJob(retryButton.getAttribute('data-jb-retry-row'));
				requeue([job]);
				refresh();
				notify({ tone: 'success', title: 'Sent back to the queue', text: job.title });
			}
			if (event.target.closest('[data-jb-clear-filters]')) resetFilters();
		});

		ui.selection.addEventListener('click', (event) => {
			const button = event.target.closest('[data-jb-bulk]');
			if (!button) return;
			const list = [...selectedIds].map(findJob).filter(Boolean);
			BULK_ACTIONS[button.getAttribute('data-jb-bulk')]?.(list);
			ui.pageCheck.focus();
		});

		for (const tab of pickAll('[data-jb-tab]', screen)) {
			tab.addEventListener('shown.bs.tab', () => {
				view.tab = tab.getAttribute('data-jb-tab');
				view.page = 1;
				pick('#jb-list-panel').setAttribute('aria-labelledby', tab.id);
				paintList();
			});
		}

		ui.search.addEventListener('input', () => {
			clearTimeout(typingTimer);
			typingTimer = setTimeout(() => {
				view.term = ui.search.value.trim().toLowerCase();
				view.page = 1;
				paintList();
			}, 150);
		});

		ui.queueFilter.addEventListener('change', () => {
			view.queue = ui.queueFilter.value;
			view.page = 1;
			paintTabCounts();
			paintList();
		});

		/* A new page size keeps the first visible row on screen. */
		ui.perPage.addEventListener('change', () => {
			const firstShown = (view.page - 1) * view.perPage;
			view.perPage = parseInt(ui.perPage.value, 10);
			view.page = Math.floor(firstShown / view.perPage) + 1;
			paintList();
		});

		ui.freshButton.addEventListener('click', () => {
			const arrivals = jobs.filter((job) => job.addedAt > listedUntil).map((job) => job.id);
			listedUntil = Date.now() + 1;
			view.page = 1;
			paintTabCounts();
			paintList({ fresh: arrivals });
			say(`${countOf(arrivals.length, 'new job')} added to the list.`);
			pick('[data-jb-open]', ui.rows)?.focus();
		});

		if (window.Basalt.pagination) {
			pageButtons = window.Basalt.pagination(ui.pageLinks, {
				total: 1,
				current: 1,
				label: 'Page',
				onChange: (page) => {
					view.page = page;
					paintList();
				},
			});
		}
	}

	/* What the selection bar's buttons do with the checked jobs. */
	const BULK_ACTIONS = {
		clear() {
			selectedIds.clear();
			paintList();
		},
		cancel(list) {
			const undo = cancelJobs(list);
			const skipped = list.length - undo.length;
			selectedIds.clear();
			refresh(true);
			if (!undo.length) {
				notify({
					tone: 'info',
					title: 'Nothing to cancel',
					text: 'Only running or waiting jobs can be canceled.',
				});
				return;
			}
			notify({
				tone: 'warning',
				icon: 'bi-x-circle',
				title: `${countOf(undo.length, 'job')} canceled`,
				text: `They will not run unless you retry them.${leftAlone(skipped, 'only running or waiting jobs can be canceled.')}`,
				actions: [{ label: 'Undo', onClick: () => restoreCanceled(undo) }],
			});
		},
		retry(list) {
			const revived = requeue(list, 'from the list');
			const skipped = list.length - revived.length;
			selectedIds.clear();
			refresh(true);
			if (!revived.length) {
				notify({
					tone: 'info',
					title: 'Nothing to retry',
					text: 'Only failed or canceled jobs can be retried.',
				});
				return;
			}
			notify({
				tone: 'success',
				title: `${countOf(revived.length, 'job')} sent back`,
				text: `They start again as workers free up.${leftAlone(skipped, 'only failed or canceled jobs can be retried.')}`,
			});
		},
	};

	function leftAlone(skipped, reason) {
		return skipped ? ` ${countOf(skipped, 'job')} left alone: ${reason}` : '';
	}

	function announceCancel(undo) {
		if (!undo.length) return;
		const single = undo.length === 1;
		notify({
			tone: 'warning',
			icon: 'bi-x-circle',
			title: single ? 'Job canceled' : `${countOf(undo.length, 'job')} canceled`,
			text: single ? undo[0].job.title : 'They will not run unless you retry them.',
			actions: [{ label: 'Undo', onClick: () => restoreCanceled(undo) }],
		});
	}

	function resetFilters() {
		Object.assign(view, { term: '', queue: '', page: 1 });
		ui.search.value = '';
		ui.queueFilter.value = '';
		window.Basalt.select?.refresh?.(ui.queueFilter);
		refresh(true);
		ui.search.focus();
	}

	function passesFilters(job) {
		if (job.addedAt > listedUntil) return false;
		if (view.tab !== 'all' && job.status !== view.tab) return false;
		if (view.queue && job.queue !== view.queue) return false;
		return !view.term || searchText(job).includes(view.term);
	}

	function searchText(job) {
		return [job.title, job.id, QUEUE_BY_KEY[job.queue].title, JSON.stringify(job.payload)].join(' ').toLowerCase();
	}

	/** Rebuilds the visible page of rows; `fresh` names rows that flash in. */
	function paintList({ fresh } = {}) {
		if (!listsReady) return;
		const matching = jobs.filter(passesFilters).sort((a, b) => b.addedAt - a.addedAt);
		const pageTotal = Math.max(1, Math.ceil(matching.length / view.perPage));
		view.page = Math.min(view.page, pageTotal);
		const offset = (view.page - 1) * view.perPage;
		pageRows = matching.slice(offset, offset + view.perPage);

		const focused = ui.rows.contains(document.activeElement) ? document.activeElement : null;
		const focusId = focused && (focused.getAttribute('data-jb-open') || focused.getAttribute('data-jb-pick'));
		dropTooltips(ui.rows);
		ui.rows.removeAttribute('aria-busy');
		ui.rows.innerHTML = pageRows.length
			? pageRows.map((job) => rowMarkup(job, Boolean(fresh?.includes(job.id)))).join('')
			: emptyRowMarkup();
		window.Basalt.tips?.(ui.rows);
		if (focusId) pick(`[data-jb-open="${focusId}"], [data-jb-pick="${focusId}"]`, ui.rows)?.focus();

		ui.rangeText.innerHTML = matching.length
			? `<strong>${whole(offset + 1)}–${whole(offset + pageRows.length)}</strong> of ${whole(matching.length)} jobs`
			: 'No jobs';
		ui.listCount.textContent = countOf(matching.length, 'job') + (view.term || view.queue ? ' match' : '');

		/* Page buttons are redrawn only when their number changes, so focus can stay on them. */
		if (pageButtons && pageTotal !== knownPages) {
			knownPages = pageTotal;
			pageButtons.setTotal(pageTotal);
		}
		if (pageButtons && pageButtons.get() !== view.page) pageButtons.set(view.page);
		paintSelection();
	}

	function rowMarkup(job, isNew) {
		const queue = QUEUE_BY_KEY[job.queue];
		const title = htmlSafe(job.title);
		const isChecked = selectedIds.has(job.id);
		const cells = [
			`<td class="jb-check"><input class="form-check-input" type="checkbox" aria-label="Select ${title}" data-jb-pick="${job.id}"${isChecked ? ' checked' : ''}></td>`,
			`<td><div class="jb-job"><button class="jb-job-open" type="button" data-jb-open="${job.id}">${title}</button><span class="jb-mono">${job.id}</span></div></td>`,
			`<td><span class="jb-queue-tag" style="${toneStyle(queue)}">${htmlSafe(queue.title)}</span></td>`,
			`<td><div class="jb-status" data-jb-cell="status">${statusMarkup(job)}</div></td>`,
			`<td class="jb-quiet" data-jb-cell="added">${timeAgo(job.addedAt)}</td>`,
			`<td class="text-end jb-quiet" data-jb-cell="took">${durationText(job)}</td>`,
			`<td class="text-end" data-jb-cell="tries">${triesMarkup(job)}</td>`,
			`<td class="text-end"><div class="jb-actions" data-jb-cell="actions" data-jb-was="${job.status}">${rowButtonMarkup(job)}</div></td>`,
		];
		return `<tr class="${isChecked ? 'is-picked' : ''}${isNew ? ' jb-new' : ''}" data-jb-row="${job.id}">${cells.join('')}</tr>`;
	}

	/** The status badge, plus a progress bar while the job runs (`wide` in the panel). */
	function statusMarkup(job, wide) {
		const { tone, label } = STATUS_LOOK[job.status];
		const badge = `<span class="basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}">${statusWords(job, label)}</span>`;
		if (job.status !== 'running') return badge;
		const percent = Math.round(job.progress * 100);
		return `${badge}<span class="jb-progress${wide ? ' jb-progress-wide' : ''}" role="progressbar" aria-label="${htmlSafe(job.title)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></span>`;
	}

	function statusWords(job, label) {
		if (job.status !== 'waiting') return label;
		const queue = QUEUE_BY_KEY[job.queue];
		if (job.nextTryAt > Date.now()) return `Tries again ${timeUntil(job.nextTryAt - Date.now())}`;
		if (queue.paused) return 'Waiting, queue paused';
		if (queue.stalled) return 'Waiting, queue stalled';
		return label;
	}

	function rowButtonMarkup(job) {
		const { hook, verb, tip, glyph } = ROW_BUTTONS[job.status];
		return `<button class="btn btn-icon" type="button" aria-label="${verb} ${htmlSafe(job.title)}" data-bs-toggle="tooltip" data-bs-title="${tip}" ${hook}="${job.id}"><i class="bi ${glyph}" aria-hidden="true"></i></button>`;
	}

	function triesMarkup(job) {
		return job.tries ? `${job.tries} of ${job.allowed}` : '<span class="jb-quiet">0</span>';
	}

	function durationText(job) {
		if (job.status === 'running') return formatDuration(Math.max(0, Date.now() - job.startedAt) / 1000);
		if (job.seconds != null && job.status !== 'canceled') return formatDuration(job.seconds);
		return '';
	}

	function emptyRowMarkup() {
		if (view.term || view.queue) {
			const where = view.tab === 'all' ? '' : `under ${STATUS_LOOK[view.tab].label.toLowerCase()} `;
			const what = view.term ? `"${htmlSafe(view.term)}"` : 'that queue';
			return (
				'<tr class="jb-empty-row"><td colspan="8"><div class="basalt-empty basalt-empty-compact">' +
				'<span class="basalt-empty-badge" aria-hidden="true"><i class="bi bi-search"></i></span><h3 class="basalt-empty-title">No jobs match</h3>' +
				`<p class="basalt-empty-text">Nothing ${where}matches ${what}. Try another word or clear the filters.</p>` +
				'<div class="basalt-empty-actions"><button class="btn btn-sm btn-outline-secondary" type="button" data-jb-clear-filters>Clear filters</button></div>' +
				'</div></td></tr>'
			);
		}
		const { glyph, heading, text, extra } = EMPTY_TABS[view.tab];
		return `<tr class="jb-empty-row"><td colspan="8"><div class="basalt-empty basalt-empty-compact${extra}"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi ${glyph}"></i></span><h3 class="basalt-empty-title">${heading}</h3><p class="basalt-empty-text">${text}</p></div></td></tr>`;
	}

	function ghostRowMarkup() {
		const cells = GHOST_CELLS.map((bars, column) => {
			const inner = bars
				.map(
					([width, extra = '']) =>
						`<span class="basalt-skeleton basalt-skeleton-line${extra}" style="width:${width}"></span>`,
				)
				.join('');
			return column === 0 ? `<td class="jb-check">${inner}</td>` : `<td>${inner}</td>`;
		});
		return `<tr class="jb-row-ghost" aria-hidden="true">${cells.join('')}</tr>`;
	}

	function paintTabCounts() {
		const sums = tallyJobs((job) => job.addedAt <= listedUntil && (!view.queue || job.queue === view.queue));
		for (const [status, total] of Object.entries(sums)) {
			const badge = pick(`[data-jb-tab-count="${status}"]`, screen);
			if (badge && badge.textContent.trim() !== String(total)) badge.textContent = total;
		}
		const arrivals = jobs.filter((job) => job.addedAt > listedUntil).length;
		ui.freshButton.hidden = !arrivals;
		if (arrivals)
			pick('[data-jb-fresh-label]', ui.freshButton).textContent = `Show ${countOf(arrivals, 'new job')}`;
	}

	/* Updates the rows already drawn in place: the progress bar only moves
     its width, and the action button is swapped only when the status changes. */
	function patchDrawnRows() {
		for (const row of pickAll('[data-jb-row]', ui.rows)) {
			const job = findJob(row.getAttribute('data-jb-row'));
			if (!job) continue;
			const cell = (name) => pick(`[data-jb-cell="${name}"]`, row);

			const statusCell = cell('status');
			const fill = pick('.jb-progress > span', statusCell);
			if (fill && job.status === 'running') {
				moveProgress(fill, job.progress);
			} else {
				const markup = statusMarkup(job);
				if (statusCell.innerHTML !== markup) statusCell.innerHTML = markup;
			}
			cell('added').textContent = timeAgo(job.addedAt);
			cell('took').textContent = durationText(job);
			cell('tries').innerHTML = triesMarkup(job);

			const actionCell = cell('actions');
			if (actionCell.getAttribute('data-jb-was') === job.status) continue;
			const hadFocus = actionCell.contains(document.activeElement);
			dropTooltips(actionCell);
			actionCell.innerHTML = rowButtonMarkup(job);
			actionCell.setAttribute('data-jb-was', job.status);
			window.Basalt.tips?.(actionCell);
			if (hadFocus) pick('button', actionCell)?.focus();
		}
	}

	function moveProgress(fill, progress) {
		const percent = Math.round(progress * 100);
		fill.style.width = `${percent}%`;
		fill.parentElement.setAttribute('aria-valuenow', String(percent));
	}

	function paintSelection() {
		const onPage = pageRows.map((job) => job.id);
		const ticked = onPage.filter((id) => selectedIds.has(id)).length;
		ui.pageCheck.checked = onPage.length > 0 && ticked === onPage.length;
		ui.pageCheck.indeterminate = ticked > 0 && ticked < onPage.length;
		ui.pageCheck.disabled = !onPage.length;
		ui.selection.hidden = !selectedIds.size;
		pick('[data-jb-bulk-count]', ui.selection).textContent = selectedIds.size;
	}

	function dropTooltips(scope) {
		if (!window.bootstrap) return;
		for (const holder of pickAll('[data-bs-toggle="tooltip"]', scope)) {
			window.bootstrap.Tooltip.getInstance(holder)?.dispose();
		}
	}

	/* The side panel for one job: progress steps, the error, every try, the
     facts and the payload. Up and down step through the list it came from. */

	function wirePanel() {
		document.addEventListener('click', (event) => {
			const opener = event.target.closest('[data-jb-open]');
			if (opener && screen.contains(opener)) showJob(opener.getAttribute('data-jb-open'));
		});

		ui.panel.addEventListener('click', (event) => {
			const button = event.target.closest('[data-jb-d-act]');
			if (!button || !panelJob) return;
			const job = panelJob;
			if (button.getAttribute('data-jb-d-act') === 'cancel') {
				const undo = cancelJobs([job]);
				refresh();
				paintPanel(job);
				announceCancel(undo);
			} else {
				requeue([job], 'from the job page');
				refresh();
				paintPanel(job);
				notify({ tone: 'success', title: 'Sent back to the queue', text: job.title });
			}
			pick('.btn-close', ui.panel).focus();
		});
	}

	function showJob(id) {
		const job = findJob(id);
		if (!job) return;
		const failed = failedNewestFirst();
		if (pageRows.some((row) => row.id === id)) panelJobs = pageRows.slice();
		else panelJobs = failed.some((row) => row.id === id) ? failed : [job];

		if (!panelStepper && window.Basalt.drawer) {
			/* The stepper reads the count each time it moves, so one live object
         serves lists of any length. */
			panelStepper = window.Basalt.drawer.recordNav(
				ui.panel,
				{ valueOf: () => Math.max(1, panelJobs.length) },
				(at) => paintPanel(panelJobs[at]),
			);
		}
		if (panelStepper) panelStepper.go(panelJobs.indexOf(job), 0);
		else paintPanel(job);
		pick('.basalt-drawer-nav', ui.panel).hidden = panelJobs.length < 2;
		window.bootstrap.Offcanvas.getOrCreateInstance(ui.panel).show();
	}

	function paintPanel(job) {
		panelJob = job;
		const queue = QUEUE_BY_KEY[job.queue];
		const failure = FAILURES[job.queue];
		const part = (name) => pick(`[data-jb-d="${name}"]`, ui.panel);

		ui.panel.style.setProperty('--jb-tone', `var(--basalt-series-${queue.series})`);
		part('icon').innerHTML = `<i class="bi ${queue.glyph}"></i>`;
		part('name').textContent = job.title;
		part('sub').textContent = `${queue.title} · added ${timeAgo(job.addedAt)}`;
		part('status').innerHTML = statusMarkup(job, true);
		part('steps').innerHTML = stepsMarkup(job);

		const showsError =
			job.status === 'failed' ||
			(job.status === 'waiting' && job.tries && job.log.some((entry) => entry.tone === 'bad'));
		part('error').hidden = !showsError;
		if (showsError) {
			part('errmsg').textContent = failure.message;
			part('trace').textContent = failure.trace;
			const fold = pick('details', part('error'));
			if (fold) fold.open = false;
		}

		part('attempts-title').textContent = job.tries ? `Tries (${job.tries} of ${job.allowed})` : 'Tries';
		part('attempts').innerHTML = logMarkup(job);
		part('id').textContent = job.id;
		part('copy-id').setAttribute('data-basalt-copy', job.id);
		part('queue').textContent = queue.title;
		part('added').textContent = `${clockTime(job.addedAt)}, ${timeAgo(job.addedAt)}`;
		part('took').textContent = durationText(job) || 'not finished';
		part('by').textContent = job.trigger;
		part('worker').textContent = job.worker || 'none yet';
		part('payload').textContent = JSON.stringify({ job: job.id, queue: job.queue, ...job.payload }, null, 2);

		pick('[data-jb-d-act="cancel"]', ui.panel).hidden = !['running', 'waiting'].includes(job.status);
		pick('[data-jb-d-act="retry"]', ui.panel).hidden = !['failed', 'canceled'].includes(job.status);
		ui.panel.setAttribute('data-jb-status', job.status);
	}

	/* A job that gave up or was canceled stops on its third step without a
     tick; a finished one has all four ticked. */
	function stepReached(job) {
		if (job.status === 'waiting') return job.tries ? 2 : 1;
		if (job.status === 'running') return 2;
		return job.status === 'done' ? 4 : 3;
	}

	function stepsMarkup(job) {
		const running = job.status === 'running';
		let pickedUp = 'not yet';
		if (job.startedAt) pickedUp = clockTime(job.startedAt);
		else if (job.log.length && job.tries) pickedUp = clockTime(job.log[0].at);
		const steps = [
			['Added', clockTime(job.addedAt)],
			['Picked up', pickedUp],
			[
				running ? 'Running' : 'Worked on',
				running ? `${Math.round(job.progress * 100)}% done` : countOf(job.tries, 'try', 'tries'),
			],
			[
				{ failed: 'Gave up', canceled: 'Canceled' }[job.status] || 'Finished',
				job.endedAt ? clockTime(job.endedAt) : 'not yet',
			],
		];
		const reached = stepReached(job);
		return steps
			.map(([label, hint], index) => {
				const past = index < reached;
				const here = index === reached;
				const spoken = past ? ', done' : here ? ', current step' : ', not started';
				return (
					`<li class="basalt-steps-item${past ? ' is-done' : ''}${here ? ' is-current' : ''}"${here ? ' aria-current="step"' : ''}>` +
					`<span class="basalt-steps-dot" aria-hidden="true"><i class="bi bi-check-lg"></i><span class="basalt-steps-num">${index + 1}</span></span>` +
					`<span class="basalt-steps-text"><span class="basalt-steps-label">${label}</span><span class="basalt-steps-hint">${hint}</span><span class="visually-hidden">${spoken}</span></span>` +
					'</li>'
				);
			})
			.join('');
	}

	function logMarkup(job) {
		const queue = QUEUE_BY_KEY[job.queue];
		let entries = job.log;
		if (!entries.length) {
			const reason = queue.paused
				? 'the queue is paused'
				: queue.stalled
					? 'the queue is stalled'
					: 'next in line';
			entries = [{ tone: 'wait', at: job.addedAt, headline: 'Waiting for a free worker', detail: reason }];
		}
		return entries
			.map(({ tone, at, headline, detail }) => {
				const { glyph, dot } = LOG_LOOK[tone];
				return `<li><span class="jb-d-attempt-dot${dot}" aria-hidden="true"><i class="bi ${glyph}"></i></span><p class="jb-d-attempt-what">${htmlSafe(headline)}<span class="jb-d-attempt-why">${htmlSafe(detail)}</span></p><span class="jb-d-attempt-time">${clockTime(at)}</span></li>`;
			})
			.join('');
	}

	/* Run a job now: the command menu adds a preset job to its queue. */

	function wireRunMenu() {
		ui.runMenu?.addEventListener('basalt:command', (event) => {
			const choice = event.detail?.value;
			if (!PRESETS[choice]) return;
			window.bootstrap.Modal.getInstance(pick('#jb-run'))?.hide();
			const job = launchPreset(choice);
			const queue = QUEUE_BY_KEY[job.queue];
			notify({
				tone: job.status === 'running' ? 'success' : 'info',
				title: job.title,
				text: `Added to ${queue.title} and ${launchOutcome(job, queue)}`,
				actions: [
					{
						label: 'Open job',
						ghost: true,
						onClick: () => {
							showJob(job.id);
						},
					},
				],
			});
		});
	}

	function launchPreset(choice) {
		const preset = PRESETS[choice];
		const job = createJob(preset.queue, Date.now(), {
			title: preset.title,
			payload: preset.payload,
			trigger: 'You, just now',
		});
		jobs.unshift(job);
		staffQueue(QUEUE_BY_KEY[preset.queue]);
		listedUntil = Math.max(listedUntil, job.addedAt);
		view.page = 1;
		refresh();
		paintList({ fresh: [job.id] });
		return job;
	}

	function launchOutcome(job, queue) {
		if (job.status === 'running') return 'is running now.';
		if (queue.paused) return `is waiting: ${queue.title} is paused.`;
		if (queue.stalled) return `is waiting: ${queue.title} is stalled.`;
		return 'is waiting for a free worker.';
	}

	/* The live beat: every two seconds jobs progress, finish or fail, new
     work arrives and the newest chart bar grows. */

	function wireLive() {
		ui.liveButton.addEventListener('click', () => {
			setLiveUpdates(!liveOn);
			say(liveOn ? 'Live updates on.' : 'Live updates paused. Numbers stay as they are until you resume.');
		});
		document.addEventListener('visibilitychange', scheduleBeats);
	}

	function setLiveUpdates(on) {
		liveOn = on;
		ui.liveButton.setAttribute('aria-pressed', String(!on));
		pick('[data-jb-live-label]', ui.liveButton).textContent = on ? 'Pause live updates' : 'Resume live updates';
		pick('.bi', ui.liveButton).className = `bi ${on ? 'bi-pause-circle' : 'bi-play-circle'} me-1`;
		ui.livePill.className = `basalt-status basalt-status-dot ${on ? `basalt-status-success${calmMotion.matches ? '' : ' basalt-status-live'}` : 'basalt-status-warning'}`;
		ui.livePill.textContent = on ? 'Live' : 'Paused';
		scheduleBeats();
	}

	/* The beat stops while the tab is hidden or live updates are paused. */
	function scheduleBeats() {
		clearInterval(beatTimer);
		beatTimer = 0;
		if (liveOn && !document.hidden) beatTimer = setInterval(advanceClock, BEAT_MS);
	}

	function advanceClock() {
		const now = Date.now();
		const outcome = progressRunningJobs(now);
		admitNewWork(now);
		growLatestBar(now, outcome);
		feedLiveChart();
		refresh();
		followOpenPanel();
	}

	/** Moves every running job along; returns how many finished and failed. */
	function progressRunningJobs(now) {
		const outcome = { finished: 0, failed: 0 };
		for (const job of jobs) {
			if (job.status !== 'running') continue;
			const [shortest, longest] = RUN_SECONDS[job.queue];
			const expected = Math.max(6, ((shortest + longest) / 2) * 1.6);
			job.progress = Math.min(1, job.progress + (BEAT_MS / 1000 / expected) * (0.6 + random() * 0.8));
			if (job.progress < 1) continue;
			const seconds = (now - job.startedAt) / 1000;
			if (random() < 0.035) {
				failAttempt(job, now, seconds, outcome);
				continue;
			}
			Object.assign(job, { status: 'done', progress: 1, seconds, endedAt: now });
			job.log.push({
				tone: 'ok',
				at: now,
				headline: `Try ${job.tries} finished`,
				detail: `took ${formatDuration(seconds)}`,
			});
			QUEUE_BY_KEY[job.queue].finished += 1;
			outcome.finished += 1;
		}
		return outcome;
	}

	/* A failed try either waits for its next go or, on the last try, gives up. */
	function failAttempt(job, now, seconds, outcome) {
		const failure = FAILURES[job.queue];
		job.log.push({ tone: 'bad', at: now, headline: `Try ${job.tries} failed`, detail: failure.summary });
		if (job.tries < job.allowed) {
			Object.assign(job, { status: 'waiting', progress: 0, nextTryAt: now + retryWait(job.tries) * MINUTE_MS });
			return;
		}
		Object.assign(job, { status: 'failed', endedAt: now, seconds });
		outcome.failed += 1;
		notify({
			tone: 'danger',
			title: 'A job gave up',
			text: `${job.title}: ${failure.summary}.`,
			actions: [{ label: 'Open job', ghost: true, onClick: () => showJob(job.id) }],
		});
	}

	/* New work arrives, most of it for the busy queues, and idle workers take it. */
	function admitNewWork(now) {
		for (const queue of QUEUES) {
			const chance = Math.min(0.9, (queue.workers * queue.perWorker) / 30);
			const waiting = jobs.filter((job) => job.queue === queue.key && job.status === 'waiting').length;
			if (waiting < 16 && random() < chance) jobs.unshift(createJob(queue.key, now));
			staffQueue(queue);
			queue.perMinute = samplePace(queue);
			queue.finished += isWorking(queue) ? Math.round(queue.perMinute / 30) : 0;
		}
	}

	/* The bar for the current minute grows; a new minute starts a new bar. */
	function growLatestBar(now, outcome) {
		const series = trend['30m'];
		const minute = clockTime(now);
		if (series.labels.at(-1) !== minute) {
			for (const [list, value] of [
				[series.labels, minute],
				[series.finished, 0],
				[series.failed, 0],
			]) {
				list.push(value);
				list.shift();
			}
		}
		const last = series.finished.length - 1;
		series.finished[last] += Math.round(totalPace() / 30 + outcome.finished);
		series.failed[last] += outcome.failed;
	}

	/* Keeps an open panel in step with its job. When a foot button stops
     applying and hides, focus moves to Close instead of being lost. */
	function followOpenPanel() {
		if (!panelJob || !ui.panel.classList.contains('show')) return;
		const fill = pick('.jb-progress > span', pick('[data-jb-d="status"]', ui.panel));
		if (panelJob.status === 'running' && fill) {
			moveProgress(fill, panelJob.progress);
			return;
		}
		if (ui.panel.getAttribute('data-jb-status') === panelJob.status) return;
		paintPanel(panelJob);
		if (ui.panel.contains(document.activeElement) && !document.activeElement.offsetParent)
			pick('.btn-close', ui.panel).focus();
	}

	/* Seeded randomness. mulberry32 is small and fast and repeats the same
     sequence on every load. */

	function mulberry(seed) {
		let state = seed;
		return () => {
			state |= 0;
			state = (state + 0x6d2b79f5) | 0;
			let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
			mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	function pickFrom(list) {
		return list[Math.floor(random() * list.length)];
	}

	function intBetween(low, high) {
		return low + Math.floor(random() * (high - low + 1));
	}

	function hexDigits(count) {
		return Array.from({ length: count }, () => Math.floor(random() * 16).toString(16)).join('');
	}

	function orderNumber() {
		return `#${intBetween(48210, 48340)}`;
	}

	/** A plausible address from a name: accents dropped, other characters dotted. */
	function inboxFor(person) {
		const local = person
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z]+/g, '.');
		return `${local}@gmail.com`;
	}

	/* Words for times, durations and counts. */

	function twoDigits(value) {
		return String(value).padStart(2, '0');
	}

	function clockTime(ms) {
		const moment = new Date(ms);
		const hours = moment.getHours();
		return `${hours % 12 || 12}:${twoDigits(moment.getMinutes())}${hours < 12 ? ' am' : ' pm'}`;
	}

	function timeAgo(ms) {
		const minutes = Math.round((Date.now() - ms) / MINUTE_MS);
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes} min ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours} h ago`;
		return `${Math.floor(hours / 24)} d ago`;
	}

	function timeUntil(ms) {
		const minutes = Math.max(1, Math.round(ms / MINUTE_MS));
		if (minutes < 60) return `in ${minutes} min`;
		const hours = Math.floor(minutes / 60);
		if (hours >= 24) return `in ${countOf(Math.round(hours / 24), 'day')}`;
		const rest = minutes % 60;
		return `in ${hours} h${rest ? ` ${rest} min` : ''}`;
	}

	function formatDuration(seconds) {
		if (seconds == null) return '';
		if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`;
		if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
		return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
	}

	function countOf(amount, word, wordPlural = `${word}s`) {
		return `${amount} ${amount === 1 ? word : wordPlural}`;
	}

	function whole(value) {
		return Math.round(value).toLocaleString('en-US');
	}

	function sumOf(values) {
		return values.reduce((total, value) => total + value, 0);
	}

	/* Page plumbing: lookups, escaping and the shared toast and announcer. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(text) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(text).replace(/[&<>"']/g, (char) => entities[char]);
	}

	function say(text) {
		window.Basalt.announce?.(text);
	}

	function notify(options) {
		return window.Basalt.toasts?.push(options);
	}

	start();
})();
