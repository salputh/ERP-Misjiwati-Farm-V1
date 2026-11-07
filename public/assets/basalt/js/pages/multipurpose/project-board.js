/**
 * The issue board on project-board.html, mounted on [data-board-root].
 *
 * Fieldline's customer team tracks its work here: a column for each status,
 * a card for each issue, and a side drawer that holds one issue's full record.
 *
 * Bringing your own data: put your backend's answer where STARTER_BOARD is, or
 * let backend.fetchBoard() request it. The markup holds no issue and no column;
 * all of it is drawn from that one object. Then fill in the backend methods,
 * one request each. The page changes first, sends the request second, and
 * restores the earlier state with an error toast when the request fails.
 *
 * Ways work moves:
 *   dragging a card        to another spot or status, with Undo
 *   Space on a card        lifts it; arrows carry it, Space sets it down
 *   the card's menu        another status, top of its column, delete
 *   "Add issue"            a quick entry at a column's foot; Enter adds
 *   clicking a card        the drawer, where each field saves on change
 *
 * Shared pieces from basalt.js do the heavy lifting: sortable boards, undo
 * toasts, drawers, dialogs, the command menu, multi-select menus, styled
 * selects, tag input, steppers, segmented controls, avatars, skeletons and
 * the screen reader announcer.
 */
(() => {
	'use strict';

	const boardRoot = pick('[data-board-root]');
	if (!boardRoot) return;

	/* The sample board a visitor starts from. Swap in your own records. The me
     field is the signed-in person's id. The color field on labels and columns is
     1 to 8, an index into the palette's chart series. Every project carries
     a key for issue numbers (PORT-142), the next number it will hand out,
     and its columns; a column is one status with a card limit (0 for none),
     a done flag for finished work and an optional collapsed flag. An issue's
     status is a column id of its own project; type is task, bug or story;
     priority is urgent, high, medium or low; due is "YYYY-MM-DD". Fields an
     issue leaves out (assignee, due, labels, description, subtasks,
     activity) start empty. Demo dates are counted from today so something is
     always due soon and something is always late; real records hold fixed
     dates. */
	const STARTER_BOARD = {
		me: 'ja',
		people: [
			{ id: 'ja', role: 'IT and systems manager', name: 'John Armstrong' },
			{ id: 'dk', role: 'Growth marketer', name: 'Marshall Beck' },
			{ id: 'gl', role: 'Onboarding specialist', name: 'Courtney Lowry' },
			{ id: 'pr', role: 'Support lead', name: 'Connie Reese' },
			{ id: 'lo', role: 'Operations analyst', name: 'Lance Bishop' },
			{ id: 'ta', role: 'Customer success manager', name: 'Tony Aldridge' },
		],
		labels: [
			{ id: 'store-page', color: 1, name: 'Portal page' },
			{ id: 'photos', color: 2, name: 'Photos' },
			{ id: 'email', color: 3, name: 'Email' },
			{ id: 'stock', color: 4, name: 'Slots' },
			{ id: 'shipping', color: 5, name: 'Payments' },
			{ id: 'checkout', color: 6, name: 'Checkout' },
			{ id: 'onboarding', color: 7, name: 'Onboarding' },
			{ id: 'copy', color: 8, name: 'Copy' },
		],
		projects: [
			{
				id: 'store',
				name: 'Portal relaunch',
				key: 'PORT',
				color: 5,
				next: 152,
				columns: [
					{ id: 'backlog', name: 'Backlog', color: 8, limit: 0, done: false, collapsed: true },
					{ id: 'todo', name: 'To do', color: 1, limit: 0, done: false },
					{ id: 'doing', name: 'In progress', color: 5, limit: 4, done: false },
					{ id: 'review', name: 'In review', color: 4, limit: 3, done: false },
					{ id: 'done', name: 'Done', color: 3, limit: 0, done: true },
				],
			},
			{
				id: 'web',
				name: 'Website refresh',
				key: 'WEB',
				color: 1,
				next: 29,
				columns: [
					{ id: 'backlog', name: 'Backlog', color: 8, limit: 0, done: false },
					{ id: 'todo', name: 'To do', color: 1, limit: 0, done: false },
					{ id: 'doing', name: 'In progress', color: 5, limit: 3, done: false },
					{ id: 'review', name: 'In review', color: 4, limit: 2, done: false },
					{ id: 'done', name: 'Done', color: 3, limit: 0, done: true },
				],
			},
			{
				id: 'onboard',
				name: 'Onboarding playbook',
				key: 'ONB',
				color: 7,
				next: 15,
				columns: [
					{ id: 'backlog', name: 'Backlog', color: 8, limit: 0, done: false, collapsed: true },
					{ id: 'todo', name: 'To do', color: 1, limit: 0, done: false },
					{ id: 'doing', name: 'In progress', color: 5, limit: 2, done: false },
					{ id: 'review', name: 'In review', color: 4, limit: 0, done: false },
					{ id: 'done', name: 'Done', color: 3, limit: 0, done: true },
				],
			},
		],
		issues: [
			{
				key: 'PORT-131',
				title: 'Self-booking page with a service picker',
				project: 'store',
				status: 'doing',
				type: 'story',
				priority: 'high',
				assignee: 'dk',
				reporter: 'ja',
				points: 5,
				due: dateIn(3),
				labels: ['store-page'],
				description:
					'One page for new clients to book a visit, with a picker for one visit or a weekly plan. Weekly adds a standing day.',
				subtasks: [
					{ title: 'Layout on desktop and phone', done: true },
					{ title: 'Picker updates the price', done: true },
					{ title: 'Fully booked state for each day', done: false },
					{ title: 'Alt text for every photo', done: false },
				],
				activity: [
					{ who: 'ja', at: stamp(2, 9), text: 'Can the weekly plan show the saving in the first photo?' },
					{
						who: 'dk',
						at: stamp(1, 16),
						text: 'Yes, swapping the order now. New photos from Courtney tomorrow.',
					},
				],
			},
			{
				key: 'PORT-132',
				title: 'Photograph a carer arriving for the booking page',
				project: 'store',
				status: 'doing',
				type: 'task',
				priority: 'medium',
				assignee: 'gl',
				reporter: 'dk',
				points: 2,
				due: dateIn(1),
				labels: ['photos'],
				description: 'Three angles, plus one with the booking page on a phone.',
			},
			{
				key: 'PORT-133',
				title: 'Checkout drops the PO number when a coupon is applied',
				project: 'store',
				status: 'review',
				type: 'bug',
				priority: 'urgent',
				assignee: 'dk',
				reporter: 'pr',
				points: 3,
				due: dateIn(-1),
				labels: ['checkout'],
				description:
					'Two customers wrote in about it this week. The PO number is there until the coupon goes in, then the field is empty on the order.',
				subtasks: [
					{ title: 'Reproduce on the test portal', done: true },
					{ title: 'Fix and add a test order', done: true },
				],
				activity: [
					{
						who: 'pr',
						at: stamp(3, 11),
						text: 'Booking 4188 and 4192 both lost their PO numbers. I have added them to the invoices by hand.',
					},
					{
						who: 'dk',
						at: stamp(1, 14),
						text: 'Found it: the coupon reloads the cart and forgets the field. Fix is up for review.',
					},
					{ who: 'lo', at: stamp(0, 8), text: 'Thanks. I will keep checking invoices until it is live.' },
				],
			},
			{
				key: 'PORT-134',
				title: 'Write the copy for the weekly visit plan',
				project: 'store',
				status: 'todo',
				type: 'task',
				priority: 'medium',
				assignee: 'gl',
				reporter: 'ja',
				points: 1,
				due: dateIn(4),
				labels: ['copy'],
				description: 'Keep it under 60 words, same voice as the home page.',
			},
			{
				key: 'PORT-135',
				title: 'Order 500 printed welcome cards from the printer',
				project: 'store',
				status: 'todo',
				type: 'task',
				priority: 'high',
				assignee: 'lo',
				reporter: 'ja',
				points: 2,
				due: dateIn(2),
				labels: ['shipping'],
				description: 'Same size as last year. Ask for a sample by mail.',
				subtasks: [
					{ title: 'Send the measurements', done: true },
					{ title: 'Approve the sample', done: false },
				],
			},
			{
				key: 'PORT-136',
				title: 'Launch email with the three new features',
				project: 'store',
				status: 'todo',
				type: 'story',
				priority: 'high',
				assignee: 'pr',
				reporter: 'ja',
				points: 3,
				due: dateIn(6),
				labels: ['email'],
				description: 'Goes to every account that used the portal in the last year. Lead with self-booking.',
			},
			{
				key: 'PORT-137',
				title: 'Price the weekly plan',
				project: 'store',
				status: 'review',
				type: 'task',
				priority: 'high',
				assignee: 'ja',
				reporter: 'gl',
				points: 1,
				due: dateIn(0),
				description: 'Cost sheet is in the shared drive. Aim for the same margin as the yearly plan.',
			},
			{
				key: 'PORT-138',
				title: 'Booking photos load blurry on phones',
				project: 'store',
				status: 'doing',
				type: 'bug',
				priority: 'medium',
				assignee: 'dk',
				reporter: 'pr',
				points: 2,
				due: dateIn(5),
				labels: ['photos', 'store-page'],
				description: 'Happens on the first visit only. Looks like the small image is shown and never swapped.',
			},
			{
				key: 'PORT-149',
				title: 'Service picker forgets its choice after a refresh',
				project: 'store',
				status: 'doing',
				type: 'bug',
				priority: 'medium',
				assignee: 'dk',
				reporter: 'ja',
				points: 2,
				labels: ['store-page'],
			},
			{
				key: 'PORT-148',
				title: 'Proofread the launch email',
				project: 'store',
				status: 'review',
				type: 'task',
				priority: 'medium',
				assignee: 'pr',
				reporter: 'pr',
				points: 1,
				due: dateIn(2),
				labels: ['email', 'copy'],
			},
			{
				key: 'PORT-142',
				title: 'Weekly plan shows a wrong visit count in the cart',
				project: 'store',
				status: 'todo',
				type: 'bug',
				priority: 'urgent',
				assignee: 'dk',
				reporter: 'lo',
				points: 2,
				due: dateIn(1),
				labels: ['checkout'],
				description:
					'The cart says 3 visits for a weekly plan. Tax is worked out from it, so the price is wrong too.',
				activity: [
					{
						who: 'lo',
						at: stamp(1, 10),
						text: 'Spotted while booking a test visit. The invoice itself used the right count.',
					},
				],
			},
			{
				key: 'PORT-139',
				title: 'Check open slots for every branch before launch',
				project: 'store',
				status: 'done',
				type: 'task',
				priority: 'low',
				assignee: 'lo',
				reporter: 'lo',
				points: 1,
				due: dateIn(-2),
				labels: ['stock'],
			},
			{
				key: 'PORT-140',
				title: 'Pick the photo for the booking page',
				project: 'store',
				status: 'done',
				type: 'task',
				priority: 'medium',
				assignee: 'ja',
				reporter: 'gl',
				points: 1,
				due: dateIn(-4),
			},
			{
				key: 'PORT-147',
				title: 'Update booking cut-off times for October',
				project: 'store',
				status: 'done',
				type: 'task',
				priority: 'medium',
				assignee: 'lo',
				reporter: 'pr',
				points: 1,
				due: dateIn(-3),
			},
			{
				key: 'PORT-150',
				title: 'Book support cover for the launch weekend',
				project: 'store',
				status: 'done',
				type: 'task',
				priority: 'medium',
				assignee: 'lo',
				reporter: 'ja',
				points: 2,
				due: dateIn(-1),
			},
			{
				key: 'PORT-141',
				title: 'Launch banner on the portal home page',
				project: 'store',
				status: 'backlog',
				type: 'story',
				priority: 'low',
				assignee: 'dk',
				reporter: 'ja',
				points: 3,
				labels: ['store-page'],
			},
			{
				key: 'PORT-143',
				title: 'Brief the support team on the self-booking flow',
				project: 'store',
				status: 'backlog',
				type: 'task',
				priority: 'medium',
				assignee: 'lo',
				reporter: 'ja',
				points: 1,
				labels: ['shipping'],
			},
			{
				key: 'PORT-144',
				title: 'Reprint welcome cards for the new clients',
				project: 'store',
				status: 'backlog',
				type: 'task',
				priority: 'medium',
				assignee: 'gl',
				reporter: 'gl',
				points: 2,
				labels: ['stock'],
			},
			{
				key: 'PORT-145',
				title: 'Let customers split invoices across branches at checkout',
				project: 'store',
				status: 'backlog',
				type: 'story',
				priority: 'high',
				reporter: 'pr',
				points: 5,
				labels: ['checkout'],
				description: 'Asked for by every multi-branch account.',
			},
			{
				key: 'PORT-146',
				title: 'Social posts for launch week',
				project: 'store',
				status: 'backlog',
				type: 'task',
				priority: 'low',
				assignee: 'pr',
				reporter: 'pr',
				points: 2,
				labels: ['copy'],
			},
			{
				key: 'PORT-151',
				title: 'Ask the printer about a bulk price on cards',
				project: 'store',
				status: 'backlog',
				type: 'task',
				priority: 'low',
				reporter: 'gl',
				points: 1,
			},

			{
				key: 'WEB-21',
				title: 'New header with the product and the portal side by side',
				project: 'web',
				status: 'doing',
				type: 'story',
				priority: 'high',
				assignee: 'dk',
				reporter: 'ja',
				points: 5,
				due: dateIn(4),
				labels: ['store-page'],
				subtasks: [
					{ title: 'Desktop', done: true },
					{ title: 'Phone menu', done: false },
				],
			},
			{
				key: 'WEB-22',
				title: 'Move the setup guides into the help center',
				project: 'web',
				status: 'todo',
				type: 'task',
				priority: 'medium',
				assignee: 'pr',
				reporter: 'dk',
				points: 3,
				due: dateIn(8),
				labels: ['copy'],
			},
			{
				key: 'WEB-23',
				title: 'Search shows retired add-ons first',
				project: 'web',
				status: 'review',
				type: 'bug',
				priority: 'high',
				assignee: 'dk',
				reporter: 'pr',
				points: 2,
				due: dateIn(1),
			},
			{
				key: 'WEB-24',
				title: 'Compress the large photos on the home page',
				project: 'web',
				status: 'done',
				type: 'task',
				priority: 'low',
				assignee: 'dk',
				reporter: 'dk',
				points: 1,
				due: dateIn(-5),
				labels: ['photos'],
			},
			{
				key: 'WEB-25',
				title: 'Customer stories page by industry',
				project: 'web',
				status: 'backlog',
				type: 'story',
				priority: 'medium',
				assignee: 'ta',
				reporter: 'ta',
				points: 8,
				labels: ['onboarding'],
			},
			{
				key: 'WEB-26',
				title: 'Rewrite the About page',
				project: 'web',
				status: 'todo',
				type: 'task',
				priority: 'low',
				assignee: 'gl',
				reporter: 'ja',
				points: 2,
				due: dateIn(9),
				labels: ['copy'],
			},
			{
				key: 'WEB-27',
				title: 'Footer links overlap on small phones',
				project: 'web',
				status: 'doing',
				type: 'bug',
				priority: 'medium',
				assignee: 'dk',
				reporter: 'lo',
				points: 1,
				due: dateIn(-3),
			},
			{
				key: 'WEB-28',
				title: 'Cookie banner in plain English',
				project: 'web',
				status: 'backlog',
				type: 'task',
				priority: 'low',
				assignee: 'pr',
				reporter: 'pr',
				points: 1,
				labels: ['copy'],
			},

			{
				key: 'ONB-8',
				title: 'Kickoff form with team sizes and territories',
				project: 'onboard',
				status: 'doing',
				type: 'story',
				priority: 'high',
				assignee: 'ta',
				reporter: 'ja',
				points: 5,
				due: dateIn(5),
				labels: ['onboarding'],
				subtasks: [
					{ title: 'Form fields', done: true },
					{ title: 'Email to Tony on submit', done: false },
				],
			},
			{
				key: 'ONB-9',
				title: 'Training schedule PDF for October',
				project: 'onboard',
				status: 'review',
				type: 'task',
				priority: 'medium',
				assignee: 'ta',
				reporter: 'ta',
				points: 2,
				due: dateIn(1),
				labels: ['onboarding'],
			},
			{
				key: 'ONB-10',
				title: 'Ship welcome cards to Oakhaven Studio',
				project: 'onboard',
				status: 'todo',
				type: 'task',
				priority: 'medium',
				assignee: 'lo',
				reporter: 'ta',
				points: 1,
				due: dateIn(3),
				labels: ['shipping', 'onboarding'],
			},
			{
				key: 'ONB-11',
				title: 'Import the Coastline Surf Co. customer list',
				project: 'onboard',
				status: 'todo',
				type: 'task',
				priority: 'high',
				assignee: 'ja',
				reporter: 'ta',
				points: 3,
				due: dateIn(6),
			},
			{
				key: 'ONB-12',
				title: 'Max prices show to visitors after signing out',
				project: 'onboard',
				status: 'todo',
				type: 'bug',
				priority: 'urgent',
				assignee: 'dk',
				reporter: 'ta',
				points: 3,
				due: dateIn(0),
				labels: ['checkout'],
			},
			{
				key: 'ONB-13',
				title: 'Live training session at Alder & Sons Tailors',
				project: 'onboard',
				status: 'done',
				type: 'task',
				priority: 'low',
				assignee: 'ta',
				reporter: 'ta',
				points: 1,
				due: dateIn(-6),
			},
			{
				key: 'ONB-14',
				title: 'Onboarding checklist on the account page',
				project: 'onboard',
				status: 'backlog',
				type: 'story',
				priority: 'medium',
				reporter: 'ta',
				points: 5,
				labels: ['onboarding'],
			},
		],
	};

	/* Issue types and priorities, keyed by the value an issue stores. Rename
     or re-icon them here; the order is the order every menu shows. */
	const KINDS = {
		task: { label: 'Task', glyph: 'bi-check-lg' },
		bug: { label: 'Bug', glyph: 'bi-bug-fill' },
		story: { label: 'Story', glyph: 'bi-bookmark-fill' },
	};
	const URGENCY = {
		urgent: { label: 'Urgent', glyph: 'bi-chevron-double-up', weight: 1 },
		high: { label: 'High', glyph: 'bi-chevron-up', weight: 2 },
		medium: { label: 'Medium', glyph: 'bi-dash-lg', weight: 3 },
		low: { label: 'Low', glyph: 'bi-chevron-down', weight: 4 },
	};
	const SERIES = [1, 2, 3, 4, 5, 6, 7, 8];
	const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const NEAR_DAYS = { '-1': 'Yesterday', 0: 'Today', 1: 'Tomorrow' };
	const CHECK_MARK = '<i class="bi bi-check2 ms-auto" aria-hidden="true"></i>';

	/* Two address-bar switches. ?state=empty, ?state=error and ?state=offline
     show the other states (offline fails every save, so the page can be seen
     undoing itself); drop that one once a real server answers. ?project=web
     opens that project, using the ids Projects and Project Details share. */
	const pageQuery = new URLSearchParams(location.search);
	const demoMode = pageQuery.get('state') || '';
	const requestedProject = pageQuery.get('project') || '';

	/* The demo keeps a visitor's board in this browser so edits outlive a
     reload. With a server behind fetchBoard(), saveSnapshot() can go. */
	const SNAPSHOT_KEY = 'basalt-project-board-v4';
	const VIEW_KEY = 'basalt-project-board-view';
	const memory = {
		read(key) {
			try {
				return JSON.parse(localStorage.getItem(key) || 'null');
			} catch {
				return null;
			}
		},
		write(key, value) {
			try {
				localStorage.setItem(key, JSON.stringify(value));
			} catch {
				/* storage is off in private windows */
			}
		},
		drop(key) {
			try {
				localStorage.removeItem(key);
			} catch {
				/* storage is off in private windows */
			}
		},
	};

	/* Where the server goes. Each method returns a Promise; the demo answers
     from memory after a short pause. Replace the bodies with fetch() calls
     that keep the same shapes. */
	let fetchCount = 0;
	const backend = {
		/** GET /api/board, answering { me, people, labels, projects, issues }. */
		fetchBoard() {
			fetchCount += 1;
			return pause(450).then(() => {
				if (demoMode === 'error' && fetchCount === 1) throw new Error('The server did not answer');
				if (demoMode === 'empty') return { ...deepCopy(STARTER_BOARD), issues: [] };
				return (!demoMode && memory.read(SNAPSHOT_KEY)) || deepCopy(STARTER_BOARD);
			});
		},
		/** POST /api/projects/:project/issues with the issue; answers the saved issue. */
		postIssue(issue) {
			return settle(deepCopy(issue));
		},
		/** PATCH /api/issues/:key with just the fields that changed. */
		patchIssue(key, changes) {
			return settle(deepCopy(changes));
		},
		/** POST /api/issues/:key/move with { status, rank }. */
		postMove(key, status, rank) {
			return settle({ key, status, rank });
		},
		/** DELETE /api/issues/:key */
		deleteIssue(key) {
			return settle(key);
		},
		/** POST /api/projects/:project/columns with the column; answers the saved column. */
		postColumn(projectId, column) {
			return settle(deepCopy(column));
		},
		/** PATCH /api/projects/:project/columns/:id with the fields that changed. */
		patchColumn(projectId, id, changes) {
			return settle(deepCopy(changes));
		},
		/** DELETE /api/projects/:project/columns/:id with { moveTo } for the issues in it. */
		deleteColumn(projectId, id, moveTo) {
			return settle({ id, moveTo });
		},
		/** PUT /api/projects/:project/columns/order with { ids }, left to right. */
		putColumnOrder(projectId, ids) {
			return settle(ids.slice());
		},
		/** POST /api/issues/:key/comments with { text }; answers the saved comment. */
		postComment(key, comment) {
			return settle(deepCopy(comment));
		},
	};

	/* Everything the page knows. draft is { status, lane } while a quick-add
     box is open; openKey is the issue shown in the drawer. */
	const savedView = memory.read(VIEW_KEY) || {};
	const narrowScreen = window.matchMedia('(max-width: 767.98px)');
	const model = {
		ready: false,
		selfId: '',
		team: [],
		labelSet: [],
		projects: [],
		issues: [],
		projectId: requestedProject || savedView.project || '',
		view: savedView.view === 'list' ? 'list' : 'board',
		grouping: ['assignee', 'priority'].includes(savedView.group) ? savedView.group : 'none',
		density: savedView.density === 'compact' ? 'compact' : 'comfortable',
		narrow: narrowScreen.matches,
		narrowStatus: '',
		search: '',
		byPerson: new Set(),
		onlyMine: false,
		byLabel: new Set(),
		byUrgency: new Set(),
		byKind: new Set(),
		closedLanes: new Set(),
		draft: null,
		openKey: null,
	};

	const ui = {
		body: pick('[data-board-body]', boardRoot),
		scroller: pick('[data-board-scroller]', boardRoot),
		wrap: pick('[data-board-wrap]', boardRoot),
		notice: pick('[data-board-notice]', boardRoot),
		table: pick('[data-board-listview]', boardRoot),
		narrowBar: pick('[data-board-phone]', boardRoot),
		narrowPicker: pick('[data-board-phone-status]', boardRoot),
		projectButton: pick('[data-board-project-btn]', boardRoot),
		projectMenu: pick('[data-board-project-menu]', boardRoot),
		people: pick('[data-board-people]', boardRoot),
		filterMenus: pick('[data-board-filter-menus]', boardRoot),
		clearButton: pick('[data-board-clear]', boardRoot),
		search: pick('[data-board-search]', boardRoot),
		mineSwitch: pick('[data-board-mine]', boardRoot),
		grouping: pick('[data-board-group]', boardRoot),
		drawer: document.getElementById('pb-sheet'),
		composer: document.getElementById('pb-create'),
		columnEditor: document.getElementById('pb-column'),
		columnRemover: document.getElementById('pb-column-delete'),
		shortcuts: document.getElementById('pb-keys'),
	};

	/* Fields of the issue drawer, the Create issue dialog and the two column dialogs. */
	const panel = {
		title: document.getElementById('pb-sheet-name'),
		status: document.getElementById('pb-sheet-status'),
		assignee: document.getElementById('pb-sheet-assignee'),
		reporter: document.getElementById('pb-sheet-reporter'),
		priority: document.getElementById('pb-sheet-priority'),
		type: document.getElementById('pb-sheet-type'),
		points: document.getElementById('pb-sheet-points'),
		due: document.getElementById('pb-sheet-due'),
		description: document.getElementById('pb-sheet-desc'),
		tags: pick('[data-sheet-labels]', ui.drawer),
		suggestions: pick('[data-sheet-label-picks]', ui.drawer),
		subtasks: pick('[data-sheet-subs]', ui.drawer),
		activity: pick('[data-sheet-thread]', ui.drawer),
	};

	const composer = {
		form: pick('[data-create-form]', ui.composer),
		title: document.getElementById('pb-create-name'),
		description: document.getElementById('pb-create-desc'),
		status: document.getElementById('pb-create-status'),
		assignee: document.getElementById('pb-create-assignee'),
		priority: document.getElementById('pb-create-priority'),
		points: document.getElementById('pb-create-points'),
		due: document.getElementById('pb-create-due'),
		tags: pick('[data-create-labels]', ui.composer),
		suggestions: pick('[data-create-label-picks]', ui.composer),
		another: pick('[data-create-more]', ui.composer),
	};

	const columnEditor = {
		form: pick('[data-column-form]', ui.columnEditor),
		name: document.getElementById('pb-column-name'),
		limit: document.getElementById('pb-column-limit'),
		done: document.getElementById('pb-column-done'),
		error: pick('[data-column-error]', ui.columnEditor),
	};

	const columnRemover = {
		form: pick('[data-coldel-form]', ui.columnRemover),
		target: document.getElementById('pb-column-delete-to'),
	};

	/* Moment-to-moment bookkeeping: the card lifted from the keyboard, the
     drawer filling itself in (so its own writes are not taken as edits),
     where focus returns once a dialog closes, and the drag auto-scroll. */
	let lifted = null;
	let drawerSyncing = false;
	let drawerReturnKey = null;
	let composedKey = null;
	let editingColumn = null;
	let columnToFocus = null;
	let removingColumn = null;
	let savedTimer = 0;
	let scrollFrame = 0;
	const pointer = { x: 0, y: 0 };

	/** Wires every control, then asks the backend for the board. */
	function start() {
		wireCardKeys();
		wireClicks();
		wireQuickAdd();
		wireFilterControls();
		wireSwitchers();
		wireSlashKey();
		wireScroller();
		wireNarrowScreen();
		wireDrawer();
		wireComposer();
		wireColumnDialogs();
		loadBoard();
	}

	/* Loading: one request brings the whole board, and everything is drawn from state. */

	/** Fetches the board and draws it; a retry button shows its busy state. */
	async function loadBoard(retryButton) {
		if (retryButton && window.Basalt.buttonState) window.Basalt.buttonState(retryButton, 'loading');
		try {
			takeIn(await backend.fetchBoard());
			model.ready = true;
			fillVocabulary();
			drawProjectPicker();
			drawPeopleFilter();
			drawFilterMenus();
			ui.grouping.value = model.grouping;
			pick(`#pb-view-${model.view}`, boardRoot).checked = true;
			pick(`#pb-density-${model.density === 'compact' ? 'compact' : 'roomy'}`, boardRoot).checked = true;
			if (window.Basalt.buttons) window.Basalt.buttons(boardRoot);
			redraw();
			if (retryButton) announce('The board loaded.');
			if (requestedProject && requestedProject !== model.projectId) {
				notify({
					tone: 'info',
					icon: 'bi-columns-gap',
					title: 'That project has no board yet',
					text: `Showing ${currentProject().name}. Pick another board from the project menu.`,
				});
			}
		} catch {
			showLoadError();
			announce('The board did not load.');
		}
	}

	/** Copies a board payload into state, filling the fields an issue left out. */
	function takeIn(payload) {
		model.selfId = payload.me;
		model.team = payload.people;
		model.labelSet = payload.labels;
		model.projects = payload.projects;
		model.issues = payload.issues.map((record, index) => ({
			rank: (index + 1) * 1000,
			type: 'task',
			priority: 'medium',
			assignee: null,
			reporter: payload.me,
			points: 0,
			due: null,
			labels: [],
			description: '',
			subtasks: [],
			activity: [],
			created: stamp(6 + (index % 9), 9 + (index % 7)),
			...record,
		}));
		for (const record of model.issues) {
			record.activity = record.activity.map((entry, position) => ({
				id: `${record.key}-a${position}`,
				kind: 'comment',
				...entry,
			}));
		}
		if (!model.projects.some((project) => project.id === model.projectId)) model.projectId = model.projects[0].id;
	}

	function showLoadError() {
		const retry =
			'<button type="button" class="btn btn-sm btn-primary btn-loading btn-loading-swap" data-board-retry><span class="btn-loading-icon" aria-hidden="true"><i class="bi bi-arrow-clockwise"></i></span><span class="btn-loading-label">Try again</span></button>';
		ui.body.setAttribute('aria-busy', 'false');
		ui.body.innerHTML = `<div class="pb-state">${notePanel({
			tone: 'danger',
			icon: 'bi-wifi-off',
			title: 'The board didn’t load',
			text: 'The connection dropped before the issues arrived. Nothing you changed has been lost.',
			actions: retry,
		})}</div>`;
	}

	/* Event wiring, one function for each area of the page. */

	/* A card's own keys: Enter opens it, Space lifts it (see setDown). They
     are caught on the way down so the shared sortable's keys stay out. */
	function wireCardKeys() {
		boardRoot.addEventListener('basalt:sortable-change', (event) =>
			settleDrop(event.detail.item, event.detail.to, false),
		);
		boardRoot.addEventListener('keydown', onCardKey, true);
		/* Moving a lifted card blurs it for an instant, so only focus that has
       really gone elsewhere sets the card down. */
		boardRoot.addEventListener('focusout', (event) => {
			if (!lifted || event.target !== lifted.handle) return;
			setTimeout(() => {
				if (lifted && document.activeElement !== lifted.handle) setDown(false);
			}, 0);
		});
	}

	function onCardKey(event) {
		const handle = event.target.closest?.('.pb-card-main');
		if (!handle) return;
		const card = handle.closest('.pb-card');
		const holding = Boolean(lifted && lifted.card === card);
		const key = event.key;
		if (key === 'Enter' && !holding) {
			showIssue(card.getAttribute('data-key'));
		} else if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
			setDown(false);
			if (!holding) liftCard(card, handle);
		} else if (key === 'Escape' && holding) {
			setDown(true);
		} else if (holding && ARROWS.has(key)) {
			carry(key);
		} else {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
	}

	/* Every click on the board goes through one table, tried top to bottom.
     A route that answers false lets the click fall through to the next. */
	function wireClicks() {
		const cardActions = {
			top: (key) => sendTo(key, issueByKey(key).status, true),
			open: (key) => showIssue(key),
			delete: (key) => discardIssue(key),
		};
		const columnActions = {
			edit: (id) => openColumnEditor(id),
			left: (id) => shiftColumn(id, -1),
			right: (id) => shiftColumn(id, 1),
			collapse: (id) => setFolded(id, true),
			sort: (id) => sortByUrgency(id),
			delete: (id) => askColumnDelete(id),
		};
		const routes = [
			/* A keyboard click (Space) belongs to the sortable; only a pointer opens. */
			[
				'[data-card-open]',
				(hit, event) => event.detail > 0 && showIssue(hit.closest('.pb-card').getAttribute('data-key')),
			],
			['[data-list-open]', (hit) => showIssue(hit.getAttribute('data-list-open'))],
			[
				'[data-card-move]',
				(hit) =>
					sendTo(hit.closest('.pb-card').getAttribute('data-key'), hit.getAttribute('data-card-move'), false),
			],
			[
				'[data-card-action]',
				(hit) =>
					cardActions[hit.getAttribute('data-card-action')]?.(
						hit.closest('.pb-card').getAttribute('data-key'),
					),
			],
			[
				'[data-col-action]',
				(hit) => columnActions[hit.getAttribute('data-col-action')]?.(hit.getAttribute('data-col')),
			],
			['[data-col-expand]', (hit) => setFolded(hit.getAttribute('data-col-expand'), false)],
			['[data-lane-toggle]', toggleLane],
			[
				'[data-quick-open]',
				(hit) => {
					model.draft = {
						status: hit.getAttribute('data-quick-open'),
						lane: hit.getAttribute('data-lane') || '',
					};
					drawBoard();
				},
			],
			['[data-board-column-new]', () => openColumnEditor(null)],
			['[data-board-create]', () => openComposer()],
			[
				'[data-board-clear-all], [data-board-clear]',
				() => {
					resetFilters();
					ui.search.focus();
				},
			],
			['[data-board-reset]', () => restartDemo()],
			['[data-board-shortcuts]', () => dialogFor(ui.shortcuts).show()],
			['[data-board-retry]', (hit) => loadBoard(hit)],
			['[data-who]', togglePerson],
		];
		boardRoot.addEventListener('click', (event) => {
			for (const [selector, run] of routes) {
				const hit = event.target.closest(selector);
				if (hit && run(hit, event) !== false) return;
			}
		});
	}

	function toggleLane(button) {
		const laneKey = `${model.grouping}:${button.getAttribute('data-lane-toggle')}`;
		if (model.closedLanes.has(laneKey)) model.closedLanes.delete(laneKey);
		else model.closedLanes.add(laneKey);
		window.Basalt.slide(ui.wrap, drawBoard);
		document.getElementById(button.id)?.focus();
	}

	function togglePerson(button) {
		const personId = button.getAttribute('data-who');
		if (model.byPerson.has(personId)) model.byPerson.delete(personId);
		else model.byPerson.add(personId);
		const pressed = model.byPerson.has(personId);
		button.classList.toggle('is-on', pressed);
		button.setAttribute('aria-pressed', String(pressed));
		afterFilterChange();
	}

	/* The quick-add box: Enter adds, Shift+Enter breaks the line, Escape
     closes, and leaving it empty closes it too. */
	function wireQuickAdd() {
		boardRoot.addEventListener('keydown', (event) => {
			const box = event.target.closest?.('[data-quick-input]');
			if (!box) return;
			if (event.key === 'Enter' && !event.shiftKey) {
				event.preventDefault();
				submitDraft(box.form);
			} else if (event.key === 'Escape') {
				event.preventDefault();
				closeDraft(true);
			}
		});
		boardRoot.addEventListener('submit', (event) => {
			if (!event.target.matches('[data-quick-form]')) return;
			event.preventDefault();
			submitDraft(event.target);
		});
		boardRoot.addEventListener('focusout', (event) => {
			const box = event.target.closest?.('[data-quick-input]');
			if (!box || box.value.trim()) return;
			setTimeout(() => {
				const form = box.form;
				if (model.draft && form && form.isConnected && !form.contains(document.activeElement))
					closeDraft(false);
			}, 120);
		});
	}

	function wireFilterControls() {
		let typingTimer = 0;
		ui.search.addEventListener('input', () => {
			clearTimeout(typingTimer);
			typingTimer = setTimeout(() => {
				model.search = ui.search.value.trim();
				afterFilterChange();
			}, 150);
		});
		ui.search.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape' || !ui.search.value) return;
			event.preventDefault();
			ui.search.value = '';
			model.search = '';
			afterFilterChange();
		});
		ui.mineSwitch.addEventListener('change', () => {
			model.onlyMine = ui.mineSwitch.checked;
			afterFilterChange();
		});
		ui.filterMenus.addEventListener('basalt:change', (event) => {
			const menu = event.target.closest('[data-filter]');
			if (!menu) return;
			const chosen = { labels: model.byLabel, priority: model.byUrgency, type: model.byKind }[
				menu.getAttribute('data-filter')
			];
			const picked = event.detail?.values || [];
			if (picked.length === chosen.size && picked.every((value) => chosen.has(value))) return;
			chosen.clear();
			for (const value of picked) chosen.add(value);
			afterFilterChange();
		});
	}

	/* The project menu, the board and list switch, swimlanes, card size and
     the status picker phones use. */
	function wireSwitchers() {
		ui.projectMenu.addEventListener('basalt:command', (event) => {
			if (event.detail?.value) showProject(event.detail.value);
		});
		pick('[data-board-view]', boardRoot).addEventListener('change', (event) => {
			model.view = event.target.value === 'list' ? 'list' : 'board';
			model.draft = null;
			saveView();
			redraw();
			announce(model.view === 'list' ? 'List view.' : 'Board view.');
		});
		ui.grouping.addEventListener('change', () => {
			model.grouping = ui.grouping.value;
			model.draft = null;
			saveView();
			redraw();
			announce(model.grouping === 'none' ? 'No swimlanes.' : `Grouped by ${model.grouping}.`);
		});
		pick('[data-board-density]', boardRoot).addEventListener('change', (event) => {
			model.density = event.target.value === 'compact' ? 'compact' : 'comfortable';
			saveView();
			boardRoot.classList.toggle('is-compact', model.density === 'compact');
			syncEdgeShadows();
		});
		ui.narrowPicker.addEventListener('change', () => {
			model.narrowStatus = ui.narrowPicker.value;
			model.draft = null;
			drawBoard();
		});
	}

	/* "/" jumps to the search box unless something is being typed already. */
	function wireSlashKey() {
		document.addEventListener('keydown', (event) => {
			if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
			const active = document.activeElement;
			if (active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return;
			if (pick('.modal.show, .offcanvas.show')) return;
			event.preventDefault();
			ui.search.focus();
		});
	}

	function wireScroller() {
		ui.scroller.addEventListener('scroll', syncEdgeShadows, { passive: true });
		window.addEventListener('resize', syncEdgeShadows);
		window.addEventListener(
			'pointermove',
			(event) => {
				pointer.x = event.clientX;
				pointer.y = event.clientY;
				if (!scrollFrame && document.body.classList.contains('basalt-is-sorting'))
					scrollFrame = requestAnimationFrame(nudgeScroll);
			},
			{ passive: true },
		);
	}

	function wireNarrowScreen() {
		function onWidthChange() {
			model.narrow = narrowScreen.matches;
			model.draft = null;
			redraw();
		}
		if (narrowScreen.addEventListener) narrowScreen.addEventListener('change', onWidthChange);
		else if (narrowScreen.addListener) narrowScreen.addListener(onWidthChange);
	}

	/* Drawing: the board, its columns and cards, the table and the toolbar all come from state. */

	function redraw() {
		if (!model.ready) return;
		syncProjectButton();
		syncFigures();
		syncNotice();
		syncNarrowPicker();
		if (model.view === 'board') drawBoard();
		else drawTable();
		boardRoot.classList.toggle('is-compact', model.density === 'compact');
	}

	function drawBoard() {
		const cards = filteredIssues().sort(byRank);
		const shown = visibleColumns();
		const addColumn = model.narrow
			? ''
			: '<button type="button" class="pb-addcol" data-board-column-new title="Add column"><i class="bi bi-plus-lg" aria-hidden="true"></i><span class="visually-hidden">Add column</span></button>';
		const markup =
			model.grouping === 'none'
				? flatBoardMarkup(cards, shown, addColumn)
				: laneBoardMarkup(cards, shown, addColumn);
		lifted = null;
		ui.body.innerHTML = markup;
		ui.body.setAttribute('aria-busy', 'false');
		ui.body.classList.toggle('is-grouped', model.grouping !== 'none');

		for (const list of pickAll('[data-basalt-sortable]', ui.body)) {
			if (window.Basalt.sortable) window.Basalt.sortable(list);
		}

		/* The sortable points each handle at its own help text; the card's
       summary goes first so it is heard straight after the title. */
		for (const card of pickAll('.pb-card', ui.body)) {
			const handle = pick('.pb-card-main', card);
			const help = handle.getAttribute('aria-describedby');
			handle.setAttribute(
				'aria-describedby',
				[`pb-d-${card.getAttribute('data-key')}`, help].filter(Boolean).join(' '),
			);
		}

		paintAvatars(ui.body);
		if (model.draft) {
			const box = pick('[data-quick-input]', ui.body);
			if (box) box.focus();
			else model.draft = null;
		}
		syncEdgeShadows();
	}

	function flatBoardMarkup(cards, shown, addColumn) {
		const sections = shown.map((column) => {
			const headingId = `pb-col-${column.id}`;
			const head = headMarkup(column, projectColumns().indexOf(column), headingId);
			if (column.collapsed && !model.narrow) {
				return `<section class="${columnClass(column)}" aria-label="${htmlSafe(column.name)}, folded">${head}</section>`;
			}
			const stack = stackMarkup(
				column,
				null,
				cards.filter((card) => card.status === column.id),
			);
			return `<section class="${columnClass(column, 'basalt-board-col')}" aria-labelledby="${headingId}" data-col="${htmlSafe(column.id)}">${head}${stack}</section>`;
		});
		return `<div class="pb-row">${sections.join('')}${addColumn}</div>`;
	}

	function laneBoardMarkup(cards, shown, addColumn) {
		const heads = shown.map(
			(column) =>
				`<div class="${columnClass(column, 'pb-col-as-head')}" data-col="${htmlSafe(column.id)}">${headMarkup(column, projectColumns().indexOf(column), `pb-col-${column.id}`)}</div>`,
		);
		const lanes = swimlanes(cards).map((lane) => {
			const inLane = cards.filter(lane.match);
			const folded = model.closedLanes.has(`${model.grouping}:${lane.key}`);
			const laneId = `pb-lane-${htmlSafe(lane.key)}`;
			const lead = lane.person !== undefined ? avatarMarkup(lane.person, 'sm') : urgencyBadge(lane.urgency.id);
			const toggle = `<button type="button" class="pb-lane-toggle" id="${laneId}" aria-expanded="${String(!folded)}" data-lane-toggle="${htmlSafe(lane.key)}"><i class="bi bi-chevron-down pb-lane-chev" aria-hidden="true"></i>${lead}<span class="pb-lane-name">${htmlSafe(lane.name)}</span><span class="pb-lane-count">${countWord(inLane.length, 'issue')}</span></button>`;
			let row = '';
			if (!folded) {
				const cells = shown.map((column) => {
					if (column.collapsed && !model.narrow)
						return `<div class="${columnClass(column, 'pb-cell')}" aria-hidden="true"></div>`;
					return `<div class="${columnClass(column, 'pb-cell basalt-board-col')}" data-col="${htmlSafe(column.id)}">${stackMarkup(
						column,
						lane,
						inLane.filter((card) => card.status === column.id),
					)}</div>`;
				});
				const spacer = addColumn ? '<span class="pb-addcol pb-addcol-spacer" aria-hidden="true"></span>' : '';
				row = `<div class="pb-row">${cells.join('')}${spacer}</div>`;
			}
			return `<section class="pb-lane${folded ? ' is-folded' : ''}" aria-labelledby="${laneId}"><h2 class="pb-lane-title">${toggle}</h2>${row}</section>`;
		});
		return `<div class="pb-row pb-row-heads">${heads.join('')}${addColumn}</div>${lanes.join('')}`;
	}

	/** The lanes for the current grouping, each with a test for its cards. */
	function swimlanes(cards) {
		if (model.grouping === 'priority') {
			return Object.entries(URGENCY).map(([id, level]) => ({
				key: id,
				name: `${level.label} priority`,
				urgency: urgencyOf(id),
				match: (card) => card.priority === id,
			}));
		}
		const seen = [];
		for (const card of cards) {
			const owner = card.assignee || 'none';
			if (!seen.includes(owner)) seen.push(owner);
		}
		const teamOrder = [...model.team.map((member) => member.id), 'none'];
		seen.sort((a, b) => {
			if (a === model.selfId) return -1;
			if (b === model.selfId) return 1;
			return teamOrder.indexOf(a) - teamOrder.indexOf(b);
		});
		return seen.map((owner) => {
			const member = personById(owner);
			let name = 'Not assigned';
			if (member) name = member.id === model.selfId ? `${member.name} (you)` : member.name;
			return { key: owner, name, person: member, match: (card) => (card.assignee || 'none') === owner };
		});
	}

	/** Phones show the one status picked in the status bar; wider screens show all. */
	function visibleColumns() {
		const all = projectColumns();
		if (!model.narrow) return all;
		if (!all.some((column) => column.id === model.narrowStatus)) {
			const fallback =
				all.find((column) => !column.done && !column.collapsed && tallyIn(column.id)) ||
				all.find((column) => !column.done) ||
				all[0];
			model.narrowStatus = fallback ? fallback.id : '';
		}
		return all.filter((column) => column.id === model.narrowStatus);
	}

	function columnClass(column, extra) {
		const classes = ['pb-col', `pb-c${seriesIndex(column.color)}`];
		if (extra) classes.push(extra);
		if (column.collapsed && !model.narrow) classes.push('is-collapsed');
		if (column.limit > 0 && tallyIn(column.id) > column.limit) classes.push('is-over-limit');
		if (column.done) classes.push('is-done-col');
		return classes.join(' ');
	}

	function headMarkup(column, position, headingId) {
		const total = tallyIn(column.id);
		const id = htmlSafe(column.id);
		const name = htmlSafe(column.name);
		if (column.collapsed && !model.narrow) {
			return `<button type="button" class="pb-col-expand" data-col-expand="${id}" aria-expanded="false" title="Show ${name}"><i class="bi bi-chevron-bar-right" aria-hidden="true"></i><span class="pb-col-vname">${name}</span><span class="pb-col-vcount">${total}<span class="visually-hidden"> ${total === 1 ? 'issue' : 'issues'}, folded. Show the column.</span></span></button>`;
		}
		const count = projectColumns().length;
		const hook = (action) => `data-col-action="${action}" data-col="${id}"`;
		const entries = [
			menuEntry(hook('edit'), 'bi-pencil', 'Edit column'),
			menuEntry(hook('left'), 'bi-arrow-left', 'Move left', { disabled: position === 0 }),
			menuEntry(hook('right'), 'bi-arrow-right', 'Move right', { disabled: position === count - 1 }),
			menuEntry(hook('sort'), 'bi-sort-down', 'Sort by priority', { disabled: total < 2 }),
			model.narrow ? '' : menuEntry(hook('collapse'), 'bi-chevron-bar-left', 'Fold column'),
			'<li><hr class="dropdown-divider"></li>',
			menuEntry(hook('delete'), 'bi-trash3', 'Delete column', { danger: true, disabled: count < 2 }),
		];
		const doneMark = column.done
			? '<i class="bi bi-check2-circle pb-col-done" title="Counts as done" aria-hidden="true"></i><span class="visually-hidden">, counts as done</span>'
			: '';
		const title = `<h2 class="pb-col-title" id="${headingId}"><span class="pb-dot pb-c${seriesIndex(column.color)}" aria-hidden="true"></span><span class="pb-col-name">${name}</span>${doneMark}</h2>`;
		const menu = `<div class="dropdown pb-col-menu"><button type="button" class="btn btn-icon btn-sm" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="${name} column options" data-col-menu="${id}"><i class="bi bi-three-dots" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end pb-menu">${entries.join('')}</ul></div>`;
		return `<header class="pb-col-head">${title}${tallyMarkup(column)}${menu}</header>`;
	}

	function tallyMarkup(column) {
		const total = tallyIn(column.id);
		const capped = column.limit > 0;
		const over = capped && total > column.limit;
		let spoken = countWord(total, 'issue');
		if (capped) spoken += `${over ? ', over the limit of ' : ', limit '}${column.limit}`;
		const icon = over ? '<i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>' : '';
		return `<span class="pb-col-count${over ? ' is-over' : ''}" data-cols="${htmlSafe(column.id)}"${over ? ' title="Over the limit"' : ''}>${icon}<span aria-hidden="true">${total}${capped ? ` / ${column.limit}` : ''}</span><span class="visually-hidden">${spoken}</span></span>`;
	}

	/** One list of cards (a column, or a lane's share of it) and its add button or open quick-add box. */
	function stackMarkup(column, lane, cards) {
		const laneKey = lane ? lane.key : '';
		const laneName = lane ? lane.name : '';
		const name = htmlSafe(column.name);
		const drafting = model.draft && model.draft.status === column.id && model.draft.lane === laneKey;
		const foot = drafting
			? `<form class="pb-quick" data-quick-form novalidate><label class="visually-hidden" for="pb-quick-input">New issue in ${name}</label><textarea class="form-control pb-quick-input" id="pb-quick-input" rows="2" maxlength="140" placeholder="What needs doing?" data-quick-input></textarea><div class="pb-quick-foot"><span class="pb-quick-hint">Enter to add, Esc to close</span><button type="submit" class="btn btn-primary btn-sm">Add</button></div></form>`
			: `<button type="button" class="pb-quick-open" data-quick-open="${htmlSafe(column.id)}" data-lane="${htmlSafe(laneKey)}"><i class="bi bi-plus-lg" aria-hidden="true"></i>Add issue<span class="visually-hidden"> to ${name}${laneName ? `, ${htmlSafe(laneName)}` : ''}</span></button>`;
		const label = laneName ? `${column.name}, ${laneName}` : column.name;
		return `<ol class="basalt-sortable pb-list" data-basalt-sortable data-basalt-sortable-group="${htmlSafe(`pb-${lane ? lane.key : 'all'}`)}" data-status="${htmlSafe(column.id)}" data-lane="${htmlSafe(laneKey)}" aria-label="${htmlSafe(label)}">${cards.map(cardMarkup).join('')}</ol>${foot}`;
	}

	function cardMarkup(item) {
		const finished = isFinished(item);
		const owner = personById(item.assignee);
		const key = htmlSafe(item.key);
		const facts = [];
		if (item.due) {
			const left = dayGap(item.due);
			let tone = '';
			if (!finished && left < 0) tone = ' pb-due-late';
			else if (!finished && left === 0) tone = ' pb-due-today';
			facts.push(
				`<span class="pb-due${tone}"><i class="bi bi-calendar-event" aria-hidden="true"></i>${dueText(item.due)}</span>`,
			);
		}
		if (item.subtasks.length) {
			const ticked = doneSteps(item);
			facts.push(
				`<span class="pb-meta${ticked === item.subtasks.length ? ' pb-meta-all' : ''}"><i class="bi bi-list-check" aria-hidden="true"></i>${ticked}/${item.subtasks.length}</span>`,
			);
		}
		const comments = commentCount(item);
		if (comments)
			facts.push(`<span class="pb-meta"><i class="bi bi-chat" aria-hidden="true"></i>${comments}</span>`);

		const points = item.points ? `<span class="pb-points" title="Story points">${item.points}</span>` : '';
		const foot = `<span class="pb-card-foot"><span class="pb-card-id">${kindBadge(item.type)}<span class="pb-card-key">${key}</span></span><span class="pb-card-end">${urgencyBadge(item.priority)}${points}<span title="${htmlSafe(owner ? owner.name : 'Not assigned')}">${avatarMarkup(owner)}</span></span></span>`;
		const face = [
			`<span class="pb-card-title">${htmlSafe(item.title)}</span>`,
			item.labels.length ? `<span class="pb-card-labels">${item.labels.map(labelChip).join('')}</span>` : '',
			facts.length ? `<span class="pb-card-meta">${facts.join('')}</span>` : '',
			foot,
		].join('');

		const statuses = projectColumns().map((column) => {
			const here = column.id === item.status;
			return `<li><button type="button" class="dropdown-item pb-move${here ? ' active' : ''}" data-card-move="${htmlSafe(column.id)}"${here ? ' aria-current="true"' : ''}><span class="pb-dot pb-c${seriesIndex(column.color)}" aria-hidden="true"></span>${htmlSafe(column.name)}${here ? CHECK_MARK : ''}</button></li>`;
		});
		const entries = [
			'<li><h3 class="dropdown-header">Move to</h3></li>',
			...statuses,
			'<li><hr class="dropdown-divider"></li>',
			menuEntry('data-card-action="top"', 'bi-arrow-bar-up', 'Top of the column'),
			menuEntry('data-card-action="open"', 'bi-layout-sidebar-reverse', 'Open'),
			menuEntry('data-card-action="delete"', 'bi-trash3', 'Delete', { danger: true }),
		];
		const menu = `<div class="dropdown pb-card-menu"><button type="button" class="btn btn-icon btn-sm pb-card-more" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="Actions for ${key}"><i class="bi bi-three-dots" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end pb-menu">${entries.join('')}</ul></div>`;
		const summary = `<span class="visually-hidden" id="${htmlSafe(`pb-d-${item.key}`)}">${htmlSafe(spokenSummary(item))}</span>`;
		const handle = `<button type="button" class="basalt-sortable-handle pb-card-main" aria-haspopup="dialog" aria-label="${htmlSafe(`${item.key} ${item.title}`)}" data-card-open>${face}</button>`;
		return `<li class="basalt-sortable-item pb-card${finished ? ' is-done' : ''}" data-key="${key}">${handle}${summary}${menu}</li>`;
	}

	/** What a screen reader hears after a card's key and title. */
	function spokenSummary(item) {
		const owner = personById(item.assignee);
		const parts = [
			kindOf(item.type).label,
			`${urgencyOf(item.priority).label} priority`,
			owner ? `assigned to ${owner.name}` : 'not assigned',
		];
		if (item.due)
			parts.push(
				`${dayGap(item.due) < 0 && !isFinished(item) ? 'overdue, was due ' : 'due '}${dueText(item.due)}`,
			);
		if (item.labels.length) parts.push(`labels ${item.labels.map((id) => labelById(id)?.name).join(', ')}`);
		if (item.subtasks.length)
			parts.push(`${doneSteps(item)} of ${countWord(item.subtasks.length, 'subtask')} done`);
		const comments = commentCount(item);
		if (comments) parts.push(countWord(comments, 'comment'));
		if (item.points) parts.push(countWord(item.points, 'point'));
		return `${parts.join(', ')}.`;
	}

	/** Brings column counts and over-limit warnings up to date after a drag. */
	function refreshTallies() {
		for (const column of projectColumns()) {
			const over = column.limit > 0 && tallyIn(column.id) > column.limit;
			for (const host of pickAll(`[data-col="${column.id}"]`, ui.body))
				host.classList.toggle('is-over-limit', over);
			for (const tally of pickAll(`[data-cols="${column.id}"]`, ui.body)) tally.outerHTML = tallyMarkup(column);
		}
	}

	/** The list view: the same issues as a table, one body per status. */
	function drawTable() {
		const cards = filteredIssues().sort(byRank);
		const groups = projectColumns().map((column) => {
			const series = seriesIndex(column.color);
			const inColumn = cards.filter((card) => card.status === column.id);
			const rows = inColumn.length
				? inColumn.map(tableRowMarkup).join('')
				: `<tr><td colspan="7" class="pb-table-none">Nothing here${filtering() ? ' that matches' : ''}.</td></tr>`;
			return `<tbody class="pb-c${series}"><tr class="pb-table-group"><th colspan="7" scope="colgroup"><span class="pb-dot pb-c${series}" aria-hidden="true"></span>${htmlSafe(column.name)}<span class="pb-table-n">${inColumn.length}</span></th></tr>${rows}</tbody>`;
		});
		const headings = ['Key', 'Issue', 'Assignee', 'Priority', 'Points', 'Due']
			.map((text) => `<th scope="col"${text === 'Points' ? ' class="pb-table-pts"' : ''}>${text}</th>`)
			.join('');
		const head = `<thead><tr>${headings}<th scope="col"><span class="visually-hidden">Subtasks</span></th></tr></thead>`;
		ui.table.innerHTML = `<div class="card basalt-box pb-table-card"><div class="table-responsive"><table class="table pb-table"><caption class="visually-hidden">Issues in ${htmlSafe(currentProject().name)}, by status</caption>${head}${groups.join('')}</table></div></div>`;
		paintAvatars(ui.table);
	}

	function tableRowMarkup(item) {
		const owner = personById(item.assignee);
		const level = urgencyOf(item.priority);
		const finished = isFinished(item);
		const late = item.due && !finished && dayGap(item.due) < 0;
		const labels = item.labels.length
			? `<span class="pb-card-labels">${item.labels.map(labelChip).join('')}</span>`
			: '';
		const due = item.due
			? `<span class="pb-due${late ? ' pb-due-late' : ''}">${dueText(item.due)}${late ? '<span class="visually-hidden">, overdue</span>' : ''}</span>`
			: '';
		const steps = item.subtasks.length
			? `<span class="pb-meta"><i class="bi bi-list-check" aria-hidden="true"></i>${doneSteps(item)}/${item.subtasks.length}</span>`
			: '';
		const cells = [
			`<td class="pb-table-key">${kindBadge(item.type)}<span>${htmlSafe(item.key)}</span></td>`,
			`<td class="pb-table-title"><button type="button" class="pb-table-open" data-list-open="${htmlSafe(item.key)}" aria-haspopup="dialog">${htmlSafe(item.title)}</button>${labels}</td>`,
			`<td class="pb-table-who"><span class="pb-table-person">${avatarMarkup(owner)}<span>${htmlSafe(owner ? owner.name : 'Not assigned')}</span></span></td>`,
			`<td class="pb-table-prio"><span class="pb-table-person">${urgencyBadge(level.id)}<span>${level.label}</span></span></td>`,
			`<td class="pb-table-pts">${item.points || ''}</td>`,
			`<td class="pb-table-due">${due}</td>`,
			`<td class="pb-table-more">${steps}</td>`,
		];
		return `<tr class="${finished ? 'is-done' : ''}">${cells.join('')}</tr>`;
	}

	/* The project switcher is the shared command menu, filled from state. */
	function drawProjectPicker() {
		const options = model.projects.map((project) => {
			const id = htmlSafe(project.id);
			return `<div class="basalt-command-item" role="option" id="pb-proj-${id}" aria-selected="false" data-value="${id}" data-keywords="${htmlSafe(project.key)}"><span class="basalt-command-icon pb-c${seriesIndex(project.color)} pb-project-tile" aria-hidden="true">${htmlSafe(project.name.charAt(0))}</span><span class="basalt-command-text"><span class="basalt-command-title">${htmlSafe(project.name)}</span><span class="basalt-command-sub" data-project-sub="${id}"></span></span></div>`;
		});
		const search =
			'<div class="basalt-command-search"><i class="bi bi-search" aria-hidden="true"></i><input type="text" class="basalt-command-input" role="combobox" aria-expanded="true" aria-controls="pb-project-list" aria-autocomplete="list" aria-label="Find a project" placeholder="Find a project" autocomplete="off" spellcheck="false"></div>';
		const list = `<div class="basalt-command-list" id="pb-project-list" role="listbox" aria-label="Projects"><div class="basalt-command-group" role="group" aria-labelledby="pb-projects-heading"><div class="basalt-command-heading" id="pb-projects-heading">Projects</div>${options.join('')}</div></div>`;
		const empty =
			'<div class="basalt-command-empty" hidden><i class="bi bi-search" aria-hidden="true"></i><p>No project matches "<span data-basalt-command-term></span>".</p></div>';
		ui.projectMenu.innerHTML = `<div class="basalt-command basalt-command-as-menu" data-board-command>${search}${list}${empty}</div>`;
		const command = pick('[data-board-command]', ui.projectMenu);
		command.setAttribute('data-basalt-command', '');
		if (window.Basalt.command) window.Basalt.command(command);
	}

	function syncProjectButton() {
		const project = currentProject();
		pick('[data-board-project-name]', boardRoot).textContent = project.name;
		const mark = pick('[data-board-project-mark]', boardRoot);
		mark.className = `pb-project-mark pb-project-tile pb-c${seriesIndex(project.color)}`;
		mark.textContent = project.name.charAt(0);
		ui.projectButton.setAttribute('aria-label', `Project: ${project.name}, ${project.key}. Switch project`);
		for (const other of model.projects) {
			const line = pick(`[data-project-sub="${other.id}"]`, ui.projectMenu);
			if (!line) continue;
			const open = model.issues.filter(
				(record) =>
					record.project === other.id && !other.columns.find((column) => column.id === record.status)?.done,
			).length;
			line.textContent = `${other.key} · ${countWord(open, 'open issue')}${other.id === model.projectId ? ' · showing now' : ''}`;
		}
	}

	function drawPeopleFilter() {
		ui.people.innerHTML = model.team
			.map((member) => {
				const pressed = model.byPerson.has(member.id);
				return `<button type="button" class="pb-people-btn${pressed ? ' is-on' : ''}" aria-pressed="${String(pressed)}" data-who="${htmlSafe(member.id)}" title="${htmlSafe(member.name)}">${avatarMarkup(member, 'sm')}<span class="visually-hidden">${htmlSafe(member.name)}</span></button>`;
			})
			.join('');
		paintAvatars(ui.people);
	}

	/* The three filter menus use the shared multi-select, which reads its
     options once, so they are drawn again whenever the labels change. */
	function drawFilterMenus() {
		const menus = [
			{
				key: 'labels',
				title: 'Labels',
				glyph: 'bi-tag',
				chosen: model.byLabel,
				options: model.labelSet.map((tag) => ({
					id: tag.id,
					name: tag.name,
					lead: `<span class="pb-dot pb-c${seriesIndex(tag.color)}" aria-hidden="true"></span>`,
				})),
			},
			{
				key: 'priority',
				title: 'Priority',
				glyph: 'bi-flag',
				chosen: model.byUrgency,
				options: Object.entries(URGENCY).map(([id, level]) => ({
					id,
					name: level.label,
					lead: urgencyBadge(id),
				})),
			},
			{
				key: 'type',
				title: 'Type',
				glyph: 'bi-ui-checks-grid',
				chosen: model.byKind,
				options: Object.entries(KINDS).map(([id, kind]) => ({ id, name: kind.label, lead: kindBadge(id) })),
			},
		];
		ui.filterMenus.innerHTML = menus.map(filterMenuMarkup).join('');
		if (window.Basalt.menus) window.Basalt.menus(ui.filterMenus);
	}

	function filterMenuMarkup({ key, title, glyph, options, chosen }) {
		const rows = options.map((option, index) => {
			const inputId = `pb-f-${key}-${index}`;
			return `<li><label class="dropdown-item basalt-dd-multi-option" for="${inputId}"><input class="form-check-input" type="checkbox" id="${inputId}" value="${htmlSafe(option.id)}"${chosen.has(option.id) ? ' checked' : ''}>${option.lead}<span>${htmlSafe(option.name)}</span></label></li>`;
		});
		const toggle = `<button type="button" class="btn btn-outline-secondary btn-sm dropdown-toggle" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false"><i class="bi ${glyph}" aria-hidden="true"></i>${title}<span class="basalt-dd-multi-count" data-basalt-dd-count${chosen.size ? '' : ' hidden'}>${chosen.size}</span></button>`;
		const foot =
			'<div class="basalt-dd-multi-foot"><button type="button" class="btn btn-link btn-sm" data-basalt-dd-clear>Clear</button><button type="button" class="btn btn-primary btn-sm" data-basalt-dd-done>Done</button></div>';
		return `<div class="dropdown basalt-dd-multi pb-filter" data-basalt-dd-multi data-filter="${key}">${toggle}<div class="dropdown-menu basalt-dd-multi-menu"><ul class="basalt-dd-multi-list">${rows.join('')}</ul>${foot}</div></div>`;
	}

	function syncNarrowPicker() {
		ui.narrowBar.hidden = !model.narrow || model.view !== 'board';
		if (!model.narrow) return;
		visibleColumns();
		ui.narrowPicker.innerHTML = projectColumns()
			.map((column) => {
				const cap = column.limit > 0 ? ` of ${column.limit}` : '';
				return `<option value="${htmlSafe(column.id)}" data-dot="series-${seriesIndex(column.color)}"${column.id === model.narrowStatus ? ' selected' : ''}>${htmlSafe(column.name)} (${tallyIn(column.id)}${cap})</option>`;
			})
			.join('');
		refreshSelect(ui.narrowPicker);
	}

	function syncFigures() {
		const all = issuesHere();
		const open = all.filter((item) => !isFinished(item));
		writeFigure('open', open.length);
		writeFigure('overdue', open.filter((item) => item.due && dayGap(item.due) < 0).length);
		writeFigure('points', `${pointsIn(all.filter((item) => isFinished(item)))} / ${pointsIn(all)}`);
	}

	function writeFigure(name, value) {
		const figure = pick(`[data-board-fig="${name}"]`, boardRoot);
		if (figure) figure.textContent = String(value);
	}

	function pointsIn(list) {
		return list.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
	}

	/* An empty project, or filters that hide everything, replace the board
     with a short note and the way out of it. */
	function syncNotice() {
		const total = issuesHere().length;
		const showing = filteredIssues().length;
		let markup = '';
		let hideBoard = false;
		if (!total) {
			markup = notePanel({
				icon: 'bi-columns-gap',
				title: 'This board is empty',
				text: 'Create the first issue, or use "Add issue" at the foot of any column. Cards can be dragged between columns once they are here.',
				actions:
					'<button type="button" class="btn btn-sm btn-primary" data-board-create><i class="bi bi-plus-lg" aria-hidden="true"></i>Create issue</button>',
			});
		} else if (!showing) {
			hideBoard = true;
			const where = htmlSafe(currentProject().name);
			markup = notePanel({
				icon: 'bi-search',
				title: 'No issues match',
				text: model.search
					? `Nothing in ${where} matches “${htmlSafe(model.search)}” with the filters you have on.`
					: `No issue in ${where} matches the filters you have on.`,
				actions:
					'<button type="button" class="btn btn-sm btn-outline-secondary" data-board-clear-all>Clear filters</button>',
			});
		}
		ui.notice.innerHTML = markup;
		ui.notice.hidden = !markup;
		ui.wrap.hidden = hideBoard || model.view !== 'board';
		ui.table.hidden = hideBoard || model.view !== 'list';
		ui.clearButton.hidden = !filtering();
	}

	/* The board scrolls sideways by itself; these keep its edge shading and drag auto-scroll right. */

	/** Shades whichever edge of the scroller has more board beyond it. */
	function syncEdgeShadows() {
		const { scrollLeft, scrollWidth, clientWidth } = ui.scroller;
		ui.wrap.classList.toggle('has-before', scrollLeft > 2);
		ui.wrap.classList.toggle('has-after', scrollLeft < scrollWidth - clientWidth - 2);
	}

	/* The shared sortable never scrolls its container, so while a card is
     dragged near an edge the page scrolls for it. */
	function nudgeScroll() {
		scrollFrame = 0;
		if (!document.body.classList.contains('basalt-is-sorting')) return;
		const box = ui.scroller.getBoundingClientRect();
		const reach = 72;
		let sideways = 0;
		if (pointer.x < box.left + reach) sideways = -Math.ceil((box.left + reach - pointer.x) / 6);
		else if (pointer.x > box.right - reach) sideways = Math.ceil((pointer.x - (box.right - reach)) / 6);
		let downward = 0;
		if (pointer.y < 80) downward = -Math.ceil((80 - pointer.y) / 6);
		else if (pointer.y > window.innerHeight - 60) downward = Math.ceil((pointer.y - (window.innerHeight - 60)) / 6);
		if (sideways) ui.scroller.scrollLeft += sideways;
		if (downward) window.scrollBy(0, downward);
		if (sideways || downward) scrollFrame = requestAnimationFrame(nudgeScroll);
	}

	/* Moving issues between places and statuses, always with an Undo. */

	/** Changes an issue's status and place, offering Undo. */
	function relocate(item, status, rank, options = {}) {
		const was = { status: item.status, rank: item.rank, events: item.activity.length };
		if (was.status === status && was.rank === rank) return;
		const origin = columnById(item.status);
		const target = columnById(status);
		item.status = status;
		item.rank = rank;
		if (origin && target && origin.id !== target.id)
			recordEvent(item, `moved this from ${origin.name} to ${target.name}`);
		function rollBack() {
			item.status = was.status;
			item.rank = was.rank;
			item.activity.length = was.events;
		}
		sendChange(backend.postMove(item.key, status, rank), `move ${item.key}`, rollBack);
		if (options.rerender) {
			redraw();
		} else {
			refreshTallies();
			syncFigures();
			syncProjectButton();
			syncNarrowPicker();
		}
		if (model.openKey === item.key) fillDrawer();
		if (options.focus) focusIssue(item.key);

		const sameColumn = was.status === status;
		const warning = sameColumn ? '' : overLimitNote(status);
		const headline = `Moved ${item.key} ${sameColumn ? 'within' : 'to'} ${target.name}`;
		if (options.say) announce(`${headline}. ${warning}`);
		else if (warning) announce(warning);
		notify({
			tone: warning ? 'warning' : 'success',
			icon: warning ? 'bi-exclamation-triangle' : 'bi-arrow-left-right',
			title: headline,
			text: warning || item.title,
			duration: 7000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						rollBack();
						sendChange(backend.postMove(item.key, item.status, item.rank), 'undo the move');
						redraw();
						if (model.openKey === item.key) fillDrawer();
						focusIssue(item.key);
						announce(`Undone. ${item.key} is back in ${columnById(item.status)?.name}.`);
					},
				},
			],
		});
	}

	/** Moves an issue from a menu or the drawer, to the top or the foot of a column. */
	function sendTo(key, status, toTop) {
		const item = issueByKey(key);
		if (!item) return;
		let rank = item.status === status ? item.rank : highestRank(status, key) + 1000;
		if (toTop) rank = lowestRank(status, key) - 1000;
		if (model.narrow && status !== model.narrowStatus) model.narrowStatus = status;
		relocate(item, status, rank, { rerender: true, focus: true, say: true });
	}

	/* After a drag or a keyboard drop the card's new place is read from the
     page: its list gives the status and its neighbors the order. */
	function settleDrop(card, list, byKeyboard) {
		const item = card && issueByKey(card.getAttribute('data-key'));
		if (!item || !list) return false;
		const siblings = cardsOf(list);
		const index = siblings.indexOf(card);
		const above = index > 0 ? issueByKey(siblings[index - 1].getAttribute('data-key')) : null;
		const below = index < siblings.length - 1 ? issueByKey(siblings[index + 1].getAttribute('data-key')) : null;
		const status = list.getAttribute('data-status');
		/* A canceled lift, or a drop on the same spot, moves nothing. */
		const unchanged =
			status === item.status && (!above || above.rank < item.rank) && (!below || below.rank > item.rank);
		if (unchanged) return false;
		let rank = highestRank(status, item.key) + 1000;
		if (above && below) rank = (above.rank + below.rank) / 2;
		else if (above) rank = above.rank + 1000;
		else if (below) rank = below.rank - 1000;
		relocate(item, status, rank, { say: byKeyboard });
		syncDroppedCard(card, item);
		return true;
	}

	/* A dropped card stays where it landed, so its done look, its "Move to"
     menu and its spoken summary are updated in place. */
	function syncDroppedCard(card, item) {
		card.classList.toggle('is-done', isFinished(item));
		for (const button of pickAll('[data-card-move]', card)) {
			const here = button.getAttribute('data-card-move') === item.status;
			button.classList.toggle('active', here);
			if (here) button.setAttribute('aria-current', 'true');
			else button.removeAttribute('aria-current');
			const tick = pick('.bi-check2', button);
			if (here && !tick) button.insertAdjacentHTML('beforeend', CHECK_MARK);
			if (!here && tick) tick.remove();
		}
		const summary = document.getElementById(`pb-d-${item.key}`);
		if (summary) summary.textContent = spokenSummary(item);
	}

	function highestRank(status, skipKey) {
		return issuesHere()
			.filter((item) => item.status === status && item.key !== skipKey)
			.reduce((top, item) => Math.max(top, item.rank), 0);
	}

	function lowestRank(status, skipKey) {
		const ranks = issuesHere()
			.filter((item) => item.status === status && item.key !== skipKey)
			.map((item) => item.rank);
		return ranks.length ? Math.min(...ranks) : 1000;
	}

	/** A sentence for when a move pushes a column past its limit, else ''. */
	function overLimitNote(status) {
		const column = columnById(status);
		const total = tallyIn(status);
		if (!column || column.limit <= 0 || total <= column.limit) return '';
		return `${column.name} is over its limit: ${total} issues for a limit of ${column.limit}.`;
	}

	function recordEvent(item, text) {
		item.activity.push({ id: freshId('a'), kind: 'event', who: model.selfId, text, at: new Date().toISOString() });
	}

	function focusIssue(key) {
		requestAnimationFrame(() => {
			const target =
				pick(`.pb-card[data-key="${key}"] .pb-card-main`, ui.body) ||
				pick(`[data-list-open="${key}"]`, ui.table);
			if (!target) return;
			target.focus({ preventScroll: false });
			const card = target.closest('.pb-card');
			if (!card || motionReduced()) return;
			card.classList.remove('is-moved');
			void card.offsetWidth;
			card.classList.add('is-moved');
		});
	}

	/* Space lifts a card, Up and Down move it inside its column, Left and
     Right take it to the next status, Space or Enter sets it down and
     Escape sends it home. The shared sortable has keys of its own, but each
     of its lists tracks its own lifted card and loses it on a column
     change, so the board handles keys itself and leaves pointers to it. */

	function liftCard(card, handle) {
		lifted = { card, handle, home: card.parentElement, after: card.nextElementSibling };
		card.classList.add('is-grabbed');
		handle.setAttribute('aria-pressed', 'true');
		announce(
			`Picked up ${card.getAttribute('data-key')}. Position ${positionText(card)}. Arrow keys move it, Space puts it down, Escape cancels.`,
		);
	}

	function carry(key) {
		const { card, handle } = lifted;
		const from = card.parentElement;
		const peers = cardsOf(from);
		const index = peers.indexOf(card);
		let into = from;
		let anchor = null;
		if (key === 'ArrowUp' || key === 'ArrowDown') {
			const upward = key === 'ArrowUp';
			if (upward ? index === 0 : index === peers.length - 1) return;
			anchor = upward ? peers[index - 1] : peers[index + 1].nextElementSibling;
		} else {
			const lists = sameGroupLists(from);
			const next = lists.indexOf(from) + (key === 'ArrowRight' ? 1 : -1);
			if (next < 0 || next >= lists.length) {
				announce('No more columns that way.');
				return;
			}
			into = lists[next];
			anchor = cardsOf(into)[Math.min(index, cardsOf(into).length)] || null;
		}
		const moving = into === from ? cardsOf(from) : [...cardsOf(from), ...cardsOf(into)];
		slideFrom(moving, () => into.insertBefore(card, anchor));
		from.classList.toggle('is-empty', !cardsOf(from).length);
		into.classList.toggle('is-empty', false);
		handle.focus();
		card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
		let warning = '';
		if (into !== from) {
			const item = issueByKey(card.getAttribute('data-key'));
			const status = into.getAttribute('data-status');
			const column = columnById(status);
			const total = tallyIn(status) + (item.status === status ? 0 : 1);
			if (column && column.limit > 0 && total > column.limit)
				warning = ` ${column.name} would be over its limit of ${column.limit}.`;
		}
		announce(`${positionText(card)}.${warning}`);
	}

	function setDown(cancel) {
		if (!lifted) return;
		const { card, handle, home, after } = lifted;
		lifted = null;
		card.classList.remove('is-grabbed');
		handle.setAttribute('aria-pressed', 'false');
		if (!cancel) {
			if (!settleDrop(card, card.parentElement, true))
				announce(`Put down ${card.getAttribute('data-key')} where it was.`);
			return;
		}
		const from = card.parentElement;
		const moving = from === home ? cardsOf(from) : [...cardsOf(from), ...cardsOf(home)];
		slideFrom(moving, () => home.insertBefore(card, after && after.parentElement === home ? after : null));
		from.classList.toggle('is-empty', !cardsOf(from).length);
		home.classList.toggle('is-empty', !cardsOf(home).length);
		handle.focus();
		announce(`Canceled. ${card.getAttribute('data-key')} is back at position ${positionText(card)}.`);
	}

	function cardsOf(list) {
		return [...list.children].filter((child) => child.classList.contains('pb-card'));
	}

	function sameGroupLists(list) {
		const group = list.getAttribute('data-basalt-sortable-group');
		return pickAll('.pb-list', ui.body).filter(
			(other) => other.getAttribute('data-basalt-sortable-group') === group,
		);
	}

	function positionText(card) {
		const list = card.parentElement;
		const cards = cardsOf(list);
		return `${cards.indexOf(card) + 1} of ${cards.length} in ${list.getAttribute('aria-label')}`;
	}

	/** Runs a DOM change, then slides each node from where it was to where it is. */
	function slideFrom(movers, change) {
		const startBoxes = new Map(movers.map((mover) => [mover, mover.getBoundingClientRect()]));
		change();
		if (motionReduced()) return;
		for (const [mover, startBox] of startBoxes) {
			const endBox = mover.getBoundingClientRect();
			const dx = startBox.left - endBox.left;
			const dy = startBox.top - endBox.top;
			if (dx || dy)
				mover.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], {
					duration: 180,
					easing: 'cubic-bezier(.2,.7,.3,1)',
				});
		}
	}

	/* Issues come and go here; both directions offer Undo. */

	/** Adds an issue to the current project, numbered from its next key. */
	function createIssue(fields) {
		const project = currentProject();
		const item = {
			key: `${project.key}-${project.next}`,
			project: project.id,
			type: 'task',
			status: projectColumns()[0].id,
			priority: 'medium',
			assignee: null,
			reporter: model.selfId,
			points: 0,
			due: null,
			labels: [],
			title: '',
			description: '',
			subtasks: [],
			activity: [],
			created: new Date().toISOString(),
			...fields,
		};
		project.next += 1;
		item.rank = highestRank(item.status) + 1000;
		recordEvent(item, 'created this issue');
		model.issues.push(item);
		sendChange(backend.postIssue(item), `create ${item.key}`, () => {
			model.issues = model.issues.filter((other) => other !== item);
		});
		return item;
	}

	function discardIssue(key) {
		const item = issueByKey(key);
		if (!item) return;
		const index = model.issues.indexOf(item);
		/* Focus moves on to the neighboring card in the same column. */
		const card = pick(`.pb-card[data-key="${key}"]`, ui.body);
		const neighbor = card && (card.nextElementSibling || card.previousElementSibling);
		const neighborKey = neighbor ? neighbor.getAttribute('data-key') : null;
		model.issues.splice(index, 1);
		function rollBack() {
			model.issues.splice(index, 0, item);
		}
		sendChange(backend.deleteIssue(key), `delete ${key}`, rollBack);
		if (model.openKey === key) {
			model.openKey = null;
			drawerPanel().hide();
		}
		redraw();
		if (neighborKey) focusIssue(neighborKey);
		else pick(`[data-quick-open="${item.status}"]`, ui.body)?.focus();
		announce(`Deleted ${key}.`);
		notify({
			tone: 'info',
			icon: 'bi-trash3',
			title: `Deleted ${key}`,
			text: item.title,
			duration: 8000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						rollBack();
						sendChange(backend.postIssue(item), `restore ${key}`);
						redraw();
						focusIssue(key);
						announce(`${key} is back.`);
					},
				},
			],
		});
	}

	/* Quick add at the foot of a column. In a lane the new issue takes the
     lane's assignee or priority, and "Only my issues" makes it yours. */
	function submitDraft(form) {
		const box = pick('[data-quick-input]', form);
		const title = tidy(box.value);
		if (!title) {
			closeDraft(true);
			return;
		}
		const { status, lane } = model.draft;
		const fields = { title, status };
		if (model.grouping === 'assignee' && lane) fields.assignee = lane === 'none' ? null : lane;
		if (model.grouping === 'priority' && lane) fields.priority = lane;
		if (model.onlyMine) fields.assignee = model.selfId;
		const item = createIssue(fields);
		redraw();
		announce(`Added ${item.key} to ${columnById(status).name}. Type the next one, or press Escape.`);
		if (!passesFilters(item))
			notify({ tone: 'info', title: `Added ${item.key}`, text: 'It is hidden by the filters you have on.' });
	}

	function closeDraft(refocus) {
		const draft = model.draft;
		model.draft = null;
		drawBoard();
		if (refocus && draft) pick(`[data-quick-open="${draft.status}"][data-lane="${draft.lane}"]`, ui.body)?.focus();
	}

	/* Labels are typed by name; a name nobody has used yet becomes a label. */
	function resolveLabels(names) {
		return names.map((typed) => {
			const name = typed.trim();
			const known = model.labelSet.find((tag) => tag.name.toLowerCase() === name.toLowerCase());
			if (known) return known.id;
			let id =
				name
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/^-|-$/g, '') || freshId('l');
			if (labelById(id)) id = freshId('l');
			model.labelSet.push({ id, name, color: (model.labelSet.length % 8) + 1 });
			drawFilterMenus();
			return id;
		});
	}

	/** Offers every label not already chosen as a one-click button. */
	function offerLabels(container, chosenNames) {
		const taken = new Set(chosenNames.map((name) => name.toLowerCase()));
		container.innerHTML = model.labelSet
			.filter((tag) => !taken.has(tag.name.toLowerCase()))
			.map(
				(tag) =>
					`<button type="button" class="pb-label-pick" data-pick-label="${htmlSafe(tag.name)}"><span class="pb-dot pb-c${seriesIndex(tag.color)}" aria-hidden="true"></span>${htmlSafe(tag.name)}<span class="visually-hidden">, add this label</span></button>`,
			)
			.join('');
	}

	/* The issue drawer: every field saves itself as soon as it changes. */

	function showIssue(key) {
		if (!issueByKey(key)) return;
		model.openKey = key;
		drawerReturnKey = key;
		fillDrawer();
		drawerPanel().show();
	}

	/** Writes the open issue into every drawer field, leaving alone the one being typed in. */
	function fillDrawer() {
		const item = drawerIssue();
		if (!item) return;
		drawerSyncing = true;
		const kind = kindOf(item.type);
		const badge = pick('[data-sheet-type-icon]', ui.drawer);
		badge.className = `pb-type pb-type-${kind.id}`;
		badge.innerHTML = `<i class="bi ${kind.glyph}"></i>`;
		pick('[data-sheet-key]', ui.drawer).textContent = item.key;
		pick('[data-sheet-heading]', ui.drawer).textContent = `${item.key} ${item.title}`;
		pick('[data-sheet-copy]', ui.drawer).setAttribute('data-basalt-copy', item.key);
		if (document.activeElement !== panel.title) {
			panel.title.value = item.title;
			fitTitle();
		}
		panel.title.classList.remove('is-invalid');
		fillStatusSelect(panel.status, item.status);
		panel.assignee.value = item.assignee || '';
		panel.reporter.value = item.reporter || model.selfId;
		panel.priority.value = item.priority;
		panel.type.value = item.type;
		panel.points.value = item.points || 0;
		panel.due.value = item.due || '';
		if (document.activeElement !== panel.description) panel.description.value = item.description || '';
		const names = item.labels.map((id) => labelById(id)?.name).filter(Boolean);
		panel.tags.basaltTags?.set(names);
		offerLabels(panel.suggestions, names);
		drawSubtasks(item);
		drawActivity(item);
		const reporter = personById(item.reporter);
		pick('[data-sheet-meta]', ui.drawer).textContent =
			`Reported by ${reporter ? reporter.name : 'someone'}${item.created ? `, ${timeAgo(item.created)}` : ''}`;
		drawerSyncing = false;
	}

	function fitTitle() {
		panel.title.style.height = 'auto';
		panel.title.style.height = `${panel.title.scrollHeight + 2}px`;
	}

	function drawSubtasks(item) {
		const total = item.subtasks.length;
		const ticked = doneSteps(item);
		const percent = total ? Math.round((ticked / total) * 100) : 0;
		pick('[data-sheet-subs-count]', ui.drawer).textContent = total ? `${ticked} of ${total} done` : 'None yet';
		const bar = pick('[data-sheet-subs-bar]', ui.drawer);
		bar.hidden = !total;
		bar.setAttribute('aria-valuenow', String(percent));
		pick('[data-sheet-subs-fill]', ui.drawer).style.width = `${percent}%`;
		panel.subtasks.innerHTML = item.subtasks
			.map((step, index) => {
				const boxId = `pb-sub-${index}`;
				return `<li class="pb-sub${step.done ? ' is-done' : ''}" data-sub="${index}"><input class="form-check-input" type="checkbox" id="${boxId}"${step.done ? ' checked' : ''} data-sub-check><label class="pb-sub-text" for="${boxId}">${htmlSafe(step.title)}</label><button type="button" class="btn btn-icon btn-sm pb-sub-del" data-sub-del aria-label="Remove subtask: ${htmlSafe(step.title)}"><i class="bi bi-x-lg" aria-hidden="true"></i></button></li>`;
			})
			.join('');
	}

	/** The activity feed, newest first: comments in bubbles, changes as one quiet line. */
	function drawActivity(item) {
		const entries = [...item.activity].reverse();
		panel.activity.innerHTML = entries.length
			? entries
					.map((entry) => {
						const author = personById(entry.who);
						const when = `<span class="pb-when">${timeAgo(entry.at)}</span>`;
						if (entry.kind === 'event') {
							return `<li class="pb-event"><span class="pb-event-dot" aria-hidden="true"></span><p><strong>${htmlSafe(shortName(author))}</strong> ${htmlSafe(entry.text)} ${when}</p></li>`;
						}
						return `<li class="pb-note">${avatarMarkup(author, 'sm')}<div class="pb-note-body"><p class="pb-note-head"><strong>${htmlSafe(author ? author.name : 'Someone')}</strong> ${when}</p><p class="pb-note-text">${htmlSafe(entry.text)}</p></div></li>`;
					})
					.join('')
			: '<li class="pb-thread-none">No comments yet. Ask a question or leave a note for whoever picks this up.</li>';
		paintAvatars(panel.activity);
	}

	function showSaved() {
		const flag = pick('[data-sheet-saved]', ui.drawer);
		flag.textContent = 'Saved';
		clearTimeout(savedTimer);
		savedTimer = setTimeout(() => {
			flag.textContent = '';
		}, 1800);
	}

	/** Saves some fields of an issue, adding a line to its activity when eventText is given. */
	function editIssue(item, changes, eventText) {
		const fields = Object.keys(changes);
		if (fields.every((field) => JSON.stringify(item[field]) === JSON.stringify(changes[field]))) return;
		const earlier = Object.fromEntries(fields.map((field) => [field, deepCopy(item[field])]));
		const eventCount = item.activity.length;
		Object.assign(item, changes);
		if (eventText) recordEvent(item, eventText);
		sendChange(backend.patchIssue(item.key, changes), `save ${item.key}`, () => {
			Object.assign(item, earlier);
			item.activity.length = eventCount;
		});
		redraw();
		if (model.openKey !== item.key) return;
		if (eventText) drawActivity(item);
		if (changes.type) fillDrawer();
		showSaved();
	}

	function wireDrawer() {
		const { title } = panel;
		title.addEventListener('input', fitTitle);
		title.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				title.blur();
			}
			if (event.key === 'Escape' && title.value !== drawerIssue()?.title) {
				event.preventDefault();
				event.stopPropagation();
				title.value = drawerIssue().title;
				fitTitle();
				title.blur();
			}
		});
		title.addEventListener('blur', () => {
			const item = drawerIssue();
			if (!item) return;
			const typed = tidy(title.value);
			if (!typed) {
				title.classList.add('is-invalid');
				return;
			}
			title.classList.remove('is-invalid');
			if (typed !== item.title) editIssue(item, { title: typed }, 'renamed this');
			pick('[data-sheet-heading]', ui.drawer).textContent = `${item.key} ${item.title}`;
		});
		panel.description.addEventListener('blur', () => {
			const item = drawerIssue();
			const typed = panel.description.value.trim();
			if (item && typed !== (item.description || '')) editIssue(item, { description: typed });
		});
		panel.status.addEventListener('change', () => {
			const item = drawerIssue();
			if (drawerSyncing || !item || panel.status.value === item.status) return;
			sendTo(item.key, panel.status.value, false);
			showSaved();
		});

		watchSelect(panel.assignee, 'assignee', (id) =>
			id ? `assigned this to ${personById(id).name}` : 'removed the assignee',
		);
		watchSelect(panel.reporter, 'reporter', (id) => `changed the reporter to ${personById(id).name}`);
		watchSelect(panel.priority, 'priority', (id) => `set the priority to ${urgencyOf(id).label}`);
		watchSelect(panel.type, 'type', (id) => `changed the type to ${kindOf(id).label}`);

		panel.points.addEventListener('change', () => {
			const item = drawerIssue();
			if (drawerSyncing || !item) return;
			const points = clampPoints(panel.points.value);
			if (points !== item.points) editIssue(item, { points });
		});
		panel.due.addEventListener('change', () => {
			const item = drawerIssue();
			if (drawerSyncing || !item) return;
			const due = panel.due.value || null;
			editIssue(item, { due }, due ? `set the due date to ${dueText(due)}` : 'removed the due date');
		});
		panel.tags.addEventListener('change', () => {
			const item = drawerIssue();
			if (drawerSyncing || !item || !panel.tags.basaltTags) return;
			const names = panel.tags.basaltTags.get();
			offerLabels(panel.suggestions, names);
			editIssue(item, { labels: resolveLabels(names) });
		});
		panel.suggestions.addEventListener('click', (event) => {
			const chip = event.target.closest('[data-pick-label]');
			const tags = panel.tags.basaltTags;
			if (!chip || !tags) return;
			const neighbor = chip.nextElementSibling || chip.previousElementSibling;
			tags.set([...tags.get(), chip.getAttribute('data-pick-label')]);
			const nextChip =
				neighbor && pick(`[data-pick-label="${neighbor.getAttribute('data-pick-label')}"]`, panel.suggestions);
			(nextChip || pick('.basalt-tags-input', panel.tags)).focus();
		});

		wireSubtasks();
		wireComments();

		pick('[data-sheet-delete]', ui.drawer).addEventListener('click', () => {
			if (model.openKey) discardIssue(model.openKey);
		});
		ui.drawer.addEventListener('shown.bs.offcanvas', () => fitTitle());
		ui.drawer.addEventListener('hide.bs.offcanvas', () => {
			if (document.activeElement && ui.drawer.contains(document.activeElement)) document.activeElement.blur();
		});
		ui.drawer.addEventListener('hidden.bs.offcanvas', () => {
			const key = drawerReturnKey;
			model.openKey = null;
			drawerReturnKey = null;
			if (key && issueByKey(key)) focusIssue(key);
		});
	}

	/** Saves a drawer select on change, logging the sentence describe() returns. */
	function watchSelect(select, field, describe) {
		select.addEventListener('change', () => {
			const item = drawerIssue();
			if (drawerSyncing || !item) return;
			const value = select.value || null;
			if (value === item[field]) return;
			editIssue(item, { [field]: value }, describe(value));
		});
	}

	function wireSubtasks() {
		panel.subtasks.addEventListener('change', (event) => {
			const box = event.target.closest('[data-sub-check]');
			const item = drawerIssue();
			if (!box || !item) return;
			const index = Number(box.closest('[data-sub]').getAttribute('data-sub'));
			const steps = deepCopy(item.subtasks);
			steps[index].done = box.checked;
			editIssue(item, { subtasks: steps });
			drawSubtasks(item);
			pick(`[data-sub="${index}"] [data-sub-check]`, panel.subtasks)?.focus();
			announce(`${steps[index].title}${box.checked ? ' done.' : ' not done.'}`);
		});
		panel.subtasks.addEventListener('click', (event) => {
			const remove = event.target.closest('[data-sub-del]');
			const item = drawerIssue();
			if (!remove || !item) return;
			const index = Number(remove.closest('[data-sub]').getAttribute('data-sub'));
			const steps = deepCopy(item.subtasks);
			const [gone] = steps.splice(index, 1);
			editIssue(item, { subtasks: steps });
			drawSubtasks(item);
			const nextRemove = pickAll('[data-sub-del]', panel.subtasks)[Math.min(index, steps.length - 1)];
			(nextRemove || pick('[data-sheet-sub-new]', ui.drawer)).focus();
			announce(`Removed ${gone.title}.`);
		});
		pick('[data-sheet-sub-form]', ui.drawer).addEventListener('submit', (event) => {
			event.preventDefault();
			const field = pick('[data-sheet-sub-new]', ui.drawer);
			const item = drawerIssue();
			const typed = tidy(field.value);
			if (!item || !typed) {
				field.focus();
				return;
			}
			editIssue(item, { subtasks: [...item.subtasks, { title: typed, done: false }] });
			drawSubtasks(item);
			field.value = '';
			field.focus();
			announce('Subtask added.');
		});
	}

	/* Comments post on submit or Ctrl/Cmd + Enter. */
	function wireComments() {
		const form = pick('[data-sheet-comment-form]', ui.drawer);
		const field = pick('[data-sheet-comment]', ui.drawer);
		field.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
			event.preventDefault();
			form.requestSubmit();
		});
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const item = drawerIssue();
			const text = field.value.trim();
			if (!item || !text) {
				field.focus();
				return;
			}
			const comment = {
				id: freshId('c'),
				kind: 'comment',
				who: model.selfId,
				text,
				at: new Date().toISOString(),
			};
			item.activity.push(comment);
			sendChange(backend.postComment(item.key, comment), 'post the comment', () => {
				item.activity = item.activity.filter((entry) => entry !== comment);
			});
			field.value = '';
			drawActivity(item);
			redraw();
			showSaved();
			announce('Comment added.');
		});
	}

	/** Fills the select lists whose options come from data: priorities, types, people and the type tiles. */
	function fillVocabulary() {
		for (const select of pickAll('[data-board-priorities]')) {
			select.innerHTML = Object.entries(URGENCY)
				.map(
					([id, level]) =>
						`<option value="${id}" data-icon="${level.glyph.replace('bi-', '')}">${level.label}</option>`,
				)
				.join('');
		}
		for (const select of pickAll('[data-board-types]')) {
			select.innerHTML = Object.entries(KINDS)
				.map(
					([id, kind]) =>
						`<option value="${id}" data-icon="${kind.glyph.replace('bi-', '')}">${kind.label}</option>`,
				)
				.join('');
		}
		for (const select of pickAll('[data-sheet-people]')) {
			fillPeopleSelect(select, select.getAttribute('data-sheet-people') !== 'reporter');
		}
		if (window.Basalt.select && window.Basalt.select.refresh) {
			for (const select of pickAll('[data-board-priorities], [data-board-types], [data-sheet-people]'))
				refreshSelect(select);
		}
		pick('[data-create-types]', ui.composer).innerHTML = Object.entries(KINDS)
			.map(
				([id, kind], index) =>
					`<label class="basalt-choice pb-choice pb-choice-${id}"><input type="radio" name="type" value="${id}"${index === 0 ? ' checked' : ''}><i class="bi ${kind.glyph}" aria-hidden="true"></i>${kind.label}</label>`,
			)
			.join('');
	}

	function fillPeopleSelect(select, allowNobody) {
		const people = model.team.map(
			(member) =>
				`<option value="${htmlSafe(member.id)}" data-hint="${htmlSafe(member.role)}">${htmlSafe(member.id === model.selfId ? `${member.name} (you)` : member.name)}</option>`,
		);
		select.innerHTML = (allowNobody ? '<option value="">Not assigned</option>' : '') + people.join('');
	}

	function fillStatusSelect(select, value) {
		select.innerHTML = projectColumns()
			.map(
				(column) =>
					`<option value="${htmlSafe(column.id)}" data-dot="series-${seriesIndex(column.color)}">${htmlSafe(column.name)}</option>`,
			)
			.join('');
		select.value = value;
		refreshSelect(select);
	}

	/* The Create issue dialog, for issues that need more than a title. */

	function openComposer(statusId) {
		if (!model.ready) return;
		const all = projectColumns();
		const firstOpen = all.find((column) => !column.done && !column.collapsed) || all[0];
		composer.form.reset();
		composer.title.classList.remove('is-invalid');
		fillStatusSelect(composer.status, statusId || firstOpen.id);
		composer.assignee.value = model.onlyMine ? model.selfId : '';
		composer.priority.value = 'medium';
		composer.points.value = 2;
		composer.tags.basaltTags?.set([]);
		offerLabels(composer.suggestions, []);
		const project = currentProject();
		pick('[data-create-sub]', ui.composer).textContent = `Adds it to ${project.name} (${project.key}).`;
		composedKey = null;
		dialogFor(ui.composer).show();
	}

	function submitComposer() {
		const title = tidy(composer.title.value);
		if (!title) {
			composer.title.classList.add('is-invalid');
			composer.title.focus();
			return;
		}
		composer.title.classList.remove('is-invalid');
		const typeChoice = pick('input[name="type"]:checked', composer.form);
		const names = composer.tags.basaltTags ? composer.tags.basaltTags.get() : [];
		const item = createIssue({
			title,
			description: composer.description.value.trim(),
			type: typeChoice ? typeChoice.value : 'task',
			status: composer.status.value,
			assignee: composer.assignee.value || null,
			priority: composer.priority.value,
			points: clampPoints(composer.points.value),
			due: composer.due.value || null,
			labels: resolveLabels(names),
		});
		if (model.narrow) model.narrowStatus = item.status;
		redraw();
		const columnName = columnById(item.status).name;
		notify({
			tone: 'success',
			title: `Created ${item.key}`,
			text: `${item.title} in ${columnName}${passesFilters(item) ? '' : '. The filters you have on hide it.'}`,
			actions: [{ label: 'Open', onClick: () => showIssue(item.key) }],
		});
		announce(`Created ${item.key} in ${columnById(item.status).name}.`);
		if (composer.another.checked) {
			composer.title.value = '';
			composer.description.value = '';
			composer.title.focus();
			return;
		}
		composedKey = item.key;
		dialogFor(ui.composer).hide();
	}

	function wireComposer() {
		composer.form.addEventListener('submit', (event) => {
			event.preventDefault();
			submitComposer();
		});
		composer.title.addEventListener('input', () => composer.title.classList.remove('is-invalid'));
		composer.tags.addEventListener('change', () => {
			if (composer.tags.basaltTags) offerLabels(composer.suggestions, composer.tags.basaltTags.get());
		});
		composer.suggestions.addEventListener('click', (event) => {
			const chip = event.target.closest('[data-pick-label]');
			const tags = composer.tags.basaltTags;
			if (!chip || !tags) return;
			tags.set([...tags.get(), chip.getAttribute('data-pick-label')]);
			pick('.basalt-tags-input', composer.tags).focus();
		});
		ui.composer.addEventListener('shown.bs.modal', () => composer.title.focus());
		ui.composer.addEventListener('hidden.bs.modal', () => {
			if (composedKey) focusIssue(composedKey);
			composedKey = null;
		});
	}

	/* Column changes, from the column menus and the two column dialogs. */

	function openColumnEditor(id) {
		if (!model.ready) return;
		const column = id ? columnById(id) : null;
		editingColumn = column ? column.id : null;
		pick('[data-column-title]', ui.columnEditor).textContent = column ? `Edit ${column.name}` : 'Add column';
		pick('[data-column-submit]', ui.columnEditor).textContent = column ? 'Save column' : 'Add column';
		columnEditor.name.value = column ? column.name : '';
		columnEditor.name.classList.remove('is-invalid');
		columnEditor.limit.value = column ? column.limit : 0;
		columnEditor.done.checked = column ? Boolean(column.done) : false;
		const taken = projectColumns().map((other) => other.color);
		const chosen = column ? column.color : SERIES.find((series) => !taken.includes(series)) || 2;
		pick('[data-column-swatches]', ui.columnEditor).innerHTML = SERIES.map(
			(series) =>
				`<label class="pb-swatch pb-c${series}"><input type="radio" class="pb-swatch-input" name="color" value="${series}"${series === chosen ? ' checked' : ''}><span class="pb-swatch-dot" aria-hidden="true"></span><span class="visually-hidden">Chart color ${series}</span></label>`,
		).join('');
		columnToFocus = column ? column.id : null;
		dialogFor(ui.columnEditor).show();
	}

	function saveColumn() {
		const name = tidy(columnEditor.name.value);
		const twin = projectColumns().find(
			(column) => column.name.toLowerCase() === name.toLowerCase() && column.id !== editingColumn,
		);
		if (!name || twin) {
			columnEditor.error.textContent = name
				? `There is already a column called ${twin.name}.`
				: 'Give the column a name.';
			columnEditor.name.classList.add('is-invalid');
			columnEditor.name.focus();
			return;
		}
		const swatch = pick('input[name="color"]:checked', columnEditor.form);
		const fields = {
			name,
			color: seriesIndex(swatch ? swatch.value : 2),
			limit: Math.max(0, parseInt(columnEditor.limit.value, 10) || 0),
			done: columnEditor.done.checked,
		};
		const project = currentProject();
		if (editingColumn) {
			const column = columnById(editingColumn);
			const earlier = { name: column.name, color: column.color, limit: column.limit, done: column.done };
			Object.assign(column, fields);
			sendChange(backend.patchColumn(project.id, column.id, fields), `save the ${earlier.name} column`, () =>
				Object.assign(column, earlier),
			);
			notify({
				tone: 'success',
				title: 'Column saved',
				text: `${column.name}${column.limit ? `, limit ${column.limit}` : ', no limit'}`,
			});
			columnToFocus = column.id;
		} else {
			let id =
				name
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/^-|-$/g, '') || 'column';
			if (columnById(id)) id = freshId(`${id}-`);
			const column = { id, collapsed: false, ...fields };
			/* A new column lands just before the first done column, where an
         extra step is usually wanted. */
			const doneAt = project.columns.findIndex((other) => other.done);
			project.columns.splice(doneAt < 0 ? project.columns.length : doneAt, 0, column);
			sendChange(backend.postColumn(project.id, column), `add the ${name} column`, () => {
				project.columns = project.columns.filter((other) => other !== column);
			});
			notify({
				tone: 'success',
				title: `Added ${name}`,
				text: column.limit ? `Limit of ${column.limit} cards.` : 'No limit on cards.',
			});
			columnToFocus = column.id;
			if (model.narrow) model.narrowStatus = column.id;
		}
		dialogFor(ui.columnEditor).hide();
		redraw();
		announce(`Column ${name} saved.`);
	}

	function focusColumnMenu(id) {
		requestAnimationFrame(() => {
			const target = pick(`[data-col-menu="${id}"]`, ui.body) || pick(`[data-col-expand="${id}"]`, ui.body);
			if (!target) return;
			target.focus();
			target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
		});
	}

	function shiftColumn(id, step) {
		const project = currentProject();
		const from = project.columns.findIndex((column) => column.id === id);
		const to = from + step;
		if (from < 0 || to < 0 || to >= project.columns.length) return;
		const earlier = [...project.columns];
		const [column] = project.columns.splice(from, 1);
		project.columns.splice(to, 0, column);
		sendChange(
			backend.putColumnOrder(
				project.id,
				project.columns.map((other) => other.id),
			),
			`move the ${column.name} column`,
			() => {
				project.columns = earlier;
			},
		);
		redraw();
		focusColumnMenu(id);
		announce(`${column.name} moved ${step < 0 ? 'left' : 'right'}. Column ${to + 1} of ${project.columns.length}.`);
	}

	function setFolded(id, folded) {
		const column = columnById(id);
		if (!column) return;
		column.collapsed = folded;
		sendChange(
			backend.patchColumn(currentProject().id, id, { collapsed: folded }),
			`${folded ? 'fold' : 'open'} ${column.name}`,
			() => {
				column.collapsed = !folded;
			},
		);
		redraw();
		focusColumnMenu(id);
		announce(`${column.name}${folded ? ' folded.' : ' open.'}`);
	}

	/** Reorders a column urgent first, keeping the old order among equals. */
	function sortByUrgency(id) {
		const column = columnById(id);
		const members = issuesHere().filter((item) => item.status === id);
		const earlier = members.map((item) => [item, item.rank]);
		members.sort((a, b) => urgencyOf(a.priority).weight - urgencyOf(b.priority).weight || a.rank - b.rank);
		for (const [position, item] of members.entries()) item.rank = (position + 1) * 1000;
		function restoreOrder() {
			for (const [item, rank] of earlier) item.rank = rank;
		}
		function saveOrder() {
			return Promise.all(members.map((item) => backend.postMove(item.key, id, item.rank)));
		}
		sendChange(saveOrder(), `sort ${column.name}`, restoreOrder);
		redraw();
		focusColumnMenu(id);
		announce(`${column.name} sorted by priority.`);
		notify({
			tone: 'success',
			icon: 'bi-sort-down',
			title: `${column.name} sorted by priority`,
			text: 'Urgent first, then by the order they were in.',
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						restoreOrder();
						sendChange(saveOrder(), 'undo the sort');
						redraw();
						focusColumnMenu(id);
					},
				},
			],
		});
	}

	function askColumnDelete(id) {
		const column = columnById(id);
		const all = projectColumns();
		if (!column || all.length < 2) return;
		removingColumn = id;
		const total = tallyIn(id);
		pick('[data-coldel-title]', ui.columnRemover).textContent = `Delete ${column.name}?`;
		pick('[data-coldel-text]', ui.columnRemover).textContent = total
			? `It has ${countWord(total, 'issue')}. They need a new status before the column goes.`
			: 'It has no issues in it, so nothing else changes.';
		pick('[data-coldel-move]', ui.columnRemover).hidden = !total;
		const others = all.filter((other) => other.id !== id);
		columnRemover.target.innerHTML = others
			.map(
				(other) =>
					`<option value="${htmlSafe(other.id)}" data-dot="series-${seriesIndex(other.color)}">${htmlSafe(other.name)}</option>`,
			)
			.join('');
		columnRemover.target.value = (all[all.indexOf(column) - 1] || others[0]).id;
		refreshSelect(columnRemover.target);
		pick('[data-coldel-submit]', ui.columnRemover).textContent = total
			? `Move ${countWord(total, 'issue')} and delete`
			: 'Delete column';
		dialogFor(ui.columnRemover).show();
	}

	function confirmColumnDelete() {
		const project = currentProject();
		const column = columnById(removingColumn);
		if (!column) return;
		const index = project.columns.indexOf(column);
		const destination = columnById(columnRemover.target.value);
		const moved = issuesHere()
			.filter((item) => item.status === column.id)
			.sort(byRank);
		const earlier = moved.map((item) => [item, item.status, item.rank]);
		let rank = destination ? highestRank(destination.id) : 0;
		for (const item of moved) {
			rank += 1000;
			item.status = destination.id;
			item.rank = rank;
		}
		project.columns.splice(index, 1);
		function rollBack() {
			if (!project.columns.includes(column)) project.columns.splice(index, 0, column);
			for (const [item, status, oldRank] of earlier) {
				item.status = status;
				item.rank = oldRank;
			}
		}
		sendChange(
			backend.deleteColumn(project.id, column.id, moved.length ? destination.id : null),
			`delete the ${column.name} column`,
			rollBack,
		);
		if (model.narrow) model.narrowStatus = destination ? destination.id : '';
		dialogFor(ui.columnRemover).hide();
		redraw();
		const nearest = project.columns[Math.max(0, index - 1)];
		if (nearest) focusColumnMenu(nearest.id);
		const movedText = moved.length ? `${countWord(moved.length, 'issue')} moved to ${destination.name}.` : '';
		announce(
			`Deleted the ${column.name} column${moved.length ? `, and moved ${countWord(moved.length, 'issue')} to ${destination.name}` : ''}.`,
		);
		notify({
			tone: 'info',
			icon: 'bi-trash3',
			title: `Deleted ${column.name}`,
			text: movedText || 'The column was empty.',
			duration: 8000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						rollBack();
						const request = backend
							.postColumn(project.id, column)
							.then(() =>
								Promise.all(
									earlier.map(([item]) => backend.postMove(item.key, item.status, item.rank)),
								),
							);
						sendChange(request, `restore ${column.name}`);
						redraw();
						focusColumnMenu(column.id);
						announce(`${column.name} is back.`);
					},
				},
			],
		});
	}

	function wireColumnDialogs() {
		columnEditor.form.addEventListener('submit', (event) => {
			event.preventDefault();
			saveColumn();
		});
		columnEditor.name.addEventListener('input', () => columnEditor.name.classList.remove('is-invalid'));
		ui.columnEditor.addEventListener('shown.bs.modal', () => columnEditor.name.focus());
		ui.columnEditor.addEventListener('hidden.bs.modal', () => {
			if (columnToFocus) focusColumnMenu(columnToFocus);
			columnToFocus = null;
		});
		columnRemover.form.addEventListener('submit', (event) => {
			event.preventDefault();
			confirmColumnDelete();
		});
	}

	/* Switching project, clearing filters and starting the demo over. */

	function showProject(id) {
		if (!model.projects.some((project) => project.id === id)) return;
		model.projectId = id;
		model.narrowStatus = '';
		model.draft = null;
		model.byLabel.clear();
		drawFilterMenus();
		saveView();
		redraw();
		ui.scroller.scrollLeft = 0;
		syncEdgeShadows();
		announce(`Showing ${currentProject().name}.`);
	}

	function resetFilters() {
		model.search = '';
		ui.search.value = '';
		model.byPerson.clear();
		model.onlyMine = false;
		ui.mineSwitch.checked = false;
		for (const chosen of [model.byLabel, model.byUrgency, model.byKind]) chosen.clear();
		drawPeopleFilter();
		drawFilterMenus();
		redraw();
		announce(`Showing everything again. ${countWord(filteredIssues().length, 'issue')} on the board.`);
	}

	function afterFilterChange() {
		redraw();
		announce(`${countWord(filteredIssues().length, 'issue')} shown.`);
	}

	/** Forgets this browser's edits and starts the demo over, with Undo. */
	function restartDemo() {
		const prior = { team: model.team, labelSet: model.labelSet, projects: model.projects, issues: model.issues };
		memory.drop(SNAPSHOT_KEY);
		takeIn(deepCopy(STARTER_BOARD));
		model.draft = null;
		drawFilterMenus();
		drawPeopleFilter();
		redraw();
		announce('The demo board is back to how it started.');
		notify({
			tone: 'info',
			icon: 'bi-arrow-counterclockwise',
			title: 'Demo board reset',
			text: 'Your changes in this browser were cleared.',
			duration: 8000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						Object.assign(model, prior);
						saveSnapshot();
						drawFilterMenus();
						redraw();
						announce('Your changes are back.');
					},
				},
			],
		});
	}

	/* Every change goes through sendChange(), which saves the demo snapshot or rolls back. */

	/** Waits on a backend request; if it fails, rolls the page back and says so. */
	function sendChange(request, what, rollback) {
		return request
			.then((answer) => {
				saveSnapshot();
				return answer;
			})
			.catch(() => {
				if (rollback) rollback();
				redraw();
				if (model.openKey) fillDrawer();
				notify({
					tone: 'danger',
					title: `Could not ${what}`,
					text: 'Nothing was changed. Try again in a moment.',
				});
				announce(`Could not ${what}. Nothing was changed.`);
			});
	}

	function saveSnapshot() {
		if (demoMode || !model.ready) return;
		memory.write(SNAPSHOT_KEY, {
			me: model.selfId,
			people: model.team,
			labels: model.labelSet,
			projects: model.projects,
			issues: model.issues,
		});
	}

	function saveView() {
		memory.write(VIEW_KEY, {
			project: model.projectId,
			view: model.view,
			group: model.grouping,
			density: model.density,
		});
	}

	function pause(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/** The demo's stand-in for a write request: a short wait, then success unless ?state=offline. */
	function settle(payload) {
		return pause(120).then(() => {
			if (demoMode === 'offline') throw new Error('The server did not answer');
			return payload;
		});
	}

	/* Lookups into state, and the filter test every card goes through. */

	function currentProject() {
		return model.projects.find((project) => project.id === model.projectId) || model.projects[0];
	}

	function projectColumns() {
		const project = currentProject();
		return project ? project.columns : [];
	}

	function columnById(id) {
		return projectColumns().find((column) => column.id === id) || null;
	}

	function personById(id) {
		return model.team.find((member) => member.id === id) || null;
	}

	function labelById(id) {
		return model.labelSet.find((tag) => tag.id === id) || null;
	}

	function issueByKey(key) {
		return model.issues.find((item) => item.key === key) || null;
	}

	function drawerIssue() {
		return issueByKey(model.openKey);
	}

	function issuesHere() {
		return model.issues.filter((item) => item.project === model.projectId);
	}

	function tallyIn(status) {
		return issuesHere().filter((item) => item.status === status).length;
	}

	function isFinished(item) {
		return Boolean(columnById(item.status)?.done);
	}

	function doneSteps(item) {
		return item.subtasks.filter((step) => step.done).length;
	}

	function commentCount(item) {
		return item.activity.filter((entry) => entry.kind !== 'event').length;
	}

	function byRank(a, b) {
		return a.rank - b.rank;
	}

	function shortName(member) {
		if (!member) return 'Nobody';
		return member.id === model.selfId ? 'You' : member.name.split(' ')[0];
	}

	function kindOf(id) {
		const known = Object.hasOwn(KINDS, id) ? id : 'task';
		return { id: known, ...KINDS[known] };
	}

	function urgencyOf(id) {
		const known = Object.hasOwn(URGENCY, id) ? id : 'medium';
		return { id: known, ...URGENCY[known] };
	}

	function filtering() {
		return Boolean(
			model.search ||
			model.byPerson.size ||
			model.onlyMine ||
			model.byLabel.size ||
			model.byUrgency.size ||
			model.byKind.size,
		);
	}

	function filteredIssues() {
		return issuesHere().filter(passesFilters);
	}

	/** True when an issue gets past every filter that is switched on. */
	function passesFilters(item) {
		const checks = [
			() => !model.onlyMine || item.assignee === model.selfId,
			() => !model.byPerson.size || model.byPerson.has(item.assignee || 'none'),
			() => !model.byLabel.size || item.labels.some((id) => model.byLabel.has(id)),
			() => !model.byUrgency.size || model.byUrgency.has(item.priority),
			() => !model.byKind.size || model.byKind.has(item.type),
			() => !model.search || matchesSearch(item),
		];
		return checks.every((check) => check());
	}

	/* Every word typed has to turn up somewhere in the key, title,
     description, assignee or label names. */
	function matchesSearch(item) {
		const owner = personById(item.assignee);
		const haystack = [
			item.key,
			item.title,
			item.description,
			owner ? owner.name : '',
			item.labels.map((id) => labelById(id)?.name).join(' '),
		]
			.join(' ')
			.toLowerCase();
		return model.search
			.toLowerCase()
			.split(/\s+/)
			.filter(Boolean)
			.every((word) => haystack.includes(word));
	}

	/* Markup fragments several views share. */

	function avatarMarkup(member, size = 'xs') {
		if (!member)
			return `<span class="basalt-avatar basalt-avatar-${size} pb-avatar pb-avatar-none" aria-hidden="true"><i class="bi bi-person"></i></span>`;
		return `<span class="basalt-avatar basalt-avatar-${size} pb-avatar" data-basalt-avatar data-name="${htmlSafe(member.name)}" aria-hidden="true"></span>`;
	}

	function kindBadge(id) {
		const kind = kindOf(id);
		return `<span class="pb-type pb-type-${kind.id}" title="${kind.label}" aria-hidden="true"><i class="bi ${kind.glyph}"></i></span>`;
	}

	function urgencyBadge(id) {
		const level = urgencyOf(id);
		return `<span class="pb-prio pb-prio-${level.id}" title="${level.label} priority" aria-hidden="true"><i class="bi ${level.glyph}"></i></span>`;
	}

	function labelChip(id) {
		const tag = labelById(id);
		return tag ? `<span class="pb-label pb-c${seriesIndex(tag.color)}">${htmlSafe(tag.name)}</span>` : '';
	}

	/**
	 * One dropdown menu row. hook carries the data attributes the click table
	 * reads; options.danger tints it and options.disabled switches it off.
	 */
	function menuEntry(hook, glyph, text, options = {}) {
		const tint = options.danger ? ' pb-danger-item' : '';
		return `<li><button type="button" class="dropdown-item${tint}" ${hook}${options.disabled ? ' disabled' : ''}><i class="bi ${glyph}" aria-hidden="true"></i>${text}</button></li>`;
	}

	function notePanel({ icon, title, text, tone, actions }) {
		const toneClass = tone ? ` basalt-empty-${tone}` : '';
		const buttons = actions ? `<div class="basalt-empty-actions">${actions}</div>` : '';
		return `<div class="basalt-empty basalt-empty-compact pb-empty${toneClass}"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi ${icon}"></i></span><h2 class="basalt-empty-title">${title}</h2><p class="basalt-empty-text">${text}</p>${buttons}</div>`;
	}

	function paintAvatars(scope) {
		if (window.Basalt.avatars) {
			window.Basalt.avatars(scope);
			return;
		}
		if (!window.Basalt.avatar) return;
		for (const holder of pickAll('[data-basalt-avatar]', scope)) window.Basalt.avatar(holder);
	}

	/* Generic helpers, and thin wrappers over what basalt.js and Bootstrap provide. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function announce(text) {
		window.Basalt.announce?.(text);
	}

	function refreshSelect(select) {
		window.Basalt.select?.refresh?.(select);
	}

	function dialogFor(element) {
		return window.bootstrap.Modal.getOrCreateInstance(element);
	}

	function drawerPanel() {
		return window.bootstrap.Offcanvas.getOrCreateInstance(ui.drawer);
	}

	function motionReduced() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/** "1 issue", "3 issues"; pluralForm covers words that do not just add an s. */
	function countWord(count, singular, pluralForm) {
		return `${count} ${count === 1 ? singular : pluralForm || `${singular}s`}`;
	}

	/** Collapses runs of white space and trims, for titles and names typed by hand. */
	function tidy(text) {
		return text.replace(/\s+/g, ' ').trim();
	}

	function clampPoints(value) {
		return Math.max(0, Math.min(40, parseInt(value, 10) || 0));
	}

	function seriesIndex(value) {
		return Math.min(8, Math.max(1, Number(value) || 1));
	}

	function deepCopy(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function freshId(prefix) {
		return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
	}

	/* Dates are stored as "YYYY-MM-DD" and shown in short, spoken forms. */

	/** Today plus daysAhead, as "YYYY-MM-DD". */
	function dateIn(daysAhead) {
		const date = new Date();
		date.setHours(0, 0, 0, 0);
		date.setDate(date.getDate() + daysAhead);
		return toIsoDay(date);
	}

	/** A timestamp daysBack days ago, at a quarter past the given hour (10 by default). */
	function stamp(daysBack, hour) {
		const date = new Date();
		date.setDate(date.getDate() - daysBack);
		date.setHours(hour || 10, 15, 0, 0);
		return date.toISOString();
	}

	function toIsoDay(date) {
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const dayOfMonth = String(date.getDate()).padStart(2, '0');
		return `${date.getFullYear()}-${month}-${dayOfMonth}`;
	}

	function fromIsoDay(text) {
		const [year, month, dayOfMonth] = text.split('-').map(Number);
		return new Date(year, month - 1, dayOfMonth);
	}

	function dayGap(isoDay) {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		return Math.round((fromIsoDay(isoDay) - today) / 86400000);
	}

	function shortDate(date) {
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
	}

	/** "Today", "Tomorrow", "Yesterday", or a short date such as "Oct 14". */
	function dueText(isoDay) {
		return NEAR_DAYS[dayGap(isoDay)] ?? shortDate(fromIsoDay(isoDay));
	}

	/** How long ago something happened, in the words a person would use. */
	function timeAgo(when) {
		const minutes = Math.round((Date.now() - new Date(when).getTime()) / 60000);
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${countWord(minutes, 'minute')} ago`;
		const hours = Math.round(minutes / 60);
		if (hours < 24) return `${countWord(hours, 'hour')} ago`;
		const days = Math.round(hours / 24);
		if (days === 1) return 'yesterday';
		if (days < 30) return `${days} days ago`;
		return shortDate(new Date(when));
	}

	start();
})();
