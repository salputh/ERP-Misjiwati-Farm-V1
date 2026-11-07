/**
 * Component script for trees, sortable lists and transfer lists. It loads after assets/basalt/js/basalt.js, and
 * only on the pages that use it; documentation.html#page-map lists them.
 */

/**
 * Trees, sortable lists and transfer lists, demonstrated on tree-and-sortable.html.
 *   [data-basalt-tree]   an ARIA tree (role="tree"): one tab stop with arrow
 *       keys, type-ahead, selection, tri-state checkboxes (-check), child
 *       counts (-counts), folders that load on demand, renaming in place
 *       (-rename) and drag and drop (-dnd). window.Basalt.tree(el) hands
 *       back its api.
 *   [data-basalt-tree-search="#tree"]   narrows a tree while typing.
 *   [data-basalt-tree-cmd], [-check-all], [-check-none], [-expand],
 *       [-collapse]   buttons that work on a tree.
 *   [data-basalt-sortable]   a list, list group or grid reordered with the
 *       pointer or the keyboard; lists sharing a data-basalt-sortable-group
 *       pass items between them, like a board. Dispatches
 *       'basalt:sortable-change'.
 *   [data-basalt-transfer]   two checkbox lists with a filter and buttons
 *       that carry the checked rows from one side to the other.
 * For markup added later: window.Basalt.tree(el), window.Basalt.sortable(el)
 * and window.Basalt.transfer(el).
 */
(() => {
	'use strict';
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	/** Every match for a selector inside root (the page by default), as an array. */
	function $$(sel, root) {
		return [...(root || document).querySelectorAll(sel)];
	}

	/** Makes text safe to place inside markup or an attribute value. */
	function htmlSafe(s) {
		return s.replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch]);
	}

	/* Screen reader messages go through the page-wide live region. */
	function announce(message) {
		return window.Basalt.announce(message);
	}

	/**
	 * Runs a DOM change, then glides each element from where it sat before to
	 * where it sits now. With reduced motion the change simply happens.
	 * @param {HTMLElement[]} elements  The elements whose move should be animated.
	 * @param {() => void} change  Moves them.
	 */
	function flip(elements, change) {
		const glide = !reduceMotion.matches;
		const startRects = new Map();
		if (glide) {
			for (const el of elements) startRects.set(el, el.getBoundingClientRect());
		}
		change();
		if (!glide) return;
		for (const el of elements) {
			if (!el.isConnected) continue;
			const from = startRects.get(el);
			const to = el.getBoundingClientRect();
			const shiftX = from.left - to.left;
			const shiftY = from.top - to.top;
			if (shiftX || shiftY) {
				el.animate([{ transform: `translate(${shiftX}px,${shiftY}px)` }, { transform: 'none' }], {
					duration: 220,
					easing: 'cubic-bezier(.2,.7,.3,1)',
				});
			}
		}
	}

	/** Replays a short highlight class on an element, even when it is already showing. */
	function flash(el, cls) {
		el.classList.remove(cls);
		void el.offsetWidth;
		el.classList.add(cls);
		setTimeout(() => el.classList.remove(cls), 1300);
	}

	/* Tree: a nested list that behaves like a file explorer.
     The markup is <ul class="basalt-tree" role="tree" data-basalt-tree>, and
     a treeitem that holds a role="group" list is treated as a folder. These
     switches go on the tree element itself:
       data-basalt-tree-check    each row gets a tri-state box (aria-checked)
       data-basalt-tree-count    selector of a node that reads "n of m" checked
       data-basalt-tree-counts   folders print how many files they contain
       data-basalt-tree-out      selector of a node that spells the chosen path
       data-basalt-tree-rename   F2 or a double-click edits a name in place
       data-basalt-tree-dnd      rows can be dragged, or moved with Alt + arrows
       data-basalt-tree-status   selector of a node that reports the last move
     The tree dispatches basalt:tree-select, basalt:tree-check, basalt:tree-move,
     basalt:tree-rename and, for folders filled on demand, basalt:tree-load. */
	const trees = new Map();
	const LABEL_IN_ROW = ':scope > .basalt-tree-row .basalt-tree-label';
	const TREE_BUTTONS =
		'[data-basalt-tree-cmd], [data-basalt-tree-check-all], [data-basalt-tree-check-none], [data-basalt-tree-expand], [data-basalt-tree-collapse]';
	const TREE_TARGETS = [
		'basaltTreeFor',
		'basaltTreeCheckAll',
		'basaltTreeCheckNone',
		'basaltTreeExpand',
		'basaltTreeCollapse',
	];

	/**
	 * Brings one role="tree" list to life and remembers it in `trees`.
	 * @param {HTMLElement} tree  The list that carries data-basalt-tree.
	 * @returns {object} The handle that window.Basalt.tree(el) gives back.
	 */
	function Tree(tree) {
		const [checkable, tallies, renamable, movable] = ['check', 'counts', 'rename', 'dnd'].map((flag) =>
			tree.hasAttribute(`data-basalt-tree-${flag}`),
		);
		const pathOutput = nodeFor(tree.dataset.basaltTreeOut);
		const tallyOutput = nodeFor(tree.dataset.basaltTreeCount);
		const moveReport = nodeFor(tree.dataset.basaltTreeStatus);
		const undoLog = [];
		const marker = document.createElement('div');
		marker.className = 'basalt-tree-drop';
		marker.hidden = true;

		/* Pointer drags: a mouse or pen can pick a row up anywhere, while touch
       has to start on the grip so that a plain swipe still scrolls. */
		let grab = null;
		let muteNextClick = false;
		let typedPrefix = '';
		let prefixTimer = null;

		const ARROW_MOVES = new Map([
			['ArrowUp', 'up'],
			['ArrowDown', 'down'],
			['ArrowRight', 'in'],
			['ArrowLeft', 'out'],
		]);
		const shifts = new Map([
			['up', { slot: slotAbove, refusal: (name) => `${name} is already at the top.` }],
			['down', { slot: slotBelow, refusal: (name) => `${name} is already at the bottom.` }],
			['in', { slot: slotInside, refusal: (name) => `There is no folder just above ${name}.` }],
			['out', { slot: slotOutside, refusal: (name) => `${name} is not in a folder.` }],
		]);
		const keyActions = new Map([
			['ArrowDown', (item, order, at) => moveFocus(order[at + 1])],
			['ArrowUp', (item, order, at) => moveFocus(order[at - 1])],
			['Home', (item, order) => moveFocus(order[0])],
			['End', (item, order) => moveFocus(order[order.length - 1])],
			['ArrowRight', stepInto],
			['ArrowLeft', stepOut],
			['Enter', (item) => activate(item, true)],
			[' ', (item) => activate(item, false)],
			['*', openPeerFolders],
			['F2', (item) => (renamable ? editName(item) : false)],
		]);

		function mount() {
			if (movable) enableDragging();
			tree.addEventListener('click', onRowClick);
			tree.addEventListener('dblclick', onLabelDoubleClick);
			tree.addEventListener('keydown', onTreeKey);
			redraw();
			if (checkable) settleChecks();
			for (const folder of everyItem()) {
				if (folder.getAttribute('aria-expanded') === 'true') setFolderGlyph(folder, true);
			}
			const handle = {
				tree,
				setOpen: setExpanded,
				refresh: redraw,
				focusItem: moveFocus,
				command: runCommand,
				current: tabStop,
				labelOf: nameOf,
				allItems: everyItem,
				groupOf: childList,
				setChecked: markBranch,
				syncChecks: settleChecks,
				parentItem: ownerOf,
				isFolder: isFolderItem,
			};
			trees.set(tree, handle);
			return handle;
		}

		/* Reading the structure. Rows, labels and child lists are always direct
       children of their treeitem, so every lookup is anchored with :scope. */
		function isTreeItem(node) {
			return node.getAttribute('role') === 'treeitem';
		}

		/** The role="group" list that holds an item's children, or null. */
		function childList(item) {
			return item.querySelector(':scope > [role="group"]');
		}

		function rowFor(item) {
			return item.querySelector(':scope > .basalt-tree-row');
		}

		/** The visible name of an item, trimmed; empty when it has no label. */
		function nameOf(item) {
			return item.querySelector(LABEL_IN_ROW)?.textContent.trim() ?? '';
		}

		/** True for folders, including lazy ones that have not loaded yet. */
		function isFolderItem(item) {
			return Boolean(childList(item)) || item.hasAttribute('data-basalt-tree-lazy');
		}

		/** The folder an item sits in, or null at the top level. */
		function ownerOf(item) {
			const owner = item.parentElement?.closest('[role="treeitem"]');
			return owner && tree.contains(owner) ? owner : null;
		}

		/** Every treeitem in document order, shown or not. */
		function everyItem() {
			return $$('[role="treeitem"]', tree);
		}

		function rowsIn(list) {
			return Array.from(list.children).filter(isTreeItem);
		}

		function previousItem(item) {
			return stepFrom(item, 'previousElementSibling');
		}

		function nextItem(item) {
			return stepFrom(item, 'nextElementSibling');
		}

		function stepFrom(item, direction) {
			let node = item[direction];
			while (node && !isTreeItem(node)) node = node[direction];
			return node;
		}

		function isShown(item) {
			for (let node = item; node && node !== tree; node = node.parentElement) {
				if (node.hidden) return false;
			}
			return true;
		}

		function shownItems() {
			return everyItem().filter(isShown);
		}

		/** The row that owns the tree's single tab stop, else the first shown row. */
		function tabStop() {
			return tree.querySelector('[role="treeitem"][tabindex="0"]') || shownItems()[0];
		}

		function emit(type, detail) {
			tree.dispatchEvent(new CustomEvent(type, { bubbles: true, detail }));
		}

		/* Row furniture. Each row gains a caret or a spacer, and, when the tree
       asks for them, a grip, a check box and a count badge. */
		function decoration(className, inner) {
			const span = document.createElement('span');
			span.className = className;
			span.setAttribute('aria-hidden', 'true');
			if (inner) span.innerHTML = inner;
			return span;
		}

		function ensureLead(row, folder) {
			const wanted = folder ? 'basalt-tree-caret' : 'basalt-tree-spacer';
			const present = row.querySelector(':scope > .basalt-tree-caret, :scope > .basalt-tree-spacer');
			if (present?.classList.contains(wanted)) return present;
			present?.remove();
			const lead = decoration(wanted, folder ? '<i class="bi bi-chevron-right"></i>' : '');
			row.prepend(lead);
			return lead;
		}

		function dressRow(item) {
			const row = rowFor(item);
			if (!row) return;
			if (!item.hasAttribute('tabindex')) item.tabIndex = -1;
			const folder = isFolderItem(item);
			const lead = ensureLead(row, folder);
			if (movable && !row.querySelector(':scope > .basalt-tree-grip')) {
				row.prepend(decoration('basalt-tree-grip', '<i class="bi bi-grip-vertical"></i>'));
			}
			if (checkable && !row.querySelector(':scope > .basalt-tree-check')) {
				lead.after(decoration('basalt-tree-check', ''));
				if (!item.hasAttribute('aria-checked')) item.setAttribute('aria-checked', 'false');
			}
			if (folder && (checkable || tallies) && !row.querySelector(':scope > .basalt-tree-count')) {
				const badge = document.createElement('span');
				badge.className = 'basalt-tree-count';
				const meta = row.querySelector(':scope > .basalt-tree-meta');
				if (meta) meta.before(badge);
				else row.append(badge);
			}
			if (!checkable && !item.hasAttribute('aria-selected') && tree.querySelector('[aria-selected]')) {
				item.setAttribute('aria-selected', 'false');
			}
		}

		/** Re-dresses every row; call it after adding or removing treeitems. */
		function redraw() {
			for (const item of everyItem()) dressRow(item);

			for (const list of $$('[role="group"]', tree)) {
				const owner = list.parentElement;
				const pending =
					owner?.hasAttribute('data-basalt-tree-lazy') && !owner.hasAttribute('data-basalt-tree-loaded');
				list.classList.toggle(
					'is-empty',
					!pending && !list.querySelector(':scope > [role="treeitem"], :scope > .basalt-tree-skeleton'),
				);
			}

			if (tallies) {
				for (const folder of everyItem().filter(isFolderItem)) {
					const badge = rowFor(folder).querySelector(':scope > .basalt-tree-count');
					const list = childList(folder);
					const files = list ? $$('[role="treeitem"]', list).filter((node) => !isFolderItem(node)).length : 0;
					if (badge) badge.textContent = String(files);
				}
			}

			if (tree.querySelector('[role="treeitem"][tabindex="0"]')) return;
			const entry = tree.querySelector('[aria-selected="true"]') || shownItems()[0];
			if (entry) entry.tabIndex = 0;
		}

		/* Folders opening and closing, with the folder icon kept in step. */
		function setFolderGlyph(item, open) {
			const glyph = rowFor(item)?.querySelector('.basalt-tree-icon-folder');
			if (!glyph) return;
			glyph.classList.toggle('bi-folder2-open', open);
			glyph.classList.toggle('bi-folder2', !open);
		}

		function needsLoading(item) {
			return (
				item.hasAttribute('data-basalt-tree-lazy') &&
				!item.hasAttribute('data-basalt-tree-loaded') &&
				!item.hasAttribute('aria-busy')
			);
		}

		/**
		 * Opens or closes a folder. Opening a lazy folder starts its load.
		 * @param {HTMLElement} item  The folder's treeitem.
		 * @param {boolean} open  The state to end up in.
		 * @param {boolean} [animate]  Slide the branch open or shut.
		 */
		function setExpanded(item, open, animate) {
			const list = childList(item);
			if (!list) return;
			const wasOpen = item.getAttribute('aria-expanded') === 'true';
			const apply = () => {
				item.setAttribute('aria-expanded', String(open));
				list.hidden = !open;
				setFolderGlyph(item, open);
			};
			if (animate && open !== wasOpen) window.Basalt.slide(list, apply);
			else apply();
			if (open && needsLoading(item)) fetchChildren(item);
		}

		function toggleFolder(item) {
			setExpanded(item, item.getAttribute('aria-expanded') !== 'true', true);
		}

		/* Focus and the selected path. */

		/** Gives the tab stop to an item and focuses it; ignores a missing item. */
		function moveFocus(item) {
			if (!item) return;
			for (const node of everyItem()) node.tabIndex = -1;
			item.tabIndex = 0;
			item.focus({ preventScroll: false });
		}

		function trailOf(item) {
			const names = [];
			for (let node = item; node; node = ownerOf(node)) names.push(nameOf(node));
			return names.reverse().join(' / ');
		}

		function choose(item) {
			if (checkable) return;

			for (const node of tree.querySelectorAll('[role="treeitem"]')) {
				node.setAttribute('aria-selected', String(node === item));
			}

			const path = trailOf(item);
			if (pathOutput) pathOutput.textContent = path;
			emit('basalt:tree-select', { item, path });
		}

		function activate(item, alsoToggle) {
			if (item.hasAttribute('data-basalt-tree-retry')) retryFolder(item);
			else if (checkable) flipCheck(item);
			else {
				choose(item);
				if (alsoToggle && isFolderItem(item)) toggleFolder(item);
			}
		}

		/* Tri-state checks. A folder is checked when all of its children are,
       mixed when only some are, and its badge counts the checked files. */
		function leavesUnder(item) {
			const list = childList(item);
			return list ? $$('[role="treeitem"]', list).filter((node) => !childList(node)) : [item];
		}

		function tickedOf(leaves) {
			return leaves.filter((leaf) => leaf.getAttribute('aria-checked') === 'true').length;
		}

		function mixState(states) {
			if (states.length && states.every((state) => state === 'true')) return 'true';
			return states.some((state) => state === 'true' || state === 'mixed') ? 'mixed' : 'false';
		}

		/** Sets aria-checked on an item and on everything below it. */
		function markBranch(item, on) {
			for (const node of [item, ...$$('[role="treeitem"]', item)]) {
				node.setAttribute('aria-checked', String(on));
			}
		}

		/** Recomputes every folder's state, its badge and the tree-wide count. */
		function settleChecks() {
			/* Walk folders deepest first so a parent always reads settled children. */
			for (const folder of everyItem()
				.filter((node) => childList(node))
				.reverse()) {
				folder.setAttribute(
					'aria-checked',
					mixState(rowsIn(childList(folder)).map((kid) => kid.getAttribute('aria-checked'))),
				);
				const badge = rowFor(folder).querySelector(':scope > .basalt-tree-count');
				if (!badge) continue;
				const leaves = leavesUnder(folder);
				badge.textContent = `${tickedOf(leaves)}/${leaves.length}`;
			}

			if (!tallyOutput) return;
			const leaves = everyItem().filter((node) => !childList(node));
			tallyOutput.textContent = `${tickedOf(leaves)} of ${leaves.length}`;
		}

		function flipCheck(item) {
			const on = item.getAttribute('aria-checked') !== 'true';
			markBranch(item, on);
			settleChecks();
			emit('basalt:tree-check', { item, checked: on });
		}

		/* Folders filled on demand. The page answers basalt:tree-load by calling
       detail.resolve(html) or detail.reject(message). */
		function failedRow(message) {
			return `<li role="treeitem" tabindex="-1" data-basalt-tree-retry><div class="basalt-tree-row basalt-tree-row-error"><i class="bi bi-exclamation-circle basalt-tree-icon" aria-hidden="true"></i><span class="basalt-tree-label">${htmlSafe(message || 'Could not load this folder.')}</span><span class="basalt-tree-retry">Retry</span></div></li>`;
		}

		function fetchChildren(item) {
			const list = childList(item);
			item.setAttribute('aria-busy', 'true');
			list.innerHTML =
				'<li class="basalt-tree-skeleton" role="none" aria-hidden="true"><span></span></li>'.repeat(3);
			list.classList.remove('is-empty');
			function settle() {
				item.removeAttribute('aria-busy');
				redraw();
			}
			emit('basalt:tree-load', {
				item,
				key: item.getAttribute('data-basalt-tree-lazy'),
				resolve(html) {
					list.innerHTML = html;
					item.setAttribute('data-basalt-tree-loaded', '');
					settle();
					announce(`${nameOf(item)} loaded, ${rowsIn(list).length} items.`);
				},
				reject(message) {
					list.innerHTML = failedRow(message);
					settle();
					announce(`${nameOf(item)} did not load. Press Enter on the row to try again.`);
				},
			});
		}

		function retryFolder(errorRow) {
			const folder = ownerOf(errorRow);
			if (!folder) return;
			fetchChildren(folder);
			moveFocus(folder);
		}

		/* Renaming in place. Enter or leaving the field keeps the new name,
       Escape throws it away. */
		function editName(item) {
			if (!renamable || !item) return;
			const label = item.querySelector(LABEL_IN_ROW);
			if (!label || label.hidden) return;
			const original = label.textContent.trim();
			const field = document.createElement('input');
			field.type = 'text';
			field.className = 'form-control basalt-tree-rename';
			field.value = original;
			field.setAttribute('aria-label', `New name for ${original}`);
			label.hidden = true;
			label.after(field);
			field.focus();
			/* Leave a file's extension out of the selection, as file managers do. */
			const dot = original.lastIndexOf('.');
			field.setSelectionRange(0, dot > 0 && !isFolderItem(item) ? dot : original.length);

			let finished = false;
			function finish(keep) {
				if (finished) return;
				finished = true;
				const typed = field.value.trim();
				field.remove();
				label.hidden = false;
				if (keep && typed && typed !== original) {
					label.textContent = typed;
					if (item.getAttribute('aria-selected') === 'true' && pathOutput)
						pathOutput.textContent = trailOf(item);
					announce(`Renamed to ${typed}.`);
					emit('basalt:tree-rename', { item, from: original, to: typed });
				}
				moveFocus(item);
			}

			field.addEventListener('keydown', (event) => {
				event.stopPropagation();
				if (event.key !== 'Enter' && event.key !== 'Escape') return;
				event.preventDefault();
				finish(event.key === 'Enter');
			});
			field.addEventListener('blur', () => finish(true));
			for (const type of ['click', 'dblclick', 'pointerdown']) {
				field.addEventListener(type, (event) => event.stopPropagation());
			}
		}

		/* Moving rows, shared by drag and drop, Alt + arrows and the buttons.
       Each move can be undone; the last thirty are kept. */
		function placeText(item) {
			const peers = rowsIn(item.parentElement);
			const owner = ownerOf(item);
			const where = owner ? ` in ${nameOf(owner)}` : ' at the top level';
			return `${nameOf(item)} is now ${peers.indexOf(item) + 1} of ${peers.length}${where}.`;
		}

		function report(text) {
			if (moveReport) moveReport.textContent = text;

			for (const button of $$(`[data-basalt-tree-cmd="undo"][data-basalt-tree-for="#${tree.id}"]`)) {
				button.disabled = !undoLog.length;
			}
		}

		function relocate(item, list, anchor, remember) {
			const parent = item.parentElement;
			const next = item.nextElementSibling;
			const leftFrom = ownerOf(item);
			flip([rowFor(item)], () => list.insertBefore(item, anchor || null));
			if (remember !== false) undoLog.push({ item, parent, next });
			if (undoLog.length > 30) undoLog.shift();
			const landedIn = ownerOf(item);
			if (landedIn && landedIn.getAttribute('aria-expanded') !== 'true') setExpanded(landedIn, true, true);
			redraw();
			flash(item, 'is-moved');
			const text = `Moved. ${placeText(item)}`;
			report(text);
			announce(text);
			emit('basalt:tree-move', {
				item,
				parent: landedIn,
				from: leftFrom,
				index: rowsIn(item.parentElement).indexOf(item),
			});
		}

		function stepBack() {
			const entry = undoLog.pop();
			if (!entry) return;
			const { item, parent, next } = entry;
			relocate(item, parent, next?.parentElement === parent ? next : null, false);
			const text = `Undone. ${placeText(item)}`;
			report(text);
			announce(text);
			moveFocus(item);
		}

		function slotAbove(item) {
			const above = previousItem(item);
			if (above) return { list: item.parentElement, anchor: above };
			const owner = ownerOf(item);
			return owner ? { list: owner.parentElement, anchor: owner } : null;
		}

		function slotBelow(item) {
			const below = nextItem(item);
			if (below) return { list: item.parentElement, anchor: nextItem(below) };
			const owner = ownerOf(item);
			return owner ? { list: owner.parentElement, anchor: nextItem(owner) } : null;
		}

		function slotInside(item) {
			const above = previousItem(item);
			const list = above && childList(above);
			return list ? { list, anchor: null } : null;
		}

		function slotOutside(item) {
			const owner = ownerOf(item);
			return owner ? { list: owner.parentElement, anchor: nextItem(owner) } : null;
		}

		/**
		 * Runs a named action on the tree, the same set the buttons use.
		 * @param {string} cmd  'up', 'down', 'in', 'out', 'undo' or 'rename'.
		 * @param {HTMLElement} [item]  The row to act on; defaults vary by action.
		 */
		function runCommand(cmd, item) {
			if (cmd === 'undo') return stepBack();
			if (cmd === 'rename') return editName(tree.querySelector('[aria-selected="true"]') || item);
			if (!item) return;
			const shift = shifts.get(cmd);
			if (shift) {
				const slot = shift.slot(item);
				if (!slot) {
					announce(shift.refusal(nameOf(item)));
					return;
				}
				relocate(item, slot.list, slot.anchor);
			}
			moveFocus(item);
		}

		/* Dragging with a pointer. */
		function zoneFor(target, ratio) {
			if (!childList(target)) return ratio < 0.5 ? 'before' : 'after';
			if (ratio < 0.28) return 'before';
			return ratio > 0.72 && target.getAttribute('aria-expanded') !== 'true' ? 'after' : 'inside';
		}

		function dropSpotAt(x, y) {
			const hit = document.elementFromPoint(x, y);
			const dragged = grab.item;
			/* The "Empty folder" note under an empty folder stands in for the folder. */
			const emptyOwner = hit?.matches('[role="group"].is-empty') && tree.contains(hit) ? hit.parentElement : null;
			if (emptyOwner && emptyOwner !== dragged && !dragged.contains(emptyOwner)) {
				return { target: emptyOwner, row: rowFor(emptyOwner), zone: 'inside' };
			}
			const row = hit?.closest('.basalt-tree-row');
			if (!row || !tree.contains(row)) return null;
			const target = row.parentElement;
			if (target === dragged || dragged.contains(target) || target.hasAttribute('data-basalt-tree-retry'))
				return null;
			const box = row.getBoundingClientRect();
			return { target, row, zone: zoneFor(target, (y - box.top) / box.height) };
		}

		function clearInsideHighlight() {
			for (const row of $$('.basalt-tree-row.is-drop-inside', tree)) {
				row.classList.remove('is-drop-inside');
			}
		}

		function paintDropSpot(spot) {
			clearInsideHighlight();
			clearTimeout(grab.openTimer);
			if (!spot) {
				marker.hidden = true;
				return;
			}
			if (spot.zone === 'inside') {
				marker.hidden = true;
				spot.row.classList.add('is-drop-inside');
				if (spot.target.getAttribute('aria-expanded') !== 'true') {
					grab.openTimer = setTimeout(() => setExpanded(spot.target, true, true), 650);
				}
				return;
			}
			const frame = marker.parentElement.getBoundingClientRect();
			const box = spot.row.getBoundingClientRect();
			const lead = spot.row.querySelector('.basalt-tree-caret, .basalt-tree-spacer') || spot.row;
			const left = lead.getBoundingClientRect().left - frame.left;
			marker.hidden = false;
			Object.assign(marker.style, {
				left: `${left}px`,
				width: `${Math.max(40, box.right - frame.left - left - 8)}px`,
				top: `${(spot.zone === 'before' ? box.top : box.bottom) - frame.top - 1}px`,
			});
		}

		function liftOff(pointerId) {
			grab.started = true;
			try {
				tree.setPointerCapture(pointerId);
			} catch {
				/* Capture only smooths the drag; carry on without it. */
			}
			const ghost = document.createElement('div');
			ghost.className = 'basalt-tree-ghost';
			ghost.setAttribute('aria-hidden', 'true');
			const icon = rowFor(grab.item).querySelector('.basalt-tree-icon');
			ghost.innerHTML = `${icon?.outerHTML ?? ''}<span>${htmlSafe(nameOf(grab.item))}</span>`;
			grab.ghost = ghost;
			document.body.appendChild(ghost);
			tree.classList.add('is-dragging');
			grab.item.classList.add('is-dragged');
		}

		function beginGrab(event) {
			if (event.button !== 0 || !event.isPrimary) return;
			const row = event.target.closest('.basalt-tree-row');
			if (!row || !tree.contains(row) || event.target.closest('.basalt-tree-caret, input')) return;
			if (event.pointerType === 'touch' && !event.target.closest('.basalt-tree-grip')) return;
			const item = row.parentElement;
			if (item.hasAttribute('data-basalt-tree-retry')) return;
			grab = {
				item,
				originX: event.clientX,
				originY: event.clientY,
				pointer: event.pointerId,
				started: false,
				spot: null,
			};
		}

		function trackGrab(event) {
			if (!grab || event.pointerId !== grab.pointer) return;
			if (!grab.started) {
				if (Math.hypot(event.clientX - grab.originX, event.clientY - grab.originY) < 5) return;
				liftOff(event.pointerId);
			}
			event.preventDefault();
			grab.ghost.style.transform = `translate(${event.clientX + 14}px,${event.clientY + 10}px)`;
			grab.spot = dropSpotAt(event.clientX, event.clientY);
			paintDropSpot(grab.spot);
		}

		function finishDrag(commit) {
			if (!grab) return;
			const ended = grab;
			grab = null;
			clearTimeout(ended.openTimer);
			ended.ghost?.remove();
			marker.hidden = true;
			tree.classList.remove('is-dragging');
			ended.item.classList.remove('is-dragged');
			clearInsideHighlight();
			if (!ended.started) return;

			/* The pointerup is followed by a click on the row; let that one pass. */
			muteNextClick = true;
			setTimeout(() => {
				muteNextClick = false;
			}, 0);
			if (!commit) return announce('Move canceled.');
			if (!ended.spot) return;
			const { target, zone } = ended.spot;
			if (zone === 'inside') relocate(ended.item, childList(target), null);
			else relocate(ended.item, target.parentElement, zone === 'before' ? target : nextItem(target));
			moveFocus(ended.item);
		}

		function enableDragging() {
			const host = tree.parentElement;
			if (window.getComputedStyle(host).position === 'static') host.style.position = 'relative';
			host.appendChild(marker);
			tree.addEventListener('pointerdown', beginGrab);
			tree.addEventListener('pointermove', trackGrab);
			tree.addEventListener('pointerup', (event) => {
				if (grab && event.pointerId === grab.pointer) finishDrag(true);
			});
			tree.addEventListener('pointercancel', () => finishDrag(false));
			document.addEventListener('keydown', (event) => {
				if (grab?.started && event.key === 'Escape') finishDrag(false);
			});
		}

		/* Clicks and keys. */
		function onRowClick(event) {
			if (muteNextClick) return;
			const row = event.target.closest('.basalt-tree-row');
			if (!row || !tree.contains(row)) return;
			const item = row.parentElement;
			if (item.hasAttribute('data-basalt-tree-retry')) return retryFolder(item);
			moveFocus(item);
			if (event.target.closest('.basalt-tree-caret')) toggleFolder(item);
			else activate(item, true);
		}

		function onLabelDoubleClick(event) {
			if (!renamable) return;
			const label = event.target.closest('.basalt-tree-label');
			if (label && tree.contains(label)) editName(label.closest('[role="treeitem"]'));
		}

		function stepInto(item) {
			if (!isFolderItem(item)) return false;
			if (item.getAttribute('aria-expanded') !== 'true') setExpanded(item, true, true);
			else moveFocus(childList(item).querySelector(':scope > [role="treeitem"]'));
			return true;
		}

		function stepOut(item) {
			if (isFolderItem(item) && item.getAttribute('aria-expanded') === 'true') setExpanded(item, false, true);
			else moveFocus(ownerOf(item));
		}

		function openPeerFolders(item) {
			for (const peer of rowsIn(item.parentElement).filter(isFolderItem)) {
				setExpanded(peer, true, true);
			}
		}

		/* Type-ahead: letters typed in quick succession jump to the next shown
       row whose name starts with them. */
		function typeAhead(key, order, at) {
			if (key.length !== 1 || !/\S/.test(key)) return false;
			clearTimeout(prefixTimer);
			typedPrefix += key.toLowerCase();
			prefixTimer = setTimeout(() => {
				typedPrefix = '';
			}, 600);
			const start = typedPrefix.length === 1 ? at + 1 : at;
			const ring = [...order.slice(start), ...order.slice(0, start)];
			moveFocus(ring.find((node) => nameOf(node).toLowerCase().startsWith(typedPrefix)));
			return true;
		}

		function moveByKeys(event, item) {
			const move = event.altKey && ARROW_MOVES.get(event.key);
			if (move) {
				event.preventDefault();
				runCommand(move, item);
				return true;
			}
			if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return false;
			event.preventDefault();
			runCommand('undo');
			return true;
		}

		function onTreeKey(event) {
			const item = event.target.closest('[role="treeitem"]');
			if (!item || event.target !== item) return;
			if (movable && moveByKeys(event, item)) return;
			if (event.altKey || event.ctrlKey || event.metaKey) return;
			const order = shownItems();
			const at = order.indexOf(item);
			const action = keyActions.get(event.key);
			const handled = action ? action(item, order, at) : typeAhead(event.key, order, at);
			if (handled !== false) event.preventDefault();
		}

		return mount();
	}

	/**
	 * Filters a running tree from a search box, marking the matched words.
	 * Markup: <input data-basalt-tree-search="#tree"
	 * data-basalt-tree-search-count="#out" data-basalt-tree-search-empty="#note">
	 * @param {HTMLInputElement} input  The search field.
	 */
	function TreeSearch(input) {
		const tree = document.querySelector(input.dataset.basaltTreeSearch);
		const handle = trees.get(tree);
		if (!handle) return;
		const counter = nodeFor(input.dataset.basaltTreeSearchCount);
		const emptyNote = nodeFor(input.dataset.basaltTreeSearchEmpty);
		const originals = new Map();
		let expandedBefore = null;

		for (const item of handle.allItems()) {
			const label = item.querySelector(LABEL_IN_ROW);
			originals.set(item, { label, text: label ? label.textContent : '' });
		}
		input.addEventListener('input', applyFilter);
		input.addEventListener('keydown', onSearchKey);
		if (counter) counter.textContent = `${fileCount()} items`;

		function fileCount() {
			return handle.allItems().filter((item) => !handle.isFolder(item)).length;
		}

		function highlight(item, words) {
			const entry = originals.get(item);
			if (!entry?.label) return;
			if (!words.length) {
				entry.label.textContent = entry.text;
				return;
			}
			const pattern = new RegExp(`(${words.map(escapePattern).join('|')})`, 'gi');
			entry.label.innerHTML = entry.text
				.split(pattern)
				.map((piece, index) => (index % 2 ? `<mark>${htmlSafe(piece)}</mark>` : htmlSafe(piece)))
				.join('');
		}

		function matchesAll(item, words) {
			const haystack = originals.get(item).text.toLowerCase();
			return words.every((word) => haystack.includes(word));
		}

		function clearFilter(items) {
			for (const item of items) {
				item.hidden = false;
				highlight(item, []);
			}
			if (expandedBefore) {
				for (const [item, wasOpen] of expandedBefore) handle.setOpen(item, wasOpen);
			}
			expandedBefore = null;
			if (counter) counter.textContent = `${fileCount()} items`;
			if (emptyNote) emptyNote.hidden = true;
			tree.hidden = false;
			handle.refresh();
		}

		function keepTabStopShown(items) {
			/* The tree's one tab stop has to land on a row that can be seen. */
			const stop = tree.querySelector('[role="treeitem"][tabindex="0"]');
			if (stop && !stop.hidden) return;
			const firstShown = items.find(
				(item) => !item.hidden && !item.parentElement.closest('[role="group"][hidden]'),
			);
			if (!firstShown) return;
			for (const item of items) item.tabIndex = -1;
			firstShown.tabIndex = 0;
		}

		function applyFilter() {
			const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
			const items = handle.allItems();
			if (!words.length) {
				clearFilter(items);
				return;
			}
			expandedBefore ??= new Map(
				items
					.filter((item) => item.hasAttribute('aria-expanded'))
					.map((item) => [item, item.getAttribute('aria-expanded') === 'true']),
			);
			const hits = new Set(items.filter((item) => matchesAll(item, words)));
			let found = 0;
			for (const item of items) {
				const others = [...hits].filter((hit) => hit !== item);
				const holdsHit = others.some((hit) => item.contains(hit));
				const isHit = hits.has(item);
				item.hidden = !(isHit || holdsHit || others.some((hit) => hit.contains(item)));
				highlight(item, isHit ? words : []);
				if (item.hasAttribute('aria-expanded')) handle.setOpen(item, holdsHit);
				if (!isHit) continue;
				if (!handle.isFolder(item)) found += 1;
				else if (!holdsHit)
					found += $$('[role="treeitem"]', item).filter((node) => !handle.isFolder(node)).length;
			}
			const any = hits.size > 0;
			if (counter) counter.textContent = any ? `${found} ${found === 1 ? 'match' : 'matches'}` : 'No matches';
			if (emptyNote) emptyNote.hidden = any;
			tree.hidden = !any;
			keepTabStopShown(items);
		}

		function onSearchKey(event) {
			if (event.key === 'Escape' && input.value) {
				input.value = '';
				applyFilter();
			}
			if (event.key !== 'ArrowDown') return;
			const stop = tree.querySelector('[role="treeitem"][tabindex="0"]');
			if (!stop || tree.hidden) return;
			event.preventDefault();
			stop.focus();
		}
	}

	/**
	 * Listens on the document for buttons that drive a tree from outside it:
	 * data-basalt-tree-cmd (with data-basalt-tree-for), check all, check none,
	 * expand and collapse.
	 */
	function treeButtons() {
		document.addEventListener('click', onTreeButton);
	}

	function onTreeButton(event) {
		const button = event.target.closest(TREE_BUTTONS);
		if (!button) return;
		const selector = TREE_TARGETS.map((key) => button.dataset[key]).find(Boolean);
		const handle = selector ? trees.get(document.querySelector(selector)) : undefined;
		if (!handle) return;
		if (button.hasAttribute('data-basalt-tree-cmd')) {
			handle.command(button.dataset.basaltTreeCmd, handle.current());
			return;
		}
		const checkAll = button.hasAttribute('data-basalt-tree-check-all');
		if (checkAll || button.hasAttribute('data-basalt-tree-check-none')) {
			for (const item of handle.allItems()) item.setAttribute('aria-checked', String(checkAll));
			handle.syncChecks();
			announce(checkAll ? 'Everything checked.' : 'Everything cleared.');
			return;
		}
		const expand = button.hasAttribute('data-basalt-tree-expand');
		for (const folder of handle.allItems().filter((item) => handle.groupOf(item))) {
			handle.setOpen(folder, expand, expand);
		}
	}

	/** Resolves an optional selector held in a data attribute. */
	function nodeFor(selector) {
		return selector ? document.querySelector(selector) : null;
	}

	function escapePattern(word) {
		return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	/* Sortable
	   An <ol class="basalt-sortable" data-basalt-sortable aria-label="…"> whose
	   <li class="basalt-sortable-item"> rows each carry a
	   <button class="basalt-sortable-handle" type="button"> grip.
	   The list may also say:
	     data-basalt-sortable-group   lists sharing this name swap rows (a board)
	     data-basalt-sortable-whole   the whole row works as a grip, links
	                                  included; a plain click still follows them
	     data-basalt-sortable-limit   how many rows the list ought to hold
	     data-basalt-sortable-count   selector of the element showing the tally
	   With .basalt-sortable-grid the rows wrap and move in both directions.
	   Each move fires basalt:sortable-change { item, from, to, index }. */
	const SORT_ROW = '.basalt-sortable-item';
	const SORT_GRIP = '.basalt-sortable-handle';
	const SORT_ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
	let sortHint = null;
	/* When the last drag ended, so the click that follows a drop on a link
	   is not taken as a click. */
	let droppedAt = 0;
	document.addEventListener(
		'click',
		(event) => {
			if (performance.now() - droppedAt > 400 || !event.target.closest(SORT_ROW)) return;
			event.preventDefault();
			event.stopPropagation();
		},
		true,
	);

	/**
	 * Makes one list reorderable by pointer and by keyboard. Runs for every
	 * [data-basalt-sortable] on load; window.Basalt.sortable(list) does the same
	 * for a list added later, and wires each list only once.
	 * @param {HTMLElement} list  the element whose .basalt-sortable-item children move
	 */
	function Sortable(list) {
		const hintId = sortHintId();
		for (const row of sortRows(list)) prepareGrip(row, hintId);
		refreshSortList(list);

		/* The row lifted with the keyboard, if any, lives here for this list. */
		const session = { carried: null };

		list.addEventListener('keydown', (event) => onSortKey(event, list, session));
		list.addEventListener('focusout', (event) => onSortBlur(event, session));
		list.addEventListener('click', (event) => {
			if (event.target.closest(SORT_GRIP)) event.preventDefault();
		});
		/* The browser's own link dragging would take over a whole-row drag. */
		list.addEventListener('dragstart', (event) => {
			if (list.hasAttribute('data-basalt-sortable-whole')) event.preventDefault();
		});
		list.addEventListener('pointerdown', (event) => {
			if (session.carried) return;
			const row = pressedRow(event, list);
			if (row) followPointer(event, row, list);
		});
	}

	/* Every grip points at one hidden paragraph that explains the keys. */
	function sortHintId() {
		sortHint ??= (document.querySelector('main') || document.body).appendChild(
			Object.assign(document.createElement('p'), {
				id: 'basalt-sortable-help',
				className: 'visually-hidden',
				textContent: 'Press Space to pick up. Use the arrow keys to move, Space to put down, Escape to cancel.',
			}),
		);
		return sortHint.id;
	}

	function prepareGrip(row, hintId) {
		const grip = row.querySelector(SORT_GRIP);
		if (!grip) return;
		grip.setAttribute('aria-describedby', hintId);
		grip.setAttribute('aria-pressed', 'false');
		if (!grip.getAttribute('aria-label')) grip.setAttribute('aria-label', `Move ${rowLabel(row)}`);
	}

	function sortRows(list) {
		return [...list.children].filter((child) => child.matches(SORT_ROW));
	}

	function isGridList(list) {
		return list.classList.contains('basalt-sortable-grid');
	}

	/* Lists that share a group name trade rows; a list without one stands alone. */
	function linkedLists(list) {
		const group = list.dataset.basaltSortableGroup;
		if (!group) return [list];
		return $$(`[data-basalt-sortable][data-basalt-sortable-group="${group}"]`);
	}

	function sortListLabel(list) {
		const own = list.getAttribute('aria-label');
		if (own) return own;
		const labelId = list.getAttribute('aria-labelledby');
		const labelNode = labelId ? document.getElementById(labelId) : null;
		return labelNode ? labelNode.textContent.trim() : 'the list';
	}

	/* A row is called by its grip label without the leading "Move", or else by its title. */
	function rowLabel(row) {
		const spoken = row.querySelector(SORT_GRIP)?.getAttribute('aria-label');
		if (spoken) return spoken.replace(/^Move\s+/i, '');
		const heading = row.querySelector('.basalt-sortable-title, .basalt-sortable-main, .basalt-sortable-sub');
		return heading?.textContent.trim() ?? 'Item';
	}

	/* "2 of 5 in Backlog" */
	function placeOf(row) {
		const list = row.parentElement;
		const rows = sortRows(list);
		return `${rows.indexOf(row) + 1} of ${rows.length} in ${sortListLabel(list)}`;
	}

	/**
	 * Renumbers a list's ranks, marks it empty or not, updates its tally and
	 * the over-limit state of the board column around it.
	 * @returns {string} a sentence to announce when the list has only now gone over its limit, otherwise ''
	 */
	function refreshSortList(list) {
		const rows = sortRows(list);
		const total = rows.length;
		for (const [index, row] of rows.entries()) {
			const rank = row.querySelector('.basalt-sortable-rank');
			if (rank) rank.textContent = String(index + 1);
		}
		list.classList.toggle('is-empty', total === 0);

		const cap = Number.parseInt(list.dataset.basaltSortableLimit, 10);
		const capped = cap > 0;
		const overflowing = capped && total > cap;
		const tallySelector = list.dataset.basaltSortableCount;
		const tally = tallySelector ? document.querySelector(tallySelector) : null;
		if (tally) tally.textContent = capped ? `${total} of ${cap}${overflowing ? ', over' : ''}` : String(total);

		const column = list.closest('.basalt-board-col');
		if (!column) return '';
		const wasOver = column.classList.contains('is-over-limit');
		column.classList.toggle('is-over-limit', overflowing);
		return overflowing && !wasOver ? `${sortListLabel(list)} is over its limit of ${cap}.` : '';
	}

	/* Refreshes both ends of a finished move, tells listeners and hands back any limit warning. */
	function reportMove(row, source) {
		const target = row.parentElement;
		const warnings = [refreshSortList(target)];
		if (source !== target) warnings.unshift(refreshSortList(source));
		target.dispatchEvent(
			new CustomEvent('basalt:sortable-change', {
				bubbles: true,
				detail: { item: row, from: source, to: target, index: sortRows(target).indexOf(row) },
			}),
		);
		return warnings.join(' ').trim();
	}

	/* Space or Enter on a grip lifts its row or sets it down, the arrows carry
     the lifted row, and Escape returns it to where it started. */
	function onSortKey(event, list, session) {
		const grip = event.target.closest(SORT_GRIP);
		if (!grip || !list.contains(grip)) return;
		const row = grip.closest(SORT_ROW);

		if (event.key === ' ' || event.key === 'Enter') {
			event.preventDefault();
			if (session.carried?.row === row) setDown(session, false);
			else liftRow(session, row, grip);
			return;
		}
		if (!session.carried) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			setDown(session, true);
		} else if (session.carried.row === row && SORT_ARROWS.has(event.key)) {
			event.preventDefault();
			nudgeRow(row, grip, event.key);
		}
	}

	/* Moving a row in the DOM blurs its grip for an instant, so the row is only
     set down once focus has really gone somewhere else. */
	function onSortBlur(event, session) {
		const carried = session.carried;
		if (!carried || event.target !== carried.grip || carried.row.contains(event.relatedTarget)) return;
		setTimeout(() => {
			if (session.carried && document.activeElement !== session.carried.grip) setDown(session, false);
		}, 0);
	}

	function liftRow(session, row, grip) {
		session.carried = { row, grip, home: row.parentElement, follower: row.nextElementSibling };
		row.classList.add('is-grabbed');
		grip.setAttribute('aria-pressed', 'true');
		announce(`Picked up ${rowLabel(row)}. Position ${placeOf(row)}.`);
	}

	/* Ends a keyboard move; with restore set, the row first slides back home. */
	function setDown(session, restore) {
		const carried = session.carried;
		if (!carried) return;
		session.carried = null;
		const { row, grip, home, follower } = carried;
		if (restore) {
			const shifting = [...sortRows(row.parentElement), ...sortRows(home)];
			flip(shifting, () => home.insertBefore(row, follower?.parentElement === home ? follower : null));
			grip.focus();
		}
		row.classList.remove('is-grabbed');
		grip.setAttribute('aria-pressed', 'false');

		const warning = reportMove(row, home);
		const name = rowLabel(row);
		const opening = restore ? `Canceled. ${name} is back at ` : `Dropped ${name}. Position `;
		announce(`${opening}${placeOf(row)}. ${warning}`);
		if (!restore) flash(row, 'is-moved');
	}

	function nudgeRow(row, grip, key) {
		const home = row.parentElement;
		const destination = arrowDestination(row, home, key);
		if (!destination) return;
		const { list: target, before } = destination;
		const shifting = target === home ? sortRows(home) : [...sortRows(home), ...sortRows(target)];
		flip(shifting, () => target.insertBefore(row, before));
		grip.focus();
		if (target !== home) refreshSortList(home);
		const warning = refreshSortList(target);
		announce(`${placeOf(row)}. ${warning}`);
	}

	/**
	 * Works out where an arrow key sends a lifted row: one step along a line,
	 * a line up or down in a grid, or across to the neighboring list of its group.
	 * @returns {{list: HTMLElement, before: Element|null}|null} null when the row is already at that edge
	 */
	function arrowDestination(row, home, key) {
		const rows = sortRows(home);
		const at = rows.indexOf(row);

		if (isGridList(home)) {
			const firstTop = rows[0].offsetTop;
			const perLine = Math.max(1, rows.filter((peer) => peer.offsetTop === firstTop).length);
			const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -perLine, ArrowDown: perLine };
			const goal = Math.min(rows.length - 1, Math.max(0, at + offsets[key]));
			if (goal === at) return null;
			return { list: home, before: goal > at ? rows[goal].nextElementSibling : rows[goal] };
		}
		if (key === 'ArrowUp') return at === 0 ? null : { list: home, before: rows[at - 1] };
		if (key === 'ArrowDown')
			return at === rows.length - 1 ? null : { list: home, before: rows[at + 1].nextElementSibling };

		const lists = linkedLists(home);
		const neighbor = lists[lists.indexOf(home) + (key === 'ArrowRight' ? 1 : -1)];
		if (!neighbor) return null;
		const theirs = sortRows(neighbor);
		return { list: neighbor, before: theirs[Math.min(at, theirs.length)] ?? null };
	}

	/* A press only counts on the grip, or anywhere on the row when the list
     allows it, links included, but never by touch and never on a button or
     field inside the row. */
	function pressedRow(event, list) {
		if (event.button !== 0 || !event.isPrimary) return null;
		const row = event.target.closest(SORT_ROW);
		if (row?.parentElement !== list) return null;
		if (event.target.closest(SORT_GRIP)) return row;
		const anywhere = list.hasAttribute('data-basalt-sortable-whole') && event.pointerType !== 'touch';
		if (!anywhere || event.target.closest('button, input, select, textarea, label')) return null;
		return row;
	}

	/**
	 * Follows one pointer from press to release. Past 5px the row floats under
	 * the pointer and a placeholder marks where it will land; Escape or
	 * pointercancel leaves it where it was.
	 */
	function followPointer(downEvent, row, home) {
		const pointerId = downEvent.pointerId;
		const drag = {
			row,
			home,
			pressX: downEvent.clientX,
			pressY: downEvent.clientY,
			live: false,
			offsetX: 0,
			offsetY: 0,
			gap: null,
			column: null,
		};
		const wiring = new AbortController();
		const { signal } = wiring;

		function release(abandon) {
			wiring.abort();
			if (drag.live) finishDrag(drag, abandon);
		}

		window.addEventListener(
			'pointermove',
			(event) => {
				if (event.pointerId !== pointerId) return;
				if (!drag.live) {
					if (Math.hypot(event.clientX - drag.pressX, event.clientY - drag.pressY) < 5) return;
					liftForDrag(drag);
				}
				event.preventDefault();
				row.style.transform = `translate(${event.clientX - drag.offsetX}px,${event.clientY - drag.offsetY}px)`;
				trackGap(drag, event.clientX, event.clientY);
			},
			{ passive: false, signal },
		);
		window.addEventListener(
			'pointerup',
			(event) => {
				if (event.pointerId === pointerId) release(false);
			},
			{ signal },
		);
		window.addEventListener(
			'pointercancel',
			(event) => {
				if (event.pointerId === pointerId) release(true);
			},
			{ signal },
		);
		window.addEventListener(
			'keydown',
			(event) => {
				if (event.key !== 'Escape' || !drag.live) return;
				event.preventDefault();
				release(true);
			},
			{ signal },
		);
	}

	/* Pins the row at its current size and leaves a same-sized gap behind it. */
	function liftForDrag(drag) {
		const { row, home } = drag;
		const box = row.getBoundingClientRect();
		drag.live = true;
		drag.offsetX = drag.pressX - box.left;
		drag.offsetY = drag.pressY - box.top;

		const gap = document.createElement(row.tagName);
		gap.className = 'basalt-sortable-placeholder';
		gap.setAttribute('aria-hidden', 'true');
		gap.style.height = `${box.height}px`;
		if (isGridList(home)) gap.style.minHeight = `${box.height}px`;
		row.after(gap);
		drag.gap = gap;

		Object.assign(row.style, { width: `${box.width}px`, height: `${box.height}px`, left: '0px', top: '0px' });
		row.classList.add('is-dragging');
		document.body.classList.add('basalt-is-sorting');
	}

	/* The list under the pointer, or the list inside the board column under
     it, as long as it belongs to the dragged row's group. */
	function dropListAt(drag, x, y) {
		const hit = document.elementFromPoint(x, y);
		if (!hit) return null;
		const candidate =
			hit.closest('[data-basalt-sortable]') ??
			hit.closest('.basalt-board-col')?.querySelector('[data-basalt-sortable]');
		return candidate && linkedLists(drag.home).includes(candidate) ? candidate : null;
	}

	/* In a grid the gap goes beside the nearest row, on whichever side the pointer is. */
	function gridSlot(rivals, x, y) {
		let nearest = null;
		let shortest = Infinity;
		for (const rival of rivals) {
			const box = rival.getBoundingClientRect();
			const distance = Math.hypot(box.left + box.width / 2 - x, box.top + box.height / 2 - y);
			if (distance < shortest) {
				shortest = distance;
				nearest = rival;
			}
		}
		if (!nearest) return null;
		const box = nearest.getBoundingClientRect();
		return x < box.left + box.width / 2 ? nearest : nearest.nextElementSibling;
	}

	function trackGap(drag, x, y) {
		const { row, gap } = drag;
		const target = dropListAt(drag, x, y) ?? gap.parentElement;
		const rivals = sortRows(target).filter((peer) => peer !== row);
		const before = isGridList(target)
			? gridSlot(rivals, x, y)
			: (rivals.find((peer) => {
					const box = peer.getBoundingClientRect();
					return y < box.top + box.height / 2;
				}) ?? null);

		const settled =
			before === gap || (gap.parentElement === target && gap.nextElementSibling === before && before !== row);
		if (settled) return;
		const sameList = target === gap.parentElement;
		const shifting = [...sortRows(target), ...(sameList ? [] : sortRows(gap.parentElement))].filter(
			(peer) => peer !== row,
		);
		flip(shifting, () => target.insertBefore(gap, before));

		const column = target.closest('.basalt-board-col');
		if (column === drag.column) return;
		drag.column?.classList.remove('is-over');
		column?.classList.add('is-over');
		drag.column = column;
	}

	/* Lands the row in the gap (or drops the gap when the move was abandoned)
     and glides it from where it floated to where it now sits. */
	function finishDrag(drag, abandon) {
		const { row, home, gap } = drag;
		droppedAt = performance.now();
		document.body.classList.remove('basalt-is-sorting');
		drag.column?.classList.remove('is-over');

		const floated = row.getBoundingClientRect();
		if (abandon) gap.remove();
		else gap.replaceWith(row);
		row.classList.remove('is-dragging');
		for (const property of ['width', 'height', 'left', 'top', 'transform']) row.style[property] = '';

		if (!reduceMotion.matches) {
			const landed = row.getBoundingClientRect();
			row.animate(
				[
					{ transform: `translate(${floated.left - landed.left}px,${floated.top - landed.top}px)` },
					{ transform: 'none' },
				],
				{ duration: 200, easing: 'cubic-bezier(.2,.7,.3,1)' },
			);
		}
		swallowNextClick();

		if (abandon) {
			announce('Move canceled.');
			return;
		}
		const warning = reportMove(row, home);
		flash(row, 'is-moved');
		announce(`Moved ${rowLabel(row)} to position ${placeOf(row)}. ${warning}`);
	}

	/* The click a browser fires when a drag ends must not press whatever lies beneath. */
	function swallowNextClick() {
		function swallow(event) {
			event.stopPropagation();
			event.preventDefault();
		}
		window.addEventListener('click', swallow, { capture: true, once: true });
		setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
	}

	/* Transfer list
	   <div class="basalt-transfer" data-basalt-transfer> with two
	   panes (data-basalt-transfer-list="source" / "target"),
	   each a list group of checkbox rows, and buttons with
	   data-basalt-transfer-move="to-target" / "to-source".
	   Event: basalt:transfer-change { moved, to }. */
	function Transfer(root) {
		const panes = $$('.basalt-transfer-pane', root);

		function listOf(pane) {
			return pane.querySelector('[data-basalt-transfer-list]');
		}

		function rows(pane) {
			return $$('.list-group-item', listOf(pane));
		}

		function shown(pane) {
			return rows(pane).filter((r) => !r.hidden);
		}

		function ticked(pane) {
			return rows(pane).filter((r) => r.querySelector('.form-check-input').checked);
		}

		function paneFor(kind) {
			return panes.find((p) => listOf(p).dataset.basaltTransferList === kind);
		}

		function update() {
			for (const pane of panes) {
				const all = pane.querySelector('[data-basalt-transfer-all]');
				const t = ticked(pane).length;
				const v = shown(pane);
				const vt = v.filter((r) => r.querySelector('.form-check-input').checked).length;
				const count = pane.querySelector('[data-basalt-transfer-count]');
				if (count) count.textContent = `${t} of ${rows(pane).length} checked`;
				if (all) {
					all.checked = v.length > 0 && vt === v.length;
					all.indeterminate = vt > 0 && vt < v.length;
					all.disabled = v.length === 0;
				}
				const empty = pane.querySelector('.basalt-transfer-empty');
				if (empty) empty.hidden = v.length > 0;
			}

			for (const btn of $$('[data-basalt-transfer-move]', root)) {
				const from = paneFor(btn.dataset.basaltTransferMove === 'to-target' ? 'source' : 'target');
				btn.disabled = !from || ticked(from).length === 0;
			}
		}
		function move(dir) {
			const from = paneFor(dir === 'to-target' ? 'source' : 'target');
			const to = paneFor(dir === 'to-target' ? 'target' : 'source');
			const picked = ticked(from);
			if (!picked.length) return;
			const target = listOf(to);
			picked.forEach((r) => {
				r.querySelector('.form-check-input').checked = false;
				target.appendChild(r);
				r.hidden = false;
				flash(r, 'is-moved');
			});
			const filter = to.querySelector('[data-basalt-transfer-filter]');
			if (filter && filter.value) {
				filter.value = '';
				applyFilter(to);
			}
			update();
			const title = to.querySelector('.basalt-transfer-title');
			announce(
				`${picked.length + (picked.length === 1 ? ' item' : ' items')} moved to ${title ? title.textContent.trim() : 'the other list'}.`,
			);
			root.dispatchEvent(
				new CustomEvent('basalt:transfer-change', { bubbles: true, detail: { moved: picked, to: target } }),
			);
		}
		function applyFilter(pane) {
			const input = pane.querySelector('[data-basalt-transfer-filter]');
			const q = input ? input.value.trim().toLowerCase() : '';
			rows(pane).forEach((r) => {
				r.hidden = !!q && !r.textContent.trim().toLowerCase().includes(q);
			});
			update();
		}
		root.addEventListener('change', (e) => {
			const all = e.target.closest('[data-basalt-transfer-all]');
			if (all) {
				const pane = all.closest('.basalt-transfer-pane');
				shown(pane).forEach((r) => {
					r.querySelector('.form-check-input').checked = all.checked;
				});
			}
			update();
		});
		root.addEventListener('input', (e) => {
			const f = e.target.closest('[data-basalt-transfer-filter]');
			if (f) applyFilter(f.closest('.basalt-transfer-pane'));
		});
		root.addEventListener('click', (e) => {
			const btn = e.target.closest('[data-basalt-transfer-move]');
			if (btn) move(btn.dataset.basaltTransferMove);
		});
		update();
	}

	const bound = new WeakSet();

	function once(fn) {
		return (el) => {
			if (!el || bound.has(el)) return undefined;
			bound.add(el);
			return fn(el);
		};
	}

	window.Basalt.tree = (el) => (el && trees.get(el)) || once(Tree)(el);
	window.Basalt.sortable = once(Sortable);
	window.Basalt.transfer = once(Transfer);
	document.addEventListener('DOMContentLoaded', () => {
		$$('[data-basalt-tree]').forEach(window.Basalt.tree);
		$$('[data-basalt-tree-search]').forEach(once(TreeSearch));
		treeButtons();
		$$('[data-basalt-sortable]').forEach(window.Basalt.sortable);
		$$('[data-basalt-transfer]').forEach(window.Basalt.transfer);
	});
})();
