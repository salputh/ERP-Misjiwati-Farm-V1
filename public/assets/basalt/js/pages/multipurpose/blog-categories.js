/**
 * Basalt: the Blog Categories page (blog-categories.html).
 * The category tree with drag and menu reordering, folding, search and
 * a filter by type; the drawer that adds or edits a category; deleting
 * with a new home for the items; importing a pasted outline; and the
 * tag list with rename, merge and delete with undo. Everything is drawn
 * from STARTING_DATA below. A live app would load the same shapes from
 * its API and save after every change.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-cc-root]');
	if (!pageRoot) return;

	const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const TONE_COUNT = 8;
	const TAG_BATCH = 12;
	const ICON_FOR_TYPE = { Posts: 'file-earmark-text', Pages: 'file-earmark-richtext', Media: 'image' };
	const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

	/* The icons a category can wear. A subcategory shows only its
     category's color. */
	const ICON_CHOICES = [
		'folder',
		'lightbulb',
		'chat-quote',
		'megaphone',
		'cpu',
		'building',
		'life-preserver',
		'tools',
		'calendar-event',
		'shield-check',
		'book',
		'camera',
	];
	const SAMPLE_OUTLINE =
		'Safety on Site\n- Lone Working Rules\n- Manual Handling\nEvents\n- Local Expos\n- Webinars\nCustomer Stories\n- Movers & Storage';

	/**
	 * One category. `own` is what is filed directly in it; its total adds
	 * everything in its subcategories. `tone` is 1 to 8, a chart color
	 * (--basalt-series-n), and `icon` a Bootstrap icon from ICON_CHOICES;
	 * only top-level categories carry either, a subcategory shows its
	 * category's. `types` is what can be filed in it.
	 */
	function makeCategory(id, name, tone, own, types, description, extra = {}) {
		return {
			id,
			name,
			slug: toSlug(name),
			tone,
			icon: 'folder',
			own,
			types,
			description,
			seoTitle: '',
			seoDesc: '',
			children: [],
			...extra,
		};
	}

	const STARTING_DATA = {
		tree: [
			makeCategory(
				'c-field-tips',
				'Field Tips',
				1,
				0,
				['Posts', 'Pages'],
				'Scheduling, reminders and running the office, from people who do it.',
				{
					icon: 'lightbulb',
					seoTitle: 'On-site team tips from working offices | Fieldline',
					children: [
						makeCategory(
							'c-booking',
							'Booking & Scheduling',
							null,
							9,
							['Posts'],
							'Boards, arrival windows and same-day visits.',
						),
						makeCategory(
							'c-pricing',
							'Pricing & Estimates',
							null,
							8,
							['Posts', 'Pages'],
							'Quotes, repeat bookings and getting paid.',
						),
						makeCategory(
							'c-onsite',
							'On-Site Team Tips',
							null,
							5,
							['Posts'],
							'Checklists, photos and the visit itself.',
						),
						makeCategory(
							'c-office',
							'Office Admin',
							null,
							7,
							['Posts'],
							'Time sheets, payroll and the paperwork.',
						),
					],
				},
			),
			makeCategory(
				'c-stories',
				'Customer Stories',
				2,
				0,
				['Posts', 'Media'],
				'How on-site teams run on Fieldline, with their own numbers.',
				{
					icon: 'chat-quote',
					children: [
						makeCategory(
							'c-care',
							'Home & Pet Care',
							null,
							7,
							['Posts', 'Media'],
							'Carers, pet sitters and dog walking teams.',
						),
						makeCategory(
							'c-photo',
							'Photography & Movers',
							null,
							6,
							['Posts'],
							'Shoot days, house moves and planned work.',
						),
						makeCategory(
							'c-cleaning',
							'Cleaning & Property Care',
							null,
							4,
							['Posts'],
							'Teams on rounds and recurring visits.',
						),
					],
				},
			),
			makeCategory(
				'c-product',
				'Product Updates',
				3,
				0,
				['Posts', 'Media'],
				'What shipped, what changed and what is next.',
				{
					icon: 'megaphone',
					children: [
						makeCategory(
							'c-releases',
							'Release Notes',
							null,
							6,
							['Posts'],
							'Every release, written up for office managers.',
						),
						makeCategory(
							'c-visit-data',
							'Visit Data',
							null,
							5,
							['Posts'],
							'What a million visits say about windows and travel.',
						),
						makeCategory(
							'c-webinars',
							'Webinars',
							null,
							0,
							['Pages', 'Media'],
							'Recordings and sign-up pages for live sessions.',
						),
					],
				},
			),
			makeCategory(
				'c-engineering',
				'Engineering',
				4,
				0,
				['Posts'],
				'The Fieldline app, the schedule board and the public API.',
				{
					icon: 'cpu',
					children: [
						makeCategory(
							'c-mobile',
							'Mobile App',
							null,
							7,
							['Posts'],
							'Offline mode, photos and the on-site app.',
						),
						makeCategory(
							'c-api',
							'Public API',
							null,
							5,
							['Posts'],
							'Integrations, webhooks and data sync.',
						),
					],
				},
			),
			makeCategory('c-company', 'Company', 5, 9, ['Posts', 'Pages'], 'Hiring, security and quarterly recaps.', {
				icon: 'building',
			}),
			makeCategory(
				'c-help',
				'Help Center',
				6,
				0,
				['Pages'],
				'Customer answers about accounts, billing and the apps.',
				{
					icon: 'life-preserver',
					children: [
						makeCategory(
							'c-billing',
							'Plans & Billing',
							null,
							8,
							['Pages'],
							'Changing plans, adding seats and annual billing.',
						),
						makeCategory('c-addons', 'SMS Credits & Add-ons', null, 6, ['Pages'], ''),
					],
				},
			),
		],
		/* Tags live on blog posts only. `cat` is where most of a tag's posts
       sit; `like` names the tag a near-duplicate should merge into. */
		tags: [
			{ name: 'checklist', posts: 2, cat: 'c-onsite', last: '2026-03-11', like: 'checklists' },
			{ name: 'checklists', posts: 5, cat: 'c-onsite', last: '2026-09-16' },
			{ name: 'customer-portal', posts: 7, cat: 'c-mobile', last: '2026-08-26' },
			{ name: 'booking', posts: 9, cat: 'c-booking', last: '2026-09-14' },
			{ name: 'bookings', posts: 1, cat: 'c-booking', last: '2026-02-19', like: 'booking' },
			{ name: 'estimates', posts: 5, cat: 'c-pricing', last: '2026-09-12' },
			{ name: 'visit-data', posts: 7, cat: 'c-visit-data', last: '2026-09-12' },
			{ name: 'hiring', posts: 2, cat: 'c-company', last: '2026-07-24' },
			{ name: 'home-care', posts: 6, cat: 'c-care', last: '2026-09-16' },
			{ name: 'repeat-bookings', posts: 11, cat: 'c-pricing', last: '2026-09-26' },
			{ name: 'offline', posts: 4, cat: 'c-mobile', last: '2026-09-18' },
			{ name: 'platform', posts: 6, cat: 'c-api', last: '2026-09-18' },
			{ name: 'photo-shoots', posts: 4, cat: 'c-photo', last: '2026-08-26' },
			{ name: 'pricing', posts: 4, cat: 'c-pricing', last: '2026-08-07' },
			{ name: 'release', posts: 6, cat: 'c-releases', last: '2026-08-30' },
			{ name: 'day-plans', posts: 12, cat: 'c-booking', last: '2026-09-04' },
			{ name: 'scheduling', posts: 14, cat: 'c-booking', last: '2026-09-26' },
			{ name: 'security', posts: 3, cat: 'c-company', last: '2026-08-18' },
			{ name: 'sms-reminders', posts: 8, cat: 'c-booking', last: '2026-09-09' },
			{ name: 'webinar', posts: 0, cat: null, last: null },
		],
	};

	const categoryTree = STARTING_DATA.tree;
	let tagList = STARTING_DATA.tags;

	/* What the tree and the tag list are showing. `unfolded` holds the ids
     of categories whose subcategories are out; `fresh` the rows to glow
     on the next draw. */
	const treeView = { search: '', type: '', unfolded: new Set([categoryTree[0].id]), fresh: new Set() };
	const tagView = { search: '', order: 'az', showAll: false };

	let editing = null;
	let slugTyped = false;
	let deleting = null;
	let tagEditing = null;
	let tagMode = 'rename';
	let inFlight = null;

	const TAG_ORDERINGS = {
		az: (left, right) => left.name.localeCompare(right.name),
		used: (left, right) => right.posts - left.posts || left.name.localeCompare(right.name),
		recent: (left, right) =>
			(right.last ?? '').localeCompare(left.last ?? '') || left.name.localeCompare(right.name),
	};

	const treeUi = partsOf(pageRoot, {
		body: '[data-cc-tree]',
		empty: '[data-cc-empty]',
		search: '[data-cc-search]',
		type: '[data-cc-type]',
		foldAll: '[data-cc-fold]',
		status: '[data-cc-status]',
		mixSum: '[data-cc-mix-sum]',
		mixBar: '[data-cc-mix-bar]',
		mixList: '[data-cc-mix]',
		catCount: '[data-cc-count="cats"]',
		tagCount: '[data-cc-count="tags"]',
		newButton: '[data-cc-new]',
	});
	const tagsUi = partsOf(pageRoot, {
		body: '[data-cc-tags]',
		empty: '[data-cc-tags-empty]',
		search: '[data-cc-tag-search]',
		order: '[data-cc-tag-sort]',
		more: '[data-cc-tags-more]',
		moreText: '[data-cc-tags-more-text]',
		showAll: '[data-cc-tags-all]',
		status: '[data-cc-tag-status]',
	});

	const categoryDrawer = pick('#cc-drawer');
	const categoryForm = pick('[data-cc-form]', categoryDrawer);
	const editor = partsOf(categoryDrawer, {
		title: '[data-cc-drawer-title]',
		sub: '[data-cc-drawer-sub]',
		tile: '[data-cc-drawer-tile]',
		name: '[data-cc-name]',
		nameError: '[data-cc-name-error]',
		slug: '[data-cc-slug]',
		slugError: '#cc-slug-error',
		parent: '[data-cc-parent]',
		parentHelp: '[data-cc-parent-help]',
		description: '[data-cc-desc]',
		descriptionCount: '[data-cc-desc-count]',
		look: '[data-cc-look]',
		swatches: '[data-cc-swatches]',
		icons: '[data-cc-icons]',
		colorHelp: '[data-cc-color-help]',
		typesError: '[data-cc-types-error]',
		seoTitle: '[data-cc-seo-title]',
		seoDescription: '[data-cc-seo-desc]',
		seoFields: '#cc-seo-fields',
		seoToggle: '[data-cc-seo-toggle]',
		serpUrl: '[data-cc-serp-url]',
		serpTitle: '[data-cc-serp-title]',
		serpDescription: '[data-cc-serp-desc]',
		deleteButton: '[data-cc-delete-open]',
	});
	const typeTicks = pickAll('[data-cc-type-box]', categoryForm);

	const deleteDialog = pick('#cc-delete');
	const deleteUi = partsOf(deleteDialog, {
		form: '[data-cc-delete-form]',
		title: '[data-cc-delete-title]',
		sub: '[data-cc-delete-sub]',
		body: '[data-cc-delete-body]',
		label: '[data-cc-delete-label]',
		destination: '[data-cc-delete-move]',
	});

	const importDialog = pick('#cc-import');
	const importUi = partsOf(importDialog, {
		form: '[data-cc-import-form]',
		text: '[data-cc-import-text]',
		list: '[data-cc-import-list]',
		sum: '[data-cc-import-sum]',
		error: '[data-cc-import-error]',
		sample: '[data-cc-import-sample]',
	});

	const tagDialog = pick('#cc-tag');
	const tagDialogUi = partsOf(tagDialog, {
		form: '[data-cc-tag-form]',
		title: '[data-cc-tag-title]',
		sub: '[data-cc-tag-sub]',
		icon: '[data-cc-tag-icon]',
		name: '[data-cc-tag-name]',
		nameError: '[data-cc-tag-name-error]',
		into: '[data-cc-tag-into]',
		renamePane: '[data-cc-tag-pane="rename"]',
		mergePane: '[data-cc-tag-pane="merge"]',
		go: '[data-cc-tag-go]',
	});

	function start() {
		buildPickers();
		wireToolbar();
		wireRows();
		wireDragging();
		wireEditor();
		wireDeleteDialog();
		wireImport();
		wireTags();
		treeUi.newButton.addEventListener('click', () => openCategoryDrawer(null));
		drawTree();
		drawTags();
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

	function notify(toast) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(toast) : null;
	}

	function escapeText(value) {
		const swap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (character) => swap[character]);
	}

	/** "3 items", "1 category", "2 subcategories"; the plural defaults to an s. */
	function countOf(amount, singular, pluralForm) {
		return `${amount} ${amount === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
	}

	function textMatches(haystack, needle) {
		if (window.Basalt?.matchesQuery) return window.Basalt.matchesQuery(haystack, needle);
		return String(haystack).toLowerCase().includes(needle.toLowerCase());
	}

	function restyleSelect(select) {
		window.Basalt.select?.refresh?.(select);
	}

	function toSlug(text) {
		return String(text ?? '')
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/['"`]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60);
	}

	function shortDate(iso) {
		const [, month, day] = iso.split('-').map(Number);
		return `${MONTH_SHORT[month - 1]} ${day}`;
	}

	function offcanvasOf(element) {
		return bootstrap.Offcanvas.getOrCreateInstance(element);
	}

	function modalOf(element) {
		return bootstrap.Modal.getOrCreateInstance(element);
	}

	/* Walking the tree. Yields every category with its parent, top level
     first, each one's subcategories right after it. */
	function* everyCategory() {
		for (const top of categoryTree) {
			yield [top, null];
			for (const child of top.children) yield [child, top];
		}
	}

	function allCategories() {
		return [...everyCategory()].map(([category]) => category);
	}

	function categoryById(id) {
		return allCategories().find((category) => category.id === id) ?? null;
	}

	function parentOf(id) {
		for (const [category, above] of everyCategory()) {
			if (category.id === id) return above;
		}
		return null;
	}

	function siblingsOf(id) {
		return parentOf(id)?.children ?? categoryTree;
	}

	function itemsIn(category) {
		return category.own + category.children.reduce((sum, child) => sum + itemsIn(child), 0);
	}

	function toneOf(category) {
		return parentOf(category.id)?.tone ?? category.tone;
	}

	/** The first color no top-level category uses yet, so branches stay apart. */
	function spareTone(except) {
		const tonesUsed = categoryTree.filter((top) => top !== except).map((top) => top.tone);
		for (let tone = 1; tone <= TONE_COUNT; tone += 1) {
			if (!tonesUsed.includes(tone)) return tone;
		}
		return (categoryTree.length % TONE_COUNT) + 1;
	}

	function filtering() {
		return Boolean(treeView.search || treeView.type);
	}

	function matchesTreeFilter(category) {
		if (treeView.search && !textMatches(`${category.name} ${category.description}`, treeView.search)) return false;
		return !treeView.type || category.types.includes(treeView.type);
	}

	function anyUnfolded() {
		return categoryTree.some((top) => top.children.length && treeView.unfolded.has(top.id));
	}

	/* The counts on the two tabs. */
	function drawCounts() {
		treeUi.catCount.textContent = allCategories().length;
		treeUi.tagCount.textContent = tagList.length;
	}

	/* The content mix: one bar, a segment per top-level category sized by
     its items, and a legend whose entries jump to the row. */
	function drawMix() {
		const itemTotal = categoryTree.reduce((sum, top) => sum + itemsIn(top), 0);
		const subcategories = categoryTree.reduce((sum, top) => sum + top.children.length, 0);
		const largest = categoryTree.reduce(
			(best, top) => (itemsIn(top) > itemsIn(best) ? top : best),
			categoryTree[0],
		);
		const leadNote = largest && itemsIn(largest) ? `. ${escapeText(largest.name)} holds the most.` : '.';
		treeUi.mixSum.innerHTML = `<strong>${countOf(itemTotal, 'item')}</strong> across ${countOf(categoryTree.length, 'category', 'categories')} and ${countOf(subcategories, 'subcategory', 'subcategories')}${leadNote}`;

		const withItems = categoryTree.filter((top) => itemsIn(top));
		treeUi.mixBar.innerHTML = withItems
			.map((top) => `<span class="cc-mix-seg cc-tone-${top.tone}" style="--cc-w:${itemsIn(top)}"></span>`)
			.join('');
		treeUi.mixList.innerHTML = withItems
			.map(
				(top) =>
					`<li><button type="button" class="cc-mix-key cc-tone-${top.tone}" data-cc-jump="${top.id}" aria-label="${escapeText(top.name)}, ${countOf(itemsIn(top), 'item')}. Show it in the list"><span class="cc-dot" aria-hidden="true"></span>${escapeText(top.name)}<span class="cc-mix-num">${itemsIn(top)}</span></button></li>`,
			)
			.join('');
		treeUi.mixBar.hidden = !itemTotal;
		treeUi.mixList.hidden = !itemTotal;
	}

	function jumpToCategory(id) {
		treeView.search = '';
		treeView.type = '';
		treeUi.search.value = '';
		treeUi.type.value = '';
		restyleSelect(treeUi.type);
		treeView.unfolded.add(id);
		treeView.fresh.add(id);
		for (const child of categoryById(id).children) treeView.fresh.add(child.id);
		drawTree();
		const row = pick(`[data-cc-id="${id}"]`, treeUi.body);
		const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
		row.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
		pick('.cc-cat-name', row).focus({ preventScroll: true });
	}

	/* One row of the tree. `branch` is 'open' for a category whose
     subcategories show under it and 'last' for the last subcategory
     showing; both shape the branch line. */
	function typeChipsHtml(types) {
		const chipHtml = types
			.map(
				(type) =>
					`<span class="cc-chip"><i class="bi bi-${ICON_FOR_TYPE[type]}" aria-hidden="true"></i>${type}</span>`,
			)
			.join('');
		return `<span class="cc-chips">${chipHtml}</span>`;
	}

	function rowMenuHtml(category, isChild, siblings, index) {
		const menuEntries = [
			'<li><button type="button" class="dropdown-item" data-cc-act="edit"><i class="bi bi-pencil" aria-hidden="true"></i>Edit</button></li>',
		];
		if (!isChild)
			menuEntries.push(
				'<li><button type="button" class="dropdown-item" data-cc-act="add-sub"><i class="bi bi-diagram-2" aria-hidden="true"></i>Add a subcategory</button></li>',
			);
		if (index > 0)
			menuEntries.push(
				'<li><button type="button" class="dropdown-item" data-cc-act="up"><i class="bi bi-arrow-up" aria-hidden="true"></i>Move up</button></li>',
			);
		if (index < siblings.length - 1)
			menuEntries.push(
				'<li><button type="button" class="dropdown-item" data-cc-act="down"><i class="bi bi-arrow-down" aria-hidden="true"></i>Move down</button></li>',
			);
		if (category.types.includes('Posts') && itemsIn(category))
			menuEntries.push(
				'<li><a class="dropdown-item" href="blog.html"><i class="bi bi-newspaper" aria-hidden="true"></i>See its posts</a></li>',
			);
		menuEntries.push(
			'<li><hr class="dropdown-divider"></li><li><button type="button" class="dropdown-item cc-danger-item" data-cc-act="delete"><i class="bi bi-trash3" aria-hidden="true"></i>Delete</button></li>',
		);
		return `<div class="dropdown"><button type="button" class="btn btn-sm cc-iconbtn" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="More for ${escapeText(category.name)}"><i class="bi bi-three-dots" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end">${menuEntries.join('')}</ul></div>`;
	}

	function rowHtml(category, parentCategory, siblings, index, branch) {
		const isChild = Boolean(parentCategory);
		const unfolded = filtering() || treeView.unfolded.has(category.id);
		const itemTotal = itemsIn(category);
		const foldButton = category.children.length
			? `<button type="button" class="cc-fold" data-cc-fold-row aria-expanded="${unfolded}" aria-label="${unfolded ? 'Hide' : 'Show'} the subcategories of ${escapeText(category.name)}"><i class="bi bi-chevron-down" aria-hidden="true"></i></button>`
			: '<span class="cc-fold cc-fold-none" aria-hidden="true"></span>';
		const grip = filtering()
			? '<span class="cc-grip cc-grip-off" aria-hidden="true"></span>'
			: '<span class="cc-grip" data-cc-grip title="Drag to move" aria-hidden="true"><i class="bi bi-grip-vertical"></i></span>';
		const marker = isChild
			? '<span class="cc-dot" aria-hidden="true"></span>'
			: `<span class="cc-tile" aria-hidden="true"><i class="bi bi-${category.icon}"></i></span>`;
		const description = category.description
			? `<p class="cc-cat-desc">${escapeText(category.description)}</p>`
			: '<p class="cc-cat-desc cc-cat-desc-blank">No description yet</p>';
		const rowClasses = [
			'cc-row',
			`cc-tone-${toneOf(category)}`,
			isChild ? 'cc-row-child' : '',
			branch ? `cc-row-${branch}` : '',
			treeView.fresh.has(category.id) ? 'is-fresh' : '',
		]
			.filter(Boolean)
			.join(' ');
		const nameCell = `<div class="cc-cat${isChild ? ' cc-cat-child' : ''}">${grip}${isChild ? '' : foldButton}${marker}<div class="cc-cat-text"><button type="button" class="cc-cat-name" data-cc-act="edit">${escapeText(category.name)}</button>${description}<span class="cc-type-inline">${escapeText(category.types.join(', '))}</span></div></div>`;
		return `<tr class="${rowClasses}" data-cc-id="${category.id}"><td>${nameCell}</td><td class="cc-col-type">${typeChipsHtml(category.types)}</td><td class="cc-col-items"><span class="cc-num${itemTotal ? '' : ' cc-num-none'}">${itemTotal}</span></td><td class="cc-col-act">${rowMenuHtml(category, isChild, siblings, index)}</td></tr>`;
	}

	/* Draws the tree. While filtering, every match shows with its
     subcategories out; otherwise only unfolded categories show theirs. */
	function drawTree() {
		const rows = [];
		for (const [index, top] of categoryTree.entries()) {
			const matchingChildren = top.children.filter(
				(child) => !filtering() || matchesTreeFilter(child) || matchesTreeFilter(top),
			);
			if (filtering() && !matchesTreeFilter(top) && !matchingChildren.length) continue;
			const childrenOut = (filtering() || treeView.unfolded.has(top.id)) && matchingChildren.length > 0;
			rows.push(rowHtml(top, null, categoryTree, index, childrenOut ? 'open' : ''));
			if (!childrenOut) continue;
			for (const [slotIndex, child] of matchingChildren.entries()) {
				rows.push(
					rowHtml(
						child,
						top,
						top.children,
						top.children.indexOf(child),
						slotIndex === matchingChildren.length - 1 ? 'last' : '',
					),
				);
			}
		}
		treeUi.body.innerHTML = rows.join('');
		treeView.fresh.clear();

		const shown = rows.length;
		treeUi.body.closest('.cc-scroll').hidden = !shown;
		treeUi.empty.hidden = shown > 0;
		if (!shown) {
			treeUi.empty.innerHTML = window.Basalt.emptyState(
				treeView.search
					? { query: treeView.search, noun: 'categories' }
					: {
							icon: 'tags',
							title: `Nothing is filed as ${escapeText(treeView.type)} yet`,
							text: `Pick another type, or edit a category to use it for ${escapeText(treeView.type)}.`,
						},
			);
		}
		treeUi.status.textContent = filtering()
			? `Showing ${shown} of ${countOf(allCategories().length, 'category', 'categories')}`
			: '';
		treeUi.foldAll.hidden = filtering();
		treeUi.foldAll.textContent = anyUnfolded() ? 'Collapse all' : 'Expand all';
		drawMix();
		drawCounts();
	}

	function wireToolbar() {
		treeUi.search.addEventListener('input', (event) => {
			treeView.search = event.target.value.trim();
			drawTree();
		});
		treeUi.type.addEventListener('change', (event) => {
			treeView.type = event.target.value;
			drawTree();
		});
		treeUi.foldAll.addEventListener('click', () => {
			window.Basalt.slide(treeUi.body.closest('.cc-scroll'), () => {
				treeView.unfolded = anyUnfolded() ? new Set() : new Set(categoryTree.map((top) => top.id));
				drawTree();
			});
		});
		treeUi.mixList.addEventListener('click', (event) => {
			const key = event.target.closest('[data-cc-jump]');
			if (key) jumpToCategory(key.getAttribute('data-cc-jump'));
		});
	}

	/* Clicks inside a row: the fold arrow, or one of the menu actions. */
	const ROW_ACTIONS = {
		edit: (category) => openCategoryDrawer(category),
		'add-sub': (category) => openCategoryDrawer(null, category.id),
		delete: (category) => askToDelete(category),
		up: (category) => nudge(category, -1),
		down: (category) => nudge(category, 1),
	};

	function wireRows() {
		treeUi.body.addEventListener('click', (event) => {
			const row = event.target.closest('[data-cc-id]');
			if (!row) return;
			const id = row.getAttribute('data-cc-id');
			if (event.target.closest('[data-cc-fold-row]')) {
				toggleFold(id);
				return;
			}
			const trigger = event.target.closest('[data-cc-act]');
			if (trigger) ROW_ACTIONS[trigger.getAttribute('data-cc-act')]?.(categoryById(id));
		});
	}

	function toggleFold(id) {
		window.Basalt.slide(treeUi.body.closest('.cc-scroll'), () => {
			if (treeView.unfolded.has(id)) treeView.unfolded.delete(id);
			else treeView.unfolded.add(id);
			drawTree();
		});
		pick(`[data-cc-id="${id}"] [data-cc-fold-row]`, treeUi.body)?.focus({ preventScroll: true });
	}

	function nudge(category, step) {
		const siblings = siblingsOf(category.id);
		const fromIndex = siblings.indexOf(category);
		const toIndex = fromIndex + step;
		if (toIndex < 0 || toIndex >= siblings.length) return;
		siblings.splice(fromIndex, 1);
		siblings.splice(toIndex, 0, category);
		treeView.fresh.add(category.id);
		drawTree();
		const landed =
			toIndex === 0
				? 'to the top'
				: toIndex === siblings.length - 1
					? 'to the bottom'
					: `above ${siblings[toIndex + 1].name}`;
		notify({ tone: 'success', title: `Moved ${category.name}`, text: `It now sits ${landed}.` });
	}

	/* Dragging a row by its grip. It lands above or below the row under
     the pointer, in that row's list. A category with subcategories stays
     at the top level, so it cannot land among subcategories. */
	function canDrop(landingCategory) {
		return Boolean(
			landingCategory &&
			inFlight &&
			landingCategory !== inFlight &&
			!(inFlight.children.length && parentOf(landingCategory.id)),
		);
	}

	function clearDropMarks() {
		for (const row of pickAll('.is-drop-above, .is-drop-below', treeUi.body)) {
			row.classList.remove('is-drop-above', 'is-drop-below');
		}
	}

	function rowUnder(event) {
		return event.target.closest('tr[data-cc-id]');
	}

	function wireDragging() {
		treeUi.body.addEventListener('mousedown', (event) => {
			const grip = event.target.closest('[data-cc-grip]');
			if (grip) grip.closest('tr').draggable = true;
		});
		treeUi.body.addEventListener('dragstart', (event) => {
			const row = rowUnder(event);
			if (!row?.draggable) {
				event.preventDefault();
				return;
			}
			inFlight = categoryById(row.getAttribute('data-cc-id'));
			row.classList.add('is-dragging');
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', inFlight.id);
		});
		treeUi.body.addEventListener('dragend', (event) => {
			const row = rowUnder(event);
			if (row) {
				row.classList.remove('is-dragging');
				row.draggable = false;
			}
			clearDropMarks();
			inFlight = null;
		});
		treeUi.body.addEventListener('dragover', (event) => {
			const row = rowUnder(event);
			if (!row || !inFlight) return;
			const landingCategory = categoryById(row.getAttribute('data-cc-id'));
			clearDropMarks();
			if (!canDrop(landingCategory)) return;
			event.preventDefault();
			const box = row.getBoundingClientRect();
			row.classList.add(event.clientY < box.top + box.height / 2 ? 'is-drop-above' : 'is-drop-below');
		});
		treeUi.body.addEventListener('drop', (event) => {
			const row = rowUnder(event);
			if (!row || !inFlight) return;
			const landingCategory = categoryById(row.getAttribute('data-cc-id'));
			if (!canDrop(landingCategory)) return;
			event.preventDefault();
			landDrop(landingCategory, row.classList.contains('is-drop-below'));
		});
	}

	function landDrop(landingCategory, below) {
		const carried = inFlight;
		const wasChild = Boolean(parentOf(carried.id));
		const oldSiblings = siblingsOf(carried.id);
		oldSiblings.splice(oldSiblings.indexOf(carried), 1);
		const newSiblings = siblingsOf(landingCategory.id);
		newSiblings.splice(newSiblings.indexOf(landingCategory) + (below ? 1 : 0), 0, carried);
		const newParent = parentOf(carried.id);
		/* A subcategory that becomes a category gets a color of its own. */
		if (wasChild && !newParent) carried.tone = spareTone(carried);
		treeView.fresh.add(carried.id);
		inFlight = null;
		drawTree();
		notify({
			tone: 'success',
			title: `Moved ${carried.name}`,
			text: newParent ? `It now sits in ${newParent.name}.` : 'It now sits at the top level.',
		});
	}

	/* The drawer. New and edit share one form; the tile beside its title
     shows the chosen color and icon. */
	function buildPickers() {
		editor.swatches.innerHTML = Array.from({ length: TONE_COUNT }, (_, offset) => {
			const tone = offset + 1;
			return `<label class="cc-swatch cc-tone-${tone}"><input type="radio" name="tone" value="${tone}" aria-label="Color ${tone}"><span class="cc-swatch-dot" aria-hidden="true"></span></label>`;
		}).join('');
		editor.icons.innerHTML = ICON_CHOICES.map(
			(icon) =>
				`<label class="cc-icon"><input type="radio" name="icon" value="${icon}" aria-label="${icon.replace(/-/g, ' ')}"><span class="cc-icon-face" aria-hidden="true"><i class="bi bi-${icon}"></i></span></label>`,
		).join('');
	}

	function chosen(radioName) {
		return pick(`input[name="${radioName}"]:checked`, categoryForm).value;
	}

	function parentChosen() {
		return editor.parent.value ? categoryById(editor.parent.value) : null;
	}

	function syncTile() {
		const under = parentChosen();
		const tone = under ? under.tone : chosen('tone');
		editor.tile.className = `cc-tile cc-tile-lg cc-tone-${tone}`;
		editor.tile.firstElementChild.className = `bi bi-${under ? under.icon : chosen('icon')}`;
		editor.icons.className = `cc-icons cc-tone-${tone}`;
	}

	/* A subcategory wears its category's color, so the swatches only show
     for a top-level category. */
	function syncLook() {
		const under = parentChosen();
		editor.look.hidden = Boolean(under);
		editor.colorHelp.hidden = !under;
		if (under) editor.colorHelp.textContent = `It wears the color and icon of ${under.name}.`;
		syncTile();
	}

	function paintPreview() {
		const typedName = editor.name.value.trim() || 'New category';
		editor.serpUrl.textContent = `fieldline.app › topics › ${editor.slug.value.trim() || 'new-category'}`;
		editor.serpTitle.textContent = editor.seoTitle.value.trim() || `${typedName} | Fieldline`;
		editor.serpDescription.textContent =
			editor.seoDescription.value.trim() ||
			editor.description.value.trim() ||
			`Every Fieldline article filed under ${typedName}.`;
		editor.descriptionCount.textContent = `${editor.description.value.length} / 160`;
	}

	function fillParentChoices(category, parentId) {
		const locked = Boolean(category?.children.length);
		const choices = categoryTree
			.filter((top) => !category || top.id !== category.id)
			.map((top) => `<option value="${top.id}">${escapeText(top.name)}</option>`)
			.join('');
		editor.parent.innerHTML = `<option value="">Top level</option>${choices}`;
		editor.parent.value = parentId ?? '';
		editor.parent.disabled = locked;
		editor.parentHelp.textContent = locked
			? 'It has subcategories of its own, so it stays at the top level.'
			: 'A subcategory shows inside its category on the site.';
		restyleSelect(editor.parent);
	}

	function labelSeoToggle(open) {
		editor.seoToggle.textContent = open ? 'Hide the search fields' : 'Write a different title and description';
	}

	function setSeoOpen(open) {
		editor.seoFields.classList.toggle('show', open);
		editor.seoToggle.classList.toggle('collapsed', !open);
		editor.seoToggle.setAttribute('aria-expanded', String(open));
		labelSeoToggle(open);
	}

	/**
	 * Opens the drawer on a category, or empty for a new one. `parentId`
	 * presets the parent for a new subcategory.
	 */
	function openCategoryDrawer(category, parentId) {
		editing = category;
		categoryForm.classList.remove('was-validated');
		editor.name.classList.remove('is-invalid');
		editor.slug.classList.remove('is-invalid');
		editor.typesError.hidden = true;
		const parentCategory = category ? parentOf(category.id) : parentId ? categoryById(parentId) : null;

		editor.title.textContent = category ? category.name : parentCategory ? 'New subcategory' : 'New category';
		if (category) {
			const nested = category.children.length
				? `, in ${countOf(category.children.length, 'subcategory', 'subcategories')}`
				: '';
			editor.sub.textContent = `${countOf(itemsIn(category), 'item')} filed${nested}.`;
		} else {
			editor.sub.textContent = parentCategory
				? `It goes inside ${parentCategory.name}.`
				: 'It goes at the end of the list. Drag it anywhere after.';
		}
		editor.name.value = category ? category.name : '';
		editor.slug.value = category ? category.slug : '';
		slugTyped = Boolean(category) && category.slug !== toSlug(category.name);
		editor.description.value = category ? category.description : '';
		fillParentChoices(category, parentCategory ? parentCategory.id : '');

		const tone = category && !parentCategory ? category.tone : spareTone();
		pick(`input[name="tone"][value="${tone}"]`, editor.swatches).checked = true;
		pick(
			`input[name="icon"][value="${category && !parentCategory ? category.icon : 'folder'}"]`,
			editor.icons,
		).checked = true;
		syncLook();

		const allowed = category ? category.types : parentCategory ? parentCategory.types.slice() : ['Posts'];
		for (const box of typeTicks) box.checked = allowed.includes(box.value);
		editor.seoTitle.value = category ? category.seoTitle : '';
		editor.seoDescription.value = category ? category.seoDesc : '';
		setSeoOpen(Boolean(category && (category.seoTitle || category.seoDesc)));
		editor.deleteButton.hidden = !category;
		paintPreview();
		offcanvasOf(categoryDrawer).show();
	}

	/* Saving checks the name, the address and the types in that order and
     stops at the first problem. A moved category is pulled out of its
     old list and pushed onto the new one. */
	function saveCategory(event) {
		event.preventDefault();
		const typedName = editor.name.value.trim();
		const typedSlug = editor.slug.value.trim();
		const allowed = typeTicks.filter((box) => box.checked).map((box) => box.value);
		const others = allCategories().filter((category) => category !== editing);
		let firstProblem = null;

		const nameTaken = others.some((category) => category.name.toLowerCase() === typedName.toLowerCase());
		editor.nameError.textContent = typedName
			? `There is already a category called ${typedName}.`
			: 'Give the category a name readers will recognize.';
		const nameBad = !typedName || nameTaken;
		editor.name.classList.toggle('is-invalid', nameBad);
		if (nameBad) firstProblem = editor.name;

		const slugTaken = others.some((category) => category.slug === typedSlug);
		const slugBad = !SLUG_SHAPE.test(typedSlug) || slugTaken;
		editor.slug.classList.toggle('is-invalid', slugBad);
		editor.slugError.textContent = slugTaken
			? 'Another category already uses this address.'
			: 'Use lowercase letters, numbers and dashes.';
		if (slugBad) firstProblem ??= editor.slug;

		editor.typesError.hidden = allowed.length > 0;
		if (!allowed.length) firstProblem ??= typeTicks[0];

		if (firstProblem) {
			firstProblem.focus();
			return;
		}

		const details = {
			name: typedName,
			slug: typedSlug,
			types: allowed,
			tone: Number(chosen('tone')),
			icon: chosen('icon'),
			description: editor.description.value.trim(),
			seoTitle: editor.seoTitle.value.trim(),
			seoDesc: editor.seoDescription.value.trim(),
		};
		const category =
			editing ??
			makeCategory(`c-${Date.now()}`, typedName, details.tone, 0, allowed, details.description, details);
		if (editing) Object.assign(category, details);

		const parentNow = editing ? parentOf(category.id) : null;
		const parentWanted = editor.parent.value ? categoryById(editor.parent.value) : null;
		if (!editing || parentNow !== parentWanted) {
			if (editing) {
				const oldSiblings = siblingsOf(category.id);
				oldSiblings.splice(oldSiblings.indexOf(category), 1);
			}
			(parentWanted ? parentWanted.children : categoryTree).push(category);
			treeView.unfolded.add(parentWanted ? parentWanted.id : category.id);
		}
		treeView.fresh.add(category.id);
		drawTree();
		drawTags();
		offcanvasOf(categoryDrawer).hide();
		notify({
			tone: 'success',
			title: editing ? `Saved ${typedName}` : `Added ${typedName}`,
			text: parentWanted
				? `It sits inside ${parentWanted.name}.`
				: editing
					? 'Readers see the change straight away.'
					: 'It is at the end of the list.',
		});
	}

	function wireEditor() {
		editor.look.addEventListener('change', syncTile);
		editor.parent.addEventListener('change', syncLook);
		editor.seoFields.addEventListener('show.bs.collapse', () => labelSeoToggle(true));
		editor.seoFields.addEventListener('hide.bs.collapse', () => labelSeoToggle(false));
		categoryDrawer.addEventListener('shown.bs.offcanvas', () => {
			if (!editing) editor.name.focus();
		});

		/* The address follows the name until it is typed by hand. */
		editor.name.addEventListener('input', () => {
			if (!slugTyped) editor.slug.value = toSlug(editor.name.value);
			editor.name.classList.remove('is-invalid');
			paintPreview();
		});
		editor.slug.addEventListener('input', () => {
			slugTyped = editor.slug.value.trim() !== '';
			editor.slug.classList.remove('is-invalid');
			paintPreview();
		});
		for (const textbox of [editor.description, editor.seoTitle, editor.seoDescription]) {
			textbox.addEventListener('input', paintPreview);
		}
		for (const box of typeTicks) {
			box.addEventListener('change', () => {
				editor.typesError.hidden = true;
			});
		}
		categoryForm.addEventListener('submit', saveCategory);
		editor.deleteButton.addEventListener('click', () => {
			if (editing) askToDelete(editing);
		});
	}

	/* Deleting. The dialog says where the subcategories and the items go;
     the items need a new home chosen when there are any. */
	function deleteSummary(category) {
		const subcategories = category.children.length;
		const own = category.own;
		if (subcategories && own)
			return `Its ${countOf(subcategories, 'subcategory', 'subcategories')} move up to the top level, and its own ${countOf(own, 'item')} need a new home.`;
		if (subcategories)
			return `Its ${countOf(subcategories, 'subcategory', 'subcategories')} move up to the top level, with everything filed in them.`;
		if (own) return `Its ${countOf(own, 'item')} need a new home. Nothing is taken off the site.`;
		return 'Nothing is filed in it, so nothing else changes.';
	}

	function askToDelete(category) {
		deleting = category;
		deleteUi.title.textContent = `Delete ${category.name}?`;
		deleteUi.sub.textContent = deleteSummary(category);
		deleteUi.body.hidden = !category.own;
		if (category.own) {
			const parentCategory = parentOf(category.id);
			const homes = allCategories().filter((other) => other !== category && !category.children.includes(other));
			deleteUi.destination.innerHTML = homes
				.map(
					(other) =>
						`<option value="${other.id}" data-dot="series-${toneOf(other)}">${escapeText(other.name)}</option>`,
				)
				.join('');
			deleteUi.destination.value = parentCategory ? parentCategory.id : homes[0].id;
			deleteUi.label.textContent = `Move its ${countOf(category.own, 'item')} to`;
			restyleSelect(deleteUi.destination);
		}
		modalOf(deleteDialog).show();
	}

	function deleteCategory(event) {
		event.preventDefault();
		const category = deleting;
		if (!category) return;
		const parentCategory = parentOf(category.id);
		const siblings = siblingsOf(category.id);
		/* Only top-level categories have subcategories, so they take its place. */
		siblings.splice(siblings.indexOf(category), 1, ...category.children);
		for (const child of category.children) {
			child.tone = spareTone(child);
			treeView.fresh.add(child.id);
		}
		let outcome = category.children.length
			? `${countOf(category.children.length, 'subcategory', 'subcategories')} moved to the top level.`
			: 'Nothing else changed.';
		const home = category.own ? categoryById(deleteUi.destination.value) : parentCategory;
		if (category.own) {
			home.own += category.own;
			treeView.fresh.add(home.id);
			outcome = `${countOf(category.own, 'item')} moved to ${home.name}.`;
		}
		for (const tag of tagList) {
			if (tag.cat === category.id) tag.cat = home ? home.id : null;
		}
		deleting = null;
		modalOf(deleteDialog).hide();
		if (editing === category) offcanvasOf(categoryDrawer).hide();
		drawTree();
		drawTags();
		notify({ tone: 'success', title: `Deleted ${category.name}`, text: outcome });
	}

	function wireDeleteDialog() {
		deleteUi.form.addEventListener('submit', deleteCategory);
	}

	/* Importing an outline. Each line is a category; a line starting with
     a dash, an asterisk or an indent goes inside the category above it.
     A name already in the tree is skipped, but new subcategories under
     it still go inside it. */
	function readOutline(text) {
		const known = new Map(allCategories().map((category) => [category.name.toLowerCase(), category]));
		const seen = new Set();
		const rows = [];
		const topRows = new Map();
		const tonesUsed = new Set(categoryTree.map((top) => top.tone));
		let parentRow = null;

		function freshTone() {
			for (let tone = 1; tone <= TONE_COUNT; tone += 1) {
				if (!tonesUsed.has(tone)) {
					tonesUsed.add(tone);
					return tone;
				}
			}
			return (tonesUsed.size % TONE_COUNT) + 1;
		}

		function keep(row, key) {
			if (!row.why) {
				row.tone = row.child ? row.parent.tone : freshTone();
				seen.add(key);
			}
			rows.push(row);
		}

		for (const line of text.split(/\r?\n/)) {
			const name = line
				.replace(/^[\s\-*•]+/, '')
				.trim()
				.slice(0, 40);
			if (!name) continue;
			const key = name.toLowerCase();
			const existing = known.get(key) ?? null;
			const alreadyThere = existing || seen.has(key);

			if (!/^(\s+|[-*•])/.test(line)) {
				const row = {
					name,
					child: false,
					existing,
					made: null,
					tone: existing ? existing.tone : 0,
					why: alreadyThere ? 'already there' : '',
				};
				keep(row, key);
				parentRow = (!existing && seen.has(key) && topRows.get(key)) || row;
				if (!row.why) topRows.set(key, row);
				continue;
			}

			let why = '';
			if (alreadyThere) why = 'already there';
			else if (!parentRow) why = 'needs a category above';
			else if (parentRow.existing && parentOf(parentRow.existing.id)) why = 'one level only';
			keep({ name, child: true, parent: parentRow, tone: parentRow ? parentRow.tone : 0, why }, key);
		}
		return rows;
	}

	function previewOutline() {
		const rows = readOutline(importUi.text.value);
		importUi.error.hidden = true;
		importUi.list.innerHTML = rows
			.map((row) => {
				const classes = `cc-import-item cc-tone-${row.tone}${row.child ? ' cc-import-item-child' : ''}${row.why ? ' cc-import-item-skip' : ''}`;
				const note = row.why ? `<span class="cc-import-note">${row.why}</span>` : '';
				return `<li class="${classes}"><span class="cc-dot" aria-hidden="true"></span><span class="cc-import-name">${escapeText(row.name)}</span>${note}</li>`;
			})
			.join('');

		const newTops = rows.filter((row) => !row.child && !row.why).length;
		const newChildren = rows.filter((row) => row.child && !row.why).length;
		if (!rows.length) importUi.sum.textContent = 'Nothing yet. Type or paste on the left.';
		else if (!newTops && !newChildren) importUi.sum.textContent = 'Everything here is already in the list.';
		else {
			const summaryParts = [
				newTops ? countOf(newTops, 'category', 'categories') : '',
				newChildren ? countOf(newChildren, 'subcategory', 'subcategories') : '',
			].filter(Boolean);
			importUi.sum.textContent = `${summaryParts.join(' and ')} will be added.`;
		}
		return rows;
	}

	function importOutline(event) {
		event.preventDefault();
		const rows = previewOutline().filter((row) => !row.why);
		if (!rows.length) {
			importUi.error.hidden = false;
			importUi.text.focus();
			return;
		}
		for (const row of rows) {
			const category = makeCategory(
				`c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
				row.name,
				row.tone,
				0,
				['Posts'],
				'',
			);
			if (row.child) {
				const parentMade = row.parent.existing ?? row.parent.made;
				category.types = parentMade.types.slice();
				parentMade.children.push(category);
				treeView.unfolded.add(parentMade.id);
			} else {
				categoryTree.push(category);
				row.made = category;
				treeView.unfolded.add(category.id);
			}
			treeView.fresh.add(category.id);
		}
		modalOf(importDialog).hide();
		drawTree();
		notify({
			tone: 'success',
			title: `Imported ${countOf(rows.length, 'category', 'categories')}`,
			text: 'They have no descriptions yet. Open each one to add it.',
		});
	}

	function wireImport() {
		importUi.text.addEventListener('input', previewOutline);
		importUi.sample.addEventListener('click', () => {
			importUi.text.value = SAMPLE_OUTLINE;
			previewOutline();
			importUi.text.focus();
		});
		importDialog.addEventListener('show.bs.modal', () => {
			importUi.text.value = '';
			previewOutline();
		});
		importDialog.addEventListener('shown.bs.modal', () => importUi.text.focus());
		importUi.form.addEventListener('submit', importOutline);
	}

	/* The tag list. Twelve show at first; a search or Show every tag
     shows them all. */
	function visibleTags() {
		const kept = tagList.filter(
			(tag) => !tagView.search || textMatches(`${tag.name.replace(/-/g, ' ')} ${tag.name}`, tagView.search),
		);
		return kept.sort(TAG_ORDERINGS[tagView.order] ?? TAG_ORDERINGS.az);
	}

	/** The tag this one looks like a duplicate of, when that tag still exists. */
	function twinOf(tag) {
		return tag.like && tagList.some((other) => other.name === tag.like) ? tag.like : null;
	}

	function tagByName(name) {
		return tagList.find((tag) => tag.name === name);
	}

	function tagRowHtml(tag) {
		const home = tag.cat ? categoryById(tag.cat) : null;
		const tagPill = `<span class="cc-tag${home ? ` cc-tone-${toneOf(home)}` : ' cc-tag-unused'}"><i class="bi bi-hash" aria-hidden="true"></i>${escapeText(tag.name)}</span>`;
		const twinNote = twinOf(tag) ? `<p class="cc-tag-like">Looks like #${escapeText(tag.like)}</p>` : '';
		const nameCell = `<div class="cc-tag-cell">${tagPill}${twinNote}<span class="cc-type-inline">${home ? escapeText(home.name) : 'Not used yet'}</span></div>`;
		const homeCell = home
			? `<span class="cc-tag-cat cc-tone-${toneOf(home)}"><span class="cc-dot" aria-hidden="true"></span>${escapeText(home.name)}</span>`
			: '<span class="cc-unused">Not used yet</span>';
		const dateCell = tag.last
			? `<span class="cc-date">${shortDate(tag.last)}</span>`
			: '<span class="cc-unused">Never</span>';
		const mergeButton = twinOf(tag)
			? '<button type="button" class="btn btn-sm btn-outline-secondary" data-cc-tag-act="merge">Merge</button>'
			: '';
		const postsLink = tag.posts
			? '<li><a class="dropdown-item" href="blog.html"><i class="bi bi-newspaper" aria-hidden="true"></i>See its posts</a></li>'
			: '';
		const menu = `<div class="dropdown"><button type="button" class="btn btn-sm cc-iconbtn" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="More for ${escapeText(tag.name)}"><i class="bi bi-three-dots" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end"><li><button type="button" class="dropdown-item" data-cc-tag-act="rename"><i class="bi bi-pencil" aria-hidden="true"></i>Rename</button></li><li><button type="button" class="dropdown-item" data-cc-tag-act="merge"><i class="bi bi-intersect" aria-hidden="true"></i>Merge into another tag</button></li>${postsLink}<li><hr class="dropdown-divider"></li><li><button type="button" class="dropdown-item cc-danger-item" data-cc-tag-act="delete"><i class="bi bi-trash3" aria-hidden="true"></i>Delete</button></li></ul></div>`;
		return `<tr class="cc-row" data-cc-tag="${escapeText(tag.name)}"><td>${nameCell}</td><td class="cc-col-cat">${homeCell}</td><td class="cc-col-date">${dateCell}</td><td class="cc-col-items"><span class="cc-num${tag.posts ? '' : ' cc-num-none'}">${tag.posts}</span></td><td class="cc-col-act"><div class="cc-tag-acts">${mergeButton}${menu}</div></td></tr>`;
	}

	function hiddenTagsNote(hiddenTags) {
		const twins = hiddenTags.filter(twinOf).length;
		const idle = hiddenTags.filter((tag) => !tag.posts).length;
		const remarks = [
			twins ? (twins === 1 ? '1 looks like a duplicate' : `${twins} look like duplicates`) : '',
			idle ? (idle === 1 ? '1 is unused' : `${idle} are unused`) : '',
		].filter(Boolean);
		if (!remarks.length) return '.';
		return `. ${remarks.join(' and ').replace(/^./, (first) => first.toUpperCase())}.`;
	}

	function drawTags() {
		const shownTags = visibleTags();
		const limit = tagView.showAll || tagView.search ? shownTags.length : Math.min(TAG_BATCH, shownTags.length);
		tagsUi.body.innerHTML = shownTags.slice(0, limit).map(tagRowHtml).join('');
		tagsUi.body.closest('.cc-scroll').hidden = !shownTags.length;
		tagsUi.empty.hidden = shownTags.length > 0;
		if (!shownTags.length) {
			tagsUi.empty.innerHTML = window.Basalt.emptyState(
				tagView.search
					? { query: tagView.search, noun: 'tags' }
					: { icon: 'hash', title: 'No tags yet', text: 'Tags appear here once a post has one.' },
			);
		}
		const left = shownTags.length - limit;
		tagsUi.more.hidden = left <= 0;
		if (left > 0) tagsUi.moreText.textContent = countOf(left, 'more tag') + hiddenTagsNote(shownTags.slice(limit));
		tagsUi.status.textContent = tagView.search ? `${countOf(shownTags.length, 'tag')} found` : '';
		drawCounts();
	}

	/* Renaming and merging share one dialog. For a merge the closest name
     is suggested: the twin, or the tag sharing the longest start. */
	function sharedStart(left, right) {
		let length = 0;
		while (length < left.length && left[length] === right[length]) length += 1;
		return length;
	}

	function openTagDialog(tag, mode) {
		tagEditing = tag;
		tagMode = mode;
		const merging = mode === 'merge';
		tagDialogUi.title.textContent = `${merging ? 'Merge #' : 'Rename #'}${tag.name}`;
		tagDialogUi.sub.textContent = merging
			? tag.posts
				? `Its ${countOf(tag.posts, 'post')} get the other tag instead, and this one goes.`
				: 'It has no posts, so it simply goes.'
			: tag.posts
				? `All ${countOf(tag.posts, 'post')} with this tag show the new name.`
				: 'No posts use it yet.';
		tagDialogUi.icon.className = `bi ${merging ? 'bi-intersect' : 'bi-hash'}`;
		tagDialogUi.renamePane.hidden = merging;
		tagDialogUi.mergePane.hidden = !merging;
		tagDialogUi.go.textContent = merging ? 'Merge' : 'Rename';
		tagDialogUi.name.value = tag.name;
		tagDialogUi.name.classList.remove('is-invalid');
		if (merging) {
			const others = tagList.filter((other) => other !== tag).sort(TAG_ORDERINGS.az);
			tagDialogUi.into.innerHTML = others
				.map((other) => `<option value="${escapeText(other.name)}">${escapeText(other.name)}</option>`)
				.join('');
			const closest = others
				.slice()
				.sort(
					(left, right) =>
						sharedStart(tag.name, right.name) - sharedStart(tag.name, left.name) ||
						right.posts - left.posts,
				)[0];
			const suggested = twinOf(tag) ?? closest?.name;
			if (suggested) tagDialogUi.into.value = suggested;
			restyleSelect(tagDialogUi.into);
		}
		modalOf(tagDialog).show();
	}

	function renameTag(tag) {
		const typedName = tagDialogUi.name.value.trim().toLowerCase().replace(/\s+/g, '-');
		const alreadyATag = tagList.some((other) => other !== tag && other.name === typedName);
		const bad = !SLUG_SHAPE.test(typedName) || alreadyATag;
		tagDialogUi.nameError.textContent = alreadyATag
			? `There is already a tag called ${typedName}. Merge them instead.`
			: 'Use lowercase letters, numbers and dashes.';
		tagDialogUi.name.classList.toggle('is-invalid', bad);
		if (bad) {
			tagDialogUi.name.focus();
			return;
		}
		const before = tag.name;
		tag.name = typedName;
		modalOf(tagDialog).hide();
		drawTags();
		if (before !== typedName)
			notify({ tone: 'success', title: `Renamed #${before}`, text: `It is now #${typedName}.` });
	}

	function mergeTag(tag) {
		const into = tagByName(tagDialogUi.into.value);
		into.posts += tag.posts;
		if (tag.last && (!into.last || tag.last > into.last)) into.last = tag.last;
		tagList = tagList.filter((other) => other !== tag);
		modalOf(tagDialog).hide();
		drawTags();
		notify({
			tone: 'success',
			title: `Merged #${tag.name} into #${into.name}`,
			text: `#${into.name} is now on ${countOf(into.posts, 'post')}.`,
		});
	}

	function removeTag(tag) {
		const slotIndex = tagList.indexOf(tag);
		tagList = tagList.filter((other) => other !== tag);
		drawTags();
		notify({
			tone: 'success',
			title: `Deleted #${tag.name}`,
			text: tag.posts ? `It is off ${countOf(tag.posts, 'post')}.` : 'No posts used it.',
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						tagList.splice(slotIndex, 0, tag);
						drawTags();
					},
				},
			],
		});
	}

	function wireTags() {
		tagsUi.search.addEventListener('input', (event) => {
			tagView.search = event.target.value.trim();
			drawTags();
		});
		tagsUi.order.addEventListener('change', (event) => {
			tagView.order = event.target.value;
			drawTags();
		});
		tagsUi.showAll.addEventListener('click', () => {
			window.Basalt.slide(tagsUi.body.closest('.cc-scroll'), () => {
				tagView.showAll = true;
				drawTags();
			});
		});
		tagsUi.body.addEventListener('click', (event) => {
			const trigger = event.target.closest('[data-cc-tag-act]');
			if (!trigger) return;
			const tag = tagByName(trigger.closest('[data-cc-tag]').getAttribute('data-cc-tag'));
			const tagAction = trigger.getAttribute('data-cc-tag-act');
			if (tagAction === 'delete') removeTag(tag);
			else openTagDialog(tag, tagAction);
		});

		tagDialog.addEventListener('shown.bs.modal', () => {
			if (tagMode !== 'rename') return;
			tagDialogUi.name.focus();
			tagDialogUi.name.select();
		});
		tagDialogUi.name.addEventListener('input', () => tagDialogUi.name.classList.remove('is-invalid'));
		tagDialogUi.form.addEventListener('submit', (event) => {
			event.preventDefault();
			if (!tagEditing) return;
			if (tagMode === 'rename') renameTag(tagEditing);
			else mergeTag(tagEditing);
		});
	}

	start();
})();
