/**
 * Runs maintenance-windows.html, where the Marlo team takes the shop offline and
 * brings it back, books closures ahead of time, writes the notice shoppers get,
 * keeps the list of who may still come in, ticks off a pre-close checklist and
 * reads the log of past closures. Every figure is drawn from fixed-seed random
 * numbers, so nothing is fetched and each load matches the one before. The
 * demo clock begins at 10:24 am on Tuesday, September 29, 2026 and then moves
 * at normal speed; a real install would read the shop's own clock and settings.
 */
(() => {
	'use strict';

	const root = pick('[data-mm-root]');
	if (!root) return;

	/* Fixed facts the whole page leans on: where the demo clock starts, the
     chart's typeface, and whether the visitor asked for less movement. */
	const CLOCK_ORIGIN = new Date(2026, 8, 29, 10, 24, 0).getTime();
	const DEMO_DAY = new Date(2026, 8, 29);
	const loadedAt = Date.now();
	const stillMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const CHART_TYPEFACE = "'Schibsted Grotesk', sans-serif";
	const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const VISITORS_PER_ORDER = 14;
	const OWN_ADDRESS = '203.0.113.88';
	const PREVIEW_BASE = 'https://shop.example.com/?preview=';
	const TOKEN_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
	const IPV4_PATTERN = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

	/* Each stream of made-up numbers has its own seed, so the door tally, the
     preview tokens and the log never pull from one another. */
	const doorRandom = makeRandom(20260929);
	const tokenRandom = makeRandom(4410);
	const ORDERS_BY_HOUR = buildHourlyCurves();

	/* The labels and colors a closure gets, keyed by what it shuts. */
	const CLOSING_KINDS = {
		all: { label: 'Whole shop', tone: 'warning' },
		checkout: { label: 'Checkout', tone: 'info' },
		subs: { label: 'Renewals', tone: 'primary' },
	};

	const STAFF = [
		{ name: 'Elaine Zeller', role: 'Shop manager', email: 'elaine@marlo.com' },
		{ name: 'Derek Haas', role: 'Web developer', email: 'derek@marlo.com' },
		{ name: 'Lindsay Kinney', role: 'Customer care', email: 'connie@marlo.com' },
		{ name: 'Tom Becker', role: 'Warehouse lead', email: 'tom@marlo.com' },
		{ name: 'Dawn Knapp', role: 'Tailoring buyer', email: 'dawn@marlo.com' },
		{ name: 'Rory Nugent', role: 'Marketing', email: 'rory@marlo.com' },
		{ name: 'Carly McCall', role: 'Photographer', email: 'carly@marlo.com' },
		{ name: 'Ruth Adler', role: 'Bookkeeper', email: 'ruth@marlo.com' },
	];

	const MESSAGE_PRESETS = {
		quick: {
			headline: 'Back in a few minutes',
			body: "We're fixing a small thing behind the scenes. Your basket is saved, so nothing is lost. Thanks for waiting.",
		},
		upgrade: {
			headline: "We're putting up the new shop",
			body: 'The new shop has quicker reorders and better size guides. Your account and past orders come across with you.',
		},
		count: {
			headline: 'Counting every blazer and pair',
			body: "We're doing our stocktake so the shop only shows what's really on the shelf. Aftercare Plan renewals still go through as normal.",
		},
	};

	const BEFORE_CLOSING = [
		{ task: 'Tell the fleet accounts', hint: 'Nine fleet accounts reorder on Monday mornings', startsTicked: true },
		{ task: 'Pause subscription renewals', hint: 'Or pick Renewals above to hold only those', startsTicked: true },
		{ task: 'Pause the paid ads', hint: 'No point paying for clicks to a closed door', startsTicked: false },
		{
			task: 'Check nobody is halfway through paying',
			hint: '3 baskets are at checkout right now',
			startsTicked: false,
		},
		{ task: "Download today's orders", hint: 'Packing carries on while the shop is closed', startsTicked: false },
		{ task: 'Put a note on Instagram', hint: 'Say when you will be back', startsTicked: false },
	];

	const PLANNED_REASONS = [
		'Warehouse stocktake',
		'New product pages',
		'Update the shipping rates',
		'Swap in the new autumn photos',
		'Change subscription plans',
		'Faster search',
		'Tax settings for the new year',
		'New shop theme',
		'Price change on silk gowns',
		'Move to the new stock system',
		'Holiday gift boxes go live',
	];
	const UNPLANNED_REASONS = [
		'Checkout errors after an update',
		'Card payments down at the provider',
		'Stock counts wrong after an import',
		'Shipping labels failing',
		'Shop very slow during the sale',
		'A discount code was being misused',
	];
	const ON_CALL = ['Elaine Zeller', 'Derek Haas', 'Tom Becker', 'Lindsay Kinney'];

	/* Everything that changes while the page is open. */
	const shop = {
		isOpen: true,
		closedSince: null,
		plannedMinutes: 45,
		closing: 'all',
		door: { turnedAway: 0, letIn: 0, emails: 0 },
		windows: [
			{
				id: 1,
				reason: 'Warehouse stocktake',
				startsAt: new Date(2026, 9, 3, 23, 30),
				minutes: 135,
				closing: 'all',
				notice: true,
				mailout: false,
			},
			{
				id: 2,
				reason: 'Move card payments to the new provider',
				startsAt: new Date(2026, 9, 14, 5, 0),
				minutes: 60,
				closing: 'checkout',
				notice: true,
				mailout: true,
			},
			{
				id: 3,
				reason: 'New add-on prices for 2027',
				startsAt: new Date(2026, 10, 2, 2, 0),
				minutes: 30,
				closing: 'subs',
				notice: false,
				mailout: true,
			},
		],
		nextWindowId: 4,
		guests: STAFF.slice(0, 4).map((member) => ({ ...member })),
		addresses: [
			{ ip: '203.0.113.24', label: 'Packing room' },
			{ ip: '198.51.100.7', label: 'Warehouse office' },
			{ ip: '192.0.2.61', label: 'Derek at home' },
		],
		log: buildPastLog(),
	};
	const quietView = { days: 'weekday', hours: 2 };
	const logView = { origin: 'all', unfolded: new Set(), paging: null, loading: true };
	let savedMessage = {
		preset: 'quick',
		headline: MESSAGE_PRESETS.quick.headline,
		body: MESSAGE_PRESETS.quick.body,
		time: true,
		email: true,
		social: false,
	};
	let doorTimer = 0;
	let typingPause = 0;
	let quietChart = null;
	let editingWindow = null;
	let drawerReturn = null;
	let linkIssuedAt = demoNow();

	/* The nodes each part of the page works on, grouped by card. */
	const [liveCard, lengthInput, ringBar] = hooks(root, '[data-mm-live]', '[data-mm-length]', '[data-mm-ring-bar]');
	const [chartCanvas, hoursInput] = hooks(root, '[data-mm-chart]', '[data-mm-need]');
	const [windowList, windowsEmpty] = hooks(root, '[data-mm-plans]', '[data-mm-plans-empty]');
	const [messageForm, checklistBox, checklist] = hooks(
		root,
		'[data-mm-msg-form]',
		'[data-mm-check]',
		'[data-mm-check-list]',
	);
	const [guestList, guestForm, guestInput, guestError] = hooks(
		root,
		'[data-mm-people]',
		'[data-mm-person-form]',
		'[data-mm-person]',
		'[data-mm-person-error]',
	);
	const [addressList, addressForm, addressInput, addressLabel, addressError] = hooks(
		root,
		'[data-mm-places]',
		'[data-mm-ip-form]',
		'[data-mm-ip]',
		'[data-mm-ip-name]',
		'[data-mm-ip-error]',
	);
	const [linkInput, lifeSelect, linkNote] = hooks(
		root,
		'[data-mm-link]',
		'[data-mm-link-life]',
		'[data-mm-link-note]',
	);
	const closeDialog = document.getElementById('mm-close-dialog');
	const planDrawer = document.getElementById('mm-plan-drawer');
	const [planForm] = hooks(planDrawer, '[data-mm-plan-form]');
	const planFields = hookMap(planDrawer, {
		reason: '[data-mm-plan-reason]',
		date: '[data-mm-plan-date]',
		time: '[data-mm-plan-time]',
		minutes: '[data-mm-plan-len]',
		clash: '[data-mm-plan-clash]',
		clashText: '[data-mm-plan-clash-text]',
		ends: '[data-mm-plan-ends]',
		save: '[data-mm-plan-save]',
	});
	const note = hookMap(root, {
		headline: '[data-mm-headline]',
		body: '[data-mm-body]',
		frame: '[data-mm-frame]',
		status: '[data-mm-msg-state]',
		showTime: '[data-mm-show-time]',
		askEmail: '[data-mm-ask-email]',
		showSocial: '[data-mm-show-social]',
		undo: '[data-mm-msg-reset]',
		save: '[data-mm-msg-save]',
		test: '[data-mm-msg-test]',
	});
	const logUi = hookMap(root, {
		body: '[data-mm-hist-body]',
		empty: '[data-mm-hist-empty]',
		search: '[data-mm-hist-search]',
		panel: '[data-mm-hist-panel]',
		rowsPerPage: '[data-mm-per]',
		range: '[data-mm-range]',
		pages: '[data-mm-pages]',
		pager: '[data-mm-pager]',
	});

	/* Chart.js plugin that shades the quiet hours behind their bars, so the
     stretch still reads where the bars are only a few pixels tall. */
	const quietBand = {
		id: 'mmBand',
		beforeDatasetsDraw(chart) {
			const { hours } = quietSelection();
			const axis = chart.scales.x;
			const { top, bottom } = chart.chartArea;
			const barWidth = axis.getPixelForValue(1) - axis.getPixelForValue(0);
			const pen = chart.ctx;
			pen.save();
			pen.fillStyle = translucent(chartColors().calm, 0.16);
			for (const hour of hours) {
				pen.fillRect(axis.getPixelForValue(hour) - barWidth / 2, top, barWidth, bottom - top);
			}
			pen.restore();
		},
	};

	/** Binds every card in page order, then paints the first frame. */
	function start() {
		if (liveCard) wireDoor();
		if (closeDialog) wireCloseDialog();
		if (chartCanvas) wireQuietHours();
		wireWindows();
		wireDrawer();
		if (messageForm) wireMessage();
		wireAccess();
		wirePrivateLink();
		if (checklist) wireChecklist();
		if (logUi.body) wireLog();
		renderWindows();
		renderAccess();
		paintDoor();
		for (const list of [windowList, guestList, checklist]) playOnSight(list);
	}

	/* The open or closed card: its controls, the sign and the running tally. */

	function wireDoor() {
		lengthInput.addEventListener('change', settleLength);
		lengthInput.addEventListener('input', previewLength);
		for (const option of pickAll('input[name="mm-scope"]', liveCard)) {
			option.addEventListener('change', () => {
				if (!option.checked) return;
				shop.closing = option.value;
				showClosingCost();
			});
		}
		const reopenButton = pick('[data-mm-reopen]', liveCard);
		reopenButton.addEventListener('click', () => reopenByHand(reopenButton));
		pick('[data-mm-extend]', liveCard).addEventListener('click', addFifteenMinutes);
		/* The sign's return time keeps moving while the doors are open. */
		setInterval(() => {
			if (shop.isOpen) refreshBackBy();
		}, 15000);
	}

	/** Rounds a typed length to the nearest quarter hour within 15 to 240. */
	function settleLength() {
		const typed = parseInt(lengthInput.value, 10) || 45;
		const minutes = Math.min(240, Math.max(15, Math.round(typed / 15) * 15));
		lengthInput.value = minutes;
		shop.plannedMinutes = minutes;
		paintDoor();
	}

	function previewLength() {
		const minutes = parseInt(lengthInput.value, 10);
		if (!(minutes >= 15 && minutes <= 240)) return;
		shop.plannedMinutes = minutes;
		showClosingCost();
		refreshBackBy();
	}

	function reopenByHand(button) {
		if (button.classList.contains('is-loading')) return;
		setButtonPhase(button, 'loading');
		setTimeout(() => {
			setButtonPhase(button, 'success');
			setTimeout(
				() => {
					setButtonPhase(button, 'idle');
					reopen(true);
				},
				stillMotion ? 0 : 600,
			);
		}, 900);
	}

	function addFifteenMinutes() {
		shop.plannedMinutes += 15;
		paintDoor();
		notify({
			tone: 'info',
			icon: 'bi-clock',
			title: 'Fifteen more minutes',
			text: `${backByText()} now. The message shows the new time.`,
		});
	}

	/** Brings every part of the card in line with the open or closed state. */
	function paintDoor() {
		const doorsOpen = shop.isOpen;
		liveCard.setAttribute('data-state', doorsOpen ? 'open' : 'closed');
		for (const node of pickAll('[data-mm-open-only]', liveCard)) node.hidden = !doorsOpen;
		for (const node of pickAll('[data-mm-closed-only]', liveCard)) node.hidden = doorsOpen;

		const doorBadge = pick('[data-mm-pill]', liveCard);
		doorBadge.textContent = doorsOpen ? 'Open' : 'Closed for maintenance';
		doorBadge.className = `basalt-status basalt-status-dot ${doorsOpen ? 'basalt-status-success' : 'basalt-status-warning basalt-status-live'}`;
		pick('[data-mm-live-title]', liveCard).textContent = doorsOpen ? 'The shop is open' : 'The shop is closed';
		pick('[data-mm-live-lede]', liveCard).textContent = doorsOpen
			? 'Customers can browse and check out as normal. Choose what to close and for how long, and you will see what it costs before you do it.'
			: closedLede();
		pick('[data-mm-sign-note]', liveCard).textContent = doorsOpen
			? 'What customers see at the door'
			: 'Customers see this until you reopen';
		refreshBackBy();
		showClosingCost();
		tickDoor();
	}

	function closedLede() {
		const shut = { all: 'the shop', checkout: 'checkout', subs: 'subscription renewals' }[shop.closing];
		const allowed = shop.guests.length + shop.addresses.length;
		return `Customers see your message in place of ${shut}, and ${countOf(allowed, 'person or place', 'people and places')} on the access list can still get in. ${backByText()}.`;
	}

	/** Says what closing right now would cost, in words that fit what closes. */
	function showClosingCost() {
		const moment = demoNow();
		const curve = curveFor(moment);
		const orders = expectedOrders(curve, minuteOfDay(moment), shop.plannedMinutes);
		const visitors = Math.round(orders * VISITORS_PER_ORDER);
		const orderCount = Math.max(1, Math.round(orders));
		const hoursNeeded = Math.max(1, Math.ceil(shop.plannedMinutes / 60));
		const calm = calmestStretch(curve, hoursNeeded);
		const impactLine = pick('[data-mm-impact]', root);
		if (!impactLine) return;
		const sentences = {
			all: () =>
				`Closing now for ${durationLabel(shop.plannedMinutes)} would turn away about <strong>${visitors} visitors</strong> and <strong>${countOf(orderCount, 'order', 'orders')}</strong>. The quietest stretch today is ${hourLabel(calm.firstHour)} to ${hourLabel(calm.firstHour + hoursNeeded)}.`,
			checkout: () =>
				`People can still browse, but about <strong>${countOf(orderCount, 'order', 'orders')}</strong> would wait for checkout. Baskets are kept, so most people come back.`,
			subs: () =>
				`Only subscription renewals pause. About <strong>${countOf(Math.max(1, Math.round(shop.plannedMinutes / 25)), 'renewal', 'renewals')}</strong> fall in the next ${durationLabel(shop.plannedMinutes)} and go through when you reopen.`,
		};
		impactLine.innerHTML = (sentences[shop.closing] || sentences.subs)();
	}

	function refreshBackBy() {
		const returnText = backByText();
		for (const selector of ['[data-mm-sign-back]', '[data-mm-pv-time-text]']) {
			const slotNode = pick(selector, root);
			if (slotNode) slotNode.textContent = returnText;
		}
	}

	function backByText() {
		return `Back by ${timeLabel(later(shop.isOpen ? demoNow() : shop.closedSince, shop.plannedMinutes))}`;
	}

	/** Runs once a second while closed: moves the ring and counts arrivals. */
	function tickDoor() {
		if (shop.isOpen) {
			refreshBackBy();
			return;
		}
		const elapsed = (demoNow() - shop.closedSince) / 60000;
		const share = Math.min(100, (elapsed / shop.plannedMinutes) * 100);
		ringBar?.style.setProperty('--value', share.toFixed(1));
		const wholeMinutes = Math.floor(elapsed);
		const seconds = Math.floor((elapsed - wholeMinutes) * 60);
		pick('[data-mm-ring-value]', root).textContent = `${wholeMinutes}:${twoDigits(seconds)}`;
		const overrun = elapsed > shop.plannedMinutes;
		pick('[data-mm-ring]', root).classList.toggle('is-over', overrun);
		pick('[data-mm-ring-caption]', root).textContent = overrun
			? `over by ${Math.ceil(elapsed - shop.plannedMinutes)} min`
			: `of ${shop.plannedMinutes} min`;
		countArrivals();
	}

	/* A few shoppers a minute reach the closed door, and some leave an email. */
	function countArrivals() {
		const roll = doorRandom();
		if (roll < 0.34) shop.door.turnedAway += 1;
		if (roll > 0.9) shop.door.letIn += 1;
		if (roll > 0.12 && roll < 0.2) shop.door.emails += 1;
		pick('[data-mm-tally-away]', root).textContent = shop.door.turnedAway;
		pick('[data-mm-tally-in]', root).textContent = shop.door.letIn;
		pick('[data-mm-tally-email]', root).textContent = shop.door.emails;
	}

	function closeShop() {
		shop.isOpen = false;
		shop.closedSince = demoNow();
		shop.door = { turnedAway: 0, letIn: 0, emails: 0 };
		paintDoor();
		clearInterval(doorTimer);
		doorTimer = setInterval(tickDoor, 1000);
		const reopenButton = pick('[data-mm-reopen]', liveCard);
		notify({
			tone: 'warning',
			icon: 'bi-door-closed',
			title: 'The shop is closed',
			text: `Customers now see your message. ${backByText()}.`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						reopen(false);
					},
				},
			],
		});
		if (reopenButton) reopenButton.focus();
	}

	/**
	 * Opens the doors again. With `keep` the closure goes into the log;
	 * without it (the Undo on the closing toast) it leaves no trace.
	 */
	function reopen(keep) {
		if (shop.isOpen) return;
		const minutes = Math.max(1, Math.round((demoNow() - shop.closedSince) / 60000));
		if (keep) {
			shop.log.unshift(closureByHand(minutes));
			renderLog(true);
		}
		shop.isOpen = true;
		shop.closedSince = null;
		clearInterval(doorTimer);
		paintDoor();
		pick('[data-mm-live] .btn[data-bs-target="#mm-close-dialog"]', root)?.focus();
		if (!keep) {
			notify({
				tone: 'info',
				title: 'Still open',
				text: 'The shop was reopened straight away. Nothing was added to the history.',
			});
			return;
		}
		notify({
			tone: 'success',
			icon: 'bi-door-open',
			title: 'The shop is open again',
			text: `Closed for ${durationLabel(minutes)}. It is in the history below.`,
		});
	}

	function closureByHand(minutes) {
		const closedFrom = shop.closedSince;
		return {
			id: `h${Date.now()}`,
			startsAt: closedFrom,
			minutes,
			origin: 'urgent',
			reason: 'Closed by hand from this page',
			by: 'John Armstrong',
			closing: shop.closing,
			missed: Math.round(expectedOrders(ORDERS_BY_HOUR.weekday, minuteOfDay(closedFrom), minutes)),
			overBy: Math.max(0, minutes - shop.plannedMinutes),
			timeline: [
				{ at: closedFrom, note: `Closed by John Armstrong for ${durationLabel(shop.plannedMinutes)}` },
				{
					at: demoNow(),
					note: `Reopened. ${countOf(shop.door.turnedAway, 'visitor', 'visitors')} saw the message and ${shop.door.emails} left an email`,
				},
			],
		};
	}

	/* The hold-to-close dialog. */

	function wireCloseDialog() {
		closeDialog.addEventListener('show.bs.modal', fillCloseDialog);
		closeDialog.addEventListener('basalt:confirm', (event) => {
			if (!event.target.matches('[data-mm-close-hold]')) return;
			setTimeout(
				() => {
					window.bootstrap?.Modal.getInstance(closeDialog)?.hide();
				},
				stillMotion ? 0 : 450,
			);
			closeDialog.addEventListener('hidden.bs.modal', closeShop, { once: true });
		});
	}

	function fillCloseDialog() {
		const moment = demoNow();
		const typicalOrders = Math.max(
			1,
			Math.round(expectedOrders(ORDERS_BY_HOUR.weekday, minuteOfDay(moment), shop.plannedMinutes)),
		);
		const allowed = shop.guests.length + shop.addresses.length;
		const headline = {
			all: 'The whole shop closes',
			checkout: 'Checkout closes; people can still browse',
			subs: 'Subscription renewals pause',
		}[shop.closing];
		pick('[data-mm-close-text]', closeDialog).textContent =
			shop.closing === 'all'
				? 'Customers see your message instead of the shop until you reopen it.'
				: 'Customers see your message when they reach the closed part.';
		const facts = [
			{ icon: 'bi-door-closed', line: `${headline} for about ${durationLabel(shop.plannedMinutes)}` },
			{
				icon: 'bi-people',
				line: `${countOf(allowed, 'person or place', 'people and places')} on the access list can still get in`,
			},
			{
				icon: 'bi-bag',
				line: `About ${countOf(typicalOrders, 'order', 'orders')} usually come in during that time`,
			},
		];
		pick('[data-mm-close-list]', closeDialog).innerHTML = facts
			.map(({ icon, line }) => `<li><i aria-hidden="true" class="bi ${icon}"></i>${htmlSafe(line)}</li>`)
			.join('');
	}

	/* The quiet-hours chart and the sentence under it. */

	function wireQuietHours() {
		describeQuietHours();
		if ('IntersectionObserver' in window) {
			const watcher = new IntersectionObserver(
				(sightings) => {
					if (!sightings.some((sighting) => sighting.isIntersecting)) return;
					watcher.disconnect();
					drawChart(true);
				},
				{ rootMargin: '80px 0px' },
			);
			watcher.observe(chartCanvas);
		} else {
			drawChart(false);
		}
		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() => {
				if (quietChart) drawChart(false);
			});
		});
		for (const option of pickAll('input[name="mm-day"]', root)) {
			option.addEventListener('change', () => {
				if (!option.checked) return;
				quietView.days = option.value;
				refreshChart();
			});
		}
		hoursInput.addEventListener('change', () => {
			const hours = Math.min(4, Math.max(1, parseInt(hoursInput.value, 10) || 2));
			hoursInput.value = hours;
			quietView.hours = hours;
			refreshChart();
		});
		pick('[data-mm-quiet-use]', root).addEventListener('click', (event) => planQuietStretch(event.currentTarget));
	}

	/** Opens the drawer on the next matching day at the quietest hour. */
	function planQuietStretch(opener) {
		const { stretch } = quietSelection();
		const wanted = { weekday: [1, 2, 3, 4, 5], sat: [6], sun: [0] }[quietView.days];
		const day = new Date(DEMO_DAY);
		do {
			day.setDate(day.getDate() + 1);
		} while (!wanted.includes(day.getDay()));
		showPlanDrawer(null, { date: day, hour: stretch.firstHour, minutes: quietView.hours * 60 }, opener);
	}

	function quietSelection() {
		const curve = ORDERS_BY_HOUR[quietView.days];
		const stretch = calmestStretch(curve, quietView.hours);
		const hours = Array.from({ length: quietView.hours }, (_, offset) => (stretch.firstHour + offset) % 24);
		return { curve, stretch, hours };
	}

	function barFills(tones, hours) {
		return ORDERS_BY_HOUR[quietView.days].map((_, hour) =>
			hours.includes(hour) ? tones.calm : translucent(tones.busy, 0.55),
		);
	}

	function drawChart(animate) {
		if (!chartCanvas || typeof Chart === 'undefined') return;
		quietChart?.destroy();
		const tones = chartColors();
		const { curve, hours } = quietSelection();
		const tickStyle = { color: tones.quiet, font: { family: CHART_TYPEFACE, size: 11.5 }, padding: 6 };
		quietChart = new Chart(chartCanvas, {
			type: 'bar',
			plugins: [quietBand],
			data: {
				labels: curve.map((_, hour) => hourLabel(hour)),
				datasets: [
					{
						label: 'Average orders',
						data: curve.slice(),
						backgroundColor: barFills(tones, hours),
						hoverBackgroundColor: barFills(tones, hours),
						borderRadius: 5,
						borderSkipped: false,
						barPercentage: 0.78,
						categoryPercentage: 0.9,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: animate && !stillMotion ? { duration: 500, easing: 'easeOutQuart' } : false,
				plugins: { legend: { display: false }, tooltip: chartTooltip(tones) },
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, ...tickStyle },
					},
					y: {
						beginAtZero: true,
						grid: { color: tones.grid },
						border: { display: false },
						ticks: { maxTicksLimit: 5, ...tickStyle },
					},
				},
			},
		});
	}

	function chartTooltip(tones) {
		return {
			backgroundColor: tones.surface,
			titleColor: tones.text,
			bodyColor: tones.text,
			borderColor: tones.border,
			borderWidth: 1,
			padding: 10,
			cornerRadius: 8,
			displayColors: false,
			titleFont: { family: CHART_TYPEFACE, size: 12, weight: '600' },
			bodyFont: { family: CHART_TYPEFACE, size: 12 },
			callbacks: {
				title: ([hovered]) => `${hourLabel(hovered.dataIndex)} to ${hourLabel(hovered.dataIndex + 1)}`,
				label: (point) =>
					`${point.raw} orders on average, about ${Math.round(point.raw * VISITORS_PER_ORDER)} visitors`,
			},
		};
	}

	function describeQuietHours() {
		const { stretch } = quietSelection();
		const dayWords = { weekday: 'on weekdays', sat: 'on Saturdays', sun: 'on Sundays' }[quietView.days];
		const roundedOrders = Math.round(stretch.orders * 10) / 10;
		const summary = pick('[data-mm-quiet-text]', root);
		summary.innerHTML = `Quietest ${countOf(quietView.hours, 'hour', 'hours')} ${dayWords}: <strong>${hourLabel(stretch.firstHour)} to ${hourLabel(stretch.firstHour + quietView.hours)}</strong>, about ${roundedOrders} orders and ${Math.round(roundedOrders * VISITORS_PER_ORDER)} visitors.`;
		chartCanvas?.setAttribute('aria-label', `Average orders by hour ${dayWords}. ${summary.textContent}`);
	}

	function refreshChart() {
		describeQuietHours();
		if (!quietChart) return;
		const tones = chartColors();
		const { curve, hours } = quietSelection();
		const dataset = quietChart.data.datasets[0];
		dataset.data = curve.slice();
		dataset.backgroundColor = barFills(tones, hours);
		dataset.hoverBackgroundColor = dataset.backgroundColor;
		quietChart.update(stillMotion ? 'none' : undefined);
	}

	/* Upcoming closures, listed by start time. */

	function wireWindows() {
		windowList.addEventListener('click', (event) => {
			const card = event.target.closest('.mm-plan');
			if (!card) return;
			const id = Number(card.getAttribute('data-id'));
			const index = shop.windows.findIndex((entry) => entry.id === id);
			const editButton = event.target.closest('[data-mm-plan-edit]');
			if (editButton) {
				showPlanDrawer(shop.windows[index], null, editButton);
				return;
			}
			if (event.target.closest('[data-mm-plan-del]')) cancelWindow(index);
		});
	}

	function cancelWindow(index) {
		const [entry] = shop.windows.splice(index, 1);
		renderWindows();
		const deleteButtons = pickAll('[data-mm-plan-del]', windowList);
		(deleteButtons[Math.min(index, shop.windows.length - 1)] || pick('[data-mm-plans-empty] .btn', root)).focus();
		notify({
			tone: 'info',
			icon: 'bi-calendar-x',
			title: 'Window canceled',
			text: `${entry.reason}, ${dateWords(entry.startsAt)}.`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						shop.windows.push(entry);
						renderWindows(entry.id);
					},
				},
			],
		});
	}

	/** Redraws the list; `freshId` briefly outlines the window just saved. */
	function renderWindows(freshId) {
		shop.windows.sort((one, other) => one.startsAt - other.startsAt);
		windowList.innerHTML = shop.windows.map(windowMarkup).join('');
		windowList.hidden = shop.windows.length === 0;
		windowsEmpty.hidden = shop.windows.length > 0;
		if (!freshId) return;
		const fresh = pick(`[data-id="${freshId}"]`, windowList);
		if (!fresh) return;
		fresh.classList.add('is-new');
		setTimeout(() => fresh.classList.remove('is-new'), 2400);
	}

	function windowMarkup(entry) {
		const closingKind = CLOSING_KINDS[entry.closing];
		const reason = htmlSafe(entry.reason);
		const extras = [
			entry.notice
				? '<span><i aria-hidden="true" class="bi bi-megaphone me-1"></i>Notice the day before</span>'
				: '',
			entry.mailout
				? '<span><i aria-hidden="true" class="bi bi-envelope me-1"></i>Subscribers emailed</span>'
				: '',
		].join('');
		const calendarChip = `<span aria-hidden="true" class="mm-plan-date"><span class="mm-plan-dow">${WEEKDAY_SHORT[entry.startsAt.getDay()]}</span><span class="mm-plan-day">${entry.startsAt.getDate()}</span><span class="mm-plan-mon">${MONTH_SHORT[entry.startsAt.getMonth()]}</span></span>`;
		const facts = `<p class="mm-plan-meta"><span>${timeLabel(entry.startsAt)} to ${timeLabel(later(entry.startsAt, entry.minutes))}, ${durationLabel(entry.minutes)}</span><span class="basalt-status basalt-status-${closingKind.tone}">${closingKind.label}</span>${extras}</p>`;
		const tools = `<div class="mm-plan-acts"><button data-mm-plan-edit aria-label="Change ${reason}" type="button" class="mm-icon-btn"><i aria-hidden="true" class="bi bi-pencil"></i></button><button data-mm-plan-del aria-label="Cancel ${reason}" type="button" class="mm-icon-btn mm-icon-btn-danger"><i aria-hidden="true" class="bi bi-trash3"></i></button></div>`;
		return `<li data-id="${entry.id}" class="mm-plan">${calendarChip}<div class="mm-plan-main"><p class="mm-plan-title"><span class="visually-hidden">${htmlSafe(dateWords(entry.startsAt))}: </span>${reason}</p>${facts}</div>${tools}</li>`;
	}

	/* The side drawer that books a new closure or changes one. */

	function wireDrawer() {
		planDrawer.addEventListener('shown.bs.offcanvas', () => planFields.reason.focus());
		planDrawer.addEventListener('hidden.bs.offcanvas', () => {
			if (drawerReturn && drawerReturn.isConnected) drawerReturn.focus();
		});
		for (const formInput of [planFields.date, planFields.time]) {
			formInput.addEventListener('input', () => {
				showReopenTime();
				formInput.classList.remove('is-invalid');
				planFields.clash.hidden = true;
			});
		}
		planFields.minutes.addEventListener('change', () => {
			showReopenTime();
			planFields.clash.hidden = true;
		});
		planFields.minutes.addEventListener('input', showReopenTime);
		planFields.reason.addEventListener('input', () => unflagField(planFields.reason));
		for (const trigger of pickAll('[data-mm-schedule-open]', root)) {
			trigger.addEventListener('click', () => showPlanDrawer(null, null, trigger));
		}
		planForm.addEventListener('submit', savePlan);
	}

	/**
	 * Fills the drawer and shows it. `entry` is the window being changed, or
	 * null for a new one; `preset` carries a day, an hour and a length picked
	 * from the chart; `opener` gets focus back when the drawer closes.
	 */
	function showPlanDrawer(entry, preset, opener) {
		editingWindow = entry;
		planForm.reset();
		clearPlanFlags();
		setButtonPhase(planFields.save, 'idle');
		pick('[data-mm-plan-title]', planDrawer).textContent = entry ? 'Change this window' : 'Plan a window';
		pick('[data-mm-plan-save-label]', planDrawer).textContent = entry ? 'Save changes' : 'Plan window';

		const draft = entry || {
			reason: '',
			minutes: preset ? preset.minutes : 60,
			closing: 'all',
			notice: true,
			mailout: false,
		};
		let startsAt = new Date(2026, 9, 6, 2, 0);
		if (entry) startsAt = entry.startsAt;
		else if (preset)
			startsAt = new Date(
				preset.date.getFullYear(),
				preset.date.getMonth(),
				preset.date.getDate(),
				preset.hour,
				0,
			);

		planFields.reason.value = draft.reason;
		planFields.date.value = dateValue(startsAt);
		planFields.time.value = clockValue(startsAt);
		planFields.minutes.value = draft.minutes;
		for (const option of pickAll('input[name="scope"]', planForm)) {
			option.checked = option.value === draft.closing;
			option.dispatchEvent(new Event('change', { bubbles: true }));
		}
		planForm.elements.banner.checked = draft.notice;
		planForm.elements.email.checked = draft.mailout;
		showReopenTime();
		drawerReturn = opener || null;
		window.bootstrap.Offcanvas.getOrCreateInstance(planDrawer).show();
	}

	function savePlan(event) {
		event.preventDefault();
		if (planFields.save.classList.contains('is-loading')) return;
		clearPlanFlags();
		const missing = [];
		if (!planFields.reason.value.trim()) missing.push(planFields.reason);
		if (!planFields.date.value || planFields.date.value < dateValue(DEMO_DAY)) missing.push(planFields.date);
		if (!planFields.time.value) missing.push(planFields.time);
		for (const formInput of missing) flagField(formInput);
		if (missing.length) {
			missing[0].focus();
			return;
		}

		const startsAt = draftStart();
		const minutes = draftMinutes();
		const endsAt = later(startsAt, minutes);
		const clash = shop.windows.find(
			(other) =>
				other !== editingWindow && startsAt < later(other.startsAt, other.minutes) && endsAt > other.startsAt,
		);
		if (clash) {
			planFields.clashText.textContent = `${clash.reason} runs on ${dateWords(clash.startsAt)} from ${timeLabel(clash.startsAt)} to ${timeLabel(later(clash.startsAt, clash.minutes))}. Move this one, or change that one first.`;
			planFields.clash.hidden = false;
			planFields.date.focus();
			return;
		}
		setButtonPhase(planFields.save, 'loading');
		setTimeout(() => commitPlan(startsAt, minutes, endsAt), 700);
	}

	function commitPlan(startsAt, minutes, endsAt) {
		const details = {
			reason: planFields.reason.value.trim(),
			startsAt,
			minutes,
			closing: pick('input[name="scope"]:checked', planForm)?.value || 'all',
			notice: planForm.elements.banner.checked,
			mailout: planForm.elements.email.checked,
		};
		const changing = Boolean(editingWindow);
		let id = shop.nextWindowId;
		if (changing) {
			Object.assign(editingWindow, details);
			id = editingWindow.id;
		} else {
			shop.nextWindowId += 1;
			shop.windows.push({ id, ...details });
		}
		setButtonPhase(planFields.save, 'success');
		setTimeout(
			() => {
				window.bootstrap.Offcanvas.getOrCreateInstance(planDrawer).hide();
				renderWindows(id);
				notify({
					tone: 'success',
					icon: 'bi-calendar-check',
					title: changing ? 'Window changed' : 'Window planned',
					text: `${dateWords(startsAt)}, ${timeLabel(startsAt)} to ${timeLabel(endsAt)}.${details.notice ? ' Customers get a notice the day before.' : ''}`,
				});
			},
			stillMotion ? 150 : 550,
		);
	}

	function draftStart() {
		if (!planFields.date.value || !planFields.time.value) return null;
		const [year, month, date] = planFields.date.value.split('-').map(Number);
		const [hours, minutes] = planFields.time.value.split(':').map(Number);
		return new Date(year, month - 1, date, hours, minutes);
	}

	function draftMinutes() {
		return Math.min(480, Math.max(15, parseInt(planFields.minutes.value, 10) || 60));
	}

	function showReopenTime() {
		const startsAt = draftStart();
		if (!startsAt) {
			planFields.ends.textContent = '';
			return;
		}
		const endsAt = later(startsAt, draftMinutes());
		const nextDay = endsAt.getDate() !== startsAt.getDate() ? ' the next day' : '';
		planFields.ends.textContent = `Reopens at ${timeLabel(endsAt)}${nextDay}.`;
	}

	function clearPlanFlags() {
		for (const formInput of [planFields.reason, planFields.date, planFields.time]) unflagField(formInput);
		planFields.clash.hidden = true;
	}

	/* The notice shoppers get while the shop is closed, and its live preview. */

	function wireMessage() {
		fillMessage(savedMessage);
		refreshMessage();
		messageForm.addEventListener('input', (event) => {
			if (event.target === note.headline && note.headline.value.trim()) unflagField(note.headline);
			refreshMessage();
		});
		messageForm.addEventListener('change', (event) => {
			if (event.target.name === 'mm-start' && event.target.checked)
				applyPreset(MESSAGE_PRESETS[event.target.value]);
			refreshMessage();
		});
		note.undo.addEventListener('click', undoMessage);
		messageForm.addEventListener('submit', saveMessage);
		note.test.addEventListener('click', sendTestCopy);
		for (const option of pickAll('input[name="mm-device"]', root)) {
			option.addEventListener('change', () => {
				if (option.checked) note.frame.classList.toggle('is-phone', option.value === 'phone');
			});
		}
	}

	function applyPreset(preset) {
		note.headline.value = preset.headline;
		note.body.value = preset.body;
		unflagField(note.headline);
	}

	function undoMessage() {
		fillMessage(savedMessage);
		note.headline.classList.remove('is-invalid');
		refreshMessage();
		note.headline.focus();
		window.Basalt.announce?.('Changes undone. The saved message is back.');
	}

	function saveMessage(event) {
		event.preventDefault();
		if (note.save.classList.contains('is-loading') || !headlineIsValid()) return;
		setButtonPhase(note.save, 'loading');
		setTimeout(() => {
			savedMessage = readMessage();
			messageChanged();
			setButtonPhase(note.save, 'success');
			notify({
				tone: 'success',
				title: 'Message saved',
				text: 'Customers see it the next time the shop closes.',
			});
			setTimeout(() => setButtonPhase(note.save, 'idle'), 1600);
		}, 800);
	}

	function sendTestCopy() {
		if (note.test.classList.contains('is-loading') || !headlineIsValid()) return;
		setButtonPhase(note.test, 'loading');
		setTimeout(() => {
			setButtonPhase(note.test, 'success');
			notify({
				tone: 'success',
				icon: 'bi-envelope-check',
				title: 'Copy sent',
				text: `Check john.armstrong@fieldline.app for “${note.headline.value.trim()}”.`,
			});
			setTimeout(() => setButtonPhase(note.test, 'idle'), 1600);
		}, 1100);
	}

	/** Flags an empty headline and moves focus to it; true when it has text. */
	function headlineIsValid() {
		const filled = Boolean(note.headline.value.trim());
		note.headline.classList.toggle('is-invalid', !filled);
		if (filled) {
			note.headline.removeAttribute('aria-invalid');
			return true;
		}
		note.headline.setAttribute('aria-invalid', 'true');
		note.headline.focus();
		return false;
	}

	function readMessage() {
		return {
			preset: pick('input[name="mm-start"]:checked', messageForm)?.value || '',
			headline: note.headline.value,
			body: note.body.value,
			time: note.showTime.checked,
			email: note.askEmail.checked,
			social: note.showSocial.checked,
		};
	}

	function fillMessage(values) {
		for (const option of pickAll('input[name="mm-start"]', messageForm))
			option.checked = option.value === values.preset;
		note.headline.value = values.headline;
		note.body.value = values.body;
		note.showTime.checked = values.time;
		note.askEmail.checked = values.email;
		note.showSocial.checked = values.social;
	}

	function refreshMessage() {
		showCharacterCounts();
		showPreview();
		messageChanged();
	}

	function showCharacterCounts() {
		for (const countBadge of pickAll('[data-mm-count-for]', root)) {
			const formInput = document.getElementById(countBadge.getAttribute('data-mm-count-for'));
			const limit = parseInt(formInput.getAttribute('maxlength'), 10);
			const typedLength = formInput.value.length;
			countBadge.textContent = `${typedLength} / ${limit}`;
			countBadge.classList.toggle('is-near', typedLength >= limit * 0.9);
		}
	}

	function showPreview() {
		const headline = note.headline.value.trim();
		const shownHeadline = pick('[data-mm-pv-headline]', root);
		shownHeadline.textContent = headline || 'Add a headline';
		shownHeadline.classList.toggle('is-empty', !headline);
		pick('[data-mm-pv-body]', root).textContent = note.body.value.trim();
		pick('[data-mm-pv-time]', root).hidden = !note.showTime.checked;
		pick('[data-mm-pv-email]', root).hidden = !note.askEmail.checked;
		pick('[data-mm-pv-social]', root).hidden = !note.showSocial.checked;
	}

	/** Compares the form with the last save (the preset picked aside). */
	function messageChanged() {
		const onForm = readMessage();
		const changed = Object.entries(savedMessage).some(([key, value]) => key !== 'preset' && onForm[key] !== value);
		note.status.textContent = changed ? 'Not saved yet' : 'Saved';
		note.status.className = `basalt-status basalt-status-dot ${changed ? 'basalt-status-warning' : 'basalt-status-success'}`;
		note.undo.hidden = !changed;
		return changed;
	}

	/* People and connections that still see the real shop while it is closed. */

	function wireAccess() {
		guestList.addEventListener('click', (event) => {
			const button = event.target.closest('[data-mm-remove-person]');
			if (!button) return;
			revokeAccess(
				'guests',
				Number(button.getAttribute('data-mm-remove-person')),
				(guest) => guest.name,
				guestList,
				guestInput,
			);
		});
		addressList.addEventListener('click', (event) => {
			const button = event.target.closest('[data-mm-remove-place]');
			if (!button) return;
			revokeAccess(
				'addresses',
				Number(button.getAttribute('data-mm-remove-place')),
				(address) => address.ip,
				addressList,
				addressInput,
			);
		});
		guestInput.addEventListener('input', () => showFieldError(guestInput, guestError, ''));
		guestForm.addEventListener('submit', addGuest);
		addressInput.addEventListener('input', () => showFieldError(addressInput, addressError, ''));
		addressForm.addEventListener('submit', addAddress);
		pick('[data-mm-ip-mine]', root).addEventListener('click', () => {
			addressInput.value = OWN_ADDRESS;
			if (!addressLabel.value) addressLabel.value = 'This computer';
			showFieldError(addressInput, addressError, '');
			addressLabel.focus();
		});
	}

	function renderAccess() {
		guestList.innerHTML = shop.guests
			.map((guest, index) =>
				accessRow({
					lead: `<span aria-hidden="true" data-name="${htmlSafe(guest.name)}" class="basalt-avatar basalt-avatar-sm"></span>`,
					title: htmlSafe(guest.name),
					titleClass: 'mm-person-name',
					detail: `${htmlSafe(guest.role)}, ${htmlSafe(guest.email)}`,
					hook: `data-mm-remove-person="${index}"`,
					label: htmlSafe(guest.name),
				}),
			)
			.join('');
		if (window.Basalt.avatar) {
			for (const avatar of pickAll('.basalt-avatar[data-name]', guestList)) window.Basalt.avatar(avatar);
		}
		addressList.innerHTML = shop.addresses
			.map((address, index) =>
				accessRow({
					lead: '<span aria-hidden="true" class="mm-person-icon"><i class="bi bi-router"></i></span>',
					title: htmlSafe(address.ip),
					titleClass: 'mm-person-name mm-mono',
					detail: htmlSafe(address.label || 'No name'),
					hook: `data-mm-remove-place="${index}"`,
					label: htmlSafe(address.ip),
				}),
			)
			.join('');

		guestList.hidden = !shop.guests.length;
		addressList.hidden = !shop.addresses.length;
		pick('[data-mm-people-empty]', root).hidden = shop.guests.length > 0;
		pick('[data-mm-places-empty]', root).hidden = shop.addresses.length > 0;
		pick('[data-mm-count-people]', root).textContent = shop.guests.length;
		pick('[data-mm-count-places]', root).textContent = shop.addresses.length;
		offerStaff();
		if (!shop.isOpen) paintDoor();
	}

	function accessRow({ lead, title, titleClass, detail, hook, label }) {
		return `<li class="mm-person">${lead}<span class="mm-person-main"><span class="${titleClass}">${title}</span><span class="mm-person-sub">${detail}</span></span><button ${hook} aria-label="Remove ${label}" type="button" class="mm-icon-btn mm-icon-btn-danger"><i aria-hidden="true" class="bi bi-x-lg"></i></button></li>`;
	}

	/* The name suggestions list only the staff who are not on the list yet. */
	function offerStaff() {
		const listed = new Set(shop.guests.map((guest) => guest.email));
		pick('[data-mm-team]', root).innerHTML = STAFF.filter((member) => !listed.has(member.email))
			.map(
				(member) =>
					`<li data-hint="${htmlSafe(member.role)}" data-value="${htmlSafe(member.name)}">${htmlSafe(member.name)}</li>`,
			)
			.join('');
	}

	/**
	 * Takes one entry off the guest or address list, moves focus to the
	 * nearest remaining remove button (or the add field), and offers an undo.
	 */
	function revokeAccess(listKey, index, nameOf, list, fallback) {
		const [removed] = shop[listKey].splice(index, 1);
		renderAccess();
		const removeButtons = pickAll('button', list);
		(removeButtons[Math.min(index, removeButtons.length - 1)] || fallback).focus();
		notify({
			tone: 'info',
			title: `${nameOf(removed)} removed`,
			text: 'They see the message like everyone else while the shop is closed.',
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						shop[listKey].splice(index, 0, removed);
						renderAccess();
					},
				},
			],
		});
	}

	function addGuest(event) {
		event.preventDefault();
		const typed = guestInput.value.trim();
		const refuse = (message) => {
			showFieldError(guestInput, guestError, message);
			guestInput.focus();
		};
		if (!typed) return refuse('Type a name from the team, or an email address.');
		const guest = guestFrom(typed);
		if (!guest)
			return refuse(
				`Nobody on the team is called “${typed}”. Pick someone from the list, or type an email address.`,
			);
		if (shop.guests.some((listed) => listed.email === guest.email))
			return refuse(`${guest.name} is already on the list.`);

		shop.guests.push({ ...guest });
		guestInput.value = '';
		showFieldError(guestInput, guestError, '');
		renderAccess();
		guestInput.focus();
		notify({
			tone: 'success',
			icon: 'bi-person-check',
			title: `${guest.name} can get in`,
			text: 'They see the real shop while it is closed.',
		});
	}

	/** Finds a staff member by name or email, or makes a guest from an email. */
	function guestFrom(typed) {
		const lowered = typed.toLowerCase();
		const member = STAFF.find((person) => person.name.toLowerCase() === lowered || person.email === lowered);
		if (member) return member;
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed)) return null;
		const name = typed
			.split('@')[0]
			.replace(/[._-]+/g, ' ')
			.replace(/\b\w/g, (letter) => letter.toUpperCase());
		return { name, role: 'Guest', email: lowered };
	}

	function addAddress(event) {
		event.preventDefault();
		const ip = addressInput.value.trim();
		let problem = '';
		if (!IPV4_PATTERN.test(ip))
			problem = ip
				? 'That does not look like an address. It should be four numbers from 0 to 255 with dots between, like 203.0.113.88.'
				: 'Type an address first.';
		else if (shop.addresses.some((address) => address.ip === ip)) problem = `${ip} is already on the list.`;
		if (problem) {
			showFieldError(addressInput, addressError, problem);
			addressInput.focus();
			return;
		}
		shop.addresses.push({ ip, label: addressLabel.value.trim() });
		addressInput.value = '';
		addressLabel.value = '';
		showFieldError(addressInput, addressError, '');
		renderAccess();
		addressInput.focus();
		notify({
			tone: 'success',
			icon: 'bi-router',
			title: `${ip} added`,
			text: 'Anyone on that connection sees the real shop.',
		});
	}

	/** Shows `message` under a field, or clears it when the message is empty. */
	function showFieldError(formInput, box, message) {
		formInput.classList.toggle('is-invalid', Boolean(message));
		if (message) formInput.setAttribute('aria-invalid', 'true');
		else formInput.removeAttribute('aria-invalid');
		box.textContent = message || '';
		box.parentElement.classList.toggle('was-checked', Boolean(message));
	}

	/* The private preview link and how long it lasts. */

	function wirePrivateLink() {
		linkInput.value = `${PREVIEW_BASE}${freshToken()}`;
		describeLinkLife();
		lifeSelect.addEventListener('change', describeLinkLife);
		pick('[data-mm-link-new]', root).addEventListener('basalt:confirm', replaceLink);
	}

	function replaceLink() {
		linkInput.value = `${PREVIEW_BASE}${freshToken()}`;
		linkIssuedAt = demoNow();
		describeLinkLife();
		notify({
			tone: 'success',
			icon: 'bi-link-45deg',
			title: 'New link made',
			text: 'The old link no longer works.',
			actions: [
				{
					label: 'Copy it',
					onClick: () => {
						window.Basalt.copyText?.(linkInput.value);
					},
				},
			],
		});
	}

	function describeLinkLife() {
		const expires = later(linkIssuedAt, parseInt(lifeSelect.value, 10) * 1440);
		linkNote.innerHTML = `<i aria-hidden="true" class="bi bi-hourglass-split"></i>Works until ${dateWords(expires)}, ${timeLabel(expires)}.`;
	}

	/** Three groups of four characters, with look-alike letters left out. */
	function freshToken() {
		return Array.from({ length: 3 }, () =>
			Array.from({ length: 4 }, () => TOKEN_ALPHABET[Math.floor(tokenRandom() * TOKEN_ALPHABET.length)]).join(''),
		).join('-');
	}

	/* The pre-close checklist. */

	function wireChecklist() {
		renderChecklist(BEFORE_CLOSING.map((chore) => chore.startsTicked));
		checklist.addEventListener('change', (event) => {
			event.target.closest('.basalt-checklist-item')?.classList.toggle('is-done', event.target.checked);
			tallyChecklist();
		});
		pick('[data-mm-check-reset]', root).addEventListener('click', () => {
			renderChecklist(BEFORE_CLOSING.map(() => false));
			pick('input', checklist)?.focus();
		});
	}

	function renderChecklist(ticked) {
		checklist.innerHTML = BEFORE_CLOSING.map((chore, index) => {
			const id = `mm-chk-${index}`;
			return `<li class="basalt-checklist-item${ticked[index] ? ' is-done' : ''}"><div class="form-check"><input id="${id}" type="checkbox" class="form-check-input"${ticked[index] ? ' checked' : ''}><label for="${id}" class="form-check-label"><span>${htmlSafe(chore.task)}</span><span class="basalt-checklist-hint">${htmlSafe(chore.hint)}</span></label></div></li>`;
		}).join('');
		tallyChecklist();
	}

	function tallyChecklist() {
		const tickBoxes = pickAll('input', checklist);
		const tickedCount = tickBoxes.filter((box) => box.checked).length;
		const percent = Math.round((tickedCount / tickBoxes.length) * 100);
		pick('[data-mm-check-count]', root).textContent = `${tickedCount} of ${tickBoxes.length} done`;
		const bar = pick('[data-mm-check-bar]', root);
		bar.setAttribute('aria-valuenow', String(percent));
		bar.firstElementChild.style.width = `${percent}%`;
		checklistBox.classList.toggle('is-complete', tickedCount === tickBoxes.length);
	}

	/* The log of past closures: tabs, search, paging, details and export. */

	function wireLog() {
		countLogTypes();
		loadLog(900, 1);
		for (const tab of pickAll('[data-mm-hist-kind]', root)) {
			tab.addEventListener('shown.bs.tab', () => {
				logView.origin = tab.getAttribute('data-mm-hist-kind');
				logUi.panel.setAttribute('aria-labelledby', tab.id);
				loadLog(380, 1);
			});
		}
		logUi.search.addEventListener('input', () => {
			clearTimeout(typingPause);
			typingPause = setTimeout(() => {
				if (!logView.loading) drawLog(1);
			}, 160);
		});
		logUi.rowsPerPage.addEventListener('change', () => {
			if (!logView.loading) drawLog(1);
		});
		pick('[data-mm-hist-clear]', root).addEventListener('click', () => {
			logUi.search.value = '';
			drawLog(1);
			logUi.search.focus();
		});
		logUi.body.addEventListener('click', toggleLogRow);
		pick('[data-mm-hist-export]', root).addEventListener('click', exportLog);
	}

	/** Shows placeholder rows for `delay` ms, then the real page. */
	function loadLog(delay, page) {
		logView.loading = true;
		logUi.body.setAttribute('aria-busy', 'true');
		pick('.mm-scroll', logUi.panel).hidden = false;
		logUi.empty.hidden = true;
		showPlaceholderRows(Math.min(5, parseInt(logUi.rowsPerPage.value, 10)));
		setTimeout(() => {
			const firstDraw = !logView.paging;
			logView.loading = false;
			drawLog(page);
			if (firstDraw) playOnSight(logUi.body);
		}, delay);
	}

	/** Recounts the tabs and, unless still loading, redraws; `fresh` goes to page one. */
	function renderLog(fresh) {
		countLogTypes();
		if (logView.loading) return;
		drawLog(fresh ? 1 : 0);
	}

	function countLogTypes() {
		for (const origin of ['all', 'planned', 'urgent']) {
			const badge = pick(`[data-mm-hist-n="${origin}"]`, root);
			if (badge)
				badge.textContent = shop.log.filter((entry) => origin === 'all' || entry.origin === origin).length;
		}
	}

	function matchingEntries() {
		const needle = logUi.search.value.trim().toLowerCase();
		return shop.log.filter((entry) => {
			if (logView.origin !== 'all' && entry.origin !== logView.origin) return false;
			return !needle || `${entry.reason} ${entry.by}`.toLowerCase().includes(needle);
		});
	}

	/** Draws one page of matches; a falsy `page` keeps the pager where it is. */
	function drawLog(page) {
		const hits = matchingEntries();
		const rowsPerPage = parseInt(logUi.rowsPerPage.value, 10);
		const pageCount = Math.max(1, Math.ceil(hits.length / rowsPerPage));
		if (logView.paging) {
			logView.paging.setTotal(pageCount);
			if (page) logView.paging.set(page);
		} else {
			logView.paging = window.Basalt.pagination(logUi.pages, {
				total: pageCount,
				current: 1,
				label: 'Page',
				onChange: () => drawLog(),
			});
		}
		const firstIndex = (logView.paging.get() - 1) * rowsPerPage;
		const pageEntries = hits.slice(firstIndex, firstIndex + rowsPerPage);
		logUi.body.innerHTML = pageEntries.map(logRowMarkup).join('');
		logUi.body.removeAttribute('aria-busy');

		const nothing = hits.length === 0;
		logUi.empty.hidden = !nothing;
		pick('.mm-scroll', logUi.panel).hidden = nothing;
		logUi.pager.hidden = nothing;
		if (nothing) {
			const needle = logUi.search.value.trim();
			pick('[data-mm-hist-empty-text]', root).textContent = needle
				? `No window mentions “${needle}”. Try another word or look in All.`
				: 'No windows of this kind yet.';
		}
		logUi.range.innerHTML = nothing
			? ''
			: `<strong>${firstIndex + 1}–${firstIndex + pageEntries.length}</strong> of ${countOf(hits.length, 'window', 'windows')}`;
	}

	/** A summary row plus its hidden detail row with the timeline. */
	function logRowMarkup(entry) {
		const panelId = `mm-d-${entry.id}`;
		const unfolded = logView.unfolded.has(entry.id);
		const closingKind = CLOSING_KINDS[entry.closing];
		const reason = htmlSafe(entry.reason);
		const moments = entry.timeline
			.map(
				({ at, note: words }) =>
					`<li><time datetime="${datetimeValue(at)}">${timeLabel(at)}</time>${htmlSafe(words)}</li>`,
			)
			.join('');
		const rowCells = [
			`<td><button data-mm-exp="${entry.id}" aria-controls="${panelId}" aria-expanded="${unfolded}" type="button" class="mm-exp"><i aria-hidden="true" class="bi bi-chevron-right"></i><span class="visually-hidden">Details for ${reason}</span></button></td>`,
			`<td class="mm-when">${dateWords(entry.startsAt)}<span class="mm-when-time">${timeLabel(entry.startsAt)}</span></td>`,
			`<td><span class="mm-reason">${reason}<span class="mm-reason-by">${originWord(entry)}, ${htmlSafe(entry.by)}</span></span></td>`,
			`<td><span class="basalt-status basalt-status-${closingKind.tone}">${closingKind.label}</span></td>`,
			`<td class="text-end mm-num">${durationLabel(entry.minutes)}</td>`,
			`<td class="text-end mm-num">${entry.missed}</td>`,
			`<td>${outcomeBadge(entry)}</td>`,
		].join('');
		return `<tr class="mm-row">${rowCells}</tr><tr id="${panelId}" class="mm-detail"${unfolded ? '' : ' hidden'}><td></td><td colspan="6"><ol class="mm-story">${moments}</ol></td></tr>`;
	}

	function originWord(entry) {
		return entry.origin === 'urgent' ? 'Unplanned' : 'Planned';
	}

	function outcomeBadge(entry) {
		if (entry.overBy)
			return `<span class="basalt-status basalt-status-warning">Ran ${entry.overBy} min over</span>`;
		if (entry.earlyBy) return `<span class="basalt-status basalt-status-info">${entry.earlyBy} min early</span>`;
		return '<span class="basalt-status basalt-status-success">On time</span>';
	}

	function showPlaceholderRows(count) {
		const widths = [20, 70, 90, 60, 40, 30, 60];
		const row = `<tr class="mm-skel-row" aria-hidden="true">${widths.map((width) => `<td><span class="basalt-skeleton basalt-skeleton-line" data-w="${width}"></span></td>`).join('')}</tr>`;
		logUi.body.innerHTML = row.repeat(count);
		for (const bar of pickAll('.basalt-skeleton[data-w]', logUi.body))
			bar.style.width = `${bar.getAttribute('data-w')}%`;
	}

	function toggleLogRow(event) {
		const button = event.target.closest('[data-mm-exp]');
		if (!button) return;
		const id = button.getAttribute('data-mm-exp');
		const expand = button.getAttribute('aria-expanded') !== 'true';
		button.setAttribute('aria-expanded', String(expand));
		const detail = document.getElementById(button.getAttribute('aria-controls'));
		window.Basalt.slide(pick('.mm-story', detail), () => {
			detail.hidden = !expand;
		});
		if (expand) logView.unfolded.add(id);
		else logView.unfolded.delete(id);
	}

	function exportLog() {
		const saving = matchingEntries();
		const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
		const finished = (entry) => {
			if (entry.overBy) return `Over by ${entry.overBy} min`;
			return entry.earlyBy ? `${entry.earlyBy} min early` : 'On time';
		};
		const csvRows = saving.map((entry) =>
			[
				dateValue(entry.startsAt),
				timeLabel(entry.startsAt),
				quote(entry.reason),
				originWord(entry),
				quote(entry.by),
				CLOSING_KINDS[entry.closing].label,
				entry.minutes,
				entry.missed,
				finished(entry),
			].join(','),
		);
		const csv = ['Date,Start,Reason,Kind,By,Closed,Minutes,Orders missed,Finished', ...csvRows].join('\r\n');
		const fileUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
		const download = document.createElement('a');
		download.href = fileUrl;
		download.download = 'maintenance-history.csv';
		document.body.append(download);
		download.click();
		download.remove();
		setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
		notify({
			tone: 'success',
			icon: 'bi-download',
			title: 'History downloaded',
			text: `${countOf(saving.length, 'window', 'windows')} in maintenance-history.csv.`,
		});
	}

	/* Made-up history: thirty-four closures stepping back from late September. */

	function buildPastLog() {
		const random = makeRandom(314);
		const history = [];
		let cursor = new Date(2026, 8, 24, 23, 0).getTime();
		for (let index = 0; index < 34; index += 1) {
			cursor -= (4 + Math.floor(random() * 9)) * 86400000;
			const unplanned = random() < 0.3;
			const startsAt = new Date(cursor);
			const hour = unplanned ? 8 + Math.floor(random() * 12) : [1, 2, 3, 23][Math.floor(random() * 4)];
			startsAt.setHours(hour, [0, 15, 30, 45][Math.floor(random() * 4)]);
			const booked = unplanned
				? 20 + Math.floor(random() * 5) * 10
				: [30, 45, 60, 90, 120][Math.floor(random() * 5)];
			const drift = random();
			const overBy = drift > 0.72 ? 5 + Math.floor(random() * 25) : 0;
			const earlyBy = !overBy && drift < 0.18 ? Math.min(booked - 10, 5 + Math.floor(random() * 15)) : 0;
			const minutes = booked + overBy - earlyBy;
			const closing = chooseFrom(unplanned ? ['all', 'checkout'] : ['all', 'all', 'checkout', 'subs'], random);
			const by = chooseFrom(ON_CALL, random);
			const missed =
				closing === 'subs' ? 0 : Math.round(expectedOrders(curveFor(startsAt), minuteOfDay(startsAt), minutes));
			const reason = chooseFrom(unplanned ? UNPLANNED_REASONS : PLANNED_REASONS, random);
			history.push({
				id: `h${index}`,
				startsAt,
				minutes,
				origin: unplanned ? 'urgent' : 'planned',
				reason,
				by,
				closing,
				missed,
				overBy,
				earlyBy,
				timeline: pastTimeline(startsAt, minutes, unplanned, by, overBy, earlyBy),
			});
		}
		return history;
	}

	function pastTimeline(startsAt, minutes, unplanned, by, overBy, earlyBy) {
		const moments = [];
		if (!unplanned) moments.push({ at: later(startsAt, -1440), note: 'Notice shown on the shop the day before' });
		moments.push({
			at: startsAt,
			note: `${unplanned ? 'Closed straight away by ' : 'Closed on schedule, started by '}${by}`,
		});
		moments.push({
			at: later(startsAt, Math.round(minutes * 0.6)),
			note: 'Checked from the packing room before reopening',
		});
		let ending = 'Reopened on time';
		if (overBy) ending = `Reopened ${overBy} minutes later than planned`;
		else if (earlyBy) ending = `Reopened ${earlyBy} minutes early`;
		moments.push({ at: later(startsAt, minutes), note: ending });
		return moments;
	}

	/* Typical orders per hour. Weekdays, Saturday and Sunday each get a curve:
     quiet overnight, a morning rush, lunch, then a longer evening. */

	function buildHourlyCurves() {
		const random = makeRandom(77);
		const outline = [
			0.5, 0.3, 0.2, 0.15, 0.2, 0.5, 1.6, 3.4, 4.6, 4.1, 3.5, 3.6, 4.4, 4.2, 3.2, 2.9, 3.1, 3.6, 4.3, 5.2, 5.6,
			4.6, 3, 1.4,
		];
		const curve = (scale, lag) =>
			outline.map((_, hour) => {
				const baseline = outline[(hour - lag + 24) % 24];
				return Math.max(0.1, Math.round((baseline * scale + (random() - 0.5) * 0.7) * 10) / 10);
			});
		const weekday = curve(1.3, 0);
		const sat = curve(1.65, 1);
		const sun = curve(1.25, 2);
		return { weekday, sat, sun };
	}

	function curveFor(date) {
		return ORDERS_BY_HOUR[{ 6: 'sat', 0: 'sun' }[date.getDay()] || 'weekday'];
	}

	/** Expected orders across `length` minutes from `fromMinute` of the day. */
	function expectedOrders(curve, fromMinute, length) {
		let total = 0;
		for (let offset = 0; offset < length; offset += 5) {
			const hour = Math.floor(((fromMinute + offset) % 1440) / 60);
			total += curve[hour] * (Math.min(5, length - offset) / 60);
		}
		return total;
	}

	/** The run of `span` whole hours with the fewest orders, wrapping midnight. */
	function calmestStretch(curve, span) {
		let firstHour = 0;
		let fewest = Infinity;
		for (let hour = 0; hour < 24; hour += 1) {
			let sum = 0;
			for (let offset = 0; offset < span; offset += 1) sum += curve[(hour + offset) % 24];
			if (sum < fewest) {
				fewest = sum;
				firstHour = hour;
			}
		}
		return { firstHour, orders: fewest };
	}

	/* Chart colors come from the theme tokens, with fallbacks for old browsers. */

	function chartColors() {
		const ink = readToken('--basalt-copy', '#12233a');
		return {
			text: ink,
			quiet: blend(readToken('--basalt-copy-muted', '#5f7186'), ink, 0.82),
			grid: translucent(ink, 0.07),
			surface: readToken('--basalt-plane', '#ffffff'),
			border: readToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			busy: readToken('--basalt-series-1', '#2b6fd4'),
			calm: readToken('--basalt-series-3', '#12c08f'),
		};
	}

	function readToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** Splits a hex or rgb() color into [r, g, b, alpha]; gray when unreadable. */
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
		if (!functional) return [128, 128, 128, 1];
		const numbers = functional[1].split(',').map((part) => parseFloat(part));
		return [numbers[0], numbers[1], numbers[2], numbers.length > 3 ? numbers[3] : 1];
	}

	function translucent(color, alpha) {
		const [red, green, blue] = rgbaParts(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	/** Mixes two colors; `share` is how much of the first one to keep. */
	function blend(base, other, share) {
		const ours = rgbaParts(base);
		const theirs = rgbaParts(other);
		const [red, green, blue] = [0, 1, 2].map((channel) =>
			Math.round(ours[channel] * share + theirs[channel] * (1 - share)),
		);
		return `rgb(${red}, ${green}, ${blue})`;
	}

	/* Dates, times and counts in the words the page uses. */

	function demoNow() {
		return new Date(CLOCK_ORIGIN + (Date.now() - loadedAt));
	}

	function later(date, minutes) {
		return new Date(date.getTime() + minutes * 60000);
	}

	function minuteOfDay(date) {
		return date.getHours() * 60 + date.getMinutes();
	}

	function twoDigits(number) {
		return String(number).padStart(2, '0');
	}

	function timeLabel(date) {
		const hours = date.getHours();
		return `${hours % 12 || 12}:${twoDigits(date.getMinutes())}${hours < 12 ? ' am' : ' pm'}`;
	}

	/** "2 am" style label for an hour index; wraps past midnight either way. */
	function hourLabel(hour) {
		const wrapped = ((hour % 24) + 24) % 24;
		return `${wrapped % 12 || 12}${wrapped < 12 ? ' am' : ' pm'}`;
	}

	function dateWords(date) {
		return `${WEEKDAY_SHORT[date.getDay()]}, ${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
	}

	function durationLabel(total) {
		const hours = Math.floor(total / 60);
		const rest = Math.round(total % 60);
		if (!hours) return `${rest} min`;
		return rest ? `${hours}h ${rest}m` : `${hours}h`;
	}

	/* Local values in the forms date, time and <time datetime> fields take. */
	function dateValue(date) {
		return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
	}

	function clockValue(date) {
		return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
	}

	function datetimeValue(date) {
		return `${dateValue(date)}T${clockValue(date)}`;
	}

	function countOf(count, singular, plural) {
		return `${count} ${count === 1 ? singular : plural}`;
	}

	/* Shared plumbing: lookups, escaping, toasts, button states, fields. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	/** One element per selector, in the order asked for; null when missing. */
	function hooks(scope, ...selectors) {
		return selectors.map((selector) => pick(selector, scope));
	}

	/** Like hooks(), but keeps the names given in `selectors`. */
	function hookMap(scope, selectors) {
		return Object.fromEntries(Object.entries(selectors).map(([name, selector]) => [name, pick(selector, scope)]));
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	/**
	 * The first time a list is on screen its rows rise in one after another;
	 * whatever is drawn into it later appears as it is.
	 * @param {HTMLElement|null} list
	 */
	function playOnSight(list) {
		if (!list || stillMotion || !('IntersectionObserver' in window)) return;
		list.classList.add('is-waiting');
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				list.classList.replace('is-waiting', 'is-drawing');
				const runs = list.getAnimations({ subtree: true }).filter((run) => run.animationName === 'mm-rise');
				Promise.allSettled(runs.map((run) => run.finished)).then(() => list.classList.remove('is-drawing'));
			},
			{ threshold: 0.2 },
		);
		watch.observe(list);
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value).replace(/[&<>"']/g, (character) => entities[character]);
	}

	/** Hands a toast to the shared stack, or reads it out when there is none. */
	function notify(message) {
		if (window.Basalt.toasts) return window.Basalt.toasts.push(message);
		window.Basalt.announce?.(`${message.title || ''} ${message.text || ''}`);
		return null;
	}

	function setButtonPhase(button, phase) {
		window.Basalt.buttonState?.(button, phase);
	}

	function flagField(formInput) {
		formInput.classList.add('is-invalid');
		formInput.setAttribute('aria-invalid', 'true');
	}

	function unflagField(formInput) {
		formInput.classList.remove('is-invalid');
		formInput.removeAttribute('aria-invalid');
	}

	/** Small fixed-seed generator (mulberry32): the same seed, the same run. */
	function makeRandom(seed) {
		let cursor = seed >>> 0;
		return () => {
			cursor = (cursor + 0x6d2b79f5) >>> 0;
			let mixed = Math.imul(cursor ^ (cursor >>> 15), cursor | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	function chooseFrom(list, random) {
		return list[Math.floor(random() * list.length)];
	}

	start();
})();
