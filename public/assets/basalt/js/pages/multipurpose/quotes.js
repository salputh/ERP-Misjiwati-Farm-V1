/**
 * Quotes (quotes.html). Holds every quote the team has written. A plan
 * quote prices seats and add-ons for a deal or a renewal and gets signed; a
 * services quote prices courses and set-up for one account and turns into
 * an order. Each one is drafted, sent, and then won, declined or lapsed.
 *
 * Paints the stage tiles that also switch the list, the follow-up cards on
 * Awaiting reply, the list, both insight cards, the quick view, and the New
 * quote and Turn into an order dialogs. A row leads to the quote's own page
 * and its panel button to the quick view; quotes written during the demo
 * have no page, so their rows open the quick view instead. Records come
 * from the shared demo data, and a pinned demo day keeps the dates steady.
 */
(() => {
	'use strict';

	const host = pick('[data-qt-root]');
	if (!host) return;

	/* The demo always runs on Friday, October 9, 2026, from local midnight. */
	const DEMO_DAY = new Date(2026, 9, 9);
	const todayKey = dateKey(DEMO_DAY);

	/* Quotes, catalog and accounts live in assets/basalt/js/data/multipurpose/deals.js and
     assets/basalt/js/data/multipurpose/accounts.js, so Quote Details, the deal pages and the
     account pages read the very same records. */
	const store = window.Basalt.data.deals;
	const catalog = store.products;
	const sourceQuotes = store.quotes();

	/* Plans and add-ons cost a seat a year, courses and set-up work an item.
     Twenty course places or more on one quote take 5% off the courses. */
	const BULK = { atLeast: 20, cut: 0.05 };

	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const MONTH_NAME = { Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September' };
	const ENTITY = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	/* Each account a new quote can go to, paired with its usual buyer. */
	const buyerByAccount = {};
	for (const source of sourceQuotes) {
		if (source.kind !== 'store') continue;
		if (!buyerByAccount[source.acct] || !source.to) buyerByAccount[source.acct] = partyFrom(source);
	}

	/* Everyone who writes quotes: the services team and every deal owner. */
	const senders = { ...store.reps };
	for (const name of store.owners) {
		senders[store.slug(name)] = { name, role: 'Account owner', tone: toneFor(name) };
	}

	const STATUS_LOOK = {
		draft: { text: 'Draft', dot: '' },
		sent: { text: 'Sent', dot: 'basalt-status-dot basalt-status-info' },
		accepted: { text: 'Accepted', dot: 'basalt-status-dot basalt-status-success' },
		declined: { text: 'Declined', dot: 'basalt-status-dot basalt-status-danger' },
		expired: { text: 'Lapsed', dot: '' },
	};

	/* A sent plan quote reads its deal's stage instead of plain Sent. */
	const stageById = Object.fromEntries(store.stages.map((stage) => [stage.id, stage]));
	const PLAN_STAGE_WORDS = { negotiation: 'Negotiating', signature: 'Out for signature' };

	/* Both cards describe the same 83 decided quotes: per month for the last
     half year, and per seller from July to September. */
	const DECIDED = [
		{ month: 'Apr', won: 14, declined: 5, lapsed: 3 },
		{ month: 'May', won: 17, declined: 4, lapsed: 4 },
		{ month: 'Jun', won: 15, declined: 6, lapsed: 2 },
		{ month: 'Jul', won: 19, declined: 5, lapsed: 3 },
		{ month: 'Aug', won: 16, declined: 7, lapsed: 4 },
		{ month: 'Sep', won: 21, declined: 5, lapsed: 3 },
	];
	const SELLER_TALLY = [
		{ seller: 'reid', won: 23, of: 31 },
		{ seller: 'paige', won: 15, of: 22 },
		{ seller: 'neal', won: 11, of: 18 },
		{ seller: 'brittany', won: 7, of: 12 },
	];

	/* The five stages: what each holds, how it sorts, what its tile says
     and what the list says when it has nothing to show. */
	const STAGES = {
		open: {
			heading: 'Awaiting reply',
			blurb: 'Waiting on the buyer, the soonest to close first.',
			none: 'Nothing is waiting on a buyer.',
			holds: (quote) => quote.status === 'sent',
			order: (a, b) => decideBy(a).localeCompare(decideBy(b)) || b.price.total - a.price.total,
			tile: (members) => `${worthTag(members)} · ${compactDollars(sumOf(members, weighted))} expected`,
		},
		draft: {
			heading: 'Drafts',
			blurb: 'Not sent yet, the latest edited first.',
			none: 'No drafts. Start one with New quote.',
			holds: (quote) => quote.status === 'draft',
			order: (a, b) => b.edited.localeCompare(a.edited),
			tile: (members) => `${worthTag(members)} · not sent yet`,
		},
		won: {
			heading: 'Won',
			blurb: 'Accepted by the buyer, the latest first.',
			none: 'No accepted quotes yet.',
			holds: isWon,
			order: (a, b) => b.closed.localeCompare(a.closed),
			tile(members) {
				const unordered = members.filter((quote) => !isPlan(quote) && !quote.order).length;
				return worthTag(members) + (unordered ? ` · ${unordered} not an order yet` : ' · all ordered');
			},
		},
		lost: {
			heading: 'Lost',
			blurb: 'Declined, or lapsed without a reply, the latest first.',
			none: 'Nothing declined or lapsed.',
			holds: isLost,
			order: (a, b) => (b.closed || b.expires).localeCompare(a.closed || a.expires),
			tile: (members) =>
				`${worthTag(members)} · ${members.filter((quote) => quote.status === 'declined').length} declined`,
		},
		all: {
			heading: 'All quotes',
			blurb: 'Every quote from the last 90 days, newest first.',
			none: 'No quotes yet.',
			holds: () => true,
			order: (a, b) => b.id.localeCompare(a.id),
			tile: (members) => `${worthTag(members)} · last 90 days`,
		},
	};

	/* What each data-qt-act name does to a quote. */
	const ACTIONS = {
		open: (quote) => openQuickView(quote.id),
		send: sendQuote,
		remind: nudgeBuyer,
		extend: prolong,
		convert: beginOrder,
		sign: markSigned,
		decline: markDeclined,
		copy: (quote) => cloneQuote(quote, false),
		requote: (quote) => cloneQuote(quote, true),
		delete: discard,
	};

	/* Pressure on a sent quote, as the tone of its small print. */
	const PRESSURE_TONE = { urgent: 'danger', soon: 'warning', calm: '' };

	/* The New quote picker lists plans and add-ons above courses and set-up. */
	const PICKER_GROUPS = [
		{ label: 'Plans and add-ons', keeps: (item) => item.sub },
		{ label: 'Courses and set-up', keeps: (item) => !item.sub },
	];

	const PAGE_SIZE = 10;
	const CHART_FONT = "'Schibsted Grotesk', sans-serif";
	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

	const filters = { stage: 'open', owner: 'all', text: '' };
	let records = [];
	/* The count each summary tile last showed, so a change counts on from it. */
	const tileShown = {};
	/* The quotes behind each tile's bars, largest first, for the hover readout. */
	const tileBars = {};
	let onScreen = [];
	let pageNo = 1;
	let pagination = null;
	let findDelay;

	let drawerShown = false;
	let walkIds = [];
	let walkAt = 0;
	let orderTarget = null;
	let reopenDrawer = false;
	let pickerCount = 0;
	let monthsChart = null;
	let chartLive = false;

	const ui = {
		tbody: pick('[data-qt-body]', host),
		columnHead: pick('[data-qt-valid-head]', host),
		chase: pick('[data-qt-chase]', host),
		chaseList: pick('[data-qt-chase-list]', host),
		pager: pick('[data-qt-pager]', host),
		range: pick('[data-qt-range]', host),
		pages: pick('[data-qt-pages]', host),
		tableWrap: pick('.qt-table-wrap', host),
		empty: pick('[data-qt-empty]', host),
		foot: pick('[data-qt-foot]', host),
		summary: pick('[data-qt-summary]', host),
		heading: pick('[data-qt-view-title]', host),
		blurb: pick('[data-qt-view-sub]', host),
		search: pick('[data-qt-search]', host),
		owner: pick('[data-qt-rep]', host),
		stages: pick('[data-qt-views]', host),
		exportButton: pick('[data-qt-export]', host),
		monthsCanvas: pick('[data-qt-months]', host),
	};

	const quickView = pick('#qt-record');
	const primaryAction = pick('[data-qt-r-main]', quickView);
	const orderDialog = pick('#qt-convert');
	const orderForm = pick('[data-qt-convert-form]', orderDialog);
	const newDialog = pick('#qt-new');
	const draftForm = pick('[data-qt-new-form]', newDialog);
	const accountSelect = pick('[data-qt-n="account"]', newDialog);
	const pickerList = pick('[data-qt-n="lines"]', newDialog);
	const newSummary = pick('[data-qt-n="sum"]', newDialog);

	/**
	 * Builds the working records, wires every control on the page and its
	 * dialogs, then paints the page once.
	 */
	function start() {
		records = sourceQuotes.map(seedRecord).map(normalize);

		bindList();
		bindQuickView();
		bindOrderDialog();
		bindNewDialog();
		bindChart();
		bindTileBars();

		writeInsights();
		rerender();
	}

	/* Records: the working copy of each quote and what can be read off it. */

	/**
	 * The working copy of one quote. Times are local "YYYY-MM-DD HH:MM",
	 * `valid` is how many days the prices hold once sent, and `views` are
	 * the moments the buyer opened it. A services quote that became an
	 * order keeps the order number; a plan quote keeps its deal, the deal's
	 * stage and its expected close.
	 */
	function seedRecord(source) {
		const plan = source.kind === 'plan';
		return {
			id: source.id,
			kind: source.kind,
			acct: source.acct,
			party: partyFrom(source),
			owner: plan ? store.slug(source.owner) : source.rep.id,
			status: source.status,
			sent: source.sent,
			edited: source.edited,
			valid: source.valid,
			views: source.views,
			reminders: source.reminders,
			closed: source.closed,
			order: source.order,
			reason: source.reason,
			lines: source.lines,
			deal: source.deal || '',
			stage: source.dealStage || '',
			closeBy: source.closes || '',
			subscription: source.account ? source.account.sub : '',
		};
	}

	/** Fills in the defaults a record may lack and prices it. */
	function normalize(record) {
		record.views ||= [];
		record.reminders ||= [];
		record.extensions ||= [];
		record.pace ||= 'ground';
		if (record.sent && !record.expires) record.expires = shiftDays(record.sent, record.valid);
		record.price = priceOut(record);
		return record;
	}

	/**
	 * Who the quote is addressed to, the tax its invoice carries and how the
	 * account pays. Plan quotes leave the tax to the invoice.
	 */
	function partyFrom(source) {
		return {
			name: source.company,
			contact: source.buyer.name,
			email: source.buyer.email,
			tone: source.tone || toneFor(source.company),
			tax: source.kind === 'plan' ? null : source.tax,
			terms: source.terms,
			card: source.card,
			pay: source.pay,
		};
	}

	/**
	 * The sums Quote Details shows as well. A plan quote counts its first
	 * year with free set-up and tax left to the invoice; a services quote
	 * adds set-up and tax.
	 */
	function priceOut(record) {
		let subtotal = 0;
		let courseCost = 0;
		let coursePlaces = 0;
		let units = 0;
		let physical = false;

		for (const [sku, qty] of record.lines) {
			const item = catalog[sku];
			const cost = item.price * qty;
			subtotal += cost;
			if (item.device) {
				courseCost += cost;
				coursePlaces += qty;
			}
			if (!item.service) physical = true;
			if (!item.service && !item.sub) units += qty;
		}

		const discount = coursePlaces >= BULK.atLeast ? Math.round(courseCost * BULK.cut * 100) / 100 : 0;
		const hasSetup = record.kind !== 'plan' && physical;
		const net = subtotal - discount;
		let setup = 0;
		if (hasSetup) setup = record.pace === 'express' ? 45 : net >= 500 ? 0 : 18;
		const rate = record.party.tax;
		const tax = rate ? Math.round((net + setup) * rate[1] * 100) / 100 : 0;

		return { subtotal, discount, setup, tax, total: net + setup + tax, units, hasSetup };
	}

	function nodeById(id) {
		return records.find((quote) => quote.id === id);
	}

	function isPlan(quote) {
		return quote.kind === 'plan';
	}

	function isWon(quote) {
		return quote.status === 'accepted';
	}

	function isLost(quote) {
		return quote.status === 'declined' || quote.status === 'expired';
	}

	/* A sent quote whose last valid day has gone by lapses by itself. */
	function expireOverdue() {
		for (const quote of records) {
			if (quote.status === 'sent' && quote.expires < todayKey) quote.status = 'expired';
		}
	}

	function remainingDays(quote) {
		return gapInDays(todayKey, quote.expires);
	}

	function pressure(left) {
		if (left <= 3) return 'urgent';
		return left <= 7 ? 'soon' : 'calm';
	}

	/**
	 * The chance an open quote is won, in percent. Plan quotes take it from
	 * their deal's stage; services quotes from whether the buyer looked.
	 */
	function odds(quote) {
		if (quote.stage) return stageById[quote.stage].chance;
		return quote.views.length ? 40 : 20;
	}

	function weighted(quote) {
		return Math.round((quote.price.total * odds(quote)) / 100);
	}

	/* When a decision is due: the deal's expected close on a plan quote, the
     day it lapses on a services quote. */
	function decideBy(quote) {
		return quote.closeBy || quote.expires;
	}

	function latestView(quote) {
		return quote.views[quote.views.length - 1];
	}

	/** The next free number after the highest in `ids`, never below `floor`. */
	/** The next number in a series: one past the highest taken, at least past `floor`. */
	function freshId(ids, floor) {
		const highest = Math.max(...ids.map((id) => Number(String(id).replace(/\D/g, '')) || 0), floor);
		return `#${highest + 1}`;
	}

	/* Where a quote, its deal, its subscription and its order live. */

	function quoteUrl(quote) {
		return quote.local ? '' : `quote-details.html?id=${encodeURIComponent(quote.id)}`;
	}

	function dealUrl(quote) {
		return `deal-details.html?id=${encodeURIComponent(quote.deal)}`;
	}

	function subUrl(quote) {
		return `subscription-details.html?id=${encodeURIComponent(quote.subscription)}`;
	}

	/* Fieldline bills orders to the account, so an order opens Invoices. */
	function orderUrl() {
		return 'invoices.html';
	}

	/* Small pieces of markup that the list, the cards and the quick view share. */

	function note(html, tone) {
		return `<span class="qt-sub${tone ? ` qt-sub-${tone}` : ''}">${html}</span>`;
	}

	function line(html) {
		return `<span class="qt-line">${html}</span>`;
	}

	function avatarTag(tone, name) {
		return `<span class="basalt-avatar basalt-avatar-sm basalt-avatar-tone-${tone}" aria-hidden="true">${monogram(name)}</span>`;
	}

	function worthTag(members) {
		return `<strong>${compactDollars(sumOf(members, (quote) => quote.price.total))}</strong>`;
	}

	function badge(quote) {
		const look = STATUS_LOOK[quote.status];
		let text = look.text;
		if (isPlan(quote) && quote.status === 'accepted') text = 'Signed';
		else if (isPlan(quote) && quote.status === 'sent' && PLAN_STAGE_WORDS[quote.stage])
			text = PLAN_STAGE_WORDS[quote.stage];
		return `<span class="basalt-status ${look.dot}">${text}</span>`;
	}

	/* The single line of context printed under a status badge. */
	function badgeNote(quote) {
		const { status } = quote;
		if (status === 'draft') return note(`Edited ${shortDay(quote.edited)}`);
		if (status === 'accepted' && isPlan(quote)) {
			if (!quote.deal) return note(`Renewal, ${shortDay(quote.closed)}`);
			return note(`Deal <a class="qt-inline-link" href="${dealUrl(quote)}">${quote.deal}</a>`);
		}
		if (status === 'accepted') {
			if (!quote.order) return note('Not an order yet', 'warning');
			return note(`Order <a class="qt-inline-link" href="${orderUrl(quote)}">${quote.order}</a>`);
		}
		if (status === 'declined') return note(quote.reason ? htmlSafe(quote.reason) : 'No reason given');
		if (quote.views.length) return note(`Viewed ${howOften(quote.views.length)} · ${shortDay(latestView(quote))}`);
		if (status === 'sent' && gapInDays(quote.sent, todayKey) >= 3) return note('Not opened yet', 'warning');
		return note(status === 'expired' ? 'Never opened' : 'Not opened yet');
	}

	function validityBar(quote) {
		const left = Math.max(remainingDays(quote), 0);
		const span = Math.max(gapInDays(quote.sent, quote.expires), 1);
		const level = pressure(left);
		const modifier = level === 'calm' ? '' : ` qt-meter-${level}`;
		return `<span class="qt-meter${modifier}" aria-hidden="true"><span style="width:${Math.round((left / span) * 100)}%"></span></span>`;
	}

	/* While Awaiting reply is picked the column is Closes: the deal's close
     on a plan quote, the lapse day on a services quote. */
	function closesCell(quote) {
		if (!quote.closeBy) return validityCell(quote);
		const offset = gapInDays(todayKey, quote.closeBy);
		let tone = '';
		if (offset < 0) tone = 'danger';
		else if (offset <= 7) tone = 'warning';
		return line(shortDay(quote.closeBy)) + note(capitalize(relativeDay(offset)), tone);
	}

	function validityCell(quote) {
		switch (quote.status) {
			case 'draft':
				return line(`${quote.valid} days`) + note('From the day it is sent');
			case 'sent': {
				const left = remainingDays(quote);
				return (
					line(shortDay(quote.expires)) +
					validityBar(quote) +
					note(remainingLabel(left), PRESSURE_TONE[pressure(left)])
				);
			}
			case 'expired':
				return line(shortDay(quote.expires)) + note('Lapsed, no reply');
			default:
				return line(shortDay(quote.expires)) + note(`Replied ${shortDay(quote.closed)}`);
		}
	}

	/* Each stage tile across the top gives a count, what it is worth, and
     the one thing to know. */
	/** Each tile counts its quotes up from what it showed last, and draws
      what each of them is worth. */
	function paintTiles() {
		for (const [key, stage] of Object.entries(STAGES)) {
			const members = records.filter(stage.holds);
			countTo(pick(`[data-qt-count="${key}"]`, host), tileShown[key] ?? 0, members.length);
			tileShown[key] = members.length;
			pick(`[data-qt-note="${key}"]`, host).innerHTML = stage.tile(members);
			tileBars[key] = [...members].sort((left, right) => right.price.total - left.price.total).slice(0, 10);
			pick(`[data-qt-spark="${key}"]`, host).innerHTML = valueBars(tileBars[key]);
		}
	}

	/** Pointing at a bar puts that quote in the tile's note; leaving the
      bars brings the stage's summary back. */
	function bindTileBars() {
		for (const [key, stage] of Object.entries(STAGES)) {
			const spark = pick(`[data-qt-spark="${key}"]`, host);
			const tileNote = pick(`[data-qt-note="${key}"]`, host);
			spark.addEventListener('pointerover', (event) => {
				const bar = event.target.closest('[data-qt-bar]');
				if (!bar) return;
				const quote = tileBars[key][Number(bar.getAttribute('data-qt-bar'))];
				for (const other of pickAll('[data-qt-bar]', spark)) other.classList.toggle('is-read', other === bar);
				tileNote.innerHTML = `<strong>${quote.id} · ${compactDollars(quote.price.total)}</strong> · ${htmlSafe(quote.party.name)}`;
				tileNote.classList.add('is-reading');
			});
			spark.addEventListener('pointerleave', () => {
				for (const bar of pickAll('[data-qt-bar]', spark)) bar.classList.remove('is-read');
				tileNote.classList.remove('is-reading');
				tileNote.innerHTML = stage.tile(records.filter(stage.holds));
			});
		}
	}

	/** One bar per quote, given tallest first, each as tall as the quote's
      total on a square-root scale so the small ones still show. */
	function valueBars(members) {
		const totals = members.map((quote) => quote.price.total);
		if (!totals.length) return '';
		const tallest = totals[0] || 1;
		const bars = totals.map((total, index) => {
			const height = Math.max(4, Math.sqrt(total / tallest) * 26);
			return `<rect data-qt-bar="${index}" x="${index * 6}" y="${28 - height}" width="4" height="${height}" rx="1.5" style="animation-delay:${index * 40}ms"/>`;
		});
		return `<svg viewBox="0 0 ${totals.length * 6 - 2} 28" style="width:${(totals.length * 6 - 2) / 16}rem">${bars.join('')}</svg>`;
	}

	/** Eases a count from one number to another; reduced motion jumps there. */
	function countTo(element, from, to) {
		if (from === to || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			element.textContent = to;
			return;
		}
		const started = performance.now();
		const step = (now) => {
			const progress = Math.min(1, (now - started) / 500);
			element.textContent = Math.round(from + (to - from) * (1 - (1 - progress) ** 3));
			if (progress < 1) requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	}

	/* The quote list: filtering, rows, menus, the empty state and paging. */

	function bindList() {
		ui.stages.addEventListener('change', (event) => {
			if (!event.target.matches('input[name="qtView"]')) return;
			filters.stage = event.target.value;
			pageNo = 1;
			paintList();
		});

		ui.search.addEventListener('input', () => {
			clearTimeout(findDelay);
			findDelay = setTimeout(() => {
				filters.text = ui.search.value.trim();
				pageNo = 1;
				paintList();
			}, 160);
		});

		ui.owner.addEventListener('change', () => {
			filters.owner = ui.owner.value;
			pageNo = 1;
			paintList();
		});

		ui.empty.addEventListener('click', (event) => {
			if (event.target.closest('[data-qt-clear]')) clearFilters();
		});

		ui.exportButton.addEventListener('click', downloadCsv);

		ui.chaseList.addEventListener('click', (event) => {
			const trigger = event.target.closest('[data-qt-act]');
			if (!trigger) return;
			run(
				trigger.getAttribute('data-qt-act'),
				nodeById(trigger.closest('[data-qt-id]').getAttribute('data-qt-id')),
			);
		});

		ui.tbody.addEventListener('click', onRowClick);
		ui.tbody.addEventListener('auxclick', onRowMiddleClick);
	}

	function rerender() {
		expireOverdue();
		paintTiles();
		paintList();
	}

	function inStage() {
		return records.filter(STAGES[filters.stage].holds);
	}

	function visible() {
		const stage = STAGES[filters.stage];
		return records.filter((quote) => stage.holds(quote) && passesFilters(quote)).sort(stage.order);
	}

	function passesFilters(quote) {
		if (filters.owner !== 'all' && quote.owner !== filters.owner) return false;
		if (!filters.text) return true;
		const words = [
			quote.id,
			quote.party.name,
			quote.party.contact,
			senders[quote.owner].name,
			quote.order || '',
			quote.deal,
			...quote.lines.map(([sku]) => catalog[sku].name),
		].join(' ');
		if (window.Basalt?.matchesQuery) return window.Basalt.matchesQuery(words, filters.text);
		return words.toLowerCase().includes(filters.text.toLowerCase());
	}

	function paintList() {
		const stage = STAGES[filters.stage];
		const openStage = filters.stage === 'open';
		onScreen = visible();
		const found = onScreen.length;
		const stageSize = inStage().length;
		const pageCount = Math.max(1, Math.ceil(found / PAGE_SIZE));
		pageNo = Math.min(pageNo, pageCount);
		const first = (pageNo - 1) * PAGE_SIZE;
		const last = Math.min(found, first + PAGE_SIZE);

		ui.heading.textContent = stage.heading;
		ui.blurb.textContent = stage.blurb;
		ui.columnHead.textContent = openStage ? 'Closes' : 'Valid until';

		const counted = found === stageSize ? count(found, 'quote') : `${found} of ${count(stageSize, 'quote')}`;
		const forecast = openStage ? `, ${dollars(sumOf(onScreen, weighted))} expected` : '';
		ui.summary.textContent = `${counted}, worth ${dollars(sumOf(onScreen, (quote) => quote.price.total))}${forecast}`;

		ui.summary.hidden = !found;
		ui.tableWrap.hidden = !found;
		ui.foot.hidden = !found || filters.stage !== 'all';
		ui.empty.hidden = Boolean(found);
		ui.empty.innerHTML = found ? '' : emptyMarkup();
		ui.tbody.innerHTML = onScreen.slice(first, last).map(rowMarkup).join('');
		window.Basalt.tips?.(ui.tbody);

		ui.pager.hidden = pageCount < 2;
		ui.range.innerHTML = found ? `<strong>${first + 1}–${last}</strong> of ${count(found, 'quote')}` : '';
		syncPagination(pageCount);
		paintChase();
	}

	function syncPagination(pageCount) {
		if (pagination) {
			pagination.setTotal(pageCount);
			if (pagination.get() !== pageNo) pagination.set(pageNo);
			return;
		}
		if (!window.Basalt.pagination) return;
		pagination = window.Basalt.pagination(ui.pages, {
			total: pageCount,
			current: pageNo,
			label: 'Quotes page',
			onChange(target) {
				if (target === pageNo) return;
				pageNo = target;
				paintList();
			},
		});
	}

	function rowMarkup(quote) {
		const { party, price, lines } = quote;
		const [leadSku, leadQty] = lines[0];
		const extra = lines.length - 1;
		let itemsNote = isPlan(quote) ? 'First year' : 'Services only';
		if (price.units) itemsNote = count(price.units, 'item');

		const idCell = quote.local
			? `<span class="qt-strong">${quote.id}</span>`
			: `<a class="qt-link" href="${quoteUrl(quote)}">${quote.id}</a>`;
		const forecast =
			quote.status === 'sent' ? note(`${odds(quote)}% · ${compactDollars(weighted(quote))} expected`) : '';

		const cells = [
			['quote', idCell + note(quote.status === 'draft' ? 'Draft' : `Sent ${shortDay(quote.sent)}`)],
			[
				'account',
				`<span class="qt-who">${avatarTag(party.tone, party.name)}<span><span class="qt-strong">${htmlSafe(party.name)}</span>${note(htmlSafe(party.contact))}</span></span>`,
			],
			[
				'items',
				line(`${leadQty} × ${htmlSafe(catalog[leadSku].name)}`) +
					note(`${extra ? `and ${count(extra, 'more line')} · ` : ''}${itemsNote}`),
			],
			['valid', filters.stage === 'open' ? closesCell(quote) : validityCell(quote)],
			['status', badge(quote) + badgeNote(quote)],
			['total', `<span class="qt-money">${dollars(price.total)}</span>${forecast}`],
			['act', rowActions(quote)],
		];
		return `<tr data-qt-id="${quote.id}">${cells.map(([column, html]) => `<td class="qt-col-${column}">${html}</td>`).join('')}</tr>`;
	}

	function rowActions(quote) {
		const fullPage = quote.local
			? ''
			: `<a class="btn btn-icon btn-sm" href="${quoteUrl(quote)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page" aria-label="Open full page: ${quote.id}"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>`;
		const peek = `<button class="btn btn-icon btn-sm" type="button" data-qt-act="open" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view" aria-label="Quick view: ${quote.id}"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>`;
		const toggle = `<button class="btn btn-icon" type="button" aria-label="More for ${quote.id}" aria-expanded="false" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}'><i class="bi bi-three-dots" aria-hidden="true"></i></button>`;
		return `<div class="qt-acts"><span class="basalt-row-actions">${peek}${fullPage}</span><div class="dropdown">${toggle}<ul class="dropdown-menu dropdown-menu-end">${menuItems(quote).join('')}</ul></div></div>`;
	}

	/* The overflow menu offers only what makes sense at the quote's stage. */
	function menuItems(quote) {
		const divider = '<li><hr class="dropdown-divider"></li>';
		const duplicate = menuButton('copy', 'bi-copy', 'Duplicate');

		if (quote.status === 'draft') {
			return [
				menuButton('send', 'bi-send', `Send to ${htmlSafe(firstName(quote.party.contact))}`),
				duplicate,
				divider,
				menuButton('delete', 'bi-trash3', 'Delete draft', 'qt-danger'),
			];
		}
		if (quote.status === 'sent') {
			const close = isPlan(quote)
				? menuButton('sign', 'bi-pen', 'Mark signed')
				: menuButton('convert', 'bi-bag-check', 'Turn into an order');
			return [
				close,
				menuButton('remind', 'bi-bell', 'Send a reminder'),
				menuButton('extend', 'bi-calendar-plus', 'Extend by 14 days'),
				duplicate,
				divider,
				menuButton('decline', 'bi-x-circle', 'Mark declined', 'qt-danger'),
			];
		}
		if (quote.status !== 'accepted') return [menuButton('requote', 'bi-arrow-repeat', 'Quote again')];

		let follow;
		if (isPlan(quote))
			follow = quote.deal
				? menuLink(dealUrl(quote), 'bi-briefcase', 'Open deal')
				: menuLink(subUrl(quote), 'bi-arrow-repeat', 'Open subscription');
		else
			follow = quote.order
				? menuLink(orderUrl(quote), 'bi-box-arrow-up-right', 'Open invoices')
				: menuButton('convert', 'bi-bag-check', 'Turn into an order');
		return [follow, duplicate];
	}

	function menuButton(action, icon, label, extraClass) {
		return `<li><button class="dropdown-item${extraClass ? ` ${extraClass}` : ''}" type="button" data-qt-act="${action}"><i class="bi ${icon}" aria-hidden="true"></i>${label}</button></li>`;
	}

	function menuLink(href, icon, label) {
		return `<li><a class="dropdown-item" href="${href}"><i class="bi ${icon}" aria-hidden="true"></i>${label}</a></li>`;
	}

	function emptyMarkup() {
		const { text, owner } = filters;
		const narrowed = text || owner !== 'all';
		let title = STAGES[filters.stage].none;
		if (text) title = `No quotes match “${htmlSafe(text)}”`;
		else if (narrowed) title = `No quotes from ${htmlSafe(senders[owner].name)} here`;

		let help = '';
		if (narrowed) {
			const hint = text
				? 'Try a quote number, an account or a product name.'
				: 'Pick Anyone to see the whole team’s quotes.';
			help = `<p class="basalt-empty-text">${hint}</p><button class="btn btn-sm btn-outline-secondary" type="button" data-qt-clear>Clear filters</button>`;
		}
		return `<div class="basalt-empty qt-empty" role="status"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-file-earmark-x"></i></span><p class="basalt-empty-title">${title}</p>${help}</div>`;
	}

	function clearFilters() {
		filters.owner = 'all';
		filters.text = '';
		ui.search.value = '';
		ui.owner.value = 'all';
		window.Basalt.select?.refresh?.(ui.owner);
		paintList();
		ui.search.focus();
	}

	/* Picking a stage from code goes through its radio, so the tiles and the
     list stay in step. */
	function switchStage(stageKey) {
		filters.stage = stageKey;
		const radio = pick(`input[value="${stageKey}"]`, ui.stages);
		if (radio && !radio.checked) {
			radio.checked = true;
			radio.dispatchEvent(new Event('change', { bubbles: true }));
			return;
		}
		paintList();
	}

	/* The quick-view button and the menu do what they say. A click anywhere
     else on a row, outside links and the menu, opens the quote's page like
     its number does, in a new tab with Cmd, Ctrl, Shift or the middle
     button. Quotes made in the demo have no page and open the quick view. */
	function onRowClick(event) {
		const row = event.target.closest('tr[data-qt-id]');
		if (!row) return;
		const id = row.getAttribute('data-qt-id');
		const trigger = event.target.closest('[data-qt-act]');
		if (trigger) {
			run(trigger.getAttribute('data-qt-act'), nodeById(id));
			return;
		}
		if (event.target.closest('a, button, .dropdown-menu')) return;
		const href = quoteUrl(nodeById(id));
		if (!href) openQuickView(id);
		else if (event.metaKey || event.ctrlKey || event.shiftKey) window.open(href, '_blank');
		else location.href = href;
	}

	function onRowMiddleClick(event) {
		if (event.button !== 1 || event.target.closest('a, button, .dropdown-menu')) return;
		const row = event.target.closest('tr[data-qt-id]');
		const href = row && quoteUrl(nodeById(row.getAttribute('data-qt-id')));
		if (href) window.open(href, '_blank');
	}

	/* Chase next picks the follow-ups worth making today. */

	/**
	 * Why a sent quote deserves a follow-up, or null. In order of weight: a
	 * deal past its close, a quote about to lapse, one still unopened, then a
	 * deal closing within the week. `by` breaks ties inside a rank.
	 */
	function chaseReason(quote) {
		const closeIn = quote.closeBy ? gapInDays(todayKey, quote.closeBy) : null;
		const left = remainingDays(quote);
		const unopenedFor = quote.views.length ? 0 : gapInDays(quote.sent, todayKey);
		if (closeIn !== null && closeIn < 0)
			return { rank: 0, by: closeIn, tone: 'danger', text: `Was due to close ${shortDay(quote.closeBy)}` };
		if (left <= 3) return { rank: 1, by: left, tone: 'danger', text: remainingLabel(left) };
		if (unopenedFor >= 3)
			return { rank: 2, by: -unopenedFor, tone: 'warning', text: `Not opened in ${unopenedFor} days` };
		if (closeIn !== null && closeIn <= 7)
			return { rank: 3, by: closeIn, tone: '', text: `Closes ${relativeDay(closeIn)}` };
		return null;
	}

	/* Only the unfiltered Awaiting reply list gets the three cards. */
	function paintChase() {
		let picks = [];
		if (filters.stage === 'open' && !filters.text && filters.owner === 'all') {
			picks = records
				.filter((quote) => quote.status === 'sent')
				.map((quote) => ({ quote, reason: chaseReason(quote) }))
				.filter((entry) => entry.reason)
				.sort(
					(a, b) =>
						a.reason.rank - b.reason.rank ||
						a.reason.by - b.reason.by ||
						weighted(b.quote) - weighted(a.quote),
				)
				.slice(0, 3);
		}
		ui.chase.hidden = !picks.length;
		ui.chaseList.innerHTML = picks.map(chaseCard).join('');
	}

	function chaseCard({ quote, reason }) {
		const { party } = quote;
		const remind = `<button class="btn btn-outline-secondary btn-sm qt-chase-btn" type="button" data-qt-act="remind" aria-label="Send ${htmlSafe(firstName(party.contact))} a reminder about ${quote.id}"><i class="bi bi-bell" aria-hidden="true"></i><span class="qt-chase-btn-label">Remind</span></button>`;
		const text = `<span class="qt-chase-text"><button class="qt-chase-name" type="button" data-qt-act="open">${htmlSafe(party.name)}</button>${note(reason.text, reason.tone)}${note(`${quote.id} · ${compactDollars(quote.price.total)}, ${odds(quote)}% likely`)}</span>`;
		return `<li class="qt-chase-item" data-qt-id="${quote.id}">${avatarTag(party.tone, party.name)}${text}${remind}</li>`;
	}

	/* Export writes the rows the list currently holds to a CSV file. */

	function downloadCsv() {
		const header = [
			'Quote',
			'Account',
			'Prepared by',
			'Status',
			'Sent',
			'Valid until',
			'Expected close',
			'Chance',
			'Total',
		];
		const body = onScreen.map((quote) => [
			quote.id,
			quote.party.name,
			senders[quote.owner].name,
			STATUS_LOOK[quote.status].text,
			quote.sent || '',
			quote.expires || '',
			quote.closeBy,
			quote.status === 'sent' ? `${odds(quote)}%` : '',
			quote.price.total.toFixed(2),
		]);
		const csv = [header, ...body].map((cells) => cells.map(csvCell).join(',')).join('\r\n');

		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
		link.download = `quotes-${filters.stage}-${todayKey}.csv`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000);
		notify({
			tone: 'success',
			icon: 'bi-download',
			title: `Exported ${count(onScreen.length, 'quote')}`,
			text: link.download,
		});
	}

	function csvCell(value) {
		return `"${String(value).replace(/"/g, '""')}"`;
	}

	/* Actions change a quote in place, repaint, and offer an undo where it matters. */

	function run(action, quote) {
		if (quote) ACTIONS[action]?.(quote);
	}

	/* Repaints, refreshes the quick view if it shows this quote, then tells
     both the eye (a toast) and the ear (the live region). */
	function afterChange(quote, message, toastExtras) {
		rerender();
		if (showing(quote)) fillDrawer(quote);
		notify({ tone: 'success', icon: 'bi-check2-circle', title: message, ...toastExtras });
		speak(message);
	}

	function undoTo(quote, snapshot) {
		return () => {
			Object.assign(quote, snapshot);
			rerender();
			if (showing(quote)) fillDrawer(quote);
			speak(`${quote.id} restored`);
		};
	}

	function sendQuote(quote) {
		quote.status = 'sent';
		quote.sent = clockNow();
		quote.expires = shiftDays(quote.sent, quote.valid);
		quote.views = [];
		afterChange(quote, `${quote.id} sent to ${quote.party.contact}`, {
			icon: 'bi-send',
			text: `Valid until ${shortDay(quote.expires)}.`,
		});
	}

	function nudgeBuyer(quote) {
		quote.reminders.push(clockNow());
		afterChange(quote, `Reminder sent to ${quote.party.contact}`, { icon: 'bi-bell', text: quote.party.email });
	}

	/* Two more weeks, counted from today if the quote has already run out. */
	function prolong(quote) {
		const base = todayKey > quote.expires ? todayKey : quote.expires;
		quote.expires = shiftDays(base, 14);
		quote.extensions.push([clockNow(), quote.expires]);
		afterChange(quote, `${quote.id} now valid until ${shortDay(quote.expires)}`, {
			icon: 'bi-calendar-plus',
			text: `${quote.party.contact} gets an email with the new date.`,
		});
	}

	function markSigned(quote) {
		const snapshot = { status: quote.status, closed: quote.closed };
		quote.status = 'accepted';
		quote.closed = clockNow();
		afterChange(quote, `${quote.id} marked signed`, {
			icon: 'bi-pen',
			text: `${quote.party.name}, ${dollars(quote.price.total)} for the first year.`,
			duration: 8000,
			actions: [{ label: 'Undo', onClick: undoTo(quote, snapshot) }],
		});
	}

	function markDeclined(quote) {
		const snapshot = { status: quote.status, closed: quote.closed, reason: quote.reason };
		quote.status = 'declined';
		quote.closed = clockNow();
		quote.reason = '';
		afterChange(quote, `${quote.id} marked declined`, {
			tone: 'danger',
			icon: 'bi-x-circle',
			duration: 8000,
			actions: [{ label: 'Undo', onClick: undoTo(quote, snapshot) }],
		});
	}

	/**
	 * A new draft with the same account, seller and lines at today's prices.
	 * `again` words the toast for a lost quote being quoted once more.
	 */
	function cloneQuote(quote, again) {
		const id = freshQuoteId();
		const draft = normalize({
			id,
			local: true,
			kind: quote.kind,
			acct: quote.acct,
			party: quote.party,
			owner: quote.owner,
			status: 'draft',
			edited: clockNow(),
			valid: quote.valid,
			pace: quote.pace,
			lines: quote.lines.map((entry) => entry.slice()),
		});
		records.unshift(draft);
		rerender();
		const lead = again ? `New draft for ${quote.party.name}` : `${quote.id} copied`;
		notify({
			tone: 'success',
			icon: 'bi-copy',
			title: `${lead} as ${id}`,
			text: 'At today’s prices, ready to check and send.',
			actions: [{ label: 'Open', onClick: () => openQuickView(id) }],
		});
		speak(`${id} created`);
	}

	function discard(quote) {
		const slotIndex = records.indexOf(quote);
		records.splice(slotIndex, 1);
		if (showing(quote)) bootstrap.Offcanvas.getOrCreateInstance(quickView).hide();
		rerender();
		notify({
			tone: 'danger',
			icon: 'bi-trash3',
			title: `${quote.id} deleted`,
			duration: 8000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						records.splice(slotIndex, 0, quote);
						rerender();
						speak(`${quote.id} restored`);
					},
				},
			],
		});
	}

	function freshQuoteId() {
		const taken = [...store.quotes().map((entry) => entry.id), ...records.map((entry) => entry.id)];
		return freshId(taken, 433);
	}

	/* The quick view drawer walks the list one quote at a time. */

	function bindQuickView() {
		pick('[data-basalt-record-prev]', quickView).addEventListener('click', () => stepTo(walkAt - 1, -1));
		pick('[data-basalt-record-next]', quickView).addEventListener('click', () => stepTo(walkAt + 1, 1));

		/* Alt with the up or down arrow walks the list without leaving the panel. */
		quickView.addEventListener('keydown', (event) => {
			const direction = { ArrowUp: -1, ArrowDown: 1 }[event.key];
			if (!event.altKey || !direction) return;
			event.preventDefault();
			stepTo(walkAt + direction, direction);
		});

		quickView.addEventListener('show.bs.offcanvas', () => {
			drawerShown = true;
			moveToasts('bottom-center');
		});
		quickView.addEventListener('hidden.bs.offcanvas', () => {
			drawerShown = false;
			moveToasts('bottom-end');
		});

		primaryAction.addEventListener('click', () => {
			const quote = nodeById(activeId());
			if (!quote) return;
			const destination = { order: orderUrl, deal: dealUrl, sub: subUrl }[primaryAction.dataset.mode];
			if (destination) {
				window.location.href = destination(quote);
				return;
			}
			run(primaryAction.dataset.mode, quote);
		});
	}

	function slot(name) {
		return pick(`[data-qt-r="${name}"]`, quickView);
	}

	function activeId() {
		return walkIds[walkAt];
	}

	function showing(quote) {
		return drawerShown && activeId() === quote.id;
	}

	/* The panel walks the quotes on screen in their order. A quote the
     current stage hides, such as a fresh draft, walks every quote. */
	function openQuickView(id) {
		walkIds = onScreen.map((quote) => quote.id);
		if (!walkIds.includes(id)) walkIds = records.map((quote) => quote.id);
		stepTo(walkIds.indexOf(id));
		bootstrap.Offcanvas.getOrCreateInstance(quickView).show();
	}

	function stepTo(index, direction) {
		walkAt = (index + walkIds.length) % walkIds.length;
		const quote = nodeById(walkIds[walkAt]);
		if (quote) fillDrawer(quote);
		pick('[data-basalt-record-pos]', quickView).textContent = `${walkAt + 1} of ${walkIds.length}`;
		quickView.classList.toggle('is-back', direction < 0);
	}

	function fillDrawer(quote) {
		const { party, price } = quote;
		const avatar = slot('avatar');
		avatar.className = `basalt-avatar basalt-avatar-sm basalt-avatar-tone-${party.tone}`;
		avatar.textContent = monogram(party.name);
		slot('title').textContent = quote.id;
		slot('sub').innerHTML = quote.acct
			? `<a href="company-details.html?id=${encodeURIComponent(quote.acct)}">${htmlSafe(party.name)}</a>`
			: htmlSafe(party.name);

		const fullLink = slot('full');
		fullLink.href = quoteUrl(quote);
		fullLink.hidden = Boolean(quote.local);

		slot('state').innerHTML = summaryMarkup(quote);
		const timed = quote.status === 'draft' || quote.status === 'sent';
		slot('valid-section').hidden = !timed;
		slot('valid').innerHTML = timed ? windowMarkup(quote) : '';
		slot('lines').innerHTML = quote.lines.map(lineItemMarkup).join('');
		slot('sums').innerHTML = totalsMarkup(quote, party, price);
		slot('facts').innerHTML = factsMarkup(quote, party);
		slot('history').innerHTML = timelineMarkup(quote);

		const [mode, icon, label] = primaryFor(quote);
		primaryAction.dataset.mode = mode;
		primaryAction.innerHTML = `<i class="bi ${icon} me-1" aria-hidden="true"></i>${label}`;
	}

	/**
	 * The panel's one main button for where the quote stands. A sent quote
	 * that is about to lapse, or still unopened, wants a reminder first.
	 * @returns {[string, string, string]} mode, icon and label
	 */
	function primaryFor(quote) {
		const requote = ['requote', 'bi-arrow-repeat', 'Quote again'];
		const convert = ['convert', 'bi-bag-check', 'Turn into order'];

		if (quote.status === 'draft') return ['send', 'bi-send', 'Send quote'];
		if (quote.status === 'sent') {
			const stale = remainingDays(quote) <= 3 || (!quote.views.length && gapInDays(quote.sent, todayKey) >= 3);
			if (stale) return ['remind', 'bi-bell', 'Send reminder'];
			return isPlan(quote) ? ['sign', 'bi-pen', 'Mark signed'] : convert;
		}
		if (quote.status !== 'accepted') return requote;
		if (isPlan(quote))
			return quote.deal ? ['deal', 'bi-briefcase', 'Open deal'] : ['sub', 'bi-arrow-repeat', 'Open subscription'];
		return quote.order ? ['order', 'bi-box-arrow-up-right', 'Open invoices'] : convert;
	}

	function summaryMarkup(quote) {
		const { party, status } = quote;
		const buyer = htmlSafe(party.contact);
		const firstBuyer = htmlSafe(firstName(party.contact));
		let story;
		let warning = null;

		if (status === 'draft') {
			story = `Not sent yet. ${htmlSafe(senders[quote.owner].name)} last edited it on ${dayAndClock(quote.edited)}.`;
		} else if (status === 'sent') {
			const seen = quote.views.length
				? `Viewed ${howOften(quote.views.length)}, last on ${shortDay(latestView(quote))}.`
				: 'Not opened yet.';
			story = `Sent to ${buyer} on ${shortDay(quote.sent)}. ${seen}`;
			warning = sentWarning(quote, firstBuyer);
		} else if (status === 'accepted' && isPlan(quote)) {
			const deal = quote.deal
				? ` It belongs to deal <a class="qt-inline-link" href="${dealUrl(quote)}">${quote.deal}</a>.`
				: '';
			story = `${buyer} signed it on ${shortDay(quote.closed)}.${deal}`;
		} else if (status === 'accepted') {
			const order = quote.order
				? ` It became order <a class="qt-inline-link" href="${orderUrl(quote)}">${quote.order}</a>.`
				: '';
			story = `${buyer} accepted it on ${shortDay(quote.closed)}.${order}`;
			if (!quote.order) warning = ['bi-bag', 'Accepted but not an order yet. Turn it into one to book the work.'];
		} else if (status === 'declined') {
			story = quote.reason
				? `${buyer} declined it on ${shortDay(quote.closed)}: ${htmlSafe(quote.reason).toLowerCase()}.`
				: `Marked declined on ${shortDay(quote.closed)}. No reason given.`;
		} else {
			story = `Lapsed on ${shortDay(quote.expires)} without a reply.`;
		}

		const callout = warning
			? `<p class="qt-alert qt-alert-warning"><i class="bi ${warning[0]}" aria-hidden="true"></i><span>${warning[1]}</span></p>`
			: '';
		return `<div>${badge(quote)}</div><p class="qt-r-lead">${story}</p>${callout}`;
	}

	/** The most pressing problem with a sent quote, as [icon, text], or null. */
	function sentWarning(quote, firstBuyer) {
		const left = remainingDays(quote);
		const closeIn = quote.closeBy ? gapInDays(todayKey, quote.closeBy) : 1;
		const idle = gapInDays(quote.sent, todayKey);
		if (closeIn < 0) {
			return [
				'bi-calendar-x',
				`The deal was due to close on ${shortDay(quote.closeBy)}. Call ${firstBuyer} to find out where it stands.`,
			];
		}
		if (left <= 3) {
			const when = { 0: 'Lapses today', 1: 'Lapses tomorrow' }[Math.max(left, 0)] || `Lapses in ${left} days`;
			return ['bi-hourglass-split', `${when}. Send a reminder, or extend it if ${firstBuyer} needs more time.`];
		}
		if (!quote.views.length && idle >= 3) {
			return [
				'bi-envelope-exclamation',
				`Not opened in ${idle} days. Check the email address, or call ${firstBuyer}.`,
			];
		}
		return null;
	}

	function windowMarkup(quote) {
		if (quote.status === 'draft') return `<p class="qt-span-left">${quote.valid} days from the day it is sent.</p>`;
		const left = Math.max(remainingDays(quote), 0);
		const level = pressure(left);
		const remaining =
			left <= 1 ? remainingLabel(left) : `${left} of ${gapInDays(quote.sent, quote.expires)} days left`;
		const ends = `<div class="qt-span-ends"><span>Sent <strong>${shortDay(quote.sent)}</strong></span><span>Until <strong>${shortDay(quote.expires)}</strong></span></div>`;
		return `<div class="qt-span">${ends}${validityBar(quote)}<p class="qt-span-left${level === 'calm' ? '' : ` is-${level}`}">${remaining}</p></div>`;
	}

	function lineItemMarkup([sku, qty]) {
		const item = catalog[sku];
		const per = item.sub ? perTerm(item) : ` · ${sku}`;
		return `<li class="qt-item"><span class="qt-item-icon qt-tone-${item.tone}" aria-hidden="true"><i class="bi ${item.icon}"></i></span><span class="qt-item-text"><span class="qt-strong">${htmlSafe(item.name)}</span>${note(`${qty} × ${dollars(item.price)}${per}`)}</span><span class="qt-money">${dollars(item.price * qty)}</span></li>`;
	}

	function perTerm(item) {
		return item.unit === 'bundle' ? ' a year' : ' a seat a year';
	}

	function totalsMarkup(quote, party, price) {
		const rows = [entryPair('Subtotal', dollars(price.subtotal))];
		if (price.discount) {
			rows.push(
				entryPair(
					`Volume discount${note(`5% off ${BULK.atLeast} or more course places`)}`,
					`−${dollars(price.discount)}`,
				),
			);
		}
		if (price.units && price.hasSetup) {
			const express = quote.pace === 'express';
			const terms = `${express ? 'Priority' : 'Standard'}${price.setup || express ? '' : ', free over $500'}`;
			rows.push(entryPair(`Set-up${note(terms)}`, price.setup ? dollars(price.setup) : 'Free'));
		}
		rows.push(
			party.tax
				? entryPair(`Tax${note(htmlSafe(party.tax[0]))}`, dollars(price.tax))
				: entryPair('Tax', 'On the invoice'),
		);
		rows.push(
			`<div class="qt-sums-total"><dt>${isPlan(quote) ? 'First year' : 'Total'}</dt><dd>${dollars(price.total)}</dd></div>`,
		);
		return rows.join('');
	}

	function factsMarkup(quote, party) {
		const seller = senders[quote.owner];
		const deal = quote.deal ? store.find(quote.deal) : null;
		const opened = quote.status === 'sent';
		let payment = `Invoice, due in ${party.terms} days`;
		if (isPlan(quote)) payment = htmlSafe(party.pay);
		else if (party.terms === 'card') payment = `Card on file, ${htmlSafe(party.card)}`;

		const rows = [
			entryPair(
				'Buyer',
				`${htmlSafe(party.contact)}<br><a href="mailto:${htmlSafe(party.email)}">${htmlSafe(party.email)}</a>`,
			),
			entryPair('Prepared by', `${htmlSafe(seller.name)}, ${htmlSafe(seller.role)}`),
		];
		if (deal) {
			const likely = opened ? `, ${odds(quote)}% likely` : '';
			rows.push(
				entryPair(
					'Deal',
					`<a href="${dealUrl(quote)}">${htmlSafe(deal.title)}</a><br>${stageById[deal.stage].name}, closes ${shortDay(quote.closeBy)}${likely}`,
				),
			);
			if (deal.next && opened) rows.push(entryPair('Next step', htmlSafe(deal.next[0])));
		}
		rows.push(entryPair('Payment', payment));
		return rows.join('');
	}

	function entryPair(term, value) {
		return `<div><dt>${term}</dt><dd>${value}</dd></div>`;
	}

	/* Everything that happened to the quote, oldest first. A lapse is stamped
     at the end of its day and shows the date alone. */
	function timelineMarkup(quote) {
		const buyer = quote.party.contact;
		const events = [];
		if (quote.status === 'draft') events.push([quote.edited, `Draft saved by ${senders[quote.owner].name}`, '']);
		if (quote.sent) events.push([quote.sent, `Sent to ${buyer}`, 'sent']);
		for (const viewed of quote.views) events.push([viewed, `Opened by ${firstName(buyer)}`, '']);
		for (const reminded of quote.reminders) events.push([reminded, 'Reminder sent', '']);
		for (const [at, until] of quote.extensions) events.push([at, `Extended to ${shortDay(until)}`, '']);
		if (quote.status === 'accepted')
			events.push([quote.closed, (isPlan(quote) ? 'Signed by ' : 'Accepted by ') + firstName(buyer), 'won']);
		if (quote.order && quote.orderedAt) events.push([quote.orderedAt, `Turned into ${quote.order}`, 'won']);
		if (quote.status === 'declined') events.push([quote.closed, 'Declined', 'lost']);
		if (quote.status === 'expired') events.push([`${quote.expires} 23:59`, 'Lapsed', 'lost']);

		events.sort((a, b) => a[0].localeCompare(b[0]));
		return events
			.map(([when, what, tone]) => {
				const stamp = when.endsWith('23:59') ? shortDay(when) : dayAndClock(when);
				return `<li class="qt-event${tone ? ` qt-event-${tone}` : ''}"><span>${htmlSafe(what)}</span><span class="qt-event-time">${stamp}</span></li>`;
			})
			.join('');
	}

	function moveToasts(corner) {
		window.Basalt.toasts?.position(corner);
	}

	/* Turning a services quote into an order. */

	function bindOrderDialog() {
		orderDialog.addEventListener('hidden.bs.modal', () => {
			if (!reopenDrawer) return;
			reopenDrawer = false;
			openQuickView(orderTarget.id);
		});
		orderForm.addEventListener('submit', placeOrder);
	}

	/* Opened from the quick view, the dialog takes the panel's place and
     gives it back afterwards, so only one layer holds focus at a time. */
	function beginOrder(quote) {
		if (!drawerShown) {
			presentOrderDialog(quote);
			return;
		}
		reopenDrawer = true;
		quickView.addEventListener('hidden.bs.offcanvas', () => presentOrderDialog(quote), { once: true });
		bootstrap.Offcanvas.getOrCreateInstance(quickView).hide();
	}

	function presentOrderDialog(quote) {
		const { party, price } = quote;
		orderTarget = quote;
		const orderId = freshId(records.map((entry) => entry.order).filter(Boolean), 484);
		const readyBy = shiftWorkdays(todayKey, quote.pace === 'express' ? 1 : 2);

		const steps = [
			planStep(
				`Order ${orderId} is created at the quoted prices`,
				`${count(quote.lines.length, 'line')}, nothing re-priced`,
			),
		];
		if (price.units) {
			steps.push(
				planStep(
					`${count(price.units, 'item')} booked, ready by ${shortDay(readyBy)}`,
					`${quote.pace === 'express' ? 'Priority' : 'Standard'} set-up, as quoted`,
				),
			);
		}
		const billing =
			party.terms === 'card' ? `Charged to ${htmlSafe(party.card)}` : `Invoiced, due in ${party.terms} days`;
		steps.push(planStep(billing, 'The account’s usual way of paying'));

		pick('[data-qt-c="sub"]', orderDialog).textContent = `${quote.id} for ${party.name}, ${dollars(price.total)}.`;
		pick('[data-qt-c="plan"]', orderDialog).innerHTML = steps.join('');
		pick('[data-qt-c="notify"]', orderDialog).checked = true;
		pick('[data-qt-c="notify-label"]', orderDialog).textContent =
			`Email the order confirmation to ${party.contact}`;
		orderForm.dataset.order = orderId;
		bootstrap.Modal.getOrCreateInstance(orderDialog).show();
	}

	function planStep(main, detail) {
		return `<li><i class="bi bi-check2" aria-hidden="true"></i><span>${main}${note(detail)}</span></li>`;
	}

	function placeOrder(event) {
		event.preventDefault();
		const quote = orderTarget;
		const emailBuyer = pick('[data-qt-c="notify"]', orderDialog).checked;
		if (quote.status !== 'accepted') {
			quote.status = 'accepted';
			quote.closed = clockNow();
		}
		quote.order = orderForm.dataset.order;
		quote.orderedAt = clockNow();
		bootstrap.Modal.getOrCreateInstance(orderDialog).hide();
		afterChange(quote, `${quote.order} created from ${quote.id}`, {
			icon: 'bi-bag-check',
			text: emailBuyer ? `Confirmation emailed to ${quote.party.contact}.` : '',
			actions: [
				{
					label: 'Open invoices',
					onClick: () => {
						window.location.href = orderUrl();
					},
				},
			],
		});
	}

	/* The New quote dialog and its product picker. */

	function bindNewDialog() {
		newDialog.addEventListener('show.bs.modal', () => {
			draftForm.reset();
			accountSelect.value = '';
			clearAccountError();
			window.Basalt.select?.refresh?.(accountSelect);
			pickerList.innerHTML = '';
			appendPicker('FL-TAB10');
		});

		newDialog.addEventListener('click', (event) => {
			if (event.target.closest('[data-qt-n="add"]')) {
				appendPicker('FL-MNT');
				pickAll('.qt-pick-row select', pickerList).pop().focus();
				return;
			}
			const removeButton = event.target.closest('[data-qt-n-remove]');
			if (!removeButton) return;
			removeButton.closest('li').remove();
			updateNewTotal();
			pick('[data-qt-n="add"]', newDialog).focus();
		});

		newDialog.addEventListener('change', (event) => {
			if (event.target === accountSelect) clearAccountError();
			updateNewTotal();
		});
		newDialog.addEventListener('input', updateNewTotal);
		draftForm.addEventListener('submit', saveNewQuote);
	}

	function clearAccountError() {
		accountSelect.classList.remove('is-invalid');
		accountSelect.removeAttribute('aria-invalid');
	}

	/* A quote with any plan or add-on on it becomes a plan quote. */
	function draftFor(account, lines) {
		const plan = lines.some(([sku]) => catalog[sku].sub);
		const buyer = buyerByAccount[account];
		return {
			kind: plan ? 'plan' : 'store',
			acct: account,
			lines,
			party: plan ? { ...buyer, tax: null, pay: 'Yearly invoice, 30 days' } : buyer,
		};
	}

	function appendPicker(selectedSku) {
		pickerCount += 1;
		const fieldId = `qt-new-line-${pickerCount}`;
		const groups = PICKER_GROUPS.map(({ label, keeps }) => {
			const options = Object.keys(catalog)
				.filter((sku) => keeps(catalog[sku]))
				.map((sku) => {
					const item = catalog[sku];
					return `<option value="${sku}"${sku === selectedSku ? ' selected' : ''}>${htmlSafe(item.name)} · ${dollars(item.price)}${item.sub ? perTerm(item) : ''}</option>`;
				});
			return `<optgroup label="${label}">${options.join('')}</optgroup>`;
		});
		const stepper =
			'<div class="basalt-stepper qt-pick-qty" data-basalt-stepper><button class="basalt-stepper-btn" type="button" data-basalt-step="-1" aria-label="One fewer"><i class="bi bi-dash-lg" aria-hidden="true"></i></button><input class="basalt-stepper-input" type="number" value="1" min="1" max="500" inputmode="numeric" aria-label="Quantity"><button class="basalt-stepper-btn" type="button" data-basalt-step="1" aria-label="One more"><i class="bi bi-plus-lg" aria-hidden="true"></i></button></div>';
		const remove =
			'<button class="btn btn-icon qt-pick-remove" type="button" data-qt-n-remove aria-label="Remove this product"><i class="bi bi-trash3" aria-hidden="true"></i></button>';

		const row = document.createElement('li');
		row.className = 'qt-pick-row';
		row.innerHTML = `<label class="visually-hidden" for="${fieldId}">Product</label><select class="form-select" id="${fieldId}">${groups.join('')}</select>${stepper}${remove}`;
		pickerList.appendChild(row);
		window.Basalt.stepper?.(pick('[data-basalt-stepper]', row));
		updateNewTotal();
	}

	/* The picked lines, with the same product on two rows counted once. */
	function collectLines() {
		const totals = {};
		for (const row of pickAll('.qt-pick-row', pickerList)) {
			const sku = pick('select', row).value;
			const qty = Math.max(1, parseInt(pick('input', row).value, 10) || 1);
			totals[sku] = (totals[sku] || 0) + qty;
		}
		return Object.entries(totals);
	}

	function chosenValidity() {
		return parseInt(pick('input[name="qtValid"]:checked', newDialog).value, 10);
	}

	function updateNewTotal() {
		const rows = pickAll('.qt-pick-row', pickerList);
		for (const row of rows) pick('[data-qt-n-remove]', row).hidden = rows.length === 1;

		const draft = draftFor(accountSelect.value || 'lumoraai', collectLines());
		draft.pace = 'ground';
		const price = priceOut(draft);
		const items = price.units ? `${count(price.units, 'item')}, ` : '';
		const basis = isPlan(draft) ? ' for the first year' : ' before tax';
		const bulk = price.discount ? ' after the 5% volume discount' : '';
		newSummary.innerHTML = `${items}<strong>${dollars(price.subtotal - price.discount)}</strong>${basis}${bulk} · valid until ${shortDay(shiftDays(todayKey, chosenValidity()))} if sent today`;
	}

	function saveNewQuote(event) {
		event.preventDefault();
		if (!accountSelect.value) {
			accountSelect.classList.add('is-invalid');
			accountSelect.setAttribute('aria-invalid', 'true');
			const sibling = accountSelect.nextElementSibling;
			(sibling?.matches('.basalt-select-trigger, button') ? sibling : accountSelect).focus();
			return;
		}

		const sending = event.submitter?.value === 'send';
		const id = freshQuoteId();
		const quote = normalize({
			...draftFor(accountSelect.value, collectLines()),
			id,
			local: true,
			owner: 'reid',
			status: 'draft',
			edited: clockNow(),
			valid: chosenValidity(),
		});
		records.unshift(quote);
		bootstrap.Modal.getOrCreateInstance(newDialog).hide();
		if (sending) {
			quote.status = 'sent';
			quote.sent = quote.edited;
			quote.expires = shiftDays(quote.sent, quote.valid);
		}
		rerender();
		switchStage(sending ? 'open' : 'draft');

		const { party } = quote;
		notify({
			tone: 'success',
			icon: sending ? 'bi-send' : 'bi-file-earmark-check',
			title: sending ? `${id} sent to ${party.contact}` : `${id} saved as a draft`,
			text: `${party.name}, ${dollars(quote.price.total)}${sending ? `, valid until ${shortDay(quote.expires)}` : ''}`,
			actions: [{ label: 'Open', onClick: () => openQuickView(id) }],
		});
		speak(`${id}${sending ? ' sent' : ' saved'}`);
	}

	/* The insight cards: won and lost by month, and win rate per seller. */

	function winShare(month) {
		return Math.round((month.won / (month.won + month.declined + month.lapsed)) * 100);
	}

	function writeInsights() {
		const latest = DECIDED[DECIDED.length - 1];
		const before = DECIDED[DECIDED.length - 2];
		pick('[data-qt-months-sum]', host).innerHTML =
			`<strong>${winShare(latest)}%</strong> of quotes won in ${MONTH_NAME[latest.month]}, up from ${winShare(before)}% in ${MONTH_NAME[before.month]}.`;
		const spoken = DECIDED.map(
			(month) =>
				`${MONTH_NAME[month.month]} ${month.won} won, ${month.declined} declined, ${month.lapsed} lapsed`,
		).join('; ');
		ui.monthsCanvas.setAttribute(
			'aria-label',
			`Stacked bar chart of quotes decided each month from April to September: ${spoken}.`,
		);

		const decided = sumOf(SELLER_TALLY, (tally) => tally.of);
		pick('[data-qt-reps-sum]', host).textContent = `Of the ${decided} quotes decided from July to September.`;
		const ranked = [...SELLER_TALLY].sort((a, b) => b.won / b.of - a.won / a.of);
		pick('[data-qt-reps]', host).innerHTML = ranked.map(sellerRow).join('');
	}

	function sellerRow(tally, index) {
		const seller = senders[tally.seller];
		const share = Math.round((tally.won / tally.of) * 100);
		return `<li class="qt-rep qt-rep-${index + 1}">${avatarTag(seller.tone, seller.name)}<span class="qt-rep-name">${htmlSafe(seller.name)}${note(`${tally.won} of ${tally.of} won`)}</span><span class="qt-rep-value">${share}%</span><span class="qt-rep-bar" aria-hidden="true"><span style="width:${share}%"></span></span></li>`;
	}

	/* The chart is built once it nears the screen and rebuilt, without the
     entrance animation, whenever the theme changes. */
	function bindChart() {
		if ('IntersectionObserver' in window) {
			const watcher = new IntersectionObserver(
				(entries) => {
					if (!entries.some((entry) => entry.isIntersecting)) return;
					watcher.disconnect();
					revealChart();
				},
				{ rootMargin: '80px 0px' },
			);
			watcher.observe(ui.monthsCanvas);
		} else {
			revealChart();
		}
		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() => {
				if (chartLive) drawMonths(false);
			});
		});
	}

	function revealChart() {
		chartLive = true;
		drawMonths(true);
	}

	function cssVar(name, fallback) {
		return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
	}

	function drawMonths(animate) {
		if (typeof Chart === 'undefined') return;
		monthsChart?.destroy();
		const ink = cssVar('--basalt-copy', '#12233a');
		const axisLabels = {
			color: cssVar('--basalt-copy-muted', '#5f7186'),
			font: { family: CHART_FONT, size: 11.5 },
			padding: 6,
		};

		function series(label, field, color, capped) {
			return {
				label,
				stack: 'q',
				data: DECIDED.map((month) => month[field]),
				backgroundColor: color,
				borderSkipped: false,
				borderRadius: capped ? { topLeft: 5, topRight: 5 } : 0,
				maxBarThickness: 36,
			};
		}

		monthsChart = new Chart(ui.monthsCanvas, {
			type: 'bar',
			data: {
				labels: DECIDED.map((month) => month.month),
				datasets: [
					series('Won', 'won', cssVar('--basalt-series-3', '#1fc6a8'), false),
					series('Declined', 'declined', cssVar('--basalt-series-6', '#ef5d6b'), false),
					series('Lapsed', 'lapsed', cssVar('--basalt-edge-strong', 'rgba(16, 42, 72, .2)'), true),
				],
			},
			options: {
				maintainAspectRatio: false,
				responsive: true,
				interaction: { intersect: false, mode: 'index' },
				animation: animate && !calmMotion.matches ? { duration: 500, easing: 'easeOutQuart' } : false,
				scales: {
					x: { stacked: true, border: { display: false }, grid: { display: false }, ticks: axisLabels },
					y: {
						stacked: true,
						beginAtZero: true,
						border: { display: false },
						grid: { color: cssVar('--basalt-edge', 'rgba(16, 42, 72, .08)') },
						ticks: { maxTicksLimit: 5, precision: 0, ...axisLabels },
					},
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: cssVar('--basalt-plane', '#ffffff'),
						borderColor: cssVar('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
						borderWidth: 1,
						titleColor: ink,
						bodyColor: ink,
						footerColor: ink,
						titleFont: { family: CHART_FONT, size: 12, weight: '600' },
						bodyFont: { family: CHART_FONT, size: 12 },
						footerFont: { family: CHART_FONT, size: 12, weight: '600' },
						padding: 10,
						boxPadding: 4,
						cornerRadius: 8,
						usePointStyle: true,
						callbacks: {
							title: (items) => MONTH_NAME[DECIDED[items[0].dataIndex].month],
							label: (context) => ` ${context.dataset.label}: ${context.parsed.y}`,
							footer: (items) => `${winShare(DECIDED[items[0].dataIndex])}% won`,
						},
					},
				},
			},
		});
	}

	/* Helpers with no knowledge of quotes. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function notify(options) {
		window.Basalt.toasts?.push(options);
	}

	function speak(message) {
		window.Basalt.announce?.(message);
	}

	function sumOf(list, valueOf) {
		let total = 0;
		for (const entry of list) total += valueOf(entry);
		return total;
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (character) => ENTITY[character]);
	}

	/* One name always lands on the same of the eight avatar tones. */
	function toneFor(name) {
		let total = 0;
		for (let index = 0; index < name.length; index += 1) total += name.charCodeAt(index);
		return (total % 8) + 1;
	}

	function monogram(name) {
		return name
			.split(' ')
			.map((word) => word[0])
			.slice(0, 2)
			.join('');
	}

	function firstName(name) {
		return name.split(' ')[0];
	}

	function capitalize(text) {
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	function count(amount, word) {
		return `${amount} ${word}${amount === 1 ? '' : 's'}`;
	}

	function howOften(amount) {
		return { 1: 'once', 2: 'twice' }[amount] || `${amount} times`;
	}

	function dollars(amount) {
		return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function compactDollars(amount) {
		if (amount < 1000) return `$${Math.round(amount)}`;
		return `$${(amount / 1000).toFixed(1).replace(/\.0$/, '')}k`;
	}

	function remainingLabel(left) {
		if (left <= 0) return 'Lapses today';
		return left === 1 ? 'Lapses tomorrow' : `${left} days left`;
	}

	function relativeDay(offset) {
		if (offset === 0) return 'today';
		if (offset === 1) return 'tomorrow';
		if (offset === -1) return 'yesterday';
		return offset > 0 ? `in ${offset} days` : `${-offset} days late`;
	}

	/* Dates travel as local "YYYY-MM-DD" or "YYYY-MM-DD HH:MM" text. */

	function twoDigits(number) {
		return String(number).padStart(2, '0');
	}

	function toDate(text) {
		const [datePart, timePart] = text.split(' ');
		const [year, month, date] = datePart.split('-').map(Number);
		const [hours, minutes] = (timePart || '00:00').split(':').map(Number);
		return new Date(year, month - 1, date, hours, minutes);
	}

	function dateKey(date) {
		return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
	}

	function timeKey(date) {
		return `${dateKey(date)} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
	}

	/* The demo's "now": the pinned day at the visitor's own clock time. */
	function clockNow() {
		const wall = new Date();
		const moment = new Date(DEMO_DAY);
		moment.setHours(wall.getHours(), wall.getMinutes());
		return timeKey(moment);
	}

	function shortDay(text) {
		const date = toDate(text);
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
	}

	function clock(hhmm) {
		const hour = Number(hhmm.slice(0, 2));
		return `${hour % 12 || 12}:${hhmm.slice(3, 5)}${hour < 12 ? ' am' : ' pm'}`;
	}

	function dayAndClock(text) {
		return `${shortDay(text)}, ${clock(text.slice(11, 16))}`;
	}

	function shiftDays(text, days) {
		const date = toDate(text);
		date.setDate(date.getDate() + days);
		return dateKey(date);
	}

	/* Steps forward over weekdays only; Saturdays and Sundays do not count. */
	function shiftWorkdays(text, days) {
		const date = toDate(text);
		let left = days;
		while (left > 0) {
			date.setDate(date.getDate() + 1);
			if (date.getDay() % 6) left -= 1;
		}
		return dateKey(date);
	}

	function gapInDays(fromText, toText) {
		return Math.round((toDate(toText.slice(0, 10)) - toDate(fromText.slice(0, 10))) / 86400000);
	}

	start();
})();
