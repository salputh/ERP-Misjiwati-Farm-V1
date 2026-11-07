/**
 * Delivery setup for the Marlo shop, used by shipping.html. It paints
 * the region tabs, the rate table of whichever region is open, a checkout
 * preview that prices a sample basket, and the carrier accounts, and it
 * runs the two drawers that add or change a delivery method or a region.
 */
(() => {
	'use strict';

	const page = pick('[data-sh-root]');
	if (!page) return;

	/* Sample records; a real store would fetch them from its API. The clock
     is frozen on a Thursday morning ahead of the 1 pm packing cut-off kept
     in Settings, which means every order in the preview leaves today.
     Methods that show up on store orders (UPS Ground, FedEx 2Day, DHL
     Express Domestic and others) are priced as in the Orders book.
     firstKg prices the opening kilogram and eachKg every one after it;
     fastest and slowest count working days on the road; september holds
     last month's parcel count. */
	const CLOCK = new Date(2026, 9, 8);
	const PACKING_CUTOFF = '1 pm';

	const STATE_NAMES = {
		AL: 'Alabama',
		AK: 'Alaska',
		AZ: 'Arizona',
		AR: 'Arkansas',
		CA: 'California',
		CO: 'Colorado',
		CT: 'Connecticut',
		DE: 'Delaware',
		DC: 'District of Columbia',
		FL: 'Florida',
		GA: 'Georgia',
		HI: 'Hawaii',
		ID: 'Idaho',
		IL: 'Illinois',
		IN: 'Indiana',
		IA: 'Iowa',
		KS: 'Kansas',
		KY: 'Kentucky',
		LA: 'Louisiana',
		ME: 'Maine',
		MD: 'Maryland',
		MA: 'Massachusetts',
		MI: 'Michigan',
		MN: 'Minnesota',
		MS: 'Mississippi',
		MO: 'Missouri',
		MT: 'Montana',
		NE: 'Nebraska',
		NV: 'Nevada',
		NH: 'New Hampshire',
		NJ: 'New Jersey',
		NM: 'New Mexico',
		NY: 'New York',
		NC: 'North Carolina',
		ND: 'North Dakota',
		OH: 'Ohio',
		OK: 'Oklahoma',
		OR: 'Oregon',
		PA: 'Pennsylvania',
		RI: 'Rhode Island',
		SC: 'South Carolina',
		SD: 'South Dakota',
		TN: 'Tennessee',
		TX: 'Texas',
		UT: 'Utah',
		VT: 'Vermont',
		VA: 'Virginia',
		WA: 'Washington',
		WV: 'West Virginia',
		WI: 'Wisconsin',
		WY: 'Wyoming',
	};

	const AREAS = [
		{
			id: 'west',
			title: 'West',
			glyph: 'bi-sun',
			hue: 1,
			hub: 'Elko DC',
			members: ['CA', 'NV', 'AZ', 'UT', 'CO', 'NM', 'WY', 'MT', 'HI'],
		},
		{
			id: 'northeast',
			title: 'Northeast',
			glyph: 'bi-buildings',
			hue: 2,
			hub: 'Ann Arbor DC',
			members: ['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA'],
		},
		{
			id: 'midwest',
			title: 'Midwest',
			glyph: 'bi-signpost-split',
			hue: 3,
			hub: 'Ann Arbor DC',
			members: ['OH', 'IN', 'IL', 'MI', 'WI', 'MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS'],
		},
		{
			id: 'northwest',
			title: 'Pacific Northwest',
			glyph: 'bi-tree',
			hue: 4,
			hub: 'Bellingham DC',
			members: ['WA', 'OR', 'ID', 'AK'],
		},
		{
			id: 'south',
			title: 'South',
			glyph: 'bi-flower1',
			hue: 5,
			hub: 'Ann Arbor DC',
			members: [
				'DE',
				'MD',
				'DC',
				'VA',
				'WV',
				'NC',
				'SC',
				'GA',
				'FL',
				'KY',
				'TN',
				'AL',
				'MS',
				'AR',
				'LA',
				'OK',
				'TX',
			],
		},
	];

	/* Series colors handed to regions created on the page. Number six is
     skipped because a few palettes make it a red that looks like a fault. */
	const ADDED_REGION_HUES = [7, 8, 1, 2, 3, 4, 5];

	const COURIERS = [
		{ title: 'UPS', initials: 'Up', hue: 1, account: 'Account ending 4471, live rates' },
		{ title: 'FedEx', initials: 'Fe', hue: 2, account: 'Account ending 0928, live rates' },
		{ title: 'DHL Express', initials: 'Dh', hue: 5, account: 'Account ending 3156, live rates' },
		{ title: 'USPS', initials: 'Us', hue: 6, account: 'Click-N-Ship business account' },
		{ title: 'Own drivers', glyph: 'bi-truck', hue: 4, account: 'Marlo delivery vans in Elko and Ann Arbor' },
	];

	const SERVICES = [
		{
			id: 'm1',
			region: 'west',
			title: 'UPS Ground',
			carrier: 'UPS',
			fastest: 3,
			slowest: 5,
			firstKg: 12.0,
			eachKg: 1.1,
			freeFrom: 500,
			phase: 'live',
			september: 268,
		},
		{
			id: 'm2',
			region: 'west',
			title: 'FedEx 2Day',
			carrier: 'FedEx',
			fastest: 2,
			slowest: 2,
			firstKg: 24.5,
			eachKg: 2.4,
			freeFrom: null,
			phase: 'live',
			september: 54,
		},
		{
			id: 'm3',
			region: 'west',
			title: 'UPS Next Day Air',
			carrier: 'UPS',
			fastest: 1,
			slowest: 1,
			firstKg: 41.5,
			eachKg: 4.75,
			freeFrom: null,
			phase: 'live',
			september: 19,
		},
		{
			id: 'm4',
			region: 'west',
			title: 'Local courier, Elko',
			carrier: 'Own drivers',
			fastest: 0,
			slowest: 0,
			firstKg: 12.0,
			eachKg: 0,
			freeFrom: 150,
			phase: 'paused',
			september: 23,
			remark: 'Paused on Oct 2 while one of the two vans is in for repair.',
		},
		{
			id: 'm5',
			region: 'northeast',
			title: 'DHL Express Domestic',
			carrier: 'DHL Express',
			fastest: 1,
			slowest: 2,
			firstKg: 9.5,
			eachKg: 1.2,
			freeFrom: 400,
			phase: 'live',
			september: 61,
		},
		{
			id: 'm6',
			region: 'northeast',
			title: 'USPS Ground Advantage',
			carrier: 'USPS',
			fastest: 2,
			slowest: 3,
			firstKg: 7.8,
			eachKg: 0.95,
			freeFrom: 300,
			phase: 'live',
			september: 44,
		},
		{
			id: 'm7',
			region: 'northeast',
			title: 'DHL Express 9:00',
			carrier: 'DHL Express',
			fastest: 1,
			slowest: 1,
			firstKg: 22.0,
			eachKg: 2.4,
			freeFrom: null,
			phase: 'live',
			september: 12,
		},
		{
			id: 'm8',
			region: 'midwest',
			title: 'DHL Express 12:00',
			carrier: 'DHL Express',
			fastest: 2,
			slowest: 4,
			firstKg: 15.6,
			eachKg: 3.1,
			freeFrom: 400,
			phase: 'live',
			september: 78,
		},
		{
			id: 'm9',
			region: 'midwest',
			title: 'UPS 3 Day Select',
			carrier: 'UPS',
			fastest: 3,
			slowest: 6,
			firstKg: 13.2,
			eachKg: 2.55,
			freeFrom: 400,
			phase: 'live',
			september: 41,
		},
		{
			id: 'm10',
			region: 'midwest',
			title: 'DHL pallet freight',
			carrier: 'DHL Express',
			fastest: 3,
			slowest: 5,
			firstKg: 71.0,
			eachKg: 0.8,
			freeFrom: 1500,
			phase: 'live',
			september: 6,
		},
		{
			id: 'm11',
			region: 'midwest',
			title: 'Local courier, Ann Arbor',
			carrier: 'Own drivers',
			fastest: 1,
			slowest: 2,
			firstKg: 21.0,
			eachKg: 0,
			freeFrom: null,
			phase: 'draft',
			september: 0,
			remark: 'Waiting for the second van, due in November.',
		},
		{
			id: 'm12',
			region: 'northwest',
			title: 'USPS Priority Mail Express',
			carrier: 'USPS',
			fastest: 1,
			slowest: 2,
			firstKg: 14.9,
			eachKg: 2.2,
			freeFrom: 400,
			phase: 'live',
			september: 52,
		},
		{
			id: 'm13',
			region: 'northwest',
			title: 'USPS Priority Mail',
			carrier: 'USPS',
			fastest: 1,
			slowest: 3,
			firstKg: 9.6,
			eachKg: 1.8,
			freeFrom: 250,
			phase: 'live',
			september: 31,
		},
		{
			id: 'm14',
			region: 'northwest',
			title: 'DHL Express Easy',
			carrier: 'DHL Express',
			fastest: 2,
			slowest: 3,
			firstKg: 26.4,
			eachKg: 4.6,
			freeFrom: 600,
			phase: 'live',
			september: 14,
		},
		{
			id: 'm15',
			region: 'south',
			title: 'DHL Express Easy',
			carrier: 'DHL Express',
			fastest: 2,
			slowest: 4,
			firstKg: 31.2,
			eachKg: 5.4,
			freeFrom: 800,
			phase: 'live',
			september: 22,
		},
		{
			id: 'm16',
			region: 'south',
			title: 'FedEx Ground',
			carrier: 'FedEx',
			fastest: 3,
			slowest: 5,
			firstKg: 20.8,
			eachKg: 4.2,
			freeFrom: 800,
			phase: 'live',
			september: 17,
		},
		{
			id: 'm17',
			region: 'south',
			title: 'FedEx Priority Overnight',
			carrier: 'FedEx',
			fastest: 1,
			slowest: 1,
			firstKg: 38.9,
			eachKg: 3.75,
			freeFrom: null,
			phase: 'draft',
			september: 0,
			remark: 'Rates agreed; goes live once the new label printer is set up.',
		},
	];

	const PHASES = {
		live: { label: 'Live', tone: 'success', hint: 'Offered at checkout.' },
		paused: { label: 'Paused', tone: 'warning', hint: 'Hidden at checkout until you set it live again.' },
		draft: { label: 'Draft', tone: '', hint: 'Not offered yet. Only your team sees it.' },
	};

	const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/* Arrow keys wrap around the tab row; Home and End jump to its ends. */
	const TAB_KEYS = {
		ArrowRight: (at, size) => (at + 1) % size,
		ArrowLeft: (at, size) => (at - 1 + size) % size,
		Home: () => 0,
		End: (at, size) => size - 1,
	};

	/* Which rate-form problem points focus at which field, in form order. */
	const RATE_PROBLEM_FIELDS = [
		['name', 'name'],
		['days', 'min'],
		['base', 'base'],
		['perKg', 'perKg'],
		['freeOver', 'freeOver'],
	];

	const view = { region: 'west', basketTotal: 450, parcelKg: 1 };

	const ui = {
		tabShell: pick('[data-sh-zones-wrap]'),
		tabRow: pick('[data-sh-zones]'),
		rateRows: pick('[data-sh-methods]'),
		basketSlider: pick('[data-sh-basket]'),
		basketReadout: pick('[data-sh-basket-out]'),
		rateDrawer: pick('#sh-method'),
		rateForm: pick('[data-sh-m-form]'),
		carrierPicker: pick('[data-sh-m-carrier]'),
		freeToggle: pick('[data-sh-m-free-on]'),
		freeBlock: pick('[data-sh-m-free-wrap]'),
		deleteRate: pick('[data-sh-m-remove]'),
		regionDrawer: pick('#sh-zone'),
		regionForm: pick('[data-sh-z-form]'),
		statePicker: pick('[data-sh-z-states]'),
		hubPicker: pick('[data-sh-z-from]'),
	};

	let rateInDrawer = null;
	let rateSubmitted = false;
	let regionInDrawer = null;
	let regionSubmitted = false;

	/* Each drawer remembers who opened it and, after a save, a function that
     names the element focus should land on once it has slid away. */
	const openerOf = new WeakMap();
	const focusAfterClose = new WeakMap();

	start();

	function start() {
		ui.carrierPicker.innerHTML = COURIERS.map(
			(account) => `<option value="${htmlSafe(account.title)}">${htmlSafe(account.title)}</option>`,
		).join('');

		ui.tabRow.addEventListener('click', onTabClick);
		ui.tabRow.addEventListener('keydown', onTabKey);
		ui.tabRow.addEventListener('scroll', updateScrollShade, { passive: true });
		window.addEventListener('resize', updateScrollShade);

		ui.rateRows.addEventListener('click', onRateRowClick);
		page.addEventListener('click', onPageAction);

		ui.basketSlider.addEventListener('input', () => {
			view.basketTotal = +ui.basketSlider.value;
			paintCheckout();
		});
		for (const radio of pickAll('input[name="shWeight"]')) {
			radio.addEventListener('change', () => {
				view.parcelKg = +radio.value;
				paintCheckout();
			});
		}

		wireRateDrawer();
		wireRegionDrawer();
		repaint();
	}

	function repaint() {
		paintRegionTabs();
		paintRates();
		paintCheckout();
		paintAccounts();
	}

	/* The region tabs across the top, one per delivery region. */

	function paintRegionTabs() {
		const allParcels = parcelTotal(SERVICES);
		ui.tabRow.innerHTML = AREAS.map((region) => regionTab(region, allParcels)).join('');
		updateScrollShade();
		/* The bars grow in once, on the first paint; later repaints keep them still. */
		window.setTimeout(() => ui.tabRow.setAttribute('data-sh-grown', ''), 1400);
	}

	function regionTab(region, allParcels) {
		const current = region.id === view.region;
		const sent = parcelTotal(ratesIn(region.id));
		const percent = allParcels ? Math.round((sent / allParcels) * 100) : 0;
		return [
			`<button type="button" id="sh-zone-${region.id}" class="sh-zone" role="tab" aria-selected="${current}" aria-controls="sh-rates" tabindex="${current ? 0 : -1}" data-sh-zone="${region.id}" style="--sh-tone:${seriesColor(region.hue)}">`,
			`<span class="sh-zone-icon" aria-hidden="true"><i class="bi ${region.glyph}"></i></span>`,
			`<span class="sh-zone-name">${htmlSafe(region.title)}</span>`,
			`<span class="sh-zone-where">${htmlSafe(memberNames(region))}</span>`,
			'<span class="sh-zone-figure">',
			`<span class="sh-zone-value">${withCommas(sent)}</span><span class="sh-zone-label">parcels in Sep</span>`,
			`<span class="sh-zone-pct">${percent}%<span class="visually-hidden"> of all parcels</span></span>`,
			'</span>',
			`<span class="sh-zone-bar" aria-hidden="true"><span style="width:${percent}%; --sh-at:${AREAS.indexOf(region)}"></span></span>`,
			'</button>',
		].join('');
	}

	/* Fades either edge of the tab row while more tabs hide past it. */
	function updateScrollShade() {
		const scroller = ui.tabRow;
		const furthest = scroller.scrollWidth - scroller.clientWidth;
		ui.tabShell.classList.toggle('is-more-start', scroller.scrollLeft > 2);
		ui.tabShell.classList.toggle('is-more-end', scroller.scrollLeft < furthest - 2);
	}

	function selectRegion(id, moveFocus) {
		view.region = id;
		paintRegionTabs();
		paintRates();
		paintCheckout();
		const tab = pick(`#sh-zone-${id}`);
		tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
		if (moveFocus) tab.focus();
	}

	function onTabClick(event) {
		const tab = event.target.closest('[data-sh-zone]');
		if (tab) selectRegion(tab.getAttribute('data-sh-zone'), true);
	}

	function onTabKey(event) {
		if (!Object.hasOwn(TAB_KEYS, event.key)) return;
		event.preventDefault();
		const position = AREAS.findIndex((region) => region.id === view.region);
		const target = TAB_KEYS[event.key](position, AREAS.length);
		selectRegion(AREAS[target].id, true);
	}

	/* The open region's methods, one table row each. */

	function paintRates() {
		const region = regionById(view.region);
		const rates = ratesIn(region.id);
		const liveCount = rates.filter((rate) => rate.phase === 'live').length;
		const tally = rates.length ? `${liveCount} of ${counted(rates.length, 'method is', 'methods are')} live.` : '';
		pick('[data-sh-zone-title]').textContent = region.title;
		pick('[data-sh-zone-desc]').textContent = `Ships from ${region.hub} to ${memberNames(region, true)}. ${tally}`;

		ui.rateRows.innerHTML = rates.length ? rates.map(rateRow).join('') : emptyRegionRow(region);
	}

	function rateRow(rate) {
		const perKgNote = rate.eachKg ? `+ ${dollars(rate.eachKg)} per kg` : 'Flat rate';
		const freeCell = rate.freeFrom
			? `<p class="sh-money">${roundDollars(rate.freeFrom)}</p>`
			: '<p class="sh-line sh-line-plain sh-none"><span aria-hidden="true">—</span><span class="visually-hidden">Never free</span></p>';
		return [
			`<tr data-sh-id="${rate.id}">`,
			`<td class="sh-cell-method"><p class="sh-line">${htmlSafe(rate.title)}</p><p class="sh-sub">${htmlSafe(rate.carrier)}</p></td>`,
			`<td class="sh-cell-days"><span class="sh-cell-label">Delivery</span><p class="sh-line sh-line-plain">${transitText(rate)}</p></td>`,
			`<td class="sh-cell-price sh-num"><span class="sh-cell-label">Price</span><p class="sh-money">${dollars(rate.firstKg)}</p><p class="sh-sub">${perKgNote}</p></td>`,
			`<td class="sh-cell-free sh-num"><span class="sh-cell-label">Free over</span>${freeCell}</td>`,
			`<td class="sh-cell-status">${phaseBadge(rate.phase)}</td>`,
			`<td class="sh-cell-go sh-num"><button type="button" class="sh-edit" data-sh-edit="${rate.id}" aria-label="Edit ${htmlSafe(rate.title)}"><i class="bi bi-pencil" aria-hidden="true"></i></button></td>`,
			'</tr>',
		].join('');
	}

	function emptyRegionRow(region) {
		return (
			'<tr class="basalt-empty-row"><td colspan="6"><div class="basalt-empty basalt-empty-compact">' +
			'<span class="basalt-empty-badge" aria-hidden="true"><i class="bi bi-truck"></i></span>' +
			'<h3 class="basalt-empty-title">No methods yet</h3>' +
			`<p class="basalt-empty-text">Customers in ${htmlSafe(region.title)} can't check out until there is at least one live method.</p>` +
			'<div class="basalt-empty-actions"><button type="button" class="btn btn-sm btn-primary" data-sh-method-new><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add method</button></div>' +
			'</div></td></tr>'
		);
	}

	function onRateRowClick(event) {
		const row = event.target.closest('[data-sh-id]');
		if (row) openRateDrawer(row.getAttribute('data-sh-id'), pick('[data-sh-edit]', row));
	}

	/* The add and edit buttons live in several places on the page, so one
     listener on the page root answers all of them. */
	function onPageAction(event) {
		const addRate = event.target.closest('[data-sh-method-new]');
		if (addRate) openRateDrawer(null, addRate);
		const editRegion = event.target.closest('[data-sh-zone-edit]');
		if (editRegion) openRegionDrawer(view.region, editRegion);
		const addRegion = event.target.closest('[data-sh-zone-new]');
		if (addRegion) openRegionDrawer(null, addRegion);
	}

	/* What a shopper in the open region would be offered at checkout. */

	function paintCheckout() {
		const region = regionById(view.region);
		const everyRate = ratesIn(region.id);
		const offered = everyRate.filter((rate) => rate.phase === 'live');
		const quotes = offered
			.map((rate) => ({ rate, cost: quote(rate, view.basketTotal, view.parcelKg) }))
			.sort((a, b) => a.cost - b.cost || a.rate.slowest - b.rate.slowest);

		pick('[data-sh-try-desc]').textContent = `What a customer in ${region.title} is offered for this basket.`;
		ui.basketReadout.textContent = roundDollars(view.basketTotal);
		pick('[data-sh-offers]').innerHTML = quotes.length
			? quotes.map((entry, index) => offerLine(entry.rate, entry.cost, index === 0)).join('')
			: '<li class="sh-offer-none">No delivery options yet, so customers here can\'t check out.</li>';

		const nudge = pick('[data-sh-nudge]');
		const hint = freeShippingHint(offered, quotes);
		if (hint) nudge.innerHTML = hint;
		else nudge.textContent = '';

		const leftOut = everyRate.length - offered.length;
		const leftOutNote = leftOut
			? ` ${leftOut === 1 ? 'One paused or draft method is' : `${leftOut} paused or draft methods are`} left out.`
			: '';
		pick('[data-sh-try-foot]').innerHTML =
			`Dates assume the order ships today, before the ${PACKING_CUTOFF} cut-off set in <a href="settings.html">Settings</a>.${leftOutNote}`;
	}

	/** How close the basket is to free delivery, or which method is free on it already. */
	function freeShippingHint(offered, quotes) {
		const nearest = offered
			.filter((rate) => rate.freeFrom && rate.freeFrom > view.basketTotal)
			.reduce((best, rate) => (!best || rate.freeFrom < best.freeFrom ? rate : best), null);
		if (nearest) {
			return `<i class="bi bi-gift" aria-hidden="true"></i>Add ${roundDollars(nearest.freeFrom - view.basketTotal)} more and ${htmlSafe(nearest.title)} is free.`;
		}
		const freebies = quotes.filter((entry) => entry.cost === 0);
		if (!freebies.length) return '';
		const sentence =
			freebies.length === 1
				? `${htmlSafe(freebies[0].rate.title)} is free on this basket.`
				: 'Free shipping on this basket.';
		return `<i class="bi bi-check2-circle" aria-hidden="true"></i>${sentence}`;
	}

	function offerLine(rate, cost, cheapest) {
		const account = accountByTitle(rate.carrier);
		const priceTag = cost === 0 ? 'Free' : dollars(cost);
		return (
			`<li class="sh-offer-item${cheapest ? ' is-first' : ''}">` +
			`<span class="sh-offer-mark" aria-hidden="true" style="--sh-tone:${seriesColor(account.hue)}">${accountBadge(account)}</span>` +
			`<span><span class="sh-offer-name">${htmlSafe(rate.title || 'New method')}</span><span class="sh-offer-when">${arrivalText(rate)}</span></span>` +
			`<span class="sh-offer-price${cost === 0 ? ' is-free' : ''}">${priceTag}</span>` +
			'</li>'
		);
	}

	/* Carrier accounts, busiest first, each bar measured against the busiest. */

	function paintAccounts() {
		const usage = COURIERS.map((account) => {
			const theirs = SERVICES.filter((rate) => rate.carrier === account.title);
			return { account, methodCount: theirs.length, sent: parcelTotal(theirs) };
		}).sort((a, b) => b.sent - a.sent);
		const busiest = usage[0].sent || 1;

		pick('[data-sh-carriers-desc]').textContent =
			`The accounts that carried ${withCommas(parcelTotal(SERVICES))} parcels in September.`;
		pick('[data-sh-carriers]').innerHTML = usage
			.map(({ account, methodCount, sent }) =>
				[
					`<li class="sh-carrier" style="--sh-tone:${seriesColor(account.hue)}">`,
					`<span class="sh-carrier-logo" aria-hidden="true">${accountBadge(account)}</span>`,
					'<div><div class="sh-carrier-top">',
					`<p class="sh-carrier-name">${htmlSafe(account.title)}</p>`,
					`<p class="sh-carrier-count"><strong>${withCommas(sent)}</strong> ${sent === 1 ? 'parcel' : 'parcels'}</p>`,
					'</div>',
					`<span class="sh-carrier-bar" aria-hidden="true"><span style="width:${Math.round((sent / busiest) * 100)}%"></span></span>`,
					`<p class="sh-carrier-what">${htmlSafe(account.account)} · ${counted(methodCount, 'method', 'methods')}</p>`,
					'</div></li>',
				].join(''),
			)
			.join('');
	}

	/* The drawer that adds, edits or removes a delivery method. */

	function wireRateDrawer() {
		const { rateDrawer, rateForm, freeToggle, freeBlock } = ui;

		freeToggle.addEventListener('change', () => {
			window.Basalt.slide(freeBlock, () => {
				freeBlock.hidden = !freeToggle.checked;
			});
			if (freeToggle.checked && !rateField('freeOver').value) rateField('freeOver').value = 500;
			if (rateSubmitted) validateRate();
			paintRatePreview();
		});
		rateForm.addEventListener('input', () => {
			if (rateSubmitted) validateRate();
			paintRatePreview();
		});
		rateForm.addEventListener('change', paintRatePreview);
		rateDrawer.addEventListener('shown.bs.offcanvas', () => {
			if (!rateInDrawer) rateField('name').focus();
		});
		rateForm.addEventListener('submit', saveRate);
		ui.deleteRate.addEventListener('click', deleteRate);
		restoreFocusOnClose(rateDrawer);
	}

	function openRateDrawer(id, opener) {
		const region = regionById(view.region);
		rateInDrawer = id ? SERVICES.find((rate) => rate.id === id) : null;
		rateSubmitted = false;
		ui.rateForm.reset();
		for (const marked of pickAll('.is-invalid', ui.rateForm)) markInvalid(marked, false);
		pick('[data-sh-err="days"]').classList.remove('is-shown');

		const sibling = ratesIn(region.id)[0];
		const shown = rateInDrawer || {
			title: '',
			carrier: accountByTitle(sibling ? sibling.carrier : 'UPS').title,
			fastest: 2,
			slowest: 4,
			firstKg: 12,
			eachKg: 1.5,
			freeFrom: null,
			phase: 'live',
		};
		rateField('name').value = shown.title;
		ui.carrierPicker.value = shown.carrier;
		window.Basalt.select?.refresh(ui.carrierPicker);
		rateField('min').value = shown.fastest;
		rateField('max').value = shown.slowest;
		rateField('base').value = shown.firstKg.toFixed(2);
		rateField('perKg').value = shown.eachKg.toFixed(2);
		ui.freeToggle.checked = !!shown.freeFrom;
		rateField('freeOver').value = shown.freeFrom || '';
		ui.freeBlock.hidden = !shown.freeFrom;
		tickRadio(pick(`input[name="status"][value="${shown.phase}"]`, ui.rateForm));

		rateSlot('title').textContent = rateInDrawer ? rateInDrawer.title : 'Add method';
		rateSlot('sub').textContent = rateInDrawer
			? `${rateInDrawer.carrier} · ${region.title}`
			: `New delivery option for ${region.title}`;
		rateSlot('save').textContent = rateInDrawer ? 'Save method' : 'Add method';
		ui.deleteRate.hidden = !rateInDrawer;
		paintRateUsage(region);
		paintRatePreview();
		slideIn(ui.rateDrawer, opener);
	}

	/* A short note on how much last month's traffic the method carried. */
	function paintRateUsage(region) {
		const note = rateSlot('usage');
		note.hidden = !rateInDrawer;
		if (!rateInDrawer) return;
		const regionParcels = parcelTotal(ratesIn(region.id));
		const percent = regionParcels ? Math.round((rateInDrawer.september / regionParcels) * 100) : 0;
		const lead = rateInDrawer.september
			? `<strong>${counted(rateInDrawer.september, 'parcel', 'parcels')}</strong> in September, ${percent}% of ${htmlSafe(region.title)}'s.`
			: 'Not used yet.';
		note.innerHTML = lead + (rateInDrawer.remark ? ` ${htmlSafe(rateInDrawer.remark)}` : '');
	}

	function readRateForm() {
		const numberIn = (fieldName) => parseFloat(rateField(fieldName).value);
		return {
			title: rateField('name').value.trim(),
			carrier: ui.carrierPicker.value,
			fastest: numberIn('min'),
			slowest: numberIn('max'),
			firstKg: numberIn('base'),
			eachKg: numberIn('perKg'),
			freeFrom: ui.freeToggle.checked ? numberIn('freeOver') : null,
			phase: pick('input[name="status"]:checked', ui.rateForm).value,
		};
	}

	/**
	 * Flags every bad field in the method form.
	 * @returns {HTMLElement|null} the first field to fix, or null when all is well
	 */
	function validateRate() {
		const draft = readRateForm();
		const region = regionById(view.region);
		const daysOk =
			Number.isInteger(draft.fastest) &&
			Number.isInteger(draft.slowest) &&
			draft.fastest >= 0 &&
			draft.slowest >= draft.fastest &&
			draft.slowest <= 30;
		const nameTaken = ratesIn(region.id).some(
			(rate) => rate !== rateInDrawer && rate.title.toLowerCase() === draft.title.toLowerCase(),
		);
		pick('[data-sh-err="name"]').textContent = nameTaken
			? `${region.title} already has a method with that name.`
			: 'Give the method a name customers will recognize.';

		const problems = {
			name: !draft.title || nameTaken,
			days: !daysOk,
			base: !(draft.firstKg >= 0),
			perKg: !(draft.eachKg >= 0),
			freeOver: ui.freeToggle.checked && !(draft.freeFrom > 0),
		};
		markInvalid(rateField('name'), problems.name);
		markInvalid(rateField('min'), problems.days);
		markInvalid(rateField('max'), problems.days);
		pick('[data-sh-err="days"]').classList.toggle('is-shown', problems.days);
		markInvalid(rateField('base'), problems.base);
		markInvalid(rateField('perKg'), problems.perKg);
		markInvalid(rateField('freeOver'), problems.freeOver);

		const firstProblem = RATE_PROBLEM_FIELDS.find(([problem]) => problems[problem]);
		return firstProblem ? rateField(firstProblem[1]) : null;
	}

	/* Shows the method as a shopper would meet it, priced for the basket and
     parcel weight picked in the checkout preview. */
	function paintRatePreview() {
		const draft = readRateForm();
		const priceable =
			Number.isFinite(draft.firstKg) &&
			Number.isFinite(draft.fastest) &&
			Number.isFinite(draft.slowest) &&
			draft.slowest >= draft.fastest;
		const sample = {
			...draft,
			eachKg: Number.isFinite(draft.eachKg) ? draft.eachKg : 0,
			freeFrom: Number.isFinite(draft.freeFrom) ? draft.freeFrom : null,
		};
		rateSlot('preview').innerHTML = priceable
			? offerLine(sample, quote(sample, view.basketTotal, view.parcelKg), false)
			: '<li class="sh-offer-none">Fill in the delivery days and price to see it.</li>';
		rateSlot('preview-note').textContent =
			draft.phase === 'live'
				? `For a ${roundDollars(view.basketTotal)} basket and a ${view.parcelKg} kg parcel, as in At checkout.`
				: "Customers won't see it until it is live.";
		rateSlot('stp-help').textContent = PHASES[draft.phase].hint;
	}

	function saveRate(event) {
		event.preventDefault();
		rateSubmitted = true;
		const fixFirst = validateRate();
		if (fixFirst) {
			fixFirst.focus();
			return;
		}
		const values = readRateForm();
		const region = regionById(view.region);
		const created = !rateInDrawer;
		let kept = rateInDrawer;
		if (kept) {
			/* A remark explains the old phase, so it goes once the phase moves. */
			if (values.phase !== kept.phase) delete kept.remark;
			Object.assign(kept, values);
		} else {
			kept = { id: `m${Date.now()}`, region: region.id, september: 0, ...values };
			SERVICES.push(kept);
		}

		slideOut(ui.rateDrawer, () => pick(`[data-sh-id="${kept.id}"] [data-sh-edit]`) || null);
		repaint();
		notify({
			tone: 'success',
			title: `${kept.title}${created ? ' added' : ' saved'}`,
			text:
				kept.phase === 'live'
					? `Customers in ${region.title} see it at checkout now.`
					: `It stays hidden at checkout while it is ${PHASES[kept.phase].label.toLowerCase()}.`,
		});
	}

	function deleteRate() {
		if (!rateInDrawer) return;
		const removed = rateInDrawer;
		const slot = SERVICES.indexOf(removed);
		SERVICES.splice(slot, 1);
		slideOut(ui.rateDrawer, () => pick('[data-sh-method-new]', page));
		repaint();
		notify({
			tone: 'warning',
			title: `${removed.title} removed`,
			text: `Customers in ${regionById(removed.region).title} no longer see it.`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						SERVICES.splice(slot, 0, removed);
						view.region = removed.region;
						repaint();
					},
				},
			],
		});
	}

	function rateField(fieldName) {
		return ui.rateForm.elements[fieldName];
	}

	function rateSlot(slotName) {
		return pick(`[data-sh-m="${slotName}"]`, ui.rateDrawer);
	}

	/* The drawer that adds a region or renames and redraws one. */

	function wireRegionDrawer() {
		const { regionDrawer, regionForm, statePicker } = ui;
		regionDrawer.addEventListener('shown.bs.offcanvas', () => {
			if (!regionInDrawer) regionForm.elements.name.focus();
		});
		regionForm.addEventListener('input', () => {
			if (regionSubmitted) validateRegion();
		});
		statePicker.addEventListener('change', () => {
			if (regionSubmitted) validateRegion();
		});
		regionForm.addEventListener('submit', saveRegion);
		restoreFocusOnClose(regionDrawer);
	}

	function openRegionDrawer(id, opener) {
		const { regionForm } = ui;
		regionInDrawer = id ? regionById(id) : null;
		regionSubmitted = false;
		regionForm.reset();
		markInvalid(regionForm.elements.name, false);
		markInvalid(ui.statePicker, false);
		regionForm.elements.name.value = regionInDrawer ? regionInDrawer.title : '';
		listStates(regionInDrawer);
		ui.hubPicker.value = regionInDrawer ? regionInDrawer.hub : 'Ann Arbor DC';
		window.Basalt.select?.refresh(ui.hubPicker);
		regionSlot('title').textContent = regionInDrawer ? `Edit ${regionInDrawer.title}` : 'Add zone';
		regionSlot('save').textContent = regionInDrawer ? 'Save zone' : 'Add zone';
		slideIn(ui.regionDrawer, opener);
	}

	/* Every state, A to Z. The region's own are preselected; those that
     already belong to another region are grayed out with its name. */
	function listStates(region) {
		const homeOf = {};
		for (const each of AREAS) {
			for (const code of each.members) homeOf[code] = each;
		}
		const alphabetical = Object.keys(STATE_NAMES).sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]));
		ui.statePicker.innerHTML = alphabetical
			.map((code) => {
				const home = homeOf[code];
				const own = region && home === region;
				const elsewhere = home && !own;
				const extraAttrs =
					(own ? ' selected' : '') + (elsewhere ? ` disabled data-hint="In ${htmlSafe(home.title)}"` : '');
				return `<option value="${code}"${extraAttrs}>${htmlSafe(STATE_NAMES[code])}</option>`;
			})
			.join('');
		window.Basalt.select?.refresh(ui.statePicker);
	}

	/** @returns {HTMLElement|null} the control to fix first, or null when the region is valid */
	function validateRegion() {
		const nameInput = ui.regionForm.elements.name;
		const typed = nameInput.value.trim();
		const nameTaken = AREAS.some(
			(region) => region !== regionInDrawer && region.title.toLowerCase() === typed.toLowerCase(),
		);
		pick('[data-sh-err="zname"]').textContent = nameTaken
			? 'There is already a zone with that name.'
			: 'Give the zone a name.';
		const chosen = ui.statePicker.selectedOptions.length;
		markInvalid(nameInput, !typed || nameTaken);
		markInvalid(ui.statePicker, !chosen);
		window.Basalt.select?.refresh(ui.statePicker);
		if (!typed || nameTaken) return nameInput;
		if (!chosen) return pick('.basalt-select-trigger', ui.statePicker.parentNode) || ui.statePicker;
		return null;
	}

	function saveRegion(event) {
		event.preventDefault();
		regionSubmitted = true;
		const fixFirst = validateRegion();
		if (fixFirst) {
			fixFirst.focus();
			return;
		}
		const values = {
			title: ui.regionForm.elements.name.value.trim(),
			members: Array.from(ui.statePicker.selectedOptions, (option) => option.value),
			hub: ui.hubPicker.value,
		};
		const created = !regionInDrawer;
		let region = regionInDrawer;
		if (region) {
			Object.assign(region, values);
		} else {
			region = {
				id: `z${Date.now()}`,
				glyph: 'bi-geo-alt',
				hue: ADDED_REGION_HUES[AREAS.length % ADDED_REGION_HUES.length],
				...values,
			};
			AREAS.push(region);
		}
		view.region = region.id;
		slideOut(ui.regionDrawer, () => pick(`#sh-zone-${region.id}`));
		repaint();
		pick(`#sh-zone-${region.id}`).scrollIntoView({ block: 'nearest', inline: 'nearest' });
		notify({
			tone: 'success',
			title: `${region.title}${created ? ' added' : ' saved'}`,
			text: created
				? 'Add a method so customers there can check out.'
				: `Ships from ${region.hub} to ${memberNames(region, true)}.`,
		});
	}

	function regionSlot(slotName) {
		return pick(`[data-sh-z="${slotName}"]`, ui.regionDrawer);
	}

	/* Opening, closing and focus return, shared by both drawers. */

	function slideIn(drawer, opener) {
		openerOf.set(drawer, opener || null);
		bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
	}

	function slideOut(drawer, pickFocus) {
		if (pickFocus) focusAfterClose.set(drawer, pickFocus);
		bootstrap.Offcanvas.getOrCreateInstance(drawer).hide();
	}

	function restoreFocusOnClose(drawer) {
		drawer.addEventListener('hidden.bs.offcanvas', () => {
			const pickFocus = focusAfterClose.get(drawer);
			focusAfterClose.delete(drawer);
			const destination = pickFocus ? pickFocus() : openerOf.get(drawer);
			if (destination && document.contains(destination)) destination.focus();
		});
	}

	function markInvalid(control, isBad) {
		control.classList.toggle('is-invalid', isBad);
		control.setAttribute('aria-invalid', isBad ? 'true' : 'false');
	}

	/* Checks a radio the way a click would, so its own listeners hear it. */
	function tickRadio(radio) {
		radio.checked = true;
		radio.dispatchEvent(new Event('change', { bubbles: true }));
	}

	/* Lookups into the sample records and the delivery arithmetic. */

	function regionById(id) {
		return AREAS.find((region) => region.id === id);
	}

	function ratesIn(regionId) {
		return SERVICES.filter((rate) => rate.region === regionId);
	}

	function accountByTitle(title) {
		return COURIERS.find((account) => account.title === title) || COURIERS[0];
	}

	function parcelTotal(rates) {
		return rates.reduce((sum, rate) => sum + rate.september, 0);
	}

	/** Price of one parcel, or 0 once the basket clears the free-delivery mark. */
	function quote(rate, basketTotal, kilos) {
		if (rate.freeFrom && basketTotal >= rate.freeFrom) return 0;
		return rate.firstKg + rate.eachKg * Math.max(0, kilos - 1);
	}

	/* Delivery dates count working days, so weekends are stepped over. */
	function workdaysAhead(count) {
		const day = new Date(CLOCK);
		let remaining = count;
		while (remaining > 0) {
			day.setDate(day.getDate() + 1);
			const weekday = day.getDay();
			if (weekday !== 0 && weekday !== 6) remaining--;
		}
		return day;
	}

	/* Turning records into words and small pieces of markup. */

	/** "Same day", "1 day" or "3–5 days". */
	function transitText(rate) {
		if (rate.slowest === 0) return 'Same day';
		if (rate.fastest === rate.slowest) return counted(rate.slowest, 'day', 'days');
		return `${rate.fastest}–${rate.slowest} days`;
	}

	function arrivalText(rate) {
		if (rate.slowest === 0) return 'Arrives today';
		const earliest = workdaysAhead(rate.fastest);
		const latest = workdaysAhead(rate.slowest);
		if (rate.fastest === rate.slowest) return `Arrives ${calendarDay(earliest, true)}`;
		return `Arrives ${calendarDay(earliest, true)} – ${calendarDay(latest, earliest.getMonth() !== latest.getMonth())}`;
	}

	function calendarDay(date, withMonth) {
		const month = withMonth ? `, ${MONTH_NAMES[date.getMonth()]}` : '';
		return `${WEEKDAYS[date.getDay()]}${month} ${date.getDate()}`;
	}

	/**
	 * The states of a region in words: up to three by name, more as a count.
	 * @param {boolean} [inSentence] joins the names with "and"
	 */
	function memberNames(region, inSentence) {
		const codes = region.members;
		if (codes.length > 3) return counted(codes.length, 'state', 'states');
		const labels = codes.map((code) => STATE_NAMES[code]);
		if (!inSentence) return labels.join(', ');
		if (labels.length === 1) return labels[0];
		return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
	}

	function phaseBadge(phase) {
		const { tone, label } = PHASES[phase];
		return `<span class="basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}">${label}</span>`;
	}

	function accountBadge(account) {
		return account.glyph ? `<i class="bi ${account.glyph}" aria-hidden="true"></i>` : htmlSafe(account.initials);
	}

	function seriesColor(hue) {
		return `var(--basalt-series-${((hue - 1) % 8) + 1})`;
	}

	function withCommas(value) {
		return Math.round(value).toLocaleString('en-US');
	}

	function dollars(value) {
		return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function roundDollars(value) {
		return `$${withCommas(value)}`;
	}

	function counted(value, singular, pluralForm) {
		return `${withCommas(value)} ${value === 1 ? singular : pluralForm}`;
	}

	function htmlSafe(text) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(text).replace(/[&<>"']/g, (char) => entities[char]);
	}

	function notify(message) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(message) : null;
	}

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
