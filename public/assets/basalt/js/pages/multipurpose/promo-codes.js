/**
 * Runs the Marlo store's promo code screen (promo-codes.html). It lays out
 * the three spotlight tickets, the code table with its tabs and filters, the
 * September ring and discount ranking, the drawer that opens a single code
 * and the dialog that adds, edits or reruns one. Codes come from the fixture
 * below; the orders that used them come from the shared Store book.
 */
(() => {
	'use strict';

	const page = pick('[data-pc-root]');
	if (!page || !window.Basalt.shopBook) return;
	const store = window.Basalt.shopBook;

	/* A fixed "today" for the demo, so statuses and countdowns never drift. */
	const DEMO_DAY = '2026-10-09';
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	/* The table stops after this many codes and offers the remainder on a button. */
	const FIRST_BATCH = 8;
	/* Whoever is signed in; actions taken on this page are credited to them. */
	const SIGNED_IN = 'John Armstrong';

	/* What a code can be attached to. phrase finishes "20% off ...", pairing
     reads as the condition for a free extra, and listPrice feeds the
     worked example in the dialog's preview. */
	const TARGETS = [
		{ label: 'Whole order', phrase: 'the whole order', pairing: 'Any order' },
		{ label: 'Clothing', phrase: 'clothing', pairing: 'With any garment' },
		{ label: 'Accessories', phrase: 'accessories', pairing: 'With any accessory' },
		{ label: 'Extras and services', phrase: 'extras and services', pairing: 'With any extra' },
		{
			label: 'Sculpted Shoulder Blazer',
			listPrice: 1290,
			phrase: 'the Sculpted Shoulder Blazer',
			pairing: 'With a Sculpted Shoulder Blazer',
		},
		{
			label: 'Draped Column Gown',
			listPrice: 2150,
			phrase: 'the Draped Column Gown',
			pairing: 'With a Draped Column Gown',
		},
		{ label: 'Sunglasses', phrase: 'sunglasses', pairing: 'With any sunglasses' },
		{ label: 'E-Gift Cards', listPrice: 250, phrase: 'e-gift cards', pairing: 'With an e-gift card' },
		{ label: 'Styling Session', listPrice: 650, phrase: 'a styling session', pairing: 'With a styling session' },
	];
	const GIFTS = [
		{ label: 'Silk Pocket Square', listPrice: 145 },
		{ label: 'Leather Card Case', listPrice: 120 },
		{ label: 'Shoe Care Kit', listPrice: 95 },
		{ label: 'E-Gift Card', listPrice: 250 },
	];
	const OFFER_NAMES = {
		percent: 'Percent off',
		amount: 'Amount off',
		shipping: 'Free shipping',
		addon: 'Free extra',
	};
	const PHASES = {
		live: { tone: 'success', text: 'Live' },
		scheduled: { tone: 'info', text: 'Scheduled' },
		paused: { tone: 'warning', text: 'Paused' },
		ended: { tone: '', text: 'Ended' },
	};

	/* The store's codes. redeemed counts every use so far and september the
     uses that month; avgOff is the discount on a typical order. regulars
     are the shoppers who lean on a code most, the same people the Orders
     page shows redeeming it. A live install would fetch all of this. */
	const PROMOS = [
		{
			id: 'SCULPT20',
			phase: 'live',
			offer: 'percent',
			worth: 20,
			target: 'Sculpted Shoulder Blazer',
			audience: 'Everyone',
			floor: 0,
			ceiling: 1500,
			singleUse: false,
			opens: '2026-09-10',
			closes: '2026-11-30',
			redeemed: 596,
			september: 402,
			avgOff: 258,
			regulars: ['Rochelle Fairbanks', 'Candace Carpenter'],
			blurb: 'Autumn offer on the blazer',
			author: 'Hope Stout',
			created: '2026-09-02',
		},
		{
			id: 'FIRSTORDER',
			phase: 'live',
			offer: 'percent',
			worth: 15,
			target: 'Whole order',
			audience: 'New customers',
			floor: 0,
			ceiling: 4000,
			singleUse: true,
			opens: '2026-03-01',
			closes: '2027-02-26',
			redeemed: 1642,
			september: 214,
			avgOff: 374,
			blurb: 'First order from a new customer',
			author: 'John Armstrong',
			created: '2026-02-24',
		},
		{
			id: 'SHIP500',
			phase: 'live',
			offer: 'shipping',
			worth: 0,
			target: 'Whole order',
			audience: 'Everyone',
			floor: 500,
			ceiling: null,
			singleUse: false,
			opens: '2026-01-05',
			closes: '2026-12-31',
			redeemed: 1074,
			september: 131,
			avgOff: 24,
			blurb: 'Year-round shipping offer',
			author: 'Dee Quigley',
			created: '2025-12-18',
		},
		{
			id: 'FREESQUARE',
			phase: 'live',
			offer: 'addon',
			gift: 'Silk Pocket Square',
			worth: 0,
			target: 'Sculpted Shoulder Blazer',
			audience: 'Everyone',
			floor: 0,
			ceiling: 600,
			singleUse: false,
			opens: '2026-08-01',
			closes: '2026-10-15',
			redeemed: 318,
			september: 117,
			avgOff: 145,
			blurb: 'Pocket square free with a blazer',
			author: 'Hope Stout',
			created: '2026-07-22',
		},
		{
			id: 'INSIDERS',
			phase: 'live',
			offer: 'percent',
			worth: 10,
			target: 'Whole order',
			audience: 'Insider members',
			floor: 0,
			ceiling: null,
			singleUse: false,
			opens: '2025-07-01',
			closes: null,
			redeemed: 861,
			september: 74,
			avgOff: 250,
			regulars: ['Sandra Franklin'],
			blurb: 'Standing rate for Insider members',
			author: 'John Armstrong',
			created: '2025-06-20',
		},
		{
			id: 'EXTRAS15',
			phase: 'live',
			offer: 'percent',
			worth: 15,
			target: 'Extras and services',
			audience: 'Everyone',
			floor: 0,
			ceiling: 600,
			singleUse: true,
			opens: '2026-05-04',
			closes: '2026-11-30',
			redeemed: 264,
			september: 41,
			avgOff: 98,
			blurb: 'First order of extras or services',
			author: 'Quentin Cook',
			created: '2026-04-27',
		},
		{
			id: 'SHADES50',
			phase: 'live',
			offer: 'amount',
			worth: 50,
			target: 'Accessories',
			audience: 'Everyone',
			floor: 400,
			ceiling: 1000,
			singleUse: false,
			opens: '2026-09-01',
			closes: '2026-11-30',
			redeemed: 87,
			september: 63,
			avgOff: 50,
			blurb: 'Autumn accessories offer',
			author: 'Dee Quigley',
			created: '2026-08-25',
		},
		{
			id: 'TAKEBACK40',
			phase: 'live',
			offer: 'amount',
			worth: 200,
			target: 'Draped Column Gown',
			audience: 'Everyone',
			floor: 0,
			ceiling: 150,
			singleUse: false,
			opens: '2026-06-01',
			closes: '2026-10-31',
			redeemed: 94,
			september: 22,
			avgOff: 200,
			blurb: 'Credit for a gown traded in',
			author: 'Quentin Cook',
			created: '2026-05-21',
		},
		{
			id: 'WINTER20',
			phase: 'scheduled',
			offer: 'amount',
			worth: 50,
			target: 'Sunglasses',
			audience: 'Everyone',
			floor: 100,
			ceiling: 2000,
			singleUse: false,
			opens: '2026-11-02',
			closes: '2027-01-31',
			redeemed: 0,
			september: 0,
			avgOff: 0,
			blurb: 'Winter eyewear sale',
			author: 'Dee Quigley',
			created: '2026-10-01',
		},
		{
			id: 'GIFTSEASON',
			phase: 'scheduled',
			offer: 'percent',
			worth: 30,
			target: 'E-Gift Cards',
			audience: 'Everyone',
			floor: 0,
			ceiling: 3000,
			singleUse: false,
			opens: '2026-12-01',
			closes: '2026-12-31',
			redeemed: 0,
			september: 0,
			avgOff: 0,
			blurb: 'Year-end gift card sale',
			author: 'Hope Stout',
			created: '2026-10-05',
		},
		{
			id: 'STYLING12',
			phase: 'scheduled',
			offer: 'percent',
			worth: 12,
			target: 'Styling Session',
			audience: 'Insider members',
			floor: 0,
			ceiling: 800,
			singleUse: true,
			opens: '2027-01-11',
			closes: '2027-01-29',
			redeemed: 0,
			september: 0,
			avgOff: 0,
			blurb: 'January styling week',
			author: 'John Armstrong',
			created: '2026-10-06',
		},
		{
			id: 'EYESWAP',
			phase: 'paused',
			heldOn: '2026-09-22',
			heldBy: 'Dee Quigley',
			heldWhy: 'Returns are backed up at the Elko warehouse.',
			offer: 'amount',
			worth: 40,
			target: 'Sunglasses',
			audience: 'Everyone',
			floor: 0,
			ceiling: 1000,
			singleUse: false,
			opens: '2026-02-01',
			closes: '2026-12-15',
			redeemed: 447,
			september: 18,
			avgOff: 40,
			blurb: 'Credit for old sunglasses sent back',
			author: 'Dee Quigley',
			created: '2026-01-26',
		},
		{
			id: 'AKHISHIP',
			phase: 'paused',
			heldOn: '2026-09-30',
			heldBy: 'John Armstrong',
			heldWhy: 'Carrier rates for Alaska and Hawaii are under review.',
			offer: 'shipping',
			worth: 0,
			target: 'Whole order',
			audience: 'Everyone',
			floor: 400,
			ceiling: 500,
			singleUse: false,
			opens: '2026-04-15',
			closes: '2027-03-31',
			redeemed: 203,
			september: 9,
			avgOff: 38,
			blurb: 'Shipping to Alaska and Hawaii over $400',
			author: 'John Armstrong',
			created: '2026-04-08',
		},
		{
			id: 'SPRING25',
			phase: 'ended',
			offer: 'percent',
			worth: 25,
			target: 'Accessories',
			audience: 'Everyone',
			floor: 0,
			ceiling: null,
			singleUse: false,
			opens: '2026-03-02',
			closes: '2026-05-31',
			redeemed: 1206,
			september: 0,
			avgOff: 140,
			blurb: 'Spring accessories sale',
			author: 'Hope Stout',
			created: '2026-02-20',
		},
	];

	/* Shoppers with at least one order, for padding out a code's top list. */
	const shopperNames = store.CUSTOMERS.filter((person) => person.orders > 0).map((person) => person.name);

	/* Page parts the script writes into or listens on. */
	const spotlight = pick('[data-pc-watch]');
	const tableBody = pick('[data-pc-rows]');
	const resultCount = pick('[data-pc-list-count]');
	const overflow = pick('[data-pc-more]');
	const searchBox = pick('[data-pc-search]');
	const offerFilter = pick('[data-pc-kind-filter]');
	const rankingList = pick('[data-pc-cost]');
	const drawer = pick('#pc-code');
	const dialog = pick('#pc-edit');
	const editor = pick('[data-pc-form]', dialog);

	/* Mutable state: what the table is filtered to, which codes each list
     last showed (the drawer steps through them), and what is open. */
	const filters = { phase: 'all', text: '', offer: 'all', expanded: false };
	let spotlit = [];
	let tableShows = [];
	let discountLeaders = [];
	let browseOrder = [];
	let openPromo = null;
	let stepper = null;
	let beingEdited = null;

	function start() {
		stockEditorSelects();
		wireSpotlight();
		wireTable();
		wireSeptember();
		wireDrawer();
		wireEditor();
		redraw();
	}

	/* Every panel that reads the codes, in screen order. An open drawer is
     drawn again too, so a pause or resume shows straight away. */
	function redraw() {
		renderTabCounts();
		renderSpotlight();
		paintTable();
		renderSeptember();
		if (openPromo && drawer.classList.contains('show')) showPromo(openPromo);
	}

	/* Three codes earn a ticket: the busiest live one in September, the live
     one closing soonest and the scheduled one opening soonest. A code
     already picked is skipped by the later picks. */
	function renderSpotlight() {
		spotlit = [];
		const running = PROMOS.filter((promo) => promo.phase === 'live');

		const busiest = firstUnpicked(
			running.filter((promo) => promo.september > 0),
			(a, b) => b.september - a.september,
		);
		if (busiest) {
			spotlit.push({
				promo: busiest,
				icon: 'bi-graph-up-arrow',
				heading: 'Busiest in September',
				detail: `${whole(busiest.september)} orders used it`,
			});
		}

		const closing = firstUnpicked(
			running.filter((promo) => promo.closes && offsetDays(promo.closes) >= 0),
			soonestBy('closes'),
		);
		if (closing) {
			const days = offsetDays(closing.closes);
			const detail = days === 0 ? countdown(days) : `${countdown(days)}, on ${formatDay(closing.closes, true)}`;
			spotlit.push({ promo: closing, icon: 'bi-hourglass-split', heading: 'Ends next', detail });
		}

		const opening = firstUnpicked(
			PROMOS.filter((promo) => promo.phase === 'scheduled'),
			soonestBy('opens'),
		);
		if (opening) {
			spotlit.push({
				promo: opening,
				icon: 'bi-calendar-event',
				heading: 'Starts next',
				detail: `Starts on ${formatDay(opening.opens, true)}`,
			});
		}

		spotlight.innerHTML = spotlit.map(ticketMarkup).join('');
	}

	function firstUnpicked(candidates, order) {
		return candidates.filter((promo) => !spotlit.some((entry) => entry.promo === promo)).sort(order)[0];
	}

	/** Sort comparator that puts the earliest ISO date in `key` first. */
	function soonestBy(key) {
		return (a, b) => (a[key] < b[key] ? -1 : 1);
	}

	function ticketMarkup({ promo, icon, heading, detail }) {
		const [big, small] = stubParts(promo);
		const spoken = `${heading}: ${promo.id}, ${htmlSafe(offerHeadline(promo))}. ${htmlSafe(detail)}. Open the code`;
		return (
			`<li><button class="pc-tk pc-kind-${promo.offer}" type="button" aria-label="${spoken}" data-pc-open="${promo.id}">` +
			`<span class="pc-tk-main"><span class="pc-tk-label"><i aria-hidden="true" class="bi ${icon}"></i>${heading}</span>` +
			`<span class="pc-tk-code">${promo.id}</span><span class="pc-tk-offer">${htmlSafe(offerReach(promo))}</span>` +
			`<span class="pc-tk-fact">${htmlSafe(detail)}</span></span>` +
			`<span aria-hidden="true" class="pc-tk-stub"><span class="pc-tk-big">${big}</span><span class="pc-tk-small">${small}</span></span>` +
			'</button></li>'
		);
	}

	/* The ticket stub's large figure and the word under it. */
	const STUBS = {
		percent: (promo) => [`${promo.worth}%`, 'off'],
		amount: (promo) => [`$${whole(promo.worth)}`, 'off'],
		shipping: () => ['Free', 'shipping'],
		addon: () => ['Free', 'extra'],
	};

	function stubParts(promo) {
		return STUBS[promo.offer](promo);
	}

	function wireSpotlight() {
		spotlight.addEventListener('click', (event) => {
			const ticket = event.target.closest('[data-pc-open]');
			if (!ticket) return;
			showSheet(
				ticket.getAttribute('data-pc-open'),
				spotlit.map((entry) => entry.promo),
			);
		});
	}

	/* The table lists every code that survives the tab, search and offer filters. */

	function renderTabCounts() {
		for (const badge of pickAll('[data-pc-count]')) {
			const phase = badge.getAttribute('data-pc-count');
			badge.textContent =
				phase === 'all' ? PROMOS.length : PROMOS.filter((promo) => promo.phase === phase).length;
		}
	}

	function passesFilters(promo) {
		if (filters.phase !== 'all' && promo.phase !== filters.phase) return false;
		if (filters.offer !== 'all' && promo.offer !== filters.offer) return false;
		if (!filters.text) return true;
		const searchable = [
			promo.id,
			promo.blurb,
			offerHeadline(promo),
			offerReach(promo),
			promo.audience,
			promo.gift || '',
		];
		return searchable.join(' ').toLowerCase().includes(filters.text);
	}

	function paintTable() {
		tableShows = PROMOS.filter(passesFilters);
		const total = tableShows.length;
		resultCount.textContent = total === 1 ? '1 code' : `${total} codes`;

		const tucked = filters.expanded ? 0 : Math.max(0, total - FIRST_BATCH);
		overflow.hidden = !tucked;
		if (tucked) {
			pick('[data-pc-more-text]', overflow).textContent =
				tucked === 1 ? 'And 1 more code.' : `And ${tucked} more codes.`;
			pick('[data-pc-show-all]', overflow).textContent = `Show all ${total}`;
		}

		tableBody.innerHTML = total
			? tableShows
					.slice(0, total - tucked)
					.map(rowMarkup)
					.join('')
			: noMatchMarkup();
	}

	function rowMarkup(promo) {
		const forWhom = promo.audience === 'Everyone' ? '' : ` · ${promo.audience}`;
		return (
			`<tr data-pc-id="${promo.id}">` +
			`<td class="pc-row-code"><button class="pc-code pc-kind-${promo.offer}" type="button" aria-label="Open ${promo.id}" data-pc-open="${promo.id}">${promo.id}</button><p class="pc-sub">${htmlSafe(promo.blurb)}</p></td>` +
			`<td class="pc-row-offer"><p class="pc-line"><span class="pc-offer pc-kind-${promo.offer}">${htmlSafe(offerHeadline(promo))}</span></p><p class="pc-sub">${htmlSafe(offerReach(promo) + forWhom)}</p></td>` +
			`<td class="pc-row-used">${usageCell(promo)}</td>` +
			`<td class="pc-row-status">${phaseBadge(promo)}</td>` +
			`<td class="pc-row-runs">${scheduleCell(promo)}</td>` +
			'<td class="pc-row-go"><i aria-hidden="true" class="bi bi-chevron-right pc-chev"></i></td>' +
			'</tr>'
		);
	}

	function noMatchMarkup() {
		const underTab = filters.phase === 'all' ? '' : ` under ${PHASES[filters.phase].text.toLowerCase()}`;
		const sought = filters.text ? `"${htmlSafe(filters.text)}"` : 'that offer';
		return (
			'<tr class="basalt-empty-row"><td colspan="6"><div class="basalt-empty basalt-empty-compact">' +
			'<span aria-hidden="true" class="basalt-empty-badge"><i class="bi bi-ticket-perforated"></i></span>' +
			'<h3 class="basalt-empty-title">No codes match</h3>' +
			`<p class="basalt-empty-text">Nothing${underTab} matches ${sought}. Try another word or clear the filters.</p>` +
			'<div class="basalt-empty-actions"><button class="btn btn-sm btn-outline-secondary" type="button" data-pc-clear>Clear filters</button></div>' +
			'</div></td></tr>'
		);
	}

	/* The "Used" column: a count against the limit with a meter, the bare
     count when there is no limit, or a note that it has not begun. */
	function usageCell(promo) {
		if (promo.phase === 'scheduled') {
			const limitNote = promo.ceiling ? `<p class="pc-sub">Limit ${whole(promo.ceiling)}</p>` : '';
			return `<p class="pc-used"><span class="pc-used-of">Not started</span></p>${limitNote}`;
		}
		if (!promo.ceiling) return `<p class="pc-used">${whole(promo.redeemed)}</p><p class="pc-sub">No limit</p>`;
		const percent = limitShare(promo);
		return (
			`<p class="pc-used">${whole(promo.redeemed)} <span class="pc-used-of">of ${whole(promo.ceiling)}</span></p>` +
			`<div class="pc-meter${percent >= 90 ? ' is-full' : ''}" aria-label="${Math.round(percent)}% of the limit used" role="img"><span style="--pc-used:${percent.toFixed(1)}%"></span></div>`
		);
	}

	/* The "Runs" column. Live codes inside their last 30 days get a warning
     line with the countdown and the date beneath it. */
	const SCHEDULE_LINES = {
		scheduled: (promo) => `From ${formatDay(promo.opens, true)}`,
		paused: (promo) => `Paused ${formatDay(promo.heldOn, true)}`,
		ended: (promo) => `Ended ${formatDay(promo.closes, true)}`,
	};

	function scheduleCell(promo) {
		const line = (text) => `<p class="pc-line pc-runs">${text}</p>`;
		const fixed = SCHEDULE_LINES[promo.phase];
		if (fixed) return line(fixed(promo));
		if (!promo.closes) return line('No end date');
		const days = offsetDays(promo.closes);
		if (days > 30) return line(`Until ${formatDay(promo.closes, true)}`);
		return `<p class="pc-line pc-runs is-soon"><i aria-hidden="true" class="bi bi-hourglass-split"></i>${countdown(days)}</p><p class="pc-sub">${formatDay(promo.closes, true)}</p>`;
	}

	function limitShare(promo) {
		return promo.ceiling ? Math.min(100, (promo.redeemed / promo.ceiling) * 100) : 0;
	}

	function wireTable() {
		tableBody.addEventListener('click', (event) => {
			if (event.target.closest('[data-pc-clear]')) {
				clearFilters();
				return;
			}
			const row = event.target.closest('tr[data-pc-id]');
			if (row) showSheet(row.getAttribute('data-pc-id'), tableShows);
		});

		pick('[data-pc-show-all]', overflow).addEventListener('click', () => {
			window.Basalt.slide(tableBody.closest('.pc-scroll'), () => {
				filters.expanded = true;
				paintTable();
			});
			/* Keyboard users pick up at the first code that was out of view. */
			tableBody.children[FIRST_BATCH]?.querySelector('[data-pc-open]').focus();
		});

		searchBox.addEventListener('input', () => {
			filters.text = searchBox.value.trim().toLowerCase();
			paintTable();
		});

		offerFilter.addEventListener('change', () => {
			if (filters.offer === offerFilter.value) return;
			filters.offer = offerFilter.value;
			paintTable();
		});

		for (const tab of pickAll('[data-pc-tab]')) {
			tab.addEventListener('shown.bs.tab', () => {
				filters.phase = tab.getAttribute('data-pc-tab');
				pick('#pc-list-panel').setAttribute('aria-labelledby', tab.id);
				paintTable();
			});
		}
	}

	function clearFilters() {
		filters.text = '';
		filters.offer = 'all';
		searchBox.value = '';
		chooseOption(offerFilter, 'all');
		paintTable();
		searchBox.focus();
	}

	/* Two cards sum up September: uses by kind of offer, and discount by code. */

	function renderSeptember() {
		const active = PROMOS.filter((promo) => promo.september > 0);
		renderOfferMix(active);
		renderDiscountRanking(active);
	}

	/* Orders that used a code, split by kind of offer: a ring and a list. */
	function renderOfferMix(active) {
		const orderTotal = active.reduce((sum, promo) => sum + promo.september, 0);
		const slices = Object.keys(OFFER_NAMES)
			.map((offer) => ({
				offer,
				orders: active
					.filter((promo) => promo.offer === offer)
					.reduce((sum, promo) => sum + promo.september, 0),
			}))
			.filter((slice) => slice.orders > 0)
			.sort((a, b) => b.orders - a.orders);

		pick('[data-pc-mix-desc]').textContent = `${whole(orderTotal)} orders used a code, by kind of offer.`;
		pick('[data-pc-ring-total]').textContent = whole(orderTotal);

		const percents = wholePercents(slices.map((slice) => (slice.orders / orderTotal) * 100));
		pick('[data-pc-mix]').innerHTML = slices
			.map(
				(slice, index) =>
					'<li class="pc-mix-item">' +
					`<span class="pc-mix-name pc-offer pc-kind-${slice.offer}">${OFFER_NAMES[slice.offer]}</span>` +
					`<span class="pc-mix-count">${whole(slice.orders)}</span><span class="pc-mix-share">${percents[index]}%</span>` +
					'</li>',
			)
			.join('');

		pick('[data-pc-ring-svg]').innerHTML = ringMarkup(
			slices.map((slice) => ({ offer: slice.offer, part: slice.orders / orderTotal })),
		);
	}

	/**
	 * Rounds percentages down, then hands the missing points to the values
	 * that lost the most in rounding, so the list always totals 100.
	 */
	function wholePercents(exact) {
		const rounded = exact.map(Math.floor);
		let short = 100 - rounded.reduce((sum, value) => sum + value, 0);
		const byLoss = exact
			.map((value, index) => ({ index, loss: value - Math.floor(value) }))
			.sort((a, b) => b.loss - a.loss);
		for (const { index } of byLoss) {
			if (short <= 0) break;
			rounded[index] += 1;
			short -= 1;
		}
		return rounded;
	}

	/* One arc per kind on a 120-unit canvas, with a sliver of track left
     between arcs when there is more than one. */
	function ringMarkup(parts) {
		const radius = 48;
		const circumference = 2 * Math.PI * radius;
		const spacing = parts.length > 1 ? 2.5 : 0;
		const shared = `cx="60" cy="60" r="${radius}" stroke-width="14"`;
		let traveled = 0;
		const arcs = parts.map(({ offer, part }) => {
			const length = part * circumference;
			const dash = `${Math.max(0, length - spacing).toFixed(2)} ${circumference.toFixed(2)}`;
			const arc = `<circle class="pc-ring-seg pc-kind-${offer}" ${shared} stroke-dasharray="${dash}" stroke-dashoffset="${(-traveled).toFixed(2)}" transform="rotate(-90 60 60)"></circle>`;
			traveled += length;
			return arc;
		});
		return `<circle class="pc-ring-track" ${shared}></circle>${arcs.join('')}`;
	}

	/* The five codes that gave away the most, each bar scaled to the first,
     with one line summing up the rest. */
	function renderDiscountRanking(active) {
		const ranked = active
			.map((promo) => ({ promo, givenAway: promo.september * promo.avgOff }))
			.sort((a, b) => b.givenAway - a.givenAway);
		const grandTotal = ranked.reduce((sum, entry) => sum + entry.givenAway, 0);
		const leaders = ranked.slice(0, 5);
		const others = ranked.slice(5);
		discountLeaders = leaders.map((entry) => entry.promo);

		pick('[data-pc-cost-desc]').textContent =
			`${dollars(grandTotal)} off across ${ranked.length} codes, the biggest first.`;
		rankingList.innerHTML = leaders
			.map(({ promo, givenAway }) => {
				const barWidth = ((givenAway / leaders[0].givenAway) * 100).toFixed(1);
				return (
					`<li><button class="pc-cost-row pc-kind-${promo.offer}" type="button" aria-label="${promo.id}, ${dollars(givenAway)} off on ${whole(promo.september)} orders. Open the code" data-pc-open="${promo.id}">` +
					`<span class="pc-code pc-kind-${promo.offer}">${promo.id}</span>` +
					`<span aria-hidden="true" class="pc-cost-bar"><span style="--pc-share:${barWidth}%"></span></span>` +
					`<span class="pc-cost-value"><span class="pc-cost-money">${dollars(givenAway)}</span><span class="pc-cost-uses">${whole(promo.september)} orders</span></span>` +
					'</button></li>'
				);
			})
			.join('');

		const othersTotal = others.reduce((sum, entry) => sum + entry.givenAway, 0);
		pick('[data-pc-cost-more]').textContent = others.length
			? `And ${others.length} more codes, ${dollars(othersTotal)} between them.`
			: '';
	}

	function wireSeptember() {
		rankingList.addEventListener('click', (event) => {
			const row = event.target.closest('[data-pc-open]');
			if (row) showSheet(row.getAttribute('data-pc-open'), discountLeaders);
		});
	}

	/* The drawer shows one code in full and steps through the list it came from. */

	function drawerPart(key) {
		return pick(`[data-pc-d="${key}"]`, drawer);
	}

	function drawerControl() {
		return bootstrap.Offcanvas.getOrCreateInstance(drawer);
	}

	/**
	 * Opens the drawer on one code. `sequence` is the list the click came
	 * from, so the drawer's previous and next buttons walk that same list.
	 */
	function showSheet(id, sequence) {
		browseOrder = sequence && sequence.length ? sequence.slice() : PROMOS.slice();
		const position = Math.max(
			0,
			browseOrder.findIndex((promo) => promo.id === id),
		);
		stepper ??= window.Basalt.drawer.recordNav(
			drawer,
			{ valueOf: () => Math.max(1, browseOrder.length) },
			(index) => showPromo(browseOrder[index]),
		);
		stepper.go(position, 0);
		drawerControl().show();
	}

	function showPromo(promo) {
		openPromo = promo;
		const copyButton = drawerPart('copy');
		drawerPart('code').textContent = promo.id;
		copyButton.setAttribute('data-basalt-copy', promo.id);
		copyButton.setAttribute('aria-label', `Copy ${promo.id}`);
		drawerPart('sub').textContent = `${offerHeadline(promo)} · ${offerReach(promo)}`;
		drawerPart('pill').innerHTML = phaseBadge(promo);
		drawerPart('when').textContent = timelineSentence(promo);

		showUsage(promo);

		const facts = {
			'Who can use it': promo.audience,
			'Minimum order': promo.floor ? `$${whole(promo.floor)}` : 'None',
			'Each customer': promo.singleUse ? 'Once' : 'As often as they like',
			'Total uses': promo.ceiling ? whole(promo.ceiling) : 'No limit',
			'Made by': `${promo.author}, ${formatDay(promo.created)}`,
		};
		drawerPart('facts').innerHTML = Object.entries(facts)
			.map(([term, detail]) => `<div><dt>${term}</dt><dd>${htmlSafe(detail)}</dd></div>`)
			.join('');

		const notStarted = promo.phase === 'scheduled';
		drawerPart('who-wrap').hidden = notStarted;
		if (!notStarted) renderUsers(promo);
		drawerPart('foot').innerHTML = drawerFooter(promo);
	}

	function showUsage(promo) {
		const meter = drawerPart('meter');
		if (promo.phase === 'scheduled') {
			drawerPart('use').textContent =
				`Not used yet.${promo.ceiling ? ` It can be used ${whole(promo.ceiling)} times.` : ''}`;
			meter.hidden = true;
			drawerPart('saved').textContent = '';
			return;
		}
		const percent = limitShare(promo);
		drawerPart('use').innerHTML = promo.ceiling
			? `Used <strong>${whole(promo.redeemed)}</strong> of ${whole(promo.ceiling)} times`
			: `Used <strong>${whole(promo.redeemed)}</strong> times, with no limit`;
		meter.hidden = !promo.ceiling;
		meter.classList.toggle('is-full', percent >= 90);
		meter.firstElementChild.style.setProperty('--pc-used', `${percent.toFixed(1)}%`);
		drawerPart('saved').textContent =
			`Customers saved ${dollars(promo.redeemed * promo.avgOff)}, about ${dollars(promo.avgOff)} an order.`;
	}

	const TIMELINES = {
		live: (promo) =>
			promo.closes
				? `Live since ${formatDay(promo.opens)}, until ${formatDay(promo.closes)}.`
				: `Live since ${formatDay(promo.opens)}, with no end date.`,
		scheduled: (promo) => `Starts ${formatDay(promo.opens)} and runs until ${formatDay(promo.closes)}.`,
		paused: (promo) =>
			`Paused on ${formatDay(promo.heldOn)} by ${promo.heldBy}.${promo.heldWhy ? ` ${promo.heldWhy}` : ''} Customers who enter it are told it is not available.`,
		ended: (promo) => `Ran from ${formatDay(promo.opens)} to ${formatDay(promo.closes)}.`,
	};

	function timelineSentence(promo) {
		return TIMELINES[promo.phase](promo);
	}

	/* The drawer's buttons per status: class, action, icon and label. A
     Close button always leads. */
	const FOOTER_BUTTONS = {
		live: [
			['btn-outline-secondary', 'pause', 'bi-pause-fill', 'Pause'],
			['btn-primary', 'edit', 'bi-pencil', 'Edit code'],
		],
		paused: [
			['btn-outline-secondary', 'edit', 'bi-pencil', 'Edit'],
			['btn-primary', 'resume', 'bi-play-fill', 'Resume'],
		],
		scheduled: [['btn-primary', 'edit', 'bi-pencil', 'Edit code']],
		ended: [['btn-primary', 'again', 'bi-arrow-repeat', 'Run again']],
	};

	function drawerFooter(promo) {
		const buttons = FOOTER_BUTTONS[promo.phase].map(
			([look, action, icon, text]) =>
				`<button class="btn ${look}" type="button" data-pc-act="${action}"><i aria-hidden="true" class="bi ${icon} me-1"></i>${text}</button>`,
		);
		return `<button class="btn btn-outline-secondary me-auto" type="button" data-bs-dismiss="offcanvas">Close</button>${buttons.join('')}`;
	}

	/* "Who used it": the top customers with what each saved, or the latest
     Store orders carrying the code, as the segmented switch says. */
	function renderUsers(promo) {
		const view = pick('input[name="pcWho"]:checked', drawer).value;
		const list = drawerPart('who');
		const footnote = drawerPart('more');

		if (view === 'customers') {
			const { rows, untold } = topShoppers(promo);
			const largest = rows.reduce((most, row) => Math.max(most, row.saved), 1);
			list.innerHTML = rows
				.map((row) => {
					const person = hasAccount(row.name)
						? `<a href="shoppers.html">${htmlSafe(row.name)}</a>`
						: htmlSafe(row.name);
					return (
						`<li class="pc-who-item"><span class="pc-who-name">${person}<span class="pc-who-meta">${row.orders === 1 ? '1 order' : `${row.orders} orders`}</span></span>` +
						`<span aria-hidden="true" class="pc-who-bar"><span style="--pc-share:${((row.saved / largest) * 100).toFixed(1)}%"></span></span>` +
						`<span class="pc-who-value">${dollars(row.saved)}</span></li>`
					);
				})
				.join('');
			footnote.textContent = untold
				? `And ${whole(untold)} more customers. Amounts are what each one saved.`
				: '';
			return;
		}

		const recent = recentOrders(promo);
		if (!recent.length) {
			list.innerHTML = `<li class="pc-who-item">${promo.phase === 'scheduled' ? 'It has not started yet.' : 'None of the latest Store orders used it.'}</li>`;
			footnote.innerHTML = '';
			return;
		}
		list.innerHTML = recent
			.map(
				(order) =>
					'<li class="pc-who-item pc-who-item-order">' +
					`<span class="pc-who-name"><a href="order-details.html?id=${encodeURIComponent(order.number)}">${order.number}</a><span class="pc-who-meta">${htmlSafe(order.shopper)} · ${formatDay(order.placed, true)}</span></span>` +
					`<span class="pc-who-value">−${dollarsAndCents(order.discount)}</span></li>`,
			)
			.join('');
		footnote.innerHTML = 'Every order with this code is on the <a href="orders.html">Orders</a> page.';
	}

	/* Weights that turn a code's total use into believable per-customer
     figures for the top four rows. */
	const ORDER_WEIGHTS = [0.024, 0.017, 0.012, 0.008];
	const ONE_TIME_SAVINGS = [6.2, 4.8, 3.9, 3.1];
	const REPEAT_SAVINGS = [1.15, 1.05, 0.95, 0.9];

	/**
	 * Four customers for a code. Real Store orders that used it come first,
	 * then its named regulars, then shoppers chosen by a hash of the code so
	 * a given code always lists the same people. `untold` is how many more
	 * customers sit behind those four.
	 */
	function topShoppers(promo) {
		const picked = [];
		const leads = ordersUsing(promo.id).concat((promo.regulars || []).map((name) => ({ customer: name })));
		for (const { customer } of leads) {
			if (picked.length < 4 && !picked.includes(customer)) picked.push(customer);
		}
		const offset = seedOf(promo.id) % shopperNames.length;
		for (let step = 0; picked.length < 4; step++) {
			const candidate = shopperNames[(offset + step * 3) % shopperNames.length];
			if (!picked.includes(candidate)) picked.push(candidate);
		}

		const rows = picked.map((name, rank) => {
			const orders = promo.singleUse ? 1 : Math.max(4 - rank, Math.round(promo.redeemed * ORDER_WEIGHTS[rank]));
			const saved = promo.singleUse
				? promo.avgOff * ONE_TIME_SAVINGS[rank]
				: orders * promo.avgOff * REPEAT_SAVINGS[rank];
			return { name, orders, saved: Math.round(saved) };
		});
		const reach = promo.singleUse ? promo.redeemed : Math.round(promo.redeemed / 2.4);
		return { rows, untold: Math.max(0, reach - rows.length) };
	}

	function recentOrders(promo) {
		return ordersUsing(promo.id)
			.slice(0, 3)
			.map((order) => ({
				number: order.orderNumber,
				shopper: order.customer,
				placed: order.date,
				discount: store.sums(order).discount / 100,
			}));
	}

	/* Store orders that applied this code and were not canceled. */
	function ordersUsing(id) {
		return store.ORDERS.filter((order) => order.discount === id && order.status !== 'canceled');
	}

	function hasAccount(name) {
		return Boolean(store.customer(name)?.id);
	}

	/* What each drawer button does; edit and rerun hand over to the dialog. */
	const DRAWER_ACTIONS = {
		pause(promo) {
			Object.assign(promo, { phase: 'paused', heldOn: DEMO_DAY, heldBy: SIGNED_IN, heldWhy: '' });
			redraw();
			pick('[data-pc-act="resume"]', drawerPart('foot')).focus();
			notify({
				tone: 'warning',
				title: `${promo.id} paused`,
				text: 'Customers who enter it are told it is not available.',
			});
		},
		resume(promo) {
			promo.phase = 'live';
			redraw();
			pick('[data-pc-act="pause"]', drawerPart('foot')).focus();
			notify({
				tone: 'success',
				title: `${promo.id} is live again`,
				text: 'Customers can use it at checkout now.',
			});
		},
	};

	function wireDrawer() {
		for (const option of pickAll('input[name="pcWho"]', drawer)) {
			option.addEventListener('change', () => {
				if (openPromo) renderUsers(openPromo);
			});
		}

		drawerPart('foot').addEventListener('click', (event) => {
			const button = event.target.closest('[data-pc-act]');
			if (!button || !openPromo) return;
			const action = button.getAttribute('data-pc-act');
			const promo = openPromo;
			if (DRAWER_ACTIONS[action]) {
				DRAWER_ACTIONS[action](promo);
				return;
			}
			afterDrawerCloses(() => showEditor(action === 'again' ? 'again' : 'edit', promo));
		});
	}

	/* The dialog waits for the drawer to finish sliding out, so focus can
     move into it cleanly. */
	function afterDrawerCloses(next) {
		if (!drawer.classList.contains('show')) {
			next();
			return;
		}
		drawer.addEventListener('hidden.bs.offcanvas', next, { once: true });
		drawerControl().hide();
	}

	/* One dialog adds a code, edits one, or reruns an ended one under a new name. */

	function field(key) {
		return pick(`[data-pc-f="${key}"]`, editor);
	}

	function preview(key) {
		return pick(`[data-pc-p="${key}"]`, editor);
	}

	function dialogControl() {
		return bootstrap.Modal.getOrCreateInstance(dialog);
	}

	function stockEditorSelects() {
		field('scope').innerHTML = TARGETS.map(
			(target) => `<option value="${htmlSafe(target.label)}">${htmlSafe(target.label)}</option>`,
		).join('');
		field('item').innerHTML = GIFTS.map(
			(gift) => `<option value="${htmlSafe(gift.label)}">${htmlSafe(gift.label)} ($${gift.listPrice})</option>`,
		).join('');
		for (const select of [field('scope'), field('item')]) window.Basalt.select?.refresh(select);
	}

	/* Heading, subline and save label for each way into the dialog, plus the
     values the form starts from. */
	const EDITOR_MODES = {
		edit: (promo) => ({
			draft: promo,
			heading: `Edit ${promo.id}`,
			subline: promo.redeemed
				? `Changes apply to the next order. The ${whole(promo.redeemed)} uses so far stay as they are.`
				: 'Nobody has used it yet, so every detail can change.',
			saveLabel: 'Save changes',
		}),
		again: (promo) => ({
			draft: { ...promo, id: '', opens: DEMO_DAY, closes: null },
			heading: `Run ${promo.id} again`,
			subline: 'The same offer under a new code. Pick the dates it runs.',
			saveLabel: 'Save code',
		}),
		new: () => ({
			draft: null,
			heading: 'New promo code',
			subline: 'Customers type it at checkout. It works from the start date.',
			saveLabel: 'Save code',
		}),
	};

	function showEditor(mode, promo) {
		beingEdited = mode === 'edit' ? promo : null;
		resetMarks();
		const setup = EDITOR_MODES[mode](promo);
		loadDraft(setup.draft);
		field('title').textContent = setup.heading;
		field('sub').textContent = setup.subline;
		field('save').textContent = setup.saveLabel;
		syncOfferFields();
		paintPreview();
		/* Older toasts would sit on top of the dialog's buttons. */
		window.Basalt.toasts?.clear();
		dialogControl().show();
	}

	/** Puts a code's values into the form, or the defaults when `promo` is null. */
	function loadDraft(promo) {
		const offer = promo ? promo.offer : 'percent';
		field('code').value = promo ? promo.id : '';
		for (const choice of pickAll('input[name="pcKind"]', editor)) choice.checked = choice.value === offer;
		field('percent').value = promo?.offer === 'percent' ? promo.worth : 15;
		field('amount').value = promo?.offer === 'amount' ? promo.worth : 20;
		chooseOption(field('item'), promo?.gift || GIFTS[0].label);
		chooseOption(field('scope'), promo ? promo.target : 'Whole order');
		chooseOption(field('who'), promo ? promo.audience : 'Everyone');
		field('min').value = promo?.floor || '';
		field('cap').value = promo?.ceiling || '';
		field('once').checked = promo ? promo.singleUse : false;
		field('start').value = promo ? promo.opens : DEMO_DAY;
		field('end').value = promo?.closes || '';
	}

	function chosenOffer() {
		return pick('input[name="pcKind"]:checked', editor).value;
	}

	/* Shows only the inputs the chosen kind of offer needs, and rewords the
     target list for a free extra ("With any garment" over "Clothing"). */
	function syncOfferFields() {
		const offer = chosenOffer();
		const isGift = offer === 'addon';
		for (const group of pickAll('[data-pc-kind]', editor))
			group.hidden = group.getAttribute('data-pc-kind') !== offer;
		field('scope-wrap').hidden = offer === 'shipping';
		field('scope-label').textContent = isGift ? 'Comes with' : 'Applies to';
		for (const [index, option] of pickAll('option', field('scope')).entries()) {
			option.textContent = isGift ? TARGETS[index].pairing : TARGETS[index].label;
		}
		window.Basalt.select?.refresh(field('scope'));
		field('value-row').hidden = offer === 'shipping';
	}

	/* The form as a code record, with the keys PROMOS uses. */
	function collectDraft() {
		const offer = chosenOffer();
		const worthField = { percent: 'percent', amount: 'amount' }[offer];
		return {
			id: field('code').value.trim().toUpperCase(),
			offer,
			worth: worthField ? Number(field(worthField).value) : 0,
			gift: offer === 'addon' ? field('item').value : undefined,
			target: offer === 'shipping' ? 'Whole order' : field('scope').value,
			audience: field('who').value,
			floor: Number(field('min').value) || 0,
			ceiling: field('cap').value ? Number(field('cap').value) : null,
			singleUse: field('once').checked,
			opens: field('start').value,
			closes: field('end').value || null,
		};
	}

	/* The checkout preview: the code on a ticket, the offer in a customer's
     words, its conditions, and a worked saving where one makes sense. */
	function paintPreview() {
		const draft = collectDraft();
		const ticket = preview('code');
		ticket.textContent = draft.id || 'YOURCODE';
		ticket.classList.toggle('is-empty', !draft.id);

		const hasValue = draft.offer === 'shipping' || draft.offer === 'addon' || draft.worth > 0;
		preview('offer').textContent = hasValue ? checkoutLine(draft) : 'Set the offer';
		preview('terms').innerHTML = previewTerms(draft)
			.map(([icon, text]) => `<li><i aria-hidden="true" class="bi ${icon}"></i>${htmlSafe(text)}</li>`)
			.join('');
		preview('example').textContent = workedSaving(draft);
	}

	function previewTerms(draft) {
		const terms = [];
		if (draft.floor) terms.push(['bi-cart', `On orders over $${whole(draft.floor)}`]);
		if (draft.audience !== 'Everyone')
			terms.push(['bi-people', `For ${draft.audience.charAt(0).toLowerCase()}${draft.audience.slice(1)}`]);
		if (draft.singleUse) terms.push(['bi-person-check', 'Once per customer']);
		if (draft.opens && draft.opens > DEMO_DAY)
			terms.push(['bi-calendar-event', `Starts ${formatDay(draft.opens)}`]);
		terms.push(['bi-calendar-check', draft.closes ? `Until ${formatDay(draft.closes)}` : 'No end date']);
		return terms;
	}

	function workedSaving(draft) {
		if (draft.offer === 'addon') {
			const gift = GIFTS.find((entry) => entry.label === draft.gift);
			return gift ? `Worth ${dollarsAndCents(gift.listPrice)} to the customer.` : '';
		}
		if (draft.offer !== 'percent' || !(draft.worth > 0 && draft.worth <= 90)) return '';
		if (draft.target === 'Whole order') {
			const basket = Math.max(1000, draft.floor);
			return `On a ${dollars(basket)} order, they save ${dollarsAndCents((basket * draft.worth) / 100)}.`;
		}
		const target = targetOf(draft);
		return target.listPrice
			? `On one ${target.label}, they save ${dollarsAndCents((target.listPrice * draft.worth) / 100)}.`
			: '';
	}

	function isClaimed(id) {
		return PROMOS.some((promo) => promo.id === id && promo !== beingEdited);
	}

	/* Builds a code from the offer itself (SAVE15, SHIP500, FREERIB) and
     counts upward from 2 until the result is free. */
	const CODE_STEMS = {
		percent: (draft) => `SAVE${draft.worth || 15}`,
		amount: (draft) => `TAKE${draft.worth || 20}`,
		shipping: (draft) => (draft.floor ? `SHIP${draft.floor}` : 'SHIPFREE'),
		addon: (draft) => `FREE${(draft.gift || 'GIFT').split(/[^A-Za-z]/)[0].toUpperCase()}`,
	};

	function proposeCode() {
		const stem = CODE_STEMS[chosenOffer()](collectDraft()).slice(0, 14);
		let proposal = stem;
		for (let suffix = 2; isClaimed(proposal); suffix++) proposal = `${stem}${suffix}`;
		const input = field('code');
		input.value = proposal;
		input.classList.remove('is-invalid');
		input.parentElement.classList.remove('is-invalid');
		paintPreview();
	}

	/**
	 * Flags or clears one input. Inside an input group the group is flagged
	 * too, so its message shows; `message` replaces the default wording.
	 */
	function markField(input, invalid, messageNode, message) {
		input.classList.toggle('is-invalid', invalid);
		input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
		if (input.parentElement.classList.contains('input-group'))
			input.parentElement.classList.toggle('is-invalid', invalid);
		if (messageNode && message) messageNode.textContent = message;
	}

	function resetMarks() {
		for (const node of pickAll('.is-invalid', editor)) node.classList.remove('is-invalid');
		for (const node of pickAll('[aria-invalid]', editor)) node.removeAttribute('aria-invalid');
	}

	function codeProblem(id) {
		if (!id) return 'Enter a code.';
		if (!/^[A-Z0-9]{4,16}$/.test(id)) return 'Use 4 to 16 letters and numbers, with no spaces.';
		if (isClaimed(id)) return `${id} is already in use. Try another code.`;
		return '';
	}

	function limitProblem(draft) {
		if (field('cap').value && !(draft.ceiling >= 1 && Number.isInteger(draft.ceiling)))
			return 'Enter a whole number above zero.';
		if (beingEdited && draft.ceiling && draft.ceiling < beingEdited.redeemed)
			return `It has been used ${whole(beingEdited.redeemed)} times already.`;
		return '';
	}

	/**
	 * Checks the form top to bottom, flags each problem and focuses the
	 * first one. Returns the draft when it is fine, otherwise null.
	 */
	function checkDraft() {
		resetMarks();
		const draft = collectDraft();
		const flagged = [];
		function flag(key, message) {
			markField(field(key), true, message ? field(`${key}-error`) : null, message);
			flagged.push(field(key));
		}

		const codeIssue = codeProblem(draft.id);
		if (codeIssue) flag('code', codeIssue);
		if (draft.offer === 'percent' && !(draft.worth >= 1 && draft.worth <= 90)) flag('percent');
		if (draft.offer === 'amount' && !(draft.worth > 0)) flag('amount');
		const limitIssue = limitProblem(draft);
		if (limitIssue) flag('cap', limitIssue);
		if (!draft.opens) flag('start');
		if (draft.opens && draft.closes && draft.closes <= draft.opens) flag('end');

		flagged[0]?.focus();
		return flagged.length ? null : draft;
	}

	function phaseFor(draft) {
		if (draft.opens > DEMO_DAY) return 'scheduled';
		return draft.closes && draft.closes < DEMO_DAY ? 'ended' : 'live';
	}

	/* Saving an edit keeps a paused code paused unless its new dates move
     it to scheduled or ended; a new code joins the top of the list. */
	function saveDraft(draft) {
		const phase = phaseFor(draft);
		if (beingEdited) {
			const wasHeld = beingEdited.phase === 'paused';
			Object.assign(beingEdited, draft);
			if (!wasHeld || phase !== 'live') beingEdited.phase = phase;
			dialogControl().hide();
			redraw();
			notify({ tone: 'success', title: `${beingEdited.id} saved`, text: 'The changes apply to the next order.' });
			return;
		}
		const blurb =
			draft.offer === 'shipping' ? 'Shipping offer' : `New ${OFFER_NAMES[draft.offer].toLowerCase()} code`;
		const created = Object.assign(draft, {
			blurb,
			phase,
			redeemed: 0,
			september: 0,
			avgOff: 0,
			author: SIGNED_IN,
			created: DEMO_DAY,
		});
		PROMOS.unshift(created);
		dialogControl().hide();
		redraw();
		notify({
			tone: 'success',
			title: `${created.id} saved`,
			text:
				phase === 'scheduled'
					? `It starts on ${formatDay(created.opens)}.`
					: 'Customers can use it at checkout now.',
		});
	}

	function wireEditor() {
		pick('[data-pc-new]').addEventListener('click', () => showEditor('new'));
		dialog.addEventListener('shown.bs.modal', () => field('code').focus());
		pick('[data-pc-suggest]', editor).addEventListener('click', proposeCode);

		editor.addEventListener('input', (event) => {
			const input = event.target;
			if (input.matches('.is-invalid')) markField(input, false);
			if (input === field('code')) {
				/* Typed codes read in capitals; the caret stays where it was. */
				const caret = input.selectionStart;
				input.value = input.value.toUpperCase();
				input.setSelectionRange(caret, caret);
			}
			paintPreview();
		});

		editor.addEventListener('change', (event) => {
			if (event.target.name === 'pcKind') syncOfferFields();
			paintPreview();
		});

		editor.addEventListener('submit', (event) => {
			event.preventDefault();
			const draft = checkDraft();
			if (draft) saveDraft(draft);
		});
	}

	/* Shared wording for an offer, used by the table, tickets, drawer and preview. */

	function targetOf(promo) {
		return TARGETS.find((target) => target.label === promo.target) || TARGETS[0];
	}

	/* The offer in a few words: "15% off", "$40 off", "Free Pocket Square". */
	const HEADLINES = {
		percent: (promo) => `${promo.worth}% off`,
		amount: (promo) => `$${whole(promo.worth)} off`,
		shipping: () => 'Free shipping',
		addon: (promo) => `Free ${promo.gift}`,
	};

	function offerHeadline(promo) {
		return HEADLINES[promo.offer](promo);
	}

	/* The line under the headline: where the offer applies and any minimum. */
	function offerReach(promo) {
		const overFloor = `Orders over $${whole(promo.floor)}`;
		if (promo.offer === 'shipping') return promo.floor ? overFloor : 'Every order';
		if (promo.offer === 'addon') {
			if (promo.target !== 'Whole order') return targetOf(promo).pairing;
			return promo.floor ? overFloor : 'Any order';
		}
		return `${targetOf(promo).label}${promo.floor ? ` over $${whole(promo.floor)}` : ''}`;
	}

	/* The offer as a shopper reads it at checkout: "15% off the whole order". */
	function checkoutLine(promo) {
		const target = targetOf(promo);
		if (promo.offer === 'shipping') return 'Free shipping';
		if (promo.offer === 'addon') {
			return `A free ${promo.gift}${promo.target === 'Whole order' ? '' : ` ${target.pairing.toLowerCase()}`}`;
		}
		return `${offerHeadline(promo)} ${target.phrase}`;
	}

	function phaseBadge(promo) {
		const { tone, text } = PHASES[promo.phase];
		return `<span class="basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}">${text}</span>`;
	}

	/* Generic helpers for queries, escaping, money and dates. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	function htmlSafe(value) {
		return String(value).replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
	}

	function notify(message) {
		window.Basalt.toasts?.push(message);
	}

	/* Sets a select and lets the styled dropdown, when present, catch up. */
	function chooseOption(select, value) {
		select.value = value;
		window.Basalt.select?.refresh(select);
	}

	function whole(amount) {
		return Math.round(amount).toLocaleString('en-US');
	}

	function dollars(amount) {
		return `$${whole(amount)}`;
	}

	function dollarsAndCents(amount) {
		return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	/** A stable unsigned 32-bit number from a string, for repeatable picks. */
	function seedOf(text) {
		let seed = 0;
		for (let index = 0; index < text.length; index++) seed = (seed * 31 + text.charCodeAt(index)) >>> 0;
		return seed;
	}

	function dayOf(iso) {
		const [year, month, day] = iso.split('-').map(Number);
		return new Date(year, month - 1, day);
	}

	/** "Oct 8, 2026"; with `brief`, dates in 2026 drop the year. */
	function formatDay(iso, brief) {
		const when = dayOf(iso);
		const year = when.getFullYear();
		const yearPart = brief && year === 2026 ? '' : `, ${year}`;
		return `${MONTH_ABBR[when.getMonth()]} ${when.getDate()}${yearPart}`;
	}

	function offsetDays(iso) {
		return Math.round((dayOf(iso) - dayOf(DEMO_DAY)) / 86400000);
	}

	function countdown(days) {
		if (days === 0) return 'Ends today';
		return `Ends in ${days}${days === 1 ? ' day' : ' days'}`;
	}

	start();
})();
