/**
 * Main menu behavior for every page that carries the Basalt sidebar.
 * On phones the menu is a drawer that slides over the page; on desktop it
 * can shrink to a strip of section icons whose pages open in a floating
 * panel. It also filters pages as you type, folds sections and sub-lists
 * and remembers both, and keeps the current page lit and in view.
 */
(() => {
	'use strict';

	const DRAWER_BELOW = 992;
	const STRIP_STORE = 'basalt-menu-narrow';
	const SECTION_STORE = 'basalt-sidebar-folds';
	const SUBLIST_STORE = 'basalt-menu-groups';
	const PANEL_LINGER = 220;
	const RESIZE_SETTLE = 120;
	const VIEW_MARGIN = 48;

	const menu = document.getElementById('basalt-mainmenu');
	const dimmer = document.querySelector('.basalt-dim');
	const root = document.body;

	/* The strip and its panel exist from the start but join the page only
	 * when the menu has a scroll area to sit beside. */
	const strip = document.createElement('div');
	const panel = document.createElement('div');

	let sections = [];
	let scrollArea = null;
	let finder = null;
	let finderReset = null;
	let noMatch = null;
	let lingerTimer = null;
	let settleTimer;

	/* The menu width follows SETTINGS in appearance.js: its start value on a first
	 * visit, and only that value when visitors may not change it. */
	const look = window.Basalt?.appearance;
	const widthFixed = Boolean(look?.canChange && !look.canChange('menuWidth'));
	const startNarrow = look?.start?.('menuWidth') === 'narrow';
	if (widthFixed ? startNarrow : savedWidth() === 'narrow' || (savedWidth() === null && startNarrow)) {
		root.classList.add('basalt-menu-narrow');
	}
	document.addEventListener('DOMContentLoaded', start);

	function start() {
		sections = [...(menu?.querySelectorAll('.basalt-menu-group') ?? [])];
		scrollArea = menu?.querySelector('.basalt-mainmenu-scroll');
		finder = menu?.querySelector('[data-basalt-menu-search]');
		finderReset = menu?.querySelector('[data-basalt-menu-clear]');
		noMatch = menu?.querySelector('[data-basalt-menu-empty]');

		describeWidthButton();
		wireMenuButtons();
		restoreSections();
		restoreSublists();
		if (finder) wireFinder();
		if (menu && scrollArea) buildStrip();
		lightStrip();
		wireStrip();
		wireLinks();

		revealCurrent();
		revealStripSection();

		document.addEventListener('keydown', onEscape);
		window.addEventListener('pageshow', onReturnFromCache);
		window.addEventListener('resize', onResize);
	}

	function phoneWidth() {
		return window.innerWidth < DRAWER_BELOW;
	}

	function stripMode() {
		return !phoneWidth() && root.classList.contains('basalt-menu-narrow');
	}

	/** Slides the phone drawer in or out and tells every opener which it is. */
	function setDrawer(open) {
		menu?.classList.toggle('is-open', open);
		dimmer?.classList.toggle('is-visible', open);
		for (const opener of document.querySelectorAll('[data-basalt-chrome="menu-open"]')) {
			opener.setAttribute('aria-expanded', `${open}`);
		}
	}

	/* The width button sits inside the menu and holds both icons, so only its
	 * wording and expanded state need to follow the body class. */
	function describeWidthButton() {
		const button = menu?.querySelector('[data-basalt-menu-narrow]');
		if (!button) return;
		button.hidden = widthFixed;
		const narrow = root.classList.contains('basalt-menu-narrow');
		button.setAttribute('aria-expanded', `${!narrow}`);
		button.setAttribute('aria-label', narrow ? 'Widen the menu' : 'Narrow the menu');
	}

	function flipWidth() {
		if (widthFixed) return;
		const narrow = root.classList.toggle('basalt-menu-narrow');
		try {
			localStorage.setItem(STRIP_STORE, narrow ? 'narrow' : 'wide');
		} catch {
			/* Private windows may refuse storage; the width still changes. */
		}
		describeWidthButton();
	}

	/** @returns {?string} 'narrow' or 'wide', or null when nothing is saved. */
	function savedWidth() {
		try {
			return localStorage.getItem(STRIP_STORE);
		} catch {
			return null;
		}
	}

	/* The topbar button opens the drawer on phones and changes the width on
	 * desktop; the drawer only gets measured once it is showing. */
	function wireMenuButtons() {
		for (const opener of document.querySelectorAll('[data-basalt-chrome="menu-open"]')) {
			opener.addEventListener('click', () => {
				if (!phoneWidth()) {
					flipWidth();
					return;
				}
				setDrawer(!menu?.classList.contains('is-open'));
				if (phoneWidth()) requestAnimationFrame(revealCurrent);
			});
		}

		menu?.querySelector('[data-basalt-menu-narrow]')?.addEventListener('click', () => {
			closePanel();
			flipWidth();
			requestAnimationFrame(() => requestAnimationFrame(stripMode() ? revealStripSection : revealCurrent));
		});

		for (const closer of document.querySelectorAll('[data-basalt-chrome="menu-close"]')) {
			closer.addEventListener('click', () => setDrawer(false));
		}
	}

	function onEscape(event) {
		if (event.key !== 'Escape') return;
		if (!panel.hidden) closePanel();
		else if (menu?.classList.contains('is-open')) setDrawer(false);
	}

	function onResize() {
		clearTimeout(settleTimer);
		settleTimer = setTimeout(() => {
			closePanel();
			if (!phoneWidth()) setDrawer(false);
		}, RESIZE_SETTLE);
	}

	function loadMap(key) {
		try {
			return JSON.parse(localStorage.getItem(key)) || {};
		} catch {
			return {};
		}
	}

	function storeInMap(key, name, value) {
		const map = loadMap(key);
		map[name] = value;
		try {
			localStorage.setItem(key, JSON.stringify(map));
		} catch {
			/* Private windows can refuse storage; the fold simply is not kept. */
		}
	}

	function titleOf(section) {
		return section.querySelector('.basalt-menu-group-heading').textContent.trim();
	}

	function setSectionShut(section, shut) {
		section.classList.toggle('basalt-menu-group-shut', shut);
		section.querySelector('[data-basalt-section-toggle]').setAttribute('aria-expanded', `${!shut}`);
	}

	/* The markup already opens Main and this page's section. A section the
	 * visitor folded or opened by hand keeps that state by its title, unless
	 * it holds the current page, which always stays open. */
	function restoreSections() {
		const remembered = loadMap(SECTION_STORE);
		for (const section of sections) {
			const title = titleOf(section);
			const holdsPage = Boolean(section.querySelector('.active'));
			if (title in remembered && !holdsPage) setSectionShut(section, remembered[title]);

			section.querySelector('[data-basalt-section-toggle]').addEventListener('click', () => {
				const shut = !section.classList.contains('basalt-menu-group-shut');
				window.Basalt.slide(section.querySelector(':scope > .basalt-menu-links'), () =>
					setSectionShut(section, shut),
				);
				storeInMap(SECTION_STORE, title, shut);
			});
		}
	}

	/* Sub-lists inside a section (Dashboard, B2B, B2C, Shared and so on)
	 * reopen as they were left, keyed by id; the one holding this page is
	 * always open. Bootstrap does the folding, this only listens. */
	function restoreSublists() {
		if (!menu) return;
		const remembered = loadMap(SUBLIST_STORE);

		for (const list of menu.querySelectorAll('.basalt-menu-children.collapse[id]')) {
			const header = menu.querySelector(`[aria-controls="${list.id}"]`);
			if (header && list.id in remembered && !list.querySelector('.active')) {
				const open = remembered[list.id];
				list.classList.toggle('show', open);
				header.classList.toggle('collapsed', !open);
				header.setAttribute('aria-expanded', `${open}`);
			}

			const remember = (open) => (event) => {
				if (event.target === list) storeInMap(SUBLIST_STORE, list.id, open);
			};
			list.addEventListener('shown.bs.collapse', remember(true));
			list.addEventListener('hidden.bs.collapse', remember(false));
		}
	}

	function htmlSafe(text) {
		return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	/**
	 * Returns a link's label element, first saving its original wording in
	 * data-label so highlights can always be undone.
	 * @param {HTMLAnchorElement} link
	 * @returns {HTMLElement}
	 */
	function labelNode(link) {
		const label = link.querySelector('.basalt-menu-label');
		label.dataset.label ??= label.textContent.trim();
		return label;
	}

	function wordingOf(link) {
		return labelNode(link).dataset.label;
	}

	function mentions(link, needle) {
		return wordingOf(link).toLowerCase().includes(needle);
	}

	/** Wraps the first match in <mark>, or restores the plain label. */
	function highlight(link, needle) {
		const label = labelNode(link);
		const plain = label.dataset.label;
		const start = needle ? plain.toLowerCase().indexOf(needle) : -1;
		if (start < 0) {
			label.textContent = plain;
			return;
		}
		const end = start + needle.length;
		label.innerHTML = [plain.slice(0, start), '<mark>', plain.slice(start, end), '</mark>', plain.slice(end)]
			.map((piece, index) => (index % 2 ? piece : htmlSafe(piece)))
			.join('');
	}

	function rowsOf(section) {
		return section.querySelectorAll(':scope > .basalt-menu-links > li');
	}

	/**
	 * Shows or hides one row of a section and its sub-list, and returns how
	 * many pages it leaves on screen while a search is running.
	 */
	function filterRow(row, needle, sectionNamed) {
		const link = row.querySelector(':scope > a');
		const nested = row.querySelector(':scope > .basalt-menu-children');
		let left = 0;

		if (!nested) {
			const keep = !needle || sectionNamed || mentions(link, needle);
			highlight(link, needle);
			if (needle && keep) left = 1;
		} else {
			const groupNamed = sectionNamed || (Boolean(needle) && mentions(link, needle));
			for (const child of nested.querySelectorAll(':scope > li')) {
				const childLink = child.querySelector('a');
				const keep = !needle || groupNamed || mentions(childLink, needle);
				child.hidden = !keep;
				highlight(childLink, needle);
				if (needle && keep) left += 1;
			}
			highlight(link, needle);
		}

		row.hidden = Boolean(needle) && left === 0;
		return left;
	}

	/* A page stays when its name holds the typed text; a section or sub-list
	 * whose own name matches keeps everything in it. */
	function applyFilter(typed) {
		const needle = typed.trim().toLowerCase();
		const searching = Boolean(needle);
		let total = 0;
		menu.classList.toggle('is-filtering', searching);

		for (const section of sections) {
			const sectionNamed = searching && titleOf(section).toLowerCase().includes(needle);
			let inSection = 0;
			for (const row of rowsOf(section)) inSection += filterRow(row, needle, sectionNamed);
			section.hidden = searching && inSection === 0;
			total += inSection;
		}

		if (noMatch) {
			noMatch.hidden = !searching || total > 0;
			noMatch.textContent = `No page matches “${typed.trim()}”.`;
		}
		if (finderReset) finderReset.hidden = !searching;
	}

	function resetFinder() {
		finder.value = '';
		applyFilter('');
	}

	/* Pages without this menu (sign-in, error screens) open in a new tab, as
	 * their links do, so the dashboard stays where it was. */
	function openFirstMatch(event) {
		const pick = [...menu.querySelectorAll('.basalt-menu-child, .basalt-menu-entry:not([data-bs-toggle])')].find(
			(link) => link.offsetParent !== null,
		);
		if (!pick) return;
		event.preventDefault();
		if (pick.target === '_blank') window.open(pick.href, '_blank', 'noopener');
		else window.location.href = pick.href;
	}

	const finderKeys = {
		Enter: openFirstMatch,
		Escape(event) {
			if (!finder.value) return;
			event.stopPropagation();
			resetFinder();
		},
	};

	function wireFinder() {
		finder.addEventListener('input', () => applyFilter(finder.value));
		finder.addEventListener('keydown', (event) => finderKeys[event.key]?.(event));
		finderReset?.addEventListener('click', () => {
			resetFinder();
			finder.focus();
		});
	}

	function symbolFor(section) {
		return section.dataset.basaltIcon || 'bi-circle';
	}

	/* A link's glyph element carries its bi-* class beside the plain bi. */
	function glyphFor(link) {
		const glyph = link.querySelector('.basalt-menu-glyph');
		return [...(glyph?.classList ?? [])].find((name) => name.startsWith('bi-')) || 'bi-dot';
	}

	/* The strip is drawn from the sections, so no page has to carry the menu
	 * twice. Tiles flagged with a count get a small dot. */
	function buildStrip() {
		strip.className = 'basalt-mainmenu-strip';

		const find = document.createElement('button');
		find.type = 'button';
		find.className = 'basalt-mainmenu-strip-btn basalt-mainmenu-strip-btn-find';
		find.setAttribute('data-basalt-rail-search', '');
		find.setAttribute('aria-label', 'Jump to a page');
		find.title = 'Jump to a page';
		find.innerHTML = '<i class="bi bi-search" aria-hidden="true"></i>';
		/* Searching widens the menu, which a fixed menu width does not allow. */
		find.hidden = widthFixed;

		const tiles = document.createElement('div');
		tiles.className = 'basalt-mainmenu-strip-list';
		for (const [index, section] of sections.entries()) {
			const tile = document.createElement('button');
			tile.type = 'button';
			tile.className = 'basalt-mainmenu-strip-btn';
			tile.dataset.section = `${index}`;
			tile.setAttribute('aria-label', titleOf(section));
			tile.setAttribute('aria-haspopup', 'true');
			const dot = section.querySelector('.basalt-menu-count')
				? '<span class="basalt-mainmenu-strip-mark" aria-hidden="true"></span>'
				: '';
			tile.innerHTML = `<i class="bi ${symbolFor(section)}" aria-hidden="true"></i>${dot}`;
			tiles.append(tile);
		}

		strip.append(find, tiles);
		scrollArea.after(strip);

		panel.className = 'basalt-mainmenu-pop';
		panel.hidden = true;
		document.body.appendChild(panel);
	}

	function sectionOfTile(tile) {
		return sections[Number(tile.dataset.section)];
	}

	function lightStrip() {
		for (const tile of strip.querySelectorAll('[data-section]')) {
			tile.classList.toggle('is-active', Boolean(sectionOfTile(tile).querySelector('.active')));
		}
	}

	function coolTiles() {
		for (const tile of strip.querySelectorAll('.is-hot')) tile.classList.remove('is-hot');
	}

	/** Copies one menu link into the panel, keeping its tab target and count. */
	function panelLink(source) {
		const copy = document.createElement('a');
		copy.href = source.getAttribute('href');
		if (source.target) {
			copy.target = source.target;
			copy.rel = source.rel;
		}
		copy.className = source.classList.contains('active')
			? 'basalt-mainmenu-pop-link active'
			: 'basalt-mainmenu-pop-link';
		copy.innerHTML = `<i class="bi ${glyphFor(source)}" aria-hidden="true"></i><span>${htmlSafe(wordingOf(source))}</span>`;
		if (source.target === '_blank') {
			copy.insertAdjacentHTML(
				'beforeend',
				'<i class="bi bi-box-arrow-up-right basalt-menu-newtab" aria-hidden="true"></i><span class="visually-hidden"> (opens in a new tab)</span>',
			);
		}
		const count = source.querySelector('.basalt-menu-count');
		if (count) copy.appendChild(count.cloneNode(true));
		return copy;
	}

	/* Fills the panel with a section's pages, sub-lists under a small
	 * heading, then pins it beside the tile within the window. */
	function openPanel(tile) {
		const section = sectionOfTile(tile);
		clearTimeout(lingerTimer);
		panel.innerHTML = `<div class="basalt-mainmenu-pop-head"><i class="bi ${symbolFor(section)}" aria-hidden="true"></i>${htmlSafe(titleOf(section))}</div>`;

		for (const row of rowsOf(section)) {
			const link = row.querySelector(':scope > a');
			const nested = row.querySelector(':scope > .basalt-menu-children');
			if (!nested) {
				panel.appendChild(panelLink(link));
				continue;
			}
			const heading = document.createElement('div');
			heading.className = 'basalt-mainmenu-pop-set';
			heading.textContent = wordingOf(link);
			panel.appendChild(heading);
			for (const child of nested.querySelectorAll('a')) panel.appendChild(panelLink(child));
		}

		coolTiles();
		tile.classList.add('is-hot');
		panel.hidden = false;
		const spot = tile.getBoundingClientRect();
		panel.style.left = `${spot.right + 6}px`;
		const lowest = window.innerHeight - panel.offsetHeight - 12;
		panel.style.top = `${Math.max(12, Math.min(spot.top - 8, lowest))}px`;
	}

	function closePanel() {
		clearTimeout(lingerTimer);
		panel.hidden = true;
		coolTiles();
	}

	/* The short delay lets the pointer cross the gap into the panel. */
	function closePanelSoon() {
		clearTimeout(lingerTimer);
		lingerTimer = setTimeout(closePanel, PANEL_LINGER);
	}

	function wireStrip() {
		const previewTile = (event) => {
			const tile = event.target.closest('[data-section]');
			if (tile && stripMode()) openPanel(tile);
		};
		strip.addEventListener('pointerover', previewTile);
		strip.addEventListener('focusin', previewTile);

		strip.addEventListener('click', (event) => {
			const tile = event.target.closest('[data-section]');
			if (tile) {
				if (!panel.hidden && tile.classList.contains('is-hot')) closePanel();
				else openPanel(tile);
				return;
			}
			/* The search tile widens the menu and drops the cursor in the field. */
			if (!event.target.closest('[data-basalt-rail-search]')) return;
			closePanel();
			flipWidth();
			setTimeout(() => finder?.focus(), 240);
		});

		strip.addEventListener('pointerleave', closePanelSoon);
		strip.addEventListener('scroll', closePanel, { passive: true });
		panel.addEventListener('pointerenter', () => clearTimeout(lingerTimer));
		panel.addEventListener('pointerleave', closePanelSoon);
	}

	/** Lights one link as the current page, with its parent on the trail. */
	function makeCurrent(link) {
		for (const lit of menu.querySelectorAll(
			'.basalt-menu-entry.active, .basalt-menu-child.active, .basalt-menu-entry.trail-current',
		)) {
			lit.classList.remove('active', 'trail-current');
			lit.removeAttribute('aria-current');
		}
		link.setAttribute('aria-current', 'page');
		link.classList.add('active');
		const nested = link.closest('.basalt-menu-children');
		if (nested) menu.querySelector(`[aria-controls="${nested.id}"]`)?.classList.add('trail-current');
		lightStrip();
	}

	function wireLinks() {
		if (!menu) return;

		/* A mouse click leaves focus on a fold toggle, and the next key press
		 * of any kind (a screenshot shortcut will do) paints a focus ring on
		 * it, so pointer clicks give the focus back. */
		menu.addEventListener('click', (event) => {
			const toggle = event.target.closest('[data-bs-toggle="collapse"], [data-basalt-section-toggle]');
			if (toggle && event.detail > 0) toggle.blur();
		});

		/* Sub-list headers belong to Bootstrap; real page links light up,
		 * close the drawer, and keep a new-tab link from stealing the light. */
		for (const link of menu.querySelectorAll('.basalt-menu-entry, .basalt-menu-child')) {
			link.addEventListener('click', (event) => {
				if (link.dataset.bsToggle !== undefined) return;
				const href = link.getAttribute('href');
				if (href === null || href === '#') event.preventDefault();
				if (phoneWidth()) setDrawer(false);
				if (link.target !== '_blank') makeCurrent(link);
			});
		}
	}

	/* Coming back with Back or Forward restores the page as it was left,
	 * with the clicked link lit, so hand the light back to this page. */
	function onReturnFromCache(event) {
		if (!event.persisted || !menu) return;
		const file = CSS.escape(location.pathname.split('/').pop() || 'index.html');
		const own = menu.querySelector(`.basalt-menu-entry[href="${file}"], .basalt-menu-child[href="${file}"]`);
		if (own) makeCurrent(own);
	}

	/**
	 * Scrolls a box (never the page) so an item outside its comfortable
	 * middle lands about a third of the way down.
	 */
	function bringIntoView(box, item) {
		if (!box || !item) return;
		const frame = box.getBoundingClientRect();
		const spot = item.getBoundingClientRect();
		const comfortable = spot.top >= frame.top + VIEW_MARGIN && spot.bottom <= frame.bottom - VIEW_MARGIN;
		if (!comfortable) box.scrollTop += spot.top - frame.top - box.clientHeight / 3;
	}

	function revealCurrent() {
		bringIntoView(scrollArea, scrollArea?.querySelector('.basalt-menu-child.active, .basalt-menu-entry.active'));
	}

	function revealStripSection() {
		if (stripMode()) bringIntoView(strip, strip.querySelector('[data-section].is-active'));
	}
})();
