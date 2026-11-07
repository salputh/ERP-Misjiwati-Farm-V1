/**
 * Script for pagination.html, active only where [data-pg-root] exists.
 * It runs the type filter and the copy buttons, and feeds Marlo records to
 * every paging pattern on the page. The pagers themselves (Basalt.pagination,
 * Basalt.pager, Basalt.loadMore, Basalt.infinite, Basalt.dots) belong to
 * basalt.js; nothing here needs a library.
 */
(() => {
	'use strict';

	const demoPage = pick('[data-pg-root]', document);
	if (!demoPage) return;

	/* Marlo shoppers, the pieces they buy, and each piece's price (prices sit
     at the same index as their piece). */
	const SHOPPERS = [
		'Cheryl Sorensen',
		'Sandra Franklin',
		'Carly Daniels',
		'Travis Daugherty',
		'Christopher Vance',
		'Phyllis Delaney',
		'Iva Blackwood',
		'Leslie Whitlock',
		'Georgia Webster',
		'Sabrina Kavanagh',
		'Benjamin Hartley',
		'Natalie Tanner',
		'Rochelle Fairbanks',
		'Carla Pemberton',
		'Rodney Forbes',
	];
	const ITEMS = [
		'Sculpted Shoulder Blazer',
		'Draped Column Gown',
		'Tiered Organza Dress',
		'Chalk-Stripe Suit',
		'Leather Trench Coat',
		'Bar Loafers',
		'Two-Tone Oxfords',
		'Cat-Eye Sunglasses',
		'Shield Sunglasses',
		'Private Styling Session',
	];
	const ITEM_PRICES = [649, 429, 119, 189, 149, 59, 49, 89, 39, 350];

	/* Badge tone and label per order state. Paid appears twice so it turns up
     more often in the table. */
	const ORDER_STATES = [
		{ tone: 'paid', label: 'Paid' },
		{ tone: 'packed', label: 'Packed' },
		{ tone: 'paid', label: 'Paid' },
		{ tone: 'refund', label: 'Refunded' },
		{ tone: 'packed', label: 'Shipped' },
	];
	const ORDER_COUNT = 137;

	/* What the workroom keeps on its shelves, for the load-more list. */
	const SUPPLIES = [
		{ name: 'Horn buttons, 20 mm', spot: 'Tailoring · bin A1', price: 18.5 },
		{ name: 'Silk lining, violet', spot: 'Tailoring · bin A2', price: 24 },
		{ name: 'Suede elbow patches', spot: 'Tailoring · bin A4', price: 62 },
		{ name: 'Hand-sewing silk, 6 colors', spot: 'Tailoring · bin A5', price: 89 },
		{ name: 'Canvas interlining, 2 m roll', spot: 'Tailoring · bin A6', price: 34.5 },
		{ name: 'Woven care labels', spot: 'Tailoring · bin A6', price: 14 },
		{ name: 'Shoulder pads, 25 pairs', spot: 'Tailoring · shelf C1', price: 189 },
		{ name: 'Steam press cover', spot: 'Tailoring · bin A8', price: 112 },
		{ name: 'Jet buttons, 15 mm', spot: 'Silk · bin B1', price: 11.5 },
		{ name: 'Bias binding, 1 1/2 in', spot: 'Silk · bin B2', price: 8.9 },
		{ name: 'Collar stays, brass', spot: 'Silk · bin B2', price: 5.4 },
		{ name: 'Silk thread, ivory', spot: 'Silk · bin B3', price: 6.2 },
		{ name: 'Silk organza, 1 m, sky', spot: 'Silk · bin B4', price: 22 },
		{ name: 'Belt, leather trench', spot: 'Silk · bin B4', price: 19.5 },
		{ name: 'Press studs, 50 pack', spot: 'Silk · bin B5', price: 12 },
		{ name: 'Gift boxes, small', spot: 'Packing · bin E1', price: 21 },
		{ name: 'Tissue paper, 100 sheets', spot: 'Packing · bin E2', price: 9.8 },
		{ name: 'Swing tags, 100 pack', spot: 'Packing · bin E2', price: 7.5 },
		{ name: 'Ribbon, 50 m, natural', spot: 'Packing · bin E3', price: 27 },
		{ name: 'Garment bags, 10 pack', spot: 'Packing · bin E4', price: 64 },
		{ name: 'Recycled mailers, 200 pack', spot: 'Packing · bin E5', price: 145 },
		{ name: 'Suede brush, wooden', spot: 'Care · bin P1', price: 16.5 },
		{ name: 'Cedar blocks, 4 pack', spot: 'Care · bin R1', price: 9 },
	];

	/* Activity feed verbs. The order-shaped ones are followed by an order
     number, the rest by a piece. */
	const FEED_ACTIONS = [
		{ glyph: 'bi-bag-check', verb: 'paid for order', aboutOrder: true },
		{ glyph: 'bi-box-seam', verb: 'had order packed:', aboutOrder: true },
		{ glyph: 'bi-star', verb: 'reviewed', aboutOrder: false },
		{ glyph: 'bi-arrow-repeat', verb: 'reordered', aboutOrder: false },
	];

	const CURSOR_PAGE_SIZE = 5;
	const CURSOR_TOTAL = 23;
	const RECORD_TOTAL = 12;

	const BESTSELLERS = [
		{ title: 'Bar Loafers', sold: 186 },
		{ title: 'Shield Sunglasses', sold: 171 },
		{ title: 'E-Gift Card, $250', sold: 158 },
		{ title: 'Sculpted Shoulder Blazer', sold: 133 },
		{ title: 'Two-Tone Oxfords', sold: 121 },
		{ title: 'Leather Trench Coat', sold: 96 },
		{ title: 'Draped Column Gown', sold: 84 },
		{ title: 'Tiered Organza Dress', sold: 77 },
		{ title: 'Cat-Eye Sunglasses', sold: 62 },
		{ title: 'Chalk-Stripe Suit', sold: 45 },
		{ title: 'Private Styling Session', sold: 19 },
		{ title: 'Made-to-Measure Tailoring', sold: 7 },
	];
	const BESTSELLERS_PER_VIEW = 3;

	const FIELD_TIPS = [
		{
			glyph: 'bi-telephone',
			heading: 'Text before you set off',
			body: 'Send the customer a heads-up when you leave the last visit. Fewer visits end at a locked door.',
		},
		{
			glyph: 'bi-camera',
			heading: 'Photos before and after',
			body: 'Take a photo of the room when you arrive and when you finish. It settles most complaints and billing questions.',
		},
		{
			glyph: 'bi-box-seam',
			heading: 'Log supplies as you use them',
			body: 'Log each item as it leaves the car. Stock stays right and the item lands on the invoice by itself.',
		},
		{
			glyph: 'bi-shield-check',
			heading: 'Check the key safe',
			body: 'Lock the key safe and test the door before you leave, even after a short visit.',
		},
		{
			glyph: 'bi-pen',
			heading: 'Get the sign-off on site',
			body: 'Ask the customer to sign on your phone before you leave. The invoice goes out as soon as they do.',
		},
	];

	/* The customer directory behind the letter index, already alphabetical. */
	const DIRECTORY = [
		{ company: 'Alder Robotics', city: 'Eugene, OR' },
		{ company: 'Apex Movers', city: 'Boulder, CO' },
		{ company: 'Bluepeak Studios', city: 'Boise, ID' },
		{ company: 'Brightline Photography', city: 'Tucson, AZ' },
		{ company: 'Copperleaf Design', city: 'Raleigh, NC' },
		{ company: 'Cornerstone Logistics', city: 'Omaha, NE' },
		{ company: 'Downing Property Group', city: 'Spokane, WA' },
		{ company: 'Evergreen Landscaping', city: 'Tacoma, WA' },
		{ company: 'Granite Pet Sitting', city: 'Albany, NY' },
		{ company: 'Harborline AI', city: 'Savannah, GA' },
		{ company: 'Ironbridge Fintech', city: 'Pittsburgh, PA' },
		{ company: 'Avocet Robotics', city: 'Madison, WI' },
		{ company: 'Lakeside Apparel', city: 'Cleveland, OH' },
		{ company: 'Lantern Studios', city: 'Waco, TX' },
		{ company: 'Oakhaven Studio', city: 'Columbus, OH' },
		{ company: 'Northgate Analytics', city: 'Minneapolis, MN' },
		{ company: 'Larchwood Studios', city: 'Asheville, NC' },
		{ company: 'Polaris Running Co. Group', city: 'Anchorage, AK' },
		{ company: 'Highpoint Outfitters', city: 'Salt Lake City, UT' },
		{ company: 'Highpoint Photo Studios', city: 'Elko, NV' },
		{ company: 'Tidewater Swimwear', city: 'Norfolk, VA' },
		{ company: 'Westfield Hospitality Group', city: 'Hartford, CT' },
	];
	const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

	/* Where each Bootstrap arrow lands, given the active index and the count. */
	const ARROW_TARGETS = new Map([
		['first', () => 0],
		['prev', (current) => current - 1],
		['next', (current) => current + 1],
		['last', (current, count) => count - 1],
	]);

	const copyResets = new WeakMap();

	/* Each demo wires itself and quietly skips when its markup is missing. */
	function start() {
		wireTypeFilter();
		wireCopyButtons();
		wireOrdersTable();
		wireSupplyList();
		wireActivityFeed();
		wireCursorList();
		wireRecordStepper();
		wireBestsellerPager();
		wireTipDots();
		wireLetterIndex();
		wireBootstrapDemos();
	}

	/* The filter chips and the copy buttons serve every card. */

	function wireTypeFilter() {
		const deck = pick('[data-pg-grid]');
		const tally = pick('[data-pg-count]');
		if (!deck) return;
		const tiles = pickAll('.pg-card', deck);
		const chips = pickAll('[data-pg-filter]');
		for (const chip of chips) {
			chip.addEventListener('click', () => {
				for (const other of chips) other.setAttribute('aria-pressed', String(other === chip));
				showGroup(chip.getAttribute('data-pg-filter'), tiles, tally);
			});
		}
		showGroup('all', tiles, tally);
	}

	function showGroup(group, tiles, tally) {
		const visible = tiles.filter((tile) => group === 'all' || tile.getAttribute('data-pg-group') === group);
		for (const tile of tiles) {
			tile.classList.toggle('is-hidden', !visible.includes(tile));
			tile.classList.remove('is-alone');
		}
		flagLoneHalves(visible);
		if (tally) tally.textContent = countOf(visible.length, 'pagination type', 'pagination types');
	}

	/**
	 * Half-width cards pair up between full-width ones. When a stretch of them
	 * has an odd count, its last card would sit alone, so it gets .is-alone.
	 */
	function flagLoneHalves(visible) {
		let halves = 0;
		for (const [position, tile] of visible.entries()) {
			if (isFullWidth(tile)) {
				halves = 0;
				continue;
			}
			halves += 1;
			const following = visible[position + 1];
			if (following && !isFullWidth(following)) continue;
			if (halves % 2) tile.classList.add('is-alone');
			halves = 0;
		}
	}

	function isFullWidth(tile) {
		return tile.classList.contains('pg-card-full');
	}

	function wireCopyButtons() {
		for (const button of pickAll('[data-pg-copy]')) {
			button.addEventListener('click', () => {
				const snippet = pick('pre', button.parentElement);
				if (!snippet) return;
				window.Basalt.copyText(snippet.textContent.trim()).then(() => flashCopied(button));
			});
		}
	}

	/* The label reads Copied for 1.8 seconds, then returns to Copy. */
	function flashCopied(button) {
		const glyph = pick('.bi', button);
		labelCopyButton(button, glyph, ' Copied', 'bi bi-check2');
		clearTimeout(copyResets.get(button));
		copyResets.set(
			button,
			setTimeout(() => labelCopyButton(button, glyph, ' Copy', 'bi bi-clipboard'), 1800),
		);
	}

	function labelCopyButton(button, glyph, wording, glyphClass) {
		button.lastChild.textContent = wording;
		if (glyph) glyph.className = glyphClass;
	}

	/* These three pagers page through longer lists of rows. */

	function wireOrdersTable() {
		const footer = pick('[data-pg-pager]');
		const tbody = pick('[data-pg-rows]');
		if (!footer || !tbody) return;
		let painted = false;
		window.Basalt.pager(footer, {
			total: ORDER_COUNT,
			noun: 'orders',
			render(fromRow, toRow) {
				tbody.innerHTML = indexesBetween(fromRow - 1, toRow)
					.map((n) => orderRowHtml(orderAt(n)))
					.join('');
				if (painted) replayTurn(tbody);
				painted = true;
			},
		});
	}

	function orderAt(n) {
		const itemIndex = (n * 3) % ITEMS.length;
		const quantity = 1 + (n % 3);
		return {
			number: `#${2140 - n}`,
			shopper: SHOPPERS[(n * 7 + 2) % SHOPPERS.length],
			pieces: `${quantity} × ${ITEMS[itemIndex]}`,
			state: ORDER_STATES[(n * 7) % ORDER_STATES.length],
			amount: ITEM_PRICES[itemIndex] * quantity,
		};
	}

	function orderRowHtml({ number, shopper, pieces, state, amount }) {
		const cells = [
			`<td class="pg-id">${number}</td>`,
			`<td>${htmlSafe(shopper)}</td>`,
			`<td>${htmlSafe(pieces)}</td>`,
			`<td><span class="pg-status pg-status-${state.tone}">${state.label}</span></td>`,
			`<td class="pg-money">${dollars(amount)}</td>`,
		];
		return `<tr>${cells.join('')}</tr>`;
	}

	function wireSupplyList() {
		const holder = pick('[data-pg-loadmore]');
		if (!holder) return;
		window.Basalt.loadMore(holder, {
			total: SUPPLIES.length,
			batch: 6,
			noun: 'items',
			fetch: (offset, size) => afterDelay(() => SUPPLIES.slice(offset, offset + size).map(supplyItem), 750),
		});
	}

	function supplyItem({ name, spot, price }) {
		return listItem(
			listRowHtml({
				glyph: 'bi-scissors',
				title: name,
				detail: spot,
				tailClass: 'pg-list-val',
				tail: dollars(price),
			}),
		);
	}

	function wireActivityFeed() {
		const holder = pick('[data-pg-infinite]');
		if (!holder) return;
		window.Basalt.infinite(holder, {
			total: 40,
			batch: 8,
			noun: 'events',
			fetch: (offset, size) => afterDelay(() => indexesBetween(offset, offset + size).map(feedItem), 650),
		});
	}

	function feedItem(n) {
		const action = FEED_ACTIONS[n % FEED_ACTIONS.length];
		const subject = action.aboutOrder ? `#${2140 - n}` : ITEMS[(n * 3) % ITEMS.length];
		const minutesAgo = 2 + n * 7;
		const age = minutesAgo < 60 ? `${minutesAgo} min ago` : `${Math.floor(minutesAgo / 60)} h ago`;
		return listItem(
			listRowHtml({
				glyph: action.glyph,
				title: SHOPPERS[(n * 4 + 1) % SHOPPERS.length],
				detail: `${action.verb} ${subject}`,
				tailClass: 'pg-list-time',
				tail: age,
			}),
		);
	}

	/* These pagers step back and forth through a few items at a time. */

	function wireCursorList() {
		const box = pick('[data-pg-cursor]');
		if (!box) return;
		const feed = pick('[data-pg-cursor-list]', box);
		const newerButton = pick('[data-pg-cursor-newer]', box);
		const olderButton = pick('[data-pg-cursor-older]', box);
		const note = pick('[data-pg-cursor-caption]', box);
		let offset = 0;

		function paint(usedButton) {
			const stop = Math.min(CURSOR_TOTAL, offset + CURSOR_PAGE_SIZE);
			feed.innerHTML = indexesBetween(offset, stop)
				.map((n) => `<li>${cursorRowHtml(cursorEntry(n))}</li>`)
				.join('');
			replayTurn(feed);
			const top = cursorEntry(offset);
			const bottom = cursorEntry(stop - 1);
			note.innerHTML = `Orders from <strong>${top.clock}</strong> back to <strong>${bottom.clock}</strong><br>next cursor <code>${bottom.cursor}</code>`;
			newerButton.disabled = offset === 0;
			olderButton.disabled = offset + CURSOR_PAGE_SIZE >= CURSOR_TOTAL;
			handOffFocus(usedButton, newerButton, olderButton);
		}

		newerButton.addEventListener('click', () => {
			offset = Math.max(0, offset - CURSOR_PAGE_SIZE);
			paint(newerButton);
		});
		olderButton.addEventListener('click', () => {
			offset = Math.min(CURSOR_TOTAL - 1, offset + CURSOR_PAGE_SIZE);
			paint(olderButton);
		});
		paint();
	}

	/* Entries run newest first, eleven minutes apart, counting back from 2:02 pm. */
	function cursorEntry(n) {
		const minuteOfDay = 14 * 60 + 2 - n * 11;
		const hour = Math.floor(minuteOfDay / 60);
		const itemIndex = (n * 7) % ITEMS.length;
		return {
			cursor: `ord_${(0x9f2c - n * 37).toString(16)}`,
			shopper: SHOPPERS[(n * 2) % SHOPPERS.length],
			item: ITEMS[itemIndex],
			amount: ITEM_PRICES[itemIndex],
			clock: clockLabel(hour % 12 || 12, minuteOfDay % 60, hour < 12),
		};
	}

	function cursorRowHtml({ shopper, item, amount, clock }) {
		return listRowHtml({
			glyph: 'bi-receipt',
			title: shopper,
			detail: `${item} · ${dollars(amount)}`,
			tailClass: 'pg-list-time',
			tail: clock,
		});
	}

	function wireRecordStepper() {
		const bar = pick('[data-pg-record]');
		if (!bar) return;
		const backButton = pick('[data-pg-record-prev]', bar);
		const forwardButton = pick('[data-pg-record-next]', bar);
		const position = pick('[data-pg-record-pos]', bar);
		const sheet = pick('[data-pg-record-card]');
		let shown = 2;

		function paint(usedButton) {
			const record = recordAt(shown);
			const isFirst = shown === 0;
			const atEnd = shown === RECORD_TOTAL - 1;
			const before = isFirst ? 'First order' : recordAt(shown - 1).title;
			const after = atEnd ? 'Last order' : recordAt(shown + 1).title;
			position.innerHTML = `<strong>${shown + 1} / ${RECORD_TOTAL}</strong><span>to pack</span>`;
			pick('.basalt-record-pager-name', backButton).textContent = before;
			pick('.basalt-record-pager-name', forwardButton).textContent = after;
			backButton.disabled = isFirst;
			forwardButton.disabled = atEnd;
			backButton.setAttribute('aria-label', isFirst ? 'No previous order' : `Previous: ${before}`);
			forwardButton.setAttribute('aria-label', atEnd ? 'No next order' : `Next: ${after}`);
			sheet.innerHTML = recordFieldsHtml(record);
			replayTurn(sheet);
			handOffFocus(usedButton, backButton, forwardButton);
		}

		backButton.addEventListener('click', () => {
			if (shown === 0) return;
			shown -= 1;
			paint(backButton);
		});
		forwardButton.addEventListener('click', () => {
			if (shown === RECORD_TOTAL - 1) return;
			shown += 1;
			paint(forwardButton);
		});

		/* While focus is in the pager, J moves forward and K moves back. */
		const shortcuts = { j: forwardButton, k: backButton };
		bar.addEventListener('keydown', (event) => {
			if (event.altKey || event.ctrlKey || event.metaKey) return;
			const target = shortcuts[event.key.toLowerCase()];
			if (!target) return;
			event.preventDefault();
			target.click();
		});
		paint();
	}

	function recordAt(n) {
		const itemIndex = (n * 3 + 1) % ITEMS.length;
		const hour = 8 + (n % 6);
		return {
			title: `Order #${1040 + n}`,
			shopper: SHOPPERS[(n * 3) % SHOPPERS.length],
			item: ITEMS[itemIndex],
			amount: dollars(ITEM_PRICES[itemIndex]),
			paidAt: clockLabel(hour, (n * 13) % 60, hour < 12),
		};
	}

	function recordFieldsHtml({ title, shopper, item, amount, paidAt }) {
		const fields = [
			['Order', title],
			['Customer', htmlSafe(shopper)],
			['Items', htmlSafe(item)],
			['Total', amount],
			['Paid at', paidAt],
		];
		return fields.map(([term, detail]) => `<div><dt>${term}</dt><dd>${detail}</dd></div>`).join('');
	}

	function wireBestsellerPager() {
		const box = pick('[data-pg-mini]');
		if (!box) return;
		const ranking = pick('[data-pg-mini-list]', box);
		const backButton = pick('[data-pg-mini-prev]', box);
		const forwardButton = pick('[data-pg-mini-next]', box);
		const marker = pick('[data-pg-mini-pos]', box);
		const viewCount = Math.ceil(BESTSELLERS.length / BESTSELLERS_PER_VIEW);
		let view = 0;

		function paint(usedButton) {
			const firstRank = view * BESTSELLERS_PER_VIEW;
			ranking.innerHTML = BESTSELLERS.slice(firstRank, firstRank + BESTSELLERS_PER_VIEW)
				.map(
					({ title, sold }, offset) =>
						`<li><span class="pg-rank-n">${firstRank + offset + 1}</span><span class="pg-rank-name">${htmlSafe(title)}</span><span class="pg-rank-val">${sold} sold</span></li>`,
				)
				.join('');
			marker.innerHTML = `${view + 1}<span> / ${viewCount}</span>`;
			backButton.disabled = view === 0;
			forwardButton.disabled = view === viewCount - 1;
			replayTurn(ranking);
			handOffFocus(usedButton, backButton, forwardButton);
		}

		backButton.addEventListener('click', () => {
			view = Math.max(0, view - 1);
			paint(backButton);
		});
		forwardButton.addEventListener('click', () => {
			view = Math.min(viewCount - 1, view + 1);
			paint(forwardButton);
		});
		paint();
	}

	/* The dots and the letter index jump straight to a slide or a letter. */

	function wireTipDots() {
		const box = pick('[data-pg-slides]');
		if (!box) return;
		const stage = pick('[data-pg-slide-view]', box);
		const counter = pick('[data-pg-slide-step]', box);
		window.Basalt.dots(pick('.basalt-dots', box), (index) => {
			const { glyph, heading, body } = FIELD_TIPS[index];
			stage.innerHTML = `<span class="pg-slides-icon" aria-hidden="true"><i class="bi ${glyph}"></i></span><div><h3 class="pg-slides-title">${htmlSafe(heading)}</h3><p class="pg-slides-text">${htmlSafe(body)}</p></div>`;
			counter.textContent = `Tip ${index + 1} of ${FIELD_TIPS.length}`;
			replayTurn(stage);
		});
	}

	function wireLetterIndex() {
		const box = pick('[data-pg-alpha]');
		if (!box) return;
		const strip = pick('.basalt-alpha', box);
		const roster = pick('[data-pg-alpha-list]', box);
		const summary = pick('[data-pg-alpha-count]', box);

		const letterButtons = [letterButton('All', '', 'basalt-alpha-key basalt-alpha-key-all')];
		for (const letter of ALPHABET) {
			const button = letterButton(letter, letter, 'basalt-alpha-key');
			const matches = companiesUnder(letter).length;
			button.disabled = matches === 0;
			button.setAttribute(
				'aria-label',
				`${letter}, ${matches ? countOf(matches, 'customer', 'customers') : 'no customers'}`,
			);
			letterButtons.push(button);
		}
		strip.append(...letterButtons);

		function choose(chosen, moveFocus) {
			for (const button of letterButtons) {
				const isChosen = button === chosen;
				button.setAttribute('aria-pressed', String(isChosen));
				button.tabIndex = isChosen ? 0 : -1;
			}
			const letter = chosen.dataset.key;
			const matches = companiesUnder(letter);
			roster.innerHTML = matches.map(directoryRowHtml).join('');
			summary.textContent = letter
				? `${countOf(matches.length, 'customer', 'customers')} under ${letter}`
				: `All ${matches.length} customers`;
			if (moveFocus) chosen.focus();
		}

		strip.addEventListener('click', (event) => {
			const button = event.target.closest('.basalt-alpha-key');
			if (button && !button.disabled) choose(button);
		});

		/* The row is a single tab stop; arrows, Home and End walk the enabled letters. */
		strip.addEventListener('keydown', (event) => {
			const enabled = letterButtons.filter((button) => !button.disabled);
			const here = enabled.indexOf(document.activeElement);
			if (here < 0) return;
			const destinations = { ArrowRight: here + 1, ArrowLeft: here - 1, Home: 0, End: enabled.length - 1 };
			if (!Object.hasOwn(destinations, event.key)) return;
			event.preventDefault();
			choose(enabled[(destinations[event.key] + enabled.length) % enabled.length], true);
		});

		choose(letterButtons.find((button) => button.dataset.key === 'L'));
	}

	function letterButton(caption, key, classes) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = classes;
		button.textContent = caption;
		button.dataset.key = key;
		return button;
	}

	/** An empty letter means every company. */
	function companiesUnder(letter) {
		return DIRECTORY.filter(({ company }) => !letter || company[0] === letter);
	}

	function directoryRowHtml({ company, city }) {
		const monogram = company
			.split(' ')
			.map((word) => word[0])
			.join('')
			.slice(0, 2);
		return `<li><span class="pg-people-avatar" aria-hidden="true">${monogram}</span><span><span class="pg-people-name">${htmlSafe(company)}</span><span class="pg-people-sub">${htmlSafe(city)}</span></span></li>`;
	}

	/* These strips are static Bootstrap markup whose links carry ?page=N.
     Clicks only move .active so the demo answers; a live page would follow
     the href instead. */
	function wireBootstrapDemos() {
		for (const strip of pickAll('[data-pg-live]')) {
			strip.addEventListener('click', (event) => followPageLink(strip, event));
		}
	}

	function followPageLink(strip, event) {
		const anchor = event.target.closest('.page-link');
		if (!anchor || !strip.contains(anchor)) return;
		event.preventDefault();
		const slot = anchor.parentElement;
		if (slot.classList.contains('disabled')) return;

		const numbered = pickAll('.page-item', strip).filter((item) => /^\d+$/.test(item.textContent.trim()));
		const current = numbered.findIndex((item) => item.classList.contains('active'));
		const arrowRule = ARROW_TARGETS.get(anchor.getAttribute('data-pg-step'));
		const target = arrowRule ? arrowRule(current, numbered.length) : numbered.indexOf(slot);
		if (target < 0 || target >= numbered.length) return;

		for (const [position, item] of numbered.entries()) {
			const isTarget = position === target;
			item.classList.toggle('active', isTarget);
			const pageAnchor = pick('.page-link', item);
			if (isTarget) pageAnchor.setAttribute('aria-current', 'page');
			else pageAnchor.removeAttribute('aria-current');
		}
		for (const arrow of pickAll('[data-pg-step]', strip)) setArrowState(arrow, target, numbered);

		if (slot.classList.contains('disabled')) pick('.page-link', numbered[target]).focus();
	}

	/** Backward arrows switch off on the first page, forward ones on the last;
      a live arrow links to the page it leads to. */
	function setArrowState(arrow, target, numbered) {
		const direction = arrow.getAttribute('data-pg-step');
		const backward = direction === 'prev' || direction === 'first';
		const atEdge = backward ? target === 0 : target === numbered.length - 1;
		arrow.parentElement.classList.toggle('disabled', atEdge);
		if (atEdge) {
			arrow.removeAttribute('href');
			arrow.setAttribute('aria-disabled', 'true');
		} else {
			const leadsTo = numbered[ARROW_TARGETS.get(direction)(target, numbered.length)];
			arrow.setAttribute('href', pick('.page-link', leadsTo).getAttribute('href'));
			arrow.removeAttribute('aria-disabled');
		}
	}

	/* Small helpers every demo above leans on. */

	function pick(selector, scope = demoPage) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = demoPage) {
		return [...scope.querySelectorAll(selector)];
	}

	function indexesBetween(from, to) {
		return Array.from({ length: Math.max(0, to - from) }, (_, step) => from + step);
	}

	function listItem(markup) {
		const item = document.createElement('li');
		item.innerHTML = markup;
		return item;
	}

	/** Icon, title over detail, and a trailing value: the row shape every list here shares. */
	function listRowHtml({ glyph, title, detail, tailClass, tail }) {
		return (
			`<span class="pg-list-icon" aria-hidden="true"><i class="bi ${glyph}"></i></span>` +
			`<span class="pg-list-main"><span class="pg-list-name">${htmlSafe(title)}</span><span class="pg-list-sub">${htmlSafe(detail)}</span></span>` +
			`<span class="${tailClass}">${tail}</span>`
		);
	}

	/**
	 * When the button just pressed has run out of pages, focus moves to its
	 * partner so keyboard users are not stranded on a disabled control.
	 */
	function handOffFocus(usedButton, ...pair) {
		if (!usedButton?.disabled) return;
		pair.find((button) => button !== usedButton).focus();
	}

	/* Restart the page-turn animation, unless the visitor prefers less motion. */
	function replayTurn(element) {
		if (!element || prefersLessMotion()) return;
		element.classList.remove('is-turning');
		void element.offsetWidth;
		element.classList.add('is-turning');
	}

	function prefersLessMotion() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/** Fakes a server round trip: resolves with produce() after the delay. */
	function afterDelay(produce, delay) {
		return new Promise((resolve) => {
			setTimeout(() => resolve(produce()), prefersLessMotion() ? 150 : delay);
		});
	}

	function clockLabel(hourShown, minute, isMorning) {
		return `${hourShown}:${String(minute).padStart(2, '0')} ${isMorning ? 'am' : 'pm'}`;
	}

	function countOf(amount, singular, pluralForm) {
		return `${amount} ${amount === 1 ? singular : pluralForm}`;
	}

	function dollars(amount) {
		return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function htmlSafe(text) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
		return String(text).replace(/[&<>"]/g, (character) => entities[character]);
	}

	start();
})();
