/**
 * Component script for card patterns. It loads after assets/basalt/js/basalt.js, and
 * only on the pages that use it; documentation.html#page-map lists them.
 */

/**
 * Card patterns, all demonstrated on cards.html.
 *
 * [data-basalt-widget]  card tools to refresh, go full screen or remove with
 *   undo. Fires 'basalt:widget-refresh' so a page can load real numbers.
 * [data-basalt-sortable-cards]  cards reordered by their handle, with the
 *   pointer or the keyboard. Fires 'basalt:sorted'.
 * [data-basalt-flip]  a card with a front and a back face.
 * [data-basalt-dismiss-stack]  dismissible cards that can come back.
 *
 * Markup rendered after load is picked up with window.Basalt.cards.init(root).
 */
(() => {
	'use strict';
	/** True when the visitor asked the system for less motion. */
	function reduced() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/* Widget card [data-basalt-widget]: its buttons carry
     data-basalt-widget-action="refresh | fullscreen | remove". A refresh fires
     basalt:widget-refresh on the card so a page can fetch real data; the demo
     page answers with new numbers of its own. */
	function initWidget(card) {
		if (card.dataset.basaltWidgetReady) return;
		card.dataset.basaltWidgetReady = 'true';
		const holder = card.parentElement;
		const removedNote = holder.querySelector('[data-basalt-widget-removed]');
		const announcer = holder.querySelector('[data-basalt-widget-live]');
		const stamp = card.querySelector('[data-basalt-widget-stamp]');
		const expandButton = card.querySelector('.basalt-widget-tool[data-basalt-widget-action="fullscreen"]');
		const name = card.querySelector('.basalt-widget-title')?.textContent || 'Widget';
		const actions = {
			refresh: reload,
			fullscreen: () => setExpanded(!card.classList.contains('is-full')),
			remove: dismiss,
		};
		let backdrop = null;
		let loading = false;

		card.addEventListener('click', onToolClick);
		card.addEventListener('keydown', onCardKey);
		removedNote?.querySelector('[data-basalt-widget-undo]')?.addEventListener('click', bringBack);

		/* Clearing first makes screen readers repeat a message that has not changed. */
		function announce(text) {
			if (!announcer) return;
			announcer.textContent = '';
			setTimeout(() => {
				announcer.textContent = text;
			}, 30);
		}

		function onToolClick(event) {
			const tool = event.target.closest('[data-basalt-widget-action]');
			if (!tool || !card.contains(tool)) return;
			const action = tool.getAttribute('data-basalt-widget-action');
			if (Object.hasOwn(actions, action)) actions[action]();
		}

		function onCardKey(event) {
			if (!card.classList.contains('is-full')) return;
			if (event.key === 'Escape') leaveOnEscape();
			else if (event.key === 'Tab') holdTab(event);
		}

		function reload() {
			if (loading) return;
			loading = true;
			card.classList.add('is-busy');
			card.setAttribute('aria-busy', 'true');
			card.dispatchEvent(new CustomEvent('basalt:widget-refresh', { bubbles: true }));
			setTimeout(settle, 900);
		}

		function settle() {
			loading = false;
			card.classList.remove('is-busy');
			card.removeAttribute('aria-busy');
			if (stamp) stamp.textContent = 'Updated just now';
			announce(`${name} updated`);
		}

		/* Full screen turns the card into a modal dialog over a scrim. */
		function setExpanded(on) {
			card.classList.toggle('is-full', on);
			document.documentElement.classList.toggle('basalt-widget-lock', on);
			if (expandButton) {
				expandButton.setAttribute('aria-pressed', String(on));
				expandButton.setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen');
				const glyph = expandButton.querySelector('.bi');
				if (glyph) glyph.className = on ? 'bi bi-arrows-angle-contract' : 'bi bi-arrows-angle-expand';
			}
			if (!on) {
				backdrop?.remove();
				backdrop = null;
				card.removeAttribute('role');
				card.removeAttribute('aria-modal');
				return;
			}
			backdrop = document.createElement('div');
			backdrop.className = 'basalt-widget-scrim';
			backdrop.addEventListener('click', () => setExpanded(false));
			document.body.appendChild(backdrop);
			card.setAttribute('role', 'dialog');
			card.setAttribute('aria-modal', 'true');
			expandButton?.focus();
		}

		/* An open menu inside the card gets Escape first. */
		function leaveOnEscape() {
			if (card.querySelector('.dropdown-menu.show')) return;
			setExpanded(false);
			expandButton?.focus();
		}

		/* While the card covers the page, Tab cycles through its own controls. */
		function holdTab(event) {
			const stops = [...card.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')].filter(
				(el) => el.offsetParent !== null && !el.disabled,
			);
			if (stops.length === 0) return;
			const atEdge = event.shiftKey ? stops[0] : stops.at(-1);
			if (document.activeElement !== atEdge) return;
			event.preventDefault();
			(event.shiftKey ? stops.at(-1) : stops[0]).focus();
		}

		function dismiss() {
			if (card.classList.contains('is-full')) setExpanded(false);
			card.hidden = true;
			if (removedNote) {
				removedNote.hidden = false;
				removedNote.querySelector('[data-basalt-widget-undo]')?.focus();
			}
			announce(`${name} removed`);
		}

		function bringBack() {
			removedNote.hidden = true;
			card.hidden = false;
			card.querySelector('.basalt-widget-tool')?.focus();
			announce(`${name} is back`);
		}
	}

	/* Sortable cards [data-basalt-sortable-cards]: each
     [data-basalt-sortable-cards-item] has a .basalt-sortable-cards-handle.
     Drag it with the pointer, or press Space / Enter to lift and drop, the
     arrows to move and Escape to cancel. The list then fires basalt:sorted
     with detail.order, the cards' labels in their new order. */
	function initSortable(list) {
		if (list.dataset.basaltSortableCardsReady) return;
		list.dataset.basaltSortableCardsReady = 'true';
		const announcer = list.parentElement.querySelector('[data-basalt-sortable-cards-live]');
		/* The card lifted from the keyboard, and the order Escape returns to. */
		let carried = null;
		let orderBeforeLift = null;
		/* The pointer drag under way: its card, the Y it is measured from, and
       whether the card has changed places yet. */
		let pointerDrag = null;

		list.addEventListener('keydown', onKey);
		list.addEventListener('focusout', (event) => {
			if (carried && !list.contains(event.relatedTarget)) settleCarry(false);
		});
		list.addEventListener('pointerdown', onPointerDown);
		list.addEventListener('pointermove', onPointerMove);
		list.addEventListener('pointerup', endPointerDrag);
		list.addEventListener('pointercancel', endPointerDrag);
		for (const card of cards()) {
			card.querySelector('.basalt-sortable-cards-handle')?.setAttribute('aria-pressed', 'false');
		}

		function cards() {
			return [...list.querySelectorAll(':scope > [data-basalt-sortable-cards-item]')];
		}

		function cardName(card) {
			return card.getAttribute('data-label') || card.textContent.trim();
		}

		function placeOf(card) {
			const all = cards();
			return `position ${all.indexOf(card) + 1} of ${all.length}`;
		}

		function announce(text) {
			if (announcer) announcer.textContent = text;
		}

		function renumber() {
			for (const [index, card] of cards().entries()) {
				const slot = card.querySelector('[data-basalt-sortable-cards-pos]');
				if (slot) slot.textContent = String(index + 1);
			}
		}

		function commitOrder() {
			renumber();
			const detail = { order: cards().map(cardName) };
			list.dispatchEvent(new CustomEvent('basalt:sorted', { bubbles: true, detail }));
		}

		/**
		 * Moves `card` one place, up for -1 and down for +1, by moving the
		 * neighbor around it, so a focused handle never leaves the document.
		 * @returns {boolean} false when the card is already at that end
		 */
		function shift(card, direction) {
			const neighbor = direction < 0 ? card.previousElementSibling : card.nextElementSibling;
			if (!neighbor) return false;
			const neighborTop = neighbor.offsetTop;
			list.insertBefore(neighbor, direction < 0 ? card.nextElementSibling : card);
			glide(neighbor, neighborTop);
			return true;
		}

		/* Plays the neighbor's jump back from its old spot to its new one. */
		function glide(el, fromTop) {
			if (reduced()) return;
			const offset = fromTop - el.offsetTop;
			if (!offset) return;
			Object.assign(el.style, { transition: 'none', transform: `translateY(${offset}px)` });
			requestAnimationFrame(() => Object.assign(el.style, { transition: 'transform 180ms ease', transform: '' }));
		}

		function onKey(event) {
			const grip = event.target.closest('.basalt-sortable-cards-handle');
			if (!grip) return;
			const card = grip.closest('[data-basalt-sortable-cards-item]');
			if (event.key === ' ' || event.key === 'Enter') {
				event.preventDefault();
				toggleCarry(card, grip);
				return;
			}
			if (carried !== card) return;
			if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
				event.preventDefault();
				if (!shift(card, event.key === 'ArrowUp' ? -1 : 1)) return;
				renumber();
				announce(`${cardName(card)}, ${placeOf(card)}.`);
			} else if (event.key === 'Escape') {
				event.preventDefault();
				settleCarry(true);
			}
		}

		function toggleCarry(card, grip) {
			if (carried === card) {
				settleCarry(false);
				return;
			}
			if (carried) settleCarry(false);
			carried = card;
			orderBeforeLift = cards();
			card.classList.add('is-lifted');
			grip.setAttribute('aria-pressed', 'true');
			announce(
				`${cardName(card)} picked up, ${placeOf(card)}. Use the arrow keys to move it, Space to drop it, Escape to cancel.`,
			);
		}

		/* Puts the carried card down where it is, or back where it started. */
		function settleCarry(canceled) {
			if (!carried) return;
			const card = carried;
			const grip = card.querySelector('.basalt-sortable-cards-handle');
			if (canceled && orderBeforeLift) {
				for (const each of orderBeforeLift) list.appendChild(each);
				announce(`${cardName(card)} put back, ${placeOf(card)}.`);
			} else {
				announce(`${cardName(card)} dropped at ${placeOf(card)}.`);
			}
			card.classList.remove('is-lifted');
			grip.setAttribute('aria-pressed', 'false');
			carried = null;
			orderBeforeLift = null;
			commitOrder();
			grip.focus();
		}

		function onPointerDown(event) {
			const grip = event.target.closest('.basalt-sortable-cards-handle');
			if (!grip || event.button !== 0) return;
			event.preventDefault();
			if (carried) settleCarry(false);
			const grabbed = grip.closest('[data-basalt-sortable-cards-item]');
			grip.setPointerCapture(event.pointerId);
			grip.focus({ preventScroll: true });
			pointerDrag = { card: grabbed, anchorY: event.clientY, moved: false };
			grabbed.classList.add('is-dragging');
		}

		function onPointerMove(event) {
			if (!pointerDrag) return;
			const { card } = pointerDrag;
			follow(event.clientY);
			const box = card.getBoundingClientRect();
			const direction = crossing(card, box.top + box.height / 2);
			if (!direction) return;
			const topBefore = card.offsetTop;
			shift(card, direction);
			pointerDrag.anchorY += card.offsetTop - topBefore;
			pointerDrag.moved = true;
			follow(event.clientY);
			renumber();
		}

		function follow(pointerY) {
			pointerDrag.card.style.transform = `translateY(${pointerY - pointerDrag.anchorY}px)`;
		}

		/* +1 once the dragged card's middle passes the next card's middle, -1 for
       the previous one, otherwise 0. */
		function crossing(card, middle) {
			const below = card.nextElementSibling;
			const above = card.previousElementSibling;
			if (below && middle > below.getBoundingClientRect().top + below.offsetHeight / 2) return 1;
			if (above && middle < above.getBoundingClientRect().top + above.offsetHeight / 2) return -1;
			return 0;
		}

		function endPointerDrag() {
			if (!pointerDrag) return;
			const { card: dropped, moved } = pointerDrag;
			dropped.classList.remove('is-dragging');
			dropped.style.transform = '';
			if (moved) {
				announce(`${cardName(dropped)} dropped at ${placeOf(dropped)}.`);
				commitOrder();
			}
			pointerDrag = null;
		}
	}

	/* Flip card
	   A [data-basalt-flip] card carries two faces. Any
	   [data-basalt-flip-toggle] on either face turns it over, and focus
	   follows to the toggle on the face that is now showing. */
	function mountFlipCard(card) {
		if (card.dataset.basaltFlipReady) return;
		card.dataset.basaltFlipReady = 'true';
		const faces = {
			front: card.querySelector('.basalt-flip-card-front'),
			back: card.querySelector('.basalt-flip-card-back'),
		};

		function turnOver() {
			const showingBack = !card.classList.contains('is-flipped');
			card.classList.toggle('is-flipped', showingBack);
			faces.front.inert = showingBack;
			faces.back.inert = !showingBack;
			for (const toggle of card.querySelectorAll('[data-basalt-flip-toggle]')) {
				toggle.setAttribute('aria-expanded', String(showingBack));
			}
			const upperFace = showingBack ? faces.back : faces.front;
			upperFace.querySelector('[data-basalt-flip-toggle]')?.focus({ preventScroll: true });
		}

		for (const toggle of card.querySelectorAll('[data-basalt-flip-toggle]')) {
			toggle.setAttribute('aria-expanded', 'false');
			toggle.addEventListener('click', turnOver);
		}
	}

	/* Dismissible cards live in a [data-basalt-dismiss-stack]. Closing one
     with its [data-basalt-dismiss-close] button parks an undo bar in its
     place; the card is really gone only when that bar runs out. */
	function mountDismissStack(stack) {
		if (stack.dataset.basaltDismissReady) return;
		stack.dataset.basaltDismissReady = 'true';
		const UNDO_WINDOW = 6000;
		const cards = [...stack.querySelectorAll('[data-basalt-dismiss]')];
		const emptyNote = stack.parentElement.querySelector('[data-basalt-dismiss-empty]');

		stack.addEventListener('click', (event) => {
			const closer = event.target.closest('[data-basalt-dismiss-close]');
			if (!closer) return;
			const card = closer.closest('[data-basalt-dismiss]');
			if (reduced()) {
				parkCard(card);
				return;
			}
			card.classList.add('is-leaving');
			setTimeout(() => parkCard(card), 220);
		});

		const restoreAll = emptyNote?.querySelector('[data-basalt-dismiss-reset]');
		restoreAll?.addEventListener('click', () => {
			for (const card of cards) card.hidden = false;
			syncEmptyNote();
			cards[0].querySelector('[data-basalt-dismiss-close]').focus();
		});

		/* The empty note shows only when no card and no undo bar is left. */
		function syncEmptyNote() {
			if (!emptyNote) return;
			const anyCard = cards.some((card) => !card.hidden);
			const anyBar = stack.querySelector('.basalt-undo-bar') !== null;
			emptyNote.hidden = anyCard || anyBar;
		}

		/** Hides the card and leaves a counting-down undo bar right after it. */
		function parkCard(card) {
			const heading = card.querySelector('.basalt-dismiss-card-title') || card;
			card.hidden = true;
			card.classList.remove('is-leaving');

			const bar = document.createElement('div');
			bar.setAttribute('role', 'status');
			bar.className = 'basalt-undo-bar';
			bar.style.setProperty('--basalt-undo-ms', `${UNDO_WINDOW}ms`);
			bar.innerHTML = [
				'<span class="basalt-undo-bar-text"></span>',
				'<button class="btn btn-sm btn-outline-light" type="button">Undo</button>',
				'<span aria-hidden="true" class="basalt-undo-bar-time"></span>',
			].join('');
			bar.firstElementChild.textContent = `“${heading.textContent.trim()}” hidden.`;
			card.after(bar);

			/* The countdown stands still while the pointer or focus rests on it. */
			const undoButton = bar.querySelector('button');
			let remaining = UNDO_WINDOW;
			let resumedAt = Date.now();
			let pending = 0;

			function resume() {
				resumedAt = Date.now();
				pending = setTimeout(expire, remaining);
			}
			function freeze() {
				clearTimeout(pending);
				remaining -= Date.now() - resumedAt;
				bar.classList.add('is-held');
			}
			function expire() {
				clearTimeout(pending);
				bar.remove();
				syncEmptyNote();
			}

			undoButton.addEventListener('click', () => {
				clearTimeout(pending);
				bar.remove();
				card.hidden = false;
				syncEmptyNote();
				card.querySelector('[data-basalt-dismiss-close]').focus();
			});
			bar.addEventListener('mouseenter', freeze);
			bar.addEventListener('mouseleave', resume);
			undoButton.addEventListener('focus', freeze);
			undoButton.addEventListener('blur', resume);
			undoButton.focus();
			resume();
			syncEmptyNote();
		}
	}

	/** Card types this file knows, in the order they are switched on. */
	const CARD_KINDS = [
		['[data-basalt-widget]', initWidget],
		['[data-basalt-sortable-cards]', initSortable],
		['[data-basalt-flip]', mountFlipCard],
		['[data-basalt-dismiss-stack]', mountDismissStack],
	];

	/**
	 * Switches on every card type inside a part of the page.
	 * @param {ParentNode} [scope=document] Where to look; cards already set up are skipped.
	 */
	function mountCards(scope) {
		const area = scope || document;
		for (const [selector, mount] of CARD_KINDS) {
			for (const card of area.querySelectorAll(selector)) mount(card);
		}
	}

	window.Basalt.cards = { init: mountCards };
	document.addEventListener('DOMContentLoaded', () => mountCards());
})();
