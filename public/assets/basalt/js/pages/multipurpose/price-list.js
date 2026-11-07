/**
 * Price list (price-list.html, the element marked [data-acl-root]).
 *
 * Marlo's price rules form a ladder: when more than one rule matches an
 * order line, the one nearest the top decides the price. This script
 * paints the ladder, the "what would they pay" checker, the rule side
 * panel and the create/edit dialog from the sample records below, and
 * hands drag-to-reorder to the shared sortable list.
 */
(() => {
	'use strict';

	const shell = pick('[data-acl-root]');
	if (!shell) return;

	/* Sample records. A real store would fetch these; AS_OF is frozen so
     every status and date on the page reads the same on any day. */
	const AS_OF = '2026-10-08';

	const PRODUCTS = [
		{ sku: 'ML-BLAZ', name: 'Sculpted Shoulder Blazer', cat: 'devices', price: 1290 },
		{ sku: 'ML-GOWN', name: 'Draped Column Gown', cat: 'devices', price: 2150 },
		{ sku: 'ML-ORGZ', name: 'Organza Dress', cat: 'devices', price: 1680 },
		{ sku: 'ML-SUIT', name: 'Chalk-Stripe Suit', cat: 'devices', price: 2450 },
		{ sku: 'ML-TRCH', name: 'Leather Trench Coat', cat: 'devices', price: 3200 },
		{ sku: 'ML-LOAF', name: 'Bar Loafers', cat: 'devices', price: 790 },
		{ sku: 'ML-OXFD', name: 'Two-Tone Oxfords', cat: 'accessories', price: 850 },
		{ sku: 'ML-CATE', name: 'Cat-Eye Sunglasses', cat: 'accessories', price: 465 },
		{ sku: 'ML-SHLD', name: 'Shield Sunglasses', cat: 'accessories', price: 520 },
		{ sku: 'ML-GIFT250', name: 'E-Gift Card, $250', cat: 'addons', price: 250 },
		{ sku: 'ML-CARE', name: 'Aftercare Plan', cat: 'addons', price: 25, unit: 'member a month' },
		{ sku: 'ML-PASS', name: 'Delivery Pass', cat: 'addons', price: 15, unit: 'member a month' },
		{ sku: 'ML-MTM', name: 'Made to Measure', cat: 'services', price: 4800 },
		{ sku: 'ML-STYLE', name: 'Styling Session', cat: 'services', price: 650 },
	];

	const BUYERS = [
		{ name: 'Wren & Thistle Co.', plan: 'Insider', since: '2023-05-14' },
		{ name: 'The Silk Room', plan: 'Insider', since: '2022-11-02' },
		{ name: 'Magnolia Lane', plan: 'Member', since: '2024-03-19' },
		{ name: 'Sabrina Kavanagh', plan: 'Member', since: '2025-01-08' },
		{ name: 'Josephine Albright', plan: 'Standard', since: '2025-06-23' },
		{ name: 'Valerie Richards', plan: 'Standard', since: '2026-09-02' },
	];

	/* The ladder itself, top rule first. kind is percent, amount, tiers
     or fixed; who is everyone, new, plan:<name> or account:<name>;
     scope is all, goods, a category or pick (a list of skus); used
     counts orders and dollars saved since October 1. */
	const ladder = [
		{
			id: '#1104',
			name: 'Wren & Thistle wholesale prices',
			kind: 'fixed',
			prices: { 'ML-BLAZ': 559, 'ML-GOWN': 369, 'ML-ORGZ': 99, 'ML-SUIT': 159, 'ML-TRCH': 125 },
			who: 'account:Wren & Thistle Co.',
			scope: 'pick',
			start: '2026-04-02',
			status: 'active',
			used: { orders: 6, off: 2310 },
		},
		{
			id: '#1207',
			name: 'The Silk Room wholesale prices',
			kind: 'fixed',
			prices: { 'ML-BLAZ': 565, 'ML-GOWN': 375, 'ML-OXFD': 39, 'ML-CATE': 72 },
			who: 'account:The Silk Room',
			scope: 'pick',
			start: '2026-11-01',
			status: 'scheduled',
			used: { orders: 0, off: 0 },
		},
		{
			id: '#1043',
			name: 'Insider tier: 12% off clothing',
			kind: 'percent',
			value: 12,
			who: 'plan:Insider',
			scope: 'hardware',
			start: '2026-02-02',
			status: 'active',
			used: { orders: 14, off: 1920 },
		},
		{
			id: '#1088',
			name: 'Multi-buy on blazers and gowns',
			kind: 'tiers',
			tiers: [
				[10, 5],
				[25, 8],
				[50, 12],
			],
			who: 'everyone',
			scope: 'pick',
			skus: ['ML-BLAZ', 'ML-GOWN'],
			start: '2026-03-16',
			status: 'active',
			used: { orders: 3, off: 1068 },
		},
		{
			id: '#1215',
			name: 'Autumn/Winter 26: 8% off clothing',
			kind: 'percent',
			value: 8,
			who: 'everyone',
			scope: 'devices',
			start: '2026-10-01',
			end: '2026-12-31',
			status: 'active',
			used: { orders: 22, off: 1486 },
		},
		{
			id: '#1137',
			name: 'Member tier: 10% off accessories',
			kind: 'percent',
			value: 10,
			who: 'plan:Member',
			scope: 'accessories',
			start: '2026-05-11',
			status: 'active',
			used: { orders: 17, off: 342 },
		},
		{
			id: '#1152',
			name: 'Delivery Pass: $1 off a month',
			kind: 'amount',
			value: 1,
			who: 'everyone',
			scope: 'pick',
			skus: ['ML-PASS'],
			start: '2026-05-04',
			status: 'active',
			used: { orders: 9, off: 412 },
		},
		{
			id: '#1196',
			name: 'New customers: 15% off styling',
			kind: 'percent',
			value: 15,
			who: 'new',
			scope: 'services',
			start: '2026-08-03',
			status: 'active',
			used: { orders: 4, off: 705 },
		},
		{
			id: '#1231',
			name: 'Magnolia Lane reorder offer',
			kind: 'percent',
			value: 6,
			who: 'account:Magnolia Lane',
			scope: 'hardware',
			start: '2026-07-01',
			status: 'paused',
			pausedOn: '2026-09-30',
			used: { orders: 0, off: 0 },
		},
		{
			id: '#1228',
			name: 'Year-end gift cards: 20% off',
			kind: 'percent',
			value: 20,
			who: 'everyone',
			scope: 'pick',
			skus: ['ML-GIFT250'],
			start: '2026-11-20',
			end: '2026-12-31',
			status: 'scheduled',
			used: { orders: 0, off: 0 },
		},
		{
			id: '#1247',
			name: 'Leather Trench Coat price match',
			kind: 'amount',
			value: 20,
			who: 'everyone',
			scope: 'pick',
			skus: ['ML-TRCH'],
			start: '2026-10-12',
			status: 'draft',
			used: { orders: 0, off: 0 },
		},
		{
			id: '#1259',
			name: 'Spring accessories sale',
			kind: 'percent',
			value: 25,
			who: 'everyone',
			scope: 'accessories',
			start: '2026-03-02',
			end: '2026-05-31',
			status: 'ended',
			used: { orders: 0, off: 0 },
		},
	];

	const STATES = {
		active: { label: 'Active', tone: 'success' },
		scheduled: { label: 'Scheduled', tone: 'info' },
		paused: { label: 'Paused', tone: 'warning' },
		draft: { label: 'Draft', tone: '' },
		ended: { label: 'Ended', tone: '' },
	};

	/* A discount kind shows the same glyph as its tile in the dialog; the
     stylesheet gives each kind its own chart color. */
	const GLYPHS = { percent: 'percent', amount: 'dash-circle', tiers: 'bar-chart-steps', fixed: 'pin-angle' };

	const SCOPE_NAMES = {
		all: 'All products',
		hardware: 'All goods',
		devices: 'Clothing',
		accessories: 'Accessories',
		addons: 'Extras',
		services: 'Services',
	};

	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	const DISCOUNT_WORDS = {
		percent: (rule) => `${rule.value}% off the list price`,
		amount: (rule) => `${dollars(rule.value)} off each unit`,
		tiers: () => 'More off as the quantity grows',
		fixed: () => 'A set price for each product',
	};

	const toCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
	const toDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

	/* Nodes and Bootstrap instances, set up as the script runs. */
	const ruleList = pick('[data-acl-rules]');
	const noMatches = pick('[data-acl-empty]');
	const filterText = pick('[data-acl-search]');
	const filterStatus = pick('[data-acl-status]');
	const tally = pick('[data-acl-count]');
	const panelNode = pick('#pm-rule');
	const panel = window.bootstrap.Offcanvas.getOrCreateInstance(panelNode);
	const dialogNode = pick('#pm-edit');
	const dialog = window.bootstrap.Modal.getOrCreateInstance(dialogNode);
	const editor = pick('[data-acl-form]');
	const checker = {
		buyer: pick('[data-acl-check="account"]'),
		product: pick('[data-acl-check="sku"]'),
		quantity: pick('[data-acl-check="qty"]'),
		output: pick('[data-acl-result]'),
		plan: pick('[data-acl-check-plan]'),
	};

	/* Which rule the side panel shows and which one the dialog edits. */
	let shownRuleId = null;
	let ruleInEditor = null;

	/** Fills the selects now, before basalt.js swaps them for its own
      menus, binds every control and paints once the DOM is ready. */
	function start() {
		const buyerOptions = BUYERS.map(
			({ name }) => `<option value="${escapeText(name)}">${escapeText(name)}</option>`,
		).join('');
		const productOptions = PRODUCTS.map(
			({ sku, name }) => `<option value="${sku}">${escapeText(name)}</option>`,
		).join('');
		checker.buyer.innerHTML = buyerOptions;
		checker.product.innerHTML = productOptions;
		field('account').innerHTML = buyerOptions;
		field('pick').innerHTML = productOptions;

		filterText.addEventListener('input', filterLadder);
		filterStatus.addEventListener('change', () => {
			filterLadder();
			waveLadder();
		});
		ruleList.addEventListener('click', onLadderClick);
		ruleList.addEventListener('basalt:sortable-change', onReorder);

		panelSlot('foot').addEventListener('click', onPanelAction);

		dialogNode.addEventListener('shown.bs.modal', () => field('name').focus());
		editor.addEventListener('change', onEditorChange);
		editor.addEventListener('input', ({ target }) => {
			if (target.classList.contains('is-invalid')) target.classList.remove('is-invalid');
			paintPreview();
		});
		editor.addEventListener('submit', saveRule);
		pick('[data-acl-new]').addEventListener('click', () => launchEditor(null, null));

		checker.output.addEventListener('click', (event) => {
			const link = event.target.closest('[data-acl-goto]');
			if (link) showRule(link.getAttribute('data-acl-goto'));
		});
		checker.buyer.addEventListener('change', paintCheck);
		checker.product.addEventListener('change', paintCheck);
		checker.quantity.addEventListener('input', paintCheck);
		checker.quantity.addEventListener('change', paintCheck);

		document.addEventListener('DOMContentLoaded', () => {
			paintLadder();
			paintCheck();
			ruleList.setAttribute('data-basalt-sortable', '');
			window.Basalt.sortable?.(ruleList);
			(window.Basalt.settled || Promise.resolve()).then(waveLadder);
		});
	}

	/* Small utilities. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function escapeText(value) {
		const swaps = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value).replace(/[&<>"']/g, (ch) => swaps[ch]);
	}

	function dollars(amount) {
		return toCents.format(amount);
	}

	function toCent(amount) {
		return Math.round(amount * 100) / 100;
	}

	function count(amount, noun) {
		return amount === 1 ? `1 ${noun}` : `${amount} ${noun}s`;
	}

	function product(sku) {
		return PRODUCTS.find((item) => item.sku === sku);
	}

	function ruleById(id) {
		return ladder.find((rule) => rule.id === id);
	}

	function position(rule) {
		return ladder.indexOf(rule) + 1;
	}

	function announce(message) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(message) : null;
	}

	/** "Feb 2, 2026"; with brief set, the year is left off for 2026. */
	function readable(stamp, brief) {
		const [year, month, day] = stamp.split('-').map(Number);
		const yearPart = brief && year === 2026 ? '' : `, ${year}`;
		return `${MONTH_NAMES[month - 1]} ${day}${yearPart}`;
	}

	function daysApart(from, to) {
		return Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
	}

	/* What a rule covers and how it reads in words. */

	function coveredSkus(rule) {
		if (rule.kind === 'fixed') return Object.keys(rule.prices);
		if (rule.scope === 'pick') return [...rule.skus];
		const goods = ['devices', 'accessories'];
		return PRODUCTS.filter(
			({ cat }) =>
				rule.scope === 'all' || cat === rule.scope || (rule.scope === 'hardware' && goods.includes(cat)),
		).map(({ sku }) => sku);
	}

	function coverageWords(rule) {
		if (rule.scope !== 'pick') return SCOPE_NAMES[rule.scope];
		const skus = coveredSkus(rule);
		if (skus.length === 1 || skus.length === 2) return skus.map((sku) => product(sku).name).join(' and ');
		return `${skus.length} products`;
	}

	function audienceWords(who) {
		if (who === 'everyone') return 'Everyone';
		if (who === 'new') return 'New customers';
		const [type, name] = who.split(':');
		return type === 'plan' ? `${name} tier` : name;
	}

	function offerWords(rule) {
		switch (rule.kind) {
			case 'percent':
				return `${rule.value}% off`;
			case 'amount':
				return `${dollars(rule.value).replace('.00', '')} off`;
			case 'tiers': {
				const shares = rule.tiers.map(([, share]) => share);
				const span = shares.length > 1 ? `–${Math.max(...shares)}` : '';
				return `${Math.min(...shares)}${span}% off by quantity`;
			}
			default:
				return 'Fixed prices';
		}
	}

	function timingWords({ status, start, end, pausedOn }) {
		if (status === 'active') return end ? `Until ${readable(end, true)}` : `Since ${readable(start, true)}`;
		const phrases = {
			scheduled: () => `From ${readable(start, true)}`,
			paused: () => `Paused ${readable(pausedOn, true)}`,
			ended: () => `Ended ${readable(end, true)}`,
		};
		return phrases[status] ? phrases[status]() : 'Not published';
	}

	function stateBadge(status) {
		const { label, tone } = STATES[status];
		return `<span class="basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}">${label}</span>`;
	}

	function kindBadge({ kind }) {
		return `<span class="acl-kind acl-kind-${kind}" aria-hidden="true"><i class="bi bi-${GLYPHS[kind]}"></i></span>`;
	}

	/* Pricing logic. */

	/** One rule's unit price for one product, or null if it does not apply. */
	function priceUnder(rule, sku, quantity) {
		if (rule.kind === 'fixed') return sku in rule.prices ? rule.prices[sku] : null;
		if (!coveredSkus(rule).includes(sku)) return null;
		const { price } = product(sku);
		if (rule.kind === 'percent') return toCent(price * (1 - rule.value / 100));
		if (rule.kind === 'amount') return Math.max(0, toCent(price - rule.value));
		const step = rule.tiers.filter(([from]) => quantity >= from).pop();
		return step ? toCent(price * (1 - step[1] / 100)) : null;
	}

	function appliesTo(rule, buyer) {
		if (rule.who === 'everyone') return true;
		if (rule.who === 'new') return daysApart(buyer.since, AS_OF) <= 90;
		const [type, name] = rule.who.split(':');
		return (type === 'plan' ? buyer.plan : buyer.name) === name;
	}

	function liveToday({ status, start, end }) {
		return status === 'active' && start <= AS_OF && (!end || end >= AS_OF);
	}

	/** Sets a waiting or paused rule to whatever its dates now make it. */
	function activate(rule) {
		if (rule.end && rule.end < AS_OF) rule.status = 'ended';
		else rule.status = rule.start > AS_OF ? 'scheduled' : 'active';
		delete rule.pausedOn;
	}

	/* The ladder: rows, filtering and reordering. */

	function ladderRow(rule, index) {
		const idle = !['active', 'scheduled'].includes(rule.status);
		const title = escapeText(rule.name);
		return `<li class="basalt-sortable-item acl-rule${idle ? ' is-idle' : ''}" data-id="${rule.id}"><div class="acl-rule-lead"><button type="button" class="basalt-sortable-handle" aria-label="Move ${title}" aria-describedby="basalt-sortable-help" aria-pressed="false"><i class="bi bi-grip-vertical" aria-hidden="true"></i></button><span class="basalt-sortable-rank">${index + 1}</span></div><div class="acl-rule-main">${kindBadge(rule)}<div class="acl-rule-text"><button type="button" class="acl-rule-name" data-acl-open>${title}</button><p class="acl-rule-sub">${escapeText(audienceWords(rule.who))} · ${escapeText(coverageWords(rule))}</p></div></div><div class="acl-rule-facts"><span class="acl-rule-disc">${offerWords(rule)}</span><span class="acl-rule-when">${timingWords(rule)}</span></div><div class="acl-rule-status">${stateBadge(rule.status)}</div><button type="button" class="btn btn-icon acl-rule-open" aria-label="Open ${title}" data-acl-open><i class="bi bi-chevron-right" aria-hidden="true"></i></button></li>`;
	}

	function paintLadder() {
		ruleList.innerHTML = ladder.map(ladderRow).join('');
		filterLadder();
	}

	function searchableText(rule) {
		const productNames = coveredSkus(rule).map((sku) => product(sku).name);
		return [
			rule.id,
			rule.name,
			audienceWords(rule.who),
			coverageWords(rule),
			offerWords(rule),
			STATES[rule.status].label,
			...productNames,
		].join(' ');
	}

	/* The rows ripple top to bottom once the page settles and again when
	   the status filter changes, so the new list is seen arriving. Only the
	   first ten visible rows take part, so a long list never drags. */
	let waveDone = 0;
	function waveLadder() {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const rows = pickAll('.acl-rule:not([hidden])', ruleList).slice(0, 10);
		for (const row of pickAll('.acl-rule.in-wave', ruleList)) row.classList.remove('in-wave');
		rows.forEach((row, i) => {
			row.classList.add('in-wave');
			row.style.setProperty('--wave-i', i);
		});
		ruleList.classList.remove('is-waving');
		void ruleList.offsetWidth;
		ruleList.classList.add('is-waving');
		clearTimeout(waveDone);
		waveDone = setTimeout(() => ruleList.classList.remove('is-waving'), 700 + rows.length * 70);
	}

	/** Hides rows that miss the search or status; handles stop working
      while a filter is on, since a partial list cannot be reordered. */
	function filterLadder() {
		const query = filterText.value.trim();
		const wanted = filterStatus.value;
		const narrowed = Boolean(query) || wanted !== 'all';
		let visible = 0;

		for (const row of pickAll('.acl-rule', ruleList)) {
			const rule = ruleById(row.getAttribute('data-id'));
			const keep =
				(wanted === 'all' || rule.status === wanted) &&
				(!query || window.Basalt.matchesQuery(searchableText(rule), query));
			row.hidden = !keep;
			visible += keep ? 1 : 0;
		}

		ruleList.classList.toggle('is-filtered', narrowed);
		for (const handle of pickAll('.basalt-sortable-handle', ruleList)) handle.tabIndex = narrowed ? -1 : 0;

		const total = count(ladder.length, 'rule');
		tally.textContent = narrowed
			? `${visible} of ${total}. Clear the filters to reorder.`
			: `${total}, ${ladder.filter(liveToday).length} live today`;

		noMatches.hidden = visible > 0;
		noMatches.innerHTML = visible ? '' : window.Basalt.emptyState(emptyStateFor(query, wanted));
	}

	/** A search that finds nothing gets the query echoed back; an empty
      status just says so. */
	function emptyStateFor(query, status) {
		if (query) return { query, noun: 'rules' };
		return {
			icon: 'tags',
			title: `No ${STATES[status].label.toLowerCase()} rules`,
			text: 'Pick another status to see the rest.',
		};
	}

	function onLadderClick(event) {
		if (event.target.closest('.basalt-sortable-handle')) return;
		const row = event.target.closest('.acl-rule');
		if (row) showRule(row.getAttribute('data-id'));
	}

	/** A drop reorders the data itself, so the panel and the checker follow. */
	function onReorder(event) {
		const order = pickAll('.acl-rule', ruleList).map((row) => row.getAttribute('data-id'));
		ladder.sort((first, second) => order.indexOf(first.id) - order.indexOf(second.id));
		const moved = ruleById(event.detail.item.getAttribute('data-id'));
		paintCheck();
		announce({
			tone: 'success',
			title: 'Priority updated',
			text: `${moved.name} is now number ${position(moved)}.`,
		});
	}

	/* The rule side panel. */

	function panelSlot(key) {
		return pick(`[data-acl-d="${key}"]`, panelNode);
	}

	function showRule(id) {
		shownRuleId = id;
		paintPanel(ruleById(id));
		panel.show();
	}

	function repaintAll() {
		paintLadder();
		paintCheck();
		const current = shownRuleId && ruleById(shownRuleId);
		if (current) paintPanel(current);
	}

	function paintPanel(rule) {
		const listTitles = { tiers: 'Price by quantity', fixed: 'Prices for this customer' };
		panelSlot('kind').innerHTML = kindBadge(rule);
		panelSlot('name').textContent = rule.name;
		panelSlot('sub').textContent = `${rule.id} · priority ${position(rule)} of ${ladder.length}`;
		panelSlot('pill').innerHTML = stateBadge(rule.status);
		panelSlot('summary').textContent = storyOf(rule);
		panelSlot('facts').innerHTML = factList(rule);
		panelSlot('prices-title').textContent = listTitles[rule.kind] || 'Example prices';
		panelSlot('prices').innerHTML = samplePrices(rule, 4, true);
		panelSlot('foot').innerHTML = panelButtons(rule);
	}

	function storyOf(rule) {
		const { status, start, end, pausedOn, used } = rule;
		if (status === 'active') {
			const period = `Live since ${readable(start)}${end ? `, until ${readable(end)}` : ''}. `;
			const effect = used.orders
				? `Took ${toDollars.format(used.off)} off ${count(used.orders, 'order')} so far in October.`
				: 'No orders have used it in October yet.';
			return `${period}${effect}`;
		}
		if (status === 'scheduled')
			return `Starts on ${readable(start)}${end ? ` and runs until ${readable(end)}` : ''}. Until then, orders get the next rule down.`;
		if (status === 'paused')
			return `Paused on ${readable(pausedOn)}. Orders get the next rule down, or the list price, until it is resumed.`;
		if (status === 'ended')
			return `Ran from ${readable(start)} to ${readable(end)}. Nobody gets this price any more.`;
		return 'Not published yet. Nobody gets this price until it is.';
	}

	function factList(rule) {
		let audience;
		if (rule.who.startsWith('account:'))
			audience = `<a href="shoppers.html">${escapeText(audienceWords(rule.who))}</a>`;
		else
			audience = escapeText(
				rule.who === 'new' ? 'New customers, in their first 90 days' : audienceWords(rule.who),
			);

		const broad = rule.scope !== 'pick' && rule.scope !== 'all';
		const coverage = `${escapeText(coverageWords(rule))}${broad ? ` (${count(coveredSkus(rule).length, 'product')})` : ''}`;
		const runs =
			rule.status === 'draft' && !rule.start
				? 'Not set'
				: `${readable(rule.start)}${rule.end ? ` to ${readable(rule.end)}` : ', no end date'}`;

		const pairs = {
			'Who gets it': audience,
			Products: coverage,
			Discount: DISCOUNT_WORDS[rule.kind](rule),
			Runs: runs,
		};
		return Object.entries(pairs)
			.map(([term, detail]) => `<div><dt>${term}</dt><dd>${detail}</dd></div>`)
			.join('');
	}

	function priceCell(before, after) {
		const struck = before !== after ? `<span class="acl-prices-was">${dollars(before)}</span>` : '';
		return `<span class="acl-prices-cost">${struck}<span class="acl-prices-now">${dollars(after)}</span></span>`;
	}

	/** The product name links to its page only in the panel, not in the
      dialog's preview. */
	function nameCell(item, note, withLink) {
		const label = withLink ? `<a href="product-details.html">${escapeText(item.name)}</a>` : escapeText(item.name);
		return `<span>${label}${note ? `<span class="acl-prices-note">${escapeText(note)}</span>` : ''}</span>`;
	}

	/** Sample prices: a handful of products, or each step of a quantity rule. */
	function samplePrices(rule, limit, withLink) {
		if (rule.kind === 'tiers') return quantityLadder(rule);

		const skus = coveredSkus(rule);
		const lines = skus.slice(0, limit).map((sku) => {
			const item = product(sku);
			const offered = priceUnder(rule, sku, 1);
			return `<li>${nameCell(item, item.unit ? `per ${item.unit}` : '', withLink)}${priceCell(item.price, offered ?? item.price)}</li>`;
		});
		if (skus.length > limit)
			lines.push(`<li class="acl-prices-more">and ${count(skus.length - limit, 'more product')}</li>`);
		return lines.join('');
	}

	function quantityLadder(rule) {
		const item = product(coveredSkus(rule)[0]);
		if (!item) return '';
		const steps = [...rule.tiers].sort((first, second) => first[0] - second[0]);
		const lines = [`<li class="acl-prices-more">${escapeText(item.name)}, for each unit</li>`];
		if (steps.length && steps[0][0] > 1) {
			lines.push(
				`<li>${nameCell({ name: `1 to ${steps[0][0] - 1} units` }, 'List price')}${priceCell(item.price, item.price)}</li>`,
			);
		}
		steps.forEach(([from, share], index) => {
			const following = steps[index + 1];
			const band = following ? `${from} to ${following[0] - 1} units` : `${from} units or more`;
			lines.push(
				`<li>${nameCell({ name: band }, `${share}% off`)}${priceCell(item.price, toCent(item.price * (1 - share / 100)))}</li>`,
			);
		});
		return lines.join('');
	}

	function panelButtons({ status }) {
		const editButton = (classes) =>
			`<button type="button" class="btn ${classes}" data-acl-act="edit"><i class="bi bi-pencil me-1" aria-hidden="true"></i>Edit rule</button>`;
		const footers = {
			active: () =>
				`<button type="button" class="btn btn-outline-secondary me-auto" data-acl-act="pause"><i class="bi bi-pause-fill me-1" aria-hidden="true"></i>Pause</button>${editButton('btn-primary')}`,
			paused: () =>
				`${editButton('btn-outline-secondary me-auto')}<button type="button" class="btn btn-primary" data-acl-act="resume"><i class="bi bi-play-fill me-1" aria-hidden="true"></i>Resume</button>`,
			draft: () =>
				`${editButton('btn-outline-secondary me-auto')}<button type="button" class="btn btn-primary" data-acl-act="publish"><i class="bi bi-send me-1" aria-hidden="true"></i>Publish</button>`,
			ended: () =>
				'<button type="button" class="btn btn-primary" data-acl-act="copy"><i class="bi bi-copy me-1" aria-hidden="true"></i>Run it again</button>',
		};
		return footers[status] ? footers[status]() : editButton('btn-primary');
	}

	function onPanelAction(event) {
		const button = event.target.closest('[data-acl-act]');
		if (!button) return;
		const rule = ruleById(shownRuleId);
		const action = button.getAttribute('data-acl-act');

		if (action === 'edit' || action === 'copy') {
			panel.hide();
			if (action === 'edit') launchEditor(rule, null);
			else launchEditor(null, rule);
			return;
		}

		if (action === 'pause') {
			rule.status = 'paused';
			rule.pausedOn = AS_OF;
			announce({ tone: 'warning', title: 'Rule paused', text: `${rule.name} no longer changes any price.` });
		} else {
			activate(rule);
			const outcome = rule.status === 'scheduled' ? ` starts on ${readable(rule.start)}.` : ' is live now.';
			announce({
				tone: 'success',
				title: action === 'publish' ? 'Rule published' : 'Rule resumed',
				text: `${rule.name}${outcome}`,
			});
		}
		repaintAll();
	}

	/* The create/edit dialog. */

	function field(key) {
		return pick(`[data-acl-f="${key}"]`, editor);
	}

	function chosenKind() {
		return pick('input[name="pmKind"]:checked', editor).value;
	}

	function choose(select, value) {
		if (select.multiple) {
			for (const option of pickAll('option', select)) option.selected = value.includes(option.value);
		} else {
			select.value = value;
		}
		window.Basalt.select?.refresh(select);
	}

	function draftCoverage() {
		const scope = field('scope').value;
		const skus =
			scope === 'pick'
				? pickAll('option', field('pick'))
						.filter((option) => option.selected)
						.map((option) => option.value)
				: [];
		return { scope, skus };
	}

	/** Builds a rule object from whatever the form holds right now. */
	function ruleFromForm() {
		const { scope, skus } = draftCoverage();
		const audience = field('who').value;
		const draft = {
			name: field('name').value.trim(),
			kind: chosenKind(),
			who: audience === 'account' ? `account:${field('account').value}` : audience,
			scope,
			skus,
			start: field('start').value,
			end: field('end').value || undefined,
		};

		if (draft.kind === 'percent' || draft.kind === 'amount') draft.value = parseFloat(field(draft.kind).value);
		if (draft.kind === 'tiers') {
			draft.tiers = pickAll('.acl-tier', editor)
				.map((row) => [
					parseInt(pick('[data-tier="qty"]', row).value, 10),
					parseFloat(pick('[data-tier="pct"]', row).value),
				])
				.filter(([from, share]) => from >= 2 && share >= 1 && share <= 90)
				.sort((first, second) => first[0] - second[0]);
		}
		if (draft.kind === 'fixed') {
			draft.prices = {};
			for (const input of pickAll('[data-fixed-sku]', editor)) {
				const typed = parseFloat(input.value);
				if (typed > 0) draft.prices[input.getAttribute('data-fixed-sku')] = typed;
			}
		}
		return draft;
	}

	function paintTiers(steps) {
		const rows = (steps || []).slice(0, 3);
		while (rows.length < 3) rows.push(['', '']);
		field('tiers').innerHTML = rows
			.map(
				([from, share], index) =>
					`<div class="acl-tier"><span>From</span><input type="number" class="form-control" min="2" step="1" inputmode="numeric" value="${from}" aria-label="Step ${index + 1}, from how many units" data-tier="qty"><span>units,</span><div class="input-group acl-tier-pct"><input type="number" class="form-control" min="1" max="90" step="0.5" inputmode="decimal" value="${share}" aria-label="Step ${index + 1}, percent off" data-tier="pct"><span class="input-group-text">% off</span></div></div>`,
			)
			.join('');
	}

	/** One price box per covered product; values already typed are carried
      over when the product choice changes. */
	function paintFixedPrices(seed) {
		const typed = seed || {};
		for (const input of pickAll('[data-fixed-sku]', editor)) {
			if (input.value) typed[input.getAttribute('data-fixed-sku')] = input.value;
		}

		const skus = coveredSkus({ ...draftCoverage(), kind: 'percent' });
		const boxes = skus.map((sku) => {
			const item = product(sku);
			return `<div class="acl-fixed-row"><label for="acl-fx-${sku}">${escapeText(item.name)}<span class="acl-fixed-list">List ${dollars(item.price)}${item.unit ? ` per ${item.unit}` : ''}</span></label><div class="input-group"><span class="input-group-text">$</span><input type="number" class="form-control" id="acl-fx-${sku}" min="0" step="0.01" inputmode="decimal" value="${typed[sku] || ''}" data-fixed-sku="${sku}"></div></div>`;
		});
		field('fixed').innerHTML = boxes.join('') || '<p class="acl-hint mt-0">Choose some products first.</p>';
	}

	function matchKind() {
		const kind = chosenKind();
		for (const block of pickAll('[data-acl-kind]', editor))
			block.hidden = block.getAttribute('data-acl-kind') !== kind;
		if (kind === 'fixed') paintFixedPrices();
	}

	function matchAudience() {
		field('account-wrap').hidden = field('who').value !== 'account';
	}

	function matchCoverage() {
		field('pick-wrap').hidden = field('scope').value !== 'pick';
		if (chosenKind() === 'fixed') paintFixedPrices();
	}

	function onEditorChange({ target }) {
		if (target.name === 'pmKind') matchKind();
		if (target === field('who')) matchAudience();
		if (target === field('scope') || target === field('pick')) matchCoverage();
		paintPreview();
	}

	function previewReady(draft) {
		if (draft.kind === 'tiers') return draft.tiers.length > 0;
		if (draft.kind === 'fixed') return Object.keys(draft.prices).length > 0;
		return draft.value > 0 && coveredSkus(draft).length > 0;
	}

	function paintPreview() {
		const draft = ruleFromForm();
		pick('[data-acl-preview]', editor).innerHTML = previewReady(draft)
			? samplePrices(draft, 3)
			: '<li class="acl-prices-more">Fill in the discount to see prices.</li>';
		pick('[data-acl-preview-note]', editor).textContent = ruleInEditor
			? `Stays at priority ${position(ruleInEditor)} of ${ladder.length}.`
			: `Goes in at priority ${ladder.length + 1}, at the bottom of the list.`;
	}

	function clearFlags() {
		for (const node of pickAll('.is-invalid', editor)) node.classList.remove('is-invalid');
		for (const node of pickAll('.invalid-feedback.d-block', editor)) node.classList.remove('d-block');
	}

	/** Opens the dialog to edit a rule, copy one, or (both null) start fresh. */
	function launchEditor(rule, template) {
		/* Older toasts would cover the dialog's buttons. */
		window.Basalt.toasts?.clear();
		ruleInEditor = rule;
		const source = rule || template;
		const kind = source ? source.kind : 'percent';
		const who = source ? source.who : 'everyone';
		const forAccount = who.startsWith('account:');
		const unpublished = !rule || rule.status === 'draft';

		clearFlags();
		field('title').textContent = rule ? 'Edit price rule' : 'New price rule';
		field('sub').textContent = rule
			? `${rule.id} · priority ${position(rule)}`
			: 'It goes to the bottom of the list. Drag it up if it should win.';
		field('name').value = source ? source.name : '';
		for (const option of pickAll('input[name="pmKind"]', editor)) option.checked = option.value === kind;

		field('percent').value = source?.kind === 'percent' ? source.value : 10;
		field('amount').value = source?.kind === 'amount' ? source.value : 5;
		paintTiers(
			source?.kind === 'tiers'
				? source.tiers
				: [
						[10, 5],
						[25, 8],
						['', ''],
					],
		);
		choose(field('who'), forAccount ? 'account' : who);
		choose(field('account'), forAccount ? who.slice(8) : BUYERS[0].name);
		choose(field('scope'), source ? source.scope : 'all');
		choose(field('pick'), source ? coveredSkus(source) : []);
		field('fixed').innerHTML = '';
		field('start').value = rule ? rule.start || '' : AS_OF;
		field('end').value = rule?.end ? rule.end : '';

		pick('[data-acl-save="draft"]', editor).hidden = !unpublished;
		pick('[data-acl-save="publish"]', editor).innerHTML = unpublished
			? '<i class="bi bi-send me-1" aria-hidden="true"></i>Publish rule'
			: '<i class="bi bi-check2 me-1" aria-hidden="true"></i>Save changes';

		matchAudience();
		matchCoverage();
		matchKind();
		if (kind === 'fixed') paintFixedPrices({ ...source.prices });
		paintPreview();
		dialog.show();
	}

	/** Marks every bad field, focuses the first one and reports success. */
	function validDraft(draft, publishing) {
		clearFlags();
		const problems = [];
		const mark = (node, messageId) => {
			node.classList.add('is-invalid');
			if (messageId) pick(`#${messageId}`, editor).classList.add('d-block');
			problems.push(node);
		};
		const firstPriceBox = pick('[data-fixed-sku]', editor);

		if (!draft.name) mark(field('name'));
		if (draft.kind === 'percent' && !(draft.value >= 1 && draft.value <= 90)) mark(field('percent'));
		if (draft.kind === 'amount' && !(draft.value > 0)) mark(field('amount'));
		if (draft.kind === 'tiers' && !draft.tiers.length) mark(pick('[data-tier="qty"]', editor), 'acl-f-tiers-error');
		if (draft.scope === 'pick' && !draft.skus.length) mark(field('pick'), 'acl-f-pick-error');
		if (draft.kind === 'fixed' && !Object.keys(draft.prices).length && firstPriceBox)
			mark(firstPriceBox, 'acl-f-fixed-error');
		if (publishing && !draft.start) mark(field('start'));
		if (draft.start && draft.end && draft.end < draft.start) mark(field('end'));

		problems[0]?.focus();
		return problems.length === 0;
	}

	function freshId() {
		const highest = Math.max(1000, ...ladder.map(({ id }) => Number(id.replace(/\D/g, ''))));
		return `#${highest + 7}`;
	}

	function saveRule(event) {
		event.preventDefault();
		const publishing = !event.submitter || event.submitter.getAttribute('data-acl-save') === 'publish';
		const draft = ruleFromForm();
		if (!validDraft(draft, publishing)) return;
		if (draft.scope !== 'pick') delete draft.skus;
		if (draft.kind === 'fixed') draft.scope = 'pick';

		const creating = !ruleInEditor;
		let saved = ruleInEditor;
		if (creating) {
			saved = { id: freshId(), status: 'draft', used: { orders: 0, off: 0 }, ...draft };
			if (publishing) activate(saved);
			ladder.push(saved);
		} else {
			for (const key of ['value', 'tiers', 'prices', 'skus', 'end']) delete saved[key];
			Object.assign(saved, draft);
			const wasDraft = saved.status === 'draft';
			if (wasDraft ? publishing : saved.status !== 'paused') activate(saved);
		}

		dialog.hide();
		shownRuleId = saved.id;
		repaintAll();

		let title = 'Changes saved';
		if (creating) title = publishing ? 'Rule published' : 'Draft saved';
		announce({
			tone: 'success',
			title,
			text: creating
				? `${saved.name} is number ${position(saved)} on the list. Drag it up if it should win.`
				: `${saved.name} is up to date.`,
		});
		dialogNode.addEventListener('hidden.bs.modal', () => showRule(saved.id), { once: true });
	}

	/* The price checker: what one customer pays for one product. */

	function ruleLink({ rule }) {
		return `<button type="button" class="acl-linkbtn" data-acl-goto="${rule.id}"><span class="acl-chip">${position(rule)}</span>${escapeText(rule.name)}</button>`;
	}

	function paintCheck() {
		const buyer = BUYERS.find(({ name }) => name === checker.buyer.value);
		const item = product(checker.product.value);
		const quantity = Math.max(1, parseInt(checker.quantity.value, 10) || 1);
		const candidates = ladder
			.filter((rule) => liveToday(rule) && appliesTo(rule, buyer))
			.map((rule) => ({ rule, price: priceUnder(rule, item.sku, quantity) }))
			.filter(({ price }) => price !== null);
		const [winner, ...runnersUp] = candidates;
		const paid = winner ? winner.price : item.price;

		checker.output.innerHTML = `<div class="acl-result-grid"><div>${priceSide(buyer, item, paid, quantity)}</div><div class="acl-result-why">${reasonSide(winner, runnersUp, paid)}</div></div>`;
		checker.plan.textContent = `${buyer.plan} tier, customer since ${buyer.since.slice(0, 4)}`;
	}

	/** Left half of the result: the price and how it compares to list. */
	function priceSide(buyer, item, paid, quantity) {
		const per = item.unit ? `Per ${item.unit}` : 'Each';
		const headline = `<p class="acl-result-label">${escapeText(buyer.name)} pays</p><p class="acl-result-price">${dollars(paid)}</p>`;
		if (paid >= item.price) {
			return `${headline}<p class="acl-result-was">${per}, ${paid === item.price ? 'the list price' : `list price ${dollars(item.price)}`}</p>`;
		}
		const saving = toCent(item.price - paid);
		const savingText = quantity > 1 ? `${dollars(toCent(saving * quantity))} on ${quantity}` : dollars(saving);
		return `${headline}<p class="acl-result-was">${per}, down from <s>${dollars(item.price)}</s></p><p class="acl-result-save"><i class="bi bi-arrow-down-right" aria-hidden="true"></i>Saves ${savingText}</p>`;
	}

	/** Right half: the deciding rule, the ones it outranks, and a hint
      when an outranked rule would have been cheaper. */
	function reasonSide(winner, runnersUp, paid) {
		const decided = winner
			? `<p class="acl-result-rule">${ruleLink(winner)}</p>`
			: '<p class="acl-result-none">No live rule fits this customer and product.</p>';
		let reason = `<p class="acl-result-eyebrow">Set by</p>${decided}`;
		if (!runnersUp.length) return reason;

		const others = runnersUp
			.map((entry) => `<li>${ruleLink(entry)}<span class="acl-also-price">${dollars(entry.price)}</span></li>`)
			.join('');
		reason += `<h3 class="acl-result-sub">Also fits, lower on the list</h3><ul class="acl-also">${others}</ul>`;
		const cheaper = runnersUp.find(({ price }) => price < paid);
		if (cheaper) {
			reason += `<p class="acl-result-hint"><i class="bi bi-lightbulb" aria-hidden="true"></i><span>Rule ${position(cheaper.rule)} gives a lower price. Move it above rule ${position(winner.rule)} if it should win.</span></p>`;
		}
		return reason;
	}

	start();
})();
