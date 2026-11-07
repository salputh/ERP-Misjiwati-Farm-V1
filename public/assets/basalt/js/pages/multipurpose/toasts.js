/**
 * Drives the demos on toasts.html: the group chips over the card grid,
 * the snippet copy buttons, the stack presets and placement, the undoable
 * removal, the loading toast that settles, and the in-card toasts that can
 * be closed and shown again. The stack itself (window.Basalt.toasts) is
 * defined in basalt.js; the stock Bootstrap cards run on Bootstrap's Toast.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-ts-root]', document);
	if (!pageRoot || !window.Basalt.toasts) return;

	const stack = window.Basalt.toasts;
	const COPY_RESET_MS = 1800;
	const BURST_GAP_MS = 280;
	const BURST_ORDER = ['order', 'paid', 'stock', 'archive'];
	const copyResets = new WeakMap();

	/* Readable names for the stack corners, used in the "Moved" toast. */
	const CORNER_WORDS = {
		'bottom-end': 'bottom right',
		'bottom-center': 'bottom center',
		'top-end': 'top right',
		'top-center': 'top center',
	};

	/* Each preset builds a fresh toast; the order preset numbers itself upward. */
	let upcomingOrder = 1064;
	const PRESETS = {
		order: () => ({
			tone: 'primary',
			icon: 'bi-bag-check',
			title: `New order #${upcomingOrder++}`,
			text: '3 items, $267.00, ships today.',
			actions: [{ label: 'View order' }],
		}),
		paid: () => ({
			tone: 'success',
			icon: 'bi-cash-coin',
			title: 'Payment received',
			text: '$267.00 from Carly McCall for order #1063.',
		}),
		stock: () => ({
			tone: 'warning',
			icon: 'bi-box-seam',
			title: 'Low stock',
			text: 'Car 7 is down to 4 boxes of gloves.',
			actions: [{ label: 'Reorder' }, { label: 'Later', ghost: true }],
		}),
		failed: () => ({
			tone: 'danger',
			icon: 'bi-credit-card',
			title: 'Payment failed',
			text: 'The card for order #1058 was declined. This one stays until you close it.',
			duration: 0,
			actions: [{ label: 'Send a payment link' }],
		}),
		archive: () => ({
			icon: 'bi-archive',
			title: 'Order #1049 archived',
			text: 'Find it under Archived orders.',
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						stack.push({ tone: 'success', title: 'Order #1049 is back', duration: 3000 });
					},
				},
			],
		}),
	};

	function start() {
		wireGroupChips();
		wireSnippetCopy();
		wireStackControls();
		wireUndoDemo();
		wireLoadingDemo();
		wireReplyDemo();
		wireStaticNotices();
		wireSnackbars();
		if (window.bootstrap) {
			wireBootstrapCards();
			wirePlacementDemo();
		}
	}

	/* Small lookups, scoped to the demo page unless told otherwise. */
	function pick(selector, scope = pageRoot) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = pageRoot) {
		return [...scope.querySelectorAll(selector)];
	}

	function countLabel(total, singular, plural) {
		return `${total} ${total === 1 ? singular : plural}`;
	}

	/* Group chips: a card can belong to several groups, listed in data-ts-groups. */
	function wireGroupChips() {
		const board = pick('[data-ts-grid]');
		if (!board) return;
		const tally = pick('[data-ts-count]');
		const tiles = pickAll('.ts-card', board);
		const chips = pickAll('[data-ts-filter]');

		function showGroup(wanted) {
			const visible = tiles.filter((tile) => {
				const memberships = (tile.getAttribute('data-ts-groups') || '').split(/\s+/);
				const match = wanted === 'all' || memberships.includes(wanted);
				tile.classList.toggle('is-hidden', !match);
				tile.classList.remove('is-alone');
				return match;
			});
			markLoneHalves(visible);
			if (tally) tally.textContent = countLabel(visible.length, 'toast type', 'toast types');
		}

		for (const chip of chips) {
			chip.addEventListener('click', () => {
				for (const other of chips) other.setAttribute('aria-pressed', String(other === chip));
				showGroup(chip.getAttribute('data-ts-filter'));
			});
		}

		showGroup('all');
	}

	/**
	 * Half-width cards sit two to a row between the full-width ones. When a
	 * stretch of them has an odd count, its last card spans the whole row.
	 */
	function markLoneHalves(visible) {
		let stretch = [];
		function settle() {
			if (stretch.length % 2 === 1) stretch.at(-1).classList.add('is-alone');
			stretch = [];
		}
		for (const tile of visible) {
			if (tile.classList.contains('ts-card-full')) settle();
			else stretch.push(tile);
		}
		settle();
	}

	/* Copy buttons put the neighboring snippet on the clipboard and confirm. */
	function wireSnippetCopy() {
		for (const button of pickAll('[data-ts-copy]')) {
			button.addEventListener('click', () => {
				const snippet = pick('pre', button.parentElement);
				if (!snippet) return;
				window.Basalt.copyText(snippet.textContent.trim()).then(() => confirmCopied(button));
			});
		}
	}

	function confirmCopied(button) {
		const glyph = pick('.bi', button);
		function setState(word, glyphClass) {
			button.lastChild.textContent = ` ${word}`;
			if (glyph) glyph.className = glyphClass;
		}
		setState('Copied', 'bi bi-check2');
		clearTimeout(copyResets.get(button));
		copyResets.set(
			button,
			setTimeout(() => setState('Copy', 'bi bi-clipboard'), COPY_RESET_MS),
		);
	}

	/* The stack card: preset buttons, a staggered burst, clear-all, corners, and the header test. */
	function wireStackControls() {
		for (const trigger of pickAll('[data-ts-send]')) {
			trigger.addEventListener('click', () => stack.push(PRESETS[trigger.getAttribute('data-ts-send')]()));
		}

		pick('[data-ts-burst]')?.addEventListener('click', () => {
			for (const [step, preset] of BURST_ORDER.entries()) {
				setTimeout(() => stack.push(PRESETS[preset]()), step * BURST_GAP_MS);
			}
		});

		pick('[data-ts-clear]')?.addEventListener('click', () => stack.clear());

		for (const corner of pickAll('input[name="ts-where"]')) {
			corner.addEventListener('change', () => {
				if (!corner.checked) return;
				stack.position(corner.value);
				stack.push({
					tone: 'info',
					icon: 'bi-arrows-move',
					title: 'Moved',
					text: `The stack now sits at the ${CORNER_WORDS[corner.value]}.`,
					duration: 3500,
				});
			});
		}

		pick('[data-ts-hero-send]', document)?.addEventListener('click', () =>
			stack.push({
				tone: 'primary',
				icon: 'bi-bell',
				title: 'Test toast',
				text: 'Sent from the page header. It closes in six seconds.',
			}),
		);
	}

	/* Removing a row hides it behind an Undo toast; it is only really gone once that toast closes. */
	function wireUndoDemo() {
		const card = pick('[data-ts-undo]');
		if (!card) return;
		const listing = pick('.ts-rows', card);
		const emptyNote = pick('[data-ts-undo-empty]', card);
		const originalRows = listing.innerHTML;

		function shownRows() {
			return pickAll('[data-ts-row]', listing).filter((row) => !row.hidden);
		}

		function syncEmptyNote() {
			emptyNote.hidden = shownRows().length > 0;
		}

		function restore(row) {
			row.hidden = false;
			syncEmptyNote();
			row.classList.add('is-back');
			requestAnimationFrame(() => requestAnimationFrame(() => row.classList.remove('is-back')));
			pick('[data-ts-remove]', row).focus();
		}

		listing.addEventListener('click', (event) => {
			const trigger = event.target.closest('[data-ts-remove]');
			if (!trigger) return;
			const row = trigger.closest('[data-ts-row]');
			const label = pick('.ts-row-name', row).textContent.trim();
			const before = shownRows();
			const position = before.indexOf(row);

			row.hidden = true;
			syncEmptyNote();
			const neighbor = before[position + 1] || before[position - 1];
			if (neighbor) pick('[data-ts-remove]', neighbor).focus();
			else pick('button', emptyNote).focus();

			stack.push({
				icon: 'bi-trash3',
				title: `Removed ${label}`,
				text: 'It is off the shop list.',
				duration: 6000,
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							restore(row);
						},
					},
				],
				/* Closing for any reason other than the Undo action makes the removal final. */
				onClose: (reason) => {
					if (reason === 'action') return;
					row.remove();
					syncEmptyNote();
				},
			});
		});

		pick('[data-ts-undo-reset]', card).addEventListener('click', () => {
			listing.innerHTML = originalRows;
			syncEmptyNote();
			pick('[data-ts-remove]', listing).focus();
		});
	}

	/* A loading toast that turns into success or failure; failure offers a retry in place. */
	function wireLoadingDemo() {
		const card = pick('[data-ts-promise]');
		if (!card) return;
		for (const trigger of pickAll('[data-ts-publish]', card)) {
			trigger.addEventListener('click', () =>
				publishPriceList(trigger.getAttribute('data-ts-publish') === 'fail'),
			);
		}
	}

	/**
	 * Shows the busy state, then settles after a pause. A retry passes the
	 * existing toast back in so it updates in place instead of stacking a new one.
	 */
	function publishPriceList(willFail, existing) {
		const busy = {
			tone: 'loading',
			icon: '',
			title: 'Publishing price list',
			text: 'price-list-october.csv, 48 products',
			duration: 0,
			actions: [],
		};
		let handle = existing;
		if (handle) handle.update(busy);
		else handle = stack.push(busy);

		setTimeout(() => {
			if (!handle.el.isConnected) return;
			if (willFail) {
				handle.update({
					tone: 'danger',
					icon: 'bi-wifi-off',
					title: 'Could not reach the shop',
					text: 'Nothing was changed. Check the connection and try again.',
					duration: 0,
					actions: [
						{
							label: 'Try again',
							onClick: () => {
								publishPriceList(false, handle);
								return false;
							},
						},
					],
				});
				return;
			}
			handle.update({
				tone: 'success',
				icon: 'bi-check2-circle',
				title: 'Price list published',
				text: '12 new prices are live in the shop.',
				duration: 5000,
				actions: [{ label: 'View products', ghost: true }],
			});
		}, 1800);
	}

	/**
	 * Returns a function that empties `holder` and leaves a note with a button
	 * putting the original markup back. `afterRestore` runs once it is back.
	 */
	function makeDismissible(holder, afterRestore) {
		const markup = holder.innerHTML;

		return function dismiss(message) {
			holder.innerHTML = '';
			const note = document.createElement('p');
			note.className = 'ts-empty';
			note.append(`${message} `);

			const again = document.createElement('button');
			again.type = 'button';
			again.className = 'ts-link';
			again.textContent = 'Show it again';
			again.addEventListener('click', () => {
				holder.innerHTML = markup;
				afterRestore?.();
				pick('input, button', holder)?.focus();
			});

			note.appendChild(again);
			holder.appendChild(note);
			again.focus();
		};
	}

	/* The reply toast swaps its form for the sent line; its close button dismisses the card. */
	function wireReplyDemo() {
		const holder = pick('[data-ts-reply]');
		if (!holder) return;
		const dismiss = makeDismissible(holder);

		holder.addEventListener('submit', (event) => {
			const replyForm = event.target.closest('[data-ts-reply-form]');
			if (!replyForm) return;
			event.preventDefault();
			const field = pick('input', replyForm);
			const message = field.value.trim();
			if (!message) {
				field.focus();
				return;
			}
			const notice = replyForm.closest('.toast');
			pick('.basalt-notice-head', notice).textContent = 'Reply sent to Carly';
			pick('[data-ts-reply-text]', notice).textContent = `You: ${message}`;
			replyForm.remove();
			pick('.basalt-notice-dismiss', notice).focus();
		});

		holder.addEventListener('click', (event) => {
			if (event.target.closest('[data-ts-reply-close]')) dismiss('Message dismissed.');
		});
	}

	/* Static notices: any of their buttons dismisses them, with a note matched to the button. */
	function wireStaticNotices() {
		for (const closer of pickAll('[data-ts-static-close]')) {
			const holder = closer.closest('.ts-inline');
			const dismiss = makeDismissible(holder);
			holder.addEventListener('click', (event) => {
				const pressed = event.target.closest('button');
				if (!pressed?.closest('.basalt-notice')) return;
				dismiss(staticNoticeOutcome(pressed));
			});
		}
	}

	function staticNoticeOutcome(pressed) {
		if (pressed.hasAttribute('data-ts-static-close')) return 'Toast dismissed.';
		return pressed.textContent.trim() === 'Start packing'
			? 'Packing started for order #1063.'
			: 'Order #1063 opened.';
	}

	/* A snackbar's action flips its line between done and undone. */
	function wireSnackbars() {
		for (const action of pickAll('.basalt-notice-bar .basalt-notice-anchor')) {
			action.addEventListener('click', () => {
				const undoing = action.textContent.trim() === 'Undo';
				action.previousElementSibling.textContent = undoing
					? 'Order #1058 is back in the queue'
					: 'Order #1058 marked as collected';
				action.textContent = undoing ? 'Redo' : 'Undo';
			});
		}
	}

	/* Stock Bootstrap toasts stay put until closed, and a closed card offers to show them again. */
	function wireBootstrapCards() {
		for (const notice of pickAll('.ts-inline .toast:not(.basalt-notice)')) {
			window.bootstrap.Toast.getOrCreateInstance(notice, { autohide: false });
		}

		for (const holder of pickAll('.ts-inline')) {
			if (pick('.toast:not(.basalt-notice)', holder)) {
				holder.addEventListener('hidden.bs.toast', () => afterBootstrapClose(holder));
			}
		}
	}

	/** Moves focus to a toast still open in `holder`, or shows the "Show again" note. */
	function afterBootstrapClose(holder) {
		const stillOpen = pickAll('.toast.show', holder);
		if (stillOpen.length) {
			pick('.btn-close, .btn', stillOpen[0])?.focus();
			return;
		}
		const note = pick('.ts-empty', holder) || buildReshowNote(holder);
		note.hidden = false;
		pick('button', note).focus();
	}

	function buildReshowNote(holder) {
		const note = document.createElement('p');
		note.className = 'ts-empty';
		note.append("Closed with Bootstrap's own script. ");

		const again = document.createElement('button');
		again.type = 'button';
		again.className = 'ts-link';
		again.textContent = 'Show again';
		again.addEventListener('click', () => {
			note.hidden = true;
			for (const notice of pickAll('.toast', holder)) window.bootstrap.Toast.getOrCreateInstance(notice).show();
			pick('.toast .btn-close, .toast .btn', holder)?.focus();
		});

		note.appendChild(again);
		holder.appendChild(note);
		return note;
	}

	/* Placement: the radios move the fixed container, echo its classes and show the toast there. */
	function wirePlacementDemo() {
		const picker = pick('[data-ts-place]');
		const container = pick('[data-ts-place-container]');
		const sample = document.getElementById('ts-live');
		if (!picker || !container || !sample) return;

		const classEcho = pick('[data-ts-pos-class]', picker);
		const cornerEcho = pick('[data-ts-live-where]', container);
		const sampleToast = window.bootstrap.Toast.getOrCreateInstance(sample);

		for (const option of pickAll('input[name="ts-pos"]', picker)) {
			option.addEventListener('change', () => {
				if (!option.checked) return;
				container.className = `toast-container position-fixed p-3 ${option.value}`;
				classEcho.textContent = option.value;
				cornerEcho.textContent = option.getAttribute('aria-label').toLowerCase();
				sampleToast.show();
			});
		}

		pick('[data-ts-place-show]', picker).addEventListener('click', () => sampleToast.show());
	}

	start();
})();
