/**
 * Behavior for leads.html, the inbox of businesses that asked about the
 * product and have not bought yet.
 *
 * A strip of cards at the top shows who still waits for a first answer,
 * the longest wait in front. Below it the full list splits into five
 * views (open, awaiting reply, on trial, converted, not now), narrowed by
 * a search box, an owner and a source. Clicking a row goes to that
 * lead's own page; the panel icon slides in a summary that can step to
 * its neighbors with Alt and the arrow keys. Two cards at the bottom
 * rank where interest comes from and chart it week by week.
 *
 * Wiring it to real data takes two edits: swap SEED for the payload your
 * backend sends (same field names, since every count is derived from it),
 * and fill in the four methods of `server`. Changes show on screen first
 * and roll back with a red toast when a request is rejected.
 * Shared pieces come from basalt.js: tabs, styled selects, choice cards,
 * the segments bar, record stepping, pagination, toasts and empty states.
 */
(() => {
	'use strict';

	const page = pick('[data-eq-root]');
	if (!page) return;

	/* Fixed sample content. The lead records themselves live in
     assets/basalt/js/data/multipurpose/deals.js, so Lead Details reads the same people and a
     converted lead can point at its deal. Prices are per seat per month;
     a year of a plan is billed as ten months, add-ons as all twelve. */
	const SEED = {
		clock: '2026-10-08T15:00',
		viewer: 'John Armstrong',
		team: [
			'John Armstrong',
			'Leslie Ashby',
			'Quentin Cook',
			'Tony Aldridge',
			'Elise Vick',
			'Thomas Morrison',
			'Jeffrey McKay',
		],
		tiers: [
			{ key: 'starter', label: 'Basic', monthly: 15 },
			{ key: 'growth', label: 'Pro', monthly: 32 },
			{ key: 'enterprise', label: 'Max', monthly: 58 },
		],
		extras: [
			{ key: 'route', label: 'Travel Planner', monthly: 6 },
			{ key: 'portal', label: 'Customer Portal', monthly: 4 },
		],
		/* Counts for the four weeks that close on channelsUntil. */
		channels: [
			{ key: 'website', label: 'Website form', glyph: 'bi-window', count: 38, won: 6 },
			{ key: 'search', label: 'Search ads', glyph: 'bi-search', count: 27, won: 3 },
			{ key: 'referral', label: 'Customer referral', glyph: 'bi-people', count: 14, won: 5 },
			{ key: 'event', label: 'Trade show', glyph: 'bi-easel', count: 11, won: 3 },
			{ key: 'partner', label: 'Reseller partner', glyph: 'bi-shop', count: 9, won: 3 },
			{ key: 'webinar', label: 'Webinar', glyph: 'bi-camera-video', count: 7, won: 1 },
		],
		channelsUntil: '2026-10-04',
		/* Monday-to-Sunday weeks; the final four sum to the channel counts. */
		weekly: [
			{ start: '2026-08-10', count: 18, won: 3 },
			{ start: '2026-08-17', count: 21, won: 4 },
			{ start: '2026-08-24', count: 19, won: 3 },
			{ start: '2026-08-31', count: 22, won: 4 },
			{ start: '2026-09-07', count: 24, won: 5 },
			{ start: '2026-09-14', count: 27, won: 6 },
			{ start: '2026-09-21', count: 25, won: 4 },
			{ start: '2026-09-28', count: 30, won: 6 },
		],
		/* The path a lead walks, in order. Not everyone takes a trial. */
		steps: [
			{ key: 'new', label: 'New' },
			{ key: 'contacted', label: 'Contacted' },
			{ key: 'qualified', label: 'Qualified' },
			{ key: 'trial', label: 'On trial' },
			{ key: 'converted', label: 'Converted' },
		],
		parkReasons: [
			'Too small for now',
			'Revisit next quarter',
			'Chose another tool',
			'Staying on paper or spreadsheets',
			'No reply after three tries',
		],
		/* Each record carries a fit score (0-100) with `why`, minutes to the
       first answer in `reply`, a referrer in `via`, and `history` rows of
       [when, who, what, icon] from oldest to newest. */
		records: window.Basalt.data.deals.leads(),
	};

	/**
	 * Where each change would go out to a backend. The demo just waits a
	 * moment, the way a network round trip would.
	 *   add     POST   /api/leads
	 *   update  PATCH  /api/leads/:id
	 *   convert POST   /api/leads/:id/convert
	 *   remove  DELETE /api/leads/:id
	 */
	const server = {
		add(record) {
			return pause(250);
		},
		update(leadId, patch) {
			return pause(250);
		},
		convert(leadId, dealDraft) {
			return pause(250);
		},
		remove(leadId) {
			return pause(250);
		},
	};

	const MINUTE = 60000;
	const DAY_MS = 1440 * MINUTE;
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const NOW = parseStamp(SEED.clock);
	const TODAY_ISO = SEED.clock.slice(0, 10);
	/* Minutes without an answer before a wait turns amber, then red. */
	const AMBER_AFTER = 120;
	const RED_AFTER = 480;
	const ROWS_PER_PAGE = 10;
	const QUEUE_CARDS = 2;
	const SEAT_CAP = 500;
	const DEALS_PAGE = 'deals.html';
	const CHART_FONT = "'Schibsted Grotesk', sans-serif";
	const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
	const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
	const teammateUrl = window.Basalt.data.deals.ownerUrl;

	/* Short word and icon for each kind of history entry. */
	const ENTRY_WORD = {
		form: 'Web form',
		event: 'Trade show',
		webinar: 'Webinar',
		partner: 'From partner',
		email: 'Email',
		call: 'Call',
		demo: 'Demo',
		trial: 'Trial',
		deal: 'Converted',
		pause: 'Not now',
		note: 'Note',
		import: 'Imported',
	};
	const ENTRY_GLYPH = {
		form: 'bi-window',
		event: 'bi-easel',
		webinar: 'bi-camera-video',
		partner: 'bi-shop',
		email: 'bi-envelope',
		call: 'bi-telephone',
		demo: 'bi-display',
		trial: 'bi-hourglass-split',
		deal: 'bi-arrow-right-circle',
		pause: 'bi-pause-circle',
		note: 'bi-check2-circle',
		import: 'bi-upload',
	};

	/* The move that takes an open lead one step further. */
	const ADVANCE = {
		new: { act: 'reply', label: 'Mark as replied', icon: 'bi-reply' },
		contacted: { act: 'qualify', label: 'Mark as qualified', icon: 'bi-check2-circle' },
		qualified: { act: 'convert', label: 'Convert to deal', icon: 'bi-arrow-right-circle' },
		trial: { act: 'convert', label: 'Convert to deal', icon: 'bi-arrow-right-circle' },
	};

	/* What an empty view says when no search or filter is to blame. */
	const BLANK_VIEW = {
		open: {
			glyph: 'bi-envelope-open',
			heading: 'No open leads',
			hint: 'New ones arrive from the website form, search ads and referrals.',
		},
		new: {
			glyph: 'bi-check2-all',
			heading: 'Every lead has a reply',
			hint: 'New leads show here until someone answers them.',
		},
		trial: {
			glyph: 'bi-hourglass',
			heading: 'Nobody is on a trial',
			hint: 'Start one from a qualified lead’s menu.',
		},
		converted: {
			glyph: 'bi-arrow-right-circle',
			heading: 'Nothing converted yet',
			hint: 'Leads you convert to deals show here.',
		},
		notnow: {
			glyph: 'bi-pause-circle',
			heading: 'Nothing set aside',
			hint: 'Leads you move to Not now show here, ready to reopen.',
		},
	};

	/* Sort each view opens with; any view not listed ranks by fit. */
	const VIEW_SORT = { new: ['touch', 'asc'], converted: ['touch', 'desc'], notnow: ['touch', 'desc'] };

	/* Working copy of the records, so undo can put the sample back. */
	const records = SEED.records.map((lead) => ({ ...lead, addons: [...lead.addons], history: [...lead.history] }));
	const filters = { view: 'open', query: '', owner: '', channel: '', sortKey: 'fit', sortDir: 'desc', page: 1 };
	let visible = [];
	let pagerApi = null;
	let findDelay = 0;
	let serial = 1089;
	let peekList = [];
	let stepper = null;
	let peeked = null;
	let parkTarget = null;
	let convertTarget = null;
	let weeklyChart = null;

	const ui = {
		tabs: pick('[data-eq-views]', page),
		search: pick('[data-eq-search]', page),
		ownerPick: pick('[data-eq-owner]', page),
		channelPick: pick('[data-eq-source]', page),
		tally: pick('[data-eq-summary]', page),
		tableBox: pick('[data-eq-table-wrap]', page),
		rows: pick('[data-eq-body]', page),
		blank: pick('[data-eq-noresults]', page),
		blankGlyph: pick('[data-eq-noresults-icon]', page),
		blankHeading: pick('[data-eq-noresults-title]', page),
		blankHint: pick('[data-eq-noresults-text]', page),
		reset: pick('[data-eq-clear]', page),
		pagerBox: pick('[data-eq-pager-wrap]', page),
		pager: pick('[data-eq-pager]', page),
		pagerNote: pick('[data-eq-pager-meta]', page),
		cards: pick('[data-eq-queue]', page),
		cardsIntro: pick('[data-eq-queue-desc]', page),
		cardsMore: pick('[data-eq-queue-all]', page),
		cardsEmpty: pick('[data-eq-queue-done]', page),
		listCard: pick('.eq-list', page),
		picker: pick('[data-eq-import-file]', page),
		canvas: pick('[data-eq-chart]', page),
	};

	const panel = document.getElementById('eq-drawer');
	const panelOwner = panelPart('owner');

	const parkDialog = document.getElementById('eq-not-now');
	const parkForm = pick('[data-eq-notnow-form]', parkDialog);

	const dealDialog = document.getElementById('eq-convert');
	const dealForm = pick('[data-eq-convert-form]', dealDialog);
	const deal = {
		heading: pick('[data-eq-convert-title]', dealDialog),
		tiers: pick('[data-eq-convert-plans]', dealDialog),
		seats: pick('[data-eq-convert-seats]', dealDialog),
		extras: pick('[data-eq-convert-addons]', dealDialog),
		closes: pick('[data-eq-convert-close]', dealDialog),
		owner: pick('[data-eq-convert-owner]', dealDialog),
		total: pick('[data-eq-convert-sum]', dealDialog),
	};

	const intake = document.getElementById('eq-add');
	const intakeForm = pick('[data-eq-add-form]', intake);

	/** Fills the static pickers, binds every control, then draws the page. */
	function start() {
		fillListFilters();
		ui.cardsMore.addEventListener('click', showAllWaiting);
		ui.tabs.addEventListener('change', onViewChange);
		ui.search.addEventListener('input', onSearchInput);
		ui.ownerPick.addEventListener('change', () => applyFilter('owner', ui.ownerPick.value));
		ui.channelPick.addEventListener('change', () => applyFilter('channel', ui.channelPick.value));
		ui.reset.addEventListener('click', () => {
			resetFilters();
			drawList();
			ui.search.focus();
		});
		page.addEventListener('click', onPageClick);
		page.addEventListener('auxclick', (event) => {
			const target = event.button === 1 && rowDestination(event);
			if (target) window.open(target, '_blank');
		});

		setUpParkDialog();
		panelOwner.innerHTML = teamOptions('<option value="">Unassigned</option>');
		panelOwner.addEventListener('change', onPanelOwnerChange);
		panel.addEventListener('click', (event) => {
			const trigger = event.target.closest('[data-eq-act]');
			if (trigger) doAction(trigger.getAttribute('data-eq-act'), trigger.getAttribute('data-eq-id'));
		});
		setUpDealDialog();
		setUpIntake();
		setUpCsv();

		drawChannels();
		drawDots();
		describeWeeks();
		watchChart();
		redrawAll();
	}

	/* Thin wrappers over the DOM and the shared basalt.js services. */

	function pause(ms) {
		return new Promise((done) => setTimeout(done, ms));
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (ch) => entities[ch]);
	}

	function notify(note) {
		return window.Basalt.toasts?.push(note);
	}

	function say(message) {
		window.Basalt.announce?.(message);
	}

	function syncSelect(select) {
		window.Basalt.select?.refresh?.(select);
	}

	function dollars(amount) {
		return `$${Math.round(amount).toLocaleString('en-US')}`;
	}

	function count(amount, noun) {
		return `${amount.toLocaleString('en-US')} ${amount === 1 ? noun : `${noun}s`}`;
	}

	/* Dates are read and written in local time against the demo clock. */

	/** Reads "YYYY-MM-DD" (as noon) or "YYYY-MM-DDTHH:MM" in local time. */
	function parseStamp(text) {
		return new Date(text.length > 10 ? text : `${text}T12:00`);
	}

	function twoDigits(number) {
		return String(number).padStart(2, '0');
	}

	function monthDay(text) {
		const when = parseStamp(text);
		return `${MONTH_ABBR[when.getMonth()]} ${when.getDate()}`;
	}

	function fullDate(text) {
		return `${monthDay(text)} ${parseStamp(text).getFullYear()}`;
	}

	function clock12(text) {
		const when = parseStamp(text);
		const hour = when.getHours();
		return `${hour % 12 || 12}:${twoDigits(when.getMinutes())}${hour < 12 ? ' am' : ' pm'}`;
	}

	/** The demo's current moment, written the way history rows store it. */
	function nowStamp() {
		const when = parseStamp(SEED.clock);
		return `${TODAY_ISO}T${twoDigits(when.getHours())}:${twoDigits(when.getMinutes())}`;
	}

	function isoDay(when) {
		return `${when.getFullYear()}-${twoDigits(when.getMonth() + 1)}-${twoDigits(when.getDate())}`;
	}

	function onToday(when) {
		return when.toDateString() === NOW.toDateString();
	}

	/** A length of time as minutes, hours under two days, else days. */
	function duration(ms) {
		const minutes = Math.max(0, Math.round(ms / MINUTE));
		if (minutes < 60) return `${minutes} min`;
		const hours = Math.floor(minutes / 60);
		return hours < 48 ? `${hours} h` : `${Math.floor(hours / 24)} days`;
	}

	function sinceText(text) {
		const when = parseStamp(text);
		const gap = NOW - when;
		if (gap < 60 * MINUTE) return `${Math.max(1, Math.round(gap / MINUTE))} min ago`;
		if (onToday(when)) return `${Math.floor(gap / (60 * MINUTE))} h ago`;
		const days = Math.round((parseStamp(TODAY_ISO) - parseStamp(text.slice(0, 10))) / DAY_MS);
		if (days === 1) return 'Yesterday';
		return days < 7 ? `${days} days ago` : monthDay(text);
	}

	function trialEndText(text) {
		const days = Math.round((parseStamp(text) - parseStamp(TODAY_ISO)) / DAY_MS);
		if (days < 0) return `ended ${monthDay(text)}`;
		return { 0: 'ends today', 1: 'ends tomorrow' }[days] || `ends in ${days} days`;
	}

	/* Lookups and derived facts about a single lead. */

	function tierOf(key) {
		return SEED.tiers.find((tier) => tier.key === key);
	}

	function channelOf(key) {
		return SEED.channels.find((channel) => channel.key === key);
	}

	function stepOf(key) {
		return SEED.steps.find((step) => step.key === key);
	}

	function extraOf(key) {
		return SEED.extras.find((extra) => extra.key === key);
	}

	function findLead(leadId) {
		return records.find((lead) => lead.id === leadId);
	}

	function extrasPerSeat(keys) {
		return keys.reduce((sum, key) => sum + extraOf(key).monthly, 0);
	}

	/** Yearly value: ten billed months of the plan plus twelve of add-ons, per seat. */
	function annualValue(lead) {
		const tierPrice = tierOf(lead.plan)?.monthly || 0;
		return lead.seats * (tierPrice * 10 + extrasPerSeat(lead.addons) * 12);
	}

	function stillOpen(lead) {
		return ['new', 'contacted', 'qualified', 'trial'].includes(lead.stage);
	}

	function latestEntry(lead) {
		return lead.history[lead.history.length - 1];
	}

	function givenName(lead) {
		return lead.name.split(' ')[0];
	}

	function minutesWaiting(lead) {
		return (NOW - parseStamp(lead.received)) / MINUTE;
	}

	function waitLength(lead) {
		return duration(NOW - parseStamp(lead.received));
	}

	/** 'late', 'warn' or 'fresh', by how long a new lead has gone unanswered. */
	function waitLevel(lead) {
		const minutes = minutesWaiting(lead);
		if (minutes >= RED_AFTER) return 'late';
		return minutes >= AMBER_AFTER ? 'warn' : 'fresh';
	}

	function waitClass(lead) {
		const level = waitLevel(lead);
		return level === 'fresh' ? '' : ` eq-wait-${level}`;
	}

	function stageName(key) {
		return key === 'notnow' ? 'Not now' : stepOf(key).label;
	}

	function leadPage(lead) {
		return `lead-details.html?id=${encodeURIComponent(lead.id)}`;
	}

	function dealPage(lead) {
		return `deal-details.html?id=${encodeURIComponent(lead.deal)}`;
	}

	/* The view, search, owner and source decide which rows show, in what order. */

	function fillListFilters() {
		ui.ownerPick.innerHTML = teamOptions(
			'<option value="" selected>Every owner</option><option value="-">Unassigned</option>',
		);
		const channelOptions = SEED.channels.map(
			(channel) => `<option value="${channel.key}">${htmlSafe(channel.label)}</option>`,
		);
		ui.channelPick.innerHTML = `<option value="" selected>Every source</option>${channelOptions.join('')}`;
		syncSelect(ui.ownerPick);
		syncSelect(ui.channelPick);
	}

	function teamOptions(leading) {
		return (
			leading +
			SEED.team.map((person) => `<option value="${htmlSafe(person)}">${htmlSafe(person)}</option>`).join('')
		);
	}

	function belongsTo(lead, view) {
		return view === 'open' ? stillOpen(lead) : lead.stage === view;
	}

	function passesFilters(lead) {
		if (!belongsTo(lead, filters.view)) return false;
		if (filters.owner) {
			const ownerMiss = filters.owner === '-' ? Boolean(lead.owner) : lead.owner !== filters.owner;
			if (ownerMiss) return false;
		}
		if (filters.channel && lead.source !== filters.channel) return false;
		if (!filters.query) return true;
		const haystack = [lead.name, lead.title, lead.company, lead.city, lead.email, lead.owner, lead.id].join(' ');
		if (window.Basalt?.matchesQuery) return window.Basalt.matchesQuery(haystack, filters.query);
		return haystack.toLowerCase().includes(filters.query.toLowerCase());
	}

	/* Rows that tie on the sort key fall back to name order, except by last
     touch, where they keep list order so a fresh lead stays on top. */
	function ordered(list) {
		const sign = filters.sortDir === 'asc' ? 1 : -1;
		const keyOf = {
			name: (lead) => lead.name.toLowerCase(),
			value: annualValue,
			fit: (lead) => lead.fit ?? -1,
			touch: (lead) => latestEntry(lead)[0],
		}[filters.sortKey];
		return [...list].sort((left, right) => {
			const a = keyOf(left);
			const b = keyOf(right);
			if (a < b) return -sign;
			if (a > b) return sign;
			return filters.sortKey === 'touch' ? 0 : left.name.localeCompare(right.name);
		});
	}

	function onViewChange(event) {
		if (event.target.name !== 'eq-view') return;
		filters.view = event.target.value;
		[filters.sortKey, filters.sortDir] = VIEW_SORT[filters.view] || ['fit', 'desc'];
		filters.page = 1;
		drawList();
	}

	/** Ticks a view tab by code, which then runs its normal change handler. */
	function switchView(view) {
		const radio = document.getElementById(`eq-view-${view}`);
		if (!radio || radio.checked) return;
		radio.checked = true;
		radio.dispatchEvent(new Event('change', { bubbles: true }));
	}

	function onSearchInput() {
		clearTimeout(findDelay);
		findDelay = setTimeout(() => applyFilter('query', ui.search.value.trim()), 120);
	}

	function applyFilter(name, value) {
		filters[name] = value;
		filters.page = 1;
		drawList();
	}

	function resetFilters() {
		ui.search.value = '';
		Object.assign(filters, { query: '', owner: '', channel: '' });
		ui.ownerPick.value = '';
		ui.channelPick.value = '';
		syncSelect(ui.ownerPick);
		syncSelect(ui.channelPick);
		filters.page = 1;
	}

	function resort(key) {
		if (filters.sortKey === key) {
			filters.sortDir = filters.sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			filters.sortKey = key;
			filters.sortDir = key === 'name' ? 'asc' : 'desc';
		}
		filters.page = 1;
		drawList();
	}

	function showAllWaiting() {
		resetFilters();
		switchView('new');
		drawList();
		ui.listCard.scrollIntoView({ behavior: motionQuery.matches ? 'auto' : 'smooth', block: 'start' });
	}

	/* Clicks anywhere in the page funnel through one delegated handler. */

	/** One listener for sort headers, row actions, quick view and row links. */
	function onPageClick(event) {
		const sorter = event.target.closest('[data-eq-sort-by]');
		if (sorter) {
			resort(sorter.getAttribute('data-eq-sort-by'));
			return;
		}
		const trigger = event.target.closest('[data-eq-act]');
		if (trigger) {
			doAction(trigger.getAttribute('data-eq-act'), trigger.getAttribute('data-eq-id'));
			return;
		}
		const peek = event.target.closest('[data-eq-open]');
		if (peek) {
			openPanel(peek.getAttribute('data-eq-open'));
			return;
		}
		/* Anywhere else on a row or a waiting card follows the name link;
       Cmd, Ctrl or Shift sends it to a new tab instead. */
		const target = rowDestination(event);
		if (!target) return;
		if (event.metaKey || event.ctrlKey || event.shiftKey) window.open(target, '_blank');
		else location.href = target;
	}

	/** The lead page a click on bare row space leads to, or nothing. */
	function rowDestination(event) {
		const holder = event.target.closest('[data-eq-row], [data-eq-ask]');
		if (!holder || event.target.closest('a, button, input, .dropdown-menu')) return '';
		return pick('.eq-who-name, .eq-ask-name', holder).href;
	}

	/* Markup for the queue cards, the table rows, the pager and empty states. */

	function redrawAll() {
		drawTabCounts();
		drawQueue();
		drawList();
	}

	function drawTabCounts() {
		for (const view of ['open', 'new', 'trial', 'converted', 'notnow']) {
			pick(`[data-eq-count="${view}"]`, page).textContent = records.filter((lead) =>
				belongsTo(lead, view),
			).length;
		}
	}

	function avatarHtml(name, sizeClass) {
		return `<span class="basalt-avatar ${sizeClass || ''} basalt-avatar-tone-${toneNumber(name)}" aria-hidden="true">${htmlSafe(initialsOf(name))}</span>`;
	}

	function initialsOf(name) {
		const words = name.replace(/&/g, ' ').split(/\s+/).filter(Boolean);
		return words
			.map((word) => word[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	/** Hashes a name to one of eight avatar tones, so it never changes color. */
	function toneNumber(name) {
		const hash = name
			.toLowerCase()
			.split('')
			.reduce((acc, ch) => (Math.imul(acc, 31) + ch.charCodeAt(0)) >>> 0, 0);
		return (hash % 8) + 1;
	}

	/* Quick view and Open full page, side by side at the end of a row or card. */
	function viewToggles(lead) {
		const name = htmlSafe(lead.name);
		const peek = `<button type="button" class="btn btn-icon btn-sm" aria-label="Quick view: ${name}" data-eq-open="${htmlSafe(lead.id)}" data-bs-toggle="tooltip" data-bs-title="Quick view" data-bs-trigger="hover"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>`;
		const full = `<a class="btn btn-icon btn-sm" aria-label="Open full page: ${name}" href="${leadPage(lead)}" data-bs-toggle="tooltip" data-bs-title="Open full page" data-bs-trigger="hover"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>`;
		return peek + full;
	}

	function stageChip(key) {
		return `<span class="eq-stage eq-tone-${key}">${htmlSafe(stageName(key))}</span>`;
	}

	function fitLevel(score) {
		if (score >= 75) return 'strong';
		return score >= 55 ? 'fair' : 'weak';
	}

	function fitMeter(lead) {
		if (lead.fit == null) return '<span class="eq-sub eq-sub-flat">Not scored</span>';
		const meter = `<span class="eq-fit-bar" aria-hidden="true"><span class="eq-fit-fill" style="--w:${lead.fit}%"></span></span>`;
		return `<span class="eq-fit eq-fit-${fitLevel(lead.fit)}" title="${htmlSafe(lead.why)}">${meter}<span class="eq-fit-val">${lead.fit}</span><span class="visually-hidden"> out of 100</span></span>`;
	}

	function tierPrefix(tier) {
		return tier ? `${htmlSafe(tier.label)} · ` : '';
	}

	function interestCell(lead) {
		const tier = tierOf(lead.plan);
		const worth = tier ? `${dollars(annualValue(lead))} a year` : 'Plan not chosen';
		return `<span class="eq-cell-main">${tierPrefix(tier)}${count(lead.seats, 'seat')}</span><span class="eq-sub">${worth}</span>`;
	}

	/** Owner cell; `folded` is the compact copy tucked under the name. */
	function ownerCell(lead, folded) {
		if (!lead.owner) {
			const glyph = folded ? '' : '<i class="bi bi-person-dash" aria-hidden="true"></i>';
			return `<span class="eq-unassigned">${glyph}Unassigned</span>`;
		}
		const face = avatarHtml(lead.owner, 'basalt-avatar-xs');
		if (folded) return `${face}${htmlSafe(lead.owner)}`;
		return `<a class="eq-owner" href="${teammateUrl(lead.owner)}">${face}<span>${htmlSafe(lead.owner)}</span></a>`;
	}

	function cellPair(main, sub, mainClass = '') {
		return `<span class="eq-cell-main${mainClass}">${main}</span><span class="eq-sub">${sub}</span>`;
	}

	/* Last touch reads differently per stage: waiting time, trial end,
     conversion or parking date, or the latest history entry. */
	function touchCell(lead) {
		switch (lead.stage) {
			case 'new': {
				const arrived = parseStamp(lead.received);
				const at = onToday(arrived)
					? clock12(lead.received)
					: `${monthDay(lead.received)}, ${clock12(lead.received)}`;
				return cellPair(`Waiting ${waitLength(lead)}`, `Received ${at}`, ` eq-wait${waitClass(lead)}`);
			}
			case 'trial':
				return cellPair(`Trial ${trialEndText(lead.trialEnds)}`, `Started ${monthDay(latestEntry(lead)[0])}`);
			case 'converted':
				return cellPair(fullDate(lead.converted), `Became deal ${htmlSafe(lead.deal)}`);
			case 'notnow':
				return cellPair(fullDate(lead.parked), htmlSafe(lead.reason));
			default: {
				const [when, who, , kind] = latestEntry(lead);
				return cellPair(
					sinceText(when),
					`${htmlSafe(ENTRY_WORD[kind] || 'Note')} · ${htmlSafe(who.split(' ')[0])}`,
				);
			}
		}
	}

	function menuButton(act, lead, icon, label, extraClass) {
		return `<li><button type="button" class="dropdown-item${extraClass ? ` ${extraClass}` : ''}" data-eq-act="${act}" data-eq-id="${htmlSafe(lead.id)}"><i class="bi ${icon}" aria-hidden="true"></i>${htmlSafe(label)}</button></li>`;
	}

	function rowMenu(lead) {
		const divider = '<li><hr class="dropdown-divider"></li>';
		const entries = [
			`<li><a class="dropdown-item" href="mailto:${htmlSafe(lead.email)}"><i class="bi bi-envelope" aria-hidden="true"></i>Email ${htmlSafe(givenName(lead))}</a></li>`,
		];
		if (lead.stage === 'converted') {
			entries.push(
				`<li><a class="dropdown-item" href="${dealPage(lead)}"><i class="bi bi-file-earmark-check" aria-hidden="true"></i>Open the deal</a></li>`,
			);
		}
		if (stillOpen(lead)) {
			const move = ADVANCE[lead.stage];
			entries.push(divider, menuButton(move.act, lead, move.icon, move.label));
			if (lead.stage === 'qualified')
				entries.push(menuButton('trial', lead, 'bi-hourglass-split', 'Start a 14-day trial'));
			if (lead.owner !== SEED.viewer) entries.push(menuButton('mine', lead, 'bi-person-check', 'Assign to me'));
			entries.push(menuButton('notnow', lead, 'bi-pause-circle', 'Not now'));
		}
		if (lead.stage === 'notnow')
			entries.push(divider, menuButton('reopen', lead, 'bi-arrow-counterclockwise', 'Reopen'));
		if (lead.stage !== 'converted')
			entries.push(menuButton('delete', lead, 'bi-trash', 'Delete', 'eq-danger-item'));
		return entries.join('');
	}

	function leadRow(lead) {
		const name = htmlSafe(lead.name);
		const fold = `<span class="eq-fold"><span class="eq-fold-stage">${stageChip(lead.stage)}</span><span class="eq-fold-owner">${ownerCell(lead, true)}</span></span>`;
		const who = `<div class="eq-who">${avatarHtml(lead.name)}<div class="eq-who-text"><a class="eq-who-name" href="${leadPage(lead)}">${name}</a><span class="eq-sub">${htmlSafe(lead.company)}</span>${fold}</div></div>`;
		const menu = `<div class="dropdown"><button type="button" class="btn btn-icon eq-menu-btn" aria-label="Actions for ${name}" aria-expanded="false" data-bs-toggle="dropdown"><i class="bi bi-three-dots" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end">${rowMenu(lead)}</ul></div>`;
		return [
			`<tr class="eq-row" data-eq-row="${htmlSafe(lead.id)}">`,
			`<td class="eq-col-who">${who}</td>`,
			`<td class="eq-col-want">${interestCell(lead)}</td>`,
			`<td class="eq-col-fit">${fitMeter(lead)}</td>`,
			`<td class="eq-col-stage">${stageChip(lead.stage)}</td>`,
			`<td class="eq-col-owner">${ownerCell(lead)}</td>`,
			`<td class="eq-col-touch">${touchCell(lead)}</td>`,
			`<td class="eq-col-menu"><div class="basalt-row-actions">${viewToggles(lead)}${menu}</div></td>`,
			'</tr>',
		].join('');
	}

	/* The longest waits as cards; the rest sit one click away in the
     Awaiting reply view. */
	function drawQueue() {
		const waiting = records
			.filter((lead) => lead.stage === 'new')
			.sort((a, b) => minutesWaiting(b) - minutesWaiting(a));
		const answered = records.filter((lead) => lead.reply != null);
		const average = answered.length
			? Math.round(answered.reduce((sum, lead) => sum + lead.reply, 0) / answered.length)
			: 0;
		const averageText = average >= 60 ? `${Math.floor(average / 60)} h ${average % 60} min` : `${average} min`;
		let opening = '';
		if (waiting.length) {
			const who = waiting.length === 1 ? 'One person is' : `${waiting.length} people are`;
			opening = `${who} waiting, the longest for ${waitLength(waiting[0])}. `;
		}
		ui.cardsIntro.textContent = `${opening}The team’s first reply takes ${averageText} on average.`;
		ui.cardsMore.hidden = waiting.length <= QUEUE_CARDS;
		ui.cardsMore.textContent = `See all ${waiting.length} waiting`;
		ui.cardsEmpty.hidden = waiting.length > 0;
		ui.cards.hidden = !waiting.length;
		ui.cards.innerHTML = waiting.slice(0, QUEUE_CARDS).map(queueCard).join('');
		window.Basalt.tips?.(ui.cards);
	}

	/* A waiting lead: who, what they asked, and the two replies. */
	function queueCard(lead) {
		const leadId = htmlSafe(lead.id);
		const head = `<div class="eq-ask-who">${avatarHtml(lead.name)}<div class="eq-ask-text"><a class="eq-ask-name" href="${leadPage(lead)}">${htmlSafe(lead.name)}</a><span class="eq-sub">${htmlSafe(lead.company)}</span></div><span class="eq-ask-pill">Waiting ${waitLength(lead)}</span></div>`;
		const facts = `${tierPrefix(tierOf(lead.plan))}${count(lead.seats, 'seat')} · ${htmlSafe(channelOf(lead.source).label)}`;
		const foot = `<div class="eq-ask-foot"><p class="eq-ask-meta">${facts}</p><div class="eq-ask-actions"><a class="btn btn-primary btn-sm" href="mailto:${htmlSafe(lead.email)}"><i class="bi bi-reply me-1" aria-hidden="true"></i>Reply</a><button type="button" class="btn btn-outline-secondary btn-sm" data-eq-id="${leadId}" data-eq-act="reply">Mark replied</button></div></div>`;
		return `<li class="eq-ask eq-ask-${waitLevel(lead)}" data-eq-ask="${leadId}">${head}<p class="eq-ask-msg">${htmlSafe(lead.message)}</p>${foot}</li>`;
	}

	function drawList() {
		visible = ordered(records.filter(passesFilters));
		const total = visible.length;
		const pageCount = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
		filters.page = Math.min(filters.page, pageCount);
		const first = (filters.page - 1) * ROWS_PER_PAGE;
		const narrowed = Boolean(filters.query || filters.owner || filters.channel);

		ui.blank.hidden = total > 0;
		ui.tableBox.hidden = total === 0;
		if (!total) explainEmpty(narrowed);
		ui.reset.hidden = !narrowed;
		ui.rows.innerHTML = visible
			.slice(first, first + ROWS_PER_PAGE)
			.map(leadRow)
			.join('');
		window.Basalt.tips?.(ui.rows);
		const seats = visible.reduce((sum, lead) => sum + lead.seats, 0);
		ui.tally.textContent = total ? `${count(total, 'lead')} · ${count(seats, 'seat')}` : '';

		ui.pagerBox.hidden = total <= ROWS_PER_PAGE;
		ui.pagerNote.innerHTML = `<strong>${first + 1}–${Math.min(first + ROWS_PER_PAGE, total)}</strong> of ${count(total, 'lead')}`;
		if (window.Basalt.pagination && total > ROWS_PER_PAGE) syncPager(pageCount);
		markSortHeads();
	}

	function syncPager(pageCount) {
		if (pagerApi) {
			pagerApi.setTotal(pageCount);
			if (pagerApi.get() !== filters.page) pagerApi.set(filters.page);
			return;
		}
		pagerApi = window.Basalt.pagination(ui.pager, {
			label: 'Leads page',
			total: pageCount,
			current: filters.page,
			onChange(chosen) {
				if (chosen === filters.page) return;
				filters.page = chosen;
				drawList();
			},
		});
	}

	function explainEmpty(narrowed) {
		const blank = BLANK_VIEW[filters.view];
		ui.blankGlyph.className = `bi ${narrowed ? 'bi-search' : blank.glyph}`;
		ui.blankHeading.textContent = narrowed ? 'No lead matches' : blank.heading;
		if (!narrowed) {
			ui.blankHint.textContent = blank.hint;
		} else if (filters.query) {
			const withPickers = Boolean(filters.owner || filters.channel);
			ui.blankHint.textContent = `Nothing matches “${filters.query}”${withPickers ? ' with these filters' : ' in this view'}. Try another spelling${withPickers ? ', or clear the filters.' : '.'}`;
		} else {
			ui.blankHint.textContent = 'No lead in this view fits these filters. Clear one to see more.';
		}
	}

	function markSortHeads() {
		for (const head of pickAll('[data-eq-th]', page)) {
			const active = head.getAttribute('data-eq-th') === filters.sortKey;
			const rising = filters.sortDir === 'asc';
			if (active) head.setAttribute('aria-sort', rising ? 'ascending' : 'descending');
			else head.removeAttribute('aria-sort');
			const arrow = rising ? 'bi-arrow-up' : 'bi-arrow-down';
			pick('.bi', head).className = `bi ${active ? arrow : 'bi-arrow-down-up eq-sort-idle'}`;
		}
	}

	/* Every change to a lead shows at once and is undone if the server refuses it. */

	/* Each simple move edits the lead in place and returns its toast. */
	const MOVES = {
		reply(lead) {
			lead.owner = lead.owner || SEED.viewer;
			lead.stage = 'contacted';
			lead.reply = Math.round(minutesWaiting(lead));
			logEntry(lead, `Replied to ${givenName(lead)}.`, 'email');
			return {
				icon: 'bi-reply',
				title: `${lead.name} marked as replied`,
				text: `First reply after ${waitLength(lead)}.`,
			};
		},
		qualify(lead) {
			lead.stage = 'qualified';
			logEntry(lead, 'Marked as qualified.', 'note');
			return {
				icon: 'bi-check2-circle',
				title: `${lead.company} is qualified`,
				text: 'Ready to convert to a deal or start a trial.',
			};
		},
		trial(lead) {
			lead.stage = 'trial';
			lead.trialEnds = isoDay(new Date(parseStamp(TODAY_ISO).getTime() + 14 * DAY_MS));
			logEntry(lead, `Started a 14-day ${(tierOf(lead.plan) || SEED.tiers[1]).label} trial.`, 'trial');
			return {
				icon: 'bi-hourglass-split',
				title: `${lead.company} started a trial`,
				text: `It ends on ${fullDate(lead.trialEnds)}.`,
			};
		},
		mine(lead) {
			lead.owner = SEED.viewer;
			return { icon: 'bi-person-check', title: `${lead.name} is yours now` };
		},
		reopen(lead) {
			lead.stage = 'contacted';
			delete lead.reason;
			delete lead.parked;
			logEntry(lead, 'Reopened the lead.', 'note');
			return { icon: 'bi-arrow-counterclockwise', title: `${lead.name}’s lead reopened` };
		},
	};

	function logEntry(lead, what, kind) {
		lead.history.push([nowStamp(), SEED.viewer, what, kind]);
	}

	function doAction(kind, leadId) {
		const lead = findLead(leadId);
		if (!lead) return;
		if (kind === 'convert' || kind === 'notnow') {
			/* Two focus traps cannot share the screen, so the panel closes first. */
			if (panel.classList.contains('show')) window.bootstrap.Offcanvas.getOrCreateInstance(panel).hide();
			if (kind === 'convert') openDealDialog(lead);
			else openParkDialog(lead);
			return;
		}
		if (kind === 'delete') {
			discard(lead);
			return;
		}
		if (!Object.hasOwn(MOVES, kind)) return;
		const saved = clone(lead);
		const undo = commit(lead, saved, MOVES[kind](lead));
		server
			.update(lead.id, { stage: lead.stage, owner: lead.owner })
			.catch(() => rollBack(undo, 'The lead didn’t change'));
	}

	function clone(lead) {
		return JSON.parse(JSON.stringify(lead));
	}

	/** Puts a lead back to a saved copy, dropping keys the copy lacks. */
	function revert(lead, saved) {
		for (const key of Object.keys(lead)) {
			if (!(key in saved)) delete lead[key];
		}
		Object.assign(lead, saved);
	}

	/**
	 * Redraws after a change, keeps the open panel current, and shows a
	 * toast with Undo. Returns that undo so a failed request can call it.
	 */
	function commit(lead, saved, note) {
		redrawAll();
		if (peeked === lead) {
			const footFocused =
				panel.contains(document.activeElement) && panelPart('foot').contains(document.activeElement);
			fillPanel(lead);
			/* The footer buttons were rebuilt, so focus goes back to the title. */
			if (panel.classList.contains('show') && (footFocused || document.activeElement === document.body))
				panelPart('name').focus();
		}
		function undo() {
			revert(lead, saved);
			redrawAll();
			if (peeked === lead) fillPanel(lead);
			say(`${lead.name}’s lead is back where it was.`);
		}
		const actions = [...(note.actions || []), { label: 'Undo', onClick: undo }];
		notify({ tone: 'success', icon: note.icon, title: note.title, text: note.text, duration: 8000, actions });
		return undo;
	}

	function rollBack(undo, headline) {
		undo();
		notify({ tone: 'danger', title: headline, text: 'Nothing was saved. Try again in a moment.' });
	}

	function discard(lead) {
		const slot = records.indexOf(lead);
		records.splice(slot, 1);
		if (peeked === lead) window.bootstrap.Offcanvas.getOrCreateInstance(panel).hide();
		redrawAll();
		function undo() {
			records.splice(slot, 0, lead);
			redrawAll();
			say(`${lead.name}’s lead is back.`);
		}
		notify({
			tone: 'success',
			icon: 'bi-trash',
			title: `${lead.name}’s lead deleted`,
			duration: 8000,
			actions: [{ label: 'Undo', onClick: undo }],
		});
		server.remove(lead.id).catch(() => rollBack(undo, 'Couldn’t delete the lead'));
	}

	/* Parking a lead asks for a reason first. */

	function setUpParkDialog() {
		pick('[data-eq-notnow-reasons]', parkDialog).innerHTML = SEED.parkReasons
			.map(
				(reason, index) =>
					`<input type="radio" class="btn-check" id="eq-not-now-r-${index}" name="eq-notnow-reason" value="${htmlSafe(reason)}"${index === 0 ? ' checked' : ''}><label class="eq-chip" for="eq-not-now-r-${index}">${htmlSafe(reason)}</label>`,
			)
			.join('');
		parkForm.addEventListener('submit', onParkSubmit);
	}

	function openParkDialog(lead) {
		parkTarget = lead;
		pick('[data-eq-notnow-title]', parkDialog).textContent = `Move ${lead.company} to Not now?`;
		parkForm.reset();
		window.bootstrap.Modal.getOrCreateInstance(parkDialog).show();
	}

	function onParkSubmit(event) {
		event.preventDefault();
		const lead = parkTarget;
		if (!lead) return;
		const reason = pick('input[name="eq-notnow-reason"]:checked', parkDialog)?.value || SEED.parkReasons[0];
		const saved = clone(lead);
		Object.assign(lead, { stage: 'notnow', reason, parked: TODAY_ISO });
		logEntry(lead, `Not now: ${reason.toLowerCase()}.`, 'pause');
		window.bootstrap.Modal.getOrCreateInstance(parkDialog).hide();
		const undo = commit(lead, saved, {
			icon: 'bi-pause-circle',
			title: `${lead.company} moved to Not now`,
			text: `${reason}.`,
		});
		server.update(lead.id, { stage: 'notnow', reason }).catch(() => rollBack(undo, 'Couldn’t move the lead'));
	}

	/* The side panel shows one lead and steps through the rows on screen. */

	function panelPart(name) {
		return pick(`[data-eq-d="${name}"]`, panel);
	}

	/** Opens the panel on one lead, able to step through the rows on screen. */
	function openPanel(leadId) {
		peekList = [...visible];
		let index = peekList.findIndex((lead) => lead.id === leadId);
		if (index < 0) {
			peekList = [findLead(leadId)];
			index = 0;
		}
		/* recordNav reads the count on every step through valueOf, so this one
       binding keeps up as the list grows or shrinks. */
		if (!stepper && window.Basalt.drawer) {
			stepper = window.Basalt.drawer.recordNav(panel, { valueOf: () => Math.max(1, peekList.length) }, (at) =>
				fillPanel(peekList[at]),
			);
		}
		if (stepper) stepper.go(index, 0);
		else fillPanel(peekList[index]);
		pick('.basalt-drawer-nav', panel).hidden = peekList.length < 2;
		window.bootstrap.Offcanvas.getOrCreateInstance(panel).show();
	}

	function fillPanel(lead) {
		if (!lead) return;
		peeked = lead;
		const face = panelPart('avatar');
		face.className = `basalt-avatar basalt-avatar-tone-${toneNumber(lead.name)}`;
		face.textContent = initialsOf(lead.name);
		panelPart('name').textContent = lead.name;
		panelPart('full').href = leadPage(lead);
		panelPart('sub').textContent = `${lead.title}, ${lead.company}`;
		panelPart('message').textContent = lead.message;
		const channel = channelOf(lead.source);
		const referrer = lead.via ? `, from ${htmlSafe(lead.via)}` : '';
		panelPart('meta').innerHTML =
			`<i class="bi ${channel.glyph}" aria-hidden="true"></i>${htmlSafe(channel.label)}${referrer} · ${fullDate(lead.received)}, ${clock12(lead.received)}`;
		panelPart('reach').innerHTML = contactList(lead);
		panelPart('steps').innerHTML = progressHtml(lead);
		const fitBox = panelPart('fit');
		fitBox.hidden = lead.fit == null;
		if (lead.fit != null)
			fitBox.innerHTML = `${fitMeter(lead)}<span class="eq-d-fit-why"><strong>Fit ${lead.fit} of 100.</strong> ${htmlSafe(lead.why)}</span>`;
		panelPart('needs').innerHTML = needsList(lead);
		panelOwner.value = lead.owner || '';
		panelOwner.disabled = !stillOpen(lead);
		syncSelect(panelOwner);
		panelPart('history').innerHTML = [...lead.history].reverse().map(historyItem).join('');
		panelPart('foot').innerHTML = panelFooter(lead);
	}

	function contactList(lead) {
		const mail = `<li><a class="eq-link" href="mailto:${htmlSafe(lead.email)}"><i class="bi bi-envelope" aria-hidden="true"></i>${htmlSafe(lead.email)}</a></li>`;
		const phone = lead.phone
			? `<li><a class="eq-link" href="tel:${htmlSafe(lead.phone.replace(/\s+/g, ''))}"><i class="bi bi-telephone" aria-hidden="true"></i>${htmlSafe(lead.phone)}</a></li>`
			: '';
		return `${mail}${phone}<li class="eq-reach-city"><i class="bi bi-geo-alt" aria-hidden="true"></i>${htmlSafe(lead.city)}</li>`;
	}

	function historyItem([when, who, what, kind]) {
		return `<li class="eq-act"><span class="eq-act-icon" aria-hidden="true"><i class="bi ${ENTRY_GLYPH[kind] || 'bi-dot'}"></i></span><span class="eq-act-text">${htmlSafe(what)}<span class="eq-sub">${htmlSafe(who)} · ${monthDay(when)}, ${clock12(when)}</span></span></li>`;
	}

	/* A parked lead shows as far as Contacted, in gray. */
	function progressHtml(lead) {
		const path = SEED.steps;
		const reached = path.findIndex((step) => step.key === (lead.stage === 'notnow' ? 'contacted' : lead.stage));
		const captions = {
			new: () => `<span class="eq-wait${waitClass(lead)}">Waiting ${waitLength(lead)} for a first reply</span>`,
			trial: () => `Trial ${trialEndText(lead.trialEnds)}`,
			converted: () => `Became deal ${htmlSafe(lead.deal)} on ${fullDate(lead.converted)}`,
			notnow: () => `${htmlSafe(lead.reason)}, since ${fullDate(lead.parked)}`,
		};
		const caption = captions[lead.stage]?.() ?? `Step ${reached + 1} of ${path.length}`;
		const blocks = path
			.map((step, index) => `<span class="basalt-segments-block${index <= reached ? ' is-on' : ''}"></span>`)
			.join('');
		return `<p class="eq-steps-label">${stageChip(lead.stage)}<span class="eq-sub">${caption}</span></p><div class="basalt-segments eq-steps-bar${lead.stage === 'notnow' ? ' is-parked' : ''}" aria-hidden="true">${blocks}</div>`;
	}

	function needsList(lead) {
		const tier = tierOf(lead.plan);
		const facts = [
			{
				label: 'Plan',
				value: tier ? htmlSafe(tier.label) : 'Not chosen yet',
				note: tier ? `$${tier.monthly} a seat a month` : '',
			},
			{ label: 'Seats', value: count(lead.seats, 'seat'), note: '' },
		];
		if (lead.addons.length) {
			const names = lead.addons.map((key) => htmlSafe(extraOf(key).label)).join(', ');
			facts.push({ label: 'Add-ons', value: names, note: `$${extrasPerSeat(lead.addons)} a seat a month` });
		}
		const items = facts.map(
			({ label, value, note }) =>
				`<li class="eq-fact"><span class="eq-fact-label">${label}</span><span class="eq-fact-value">${value}${note ? `<span class="eq-sub">${note}</span>` : ''}</span></li>`,
		);
		if (tier)
			items.push(
				`<li class="eq-fact eq-fact-total"><span class="eq-fact-label">A year</span><span class="eq-fact-value">${dollars(annualValue(lead))}</span></li>`,
			);
		return items.join('');
	}

	function panelFooter(lead) {
		if (lead.stage === 'converted') {
			return `<a class="btn btn-primary" href="${dealPage(lead)}"><i class="bi bi-file-earmark-check me-1" aria-hidden="true"></i>Open the deal</a>`;
		}
		const move =
			lead.stage === 'notnow'
				? { act: 'reopen', icon: 'bi-arrow-counterclockwise', label: 'Reopen' }
				: ADVANCE[lead.stage];
		return `<button type="button" class="btn btn-primary" data-eq-act="${move.act}" data-eq-id="${htmlSafe(lead.id)}"><i class="bi ${move.icon} me-1" aria-hidden="true"></i>${move.label}</button>`;
	}

	function onPanelOwnerChange() {
		const lead = peeked;
		if (!lead) return;
		const saved = clone(lead);
		lead.owner = panelOwner.value;
		const title = lead.owner ? `${lead.name} assigned to ${lead.owner}` : `${lead.name} is unassigned`;
		const undo = commit(lead, saved, { icon: 'bi-person-check', title });
		server.update(lead.id, { owner: lead.owner }).catch(() => rollBack(undo, 'Couldn’t change the owner'));
	}

	/* Converting asks for plan, seats, add-ons, close date and owner. */

	function setUpDealDialog() {
		deal.tiers.innerHTML = SEED.tiers
			.map(
				(tier) =>
					`<label class="basalt-choice-card"><input type="radio" class="basalt-choice-card-input" name="eq-conv-plan" value="${tier.key}"><span class="basalt-choice-card-mark" aria-hidden="true"><i class="bi bi-check-lg"></i></span><span class="basalt-choice-card-title">${htmlSafe(tier.label)}</span><span class="basalt-choice-card-text">$${tier.monthly} a seat a month</span></label>`,
			)
			.join('');
		deal.extras.innerHTML = SEED.extras
			.map(
				(extra) =>
					`<div class="form-check"><input type="checkbox" class="form-check-input" id="eq-conv-addon-${extra.key}" value="${extra.key}" data-eq-conv-addon><label class="form-check-label" for="eq-conv-addon-${extra.key}">${htmlSafe(extra.label)} <span class="eq-optional">$${extra.monthly} a seat</span></label></div>`,
			)
			.join('');
		deal.owner.innerHTML = teamOptions('');
		syncSelect(deal.owner);

		dealForm.addEventListener('input', (event) => {
			drawDealTotal();
			if (event.target === deal.seats || event.target === deal.closes)
				event.target.classList.remove('is-invalid');
		});
		dealForm.addEventListener('change', drawDealTotal);
		dealForm.addEventListener('submit', onDealSubmit);
	}

	function readDealForm() {
		return {
			plan: pick('input[name="eq-conv-plan"]:checked', dealDialog)?.value || 'growth',
			seats: parseInt(deal.seats.value, 10) || 0,
			addons: pickAll('[data-eq-conv-addon]:checked', dealDialog).map((box) => box.value),
		};
	}

	function seatsInRange(seats) {
		return seats >= 1 && seats <= SEAT_CAP;
	}

	function drawDealTotal() {
		const draft = readDealForm();
		const icon = '<i class="bi bi-calculator" aria-hidden="true"></i>';
		deal.total.innerHTML = seatsInRange(draft.seats)
			? `${icon}<span><strong>${dollars(annualValue(draft))}</strong> a year for ${count(draft.seats, 'seat')}. ${htmlSafe(deal.owner.value)} looks after it as a deal.</span>`
			: `${icon}<span>Enter the number of seats to see the yearly value.</span>`;
	}

	function openDealDialog(lead) {
		convertTarget = lead;
		dealForm.reset();
		deal.heading.textContent = `Convert ${lead.company} to a deal`;
		const tierRadio = pick(`input[name="eq-conv-plan"][value="${lead.plan || 'growth'}"]`, dealDialog);
		if (tierRadio) tierRadio.checked = true;
		deal.seats.value = lead.seats;
		for (const box of pickAll('[data-eq-conv-addon]', dealDialog)) box.checked = lead.addons.includes(box.value);
		deal.closes.value = '2026-12-15';
		deal.owner.value = lead.owner || SEED.viewer;
		syncSelect(deal.owner);
		deal.seats.classList.remove('is-invalid');
		deal.closes.classList.remove('is-invalid');
		drawDealTotal();
		window.bootstrap.Modal.getOrCreateInstance(dealDialog).show();
	}

	function onDealSubmit(event) {
		event.preventDefault();
		const lead = convertTarget;
		if (!lead) return;
		const draft = readDealForm();
		const seatsFine = seatsInRange(draft.seats);
		const dateFine = deal.closes.value && deal.closes.value >= TODAY_ISO;
		deal.seats.classList.toggle('is-invalid', !seatsFine);
		deal.closes.classList.toggle('is-invalid', !dateFine);
		if (!seatsFine) return deal.seats.focus();
		if (!dateFine) return deal.closes.focus();

		const saved = clone(lead);
		const usedNumbers = records.filter((other) => other.deal).map((other) => Number(other.deal.replace(/\D/g, '')));
		Object.assign(lead, {
			plan: draft.plan,
			seats: draft.seats,
			addons: draft.addons,
			owner: deal.owner.value,
			stage: 'converted',
			converted: TODAY_ISO,
			deal: `#${Math.max(2044, ...usedNumbers) + 1}`,
		});
		logEntry(lead, `Converted to a ${tierOf(draft.plan).label} deal for ${count(draft.seats, 'seat')}.`, 'deal');
		window.bootstrap.Modal.getOrCreateInstance(dealDialog).hide();
		const undo = commit(lead, saved, {
			icon: 'bi-arrow-right-circle',
			title: `${lead.company} is now a deal`,
			text: `${dollars(annualValue(lead))} a year, in Discovery.`,
			actions: [
				{
					label: 'Open Deals',
					ghost: true,
					onClick: () => {
						window.location.href = DEALS_PAGE;
					},
				},
			],
		});
		const payload = {
			plan: lead.plan,
			seats: lead.seats,
			addons: lead.addons,
			closes: deal.closes.value,
			owner: lead.owner,
		};
		server.convert(lead.id, payload).catch(() => rollBack(undo, 'Couldn’t convert the lead'));
	}

	/* A lead typed in by hand goes through the side form. */

	function field(name) {
		return intakeForm.elements[name];
	}

	function intakeSelects() {
		return [field('plan'), field('source'), field('owner')];
	}

	function setUpIntake() {
		const tierOptions = SEED.tiers
			.map((tier) => `<option value="${tier.key}">${htmlSafe(tier.label)}</option>`)
			.join('');
		pick('[data-eq-add-plan]', intake).innerHTML = `<option value="">Not sure yet</option>${tierOptions}`;
		pick('[data-eq-add-source]', intake).innerHTML = SEED.channels
			.map((channel) => `<option value="${channel.key}">${htmlSafe(channel.label)}</option>`)
			.join('');
		pick('[data-eq-add-owner]', intake).innerHTML = teamOptions('<option value="">Unassigned</option>');
		for (const select of intakeSelects()) syncSelect(select);

		pick('[data-eq-new]', page).addEventListener('click', openIntake);
		intake.addEventListener('shown.bs.offcanvas', () => field('name').focus());
		intakeForm.addEventListener('input', (event) => {
			if (event.target.classList.contains('is-invalid')) event.target.classList.remove('is-invalid');
		});
		intakeForm.addEventListener('submit', onIntakeSubmit);
	}

	function openIntake() {
		intakeForm.reset();
		field('owner').value = SEED.viewer;
		field('source').value = 'website';
		for (const select of intakeSelects()) syncSelect(select);
		for (const flagged of pickAll('.is-invalid', intakeForm)) flagged.classList.remove('is-invalid');
		window.bootstrap.Offcanvas.getOrCreateInstance(intake).show();
	}

	function onIntakeSubmit(event) {
		event.preventDefault();
		const name = field('name').value.trim();
		const email = field('email').value.trim();
		const company = field('company').value.trim();
		const seats = parseInt(field('seats').value, 10);
		const verdicts = [
			[field('name'), Boolean(name)],
			[field('email'), EMAIL_SHAPE.test(email)],
			[field('company'), Boolean(company)],
			[field('seats'), seatsInRange(seats)],
		];
		for (const [input, fine] of verdicts) input.classList.toggle('is-invalid', !fine);
		const firstBad = verdicts.find(([, fine]) => !fine);
		if (firstBad) return firstBad[0].focus();

		const stamp = nowStamp();
		const lead = {
			id: `#${serial++}`,
			name,
			email,
			company,
			seats,
			title: field('title').value.trim() || 'Contact',
			phone: field('phone').value.trim(),
			city: field('city').value.trim() || 'City not added',
			source: field('source').value,
			plan: field('plan').value,
			addons: [],
			stage: 'new',
			fit: null,
			owner: field('owner').value,
			received: stamp,
			message: field('message').value.trim() || `Added by ${SEED.viewer} without a message.`,
			history: [[stamp, SEED.viewer, 'Added the lead.', 'note']],
		};
		window.bootstrap.Offcanvas.getOrCreateInstance(intake).hide();
		placeOnTop(lead, lead.owner ? `Looked after by ${lead.owner}.` : 'Nobody looks after it yet.');
		server.add(lead).catch(() => {
			records.splice(records.indexOf(lead), 1);
			redrawAll();
			notify({
				tone: 'danger',
				title: 'Couldn’t add the lead',
				text: 'Nothing was saved. Try again in a moment.',
			});
		});
	}

	/** Shows a fresh lead first in the Open view, briefly highlighted. */
	function placeOnTop(lead, text) {
		records.unshift(lead);
		resetFilters();
		switchView('open');
		filters.sortKey = 'touch';
		filters.sortDir = 'desc';
		redrawAll();
		filters.page = 1;
		drawList();
		pick(`[data-eq-row="${lead.id}"]`, ui.rows)?.classList.add('is-fresh');
		notify({ tone: 'success', icon: 'bi-envelope-plus', title: `${lead.name} added`, text });
	}

	/* Leads go out as CSV and come back in the same way.
     An import needs a header line with name, email and company; title,
     city, phone, seats, plan, source and message are picked up if found.
     Each usable line becomes a new, unassigned lead. */

	function setUpCsv() {
		pick('[data-eq-import]', page).addEventListener('click', () => {
			ui.picker.value = '';
			ui.picker.click();
		});
		ui.picker.addEventListener('change', () => {
			const file = ui.picker.files[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = () => importRows(readCsv(String(reader.result)), file.name);
			reader.readAsText(file);
		});
		pick('[data-eq-export]', page).addEventListener('click', downloadCsv);
	}

	/** Splits CSV text into rows of cells, honoring quotes; blank lines drop out. */
	function readCsv(source) {
		const table = [];
		let cells = [];
		let cellText = '';
		let quoted = false;
		let at = 0;
		while (at < source.length) {
			const ch = source[at];
			at += 1;
			if (quoted) {
				if (ch !== '"') cellText += ch;
				else if (source[at] === '"') {
					cellText += '"';
					at += 1;
				} else quoted = false;
			} else if (ch === '"') {
				quoted = true;
			} else if (ch === ',') {
				cells.push(cellText);
				cellText = '';
			} else if (ch === '\n' || ch === '\r') {
				if (ch === '\r' && source[at] === '\n') at += 1;
				cells.push(cellText);
				table.push(cells);
				cells = [];
				cellText = '';
			} else {
				cellText += ch;
			}
		}
		if (cellText || cells.length) {
			cells.push(cellText);
			table.push(cells);
		}
		return table.filter((row) => row.some((value) => value.trim()));
	}

	function importRows(lines, fileName) {
		const header = (lines.shift() || []).map((title) => title.trim().toLowerCase());
		const columnOf = (key) => header.indexOf(key);
		if (['name', 'email', 'company'].some((key) => columnOf(key) < 0)) {
			notify({
				tone: 'danger',
				title: `Nothing imported from ${fileName}`,
				text: 'The first line needs name, email and company columns.',
			});
			return;
		}
		const read = (line, key) => (columnOf(key) >= 0 ? String(line[columnOf(key)] || '').trim() : '');
		const stamp = nowStamp();
		const fresh = lines
			.filter((line) => read(line, 'name') && EMAIL_SHAPE.test(read(line, 'email')))
			.map((line) => {
				const channelKey = read(line, 'source').toLowerCase();
				const tierKey = read(line, 'plan').toLowerCase();
				return {
					id: `#${serial++}`,
					name: read(line, 'name'),
					title: read(line, 'title') || 'Contact',
					company: read(line, 'company') || 'Company not added',
					city: read(line, 'city') || 'City not added',
					email: read(line, 'email'),
					phone: read(line, 'phone'),
					source: channelOf(channelKey) ? channelKey : 'website',
					plan: tierOf(tierKey) ? tierKey : '',
					seats: Math.min(SEAT_CAP, Math.max(1, parseInt(read(line, 'seats'), 10) || 1)),
					addons: [],
					stage: 'new',
					fit: null,
					owner: '',
					received: stamp,
					message: read(line, 'message') || `Imported from ${fileName}.`,
					history: [[stamp, SEED.viewer, `Imported from ${fileName}.`, 'import']],
				};
			});
		if (!fresh.length) {
			notify({
				tone: 'warning',
				title: `Nothing imported from ${fileName}`,
				text: 'No line had both a name and a valid email.',
			});
			return;
		}
		const dropped = lines.length - fresh.length;
		records.unshift(...fresh);
		resetFilters();
		switchView('new');
		redrawAll();
		notify({
			tone: 'success',
			icon: 'bi-upload',
			title: `Imported ${count(fresh.length, 'lead')}`,
			text: dropped
				? `${count(dropped, 'line')} skipped without a name or a valid email.`
				: 'They wait for a reply, unassigned.',
		});
		for (const lead of [...fresh].reverse()) server.add(lead);
	}

	function downloadCsv() {
		const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
		const header = [
			'Lead',
			'Name',
			'Title',
			'Company',
			'City',
			'Email',
			'Phone',
			'Source',
			'Stage',
			'Fit',
			'Plan',
			'Seats',
			'Yearly value',
			'Owner',
			'Received',
		];
		const body = records.map((lead) => {
			const tier = tierOf(lead.plan);
			return [
				lead.id,
				lead.name,
				lead.title,
				lead.company,
				lead.city,
				lead.email,
				lead.phone,
				channelOf(lead.source).label,
				stageName(lead.stage),
				lead.fit ?? '',
				tier ? tier.label : '',
				lead.seats,
				tier ? annualValue(lead) : '',
				lead.owner,
				lead.received.replace('T', ' '),
			];
		});
		const text = [header, ...body].map((row) => row.map(quote).join(',')).join('\r\n');
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
		link.download = 'leads.csv';
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000);
		notify({ tone: 'success', icon: 'bi-download', title: `Exported ${count(records.length, 'lead')}` });
	}

	/* The two cards under the list are drawn once from the sample. */

	/* Channels ranked by volume, each bar in its own series color. */
	function drawChannels() {
		const ranked = [...SEED.channels].sort((a, b) => b.count - a.count);
		const received = ranked.reduce((sum, channel) => sum + channel.count, 0);
		const won = ranked.reduce((sum, channel) => sum + channel.won, 0);
		const widest = ranked[0].count;
		pick('[data-eq-sources-desc]', page).textContent =
			`${count(received, 'lead')} in the four weeks to ${monthDay(SEED.channelsUntil)}, and the ${count(won, 'deal')} they became.`;
		pick('[data-eq-sources]', page).innerHTML = ranked
			.map((channel, index) => {
				const width = ((channel.count / widest) * 100).toFixed(1);
				return `<li class="eq-bar eq-series-${index + 1}"><span class="eq-bar-name">${htmlSafe(channel.label)}</span><span class="eq-bar-track" aria-hidden="true"><span class="eq-bar-fill" style="--w:${width}%"></span></span><span class="eq-bar-val">${channel.count}</span><span class="eq-bar-deals">${count(channel.won, 'deal')}</span></li>`;
			})
			.join('');
	}

	/* Four weeks of leads: one dot per lead, in its source's color and
     solid when it became a deal. A source key, hovered or picked, brings
     out its dots and swaps the three figures for that source's; a dot,
     hovered or focused, names its lead. The recorded leads of those weeks
     take their dots first and the rest are filled from a fixed seed, so
     each source still adds up to its count and the weeks to SEED.weekly. */
	function dotLeads(ranked) {
		const from = SEED.weekly.slice(-4);
		const fromIso = from[0].start;
		let seed = 20261004;
		const rand = () => {
			seed = (seed * 1103515245 + 12345) % 2147483648;
			return seed / 2147483648;
		};
		const pickOne = (list) => list[Math.floor(rand() * list.length)];
		/* One day slot per lead, week by week, as many as each week received. */
		const slots = from.flatMap((week) =>
			Array.from({ length: week.count }, (_, at) => {
				const day = parseStamp(week.start);
				day.setDate(day.getDate() + (at % 7));
				return `${day.getFullYear()}-${twoDigits(day.getMonth() + 1)}-${twoDigits(day.getDate())}`;
			}),
		);
		const taken = (iso) => {
			const at = slots.indexOf(iso);
			if (at > -1) slots.splice(at, 1);
		};
		const recorded = SEED.records.filter(
			(lead) => lead.received.slice(0, 10) >= fromIso && lead.received.slice(0, 10) <= SEED.channelsUntil,
		);
		const given = [
			'Avery',
			'Jordan',
			'Morgan',
			'Casey',
			'Riley',
			'Taylor',
			'Dana',
			'Parker',
			'Reese',
			'Hayden',
			'Logan',
			'Quinn',
			'Rowan',
			'Sydney',
			'Blake',
			'Cameron',
		];
		const family = [
			'Holt',
			'Reyes',
			'Bishop',
			'Lowell',
			'Carver',
			'Nolan',
			'Pruitt',
			'Ellison',
			'Garner',
			'Whitley',
			'Sutton',
			'Barrett',
			'Dalton',
			'Keller',
			'Monroe',
			'Fowler',
		];
		const firms = [
			'Cedar Lane Cleaning',
			'Harbor Pet Care',
			'Northfield Gardens',
			'Summit Home Care',
			'Brightway Movers',
			'Oakridge Plumbing',
			'Bluebird Tutoring',
			'Meadow Mobile Grooming',
			'Pinecrest Windows',
			'Riverbend Handyman',
			'Lakeside Senior Care',
			'Granite Peak Electric',
		];
		return ranked.map((channel) => {
			const own = recorded.filter((lead) => lead.source === channel.key).slice(0, channel.count);
			own.forEach((lead) => taken(lead.received.slice(0, 10)));
			const real = own.map((lead) => ({
				name: lead.name,
				company: lead.company,
				date: lead.received.slice(0, 10),
				won: lead.stage === 'converted',
				lost: lead.stage === 'notnow',
				value: annualValue(lead),
			}));
			while (real.length < channel.count) {
				const plan = pickOne(SEED.tiers);
				const seats = 4 + Math.floor(rand() * 40);
				real.push({
					name: `${pickOne(given)} ${pickOne(family)}`,
					company: pickOne(firms),
					date: slots.splice(Math.floor(rand() * slots.length), 1)[0] || SEED.channelsUntil,
					won: false,
					lost: false,
					value: seats * plan.monthly * 10,
				});
			}
			/* The first `won` dots are the deals: recorded wins first, then made-up ones. */
			real.sort((a, b) => Number(b.won) - Number(a.won));
			real.forEach((lead, at) => {
				if (at < channel.won) lead.won = true;
				else if (lead.won) lead.won = false;
				if (!lead.won && !lead.lost && at >= channel.won) lead.lost = rand() < 0.35;
			});
			return real;
		});
	}

	function drawDots() {
		const box = pick('[data-eq-dots]', page);
		const keys = pick('[data-eq-dots-keys]', page);
		const figs = pick('[data-eq-dots-figs]', page);
		const tip = pick('[data-eq-dot-tip]', page);
		const say = pick('[data-eq-dots-say]', page);
		const ranked = [...SEED.channels].sort((a, b) => b.count - a.count);
		const people = dotLeads(ranked);
		const total = ranked.reduce((sum, channel) => sum + channel.count, 0);
		const won = ranked.reduce((sum, channel) => sum + channel.won, 0);
		const until = monthDay(SEED.channelsUntil);

		/* The three figures, for every source or for one. */
		function figuresFor(index) {
			const channel = ranked[index];
			const leads = channel ? channel.count : total;
			const deals = channel ? channel.won : won;
			const name = channel ? channel.label : '';
			return [
				[leads, '', channel ? `${name} leads` : `leads to ${until}`],
				[deals, '', 'became deals'],
				[Math.round((deals / leads) * 100), '%', channel ? `of ${name.toLowerCase()} leads` : 'of leads'],
			];
		}
		figs.innerHTML = figuresFor(null)
			.map(
				([value, unit, label]) => `<div><dt>${label}</dt><dd data-eq-fig="${value}">${value}${unit}</dd></div>`,
			)
			.join('');
		let shown = null;
		function showFigures(index) {
			if (index === shown) return;
			shown = index;
			const rows = figuresFor(index);
			[...figs.children].forEach((row, at) => {
				const [value, unit, label] = rows[at];
				pick('dt', row).textContent = label;
				const cell = pick('dd', row);
				const start = Number(cell.dataset.eqFig);
				cell.dataset.eqFig = value;
				if (motionQuery.matches || start === value) {
					cell.textContent = `${value}${unit}`;
					return;
				}
				const began = performance.now();
				const step = (now) => {
					if (cell.dataset.eqFig !== String(value)) return;
					const done = Math.min(1, (now - began) / 360);
					const eased = 1 - (1 - done) ** 3;
					cell.textContent = `${Math.round(start + (value - start) * eased)}${unit}`;
					if (done < 1) requestAnimationFrame(step);
				};
				requestAnimationFrame(step);
			});
		}

		box.setAttribute(
			'aria-label',
			`${count(total, 'lead')}, ${won} became deals. ${ranked.map((channel) => `${channel.label}: ${channel.won} of ${channel.count}`).join('; ')}. Use the arrow keys to read each lead.`,
		);
		const statusOf = (lead) =>
			lead.won ? `Became a deal, ${dollars(lead.value)} a year` : lead.lost ? 'Lost' : 'Still open';
		box.innerHTML = people
			.map((list, index) =>
				list
					.map(
						(lead, at) =>
							`<button type="button" class="eq-dot eq-series-${index + 1}${lead.won ? ' is-won' : ''}" data-eq-src="${index}" data-eq-at="${at}" tabindex="-1" data-basalt-no-tips aria-label="${htmlSafe(`${lead.name}, ${lead.company}. ${ranked[index].label}, ${monthDay(lead.date)}. ${statusOf(lead)}.`)}"></button>`,
					)
					.join(''),
			)
			.join('');
		const dots = [...box.children];
		if (dots[0]) dots[0].tabIndex = 0;
		keys.innerHTML = ranked
			.map(
				(channel, index) =>
					`<button type="button" class="eq-key eq-series-${index + 1}" data-eq-src="${index}" aria-pressed="false"><span aria-hidden="true"></span>${htmlSafe(channel.label)} · ${channel.won} of ${channel.count}</button>`,
			)
			.join('');

		let pinned = null;
		function choose(index) {
			box.classList.toggle('is-picking', index != null);
			for (const dot of dots) dot.classList.toggle('is-on', Number(dot.dataset.eqSrc) === index);
			for (const key of keys.children)
				key.setAttribute('aria-pressed', String(Number(key.dataset.eqSrc) === pinned));
			showFigures(index);
		}
		function announce(index) {
			const [leads, deals, share] = figuresFor(index);
			say.textContent = `${index == null ? 'All sources' : ranked[index].label}: ${count(leads[0], 'lead')}, ${deals[0]} became deals, ${share[0]}%.`;
		}

		/* The note beside a dot: who the lead is, where from, when, and how it went. */
		function showTip(dot) {
			const lead = people[dot.dataset.eqSrc][dot.dataset.eqAt];
			const channel = ranked[dot.dataset.eqSrc];
			tip.innerHTML = `<strong>${htmlSafe(lead.name)}</strong><span>${htmlSafe(lead.company)}</span><span class="eq-dot-tip-meta">${htmlSafe(channel.label)} · ${monthDay(lead.date)}</span><span class="eq-dot-tip-state${lead.won ? ' is-won' : ''}">${statusOf(lead)}</span>`;
			const card = box.getBoundingClientRect();
			const at = dot.getBoundingClientRect();
			tip.style.setProperty('--tip-x', `${at.left - card.left + at.width / 2}px`);
			tip.style.setProperty('--tip-y', `${at.top - card.top}px`);
			const x = at.left - card.left;
			tip.classList.toggle('is-flip', x > card.width * 0.6);
			tip.classList.toggle('is-start', x < card.width * 0.3);
			tip.hidden = false;
			for (const other of dots) other.classList.toggle('is-hot', other === dot);
			box.classList.add('is-picking');
			for (const other of dots) other.classList.toggle('is-on', other.dataset.eqSrc === dot.dataset.eqSrc);
		}
		function hideTip() {
			tip.hidden = true;
			for (const dot of dots) dot.classList.remove('is-hot');
			choose(pinned);
		}
		box.addEventListener('pointerover', (event) => {
			const dot = event.target.closest('.eq-dot');
			if (dot) showTip(dot);
		});
		box.addEventListener('pointerleave', hideTip);
		box.addEventListener('focusin', (event) => {
			const dot = event.target.closest('.eq-dot');
			if (dot) showTip(dot);
		});
		box.addEventListener('focusout', (event) => {
			if (!box.contains(event.relatedTarget)) hideTip();
		});
		box.addEventListener('keydown', (event) => {
			const dot = event.target.closest('.eq-dot');
			if (!dot) return;
			if (event.key === 'Escape') {
				hideTip();
				return;
			}
			const at = dots.indexOf(dot);
			const across = Math.max(1, dots.filter((other) => other.offsetTop === dots[0].offsetTop).length);
			const jump = {
				ArrowRight: 1,
				ArrowLeft: -1,
				ArrowDown: across,
				ArrowUp: -across,
				Home: -at,
				End: dots.length - 1 - at,
			}[event.key];
			if (jump == null) return;
			event.preventDefault();
			const next = dots[Math.min(dots.length - 1, Math.max(0, at + jump))];
			dot.tabIndex = -1;
			next.tabIndex = 0;
			next.focus();
		});

		const keyOf = (event) => event.target.closest('[data-eq-src]');
		keys.addEventListener('pointerover', (event) => {
			const key = keyOf(event);
			if (key) choose(Number(key.dataset.eqSrc));
		});
		keys.addEventListener('pointerleave', () => choose(pinned));
		keys.addEventListener('focusin', (event) => choose(Number(keyOf(event).dataset.eqSrc)));
		keys.addEventListener('focusout', () => choose(pinned));
		keys.addEventListener('click', (event) => {
			const key = keyOf(event);
			if (!key) return;
			const index = Number(key.dataset.eqSrc);
			pinned = pinned === index ? null : index;
			choose(pinned);
			announce(pinned);
		});
		keys.addEventListener('keydown', (event) => {
			const key = keyOf(event);
			if (!key || !['ArrowRight', 'ArrowLeft'].includes(event.key)) return;
			event.preventDefault();
			const list = [...keys.children];
			const next = list[(list.indexOf(key) + (event.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
			next.focus();
		});
	}

	function describeWeeks() {
		const recent = SEED.weekly.slice(-4);
		const received = recent.reduce((sum, week) => sum + week.count, 0);
		const won = recent.reduce((sum, week) => sum + week.won, 0);
		pick('[data-eq-weeks-desc]', page).textContent =
			`About 1 in ${Math.round(received / won)} became a deal over the last four weeks.`;
		const spoken = SEED.weekly.map(
			(week) => `week of ${monthDay(week.start)}, ${week.count} received and ${week.won} became deals`,
		);
		ui.canvas.setAttribute(
			'aria-label',
			`Bar chart of the last ${SEED.weekly.length} weeks: ${spoken.join('; ')}.`,
		);
	}

	/* The chart waits until it scrolls near view, and redraws without
     animation when the theme flips. */
	function watchChart() {
		if (ui.canvas) {
			if (!('IntersectionObserver' in window)) {
				drawWeekly(false);
			} else {
				const watcher = new IntersectionObserver(
					(entries) => {
						if (!entries.some((entry) => entry.isIntersecting)) return;
						watcher.disconnect();
						drawWeekly(true);
					},
					{ rootMargin: '80px 0px' },
				);
				watcher.observe(ui.canvas);
			}
		}
		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() => {
				if (weeklyChart) drawWeekly(false);
			});
		});
	}

	function themeValue(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** A CSS color as [r, g, b]; mid gray when the format is not recognized. */
	function rgbOf(color) {
		const text = String(color || '').trim();
		const short = /^#([0-9a-f]{3})$/i.exec(text);
		if (short) return [...short[1]].map((digit) => parseInt(digit + digit, 16));
		const long = /^#([0-9a-f]{6})$/i.exec(text);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [packed >> 16, packed >> 8, packed].map((part) => part & 255);
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(text);
		return functional
			? functional[1]
					.split(',')
					.slice(0, 3)
					.map((part) => parseFloat(part))
			: [128, 128, 128];
	}

	function tint(color, alpha) {
		const [red, green, blue] = rgbOf(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	function blend(color, base, weight) {
		const top = rgbOf(color);
		const under = rgbOf(base);
		const [red, green, blue] = top.map((part, slot) => Math.round(part * weight + under[slot] * (1 - weight)));
		return `rgb(${red}, ${green}, ${blue})`;
	}

	function drawWeekly(animate) {
		if (typeof Chart === 'undefined' || !ui.canvas) return;
		if (weeklyChart) weeklyChart.destroy();
		const ink = themeValue('--basalt-copy', '#12233a');
		const palette = {
			ink,
			muted: blend(themeValue('--basalt-copy-muted', '#5f7186'), ink, 0.82),
			rule: tint(ink, 0.07),
			card: themeValue('--basalt-plane', '#ffffff'),
			edge: themeValue('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			inbound: themeValue('--basalt-series-2', '#3aa0c8'),
			closed: themeValue('--basalt-success', '#12c08f'),
		};
		const tickStyle = { color: palette.muted, font: { family: CHART_FONT, size: 11.5 }, padding: 6 };
		const barStyle = {
			borderRadius: 4,
			borderSkipped: false,
			maxBarThickness: 18,
			categoryPercentage: 0.62,
			barPercentage: 0.9,
		};
		weeklyChart = new Chart(ui.canvas, {
			type: 'bar',
			data: {
				labels: SEED.weekly.map((week) => monthDay(week.start)),
				datasets: [
					{
						label: 'Received',
						data: SEED.weekly.map((week) => week.count),
						backgroundColor: palette.inbound,
						...barStyle,
					},
					{
						label: 'Became deals',
						data: SEED.weekly.map((week) => week.won),
						backgroundColor: palette.closed,
						...barStyle,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: animate && !motionQuery.matches ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: palette.card,
						titleColor: palette.ink,
						bodyColor: palette.ink,
						borderColor: palette.edge,
						borderWidth: 1,
						padding: 10,
						cornerRadius: 8,
						boxPadding: 4,
						usePointStyle: true,
						titleFont: { family: CHART_FONT, size: 12, weight: '600' },
						bodyFont: { family: CHART_FONT, size: 12 },
						callbacks: {
							title: (points) => `Week of ${points[0].label}`,
							label: (point) => ` ${point.dataset.label}: ${point.parsed.y}`,
						},
					},
				},
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: { maxRotation: 0, autoSkipPadding: 12, ...tickStyle },
					},
					y: {
						beginAtZero: true,
						grid: { color: palette.rule },
						border: { display: false },
						ticks: { maxTicksLimit: 5, precision: 0, ...tickStyle },
					},
				},
			},
		});
	}

	start();
})();
