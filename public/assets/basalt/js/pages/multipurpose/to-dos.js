/**
 * To Dos (to-dos.html). The script wakes up only when the page holds a
 * [data-tdl-root] element, and from then on it owns everything inside it:
 * the view, list and teammate column, the task rows, the quick add field that
 * understands words like "fri", "#accounts", "!1" or "@theo", the task drawer,
 * the list dialogs and the one-task-at-a-time focus mode with its timer.
 *
 * All of it is drawn from SAMPLE below through the small `server` object, so
 * a real backend replaces those two and nothing else. Toasts, drawers, hold to
 * confirm, sortable rows, styled selects, avatars and tooltips are borrowed
 * from basalt.js.
 */
(() => {
	'use strict';

	const app = pick('[data-tdl-root]');
	if (!app) return;

	/* A seeded sequence instead of Math.random, so the sample reads the same on
     every visit. */
	const draw = makeSequence(2093);

	/* Sample content. Dates are offsets from the day the page opens, so there is
     always work due today; a real feed would send fixed "YYYY-MM-DD" strings.
     A list's tint is a chart color from 1 to 8, and the locked Inbox catches
     anything without a list. A due of null means Someday, priority runs from
     1 (urgent) to 4 (low), and steps are the checklist inside a task. */
	const SAMPLE = {
		me: 'john',
		people: [
			{ id: 'john', name: 'John Armstrong', role: 'Head of customer operations' },
			{ id: 'theo', name: 'Theo Barlow', role: 'Account manager' },
			{ id: 'connie', name: 'Lindsay Kinney', role: 'Support lead' },
			{ id: 'rory', name: 'Rory Whitlock', role: 'Add-ons and billing' },
			{ id: 'dawn', name: 'Dawn Zeller', role: 'Onboarding specialist' },
		],
		lists: [
			{ id: 'inbox', name: 'Inbox', tint: 1, locked: true },
			{ id: 'launch', name: 'Travel Planner launch', tint: 2 },
			{ id: 'accounts', name: 'Accounts', tint: 3 },
			{ id: 'onboarding', name: 'Onboarding', tint: 4 },
			{ id: 'store', name: 'Add-ons', tint: 5 },
			{ id: 'personal', name: 'Personal', tint: 6 },
		],
		tasks: [
			{
				id: 't101',
				title: 'Sign off all the Travel Planner help articles',
				list: 'launch',
				due: dayFromNow(0),
				priority: 1,
				assignee: 'john',
				notes: 'Support needs them by 3pm to load the macros before Friday.',
				steps: [
					{ id: 's1', title: 'Check the screenshots match the new board', done: true },
					{ id: 's2', title: 'Check the per-seat price matches the pricing page', done: true },
					{ id: 's3', title: 'Reply to the docs team', done: false },
				],
			},
			{
				id: 't102',
				title: 'Set the launch discount for existing Pro accounts',
				list: 'launch',
				due: dayFromNow(-1),
				priority: 1,
				assignee: 'john',
				notes: 'Add-on lists at $6 a seat a month. Margin sheet is in the shared drive.',
				steps: [],
			},
			{
				id: 't103',
				title: 'Record the Travel Planner demo for the pricing page',
				list: 'launch',
				due: dayFromNow(1),
				priority: 2,
				assignee: 'dawn',
				notes: '',
				steps: [
					{ id: 's1', title: 'Load the demo account with a week of visits', done: false },
					{ id: 's2', title: 'Record on a phone and the desktop', done: false },
				],
			},
			{
				id: 't104',
				title: 'Write the in-app tour for the new day plan view',
				list: 'launch',
				due: dayFromNow(3),
				priority: 3,
				assignee: 'dawn',
				notes: 'Keep it to four steps, same voice as the schedule board tour.',
				steps: [],
			},
			{
				id: 't105',
				title: 'Schedule the launch email for Thursday morning',
				list: 'launch',
				due: dayFromNow(2),
				priority: 2,
				assignee: 'connie',
				notes: '',
				steps: [],
			},
			{
				id: 't106',
				title: 'Send Oakhaven Studio their Max renewal quote',
				list: 'accounts',
				due: dayFromNow(0),
				priority: 2,
				assignee: 'theo',
				notes: '',
				steps: [],
			},
			{
				id: 't107',
				title: 'Chase the unpaid invoice from Avocet Robotics',
				list: 'accounts',
				due: dayFromNow(-2),
				priority: 1,
				assignee: 'theo',
				notes: 'Invoice 2214, 38 days late. Second reminder already sent.',
				steps: [],
			},
			{
				id: 't108',
				title: 'Book a check-in call with Larchwood Studios',
				list: 'accounts',
				due: dayFromNow(5),
				priority: 3,
				assignee: 'theo',
				notes: '',
				steps: [],
			},
			{
				id: 't109',
				title: 'Quote 40 extra seats for Northgate Analytics',
				list: 'accounts',
				due: null,
				priority: 4,
				assignee: 'theo',
				notes: '',
				steps: [],
			},
			{
				id: 't110',
				title: 'Reply to customers asking to pause seats over the winter',
				list: 'onboarding',
				due: dayFromNow(0),
				priority: 2,
				assignee: 'connie',
				notes: 'Eleven emails so far. Use the seat pause template.',
				steps: [],
			},
			{
				id: 't111',
				title: "Fix the welcome email showing last month's training dates",
				list: 'onboarding',
				due: dayFromNow(1),
				priority: 1,
				assignee: 'connie',
				notes: '',
				steps: [
					{ id: 's1', title: 'Find which template it uses', done: true },
					{ id: 's2', title: 'Send a test to yourself', done: false },
				],
			},
			{
				id: 't112',
				title: "Move Lakeside Apparel's data import to next week",
				list: 'onboarding',
				due: dayFromNow(4),
				priority: 2,
				assignee: 'john',
				notes: '',
				steps: [],
			},
			{
				id: 't113',
				title: 'Top up the SMS credit packs before the Friday billing run',
				list: 'store',
				due: dayFromNow(2),
				priority: 2,
				assignee: 'rory',
				notes: '',
				steps: [],
			},
			{
				id: 't114',
				title: 'Refund the double-charged data import from last week',
				list: 'store',
				due: dayFromNow(0),
				priority: 3,
				assignee: 'rory',
				notes: 'Order 4127. The customer keeps the import we already ran.',
				steps: [],
			},
			{
				id: 't115',
				title: 'Ask finance about Saturday training sessions',
				list: 'store',
				due: dayFromNow(8),
				priority: 3,
				assignee: 'rory',
				notes: '',
				steps: [],
			},
			{
				id: 't116',
				title: 'Count the unused training sessions this quarter',
				list: 'store',
				due: null,
				priority: 4,
				assignee: 'rory',
				notes: '',
				steps: [],
			},
			{
				id: 't117',
				title: 'Renew the first aid certificate',
				list: 'personal',
				due: dayFromNow(12),
				priority: 2,
				assignee: 'john',
				notes: '',
				steps: [],
			},
			{
				id: 't118',
				title: 'Shadow a Brightline Photography shoot for a day',
				list: 'personal',
				due: null,
				priority: 4,
				assignee: 'john',
				notes: '',
				steps: [],
			},
			{
				id: 't119',
				title: 'Add a 5,000-credit SMS pack to the price list',
				list: 'inbox',
				due: null,
				priority: 3,
				assignee: 'dawn',
				notes: '',
				steps: [],
			},
			{
				id: 't120',
				title: 'Look into a smaller SMS credit pack',
				list: 'inbox',
				due: null,
				priority: 4,
				assignee: null,
				notes: 'Two customers asked this week.',
				steps: [],
			},
			{
				id: 't121',
				title: 'Book more live training slots',
				list: 'store',
				due: dayFromNow(0),
				priority: 2,
				assignee: 'rory',
				notes: '',
				steps: [],
				done: true,
				doneAt: stampAt(0),
			},
			{
				id: 't122',
				title: 'Send the welcome pack to Copperleaf Design',
				list: 'accounts',
				due: dayFromNow(0),
				priority: 3,
				assignee: 'theo',
				notes: '',
				steps: [],
				done: true,
				doneAt: stampAt(0),
			},
			{
				id: 't123',
				title: 'Upload the September add-on report',
				list: 'store',
				due: dayFromNow(-1),
				priority: 3,
				assignee: 'rory',
				notes: '',
				steps: [],
				done: true,
				doneAt: stampAt(-1),
			},
			{
				id: 't124',
				title: 'Pick the October live training dates',
				list: 'onboarding',
				due: dayFromNow(-2),
				priority: 2,
				assignee: 'john',
				notes: '',
				steps: [],
				done: true,
				doneAt: stampAt(-2),
			},
			{
				id: 't125',
				title: 'Send 62 staff invites for Highpoint Outfitters',
				list: 'store',
				due: dayFromNow(-3),
				priority: 2,
				assignee: 'rory',
				notes: '',
				steps: [],
				done: true,
				doneAt: stampAt(-3),
			},
		],
	};

	/* to-dos.html?state=empty, ?state=error and ?state=slow preview the other
     screens. Drop this line once the page talks to a real server. */
	const demoMode = new URLSearchParams(location.search).get('state') || '';

	/* The only place that would talk to a backend. Every method hands back a
     Promise; swap each body for a fetch() and keep the shapes. */
	let fetchCount = 0;
	const server = {
		/* GET /api/tasks, answering { me, people, lists, tasks }. */
		fetchBoard() {
			fetchCount += 1;
			return new Promise((resolve, reject) => {
				const delay = demoMode === 'slow' ? 4000 : 400;
				setTimeout(() => {
					if (demoMode === 'error' && fetchCount === 1) {
						reject(new Error('Network error'));
						return;
					}
					const copy = copyOf(SAMPLE);
					resolve(demoMode === 'empty' ? { ...copy, tasks: [] } : copy);
				}, delay);
			});
		},
		/* POST /api/tasks for a new task, PUT /api/tasks/:id for a known one. */
		putTask(task) {
			return Promise.resolve(copyOf(task));
		},
		/* DELETE /api/tasks with { ids }. */
		dropTasks(ids) {
			return Promise.resolve(ids);
		},
		/* PUT /api/tasks/order with { ids } in the order they now show. */
		putOrder(ids) {
			return Promise.resolve(ids);
		},
		/* POST /api/lists for a new list, PUT /api/lists/:id for a known one. */
		putList(entry) {
			return Promise.resolve(copyOf(entry));
		},
		/* DELETE /api/lists/:id, which takes the list's tasks with it. */
		dropList(id) {
			return Promise.resolve(id);
		},
	};

	const LEVELS = {
		1: { label: 'Urgent', glyph: 'bi-flag-fill' },
		2: { label: 'High', glyph: 'bi-flag-fill' },
		3: { label: 'Normal', glyph: 'bi-flag-fill' },
		4: { label: 'Low', glyph: 'bi-flag' },
	};
	const LEVEL_WORDS = { urgent: 1, high: 2, normal: 3, low: 4 };

	const BUILT_IN_VIEWS = [
		{ key: 'today', label: 'Today', icon: 'bi-sun' },
		{ key: 'upcoming', label: 'Upcoming', icon: 'bi-calendar3' },
		{ key: 'someday', label: 'Someday', icon: 'bi-cloud' },
		{ key: 'all', label: 'Everything', icon: 'bi-collection' },
	];

	/* Which open tasks each built-in view holds; list and person views are
     matched by their id in belongsTo(). */
	const VIEW_RULES = new Map([
		['today', (task) => Boolean(task.due) && daysAway(task.due) <= 0],
		['upcoming', (task) => Boolean(task.due) && daysAway(task.due) > 0],
		['someday', (task) => !task.due],
		['all', () => true],
	]);

	const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const NEARBY_DAYS = { '-1': 'Yesterday', 0: 'Today', 1: 'Tomorrow' };
	const WEEKDAY_INDEX = {
		sun: 0,
		sunday: 0,
		mon: 1,
		monday: 1,
		tue: 2,
		tues: 2,
		tuesday: 2,
		wed: 3,
		wednesday: 3,
		thu: 4,
		thur: 4,
		thurs: 4,
		thursday: 4,
		fri: 5,
		friday: 5,
		sat: 6,
		saturday: 6,
	};
	const MONTH_INDEX = {
		jan: 0,
		feb: 1,
		mar: 2,
		apr: 3,
		may: 4,
		jun: 5,
		jul: 6,
		aug: 7,
		sep: 8,
		sept: 8,
		oct: 9,
		nov: 10,
		dec: 11,
	};
	const SWATCHES = [1, 2, 3, 4, 5, 6, 7, 8];
	const SPRINT_SECONDS = 25 * 60;
	const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	const ADD_BUTTON =
		'<button type="button" class="btn btn-sm btn-primary" data-tdl-add-focus><i class="bi bi-plus-lg" aria-hidden="true"></i>Add a task</button>';
	const RESCHEDULE_BUTTON =
		'<button type="button" class="btn btn-sm tdl-group-action" data-tdl-reschedule><i class="bi bi-arrow-right-circle" aria-hidden="true"></i>Move all to today</button>';

	/* What the page is showing. view is today, upcoming, someday, all,
     list:<id> or person:<id>; sort is mine, due or priority. */
	const store = {
		ready: false,
		me: '',
		people: [],
		lists: [],
		tasks: [],
		view: 'today',
		sort: 'mine',
		search: '',
		doneExpanded: false,
	};

	const ui = {
		body: pick('[data-tdl-body]', app),
		heading: pick('[data-tdl-view-title]', app),
		subline: pick('[data-tdl-view-sub]', app),
		viewsNav: pick('[data-tdl-nav="views"]', app),
		listsNav: pick('[data-tdl-nav="lists"]', app),
		peopleNav: pick('[data-tdl-nav="people"]', app),
		search: pick('[data-tdl-search]', app),
		sortNote: pick('[data-tdl-order-note]', app),
		listMenu: pick('[data-tdl-list-menu]', app),
		quickForm: pick('[data-tdl-quick-form]', app),
		quickInput: pick('[data-tdl-quick]', app),
		readout: pick('[data-tdl-parsed]', app),
		suggestions: pick('[data-tdl-suggest]', app),
		drawerPanel: document.getElementById('tdl-sheet'),
		listModal: document.getElementById('tdl-list-dialog'),
		deleteModal: document.getElementById('tdl-list-delete'),
		focusModal: document.getElementById('tdl-focus'),
	};

	/* The task drawer's fields, plus the copy of the task being edited. */
	const taskSheet = {
		form: pick('[data-tdl-sheet-form]', ui.drawerPanel),
		title: pick('[data-tdl-sheet-title]', ui.drawerPanel),
		subtitle: pick('[data-tdl-sheet-sub]', ui.drawerPanel),
		nameField: document.getElementById('tdl-sheet-name'),
		dueField: document.getElementById('tdl-sheet-due'),
		listField: document.getElementById('tdl-sheet-list'),
		ownerField: document.getElementById('tdl-sheet-who'),
		notesField: document.getElementById('tdl-sheet-notes'),
		stepList: pick('[data-tdl-steps]', ui.drawerPanel),
		stepTally: pick('[data-tdl-steps-count]', ui.drawerPanel),
		stepInput: pick('[data-tdl-step-new]', ui.drawerPanel),
		footnote: pick('[data-tdl-sheet-meta]', ui.drawerPanel),
		deleteButton: pick('[data-tdl-sheet-delete]', ui.drawerPanel),
		fullLink: pick('[data-tdl-sheet-full]', ui.drawerPanel),
		saveButton: pick('[data-tdl-sheet-save]', ui.drawerPanel),
		draft: null,
		creating: false,
	};

	const listEditor = {
		form: pick('[data-tdl-list-form]', ui.listModal),
		nameField: document.getElementById('tdl-list-name'),
		error: pick('[data-tdl-list-error]', ui.listModal),
		editing: null,
	};

	/* The suggestion menu under quick add, and the slice of text it replaces. */
	const suggestMenu = { options: [], highlighted: 0, from: 0, to: 0 };

	/* Focus mode: the queue of task ids, where we are in it and the timer. */
	const sprint = {
		queue: [],
		at: 0,
		remaining: SPRINT_SECONDS,
		running: false,
		lastFrame: 0,
		interval: 0,
		completed: 0,
	};
	const focusArea = pick('[data-tdl-focus-stage]', ui.focusModal);
	const focusTally = pick('[data-tdl-focus-progress]', ui.focusModal);

	/* Rows that were just ticked wait here for their fade before moving. */
	const completionTimers = new Map();

	start();

	function start() {
		try {
			const remembered = localStorage.getItem('basalt-todo-view');
			if (remembered) store.view = remembered;
		} catch {
			/* storage is blocked in this window */
		}
		if (demoMode === 'empty') store.view = 'today';

		wireBoard();
		wireQuickAdd();
		wireSearch();
		wireDrawer();
		wireListDialogs();
		wireFocusMode();
		loadBoard();
	}

	/* Fetching the board, and the screen shown when that fails. */

	function loadBoard() {
		ui.body.setAttribute('aria-busy', 'true');
		return server
			.fetchBoard()
			.then((data) => {
				store.me = data.me;
				store.people = data.people;
				store.lists = data.lists;
				store.tasks = data.tasks.map((task, index) =>
					Object.assign(
						{
							done: false,
							doneAt: null,
							order: (index + 1) * 10,
							steps: [],
							notes: '',
							created: stampAt(-4 - Math.floor(draw() * 10)),
							createdBy: data.me,
						},
						task,
					),
				);
				store.ready = true;
				if (!isKnownView(store.view)) store.view = 'today';
				drawEverything();
			})
			.catch(() => {
				drawLoadError();
				announce('Your tasks did not load.');
			});
	}

	function drawLoadError() {
		ui.body.setAttribute('aria-busy', 'false');
		ui.body.innerHTML = `<div class="basalt-empty basalt-empty-framed basalt-empty-danger tdl-empty tdl-error" role="alert"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi bi-wifi-off"></i></span><h3 class="basalt-empty-title">Your tasks didn't load</h3><p class="basalt-empty-text">The connection dropped before they arrived. Nothing you added has been lost.</p><div class="basalt-empty-actions"><button type="button" class="btn btn-sm btn-primary btn-loading btn-loading-swap" data-tdl-retry><span class="btn-loading-icon" aria-hidden="true"><i class="bi bi-arrow-clockwise"></i></span><span class="btn-loading-label">Try again</span></button></div></div>`;
		ui.heading.textContent = viewTitle();
		ui.subline.textContent = '';
	}

	/* Everything below draws from the store; nothing here changes it. */

	function drawEverything() {
		drawNav();
		drawFigures();
		drawBoard();
		drawReadout();
	}

	/** Redraws everything and puts keyboard focus back on the task that had it,
	 *  or on whichever row now sits in its place. */
	function redraw() {
		const focused = document.activeElement;
		const ownRow = focused?.closest?.('.tdl-item');
		const taskId = ownRow && ui.body.contains(ownRow) ? ownRow.dataset.id : null;
		let position = -1;
		let control = '';
		if (taskId) {
			position = pickAll('.tdl-item', ui.body).findIndex((entry) => entry.dataset.id === taskId);
			control = focused.matches('[data-tdl-open]') ? '[data-tdl-open]' : '[data-tdl-check]';
		}
		drawEverything();
		if (!taskId) return;
		const after = pickAll('.tdl-item', ui.body);
		const landing =
			after.find((entry) => entry.dataset.id === taskId) ||
			after[Math.min(Math.max(position, 0), after.length - 1)];
		const focusable = landing && pick(control, landing);
		if (focusable) {
			focusable.focus();
			return;
		}
		ui.heading.setAttribute('tabindex', '-1');
		ui.heading.focus();
	}

	function drawNav() {
		const pending = pendingTasks();
		const lateCount = pending.filter((task) => task.due && daysAway(task.due) < 0).length;

		function openIn(view) {
			return pending.filter((task) => belongsTo(task, view)).length;
		}

		ui.viewsNav.innerHTML = BUILT_IN_VIEWS.map((entry) =>
			navEntry(
				entry.key,
				`<span class="tdl-nav-icon" aria-hidden="true"><i class="bi ${entry.icon}"></i></span><span class="tdl-nav-name">${entry.label}</span>`,
				openIn(entry.key),
				entry.key === 'today' && lateCount ? `<span class="tdl-nav-late">${lateCount} late</span>` : '',
			),
		).join('');

		ui.listsNav.innerHTML = store.lists
			.map((entry) =>
				navEntry(
					`list:${entry.id}`,
					`<span class="tdl-nav-dot tdl-c${entry.tint}" aria-hidden="true"></span><span class="tdl-nav-name">${htmlSafe(entry.name)}</span>`,
					openIn(`list:${entry.id}`),
				),
			)
			.join('');

		ui.peopleNav.innerHTML = store.people
			.map((who) =>
				navEntry(
					`person:${who.id}`,
					`${avatarMarkup(who)}<span class="tdl-nav-name">${htmlSafe(who.id === store.me ? `${who.name.split(' ')[0]} (you)` : who.name)}</span>`,
					openIn(`person:${who.id}`),
				),
			)
			.join('');
		fillAvatars(ui.peopleNav);
	}

	function navEntry(view, inner, openCount, badge = '') {
		const current = store.view === view && !store.search;
		const lit = current ? ' is-active' : '';
		const aria = current ? ' aria-current="page"' : '';
		return `<li><button type="button" class="tdl-nav-item${lit}" data-tdl-view="${htmlSafe(view)}"${aria}>${inner}${badge}<span class="tdl-nav-count"><span class="visually-hidden">, </span>${openCount}<span class="visually-hidden"> open</span></span></button></li>`;
	}

	/* The three figures in the page header. */
	function drawFigures() {
		const pending = pendingTasks();
		const figures = {
			today: pending.filter((task) => task.due && daysAway(task.due) === 0).length,
			overdue: pending.filter((task) => task.due && daysAway(task.due) < 0).length,
			week: store.tasks.filter((task) => task.done && task.doneAt && -daysAway(toIso(new Date(task.doneAt))) < 7)
				.length,
		};
		for (const [key, value] of Object.entries(figures)) {
			const slot = pick(`[data-tdl-fig="${key}"]`, app);
			if (slot) slot.textContent = String(value);
		}
	}

	/* The task list for the current view, or the search results. */
	function drawBoard() {
		const query = store.search.trim();
		const open = pendingTasks().filter((task) => (query ? matchesSearch(task, query) : belongsTo(task)));
		const finished = store.tasks
			.filter((task) => task.done && (query ? matchesSearch(task, query) : shownAsDone(task)))
			.sort((a, b) => (a.doneAt < b.doneAt ? 1 : -1));
		drawHeading(open.length, finished.length);

		const draggable = store.sort === 'mine' && !query;
		ui.sortNote.hidden = draggable || Boolean(query) || !open.length;
		const showList = !store.view.startsWith('list:');

		let markup = open.length
			? sectionsMarkup(
					query ? [{ key: 'q', title: '', tasks: open.sort(byDueDate) }] : sectionsFor(open),
					draggable,
					showList,
				)
			: nothingOpenMarkup(query, finished.length);
		if (finished.length) markup += finishedMarkup(finished, query, open.length, showList);

		ui.body.innerHTML = markup;
		ui.body.setAttribute('aria-busy', 'false');
		fillAvatars(ui.body);
		window.Basalt.tips?.(ui.body);
		if (window.Basalt.sortable) {
			for (const sortable of pickAll('[data-tdl-sortable]', ui.body)) window.Basalt.sortable(sortable);
		}
	}

	function drawHeading(openCount, doneCount) {
		const view = store.view;
		if (store.search) {
			ui.heading.textContent = 'Search';
			ui.subline.textContent = openCount
				? `${countOf(openCount, 'task')} match “${store.search}” across all lists`
				: '';
		} else {
			const parts = [countOf(openCount, 'open task')];
			if (view === 'today') parts.unshift(fullDay(todayIso()));
			if (doneCount) parts.push(`${doneCount} done`);
			ui.heading.textContent = viewTitle();
			ui.subline.textContent = parts.join(' · ');
		}
		const listId = viewTarget(view, 'list');
		const editable = listId !== null && listById(listId) && !listById(listId).locked && !store.search;
		ui.listMenu.hidden = !editable;
	}

	function sectionsMarkup(sections, draggable, showList) {
		return sections
			.map((section) => {
				const label = section.title
					? ` aria-labelledby="tdl-g-${section.key}"`
					: ` aria-label="${htmlSafe(viewTitle())}"`;
				const sortHooks = draggable ? ' data-basalt-sortable data-tdl-sortable' : '';
				const rowsMarkup = section.tasks.map((task) => rowMarkup(task, draggable, showList)).join('');
				return `<section class="tdl-group">${sectionHeading(section)}<ol class="basalt-sortable tdl-items"${label}${sortHooks}>${rowsMarkup}</ol></section>`;
			})
			.join('');
	}

	function sectionHeading(section) {
		if (!section.title) return '';
		const tone = section.tone ? ` tdl-group-head-${section.tone}` : '';
		const aside = section.sub ? ` <span class="tdl-group-sub">${htmlSafe(section.sub)}</span>` : '';
		const action = section.action === 'reschedule' ? RESCHEDULE_BUTTON : '';
		return `<div class="tdl-group-head${tone}"><h3 class="tdl-group-title" id="tdl-g-${section.key}">${htmlSafe(section.title)}${aside}</h3><span class="tdl-group-count">${section.tasks.length}</span>${action}</div>`;
	}

	/* The folding Done block under the open tasks. */
	function finishedMarkup(finished, query, openCount, showList) {
		const expanded = store.doneExpanded || (query && !openCount) ? ' open' : '';
		const clearButton = query
			? ''
			: `<button type="button" class="btn btn-sm btn-outline-secondary tdl-done-clear" data-tdl-clear-done><i class="bi bi-eraser" aria-hidden="true"></i>Clear ${countOf(finished.length, 'done task')}</button>`;
		const rowsMarkup = finished.map((task) => rowMarkup(task, false, showList)).join('');
		return `<details class="tdl-done"${expanded} data-tdl-done><summary class="tdl-done-summary"><i class="bi bi-chevron-right tdl-done-chev" aria-hidden="true"></i>Done <span class="tdl-group-count">${finished.length}</span></summary><ol class="basalt-sortable tdl-items tdl-items-done" aria-label="Done">${rowsMarkup}</ol>${clearButton}</details>`;
	}

	/** One task row. The facts under the title always come in the same order
	 *  (due, priority, list, notes, steps), and an empty fact keeps its width so
	 *  each one lines up from row to row. */
	function rowMarkup(task, draggable, showList) {
		const home = listById(task.list);
		const owner = personById(task.assignee);
		const level = LEVELS[task.priority] || LEVELS[4];
		const safeTitle = htmlSafe(task.title);
		const checkId = `tdl-check-${task.id}`;

		const facts = [
			dueFact(task),
			task.done
				? '<span class="tdl-prio"></span>'
				: `<span class="tdl-prio tdl-tone-p${task.priority}"><i class="bi ${level.glyph}" aria-hidden="true"></i>${level.label}</span>`,
		];
		if (showList && home)
			facts.push(
				`<span class="tdl-meta-list"><span class="tdl-nav-dot tdl-c${home.tint}" aria-hidden="true"></span>${htmlSafe(home.name)}</span>`,
			);
		facts.push(
			task.notes
				? '<span class="tdl-meta-notes"><i class="bi bi-text-left" aria-hidden="true"></i>Notes</span>'
				: '<span class="tdl-meta-notes"></span>',
		);
		const checklist = task.steps || [];
		if (checklist.length) {
			const ticked = checklist.filter((step) => step.done).length;
			facts.push(
				`<span class="tdl-meta-steps"><i class="bi bi-list-check" aria-hidden="true"></i>${ticked} of ${checklist.length} steps</span>`,
			);
		}

		const grip = draggable
			? `<button type="button" class="basalt-sortable-handle tdl-item-handle" aria-label="Move ${safeTitle}"><i class="bi bi-grip-vertical" aria-hidden="true"></i></button>`
			: '<span class="tdl-item-spacer" aria-hidden="true"></span>';

		return [
			`<li class="basalt-sortable-item tdl-item${task.done ? ' is-done' : ''} tdl-item-p${task.priority}" data-id="${htmlSafe(task.id)}">`,
			grip,
			`<input class="form-check-input tdl-check" type="checkbox" id="${checkId}"${task.done ? ' checked' : ''} data-tdl-check>`,
			`<label class="visually-hidden" for="${checkId}">${task.done ? 'Done: ' : 'Mark done: '}${safeTitle}</label>`,
			`<div class="tdl-item-main"><button type="button" class="tdl-item-title" data-tdl-open>${safeTitle}</button><div class="tdl-item-meta">${facts.join('')}</div></div>`,
			`<span class="tdl-item-who" title="${htmlSafe(owner ? owner.name : 'Nobody yet')}">${avatarMarkup(owner)}<span class="visually-hidden">${htmlSafe(owner ? `For ${owner.name}` : 'Not assigned')}</span></span>`,
			`<button type="button" class="btn btn-icon btn-sm tdl-item-peek" data-tdl-peek aria-label="Quick view: ${safeTitle}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>`,
			`<button type="button" class="btn btn-icon btn-sm tdl-item-delete" data-tdl-delete aria-label="Delete ${safeTitle}"><i class="bi bi-trash3" aria-hidden="true"></i></button>`,
			'</li>',
		].join('');
	}

	function dueFact(task) {
		if (!task.due) return '<span class="tdl-due"></span>';
		const late = !task.done && daysAway(task.due) < 0 ? ' tdl-due-late' : '';
		return `<span class="tdl-due${late}"><i class="bi bi-calendar-event" aria-hidden="true"></i><span class="visually-hidden">Due </span>${shortDue(task.due)}</span>`;
	}

	function avatarMarkup(who) {
		if (!who)
			return '<span class="tdl-avatar tdl-avatar-none basalt-avatar basalt-avatar-xs" aria-hidden="true"><i class="bi bi-person"></i></span>';
		return `<span class="basalt-avatar basalt-avatar-xs tdl-avatar" data-basalt-avatar data-name="${htmlSafe(who.name)}" aria-hidden="true"></span>`;
	}

	function fillAvatars(scope) {
		if (!window.Basalt.avatar) return;
		for (const holder of pickAll('[data-basalt-avatar]', scope)) window.Basalt.avatar(holder);
	}

	/* Each view has its own words for having nothing open. */

	function nothingOpenMarkup(query, doneCount) {
		if (!query) return emptyForView(doneCount > 0);
		return blankSlate({
			icon: 'bi-search',
			title: `No open task matches “${htmlSafe(query)}”`,
			text: doneCount
				? `It matches ${countOf(doneCount, 'done task')}, shown below.`
				: 'Search looks at names, notes, steps and list names in every list.',
			actions:
				'<button type="button" class="btn btn-sm btn-outline-secondary" data-tdl-clear-search><i class="bi bi-x-lg" aria-hidden="true"></i>Clear search</button>',
		});
	}

	function emptyForView(hasDone) {
		if (!store.tasks.length) {
			return blankSlate({
				icon: 'bi-check2-square',
				title: 'No tasks yet',
				text: 'Type your first one in the box above. Words like "tomorrow", "#accounts" or "!1" set the date, list and priority for you.',
				actions: ADD_BUTTON,
			});
		}
		const view = store.view;
		const toUpcoming = jumpButton('upcoming', 'See upcoming', 'bi-calendar3');
		if (view === 'today' && hasDone) {
			return blankSlate({
				icon: 'bi-check2-all',
				tone: 'success',
				title: 'Today is clear',
				text: 'Everything due today is done. Have a look at what is coming up, or take the rest of the day.',
				actions: toUpcoming,
			});
		}
		if (view === 'today') {
			return blankSlate({
				icon: 'bi-sun',
				title: 'Nothing due today',
				text: 'Add something above, or pull a task in from Upcoming.',
				actions: toUpcoming,
			});
		}
		if (view === 'upcoming') {
			return blankSlate({
				icon: 'bi-calendar3',
				title: 'Nothing scheduled',
				text: 'Give a task a date, like "fri" or "next week", and it shows up here by day.',
				actions: ADD_BUTTON,
			});
		}
		if (view === 'someday') {
			return blankSlate({
				icon: 'bi-cloud',
				title: 'Nothing parked for later',
				text: 'Tasks with no date wait here. Type "someday" in a task to send it here.',
				actions: ADD_BUTTON,
			});
		}
		if (viewTarget(view, 'list') !== null) {
			return blankSlate({
				icon: 'bi-list-check',
				title: `Nothing in ${htmlSafe(viewTitle())} yet`,
				text: 'Type a task above. It goes straight into this list.',
				actions: ADD_BUTTON,
			});
		}
		const personId = viewTarget(view, 'person');
		if (personId !== null) {
			const handle = (personById(personId) || { name: 'name' }).name.split(' ')[0].toLowerCase();
			return blankSlate({
				icon: 'bi-person-check',
				title: personId === store.me ? 'Nothing assigned to you' : `${htmlSafe(viewTitle())} has nothing open`,
				text: `Assign a task with @ and their name, like "@${htmlSafe(handle)}".`,
				actions: ADD_BUTTON,
			});
		}
		return blankSlate({
			icon: 'bi-check2-all',
			tone: 'success',
			title: 'All done',
			text: 'Every task is checked off.',
			actions: ADD_BUTTON,
		});
	}

	function blankSlate({ icon, tone, title, text, actions }) {
		const toneClass = tone ? ` basalt-empty-${tone}` : '';
		const buttons = actions ? `<div class="basalt-empty-actions">${actions}</div>` : '';
		return `<div class="basalt-empty basalt-empty-compact tdl-empty${toneClass}"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi ${icon}"></i></span><h3 class="basalt-empty-title">${title}</h3><p class="basalt-empty-text">${text}</p>${buttons}</div>`;
	}

	function jumpButton(view, label, icon) {
		return `<button type="button" class="btn btn-sm btn-outline-secondary" data-tdl-view="${view}"><i class="bi ${icon}" aria-hidden="true"></i>${label}</button>`;
	}

	/* Deciding which tasks a view holds and how they are grouped. */

	function belongsTo(task, view) {
		const key = view || store.view;
		const rule = VIEW_RULES.get(key);
		if (rule) return rule(task);
		const listId = viewTarget(key, 'list');
		if (listId !== null) return task.list === listId;
		const personId = viewTarget(key, 'person');
		if (personId !== null) return task.assignee === personId;
		return false;
	}

	/* Finished tasks listed at the foot of a view: today's in Today, none in
     Upcoming, and the past week's everywhere else. */
	function shownAsDone(task) {
		if (!task.done || !task.doneAt) return false;
		const age = -daysAway(toIso(new Date(task.doneAt)));
		if (store.view === 'today') return age === 0;
		if (store.view === 'upcoming') return false;
		if (store.view === 'someday') return !task.due && age < 7;
		return age < 7 && belongsTo(task);
	}

	function matchesSearch(task, query) {
		const home = listById(task.list);
		const haystack = [
			task.title,
			task.notes,
			home ? home.name : '',
			(task.steps || []).map((step) => step.title).join(' '),
		]
			.join(' ')
			.toLowerCase();
		return query
			.toLowerCase()
			.split(/\s+/)
			.filter(Boolean)
			.every((word) => haystack.includes(word));
	}

	/** Splits a view's open tasks into titled sections, which depend on the
	 *  chosen order and, for My order, on the view itself. */
	function sectionsFor(tasks) {
		if (store.sort === 'priority') {
			return [1, 2, 3, 4]
				.map((level) => ({
					key: `p${level}`,
					title: LEVELS[level].label,
					tone: `p${level}`,
					tasks: tasks.filter((task) => task.priority === level).sort(byDueDate),
				}))
				.filter((section) => section.tasks.length);
		}
		if (store.sort === 'due') return [{ key: 'due', title: '', tasks: [...tasks].sort(byDueDate) }];
		if (store.view === 'today') return todaySections(tasks);
		if (store.view === 'upcoming') return upcomingSections(tasks);
		return [{ key: 'all', title: '', tasks: [...tasks].sort(byManualOrder) }];
	}

	function todaySections(tasks) {
		const overdue = tasks.filter((task) => daysAway(task.due) < 0).sort(byManualOrder);
		const dueNow = tasks.filter((task) => daysAway(task.due) === 0).sort(byManualOrder);
		const sections = [];
		if (overdue.length)
			sections.push({ key: 'late', title: 'Overdue', tone: 'late', tasks: overdue, action: 'reschedule' });
		if (dueNow.length || !overdue.length) {
			sections.push({
				key: 'today',
				title: overdue.length ? 'Today' : '',
				sub: overdue.length ? fullDay(todayIso()) : '',
				tasks: dueNow,
			});
		}
		return sections;
	}

	/* A section per day for the coming week, then one Later section. */
	function upcomingSections(tasks) {
		const dayBuckets = new Map();
		for (const task of [...tasks].sort(byDueDate)) {
			const away = daysAway(task.due);
			const key = away < 7 ? task.due : 'later';
			if (!dayBuckets.has(key)) {
				const title = key === 'later' ? 'Later' : away === 1 ? 'Tomorrow' : fullDay(task.due);
				dayBuckets.set(key, { key, title, sub: away === 1 ? fullDay(task.due) : '', tasks: [] });
			}
			dayBuckets.get(key).tasks.push(task);
		}
		const sections = [...dayBuckets.values()];
		for (const section of sections) {
			if (section.key !== 'later') section.tasks.sort(byManualOrder);
		}
		return sections;
	}

	function viewTitle(view) {
		const key = view || store.view;
		const builtIn = BUILT_IN_VIEWS.find((entry) => entry.key === key);
		if (builtIn) return builtIn.label;
		const listId = viewTarget(key, 'list');
		if (listId !== null) {
			const home = listById(listId);
			return home ? home.name : 'List';
		}
		const personId = viewTarget(key, 'person');
		if (personId !== null) {
			const who = personById(personId);
			if (!who) return 'Person';
			return who.id === store.me ? 'Assigned to you' : who.name;
		}
		return 'Tasks';
	}

	function isKnownView(view) {
		if (VIEW_RULES.has(view)) return true;
		const listId = viewTarget(view, 'list');
		if (listId !== null) return Boolean(listById(listId));
		const personId = viewTarget(view, 'person');
		if (personId !== null) return Boolean(personById(personId));
		return false;
	}

	/** The id after "list:" or "person:" in a view key, or null when the view
	 *  is of another kind. */
	function viewTarget(view, kind) {
		const prefix = `${kind}:`;
		return view.startsWith(prefix) ? view.slice(prefix.length) : null;
	}

	function pendingTasks() {
		return store.tasks.filter((task) => !task.done);
	}

	function byManualOrder(a, b) {
		return a.order - b.order;
	}

	/* Soonest first, undated last; ties go to priority, then My order. */
	function byDueDate(a, b) {
		const left = a.due || '9999';
		const right = b.due || '9999';
		if (left !== right) return left < right ? -1 : 1;
		return a.priority - b.priority || byManualOrder(a, b);
	}

	function personById(id) {
		return store.people.find((who) => who.id === id) || null;
	}

	function listById(id) {
		return store.lists.find((entry) => entry.id === id) || null;
	}

	function taskById(id) {
		return store.tasks.find((task) => task.id === id) || null;
	}

	function shortName(who) {
		return who.id === store.me ? 'You' : who.name.split(' ')[0];
	}

	/* Every change to tasks goes through these, and most can be undone. */

	/** Snapshots tasks and lists, applies the change, redraws, and offers an
	 *  Undo in the toast that puts the snapshot back. */
	function applyWithUndo(message, change) {
		const undoPoint = { tasks: copyOf(store.tasks), lists: copyOf(store.lists), view: store.view };
		change();
		redraw();
		notify({
			tone: message.tone || 'success',
			icon: message.icon,
			title: message.title,
			text: message.text,
			duration: 7000,
			actions: [{ label: 'Undo', onClick: () => restoreSnapshot(undoPoint, message.undo) }],
		});
	}

	function restoreSnapshot(undoPoint, afterRestore) {
		store.tasks = undoPoint.tasks;
		store.lists = undoPoint.lists;
		if (store.view.startsWith('list:') && !listById(store.view.slice(5))) store.view = undoPoint.view;
		if (afterRestore) afterRestore(undoPoint);
		redraw();
		announce('Undone.');
	}

	/* New tasks come from quick add or the drawer and go to the end of My order. */
	function createTask(fields) {
		const lastSlot = store.tasks.reduce((highest, task) => Math.max(highest, task.order || 0), 0);
		const task = Object.assign(
			{
				id: freshId('t'),
				title: '',
				list: 'inbox',
				due: null,
				priority: 3,
				assignee: null,
				notes: '',
				steps: [],
				done: false,
				doneAt: null,
				order: lastSlot + 10,
				created: new Date().toISOString(),
				createdBy: store.me,
			},
			fields,
		);
		store.tasks.push(task);
		server.putTask(task);
		return task;
	}

	/** Ticks or unticks a task. A ticked row fades for a moment before it moves
	 *  to Done; unticking during the fade cancels the move. */
	function markDone(id, finished) {
		const task = taskById(id);
		if (!task) return;
		const row = pick(`.tdl-item[data-id="${id}"]`, ui.body);
		const waiting = completionTimers.has(id);
		if (finished && waiting) return;
		if (!finished && waiting) {
			clearTimeout(completionTimers.get(id));
			completionTimers.delete(id);
			row?.classList.remove('is-completing');
			return;
		}

		function settle() {
			completionTimers.delete(id);
			applyWithUndo(
				{
					title: finished ? 'Done' : 'Back on the list',
					text: task.title,
					icon: finished ? 'bi-check2-circle' : 'bi-arrow-counterclockwise',
					tone: finished ? 'success' : 'primary',
				},
				() => {
					task.done = finished;
					task.doneAt = finished ? new Date().toISOString() : null;
					server.putTask(task);
				},
			);
		}

		if (finished && row && !motionIsReduced()) {
			row.classList.add('is-completing');
			completionTimers.set(id, setTimeout(settle, 650));
			return;
		}
		settle();
	}

	function removeTask(id) {
		const task = taskById(id);
		if (!task) return;
		applyWithUndo(
			{
				title: 'Task deleted',
				text: task.title,
				icon: 'bi-trash3',
				tone: 'primary',
				undo: () => server.putTask(task),
			},
			() => {
				store.tasks = store.tasks.filter((other) => other.id !== id);
				server.dropTasks([id]);
			},
		);
	}

	/* Clears exactly the done rows on screen, not every done task. */
	function clearFinished() {
		const ids = pickAll('.tdl-items-done .tdl-item', ui.body).map((entry) => entry.dataset.id);
		if (!ids.length) return;
		applyWithUndo(
			{ title: `Cleared ${countOf(ids.length, 'done task')}`, icon: 'bi-eraser', tone: 'primary' },
			() => {
				store.tasks = store.tasks.filter((task) => !ids.includes(task.id));
				server.dropTasks(ids);
			},
		);
	}

	function pullOverdueToToday() {
		const overdue = pendingTasks().filter((task) => task.due && daysAway(task.due) < 0);
		if (!overdue.length) return;
		applyWithUndo(
			{
				title: `Moved ${countOf(overdue.length, 'task')} to today`,
				icon: 'bi-arrow-right-circle',
				tone: 'primary',
			},
			() => {
				for (const task of overdue) {
					task.due = todayIso();
					server.putTask(task);
				}
			},
		);
	}

	/* After a drag the moved tasks swap their order numbers, so the rest of the
     list keeps its place. */
	function applyDragOrder(sortable) {
		const ids = pickAll('.tdl-item', sortable).map((entry) => entry.dataset.id);
		const slots = ids.map((id) => taskById(id).order).sort((a, b) => a - b);
		for (const [position, id] of ids.entries()) taskById(id).order = slots[position];
		server.putOrder(ids);
	}

	function switchView(view) {
		store.view = view;
		store.search = '';
		ui.search.value = '';
		drawEverything();
		try {
			localStorage.setItem('basalt-todo-view', view);
		} catch {
			/* a private window keeps nothing */
		}
	}

	function openTaskPage(id, event) {
		const href = `task-details.html?id=${encodeURIComponent(id)}`;
		if (event.metaKey || event.ctrlKey) window.open(href, '_blank', 'noopener');
		else location.href = href;
	}

	/* Quick add turns one typed line into a task. */

	/** Reads a typed line for a date, a #list, a !priority and an @person, and
	 *  returns what it found with the remaining words as the title. Only the
	 *  first date phrase counts. */
	function readPhrase(text) {
		let rest = ` ${text} `;
		const found = {
			due: undefined,
			list: undefined,
			unknownList: '',
			priority: undefined,
			assignee: undefined,
			unknownPerson: '',
		};
		const midnightToday = midnight(new Date());

		function claim(pattern, apply) {
			const match = rest.match(pattern);
			if (!match) return false;
			apply(match);
			rest = rest.replace(match[0], ' ');
			return true;
		}

		function onDate(monthWord, dayNumber) {
			const when = new Date(midnightToday.getFullYear(), MONTH_INDEX[monthWord.toLowerCase()], Number(dayNumber));
			if (when < midnightToday) when.setFullYear(when.getFullYear() + 1);
			return toIso(when);
		}

		const dateRules = [
			[/\s(today|tonight)(?=\s)/i, () => toIso(midnightToday)],
			[/\s(tomorrow|tmrw|tmr)(?=\s)/i, () => toIso(shiftDays(midnightToday, 1))],
			[/\snext week(?=\s)/i, () => toIso(nextWeekFrom(midnightToday))],
			[
				/\sin (\d{1,2}) (days?|weeks?)(?=\s)/i,
				(m) => toIso(shiftDays(midnightToday, Number(m[1]) * (/^w/i.test(m[2]) ? 7 : 1))),
			],
			[
				/\s(?:on |next )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|wed|thurs|thur|thu|fri|sat)(?=\s)/i,
				(m) => {
					const weekday = WEEKDAY_INDEX[m[1].toLowerCase()];
					return toIso(shiftDays(midnightToday, (weekday - midnightToday.getDay() + 7) % 7 || 7));
				},
			],
			[
				/\s(\d{1,2}) (jan|feb|mar|apr|may|jun|jul|aug|sept|sep|oct|nov|dec)[a-z]*(?=\s)/i,
				(m) => onDate(m[2], m[1]),
			],
			[
				/\s(jan|feb|mar|apr|may|jun|jul|aug|sept|sep|oct|nov|dec)[a-z]* (\d{1,2})(?=\s)/i,
				(m) => onDate(m[1], m[2]),
			],
			[/\s(someday|no date)(?=\s)/i, () => null],
		];
		dateRules.some(([pattern, resolve]) =>
			claim(pattern, (m) => {
				found.due = resolve(m);
			}),
		);

		claim(/\s#([\w-]+)(?=\s)/, (m) => {
			const wanted = tagOf(m[1]);
			const hit =
				store.lists.find((entry) => tagOf(entry.name) === wanted || entry.id === wanted) ||
				store.lists.find((entry) => tagOf(entry.name).startsWith(wanted));
			if (hit) found.list = hit.id;
			else found.unknownList = m[1];
		});

		claim(/\s!(?:p)?([1-4])(?=\s)/i, (m) => {
			found.priority = Number(m[1]);
		}) ||
			claim(/\s!(urgent|high|normal|low)(?=\s)/i, (m) => {
				found.priority = LEVEL_WORDS[m[1].toLowerCase()];
			});

		claim(/\s@([\w-]+)(?=\s)/, (m) => {
			const wanted = m[1].toLowerCase();
			const hit =
				wanted === 'me'
					? personById(store.me)
					: store.people.find((who) => who.name.toLowerCase().startsWith(wanted) || who.id === wanted);
			if (hit) found.assignee = hit.id;
			else found.unknownPerson = m[1];
		});

		found.title = rest.replace(/\s+/g, ' ').trim();
		return found;
	}

	/* Whatever the words left out comes from the view the task is typed in. */
	function fillGaps(parsed) {
		const view = store.view;
		const listId = viewTarget(view, 'list');
		const personId = viewTarget(view, 'person');
		const plan = {
			title: parsed.title,
			list: parsed.list || (listId !== null ? listId : 'inbox'),
			priority: parsed.priority || 3,
			assignee: parsed.assignee !== undefined ? parsed.assignee : personId !== null ? personId : store.me,
			due: parsed.due,
		};
		if (plan.due === undefined) {
			if (view === 'today') plan.due = todayIso();
			else if (view === 'upcoming') plan.due = toIso(shiftDays(new Date(), 1));
			else plan.due = null;
		}
		return plan;
	}

	/* The pills under quick add that show how the line will be read. */
	function drawReadout() {
		if (!ui.quickInput.value.trim() || !store.ready) {
			ui.readout.innerHTML = '';
			ui.readout.hidden = true;
			return;
		}
		const parsed = readPhrase(ui.quickInput.value);
		const plan = fillGaps(parsed);
		const home = listById(plan.list);
		const who = personById(plan.assignee);
		const level = LEVELS[plan.priority];

		function readoutPill(heard, icon, label) {
			return `<span class="tdl-chip${heard ? ' is-heard' : ''}">${icon}${label}</span>`;
		}

		const dateText = plan.due ? (daysAway(plan.due) > 1 ? fullDay(plan.due) : shortDue(plan.due)) : 'No date';
		const pills = [
			readoutPill(parsed.due !== undefined, '<i class="bi bi-calendar-event" aria-hidden="true"></i>', dateText),
			readoutPill(
				Boolean(parsed.list),
				`<span class="tdl-nav-dot tdl-c${home ? home.tint : 1}" aria-hidden="true"></span>`,
				htmlSafe(home ? home.name : 'Inbox'),
			),
			readoutPill(
				Boolean(parsed.priority),
				`<i class="bi ${level.glyph} tdl-tone-p${plan.priority}" aria-hidden="true"></i>`,
				level.label,
			),
			readoutPill(
				parsed.assignee !== undefined,
				who ? avatarMarkup(who) : '<i class="bi bi-person" aria-hidden="true"></i>',
				htmlSafe(who ? shortName(who) : 'Nobody'),
			),
		];
		if (parsed.unknownList) pills.push(warningPill(`No list called #${htmlSafe(parsed.unknownList)}`));
		if (parsed.unknownPerson) pills.push(warningPill(`Nobody called @${htmlSafe(parsed.unknownPerson)}`));
		const needsTitle = plan.title
			? ''
			: '<span class="tdl-chip tdl-chip-warn">Add a few words for the task itself</span>';

		ui.readout.hidden = false;
		ui.readout.innerHTML = `<span class="visually-hidden">Will be added as: </span>${pills.join('')}${needsTitle}`;
		fillAvatars(ui.readout);
	}

	function warningPill(message) {
		return `<span class="tdl-chip tdl-chip-warn"><i class="bi bi-exclamation-circle" aria-hidden="true"></i>${message}</span>`;
	}

	function addFromQuick() {
		const typed = ui.quickInput.value;
		if (!typed.trim()) {
			ui.quickInput.focus();
			return;
		}
		const parsed = readPhrase(typed);
		if (!parsed.title) {
			drawReadout();
			ui.quickInput.focus();
			return;
		}
		const task = createTask(fillGaps(parsed));
		ui.quickInput.value = '';

		/* When the current view will not show the new task, the toast offers
       a way to it instead of switching views on its own. */
		if (!store.search && !belongsTo(task)) {
			const home = listById(task.list);
			notify({
				tone: 'success',
				title: `Added to ${home ? home.name : 'Inbox'}`,
				text: `${task.title}${task.due ? `, due ${dueInSentence(task.due)}` : ''}`,
				actions: [{ label: 'Show it', onClick: () => switchView(`list:${task.list}`) }],
			});
		} else {
			announce(`Added ${task.title}`);
		}
		redraw();
		ui.quickInput.focus();
		const fresh = pick(`.tdl-item[data-id="${task.id}"]`, ui.body);
		if (fresh && !motionIsReduced()) fresh.classList.add('is-new');
	}

	/* Typing @, # or ! opens a short menu of people, lists or priorities. */

	function optionsFor(sign, typed) {
		const wanted = typed.toLowerCase();

		function startsAWord(name) {
			return (
				!wanted ||
				name
					.toLowerCase()
					.split(' ')
					.some((word) => word.startsWith(wanted))
			);
		}

		if (sign === '@') {
			return store.people
				.filter((who) => startsAWord(who.name) || (wanted && 'me'.startsWith(wanted) && who.id === store.me))
				.map((who) => ({
					insert: `@${who.name.split(' ')[0].toLowerCase()}`,
					html: `${avatarMarkup(who)}<span>${htmlSafe(who.name)}${who.id === store.me ? ' <span class="tdl-suggest-note">you</span>' : ''}</span>`,
				}));
		}
		if (sign === '#') {
			return store.lists
				.filter((entry) => startsAWord(entry.name))
				.map((entry) => ({
					insert: `#${entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
					html: `<span class="tdl-nav-dot tdl-c${entry.tint}" aria-hidden="true"></span><span>${htmlSafe(entry.name)}</span>`,
				}));
		}
		return [1, 2, 3, 4]
			.filter((level) => startsAWord(LEVELS[level].label) || String(level) === wanted)
			.map((level) => ({
				insert: `!${level}`,
				html: `<i class="bi ${LEVELS[level].glyph} tdl-tone-p${level}" aria-hidden="true"></i><span>${LEVELS[level].label}</span>`,
			}));
	}

	function refreshPicker() {
		const caretAt = ui.quickInput.selectionStart;
		const token = ui.quickInput.value.slice(0, caretAt).match(/(^|\s)([@#!])([\w-]*)$/);
		if (!token || !store.ready) {
			hidePicker();
			return;
		}
		suggestMenu.options = optionsFor(token[2], token[3]);
		if (!suggestMenu.options.length) {
			hidePicker();
			return;
		}
		suggestMenu.from = caretAt - token[2].length - token[3].length;
		suggestMenu.to = caretAt;
		suggestMenu.highlighted = 0;
		ui.suggestions.innerHTML = suggestMenu.options
			.map(
				(option, index) =>
					`<li class="dropdown-item" role="option" id="tdl-suggest-${index}" data-tdl-suggest-item="${index}">${option.html}</li>`,
			)
			.join('');
		fillAvatars(ui.suggestions);
		ui.suggestions.style.left = `${ui.quickInput.offsetLeft}px`;
		ui.suggestions.classList.add('show');
		ui.quickInput.setAttribute('aria-expanded', 'true');
		highlightOption();
	}

	function highlightOption() {
		for (const [index, option] of pickAll('.dropdown-item', ui.suggestions).entries()) {
			const lit = index === suggestMenu.highlighted;
			option.classList.toggle('active', lit);
			option.setAttribute('aria-selected', lit ? 'true' : 'false');
		}
		ui.quickInput.setAttribute('aria-activedescendant', `tdl-suggest-${suggestMenu.highlighted}`);
	}

	function hidePicker() {
		suggestMenu.options = [];
		ui.suggestions.classList.remove('show');
		ui.suggestions.innerHTML = '';
		ui.quickInput.setAttribute('aria-expanded', 'false');
		ui.quickInput.removeAttribute('aria-activedescendant');
	}

	/* Puts the chosen token in place of what was typed, with one space after. */
	function chooseOption(index) {
		const option = suggestMenu.options[index];
		if (!option) return;
		const value = ui.quickInput.value;
		const after = value
			.slice(suggestMenu.to)
			.replace(/^[\w-]*/, '')
			.replace(/^\s*/, '');
		ui.quickInput.value = `${value.slice(0, suggestMenu.from)}${option.insert} ${after}`;
		const cursor = suggestMenu.from + option.insert.length + 1;
		ui.quickInput.setSelectionRange(cursor, cursor);
		hidePicker();
		drawReadout();
		ui.quickInput.focus();
	}

	/* The drawer edits one task in full. */

	/** Opens the drawer on an existing task (by id) or on a new one started
	 *  from the preset fields. Edits stay on a copy until Save. */
	function showTaskDrawer(taskId, preset) {
		const task = taskId ? taskById(taskId) : null;
		taskSheet.creating = !task;
		taskSheet.draft = task
			? copyOf(task)
			: Object.assign(
					{ title: '', list: 'inbox', due: null, priority: 3, assignee: store.me, notes: '', steps: [] },
					preset || {},
				);
		const draft = taskSheet.draft;

		taskSheet.title.textContent = task ? 'Edit task' : 'New task';
		taskSheet.subtitle.textContent = drawerSubtitle(task);
		taskSheet.form.classList.remove('was-validated');
		taskSheet.nameField.classList.remove('is-invalid');
		taskSheet.nameField.value = draft.title;
		taskSheet.dueField.value = draft.due || '';
		fillSelects();
		taskSheet.listField.value = draft.list;
		taskSheet.ownerField.value = draft.assignee || '';
		taskSheet.notesField.value = draft.notes || '';
		taskSheet.stepInput.value = '';
		selectLevel(draft.priority);
		drawSteps();

		taskSheet.deleteButton.hidden = !task;
		taskSheet.fullLink.hidden = !task;
		if (task) taskSheet.fullLink.href = `task-details.html?id=${encodeURIComponent(task.id)}`;
		const author = task && personById(task.createdBy);
		taskSheet.footnote.textContent =
			task && task.created
				? `Added ${dueInSentence(toIso(new Date(task.created)))}${author ? ` by ${author.name}` : ''}.`
				: '';
		pick('.btn-loading-label', taskSheet.saveButton).textContent = task ? 'Save task' : 'Add task';
		setButton(taskSheet.saveButton, 'idle');
		drawerInstance().show();
	}

	function drawerSubtitle(task) {
		if (!task) return 'Fill in what you know. Only the name is needed.';
		if (!task.done) return 'Changes are kept when you press Save.';
		return `Done ${dueInSentence(toIso(new Date(task.doneAt)))}. Changes are kept when you press Save.`;
	}

	function drawerInstance() {
		return window.bootstrap.Offcanvas.getOrCreateInstance(ui.drawerPanel);
	}

	function fillSelects() {
		taskSheet.listField.innerHTML = store.lists
			.map((entry) => `<option value="${htmlSafe(entry.id)}">${htmlSafe(entry.name)}</option>`)
			.join('');
		const people = store.people
			.map(
				(who) =>
					`<option value="${htmlSafe(who.id)}">${htmlSafe(who.id === store.me ? `${who.name} (you)` : who.name)}</option>`,
			)
			.join('');
		taskSheet.ownerField.innerHTML = `<option value="">Nobody yet</option>${people}`;
		if (window.Basalt.select?.refresh) {
			window.Basalt.select.refresh(taskSheet.listField);
			window.Basalt.select.refresh(taskSheet.ownerField);
		}
	}

	function drawSteps() {
		const checklist = taskSheet.draft.steps;
		const ticked = checklist.filter((step) => step.done).length;
		taskSheet.stepTally.textContent = checklist.length ? `${ticked} of ${checklist.length}` : '';
		taskSheet.stepList.innerHTML = checklist
			.map(
				(step, index) =>
					`<li class="tdl-step${step.done ? ' is-done' : ''}" data-step="${index}"><input class="form-check-input" type="checkbox" id="tdl-step-${index}"${step.done ? ' checked' : ''} data-tdl-step-check><label class="tdl-step-label" for="tdl-step-${index}">${htmlSafe(step.title)}</label><button type="button" class="btn btn-icon btn-sm tdl-step-remove" data-tdl-step-remove aria-label="Remove step: ${htmlSafe(step.title)}"><i class="bi bi-x-lg" aria-hidden="true"></i></button></li>`,
			)
			.join('');
	}

	/* The segmented control listens for change, so the event is sent by hand. */
	function selectLevel(level) {
		const radio = pick(`input[name="priority"][value="${level}"]`, ui.drawerPanel);
		if (!radio) return;
		radio.checked = true;
		radio.dispatchEvent(new Event('change', { bubbles: true }));
	}

	function appendStep() {
		const wording = taskSheet.stepInput.value.trim();
		if (!wording) {
			taskSheet.stepInput.focus();
			return;
		}
		taskSheet.draft.steps.push({ id: freshId('s'), title: wording, done: false });
		taskSheet.stepInput.value = '';
		drawSteps();
		taskSheet.stepInput.focus();
		announce('Step added');
	}

	function removeStep(button) {
		const position = Number(button.closest('[data-step]').dataset.step);
		taskSheet.draft.steps.splice(position, 1);
		drawSteps();
		const neighbor = pickAll('[data-tdl-step-remove]', taskSheet.stepList)[
			Math.min(position, taskSheet.draft.steps.length - 1)
		];
		(neighbor || taskSheet.stepInput).focus();
	}

	function saveDrawer() {
		const title = taskSheet.nameField.value.trim();
		if (!title) {
			taskSheet.nameField.classList.add('is-invalid');
			taskSheet.nameField.focus();
			return;
		}
		taskSheet.nameField.classList.remove('is-invalid');
		const chosenLevel = pick('input[name="priority"]:checked', ui.drawerPanel);
		const changes = {
			title,
			due: taskSheet.dueField.value || null,
			list: taskSheet.listField.value || 'inbox',
			assignee: taskSheet.ownerField.value || null,
			priority: chosenLevel ? Number(chosenLevel.value) : 3,
			notes: taskSheet.notesField.value.trim(),
			steps: taskSheet.draft.steps,
		};
		setButton(taskSheet.saveButton, 'loading');

		/* The sample server answers at once; a real one may take a moment, so
       the button shows its loading state until the promise settles. */
		const creating = taskSheet.creating;
		const draftId = taskSheet.draft.id;
		const request = creating
			? Promise.resolve(createTask(changes))
			: server.putTask(Object.assign(taskById(draftId), changes));
		request
			.then(() => {
				setButton(taskSheet.saveButton, 'idle');
				drawerInstance().hide();
				redraw();
				const home = listById(changes.list);
				notify({
					tone: 'success',
					title: creating ? 'Task added' : 'Task saved',
					text: `${title}${creating && home ? ` in ${home.name}` : ''}`,
				});
			})
			.catch(() => {
				setButton(taskSheet.saveButton, 'error', 'Not saved, try again');
			});
	}

	/* Lists are created, renamed, recolored and deleted through two dialogs. */

	function openListEditor(listId) {
		const editing = listId ? listById(listId) : null;
		listEditor.editing = editing;
		pick('[data-tdl-list-dialog-title]', ui.listModal).textContent = editing ? 'Edit list' : 'New list';
		pick('[data-tdl-list-submit]', ui.listModal).textContent = editing ? 'Save list' : 'Create list';
		listEditor.nameField.value = editing ? editing.name : '';
		listEditor.nameField.classList.remove('is-invalid');

		const taken = store.lists.map((entry) => entry.tint);
		const chosen = editing ? editing.tint : SWATCHES.find((swatch) => !taken.includes(swatch)) || 7;
		pick('[data-tdl-swatches]', ui.listModal).innerHTML = SWATCHES.map(
			(swatch) =>
				`<label class="tdl-swatch"><input type="radio" class="visually-hidden" name="color" value="${swatch}"${swatch === chosen ? ' checked' : ''}><span class="tdl-swatch-dot tdl-c${swatch}" aria-hidden="true"></span><span class="visually-hidden">Color ${swatch}</span></label>`,
		).join('');
		showListTag();
		window.bootstrap.Modal.getOrCreateInstance(ui.listModal).show();
	}

	/* Shows the #tag that quick add will accept for the name being typed. */
	function showListTag() {
		pick('[data-tdl-list-slug]', ui.listModal).textContent = `#${tagOf(listEditor.nameField.value) || 'name'}`;
	}

	function saveListEditor() {
		const name = listEditor.nameField.value.trim();
		const editing = listEditor.editing;
		const clash = store.lists.find((entry) => tagOf(entry.name) === tagOf(name) && entry !== editing);
		if (!name || clash) {
			listEditor.error.textContent = name
				? `There is already a list called ${clash.name}.`
				: 'Give the list a name.';
			listEditor.nameField.classList.add('is-invalid');
			listEditor.nameField.focus();
			return;
		}
		const tint = Number(pick('input[name="color"]:checked', ui.listModal)?.value ?? 1);
		if (editing) {
			Object.assign(editing, { name, tint });
			server.putList(editing);
			notify({ tone: 'success', title: 'List saved', text: name });
		} else {
			const created = { id: `${tagOf(name)}-${Date.now().toString(36).slice(-4)}`, name, tint };
			store.lists.push(created);
			server.putList(created);
			store.view = `list:${created.id}`;
			notify({
				tone: 'success',
				title: 'List created',
				text: `Type #${tagOf(name)} in quick add to send tasks here.`,
			});
		}
		window.bootstrap.Modal.getOrCreateInstance(ui.listModal).hide();
		drawEverything();
	}

	/* The hold-to-delete dialog says how many tasks go with the list. */
	function askToDeleteList() {
		const doomed = listById(store.view.slice(5));
		if (!doomed || doomed.locked) return;
		const inside = store.tasks.filter((task) => task.list === doomed.id);
		const openInside = inside.filter((task) => !task.done).length;
		const doneInside = inside.length - openInside;
		pick('[data-tdl-del-title]', ui.deleteModal).textContent = `Delete ${doomed.name}?`;
		pick('[data-tdl-del-text]', ui.deleteModal).textContent = inside.length
			? `This also deletes ${countOf(openInside, 'open task')}${doneInside ? ` and ${countOf(doneInside, 'done task')}` : ''} in it.`
			: 'The list is empty, so no tasks go with it.';
		window.bootstrap.Modal.getOrCreateInstance(ui.deleteModal).show();
	}

	function deleteCurrentList() {
		const doomed = listById(store.view.slice(5));
		if (!doomed) return;
		window.bootstrap.Modal.getOrCreateInstance(ui.deleteModal).hide();
		applyWithUndo(
			{
				title: `Deleted ${doomed.name}`,
				text: 'The list and its tasks are gone.',
				icon: 'bi-trash3',
				tone: 'primary',
				undo: (undoPoint) => {
					store.view = undoPoint.view;
					server.putList(doomed);
				},
			},
			() => {
				store.lists = store.lists.filter((entry) => entry.id !== doomed.id);
				store.tasks = store.tasks.filter((task) => task.list !== doomed.id);
				store.view = 'today';
				server.dropList(doomed.id);
			},
		);
	}

	/* Focus mode walks through today's tasks one at a time. */

	function openFocusMode() {
		if (!store.ready) return;
		sprint.queue = pendingTasks()
			.filter((task) => task.due && daysAway(task.due) <= 0)
			.sort((a, b) => a.priority - b.priority || byDueDate(a, b))
			.map((task) => task.id);
		sprint.at = 0;
		sprint.completed = 0;
		drawFocus(false);
		window.bootstrap.Modal.getOrCreateInstance(ui.focusModal).show();
	}

	/** Draws focus mode. `focusAfter` is a selector to focus once drawn, or
	 *  false to leave focus where it is. */
	function drawFocus(focusAfter) {
		sprint.queue = sprint.queue.filter((id) => taskById(id) && !taskById(id).done);
		const queue = sprint.queue;
		const sessionSize = queue.length + sprint.completed;
		focusTally.innerHTML = sessionSize
			? `<i class="bi bi-check2-circle" aria-hidden="true"></i><span>${sprint.completed} of ${sessionSize} done this session</span>`
			: '';

		if (!queue.length) {
			focusArea.innerHTML = focusClearMarkup();
			haltClock();
			const heading = pick('.tdl-focus-title', focusArea);
			if (heading && focusAfter !== false) heading.focus();
			return;
		}

		sprint.at = Math.min(sprint.at, queue.length - 1);
		const task = taskById(queue[sprint.at]);
		const comingUp = queue
			.filter((id, position) => position !== sprint.at)
			.slice(0, 3)
			.map((id) => taskById(id));
		focusArea.innerHTML = `<div class="tdl-focus-grid">${focusCardMarkup(task, queue.length)}<aside class="tdl-focus-side">${timerMarkup()}${comingUpMarkup(comingUp)}</aside></div>`;
		fillAvatars(focusArea);
		paintClock();
		if (focusAfter) pick(focusAfter, focusArea)?.focus();
	}

	function focusClearMarkup() {
		const heading = sprint.completed ? "That's today done" : 'Nothing due today';
		const lead = sprint.completed
			? `You finished ${countOf(sprint.completed, 'task')}. Take a break, or look at what is coming up.`
			: 'There is nothing waiting for today. Pick something from Upcoming to get ahead.';
		return `<div class="tdl-focus-card tdl-focus-card-clear"><span class="tdl-focus-clear-mark" aria-hidden="true"><i class="bi bi-check2-all"></i></span><h3 class="tdl-focus-title" tabindex="-1">${heading}</h3><p class="tdl-focus-lead">${lead}</p><div class="tdl-focus-actions"><button type="button" class="btn btn-primary" data-tdl-focus-upcoming>See upcoming</button><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Back to tasks</button></div></div>`;
	}

	function focusCardMarkup(task, queueLength) {
		const home = listById(task.list);
		const who = personById(task.assignee);
		const checklist = task.steps || [];
		const overdue = daysAway(task.due) < 0;

		const level =
			task.priority < 4
				? `<span class="tdl-prio tdl-tone-p${task.priority}"><i class="bi ${LEVELS[task.priority].glyph}" aria-hidden="true"></i>${LEVELS[task.priority].label}</span>`
				: '';
		const eyebrow = `<p class="tdl-focus-eyebrow"><span class="tdl-nav-dot tdl-c${home ? home.tint : 1}" aria-hidden="true"></span>${htmlSafe(home ? home.name : 'Inbox')}<span class="tdl-due${overdue ? ' tdl-due-late' : ' tdl-due-today'}"><i class="bi bi-calendar-event" aria-hidden="true"></i>${overdue ? `Was due ${dueInSentence(task.due)}` : 'Due today'}</span>${level}</p>`;
		const notes = task.notes ? `<p class="tdl-focus-notes">${htmlSafe(task.notes)}</p>` : '';
		const stepsList = checklist.length
			? `<ul class="tdl-steps tdl-focus-steps">${checklist.map((step, index) => `<li class="tdl-step${step.done ? ' is-done' : ''}"><input class="form-check-input" type="checkbox" id="tdl-fstep-${index}"${step.done ? ' checked' : ''} data-tdl-focus-step="${index}"><label class="tdl-step-label" for="tdl-fstep-${index}">${htmlSafe(step.title)}</label></li>`).join('')}</ul>`
			: '';
		const skip =
			queueLength > 1
				? '<button type="button" class="btn btn-outline-secondary" data-tdl-focus-skip><i class="bi bi-skip-forward me-1" aria-hidden="true"></i>Not now</button>'
				: '';
		const owner = who
			? `<p class="tdl-focus-who">${avatarMarkup(who)}<span>${htmlSafe(who.id === store.me ? 'Yours' : `For ${who.name}`)}</span></p>`
			: '';

		return `<article class="tdl-focus-card" aria-labelledby="tdl-focus-task">${eyebrow}<h3 class="tdl-focus-title" id="tdl-focus-task" tabindex="-1">${htmlSafe(task.title)}</h3>${notes}${stepsList}<div class="tdl-focus-actions"><button type="button" class="btn btn-primary" data-tdl-focus-done><i class="bi bi-check2 me-1" aria-hidden="true"></i>Mark done</button>${skip}</div>${owner}</article>`;
	}

	function timerMarkup() {
		const started = sprint.remaining < SPRINT_SECONDS;
		const toggle = sprint.running
			? '<i class="bi bi-pause-fill me-1" aria-hidden="true"></i>Pause'
			: `<i class="bi bi-play-fill me-1" aria-hidden="true"></i>${started ? 'Resume' : 'Start 25 minutes'}`;
		const reset = started
			? '<button type="button" class="btn btn-sm btn-outline-secondary" data-tdl-timer-reset>Reset</button>'
			: '';
		return `<section class="tdl-focus-timer" aria-labelledby="tdl-timer-title"><h3 class="tdl-focus-side-title" id="tdl-timer-title">Focus timer</h3><div class="tdl-timer" data-tdl-timer><svg class="tdl-timer-ring" viewBox="0 0 120 120" aria-hidden="true"><circle class="tdl-timer-track" cx="60" cy="60" r="52"></circle><path class="tdl-timer-bar" d="M112 60a52 52 0 1 1-104 0a52 52 0 1 1 104 0" pathLength="100" data-tdl-timer-bar></path></svg><span class="tdl-timer-clock" role="timer" aria-live="off" data-tdl-timer-clock>${asClock(sprint.remaining)}</span></div><div class="tdl-focus-timer-actions"><button type="button" class="btn btn-sm btn-outline-secondary" data-tdl-timer-toggle>${toggle}</button>${reset}</div></section>`;
	}

	function comingUpMarkup(tasks) {
		if (!tasks.length) return '';
		const entries = tasks
			.map(
				(task) =>
					`<li><span class="tdl-nav-dot tdl-c${(listById(task.list) || { tint: 1 }).tint}" aria-hidden="true"></span>${htmlSafe(task.title)}</li>`,
			)
			.join('');
		return `<section class="tdl-focus-next" aria-labelledby="tdl-next-title"><h3 class="tdl-focus-side-title" id="tdl-next-title">Up next</h3><ol class="tdl-focus-next-list">${entries}</ol></section>`;
	}

	function finishFocusTask() {
		const id = sprint.queue[sprint.at];
		const task = taskById(id);
		task.done = true;
		task.doneAt = new Date().toISOString();
		server.putTask(task);
		sprint.completed += 1;
		redraw();
		drawFocus('[data-tdl-focus-done]');
		notify({
			tone: 'success',
			title: 'Done',
			text: task.title,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						task.done = false;
						task.doneAt = null;
						sprint.completed -= 1;
						sprint.queue.splice(sprint.at, 0, id);
						server.putTask(task);
						redraw();
						drawFocus(false);
					},
				},
			],
		});
	}

	/* The ring is a 100-unit path, so the dash offset is the share used up. */
	function paintClock() {
		const ring = pick('[data-tdl-timer-bar]', focusArea);
		const readout = pick('[data-tdl-timer-clock]', focusArea);
		if (readout) readout.textContent = asClock(sprint.remaining);
		if (ring) ring.style.strokeDashoffset = String(100 - (sprint.remaining / SPRINT_SECONDS) * 100);
	}

	function onClockFrame() {
		const now = performance.now();
		sprint.remaining = Math.max(0, sprint.remaining - (now - sprint.lastFrame) / 1000);
		sprint.lastFrame = now;
		paintClock();
		if (sprint.remaining > 0) return;
		haltClock();
		sprint.remaining = SPRINT_SECONDS;
		drawFocus('[data-tdl-timer-toggle]');
		notify({
			tone: 'info',
			icon: 'bi-pause-circle',
			title: '25 minutes done',
			text: 'Time for a short break. Start the timer again when you are back.',
		});
	}

	function runClock() {
		sprint.running = true;
		sprint.lastFrame = performance.now();
		sprint.interval = setInterval(onClockFrame, 250);
	}

	function haltClock() {
		sprint.running = false;
		clearInterval(sprint.interval);
	}

	/* Listeners, bound once from mount(). */

	/* Clicks anywhere in the app: nav and empty-state buttons, toolbar actions
     and the task rows. The first matching hook wins. */
	function wireBoard() {
		const clickHooks = [
			['[data-tdl-view]', (hit) => switchView(hit.dataset.tdlView)],
			[
				'[data-tdl-add-focus]',
				() => {
					ui.quickInput.focus();
					ui.quickInput.scrollIntoView({ block: 'center', behavior: motionIsReduced() ? 'auto' : 'smooth' });
				},
			],
			['[data-tdl-focus-open]', () => openFocusMode()],
			['[data-tdl-list-new]', () => openListEditor(null)],
			['[data-tdl-list-edit]', () => openListEditor(store.view.slice(5))],
			['[data-tdl-list-delete]', () => askToDeleteList()],
			[
				'[data-tdl-clear-search]',
				() => {
					ui.search.value = '';
					store.search = '';
					drawEverything();
					ui.search.focus();
				},
			],
			['[data-tdl-clear-done]', () => clearFinished()],
			['[data-tdl-reschedule]', () => pullOverdueToToday()],
			[
				'[data-tdl-quick-more]',
				() => {
					const typed = ui.quickInput.value;
					showTaskDrawer(null, fillGaps(typed.trim() ? readPhrase(typed) : { title: '' }));
					ui.quickInput.value = '';
					drawReadout();
				},
			],
			[
				'[data-tdl-try]',
				(hit) => {
					const trimmed = ui.quickInput.value.replace(/\s+$/, '');
					ui.quickInput.value = `${trimmed ? `${trimmed} ` : ''}${hit.dataset.tdlTry} `;
					ui.quickInput.focus();
					drawReadout();
				},
			],
			[
				'[data-tdl-retry]',
				(hit) => {
					setButton(hit, 'loading');
					loadBoard();
				},
			],
		];

		app.addEventListener('click', (event) => {
			for (const [selector, run] of clickHooks) {
				const hit = event.target.closest(selector);
				if (hit) {
					run(hit);
					return;
				}
			}
			const row = event.target.closest('.tdl-item');
			if (!row) return;
			/* The quick view icon opens the drawer; anywhere else on the row
         except the tick box and the grip opens the full task page. */
			if (event.target.closest('[data-tdl-peek]')) showTaskDrawer(row.dataset.id);
			else if (event.target.closest('[data-tdl-delete]')) removeTask(row.dataset.id);
			else if (!event.target.closest('input, label, .tdl-item-handle')) openTaskPage(row.dataset.id, event);
		});

		app.addEventListener('change', (event) => {
			const box = event.target.closest('[data-tdl-check]');
			if (box) markDone(box.closest('.tdl-item').dataset.id, box.checked);
			if (event.target.name === 'tdl-order') {
				store.sort = event.target.value;
				drawBoard();
			}
		});

		ui.body.addEventListener(
			'toggle',
			(event) => {
				if (event.target.matches('[data-tdl-done]')) store.doneExpanded = event.target.open;
			},
			true,
		);
		ui.body.addEventListener('basalt:sortable-change', (event) => applyDragOrder(event.detail.to));
	}

	function wireQuickAdd() {
		ui.quickForm.addEventListener('submit', (event) => {
			event.preventDefault();
			addFromQuick();
		});
		ui.quickInput.addEventListener('input', () => {
			drawReadout();
			refreshPicker();
		});
		ui.quickInput.addEventListener('click', refreshPicker);
		ui.quickInput.addEventListener('blur', hidePicker);
		ui.quickInput.addEventListener('keydown', onQuickKey);

		/* Picking on mousedown keeps focus in the field, so its blur does not
       close the menu before the pick lands. */
		ui.suggestions.addEventListener('mousedown', (event) => {
			const option = event.target.closest('[data-tdl-suggest-item]');
			if (!option) return;
			event.preventDefault();
			chooseOption(Number(option.dataset.tdlSuggestItem));
		});
	}

	function onQuickKey(event) {
		const optionCount = suggestMenu.options.length;
		if (optionCount) {
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault();
				suggestMenu.highlighted =
					(suggestMenu.highlighted + (event.key === 'ArrowDown' ? 1 : optionCount - 1)) % optionCount;
				highlightOption();
				return;
			}
			if (event.key === 'Enter' || event.key === 'Tab') {
				event.preventDefault();
				chooseOption(suggestMenu.highlighted);
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				hidePicker();
				return;
			}
		}
		if (event.key === 'Escape' && ui.quickInput.value) {
			event.preventDefault();
			ui.quickInput.value = '';
			drawReadout();
		}
	}

	/* Search runs across every list, a beat after typing stops. The slash key
     jumps to it from anywhere that is not already a field or an open layer. */
	function wireSearch() {
		let pause = 0;
		ui.search.addEventListener('input', () => {
			clearTimeout(pause);
			pause = setTimeout(() => {
				store.search = ui.search.value.trim();
				drawNav();
				drawBoard();
			}, 120);
		});
		ui.search.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape' || !ui.search.value) return;
			event.preventDefault();
			ui.search.value = '';
			store.search = '';
			drawEverything();
		});
		document.addEventListener('keydown', (event) => {
			if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
			const origin = event.target;
			const typing = origin.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(origin.tagName);
			if (typing || pick('.modal.show, .offcanvas.show')) return;
			event.preventDefault();
			ui.search.focus();
		});
	}

	function wireDrawer() {
		taskSheet.form.addEventListener('submit', (event) => {
			event.preventDefault();
			saveDrawer();
		});
		taskSheet.nameField.addEventListener('input', () => {
			if (taskSheet.nameField.value.trim()) taskSheet.nameField.classList.remove('is-invalid');
		});
		taskSheet.nameField.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' || event.shiftKey) return;
			event.preventDefault();
			saveDrawer();
		});

		ui.drawerPanel.addEventListener('click', (event) => {
			const preset = event.target.closest('[data-tdl-date]');
			if (preset) {
				const choice = preset.dataset.tdlDate;
				const midnightToday = midnight(new Date());
				if (choice === '') taskSheet.dueField.value = '';
				else if (choice === 'week') taskSheet.dueField.value = toIso(nextWeekFrom(midnightToday));
				else taskSheet.dueField.value = toIso(shiftDays(midnightToday, Number(choice)));
				announce(taskSheet.dueField.value ? `Due ${fullDay(taskSheet.dueField.value)}` : 'No date');
				return;
			}
			if (event.target.closest('[data-tdl-step-add]')) {
				appendStep();
				return;
			}
			const remover = event.target.closest('[data-tdl-step-remove]');
			if (remover) {
				removeStep(remover);
				return;
			}
			if (event.target.closest('[data-tdl-sheet-delete]')) {
				const id = taskSheet.draft.id;
				drawerInstance().hide();
				removeTask(id);
			}
		});

		ui.drawerPanel.addEventListener('change', (event) => {
			const box = event.target.closest('[data-tdl-step-check]');
			if (!box) return;
			const checklist = taskSheet.draft.steps;
			checklist[Number(box.closest('[data-step]').dataset.step)].done = box.checked;
			box.closest('.tdl-step').classList.toggle('is-done', box.checked);
			taskSheet.stepTally.textContent = `${checklist.filter((step) => step.done).length} of ${checklist.length}`;
		});
		taskSheet.stepInput.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter') return;
			event.preventDefault();
			appendStep();
		});
		ui.drawerPanel.addEventListener('shown.bs.offcanvas', () => {
			if (taskSheet.creating || !taskSheet.nameField.value) taskSheet.nameField.focus();
		});
	}

	function wireListDialogs() {
		listEditor.form.addEventListener('submit', (event) => {
			event.preventDefault();
			saveListEditor();
		});
		listEditor.nameField.addEventListener('input', () => {
			showListTag();
			listEditor.nameField.classList.remove('is-invalid');
		});
		ui.listModal.addEventListener('shown.bs.modal', () => listEditor.nameField.focus());
		ui.deleteModal.addEventListener('basalt:confirm', deleteCurrentList);
	}

	function wireFocusMode() {
		const focusHooks = [
			['[data-tdl-focus-done]', () => finishFocusTask()],
			[
				'[data-tdl-focus-skip]',
				() => {
					sprint.at = (sprint.at + 1) % sprint.queue.length;
					drawFocus('[data-tdl-focus-skip]');
				},
			],
			[
				'[data-tdl-timer-toggle]',
				() => {
					if (sprint.running) haltClock();
					else runClock();
					drawFocus('[data-tdl-timer-toggle]');
				},
			],
			[
				'[data-tdl-timer-reset]',
				() => {
					haltClock();
					sprint.remaining = SPRINT_SECONDS;
					drawFocus('[data-tdl-timer-toggle]');
				},
			],
			[
				'[data-tdl-focus-upcoming]',
				() => {
					window.bootstrap.Modal.getOrCreateInstance(ui.focusModal).hide();
					switchView('upcoming');
				},
			],
		];

		ui.focusModal.addEventListener('click', (event) => {
			const match = focusHooks.find(([selector]) => event.target.closest(selector));
			if (match) match[1]();
		});
		ui.focusModal.addEventListener('change', (event) => {
			const box = event.target.closest('[data-tdl-focus-step]');
			if (!box) return;
			const task = taskById(sprint.queue[sprint.at]);
			task.steps[Number(box.dataset.tdlFocusStep)].done = box.checked;
			box.closest('.tdl-step').classList.toggle('is-done', box.checked);
			server.putTask(task);
			drawBoard();
		});
		ui.focusModal.addEventListener('shown.bs.modal', () => {
			pick('.tdl-focus-title', focusArea)?.focus();
		});
		ui.focusModal.addEventListener('hidden.bs.modal', () => haltClock());
	}

	/* Small helpers shared by everything above. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (character) => ENTITIES[character]);
	}

	function countOf(amount, singular, pluralForm) {
		return `${amount} ${amount === 1 ? singular : pluralForm || `${singular}s`}`;
	}

	/* A list name as a quick add tag: lower case, letters and digits only. */
	function tagOf(text) {
		return String(text)
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '');
	}

	function freshId(prefix) {
		return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
	}

	function copyOf(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function motionIsReduced() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function announce(text) {
		window.Basalt.announce?.(text);
	}

	function setButton(button, mode, label) {
		window.Basalt.buttonState?.(button, mode, label);
	}

	/** Mulberry32: a tiny repeatable generator of numbers from 0 up to 1. */
	function makeSequence(seed) {
		let current = seed >>> 0;
		return () => {
			current = (current + 0x6d2b79f5) >>> 0;
			let mixed = current;
			mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	/* Dates. Tasks carry plain "YYYY-MM-DD" strings, read as local days. */

	function dayFromNow(offset) {
		return toIso(shiftDays(midnight(new Date()), offset));
	}

	/* A timestamp on that day at a seeded working hour. */
	function stampAt(offset) {
		const moment = shiftDays(midnight(new Date()), offset);
		moment.setHours(8 + Math.floor(draw() * 9), Math.floor(draw() * 60));
		return moment.toISOString();
	}

	function midnight(date) {
		const copy = new Date(date);
		copy.setHours(0, 0, 0, 0);
		return copy;
	}

	function shiftDays(date, amount) {
		const copy = new Date(date);
		copy.setDate(copy.getDate() + amount);
		return copy;
	}

	/* The coming Monday, or a week on when today is Monday. */
	function nextWeekFrom(date) {
		return shiftDays(date, (8 - date.getDay()) % 7 || 7);
	}

	function toIso(date) {
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${date.getFullYear()}-${month}-${day}`;
	}

	function fromIso(iso) {
		const [year, month, day] = iso.split('-').map(Number);
		return new Date(year, month - 1, day);
	}

	function todayIso() {
		return toIso(new Date());
	}

	function daysAway(iso) {
		return Math.round((fromIso(iso) - midnight(new Date())) / 86400000);
	}

	function fullDay(iso) {
		const date = fromIso(iso);
		return `${DAY_ABBR[date.getDay()]}, ${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
	}

	/* The short label on a row: Today, Tomorrow, Yesterday, a weekday within
     the week, otherwise "Oct 3". */
	function shortDue(iso) {
		const away = daysAway(iso);
		if (NEARBY_DAYS[away]) return NEARBY_DAYS[away];
		const date = fromIso(iso);
		if (away > 1 && away < 7) return DAY_ABBR[date.getDay()];
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
	}

	/* The same label mid-sentence: "due tomorrow", "due Fri". */
	function dueInSentence(iso) {
		const label = shortDue(iso);
		return Object.values(NEARBY_DAYS).includes(label) ? label.toLowerCase() : label;
	}

	function asClock(seconds) {
		return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
	}
})();
