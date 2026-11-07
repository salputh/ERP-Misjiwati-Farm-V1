/**
 * Drives text-editor.html, the page of eight writing fields: a toolbar
 * editor beside its shop preview, @-mentions with saved replies, a
 * floating toolbar, Markdown, merge fields, a capped textarea, a required
 * editor and a version compare. No libraries are involved; the rich fields
 * rely on document.execCommand, which current browsers still carry out.
 */
(() => {
	'use strict';

	const page = pick('[data-fe-root]', document);
	if (!page) return;

	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* Every rich field registers here, so one selectionchange listener can
     keep each toolbar in step with the caret. */
	const richFields = [];

	/* Cleaned HTML keeps only these tags; the second set goes along with
     everything inside it. Anything else is unwrapped down to its text. */
	const ALLOWED_TAGS = new Set([
		'P',
		'H3',
		'H4',
		'STRONG',
		'B',
		'EM',
		'I',
		'U',
		'S',
		'STRIKE',
		'UL',
		'OL',
		'LI',
		'BLOCKQUOTE',
		'A',
		'BR',
		'MARK',
		'CODE',
	]);
	const DISCARDED_TAGS = new Set([
		'SCRIPT',
		'STYLE',
		'IFRAME',
		'OBJECT',
		'EMBED',
		'LINK',
		'META',
		'TEMPLATE',
		'svg',
		'SVG',
		'IMG',
		'VIDEO',
		'AUDIO',
		'FORM',
		'INPUT',
		'BUTTON',
		'TEXTAREA',
		'SELECT',
	]);
	const RETAGGED = { H1: 'h3', H2: 'h3', DIV: 'p', H5: 'p', H6: 'p' };
	const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	const EMOJI_CHOICES = [
		['🧵', 'Thread'],
		['✂️', 'Scissors'],
		['👠', 'Heels'],
		['🕶️', 'Sunglasses'],
		['🧥', 'Coat'],
		['🌱', 'Seedling'],
		['🏠', 'House'],
		['📅', 'Calendar'],
		['🔥', 'Fire'],
		['❄️', 'Snowflake'],
		['⭐', 'Star'],
		['✅', 'Check mark'],
		['📦', 'Parcel'],
		['📮', 'Postbox'],
		['📍', 'Pin'],
		['👌', 'OK hand'],
		['🙌', 'Raised hands'],
		['❤️', 'Heart'],
	];

	const TEAMMATES = [
		{ name: 'Elaine Loy', role: 'Fulfillment lead', tone: 1 },
		{ name: 'Todd Roach', role: 'Customer support', tone: 2 },
		{ name: 'Lindsay Kinney', role: 'Account manager', tone: 3 },
		{ name: 'Jonah Weiss', role: 'Warehouse', tone: 4 },
		{ name: 'Ellie Roe', role: 'Gift wrapping', tone: 5 },
	];

	const SAVED_REPLIES = [
		{
			key: 'delay',
			text: 'This order is waiting on the shield sunglasses restock, due Thursday. Please hold it until then.',
		},
		{ key: 'po', text: "Please add the customer's PO number to the invoice before it ships." },
		{ key: 'fragile', text: 'Silk inside. Use the tissue and the rigid gift boxes.' },
		{ key: 'split', text: 'Ship what is in stock today and send the rest when it lands, no extra shipping.' },
	];

	const VISIT_CHECKLIST = [
		'## Home care visit, first week',
		'',
		'The standard first visit for a new client and their family. Plan on about *45 minutes* and add notes to the visit before you close it in **Fieldline**.',
		'',
		'### Bring with you',
		'',
		'- Gloves, an apron and the care folder',
		'- A blood pressure cuff, target under `140/90`',
		"- The client's care plan number",
		'',
		'### Checklist',
		'',
		'1. Check the key safe and sign in on the visit form.',
		'2. Go through the medication chart for the week ahead.',
		'3. Take a blood pressure reading and record it.',
		'4. Test the smoke alarm with the client or family present.',
		'',
		"> Reading over 160? Book a follow-up visit and call the office, don't wait.",
		'',
		'Questions? [Ask the office](mailto:office@example.com) or read the [full procedure](https://example.com/procedures/first-visit).',
	].join('\n');

	const RECIPIENTS = [
		{
			name: 'Hope Nugent',
			email: 'hope.nugent@example.com',
			first_name: 'Hope',
			plan: 'Pet Care',
			visit: 'nail trim and brush',
			next_visit: daysFromNow(8),
			amount: 'covered by your plan',
		},
		{
			name: 'Lance Monroe',
			email: 'lance.monroe@example.com',
			first_name: 'Lance',
			plan: 'Pet Care Plus',
			visit: 'full groom and a bath',
			next_visit: daysFromNow(11),
			amount: 'covered by your plan',
		},
		{
			name: 'Courtney Whitfield',
			email: 'courtney.w@example.com',
			first_name: 'Courtney',
			plan: 'Puppy Club',
			visit: 'puppy training session at home',
			next_visit: daysFromNow(14),
			amount: '$95.00',
		},
	];
	const FIELD_LABELS = {
		first_name: 'First name',
		plan: 'Plan',
		visit: 'Visit type',
		next_visit: 'Next visit',
		amount: 'Amount',
	};

	const ON_MY_WAY_TEXT =
		"Hi Robyn, it's Dev from Lakeside Apparel. I'm on my way and should be with you around 2:15. If the side gate is locked, I'll call from the driveway. Thanks!";

	const WORD_MINIMUM = 25;

	/* Each version is the returns policy, one string per paragraph. A
     restore appends a copy, so the list grows while the page is open. */
	const POLICY_VERSIONS = [
		[
			'You can return unworn pieces within 14 days of delivery for a refund.',
			"Pieces that have been worn can't be returned. If a seam comes loose, email us and we'll take a look.",
			'Return shipping is paid by the customer.',
		],
		[
			'You can return unworn pieces within 14 days of delivery for a full refund to your original payment method.',
			"Pieces that have been worn can't be returned. If a seam comes loose, email us and we'll send a replacement.",
			'Return shipping is paid by the customer, except for Insider members.',
		],
		[
			'You can return unworn pieces within 30 days of delivery for a full refund to your original payment method.',
			"Pieces that have been worn can't be returned, but if one comes apart in the first year, email us and we'll repair it or send a new one.",
			'Return shipping is paid by the customer, except for Insider members.',
		],
		[
			'You can return unworn pieces and accessories within 30 days of delivery for a full refund to your original payment method.',
			"Pieces that have been worn can't be returned, but if one comes apart in the first year, email us and we'll repair it or send a new one.",
			'We send a prepaid label for faulty pieces. Other return shipping is paid by the customer, except for Insider members.',
		],
	];

	const ROVING_KEYS = {
		ArrowRight: (at, total) => (at + 1) % total,
		ArrowLeft: (at, total) => (at - 1 + total) % total,
		Home: () => 0,
		End: (at, total) => total - 1,
	};

	/** Wires every field on the page, in the order the cards were built. */
	function start() {
		try {
			document.execCommand('defaultParagraphSeparator', false, 'p');
		} catch {
			/* Older engines do not know this command; their default is fine. */
		}

		/* A mouse press on a tool would otherwise move focus and drop the
       selection the tool is meant to act on. */
		page.addEventListener('mousedown', (event) => {
			if (event.target.closest('.fe-tool:not(.dropdown-toggle), .fe-emoji button, .fe-suggest-opt'))
				event.preventDefault();
		});

		for (const label of pickAll('[data-fe-focus]', page)) {
			label.addEventListener('click', () => {
				const field = document.getElementById(label.getAttribute('data-fe-focus'));
				if (field) caretToEnd(field);
			});
		}

		for (const bar of pickAll('[role="toolbar"]', page)) makeRoving(bar);

		document.addEventListener('selectionchange', () => {
			for (const field of richFields) {
				if (document.activeElement !== field.surface) continue;
				field.keepRange();
				field.reflect();
			}
		});

		mountProductEditor();
		mountMentions();
		mountFloatingToolbar();
		mountMarkdown();
		mountMergeTemplate();
		mountCharacterLimit();
		mountRequiredEditor();
		mountVersionHistory();
		mountFilterChips();
	}

	/* Lookups, text and small DOM helpers shared by every card. */

	function pick(selector, scope) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return String(value).replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
	}

	function wordCount(text) {
		const trimmed = text.trim();
		return trimmed ? trimmed.split(/\s+/).length : 0;
	}

	/** "1 word", "3 words": a count followed by its noun, plural past one. */
	function counted(amount, noun) {
		return `${amount} ${amount === 1 ? noun : `${noun}s`}`;
	}

	function timeNow() {
		return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
	}

	function daysFromNow(days) {
		const date = new Date();
		date.setDate(date.getDate() + days);
		return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
	}

	/**
	 * Creates an element, assigns the given DOM properties and sets the
	 * entries of `attributes` as plain attributes.
	 */
	function element(tag, { attributes = {}, ...properties } = {}) {
		const node = Object.assign(document.createElement(tag), properties);
		for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
		return node;
	}

	function caretToEnd(field) {
		field.focus();
		const span = document.createRange();
		span.selectNodeContents(field);
		span.collapse(false);
		selectOnly(span);
	}

	function selectOnly(range) {
		const selection = window.getSelection();
		selection.removeAllRanges();
		selection.addRange(range);
	}

	/**
	 * Puts a token where the range is, follows it with a no-break space and
	 * leaves the caret after that space, so typing carries on outside it.
	 */
	function insertToken(range, token) {
		const gap = document.createTextNode('\u00a0');
		range.insertNode(gap);
		range.insertNode(token);
		const caret = document.createRange();
		caret.setStart(gap, 1);
		caret.collapse(true);
		selectOnly(caret);
	}

	/** The link the selection starts in, if there is one. */
	function linkAtCaret(selection) {
		return selection.anchorNode?.parentElement?.closest('a');
	}

	/**
	 * One Tab stop per toolbar; the arrow keys, Home and End walk the rest.
	 * basalt.js swaps the text style select for a button and keeps the
	 * original hidden, so that select never takes a turn.
	 */
	function makeRoving(bar) {
		for (const [position, control] of stops().entries()) {
			control.setAttribute('tabindex', position === 0 ? '0' : '-1');
		}

		bar.addEventListener('focusin', (event) => {
			const controls = stops();
			if (!controls.includes(event.target)) return;
			for (const control of controls) control.setAttribute('tabindex', control === event.target ? '0' : '-1');
		});

		bar.addEventListener('keydown', (event) => {
			if (event.defaultPrevented) return;
			const step = ROVING_KEYS[event.key];
			if (!step) return;
			const usable = stops().filter((control) => !control.disabled);
			const at = usable.indexOf(document.activeElement);
			if (at < 0) return;
			const jumpsToEnd = event.key === 'Home' || event.key === 'End';
			if (jumpsToEnd && document.activeElement.tagName === 'SELECT') return;
			event.preventDefault();
			usable[step(at, usable.length)].focus();
		});

		function stops() {
			return pickAll('button, select', bar).filter(
				(control) => !control.closest('.dropdown-menu') && !control.classList.contains('basalt-select-native'),
			);
		}
	}

	/* Cleaning HTML that arrives by paste, from the source view or from the
     starting markup. */

	function isSafeHref(href) {
		return /^(https?:\/\/|mailto:|\/|#)/i.test((href || '').trim());
	}

	function sanitize(markup) {
		const holder = document.createElement('template');
		holder.innerHTML = markup;
		sanitizeTree(holder.content);
		const box = document.createElement('div');
		box.appendChild(holder.content);
		return box.innerHTML.trim();
	}

	function sanitizeTree(parent) {
		const listLike = parent.nodeType === 11 || /^(UL|OL)$/.test(parent.nodeName);

		for (const node of [...parent.childNodes]) {
			if (node.nodeType === 3) {
				if (listLike && !node.data.trim()) node.remove();
				continue;
			}
			if (node.nodeType !== 1 || DISCARDED_TAGS.has(node.nodeName)) {
				node.remove();
				continue;
			}

			sanitizeTree(node);

			if (ALLOWED_TAGS.has(node.nodeName)) {
				for (const { name, value } of [...node.attributes]) {
					const keptHref = node.nodeName === 'A' && name === 'href' && isSafeHref(value);
					if (!keptHref) node.removeAttribute(name);
				}
				continue;
			}

			/* H1 and H2 become the editor's heading and DIVs its paragraphs;
         any other tag is dropped and its children stay in place. */
			const replacement = RETAGGED[node.nodeName];
			if (!replacement) {
				node.replaceWith(...node.childNodes);
				continue;
			}
			const swapped = document.createElement(replacement);
			while (node.firstChild) swapped.appendChild(node.firstChild);
			node.replaceWith(swapped);
		}
	}

	/** Breaks the cleaned HTML into one block per line for the source view. */
	function indentBlocks(markup) {
		return markup
			.replace(/(<\/(p|h3|h4|ul|ol|blockquote)>|<\/li>)/g, '$1\n')
			.replace(/(<(ul|ol)>)/g, '$1\n')
			.replace(/<li>/g, '  <li>')
			.trim();
	}

	/* The shared rich field: toolbar commands, link panel, emoji grid,
     source view and full screen, used by three of the cards. */

	/**
	 * Wires one rich field and hands back what other cards need from it.
	 * @param {HTMLElement} frame  the .fe-editor wrapper
	 * @param {{ onChange?: Function }} [options]
	 * @returns {{ surface: HTMLElement, keepRange: Function, restoreRange: Function, reflect: Function }}
	 */
	function mountRichField(frame, { onChange = () => {} } = {}) {
		const surface = pick('.fe-editor-body', frame);
		const bar = pick('.fe-toolbar', frame);
		const styleSelect = pick('[data-fe-block]', bar);
		const linkToggle = pick('[data-fe-link]', bar);
		const linkPanel = pick('[data-fe-linkform]', frame);
		const emojiToggle = pick('[data-fe-emoji]', bar);
		const emojiGrid = pick('[data-fe-emojis]', frame);
		const sourceToggle = pick('[data-fe-source]', bar);
		const sourceBox = pick('[data-fe-sourcebox]', frame);
		const fullToggle = pick('[data-fe-full]', bar);
		const popoverClosers = [];
		let lastRange = null;
		let closeLinkPanel = null;

		surface.addEventListener('input', () => {
			keepRange();
			onChange();
		});
		/* Once a key or the pointer lets go, store the caret and then sync the toolbar. */
		for (const settled of ['keyup', 'mouseup']) {
			surface.addEventListener(settled, keepRange);
			surface.addEventListener(settled, reflect);
		}
		surface.addEventListener('focus', reflect);
		surface.addEventListener('paste', pasteClean);

		for (const button of pickAll('[data-fe-cmd]', bar)) {
			button.addEventListener('click', () => run(button.getAttribute('data-fe-cmd')));
		}
		styleSelect?.addEventListener('change', () => run('formatBlock', styleSelect.value));

		if (linkToggle && linkPanel) wireLinkPanel();
		if (emojiToggle && emojiGrid) wireEmojiGrid();

		document.addEventListener('click', (event) => {
			if (!linkPanel || linkPanel.hidden || linkPanel.contains(event.target) || linkToggle.contains(event.target))
				return;
			closeLinkPanel();
		});

		if (sourceToggle && sourceBox) wireSourceView();
		if (fullToggle) wireFullScreen();

		const field = { surface, keepRange, restoreRange, reflect };
		richFields.push(field);
		return field;

		function keepRange() {
			const selection = window.getSelection();
			if (selection.rangeCount && surface.contains(selection.anchorNode))
				lastRange = selection.getRangeAt(0).cloneRange();
		}

		function restoreRange() {
			surface.focus();
			if (lastRange && surface.contains(lastRange.startContainer)) selectOnly(lastRange);
		}

		function run(command, value) {
			restoreRange();
			try {
				document.execCommand(command, false, value || null);
			} catch {
				/* An unsupported command simply does nothing. */
			}
			keepRange();
			reflect();
			onChange();
		}

		/* Pressed buttons, the style select and the link button follow the
       formatting under the caret. */
		function reflect() {
			const selection = window.getSelection();
			if (!selection.rangeCount || !surface.contains(selection.anchorNode)) return;

			for (const button of pickAll('[data-fe-cmd]', bar)) {
				if (button.hasAttribute('aria-pressed'))
					button.setAttribute('aria-pressed', String(commandIsOn(button.getAttribute('data-fe-cmd'))));
			}

			if (styleSelect) {
				const block = currentBlock();
				styleSelect.value = ['h3', 'h4', 'blockquote'].includes(block) ? block : 'p';
			}
			linkToggle?.classList.toggle('is-on', Boolean(selection.anchorNode.parentElement?.closest('a')));
		}

		/* Pasted content goes in as cleaned HTML, so styling from other sites
       stays behind. */
		function pasteClean(event) {
			const clipboard = event.clipboardData;
			if (!clipboard) return;
			event.preventDefault();
			const markup = clipboard.getData('text/html');
			if (markup) document.execCommand('insertHTML', false, sanitize(markup));
			else document.execCommand('insertText', false, clipboard.getData('text/plain'));
		}

		function closePopovers() {
			for (const close of popoverClosers) close();
		}

		function wireLinkPanel() {
			const address = pick('input', linkPanel);
			const problem = pick('.fe-error', linkPanel);
			closeLinkPanel = () => hideLinkPanel();
			popoverClosers.push(closeLinkPanel);

			linkToggle.addEventListener('click', () => {
				if (linkPanel.hidden) showLinkPanel();
				else hideLinkPanel('button');
			});

			surface.addEventListener('keydown', (event) => {
				if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
				event.preventDefault();
				showLinkPanel();
			});

			linkPanel.addEventListener('submit', (event) => {
				event.preventDefault();
				let target = address.value.trim();
				if (!target) {
					flagAddress('Enter the address to link to.');
					address.focus();
					return;
				}
				if (/^www\./i.test(target)) target = `https://${target}`;
				if (!isSafeHref(target) || /^https?:\/\/?$/i.test(target)) {
					flagAddress('Start the address with https://, mailto: or a slash.');
					address.focus();
					return;
				}
				hideLinkPanel('text');
				const selection = window.getSelection();
				if (!selection.isCollapsed) {
					document.execCommand('createLink', false, target);
				} else {
					const existing = linkAtCaret(selection);
					if (existing && surface.contains(existing)) {
						existing.setAttribute('href', target);
						onChange();
						return;
					}
					document.execCommand(
						'insertHTML',
						false,
						`<a href="${htmlSafe(target)}">${htmlSafe(target.replace(/^mailto:/, ''))}</a>`,
					);
				}
				keepRange();
				onChange();
			});

			pick('[data-fe-unlink]', linkPanel).addEventListener('click', () => {
				hideLinkPanel('text');
				const selection = window.getSelection();
				const existing = linkAtCaret(selection);
				if (selection.isCollapsed && existing && surface.contains(existing)) {
					const whole = document.createRange();
					whole.selectNodeContents(existing);
					selectOnly(whole);
				}
				document.execCommand('unlink');
				onChange();
			});

			linkPanel.addEventListener('keydown', (event) => {
				if (event.key !== 'Escape') return;
				event.preventDefault();
				hideLinkPanel('button');
			});
			address.addEventListener('input', () => {
				if (!problem.hidden) flagAddress('');
			});

			function showLinkPanel() {
				keepRange();
				closePopovers();
				const existing = linkAtCaret(window.getSelection());
				address.value = existing && surface.contains(existing) ? existing.getAttribute('href') : '';
				flagAddress('');
				linkPanel.hidden = false;
				linkPanel.style.top = `${bar.offsetHeight + 6}px`;
				linkToggle.setAttribute('aria-expanded', 'true');
				address.focus();
			}

			/** Hides the panel and sends focus back to the button or the text. */
			function hideLinkPanel(returnTo) {
				linkPanel.hidden = true;
				linkToggle.setAttribute('aria-expanded', 'false');
				if (returnTo === 'button') linkToggle.focus();
				else if (returnTo === 'text') restoreRange();
			}

			function flagAddress(message) {
				problem.textContent = message;
				problem.hidden = !message;
				address.setAttribute('aria-invalid', message ? 'true' : 'false');
				address.classList.toggle('is-invalid', Boolean(message));
			}
		}

		function wireEmojiGrid() {
			for (const [glyph, label] of EMOJI_CHOICES) {
				const choice = element('button', {
					type: 'button',
					textContent: glyph,
					attributes: { 'aria-label': label },
				});
				choice.addEventListener('click', () => {
					hideEmojiGrid(false);
					restoreRange();
					document.execCommand('insertText', false, glyph);
					keepRange();
					onChange();
				});
				emojiGrid.appendChild(choice);
			}

			const choices = pickAll('button', emojiGrid);
			const GRID_MOVES = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 6, ArrowUp: -6 };
			popoverClosers.push(() => hideEmojiGrid(false));

			emojiToggle.addEventListener('click', () => {
				if (emojiGrid.hidden) showEmojiGrid();
				else hideEmojiGrid(true);
			});

			emojiGrid.addEventListener('keydown', (event) => {
				if (event.key === 'Escape' || event.key === 'Tab') {
					event.preventDefault();
					hideEmojiGrid(true);
					return;
				}
				const move = GRID_MOVES[event.key];
				const at = choices.indexOf(document.activeElement);
				if (!move || at < 0) return;
				event.preventDefault();
				choices[(at + move + choices.length) % choices.length].focus();
			});

			document.addEventListener('click', (event) => {
				if (emojiGrid.hidden || emojiGrid.contains(event.target) || emojiToggle.contains(event.target)) return;
				hideEmojiGrid(false);
			});

			function showEmojiGrid() {
				keepRange();
				closePopovers();
				emojiGrid.hidden = false;
				emojiGrid.style.top = `${bar.offsetHeight + 6}px`;
				emojiToggle.setAttribute('aria-expanded', 'true');
				const rightLimit = frame.clientWidth - emojiGrid.offsetWidth - 8;
				emojiGrid.style.left = `${Math.max(8, Math.min(emojiToggle.offsetLeft, rightLimit))}px`;
				choices[0].focus();
			}

			function hideEmojiGrid(refocus) {
				emojiGrid.hidden = true;
				emojiToggle.setAttribute('aria-expanded', 'false');
				if (refocus) emojiToggle.focus();
			}
		}

		/* While the HTML is on show only the view buttons stay usable. */
		function wireSourceView() {
			sourceToggle.addEventListener('click', () => {
				const showSource = sourceBox.hidden;
				closePopovers();
				if (showSource) {
					sourceBox.value = indentBlocks(sanitize(surface.innerHTML));
					sourceBox.style.height = `${Math.max(surface.offsetHeight, 240)}px`;
				} else {
					surface.innerHTML = sanitize(sourceBox.value);
					onChange();
				}
				sourceBox.hidden = !showSource;
				surface.hidden = showSource;
				sourceToggle.setAttribute('aria-pressed', String(showSource));

				for (const control of pickAll('button, select', bar)) {
					if (control === sourceToggle || control.hasAttribute('data-fe-full')) continue;
					control.disabled = showSource;
				}

				(showSource ? sourceBox : surface).focus();
			});

			sourceBox.addEventListener('input', () => {
				surface.innerHTML = sanitize(sourceBox.value);
				onChange();
			});
		}

		function wireFullScreen() {
			fullToggle.addEventListener('click', () => setFull(!frame.classList.contains('is-full')));

			/* Esc leaves full screen only once no popover is left to close. */
			frame.addEventListener('keydown', (event) => {
				if (event.key !== 'Escape' || !frame.classList.contains('is-full')) return;
				if (linkPanel?.hidden === false || emojiGrid?.hidden === false) return;
				setFull(false);
				fullToggle.focus();
			});

			function setFull(on) {
				frame.classList.toggle('is-full', on);
				fullToggle.setAttribute('aria-pressed', String(on));
				fullToggle.setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen');
				document.documentElement.style.overflow = on ? 'hidden' : '';
			}
		}
	}

	function commandIsOn(command) {
		try {
			return document.queryCommandState(command);
		} catch {
			return false;
		}
	}

	function currentBlock() {
		try {
			return String(document.queryCommandValue('formatBlock') || '').toLowerCase();
		} catch {
			return '';
		}
	}

	/* Card: the product description with its live shop preview. */

	function mountProductEditor() {
		const frame = pick('[data-fe-rich="product"]', page);
		if (!frame) return;

		const surface = pick('.fe-editor-body', frame);
		const preview = pick('[data-fe-preview]', page);
		const readouts = {
			words: pick('[data-fe-words]', frame),
			characters: pick('[data-fe-chars]', frame),
			reading: pick('[data-fe-read]', frame),
		};
		const status = pick('[data-fe-status]', frame);
		const stateText = pick('[data-fe-status-text]', frame);
		const discardButton = pick('[data-fe-discard]', frame);

		surface.innerHTML = sanitize(surface.innerHTML);
		let savedMarkup = surface.innerHTML;

		mountRichField(frame, { onChange: refreshSummary });
		refreshSummary();

		pick('[data-fe-save]', frame).addEventListener('click', () => {
			surface.innerHTML = sanitize(surface.innerHTML);
			savedMarkup = surface.innerHTML;
			refreshSummary();
			stateText.textContent = `Saved at ${timeNow()}`;
		});

		discardButton.addEventListener('click', () => {
			surface.innerHTML = savedMarkup;
			const source = pick('[data-fe-sourcebox]', frame);
			if (source && !source.hidden) source.value = indentBlocks(savedMarkup);
			refreshSummary();
			stateText.textContent = 'Changes discarded';
			surface.focus();
		});

		/* Counts, reading time, the preview and the unsaved flag, after every
       change to the description. */
		function refreshSummary() {
			const markup = sanitize(surface.innerHTML);
			preview.innerHTML = markup || '<p>No description yet.</p>';

			const plain = surface.innerText || '';
			const words = wordCount(plain);
			const minutes = Math.round(words / 200);
			readouts.words.textContent = counted(words, 'word');
			readouts.characters.textContent = counted(plain.replace(/\n/g, '').length, 'character');
			readouts.reading.textContent =
				minutes < 1 ? 'Under a minute to read' : `About ${counted(minutes, 'minute')} to read`;

			const unsaved = markup !== sanitize(savedMarkup);
			status.classList.toggle('is-dirty', unsaved);
			if (unsaved) stateText.textContent = 'Unsaved changes';
			discardButton.hidden = !unsaved;
		}
	}

	/* Card: order notes with @-mentions and /saved replies. */

	function mountMentions() {
		const composer = pick('[data-fe-mentions]', page);
		if (!composer) return;

		const surface = pick('.fe-compose-body', composer);
		const box = pick('.fe-compose-box', composer);
		const listbox = pick('.fe-suggest', composer);
		const notice = pick('[data-fe-notify]', composer);
		const thread = pick('[data-fe-thread]', composer.closest('.fe-card'));

		/* While suggestions are open this holds the trigger character, the text
       node and offsets being replaced, the matches and the lit option. */
		let picker = null;

		surface.addEventListener('input', () => {
			followTrigger();
			describeRecipients();
		});
		surface.addEventListener('keydown', (event) => {
			if (picker && handlePickerKey(event)) return;
			if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
				event.preventDefault();
				postNote();
			}
		});
		surface.addEventListener('blur', () =>
			setTimeout(() => {
				if (document.activeElement !== surface) hideSuggestions();
			}, 120),
		);
		surface.addEventListener('click', followTrigger);
		pick('[data-fe-post]', composer).addEventListener('click', postNote);

		function followTrigger() {
			const trigger = triggerAtCaret();
			if (trigger) showSuggestions(trigger);
			else hideSuggestions();
		}

		/** The @ or / word the caret is in, with where it starts and ends. */
		function triggerAtCaret() {
			const selection = window.getSelection();
			if (!selection.rangeCount || !selection.isCollapsed) return null;
			const node = selection.anchorNode;
			if (!node || node.nodeType !== 3 || !surface.contains(node)) return null;
			const match = /(?:^|[\s\u00a0])([@/])([^\s\u00a0@/]{0,24})$/.exec(
				node.data.slice(0, selection.anchorOffset),
			);
			if (!match) return null;
			const [, kind, query] = match;
			return { kind, query, node, start: selection.anchorOffset - query.length - 1, end: selection.anchorOffset };
		}

		function showSuggestions(trigger) {
			const query = trigger.query.toLowerCase();
			const items =
				trigger.kind === '@'
					? TEAMMATES.filter(({ name }) => {
							const lower = name.toLowerCase();
							return lower.split(' ').some((part) => part.startsWith(query)) || lower.startsWith(query);
						})
					: SAVED_REPLIES.filter(({ key }) => key.startsWith(query));
			const sameKind = picker?.kind === trigger.kind;
			const active = sameKind ? Math.min(picker.active, Math.max(0, items.length - 1)) : 0;
			picker = Object.assign(trigger, { items, active });
			drawSuggestions();
			listbox.hidden = false;

			const caret = caretBox();
			const frame = box.getBoundingClientRect();
			Object.assign(listbox.style, {
				left: `${Math.max(8, Math.min(caret.left - frame.left - 8, frame.width - listbox.offsetWidth - 8))}px`,
				top: `${caret.bottom - frame.top + 6}px`,
			});
		}

		function hideSuggestions() {
			picker = null;
			listbox.hidden = true;
			surface.removeAttribute('aria-activedescendant');
		}

		function drawSuggestions() {
			listbox.innerHTML = '';
			const { kind, items, active } = picker;

			if (!items.length) {
				listbox.appendChild(
					element('li', {
						className: 'fe-suggest-empty',
						textContent: kind === '@' ? 'No one by that name' : 'No saved reply by that name',
						attributes: { role: 'presentation' },
					}),
				);
				surface.removeAttribute('aria-activedescendant');
				return;
			}

			for (const [index, item] of items.entries()) {
				const option = element('li', {
					id: `fe-note-opt-${index}`,
					className: `fe-suggest-opt${index === active ? ' is-active' : ''}`,
					innerHTML: kind === '@' ? personOption(item) : replyOption(item),
					attributes: { role: 'option', 'aria-selected': String(index === active) },
				});
				option.addEventListener('click', () => insertSuggestion(index));
				listbox.appendChild(option);
			}
			surface.setAttribute('aria-activedescendant', `fe-note-opt-${active}`);
		}

		/** Arrow keys, Enter, Tab and Esc while the list is open; true if used. */
		function handlePickerKey(event) {
			const total = picker.items.length;
			const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];

			if (total && step) {
				event.preventDefault();
				picker.active = (picker.active + step + total) % total;
				drawSuggestions();
				return true;
			}
			if (total && (event.key === 'Enter' || event.key === 'Tab')) {
				event.preventDefault();
				insertSuggestion(picker.active);
				return true;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				hideSuggestions();
				return true;
			}
			return false;
		}

		function insertSuggestion(index) {
			const item = picker?.items[index];
			if (!item) return;

			const typed = document.createRange();
			typed.setStart(picker.node, picker.start);
			typed.setEnd(picker.node, picker.end);
			typed.deleteContents();

			insertToken(typed, picker.kind === '@' ? mentionPill(item.name) : document.createTextNode(item.text));
			hideSuggestions();
			surface.focus();
			describeRecipients();
		}

		function mentionedNames() {
			return [...new Set(pickAll('.fe-mention', surface).map((mention) => mention.getAttribute('data-person')))];
		}

		function describeRecipients() {
			const names = mentionedNames();
			notice.innerHTML = names.length ? `Emails ${boldList(names)} when you post` : 'No one mentioned yet';
		}

		function postNote() {
			const written = surface.innerText.replace(/\u00a0/g, ' ').trim();
			if (!written) {
				notice.textContent = 'Write something first, then post.';
				surface.focus();
				return;
			}

			const names = mentionedNames();
			const note = document.createElement('li');
			note.className = `fe-note${calmMotion ? '' : ' is-new'}`;
			note.innerHTML =
				'<span class="fe-avatar fe-avatar-3" aria-hidden="true">JA</span><div class="fe-note-main"><p class="fe-note-meta"><strong>John Armstrong</strong><span>Just now</span></p><p class="fe-note-text"></p></div>';
			copyNoteContent(surface, pick('.fe-note-text', note));
			thread.appendChild(note);

			surface.innerHTML = '';
			hideSuggestions();
			notice.innerHTML = `Posted.${names.length ? ` Emailed ${boldList(names)}.` : ''}`;
			surface.focus();
		}
	}

	function personOption({ name, role, tone }) {
		const initials = name
			.split(' ')
			.map((part) => part[0])
			.join('')
			.slice(0, 2);
		return `<span class="fe-avatar fe-avatar-sm fe-avatar-${tone}" aria-hidden="true">${initials}</span><span><span class="fe-suggest-name">${htmlSafe(name)}</span><span class="fe-suggest-sub">${htmlSafe(role)}</span></span>`;
	}

	function replyOption({ key, text }) {
		return `<span class="fe-suggest-slash" aria-hidden="true">/</span><span><span class="fe-suggest-name">/${htmlSafe(key)}</span><span class="fe-suggest-sub">${htmlSafe(text)}</span></span>`;
	}

	/** A mention the caret steps over whole instead of entering. */
	function mentionPill(name) {
		return element('span', {
			className: 'fe-mention',
			contentEditable: 'false',
			textContent: `@${name}`,
			attributes: { 'data-person': name },
		});
	}

	function boldList(names) {
		return names.map((name) => `<strong>${htmlSafe(name)}</strong>`).join(', ');
	}

	/** Where the caret sits on screen; an empty line needs a probe to measure. */
	function caretBox() {
		const span = window.getSelection().getRangeAt(0).cloneRange();
		const measured = span.getClientRects()[0];
		if (measured) return measured;
		const probe = document.createElement('span');
		probe.textContent = '\u200b';
		span.insertNode(probe);
		const box = probe.getBoundingClientRect();
		probe.remove();
		return box;
	}

	/**
	 * Copies a draft note into the thread as text, line breaks and mention
	 * pills only; every other tag is flattened away.
	 */
	function copyNoteContent(source, target) {
		for (const node of source.childNodes) {
			if (node.nodeType === 3) {
				target.appendChild(document.createTextNode(node.data));
				continue;
			}
			if (node.nodeType !== 1) continue;

			if (node.classList.contains('fe-mention')) {
				target.appendChild(element('span', { className: 'fe-mention', textContent: node.textContent }));
			} else if (node.nodeName === 'BR') {
				target.appendChild(document.createElement('br'));
			} else {
				if (/^(DIV|P)$/.test(node.nodeName) && target.lastChild)
					target.appendChild(document.createElement('br'));
				copyNoteContent(node, target);
			}
		}
	}

	/* Card: inline notes with a toolbar that follows the selection. */

	function mountFloatingToolbar() {
		const holder = pick('[data-fe-bubble]', page);
		if (!holder) return;

		const surface = pick('.fe-bubble-body', holder);
		const bar = pick('.fe-bubble-bar', holder);
		const tools = pickAll('.fe-tool', bar);
		let chosen = null;

		const toolActions = {
			mark: () => toggleHighlight(surface),
			h3: (tool) =>
				document.execCommand('formatBlock', false, tool.getAttribute('aria-pressed') === 'true' ? 'p' : 'h3'),
			removeFormat: () => {
				document.execCommand('removeFormat');
				const selection = window.getSelection();
				if (selection.rangeCount && isHighlighted(selection.getRangeAt(0))) toggleHighlight(surface);
			},
		};

		document.addEventListener('selectionchange', positionBar);
		window.addEventListener('resize', () => {
			if (!bar.hidden) positionBar();
		});

		for (const tool of tools) {
			tool.addEventListener('click', () => {
				const command = tool.getAttribute('data-fe-bcmd');
				const viaKeyboard = document.activeElement === tool;
				reselect();
				(toolActions[command] || (() => document.execCommand(command)))(tool);
				const selection = window.getSelection();
				if (selection.rangeCount) chosen = selection.getRangeAt(0).cloneRange();
				reflectTools();
				if (viaKeyboard) tool.focus();
			});
		}

		surface.addEventListener('keydown', (event) => {
			if (!event.altKey || event.key !== 'F10' || bar.hidden) return;
			event.preventDefault();
			(tools.find((tool) => tool.getAttribute('tabindex') === '0') || tools[0]).focus();
		});
		bar.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			reselect();
		});
		bar.addEventListener('focusout', () =>
			setTimeout(() => {
				if (!bar.contains(document.activeElement) && document.activeElement !== surface) bar.hidden = true;
			}, 0),
		);

		function inside(node) {
			return node && surface.contains(node);
		}

		/* Shows the bar centered over a selection made inside the notes. */
		function positionBar() {
			const selection = window.getSelection();
			const selectedHere =
				selection.rangeCount &&
				!selection.isCollapsed &&
				inside(selection.anchorNode) &&
				inside(selection.focusNode);
			if (!selectedHere) {
				if (!bar.contains(document.activeElement)) bar.hidden = true;
				return;
			}
			chosen = selection.getRangeAt(0).cloneRange();
			const picked = chosen.getBoundingClientRect();
			const frame = holder.getBoundingClientRect();
			bar.hidden = false;
			const halfWidth = bar.offsetWidth / 2;
			const center = picked.left + picked.width / 2 - frame.left;
			Object.assign(bar.style, {
				left: `${Math.max(halfWidth + 4, Math.min(center, frame.width - halfWidth - 4))}px`,
				top: `${Math.max(picked.top - frame.top, bar.offsetHeight + 6)}px`,
			});
			reflectTools();
		}

		function reflectTools() {
			if (!chosen) return;
			const pressed = {
				bold: document.queryCommandState('bold'),
				italic: document.queryCommandState('italic'),
				mark: isHighlighted(chosen),
				h3: Boolean(chosen.startContainer.parentElement?.closest('h3')),
			};
			for (const tool of tools) {
				if (tool.hasAttribute('aria-pressed'))
					tool.setAttribute('aria-pressed', String(Boolean(pressed[tool.getAttribute('data-fe-bcmd')])));
			}
		}

		function reselect() {
			surface.focus();
			if (chosen) selectOnly(chosen);
		}
	}

	function textNodesIn(range) {
		const top = range.commonAncestorContainer;
		if (top.nodeType === 3) return [top];
		const found = [];
		const walker = document.createTreeWalker(top, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			if (range.intersectsNode(node) && node.data.length) found.push(node);
		}
		return found;
	}

	function isHighlighted(range) {
		const visible = textNodesIn(range).filter((node) => node.data.trim());
		return visible.length > 0 && visible.every((node) => node.parentElement.closest('mark'));
	}

	/**
	 * Wraps each selected stretch of text in <mark>, or unwraps the marks when
	 * the whole selection is highlighted already. Hand-rolled because
	 * execCommand has no highlight of its own.
	 */
	function toggleHighlight(surface) {
		const selection = window.getSelection();
		const range = selection.getRangeAt(0);

		if (isHighlighted(range)) {
			const marks = new Set(
				textNodesIn(range)
					.map((node) => node.parentElement.closest('mark'))
					.filter(Boolean),
			);
			for (const mark of marks) mark.replaceWith(...mark.childNodes);
			surface.normalize();
			return;
		}

		const { startContainer, startOffset, endContainer, endOffset } = range;
		const wrapped = [];
		for (const node of textNodesIn(range)) {
			if (node.parentElement.closest('mark')) continue;
			const from = node === startContainer ? startOffset : 0;
			const to = node === endContainer ? endOffset : node.length;
			if (from >= to) continue;
			let piece = node;
			if (to < piece.length) piece.splitText(to);
			if (from > 0) piece = piece.splitText(from);
			const mark = document.createElement('mark');
			piece.replaceWith(mark);
			mark.appendChild(piece);
			wrapped.push(mark);
		}
		if (!wrapped.length) return;

		const across = document.createRange();
		across.setStartBefore(wrapped[0]);
		across.setEndAfter(wrapped[wrapped.length - 1]);
		selectOnly(across);
	}

	/* Card: Markdown with a live preview, toolbar inserts and copy buttons. */

	function mountMarkdown() {
		const holder = pick('[data-fe-md]', page);
		if (!holder) return;

		const source = pick('.fe-md-text', holder);
		const output = pick('[data-fe-md-out]', holder);
		const stats = pick('[data-fe-md-stats]', holder);
		const copyNote = pick('[data-fe-md-copied]', holder);
		let copyNoteTimer = 0;

		const actions = {
			h: () =>
				rewriteLines((line) =>
					/^##\s/.test(line) ? line.replace(/^##\s+/, '') : `## ${line.replace(/^#+\s*/, '')}`,
				),
			b: () => surround('**', '**', 'bold text'),
			i: () => surround('*', '*', 'italic text'),
			code: () => surround('`', '`', 'code'),
			link: () => {
				const start = source.selectionStart;
				const label = source.value.slice(start, source.selectionEnd) || 'link text';
				replaceSelection(`[${label}](https://)`, start + label.length + 3, start + label.length + 11);
			},
			ul: () => rewriteLines((line) => (/^\s*[-*]\s/.test(line) ? line.replace(/^\s*[-*]\s+/, '') : `- ${line}`)),
			ol: () =>
				rewriteLines((line, index) =>
					/^\s*\d+[.)]\s/.test(line) ? line.replace(/^\s*\d+[.)]\s+/, '') : `${index + 1}. ${line}`,
				),
			quote: () => rewriteLines((line) => (/^>\s?/.test(line) ? line.replace(/^>\s?/, '') : `> ${line}`)),
		};

		source.value = VISIT_CHECKLIST;
		source.addEventListener('input', refreshPreview);
		refreshPreview();

		for (const button of pickAll('[data-fe-md-cmd]', holder)) {
			button.addEventListener('click', () => actions[button.getAttribute('data-fe-md-cmd')]());
		}

		source.addEventListener('keydown', (event) => {
			if (!(event.ctrlKey || event.metaKey)) return;
			const key = event.key.toLowerCase();
			if (key !== 'b' && key !== 'i') return;
			event.preventDefault();
			actions[key]();
		});

		wirePressedGroup(pickAll('[data-fe-md-view]', holder), (button) => {
			holder.setAttribute('data-view', button.getAttribute('data-fe-md-view'));
		});

		for (const button of pickAll('[data-fe-md-copy]', holder)) {
			button.addEventListener('click', async () => {
				const asHtml = button.getAttribute('data-fe-md-copy') === 'html';
				try {
					await clipCopy(asHtml ? markdownToHtml(source.value) : source.value);
					copyNote.textContent = asHtml ? 'HTML copied' : 'Markdown copied';
				} catch {
					copyNote.textContent = 'Copy blocked by the browser';
				}
				clearTimeout(copyNoteTimer);
				copyNoteTimer = setTimeout(() => {
					copyNote.textContent = '';
				}, 2400);
			});
		}

		function refreshPreview() {
			const value = source.value;
			output.innerHTML = markdownToHtml(value) || '<p>Nothing written yet.</p>';
			const words = wordCount(value.replace(/[#>*_`\-[\]()]/g, ' '));
			const lines = value ? value.split('\n').length : 0;
			const reading =
				words < 200 ? 'under a minute to read' : `about ${counted(Math.round(words / 200), 'minute')} to read`;
			stats.textContent = `${counted(words, 'word')} · ${counted(lines, 'line')} · ${reading}`;
		}

		/* Typing through execCommand keeps the browser's own undo history; the
       fallback edits the value directly. */
		function replaceSelection(text, selectFrom, selectTo) {
			source.focus();
			if (!document.execCommand('insertText', false, text)) {
				source.setRangeText(text, source.selectionStart, source.selectionEnd, 'end');
				refreshPreview();
			}
			if (selectFrom != null) source.setSelectionRange(selectFrom, selectTo);
		}

		function surround(before, after, placeholder) {
			const { selectionStart: start, selectionEnd: end } = source;
			const inner = source.value.slice(start, end) || placeholder;
			replaceSelection(before + inner + after, start + before.length, start + before.length + inner.length);
		}

		/** Applies a per-line change to every line the selection touches. */
		function rewriteLines(change) {
			const value = source.value;
			const start = value.lastIndexOf('\n', source.selectionStart - 1) + 1;
			const stop = value.indexOf('\n', source.selectionEnd);
			const end = stop < 0 ? value.length : stop;
			const block = value
				.slice(start, end)
				.split('\n')
				.map((line, index) => change(line, index))
				.join('\n');
			source.setSelectionRange(start, end);
			replaceSelection(block, start, start + block.length);
		}
	}

	/**
	 * Turns the small Markdown subset the card supports into HTML: headings,
	 * rules, quotes, both list kinds and paragraphs. The source is escaped
	 * before any tag is added.
	 */
	function markdownToHtml(markdown) {
		const html = [];
		let paragraph = [];
		let quote = [];
		let listTag = null;

		for (const rawLine of htmlSafe(markdown).split('\n')) {
			const line = rawLine.trimEnd();

			if (!line.trim()) {
				closeEverything();
				continue;
			}

			const heading = /^(#{1,3})\s+(.*)$/.exec(line);
			if (heading) {
				closeEverything();
				const level = heading[1].length + 1;
				html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
				continue;
			}

			if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
				closeEverything();
				html.push('<hr>');
				continue;
			}

			const quoted = /^&gt;\s?(.*)$/.exec(line);
			if (quoted) {
				closeParagraph();
				closeList();
				quote.push(quoted[1]);
				continue;
			}

			const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
			const numbered = bullet ? null : /^\s*\d+[.)]\s+(.*)$/.exec(line);
			if (bullet || numbered) {
				closeParagraph();
				closeQuote();
				openList(bullet ? 'ul' : 'ol');
				html.push(`<li>${inlineMarkdown((bullet || numbered)[1])}</li>`);
				continue;
			}

			closeList();
			closeQuote();
			paragraph.push(line.trim());
		}

		closeEverything();
		return html.join('\n');

		function openList(tag) {
			if (listTag === tag) return;
			closeList();
			html.push(`<${tag}>`);
			listTag = tag;
		}

		function closeParagraph() {
			if (!paragraph.length) return;
			html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
			paragraph = [];
		}

		function closeList() {
			if (!listTag) return;
			html.push(`</${listTag}>`);
			listTag = null;
		}

		function closeQuote() {
			if (!quote.length) return;
			html.push(`<blockquote><p>${inlineMarkdown(quote.join(' '))}</p></blockquote>`);
			quote = [];
		}

		function closeEverything() {
			for (const flush of [closeParagraph, closeList, closeQuote]) flush();
		}
	}

	/* Code spans are parked behind placeholders first, so nothing inside
     them is read as emphasis or a link. */
	function inlineMarkdown(line) {
		const parked = [];
		return (
			line
				.replace(/`([^`]+)`/g, (whole, code) => `\u0000${parked.push(code) - 1}\u0000`)
				.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label, address) => {
					const href = address.replace(/&amp;/g, '&');
					return isSafeHref(href) ? `<a href="${htmlSafe(href)}">${label}</a>` : label;
				})
				.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
				.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
				.replace(/(^|\W)_([^_\s][^_]*)_(?=\W|$)/g, '$1<em>$2</em>')
				// eslint-disable-next-line no-control-regex -- control characters mark text parked during the rewrite
				.replace(/\u0000(\d+)\u0000/g, (whole, slot) => `<code>${parked[+slot]}</code>`)
		);
	}

	function clipCopy(text) {
		if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
		return new Promise((resolve, reject) => {
			const scratch = element('textarea', { value: text, attributes: { readonly: '' } });
			Object.assign(scratch.style, { position: 'fixed', opacity: '0' });
			document.body.appendChild(scratch);
			scratch.select();
			const copied = document.execCommand('copy');
			scratch.remove();
			if (copied) resolve();
			else reject(new Error('copy'));
		});
	}

	/**
	 * A row of toggle buttons where exactly one is pressed; the callback runs
	 * with the button that was just chosen.
	 */
	function wirePressedGroup(buttons, onPick) {
		for (const button of buttons) {
			button.addEventListener('click', () => {
				for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
				onPick(button);
			});
		}
	}

	/* Card: an email template with merge-field tokens and a filled preview. */

	function mountMergeTemplate() {
		const holder = pick('[data-fe-merge]', page);
		if (!holder) return;

		const frame = pick('.fe-editor', holder);
		const surface = pick('.fe-editor-body', frame);
		const recipientSelect = pick('[data-fe-merge-who]', holder);
		const subject = pick('#fe-merge-subject', page);
		const mail = pick('[data-fe-merge-out]', holder);
		const field = mountRichField(frame);

		for (const item of pickAll('[data-fe-field]', holder)) {
			item.addEventListener('click', () => {
				const key = item.getAttribute('data-fe-field');
				field.restoreRange();
				const selection = window.getSelection();
				if (!selection.rangeCount || !surface.contains(selection.anchorNode)) caretToEnd(surface);
				const range = selection.getRangeAt(0);
				range.deleteContents();

				insertToken(
					range,
					element('span', {
						className: 'fe-field',
						contentEditable: 'false',
						textContent: FIELD_LABELS[key],
						attributes: { 'data-field': key },
					}),
				);
				field.keepRange();
			});
		}

		wirePressedGroup(pickAll('[data-fe-merge-view]', holder), (button) => {
			const view = button.getAttribute('data-fe-merge-view');
			const previewing = view === 'preview';
			holder.setAttribute('data-view', view);
			mail.hidden = !previewing;
			recipientSelect.disabled = !previewing;
			if (previewing) fillPreview();
		});

		recipientSelect.addEventListener('change', fillPreview);

		/* Swaps every token, in the subject and the body, for the chosen
       recipient's value. */
		function fillPreview() {
			const person = RECIPIENTS[+recipientSelect.value] || RECIPIENTS[0];

			pick('[data-fe-mail-to]', mail).textContent = `${person.name} <${person.email}>`;
			pick('[data-fe-mail-subject]', mail).textContent = subject.value.replace(/\{(\w+)\}/g, (whole, key) =>
				valueFor(person, key, whole),
			);

			const draft = document.createElement('div');
			draft.innerHTML = surface.innerHTML;
			for (const token of pickAll('[data-field]', draft)) {
				token.replaceWith(
					element('span', {
						className: 'fe-filled',
						textContent: valueFor(person, token.getAttribute('data-field'), token.textContent),
					}),
				);
			}

			const body = pick('[data-fe-mail-body]', mail);
			body.innerHTML = '';
			body.append(...draft.childNodes);
			if (!body.textContent.trim()) body.innerHTML = '<p>The message is empty.</p>';
		}
	}

	function valueFor(person, key, fallback) {
		return key in person ? person[key] : fallback;
	}

	/* Card: an on-my-way text with a hard character limit. */

	function mountCharacterLimit() {
		const form = pick('[data-fe-gift]', page);
		if (!form) return;

		const textarea = pick('.fe-limit-text', form);
		const mirror = pick('[data-fe-gift-mirror]', form);
		const frame = pick('.fe-limit', form);
		const ring = pick('[data-fe-ring]', form);
		const ringFill = pick('.fe-ring-fill', ring);
		const remaining = pick('[data-fe-gift-left]', form);
		const announcer = pick('[data-fe-gift-live]', form);
		const problem = pick('#fe-gift-error', page);
		const status = pick('[data-fe-gift-status]', form);
		const limit = parseInt(textarea.getAttribute('data-max'), 10) || 180;

		/* The band ("ok", "near", "over") last measured; screen readers hear
       about a change of band, never about each key. */
		let band = '';

		textarea.value = ON_MY_WAY_TEXT;
		textarea.addEventListener('input', measure);
		window.addEventListener('resize', measure);
		measure();

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const length = textarea.value.length;
			if (!textarea.value.trim().length) {
				flag('Write a short message for the customer.');
				textarea.focus();
				return;
			}
			if (length > limit) {
				flag(`Trim ${counted(length - limit, 'character')} so it fits in one text.`);
				textarea.focus();
				return;
			}
			flag('');
			status.textContent = `Message saved, ${counted(length, 'character')}`;
			status.classList.add('is-good');
		});

		function measure() {
			const value = textarea.value;
			const length = value.length;
			const over = length > limit;
			const near = !over && length >= limit * 0.9;

			mirror.innerHTML = `${htmlSafe(value.slice(0, limit))}${over ? `<mark>${htmlSafe(value.slice(limit))}</mark>` : ''}\n`;
			textarea.style.height = 'auto';
			textarea.style.height = `${textarea.scrollHeight}px`;
			ringFill.style.strokeDashoffset = String(100 - Math.min(100, (length / limit) * 100));

			for (const element of [ring, remaining]) {
				element.classList.toggle('is-near', near);
				element.classList.toggle('is-over', over);
			}
			frame.classList.toggle('is-over', over);
			remaining.textContent = over ? `${length - limit} over` : `${limit - length} left`;

			const nextBand = over ? 'over' : near ? 'near' : 'ok';
			if (band && nextBand !== band) {
				announcer.textContent = {
					over: `Over the limit by ${counted(length - limit, 'character')}`,
					near: `${counted(limit - length, 'character')} left`,
					ok: '',
				}[nextBand];
			}
			band = nextBand;

			if (!problem.hidden && !over && length) flag('');
			status.textContent = '';
			status.classList.remove('is-good');
		}

		function flag(message) {
			problem.textContent = message;
			problem.hidden = !message;
			textarea.setAttribute('aria-invalid', message ? 'true' : 'false');
		}
	}

	/* Card: a required rich field that needs a minimum number of words. */

	function mountRequiredEditor() {
		const form = pick('[data-fe-apply]', page);
		if (!form) return;

		const frame = pick('[data-fe-apply-editor]', form);
		const about = pick('#fe-apply-about', page);
		const goal = pick('[data-fe-apply-count]', form);
		const summary = pick('[data-fe-summary]', form);
		const success = pick('[data-fe-done]', form);

		/* Errors stay quiet until the first submit, then follow every edit. */
		let submittedOnce = false;

		mountRichField(frame, {
			onChange: () => {
				showGoal();
				if (submittedOnce) validate(false);
			},
		});
		showGoal();

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			submittedOnce = true;
			if (!validate(true)) {
				success.hidden = true;
				summary.focus();
				return;
			}
			pick('[data-fe-done-text]', success).textContent =
				`${counted(aboutWords(), 'word')}, minimum of ${WORD_MINIMUM} met.`;
			success.hidden = false;
			success.focus();
		});

		/* The reset runs first; the cleanup waits a tick so it has the last say. */
		form.addEventListener('reset', () => {
			setTimeout(() => {
				submittedOnce = false;
				about.innerHTML = '';
				showError('');
				summary.hidden = true;
				success.hidden = true;
				showGoal();
				caretToEnd(about);
			}, 0);
		});

		function aboutWords() {
			return wordCount(about.innerText || '');
		}

		function showGoal() {
			const words = aboutWords();
			const met = words >= WORD_MINIMUM;
			goal.textContent = met ? counted(words, 'word') : `${words} of ${WORD_MINIMUM} words`;
			goal.classList.toggle('is-met', met);
		}

		function showError(message) {
			const holder = document.getElementById(`${about.id}-error`);
			holder.textContent = message || '';
			holder.hidden = !message;
			about.setAttribute('aria-invalid', message ? 'true' : 'false');
			frame.classList.toggle('is-invalid', Boolean(message));
		}

		/**
		 * Checks the field and returns true when it passes. The summary is
		 * redrawn when asked for, or when it is already on screen.
		 */
		function validate(withSummary) {
			const words = aboutWords();
			let message = '';
			if (!words) message = 'Tell us about your business';
			else if (words < WORD_MINIMUM)
				message = `Tell us a bit more about your business, ${counted(WORD_MINIMUM - words, 'word')} to go`;
			showError(message);

			if (withSummary || !summary.hidden) {
				const list = pick('[data-fe-summary-list]', summary);
				list.innerHTML = '';
				if (message) list.appendChild(summaryEntry(message));
				summary.hidden = !message;
			}
			return !message;
		}

		function summaryEntry(message) {
			const entry = document.createElement('li');
			const jump = element('a', { href: `#${about.id}`, textContent: message });
			jump.addEventListener('click', (event) => {
				event.preventDefault();
				caretToEnd(about);
				about.scrollIntoView({ block: 'center', behavior: calmMotion ? 'auto' : 'smooth' });
			});
			entry.appendChild(jump);
			return entry;
		}
	}

	/* Card: saved versions of the returns policy with a word-level compare. */

	function mountVersionHistory() {
		const holder = pick('[data-fe-history]', page);
		if (!holder) return;

		const versionList = pick('.fe-history-versions', holder);
		const diffView = pick('[data-fe-diff]', holder);
		const summary = pick('[data-fe-diff-sum]', holder);
		const restoreButton = pick('[data-fe-restore]', holder);
		const restoreStatus = pick('[data-fe-restore-status]', holder);
		let mode = 'marked';
		let liveIndex = POLICY_VERSIONS.length - 1;

		versionList.addEventListener('change', () => {
			restoreStatus.textContent = '';
			restoreStatus.classList.remove('is-good');
			showVersion();
		});

		wirePressedGroup(pickAll('[data-fe-diff-view]', holder), (button) => {
			mode = button.getAttribute('data-fe-diff-view');
			showVersion();
		});

		/* A restore never rewrites history: the old text comes back as a new
       version at the top of the list. */
		restoreButton.addEventListener('click', () => {
			const picked = checkedVersion();
			const restoredName = versionName(picked);
			POLICY_VERSIONS.push(POLICY_VERSIONS[+picked.value].slice());
			liveIndex = POLICY_VERSIONS.length - 1;

			const choice = element('label', {
				className: 'basalt-choice',
				innerHTML: `<input type="radio" name="fe-version" value="${liveIndex}">Version ${POLICY_VERSIONS.length}<span class="basalt-choice-hint">Just now, John</span>`,
			});
			pick('legend', versionList).after(choice);
			const radio = pick('input', choice);
			radio.checked = true;
			showVersion();
			radio.focus();
			restoreStatus.textContent = `${restoredName} is live again, saved as version ${POLICY_VERSIONS.length}`;
			restoreStatus.classList.add('is-good');
		});

		showVersion();

		function checkedVersion() {
			return pick('input:checked', versionList);
		}

		function versionName(radio) {
			return radio.parentElement.firstChild.textContent.trim();
		}

		function showVersion() {
			const picked = checkedVersion();
			const index = +picked.value;
			const current = POLICY_VERSIONS[index];
			const previous = POLICY_VERSIONS[index - 1];
			const tally = { added: 0, removed: 0 };

			diffView.innerHTML = current
				.map((text, position) => {
					if (!previous || mode === 'clean') return `<p>${htmlSafe(text)}</p>`;
					return `<p>${wordDiff(previous[position] || '', text)
						.map((piece) => markPiece(piece, tally))
						.join('')}</p>`;
				})
				.join('');

			const name = versionName(picked);
			if (!previous)
				summary.innerHTML = `<span><b>${htmlSafe(name)}</b> is the first version, so there is nothing to compare.</span>`;
			else if (mode === 'clean')
				summary.innerHTML = `<span>Showing <b>${htmlSafe(name)}</b> as customers read it.</span>`;
			else
				summary.innerHTML = `<span><b>${counted(tally.added, 'word')}</b> added</span><span><b>${counted(tally.removed, 'word')}</b> removed</span><span>since the version before</span>`;

			restoreButton.hidden = index === liveIndex;
			restoreButton.textContent = `Restore ${name.toLowerCase()}`;
			if (!restoreStatus.classList.contains('is-good')) {
				restoreStatus.textContent =
					index === liveIndex ? 'Live on the store now' : `Version ${liveIndex + 1} is live`;
			}
		}
	}

	/** Renders one diff piece and adds its words to the running tally. */
	function markPiece({ kind, text }, tally) {
		if (kind === 'same') return htmlSafe(text);
		const words = wordCount(text);
		if (kind === 'ins') {
			tally.added += words;
			return `<ins>${htmlSafe(text)}</ins>`;
		}
		tally.removed += words;
		return `<del>${htmlSafe(text)}</del>`;
	}

	/**
	 * Compares two texts word by word (spaces count as words, so they are
	 * kept) through a longest-common-subsequence table, and returns runs of
	 * { kind: 'same' | 'ins' | 'del', text }.
	 */
	function wordDiff(before, after) {
		const left = before.split(/(\s+)/).filter(Boolean);
		const right = after.split(/(\s+)/).filter(Boolean);
		const shared = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));

		for (let a = left.length - 1; a >= 0; a -= 1) {
			for (let b = right.length - 1; b >= 0; b -= 1) {
				shared[a][b] =
					left[a] === right[b] ? shared[a + 1][b + 1] + 1 : Math.max(shared[a + 1][b], shared[a][b + 1]);
			}
		}

		const runs = [];

		let a = 0;
		let b = 0;
		while (a < left.length || b < right.length) {
			const bothLeft = a < left.length && b < right.length;
			if (bothLeft && left[a] === right[b]) {
				add('same', left[a]);
				a += 1;
				b += 1;
			} else if (b >= right.length || (bothLeft && shared[a + 1][b] >= shared[a][b + 1])) {
				add('del', left[a]);
				a += 1;
			} else {
				add('ins', right[b]);
				b += 1;
			}
		}
		return runs;

		function add(kind, text) {
			const last = runs[runs.length - 1];
			if (last?.kind === kind) last.text += text;
			else runs.push({ kind, text });
		}
	}

	/* The chips above the grid: each shows one kind of card, or all. */

	function mountFilterChips() {
		const grid = pick('[data-fe-grid]', page);
		const cards = pickAll('.fe-card', grid);
		const tally = pick('[data-fe-count]', page);

		wirePressedGroup(pickAll('[data-fe-filter]', page), (chip) => {
			const kind = chip.getAttribute('data-fe-filter');
			let visible = 0;
			for (const card of cards) {
				const shown = kind === 'all' || card.getAttribute('data-fe-kind') === kind;
				card.classList.toggle('is-hidden', !shown);
				if (shown) visible += 1;
			}
			grid.classList.toggle('is-filtered', kind !== 'all');
			tally.textContent = counted(visible, 'editor');
		});
	}

	start();
})();
