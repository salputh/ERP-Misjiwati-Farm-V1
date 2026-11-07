/**
 * Team Bookmarks, the script behind team-bookmarks.html (it wakes up only when
 * the page carries [data-bkm-root]).
 *
 * The team keeps its everyday links here: each one sits in a collection,
 * can carry tags, turns up in search, may be pinned above the rest and
 * counts every time somebody follows it.
 *
 * Wiring it to a real backend:
 *   1. Swap WORKSPACE for your own records, or leave it empty and let
 *      server.load() fetch them.
 *   2. Give each method on `server` a real request. They all hand back
 *      promises, so the page waits on your reply exactly as it waits on
 *      the short pretend delay of the demo.
 * The screen is always drawn from `model`. After any change the page
 * calls paint(); it never patches the markup piece by piece.
 *
 * Query switches that preview the other states:
 *   team-bookmarks.html?demo=empty   a team that has saved nothing yet
 *   team-bookmarks.html?demo=error   the first load fails and Try again recovers
 */
(() => {
	'use strict';

	const shell = pick('[data-bkm-root]');
	if (!shell) return;

	/* Fieldline's shared links. Fieldline sells scheduling software to teams
     who work out on site. Open counts and dates come from a seeded
     generator, so every visit shows the same numbers. A record may also
     hold `icon: 'https://…/favicon.png'`; without one a tile is drawn
     from the address. `note` is a few words for the muted line. */
	const WORKSPACE = {
		me: 'Elaine Gill',
		team: ['Elaine Gill', 'Jonah Price', 'Lindsay Kinney', 'Stanley Vinson', 'Dawn Fischer'],
		ownDomain: 'fieldline.app',

		/* A collection flagged `system` stays put: no renaming, no deleting. */
		collections: [
			{ id: 'product', icon: 'bi-kanban', tone: 1, name: 'Product' },
			{ id: 'engineering', icon: 'bi-code-slash', tone: 2, name: 'Engineering' },
			{ id: 'design', icon: 'bi-palette', tone: 3, name: 'Design' },
			{ id: 'customers', icon: 'bi-people', tone: 4, name: 'Customers' },
			{ id: 'sales', icon: 'bi-graph-up-arrow', tone: 5, name: 'Sales' },
			{ id: 'ops', icon: 'bi-gear', tone: 6, name: 'Ops' },
			{ id: 'reading', icon: 'bi-book', tone: 7, name: 'Reading list' },
			{ id: 'unsorted', icon: 'bi-inbox', tone: 8, name: 'Unsorted', system: true },
		],

		links: [
			{
				pinned: true,
				collection: 'engineering',
				title: 'Status page',
				note: 'Live uptime',
				url: 'https://status.fieldline.app',
				by: 'Jonah Price',
				tags: ['on-call', 'daily'],
			},
			{
				pinned: true,
				collection: 'engineering',
				title: 'On-call runbook',
				note: 'First 15 minutes',
				url: 'https://fieldline.app/wiki/on-call',
				by: 'Jonah Price',
				tags: ['on-call', 'how-to'],
			},
			{
				pinned: true,
				collection: 'product',
				title: 'Release calendar',
				note: 'What ships when',
				url: 'https://fieldline.app/releases/calendar',
				by: 'Elaine Gill',
				tags: ['launch', 'daily'],
			},
			{
				pinned: true,
				collection: 'sales',
				title: 'Pricing calculator',
				note: 'By team size',
				url: 'https://fieldline.app/tools/pricing',
				by: 'Stanley Vinson',
				tags: ['pricing'],
			},
			{
				pinned: true,
				collection: 'design',
				title: 'Groundwork design system',
				note: 'Tokens',
				url: 'https://design.fieldline.app',
				by: 'Lindsay Kinney',
				tags: ['docs'],
			},
			{
				pinned: true,
				collection: 'engineering',
				title: 'API reference',
				note: 'v3, REST',
				url: 'https://docs.fieldline.app/api',
				by: 'Dawn Fischer',
				tags: ['docs'],
			},

			{
				collection: 'product',
				title: 'Roadmap, Q4',
				note: 'Now, next, later',
				url: 'https://fieldline.app/roadmap/q4',
				by: 'Elaine Gill',
				tags: ['launch'],
			},
			{
				collection: 'product',
				title: 'Feature request board',
				note: 'Votes from customers',
				url: 'https://feedback.fieldline.app',
				by: 'Elaine Gill',
				tags: ['research'],
			},
			{
				collection: 'product',
				title: 'Product metrics',
				note: 'Active teams',
				url: 'https://metrics.fieldline.app/product',
				by: 'Elaine Gill',
				tags: ['metrics', 'daily'],
			},
			{
				collection: 'product',
				title: 'Schedule board spec',
				note: '',
				url: 'https://fieldline.app/docs/specs/schedule-board',
				by: 'Lindsay Kinney',
				tags: ['docs', 'launch'],
			},

			{
				collection: 'engineering',
				title: 'Deploy dashboard',
				note: 'Who shipped what',
				url: 'https://deploys.fieldline.app',
				by: 'Jonah Price',
				tags: ['daily'],
			},
			{
				collection: 'engineering',
				title: 'Error tracker',
				note: 'Mobile and web',
				url: 'https://errors.fieldline.app',
				by: 'Dawn Fischer',
				tags: ['on-call', 'metrics'],
			},
			{
				collection: 'engineering',
				title: 'Sync engine notes',
				note: 'Offline visits',
				url: 'https://fieldline.app/wiki/eng/sync-engine',
				by: 'Dawn Fischer',
				tags: ['docs'],
			},

			{
				collection: 'design',
				title: 'Icon set',
				note: '',
				url: 'https://design.fieldline.app/icons',
				by: 'Lindsay Kinney',
				tags: ['docs'],
			},
			{
				collection: 'design',
				title: 'Staff app prototype',
				note: 'Clickable, v3',
				url: 'https://proto.fieldline.app/staff-app',
				by: 'Lindsay Kinney',
				tags: ['launch'],
			},
			{
				collection: 'design',
				title: 'Usability study, September',
				note: 'Eight schedulers',
				url: 'https://fieldline.app/research/usability-sept',
				by: 'Lindsay Kinney',
				tags: ['research'],
			},

			{
				collection: 'customers',
				title: 'Northway care team guide',
				note: '40-carer team',
				url: 'https://northwaylabs.com/team-guide',
				by: 'Stanley Vinson',
				tags: ['research'],
			},
			{
				collection: 'customers',
				title: 'Customer health board',
				note: 'Accounts at risk',
				url: 'https://metrics.fieldline.app/health',
				by: 'Dawn Fischer',
				tags: ['metrics'],
			},
			{
				collection: 'customers',
				title: 'Onboarding checklist',
				note: 'First 30 days',
				url: 'https://fieldline.app/wiki/onboarding',
				by: 'Dawn Fischer',
				tags: ['how-to'],
			},
			{
				collection: 'customers',
				title: 'Support macros',
				note: '',
				url: 'https://help.fieldline.app/macros',
				by: 'Dawn Fischer',
				tags: ['how-to'],
			},

			{
				collection: 'sales',
				title: 'Shiftloop teardown',
				note: 'Mid-market',
				url: 'https://fieldline.app/wiki/teardowns/shiftloop',
				by: 'Stanley Vinson',
				tags: ['research', 'pricing'],
			},
			{
				collection: 'sales',
				title: 'Demo script',
				note: '20 minutes',
				url: 'https://fieldline.app/wiki/sales/demo',
				by: 'Stanley Vinson',
				tags: ['how-to'],
			},
			{
				collection: 'sales',
				title: 'Plans and discounts',
				note: 'Public price page',
				url: 'https://fieldline.app/pricing',
				by: 'Stanley Vinson',
				tags: ['pricing'],
			},

			{
				collection: 'ops',
				title: 'Time-off calendar',
				note: '',
				url: 'https://fieldline.app/wiki/team/holidays',
				by: 'Elaine Gill',
				tags: [],
			},
			{
				collection: 'ops',
				title: 'Expense policy',
				note: 'Travel and gear',
				url: 'https://fieldline.app/wiki/team/expenses',
				by: 'Elaine Gill',
				tags: ['how-to'],
			},
			{
				collection: 'ops',
				title: 'Hiring pipeline',
				note: 'Open roles',
				url: 'https://hire.fieldline.app',
				by: 'Elaine Gill',
				tags: ['daily'],
			},
			{
				collection: 'ops',
				title: 'Vendor list',
				note: '',
				url: 'https://fieldline.app/wiki/team/vendors',
				by: 'Jonah Price',
				tags: [],
			},

			{
				collection: 'reading',
				title: 'Scheduling as a graph problem',
				note: 'Long read',
				url: 'https://queueandplan.com/scheduling-graphs',
				by: 'Dawn Fischer',
				tags: ['research'],
			},
			{
				collection: 'reading',
				title: 'Writing runbooks people use',
				note: '',
				url: 'https://opsnotes.dev/runbooks',
				by: 'Jonah Price',
				tags: ['on-call'],
			},
			{
				collection: 'reading',
				title: 'The cost of a missed visit',
				note: '300 teams',
				url: 'https://homevisitreview.com/missed-visits',
				by: 'Stanley Vinson',
				tags: ['research'],
			},
			{
				collection: 'reading',
				title: 'Per seat or per visit?',
				note: '',
				url: 'https://saasmath.io/per-seat-or-per-visit',
				by: 'Stanley Vinson',
				tags: ['pricing'],
			},

			{
				collection: 'unsorted',
				title: 'Travel-time benchmarks 2026',
				note: '',
				url: 'https://homevisitreview.com/benchmarks-2026',
				by: 'Elaine Gill',
				tags: ['metrics'],
			},
			{
				collection: 'unsorted',
				title: 'Offline-first mobile',
				note: '',
				url: 'https://lowsignal.dev/offline-first',
				by: 'Dawn Fischer',
				tags: ['docs'],
			},
		],

		/* Friendly site names the Add form borrows when one of these
       addresses is pasted in. */
		knownSites: {
			'fieldline.app': 'Fieldline',
			'homevisitreview.com': 'Home Visit Review',
			'queueandplan.com': 'Queue and Plan',
			'opsnotes.dev': 'Ops Notes',
			'saasmath.io': 'SaaS Math',
		},
	};

	/* What "Try a sample file" in the Import dialog reads: a short file in
     the format browsers write when they export their bookmarks. */
	const SAMPLE_FILE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>Bookmarks</TITLE><H1>Bookmarks</H1>
<DL><p>
  <DT><H3>Competitors</H3>
  <DL><p>
    <DT><A HREF="https://shiftloop.io/pricing">Shiftloop pricing</A>
    <DT><A HREF="https://vanguardplans.com/changelog" TAGS="research">Vanguard Plans changelog</A>
  </DL><p>
  <DT><H3>On-site ops reading</H3>
  <DL><p>
    <DT><A HREF="https://homevisitreview.com/no-show-rates">No-show rates by region</A>
    <DT><A HREF="https://opsnotes.dev/schedule-handoffs">Schedule handoffs</A>
  </DL><p>
  <DT><A HREF="https://status.fieldline.app">Status page</A>
  <DT><A HREF="https://saasmath.io/net-revenue-retention">Net revenue retention</A>
</DL><p>`;

	const ONE_DAY = 86400000;
	/* The page lists this many links before it offers "Show all". */
	const FIRST_SCREEN = 12;
	/* The tag cloud keeps to the busiest few, so it reads at a glance. */
	const CLOUD_SIZE = 8;
	const TONES = [1, 2, 3, 4, 5, 6, 7, 8];
	const NAME_HINT = "Short and plain works best: what you'd call it out loud.";
	const OPEN_PANELS = '.modal.show, .offcanvas.show';
	const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	/* Collection icons offered in the dialog, each with its spoken name. */
	const SHELF_ICONS = {
		'bi-kanban': 'Board',
		'bi-code-slash': 'Code',
		'bi-palette': 'Palette',
		'bi-people': 'People',
		'bi-graph-up-arrow': 'Chart',
		'bi-gear': 'Gear',
		'bi-book': 'Book',
		'bi-lightning': 'Lightning',
		'bi-journal-text': 'Notebook',
		'bi-tools': 'Tools',
		'bi-shield-check': 'Shield',
		'bi-star': 'Star',
	};

	const ORDERINGS = {
		opens: (left, right) => right.opens - left.opens,
		recent: (left, right) => (right.lastOpened || 0) - (left.lastOpened || 0),
		added: (left, right) => right.added - left.added,
		name: (left, right) => left.title.localeCompare(right.title),
	};

	/* Words for the Add and Edit modes of the drawer. */
	const EDITOR_COPY = {
		add: {
			heading: 'Add a link',
			sub: 'Paste the address first. The name and icon fill in from it.',
			save: 'Save link',
		},
		edit: { heading: 'Edit link', sub: 'Changes show for everyone on the team.', save: 'Save changes' },
	};

	const demoMode = new URLSearchParams(location.search).get('demo');
	let loadAttempts = 0;

	/* Every call the page makes to its backend. Replace each body with a
     real request; the demo versions pause briefly and keep everything in
     memory, so reloading starts over. */
	const server = {
		/* Resolve with { collections, links } shaped like WORKSPACE, for
       example fetch('/api/favorites').then((reply) => reply.json()). */
		load() {
			loadAttempts += 1;
			if (demoMode === 'error' && loadAttempts === 1) {
				return pause(250).then(() => {
					throw new Error('The server did not answer');
				});
			}
			return pause(250, seedRecords(demoMode === 'empty'));
		},
		/* Creates or updates one link and resolves with the stored copy,
       which your server may have tidied or given an id. */
		saveLink(record) {
			return pause(450, { ...record });
		},
		/* Runs only after the Undo on the toast has had its moment. */
		deleteLink(id) {
			return pause(150, id);
		},
		/* Fire and forget: the page has already counted the open. */
		recordOpen(id) {
			return pause(0, id);
		},
		saveCollection(shelf) {
			return pause(200, { ...shelf });
		},
		/* keepLinks moves the links to Unsorted; without it they go too. */
		deleteCollection(id, keepLinks) {
			return pause(150, { id, keepLinks });
		},
		/* Resolves with the imported links as they were stored. */
		importLinks(records) {
			return pause(400, records.slice());
		},
	};

	const prefs = {
		read(key) {
			try {
				return localStorage.getItem(`basalt-bm-${key}`);
			} catch {
				return null;
			}
		},
		write(key, value) {
			try {
				localStorage.setItem(`basalt-bm-${key}`, value);
			} catch {
				/* A private window says no; the choice is simply not kept. */
			}
		},
	};

	const model = {
		phase: 'loading',
		collections: [],
		links: [],
		/* 'all', 'pinned' or the id of one collection. */
		shelf: 'all',
		tag: '',
		query: '',
		order: prefs.read('sort') || 'opens',
		layout: prefs.read('layout') === 'list' ? 'list' : 'tiles',
		/* While false, only the first screenful shows and "Show all" waits. */
		expanded: false,
		/* The link open in the drawer; null while adding a new one. */
		editingId: null,
	};

	let idCounter = 1000;

	const refs = {
		shelves: pick('[data-bkm-colls]', shell),
		tagCloud: pick('[data-bkm-tagcloud]', shell),
		heading: pick('[data-bkm-view-title]', shell),
		note: pick('[data-bkm-view-desc]', shell),
		shelfMenu: pick('[data-bkm-coll-menu]', shell),
		search: pick('[data-bkm-search]', shell),
		sort: pick('[data-bkm-sort]', shell),
		applied: pick('[data-bkm-applied]', shell),
		results: pick('[data-bkm-results]', shell),
		quickAdd: pick('[data-bkm-quick]', shell),
		exportLabel: pick('[data-bkm-export-label]'),
	};

	const editor = {
		panel: pick('#bkm-link'),
		form: pick('[data-bkm-form]'),
		url: pick('#bkm-f-url'),
		title: pick('#bkm-f-title'),
		shelf: pick('#bkm-f-coll'),
		note: pick('#bkm-f-note'),
		pin: pick('#bkm-f-pin'),
		tags: pick('[data-bkm-tags]'),
		offers: pick('[data-bkm-tag-suggest]'),
		twin: pick('[data-bkm-dupe]'),
		hint: pick('[data-bkm-title-hint]'),
		save: pick('[data-bkm-save]'),
		saveLabel: pick('[data-bkm-save-label]'),
		remove: pick('[data-bkm-drawer-delete]'),
		heading: pick('[data-bkm-drawer-title]'),
		sub: pick('[data-bkm-drawer-sub]'),
		facts: pick('[data-bkm-drawer-facts]'),
		previewIcon: pick('[data-bkm-preview-fav]'),
		previewTitle: pick('[data-bkm-preview-title]'),
		previewHost: pick('[data-bkm-preview-host]'),
		previewPin: pick('[data-bkm-preview-pin]'),
	};
	/* Once someone types a name, the address stops suggesting one. */
	let nameEdited = false;

	const shelfDialog = pick('#bkm-collection');
	const shelfForm = pick('[data-bkm-coll-form]');
	const shelfName = pick('#bkm-c-name');
	let renamingId = null;

	const removalDialog = pick('#bkm-delete-coll');

	const importDialog = pick('#bkm-import');
	const importer = {
		pickStep: pick('[data-bkm-imp-step="pick"]', importDialog),
		reviewStep: pick('[data-bkm-imp-step="review"]', importDialog),
		foot: pick('[data-bkm-imp-foot]', importDialog),
		problem: pick('[data-bkm-imp-error]', importDialog),
		problemTitle: pick('[data-bkm-imp-error-title]', importDialog),
		problemText: pick('[data-bkm-imp-error-text]', importDialog),
		fileName: pick('[data-bkm-imp-name]', importDialog),
		summary: pick('[data-bkm-imp-sum]', importDialog),
		rows: pick('[data-bkm-imp-list]', importDialog),
		oneShelf: pick('[data-bkm-imp-one]', importDialog),
		shelfSelect: pick('[data-bkm-imp-coll]', importDialog),
		confirm: pick('[data-bkm-imp-go]', importDialog),
	};
	/* Links read from the chosen file, each marked when already saved. */
	let pendingImport = [];

	/**
	 * Wires every listener, restores the remembered sort and layout,
	 * then asks the server for the links.
	 */
	function start() {
		document.addEventListener('error', swapBrokenIcon, true);
		buildShelfPickers();
		wireBrowsing();
		wireEditor();
		wireShelfDialogs();
		wireImporter();
		wireShortcuts();

		refs.sort.value = model.order;
		const layoutRadio = pick(`#bkm-layout-${model.layout}`, shell);
		if (layoutRadio) layoutRadio.checked = true;
		document.addEventListener('DOMContentLoaded', () => window.Basalt.select?.refresh?.(refs.sort));
		fetchEverything();
	}

	/* The helpers below are used by every other part of the page. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
	}

	function glyph(name) {
		return `<i aria-hidden="true" class="bi ${htmlSafe(name)}"></i>`;
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function announce(message) {
		window.Basalt.announce?.(message);
	}

	/** "1 link", "3 links", or with an irregular plural, "2 matches". */
	function countLabel(amount, singular, irregular) {
		return `${amount.toLocaleString()} ${amount === 1 ? singular : irregular || `${singular}s`}`;
	}

	function upperFirst(word) {
		return word.charAt(0).toUpperCase() + word.slice(1);
	}

	function calmMotion() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function pause(ms, value) {
		return new Promise((resolve) => {
			setTimeout(resolve, ms, value);
		});
	}

	function makeId(prefix) {
		idCounter += 1;
		return `${prefix}-${idCounter.toString(36)}${Date.now().toString(36).slice(-3)}`;
	}

	/** Counters for a link nobody has opened yet, credited to the viewer. */
	function unopenedStats() {
		return { icon: '', by: WORKSPACE.me, opens: 0, lastOpened: 0, added: Date.now() };
	}

	function isTypingTarget(node) {
		return node && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName));
	}

	/* The demo turns WORKSPACE into full records here. */

	/**
	 * A repeatable random sequence (mulberry32), so the demo's counts and
	 * dates come out the same on every visit.
	 */
	function randomFrom(seed) {
		let cursor = seed >>> 0;
		return function nextRandom() {
			cursor = (cursor + 0x6d2b79f5) >>> 0;
			let mixed = Math.imul(cursor ^ (cursor >>> 15), cursor | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	/** Gives WORKSPACE's links their ids, open counts and dates. */
	function seedRecords(startEmpty) {
		const roll = randomFrom(5280);
		const now = Date.now();
		const shelves = WORKSPACE.collections.map((shelf) => ({ ...shelf }));
		if (startEmpty) return { collections: shelves, links: [] };
		const records = WORKSPACE.links.map((entry, index) => {
			const usage = entry.pinned ? 0.55 + roll() * 0.45 : Math.pow(roll(), 1.8);
			const daysSinceOpen = 0.1 + (entry.pinned ? roll() * 1.5 : Math.pow(roll(), 1.6) * 40);
			const daysSinceAdded = 60 + roll() * 500;
			return {
				id: `lnk-${String(index + 1).padStart(3, '0')}`,
				title: entry.title,
				url: entry.url,
				collection: entry.collection,
				tags: [...entry.tags],
				note: entry.note || '',
				pinned: Boolean(entry.pinned),
				icon: entry.icon || '',
				by: entry.by,
				opens: Math.round(4 + usage * 420),
				lastOpened: now - Math.round(daysSinceOpen * ONE_DAY),
				added: now - Math.round(daysSinceAdded * ONE_DAY),
			};
		});
		return { collections: shelves, links: records };
	}

	/* Typed and pasted addresses are read, compared and named here. */

	/** Reads "fieldline.app/pricing" as readily as a full https address. */
	function readAddress(raw) {
		let candidate = String(raw || '').trim();
		if (!candidate || /\s/.test(candidate)) return null;
		if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) candidate = `https://${candidate}`;
		let address;
		try {
			address = new URL(candidate);
		} catch {
			return null;
		}
		const usable =
			/^https?:$/.test(address.protocol) && address.hostname.indexOf('.') >= 1 && !address.hostname.endsWith('.');
		return usable ? address : null;
	}

	function bareHost(hostname) {
		return hostname.replace(/^www\./, '');
	}

	function siteHost(url) {
		const address = readAddress(url);
		return address ? bareHost(address.hostname) : '';
	}

	/** One page saved twice seldom matches letter for letter; this does. */
	function matchKey(url) {
		const address = readAddress(url);
		if (!address) return '';
		return `${bareHost(address.hostname)}${address.pathname.replace(/\/+$/, '')}${address.search}`.toLowerCase();
	}

	function compactAddress(url) {
		const address = readAddress(url);
		if (!address) return url;
		return bareHost(address.hostname) + `${address.pathname}${address.search}`.replace(/\/$/, '');
	}

	function siteLabel(host) {
		const domains = WORKSPACE.knownSites;
		const known = Object.keys(domains).find((domain) => host === domain || host.endsWith(`.${domain}`));
		if (known) return domains[known];
		const hostParts = host.split('.');
		const partCount = hostParts.length;
		const core =
			partCount > 2 && hostParts[partCount - 2].length <= 3
				? hostParts[partCount - 3]
				: hostParts[partCount - 2] || hostParts[0];
		return core.split('-').map(upperFirst).join(' ');
	}

	/** Names a pasted address after its site and the last part of its path. */
	function nameFromAddress(url) {
		const address = readAddress(url);
		if (!address) return '';
		const site = siteLabel(bareHost(address.hostname));
		const lastSegment = address.pathname.split('/').filter(Boolean).pop() || '';
		const phrase = decodeURIComponent(lastSegment)
			.replace(/\.(html?|php|aspx?)$/i, '')
			.replace(/[-_+]+/g, ' ')
			.trim();
		if (!phrase || /^\d+$/.test(phrase)) return site;
		return `${site} · ${upperFirst(phrase)}`;
	}

	/* Favicon tiles. Nothing is fetched: a link shows its own `icon` when it
     has one, the team's own pages show their collection's icon, and the
     rest get the site's initials on a color worked out from the address. */

	function toneOf(text) {
		let checksum = 0;
		for (let index = 0; index < text.length; index += 1) checksum = (checksum * 31 + text.charCodeAt(index)) >>> 0;
		return 1 + (checksum % 8);
	}

	function monogram(host) {
		const cleaned = siteLabel(host).replace(/[^A-Za-z0-9 ]/g, '');
		const [first = '', second] = cleaned.split(/\s+/).filter(Boolean);
		if (second) return (first[0] + second[0]).toUpperCase();
		return (first || '?').slice(0, cleaned.length <= 4 ? 4 : 1).toUpperCase();
	}

	function isOwnSite(host) {
		return host === WORKSPACE.ownDomain || host.endsWith(`.${WORKSPACE.ownDomain}`);
	}

	/** The square icon for a link; size is '', 'sm' or 'lg'. */
	function faviconMarkup(record, size) {
		const siteDomain = siteHost(record.url);
		const classes = `basalt-avatar basalt-avatar-rounded bkm-fav${size ? ` bkm-fav-${size}` : ''}`;
		if (record.icon) {
			return `<span aria-hidden="true" class="${classes} basalt-avatar-tone-${toneOf(siteDomain)}"><img alt="" src="${htmlSafe(record.icon)}" data-initials="${htmlSafe(monogram(siteDomain))}" data-bkm-fav-img></span>`;
		}
		if (isOwnSite(siteDomain)) {
			const home = collectionById(record.collection);
			return `<span aria-hidden="true" class="${classes} basalt-avatar-tone-${home ? home.tone : 1}"><i class="bi ${htmlSafe(home ? home.icon : 'bi-link-45deg')}"></i></span>`;
		}
		const lettering = monogram(siteDomain || '?');
		const wordy = lettering.length > 2 ? ' bkm-fav-word' : '';
		return `<span aria-hidden="true" class="${classes} basalt-avatar-tone-${toneOf(siteDomain)}${wordy}">${htmlSafe(lettering)}</span>`;
	}

	/* An icon that fails to load gives way to the initials it carries. */
	function swapBrokenIcon(event) {
		const image = event.target;
		if (image?.matches?.('img[data-bkm-fav-img]'))
			image.replaceWith(document.createTextNode(image.getAttribute('data-initials')));
	}

	/* Times are shown relative to now, the way people say them. */

	const RECENT_STEPS = [
		[60000, () => 'Just now'],
		[3600000, (gap) => `${Math.floor(gap / 60000)} min ago`],
		[ONE_DAY, (gap) => `${Math.floor(gap / 3600000)} h ago`],
	];

	function sinceLabel(stamp) {
		if (!stamp) return 'Never opened';
		const gap = Date.now() - stamp;
		const band = RECENT_STEPS.find(([limit]) => gap < limit);
		if (band) return band[1](gap);
		const wholeDays = Math.floor(gap / ONE_DAY);
		if (wholeDays === 1) return 'Yesterday';
		if (wholeDays < 7) return `${wholeDays} days ago`;
		if (wholeDays < 30) return `${countLabel(Math.floor(wholeDays / 7), 'week')} ago`;
		return new Date(stamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	/** "yesterday", "3 days ago" or "on Sep 3", ready to sit mid-sentence. */
	function sinceInSentence(stamp) {
		const phrase = sinceLabel(stamp);
		return /\d$/.test(phrase) ? `on ${phrase}` : phrase.toLowerCase();
	}

	/* These find records and narrow them to what the toolbar asks for. */

	function collectionById(id) {
		return model.collections.find((shelf) => shelf.id === id);
	}

	function findLink(id) {
		return model.links.find((record) => record.id === id);
	}

	function tallyIn(shelfId) {
		return model.links.filter((record) => record.collection === shelfId).length;
	}

	function pinnedCount() {
		return model.links.filter((record) => record.pinned).length;
	}

	/** The links of the chosen shelf, before search and tag apply. */
	function linksInShelf() {
		return model.links.filter((record) => {
			if (model.shelf === 'all') return true;
			return model.shelf === 'pinned' ? record.pinned : record.collection === model.shelf;
		});
	}

	function searchTerms() {
		return model.query.toLowerCase().split(/\s+/).filter(Boolean);
	}

	function mentionsAll(record, terms) {
		const home = collectionById(record.collection);
		const haystack = [
			record.title,
			compactAddress(record.url),
			record.note,
			record.tags.join(' '),
			home ? home.name : '',
		]
			.join(' ')
			.toLowerCase();
		return terms.every((term) => haystack.includes(term));
	}

	/** Applies the tag and the search box to a set of links. */
	function narrow(records) {
		const terms = searchTerms();
		return records.filter(
			(record) =>
				(!model.tag || record.tags.includes(model.tag)) && (!terms.length || mentionsAll(record, terms)),
		);
	}

	function ordered(records) {
		return [...records].sort(ORDERINGS[model.order] || ORDERINGS.opens);
	}

	/** Tags with how often each is used, busiest first, then A to Z. */
	function tagTally(records) {
		const uses = new Map();
		for (const record of records) {
			for (const tag of record.tags) uses.set(tag, (uses.get(tag) || 0) + 1);
		}
		return [...uses]
			.map(([tag, count]) => ({ tag, count }))
			.sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
	}

	/** Escapes text and wraps whatever the search box matched in <mark>. */
	function markMatches(text) {
		const safeText = htmlSafe(text);
		const patterns = searchTerms().map((term) => htmlSafe(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
		if (!patterns.length) return safeText;
		return safeText.replace(new RegExp(`(${patterns.join('|')})`, 'gi'), '<mark>$1</mark>');
	}

	/* Everything on screen is drawn from the model by the paint functions. */

	function paint() {
		paintFigures();
		paintShelves();
		paintTagCloud();
		paintHeading();
		paintFilters();
		paintResults();
	}

	function paintFigures() {
		const weekStart = Date.now() - 7 * ONE_DAY;
		const figures = {
			links: model.links.length,
			week: model.links.filter((record) => record.lastOpened && record.lastOpened > weekStart).length,
			pinned: pinnedCount(),
		};
		for (const [key, amount] of Object.entries(figures)) {
			const figureCell = pick(`[data-bkm-fig="${key}"]`);
			if (figureCell) figureCell.textContent = model.phase === 'ready' ? amount.toLocaleString() : '…';
		}
	}

	function shelfButton({ id, name, icon, tone, count }) {
		const isCurrent = model.shelf === id;
		const toneClass = tone ? ` bkm-tone-${tone}` : '';
		return (
			`<li><button data-bkm-view="${htmlSafe(id)}" type="button" class="bkm-coll${isCurrent ? ' is-active' : ''}"${isCurrent ? ' aria-current="true"' : ''}>` +
			`<span aria-hidden="true" class="bkm-coll-icon${toneClass}"><i class="bi ${htmlSafe(icon)}"></i></span>` +
			`<span class="bkm-coll-name">${htmlSafe(name)}</span>` +
			`<span class="bkm-coll-count">${model.phase === 'ready' ? count : ''}<span class="visually-hidden"> links</span></span></button></li>`
		);
	}

	function paintShelves() {
		refs.shelves.innerHTML = [
			shelfButton({ id: 'all', name: 'All links', icon: 'bi-collection', tone: 0, count: model.links.length }),
			shelfButton({ id: 'pinned', name: 'Pinned', icon: 'bi-pin-angle', tone: 0, count: pinnedCount() }),
			'<li aria-hidden="true" class="bkm-colls-rule"></li>',
			...model.collections.map((shelf) => shelfButton({ ...shelf, count: tallyIn(shelf.id) })),
		].join('');
	}

	function paintTagCloud() {
		const busiest = tagTally(linksInShelf()).slice(0, CLOUD_SIZE);
		if (model.tag && !busiest.some((entry) => entry.tag === model.tag))
			busiest.unshift({ tag: model.tag, count: 0 });
		if (!busiest.length) {
			refs.tagCloud.innerHTML = `<p class="bkm-side-none">${model.phase === 'ready' ? 'No tags here yet.' : ''}</p>`;
			return;
		}
		refs.tagCloud.innerHTML = busiest
			.map(
				({ tag, count }) =>
					`<button data-bkm-tag="${htmlSafe(tag)}" type="button" class="bkm-chip" title="${countLabel(count, 'link')}" aria-pressed="${model.tag === tag}">${htmlSafe(tag)}</button>`,
			)
			.join('');
	}

	function paintHeading() {
		const shelf = collectionById(model.shelf);
		const inShelf = linksInShelf();
		const matchingLinks = narrow(inShelf);
		const heading = model.shelf === 'pinned' ? 'Pinned' : shelf ? shelf.name : 'All links';
		refs.heading.textContent = heading;
		refs.shelfMenu.hidden = !shelf || Boolean(shelf.system);
		refs.note.textContent = headingNote(shelf, inShelf.length, matchingLinks.length);
		if (refs.exportLabel)
			refs.exportLabel.textContent = `Export ${countLabel(matchingLinks.length, 'link')} from ${heading}`;
	}

	/** The sentence under the panel heading, for whichever state applies. */
	function headingNote(shelf, total, matching) {
		if (model.phase === 'loading') return 'Loading your links';
		if (model.phase === 'error') return 'Your links could not be loaded.';
		if (!model.links.length) return 'Nothing saved yet. Add the first link below.';
		if (model.query || model.tag) return `${matching} of ${countLabel(total, 'link')} match.`;
		if (model.shelf === 'pinned') {
			return total
				? 'Pinned links come first in every view. Use the pin on any link to add it here.'
				: 'Nothing pinned yet.';
		}
		if (shelf && shelf.system)
			return `${countLabel(total, 'link')} without a collection. Imports and links from deleted collections land here.`;
		if (model.shelf === 'all')
			return `${countLabel(total, 'link')} in ${countLabel(model.collections.length, 'collection')}. Pinned ones come first.`;
		return `${countLabel(total, 'link')}, most opened first.`;
	}

	function filterPill(kind, value, clearKey, label) {
		return (
			`<span class="bkm-applied-item">${kind}: <strong>${htmlSafe(value)}</strong>` +
			`<button data-bkm-clear="${clearKey}" aria-label="${label}" type="button" class="bkm-applied-x">${glyph('bi-x')}</button></span>`
		);
	}

	function paintFilters() {
		const pills = [];
		if (model.tag) pills.push(filterPill('Tag', model.tag, 'tag', 'Remove the tag filter'));
		if (model.query) pills.push(filterPill('Search', model.query, 'q', 'Clear the search'));
		const clearBoth =
			pills.length > 1
				? '<button data-bkm-clear="all" type="button" class="btn btn-link btn-sm bkm-applied-all">Clear both</button>'
				: '';
		refs.applied.hidden = !pills.length;
		refs.applied.innerHTML = pills.join('') + clearBoth;
	}

	function paintResults() {
		const resultsBox = refs.results;
		resultsBox.setAttribute('aria-busy', String(model.phase === 'loading'));
		resultsBox.classList.toggle('bkm-results-list', model.layout === 'list');
		const placeholder = placeholderMarkup();
		if (placeholder) {
			resultsBox.innerHTML = placeholder;
			return;
		}
		resultsBox.innerHTML = groupsMarkup();
		window.Basalt.menus?.(resultsBox);
		window.Basalt.tips?.(resultsBox);
	}

	/** Markup for loading, failure and empty states, or '' when links show. */
	function placeholderMarkup() {
		if (model.phase === 'loading') return loadingMarkup();
		if (model.phase === 'error') return failureMarkup();
		if (!model.links.length) return welcomeMarkup();
		if (!narrow(linksInShelf()).length) return nothingFoundMarkup();
		return '';
	}

	/* Pinned links always show in full; the rest fill the screen up to
     FIRST_SCREEN, and "Show all" opens up the remainder. */
	function groupsMarkup() {
		const matching = ordered(narrow(linksInShelf()));
		const onPinnedShelf = model.shelf === 'pinned';
		const pinnedLinks = onPinnedShelf ? [] : matching.filter((record) => record.pinned);
		const others = onPinnedShelf ? matching : matching.filter((record) => !record.pinned);
		const room = model.expanded ? others.length : Math.max(FIRST_SCREEN - pinnedLinks.length, 3);
		const othersShown = others.slice(0, room);
		return [
			pinnedLinks.length
				? groupMarkup({
						heading: 'Pinned',
						icon: 'bi-pin-angle-fill',
						records: pinnedLinks,
						modifier: 'bkm-group-pinned',
					})
				: '',
			othersShown.length
				? groupMarkup({
						heading: pinnedLinks.length ? 'Everything else' : '',
						icon: '',
						records: othersShown,
						modifier: '',
					})
				: '',
			pagerMarkup(pinnedLinks.length + othersShown.length, matching.length),
		].join('');
	}

	function groupMarkup({ heading, icon, records, modifier }) {
		const headingId = `bkm-g-${modifier ? 'pinned' : 'rest'}`;
		const naming = heading ? ` aria-labelledby="${headingId}"` : ' aria-label="Links"';
		const headingHtml = heading
			? `<h3 id="${headingId}" class="bkm-group-title">${icon ? glyph(icon) : ''}${htmlSafe(heading)}<span class="bkm-group-n">${records.length}</span></h3>`
			: '';
		return `<section class="bkm-group ${modifier}"${naming}>${headingHtml}${model.layout === 'list' ? tableMarkup(records) : `<ul class="bkm-tiles">${records.map(tileMarkup).join('')}</ul>`}</section>`;
	}

	function tableMarkup(records) {
		const tableHead =
			'<thead><tr><th scope="col">Name</th>' +
			'<th class="bkm-col-coll" scope="col">Collection</th>' +
			'<th class="bkm-col-num" scope="col">Opens</th>' +
			'<th class="bkm-col-act" scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>';
		return `<div class="bkm-table-wrap"><table class="table bkm-table">${tableHead}<tbody>${records.map(rowMarkup).join('')}</tbody></table></div>`;
	}

	function pagerMarkup(shownCount, total) {
		if (total <= FIRST_SCREEN) return '';
		const summary = model.expanded
			? `All ${countLabel(total, 'link')} shown.`
			: `Showing ${shownCount} of ${countLabel(total, 'link')}.`;
		const moreButton = model.expanded
			? smallButton({ look: 'outline-secondary', hook: 'data-bkm-more="less"', label: 'Show fewer' })
			: smallButton({ look: 'outline-secondary', hook: 'data-bkm-more="all"', label: `Show all ${total}` });
		return `<div class="bkm-pager"><p class="bkm-pager-text">${summary}</p>${moreButton}</div>`;
	}

	function pinToggle(record) {
		const spoken = `${record.pinned ? 'Unpin' : 'Pin'} ${record.title}`;
		const tip = record.pinned ? 'Unpin' : 'Pin to top';
		return (
			`<button data-bkm-act="pin" data-bs-toggle="tooltip" data-bs-title="${tip}" aria-label="${htmlSafe(spoken)}" aria-pressed="${record.pinned}" type="button" class="btn btn-icon btn-sm bkm-pin">` +
			`${glyph(record.pinned ? 'bi-pin-angle-fill' : 'bi-pin-angle')}</button>`
		);
	}

	function commandItem(verb, icon, label, { tone = '', extra = '' } = {}) {
		return `<li><button data-bkm-act="${verb}"${extra} type="button" class="dropdown-item${tone}">${glyph(icon)}${label}</button></li>`;
	}

	/** The three-dot menu on a link: open, copy, edit, move and delete. */
	function linkMenu(record) {
		const destinations = model.collections
			.filter((shelf) => shelf.id !== record.collection)
			.map((shelf) =>
				commandItem('move', shelf.icon, htmlSafe(shelf.name), {
					extra: ` data-bkm-to="${htmlSafe(shelf.id)}"`,
				}),
			)
			.join('');
		const menuItems = [
			`<li><a data-bkm-open href="${htmlSafe(record.url)}" rel="noopener" target="_blank" class="dropdown-item">${glyph('bi-box-arrow-up-right')}Open in a new tab</a></li>`,
			commandItem('copy', 'bi-copy', 'Copy address'),
			commandItem('edit', 'bi-pencil', 'Edit'),
			`<li class="dropdown-submenu"><button aria-haspopup="true" aria-expanded="false" type="button" class="dropdown-item dropdown-submenu-toggle">${glyph('bi-folder-symlink')}Move to</button><ul class="dropdown-menu">${destinations}</ul></li>`,
			'<li><hr class="dropdown-divider"></li>',
			commandItem('delete', 'bi-trash3', 'Delete', { tone: ' text-danger' }),
		];
		return (
			`<div class="dropdown bkm-more"><button data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false" aria-label="More for ${htmlSafe(record.title)}" type="button" class="btn btn-icon btn-sm">${glyph('bi-three-dots')}</button>` +
			`<ul class="dropdown-menu dropdown-menu-end">${menuItems.join('')}</ul></div>`
		);
	}

	function shelfLink(shelf) {
		return `<button data-bkm-view="${htmlSafe(shelf.id)}" type="button" class="bkm-in"><span aria-hidden="true" class="bkm-dot bkm-tone-${shelf.tone}"></span>${htmlSafe(shelf.name)}</button>`;
	}

	function opensCount(record) {
		return `<span data-bkm-opens class="bkm-opens">${record.opens.toLocaleString()}</span>`;
	}

	/* The muted line under a name: the site, then the note when there is one. */
	function mutedLine(record) {
		const note = record.note
			? `<span class="bkm-note"><span aria-hidden="true" class="bkm-sep"> · </span>${markMatches(record.note)}</span>`
			: '';
		return markMatches(siteHost(record.url)) + note;
	}

	function openLink(record, classes) {
		return `<a data-bkm-open href="${htmlSafe(record.url)}" rel="noopener" target="_blank"${classes ? ` class="${classes}"` : ''}>${markMatches(record.title)}</a>`;
	}

	function tileMarkup(record) {
		const home = collectionById(record.collection);
		const homeLink = home && model.shelf !== record.collection ? shelfLink(home) : '';
		const top = `<div class="bkm-tile-top">${faviconMarkup(record)}<div class="bkm-tile-actions">${pinToggle(record)}${linkMenu(record)}</div></div>`;
		const foot = `<div class="bkm-tile-foot">${homeLink}<span title="Times opened" class="bkm-stat">${opensCount(record)}<span class="visually-hidden"> opens</span></span></div>`;
		return (
			`<li data-bkm-id="${htmlSafe(record.id)}" class="bkm-tile${record.pinned ? ' is-pinned' : ''}">${top}` +
			`<h4 class="bkm-tile-title">${openLink(record, '')}</h4><p class="bkm-tile-host">${mutedLine(record)}</p>${foot}</li>`
		);
	}

	function rowMarkup(record) {
		const home = collectionById(record.collection);
		const nameCell = `<td><div class="bkm-row-name">${faviconMarkup(record, 'sm')}<div class="bkm-row-text">${openLink(record, 'bkm-row-title')}<span class="bkm-row-host">${mutedLine(record)}</span></div></div></td>`;
		return (
			`<tr data-bkm-id="${htmlSafe(record.id)}" class="bkm-row${record.pinned ? ' is-pinned' : ''}">${nameCell}` +
			`<td class="bkm-col-coll">${home ? shelfLink(home) : ''}</td>` +
			`<td class="bkm-col-num">${opensCount(record)}</td>` +
			`<td class="bkm-col-act"><div class="bkm-row-actions">${pinToggle(record)}${linkMenu(record)}</div></td></tr>`
		);
	}

	/* While nothing can be listed, one of these screens takes the space. */

	const MAGNIFIER_ART =
		'<div class="basalt-empty-art"><svg aria-hidden="true" focusable="false" viewBox="0 0 160 120" class="basalt-illo">' +
		'<ellipse cx="80" cy="110" rx="46" ry="5" class="basalt-illo-shadow"/>' +
		'<rect x="26" y="18" width="84" height="80" rx="10" class="basalt-illo-card"/>' +
		'<rect x="38" y="32" width="46" height="6" rx="3" class="basalt-illo-mute"/>' +
		'<rect x="38" y="46" width="34" height="5" rx="2.5" class="basalt-illo-mute"/>' +
		'<rect x="38" y="59" width="40" height="5" rx="2.5" class="basalt-illo-mute"/>' +
		'<path d="M121 88l15 15" class="basalt-illo-stroke-deep"/>' +
		'<circle cx="106" cy="72" r="21" class="basalt-illo-glass"/>' +
		'<path d="M99 72h14" class="basalt-illo-stroke-tone"/></svg></div>';

	const RIBBON_ART =
		'<div class="basalt-empty-art"><svg aria-hidden="true" focusable="false" viewBox="0 0 160 120" class="basalt-illo">' +
		'<ellipse cx="80" cy="110" rx="46" ry="5" class="basalt-illo-shadow"/>' +
		'<rect x="40" y="16" width="80" height="84" rx="10" class="basalt-illo-card"/>' +
		'<path d="M66 16h28v40l-14-10-14 10z" class="basalt-illo-tone"/>' +
		'<rect x="52" y="68" width="56" height="6" rx="3" class="basalt-illo-mute"/>' +
		'<rect x="52" y="80" width="38" height="5" rx="2.5" class="basalt-illo-mute"/></svg></div>';

	/** A compact button for the empty states and the pager. */
	function smallButton({ look, hook, label, icon = '' }) {
		return `<button ${hook} type="button" class="btn btn-sm btn-${look}">${icon ? glyph(`${icon} me-1`) : ''}${label}</button>`;
	}

	function blankSlate({ art, title, text, actions, hint = '', alert = false }) {
		return (
			`<div${alert ? ' role="alert"' : ''} class="basalt-empty basalt-empty-framed bkm-empty">${art}` +
			`<h3 class="basalt-empty-title">${title}</h3><p class="basalt-empty-text">${text}</p>` +
			`<div class="basalt-empty-actions">${actions}</div>${hint ? `<p class="basalt-empty-hint">${hint}</p>` : ''}</div>`
		);
	}

	function loadingMarkup() {
		const still = calmMotion() ? ' basalt-skeleton-still' : '';
		const bone = (kind) => `<span class="basalt-skeleton${still} ${kind}"></span>`;
		const ghost = `<li aria-hidden="true" class="bkm-tile bkm-tile-ghost"><div class="bkm-tile-top">${bone('basalt-skeleton-block bkm-ghost-fav')}</div>${bone('basalt-skeleton-title')}${bone('basalt-skeleton-text w-50')}</li>`;
		return `<p class="visually-hidden">Loading your links</p><ul class="bkm-tiles">${ghost.repeat(6)}</ul>`;
	}

	function welcomeMarkup() {
		return blankSlate({
			art: RIBBON_ART,
			title: 'No favorites saved yet',
			text: 'Save the pages the team opens every day, like the status page, the release calendar or the pricing calculator. Everyone here sees the same list.',
			actions:
				smallButton({ look: 'primary', hook: 'data-bkm-add', icon: 'bi-plus-lg', label: 'Add a link' }) +
				smallButton({
					look: 'outline-secondary',
					hook: 'data-bs-toggle="modal" data-bs-target="#bkm-import"',
					icon: 'bi-upload',
					label: 'Import from a browser',
				}),
			hint: 'Or paste a link anywhere on this page.',
		});
	}

	function nothingFoundMarkup() {
		const shelf = collectionById(model.shelf);
		const shelfTitle = model.shelf === 'pinned' ? 'Pinned' : shelf ? shelf.name : '';

		/* The shelf itself is empty; no search or tag is to blame. */
		if (!linksInShelf().length) {
			if (model.shelf === 'pinned') {
				return blankSlate({
					art: RIBBON_ART,
					title: 'Nothing pinned yet',
					text: 'Use the pin on a link you open every day. Pinned links come first in every view.',
					actions: smallButton({
						look: 'outline-secondary',
						hook: 'data-bkm-view="all"',
						label: 'See all links',
					}),
				});
			}
			return blankSlate({
				art: RIBBON_ART,
				title: `Nothing in ${htmlSafe(shelfTitle)} yet`,
				text: 'Add a link here, or move one in from another collection with its Move to menu.',
				actions: smallButton({
					look: 'primary',
					hook: 'data-bkm-add',
					icon: 'bi-plus-lg',
					label: 'Add a link here',
				}),
			});
		}

		/* The search or the tag filtered every link away. */
		const elsewhere = model.shelf === 'all' ? 0 : narrow(model.links).length;
		const subject = model.query ? `“${htmlSafe(model.query)}”` : `the tag ${htmlSafe(model.tag)}`;
		const clearWhat = model.query && model.tag ? 'search and tag' : model.query ? 'search' : 'tag';
		let actions = smallButton({
			look: 'outline-secondary',
			hook: 'data-bkm-clear="all"',
			label: `Clear the ${clearWhat}`,
		});
		if (elsewhere) {
			actions =
				smallButton({
					look: 'primary',
					hook: 'data-bkm-view="all"',
					label: `See ${countLabel(elsewhere, 'match', 'matches')} in All links`,
				}) + actions;
		} else if (model.query) {
			actions += smallButton({
				look: 'outline-secondary',
				hook: 'data-bkm-add-q',
				label: `Save “${htmlSafe(model.query)}” as a link`,
			});
		}
		return blankSlate({
			art: MAGNIFIER_ART,
			title: `No links ${shelfTitle ? `in ${htmlSafe(shelfTitle)} ` : ''}match ${subject}`,
			text: 'Search looks at names, addresses, notes, tags and collection names. Try a shorter word.',
			actions,
		});
	}

	function failureMarkup() {
		return blankSlate({
			art: '<div aria-hidden="true" class="basalt-empty-art bkm-error-art"><i class="bi bi-cloud-slash"></i></div>',
			title: "Your links didn't load",
			text: "The server didn't answer. Nothing is lost: your saved links are still there once it does.",
			actions: smallButton({
				look: 'primary',
				hook: 'data-bkm-retry',
				icon: 'bi-arrow-clockwise',
				label: 'Try again',
			}),
			alert: true,
		});
	}

	/* The first load, and every retry after a failure, starts here. */

	function fetchEverything() {
		model.phase = 'loading';
		paint();
		server
			.load()
			.then(adoptRecords)
			.catch(() => {
				model.phase = 'error';
				paint();
				announce('Your links did not load.');
			});
	}

	function adoptRecords(payload) {
		model.collections = payload.collections || [];
		model.links = payload.links || [];
		if (!collectionById('unsorted'))
			model.collections.push({ id: 'unsorted', name: 'Unsorted', icon: 'bi-inbox', tone: 8, system: true });
		model.phase = 'ready';
		paint();
	}

	/* Browsing covers the shelves, the tag cloud, the filters and the toolbar. */

	function wireBrowsing() {
		shell.addEventListener('click', routeClick);
		/* A middle click opens the link as well, so it counts too. */
		shell.addEventListener('auxclick', (event) => {
			const linkItem = event.target.closest('[data-bkm-id]');
			if (event.button === 1 && linkItem && event.target.closest('[data-bkm-open]'))
				countOpen(linkItem.getAttribute('data-bkm-id'));
		});
		pick('.basalt-hero-actions').addEventListener('click', (event) => {
			if (event.target.closest('[data-bkm-add]')) showEditor();
			const exportChoice = event.target.closest('[data-bkm-export]');
			if (exportChoice) exportShelf(exportChoice.getAttribute('data-bkm-export'));
		});

		let typingPause = 0;
		refs.search.addEventListener('input', () => {
			clearTimeout(typingPause);
			typingPause = setTimeout(applySearch, 120);
		});
		refs.search.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape' || !refs.search.value) return;
			event.preventDefault();
			refs.search.value = '';
			model.query = '';
			paint();
		});
		refs.sort.addEventListener('change', () => {
			model.order = refs.sort.value;
			prefs.write('sort', model.order);
			paintResults();
			paintHeading();
		});
		for (const radio of pickAll('input[name="bkm-layout"]', shell)) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				model.layout = radio.value;
				prefs.write('layout', model.layout);
				paintResults();
			});
		}
		refs.quickAdd.addEventListener('submit', (event) => {
			event.preventDefault();
			const quickField = pick('#bkm-quick-url', refs.quickAdd);
			const typed = quickField.value.trim();
			if (!typed) {
				quickField.focus();
				return;
			}
			quickField.value = '';
			showEditor({ url: typed });
		});
	}

	/* Clicks inside the page, tried in order; the first hook that matches
     handles the click. */
	const CLICK_ROUTES = [
		['[data-bkm-view]', (hit) => openShelf(hit.getAttribute('data-bkm-view'))],
		['[data-bkm-tag]', (hit) => toggleTag(hit)],
		['[data-bkm-clear]', (hit) => clearFilters(hit.getAttribute('data-bkm-clear'))],
		['[data-bkm-more]', (hit) => showMore(hit.getAttribute('data-bkm-more') === 'all')],
		['[data-bkm-add]', () => showEditor()],
		['[data-bkm-add-q]', () => showEditor({ url: model.query })],
		['[data-bkm-retry]', () => fetchEverything()],
		['[data-bkm-new-collection]', () => openShelfDialog()],
		['[data-bkm-coll-action]', (hit) => runShelfAction(hit.getAttribute('data-bkm-coll-action'))],
	];

	function routeClick(event) {
		const origin = event.target;
		for (const [selector, handle] of CLICK_ROUTES) {
			const hit = origin.closest(selector);
			if (hit) {
				handle(hit);
				return;
			}
		}
		const linkItem = origin.closest('[data-bkm-id]');
		if (!linkItem) return;
		if (origin.closest('[data-bkm-open]')) {
			countOpen(linkItem.getAttribute('data-bkm-id'));
			return;
		}
		const command = origin.closest('[data-bkm-act]');
		if (command) runLinkCommand(command, linkItem.getAttribute('data-bkm-id'));
	}

	function applySearch() {
		model.query = refs.search.value.trim();
		model.expanded = false;
		paintHeading();
		paintFilters();
		paintResults();
	}

	function openShelf(id) {
		model.shelf = id;
		model.expanded = false;
		if (model.tag && !linksInShelf().some((record) => record.tags.includes(model.tag))) model.tag = '';
		paint();
		announce(`${refs.heading.textContent}. ${refs.note.textContent}`);
	}

	function toggleTag(chip) {
		const tag = chip.getAttribute('data-bkm-tag');
		model.tag = model.tag === tag ? '' : tag;
		model.expanded = false;
		paint();
		const redrawn = pick(`.bkm-tagcloud [data-bkm-tag="${CSS.escape(tag)}"]`, shell);
		if (chip.closest('.bkm-tagcloud') && redrawn) redrawn.focus();
		announce(model.tag ? `Showing links tagged ${tag}. ${refs.note.textContent}` : 'Tag filter removed.');
	}

	/** scope is 'tag', 'q' or 'all'. */
	function clearFilters(scope) {
		if (scope !== 'tag') {
			model.query = '';
			refs.search.value = '';
		}
		if (scope !== 'q') model.tag = '';
		paint();
		refs.search.focus();
	}

	function showMore(everything) {
		window.Basalt.slide(refs.results, () => {
			model.expanded = everything;
			paintResults();
		});
		pick('[data-bkm-more]', refs.results)?.focus({ preventScroll: !model.expanded });
	}

	function runShelfAction(kind) {
		if (kind === 'rename') openShelfDialog(model.shelf);
		else if (kind === 'delete') confirmShelfRemoval();
		else showEditor();
	}

	/* Each action below changes a single link. */

	function runLinkCommand(command, id) {
		const verb = command.getAttribute('data-bkm-act');
		const menu = command.closest('.dropdown');
		if (menu && verb !== 'pin') {
			const menuButton = pick('[data-bs-toggle="dropdown"]', menu);
			if (menuButton) window.bootstrap.Dropdown.getOrCreateInstance(menuButton).hide();
		}
		const commands = {
			pin: () => flipPin(id),
			edit: () => showEditor({ id }),
			copy: () => copyAddress(id),
			delete: () => removeLink(id),
			move: () => relocate(id, command.getAttribute('data-bkm-to')),
		};
		if (Object.hasOwn(commands, verb)) commands[verb]();
	}

	function flipPin(id) {
		const record = findLink(id);
		if (!record) return;
		record.pinned = !record.pinned;
		server.saveLink(record);
		paint();
		/* The keyboard stays put, on the same link's pin. */
		pick(`[data-bkm-id="${id}"] [data-bkm-act="pin"]`, refs.results)?.focus();
		announce(record.pinned ? `${record.title} is pinned to the top.` : `${record.title} is no longer pinned.`);
	}

	/* The count changes in place; the order catches up on the next paint. */
	function countOpen(id) {
		const record = findLink(id);
		if (!record) return;
		record.opens += 1;
		record.lastOpened = Date.now();
		server.recordOpen(id);
		for (const itemNode of pickAll(`[data-bkm-id="${id}"]`, refs.results)) {
			const tally = pick('[data-bkm-opens]', itemNode);
			if (tally) tally.textContent = record.opens.toLocaleString();
		}
		paintFigures();
	}

	function relocate(id, destinationId) {
		const record = findLink(id);
		const destination = collectionById(destinationId);
		if (!record || !destination) return;
		const formerShelf = record.collection;
		record.collection = destinationId;
		server.saveLink(record);
		paint();
		notify({
			tone: 'success',
			icon: 'bi-folder-symlink',
			title: `Moved to ${destination.name}`,
			text: record.title,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						record.collection = formerShelf;
						server.saveLink(record);
						paint();
					},
				},
			],
		});
	}

	function copyAddress(id) {
		const record = findLink(id);
		if (!record || !window.Basalt.copyText) return;
		window.Basalt.copyText(record.url).then(
			() =>
				notify({
					tone: 'success',
					icon: 'bi-clipboard-check',
					title: 'Address copied',
					text: compactAddress(record.url),
					duration: 3000,
				}),
			() =>
				notify({
					tone: 'danger',
					title: "Couldn't copy",
					text: `Your browser blocked the clipboard. The address is ${record.url}`,
				}),
		);
	}

	/* The link leaves the screen at once; the server hears about it only
     after the toast's Undo has had its chance. */
	function removeLink(id) {
		const atIndex = model.links.findIndex((record) => record.id === id);
		if (atIndex < 0) return;
		const [removed] = model.links.splice(atIndex, 1);
		paint();
		refs.search.focus({ preventScroll: true });
		let restored = false;
		function undo() {
			restored = true;
			model.links.splice(Math.min(atIndex, model.links.length), 0, removed);
			paint();
			announce(`${removed.title} is back.`);
		}
		notify({
			tone: 'info',
			icon: 'bi-trash3',
			title: 'Link deleted',
			text: removed.title,
			duration: 7000,
			actions: [{ label: 'Undo', onClick: undo }],
			onClose: () => {
				if (!restored) server.deleteLink(removed.id);
			},
		});
	}

	/* One drawer serves both adding a link and editing it. */

	function wireEditor() {
		editor.panel.addEventListener('shown.bs.offcanvas', () => {
			(editor.url.value && !model.editingId ? editor.title : editor.url).focus();
		});
		editor.url.addEventListener('input', () => {
			proposeName();
			flagDuplicate();
			refreshPreview();
		});
		editor.url.addEventListener('blur', () => {
			const typed = editor.url.value.trim();
			const address = readAddress(editor.url.value);
			if (address && typed && !/^https?:\/\//i.test(typed)) editor.url.value = address.href;
		});
		editor.title.addEventListener('input', () => {
			nameEdited = true;
			editor.hint.textContent = NAME_HINT;
			refreshPreview();
		});
		for (const [field, kind] of [
			[editor.shelf, 'change'],
			[editor.pin, 'change'],
			[editor.note, 'input'],
		]) {
			field.addEventListener(kind, refreshPreview);
		}
		editor.tags.addEventListener('change', offerTags);
		editor.offers.addEventListener('click', (event) => {
			const offer = event.target.closest('[data-bkm-suggest]');
			const tagField = editor.tags.basaltTags;
			if (!offer || !tagField) return;
			tagField.set(tagField.get().concat(offer.getAttribute('data-bkm-suggest')));
			pick('.basalt-tags-input', editor.tags).focus();
		});
		editor.twin.addEventListener('click', (event) => {
			const otherLink = event.target.closest('[data-bkm-edit-other]');
			if (otherLink) showEditor({ id: otherLink.getAttribute('data-bkm-edit-other') });
		});
		editor.remove.addEventListener('click', () => {
			const id = model.editingId;
			drawerControl().hide();
			removeLink(id);
		});
		editor.form.addEventListener('submit', submitEditor);
	}

	function drawerControl() {
		return window.bootstrap.Offcanvas.getOrCreateInstance(editor.panel);
	}

	/** Fills a collection <select>, with one of them chosen. */
	function listShelvesIn(select, pickedId) {
		select.innerHTML = model.collections
			.map(
				(shelf) =>
					`<option data-icon="${htmlSafe(shelf.icon.replace(/^bi-/, ''))}" value="${htmlSafe(shelf.id)}"${shelf.id === pickedId ? ' selected' : ''}>${htmlSafe(shelf.name)}</option>`,
			)
			.join('');
		window.Basalt.select?.refresh?.(select);
	}

	/**
	 * Opens the drawer empty, prefilled with a pasted address ({ url }), or
	 * holding an existing link ({ id }).
	 */
	function showEditor({ id, url } = {}) {
		if (model.phase !== 'ready') return;
		/* A bare reopen while the drawer is up would throw away the typing. */
		if (editor.panel.classList.contains('show') && !id && !url) return;
		const record = id ? findLink(id) : null;
		const wording = record ? EDITOR_COPY.edit : EDITOR_COPY.add;
		model.editingId = record ? record.id : null;

		editor.form.classList.remove('was-validated');
		window.Basalt.dialog?.clearFlags(editor.form);
		editor.heading.textContent = wording.heading;
		editor.sub.textContent = wording.sub;
		editor.saveLabel.textContent = wording.save;
		editor.remove.hidden = !record;
		/* How often a link was opened lives here, not on every tile. */
		editor.facts.hidden = !record;
		editor.facts.textContent = record ? openingFacts(record) : '';

		editor.url.value = record ? record.url : url || '';
		editor.title.value = record ? record.title : '';
		nameEdited = Boolean(record);
		listShelvesIn(
			editor.shelf,
			record ? record.collection : collectionById(model.shelf) ? model.shelf : 'unsorted',
		);
		editor.note.value = record ? record.note : '';
		editor.pin.checked = record ? record.pinned : model.shelf === 'pinned';
		editor.tags.basaltTags?.set(record ? record.tags : model.tag ? [model.tag] : []);
		if (!record && editor.url.value) proposeName();
		flagDuplicate();
		refreshPreview();
		offerTags();
		drawerControl().show();
	}

	function openingFacts(record) {
		const usage = record.opens
			? `Opened ${countLabel(record.opens, 'time')}, last ${sinceInSentence(record.lastOpened)}.`
			: 'Not opened yet.';
		return `${usage} Saved by ${record.by || WORKSPACE.me}.`;
	}

	function proposeName() {
		if (nameEdited) return;
		const guess = nameFromAddress(editor.url.value);
		editor.title.value = guess;
		editor.hint.textContent = guess ? 'Suggested from the address. Change it to anything.' : NAME_HINT;
	}

	function flagDuplicate() {
		const key = matchKey(editor.url.value);
		const twin = key && model.links.find((record) => record.id !== model.editingId && matchKey(record.url) === key);
		editor.twin.hidden = !twin;
		if (!twin) {
			editor.twin.innerHTML = '';
			return;
		}
		const home = collectionById(twin.collection);
		editor.twin.innerHTML =
			`${glyph('bi-info-circle')}<span>Already saved as <strong>${htmlSafe(twin.title)}</strong>${home ? ` in ${htmlSafe(home.name)}` : ''}. </span>` +
			`<button data-bkm-edit-other="${htmlSafe(twin.id)}" type="button" class="btn btn-link btn-sm p-0">Edit that one instead</button>`;
	}

	/* The card at the top of the drawer mirrors what is being typed. */
	function refreshPreview() {
		const address = readAddress(editor.url.value);
		const scratchTemplate = document.createElement('template');
		scratchTemplate.innerHTML = address
			? faviconMarkup({ url: address.href, collection: editor.shelf.value, icon: '' }, 'lg')
			: '<span class="basalt-avatar basalt-avatar-rounded bkm-fav bkm-fav-lg basalt-avatar-tone-1"><i class="bi bi-link-45deg"></i></span>';
		const freshIcon = scratchTemplate.content.firstChild;
		editor.previewIcon.replaceWith(freshIcon);
		editor.previewIcon = freshIcon;
		const note = editor.note.value.trim();
		editor.previewTitle.textContent = editor.title.value.trim() || 'Name of the link';
		editor.previewHost.textContent =
			(address ? siteHost(address.href) : 'address.com') + (note ? ` · ${note}` : '');
		editor.previewPin.hidden = !editor.pin.checked;
	}

	function offerTags() {
		const chosen = editor.tags.basaltTags ? editor.tags.basaltTags.get().map((tag) => tag.toLowerCase()) : [];
		const offers = tagTally(model.links)
			.filter((entry) => !chosen.includes(entry.tag))
			.slice(0, 8);
		editor.offers.innerHTML = offers.length
			? `<span class="bkm-tag-suggest-label">Used before:</span>${offers.map(({ tag }) => `<button data-bkm-suggest="${htmlSafe(tag)}" type="button" class="bkm-tag">${glyph('bi-plus')}${htmlSafe(tag)}</button>`).join('')}`
			: '';
	}

	function submitEditor(event) {
		event.preventDefault();
		if (editor.save.getAttribute('aria-busy') === 'true') return;
		const address = readAddress(editor.url.value);
		editor.url.setCustomValidity(address ? '' : 'bad');
		if (!editor.title.value.trim() && address) {
			editor.title.value = nameFromAddress(address.href);
			refreshPreview();
		}
		const invalid = window.Basalt.dialog
			? window.Basalt.dialog.flagFields([editor.url, editor.title])
			: address
				? null
				: editor.url;
		if (invalid) {
			invalid.focus();
			return;
		}
		const priorRecord = model.editingId ? findLink(model.editingId) : null;
		const draft = {
			...(priorRecord || { id: makeId('lnk'), ...unopenedStats() }),
			url: address.href,
			title: editor.title.value.trim(),
			collection: editor.shelf.value,
			tags: (editor.tags.basaltTags ? editor.tags.basaltTags.get() : []).map((tag) => tag.toLowerCase()),
			note: editor.note.value.trim(),
			pinned: editor.pin.checked,
		};
		window.Basalt.buttonState(editor.save, 'loading');
		server
			.saveLink(draft)
			.then((saved) => {
				if (priorRecord) Object.assign(priorRecord, saved);
				else model.links.unshift(saved);
				window.Basalt.buttonState(editor.save, 'success');
				setTimeout(() => settleAfterSave(saved, Boolean(priorRecord)), calmMotion() ? 150 : 500);
			})
			.catch(() => {
				window.Basalt.buttonState(editor.save, 'error');
				notify({
					tone: 'danger',
					title: "Couldn't save the link",
					text: 'Check your connection and press Save again.',
				});
			});
	}

	/** Closes the drawer and brings the saved link into view. */
	function settleAfterSave(saved, wasEdit) {
		window.Basalt.buttonState(editor.save, 'idle');
		drawerControl().hide();
		if (!wasEdit) {
			const stillVisible =
				model.shelf === 'all' || model.shelf === saved.collection || (model.shelf === 'pinned' && saved.pinned);
			if (!stillVisible) model.shelf = saved.collection;
			if ((model.query || model.tag) && !narrow([saved]).length) {
				model.query = '';
				model.tag = '';
				refs.search.value = '';
			}
		}
		paint();
		const home = collectionById(saved.collection);
		const heading = wasEdit ? 'Changes saved' : `Saved to ${home ? home.name : 'Favorites'}`;
		notify({
			tone: 'success',
			icon: wasEdit ? 'bi-check2-circle' : 'bi-bookmark-check',
			title: heading,
			text: saved.title,
			duration: 4000,
		});
		/* A new link has no opens yet and can sort beyond "Show all", so the
       rest of the list opens up. */
		if (!pick(`[data-bkm-id="${saved.id}"]`, refs.results) && !model.expanded) {
			model.expanded = true;
			paintResults();
		}
		const entry = pick(`[data-bkm-id="${saved.id}"]`, refs.results);
		if (!entry) return;
		entry.classList.add('is-new');
		entry.scrollIntoView({ block: 'nearest', behavior: calmMotion() ? 'auto' : 'smooth' });
		pick('[data-bkm-open]', entry)?.focus({ preventScroll: true });
	}

	/* Collections are made or renamed in one dialog and removed in another. */

	function buildShelfPickers() {
		pick('[data-bkm-icon-choices]').innerHTML = Object.entries(SHELF_ICONS)
			.map(
				([icon, spoken], index) =>
					`<label class="basalt-choice"><input name="bkm-c-icon" type="radio" value="${icon}"${index === 0 ? ' checked' : ''}>${glyph(icon)}<span class="visually-hidden">${spoken}</span></label>`,
			)
			.join('');
		pick('[data-bkm-swatches]').innerHTML = TONES.map(
			(tone) =>
				`<label class="bkm-swatch"><input name="bkm-c-tone" type="radio" value="${tone}" class="btn-check"${tone === 1 ? ' checked' : ''}><span aria-hidden="true" class="bkm-swatch-dot bkm-tone-${tone}"></span><span class="visually-hidden">Color ${tone}</span></label>`,
		).join('');
	}

	function wireShelfDialogs() {
		shelfDialog.addEventListener('shown.bs.modal', () => shelfName.focus());
		shelfForm.addEventListener('submit', saveShelf);
		pick('[data-bkm-del-hold]').addEventListener('basalt:confirm', removeShelf);
	}

	function firstFreeTone() {
		const usedTones = model.collections.map((shelf) => shelf.tone);
		return TONES.find((tone) => !usedTones.includes(tone));
	}

	/* New collections go in just before the fixed ones, such as Unsorted. */
	function insertShelf(shelf) {
		const fixedAt = model.collections.findIndex((other) => other.system);
		model.collections.splice(fixedAt < 0 ? model.collections.length : fixedAt, 0, shelf);
	}

	function checkRadios(scope, name, isChosen) {
		for (const radio of pickAll(`input[name="${name}"]`, scope)) radio.checked = isChosen(radio.value);
	}

	function checkedValue(scope, name) {
		return pick(`input[name="${name}"]:checked`, scope)?.value;
	}

	/** Opens the dialog for a new collection, or to rename the one given. */
	function openShelfDialog(id) {
		const shelf = id ? collectionById(id) : null;
		renamingId = shelf ? shelf.id : null;
		pick('[data-bkm-coll-title]').textContent = shelf ? `Rename ${shelf.name}` : 'New collection';
		pick('[data-bkm-coll-sub]').textContent = shelf
			? 'The new name and color show for everyone straight away.'
			: 'A shelf for links that belong together, like one project or one team.';
		pick('[data-bkm-coll-save]').textContent = shelf ? 'Save changes' : 'Create collection';
		pick('[data-bkm-coll-head-icon]').className = `bi ${shelf ? 'bi-pencil' : 'bi-folder-plus'}`;
		shelfName.value = shelf ? shelf.name : '';
		shelfName.classList.remove('is-invalid');
		const tone = shelf ? shelf.tone : firstFreeTone() || 1;
		checkRadios(shelfForm, 'bkm-c-tone', (value) => Number(value) === tone);
		checkRadios(shelfForm, 'bkm-c-icon', (value) => value === (shelf ? shelf.icon : 'bi-lightning'));
		window.bootstrap.Modal.getOrCreateInstance(shelfDialog).show();
	}

	function saveShelf(event) {
		event.preventDefault();
		const typedName = shelfName.value.trim();
		const clash = model.collections.find(
			(shelf) => shelf.id !== renamingId && shelf.name.toLowerCase() === typedName.toLowerCase(),
		);
		pick('[data-bkm-cname-err]').textContent = typedName
			? `There is already a collection called ${clash ? clash.name : typedName}.`
			: 'Give the collection a name.';
		if (!typedName || clash) {
			shelfName.classList.add('is-invalid');
			shelfName.setAttribute('aria-invalid', 'true');
			shelfName.focus();
			return;
		}
		shelfName.classList.remove('is-invalid');
		shelfName.removeAttribute('aria-invalid');
		const chosenIcon = checkedValue(shelfForm, 'bkm-c-icon') || 'bi-folder';
		const tone = Number(checkedValue(shelfForm, 'bkm-c-tone') || 1);
		let shelf = renamingId ? collectionById(renamingId) : null;
		if (shelf) {
			Object.assign(shelf, { name: typedName, icon: chosenIcon, tone });
		} else {
			shelf = { id: makeId('col'), name: typedName, icon: chosenIcon, tone };
			insertShelf(shelf);
		}
		server.saveCollection(shelf);
		window.bootstrap.Modal.getOrCreateInstance(shelfDialog).hide();
		const brandNew = !renamingId;
		model.shelf = shelf.id;
		paint();
		notify({
			tone: 'success',
			icon: 'bi-folder-check',
			title: brandNew ? 'Collection created' : 'Collection saved',
			text: shelf.name,
			duration: 4500,
			actions: brandNew ? [{ label: 'Add a link to it', onClick: () => showEditor() }] : [],
		});
	}

	function confirmShelfRemoval() {
		const shelf = collectionById(model.shelf);
		if (!shelf || shelf.system) return;
		const held = tallyIn(shelf.id);
		pick('[data-bkm-del-title]').textContent = `Delete ${shelf.name}?`;
		pick('[data-bkm-del-text]').textContent = held
			? `It holds ${countLabel(held, 'link')}. Choose what happens to them.`
			: 'It is empty, so no links are affected.';
		pick('[data-bkm-del-choices]').hidden = !held;
		checkRadios(removalDialog, 'bkm-del-links', (value) => value === 'move');
		window.bootstrap.Modal.getOrCreateInstance(removalDialog).show();
	}

	/* Runs once the delete button has been held long enough. */
	function removeShelf() {
		const shelf = collectionById(model.shelf);
		if (!shelf) return;
		const keepLinks = checkedValue(removalDialog, 'bkm-del-links') !== 'delete';
		const shelfIndex = model.collections.indexOf(shelf);
		const affected = model.links.filter((record) => record.collection === shelf.id);
		model.collections.splice(shelfIndex, 1);
		if (keepLinks) {
			for (const record of affected) record.collection = 'unsorted';
		} else {
			model.links = model.links.filter((record) => record.collection !== shelf.id);
		}
		window.bootstrap.Modal.getOrCreateInstance(removalDialog).hide();
		model.shelf = 'all';
		paint();

		let restored = false;
		function undo() {
			restored = true;
			model.collections.splice(shelfIndex, 0, shelf);
			for (const record of affected) {
				record.collection = shelf.id;
				if (!model.links.includes(record)) model.links.push(record);
			}
			model.shelf = shelf.id;
			paint();
			announce(`${shelf.name} is back.`);
		}
		let outcome = 'It was empty.';
		if (affected.length)
			outcome = `${countLabel(affected.length, 'link')} ${keepLinks ? 'moved to Unsorted.' : 'deleted with it.'}`;
		notify({
			tone: 'info',
			icon: 'bi-folder-x',
			title: `${shelf.name} deleted`,
			text: outcome,
			duration: 8000,
			actions: [{ label: 'Undo', onClick: undo }],
			onClose: () => {
				if (!restored) server.deleteCollection(shelf.id, keepLinks);
			},
		});
	}

	/* Importing reads a file, shows what it holds, then adds the new links. */

	function wireImporter() {
		importDialog.addEventListener('show.bs.modal', () => {
			resetImporter();
			listShelvesIn(importer.shelfSelect, collectionById(model.shelf) ? model.shelf : 'unsorted');
		});
		pick('[data-bkm-imp-reset]', importDialog).addEventListener('click', () => {
			resetImporter();
			pick('[data-basalt-drop-browse]', importDialog).focus();
		});
		pick('[data-bkm-drop]', importDialog).addEventListener('basalt:files', (event) =>
			readChosenFile(event.detail.files[0]),
		);
		pick('[data-bkm-imp-sample]', importDialog).addEventListener('click', () =>
			reviewImport('sample-bookmarks.html', SAMPLE_FILE),
		);
		for (const radio of pickAll('input[name="bkm-imp-where"]', importDialog)) {
			radio.addEventListener('change', () => {
				if (radio.checked) importer.oneShelf.hidden = radio.value !== 'one';
			});
		}
		importer.confirm.addEventListener('click', runImport);
	}

	/** Shows the file picker ('pick') or the list of what was found ('review'). */
	function showImportStep(step) {
		importer.pickStep.hidden = step !== 'pick';
		importer.reviewStep.hidden = step !== 'review';
		importer.foot.hidden = step !== 'review';
		importer.problem.hidden = true;
	}

	function resetImporter() {
		pendingImport = [];
		showImportStep('pick');
		importer.oneShelf.hidden = true;
		checkRadios(importDialog, 'bkm-imp-where', (value) => value === 'folders');
		const dropInput = pick('[data-basalt-drop-input]', importDialog);
		if (dropInput) dropInput.value = '';
	}

	function showImportProblem(title, text) {
		importer.problemTitle.textContent = title;
		importer.problemText.textContent = text;
		importer.problem.hidden = false;
	}

	function readChosenFile(chosen) {
		if (!chosen) return;
		if (chosen.size > 2 * 1024 * 1024) {
			showImportProblem(
				'That file is too big',
				'Files up to 2 MB can be imported. Export one folder at a time from the browser.',
			);
			return;
		}
		if (!/\.(html?|json)$/i.test(chosen.name)) {
			showImportProblem(
				"That isn't a bookmarks file",
				`${chosen.name} is not .html or .json. Export your bookmarks from the browser and try again.`,
			);
			return;
		}
		const fileReader = new FileReader();
		fileReader.onload = () => reviewImport(chosen.name, String(fileReader.result));
		fileReader.onerror = () => showImportProblem("That file couldn't be opened", 'Try choosing it again.');
		fileReader.readAsText(chosen);
	}

	/* A browser export nests <DT><H3>Folder</H3><DL> around each <DT><A HREF>.
     A link takes the name of the closest folder that has one. */
	function nearestFolder(anchor) {
		for (
			let branch = anchor.closest('dl');
			branch;
			branch = branch.parentElement ? branch.parentElement.closest('dl') : null
		) {
			const before = branch.previousElementSibling;
			const heading =
				before && before.matches('h3')
					? before
					: branch.parentElement && pick(':scope > h3', branch.parentElement);
			const folderTitle = heading ? heading.textContent.trim() : '';
			if (folderTitle) return folderTitle;
		}
		return '';
	}

	function linksFromBrowserFile(text) {
		const docTree = new DOMParser().parseFromString(text, 'text/html');
		return pickAll('a[href]', docTree).map((anchor) => ({
			title: anchor.textContent.trim(),
			url: anchor.getAttribute('href'),
			folder: nearestFolder(anchor),
			tags: (anchor.getAttribute('tags') || '')
				.split(',')
				.map((tag) => tag.trim().toLowerCase())
				.filter(Boolean),
		}));
	}

	/* Takes this page's own .json export, or any array of { title, url }. */
	function linksFromJson(text) {
		const payload = JSON.parse(text);
		const jsonEntries = Array.isArray(payload) ? payload : payload.links || [];
		return jsonEntries.map((entry) => ({
			title: String(entry.title || entry.name || ''),
			url: String(entry.url || entry.href || ''),
			folder: String(entry.collection || entry.folder || ''),
			note: String(entry.note || ''),
			tags: Array.isArray(entry.tags) ? entry.tags.map(String) : [],
		}));
	}

	function repeatSentence(repeats) {
		if (!repeats) return 'None of them are saved here yet.';
		return repeats === 1
			? 'One is already saved and will be skipped.'
			: `${repeats} are already saved and will be skipped.`;
	}

	function importRowMarkup(entry) {
		let placeTag = `<span class="bkm-pill">${entry.folder ? htmlSafe(entry.folder) : 'Unsorted'}</span>`;
		if (entry.dupe) placeTag = '<span class="bkm-pill bkm-pill-muted">Already saved</span>';
		return (
			`<li class="bkm-imp-row${entry.dupe ? ' is-dupe' : ''}">${faviconMarkup({ url: entry.url, collection: 'unsorted' }, 'sm')}` +
			`<span class="bkm-imp-row-text"><span class="bkm-imp-row-title">${htmlSafe(entry.title)}</span><span class="bkm-imp-row-host">${htmlSafe(compactAddress(entry.url))}</span></span>` +
			`<span class="bkm-imp-row-where">${placeTag}</span></li>`
		);
	}

	/** Reads a picked file and lists its links, marking ones already here. */
	function reviewImport(fileName, text) {
		let parsedRows;
		try {
			parsedRows =
				/\.json$/i.test(fileName) || /^\s*[[{]/.test(text) ? linksFromJson(text) : linksFromBrowserFile(text);
		} catch {
			showImportProblem(
				"That file couldn't be read",
				'It looks like JSON, but something in it is broken. Export it again and retry.',
			);
			return;
		}
		const savedKeys = new Set(model.links.map((record) => matchKey(record.url)));
		const seenKeys = new Set();
		pendingImport = parsedRows
			.map((row) => {
				const address = readAddress(row.url);
				if (!address) return null;
				const key = matchKey(address.href);
				const dupe = savedKeys.has(key) || seenKeys.has(key);
				seenKeys.add(key);
				return {
					title: row.title || nameFromAddress(address.href),
					url: address.href,
					folder: row.folder,
					tags: row.tags || [],
					note: row.note || '',
					dupe,
				};
			})
			.filter(Boolean);
		if (!pendingImport.length) {
			showImportProblem(
				'That file has no links we can read',
				'Export your bookmarks as an HTML file from the browser, or use a .json file from this page.',
			);
			return;
		}

		const freshCount = pendingImport.filter((entry) => !entry.dupe).length;
		const folderCount = new Set(pendingImport.map((entry) => entry.folder).filter(Boolean)).size;
		importer.fileName.textContent = fileName;
		importer.summary.textContent = `Found ${countLabel(pendingImport.length, 'link')}${folderCount ? ` in ${countLabel(folderCount, 'folder')}` : ''}. ${repeatSentence(pendingImport.length - freshCount)}`;
		importer.rows.innerHTML = pendingImport.map(importRowMarkup).join('');
		/* With nothing new to bring in, the Import button gives way to Close. */
		importer.confirm.textContent = `Import ${countLabel(freshCount, 'link')}`;
		importer.confirm.hidden = !freshCount;
		pick('[data-bs-dismiss="modal"]', importer.foot).textContent = freshCount ? 'Cancel' : 'Close';
		showImportStep('review');
		(freshCount ? importer.confirm : pick('[data-bkm-imp-reset]', importDialog)).focus();
	}

	function runImport() {
		const incoming = pendingImport.filter((entry) => !entry.dupe);
		if (!incoming.length) return;
		const placement = checkedValue(importDialog, 'bkm-imp-where');
		const newShelves = [];

		/* Where one imported link lands, making its folder's collection if
       none matches yet. */
		function shelfFor(folder) {
			if (placement === 'one') return importer.shelfSelect.value;
			if (!folder) return 'unsorted';
			let shelf = model.collections.find((other) => other.name.toLowerCase() === folder.toLowerCase());
			if (shelf) return shelf.id;
			shelf = {
				id: makeId('col'),
				name: folder.slice(0, 32),
				icon: 'bi-folder',
				tone: firstFreeTone() || 1 + (model.collections.length % 8),
			};
			insertShelf(shelf);
			newShelves.push(shelf);
			server.saveCollection(shelf);
			return shelf.id;
		}

		const records = incoming.map((entry) => ({
			id: makeId('lnk'),
			title: entry.title,
			url: entry.url,
			collection: shelfFor(entry.folder),
			tags: entry.tags,
			note: entry.note,
			pinned: false,
			...unopenedStats(),
		}));
		window.Basalt.dialog?.busy(importer.confirm, true);
		server.importLinks(records).then((saved) => {
			window.Basalt.dialog?.busy(importer.confirm, false);
			model.links = saved.concat(model.links);
			window.bootstrap.Modal.getOrCreateInstance(importDialog).hide();
			Object.assign(model, { shelf: 'all', query: '', tag: '', order: 'added' });
			refs.search.value = '';
			refs.sort.value = 'added';
			window.Basalt.select?.refresh?.(refs.sort);
			paint();
			const importedIds = new Set(saved.map((record) => record.id));
			function undo() {
				model.links = model.links.filter((record) => !importedIds.has(record.id));
				model.collections = model.collections.filter((shelf) => !newShelves.includes(shelf));
				paint();
			}
			const madeNote = newShelves.length
				? `New collections: ${newShelves.map((shelf) => shelf.name).join(', ')}.`
				: 'Showing newest first.';
			notify({
				tone: 'success',
				icon: 'bi-cloud-check',
				title: `${countLabel(saved.length, 'link')} imported`,
				text: madeNote,
				duration: 8000,
				actions: [{ label: 'Undo', onClick: undo }],
			});
		});
	}

	/* Exporting saves whatever the current view shows. */

	function saveFile(fileName, contents, mime) {
		const anchor = document.createElement('a');
		anchor.href = URL.createObjectURL(new Blob([contents], { type: mime }));
		anchor.download = fileName;
		document.body.append(anchor);
		anchor.click();
		setTimeout(() => {
			URL.revokeObjectURL(anchor.href);
			anchor.remove();
		}, 0);
	}

	/** Downloads the links in view as 'json' or as a browser bookmarks file. */
	function exportShelf(format) {
		const outgoing = ordered(narrow(linksInShelf()));
		if (!outgoing.length) {
			notify({
				tone: 'warning',
				title: 'Nothing to export',
				text: 'This view has no links. Clear the search or pick another collection.',
			});
			return;
		}
		const day = new Date().toISOString().slice(0, 10);
		const asJson = format === 'json';
		if (asJson) saveFile(`favorites-${day}.json`, jsonExport(outgoing), 'application/json');
		else saveFile(`favorites-${day}.html`, browserExport(outgoing), 'text/html');
		const followUp = asJson
			? 'Saved as a .json data file.'
			: "Open your browser's bookmarks manager and choose Import.";
		notify({
			tone: 'success',
			icon: 'bi-download',
			title: `Exported ${countLabel(outgoing.length, 'link')}`,
			text: followUp,
			duration: 5000,
		});
	}

	function jsonExport(records) {
		const exportRows = records.map(({ title, url, collection, tags, note, pinned, opens }) => ({
			title,
			url,
			collection: collectionById(collection)?.name || '',
			tags,
			note,
			pinned,
			opens,
		}));
		return JSON.stringify({ exported: new Date().toISOString(), links: exportRows }, null, 2);
	}

	/* The one format every browser imports; each collection becomes a folder. */
	function browserExport(records) {
		const byFolder = {};
		for (const record of records) {
			const folderTitle = (collectionById(record.collection) || { name: 'Unsorted' }).name;
			(byFolder[folderTitle] = byFolder[folderTitle] || []).push(record);
		}
		const stamp = Math.floor(Date.now() / 1000);
		const fileLines = [
			'<!DOCTYPE NETSCAPE-Bookmark-file-1>',
			'<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
			'<TITLE>Bookmarks</TITLE>',
			'<H1>Bookmarks</H1>',
			'<DL><p>',
		];
		for (const [folderTitle, members] of Object.entries(byFolder)) {
			fileLines.push(`  <DT><H3 ADD_DATE="${stamp}">${htmlSafe(folderTitle)}</H3>`, '  <DL><p>');
			for (const record of members) {
				const tagged = record.tags.length ? ` TAGS="${htmlSafe(record.tags.join(','))}"` : '';
				fileLines.push(
					`    <DT><A HREF="${htmlSafe(record.url)}" ADD_DATE="${Math.floor(record.added / 1000)}"${tagged}>${htmlSafe(record.title)}</A>`,
				);
			}
			fileLines.push('  </DL><p>');
		}
		fileLines.push('</DL><p>');
		return `${fileLines.join('\n')}\n`;
	}

	/* Keyboard and clipboard: "/" jumps to search, and an address pasted
     outside a field opens the Add drawer with it. */

	function wireShortcuts() {
		document.addEventListener('keydown', (event) => {
			if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target))
				return;
			if (pick(`${OPEN_PANELS}, .dropdown-menu.show`)) return;
			event.preventDefault();
			refs.search.focus();
			refs.search.select();
		});
		document.addEventListener('paste', (event) => {
			if (isTypingTarget(event.target) || pick(OPEN_PANELS)) return;
			const pasted = event.clipboardData?.getData('text') || '';
			if (!readAddress(pasted) || !/[./]/.test(pasted.trim())) return;
			event.preventDefault();
			showEditor({ url: pasted.trim() });
		});
	}

	start();
})();
