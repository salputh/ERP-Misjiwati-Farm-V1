/**
 * Company directory for companies.html. It holds every business on the
 * books in three stages: paying customers, prospects still weighing a
 * deal or a trial, and customers who have gone. A tab narrows the table
 * to one stage. Customer rows lead with plan, health and yearly spend;
 * prospect rows with their deal and what it would bring in. A row, its
 * name and its expand icon all lead to company-details.html?id=<id>,
 * while the panel icon slides in a quick view of people, deals and recent
 * activity that Alt with the arrow keys moves to the neighboring company.
 *
 * Wiring real data: hand the catalog your backend's records in the same
 * shape (every total, chart and count derives from them), then point each
 * method of `server` at an endpoint. Edits show at once and roll back
 * with an error toast when a call fails. For the demo, ?stage=customer,
 * prospect or former picks the opening tab and ?state=empty starts with
 * no companies. Tabs, segmented controls, selects, choice cards, filter
 * chips, avatars, the record drawer, the pager, undo toasts and empty
 * states all come from basalt.js.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-co-root]');
	if (!pageRoot) return;

	/* Records arrive from assets/basalt/js/data/multipurpose/companies.js, which merges the
     accounts, the deals still being won and the customers who left.
     Accounts pay yearly at ten months for twelve, so a year of revenue is
     the plan price times ten per seat plus a year of add-ons; a prospect
     is worth whatever its deal would add each year. */
	const shared = window.Basalt.data;
	const roster = shared.companies;
	const catalog = {
		/* A fixed date keeps the demo steady; a live app reads the clock. */
		asOf: '2026-10-08',
		viewer: 'John Armstrong',
		tiers: [
			['starter', 'Basic', 15, 3],
			['growth', 'Pro', 32, 1],
			['enterprise', 'Max', 58, 2],
		].map(([id, name, price, tone]) => ({ id, name, price, tone })),
		phases: roster.stages,
		sectors: shared.accounts.trades,
		territories: ['Northeast', 'Midwest', 'South', 'West'],
		/* Teammates who can be put in charge of a company. */
		keepers: shared.accounts.owners,
		/* What each deal stage id reads as on screen. */
		dealNames: {
			lost: 'Lost',
			signed: 'Signed',
			signature: 'Out for signature',
			negotiation: 'Negotiation',
			proposal: 'Proposal',
			discovery: 'Discovery',
		},
		/* Each record carries people { name, title, role, email, key }, deals
       { name, stage, value, closes, href } and activity rows of
       [date, who, what, kind], newest first. The quick view keeps three. */
		records: roster
			.list()
			.map((entry) =>
				Object.assign(entry, { activity: entry.activity.slice(0, 3).map((line) => line.slice(0, 4)) }),
			),
	};

	/* One method per write that has to reach your backend. The demo settles
     each one after a quarter second, roughly as a network call would. */
	const server = {
		create(record) {
			return later(250);
		} /* POST /api/companies */,
		drop(id) {
			return later(250);
		} /* DELETE /api/companies/:id */,
		revive(record) {
			return later(250);
		} /* POST /api/companies, after Undo */,
		reassign(ids, owner) {
			return later(250);
		} /* PATCH /api/companies { ids, owner } */,
		annotate(id, text) {
			return later(250);
		} /* POST /api/companies/:id/notes */,
	};

	const DAY_MS = 86400000;
	const PAGE_SIZE = 10;
	const SOON_DAYS = 60;
	const TABS = ['all', 'customer', 'prospect', 'former'];
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const MONTH_FULL = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	];
	/* Every owner is a teammate with an account page of their own. */
	const TEAMMATE_PAGE = 'employee-user-details.html';
	const ACTIVITY_ICONS = {
		note: 'bi-sticky',
		call: 'bi-telephone',
		email: 'bi-envelope',
		update: 'bi-check2-circle',
		meeting: 'bi-calendar-event',
	};
	/* Health is scored each Monday from seat use, tickets and payments. */
	const HEALTH_BANDS = [
		{ floor: 70, key: 'good', spoken: 'healthy' },
		{ floor: 45, key: 'watch', spoken: 'watch' },
		{ floor: 0, key: 'risk', spoken: 'at risk' },
	];
	/* The filter panel's groups, in the order they appear in it. */
	const FACETS = {
		show: {
			blank: 'All companies',
			options: () => [
				{ id: 'soon', name: 'Renewing soon' },
				{ id: 'deals', name: 'Open deals' },
				{ id: 'mine', name: 'Mine' },
			],
		},
		trade: { blank: 'Any industry', options: () => catalog.sectors.map(({ id, name }) => ({ id, name })) },
		plan: { blank: 'Any plan', options: () => catalog.tiers.map(({ id, name }) => ({ id, name })) },
		region: {
			blank: 'Any region',
			options: () => catalog.territories.map((place) => ({ id: place, name: place })),
		},
	};
	/* The "show" facet narrows to companies that want attention. */
	const SHOW_TESTS = {
		soon: (record) => renewsSoon(record),
		deals: (record) => liveDeals(record).length > 0,
		mine: (record) => record.owner === catalog.viewer,
	};
	const SORT_KEYS = {
		name: (record) => record.name.toLowerCase(),
		arr: (record) => leadFigure(record),
		renews: (record) => headlineDate(record).at,
	};

	const now = parseDay(catalog.asOf);
	const urlFlags = new URLSearchParams(location.search);
	const book = urlFlags.get('state') === 'empty' ? [] : catalog.records.map(cloneRecord);
	const picked = { show: '', trade: '', plan: '', region: '' };
	const listState = {
		tab: TABS.indexOf(urlFlags.get('stage')) > 0 ? urlFlags.get('stage') : 'all',
		text: '',
		sortKey: 'name',
		ascending: true,
		page: 1,
		checked: new Set(),
	};
	let onScreen = [];
	/* The plan split behind the ring, and the total it shows at rest. */
	let ringSplit = [];
	let ringResting = '';
	let pagerHandle = null;
	let typingPause = 0;
	let pendingRemoval = null;
	let stepList = [];
	let stepper = null;
	let focused = null;

	const ui = {
		tabGroup: pick('[data-co-views]', pageRoot),
		tabStrip: pick('.co-views', pageRoot),
		toolbar: pick('.co-toolbar', pageRoot),
		search: pick('[data-co-search]', pageRoot),
		filterToggle: pick('[data-co-filter-btn]', pageRoot),
		filterBadge: pick('[data-co-filter-count]', pageRoot),
		appliedBox: pick('[data-co-applied]', pageRoot),
		tally: pick('[data-co-summary]', pageRoot),
		bulkBar: pick('[data-co-bulk]', pageRoot),
		bulkTally: pick('[data-co-bulk-count]', pageRoot),
		bulkKeepers: pick('[data-co-bulk-owners]', pageRoot),
		pageBox: pick('[data-co-check-page]', pageRoot),
		tableBox: pick('[data-co-table-wrap]', pageRoot),
		rows: pick('[data-co-body]', pageRoot),
		noMatch: pick('[data-co-noresults]', pageRoot),
		noMatchText: pick('[data-co-noresults-text]', pageRoot),
		blank: pick('[data-co-empty]', pageRoot),
		pagerBox: pick('[data-co-pager-wrap]', pageRoot),
		pagerList: pick('[data-co-pager]', pageRoot),
		pagerText: pick('[data-co-pager-meta]', pageRoot),
		chartsRow: pick('[data-co-insights]', pageRoot),
		sectorBars: pick('[data-co-trades]', pageRoot),
		ringSvg: pick('[data-co-ring]', pageRoot),
		ringSum: pick('[data-co-ring-total]', pageRoot),
		ringLabel: pick('[data-co-ring-label]', pageRoot),
		tierKey: pick('[data-co-plans]', pageRoot),
	};
	const quick = document.getElementById('co-drawer');
	const removeDialog = document.getElementById('co-remove');
	const addDialog = document.getElementById('co-add');
	const addSheet = pick('[data-co-add-form]', addDialog);
	const inputs = {
		name: pick('[data-co-add-name]', addDialog),
		nameHint: pick('[data-co-add-name-error]', addDialog),
		site: pick('[data-co-add-site]', addDialog),
		city: pick('[data-co-add-city]', addDialog),
		sector: pick('[data-co-add-trade]', addDialog),
		territory: pick('[data-co-add-region]', addDialog),
		tiers: pick('[data-co-add-plans]', addDialog),
		seats: pick('[data-co-add-seats]', addDialog),
		keeper: pick('[data-co-add-owner]', addDialog),
		estimate: pick('[data-co-add-sum]', addDialog),
	};

	/** Wires every control, fills the static lists and draws the first screen. */
	function start() {
		wireTabs();
		wireRing();
		wireSearch();
		wireFacets();
		wireSorting();
		wireChecks();
		wireExport();
		wireSectorPicks();
		wireRemoval();
		wireQuickView();
		wireAddDialog();
		selectTab(listState.tab);
		paintChips();
		repaint();
	}

	/* Redrawing. repaint() redraws everything that depends on the book;
     the narrower painters run on their own when only the list moved. */

	function repaint() {
		paintTabCounts();
		paintTable();
		paintApplied();
		paintCharts();
	}

	function paintTabCounts() {
		for (const tab of TABS) {
			pick(`[data-co-view-count="${tab}"]`, pageRoot).textContent = book.filter((record) =>
				belongsToTab(record, tab),
			).length;
		}
	}

	function paintTable() {
		onScreen = ordered(book.filter(fitsFilters));
		const pageCount = Math.max(1, Math.ceil(onScreen.length / PAGE_SIZE));
		listState.page = Math.min(listState.page, pageCount);
		const offset = (listState.page - 1) * PAGE_SIZE;
		const pageRecords = onScreen.slice(offset, offset + PAGE_SIZE);

		const bookEmpty = book.length === 0;
		const filteredOut = !bookEmpty && onScreen.length === 0;
		ui.blank.hidden = !bookEmpty;
		ui.noMatch.hidden = !filteredOut;
		ui.tableBox.hidden = bookEmpty || filteredOut;
		for (const part of [ui.toolbar, ui.tabStrip, ui.chartsRow]) part.hidden = bookEmpty;
		if (filteredOut) ui.noMatchText.textContent = noMatchMessage();

		ui.rows.innerHTML = pageRecords.map(rowMarkup).join('');
		window.Basalt.tips?.(ui.rows);
		ui.tally.textContent = companyCount(onScreen.length);
		paintPager(offset, pageCount);
		paintSortHeads();
		paintChecks();
	}

	function noMatchMessage() {
		if (!listState.text) return 'No company fits these filters. Clear one to see more.';
		const narrowed = picked.show || picked.trade || picked.plan || picked.region || listState.tab !== 'all';
		return `Nothing matches “${listState.text}”${narrowed ? ' with these filters' : ''}. Try another spelling${narrowed ? ', or clear the filters.' : '.'}`;
	}

	/**
	 * Shows the pager once there is more than one page and keeps the shared
	 * pagination widget in step with the current page.
	 * @param {number} offset index of the first row on this page
	 * @param {number} pageCount pages the current list spans
	 */
	function paintPager(offset, pageCount) {
		const total = onScreen.length;
		ui.pagerBox.hidden = total <= PAGE_SIZE;
		ui.pagerText.innerHTML = `<strong>${offset + 1}–${Math.min(offset + PAGE_SIZE, total)}</strong> of ${total} companies`;
		if (!window.Basalt.pagination || total <= PAGE_SIZE) return;
		if (pagerHandle) {
			pagerHandle.setTotal(pageCount);
			if (pagerHandle.get() !== listState.page) pagerHandle.set(listState.page);
			return;
		}
		pagerHandle = window.Basalt.pagination(ui.pagerList, {
			total: pageCount,
			current: listState.page,
			label: 'Companies page',
			onChange(target) {
				if (target === listState.page) return;
				listState.page = target;
				paintTable();
			},
		});
	}

	function paintSortHeads() {
		for (const column of pickAll('[data-co-th]', pageRoot)) {
			const inUse = column.getAttribute('data-co-th') === listState.sortKey;
			if (inUse) column.setAttribute('aria-sort', listState.ascending ? 'ascending' : 'descending');
			else column.removeAttribute('aria-sort');
			const arrow = inUse
				? listState.ascending
					? 'bi-arrow-up'
					: 'bi-arrow-down'
				: 'bi-arrow-down-up co-sort-idle';
			pick('.bi', column).className = `bi ${arrow}`;
		}
	}

	function paintChecks() {
		const tickBoxes = pickAll('[data-co-tick]', ui.rows);
		const every = tickBoxes.length && tickBoxes.every((box) => box.checked);
		ui.pageBox.checked = !!every;
		ui.pageBox.indeterminate = !every && tickBoxes.some((box) => box.checked);
		ui.bulkBar.hidden = listState.checked.size === 0;
		ui.bulkTally.textContent = `${listState.checked.size} checked`;
	}

	function paintChips() {
		for (const [facet, spec] of Object.entries(FACETS)) {
			const choices = [{ id: '', name: spec.blank }, ...spec.options()];
			pick(`[data-co-chips="${facet}"]`, pageRoot).innerHTML = choices
				.map((choice, index) => {
					const inputId = `co-f-${facet}-${index}`;
					const on = choice.id === picked[facet] ? ' checked' : '';
					return `<input class="btn-check" type="radio" id="${inputId}" name="co-f-${facet}" value="${htmlSafe(choice.id)}"${on}><label class="co-chip" for="${inputId}">${htmlSafe(choice.name)}</label>`;
				})
				.join('');
		}
	}

	function paintApplied() {
		const inUse = Object.keys(FACETS).filter((facet) => picked[facet]);
		ui.filterBadge.hidden = inUse.length === 0;
		ui.filterBadge.textContent = inUse.length;
		ui.filterToggle.classList.toggle('is-on', inUse.length > 0);
		const appliedChips = inUse.map((facet) => ({
			label: facetLabel(facet, picked[facet]),
			remove() {
				picked[facet] = '';
				listState.page = 1;
				paintChips();
				paintTable();
				paintApplied();
			},
		}));
		window.Basalt.drawer?.applied?.(ui.appliedBox, appliedChips, resetFilters, ui.filterToggle);
	}

	function facetLabel(facet, id) {
		const found = FACETS[facet].options().find((option) => option.id === id);
		return found ? found.name : id;
	}

	/* The two revenue cards count paying customers only, since nobody else
     pays: ranked bars by industry, and a ring split by plan. */

	function paintCharts() {
		const paying = book.filter((record) => record.stage === 'customer');
		const earned = sumYearly(paying);
		const divisor = earned || 1;
		paintSectorBars(paying);
		paintTierRing(paying, divisor);
		ui.ringSum.textContent = compact(earned);
		ringResting = compact(earned);
	}

	function paintSectorBars(paying) {
		const ranked = catalog.sectors
			.map((sector) => {
				const group = paying.filter((record) => record.trade === sector.id);
				return { sector, count: group.length, amount: sumYearly(group) };
			})
			.filter((entry) => entry.count)
			.sort((left, right) => right.amount - left.amount);
		const peak = ranked.length ? ranked[0].amount : 1;
		ui.sectorBars.innerHTML = ranked
			.map(({ sector, count, amount }) => {
				const width = ((amount / peak) * 100).toFixed(1);
				return `<li><button class="co-bar co-tone-${sector.tone}" type="button" data-co-trade="${sector.id}"><span class="co-bar-name"><i class="bi ${sector.icon}" aria-hidden="true"></i>${htmlSafe(sector.name)}</span><span class="co-bar-track" aria-hidden="true"><span class="co-bar-fill" style="--w:${width}%"></span></span><span class="co-bar-value">${compact(amount)}</span><span class="co-bar-count">${customerCount(count)}</span></button></li>`;
			})
			.join('');
	}

	/**
	 * Draws the plan ring as stroked circle arcs laid end to end, with a
	 * small gap between arcs when more than one plan earns anything.
	 * @param {object[]} paying customer records
	 * @param {number} divisor yearly total, never zero
	 */
	function paintTierRing(paying, divisor) {
		const split = catalog.tiers
			.map((tier) => {
				const group = paying.filter((record) => record.plan === tier.id);
				return { tier, count: group.length, amount: sumYearly(group) };
			})
			.sort((left, right) => right.amount - left.amount);
		const radius = 48;
		const around = 2 * Math.PI * radius;
		const earning = split.filter((entry) => entry.amount);
		const spacing = earning.length > 1 ? 2.5 : 0;
		let traveled = 0;
		const arcs = earning.map(({ tier, amount }) => {
			const length = (amount / divisor) * around;
			const arc = `<circle data-co-tier="${tier.id}" class="co-ring-seg co-tone-${tier.tone}" cx="60" cy="60" r="${radius}" stroke-dasharray="${Math.max(0, length - spacing).toFixed(2)} ${around.toFixed(2)}" stroke-dashoffset="${(-traveled).toFixed(2)}"></circle>`;
			traveled += length;
			return arc;
		});
		ui.ringSvg.innerHTML = `<circle class="co-ring-track" cx="60" cy="60" r="${radius}"></circle>${arcs.join('')}`;
		ringSplit = split.map((entry) => ({ ...entry, share: Math.round((entry.amount / divisor) * 100) }));
		ui.tierKey.innerHTML = split
			.map(
				({ tier, count, amount }) =>
					`<li data-co-tier="${tier.id}" tabindex="0" class="co-tone-${tier.tone}"><span class="co-ring-dot" aria-hidden="true"></span><span class="co-ring-name">${htmlSafe(tier.name)}<span class="co-sub">${customerCount(count)} · $${tier.price} a seat</span></span><span class="co-ring-amt">${compact(amount)}<span class="co-sub">${Math.round((amount / divisor) * 100)}%</span></span></li>`,
			)
			.join('');
	}

	/* Pointing at a slice or its row picks that plan out: the slice thickens,
     the others fade, and the center shows the plan's revenue and share. */
	function wireRing() {
		const ring = ui.ringSvg.closest('.co-ring');
		const tierAt = (event) => event.target.closest?.('[data-co-tier]')?.dataset.coTier ?? null;
		ring.addEventListener('pointerover', (event) => pickTier(tierAt(event)));
		ring.addEventListener('pointerleave', () => pickTier(null));
		ring.addEventListener('focusin', (event) => pickTier(tierAt(event)));
		ring.addEventListener('focusout', () => pickTier(null));
	}

	function pickTier(tierId) {
		const chosen = ringSplit.find((entry) => entry.tier.id === tierId);
		ui.ringSvg.closest('.co-ring').classList.toggle('is-picking', Boolean(chosen));
		for (const part of pickAll('[data-co-tier]', ui.ringSvg.closest('.co-ring'))) {
			part.classList.toggle('is-on', part.dataset.coTier === tierId);
		}
		ui.ringSum.textContent = chosen ? compact(chosen.amount) : ringResting;
		ui.ringLabel.textContent = chosen ? `${chosen.tier.name} · ${chosen.share}%` : 'a year';
	}

	/* Wiring for the list: tabs, search, the filter panel, sorting,
     checkboxes with their bulk bar, and CSV export. */

	function wireTabs() {
		ui.tabGroup.addEventListener('change', (event) => {
			if (event.target.name !== 'co-view') return;
			listState.tab = event.target.value;
			listState.page = 1;
			paintTable();
		});
	}

	function selectTab(tab) {
		const radio = document.getElementById(`co-view-${tab}`);
		if (radio) radio.checked = true;
		const tabApi = window.Basalt.tabs ? window.Basalt.tabs(ui.tabStrip) : null;
		tabApi?.refresh?.();
		listState.tab = tab;
	}

	function wireSearch() {
		ui.search.addEventListener('input', () => {
			clearTimeout(typingPause);
			typingPause = setTimeout(() => {
				listState.text = ui.search.value.trim();
				listState.page = 1;
				paintTable();
			}, 120);
		});
		pick('[data-co-clear]', pageRoot).addEventListener('click', () => {
			ui.search.value = '';
			listState.text = '';
			selectTab('all');
			resetFilters();
			ui.search.focus();
		});
	}

	function wireFacets() {
		pick('#co-filters').addEventListener('change', (event) => {
			const facet = event.target.name?.replace('co-f-', '');
			if (!FACETS[facet]) return;
			picked[facet] = event.target.value;
			listState.page = 1;
			paintTable();
			paintApplied();
		});
		pick('[data-co-filter-clear]', pageRoot).addEventListener('click', () => resetFilters());
		pick('[data-co-filter-done]', pageRoot).addEventListener('click', () => {
			window.bootstrap?.Dropdown.getInstance(ui.filterToggle)?.hide();
		});
	}

	function resetFilters() {
		for (const facet of Object.keys(picked)) picked[facet] = '';
		listState.page = 1;
		paintChips();
		paintTable();
		paintApplied();
	}

	function wireSorting() {
		pageRoot.addEventListener('click', (event) => {
			const trigger = event.target.closest('[data-co-sort-by]');
			if (!trigger) return;
			const key = trigger.getAttribute('data-co-sort-by');
			if (listState.sortKey === key) {
				listState.ascending = !listState.ascending;
			} else {
				listState.sortKey = key;
				listState.ascending = key !== 'arr';
			}
			listState.page = 1;
			paintTable();
		});
	}

	function wireChecks() {
		ui.rows.addEventListener('change', (event) => {
			const id = event.target.getAttribute('data-co-tick');
			if (!id) return;
			markChecked(event.target, id, event.target.checked);
			paintChecks();
		});
		ui.pageBox.addEventListener('change', () => {
			const on = ui.pageBox.checked;
			for (const box of pickAll('[data-co-tick]', ui.rows)) {
				box.checked = on;
				markChecked(box, box.getAttribute('data-co-tick'), on);
			}
			paintChecks();
		});
		ui.bulkKeepers.innerHTML = catalog.keepers
			.map(
				(person) =>
					`<li><button class="dropdown-item co-owner-item" type="button" data-co-set-owner="${htmlSafe(person)}">${avatar(person)}${htmlSafe(person)}</button></li>`,
			)
			.join('');
		ui.bulkKeepers.addEventListener('click', (event) => {
			const choice = event.target.closest('[data-co-set-owner]');
			if (choice) handOver(choice.getAttribute('data-co-set-owner'));
		});
		pageRoot.addEventListener('click', (event) => {
			const bulkAction = event.target.closest('[data-co-bulk]')?.getAttribute('data-co-bulk');
			if (bulkAction === 'clear') {
				listState.checked.clear();
				paintTable();
			} else if (bulkAction === 'export') {
				const chosen = book.filter((record) => listState.checked.has(record.id));
				saveCsv(chosen, 'companies-selected.csv');
				notify({ tone: 'success', icon: 'bi-download', title: `Exported ${companyCount(chosen.length)}` });
			}
		});
	}

	function markChecked(box, id, on) {
		if (on) listState.checked.add(id);
		else listState.checked.delete(id);
		box.closest('tr').classList.toggle('is-selected', on);
	}

	/** Gives every checked company to one teammate, with Undo in the toast. */
	function handOver(owner) {
		const ids = [...listState.checked];
		const priorOwners = new Map(ids.map((id) => [id, findRecord(id).owner]));
		for (const id of ids) findRecord(id).owner = owner;
		listState.checked.clear();
		repaint();

		function putOwnersBack() {
			for (const [id, earlier] of priorOwners) {
				const record = findRecord(id);
				if (record) record.owner = earlier;
			}
			repaint();
			speak('Owners put back.');
		}

		notify({
			tone: 'success',
			icon: 'bi-person-check',
			title: `${owner} now looks after ${companyCount(ids.length)}`,
			duration: 8000,
			actions: [{ label: 'Undo', onClick: putOwnersBack }],
		});
		server.reassign(ids, owner).catch(() => {
			putOwnersBack();
			notify({
				tone: 'danger',
				title: 'The owner didn’t change',
				text: 'Nothing was saved. Try again in a moment.',
			});
		});
	}

	function wireExport() {
		pick('[data-co-export-all]', pageRoot).addEventListener('click', () => {
			saveCsv(book, 'companies.csv');
			notify({ tone: 'success', icon: 'bi-download', title: `Exported ${book.length} companies` });
		});
	}

	/**
	 * Builds a CSV of the given companies and hands it to the browser as a
	 * download under the given file name.
	 */
	function saveCsv(records, fileName) {
		const headings = [
			'Company',
			'Stage',
			'Industry',
			'City',
			'Region',
			'Website',
			'Plan',
			'Seats',
			'Health',
			'Yearly revenue',
			'Open deals',
			'Date',
			'What the date is',
			'Owner',
		];
		const bodyRows = records.map((record) => {
			const mark = headlineDate(record);
			return [
				record.name,
				catalog.phases[record.stage].name,
				sectorOf(record.trade).name,
				record.city,
				record.region,
				record.site,
				tierOf(record.plan).name,
				record.seats,
				record.health ?? '',
				yearlyRevenue(record),
				dealSum(record),
				mark.at,
				mark.label.split(' ')[0].toLowerCase(),
				record.owner,
			];
		});
		const text = [headings, ...bodyRows].map((line) => line.map(csvField).join(',')).join('\r\n');
		const anchor = document.createElement('a');
		anchor.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
		anchor.download = fileName;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
	}

	function csvField(value) {
		return `"${String(value).replace(/"/g, '""')}"`;
	}

	/* A bar in the industry chart filters the list to that industry and
     scrolls back up to it. */
	function wireSectorPicks() {
		ui.sectorBars.addEventListener('click', (event) => {
			const bar = event.target.closest('[data-co-trade]');
			if (!bar) return;
			picked.trade = bar.getAttribute('data-co-trade');
			listState.page = 1;
			paintChips();
			paintTable();
			paintApplied();
			const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
			pick('#co-dir').scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
			speak(`Showing ${onScreen.length} ${facetLabel('trade', picked.trade)} companies.`);
		});
	}

	/* Removing asks first, then takes the company out at once and offers
     Undo; a failed call quietly puts it back. */
	function wireRemoval() {
		pageRoot.addEventListener('click', (event) => {
			const trigger = event.target.closest('[data-co-remove]');
			if (!trigger) return;
			pendingRemoval = findRecord(trigger.getAttribute('data-co-remove'));
			if (!pendingRemoval) return;
			pick('[data-co-remove-title]', removeDialog).textContent = `Remove ${pendingRemoval.name}?`;
			window.bootstrap.Modal.getOrCreateInstance(removeDialog).show();
		});
		pick('[data-co-remove-go]', removeDialog).addEventListener('click', () => {
			if (pendingRemoval) removeRecord(pendingRemoval);
		});
	}

	function removeRecord(record) {
		const position = book.indexOf(record);
		book.splice(position, 1);
		listState.checked.delete(record.id);
		window.bootstrap.Modal.getOrCreateInstance(removeDialog).hide();
		repaint();

		function reinstate() {
			if (!findRecord(record.id)) book.splice(Math.min(position, book.length), 0, record);
			repaint();
		}

		const undo = {
			label: 'Undo',
			onClick() {
				reinstate();
				speak(`${record.name} is back.`);
				server.revive(record);
			},
		};
		notify({
			tone: 'success',
			icon: 'bi-trash3',
			title: `${record.name} removed`,
			duration: 8000,
			actions: [undo],
		});
		server.drop(record.id).catch(() => {
			reinstate();
			notify({
				tone: 'danger',
				title: `Couldn’t remove ${record.name}`,
				text: 'Nothing was changed. Try again in a moment.',
			});
		});
	}

	/* The quick view: a drawer with the company at a glance and a switch
     between its people, its deals and its activity log with a note box. */

	function wireQuickView() {
		quick.addEventListener('change', (event) => {
			if (event.target.name === 'co-d-pane') showPane(event.target.value);
		});
		pageRoot.addEventListener('click', followRow);
		pageRoot.addEventListener('auxclick', (event) => {
			if (event.button === 1 && !event.target.closest('button')) followRow(event);
		});
		const noteBox = pick('[data-co-note]', quick);
		noteBox.addEventListener('input', (event) => {
			if (event.target.value.trim()) event.target.classList.remove('is-invalid');
		});
		pick('[data-co-note-form]', quick).addEventListener('submit', (event) => {
			event.preventDefault();
			addNote(noteBox);
		});
	}

	/**
	 * Clicks inside the table. The panel icon opens the quick view; anywhere
	 * else on a row, short of its own controls and the checkbox cell, goes
	 * to the company's page, in a new tab with Cmd, Ctrl or a middle click.
	 */
	function followRow(event) {
		const opener = event.target.closest('[data-co-open]');
		if (opener) {
			openQuickView(opener.getAttribute('data-co-open'));
			return;
		}
		const row = event.target.closest('[data-co-row]');
		if (!row || event.target.closest('a, button, input, .dropdown-menu, .co-col-check')) return;
		const target = recordUrl(findRecord(row.getAttribute('data-co-row')));
		const newTab = event.metaKey || event.ctrlKey || event.button === 1;
		if (newTab) window.open(target, '_blank', 'noopener');
		else location.href = target;
	}

	function openQuickView(id) {
		stepList = [...onScreen];
		let index = stepList.findIndex((record) => record.id === id);
		if (index < 0) {
			stepList = [findRecord(id)];
			index = 0;
		}
		if (!stepper && window.Basalt.drawer) {
			/* The length is read on every step, so this one binding keeps up
         with however long the list is by then. */
			const length = { valueOf: () => Math.max(1, stepList.length) };
			stepper = window.Basalt.drawer.recordNav(quick, length, (at) => fillQuickView(stepList[at]));
		}
		if (stepper) stepper.go(index, 0);
		else fillQuickView(stepList[index]);
		pick('.basalt-drawer-nav', quick).hidden = stepList.length < 2;
		showPane('people');
		window.bootstrap.Offcanvas.getOrCreateInstance(quick).show();
	}

	function showPane(name) {
		const radio = pick(`input[name="co-d-pane"][value="${name}"]`, quick);
		if (radio && !radio.checked) {
			radio.checked = true;
			radio.dispatchEvent(new Event('change', { bubbles: true }));
		}
		for (const panel of pickAll('[data-co-pane]', quick))
			panel.hidden = panel.getAttribute('data-co-pane') !== name;
	}

	function fillQuickView(record) {
		if (!record) return;
		focused = record;
		const sector = sectorOf(record.trade);
		const tile = part('logo');
		tile.className = `co-logo co-logo-lg co-tone-${sector.tone}`;
		tile.innerHTML = `<i class="bi ${sector.icon}"></i>`;
		part('page').href = recordUrl(record);
		part('name').textContent = record.name;
		part('sub').textContent = `${sector.name} · ${record.city}`;
		part('lead').innerHTML = leadMarkup(record);
		part('facts').innerHTML = factsMarkup(record);
		fillPeople(record);
		fillDeals(record);
		paintActivity(record);
		const noteBox = pick('[data-co-note]', quick);
		noteBox.value = '';
		noteBox.classList.remove('is-invalid');
	}

	/** One sentence on what the company is worth to you, worded by stage. */
	function leadMarkup(record) {
		const tier = htmlSafe(tierOf(record.plan).name);
		const { seats } = record;
		if (record.stage === 'former')
			return `Paid <strong>${dollars(prospectWorth(record))}</strong> a year on ${tier} until ${longDate(record.left)}. ${htmlSafe(record.reason)}.`;
		if (record.status === 'trial')
			return `Trying ${tier} with ${seats} seats: <strong>${dollars(prospectWorth(record))}</strong> a year once they pay.`;
		if (record.status === 'lost')
			return `Lost a deal for ${tier}, ${seats} seats, worth <strong>${dollars(prospectWorth(record))}</strong> a year. ${htmlSafe(record.reason)}.`;
		if (record.stage === 'prospect')
			return `Talking about ${tier} for ${seats} seats: <strong>${dollars(prospectWorth(record))}</strong> a year if they sign.`;
		return `<strong>${dollars(yearlyRevenue(record))}</strong> a year on ${tier}, ${seats} seats.`;
	}

	function factsMarkup(record) {
		const mark = headlineDate(record);
		const former = record.stage === 'former';
		const sinceTerm = former ? 'Customer' : record.stage === 'prospect' ? 'First contact' : 'Customer since';
		const sinceValue = former
			? `${monthAndYear(record.since)} to ${monthAndYear(record.left)}`
			: monthAndYear(record.since);
		const website = record.site
			? `<a class="co-link" href="https://${htmlSafe(record.site)}" target="_blank" rel="noopener">${htmlSafe(record.site)}</a>`
			: '<span class="co-sub">Not added</span>';
		const pairs = [
			['Stage', phasePill(record)],
			[
				mark.label,
				`${longDate(mark.at)} <span class="co-due${dueClass(mark, true)}">· ${htmlSafe(mark.rest)}</span>`,
			],
			record.kind === 'account' && ['Health', healthMarkup(record)],
			[
				'Owner',
				`<a class="co-owner" href="${TEAMMATE_PAGE}">${avatar(record.owner)}<span>${htmlSafe(record.owner)}</span></a>`,
			],
			['Region', htmlSafe(record.region)],
			['Website', website],
			[sinceTerm, sinceValue],
		];
		return pairs
			.filter(Boolean)
			.map(([term, detail]) => `<div><dt>${term}</dt><dd>${detail}</dd></div>`)
			.join('');
	}

	function fillPeople(record) {
		const { people } = record;
		part('people-label').textContent = `People ${people.length}`;
		if (!people.length) {
			part('people').innerHTML = '<li class="co-sub">No people added yet.</li>';
			return;
		}
		part('people').innerHTML = people
			.map((person) => {
				const label = person.key
					? `<a class="co-person-name" href="person-details.html?id=${encodeURIComponent(person.key)}">${htmlSafe(person.name)}</a>`
					: `<span class="co-person-name">${htmlSafe(person.name)}</span>`;
				const rolePill = `<span class="co-role" title="${htmlSafe(roster.roles[person.role])}">${htmlSafe(person.role)}</span>`;
				const mailLink = `<a class="btn btn-icon co-person-mail" href="mailto:${htmlSafe(person.email)}" title="${htmlSafe(person.email)}" aria-label="Email ${htmlSafe(person.name)}"><i class="bi bi-envelope" aria-hidden="true"></i></a>`;
				return `<li class="co-person">${avatar(person.name, 'basalt-avatar-sm')}<span class="co-person-text">${label}<span class="co-sub">${htmlSafe(person.title)}</span></span>${rolePill}${mailLink}</li>`;
			})
			.join('');
	}

	function fillDeals(record) {
		const customer = record.stage === 'customer';
		const listed = customer ? liveDeals(record) : record.deals;
		part('deals-label').textContent = `${customer ? 'Open deals' : 'Deals'} ${listed.length}`;
		part('deals-note').innerHTML = dealsNote(record, listed);
		pick('.co-d-more', quick).hidden = record.stage === 'former';
		part('deals').innerHTML = listed
			.map(
				(deal) =>
					`<li class="co-deal"><a class="co-deal-name" href="${deal.href}">${htmlSafe(deal.name)}</a>${dealPill(deal.stage)}<span class="co-deal-amt">+${dollars(deal.value)}</span></li>`,
			)
			.join('');
	}

	function dealsNote(record, listed) {
		if (record.stage === 'former') return 'No deals since they left.';
		if (record.status === 'trial') return 'No deal yet. The trial turns into one when they pay.';
		if (record.status === 'lost') return `Lost on ${longDate(record.closes)}.`;
		if (!listed.length) return 'Nothing open beyond the renewal.';
		const opener = listed.length === 1 ? 'One open deal' : `${listed.length} open deals`;
		return `${opener} would add <strong>${dollars(dealSum(record))}</strong> a year.`;
	}

	function paintActivity(record) {
		part('activity').innerHTML = record.activity
			.map(
				([when, who, what, kind]) =>
					`<li class="co-act"><span class="co-act-icon" aria-hidden="true"><i class="bi ${ACTIVITY_ICONS[kind] || 'bi-dot'}"></i></span><span class="co-act-text">${htmlSafe(what)}<span class="co-sub">${htmlSafe(who)} · ${longDate(when)}</span></span></li>`,
			)
			.join('');
	}

	/** Adds the typed note to the open company's log, or flags the empty box. */
	function addNote(noteBox) {
		const text = noteBox.value.trim();
		noteBox.classList.toggle('is-invalid', !text);
		if (!text) {
			noteBox.focus();
			return;
		}
		const record = focused;
		const entry = [catalog.asOf, catalog.viewer, text, 'note'];
		record.activity.unshift(entry);
		noteBox.value = '';
		noteBox.focus();
		paintActivity(record);
		notify({ tone: 'success', icon: 'bi-sticky', title: `Note added to ${record.name}` });
		server.annotate(record.id, text).catch(() => {
			record.activity.splice(record.activity.indexOf(entry), 1);
			if (focused === record) paintActivity(record);
			notify({ tone: 'danger', title: 'The note didn’t save', text: 'Check your connection and add it again.' });
		});
	}

	/* The add dialog: name, place, stage, plan, seats and owner, with a
     running line that prices the choice for a year. */

	function wireAddDialog() {
		inputs.sector.innerHTML = catalog.sectors
			.map((sector) => `<option value="${sector.id}">${htmlSafe(sector.name)}</option>`)
			.join('');
		inputs.territory.innerHTML = catalog.territories.map((place) => `<option>${htmlSafe(place)}</option>`).join('');
		inputs.keeper.innerHTML = catalog.keepers
			.map((person) => `<option${person === catalog.viewer ? ' selected' : ''}>${htmlSafe(person)}</option>`)
			.join('');
		inputs.tiers.innerHTML = catalog.tiers
			.map(
				(tier) =>
					`<label class="basalt-choice-card"><input class="basalt-choice-card-input" type="radio" name="co-add-plan" value="${tier.id}"${tier.id === 'growth' ? ' checked' : ''}><span class="basalt-choice-card-mark" aria-hidden="true"><i class="bi bi-check-lg"></i></span><span class="basalt-choice-card-title">${htmlSafe(tier.name)}</span><span class="basalt-choice-card-text">$${tier.price} a seat a month</span></label>`,
			)
			.join('');
		refreshSelects();

		addSheet.addEventListener('input', (event) => {
			paintEstimate();
			if (event.target === inputs.name && inputs.name.value.trim()) inputs.name.classList.remove('is-invalid');
			if (event.target === inputs.seats) inputs.seats.classList.remove('is-invalid');
		});
		addSheet.addEventListener('change', paintEstimate);
		for (const opener of pickAll('[data-co-add-open]', pageRoot)) opener.addEventListener('click', openAddDialog);
		addDialog.addEventListener('shown.bs.modal', () => inputs.name.focus());
		addSheet.addEventListener('submit', (event) => {
			event.preventDefault();
			submitAdd();
		});
	}

	function refreshSelects() {
		for (const control of [inputs.sector, inputs.territory, inputs.keeper])
			window.Basalt.select?.refresh?.(control);
	}

	function openAddDialog() {
		addSheet.reset();
		pick('[data-co-add-stage]', addDialog).dispatchEvent(new Event('change', { bubbles: true }));
		inputs.keeper.value = catalog.viewer;
		refreshSelects();
		inputs.name.classList.remove('is-invalid');
		inputs.seats.classList.remove('is-invalid');
		paintEstimate();
		window.bootstrap.Modal.getOrCreateInstance(addDialog).show();
	}

	function chosenTier() {
		return pick('input[name="co-add-plan"]:checked', addDialog)?.value || 'growth';
	}

	function chosenStage() {
		return pick('input[name="co-add-stage"]:checked', addDialog)?.value || 'prospect';
	}

	function paintEstimate() {
		const seats = parseInt(inputs.seats.value, 10);
		const icon = '<i class="bi bi-calendar-check" aria-hidden="true"></i>';
		if (!(seats >= 1 && seats <= 500)) {
			inputs.estimate.innerHTML = `${icon}<span>Enter the number of seats to see the yearly price.</span>`;
			return;
		}
		const tier = tierOf(chosenTier());
		const ending =
			chosenStage() === 'customer' ? `. First renewal on ${shortDate(yearFromNow())}.` : ' if they sign.';
		inputs.estimate.innerHTML = `${icon}<span><strong>${dollars(seats * tier.price * 12)}</strong> a year on ${htmlSafe(tier.name)}${ending}</span>`;
	}

	/**
	 * Checks the add form and, when it passes, puts the new company at the
	 * top of an unfiltered, name-sorted list on the page where it landed.
	 */
	function submitAdd() {
		const name = inputs.name.value.trim();
		const seats = parseInt(inputs.seats.value, 10);
		const nameInUse = book.some((record) => record.name.toLowerCase() === name.toLowerCase());
		const nameBad = !name || nameInUse;
		const seatsBad = !(seats >= 1 && seats <= 500);
		inputs.nameHint.textContent = nameInUse
			? 'A company with this name is already on the list.'
			: "Enter the company's name.";
		inputs.name.classList.toggle('is-invalid', nameBad);
		inputs.seats.classList.toggle('is-invalid', seatsBad);
		if (nameBad || seatsBad) {
			(nameBad ? inputs.name : inputs.seats).focus();
			return;
		}

		const stage = chosenStage();
		const customer = stage === 'customer';
		/* A fresh prospect starts in discovery and is expected to close in
       ninety days. */
		const record = {
			id: `new-${Date.now()}`,
			kind: customer ? 'account' : 'deal',
			stage,
			status: customer ? 'active' : 'discovery',
			health: null,
			name,
			trade: inputs.sector.value,
			city: inputs.city.value.trim() || 'City not added',
			region: inputs.territory.value,
			site: inputs.site.value
				.trim()
				.replace(/^https?:\/\//, '')
				.replace(/\/$/, ''),
			plan: chosenTier(),
			seats,
			since: catalog.asOf,
			renews: customer ? isoDay(yearFromNow()) : null,
			closes: customer ? null : isoDay(new Date(now.getTime() + 90 * DAY_MS)),
			owner: inputs.keeper.value,
			people: [],
			deals: [],
			activity: [[catalog.asOf, catalog.viewer, 'Added the company.', 'update']],
		};
		book.unshift(record);
		window.bootstrap.Modal.getOrCreateInstance(addDialog).hide();
		selectTab('all');
		ui.search.value = '';
		listState.text = '';
		for (const facet of Object.keys(picked)) picked[facet] = '';
		listState.sortKey = 'name';
		listState.ascending = true;
		listState.page = Math.floor(ordered(book).indexOf(record) / PAGE_SIZE) + 1;
		paintChips();
		repaint();
		pick(`[data-co-row="${record.id}"]`, ui.rows)?.classList.add('is-fresh');
		notify({
			tone: 'success',
			icon: 'bi-building-add',
			title: `${name} added`,
			text: `${dollars(leadFigure(record))} a year${customer ? '' : ' if they sign'}, looked after by ${record.owner}.`,
		});
		server.create(record).catch(() => {
			book.splice(book.indexOf(record), 1);
			repaint();
			notify({
				tone: 'danger',
				title: `Couldn’t add ${name}`,
				text: 'Nothing was saved. Try again in a moment.',
			});
		});
	}

	/* Filtering and ordering the list. */

	function belongsToTab(record, tab) {
		return tab === 'all' || record.stage === tab;
	}

	function fitsFilters(record) {
		if (!belongsToTab(record, listState.tab)) return false;
		const showTest = SHOW_TESTS[picked.show];
		if (showTest && !showTest(record)) return false;
		if (['trade', 'plan', 'region'].some((facet) => picked[facet] && record[facet] !== picked[facet])) return false;
		if (!listState.text) return true;
		const haystack = [
			record.name,
			record.city,
			record.site,
			sectorOf(record.trade).name,
			record.owner,
			...record.people.map((person) => person.name),
		].join(' ');
		if (window.Basalt?.matchesQuery) return window.Basalt.matchesQuery(haystack, listState.text);
		return haystack.toLowerCase().includes(listState.text.toLowerCase());
	}

	/** A sorted copy by the active column; ties fall back to the name. */
	function ordered(records) {
		const sign = listState.ascending ? 1 : -1;
		const keyOf = SORT_KEYS[listState.sortKey];
		return [...records].sort((left, right) => {
			const a = keyOf(left);
			const b = keyOf(right);
			if (a < b) return -sign;
			if (a > b) return sign;
			return left.name.localeCompare(right.name);
		});
	}

	/* Table rows and the small pieces they are built from. */

	function rowMarkup(record) {
		const on = listState.checked.has(record.id);
		const id = htmlSafe(record.id);
		const url = recordUrl(record);
		const standing = standingMarkup(record);
		const tickInput = `<input class="form-check-input" type="checkbox" data-co-tick="${id}"${on ? ' checked' : ''} aria-label="Check ${htmlSafe(record.name)}">`;
		const org = `<div class="co-org">${sectorTile(record)}<div class="co-org-text"><a class="co-org-name" href="${url}">${htmlSafe(record.name)}</a><span class="co-sub co-org-sub">${htmlSafe(sectorOf(record.trade).name)} · ${htmlSafe(record.city)}</span><span class="co-fold co-fold-plan">${standing}</span><span class="co-fold co-fold-owner">${avatar(record.owner)}${htmlSafe(record.owner)}</span></div></div>`;
		const keeper = `<a class="co-owner" href="${TEAMMATE_PAGE}">${avatar(record.owner, 'basalt-avatar-sm')}<span>${htmlSafe(record.owner)}</span></a>`;
		const columns = [
			td('co-col-check', tickInput),
			td('co-col-co', org),
			td('co-col-plan', standing),
			td(
				'co-col-arr',
				`<span class="co-cell-main">${dollars(rowFigure(record))}<span class="co-phone-label"> a year</span></span>`,
			),
			td('co-col-renew', dateMarkup(record)),
			td('co-col-owner', keeper),
			td('co-col-menu', actionsMarkup(record, id, url)),
		];
		return `<tr class="co-row${on ? ' is-selected' : ''}" data-co-row="${id}">${columns.join('')}</tr>`;
	}

	function td(className, inner) {
		return `<td class="${className}">${inner}</td>`;
	}

	function actionsMarkup(record, id, url) {
		const name = htmlSafe(record.name);
		const extra = menuExtra(record);
		const peek = `<button class="btn btn-icon btn-sm" type="button" data-co-open="${id}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view" aria-label="Quick view: ${name}"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>`;
		const expand = `<a class="btn btn-icon btn-sm" href="${url}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page" aria-label="Open full page: ${name}"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>`;
		const menuItems = `${extra ? `${extra}<li><hr class="dropdown-divider"></li>` : ''}<li><button class="dropdown-item co-danger-item" type="button" data-co-remove="${id}"><i class="bi bi-trash3" aria-hidden="true"></i>Remove</button></li>`;
		const menu = `<div class="dropdown"><button class="btn btn-icon co-menu-btn" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Actions for ${name}"><i class="bi bi-three-dots" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end">${menuItems}</ul></div>`;
		return `<div class="basalt-row-actions">${peek}${expand}${menu}</div>`;
	}

	/* A prospect's menu links its deal when it has one; everyone else's
     links the invoices. */
	function menuExtra(record) {
		if (record.stage !== 'prospect')
			return '<li><a class="dropdown-item" href="invoices.html"><i class="bi bi-receipt" aria-hidden="true"></i>Invoices</a></li>';
		const [deal] = record.deals;
		return deal
			? `<li><a class="dropdown-item" href="${deal.href}"><i class="bi bi-briefcase" aria-hidden="true"></i>Open deal</a></li>`
			: '';
	}

	/* The plan column holds one pill saying where the company stands: its
     plan, a trial, its deal stage, or that it has left. Health, seats and
     open deals wait for the quick view. */
	function standingMarkup(record) {
		if (record.stage === 'former') return '<span class="co-stage-pill co-stage-pill-former">Former</span>';
		if (record.status === 'trial') return '<span class="co-stage co-stage-trial">Trial</span>';
		if (record.stage === 'prospect') return dealPill(record.status);
		const tier = tierOf(record.plan);
		return `<span class="co-plan co-tone-${tier.tone}">${htmlSafe(tier.name)}</span>`;
	}

	function rowFigure(record) {
		if (record.stage === 'former') return 0;
		return record.status === 'trial' || record.stage === 'prospect' ? prospectWorth(record) : yearlyRevenue(record);
	}

	function dateMarkup(record) {
		const mark = headlineDate(record);
		const sentence = mark.text[0].toUpperCase() + mark.text.slice(1);
		return `<span class="co-cell-main co-due${dueClass(mark, false)}" title="${htmlSafe(longDate(mark.at))}">${htmlSafe(sentence)}</span>`;
	}

	/**
	 * Picks the warning class for a key date: late beats everything, the
	 * next thirty days read as near, and the drawer alone also marks the
	 * wider sixty-day window.
	 */
	function dueClass(mark, includeSoon) {
		if (mark.late) return ' co-due-late';
		const left = daysAway(mark.at);
		if (!mark.soon || left < 0) return '';
		if (left <= 30) return ' co-due-near';
		return includeSoon && left <= SOON_DAYS ? ' co-due-soon' : '';
	}

	/* The tile shows the company's industry icon in that industry's hue. */
	function sectorTile(record) {
		const { tone, icon } = sectorOf(record.trade);
		return `<span class="co-logo co-tone-${tone}" aria-hidden="true"><i class="bi ${icon}"></i></span>`;
	}

	function avatar(name, size = 'basalt-avatar-xs') {
		return `<span class="basalt-avatar ${size} basalt-avatar-tone-${toneFor(name)}" aria-hidden="true">${htmlSafe(initialsOf(name))}</span>`;
	}

	function phasePill(record) {
		return `<span class="co-stage-pill co-stage-pill-${record.stage}">${htmlSafe(catalog.phases[record.stage].name)}</span>`;
	}

	function dealPill(stage) {
		return `<span class="co-stage co-stage-${stage}">${htmlSafe(catalog.dealNames[stage])}</span>`;
	}

	function healthMarkup(record) {
		const points = record.health;
		if (points == null) return '<span class="co-sub">No health score yet</span>';
		const band = HEALTH_BANDS.find(({ floor }) => points >= floor);
		return `<span class="co-health co-health-${band.key}"><span class="co-health-track" aria-hidden="true"><span class="co-health-fill" style="--w:${points}%"></span></span><span class="co-health-num">${points}</span><span class="visually-hidden"> of 100, ${band.spoken}</span></span>`;
	}

	/* Money and the dates that matter to a company. */

	/* What a company pays a year. A customer added on this page bills
     monthly at full price; prospects and former customers pay nothing. */
	function yearlyRevenue(record) {
		if (record.yearly != null) return record.yearly;
		return record.stage === 'customer' ? record.seats * tierOf(record.plan).price * 12 : 0;
	}

	/* What a prospect would pay a year once it signs. */
	function prospectWorth(record) {
		return record.worth ?? record.seats * tierOf(record.plan).price * 12;
	}

	/* The figure a row sorts by: what it pays, or what it would. */
	function leadFigure(record) {
		return record.stage === 'prospect' ? prospectWorth(record) : yearlyRevenue(record);
	}

	function sumYearly(records) {
		return records.reduce((sum, record) => sum + yearlyRevenue(record), 0);
	}

	function liveDeals(record) {
		return record.deals.filter(({ stage }) => !['signed', 'lost'].includes(stage));
	}

	function dealSum(record) {
		return liveDeals(record).reduce((sum, deal) => sum + deal.value, 0);
	}

	function renewsSoon(record) {
		if (record.stage !== 'customer' || !record.renews) return false;
		const left = daysAway(record.renews);
		return left >= 0 && left <= SOON_DAYS;
	}

	/**
	 * The one date that matters for a company and how to say it: when it
	 * renews, when a trial ends, when a deal closes or when it left.
	 * @returns {{at: string, label: string, rest: string, text: string, soon?: boolean, late?: boolean}}
	 */
	function headlineDate(record) {
		const { stage, status } = record;
		if (stage === 'former') return dated(record.left, 'Left', agoPhrase(-daysAway(record.left)));
		if (status === 'trial')
			return dated(record.statusOn, 'Trial ends', untilPhrase(daysAway(record.statusOn)), { soon: true });
		if (status === 'lost') return dated(record.closes, 'Lost', agoPhrase(-daysAway(record.closes)));
		if (stage === 'prospect')
			return dated(record.closes, 'Closes', untilPhrase(daysAway(record.closes)), { soon: true });
		if (status === 'canceling')
			return dated(record.statusOn, 'Leaves', untilPhrase(daysAway(record.statusOn)), { soon: true });
		if (status === 'pastdue')
			return { ...dated(record.statusOn, 'Renewal', 'unpaid', { late: true }), rest: 'renewal unpaid' };
		return dated(record.renews, 'Renews', untilPhrase(daysAway(record.renews)), { soon: true });
	}

	function dated(at, label, rest, flags) {
		return { at, label, rest, text: `${label.toLowerCase()} ${rest}`, ...flags };
	}

	function untilPhrase(days) {
		if (days < 0) return 'overdue';
		const near = { 0: 'today', 1: 'tomorrow' }[days];
		if (near) return near;
		return days < 45 ? `in ${days} days` : `in ${Math.round(days / 30.4)} months`;
	}

	function agoPhrase(days) {
		const near = { 0: 'today', 1: 'yesterday' }[days];
		if (near) return near;
		if (days < 45) return `${days} days ago`;
		const monthCount = Math.round(days / 30.4);
		return `${monthCount} ${monthCount === 1 ? 'month' : 'months'} ago`;
	}

	function parseDay(iso) {
		return new Date(`${iso}T00:00:00`);
	}

	function daysAway(iso) {
		return Math.round((parseDay(iso) - now) / DAY_MS);
	}

	function shortDate(stamp) {
		return `${MONTH_ABBR[stamp.getMonth()]} ${stamp.getDate()}, ${stamp.getFullYear()}`;
	}

	function longDate(iso) {
		return shortDate(parseDay(iso));
	}

	function monthAndYear(iso) {
		const stamp = parseDay(iso);
		return `${MONTH_FULL[stamp.getMonth()]} ${stamp.getFullYear()}`;
	}

	function yearFromNow() {
		const stamp = new Date(now.getTime());
		stamp.setFullYear(stamp.getFullYear() + 1);
		return stamp;
	}

	function isoDay(stamp) {
		return `${stamp.getFullYear()}-${twoDigits(stamp.getMonth() + 1)}-${twoDigits(stamp.getDate())}`;
	}

	function twoDigits(number) {
		return String(number).padStart(2, '0');
	}

	function dollars(amount) {
		return `$${Math.round(amount).toLocaleString('en-US')}`;
	}

	function compact(amount) {
		if (amount >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`;
		return amount >= 1000 ? `$${Math.round(amount / 1000)}k` : dollars(amount);
	}

	function companyCount(count) {
		return count === 1 ? '1 company' : `${count} companies`;
	}

	function customerCount(count) {
		return `${count} ${count === 1 ? 'customer' : 'customers'}`;
	}

	/* Lookups, links and the shared services from basalt.js. */

	function cloneRecord(record) {
		return { ...record, people: [...record.people], deals: [...record.deals], activity: [...record.activity] };
	}

	function findRecord(id) {
		return book.find((record) => record.id === id);
	}

	function tierOf(id) {
		return catalog.tiers.find((tier) => tier.id === id);
	}

	function sectorOf(id) {
		return catalog.sectors.find((sector) => sector.id === id);
	}

	function recordUrl(record) {
		return `company-details.html?id=${encodeURIComponent(record.id)}`;
	}

	function part(key) {
		return pick(`[data-co-d="${key}"]`, quick);
	}

	function initialsOf(wholeName) {
		return wholeName
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0])
			.join('')
			.toUpperCase();
	}

	/* A name always hashes to the same of eight avatar tones. */
	function toneFor(name) {
		const lower = name.toLowerCase();
		let digest = 0;
		for (let index = 0; index < lower.length; index += 1) digest = (digest * 31 + lower.charCodeAt(index)) >>> 0;
		return (digest % 8) + 1;
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (char) => entities[char]);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function speak(message) {
		window.Basalt.announce?.(message);
	}

	function later(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	start();
})();
