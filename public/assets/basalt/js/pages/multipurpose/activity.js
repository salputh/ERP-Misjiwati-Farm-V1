/**
 * Team activity, the script behind activity.html. It keeps a running
 * log of what each teammate did, one section per day, narrowed by person,
 * action, area and date. New entries stream in until the viewer pauses,
 * every teammate gets a fourteen-day trend and a quick-view sheet, and a
 * side list calls out behavior that breaks someone's usual pattern. The
 * audit log page is the formal record; this page is about the people.
 *
 * To plug in real data, have backend.fetchAll() return an object shaped
 * like SAMPLE and point the other backend calls at real endpoints. Demo
 * switches: ?state=empty (a quiet workspace), ?state=error (the first fetch
 * fails, Try again recovers) and ?state=flaky (every save fails and rolls back).
 */
(() => {
	'use strict';

	const page = pick('[data-ua-root]', document);
	if (!page) return;

	const BATCH = 30;
	const DAY_MS = 86400000;
	const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const MONTH_NAMES = [
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
	const UNUSUAL_BADGE =
		'<span class="ua-event-flag"><i class="bi bi-exclamation-diamond" aria-hidden="true"></i>Unusual</span>';
	const CSV_COLUMNS = [
		'Time',
		'Person',
		'Role',
		'Action',
		'Area',
		'What happened',
		'Changes',
		'Place',
		'IP address',
		'Device',
		'Signed in with',
		'Event ID',
	];
	const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	/* Pools the generated everyday work draws its names and values from. */
	const ACCOUNTS = [
		'Brightwater Studios',
		'Lumora AI',
		'Cedar Fell Landscaping',
		'Volt Film & Photo',
		'Harborline AI',
		'Cornerstone Logistics',
		'Clearview Windows',
		'Larchwood Studios',
		'Redline Motion',
		'Evergreen Landscaping',
		'Copperleaf Design',
		'Ironwood Studio',
	];
	const CREW = ['Ruben Zeller', 'Margot Achterberg', 'Samuel Achebe', 'Lori Fleming', 'Dev Dixon', 'Ann Thornton'];
	const SLOTS = ['8:00 to 10:00 am', '10:00 am to 12:00 pm', '1:00 to 3:00 pm', '3:00 to 5:00 pm'];
	const ADDRESSES = [
		'18 Larch Street',
		'402 Mill Road',
		'77 Quarry Lane',
		'9 Moorings View',
		'1150 Larkhill Avenue',
		'36 Orchard Court',
	];
	const PAYERS = ['Dana Whitfield', 'Gerald Price', 'Robyn Jacobs', 'Malik Turner', 'Hiro Yamada', 'Claire Larson'];
	const APPS = ['QuickBooks', 'Stripe', 'Google Calendar', 'Twilio SMS', 'Salesforce'];
	const REPORT_NAMES = [
		'Visits completed',
		'Team member utilization',
		'Revenue by customer',
		'Rebooked visit rate',
		'Late arrivals',
	];
	const UPGRADES = [
		['Basic', 'Pro'],
		['Pro', 'Max'],
	];
	const NOTES = [
		'Gate code changed, ask the office',
		'Prefers a call 30 minutes before arrival',
		'Second site opens in November',
		'Send invoices to the new accounts inbox',
	];

	/* One row per teammate, in this order: id, id on the Users page (it links
     the name to employee-user-details.html), name, role, job title, team, region,
     avatar hue, actions on an ordinary day, sign-in method, usual device,
     city, IP address and, for anyone who joined recently, their first day. */
	const ROSTER = [
		[
			'john',
			'ja',
			'John Armstrong',
			'Administrator',
			'IT and systems manager',
			'Operations',
			'Midwest',
			8,
			8,
			'Okta SSO',
			'Chrome on a MacBook',
			'Evanston, IL',
			'203.0.113.12',
		],
		[
			'ruth',
			'rc',
			'Ruth Christensen',
			'Owner',
			'Chief executive',
			'Operations',
			'South',
			2,
			2,
			'Okta SSO',
			'Safari on a MacBook',
			'Waco, TX',
			'198.51.100.7',
		],
		[
			'connie',
			'pr',
			'Connie Reese',
			'Support agent',
			'Support lead',
			'Support',
			'West',
			3,
			13,
			'Okta SSO',
			'Chrome on a MacBook',
			'Boulder, CO',
			'203.0.113.40',
		],
		[
			'hope',
			'hs',
			'Hope Stout',
			'Billing admin',
			'Billing specialist',
			'Finance',
			'West',
			4,
			7,
			'Okta SSO',
			'Safari on a MacBook',
			'Missoula, MT',
			'198.51.100.63',
		],
		[
			'trent',
			'th',
			'Todd Hatcher',
			'Engineer',
			'Senior mobile engineer',
			'Engineering',
			'South',
			5,
			4,
			'Okta SSO',
			'Chrome on a MacBook',
			'Chattanooga, TN',
			'203.0.113.88',
		],
		[
			'travis',
			'mb',
			'Quentin Cook',
			'Read-only',
			'Account executive',
			'Sales',
			'Midwest',
			6,
			3,
			'Google SSO',
			'Chrome on a MacBook',
			'Evanston, IL',
			'198.51.100.21',
		],
		[
			'silas',
			'nf',
			'Silas Fischer',
			'Scheduling manager',
			'Implementation consultant',
			'Success',
			'Midwest',
			1,
			10,
			'Okta SSO',
			'Firefox on Linux',
			'Iowa City, IA',
			'203.0.113.71',
		],
		[
			'ben',
			'bc',
			'Ben Pearce',
			'Support agent',
			'Support specialist',
			'Support',
			'Northeast',
			2,
			9,
			'Password',
			'Chrome on Windows',
			'Stamford, CT',
			'198.51.100.115',
			'2026-09-14',
		],
		[
			'ike',
			'ms',
			'Ike Parsons',
			'Support agent',
			'Support specialist',
			'Support',
			'South',
			7,
			11,
			'Okta SSO',
			'Chrome on Windows',
			'Sarasota, FL',
			'203.0.113.152',
		],
		[
			'jiwoo',
			'jp',
			'Joy Roe',
			'Engineer',
			'Mobile engineer',
			'Engineering',
			'West',
			7,
			4,
			'Okta SSO',
			'Chrome on a MacBook',
			'Eureka, CA',
			'198.51.100.188',
		],
		[
			'mallory',
			'cm',
			'Casey Martin',
			'Support agent',
			'Support specialist',
			'Support',
			'Midwest',
			3,
			10,
			'Okta SSO',
			'Safari on a MacBook',
			'Peoria, IL',
			'203.0.113.97',
		],
		[
			'cameron',
			'cr',
			'Cameron Reid',
			'Read-only',
			'Marketing lead',
			'Marketing',
			'Midwest',
			8,
			2,
			'Google SSO',
			'Safari on a MacBook',
			'La Crosse, WI',
			'198.51.100.240',
		],
		[
			'darryl',
			'ds',
			'Darryl Sanders',
			'Engineer',
			'Platform engineer',
			'Engineering',
			'Midwest',
			8,
			4,
			'Okta SSO',
			'Firefox on Linux',
			'Toledo, OH',
			'203.0.113.205',
		],
	];
	const TEAM = ROSTER.map(toMember);

	/* The sample treats Friday, October 9, 2026 at 2:20 pm as the present.
     A live page would use new Date() here. */
	const SAMPLE_CLOCK = new Date(2026, 9, 9, 14, 20);

	/* Everything the page draws. An entry's `fields` lists what it touched as
     [label, before, after]; a null `before` marks a plain detail rather
     than a change. `seenFrom` replaces the person's usual city, address,
     device and sign-in for that single entry. */
	const SAMPLE = {
		workspace: 'Fieldline',
		clock: stamp(SAMPLE_CLOCK),
		historyDays: 30,
		viewer: 'john',
		members: TEAM.map(({ cadence, joined, ...member }) => member),
		verbs: [
			{ id: 'signin', label: 'Signed in', icon: 'bi-box-arrow-in-right' },
			{ id: 'create', label: 'Created', icon: 'bi-plus-circle' },
			{ id: 'edit', label: 'Edited', icon: 'bi-pencil' },
			{ id: 'delete', label: 'Removed', icon: 'bi-trash3' },
			{ id: 'export', label: 'Exported', icon: 'bi-download' },
			{ id: 'role', label: 'Changed a role', icon: 'bi-person-gear' },
			{ id: 'invite', label: 'Invited', icon: 'bi-envelope-plus' },
		],
		/* The same resources the Roles page grants access to. */
		areas: [
			{ id: 'signin', label: 'Sign-in', tone: 8 },
			{ id: 'customers', label: 'Customers', tone: 1 },
			{ id: 'billing', label: 'Billing and invoices', tone: 2 },
			{ id: 'dispatch', label: 'Schedule board', tone: 3 },
			{ id: 'reports', label: 'Reports', tone: 4 },
			{ id: 'integrations', label: 'Integrations', tone: 5 },
			{ id: 'apikeys', label: 'API keys', tone: 6 },
			{ id: 'settings', label: 'Settings', tone: 7 },
			{ id: 'users', label: 'Users', tone: 1 },
		],
		entries: [
			{
				id: 'ev-90412',
				at: '2026-10-09T10:12',
				by: 'john',
				verb: 'role',
				area: 'users',
				summary: "changed Ben Pearce's role",
				fields: [
					['Role', 'Read-only', 'Support agent'],
					['Schedule board', 'View', 'View and edit'],
				],
			},
			{
				id: 'ev-90398',
				at: '2026-10-09T13:52',
				by: 'trent',
				verb: 'create',
				area: 'apikeys',
				summary: 'created the API key "Travel Planner, live"',
				fields: [
					['Scopes', null, 'Schedule board: read and write'],
					['Expires', null, 'Never'],
				],
			},
			{
				id: 'ev-90391',
				at: '2026-10-09T13:47',
				by: 'trent',
				verb: 'create',
				area: 'apikeys',
				summary: 'created the API key "Travel Planner, staging"',
				fields: [
					['Scopes', null, 'Schedule board: read and write'],
					['Expires', null, 'December 31, 2026'],
				],
			},
			{
				id: 'ev-90386',
				at: '2026-10-09T13:41',
				by: 'trent',
				verb: 'create',
				area: 'apikeys',
				summary: 'created the API key "Travel Planner, test"',
				fields: [
					['Scopes', null, 'Schedule board: read'],
					['Expires', null, 'October 31, 2026'],
				],
			},
			{
				id: 'ev-90244',
				at: '2026-10-09T11:30',
				by: 'hope',
				verb: 'edit',
				area: 'billing',
				summary: "changed Lakeside Apparel's billing email",
				fields: [['Billing email', 'accounts@lakesideapparel.com', 'billing@lakesideapparel.com']],
			},
			{
				id: 'ev-90031',
				at: '2026-10-09T03:12',
				by: 'silas',
				verb: 'signin',
				area: 'signin',
				summary: 'signed in',
				fields: [],
				seenFrom: {
					city: 'Sarasota, FL',
					ip: '192.0.2.144',
					device: 'Chrome on Windows',
					auth: 'Okta SSO',
				},
			},
			{
				id: 'ev-89977',
				at: '2026-10-08T23:47',
				by: 'travis',
				verb: 'export',
				area: 'customers',
				summary: 'exported the full customer list',
				fields: [
					['Rows', null, '4,812'],
					['Columns', null, 'All 34, including billing contacts'],
					['Format', null, 'CSV'],
				],
				alertId: 'fl-export',
			},
		].concat(routine(SAMPLE_CLOCK)),
		/* Moments that do not fit how the person usually works. */
		alerts: [
			{
				id: 'fl-export',
				by: 'travis',
				tone: 'danger',
				headline: 'Exported every customer at 11:47 pm',
				note: 'Quentin usually exports under 200 rows, during the working day. This file has 4,812 customers with billing contacts. Read-only accounts can export; you can turn that off on the Roles page.',
			},
		],
		/* What the demo stream sends, one entry at a time, round and round. */
		stream: [
			{
				by: 'ike',
				verb: 'edit',
				area: 'customers',
				summary: 'updated the service address for Larchwood Studios',
				fields: [['Service address', '36 Orchard Court', '1150 Larkhill Avenue']],
			},
			{
				by: 'ben',
				verb: 'edit',
				area: 'dispatch',
				summary: 'moved visit #4561 for Cornerstone Logistics to Margot Achterberg',
				fields: [
					['Team member', 'Ruben Zeller', 'Margot Achterberg'],
					['Arrival window', '1:00 to 3:00 pm', '3:00 to 5:00 pm'],
				],
			},
			{
				by: 'connie',
				verb: 'create',
				area: 'customers',
				summary: 'added a note to Volt Film & Photo',
				fields: [['Note', null, 'Prefers a call 30 minutes before arrival']],
			},
			{
				by: 'hope',
				verb: 'create',
				area: 'billing',
				summary: 'sent invoice #20931 to Harborline AI',
				fields: [
					['Status', 'Draft', 'Sent'],
					['Amount', null, '$1,320.00'],
				],
			},
			{
				by: 'darryl',
				verb: 'edit',
				area: 'integrations',
				summary: 'changed the QuickBooks sync settings',
				fields: [['Sync every', '15 minutes', '5 minutes']],
			},
			{
				by: 'mallory',
				verb: 'edit',
				area: 'customers',
				summary: 'changed the billing contact for Evergreen Landscaping',
				fields: [['Billing contact', 'Gerald Price', 'Claire Larson']],
			},
			{
				by: 'john',
				verb: 'invite',
				area: 'users',
				summary: 'invited r.freeman@fieldline.app',
				fields: [['Role', null, 'Support agent']],
			},
			{
				by: 'cameron',
				verb: 'export',
				area: 'reports',
				summary: 'exported the Late arrivals report',
				fields: [
					['Rows', null, '64'],
					['Format', null, 'CSV'],
				],
			},
		],
	};

	/* Stand-in for the server. Each method resolves after a short pause the
     way a request would; replace the bodies and keep what they return. */
	const demoMode = new URLSearchParams(location.search).get('state');
	let fetchCount = 0;

	const backend = {
		/* GET /api/activity?days=30 */
		fetchAll() {
			fetchCount += 1;
			if (demoMode === 'error' && fetchCount === 1)
				return rejectAfter(500, 'The activity service did not answer');
			if (demoMode === 'empty') return resolveAfter(500, { ...SAMPLE, entries: [], alerts: [] });
			return resolveAfter(500, SAMPLE);
		},

		/* An EventSource on /api/activity/stream in production. Hands each new
       entry to `deliver` and returns a function that stops the stream. */
		follow(deliver) {
			let turn = 0;
			const ticker = setInterval(() => {
				if (document.hidden) return;
				deliver({ ...SAMPLE.stream[turn % SAMPLE.stream.length] });
				turn += 1;
			}, 7000);
			return () => clearInterval(ticker);
		},

		/* POST /api/activity/flags/:id/resolve */
		dismissAlert(alertId) {
			return demoMode === 'flaky' ? rejectAfter(400, 'Not saved') : resolveAfter(250);
		},

		/* POST /api/activity/flags/:id/reopen */
		restoreAlert(alertId) {
			return demoMode === 'flaky' ? rejectAfter(400, 'Not saved') : resolveAfter(250);
		},

		/* POST /api/users/:id/sessions/revoke */
		signOutEverywhere(memberId) {
			return demoMode === 'flaky' ? rejectAfter(500, 'Not saved') : resolveAfter(600, { ended: 2 });
		},

		/* GET /api/activity/export.csv?person=&action=&area=&from=&to=
       The demo writes the file itself from the entries it receives. */
		exportCsv(chosen) {
			return demoMode === 'flaky' ? rejectAfter(700, 'Export failed') : resolveAfter(700, buildCsv(chosen));
		},
	};

	/* What the page knows. `feed` stays sorted newest first, and `clock`
     moves forward a little with every streamed entry. */
	let source = null;
	let feed = [];
	let clock = null;
	let midnight = null;
	let memberById = {};
	let verbById = {};
	let areaById = {};
	const dismissed = new Set();
	const picks = { person: '', action: '', area: '', range: '7', from: '', to: '' };
	let visible = BATCH;
	let streaming = true;
	let held = [];
	let stopFollowing = null;
	let streamedCount = 0;
	let sheetMemberId = null;
	let sheetPanel = null;
	let sheetReturnTo = null;

	const ui = {
		counter: pick('[data-ua-count]'),
		feedBody: pick('[data-ua-body]'),
		skeleton: pick('[data-ua-skeleton]'),
		dayList: pick('[data-ua-days]'),
		moreFoot: pick('[data-ua-more]'),
		moreStatus: pick('[data-ua-more-status]'),
		moreButton: pick('[data-ua-more-btn]'),
		moreLabel: pick('[data-ua-more-label]'),
		noMatch: pick('[data-ua-noresults]'),
		noMatchText: pick('[data-ua-noresults-text]'),
		emptyState: pick('[data-ua-empty]'),
		errorState: pick('[data-ua-error]'),
		chips: pick('[data-ua-applied]'),
		personSelect: pick('[data-ua-filter="person"]'),
		actionSelect: pick('[data-ua-filter="action"]'),
		areaSelect: pick('[data-ua-filter="area"]'),
		dateRow: pick('[data-ua-dates]'),
		fromInput: pick('[data-ua-from]'),
		toInput: pick('[data-ua-to]'),
		liveBox: pick('[data-ua-live-box]'),
		liveButton: pick('[data-ua-live]'),
		liveText: pick('[data-ua-live-text]'),
		liveLabel: pick('[data-ua-live-label]'),
		liveIcon: pick('[data-ua-live-icon]'),
		heldBar: pick('[data-ua-waiting]'),
		heldText: pick('[data-ua-waiting-text]'),
		alertList: pick('[data-ua-flags]'),
		alertsNone: pick('[data-ua-flags-none]'),
		alertCount: pick('[data-ua-flag-count]'),
		peopleList: pick('[data-ua-people]'),
		exportButton: pick('[data-ua-export]'),
		sheet: pick('[data-ua-sheet]', document),
	};

	/* Each select names the entry field it narrows, the control that shows
     it and how its choice reads on a removable chip. */
	const NARROWERS = {
		person: { field: 'by', control: ui.personSelect, chip: (id) => memberById[id].fullName },
		action: { field: 'verb', control: ui.actionSelect, chip: (id) => verbById[id].label },
		area: { field: 'area', control: ui.areaSelect, chip: (id) => areaById[id].label },
	};

	start();

	function start() {
		bindFilters();
		wireFeed();
		wireLive();
		ui.alertList.addEventListener('click', onAlertListClick);
		ui.peopleList.addEventListener('click', onPersonPress);
		ui.peopleList.addEventListener('auxclick', (event) => {
			if (event.button === 1) onPersonPress(event);
		});
		if (ui.sheet) wireSheet();
		ui.exportButton.addEventListener('click', onExport);
		ui.errorState.addEventListener('basalt:retry', onRetry);
		loadPage().catch(() => {});
	}

	/* The page starts empty and fills in once the backend answers. */

	function loadPage() {
		return backend.fetchAll().then(adopt, (problem) => {
			ui.skeleton.hidden = true;
			ui.feedBody.removeAttribute('aria-busy');
			ui.errorState.hidden = false;
			ui.counter.textContent = "Couldn't load";
			ui.liveBox.hidden = true;
			throw problem;
		});
	}

	function onRetry({ detail }) {
		backend.fetchAll().then(
			(payload) => {
				ui.liveBox.hidden = false;
				adopt(payload);
				detail.done(true);
				say('Activity loaded');
			},
			() => detail.done(false),
		);
	}

	/** Takes a fresh payload from the backend and draws the whole page from it. */
	function adopt(payload) {
		source = payload;
		clock = parseStamp(payload.clock);
		midnight = new Date(clock.getFullYear(), clock.getMonth(), clock.getDate());
		memberById = nodeById(payload.members);
		verbById = nodeById(payload.verbs);
		areaById = nodeById(payload.areas);
		feed = [...payload.entries].sort(newestFirst);

		const earliest = dateKey(new Date(midnight.getTime() - (payload.historyDays - 1) * DAY_MS));
		for (const input of [ui.fromInput, ui.toInput]) {
			input.min = earliest;
			input.max = dateKey(midnight);
		}

		fillSelects();
		ui.skeleton.hidden = true;
		ui.errorState.hidden = true;
		ui.feedBody.removeAttribute('aria-busy');
		drawFeed();
		drawFigures();
		drawAlerts();
		drawPeople();

		if (!stopFollowing && feed.length) stopFollowing = backend.follow(onStreamEntry);
		if (!feed.length) {
			ui.liveBox.hidden = true;
			ui.exportButton.disabled = true;
		}
	}

	function fillSelects() {
		const alphabetical = [...source.members].sort((a, b) => a.fullName.localeCompare(b.fullName));
		const people = alphabetical.map(
			(member) =>
				`<option value="${htmlSafe(member.id)}" data-hint="${htmlSafe(member.roleName)}">${htmlSafe(member.fullName)}</option>`,
		);
		const verbs = source.verbs.map(
			(verb) =>
				`<option value="${htmlSafe(verb.id)}" data-icon="${htmlSafe(verb.icon.replace(/^bi-/, ''))}">${htmlSafe(verb.label)}</option>`,
		);
		const areas = source.areas.map(
			(area) => `<option value="${htmlSafe(area.id)}">${htmlSafe(area.label)}</option>`,
		);
		ui.personSelect.innerHTML = ['<option value="">Everyone</option>', ...people].join('');
		ui.actionSelect.innerHTML = ['<option value="">All actions</option>', ...verbs].join('');
		ui.areaSelect.innerHTML = ['<option value="">All areas</option>', ...areas].join('');
		for (const select of [ui.personSelect, ui.actionSelect, ui.areaSelect]) window.Basalt.select?.refresh(select);
	}

	/* Filters narrow the feed by person, action, area and date range. */

	function bindFilters() {
		for (const [key, { control }] of Object.entries(NARROWERS)) {
			control.addEventListener('change', () => {
				if (picks[key] !== control.value) applyPick(key, control.value);
			});
		}
		for (const radio of pickAll('input[name="ua-range"]')) radio.addEventListener('change', onRangeChange);
		for (const input of [ui.fromInput, ui.toInput]) input.addEventListener('change', onDatesChange);
		pick('[data-ua-filters]').addEventListener('submit', (event) => event.preventDefault());
		pick('[data-ua-clear]').addEventListener('click', () => {
			resetPicks();
			ui.personSelect.focus();
		});
	}

	function onRangeChange({ currentTarget: radio }) {
		if (!radio.checked) return;
		picks.range = radio.value;
		window.Basalt.slide(ui.dateRow, () => {
			ui.dateRow.hidden = radio.value !== 'custom';
		});

		/* A first visit to Custom starts on the last two weeks. */
		if (radio.value === 'custom' && !ui.fromInput.value) {
			ui.fromInput.value = dateKey(new Date(midnight.getTime() - 13 * DAY_MS));
			ui.toInput.value = dateKey(midnight);
			picks.from = ui.fromInput.value;
			picks.to = ui.toInput.value;
		}
		if (source) refilter();
	}

	function onDatesChange() {
		picks.from = ui.fromInput.value;
		picks.to = ui.toInput.value;
		refilter();
	}

	/**
	 * Sets one filter and redraws from the first batch. A range is routed
	 * through its radio, whose change handler then does the redrawing.
	 * @param {string} key person, action, area or range
	 * @param {string} value the new choice, '' for any
	 * @param {boolean} [quiet] skip the screen reader summary
	 */
	function applyPick(key, value, quiet) {
		picks[key] = value;
		if (NARROWERS[key]) NARROWERS[key].control.value = value;
		if (key === 'range') {
			const radio = pick(`input[name="ua-range"][value="${value}"]`);
			if (radio && !radio.checked) {
				radio.checked = true;
				radio.dispatchEvent(new Event('change', { bubbles: true }));
				return;
			}
			ui.dateRow.hidden = value !== 'custom';
		}
		refilter(quiet);
	}

	function refilter(quiet) {
		visible = BATCH;
		drawFeed();
		if (!quiet) say(ui.counter.textContent.trim());
	}

	function resetPicks() {
		for (const [key, { control }] of Object.entries(NARROWERS)) {
			picks[key] = '';
			control.value = '';
		}
		applyPick('range', '7');
		refilter();
	}

	function drawChips() {
		const chips = Object.entries(NARROWERS)
			.filter(([key]) => picks[key])
			.map(([key, { chip }]) => ({ label: chip(picks[key]), remove: () => applyPick(key, '') }));
		window.Basalt.drawer?.applied(ui.chips, chips, resetPicks, ui.personSelect);
	}

	/** The chosen dates as inclusive [first, last] day keys. */
	function rangeBounds() {
		const todayKey = dateKey(midnight);
		if (picks.range === 'today') return [todayKey, todayKey];
		if (picks.range === 'custom') {
			const low = picks.from || dateKey(new Date(midnight.getTime() - (source.historyDays - 1) * DAY_MS));
			const high = picks.to || todayKey;
			return low <= high ? [low, high] : [high, low];
		}
		const span = parseInt(picks.range, 10);
		return [
			dateKey(new Date(midnight.getFullYear(), midnight.getMonth(), midnight.getDate() - (span - 1))),
			todayKey,
		];
	}

	function passes(entry) {
		for (const [key, { field }] of Object.entries(NARROWERS)) {
			if (picks[key] && entry[field] !== picks[key]) return false;
		}
		const [low, high] = rangeBounds();
		const day = dayOf(entry.at);
		return day >= low && day <= high;
	}

	function currentMatches() {
		return feed.filter(passes);
	}

	/** The date range in words, ready to follow an event count. */
	function rangePhrase() {
		if (picks.range === 'today') return 'today';
		if (picks.range !== 'custom') return `in the last ${picks.range} days`;
		const [low, high] = rangeBounds();
		const lowDate = parseStamp(`${low}T00:00`);
		if (low === high) return `on ${longDate(lowDate)}`;
		return `from ${monthDay(lowDate)} to ${monthDay(parseStamp(`${high}T00:00`))}`;
	}

	/* The feed lists matching entries newest first, one section per day, a batch at a time. */

	function wireFeed() {
		ui.moreButton.addEventListener('click', () => {
			const alreadyShown = visible;
			window.Basalt.slide(ui.dayList, () => {
				visible += BATCH;
				drawFeed();
			});
			/* Focus lands on the first row that was not there before. */
			const firstNew = pickAll('.ua-event', ui.dayList)[alreadyShown];
			if (firstNew) pick('.ua-event-row', firstNew).focus();
			say(ui.moreStatus.textContent.trim());
		});
		ui.dayList.addEventListener('click', onFeedClick);
	}

	function onFeedClick({ target }) {
		const onlyButton = target.closest('[data-ua-only]');
		if (onlyButton) {
			applyPick('person', onlyButton.dataset.uaOnly);
			ui.personSelect.focus();
			return;
		}
		const aboutButton = target.closest('[data-ua-open]');
		if (aboutButton) {
			openSheet(aboutButton.dataset.uaOpen, aboutButton);
			return;
		}
		const header = target.closest('.ua-event-row');
		if (header) toggleEntry(header.closest('.ua-event'));
	}

	function drawFeed() {
		const matching = currentMatches();
		const perDay = {};
		for (const entry of matching) {
			const day = dayOf(entry.at);
			perDay[day] = (perDay[day] || 0) + 1;
		}

		const onScreen = matching.slice(0, visible);
		const sections = [];
		for (const entry of onScreen) {
			const day = dayOf(entry.at);
			const current = sections.at(-1);
			if (current?.day === day) current.entries.push(entry);
			else sections.push({ day, entries: [entry] });
		}
		ui.dayList.innerHTML = sections.map(({ day, entries }) => daySection(day, entries, perDay[day])).join('');

		const blank = !feed.length;
		ui.dayList.hidden = !onScreen.length;
		ui.emptyState.hidden = !blank;
		ui.noMatch.hidden = blank || matching.length > 0;
		if (!blank && !matching.length) {
			const member = picks.person ? memberById[picks.person] : null;
			const lead = member ? `${member.fullName} has nothing here` : 'Nothing here';
			ui.noMatchText.textContent = `${lead} ${rangePhrase()}. Try a wider date range, or clear the filters.`;
		}

		ui.moreFoot.hidden = matching.length <= BATCH && onScreen.length === matching.length;
		if (!ui.moreFoot.hidden) {
			const remaining = matching.length - onScreen.length;
			ui.moreStatus.innerHTML = `Showing <strong>${onScreen.length.toLocaleString('en-US')}</strong> of ${tally(matching.length, 'event')}`;
			ui.moreFoot.style.setProperty(
				'--basalt-loadmore-done',
				`${((onScreen.length / matching.length) * 100).toFixed(1)}%`,
			);
			ui.moreButton.hidden = remaining <= 0;
			ui.moreLabel.textContent = `Show ${Math.min(BATCH, remaining)} more`;
		}

		ui.counter.textContent = blank ? 'Nothing yet' : `${tally(matching.length, 'event')} ${rangePhrase()}`;
		drawChips();
	}

	/** Heading parts for a day: [lead, trailing], trailing empty past yesterday. */
	function dayName(day) {
		const date = parseStamp(`${day}T00:00`);
		const longForm = longDate(date);
		const lead = { 0: 'Today', 1: 'Yesterday' }[Math.round((midnight - date) / DAY_MS)];
		return lead ? [lead, longForm] : [longForm, ''];
	}

	function daySection(day, entries, total) {
		const [lead, trailing] = dayName(day);
		const spoken = trailing ? `${lead}, ${trailing}` : lead;
		return [
			`<section class="ua-day" aria-label="${htmlSafe(spoken)}" data-ua-day="${day}">`,
			`<h3 class="ua-day-title"><span class="ua-day-lead">${htmlSafe(lead)}</span>`,
			trailing ? `<span class="ua-day-rest">${htmlSafe(trailing)}</span>` : '',
			`<span class="ua-day-count" data-ua-day-count>${tally(total, 'event')}</span></h3>`,
			`<ol class="ua-events">${entries.map((entry) => entryRow(entry)).join('')}</ol>`,
			'</section>',
		].join('');
	}

	function entryRow(entry) {
		const member = memberById[entry.by];
		const verb = verbById[entry.verb];
		const area = areaById[entry.area];
		const flagged = entry.alertId && !dismissed.has(entry.alertId);
		const panelId = `ua-d-${entry.id}`;
		return [
			`<li class="ua-event${flagged ? ' is-flagged' : ''}" data-ua-event="${htmlSafe(entry.id)}">`,
			`<button class="ua-event-row" type="button" aria-controls="${panelId}" aria-expanded="false">`,
			`<span class="ua-event-time">${htmlSafe(clockTime(parseStamp(entry.at)))}</span>`,
			`<span class="basalt-avatar basalt-avatar-sm basalt-avatar-tone-${member.hue} ua-event-avatar" aria-hidden="true">${htmlSafe(monogram(member.fullName))}</span>`,
			'<span class="ua-event-main">',
			`<span class="ua-event-text"><strong>${htmlSafe(member.fullName)}</strong> ${htmlSafe(entry.summary)}</span>`,
			'<span class="ua-event-meta">',
			`<span class="badge basalt-badge-as-dot basalt-badge-tone-${area.tone}">${htmlSafe(area.label)}</span>`,
			`<span class="ua-event-kind"><i class="bi ${verb.icon}" aria-hidden="true"></i>${htmlSafe(verb.label)}</span>`,
			flagged ? UNUSUAL_BADGE : '',
			'</span></span>',
			'<i class="bi bi-chevron-down ua-event-chev" aria-hidden="true"></i></button>',
			`<div class="ua-event-detail" id="${panelId}" hidden></div>`,
			'</li>',
		].join('');
	}

	/** The expanded body of one entry: any open alert, the changes, then the facts. */
	function detailPanel(entry) {
		const member = memberById[entry.by];
		const seen = { city: member.city, ip: member.ip, device: member.device, auth: member.auth, ...entry.seenFrom };
		const when = parseStamp(entry.at);
		const changed = entry.fields.filter(([, before]) => before !== null);
		const facts = entry.fields
			.filter(([, before]) => before === null)
			.map(([label, , value]) => [label, htmlSafe(value)]);
		facts.push(
			['When', htmlSafe(`${longDate(when)} ${when.getFullYear()}, ${clockTime(when)}`)],
			['Where', `${htmlSafe(seen.city)} <span class="ua-muted">${htmlSafe(seen.ip)}</span>`],
			['Device', htmlSafe(seen.device)],
			['Signed in with', htmlSafe(seen.auth)],
			[
				'Event ID',
				`<code>${htmlSafe(entry.id)}</code> <button class="btn btn-sm btn-link ua-copy" type="button" aria-label="Copy event ID ${htmlSafe(entry.id)}" data-basalt-copy="${htmlSafe(entry.id)}"><i class="bi bi-copy" aria-hidden="true"></i></button>`,
			],
		);
		const openAlert =
			entry.alertId && source.alerts.find((item) => item.id === entry.alertId && !dismissed.has(item.id));
		const name = htmlSafe(firstName(member));
		const onlyButton =
			picks.person === entry.by
				? ''
				: `<button class="btn btn-sm btn-outline-secondary" type="button" data-ua-only="${htmlSafe(entry.by)}"><i class="bi bi-funnel me-1" aria-hidden="true"></i>Only ${name}'s activity</button>`;

		return [
			'<div class="ua-detail">',
			openAlert
				? `<p class="ua-detail-flag ua-tone-${openAlert.tone}"><i class="bi bi-exclamation-diamond" aria-hidden="true"></i><span><strong>${htmlSafe(openAlert.headline)}.</strong> ${htmlSafe(openAlert.note)}</span></p>`
				: '',
			changed.length ? changesTable(changed) : '',
			`<dl class="ua-meta">${facts.map(([label, value]) => metaRow(htmlSafe(label), value)).join('')}</dl>`,
			`<div class="ua-detail-actions">${onlyButton}<button class="btn btn-sm btn-link" type="button" data-ua-open="${htmlSafe(entry.by)}">About ${name}</button></div>`,
			'</div>',
		].join('');
	}

	function changesTable(changed) {
		const body = changed
			.map(
				([label, before, after]) =>
					`<tr><th scope="row">${htmlSafe(label)}</th><td class="ua-changes-before">${htmlSafe(before)}</td><td class="ua-changes-after">${htmlSafe(after)}</td></tr>`,
			)
			.join('');
		return [
			'<div class="ua-changes-wrap"><table class="ua-changes"><caption class="visually-hidden">What changed</caption>',
			'<thead><tr><th scope="col">Field</th><th scope="col">Before</th><th scope="col">After</th></tr></thead>',
			`<tbody>${body}</tbody></table></div>`,
		].join('');
	}

	function metaRow(label, value) {
		return `<div class="ua-meta-row"><dt>${label}</dt><dd>${value}</dd></div>`;
	}

	/**
	 * Opens or closes one entry, writing its detail the first time it opens.
	 * @param {HTMLElement} item the .ua-event list item
	 * @param {boolean} [wanted] force a state; leave out to flip it
	 */
	function toggleEntry(item, wanted) {
		const header = pick('.ua-event-row', item);
		const panel = pick('.ua-event-detail', item);
		const expand = wanted ?? header.getAttribute('aria-expanded') !== 'true';
		if (expand && !panel.innerHTML) {
			panel.innerHTML = detailPanel(feed.find((entry) => entry.id === item.dataset.uaEvent));
			window.Basalt.buttons?.(panel);
		}
		header.setAttribute('aria-expanded', String(expand));
		window.Basalt.slide(panel, () => {
			panel.hidden = !expand;
			item.classList.toggle('is-open', expand);
		});
	}

	/* A streamed entry slides in at the top of its day without redrawing the
     list, so open rows and keyboard focus stay put. */
	function placeOnTop(entry) {
		if (!passes(entry)) return;
		const day = dayOf(entry.at);
		const section = pick(`[data-ua-day="${day}"]`, ui.dayList);
		if (!section || ui.dayList.hidden) {
			drawFeed();
			return;
		}
		const list = pick('.ua-events', section);
		list.insertAdjacentHTML('afterbegin', entryRow(entry));
		if (!prefersStill()) list.firstElementChild.classList.add('is-new');
		visible += 1;
		const matching = currentMatches();
		pick('[data-ua-day-count]', section).textContent = tally(
			matching.filter((item) => dayOf(item.at) === day).length,
			'event',
		);
		ui.counter.textContent = `${tally(matching.length, 'event')} ${rangePhrase()}`;
	}

	/* While paused, streamed entries wait in a queue behind a "Show new" button. */

	function wireLive() {
		ui.liveButton.addEventListener('click', () => setStreaming(!streaming));
		pick('[data-ua-flush]').addEventListener('click', () => {
			releaseHeld();
			pick('.ua-event-row', ui.dayList)?.focus();
		});
	}

	function onStreamEntry(incoming) {
		/* Each arrival nudges the sample clock on by one to three minutes. */
		clock = new Date(clock.getTime() + (1 + (streamedCount % 3)) * 60000);
		streamedCount += 1;
		const entry = { id: `ev-${91000 + streamedCount}`, at: stamp(clock), ...incoming };
		if (streaming) {
			addEntries([entry]);
			return;
		}
		held.unshift(entry);
		drawHeld();
	}

	/** Puts a newest-first batch on top of the feed and refreshes what counts it. */
	function addEntries(batch) {
		const oldestFirst = [...batch].reverse();
		for (const entry of oldestFirst) feed.unshift(entry);
		for (const entry of oldestFirst) placeOnTop(entry);
		drawFigures();
		drawPeople();
	}

	function drawHeld() {
		ui.heldBar.hidden = !held.length;
		ui.heldText.textContent = `Show ${tally(held.length, 'new event')}`;
	}

	function releaseHeld() {
		const batch = held;
		held = [];
		drawHeld();
		if (batch.length) addEntries(batch);
	}

	function setStreaming(on) {
		streaming = on;
		ui.liveBox.classList.toggle('is-paused', !on);
		ui.liveText.textContent = on ? 'Live' : 'Paused';
		ui.liveLabel.textContent = on ? 'Pause' : 'Resume';
		ui.liveIcon.className = on ? 'bi bi-pause-fill' : 'bi bi-play-fill';
		if (on) releaseHeld();
		say(on ? 'Live updates on' : 'Live updates paused. New events will wait until you resume.');
	}

	/* Today's header figures, and the alerts for behavior outside someone's usual pattern. */

	function openAlerts() {
		return source.alerts.filter((item) => !dismissed.has(item.id));
	}

	function drawFigures() {
		const todayKey = dateKey(midnight);
		const todays = feed.filter((entry) => dayOf(entry.at) === todayKey);
		const figures = {
			people: new Set(todays.map((entry) => entry.by)).size,
			actions: todays.length,
			flags: openAlerts().length,
		};
		for (const [slot, amount] of Object.entries(figures)) {
			const node = pick(`[data-ua-fig="${slot}"]`);
			if (node) node.textContent = amount.toLocaleString('en-US');
		}
	}

	function drawAlerts() {
		const pending = openAlerts();
		ui.alertCount.textContent = String(pending.length);
		ui.alertCount.hidden = !pending.length;
		ui.alertsNone.hidden = pending.length > 0;
		ui.alertList.innerHTML = pending.map(alertCard).join('');
	}

	function alertCard(item) {
		const member = memberById[item.by];
		const id = htmlSafe(item.id);
		return [
			`<li class="ua-flag ua-tone-${item.tone}" data-ua-flag="${id}">`,
			`<div class="ua-flag-head"><span class="basalt-avatar basalt-avatar-xs basalt-avatar-tone-${member.hue}" aria-hidden="true">${htmlSafe(monogram(member.fullName))}</span><span class="ua-flag-who">${htmlSafe(member.fullName)}</span></div>`,
			`<h3 class="ua-flag-title">${htmlSafe(item.headline)}</h3>`,
			`<p class="ua-flag-text">${htmlSafe(item.note)}</p>`,
			`<div class="ua-flag-actions"><button class="btn btn-sm btn-outline-secondary" type="button" data-ua-flag-view="${id}">Show events</button><button class="btn btn-sm btn-link" type="button" data-ua-flag-ok="${id}">Looks fine</button></div>`,
			'</li>',
		].join('');
	}

	function onAlertListClick({ target }) {
		const viewButton = target.closest('[data-ua-flag-view]');
		if (viewButton) {
			revealAlert(viewButton.dataset.uaFlagView);
			return;
		}
		const fineButton = target.closest('[data-ua-flag-ok]');
		if (fineButton) dismissAlert(fineButton.dataset.uaFlagOk, true);
	}

	/* Narrows the feed to the person behind an alert over the last week and
     opens every entry tied to it, scrolling the first into view. */
	function revealAlert(alertId) {
		const record = source.alerts.find((item) => item.id === alertId);
		const tied = feed.filter((entry) => entry.alertId === alertId);
		picks.action = '';
		picks.area = '';
		ui.actionSelect.value = '';
		ui.areaSelect.value = '';
		picks.person = record.by;
		ui.personSelect.value = record.by;
		applyPick('range', '7', true);
		visible = BATCH;
		drawFeed();

		const leading = tied.length && pick(`[data-ua-event="${tied[0].id}"]`, ui.dayList);
		if (leading) {
			for (const entry of tied) {
				const item = pick(`[data-ua-event="${entry.id}"]`, ui.dayList);
				if (item) toggleEntry(item, true);
			}
			leading.scrollIntoView({ block: 'center', behavior: prefersStill() ? 'auto' : 'smooth' });
			pick('.ua-event-row', leading).focus({ preventScroll: true });
		}
		say(`Showing ${memberById[record.by].fullName}'s activity. ${tally(tied.length, 'flagged event')} opened.`);
	}

	/**
	 * Marks an alert as expected right away, offers Undo, and puts it back if
	 * the save fails.
	 * @param {string} alertId
	 * @param {boolean} [fromList] the press came from the side list, so focus
	 *   moves to the next alert or, when none is left, to the list heading
	 */
	function dismissAlert(alertId, fromList) {
		const record = source.alerts.find((item) => item.id === alertId);
		dismissed.add(alertId);
		refreshAlerts();
		notify({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'Marked as expected',
			text: `${record.headline} is off the list.`,
			duration: 6000,
			actions: [{ label: 'Undo', onClick: () => restoreAlert(alertId) }],
		});
		backend.dismissAlert(alertId).catch(() => {
			dismissed.delete(alertId);
			refreshAlerts();
			notify({
				tone: 'danger',
				icon: 'bi-exclamation-octagon',
				title: "Couldn't save that",
				text: 'The flag is back on the list. Try again in a moment.',
			});
		});

		const landing = pick('[data-ua-flag-view]', ui.alertList) || document.getElementById('ua-flags-title');
		if (!fromList || !landing) return;
		if (landing.id) landing.tabIndex = -1;
		landing.focus();
	}

	function restoreAlert(alertId) {
		dismissed.delete(alertId);
		refreshAlerts();
		backend.restoreAlert(alertId).catch(() => {
			dismissed.add(alertId);
			refreshAlerts();
			notify({
				tone: 'danger',
				icon: 'bi-exclamation-octagon',
				title: "Couldn't undo that",
				text: 'The flag stays resolved. Try again in a moment.',
			});
		});
	}

	/* Redraws everything an alert shows up in. Feed rows are patched in
     place, so rows the viewer has open stay open. */
	function refreshAlerts() {
		drawAlerts();
		drawFigures();
		drawPeople();

		for (const item of pickAll('.ua-event', ui.dayList)) {
			const entry = feed.find((candidate) => candidate.id === item.dataset.uaEvent);
			if (!entry?.alertId) continue;
			const active = !dismissed.has(entry.alertId);
			item.classList.toggle('is-flagged', active);
			const meta = pick('.ua-event-meta', item);
			const badge = pick('.ua-event-flag', meta);
			if (active && !badge) meta.insertAdjacentHTML('beforeend', UNUSUAL_BADGE);
			if (!active && badge) badge.remove();
			const panel = pick('.ua-event-detail', item);
			if (panel.innerHTML) {
				panel.innerHTML = detailPanel(entry);
				window.Basalt.buttons?.(panel);
			}
		}

		if (sheetMemberId) drawSheet(sheetMemberId);
	}

	/* Each teammate gets a row with their fourteen-day trend, busiest first. */

	/** One count per day for a teammate over the last `span` days, oldest first. */
	function dailyCounts(memberId, span) {
		const counts = new Array(span).fill(0);
		for (const entry of feed) {
			if (entry.by !== memberId) continue;
			const slot = span - 1 - Math.round((midnight - parseStamp(`${dayOf(entry.at)}T00:00`)) / DAY_MS);
			if (slot >= 0 && slot < span) counts[slot] += 1;
		}
		return counts;
	}

	function sumOf(values) {
		return values.reduce((sum, value) => sum + value, 0);
	}

	function drawPeople() {
		const flaggedIds = new Set(openAlerts().map((item) => item.by));
		const ranked = source.members
			.map((member) => {
				const counts = dailyCounts(member.id, 14);
				return { member, counts, fortnight: sumOf(counts) };
			})
			.sort((a, b) => b.fortnight - a.fortnight);
		ui.peopleList.innerHTML = ranked.map((row) => personRow(row, flaggedIds.has(row.member.id))).join('');
		window.Basalt.tips?.(ui.peopleList);
	}

	function personRow({ member, counts, fortnight }, flagged) {
		const name = htmlSafe(member.fullName);
		const href = profileHref(member);
		const tooltip = (title) => `data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="${title}"`;
		const label = member.profile
			? `<a class="ua-person-label ua-person-link" href="${href}">${name}</a>`
			: `<span class="ua-person-label">${name}</span>`;
		const marker = flagged
			? '<i class="bi bi-exclamation-diamond ua-person-flag" aria-hidden="true"></i><span class="visually-hidden">, has unusual activity</span>'
			: '';
		const fullPage = member.profile
			? `<a class="btn btn-icon btn-sm" href="${href}" aria-label="Open full page: ${name}" ${tooltip('Open full page')}><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>`
			: '';
		return [
			'<li class="ua-person">',
			`<span class="basalt-avatar basalt-avatar-sm basalt-avatar-tone-${member.hue}" aria-hidden="true">${htmlSafe(monogram(member.fullName))}</span>`,
			`<span class="ua-person-text"><span class="ua-person-name">${label}${marker}</span><span class="ua-person-role">${htmlSafe(member.roleName)}</span></span>`,
			sparkline(counts, 60, 24, flagged ? 'is-flagged' : ''),
			`<span class="ua-person-count">${fortnight}<span class="visually-hidden"> actions in 14 days, ${counts.at(-1)} today</span></span>`,
			'<span class="basalt-row-actions">',
			`<button class="btn btn-icon btn-sm" type="button" aria-label="Quick view: ${name}" aria-haspopup="dialog" ${tooltip('Quick view')} data-ua-person="${htmlSafe(member.id)}"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>`,
			fullPage,
			'</span></li>',
		].join('');
	}

	function sparkline(values, width, height, modifier) {
		const peak = Math.max(1, ...values);
		const stride = width / (values.length - 1);
		const points = values.map((value, index) => [
			+(index * stride).toFixed(1),
			+(height - 2 - (value / peak) * (height - 4)).toFixed(1),
		]);
		const path = points.map((point) => point.join(',')).join(' ');
		const [endX, endY] = points.at(-1);
		return [
			`<svg class="ua-spark ${modifier || ''}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true" focusable="false">`,
			`<polygon class="ua-spark-area" points="0,${height} ${path} ${width},${height}"/>`,
			`<polyline class="ua-spark-line" points="${path}"/>`,
			`<circle class="ua-spark-dot" cx="${endX}" cy="${endY}" r="2.5"/></svg>`,
		].join('');
	}

	/* The panel icon opens the quick view. The rest of the row behaves like a
     link to the full page: a middle click or Cmd/Ctrl opens a new tab.
     Anyone without a profile page gets the quick view instead. */
	function onPersonPress(event) {
		const { target, button } = event;
		const row = button < 2 && !target.closest('a') && target.closest('.ua-person');
		const quickView = row && pick('[data-ua-person]', row);
		if (!quickView) return;
		const member = source.members.find((candidate) => candidate.id === quickView.dataset.uaPerson);
		if (target.closest('button') || !member.profile) {
			if (button === 0) openSheet(member.id, quickView);
			return;
		}
		const href = profileHref(member);
		if (button === 1 || event.metaKey || event.ctrlKey) window.open(href, '_blank');
		else location.href = href;
	}

	/* The quick-view sheet sums up one teammate without leaving the page. */

	function wireSheet() {
		ui.sheet.addEventListener('hidden.bs.offcanvas', () => {
			sheetMemberId = null;
			if (sheetReturnTo && document.contains(sheetReturnTo)) sheetReturnTo.focus();
		});
		ui.sheet.addEventListener('click', ({ target }) => {
			const fineButton = target.closest('[data-ua-flag-ok]');
			if (fineButton) dismissAlert(fineButton.dataset.uaFlagOk);
		});
		pick('[data-ua-sheet-filter]', ui.sheet).addEventListener('click', () => {
			const memberId = sheetMemberId;
			sheetReturnTo = ui.personSelect;
			sheetPanel.hide();
			applyPick('person', memberId);
		});
		pick('[data-ua-signout]', ui.sheet).addEventListener('basalt:confirm', onSignOutConfirmed);
	}

	function openSheet(memberId, opener) {
		sheetMemberId = memberId;
		drawSheet(memberId);
		const signOut = pick('[data-ua-signout]', ui.sheet);
		signOut.hidden = memberId === source.viewer;
		resetHold(signOut);
		pick('[data-ua-sheet-filter]', ui.sheet).textContent = `Show ${firstName(memberById[memberId])}'s activity`;
		sheetPanel ??= bootstrap.Offcanvas.getOrCreateInstance(ui.sheet);
		sheetReturnTo = opener || null;
		sheetPanel.show();
	}

	function onSignOutConfirmed(event) {
		const member = memberById[sheetMemberId];
		const button = event.currentTarget;
		backend
			.signOutEverywhere(member.id)
			.then(() => {
				notify({
					tone: 'success',
					icon: 'bi-box-arrow-right',
					title: `${member.fullName} is signed out`,
					text: `Every session has ended. They will need to sign in again with ${member.auth}.`,
				});
				setTimeout(() => resetHold(button), 1500);
			})
			.catch(() => {
				resetHold(button);
				notify({
					tone: 'danger',
					icon: 'bi-exclamation-octagon',
					title: `Couldn't sign ${firstName(member)} out`,
					text: 'Nothing changed. Try again in a moment.',
				});
			});
	}

	/* A hold-to-confirm button goes back to its resting state. */
	function resetHold(button) {
		button.classList.remove('is-done', 'is-holding');
		button.style.setProperty('--basalt-hold', '0');
	}

	/** Fills the sheet header and body for one teammate. */
	function drawSheet(memberId) {
		const member = memberById[memberId];
		const month = dailyCounts(memberId, 30);
		const theirs = feed.filter((entry) => entry.by === memberId);
		const perArea = {};
		for (const entry of theirs) {
			if (entry.area !== 'signin') perArea[entry.area] = (perArea[entry.area] || 0) + 1;
		}
		const busiest = Object.keys(perArea)
			.sort((a, b) => perArea[b] - perArea[a])
			.slice(0, 3);
		const latest = theirs[0];

		const avatar = pick('[data-ua-sheet-avatar]', ui.sheet);
		avatar.className = `basalt-avatar basalt-avatar-lg basalt-avatar-tone-${member.hue}`;
		avatar.textContent = monogram(member.fullName);
		pick('[data-ua-sheet-name]', ui.sheet).textContent = member.fullName;
		pick('[data-ua-sheet-sub]', ui.sheet).textContent = `${member.jobTitle}, ${member.team} · ${member.region}`;
		const fullLink = pick('[data-ua-sheet-full]', ui.sheet);
		fullLink.hidden = !member.profile;
		if (member.profile) fullLink.href = profileHref(member);

		const body = pick('[data-ua-sheet-body]', ui.sheet);
		body.innerHTML = [
			openAlerts()
				.filter((item) => item.by === memberId)
				.map(sheetAlert)
				.join(''),
			`<dl class="ua-sheet-figs"><div><dt>Today</dt><dd>${month[29]}</dd></div><div><dt>7 days</dt><dd>${sumOf(month.slice(-7))}</dd></div><div><dt>30 days</dt><dd>${sumOf(month)}</dd></div></dl>`,
			sheetBlock('trend', 'Actions per day', trendBlock(month)),
			sheetBlock('about', 'Account', accountFacts(member, latest)),
			busiest.length ? sheetBlock('areas', 'Works mostly in', areaBars(busiest, perArea)) : '',
			sheetBlock('recent', 'Latest', `<ol class="ua-recent">${theirs.slice(0, 6).map(recentItem).join('')}</ol>`),
		].join('');

		/* Bar widths go on through style properties, never inline attributes. */
		for (const bar of pickAll('[data-ua-w]', body)) bar.style.width = `${bar.dataset.uaW}%`;
	}

	function sheetBlock(slug, heading, inner) {
		return `<section class="ua-sheet-block" aria-labelledby="ua-sheet-${slug}"><h3 class="ua-sheet-h" id="ua-sheet-${slug}">${heading}</h3>${inner}</section>`;
	}

	function sheetAlert(item) {
		return `<div class="ua-sheet-flag ua-tone-${item.tone}"><i class="bi bi-exclamation-diamond" aria-hidden="true"></i><div><strong>${htmlSafe(item.headline)}</strong><p>${htmlSafe(item.note)}</p><button class="btn btn-sm btn-link" type="button" data-ua-flag-ok="${htmlSafe(item.id)}">Looks fine</button></div></div>`;
	}

	function trendBlock(month) {
		const windowStart = new Date(midnight.getTime() - 29 * DAY_MS);
		const axisStart = `${MONTH_NAMES[windowStart.getMonth()].slice(0, 3)} ${windowStart.getDate()}`;
		return `${dayBars(month)}<div class="ua-sheet-axis" aria-hidden="true"><span>${axisStart}</span><span>Today</span></div><p class="visually-hidden">${sumOf(month)} actions in the last 30 days, busiest day ${Math.max(...month)}.</p>`;
	}

	function accountFacts(member, latest) {
		const rows = [
			metaRow('Role', `<a href="roles.html">${htmlSafe(member.roleName)}</a>`),
			metaRow('Signs in with', htmlSafe(member.auth)),
			metaRow('Usual device', htmlSafe(member.device)),
		];
		if (latest) {
			const city = { city: member.city, ...latest.seenFrom }.city;
			rows.push(
				metaRow(
					'Last seen',
					htmlSafe(`${dayName(dayOf(latest.at))[0]}, ${clockTime(parseStamp(latest.at))}, ${city}`),
				),
			);
		}
		return `<dl class="ua-meta">${rows.join('')}</dl>`;
	}

	function areaBars(busiest, perArea) {
		const top = perArea[busiest[0]];
		const items = busiest.map(
			(areaId) =>
				`<li><span class="ua-areas-label">${htmlSafe(areaById[areaId].label)}</span><span class="ua-areas-bar" aria-hidden="true"><span data-ua-w="${Math.round((perArea[areaId] / top) * 100)}"></span></span><span class="ua-areas-n">${perArea[areaId]}</span></li>`,
		);
		return `<ul class="ua-areas">${items.join('')}</ul>`;
	}

	function recentItem(entry) {
		const sentence = entry.summary.charAt(0).toUpperCase() + entry.summary.slice(1);
		const when = `${dayName(dayOf(entry.at))[0].split(' ')[0]}, ${clockTime(parseStamp(entry.at))}`;
		return `<li><span class="ua-recent-text">${htmlSafe(sentence)}</span><span class="ua-recent-time">${htmlSafe(when)}</span></li>`;
	}

	/** Thirty slim columns, today's drawn in the full accent. */
	function dayBars(values) {
		const peak = Math.max(1, ...values);
		const width = 300;
		const height = 64;
		const gap = 2;
		const barWidth = (width - gap * (values.length - 1)) / values.length;
		const lastIndex = values.length - 1;
		const rects = values.map((value, index) => {
			const barHeight = Math.max(1.5, (value / peak) * (height - 2));
			return `<rect class="${index === lastIndex ? 'is-today' : ''}" x="${(index * (barWidth + gap)).toFixed(2)}" y="${(height - barHeight).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="1.5"/>`;
		});
		return `<svg class="ua-bars" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${rects.join('')}</svg>`;
	}

	/* Export hands over exactly the entries the filters match, as a CSV file. */

	function onExport() {
		if (!source || ui.exportButton.getAttribute('aria-busy') === 'true') return;
		const chosen = currentMatches();
		if (!chosen.length) {
			notify({
				tone: 'info',
				icon: 'bi-info-circle',
				title: 'Nothing to export',
				text: 'No events match the filters.',
			});
			return;
		}

		exportState('loading');
		backend
			.exportCsv(chosen)
			.then((csv) => {
				const [firstDay, finalDay] = rangeBounds();
				const link = document.createElement('a');
				link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
				link.download = `fieldline-activity-${firstDay}-to-${finalDay}.csv`;
				document.body.appendChild(link);
				link.click();
				link.remove();
				setTimeout(() => URL.revokeObjectURL(link.href), 2000);
				exportState('success');
				notify({
					tone: 'success',
					icon: 'bi-filetype-csv',
					title: `Exported ${tally(chosen.length, 'event')}`,
					text: link.download,
				});
			})
			.catch(() => {
				exportState('error');
				notify({
					tone: 'danger',
					icon: 'bi-exclamation-octagon',
					title: 'Export failed',
					text: 'The file was not made. Try again in a moment.',
				});
			})
			.then(() => setTimeout(() => exportState('idle'), 2000));
	}

	function exportState(mode) {
		window.Basalt.buttonState?.(ui.exportButton, mode);
	}

	function buildCsv(chosen) {
		const lines = [CSV_COLUMNS.join(',')];
		for (const entry of chosen) {
			const member = memberById[entry.by];
			const seen = {
				city: member.city,
				ip: member.ip,
				device: member.device,
				auth: member.auth,
				...entry.seenFrom,
			};
			const changeText = entry.fields
				.map(([label, before, after]) =>
					before === null ? `${label}: ${after}` : `${label}: ${before} to ${after}`,
				)
				.join('; ');
			const cells = [
				entry.at.replace('T', ' '),
				member.fullName,
				member.roleName,
				verbById[entry.verb].label,
				areaById[entry.area].label,
				`${member.fullName} ${entry.summary}`,
				changeText,
				seen.city,
				seen.ip,
				seen.device,
				seen.auth,
				entry.id,
			];
			lines.push(cells.map(csvField).join(','));
		}
		return lines.join('\r\n');
	}

	function csvField(value) {
		const text = String(value ?? '');
		return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
	}

	/* The sample's everyday work is generated, from a fixed seed, so it reads the same on every load. */

	function toMember(row) {
		const [id, profile, wholeName, roleName, jobTitle, team, region, hue, cadence, auth, device, city, ip, joined] =
			row;
		return {
			id,
			profile,
			fullName: wholeName,
			roleName,
			jobTitle,
			team,
			region,
			hue,
			cadence,
			auth,
			device,
			city,
			ip,
			joined,
		};
	}

	/** mulberry32: a tiny seeded generator, so the sample is identical on every visit. */
	function seededRandom(seed) {
		let cursor = seed >>> 0;
		return function draw() {
			cursor = (cursor + 0x6d2b79f5) >>> 0;
			let mixed = cursor;
			mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	/**
	 * The chores each role does on an ordinary day, as [weight, make] pairs.
	 * Every make() call draws from `chance` in a fixed order and returns an
	 * entry without its id, time or author.
	 */
	function choresByRole(chance) {
		function oneOf(options) {
			return options[Math.floor(chance() * options.length)];
		}
		function between(low, high) {
			return low + Math.floor(chance() * (high - low + 1));
		}
		/* Two different picks from the same pool, as [was, now]. */
		function swap(options) {
			const was = oneOf(options);
			const drawn = oneOf(options);
			return [was, drawn === was ? options[(options.indexOf(was) + 1) % options.length] : drawn];
		}
		function entry(verb, area, summary, fields) {
			return { verb, area, summary, fields };
		}
		function csvRows(count) {
			return [
				['Rows', null, String(count)],
				['Format', null, 'CSV'],
			];
		}
		function reportExport(low, high) {
			return entry(
				'export',
				'reports',
				`exported the ${oneOf(REPORT_NAMES)} report`,
				csvRows(between(low, high)),
			);
		}
		function moveVisit() {
			const account = oneOf(ACCOUNTS);
			const [fromTech, toTech] = swap(CREW);
			const slot = swap(SLOTS);
			const visit = between(4300, 4560);
			return entry('edit', 'dispatch', `moved visit #${visit} for ${account} to ${toTech}`, [
				['Team member', fromTech, toTech],
				['Arrival window', ...slot],
			]);
		}
		function newAddress() {
			const account = oneOf(ACCOUNTS);
			return entry('edit', 'customers', `updated the service address for ${account}`, [
				['Service address', ...swap(ADDRESSES)],
			]);
		}
		function newPayer() {
			const account = oneOf(ACCOUNTS);
			return entry('edit', 'customers', `changed the billing contact for ${account}`, [
				['Billing contact', ...swap(PAYERS)],
			]);
		}
		function addNote() {
			const account = oneOf(ACCOUNTS);
			return entry('create', 'customers', `added a note to ${account}`, [['Note', null, oneOf(NOTES)]]);
		}
		function publishBoard() {
			const account = oneOf(ACCOUNTS);
			const booked = between(14, 30);
			return entry('edit', 'dispatch', `published the schedule board for ${account}`, [
				['Visits scheduled', String(booked), String(booked + between(1, 6))],
			]);
		}
		function growCrew() {
			const account = oneOf(ACCOUNTS);
			return entry('create', 'dispatch', `added ${oneOf(CREW)} to the team at ${account}`, [
				['Team size', '4', '5'],
			]);
		}
		function sendInvoice() {
			const account = oneOf(ACCOUNTS);
			const amount = between(6, 48) * 40;
			return entry('create', 'billing', `sent invoice #${between(20500, 20920)} to ${account}`, [
				['Status', 'Draft', 'Sent'],
				['Amount', null, `$${amount.toLocaleString('en-US')}.00`],
			]);
		}
		function applyCredit() {
			const account = oneOf(ACCOUNTS);
			const balance = between(4, 12) * 60;
			return entry('edit', 'billing', `applied a credit to ${account}`, [
				['Balance', `$${balance}.00`, `$${balance - 60}.00`],
			]);
		}
		function markPaid() {
			return entry('edit', 'billing', `marked an invoice for ${oneOf(ACCOUNTS)} as paid`, [
				['Status', 'Sent', 'Paid'],
			]);
		}
		function tuneSync() {
			return entry('edit', 'integrations', `changed the ${oneOf(APPS)} sync settings`, [
				['Sync every', '15 minutes', '5 minutes'],
			]);
		}
		function rotateKey() {
			const keyName = oneOf(['Mobile app', 'Reporting export', 'Webhook relay']);
			return entry('edit', 'apikeys', `rotated the ${keyName} API key`, [
				['Key ending', `…${between(1000, 9999)}`, `…${between(1000, 9999)}`],
			]);
		}

		return {
			'Support agent': [
				[4, newAddress],
				[3, newPayer],
				[3, addNote],
				[2, moveVisit],
			],
			'Scheduling manager': [
				[5, moveVisit],
				[2, publishBoard],
				[1, growCrew],
				[1, () => reportExport(40, 260)],
			],
			'Billing admin': [
				[4, sendInvoice],
				[2, applyCredit],
				[1, markPaid],
			],
			Engineer: [
				[3, tuneSync],
				[1, rotateKey],
				[2, () => entry('export', 'reports', 'exported the API usage report', csvRows(between(300, 900)))],
			],
			'Read-only': [
				[4, () => reportExport(20, 180)],
				[
					1,
					() =>
						entry(
							'export',
							'customers',
							`exported ${oneOf(['customers in Colorado', 'customers renewing in October', 'customers on the Pro plan'])}`,
							csvRows(between(30, 160)),
						),
				],
			],
			Administrator: [
				[
					2,
					() =>
						entry(
							'invite',
							'users',
							`invited ${oneOf(['r.freeman', 'e.walsh', 'b.osgood', 'l.monroe'])}@fieldline.app`,
							[['Role', null, oneOf(['Support agent', 'Read-only', 'Engineer'])]],
						),
				],
				[
					2,
					() =>
						entry('edit', 'settings', 'changed the session timeout', [
							['Sign out after', '8 hours idle', '12 hours idle'],
						]),
				],
				[
					2,
					() =>
						entry('edit', 'integrations', `reconnected ${oneOf(APPS)}`, [
							['Status', 'Needs attention', 'Connected'],
						]),
				],
				[
					1,
					() =>
						entry('delete', 'users', `removed a guest seat for ${oneOf(ACCOUNTS)}`, [
							['Seats in use', '58', '57'],
						]),
				],
			],
			Owner: [
				[
					2,
					() =>
						entry('edit', 'billing', 'reviewed and approved a plan change', [['Plan', ...oneOf(UPGRADES)]]),
				],
				[
					2,
					() =>
						entry(
							'export',
							'reports',
							'exported the Revenue by customer report',
							csvRows(between(180, 260)),
						),
				],
			],
		};
	}

	/* Weighted choice: a roll across the summed weights lands in one chore. */
	function pickChore(chores, totalWeight, chance) {
		let remaining = chance() * totalWeight;
		for (const [weight, make] of chores) {
			remaining -= weight;
			if (remaining < 0) return make;
		}
		return chores[0][1];
	}

	/**
	 * Thirty days of ordinary work for the whole team, stopping at `until`.
	 * Weekends are quiet, and nobody shows up before their first day. Ben
	 * worked as Read-only until his role changed this morning.
	 */
	function routine(until) {
		const chance = seededRandom(20261002);
		const chores = choresByRole(chance);
		const made = [];
		const startOfDay = new Date(until.getFullYear(), until.getMonth(), until.getDate());

		function log(member, date, minute, item) {
			const at = new Date(date.getTime() + minute * 60000);
			if (at >= until) return false;
			made.push({ id: `ev-${80000 + made.length}`, at: stamp(at), by: member.id, ...item });
			return true;
		}

		for (let daysBack = 29; daysBack >= 0; daysBack -= 1) {
			const date = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), startOfDay.getDate() - daysBack);
			const restDay = date.getDay() % 6 === 0;
			for (const member of TEAM) {
				if (restDay && chance() > 0.18) continue;
				if (member.joined && dateKey(date) < member.joined) continue;
				const duties = chores[member.id === 'ben' ? 'Read-only' : member.roleName];
				const rounds = restDay
					? 1 + Math.floor(chance() * 2)
					: Math.max(1, Math.round(member.cadence * (0.55 + chance() * 0.9)));
				let minute = 480 + Math.floor(chance() * 75);
				if (!log(member, date, minute, { verb: 'signin', area: 'signin', summary: 'signed in', fields: [] }))
					continue;
				const totalWeight = sumOf(duties.map(([weight]) => weight));
				for (let round = 0; round < rounds; round += 1) {
					minute += 8 + Math.floor(chance() * (540 / Math.max(3, member.cadence)));
					if (!log(member, date, minute, pickChore(duties, totalWeight, chance)())) break;
				}
			}
		}
		return made;
	}

	/* Small helpers the rest of the file leans on. */

	function pick(selector, scope = page) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = page) {
		return [...scope.querySelectorAll(selector)];
	}

	function nodeById(list) {
		return Object.fromEntries(list.map((item) => [item.id, item]));
	}

	function newestFirst(a, b) {
		if (a.at === b.at) return 0;
		return a.at < b.at ? 1 : -1;
	}

	function resolveAfter(ms, value) {
		return new Promise((resolve) => setTimeout(() => resolve(value), ms));
	}

	function rejectAfter(ms, message) {
		return resolveAfter(ms).then(() => {
			throw new Error(message);
		});
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (character) => ENTITIES[character]);
	}

	function say(text) {
		window.Basalt.announce?.(text);
	}

	function notify(options) {
		window.Basalt.toasts?.push(options);
	}

	function prefersStill() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function tally(amount, noun) {
		return `${amount.toLocaleString('en-US')} ${noun}${amount === 1 ? '' : 's'}`;
	}

	function monogram(wholeName) {
		return wholeName
			.split(' ')
			.filter(Boolean)
			.map((word) => word[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	function firstName(member) {
		return member.fullName.split(' ')[0];
	}

	function profileHref(member) {
		return `employee-user-details.html?id=${encodeURIComponent(member.profile)}`;
	}

	/* Dates travel as local "YYYY-MM-DDTHH:MM" strings; a day is the first ten characters. */

	function twoDigits(number) {
		return String(number).padStart(2, '0');
	}

	function dateKey(date) {
		return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
	}

	function stamp(date) {
		return `${dateKey(date)}T${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
	}

	function parseStamp(text) {
		const [, year, month, day, hour, minute] = text.match(/^(\d+)-(\d+)-(\d+)T(\d+):(\d+)/).map(Number);
		return new Date(year, month - 1, day, hour, minute);
	}

	function dayOf(text) {
		return text.slice(0, 10);
	}

	function clockTime(date) {
		const hour = date.getHours();
		return `${hour % 12 || 12}:${twoDigits(date.getMinutes())} ${hour < 12 ? 'am' : 'pm'}`;
	}

	function monthDay(date) {
		return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
	}

	function longDate(date) {
		return `${WEEKDAYS[date.getDay()]}, ${monthDay(date)}`;
	}
})();
