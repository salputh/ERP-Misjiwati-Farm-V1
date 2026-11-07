/**
 * Drives the dialog catalog on modals.html: the kind filter over the
 * cards, copying a snippet, the small notice in the corner and what each
 * sample dialog does once it is used. How the dialogs themselves work
 * (window.Basalt.dialog, the command palette, the [data-basalt-*] types)
 * is basalt.js's business; this file only plays them out.
 */
(() => {
	'use strict';

	const root = pick('[data-md-root]');
	if (!root || !window.bootstrap) return;

	const {
		busy: toggleBusy,
		done: markDone,
		clearDone: unmarkDone,
		flagFields: flagInvalid,
		clearFlags: unflagAll,
	} = window.Basalt.dialog;

	const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const notice = {
		box: pick('[data-md-flash-box]', root),
		line: pick('[data-md-flash-text]', root),
		timer: 0,
	};
	const copyResets = new WeakMap();

	/* Headings and notes for the size ruler, keyed by its data-md-size value. */
	const SIZE_COPY = {
		sm: { title: 'Small dialog', note: '300px wide. Enough for a yes or no.' },
		'': { title: 'Default dialog', note: '500px wide. Right for a short form or a question.' },
		lg: { title: 'Large dialog', note: '800px wide. Room for two columns or a small table.' },
		xl: { title: 'Extra large dialog', note: '1140px wide. For wide tables and side-by-side comparisons.' },
	};

	/* The width each full-screen breakpoint stops at, in words. */
	const FULLSCREEN_REACH = {
		'': 'always',
		'sm-down': 'below 576px',
		'md-down': 'below 768px',
		'lg-down': 'below 992px',
		'xl-down': 'below 1200px',
		'xxl-down': 'below 1400px',
	};

	/** Wires every demo in the order the cards appear. */
	function start() {
		mountKindFilter();
		mountSnippetCopy();
		document.addEventListener('click', onNoticeTrigger);
		mountCommandDemos();
		mountStepsDialog();
		mountHoldDialog();
		mountTypedDialog();
		mountDiscountForm();
		mountBannerEditor();
		mountProductEditor();
		mountSizeRuler();
		mountFullscreenPicker();
		mountMessageDialog();
		for (const dialog of pickAll('.md-dialogs .modal')) {
			dialog.addEventListener('hidden.bs.modal', () => restoreDialog(dialog));
		}
	}

	/* Small shared helpers. */

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function counted(amount, singular, plural) {
		return `${amount} ${amount === 1 ? singular : plural}`;
	}

	/** Picks the short delay when the visitor asked for less motion. */
	function pause(quick, normal) {
		return motion.matches ? quick : normal;
	}

	function hideDialogOf(node) {
		bootstrap.Modal.getOrCreateInstance(node.closest('.modal')).hide();
	}

	/**
	 * Shows a button as working for a moment, then lets it go and runs `then`,
	 * standing in for a request to a server.
	 */
	function pretendWork(button, normal, then) {
		toggleBusy(button, true);
		setTimeout(
			() => {
				toggleBusy(button, false);
				then();
			},
			pause(200, normal),
		);
	}

	/* The kind filter above the grid. */

	function mountKindFilter() {
		const grid = pick('[data-md-grid]', root);
		if (!grid) return;
		const tally = pick('[data-md-count]', root);
		const cards = pickAll('.md-card', grid);
		const chips = pickAll('[data-md-filter]', root);

		function showKind(kind) {
			const visible = cards.filter((card) => {
				const kinds = (card.getAttribute('data-md-groups') || '').split(/\s+/);
				const match = kind === 'all' || kinds.includes(kind);
				card.classList.toggle('is-hidden', !match);
				card.classList.remove('is-alone');
				return match;
			});
			pairHalves(visible);
			if (tally) tally.textContent = counted(visible.length, 'dialog type', 'dialog types');
		}

		for (const chip of chips) {
			chip.addEventListener('click', () => {
				for (const other of chips) other.setAttribute('aria-pressed', String(other === chip));
				showKind(chip.getAttribute('data-md-filter'));
			});
		}
		showKind('all');
	}

	/**
	 * Half-width cards sit two to a row between the full-width ones. A card
	 * left without a partner when its run ends gets the row to itself.
	 */
	function pairHalves(cards) {
		let waiting = null;
		for (const card of cards) {
			if (card.classList.contains('md-card-full')) {
				waiting?.classList.add('is-alone');
				waiting = null;
			} else {
				waiting = waiting ? null : card;
			}
		}
		waiting?.classList.add('is-alone');
	}

	/* Copy buttons on the code snippets. */

	function mountSnippetCopy() {
		for (const button of pickAll('[data-md-copy]', root)) {
			button.addEventListener('click', () => {
				const source = pick('pre', button.parentElement);
				if (source) window.Basalt.copyText(source.textContent.trim()).then(() => confirmCopy(button));
			});
		}
	}

	function confirmCopy(button) {
		const glyph = pick('.bi', button);
		setCopyLabel(button, glyph, ' Copied', 'bi bi-check2');
		clearTimeout(copyResets.get(button));
		copyResets.set(
			button,
			setTimeout(() => setCopyLabel(button, glyph, ' Copy', 'bi bi-clipboard'), 1800),
		);
	}

	function setCopyLabel(button, glyph, words, glyphClass) {
		button.lastChild.textContent = words;
		if (glyph) glyph.className = glyphClass;
	}

	/* The one-line notice that confirms what a demo dialog just did. */

	function onNoticeTrigger(event) {
		const trigger = event.target.closest('[data-md-flash]');
		if (trigger) announce(trigger.getAttribute('data-md-flash'));
	}

	function announce(message) {
		if (!notice.box) return;
		notice.line.textContent = message;
		notice.box.hidden = false;
		clearTimeout(notice.timer);
		notice.timer = setTimeout(() => {
			notice.box.hidden = true;
		}, 2600);
	}

	/* The command palette, inline on the card and inside a dialog. */

	function mountCommandDemos() {
		const report = pick('[data-md-cmd-result]', root);

		document.addEventListener('basalt:command', (event) => {
			const { label } = event.detail;
			if (report) {
				const name = document.createElement('strong');
				name.textContent = label;
				report.textContent = 'Ran: ';
				report.append(name);
			}
			const host = event.target.closest('.modal');
			if (!host) return;
			bootstrap.Modal.getOrCreateInstance(host).hide();
			announce(`Opened ${label}`);
		});

		for (const sample of pickAll('[data-md-try]', root)) {
			sample.addEventListener('click', () => {
				const palette = pick('.md-cmd-live [data-basalt-command]', root);
				palette?.basaltCommand?.search(sample.getAttribute('data-md-try'));
			});
		}
	}

	/* Confirmation dialogs: the stepped plan change, hold-to-confirm and typed. */

	function mountStepsDialog() {
		const wizard = pick('#md-steps [data-basalt-dialog-steps]');
		if (!wizard) return;
		wizard.addEventListener('basalt:steps-done', () => {
			pretendWork(pick('[data-basalt-step-finish]', wizard), 900, () => {
				const { plan, seats, billing } = wizard.elements;
				const seatText = seats.options[seats.selectedIndex].text;
				markDone(wizard, `${plan.value} starts today for ${seatText}, billed ${billing.value.toLowerCase()}.`);
			});
		});
	}

	function mountHoldDialog() {
		const holdButton = pick('[data-md-hold]');
		holdButton?.addEventListener('basalt:confirm', () => {
			setTimeout(() => markDone(holdButton.closest('.modal-content')), pause(0, 250));
		});
	}

	function mountTypedDialog() {
		const action = pick('#md-typed [data-basalt-type-confirm-action]');
		action?.addEventListener('click', () => {
			pretendWork(action, 800, () => markDone(action.closest('.modal-content')));
		});
	}

	/* Form dialogs: the discount code, the banner editor and the product page. */

	function mountDiscountForm() {
		const sheet = pick('#md-form [data-basalt-modal-form]');
		if (!sheet) return;
		const codeField = pick('#md-form-code', sheet);

		sheet.addEventListener('submit', (event) => {
			event.preventDefault();
			const firstBad = flagInvalid(pickAll('input, textarea, select', sheet));
			if (firstBad) {
				firstBad.focus();
				return;
			}
			pick('.basalt-modal-guard', sheet).hidden = true;
			pretendWork(pick('button[type="submit"]', sheet), 1100, () => {
				const code = codeField.value.toUpperCase();
				markDone(
					sheet,
					`${code} takes ${sheet.elements.off.value}% off. Customers can use it at checkout now.`,
				);
			});
		});
	}

	function mountBannerEditor() {
		const editor = pick('[data-md-banner]');
		if (!editor) return;
		const message = pick('[data-md-banner-text]', editor);
		const preview = pick('[data-md-banner-out]', editor);
		const length = pick('[data-md-banner-count]', editor);

		function chosen(group, fallback) {
			return pick(`input[name="${group}"]:checked`, editor)?.value || fallback;
		}

		function render() {
			const glyph = document.createElement('i');
			const words = document.createElement('span');
			glyph.className = `bi ${chosen('mdBannerIcon', 'bi-truck')}`;
			words.textContent = message.value.trim() || 'Your message here';
			preview.className = `md-banner md-banner-${chosen('mdBannerStyle', 'calm')}`;
			preview.replaceChildren(glyph, words);
			length.textContent = `${message.value.length} of ${message.maxLength} characters`;
		}

		for (const type of ['input', 'change']) editor.addEventListener(type, render);
		editor.addEventListener('submit', (event) => {
			event.preventDefault();
			hideDialogOf(editor);
			announce('Banner saved');
		});
		editor.closest('.modal').addEventListener('hidden.bs.modal', () => {
			editor.reset();
			render();
		});
		render();
	}

	function mountProductEditor() {
		const editor = pick('[data-md-full]');
		if (!editor) return;
		const body = pick('[data-md-full-desc]', editor);
		const stats = pick('[data-md-full-count]', editor);
		const badge = pick('[data-md-full-status]', editor);
		const badgeText = pick('span', badge);
		let settle = 0;

		function measure() {
			const wordTotal = body.value.trim().split(/\s+/).filter(Boolean).length;
			stats.textContent = `${counted(wordTotal, 'word', 'words')} · ${body.value.length} characters`;
		}

		function markSaved() {
			badge.classList.remove('is-saving');
			badgeText.textContent = 'All changes saved';
		}

		editor.addEventListener('input', () => {
			measure();
			badge.classList.add('is-saving');
			badgeText.textContent = 'Saving…';
			clearTimeout(settle);
			settle = setTimeout(markSaved, 900);
		});
		editor.addEventListener('submit', (event) => {
			event.preventDefault();
			hideDialogOf(editor);
			const title = pick('#md-full-name', editor).value.trim();
			announce(`${title || 'Product'} published`);
		});
		measure();
	}

	/* Layout dialogs whose shell is reshaped by the button that opened them. */

	function triggerValue(event, attribute) {
		return event.relatedTarget?.getAttribute(attribute) || '';
	}

	function mountSizeRuler() {
		const dialog = document.getElementById('md-size');
		dialog?.addEventListener('show.bs.modal', (event) => {
			const size = triggerValue(event, 'data-md-size');
			const { title, note } = SIZE_COPY[size];
			pick('.modal-dialog', dialog).className = size ? `modal-dialog modal-${size}` : 'modal-dialog';
			pick('.modal-title', dialog).textContent = title;
			pick('[data-md-size-text]', dialog).textContent = note;
		});
	}

	function mountFullscreenPicker() {
		const dialog = document.getElementById('md-fs');
		dialog?.addEventListener('show.bs.modal', (event) => {
			const breakpoint = triggerValue(event, 'data-md-fs');
			const modifier = breakpoint ? `modal-fullscreen-${breakpoint}` : 'modal-fullscreen';
			const explainer = pick('[data-md-fs-text]', dialog);
			const tag = document.createElement('code');
			tag.textContent = `.${modifier}`;

			pick('.modal-dialog', dialog).className = `modal-dialog ${modifier}`;
			pick('.modal-title', dialog).textContent = `Full screen, ${FULLSCREEN_REACH[breakpoint]}`;
			explainer.textContent = 'This dialog uses ';
			explainer.append(
				tag,
				breakpoint
					? '. Wider than that, it is a normal centered box.'
					: ', so it fills the window at every width.',
			);
		});
	}

	/* One message dialog, addressed to whichever person card opened it. */

	function mountMessageDialog() {
		const dialog = document.getElementById('md-vary');
		if (!dialog) return;
		const composer = pick('[data-md-vary]', dialog);
		let recipient = '';

		dialog.addEventListener('show.bs.modal', ({ relatedTarget: card }) => {
			if (!card) return;
			recipient = card.getAttribute('data-bs-whatever');
			pick('.modal-title', dialog).textContent = `Message ${recipient}`;
			pick('[data-md-vary-role]', dialog).textContent =
				`${card.getAttribute('data-md-role')}. Usually replies within the hour.`;
		});
		dialog.addEventListener('shown.bs.modal', () => pick('textarea', dialog).focus());
		composer.addEventListener('submit', (event) => {
			event.preventDefault();
			bootstrap.Modal.getOrCreateInstance(dialog).hide();
			announce(`Message sent to ${recipient}`);
		});
		dialog.addEventListener('hidden.bs.modal', () => composer.reset());
	}

	/**
	 * Returns a closed dialog to how it first looked: no success panel, no
	 * spinning buttons, holds and wizards rewound, forms emptied and unflagged.
	 */
	function restoreDialog(dialog) {
		const panel = pick('.modal-content', dialog);
		if (!panel) return;
		unmarkDone(panel);
		for (const spinning of pickAll('.is-busy', dialog)) toggleBusy(spinning, false);
		for (const hold of pickAll('.basalt-hold', dialog)) {
			hold.classList.remove('is-done');
			hold.style.removeProperty('--basalt-hold');
		}
		panel.basaltSteps?.reset();
		for (const typed of pickAll('[data-basalt-type-confirm]', dialog)) typed.basaltTyped?.reset();
		if (!panel.hasAttribute('data-basalt-modal-form')) return;
		panel.reset();
		unflagAll(panel);
	}

	start();

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}
})();
