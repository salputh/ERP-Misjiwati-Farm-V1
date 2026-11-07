/**
 * The deal board on deal-pipeline.html.
 * Open deals sit in four lanes: Discovery, Proposal, Negotiation and Won.
 * Dropping a card in another lane changes the deal's stage, and its odds,
 * the lane totals and the forecast beside the search follow at once. The
 * card itself, its company name and the expand icon lead to the deal's own
 * page (deal-details.html); the panel icon opens a side panel with the
 * stage, details, next step and activity, whose buttons move the deal on
 * or mark it lost. Lost deals gather in a folded list under the board and
 * can be reopened from there.
 *
 * Wiring up a backend:
 *   - assets/basalt/js/data/multipurpose/deals.js should hand back your own deals in the same
 *     shape; every figure, total and list here is worked out from it.
 *   - the remote object below is the one place a change is sent to the
 *     server. The page updates first and rolls back, with an error toast,
 *     when the call fails.
 * ?state=empty shows the board before the first deal exists.
 * Shared parts from basalt.js: the sortable board, styled selects,
 * segmented controls, choice cards, the record drawer, toasts with undo
 * and empty states.
 */
(() => {
	'use strict';

	const boardPage = pick('[data-sp-root]');
	if (!boardPage) return;

	/* The deals are the records Deals and Deal Details also read from
     assets/basalt/js/data/multipurpose/deals.js. A deal's value is per year; each stage counts a
     share of it toward the forecast, and a deal out for signature sits in
     Negotiation at its own, higher odds. */
	const SOURCE = window.Basalt.data.deals;
	const MS_PER_DAY = 86400000;
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
	const anchor = parseDay(SOURCE.today);
	const thisMonth = anchor.getMonth();
	const THIS_MONTH_NAME = MONTH_FULL[thisMonth];

	/* The Deals page records why a deal was lost in its own words; the board
     folds those into four reasons. LANE_FOR says which lane each stage in
     the data lands in. */
	const REASON_GROUP = {
		'Chose a cheaper tool': 'price',
		'Chose another tool': 'competitor',
		'Staying on paper for now': 'nodecision',
		'No budget this year': 'timing',
		'Went quiet': 'nodecision',
	};
	const LANE_FOR = {
		discovery: 'discovery',
		proposal: 'proposal',
		negotiation: 'negotiation',
		signature: 'negotiation',
		signed: 'won',
	};
	const DUE_ICON = { late: 'bi-exclamation-circle', won: 'bi-check-circle' };
	/* How far an owner's read moves a deal's odds from its stage's. */
	const READ_NUDGE = [-12, -6, 0, 6, 12, 18];
	/* The odds ring: a half circle, and how long a sweep takes. */
	const GAUGE_ARC = 'M9 38a26 26 0 0 1 52 0';
	const GAUGE_MS = 500;

	const SETUP = {
		/* The demo's "today"; a real app uses the real date. */
		today: SOURCE.today,
		me: 'John Armstrong',
		stages: [
			{ id: 'discovery', name: 'Discovery', chance: oddsForStage('discovery'), tone: 2 },
			{ id: 'proposal', name: 'Proposal', chance: oddsForStage('proposal'), tone: 1 },
			{ id: 'negotiation', name: 'Negotiation', chance: oddsForStage('negotiation'), tone: 3 },
			{ id: 'won', name: 'Won', chance: 100, tone: 'won' },
		],
		kinds: [
			{ id: 'new', name: 'New customer', icon: 'bi-building-add' },
			{ id: 'seats', name: 'More seats', icon: 'bi-people' },
			{ id: 'upgrade', name: 'Plan upgrade', icon: 'bi-arrow-up-circle' },
			{ id: 'addon', name: 'Add-on', icon: 'bi-puzzle' },
		],
		reasons: [
			{ id: 'price', name: 'Price', icon: 'bi-tag' },
			{ id: 'competitor', name: 'Chose a competitor', icon: 'bi-shuffle' },
			{ id: 'nodecision', name: 'No decision', icon: 'bi-hourglass-split' },
			{ id: 'timing', name: 'Timing', icon: 'bi-calendar-x' },
		],
		/* Teammates who can own a deal. */
		owners: SOURCE.owners,
		deals: SOURCE.list().map(toBoardDeal),
	};

	/* Where a change reaches your server. The demo answers after a short
     pause, as a real request would:
       add      POST  /api/deals
       move     PATCH /api/deals/:id { stage }
       lose     PATCH /api/deals/:id { lost, reason, note }
       reopen   PATCH /api/deals/:id { lost: null } */
	const remote = {
		add(record) {
			return settle(250);
		},
		move(dealId, lane) {
			return settle(250);
		},
		lose(dealId, why, remark) {
			return settle(250);
		},
		reopen(dealId) {
			return settle(250);
		},
	};

	/* Lanes keep the order they are shown in: the soonest close first, and in
     Won the latest win first. */
	const urlParams = new URLSearchParams(location.search);
	let book =
		urlParams.get('state') === 'empty'
			? []
			: SETUP.deals.map((entry) => ({ ...entry, activity: entry.activity.slice() })).sort(boardOrder);
	const criteria = { text: '', owner: '', window: '', lane: 'discovery' };
	/* Deals added during this session have no page of their own yet. */
	const addedHere = new Set();

	const ui = {
		search: pick('[data-sp-search]', boardPage),
		owner: pick('[data-sp-owner]', boardPage),
		window: pick('[data-sp-close]', boardPage),
		summary: pick('[data-sp-summary]', boardPage),
		lanePicker: pick('[data-sp-phone-stage]', boardPage),
		board: pick('[data-sp-board]', boardPage),
		toolbar: pick('.sp-toolbar', boardPage),
		noMatch: pick('[data-sp-noresults]', boardPage),
		noMatchText: pick('[data-sp-noresults-text]', boardPage),
		nothing: pick('[data-sp-empty]', boardPage),
		lostBox: pick('[data-sp-lost]', boardPage),
		lostSummary: pick('[data-sp-lost-sub]', boardPage),
		lostToggle: pick('[data-sp-lost-toggle]', boardPage),
		lostList: pick('[data-sp-lost-list]', boardPage),
	};
	const sidePanel = document.getElementById('sp-drawer');
	const lossDialog = document.getElementById('sp-lose');
	const lossForm = pick('[data-sp-lose-form]', lossDialog);
	const reasonWarning = pick('[data-sp-reason-error]', lossDialog);
	const addDialog = document.getElementById('sp-new');
	const newDealForm = pick('[data-sp-new-form]', addDialog);
	const addFields = {
		firm: pick('[data-sp-f="company"]', addDialog),
		what: pick('[data-sp-f="title"]', addDialog),
		yearly: pick('[data-sp-f="value"]', addDialog),
		yearlyError: pick('[data-sp-value-error]', addDialog),
		dueOn: pick('[data-sp-f="close"]', addDialog),
		owner: pick('[data-sp-f="owner"]', addDialog),
		preview: pick('[data-sp-new-sum]', addDialog),
	};

	/* What the panel's arrows step through, the drawer's record navigator,
     and the deal the panel shows right now. */
	let walkList = [];
	/* The odds each lane's ring last showed, so a redraw sweeps on from there. */
	const shownOdds = {};
	let walker = null;
	let viewing = null;
	let losingDeal = null;
	let typingTimer = 0;
	let stepsGrown = false;

	/* Buttons in the panel's footer, by the data hook each one carries. */
	const PANEL_ACTIONS = { advance: moveOn, 'step-back': stepBack, lose: askWhyLost, reopen: bringBack };

	function start() {
		wireToolbar();
		wireBoard();
		wireLostList();
		wirePanel();
		wireLossDialog();
		wireAddDialog();
		paintAll();
	}

	function wireToolbar() {
		ui.owner.innerHTML = `<option value="">Everyone</option>${SETUP.owners.map((who) => `<option value="${clean(who)}">${clean(who === SETUP.me ? `${who} (you)` : who)}</option>`).join('')}`;
		repaintSelect(ui.owner);
		ui.search.addEventListener('input', () => {
			clearTimeout(typingTimer);
			typingTimer = setTimeout(() => {
				criteria.text = ui.search.value.trim();
				paintBoard();
			}, 120);
		});
		ui.owner.addEventListener('change', () => {
			criteria.owner = ui.owner.value;
			paintBoard();
		});
		ui.window.addEventListener('change', () => {
			criteria.window = ui.window.value;
			paintBoard();
		});
		ui.lanePicker.addEventListener('change', () => {
			criteria.lane = ui.lanePicker.value;
			for (const column of pickAll('[data-sp-col]', ui.board))
				column.classList.toggle('is-phone', column.dataset.spCol === criteria.lane);
		});
		pick('[data-sp-clear]', boardPage).addEventListener('click', clearFilters);
		pick('[data-sp-export]', boardPage).addEventListener('click', exportOpenDeals);
	}

	function wireBoard() {
		boardPage.addEventListener('click', (event) => {
			/* A link (the company name) goes to its page, never the quick view. */
			if (event.target.closest('a')) return;
			const quick = event.target.closest('[data-sp-open]');
			const again = event.target.closest('[data-sp-reopen]');
			if (quick) showDeal(quick.dataset.spOpen);
			else if (again) bringBack(findDeal(again.dataset.spReopen));
			else followCard(event);
		});
		boardPage.addEventListener('auxclick', (event) => {
			if (event.button === 1) followCard(event);
		});
		ui.board.addEventListener('basalt:sortable-change', onCardDropped);
	}

	function wireLostList() {
		ui.lostToggle.addEventListener('click', () => {
			const opening = ui.lostList.hidden;
			window.Basalt.slide(ui.lostList, () => {
				ui.lostList.hidden = !opening;
			});
			ui.lostToggle.setAttribute('aria-expanded', String(opening));
			ui.lostToggle.textContent = opening ? 'Hide' : 'Show';
		});
	}

	function wirePanel() {
		sidePanel.addEventListener('click', (event) => {
			for (const [hook, act] of Object.entries(PANEL_ACTIONS)) {
				const pressed = event.target.closest(`[data-sp-${hook}]`);
				if (!pressed) continue;
				act(findDeal(pressed.getAttribute(`data-sp-${hook}`)));
				return;
			}
		});
	}

	function wireLossDialog() {
		pick('[data-sp-reasons]', lossDialog).innerHTML = SETUP.reasons
			.map((why) => tileMarkup('sp-reason', why, false))
			.join('');
		lossForm.addEventListener('change', () => {
			reasonWarning.hidden = true;
		});
		lossForm.addEventListener('submit', onLossSubmit);
	}

	function wireAddDialog() {
		const knownNames = [...new Set(book.filter((entry) => entry.customer).map((entry) => entry.company))].sort();
		pick('[data-sp-companies]', addDialog).innerHTML = knownNames
			.map((name) => `<option value="${clean(name)}"></option>`)
			.join('');
		pick('[data-sp-kinds]', addDialog).innerHTML = SETUP.kinds
			.map((dealKind) => tileMarkup('sp-kind', dealKind, dealKind.id === 'new'))
			.join('');
		pick('[data-sp-new-stages]', addDialog).innerHTML = SETUP.stages
			.filter((phase) => phase.id !== 'won')
			.map(
				(phase, index) =>
					`<input type="radio" class="btn-check" name="sp-new-stage" id="sp-new-stage-${phase.id}" value="${phase.id}"${index === 0 ? ' checked' : ''}><label class="basalt-segmented-option" for="sp-new-stage-${phase.id}">${clean(phase.name)}</label>`,
			)
			.join('');
		addFields.owner.innerHTML = SETUP.owners
			.map((who) => `<option${who === SETUP.me ? ' selected' : ''}>${clean(who)}</option>`)
			.join('');
		repaintSelect(addFields.owner);

		newDealForm.addEventListener('input', (event) => {
			paintPreview();
			if (event.target.value.trim()) event.target.classList.remove('is-invalid');
			if (event.target === addFields.yearly) addFields.yearlyError.hidden = true;
		});
		newDealForm.addEventListener('change', paintPreview);
		newDealForm.addEventListener('submit', onAddSubmit);
		for (const opener of pickAll('[data-sp-new]', boardPage)) opener.addEventListener('click', openAddDialog);
		addDialog.addEventListener('shown.bs.modal', () => addFields.firm.focus());
	}

	/* Small helpers: DOM, text, money and dates. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}
	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}
	function say(message) {
		window.Basalt.announce?.(message);
	}
	function repaintSelect(select) {
		window.Basalt.select?.refresh?.(select);
	}
	function settle(ms) {
		return new Promise((done) => setTimeout(done, ms));
	}

	function clean(text) {
		const SWAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(text == null ? '' : text).replace(/[&<>"']/g, (mark) => SWAP[mark]);
	}

	/** The toast shown when a call to the server fails. */
	function failed(headline) {
		return { tone: 'danger', title: headline, text: 'Nothing was saved. Try again in a moment.' };
	}

	function dollars(amount) {
		return `$${Math.round(amount).toLocaleString('en-US')}`;
	}

	/** $1.25M, $48k or the full figure, for the summary line. */
	function compact(amount) {
		if (amount >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`;
		return amount >= 10000 ? `$${Math.round(amount / 1000)}k` : dollars(amount);
	}

	function countOf(howMany, single, several) {
		return `${howMany} ${howMany === 1 ? single : several}`;
	}

	function sumOf(items, measure) {
		let tally = 0;
		for (const one of items) tally += measure(one);
		return tally;
	}

	function parseDay(text) {
		return new Date(`${text}T00:00:00`);
	}
	function daysLeft(text) {
		return Math.round((parseDay(text) - anchor) / MS_PER_DAY);
	}
	function longDate(text) {
		return `${monthDay(text)}, ${parseDay(text).getFullYear()}`;
	}

	function monthDay(text) {
		const day = parseDay(text);
		return `${MONTH_ABBR[day.getMonth()]} ${day.getDate()}`;
	}

	function isoDay(day) {
		const pieces = [day.getFullYear(), day.getMonth() + 1, day.getDate()];
		return pieces.map((piece) => String(piece).padStart(2, '0')).join('-');
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

	/** A name always lands on the same avatar hue, as on the other CRM pages. */
	function hueIndex(name) {
		let rolling = 0;
		for (const unit of name.toLowerCase().split('')) rolling = (rolling * 31 + unit.charCodeAt(0)) >>> 0;
		return (rolling % 8) + 1;
	}

	function avatarChip(name, sizeClass) {
		return `<span class="basalt-avatar ${sizeClass || 'basalt-avatar-xs'} basalt-avatar-tone-${hueIndex(name)}" aria-hidden="true">${clean(monogram(name))}</span>`;
	}

	/* Lookups into the setup and the book. */

	function oddsForStage(stageId) {
		return SOURCE.stages.find((phase) => phase.id === stageId).chance;
	}
	/** A deal's own odds: its stage's, plus the owner's read of the deal
      (read, which stays with the deal), plus a nudge for how soon it is due
      to close: within two weeks 15 points more, within a month 8 more, past
      two months 4 less and past three 7 less. */
	function oddsFor(stageId, close, read = 0) {
		if (stageId === 'won') return 100;
		const days = daysLeft(close);
		const soon = days <= 14 ? 15 : days <= 30 ? 8 : days > 90 ? -7 : days > 60 ? -4 : 0;
		return Math.min(95, Math.max(5, oddsForStage(stageId) + soon + read));
	}

	/** The owner's read of a sample deal, picked steadily from its number.
      A deal added here has no read yet. */
	function ownerRead(id) {
		const total = [...id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
		return READ_NUDGE[total % READ_NUDGE.length];
	}
	function stageById(stageId) {
		return SETUP.stages.find((phase) => phase.id === stageId);
	}
	function kindById(kindId) {
		return SETUP.kinds.find((dealKind) => dealKind.id === kindId);
	}
	function reasonById(reasonId) {
		return SETUP.reasons.find((why) => why.id === reasonId);
	}
	function findDeal(dealId) {
		return book.find((entry) => entry.id === dealId);
	}
	function forecastShare(entry) {
		return (entry.value * entry.chance) / 100;
	}
	function stillOpen(entry) {
		return !entry.lost && entry.stage !== 'won';
	}
	function lostThisMonth() {
		return book.filter((entry) => entry.lost && parseDay(entry.lost).getMonth() === thisMonth);
	}
	function visibleDeals() {
		return book.filter((entry) => !entry.lost && fits(entry));
	}
	function dealPage(entry) {
		return `deal-details.html?id=${encodeURIComponent(entry.id)}`;
	}
	function companyPage(entry) {
		return `company-details.html?id=${encodeURIComponent(entry.acct)}`;
	}
	const ownerPage = SOURCE.ownerUrl;

	/** One record from deals.js as the board holds it. */
	function toBoardDeal(raw) {
		const at = raw.stage === 'lost' ? raw.lostFrom : raw.stage;
		const signer =
			raw.people.find((person) => ['Signs', 'Signed', 'Decided'].includes(person.part)) || raw.people[0];
		return {
			id: raw.id,
			acct: raw.acct,
			company: raw.company,
			customer: raw.customer,
			title: raw.title,
			kind: raw.kind,
			value: raw.value,
			stage: LANE_FOR[at],
			read: ownerRead(raw.id),
			chance: oddsFor(at, raw.closes, ownerRead(raw.id)),
			sig: at === 'signature',
			owner: raw.owner,
			close: raw.closes,
			won: raw.signed,
			lost: raw.lost,
			reason: raw.lost ? REASON_GROUP[raw.reason] : undefined,
			contact: [signer.name, signer.title],
			next: raw.next ? raw.next[0] : '',
			afterWin: raw.afterWin,
			activity: raw.history.map((line) => line.slice(0, 3)),
		};
	}

	function boardOrder(a, b) {
		if (a.won && b.won) return b.won < a.won ? -1 : 1;
		if (a.close === b.close) return 0;
		return a.close < b.close ? -1 : 1;
	}

	/* Filtering. */

	function fits(entry) {
		if (criteria.owner && entry.owner !== criteria.owner) return false;
		if (criteria.window && !inWindow(entry)) return false;
		if (!criteria.text) return true;
		const haystack = [entry.company, entry.title, entry.owner, entry.contact[0], kindById(entry.kind).name].join(
			' ',
		);
		if (window.Basalt?.matchesQuery) return window.Basalt.matchesQuery(haystack, criteria.text);
		return haystack.toLowerCase().includes(criteria.text.toLowerCase());
	}

	/** Whether the deal's close date sits in the chosen window. */
	function inWindow(entry) {
		if (criteria.window === 'late') return stillOpen(entry) && daysLeft(entry.close) < 0;
		const closes = parseDay(entry.close);
		const reference = criteria.window === 'next' ? new Date(anchor.getFullYear(), thisMonth + 1, 1) : anchor;
		return closes.getMonth() === reference.getMonth() && closes.getFullYear() === reference.getFullYear();
	}

	function anyFilter() {
		return !!(criteria.text || criteria.owner || criteria.window);
	}

	function clearFilters() {
		Object.assign(criteria, { text: '', owner: '', window: '' });
		for (const blankMe of [ui.search, ui.owner, ui.window]) blankMe.value = '';
		repaintSelect(ui.owner);
		repaintSelect(ui.window);
		paintBoard();
		ui.search.focus();
	}

	/* Painting the board, the summary and the lost list. */

	function paintAll() {
		paintBoard();
		paintLost();
	}

	function paintBoard() {
		const showing = visibleDeals();
		const nothingAtAll = !book.length;
		const noMatch = !nothingAtAll && anyFilter() && !showing.length;
		ui.nothing.hidden = !nothingAtAll;
		ui.toolbar.hidden = nothingAtAll;
		ui.noMatch.hidden = !noMatch;
		ui.board.parentElement.hidden = noMatch || nothingAtAll;
		if (noMatch) ui.noMatchText.textContent = noMatchText();
		ui.board.innerHTML = SETUP.stages
			.map((phase) =>
				laneMarkup(
					phase,
					showing.filter((entry) => entry.stage === phase.id),
				),
			)
			.join('');
		for (const lane of pickAll('[data-basalt-sortable]', ui.board)) window.Basalt.sortable?.(lane);
		window.Basalt.tips?.(ui.board);
		for (const phase of SETUP.stages) {
			showOdds(
				phase.id,
				laneOdds(
					phase.id,
					showing.filter((entry) => entry.stage === phase.id),
				),
			);
		}
		paintSummary(showing);
		paintLanePicker(showing);
	}

	function noMatchText() {
		if (!criteria.text) return 'No deal fits these filters. Clear one to see more.';
		const narrowed = criteria.owner || criteria.window;
		return `Nothing matches “${criteria.text}”${narrowed ? ' with these filters' : ''}. Try another spelling${narrowed ? ', or clear the filters.' : '.'}`;
	}

	/** Only the figures change while a card is dragged, so the moved card
      keeps its place and its highlight. */
	function paintTotals() {
		const showing = visibleDeals();
		for (const phase of SETUP.stages) {
			const inLane = showing.filter((entry) => entry.stage === phase.id);
			const column = pick(`[data-sp-col="${phase.id}"]`, ui.board);
			pick('.basalt-board-count', column).innerHTML = countMarkup(inLane.length);
			const totals = pick('[data-sp-totals]', column);
			const before = figuresIn(totals);
			totals.innerHTML = laneTotals(phase.id, inLane);
			rollFigures(totals, before);
			showOdds(phase.id, laneOdds(phase.id, inLane));
		}
		paintSummary(showing);
		paintLanePicker(showing);
	}

	/** How many open deals are showing and what they add to the forecast. */
	function paintSummary(showing) {
		const live = showing.filter(stillOpen);
		ui.summary.innerHTML = `${countOf(live.length, 'open deal', 'open deals')}${anyFilter() ? ' match' : ''} · <strong>${compact(sumOf(live, forecastShare))}</strong> forecast`;
	}

	function paintLanePicker(showing) {
		ui.lanePicker.innerHTML = SETUP.stages
			.map(
				(phase) =>
					`<option value="${phase.id}"${phase.id === criteria.lane ? ' selected' : ''}>${clean(phase.name)} · ${showing.filter((entry) => entry.stage === phase.id).length}</option>`,
			)
			.join('');
		repaintSelect(ui.lanePicker);
	}

	function paintLost() {
		const gone = lostThisMonth();
		ui.lostBox.hidden = !gone.length;
		ui.lostSummary.textContent = `${countOf(gone.length, 'deal', 'deals')} worth ${dollars(sumOf(gone, (entry) => entry.value))} a year.`;
		ui.lostList.innerHTML = gone.map(lostRowMarkup).join('');
		window.Basalt.tips?.(ui.lostList);
	}

	/* Markup for the board. */

	function laneMarkup(phase, inLane) {
		const phoneClass = phase.id === criteria.lane ? ' is-phone' : '';
		return `<section class="basalt-board-col sp-col sp-col-${phase.tone}${phoneClass}" data-sp-col="${phase.id}" aria-labelledby="sp-col-${phase.id}"><div class="sp-col-head">${oddsGauge(phase)}<div class="basalt-board-head"><h2 class="basalt-board-title" id="sp-col-${phase.id}">${clean(phase.name)}</h2><span class="basalt-board-count">${countMarkup(inLane.length)}</span></div><p class="sp-col-totals" data-sp-totals="${phase.id}">${laneTotals(phase.id, inLane)}</p></div><ul class="basalt-sortable sp-list" data-basalt-sortable data-basalt-sortable-group="sp-stages" data-basalt-sortable-whole aria-label="${clean(phase.name)}">${inLane.map(cardMarkup).join('')}</ul></section>`;
	}

	/** A half ring in the stage color, drawn empty; showOdds sweeps it to the
      lane's odds. Won shows a check in place of the number. */
	function oddsGauge(phase) {
		const middle =
			phase.id === 'won'
				? '<path class="sp-gauge-check" d="M28 31l5 5 9-10"/>'
				: '<text class="sp-gauge-text" x="35" y="38">0%</text>';
		return `<svg class="sp-gauge" viewBox="0 0 70 44" aria-hidden="true"><path class="sp-gauge-track" d="${GAUGE_ARC}"/><path class="sp-gauge-fill" d="${GAUGE_ARC}" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>${middle}</svg>`;
	}

	/** The lane's odds: the average of its deals' own odds, so every deal
      that comes or goes moves it. Won is certain. */
	function laneOdds(stageId, inLane) {
		if (stageId === 'won') return 100;
		if (!inLane.length) return stageById(stageId).chance;
		return Math.round(sumOf(inLane, (entry) => entry.chance) / inLane.length);
	}

	/** Sweeps a lane's ring from the odds it last showed to the new ones, and
      counts the number along with it. */
	function showOdds(stageId, odds) {
		const gauge = pick(`[data-sp-col="${stageId}"] .sp-gauge`, ui.board);
		if (!gauge) return;
		const from = shownOdds[stageId] ?? 0;
		shownOdds[stageId] = odds;
		const fill = pick('.sp-gauge-fill', gauge);
		const label = pick('.sp-gauge-text', gauge);
		fill.style.strokeDashoffset = 100 - from;
		requestAnimationFrame(() => {
			fill.style.strokeDashoffset = 100 - odds;
		});
		if (label) countTo(label, from, odds, (value) => `${Math.round(value)}%`);
	}

	/** The dollar figures a lane's totals show, read before they are redrawn. */
	function figuresIn(totals) {
		return Object.fromEntries(
			pickAll('[data-sp-figure]', totals).map((figure) => [
				figure.dataset.spFigure,
				Number(figure.textContent.replace(/\D/g, '')),
			]),
		);
	}

	/** Counts each redrawn figure up or down from what it showed before, and
      floats the change in the lane's value above it. */
	function rollFigures(totals, before) {
		for (const figure of pickAll('[data-sp-figure]', totals)) {
			const from = before[figure.dataset.spFigure];
			const to = Number(figure.textContent.replace(/\D/g, ''));
			if (from === undefined || from === to) continue;
			countTo(figure, from, to, dollars);
			if (figure.dataset.spFigure === 'value') floatChange(totals, to - from);
		}
	}

	function floatChange(totals, change) {
		const tag = document.createElement('span');
		tag.className = `sp-change ${change > 0 ? 'is-up' : 'is-down'}`;
		tag.setAttribute('aria-hidden', 'true');
		tag.textContent = `${change > 0 ? '+' : '−'}${dollars(Math.abs(change))}`;
		totals.append(tag);
		tag.addEventListener('animationend', () => tag.remove());
	}

	/** Eases a number shown in an element from one value to another; with
      reduced motion it jumps straight there. */
	function countTo(element, from, to, format) {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || from === to) {
			element.textContent = format(to);
			return;
		}
		const started = performance.now();
		const step = (now) => {
			const progress = Math.min(1, (now - started) / GAUGE_MS);
			const eased = 1 - (1 - progress) ** 3;
			element.textContent = format(from + (to - from) * eased);
			if (progress < 1) requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	}

	function countMarkup(howMany) {
		return `${howMany}<span class="visually-hidden"> deals</span>`;
	}

	/** A lane's value and a note with the odds. Won counts in full; deals out for signature
      count more than the rest of Negotiation, hence the range. */
	function laneTotals(stageId, inLane) {
		const note =
			stageId === 'won'
				? `Won in ${THIS_MONTH_NAME}`
				: `${laneOdds(stageId, inLane)}% likely · <strong data-sp-figure="forecast">${dollars(sumOf(inLane, forecastShare))}</strong> forecast`;
		return `<span class="sp-col-sum"><span data-sp-figure="value">${dollars(sumOf(inLane, (entry) => entry.value))}</span><span class="sp-col-per"> a year</span></span><span class="sp-col-note">${note}</span>`;
	}

	function cardMarkup(entry) {
		const due = dueState(entry);
		const dueClass = due.tone ? ` sp-due-${due.tone}` : '';
		const newTag = entry.kind === 'new' ? '<span class="sp-new-pill">New</span>' : '';
		return `<li class="basalt-sortable-item sp-card${entry.stage === 'won' ? ' sp-card-won' : ''}" data-sp-card="${clean(entry.id)}"><div class="sp-card-top"><span class="sp-logo basalt-avatar-tone-${hueIndex(entry.company)}" aria-hidden="true">${clean(monogram(entry.company))}</span><a class="sp-card-company" href="${dealPage(entry)}">${clean(entry.company)}</a>${quickActions(entry, 'sp-card-open')}</div><p class="sp-card-title"><span>${clean(entry.title)}</span>${newTag}</p><div class="sp-card-foot"><span class="sp-card-value">${dollars(entry.value)}</span><span class="sp-due${dueClass}"><i class="bi ${DUE_ICON[due.tone] || 'bi-calendar3'}" aria-hidden="true"></i>${clean(due.text)}</span><span class="sp-card-owner" title="${clean(entry.owner)}">${avatarChip(entry.owner)}<span class="visually-hidden">Owner ${clean(entry.owner)}</span></span></div></li>`;
	}

	/** Quick view and Open full page, side by side on a card or a lost row. */
	function quickActions(entry, extraClass) {
		return `<span class="basalt-row-actions ${extraClass}"><button type="button" class="btn btn-icon btn-sm" data-sp-open="${clean(entry.id)}" aria-label="Quick view: ${clean(entry.company)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${dealPage(entry)}" aria-label="Open full page: ${clean(entry.company)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span>`;
	}

	function lostRowMarkup(entry) {
		return `<li class="sp-lost-row" data-sp-lost-row="${clean(entry.id)}"><div class="sp-lost-who"><a class="sp-lost-name" href="${dealPage(entry)}">${clean(entry.company)}</a><span class="sp-quiet">${clean(entry.title)}</span></div><span class="sp-lost-value">${dollars(entry.value)}</span><span class="sp-lost-reason"><span class="sp-reason">${clean(reasonById(entry.reason).name)}</span></span><span class="sp-lost-owner">${avatarChip(entry.owner)}<span>${clean(entry.owner)}</span></span><span class="sp-lost-acts"><button type="button" class="btn btn-sm btn-outline-secondary sp-lost-reopen" data-sp-reopen="${clean(entry.id)}"><i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Reopen</button>${quickActions(entry, 'sp-lost-open')}</span></li>`;
	}

	/** The close date as a card shows it, with a tone when it is near, past
      or already won. */
	function dueState(entry) {
		if (entry.won) return { text: `Won ${monthDay(entry.won)}`, tone: 'won' };
		const gap = daysLeft(entry.close);
		if (gap < 0) return { text: `${countOf(-gap, 'day', 'days')} late`, tone: 'late' };
		if (gap === 0) return { text: 'Closes today', tone: 'soon' };
		if (gap <= 7) return { text: `In ${countOf(gap, 'day', 'days')}`, tone: 'soon' };
		return { text: monthDay(entry.close), tone: '' };
	}

	function tileMarkup(group, option, checked) {
		return `<label class="basalt-choice-card sp-tile"><input class="basalt-choice-card-input" type="radio" name="${group}" value="${option.id}"${checked ? ' checked' : ''}><span class="sp-tile-icon" aria-hidden="true"><i class="bi ${option.icon}"></i></span><span class="basalt-choice-card-title">${clean(option.name)}</span></label>`;
	}

	/* Moving a deal between lanes. moveTo is the one place a deal changes
     lane, whether by drag, by the panel's buttons or by Undo; it hands back
     where the deal was so Undo can put it back exactly. */

	function moveTo(entry, lane) {
		const before = { stage: entry.stage, sig: entry.sig, chance: entry.chance, won: entry.won };
		Object.assign(entry, { stage: lane, sig: false, chance: oddsFor(lane, entry.close, entry.read) });
		if (lane === 'won') entry.won = SETUP.today;
		else delete entry.won;
		return before;
	}

	function rewind(entry, before) {
		Object.assign(entry, before);
		if (!before.won) delete entry.won;
	}

	function announceMove(entry, before) {
		const phase = stageById(entry.stage);
		const won = entry.stage === 'won';
		function undo() {
			rewind(entry, before);
			paintAll();
			repaintPanelIf(entry);
			say(`${entry.company} is back in ${stageById(before.stage).name}.`);
		}
		notify({
			tone: 'success',
			icon: won ? 'bi-trophy' : 'bi-arrow-right-circle',
			title: won ? `Won: ${entry.company}` : `${entry.company} moved to ${phase.name}`,
			text: won
				? `${entry.title} · ${dollars(entry.value)} a year.`
				: `Counts ${entry.chance}% now, ${dollars(forecastShare(entry))} in the forecast.`,
			duration: 8000,
			actions: [{ label: 'Undo', onClick: undo }],
		});
		remote.move(entry.id, entry.stage).catch(() => {
			undo();
			notify(failed('The deal didn’t move'));
		});
	}

	function onCardDropped(event) {
		const { item: dropped, from: source, to: landing } = event.detail;
		/* The book follows the order the cards now stand in. */
		const sequence = pickAll('[data-sp-card]', ui.board).map((node) => node.dataset.spCard);
		function rank(entry) {
			const at = sequence.indexOf(entry.id);
			return at < 0 ? 1e6 : at;
		}
		book.sort((a, b) => rank(a) - rank(b));
		if (source === landing) return;
		const entry = findDeal(dropped.dataset.spCard);
		const before = moveTo(entry, landing.closest('[data-sp-col]').dataset.spCol);
		/* A card looks different once it lands in, or leaves, Won. It is redrawn
       in place because the shared sortable still holds the node. */
		const stamp = document.createElement('template');
		stamp.innerHTML = cardMarkup(entry);
		dropped.innerHTML = stamp.content.firstElementChild.innerHTML;
		window.Basalt.tips?.(dropped);
		dropped.classList.toggle('sp-card-won', entry.stage === 'won');
		paintTotals();
		announceMove(entry, before);
	}

	function moveOn(entry) {
		const at = SETUP.stages.findIndex((phase) => phase.id === entry.stage);
		const before = moveTo(entry, SETUP.stages[at + 1].id);
		paintAll();
		paintPanel(entry);
		announceMove(entry, before);
		(pick('[data-sp-advance]', sidePanel) || pick('.btn-close', sidePanel)).focus();
	}

	function stepBack(entry) {
		const before = moveTo(entry, 'negotiation');
		paintAll();
		paintPanel(entry);
		announceMove(entry, before);
		pick('[data-sp-advance]', sidePanel).focus();
	}

	function bringBack(entry) {
		const before = { lost: entry.lost, reason: entry.reason };
		delete entry.lost;
		delete entry.reason;
		paintAll();
		repaintPanelIf(entry);
		notify({
			tone: 'success',
			icon: 'bi-arrow-counterclockwise',
			title: `${entry.company} is open again`,
			text: `Back in ${stageById(entry.stage).name}.`,
			duration: 8000,
			actions: [
				{
					label: 'Undo',
					onClick() {
						Object.assign(entry, before);
						paintAll();
						repaintPanelIf(entry);
					},
				},
			],
		});
		remote.reopen(entry.id).catch(() => {
			Object.assign(entry, before);
			paintAll();
			notify(failed('The deal didn’t reopen'));
		});
	}

	/** A click anywhere else on a card or a lost row opens the deal's page;
      the middle button or Cmd/Ctrl opens it in a new tab, as a link would.
      A drag never gets here. A deal added in this session has no page yet,
      so it opens the quick view instead. */
	function followCard(event) {
		if (event.button > 1) return;
		const hit = event.target.closest('[data-sp-card], [data-sp-lost-row]');
		if (!hit || event.target.closest('a, button')) return;
		const entry = findDeal(hit.dataset.spCard || hit.dataset.spLostRow);
		if (addedHere.has(entry.id)) {
			if (event.button === 0) showDeal(entry.id);
			return;
		}
		const url = dealPage(entry);
		if (event.button === 1 || event.metaKey || event.ctrlKey) window.open(url, '_blank');
		else location.href = url;
	}

	/* The side panel. */

	function panelPart(name) {
		return pick(`[data-sp-d="${name}"]`, sidePanel);
	}

	function showDeal(dealId) {
		const entry = findDeal(dealId);
		if (!entry) return;
		/* The arrows walk the list the deal came from: the cards on the board
       in lane order, or the lost list. */
		walkList = entry.lost
			? lostThisMonth()
			: pickAll('[data-sp-card]', ui.board).map((node) => findDeal(node.dataset.spCard));
		let at = walkList.indexOf(entry);
		if (at < 0) {
			walkList = [entry];
			at = 0;
		}
		if (!walker && window.Basalt.drawer) {
			walker = window.Basalt.drawer.recordNav(
				sidePanel,
				{ valueOf: () => Math.max(1, walkList.length) },
				(index) => paintPanel(walkList[index]),
			);
		}
		if (walker) walker.go(at, 0);
		else paintPanel(entry);
		pick('.basalt-drawer-nav', sidePanel).hidden = walkList.length < 2;
		window.bootstrap.Offcanvas.getOrCreateInstance(sidePanel).show();
	}

	function paintPanel(entry) {
		if (!entry) return;
		viewing = entry;
		const emblem = panelPart('logo');
		emblem.className = `sp-logo basalt-avatar-tone-${hueIndex(entry.company)}`;
		emblem.textContent = monogram(entry.company);
		panelPart('full').href = dealPage(entry);
		const texts = {
			company: entry.company,
			title: entry.title,
			next: entry.won
				? entry.afterWin || 'Send the welcome email and the first invoice.'
				: entry.next || 'Agree the next step with the customer.',
		};
		for (const [part, text] of Object.entries(texts)) panelPart(part).textContent = text;
		const htmlParts = {
			steps: stepsMarkup(entry),
			lead: leadMarkup(entry),
			facts: factsMarkup(entry),
			activity: entry.activity
				.map(
					([when, who, what]) =>
						`<li class="sp-act">${avatarChip(who, 'basalt-avatar-sm')}<span class="sp-act-text">${clean(what)}<span class="sp-quiet">${clean(who)} · ${monthDay(when)}</span></span></li>`,
				)
				.join(''),
			foot: footMarkup(entry),
		};
		for (const [part, html] of Object.entries(htmlParts)) panelPart(part).innerHTML = html;
		growSteps(panelPart('steps'));
	}

	/**
	 * Grows the filled lines between done steps the first time a deal shows
	 * them on screen; every later fill shows them already drawn.
	 */
	function growSteps(trail) {
		if (stepsGrown) {
			trail.classList.remove('is-drawing');
			return;
		}
		if (
			!window.IntersectionObserver ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
			!pickAll('.sp-step.is-done + .sp-step', trail).length
		)
			return;
		stepsGrown = true;
		let left = 0;
		trail.classList.add('is-waiting');
		trail.addEventListener('animationend', function done(event) {
			if (event.animationName !== 'sp-trail-grow' || --left > 0) return;
			trail.classList.remove('is-drawing');
			trail.removeEventListener('animationend', done);
		});
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				left = pickAll('.sp-step.is-done + .sp-step', trail).length;
				trail.classList.remove('is-waiting');
				if (left) trail.classList.add('is-drawing');
			},
			{ threshold: 0.5 },
		);
		watch.observe(trail);
	}

	function repaintPanelIf(entry) {
		if (viewing === entry && sidePanel.classList.contains('show')) paintPanel(entry);
	}

	function stepsMarkup(entry) {
		const at = SETUP.stages.findIndex((phase) => phase.id === entry.stage);
		return SETUP.stages
			.map((phase, index) => {
				const reached = entry.lost ? index <= at : index < at;
				const here = !entry.lost && index === at;
				const ticked = reached || (here && phase.id === 'won');
				const stateClass = reached ? ' is-done' : here ? ' is-current' : '';
				return `<li class="sp-step${stateClass}"${here ? ' aria-current="step"' : ''}><span class="sp-step-mark" aria-hidden="true">${ticked ? '<i class="bi bi-check-lg"></i>' : String(index + 1)}</span><span class="sp-step-name">${clean(phase.name)}</span></li>`;
			})
			.join('');
	}

	function leadMarkup(entry) {
		const phase = stageById(entry.stage);
		const worth = `<strong>${dollars(entry.value)}</strong> a year`;
		if (entry.lost)
			return `<span class="sp-reason sp-reason-lost">Lost on ${longDate(entry.lost)}</span><span class="sp-d-lead-line">${worth}, lost at ${clean(phase.name)}: ${clean(reasonById(entry.reason).name.toLowerCase())}.</span>`;
		if (entry.won) return `<span class="sp-d-lead-line">${worth}, won on ${longDate(entry.won)}.</span>`;
		return `<span class="sp-d-lead-line">${worth}. ${entry.sig ? 'Out for signature' : `At ${clean(phase.name)}`} it counts ${entry.chance}%, so <strong>${dollars(forecastShare(entry))}</strong> goes into the forecast.</span>`;
	}

	function factsMarkup(entry) {
		const due = dueState(entry);
		const settled = entry.won || entry.lost;
		const dueNote = due.tone ? due.text.toLowerCase() : `in ${countOf(daysLeft(entry.close), 'day', 'days')}`;
		const closeLine = settled
			? longDate(entry.close)
			: `${longDate(entry.close)} <span class="sp-due${due.tone ? ` sp-due-${due.tone}` : ''}">${clean(dueNote)}</span>`;
		const companyLine = entry.customer
			? `<a class="sp-link" href="${companyPage(entry)}">${clean(entry.company)}</a>`
			: `${clean(entry.company)} <span class="sp-new-pill">New</span>`;
		const [person, role] = entry.contact;
		return `<div><dt>Company</dt><dd>${companyLine}</dd></div><div><dt>Contact</dt><dd>${clean(person)}<span class="sp-quiet">${clean(role)}</span></dd></div><div><dt>Kind</dt><dd>${clean(kindById(entry.kind).name)}</dd></div><div><dt>${entry.won ? 'Planned close' : 'Expected close'}</dt><dd>${closeLine}</dd></div><div><dt>Owner</dt><dd><a class="sp-owner" href="${ownerPage(entry.owner)}">${avatarChip(entry.owner)}<span>${clean(entry.owner)}</span></a></dd></div>`;
	}

	/** One main action; anything else sits behind the dots menu. */
	function footMarkup(entry) {
		function overflowMenu(menuItem) {
			return `<div class="dropdown dropup"><button type="button" class="btn btn-outline-secondary btn-square" data-bs-toggle="dropdown" aria-expanded="false" aria-label="More for ${clean(entry.company)}"><i class="bi bi-three-dots" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end"><li>${menuItem}</li></ul></div>`;
		}
		if (entry.lost)
			return `<button type="button" class="btn btn-primary" data-sp-reopen="${clean(entry.id)}"><i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Reopen</button>`;
		if (entry.won)
			return `${overflowMenu(`<button type="button" class="dropdown-item" data-sp-step-back="${clean(entry.id)}"><i class="bi bi-arrow-counterclockwise me-2" aria-hidden="true"></i>Reopen</button>`)}<a class="btn btn-primary" href="invoice-details.html"><i class="bi bi-receipt me-1" aria-hidden="true"></i>View invoice</a>`;
		const atFinal = entry.stage === 'negotiation';
		const mainLabel = atFinal
			? '<i class="bi bi-trophy me-1" aria-hidden="true"></i>Mark as won'
			: 'Next stage<i class="bi bi-arrow-right ms-1" aria-hidden="true"></i>';
		return `${overflowMenu(`<button type="button" class="dropdown-item sp-danger-item" data-sp-lose="${clean(entry.id)}"><i class="bi bi-x-circle me-2" aria-hidden="true"></i>Mark as lost</button>`)}<button type="button" class="btn btn-primary" data-sp-advance="${clean(entry.id)}">${mainLabel}</button>`;
	}

	/* Marking a deal as lost. */

	function askWhyLost(entry) {
		losingDeal = entry;
		lossForm.reset();
		reasonWarning.hidden = true;
		pick('[data-sp-lose-sub]', lossDialog).textContent =
			`${entry.company} · ${entry.title}. It leaves the board and can be reopened later.`;
		window.bootstrap.Modal.getOrCreateInstance(lossDialog).show();
	}

	function onLossSubmit(event) {
		event.preventDefault();
		const choice = pick('input[name="sp-reason"]:checked', lossDialog);
		if (!choice) {
			reasonWarning.hidden = false;
			pick('input[name="sp-reason"]', lossDialog).focus();
			return;
		}
		const entry = losingDeal;
		const remark = pick('[data-sp-lose-note]', lossDialog).value.trim();
		entry.lost = SETUP.today;
		entry.reason = choice.value;
		if (remark) entry.activity.unshift([SETUP.today, SETUP.me, remark]);
		window.bootstrap.Modal.getOrCreateInstance(lossDialog).hide();
		window.bootstrap.Offcanvas.getOrCreateInstance(sidePanel).hide();
		paintAll();
		function undo() {
			delete entry.lost;
			delete entry.reason;
			if (remark) entry.activity.shift();
			paintAll();
			say(`${entry.company} is back on the board.`);
		}
		notify({
			tone: 'success',
			icon: 'bi-x-circle',
			title: `${entry.company} marked as lost`,
			text: `${reasonById(entry.reason).name}. It’s in Lost in ${THIS_MONTH_NAME} below the board.`,
			duration: 8000,
			actions: [{ label: 'Undo', onClick: undo }],
		});
		remote.lose(entry.id, entry.reason, remark).catch(() => {
			undo();
			notify(failed('The deal wasn’t updated'));
		});
	}

	/* Adding a deal. */

	function openAddDialog() {
		newDealForm.reset();
		addFields.owner.value = SETUP.me;
		repaintSelect(addFields.owner);
		addFields.dueOn.value = isoDay(new Date(anchor.getTime() + 30 * MS_PER_DAY));
		addFields.dueOn.min = SETUP.today;
		for (const box of [addFields.firm, addFields.what, addFields.yearly, addFields.dueOn])
			box.classList.remove('is-invalid');
		addFields.yearlyError.hidden = true;
		paintPreview();
		window.bootstrap.Modal.getOrCreateInstance(addDialog).show();
	}

	function pickedStage() {
		return pick('input[name="sp-new-stage"]:checked', addDialog)?.value || 'discovery';
	}

	/** The line under the form: what the value adds to the forecast at the
      chosen stage. */
	function paintPreview() {
		const yearly = parseInt(addFields.yearly.value, 10);
		const phase = stageById(pickedStage());
		const odds = oddsFor(phase.id, addFields.dueOn.value || SETUP.today);
		const line =
			yearly > 0
				? `At ${clean(phase.name)} it counts ${odds}%, so <strong>${dollars((yearly * odds) / 100)}</strong> goes into the forecast.`
				: 'Enter the value a year to see what it adds to the forecast.';
		addFields.preview.innerHTML = `<i class="bi bi-graph-up-arrow" aria-hidden="true"></i><span>${line}</span>`;
	}

	function onAddSubmit(event) {
		event.preventDefault();
		const firm = addFields.firm.value.trim();
		const what = addFields.what.value.trim();
		const yearly = parseInt(addFields.yearly.value, 10);
		const dueOn = addFields.dueOn.value;
		const problems = new Map([
			[addFields.firm, !firm],
			[addFields.what, !what],
			[addFields.yearly, !(yearly > 0)],
			[addFields.dueOn, !dueOn || dueOn < SETUP.today],
		]);
		let firstBad = null;
		for (const [box, bad] of problems) {
			box.classList.toggle('is-invalid', bad);
			if (bad && !firstBad) firstBad = box;
		}
		addFields.yearlyError.hidden = yearly > 0;
		if (firstBad) {
			firstBad.focus();
			return;
		}

		const matched = book.find((entry) => entry.customer && entry.company.toLowerCase() === firm.toLowerCase());
		const lane = pickedStage();
		const entry = {
			id: `#${Math.max(...book.map((other) => Number(other.id.replace(/\D/g, '')) || 0)) + 1}`,
			acct: matched ? matched.acct : null,
			company: matched ? matched.company : firm,
			customer: !!matched,
			title: what,
			kind: pick('input[name="sp-kind"]:checked', addDialog).value,
			value: yearly,
			stage: lane,
			read: 0,
			chance: oddsFor(lane, dueOn),
			owner: addFields.owner.value,
			close: dueOn,
			contact: matched ? matched.contact.slice() : ['Not added yet', 'Add a contact from the company'],
			activity: [[SETUP.today, SETUP.me, 'Added the deal.']],
		};
		book.unshift(entry);
		addedHere.add(entry.id);
		criteria.lane = entry.stage;
		window.bootstrap.Modal.getOrCreateInstance(addDialog).hide();
		paintAll();
		pick(`[data-sp-card="${entry.id}"]`, ui.board)?.classList.add('is-moved');
		function undo() {
			book = book.filter((other) => other !== entry);
			paintAll();
			say('Deal removed.');
		}
		notify({
			tone: 'success',
			icon: 'bi-plus-circle',
			title: `Deal added to ${stageById(entry.stage).name}`,
			text: `${entry.company}, ${dollars(entry.value)} a year.`,
			duration: 8000,
			actions: [{ label: 'Undo', onClick: undo }],
		});
		remote.add(entry).catch(() => {
			undo();
			notify(failed('The deal wasn’t added'));
		});
	}

	/* Export of the open deals as CSV. */

	function exportOpenDeals() {
		const live = book.filter(stillOpen);
		const sheet = [
			['Company', 'Deal', 'Kind', 'Stage', 'Value a year', 'Forecast', 'Expected close', 'Owner'],
			...live.map((entry) => [
				entry.company,
				entry.title,
				kindById(entry.kind).name,
				stageById(entry.stage).name,
				entry.value,
				Math.round(forecastShare(entry)),
				entry.close,
				entry.owner,
			]),
		];
		const csv = new Blob([sheet.map((line) => line.map(quoted).join(',')).join('\n')], { type: 'text/csv' });
		const download = document.createElement('a');
		download.href = URL.createObjectURL(csv);
		download.download = `open-deals-${SETUP.today}.csv`;
		download.click();
		setTimeout(() => URL.revokeObjectURL(download.href), 1000);
		notify({
			tone: 'success',
			icon: 'bi-download',
			title: `Exported ${countOf(live.length, 'open deal', 'open deals')}`,
		});
	}

	function quoted(cellValue) {
		return `"${String(cellValue).replace(/"/g, '""')}"`;
	}

	start();
})();
