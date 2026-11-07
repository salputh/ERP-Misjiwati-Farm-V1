/**
 * Page glue for alerts.html: the kind filter over the demo cards, the
 * snippet copy buttons, the live demos (reorder, import progress, error
 * summary, expandable rows, banner, notice group, Bootstrap dismissal)
 * and the header button that puts every demo back. The alert behavior on
 * show (window.Basalt.alert and the [data-basalt-alert-*] and
 * [data-basalt-banner] hooks) lives in basalt.js.
 */
(() => {
	'use strict';
	const shell = pick('[data-al-root]', document);
	const alerts = window.Basalt.alert;
	if (!shell || !alerts) return;

	const COPIED_FOR_MS = 1800;
	const TONES = ['primary', 'success', 'warning', 'danger', 'info', 'secondary'];
	const IMPORT_ROWS = 480;
	const IMPORT_TICK_MS = 110;
	const ORDER_DELAY_MS = 1200;
	const CONFIRM_SECONDS = 8;
	const PRICE_PATTERN = /^\d{1,5}(\.\d{1,2})?$/;

	/**
	 * Wires the filter and copy buttons, starts each demo (each hands back
	 * the function that puts it back as it first was) and hooks the header
	 * button up to run them all.
	 */
	function start() {
		setUpKindFilter();
		for (const button of pickAll('[data-al-copy]')) button.addEventListener('click', () => copySnippet(button));

		const demos = [
			setUpReorder,
			setUpImport,
			setUpErrorSummary,
			setUpExpand,
			setUpBanner,
			setUpGroup,
			setUpDismissible,
		];
		const resets = demos.map((setUp) => setUp()).filter(Boolean);

		pick('[data-al-restore-all]', document)?.addEventListener('click', () => {
			for (const runReset of resets) runReset();
			alerts.refresh(shell);
		});
	}

	/* Shared helpers. */

	function pick(selector, scope = shell) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = shell) {
		return [...scope.querySelectorAll(selector)];
	}

	function countOf(n, singular, pluralForm) {
		return `${n} ${n === 1 ? singular : pluralForm}`;
	}

	/** Remembers a demo's markup now and returns a function that restores
      it, then runs the optional follow-up. */
	function rememberMarkup(node, afterwards) {
		const savedMarkup = node.innerHTML;
		return () => {
			node.innerHTML = savedMarkup;
			afterwards?.();
		};
	}

	function retone(alert, tone) {
		alert.classList.remove(...TONES.map((swatch) => `alert-${swatch}`));
		alert.classList.add(`alert-${tone}`);
	}

	/** An alert action button; ghost gives the outline style, hook adds an
      empty data attribute the demo listens for. */
	function alertButton(text, ghost, hook) {
		const button = Object.assign(document.createElement('button'), {
			type: 'button',
			className: ghost ? 'btn btn-sm basalt-alert-btn basalt-alert-btn-ghost' : 'btn btn-sm basalt-alert-btn',
			textContent: text,
		});
		if (hook) button.setAttribute(hook, '');
		return button;
	}

	function revealAndFocus(note) {
		note.hidden = false;
		pick('button', note).focus();
	}

	/* Kind filter and snippet copy. */

	function setUpKindFilter() {
		const cardGrid = pick('[data-al-grid]');
		if (!cardGrid) return;
		const tally = pick('[data-al-count]');
		const demoCards = pickAll('.al-card', cardGrid);

		const showGroup = (chosen) => {
			const matching = demoCards.filter(
				(card) => chosen === 'all' || (card.getAttribute('data-al-groups') || '').split(/\s+/).includes(chosen),
			);
			for (const card of demoCards) {
				card.classList.toggle('is-hidden', !matching.includes(card));
				card.classList.remove('is-alone');
			}
			pairHalfCards(matching);
			if (tally) tally.textContent = countOf(matching.length, 'alert type', 'alert types');
		};

		for (const pressed of pickAll('[data-al-filter]')) {
			pressed.addEventListener('click', () => {
				for (const peer of pickAll('[data-al-filter]'))
					peer.setAttribute('aria-pressed', String(peer === pressed));
				showGroup(pressed.getAttribute('data-al-filter'));
			});
		}
		showGroup('all');
	}

	/**
	 * Half-width cards sit side by side between the full-width ones. When a
	 * stretch of half cards has an odd count, its last card spans the row.
	 */
	function pairHalfCards(matching) {
		let stretch = 0;
		for (const [index, card] of matching.entries()) {
			const spansRow = card.classList.contains('al-card-full');
			if (!spansRow) stretch += 1;
			if (!spansRow && index < matching.length - 1) continue;
			const lastHalf = spansRow ? matching[index - 1] : card;
			if (stretch % 2) lastHalf.classList.add('is-alone');
			stretch = 0;
		}
	}

	/** Copies the snippet beside the button; the button reads Copied with a
      check for a moment, then goes back. */
	function copySnippet(button) {
		const snippetPre = pick('pre', button.parentElement);
		if (!snippetPre) return;
		const looks = { done: [' Copied', 'bi bi-check2'], idle: [' Copy', 'bi bi-clipboard'] };
		const wear = (state) => {
			const [words, glyphClass] = looks[state];
			const mark = pick('.bi', button);
			button.lastChild.textContent = words;
			if (mark) mark.className = glyphClass;
		};
		window.Basalt.copyText(snippetPre.textContent.trim()).then(() => {
			wear('done');
			clearTimeout(button._alTimer);
			button._alTimer = setTimeout(() => wear('idle'), COPIED_FOR_MS);
		});
	}

	/* Reorder demo: a low stock warning that places an order in place,
     turns into a confirmation that counts itself down, and leaves a note
     with a way back when it closes. */

	function setUpReorder() {
		const card = pick('[data-al-action]');
		if (!card) return null;
		const putBack = rememberMarkup(card);
		let orderTimer = 0;
		let closeReason = '';

		/* The demo's nodes are looked up fresh each time, because a reset
       swaps them all out. */
		const piece = (hook) => pick(`[data-al-reorder${hook}]`, card);
		const alertBox = () => piece('');

		const showLowStock = (focusFirst) => {
			const box = alertBox();
			box.hidden = false;
			piece('-gone').hidden = true;
			retone(box, 'warning');
			pick('.basalt-alert-icon .bi', box).className = 'bi bi-box-seam';
			piece('-title').textContent = 'Shield Sunglasses stock is low';
			piece('-text').textContent = '6 pairs are left, about four days of orders at the current pace.';
			pick('[data-basalt-alert-timer]', box).hidden = true;
			const actionRow = piece('-actions');
			actionRow.replaceChildren(
				alertButton('Reorder 60 pairs', false, 'data-al-reorder-go'),
				alertButton('Remind me tomorrow', true, 'data-al-reorder-later'),
			);
			if (focusFirst) actionRow.firstChild.focus();
		};

		const showPlaced = () => {
			const box = alertBox();
			retone(box, 'success');
			pick('.basalt-alert-icon .bi', box).className = 'bi bi-check2-circle';
			piece('-title').textContent = 'Reorder placed';
			piece('-text').textContent = '60 pairs of Shield Sunglasses arrive on Thursday. Order #2291.';
			const viewLink = Object.assign(document.createElement('a'), {
				className: 'btn btn-sm basalt-alert-btn basalt-alert-btn-ghost',
				href: '#',
				textContent: 'View order',
			});
			viewLink.setAttribute('data-al-noop', '');
			const actionRow = piece('-actions');
			actionRow.replaceChildren(alertButton('Undo', false, 'data-al-reorder-undo'), viewLink);
			actionRow.firstChild.focus();
			alerts.timer(box, CONFIRM_SECONDS);
		};

		const onClick = {
			'data-al-reorder-go': (hit) => {
				if (hit.classList.contains('is-busy')) return;
				hit.classList.add('is-busy');
				hit.setAttribute('aria-disabled', 'true');
				hit.textContent = 'Placing order';
				orderTimer = setTimeout(showPlaced, ORDER_DELAY_MS);
			},
			'data-al-reorder-undo': () => {
				alerts.stop(alertBox());
				showLowStock(true);
			},
			'data-al-reorder-later': () => {
				closeReason = 'We will remind you tomorrow at 9:00 am.';
				alerts.dismiss(alertBox());
			},
			'data-al-reorder-reset': () => {
				clearTimeout(orderTimer);
				showLowStock(true);
			},
			'data-basalt-alert-close': () => {
				closeReason = 'Alert dismissed.';
			},
			'data-al-noop': (hit, event) => event.preventDefault(),
		};

		card.addEventListener('click', (event) => {
			const hit = event.target.closest('button, a');
			if (!hit) return;
			const hook = Object.keys(onClick).find((attr) => hit.hasAttribute(attr));
			if (hook) onClick[hook](hit, event);
		});
		card.addEventListener('basalt:alert-closed', (event) => {
			if (event.target !== alertBox()) return;
			piece('-note').textContent = closeReason || 'The confirmation closed by itself.';
			piece('-gone').hidden = false;
			piece('-reset').focus();
			closeReason = '';
		});

		return () => {
			putBack();
			clearTimeout(orderTimer);
			closeReason = '';
		};
	}

	/* Import demo: a progress alert whose bar and row count move together,
     with a spoken update at each quarter, then a finished or canceled
     state. */

	function setUpImport() {
		const card = pick('[data-al-progress]');
		if (!card) return null;
		let ticker = 0;
		const stopTicking = () => {
			clearInterval(ticker);
			ticker = 0;
		};
		const putBack = rememberMarkup(card, stopTicking);
		const piece = (hook) => pick(`[data-al-progress-${hook}]`, card);

		const paintAlert = (tone, icon, title, text) => {
			retone(piece('alert'), tone);
			piece('icon').className = `bi bi-${icon}`;
			piece('title').textContent = title;
			piece('text').textContent = text;
		};
		const swapAction = (text, ghost, hook) => {
			const button = alertButton(text, ghost, hook);
			pick('.basalt-alert-actions', card).replaceChildren(button);
			return button;
		};
		const showRows = (rows) => {
			const percent = Math.round((rows / IMPORT_ROWS) * 100);
			piece('bar').setAttribute('aria-valuenow', String(percent));
			pick('[data-al-progress-bar] span', card).style.setProperty('--basalt-alert-progress', `${percent}%`);
			piece('rows').textContent = `${rows} of ${IMPORT_ROWS} rows`;
			piece('pct').textContent = `${percent}%`;
		};

		const finish = () => {
			stopTicking();
			paintAlert(
				'success',
				'check2-circle',
				'480 products imported',
				'3 rows had no price, so they were saved as drafts.',
			);
			piece('say').textContent = '';
			const focusWasInside = card.contains(document.activeElement);
			const again = swapAction('Import again', true, 'data-al-progress-go');
			if (focusWasInside) again.focus();
		};

		const begin = () => {
			paintAlert('primary', 'cloud-arrow-up', 'Importing products', 'autumn-range.csv, 480 products');
			const announced = new Set();
			let rows = 0;
			showRows(0);
			swapAction('Cancel', true, 'data-al-progress-stop').focus();
			clearInterval(ticker);
			ticker = setInterval(() => {
				rows = Math.min(IMPORT_ROWS, rows + 6 + Math.floor(Math.random() * 10));
				showRows(rows);
				const quarter = Math.floor((rows / IMPORT_ROWS) * 4) * 25;
				if (quarter && quarter < 100 && !announced.has(quarter)) {
					announced.add(quarter);
					piece('say').textContent = `${quarter} percent imported`;
				}
				if (rows >= IMPORT_ROWS) finish();
			}, IMPORT_TICK_MS);
		};

		const cancelImport = () => {
			stopTicking();
			const rowsRead = parseInt(piece('rows').textContent.trim(), 10) || 0;
			paintAlert(
				'warning',
				'pause-circle',
				'Import canceled',
				`${rowsRead} rows were read. Nothing was published.`,
			);
			swapAction('Start again', false, 'data-al-progress-go').focus();
		};

		card.addEventListener('click', (event) => {
			const hit = event.target.closest('button');
			if (!hit) return;
			if (hit.hasAttribute('data-al-progress-go')) begin();
			else if (hit.hasAttribute('data-al-progress-stop')) cancelImport();
		});

		return putBack;
	}

	/* Error summary demo: saving a broken form lists each problem as a link
     to its field, and the list shrinks as the fields are fixed. */

	function setUpErrorSummary() {
		const productForm = pick('[data-al-summary]');
		if (!productForm) return null;
		const summary = pick('[data-al-summary-box]', productForm);
		const problems = pick('[data-al-summary-list]', productForm);
		const heading = pick('[data-al-summary-title]', productForm);
		const savedNote = pick('[data-al-summary-ok]', productForm);
		const ruled = pickAll('[data-al-rule]', productForm);
		let submitted = false;

		const isWrong = (fieldNode) => {
			const entered = fieldNode.value.trim();
			if (fieldNode.getAttribute('data-al-rule') !== 'price') return !entered;
			return !PRICE_PATTERN.test(entered) || parseFloat(entered) <= 0;
		};

		/** Flags one field and fills or empties its message; true when wrong. */
		const flag = (fieldNode) => {
			const wrong = isWrong(fieldNode);
			fieldNode.classList.toggle('is-invalid', wrong);
			fieldNode.setAttribute('aria-invalid', String(wrong));
			const errorLine = document.getElementById(fieldNode.getAttribute('aria-describedby'));
			if (errorLine) errorLine.textContent = wrong ? fieldNode.getAttribute('data-al-msg') : '';
			return wrong;
		};

		const listProblems = () => {
			const wrongOnes = ruled.filter(flag);
			problems.replaceChildren(
				...wrongOnes.map((fieldNode) => {
					const jump = Object.assign(document.createElement('a'), {
						href: `#${fieldNode.id}`,
						textContent: fieldNode.getAttribute('data-al-msg'),
					});
					const listItem = document.createElement('li');
					listItem.appendChild(jump);
					return listItem;
				}),
			);
			heading.textContent = `Fix ${countOf(wrongOnes.length, 'thing', 'things')} before saving`;
			summary.hidden = !wrongOnes.length;
			return wrongOnes;
		};

		productForm.addEventListener('submit', (event) => {
			event.preventDefault();
			submitted = true;
			if (listProblems().length) {
				savedNote.hidden = true;
				summary.focus();
				return;
			}
			const productName = pick('#al-f-name').value.trim();
			const priceText = parseFloat(pick('#al-f-price').value).toFixed(2);
			pick('[data-al-summary-ok-text]', productForm).textContent =
				`${productName} is live in the shop at $${priceText}, under ${pick('#al-f-weight').value}.`;
			savedNote.hidden = false;
		});
		productForm.addEventListener('input', (event) => {
			if (submitted && event.target.matches('[data-al-rule]')) listProblems();
		});
		productForm.addEventListener('change', (event) => {
			if (submitted && event.target.matches('select[data-al-rule]')) listProblems();
		});
		productForm.addEventListener('reset', () => {
			submitted = false;
			/* The browser clears the values after this event; tidy up after it. */
			setTimeout(() => {
				for (const fieldNode of ruled) {
					fieldNode.classList.remove('is-invalid');
					fieldNode.removeAttribute('aria-invalid');
				}
				problems.replaceChildren();
				summary.hidden = true;
				savedNote.hidden = true;
			});
		});
		problems.addEventListener('click', (event) => {
			const jump = event.target.closest('a');
			if (!jump) return;
			event.preventDefault();
			document.getElementById(jump.getAttribute('href').slice(1))?.focus();
		});

		return () => productForm.reset();
	}

	/* Expandable demo: the toggle's words follow Bootstrap's collapse. */

	function setUpExpand() {
		const rows = document.getElementById('al-exp-more');
		if (!rows) return null;
		const toggleText = pick('[data-al-more-label]');
		rows.addEventListener('show.bs.collapse', () => {
			toggleText.textContent = 'Hide the orders';
		});
		rows.addEventListener('hide.bs.collapse', () => {
			toggleText.textContent = 'Show the orders';
		});

		return () => {
			if (window.bootstrap && rows.classList.contains('show'))
				window.bootstrap.Collapse.getOrCreateInstance(rows, { toggle: false }).hide();
		};
	}

	/* Banner demo: closing the strip leaves a note with a way to bring it
     back, and the demo's "#" links go nowhere. */

	function setUpBanner() {
		const miniPage = pick('[data-al-banner-frame]');
		if (!miniPage) return null;
		const putBack = rememberMarkup(miniPage, () => alerts.refresh(miniPage));

		miniPage.addEventListener('basalt:banner-closed', () =>
			revealAndFocus(pick('[data-al-banner-gone]', miniPage)),
		);
		miniPage.addEventListener('click', (event) => {
			if (event.target.closest('[data-al-banner-reset]')) {
				pick('[data-al-banner-gone]', miniPage).hidden = true;
				const strip = pick('[data-basalt-banner]', miniPage);
				strip.hidden = false;
				pick('[data-basalt-banner-next]', strip).focus();
				return;
			}
			const bannerLink = event.target.closest('.basalt-banner a');
			if (bannerLink?.getAttribute('href') === '#') event.preventDefault();
		});

		return putBack;
	}

	/* Notice group demo: once every notice is cleared, a button refolds the
     group with all of them back. */

	function setUpGroup() {
		const firstGroup = pick('[data-basalt-alert-group]');
		if (!firstGroup) return null;
		const groupHost = firstGroup.parentElement;
		const putBack = rememberMarkup(groupHost, () => alerts.refresh(groupHost));

		groupHost.addEventListener('click', (event) => {
			if (!event.target.closest('[data-al-group-reset]')) return;
			const liveGroup = pick('[data-basalt-alert-group]', groupHost);
			liveGroup.classList.remove('is-open');
			for (const notice of pickAll('.basalt-alert-group-list > *', liveGroup)) notice.hidden = false;
			alerts.refresh(groupHost);
			pick('[data-basalt-alert-group-toggle]', liveGroup)?.focus();
		});

		return putBack;
	}

	/* Bootstrap dismissal demo. Bootstrap removes an alert before firing
     closed.bs.alert, so the event never reaches this wrapper; watching
     its children does. Focus moves to the next close button, or to the
     note once both alerts are gone. */

	function setUpDismissible() {
		const dismissStack = pick('[data-al-dismiss]');
		if (!dismissStack) return null;
		const savedMarkup = dismissStack.innerHTML;
		const lostAnAlert = (changes) =>
			changes.some((change) => [...change.removedNodes].some((node) => node.classList?.contains('alert')));

		new MutationObserver((changes) => {
			if (!lostAnAlert(changes)) return;
			if (pickAll('.alert', dismissStack).length) {
				pick('.alert .btn-close', dismissStack)?.focus();
				return;
			}
			revealAndFocus(pick('[data-al-dismiss-gone]', dismissStack));
		}).observe(dismissStack, { childList: true });

		dismissStack.addEventListener('click', (event) => {
			if (!event.target.closest('[data-al-restore]')) return;
			dismissStack.innerHTML = savedMarkup;
			pick('.btn-close', dismissStack)?.focus();
		});

		return () => {
			dismissStack.innerHTML = savedMarkup;
		};
	}

	start();
})();
