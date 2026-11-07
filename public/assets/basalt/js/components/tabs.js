/**
 * Component script for Basalt tab strips. It loads after assets/basalt/js/basalt.js, and
 * only on the pages that use it; documentation.html#page-map lists them.
 */

/**
 * Tabs (.basalt-tabs, shown on tabs.html). The wrapper holds a
 * .basalt-tabs-list of Bootstrap tab buttons, or of .btn-check radios
 * with labels when it is a segmented control. Every [data-basalt-tabs]
 * wrapper is mounted on load; window.Basalt.tabs(el) mounts one added
 * later and returns its controller, also kept as el.basaltTabs. Closing,
 * adding and reopening fire basalt:tabclose, basalt:tabadd and
 * basalt:tabreopen on the wrapper, with detail { tab, label }.
 */
(() => {
	'use strict';
	/* Where each roving key sends focus, given the focused index and the
     number of tabs that can take focus. */
	const ROVING_KEYS = {
		Home: () => 0,
		End: (from, count) => count - 1,
		ArrowLeft: (from, count) => (from - 1 + count) % count,
		ArrowUp: (from, count) => (from - 1 + count) % count,
		ArrowRight: (from, count) => (from + 1) % count,
		ArrowDown: (from, count) => (from + 1) % count,
	};
	let addedTabs = 0;

	window.Basalt.tabs = mountTabs;
	document.addEventListener('DOMContentLoaded', mountEveryTabSet);

	/* Without Bootstrap's Tab plugin there is nothing to drive. */
	function mountEveryTabSet() {
		if (window.bootstrap) {
			for (const wrapper of document.querySelectorAll('[data-basalt-tabs]')) mountTabs(wrapper);
		}
	}

	/**
	 * Mounts one .basalt-tabs wrapper: the sliding indicator, overflow into
	 * a More menu, scroll arrows, roving keys, and closable tabs. Mounting
	 * twice hands back the controller from the first time.
	 * @param {HTMLElement} root the .basalt-tabs wrapper
	 * @returns {?{ refresh(): void, add(opts: object): HTMLElement,
	 *   close(tab: HTMLElement): void, reopen(): ?HTMLElement,
	 *   closed(): number }} the controller, or null without a tab list
	 */
	function mountTabs(root) {
		if (!root) return root;
		if (root.basaltTabs) return root.basaltTabs;
		const list = root.querySelector('.basalt-tabs-list');
		if (!list) return null;

		const overflow = root.querySelector('.basalt-tabs-more');
		const overflowButton = overflow?.querySelector('.basalt-tabs-more-btn');
		const overflowMenu = overflow?.querySelector('.dropdown-menu');
		const overflowCaption = overflow?.querySelector('[data-basalt-tabs-more-label]');
		const scroller = root.querySelector('.basalt-tabs-viewport');
		const scrollBack = root.querySelector('.basalt-tabs-arrow-prev');
		const scrollOn = root.querySelector('.basalt-tabs-arrow-next');
		const isVertical = root.classList.contains('basalt-tabs-vertical');
		const canClose = root.classList.contains('basalt-tabs-closable');
		const closedStack = [];

		const ink = document.createElement('span');
		ink.setAttribute('aria-hidden', 'true');
		ink.className = 'basalt-tabs-ink';
		list.append(ink);

		if (scroller) {
			scroller.addEventListener('scroll', markScrollEdges, { passive: true });
			scrollBack?.addEventListener('click', () => scrollByPage(-1));
			scrollOn?.addEventListener('click', () => scrollByPage(1));
		}

		root.addEventListener('click', (event) => {
			const closer = event.target.closest('.basalt-tabs-close');
			if (!closer || !root.contains(closer)) return;
			const tab = closer.parentElement.querySelector('.nav-link');
			if (tab) closeTab(tab);
		});

		/* Listening in the capture phase lets hidden and closed tabs be
       skipped, and keeps Home, End and Delete alike in every tab style. */
		list.addEventListener('keydown', onListKey, true);

		list.addEventListener('show.bs.tab', ({ target }) => {
			if (!list.contains(target)) return;
			if (overflow && target.classList.contains('is-overflow'))
				fillOverflowMenu(tabList().filter((tab) => tab.classList.contains('is-overflow')));
			moveInk(target);
			bringIntoView(target);
		});
		list.addEventListener('shown.bs.tab', () => {
			/* The More button may now show a longer name; fit the row again. */
			if (overflow) fitRow();
			moveInk();
		});
		list.addEventListener('change', () => {
			moveInk();
			bringIntoView(selectedTab());
		});

		/* The list is observed as well as the wrapper, because pages fill in
       tab counts after mounting and that widens the row on its own. */
		if ('ResizeObserver' in window) {
			const watcher = new ResizeObserver(() => requestAnimationFrame(refresh));
			watcher.observe(root);
			watcher.observe(list);
		} else {
			window.addEventListener('resize', refresh);
		}
		document.fonts?.ready?.then(refresh);
		refresh();

		root.basaltTabs = {
			refresh,
			add: addTab,
			close: closeTab,
			reopen: reopenTab,
			/** How many closed tabs reopen() can still bring back. */
			closed: () => closedStack.length,
		};
		return root.basaltTabs;

		/** Re-measures the row: overflow, scroll arrows, then the indicator. */
		function refresh() {
			fitRow();
			markScrollEdges();
			snapInk();
		}

		function tabList() {
			return [...list.querySelectorAll('.nav-link')];
		}

		function canTakeFocus(tab) {
			return !tab.disabled && !tab.classList.contains('disabled') && !tab.classList.contains('is-overflow');
		}

		function selectedTab() {
			const checkedRadio = list.querySelector('.btn-check:checked');
			if (checkedRadio) return list.querySelector(`label[for="${checkedRadio.id}"]`);
			return tabList().find((tab) => tab.classList.contains('active')) ?? null;
		}

		/* The indicator follows the chosen tab, or the More button while that
       tab is folded into the menu. Pill and segmented styles cover the
       whole tab; the others only track its left edge and width. */
		function moveInk(target) {
			const tab = target || selectedTab();
			if (!tab) {
				ink.style.width = '0px';
				return;
			}
			const anchor = overflowButton && tab.classList.contains('is-overflow') ? overflowButton : tab;
			const listBox = list.getBoundingClientRect();
			const anchorBox = anchor.getBoundingClientRect();
			if (!listBox.width || !anchorBox.width) return;
			const top = `${anchorBox.top - listBox.top - list.clientTop + list.scrollTop}px`;
			const height = `${anchorBox.height}px`;
			if (isVertical) {
				Object.assign(ink.style, { top, height });
				return;
			}
			const covers =
				root.classList.contains('basalt-tabs-pill') || root.classList.contains('basalt-tabs-segmented');
			Object.assign(ink.style, {
				left: `${anchorBox.left - listBox.left - list.clientLeft + list.scrollLeft}px`,
				width: `${anchorBox.width}px`,
				top: covers ? top : '',
				height: covers ? height : '',
			});
		}

		/* Places the indicator without its transition, for the first paint,
       resizes and style switches. */
		function snapInk() {
			root.classList.add('is-static');
			moveInk();
			requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('is-static')));
		}

		/* Folds tabs, last first, into the More menu until what is left fits
       beside the More button. Widths come from the tabs themselves, since
       the indicator can hang past the end and make the row look wider. */
		function fitRow() {
			if (!overflow) return;
			const tabs = tabList();
			for (const tab of tabs) tab.classList.remove('is-overflow');
			overflow.hidden = true;
			const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
			const widths = tabs.map((tab) => tab.offsetWidth);
			if (rowWidth(widths, widths.length, gap) <= list.clientWidth + 1) {
				fillOverflowMenu([]);
				return;
			}
			overflow.hidden = false;
			for (let kept = tabs.length; kept >= 0; kept -= 1) {
				fillOverflowMenu(tabs.slice(kept));
				const room = root.clientWidth - overflow.offsetWidth - gap;
				if (kept > 0 && rowWidth(widths, kept, gap) > room) continue;
				for (const [index, tab] of tabs.entries()) tab.classList.toggle('is-overflow', index >= kept);
				break;
			}
		}

		function fillOverflowMenu(folded) {
			if (!overflowMenu) return;
			const chosen = selectedTab();
			overflowMenu.replaceChildren(...folded.map((tab) => overflowEntry(tab, tab === chosen)));
			const chosenIsFolded = folded.includes(chosen);
			overflow.classList.toggle('has-active', chosenIsFolded);
			if (overflowCaption) overflowCaption.textContent = chosenIsFolded ? tabLabel(chosen) : 'More';
			const lead = chosenIsFolded ? `${tabLabel(chosen)}, ` : '';
			overflowButton.setAttribute('aria-label', `${lead}more tabs, ${folded.length} hidden`);
		}

		function overflowEntry(tab, isChosen) {
			const entry = document.createElement('button');
			entry.type = 'button';
			entry.className = isChosen ? 'dropdown-item active' : 'dropdown-item';
			if (isChosen) entry.setAttribute('aria-current', 'true');
			entry.innerHTML = tab.innerHTML;
			entry.addEventListener('click', () => {
				bootstrap.Tab.getOrCreateInstance(tab).show();
				overflowButton.focus();
			});
			const row = document.createElement('li');
			row.append(entry);
			return row;
		}

		function markScrollEdges() {
			if (!scroller) return;
			const { scrollLeft, scrollWidth, clientWidth } = scroller;
			const roomBefore = scrollLeft > 2;
			const roomAfter = scrollLeft < scrollWidth - clientWidth - 2;
			root.classList.toggle('has-more-left', roomBefore);
			root.classList.toggle('has-more-right', roomAfter);
			if (scrollBack) scrollBack.disabled = !roomBefore;
			if (scrollOn) scrollOn.disabled = !roomAfter;
		}

		function scrollByPage(direction) {
			scroller.scrollLeft += direction * scroller.clientWidth * 0.7;
		}

		/* Scrolls a tab fully into view within whichever box scrolls sideways,
       leaving a 40px margin so the arrows do not cover it. */
		function bringIntoView(tab) {
			const track = scroller || (getComputedStyle(list).overflowX === 'visible' ? null : list);
			if (!track || !tab) return;
			const trackBox = track.getBoundingClientRect();
			const tabBox = tab.getBoundingClientRect();
			const margin = 40;
			const startLimit = trackBox.left + margin;
			const endLimit = trackBox.right - margin;
			if (tabBox.left < startLimit) track.scrollLeft -= startLimit - tabBox.left;
			else if (tabBox.right > endLimit) track.scrollLeft += tabBox.right - endLimit;
		}

		function onListKey(event) {
			const tab = event.target.closest?.('.nav-link');
			if (!tab || !list.contains(tab) || event.altKey || event.ctrlKey || event.metaKey) return;
			if (canClose && (event.key === 'Delete' || event.key === 'Backspace')) {
				event.preventDefault();
				event.stopPropagation();
				closeTab(tab);
				return;
			}
			const pickIndex = ROVING_KEYS[event.key];
			if (!pickIndex) return;
			const reachable = tabList().filter(canTakeFocus);
			const from = reachable.indexOf(tab);
			if (from < 0) return;
			const destination = reachable[pickIndex(from, reachable.length)];
			event.preventDefault();
			event.stopPropagation();
			destination.focus();
			bootstrap.Tab.getOrCreateInstance(destination).show();
		}

		/**
		 * Closes a tab that has a .basalt-tabs-close button and removes its
		 * panel. A neighbor takes over the selection and focus when the
		 * closed tab had them. The tab can come back through reopen().
		 * @param {HTMLElement} tab the .nav-link to close
		 */
		function closeTab(tab) {
			const holder = tab.closest('.basalt-tabs-item') || tab;
			if (!holder.querySelector('.basalt-tabs-close')) return;
			const reachable = tabList().filter(canTakeFocus);
			const position = reachable.indexOf(tab);
			const heir = reachable[position + 1] || reachable[position - 1] || null;
			const wasSelected = tab.classList.contains('active');
			const heldFocus = holder.contains(document.activeElement);
			const pane = paneFor(tab);
			closedStack.push({ holder, pane, nextSibling: holder.nextElementSibling });
			const instance = bootstrap.Tab.getInstance(tab);
			if (heir && wasSelected) bootstrap.Tab.getOrCreateInstance(heir).show();
			if (heir && heldFocus) heir.focus();

			function detach() {
				instance?.dispose();
				holder.classList.remove('is-leaving');
				holder.remove();
				pane?.remove();
				snapInk();
				announce('basalt:tabclose', tab);
			}

			if (prefersStillness()) {
				detach();
				return;
			}
			holder.classList.add('is-leaving');
			setTimeout(detach, 180);
		}

		/**
		 * Brings back the most recently closed tab where it was, with its
		 * panel, then selects and focuses it.
		 * @returns {?HTMLElement} the tab, or null when none was closed
		 */
		function reopenTab() {
			const record = closedStack.pop();
			if (!record) return null;
			const { holder, pane, nextSibling } = record;
			list.insertBefore(holder, nextSibling?.isConnected ? nextSibling : ink);
			const tab = holder.querySelector('.nav-link');
			tab.classList.remove('active');
			tab.setAttribute('aria-selected', 'false');
			if (pane) {
				pane.classList.remove('active', 'show');
				const sibling = tabList()
					.map(paneFor)
					.find((other) => other && other !== pane);
				sibling?.parentNode.appendChild(pane);
			}
			return revealNewTab(holder, tab, 'basalt:tabreopen');
		}

		/**
		 * Adds a closable tab with its own panel at the end of the row and
		 * opens it.
		 * @param {{ label: string, html?: string, panels?: HTMLElement }} opts
		 *   the tab text, the panel markup, and the .tab-content to hold the
		 *   panel (by default the one that holds the other panels)
		 * @returns {HTMLElement} the new tab
		 */
		function addTab(opts) {
			addedTabs += 1;
			const paneId = `${root.id || 'basalt-tabs'}-new-${addedTabs}`;
			const tab = Object.assign(document.createElement('button'), {
				id: `${paneId}-tab`,
				type: 'button',
				className: 'nav-link',
				textContent: opts.label,
			});
			setAttributes(tab, {
				role: 'tab',
				'aria-selected': 'false',
				'aria-controls': paneId,
				'aria-keyshortcuts': 'Delete Backspace',
				'data-bs-toggle': 'tab',
				'data-bs-target': `#${paneId}`,
			});
			/* The cross is for the mouse; keyboard users press Delete on the tab. */
			const cross = Object.assign(document.createElement('button'), {
				type: 'button',
				className: 'basalt-tabs-close',
				title: `Close ${opts.label}`,
				tabIndex: -1,
				innerHTML: '<i class="bi bi-x-lg"></i>',
			});
			cross.setAttribute('aria-hidden', 'true');
			const holder = Object.assign(document.createElement('div'), { className: 'basalt-tabs-item' });
			holder.setAttribute('role', 'presentation');
			holder.append(tab, cross);
			list.insertBefore(holder, ink);

			const pane = Object.assign(document.createElement('div'), {
				id: paneId,
				className: 'tab-pane fade',
				tabIndex: 0,
				innerHTML: opts.html || '',
			});
			setAttributes(pane, { role: 'tabpanel', 'aria-labelledby': tab.id });
			const paneHost = opts.panels || (tabList().map(paneFor).find(Boolean) || {}).parentNode;
			paneHost?.appendChild(pane);
			return revealNewTab(holder, tab, 'basalt:tabadd');
		}

		/* Shared ending of add and reopen: play the entrance, select and
       focus the tab, then tell the page. */
		function revealNewTab(holder, tab, eventName) {
			playEntrance(holder);
			bootstrap.Tab.getOrCreateInstance(tab).show();
			tab.focus();
			announce(eventName, tab);
			return tab;
		}

		function playEntrance(holder) {
			if (prefersStillness()) return;
			holder.classList.add('is-entering');
			holder.addEventListener('animationend', () => holder.classList.remove('is-entering'), { once: true });
		}

		function announce(eventName, tab) {
			root.dispatchEvent(
				new CustomEvent(eventName, { bubbles: true, detail: { tab, label: tab ? tabLabel(tab) : '' } }),
			);
		}
	}

	function tabLabel(tab) {
		return (tab.getAttribute('data-basalt-tab-label') || tab.textContent.trim()).replace(/\s+/g, ' ').trim();
	}

	/** The panel a tab controls, found through data-bs-target or href. */
	function paneFor(tab) {
		const reference = tab.getAttribute('data-bs-target') || tab.getAttribute('href');
		return reference?.startsWith('#') ? document.getElementById(reference.slice(1)) : null;
	}

	function rowWidth(widths, count, gap) {
		return widths.slice(0, count).reduce((sum, width, index) => sum + width + (index ? gap : 0), 0);
	}

	function setAttributes(node, attributes) {
		for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
	}

	function prefersStillness() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}
})();
