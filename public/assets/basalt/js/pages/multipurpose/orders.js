/**
 * Orders (orders.html). Four weeks of Marlo orders, from shoppers on the
 * web store and from the stockists who buy wholesale, tracked through the
 * warehouse until the parcel is signed for. Draws the fulfillment strip,
 * the week-by-week list, the quick-view drawer and the Ship and New order
 * dialogs. Records come from the shared Store book; a live install would
 * fetch them, and "today" is pinned so the demo dates never drift.
 */
(() => {
	'use strict';

	const page = pick('[data-ords-root]');
	if (!page) return;
	const shop = window.Basalt.shopBook;
	if (!shop) return;

	/*
	 * Fixed tables. A stage key doubles as a data-ords-stage value and as the
	 * name of its timestamp, so the keys stay as the markup expects them.
	 */
	const DAY_MS = 86400000;
	const BATCH = 20;
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const CHANNEL_NAMES = { online: 'Online store', wholesale: 'Wholesale' };

	/* Tile colors for the products, picked from the chart ramp; 5 is the fallback. */
	const PRODUCT_TONE = {
		'ML-BLAZ': 1,
		'ML-GOWN': 1,
		'ML-ORGZ': 2,
		'ML-SUIT': 3,
		'ML-TRCH': 3,
		'ML-LOAF': 4,
		'ML-OXFD': 7,
		'ML-CATE': 7,
		'ML-SHLD': 8,
	};

	const STAGE_LIST = [
		{ key: 'received', label: 'Received', icon: 'bi-inbox', tone: 1 },
		{ key: 'picking', label: 'Picking', icon: 'bi-basket', tone: 2 },
		{ key: 'configuring', label: 'Checking', icon: 'bi-search', tone: 8 },
		{ key: 'packing', label: 'Packing', icon: 'bi-box-seam', tone: 4 },
		{ key: 'dispatched', label: 'Shipped', icon: 'bi-truck', tone: 7 },
		{ key: 'delivered', label: 'Delivered', icon: 'bi-house-check', tone: 'success' },
	];
	/* What the line under the belt says while no dot is pointed at. */
	const BELT_REST = 'Each dot is an order on its way. Red ones are late, amber ones wait for payment.';
	const stageByKey = Object.fromEntries(STAGE_LIST.map((step, position) => [step.key, { ...step, at: position }]));

	/* Gift cards and styling sessions never reach the warehouse: they go straight from received to this. */
	const FINISHED = { key: 'delivered', label: 'Done', icon: 'bi-check2-circle', tone: 'success' };

	/* What the main action button says while an order sits in each stage. */
	const MOVE_ON = {
		received: { label: 'Start picking', icon: 'bi-basket' },
		picking: { label: 'Mark picked', icon: 'bi-check2' },
		configuring: { label: 'Mark checked', icon: 'bi-check2' },
		packing: { label: 'Ship', icon: 'bi-truck' },
		dispatched: { label: 'Mark delivered', icon: 'bi-house-check' },
	};

	const PAYMENT_LOOK = {
		paid: { label: 'Paid', tone: 'success' },
		invoiced: { label: 'Invoiced', tone: 'info' },
		overdue: { label: 'Overdue', tone: 'danger' },
		awaiting: { label: 'Awaiting payment', tone: 'warning' },
		refunded: { label: 'Refunded', tone: 'muted' },
	};

	const today = window.Basalt.toLocalDay(shop.NOW.slice(0, 10));
	const todayKey = dateKey(today);

	/* The list reaches back to the Monday three weeks before this one. */
	const windowStart = weekStart(today);
	windowStart.setDate(windowStart.getDate() - 21);

	/* Lookups by SKU and by customer id, filled once by start(). */
	const catalog = {};
	const accounts = {};

	/* Everything the screen depends on that changes while the page is open. */
	let orders = [];
	const view = { stage: '', channel: 'all', payment: 'all', query: '' };
	const picked = new Set();
	const listing = { cap: BATCH, signature: '', matching: [], visible: [] };
	const panel = { open: false, ids: [], index: 0 };
	const shipping = { order: null, returnToPanel: false };
	let lineCount = 0;
	let findDelay;

	const ui = {
		today: pick('[data-ords-today]', page),
		flow: pick('[data-ords-flow]', page),
		belt: pick('[data-ords-belt]', page),
		beltNote: pick('[data-ords-belt-note]', page),
		body: pick('[data-ords-body]', page),
		tableWrap: pick('.ords-table-wrap', page),
		empty: pick('[data-ords-empty]', page),
		foot: pick('[data-ords-foot]', page),
		summary: pick('[data-ords-summary]', page),
		chips: pick('[data-ords-applied]', page),
		search: pick('[data-ords-search]', page),
		channel: pick('[data-ords-channel]', page),
		payment: pick('[data-ords-pay]', page),
		moreBar: pick('[data-ords-more]', page),
		moreButton: pick('[data-ords-more-btn]', page),
		moreNote: pick('[data-ords-more-text]', page),
		checkAll: pick('[data-ords-check-all]', page),
		bulkBar: pick('[data-ords-bulk]', page),
		bulkCount: pick('[data-ords-bulk-count]', page),
		exportButton: pick('[data-ords-export]', page),
	};

	const drawer = pick('#ords-record');
	const drawerAction = pick('[data-ords-r-next]', drawer);

	const shipDialog = pick('#ords-dispatch');
	const shipForm = pick('[data-ords-dispatch-form]', shipDialog);
	const trackingField = pick('[data-ords-d="tracking"]', shipDialog);

	const newDialog = pick('#ords-new');
	const draftForm = pick('[data-ords-new-form]', newDialog);
	const customerField = pick('[data-ords-n="account"]', newDialog);
	const productRows = pick('[data-ords-n="lines"]', newDialog);
	const newSummary = pick('[data-ords-n="sum"]', newDialog);

	start();

	/* Builds the lookups and the order list, binds every control, then draws once. */
	function start() {
		loadCatalog();
		loadAccounts();
		orders = shop.ORDERS.concat(shop.WHOLESALE)
			.filter((entry) => entry.status !== 'canceled' && window.Basalt.toLocalDay(entry.date) >= windowStart)
			.sort((left, right) => (right.date + right.time).localeCompare(left.date + left.time))
			.map(fromShop)
			.map(finishRecord);

		bindStrip();
		bindBelt();
		bindFilters();
		bindSelection();
		bindRows();
		bindDrawer();
		bindShipDialog();
		bindNewDialog();
		redraw();
	}

	/* Reading the Store book */

	function loadCatalog() {
		for (const item of shop.PRODUCTS) {
			catalog[item.sku] = {
				label: item.name,
				price: item.price,
				icon: item.icon,
				tone: PRODUCT_TONE[item.sku] || 5,
			};
		}
	}

	/*
	 * One entry per shopper and stockist: delivery address, tax rule, usual
	 * carrier and how they pay. Stockists have no profile page and are
	 * always invoiced; a shopper pays by card if their first order did.
	 */
	function loadAccounts() {
		for (const person of [...shop.CUSTOMERS, ...shop.STOCKISTS]) {
			const isStockist = person.tier === 'stockist';
			const theirs = shop.ORDERS.filter((entry) => entry.customer === person.name);
			const byCard = theirs.find((entry) => entry.paymentMethod === 'card');
			const cardStory = byCard ? shop.story(byCard).payment : null;
			const shipMethod = shop.SHIP_BY_COUNTRY[person.country];
			accounts[person.id] = {
				name: person.name,
				isStockist,
				page: isStockist ? '' : `shopper-details.html?id=${encodeURIComponent(person.id)}`,
				buyer: person.buyer,
				city: person.city,
				email: person.email,
				address: [...person.address, shop.COUNTRIES[person.country]],
				taxCode: person.tax,
				shipMethod,
				carrier: shop.SHIPPING[shipMethod].carrier,
				paysByCard: Boolean(!isStockist && theirs.length && theirs[0].paymentMethod === 'card'),
				cardName: cardStory ? `${brandTitle(cardStory.brand)} ending ${cardStory.last4}` : '',
				tone: person.avatarTone,
			};
		}
	}

	/*
	 * Turns a book order into the record this page works with. Picking
	 * begins thirty minutes after the order is cleared to go and checking
	 * an hour later; the remaining times come from the book unchanged.
	 */
	function fromShop(entry) {
		const story = shop.story(entry);
		const paid = story.payment;
		const trip = story.fulfil;
		const onTerms = paid.terms === 'Pay in 30 days';
		const clearedAt = onTerms ? story.placed : paid.paidAt;
		const nowStamp = spaced(shop.NOW);
		const times = {};

		if (clearedAt && story.goods) {
			const pickAt = addMinutes(spaced(clearedAt), 30);
			const checkAt = addMinutes(spaced(clearedAt), 90);
			if (trip.packedAt || pickAt <= nowStamp) times.picking = pickAt;
			if (trip.packedAt || checkAt <= nowStamp) times.configuring = checkAt;
		}
		if (trip.packedAt) times.packing = spaced(trip.packedAt);
		if (trip.shippedAt) times.dispatched = spaced(trip.shippedAt);
		if (trip.deliveredAt) times.delivered = spaced(trip.deliveredAt);

		const placedAt = spaced(story.placed);
		const shipped = Boolean(trip.shippedAt);
		return {
			number: entry.orderNumber,
			accountId: shop.customer(entry.customer).id,
			source: entry,
			channel: entry.channel,
			shipsGoods: story.goods,
			placedAt,
			speed: 'ground',
			stage: furthestStage(trip, times),
			dueOut: addWorkDays(clearedAt ? spaced(clearedAt) : placedAt, 2),
			times,
			items: entry.lines.map((line) => ({ sku: line.sku, qty: line.qty })),
			carrier: shipped ? trip.carrier : undefined,
			tracking: shipped ? trip.tracking : undefined,
			arrives: shipped && !trip.deliveredAt ? trip.expected.slice(0, 10) : undefined,
			payment: paymentFrom(entry, paid, onTerms),
		};
	}

	function furthestStage(trip, times) {
		if (trip.deliveredAt) return 'delivered';
		if (trip.shippedAt) return 'dispatched';
		if (trip.packedAt) return 'packing';
		if (times.configuring) return 'configuring';
		return times.picking ? 'picking' : 'received';
	}

	/* Orders on 30-day terms ship at once; an invoice due on receipt holds the parcel until it is paid. */
	function paymentFrom(entry, paid, onTerms) {
		const settledOn = paid.paidAt ? paid.paidAt.slice(0, 10) : '';
		if (paid.paidAt && shop.sums(entry).refunded) {
			return {
				status: 'refunded',
				paidOn: settledOn,
				via: paid.kind === 'card' ? 'the card' : paid.method,
				refund: entry.refund,
			};
		}
		if (paid.paidAt) {
			return {
				status: 'paid',
				paidOn: settledOn,
				via: paid.kind === 'card' ? `${brandTitle(paid.brand)} ending ${paid.last4}` : paid.method,
			};
		}
		if (paid.kind === 'card') {
			return {
				status: 'awaiting',
				declinedOn: paid.declinedAt ? paid.declinedAt.slice(0, 10) : null,
				cardName: `${paid.brand} ending ${paid.last4}`,
			};
		}
		return {
			status: 'invoiced',
			invoice: paid.invoice,
			termDays: onTerms ? 30 : 7,
			dueOn: paid.dueAt.slice(0, 10),
			holdUntilPaid: !onTerms,
		};
	}

	function brandTitle(brand) {
		return brand === 'American Express' ? 'Amex' : brand;
	}

	/* Adds the money and flags overdue invoices; runs once per record, new ones included. */
	function finishRecord(record) {
		const bill = record.payment;
		if (bill.status === 'invoiced' && bill.dueOn < todayKey) bill.status = 'overdue';
		record.totals = totalsFor(record);
		record.times = record.times || {};
		return record;
	}

	/* Money, by the book's own rules */

	/**
	 * Prices a record, in dollars. Records made on this page are shaped for
	 * the book first: express always goes FedEx 2Day, and a stockist pays
	 * wholesale.
	 */
	function totalsFor(record) {
		const priced = asBookOrder(record);
		const cents = shop.sums(priced);
		return {
			subtotal: cents.subtotal / 100,
			discount: cents.discount / 100,
			shipping: cents.shipping / 100,
			tax: cents.tax / 100,
			total: cents.total / 100,
			refunded: cents.refunded / 100,
			units: record.items.reduce((count, item) => count + item.qty, 0),
			ship: priced.ship,
		};
	}

	function asBookOrder(record) {
		if (record.source) return record.source;
		const account = accounts[record.accountId];
		return {
			lines: record.items.map((item) => ({ sku: item.sku, qty: item.qty })),
			tax: account.taxCode,
			ship: record.speed === 'express' ? 'FedEx 2Day' : account.shipMethod,
			discount: discountCode(record),
		};
	}

	function discountCode(record) {
		if (record.source) return record.source.discount;
		return accounts[record.accountId].isStockist ? 'STOCKIST' : null;
	}

	/* Questions asked of a record */

	function currentStage(record) {
		if (record.shipsGoods) return stageByKey[record.stage];
		return record.stage === 'delivered' ? { ...FINISHED, at: 1 } : stageByKey.received;
	}

	function stagePath(record) {
		return record.shipsGoods ? STAGE_LIST : [STAGE_LIST[0], FINISHED];
	}

	function moveOnFor(record) {
		if (record.shipsGoods) return MOVE_ON[record.stage];
		return record.stage === 'delivered' ? null : { label: 'Mark done', icon: 'bi-check2' };
	}

	function stillOpen(record) {
		if (!record.shipsGoods) return record.stage !== 'delivered';
		return stageByKey[record.stage].at < stageByKey.dispatched.at;
	}

	function onHold(record) {
		return record.payment.status === 'awaiting' || Boolean(record.payment.holdUntilPaid);
	}

	function runningLate(record) {
		return record.shipsGoods && stillOpen(record) && !onHold(record) && record.dueOut < todayKey;
	}

	function hasService(record) {
		return record.items.some((item) => shop.kind(item.sku) === 'service');
	}

	function recordById(number) {
		return orders.find((record) => record.number === number);
	}

	/* Order Details only knows the book's orders; one created here has no full page. */
	function detailsUrl(record) {
		return record.madeHere ? '' : `order-details.html?id=${encodeURIComponent(record.number)}`;
	}

	/* The headline and the stage strip */

	function redraw() {
		drawHeadline();
		drawStrip();
		drawChips();
		drawList();
	}

	function drawHeadline() {
		const waiting = orders.filter((record) => record.shipsGoods && stillOpen(record));
		if (!waiting.length) {
			ui.today.innerHTML = 'Every order is on its way. Nothing waits in the warehouse.';
			return;
		}
		const goingToday = waiting.filter((record) => !onHold(record) && record.dueOut === todayKey).length;
		const late = waiting.filter(runningLate).length;
		const held = waiting.filter(onHold).length;
		const phrases = [
			goingToday && `<strong>${goingToday} go out today</strong>`,
			late && `<strong class="ords-today-danger">${late} ${late === 1 ? 'is' : 'are'} late</strong>`,
			held && `<strong class="ords-today-warning">${held} ${held === 1 ? 'waits' : 'wait'} for payment</strong>`,
		].filter(Boolean);
		const sentence =
			phrases.length > 1 ? `${phrases.slice(0, -1).join(', ')} and ${phrases.at(-1)}` : phrases.join('');
		ui.today.innerHTML = `${countOf(waiting.length, 'order')} still to ship${sentence ? `: ${sentence}` : ''}.`;
	}

	function drawStrip() {
		ui.flow.innerHTML = STAGE_LIST.map(stripTile).join('');
		drawBelt();
	}

	/* The belt under the tiles: every order on its way as a dot in its
	   stage's stretch, red when late and amber while it waits for payment;
	   delivered orders stack up at the end. Pointing at a dot names it. */
	function drawBelt() {
		ui.belt.innerHTML = STAGE_LIST.map((step) => {
			const inStage = orders.filter((record) => record.shipsGoods && record.stage === step.key);
			const shown = step.key === 'delivered' ? inStage.slice(0, 7) : inStage;
			const dots = shown
				.map((record, at) => {
					const state = runningLate(record) ? ' is-late' : onHold(record) ? ' is-held' : '';
					const spot = step.key === 'delivered' ? 12 + at * 9 : ((at + 1) / (shown.length + 1)) * 100;
					return `<span class="ords-belt-dot${state}" data-ords-dot="${htmlSafe(record.number)}" style="--x: ${spot}%; --i: ${at}"></span>`;
				})
				.join('');
			const more =
				step.key === 'delivered' && inStage.length > shown.length
					? `<span class="ords-belt-more">+${inStage.length - shown.length}</span>`
					: '';
			return `<div class="ords-belt-stretch ords-tone-${step.tone}">${dots}${more}</div>`;
		}).join('');
		ui.beltNote.textContent = BELT_REST;
	}

	function bindBelt() {
		ui.belt.addEventListener('pointerover', (event) => {
			const dot = event.target.closest('[data-ords-dot]');
			if (!dot) return;
			const record = recordById(dot.dataset.ordsDot);
			const state = runningLate(record) ? ', running late' : onHold(record) ? ', waiting for payment' : '';
			ui.beltNote.textContent = `${record.number} · ${accounts[record.accountId].name} · ${stageByKey[record.stage].label}${state}`;
		});
		ui.belt.addEventListener('pointerleave', () => {
			ui.beltNote.textContent = BELT_REST;
		});
	}

	function stripTile(step) {
		const inStage = orders.filter((record) => record.shipsGoods && record.stage === step.key);
		const late = inStage.filter(runningLate).length;
		const held = inStage.filter(onHold).length;
		let flag = '';
		if (late) flag = `<span class="ords-flow-flag ords-flow-flag-danger">${late} late</span>`;
		else if (held) flag = `<span class="ords-flow-flag ords-flow-flag-warning">${held} held</span>`;
		const caption =
			{ delivered: 'last 4 weeks', dispatched: 'in transit' }[step.key] ||
			(inStage.length
				? compactDollars(inStage.reduce((sum, record) => sum + record.totals.total, 0))
				: 'none waiting');
		return (
			`<li class="ords-flow-item"><button class="ords-flow-btn ords-tone-${step.tone}" data-ords-stage="${step.key}" aria-pressed="${view.stage === step.key}" type="button">` +
			`<span aria-hidden="true" class="ords-flow-icon"><i class="bi ${step.icon}"></i></span>` +
			`<span class="ords-flow-name">${step.label}</span><span class="ords-flow-count">${inStage.length}</span>` +
			`<span class="ords-flow-meta">${caption}${flag}</span></button></li>`
		);
	}

	/* A stage tile filters the list; pressing it again lifts the filter. Keyboard presses keep their focus. */
	function bindStrip() {
		ui.flow.addEventListener('click', (event) => {
			const tile = event.target.closest('[data-ords-stage]');
			if (!tile) return;
			const key = tile.getAttribute('data-ords-stage');
			view.stage = view.stage === key ? '' : key;
			redraw();
			if (event.detail !== 0) return;
			pick(`[data-ords-stage="${key}"]`, ui.flow)?.focus();
		});
	}

	/* Filters, the summary line and paging */

	function bindFilters() {
		ui.search.addEventListener('input', () => {
			clearTimeout(findDelay);
			findDelay = setTimeout(() => {
				view.query = ui.search.value.trim();
				drawList();
			}, 160);
		});
		ui.payment.addEventListener('change', () => {
			view.payment = ui.payment.value;
			drawList();
		});
		ui.channel.addEventListener('change', () => chooseChannel(ui.channel.value));

		ui.moreButton.addEventListener('click', () => {
			const firstNew = listing.matching[listing.cap];
			window.Basalt.slide(ui.tableWrap, () => {
				listing.cap += BATCH;
				drawList();
			});
			/* Focus lands on the first of the rows that just appeared. */
			if (firstNew) pick(`tr[data-ords-id="${firstNew.number}"] .ords-link`, ui.body)?.focus();
		});

		ui.empty.addEventListener('click', (event) => {
			if (event.target.closest('[data-ords-clear]')) clearEverything();
		});

		ui.exportButton.addEventListener('click', () => saveCsv(listing.matching, 'orders'));
	}

	function chooseChannel(value) {
		view.channel = value;
		ui.channel.value = value;
		refreshSelect(ui.channel);
		drawChips();
		drawList();
	}

	function clearEverything() {
		Object.assign(view, { stage: '', channel: 'all', payment: 'all', query: '' });
		ui.search.value = '';
		ui.channel.value = 'all';
		ui.payment.value = 'all';
		if (window.Basalt.select?.refresh) {
			window.Basalt.select.refresh(ui.channel);
			window.Basalt.select.refresh(ui.payment);
		}
		redraw();
		ui.search.focus();
	}

	function refreshSelect(select) {
		if (window.Basalt.select?.refresh) window.Basalt.select.refresh(select);
	}

	function drawChips() {
		const chips = [];
		if (view.stage) {
			chips.push({
				label: `Stage: ${stageByKey[view.stage].label}`,
				remove: () => {
					view.stage = '';
					redraw();
				},
			});
		}
		if (view.channel !== 'all') {
			chips.push({
				label: CHANNEL_NAMES[view.channel],
				remove: () => {
					chooseChannel('all');
				},
			});
		}
		window.Basalt.drawer?.applied(ui.chips, chips, null, ui.search);
	}

	function passesFilters(record) {
		if (view.stage && !(record.shipsGoods && record.stage === view.stage)) return false;
		if (view.channel !== 'all' && record.channel !== view.channel) return false;
		if (view.payment !== 'all' && record.payment.status !== view.payment) return false;
		if (!view.query) return true;
		const account = accounts[record.accountId];
		const text = [
			record.number,
			account.name,
			account.buyer,
			account.city,
			record.tracking || '',
			record.payment.invoice || '',
			...record.items.map((item) => catalog[item.sku].label),
		].join(' ');
		if (window.Basalt?.matchesQuery) return window.Basalt.matchesQuery(text, view.query);
		return text.toLowerCase().includes(view.query.toLowerCase());
	}

	/*
	 * Draws the rows, BATCH at a time; changing any filter starts the count
	 * over. Week headings total every matching order, including rows that
	 * are still behind the Show more button.
	 */
	function drawList() {
		const signature = [view.stage, view.channel, view.payment, view.query].join('|');
		if (signature !== listing.signature) {
			listing.signature = signature;
			listing.cap = BATCH;
		}
		const matching = orders.filter(passesFilters);
		const visible = matching.slice(0, listing.cap);
		const hiddenCount = matching.length - visible.length;
		listing.matching = matching;
		listing.visible = visible;

		ui.summary.textContent = summaryLine(matching);
		ui.tableWrap.hidden = !visible.length;
		ui.foot.hidden = !visible.length || hiddenCount > 0;
		ui.empty.hidden = visible.length > 0;
		ui.empty.innerHTML = visible.length ? '' : blankNote();
		ui.moreBar.hidden = !hiddenCount;
		ui.moreButton.textContent = `Show ${Math.min(BATCH, hiddenCount)} more`;
		ui.moreNote.textContent = hiddenCount ? `${countOf(hiddenCount, 'older order')} not shown yet.` : '';

		const markup = [];
		for (const week of groupByWeek(matching)) {
			const rows = week.records.filter((record) => visible.includes(record));
			if (rows.length) markup.push(weekHeading(new Date(week.start), week.records), ...rows.map(orderRow));
		}
		ui.body.innerHTML = markup.join('');
		window.Basalt.tips?.(ui.body);
		syncSelection();
	}

	function summaryLine(matching) {
		const worth = matching.reduce((sum, record) => sum + record.totals.total, 0);
		const owed = matching
			.filter((record) => record.payment.status !== 'paid' && record.payment.status !== 'refunded')
			.reduce((sum, record) => sum + record.totals.total, 0);
		const counted =
			matching.length === orders.length
				? countOf(matching.length, 'order')
				: `${matching.length} of ${countOf(orders.length, 'order')}`;
		return `${counted}, worth ${dollars(worth)}${owed ? `, ${compactDollars(owed)} not yet paid` : ''}`;
	}

	function groupByWeek(records) {
		const weeks = new Map();
		for (const record of records) {
			const start = weekStart(parseStamp(record.placedAt)).getTime();
			if (!weeks.has(start)) weeks.set(start, { start, records: [] });
			weeks.get(start).records.push(record);
		}
		return weeks.values();
	}

	/* Row markup */

	/* Monday to Sunday; the current and previous weeks are called by name, older ones by their dates. */
	function weekHeading(start, records) {
		const end = new Date(start);
		end.setDate(end.getDate() + 6);
		const dates =
			start.getMonth() === end.getMonth()
				? `${MONTH_ABBR[start.getMonth()]} ${start.getDate()}–${end.getDate()}`
				: `${MONTH_ABBR[start.getMonth()]} ${start.getDate()} – ${MONTH_ABBR[end.getMonth()]} ${end.getDate()}`;
		const weeksAgo = Math.round((weekStart(today) - start) / (7 * DAY_MS));
		const title = ['This week', 'Last week'][weeksAgo] || dates;
		const worth = records.reduce((sum, record) => sum + record.totals.total, 0);
		return (
			`<tr class="ords-week"><th colspan="8" scope="colgroup"><span class="ords-week-inner">` +
			`<span class="ords-week-name">${title}${weeksAgo < 2 ? `<span class="ords-week-range">${dates}</span>` : ''}</span>` +
			`<span class="ords-week-sum">${countOf(records.length, 'order')} · ${dollars(worth)}</span></span></th></tr>`
		);
	}

	function orderRow(record) {
		const ref = record.number;
		const account = accounts[record.accountId];
		const ticked = picked.has(ref);
		const [lead] = record.items;
		const extra = record.items.length - 1;
		const orderCell = record.madeHere
			? `<span class="ords-strong">${ref}</span>`
			: `<a href="${detailsUrl(record)}" class="ords-link">${ref}</a>`;
		const fullPageLink = record.madeHere
			? ''
			: `<a href="${detailsUrl(record)}" class="btn btn-icon btn-sm" data-bs-title="Open full page" data-bs-toggle="tooltip" data-bs-trigger="hover" aria-label="Open full page: ${ref}"><i aria-hidden="true" class="bi bi-arrows-angle-expand"></i></a>`;

		return (
			`<tr${ticked ? ' class="is-selected"' : ''} data-ords-id="${ref}">` +
			`<td class="ords-col-check"><input data-ords-check aria-label="Select ${ref}" type="checkbox" class="form-check-input"${ticked ? ' checked' : ''}></td>` +
			`<td data-label="Order" class="ords-col-order">${orderCell}<span class="ords-sub">${dayAndTime(record.placedAt)}</span></td>` +
			`<td data-label="Customer" class="ords-col-account"><span class="ords-who">` +
			`<span aria-hidden="true" class="basalt-avatar basalt-avatar-sm basalt-avatar-tone-${account.tone}">${initialsOf(account.name)}</span>` +
			`<span>${customerName(account, 'ords-strong ords-name')}<span class="ords-sub">${account.isStockist ? 'Wholesale · ' : ''}${htmlSafe(account.city)}</span></span></span></td>` +
			`<td data-label="Items" class="ords-col-items"><span class="ords-line">${lead.qty} × ${htmlSafe(catalog[lead.sku].label)}</span>` +
			`<span class="ords-sub">${extra ? `and ${extra} more · ` : ''}${countOf(record.totals.units, 'unit')}</span></td>` +
			`<td data-label="Stage" class="ords-col-stage">${stageBadge(record)}${noteSpan(stageHint(record))}</td>` +
			`<td data-label="Payment" class="ords-col-pay">${paymentBadge(record)}<span class="ords-sub">${paymentHint(record)}</span></td>` +
			`<td data-label="Total" class="ords-col-total"><span class="ords-money">${dollars(record.totals.total)}</span></td>` +
			`<td class="ords-col-act"><div class="basalt-row-actions">` +
			`<button data-ords-act="open" data-bs-title="Quick view" data-bs-toggle="tooltip" data-bs-trigger="hover" aria-label="Quick view: ${ref}" type="button" class="btn btn-icon btn-sm"><i aria-hidden="true" class="bi bi-layout-sidebar-inset-reverse"></i></button>` +
			`${fullPageLink}${rowMenu(record)}</div></td></tr>`
		);
	}

	function rowMenu(record) {
		const ref = record.number;
		const step = moveOnFor(record);
		const open = stillOpen(record);
		const entries = [
			step && !onHold(record) ? menuEntry('next', step.icon, step.label) : '',
			open && record.shipsGoods ? menuEntry('slip', 'bi-printer', 'Print packing slip') : '',
			record.tracking ? menuEntry('copy', 'bi-copy', 'Copy tracking number') : '',
			open
				? `<li><hr class="dropdown-divider"></li>${menuEntry('cancel', 'bi-x-circle', 'Cancel order', ' ords-danger')}`
				: '',
		].join('');
		return (
			`<div class="dropdown"><button aria-label="More for ${ref}" aria-expanded="false" data-bs-popper-config='{"strategy":"fixed"}' data-bs-toggle="dropdown" type="button" class="btn btn-icon">` +
			`<i aria-hidden="true" class="bi bi-three-dots"></i></button><ul class="dropdown-menu dropdown-menu-end">${entries}</ul></div>`
		);
	}

	function menuEntry(action, icon, label, modifier = '') {
		return `<li><button data-ords-act="${action}" type="button" class="dropdown-item${modifier}"><i aria-hidden="true" class="bi ${icon}"></i>${label}</button></li>`;
	}

	/* A shopper's name links to their profile; a stockist's is plain text. */
	function customerName(account, classes) {
		const name = htmlSafe(account.name);
		return account.page
			? `<a href="${account.page}" class="${classes}">${name}</a>`
			: `<span class="${classes}">${name}</span>`;
	}

	function stageBadge(record) {
		const step = currentStage(record);
		return `<span class="basalt-status ords-tone-${step.tone}"><i aria-hidden="true" class="bi ${step.icon}"></i>${step.label}</span>`;
	}

	/* A refund keeps the shipping; anything less than the goods reads as a partial refund. */
	function paymentBadge(record) {
		const { status } = record.payment;
		const look = PAYMENT_LOOK[status];
		const sums = record.totals;
		const partial = status === 'refunded' && sums.refunded < sums.total - sums.shipping - 0.005;
		const toneClass = look.tone === 'muted' ? 'ords-tone-muted' : `basalt-status-${look.tone}`;
		return `<span class="basalt-status basalt-status-dot ${toneClass}">${partial ? 'Partly refunded' : look.label}</span>`;
	}

	/* The short line under a stage badge: what comes next, or what is holding things up. */
	function stageHint(record) {
		if (!record.shipsGoods) {
			const session = hasService(record);
			if (record.stage === 'delivered') return { text: session ? 'Session run' : 'Sent by email' };
			if (onHold(record)) return { text: 'Held until paid', tone: 'warning' };
			return { text: session ? 'Session to book' : 'Nothing to ship' };
		}
		switch (true) {
			case record.stage === 'delivered':
				return { text: `Delivered ${shortDate(record.times.delivered)}` };
			case record.stage === 'dispatched':
				return {
					text: `${record.carrier} · ${record.arrives === todayKey ? 'arrives today' : `arrives ${shortDate(midnight(record.arrives))}`}`,
				};
			case onHold(record):
				return { text: 'Held until paid', tone: 'warning' };
			case runningLate(record):
				return {
					text: `${countOf(dayGap(midnight(record.dueOut), midnight(todayKey)), 'day')} late`,
					tone: 'danger',
				};
			case record.dueOut === todayKey:
				return { text: 'Ships today', tone: 'strong' };
			default:
				return { text: `Ship by ${shortDate(midnight(record.dueOut))}` };
		}
	}

	function paymentHint(record) {
		const bill = record.payment;
		const lines = {
			paid: () => `Paid ${shortDate(midnight(bill.paidOn))}`,
			refunded: () => `${dollars(record.totals.refunded)} back`,
			invoiced: () => `Due ${shortDate(midnight(bill.dueOn))}`,
			overdue: () => `${countOf(dayGap(midnight(bill.dueOn), midnight(todayKey)), 'day')} late`,
		};
		if (lines[bill.status]) return lines[bill.status]();
		return bill.declinedOn ? 'Card declined' : 'Card link sent';
	}

	function noteSpan(hint) {
		const toneClass = hint.tone ? ` ords-sub-${hint.tone}` : '';
		return `<span class="ords-sub${toneClass}">${htmlSafe(hint.text)}</span>`;
	}

	function blankNote() {
		const { query } = view;
		const heading = query ? `No orders match “${htmlSafe(query)}”` : 'No orders match these filters';
		const advice = query
			? 'Try an order number, a customer or a product name.'
			: 'Nothing in the last week is at this stage with this payment.';
		return (
			`<div role="status" class="basalt-empty ords-empty"><span aria-hidden="true" class="basalt-empty-icon"><i class="bi bi-bag-x"></i></span>` +
			`<p class="basalt-empty-title">${heading}</p><p class="basalt-empty-text">${advice}</p>` +
			`<button data-ords-clear type="button" class="btn btn-sm btn-outline-secondary">Clear filters</button></div>`
		);
	}

	/* Ticking rows and the bulk bar */

	function bindSelection() {
		ui.checkAll.addEventListener('change', () => {
			const on = ui.checkAll.checked;
			for (const record of listing.visible) {
				if (on) picked.add(record.number);
				else picked.delete(record.number);
			}
			for (const box of pickAll('[data-ords-check]', ui.body)) {
				box.checked = on;
				box.closest('tr').classList.toggle('is-selected', on);
			}
			syncSelection();
		});

		ui.body.addEventListener('change', (event) => {
			const box = event.target.closest('[data-ords-check]');
			if (!box) return;
			const row = box.closest('tr');
			const ref = row.getAttribute('data-ords-id');
			if (box.checked) picked.add(ref);
			else picked.delete(ref);
			row.classList.toggle('is-selected', box.checked);
			syncSelection();
		});

		ui.bulkBar.addEventListener('click', (event) => {
			const button = event.target.closest('[data-ords-bulk-act]');
			if (!button) return;
			const refs = [...picked];
			const bulk = {
				slips: () => printSlips(refs),
				export: () => saveCsv(refs.map(recordById).filter(Boolean), 'orders-selected'),
			}[button.getAttribute('data-ords-bulk-act')];
			if (bulk) {
				bulk();
				return;
			}
			picked.clear();
			drawList();
			ui.checkAll.focus();
		});
	}

	function printSlips(refs) {
		const printable = refs.filter((ref) => {
			const record = recordById(ref);
			return record && record.shipsGoods && stillOpen(record);
		});
		const any = printable.length > 0;
		notify({
			title: any
				? `${countOf(printable.length, 'packing slip')} sent to the warehouse printer`
				: 'Nothing to print',
			text:
				printable.length === refs.length
					? ''
					: 'Orders already shipped, or with nothing to ship, were left out.',
			icon: 'bi-printer',
			tone: any ? 'success' : 'info',
		});
	}

	function syncSelection() {
		const onScreen = listing.visible.map((record) => record.number);
		const tickedOnScreen = onScreen.filter((ref) => picked.has(ref)).length;
		ui.checkAll.checked = onScreen.length > 0 && tickedOnScreen === onScreen.length;
		ui.bulkBar.hidden = picked.size === 0;
		ui.bulkCount.textContent = `${picked.size} selected`;
	}

	/* Spreadsheet export */

	function saveCsv(records, baseName) {
		const header = ['Order', 'Placed', 'Channel', 'Customer', 'Units', 'Stage', 'Payment', 'Total'];
		const table = [
			header,
			...records.map((record) => [
				record.number,
				record.placedAt,
				CHANNEL_NAMES[record.channel],
				accounts[record.accountId].name,
				record.totals.units,
				currentStage(record).label,
				PAYMENT_LOOK[record.payment.status].label,
				record.totals.total.toFixed(2),
			]),
		];
		const csv = table.map((cells) => cells.map(quoteCell).join(',')).join('\r\n');
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
		link.download = `${baseName}-${todayKey}.csv`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000);
		notify({
			title: `Exported ${countOf(records.length, 'order')}`,
			text: link.download,
			icon: 'bi-download',
			tone: 'success',
		});
	}

	function quoteCell(value) {
		return `"${String(value).replace(/"/g, '""')}"`;
	}

	/* Row clicks and the actions menu */

	/*
	 * The order number, the expand icon and the bare row all lead to the
	 * full page; holding Cmd, Ctrl or Shift, or using the middle button,
	 * opens it in a new tab as a link would. The panel icon gives the quick
	 * view, and so does the row of an order made here, which has no page.
	 */
	function bindRows() {
		ui.body.addEventListener('click', (event) => {
			const trigger = event.target.closest('[data-ords-act]');
			if (trigger) {
				doAction(
					trigger.getAttribute('data-ords-act'),
					recordById(trigger.closest('tr').getAttribute('data-ords-id')),
				);
				return;
			}
			const row = plainRowUnder(event);
			if (!row) return;
			const target = rowDestination(row);
			if (!target) openPanel(row.getAttribute('data-ords-id'));
			else if (event.metaKey || event.ctrlKey || event.shiftKey) window.open(target, '_blank');
			else location.href = target;
		});

		ui.body.addEventListener('auxclick', (event) => {
			if (event.button !== 1) return;
			const row = plainRowUnder(event);
			const target = row && rowDestination(row);
			if (target) window.open(target, '_blank');
		});
	}

	/* The row under the pointer, unless the click landed on one of its own controls. */
	function plainRowUnder(event) {
		if (event.target.closest('a, button, input, label, .dropdown, .ords-col-check')) return null;
		return event.target.closest('tr[data-ords-id]');
	}

	function rowDestination(row) {
		return pick('a.ords-link', row)?.href || '';
	}

	function doAction(action, record) {
		if (!record) return;
		const handlers = {
			open: () => openPanel(record.number),
			next: () => moveOn(record),
			slip: () =>
				notify({
					title: `Packing slip for ${record.number} sent to the warehouse printer`,
					icon: 'bi-printer',
					tone: 'success',
				}),
			copy: () => copyTracking(record),
			cancel: () => cancelOrder(record),
		};
		handlers[action]?.();
	}

	function copyTracking(record) {
		const copied = () =>
			notify({
				title: 'Tracking number copied',
				text: `${record.carrier} ${record.tracking}`,
				icon: 'bi-copy',
				tone: 'success',
			});
		if (window.Basalt.copyText) window.Basalt.copyText(record.tracking).then(copied);
		else copied();
	}

	/* Moving an order along */

	function moveOn(record) {
		if (record.stage === 'packing') {
			startShipping(record);
			return;
		}
		if (!record.shipsGoods) {
			record.stage = 'delivered';
			record.times.delivered = clockNow();
			afterChange(record, `${record.number} marked done`);
			return;
		}
		const following = STAGE_LIST[stageByKey[record.stage].at + 1];
		record.stage = following.key;
		record.times[following.key] = clockNow();
		const outcome = following.key === 'delivered' ? 'marked delivered' : `moved to ${following.label}`;
		afterChange(record, `${record.number} ${outcome}`);
	}

	function afterChange(record, message) {
		redraw();
		if (panel.open && panelRef() === record.number) fillPanel(record);
		notify({ title: message, icon: 'bi-check2-circle', tone: 'success' });
		speak(message);
	}

	/* Takes the order off the list and offers to put it back in the same place. */
	function cancelOrder(record) {
		const slot = orders.indexOf(record);
		orders.splice(slot, 1);
		picked.delete(record.number);
		redraw();
		const undo = () => {
			orders.splice(slot, 0, record);
			redraw();
			speak(`${record.number} restored`);
		};
		notify({
			title: `${record.number} canceled`,
			text: 'Stock is back on the shelf.',
			icon: 'bi-x-circle',
			tone: 'danger',
			duration: 8000,
			actions: [{ label: 'Undo', onClick: undo }],
		});
	}

	/* The quick-view drawer */

	function panelRef() {
		return panel.ids[panel.index];
	}

	function panelPart(name) {
		return pick(`[data-ords-r="${name}"]`, drawer);
	}

	function bindDrawer() {
		pick('[data-basalt-record-prev]', drawer).addEventListener('click', () => showInPanel(panel.index - 1, -1));
		pick('[data-basalt-record-next]', drawer).addEventListener('click', () => showInPanel(panel.index + 1, 1));

		/* Alt with the up or down arrow walks the orders in the order they are listed. */
		drawer.addEventListener('keydown', (event) => {
			const step = { ArrowUp: -1, ArrowDown: 1 }[event.key];
			if (!event.altKey || !step) return;
			event.preventDefault();
			showInPanel(panel.index + step, step);
		});

		drawer.addEventListener('show.bs.offcanvas', () => {
			panel.open = true;
			moveToasts('bottom-center');
		});
		drawer.addEventListener('hidden.bs.offcanvas', () => {
			panel.open = false;
			moveToasts('bottom-end');
		});

		drawerAction.addEventListener('click', () => {
			const record = recordById(panelRef());
			if (!record) return;
			if (drawerAction.dataset.mode !== 'remind') {
				moveOn(record);
				return;
			}
			notify({
				title: 'Payment link sent again',
				text: `To ${accounts[record.accountId].email}`,
				icon: 'bi-send',
				tone: 'success',
			});
		});

		drawer.addEventListener('click', (event) => {
			if (event.target.closest('[data-ords-copy]')) doAction('copy', recordById(panelRef()));
		});
	}

	/* Steps through the rows on screen; an order the filters now hide (it just shipped, say) steps through them all. */
	function openPanel(ref) {
		panel.ids = listing.visible.map((record) => record.number);
		if (!panel.ids.includes(ref)) panel.ids = orders.map((record) => record.number);
		showInPanel(panel.ids.indexOf(ref));
		bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
	}

	function showInPanel(position, direction) {
		const total = panel.ids.length;
		panel.index = (position + total) % total;
		const record = recordById(panel.ids[panel.index]);
		if (record) fillPanel(record);
		pick('[data-basalt-record-pos]', drawer).textContent = `${panel.index + 1} of ${total}`;
		drawer.classList.toggle('is-back', direction < 0);
	}

	function fillPanel(record) {
		const account = accounts[record.accountId];
		const avatar = panelPart('avatar');
		const fullLink = panelPart('full');
		avatar.className = `basalt-avatar basalt-avatar-sm basalt-avatar-tone-${account.tone}`;
		avatar.textContent = initialsOf(account.name);
		panelPart('title').textContent = record.number;
		fullLink.href = detailsUrl(record);
		fullLink.hidden = Boolean(record.madeHere);
		panelPart('sub').innerHTML = `${customerName(account, 'ords-name')} · ${CHANNEL_NAMES[record.channel]}`;
		panelPart('state').innerHTML =
			`<div class="ords-r-pills">${stageBadge(record)}${paymentBadge(record)}</div>${panelAlert(record)}`;
		panelPart('steps').innerHTML = progressSteps(record);
		panelPart('lines').innerHTML = record.items.map(itemLine).join('');
		panelPart('sums').innerHTML = sumRows(record);
		panelPart('delivery').innerHTML = deliveryFacts(record);
		panelPart('payment').innerHTML = `${fact('Amount', dollars(record.totals.total))}${paymentFacts(record)}`;
		setPanelAction(record);
	}

	/* While payment is outstanding the main button resends the link instead of moving the order on. */
	function setPanelAction(record) {
		const step = moveOnFor(record);
		const held = onHold(record);
		drawerAction.hidden = !step;
		drawerAction.parentElement.hidden = !step;
		if (step) {
			drawerAction.innerHTML = held
				? '<i aria-hidden="true" class="bi bi-send me-1"></i>Resend payment link'
				: `<i aria-hidden="true" class="bi ${step.icon} me-1"></i>${step.label}`;
		}
		drawerAction.dataset.mode = held ? 'remind' : 'next';
	}

	function panelAlert(record) {
		const bill = record.payment;
		if (bill.status === 'awaiting') {
			const firstName = htmlSafe(accounts[record.accountId].buyer.split(' ')[0]);
			const declined = bill.declinedOn ? `Card declined on ${shortDate(midnight(bill.declinedOn))}. ` : '';
			return alertBox(
				'warning',
				'bi-credit-card',
				`${declined}It ships once ${firstName} pays the link we sent.`,
			);
		}
		if (bill.status === 'overdue') {
			const after = bill.holdUntilPaid ? 'The order ships once it is paid.' : 'A reminder goes out on Monday.';
			return alertBox(
				'danger',
				'bi-clock-history',
				`${bill.invoice} was due ${shortDate(midnight(bill.dueOn))}. ${after}`,
			);
		}
		return '';
	}

	function alertBox(tone, icon, html) {
		return `<p class="ords-alert ords-alert-${tone}"><i aria-hidden="true" class="bi ${icon}"></i><span>${html}</span></p>`;
	}

	function progressSteps(record) {
		const reached = currentStage(record).at;
		return stagePath(record)
			.map((step, position) => {
				const done = position < reached || (position === reached && step.key === 'delivered');
				const isCurrent = position === reached && !done;
				const state = done ? 'is-done' : position === reached ? 'is-now' : 'is-next';
				const marker = done
					? '<i aria-hidden="true" class="bi bi-check-lg"></i>'
					: `<span aria-hidden="true">${position + 1}</span>`;
				const hidden = isCurrent ? '<span class="visually-hidden"> (current stage)</span>' : '';
				return (
					`<li class="ords-step ${state}"><span class="ords-step-mark">${marker}</span>` +
					`<span class="ords-step-name">${step.label}${hidden}</span>` +
					`<span class="ords-step-time">${stepTime(record, step, position, reached, done)}</span></li>`
				);
			})
			.join('');
	}

	function stepTime(record, step, position, reached, done) {
		const when = position === 0 ? record.placedAt : record.times[step.key];
		if (done) return dayAndTime(when);
		if (position === reached) return `Since ${dayAndTime(when)}`;
		if (step.key === 'dispatched') {
			if (onHold(record)) return 'Once paid';
			const due = shortDate(midnight(record.dueOut));
			return runningLate(record) ? `Late, was due ${due}` : `Ship by ${due}`;
		}
		if (step.key === 'delivered' && record.arrives) return `Expected ${shortDate(midnight(record.arrives))}`;
		return '';
	}

	function itemLine({ sku, qty }) {
		const product = catalog[sku];
		return (
			`<li class="ords-item"><span aria-hidden="true" class="ords-item-icon ords-tone-${product.tone}"><i class="bi ${product.icon}"></i></span>` +
			`<span class="ords-item-text"><span class="ords-strong">${htmlSafe(product.label)}</span>` +
			`<span class="ords-sub">${qty} × ${dollars(product.price)} · <span class="ords-mono">${sku}</span></span></span>` +
			`<span class="ords-money">${dollars(product.price * qty)}</span></li>`
		);
	}

	function sumRows(record) {
		const sums = record.totals;
		const account = accounts[record.accountId];
		const codeName = discountCode(record);
		const rows = [fact('Subtotal', dollars(sums.subtotal))];
		if (sums.discount) {
			const offer = codeName ? shop.DISCOUNTS[codeName] : null;
			const heading = offer === shop.DISCOUNTS.STOCKIST ? 'Stockist price' : `Code ${htmlSafe(codeName)}`;
			rows.push(fact(`${heading}${subNote(htmlSafe(offer.label))}`, `−${dollars(sums.discount)}`));
		}
		const method = shop.SHIPPING[sums.ship];
		if (method) {
			const freeNote = sums.shipping || !method.freeOver ? '' : `, free over $${method.freeOver}`;
			rows.push(
				fact(
					`Shipping${subNote(`${htmlSafe(sums.ship)}${freeNote}`)}`,
					sums.shipping ? dollars(sums.shipping) : 'Free',
				),
			);
		}
		rows.push(fact(`Tax${subNote(htmlSafe(shop.TAX[account.taxCode].label))}`, dollars(sums.tax)));
		rows.push(`<div class="ords-sums-total"><dt>Total</dt><dd>${dollars(sums.total)}</dd></div>`);
		return rows.join('');
	}

	function deliveryFacts(record) {
		const account = accounts[record.accountId];
		if (!record.shipsGoods) {
			const session =
				record.stage === 'delivered'
					? 'The styling team ran the session with '
					: 'The styling team books the session with ';
			const how = hasService(record)
				? `${session}${htmlSafe(account.buyer)}.`
				: `Sent to ${htmlSafe(account.email)} by email.`;
			return fact('Nothing ships', how);
		}
		const recipient = `${htmlSafe(account.buyer)}${account.isStockist ? `, ${htmlSafe(account.name)}` : ''}`;
		const service = `${record.speed === 'express' ? 'Express' : 'Ground'}, ship by ${shortDate(midnight(record.dueOut))}`;
		const carrier = record.tracking
			? `${htmlSafe(record.carrier)} <span class="ords-mono">${record.tracking}</span> <button data-ords-copy aria-label="Copy the tracking number" type="button" class="btn btn-icon ords-copy"><i aria-hidden="true" class="bi bi-copy"></i></button>`
			: `${htmlSafe(account.carrier)}, when packed`;
		return (
			fact('Ship to', `${recipient}<br>${account.address.map((part) => htmlSafe(part)).join('<br>')}`) +
			fact('Service', service) +
			fact('Carrier', carrier)
		);
	}

	function paymentFacts(record) {
		const bill = record.payment;
		const email = htmlSafe(accounts[record.accountId].email);
		if (bill.status === 'paid' || bill.status === 'refunded') {
			const paidRow = fact('Paid', `${shortDate(midnight(bill.paidOn))} by ${htmlSafe(bill.via)}`);
			if (bill.status === 'paid') return paidRow;
			const refundedOn = shortDate(midnight(bill.refund.date));
			return (
				paidRow +
				fact(
					'Refunded',
					`${dollars(record.totals.refunded)} on ${refundedOn}, ${htmlSafe(bill.refund.reason.toLowerCase())}`,
				)
			);
		}
		if (bill.status === 'awaiting') {
			return (
				fact('Card', `${htmlSafe(bill.cardName)}${bill.declinedOn ? ', declined' : ', not charged yet'}`) +
				fact('Next', `Payment link sent to ${email}`)
			);
		}
		return (
			fact('Invoice', bill.invoice) +
			fact('Terms', `Pay in ${bill.termDays} days, due ${shortDate(midnight(bill.dueOn))}`)
		);
	}

	function fact(term, detail) {
		return `<div><dt>${term}</dt><dd>${detail}</dd></div>`;
	}

	function subNote(html) {
		return `<span class="ords-sub">${html}</span>`;
	}

	/* The Ship dialog */

	/*
	 * Opened from the drawer, the dialog replaces it and gives it back when
	 * it closes, so focus only ever lives in one panel.
	 */
	function startShipping(record) {
		if (!panel.open) {
			fillShipDialog(record);
			return;
		}
		shipping.returnToPanel = true;
		drawer.addEventListener('hidden.bs.offcanvas', () => fillShipDialog(record), { once: true });
		bootstrap.Offcanvas.getOrCreateInstance(drawer).hide();
	}

	function fillShipDialog(record) {
		const account = accounts[record.accountId];
		shipping.order = record;
		pick('[data-ords-d="sub"]', shipDialog).textContent =
			`${record.number} for ${account.name}, ${countOf(record.totals.units, 'unit')}.`;
		for (const radio of pickAll('input[name="ordCarrier"]', shipDialog))
			radio.checked = radio.value === account.carrier;
		trackingField.value = '';
		markValid(trackingField);
		pick('[data-ords-d="notify"]', shipDialog).checked = true;
		pick('[data-ords-d="notify-label"]', shipDialog).textContent = `Email the tracking link to ${account.buyer}`;
		bootstrap.Modal.getOrCreateInstance(shipDialog).show();
	}

	function bindShipDialog() {
		shipDialog.addEventListener('shown.bs.modal', () => trackingField.focus());
		shipDialog.addEventListener('hidden.bs.modal', () => {
			if (!shipping.returnToPanel) return;
			shipping.returnToPanel = false;
			openPanel(shipping.order.number);
		});
		trackingField.addEventListener('input', () => markValid(trackingField));
		shipForm.addEventListener('submit', (event) => {
			event.preventDefault();
			confirmShipment();
		});
	}

	/* Tracking numbers lose their spaces and go upper case; anything under eight characters is refused. */
	function confirmShipment() {
		const record = shipping.order;
		const account = accounts[record.accountId];
		const code = trackingField.value.replace(/\s+/g, '').toUpperCase();
		if (code.length < 8) {
			markInvalid(trackingField);
			trackingField.focus();
			return;
		}
		const carrier = pick('input[name="ordCarrier"]:checked', shipDialog)?.value || account.carrier;
		const emailed = pick('[data-ords-d="notify"]', shipDialog).checked;
		const transitDays = record.speed === 'express' ? 1 : account.address[2] === 'United States' ? 2 : 3;
		Object.assign(record, {
			stage: 'dispatched',
			carrier,
			tracking: code,
			arrives: addWorkDays(midnight(todayKey), transitDays),
		});
		record.times.dispatched = clockNow();
		bootstrap.Modal.getOrCreateInstance(shipDialog).hide();
		afterChange(record, `${record.number} shipped with ${carrier}${emailed ? ', tracking link emailed' : ''}`);
	}

	function markInvalid(field) {
		field.classList.add('is-invalid');
		field.setAttribute('aria-invalid', 'true');
	}

	function markValid(field) {
		field.classList.remove('is-invalid');
		field.removeAttribute('aria-invalid');
	}

	/* The New order dialog */

	function bindNewDialog() {
		newDialog.addEventListener('show.bs.modal', () => {
			draftForm.reset();
			customerField.value = '';
			customerField.classList.remove('is-invalid');
			refreshSelect(customerField);
			productRows.innerHTML = '';
			addProductRow('ML-BLAZ');
		});

		newDialog.addEventListener('click', (event) => {
			if (event.target.closest('[data-ords-n="add"]')) {
				addProductRow('ML-OXFD');
				pickAll('.ords-pick-row select', productRows).at(-1).focus();
				return;
			}
			const remover = event.target.closest('[data-ords-n-remove]');
			if (!remover) return;
			remover.closest('li').remove();
			updateNewSummary();
			pick('[data-ords-n="add"]', newDialog).focus();
		});

		newDialog.addEventListener('change', (event) => {
			if (event.target === customerField) markValid(customerField);
			updateNewSummary();
		});
		newDialog.addEventListener('input', () => updateNewSummary());

		draftForm.addEventListener('submit', (event) => {
			event.preventDefault();
			createOrder();
		});
	}

	function addProductRow(sku) {
		lineCount += 1;
		const selectId = `ords-new-line-${lineCount}`;
		const choices = Object.entries(catalog)
			.map(
				([code, product]) =>
					`<option${code === sku ? ' selected' : ''} value="${code}">${htmlSafe(product.label)} · ${dollars(product.price)}</option>`,
			)
			.join('');
		const row = document.createElement('li');
		row.className = 'ords-pick-row';
		row.innerHTML =
			`<label for="${selectId}" class="visually-hidden">Product</label><select id="${selectId}" class="form-select">${choices}</select>` +
			'<div data-basalt-stepper class="basalt-stepper ords-pick-qty">' +
			'<button data-basalt-step="-1" aria-label="One fewer" type="button" class="basalt-stepper-btn"><i aria-hidden="true" class="bi bi-dash-lg"></i></button>' +
			'<input aria-label="Quantity" inputmode="numeric" min="1" max="200" value="1" type="number" class="basalt-stepper-input">' +
			'<button data-basalt-step="1" aria-label="One more" type="button" class="basalt-stepper-btn"><i aria-hidden="true" class="bi bi-plus-lg"></i></button></div>' +
			'<button data-ords-n-remove aria-label="Remove this product" type="button" class="btn btn-icon ords-pick-remove"><i aria-hidden="true" class="bi bi-trash3"></i></button>';
		productRows.appendChild(row);
		window.Basalt.stepper?.(pick('[data-basalt-stepper]', row));
		updateNewSummary();
	}

	function chosenProducts() {
		return pickAll('.ords-pick-row', productRows).map((row) => ({
			sku: pick('select', row).value,
			qty: Math.max(1, parseInt(pick('input', row).value, 10) || 1),
		}));
	}

	function chosenSpeed() {
		return pick('input[name="ordSpeed"]:checked', newDialog).value;
	}

	/* Prices the draft as it stands; with no customer picked yet it uses the first account. */
	function updateNewSummary() {
		const rows = pickAll('.ords-pick-row', productRows);
		for (const row of rows) pick('[data-ords-n-remove]', row).hidden = rows.length === 1;
		const draft = {
			accountId: customerField.value || Object.keys(accounts)[0],
			items: chosenProducts(),
			speed: chosenSpeed(),
		};
		const sums = totalsFor(draft);
		const delivery = sums.shipping ? dollars(sums.shipping) : 'free';
		newSummary.innerHTML =
			`${countOf(sums.units, 'unit')}, <strong>${dollars(sums.subtotal - sums.discount)}</strong>` +
			`${sums.discount ? ' at the wholesale price' : ''} before tax · shipping ${delivery}`;
	}

	/*
	 * Adds the order at the top of the list. Web orders are numbered SO-
	 * and wholesale ones WO-, each sequence counting on from its highest.
	 */
	function createOrder() {
		if (!customerField.value) {
			markInvalid(customerField);
			const sibling = customerField.nextElementSibling;
			(sibling && sibling.matches('.basalt-select-trigger, button') ? sibling : customerField).focus();
			return;
		}
		const quantities = {};
		for (const { sku, qty } of chosenProducts()) quantities[sku] = (quantities[sku] || 0) + qty;
		const speed = chosenSpeed();
		const accountId = customerField.value;
		const account = accounts[accountId];
		/* Shop and wholesale orders share one numbering: the next is one past the highest. */
		const used = [
			...orders.map((record) => record.number),
			...shop.WHOLESALE.map((entry) => entry.orderNumber),
		].map((number) => Number(String(number).replace(/\D/g, '')));
		const number = `#${Math.max(...used) + 1}`;
		const placedAt = clockNow();
		const payment = account.paysByCard
			? { status: 'paid', paidOn: todayKey, via: account.cardName || 'Card' }
			: {
					status: 'invoiced',
					invoice: `#${5000 + Number(number.replace(/\D/g, ''))}`,
					termDays: 30,
					dueOn: shiftDays(placedAt, 30),
				};

		const record = finishRecord({
			number,
			madeHere: true,
			accountId,
			channel: account.isStockist ? 'wholesale' : 'online',
			shipsGoods: Object.keys(quantities).some((sku) => shop.kind(sku) === 'goods'),
			placedAt,
			speed,
			stage: 'received',
			dueOut: addWorkDays(placedAt, speed === 'express' ? 1 : 2),
			items: Object.entries(quantities).map(([sku, qty]) => ({ sku, qty })),
			payment,
		});
		orders.unshift(record);
		bootstrap.Modal.getOrCreateInstance(newDialog).hide();
		redraw();
		notify({
			title: `${number} created for ${account.name}`,
			text: `${countOf(record.totals.units, 'unit')}, ${dollars(record.totals.total)}`,
			icon: 'bi-bag-check',
			tone: 'success',
			actions: [{ label: 'Open', onClick: () => openPanel(number) }],
		});
		speak(`${number} created`);
	}

	/* Shared services from basalt.js */

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function moveToasts(corner) {
		window.Basalt.toasts?.position(corner);
	}

	function speak(message) {
		window.Basalt.announce?.(message);
	}

	/* Dates, times and money as text */

	/* The book writes "YYYY-MM-DDTHH:MM"; this page keeps a space where the T was. */
	function spaced(stamp) {
		return stamp.replace('T', ' ');
	}

	function midnight(key) {
		return `${key} 00:00`;
	}

	function parseStamp(stamp) {
		const [datePart, timePart = '00:00'] = stamp.split(' ');
		const [year, month, date] = datePart.split('-').map(Number);
		const [hours, minutes] = timePart.split(':').map(Number);
		return new Date(year, month - 1, date, hours, minutes);
	}

	function twoDigits(value) {
		return String(value).padStart(2, '0');
	}

	function dateKey(when) {
		return `${when.getFullYear()}-${twoDigits(when.getMonth() + 1)}-${twoDigits(when.getDate())}`;
	}

	function stampOf(when) {
		return `${dateKey(when)} ${twoDigits(when.getHours())}:${twoDigits(when.getMinutes())}`;
	}

	function addMinutes(stamp, minutes) {
		const when = parseStamp(stamp);
		when.setMinutes(when.getMinutes() + minutes);
		return stampOf(when);
	}

	function shiftDays(stamp, days) {
		const when = parseStamp(stamp);
		when.setDate(when.getDate() + days);
		return dateKey(when);
	}

	/* Counts forward over weekdays only. */
	function addWorkDays(stamp, days) {
		const when = parseStamp(stamp);
		let left = days;
		while (left > 0) {
			when.setDate(when.getDate() + 1);
			if (when.getDay() !== 0 && when.getDay() !== 6) left -= 1;
		}
		return dateKey(when);
	}

	function weekStart(when) {
		const monday = new Date(when.getFullYear(), when.getMonth(), when.getDate());
		monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
		return monday;
	}

	function dayGap(fromStamp, toStamp) {
		return Math.round((parseStamp(toStamp) - parseStamp(fromStamp)) / DAY_MS);
	}

	/* The demo's "now": the pinned date with the visitor's own clock time. */
	function clockNow() {
		const when = new Date(today);
		const clock = new Date();
		when.setHours(clock.getHours(), clock.getMinutes());
		return stampOf(when);
	}

	function shortDate(stamp) {
		const when = parseStamp(stamp);
		return `${MONTH_ABBR[when.getMonth()]} ${when.getDate()}`;
	}

	function dayAndTime(stamp) {
		const hours = Number(stamp.slice(11, 13));
		const suffix = hours < 12 ? ' am' : ' pm';
		return `${shortDate(stamp)}, ${hours % 12 || 12}:${stamp.slice(14, 16)}${suffix}`;
	}

	function dollars(amount) {
		return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function compactDollars(amount) {
		if (amount < 1000) return `$${Math.round(amount)}`;
		return `$${(amount / 1000).toFixed(1).replace(/\.0$/, '')}k`;
	}

	function countOf(amount, noun) {
		return `${amount} ${noun}${amount === 1 ? '' : 's'}`;
	}

	/* Text and DOM */

	function initialsOf(name) {
		return name
			.split(/\s+/)
			.filter((word) => /^\p{Lu}/u.test(word))
			.slice(0, 2)
			.map((word) => word[0])
			.join('');
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
