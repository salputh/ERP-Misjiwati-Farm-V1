/**
 * Deals (deals.html). Every deal on its way to a signed contract. The top
 * card is the quarter's target: what is signed, what is out for signature
 * and what is in negotiation, whether signing is ahead of pace, and a nudge
 * for deals past their close date. Below it, one list in four tabs (open,
 * past close date, signed, lost). A row, its company name or the expand
 * icon opens the deal's own page; the panel icon opens a quick view in a
 * drawer (where it stands, what it covers, the people, its history) that
 * walks to the next deal with Alt and the arrow keys.
 *
 * To run it on your own deals, have assets/basalt/js/data/multipurpose/deals.js return your
 * records in the same shape (every figure, count, bar and list is worked
 * out from them) and fill in the `server` object below: each method is
 * where one change reaches your backend. The page updates first and puts
 * things back, with an error toast, if the call fails. Shared parts come
 * from basalt.js: tabs, styled selects, the segmented control, choice
 * cards, the record drawer, pagination, toasts with undo and empty states.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-dls-root]');
	if (!pageRoot) return;

	/* The fixture, shared with Deal Details, the Deal Pipeline and Quotes.
     A deal's yearly value is the sum of its lines; one-off lines such as
     training sit with the deal but outside that value. "Today" is the
     demo's date; a real app reads the clock. */
	const SOURCE = window.Basalt.data.deals;
	const FIXTURE = {
		todayIso: SOURCE.today,
		signedIn: 'John Armstrong',
		quarter: { name: 'Q4', start: '2026-10-01', end: '2026-12-31', target: 250000 },
		stages: SOURCE.stages,
		plans: ['starter', 'growth', 'enterprise'].map((id) => ({
			id,
			sku: SOURCE.planSku[id],
			name: SOURCE.products[SOURCE.planSku[id]].name.replace(' plan', ''),
			price: SOURCE.products[SOURCE.planSku[id]].month,
		})),
		addons: ['FL-ROUTE', 'FL-PORTAL'].map((sku) => ({
			id: sku,
			name: SOURCE.products[sku].name,
			price: SOURCE.products[sku].month,
		})),
		owners: SOURCE.owners,
		lostReasons: SOURCE.lostReasons,
		seed: SOURCE.list(),
	};
	const CATALOG = SOURCE.products;
	const annualValue = SOURCE.yearly;
	const ownerLink = SOURCE.ownerUrl;

	/* Each method is where a change reaches your backend. The demo answers
     after a short pause, as a real request would. */
	const server = {
		create(deal) {
			return pause(250);
		},
		moveTo(id, stage) {
			return pause(250);
		},
		markLost(id, reason) {
			return pause(250);
		},
		reopen(id, stage) {
			return pause(250);
		},
	};

	const DAY_MS = 86400000;
	const PAGE_SIZE = 10;
	const SEARCH_DELAY = 120;
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	const HISTORY_ICON = {
		envelope: 'bi-envelope',
		chat: 'bi-chat-left-text',
		calendar: 'bi-calendar-event',
		check: 'bi-check2-circle',
		display: 'bi-display',
		pen: 'bi-pen',
		eye: 'bi-eye',
		arrow: 'bi-arrow-right-circle',
		x: 'bi-x-circle',
	};
	const SAVE_FAILED = 'Nothing was saved. Try again in a moment.';
	/* The target band, in the order a deal moves. Only deals that close
     inside the quarter count. */
	const BAND_PARTS = [
		{ id: 'signed', name: 'Signed', tone: 'signed' },
		{ id: 'signature', name: 'Out for signature', tone: 'signature' },
		{ id: 'negotiation', name: 'In negotiation', tone: 'negotiation' },
	];
	const DEFAULT_CLOSE = '2026-12-15';

	const todayDate = asDate(FIXTURE.todayIso);
	const book = FIXTURE.seed.map((deal) => ({ ...deal, history: [...deal.history] }));
	const listState = { tab: 'open', query: '', owner: '', dealKind: '', sortBy: 'date', direction: 'asc', page: 1 };
	let onScreen = [];
	let ui = null;
	let pageControl = null;
	let bandAnimated = false;
	let searchDelay = 0;
	let candidate = null;
	let walkList = [];
	let walker = null;
	let showing = null;

	/**
	 * Collects the page's nodes, fills the selects and chip lists that come
	 * from the fixture, wires every control, then draws the page.
	 */
	function start() {
		ui = collectNodes();
		fillOwnerFilter();
		fillLostReasons();
		fillNewDealForm();

		wireList();
		wireExport();
		wireChanges();
		wireDrawer();
		wireNewDeal();

		paintAll();
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function collectNodes() {
		const drawerNode = document.getElementById('dl-drawer');
		const lostDialog = document.getElementById('dl-lost');
		const newDialog = document.getElementById('dl-new');
		const inPage = (selector) => pick(selector, pageRoot);
		return {
			tabs: inPage('[data-dls-views]'),
			search: inPage('[data-dls-search]'),
			ownerFilter: inPage('[data-dls-owner]'),
			kindFilter: inPage('[data-dls-type]'),
			summary: inPage('[data-dls-summary]'),
			tableWrap: inPage('[data-dls-table-wrap]'),
			rows: inPage('[data-dls-body]'),
			dateHead: inPage('[data-dls-date-head]'),
			empty: inPage('[data-dls-noresults]'),
			emptyTitle: inPage('[data-dls-noresults-title]'),
			emptyText: inPage('[data-dls-noresults-text]'),
			clearButton: inPage('[data-dls-clear]'),
			pagerWrap: inPage('[data-dls-pager-wrap]'),
			pagerList: inPage('[data-dls-pager]'),
			pagerMeta: inPage('[data-dls-pager-meta]'),
			targetTitle: inPage('[data-dls-target-title]'),
			targetDesc: inPage('[data-dls-target-desc]'),
			targetSigned: inPage('[data-dls-target-signed]'),
			targetOf: inPage('[data-dls-target-of]'),
			targetNote: inPage('[data-dls-target-note]'),
			pace: inPage('[data-dls-pace]'),
			lateNudge: inPage('[data-dls-late]'),
			lateText: inPage('[data-dls-late-text]'),
			band: inPage('[data-dls-band]'),
			bandTrack: inPage('[data-dls-band-track]'),
			bandGoal: inPage('[data-dls-band-goal]'),
			bandKey: inPage('[data-dls-band-key]'),
			exportButton: inPage('[data-dls-export]'),
			newButton: inPage('[data-dls-new]'),
			drawerNode,
			drawerTitle: pick('#dl-drawer-title', drawerNode),
			drawerNav: pick('.basalt-drawer-nav', drawerNode),
			lostDialog,
			lostForm: pick('[data-dls-lost-form]', lostDialog),
			lostTitle: pick('[data-dls-lost-title]', lostDialog),
			lostReasons: pick('[data-dls-lost-reasons]', lostDialog),
			newDialog,
			newForm: pick('[data-dls-new-form]', newDialog),
			company: pick('[data-dls-new-company]', newDialog),
			companyError: pick('[data-dls-new-company-error]', newDialog),
			city: pick('[data-dls-new-city]', newDialog),
			customer: pick('[data-dls-new-customer]', newDialog),
			plans: pick('[data-dls-new-plans]', newDialog),
			seats: pick('[data-dls-new-seats]', newDialog),
			addons: pick('[data-dls-new-addons]', newDialog),
			closeDate: pick('[data-dls-new-close]', newDialog),
			owner: pick('[data-dls-new-owner]', newDialog),
			estimate: pick('[data-dls-new-sum]', newDialog),
		};
	}

	function countNode(tab) {
		return pick(`[data-dls-count="${tab}"]`, pageRoot);
	}

	function drawerSlot(name) {
		return pick(`[data-dls-d="${name}"]`, ui.drawerNode);
	}

	function htmlSafe(value) {
		return `${value ?? ''}`.replace(/[&<>"']/g, (mark) => ESCAPES[mark]);
	}

	function notify(message) {
		return window.Basalt.toasts?.push(message) ?? null;
	}

	function sayAloud(text) {
		window.Basalt.announce?.(text);
	}

	function syncSelect(field) {
		window.Basalt.select?.refresh?.(field);
	}

	function pause(ms) {
		return new Promise((done) => setTimeout(done, ms));
	}

	/* Money, dates and words. */
	function dollars(amount) {
		return `$${Math.round(amount).toLocaleString('en-US')}`;
	}

	function compactDollars(amount) {
		if (amount >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`;
		if (amount >= 10000) return `$${Math.round(amount / 1000)}k`;
		if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
		return dollars(amount);
	}

	function asDate(iso) {
		return new Date(`${iso}T00:00:00`);
	}

	function longDate(iso) {
		const moment = asDate(iso);
		return `${MONTH_ABBR[moment.getMonth()]} ${moment.getDate()}, ${moment.getFullYear()}`;
	}

	function shortDate(iso) {
		const moment = asDate(iso);
		return `${MONTH_ABBR[moment.getMonth()]} ${moment.getDate()}`;
	}

	function daysAway(iso) {
		return Math.round((asDate(iso) - todayDate) / DAY_MS);
	}

	function countOf(number, one, many) {
		return `${number} ${number === 1 ? one : many || `${one}s`}`;
	}

	function dueWording(days) {
		if (days === 0) return 'today';
		if (days === 1) return 'tomorrow';
		if (days === -1) return '1 day late';
		if (days < 0) return `${-days} days late`;
		if (days < 45) return `in ${days} days`;
		return `in ${Math.round(days / 30.4)} months`;
	}

	function monogram(name) {
		return name
			.replace(/&/g, ' ')
			.split(/\s+/)
			.filter(Boolean)
			.map((word) => word[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	/** The same name always lands on the same hue, 1 to 8. */
	function hueFor(name) {
		const lower = name.toLowerCase();
		let rolling = 0;
		for (let at = 0; at < lower.length; at += 1) rolling = (rolling * 31 + lower.charCodeAt(at)) >>> 0;
		return (rolling % 8) + 1;
	}

	/* Deals and stages. */
	function stageById(id) {
		return FIXTURE.stages.find((stage) => stage.id === id);
	}

	function stageIndex(id) {
		return FIXTURE.stages.findIndex((stage) => stage.id === id);
	}

	function stillOpen(deal) {
		return deal.stage !== 'signed' && deal.stage !== 'lost';
	}

	function pastDue(deal) {
		return stillOpen(deal) && daysAway(deal.closes) < 0;
	}

	function insideQuarter(iso) {
		return iso >= FIXTURE.quarter.start && iso <= FIXTURE.quarter.end;
	}

	function dealById(id) {
		return book.find((deal) => deal.id === id);
	}

	function customerLink(deal) {
		return `company-details.html?id=${encodeURIComponent(deal.acct)}`;
	}

	function dealLink(deal) {
		return `deal-details.html?id=${encodeURIComponent(deal.id)}`;
	}

	function belongsTo(deal, tab) {
		if (tab === 'open') return stillOpen(deal);
		if (tab === 'late') return pastDue(deal);
		return deal.stage === tab;
	}

	/** The date a row is about: the expected close, or when it was signed or lost. */
	function keyDate(deal) {
		if (deal.stage === 'signed') return deal.signed;
		if (deal.stage === 'lost') return deal.lost;
		return deal.closes;
	}

	function passesFilters(deal) {
		if (!belongsTo(deal, listState.tab)) return false;
		if (listState.owner && deal.owner !== listState.owner) return false;
		if (listState.dealKind && (deal.kind === 'new' ? 'new' : 'expansion') !== listState.dealKind) return false;
		if (!listState.query) return true;
		const haystack = [
			deal.company,
			deal.title,
			deal.city,
			deal.owner,
			deal.id,
			...deal.people.map((person) => person.name),
		].join(' ');
		if (window.Basalt?.matchesQuery) return window.Basalt.matchesQuery(haystack, listState.query);
		return haystack.toLowerCase().includes(listState.query.toLowerCase());
	}

	function ordered(deals) {
		const flip = listState.direction === 'asc' ? 1 : -1;
		const rank = {
			name: (deal) => deal.company.toLowerCase(),
			value: (deal) => annualValue(deal),
			date: (deal) => keyDate(deal),
		}[listState.sortBy];
		return [...deals].sort((a, b) =>
			rank(a) < rank(b) ? -flip : rank(a) > rank(b) ? flip : a.company.localeCompare(b.company),
		);
	}

	/* Painting: the tab counts, the target card, the list. */
	function paintAll() {
		for (const paint of [paintCounts, paintTarget, paintList]) paint();
	}

	function paintCounts() {
		for (const tab of ['open', 'late', 'signed', 'lost'])
			countNode(tab).textContent = book.filter((deal) => belongsTo(deal, tab)).length;
	}

	function paintTarget() {
		const quarter = FIXTURE.quarter;
		const bandSums = BAND_PARTS.map((part) => {
			const inside = book.filter(
				(deal) => deal.stage === part.id && insideQuarter(part.id === 'signed' ? deal.signed : deal.closes),
			);
			return { part, howMany: inside.length, sum: inside.reduce((total, deal) => total + annualValue(deal), 0) };
		});
		const signed = bandSums[0].sum;
		const reach = bandSums.reduce((total, entry) => total + entry.sum, 0);
		const proposals = book
			.filter((deal) => deal.stage === 'proposal' && insideQuarter(deal.closes))
			.reduce((total, deal) => total + annualValue(deal), 0);
		const daysLeft = Math.max(0, daysAway(quarter.end));
		const scale = Math.max(quarter.target, reach);

		ui.targetTitle.textContent = `${quarter.name} target`;
		ui.targetDesc.textContent = `New yearly revenue signed, ${countOf(daysLeft, 'day')} to go.`;
		/* Pace is where signing would stand today if the target came in evenly over the quarter. */
		const quarterDays = Math.round((asDate(quarter.end) - asDate(quarter.start)) / DAY_MS) + 1;
		const pace = quarter.target * Math.min(1, (quarterDays - daysLeft) / quarterDays);
		const ahead = signed >= pace;
		ui.pace.className = `dls-target-pace ${ahead ? 'is-ahead' : 'is-behind'}`;
		ui.pace.innerHTML = `<i class="bi ${ahead ? 'bi-graph-up-arrow' : 'bi-hourglass-split'}" aria-hidden="true"></i>${ahead ? 'Ahead of pace' : 'Behind pace'}<span class="visually-hidden">: ${compactDollars(pace)} would be on pace today.</span>`;
		ui.targetSigned.textContent = compactDollars(signed);
		ui.targetOf.textContent = `of ${compactDollars(quarter.target)} signed`;
		ui.targetNote.innerHTML =
			reach >= quarter.target
				? 'Signing what is out for signature and in negotiation passes the target.'
				: `Signing all of it reaches <strong>${Math.round((reach / quarter.target) * 100)}%</strong>. Proposals closing this quarter add ${compactDollars(proposals)} more.`;

		ui.bandTrack.innerHTML = bandSums
			.map(
				(entry) =>
					`<span class="dls-band-part dls-tone-${entry.part.tone}" style="--w:${((entry.sum / scale) * 100).toFixed(2)}%"></span>`,
			)
			.join('');
		ui.bandGoal.style.setProperty('--at', `${((quarter.target / scale) * 100).toFixed(2)}%`);
		ui.bandGoal.textContent = `Target ${compactDollars(quarter.target)}`;
		ui.band.setAttribute(
			'aria-label',
			`${compactDollars(signed)} signed, ${compactDollars(bandSums[1].sum)} out for signature and ${compactDollars(bandSums[2].sum)} in negotiation, against a target of ${compactDollars(quarter.target)}.`,
		);
		ui.bandKey.innerHTML = bandSums
			.map(
				(entry) =>
					`<li class="dls-key dls-tone-${entry.part.tone}"><span class="dls-key-dot" aria-hidden="true"></span><span class="dls-key-text"><span class="dls-key-name">${htmlSafe(entry.part.name)}</span><span class="dls-sub"><span class="dls-key-amt">${compactDollars(entry.sum)}</span> · ${countOf(entry.howMany, 'deal')}</span></span></li>`,
			)
			.join('');

		const lateDeals = book.filter(pastDue);
		ui.lateNudge.hidden = !lateDeals.length;
		ui.lateText.textContent = `${countOf(lateDeals.length, 'deal')} past ${lateDeals.length === 1 ? 'its' : 'their'} close date`;
		/* The bars grow in once, on the first paint; later changes slide. */
		if (bandAnimated) return;
		bandAnimated = true;
		ui.band.classList.add('is-start');
		requestAnimationFrame(() => requestAnimationFrame(() => ui.band.classList.remove('is-start')));
	}

	/* Pieces of a row. */
	function tileMarkup(deal, extraClass) {
		return `<span class="dls-logo dls-tone-${hueFor(deal.company)}${extraClass ? ` ${extraClass}` : ''}" aria-hidden="true">${htmlSafe(monogram(deal.company))}</span>`;
	}

	function avatarMarkup(name, sizeClass = 'basalt-avatar-xs') {
		return `<span class="basalt-avatar ${sizeClass} basalt-avatar-tone-${hueFor(name)}" aria-hidden="true">${htmlSafe(monogram(name))}</span>`;
	}

	function stageMarkup(id) {
		return `<span class="dls-stage dls-tone-${id}">${htmlSafe(id === 'lost' ? 'Lost' : stageById(id).name)}</span>`;
	}

	function whatLine(deal) {
		return `${deal.kind === 'new' ? 'New customer · ' : ''}${deal.title}`;
	}

	function dateMarkup(deal) {
		if (deal.stage === 'signed')
			return `<span class="dls-cell-main"><span class="dls-phone-label">Signed </span>${longDate(deal.signed)}</span><span class="dls-sub">by ${htmlSafe(deal.people[0].name)}</span>`;
		if (deal.stage === 'lost')
			return `<span class="dls-cell-main"><span class="dls-phone-label">Lost </span>${longDate(deal.lost)}</span><span class="dls-sub">${htmlSafe(deal.reason)}</span>`;
		const untilClose = daysAway(deal.closes);
		const urgency = untilClose < 0 ? ' dls-due-late' : untilClose <= 14 ? ' dls-due-near' : '';
		return `<span class="dls-cell-main"><span class="dls-phone-label">Closes </span>${longDate(deal.closes)}</span><span class="dls-sub dls-due${urgency}">${dueWording(untilClose)}</span>`;
	}

	function menuMarkup(deal) {
		const menuLines = [];
		if (deal.customer)
			menuLines.push(
				`<li><a class="dropdown-item" href="${customerLink(deal)}"><i class="bi bi-person-vcard" aria-hidden="true"></i>Customer page</a></li>`,
			);
		if (deal.stage === 'signed')
			menuLines.push(
				'<li><a class="dropdown-item" href="invoice-details.html"><i class="bi bi-receipt" aria-hidden="true"></i>First invoice</a></li>',
			);
		if (stillOpen(deal)) {
			const nextStage = FIXTURE.stages[stageIndex(deal.stage) + 1];
			const signing = nextStage.id === 'signed';
			menuLines.push('<li><hr class="dropdown-divider"></li>');
			menuLines.push(
				`<li><button type="button" class="dropdown-item" data-dls-advance="${htmlSafe(deal.id)}"><i class="bi ${signing ? 'bi-pen' : 'bi-arrow-right-circle'}" aria-hidden="true"></i>${signing ? 'Mark as signed' : `Move to ${htmlSafe(nextStage.name)}`}</button></li>`,
			);
			menuLines.push(
				`<li><button type="button" class="dropdown-item dls-danger-item" data-dls-lose="${htmlSafe(deal.id)}"><i class="bi bi-x-circle" aria-hidden="true"></i>Mark as lost</button></li>`,
			);
		}
		if (deal.stage === 'lost')
			menuLines.push(
				`<li><button type="button" class="dropdown-item" data-dls-reopen="${htmlSafe(deal.id)}"><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>Reopen</button></li>`,
			);
		return menuLines.join('');
	}

	function rowMarkup(deal) {
		const companyName = htmlSafe(deal.company);
		const dealCell = `<td class="dls-col-deal"><div class="dls-org">${tileMarkup(deal)}<div class="dls-org-text"><a class="dls-org-name" href="${dealLink(deal)}">${companyName}</a><span class="dls-sub">${htmlSafe(whatLine(deal))}</span><span class="dls-stage-fold">${stageMarkup(deal.stage)}</span><span class="dls-fold">${avatarMarkup(deal.owner)}${htmlSafe(deal.owner)}</span></div></div></td>`;
		const rowActions = `<div class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-dls-open="${htmlSafe(deal.id)}" aria-label="Quick view: ${companyName}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${dealLink(deal)}" aria-label="Open full page: ${companyName}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a><div class="dropdown"><button type="button" class="btn btn-icon dls-menu-btn" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Actions for ${companyName}"><i class="bi bi-three-dots" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end">${menuMarkup(deal)}</ul></div></div>`;
		return `<tr class="dls-row" data-dls-row="${htmlSafe(deal.id)}">${dealCell}<td class="dls-col-stage">${stageMarkup(deal.stage)}</td><td class="dls-col-value"><span class="dls-cell-main">${dollars(annualValue(deal))}<span class="dls-phone-label"> a year</span></span></td><td class="dls-col-date">${dateMarkup(deal)}</td><td class="dls-col-owner"><a class="dls-owner" href="${ownerLink(deal.owner)}">${avatarMarkup(deal.owner)}<span>${htmlSafe(deal.owner)}</span></a></td><td class="dls-col-menu">${rowActions}</td></tr>`;
	}

	function paintSortHeads() {
		for (const heading of pickAll('[data-dls-th]', pageRoot)) {
			const isSorted = heading.dataset.dlsTh === listState.sortBy;
			if (isSorted) heading.setAttribute('aria-sort', listState.direction === 'asc' ? 'ascending' : 'descending');
			else heading.removeAttribute('aria-sort');
			pick('.bi', heading).className =
				`bi ${isSorted ? (listState.direction === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down') : 'bi-arrow-down-up dls-sort-idle'}`;
		}
		ui.dateHead.textContent = { signed: 'Signed', lost: 'Lost' }[listState.tab] || 'Closes';
	}

	function paintEmptyState() {
		const narrowed = listState.owner || listState.dealKind;
		if (!listState.query && !narrowed && listState.tab === 'late') {
			ui.emptyTitle.textContent = 'Nothing past its close date';
			ui.emptyText.textContent = 'Every open deal is still inside its expected close date.';
			return;
		}
		ui.emptyTitle.textContent = 'No deal matches';
		ui.emptyText.textContent = listState.query
			? `Nothing matches “${listState.query}”${narrowed ? ' with these filters' : ' in this view'}. Try another spelling${narrowed ? ', or clear the filters.' : '.'}`
			: 'No deal in this view fits these filters. Clear one to see more.';
	}

	function paintList() {
		onScreen = ordered(book.filter(passesFilters));
		const pageCount = Math.max(1, Math.ceil(onScreen.length / PAGE_SIZE));
		if (listState.page > pageCount) listState.page = pageCount;
		const offset = (listState.page - 1) * PAGE_SIZE;
		const onPage = onScreen.slice(offset, offset + PAGE_SIZE);

		const nothing = !onScreen.length;
		ui.empty.hidden = !nothing;
		ui.tableWrap.hidden = nothing;
		if (nothing) paintEmptyState();
		ui.clearButton.hidden = !listState.query && !listState.owner && !listState.dealKind;
		ui.rows.innerHTML = onPage.map(rowMarkup).join('');
		window.Basalt.tips?.(ui.rows);
		const yearlyTotal = onScreen.reduce((total, deal) => total + annualValue(deal), 0);
		ui.summary.textContent = onScreen.length
			? `${countOf(onScreen.length, 'deal')} · ${compactDollars(yearlyTotal)} a year`
			: '';

		ui.pagerWrap.hidden = onScreen.length <= PAGE_SIZE;
		ui.pagerMeta.innerHTML = `<strong>${offset + 1}–${Math.min(offset + PAGE_SIZE, onScreen.length)}</strong> of ${countOf(onScreen.length, 'deal')}`;
		if (window.Basalt.pagination && onScreen.length > PAGE_SIZE) {
			if (!pageControl) {
				pageControl = window.Basalt.pagination(ui.pagerList, {
					total: pageCount,
					current: listState.page,
					label: 'Deals page',
					onChange(number) {
						if (number === listState.page) return;
						listState.page = number;
						paintList();
					},
				});
			} else {
				pageControl.setTotal(pageCount);
				if (pageControl.get() !== listState.page) pageControl.set(listState.page);
			}
		}
		paintSortHeads();
	}

	/* Tabs, search, filters and sorting. */
	function chooseTab(tab) {
		const radio = document.getElementById(`dls-view-${tab}`);
		if (!radio || radio.checked) return;
		radio.checked = true;
		radio.dispatchEvent(new Event('change', { bubbles: true }));
	}

	function clearFilters() {
		ui.search.value = '';
		listState.query = '';
		listState.owner = '';
		listState.dealKind = '';
		ui.ownerFilter.value = '';
		ui.kindFilter.value = '';
		syncSelect(ui.ownerFilter);
		syncSelect(ui.kindFilter);
	}

	function fillOwnerFilter() {
		ui.ownerFilter.innerHTML = `<option value="" selected>Every owner</option>${FIXTURE.owners.map((owner) => `<option value="${htmlSafe(owner)}">${htmlSafe(owner)}</option>`).join('')}`;
		syncSelect(ui.ownerFilter);
	}

	function wireList() {
		ui.tabs.addEventListener('change', (event) => {
			if (event.target.name !== 'dls-view') return;
			listState.tab = event.target.value;
			/* Signed and lost read newest first; open deals soonest first. */
			if (listState.sortBy === 'date')
				listState.direction = listState.tab === 'signed' || listState.tab === 'lost' ? 'desc' : 'asc';
			listState.page = 1;
			paintList();
		});
		ui.lateNudge.addEventListener('click', () => {
			chooseTab('late');
			const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			document.getElementById('dls-list').scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
			document.getElementById('dls-view-late').focus({ preventScroll: true });
		});
		ui.search.addEventListener('input', () => {
			clearTimeout(searchDelay);
			searchDelay = setTimeout(() => {
				listState.query = ui.search.value.trim();
				listState.page = 1;
				paintList();
			}, SEARCH_DELAY);
		});
		ui.ownerFilter.addEventListener('change', () => {
			listState.owner = ui.ownerFilter.value;
			listState.page = 1;
			paintList();
		});
		ui.kindFilter.addEventListener('change', () => {
			listState.dealKind = ui.kindFilter.value;
			listState.page = 1;
			paintList();
		});
		ui.clearButton.addEventListener('click', () => {
			clearFilters();
			listState.page = 1;
			paintList();
			ui.search.focus();
		});
		pageRoot.addEventListener('click', (event) => {
			const button = event.target.closest('[data-dls-sort-by]');
			if (!button) return;
			const column = button.dataset.dlsSortBy;
			if (listState.sortBy === column) {
				listState.direction = listState.direction === 'asc' ? 'desc' : 'asc';
			} else {
				listState.sortBy = column;
				listState.direction = column === 'value' ? 'desc' : 'asc';
			}
			listState.page = 1;
			paintList();
		});
	}

	/* Export: every deal as CSV, downloaded on the spot. */
	function csvCell(value) {
		return `"${String(value).replace(/"/g, '""')}"`;
	}

	function wireExport() {
		ui.exportButton.addEventListener('click', () => {
			const columnNames = [
				'Deal',
				'Company',
				'Kind',
				'What',
				'Stage',
				'Yearly value',
				'Expected close',
				'Signed',
				'Lost',
				'Owner',
			];
			const csvLines = book.map((deal) => [
				deal.id,
				deal.company,
				deal.kind === 'new' ? 'New customer' : 'Expansion',
				deal.title,
				deal.stage === 'lost' ? 'Lost' : stageById(deal.stage).name,
				annualValue(deal),
				deal.closes,
				deal.signed || '',
				deal.lost || '',
				deal.owner,
			]);
			const csvBlob = new Blob(
				[[columnNames, ...csvLines].map((line) => line.map(csvCell).join(',')).join('\r\n')],
				{ type: 'text/csv' },
			);
			const anchor = document.createElement('a');
			anchor.href = URL.createObjectURL(csvBlob);
			anchor.download = 'deals.csv';
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
			notify({ tone: 'success', icon: 'bi-download', title: `Exported ${countOf(book.length, 'deal')}` });
		});
	}

	/* Moving a deal on, losing it, reopening it. Every change is undoable
     from its toast, and is undone for the reader if the server says no. */
	function remember(deal) {
		return {
			stage: deal.stage,
			signed: deal.signed,
			lost: deal.lost,
			reason: deal.reason,
			lostFrom: deal.lostFrom,
			history: [...deal.history],
		};
	}

	function putBack(deal, memory) {
		return Object.assign(deal, memory);
	}

	/** The drawer's footer is redrawn after a change; focus that sat on one of its buttons moves to the deal's name rather than the page. */
	function refillDrawer(deal) {
		const hadFocus = ui.drawerNode.contains(document.activeElement);
		paintDrawer(deal);
		if (hadFocus && !ui.drawerNode.contains(document.activeElement)) ui.drawerTitle.focus();
	}

	function afterChange(deal, memory, title, icon) {
		paintAll();
		if (showing === deal) refillDrawer(deal);

		function undo() {
			putBack(deal, memory);
			paintAll();
			if (showing === deal) paintDrawer(deal);
			sayAloud(`${deal.company} is back where it was.`);
		}

		notify({ tone: 'success', icon, title, duration: 8000, actions: [{ label: 'Undo', onClick: undo }] });
		return undo;
	}

	function moveOn(id) {
		const record = dealById(id);
		if (!record || !stillOpen(record)) return;
		const memory = remember(record);
		const nextStage = FIXTURE.stages[stageIndex(record.stage) + 1];
		const signing = nextStage.id === 'signed';
		record.stage = nextStage.id;
		if (signing) {
			record.signed = FIXTURE.todayIso;
			record.history.unshift([FIXTURE.todayIso, FIXTURE.signedIn, 'Marked the contract as signed.', 'pen']);
		} else {
			record.history.unshift([
				FIXTURE.todayIso,
				FIXTURE.signedIn,
				`Moved it to ${nextStage.name}.`,
				nextStage.id === 'signature' ? 'pen' : 'arrow',
			]);
		}
		const undo = afterChange(
			record,
			memory,
			signing ? `${record.company} signed` : `${record.company} moved to ${nextStage.name}`,
			signing ? 'bi-pen' : 'bi-arrow-right-circle',
		);
		server.moveTo(record.id, record.stage).catch(() => {
			undo();
			notify({ tone: 'danger', title: 'The deal didn’t move', text: SAVE_FAILED });
		});
	}

	function bringBack(id) {
		const record = dealById(id);
		if (!record || record.stage !== 'lost') return;
		const memory = remember(record);
		record.stage = record.lostFrom || 'discovery';
		record.history.unshift([
			FIXTURE.todayIso,
			FIXTURE.signedIn,
			`Reopened it in ${stageById(record.stage).name}.`,
			'arrow',
		]);
		delete record.lost;
		delete record.reason;
		const undo = afterChange(record, memory, `${record.company} reopened`, 'bi-arrow-counterclockwise');
		server.reopen(record.id, record.stage).catch(() => {
			undo();
			notify({ tone: 'danger', title: 'Couldn’t reopen it', text: SAVE_FAILED });
		});
	}

	function fillLostReasons() {
		ui.lostReasons.innerHTML = FIXTURE.lostReasons
			.map(
				(reason, slot) =>
					`<input type="radio" class="btn-check" name="dls-lost-reason" id="dl-lost-r-${slot}" value="${htmlSafe(reason)}"${slot === 0 ? ' checked' : ''}><label class="dls-chip" for="dl-lost-r-${slot}">${htmlSafe(reason)}</label>`,
			)
			.join('');
	}

	function askReason(id) {
		candidate = dealById(id);
		if (!candidate) return;
		ui.lostTitle.textContent = `Mark ${candidate.company} as lost?`;
		ui.lostForm.reset();
		window.bootstrap.Modal.getOrCreateInstance(ui.lostDialog).show();
	}

	function confirmLost(event) {
		event.preventDefault();
		const record = candidate;
		if (!record) return;
		const whyLost = pick('input[name="dls-lost-reason"]:checked', ui.lostDialog)?.value || FIXTURE.lostReasons[0];
		const memory = remember(record);
		record.lostFrom = record.stage;
		record.stage = 'lost';
		record.lost = FIXTURE.todayIso;
		record.reason = whyLost;
		record.history.unshift([FIXTURE.todayIso, FIXTURE.signedIn, `Marked as lost: ${whyLost.toLowerCase()}.`, 'x']);
		window.bootstrap.Modal.getOrCreateInstance(ui.lostDialog).hide();
		const undo = afterChange(record, memory, `${record.company} marked as lost`, 'bi-x-circle');
		server.markLost(record.id, whyLost).catch(() => {
			undo();
			notify({ tone: 'danger', title: 'Couldn’t mark it as lost', text: SAVE_FAILED });
		});
	}

	/** The three change buttons live in row menus and in the drawer's footer; this serves both. */
	function changeClick(event) {
		const forward = event.target.closest('[data-dls-advance]');
		if (forward) {
			moveOn(forward.dataset.dlsAdvance);
			return;
		}
		const lose = event.target.closest('[data-dls-lose]');
		if (lose) {
			askReason(lose.dataset.dlsLose);
			return;
		}
		const reopen = event.target.closest('[data-dls-reopen]');
		if (reopen) bringBack(reopen.dataset.dlsReopen);
	}

	function wireChanges() {
		ui.lostForm.addEventListener('submit', confirmLost);
		pageRoot.addEventListener('click', changeClick);
	}

	/* The drawer: one deal in full, stepping through the list as shown. */
	function leadMarkup(deal) {
		const valueLine = `<strong>${dollars(annualValue(deal))}</strong> a year`;
		if (deal.stage === 'signed')
			return `${valueLine}, signed by ${htmlSafe(deal.people[0].name)} on ${longDate(deal.signed)}.`;
		if (deal.stage === 'lost')
			return `${valueLine}, lost on ${longDate(deal.lost)}: ${htmlSafe(deal.reason.toLowerCase())}.`;
		const untilClose = daysAway(deal.closes);
		return `${valueLine}, closes ${longDate(deal.closes)}${untilClose < 0 ? `, <span class="dls-due-late">${dueWording(untilClose)}</span>.` : `, ${dueWording(untilClose)}.`}`;
	}

	/** Lost deals show how far they got before they were lost. */
	function stepsMarkup(deal) {
		const reached = stageIndex(deal.stage === 'lost' ? deal.lostFrom : deal.stage);
		const stepCount = FIXTURE.stages.length;
		const caption =
			deal.stage === 'lost'
				? `Lost at ${stageById(deal.lostFrom).name}`
				: deal.stage === 'signed'
					? 'Every step done'
					: `Step ${reached + 1} of ${stepCount}`;
		const chance = stillOpen(deal) ? `, ${stageById(deal.stage).chance}% likely` : '';
		const blocks = FIXTURE.stages
			.map((stage, slot) => `<span class="basalt-segments-block${slot <= reached ? ' is-on' : ''}"></span>`)
			.join('');
		return `<p class="dls-steps-label">${stageMarkup(deal.stage)}<span class="dls-sub">${htmlSafe(caption)}${chance}</span></p><div class="basalt-segments dls-steps-bar${deal.stage === 'lost' ? ' is-lost' : ''}" aria-hidden="true">${blocks}</div>`;
	}

	/** Seats are billed for ten months a year, add-ons for all twelve. */
	function itemsMarkup(deal) {
		const yearlyLines = deal.lines
			.map(([sku, quantity]) => {
				const product = CATALOG[sku];
				return `<li class="dls-item"><span class="dls-item-what">${htmlSafe(product.name.replace(' plan', ' seats'))}<span class="dls-sub">${quantity.toLocaleString('en-US')} × $${product.month} × ${product.months} months</span></span><span class="dls-item-amt">${dollars(quantity * product.price)}</span></li>`;
			})
			.join('');
		const totalLine = `<li class="dls-item dls-item-total"><span class="dls-item-what">A year</span><span class="dls-item-amt">${dollars(annualValue(deal))}</span></li>`;
		const onceLines = deal.oneOff
			.map(([sku, quantity]) => {
				const product = CATALOG[sku];
				return `<li class="dls-item dls-item-once"><span class="dls-item-what">${htmlSafe(product.name)}<span class="dls-sub">${quantity > 1 ? `${quantity} × ${dollars(product.price)}, ` : ''}one-off</span></span><span class="dls-item-amt">${dollars(quantity * product.price)}</span></li>`;
			})
			.join('');
		return yearlyLines + totalLine + onceLines;
	}

	function personMarkup(person) {
		const nameMarkup = person.key
			? `<a class="dls-person-name dls-link" href="person-details.html?id=${encodeURIComponent(person.key)}">${htmlSafe(person.name)}</a>`
			: `<span class="dls-person-name">${htmlSafe(person.name)}</span>`;
		return `<li class="dls-person">${avatarMarkup(person.name, 'basalt-avatar-sm')}<span class="dls-person-text">${nameMarkup}<span class="dls-sub">${htmlSafe(person.title)}</span></span><span class="dls-role">${htmlSafe(person.part)}</span></li>`;
	}

	function peopleMarkup(deal) {
		const ownerRow = `<li class="dls-person">${avatarMarkup(deal.owner, 'basalt-avatar-sm')}<span class="dls-person-text"><a class="dls-person-name dls-link" href="${ownerLink(deal.owner)}">${htmlSafe(deal.owner)}</a><span class="dls-sub">Fieldline</span></span><span class="dls-role">Owner</span></li>`;
		const moreRow = deal.customer
			? `<li class="dls-people-more"><a class="dls-link" href="${customerLink(deal)}">${htmlSafe(deal.company)} customer page<i class="bi bi-arrow-right ms-1" aria-hidden="true"></i></a></li>`
			: '';
		return deal.people.map(personMarkup).join('') + ownerRow + moreRow;
	}

	function historyMarkup(deal) {
		return deal.history
			.map(
				([when, who, what, icon]) =>
					`<li class="dls-act"><span class="dls-act-icon" aria-hidden="true"><i class="bi ${HISTORY_ICON[icon] || 'bi-dot'}"></i></span><span class="dls-act-text">${htmlSafe(what)}<span class="dls-sub">${htmlSafe(who)} · ${longDate(when)}</span></span></li>`,
			)
			.join('');
	}

	/** One main action; marking it lost waits behind the menu. */
	function footMarkup(deal) {
		if (deal.stage === 'signed')
			return '<a class="btn btn-primary" href="invoice-details.html"><i class="bi bi-receipt me-1" aria-hidden="true"></i>First invoice</a>';
		if (deal.stage === 'lost')
			return `<button type="button" class="btn btn-primary" data-dls-reopen="${htmlSafe(deal.id)}"><i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Reopen</button>`;
		const signingNext = stageIndex(deal.stage) === FIXTURE.stages.length - 2;
		return `<div class="dropdown dropup"><button type="button" class="btn btn-outline-secondary btn-square" data-bs-toggle="dropdown" aria-expanded="false" aria-label="More for ${htmlSafe(deal.company)}"><i class="bi bi-three-dots" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end"><li><button type="button" class="dropdown-item dls-danger-item" data-dls-lose="${htmlSafe(deal.id)}"><i class="bi bi-x-circle" aria-hidden="true"></i>Mark as lost</button></li></ul></div><button type="button" class="btn btn-primary" data-dls-advance="${htmlSafe(deal.id)}"><i class="bi ${signingNext ? 'bi-pen' : 'bi-arrow-right'} me-1" aria-hidden="true"></i>${signingNext ? 'Mark as signed' : 'Next stage'}</button>`;
	}

	function nextStepMarkup(deal) {
		const due = daysAway(deal.next[1]);
		const urgency = due < 0 ? ' dls-due-late' : due === 0 ? ' dls-due-near' : '';
		const when =
			due === 0 ? 'Due today' : due < 0 ? `Was due ${shortDate(deal.next[1])}` : `Due ${shortDate(deal.next[1])}`;
		return `<i class="bi bi-flag" aria-hidden="true"></i><span><strong>Next:</strong> ${htmlSafe(deal.next[0])}<span class="dls-sub${urgency}">${when}</span></span>`;
	}

	function paintDrawer(deal) {
		if (!deal) return;
		showing = deal;
		const badge = drawerSlot('logo');
		badge.className = `dls-logo dls-logo-lg dls-tone-${hueFor(deal.company)}`;
		badge.textContent = monogram(deal.company);
		drawerSlot('name').textContent = deal.company;
		drawerSlot('full').href = dealLink(deal);
		drawerSlot('sub').textContent = deal.city;
		drawerSlot('lead').innerHTML = leadMarkup(deal);
		drawerSlot('steps').innerHTML = stepsMarkup(deal);
		const nextStep = drawerSlot('next');
		const hasNext = stillOpen(deal) && Boolean(deal.next);
		nextStep.hidden = !hasNext;
		if (hasNext) nextStep.innerHTML = nextStepMarkup(deal);
		drawerSlot('items').innerHTML = itemsMarkup(deal);
		drawerSlot('people').innerHTML = peopleMarkup(deal);
		drawerSlot('history').innerHTML = historyMarkup(deal);
		drawerSlot('foot').innerHTML = footMarkup(deal);
	}

	function showDeal(id) {
		walkList = [...onScreen];
		let at = walkList.findIndex((deal) => deal.id === id);
		if (at < 0) {
			walkList = [dealById(id)];
			at = 0;
		}
		if (!walker && window.Basalt.drawer) {
			/* The count is read each time the drawer steps, so one binding
         serves the list at whatever length it has now. */
			walker = window.Basalt.drawer.recordNav(
				ui.drawerNode,
				{ valueOf: () => Math.max(1, walkList.length) },
				(slot) => paintDrawer(walkList[slot]),
			);
		}
		if (walker) walker.go(at, 0);
		else paintDrawer(walkList[at]);
		ui.drawerNav.hidden = walkList.length < 2;
		window.bootstrap.Offcanvas.getOrCreateInstance(ui.drawerNode).show();
	}

	/** A click anywhere on a row outside its own controls opens the deal's page (a new tab with Cmd/Ctrl or the middle button); the panel icon opens the quick view. */
	function rowClick(event) {
		const quickView = event.target.closest('[data-dls-open]');
		if (quickView) {
			showDeal(quickView.dataset.dlsOpen);
			return;
		}
		const row = event.target.closest('[data-dls-row]');
		if (!row || event.target.closest('a, button, input, .dropdown-menu')) return;
		const pageUrl = pick('.dls-org-name', row).href;
		if (event.metaKey || event.ctrlKey || event.button === 1) window.open(pageUrl, '_blank', 'noopener');
		else location.href = pageUrl;
	}

	function wireDrawer() {
		pageRoot.addEventListener('click', rowClick);
		pageRoot.addEventListener('auxclick', (event) => {
			if (event.button === 1 && !event.target.closest('button')) rowClick(event);
		});
		/* The lost dialog was opened from a footer button that has since been
       redrawn; focus goes back into the drawer rather than to the page. */
		ui.lostDialog.addEventListener('hidden.bs.modal', () => {
			if (ui.drawerNode.classList.contains('show') && !ui.drawerNode.contains(document.activeElement))
				ui.drawerTitle.focus();
		});
		ui.drawerNode.addEventListener('click', changeClick);
	}

	/* The new deal dialog. */
	function knownCustomers() {
		return [...new Set(book.filter((deal) => deal.customer).map((deal) => deal.company))].sort();
	}

	function fillNewDealForm() {
		ui.customer.innerHTML = knownCustomers()
			.map((company) => `<option>${htmlSafe(company)}</option>`)
			.join('');
		ui.owner.innerHTML = FIXTURE.owners
			.map((owner) => `<option${owner === FIXTURE.signedIn ? ' selected' : ''}>${htmlSafe(owner)}</option>`)
			.join('');
		ui.plans.innerHTML = FIXTURE.plans
			.map(
				(plan) =>
					`<label class="basalt-choice-card"><input class="basalt-choice-card-input" type="radio" name="dls-new-plan" value="${plan.id}"${plan.id === 'growth' ? ' checked' : ''}><span class="basalt-choice-card-mark" aria-hidden="true"><i class="bi bi-check-lg"></i></span><span class="basalt-choice-card-title">${htmlSafe(plan.name)}</span><span class="basalt-choice-card-text">$${plan.price} a seat a month</span></label>`,
			)
			.join('');
		ui.addons.innerHTML = FIXTURE.addons
			.map(
				(addon) =>
					`<div class="form-check"><input class="form-check-input" type="checkbox" id="dl-new-addon-${addon.id}" value="${addon.id}" data-dls-new-addon><label class="form-check-label" for="dl-new-addon-${addon.id}">${htmlSafe(addon.name)} <span class="dls-optional">$${addon.price} a seat</span></label></div>`,
			)
			.join('');
		syncSelect(ui.customer);
		syncSelect(ui.owner);
	}

	function chosenKind() {
		return pick('input[name="dls-new-kind"]:checked', ui.newDialog)?.value || 'new';
	}

	function chosenPlan() {
		const id = pick('input[name="dls-new-plan"]:checked', ui.newDialog)?.value || 'growth';
		return FIXTURE.plans.find((plan) => plan.id === id);
	}

	function chosenAddons() {
		return pickAll('[data-dls-new-addon]:checked', ui.newDialog).map((box) =>
			FIXTURE.addons.find((addon) => addon.id === box.value),
		);
	}

	function draftLines() {
		const seats = parseInt(ui.seats.value, 10) || 0;
		return [[chosenPlan().sku, seats], ...chosenAddons().map((addon) => [addon.id, seats])];
	}

	function toggleKindFields() {
		const dealType = chosenKind();
		for (const fieldBlock of pickAll('[data-dls-new-for]', ui.newDialog))
			fieldBlock.hidden = fieldBlock.dataset.dlsNewFor !== dealType;
	}

	function paintEstimate() {
		const seats = parseInt(ui.seats.value, 10);
		const yearlyValue = annualValue({ lines: draftLines() });
		ui.estimate.innerHTML =
			seats >= 1 && seats <= 500
				? `<i class="bi bi-calculator" aria-hidden="true"></i><span><strong>${dollars(yearlyValue)}</strong> a year. It starts in Discovery, ${FIXTURE.stages[0].chance}% likely.</span>`
				: '<i class="bi bi-calculator" aria-hidden="true"></i><span>Enter the number of seats to see the yearly value.</span>';
	}

	function openNewDeal() {
		ui.newForm.reset();
		ui.owner.value = FIXTURE.signedIn;
		ui.closeDate.value = DEFAULT_CLOSE;
		syncSelect(ui.customer);
		syncSelect(ui.owner);
		for (const inputNode of [ui.company, ui.seats, ui.closeDate]) inputNode.classList.remove('is-invalid');
		toggleKindFields();
		paintEstimate();
		window.bootstrap.Modal.getOrCreateInstance(ui.newDialog).show();
	}

	/** Checks the form and returns the first field that needs attention, or null. */
	function firstProblem(dealType, companyName, seats) {
		let problem = null;
		if (dealType === 'new') {
			const alreadyListed = book.some((deal) => deal.company.toLowerCase() === companyName.toLowerCase());
			ui.companyError.textContent = alreadyListed
				? 'This company already has a deal. Use Expansion for more seats.'
				: 'Enter the company’s name.';
			ui.company.classList.toggle('is-invalid', !companyName || alreadyListed);
			if (!companyName || alreadyListed) problem = ui.company;
		}
		const seatsFine = seats >= 1 && seats <= 500;
		ui.seats.classList.toggle('is-invalid', !seatsFine);
		if (!seatsFine && !problem) problem = ui.seats;
		const closeFine = ui.closeDate.value && ui.closeDate.value >= FIXTURE.todayIso;
		ui.closeDate.classList.toggle('is-invalid', !closeFine);
		if (!closeFine && !problem) problem = ui.closeDate;
		return problem;
	}

	function addDeal(event) {
		event.preventDefault();
		const dealType = chosenKind();
		const seats = parseInt(ui.seats.value, 10);
		const companyName = dealType === 'new' ? ui.company.value.trim() : ui.customer.value;
		const problem = firstProblem(dealType, companyName, seats);
		if (problem) {
			problem.focus();
			return;
		}

		const chosen = chosenPlan();
		const addons = chosenAddons();
		const priorDeal = dealType === 'expansion' ? book.find((record) => record.company === companyName) : null;
		const expansionTitle = addons.length
			? `${addons.map((addon) => addon.name).join(' and ')} for ${seats} seats`
			: `${seats} more ${chosen.name} seats`;
		const record = {
			id: `#${Math.max(...book.map((entry) => Number(entry.id.replace(/\D/g, '')))) + 1}`,
			acct: priorDeal ? priorDeal.acct : null,
			company: companyName,
			city: priorDeal ? priorDeal.city : ui.city.value.trim() || 'City not added',
			customer: dealType === 'expansion',
			kind: dealType === 'new' ? 'new' : addons.length ? 'addon' : 'seats',
			title: dealType === 'new' ? `${chosen.name} for ${seats} seats` : expansionTitle,
			stage: 'discovery',
			closes: ui.closeDate.value,
			owner: ui.owner.value,
			lines: draftLines(),
			oneOff: [],
			people: priorDeal ? [priorDeal.people[0]] : [],
			next: ['Book the first call.', FIXTURE.todayIso],
			history: [[FIXTURE.todayIso, FIXTURE.signedIn, 'Added the deal.', 'check']],
		};
		book.unshift(record);
		window.bootstrap.Modal.getOrCreateInstance(ui.newDialog).hide();
		clearFilters();
		chooseTab('open');
		listState.sortBy = 'date';
		listState.direction = 'asc';
		paintAll();
		listState.page = Math.floor(onScreen.indexOf(record) / PAGE_SIZE) + 1;
		paintList();
		pick(`[data-dls-row="${record.id}"]`, ui.rows)?.classList.add('is-fresh');
		notify({
			tone: 'success',
			icon: 'bi-file-earmark-plus',
			title: `${companyName} added in Discovery`,
			text: `${dollars(annualValue(record))} a year, looked after by ${record.owner}.`,
		});
		server.create(record).catch(() => {
			book.splice(book.indexOf(record), 1);
			paintAll();
			notify({ tone: 'danger', title: 'Couldn’t add the deal', text: SAVE_FAILED });
		});
	}

	function wireNewDeal() {
		ui.newForm.addEventListener('input', (event) => {
			paintEstimate();
			if (event.target === ui.company && ui.company.value.trim()) ui.company.classList.remove('is-invalid');
			if (event.target === ui.seats) ui.seats.classList.remove('is-invalid');
			if (event.target === ui.closeDate) ui.closeDate.classList.remove('is-invalid');
		});
		ui.newForm.addEventListener('change', (event) => {
			if (event.target.name === 'dls-new-kind') toggleKindFields();
			paintEstimate();
		});
		ui.newButton.addEventListener('click', openNewDeal);
		ui.newDialog.addEventListener('shown.bs.modal', () => {
			(chosenKind() === 'new' ? ui.company : ui.seats).focus();
		});
		ui.newForm.addEventListener('submit', addDeal);
	}

	start();
})();
