/**
 * Link menus, the script behind menus.html (it wakes up only when the
 * page carries [data-cmm-root]).
 *
 * Fieldline's public site and its signed-in areas each carry one menu: the
 * header bar, the footer columns, the customer and partner sidebars, the
 * phone tab bar and the help center column. One tab per menu. A tab holds
 * a preview drawn to look like the real place and, under it, the links with
 * a grab handle each. Drag a handle (or press the arrow keys on it) to
 * reorder, drop one link onto another to tuck it into that link's dropdown
 * or column, open any link in the side sheet to change it, and flip the
 * whole menu on or off with its switch. Every change redraws the preview.
 *
 * Wiring it to a backend:
 *   1. PLACEMENTS and DESTINATIONS are the only demo data; every tab count,
 *      preview and row is drawn from them.
 *   2. pushChanges() is the one call that would send the result upstream.
 * The tabs, searchable selects, choice tiles, side sheet, undo toasts and
 * the empty state all come from basalt.js.
 */
(() => {
	'use strict';

	const stage = pick('[data-cmm-root]');
	if (!stage) return;

	/* Demo data. `levels: 2` lets a top-level link carry links of its own (a
     dropdown in the header, a column in the footer); `levels: 1` keeps the
     menu flat. `glyphs` says the place draws an icon beside every link, and
     `limit` caps how many links it has room for. */
	const PLACEMENTS = [
		{
			slug: 'header',
			title: 'Site Header',
			blurb: 'Across the top of every page on fieldline.app',
			style: 'bar',
			area: 'web',
			host: 'fieldline.app',
			live: true,
			levels: 2,
			glyphs: false,
			entries: [
				{
					text: 'Product',
					href: '/features',
					nested: [
						{ text: 'Scheduling & Booking', href: '/features/booking' },
						{ text: 'Estimates & Invoices', href: '/features/invoicing' },
						{ text: 'Fieldline App', href: '/features/mobile' },
						{ text: 'Customer Portal', href: '/features/portal' },
					],
				},
				{
					text: 'Industries',
					href: '/industries',
					nested: [
						{ text: 'Home & Pet Care', href: '/industries/home-pet-care' },
						{ text: 'Photography', href: '/industries/photography' },
						{ text: 'Cleaning & Property Care', href: '/industries/cleaning' },
					],
				},
				{ text: 'Pricing', href: '/pricing' },
				{
					text: 'Resources',
					href: '/resources',
					nested: [
						{ text: 'On-site Team Guides', href: '/guides' },
						{ text: 'Webinars', href: '/webinars' },
						{ text: 'Help Center', href: 'https://help.fieldline.app', separateTab: true },
					],
				},
				{ text: 'Customer Stories', href: '/customers' },
			],
		},
		{
			slug: 'footer',
			title: 'Footer',
			blurb: 'At the foot of every page on fieldline.app, one column per heading',
			style: 'footer',
			area: 'web',
			host: 'fieldline.app',
			live: true,
			levels: 2,
			glyphs: false,
			entries: [
				{
					text: 'Product',
					href: '/features',
					nested: [
						{ text: 'Pricing', href: '/pricing' },
						{ text: 'Integrations', href: '/integrations' },
						{ text: 'System Status', href: 'https://status.fieldline.app', separateTab: true },
					],
				},
				{
					text: 'Company',
					href: '/about',
					nested: [
						{ text: 'Careers', href: '/careers' },
						{ text: 'Contact Sales', href: '/contact' },
						{ text: 'Press and media', href: '/press' },
					],
				},
				{
					text: 'Legal',
					href: '/legal',
					nested: [
						{ text: 'Terms of Service', href: '/terms' },
						{ text: 'Privacy Policy', href: '/privacy' },
					],
				},
			],
		},
		{
			slug: 'portal',
			title: 'Customer Portal',
			blurb: 'The sidebar customers see after they sign in',
			style: 'rail',
			area: 'portal',
			host: 'portal.fieldline.app',
			live: true,
			levels: 1,
			glyphs: true,
			greeting: 'Lumora AI',
			entries: [
				{ text: 'Upcoming Visits', href: '/portal/visits', glyph: 'calendar-event' },
				{ text: 'Service History', href: '/portal/history', glyph: 'clock-history' },
				{ text: 'Your Care Plan', href: '/portal/plan', glyph: 'arrow-repeat' },
				{ text: 'Estimates', href: '/portal/estimates', glyph: 'file-earmark-text' },
				{ text: 'Invoices', href: '/portal/invoices', glyph: 'receipt' },
				{
					text: 'Help & Support',
					href: 'https://help.fieldline.app',
					glyph: 'life-preserver',
					separateTab: true,
				},
			],
		},
		{
			slug: 'partner',
			title: 'Partner Area',
			blurb: 'The sidebar referral partners see in their area',
			style: 'rail',
			area: 'partner',
			host: 'partners.fieldline.app',
			live: true,
			levels: 1,
			glyphs: true,
			greeting: 'Brightway Advisors',
			entries: [
				{ text: 'Deals', href: '/partners/deals', glyph: 'briefcase' },
				{ text: 'Partner Pricing', href: '/partners/pricing', glyph: 'tag' },
				{ text: 'Training Calendar', href: '/partners/training', glyph: 'mortarboard' },
				{ text: 'Commissions', href: '/partners/statements', glyph: 'cash-coin' },
				{ text: 'Marketing Kit', href: 'https://brand.fieldline.app', glyph: 'megaphone', separateTab: true },
			],
		},
		{
			slug: 'mobile',
			title: 'Phone Tab Bar',
			blurb: 'Along the bottom of fieldline.app on phones, five links at most',
			style: 'phone',
			area: 'web',
			host: 'fieldline.app',
			live: false,
			levels: 1,
			glyphs: true,
			limit: 5,
			entries: [
				{ text: 'Home', href: '/', glyph: 'house-door' },
				{ text: 'Product', href: '/features', glyph: 'box' },
				{ text: 'Pricing', href: '/pricing', glyph: 'tag' },
				{ text: 'Sign In', href: '/login', glyph: 'person' },
			],
		},
		{
			slug: 'help',
			title: 'Help Center',
			blurb: 'The left column of help.fieldline.app',
			style: 'rail',
			area: 'help',
			host: 'help.fieldline.app',
			live: false,
			levels: 1,
			glyphs: true,
			greeting: 'Help Center',
			entries: [],
		},
	];

	/* The pages a link may point to, per site, keyed by path. The path is
     also the hint shown beside each name in the page picker. */
	const DESTINATIONS = {
		web: {
			'/': 'Home',
			'/features': 'Product',
			'/features/booking': 'Scheduling & Booking',
			'/features/invoicing': 'Estimates & Invoices',
			'/features/mobile': 'Fieldline App',
			'/features/portal': 'Customer Portal',
			'/integrations': 'Integrations',
			'/industries': 'Industries',
			'/industries/home-pet-care': 'Home & Pet Care',
			'/industries/photography': 'Photography',
			'/industries/cleaning': 'Cleaning & Property Care',
			'/pricing': 'Pricing',
			'/enterprise': 'Enterprise',
			'/resources': 'Resources',
			'/guides': 'On-site Team Guides',
			'/webinars': 'Webinars',
			'/customers': 'Customer Stories',
			'/demo': 'Book a Demo',
			'/about': 'Company',
			'/careers': 'Careers',
			'/contact': 'Contact Sales',
			'/press': 'Press and media',
			'/legal': 'Legal',
			'/terms': 'Terms of Service',
			'/privacy': 'Privacy Policy',
			'/login': 'Sign In',
		},
		portal: {
			'/portal/visits': 'Upcoming Visits',
			'/portal/history': 'Service History',
			'/portal/plan': 'Your Care Plan',
			'/portal/estimates': 'Estimates',
			'/portal/invoices': 'Invoices',
			'/portal/payments': 'Payment Methods',
			'/portal/account': 'Your Details',
		},
		partner: {
			'/partners/deals': 'Deals',
			'/partners/customers': 'Customers',
			'/partners/pricing': 'Partner Pricing',
			'/partners/training': 'Training Calendar',
			'/partners/statements': 'Commissions',
		},
		help: {
			'/help/start': 'Getting Started',
			'/help/scheduling': 'Scheduling Visits',
			'/help/invoicing': 'Invoices & Payments',
			'/help/app': 'Fieldline App',
			'/help/billing': 'Billing & Plans',
			'/help/contact': 'Contact Support',
		},
	};

	/* Icons offered for the menus that draw one; the first is the default. */
	const GLYPHS = [
		'house-door',
		'box',
		'tag',
		'person',
		'calendar-event',
		'clock-history',
		'arrow-repeat',
		'file-earmark-text',
		'receipt',
		'life-preserver',
		'briefcase',
		'mortarboard',
		'cash-coin',
		'megaphone',
		'book',
		'chat-dots',
		'gear',
		'question-circle',
	];

	const LAST_SAVED_NOTE = 'Saved Oct 6 by John Armstrong';
	const HREF_SHAPE = /^(https?:\/\/[^\s/.]+\.[^\s]+|\/[^\s]*)$/;
	const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	const ARROW_DIRECTIONS = { ArrowUp: 'up', ArrowDown: 'down', ArrowRight: 'into', ArrowLeft: 'out' };
	const SIDEBAR_TAGS = { help: 'Help', partner: 'Partners' };
	const HOLDER_HINTS = {
		footer: 'A top-level link is a column heading; links under it fill its column.',
		other: 'Links under another link open from its dropdown.',
	};
	const EXTERNAL_MARK = '<i class="bi bi-box-arrow-up-right" aria-hidden="true"></i>';
	const SIDEBAR_EXTERNAL_MARK = '<i class="bi bi-box-arrow-up-right cmm-rail-ext" aria-hidden="true"></i>';
	const DIVIDER = '<li><hr class="dropdown-divider"></li>';
	const EMPTY_LIST =
		'<div class="basalt-empty cmm-empty"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-signpost-split"></i></span><h3 class="basalt-empty-title">No links in this menu yet</h3><p class="basalt-empty-text">Start with what people look for most, such as Getting Started and Contact Support.</p><button type="button" class="btn btn-primary btn-sm" data-cmm-add><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add the first link</button></div>';

	let uidCounter = 0;
	let pendingEdits = 0;
	let dragging = null;
	let editing = null;
	let labelFollowsPick = false;

	const saveNote = pick('[data-cmm-state]');
	const sheet = pick('#cmm-drawer');
	const linkForm = pick('[data-cmm-form]');
	const inputs = {
		heading: pick('[data-cmm-drawer-title]'),
		subheading: pick('[data-cmm-drawer-sub]'),
		page: pick('[data-cmm-page]'),
		category: pick('[data-cmm-category]'),
		href: pick('[data-cmm-url]'),
		text: pick('[data-cmm-label]'),
		glyphs: pick('[data-cmm-icons]'),
		holder: pick('[data-cmm-parent]'),
		holderHint: pick('[data-cmm-parent-hint]'),
		separateTab: pick('[data-cmm-newtab]'),
		discard: pick('[data-cmm-remove]'),
		confirm: pick('[data-cmm-submit]'),
		categoryTile: pick('[data-cmm-kind-category]'),
	};

	/**
	 * Gives every link an id, opens each preview on its first dropdown,
	 * wires the page and the side sheet, then draws all six tabs.
	 */
	function start() {
		for (const menu of PLACEMENTS) {
			seedIds(menu.entries);
			const firstFolder = menu.entries.find((entry) => entry.nested.length);
			menu.unfolded = firstFolder ? firstFolder.uid : null;
			menu.lit = null;
		}

		pick('[data-cmm-save]').addEventListener('click', submitAll);

		/* One listener per event on the page root; rows come and go too often
       to bind them one by one. */
		const stageEvents = {
			pointerdown: beginDrag,
			pointermove: followDrag,
			pointerup: () => finishDrag(true),
			pointercancel: () => finishDrag(false),
			keydown: nudgeFromKeyboard,
			click: handleClick,
			change: toggleLive,
			mouseover: trackPointer,
			focusin: trackPointer,
			mouseleave: unlightAll,
		};
		for (const [type, handler] of Object.entries(stageEvents)) stage.addEventListener(type, handler);

		inputs.glyphs.innerHTML = GLYPHS.map(glyphTile).join('');
		linkForm.addEventListener('change', followKindChange);
		inputs.text.addEventListener('input', stopFollowingPick);
		inputs.href.addEventListener('input', () => inputs.href.classList.remove('is-invalid'));
		sheet.addEventListener('shown.bs.offcanvas', focusLabelOnOpen);
		inputs.discard.addEventListener('click', discardFromSheet);
		linkForm.addEventListener('submit', saveLink);

		for (const menu of PLACEMENTS) buildPanel(menu);
		paintSaveNote();
	}

	/* Small shared helpers. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return `${value ?? ''}`.replace(/[&<>"']/g, (character) => ENTITIES[character]);
	}

	/** Joins the truthy class names, so a flag may be `condition && 'is-x'`. */
	function classes(...flags) {
		return flags.filter(Boolean).join(' ');
	}

	function say(message) {
		window.Basalt.announce?.(message);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push({ duration: 4000, ...options }) : null;
	}

	function duplicate(entries) {
		return JSON.parse(JSON.stringify(entries));
	}

	/* Reading the menu data. */

	function menuBySlug(slug) {
		return PLACEMENTS.find((menu) => menu.slug === slug);
	}

	function menuOfNode(node) {
		return menuBySlug(node.closest('[data-cmm-pane]').dataset.cmmPane);
	}

	function panelOf(menu) {
		return pick(`[data-cmm-pane="${menu.slug}"]`);
	}

	/** Ids run depth first, parent before its links, so they read in page order. */
	function seedIds(entries) {
		for (const entry of entries) {
			entry.uid = entry.uid || `link-${++uidCounter}`;
			entry.separateTab = Boolean(entry.separateTab);
			entry.nested = entry.nested || [];
			seedIds(entry.nested);
		}
	}

	function tally(entries) {
		let total = 0;
		for (const entry of entries) total += 1 + tally(entry.nested);
		return total;
	}

	/**
	 * Finds a link by id: the array it lives in, its position there, the link
	 * itself and its top-level parent (null when it sits at the top).
	 */
	function findEntry(menu, uid) {
		for (const [position, entry] of menu.entries.entries()) {
			if (entry.uid === uid) return { siblings: menu.entries, position, entry, parent: null };
			const inner = entry.nested.findIndex((child) => child.uid === uid);
			if (inner !== -1)
				return { siblings: entry.nested, position: inner, entry: entry.nested[inner], parent: entry };
		}
		return null;
	}

	function knownPath(area, path) {
		return Object.prototype.hasOwnProperty.call(DESTINATIONS[area], path);
	}

	function isLit(menu, entry) {
		return menu.lit === entry.uid;
	}

	/* The note beside the Save button and saving itself. */

	function paintSaveNote() {
		saveNote.classList.toggle('is-dirty', pendingEdits > 0);
		if (!pendingEdits) {
			saveNote.textContent = LAST_SAVED_NOTE;
			return;
		}
		saveNote.textContent = `${pendingEdits} unsaved ${pendingEdits === 1 ? 'change' : 'changes'}`;
	}

	function markEdited() {
		pendingEdits += 1;
		paintSaveNote();
	}

	/** Where the menus would travel to the server; swap in your own request. */
	function pushChanges() {
		return Promise.resolve();
	}

	function submitAll() {
		if (!pendingEdits) {
			notify({ tone: 'info', title: 'Nothing new to save', text: 'Every menu matches what visitors see.' });
			return;
		}
		pushChanges().then(() => {
			pendingEdits = 0;
			paintSaveNote();
			saveNote.textContent = 'Saved just now by John Armstrong';
			notify({
				tone: 'success',
				title: 'Menus saved',
				text: 'Visitors see the new links on their next page load.',
			});
		});
	}

	/* Previews. Each style draws the menu the way its place on the site
     shows it, inside a small browser or phone frame. */

	const PREVIEW_RENDERERS = { bar: headerPreview, footer: footerPreview, rail: sidebarPreview, phone: tabBarPreview };

	function paintPreview(menu) {
		pick('[data-cmm-site]', panelOf(menu)).innerHTML = PREVIEW_RENDERERS[menu.style](menu);
	}

	function logo(suffix) {
		const tail = suffix ? `<span class="cmm-brand-sub">${htmlSafe(suffix)}</span>` : '';
		return `<span class="cmm-brand"><span class="cmm-brand-mark" aria-hidden="true"><i class="bi bi-geo-alt-fill"></i></span>Fieldline${tail}</span>`;
	}

	function browserBar(host) {
		return `<div class="cmm-site-chrome" aria-hidden="true"><span class="cmm-site-dots"><i></i><i></i><i></i></span><span class="cmm-site-address">${htmlSafe(host)}</span></div>`;
	}

	function placeholderText(rows) {
		return `<div class="cmm-skel" aria-hidden="true">${'<i></i>'.repeat(rows)}</div>`;
	}

	/** The header bar. Only a dropdown that has just opened fades in. */
	function headerPreview(menu) {
		const unfolded = menu.entries.find((entry) => entry.uid === menu.unfolded && entry.nested.length) || null;
		const justOpened = Boolean(unfolded) && menu.lastUnfolded !== unfolded.uid;
		menu.lastUnfolded = unfolded ? unfolded.uid : null;

		const items = menu.entries.map((entry) => {
			const lit = isLit(menu, entry) && 'is-hot';
			if (!entry.nested.length) {
				return `<li class="${classes('cmm-bar-item', lit)}"><span class="cmm-bar-link">${htmlSafe(entry.text)}</span></li>`;
			}
			const isUnfolded = entry === unfolded;
			let dropdown = '';
			if (isUnfolded) {
				const rows = entry.nested.map(
					(child) =>
						`<li class="${classes('cmm-bar-droplink', isLit(menu, child) && 'is-hot')}">${htmlSafe(child.text)}${child.separateTab ? EXTERNAL_MARK : ''}</li>`,
				);
				dropdown = `<ul class="${classes('cmm-bar-drop', justOpened && 'is-entering')}">${rows.join('')}</ul>`;
			}
			return `<li class="${classes('cmm-bar-item', isUnfolded && 'is-open', lit)}"><button type="button" class="cmm-bar-link" data-cmm-pv="${entry.uid}" aria-expanded="${isUnfolded}">${htmlSafe(entry.text)}<i class="bi bi-chevron-down" aria-hidden="true"></i></button>${dropdown}</li>`;
		});

		return `${browserBar(menu.host)}<div class="cmm-bar">${logo()}<ul class="cmm-bar-nav">${items.join('')}</ul><span class="cmm-bar-cta" aria-hidden="true">Get a demo</span><span class="cmm-bar-burger" aria-hidden="true"><i class="bi bi-list"></i></span></div><div class="cmm-site-page" aria-hidden="true">${placeholderText(3)}</div>`;
	}

	function footerPreview(menu) {
		const columns = menu.entries.map((entry) => {
			const rows = entry.nested.map(
				(child) => `<li class="${classes(isLit(menu, child) && 'is-hot')}">${htmlSafe(child.text)}</li>`,
			);
			const list = rows.length ? `<ul>${rows.join('')}</ul>` : '';
			return `<div class="cmm-footer-col"><p class="${classes('cmm-footer-head', isLit(menu, entry) && 'is-hot')}">${htmlSafe(entry.text)}</p>${list}</div>`;
		});
		return `${browserBar(menu.host)}<div class="cmm-site-page cmm-site-page-short" aria-hidden="true">${placeholderText(2)}</div><div class="cmm-footer"><div class="cmm-footer-cols"><div class="cmm-footer-col">${logo()}<p class="cmm-footer-tag">Scheduling for teams that work on site.</p></div>${columns.join('')}</div><p class="cmm-footer-base">© 2026 Fieldline Software Inc.</p></div>`;
	}

	function sidebarPreview(menu) {
		const rows = menu.entries.map(
			(entry, position) =>
				`<li class="${classes('cmm-rail-link', position === 0 && 'is-current', isLit(menu, entry) && 'is-hot')}"><i class="bi bi-${htmlSafe(entry.glyph)}" aria-hidden="true"></i><span>${htmlSafe(entry.text)}</span>${entry.separateTab ? SIDEBAR_EXTERNAL_MARK : ''}</li>`,
		);
		const list = rows.length
			? `<ul class="cmm-rail-list">${rows.join('')}</ul>`
			: '<p class="cmm-rail-empty">Links you add show here</p>';
		return `${browserBar(menu.host)}<div class="cmm-app"><div class="cmm-rail">${logo(SIDEBAR_TAGS[menu.slug] || 'Portal')}${list}</div><div class="cmm-app-main" aria-hidden="true"><p class="cmm-app-hello">${htmlSafe(menu.greeting)}</p>${placeholderText(2)}<div class="cmm-app-cards"><i></i><i></i></div></div></div>`;
	}

	function tabBarPreview(menu) {
		const room = menu.limit || 5;
		const slots = Math.min(Math.max(menu.entries.length, 1), room);
		const tabs = menu.entries
			.slice(0, room)
			.map(
				(entry, position) =>
					`<li class="${classes(position === 0 && 'is-current', isLit(menu, entry) && 'is-hot')}"><i class="bi bi-${htmlSafe(entry.glyph)}" aria-hidden="true"></i><span>${htmlSafe(entry.text)}</span></li>`,
			);
		return `<div class="cmm-phone"><div class="cmm-phone-screen"><div class="cmm-phone-top" aria-hidden="true">${logo()}</div><div class="cmm-phone-page" aria-hidden="true">${placeholderText(3)}<div class="cmm-app-cards"><i></i></div></div><ul class="cmm-phone-bar" style="--cmm-tabs:${slots}">${tabs.join('')}</ul></div></div>`;
	}

	/* The list of links under the preview. */

	/** Which moves a link may make from where it sits. */
	function reach(menu, uid) {
		const spot = findEntry(menu, uid);
		const above = spot.siblings[spot.position - 1];
		const topLevel = !spot.parent;
		return {
			up: spot.position > 0,
			down: spot.position < spot.siblings.length - 1,
			into: menu.levels > 1 && topLevel && !spot.entry.nested.length && above ? above : null,
			out: !topLevel,
			child: menu.levels > 1 && topLevel,
		};
	}

	/** For menus without icons of their own, an icon for what the link opens. */
	function targetGlyph(menu, entry) {
		if (entry.nested.length) return menu.style === 'footer' ? 'layout-three-columns' : 'menu-button-wide';
		if (/^https?:/.test(entry.href)) return 'box-arrow-up-right';
		return /^\/blog\//.test(entry.href) ? 'tags' : 'file-earmark-text';
	}

	function menuAction(action, glyph, caption, allowed) {
		return `<li><button type="button" class="dropdown-item" data-cmm-act="${action}"${allowed ? '' : ' disabled'}><i class="bi bi-${glyph}" aria-hidden="true"></i>${htmlSafe(caption)}</button></li>`;
	}

	function rowActions(menu, entry, parent, can) {
		const actions = [
			menuAction('edit', 'pencil', 'Edit link', true),
			DIVIDER,
			menuAction('up', 'arrow-up', 'Move up', can.up),
			menuAction('down', 'arrow-down', 'Move down', can.down),
		];
		if (menu.levels > 1) {
			actions.push(
				parent
					? menuAction('out', 'arrow-bar-left', 'Move to the top level', true)
					: menuAction(
							'into',
							'arrow-return-right',
							can.into ? `Move under ${can.into.text}` : 'Move under the link above',
							Boolean(can.into),
						),
			);
		}
		if (can.child) actions.push(menuAction('child', 'plus-lg', 'Add a link under this', true));
		actions.push(DIVIDER, menuAction('remove', 'trash3', 'Remove', true));
		return actions.join('');
	}

	function entryRow(menu, entry, parent) {
		const name = htmlSafe(entry.text);
		const can = reach(menu, entry.uid);
		const glyph = htmlSafe(menu.glyphs ? entry.glyph : targetGlyph(menu, entry));

		const handle = `<button type="button" class="cmm-grip" data-cmm-grip aria-label="Move ${name}" aria-describedby="cmm-keys-${menu.slug}"><i class="bi bi-grip-vertical" aria-hidden="true"></i></button>`;
		const holdsNote = entry.nested.length
			? `<span>${entry.nested.length}${menu.style === 'footer' ? ' in its column' : ' in its dropdown'}</span>`
			: '';
		const tabNote = entry.separateTab ? `<span class="cmm-row-newtab">${EXTERNAL_MARK}New tab</span>` : '';
		const words = `<div class="cmm-row-text"><button type="button" class="cmm-row-label" data-cmm-act="edit" aria-label="Edit ${name}">${name}</button><span class="cmm-row-meta"><span class="cmm-row-url">${htmlSafe(entry.href)}</span>${holdsNote}${tabNote}</span></div>`;
		const more = `<div class="cmm-row-actions"><div class="dropdown"><button type="button" class="btn btn-outline-secondary btn-sm btn-square" data-bs-toggle="dropdown" aria-expanded="false" aria-label="More for ${name}"><i class="bi bi-three-dots" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end">${rowActions(menu, entry, parent, can)}</ul></div></div>`;
		const inner = entry.nested.length
			? `<ul class="cmm-tree cmm-tree-sub">${entry.nested.map((child) => entryRow(menu, child, entry)).join('')}</ul>`
			: '';

		return `<li class="${classes('cmm-item', parent && 'cmm-item-sub')}" data-cmm-id="${entry.uid}"><div class="cmm-row">${handle}<span class="cmm-row-icon" aria-hidden="true"><i class="bi bi-${glyph}"></i></span>${words}${more}</div>${inner}</li>`;
	}

	function paintList(menu) {
		const panel = panelOf(menu);
		const hasEntries = menu.entries.length > 0;
		pick('[data-cmm-list]', panel).innerHTML = hasEntries
			? `<ul class="cmm-tree" aria-label="Links in the ${htmlSafe(menu.title)}">${menu.entries.map((entry) => entryRow(menu, entry, null)).join('')}</ul>`
			: EMPTY_LIST;
		pick('[data-cmm-tip]', panel).hidden = !hasEntries;
		pick(`[data-cmm-count="${menu.slug}"]`).textContent = tally(menu.entries);
	}

	function paintMenu(menu) {
		paintList(menu);
		paintPreview(menu);
	}

	/** A menu switched off gets a crossed eye in its tab and a notice above the preview. */
	function paintLiveState(menu) {
		const tab = pick(`#cmm-tab-${menu.slug}`);
		const badge = pick('.cmm-tabs-off', tab) || addOffBadge(tab);
		badge.hidden = menu.live;
		const panel = panelOf(menu);
		pick('[data-cmm-notice]', panel).hidden = menu.live;
		pick('[data-cmm-site]', panel).classList.toggle('is-off', !menu.live);
	}

	function addOffBadge(tab) {
		const badge = document.createElement('span');
		badge.className = 'cmm-tabs-off';
		badge.innerHTML =
			'<i class="bi bi-eye-slash" aria-hidden="true"></i><span class="visually-hidden">, hidden</span>';
		tab.insertBefore(badge, pick('.basalt-tabs-count', tab));
		return badge;
	}

	function buildPanel(menu) {
		const nests = menu.levels > 1;
		const dragTip = nests
			? `Drag a handle to reorder. Drop a link onto another to put it ${menu.style === 'footer' ? 'in that column.' : 'in its dropdown.'}`
			: 'Drag a handle to put the links in the order visitors see them.';
		const keyTip = nests
			? 'On a handle, the up and down arrows move the link, and right and left move it in and out of the link above.'
			: 'On a handle, the up and down arrows move the link.';

		const head = `<div class="cmm-head"><div class="cmm-head-text"><h2 class="cmm-head-title">${htmlSafe(menu.title)}</h2><p class="cmm-head-sub">${htmlSafe(menu.blurb)}</p></div><div class="cmm-head-actions"><div class="form-check form-switch cmm-shown"><input class="form-check-input" type="checkbox" role="switch" id="cmm-shown-${menu.slug}" data-cmm-shown${menu.live ? ' checked' : ''}><label class="form-check-label" for="cmm-shown-${menu.slug}">Shown on site</label></div><button type="button" class="btn btn-outline-secondary btn-sm" data-cmm-add><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add link</button></div></div>`;
		const notice =
			'<p class="cmm-notice" data-cmm-notice><i class="bi bi-eye-slash" aria-hidden="true"></i><span>Hidden. Visitors won’t see this menu until you switch it on and save.</span></p>';
		const preview = `<div class="cmm-preview"><p class="cmm-preview-label" id="cmm-preview-${menu.slug}">Preview</p><div class="cmm-site cmm-site-${menu.style}" role="group" aria-labelledby="cmm-preview-${menu.slug}" data-cmm-site></div></div>`;
		const tip = `<p class="cmm-tip" data-cmm-tip><i class="bi bi-arrows-move" aria-hidden="true"></i><span>${dragTip}</span><span class="visually-hidden" id="cmm-keys-${menu.slug}">${keyTip}</span></p>`;

		panelOf(menu).innerHTML =
			`<div class="card basalt-box">${head}${notice}${preview}<div class="cmm-list" data-cmm-list></div>${tip}</div>`;
		paintMenu(menu);
		paintLiveState(menu);
	}

	/* Moving links around. */

	/** Lifts one link out and sets it down above, below or inside another. */
	function relocate(menu, uid, targetUid, placement) {
		const source = findEntry(menu, uid);
		const [entry] = source.siblings.splice(source.position, 1);
		const target = findEntry(menu, targetUid);
		if (placement === 'into') {
			target.entry.nested.push(entry);
			return;
		}
		target.siblings.splice(target.position + (placement === 'below' ? 1 : 0), 0, entry);
	}

	function shiftBy(spot, offset) {
		const [entry] = spot.siblings.splice(spot.position, 1);
		spot.siblings.splice(spot.position + offset, 0, entry);
	}

	/* Each one-step move, with the words read out once it is done. */
	const NUDGES = {
		up(menu, spot) {
			shiftBy(spot, -1);
			return 'moved up';
		},
		down(menu, spot) {
			shiftBy(spot, 1);
			return 'moved down';
		},
		into(menu, spot, can) {
			relocate(menu, spot.entry.uid, can.into.uid, 'into');
			menu.unfolded = can.into.uid;
			return `moved under ${can.into.text}`;
		},
		out(menu, spot) {
			spot.siblings.splice(spot.position, 1);
			menu.entries.splice(menu.entries.indexOf(spot.parent) + 1, 0, spot.entry);
			return 'moved to the top level';
		},
	};

	/** Moves a link one step if it can; returns the announcement, or '' when it cannot. */
	function nudge(menu, uid, direction) {
		const can = reach(menu, uid);
		if (!can[direction]) return '';
		const spot = findEntry(menu, uid);
		return `${spot.entry.text} ${NUDGES[direction](menu, spot, can)}`;
	}

	function afterReorder(menu, uid, announcement) {
		markEdited();
		paintMenu(menu);
		highlight(menu, uid);
		say(announcement);
	}

	function highlight(menu, uid) {
		const item = pick(`[data-cmm-id="${uid}"]`, panelOf(menu));
		if (!item) return;
		const row = pick(':scope > .cmm-row', item);
		row.classList.remove('is-moved');
		void row.offsetWidth;
		row.classList.add('is-moved');
	}

	function focusHandle(menu, uid) {
		pick(`[data-cmm-id="${uid}"] > .cmm-row [data-cmm-grip]`, panelOf(menu))?.focus();
	}

	function discard(menu, uid) {
		const spot = findEntry(menu, uid);
		const snapshot = duplicate(menu.entries);
		const innerCount = spot.entry.nested.length;
		spot.siblings.splice(spot.position, 1);
		markEdited();
		paintMenu(menu);

		const shown = notify({
			tone: 'primary',
			icon: 'bi-trash3',
			title: `${spot.entry.text} removed`,
			text: innerCount
				? `The ${innerCount}${innerCount === 1 ? ' link' : ' links'} under it went too.`
				: `It is no longer in the ${menu.title}.`,
			duration: 6000,
			actions: [
				{
					label: 'Undo',
					onClick() {
						menu.entries = snapshot;
						pendingEdits = Math.max(0, pendingEdits - 1);
						paintSaveNote();
						paintMenu(menu);
						say(`${spot.entry.text} is back`);
					},
				},
			],
		});
		if (!shown) say(`${spot.entry.text} removed`);

		const panel = panelOf(menu);
		(pick('[data-cmm-grip]', panel) || pick('[data-cmm-add]', panel))?.focus();
	}

	/* Dragging by the handle, with mouse, pen or finger. */

	function beginDrag(event) {
		const handle = event.target.closest('[data-cmm-grip]');
		if (!handle || event.button !== 0) return;
		const menu = menuOfNode(handle);
		const row = handle.closest('[data-cmm-id]');
		event.preventDefault();
		handle.setPointerCapture(event.pointerId);
		dragging = {
			menu,
			row,
			uid: row.dataset.cmmId,
			entry: findEntry(menu, row.dataset.cmmId).entry,
			startY: event.clientY,
			startScroll: window.scrollY,
			lifted: false,
			landing: null,
		};
	}

	function followDrag(event) {
		if (!dragging) return;
		const offset = event.clientY - dragging.startY + (window.scrollY - dragging.startScroll);
		if (!dragging.lifted) {
			if (Math.abs(offset) < 4) return;
			dragging.lifted = true;
			dragging.row.classList.add('is-dragging');
			stage.classList.add('is-sorting');
		}
		dragging.row.style.transform = `translateY(${offset}px)`;
		if (event.clientY < 70) window.scrollBy(0, -14);
		else if (event.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
		clearLandingMarks();
		dragging.landing = landingFor(event);
		if (dragging.landing)
			pick(':scope > .cmm-row', dragging.landing.row).classList.add(`is-drop-${dragging.landing.placement}`);
	}

	/**
	 * Where the dragged link would land under the pointer: above or below the
	 * row there, or inside it when the pointer rests on its middle band. A
	 * link that holds others never goes inside another, so over a nested row
	 * it aims at that row's parent instead.
	 */
	function landingFor(event) {
		const under = document.elementFromPoint(event.clientX, event.clientY);
		const rowBox = under?.closest('.cmm-row');
		if (!rowBox || !panelOf(dragging.menu).contains(rowBox)) return null;
		let row = rowBox.closest('[data-cmm-id]');
		if (row === dragging.row || dragging.row.contains(row)) return null;

		const bounds = rowBox.getBoundingClientRect();
		const ratio = (event.clientY - bounds.top) / bounds.height;
		const side = ratio < 0.5 ? 'above' : 'below';
		const isNested = row.classList.contains('cmm-item-sub');

		if (isNested && dragging.entry.nested.length) {
			row = row.parentElement.closest('[data-cmm-id]');
			return row === dragging.row ? null : { row, placement: side };
		}
		const mayNest = dragging.menu.levels > 1 && !isNested && !dragging.entry.nested.length;
		if (mayNest && ratio > 0.28 && ratio < 0.72) return { row, placement: 'into' };
		return { row, placement: side };
	}

	function clearLandingMarks() {
		for (const marked of pickAll('.is-drop-above, .is-drop-below, .is-drop-into', stage)) {
			marked.classList.remove('is-drop-above', 'is-drop-below', 'is-drop-into');
		}
	}

	function finishDrag(apply) {
		if (!dragging) return;
		const done = dragging;
		dragging = null;
		clearLandingMarks();
		done.row.classList.remove('is-dragging');
		done.row.style.transform = '';
		stage.classList.remove('is-sorting');
		if (!apply || !done.lifted || !done.landing) return;

		const target = findEntry(done.menu, done.landing.row.dataset.cmmId).entry;
		relocate(done.menu, done.uid, target.uid, done.landing.placement);
		if (done.landing.placement === 'into') done.menu.unfolded = target.uid;
		const verb = done.landing.placement === 'into' ? 'moved under' : `moved ${done.landing.placement}`;
		afterReorder(done.menu, done.uid, `${done.entry.text} ${verb} ${target.text}`);
	}

	function nudgeFromKeyboard(event) {
		const handle = event.target.closest('[data-cmm-grip]');
		const direction = ARROW_DIRECTIONS[event.key];
		if (!handle || !direction) return;
		event.preventDefault();
		const menu = menuOfNode(handle);
		const uid = handle.closest('[data-cmm-id]').dataset.cmmId;
		const outcome = nudge(menu, uid, direction);
		if (!outcome) return;
		afterReorder(menu, uid, outcome);
		focusHandle(menu, uid);
	}

	/* Clicks, switches and pointing inside a tab. */

	function handleClick(event) {
		const panel = event.target.closest('[data-cmm-pane]');
		if (!panel) return;
		const menu = menuBySlug(panel.dataset.cmmPane);

		const previewToggle = event.target.closest('[data-cmm-pv]');
		if (previewToggle) {
			toggleDropdownPreview(menu, panel, previewToggle.dataset.cmmPv);
			return;
		}
		if (event.target.closest('[data-cmm-add]')) {
			startNewLink(menu);
			return;
		}
		const actionButton = event.target.closest('[data-cmm-act]');
		if (!actionButton) return;
		runRowAction(menu, actionButton.closest('[data-cmm-id]').dataset.cmmId, actionButton.dataset.cmmAct);
	}

	function toggleDropdownPreview(menu, panel, uid) {
		menu.unfolded = menu.unfolded === uid ? null : uid;
		paintPreview(menu);
		pick(`[data-cmm-pv="${uid}"]`, panel)?.focus({ preventScroll: true });
	}

	function startNewLink(menu) {
		if (menu.limit && tally(menu.entries) >= menu.limit) {
			notify({
				tone: 'warning',
				title: 'The tab bar is full',
				text: 'Phones show five links at most. Remove one to add another.',
			});
			return;
		}
		openSheet(menu, null, null);
	}

	const ROW_ACTIONS = {
		edit(menu, uid) {
			openSheet(menu, uid, null);
		},
		child(menu, uid) {
			openSheet(menu, null, uid);
		},
		remove: discard,
	};

	function runRowAction(menu, uid, action) {
		if (ROW_ACTIONS[action]) {
			ROW_ACTIONS[action](menu, uid);
			return;
		}
		const outcome = nudge(menu, uid, action);
		if (!outcome) return;
		afterReorder(menu, uid, outcome);
		focusHandle(menu, uid);
	}

	function toggleLive(event) {
		const toggle = event.target.closest('[data-cmm-shown]');
		if (!toggle) return;
		const menu = menuOfNode(toggle);
		menu.live = toggle.checked;
		markEdited();
		paintLiveState(menu);
		say(`${menu.title} will be ${menu.live ? 'shown' : 'hidden'} once you save`);
	}

	/** Resting on a row lights that link in the preview and unfolds its dropdown. */
	function trackPointer(event) {
		const panel = event.target.closest('[data-cmm-pane]');
		if (!panel || dragging) return;
		const menu = menuBySlug(panel.dataset.cmmPane);
		const row = event.target.closest('.cmm-list [data-cmm-id]');
		const uid = row ? row.dataset.cmmId : null;
		if (uid === menu.lit) return;
		menu.lit = uid;
		if (uid) {
			const spot = findEntry(menu, uid);
			const head = spot.parent || spot.entry;
			if (head.nested.length) menu.unfolded = head.uid;
		}
		paintPreview(menu);
	}

	function unlightAll() {
		for (const menu of PLACEMENTS) {
			if (!menu.lit) continue;
			menu.lit = null;
			paintPreview(menu);
		}
	}

	/* The side sheet that adds or edits one link. */

	function glyphTile(glyph) {
		return `<label class="basalt-choice"><input type="radio" name="icon" value="${glyph}"><i class="bi bi-${glyph}" aria-hidden="true"></i><span class="visually-hidden">${glyph.split('-').join(' ')}</span></label>`;
	}

	function section(name) {
		return pick(`[data-cmm-field="${name}"]`, linkForm);
	}

	function chosenKind() {
		return linkForm.elements.kind.value;
	}

	function revealKindSection() {
		for (const name of ['page', 'category', 'url']) section(name).hidden = chosenKind() !== name;
	}

	function kindOfHref(menu, href) {
		if (knownPath(menu.area, href)) return 'page';
		if (menu.area === 'web' && /^\/blog\//.test(href)) return 'category';
		return 'url';
	}

	/** While adding, the label follows whatever page or category is picked. */
	function fillLabelFromPick() {
		if (!labelFollowsPick) return;
		const linkKind = chosenKind();
		if (linkKind === 'page') inputs.text.value = DESTINATIONS[editing.menu.area][inputs.page.value] || '';
		else if (linkKind === 'category') inputs.text.value = inputs.category.selectedOptions[0].text;
	}

	function followKindChange(event) {
		const changedKind = event.target.name === 'kind';
		if (changedKind) revealKindSection();
		if (changedKind || event.target === inputs.page || event.target === inputs.category) fillLabelFromPick();
	}

	function stopFollowingPick() {
		labelFollowsPick = false;
		inputs.text.classList.remove('is-invalid');
	}

	function focusLabelOnOpen() {
		if (window.matchMedia('(pointer: fine)').matches) inputs.text.focus({ preventScroll: true });
	}

	function discardFromSheet() {
		const { menu, uid } = editing;
		bootstrap.Offcanvas.getInstance(sheet).hide();
		discard(menu, uid);
	}

	function openSheet(menu, uid, holderUid) {
		const spot = uid ? findEntry(menu, uid) : null;
		const entry = spot ? spot.entry : null;
		editing = { menu, uid };
		labelFollowsPick = !entry;
		linkForm.classList.remove('was-validated');
		inputs.text.classList.remove('is-invalid');
		inputs.href.classList.remove('is-invalid');

		inputs.heading.textContent = entry ? 'Edit link' : 'Add a link';
		inputs.subheading.textContent = `In the ${menu.title}`;
		inputs.discard.hidden = !entry;
		inputs.confirm.textContent = entry ? 'Save link' : 'Add link';

		inputs.page.innerHTML = Object.entries(DESTINATIONS[menu.area])
			.map(
				([path, title]) =>
					`<option value="${htmlSafe(path)}" data-hint="${htmlSafe(path)}">${htmlSafe(title)}</option>`,
			)
			.join('');
		window.Basalt.select?.refresh?.(inputs.page);
		inputs.categoryTile.hidden = menu.area !== 'web';

		const href = entry ? entry.href : '';
		const linkKind = entry ? kindOfHref(menu, href) : 'page';
		linkForm.elements.kind.value = linkKind;
		if (linkKind === 'page' && entry) inputs.page.value = href;
		if (linkKind === 'category') inputs.category.value = href;
		inputs.href.value = linkKind === 'url' ? href : '';
		revealKindSection();

		inputs.text.value = entry ? entry.text : '';
		fillLabelFromPick();

		section('icon').hidden = !menu.glyphs;
		if (menu.glyphs) linkForm.elements.icon.value = entry ? entry.glyph : GLYPHS[0];

		section('parent').hidden = menu.levels < 2;
		if (menu.levels > 1) fillHolderChoices(menu, spot, holderUid);
		inputs.separateTab.checked = entry ? entry.separateTab : false;

		bootstrap.Offcanvas.getOrCreateInstance(sheet).show();
	}

	/** The "Sits in" picker: top level or any other top-level link. */
	function fillHolderChoices(menu, spot, holderUid) {
		const entry = spot ? spot.entry : null;
		const noun = menu.style === 'footer' ? 'column' : 'dropdown';
		const options = menu.entries
			.filter((candidate) => candidate !== entry)
			.map((candidate) => `<option value="${candidate.uid}">${htmlSafe(candidate.text)} ${noun}</option>`);
		inputs.holder.innerHTML = `<option value="">Top level</option>${options.join('')}`;
		inputs.holder.value = holderUid || (spot?.parent ? spot.parent.uid : '');

		const holdsOthers = Boolean(entry?.nested.length);
		inputs.holder.disabled = holdsOthers;
		inputs.holderHint.textContent = holdsOthers
			? `It holds ${entry.nested.length} links of its own, so it stays at the top level.`
			: HOLDER_HINTS[menu.style === 'footer' ? 'footer' : 'other'];
		window.Basalt.select?.refresh?.(inputs.holder);
	}

	function hrefFromSheet(linkKind) {
		if (linkKind === 'page') return inputs.page.value;
		if (linkKind === 'category') return inputs.category.value;
		return inputs.href.value.trim();
	}

	function attach(menu, holderUid, entry) {
		if (holderUid) findEntry(menu, holderUid).entry.nested.push(entry);
		else menu.entries.push(entry);
	}

	function saveLink(event) {
		event.preventDefault();
		const { menu, uid } = editing;
		const linkKind = chosenKind();
		const text = inputs.text.value.trim();
		const href = hrefFromSheet(linkKind);

		const faulty = [];
		if (linkKind === 'url' && !HREF_SHAPE.test(href)) faulty.push(inputs.href);
		if (!text) faulty.push(inputs.text);
		inputs.text.classList.toggle('is-invalid', faulty.includes(inputs.text));
		inputs.href.classList.toggle('is-invalid', faulty.includes(inputs.href));
		if (faulty.length) {
			faulty[0].focus();
			return;
		}

		const holderUid = menu.levels > 1 && !inputs.holder.disabled ? inputs.holder.value : '';
		const fields = { text, href, separateTab: inputs.separateTab.checked };
		if (menu.glyphs) fields.glyph = linkForm.elements.icon.value;

		let entry;
		if (uid) {
			const spot = findEntry(menu, uid);
			entry = Object.assign(spot.entry, fields);
			const previousHolder = spot.parent ? spot.parent.uid : '';
			if (holderUid !== previousHolder) {
				spot.siblings.splice(spot.position, 1);
				attach(menu, holderUid, entry);
			}
		} else {
			entry = { uid: `link-${++uidCounter}`, nested: [], ...fields };
			attach(menu, holderUid, entry);
		}
		if (holderUid) menu.unfolded = holderUid;

		markEdited();
		paintMenu(menu);
		bootstrap.Offcanvas.getInstance(sheet).hide();
		highlight(menu, entry.uid);
		notify({
			tone: 'success',
			title: uid ? 'Link updated' : 'Link added',
			text: `${text} is ${uid ? 'changed' : 'now'} in the ${menu.title}.`,
		});
	}

	start();
})();
