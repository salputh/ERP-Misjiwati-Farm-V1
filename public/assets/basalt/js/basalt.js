/**
 * basalt.js holds the shared behavior that every Basalt page loads after
 * Bootstrap. Each section below is one self-contained component: it looks
 * for its own data-basalt-* hooks once the document is parsed and, where page
 * scripts need a hand, publishes a small window API for them. Components only
 * a few pages use live in assets/basalt/js/components/ and load after this file on
 * those pages.
 */

/* The page shell: calendar-safe dates, the footer year, progress meters and
   the header search. The namespace is created here because sections further
   down hang their helpers on it. */
(() => {
	'use strict';

	const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
	const namespace = window.Basalt || {};
	window.Basalt = namespace;

	/**
	 * Turns a stored date into a Date on the viewer's own calendar. A bare
	 * YYYY-MM-DD names a day rather than a moment; handed to Date as it is,
	 * it becomes UTC midnight and prints as the previous day for anyone west
	 * of Greenwich. Dates pass through untouched and every other value goes
	 * to the Date constructor, so any screen can call this on any date field.
	 * @param {Date|string|number|null|undefined} value
	 * @returns {Date}
	 */
	namespace.toLocalDay = function (value) {
		if (value instanceof Date) return value;
		const parts = ISO_DAY.exec(String(value ?? ''));
		if (!parts) return new Date(value);
		const [year, month, day] = parts.slice(1).map(Number);
		return new Date(year, month - 1, day);
	};

	/**
	 * The address of a photo. Data names a photo by its path, for example
	 * ../../assets/basalt/images/multipurpose/<name>.jpg, and the path is
	 * used as it is. Anything else shows the shared placeholder, so a page
	 * never reaches outside the download for a picture. Every screen that
	 * shows a photo goes through here.
	 * @param {string} ref
	 * @returns {string}
	 */
	namespace.photo = function (ref) {
		if (!ref) return '';
		return ref.includes('/') ? ref : 'assets/basalt/images/placeholder.svg';
	};

	function start() {
		const field = document.getElementById('basalt-find');
		stampYear();
		requestAnimationFrame(fillMeters);
		for (const form of document.querySelectorAll('[data-basalt-chrome="search-form"]')) {
			form.addEventListener('submit', keepOnPage);
		}
		document.addEventListener('keydown', (event) => jumpToSearch(event, field));
		for (const opener of document.querySelectorAll('[data-basalt-chrome="search"]')) {
			foldOutSearch(opener, field);
		}
	}

	function stampYear() {
		const year = String(new Date().getFullYear());
		for (const node of document.querySelectorAll('[data-basalt-chrome="year"]')) {
			node.textContent = year;
		}
	}

	/* Meters start empty in the markup and grow to their value on the first
     frame, which is what makes them animate in. */
	function fillMeters() {
		for (const fill of document.querySelectorAll('[data-basalt-meter]')) {
			const percent = Math.max(0, Math.min(100, Number(fill.dataset.basaltMeter) || 0));
			fill.style.width = `${percent}%`;
			fill.closest('.progress')?.setAttribute('aria-valuenow', String(percent));
		}
	}

	/* The demo has no search backend, so submitting must never reload. */
	function keepOnPage(event) {
		event.preventDefault();
	}

	/* Cmd+K on a Mac, Ctrl+K elsewhere, puts the caret in the header search. */
	function jumpToSearch(event, field) {
		const shortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
		if (!shortcut) return;
		event.preventDefault();
		field?.focus();
	}

	/**
	 * On phones the header shows a search icon instead of the field. Tapping it
	 * stretches the field across the header; Escape or leaving the field folds
	 * it away again, and Escape also hands focus back to the icon.
	 * @param {HTMLElement} opener  the [data-basalt-chrome="search"] button
	 * @param {HTMLInputElement|null} field  the header search input
	 */
	function foldOutSearch(opener, field) {
		const topbar = opener.closest('.basalt-topbar');
		if (!topbar || !field) return;

		function setOpen(open) {
			topbar.classList.toggle('is-searching', open);
			opener.setAttribute('aria-expanded', String(open));
		}

		function opened() {
			return topbar.classList.contains('is-searching');
		}

		opener.setAttribute('aria-expanded', 'false');
		opener.addEventListener('click', () => {
			setOpen(true);
			field.focus();
		});
		field.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape' || !opened()) return;
			setOpen(false);
			opener.focus();
		});
		field.addEventListener('blur', () => {
			if (opened()) setOpen(false);
		});
	}

	document.addEventListener('DOMContentLoaded', start);
})();

/* Folding regions slide instead of snapping. A page script hands over the
   region and the code that opens, closes or refills it; the region's height
   is measured on both sides of that change and eased between the two, and
   whatever newly shows fades in. Reduced motion skips the movement. */
(() => {
	'use strict';

	const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
	const DURATION = 260;
	const still = window.matchMedia('(prefers-reduced-motion: reduce)');
	const running = new WeakMap();
	const TABLE_PART = /^(TABLE|THEAD|TBODY|TFOOT|TR)$/;

	/**
	 * Runs change() and slides region from its old height to its new one.
	 * The state is applied at once, so aria-expanded, carets and any reads
	 * of `hidden` are right straight away. While a region or a direct child
	 * folds away it is held on screen until the slide ends, then let go.
	 * Table parts cannot clip their height, so a row fades in instead.
	 * @param {HTMLElement|null} region  the box that grows or shrinks
	 * @param {() => void} change  shows, hides or refills it
	 * @param {{duration?: number}} [options]
	 */
	window.Basalt.slide = (region, change, options = {}) => {
		if (!region || still.matches) {
			change();
			return;
		}
		const fromHeight = shown(region) ? region.getBoundingClientRect().height : 0;
		running.get(region)?.cancel();
		const chain = displays(lineage(region));
		const before = displays([...region.children]);

		change();

		if (TABLE_PART.test(region.tagName)) {
			if (shown(region)) fadeIn(fresh(region, before), 0);
			return;
		}
		const appearing = !fromHeight && shown(region);
		const leaving = fromHeight > 0 && !shown(region);
		const toHeight = leaving ? 0 : region.getBoundingClientRect().height;
		if (Math.abs(toHeight - fromHeight) < 1) return;

		const cell = region.parentElement?.closest('td, th');
		const cellFolds = cell && (leaving ? !shown(cell) : appearing && !chain.has(cell));
		const held = [];
		for (const [element, display] of leaving ? chain : before) {
			if (element.isConnected && getComputedStyle(element).display === 'none') held.push(hold(element, display));
		}
		const box = getComputedStyle(region);
		const full = {
			height: `${leaving ? fromHeight : toHeight}px`,
			paddingTop: box.paddingTop,
			paddingBottom: box.paddingBottom,
			marginTop: box.marginTop,
			marginBottom: box.marginBottom,
		};
		const flat = { height: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px' };
		let frames = [{ height: `${fromHeight}px` }, { height: `${toHeight}px` }];
		if (appearing) frames = [flat, full];
		if (leaving) frames = [full, flat];

		const motion = region.animate(
			frames.map((frame) => ({ ...frame, overflow: 'hidden' })),
			{ duration: options.duration ?? DURATION, easing: EASE, fill: 'forwards' },
		);
		running.set(region, motion);
		/* The last frame is kept until the holds are let go, so a folded
		   region never flashes back to full height between the two. */
		const letGo = () => {
			for (const release of held.splice(0)) release();
			if (running.get(region) === motion) running.delete(region);
			if (motion.playState === 'finished') motion.cancel();
		};
		motion.addEventListener('finish', letGo);
		motion.addEventListener('cancel', letGo);
		if (cellFolds) squeezeRow(cell, leaving, options.duration ?? DURATION);
		if (!leaving) fadeIn(appearing ? [...region.children] : fresh(region, before), 90);
	};

	/* Every <details> in the template slides too. The summary click is
	   taken over, the height eased, and `open` set at the start of an
	   opening and at the end of a closing, so the content stays drawn while
	   it folds. The toggle event fires as usual for scripts listening to it. */
	document.addEventListener('click', (event) => {
		const summary = event.target.closest('summary');
		const fold = summary?.parentElement;
		if (event.defaultPrevented || still.matches || fold?.tagName !== 'DETAILS') return;
		if (summary !== fold.querySelector(':scope > summary')) return;
		if (event.target.closest('a, button, input, select, textarea, label') && event.target !== summary) return;
		event.preventDefault();
		slideDetails(fold);
	});

	function slideDetails(fold) {
		const pending = running.get(fold);
		const open = pending ? pending.closing : !fold.open;
		const fromHeight = fold.getBoundingClientRect().height;
		pending?.cancel();
		const box = getComputedStyle(fold);
		const top = fold.getBoundingClientRect().top;
		const shutHeight =
			fold.querySelector(':scope > summary').getBoundingClientRect().bottom -
			top +
			parseFloat(box.paddingBottom) +
			parseFloat(box.borderBottomWidth);
		fold.open = true;
		const openHeight = fold.getBoundingClientRect().height;
		const motion = fold.animate(
			[
				{ height: `${fromHeight}px`, overflow: 'hidden' },
				{ height: `${open ? openHeight : shutHeight}px`, overflow: 'hidden' },
			],
			{ duration: DURATION, easing: EASE, fill: 'forwards' },
		);
		motion.closing = !open;
		running.set(fold, motion);
		motion.addEventListener('finish', () => {
			running.delete(fold);
			if (!open) fold.open = false;
			motion.cancel();
		});
		if (open && !pending)
			fadeIn(
				[...fold.children].filter((child) => child.tagName !== 'SUMMARY'),
				90,
			);
	}

	/* When the region sits in a table row that opens or folds with it, the
	   padding of every cell in that row eases too, so the row does not snap
	   at either end. */
	function squeezeRow(cell, leaving, duration) {
		const shut = { paddingTop: '0px', paddingBottom: '0px' };
		for (const part of cell.parentElement.children) {
			const box = getComputedStyle(part);
			const open = { paddingTop: box.paddingTop, paddingBottom: box.paddingBottom };
			part.animate(leaving ? [open, shut] : [shut, open], {
				duration,
				easing: EASE,
				fill: leaving ? 'forwards' : 'none',
			}).finished.then(
				(motion) => motion.cancel(),
				() => {},
			);
		}
	}

	function shown(element) {
		return element.getClientRects().length > 0;
	}

	/* The region and the boxes around it, any of which the change may hide. */
	function lineage(region) {
		const line = [];
		for (let node = region; node && node !== document.body; node = node.parentElement) line.push(node);
		return line;
	}

	/** Notes how each showing element is displayed, to hold it that way. */
	function displays(elements) {
		const map = new Map();
		for (const element of elements) if (shown(element)) map.set(element, getComputedStyle(element).display);
		return map;
	}

	/* Keeps a folding element drawn for the length of the slide. Its new
	   state is already set, so letting go only puts its own inline display
	   back. The hold outranks [hidden] and .d-none, which use !important. */
	function hold(element, display) {
		const value = element.style.getPropertyValue('display');
		const priority = element.style.getPropertyPriority('display');
		element.style.setProperty('display', display, 'important');
		return () => {
			if (value) element.style.setProperty('display', value, priority);
			else element.style.removeProperty('display');
		};
	}

	/* The children that are showing now but were not before. When the whole
	   list was redrawn, the rows past the old count are the new ones. */
	function fresh(region, before) {
		const children = [...region.children].filter(shown);
		const added = children.filter((child) => !before.has(child));
		return added.length === children.length ? children.slice(before.size) : added;
	}

	function fadeIn(parts, delay) {
		for (const part of parts) {
			part.animate(
				[
					{ opacity: 0, transform: 'translateY(-0.5rem)' },
					{ opacity: 1, transform: 'none' },
				],
				{ duration: 220, delay, easing: EASE, fill: 'backwards' },
			);
		}
	}
})();

/* Header trays count their unread rows straight from the markup, so the
   badge, the dot and the "n new" caption always agree with what the tray
   lists, including after one row is opened or the whole tray is cleared. */
(() => {
	'use strict';

	const UNREAD = 'basalt-tray-row-new';

	function mount() {
		for (const tray of document.querySelectorAll('[data-basalt-feed]')) watchTray(tray);
	}

	function watchTray(tray) {
		const key = tray.dataset.basaltFeed;
		const area = tray.closest('.dropdown') || document;
		const badge = partNamed('data-basalt-count');
		const dot = partNamed('data-basalt-dot');
		const caption = partNamed('data-basalt-count-label');
		const clearAll = partNamed('data-basalt-mark-read');

		function partNamed(hook) {
			return area.querySelector(`[${hook}="${key}"]`);
		}

		function unreadRows() {
			return tray.querySelectorAll(`.${UNREAD}`);
		}

		function refresh() {
			const total = unreadRows().length;
			const none = total === 0;
			if (badge) {
				badge.textContent = total;
				badge.hidden = none;
			}
			if (dot) dot.hidden = none;
			if (caption) caption.textContent = none ? 'All read' : `${total} new`;
			if (clearAll) clearAll.hidden = none;
		}

		function markRead(row) {
			if (!row.classList.contains(UNREAD)) return;
			row.classList.remove(UNREAD);
			row.querySelector('[data-basalt-unread-flag]')?.remove();
			refresh();
		}

		tray.addEventListener('click', (event) => {
			const row = event.target.closest('.basalt-tray-row');
			if (row && tray.contains(row)) markRead(row);
		});

		clearAll?.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			for (const row of unreadRows()) markRead(row);
		});

		refresh();
	}

	document.addEventListener('DOMContentLoaded', mount);
})();

/**
 * Live filtering for tables and lists, and the shared "nothing found" panel.
 *
 * Aim a search field at the element it narrows down:
 *
 *   <input type="search" data-basalt-filter="#orders-table"
 *          data-basalt-filter-noun="orders">
 *
 * A <table> has the rows of its first body filtered. Any other element has
 * its [data-basalt-filter-item] descendants filtered, or its direct children
 * when nothing is marked. An item stays when it holds every word typed, with
 * case and accents ignored, so "ann lisbon" keeps "Ann Sparks · Akron". The
 * target then hears a bubbling 'basalt:filter' carrying { query, shown }.
 *
 * Scripts that draw their own rows reuse the same panel, so an empty result
 * looks alike on every page:
 *
 *   tbody.innerHTML = `<tr class="basalt-empty-row"><td colspan="6">${
 *     Basalt.emptyState({ query: q, noun: 'orders' })}</td></tr>`;
 *
 * The panel's "Clear search" button empties whichever search field was typed
 * in most recently and fires input on it, so the code that drew the list
 * draws it again.
 */
(() => {
	'use strict';

	const api = window.Basalt;
	const COMBINING = /[̀-ͯ]/g;
	const SEARCH_FIELDS = 'input[type="search"], [data-basalt-filter]';
	let recentField = null;

	function start() {
		api.matchesQuery = fitsQuery;
		api.emptyState = blankNote;
		document.addEventListener('input', (event) => {
			if (event.target.matches?.(SEARCH_FIELDS)) recentField = event.target;
		});
		document.addEventListener('click', clearRecentField);
		document.addEventListener('DOMContentLoaded', () => {
			for (const field of document.querySelectorAll('[data-basalt-filter]')) attachFilter(field);
		});
	}

	/**
	 * Tells whether a piece of text contains every word of a query, ignoring
	 * case and accents. An empty query matches everything.
	 * @param {*} text   the text searched in; null counts as empty
	 * @param {*} query  the words typed, separated by whitespace
	 * @returns {boolean}
	 * @example Basalt.matchesQuery('Ann Sparks · Akron', 'lisbon ann') // true
	 */
	function fitsQuery(text, query) {
		const haystack = plain(text);
		const words = plain(query).split(/\s+/).filter(Boolean);
		return words.every((word) => haystack.includes(word));
	}

	/**
	 * Builds the markup of the empty-result panel.
	 * @param {object} [options]
	 * @param {string} [options.query]  what was searched; switches the wording
	 *   to "no match" and adds the Clear search button
	 * @param {string} [options.noun]   plural of what the list holds ("orders")
	 * @param {string} [options.title]  replaces the heading (markup allowed)
	 * @param {string} [options.text]   replaces the hint line (markup allowed)
	 * @param {string} [options.icon]   Bootstrap icon name, "search" by default
	 * @param {boolean} [options.clear] false hides the Clear search button
	 * @returns {string} HTML for a .basalt-empty block
	 */
	function blankNote(options) {
		const settings = options || {};
		const typed = String(settings.query || '').trim();
		const heading = settings.title || (typed ? missHeading(typed, settings.noun) : 'Nothing to show yet');
		const hint = settings.text || (typed ? 'Check the spelling, or try a shorter or different term.' : '');
		const parts = [
			`<span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-${settings.icon || 'search'}"></i></span>`,
			`<p class="basalt-empty-title">${heading}</p>`,
		];
		if (hint) parts.push(`<p class="basalt-empty-text">${hint}</p>`);
		if (typed && settings.clear !== false) {
			parts.push(
				'<button type="button" class="btn btn-sm btn-outline-secondary" data-basalt-empty-clear>Clear search</button>',
			);
		}
		return `<div class="basalt-empty" role="status">${parts.join('')}</div>`;
	}

	function missHeading(typed, noun) {
		const lead = noun ? `No ${htmlSafe(noun)} match` : 'No results for';
		return `${lead} “${htmlSafe(typed)}”`;
	}

	function clearRecentField(event) {
		if (!event.target.closest('[data-basalt-empty-clear]') || !recentField) return;
		recentField.value = '';
		recentField.dispatchEvent(new Event('input', { bubbles: true }));
		recentField.focus();
	}

	/**
	 * Wires one [data-basalt-filter] field to the element its selector names.
	 * @param {HTMLInputElement} field
	 */
	function attachFilter(field) {
		const target = document.querySelector(field.dataset.basaltFilter);
		if (!target) return;
		const table = target.tagName === 'TABLE' ? target : null;
		const holder = table ? table.tBodies[0] : target;
		if (!holder) return;
		const noun = field.dataset.basaltFilterNoun;

		function candidates() {
			if (table) return [...holder.rows].filter((row) => !row.classList.contains('basalt-empty-row'));
			const marked = holder.querySelectorAll('[data-basalt-filter-item]');
			if (marked.length) return [...marked];
			return [...holder.children].filter((child) => !child.classList.contains('basalt-empty'));
		}

		function emptyMarkup(query) {
			const panel = api.emptyState({ query, noun });
			if (!table) return panel;
			const span = table.tHead?.rows[0].cells.length ?? 1;
			return `<tr class="basalt-empty-row"><td colspan="${span}">${panel}</td></tr>`;
		}

		/* Bootstrap's d-none takes a ruled-out row away even from a d-flex
		   one; the mark keeps rows that were hidden before the search hidden. */
		function hideFiltered(item, hide) {
			if (hide && !item.classList.contains('d-none')) {
				item.classList.add('d-none');
				item.dataset.basaltFiltered = '';
			} else if (!hide && 'basaltFiltered' in item.dataset) {
				item.classList.remove('d-none');
				delete item.dataset.basaltFiltered;
			}
		}

		function apply() {
			const query = field.value.trim();
			let visible = 0;
			for (const item of candidates()) {
				const keep = !query || api.matchesQuery(item.textContent.trim(), query);
				hideFiltered(item, !keep);
				if (keep) visible += 1;
			}
			holder.querySelector(':scope > .basalt-empty-row, :scope > .basalt-empty')?.remove();
			if (query && !visible) holder.insertAdjacentHTML('beforeend', emptyMarkup(query));
			target.dispatchEvent(
				new CustomEvent('basalt:filter', {
					bubbles: true,
					detail: { query, shown: visible },
				}),
			);
		}

		field.addEventListener('input', apply);
		if (field.value) apply();
	}

	function plain(value) {
		const text = value == null ? '' : String(value);
		return text.normalize('NFD').replace(COMBINING, '').toLowerCase();
	}

	function htmlSafe(value) {
		return String(value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	start();
})();

/**
 * Press-and-hold confirmation for destructive buttons:
 *
 *   <button type="button" class="btn btn-danger basalt-hold" data-basalt-hold data-hold-ms="1500">
 *
 * Holding the pointer, or Enter or Space, for data-hold-ms milliseconds fires
 * a bubbling 'basalt:confirm' on the button; letting go early cancels quietly.
 * While held the button carries .is-holding and a --basalt-hold progress
 * from 0 to 1, which the .basalt-hold-idle, __busy and __done labels follow.
 * It then keeps .is-done until the dialog around it opens again.
 * modals.html and buttons.html show the markup.
 */
(() => {
	'use strict';

	const LET_GO = ['pointerup', 'pointerleave', 'pointercancel'];

	function mount() {
		for (const button of document.querySelectorAll('[data-basalt-hold]')) armHold(button);
	}

	function isPressKey(event) {
		return event.key === 'Enter' || event.key === ' ';
	}

	function armHold(button) {
		const duration = parseInt(button.getAttribute('data-hold-ms'), 10) || 1500;
		const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		let heldSince = 0;
		let request = 0;

		function show(progress) {
			button.style.setProperty('--basalt-hold', String(progress));
		}

		function press() {
			if (heldSince || button.disabled || button.classList.contains('is-done')) return;
			button.classList.add('is-holding');
			heldSince = performance.now();
			request = requestAnimationFrame(advance);
		}

		function advance(now) {
			const progress = Math.min(1, (now - heldSince) / duration);
			show(calm ? 0 : progress);
			if (progress >= 1) finish();
			else request = requestAnimationFrame(advance);
		}

		function finish() {
			button.classList.remove('is-holding');
			button.classList.add('is-done');
			heldSince = 0;
			button.dispatchEvent(new CustomEvent('basalt:confirm', { bubbles: true }));
		}

		function release() {
			cancelAnimationFrame(request);
			heldSince = 0;
			button.classList.remove('is-holding');
			if (!button.classList.contains('is-done')) show(0);
		}

		button.addEventListener('pointerdown', (event) => {
			if (event.button === 0) press();
		});
		for (const type of LET_GO) button.addEventListener(type, release);
		button.addEventListener('keydown', (event) => {
			if (!isPressKey(event)) return;
			event.preventDefault();
			if (!event.repeat) press();
		});
		button.addEventListener('keyup', (event) => {
			if (isPressKey(event)) release();
		});
		button.addEventListener('click', (event) => event.preventDefault());

		/* A dialog that is opened again starts with a fresh, unconfirmed button. */
		button.closest('.modal')?.addEventListener('show.bs.modal', () => {
			button.classList.remove('is-done');
			show(0);
		});
	}

	document.addEventListener('DOMContentLoaded', mount);
})();

/**
 * A soft spotlight in page headers that trails the pointer:
 *
 *   <header class="basalt-hero basalt-hero-spot" data-basalt-hero-spot>
 *
 * Pointer moves fold into at most one update per frame, which writes
 * --basalt-hero-x and --basalt-hero-y on the header. Touch input, screens
 * without hover and reduced motion leave the light resting in the top right
 * corner. headers.html shows the markup.
 */
(() => {
	'use strict';

	const STILL_QUERIES = ['(hover: none)', '(prefers-reduced-motion: reduce)'];

	/**
	 * Starts the spotlight on a header inserted after load. Calling it twice on
	 * the same header does nothing.
	 * @param {HTMLElement} header  a .basalt-hero-spot element
	 */
	window.Basalt.hero = (header) => {
		if (!header || header.hasAttribute('data-basalt-hero-bound')) return;
		header.setAttribute('data-basalt-hero-bound', '');
		trackPointer(header);
	};

	function mount() {
		for (const header of document.querySelectorAll('[data-basalt-hero-spot]')) window.Basalt.hero(header);
	}

	function trackPointer(header) {
		const pointer = { x: 0, y: 0 };
		let pending = 0;

		function paint() {
			pending = 0;
			const { left, top } = header.getBoundingClientRect();
			header.style.setProperty('--basalt-hero-x', `${Math.round(pointer.x - left)}px`);
			header.style.setProperty('--basalt-hero-y', `${Math.round(pointer.y - top)}px`);
		}

		header.addEventListener('pointermove', (event) => {
			if (event.pointerType === 'touch' || holdStill()) return;
			pointer.x = event.clientX;
			pointer.y = event.clientY;
			if (!pending) pending = requestAnimationFrame(paint);
		});
	}

	function holdStill() {
		return STILL_QUERIES.some((query) => window.matchMedia(query).matches);
	}

	document.addEventListener('DOMContentLoaded', mount);
})();

/**
 * Styled select and suggestion box; field-types.html shows the markup and
 * every option.
 *
 * Select. Each <select class="form-select"> is upgraded on load, and so is
 * any added afterwards, which covers selects that page scripts build.
 *   data-basalt-select="search"  puts a search field at the top of the list
 *   data-basalt-select           opts in a select that lacks .form-select
 *   data-basalt-native           keeps the browser's own select
 *   data-placeholder="Pick…"     text a multiple shows while nothing is picked
 * A select with size="2" or more is a list box and stays native. Options may
 * carry data-icon="tools" (a Bootstrap icon name), data-dot="success" (a
 * --basalt-* color name or any CSS color) and data-hint="Secondary text".
 *
 * The real <select> stays in the form, hidden, and owns the value, so .value,
 * 'change' events, required and form reset behave as usual. Assigning .value
 * or .selectedIndex from code updates the button too; after editing the
 * options any other way, call window.Basalt.select.refresh(el).
 * window.Basalt.select(el) upgrades a single select by hand.
 *
 * Suggestion box. A text input whose list of suggestions narrows as you type.
 * Free text stays allowed unless data-strict is present.
 *   <input class="form-control" list="trades" data-basalt-combobox
 *          data-noun="trade">
 *   <datalist id="trades"><option value="Plumbing"></option></datalist>
 * The list may also be a <ul hidden> of <li> items (data-value, data-hint),
 * named by data-basalt-combobox="#id". For inputs added later, call
 * window.Basalt.combobox(el).
 */
(() => {
	'use strict';
	const SELECTS = 'select.form-select, select[data-basalt-select]';
	const COMBOS = 'input[data-basalt-combobox]';
	const valueProp = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
	const indexProp = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
	const selects = new Map();
	let uid = 0;
	let current = null;
	let politeRegion = null;

	/* Lower-cases text and strips its accents, so "Café" and "cafe" compare equal. */
	function fold(text) {
		return String(text ?? '')
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase();
	}

	function htmlSafe(text) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(text ?? '').replace(/[&<>"']/g, (ch) => entities[ch]);
	}

	/**
	 * Escapes text for HTML and wraps its first match of the query in <mark>,
	 * comparing without case or accents. Each folded character remembers the
	 * original character it came from, so the highlight lands on the text as
	 * written even when folding changed its length.
	 * @param {string} text
	 * @param {string} query
	 * @returns {string}
	 */
	function mark(text, query) {
		const needle = fold(query).trim();
		if (!needle) return htmlSafe(text);
		const glyphs = Array.from(text);
		const source = [];
		let folded = '';
		for (const [position, glyph] of glyphs.entries()) {
			const flat = fold(glyph);
			folded += flat;
			for (let n = 0; n < flat.length; n += 1) source.push(position);
		}
		const found = folded.indexOf(needle);
		if (found < 0) return htmlSafe(text);
		const from = source[found];
		const to = source[found + needle.length - 1] + 1;
		const slice = (a, b) => htmlSafe(glyphs.slice(a, b).join(''));
		return `${slice(0, from)}<mark>${slice(from, to)}</mark>${slice(to)}`;
	}

	/**
	 * Finds the label that names a control and makes sure it has an id, so the
	 * custom button can point aria-labelledby at it. A label tied by for=, one
	 * wrapping the control, or failing both an untied label written just
	 * before it (the way a sighted reader would pair them) all count.
	 * @param {HTMLElement} el    the original control
	 * @param {string} base       id stem used when the control has no id
	 * @returns {string} the label's id, or '' when there is no label
	 */
	function labelId(el, base) {
		const tied = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
		let label = tied || el.closest('label');
		if (!label) {
			let before = el.previousElementSibling;
			if (before?.classList.contains('basalt-select-trigger')) before = before.previousElementSibling;
			if (before?.tagName === 'LABEL' && !before.htmlFor) label = before;
		}
		if (!label) return '';
		label.id ||= `${el.id || base}-label`;
		return label.id;
	}

	/* Counts are read out through one shared polite region, created on first
     use, rather than through extra nodes beside every field. */
	function say(text) {
		if (!politeRegion) {
			const region = document.createElement('div');
			region.setAttribute('role', 'status');
			region.setAttribute('aria-live', 'polite');
			region.className = 'visually-hidden';
			politeRegion = document.body.appendChild(region);
		}
		politeRegion.textContent = text;
	}

	/* The floating list, shared by both */
	function Popup(owner, opts) {
		const el = document.createElement('div');
		el.className = 'basalt-select-popup';
		el.id = opts.id;
		el.hidden = true;
		if (opts.search) {
			el.insertAdjacentHTML(
				'beforeend',
				`<div class="basalt-select-popup-search"><i class="bi bi-search" aria-hidden="true"></i><input type="text" class="basalt-select-popup-input" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="true" placeholder="${htmlSafe(opts.search)}"></div>`,
			);
		}
		const list = document.createElement('div');
		list.className = 'basalt-select-popup-list';
		list.id = `${opts.id}-list`;
		list.setAttribute('role', 'listbox');
		list.tabIndex = -1;
		el.appendChild(list);
		const empty = document.createElement('p');
		empty.className = 'basalt-select-popup-empty';
		empty.hidden = true;
		el.appendChild(empty);

		/* Clicks and focus inside the list stay here, so a page that closes its
       own panel on an outside click, or a dialog's focus trap, never sees them. */
		for (const t of ['pointerdown', 'mousedown', 'click', 'focusin', 'focusout', 'touchstart']) {
			el.addEventListener(t, (e) => {
				if (t === 'mousedown' && !e.target.closest('input')) e.preventDefault();
				e.stopPropagation();
			});
		}

		const api = {
			el,
			list,
			empty,
			input: el.querySelector('input'),
			dx: 0,
			dy: 0,
			open(anchor) {
				const host = anchor.closest('.modal, .offcanvas, dialog') || document.body;
				if (el.parentNode !== host) host.appendChild(el);
				el.hidden = false;
				owner.setAttribute('aria-controls', list.id);
				el.classList.remove('is-open');
				/* A transformed ancestor moves position: fixed; measure it once. */
				el.style.left = '0px';
				el.style.top = '0px';
				const r = el.getBoundingClientRect();
				api.dx = r.left;
				api.dy = r.top;
				api.place(anchor);
				void el.offsetWidth;
				el.classList.add('is-open');
			},
			place(anchor) {
				if (el.hidden) return;
				const r = anchor.getBoundingClientRect();
				const vw = document.documentElement.clientWidth;
				const vh = window.innerHeight;
				const gap = 6;
				const edge = 8;
				el.style.minWidth = `${Math.min(vw - edge * 2, Math.max(r.width, 160))}px`;
				list.style.maxHeight = '';
				const natural = el.offsetHeight;
				const below = vh - r.bottom - gap - edge;
				const above = r.top - gap - edge;
				const up = natural > below && above > below;
				const room = up ? above : below;
				if (natural > room) list.style.maxHeight = `${Math.max(88, list.offsetHeight - (natural - room))}px`;
				const h = el.offsetHeight;
				const w = el.offsetWidth;
				const left = Math.max(edge, Math.min(r.left, vw - edge - w));
				const top = up ? r.top - gap - h : r.bottom + gap;
				el.classList.toggle('is-above', up);
				el.style.left = `${left - api.dx}px`;
				el.style.top = `${top - api.dy}px`;
			},
			close() {
				el.hidden = true;
				el.classList.remove('is-open');
				el.remove();
				owner.removeAttribute('aria-controls');
			},
			/* Keeps the active row in view without scrolling the page. */
			reveal(row) {
				if (!row) return;
				const lr = list.getBoundingClientRect();
				const rr = row.getBoundingClientRect();
				if (rr.top < lr.top + 4) list.scrollTop -= lr.top + 4 - rr.top;
				else if (rr.bottom > lr.bottom - 4) list.scrollTop += rr.bottom - lr.bottom + 4;
			},
		};
		return api;
	}

	/* Runs fn at most once a frame, with the last event seen. Scrolls inside
     the list itself pass the event on, so fn can skip them. */
	function later(fn) {
		let frame = 0;
		let last = null;
		return (e) => {
			last = e;
			if (frame) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				fn(last);
			});
		};
	}

	/* Follows the field while its list is open. */
	function track(on, handler) {
		const opts = { capture: true, passive: true };
		if (on) {
			window.addEventListener('scroll', handler, opts);
			window.addEventListener('resize', handler, opts);
		} else {
			window.removeEventListener('scroll', handler, opts);
			window.removeEventListener('resize', handler, opts);
		}
	}

	document.addEventListener(
		'pointerdown',
		(e) => {
			if (current && !current.owns(e.target)) current.close(false);
		},
		true,
	);

	/* A leading icon or color dot, from data-icon or data-dot on the option.
     Shown only when every visible option in the list has one, so labels
     always start on the same line instead of some looking indented.
     data-icon takes "person" or "bi-person". */
	function decorated(sel) {
		return Array.from(sel.options).every(
			(x) => x.hidden || x.hasAttribute('data-icon') || x.hasAttribute('data-dot'),
		);
	}
	function deco(o) {
		const sel = o.closest('select');
		if (sel && !decorated(sel)) return '';
		const icon = (o.getAttribute('data-icon') || '').replace(/^bi-/, '');
		const dot = o.getAttribute('data-dot');
		if (icon) return `<i class="bi bi-${htmlSafe(icon)} basalt-select-icon" aria-hidden="true"></i>`;
		if (dot) return `<span class="basalt-select-dot" aria-hidden="true" data-dot="${htmlSafe(dot)}"></span>`;
		return '';
	}
	/* "success" or "series-3" reads the palette's own color; anything else
     is used as written. */
	function paintDots(root) {
		for (const d of root.querySelectorAll('.basalt-select-dot[data-dot]')) {
			const v = d.getAttribute('data-dot');
			d.style.setProperty('--basalt-dot', /^[a-z][a-z0-9-]*$/.test(v) ? `var(--basalt-${v}, ${v})` : v);
		}
	}

	/* Select */
	function enhance(sel) {
		if (!sel || sel.tagName !== 'SELECT' || selects.has(sel)) return;
		if (parseInt(sel.getAttribute('size'), 10) > 1 || sel.hasAttribute('data-basalt-native') || !sel.parentNode)
			return;
		const n = ++uid;
		const base = `basalt-select-${n}`;
		const multi = sel.multiple;
		const mode = (sel.getAttribute('data-basalt-select') || '').split(/\s+/);
		const searchable = mode.includes('search');
		const bare = !sel.classList.contains('form-select');

		/* A copy left behind by cloning markup has no behavior; drop it. */
		for (const sib of [sel.previousElementSibling, sel.nextElementSibling]) {
			if (sib && sib.classList.contains('basalt-select-trigger') && !sib.basaltLive) sib.remove();
		}

		const btn = document.createElement('button');
		btn.type = 'button';
		btn.basaltLive = true;
		btn.setAttribute('role', 'combobox');
		btn.setAttribute('aria-haspopup', 'listbox');
		btn.setAttribute('aria-expanded', 'false');

		/* Keep the button where the select sat, so input-group corners and
       floating labels still line up. After the select only when it was last. */
		let after = true;
		for (let s = sel.nextElementSibling; s; s = s.nextElementSibling) {
			if (!s.matches('.invalid-feedback, .valid-feedback, .invalid-tooltip, .valid-tooltip')) {
				after = false;
				break;
			}
		}
		sel.parentNode.insertBefore(btn, after ? sel.nextSibling : sel);

		const pop = Popup(btn, {
			id: base,
			search: searchable ? sel.getAttribute('data-search-placeholder') || 'Search' : '',
		});
		const search = pop.input;
		let rows = [];
		let active = -1;
		let typed = '';
		let typedAt = 0;
		let moving = false;
		let queued = false;

		const hadFocus = document.activeElement === sel;
		sel.classList.add('basalt-select-native');
		if (sel.hasAttribute('tabindex')) btn.setAttribute('tabindex', sel.getAttribute('tabindex'));
		sel.tabIndex = -1;
		sel.setAttribute('aria-hidden', 'true');

		function text(o) {
			return (o.label || o.textContent || '').trim();
		}

		function syncAttrs() {
			const keep = Array.from(sel.classList).filter((c) => c !== 'basalt-select-native');
			btn.className = `${keep.join(' ')} basalt-select-trigger${multi ? ' basalt-select-trigger-multi' : ''}${bare ? ' basalt-select-trigger-bare' : ''}`;
			btn.disabled = sel.disabled;
			btn.hidden = sel.hidden;
			btn.style.display = sel.style.display === 'none' ? 'none' : '';
			if (sel.title) btn.title = sel.title;
			else btn.removeAttribute('title');
			const lab = labelId(sel, base);
			if (lab) {
				btn.setAttribute('aria-labelledby', lab);
				btn.removeAttribute('aria-label');
			} else if (sel.getAttribute('aria-labelledby')) {
				btn.setAttribute('aria-labelledby', sel.getAttribute('aria-labelledby'));
			} else if (sel.getAttribute('aria-label')) {
				btn.setAttribute('aria-label', sel.getAttribute('aria-label'));
			}

			for (const a of ['aria-describedby', 'aria-invalid']) {
				if (sel.hasAttribute(a)) btn.setAttribute(a, sel.getAttribute(a));
				else btn.removeAttribute(a);
			}

			if (sel.required) btn.setAttribute('aria-required', 'true');
			else btn.removeAttribute('aria-required');
			pop.list.setAttribute('aria-labelledby', btn.getAttribute('aria-labelledby') || '');
			if (!btn.getAttribute('aria-labelledby')) {
				pop.list.removeAttribute('aria-labelledby');
				pop.list.setAttribute('aria-label', btn.getAttribute('aria-label') || 'Options');
			}
			if (multi) pop.list.setAttribute('aria-multiselectable', 'true');
		}

		function paint() {
			queued = false;
			if (!sel.classList.contains('basalt-select-native')) sel.classList.add('basalt-select-native');
			syncAttrs();
			if (multi) {
				const on = Array.from(sel.options).filter((o) => o.selected);
				btn.innerHTML = on.length
					? on
							.map(
								(o) =>
									`<span class="basalt-select-chip" data-index="${o.index}">${deco(o)}${htmlSafe(text(o))}<span class="basalt-select-chip-x" aria-hidden="true" title="Remove"><i class="bi bi-x"></i></span></span>`,
							)
							.join('')
					: `<span class="basalt-select-placeholder">${htmlSafe(sel.getAttribute('data-placeholder') || 'Choose…')}</span>`;
			} else {
				const o = sel.options[indexProp.get.call(sel)];
				/* Unseen copies of the other options keep the button as wide as the
           widest one, the way the browser sizes its own select. */
				const ghosts =
					bare || sel.options.length > 40
						? ''
						: Array.from(sel.options)
								.filter((x) => x !== o && !x.hidden)
								.map(
									(x) =>
										`<span class="basalt-select-ghost" aria-hidden="true">${deco(x)}<span class="basalt-select-text">${htmlSafe(text(x))}</span></span>`,
								)
								.join('');
				/* An empty, hidden first option reads as a placeholder. */
				const ph = !o || (o.value === '' && (o.hidden || o.disabled));
				btn.innerHTML = `<span class="basalt-select-value"><span class="basalt-select-current${ph ? ' basalt-select-placeholder' : ''}">${o ? deco(o) : ''}<span class="basalt-select-text">${htmlSafe(o ? text(o) : sel.getAttribute('data-placeholder') || '')}</span></span>${ghosts}</span>`;
			}
			paintDots(btn);
			if (current === api) {
				const keep = active;
				build();
				markActive(Math.min(keep, rows.length - 1), false);
				pop.place(btn);
			}
		}
		function queue() {
			if (queued) return;
			queued = true;
			queueMicrotask(paint);
		}

		/* Rows are rebuilt from the select each time the list opens. */
		function build() {
			const q = search ? search.value : '';
			const html = [];
			rows = [];
			let group = null;

			function addOption(o) {
				if (o.hidden) return;
				const hint = o.getAttribute('data-hint') || '';
				if (q && !fold(`${text(o)} ${hint}`).includes(fold(q).trim())) return;
				if (group) {
					html.push(group);
					group = null;
				}
				const i = rows.length;
				rows.push(o);
				html.push(
					`<div class="basalt-select-popup-option" role="option" id="${base}-o${i}" data-row="${i}" aria-selected="${o.selected}"${o.disabled || o.parentNode.disabled ? ' aria-disabled="true"' : ''}>${multi ? '<span class="basalt-select-popup-box" aria-hidden="true"><i class="bi bi-check-lg"></i></span>' : ''}${deco(o)}<span class="basalt-select-popup-body"><span class="basalt-select-popup-label">${mark(text(o), q)}</span>${hint ? `<span class="basalt-select-popup-hint">${mark(hint, q)}</span>` : ''}</span>${multi ? '' : '<i class="bi bi-check2 basalt-select-popup-check" aria-hidden="true"></i>'}</div>`,
				);
			}

			Array.from(sel.children).forEach((c, gi) => {
				if (c.tagName === 'OPTGROUP') {
					const gid = `${base}-g${gi}`;
					group = `<div role="group" aria-labelledby="${gid}" class="basalt-select-popup-group"><div class="basalt-select-popup-heading" role="presentation" id="${gid}">${htmlSafe(c.label)}</div>`;
					const before = html.length;
					Array.from(c.children).forEach(addOption);
					group = null;
					if (html.length > before) html.push('</div>');
				} else if (c.tagName === 'OPTION') {
					addOption(c);
				}
			});
			pop.list.innerHTML = html.join('');
			paintDots(pop.list);
			const none = !rows.length;
			pop.empty.hidden = !none;
			pop.empty.innerHTML = none
				? `<i class="bi bi-search" aria-hidden="true"></i> No matches${q ? ` for “${htmlSafe(q.trim())}”` : ''}`
				: '';
			if (search) {
				say(none ? 'No matches' : rows.length + (rows.length === 1 ? ' option' : ' options'));
			}
		}

		function usable(i) {
			return rows[i] && !rows[i].disabled && !(rows[i].parentNode && rows[i].parentNode.disabled);
		}

		function markActive(i, scroll) {
			const old = pop.list.querySelector('.is-active');
			if (old) old.classList.remove('is-active');
			active = i;
			const focusEl = search || btn;
			const row = i >= 0 ? pop.list.querySelector(`[data-row="${i}"]`) : null;
			if (!row) {
				focusEl.removeAttribute('aria-activedescendant');
				return;
			}
			row.classList.add('is-active');
			focusEl.setAttribute('aria-activedescendant', row.id);
			if (scroll !== false) pop.reveal(row);
		}
		function step(from, dir) {
			for (let i = from + dir; i >= 0 && i < rows.length; i += dir) if (usable(i)) return i;
			return from;
		}

		function first() {
			return step(-1, 1);
		}

		function last() {
			return step(rows.length, -1);
		}

		function open(where) {
			if (btn.disabled || current === api) return;
			if (current) current.close(false);
			current = api;
			typed = '';
			if (search) search.value = '';
			build();
			pop.open(btn);
			btn.setAttribute('aria-expanded', 'true');
			btn.classList.add('is-open');
			track(true, follow);
			let i = rows.findIndex((o) => o.selected);
			if (where === 'first' || i < 0 || !usable(i)) i = first();
			if (where === 'last') i = last();
			markActive(i);
			if (search) {
				search.setAttribute('aria-controls', pop.list.id);
				search.setAttribute(
					'aria-label',
					`Search ${btn.getAttribute('aria-label') || labelText() || 'options'}`,
				);
				search.focus({ preventScroll: true });
			}
		}
		function labelText() {
			const id = btn.getAttribute('aria-labelledby');
			const l = id && document.getElementById(id.split(' ')[0]);
			return l ? l.textContent.trim().toLowerCase() : '';
		}
		function close(refocus) {
			if (current !== api) return;
			current = null;
			pop.close();
			track(false, follow);
			btn.setAttribute('aria-expanded', 'false');
			btn.classList.remove('is-open');
			btn.removeAttribute('aria-activedescendant');
			active = -1;
			if (refocus) btn.focus({ preventScroll: true });
		}
		const follow = later((e) => {
			if (current !== api || (e && e.target && e.target.nodeType === 1 && pop.el.contains(e.target))) return;
			const r = btn.getBoundingClientRect();
			if (!btn.isConnected || r.bottom < 0 || r.top > window.innerHeight) {
				close(false);
				return;
			}
			pop.place(btn);
		});
		function fire() {
			sel.dispatchEvent(new Event('input', { bubbles: true }));
			sel.dispatchEvent(new Event('change', { bubbles: true }));
		}
		function choose(i) {
			if (!usable(i)) return;
			const o = rows[i];
			if (multi) {
				o.selected = !o.selected;
				fire();
				paint();
				markActive(i, false);
				return;
			}
			const changed = indexProp.get.call(sel) !== o.index;
			indexProp.set.call(sel, o.index);
			close(true);
			paint();
			if (changed) fire();
		}

		/* Type-ahead: letters typed within half a second build one prefix. */
		function typeahead(ch) {
			const now = Date.now();
			typed = now - typedAt > 600 ? ch : typed + ch;
			typedAt = now;
			const key = fold(typed);
			const same = key.split('').every((c) => c === key[0]);
			const probe = same ? fold(ch) : key;
			const start = same ? active : active - 1;
			for (let k = 1; k <= rows.length; k++) {
				const i = (start + k + rows.length) % rows.length;
				if (usable(i) && fold(text(rows[i])).startsWith(probe)) {
					markActive(i);
					return true;
				}
			}
			return false;
		}

		function keys(e) {
			const k = e.key;
			if (k === 'Tab' && current === api) {
				/* Moving focus back first lets Tab carry on from the button. */
				close(false);
				if (e.target === search) btn.focus({ preventScroll: true });
			}
			const openNow = current === api;
			if (!openNow) {
				if (k === 'Enter' || k === 'Escape' || k === 'Tab') {
					/* Page scripts that listen for these on the select, or on
             something around it, hear them from the select as before and
             get to act first. */
					const copy = new KeyboardEvent('keydown', {
						key: k,
						code: e.code,
						bubbles: true,
						cancelable: true,
						shiftKey: e.shiftKey,
						ctrlKey: e.ctrlKey,
						altKey: e.altKey,
						metaKey: e.metaKey,
					});
					e.stopPropagation();
					sel.dispatchEvent(copy);
					if (copy.defaultPrevented) {
						e.preventDefault();
						return;
					}
					if (k === 'Escape' || k === 'Tab') return;
				}
				if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') {
					e.preventDefault();
					open();
					return;
				}
				if (k === 'Home' || k === 'End') {
					e.preventDefault();
					open(k === 'Home' ? 'first' : 'last');
					return;
				}
				if (multi && (k === 'Backspace' || k === 'Delete')) {
					const on = Array.from(sel.options).filter((o) => o.selected && !o.disabled);
					if (on.length) {
						e.preventDefault();
						on[on.length - 1].selected = false;
						fire();
						paint();
					}
					return;
				}
				if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
					e.preventDefault();
					open();
					if (search) {
						search.value = k;
						search.dispatchEvent(new Event('input'));
					} else typeahead(k);
				}
				return;
			}
			const searchHit = e.target === search;
			if (k === 'ArrowDown' && e.altKey) {
				e.preventDefault();
				return;
			}
			if (k === 'ArrowUp' && e.altKey) {
				e.preventDefault();
				if (!multi && active >= 0) choose(active);
				else close(true);
				return;
			}
			switch (k) {
				case 'ArrowDown':
					e.preventDefault();
					markActive(active < 0 ? first() : step(active, 1));
					break;
				case 'ArrowUp':
					e.preventDefault();
					markActive(active < 0 ? last() : step(active, -1));
					break;
				case 'PageDown':
					e.preventDefault();
					markActive(Math.min(last(), step(Math.min(rows.length - 1, active + 9), 1)));
					break;
				case 'PageUp':
					e.preventDefault();
					markActive(Math.max(first(), step(Math.max(0, active - 9), -1)));
					break;
				case 'Home':
					if (!searchHit) {
						e.preventDefault();
						markActive(first());
					}
					break;
				case 'End':
					if (!searchHit) {
						e.preventDefault();
						markActive(last());
					}
					break;
				case 'Enter':
					e.preventDefault();
					e.stopPropagation();
					if (active >= 0) choose(active);
					break;
				case 'Escape':
					e.preventDefault();
					e.stopPropagation();
					close(true);
					break;
				case ' ':
					if (searchHit) break;
					e.preventDefault();
					if (Date.now() - typedAt < 600 && typed) typeahead(' ');
					else if (active >= 0) choose(active);
					break;
				default:
					if (!searchHit && k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
						e.preventDefault();
						typeahead(k);
					}
			}
		}

		btn.addEventListener('keydown', keys);
		btn.addEventListener('keyup', (e) => {
			if (e.key === ' ') e.preventDefault();
		});
		if (search) {
			search.addEventListener('keydown', keys);
			search.addEventListener('input', () => {
				build();
				markActive(first());
				pop.place(btn);
			});
		}
		btn.addEventListener('click', (e) => {
			const x = e.target.closest('.basalt-select-chip-x');
			if (x) {
				const o = sel.options[+x.parentNode.getAttribute('data-index')];
				if (o && !o.disabled && !sel.disabled) {
					o.selected = false;
					fire();
					paint();
				}
				return;
			}
			if (current === api) close(true);
			else open();
		});
		pop.list.addEventListener('click', (e) => {
			const row = e.target.closest('[data-row]');
			if (row) choose(+row.getAttribute('data-row'));
		});
		pop.list.addEventListener('pointermove', (e) => {
			const row = e.target.closest('[data-row]');
			if (row && +row.getAttribute('data-row') !== active && usable(+row.getAttribute('data-row')))
				markActive(+row.getAttribute('data-row'), false);
		});

		/* Page scripts that listen for focus and blur on the select still hear
       them, once for the whole control rather than for each part of it. */
		let inside = false;
		function focusIn() {
			if (inside) return;
			inside = true;
			sel.dispatchEvent(new FocusEvent('focus'));
			sel.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		}
		function focusOut() {
			setTimeout(() => {
				const a = document.activeElement;
				if (a === btn || (a && pop.el.contains(a))) return;
				if (current === api) close(false);
				if (!inside) return;
				inside = false;
				sel.dispatchEvent(new FocusEvent('blur'));
				sel.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
			}, 0);
		}
		btn.addEventListener('focus', focusIn);
		btn.addEventListener('blur', focusOut);
		if (search) search.addEventListener('blur', focusOut);
		sel.addEventListener('focus', (e) => {
			if (!e.isTrusted) return;
			btn.focus();
		});

		for (const t of ['blur', 'focusout']) {
			sel.addEventListener(
				t,
				(e) => {
					if (moving) e.stopImmediatePropagation();
				},
				true,
			);
		}

		sel.addEventListener('change', queue);
		sel.addEventListener('input', queue);
		if (sel.form) sel.form.addEventListener('reset', () => setTimeout(paint, 0));

		/* Setting .value or .selectedIndex from code updates the button too. */
		Object.defineProperty(sel, 'value', {
			configurable: true,
			get() {
				return valueProp.get.call(this);
			},
			set(v) {
				valueProp.set.call(this, v);
				queue();
			},
		});
		Object.defineProperty(sel, 'selectedIndex', {
			configurable: true,
			get() {
				return indexProp.get.call(this);
			},
			set(v) {
				indexProp.set.call(this, v);
				queue();
			},
		});

		const watch = new MutationObserver(queue);
		watch.observe(sel, {
			attributes: true,
			childList: true,
			subtree: true,
			characterData: true,
			attributeFilter: [
				'class',
				'disabled',
				'hidden',
				'style',
				'required',
				'title',
				'aria-invalid',
				'aria-describedby',
				'aria-label',
				'selected',
				'label',
				'data-placeholder',
				'data-hint',
				'data-icon',
				'data-dot',
			],
		});

		const api = {
			sel,
			btn,
			owns: (t) => btn.contains(t) || pop.el.contains(t),
			close,
			open,
			refresh: paint,
			destroy() {
				close(false);
				watch.disconnect();
				btn.remove();
				selects.delete(sel);
			},
		};
		selects.set(sel, api);
		paint();

		/* A select that already had focus hands it to the button quietly. */
		if (hadFocus) {
			moving = true;
			btn.focus({ preventScroll: true });
			moving = false;
			inside = true;
		}
		return api;
	}

	/* Suggestion box: a free-text field that offers entries from a
     <datalist> or a hidden <ul> while the visitor types. With data-strict
     the field only keeps a value that is one of those entries. */
	const suggestionFields = new WeakSet();
	const SUGGESTION_FIELD_ATTRS = {
		role: 'combobox',
		'aria-autocomplete': 'list',
		'aria-expanded': 'false',
		autocomplete: 'off',
	};

	/**
	 * Gives one text input its floating list of suggestions. Calling it again
	 * on the same input, or on one with no list to read from, does nothing.
	 * @param {HTMLInputElement} field  an input carrying data-basalt-combobox
	 */
	function attachSuggestions(field) {
		if (!field || suggestionFields.has(field)) return;
		const pointer = field.getAttribute('data-basalt-combobox');
		const listName = field.getAttribute('list') || field.getAttribute('data-basalt-list');
		const feed =
			(pointer?.startsWith('#') ? document.querySelector(pointer) : null) ||
			(listName ? document.getElementById(listName) : null);
		if (!feed) return;
		suggestionFields.add(field);

		/* The browser would draw its own datalist dropdown over ours, so the
       list reference moves to an attribute only this code reads. */
		if (field.hasAttribute('list')) {
			field.removeAttribute('list');
			field.setAttribute('data-basalt-list', listName);
		}

		const prefix = `basalt-combo-${++uid}`;
		const noun = field.getAttribute('data-noun') || 'suggestion';
		const strict = field.hasAttribute('data-strict');
		const panel = Popup(field, { id: prefix });
		const handle = { owns: (target) => target === field || panel.el.contains(target), close: hide };
		const state = { matches: [], cursor: -1, accepted: field.value, muted: false };
		const followField = later(onViewportChange);

		for (const [name, value] of Object.entries(SUGGESTION_FIELD_ATTRS)) field.setAttribute(name, value);
		const labeledBy = labelId(field, prefix);
		panel.list.setAttribute(labeledBy ? 'aria-labelledby' : 'aria-label', labeledBy || 'Suggestions');

		field.addEventListener('focus', show);
		field.addEventListener('click', () => {
			if (current !== handle) show();
		});
		field.addEventListener('input', () => {
			if (!state.muted) show();
		});
		field.addEventListener('blur', () =>
			setTimeout(() => {
				if (document.activeElement === field) return;
				hide();
				settle();
			}, 0),
		);
		field.addEventListener('keydown', onKey);
		panel.list.addEventListener('click', (event) => {
			const index = rowIndexAt(event);
			if (index >= 0) choose(index);
		});
		panel.list.addEventListener('pointermove', (event) => {
			const index = rowIndexAt(event);
			if (index >= 0 && index !== state.cursor) highlight(index, false);
		});

		/* Each key the field answers while its list is open. ArrowDown also
       opens a closed list; Tab is handled before this table is read. */
		const keyActions = {
			ArrowDown(opened) {
				if (opened) highlight(Math.min(state.matches.length - 1, state.cursor + 1));
				else {
					show();
					highlight(0);
				}
			},
			ArrowUp() {
				highlight(state.cursor <= 0 ? -1 : state.cursor - 1);
			},
			Enter() {
				if (state.cursor >= 0) {
					choose(state.cursor);
					return;
				}
				const typed = fold(field.value.trim());
				if (strict && !state.matches.some((entry) => fold(entry.value) === typed)) return;
				hide();
				settle();
				emitFieldEvent('change');
			},
			Escape(opened, event) {
				event.stopPropagation();
				hide();
			},
		};

		function onKey(event) {
			if (event.key === 'Tab') {
				hide();
				return;
			}
			if (!Object.hasOwn(keyActions, event.key)) return;
			const opened = current === handle;
			if (!opened && event.key !== 'ArrowDown') return;
			event.preventDefault();
			keyActions[event.key](opened, event);
		}

		/** The entries as { value, label, hint }, read fresh from the source each time. */
		function readEntries() {
			if (feed.tagName !== 'DATALIST') {
				return Array.from(feed.querySelectorAll('li'), (item) => {
					const label = item.getAttribute('data-label') || item.textContent.trim();
					return {
						value: item.getAttribute('data-value') || label,
						label,
						hint: item.getAttribute('data-hint') || '',
					};
				});
			}
			return Array.from(feed.options, (option) => ({
				value: option.value,
				label: option.label && option.label !== option.value ? option.label : option.value,
				hint: option.getAttribute('data-hint') || '',
			}));
		}

		function render() {
			const typed = field.value.trim();
			const needle = fold(typed);
			state.matches = readEntries().filter(
				(entry) => !needle || fold(`${entry.label} ${entry.value}`).includes(needle),
			);
			panel.list.innerHTML = state.matches
				.map((entry, index) => optionMarkup(entry, index, typed, needle))
				.join('');
			const count = state.matches.length;
			panel.empty.hidden = count > 0;
			panel.empty.innerHTML = count ? '' : emptyMarkup(typed);
			say(count ? `${count} ${count === 1 ? 'suggestion' : 'suggestions'}` : `No ${noun} matches`);
			highlight(-1);
		}

		function optionMarkup(entry, index, typed, needle) {
			const exact = Boolean(needle) && fold(entry.value) === needle;
			return [
				`<div id="${prefix}-o${index}" class="basalt-select-popup-option" data-row="${index}" role="option" aria-selected="${exact}">`,
				`<span class="basalt-select-popup-body"><span class="basalt-select-popup-label">${mark(entry.label, typed)}</span>`,
				entry.hint ? `<span class="basalt-select-popup-hint">${htmlSafe(entry.hint)}</span>` : '',
				'</span><i class="bi bi-check2 basalt-select-popup-check" aria-hidden="true"></i></div>',
			].join('');
		}

		function emptyMarkup(typed) {
			const advice = strict ? 'Pick one from the list.' : 'Press Enter to keep it.';
			return `<i class="bi bi-info-circle" aria-hidden="true"></i> <span>No ${htmlSafe(noun)} matches “${htmlSafe(typed)}”. ${advice}</span>`;
		}

		/**
		 * Marks one row as the keyboard's place in the list, or clears it for -1.
		 * @param {number} index
		 * @param {boolean} [scroll=true]  false when the pointer chose the row
		 */
		function highlight(index, scroll = true) {
			panel.list.querySelector('.is-active')?.classList.remove('is-active');
			state.cursor = index;
			const row = index < 0 ? null : panel.list.querySelector(`[data-row="${index}"]`);
			if (!row) {
				field.removeAttribute('aria-activedescendant');
				return;
			}
			row.classList.add('is-active');
			field.setAttribute('aria-activedescendant', row.id);
			if (scroll) panel.reveal(row);
		}

		function rowIndexAt(event) {
			const row = event.target.closest('[data-row]');
			return row ? Number(row.getAttribute('data-row')) : -1;
		}

		function show() {
			if (field.disabled || field.readOnly) return;
			const alreadyOpen = current === handle;
			if (!alreadyOpen) current?.close(false);
			render();
			if (alreadyOpen) {
				panel.place(field);
				return;
			}
			current = handle;
			panel.open(field);
			field.setAttribute('aria-expanded', 'true');
			track(true, followField);
		}

		function hide() {
			if (current !== handle) return;
			current = null;
			panel.close();
			track(false, followField);
			field.setAttribute('aria-expanded', 'false');
			field.removeAttribute('aria-activedescendant');
			state.cursor = -1;
		}

		/* Scrolling the page carries the list along; once the field leaves the
       screen or the document, the list closes instead. */
		function onViewportChange(event) {
			if (current !== handle) return;
			if (event?.target?.nodeType === 1 && panel.el.contains(event.target)) return;
			const box = field.getBoundingClientRect();
			const offScreen = box.bottom < 0 || box.top > window.innerHeight;
			if (!field.isConnected || offScreen) hide();
			else panel.place(field);
		}

		function choose(index) {
			const entry = state.matches[index];
			if (!entry) return;
			state.muted = true;
			field.value = entry.value;
			state.accepted = entry.value;
			emitFieldEvent('input');
			emitFieldEvent('change');
			state.muted = false;
			hide();
		}

		/* On leaving the field: a loose box keeps whatever was typed, a strict
       one snaps to the matching entry or falls back to its last good value. */
		function settle() {
			if (!strict) {
				state.accepted = field.value;
				return;
			}
			const typed = fold(field.value.trim());
			const known = readEntries().find((entry) => fold(entry.value) === typed);
			if (known) {
				field.value = known.value;
				state.accepted = known.value;
				return;
			}
			if (field.value === state.accepted) return;
			field.value = state.accepted;
			emitFieldEvent('change');
		}

		function emitFieldEvent(type) {
			field.dispatchEvent(new Event(type, { bubbles: true }));
		}
	}

	/**
	 * Enhances a single <select> by hand, for one added after the page loaded.
	 * @param {HTMLSelectElement} select
	 * @returns {object|undefined} the control, when the select qualified
	 */
	function enhanceOne(select) {
		return enhance(select);
	}

	/**
	 * Redraws a select's button after its options changed in a way the control
	 * cannot see; a select that was never enhanced is enhanced now.
	 * @param {HTMLSelectElement} select
	 */
	function refreshSelect(select) {
		const control = selects.get(select);
		if (control) control.refresh();
		else enhance(select);
	}

	enhanceOne.refresh = refreshSelect;
	window.Basalt.select = enhanceOne;
	window.Basalt.combobox = attachSuggestions;

	/* Selects come before suggestion boxes, matching the order ids are handed out. */
	const UPGRADES = [
		[SELECTS, enhance],
		[COMBOS, attachSuggestions],
	];

	function upgradeWithin(root) {
		if (root.nodeType !== Node.ELEMENT_NODE) return;
		for (const [selector, upgrade] of UPGRADES) {
			if (root.matches(selector)) upgrade(root);
			for (const node of root.querySelectorAll(selector)) upgrade(node);
		}
	}

	/* Tables, dialogs and panels that page scripts fill in later bring new
     fields with them; controls whose select left the page are torn down. */
	function onMutations(records) {
		let anythingRemoved = false;
		for (const record of records) {
			for (const node of record.addedNodes) adoptNode(node);
			if (record.removedNodes.length) anythingRemoved = true;
		}
		if (!anythingRemoved) return;
		for (const [select, control] of selects) {
			if (!select.isConnected) control.destroy();
		}
	}

	function adoptNode(node) {
		if (node.nodeType !== Node.ELEMENT_NODE || node.closest('.basalt-select-popup, .basalt-select-trigger')) return;
		const control = node.tagName === 'SELECT' ? selects.get(node) : undefined;
		if (!control) {
			upgradeWithin(node);
			return;
		}
		/* An enhanced select that was moved by itself pulls its button along. */
		const { btn } = control;
		if (btn.previousElementSibling !== node && btn.nextElementSibling !== node) node.after(btn);
	}

	document.addEventListener('DOMContentLoaded', () => {
		upgradeWithin(document.body);
		new MutationObserver(onMutations).observe(document.body, { childList: true, subtree: true });
	});
})();

/**
 * Two services the components further down share, also open to page scripts.
 *   window.Basalt.announce(text)  says text through a single polite live
 *                                region, so a screen reader hears the change
 *                                while focus stays where it is.
 *   window.Basalt.copyText(text)  puts text on the clipboard. Where the
 *                                Clipboard API is off limits (any page not on
 *                                HTTPS) it copies through a hidden field
 *                                instead. Resolves once it has tried.
 */
(() => {
	'use strict';

	let politeRegion = null;

	/**
	 * Reads a sentence out to screen readers without moving focus.
	 * @param {string} text
	 */
	function announceText(text) {
		politeRegion ||= createPoliteRegion();
		politeRegion.textContent = '';
		setTimeout(() => {
			politeRegion.textContent = text;
		}, 30);
	}

	/**
	 * Copies text to the clipboard.
	 * @param {string} text
	 * @returns {Promise<void>} settles after the attempt, never rejects
	 */
	function copyText(text) {
		if (window.isSecureContext && navigator.clipboard) return navigator.clipboard.writeText(text).catch(() => {});
		copyThroughField(text);
		return Promise.resolve();
	}

	function createPoliteRegion() {
		document.body.insertAdjacentHTML(
			'beforeend',
			'<div class="visually-hidden" aria-live="polite" aria-atomic="true"></div>',
		);
		return document.body.lastElementChild;
	}

	/* The older route: select the text in an off-screen field and ask the
     document to copy the selection. */
	function copyThroughField(text) {
		const scratch = document.createElement('textarea');
		scratch.value = text;
		scratch.readOnly = true;
		Object.assign(scratch.style, { position: 'fixed', opacity: '0' });
		document.body.append(scratch);
		scratch.select();
		try {
			document.execCommand('copy');
		} catch {
			/* No other way is left to try. */
		}
		scratch.remove();
	}

	window.Basalt.announce = announceText;
	window.Basalt.copyText = copyText;
})();

/**
 * Button behaviors, demonstrated on buttons.html and loaders.html.
 *   Basalt.buttonState(button, state, label)
 *       state is 'idle', 'loading', 'success' (or 'done') or 'error' (or
 *       'failed'). A .btn-loading built from __idle, __busy, __done and
 *       __fail spans shows whichever matches. A .btn-loading-swap trades its
 *       __icon for a spinner, check or warning and its __label for label.
 *       Busy buttons get aria-busy and aria-disabled, never disabled, so
 *       they hold focus; clicks on them are dropped.
 *   Basalt.buttonProgress(button, fraction)  fraction runs 0 to 1; fills a
 *       .btn-loading-progress and prints the percent into [data-btn-progress].
 *   [data-basalt-confirm]       first click asks, a second one within
 *                               data-confirm-ms (3000 by default) fires a
 *                               bubbling 'basalt:confirm'.
 *   [data-basalt-segmented]     slides the thumb of a .basalt-segmented.
 *   [data-basalt-speed-dial]    opens and closes a .basalt-speed-dial.
 *   [data-basalt-copy="text"]   copies that text, or the value of the field it
 *                               points to ("#coupon"). Wears .is-copied
 *                               briefly; when it has a data-bs-title, the
 *                               tooltip reads data-basalt-copy-done
 *                               ("Copied") meanwhile.
 *   [data-basalt-shortcut="n"]  pressing N clicks it, unless a field has
 *                               focus.
 * For buttons inserted later, call window.Basalt.buttons(root).
 */
(() => {
	'use strict';

	const STATE_ALIASES = { done: 'success', failed: 'error' };
	const STATE_CLASSES = ['is-loading', 'is-success', 'is-error'];
	const SWAP_ICONS = {
		loading: '<span class="spinner-border"></span>',
		success: '<i class="bi bi-check-lg"></i>',
		error: '<i class="bi bi-exclamation-circle"></i>',
	};
	const STACKED_PARTS = { loading: '.btn-loading-busy', success: '.btn-loading-done', error: '.btn-loading-fail' };
	const DIAL_STEPS = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 };
	const restingFaces = new WeakMap();

	/* Each kind of button, the hook that marks it and the set that remembers
     which ones are already wired. */
	const BINDINGS = [
		{ selector: '[data-basalt-confirm]', wire: armConfirm, wired: new WeakSet() },
		{ selector: '[data-basalt-segmented]', wire: fitSegmented, wired: new WeakSet() },
		{ selector: '[data-basalt-speed-dial]', wire: runSpeedDial, wired: new WeakSet() },
		{ selector: '[data-basalt-copy]', wire: armCopy, wired: new WeakSet() },
	];

	function start() {
		window.Basalt.buttonState = setButtonState;
		/* A page that relabels an idle swap button asks it to forget the face it
       remembered, so the new label is what comes back after the next send. */
		setButtonState.forget = (button) => restingFaces.delete(button);
		window.Basalt.buttonProgress = setButtonProgress;
		window.Basalt.buttons = wireButtons;
		document.addEventListener('click', dropBusyClick, true);
		document.addEventListener('keydown', pressShortcut);
		document.addEventListener('DOMContentLoaded', () => window.Basalt.buttons());
	}

	/**
	 * Wires every button hook found under root; buttons seen before are skipped.
	 * @param {ParentNode} [root=document]
	 */
	function wireButtons(root) {
		const scope = root || document;
		for (const { selector, wire, wired } of BINDINGS) {
			for (const node of scope.querySelectorAll(selector)) {
				if (wired.has(node)) continue;
				wired.add(node);
				wire(node);
			}
		}
	}

	/**
	 * Puts a loading button into one of its states.
	 * @param {HTMLElement} button  a .btn-loading or .btn-loading-swap
	 * @param {string} requested    'idle', 'loading', 'success'/'done' or 'error'/'failed'
	 * @param {string} [label]      caption a swap button shows while not idle
	 */
	function setButtonState(button, requested, label) {
		if (!button) return;
		const state = STATE_ALIASES[requested] || requested || 'idle';
		const busy = state === 'loading';
		const icon = button.querySelector('.btn-loading-icon');
		const caption = button.querySelector('.btn-loading-label');
		const swaps = Boolean(icon && caption);
		if (swaps) swapFace(button, state, label, icon, caption);

		button.classList.remove(...STATE_CLASSES);
		if (state !== 'idle') button.classList.add(`is-${state}`);
		button.setAttribute('aria-busy', String(busy));
		if (busy) {
			button.setAttribute('aria-disabled', 'true');
			setButtonProgress(button, 0);
		} else {
			button.removeAttribute('aria-disabled');
		}
		if (swaps || state === 'idle') return;

		const part = button.querySelector(STACKED_PARTS[state] || '.btn-loading-idle');
		if (part) announce(part.textContent.trim());
	}

	/**
	 * Sets how far a progress button has come.
	 * @param {HTMLElement} button
	 * @param {number} fraction  0 to 1; values outside are clamped
	 */
	function setButtonProgress(button, fraction) {
		const clamped = Math.min(1, Math.max(0, fraction));
		button.style.setProperty('--btn-progress', `${clamped}`);
		const readout = button.querySelector('[data-btn-progress]');
		if (readout) readout.textContent = `${Math.round(clamped * 100)}%`;
	}

	/* A swap button keeps its width while busy and remembers its first icon
     and caption, which come back when it returns to idle. */
	function swapFace(button, state, label, icon, caption) {
		if (!restingFaces.has(button)) restingFaces.set(button, { icon: icon.innerHTML, text: caption.textContent });
		const resting = restingFaces.get(button);
		const idle = state === 'idle';
		if (state === 'loading' && !button.style.minWidth) button.style.minWidth = `${button.offsetWidth}px`;
		icon.innerHTML = SWAP_ICONS[state] || resting.icon;
		caption.textContent = (!idle && label) || resting.text;
		if (idle) button.style.minWidth = '';
	}

	/* While a button is busy its clicks never reach anyone, so a double
     click cannot submit twice. */
	function dropBusyClick(event) {
		if (!event.target.closest?.('.btn-loading.is-loading')) return;
		event.preventDefault();
		event.stopImmediatePropagation();
	}

	function armConfirm(button) {
		const holdMs = parseInt(button.getAttribute('data-confirm-ms'), 10) || 3000;
		const question = button.querySelector('.btn-confirm-ask');
		let expiry = 0;
		button.style.setProperty('--btn-confirm-ms', `${holdMs}ms`);

		button.addEventListener('click', () => {
			if (isAsking()) confirmNow();
			else ask();
		});
		button.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape' || !isAsking()) return;
			event.preventDefault();
			standDown();
		});
		button.addEventListener('blur', standDown);

		function isAsking() {
			return button.classList.contains('is-asking');
		}

		function ask() {
			button.classList.add('is-asking');
			if (question) announce(question.textContent.trim());
			expiry = setTimeout(standDown, holdMs);
		}

		function confirmNow() {
			standDown();
			button.dispatchEvent(new CustomEvent('basalt:confirm', { bubbles: true }));
		}

		function standDown() {
			clearTimeout(expiry);
			button.classList.remove('is-asking');
		}
	}

	/* The radios inside carry the value; this only slides the thumb so it
     sits under whichever label is checked. */
	function fitSegmented(group) {
		if (!group.querySelector('.basalt-segmented-thumb')) {
			group.insertAdjacentHTML('beforeend', '<span class="basalt-segmented-thumb" aria-hidden="true"></span>');
		}

		group.addEventListener('change', () => {
			if (!prefersStill()) group.classList.add('is-moving');
			slideThumb();
		});
		group.addEventListener('transitionend', () => group.classList.remove('is-moving'));
		if ('ResizeObserver' in window) new ResizeObserver(() => requestAnimationFrame(slideThumb)).observe(group);
		slideThumb();

		function slideThumb() {
			const checked = group.querySelector('.btn-check:checked');
			const label = checked && group.querySelector(`label[for="${checked.id}"]`);
			if (!label?.offsetWidth) return;
			group.style.setProperty('--seg-x', `${label.offsetLeft}px`);
			group.style.setProperty('--seg-w', `${label.offsetWidth}px`);
			group.classList.add('is-ready');
		}
	}

	function runSpeedDial(dial) {
		const toggle = dial.querySelector('.basalt-speed-dial-toggle');
		const actions = Array.from(dial.querySelectorAll('.basalt-speed-dial-action'));
		if (!toggle) return;

		setExpanded(false);
		toggle.addEventListener('click', () => {
			const opening = !isExpanded();
			setExpanded(opening);
			if (opening && actions.length) actions.at(-1).focus();
		});
		for (const action of actions) action.addEventListener('click', () => setExpanded(false, true));
		dial.addEventListener('keydown', onDialKey);
		document.addEventListener('click', (event) => {
			if (!dial.contains(event.target)) setExpanded(false);
		});
		dial.addEventListener('focusout', (event) => {
			if (event.relatedTarget && !dial.contains(event.relatedTarget)) setExpanded(false);
		});

		function isExpanded() {
			return dial.classList.contains('is-open');
		}

		/**
		 * Opens or closes the dial; closed actions leave the tab order.
		 * @param {boolean} expanded
		 * @param {boolean} [returnFocus]  on closing, put focus back on the toggle
		 */
		function setExpanded(expanded, returnFocus) {
			dial.classList.toggle('is-open', expanded);
			toggle.setAttribute('aria-expanded', String(expanded));
			for (const action of actions) action.tabIndex = expanded ? 0 : -1;
			if (returnFocus && !expanded) toggle.focus();
		}

		/* Arrows walk round the actions and the toggle; Escape folds it up. */
		function onDialKey(event) {
			if (!isExpanded()) return;
			if (event.key === 'Escape') {
				event.preventDefault();
				setExpanded(false, true);
				return;
			}
			if (!Object.hasOwn(DIAL_STEPS, event.key)) return;
			event.preventDefault();
			const ring = [...actions, toggle];
			const position = ring.indexOf(document.activeElement);
			ring[(position + DIAL_STEPS[event.key] + ring.length) % ring.length].focus();
		}
	}

	function armCopy(button) {
		const hoverText = button.getAttribute('data-bs-title');
		const doneText = button.getAttribute('data-basalt-copy-done') || 'Copied';
		const tooltip =
			hoverText && window.bootstrap ? bootstrap.Tooltip.getOrCreateInstance(button, { title: hoverText }) : null;
		/* A button that is only a copy glyph shows a check while the copy is fresh. */
		const glyph = button.querySelector(':scope > .bi-copy');
		let revertTimer = 0;

		button.addEventListener('click', () => {
			const payload = copyPayload(button.getAttribute('data-basalt-copy') || '');
			window.Basalt.copyText(payload).then(showCopied);
		});

		function showCopied() {
			button.classList.add('is-copied');
			if (glyph) glyph.className = 'bi bi-check2';
			if (tooltip) {
				tooltip.setContent({ '.tooltip-inner': doneText });
				tooltip.show();
			}
			announce(doneText);
			clearTimeout(revertTimer);
			revertTimer = setTimeout(revert, 1800);
		}

		function revert() {
			button.classList.remove('is-copied');
			if (glyph) glyph.className = 'bi bi-copy';
			if (!tooltip) return;
			tooltip.setContent({ '.tooltip-inner': hoverText });
			if (!button.matches(':hover, :focus-visible')) tooltip.hide();
		}
	}

	/* Text that begins with #, . or [ and names an element copies that
     element's value or text. Anything else, an order number such as
     "#4821-KX" included, is copied exactly as written. */
	function copyPayload(spec) {
		if (!/^[#.[]/.test(spec)) return spec;
		const source = tryQuery(spec);
		if (!source) return spec;
		return 'value' in source ? source.value : source.textContent.trim();
	}

	function tryQuery(selector) {
		try {
			return document.querySelector(selector);
		} catch {
			return null;
		}
	}

	/* A single letter clicks the visible button it is bound to, unless the
     visitor is typing, holding a modifier, or a dialog or menu is open. */
	function pressShortcut(event) {
		if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || isTypingIn(event.target)) return;
		if (document.querySelector('.modal.show, .dropdown-menu.show')) return;
		const letter = (event.key || '').toLowerCase();
		if (letter.length !== 1) return;
		const button = shortcutButton(letter);
		if (!button) return;
		event.preventDefault();
		replayFlash(button);
		button.click();
	}

	function shortcutButton(letter) {
		for (const candidate of document.querySelectorAll('[data-basalt-shortcut]')) {
			const bound = candidate.getAttribute('data-basalt-shortcut').toLowerCase() === letter;
			if (bound && candidate.offsetParent && !candidate.disabled) return candidate;
		}
		return null;
	}

	/* Removing the class and forcing a reflow lets the flash play again. */
	function replayFlash(button) {
		button.classList.remove('is-fired');
		void button.offsetWidth;
		button.classList.add('is-fired');
	}

	function isTypingIn(node) {
		return node && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName));
	}

	function prefersStill() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function announce(message) {
		return window.Basalt.announce(message);
	}

	start();
})();

/**
 * Menus, searchable menus and the command menu. dropdowns.html shows each
 * one; the command palette dialog lives on modals.html.
 *   [data-basalt-command]       a search box above grouped results, placed
 *                               on the page, in a dropdown or in a dialog.
 *                               Fires 'basalt:command'; el.basaltCommand
 *                               exposes reset() and search(text).
 *   [data-basalt-dd-search]     a dropdown with a field that filters it.
 *                               Fires 'basalt:pick'.
 *   [data-basalt-dd-multi]      checkboxes plus select-all, a count and chips
 *                               that remove a choice. Fires 'basalt:change'.
 *   .dropdown-submenu           a nested menu: hover, click or Right opens it,
 *                               Left or Escape closes it, and it flips at the
 *                               viewport edge.
 *   [data-basalt-context="#m"]  right-click, Shift+F10 or the menu key opens
 *                               #m at that spot. Fires 'basalt:context' and
 *                               'basalt:pick'.
 *   [data-basalt-confirm-item]  confirms inside the menu first; the second
 *                               pick fires 'basalt:confirm'.
 *   Inside any open menu, typing a letter jumps to the next item with it.
 * For menus inserted later call window.Basalt.menus(root), or
 * window.Basalt.command(el) for a single command menu.
 */
(() => {
	'use strict';
	if (!window.bootstrap) return;

	const pristineText = new WeakMap();

	function toggleOf(panel) {
		return panel.parentElement.querySelector('[data-bs-toggle="dropdown"]');
	}

	/** Closes the dropdown that owns a menu and hands back its toggle. */
	function closeDropdown(panel) {
		const toggle = toggleOf(panel);
		if (toggle) bootstrap.Dropdown.getOrCreateInstance(toggle).hide();
		return toggle;
	}

	/* Bootstrap listens for menu keys on document during capture. A menu
     with keys of its own must hear them before that, so it listens on window. */
	function onKeysFirst(scope, handler) {
		window.addEventListener(
			'keydown',
			(event) => {
				if (scope.contains(event.target)) handler(event);
			},
			true,
		);
	}

	/**
	 * Wraps every place the words occur in <mark>, merging hits that touch or
	 * overlap. Works on text nodes only, so typed input never becomes markup.
	 * @param {Element} holder   element whose own text is highlighted
	 * @param {string[]} words   lower-case search words; [] clears the marks
	 */
	function mark(holder, words) {
		if (!pristineText.has(holder)) pristineText.set(holder, holder.textContent);
		const source = pristineText.get(holder);
		const lower = source.toLowerCase();
		const lit = new Array(lower.length).fill(false);
		for (const word of words) {
			if (!word) continue;
			for (let at = lower.indexOf(word); at !== -1; at = lower.indexOf(word, at + word.length)) {
				lit.fill(true, at, at + word.length);
			}
		}

		holder.textContent = '';
		if (!lit.includes(true)) {
			holder.textContent = source;
			return;
		}
		let start = 0;
		while (start < lit.length) {
			let stop = start;
			while (stop < lit.length && lit[stop] === lit[start]) stop += 1;
			const piece = source.slice(start, stop);
			if (lit[start]) {
				const hit = document.createElement('mark');
				hit.textContent = piece;
				holder.append(hit);
			} else {
				holder.append(piece);
			}
			start = stop;
		}
	}

	/**
	 * Command menu: a combobox field over a role="listbox" of role="option"
	 * items (data-value, data-keywords) sorted into .basalt-command-group
	 * blocks. Arrows step, Ctrl+Home and Ctrl+End jump to either end, Enter
	 * picks, and a first Escape only empties the search.
	 * [data-basalt-command-term] echoes the search and
	 * [data-basalt-command-count] the number of hits. Picking fires a bubbling
	 * 'basalt:command' with { value, label, item }. Inside a dropdown, opening
	 * focuses the search and a pick closes the menu; inside a .modal, showing it
	 * focuses the search. Closing either clears the search.
	 * The element gains Basalt.command with reset() and search(text).
	 * @param {HTMLElement} root  the .basalt-command element
	 */
	function bindCommand(root) {
		const field = root.querySelector('.basalt-command-input');
		const listbox = root.querySelector('.basalt-command-list');
		if (!field || !listbox) return;
		const parts = {
			empty: root.querySelector('.basalt-command-empty'),
			term: root.querySelector('[data-basalt-command-term]'),
			count: root.querySelector('[data-basalt-command-count]'),
			groups: Array.from(root.querySelectorAll('.basalt-command-group')),
			dropdown: root.closest('.dropdown-menu'),
			dialog: root.closest('.modal'),
		};
		const entries = Array.from(root.querySelectorAll('.basalt-command-item'), describeEntry);
		let matches = entries;
		let focused = null;

		field.addEventListener('input', applySearch);
		field.addEventListener('keydown', (event) => {
			const action = keyAction(event);
			if (!action) return;
			event.preventDefault();
			action(event);
		});
		for (const entry of entries) {
			/* Pressing a result must not pull focus out of the search field. */
			entry.el.addEventListener('mousedown', (event) => event.preventDefault());
			entry.el.addEventListener('click', () => pick(entry));
			entry.el.addEventListener('mousemove', () => {
				if (focused !== entry) focusEntry(entry, false);
			});
		}
		const dropdownToggle = parts.dropdown && toggleOf(parts.dropdown);
		if (dropdownToggle) {
			dropdownToggle.addEventListener('shown.bs.dropdown', () => {
				field.focus();
				focusEntry(matches[0]);
			});
			dropdownToggle.addEventListener('hidden.bs.dropdown', clearSearch);
		}
		if (parts.dialog) {
			parts.dialog.addEventListener('shown.bs.modal', () => field.focus());
			parts.dialog.addEventListener('hidden.bs.modal', clearSearch);
		}
		applySearch();
		root.basaltCommand = {
			/** Empties the search and shows every result again. */
			reset() {
				clearSearch();
			},
			/**
			 * Runs a search as if it had been typed, then focuses the field.
			 * @param {string} text
			 */
			search(text) {
				field.value = text;
				applySearch();
				field.focus();
			},
		};

		function describeEntry(el) {
			const texts = Array.from(
				el.querySelectorAll('.basalt-command-title, .basalt-command-sub, .basalt-command-label'),
			);
			const hint = el.querySelector('.basalt-command-hint')?.textContent ?? '';
			const keywords = el.getAttribute('data-keywords') || '';
			const label = (el.querySelector('.basalt-command-title, .basalt-command-label') || el).textContent.trim();
			const haystack =
				`${texts.map((node) => node.textContent.trim()).join(' ')} ${hint} ${keywords}`.toLowerCase();
			return { el, texts, label, haystack };
		}

		/* Which keys the field claims; anything not listed here is left alone. */
		function keyAction(event) {
			const jump = (event.ctrlKey || event.metaKey) && matches.length > 0;
			const table = {
				ArrowDown: () => step(1),
				ArrowUp: () => step(-1),
				Home: jump ? () => focusEntry(matches[0], true) : null,
				End: jump ? () => focusEntry(matches.at(-1), true) : null,
				Enter: () => pick(focused),
				/* The first Escape clears the search; the next one reaches the
           dropdown or dialog and closes it. */
				Escape: field.value
					? (keyEvent) => {
							keyEvent.stopPropagation();
							clearSearch();
						}
					: null,
			};
			return Object.hasOwn(table, event.key) ? table[event.key] : null;
		}

		function applySearch() {
			const words = field.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
			matches = entries.filter((entry) => {
				const hit = words.every((word) => entry.haystack.includes(word));
				entry.el.hidden = !hit;
				for (const node of entry.texts) mark(node, hit ? words : []);
				return hit;
			});
			for (const group of parts.groups) group.hidden = !group.querySelector('.basalt-command-item:not([hidden])');

			const total = matches.length;
			listbox.hidden = total === 0;
			if (parts.empty) parts.empty.hidden = total > 0;
			if (parts.term) parts.term.textContent = field.value.trim();
			if (parts.count) parts.count.textContent = `${total} ${total === 1 ? 'result' : 'results'}`;
			field.setAttribute('aria-expanded', String(total > 0));
			listbox.scrollTop = 0;
			focusEntry(matches[0], true);
		}

		function clearSearch() {
			field.value = '';
			applySearch();
		}

		/**
		 * Moves the active state to an entry, or clears it when there is none.
		 * @param {object|undefined} entry
		 * @param {boolean} [scroll]  keep the entry in view inside the list
		 */
		function focusEntry(entry, scroll) {
			if (focused) {
				focused.el.classList.remove('is-active');
				focused.el.setAttribute('aria-selected', 'false');
			}
			focused = entry || null;
			if (!focused) {
				field.removeAttribute('aria-activedescendant');
				return;
			}
			focused.el.classList.add('is-active');
			focused.el.setAttribute('aria-selected', 'true');
			if (focused.el.id) field.setAttribute('aria-activedescendant', focused.el.id);
			if (scroll) keepInList(focused.el);
		}

		/* Only the list scrolls. scrollIntoView would drag the whole window
       along when the menu sits low on the page. */
		function keepInList(node) {
			const frame = listbox.getBoundingClientRect();
			const box = node.getBoundingClientRect();
			if (box.top < frame.top) listbox.scrollTop -= frame.top - box.top;
			else if (box.bottom > frame.bottom) listbox.scrollTop += box.bottom - frame.bottom;
		}

		function step(delta) {
			if (!matches.length) return;
			const index = matches.indexOf(focused);
			focusEntry(matches[(index + delta + matches.length) % matches.length], true);
		}

		function pick(entry) {
			if (!entry) return;
			focusEntry(entry, false);
			root.dispatchEvent(
				new CustomEvent('basalt:command', {
					bubbles: true,
					detail: { value: entry.el.getAttribute('data-value'), label: entry.label, item: entry.el },
				}),
			);
			if (parts.dropdown) closeDropdown(parts.dropdown)?.focus();
		}
	}

	/**
	 * Searchable menu: a field above the dropdown's items narrows them as the
	 * visitor types. Picking an item fires a bubbling 'basalt:pick' with
	 * { value, item }.
	 * @param {HTMLElement} root  the [data-basalt-dd-search] wrapper
	 */
	function bindDdSearch(root) {
		const field = root.querySelector('.basalt-dd-search-input');
		const panel = root.querySelector('.dropdown-menu');
		const options = Array.from(root.querySelectorAll('.basalt-dd-search-list .dropdown-item'));
		const noMatches = root.querySelector('.basalt-dd-search-empty');
		const echo = root.querySelector('[data-basalt-dd-term]');
		const toggle = root.querySelector('[data-bs-toggle="dropdown"]');

		field.addEventListener('input', narrow);
		field.addEventListener('keydown', (event) => {
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				reachable()[0]?.focus();
			} else if (event.key === 'Enter') {
				event.preventDefault();
				const left = reachable();
				if (left.length === 1) left[0].click();
			}
		});
		/* Up from the topmost item climbs back into the field. */
		onKeysFirst(panel, (event) => {
			if (event.key !== 'ArrowUp' || event.target !== reachable()[0]) return;
			event.preventDefault();
			event.stopPropagation();
			field.focus();
		});
		for (const option of options) option.addEventListener('click', () => choose(option));
		toggle.addEventListener('shown.bs.dropdown', () => field.focus());
		toggle.addEventListener('hidden.bs.dropdown', () => {
			field.value = '';
			narrow();
		});

		function reachable() {
			return options.filter((option) => !option.parentElement.hidden);
		}

		function narrow() {
			const words = field.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
			for (const option of options) {
				const text = option.textContent.trim().toLowerCase();
				option.parentElement.hidden = words.some((word) => !text.includes(word));
				const name = option.querySelector('.basalt-dd-person-name');
				if (name) mark(name, words);
			}
			if (noMatches) noMatches.hidden = reachable().length > 0;
			if (echo) echo.textContent = field.value.trim();
		}

		function choose(option) {
			for (const other of options) other.removeAttribute('aria-current');
			option.setAttribute('aria-current', 'true');
			root.dispatchEvent(
				new CustomEvent('basalt:pick', {
					bubbles: true,
					detail: { value: option.getAttribute('data-value'), item: option },
				}),
			);
			toggle.focus();
		}
	}

	/* Multi-select
	   A checklist living inside a menu. The select-all box turns half-checked
	   while only some rows are ticked, the toggle carries a running count,
	   and each ticked value becomes a chip that can be removed by itself.
	   Every change fires 'basalt:change' with detail.values. */
	function wireChecklistMenu(holder) {
		const menu = holder.querySelector('.dropdown-menu');
		const opener = holder.querySelector('[data-bs-toggle="dropdown"]');
		const options = [...holder.querySelectorAll('.basalt-dd-multi-list input[type="checkbox"]')];
		const master = holder.querySelector('[data-basalt-dd-all]');
		const tally = holder.querySelector('[data-basalt-dd-count]');
		const chipRow = holder.parentElement.querySelector('[data-basalt-dd-chips]');
		const clearButton = holder.querySelector('[data-basalt-dd-clear]');
		const doneButton = holder.querySelector('[data-basalt-dd-done]');

		for (const option of options) option.addEventListener('change', sync);
		master?.addEventListener('change', () => setEvery(master.checked));
		clearButton?.addEventListener('click', () => {
			setEvery(false);
			master?.focus();
		});
		doneButton?.addEventListener('click', () => {
			bootstrap.Dropdown.getOrCreateInstance(opener).hide();
			opener.focus();
		});
		/* The rows are labels, not .dropdown-item links, so Bootstrap's own
       arrow handling would skip them; the arrows walk the boxes instead. */
		keysBeforeBootstrap(menu, (event) => {
			const step = MENU_ARROW_STEPS.get(event.key);
			if (!step) return;
			const stops = [...menu.querySelectorAll('input[type="checkbox"], .basalt-dd-multi-foot .btn')];
			const current = stops.indexOf(document.activeElement);
			event.preventDefault();
			event.stopPropagation();
			stops[Math.max(0, Math.min(current + step, stops.length - 1))].focus();
		});
		opener.addEventListener('shown.bs.dropdown', () => menu.querySelector('input')?.focus());
		sync();

		function setEvery(checked) {
			for (const option of options) option.checked = checked;
			sync();
		}

		function sync() {
			const picked = options.filter((option) => option.checked);
			const howMany = picked.length;
			if (master) {
				master.checked = howMany === options.length;
				master.indeterminate = howMany > 0 && howMany < options.length;
			}
			if (tally) {
				tally.textContent = howMany;
				tally.hidden = !howMany;
			}
			const name = opener.textContent
				.trim()
				.replace(/\d+\s*$/, '')
				.trim();
			opener.setAttribute('aria-label', `${name}, ${howMany ? `${howMany} chosen` : 'none chosen'}`);
			if (chipRow) drawChips(picked);
			const values = picked.map((option) => option.value);
			holder.dispatchEvent(new CustomEvent('basalt:change', { bubbles: true, detail: { values } }));
		}

		function drawChips(picked) {
			chipRow.replaceChildren();
			if (!picked.length) chipRow.append(listItem('basalt-dd-multi-none', 'Nothing chosen'));
			for (const [place, option] of picked.entries()) {
				const remove = document.createElement('button');
				remove.type = 'button';
				remove.setAttribute('aria-label', `Remove ${option.value}`);
				remove.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
				remove.addEventListener('click', () => dropChip(option, place));
				const chip = listItem('basalt-dd-multi-chip', option.value);
				chip.append(remove);
				chipRow.append(chip);
			}
		}

		/* Focus moves to the chip on the left of the gap, or back to the toggle
       once no chip is left to take it. */
		function dropChip(option, place) {
			option.checked = false;
			sync();
			const landing = chipRow.querySelectorAll('button')[Math.max(0, place - 1)];
			(landing || opener).focus();
			window.Basalt.announce(`${option.value} removed`);
		}

		function listItem(className, text) {
			const item = document.createElement('li');
			item.className = className;
			item.textContent = text;
			return item;
		}
	}

	/* Shared by the menu helpers that follow: the step each arrow key takes
     through a list, the selector for an item that can still be chosen,
     and which binder each kind of menu markup gets, in binding order. */
	const MENU_ARROW_STEPS = new Map([
		['ArrowDown', 1],
		['ArrowUp', -1],
	]);
	const OPEN_ITEM = '.dropdown-item:not(.disabled):not(:disabled)';
	const MENU_BINDERS = [
		['[data-basalt-dd-search]', '_basaltDdSearch', bindDdSearch],
		['[data-basalt-dd-multi]', '_basaltDdMulti', wireChecklistMenu],
		['.dropdown-submenu', '_basaltSubmenu', wireNestedMenu],
		['[data-basalt-context]', '_basaltContext', wireContextMenu],
		['[data-basalt-confirm-item]', '_basaltConfirmItem', wireConfirmItem],
	];

	document.addEventListener('keydown', jumpToTypedLetter);

	/**
	 * Binds one command menu if it has not been bound yet.
	 * @param {Element} element  a [data-basalt-command] container
	 * @returns {object|undefined} the element's Basalt.command controller
	 */
	window.Basalt.command = (element) => {
		if (element && firstVisit(element, '_basaltCommandBound')) bindCommand(element);
		return element && element.basaltCommand;
	};

	/**
	 * Binds every menu enhancement found under root; markup that is already
	 * bound is skipped, so it is safe to call again after adding menus.
	 * @param {ParentNode} [root=document]
	 */
	window.Basalt.menus = (root) => {
		const scope = root || document;
		for (const box of scope.querySelectorAll('[data-basalt-command]')) window.Basalt.command(box);
		for (const [selector, flag, bind] of MENU_BINDERS) {
			for (const node of scope.querySelectorAll(selector)) {
				if (firstVisit(node, flag)) bind(node);
			}
		}
	};
	document.addEventListener('DOMContentLoaded', () => window.Basalt.menus());

	/* Nested menus: an li.dropdown-submenu with its own toggle and inner
     .dropdown-menu. Fine pointers open it on hover; a click, Right arrow or
     Enter open it anywhere; Left arrow or Escape fold it back. It flips to
     the left side when the right side has no room. */
	function wireNestedMenu(branch) {
		const handle = branch.querySelector(':scope > .dropdown-submenu-toggle');
		const panel = branch.querySelector(':scope > .dropdown-menu');
		if (!handle || !panel) return;
		let leaveDelay = 0;

		handle.addEventListener('click', (event) => {
			event.stopPropagation();
			if (panel.classList.contains('show')) foldBranch(branch);
			else unfold(true);
		});
		handle.addEventListener('keydown', (event) => {
			if (event.key !== 'ArrowRight') return;
			event.preventDefault();
			event.stopPropagation();
			unfold(true);
		});
		keysBeforeBootstrap(panel, (event) => {
			const step = MENU_ARROW_STEPS.get(event.key);
			const backing = event.key === 'ArrowLeft' || event.key === 'Escape';
			if (!step && !backing) return;
			event.preventDefault();
			event.stopPropagation();
			if (backing) {
				foldBranch(branch);
				handle.focus();
				return;
			}
			const entries = choices();
			const at = entries.indexOf(document.activeElement);
			entries[(at + step + entries.length) % entries.length].focus();
		});
		if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
			branch.addEventListener('mouseenter', () => {
				clearTimeout(leaveDelay);
				unfold(false);
			});
			branch.addEventListener('mouseleave', () => {
				leaveDelay = setTimeout(() => foldBranch(branch), 250);
			});
		}
		/* Hiding the whole menu takes its open branches with it, and moving to
       a plain item of the parent list folds this one. */
		const owner = branch.closest('.dropdown, .btn-group, .dropup, .dropend, .dropstart');
		const ownerToggle = owner && owner.querySelector(':scope > [data-bs-toggle="dropdown"]');
		ownerToggle?.addEventListener('hide.bs.dropdown', () => foldBranch(branch));
		branch.parentElement.addEventListener('focusin', (event) => {
			if (!branch.contains(event.target)) foldBranch(branch);
		});

		function choices() {
			return [...panel.querySelectorAll(`:scope > li > ${OPEN_ITEM}`)];
		}

		function unfold(focusFirst) {
			for (const other of branch.parentElement.querySelectorAll(':scope > .dropdown-submenu')) {
				if (other !== branch) foldBranch(other);
			}
			panel.classList.add('show');
			handle.setAttribute('aria-expanded', 'true');
			branch.classList.remove('is-flipped');
			const overflows = panel.getBoundingClientRect().right > document.documentElement.clientWidth - 8;
			branch.classList.toggle('is-flipped', overflows);
			if (focusFirst) choices()[0]?.focus();
		}
	}

	/** Closes the nested menu held by a submenu item. */
	function foldBranch(branch) {
		branch.querySelector(':scope > .dropdown-menu')?.classList.remove('show');
		branch.querySelector(':scope > .dropdown-submenu-toggle')?.setAttribute('aria-expanded', 'false');
	}

	/* Context menus: data-basalt-context="#menu" on an area. A right-click on
     one of its children, or Shift+F10 / the menu key while a child has
     focus, opens #menu beside it. The menu hears 'basalt:context' with
     detail.target, then 'basalt:pick' once an item is chosen. */
	function wireContextMenu(zone) {
		const sheet = document.querySelector(zone.getAttribute('data-basalt-context'));
		if (!sheet) return;
		let subject = null;

		zone.addEventListener('contextmenu', (event) => {
			const row = rowWithin(zone, event.target);
			if (!row) return;
			event.preventDefault();
			showAt(row, event.clientX, event.clientY);
		});
		zone.addEventListener('keydown', (event) => {
			const asked = (event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu';
			if (!asked) return;
			const row = rowWithin(zone, event.target);
			if (!row) return;
			event.preventDefault();
			const box = row.getBoundingClientRect();
			showAt(row, box.left + 24, box.bottom - 4);
		});
		keysBeforeBootstrap(sheet, (event) => {
			const { key } = event;
			const step = MENU_ARROW_STEPS.get(key);
			const jumping = key === 'Home' || key === 'End';
			const leaving = key === 'Escape' || key === 'Tab';
			if (!step && !jumping && !leaving) return;
			event.preventDefault();
			event.stopPropagation();
			if (leaving) {
				hide(true);
				return;
			}
			const entries = [...sheet.querySelectorAll(OPEN_ITEM)];
			if (jumping) {
				entries[key === 'Home' ? 0 : entries.length - 1].focus();
				return;
			}
			const at = entries.indexOf(document.activeElement);
			entries[(at + step + entries.length) % entries.length].focus();
		});
		sheet.addEventListener('click', (event) => {
			const item = event.target.closest('.dropdown-item');
			if (!item) return;
			sheet.dispatchEvent(new CustomEvent('basalt:pick', { bubbles: true, detail: { item, target: subject } }));
			hide(true);
		});
		document.addEventListener('pointerdown', (event) => {
			if (!sheet.contains(event.target)) hide(false);
		});
		window.addEventListener('scroll', () => hide(false), { passive: true });
		window.addEventListener('resize', () => hide(false));

		/* The menu opens at the pointer, kept 8px inside the viewport, and
       flips above the point when it would run off the bottom. */
		function showAt(row, x, y) {
			subject = row;
			for (const marked of zone.querySelectorAll('.is-target')) marked.classList.remove('is-target');
			row.classList.add('is-target');
			sheet.classList.add('show');
			sheet.dispatchEvent(new CustomEvent('basalt:context', { bubbles: true, detail: { target: row } }));
			const width = sheet.offsetWidth;
			const height = sheet.offsetHeight;
			const { clientWidth, clientHeight } = document.documentElement;
			sheet.style.left = `${Math.max(8, Math.min(x, clientWidth - width - 8))}px`;
			sheet.style.top = `${Math.max(8, y + height > clientHeight - 8 ? y - height : y)}px`;
			sheet.querySelectorAll(OPEN_ITEM)[0].focus();
		}

		function hide(refocus) {
			if (!sheet.classList.contains('show')) return;
			sheet.classList.remove('show');
			if (!subject) return;
			subject.classList.remove('is-target');
			if (refocus) subject.focus();
		}
	}

	/** Finds the direct child of zone that contains node, or null. */
	function rowWithin(zone, node) {
		for (let step = node; step; step = step.parentElement) {
			if (step.parentElement === zone) return step;
		}
		return null;
	}

	/* Two-step items: the first choice asks inside the open menu and keeps
     it up; choosing again fires 'basalt:confirm'. */
	function wireConfirmItem(choice) {
		const menu = choice.closest('.dropdown-menu');
		const opener = menu && menu.parentElement.querySelector('[data-bs-toggle="dropdown"]');

		choice.addEventListener('click', () => {
			if (!choice.classList.contains('is-asking')) {
				choice.classList.add('is-asking');
				const question = choice.querySelector('.dropdown-item-confirm-ask');
				if (question) window.Basalt.announce(question.textContent.trim());
				return;
			}
			settle();
			choice.dispatchEvent(new CustomEvent('basalt:confirm', { bubbles: true }));
		});
		choice.addEventListener('blur', settle);
		choice.addEventListener('mouseleave', settle);
		if (!opener) return;
		/* The menu stays open while it asks; any other reason to hide wins. */
		opener.addEventListener('hide.bs.dropdown', (event) => {
			const fromHere = event.clickEvent && choice.contains(event.clickEvent.target);
			if (fromHere && choice.classList.contains('is-asking')) event.preventDefault();
		});
		opener.addEventListener('hidden.bs.dropdown', settle);

		function settle() {
			choice.classList.remove('is-asking');
		}
	}

	/* Type to jump: in an open menu, or on the toggle that just opened one,
     a printable key moves focus to the next item whose label starts with
     that letter, wrapping past the end. */
	function jumpToTypedLetter(event) {
		const { key, target } = event;
		if (key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey || !/\S/.test(key)) return;
		if (!target.closest || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
		const menu =
			target.closest('.dropdown-menu.show') ||
			(target.matches('[data-bs-toggle="dropdown"][aria-expanded="true"]')
				? target.parentElement.querySelector(':scope > .dropdown-menu.show')
				: null);
		if (!menu) return;
		const candidates = [...menu.querySelectorAll('.dropdown-item')].filter(
			(item) =>
				takesSpace(item) &&
				!item.classList.contains('disabled') &&
				!item.disabled &&
				item.closest('.dropdown-menu') === menu,
		);
		const letter = key.toLowerCase();
		const from = candidates.indexOf(target);
		for (let hop = 1; hop <= candidates.length; hop += 1) {
			const item = candidates[(from + hop) % candidates.length];
			if (!itemLabel(item).startsWith(letter)) continue;
			event.preventDefault();
			item.focus();
			return;
		}
	}

	function itemLabel(item) {
		const title = item.querySelector('.basalt-dd-item-title, .basalt-dd-person-name') || item;
		return (title.textContent || '').trim().toLowerCase();
	}

	function takesSpace(element) {
		return element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0;
	}

	/* Bootstrap listens for menu keys on document while capturing, so a menu
     that runs its own keys must hear them earlier, on window. */
	function keysBeforeBootstrap(container, handler) {
		window.addEventListener(
			'keydown',
			(event) => {
				if (container.contains(event.target)) handler(event);
			},
			true,
		);
	}

	/** Marks an element as bound under flag; true only the first time. */
	function firstVisit(element, flag) {
		if (element[flag]) return false;
		element[flag] = true;
		return true;
	}
})();

/**
 * A stack of toasts in one corner of the page; the markup is on
 * toasts.html. window.Basalt.toasts:
 *   push(options)   shows a toast and returns { el, update(options), dismiss() }.
 *                   Options: tone, icon, title, text, duration in ms (0 keeps
 *                   it up), actions [{ label, ghost, onClick }], onClose(reason).
 *   position(name)  bottom-end, bottom-center, top-end or top-center.
 *   clear()         closes every toast.
 * Timers hold while the pointer or focus is on the stack and while the tab
 * is hidden. Alt+T jumps to the newest toast and Esc closes the focused one.
 * onClose receives 'timeout', 'close' or 'action'; an action whose onClick
 * returns false leaves its toast up.
 */
(() => {
	'use strict';
	if (window.Basalt.toasts) return;

	/* How many toasts may stand at once, the spacing when fanned out and
     when folded, the narrowest width worth squeezing beside a panel, and
     the default icon for each tone. */
	const LIMIT = 6;
	const SPREAD_GAP = 10;
	const FOLD_STEP = 14;
	const NARROWEST = 256;
	const TONE_ICONS = {
		primary: 'bi-bell',
		success: 'bi-check2-circle',
		warning: 'bi-exclamation-triangle',
		danger: 'bi-exclamation-octagon',
		info: 'bi-info-circle',
		loading: 'bi-arrow-repeat',
	};

	/* Everything the stack knows. The shell is built on the first push;
     preferred is the corner position() asked for, corner the one in use. */
	const pile = {
		shell: null,
		rack: null,
		cards: [],
		corner: 'bottom-end',
		preferred: 'bottom-end',
		pointerIn: false,
		focusIn: false,
		returnTo: null,
		frame: 0,
		stamp: 0,
		settling: 0,
	};

	function start() {
		for (const type of ['shown.bs.offcanvas', 'shown.bs.modal', 'hidden.bs.offcanvas', 'hidden.bs.modal']) {
			document.addEventListener(type, queueLayout);
		}
		document.addEventListener('scroll', onPanelScroll, true);
		document.addEventListener('keydown', onJumpKey);
		document.addEventListener('visibilitychange', () => {
			if (!document.hidden) pile.stamp = 0;
		});
		window.addEventListener('resize', queueLayout);
		window.Basalt.toasts = { push: toastNote, position: setCorner, clear: clearAll };
	}

	/**
	 * Shows a toast on top of the stack.
	 * @param {object} options  tone, icon, title, text, duration, actions, onClose
	 * @returns {{el: HTMLElement, update: Function, dismiss: Function}}
	 */
	function toastNote(options) {
		ensureShell();
		const card = { spec: { ...options }, node: document.createElement('div') };
		card.lifetime = options.duration === 0 ? 0 : options.duration || 6000;
		card.remaining = card.lifetime;
		card.node.tabIndex = -1;
		card.api = {
			el: card.node,
			update(changes) {
				Object.assign(card.spec, changes);
				if ('duration' in changes) {
					card.lifetime = changes.duration || 0;
					card.remaining = card.lifetime;
				}
				paint(card);
				arrange();
				if (card.lifetime) ensureTicking();
			},
			dismiss() {
				retire(card, 'close');
			},
		};
		paint(card);
		card.node.classList.add('is-entering');
		pile.rack.prepend(card.node);
		pile.cards.unshift(card);
		while (pile.cards.length > LIMIT) retire(pile.cards[pile.cards.length - 1], 'close');
		arrange();
		requestAnimationFrame(() => requestAnimationFrame(() => card.node.classList.remove('is-entering')));
		if (card.lifetime) ensureTicking();
		return card.api;
	}

	/** Moves the stack to another corner: bottom-end, bottom-center, top-end or top-center. */
	function setCorner(where) {
		pile.preferred = where;
		if (!pile.shell) {
			pile.corner = where;
			return;
		}
		arrange();
	}

	/** Closes every toast in the stack. */
	function clearAll() {
		for (const card of [...pile.cards]) retire(card, 'close');
	}

	function ensureShell() {
		if (pile.shell) return;
		const shell = document.createElement('section');
		shell.className = `basalt-notice-pile basalt-notice-pile-${pile.corner}`;
		shell.setAttribute('aria-label', 'Notifications');
		const rack = document.createElement('div');
		rack.className = 'basalt-notice-pile-items';
		rack.setAttribute('aria-live', 'polite');
		rack.setAttribute('aria-relevant', 'additions text');
		shell.append(rack);
		document.body.append(shell);
		pile.shell = shell;
		pile.rack = rack;
		rack.addEventListener('mouseenter', () => {
			pile.pointerIn = true;
			arrange();
		});
		rack.addEventListener('mouseleave', () => {
			pile.pointerIn = false;
			arrange();
		});
		shell.addEventListener('focusin', () => {
			if (pile.focusIn) return;
			pile.focusIn = true;
			arrange();
		});
		shell.addEventListener('focusout', (event) => {
			if (shell.contains(event.relatedTarget)) return;
			pile.focusIn = false;
			arrange();
		});
		shell.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') return;
			const focused = pile.cards.find((card) => card.node.contains(document.activeElement));
			if (!focused) return;
			event.preventDefault();
			retire(focused, 'close');
		});
	}

	/* Builds a toast's content from its options; called again by update(). */
	function paint(card) {
		const { spec, node } = card;
		const tone = spec.tone || 'primary';
		node.className = `toast show basalt-notice basalt-notice-piled basalt-notice-${tone}`;
		node.setAttribute('role', tone === 'danger' ? 'alert' : 'status');
		node.setAttribute('aria-atomic', 'true');

		const badge = element('span', 'basalt-notice-mark');
		badge.setAttribute('aria-hidden', 'true');
		badge.innerHTML = `<i class="bi ${spec.icon || TONE_ICONS[tone] || TONE_ICONS.primary}"></i>`;
		const copy = element('div', 'basalt-notice-content');
		if (spec.title) copy.append(element('p', 'basalt-notice-head', spec.title));
		if (spec.text) copy.append(element('p', 'basalt-notice-msg', spec.text));
		if (spec.actions?.length) copy.append(actionRow(card));
		const closer = element('button', 'basalt-notice-dismiss');
		closer.type = 'button';
		closer.setAttribute('aria-label', `Dismiss${spec.title ? `: ${spec.title}` : ''}`);
		closer.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
		closer.addEventListener('click', () => retire(card, 'close'));
		const face = element('div', 'basalt-notice-wrap');
		face.append(badge, copy, closer);
		const meter = element('span', 'basalt-notice-timer');
		meter.setAttribute('aria-hidden', 'true');
		meter.hidden = !card.lifetime;

		const focusInside = node.contains(document.activeElement);
		node.replaceChildren(face, meter);
		card.face = face;
		/* New content replaced what held focus, so focus stays in the toast. */
		if (focusInside) (face.querySelector('.basalt-notice-action') || node).focus();
	}

	function actionRow(card) {
		const row = element('div', 'basalt-notice-acts');
		for (const action of card.spec.actions) {
			const quiet = action.ghost ? ' basalt-notice-action-quiet' : '';
			const button = element('button', `btn btn-sm basalt-notice-action${quiet}`, action.label);
			button.type = 'button';
			button.addEventListener('click', () => {
				const staysOpen = action.onClick ? action.onClick(card.api) === false : false;
				if (!staysOpen) retire(card, 'action');
			});
			row.append(button);
		}
		return row;
	}

	function element(tag, className, text) {
		const made = document.createElement(tag);
		made.className = className;
		if (text !== undefined) made.textContent = text;
		return made;
	}

	function retire(card, reason) {
		const place = pile.cards.indexOf(card);
		if (place < 0) return;
		const hadFocus = card.node.contains(document.activeElement);
		pile.cards.splice(place, 1);
		card.node.inert = true;
		card.node.classList.add('is-leaving');
		setTimeout(() => card.node.remove(), wantsCalm() ? 0 : 320);
		if (card.spec.onClose) card.spec.onClose(reason || 'close');
		if (hadFocus) handOffFocus(place);
		if (!pile.cards.length) pile.pointerIn = false;
		arrange();
	}

	/* Focus left with a closed toast: the next toast takes it, or, when the
     stack is empty, whatever had focus before Alt+T, else the page. */
	function handOffFocus(place) {
		const successor = pile.cards[Math.min(place, pile.cards.length - 1)];
		if (successor) {
			successor.node.focus();
			return;
		}
		pile.focusIn = false;
		const back = pile.returnTo && pile.returnTo.isConnected ? pile.returnTo : null;
		(back || document.body).focus();
	}

	function isHeld() {
		return pile.pointerIn || pile.focusIn || document.hidden;
	}

	function ensureTicking() {
		if (pile.frame) return;
		pile.stamp = 0;
		pile.frame = requestAnimationFrame(tickAll);
	}

	/* One animation frame for every timed toast: spends the elapsed time
     unless the stack is held, and keeps running while any toast is timed. */
	function tickAll(now) {
		const elapsed = pile.stamp ? now - pile.stamp : 0;
		pile.stamp = now;
		const held = isHeld();
		for (const card of pile.cards) card.node.classList.toggle('is-paused', held && Boolean(card.lifetime));
		for (const card of [...pile.cards]) {
			if (!card.lifetime) continue;
			if (!held) card.remaining -= elapsed;
			const fraction = Math.max(0, card.remaining / card.lifetime);
			const shown = wantsCalm() ? Math.ceil(fraction * 10) / 10 : fraction;
			card.node.style.setProperty('--basalt-toast-left', shown.toFixed(3));
			if (card.remaining <= 0) retire(card, 'timeout');
		}
		pile.frame = pile.cards.some((card) => card.lifetime) ? requestAnimationFrame(tickAll) : 0;
		if (!pile.frame) pile.stamp = 0;
	}

	/* While the pointer or focus is on the stack it stays fanned out where
     it is. Folded, its corner is chosen from its height; a narrower spot
     wraps text onto more lines, so the height is measured and the choice
     checked a second time. */
	function arrange() {
		if (!pile.rack) return;
		if (!pile.pointerIn && !pile.focusIn) {
			chooseCorner(measureFolded());
			chooseCorner(measureFolded());
		}
		measureFolded();
		positionCards();
	}

	function measureFolded() {
		for (const card of pile.cards) card.height = card.face.offsetHeight + 2;
		const count = pile.cards.length;
		return count ? pile.cards[0].height + Math.min(count - 1, 2) * FOLD_STEP : 0;
	}

	/* Fanned out, toasts sit one under another; folded, the two behind the
     front one peek out, smaller, at the front one's height. */
	function positionCards() {
		const { cards } = pile;
		const spread = pile.pointerIn || pile.focusIn;
		const direction = pile.corner.startsWith('top') ? 1 : -1;
		const leadHeight = cards.length ? cards[0].height : 0;
		let offset = 0;
		const poses = cards.map((card, depth) => {
			if (!spread) {
				return {
					shift: direction * Math.min(depth, 2) * FOLD_STEP,
					scale: 1 - Math.min(depth, 3) * 0.05,
					height: depth ? leadHeight : card.height,
				};
			}
			const pose = { shift: direction * offset, scale: 1, height: card.height };
			offset += card.height + SPREAD_GAP;
			return pose;
		});
		for (const [depth, card] of cards.entries()) {
			const { shift, scale, height } = poses[depth];
			const tucked = !spread && depth > 0;
			card.node.style.setProperty('--y', `${shift}px`);
			card.node.style.setProperty('--s', scale);
			card.node.style.setProperty('--basalt-toast-h', `${height}px`);
			card.node.style.zIndex = String(cards.length - depth);
			card.node.classList.toggle('is-behind', tucked);
			card.node.classList.toggle('is-gone', !spread && depth > 2);
			/* A tucked toast is out of reach until the stack fans out. */
			card.node.inert = tucked;
		}
		let stackHeight = 0;
		if (cards.length)
			stackHeight = spread ? offset - SPREAD_GAP : leadHeight + Math.min(cards.length - 1, 2) * FOLD_STEP;
		pile.rack.style.setProperty('--basalt-stack-h', `${stackHeight}px`);
	}

	/* The stack keeps to its preferred corner (bottom-end unless position()
     said otherwise) and stays clear of an open drawer or dialog: beside it
     when there is room, else in the top corner if the panel leaves that
     free, else at the bottom, lifted over the panel's footer buttons. */
	function chooseCorner(height) {
		const viewW = document.documentElement.clientWidth;
		const narrow = viewW < 576;
		const margin = parseFloat(getComputedStyle(document.documentElement).fontSize) * (narrow ? 0.75 : 1.25);
		const area = {
			viewW,
			viewH: window.innerHeight,
			margin,
			height,
			fullWidth: narrow ? viewW - 2 * margin : Math.min(384, viewW - 2 * margin),
			panels: openPanels(),
		};
		const pick =
			area.panels.length && !isClear(area, pile.preferred, area.fullWidth, 0)
				? sidestep(area)
				: spot(pile.preferred, area.fullWidth);
		pile.corner = pick.corner;
		pile.shell.className = `basalt-notice-pile basalt-notice-pile-${pick.corner}`;
		setLength('--basalt-toast-w', pick.width, pick.width !== area.fullWidth);
		setLength('--basalt-toast-avoid', pick.avoid, pick.avoid > 0);
		setLength('--basalt-toast-lift', pick.lift, pick.lift > 0);
	}

	function sidestep(area) {
		const { panels, viewW, viewH, margin, height, fullWidth } = area;
		const panelLeft = Math.min(...panels.map(({ box }) => box.left));
		const rightGap = viewW - Math.max(...panels.map(({ box }) => box.right));
		const besideRight = roomIn(rightGap);
		const besideLeft = roomIn(panelLeft);
		if (besideRight >= NARROWEST && isClear(area, 'bottom-end', besideRight, 0))
			return spot('bottom-end', besideRight);
		if (besideLeft >= NARROWEST && isClear(area, 'bottom-end', besideLeft, viewW - panelLeft))
			return spot('bottom-end', besideLeft, viewW - panelLeft);
		if (isClear(area, 'top-end', fullWidth, 0)) return spot('top-end', fullWidth);
		const footer = panels[panels.length - 1].panel.querySelector(
			'.modal-footer, .basalt-drawer-foot, .basalt-dialog-foot',
		);
		const footerTop = footer ? footer.getBoundingClientRect().top : viewH;
		const lift = footerTop < viewH ? Math.max(0, Math.min(viewH - footerTop, viewH - 2 * margin - height)) : 0;
		return spot('bottom-end', fullWidth, 0, lift);

		function roomIn(gap) {
			return Math.min(fullWidth, gap - 2 * margin);
		}
	}

	function spot(corner, width, avoid = 0, lift = 0) {
		return { corner, width, avoid, lift };
	}

	/* True when a stack of this width in this corner overlaps no open panel. */
	function isClear(area, corner, width, avoid) {
		const { viewW, viewH, margin, height } = area;
		const left = corner.indexOf('center') > 0 ? (viewW - width) / 2 : viewW - margin - avoid - width;
		const top = corner.startsWith('top') ? margin : viewH - margin - height;
		return area.panels.every(
			({ box }) => left + width <= box.left || left >= box.right || top + height <= box.top || top >= box.bottom,
		);
	}

	function openPanels() {
		return [...document.querySelectorAll('.offcanvas.show, .offcanvas.showing, .modal.show')]
			.map((panel) => ({ panel, box: (panel.querySelector('.modal-content') || panel).getBoundingClientRect() }))
			.filter(({ box }) => box.width && box.height);
	}

	function setLength(name, value, wanted) {
		if (wanted) pile.shell.style.setProperty(name, `${Math.round(value)}px`);
		else pile.shell.style.removeProperty(name);
	}

	/* A panel opening, closing or scrolling its footer into view moves the
     stack, at most once per frame. */
	function queueLayout() {
		if (!pile.shell || !pile.cards.length || pile.settling) return;
		pile.settling = requestAnimationFrame(() => {
			pile.settling = 0;
			arrange();
		});
	}

	function onPanelScroll(event) {
		if (event.target.closest?.('.modal.show, .offcanvas.show')) queueLayout();
	}

	/* Alt+T brings focus to the newest toast, remembering where it was. */
	function onJumpKey(event) {
		if (!event.altKey || event.code !== 'KeyT' || !pile.cards.length) return;
		event.preventDefault();
		if (!pile.shell.contains(document.activeElement)) pile.returnTo = document.activeElement;
		pile.focusIn = true;
		arrange();
		pile.cards[0].node.focus();
	}

	function wantsCalm() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	start();
})();

/**
 * Badge behaviors; the markup is on badges.html.
 *   [data-basalt-removables]   a row of .basalt-removable badges. A badge
 *                              goes when its close button is pressed, or on
 *                              Delete / Backspace; the arrow keys walk the
 *                              row; [data-basalt-removables-undo] restores
 *                              the last one and [-clear] empties the row.
 *                              Fires 'basalt:removableschange'.
 *   [data-basalt-status-menu]  a .basalt-status pill whose menu changes it.
 *                              Fires 'basalt:statuschange'.
 *   window.Basalt.count(el, n)  sets a .basalt-count corner number, showing
 *                              99+ above 99 and hiding itself at 0.
 * For badges added later, call window.Basalt.badges(root).
 */
(() => {
	'use strict';
	function reduceMotion() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/** Restarts a one-shot animation class on target, unless motion is reduced. */
	function replay(target, animation) {
		if (!target || reduceMotion()) return;
		target.classList.remove(animation);
		void target.offsetWidth;
		target.classList.add(animation);
		target.addEventListener('animationend', () => target.classList.remove(animation), { once: true });
	}

	/* Removable badges [data-basalt-removables]: a badge's close button, by
     click or by Delete / Backspace, takes it out of the row and hands focus to
     the nearest badge left; arrows, Home and End walk the row. The
     [data-basalt-removables-undo] button restores the latest removal in place,
     [data-basalt-removables-clear] empties the row in one step, and every
     change fires "basalt:removableschange" with { items }. */

	/**
	 * Wires every removable-badge row and status menu under `scope`, or under
	 * the whole document when it is left out. Already wired ones are skipped,
	 * so pages call it again after rendering new markup.
	 * @param {ParentNode} [scope]
	 */
	window.Basalt.badges = (scope) => {
		const host = scope || document;
		for (const row of host.querySelectorAll('[data-basalt-removables]')) mountRemovableRow(row);
		for (const menu of host.querySelectorAll('[data-basalt-status-menu]')) mountStatusMenu(menu);
	};
	window.Basalt.count = window.Basalt.count || setCounter;
	document.addEventListener('DOMContentLoaded', () => window.Basalt.badges());

	/**
	 * Brings one removable-badge row to life; a second call does nothing.
	 * @param {HTMLElement} row  the [data-basalt-removables] wrapper
	 */
	function mountRemovableRow(row) {
		if (row.dataset.basaltRemovablesReady) return;
		row.dataset.basaltRemovablesReady = 'true';
		const track = row.querySelector('.basalt-removables');
		const emptyNote = row.querySelector('[data-basalt-removables-empty]');
		const undoButton = row.querySelector('[data-basalt-removables-undo]');
		const clearButton = row.querySelector('[data-basalt-removables-clear]');
		const announcer = row.querySelector('[data-basalt-removables-live]');
		if (!track) return;
		/* One entry per removal: the list items it took and the slots they held. */
		const undoLog = [];

		track.addEventListener('click', onTrackClick);
		track.addEventListener('keydown', onTrackKey);
		undoButton?.addEventListener('click', putBackLatest);
		clearButton?.addEventListener('click', removeEverything);
		refresh();

		function liveBadges() {
			return [...track.querySelectorAll('.basalt-removable:not(.is-leaving)')];
		}

		function closerOf(badge) {
			return badge.querySelector('.basalt-removable-remove');
		}

		function captionFor(badge) {
			return (closerOf(badge).getAttribute('aria-label') || '').replace(/^Remove\s+/, '');
		}

		function announce(text) {
			if (announcer) announcer.textContent = text;
		}

		function refresh() {
			const remaining = liveBadges().length;
			if (emptyNote) emptyNote.hidden = remaining > 0;
			if (clearButton) clearButton.disabled = remaining === 0;
			if (undoButton) undoButton.hidden = undoLog.length === 0;
			const detail = { items: liveBadges().map(captionFor) };
			row.dispatchEvent(new CustomEvent('basalt:removableschange', { bubbles: true, detail }));
		}

		function onTrackClick(event) {
			const closer = event.target.closest('.basalt-removable-remove');
			if (closer) takeOut([closer.closest('.basalt-removable')], true);
		}

		function onTrackKey(event) {
			const closer = event.target.closest('.basalt-removable-remove');
			if (!closer) return;
			const badges = liveBadges();
			const here = badges.indexOf(closer.closest('.basalt-removable'));
			if (event.key === 'Delete' || event.key === 'Backspace') {
				event.preventDefault();
				takeOut([badges[here]], true);
				return;
			}
			const jumps = {
				ArrowLeft: here - 1,
				ArrowUp: here - 1,
				ArrowRight: here + 1,
				ArrowDown: here + 1,
				Home: 0,
				End: badges.length - 1,
			};
			if (!Object.hasOwn(jumps, event.key)) return;
			event.preventDefault();
			const goal = badges[jumps[event.key]];
			if (goal) closerOf(goal).focus();
		}

		/** Removes `targets` as one undo step, optionally moving focus onward. */
		function takeOut(targets, moveFocus) {
			const badges = liveBadges();
			const kept = (badge) => !targets.includes(badge);
			const successor =
				badges.slice(badges.indexOf(targets.at(-1)) + 1).find(kept) ||
				badges.slice(0, badges.indexOf(targets[0])).findLast(kept);
			undoLog.push(
				targets.map((badge) => {
					const item = badge.parentElement;
					return { item, slot: [...track.children].indexOf(item) };
				}),
			);
			for (const badge of targets) retire(badge);
			announce(targets.length === 1 ? `Removed ${captionFor(targets[0])}.` : `Removed all ${targets.length}.`);
			if (undoButton) undoButton.hidden = false;
			if (!moveFocus) return;
			if (successor) closerOf(successor).focus();
			else undoButton?.focus();
		}

		/* The badge's list item leaves once the exit animation ends, or at once
       when motion is reduced. */
		function retire(badge) {
			function detach() {
				badge.parentElement.remove();
				refresh();
			}
			if (reduceMotion()) {
				detach();
				return;
			}
			badge.classList.add('is-leaving');
			badge.addEventListener('animationend', detach, { once: true });
		}

		function putBackLatest() {
			const removal = undoLog.pop();
			if (!removal) return;
			const bySlot = [...removal].sort((a, b) => a.slot - b.slot);
			for (const { item, slot } of bySlot) {
				const badge = item.querySelector('.basalt-removable');
				badge.classList.remove('is-leaving');
				track.insertBefore(item, track.children[slot] || null);
				replay(badge, 'is-entering');
			}
			refresh();
			const lead = removal[0].item.querySelector('.basalt-removable');
			announce(removal.length === 1 ? `Put back ${captionFor(lead)}.` : `Put back all ${removal.length}.`);
			closerOf(lead).focus();
		}

		function removeEverything() {
			const badges = liveBadges();
			if (badges.length) takeOut(badges, false);
			undoButton?.focus();
		}
	}

	/* Status menu [data-basalt-status-menu]: choosing an item that carries
     data-status="success|warning|..." repaints the pill, swaps its label and
     aria-label, and fires "basalt:statuschange" with { status, label }. */
	const STATUS_TINTS = ['info', 'success', 'warning', 'danger', 'primary'];

	/**
	 * Hooks up one status menu; a second call does nothing.
	 * @param {HTMLElement} menu  the [data-basalt-status-menu] wrapper
	 */
	function mountStatusMenu(menu) {
		if (menu.dataset.basaltStatusReady) return;
		menu.dataset.basaltStatusReady = 'true';
		const pill = menu.querySelector('.basalt-status');
		const caption = menu.querySelector('[data-basalt-status-label]');
		if (!pill || !caption) return;
		const region = menu.closest('.card, section, main') || document;
		const announcer = region.querySelector('[data-basalt-status-live]');

		for (const choice of menu.querySelectorAll('[data-status]')) {
			choice.addEventListener('click', () => applyStatus(choice));
		}

		function applyStatus(choice) {
			const { status } = choice.dataset;
			const next = choice.textContent.trim();
			const previous = caption.textContent.trim();
			const pillLabel = pill.getAttribute('aria-label') || '';

			pill.classList.remove(...STATUS_TINTS.map((tint) => `basalt-status-${tint}`));
			if (STATUS_TINTS.includes(status)) pill.classList.add(`basalt-status-${status}`);
			caption.textContent = next;
			pill.setAttribute('aria-label', pillLabel.replace(/status: [^.]*\./, `status: ${next}.`));
			markCurrent(choice);

			if (previous !== next) {
				replay(pill, 'is-changed');
				const subject = pillLabel.split(' status')[0] || 'Status';
				if (announcer) announcer.textContent = `${subject} changed from ${previous} to ${next}.`;
				const detail = { status, label: next };
				menu.dispatchEvent(new CustomEvent('basalt:statuschange', { bubbles: true, detail }));
			}
			pill.focus();
		}

		function markCurrent(chosen) {
			for (const choice of menu.querySelectorAll('[data-status]')) {
				const isChosen = choice === chosen;
				choice.classList.toggle('active', isChosen);
				if (isChosen) choice.setAttribute('aria-current', 'true');
				else choice.removeAttribute('aria-current');
			}
		}
	}

	/**
	 * Sets a .basalt-count corner counter to `n`. Past 99 it reads "99+", at
	 * zero it hides, and a rise plays the bump. Dot counters only show or hide.
	 * Published as window.Basalt.count(el, n).
	 * @param {HTMLElement} badge
	 * @param {number} n
	 */
	function setCounter(badge, n) {
		if (!badge) return;
		const previous = parseInt(badge.dataset.count || badge.textContent.trim(), 10) || 0;
		const total = Math.max(0, n | 0);
		badge.dataset.count = String(total);
		if (!badge.classList.contains('basalt-count-dot')) badge.textContent = total > 99 ? '99+' : String(total);
		badge.hidden = total === 0;
		if (total > previous) replay(badge, 'is-bumping');
	}
})();

/**
 * Avatar patterns, all demonstrated on avatars.html.
 *
 * [data-basalt-avatar] data-name="..."  initials plus one of eight tones,
 *   derived from the name so the same person always gets the same color;
 *   window.Basalt.avatar(el) repaints a single one.
 * [data-basalt-avatar-group] data-max="5"  keeps that many faces and folds
 *   the rest into a "+N" button listing them; el.basaltAvatarGroup.set(max)
 *   moves the cut-off later.
 * [data-basalt-avatar-edit]  the camera button, or an image dropped on the
 *   face, swaps the photo behind a filling ring. Nothing leaves the browser.
 *   Fires 'basalt:avatarchange'.
 * [data-basalt-presence]  a menu of data-presence="online|away|busy|offline"
 *   items that sets the status dot. Fires 'basalt:presencechange'.
 *
 * Markup rendered after load is picked up with window.Basalt.avatars(root).
 */
(() => {
	'use strict';
	const DOT_STATES = ['online', 'away', 'busy'];

	/**
	 * Paints, groups and wires every avatar pattern under `scope`, or under the
	 * whole document when it is left out. Safe to repeat on the same markup.
	 * @param {ParentNode} [scope]
	 */
	window.Basalt.avatars = (scope) => {
		const host = scope || document;
		for (const face of host.querySelectorAll('[data-basalt-avatar]')) paintAvatar(face);
		for (const group of host.querySelectorAll('[data-basalt-avatar-group]')) mountAvatarGroup(group);
		for (const box of host.querySelectorAll('[data-basalt-avatar-edit]')) mountAvatarEditor(box);
		for (const picker of host.querySelectorAll('[data-basalt-presence]')) mountPresence(picker);
	};
	window.Basalt.avatar = window.Basalt.avatar || paintAvatar;
	document.addEventListener('DOMContentLoaded', () => window.Basalt.avatars());

	function motionOff() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function countWord(count, single, several) {
		return `${count} ${count === 1 ? single : several}`;
	}

	/* Generated avatar [data-basalt-avatar]: the initials and the tone both
     come from data-name, so one name always looks the same wherever it shows. */

	/**
	 * Repaints one generated avatar from its data-name; window.Basalt.avatar(el).
	 * A face that already holds an <img> keeps it and only takes the tone.
	 * @param {HTMLElement} face
	 * @returns {{initials: string, tone: number}}
	 */
	function paintAvatar(face) {
		const name = face.getAttribute('data-name') || '';
		const letters = monogram(name);
		const tone = toneFor(name);
		const staleTones = [...face.classList].filter((token) => /^basalt-avatar-tone-\d$/.test(token));
		face.classList.remove(...staleTones);
		face.classList.add(`basalt-avatar-tone-${tone}`);
		if (!face.querySelector('img')) face.textContent = letters;
		return { initials: letters, tone };
	}

	/* First letter of the first and last words; a single word gives its first two letters.
	   A title in front (Dr., Prof.) is not part of the person's initials. */
	function monogram(name) {
		const words = String(name || '')
			.trim()
			.split(/\s+/)
			.filter(Boolean);
		if (words.length > 2 && /^(dr|prof|mr|mrs|ms|mx)\.?$/i.test(words[0])) words.shift();
		if (words.length === 0) return '?';
		const opening = [...words[0]];
		const closing = words.length > 1 ? [...words.at(-1)][0] : opening[1] || '';
		return `${opening[0] || ''}${closing}`.toUpperCase();
	}

	/* A stable 1-8 bucket: a 31-multiplier hash over the name's UTF-16 units. */
	function toneFor(name) {
		const key = String(name || '')
			.trim()
			.toLowerCase();
		const hash = key.split('').reduce((sum, unit) => (sum * 31 + unit.charCodeAt(0)) >>> 0, 0);
		return (hash % 8) + 1;
	}

	/* Avatar group [data-basalt-avatar-group] data-max="5": the first data-max
     faces stay, the rest hide behind a "+N" button whose dropdown lists each
     hidden person by data-name and data-meta. */

	/**
	 * Sets up one overflowing group and exposes el.basaltAvatarGroup.set(max),
	 * which returns how many faces ended up hidden.
	 * @param {HTMLElement} group
	 */
	function mountAvatarGroup(group) {
		if (group.basaltAvatarGroup) return;
		const faces = [...group.querySelectorAll(':scope > .basalt-avatar')];
		const overflowButton = group.querySelector('.basalt-avatar-group-more');
		const overflowList = group.querySelector('.basalt-avatar-roster');
		group.basaltAvatarGroup = { set: setLimit };
		setLimit(group.dataset.max);

		function setLimit(max) {
			const cap = Math.max(1, Math.min(faces.length, parseInt(max, 10) || faces.length));
			/* A single face over the cap is shown outright rather than as "+1". */
			const visible = faces.length - cap === 1 ? faces.length : cap;
			const extras = faces.slice(visible);
			for (const [index, face] of faces.entries()) face.hidden = index >= visible;
			group.dataset.max = String(cap);
			if (!overflowButton) return extras.length;
			const summary = countWord(extras.length, 'more person', 'more people');
			overflowButton.parentElement.hidden = extras.length === 0;
			overflowButton.textContent = `+${extras.length}`;
			overflowButton.setAttribute('aria-label', `Show ${summary}`);
			if (overflowList) {
				const heading = document.createElement('li');
				heading.append(make('span', 'dropdown-header', summary));
				overflowList.replaceChildren(heading, ...extras.map(rosterEntry));
			}
			return extras.length;
		}
	}

	/* One dropdown row for a hidden face: a small copy of it, then name and meta. */
	function rosterEntry(face) {
		const link = make('a', 'dropdown-item');
		link.href = face.getAttribute('href') || '#';
		const mini = make(
			'span',
			`${face.className.replace(/\bavatar-(lg|xl|xxl)\b/g, '')} basalt-avatar-sm`,
			face.textContent.trim(),
		);
		mini.setAttribute('aria-hidden', 'true');
		const words = make('span');
		words.append(
			make('span', 'basalt-avatar-roster-name', face.dataset.name || face.getAttribute('aria-label') || ''),
			make('span', 'basalt-avatar-roster-meta', face.dataset.meta || ''),
		);
		link.append(mini, words);
		const row = document.createElement('li');
		row.append(link);
		return row;
	}

	function make(tag, className, text) {
		const node = document.createElement(tag);
		if (className) node.className = className;
		if (text) node.textContent = text;
		return node;
	}

	/* Editable avatar [data-basalt-avatar-edit]: [data-basalt-avatar-edit-pick]
     opens the file picker and a dropped image works as well. The ring fills
     while the file is read; the photo only lives in this tab. Fires
     "basalt:avatarchange" with { file }. */

	/**
	 * Wires one editable avatar; a second call does nothing.
	 * @param {HTMLElement} box  the [data-basalt-avatar-edit] wrapper
	 */
	function mountAvatarEditor(box) {
		if (box.dataset.basaltAvatarEditReady) return;
		box.dataset.basaltAvatarEditReady = 'true';
		const frame = box.querySelector('.basalt-avatar-edit');
		const face = box.querySelector('[data-basalt-avatar-edit-target]');
		const picker = box.querySelector('[data-basalt-avatar-edit-input]');
		const clearButton = box.querySelector('[data-basalt-avatar-edit-remove]');
		const note = box.querySelector('[data-basalt-avatar-edit-status]');
		const ring = box.querySelector('.basalt-avatar-edit-ring');
		if (!frame || !face || !picker) return;
		const initialsText = face.textContent.trim();
		let photoSrc = null;

		for (const opener of box.querySelectorAll('[data-basalt-avatar-edit-pick]')) {
			opener.addEventListener('click', () => picker.click());
		}
		picker.addEventListener('change', onPicked);
		clearButton?.addEventListener('click', dropPhoto);
		for (const type of ['dragenter', 'dragover']) frame.addEventListener(type, onDragOver);
		for (const type of ['dragleave', 'drop']) {
			frame.addEventListener(type, () => frame.classList.remove('is-dragging'));
		}
		frame.addEventListener('drop', onDrop);

		function tell(text) {
			if (note) note.textContent = text;
		}

		function ringFill(percent) {
			ring.style.setProperty('--value', String(percent));
		}

		function onPicked() {
			const file = picker.files[0];
			if (file) readPhoto(file);
			picker.value = '';
		}

		function onDragOver(event) {
			event.preventDefault();
			frame.classList.add('is-dragging');
		}

		function onDrop(event) {
			event.preventDefault();
			const file = event.dataTransfer?.files[0];
			if (file) readPhoto(file);
		}

		function readPhoto(file) {
			if (!file || !file.type.startsWith('image/')) {
				tell('That file is not an image. Try a JPG, PNG or WebP.');
				return;
			}
			if (file.size > 5 * 1024 * 1024) {
				tell('That image is over 5 MB. Pick a smaller one.');
				return;
			}
			const loader = new FileReader();
			frame.classList.add('is-loading');
			frame.setAttribute('aria-busy', 'true');
			tell(`Loading ${file.name}…`);
			loader.onprogress = (event) => {
				if (event.lengthComputable && ring) ringFill(Math.round((event.loaded / event.total) * 100));
			};
			loader.onload = () => {
				if (motionOff() || !ring) showPhoto(file);
				else sweepRing(() => showPhoto(file));
			};
			loader.onerror = () => {
				frame.classList.remove('is-loading');
				tell('The image could not be read.');
			};
			loader.readAsArrayBuffer(file);
		}

		/* Runs the ring to full in 6% frames, then holds briefly, so even a tiny
       file shows it before `then` swaps the photo in. */
		function sweepRing(then) {
			let filled = 0;
			requestAnimationFrame(function advance() {
				filled = Math.min(100, filled + 6);
				ringFill(filled);
				if (filled < 100) requestAnimationFrame(advance);
				else setTimeout(then, 120);
			});
		}

		function showPhoto(file) {
			if (photoSrc) URL.revokeObjectURL(photoSrc);
			photoSrc = URL.createObjectURL(file);
			const img = document.createElement('img');
			img.src = photoSrc;
			img.alt = '';
			face.replaceChildren(img);
			face.setAttribute('aria-label', `Profile photo: ${file.name}`);
			frame.classList.remove('is-loading');
			frame.removeAttribute('aria-busy');
			if (ring) ringFill(0);
			if (clearButton) clearButton.disabled = false;
			tell(`Photo changed to ${file.name}.`);
			box.dispatchEvent(new CustomEvent('basalt:avatarchange', { bubbles: true, detail: { file } }));
		}

		function dropPhoto() {
			if (photoSrc) URL.revokeObjectURL(photoSrc);
			photoSrc = null;
			face.textContent = initialsText;
			face.setAttribute('aria-label', 'Profile photo: none, showing initials');
			clearButton.disabled = true;
			tell('Photo removed. Showing initials.');
			box.querySelector('[data-basalt-avatar-edit-pick]').focus();
			box.dispatchEvent(new CustomEvent('basalt:avatarchange', { bubbles: true, detail: { file: null } }));
		}
	}

	/* Presence picker [data-basalt-presence]: items carrying
     data-presence="online|away|busy|offline" update the dot, the label and the
     toggle's aria-label, then fire "basalt:presencechange" with { presence }. */

	/**
	 * Wires one presence menu; a second call does nothing.
	 * @param {HTMLElement} picker  the [data-basalt-presence] wrapper
	 */
	function mountPresence(picker) {
		if (picker.dataset.basaltPresenceReady) return;
		picker.dataset.basaltPresenceReady = 'true';
		const dot = picker.querySelector('[data-basalt-presence-dot]');
		const caption = picker.querySelector('[data-basalt-presence-label]');
		const trigger = picker.querySelector('[data-bs-toggle="dropdown"]');
		const announcer = picker.parentElement.querySelector('[data-basalt-presence-live]');

		for (const option of picker.querySelectorAll('[data-presence]')) {
			option.addEventListener('click', () => choose(option));
		}

		function choose(option) {
			const { presence } = option.dataset;
			const text = option.textContent.trim();
			if (dot) {
				dot.classList.remove(...DOT_STATES.map((state) => `basalt-avatar-status-dot-${state}`));
				if (DOT_STATES.includes(presence)) dot.classList.add(`basalt-avatar-status-dot-${presence}`);
			}
			if (caption) caption.textContent = text;
			if (trigger) {
				trigger.setAttribute('aria-label', `Your status: ${text}. Change status`);
				trigger.focus();
			}
			for (const other of picker.querySelectorAll('[data-presence]')) {
				other.classList.toggle('active', other === option);
				if (other !== option) other.removeAttribute('aria-current');
				else other.setAttribute('aria-current', 'true');
			}
			if (announcer) announcer.textContent = `Your status is now ${text}.`;
			picker.dispatchEvent(new CustomEvent('basalt:presencechange', { bubbles: true, detail: { presence } }));
		}
	}
})();

/**
 * Dialog patterns demonstrated on modals.html.
 *  - [data-basalt-dialog-steps] on a dialog's <form>: numbered steps made of
 *    [data-basalt-step-panel] panels with back, next and finish buttons;
 *    next validates the open panel only. Fires 'basalt:steps-done' and
 *    exposes form.basaltSteps.reset().
 *  - [data-basalt-type-confirm="phrase"]: the action unlocks once the phrase
 *    is typed exactly. wrap.basaltTyped.reset().
 *  - [data-basalt-modal-guard] on a .modal with a form: closing it with
 *    unsaved edits asks first. modal.basaltGuard.release().
 *  - [data-basalt-lightbox-set="#modal"]: a picture viewer driven by arrow
 *    keys, thumbnails and swipes.
 * window.Basalt.dialog also offers done(content, text) / clearDone(content)
 * for the success block, flagFields(fields) / clearFlags(root) for invalid
 * fields, busy(btn, on) for a spinner button, and init(root) for dialogs
 * added after the page loaded.
 */
(() => {
	'use strict';
	if (!window.bootstrap) return;

	const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
	const DIALOG_PARTS = [
		{ selector: '[data-basalt-dialog-steps]', wire: wireSteps, wired: new WeakSet() },
		{ selector: '[data-basalt-type-confirm]', wire: wireTypedConfirm, wired: new WeakSet() },
		{ selector: '[data-basalt-modal-guard]', wire: wireCloseGuard, wired: new WeakSet() },
		{ selector: '[data-basalt-lightbox-set]', wire: wireLightbox, wired: new WeakSet() },
	];

	function start() {
		window.Basalt.dialog = {
			done: revealSuccess,
			clearDone: hideSuccess,
			flagFields: markInvalid,
			clearFlags: unmarkInvalid,
			busy: toggleBusy,
			init: scanDialogs,
		};
		document.addEventListener('DOMContentLoaded', () => window.Basalt.dialog.init());
	}

	/**
	 * Wires every dialog pattern found inside a part of the page, once each.
	 * @param {ParentNode} [scope=document] Where to look.
	 */
	function scanDialogs(scope) {
		for (const { selector, wire, wired } of DIALOG_PARTS) {
			for (const node of pickAll(selector, scope)) {
				if (wired.has(node)) continue;
				wired.add(node);
				wire(node);
			}
		}
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function modalFor(node) {
		return bootstrap.Modal.getOrCreateInstance(node);
	}

	/* Success state, field errors and the busy button are public helpers
     that page scripts call on their own dialogs. */

	/**
	 * Replaces a dialog's regular parts with its .basalt-done block and
	 * focuses the block's title so screen readers announce the change.
	 * @param {Element} content The .modal-content (or any box) holding a .basalt-done block.
	 * @param {string} [text] Optional message for the block's [data-md-done-text] line.
	 */
	function revealSuccess(content, text) {
		const block = pick('.basalt-done', content);
		if (!block) return;
		const line = text ? pick('[data-md-done-text]', block) : null;
		if (line) line.textContent = text;
		block.hidden = false;
		content.classList.add('is-done');
		pick('.basalt-done-title', block)?.focus();
	}

	/**
	 * Undoes revealSuccess, bringing the dialog's regular parts back.
	 * @param {Element} content The same box that was passed to done().
	 */
	function hideSuccess(content) {
		content.classList.remove('is-done');
		const block = pick('.basalt-done', content);
		if (block) block.hidden = true;
	}

	/**
	 * Flags every field that breaks its own constraints with .is-invalid (so
	 * its .invalid-feedback shows) and lifts the flag as soon as it is fixed.
	 * Radios, checkboxes and disabled fields are left alone.
	 * @param {Iterable<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>} fields
	 * @returns {Element|null} The first field that failed, or null.
	 */
	function markInvalid(fields) {
		let firstBad = null;
		for (const field of fields) {
			if (field.disabled || field.type === 'checkbox' || field.type === 'radio') continue;
			const failing = !field.checkValidity();
			flagField(field, failing);
			firstBad ??= failing ? field : null;
			watchUntilFixed(field);
		}
		return firstBad;
	}

	function flagField(field, failing) {
		field.classList.toggle('is-invalid', failing);
		field.setAttribute('aria-invalid', String(failing));
	}

	function watchUntilFixed(field) {
		if (field.basaltRecheck) return;
		field.basaltRecheck = true;
		field.addEventListener('input', () => {
			if (field.classList.contains('is-invalid')) flagField(field, !field.checkValidity());
		});
	}

	/**
	 * Removes every .is-invalid flag (and its aria-invalid) inside a box.
	 * @param {ParentNode} [scope=document]
	 */
	function unmarkInvalid(scope) {
		for (const field of pickAll('.is-invalid', scope)) {
			field.classList.remove('is-invalid');
			field.removeAttribute('aria-invalid');
		}
	}

	/**
	 * Turns a button's working state on or off. While on, it is disabled
	 * and shows a spinner beside its data-busy-label (or "Working…"); off
	 * restores exactly what it showed before.
	 * @param {HTMLButtonElement} button
	 * @param {boolean} working
	 */
	function toggleBusy(button, working) {
		if (!working) {
			if (button.basaltRestingHtml == null) return;
			button.innerHTML = button.basaltRestingHtml;
			button.basaltRestingHtml = null;
			button.disabled = false;
			button.classList.remove('is-busy');
			button.removeAttribute('aria-busy');
			return;
		}
		button.basaltRestingHtml ??= button.innerHTML;
		button.disabled = true;
		button.classList.add('is-busy');
		button.setAttribute('aria-busy', 'true');
		const label = button.getAttribute('data-busy-label') || 'Working…';
		button.innerHTML = `<span aria-hidden="true" class="spinner-border"></span>${label}`;
	}

	/* Stepped dialog: [data-basalt-dialog-steps] sits on the dialog's form.
     Panels are [data-basalt-step-panel]; the buttons are
     [data-basalt-step-back], [data-basalt-step-next] and
     [data-basalt-step-finish]. Next only validates the panel in view.
     On the last panel each [data-basalt-step-summary="name"] shows what
     the field of that name holds, a date written out in words. Finishing fires 'basalt:steps-done'. */
	function wireSteps(form) {
		const markers = pickAll('.basalt-dialog-steps-item', form);
		const panels = pickAll('[data-basalt-step-panel]', form);
		const controls = {
			back: pick('[data-basalt-step-back]', form),
			next: pick('[data-basalt-step-next]', form),
			finish: pick('[data-basalt-step-finish]', form),
		};
		const progress = pick('[data-basalt-steps-status]', form);
		const lastIndex = panels.length - 1;
		let current = 0;

		controls.next?.addEventListener('click', advance);
		controls.back?.addEventListener('click', () => showStep(current - 1, true));
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			/* Enter inside a field moves forward until the final step. */
			if (current < lastIndex) advance();
			else form.dispatchEvent(new CustomEvent('basalt:steps-done', { bubbles: true }));
		});
		form.basaltSteps = {
			/** Clears the form and its error flags and returns to step one. */
			reset() {
				form.reset();
				unmarkInvalid(form);
				showStep(0, false);
			},
		};
		showStep(0, false);

		function advance() {
			const firstBad = markInvalid(pickAll('input, select, textarea', panels[current]));
			if (firstBad) firstBad.focus();
			else showStep(current + 1, true);
		}

		function showStep(index, moveFocus) {
			current = Math.max(0, Math.min(lastIndex, index));
			const onLast = current === lastIndex;
			for (const [position, panel] of panels.entries()) panel.hidden = position !== current;
			for (const [position, marker] of markers.entries()) {
				marker.classList.toggle('is-done', position < current);
				if (position === current) marker.setAttribute('aria-current', 'step');
				else marker.removeAttribute('aria-current');
			}
			if (controls.back) controls.back.hidden = current === 0;
			if (controls.next) controls.next.hidden = onLast;
			if (controls.finish) controls.finish.hidden = !onLast;
			if (onLast) fillSummary();

			const title = markers[current] ? pick('.basalt-dialog-steps-label', markers[current]).textContent : '';
			if (progress) progress.textContent = `Step ${current + 1} of ${panels.length}: ${title}`;
			if (moveFocus) focusStep(onLast);
		}

		function focusStep(onLast) {
			const entry = pick(
				'input:not([type="hidden"]):checked, input:not([type="radio"]):not([type="hidden"]), select, textarea',
				panels[current],
			);
			const fallback = onLast ? controls.finish || controls.next : null;
			const target = entry && !entry.closest('.basalt-select') ? entry : fallback;
			target?.focus();
		}

		function fillSummary() {
			for (const slot of pickAll('[data-basalt-step-summary]', form)) {
				slot.textContent = answerFor(slot.getAttribute('data-basalt-step-summary'));
			}
		}

		function answerFor(name) {
			const field = form.elements[name];
			if (!field) return '';
			if ((field.type === 'date' || field.type === 'hidden') && /^\d{4}-\d{2}-\d{2}$/.test(field.value)) {
				const [year, month, day] = field.value.split('-').map(Number);
				return new Date(year, month - 1, day).toLocaleDateString('en-US', {
					weekday: 'long',
					month: 'long',
					day: 'numeric',
					year: 'numeric',
				});
			}
			if (field.tagName !== 'SELECT') return (field.value || '').trim();
			return field.options[field.selectedIndex]?.text ?? '';
		}
	}

	/* Typed confirmation: [data-basalt-type-confirm="phrase"] wraps the
     input. The button it unlocks is the dialog's
     [data-basalt-type-confirm-action], or whatever data-target names. */
	function wireTypedConfirm(wrap) {
		const phrase = wrap.getAttribute('data-basalt-type-confirm');
		const field = pick('input', wrap);
		const hint = pick('.basalt-type-confirm-state', wrap);
		const targetSelector = wrap.getAttribute('data-target');
		const action = targetSelector
			? pick(targetSelector)
			: pick('[data-basalt-type-confirm-action]', wrap.closest('.modal-content') || document);

		field.addEventListener('input', compare);
		field.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' || !action || action.disabled) return;
			event.preventDefault();
			action.click();
		});
		wrap.basaltTyped = {
			/** Empties the field and locks the action again. */
			reset() {
				field.value = '';
				compare();
			},
		};
		compare();

		/** Length of the stretch at the start of the typed text that matches the phrase. */
		function matchingPrefix(typed) {
			const limit = Math.min(typed.length, phrase.length);
			let length = 0;
			while (length < limit && typed[length] === phrase[length]) length += 1;
			return length;
		}

		function compare() {
			const typed = field.value;
			const agreed = matchingPrefix(typed);
			const exact = typed === phrase;
			const strayed = typed.length > agreed;
			wrap.style.setProperty('--basalt-match', String(exact ? 1 : agreed / phrase.length));
			wrap.classList.toggle('is-match', exact);
			wrap.classList.toggle('is-wrong', strayed);
			field.setAttribute('aria-invalid', String(strayed));
			if (action) action.disabled = !exact;
			if (!hint) return;
			if (!typed) hint.textContent = 'Nothing typed yet.';
			else if (exact) hint.textContent = 'That matches. The button is ready.';
			else if (strayed)
				hint.textContent = `Stops matching at letter ${agreed + 1}. Check the capitals and spaces.`;
			else hint.textContent = `${agreed} of ${phrase.length} letters match.`;
		}
	}

	/* Unsaved-changes guard: [data-basalt-modal-guard] on a .modal holding a
     form. While the form differs from how it looked on opening, every way
     out (Esc, the backdrop, a dismiss button) brings up .basalt-modal-guard
     instead. [data-basalt-guard-keep] returns to the form and
     [data-basalt-guard-discard] closes, dropping the edits. */
	function wireCloseGuard(modal) {
		const form = pick('form', modal);
		const prompt = pick('.basalt-modal-guard', modal);
		if (!form || !prompt) return;
		const content = pick('.modal-content', modal);
		const keepButton = pick('[data-basalt-guard-keep]', prompt);
		const discardButton = pick('[data-basalt-guard-discard]', prompt);
		let openedWith = '';
		let mayClose = false;

		modal.addEventListener('shown.bs.modal', () => {
			openedWith = fingerprint();
			mayClose = false;
		});
		modal.addEventListener('hide.bs.modal', (event) => {
			if (mayClose || content.classList.contains('is-done') || fingerprint() === openedWith) return;
			event.preventDefault();
			prompt.hidden = false;
			/* Drop and re-add the class so the nudge plays again on every try. */
			content.classList.remove('is-guarding');
			void content.offsetWidth;
			if (!motionQuery.matches) content.classList.add('is-guarding');
			keepButton?.focus();
		});
		content.addEventListener('animationend', () => content.classList.remove('is-guarding'));
		keepButton?.addEventListener('click', () => {
			prompt.hidden = true;
			pick('input, select, textarea', form)?.focus();
		});
		discardButton?.addEventListener('click', () => {
			mayClose = true;
			modalFor(modal).hide();
		});
		modal.addEventListener('hidden.bs.modal', () => {
			prompt.hidden = true;
			mayClose = false;
		});
		modal.basaltGuard = {
			/** Lets the next close through without asking, for a save that closes the dialog. */
			release() {
				mayClose = true;
			},
		};

		function fingerprint() {
			const values = pickAll('input, select, textarea', form).map((field) => {
				const toggles = field.type === 'checkbox' || field.type === 'radio';
				return toggles ? field.checked : field.value;
			});
			return values.join('\u0001');
		}
	}

	/* Lightbox: [data-basalt-lightbox-set="#modal"] around
     [data-basalt-lightbox-item] buttons carrying data-caption and
     data-note. The first child of each button is the picture shown large.
     Arrow keys, the side buttons, the thumbnails and a swipe all move
     through the set. */
	function wireLightbox(gallery) {
		const modal = pick(gallery.getAttribute('data-basalt-lightbox-set'));
		if (!modal) return;
		const frames = pickAll('[data-basalt-lightbox-item]', gallery);
		const view = {
			stage: pick('[data-basalt-lightbox-stage]', modal),
			caption: pick('[data-basalt-lightbox-caption]', modal),
			note: pick('[data-basalt-lightbox-note]', modal),
			counter: pick('[data-basalt-lightbox-count]', modal),
			strip: pick('[data-basalt-lightbox-thumbs]', modal),
		};
		const stepButtons = {
			back: pick('[data-basalt-lightbox-prev]', modal),
			forward: pick('[data-basalt-lightbox-next]', modal),
		};
		const ARROWS = new Map([
			['ArrowLeft', -1],
			['ArrowRight', 1],
		]);
		let shownIndex = 0;
		let returnTo = null;
		let swipeStartX = null;

		const thumbs = frames.map(thumbFor);
		for (const [index, frame] of frames.entries()) {
			frame.addEventListener('click', () => {
				returnTo = frame;
				present(index, 0);
				modalFor(modal).show();
			});
		}
		stepButtons.back?.addEventListener('click', () => present(shownIndex - 1, -1));
		stepButtons.forward?.addEventListener('click', () => present(shownIndex + 1, 1));
		modal.addEventListener('keydown', (event) => {
			const direction = ARROWS.get(event.key);
			if (!direction) return;
			event.preventDefault();
			present(shownIndex + direction, direction);
		});
		view.stage.addEventListener('pointerdown', (event) => {
			if (event.pointerType !== 'mouse') swipeStartX = event.clientX;
		});
		view.stage.addEventListener('pointerup', (event) => {
			if (swipeStartX == null) return;
			const travel = event.clientX - swipeStartX;
			swipeStartX = null;
			if (Math.abs(travel) <= 50) return;
			const direction = travel < 0 ? 1 : -1;
			present(shownIndex + direction, direction);
		});
		modal.addEventListener('shown.bs.modal', () => stepButtons.forward?.focus());
		modal.addEventListener('hidden.bs.modal', () => returnTo?.focus());

		function thumbFor(frame, index) {
			const thumb = document.createElement('button');
			thumb.className = 'basalt-lightbox-thumb';
			thumb.type = 'button';
			thumb.setAttribute('aria-label', `Picture ${index + 1}: ${frame.getAttribute('data-caption')}`);
			thumb.append(frame.firstElementChild.cloneNode(true));
			thumb.addEventListener('click', () => present(index, index < shownIndex ? -1 : 1));
			view.strip?.append(thumb);
			return thumb;
		}

		/** Shows picture `index` (wrapping round), sliding in from the side `direction` points to. */
		function present(index, direction) {
			shownIndex = (index + frames.length) % frames.length;
			const frame = frames[shownIndex];
			const caption = frame.getAttribute('data-caption');
			pick('.basalt-lightbox-slide', view.stage)?.remove();

			const slide = document.createElement('div');
			slide.setAttribute('aria-label', caption);
			slide.setAttribute('role', 'img');
			slide.className = direction < 0 ? 'basalt-lightbox-slide is-back' : 'basalt-lightbox-slide';
			slide.append(frame.firstElementChild.cloneNode(true));
			view.stage.prepend(slide);

			if (view.caption) view.caption.textContent = caption;
			if (view.note) view.note.textContent = frame.getAttribute('data-note') || '';
			if (view.counter) view.counter.textContent = `${shownIndex + 1} / ${frames.length}`;
			for (const [position, thumb] of thumbs.entries())
				thumb.setAttribute('aria-current', String(position === shownIndex));
			thumbs[shownIndex].scrollIntoView({ block: 'nearest', inline: 'nearest' });
		}
	}

	start();
})();

/**
 * Off-canvas panel patterns demonstrated on offcanvas.html.
 *  - [data-basalt-drawer-views]: nested menu levels in one drawer;
 *    [data-basalt-view-go="name"] opens a level, [data-basalt-view-back]
 *    climbs one, and closing the drawer returns to the top.
 *  - [data-basalt-sheet] with data-snap="50 92": a bottom sheet with a grab
 *    handle that rests at those heights (percent of the window).
 *  - [data-basalt-drawer-resize] with data-min and data-max: a grip that
 *    widens or narrows the drawer by pointer or arrow keys and remembers
 *    the width per drawer id. Fires 'basalt:resize'.
 *  - [data-basalt-push]: a side panel that shifts the content over, opened
 *    and closed by [data-basalt-push-toggle].
 *  - window.Basalt.drawer.recordNav(drawer, count, render): previous and next
 *    record inside a drawer, also on Alt+Up and Alt+Down.
 *  - window.Basalt.drawer.applied(box, items, clearAll, fallback): renders
 *    removable .basalt-applied chips for the active filters.
 * Clicks on a static backdrop hand focus back to the panel, and panels
 * added after load are picked up by window.Basalt.drawer.init(root).
 */
(() => {
	'use strict';
	if (!window.bootstrap) return;

	/* Static backdrop focus: a click on a static backdrop is refused, but it
     still pulls focus out to the page behind, where Esc and Tab no longer
     reach the panel. Once that click has settled, focus returns inside. */
	document.addEventListener('hidePrevented.bs.offcanvas', ({ target: refusedPanel }) => {
		setTimeout(() => {
			if (refusedPanel.contains(document.activeElement)) return;
			refusedPanel.focus();
		}, 0);
	});

	/* Bootstrap gives focus back on close only when a data-bs-toggle control
     did the opening. Dialogs and panels shown from a script note whoever
     held focus as they open and hand it back once they are hidden, unless
     the page has meanwhile sent focus somewhere deliberate. */
	const focusBeforeOpen = new WeakMap();
	const dialogShowEvents = ['show.bs.modal', 'show.bs.offcanvas'];
	const dialogHiddenEvents = ['hidden.bs.modal', 'hidden.bs.offcanvas'];

	for (const type of dialogShowEvents) {
		document.addEventListener(type, ({ target: dialog }) => {
			if (focusIsLoose(dialog)) return;
			focusBeforeOpen.set(dialog, document.activeElement);
		});
	}

	for (const type of dialogHiddenEvents) {
		document.addEventListener(type, ({ target: dialog }) => {
			const returnTo = focusBeforeOpen.get(dialog);
			focusBeforeOpen.delete(dialog);
			if (!returnTo?.isConnected || !focusIsLoose(dialog)) return;
			if (!isOnScreen(returnTo)) return;
			const stillOpen = document.querySelector('.modal.show, .offcanvas.show');
			if (stillOpen && !stillOpen.contains(returnTo)) return;
			returnTo.focus({ preventScroll: true });
		});
	}

	/** True when focus sits nowhere useful: on the body, or inside `dialog`. */
	function focusIsLoose(dialog) {
		const holder = document.activeElement;
		return !holder || holder === document.body || dialog.contains(holder);
	}

	function isOnScreen(node) {
		return node.checkVisibility ? node.checkVisibility() : Boolean(node.offsetParent);
	}

	/* The drawer kinds below are matched by attribute, each bound at most
     once per element; the flag property is what records the binding. */
	const drawerKinds = [
		['[data-basalt-drawer-views]', '_basaltViews', wireDrillViews],
		['[data-basalt-sheet]', '_basaltSheet', wireBottomSheet],
		['[data-basalt-drawer-resize]', '_basaltResize', wireWidthGrip],
		['[data-basalt-push]', '_basaltPush', wirePushPanel],
	];

	const drawerApi = {
		/**
		 * Binds every drawer kind found under `root` that is not bound yet.
		 * Runs for the whole document on load; call it again for markup
		 * added later.
		 * @param {ParentNode} [root=document]
		 */
		init(root) {
			const scope = root || document;
			for (const [selector, flag, wire] of drawerKinds) {
				for (const node of scope.querySelectorAll(selector)) {
					if (node[flag]) continue;
					node[flag] = true;
					wire(node);
				}
			}
		},
		recordNav: stepThroughRecords,
		applied: renderFilterChips,
	};

	window.Basalt.drawer = drawerApi;
	document.addEventListener('DOMContentLoaded', () => drawerApi.init());

	/* Drill-in drawer: the .basalt-drawer-views-view children (each with
     data-view and data-title) are levels, the first being the top one.
     [data-basalt-view-go="name"] goes down a level, [data-basalt-view-back]
     or Alt+Left comes up, and the title and trail slots follow along.
     Closing the drawer always lands back on the top level. */
	function wireDrillViews(drawer) {
		const levels = [...drawer.querySelectorAll('.basalt-drawer-views-view')];
		const levelNamed = new Map();
		for (const level of levels) levelNamed.set(level.getAttribute('data-view'), level);
		const heading = drawer.querySelector('[data-basalt-view-title]');
		const crumbs = drawer.querySelector('[data-basalt-view-trail]');
		const upControl = drawer.querySelector('[data-basalt-view-back]');
		const topCrumbs = crumbs ? crumbs.textContent : '';
		const path = [{ level: levels[0], opener: null }];

		drawer.addEventListener('click', (event) => {
			const link = event.target.closest('[data-basalt-view-go]');
			if (link) descend(link.getAttribute('data-basalt-view-go'), link);
		});
		upControl?.addEventListener('click', ascend);
		drawer.addEventListener('keydown', (event) => {
			if (!event.altKey || event.key !== 'ArrowLeft') return;
			event.preventDefault();
			ascend();
		});
		drawer.addEventListener('hidden.bs.offcanvas', () => {
			path.length = 1;
			showLevel(levels[0], 0);
		});

		function descend(name, opener) {
			const level = levelNamed.get(name);
			if (!level) return;
			path.push({ level, opener });
			showLevel(level, 1);
			level.querySelector('button, a')?.focus();
		}

		function ascend() {
			if (path.length < 2) return;
			const { opener } = path.pop();
			showLevel(path[path.length - 1].level, -1);
			opener?.focus();
		}

		/** Shows one level; a negative `direction` plays the slide backwards. */
		function showLevel(level, direction) {
			for (const other of levels) other.hidden = other !== level;
			level.classList.toggle('is-back', direction < 0);
			replayAnimation(level);
			if (heading) heading.textContent = level.getAttribute('data-title');
			if (crumbs)
				crumbs.textContent =
					path.length > 1
						? path
								.slice(0, -1)
								.map((step) => step.level.getAttribute('data-title'))
								.join(' / ')
						: topCrumbs;
			if (upControl) upControl.hidden = path.length < 2;
		}
	}

	/* Bottom sheet: an .offcanvas-bottom with a .basalt-sheet-handle button.
     data-snap lists the resting heights as percentages of the window,
     lowest first. Dragging the handle resizes it and a low release closes
     it; a click or Enter flips between the lowest and highest stop, and
     the arrow keys move one stop at a time. */
	function wireBottomSheet(sheet) {
		const grabber = sheet.querySelector('.basalt-sheet-handle');
		const stops = readSnapStops(sheet.getAttribute('data-snap'));
		const highest = stops.length - 1;
		let stopIndex = 0;
		let gesture = null;

		const keyMoves = {
			ArrowUp: () => restAt(stopIndex + 1),
			ArrowDown: () =>
				stopIndex === 0 ? bootstrap.Offcanvas.getOrCreateInstance(sheet).hide() : restAt(stopIndex - 1),
		};

		grabber.addEventListener('click', () => {
			if (gesture?.moved) return;
			restAt(stopIndex === highest ? 0 : highest);
		});
		grabber.addEventListener('keydown', (event) => {
			const move = keyMoves[event.key];
			if (!move) return;
			event.preventDefault();
			move();
		});
		grabber.addEventListener('pointerdown', (event) => {
			if (event.button !== 0) return;
			gesture = { startY: event.clientY, startHeight: sheet.getBoundingClientRect().height, moved: false };
			grabber.setPointerCapture(event.pointerId);
		});
		grabber.addEventListener('pointermove', (event) => {
			if (!gesture) return;
			const lift = gesture.startY - event.clientY;
			if (!gesture.moved && Math.abs(lift) < 4) return;
			gesture.moved = true;
			sheet.classList.add('is-dragging');
			const height = Math.max(60, Math.min(window.innerHeight * 0.97, gesture.startHeight + lift));
			sheet.style.setProperty('--bs-offcanvas-height', `${height}px`);
		});
		grabber.addEventListener('pointerup', release);
		grabber.addEventListener('pointercancel', release);
		sheet.addEventListener('show.bs.offcanvas', () => restAt(0));
		restAt(0);

		function restAt(index) {
			stopIndex = Math.max(0, Math.min(highest, index));
			sheet.style.setProperty('--bs-offcanvas-height', `${stops[stopIndex]}vh`);
			const atTop = stopIndex === highest;
			grabber.setAttribute('aria-expanded', String(atTop));
			grabber.setAttribute('aria-label', atTop ? 'Make the sheet shorter' : 'Make the sheet taller');
		}

		function release() {
			if (!gesture) return;
			sheet.classList.remove('is-dragging');
			if (gesture.moved) {
				const shownPct = (sheet.getBoundingClientRect().height / window.innerHeight) * 100;
				if (shownPct < stops[0] * 0.6) {
					restAt(0);
					bootstrap.Offcanvas.getOrCreateInstance(sheet).hide();
				} else {
					restAt(closestStop(stops, shownPct));
				}
			}
			/* The click that trails a drag still has to see `moved`; forget
         the gesture only after it. */
			setTimeout(() => {
				gesture = null;
			}, 0);
		}
	}

	function readSnapStops(spec) {
		return (spec || '50 92')
			.split(/\s+/)
			.map(Number)
			.filter((pct) => pct > 0)
			.sort((low, high) => low - high);
	}

	/** Index of the stop nearest `pct`; on a tie the lower stop wins. */
	function closestStop(stops, pct) {
		return stops.reduce(
			(best, stop, index) => (Math.abs(stop - pct) < Math.abs(stops[best] - pct) ? index : best),
			0,
		);
	}

	/* Resizable drawer: a .basalt-drawer-resize grip inside the panel, with
     optional data-min and data-max in pixels. The grip drags, or takes the
     arrow keys, Home and End once focused. Each drawer id remembers its
     width, and every change fires 'basalt:resize' carrying { width }. */
	function wireWidthGrip(drawer) {
		const grip = drawer.querySelector('.basalt-drawer-resize');
		if (!grip) return;
		const fromLeft = drawer.classList.contains('offcanvas-start');
		const narrowest = parseInt(drawer.getAttribute('data-min'), 10) || 320;
		const cap = parseInt(drawer.getAttribute('data-max'), 10) || 900;
		const memoryKey = `basalt-drawer-width:${drawer.id}`;
		const outward = fromLeft ? 'ArrowRight' : 'ArrowLeft';
		const inward = fromLeft ? 'ArrowLeft' : 'ArrowRight';
		let shownWidth = 0;
		let pull = null;

		grip.addEventListener('pointerdown', (event) => {
			if (event.button !== 0) return;
			pull = { startX: event.clientX, startWidth: drawer.getBoundingClientRect().width };
			grip.setPointerCapture(event.pointerId);
			grip.classList.add('is-dragging');
			drawer.classList.add('is-resizing');
		});
		grip.addEventListener('pointermove', (event) => {
			if (!pull) return;
			const travel = event.clientX - pull.startX;
			applyWidth(pull.startWidth + (fromLeft ? travel : -travel), false);
		});
		grip.addEventListener('pointerup', letGo);
		grip.addEventListener('pointercancel', letGo);
		grip.addEventListener('keydown', (event) => {
			const stride = event.shiftKey ? 96 : 32;
			const goals = {
				[outward]: shownWidth + stride,
				[inward]: shownWidth - stride,
				Home: narrowest,
				End: widest(),
			};
			if (!Object.hasOwn(goals, event.key)) return;
			event.preventDefault();
			applyWidth(goals[event.key], true);
		});
		drawer.addEventListener('show.bs.offcanvas', () => applyWidth(savedWidth(), false));
		applyWidth(savedWidth(), false);

		function widest() {
			return Math.max(narrowest, Math.min(cap, window.innerWidth - 48));
		}

		function savedWidth() {
			return parseInt(readSetting(memoryKey), 10) || Math.max(narrowest, 400);
		}

		/** Clamps and paints a width; `remember` also stores it for next time. */
		function applyWidth(requested, remember) {
			shownWidth = Math.round(Math.max(narrowest, Math.min(widest(), requested)));
			drawer.style.setProperty('--bs-offcanvas-width', `${shownWidth}px`);
			const slider = {
				'aria-valuemin': narrowest,
				'aria-valuemax': widest(),
				'aria-valuenow': shownWidth,
				'aria-valuetext': `${shownWidth} pixels wide`,
			};
			for (const [name, value] of Object.entries(slider)) grip.setAttribute(name, String(value));
			if (remember) writeSetting(memoryKey, String(shownWidth));
			drawer.dispatchEvent(new CustomEvent('basalt:resize', { detail: { width: shownWidth } }));
		}

		function letGo() {
			if (!pull) return;
			pull = null;
			grip.classList.remove('is-dragging');
			drawer.classList.remove('is-resizing');
			applyWidth(shownWidth, true);
		}
	}

	/* Push drawer: a .basalt-push-panel beside the content, opened and shut
     by a [data-basalt-push-toggle] button that names it. On narrow screens
     the panel starts shut, lies over the content, and shuts again on Esc
     or on a press anywhere outside it. */
	function wirePushPanel(layout) {
		const panel = layout.querySelector('.basalt-push-panel');
		const toggle = layout.querySelector('[data-basalt-push-toggle]');
		const overlays = window.matchMedia('(max-width: 767.98px)');
		const caption = toggle ? toggle.querySelector('span') : null;
		const panelName = caption ? caption.textContent.replace(/^(Hide|Show)\s+/, '') : '';

		toggle?.addEventListener('click', () => setOpen(!opened(), true));
		layout.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape' || !overlays.matches || !opened()) return;
			setOpen(false);
			toggle?.focus();
		});
		document.addEventListener('pointerdown', ({ target }) => {
			if (!overlays.matches || !opened() || panel.contains(target)) return;
			if (target === toggle || toggle.contains(target)) return;
			setOpen(false);
		});
		setOpen(!overlays.matches);

		function opened() {
			return !layout.classList.contains('is-closed');
		}

		function setOpen(open, moveFocus) {
			layout.classList.toggle('is-closed', !open);
			panel.inert = !open;
			toggle?.setAttribute('aria-expanded', String(open));
			if (caption) caption.textContent = `${open ? 'Hide' : 'Show'} ${panelName}`;
			if (!open || !moveFocus || !overlays.matches) return;
			panel.querySelector('a, button')?.focus();
		}
	}

	/**
	 * Previous and next record inside a drawer: wires
	 * [data-basalt-record-prev], [data-basalt-record-next], the
	 * [data-basalt-record-pos] readout, and Alt+Up / Alt+Down. Stepping
	 * wraps around at either end.
	 * @param {HTMLElement} drawer the offcanvas holding the controls
	 * @param {number|{valueOf(): number}} count how many records there are,
	 *   read again on every step so a live list can pass an object
	 * @param {(index: number) => void} render draws the record at `index`
	 * @returns {{ go(index: number, direction: number): void, readonly at: number }}
	 *   `go` jumps to a record (direction -1, 0 or 1 picks the animation);
	 *   `at` is the record shown now
	 */
	function stepThroughRecords(drawer, count, render) {
		const earlier = drawer.querySelector('[data-basalt-record-prev]');
		const later = drawer.querySelector('[data-basalt-record-next]');
		const readout = drawer.querySelector('[data-basalt-record-pos]');
		const content = drawer.querySelector('.offcanvas-body');
		let current = 0;

		earlier?.addEventListener('click', () => showRecord(current - 1, -1));
		later?.addEventListener('click', () => showRecord(current + 1, 1));
		drawer.addEventListener('keydown', (event) => {
			if (!event.altKey) return;
			const direction = { ArrowUp: -1, ArrowDown: 1 }[event.key];
			if (!direction) return;
			event.preventDefault();
			showRecord(current + direction, direction);
		});

		function showRecord(index, direction) {
			const total = Number(count);
			current = (index + total) % total;
			render(current);
			if (readout) readout.textContent = `${current + 1} of ${total}`;
			drawer.classList.toggle('is-back', direction < 0);
			if (!content || !direction) return;
			for (const block of content.children) replayAnimation(block);
		}

		return {
			go: showRecord,
			get at() {
				return current;
			},
		};
	}

	/**
	 * Fills a .basalt-applied box with one removable chip per filter in
	 * use, plus a Clear all button once there are two or more. After a
	 * removal, focus lands on the chip now in that place, else on `fallback`.
	 * @param {HTMLElement} box the .basalt-applied container, emptied first
	 * @param {{ label: string, remove(): void }[]} items the filters in use
	 * @param {?Function} clearAll removes every filter; no Clear all without it
	 * @param {?HTMLElement} fallback where focus goes when no chip is left
	 */
	function renderFilterChips(box, items, clearAll, fallback) {
		box.replaceChildren();
		for (const [slot, filter] of items.entries()) {
			const dismiss = Object.assign(document.createElement('button'), {
				type: 'button',
				innerHTML: '<i class="bi bi-x-lg" aria-hidden="true"></i>',
			});
			dismiss.setAttribute('aria-label', `Remove ${filter.label}`);
			dismiss.addEventListener('click', () => {
				filter.remove();
				const remaining = box.querySelectorAll('.basalt-applied-chip button');
				(remaining[Math.min(slot, remaining.length - 1)] || fallback)?.focus();
			});
			const chip = Object.assign(document.createElement('span'), { className: 'basalt-applied-chip' });
			chip.append(filter.label, dismiss);
			box.append(chip);
		}
		if (!clearAll || items.length < 2) return;
		const clearButton = Object.assign(document.createElement('button'), {
			type: 'button',
			className: 'basalt-applied-clear',
			textContent: 'Clear all',
		});
		clearButton.addEventListener('click', () => {
			clearAll();
			fallback?.focus();
		});
		box.append(clearButton);
	}

	/** Restarts an element's CSS animation from its first frame. */
	function replayAnimation(node) {
		node.style.animation = 'none';
		void node.offsetWidth;
		node.style.animation = '';
	}

	function readSetting(key) {
		try {
			return window.localStorage.getItem(key);
		} catch {
			return null;
		}
	}

	function writeSetting(key, value) {
		try {
			window.localStorage.setItem(key, value);
		} catch {
			/* Storage is off, as in some private windows. */
		}
	}
})();

/**
 * Dropdowns that open from a page header (.basalt-hero).
 * That header clips its decorative layers, so a menu positioned inside it
 * would be cut off or covered by the cards below. These menus are placed
 * against the viewport instead, kept clear of the sidebar, and basalt.css
 * raises the header while one is open.
 */
(() => {
	'use strict';
	const kit = window.bootstrap;
	if (!kit) return;
	const { Dropdown } = kit;
	const HERO_TOGGLE = '.basalt-hero [data-bs-toggle="dropdown"]';

	/* Capture-phase listeners run ahead of Bootstrap's own, which covers
     toggles that arrive after load as well as the ones already here. */
	function start() {
		for (const kind of ['click', 'keydown']) document.addEventListener(kind, adoptFromEvent, true);
		for (const toggle of document.querySelectorAll(HERO_TOGGLE)) placeAgainstViewport(toggle);
	}

	function adoptFromEvent(event) {
		const toggle = event.target.closest?.(HERO_TOGGLE);
		if (toggle) placeAgainstViewport(toggle);
	}

	function placeAgainstViewport(toggle) {
		if (Dropdown.getInstance(toggle)) return;
		const stage = toggle.closest('.basalt-stage');
		Dropdown.getOrCreateInstance(toggle, {
			popperConfig: (base) => ({
				...base,
				strategy: 'fixed',
				modifiers: [
					...(base.modifiers || []),
					...(stage ? [{ name: 'preventOverflow', options: { boundary: stage, padding: 8 } }] : []),
				],
			}),
		});
	}

	start();
})();

/**
 * Tooltips and popovers, as shown on tooltips.html.
 * Bootstrap only starts these on request, so every data-bs-toggle of
 * "tooltip" or "popover" is started here, and Escape dismisses tooltips.
 * Extra behaviors, each set up from its attribute:
 *   [data-basalt-kbd="mod+B"]   tooltip with the label plus its keys (mod
 *       reads Cmd on Apple devices, Ctrl elsewhere); inside a
 *       [data-basalt-tip-group] neighbors open without waiting.
 *   [role="toolbar"][data-basalt-toolbar]   one tab stop, then arrows,
 *       Home and End between the buttons.
 *   .basalt-ellipsis[data-basalt-truncate-tip]   full text on hover, only
 *       while it is clipped.
 *   [data-basalt-toggletip="note"]   an (i) button whose note opens on
 *       click and is read aloud.
 *   icon-only buttons with an aria-label get that label as a tooltip
 *       (opt out with data-basalt-no-tips on the button or a wrapper; menu,
 *       tab, toggle and popover buttons keep only their own part).
 *   Basalt.limit(button, 'reason')   a button at a limit: looks disabled,
 *       stays focusable and says why in its tooltip; Basalt.limit(button)
 *       frees it.
 *   [data-basalt-hint="note"]   on a figure's label: a small (i) after it
 *       whose note shows on hover, focus or tap; labels a page script draws
 *       later are picked up as they appear.
 *   [data-basalt-hovercard="#tpl"]   a preview card on hover or focus.
 *   [data-basalt-popconfirm]   ask before acting (-title, -text, -ok,
 *       -cancel, -tone, -placement); dispatches 'basalt:confirm'.
 *   [data-basalt-edit]   edit one field in place; dispatches 'basalt:edit'.
 *   [data-basalt-tour]   walks [data-basalt-tour-step="n"] one popover at
 *       a time; dispatches 'basalt:tourend'.
 * For markup added later, call window.Basalt.tips(root).
 */
(() => {
	'use strict';
	const kit = window.bootstrap;
	if (!kit) return;
	const { Tooltip, Popover } = kit;
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const appleKeys = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
	const KEY_GLYPHS = {
		mod: appleKeys ? '⌘' : 'Ctrl',
		shift: appleKeys ? '⇧' : 'Shift',
		alt: appleKeys ? '⌥' : 'Alt',
		ctrl: 'Ctrl',
	};
	const TOOLBAR_MOVES = new Map([
		['ArrowRight', (at, size) => (at + 1) % size],
		['ArrowLeft', (at, size) => (at - 1 + size) % size],
		['Home', () => 0],
		['End', (at, size) => size - 1],
	]);
	let uid = 0;

	watchDocument();

	/**
	 * Collects the matches for `selector` under `scope` (the whole document
	 * when absent) that no earlier pass has claimed, and claims them by
	 * setting the `flag` property, so each element is set up only once.
	 */
	function pick(scope, selector, flag) {
		const fresh = [];
		for (const el of (scope || document).querySelectorAll(selector)) {
			if (el[flag]) continue;
			el[flag] = true;
			fresh.push(el);
		}
		return fresh;
	}

	/* Document-wide rules. A tooltip that opens because focus came back
     to its button (after a toast, dialog or drawer closed) is canceled,
     since nobody pointed at it. A finger has no hover to end, so a tap
     never opens a hover or focus tooltip: the phone fires mouseenter and
     focus for the tap and nothing ever closes it again. Tooltips set to
     open on click, and ones shown on purpose (Copied, the reason a button
     is at its limit), still show.
     Escape hides open tooltips, which Bootstrap leaves on screen, unless
     the owner is pinned. And no tooltip survives leaving the page, so
     none is waiting when the back button restores it. */
	function watchDocument() {
		let touched = false;
		document.addEventListener(
			'pointerdown',
			(event) => {
				touched = event.pointerType === 'touch';
			},
			true,
		);
		document.addEventListener(
			'keydown',
			() => {
				touched = false;
			},
			true,
		);
		document.addEventListener('show.bs.tooltip', (event) => {
			const owner = event.target;
			if (touched && !openedOnPurpose(owner)) {
				event.preventDefault();
				return;
			}
			if (owner !== document.activeElement) return;
			if (owner.matches(':focus-visible, :hover')) return;
			event.preventDefault();
		});
		window.addEventListener('pagehide', hideAllTips);
		window.addEventListener('pageshow', (event) => {
			if (event.persisted) hideAllTips();
		});
		document.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') return;
			for (const bubble of document.querySelectorAll('.tooltip.show')) {
				const owner = document.querySelector(`[aria-describedby="${bubble.id}"]`);
				if (!owner || owner.hasAttribute('data-tt-pinned')) continue;
				Tooltip.getInstance(owner)?.hide();
			}
		});
	}

	/** True for a tooltip a tap may open: one set to open on click or by
	 * hand, one pinned open, or one a script is showing as feedback (a
	 * fresh copy). */
	function openedOnPurpose(owner) {
		const trigger = owner.getAttribute('data-bs-trigger') || '';
		return (
			/click|manual/.test(trigger) ||
			owner.hasAttribute('data-tt-pinned') ||
			owner.classList.contains('is-copied') ||
			owner.matches('[data-basalt-limit][aria-disabled="true"]')
		);
	}

	/* Every open bubble is hidden through its owner, and a bubble whose
	   owner is gone is removed outright. */
	function hideAllTips() {
		for (const bubble of document.querySelectorAll('.tooltip')) {
			const owner = document.querySelector(`[aria-describedby="${bubble.id}"]`);
			const tip = owner && Tooltip.getInstance(owner);
			if (tip) tip.hide();
			else bubble.remove();
		}
	}

	/** Starts every plain Bootstrap tooltip, then every popover, under root. */
	function initBootstrapTips(root) {
		const within = root || document;
		const kinds = [
			['[data-bs-toggle="tooltip"]', Tooltip],
			['[data-bs-toggle="popover"]', Popover],
		];
		for (const [selector, Kind] of kinds) {
			for (const el of within.querySelectorAll(selector)) Kind.getOrCreateInstance(el);
		}
	}

	/* Shortcut tooltips read their label from aria-label and their keys from
     data-basalt-kbd, and announce the keys through aria-keyshortcuts. */
	function initShortcutTips(scope) {
		for (const el of pick(scope, '[data-basalt-kbd]', '_basaltShortcutTip')) {
			el.setAttribute(
				'aria-keyshortcuts',
				el.getAttribute('data-basalt-kbd').replace(/mod/i, appleKeys ? 'Meta' : 'Control'),
			);
			const group = el.closest('[data-basalt-tip-group]');
			const tip = new Tooltip(el, {
				html: true,
				title: () => shortcutLabel(el),
				trigger: group ? 'manual' : 'hover focus',
			});
			if (group) runInGroup(el, tip, group);
		}
	}

	function shortcutLabel(el) {
		const keys = document.createElement('span');
		keys.className = 'basalt-tip-keys';
		keys.append(
			...el
				.getAttribute('data-basalt-kbd')
				.split('+')
				.map((part) => {
					const cap = document.createElement('kbd');
					cap.textContent = KEY_GLYPHS[part.toLowerCase()] || part;
					return cap;
				}),
		);
		const row = document.createElement('span');
		row.className = 'basalt-tip-row';
		row.append(el.getAttribute('aria-label') || '', keys);
		return row;
	}

	/* In a group the first tooltip waits half a second. Once one has shown,
     the group stays warm for 400ms and the next opens straight away. */
	function runInGroup(el, tip, group) {
		let delay = 0;
		function reveal(now) {
			clearTimeout(delay);
			if (now || group._basaltTipsWarm) tip.show();
			else delay = setTimeout(() => tip.show(), 500);
		}
		function conceal() {
			clearTimeout(delay);
			tip.hide();
			group._basaltTipsWarm = true;
			clearTimeout(group._basaltTipsCooling);
			group._basaltTipsCooling = setTimeout(() => {
				group._basaltTipsWarm = false;
			}, 400);
		}
		const handlers = {
			mouseenter: () => reveal(false),
			mouseleave: conceal,
			focus: () => {
				if (el.matches(':focus-visible')) reveal(true);
			},
			blur: conceal,
			click: conceal,
			keydown: (event) => {
				if (event.key === 'Escape') tip.hide();
			},
		};
		for (const [type, handler] of Object.entries(handlers)) el.addEventListener(type, handler);
	}

	/** Roving focus for a [role="toolbar"][data-basalt-toolbar]: one tab stop. */
	function initToolbars(scope) {
		for (const bar of pick(scope, '[role="toolbar"][data-basalt-toolbar]', '_basaltToolbarKeys')) {
			bar.addEventListener('keydown', (event) => {
				const move = TOOLBAR_MOVES.get(event.key);
				if (!move) return;
				const buttons = Array.from(bar.querySelectorAll('button:not([disabled])'));
				const at = buttons.indexOf(document.activeElement);
				if (at < 0) return;
				const target = move(at, buttons.length);
				event.preventDefault();
				for (const [index, button] of buttons.entries())
					button.setAttribute('tabindex', index === target ? '0' : '-1');
				buttons[target].focus();
			});
		}
	}

	/* A clipped label offers its full text as a tooltip, and takes a tab
     stop so the keyboard can reach it, only while it is actually cut off.
     Each change is reported through basalt:truncate. */
	function initTruncateTips(scope) {
		const labels = pick(scope, '[data-basalt-truncate-tip]', '_basaltTruncateTip');
		if (labels.length === 0) return;
		for (const label of labels) {
			new Tooltip(label, { title: label.textContent.trim() });
			label.addEventListener('show.bs.tooltip', (event) => {
				if (!label.classList.contains('is-truncated')) event.preventDefault();
			});
			measureClip(label);
		}
		if (!('ResizeObserver' in window)) return;
		const resizeWatch = new ResizeObserver((entries) => {
			for (const entry of entries) measureClip(entry.target);
		});
		for (const label of labels) resizeWatch.observe(label);
	}

	function measureClip(label) {
		const clipped = label.scrollWidth > label.clientWidth + 1;
		label.classList.toggle('is-truncated', clipped);
		if (clipped) {
			label.setAttribute('tabindex', '0');
		} else {
			label.removeAttribute('tabindex');
			Tooltip.getInstance(label)?.hide();
		}
		label.dispatchEvent(new CustomEvent('basalt:truncate', { bubbles: true, detail: { truncated: clipped } }));
	}

	/* Toggletips open on click, one at a time. The note is written into the
     bubble (a role="status" region) only after it shows, so it is read
     aloud, and the bubble is nudged left when it would leave the window. */
	function initToggletips(scope) {
		const wraps = pick(scope, '[data-basalt-toggletip]', '_basaltToggletipReady');
		if (wraps.length === 0) return;

		for (const wrap of wraps) {
			const [button] = toggletipParts(wrap);
			button.addEventListener('click', () => {
				if (button.getAttribute('aria-expanded') === 'true') foldToggletip(wrap);
				else unfold(wrap);
			});
			wrap.addEventListener('keydown', (event) => {
				if (event.key !== 'Escape') return;
				foldToggletip(wrap);
				button.focus();
			});
		}
		document.addEventListener('click', (event) => {
			for (const wrap of wraps) if (!wrap.contains(event.target)) foldToggletip(wrap);
		});

		function unfold(wrap) {
			for (const other of wraps) if (other !== wrap) foldToggletip(other);
			const [button, bubble] = toggletipParts(wrap);
			bubble.style.setProperty('--basalt-toggletip-shift', '0px');
			bubble.hidden = false;
			button.setAttribute('aria-expanded', 'true');
			bubble.textContent = '';
			setTimeout(() => {
				bubble.textContent = wrap.getAttribute('data-basalt-toggletip');
				const card = bubble.getBoundingClientRect();
				const anchor = button.getBoundingClientRect();
				const rightLimit = document.documentElement.clientWidth - 12;
				const shift = card.right > rightLimit ? rightLimit - card.right : 0;
				const pointer = anchor.left + anchor.width / 2 - (card.left + shift);
				bubble.style.setProperty('--basalt-toggletip-shift', `${shift}px`);
				bubble.style.setProperty('--basalt-toggletip-arrow', `${Math.max(12, pointer)}px`);
			}, 30);
		}
	}

	/* The (i) rides on the label's last word inside a span that never breaks,
     so it can't wrap onto a line of its own, and sits in the text's own line
     even when the label is a flex or grid box. */
	function attachHint(label, button) {
		const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT, {
			acceptNode: (node) => (node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
		});
		let last = null;
		while (walker.nextNode()) last = walker.currentNode;
		const tail = document.createElement('span');
		tail.className = 'basalt-hint-tail';
		if (!last) {
			tail.append(button);
			label.append(tail);
			return;
		}
		/* In a flex or grid label every piece of text is its own item, with
		   the box's gap between them; one span keeps the words a sentence. */
		if (/flex|grid/.test(getComputedStyle(last.parentElement).display)) {
			const words = document.createElement('span');
			last.before(words);
			words.append(last);
		}
		const text = last.textContent.replace(/\s+$/, '');
		const cut = text.search(/\S+$/);
		const word = last.splitText(cut);
		word.textContent = text.slice(cut);
		word.after(tail);
		tail.append(word, button);
	}

	/* Hints explain a figure in one line. The (i) is a real button, so it can
     be reached by keyboard and tapped; its note is a tooltip that names the
     figure it belongs to. */
	let hintCount = 0;
	function initHints(scope) {
		for (const label of pick(scope, '[data-basalt-hint]', '_basaltHint')) {
			const note = label.getAttribute('data-basalt-hint');
			/* A copy of a label that already carries its button keeps that one. */
			if (!note || label.querySelector('.basalt-hint')) continue;
			const name = label.textContent.trim().replace(/\s+/g, ' ');
			/* Inside a control (a metric tile that is itself a button) a second
			   button would nest one control in another. There the (i) is only a
			   mark that shows the note on hover, and the control reads the note
			   out as its description. The note sits hidden beside the control, not
			   inside it, so it is not read as part of the control's name too. */
			const host = label.closest('button, a[href], [role="button"], [role="tab"], summary');
			if (host) {
				const mark = document.createElement('span');
				mark.className = 'basalt-hint';
				mark.setAttribute('aria-hidden', 'true');
				mark.setAttribute('data-bs-title', note);
				mark.setAttribute('data-bs-trigger', 'hover');
				mark.innerHTML = '<i class="bi bi-info-circle"></i>';
				const said = document.createElement('span');
				said.id = `basalt-hint-${(hintCount += 1)}`;
				said.textContent = note;
				said.hidden = true;
				host.after(said);
				host.setAttribute(
					'aria-describedby',
					`${host.getAttribute('aria-describedby') || ''} ${said.id}`.trim(),
				);
				attachHint(label, mark);
				Tooltip.getOrCreateInstance(mark);
				continue;
			}
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'basalt-hint';
			button.setAttribute('aria-label', `About ${name}`);
			button.setAttribute('data-bs-title', note);
			button.setAttribute('data-bs-trigger', 'hover focus click');
			button.innerHTML = '<i class="bi bi-info-circle" aria-hidden="true"></i>';
			attachHint(label, button);
			Tooltip.getOrCreateInstance(button);
		}
	}

	/* A button that shows only an icon says what it does on hover and
     keyboard focus, from its own aria-label, so nobody has to guess. Buttons
     with words, close buttons and those that already have a tip are left
     alone. The tip reads the label each time, so a toggle that renames
     itself stays right. */
	function initIconTips(scope) {
		for (const el of pick(
			scope,
			'button[aria-label], a[aria-label], [role="button"][aria-label]',
			'_basaltIconTip',
		)) {
			if (
				el.classList.contains('btn-close') ||
				el.classList.contains('basalt-hint') ||
				el.hasAttribute('title') ||
				el.hasAttribute('data-bs-title') ||
				el.hasAttribute('data-basalt-kbd') ||
				/* Bootstrap allows one component per element; menus, tabs, toggle
				   buttons and popovers own theirs. */
				/^(dropdown|tab|pill|list|button|tooltip|popover)$/.test(el.getAttribute('data-bs-toggle') || '') ||
				el.matches('[data-basalt-hovercard], [data-basalt-popconfirm], [data-basalt-edit]') ||
				window.bootstrap?.Popover?.getInstance(el) ||
				el.closest('[data-basalt-no-tips]') ||
				Tooltip.getInstance(el)
			)
				continue;
			const words = el.cloneNode(true);
			for (const quiet of words.querySelectorAll('.visually-hidden, [aria-hidden="true"]')) quiet.remove();
			if (words.textContent.trim() || el.querySelector('img')) continue;
			el.setAttribute('data-basalt-icon-tip', '');
			const tip = Tooltip.getOrCreateInstance(el, {
				title: () => limitOf(el) || el.getAttribute('aria-label'),
				trigger: 'manual',
			});
			/* A mouse hover or keyboard focus shows the tip. A tap does not, so
			   it never stays behind once the button has opened its menu or
			   drawer; a button at a limit answers a tap below, to say why. */
			el.addEventListener('pointerenter', (event) => {
				if (event.pointerType === 'mouse') tip.show();
			});
			/* A finger "leaves" the moment it lifts, so only a mouse hides the tip
			   this way; a tapped limit hides on its own timer. */
			el.addEventListener('pointerleave', (event) => {
				if (event.pointerType === 'mouse' && !el.matches(':focus-visible')) tip.hide();
			});
			el.addEventListener('focusin', () => {
				if (el.matches(':focus-visible')) tip.show();
			});
			el.addEventListener('focusout', () => tip.hide());
			el.addEventListener('keydown', (event) => {
				if (event.key === 'Escape') tip.hide();
			});
		}
	}

	/* A button at a limit, set through Basalt.limit, stays reachable so its
     tooltip can say why it can't be used, and swallows its own clicks. */
	const limitOf = (el) => el.getAttribute('data-basalt-limit') || '';
	function setLimit(button, reason) {
		if (!button) return;
		button.disabled = false;
		button.toggleAttribute('data-basalt-limit', Boolean(reason));
		if (reason) button.setAttribute('data-basalt-limit', reason);
		if (reason) button.setAttribute('aria-disabled', 'true');
		else button.removeAttribute('aria-disabled');
		button.classList.toggle('disabled', Boolean(reason) && button.classList.contains('btn'));
		if (!Tooltip.getInstance(button))
			Tooltip.getOrCreateInstance(button, {
				title: () =>
					limitOf(button) ||
					(button.hasAttribute('data-basalt-icon-tip') ? button.getAttribute('aria-label') : ''),
				trigger: 'hover focus',
			});
		if (!reason && !button.hasAttribute('data-basalt-icon-tip')) Tooltip.getInstance(button)?.hide();
	}
	/* The click is stopped before anything else hears it, so the button's own
     action never runs; a tap shows the reason instead, for a moment. */
	let limitShown = null;
	document.addEventListener(
		'click',
		(event) => {
			const button = event.target.closest?.('[data-basalt-limit][aria-disabled="true"]');
			if (!button) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			const tip = Tooltip.getInstance(button);
			if (!tip) return;
			tip.show();
			clearTimeout(limitShown);
			limitShown = setTimeout(() => {
				if (!button.matches(':focus-visible')) tip.hide();
			}, 2400);
		},
		true,
	);

	/* Page scripts draw many figures and buttons after load; their hints and
     icon tips are wired as they arrive. */
	function watchHints() {
		let queued = false;
		new MutationObserver((records) => {
			if (queued) return;
			for (const record of records) {
				for (const node of record.addedNodes) {
					if (node.nodeType !== 1) continue;
					queued = true;
					requestAnimationFrame(() => {
						queued = false;
						initHints(document);
						initIconTips(document);
					});
					return;
				}
			}
		}).observe(document.body, { childList: true, subtree: true });
	}

	function toggletipParts(wrap) {
		return [wrap.querySelector('.basalt-toggletip-btn'), wrap.querySelector('.basalt-toggletip-bubble')];
	}

	function foldToggletip(wrap) {
		const [button, bubble] = toggletipParts(wrap);
		if (!bubble || bubble.hidden) return;
		bubble.hidden = true;
		bubble.textContent = '';
		button.setAttribute('aria-expanded', 'false');
	}

	/* Popovers that hold buttons or fields share two helpers. Bootstrap marks
     every popover role="tooltip", which stops being true once it can be
     operated, so these take a dialog role, receive focus, and give it back
     on Escape or a press outside. */

	/** The popover's element, while Bootstrap has one built. */
	function tipOf(inst) {
		return inst?.tip;
	}

	/**
	 * Calls `onClose(false)` on any mousedown outside both the trigger and its
	 * popover. Returns the function that stops listening.
	 */
	function outsideCloser(trigger, inst, onClose) {
		function onPress(event) {
			const popover = tipOf(inst);
			const inside = trigger.contains(event.target) || popover?.contains(event.target);
			if (!inside) onClose(false);
		}
		document.addEventListener('mousedown', onPress);
		return () => document.removeEventListener('mousedown', onPress);
	}

	/* Hover cards: data-basalt-hovercard names a <template> whose first
     element is cloned into a popover when the trigger is hovered or
     focused. */
	function initHovercards(scope) {
		for (const trigger of pick(scope, '[data-basalt-hovercard]', '_basaltHovercardReady')) attachHovercard(trigger);
	}

	function attachHovercard(trigger) {
		const template = document.querySelector(trigger.getAttribute('data-basalt-hovercard'));
		if (!template) return;
		const host = trigger.closest('li, [data-basalt-hovercard-scope]') || trigger.parentElement;
		const card = new Popover(trigger, {
			customClass: 'basalt-hovercard',
			container: host,
			trigger: 'manual',
			html: true,
			content: () => template.content.firstElementChild.cloneNode(true),
			offset: [0, 10],
			fallbackPlacements: ['top-start', 'bottom-start'],
			/* The card starts where the name starts instead of centering on it. */
			popperConfig: (config) => ({
				...config,
				placement: trigger.getAttribute('data-basalt-hovercard-placement') || 'bottom-start',
			}),
		});
		const cardId = `basalt-hovercard-${++uid}`;
		let openTimer = 0;
		let closeTimer = 0;

		function openAfter(wait) {
			clearTimeout(closeTimer);
			clearTimeout(openTimer);
			if (tipOf(card)?.classList.contains('show')) return;
			openTimer = setTimeout(() => card.show(), wait);
		}
		function closeAfter(wait) {
			clearTimeout(openTimer);
			clearTimeout(closeTimer);
			closeTimer = setTimeout(() => card.hide(), wait);
		}

		trigger.addEventListener('inserted.bs.popover', () => {
			const popover = tipOf(card);
			popover.id = cardId;
			popover.setAttribute('role', 'dialog');
			popover.setAttribute('aria-label', trigger.textContent.trim());
			popover.addEventListener('mouseenter', () => clearTimeout(closeTimer));
			popover.addEventListener('mouseleave', () => closeAfter(200));
			popover.addEventListener('focusout', (event) => {
				const leavingTo = event.relatedTarget;
				if (!popover.contains(leavingTo) && leavingTo !== trigger) closeAfter(0);
			});
			popover.addEventListener('keydown', (event) => {
				if (event.key !== 'Escape') return;
				card.hide();
				trigger.focus();
			});
		});
		trigger.addEventListener('mouseenter', () => openAfter(350));
		trigger.addEventListener('mouseleave', () => closeAfter(200));
		trigger.addEventListener('focus', () => openAfter(0));
		trigger.addEventListener('blur', (event) => {
			const popover = tipOf(card);
			if (!popover || !popover.contains(event.relatedTarget)) closeAfter(0);
		});
		trigger.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') card.hide();
		});
	}

	/* Confirm popover, set up from data-basalt-popconfirm. A click asks the
     question with Cancel and a confirm button beside it; "basalt:confirm"
     bubbles from the trigger only after the confirm button is pressed.
     Cancel holds focus when the question appears. */
	function setUpConfirm(trigger) {
		let view = null;
		let release = null;
		const popover = new Popover(trigger, {
			customClass: 'basalt-popconfirm',
			trigger: 'manual',
			html: true,
			placement: confirmSetting(trigger, 'placement', 'left'),
			fallbackPlacements: ['top', 'bottom', 'left', 'right'],
			content: () => {
				view = confirmCard(trigger, settle);
				return view.card;
			},
		});

		/* Closing without an answer hands focus back to the trigger, unless the
       popover closed because the visitor clicked somewhere else. */
		function settle(accepted, returnFocus = true) {
			release?.();
			release = null;
			popover.hide();
			trigger.setAttribute('aria-expanded', 'false');
			if (accepted) {
				trigger.dispatchEvent(new CustomEvent('basalt:confirm', { bubbles: true }));
			} else if (returnFocus) {
				trigger.focus();
			}
		}

		function onKey(event) {
			if (event.key === 'Escape') {
				event.stopPropagation();
				settle(false);
			} else if (event.key === 'Tab') {
				/* With only two buttons inside, Tab either way swaps between them. */
				event.preventDefault();
				(document.activeElement === view.cancel ? view.confirm : view.cancel).focus();
			}
		}

		trigger.setAttribute('aria-haspopup', 'dialog');
		trigger.setAttribute('aria-expanded', 'false');
		trigger.addEventListener('click', () => {
			if (tipOf(popover)?.classList.contains('show')) settle(false);
			else popover.show();
		});
		trigger.addEventListener('inserted.bs.popover', () => {
			const tip = tipOf(popover);
			tip.setAttribute('role', 'alertdialog');
			tip.setAttribute('aria-labelledby', view.heading.id);
			tip.setAttribute('aria-describedby', view.detail.id);
			tip.addEventListener('keydown', (event) => onKey(event));
			release = outsideCloser(trigger, popover, () => settle(false, false));
		});
		trigger.addEventListener('shown.bs.popover', () => {
			trigger.setAttribute('aria-expanded', 'true');
			view.cancel.focus();
		});
	}

	/** Reads data-basalt-popconfirm-<name>, falling back when it is missing or empty. */
	function confirmSetting(trigger, name, fallback) {
		return trigger.getAttribute(`data-basalt-popconfirm-${name}`) || fallback;
	}

	/**
	 * Builds the body of one confirm popover. The heading and the line under it
	 * share a random suffix so the popover can be labeled and described by them.
	 * @param {HTMLElement} trigger  The button carrying the data-basalt-popconfirm-* settings.
	 * @param {(accepted: boolean) => void} settle  Called with the visitor's answer.
	 * @returns {{card: HTMLElement, heading: HTMLElement, detail: HTMLElement,
	 *   cancel: HTMLButtonElement, confirm: HTMLButtonElement}}
	 */
	function confirmCard(trigger, settle) {
		const suffix = Math.random().toString(36).slice(2, 8);
		const card = document.createElement('div');
		card.innerHTML = `<p class="basalt-popconfirm-title" id="basalt-popconfirm-t-${suffix}"><i class="bi bi-exclamation-circle" aria-hidden="true"></i></p><p class="basalt-popconfirm-text" id="basalt-popconfirm-d-${suffix}"></p><div class="basalt-popconfirm-actions"><button type="button" class="btn btn-sm btn-outline-secondary"></button><button type="button"></button></div>`;
		const [heading, detail] = card.querySelectorAll('p');
		const [cancel, confirm] = card.querySelectorAll('button');
		heading.append(confirmSetting(trigger, 'title', 'Are you sure?'));
		detail.textContent = confirmSetting(trigger, 'text', '');
		cancel.textContent = confirmSetting(trigger, 'cancel', 'Cancel');
		confirm.className = `btn btn-sm btn-${confirmSetting(trigger, 'tone', 'danger')}`;
		confirm.textContent = confirmSetting(trigger, 'ok', 'Confirm');
		cancel.addEventListener('click', () => settle(false));
		confirm.addEventListener('click', () => settle(true));
		return { card, heading, detail, cancel, confirm };
	}

	/* Edit in place, set up from data-basalt-edit: a popover holding one
     number field. Saving a valid number stores it back on the trigger and
     sends "basalt:edit" with detail.value. */
	function setUpEditor(trigger) {
		const fieldId = `basalt-edit-${++uid}`;
		let form = null;
		let release = null;
		const setting = (name, fallback) => trigger.getAttribute(`data-basalt-edit-${name}`) || fallback;
		const popover = new Popover(trigger, {
			customClass: 'basalt-edit',
			trigger: 'manual',
			html: true,
			placement: setting('placement', 'bottom'),
			fallbackPlacements: ['top', 'bottom', 'left'],
			content: () => {
				form = editSheetForm(fieldId, setting, save);
				form.querySelector('[data-cancel]').addEventListener('click', () => dismiss(true));
				return form;
			},
		});

		/** Puts the popover away; Escape and Cancel also send focus back to the trigger. */
		function dismiss(returnFocus) {
			release?.();
			release = null;
			popover.hide();
			trigger.setAttribute('aria-expanded', 'false');
			if (returnFocus) trigger.focus();
		}

		function save(value) {
			trigger.setAttribute('data-basalt-edit-value', value);
			dismiss(true);
			trigger.dispatchEvent(new CustomEvent('basalt:edit', { bubbles: true, detail: { value } }));
		}

		trigger.setAttribute('aria-haspopup', 'dialog');
		trigger.setAttribute('aria-expanded', 'false');
		trigger.addEventListener('click', () => {
			if (tipOf(popover)?.classList.contains('show')) {
				dismiss(true);
			} else {
				/* Only one editor stays open: any other open one is clicked shut first. */
				for (const other of document.querySelectorAll('[data-basalt-edit][aria-expanded="true"]')) {
					if (other !== trigger) other.click();
				}
				popover.show();
			}
		});
		trigger.addEventListener('inserted.bs.popover', () => {
			const tip = tipOf(popover);
			tip.setAttribute('role', 'dialog');
			tip.setAttribute('aria-label', setting('label', 'Edit value'));
			tip.addEventListener('keydown', (event) => {
				if (event.key !== 'Escape') return;
				event.stopPropagation();
				dismiss(true);
			});
			release = outsideCloser(trigger, popover, () => dismiss(false));
		});
		trigger.addEventListener('shown.bs.popover', () => {
			trigger.setAttribute('aria-expanded', 'true');
			const field = form.querySelector('input');
			field.focus();
			field.select();
		});
	}

	/**
	 * Builds the editor form: a label, the number field with its optional
	 * prefix and suffix, an error line and the Cancel / Save pair.
	 * @param {string} fieldId  Id for the input; the error line takes it plus "-err".
	 * @param {(name: string, fallback: string) => string} setting  Reads data-basalt-edit-<name>.
	 * @param {(value: string) => void} save  Receives the cleaned value once it passes.
	 * @returns {HTMLFormElement}
	 */
	function editSheetForm(fieldId, setting, save) {
		const prefix = setting('prefix', '');
		const suffix = setting('suffix', '');
		const lowest = setting('min', '');
		const highest = setting('max', '');
		const addon = '<span class="input-group-text"></span>';
		const form = document.createElement('form');
		form.noValidate = true;
		form.innerHTML = `<label class="form-label" for="${fieldId}"></label><div class="input-group input-group-sm has-validation">${prefix ? addon : ''}<input class="form-control" type="number" id="${fieldId}" inputmode="decimal" aria-describedby="${fieldId}-err">${suffix ? addon : ''}<div class="invalid-feedback" id="${fieldId}-err"></div></div><div class="basalt-edit-actions"><button type="button" class="btn btn-sm btn-outline-secondary" data-cancel>Cancel</button><button type="submit" class="btn btn-sm btn-primary">Save</button></div>`;
		form.querySelector('label').textContent = setting('label', 'Value');
		const addons = form.querySelectorAll('.input-group-text');
		if (prefix) addons[0].textContent = prefix;
		if (suffix) addons[addons.length - 1].textContent = suffix;

		const field = form.querySelector('input');
		field.value = setting('value', '');
		if (lowest !== '') field.min = lowest;
		if (highest !== '') field.max = highest;
		field.step = setting('step', '1');
		const message = form.querySelector('.invalid-feedback');

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const wholeOnly = Number(field.step) >= 1;
			const amount = Number(field.value);
			const tooLow = lowest !== '' && amount < Number(lowest);
			const tooHigh = highest !== '' && amount > Number(highest);
			const fits =
				field.value.trim() !== '' &&
				Number.isFinite(amount) &&
				!tooLow &&
				!tooHigh &&
				!(wholeOnly && !Number.isInteger(amount));
			if (fits) {
				save(wholeOnly ? String(amount) : amount.toFixed(2));
				return;
			}
			message.textContent = `Enter a ${wholeOnly ? 'whole number' : 'number'} from ${lowest} to ${highest}.`;
			field.classList.add('is-invalid');
			field.setAttribute('aria-invalid', 'true');
			field.focus();
		});
		field.addEventListener('input', () => {
			field.classList.remove('is-invalid');
			field.removeAttribute('aria-invalid');
		});
		return form;
	}

	/* Guided tour, set up from data-basalt-tour. Each [data-basalt-tour-step="n"]
     gets a popover in turn, lowest number first. Next and Back, the arrow
     keys and Escape move through it, and "basalt:tourend" reports the end. */
	const TOUR_ARROWS = new Map([
		['ArrowRight', 1],
		['ArrowLeft', -1],
	]);

	function setUpTour(root) {
		const stepOrder = (node) => Number(node.getAttribute('data-basalt-tour-step'));
		const stops = [...root.querySelectorAll('[data-basalt-tour-step]')].sort(
			(first, second) => stepOrder(first) - stepOrder(second),
		);
		const launcher = root.querySelector('[data-basalt-tour-start]');
		const progress = root.querySelector('[data-basalt-tour-status]');
		const idleText = progress ? progress.textContent : '';
		let current = -1;
		let popover = null;
		let spotlit = null;

		root.basaltTourStart = () => {
			root.classList.add('is-touring');
			visit(0);
		};
		launcher?.addEventListener('click', root.basaltTourStart);
		root.addEventListener('keydown', (event) => {
			if (current < 0) return;
			if (event.key === 'Escape') {
				event.preventDefault();
				finish(false);
			} else if (event.target.closest?.('.basalt-tour')) {
				stepWithArrow(event);
			}
		});
		/* A layout change would leave the popover behind its step otherwise. */
		window.addEventListener('resize', () => popover?.update());

		/* Arrow keys only steer the tour while focus is inside its popover. */
		function stepWithArrow(event) {
			const move = TOUR_ARROWS.get(event.key);
			if (!move) return;
			event.preventDefault();
			const next = current + move;
			if (next >= 0 && next < stops.length) visit(next);
		}

		function clearStep() {
			popover?.dispose();
			popover = null;
			if (!spotlit) return;
			spotlit.classList.remove('basalt-tour-target');
			spotlit.removeAttribute('aria-describedby');
			spotlit = null;
		}

		function visit(index) {
			clearStep();
			current = index;
			spotlit = stops[index];
			const stop = spotlit;
			const heading = stop.getAttribute('data-basalt-tour-title') || '';
			stop.classList.add('basalt-tour-target');
			stop.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
			popover = new Popover(stop, {
				customClass: 'basalt-tour',
				container: root,
				trigger: 'manual',
				html: true,
				placement: stop.getAttribute('data-basalt-tour-placement') || 'bottom',
				fallbackPlacements: ['bottom', 'top', 'left', 'right'],
				offset: [0, 14],
				content: tourCard(stops, index, { visit, finish }),
			});
			stop.addEventListener(
				'inserted.bs.popover',
				() => {
					const tip = tipOf(popover);
					tip.setAttribute('role', 'dialog');
					tip.setAttribute('aria-labelledby', `basalt-tour-title-${index}`);
				},
				{ once: true },
			);
			stop.addEventListener(
				'shown.bs.popover',
				() => {
					tipOf(popover)?.querySelector('[data-basalt-tour-next]')?.focus({ preventScroll: true });
				},
				{ once: true },
			);
			popover.show();
			if (progress) progress.textContent = `Step ${index + 1} of ${stops.length}: ${heading}`;
		}

		function finish(completed) {
			clearStep();
			current = -1;
			root.classList.remove('is-touring');
			if (progress) progress.textContent = completed ? 'Tour finished. Start it again any time.' : idleText;
			launcher?.focus({ preventScroll: true });
			root.dispatchEvent(new CustomEvent('basalt:tourend', { bubbles: true, detail: { finished: completed } }));
		}
	}

	/**
	 * Builds the popover body for one tour step: its position, title and text,
	 * a dot per step, Back (after the first step), Next or Finish, and a close button.
	 * @param {HTMLElement[]} stops  Every step of the tour, in order.
	 * @param {number} index  The step being shown.
	 * @param {{visit: (index: number) => void, finish: (completed: boolean) => void}} moves
	 * @returns {HTMLElement}
	 */
	function tourCard(stops, index, moves) {
		const stop = stops[index];
		const last = index === stops.length - 1;
		const dots = stops.map((_, dot) => (dot === index ? '<span class="is-on"></span>' : '<span></span>')).join('');
		const back = index > 0 ? '<button type="button" class="btn btn-sm btn-outline-secondary">Back</button>' : '';
		const card = document.createElement('div');
		card.innerHTML = `<p class="basalt-tour-count">Step ${index + 1} of ${stops.length}</p><h3 class="basalt-tour-title" id="basalt-tour-title-${index}"></h3><p class="basalt-tour-text"></p><div class="basalt-tour-foot"><span class="basalt-tour-dots" aria-hidden="true">${dots}</span><span class="basalt-tour-nav">${back}<button type="button" class="btn btn-sm btn-primary" data-basalt-tour-next="">${last ? 'Finish' : 'Next'}</button></span></div><button type="button" aria-label="End the tour" class="basalt-tour-close"><i class="bi bi-x-lg" aria-hidden="true"></i></button>`;
		card.querySelector('.basalt-tour-title').textContent = stop.getAttribute('data-basalt-tour-title') || '';
		card.querySelector('.basalt-tour-text').textContent = stop.getAttribute('data-basalt-tour-text') || '';
		card.querySelector('.basalt-tour-nav .btn-outline-secondary')?.addEventListener('click', () =>
			moves.visit(index - 1),
		);
		card.querySelector('[data-basalt-tour-next]').addEventListener('click', () =>
			last ? moves.finish(true) : moves.visit(index + 1),
		);
		card.querySelector('.basalt-tour-close').addEventListener('click', () => moves.finish(false));
		return card;
	}

	/* A tooltip has no business staying up over the control that was just
     pressed, or under a drawer or dialog that is opening. */
	function closeTooltips(owner) {
		const TooltipType = window.bootstrap?.Tooltip;
		if (!TooltipType) return;
		const owners = owner
			? [owner]
			: document.querySelectorAll('[data-bs-toggle="tooltip"], [data-basalt-icon-tip]');
		for (const el of owners) TooltipType.getInstance(el)?.hide();
	}

	document.addEventListener(
		'click',
		(event) => {
			const owner = event.target.closest?.('[data-bs-toggle="tooltip"], [data-basalt-icon-tip]');
			if (owner) closeTooltips(owner);
		},
		true,
	);
	for (const opening of ['show.bs.offcanvas', 'show.bs.modal', 'show.bs.dropdown', 'show.bs.collapse']) {
		document.addEventListener(opening, () => closeTooltips());
	}

	/* Every helper above, in the order a fresh scope is wired. */
	const tipSetups = [
		initShortcutTips,
		initToolbars,
		initTruncateTips,
		initToggletips,
		initHints,
		initIconTips,
		initHovercards,
		(scope) => {
			for (const trigger of pick(scope, '[data-basalt-popconfirm]', '_basaltPopconfirm')) setUpConfirm(trigger);
		},
		(scope) => {
			for (const trigger of pick(scope, '[data-basalt-edit]', '_basaltEdit')) setUpEditor(trigger);
		},
		(scope) => {
			for (const root of pick(scope, '[data-basalt-tour]', '_basaltTour')) setUpTour(root);
		},
		initBootstrapTips,
	];

	/**
	 * Wires every tooltip and popover behavior inside a scope. Elements that
	 * were wired before are skipped, so calling it again after rendering
	 * new markup is safe.
	 * @param {ParentNode} [root=document]  Where to look; the whole page when omitted.
	 */
	window.Basalt.tips = (root) => {
		for (const setup of tipSetups) setup(root);
	};
	/**
	 * Marks a button as unusable for a reason the tooltip gives, or frees it.
	 * Use it in place of button.disabled wherever a limit is reached, so the
	 * person learns why instead of meeting a dead button.
	 * @param {HTMLElement} button
	 * @param {string} [reason]  why it can't be used now; empty frees it.
	 */
	window.Basalt.limit = setLimit;
	document.addEventListener('DOMContentLoaded', () => {
		window.Basalt.tips();
		watchHints();
	});
})();

/**
 * Small text helpers, demonstrated on typography.html.
 *   [data-basalt-type-scale]   each [data-basalt-type-row] measures its own
 *       sample and prints the size, line height and weight it renders at;
 *       window.Basalt.typeScaleUnit('px' | 'rem') changes the unit.
 *   kbd[data-basalt-key="mod"]   prints the key this device uses (Cmd on
 *       Apple devices, Ctrl elsewhere); keys inside [data-basalt-keys-live]
 *       light up while they are held down.
 *   [data-basalt-clamp-toggle]   Read more for the .basalt-clamp it names in
 *       aria-controls, visible only while that text is clipped.
 *   .basalt-breadcrumb-collapse   hides the middle of a long trail behind one
 *       button (data-basalt-breadcrumb-max, default 4) and dispatches
 *       'basalt:breadcrumbopen' when it is expanded.
 * For markup added later, call window.Basalt.text(root).
 */
(() => {
	'use strict';
	const onApple = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
	const MODIFIER_LABELS = onApple ? { mod: '⌘', shift: '⇧', alt: '⌥' } : { mod: 'Ctrl', shift: 'Shift', alt: 'Alt' };

	/* Hints typed straight into the copy are swapped for what this keyboard
     says: ⌘ ⌥ ⇧ ↩ ⌫ on Apple devices, Ctrl Alt Shift Enter elsewhere. The
     shortcuts themselves take either form (Cmd or Ctrl, Backspace or Delete). */
	const WRITTEN_KEYS = onApple
		? {
				Ctrl: '⌘',
				Cmd: '⌘',
				Alt: '⌥',
				Option: '⌥',
				Shift: '⇧',
				Enter: '↩',
				Return: '↩',
				Backspace: '⌫',
				Delete: '⌫',
				Del: '⌫',
			}
		: {
				'⌘': 'Ctrl',
				Cmd: 'Ctrl',
				'⌥': 'Alt',
				Option: 'Alt',
				'⇧': 'Shift',
				'↩': 'Enter',
				Return: 'Enter',
				'⌫': 'Backspace',
			};

	const scales = [];
	const liveBlocks = [];
	let scalesFollowLayout = false;

	function start() {
		/**
		 * Switches every type scale on the page to one unit and measures again.
		 * @param {'px'|'rem'} unit
		 */
		window.Basalt.typeScaleUnit = (unit) => {
			for (const entry of scales) {
				entry.unit = unit;
				printScale(entry.scale, unit);
			}
		};

		/**
		 * Wires the type scales, key labels, Read more toggles and collapsing
		 * breadcrumbs inside a scope. Already wired elements are left alone.
		 * @param {ParentNode} [root=document]  Where to look; the whole page when omitted.
		 */
		window.Basalt.text = (root) => {
			setUpScales(root);
			labelKeys(root);
			setUpClamps(root);
			foldBreadcrumbs(root);
		};
		document.addEventListener('DOMContentLoaded', () => window.Basalt.text());
	}

	/* Matching elements in scope that nothing has claimed yet; each one is
     flagged on the way out so a second pass skips it. */
	function unclaimed(scope, selector, flag) {
		const found = [];
		for (const el of (scope || document).querySelectorAll(selector)) {
			if (el[flag]) continue;
			el[flag] = true;
			found.push(el);
		}
		return found;
	}

	/* Type scale: the figures come from the browser's own rendering at the
     current width, so they are always what is really on screen. */
	function setUpScales(scope) {
		for (const scale of unclaimed(scope, '[data-basalt-type-scale]', '_basaltTypeScale')) {
			const entry = { scale, unit: scale.getAttribute('data-basalt-type-unit') || 'px' };
			scales.push(entry);
			printScale(scale, entry.unit);
		}
		if (scalesFollowLayout || scales.length === 0) return;
		scalesFollowLayout = true;
		const remeasure = () => {
			for (const entry of scales) printScale(entry.scale, entry.unit);
		};
		let frame = 0;
		function remeasureNextFrame() {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(remeasure);
		}
		window.addEventListener('resize', remeasureNextFrame);
		/* Line boxes can shift once the web fonts have loaded. */
		document.fonts?.ready?.then(remeasure);
	}

	function printScale(scale, unit) {
		const basePx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
		const inUnit = (px) => (unit === 'rem' ? `${+(px / basePx).toFixed(3)}rem` : `${+px.toFixed(1)}px`);

		for (const row of scale.querySelectorAll('[data-basalt-type-row]')) {
			const sample = row.querySelector('[data-basalt-type-sample]');
			const readout = row.querySelector('[data-basalt-type-spec]');
			if (!sample || !readout) continue;
			const style = getComputedStyle(sample);
			const fontPx = parseFloat(style.fontSize);
			const leadingPx = style.lineHeight === 'normal' ? fontPx * 1.2 : parseFloat(style.lineHeight);
			readout.textContent = `${inUnit(fontPx)} / ${inUnit(leadingPx)} · ${style.fontWeight}`;
		}
	}

	/* Key labels: data-basalt-key="mod" becomes ⌘ on Apple devices and Ctrl
     elsewhere, and keys inside [data-basalt-keys-live] light up while held. */
	function labelKeys(scope) {
		const base = scope || document;
		for (const key of base.querySelectorAll('kbd[data-basalt-key]')) {
			const name = key.getAttribute('data-basalt-key');
			key.textContent = MODIFIER_LABELS[name.toLowerCase()] || name;
		}
		for (const key of base.querySelectorAll('kbd:not([data-basalt-key])')) {
			if (!key.childElementCount) relabelWrittenKey(key);
		}

		const listening = liveBlocks.length > 0;
		liveBlocks.push(...unclaimed(scope, '[data-basalt-keys-live]', '_basaltKeysLive'));
		if (listening || liveBlocks.length === 0) return;

		document.addEventListener('keydown', (event) => {
			if (!event.target.closest?.('input, textarea, select, [contenteditable]')) pressKeys(event, true);
		});
		document.addEventListener('keyup', (event) => pressKeys(event, false));
		window.addEventListener('blur', () => {
			for (const block of liveBlocks) {
				for (const pressed of block.querySelectorAll('.is-pressed')) pressed.classList.remove('is-pressed');
			}
		});
	}

	function relabelWrittenKey(key) {
		const written = key.textContent.trim();
		if (WRITTEN_KEYS[written]) {
			key.textContent = WRITTEN_KEYS[written];
			return;
		}
		/* A combined hint such as ⌘K in the top bar. */
		const combo = /^(⌘|Ctrl)\s*\+?\s*(\S)$/.exec(written);
		if (combo) key.textContent = `${onApple ? '⌘' : 'Ctrl '}${combo[2]}`;
	}

	/** Lights or dims the live keys that match a keyboard event. */
	function pressKeys(event, down) {
		const names = keyNamesFor(event);
		if (names.length === 0) return;
		for (const block of liveBlocks) {
			for (const key of block.querySelectorAll('kbd[data-basalt-key]')) {
				if (names.includes(key.getAttribute('data-basalt-key'))) key.classList.toggle('is-pressed', down);
			}
		}
	}

	function keyNamesFor(event) {
		if (event.key === 'Meta' || event.key === 'Control') return ['mod'];
		if (event.key?.length === 1) return [event.key.toUpperCase(), event.key];
		return [];
	}

	/* Read more: the button only shows while the text it controls is clipped,
     or while that text is expanded and can be folded again. */
	function setUpClamps(scope) {
		for (const button of unclaimed(scope, '[data-basalt-clamp-toggle]', '_basaltClamp')) {
			const body = document.getElementById(button.getAttribute('aria-controls'));
			const caption = button.querySelector('span');
			button.addEventListener('click', () => {
				const expand = !body.classList.contains('is-open');
				window.Basalt.slide(body, () => body.classList.toggle('is-open', expand));
				button.setAttribute('aria-expanded', String(expand));
				if (caption) caption.textContent = expand ? 'Show less' : 'Read more';
				showClampButton(button);
			});
			showClampButton(button);
			if ('ResizeObserver' in window)
				new ResizeObserver(() => requestAnimationFrame(() => showClampButton(button))).observe(body);
		}
	}

	function showClampButton(button) {
		const body = document.getElementById(button.getAttribute('aria-controls'));
		if (!body) return;
		button.hidden = body.classList.contains('is-open') ? false : body.scrollHeight <= body.clientHeight + 1;
	}

	/* Collapsing breadcrumb: the first level and the last (max - 1) levels
     stay, everything between waits behind a button that restores the trail. */
	function foldBreadcrumbs(scope) {
		for (const trail of unclaimed(scope, '.basalt-breadcrumb-collapse', '_basaltBreadcrumb')) {
			const limit = Math.max(2, Number(trail.getAttribute('data-basalt-breadcrumb-max')) || 4);
			const levels = [...trail.children];
			if (levels.length > limit + 1) hideMiddleLevels(trail, levels, limit);
		}
	}

	function hideMiddleLevels(trail, levels, limit) {
		const hidden = levels.slice(1, levels.length - (limit - 1));
		for (const level of hidden) level.classList.add('is-folded');

		const holder = document.createElement('li');
		holder.className = 'breadcrumb-item';
		holder.innerHTML =
			'<button type="button" class="basalt-breadcrumb-more" aria-expanded="false"><i class="bi bi-three-dots" aria-hidden="true"></i></button>';
		const more = holder.firstElementChild;
		more.setAttribute('aria-label', `Show ${hidden.length} more levels`);
		levels[0].after(holder);

		more.addEventListener('click', () => {
			for (const level of hidden) level.classList.remove('is-folded');
			holder.remove();
			hidden[0].querySelector('a, [tabindex]')?.focus();
			trail.dispatchEvent(
				new CustomEvent('basalt:breadcrumbopen', { bubbles: true, detail: { count: hidden.length } }),
			);
		});
	}

	start();
})();

/* 
   Scroll fades
     Any strip that scrolls sideways (tabs, tags, chips, filter rows) fades
     out at the edge that has more to see, so the visitor can tell there is
     more there. Found automatically; tables and wide grids are left alone.
     Opt out with data-basalt-no-fade.
    */
(() => {
	'use strict';
	const seen = new WeakSet();
	function update(el) {
		const max = el.scrollWidth - el.clientWidth;
		el.classList.toggle('has-fade-start', max > 1 && el.scrollLeft > 1);
		el.classList.toggle('has-fade-end', max > 1 && el.scrollLeft < max - 1);
	}
	function isStrip(el) {
		if (el.matches('pre, code, textarea, input') || el.hasAttribute('data-basalt-no-fade')) return false;
		const cs = getComputedStyle(el);
		if (cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') return false;
		/* A wide table's wrapper dims its edges the same way, at any height. */
		if (el.querySelector(':scope > table, :scope > .table')) return el.clientHeight > 0;
		if (el.querySelector('table, canvas, svg.basalt-graph-svg, textarea, pre')) return false;
		return el.clientHeight > 0 && el.clientHeight < 160;
	}
	/* Reads everything first and writes after, so a scan costs one layout. */
	function scan() {
		const found = [];

		for (const el of document.querySelectorAll('.basalt-stage *, .offcanvas *, .modal *')) {
			if (!seen.has(el) && el.scrollWidth > el.clientWidth + 1 && isStrip(el)) found.push(el);
		}

		for (const el of found) {
			seen.add(el);
			el.classList.add('basalt-scroll-fade');
			el.addEventListener('scroll', () => update(el), { passive: true });
			if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(() => update(el))).observe(el);
			update(el);
		}
	}
	/* Pages that tick (clocks, timers) change the DOM every second, so
     rescans are batched and spaced out. */
	let timer = 0;
	function later() {
		clearTimeout(timer);
		timer = setTimeout(scan, 400);
	}
	document.addEventListener('DOMContentLoaded', () => {
		scan();
		window.addEventListener('resize', later, { passive: true });
		new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
		document.addEventListener('shown.bs.tab', later);
		document.addEventListener('shown.bs.modal', later);
		document.addEventListener('shown.bs.offcanvas', later);
	});
})();

/* 
   Motion (opt-in, overview pages only)
   [data-basalt-motion] on a container: its top-level cards rise into
   place once, 30ms apart (at most ten of them). [data-basalt-countup] on a
   headline figure: it counts up from zero once, keeping its prefix,
   suffix, decimals and thousands commas. Both are skipped when the
   visitor asks for reduced motion. The styles are in basalt.css. Charts
   keep Chart.js's draw-in, set to 0.6s, and none with reduced motion.
   All opening movement waits for Basalt.settled: the moment the page has
   finished building its charts and lists. Started any earlier, it would
   stall behind that work and stutter.
    */
(() => {
	'use strict';
	let isSettled = false;
	/* Every page script has run by DOMContentLoaded; the frame after it shows
	   the stage whole (basalt.css keeps it hidden until then). A deferred
	   script runs while the document is already "interactive" but before that
	   event, so only a finished document counts as ready; load is the backstop
	   for a copy of basalt.js added after DOMContentLoaded. */
	const built = () => requestAnimationFrame(() => document.documentElement.classList.add('basalt-built'));
	if (document.readyState === 'complete') built();
	else {
		document.addEventListener('DOMContentLoaded', built, { once: true });
		window.addEventListener('load', built, { once: true });
	}
	const settled = new Promise((done) => {
		const go = () =>
			requestAnimationFrame(() =>
				requestAnimationFrame(() => {
					isSettled = true;
					document.documentElement.classList.remove('basalt-motion-held');
					done();
				}),
			);
		const idle = () =>
			window.requestIdleCallback ? requestIdleCallback(go, { timeout: 400 }) : setTimeout(go, 80);
		/* A page that shows loading placeholders ([aria-busy="true"]) settles
		   once its real content is in, and never later than 1.5s after opening. */
		const began = performance.now();
		const quiet = () => {
			if (document.querySelector('.basalt-stage [aria-busy="true"]') && performance.now() - began < 1500)
				setTimeout(quiet, 50);
			else idle();
		};
		if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', quiet);
		else quiet();
	});
	window.Basalt = window.Basalt || {};
	window.Basalt.settled = settled;
	/* Charts draw in once, quickly; a chart that sets its own animation keeps it. */
	if (window.Chart) {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) window.Chart.defaults.animation = false;
		else Object.assign(window.Chart.defaults.animation, { duration: 600, easing: 'easeOutQuart' });
		/* A hovered ring or pie slice keeps its own color and only lifts out;
		   Chart.js would otherwise darken it into a shade off the palette. */
		for (const kind of ['doughnut', 'pie', 'polarArea']) {
			const defaults = window.Chart.defaults.datasets[kind];
			if (!defaults) continue;
			defaults.hoverBackgroundColor = (context, options) => options.backgroundColor;
			defaults.hoverBorderColor = (context, options) => options.borderColor;
		}
		/* Every chart draws without moving at first. One on screen stays
		   hidden until the page has settled, then rises; one out of sight
		   (below the fold, in a closed tab) plays its draw-in the first time
		   it scrolls into view, so its bars rise as it appears. */
		if (window.IntersectionObserver && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			const play = (chart) => {
				if (!chart.canvas) return;
				chart.canvas.classList.remove('basalt-chart-held');
				/* A chart the page has replaced or destroyed meanwhile is left alone. */
				if (!chart.$basaltWaiting || window.Chart.getChart(chart.canvas) !== chart) return;
				chart.$basaltWaiting = false;
				chart.options.animation = chart.$basaltAnimation;
				/* Inside a card that is still rising, the chart shows its empty
				   axes and starts once the card is mostly in, so the rise is seen. */
				const card = chart.canvas.closest('.basalt-enter');
				const wait = card ? 220 + (parseFloat(card.style.animationDelay) || 0) : 0;
				chart.reset();
				if (!wait) {
					chart.update();
					return;
				}
				chart.draw();
				setTimeout(() => {
					if (window.Chart.getChart(chart.canvas) === chart) chart.update();
				}, wait);
			};
			/* The observer says whether each chart is on screen without making the
			   browser measure the page, which would cost a frame just as the
			   motion starts. One out of sight shows, still, until it comes in. */
			const waiting = new IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						if (!entry.isIntersecting) {
							entry.target.classList.remove('basalt-chart-held');
							continue;
						}
						waiting.unobserve(entry.target);
						const chart = window.Chart.getChart(entry.target);
						if (chart) play(chart);
					}
				},
				{ threshold: 0.3 },
			);
			window.Chart.register({
				id: 'basaltOnSight',
				afterInit(chart) {
					if (chart.options.animation === false) return;
					chart.$basaltWaiting = true;
					chart.$basaltAnimation = chart.options.animation;
					chart.options.animation = false;
					if (!isSettled) chart.canvas.classList.add('basalt-chart-held');
					settled.then(() => {
						if (chart.canvas) waiting.observe(chart.canvas);
					});
				},
			});
		}
	}
	const still = window.matchMedia('(prefers-reduced-motion: reduce)');
	window.Basalt.countUp = countUp;
	if (still.matches) return;

	/* Every animation on the page, the cards' and the page's own, holds its
	   first frame until the page has settled, then all of them play together. */
	if (!isSettled) document.documentElement.classList.add('basalt-motion-held');
	for (const box of document.querySelectorAll('[data-basalt-motion]')) {
		const cards = Array.from(box.querySelectorAll('.card')).filter((c) => !c.parentElement.closest('.card'));
		cards.slice(0, 10).forEach((card, i) => {
			card.style.animationDelay = `${i * 30}ms`;
			card.classList.add('basalt-enter');
		});
	}

	/* Page scripts draw their figures as the document finishes parsing, so
	   the count waits one frame after that to find them too. */
	document.addEventListener('DOMContentLoaded', () =>
		requestAnimationFrame(() => countUp(document.querySelectorAll('[data-basalt-countup]'))),
	);

	/**
	 * Rolls each figure up from zero to the text it holds, keeping its prefix,
	 * suffix, decimals and thousands commas; does nothing for visitors who ask
	 * for less motion. Pages call it again on figures they draw later.
	 * @param {Iterable<Element>} figures
	 */
	function countUp(figures) {
		if (still.matches) return;
		for (const el of figures) {
			/* Only the text that holds the number moves, so a unit set in its
			   own element beside it stays put. */
			const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
			let node = walker.nextNode();
			while (node && !/[0-9]/.test(node.nodeValue)) node = walker.nextNode();
			if (!node) continue;
			const label = el.textContent.trim();
			const text = node.nodeValue;
			const m = text.match(/^([^0-9]*)([0-9][0-9,]*(?:\.[0-9]+)?)([^]*)$/);
			/* A date or a range ("Oct 8, 2026", "19 of 29") is not one figure. */
			if (!m || /[0-9]/.test(m[3])) continue;
			const target = parseFloat(m[2].replace(/,/g, ''));
			const decimals = (m[2].split('.')[1] || '').length;
			const commas = m[2].includes(',');
			const show = (v) =>
				m[1] +
				(commas
					? v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
					: v.toFixed(decimals)) +
				m[3];
			el.setAttribute('aria-label', label);
			/* The figure shows its starting zero at once and counts once the page has settled. */
			node.nodeValue = show(0);
			let began = null;
			let shown = node.nodeValue;
			const step = (now) => {
				/* The page's own script rewrote the figure: let it be. */
				if (!node.isConnected || (shown !== null && node.nodeValue !== shown)) {
					el.removeAttribute('aria-label');
					return;
				}
				began ??= now;
				const t = Math.min(1, (now - began) / 500);
				shown = t < 1 ? show(target * (1 - Math.pow(1 - t, 3))) : text;
				node.nodeValue = shown;
				if (t < 1) requestAnimationFrame(step);
				else el.removeAttribute('aria-label');
			};
			settled.then(() => requestAnimationFrame(step));
		}
	}
})();

/*
   Bars grow into view
   A bar fill (a class ending in -fill, -bar, -meter-fill or -len, or a
   Bootstrap .progress-bar) that sits in its track like a fill grows out of
   it once, the first time it scrolls into view: sideways from the left for
   a horizontal bar, up from the base for a column. Bars drawn while the page
   opens are all found; ones drawn later by a filter or a tab change are left
   alone. [data-basalt-no-grow] on a bar or any parent opts it out. Skipped
   for visitors who ask for less motion. The styles are in basalt.css.
    */
(() => {
	'use strict';
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.IntersectionObserver) return;
	const NAMED = /(?:^|-)(?:fill|bar|meter-fill|len)$|^progress-bar$/;
	/* Pieces of a stacked bar would grow one by one, so they stay put. */
	const PIECE = /(?:^|-)(?:seg|part|block|text|track)(?:-|$)/;
	const seen = new WeakSet();
	/* A stacked bar's track is often named like a bar itself (-bar), so it is
	   kept apart from the bars already looked at. */
	const stacks = new WeakSet();
	let open = true;

	function shape(el) {
		/* Something that already animates itself (a page's own ring draw-in)
		   is left to it. */
		if (el.closest('[data-basalt-no-grow]') || getComputedStyle(el).animationName !== 'none') return null;
		if (el instanceof SVGElement) return arcOrLine(el);
		/* Icon names end in -fill too (bi-star-fill); an icon is not a bar. */
		if (el.matches('i, [class^="bi"], [class*=" bi-"]')) return null;
		const names = Array.from(el.classList);
		const r = el.getBoundingClientRect();
		if (r.width < 1 || r.height < 1) return null;
		/* A stacked bar grows as one: its first piece stands for the track. */
		if (names.some((n) => /(?:^|-)seg$/.test(n))) return null;
		if (!names.some((n) => NAMED.test(n)) || names.some((n) => PIECE.test(n))) return null;
		if (getComputedStyle(el).transform !== 'none') return null;
		const p = el.parentElement.getBoundingClientRect();
		if (r.height <= 24 && Math.abs(r.left - p.left) < 2 && r.width < p.width - 1) return 'x';
		if (r.width <= 60 && Math.abs(r.bottom - p.bottom) < 2 && r.height < p.height - 1) return 'y';
		return null;
	}

	/* A ring's arc is a dash set as "share total" on a small svg; a sparkline
	   is a small svg whose class names it a spark or a trend. */
	function arcOrLine(el) {
		if (el.matches('svg')) {
			const box = el.getBoundingClientRect();
			const names = `${el.getAttribute('class') || ''} ${el.parentElement.getAttribute('class') || ''}`;
			if (box.height > 0 && box.height <= 140 && /spark|trend/.test(names)) return 'line';
			return null;
		}
		if (!el.matches('circle, path')) return null;
		const dash = getComputedStyle(el)
			.strokeDasharray.split(/[\s,]+/)
			.map(parseFloat);
		const svg = el.ownerSVGElement;
		if (
			dash.length !== 2 ||
			!(dash[0] > 0) ||
			dash[0] + dash[1] < 40 ||
			!svg ||
			svg.getBoundingClientRect().width > 260
		)
			return null;
		el.style.setProperty('--basalt-arc-total', dash[0] + dash[1]);
		return 'arc';
	}

	/* A row of five or more small, alike, colored pieces with no text, such
	   as a block meter or a strip of daily columns, moves as a wave: the
	   pieces rise or fill one after another. Columns rise from their base;
	   blocks on one line fill in from the left. */
	function waveOf(row) {
		/* A spark drawn as svg columns waves too. */
		if (row.matches('svg') && /spark|trend/.test(row.getAttribute('class') || '')) {
			const columns = Array.from(row.querySelectorAll('rect'));
			return columns.length >= 5 ? [columns, 'y'] : null;
		}
		const kids = Array.from(row.children);
		if (kids.length < 5 || row.closest('[data-basalt-no-grow]')) return null;
		const first = (kids[0].getAttribute('class') || '').split(/\s+/)[0];
		if (!first || /^(?:bi|badge|btn|basalt-avatar)/.test(first)) return null;
		const alike = kids.filter((k) => (k.getAttribute('class') || '').split(/\s+/)[0] === first);
		if (alike.length < 5 || alike.length < kids.length * 0.8 || alike.some((k) => seen.has(k))) return null;
		const boxes = alike.map((k) => k.getBoundingClientRect());
		if (boxes.some((b) => b.width < 1 || b.width > 40 || b.height < 2 || b.height > 60)) return null;
		if (alike.some((k) => k.textContent.trim() || getComputedStyle(k).transform !== 'none')) return null;
		const filled = alike.filter((k) => {
			const s = getComputedStyle(k);
			return s.backgroundImage !== 'none' || !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor);
		});
		if (filled.length < alike.length * 0.6) return null;
		const tops = new Set(boxes.map((b) => Math.round(b.top)));
		const bases = new Set(boxes.map((b) => Math.round(b.bottom)));
		const axis = bases.size <= 2 && tops.size > 2 ? 'y' : tops.size <= 2 ? 'pop' : null;
		return axis ? [alike, axis] : null;
	}

	/* The track behind a stacked bar, found from its pieces. */
	function stackOf(el) {
		if (!Array.from(el.classList).some((n) => /(?:^|-)seg$/.test(n))) return null;
		const track = el.parentElement;
		if (!track || stacks.has(track) || track.dataset.basaltGrow || track.closest('[data-basalt-no-grow]'))
			return null;
		const r = track.getBoundingClientRect();
		if (r.width < 1 || r.height < 1 || r.height > 24) return null;
		stacks.add(track);
		return track;
	}

	/* A bar shrunk to nothing has no area to be seen, so its track is
	   watched instead, and grows every bar waiting inside it. */
	const waiting = new Map();
	const watch = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				watch.unobserve(entry.target);
				const pieces = waiting.get(entry.target) || [];
				/* Grows wait for the page to settle, so they never stall mid-move. */
				(window.Basalt.settled || Promise.resolve()).then(() => {
					for (const el of pieces) grow(el);
				});
				waiting.delete(entry.target);
			}
		},
		{ threshold: 0.25 },
	);

	function grow(el) {
		const axis = el.dataset.basaltGrow;
		el.classList.remove(`basalt-grow-wait-${axis}`);
		el.classList.add(`basalt-grow-${axis}`);
		el.addEventListener(
			'animationend',
			() => {
				el.classList.remove(`basalt-grow-${axis}`);
				el.style.removeProperty('--basalt-grow-i');
			},
			{ once: true },
		);
	}

	/* Reads every bar first and writes after, so a scan costs one layout. */
	function scan() {
		const found = [];
		for (const el of document.querySelectorAll(
			'.basalt-stage [class], .basalt-stage svg circle, .basalt-stage svg path',
		)) {
			if (seen.has(el)) continue;
			seen.add(el);
			const track = stackOf(el);
			if (track) {
				found.push([track, 'x']);
				continue;
			}
			const wave = waveOf(el);
			if (wave) {
				const [pieces, axis] = wave;
				for (const piece of pieces) seen.add(piece);
				/* However many pieces, the wave takes about a second end to end. */
				const step = `${Math.min(axis === 'pop' ? 45 : 30, Math.round(1100 / pieces.length))}ms`;
				pieces.forEach((piece, i) => {
					piece.dataset.basaltGrow = axis;
					piece.style.setProperty('--basalt-grow-i', i);
					piece.style.setProperty('--basalt-grow-step', step);
					piece.classList.add(`basalt-grow-wait-${axis}`);
				});
				waiting.set(el, pieces);
				watch.observe(el);
				continue;
			}
			const axis = shape(el);
			if (axis) found.push([el, axis]);
		}
		/* Bars in the same track group follow one another, 40ms apart. */
		const order = new Map();
		for (const [el, axis] of found) {
			const group = el.parentElement.parentElement;
			const i = order.get(group) ?? 0;
			order.set(group, i + 1);
			el.dataset.basaltGrow = axis;
			el.style.setProperty('--basalt-grow-i', Math.min(i, 12));
			el.classList.add(`basalt-grow-wait-${axis}`);
			const track = axis === 'arc' ? el.ownerSVGElement : el.parentElement;
			if (!waiting.has(track)) {
				waiting.set(track, []);
				watch.observe(track);
			}
			waiting.get(track).push(el);
		}
	}

	/* Page scripts draw their bars as the document finishes parsing, so the
	   scan waits a frame, then keeps looking for a moment for late ones. */
	document.addEventListener('DOMContentLoaded', () => {
		requestAnimationFrame(scan);
		let timer = 0;
		const late = new MutationObserver(() => {
			if (!open) return;
			clearTimeout(timer);
			timer = setTimeout(scan, 60);
		});
		late.observe(document.body, { childList: true, subtree: true });
		setTimeout(() => {
			open = false;
			late.disconnect();
		}, 1500);
	});
})();

/*
   Back links
   [data-basalt-back] on a link works like the browser's back button when
   the visitor came from another page of this site, so they land exactly
   where they were (same list, same filters, same scroll). Opened from a
   bookmark or a new tab, the link's own href takes them to the list.
    */
document.addEventListener('click', (e) => {
	const link = e.target.closest && e.target.closest('a[data-basalt-back]');
	if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
	let fromHere;
	try {
		fromHere = !!document.referrer && new URL(document.referrer).origin === location.origin;
	} catch {
		fromHere = false;
	}
	if (fromHere && window.history.length > 1) {
		e.preventDefault();
		window.history.back();
	}
});

/* Lists are drawn by script after the page loads, so the browser's own
   scroll restore on Back can land short. Remember where the page was and
   put it back once the page has been drawn. */
(() => {
	'use strict';
	const key = `basalt-scroll:${location.pathname}${location.search}`;
	window.addEventListener('pagehide', () => {
		try {
			sessionStorage.setItem(key, String(Math.round(window.scrollY)));
		} catch {
			/* storage blocked */
		}
	});
	const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
	if (!nav || nav.type !== 'back_forward') return;
	let y = 0;
	try {
		y = Number(sessionStorage.getItem(key)) || 0;
	} catch {
		y = 0;
	}
	if (!y) return;

	function restore() {
		return window.scrollTo(0, y);
	}

	window.addEventListener('load', () => {
		restore();
		setTimeout(restore, 250);
		setTimeout(restore, 900);
	});
})();

/* 
   Full screen
   The top-bar button puts the whole page full screen and back; Esc
   works too. Browsers without the Fullscreen API never show it.
    */
(() => {
	'use strict';
	const btns = document.querySelectorAll('[data-basalt-fullscreen]');
	if (!btns.length) return;
	const root = document.documentElement;
	if (!document.fullscreenEnabled || !root.requestFullscreen) {
		for (const b of btns) {
			b.hidden = true;
		}

		return;
	}

	function sync() {
		const on = Boolean(document.fullscreenElement);

		for (const b of btns) {
			const label = on ? 'Exit full screen' : 'Full screen';
			b.setAttribute('aria-pressed', String(on));
			b.setAttribute('aria-label', label);
			b.setAttribute('data-bs-title', label);
			const tip = window.bootstrap && window.bootstrap.Tooltip.getInstance(b);
			if (tip) tip.setContent({ '.tooltip-inner': label });
		}
	}

	for (const b of btns) {
		b.addEventListener('click', () => {
			const go = document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen();
			if (go && go.catch) go.catch(() => {});
		});
	}

	document.addEventListener('fullscreenchange', sync);
	sync();
})();

/**
 * The keyboard shortcuts sheet, opened from "Shortcuts" in the account menu
 * ([data-basalt-shortcuts]). It lists the keys that work on every page, then
 * the letter shortcuts this page binds with data-basalt-shortcut, read from
 * the buttons themselves. The dialog is built the first time it opens.
 */
(() => {
	'use strict';

	const apple = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
	const mod = apple ? '⌘' : 'Ctrl';
	const alt = apple ? '⌥' : 'Alt';
	const EVERYWHERE = [
		[[mod, 'K'], 'Search the menu and pages'],
		[[alt, 'T'], 'Go to the latest notice'],
		[['Esc'], 'Close a menu, dialog or panel'],
		[['A–Z'], 'In an open menu, jump to the item'],
		[['←', '→'], 'Move between tabs and options'],
	];
	let dialog = null;

	function keys(list) {
		return list.map((key) => `<kbd>${key}</kbd>`).join(' ');
	}

	function rows(list) {
		return list.map(([combo, what]) => `<div><dt>${keys(combo)}</dt><dd>${what}</dd></div>`).join('');
	}

	/** This page's letter shortcuts, named after the button they press. */
	function pageKeys() {
		const seen = new Set();
		const found = [];
		for (const el of document.querySelectorAll('[data-basalt-shortcut]')) {
			const letter = el.getAttribute('data-basalt-shortcut').toUpperCase();
			const name = (el.getAttribute('aria-label') || el.textContent).replace(/\s+/g, ' ').trim();
			if (!name || seen.has(letter)) continue;
			seen.add(letter);
			found.push([[letter], name]);
		}
		return found;
	}

	function build() {
		dialog = document.createElement('div');
		dialog.className = 'modal fade';
		dialog.tabIndex = -1;
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-labelledby', 'basalt-keys-title');
		dialog.innerHTML = `<div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content"><div class="basalt-dialog-head"><span class="basalt-dialog-head-icon" aria-hidden="true"><i class="bi bi-keyboard"></i></span><div><h2 id="basalt-keys-title" class="basalt-dialog-head-title">Keyboard shortcuts</h2><p class="basalt-dialog-head-sub">They work anywhere unless you are typing in a field.</p></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body"><div class="basalt-keys"><section><h3 class="basalt-keys-title">Everywhere</h3><dl class="basalt-keys-list">${rows(EVERYWHERE)}</dl></section><section data-basalt-keys-page></section></div></div></div></div>`;
		document.body.append(dialog);
	}

	function open() {
		if (!dialog) build();
		const page = pageKeys();
		dialog.querySelector('[data-basalt-keys-page]').innerHTML = page.length
			? `<h3 class="basalt-keys-title">On this page</h3><dl class="basalt-keys-list">${rows(page)}</dl>`
			: '<h3 class="basalt-keys-title">On this page</h3><p class="basalt-keys-none">This page adds no letter shortcuts of its own.</p>';
		window.bootstrap?.Modal.getOrCreateInstance(dialog).show();
	}

	document.addEventListener('click', (event) => {
		if (event.target.closest('[data-basalt-shortcuts]')) open();
	});
})();
