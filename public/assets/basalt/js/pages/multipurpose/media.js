/**
 * Basalt: the media library (media.html).
 * One array of files feeds every number on the page: the collection
 * cards, the counts on the views, the grid and the list, the file viewer
 * and the storage line, so nothing can disagree. To plug in a real
 * library, replace COLLECTIONS, PLACES and LIBRARY, point photoUrl()
 * at your own storage and set DEMO_DAY to new Date().
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-med-root]');
	if (!pageRoot) return;

	const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/* The demo is pinned to October 8, 2026 so the dates stay sensible. */
	const DEMO_DAY = '2026-10-08';
	const SIGNED_IN = 'John Armstrong';
	const BATCH = 20;
	const QUOTA_KB = 10 * 1024 * 1024;
	const FILE_HOST = 'https://cdn.fieldline.app/media/';
	const SEARCH_DELAY = 150;
	const UPLOAD_TICK = 120;

	/* The folders the content team files things under, in the order their
     cards appear. */
	const COLLECTIONS = {
		blog: 'Blog covers',
		site: 'Website',
		stories: 'Case studies',
		brand: 'Brand kit',
		sales: 'Sales files',
	};

	/* Everywhere a file can be placed. A page opens in the page editor, a
     post in the post editor. */
	const PLACES = {
		home: { title: 'Home', kind: 'page' },
		features: { title: 'Features', kind: 'page' },
		stories: { title: 'Customer Stories', kind: 'page' },
		enterprise: { title: 'Fieldline for Enterprise', kind: 'page' },
		about: { title: 'About Fieldline', kind: 'page' },
		webinars: { title: 'Webinars', kind: 'page' },
		careers: { title: 'Careers', kind: 'page' },
		p224: { title: 'Two-hour arrival windows are now the default', kind: 'post' },
		p223: { title: 'How Oakhaven Studio cut its complaints in half in one season', kind: 'post' },
		p222: { title: 'Offline mode for the Fieldline app is out of beta', kind: 'post' },
		p221: { title: 'Building a schedule board that survives a Monday morning', kind: 'post' },
		p220: { title: 'What 500 office managers changed about the estimate builder', kind: 'post' },
		p219: { title: 'Send the dog walker’s photo before the visit, not after', kind: 'post' },
		p218: { title: 'Eight weeks on the road with Harborline AI', kind: 'post' },
		p217: { title: 'Fieldline is now SOC 2 Type II certified', kind: 'post' },
		p216: { title: 'Team supplies now update your stock when a visit closes', kind: 'post' },
		p215: { title: 'Pricing maintenance plans that carry you through slow months', kind: 'post' },
		p214: { title: 'Larchwood Studios dropped paper time sheets in three weeks', kind: 'post' },
		p213: { title: 'The phone test: five phones, one twelve-hour working day', kind: 'post' },
		p212: { title: 'Running a 40-visit day without losing the afternoon', kind: 'post' },
		p211: { title: 'Q2 in review: customer portal, offline beta and 9 integrations', kind: 'post' },
		p210: { title: 'The customer portal is now plain HTML and a lot faster', kind: 'post' },
		p209: { title: 'Avocet Robotics doubled its grooming visits since spring', kind: 'post' },
		p225: { title: 'Seasonal schedules for recurring visits are here', kind: 'post' },
		p226: { title: 'Highpoint Outfitters’s winter prep checklist, step by step', kind: 'post' },
		p227: { title: 'Five questions to ask before buying phones for a team', kind: 'post' },
		p228: { title: 'Two teams, one hoist: booking shared equipment', kind: 'post' },
	};

	/* The files. kind is image, logo, video, pdf or doc; kb the size in
     kilobytes; photo a path to the picture (or a video's poster);
     text the alt text, caption or link text; used the PLACES it sits on. */
	const LIBRARY = [
		{
			id: 'm136',
			name: 'shared-hoist.jpg',
			kind: 'image',
			col: 'blog',
			photo: 'assets/basalt/images/multipurpose/shared-hoist.svg',
			kb: 109,
			w: 1600,
			h: 1073,
			date: '2026-10-07',
			by: 'Paige Drake',
			text: 'A mobile patient hoist in a bright hallway with violet and blue tags',
			used: ['p228'],
		},
		{
			id: 'm135',
			name: 'four-seasons.jpg',
			kind: 'image',
			col: 'blog',
			photo: 'assets/basalt/images/multipurpose/four-seasons.svg',
			kb: 72,
			w: 1600,
			h: 1073,
			date: '2026-10-07',
			by: 'Erin Slater',
			text: 'A blossom twig, a sun hat, a dry leaf and a violet glove in a row',
			used: ['p225'],
		},
		{
			id: 'm134',
			name: 'winter-kit.jpg',
			kind: 'image',
			col: 'blog',
			photo: 'assets/basalt/images/multipurpose/winter-kit.svg',
			kb: 76,
			w: 1600,
			h: 1073,
			date: '2026-10-06',
			by: 'Brittany Fenn',
			text: '',
			used: ['p226'],
		},
		{
			id: 'm133',
			name: 'two-hour-windows.jpg',
			kind: 'image',
			col: 'blog',
			photo: 'assets/basalt/images/multipurpose/two-hour-windows.svg',
			kb: 120,
			w: 1600,
			h: 1073,
			date: '2026-10-05',
			by: 'Erin Slater',
			text: 'A white clock with a violet wedge over two hours',
			used: ['p224'],
		},
		{
			id: 'm132',
			name: 'phones-on-bench.jpg',
			kind: 'image',
			col: 'blog',
			photo: 'assets/basalt/images/multipurpose/phones-on-bench.svg',
			kb: 89,
			w: 1600,
			h: 1073,
			date: '2026-10-02',
			by: 'Sharon Oakley',
			text: 'Three work phones beside a car mount, a cable and a notepad',
			used: ['p227'],
		},
		{
			id: 'm131',
			name: 'highpoint-testimonial.mp4',
			kind: 'video',
			col: 'stories',
			photo: 'assets/basalt/images/multipurpose/video-testimonial.svg',
			kb: 178,
			w: 1600,
			h: 1073,
			dur: '1:36',
			date: '2026-10-01',
			by: 'Reid Hollis',
			text: '',
			used: [],
		},
		{
			id: 'm130',
			name: 'team-table.jpg',
			kind: 'image',
			col: 'site',
			photo: 'assets/basalt/images/multipurpose/team-table.svg',
			kb: 150,
			w: 1600,
			h: 1073,
			date: '2026-09-30',
			by: SIGNED_IN,
			text: '',
			used: [],
		},
		{
			id: 'm129',
			name: 'complaints-halved.jpg',
			kind: 'image',
			col: 'blog',
			photo: 'assets/basalt/images/multipurpose/complaints-halved.svg',
			kb: 177,
			w: 1600,
			h: 1073,
			date: '2026-09-28',
			by: 'Brittany Fenn',
			text: 'Two stacks of handwritten customer notes, one half the other',
			used: ['p223', 'stories'],
		},
		{
			id: 'm128',
			name: 'planning-webinar.mp4',
			kind: 'video',
			col: 'site',
			photo: 'assets/basalt/images/multipurpose/video-webinar.svg',
			kb: 89,
			w: 1600,
			h: 1073,
			dur: '42:10',
			date: '2026-09-25',
			by: 'Neal Carson',
			text: 'Travel Planner webinar recording, September 2026',
			used: ['webinars'],
		},
		{
			id: 'm127',
			name: 'offline-mode.jpg',
			kind: 'image',
			col: 'blog',
			photo: 'assets/basalt/images/multipurpose/offline-mode.svg',
			kb: 508,
			w: 1600,
			h: 1073,
			date: '2026-09-22',
			by: 'Martin Hull',
			text: 'A phone on a fence post above the hills, a work bag at its foot',
			used: ['p222', 'features'],
		},
		{
			id: 'm126',
			name: 'lunch-break.jpg',
			kind: 'image',
			col: 'site',
			photo: 'assets/basalt/images/multipurpose/lunch-break.svg',
			kb: 168,
			w: 1600,
			h: 1073,
			date: '2026-09-18',
			by: 'Sharon Oakley',
			text: 'A lunch box and a flask on the passenger seat of a van',
			used: ['features', 'home'],
		},
		{
			id: 'm125',
			name: 'schedule-board.jpg',
			kind: 'image',
			col: 'blog',
			photo: 'assets/basalt/images/multipurpose/schedule-board.svg',
			kb: 222,
			w: 1600,
			h: 1073,
			date: '2026-09-14',
			by: 'Sharon Oakley',
			text: 'A hand moving a violet job card on a planning board',
			used: ['p221'],
		},
		{
			id: 'm124',
			name: 'estimate-kit.jpg',
			kind: 'image',
			col: 'blog',
			photo: 'assets/basalt/images/multipurpose/estimate-kit.svg',
			kb: 172,
			w: 1600,
			h: 1073,
			date: '2026-09-08',
			by: 'Paige Drake',
			text: '',
			used: ['p220'],
		},
		{
			id: 'm123',
			name: 'product-tour-2026.mp4',
			kind: 'video',
			col: 'site',
			photo: 'assets/basalt/images/multipurpose/video-product-tour.svg',
			kb: 60,
			w: 1600,
			h: 1073,
			dur: '1:52',
			date: '2026-09-04',
			by: 'Reid Hollis',
			text: 'A two-minute tour of scheduling, reminders and invoicing',
			used: ['home', 'features'],
		},
		{
			id: 'm122',
			name: 'travel-planner-sheet.pdf',
			kind: 'pdf',
			col: 'sales',
			kb: 1430,
			pages: 2,
			date: '2026-09-02',
			by: 'Neal Carson',
			text: 'Travel Planner data sheet (PDF)',
			used: ['features'],
		},
		{
			id: 'm121',
			name: 'walker-at-door.jpg',
			kind: 'image',
			col: 'blog',
			photo: 'assets/basalt/images/multipurpose/walker-at-door.svg',
			kb: 184,
			w: 1600,
			h: 1073,
			date: '2026-08-31',
			by: 'Paige Drake',
			text: 'A golden retriever waiting by the door, a violet leash on the hook',
			used: ['p219'],
		},
		{
			id: 'm120',
			name: 'eight-weeks.jpg',
			kind: 'image',
			col: 'blog',
			photo: 'assets/basalt/images/multipurpose/eight-weeks.svg',
			kb: 163,
			w: 1600,
			h: 1073,
			date: '2026-08-24',
			by: 'Brittany Fenn',
			text: '',
			used: ['p218'],
		},
		{
			id: 'm119',
			name: 'referral-terms.docx',
			kind: 'doc',
			col: 'sales',
			kb: 220,
			pages: 9,
			date: '2026-08-21',
			by: 'Neal Carson',
			text: 'Referral partner terms',
			used: [],
		},
		{
			id: 'm118',
			name: 'support-desk.jpg',
			kind: 'image',
			col: 'site',
			photo: 'assets/basalt/images/multipurpose/support-desk.svg',
			kb: 130,
			w: 1600,
			h: 1073,
			date: '2026-08-20',
			by: SIGNED_IN,
			text: 'A headset on a desk by a window over a small main street',
			used: ['careers'],
		},
		{
			id: 'm117',
			name: 'miles-saved.jpg',
			kind: 'image',
			col: 'site',
			photo: 'assets/basalt/images/multipurpose/miles-saved.svg',
			kb: 143,
			w: 1600,
			h: 1073,
			date: '2026-08-20',
			by: SIGNED_IN,
			text: 'A paper road map with a short violet route between pins',
			used: ['about'],
		},
		{
			id: 'm116',
			name: 'security-overview.pdf',
			kind: 'pdf',
			col: 'sales',
			kb: 2150,
			pages: 12,
			date: '2026-08-19',
			by: SIGNED_IN,
			text: 'Security overview (PDF)',
			used: ['enterprise', 'p217'],
		},
		{
			id: 'm115',
			name: 'soc2-certified.jpg',
			kind: 'image',
			col: 'blog',
			photo: 'assets/basalt/images/multipurpose/soc2-certified.svg',
			kb: 166,
			w: 1600,
			h: 1073,
			date: '2026-08-16',
			by: SIGNED_IN,
			text: 'A steel archive box with a brass padlock and a violet seal',
			used: ['p217', 'about'],
		},
		{
			id: 'm114',
			name: 'supplies-shelf.jpg',
			kind: 'image',
			col: 'blog',
			photo: 'assets/basalt/images/multipurpose/supplies-shelf.svg',
			kb: 222,
			w: 1600,
			h: 1073,
			date: '2026-08-10',
			by: 'Martin Hull',
			text: 'A hand topping up labeled bins on a steel supply shelf',
			used: ['p216'],
		},
		{
			id: 'm113',
			name: 'plan-pricing-guide.pdf',
			kind: 'pdf',
			col: 'sales',
			kb: 980,
			pages: 6,
			date: '2026-08-04',
			by: 'Sharon Oakley',
			text: 'Maintenance plan pricing guide (PDF)',
			used: ['p215'],
		},
		{
			id: 'm112',
			name: 'garden-shed.jpg',
			kind: 'image',
			col: 'blog',
			photo: 'assets/basalt/images/multipurpose/garden-shed.svg',
			kb: 414,
			w: 1600,
			h: 1073,
			date: '2026-08-03',
			by: 'Sharon Oakley',
			text: 'Garden tools on an open shed wall among autumn leaves',
			used: ['p215'],
		},
		{
			id: 'm111',
			name: 'paper-time-sheets.jpg',
			kind: 'image',
			col: 'blog',
			photo: 'assets/basalt/images/multipurpose/paper-time-sheets.svg',
			kb: 196,
			w: 1600,
			h: 1073,
			date: '2026-07-27',
			by: 'Brittany Fenn',
			text: 'A stack of old paper time sheets tied with string',
			used: ['p214'],
		},
		{
			id: 'm110',
			name: 'five-phones.jpg',
			kind: 'image',
			col: 'blog',
			photo: 'assets/basalt/images/multipurpose/five-phones.svg',
			kb: 233,
			w: 1600,
			h: 1073,
			date: '2026-07-20',
			by: 'Erin Slater',
			text: '',
			used: ['p213'],
		},
		{
			id: 'm109',
			name: 'copperleaf-story.mp4',
			kind: 'video',
			col: 'stories',
			photo: 'assets/basalt/images/multipurpose/clean-counter.svg',
			kb: 84,
			w: 1600,
			h: 1073,
			dur: '2:48',
			date: '2026-07-15',
			by: 'Brittany Fenn',
			text: 'Copperleaf Design on running a 40-visit day',
			used: ['stories', 'p212'],
		},
		{
			id: 'm108',
			name: 'packed-van.jpg',
			kind: 'image',
			col: 'blog',
			photo: 'assets/basalt/images/multipurpose/packed-van.svg',
			kb: 296,
			w: 1600,
			h: 1073,
			date: '2026-07-13',
			by: 'Sharon Oakley',
			text: 'The open side door of a white van with labeled crates',
			used: ['p212'],
		},
		{
			id: 'm107',
			name: 'q2-review-slides.pdf',
			kind: 'pdf',
			col: 'blog',
			kb: 5320,
			pages: 18,
			date: '2026-07-07',
			by: 'Paige Drake',
			text: 'Q2 review slides (PDF)',
			used: ['p211'],
		},
		{
			id: 'm106',
			name: 'quarter-wall.jpg',
			kind: 'image',
			col: 'blog',
			photo: 'assets/basalt/images/multipurpose/quarter-wall.svg',
			kb: 80,
			w: 1600,
			h: 1073,
			date: '2026-07-06',
			by: 'Paige Drake',
			text: 'A wall of sticky notes in three columns, a few in violet',
			used: ['p211'],
		},
		{
			id: 'm105',
			name: 'one-second.jpg',
			kind: 'image',
			col: 'blog',
			photo: 'assets/basalt/images/multipurpose/one-second.svg',
			kb: 84,
			w: 1600,
			h: 1073,
			date: '2026-06-28',
			by: 'Martin Hull',
			text: 'A silver stopwatch resting on a closed laptop',
			used: ['p210'],
		},
		{
			id: 'm104',
			name: 'two-groomed-dogs.jpg',
			kind: 'image',
			col: 'stories',
			photo: 'assets/basalt/images/multipurpose/two-groomed-dogs.svg',
			kb: 119,
			w: 1600,
			h: 1073,
			date: '2026-06-16',
			by: 'Brittany Fenn',
			text: 'Two freshly groomed white dogs on a grooming table',
			used: ['p209', 'stories'],
		},
		{
			id: 'm103',
			name: 'fieldline-brand-guide.pdf',
			kind: 'pdf',
			col: 'brand',
			kb: 8810,
			pages: 24,
			date: '2026-06-04',
			by: 'Sharon Oakley',
			text: 'Fieldline brand guide (PDF)',
			used: ['about'],
		},
		{
			id: 'm102',
			name: 'fieldline-wordmark.svg',
			kind: 'logo',
			col: 'brand',
			kb: 6,
			w: 1200,
			h: 320,
			date: '2026-06-02',
			by: 'Sharon Oakley',
			text: 'Fieldline',
			used: ['home', 'about'],
		},
		{
			id: 'm101',
			name: 'fieldline-mark-dark.svg',
			kind: 'logo',
			col: 'brand',
			kb: 4,
			w: 512,
			h: 512,
			dark: true,
			date: '2026-06-02',
			by: 'Sharon Oakley',
			text: '',
			used: [],
		},
	];

	/* What each kind is called, which icon stands for it, and what its
     text field asks for. `need` is the error when the field is left blank;
     a video's caption may be. */
	const KINDS = {
		image: {
			group: 'image',
			icon: 'image',
			field: 'Alt text',
			hint: 'Read out in place of the picture.',
			need: 'Describe the picture in a few words.',
		},
		logo: {
			group: 'image',
			icon: 'vector-pen',
			field: 'Alt text',
			hint: 'Usually just the company name.',
			need: 'Add the company name.',
		},
		video: { group: 'video', icon: 'play-btn', field: 'Caption', hint: 'Shown under the player.', need: '' },
		pdf: {
			group: 'document',
			icon: 'file-earmark-pdf',
			field: 'Link text',
			hint: 'The words people click to open it.',
			need: 'Add the words people click.',
		},
		doc: {
			group: 'document',
			icon: 'file-earmark-word',
			field: 'Link text',
			hint: 'The words people click to open it.',
			need: 'Add the words people click.',
		},
	};
	const KIND_LABEL = { image: 'Image', logo: 'Logo', video: 'Video', pdf: 'PDF', doc: 'Word document' };
	const DOC_TONE = { brand: 2, sales: 3, stories: 4 };
	const EXT_KIND = [
		[/^svg$/, 'logo'],
		[/^(jpe?g|png|gif|webp|avif)$/, 'image'],
		[/^(mp4|mov|webm|m4v)$/, 'video'],
		[/^pdf$/, 'pdf'],
	];

	/* Each view keeps the files its test passes. */
	const VIEW_KEEPS = {
		all: () => true,
		image: (entry) => KINDS[entry.kind].group === 'image',
		video: (entry) => entry.kind === 'video',
		document: (entry) => KINDS[entry.kind].group === 'document',
		noalt: lacksAlt,
		unused: isUnused,
	};
	const ORDERINGS = {
		newest: (left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id),
		name: (left, right) => left.name.localeCompare(right.name),
		size: (left, right) => right.kb - left.kb,
	};
	const VIEW_EMPTY = {
		noalt: '<div class="basalt-empty basalt-empty-success" role="status"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-check2-circle"></i></span><p class="basalt-empty-title">Every image has alt text</p><p class="basalt-empty-text">Screen readers can describe everything here.</p></div>',
		unused: '<div class="basalt-empty basalt-empty-success" role="status"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-check2-circle"></i></span><p class="basalt-empty-title">Every file is in use</p><p class="basalt-empty-text">Nothing here is taking up space for nothing.</p></div>',
	};
	const PLAIN_EMPTY =
		'<div class="basalt-empty" role="status"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-folder2"></i></span><p class="basalt-empty-title">Nothing here yet</p><p class="basalt-empty-text">Upload files, or pick another collection.</p></div>';

	/* What the library is showing right now, which files are ticked, and
     the files in view in the order they are drawn. */
	const showing = {
		which: 'all',
		search: '',
		collection: 'all',
		order: 'newest',
		layout: 'grid',
		limit: BATCH,
		openId: null,
	};
	const ticked = new Set();
	let inView = [];

	/* The viewer walks `viewerOrder`, frozen when it opened, so fixing
     alt text under "Missing alt text" does not lose your place. */
	let viewerOrder = [];
	let viewerOpener = null;
	let followingId = 200;

	const ui = partsOf(document, {
		views: '[data-med-views]',
		search: '[data-med-search]',
		collections: '[data-med-cols]',
		order: '[data-med-sort]',
		summary: '[data-med-summary]',
		grid: '[data-med-grid]',
		tableWrap: '[data-med-table]',
		rows: '[data-med-rows]',
		tickAll: '[data-med-check-all]',
		empty: '[data-med-empty]',
		more: '[data-med-more]',
		storage: '[data-med-storage]',
		bulk: '[data-med-bulk]',
		bulkCount: '[data-med-bulk-count]',
		moveMenu: '[data-med-move]',
		viewer: '[data-med-view]',
		uploadDialog: '[data-med-upload-dialog]',
		uploadInto: '[data-med-upload-to]',
		queue: '[data-med-queue]',
	});
	const viewCounters = pickAll('[data-med-count]');

	function start() {
		buildCollectionChoices();
		wireLibrary();
		wireSelection();
		wireBulkBar();
		wireViewer();
		wireUploads();
		redrawAll();
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	/** Looks up several elements under one scope at once, by name. */
	function partsOf(scope, selectors) {
		return Object.fromEntries(Object.entries(selectors).map(([name, selector]) => [name, pick(selector, scope)]));
	}

	function viewerPart(key) {
		return pick(`[data-med-v="${key}"]`, ui.viewer);
	}

	function notify(toast) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(toast) : null;
	}

	function escapeText(value) {
		const swap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value).replace(/[&<>"']/g, (character) => swap[character]);
	}

	function textMatches(haystack, needle) {
		if (window.Basalt?.matchesQuery) return window.Basalt.matchesQuery(haystack, needle);
		return haystack.toLowerCase().includes(needle.toLowerCase());
	}

	function countOf(amount, singular, pluralForm) {
		return `${amount} ${amount === 1 ? singular : pluralForm}`;
	}

	function entryById(id) {
		return LIBRARY.find((entry) => entry.id === id);
	}

	function openEntry() {
		return entryById(showing.openId);
	}

	/* Facts about a file. */
	function extensionOf(entry) {
		return entry.name.split('.').pop().toUpperCase();
	}

	function lacksAlt(entry) {
		return KINDS[entry.kind].group === 'image' && !entry.text.trim();
	}

	function isUnused(entry) {
		return !entry.used.length;
	}

	function isDocument(entry) {
		return entry.kind === 'pdf' || entry.kind === 'doc';
	}

	function dimensionsOf(entry) {
		return entry.w ? `${entry.w} × ${entry.h}` : '';
	}

	function cdnLink(entry) {
		return `${FILE_HOST}${entry.date.slice(0, 7).replace('-', '/')}/${entry.name}`;
	}

	/* Formatting. Sizes read in KB, MB or GB; dates as "Oct 7, 2026" in the
     viewer and "Oct 7" in the list. */
	function sizeLabel(kb) {
		if (kb >= 1024 * 1024) return `${+(kb / 1048576).toFixed(1)} GB`;
		if (kb >= 1024) return `${(kb / 1024).toFixed(kb >= 102400 ? 0 : 1)} MB`;
		return `${Math.max(1, Math.round(kb))} KB`;
	}

	function longDate(iso) {
		const [year, month, day] = iso.split('-');
		return `${MONTH_SHORT[+month - 1]} ${+day}, ${year}`;
	}

	function shortDate(iso) {
		const [, month, day] = iso.split('-');
		return `${MONTH_SHORT[+month - 1]} ${+day}`;
	}

	function describe(entry) {
		if (entry.kind === 'video') return `${entry.dur} · ${sizeLabel(entry.kb)}`;
		if (entry.pages) return `${entry.pages}${entry.pages === 1 ? ' page' : ' pages'} · ${sizeLabel(entry.kb)}`;
		const measured = dimensionsOf(entry);
		return `${measured ? `${measured} · ` : ''}${sizeLabel(entry.kb)}`;
	}

	function photoUrl(id, width, height) {
		return window.Basalt.photo(id, width, height);
	}

	/* A file as a picture: the photo when there is one, otherwise a drawing
     of the file, which is the logo itself or a page wearing the file
     type. */
	function artFor(entry, width, height) {
		if (entry.local) return `<img src="${entry.local}" alt="" loading="lazy">`;
		if (entry.photo)
			return `<img src="${photoUrl(entry.photo, width, height)}" alt="" loading="lazy" width="${width}" height="${height}">`;
		if (entry.kind === 'logo') {
			const wordmark = entry.w > entry.h ? '<span class="med-art-word">Fieldline</span>' : '';
			return `<span class="med-art med-art-logo${entry.dark ? ' med-art-dark' : ''}"><svg viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path d="M8 32V8h22v6H15v5h12v6H15v7z"/><circle cx="31" cy="29" r="3.5"/></svg>${wordmark}</span>`;
		}
		if (isDocument(entry)) {
			return `<span class="med-art med-art-doc med-art-${entry.col}"><span class="med-art-page"><span class="med-art-band"></span><span class="med-art-line"></span><span class="med-art-line"></span><span class="med-art-line med-art-line-short"></span><span class="med-art-ext">${extensionOf(entry)}</span></span></span>`;
		}
		return `<span class="med-art"><i class="bi bi-${KINDS[entry.kind].icon}" aria-hidden="true"></i></span>`;
	}

	function iconArt(fileKind) {
		return `<i class="bi bi-${fileKind ? KINDS[fileKind].icon : 'image'}" aria-hidden="true"></i>`;
	}

	/* The files in view: the active view's test, then the collection, then
     the search over name and text, in the chosen order. */
	function currentFiles() {
		const needle = showing.search.trim();
		const kept = LIBRARY.filter(
			(entry) =>
				VIEW_KEEPS[showing.which](entry) &&
				(showing.collection === 'all' || entry.col === showing.collection) &&
				(!needle || textMatches(`${entry.name} ${entry.text}`, needle)),
		);
		return kept.sort(ORDERINGS[showing.order] ?? ORDERINGS.newest);
	}

	function byNewest(left, right) {
		return right.date.localeCompare(left.date);
	}

	function wrapperOf(id) {
		return pick(`[data-med-id="${id}"]`, showing.layout === 'grid' ? ui.grid : ui.rows);
	}

	/* The collection cards fan out the three newest files each; All files
     takes the newest from each collection. The view pills count what
     they would show, and the storage line sums everything. */
	function buildCollectionChoices() {
		const collectionKeys = Object.keys(COLLECTIONS);
		ui.collections.innerHTML = ['all', ...collectionKeys]
			.map((key) => {
				const radio = `<input type="radio" class="btn-check" name="med-col" id="med-col-${key}" value="${key}"${key === 'all' ? ' checked' : ''}>`;
				const caption = `<span class="med-col-text"><span class="med-col-name">${key === 'all' ? 'All files' : COLLECTIONS[key]}</span><span class="med-col-meta" data-med-col-meta></span></span>`;
				return `${radio}<label class="med-col" for="med-col-${key}" data-med-col-card="${key}"><span class="med-col-stack" aria-hidden="true" data-med-col-stack></span>${caption}</label>`;
			})
			.join('');
		ui.uploadInto.innerHTML = collectionKeys
			.map((key) => `<option value="${key}">${COLLECTIONS[key]}</option>`)
			.join('');
		ui.moveMenu.innerHTML = collectionKeys
			.map(
				(key) =>
					`<li><button type="button" class="dropdown-item" data-med-move-to="${key}">${COLLECTIONS[key]}</button></li>`,
			)
			.join('');
		window.Basalt.select?.refresh?.(ui.uploadInto);
	}

	function drawCollections() {
		for (const card of pickAll('[data-med-col-card]', ui.collections)) {
			const key = card.getAttribute('data-med-col-card');
			const inCollection = LIBRARY.filter((entry) => key === 'all' || entry.col === key).sort(byNewest);
			const fanned =
				key === 'all'
					? Object.keys(COLLECTIONS)
							.map((name) => LIBRARY.filter((entry) => entry.col === name).sort(byNewest)[0])
							.filter(Boolean)
					: inCollection;
			pick('[data-med-col-stack]', card).innerHTML = fanned
				.slice(0, 3)
				.reverse()
				.map(
					(entry) => `<span class="med-col-card" data-med-id="${entry.id}">${artFor(entry, 160, 120)}</span>`,
				)
				.join('');
			pick('[data-med-col-meta]', card).textContent =
				`${countOf(inCollection.length, 'file', 'files')} · ${sizeLabel(inCollection.reduce((sum, entry) => sum + entry.kb, 0))}`;
		}
		for (const viewCounter of viewCounters) {
			viewCounter.textContent = LIBRARY.filter(VIEW_KEEPS[viewCounter.getAttribute('data-med-count')]).length;
		}
		const usedKb = LIBRARY.reduce((sum, entry) => sum + entry.kb, 0);
		ui.storage.textContent = `${sizeLabel(usedKb)} of ${sizeLabel(QUOTA_KB)} used`;
	}

	/* The grid tile and the list row for one file. */
	function flagsHtml(entry) {
		const warnings = [
			lacksAlt(entry) ? '<span class="med-flag med-flag-warning">No alt text</span>' : '',
			isUnused(entry) ? '<span class="med-flag">Not used</span>' : '',
		].join('');
		return warnings ? `<span class="med-flags">${warnings}</span>` : '';
	}

	function durationHtml(entry) {
		return entry.kind === 'video'
			? `<span class="med-tile-dur"><i class="bi bi-play-fill" aria-hidden="true"></i>${entry.dur}</span>`
			: '';
	}

	function tickboxHtml(entry, extraClass) {
		return `<input class="form-check-input${extraClass}" type="checkbox" aria-label="Select ${escapeText(entry.name)}"${ticked.has(entry.id) ? ' checked' : ''} data-med-pick="${entry.id}">`;
	}

	function tileHtml(entry) {
		const thumb = `<div class="med-tile-thumb">${artFor(entry, 480, 360)}${flagsHtml(entry)}${durationHtml(entry)}</div>`;
		const caption = `<button type="button" class="med-tile-open" data-med-open="${entry.id}"><span class="med-tile-name">${escapeText(entry.name)}</span><span class="med-tile-meta">${escapeText(describe(entry))}</span></button>`;
		return `<li class="med-tile${ticked.has(entry.id) ? ' is-picked' : ''}" data-med-id="${entry.id}">${thumb}${tickboxHtml(entry, ' med-tile-check')}${caption}</li>`;
	}

	function rowHtml(entry) {
		const placement = entry.used.length
			? countOf(entry.used.length, 'place', 'places')
			: '<span class="med-muted">Not used</span>';
		const altWarning = lacksAlt(entry) ? ' · <span class="med-file-warn">No alt text</span>' : '';
		const fileCell = `<td><div class="med-file"><span class="med-file-thumb">${artFor(entry, 96, 72)}</span><span class="med-file-text"><button type="button" class="med-file-name" data-med-open="${entry.id}">${escapeText(entry.name)}</button><span class="med-file-sub">${escapeText(COLLECTIONS[entry.col])}${altWarning}</span></span></div></td>`;
		const factCells = `<td class="med-table-type">${KIND_LABEL[entry.kind]}</td><td class="med-table-size">${sizeLabel(entry.kb)}</td><td class="med-table-used">${placement}</td><td class="med-table-date">${shortDate(entry.date)}</td>`;
		return `<tr class="${ticked.has(entry.id) ? 'is-picked' : ''}" data-med-id="${entry.id}"><td class="med-table-check">${tickboxHtml(entry, '')}</td>${fileCell}${factCells}</tr>`;
	}

	function emptyHtml() {
		if (showing.search.trim()) {
			if (!window.Basalt?.emptyState) return '';
			const narrowed = showing.which !== 'all' || showing.collection !== 'all';
			return window.Basalt.emptyState({
				query: showing.search,
				noun: 'files',
				text: narrowed ? 'Check the spelling, or clear the filters above.' : '',
			});
		}
		return VIEW_EMPTY[showing.which] ?? PLAIN_EMPTY;
	}

	/* Draws the grid or the list, the empty state, the Show more button
     and the summary line. */
	function drawLibrary() {
		inView = currentFiles();
		const drawn = inView.slice(0, showing.limit);
		const asGrid = showing.layout === 'grid';
		ui.grid.hidden = !asGrid || !inView.length;
		ui.tableWrap.hidden = asGrid || !inView.length;
		if (asGrid) ui.grid.innerHTML = drawn.map(tileHtml).join('');
		else ui.rows.innerHTML = drawn.map(rowHtml).join('');

		ui.empty.hidden = inView.length > 0;
		if (!inView.length) ui.empty.innerHTML = emptyHtml();

		const notYetShown = inView.length - drawn.length;
		ui.more.hidden = notYetShown <= 0;
		ui.more.textContent = `Show ${Math.min(notYetShown, BATCH)} more`;
		ui.summary.textContent =
			inView.length === LIBRARY.length
				? countOf(inView.length, 'file', 'files')
				: `${inView.length} of ${LIBRARY.length} files`;
		drawSelection();
	}

	function redrawAll() {
		drawCollections();
		drawLibrary();
	}

	/* Ticking files. The bar at the bottom counts them; the header box
     reflects the files on screen. */
	function drawSelection() {
		const tickedCount = ticked.size;
		ui.bulk.hidden = !tickedCount;
		pageRoot.classList.toggle('is-picking', tickedCount > 0);
		ui.bulkCount.textContent = `${countOf(tickedCount, 'file', 'files')} selected`;
		const onScreen = inView.slice(0, showing.limit).map((entry) => entry.id);
		const tickedOnScreen = onScreen.filter((id) => ticked.has(id)).length;
		ui.tickAll.checked = onScreen.length > 0 && tickedOnScreen === onScreen.length;
		ui.tickAll.indeterminate = tickedOnScreen > 0 && tickedOnScreen < onScreen.length;
	}

	function setTicked(id, on) {
		if (on) ticked.add(id);
		else ticked.delete(id);
		wrapperOf(id)?.classList.toggle('is-picked', on);
		drawSelection();
	}

	/* Deleting keeps the files aside until the toast's Undo has had its
     chance; Undo puts each back where it was. */
	function discardFiles(ids, afterwards) {
		const gone = LIBRARY.filter((entry) => ids.includes(entry.id));
		if (!gone.length) return;
		const placements = gone.reduce((sum, entry) => sum + entry.used.length, 0);
		const slots = gone.map((entry) => LIBRARY.indexOf(entry));
		for (const entry of gone) {
			LIBRARY.splice(LIBRARY.indexOf(entry), 1);
			ticked.delete(entry.id);
		}
		redrawAll();

		const pronoun = gone.length === 1 ? 'it' : 'them';
		notify({
			tone: 'danger',
			title: gone.length === 1 ? `${gone[0].name} deleted` : `${countOf(gone.length, 'file', 'files')} deleted`,
			text: placements
				? `Removed from ${countOf(placements, 'place', 'places')} that used ${pronoun}.`
				: `Nothing on the site used ${pronoun}.`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						for (const [offset, entry] of gone.entries())
							LIBRARY.splice(Math.min(slots[offset], LIBRARY.length), 0, entry);
						redrawAll();
						notify({ tone: 'success', text: 'Put back.' });
					},
				},
			],
		});
		afterwards?.();
	}

	/* The viewer: the file large on the left, its details on the right.
     The file at stage size is a picture in its own shape, a logo on a
     board of its proportions, or a document as a page in its
     collection's color. */
	function bigPhoto(entry) {
		return photoUrl(entry.photo, 1600, Math.round((1600 * (entry.h || 2)) / (entry.w || 3)));
	}

	function warmCache(entry) {
		if (entry?.photo && !entry.local) new Image().src = bigPhoto(entry);
	}

	function stageArt(entry) {
		if (entry.kind === 'logo') {
			return `<span class="med-view-board" style="--med-ratio: ${((entry.w || 1) / (entry.h || 1)).toFixed(3)}">${artFor(entry)}</span>`;
		}
		if (isDocument(entry)) {
			return `<span class="med-view-doc" style="--med-doc-tone: var(--basalt-series-${DOC_TONE[entry.col] ?? 1})"><span class="med-view-doc-band"></span>${'<span class="med-view-doc-line"></span>'.repeat(12)}<span class="med-view-doc-ext">${extensionOf(entry)}</span></span>`;
		}
		const altText = entry.kind === 'video' ? '' : escapeText(entry.text);
		let picture = artFor(entry);
		if (entry.local) picture = `<img src="${entry.local}" alt="${altText}">`;
		else if (entry.photo)
			picture = `<img src="${bigPhoto(entry)}" alt="${altText}" width="${entry.w}" height="${entry.h}">`;
		return `<span class="med-view-frame">${picture}${durationHtml(entry)}</span>`;
	}

	function usedHtml(entry) {
		if (!entry.used.length) return '<li class="med-used-none">Not used anywhere yet, so it is safe to delete.</li>';
		return entry.used
			.map((key) => {
				const place = PLACES[key];
				const isPage = place.kind === 'page';
				return `<li class="med-used-item"><i class="bi bi-${isPage ? 'window' : 'journal-text'}" aria-hidden="true"></i><a href="${isPage ? 'page-editor.html' : 'post-editor.html'}">${escapeText(place.title)}</a><span class="med-used-kind">${isPage ? 'Page' : 'Post'}</span></li>`;
			})
			.join('');
	}

	function factsHtml(entry) {
		const uploader =
			entry.by === SIGNED_IN
				? `<a href="employee-user-details.html">${escapeText(entry.by)}</a>`
				: escapeText(entry.by);
		const typeLine =
			KIND_LABEL[entry.kind] === extensionOf(entry)
				? extensionOf(entry)
				: `${KIND_LABEL[entry.kind]} (${extensionOf(entry)})`;
		const facts = [
			['Collection', escapeText(COLLECTIONS[entry.col])],
			['Type', typeLine],
			entry.kind === 'video' && ['Length', entry.dur],
			entry.w && ['Dimensions', `${dimensionsOf(entry)} px`],
			entry.pages && ['Pages', String(entry.pages)],
			['File size', sizeLabel(entry.kb)],
			['Uploaded', `${longDate(entry.date)} by ${uploader}`],
		];
		return facts
			.filter(Boolean)
			.map(([label, value]) => `<div class="med-facts-row"><dt>${label}</dt><dd>${value}</dd></div>`)
			.join('');
	}

	/**
	 * Fills the viewer with one file. `direction` is -1 or 1 when stepping,
	 * which plays the slide, and left out when the viewer opens.
	 */
	function showFile(id, direction) {
		const entry = entryById(id);
		if (!entry) return;
		showing.openId = id;
		const fileKind = KINDS[entry.kind];
		const placeIndex = viewerOrder.indexOf(id);

		viewerPart('name').textContent = entry.name;
		viewerPart('sub').textContent = [KIND_LABEL[entry.kind], entry.dur, sizeLabel(entry.kb)]
			.filter(Boolean)
			.join(' · ');
		viewerPart('pos').textContent = viewerOrder.length > 1 ? `${placeIndex + 1} of ${viewerOrder.length}` : '';

		for (const arrow of pickAll('[data-med-step]', ui.viewer)) {
			const arrowTarget = placeIndex + Number(arrow.getAttribute('data-med-step'));
			arrow.disabled = arrowTarget < 0 || arrowTarget >= viewerOrder.length;
		}
		/* Landing on the last file disables the arrow that has the focus. */
		if (document.activeElement?.disabled) {
			const otherArrow = pick('[data-med-step]:not(:disabled)', ui.viewer);
			(otherArrow ?? pick('.btn-close', ui.viewer)).focus();
		}

		const media = viewerPart('media');
		const slide = direction ? ` is-stepping${direction < 0 ? ' is-back' : ''}` : '';
		media.className = `med-view-media med-view-media-${entry.kind}${slide}`;
		media.innerHTML = stageArt(entry);
		if (direction) {
			media.style.animation = 'none';
			void media.offsetWidth;
			media.style.animation = '';
		}
		warmCache(entryById(viewerOrder[placeIndex + 1]));
		warmCache(entryById(viewerOrder[placeIndex - 1]));

		const textField = viewerPart('text');
		viewerPart('text-label').textContent = fileKind.field;
		textField.value = entry.text;
		textField.placeholder = entry.kind === 'video' ? 'Optional' : '';
		markInvalid(false);
		countChars();

		viewerPart('link').value = cdnLink(entry);
		viewerPart('used').innerHTML = usedHtml(entry);
		viewerPart('facts').innerHTML = factsHtml(entry);
	}

	function openViewer(id, from) {
		viewerOrder = inView.map((entry) => entry.id);
		if (!viewerOrder.includes(id)) viewerOrder = [id];
		viewerOpener = from ?? null;
		showFile(id);
		bootstrap.Modal.getOrCreateInstance(ui.viewer).show();
	}

	function stepViewer(by) {
		const followOnId = viewerOrder[viewerOrder.indexOf(showing.openId) + by];
		if (followOnId) showFile(followOnId, by);
	}

	/* The hint under the text field becomes the error while the field
     needs text. */
	function markInvalid(on) {
		const fileKind = KINDS[openEntry().kind];
		const textField = viewerPart('text');
		textField.classList.toggle('is-invalid', on);
		textField.setAttribute('aria-invalid', String(on));
		viewerPart('hint-row').classList.toggle('is-error', on);
		viewerPart('text-hint').textContent = on ? fileKind.need : fileKind.hint;
	}

	function countChars() {
		const textField = viewerPart('text');
		viewerPart('chars').textContent = `${textField.value.length} / ${textField.maxLength}`;
	}

	function saveText() {
		const entry = openEntry();
		if (!entry) return;
		const textField = viewerPart('text');
		const typed = textField.value.trim();
		if (!typed && KINDS[entry.kind].need) {
			markInvalid(true);
			textField.focus();
			return;
		}
		markInvalid(false);
		entry.text = typed;
		redrawAll();
		const picture = pick('img', viewerPart('media'));
		if (picture && entry.kind !== 'video') picture.alt = typed;
		notify({
			tone: 'success',
			title: 'Saved',
			text: `${KINDS[entry.kind].field} for ${entry.name} is updated everywhere it is used.`,
		});
	}

	/* Deleting from the viewer moves on to the next file, or closes the
     viewer when that was the last one. Undo stays on the toast. */
	function deleteOpen() {
		const id = showing.openId;
		const placeIndex = viewerOrder.indexOf(id);
		const followOnId = viewerOrder[placeIndex + 1] ?? viewerOrder[placeIndex - 1];
		discardFiles([id], () => {
			viewerOrder.splice(placeIndex, 1);
			if (followOnId) showFile(followOnId, viewerOrder[placeIndex] === followOnId ? 1 : -1);
			else bootstrap.Modal.getOrCreateInstance(ui.viewer).hide();
		});
	}

	function downloadOpen() {
		const entry = openEntry();
		if (!entry) return;
		if (entry.local) {
			const anchor = document.createElement('a');
			anchor.href = entry.local;
			anchor.download = entry.name;
			anchor.click();
			return;
		}
		notify({
			tone: 'info',
			title: `Downloading ${entry.name}`,
			text: `${sizeLabel(entry.kb)}, from ${COLLECTIONS[entry.col]}.`,
		});
	}

	function replaceOpen(chosenFile) {
		const entry = openEntry();
		if (!chosenFile || !entry) return;
		entry.kb = Math.max(1, chosenFile.size / 1024);
		entry.date = DEMO_DAY;
		entry.by = SIGNED_IN;
		if (/^image\//.test(chosenFile.type)) {
			entry.local = URL.createObjectURL(chosenFile);
			entry.photo = null;
		}
		redrawAll();
		showFile(entry.id);
		notify({
			tone: 'success',
			title: `${entry.name} replaced`,
			text: entry.used.length
				? `The ${countOf(entry.used.length, 'place', 'places')} using it show the new file.`
				: 'Same name and link, new file.',
		});
	}

	/* On close the focus lands on the file you ended on, showing more of
     the list first if you stepped past what was on screen. */
	function giveBackFocus() {
		const placeIndex = inView.findIndex((entry) => entry.id === showing.openId);
		if (placeIndex >= showing.limit) {
			showing.limit = Math.ceil((placeIndex + 1) / BATCH) * BATCH;
			drawLibrary();
		}
		const wrapper = placeIndex >= 0 ? wrapperOf(showing.openId) : null;
		const landing =
			(wrapper && pick('[data-med-open]', wrapper)) || (viewerOpener?.isConnected ? viewerOpener : null);
		showing.openId = null;
		landing?.focus();
	}

	function wireViewer() {
		const textField = viewerPart('text');
		textField.addEventListener('input', () => {
			countChars();
			if (textField.classList.contains('is-invalid')) markInvalid(false);
		});
		pick('[data-med-save]', ui.viewer).addEventListener('click', saveText);
		pick('[data-med-delete]', ui.viewer).addEventListener('click', deleteOpen);
		pick('[data-med-download]', ui.viewer).addEventListener('click', downloadOpen);

		const replaceInput = pick('[data-med-replace-input]', ui.viewer);
		pick('[data-med-replace]', ui.viewer).addEventListener('click', () => replaceInput.click());
		replaceInput.addEventListener('change', () => {
			const chosenFile = replaceInput.files[0];
			replaceInput.value = '';
			replaceOpen(chosenFile);
		});

		for (const arrow of pickAll('[data-med-step]', ui.viewer)) {
			arrow.addEventListener('click', () => stepViewer(Number(arrow.getAttribute('data-med-step'))));
		}

		/* The arrow keys step too, unless the cursor is in a field. */
		ui.viewer.addEventListener('keydown', (event) => {
			if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
			const by = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
			if (!by || event.target.closest('input, textarea, select, [contenteditable]')) return;
			event.preventDefault();
			stepViewer(by);
		});

		/* So does a sideways swipe across the stage. */
		const stageBox = viewerPart('stage');
		let touchStart = null;
		stageBox.addEventListener(
			'touchstart',
			(event) => {
				touchStart =
					event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
			},
			{ passive: true },
		);
		stageBox.addEventListener(
			'touchend',
			(event) => {
				if (!touchStart) return;
				const acrossBy = event.changedTouches[0].clientX - touchStart.x;
				const downBy = event.changedTouches[0].clientY - touchStart.y;
				touchStart = null;
				if (Math.abs(acrossBy) > 48 && Math.abs(acrossBy) > Math.abs(downBy) * 1.5)
					stepViewer(acrossBy < 0 ? 1 : -1);
			},
			{ passive: true },
		);

		ui.viewer.addEventListener('hidden.bs.modal', giveBackFocus);
	}

	/* Uploading. Files are read in the browser and added to the library;
     the progress bar is pretend. Send them to your own storage when
     deployed. */
	function kindFromName(name) {
		const extension = name.split('.').pop().toLowerCase();
		const rule = EXT_KIND.find(([pattern]) => pattern.test(extension));
		return rule ? rule[1] : 'doc';
	}

	function queueItemHtml(chosenFile, fileKind) {
		const nameLine = `<div class="basalt-file-queue-line"><span class="basalt-file-queue-name">${escapeText(chosenFile.name)}</span><span class="basalt-file-queue-meta" data-med-q-meta>${sizeLabel(chosenFile.size / 1024)}</span></div>`;
		const bar = `<div class="progress" role="progressbar" aria-label="Upload of ${escapeText(chosenFile.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="progress-bar"></div></div>`;
		return `<span class="basalt-file-queue-icon" aria-hidden="true"><i class="bi bi-${KINDS[fileKind].icon}"></i></span><div>${nameLine}${bar}</div><span class="basalt-file-queue-meta" data-med-q-pct>0%</span>`;
	}

	function startUpload(chosenFile, collection) {
		const fileKind = kindFromName(chosenFile.name);
		const row = document.createElement('li');
		row.className = 'basalt-file-queue-item';
		row.innerHTML = queueItemHtml(chosenFile, fileKind);
		ui.queue.prepend(row);
		const bar = pick('.progress-bar', row);
		const track = pick('.progress', row);
		const percent = pick('[data-med-q-pct]', row);

		followingId += 1;
		const entry = {
			id: `m${followingId}`,
			name: chosenFile.name.toLowerCase().replace(/\s+/g, '-'),
			kind: fileKind,
			col: collection,
			kb: Math.max(1, chosenFile.size / 1024),
			date: DEMO_DAY,
			by: SIGNED_IN,
			text: '',
			used: [],
		};
		if (fileKind === 'image' || fileKind === 'logo') {
			entry.local = URL.createObjectURL(chosenFile);
			const probe = new Image();
			probe.onload = () => {
				entry.w = probe.naturalWidth;
				entry.h = probe.naturalHeight;
				if (showing.openId === entry.id) showFile(entry.id);
				drawLibrary();
			};
			probe.src = entry.local;
		}
		if (fileKind === 'video') entry.dur = '0:00';

		let progress = 0;
		function advanceBar() {
			progress = Math.min(100, progress + 8 + Math.random() * 14);
			bar.style.width = `${progress}%`;
			track.setAttribute('aria-valuenow', String(Math.round(progress)));
			percent.textContent = `${Math.round(progress)}%`;
			if (progress < 100) {
				setTimeout(advanceBar, UPLOAD_TICK);
				return;
			}
			row.classList.add('is-done');
			percent.innerHTML =
				'<i class="bi bi-check2-circle" aria-hidden="true"></i><span class="visually-hidden">Done</span>';
			LIBRARY.unshift(entry);
			redrawAll();
		}
		setTimeout(advanceBar, UPLOAD_TICK);
	}

	function uploadAll(chosenFiles) {
		const collection = ui.uploadInto.value;
		ui.queue.hidden = false;
		for (const chosenFile of chosenFiles) startUpload(chosenFile, collection);
		const anyImages = chosenFiles.some((chosenFile) => KINDS[kindFromName(chosenFile.name)].group === 'image');
		notify({
			tone: 'info',
			title: `${countOf(chosenFiles.length, 'file', 'files')} uploading to ${COLLECTIONS[collection]}`,
			text: anyImages
				? 'Add alt text to the images once they arrive.'
				: 'They appear in the library as each one finishes.',
		});
	}

	function wireUploads() {
		pick('[data-med-upload]').addEventListener('click', () => {
			if (showing.collection !== 'all') ui.uploadInto.value = showing.collection;
			bootstrap.Modal.getOrCreateInstance(ui.uploadDialog).show();
		});
		pick('[data-med-drop]', ui.uploadDialog).addEventListener('basalt:files', (event) =>
			uploadAll(event.detail.files),
		);
		ui.uploadDialog.addEventListener('hidden.bs.modal', () => {
			for (const finished of pickAll('.basalt-file-queue-item.is-done', ui.queue)) finished.remove();
			ui.queue.hidden = !ui.queue.children.length;
		});
	}

	/* The views, the search, the collection cards, the sort, the layout
     switch and Show more all redraw the library. Pictures that fail to
     load fall back to the drawing for their kind. */
	function wireLibrary() {
		ui.views.addEventListener('change', (event) => {
			if (event.target.name !== 'med-view') return;
			showing.which = event.target.value;
			showing.limit = BATCH;
			drawLibrary();
		});
		let typingPause = 0;
		ui.search.addEventListener('input', () => {
			clearTimeout(typingPause);
			typingPause = setTimeout(() => {
				showing.search = ui.search.value;
				showing.limit = BATCH;
				drawLibrary();
			}, SEARCH_DELAY);
		});
		ui.collections.addEventListener('change', (event) => {
			showing.collection = event.target.value;
			showing.limit = BATCH;
			drawLibrary();
		});
		ui.order.addEventListener('change', () => {
			showing.order = ui.order.value;
			drawLibrary();
		});
		for (const choice of pickAll('[data-med-layout]')) {
			choice.addEventListener('change', () => {
				if (!choice.checked) return;
				showing.layout = choice.value;
				drawLibrary();
			});
		}
		ui.more.addEventListener('click', () => {
			const firstNew = showing.limit;
			window.Basalt.slide(showing.layout === 'grid' ? ui.grid : ui.tableWrap, () => {
				showing.limit += BATCH;
				drawLibrary();
			});
			const openers =
				showing.layout === 'grid' ? pickAll('.med-tile-open', ui.grid) : pickAll('.med-file-name', ui.rows);
			openers[firstNew]?.focus({ preventScroll: true });
		});
		pageRoot.addEventListener('error', swapBrokenImage, true);
		ui.viewer.addEventListener('error', swapBrokenImage, true);
	}

	/* A name or a thumbnail opens the file; while files are ticked a
     thumbnail ticks instead. The checkboxes tick one or everything on
     screen. */
	function wireSelection() {
		pageRoot.addEventListener('click', (event) => {
			const opener = event.target.closest('[data-med-open]');
			if (opener) {
				openViewer(opener.getAttribute('data-med-open'), opener);
				return;
			}
			const thumbnail = event.target.closest('.med-tile-thumb, .med-file-thumb');
			if (!thumbnail) return;
			const wrapper = thumbnail.closest('[data-med-id]');
			const id = wrapper.getAttribute('data-med-id');
			if (pageRoot.classList.contains('is-picking')) setTicked(id, !ticked.has(id));
			else openViewer(id, pick('[data-med-open]', wrapper));
			const tickbox = pick('[data-med-pick]', wrapper);
			if (tickbox) tickbox.checked = ticked.has(id);
		});
		pageRoot.addEventListener('change', (event) => {
			const tickbox = event.target.closest('[data-med-pick]');
			if (tickbox) setTicked(tickbox.getAttribute('data-med-pick'), tickbox.checked);
		});
		ui.tickAll.addEventListener('change', () => {
			for (const entry of inView.slice(0, showing.limit)) {
				if (ui.tickAll.checked) ticked.add(entry.id);
				else ticked.delete(entry.id);
			}
			drawLibrary();
		});
	}

	/* The bar at the bottom: move the ticked files, zip them, delete them
     or let them go. */
	function moveTicked(collection) {
		const tickedCount = ticked.size;
		for (const entry of LIBRARY) {
			if (ticked.has(entry.id)) entry.col = collection;
		}
		ticked.clear();
		redrawAll();
		notify({
			tone: 'success',
			text: `${countOf(tickedCount, 'file', 'files')} moved to ${COLLECTIONS[collection]}.`,
		});
	}

	const BULK_ACTIONS = {
		clear() {
			ticked.clear();
			drawLibrary();
		},
		download() {
			const totalKb = LIBRARY.filter((entry) => ticked.has(entry.id)).reduce((sum, entry) => sum + entry.kb, 0);
			notify({
				tone: 'info',
				title: 'Preparing a zip',
				text: `${countOf(ticked.size, 'file', 'files')}, ${sizeLabel(totalKb)}. It downloads when ready.`,
			});
			ticked.clear();
			drawLibrary();
		},
		delete() {
			discardFiles([...ticked]);
		},
	};

	function wireBulkBar() {
		ui.bulk.addEventListener('click', (event) => {
			const destination = event.target.closest('[data-med-move-to]');
			if (destination) {
				moveTicked(destination.getAttribute('data-med-move-to'));
				return;
			}
			const bulkAction = event.target.closest('[data-med-bulk-act]');
			if (bulkAction) BULK_ACTIONS[bulkAction.getAttribute('data-med-bulk-act')]?.();
		});
	}

	function swapBrokenImage(event) {
		const picture = event.target;
		if (!(picture instanceof HTMLImageElement) || picture.dataset.medBroken) return;
		picture.dataset.medBroken = 'true';
		const wrapper = picture.closest('[data-med-id]');
		const entry = entryById(wrapper ? wrapper.getAttribute('data-med-id') : showing.openId);
		const art = document.createElement('span');
		art.className = 'med-art';
		art.innerHTML = iconArt(entry?.kind);
		picture.replaceWith(art);
	}

	start();
})();
