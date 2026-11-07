/**
 * The notebook on notes.html. It takes the whole window: a list pane with
 * search, views, tag and color filters and quick capture, and an editor
 * that keeps what you type, with checklists, pins, archive and trash.
 * Below 992px only one of the two panes is on screen at a time.
 *
 * Connecting a backend: swap SAMPLE.entries for your records (or leave
 * it empty and return them from server.list()), then point the three
 * methods of `server` at your endpoints. Each returns a Promise, and the
 * page already shows the saving, saved and failed states around them.
 * Everything visible is drawn from model.notes, so the markup stays put.
 */
(() => {
	'use strict';

	const shell = pick('[data-nt-root]');
	if (!shell) return;

	/* The sample notebook. `owner` is the visitor and `team` names everyone
     who writes. Each entry has an author key, a tint ('' or a key of
     TINTS), a status (active, archived or trashed) and `hours`: how long
     ago it was created and last edited, plus, in the trash, when it was
     deleted. `todo` is a plain-text checklist, one item per line, each
     starting with [x] when ticked or [ ] when still open. */
	const SAMPLE = {
		owner: 'ja',
		trashDays: 30,
		team: {
			ja: 'John Armstrong',
			pr: 'Connie Reese',
			hw: 'Leslie Whitlock',
			ev: 'Elise Vick',
			th: 'Todd Hatcher',
			mo: 'Travis Bartlett',
			cr: 'Cameron Reid',
			ab: 'Alexis Boone',
			gl: 'Courtney Lowry',
		},
		entries: [
			{
				id: 'n-118',
				by: 'hw',
				tint: 'green',
				status: 'active',
				pinned: true,
				hours: [190, 3],
				title: 'Travel Planner launch',
				tags: ['launch', 'product'],
				body: 'Live for every Pro account on November 4. Beta customers keep it free until the end of the year.',
				todo: `
          [x] Pricing page copy signed off
          [x] Help article for schedulers
          [ ] In-app tour on the scheduling board
          [ ] Webinar with two beta customers
          [ ] Email to every Pro admin`,
			},
			{
				id: 'n-117',
				by: 'th',
				tint: 'yellow',
				status: 'active',
				pinned: true,
				hours: [30, 7],
				title: 'Northgate sync errors',
				tags: ['customers', 'engineering'],
				body: 'Visits booked offline on Android only reach the board after the app restarts. 212 rows in their export, all from three carers.\n\nThe retry queue drops after a token refresh. The fix is in review.',
				todo: `
          [ ] Ship 4.18.2 to the app stores
          [ ] Tell Northgate once it is live`,
			},
			{
				id: 'n-116',
				by: 'ja',
				tint: 'blue',
				status: 'active',
				hours: [26, 11],
				title: 'Call with Lakeside Apparel',
				tags: ['customers', 'sales'],
				body: 'Spoke to Dana, their ops manager. 14 walkers today, 20 by spring. They lose an hour a day re-planning rounds when a walk runs over.\n\nKeen on Travel Planner and the arrival texts. Wants a price before their budget meeting on Friday.',
				todo: `
          [ ] Send the 20-seat quote by Thursday
          [ ] Book a demo with their schedulers
          [x] Add them to the beta list`,
			},
			{
				id: 'n-115',
				by: 'gl',
				tint: '',
				status: 'active',
				hours: [70, 20],
				title: 'Scheduler onboarding, week one',
				tags: ['onboarding'],
				body: "What a new customer's schedulers get through in their first week.",
				todo: `
          [x] Import their staff and their skills
          [x] Set working hours and service zones
          [ ] Book ten test visits on the board
          [ ] Turn on arrival texts
          [ ] Connect the invoicing app`,
			},
			{
				id: 'n-114',
				by: 'pr',
				tint: '',
				status: 'active',
				hours: [400, 28],
				title: 'Weekend support roster',
				tags: ['support', 'team'],
				body: 'One person on from 8 am to 6 pm Central. Swap shifts in the support channel, not by direct message.',
				todo: `
          [x] Week 1: Alexis
          [x] Week 2: Connie
          [ ] Week 3: Alexis
          [ ] Week 4: new hire, with Connie shadowing`,
			},
			{
				id: 'n-113',
				by: 'ev',
				tint: 'pink',
				status: 'active',
				hours: [260, 46],
				title: 'Why accounts left in Q3',
				tags: ['customers', 'success'],
				body: 'From 11 cancellations last quarter:\n\n- 4 outgrew us and needed payroll built in.\n- 3 never finished onboarding. None had a call in week one.\n- 2 went back to paper after the busy season.\n- 2 gave no reason.\n\nA first-week call for every new account would have kept at least three.',
			},
			{
				id: 'n-112',
				by: 'th',
				tint: 'yellow',
				status: 'active',
				hours: [80, 52],
				title: 'Offline mode for the mobile app',
				tags: ['engineering', 'mobile'],
				body: 'On-site staff lose signal in basements and old houses all the time.\n\nMust work offline: visit details, checklists, photos, signatures.\nCan wait: chat and the price list.\nWhen back online the newest change wins, and we show what was merged.',
				todo: `
          [ ] Write up the conflict rules
          [ ] Test with Northgate's three carers`,
			},
			{
				id: 'n-111',
				by: 'cr',
				tint: '',
				status: 'active',
				hours: [500, 75],
				title: 'Arrival text wording',
				tags: ['product', 'copy'],
				body: `Short, friendly, with the team member's first name.\n\nOn the way: "Rory from Lakeside Apparel is on the way. Arriving around 2:40 pm."\nRunning late: "Rory is running about 20 minutes late. Sorry for the wait."`,
			},
			{
				id: 'n-110',
				by: 'cr',
				tint: 'blue',
				status: 'active',
				hours: [300, 96],
				title: 'Webinar ideas',
				tags: ['marketing'],
				body: 'One topic per session, 30 minutes, one customer on the call.',
				todo: `
          [ ] Fewer miles: travel planning in practice
          [ ] Winter rush: planning on-call shifts
          [x] Getting paid on site
          [ ] From whiteboard to scheduling board`,
			},
			{
				id: 'n-109',
				by: 'ab',
				tint: 'pink',
				status: 'active',
				hours: [210, 120],
				title: 'Double-booked team members',
				tags: ['support', 'bugs'],
				body: 'Three tickets this week. Each time a visit was dragged on the board while someone edited the same visit on mobile.\n\nFor now: refresh the board before dragging. Engineering has the steps.',
				todo: `
          [x] Link the three tickets to the bug
          [ ] Reply to each customer when the fix ships`,
			},
			{
				id: 'n-108',
				by: 'hw',
				tint: 'green',
				status: 'active',
				hours: [620, 140],
				title: 'Integrations for 2027',
				tags: ['product', 'planning'],
				body: 'What customers ask for most, from 140 feature requests this year.',
				todo: `
          [x] QuickBooks Online: 41 requests
          [x] Xero: 22 requests
          [x] Two-way Google Calendar sync: 19
          [ ] Ask partners for API access dates`,
			},
			{
				id: 'n-107',
				by: 'ja',
				tint: '',
				status: 'active',
				hours: [720, 170],
				title: 'Fixes for the next sprint',
				tags: ['engineering'],
				body: 'Small things customers wrote in about.',
				todo: `
          [ ] Visit notes cut off at 500 characters
          [ ] Wrong time zone on emailed invoices
          [x] Show travel time on the visit card`,
			},
			{
				id: 'n-106',
				by: 'mo',
				tint: '',
				status: 'active',
				hours: [900, 220],
				title: 'Pricing for 2027',
				tags: ['sales', 'planning'],
				body: "Draft. Pro goes from $32 to $35 per seat a month. Basic stays flat. Accounts over 50 seats keep this year's price until March.\n\nTell customers by November 15 so they can budget.",
			},
			{
				id: 'n-105',
				by: 'cr',
				tint: '',
				status: 'active',
				hours: [340, 260],
				title: 'Customer story: Oakhaven Studio',
				tags: ['marketing', 'customers'],
				body: 'Same-day visits up 18% since they moved off spreadsheets. Their scheduler Rhea is happy to be quoted.',
				todo: `
          [x] Interview Rhea
          [ ] Photos of the team on their rounds
          [ ] Sign-off from Oakhaven`,
			},
			{
				id: 'n-104',
				by: 'pr',
				tint: 'yellow',
				status: 'archived',
				hours: [2400, 1300],
				title: 'Flu season on-call plan',
				tags: ['support', 'planning'],
				body: 'Extra cover for home care customers during the flu peak. Tickets doubled for nine days, and nothing missed its target.',
			},
			{
				id: 'n-103',
				by: 'cr',
				tint: '',
				status: 'archived',
				hours: [4300, 3600],
				title: 'Spring trade show',
				tags: ['marketing', 'planning'],
				body: 'Stand at the Small Business Expo in Nashville. 86 demo sign-ups, 9 closed by June.',
				todo: `
          [x] Ship the stand and the demo laptops
          [x] Follow up with every sign-up`,
			},
			{
				id: 'n-102',
				by: 'pr',
				tint: '',
				status: 'trashed',
				hours: [5000, 4200, 52],
				title: 'Old response targets',
				tags: ['support'],
				body: 'Targets from before the April change. They live in the support settings now.',
			},
			{
				id: 'n-101',
				by: 'ja',
				tint: '',
				status: 'trashed',
				hours: [90, 90, 160],
				title: 'Call with Lakeside Apparel (copy)',
				tags: ['customers'],
				body: 'Spoke to Dana, their ops manager.',
			},
		],
	};

	/* Note tints borrow the palette's status colors in the stylesheet, so a
     yellow note stays yellowish in every palette and in dark mode. */
	const TINTS = {
		'': 'No color',
		yellow: 'Yellow',
		green: 'Green',
		blue: 'Blue',
		pink: 'Pink',
	};

	/* The views offered by the menu above the list, in menu order. */
	const LENSES = [
		{ key: 'all', title: 'All notes', glyph: 'bi-journal-text', admits: (note) => note.status === 'active' },
		{
			key: 'pinned',
			title: 'Pinned',
			glyph: 'bi-pin-angle',
			admits: (note) => note.status === 'active' && note.pinned,
		},
		{
			key: 'todo',
			title: 'Open to-dos',
			glyph: 'bi-check2-square',
			admits: (note) => note.status === 'active' && openTasks(note) > 0,
		},
		{
			key: 'mine',
			title: 'Written by me',
			glyph: 'bi-person',
			admits: (note) => note.status === 'active' && note.by === SAMPLE.owner,
		},
		{
			key: 'archived',
			title: 'Archive',
			glyph: 'bi-archive',
			admits: (note) => note.status === 'archived',
			ruleAbove: true,
		},
		{ key: 'trashed', title: 'Trash', glyph: 'bi-trash3', admits: (note) => note.status === 'trashed' },
	];

	const ORDERINGS = {
		updated: (a, b) => b.editedAt - a.editedAt,
		created: (a, b) => b.createdAt - a.createdAt,
		title: (a, b) => noteTitle(a).localeCompare(noteTitle(b)),
	};

	/* What a view with nothing in it says when no search or filter is the
     reason. Buttons are markup, so they can carry their data-nt-* hooks. */
	const RESTING = {
		all: {
			glyph: 'bi-journal-plus',
			heading: 'No notes yet',
			line: 'Write down a customer call, a bug to chase or an onboarding checklist. It saves as you type.',
			buttons: '<button type="button" class="btn btn-sm btn-primary" data-nt-new>Write the first note</button>',
		},
		pinned: {
			glyph: 'bi-pin-angle',
			heading: 'Nothing pinned',
			line: 'Pin the notes you open every day, and they stay at the top of All notes.',
			buttons: '',
		},
		todo: {
			glyph: 'bi-check2-all',
			heading: 'No open to-dos',
			line: 'Every checklist item is checked off.',
			buttons:
				'<button type="button" class="btn btn-sm btn-outline-secondary" data-nt-new-list>Start a checklist</button>',
		},
		mine: {
			glyph: 'bi-person',
			heading: "You haven't written any notes",
			line: 'Notes you start show up here, as well as in All notes.',
			buttons: '<button type="button" class="btn btn-sm btn-primary" data-nt-new>New note</button>',
		},
		archived: {
			glyph: 'bi-archive',
			heading: 'Nothing archived',
			line: "Archive a note when you're done with it but want to keep it. It stays searchable here.",
			buttons: '',
		},
		trashed: {
			glyph: 'bi-trash3',
			heading: 'Trash is empty',
			line: `Notes you delete wait here for ${SAMPLE.trashDays} days, in case you change your mind.`,
			buttons: '',
		},
	};

	/* The three calls a real backend answers. The waits stand in for the
     network; replace each body with a fetch to your own endpoint. */
	const server = {
		/* Every note the visitor may read, e.g. fetch('/api/notes'). */
		async list() {
			await pause(450);
			if (navigator.onLine === false) throw new Error('offline');
			return fromSample(SAMPLE.entries);
		},
		/* Creates or updates one note. It runs once typing stops, and right
       away for pins, tints, tags, checklist, archive and trash changes. */
		async write(note) {
			await pause(350);
			if (navigator.onLine === false) throw new Error('offline');
			return note;
		},
		/* Removes notes for good, from the trash. */
		async erase(ids) {
			await pause(250);
			return ids;
		},
	};

	const MINUTE = 6e4;
	const HOUR = 36e5;
	const DAY = 864e5;
	const numbers = new Intl.NumberFormat('en-US');
	const narrowScreen = window.matchMedia('(max-width: 991.98px)');
	const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), .nt-note';

	/* Everything the screen is drawn from. `untouched` holds notes made with
     New note that nobody has typed into yet; they are dropped on leaving. */
	const model = {
		notes: [],
		ready: false,
		lens: 'all',
		tag: '',
		tint: '',
		searchText: '',
		order: 'updated',
		openId: null,
		untouched: new Set(),
	};

	/* Changes waiting for the server, the debounce timer, the number of
     requests on the wire and whether the last attempt failed. */
	const outbox = { queue: new Set(), timer: 0, busy: 0, broken: false };

	let serial = 200;
	let purgeTargets = [];
	let quietTags = false;
	let resizeDelay = 0;

	/* Hooks are data-nt-* names inside the app; a leading # means an id. */
	const ui = gather({
		app: 'app',
		listPane: 'list',
		chipRow: 'applied',
		search: 'search',
		capture: 'capture',
		workspaceLine: 'ws-line',
		themeToggle: 'theme',
		shortcutsDialog: '#nt-keys',
		lensMenu: 'views',
		lensButton: 'view-btn',
		lensIcon: 'view-icon',
		lensTitle: 'list-title',
		lensHeading: 'list-heading',
		tally: 'list-count',
		order: 'sort',
		filterButton: 'filter-btn',
		filterBadge: 'filter-count',
		tagFilters: 'tagnav',
		tintFilters: 'colornav',
		scroll: 'scroll',
		skeleton: 'skeleton',
		listbox: 'items',
		empty: 'empty',
		emptyTrash: 'empty-trash',
		purgeDialog: '#nt-purge',
		nothingOpen: 'none',
		editor: 'note',
		back: 'back',
		banner: 'banner',
		title: 'title',
		byline: 'meta',
		body: 'body',
		tags: 'tags',
		saveState: 'save',
		saveIcon: 'save-icon',
		saveText: 'save-text',
		editHint: 'edit-hint',
		retry: 'retry',
		pin: 'pin',
		tintButton: 'color-btn',
		tintDot: 'color-dot',
		tintChoices: 'color-options',
		archive: 'archive',
		trash: 'trash',
		duplicate: 'duplicate',
		copy: 'copy',
		download: 'download',
		taskSection: 'check',
		taskCount: 'check-count',
		taskBar: 'check-bar',
		taskFill: 'check-fill',
		taskList: 'check-list',
		taskForm: 'check-add',
		taskInput: '#nt-check-new',
		clearDone: 'check-clear',
	});

	start();

	/* Wires every control, then loads the notebook. */
	function start() {
		bindSaving();
		bindListPane();
		bindRows();
		bindEditor();
		bindToolbar();
		bindTasks();
		bindTags();
		bindShortcuts();
		bindLayout();

		if (document.readyState === 'loading') {
			/* basalt.js builds the tag input on DOMContentLoaded; go after it. */
			document.addEventListener('DOMContentLoaded', () => setTimeout(loadNotebook, 0));
		} else {
			loadNotebook();
		}
	}

	/* Shows the skeleton, asks the server for the notes and draws them. */
	function loadNotebook() {
		model.ready = false;
		ui.skeleton.hidden = false;
		ui.scroll.setAttribute('aria-busy', 'true');
		ui.listbox.hidden = true;
		ui.empty.hidden = true;
		drawList();
		server
			.list()
			.then((notes) => {
				model.notes = notes;
				model.ready = true;
				ui.skeleton.hidden = true;
				ui.scroll.setAttribute('aria-busy', 'false');
				if (!singlePane()) model.openId = shownNotes()[0]?.id ?? null;
				refreshAll();
				drawEditor();
			})
			.catch(() => {
				ui.skeleton.hidden = true;
				ui.scroll.setAttribute('aria-busy', 'false');
				ui.tally.textContent = 'Not loaded';
				drawEmpty('error');
			});
	}

	/* Event wiring. Each bind function owns one area of the screen. */

	function bindSaving() {
		/* Failed saves go out again as soon as the connection is back. */
		window.addEventListener('online', () => {
			if (outbox.broken) pushChanges();
		});
		window.addEventListener('beforeunload', (event) => {
			if (!outbox.queue.size && !outbox.busy) return;
			event.preventDefault();
			event.returnValue = '';
		});
		ui.retry.addEventListener('click', () => {
			outbox.broken = false;
			pushChanges();
		});
	}

	function bindListPane() {
		/* New note, new checklist, search and the dark mode switch can be
       reached from the workspace menu, the list head and the empty
       states. A menu item gives focus away only once its menu closes. */
		const menuActions = [
			['[data-nt-new]', () => setTimeout(() => startNote(), 0)],
			['[data-nt-new-list]', () => setTimeout(() => startNote({ checklist: true }), 0)],
			['[data-nt-search-open]', () => setTimeout(focusSearchBox, 0)],
			['[data-nt-theme]', () => window.Basalt.setTheme(window.Basalt.getTheme() === 'dark' ? 'light' : 'dark')],
		];
		shell.addEventListener('click', (event) => {
			const matched = menuActions.find(([selector]) => event.target.closest(selector));
			if (matched) matched[1]();
		});
		document.addEventListener('basalt:appearance', syncThemeToggle);
		syncThemeToggle();

		ui.lensMenu.addEventListener('click', (event) => {
			const choice = event.target.closest('[data-nt-view]');
			if (!choice) return;
			switchLens(choice.getAttribute('data-nt-view'));
			ui.lensButton.focus();
		});

		/* The filter menu stays open after a pick, so several tags and tints
       can be tried in a row. */
		ui.listPane.addEventListener('click', (event) => {
			const tagButton = event.target.closest('[data-nt-tag]');
			if (tagButton) {
				const tag = tagButton.getAttribute('data-nt-tag');
				model.tag = model.tag === tag ? '' : tag;
				refreshAll();
				pick(`[data-nt-tag="${CSS.escape(tag)}"]`, ui.tagFilters)?.focus();
				return;
			}
			const tintButton = event.target.closest('[data-nt-color-filter]');
			if (!tintButton) return;
			const tint = tintButton.getAttribute('data-nt-color-filter');
			model.tint = model.tint === tint ? '' : tint;
			refreshAll();
			pick(`[data-nt-color-filter="${tint}"]`, ui.tintFilters)?.focus();
		});

		ui.search.addEventListener('input', () => {
			model.searchText = ui.search.value.trim().toLowerCase();
			drawList();
		});
		ui.search.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && ui.search.value) {
				event.preventDefault();
				ui.search.value = '';
				model.searchText = '';
				drawList();
			}
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				focusRows();
			}
		});
		ui.order.addEventListener('change', () => {
			model.order = ui.order.value;
			drawList();
		});

		ui.capture.addEventListener('submit', (event) => {
			event.preventDefault();
			const control = pick('input', ui.capture);
			const wording = control.value.trim();
			if (!wording) {
				control.focus();
				return;
			}
			control.value = '';
			startNote({ title: wording });
			notify({ tone: 'success', icon: 'bi-journal-check', title: 'Note saved', text: wording });
		});

		ui.empty.addEventListener('click', (event) => {
			function pressed(selector) {
				return event.target.closest(selector);
			}
			if (pressed('[data-nt-clear-search]')) {
				ui.search.value = '';
				model.searchText = '';
				drawList();
				ui.search.focus();
			} else if (pressed('[data-nt-search-all]')) {
				model.lens = 'all';
				clearFilters();
				ui.search.focus();
			} else if (pressed('[data-nt-clear-filters]')) {
				clearFilters();
				ui.search.focus();
			} else if (pressed('[data-nt-reload]')) {
				loadNotebook();
			}
		});

		ui.emptyTrash.addEventListener('click', () => {
			confirmPurge(model.notes.filter((note) => note.status === 'trashed').map((note) => note.id));
		});
		ui.purgeDialog.addEventListener('basalt:confirm', purgeNow);
	}

	/* The list is a listbox: click to open, arrows to move, Enter to edit,
     Delete to trash. */
	function bindRows() {
		ui.listbox.addEventListener('click', (event) => {
			const row = event.target.closest('[data-nt-open]');
			if (!row) return;
			showNote(row.getAttribute('data-nt-open'));
			if (singlePane()) ui.back.focus();
		});
		ui.listbox.addEventListener('keydown', onRowKey);
	}

	function onRowKey(event) {
		const row = event.target.closest('[data-nt-open]');
		if (!row) return;
		const optionRows = [...pickAll('.nt-item', ui.listbox)];
		const at = optionRows.indexOf(row);

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			showNote(row.getAttribute('data-nt-open'));
			if (openNote()?.status === 'trashed') pick('[data-nt-restore]', shell).focus();
			else if (singlePane()) ui.back.focus();
			else ui.title.focus();
			return;
		}

		/* Macs have no forward Delete, so Backspace trashes as well, though
       never while the caret sits in a text field or the editor. */
		const wantsTrash = event.key === 'Delete' || (event.key === 'Backspace' && !event.target.closest(EDITABLE));
		if (wantsTrash && model.lens !== 'trashed') {
			event.preventDefault();
			const note = findNote(row.getAttribute('data-nt-open'));
			if (note) {
				model.openId = note.id;
				relocate(note, 'trashed');
			}
			return;
		}

		if (event.key === 'ArrowUp' && at === 0) {
			event.preventDefault();
			ui.search.focus();
			return;
		}

		const landing = new Map([
			['ArrowDown', optionRows[at + 1]],
			['ArrowUp', optionRows[at - 1]],
			['Home', optionRows[0]],
			['End', optionRows[optionRows.length - 1]],
		]).get(event.key);
		if (!landing) return;
		event.preventDefault();

		if (singlePane()) {
			for (const candidate of optionRows) candidate.tabIndex = -1;
			landing.tabIndex = 0;
			landing.focus();
			return;
		}
		/* On wide screens the editor follows the focus, as in a mail app. */
		showNote(landing.getAttribute('data-nt-open'));
		document.getElementById(landing.id)?.focus();
	}

	function bindEditor() {
		ui.back.addEventListener('click', () => {
			const leaving = model.openId;
			discardIfBlank(leaving);
			model.openId = null;
			drawEditor();
			refreshAll();
			const row = leaving && document.getElementById(`nt-opt-${leaving}`);
			if (!row) {
				focusRows();
				return;
			}
			row.tabIndex = 0;
			row.focus();
		});

		ui.editor.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && singlePane() && !event.target.closest('.dropdown-menu')) ui.back.click();
			/* Cmd or Ctrl+S sends the note at once instead of after the pause. */
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
				event.preventDefault();
				pushChanges();
			}
		});

		ui.title.addEventListener('input', () => {
			const note = editableNote();
			if (!note) return;
			note.title = ui.title.value.replace(/\n/g, ' ');
			fitHeight(ui.title);
			markChanged(note);
			const row = document.getElementById(`nt-opt-${note.id}`);
			if (row) pick('.nt-item-title', row).lastChild.textContent = noteTitle(note);
		});
		ui.title.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter') return;
			event.preventDefault();
			ui.body.focus();
		});
		ui.title.addEventListener('blur', () => drawList());

		ui.body.addEventListener('input', () => {
			const note = editableNote();
			if (!note) return;
			note.body = ui.body.value;
			markChanged(note);
			fitAllHeights();
		});
		ui.body.addEventListener('blur', () => {
			const note = openNote();
			if (!note) return;
			drawByline(note);
			drawList();
		});
	}

	function bindToolbar() {
		function withOpenNote(run) {
			return () => {
				const note = openNote();
				if (note) run(note);
			};
		}
		ui.pin.addEventListener(
			'click',
			withOpenNote((note) => togglePin(note, !note.pinned)),
		);
		ui.archive.addEventListener(
			'click',
			withOpenNote((note) => relocate(note, 'archived')),
		);
		ui.trash.addEventListener(
			'click',
			withOpenNote((note) => relocate(note, 'trashed')),
		);
		ui.duplicate.addEventListener('click', withOpenNote(cloneNote));
		ui.download.addEventListener('click', withOpenNote(saveAsFile));
		ui.copy.addEventListener(
			'click',
			withOpenNote((note) => {
				window.Basalt.copyText(plainText(note)).then(() =>
					notify({
						tone: 'success',
						icon: 'bi-clipboard-check',
						title: 'Copied',
						text: 'Paste it into an email or a chat.',
					}),
				);
			}),
		);

		ui.tintChoices.addEventListener('change', (event) => {
			const note = openNote();
			if (!note || event.target.name !== 'nt-color') return;
			paint(note, event.target.value);
			announce(`Color: ${TINTS[event.target.value]}`);
			ui.tintButton.focus();
		});

		/* The archive and trash banner above the note. */
		ui.banner.addEventListener('click', (event) => {
			const note = openNote();
			if (!note) return;
			if (event.target.closest('[data-nt-restore], [data-nt-unarchive]')) relocate(note, 'active');
			else if (event.target.closest('[data-nt-purge-one]')) confirmPurge([note.id]);
		});
	}

	/* Checklist rows: tick, edit, Enter for a new row, Backspace on an
     empty one to drop it, the x to remove it, and the add field. */
	function bindTasks() {
		ui.taskList.addEventListener('change', (event) => {
			const note = openNote();
			const row = event.target.closest('[data-nt-item]');
			if (!note || !row || !event.target.matches('[data-nt-item-done]')) return;
			const task = taskOf(note, row);
			if (note.status === 'trashed') {
				event.target.checked = task.done;
				return;
			}
			task.done = event.target.checked;
			row.classList.toggle('is-done', task.done);
			markChanged(note, true);
			drawTasks(note);
			drawTally();
			drawMenus();
			drawList();
			document.getElementById(`nt-ci-${task.id}`)?.focus();
			if (note.tasks.every((entry) => entry.done)) announce(`All ${note.tasks.length} items done`);
		});

		ui.taskList.addEventListener('input', (event) => {
			const note = openNote();
			const row = event.target.closest('[data-nt-item]');
			if (!note || !row || !event.target.matches('[data-nt-item-text]')) return;
			const task = taskOf(note, row);
			task.text = event.target.value.replace(/\n/g, ' ');
			fitHeight(event.target);
			markChanged(note);
		});

		ui.taskList.addEventListener('keydown', onTaskKey);

		/* A row left empty is dropped once focus leaves the checklist. */
		ui.taskList.addEventListener('focusout', (event) => {
			const note = openNote();
			if (!note || !event.target.matches('[data-nt-item-text]') || ui.taskList.contains(event.relatedTarget))
				return;
			const countBefore = note.tasks.length;
			note.tasks = note.tasks.filter((task) => task.text.trim());
			if (note.tasks.length !== countBefore) {
				markChanged(note, true);
				drawTasks(note);
			}
			drawTally();
			drawMenus();
			drawList();
			drawByline(note);
		});

		ui.taskList.addEventListener('click', (event) => {
			const button = event.target.closest('[data-nt-item-remove]');
			const note = openNote();
			if (!button || !note || note.status === 'trashed') return;
			const at = taskIndex(note, button.closest('[data-nt-item]'));
			const [removed] = note.tasks.splice(at, 1);
			markChanged(note, true);
			drawTasks(note);
			drawTally();
			drawMenus();
			drawList();
			const after = note.tasks[Math.min(at, note.tasks.length - 1)];
			if (after) pick(`#nt-ci-${after.id}`).focus();
			else ui.taskInput.focus();
			notify({
				icon: 'bi-x-circle',
				title: 'Item removed',
				text: removed.text,
				actions: [
					{
						label: 'Undo',
						onClick() {
							note.tasks.splice(at, 0, removed);
							markChanged(note, true);
							if (note.id === model.openId) drawTasks(note);
							drawTally();
							drawMenus();
							drawList();
						},
					},
				],
			});
		});

		ui.taskForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const note = openNote();
			const wording = ui.taskInput.value.trim();
			if (!note || !wording || note.status === 'trashed') return;
			note.tasks.push({ id: freshTaskId(note), text: wording, done: false });
			ui.taskInput.value = '';
			markChanged(note, true);
			drawTasks(note);
			drawTally();
			drawMenus();
			drawList();
			drawByline(note);
			ui.taskInput.focus();
		});

		ui.clearDone.addEventListener('click', () => {
			const note = openNote();
			if (!note) return;
			const restorable = note.tasks.slice();
			note.tasks = note.tasks.filter((task) => !task.done);
			markChanged(note, true);
			drawTasks(note);
			drawList();
			drawMenus();
			ui.taskInput.focus();
			notify({
				title: 'Checked items removed',
				text: `${counted(restorable.length - note.tasks.length, 'item', 'items')} cleared`,
				actions: [
					{
						label: 'Undo',
						onClick() {
							note.tasks = restorable;
							markChanged(note, true);
							if (note.id === model.openId) drawTasks(note);
							drawList();
							drawMenus();
							drawTally();
						},
					},
				],
			});
		});
	}

	function onTaskKey(event) {
		const note = openNote();
		const row = event.target.closest('[data-nt-item]');
		if (!note || !row || !event.target.matches('[data-nt-item-text]') || note.status === 'trashed') return;
		const at = taskIndex(note, row);

		if (event.key === 'Enter') {
			/* A new row opens just below, as on a paper list. */
			event.preventDefault();
			const added = { id: freshTaskId(note), text: '', done: false };
			note.tasks.splice(at + 1, 0, added);
			markChanged(note);
			drawTasks(note);
			document.getElementById(`nt-ct-${added.id}`).focus();
			return;
		}

		if (event.key === 'Backspace' && !event.target.value) {
			event.preventDefault();
			note.tasks.splice(at, 1);
			markChanged(note, true);
			drawTasks(note);
			const above = note.tasks[Math.max(0, at - 1)];
			if (above) document.getElementById(`nt-ct-${above.id}`).focus();
			else ui.taskInput.focus();
			drawTally();
			return;
		}

		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		const goingDown = event.key === 'ArrowDown';
		const neighbor = note.tasks[at + (goingDown ? 1 : -1)];
		if (neighbor) {
			event.preventDefault();
			document.getElementById(`nt-ct-${neighbor.id}`).focus();
		} else if (goingDown) {
			event.preventDefault();
			ui.taskInput.focus();
		}
	}

	/* Tags go through the shared tag input from basalt.js. */
	function bindTags() {
		ui.tags.addEventListener('change', () => {
			const note = openNote();
			if (!note || quietTags || !ui.tags.basaltTags || note.status === 'trashed') return;
			const cleaned = ui.tags.basaltTags
				.get()
				.map((tag) => tag.toLowerCase().replace(/^#/, '').replace(/\s+/g, '-'));
			if (cleaned.join() === note.tags.join()) return;
			note.tags = cleaned;
			markChanged(note, true);
			drawMenus();
			drawList();
		});
		ui.tags.addEventListener('basalt:tags-duplicate', (event) =>
			announce(`#${event.detail.value} is already on this note`),
		);
	}

	/* Single keys work anywhere except while typing: / searches, N and L
     start a note or a checklist, ? opens the list of shortcuts. */
	function bindShortcuts() {
		const keyActions = new Map([
			['/', { run: focusSearchBox }],
			['n', { afterLoad: true, run: () => startNote() }],
			['l', { afterLoad: true, run: () => startNote({ checklist: true }) }],
			['?', { run: () => bootstrap.Modal.getOrCreateInstance(ui.shortcutsDialog).show() }],
		]);
		document.addEventListener('keydown', (event) => {
			if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
			const origin = event.target;
			if (
				origin.isContentEditable ||
				/^(INPUT|TEXTAREA|SELECT)$/.test(origin.tagName) ||
				pick('.modal.show, .dropdown-menu.show')
			)
				return;
			const shortcut = keyActions.get(event.key.toLowerCase());
			if (!shortcut || (shortcut.afterLoad && !model.ready)) return;
			event.preventDefault();
			shortcut.run();
		});

		/* The hints name the modifier key this visitor actually has. */
		if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
			for (const hint of pickAll('[data-nt-mod-key]', shell)) hint.textContent = '⌘';
		}
	}

	function bindLayout() {
		/* Crossing the one-pane width changes which panes are on screen. */
		narrowScreen.addEventListener('change', () => {
			if (!singlePane() && !model.openId && model.ready) {
				const leading = shownNotes()[0];
				if (leading) {
					showNote(leading.id);
					return;
				}
			}
			drawEditor();
		});
		window.addEventListener('resize', () => {
			clearTimeout(resizeDelay);
			resizeDelay = setTimeout(fitAllHeights, 120);
		});
		/* Relative times such as "2 min ago" stay true while the page is open. */
		setInterval(() => {
			if (!model.ready) return;
			drawList();
			const note = openNote();
			if (note) drawByline(note);
			if (ui.saveState.dataset.state === 'idle') showSaveState('idle');
		}, 60000);
	}

	/* Saving. Every edit goes through markChanged(), then pushChanges(). */

	/**
	 * Stamps a note as edited now and queues it for the server.
	 * @param {object} note
	 * @param {boolean} [immediate] true sends it at once (buttons); typing
	 *   waits for a pause of 700ms.
	 */
	function markChanged(note, immediate) {
		note.editedAt = new Date();
		model.untouched.delete(note.id);
		outbox.queue.add(note.id);
		clearTimeout(outbox.timer);
		if (note.id === model.openId) showSaveState('dirty');
		outbox.timer = setTimeout(pushChanges, immediate ? 0 : 700);
	}

	/** Sends every queued note; a failure puts them back in the queue. */
	function pushChanges() {
		clearTimeout(outbox.timer);
		const batch = [...outbox.queue];
		if (!batch.length) return Promise.resolve();
		outbox.queue.clear();
		outbox.busy += 1;
		if (batch.includes(model.openId)) showSaveState('saving');
		const requests = batch.map((id) => {
			const note = findNote(id);
			return note ? server.write(note) : null;
		});
		return Promise.all(requests)
			.then(() => {
				outbox.broken = false;
				if (batch.includes(model.openId) && !outbox.queue.size) showSaveState('saved');
			})
			.catch(() => {
				for (const id of batch) outbox.queue.add(id);
				outbox.broken = true;
				showSaveState('error');
			})
			.finally(() => {
				outbox.busy -= 1;
			});
	}

	/** @param {'idle'|'dirty'|'saving'|'saved'|'error'} phase */
	function showSaveState(phase) {
		const note = openNote();
		const { glyph, caption } = {
			idle: { glyph: 'bi-cloud-check', caption: note ? `Saved ${relative(note.editedAt)}` : 'Saved' },
			dirty: { glyph: 'bi-pencil', caption: 'Editing' },
			saving: { glyph: 'bi-arrow-repeat', caption: 'Saving' },
			saved: { glyph: 'bi-cloud-check', caption: `Saved at ${clockTime(new Date())}` },
			error: { glyph: 'bi-cloud-slash', caption: 'Not saved. Check your connection.' },
		}[phase];
		ui.saveState.dataset.state = phase;
		ui.saveIcon.className = `bi ${glyph}`;
		ui.saveText.textContent = caption;
		ui.retry.hidden = phase !== 'error';
		/* The edit hint shows only while all is calm and the note is editable. */
		const calm = phase === 'idle' || phase === 'saved';
		ui.editHint.hidden = !calm || !note || note.status === 'trashed';
	}

	/* The list pane: menus, filter chips, rows and empty states. */

	function refreshAll() {
		drawMenus();
		drawTally();
		drawChips();
		drawList();
	}

	/** The notes the current view, filters, search and sort let through. */
	function shownNotes() {
		const lens = lensFor(model.lens);
		const kept = model.notes.filter(
			(note) =>
				lens.admits(note) &&
				(!model.tag || note.tags.includes(model.tag)) &&
				(!model.tint || note.tint === model.tint) &&
				fitsQuery(note, model.searchText),
		);
		if (model.lens === 'trashed') return kept.sort((a, b) => b.deletedAt - a.deletedAt);
		return kept.sort(ORDERINGS[model.order]);
	}

	function lensFor(key) {
		return LENSES.find((lens) => lens.key === key) || LENSES[0];
	}

	function fitsQuery(note, term) {
		if (!term) return true;
		const haystack = [
			note.title,
			note.body,
			note.tasks.map((task) => task.text).join('\n'),
			note.tags.map((tag) => `#${tag}`).join(' '),
		].join('\n');
		return haystack.toLowerCase().includes(term);
	}

	/* The view menu, plus the tags and tints offered in the filter menu.
     Tags are counted from the notes themselves, so the list never drifts. */
	function drawMenus() {
		ui.lensMenu.innerHTML = LENSES.map(lensOption).join('');

		const perTag = {};
		for (const note of model.notes) {
			if (note.status !== 'active') continue;
			for (const tag of note.tags) perTag[tag] = (perTag[tag] || 0) + 1;
		}
		const tagNames = Object.keys(perTag).sort();
		ui.tagFilters.innerHTML = tagNames.length
			? tagNames.map((tag) => tagOption(tag, perTag[tag])).join('')
			: '<li class="nt-tagnav-none">No tags yet. Add one from a note.</li>';

		ui.tintFilters.innerHTML = Object.keys(TINTS)
			.filter(Boolean)
			.map((tint) => tintOption(tint))
			.join('');

		const inUse = Number(Boolean(model.tag)) + Number(Boolean(model.tint));
		ui.filterBadge.textContent = inUse;
		ui.filterBadge.hidden = !inUse;
		ui.filterButton.setAttribute('aria-label', `Filter by tag or color${inUse ? `, ${inUse} in use` : ''}`);
	}

	function lensOption(lens) {
		const activeNow = model.lens === lens.key;
		const itemTotal = model.notes.filter(lens.admits).length;
		const rule = lens.ruleAbove ? '<li><hr class="dropdown-divider"></li>' : '';
		return (
			`${rule}<li><button class="dropdown-item${activeNow ? ' active' : ''}" type="button" data-nt-view="${lens.key}"${activeNow ? ' aria-current="true"' : ''}>` +
			`<i class="bi ${lens.glyph}" aria-hidden="true"></i><span>${htmlSafe(lens.title)}</span>` +
			`<span class="nt-views-count"><span class="visually-hidden">, </span>${numbers.format(itemTotal)}<span class="visually-hidden"> notes</span></span></button></li>`
		);
	}

	function tagOption(tag, uses) {
		return (
			`<li><button class="nt-tagnav-item" type="button" data-nt-tag="${htmlSafe(tag)}" aria-pressed="${model.tag === tag}">#${htmlSafe(tag)}` +
			`<span class="nt-tagnav-count"><span class="visually-hidden">, </span>${uses}<span class="visually-hidden"> notes</span></span></button></li>`
		);
	}

	function tintOption(tint) {
		return (
			`<button class="nt-colors-item" type="button" data-nt-color-filter="${tint}" aria-pressed="${model.tint === tint}">` +
			`<span class="nt-dot nt-dot-${tint}" aria-hidden="true"></span>${htmlSafe(TINTS[tint])}</button>`
		);
	}

	/* The line under the workspace name: how much the notebook holds. */
	function drawTally() {
		if (!model.ready) return;
		const live = model.notes.filter((note) => note.status === 'active');
		const waiting = live.reduce((sum, note) => sum + openTasks(note), 0);
		ui.workspaceLine.textContent = `${counted(live.length, 'note', 'notes')} · ${counted(waiting, 'open to-do', 'open to-dos')}`;
	}

	/* Removable chips for the filters in use, drawn by basalt.js. */
	function drawChips() {
		const filterChips = [];
		if (model.tag) {
			filterChips.push({
				label: `#${model.tag}`,
				remove() {
					model.tag = '';
					refreshAll();
				},
			});
		}
		if (model.tint) {
			filterChips.push({
				label: `${TINTS[model.tint]} notes`,
				remove() {
					model.tint = '';
					refreshAll();
				},
			});
		}
		window.Basalt.drawer?.applied(ui.chipRow, filterChips, clearFilters, ui.search);
	}

	function clearFilters() {
		model.tag = '';
		model.tint = '';
		refreshAll();
	}

	function drawList() {
		const term = model.searchText;
		const visibleNotes = shownNotes();
		const lens = lensFor(model.lens);
		const narrowed = term || model.tag || model.tint;
		ui.lensTitle.textContent = lens.title;
		ui.lensHeading.textContent = lens.title;
		ui.lensIcon.className = `bi ${lens.glyph}`;
		ui.tally.textContent = model.ready
			? `${counted(visibleNotes.length, 'note', 'notes')}${narrowed ? ' found' : ''}`
			: 'Loading notes';

		/* In the trash, the quick capture field gives way to Empty trash. */
		const inTrash = model.lens === 'trashed';
		ui.capture.hidden = inTrash;
		ui.emptyTrash.hidden = !(inTrash && model.notes.some((note) => note.status === 'trashed'));
		if (!model.ready) return;

		if (!visibleNotes.length) {
			ui.listbox.hidden = true;
			ui.listbox.innerHTML = '';
			drawEmpty();
			return;
		}
		ui.empty.hidden = true;
		ui.listbox.hidden = false;

		const groupsPinned = ['all', 'mine', 'todo'].includes(model.lens);
		const pinned = groupsPinned ? visibleNotes.filter((note) => note.pinned) : [];
		const others = visibleNotes.filter((note) => !pinned.includes(note));
		function rowsOf(notes) {
			return notes.map((note) => noteRow(note, term)).join('');
		}
		if (pinned.length) {
			ui.listbox.innerHTML =
				rowGroup('pinned', 'Pinned', rowsOf(pinned)) +
				(others.length ? rowGroup('rest', 'Other notes', rowsOf(others)) : '');
		} else {
			ui.listbox.innerHTML = rowsOf(others);
		}
		/* One row always stays reachable with Tab, even when the open note
       is not in the list. */
		if (!pick('.nt-item[tabindex="0"]', ui.listbox)) pick('.nt-item', ui.listbox).tabIndex = 0;
	}

	function rowGroup(slug, heading, inner) {
		return `<div aria-labelledby="nt-grp-${slug}" role="group"><p id="nt-grp-${slug}" class="nt-group" role="presentation">${heading}</p>${inner}</div>`;
	}

	/** One list row, with search hits wrapped in <mark>. */
	function noteRow(note, term) {
		const itemTotal = note.tasks.length;
		const ticked = note.tasks.filter((task) => task.done).length;
		const selected = note.id === model.openId;
		const when = model.lens === 'trashed' ? `deleted ${relative(note.deletedAt)}` : relative(note.editedAt);
		const pinMark =
			note.pinned && model.lens !== 'pinned'
				? '<i class="bi bi-pin-angle-fill nt-item-pin" aria-hidden="true"></i><span class="visually-hidden">Pinned: </span>'
				: '';
		const tickTally = itemTotal
			? `<span class="nt-item-check${ticked === itemTotal ? ' is-done' : ''}"><i class="bi bi-check2-square" aria-hidden="true"></i>${ticked} of ${itemTotal}<span class="visually-hidden"> done</span></span>`
			: '';
		const tagMarks =
			note.tags
				.slice(0, 2)
				.map((tag) => `<span class="nt-item-tag">#${markHits(tag, term)}</span>`)
				.join('') + (note.tags.length > 2 ? `<span class="nt-item-tag">+${note.tags.length - 2}</span>` : '');
		const firstName = personName(note.by).split(' ')[0];

		return (
			`<div id="nt-opt-${note.id}" class="nt-item${note.tint ? ` nt-tone-${note.tint}` : ''}" data-nt-open="${note.id}" role="option" aria-selected="${selected}" tabindex="${selected ? '0' : '-1'}">` +
			`<p class="nt-item-title">${pinMark}${markHits(noteTitle(note), term)}</p>` +
			`<p class="nt-item-snip">${markHits(excerpt(note, term), term)}</p>` +
			`<p class="nt-item-meta">${tickTally}${tagMarks}<span class="nt-item-when">${htmlSafe(firstName)}, ${htmlSafe(when)}</span></p>` +
			'</div>'
		);
	}

	/** @param {'error'} [kind] the notes failed to load */
	function drawEmpty(kind) {
		const lens = model.lens;
		const narrowed = model.tag || model.tint;
		const lensName = lensFor(lens).title.toLowerCase();
		const calm = !model.searchText && !narrowed;
		let look;

		if (kind === 'error') {
			look = {
				glyph: 'bi-cloud-slash',
				heading: "Your notes didn't load",
				line: 'Check your connection, then try again. Nothing you wrote has been lost.',
				buttons: '<button type="button" class="btn btn-sm btn-primary" data-nt-reload>Try again</button>',
			};
		} else if (model.searchText) {
			const partial = lens !== 'all' || narrowed;
			const widen = partial
				? '<button type="button" class="btn btn-sm btn-primary" data-nt-search-all>Search all notes</button>'
				: '';
			look = {
				glyph: 'bi-search',
				heading: `No notes match “${model.searchText}”`,
				line: partial
					? `This only searched ${lensName}${narrowed ? ' with the filters in use' : ''}.`
					: 'Check the spelling, or try a tag like #customers.',
				buttons: `<button type="button" class="btn btn-sm btn-outline-secondary" data-nt-clear-search>Clear the search</button>${widen}`,
			};
		} else if (narrowed) {
			const reasons = [
				model.tag && `#${model.tag}`,
				model.tint && `the color ${TINTS[model.tint].toLowerCase()}`,
			].filter(Boolean);
			look = {
				glyph: 'bi-funnel',
				heading: 'No notes with these filters',
				line: `Nothing in ${lensName} has ${reasons.join(' and ')}.`,
				buttons:
					'<button type="button" class="btn btn-sm btn-outline-secondary" data-nt-clear-filters>Clear filters</button>',
			};
		} else {
			look = RESTING[lens];
		}

		const { glyph, heading, line, buttons } = look;
		const emptyBox = ui.empty;
		emptyBox.classList.toggle('basalt-empty-danger', kind === 'error');
		/* A finished to-do list reads as good news; a load error that lands
       on that view leaves the tone as it was. */
		if (kind !== 'error') emptyBox.classList.toggle('basalt-empty-success', calm && lens === 'todo');
		else if (!(calm && lens === 'todo')) emptyBox.classList.remove('basalt-empty-success');

		pick('[data-nt-empty-icon]', emptyBox).className = `bi ${glyph}`;
		pick('[data-nt-empty-title]', emptyBox).textContent = heading;
		const lineNode = pick('[data-nt-empty-text]', emptyBox);
		lineNode.textContent = line;
		lineNode.hidden = !line;
		pick('[data-nt-empty-actions]', emptyBox).innerHTML = buttons;
		emptyBox.hidden = false;
	}

	function focusRows() {
		const landing = pick('.nt-item[tabindex="0"]', ui.listbox);
		if (landing && !ui.listbox.hidden) landing.focus();
		else ui.search.focus();
	}

	function focusSearchBox() {
		if (singlePane() && model.openId) ui.back.click();
		ui.search.focus();
		ui.search.select();
	}

	function syncThemeToggle() {
		const darkOn = Boolean(window.Basalt.getTheme) && window.Basalt.getTheme() === 'dark';
		ui.themeToggle.setAttribute('aria-pressed', String(darkOn));
	}

	/* The open note. */

	function drawEditor() {
		const note = openNote();
		ui.nothingOpen.hidden = Boolean(note);
		ui.editor.hidden = !note;
		ui.app.setAttribute('data-view', note ? 'note' : 'list');
		if (!note) return;

		const frozen = note.status === 'trashed';
		const live = note.status === 'active';
		ui.editor.dataset.tone = note.tint || '';
		ui.editor.className = `nt-note${note.tint ? ` nt-tone-${note.tint}` : ''}${frozen ? ' is-locked' : ''}`;
		if (ui.title.value !== note.title) ui.title.value = note.title;
		if (ui.body.value !== note.body) ui.body.value = note.body;
		for (const control of [ui.title, ui.body, ui.taskInput]) control.readOnly = frozen;
		ui.taskForm.hidden = frozen;
		ui.taskSection.hidden = frozen && !note.tasks.length;

		/* Only the actions that fit where the note currently lives. */
		const pinLabel = note.pinned ? 'Unpin' : 'Pin to the top';
		ui.pin.setAttribute('aria-pressed', String(note.pinned));
		ui.pin.setAttribute('aria-label', pinLabel);
		pick('i', ui.pin).className = `bi ${note.pinned ? 'bi-pin-angle-fill' : 'bi-pin-angle'}`;
		setTooltip(ui.pin, pinLabel);
		ui.tintDot.className = `nt-dot${note.tint ? ` nt-dot-${note.tint}` : ''}`;
		ui.tintButton.setAttribute('aria-label', `Color: ${TINTS[note.tint]}`);
		drawTintChoices(note);
		ui.pin.hidden = !live;
		ui.archive.hidden = !live;
		ui.tintButton.parentElement.hidden = frozen;
		ui.trash.hidden = frozen;

		drawBanner(note);
		drawByline(note);
		drawTasks(note);
		if (ui.tags.basaltTags) {
			quietTags = true;
			ui.tags.basaltTags.set(note.tags);
			quietTags = false;
		}
		pick('.basalt-tags-input', ui.tags).disabled = frozen || note.tags.length >= 6;
		let phase = 'idle';
		if (outbox.queue.has(note.id)) phase = outbox.broken ? 'error' : 'dirty';
		showSaveState(phase);
		fitAllHeights();
	}

	function drawTintChoices(note) {
		ui.tintChoices.innerHTML = Object.keys(TINTS)
			.map((tint) => {
				const slug = `nt-color-${tint || 'none'}`;
				return (
					`<div class="nt-color-menu-opt"><input id="${slug}" class="btn-check" type="radio" name="nt-color" value="${tint}"${note.tint === tint ? ' checked' : ''}>` +
					`<label class="dropdown-item" for="${slug}"><span class="nt-dot${tint ? ` nt-dot-${tint}` : ''}" aria-hidden="true"></span>${htmlSafe(TINTS[tint])}</label></div>`
				);
			})
			.join('');
	}

	function drawByline(note) {
		const facts = [
			`${personName(note.by)} started this ${relative(note.createdAt)}`,
			`edited ${relative(note.editedAt)}`,
			counted(wordCount(note), 'word', 'words'),
		];
		if (note.status === 'trashed') facts.unshift(`Deleted ${relative(note.deletedAt)}`);
		ui.byline.textContent = facts.join(' · ');
		ui.byline.title = `Created ${longStamp(note.createdAt)}. Last edited ${longStamp(note.editedAt)}.`;
	}

	function drawTasks(note) {
		const frozen = note.status === 'trashed';
		const itemTotal = note.tasks.length;
		const ticked = note.tasks.filter((task) => task.done).length;
		const percent = itemTotal ? Math.round((ticked / itemTotal) * 100) : 0;
		ui.taskCount.textContent = itemTotal ? `${ticked} of ${itemTotal} done` : 'Nothing on the list yet';
		ui.taskBar.hidden = !itemTotal;
		ui.taskBar.setAttribute('aria-valuenow', percent);
		ui.taskBar.setAttribute('aria-valuetext', `${ticked} of ${itemTotal} done`);
		ui.taskFill.style.width = `${percent}%`;
		ui.clearDone.hidden = !ticked || frozen;
		ui.taskList.innerHTML = note.tasks.map((task) => taskRow(task, frozen)).join('');
		for (const control of pickAll('.nt-check-text', ui.taskList)) fitHeight(control);
	}

	function taskRow(task, frozen) {
		const caption = htmlSafe(task.text);
		return (
			`<li class="nt-check-item${task.done ? ' is-done' : ''}" data-nt-item="${task.id}">` +
			`<input id="nt-ci-${task.id}" class="form-check-input" type="checkbox" data-nt-item-done aria-label="Done: ${caption}"${task.done ? ' checked' : ''}${frozen ? ' disabled' : ''}>` +
			`<label class="visually-hidden" for="nt-ct-${task.id}">Checklist item</label>` +
			`<textarea id="nt-ct-${task.id}" class="nt-check-text" data-nt-item-text rows="1" maxlength="160"${frozen ? ' readonly' : ''}>${caption}</textarea>` +
			`<button class="btn btn-icon btn-sm nt-check-remove" type="button" data-nt-item-remove aria-label="Remove: ${caption}"><i class="bi bi-x-lg" aria-hidden="true"></i></button>` +
			'</li>'
		);
	}

	/* The strip above an archived or trashed note, with the way back. */
	function drawBanner(note) {
		const banner = ui.banner;
		if (note.status === 'active') {
			banner.hidden = true;
			return;
		}
		const inTrash = note.status === 'trashed';
		banner.hidden = false;
		banner.dataset.kind = note.status;
		pick('[data-nt-banner-icon]', banner).className = `bi ${inTrash ? 'bi-trash3' : 'bi-archive'}`;
		if (inTrash) {
			const daysLeft = Math.max(0, SAMPLE.trashDays - Math.floor((Date.now() - note.deletedAt) / DAY));
			pick('[data-nt-banner-text]', banner).textContent =
				`This note is in the trash and can't be edited. It is deleted for good in ${counted(daysLeft, 'day', 'days')}.`;
			pick('[data-nt-banner-actions]', banner).innerHTML =
				'<button type="button" class="btn btn-sm btn-primary" data-nt-restore><i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Restore</button>' +
				'<button type="button" class="btn btn-sm btn-outline-danger" data-nt-purge-one>Delete for good</button>';
			return;
		}
		pick('[data-nt-banner-text]', banner).textContent =
			'This note is archived. It stays out of All notes but still turns up in search here.';
		pick('[data-nt-banner-actions]', banner).innerHTML =
			'<button type="button" class="btn btn-sm btn-outline-secondary" data-nt-unarchive><i class="bi bi-box-arrow-up me-1" aria-hidden="true"></i>Move back to notes</button>';
	}

	/** Lets a text box grow with its content so nothing is clipped. */
	function fitHeight(box, floor = 0) {
		box.style.height = 'auto';
		box.style.height = `${Math.max(box.scrollHeight, floor)}px`;
	}

	function fitAllHeights() {
		if (ui.editor.hidden) return;
		fitHeight(ui.title);
		fitHeight(ui.body, 72);
		for (const control of pickAll('.nt-check-text', ui.taskList)) fitHeight(control);
	}

	function setTooltip(button, label) {
		button.setAttribute('data-bs-title', label);
		window.bootstrap?.Tooltip.getInstance(button)?.setContent({ '.tooltip-inner': label });
	}

	/* Note actions. Each one changes the model, queues a save and redraws. */

	function showNote(id) {
		if (model.openId && model.openId !== id) discardIfBlank(model.openId);
		model.openId = id;
		drawEditor();
		drawList();
	}

	/* A note made with New note and never typed into is not kept. */
	function discardIfBlank(id) {
		const note = findNote(id);
		if (!note || !model.untouched.has(id)) return;
		if (note.title.trim() || note.body.trim() || note.tasks.length) return;
		model.notes = model.notes.filter((candidate) => candidate !== note);
		model.untouched.delete(id);
		outbox.queue.delete(id);
	}

	/**
	 * Adds a note at the top of the list and opens it.
	 * @param {{title?: string, checklist?: boolean}} [options] a title
	 *   saves the note at once; checklist puts the caret in the add field.
	 */
	function startNote({ title = '', checklist = false } = {}) {
		serial += 1;
		const now = new Date();
		const note = {
			id: `n-${serial}`,
			title,
			body: '',
			tasks: [],
			tags: model.tag ? [model.tag] : [],
			tint: model.tint || '',
			pinned: false,
			status: 'active',
			by: SAMPLE.owner,
			createdAt: now,
			editedAt: now,
			deletedAt: null,
		};
		model.notes.unshift(note);
		if (model.lens !== 'all' && model.lens !== 'mine') model.lens = 'all';
		model.searchText = '';
		ui.search.value = '';
		if (title) markChanged(note, true);
		else model.untouched.add(note.id);
		showNote(note.id);
		refreshAll();

		if (checklist) ui.taskInput.focus();
		else if (title) ui.body.focus();
		else ui.title.focus();
		announce(checklist ? 'New checklist. Type the first item.' : 'New note. Type a title.');
	}

	function togglePin(note, pinned) {
		note.pinned = pinned;
		markChanged(note, true);
		refreshAll();
		drawEditor();
		announce(pinned ? 'Pinned to the top' : 'Unpinned');
	}

	function paint(note, tint) {
		note.tint = tint;
		markChanged(note, true);
		refreshAll();
		drawEditor();
	}

	/**
	 * Moves a note between active, archived and trashed, and offers an undo.
	 * @param {object} note
	 * @param {'active'|'archived'|'trashed'} destination
	 */
	function relocate(note, destination) {
		const before = { status: note.status, deletedAt: note.deletedAt, pinned: note.pinned };
		const heading = noteTitle(note);
		note.status = destination;
		note.deletedAt = destination === 'trashed' ? new Date() : null;
		if (destination === 'trashed') note.pinned = false;
		markChanged(note, true);
		model.openId = destination === 'active' ? note.id : successor(note);
		if (destination === 'active' && before.status !== 'active') model.lens = 'all';
		refreshAll();
		drawEditor();

		const outcome = {
			archived: { title: 'Archived', icon: 'bi-archive' },
			trashed: { title: 'Moved to the trash', icon: 'bi-trash3' },
			active: {
				title: before.status === 'trashed' ? 'Restored' : 'Back in your notes',
				icon: 'bi-arrow-counterclockwise',
			},
		}[destination];
		notify({
			...outcome,
			tone: destination === 'trashed' ? 'danger' : 'primary',
			text: heading,
			actions: [
				{
					label: 'Undo',
					onClick() {
						Object.assign(note, before);
						markChanged(note, true);
						if (!lensFor(model.lens).admits(note))
							model.lens = before.status === 'active' ? 'all' : before.status;
						showNote(note.id);
						refreshAll();
						announce('Undone');
					},
				},
			],
		});
		focusRows();
	}

	/* Which note to show once the open one leaves the list. */
	function successor(note) {
		if (singlePane()) return null;
		const visibleNotes = shownNotes();
		const at = visibleNotes.indexOf(note);
		const chosen = at === -1 ? visibleNotes[0] : visibleNotes[at + 1] || visibleNotes[at - 1];
		return chosen && chosen !== note ? chosen.id : null;
	}

	function cloneNote(note) {
		const twin = JSON.parse(JSON.stringify(note));
		serial += 1;
		twin.id = `n-${serial}`;
		twin.title = `${noteTitle(note)} (copy)`;
		for (const [position, task] of twin.tasks.entries()) task.id = `${twin.id}-c${position}`;
		twin.createdAt = new Date();
		twin.editedAt = new Date();
		twin.deletedAt = null;
		twin.pinned = false;
		twin.by = SAMPLE.owner;
		model.notes.unshift(twin);
		markChanged(twin, true);
		showNote(twin.id);
		refreshAll();
		notify({ tone: 'success', title: 'Copy made', text: twin.title });
	}

	/** The note as plain text, for the clipboard and the download. */
	function plainText(note) {
		const textLines = [noteTitle(note), '', note.body];
		if (note.tasks.length)
			textLines.push('', ...note.tasks.map((task) => `${task.done ? '[x]' : '[ ]'} ${task.text}`));
		if (note.tags.length) textLines.push('', note.tags.map((tag) => `#${tag}`).join(' '));
		return `${textLines.join('\n').trim()}\n`;
	}

	function saveAsFile(note) {
		const slug =
			noteTitle(note)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '') || 'note';
		const blobUrl = URL.createObjectURL(new Blob([plainText(note)], { type: 'text/plain' }));
		const anchor = document.createElement('a');
		anchor.href = blobUrl;
		anchor.download = `${slug}.txt`;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
	}

	/* Deleting for good happens only from the trash, behind the
     hold-to-confirm dialog. */
	function confirmPurge(ids) {
		purgeTargets = ids;
		const dialog = ui.purgeDialog;
		const several = ids.length > 1;
		const listed = ids
			.slice(0, 4)
			.map(
				(id) =>
					`<li><i class="bi bi-x-circle" aria-hidden="true"></i>${htmlSafe(noteTitle(findNote(id)))}</li>`,
			);
		if (ids.length > 4)
			listed.push(`<li><i class="bi bi-three-dots" aria-hidden="true"></i>and ${ids.length - 4} more</li>`);
		pick('[data-nt-purge-title]', dialog).textContent = several
			? `Delete ${ids.length} notes for good?`
			: 'Delete this note for good?';
		pick('[data-nt-purge-text]', dialog).textContent = several
			? "Everything in the trash goes. It can't be brought back afterwards."
			: "It can't be brought back afterwards.";
		pick('[data-nt-purge-list]', dialog).innerHTML = listed.join('');
		bootstrap.Modal.getOrCreateInstance(dialog).show();
	}

	function purgeNow() {
		const doomed = purgeTargets.slice();
		bootstrap.Modal.getOrCreateInstance(ui.purgeDialog).hide();
		server
			.erase(doomed)
			.then(() => {
				model.notes = model.notes.filter((note) => !doomed.includes(note.id));
				if (doomed.includes(model.openId)) model.openId = null;
				refreshAll();
				drawEditor();
				notify({
					tone: 'success',
					icon: 'bi-trash3',
					title:
						doomed.length > 1
							? `${counted(doomed.length, 'note', 'notes')} deleted for good`
							: 'Deleted for good',
				});
				focusRows();
			})
			.catch(() => {
				notify({
					tone: 'danger',
					title: "Couldn't delete",
					text: 'Nothing was removed. Try again in a moment.',
				});
			});
	}

	function switchLens(key) {
		model.lens = key;
		model.openId = null;
		refreshAll();
		const leading = shownNotes()[0];
		if (leading && !singlePane()) showNote(leading.id);
		else drawEditor();
	}

	/* Lookups and formatting. */

	function gather(hooks) {
		const refs = {};
		for (const [key, hook] of Object.entries(hooks)) {
			refs[key] = hook.startsWith('#') ? pick(hook) : pick(`[data-nt-${hook}]`, shell);
		}
		return refs;
	}

	function findNote(id) {
		return model.notes.find((note) => note.id === id);
	}

	function openNote() {
		return findNote(model.openId);
	}

	/* The open note, unless it sits in the trash and so cannot change. */
	function editableNote() {
		const note = openNote();
		return note && note.status !== 'trashed' ? note : null;
	}

	function taskIndex(note, row) {
		return note.tasks.findIndex((task) => task.id === row.getAttribute('data-nt-item'));
	}

	function taskOf(note, row) {
		return note.tasks.find((task) => task.id === row.getAttribute('data-nt-item'));
	}

	function freshTaskId(note) {
		return `${note.id}-c${Date.now().toString(36)}`;
	}

	function openTasks(note) {
		return note.tasks.filter((task) => !task.done).length;
	}

	function noteTitle(note) {
		return note.title.trim() || 'Untitled note';
	}

	function personName(key) {
		return SAMPLE.team[key] || 'Someone';
	}

	/* Below 992px the list and the open note take turns on screen. */
	function singlePane() {
		return narrowScreen.matches;
	}

	function wordCount(note) {
		const everything = [note.title, note.body, note.tasks.map((task) => task.text).join(' ')].join(' ');
		return everything.trim().split(/\s+/).filter(Boolean).length;
	}

	/* A line of text around the first search hit, or the opening of the
     note; a note with no text falls back to its first open task. */
	function excerpt(note, term) {
		const flat = note.body.replace(/\s+/g, ' ').trim();
		if (term) {
			const hit = flat.toLowerCase().indexOf(term);
			if (hit > 40) return `…${flat.slice(hit - 30, hit + 110)}`;
			if (hit === -1) {
				const task = note.tasks.find((entry) => entry.text.toLowerCase().includes(term));
				if (task) return taskLine(task);
			}
		}
		if (flat) return flat.slice(0, 140);
		const fallbackTask = note.tasks.find((task) => !task.done) || note.tasks[0];
		return fallbackTask ? taskLine(fallbackTask) : 'No text yet';
	}

	function taskLine(task) {
		return `${task.done ? 'Done' : 'To do'}: ${task.text}`;
	}

	/** Escapes text and wraps each case-insensitive match of query in <mark>. */
	function markHits(content, term) {
		const raw = String(content);
		if (!term) return htmlSafe(raw);
		const lower = raw.toLowerCase();
		const pieces = [];
		let cursor = 0;
		for (let hit = lower.indexOf(term); hit !== -1; hit = lower.indexOf(term, cursor)) {
			pieces.push(
				htmlSafe(raw.slice(cursor, hit)),
				`<mark class="nt-mark">${htmlSafe(raw.slice(hit, hit + term.length))}</mark>`,
			);
			cursor = hit + term.length;
		}
		pieces.push(htmlSafe(raw.slice(cursor)));
		return pieces.join('');
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (character) => ENTITIES[character]);
	}

	function counted(amount, one, many) {
		return `${numbers.format(amount)} ${amount === 1 ? one : many}`;
	}

	function relative(date) {
		const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
		if (seconds < 50) return 'just now';
		if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
		if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
		const dayCount = Math.round(seconds / 86400);
		if (dayCount === 1) return 'yesterday';
		if (dayCount < 7) return `${dayCount} days ago`;
		const thisYear = date.getFullYear() === new Date().getFullYear();
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: thisYear ? undefined : 'numeric',
		});
	}

	function clockTime(date) {
		return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	}

	function longStamp(date) {
		return `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${clockTime(date)}`;
	}

	function announce(message) {
		window.Basalt.announce?.(message);
	}

	function notify(options) {
		return window.Basalt.toasts?.push(options);
	}

	function pause(ms) {
		return new Promise((resolve) => {
			setTimeout(resolve, ms);
		});
	}

	/* Turns sample entries into the notes the page works with. A seeded
     random spreads the times over the minutes the same way on every load. */
	function fromSample(entries) {
		const jitter = seededRandom(4117);
		const now = Date.now();
		function hoursAgo(hours) {
			return new Date(now - hours * HOUR - Math.floor(jitter() * 50) * MINUTE);
		}

		return entries.map((entry) => {
			const [made, edited, deleted] = entry.hours;
			const createdAt = hoursAgo(made);
			const editedAt = hoursAgo(edited);
			const deletedAt = deleted === undefined ? null : hoursAgo(deleted);
			return {
				id: entry.id,
				title: entry.title,
				body: entry.body,
				tasks: checklistLines(entry.todo).map((line, position) => ({
					id: `${entry.id}-c${position}`,
					text: line.slice(4),
					done: line.startsWith('[x]'),
				})),
				tags: [...entry.tags],
				tint: entry.tint || '',
				pinned: Boolean(entry.pinned),
				status: entry.status,
				by: entry.by,
				createdAt,
				editedAt,
				deletedAt,
			};
		});
	}

	function checklistLines(block = '') {
		return block
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);
	}

	/** Mulberry32: a tiny repeatable random number source. */
	function seededRandom(seed) {
		let acc = seed;
		return function nextFloat() {
			acc = (acc + 0x6d2b79f5) | 0;
			let mixed = Math.imul(acc ^ (acc >>> 15), 1 | acc);
			mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
