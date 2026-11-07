/**
 * Page editor for page-editor.html: a single Fieldline website page,
 * laid out as a list of sections the reader can reorder by dragging, open
 * for editing, hide, duplicate or delete, next to a live mock of the site
 * that follows every keystroke at desktop or phone width. Section edits are
 * held back until "Publish changes"; the page settings form saves at once.
 * Visit counts and the change log close the page.
 *
 * Wiring it to real data:
 *   - The record comes from assets/basalt/js/data/multipurpose/site-pages.js (the same list
 *     the Pages screen reads), picked by the ?id= in the address, with
 *     Pricing as the fallback. Swap that lookup for a request to your API
 *     and keep the shape; everything here is drawn from it.
 *   - publishPending(), revertPending() and commitSettings() only change
 *     the record in memory; your save calls belong in those three.
 * Relies on basalt.js for the sortable list, segmented control, select
 * styling, avatars, copy buttons and toasts.
 */
(() => {
	'use strict';

	const shell = pick('[data-pe-root]');
	if (!shell) return;

	/* Fixed facts of the demo. The date matches the Pages list; a live
     install would read the clock instead. */
	const demoDate = '2026-10-08';
	const domain = 'fieldline.app';
	const signedIn = 'John Armstrong';
	const historyLength = 5;
	const desktopCanvas = 600;

	/* Search engines show about 60 characters of a title and between 70
     and 160 of a description. */
	const searchLimits = { title: 60, shortest: 70, longest: 160 };

	const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const numberWords = [
		'no',
		'one',
		'two',
		'three',
		'four',
		'five',
		'six',
		'seven',
		'eight',
		'nine',
		'ten',
		'eleven',
		'twelve',
	];

	const fixture = window.Basalt.data.sitePages;
	const menuSections = fixture.sections;

	const statusBadges = {
		published: { text: 'Published', look: 'success' },
		scheduled: { text: 'Scheduled', look: 'primary' },
		review: { text: 'In review', look: 'warning' },
		draft: { text: 'Draft', look: '' },
	};

	const audiences = [
		{ value: 'public', title: 'Anyone', detail: 'Search engines list it.' },
		{ value: 'unlisted', title: 'Anyone with the link', detail: 'Search engines leave it out.' },
		{ value: 'customers', title: 'Signed-in customers', detail: 'Only people with a Fieldline account.' },
	];

	/* Plan names and prices belong to Billing and are shown untouched; a
     plan-cards section only picks its heading, which plan stands out and
     whether yearly prices appear. */
	const planCards = [
		{ key: 'free', title: 'Free', monthly: 0, series: 4, blurb: 'Up to 3 people and 100 visits a month' },
		{
			key: 'starter',
			title: 'Basic',
			monthly: 15,
			series: 1,
			blurb: 'Scheduling, reminders and the Fieldline app',
		},
		{ key: 'growth', title: 'Pro', monthly: 32, series: 2, blurb: 'Adds quotes, invoices and online payments' },
		{ key: 'enterprise', title: 'Max', monthly: 58, series: 3, blurb: 'Adds single sign-on and a success manager' },
	];

	/* Every kind of section the editor offers, in the order of the Add
     menu. Each borrows one numbered chart color, so it follows whichever
     palette is active, and names the fields that may not be left blank. */
	const kinds = {
		hero: {
			label: 'Hero',
			glyph: 'bi-window-desktop',
			series: 1,
			mustFill: ['headline'],
			starter: {
				eyebrow: '',
				headline: 'A clear headline',
				text: 'One or two sentences that say what the page offers.',
				button: 'Start a free trial',
			},
		},
		plans: {
			label: 'Plan cards',
			glyph: 'bi-credit-card-2-front',
			series: 2,
			mustFill: ['heading'],
			starter: { heading: 'Pick a plan', highlight: 'growth', annual: false },
		},
		text: {
			label: 'Text',
			glyph: 'bi-text-paragraph',
			series: 3,
			mustFill: ['heading'],
			starter: { heading: 'A short heading', body: '<p>Write a few sentences here.</p>' },
		},
		list: {
			label: 'Feature list',
			glyph: 'bi-list-check',
			series: 4,
			mustFill: ['heading'],
			starter: {
				heading: 'What you get',
				items: [
					['First thing', ''],
					['Second thing', ''],
				],
			},
		},
		image: {
			label: 'Image',
			glyph: 'bi-image',
			series: 5,
			mustFill: ['alt'],
			starter: { picture: 'board', caption: '', alt: 'The Fieldline schedule board' },
		},
		quote: {
			label: 'Quote',
			glyph: 'bi-quote',
			series: 6,
			mustFill: ['quote'],
			starter: { quote: 'What a customer said about Fieldline.', name: '', role: '' },
		},
		faq: {
			label: 'Questions',
			glyph: 'bi-patch-question',
			series: 7,
			mustFill: ['heading'],
			starter: { heading: 'Questions', items: [['A question people ask?', 'The answer, in a sentence or two.']] },
		},
		cta: {
			label: 'Call to action',
			glyph: 'bi-megaphone',
			series: 8,
			mustFill: ['headline'],
			starter: { headline: 'Ready to try it?', text: '', button: 'Start a free trial', second: '' },
		},
	};

	const artworks = [
		{ value: 'board', title: 'Schedule board', glyph: 'bi-kanban' },
		{ value: 'app', title: 'Fieldline app', glyph: 'bi-phone' },
		{ value: 'route', title: 'Travel map', glyph: 'bi-signpost-split' },
	];

	/* Links in the mock site's own top bar, each with the page it marks. */
	const siteMenu = [
		{ text: 'Features', marks: 'pg-features' },
		{ text: 'Pricing', marks: 'pg-pricing' },
		{ text: 'Customers', marks: 'pg-stories' },
	];

	/* Pasted or typed rich text is rebuilt from this short list of tags, so
     no inline styles or scripts survive. */
	const safeTags = {
		P: 'p',
		UL: 'ul',
		OL: 'ol',
		LI: 'li',
		B: 'strong',
		STRONG: 'strong',
		I: 'em',
		EM: 'em',
		BR: 'br',
	};

	/* The record being edited is a private copy of the one the Pages list
     shows, picked by ?id= and falling back to Pricing. */
	const wantedId = new URLSearchParams(window.location.search).get('id');
	const stored =
		fixture.pages.find((entry) => entry.id === wantedId) ||
		fixture.pages.find((entry) => entry.id === 'pg-pricing');
	const record = deepCopy(stored);
	const ownerRole = fixture.people[record.owner] || '';
	record.next ||= [];
	appendCreation();

	/* liveBlocks is what the public site shows right now; the editor diffs
     against it to know what is waiting to be published. */
	let liveBlocks = deepCopy(record.blocks);
	let blockSerial = record.blocks.length + 1;
	const editorState = { expanded: null, mode: 'desktop' };

	/* Every element the script writes to, grouped by the card it sits in. */
	const ui = gatherParts({
		heading: '[data-pe="title"]',
		byline: '[data-pe="sub"]',
		badges: '[data-pe="tags"]',
		revert: '[data-pe-discard]',
		publish: '[data-pe-publish]',
		upToDate: '[data-pe-saved]',
		liveLabel: '[data-pe="live-label"]',
		list: '[data-pe="blocks"]',
		listNote: '[data-pe="blocks-desc"]',
		listEmpty: '[data-pe="blocks-empty"]',
		kindMenu: '[data-pe="add-menu"]',
		frame: '[data-pe="device"]',
		address: '[data-pe="url"]',
		canvas: '[data-pe="site"]',
		viewport: '[data-pe="screen"]',
		result: '[data-pe="snippet"]',
		facts: '[data-pe="facts"]',
		summaryView: '[data-pe="settings-view"]',
		form: '[data-pe-settings-form]',
		editButton: '[data-pe-settings-edit]',
		audienceSlot: '[data-pe="visibility"]',
		trafficNote: '[data-pe="traffic-desc"]',
		chart: '[data-pe="spark"]',
		exits: '[data-pe="next"]',
		log: '[data-pe="history"]',
	});

	/**
	 * Fills the static choices, binds every listener, then draws each part
	 * of the page once. Runs a single time, from the bottom of this file.
	 */
	function start() {
		ui.audienceSlot.innerHTML = audiences.map(audienceRadio).join('');
		settingsField('section').innerHTML = menuSections
			.map((entry) => `<option value="${entry.id}" data-dot="series-${entry.tone}">${entry.name}</option>`)
			.join('');
		ui.kindMenu.innerHTML = Object.entries(kinds)
			.map(([type, kind]) => kindMenuItem(type, kind))
			.join('');

		bindPageClicks();
		bindListEvents();
		bindPreviewEvents();
		bindSettingsEvents();

		/* Small screens open the preview in its phone frame. */
		if (window.matchMedia('(max-width: 575.98px)').matches) {
			pick('#pe-width-phone', shell).checked = true;
			switchDevice('phone');
		}

		paintHeader();
		paintList();
		paintPreview();
		paintFacts();
		paintTraffic();
		paintHistory();
		scalePreview();
		window.Basalt.sortable?.(ui.list);
	}

	/* Listeners are bound once, by start(); everything after them redraws. */

	/**
	 * One delegated click listener for the whole editor. Page-wide buttons
	 * are tried first, in priority order; anything else inside a section
	 * row goes to onRowClick().
	 */
	function bindPageClicks() {
		const pageButtons = [
			['[data-pe-add]', (button) => insertBlock(button.getAttribute('data-pe-add'))],
			['[data-pe-publish]', () => publishPending()],
			['[data-pe-discard]', () => revertPending()],
			['[data-pe-live]', () => flipLive()],
			['[data-pe-copy]', () => copyAddress()],
			[
				'[data-pe-duplicate]',
				() =>
					notify({
						tone: 'success',
						icon: 'bi-files',
						title: 'Copy saved as a draft',
						text: `“${record.title} (copy)” is on the Pages list at ${record.path}-copy.`,
					}),
			],
			['[data-pe-settings-edit]', () => beginSettings()],
			[
				'[data-pe-settings-cancel]',
				() => {
					endSettings();
					ui.editButton.focus();
				},
			],
			/* A click on a section in the mock opens that section in the list. */
			['[data-pe-slot]', (slot) => openOrClose(slot.getAttribute('data-pe-slot'), { keep: true, focus: true })],
		];

		shell.addEventListener('click', (event) => {
			const target = event.target;
			for (const [selector, run] of pageButtons) {
				const hit = target.closest(selector);
				if (hit) {
					run(hit);
					return;
				}
			}
			const row = target.closest('.pe-block');
			if (row) onRowClick(target, row);
		});
	}

	function bindListEvents() {
		ui.list.addEventListener('input', readField);
		ui.list.addEventListener('change', (event) => {
			if (event.target.type === 'radio' || event.target.type === 'checkbox') readField(event);
		});

		/* The formatting buttons must not steal the selection from the text. */
		ui.list.addEventListener('mousedown', (event) => {
			if (event.target.closest('[data-pe-cmd]')) event.preventDefault();
		});
		document.addEventListener('selectionchange', () => {
			const focused = document.activeElement;
			if (focused?.matches?.('[data-pe-rich]')) reflectFormatting(focused.closest('.pe-block'));
		});

		/* Escape inside an open form folds it and returns focus to its name. */
		ui.list.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape' || !editorState.expanded) return;
			if (event.target.closest('.basalt-sortable-handle, .dropdown')) return;
			if (!event.target.closest('.pe-block-form')) return;
			event.preventDefault();
			openOrClose(editorState.expanded);
		});

		/* Hovering a row outlines the matching part of the mock. */
		ui.list.addEventListener('mouseover', (event) => {
			clearHoverMarks();
			const row = event.target.closest('.pe-block');
			if (!row) return;
			pick(`[data-pe-slot="${row.getAttribute('data-pe-id')}"]`, ui.canvas)?.classList.add('is-hover');
		});
		ui.list.addEventListener('mouseleave', clearHoverMarks);

		ui.list.addEventListener('basalt:sortable-change', onReorder);
	}

	function bindPreviewEvents() {
		for (const option of pickAll('input[name="peWidth"]', shell)) {
			option.addEventListener('change', () => {
				if (option.checked) switchDevice(option.value);
			});
		}
		/* The frame animates its width, so measure again when it stops. */
		ui.frame.addEventListener('transitionend', scalePreview);
		if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(scalePreview)).observe(ui.viewport);
	}

	function bindSettingsEvents() {
		ui.form.addEventListener('submit', commitSettings);

		for (const name of ['seoTitle', 'seoDesc']) {
			const fieldEl = settingsField(name);
			fieldEl.addEventListener('input', () => {
				fieldEl.classList.remove('is-invalid');
				updateCounters();
				ui.result.innerHTML = searchResult(
					settingsField('seoTitle').value.trim(),
					settingsField('seoDesc').value.trim(),
				);
			});
		}
		for (const name of ['title', 'path']) {
			const fieldEl = settingsField(name);
			fieldEl.addEventListener('input', () => fieldEl.classList.remove('is-invalid'));
		}
	}

	/**
	 * Clicks inside one section row: open or fold it, run a menu action,
	 * add or drop a list item, or apply a formatting button.
	 */
	function onRowClick(target, row) {
		const block = findBlock(row.getAttribute('data-pe-id'));

		if (target.closest('[data-pe-toggle], [data-pe-done]')) {
			openOrClose(block.id);
			return;
		}

		const menuButton = target.closest('[data-pe-act]');
		if (menuButton) {
			bootstrap.Tooltip.getInstance(menuButton)?.hide();
			const rowActions = {
				hide: flipVisibility,
				up: (item) => shiftBlock(item, -1),
				down: (item) => shiftBlock(item, 1),
				duplicate: cloneBlock,
				delete: dropBlock,
			};
			rowActions[menuButton.getAttribute('data-pe-act')]?.(block);
			return;
		}

		if (target.closest('[data-pe-add-item]')) {
			block.data.items.push(['', '']);
			const pairs = redrawForm(row, block);
			pick('input', pairs[pairs.length - 1]).focus();
			afterEdit(block);
			return;
		}

		const removeButton = target.closest('[data-pe-remove-item]');
		if (removeButton) {
			const position = Number(removeButton.closest('[data-pe-item]').getAttribute('data-pe-item'));
			block.data.items.splice(position, 1);
			const pairs = redrawForm(row, block);
			pick('input', pairs[Math.min(position, pairs.length - 1)]).focus();
			afterEdit(block);
			return;
		}

		const toolButton = target.closest('[data-pe-cmd]');
		if (!toolButton) return;
		const editor = pick('[data-pe-rich]', row);
		editor.focus();
		document.execCommand(toolButton.getAttribute('data-pe-cmd'), false, null);
		block.data.body = sanitizeRich(editor.innerHTML);
		reflectFormatting(row);
		afterEdit(block);
	}

	/** Rebuilds a row's open form and returns its item rows. */
	function redrawForm(row, block) {
		pick('.pe-block-form', row).innerHTML = editorFor(block);
		return Array.from(pickAll('.pe-pair', row));
	}

	/**
	 * Stores whatever a form control now holds. The list is left alone so
	 * the control keeps focus; only the summary line, mock and header move.
	 */
	function readField(event) {
		const widget = event.target;
		const row = widget.closest('.pe-block');
		if (!row) return;
		const block = findBlock(row.getAttribute('data-pe-id'));
		const key = widget.getAttribute('data-pe-f');

		if (key) {
			block.data[key] = widget.type === 'checkbox' ? widget.checked : widget.value;
			widget.classList.remove('is-invalid');
		} else if (widget.hasAttribute('data-pe-pair')) {
			const item = Number(widget.closest('[data-pe-item]').getAttribute('data-pe-item'));
			block.data.items[item][Number(widget.getAttribute('data-pe-pair'))] = widget.value;
		} else if (widget.hasAttribute('data-pe-rich')) {
			block.data.body = sanitizeRich(widget.innerHTML);
		} else {
			return;
		}
		afterEdit(block);
	}

	/** Lights the formatting buttons that match the text under the caret. */
	function reflectFormatting(row) {
		for (const tool of pickAll('[data-pe-cmd]', row)) {
			let active;
			try {
				active = document.queryCommandState(tool.getAttribute('data-pe-cmd'));
			} catch {
				active = false;
			}
			tool.setAttribute('aria-pressed', String(active));
		}
	}

	/**
	 * After a drag or a keyboard move the list order is the truth. The
	 * redraw waits for the shared sortable to finish animating, then puts
	 * focus back on the handle that did the moving.
	 */
	function onReorder(event) {
		const order = Array.from(pickAll('.pe-block', ui.list), (row) => row.getAttribute('data-pe-id'));
		record.blocks.sort((first, second) => order.indexOf(first.id) - order.indexOf(second.id));
		const movedId = event.detail?.item?.getAttribute('data-pe-id');

		setTimeout(
			() => {
				const focusInside = ui.list.contains(document.activeElement);
				repaintAll();
				const handle = movedId && pick(`[data-pe-id="${movedId}"] .basalt-sortable-handle`, ui.list);
				if (handle && focusInside) handle.focus();
			},
			prefersStill() ? 0 : 260,
		);
	}

	function clearHoverMarks() {
		for (const slot of pickAll('.pe-slot.is-hover', ui.canvas)) slot.classList.remove('is-hover');
	}

	function copyAddress() {
		window.Basalt.copyText?.(`https://${domain}${record.path}`);
		notify({ tone: 'success', icon: 'bi-link-45deg', title: 'Address copied', text: `${domain}${record.path}` });
	}

	/* The header states whether the page is live and what still waits. */

	/**
	 * Counts sections that differ from the live site: new, edited, moved
	 * to another position, or deleted.
	 */
	function countPending() {
		const live = new Map(liveBlocks.map((block, position) => [block.id, { block, position }]));
		let waitingCount = liveBlocks.filter((block) => !findBlock(block.id)).length;
		record.blocks.forEach((block, position) => {
			const before = live.get(block.id);
			if (!before || before.position !== position || JSON.stringify(before.block) !== JSON.stringify(block))
				waitingCount += 1;
		});
		return waitingCount;
	}

	function paintHeader() {
		const liveNow = record.status === 'published';
		const waitingCount = countPending();
		const statusLook = statusBadges[record.status];
		const menuArea = menuSection(record.section);
		const when = record.edited === demoDate ? 'today' : shortDate(record.edited);

		ui.heading.textContent = record.title;
		ui.byline.textContent = `${domain}${record.path} · ${liveNow ? 'Published' : 'Last saved'} ${when} by ${record.changes[0][0]}`;

		const badgeClass = statusLook.look ? ` basalt-status-${statusLook.look}` : '';
		const waiting = waitingCount
			? `<span class="basalt-status basalt-status-dot basalt-status-warning">${upperFirst(countPhrase(waitingCount, 'section'))} not ${liveNow ? 'published' : 'saved'}</span>`
			: '';
		ui.badges.innerHTML = `<span class="basalt-status basalt-status-dot${badgeClass}">${statusLook.text}</span>${sectionPill(menuArea)}${waiting}`;

		ui.revert.hidden = !waitingCount;
		ui.publish.hidden = !waitingCount;
		ui.upToDate.hidden = Boolean(waitingCount);
		ui.upToDate.lastElementChild.textContent = liveNow ? 'Everything is live' : 'Everything is saved';
		ui.publish.lastChild.textContent = liveNow ? 'Publish changes' : 'Save draft';
		ui.liveLabel.textContent = liveNow ? 'Unpublish' : 'Publish the page';
		ui.liveLabel.previousElementSibling.className = `bi ${liveNow ? 'bi-eye-slash' : 'bi-send'}`;
	}

	function sectionPill(menuArea) {
		return `<span class="pe-tag pe-tone-${menuArea.tone}"><span class="pe-dot" aria-hidden="true"></span>${menuArea.name}</span>`;
	}

	/* The section list is redrawn whole; open rows carry their form. */

	function paintList() {
		for (const tipped of pickAll('[data-bs-toggle="tooltip"]', ui.list)) {
			bootstrap.Tooltip.getInstance(tipped)?.dispose();
		}

		const blockCount = record.blocks.length;
		ui.list.innerHTML = record.blocks.map(rowMarkup).join('');
		ui.list.hidden = !blockCount;
		ui.listEmpty.hidden = Boolean(blockCount);
		ui.listNote.textContent = blockCount ? `${visibleCountText()}. Drag to reorder.` : 'Nothing on the page yet.';
		if (!blockCount) {
			ui.listEmpty.innerHTML = window.Basalt.emptyState({
				icon: 'layout-text-window',
				title: 'This page is empty',
				text: 'Add a section to start, such as a hero or some text.',
			});
		}

		window.Basalt.tips?.(ui.list);
		if (window.Basalt.select) {
			for (const select of pickAll('select.form-select', ui.list)) window.Basalt.select(select);
		}
	}

	function visibleCountText() {
		const shownBlocks = record.blocks.filter((block) => !block.hidden).length;
		if (!shownBlocks) return 'Every section hidden';
		const concealed = record.blocks.length - shownBlocks;
		const tail = concealed ? `, ${numberWords[concealed] || concealed} hidden` : '';
		return `${upperFirst(String(numberWords[shownBlocks] || shownBlocks))} shown${tail}`;
	}

	/** The muted line under a section's name, so the list reads like the page. */
	function blockSummary(block) {
		const sectionData = block.data;
		const headingLead = sectionData.heading ? `${sectionData.heading} · ` : '';
		const summaries = {
			hero: () => sectionData.headline,
			cta: () => sectionData.headline,
			plans: () =>
				`${headingLead}${planCards.find((plan) => plan.key === sectionData.highlight).title} highlighted`,
			text: () => sectionData.heading || textOf(sectionData.body),
			list: () => headingLead + countPhrase(sectionData.items.length, 'item'),
			image: () => sectionData.caption || sectionData.alt,
			quote: () =>
				[sectionData.name, sectionData.role.split(', ').pop()].filter(Boolean).join(', ') || sectionData.quote,
			faq: () => headingLead + countPhrase(sectionData.items.length, 'question'),
		};
		return summaries[block.type]?.() ?? '';
	}

	function rowMarkup(block, position) {
		const kind = kindOf(block);
		const expandedHere = editorState.expanded === block.id;
		const classes = ['basalt-sortable-item', 'pe-block', `pe-tone-${kind.series}`];
		if (block.hidden) classes.push('is-hidden');
		if (expandedHere) classes.push('is-open');
		const name = htmlSafe(kind.label);
		const hiddenTag = block.hidden ? '<span class="pe-hidden-tag">Hidden</span>' : '';

		const handle = `<button class="basalt-sortable-handle" type="button" aria-pressed="false" aria-describedby="basalt-sortable-help" aria-label="Move ${name}, section ${position + 1}"><i class="bi bi-grip-vertical" aria-hidden="true"></i></button>`;
		const icon = `<span class="pe-kind" aria-hidden="true"><i class="bi ${kind.glyph}"></i></span>`;
		const opener = `<button type="button" class="pe-block-main" data-pe-toggle aria-controls="pe-form-${block.id}" aria-expanded="${expandedHere}"><span class="pe-block-name">${name}${hiddenTag}</span><span class="pe-block-sum" data-pe-sum>${htmlSafe(blockSummary(block))}</span></button>`;
		const eye = `<button type="button" class="btn btn-icon pe-eye" data-pe-act="hide" data-bs-toggle="tooltip" data-bs-title="${block.hidden ? 'Show on the page' : 'Hide from the page'}" aria-label="Hide ${name} from the page" aria-pressed="${block.hidden}"><i class="bi ${block.hidden ? 'bi-eye-slash' : 'bi-eye'}" aria-hidden="true"></i></button>`;
		const formMarkup = `<div class="pe-block-form" id="pe-form-${block.id}"${expandedHere ? '' : ' hidden'}>${expandedHere ? editorFor(block) : ''}</div>`;

		return `<li class="${classes.join(' ')}" data-pe-id="${block.id}">${handle}${icon}${opener}${eye}${rowMenu(block, position)}${formMarkup}</li>`;
	}

	function rowMenu(block, position) {
		const menuItems = [];
		if (position > 0) menuItems.push(menuEntry('up', 'bi-arrow-up', 'Move up'));
		if (position < record.blocks.length - 1) menuItems.push(menuEntry('down', 'bi-arrow-down', 'Move down'));
		menuItems.push(menuEntry('duplicate', 'bi-files', 'Duplicate'));
		menuItems.push('<li><hr class="dropdown-divider"></li>');
		menuItems.push(menuEntry('delete', 'bi-trash3', 'Remove', ' pe-danger-item'));

		const trigger = `<button type="button" class="btn btn-icon pe-more" data-pe-more="${block.id}" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-label="More for ${htmlSafe(kindOf(block).label)}" aria-expanded="false"><i class="bi bi-three-dots" aria-hidden="true"></i></button>`;
		return `<div class="dropdown">${trigger}<ul class="dropdown-menu dropdown-menu-end">${menuItems.join('')}</ul></div>`;
	}

	function menuEntry(action, glyph, text, extraClass = '') {
		return `<li><button type="button" class="dropdown-item${extraClass}" data-pe-act="${action}"><i class="bi ${glyph}" aria-hidden="true"></i>${text}</button></li>`;
	}

	function kindMenuItem(type, kind) {
		return `<li><button type="button" class="dropdown-item pe-tone-${kind.series}" data-pe-add="${type}"><span class="pe-kind pe-kind-sm" aria-hidden="true"><i class="bi ${kind.glyph}"></i></span>${kind.label}</button></li>`;
	}

	/**
	 * Opens a section's form, or folds it when it is already open. With
	 * keep it always ends up open; with focus the first field takes focus
	 * and the row scrolls into view.
	 */
	function openOrClose(id, options = {}) {
		window.Basalt.slide(ui.list, () => {
			editorState.expanded = editorState.expanded === id && !options.keep ? null : id;
			paintList();
		});
		paintPreview();

		if (!editorState.expanded) {
			pick(`[data-pe-id="${id}"] [data-pe-toggle]`, ui.list)?.focus({ preventScroll: true });
			return;
		}

		const row = pick(`[data-pe-id="${id}"]`, ui.list);
		window.Basalt.buttons?.(row);
		scrollPreviewTo(id);
		if (!options.focus) {
			pick('[data-pe-toggle]', row).focus({ preventScroll: true });
			return;
		}
		pick('input:not([type="radio"]), textarea, [data-pe-rich]', pick('.pe-block-form', row))?.focus({
			preventScroll: true,
		});
		row.scrollIntoView({ block: 'nearest', behavior: prefersStill() ? 'auto' : 'smooth' });
	}

	function afterEdit(block) {
		const row = pick(`[data-pe-id="${block.id}"]`, ui.list);
		if (row) pick('[data-pe-sum]', row).textContent = blockSummary(block);
		paintPreview();
		paintHeader();
	}

	function repaintAll() {
		paintList();
		paintPreview();
		paintHeader();
		if (editorState.expanded) window.Basalt.buttons?.(ui.list);
	}

	function insertBlock(type) {
		const fresh = { id: `b${++blockSerial}`, type, hidden: false, data: deepCopy(kinds[type].starter) };
		const slot = editorState.expanded
			? record.blocks.indexOf(findBlock(editorState.expanded)) + 1
			: record.blocks.length;
		record.blocks.splice(slot, 0, fresh);
		editorState.expanded = fresh.id;
		repaintAll();
		openOrClose(fresh.id, { keep: true, focus: true });
	}

	function shiftBlock(block, step) {
		const from = record.blocks.indexOf(block);
		const to = from + step;
		if (to < 0 || to >= record.blocks.length) return;
		record.blocks.splice(from, 1);
		record.blocks.splice(to, 0, block);
		repaintAll();
		pick(`[data-pe-more="${block.id}"]`, ui.list)?.focus();
		window.Basalt.announce?.(`${kindOf(block).label} moved to section ${to + 1} of ${record.blocks.length}.`);
	}

	function cloneBlock(block) {
		const twin = { id: `b${++blockSerial}`, type: block.type, hidden: block.hidden, data: deepCopy(block.data) };
		record.blocks.splice(record.blocks.indexOf(block) + 1, 0, twin);
		editorState.expanded = twin.id;
		repaintAll();
		openOrClose(twin.id, { keep: true, focus: true });
		notify({
			tone: 'success',
			icon: 'bi-files',
			title: `${kindOf(block).label} copied`,
			text: 'The copy sits right under the original.',
		});
	}

	function dropBlock(block) {
		const index = record.blocks.indexOf(block);
		record.blocks.splice(index, 1);
		if (editorState.expanded === block.id) editorState.expanded = null;
		repaintAll();

		const neighbor = record.blocks[Math.min(index, record.blocks.length - 1)];
		if (neighbor) pick(`[data-pe-id="${neighbor.id}"] [data-pe-toggle]`, ui.list)?.focus();

		function putBack() {
			record.blocks.splice(index, 0, block);
			repaintAll();
		}
		notify({
			tone: 'success',
			icon: 'bi-trash3',
			title: `${kindOf(block).label} removed`,
			text: 'It leaves the site when you publish.',
			actions: [{ label: 'Undo', onClick: putBack }],
		});
	}

	function flipVisibility(block) {
		block.hidden = !block.hidden;
		repaintAll();
		pick(`[data-pe-id="${block.id}"] .pe-eye`, ui.list)?.focus();
		const outcome = block.hidden ? ' is hidden from the page.' : ' shows on the page again.';
		window.Basalt.announce?.(`${kindOf(block).label}${outcome}`);
	}

	/* Each kind of section gets its own form, built from small field parts. */

	function fieldId(block, key) {
		return `pe-${block.id}-${key}`;
	}

	/**
	 * A labeled text box or textarea for one field. Required fields carry
	 * their own error line; optional ones say so beside the label.
	 * @param {object} spec  area, rows, max, short, error
	 */
	function textField(block, key, label, spec = {}) {
		const id = fieldId(block, key);
		const required = kindOf(block).mustFill.includes(key);
		const describedBy = required ? ` aria-describedby="${id}-err"` : '';
		const value = htmlSafe(block.data[key]);

		const controlMarkup = spec.area
			? `<textarea class="form-control" id="${id}" data-pe-f="${key}" rows="${spec.rows || 2}" maxlength="${spec.max || 220}"${describedBy}>${value}</textarea>`
			: `<input type="text" class="form-control${spec.short ? ' pe-input-sm' : ''}" id="${id}" data-pe-f="${key}" value="${value}" maxlength="${spec.max || 90}" autocomplete="off"${describedBy}>`;
		const marker = required ? '' : ' <span class="pe-optional">optional</span>';
		const problem = required
			? `<p class="invalid-feedback" id="${id}-err">${spec.error || 'This can’t be empty.'}</p>`
			: '';

		return `<div class="pe-field"><label class="form-label" for="${id}">${label}${marker}</label>${controlMarkup}${problem}</div>`;
	}

	/**
	 * Repeating two-part rows (add-ons, questions and answers), each with a
	 * remove button, and a single Add button below while there is room.
	 */
	function pairList(block, firstLabel, secondLabel, addText, longAnswers) {
		const items = block.data.items;
		const listId = fieldId(block, 'items');
		const rows = items
			.map((pair, index) => pairRow(block, pair, index, firstLabel, secondLabel, longAnswers, items.length < 2))
			.join('');
		const adder =
			items.length < 6
				? `<button type="button" class="btn btn-link pe-add-item" data-pe-add-item><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>${addText}</button>`
				: '';
		return `<div class="pe-field"><p class="form-label" id="${listId}">${longAnswers ? 'Questions and answers' : 'Items'}</p><ol class="pe-pairs" aria-labelledby="${listId}">${rows}</ol>${adder}</div>`;
	}

	function pairRow(block, pair, index, firstLabel, secondLabel, longAnswers, onlyOne) {
		const firstId = fieldId(block, `a${index}`);
		const secondId = fieldId(block, `b${index}`);
		const second = longAnswers
			? `<textarea class="form-control" id="${secondId}" data-pe-pair="1" placeholder="${secondLabel}" rows="2" maxlength="200">${htmlSafe(pair[1])}</textarea>`
			: `<input type="text" class="form-control" id="${secondId}" data-pe-pair="1" placeholder="${secondLabel}" value="${htmlSafe(pair[1])}" maxlength="60" autocomplete="off">`;
		const inputsMarkup =
			`<div class="pe-pair-fields${longAnswers ? ' pe-pair-fields-stack' : ''}">` +
			`<label class="visually-hidden" for="${firstId}">${firstLabel} ${index + 1}</label>` +
			`<input type="text" class="form-control" id="${firstId}" data-pe-pair="0" placeholder="${firstLabel}" value="${htmlSafe(pair[0])}" maxlength="80" autocomplete="off">` +
			`<label class="visually-hidden" for="${secondId}">${secondLabel} ${index + 1}</label>${second}</div>`;
		const remover = `<button type="button" class="btn btn-icon pe-pair-remove" data-pe-remove-item aria-label="Remove ${firstLabel.toLowerCase()} ${index + 1}"${onlyOne ? ' hidden' : ''}><i class="bi bi-x-lg" aria-hidden="true"></i></button>`;
		return `<li class="pe-pair" data-pe-item="${index}">${inputsMarkup}${remover}</li>`;
	}

	/** The whole form for one section, ending in its Done button. */
	function editorFor(block) {
		const formMakers = {
			hero: heroForm,
			plans: plansForm,
			text: richTextForm,
			list: (item) =>
				textField(item, 'heading', 'Heading', { max: 60, error: 'Give the list a heading.' }) +
				pairList(item, 'Name', 'Detail', 'Add an item', false),
			image: imageForm,
			quote: (item) =>
				textField(item, 'quote', 'Quote', { area: true, max: 200, error: 'Write the quote.' }) +
				textField(item, 'name', 'Name', { short: true, max: 40 }) +
				textField(item, 'role', 'Role and company', { max: 60 }),
			faq: (item) =>
				textField(item, 'heading', 'Heading', { max: 60, error: 'Give the questions a heading.' }) +
				pairList(item, 'Question', 'Answer', 'Add a question', true),
			cta: ctaForm,
		};
		const body = formMakers[block.type]?.(block) ?? '';
		return `${body}<div class="pe-block-foot"><button type="button" class="btn btn-outline-secondary btn-sm" data-pe-done>Done</button></div>`;
	}

	function heroForm(block) {
		return [
			textField(block, 'eyebrow', 'Small line above', { short: true, max: 30 }),
			textField(block, 'headline', 'Headline', { max: 70, error: 'Give the hero a headline.' }),
			textField(block, 'text', 'Text', { area: true, max: 180 }),
			textField(block, 'button', 'Button', { short: true, max: 30 }),
		].join('');
	}

	function ctaForm(block) {
		const buttons =
			textField(block, 'button', 'Button', { short: true, max: 30 }) +
			textField(block, 'second', 'Second button', { short: true, max: 30 });
		return `${
			textField(block, 'headline', 'Headline', { max: 60, error: 'Give the call to action a headline.' }) +
			textField(block, 'text', 'Text', { max: 120 })
		}<div class="pe-field-row">${buttons}</div>`;
	}

	function plansForm(block) {
		const groupId = fieldId(block, 'hl');
		const switchId = fieldId(block, 'annual');
		const choices = planCards
			.map((plan) => {
				const optionId = fieldId(block, `hl-${plan.key}`);
				const checked = block.data.highlight === plan.key ? ' checked' : '';
				return `<input type="radio" class="btn-check" id="${optionId}" name="${groupId}" value="${plan.key}" data-pe-f="highlight"${checked}><label class="basalt-segmented-option" for="${optionId}">${plan.title}</label>`;
			})
			.join('');

		const highlight = `<div class="pe-field"><p class="form-label" id="${groupId}">Highlighted plan</p><div class="basalt-segmented basalt-segmented-sm" data-basalt-segmented role="radiogroup" aria-labelledby="${groupId}">${choices}</div></div>`;
		const yearly = `<div class="pe-field"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" role="switch" id="${switchId}" data-pe-f="annual"${block.data.annual ? ' checked' : ''}><label class="form-check-label" for="${switchId}">Show the price for a year as well</label></div></div>`;
		const note =
			'<p class="pe-hint">Plan names and prices come from Billing, so they always match what customers pay.</p>';

		return (
			textField(block, 'heading', 'Heading', { max: 60, error: 'Give the plan cards a heading.' }) +
			highlight +
			yearly +
			note
		);
	}

	function richTextForm(block) {
		const bodyId = fieldId(block, 'body');
		const labelId = fieldId(block, 'body-label');
		const tool = (command, glyph, name) =>
			`<button type="button" class="pe-tool" data-pe-cmd="${command}" title="${name}" aria-label="${name}" aria-pressed="false"><i class="bi ${glyph}" aria-hidden="true"></i></button>`;
		const toolbar = `<div class="pe-toolbar" role="toolbar" aria-label="Formatting" aria-controls="${bodyId}">${tool(
			'bold',
			'bi-type-bold',
			'Bold',
		)}${tool('italic', 'bi-type-italic', 'Italic')}<span class="pe-toolbar-sep" aria-hidden="true"></span>${tool(
			'insertUnorderedList',
			'bi-list-ul',
			'Bulleted list',
		)}${tool('insertOrderedList', 'bi-list-ol', 'Numbered list')}</div>`;
		const editable = `<div class="pe-editor-body pe-prose" id="${bodyId}" data-pe-rich data-placeholder="Write the text" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="${labelId}">${block.data.body}</div>`;

		return `${textField(block, 'heading', 'Heading', {
			max: 60,
			error: 'Give the text a heading.',
		})}<div class="pe-field"><p class="form-label" id="${labelId}">Text</p><div class="pe-editor">${toolbar}${editable}</div></div>`;
	}

	function imageForm(block) {
		const cardMarkup = artworks
			.map((art) => {
				const checked = block.data.picture === art.value ? ' checked' : '';
				return (
					`<label class="basalt-choice-card pe-picture"><input class="basalt-choice-card-input" type="radio" name="${fieldId(block, 'pic')}" value="${art.value}" data-pe-f="picture"${checked}>` +
					'<span class="basalt-choice-card-mark" aria-hidden="true"><i class="bi bi-check-lg"></i></span>' +
					`<span class="basalt-choice-card-icon" aria-hidden="true"><i class="bi ${art.glyph}"></i></span>` +
					`<span class="basalt-choice-card-title">${art.title}</span></label>`
				);
			})
			.join('');

		return `<fieldset class="pe-field"><legend class="form-label">Picture</legend><div class="basalt-choice-grid pe-pictures">${cardMarkup}</div></fieldset>${textField(
			block,
			'caption',
			'Caption',
			{ max: 80 },
		)}${textField(block, 'alt', 'Description for screen readers', { max: 120, error: 'Describe the picture for people who can’t see it.' })}`;
	}

	/* The mock site is plain markup, rebuilt on every change. */

	function paintPreview() {
		ui.address.textContent = `${domain}${record.path}`;
		const menuLinks = siteMenu
			.map((link) => `<span${link.marks === record.id ? ' class="is-here"' : ''}>${link.text}</span>`)
			.join('');
		const topBar = `<div class="pe-nav"><span class="pe-nav-logo"><i class="bi bi-geo-alt-fill"></i>Fieldline</span><span class="pe-nav-links">${menuLinks}</span><span class="pe-nav-btn">Sign in</span><i class="bi bi-list pe-nav-menu"></i></div>`;
		const shownBlocks = record.blocks.filter((block) => !block.hidden);
		const body = shownBlocks.length
			? shownBlocks.map(previewSlot).join('')
			: '<p class="pe-site-empty">Nothing to show yet.</p>';
		const footer =
			'<div class="pe-foot"><span>© 2026 Fieldline</span><span>Terms · Privacy · Security</span></div>';
		ui.canvas.innerHTML = topBar + body + footer;
	}

	function previewSlot(block) {
		const currentClass = editorState.expanded === block.id ? ' is-current' : '';
		return `<div class="pe-slot${currentClass}" data-pe-slot="${block.id}"><span class="pe-slot-tag">${htmlSafe(kindOf(block).label)}</span>${previewSection(block)}</div>`;
	}

	function siteButton(label, ghost) {
		if (!label) return '';
		return `<span class="pe-s-btn${ghost ? ' pe-s-btn-ghost' : ''}">${htmlSafe(label)}</span>`;
	}

	function optionalHeading(heading, extraClass = '') {
		return heading ? `<p class="pe-s-h2${extraClass}">${htmlSafe(heading)}</p>` : '';
	}

	/** One section as the public site would render it. */
	function previewSection(block) {
		const sectionData = block.data;
		const leadLine = sectionData.text ? `<p class="pe-s-lead">${htmlSafe(sectionData.text)}</p>` : '';
		const renderers = {
			hero: () => {
				const eyebrow = sectionData.eyebrow
					? `<p class="pe-s-eyebrow">${htmlSafe(sectionData.eyebrow)}</p>`
					: '';
				return `<div class="pe-s pe-s-hero">${eyebrow}<p class="pe-s-h1">${htmlSafe(sectionData.headline)}</p>${leadLine}${siteButton(sectionData.button)}</div>`;
			},
			plans: () =>
				`<div class="pe-s">${optionalHeading(sectionData.heading, ' text-center')}<div class="pe-plans">${planCards.map((plan) => planPreview(plan, sectionData)).join('')}</div></div>`,
			text: () =>
				`<div class="pe-s pe-s-text">${optionalHeading(sectionData.heading)}<div class="pe-prose">${sectionData.body}</div></div>`,
			list: () =>
				`<div class="pe-s">${optionalHeading(sectionData.heading)}<div class="pe-feats">${sectionData.items.map(featurePreview).join('')}</div></div>`,
			image: () =>
				`<div class="pe-s">${artworkMarkup(sectionData.picture)}${sectionData.caption ? `<p class="pe-s-caption">${htmlSafe(sectionData.caption)}</p>` : ''}</div>`,
			quote: () => {
				const role = sectionData.role ? ` · ${htmlSafe(sectionData.role)}` : '';
				const author = sectionData.name
					? `<p class="pe-quote-who"><b>${htmlSafe(sectionData.name)}</b>${role}</p>`
					: '';
				return `<div class="pe-s pe-s-quote"><p class="pe-quote">“${htmlSafe(sectionData.quote)}”</p>${author}</div>`;
			},
			faq: () =>
				`<div class="pe-s">${optionalHeading(sectionData.heading)}<div class="pe-faq">${sectionData.items.map(questionPreview).join('')}</div></div>`,
			cta: () =>
				`<div class="pe-s pe-s-cta"><p class="pe-s-h2">${htmlSafe(sectionData.headline)}</p>${leadLine}<div class="pe-s-btns">${siteButton(sectionData.button)}${siteButton(sectionData.second, true)}</div></div>`,
		};
		return renderers[block.type]?.() ?? '';
	}

	function planPreview(plan, sectionData) {
		const picked = sectionData.highlight === plan.key;
		const flag = picked ? '<span class="pe-plan-flag">Most popular</span>' : '';
		const yearly =
			sectionData.annual && plan.monthly
				? `<p class="pe-plan-year">or $${formatCount(plan.monthly * 10)} a year</p>`
				: '';
		const price = `<p class="pe-plan-price"><b>$${plan.monthly}</b> ${plan.monthly ? 'per seat a month' : 'for good'}</p>`;
		return `<div class="pe-plan pe-tone-${plan.series}${picked ? ' is-picked' : ''}">${flag}<p class="pe-plan-name">${plan.title}</p>${price}${yearly}<p class="pe-plan-line">${plan.blurb}</p></div>`;
	}

	function featurePreview([title, detail], index) {
		const extra = detail ? `<span>${htmlSafe(detail)}</span>` : '';
		return `<div class="pe-feat pe-tone-${(index % 4) + 1}"><span class="pe-feat-mark"><i class="bi bi-check-lg"></i></span><span><b>${htmlSafe(title)}</b>${extra}</span></div>`;
	}

	/* Only the first question shows open, the way the live accordion loads. */
	function questionPreview([question, answer], index) {
		const isFirst = index === 0;
		const answerLine = isFirst ? `<p class="pe-faq-a">${htmlSafe(answer)}</p>` : '';
		return `<div class="pe-faq-item${isFirst ? ' is-open' : ''}"><p class="pe-faq-q">${htmlSafe(question)}<i class="bi ${isFirst ? 'bi-dash' : 'bi-plus'}"></i></p>${answerLine}</div>`;
	}

	/**
	 * Drawings made from theme colors instead of photos, so they recolor
	 * with the palette: a schedule board, a phone, or a route map.
	 */
	function artworkMarkup(kind) {
		if (kind === 'app') {
			const jobs = [1, 2, 3, 4]
				.map((series) => `<span class="pe-pic-job pe-tone-${series}"><i></i><b></b></span>`)
				.join('');
			return `<div class="pe-pic pe-pic-app"><div class="pe-pic-phone">${jobs}</div></div>`;
		}
		if (kind === 'route') {
			const curve = 'M10 120 C 60 40, 110 130, 160 70 S 260 20, 310 60';
			const stops = [
				[10, 120],
				[92, 82],
				[160, 70],
				[232, 40],
				[310, 60],
			]
				.map(
					([x, y], index) =>
						`<circle class="pe-pic-stop pe-tone-${(index % 4) + 1}" cx="${x}" cy="${y}" r="7"/>`,
				)
				.join('');
			return `<div class="pe-pic pe-pic-route"><svg viewBox="0 0 320 140" preserveAspectRatio="xMidYMid meet" focusable="false"><path class="pe-pic-road" d="${curve}"/><path class="pe-pic-path" d="${curve}"/>${stops}</svg></div>`;
		}
		const barSet = [
			[4, 22],
			[30, 26],
			[62, 18],
		];
		const lanes = [0, 1, 2, 3]
			.map((lane) => {
				const blocks = barSet
					.map(
						([offset, span], index) =>
							`<span class="pe-pic-bar pe-tone-${((lane + index) % 4) + 1}" style="left:${offset + lane * 3}%;width:${span}%"></span>`,
					)
					.join('');
				return `<div class="pe-pic-lane"><span class="pe-pic-who"></span>${blocks}</div>`;
			})
			.join('');
		return `<div class="pe-pic pe-pic-board">${lanes}</div>`;
	}

	/* Scrolls the mock's own viewport to a section; the page stays put. */
	function scrollPreviewTo(id) {
		const slot = pick(`[data-pe-slot="${id}"]`, ui.canvas);
		if (!slot) return;
		const offset = slot.getBoundingClientRect().top - ui.viewport.getBoundingClientRect().top;
		ui.viewport.scrollTo({
			top: offset + ui.viewport.scrollTop - 12,
			behavior: prefersStill() ? 'auto' : 'smooth',
		});
	}

	/**
	 * Desktop mode lays the site out at a true desktop width and zooms it
	 * down to the card; phone mode draws it at its natural size.
	 */
	function scalePreview() {
		const available = ui.viewport.clientWidth;
		const shrink = editorState.mode === 'desktop' && available < desktopCanvas;
		ui.canvas.style.width = shrink ? `${desktopCanvas}px` : '';
		ui.canvas.style.zoom = shrink ? String(available / desktopCanvas) : '';
	}

	function switchDevice(mode) {
		editorState.mode = mode;
		ui.frame.classList.toggle('is-phone', mode === 'phone');
		scalePreview();
		if (editorState.expanded) scrollPreviewTo(editorState.expanded);
	}

	/* Page settings read as a summary until Edit swaps in the form. */

	function settingsField(name) {
		return pick(`[data-pe-s="${name}"]`, ui.form);
	}

	function audienceRadio(choice) {
		return `<div class="form-check"><input class="form-check-input" type="radio" id="pe-vis-${choice.value}" name="peVisibility" value="${choice.value}" aria-describedby="pe-vis-note-${choice.value}"><label class="form-check-label" for="pe-vis-${choice.value}">${choice.title}</label><p class="pe-hint" id="pe-vis-note-${choice.value}">${choice.detail}</p></div>`;
	}

	/** A search-engine style result for the given title and description. */
	function searchResult(title, description) {
		const crumbs = record.path
			.split('/')
			.filter(Boolean)
			.map((part) => ` › ${part}`)
			.join('');
		const descriptionClass = description ? '' : ' pe-snippet-desc-none';
		const descriptionText = description ? trimTo(description, searchLimits.longest) : 'No description yet.';
		return (
			`<span class="pe-snippet-site"><span class="pe-snippet-icon" aria-hidden="true">F</span><span class="pe-snippet-name">Fieldline<span class="pe-snippet-url">${htmlSafe(domain + crumbs)}</span></span></span>` +
			`<span class="pe-snippet-title">${htmlSafe(trimTo(title || record.title, searchLimits.title))}</span>` +
			`<span class="pe-snippet-desc${descriptionClass}">${htmlSafe(descriptionText)}</span>`
		);
	}

	/* Cuts at the last whole word that fits and adds an ellipsis. */
	function trimTo(text, limit) {
		if (text.length <= limit) return text;
		return `${text.slice(0, limit - 1).replace(/\s+\S*$/, '')} …`;
	}

	function paintFacts() {
		const menuArea = menuSection(record.section);
		const audience = audiences.find((choice) => choice.value === record.visibility);
		const fullAddress = htmlSafe(domain + record.path);
		const rows = {
			Address: `<span class="pe-address-line">${fullAddress}<button type="button" class="btn btn-icon btn-sm pe-copy" data-basalt-copy="https://${fullAddress}" data-bs-title="Copy address" aria-label="Copy address"><i class="bi bi-copy" aria-hidden="true"></i></button></span>`,
			Section: sectionPill(menuArea) + (record.inMenu ? '' : '<span class="pe-meta">Not in the site menu</span>'),
			'Who can open it': `${htmlSafe(audience.title)}<span class="pe-meta">${htmlSafe(audience.detail)}</span>`,
			Owner: `<span class="pe-who">${avatarChip(record.owner)}<span><a class="pe-link" href="employee-user-details.html">${htmlSafe(record.owner)}</a><span class="pe-meta">${htmlSafe(ownerRole)}</span></span></span>`,
			Created: longDate(record.created),
		};

		ui.result.innerHTML = searchResult(record.seo.title, record.seo.desc);
		ui.facts.innerHTML = Object.entries(rows)
			.map(([term, detail]) => `<div class="pe-facts-row"><dt>${term}</dt><dd>${detail}</dd></div>`)
			.join('');
		window.Basalt.avatars?.(ui.facts);
		window.Basalt.buttons?.(ui.facts);
	}

	/* Live character counts; the description is also flagged when short. */
	function updateCounters() {
		const titleLength = settingsField('seoTitle').value.trim().length;
		const descriptionLength = settingsField('seoDesc').value.trim().length;
		const titleCount = pick('[data-pe-count="title"]', ui.form);
		const descriptionCount = pick('[data-pe-count="desc"]', ui.form);

		titleCount.textContent = `${titleLength} / ${searchLimits.title}`;
		descriptionCount.textContent = `${descriptionLength} / ${searchLimits.longest}`;
		titleCount.classList.toggle('is-over', titleLength > searchLimits.title);
		const tooShort = descriptionLength > 0 && descriptionLength < searchLimits.shortest;
		descriptionCount.classList.toggle('is-over', descriptionLength > searchLimits.longest || tooShort);
	}

	function beginSettings() {
		const values = { title: record.title, path: record.path, seoTitle: record.seo.title, seoDesc: record.seo.desc };
		for (const [name, value] of Object.entries(values)) settingsField(name).value = value;
		settingsField('inMenu').checked = record.inMenu;
		settingsField('section').value = record.section;
		window.Basalt.select?.refresh?.(settingsField('section'));

		for (const radio of pickAll('input[name="peVisibility"]', ui.form))
			radio.checked = radio.value === record.visibility;
		for (const flagged of pickAll('.is-invalid', ui.form)) flagged.classList.remove('is-invalid');

		updateCounters();
		ui.summaryView.hidden = true;
		ui.form.hidden = false;
		ui.editButton.hidden = true;
		settingsField('title').focus();
	}

	function endSettings() {
		ui.form.hidden = true;
		ui.summaryView.hidden = false;
		ui.editButton.hidden = false;
	}

	/**
	 * Validates the settings form and, when it passes, writes it back into
	 * the record, logs the change and redraws every part that shows it.
	 */
	function commitSettings(event) {
		event.preventDefault();
		const title = settingsField('title').value.trim();
		const path = `/${settingsField('path')
			.value.trim()
			.replace(/^\/+|\/+$/g, '')}`;
		const seoTitle = settingsField('seoTitle').value.trim();
		const seoDesc = settingsField('seoDesc').value.trim();

		const problems = [
			['title', !title],
			['path', !/^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(path)],
			['seoTitle', !seoTitle || seoTitle.length > searchLimits.title],
			['seoDesc', seoDesc.length < searchLimits.shortest || seoDesc.length > searchLimits.longest],
		];
		for (const [name, failed] of problems) settingsField(name).classList.toggle('is-invalid', failed);
		const firstFailure = problems.find(([, failed]) => failed);
		if (firstFailure) {
			settingsField(firstFailure[0]).focus();
			return;
		}

		const relocated = path !== record.path;
		const audience = pick('input[name="peVisibility"]:checked', ui.form)?.value || record.visibility;
		Object.assign(record, {
			title,
			path,
			section: settingsField('section').value,
			inMenu: settingsField('inMenu').checked,
			visibility: audience,
			seo: { title: seoTitle, desc: seoDesc },
			edited: demoDate,
		});
		record.changes.unshift([
			signedIn,
			relocated ? `Moved the page to ${path}` : 'Changed the page settings',
			demoDate,
		]);

		endSettings();
		paintFacts();
		paintHeader();
		paintPreview();
		paintHistory();
		ui.editButton.focus();
		notify({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'Settings saved',
			text: relocated
				? `Visitors to the old address are sent to ${domain}${path}.`
				: 'Search engines pick up the change on their next visit.',
		});
	}

	/* Visits and the change log sit at the foot of the page. */

	/**
	 * Thirty days of visits ending yesterday. The demo shares the period's
	 * total across a weekday-heavy curve; a real install passes the days.
	 */
	function visitsByDay() {
		const anchor = localDay(demoDate);
		const dailyRows = Array.from({ length: 30 }, (_, index) => {
			const back = 29 - index;
			const date = new Date(anchor);
			date.setDate(anchor.getDate() - 1 - back);
			const offDay = date.getDay() === 0 || date.getDay() === 6;
			const weight = (offDay ? 0.45 : 1) * (0.88 + 0.24 * ((29 - back) / 29)) * (1 + 0.08 * Math.sin(back * 1.7));
			return { date, weight };
		});

		const totalWeight = dailyRows.reduce((sum, day) => sum + day.weight, 0);
		let leftover = record.visits;
		for (const day of dailyRows.slice(0, -1)) {
			day.count = Math.round((record.visits * day.weight) / totalWeight);
			leftover -= day.count;
		}
		dailyRows[dailyRows.length - 1].count = leftover;
		return dailyRows;
	}

	function paintTraffic() {
		const hasVisits = record.status === 'published' && record.visits > 0;
		ui.exits.hidden = !hasVisits || !record.next.length;
		pick('#pe-next-title', shell).hidden = ui.exits.hidden;

		if (!hasVisits) {
			ui.trafficNote.textContent =
				record.status === 'published'
					? 'No visits yet.'
					: 'Not on the site yet, so there are no visits to count.';
			ui.chart.innerHTML = window.Basalt.emptyState({
				icon: 'graph-up',
				title: 'No visits yet',
				text: 'Visits show here once the page is live.',
			});
			ui.exits.innerHTML = '';
			return;
		}

		const dailyRows = visitsByDay();
		const peak = Math.max(...dailyRows.map((day) => day.count));
		const busiest = dailyRows.reduce((top, day) => (day.count > top.count ? day : top));
		const changeNote =
			record.change === 0
				? 'the same as the 30 days before.'
				: `${record.change > 0 ? 'up ' : 'down '}${Math.abs(record.change)}% on the 30 days before.`;
		ui.trafficNote.innerHTML = `<strong>${formatCount(record.visits)}</strong> visits, ${changeNote}`;

		const barSet = dailyRows
			.map((day) => {
				const offDay = day.date.getDay() === 0 || day.date.getDay() === 6;
				const barHeight = Math.max(6, Math.round((day.count / peak) * 100));
				return `<span class="${offDay ? 'is-weekend' : ''}" style="height:${barHeight}%" title="${monthDay(day.date)}: ${formatCount(day.count)} visits"></span>`;
			})
			.join('');
		const summary = `Visits a day over the last 30 days, most on ${monthDay(busiest.date)} with ${formatCount(busiest.count)}`;
		ui.chart.innerHTML =
			`<div class="pe-spark-bars" role="img" aria-label="${summary}">${barSet}</div>` +
			`<div class="pe-spark-axis" aria-hidden="true"><span>${monthDay(dailyRows[0].date)}</span><span>Weekends lighter</span><span>${monthDay(dailyRows[29].date)}</span></div>`;

		ui.exits.innerHTML = record.next
			.slice()
			.sort((one, other) => other[1] - one[1])
			.map(
				([label, share], index) =>
					`<li class="pe-bars-row pe-tone-${index + 1}"><span class="pe-bars-name">${htmlSafe(label)}</span><span class="pe-bars-track" aria-hidden="true"><span style="width:${share}%"></span></span><span class="pe-bars-value">${share}%</span></li>`,
			)
			.join('');
	}

	function paintHistory() {
		ui.log.innerHTML = record.changes
			.slice(0, historyLength)
			.map(([who, what, when]) => {
				const youTag = who === signedIn ? '<span class="pe-you">You</span>' : '';
				return `<tr><td class="pe-col-when">${shortDate(when)}</td><td>${htmlSafe(what)}</td><td class="pe-col-who"><span class="pe-who">${avatarChip(who)}<span>${htmlSafe(who)}${youTag}</span></span></td></tr>`;
			})
			.join('');
		window.Basalt.avatars?.(ui.log);
	}

	/* Publishing, reverting and going live each offer an Undo. */

	/* Finds the first section with a required field left blank. */
	function firstMissingField() {
		for (const block of record.blocks) {
			const key = kindOf(block).mustFill.find((name) => !String(block.data[name] || '').trim());
			if (key) return { block, key };
		}
		return null;
	}

	function publishPending() {
		const missing = firstMissingField();
		if (missing) {
			if (editorState.expanded !== missing.block.id) openOrClose(missing.block.id, { keep: true });
			const fieldEl = pick(`#${fieldId(missing.block, missing.key)}`, ui.list);
			if (!fieldEl) return;
			fieldEl.classList.add('is-invalid');
			fieldEl.focus();
			fieldEl.scrollIntoView({ block: 'center', behavior: prefersStill() ? 'auto' : 'smooth' });
			return;
		}

		const liveNow = record.status === 'published';
		const waitingCount = countPending();
		const priorState = { live: liveBlocks, edited: record.edited, changes: record.changes.slice() };
		liveBlocks = deepCopy(record.blocks);
		record.edited = demoDate;
		record.changes.unshift([
			signedIn,
			`${liveNow ? 'Published' : 'Saved'} changes to ${countPhrase(waitingCount, 'section')}`,
			demoDate,
		]);
		paintHeader();
		paintHistory();
		ui.publish.blur();

		function undo() {
			liveBlocks = priorState.live;
			record.edited = priorState.edited;
			record.changes = priorState.changes;
			paintHeader();
			paintHistory();
		}
		notify({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: liveNow ? 'Changes are live' : 'Draft saved',
			text: liveNow
				? `Visitors to ${domain}${record.path} see them now.`
				: 'Only the team can see the page until it is published.',
			actions: [{ label: 'Undo', onClick: undo }],
		});
	}

	function revertPending() {
		const edits = record.blocks;
		record.blocks = deepCopy(liveBlocks);
		editorState.expanded = null;
		repaintAll();

		function undo() {
			record.blocks = edits;
			repaintAll();
		}
		notify({
			tone: 'success',
			icon: 'bi-arrow-counterclockwise',
			title: 'Changes discarded',
			text: 'The editor shows what is live again.',
			actions: [{ label: 'Undo', onClick: undo }],
		});
	}

	function flipLive() {
		const priorStatus = record.status;
		const goingLive = priorStatus !== 'published';
		record.status = goingLive ? 'published' : 'draft';
		record.edited = demoDate;
		record.changes.unshift([signedIn, goingLive ? 'Published the page' : 'Took the page off the site', demoDate]);
		if (goingLive) liveBlocks = deepCopy(record.blocks);
		paintHeader();
		paintHistory();

		function undo() {
			record.status = priorStatus;
			record.changes.shift();
			paintHeader();
			paintHistory();
		}
		notify({
			tone: 'success',
			icon: goingLive ? 'bi-send' : 'bi-eye-slash',
			title: goingLive ? 'The page is live' : 'The page is unpublished',
			text: goingLive ? `It is on ${domain}${record.path} now.` : 'It is off the site and back with the drafts.',
			actions: [{ label: 'Undo', onClick: undo }],
		});
	}

	/* Lookups and formatting used throughout the file. */

	function gatherParts(selectors) {
		const collected = {};
		for (const [key, selector] of Object.entries(selectors)) collected[key] = pick(selector, shell);
		return collected;
	}

	/* The change log always closes with the day the page was created. */
	function appendCreation() {
		const oldest = record.changes[record.changes.length - 1];
		if (/^(Created|Started) the page$/.test(oldest[1])) return;
		record.changes.push([record.owner, 'Created the page', record.created]);
	}

	function findBlock(id) {
		return record.blocks.find((block) => block.id === id);
	}

	function kindOf(block) {
		return kinds[block.type];
	}

	function menuSection(id) {
		return menuSections.find((entry) => entry.id === id) || menuSections[0];
	}

	function avatarChip(name) {
		return `<span class="basalt-avatar basalt-avatar-xs" data-basalt-avatar data-name="${htmlSafe(name)}" aria-hidden="true"></span>`;
	}

	function notify(message) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(message) : null;
	}

	function prefersStill() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function deepCopy(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
	}

	function formatCount(value) {
		return Number(value || 0).toLocaleString('en-US');
	}

	/** "three sections", "one item", "no questions". */
	function countPhrase(count, singular, plural) {
		const noun = count === 1 ? singular : plural || `${singular}s`;
		return `${numberWords[count] || count} ${noun}`;
	}

	function upperFirst(text) {
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	function localDay(iso) {
		return window.Basalt.toLocalDay(iso);
	}

	function monthDay(date) {
		return `${monthAbbr[date.getMonth()]} ${date.getDate()}`;
	}

	/* "Today", "Oct 6", or "Mar 4, 2024" when the year differs. */
	function shortDate(iso) {
		if (iso === demoDate) return 'Today';
		const date = localDay(iso);
		const yearSuffix = iso.slice(0, 4) === demoDate.slice(0, 4) ? '' : `, ${date.getFullYear()}`;
		return `${monthDay(date)}${yearSuffix}`;
	}

	function longDate(iso) {
		const date = localDay(iso);
		return `${monthDay(date)}, ${date.getFullYear()}`;
	}

	/** Rebuilds rich text from safeTags only, escaping every text node. */
	function sanitizeRich(html) {
		const parsedDoc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
		return rebuildNodes(parsedDoc.body.firstChild);
	}

	function rebuildNodes(parent) {
		let markupSoFar = '';
		for (const node of parent.childNodes) {
			if (node.nodeType === Node.TEXT_NODE) {
				markupSoFar += htmlSafe(node.textContent);
				continue;
			}
			if (node.nodeType !== Node.ELEMENT_NODE) continue;
			const tag = safeTags[node.tagName];
			if (!tag) markupSoFar += rebuildNodes(node);
			else markupSoFar += tag === 'br' ? '<br>' : `<${tag}>${rebuildNodes(node)}</${tag}>`;
		}
		return markupSoFar;
	}

	function textOf(html) {
		return new DOMParser().parseFromString(html, 'text/html').body.textContent.trim();
	}

	start();

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
