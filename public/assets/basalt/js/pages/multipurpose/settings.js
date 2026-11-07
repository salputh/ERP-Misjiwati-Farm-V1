/**
 * Behavior for the shop settings screen, settings.html, which marks its
 * content with [data-cfg-root].
 *
 * The lists here (people, invites, keys, webhook addresses, devices,
 * backups and invoices) come from a seeded generator, so a visit always
 * shows the same rows and nothing goes over the network. Tabs, drawers,
 * dialogs, toasts, pagers, tag inputs and the command menu belong to
 * basalt.js; this script only fills them and reacts to their events.
 *
 * Edits to a form field are held back: the save bar counts them, the
 * section tab gets a dot, and Save or Discard settle them with an Undo.
 * Actions that apply at once (an invite, a deleted key, a test send)
 * bypass the save bar and answer with a toast.
 */
(() => {
	'use strict';

	/* The demo clock is fixed at 2:05 PM Eugene time on Sep 29, 2026. */
	const DEMO_NOW = Date.UTC(2026, 8, 29, 21, 5);
	const OWNER = 'Elaine Gill';
	const FIRST_SHOWN = 'set:firstshow';
	const random = seededRandom(7614);

	const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	const SPINNER = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>';
	const TOGGLES = new Set(['checkbox', 'radio']);
	const SKIPPED_TYPES = new Set(['search', 'file', 'button']);

	const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
	const GIVEN = [
		'Jonah',
		'Lindsay',
		'Stanley',
		'Dawn',
		'Isaac',
		'Hope',
		'Theo',
		'Robyn',
		'Kirk',
		'Carly',
		'Earl',
		'Abby',
		'Ben',
		'Sandra',
		'Ruth',
		'Randall',
		'Elsa',
	];
	const FAMILY = [
		'Price',
		'Volk',
		'Zeller',
		'Fischer',
		'Hanson',
		'Stout',
		'Walsh',
		'Monroe',
		'Mathis',
		'McKay',
		'Buchanan',
		'Kimura',
		'Hart',
		'Bledsoe',
		'Leach',
		'Roach',
		'Kerr',
	];
	const SEAT_ROLES = [...Array(3).fill('Admin'), ...Array(9).fill('Staff'), ...Array(5).fill('Packer')];
	const STAFF_ROLES = ['Admin', 'Staff', 'Packer'];

	const TIERS = {
		Basic: { monthly: 29, orderCap: 500, seats: 3 },
		Pro: { monthly: 79, orderCap: 3000, seats: 20 },
		Max: { monthly: 199, orderCap: Infinity, seats: Infinity },
	};
	const RATES = { USD: 1, CAD: 1.37, EUR: 0.92, GBP: 0.79, JPY: 149 };
	const CARD_BRANDS = { 3: 'Amex', 5: 'Mastercard' };
	const KEY_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	const TOPICS = {
		'Order placed': 'order.placed',
		'Order shipped': 'order.shipped',
		'Refund issued': 'refund.issued',
		'Stock low': 'stock.low',
		'Subscription renewed': 'subscription.renewed',
	};
	const DNS_RECORDS = [
		{ kind: 'TXT', host: '@', target: 'v=spf1 include:mail.basaltsend.com ~all', found: true },
		{ kind: 'CNAME', host: 'bm1._domainkey', target: 'bm1.dkim.basaltsend.com', found: false },
		{ kind: 'TXT', host: '_dmarc', target: 'v=DMARC1; p=none; rua=mailto:dmarc@marlo.com', found: true },
	];

	let page = null;
	const shop = {
		dkimReady: false,
		dnsRuns: 0,
		card: { brand: 'Visa', lastFour: '4242', expiry: '11/26', expiringSoon: true },
		plan: { tier: 'Pro', billing: 'month' },
		members: [],
		pendingInvites: [],
		apiKeys: [],
		endpoints: [],
		snapshots: [],
		sessions: [],
	};

	/* Each tracked field mapped to its last saved value. */
	const baseline = new Map();
	let editedFields = [];

	function start() {
		page = pick('[data-cfg-root]');
		if (!page) return;
		/* The save bar and every drawer footer sit at the bottom, so toasts drop in from the top. */
		window.Basalt.toasts?.position('top-end');

		/* The first four draw from the seeded generator; their order fixes the demo rows. */
		const mounts = [
			mountBackups,
			mountTeam,
			mountWebhooks,
			mountApiKeys,
			mountGeneral,
			mountRegion,
			mountBranding,
			mountEmail,
			mountAlerts,
			mountBilling,
			mountSecurity,
			mountAdvanced,
			mountSectionNav,
			mountFinder,
			mountSaveBar,
		];
		for (const mount of mounts) mount();

		rememberFields(page);
		mountSettingsDownload();
		countEdits();

		/* Whichever section is open on arrival has, by definition, been shown. */
		const openPanel = pick('[data-cfg-pane].active', page);
		if (openPanel) markShown(openPanel.getAttribute('data-cfg-pane'));
	}

	/* Small DOM and text helpers shared by every section. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function prefersStill() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function smoothness() {
		return prefersStill() ? 'auto' : 'smooth';
	}

	/** Resolves after `ms`, capped at a quarter second when motion is reduced. */
	function pause(ms) {
		const delay = prefersStill() ? Math.min(ms, 250) : ms;
		return new Promise((resolve) => setTimeout(resolve, delay));
	}

	function htmlSafe(text) {
		return String(text).replace(/[&<>"']/g, (char) => ENTITIES[char]);
	}

	function notify(options) {
		return window.Basalt.toasts?.push(options) ?? null;
	}

	function announce(message) {
		window.Basalt.announce?.(message);
	}

	function buttonPhase(button, phase, label) {
		window.Basalt.buttonState?.(button, phase, label);
	}

	function enhanceButtons(scope) {
		window.Basalt.buttons?.(scope);
	}

	function markShown(key) {
		page.dispatchEvent(new CustomEvent(FIRST_SHOWN, { detail: { key } }));
	}

	/** "1 change", "3 changes", or the irregular plural when one is given. */
	function quantity(amount, singular, pluralForm) {
		return `${amount} ${amount === 1 ? singular : pluralForm || `${singular}s`}`;
	}

	/** Joins words the way a sentence would: "a, b and c". */
	function sentenceList(items) {
		if (items.length < 2) return items.join('');
		const last = items[items.length - 1];
		return `${items.slice(0, -1).join(', ')} and ${last}`;
	}

	function searchTerms(text) {
		return text.trim().toLowerCase().split(/\s+/).filter(Boolean);
	}

	function monogram(wholeName) {
		return wholeName
			.split(/\s+/)
			.map((part) => part[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	function looksLikeEmail(text) {
		return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text);
	}

	function readableSize(bytes) {
		if (bytes < 1024) return `${bytes} bytes`;
		return `${(bytes / 1024).toFixed(1)} KB`;
	}

	/** A small, repeatable number source (mulberry32) so every visit gets the same rows. */
	function seededRandom(seed) {
		let cursor = seed >>> 0;
		return function nextFloat() {
			cursor = (cursor + 0x6d2b79f5) >>> 0;
			let mixed = Math.imul(cursor ^ (cursor >>> 15), cursor | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	function anyOf(choices) {
		return choices[Math.floor(random() * choices.length)];
	}

	/**
	 * Hands the visitor a file built in the browser.
	 * @returns {number} The size of the file in bytes.
	 */
	function offerFile(fileName, contents, mime) {
		const file = new Blob([contents], { type: mime || 'text/plain' });
		const href = URL.createObjectURL(file);
		const link = Object.assign(document.createElement('a'), { href, download: fileName });
		document.body.append(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(href), 1000);
		return file.size;
	}

	/** Animates every bar in `scope` out to the percentage held in `attribute`. */
	function widenBars(scope, attribute) {
		return requestAnimationFrame(() => {
			for (const bar of pickAll(`[${attribute}]`, scope)) bar.style.width = `${bar.getAttribute(attribute)}%`;
		});
	}

	/* Markup pieces that several lists build the same way. */

	function iconTag(classes) {
		return `<i class="bi ${classes}" aria-hidden="true"></i>`;
	}

	function hiddenText(text) {
		return `<span class="visually-hidden">${text}</span>`;
	}

	/** A status pill; `modifiers` is a space-separated list such as "success dot". */
	function badge(modifiers, text, glyphName) {
		const extra = modifiers
			.split(' ')
			.filter(Boolean)
			.map((name) => ` basalt-status-${name}`)
			.join('');
		return `<span class="basalt-status${extra}">${glyphName ? iconTag(glyphName) : ''}${text}</span>`;
	}

	/** A button that asks for a second click before it acts. */
	function confirmButton(variant, hook, idleHtml, askText = 'Click again') {
		return (
			`<button type="button" class="btn ${variant} btn-sm btn-confirm" data-basalt-confirm ${hook}>` +
			`<span class="btn-confirm-idle">${idleHtml}</span><span class="btn-confirm-ask">${askText}</span></button>`
		);
	}

	/** A button with one labeled state per phase (idle, busy, done, fail). */
	function loadingButton(classes, hook, phases) {
		const states = Object.entries(phases)
			.map(([phase, inner]) => `<span class="btn-loading-state btn-loading-${phase}">${inner}</span>`)
			.join('');
		return `<button type="button" class="${classes}" ${hook}>${states}</button>`;
	}

	/** One row of a card list: icon, title, sub line, optional actions. */
	function listRow({ iconName: glyphName, title, sub, subClass = '', extra = '', actions = '', tail = '' }) {
		return (
			`<li class="cfg-row"><span class="cfg-row-icon" aria-hidden="true"><i class="bi ${glyphName}"></i></span>` +
			`<div class="cfg-row-main"><p class="cfg-row-title">${title}</p><p class="cfg-row-sub${subClass}">${sub}</p>${extra}</div>` +
			`${actions ? `<div class="cfg-row-actions">${actions}</div>` : ''}${tail}</li>`
		);
	}

	/** Rows of checkboxes, one column per entry in each row's `cells`. */
	function checkboxGrid(rows, idPrefix, captionFor) {
		return rows
			.map(({ title, hint, cells }, row) => {
				const rowHeader = `<th scope="row">${htmlSafe(title)}${hint ? `<span class="cfg-sub">${htmlSafe(hint)}</span>` : ''}</th>`;
				const boxes = cells.map(
					(ticked, column) =>
						`<td><input class="form-check-input" type="checkbox" id="${idPrefix}-${row}-${column}" aria-label="${captionFor(title, column)}"${ticked ? ' checked' : ''}></td>`,
				);
				return `<tr>${rowHeader}${boxes.join('')}</tr>`;
			})
			.join('');
	}

	/* Sections: the tab list, the phone picker, the filter and #hash links. */

	function tabButton(key) {
		return pick(`[data-cfg-tab="${key}"]`, page);
	}

	function panel(key) {
		return pick(`[data-cfg-pane="${key}"]`, page);
	}

	function sectionTitle(key) {
		const tab = tabButton(key);
		return tab ? pick('.basalt-tabs-text > span', tab).textContent.trim() : key;
	}

	function openSection(key) {
		const tab = tabButton(key);
		if (tab && window.bootstrap) bootstrap.Tab.getOrCreateInstance(tab).show();
	}

	/** Opens a section, then scrolls to and highlights one thing inside it. */
	function reveal(key, target) {
		const pane = panel(key);
		if (!pane) return;
		if (pane.classList.contains('active')) {
			landOn(pane, target);
			return;
		}
		tabButton(key).addEventListener('shown.bs.tab', () => setTimeout(() => landOn(pane, target), 60), {
			once: true,
		});
		openSection(key);
	}

	function landOn(pane, target) {
		const spot = typeof target === 'string' ? pick(target, pane) || pick(target) : target;
		(spot || pane).scrollIntoView({ block: spot ? 'center' : 'start', behavior: smoothness() });
		if (!spot) {
			pane.focus({ preventScroll: true });
			return;
		}
		flash(spot.closest('.cfg-switch, .cfg-row, .cfg-inline-field, .cfg-fields > div, .cfg-card') || spot);
		focusInside(spot);
	}

	function flash(element) {
		element.classList.remove('cfg-flash');
		void element.offsetWidth;
		element.classList.add('cfg-flash');
		setTimeout(() => element.classList.remove('cfg-flash'), 1700);
	}

	function focusInside(spot) {
		let control = spot.matches('textarea, select, input, button, a[href], [tabindex]')
			? spot
			: pick('textarea, select, input, button', spot);
		/* A card heading is no control, but focusing it lets the next Tab continue inside that card. */
		if (!control || spot.matches('h2, h3')) {
			spot.tabIndex = -1;
			control = spot;
		}
		/* Styled selects hide the native element, so their visible button takes focus. */
		const visible = control.offsetParent ? control : control.parentElement && pick('button', control.parentElement);
		if (visible) visible.focus({ preventScroll: true });
	}

	function mountSectionNav() {
		const tabs = pickAll('[data-cfg-tab]', page);
		const picker = pick('[data-cfg-jump]', page);
		const filterBox = pick('[data-cfg-filter]', page);
		const tally = pick('[data-cfg-filter-count]', page);
		const noMatch = pick('[data-cfg-filter-none]', page);
		const seen = new Set();

		for (const tab of tabs) {
			tab.addEventListener('shown.bs.tab', () => {
				const key = tab.getAttribute('data-cfg-tab');
				if (picker && picker.value !== key) {
					picker.value = key;
					window.Basalt.select?.refresh(picker);
				}
				history.replaceState?.(null, '', `#${key}`);
				if (seen.has(key)) return;
				seen.add(key);
				markShown(key);
			});
		}

		picker?.addEventListener('change', () => {
			openSection(picker.value);
			const paneColumn = pick('[data-cfg-panels]', page);
			if (paneColumn && window.innerWidth < 992)
				paneColumn.scrollIntoView({ block: 'start', behavior: smoothness() });
		});

		/* A section survives the filter when its name or any setting inside it matches every word. */
		const haystacks = new Map(tabs.map((tab) => [tab, sectionWords(tab)]));

		function applyFilter() {
			const terms = searchTerms(filterBox.value);
			const matching = [];
			for (const tab of tabs) {
				tab.hidden = !terms.every((term) => haystacks.get(tab).includes(term));
				if (!tab.hidden) matching.push(tab);
			}
			tally.textContent = filterSummary(terms.length, matching.length);
			noMatch.hidden = matching.length > 0;
			const current = tabs.find((tab) => tab.classList.contains('active'));
			if (matching.length && current?.hidden) openSection(matching[0].getAttribute('data-cfg-tab'));
			pick('[data-basalt-tabs]', page)?.basaltTabs?.refresh();
		}

		filterBox.addEventListener('input', applyFilter);
		filterBox.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter') return;
			event.preventDefault();
			const firstVisible = tabs.find((tab) => !tab.hidden);
			if (!firstVisible) return;
			openSection(firstVisible.getAttribute('data-cfg-tab'));
			firstVisible.focus();
		});
		pick('[data-cfg-filter-clear]', page).addEventListener('click', () => {
			filterBox.value = '';
			applyFilter();
			filterBox.focus();
		});

		/* settings.html#billing and friends open straight on that section. */
		const wanted = location.hash.slice(1);
		if (wanted && tabButton(wanted)) openSection(wanted);
	}

	function sectionWords(tab) {
		const pane = panel(tab.getAttribute('data-cfg-tab'));
		const labels = pickAll(
			'.cfg-card-title, .form-label, legend, .cfg-switch-title, .cfg-card-desc, .cfg-danger-name, th',
			pane,
		);
		return [tab, ...labels]
			.map((node) => node.textContent.trim())
			.join(' ')
			.toLowerCase()
			.replace(/\s+/g, ' ');
	}

	function filterSummary(termCount, hits) {
		if (!termCount) return '12 sections';
		if (!hits) return 'No sections match';
		return `${quantity(hits, 'section')} ${hits === 1 ? 'matches' : 'match'}`;
	}

	/* Held-back edits: which fields changed, the tab dots, the save bar, Undo. */

	function currentValue(field) {
		return TOGGLES.has(field.type) ? field.checked : field.value;
	}

	function putValue(field, value) {
		/* Unticking a radio is a no-op; ticking its partner already did the work. */
		if (field.type === 'radio' && !value) return;
		if (TOGGLES.has(field.type)) {
			field.checked = value;
		} else if (field.hasAttribute('data-basalt-tags-value')) {
			field.value = value;
			pick('[data-basalt-tags]', field.parentElement)?.basaltTags?.set(value ? value.split(',') : []);
			return;
		} else {
			field.value = value;
		}
		field.dispatchEvent(new Event('change', { bubbles: true }));
		if (field.classList.contains('basalt-stepper-input')) field.dispatchEvent(new Event('blur'));
	}

	function isTrackable(field) {
		if (field.hasAttribute('data-cfg-ignore') || field.classList.contains('basalt-tags-input')) return false;
		if (SKIPPED_TYPES.has(field.type)) return false;
		/* Hidden inputs only count when they mirror a tag list. */
		if (field.type === 'hidden') return field.hasAttribute('data-basalt-tags-value');
		/* An unnamed text-like input is a helper, not a setting. */
		return !(field.tagName === 'INPUT' && field.type !== 'checkbox' && !field.id && !field.name);
	}

	function rememberFields(scope) {
		for (const form of pickAll('[data-cfg-form]', scope || page)) {
			for (const field of pickAll('select, textarea, input', form)) {
				if (isTrackable(field) && !baseline.has(field)) baseline.set(field, currentValue(field));
			}
		}
	}

	/** The words a person would use for a field: its label, legend or card title. */
	function describeField(field) {
		if (field.id) {
			const forLabel = pick(`label[for="${field.id}"]`);
			if (forLabel) return forLabel.textContent.replace(/\s+/g, ' ').trim().replace(/ New$/, '');
			const chips = field.parentElement && pick('[data-basalt-tags] .basalt-tags-input', field.parentElement);
			const chipsLabel = chips && pick(`label[for="${chips.id}"]`);
			if (chipsLabel) return chipsLabel.textContent.trim();
		}
		const aria = field.getAttribute('aria-label');
		if (aria) return aria;
		const legend = field.closest('fieldset')?.querySelector('legend');
		if (legend) return legend.textContent.trim();
		const group = field.closest('[role="radiogroup"]');
		if (group) return group.getAttribute('aria-label');
		const card = field.closest('.cfg-card');
		return card ? pick('.cfg-card-title', card).textContent.trim() : 'A setting';
	}

	function sectionOf(field) {
		return field.closest('[data-cfg-pane]')?.getAttribute('data-cfg-pane') ?? '';
	}

	/** A radio group, or a row of day or export boxes, counts as one change. */
	function editKey(field) {
		if (field.type === 'radio') return `r:${field.name}`;
		if (field.closest('[data-cfg-days], [data-cfg-export-what]')) return `g:${describeField(field)}`;
		return field;
	}

	/**
	 * Re-reads every tracked field, refreshes the tab dots and the save bar.
	 * @returns {HTMLElement[]} One field per distinct change.
	 */
	function countEdits() {
		editedFields = [...baseline]
			.filter(([field, saved]) => field.isConnected && currentValue(field) !== saved)
			.map(([field]) => field);

		const byKey = new Map();
		for (const field of editedFields) {
			const key = editKey(field);
			if (!byKey.has(key)) byKey.set(key, field);
		}
		const changes = [...byKey.values()];
		const sections = [...new Set(changes.map(sectionOf))].filter(Boolean);

		for (const tab of pickAll('[data-cfg-tab]', page))
			markTab(tab, sections.includes(tab.getAttribute('data-cfg-tab')));

		const bar = pick('[data-cfg-savebar]', page);
		bar.hidden = !changes.length;
		if (changes.length) {
			pick('[data-cfg-savebar-text]', bar).textContent =
				`${quantity(changes.length, 'unsaved change')} in ${sentenceList(sections.map(sectionTitle))}`;
		}
		return changes;
	}

	function markTab(tab, edited) {
		const dot = pick('.cfg-tab-dirty', tab);
		if (edited && !dot) {
			tab.insertAdjacentHTML(
				'beforeend',
				'<span class="cfg-tab-dirty"><span class="basalt-tabs-dot" aria-hidden="true"></span><span class="visually-hidden">, unsaved changes</span></span>',
			);
		} else if (!edited && dot) {
			dot.remove();
		}
	}

	function captureValues(fields) {
		return new Map(fields.map((field) => [field, currentValue(field)]));
	}

	function savedValues(fields) {
		return new Map(fields.map((field) => [field, baseline.get(field)]));
	}

	function applyValues(values) {
		for (const [field, value] of values) {
			if (field.isConnected) putValue(field, value);
		}
	}

	function mountSaveBar() {
		page.addEventListener('input', (event) => {
			if (baseline.has(event.target)) countEdits();
		});
		page.addEventListener('change', (event) => {
			if (baseline.has(event.target) || event.target.classList.contains('basalt-tags-input')) countEdits();
		});

		pick('[data-cfg-save]', page).addEventListener('click', saveEdits);
		pick('[data-cfg-discard]', page).addEventListener('click', discardEdits);

		/* Ctrl+S or Cmd+S saves from anywhere while the bar is up. */
		document.addEventListener('keydown', (event) => {
			if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
			if (pick('[data-cfg-savebar]', page).hidden) return;
			event.preventDefault();
			saveEdits();
		});
	}

	function saveEdits() {
		const saveButton = pick('[data-cfg-save]', page);
		const changes = countEdits();
		if (!changes.length || saveButton.classList.contains('is-loading')) return;

		/* Text fields are validated across every section that holds a change. */
		const textFields = [...new Set(changes.map(sectionOf))].flatMap((key) =>
			pickAll(
				'[data-cfg-form] textarea, [data-cfg-form] input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([data-cfg-ignore]):not(.basalt-tags-input)',
				panel(key),
			),
		);
		const invalid = window.Basalt.dialog
			? window.Basalt.dialog.flagFields(textFields)
			: textFields.find((field) => !field.checkValidity());
		if (invalid) {
			buttonPhase(saveButton, 'error');
			reveal(sectionOf(invalid), invalid);
			notify({
				tone: 'danger',
				title: 'Nothing saved yet',
				text: `${describeField(invalid)} needs a look first.`,
			});
			setTimeout(() => buttonPhase(saveButton, 'idle'), 2200);
			return;
		}

		const previous = savedValues(editedFields);
		const incoming = captureValues(editedFields);
		const changeCount = changes.length;
		buttonPhase(saveButton, 'loading');
		pause(800).then(() => {
			for (const [field, value] of incoming) baseline.set(field, value);
			buttonPhase(saveButton, 'success');
			countEdits();
			notify({
				tone: 'success',
				title: `${quantity(changeCount, 'change')} saved`,
				text: 'Everyone on the team sees them within a minute.',
				actions: [{ label: 'Undo', onClick: () => undoSave(previous) }],
			});
			setTimeout(() => buttonPhase(saveButton, 'idle'), 1200);
		});
	}

	function undoSave(previous) {
		applyValues(previous);
		for (const [field, value] of previous) baseline.set(field, value);
		countEdits();
		notify({ tone: 'info', title: 'Put back as it was', duration: 3000 });
	}

	function discardEdits() {
		const unsaved = captureValues(editedFields);
		const saved = savedValues(editedFields);
		window.Basalt.dialog?.clearFlags(page);
		applyValues(saved);
		countEdits();
		notify({
			tone: 'info',
			title: 'Changes discarded',
			actions: [
				{
					label: 'Bring them back',
					onClick: () => {
						applyValues(unsaved);
						countEdits();
					},
				},
			],
		});
	}

	/* The finder: every section, card and labeled setting as one command menu. */

	function commandItem(index, { target, key, keywords, iconClass: glyphClass, label, hint }) {
		return (
			`<div class="basalt-command-item" role="option" id="cfg-find-${index}" aria-selected="false" data-value="${htmlSafe(target)}" data-section="${key}" data-keywords="${htmlSafe(keywords)}">` +
			`<span class="basalt-command-icon" aria-hidden="true"><i class="${htmlSafe(glyphClass)}"></i></span>` +
			`<span class="basalt-command-label">${htmlSafe(label)}</span><span class="basalt-command-hint">${htmlSafe(hint)}</span></div>`
		);
	}

	function finderEntries() {
		const groups = [];
		for (const tab of pickAll('[data-cfg-tab]', page)) {
			const key = tab.getAttribute('data-cfg-tab');
			const pane = panel(key);
			const section = sectionTitle(key);
			const commands = [
				{
					target: `#${pane.id}`,
					key,
					keywords: tab.textContent.trim().toLowerCase(),
					iconClass: pick('i.bi', tab).className,
					label: section,
					hint: 'Section',
				},
			];

			for (const card of pickAll('.cfg-card', pane)) {
				const heading = pick('.cfg-card-title', card);
				if (!heading) continue;
				const cardName = heading.textContent.trim();
				const blurb = pick('.cfg-card-desc', card)?.textContent.trim().toLowerCase() ?? '';
				commands.push({
					target: `#${heading.id}`,
					key,
					keywords: `${section.toLowerCase()} ${blurb}`,
					iconClass: 'bi bi-card-heading',
					label: cardName,
					hint: section,
				});

				for (const caption of pickAll('.form-label[for], .cfg-switch-title[for], legend.form-label', card)) {
					const forId = caption.getAttribute('for');
					commands.push({
						target: forId ? `#${forId}` : `#${heading.id}`,
						key,
						keywords: `${section} ${cardName}`.toLowerCase(),
						iconClass: 'bi bi-dot',
						label: caption.textContent
							.replace(/\s+/g, ' ')
							.replace(/ (optional|New)$/, '')
							.trim(),
						hint: cardName,
					});
				}
			}
			groups.push({ key, section, commands });
		}
		return groups;
	}

	function mountFinder() {
		const dialog = pick('#cfg-find');
		const command = pick('[data-cfg-command]', dialog);
		let index = 0;

		pick('[data-cfg-command-list]', dialog).innerHTML = finderEntries()
			.map(({ key, section, commands }) => {
				const items = commands.map((entry) => commandItem(index++, entry)).join('');
				return `<div class="basalt-command-group" role="group" aria-labelledby="cfg-find-g-${key}"><div class="basalt-command-heading" id="cfg-find-g-${key}">${htmlSafe(section)}</div>${items}</div>`;
			})
			.join('');
		pick('[data-basalt-command-count]', dialog).textContent = quantity(index, 'result');
		window.Basalt.command?.(command);

		/* The jump waits for the dialog to close, so focus can land in the page. */
		let destination = null;
		command.addEventListener('basalt:command', (event) => {
			const { item } = event.detail;
			destination = { key: item.getAttribute('data-section'), target: item.getAttribute('data-value') };
			bootstrap.Modal.getOrCreateInstance(dialog).hide();
		});
		dialog.addEventListener('hidden.bs.modal', () => {
			if (!destination) return;
			const { key, target } = destination;
			destination = null;
			const isWholeSection = target.startsWith('#cfg-') && panel(key).id === target.slice(1);
			reveal(key, isWholeSection ? null : target);
		});
	}

	/* General: character counters and the packing-days sentence. */

	function mountGeneral() {
		for (const counter of pickAll('[data-cfg-count-for]', page)) {
			const source = pick(`#${counter.getAttribute('data-cfg-count-for')}`);
			function showLength() {
				counter.textContent = source.value.length;
			}
			source.addEventListener('input', showLength);
			source.addEventListener('change', showLength);
			showLength();
		}

		const dayBoxes = pick('[data-cfg-days]', page);
		const daySentence = pick('[data-cfg-days-note]', page);
		function describeDays() {
			daySentence.textContent = packingSentence(pickAll('input:checked', dayBoxes).map((box) => box.value));
		}
		dayBoxes.addEventListener('change', describeDays);
		describeDays();
	}

	function packingSentence(checkedDays) {
		if (!checkedDays.length) return 'No packing days checked, so orders would wait. Check at least one.';
		if (checkedDays.length === 7) return 'Packing every day.';
		return `Packing ${sentenceList(collapseRuns(checkedDays))}.`;
	}

	/** Three or more days in a row read as "Monday to Thursday". */
	function collapseRuns(checkedDays) {
		const runs = [];
		for (const day of checkedDays) {
			const run = runs[runs.length - 1];
			if (run && WEEK.indexOf(day) === WEEK.indexOf(run[run.length - 1]) + 1) run.push(day);
			else runs.push([day]);
		}
		return runs.flatMap((run) => (run.length >= 3 ? [`${run[0]} to ${run[run.length - 1]}`] : run));
	}

	/* Region: the live format example and the shop languages. */

	function mountRegion() {
		const zone = pick('#cfg-tz');
		const dateStyle = pick('#cfg-datefmt');
		const currency = pick('#cfg-currency');
		const example = pick('[data-cfg-format-preview]', page);

		function showExample() {
			const locale = dateStyle.value === 'gb' ? 'en-GB' : 'en-US';
			const when = formatMoment(new Date(DEMO_NOW), zone.value, dateStyle.value, locale);
			const price = new Intl.NumberFormat(locale, { currency: currency.value, style: 'currency' }).format(
				1284.5 * (RATES[currency.value] || 1),
			);
			const weight = pick('#cfg-units-oz').checked ? '8.8 oz' : '250 g';
			example.textContent = `${when} · ${price} · ${weight}`;
		}
		for (const select of [zone, dateStyle, currency]) select.addEventListener('change', showExample);
		pick('[data-cfg-units]', page).addEventListener('change', showExample);
		showExample();

		mountLanguages();
	}

	function formatMoment(moment, timeZone, style, locale) {
		if (style !== 'iso') {
			return new Intl.DateTimeFormat(locale, {
				timeZone,
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
			}).format(moment);
		}
		const day = new Intl.DateTimeFormat('en-CA', {
			timeZone,
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
		}).format(moment);
		const clock = new Intl.DateTimeFormat('en-GB', { timeZone, minute: '2-digit', hour: '2-digit' }).format(moment);
		return `${day}, ${clock}`;
	}

	function languageRow({ title, translated, offered, primary }, index) {
		const sub = primary ? 'Main language' : `${translated}% translated`;
		return (
			`<li class="cfg-lang" data-lang="${htmlSafe(title)}">` +
			`<p class="cfg-lang-name">${htmlSafe(title)}<span class="cfg-sub">${sub}</span></p>` +
			`<span class="cfg-lang-bar" aria-hidden="true"><span data-pct="${translated}"></span></span>` +
			`<span class="cfg-lang-pct" aria-hidden="true">${translated}%</span>` +
			`<div class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" role="switch" id="cfg-lang-${index}" aria-label="Offer the shop in ${htmlSafe(title)}"${offered ? ' checked' : ''}${primary ? ' disabled' : ''}></div></li>`
		);
	}

	/** Why a typed language can't be added, or '' when it can. */
	function languageRefusal(typed, match, languageList) {
		if (!typed) return 'Type a language, then pick it from the list.';
		if (!match) return `We can't translate into "${typed}" yet. Pick one from the list.`;
		return pick(`[data-lang="${match}"]`, languageList) ? `${match} is already on the list.` : '';
	}

	function mountLanguages() {
		const languages = [
			{ title: 'English (US)', translated: 100, offered: true, primary: true },
			{ title: 'Spanish', translated: 94, offered: true },
			{ title: 'French', translated: 81, offered: true },
			{ title: 'German', translated: 66, offered: false },
			{ title: 'Japanese', translated: 38, offered: false },
		];
		const languageList = pick('[data-cfg-langs]', page);
		languageList.innerHTML = languages.map(languageRow).join('');

		page.addEventListener(FIRST_SHOWN, (event) => {
			if (event.detail.key === 'regional') widenBars(languageList, 'data-pct');
		});
		if (panel('regional').classList.contains('active')) widenBars(languageList, 'data-pct');

		const entry = pick('#cfg-lang-add');
		const message = pick('[data-cfg-lang-note]', page);
		const offered = pickAll('#cfg-lang-list option').map((option) => option.value);
		let nextIndex = languages.length;

		function addLanguage() {
			const typed = entry.value.trim();
			const match = offered.find((known) => known.toLowerCase() === typed.toLowerCase());
			const refusal = languageRefusal(typed, match, languageList);
			if (refusal) {
				message.textContent = refusal;
				/* Only a missing or unknown name sends the cursor back to the box. */
				if (!match) entry.focus();
				return;
			}
			const scratch = document.createElement('template');
			scratch.innerHTML = languageRow({ title: match, translated: 0, offered: false }, nextIndex++);
			const row = scratch.content.firstElementChild;
			row.classList.add('is-new');
			languageList.append(row);
			rememberFields(page);
			entry.value = '';
			message.textContent = `${match} added. It stays off until more of it is translated.`;
			notify({
				tone: 'success',
				title: `${match} added`,
				text: 'Translation starts tonight.',
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							row.remove();
							countEdits();
							message.textContent = '';
						},
					},
				],
			});
		}

		pick('[data-cfg-lang-add-btn]', page).addEventListener('click', addLanguage);
		entry.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter') return;
			event.preventDefault();
			setTimeout(addLanguage, 0);
		});
	}

	/* Branding: accent swatches, the email preview and the logo drop zone. */

	function mountBranding() {
		const preview = pick('[data-cfg-mail]', page);
		pick('[data-cfg-swatches]', page).addEventListener('change', (event) => {
			preview.className = preview.className.replace(/cfg-accent--\d/, `cfg-accent-${event.target.value}`);
		});

		const shopLine = pick('[data-cfg-mail-shop]', page);
		const senderName = pick('#cfg-from-name');
		function mirrorSender() {
			shopLine.textContent = senderName.value.trim() || 'Your shop';
		}
		senderName.addEventListener('input', mirrorSender);
		senderName.addEventListener('change', mirrorSender);

		mountLogo();
	}

	/** Why a file can't become the logo, or '' when it can. */
	function logoRefusal(upload) {
		if (!/^image\/(png|svg\+xml|jpeg)$/.test(upload.type))
			return `${upload.name} isn't a picture we can use. Try a PNG, SVG or JPG.`;
		if (upload.size > 2 * 1024 * 1024)
			return `${upload.name} is ${(upload.size / 1048576).toFixed(1)} MB. Logos can be up to 2 MB.`;
		return '';
	}

	/* A dropped or chosen picture replaces the mark everywhere it appears. */
	function mountLogo() {
		const zone = pick('[data-cfg-logo-drop]', page);
		const message = pick('[data-cfg-logo-note]', page);
		const revert = pick('[data-cfg-logo-reset]', page);
		const fileName = pick('[data-cfg-logo-name]', page);
		const fileMeta = pick('[data-cfg-logo-meta]', page);
		function marks() {
			return pickAll('[data-cfg-logo-mark]');
		}
		const firstLogo = {
			markup: marks()[0].innerHTML,
			name: fileName.textContent.trim(),
			meta: fileMeta.textContent.trim(),
		};
		let objectUrl = null;

		function forgetUpload() {
			if (!objectUrl) return;
			URL.revokeObjectURL(objectUrl);
			objectUrl = null;
		}

		function restoreOriginal() {
			for (const mark of marks()) mark.innerHTML = firstLogo.markup;
			fileName.textContent = firstLogo.name;
			fileMeta.textContent = firstLogo.meta;
			revert.hidden = true;
			forgetUpload();
		}

		zone.addEventListener('basalt:files', (event) => {
			const [upload] = event.detail.files;
			if (!upload) return;
			const refusal = logoRefusal(upload);
			if (refusal) {
				message.textContent = refusal;
				return;
			}
			if (objectUrl) URL.revokeObjectURL(objectUrl);
			objectUrl = URL.createObjectURL(upload);
			for (const mark of marks()) mark.innerHTML = `<img src="${objectUrl}" alt="">`;
			fileName.textContent = upload.name;
			fileMeta.textContent = `Added just now by you, ${readableSize(upload.size)}`;
			revert.hidden = false;
			message.textContent = 'New logo in place. The email preview uses it too.';
			notify({
				tone: 'success',
				title: 'Logo updated',
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							restoreOriginal();
							message.textContent = '';
						},
					},
				],
			});
		});
		revert.addEventListener('click', () => {
			restoreOriginal();
			message.textContent = 'Back to the old logo.';
		});
	}

	/* Email sending: the DNS record check and the test send. */

	function dnsStatus(checking, found) {
		if (checking)
			return `<span class="basalt-skeleton basalt-skeleton-text cfg-dns-skel" aria-hidden="true"></span>${hiddenText('Checking')}`;
		return found
			? badge('success', 'Found', 'bi-check-circle-fill')
			: badge('danger', 'Not found', 'bi-x-circle-fill');
	}

	function drawDnsRecords(checking) {
		const rows = pick('[data-cfg-dns-rows]', page);
		rows.innerHTML = DNS_RECORDS.map(({ kind, host, target, found }) => {
			const copy = `<button type="button" class="btn btn-sm btn-outline-secondary cfg-icon-btn" data-basalt-copy="${htmlSafe(target)}" data-bs-title="Copy value" aria-label="Copy the ${kind} value for ${htmlSafe(host)}">${iconTag('bi-copy')}</button>`;
			return (
				`<tr><td><span class="cfg-strong">${kind}</span></td><td><code class="cfg-mono">${htmlSafe(host)}</code></td>` +
				`<td class="cfg-value"><div class="cfg-value-row"><code>${htmlSafe(target)}</code>${copy}</div></td>` +
				`<td>${dnsStatus(checking, found)}</td></tr>`
			);
		}).join('');
		enhanceButtons(rows);
	}

	function mountEmail() {
		drawDnsRecords(false);
		const check = pick('[data-cfg-dns-check]', page);
		const notice = pick('[data-cfg-dns-alert]', page);
		const noticeTitle = pick('[data-cfg-dns-alert-title]', page);
		const noticeText = pick('[data-cfg-dns-alert-text]', page);

		check.addEventListener('click', () => {
			if (check.classList.contains('is-loading')) return;
			shop.dnsRuns += 1;
			buttonPhase(check, 'loading');
			drawDnsRecords(true);
			pick('[data-cfg-dns-rows]', page).setAttribute('aria-busy', 'true');
			pause(1400).then(() => {
				pick('[data-cfg-dns-rows]', page).removeAttribute('aria-busy');
				/* Like a record added minutes ago, DKIM only shows up from the second check on. */
				if (shop.dnsRuns >= 2) {
					for (const record of DNS_RECORDS) record.found = true;
				}
				shop.dkimReady = DNS_RECORDS.every((record) => record.found);
				drawDnsRecords(false);
				if (shop.dkimReady) {
					buttonPhase(check, 'success');
					notice.classList.replace('alert-warning', 'alert-success');
					pick('.basalt-alert-icon i', notice).className = 'bi bi-check-circle';
					noticeTitle.textContent = 'All three records found';
					noticeText.textContent = 'Order emails are now signed as coming from marlo.com.';
					notify({
						tone: 'success',
						title: 'Email records found',
						text: 'Order emails should reach inboxes now.',
					});
				} else {
					buttonPhase(check, 'error');
					noticeTitle.textContent = 'Still no DKIM record';
					noticeText.textContent =
						'Checked just now. Copy the CNAME value above into your DNS, wait a few minutes, then check again.';
					notify({
						tone: 'warning',
						title: 'One record still missing',
						text: "bm1._domainkey wasn't found.",
					});
				}
				setTimeout(() => buttonPhase(check, 'idle'), 2200);
			});
		});

		const sendTest = pick('[data-cfg-test-send]', page);
		const recipient = pick('#cfg-test-to');
		sendTest.addEventListener('click', () => {
			if (sendTest.classList.contains('is-loading')) return;
			const invalid = window.Basalt.dialog ? window.Basalt.dialog.flagFields([recipient]) : null;
			if (invalid) {
				invalid.focus();
				return;
			}
			buttonPhase(sendTest, 'loading');
			pause(1100).then(() => {
				buttonPhase(sendTest, 'success');
				notify({
					tone: 'success',
					title: 'Test email sent',
					text: `${pick('#cfg-test-template').value} went to ${recipient.value}.`,
				});
				setTimeout(() => buttonPhase(sendTest, 'idle'), 1600);
			});
		});
	}

	/* Team: the people table, invites waiting, the invite drawer, the role grid. */

	function sinceText(minutes) {
		if (minutes < 60) return `${minutes} minutes ago`;
		if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} hours ago`;
		const wholeDays = Math.floor(minutes / 1440);
		return wholeDays === 1 ? 'Yesterday' : `${wholeDays} days ago`;
	}

	function seedTeam() {
		const members = [
			{
				name: OWNER,
				email: 'elaine@marlo.com',
				role: 'Owner',
				twoStep: true,
				lastSeen: 'Now',
				isYou: true,
				hue: 1,
			},
		];
		const taken = new Set([OWNER]);
		let cursor = 0;
		while (members.length < 18) {
			const wholeName = `${GIVEN[cursor % GIVEN.length]} ${FAMILY[(cursor * 7 + 3) % FAMILY.length]}`;
			cursor += 1;
			if (taken.has(wholeName)) continue;
			taken.add(wholeName);
			const minutes = Math.floor(random() * 60 * 24 * 9);
			const role = SEAT_ROLES[members.length - 1];
			members.push({
				name: wholeName,
				email: `${wholeName.toLowerCase().replace(' ', '.')}@marlo.com`,
				role,
				twoStep: role === 'Packer' ? random() > 0.6 : random() > 0.15,
				lastSeen: sinceText(minutes),
				hue: 1 + (members.length % 6),
			});
		}
		Object.assign(members[1], { name: 'Jonah Price', email: 'jonah@marlo.com' });
		Object.assign(members[2], { name: 'Lindsay Kinney', email: 'connie@marlo.com' });
		Object.assign(members[4], { name: 'Stanley Vinson', email: 'stanley.vinson@marlo.com' });
		return members;
	}

	function roleCell({ name: personName, role }, index) {
		if (role === 'Owner') return badge('primary', 'Owner', 'bi-star-fill');
		const options = STAFF_ROLES.map(
			(choice) => `<option${choice === role ? ' selected' : ''}>${choice}</option>`,
		).join('');
		return `<select class="form-select form-select-sm" aria-label="Role for ${htmlSafe(personName)}" data-cfg-person-role="${index}">${options}</select>`;
	}

	function memberRow(member) {
		const index = shop.members.indexOf(member);
		const you = member.isYou ? ' <span class="cfg-sub d-inline">(you)</span>' : '';
		const person =
			`<div class="cfg-person"><span class="cfg-person-av cfg-av-${member.hue}" aria-hidden="true">${htmlSafe(monogram(member.name))}</span>` +
			`<div><p class="cfg-person-name">${htmlSafe(member.name)}${you}</p><p class="cfg-person-mail">${htmlSafe(member.email)}</p></div></div>`;
		const twoStep = member.twoStep ? badge('success dot', 'On') : badge('warning dot', 'Off');
		const remove =
			member.role === 'Owner'
				? ''
				: confirmButton(
						'btn-outline-danger',
						`data-cfg-person-remove="${index}"`,
						`Remove${hiddenText(` ${htmlSafe(member.name)}`)}`,
					);
		return `<tr><td>${person}</td><td>${roleCell(member, index)}</td><td>${twoStep}</td><td>${htmlSafe(member.lastSeen)}</td><td>${remove}</td></tr>`;
	}

	function mountTeam() {
		shop.members = seedTeam();
		shop.pendingInvites = [
			{ email: 'dee.nugent@gmail.com', role: 'Staff', daysOld: 6 },
			{ email: 'larry@parcelpals.com', role: 'Packer', daysOld: 4 },
		];
		mountPeople();
		mountInvites();
		mountInviteDrawer();
		mountRoleGrid();
	}

	function mountPeople() {
		const rows = pick('[data-cfg-people-rows]', page);
		const query = pick('[data-cfg-people-search]', page);
		const roleNarrow = pick('[data-cfg-people-role]', page);
		const blankNote = pick('[data-cfg-people-empty]', page);
		const pagerBox = pick('[data-cfg-people-pager]', page);
		const tableBox = rows.closest('.cfg-table-wrap');
		const pageSize = 8;
		let visible = shop.members.slice();
		const pagerOptions = {
			total: visible.length,
			perPage: pageSize,
			noun: 'people',
			render: (fromRow, toRow) => drawRows(fromRow, toRow),
		};

		function drawRows(fromRow, toRow) {
			rows.innerHTML = visible
				.slice(fromRow - 1, toRow)
				.map(memberRow)
				.join('');
			enhanceButtons(rows);
		}

		const pager = window.Basalt.pager(pagerBox, pagerOptions);
		const rangeLine = pick('[data-basalt-pager-range]', pagerBox);

		function refilter(keepPage) {
			const terms = searchTerms(query.value);
			const role = roleNarrow.value;
			visible = shop.members.filter(
				(member) =>
					(!role || member.role === role) &&
					terms.every((term) => `${member.name} ${member.email}`.toLowerCase().includes(term)),
			);
			pagerOptions.total = visible.length;
			const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
			pager.setTotal(pageCount);
			if (!keepPage) pager.set(1);
			const current = pager.get();
			const fromRow = (current - 1) * pageSize + 1;
			const toRow = Math.min(visible.length, current * pageSize);
			drawRows(fromRow, toRow);
			rangeLine.innerHTML = visible.length
				? `<strong>${fromRow}–${toRow}</strong> of ${quantity(visible.length, 'person', 'people')}`
				: '';
			pick('.basalt-pager-nav', pagerBox).hidden = pageCount <= 1;
			const nobody = !visible.length;
			tableBox.hidden = nobody;
			pagerBox.hidden = nobody;
			blankNote.hidden = !nobody;
			if (nobody) {
				pick('[data-cfg-people-empty-title]', page).textContent = query.value.trim()
					? `No one matches "${query.value.trim()}"`
					: 'No one has that role';
			}
			pick('[data-cfg-fig-team]', page).textContent = shop.members.length;
		}

		query.addEventListener('input', () => refilter(false));
		roleNarrow.addEventListener('change', () => refilter(false));
		pick('[data-cfg-people-clear]', page).addEventListener('click', () => {
			query.value = '';
			roleNarrow.value = '';
			refilter(false);
			query.focus();
		});

		rows.addEventListener('change', (event) => {
			const select = event.target.closest('[data-cfg-person-role]');
			if (!select) return;
			const member = shop.members[Number(select.getAttribute('data-cfg-person-role'))];
			const formerRole = member.role;
			member.role = select.value;
			notify({
				tone: 'success',
				title: `${member.name} is now ${member.role === 'Admin' ? 'an ' : 'a '}${member.role}`,
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							member.role = formerRole;
							refilter(true);
						},
					},
				],
			});
			fillNewOwnerList();
		});

		rows.addEventListener('basalt:confirm', (event) => {
			const button = event.target.closest('[data-cfg-person-remove]');
			if (!button) return;
			const index = Number(button.getAttribute('data-cfg-person-remove'));
			const [member] = shop.members.splice(index, 1);
			refilter(true);
			notify({
				tone: 'warning',
				icon: 'bi-person-dash',
				title: `${member.name} removed`,
				text: 'They were signed out straight away.',
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							shop.members.splice(index, 0, member);
							refilter(true);
						},
					},
				],
			});
			fillNewOwnerList();
		});

		refilter(false);
	}

	function inviteAge(age) {
		return { 0: 'sent just now', 1: 'sent yesterday' }[age] ?? `sent ${age} days ago`;
	}

	function drawInvites() {
		const inviteList = pick('[data-cfg-invites]', page);
		inviteList.innerHTML = shop.pendingInvites
			.map(({ email, role, daysOld }, index) =>
				listRow({
					iconName: 'bi-envelope',
					title: htmlSafe(email),
					sub: `${htmlSafe(role)}, ${inviteAge(daysOld)}${daysOld >= 6 ? '. The link runs out tomorrow.' : ''}`,
					actions:
						loadingButton(
							'btn btn-outline-secondary btn-sm btn-loading',
							`data-cfg-invite-resend="${index}"`,
							{
								idle: `Send again${hiddenText(` to ${htmlSafe(email)}`)}`,
								busy: `${SPINNER}Sending`,
								done: `${iconTag('bi-check2')}Sent`,
							},
						) +
						confirmButton(
							'btn-outline-danger',
							`data-cfg-invite-cancel="${index}"`,
							`Cancel${hiddenText(` the invite to ${htmlSafe(email)}`)}`,
						),
				}),
			)
			.join('');
		inviteList.hidden = !shop.pendingInvites.length;
		pick('[data-cfg-invites-empty]', page).hidden = shop.pendingInvites.length > 0;
		enhanceButtons(inviteList);
	}

	function mountInvites() {
		const inviteList = pick('[data-cfg-invites]', page);
		inviteList.addEventListener('click', (event) => {
			const button = event.target.closest('[data-cfg-invite-resend]');
			if (!button || button.classList.contains('is-loading')) return;
			const invite = shop.pendingInvites[Number(button.getAttribute('data-cfg-invite-resend'))];
			buttonPhase(button, 'loading');
			pause(900).then(() => {
				buttonPhase(button, 'success');
				notify({
					tone: 'success',
					title: 'Invite sent again',
					text: `${invite.email} has seven more days to join.`,
				});
				setTimeout(() => {
					invite.daysOld = 0;
					drawInvites();
				}, 900);
			});
		});
		inviteList.addEventListener('basalt:confirm', (event) => {
			const button = event.target.closest('[data-cfg-invite-cancel]');
			if (!button) return;
			const index = Number(button.getAttribute('data-cfg-invite-cancel'));
			const [invite] = shop.pendingInvites.splice(index, 1);
			drawInvites();
			notify({
				tone: 'info',
				title: 'Invite canceled',
				text: `The link sent to ${invite.email} no longer works.`,
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							shop.pendingInvites.splice(index, 0, invite);
							drawInvites();
						},
					},
				],
			});
		});
		drawInvites();
	}

	function splitAddresses(text) {
		return text
			.split(/[\s,;]+/)
			.map((part) => part.trim())
			.filter(Boolean);
	}

	function mountInviteDrawer() {
		const sheet = pick('#cfg-invite');
		const form = pick('[data-cfg-invite-form]', sheet);
		const chips = pick('[data-cfg-invite-tags]', sheet);
		const problem = pick('[data-cfg-invite-err]', sheet);
		const typing = pick('.basalt-tags-input', chips);

		/* A pasted list becomes one chip per address. */
		typing.addEventListener('paste', (event) => {
			const pasted = (event.clipboardData || window.clipboardData).getData('text');
			if (!/[\s,;]/.test(pasted.trim())) return;
			event.preventDefault();
			chips.basaltTags.set(chips.basaltTags.get().concat(splitAddresses(pasted)));
		});
		chips.addEventListener('change', () => {
			const wrong = chips.basaltTags.get().filter((value) => !looksLikeEmail(value));
			const verb =
				wrong.length === 1 ? " doesn't look like an email address." : " don't look like email addresses.";
			problem.textContent = wrong.length ? sentenceList(wrong.map((value) => `"${value}"`)) + verb : '';
			chips.classList.toggle('is-invalid', wrong.length > 0);
		});
		chips.addEventListener('basalt:tags-duplicate', (event) => {
			problem.textContent = `${event.detail.value} is on the list already.`;
		});

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			/* Text still sitting in the box is treated as typed addresses too. */
			if (typing.value.trim()) {
				chips.basaltTags.set(chips.basaltTags.get().concat(typing.value.split(/[\s,;]+/).filter(Boolean)));
				typing.value = '';
			}
			const addresses = chips.basaltTags.get();
			if (!addresses.length) {
				problem.textContent = 'Add at least one email address.';
				typing.focus();
				return;
			}
			if (addresses.some((value) => !looksLikeEmail(value))) {
				chips.dispatchEvent(new Event('change'));
				typing.focus();
				return;
			}
			const role = pick('input[name="cfg-invite-role"]:checked', form).value;
			for (const email of addresses) shop.pendingInvites.unshift({ email, role, daysOld: 0 });
			drawInvites();
			bootstrap.Offcanvas.getOrCreateInstance(sheet).hide();
			notify({
				tone: 'success',
				title: `${quantity(addresses.length, 'invite')} sent`,
				text: 'They show under Waiting to join until they accept.',
			});
			reveal('team', '[data-cfg-invites]');
		});

		sheet.addEventListener('hidden.bs.offcanvas', () => {
			form.reset();
			chips.basaltTags.set([]);
			problem.textContent = '';
			chips.classList.remove('is-invalid');
		});
	}

	function mountRoleGrid() {
		const areas = [
			{ title: 'Orders', hint: 'See, pack and refund', cells: [true, true, true] },
			{ title: 'Customers', hint: 'Contact details and notes', cells: [true, true, false] },
			{ title: 'Products and stock', hint: 'Prices, photos, counts', cells: [true, false, false] },
			{ title: 'Discounts', hint: 'Codes and sales', cells: [true, true, false] },
			{ title: 'Reports', hint: 'Sales and stock reports', cells: [true, false, false] },
			{ title: 'Settings', hint: 'Everything on this page', cells: [true, false, false] },
		];
		pick('[data-cfg-roles-rows]', page).innerHTML = checkboxGrid(
			areas,
			'cfg-perm',
			(title, column) => `${STAFF_ROLES[column]} can use ${htmlSafe(title)}`,
		);
	}

	/* Notifications: the alert grid, the email-only shortcut and the summary email. */

	function mountAlerts() {
		const triggers = [
			{ title: 'A new order comes in', cells: [true, true, false] },
			{
				title: 'An order is over $250',
				hint: 'Usually a blazer, a coat or a gift order',
				cells: [true, true, true],
			},
			{ title: 'A product runs low', hint: 'Uses the number of units set below', cells: [true, true, false] },
			{ title: 'A payment fails', hint: 'Card declined on a subscription', cells: [true, true, true] },
			{ title: 'Someone asks for a refund', cells: [true, true, false] },
			{ title: 'A subscription is canceled', cells: [true, false, false] },
			{ title: 'A new product review', cells: [false, true, false] },
			{ title: 'A webhook address is paused', hint: 'See Webhooks', cells: [true, true, false] },
		];
		const channels = ['email', 'in the app', 'by text message'];
		pick('[data-cfg-alert-rows]', page).innerHTML = checkboxGrid(
			triggers,
			'cfg-alert',
			(title, column) => `${htmlSafe(title)}, ${channels[column]}`,
		);

		pick('[data-cfg-alerts-quiet]', page).addEventListener('click', () => {
			for (const box of pickAll('[data-cfg-alert-rows] input', page)) {
				const emailColumn = box.id.endsWith('0');
				if (box.checked === emailColumn) continue;
				box.checked = emailColumn;
				box.dispatchEvent(new Event('change', { bubbles: true }));
			}
			announce('Every alert now goes by email only. Save to keep it.');
		});

		mountDigest();
	}

	function mountDigest() {
		const cadence = pick('[data-cfg-digest]', page);
		const sendAt = pick('#cfg-digest-time');
		const timeFields = pick('[data-cfg-digest-fields]', page);
		const summary = pick('[data-cfg-digest-note]', page);
		const sentences = {
			off: () => 'No summary email. Alerts above still arrive.',
			day: (time) => `Arrives every ${/PM/.test(time) ? 'day' : 'morning'} at ${time}.`,
			week: (time) => `Arrives on Monday at ${time}, covering the week before.`,
		};

		function describeDigest() {
			const choice = pick('input:checked', cadence)?.value ?? 'day';
			timeFields.hidden = choice === 'off';
			summary.textContent = (sentences[choice] ?? sentences.week)(sendAt.value);
		}
		cadence.addEventListener('change', describeDigest);
		sendAt.addEventListener('change', describeDigest);
		describeDigest();
	}

	/* Plan and billing: usage rings, invoices, the card drawer, invoice copies, the plan dialog. */

	function tierPrice(tier, billing) {
		const monthly = TIERS[tier].monthly;
		return billing === 'year' ? `$${(monthly * 10).toLocaleString('en-US')} a year` : `$${monthly} a month`;
	}

	function mountBilling() {
		for (const part of [mountUsage, mountInvoices, mountCardDrawer, mountInvoiceCopies, mountPlanDialog]) part();
	}

	function mountUsage() {
		const meters = [
			{ label: 'Orders', used: 1842, limit: 3000, unit: 'orders' },
			{ label: 'People', used: 18, limit: 20, unit: 'people' },
			{ label: 'File storage', used: 6.2, limit: 10, unit: 'GB' },
		];
		function share({ used, limit }) {
			return Math.round((used / limit) * 100);
		}
		const legend = pick('[data-cfg-usage-list]', page);
		const rings = pickAll('[data-cfg-usage-ring]', page);
		const headline = pick('[data-cfg-usage-top]', page);
		const ringBox = pick('.cfg-usage-rings', page);

		legend.innerHTML = meters
			.map(
				(meter, index) =>
					`<li class="cfg-usage-item cfg-tone-${index + 1}" data-cfg-usage="${index}"><span class="cfg-usage-swatch" aria-hidden="true"></span>` +
					`<div><p class="cfg-usage-name">${meter.label}</p><p class="cfg-usage-of">${meter.used.toLocaleString('en-US')} of ${meter.limit.toLocaleString('en-US')} ${meter.unit}</p></div>` +
					`<span class="cfg-usage-pct">${share(meter)}%</span></li>`,
			)
			.join('');

		function spotlight(focused) {
			ringBox.classList.toggle('is-focus', focused !== null);
			for (const [index, ring] of rings.entries()) ring.classList.toggle('is-focus', index === focused);
			const meter = meters[focused ?? 0];
			headline.textContent = `${share(meter)}%`;
			headline.nextElementSibling.textContent =
				focused === null ? 'of orders' : `of ${meter.label.toLowerCase()}`;
		}
		legend.addEventListener('mouseover', (event) => {
			const item = event.target.closest('[data-cfg-usage]');
			if (item) spotlight(Number(item.getAttribute('data-cfg-usage')));
		});
		legend.addEventListener('mouseleave', () => spotlight(null));

		page.addEventListener(FIRST_SHOWN, (event) => {
			if (event.detail.key !== 'billing') return;
			requestAnimationFrame(() => {
				for (const [index, ring] of rings.entries())
					ring.style.setProperty('--value', String(share(meters[index])));
			});
		});
	}

	function mountInvoices() {
		const skeleton = pick('[data-cfg-inv-loading]', page);
		const ready = pick('[data-cfg-inv-ready]', page);
		const rows = pick('[data-cfg-inv-rows]', page);
		const invoices = Array.from({ length: 12 }, (_, monthsBack) => {
			const issued = new Date(Date.UTC(2026, 8 - monthsBack, 14));
			const extraSeats = monthsBack === 3 ? 25 : 0;
			return {
				number: `#${1840 - monthsBack}`,
				dated: issued.toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
					year: 'numeric',
					timeZone: 'UTC',
				}),
				total: 79 + extraSeats,
				line: extraSeats ? 'Pro plan, plus 5 extra people for a month' : 'Pro plan',
			};
		});

		function drawInvoices(fromRow, toRow) {
			rows.innerHTML = invoices
				.slice(fromRow - 1, toRow)
				.map((invoice, offset) => {
					const download = `<button type="button" class="btn btn-sm btn-outline-secondary" data-cfg-inv="${fromRow - 1 + offset}">${iconTag('bi-download me-1')}Download${hiddenText(` ${invoice.number}`)}</button>`;
					return (
						`<tr><td><span class="cfg-strong cfg-mono">${invoice.number}</span><span class="cfg-sub">${htmlSafe(invoice.line)}</span></td>` +
						`<td>${invoice.dated}</td><td class="cfg-mono">$${invoice.total.toFixed(2)}</td>` +
						`<td>${badge('success', 'Paid', 'bi-check-circle-fill')}</td><td>${download}</td></tr>`
					);
				})
				.join('');
		}

		rows.addEventListener('click', (event) => {
			const button = event.target.closest('[data-cfg-inv]');
			if (!button) return;
			const invoice = invoices[Number(button.getAttribute('data-cfg-inv'))];
			const copy = [
				'Marlo Clothing Company',
				'1140 Hawthorne St, Unit 4, Eugene, OR 97401',
				'',
				`Invoice ${invoice.number}`,
				`Date: ${invoice.dated}`,
				'',
				`${invoice.line}    $${invoice.total.toFixed(2)}`,
				`Paid with ${shop.card.brand} ending ${shop.card.lastFour}`,
				'',
				'Thank you.',
			];
			offerFile(`${invoice.number}.txt`, copy.join('\n'));
			notify({ tone: 'success', title: `${invoice.number} downloaded`, duration: 3000 });
		});

		/* The invoice table loads the first time the section opens, behind skeleton lines. */
		let requested = false;
		page.addEventListener(FIRST_SHOWN, (event) => {
			if (event.detail.key !== 'billing' || requested) return;
			requested = true;
			ready.setAttribute('aria-busy', 'true');
			pause(900).then(() => {
				skeleton.hidden = true;
				ready.hidden = false;
				ready.removeAttribute('aria-busy');
				window.Basalt.pager(pick('[data-cfg-inv-pager]', page), {
					total: invoices.length,
					perPage: 6,
					noun: 'invoices',
					render: drawInvoices,
				});
			});
		});
	}

	function mountCardDrawer() {
		const sheet = pick('#cfg-card');
		const form = pick('[data-cfg-card-form]', sheet);
		const number = pick('#cfg-cc-num');
		const expiry = pick('#cfg-cc-exp');
		const submit = pick('[data-cfg-card-submit]', sheet);
		const numberHint = 'Card numbers have 15 or 16 digits.';

		number.addEventListener('input', () => {
			number.value = number.value
				.replace(/\D/g, '')
				.slice(0, 16)
				.replace(/(\d{4})(?=\d)/g, '$1 ');
			number.setCustomValidity('');
			number.nextElementSibling.textContent = numberHint;
		});
		expiry.addEventListener('input', () => {
			const figures = expiry.value.replace(/\D/g, '').slice(0, 4);
			expiry.value = figures.length > 2 ? `${figures.slice(0, 2)}/${figures.slice(2)}` : figures;
		});

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			number.setCustomValidity('');
			const invalid = window.Basalt.dialog.flagFields(pickAll('input', form));
			if (invalid) {
				invalid.focus();
				return;
			}
			window.Basalt.dialog.busy(submit, true);
			pause(1200).then(() => {
				window.Basalt.dialog.busy(submit, false);
				const cardDigits = number.value.replace(/\D/g, '');
				/* The well-known test number for a declined card. */
				if (cardDigits === '4000000000000002') {
					number.setCustomValidity('declined');
					number.classList.add('is-invalid');
					number.setAttribute('aria-invalid', 'true');
					number.nextElementSibling.textContent = 'The bank declined this card. Try another one.';
					number.focus();
					notify({
						tone: 'danger',
						title: 'Card declined',
						text: 'Nothing was charged. The old card is still on file.',
					});
					return;
				}
				shop.card = {
					brand: CARD_BRANDS[cardDigits[0]] ?? 'Visa',
					lastFour: cardDigits.slice(-4),
					expiry: expiry.value,
					expiringSoon: false,
				};
				pick('[data-cfg-card-num]', page).textContent = `${shop.card.brand} ending ${shop.card.lastFour}`;
				pick('[data-cfg-card-exp]', page).textContent = `Expires ${shop.card.expiry}`;
				const cardBadge = pick('[data-cfg-card-status]', page);
				cardBadge.className = 'basalt-status basalt-status-success';
				cardBadge.innerHTML = `${iconTag('bi-check-circle-fill')}Up to date`;
				bootstrap.Offcanvas.getOrCreateInstance(sheet).hide();
				notify({
					tone: 'success',
					title: 'Card saved',
					text: `${shop.card.brand} ending ${shop.card.lastFour} pays from Oct 14.`,
				});
			});
		});

		sheet.addEventListener('hidden.bs.offcanvas', () => {
			form.reset();
			window.Basalt.dialog.clearFlags(form);
			number.nextElementSibling.textContent = numberHint;
		});
	}

	/* Invoice copies accept email addresses only; anything else is dropped with a note. */
	function mountInvoiceCopies() {
		const recipients = pick('[data-cfg-billto]', page);
		const message = pick('[data-cfg-billto-note]', page);
		recipients.addEventListener('change', () => {
			const entered = recipients.basaltTags.get();
			const rejected = entered.find((value) => !looksLikeEmail(value));
			if (rejected === undefined) return;
			recipients.basaltTags.set(entered.filter(looksLikeEmail));
			message.textContent = `"${rejected}" isn't an email address, so it wasn't added.`;
		});
		recipients.addEventListener('basalt:tags-duplicate', (event) => {
			message.textContent = `${event.detail.value} already gets invoices.`;
		});
		pick('.basalt-tags-input', recipients).addEventListener('input', () => {
			message.textContent = '';
		});
	}

	function planAdvice(tier, billing) {
		const current = shop.plan;
		const team = shop.members.length;
		const chosen = TIERS[tier];
		const now = TIERS[current.tier];
		if (tier === current.tier && billing === current.billing)
			return { text: "This is the plan you're on.", allowed: false };
		if (chosen.seats < team) {
			return {
				text: `${tier} allows ${chosen.seats} people and the team has ${team}. Remove ${team - chosen.seats} first.`,
				allowed: false,
			};
		}
		if (chosen.monthly > now.monthly) {
			const prorated = Math.round(((chosen.monthly - now.monthly) * 15) / 30);
			return {
				text: `You pay the difference for the rest of this month, about $${prorated}, then ${tierPrice(tier, billing)}.`,
				allowed: true,
			};
		}
		if (chosen.monthly < now.monthly)
			return { text: 'The lower price starts on Oct 14. Everything you have now is kept.', allowed: true };
		return {
			text: `Paying ${billing === 'year' ? `yearly saves $${chosen.monthly * 2}.` : 'monthly again from the next renewal.'}`,
			allowed: true,
		};
	}

	function mountPlanDialog() {
		const dialog = pick('#cfg-plan');
		const form = pick('[data-cfg-plan-form]', dialog);
		const advice = pick('[data-cfg-plan-note]', dialog);
		const confirm = pick('[data-cfg-plan-submit]', dialog);
		function pickedTier() {
			return pick('input[name="cfg-plan"]:checked', form).value;
		}
		function pickedBilling() {
			return pick('input[name="cfg-plan-period"]:checked', form).value;
		}

		function refreshChoice() {
			for (const price of pickAll('[data-cfg-plan-price-for]', dialog)) {
				price.textContent = tierPrice(price.getAttribute('data-cfg-plan-price-for'), pickedBilling());
			}
			const { text, allowed } = planAdvice(pickedTier(), pickedBilling());
			advice.textContent = text;
			confirm.disabled = !allowed;
		}

		function paintPlan() {
			pick('[data-cfg-plan-name]', page).textContent = shop.plan.tier;
			pick('[data-cfg-plan-price]', page).textContent = tierPrice(shop.plan.tier, shop.plan.billing);
			pickAll('.basalt-hero-value', page)[2].textContent = shop.plan.tier;
		}

		form.addEventListener('change', refreshChoice);
		dialog.addEventListener('show.bs.modal', () => {
			pick(`input[name="cfg-plan"][value="${shop.plan.tier}"]`, form).checked = true;
			const billing = pick(`input[name="cfg-plan-period"][value="${shop.plan.billing}"]`, form);
			billing.checked = true;
			billing.dispatchEvent(new Event('change', { bubbles: true }));
			refreshChoice();
		});
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			if (confirm.disabled) return;
			const before = { ...shop.plan };
			shop.plan = { tier: pickedTier(), billing: pickedBilling() };
			paintPlan();
			bootstrap.Modal.getOrCreateInstance(dialog).hide();
			notify({
				tone: 'success',
				title: `You're on ${shop.plan.tier}`,
				text: `${tierPrice(shop.plan.tier, shop.plan.billing)} from now on.`,
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							shop.plan = before;
							paintPlan();
						},
					},
				],
			});
		});
	}

	/* API keys: the key list, replace and delete, and the new-key drawer. */

	function freshKey() {
		const characters = Array.from({ length: 32 }, () => KEY_ALPHABET[Math.floor(random() * KEY_ALPHABET.length)]);
		return `bk_live_${characters.join('')}`;
	}

	function drawKeys() {
		const keyList = pick('[data-cfg-keys]', page);
		keyList.innerHTML = shop.apiKeys
			.map((entry, index) =>
				listRow({
					iconName: 'bi-key',
					title: `${htmlSafe(entry.label)} <span class="cfg-chip">${htmlSafe(entry.scope)}</span>${entry.idle ? ` ${badge('warning dot', 'Not used in 3 months')}` : ''}`,
					sub: `<span class="cfg-mono">${htmlSafe(entry.secret.slice(0, 13))}••••</span> · ${htmlSafe(entry.purpose)} · made ${htmlSafe(entry.created)} · last used ${htmlSafe(entry.lastCall)}`,
					actions: `${confirmButton(
						'btn-outline-secondary',
						`data-cfg-key-roll="${index}"`,
						`${iconTag('bi-arrow-repeat')}Replace${hiddenText(` ${htmlSafe(entry.label)}`)}`,
						'Click again to replace',
					)}<button type="button" class="btn btn-outline-danger btn-sm" data-cfg-key-delete="${index}">${iconTag('bi-trash me-1')}Delete${hiddenText(` ${htmlSafe(entry.label)}`)}</button>`,
				}),
			)
			.join('');
		keyList.hidden = !shop.apiKeys.length;
		pick('[data-cfg-keys-empty]', page).hidden = shop.apiKeys.length > 0;
		enhanceButtons(keyList);
	}

	function mountApiKeys() {
		shop.apiKeys = [
			{
				label: 'Warehouse sync',
				purpose: 'Pick-and-pack app',
				scope: 'Read and write',
				secret: freshKey(),
				created: 'Jun 2',
				lastCall: '4 minutes ago',
			},
			{
				label: 'Packing bench laptop',
				purpose: 'Prints slips in the warehouse',
				scope: 'Read only',
				secret: freshKey(),
				created: 'Sep 28',
				lastCall: '18 seconds ago',
			},
			{
				label: 'Accounting export',
				purpose: 'Nightly sales to the books',
				scope: 'Read only',
				secret: freshKey(),
				created: 'Apr 19',
				lastCall: '7 hours ago',
			},
			{
				label: 'Old shipping app',
				purpose: 'Replaced in June',
				scope: 'Read and write',
				secret: freshKey(),
				created: 'Dec 11, 2025',
				lastCall: 'Jun 30',
				idle: true,
			},
		];
		const keyList = pick('[data-cfg-keys]', page);

		keyList.addEventListener('basalt:confirm', (event) => {
			const button = event.target.closest('[data-cfg-key-roll]');
			if (!button) return;
			const entry = shop.apiKeys[Number(button.getAttribute('data-cfg-key-roll'))];
			Object.assign(entry, { secret: freshKey(), created: 'just now', lastCall: 'not yet', idle: false });
			const replacement = entry.secret;
			drawKeys();
			notify({
				tone: 'warning',
				icon: 'bi-key',
				title: `${entry.label} replaced`,
				text: "The old key works for 24 more hours. Copy the new one now; it isn't shown again.",
				duration: 12000,
				actions: [
					{
						label: 'Copy new key',
						onClick: () => {
							window.Basalt.copyText(replacement).then(() => announce('New key copied'));
							return false;
						},
					},
				],
			});
		});

		mountKeyDeletion(keyList);
		drawKeys();
		mountKeyDrawer();
	}

	/* Deleting a key goes through a hold-to-confirm dialog. */
	function mountKeyDeletion(keyList) {
		const dialog = pick('#cfg-revoke');
		let doomed = -1;
		keyList.addEventListener('click', (event) => {
			const button = event.target.closest('[data-cfg-key-delete]');
			if (!button) return;
			doomed = Number(button.getAttribute('data-cfg-key-delete'));
			pick('[data-cfg-revoke-name]', dialog).textContent = shop.apiKeys[doomed].label;
			bootstrap.Modal.getOrCreateInstance(dialog, {}).show(button);
		});
		pick('[data-cfg-revoke-hold]', dialog).addEventListener('basalt:confirm', () => {
			const [entry] = shop.apiKeys.splice(doomed, 1);
			drawKeys();
			setTimeout(() => bootstrap.Modal.getOrCreateInstance(dialog).hide(), prefersStill() ? 0 : 450);
			notify({
				tone: 'danger',
				icon: 'bi-trash',
				title: `${entry.label} deleted`,
				text: 'Anything still using it gets turned away.',
			});
		});
		dialog.addEventListener('hidden.bs.modal', () => {
			const landing = pick('[data-cfg-key-delete]', keyList) || pick('[data-bs-target="#cfg-key"]', page);
			landing?.focus();
		});
	}

	function mountKeyDrawer() {
		const sheet = pick('#cfg-key');
		const form = pick('[data-cfg-key-form]', sheet);
		const nameField = pick('#cfg-key-name');
		const parts = {
			body: pick('[data-cfg-key-body]', sheet),
			foot: pick('[data-cfg-key-foot]', sheet),
			done: pick('[data-cfg-key-done]', sheet),
			doneFoot: pick('[data-cfg-key-foot-done]', sheet),
		};

		function showResult(finished) {
			parts.body.hidden = finished;
			parts.foot.hidden = finished;
			parts.done.hidden = !finished;
			parts.doneFoot.hidden = !finished;
		}

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			if (!parts.done.hidden) return;
			const invalid = window.Basalt.dialog.flagFields([nameField]);
			if (invalid) {
				invalid.focus();
				return;
			}
			const lifetime = pick('#cfg-key-expiry').value;
			const entry = {
				label: nameField.value.trim(),
				purpose: lifetime === 'Never' ? 'Never runs out' : `Runs out ${lifetime.toLowerCase()}`,
				scope: pick('input[name="cfg-key-access"]:checked', form).value,
				secret: freshKey(),
				created: 'just now',
				lastCall: 'not yet',
			};
			shop.apiKeys.unshift(entry);
			drawKeys();
			pick('#cfg-key-secret').value = entry.secret;
			const doneTitle = pick('[data-cfg-key-done-title]', sheet);
			doneTitle.textContent = `${entry.label} is ready`;
			showResult(true);
			doneTitle.focus();
		});

		sheet.addEventListener('hidden.bs.offcanvas', () => {
			form.reset();
			window.Basalt.dialog.clearFlags(form);
			showResult(false);
			pick('#cfg-key-secret').value = '';
		});
	}

	/* Webhooks: the address list, tests and resume, the sends drawer, adding an address. */

	/** A day of past deliveries for one address, newest first. */
	function seedDeliveries(endpoint, howMany) {
		const deliveries = [];
		let stamp = DEMO_NOW - Math.floor(random() * 20) * 60000;
		for (let n = 0; n < howMany; n += 1) {
			const topic = anyOf(endpoint.topics);
			const failed = endpoint.paused ? n < 9 : random() > 0.9;
			deliveries.push({
				topic,
				at: stamp,
				code: failed ? (random() > 0.5 ? 'Timed out' : '500') : '200',
				took: failed ? 10000 : 80 + Math.floor(random() * 260),
				ref: `snd_${Math.floor(random() * 1e8).toString(36)}`,
			});
			stamp -= (40 + Math.floor(random() * 140)) * 60000;
		}
		return deliveries;
	}

	function endpointPill({ paused, live }) {
		if (paused) return badge('danger', 'Paused', 'bi-pause-circle-fill');
		if (!live) return badge('', 'Off', 'bi-slash-circle');
		return badge('success dot live', 'Sending');
	}

	function endpointRow(endpoint, index) {
		const name = htmlSafe(endpoint.label);
		const switchHtml =
			`<div class="form-check form-switch cfg-hook-switch m-0"><input class="form-check-input" type="checkbox" role="switch" id="cfg-hook-on-${index}" data-cfg-hook-on="${index}"${endpoint.live ? ' checked' : ''}>` +
			`<label class="form-check-label" for="cfg-hook-on-${index}">On${hiddenText(`: ${name}`)}</label></div>`;
		const test = loadingButton('btn btn-outline-secondary btn-sm btn-loading', `data-cfg-hook-test="${index}"`, {
			idle: `${iconTag('bi-lightning')}Send test${hiddenText(` to ${name}`)}`,
			busy: `${SPINNER}Waiting`,
			done: `${iconTag('bi-check2')}Answered`,
			fail: `${iconTag('bi-x-lg')}No answer`,
		});
		const history = `<button type="button" class="btn btn-outline-secondary btn-sm" data-cfg-hook-sends="${index}" data-bs-toggle="offcanvas" data-bs-target="#cfg-sends" aria-controls="cfg-sends">Sends${hiddenText(` to ${name}`)}</button>`;
		const resume = loadingButton(
			'btn btn-sm btn-outline-secondary btn-loading',
			`data-cfg-hook-resume="${index}"`,
			{
				idle: 'Resume sending',
				busy: `${SPINNER}Checking`,
				fail: 'Still no answer',
			},
		);
		const pausedNotice =
			`<div class="alert basalt-alert basalt-alert-compact alert-danger cfg-hook-alert" role="status"><span class="basalt-alert-icon" aria-hidden="true"><i class="bi bi-exclamation-octagon"></i></span>` +
			'<div class="basalt-alert-body"><p class="basalt-alert-title">Paused on Sep 28</p><p class="basalt-alert-text">No answer for 24 hours, so we stopped sending. Send a test, then turn it back on.</p></div>' +
			`<div class="basalt-alert-actions">${resume}</div></div>`;

		return listRow({
			iconName: 'bi-broadcast',
			title: `${name} ${endpointPill(endpoint)}`,
			sub: htmlSafe(endpoint.url),
			subClass: ' cfg-mono',
			extra:
				`<div class="cfg-chips">${endpoint.topics.map((topic) => `<span class="cfg-chip">${htmlSafe(topic)}</span>`).join('')}</div>` +
				`<p class="cfg-hook-rate"><strong>${endpoint.successRate.toFixed(1)}%</strong> answered in the last 7 days</p>` +
				`<div class="cfg-hook-meter" aria-hidden="true"><span data-w="${endpoint.successRate}"></span></div>`,
			actions: switchHtml + test + history,
			tail: endpoint.paused ? pausedNotice : '',
		});
	}

	function drawEndpoints() {
		const endpointList = pick('[data-cfg-hooks]', page);
		endpointList.innerHTML = shop.endpoints.map(endpointRow).join('');
		widenBars(endpointList, 'data-w');
	}

	/** A paused address fails its first test and answers from the second on. */
	function answers(endpoint) {
		if (!endpoint.paused) return true;
		endpoint.testRuns = (endpoint.testRuns || 0) + 1;
		return endpoint.testRuns >= 2;
	}

	function mountWebhooks() {
		shop.endpoints = [
			{
				label: 'Order ledger',
				url: 'https://ledger.marlo.com/hooks/orders',
				topics: ['Order placed', 'Order shipped', 'Refund issued'],
				live: true,
				paused: false,
				successRate: 99.6,
			},
			{
				label: 'Accounting',
				url: 'https://hooks.ledgerly.app/in/7614',
				topics: ['Order placed', 'Refund issued'],
				live: true,
				paused: false,
				successRate: 98.1,
			},
			{
				label: 'Stock screen',
				url: 'https://screen.marlo.com/stock',
				topics: ['Stock low'],
				live: false,
				paused: true,
				successRate: 41.0,
				testRuns: 0,
			},
		];
		for (const endpoint of shop.endpoints) endpoint.deliveries = seedDeliveries(endpoint, 14);

		const endpointList = pick('[data-cfg-hooks]', page);
		endpointList.addEventListener('click', (event) => onEndpointButton(event, endpointList));
		endpointList.addEventListener('change', (event) => {
			const switchBox = event.target.closest('[data-cfg-hook-on]');
			if (!switchBox) return;
			const index = Number(switchBox.getAttribute('data-cfg-hook-on'));
			const endpoint = shop.endpoints[index];
			/* Switching a paused address on means the same as pressing Resume. */
			if (endpoint.paused && switchBox.checked) {
				switchBox.checked = false;
				pick(`[data-cfg-hook-resume="${index}"]`, endpointList)?.click();
				return;
			}
			endpoint.live = switchBox.checked;
			drawEndpoints();
			pick(`[data-cfg-hook-on="${index}"]`, endpointList).focus();
			notify({
				tone: endpoint.live ? 'success' : 'info',
				title: `${endpoint.label} ${endpoint.live ? 'turned on' : 'turned off'}`,
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							endpoint.live = !endpoint.live;
							drawEndpoints();
						},
					},
				],
			});
		});
		drawEndpoints();

		mountDeliveryDrawer();
		mountEndpointDrawer();
	}

	function onEndpointButton(event, endpointList) {
		const testButton = event.target.closest('[data-cfg-hook-test]');
		const resumeButton = event.target.closest('[data-cfg-hook-resume]');
		const button = testButton || resumeButton;
		if (!button || button.classList.contains('is-loading')) return;
		const index = Number(button.getAttribute('data-cfg-hook-test') || button.getAttribute('data-cfg-hook-resume'));
		const endpoint = shop.endpoints[index];
		buttonPhase(button, 'loading');
		pause(1300).then(() => {
			const host = endpoint.url.replace(/^https:\/\//, '').split('/')[0];
			if (!answers(endpoint)) {
				buttonPhase(button, 'error');
				notify({
					tone: 'danger',
					title: `No answer from ${host}`,
					text: 'Waited 10 seconds. Check the screen is switched on, then try again.',
				});
				setTimeout(() => buttonPhase(button, 'idle'), 2200);
				return;
			}
			if (resumeButton) {
				resumeEndpoint(endpoint, index, endpointList);
				return;
			}
			buttonPhase(button, 'success');
			const [firstTopic] = endpoint.topics;
			endpoint.deliveries.unshift({
				topic: firstTopic,
				at: DEMO_NOW,
				code: '200',
				took: 142,
				ref: `snd_test${endpoint.deliveries.length}`,
				test: true,
			});
			notify({
				tone: 'success',
				title: `${endpoint.label} answered`,
				text: `A test ${TOPICS[firstTopic]} got 200 OK in 142 ms.`,
			});
			setTimeout(() => buttonPhase(button, 'idle'), 1600);
		});
	}

	function resumeEndpoint(endpoint, index, endpointList) {
		Object.assign(endpoint, { paused: false, live: true, successRate: 96.8 });
		drawEndpoints();
		notify({
			tone: 'success',
			title: `${endpoint.label} is sending again`,
			text: 'Stock alerts from the last day go out now.',
		});
		pick(`[data-cfg-hook-on="${index}"]`, endpointList)?.focus();
	}

	function deliveryTime(stamp) {
		return new Date(stamp).toLocaleString('en-US', {
			timeZone: 'America/Los_Angeles',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
		});
	}

	function deliveryBody(delivery, index) {
		const sample =
			delivery.topic === 'Stock low'
				? { product: 'ML-SHLD Shield Sunglasses', units_left: 14 }
				: { order: `MO-${48210 - index * 7}`, total: '49.00', currency: 'USD' };
		return JSON.stringify(
			{
				id: delivery.ref,
				type: TOPICS[delivery.topic],
				created: new Date(delivery.at).toISOString(),
				data: sample,
			},
			null,
			2,
		);
	}

	function deliveryItem(delivery, index) {
		const ok = delivery.code === '200';
		const meta = `${deliveryTime(delivery.at)} · ${ok ? `${delivery.took} ms` : 'no answer in 10 s'}`;
		const retry = ok
			? ''
			: loadingButton('btn btn-sm btn-outline-secondary btn-loading', `data-cfg-send-again="${index}"`, {
					idle: `${iconTag('bi-arrow-repeat')}Send again`,
					busy: `${SPINNER}Sending`,
					fail: `${iconTag('bi-x-lg')}No answer`,
				});
		return (
			`<li><details class="cfg-send" data-cfg-send="${index}"><summary>${badge(ok ? 'success' : 'danger', ok ? '200' : htmlSafe(delivery.code))}` +
			`<span class="cfg-send-event">${htmlSafe(TOPICS[delivery.topic])}${delivery.test ? ' (test)' : ''}<span class="cfg-send-meta">${meta}</span></span>` +
			`${iconTag('bi-chevron-right')}</summary><div class="cfg-send-body"><pre>${htmlSafe(deliveryBody(delivery, index))}</pre>${retry}</div></details></li>`
		);
	}

	function mountDeliveryDrawer() {
		const sheet = pick('#cfg-sends');
		const deliveryList = pick('[data-cfg-sends-list]', sheet);
		const nothingFailed = pick('[data-cfg-sends-empty]', sheet);
		const filter = pick('[data-cfg-sends-filter]', sheet);
		let viewing = null;

		function drawDeliveries() {
			if (!viewing) return;
			const failedOnly = pick('#cfg-sends-failed').checked;
			const shown = viewing.deliveries
				.map((delivery, index) => ({ delivery, index }))
				.filter(({ delivery }) => !failedOnly || delivery.code !== '200');
			deliveryList.innerHTML = shown.map(({ delivery, index }) => deliveryItem(delivery, index)).join('');
			deliveryList.hidden = !shown.length;
			nothingFailed.hidden = shown.length > 0;
		}

		sheet.addEventListener('show.bs.offcanvas', (event) => {
			const opener = event.relatedTarget?.closest('[data-cfg-hook-sends]');
			if (opener) viewing = shop.endpoints[Number(opener.getAttribute('data-cfg-hook-sends'))];
			if (!viewing) return;
			const failures = viewing.deliveries.filter((delivery) => delivery.code !== '200').length;
			pick('[data-cfg-sends-title]', sheet).textContent = `Sends to ${viewing.label}`;
			pick('[data-cfg-sends-sub]', sheet).textContent =
				`${quantity(viewing.deliveries.length, 'send')} in the last day, ${failures} failed`;
			pick('#cfg-sends-all').checked = true;
			filter.dispatchEvent(new Event('change'));
			drawDeliveries();
		});
		filter.addEventListener('change', drawDeliveries);

		deliveryList.addEventListener('click', (event) => {
			const button = event.target.closest('[data-cfg-send-again]');
			if (!button || button.classList.contains('is-loading')) return;
			const delivery = viewing.deliveries[Number(button.getAttribute('data-cfg-send-again'))];
			buttonPhase(button, 'loading');
			pause(1000).then(() => {
				if (viewing.paused) {
					buttonPhase(button, 'error');
					notify({
						tone: 'danger',
						title: 'Still no answer',
						text: `${viewing.label} is paused. Resume it first.`,
					});
					setTimeout(() => buttonPhase(button, 'idle'), 2000);
					return;
				}
				Object.assign(delivery, { code: '200', took: 118 });
				const index = viewing.deliveries.indexOf(delivery);
				drawDeliveries();
				/* The retried row may have dropped out of the Failed view; keep focus inside the drawer. */
				const landing =
					pick(`[data-cfg-send="${index}"] summary`, deliveryList) ||
					pick('summary', deliveryList) ||
					pick('.btn-close', sheet);
				landing.focus();
				notify({ tone: 'success', title: 'Sent again', text: `${TOPICS[delivery.topic]} got 200 OK.` });
			});
		});
	}

	function mountEndpointDrawer() {
		const sheet = pick('#cfg-hook');
		const form = pick('[data-cfg-hook-form]', sheet);
		const topicsProblem = pick('[data-cfg-hook-events-err]', sheet);

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const invalid = window.Basalt.dialog.flagFields([pick('#cfg-hook-name'), pick('#cfg-hook-url')]);
			const topics = pickAll('[data-cfg-hook-events] input:checked', sheet).map((box) => box.value);
			topicsProblem.textContent = topics.length ? '' : 'Check at least one thing to send.';
			if (invalid) {
				invalid.focus();
				return;
			}
			if (!topics.length) {
				pick('[data-cfg-hook-events] input', sheet).focus();
				return;
			}
			const endpoint = {
				label: pick('#cfg-hook-name').value.trim(),
				url: pick('#cfg-hook-url').value.trim(),
				topics,
				live: true,
				paused: false,
				successRate: 100,
				deliveries: [],
			};
			shop.endpoints.push(endpoint);
			drawEndpoints();
			bootstrap.Offcanvas.getOrCreateInstance(sheet).hide();
			notify({ tone: 'success', title: `${endpoint.label} added`, text: 'Send a test to check it answers.' });
		});
		sheet.addEventListener('hidden.bs.offcanvas', () => {
			form.reset();
			window.Basalt.dialog.clearFlags(form);
			topicsProblem.textContent = '';
		});
	}

	/* Security: the 2-step rules, the network allow list and signed-in devices. */

	function validNetwork(text) {
		const parts = text.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?$/);
		if (!parts) return false;
		const octetsOk = parts.slice(1, 5).every((octet) => Number(octet) <= 255);
		return octetsOk && (parts[5] === undefined || Number(parts[5]) <= 32);
	}

	function addressNumber(dotted) {
		return dotted.split('.').reduce((total, octet) => total * 256 + Number(octet), 0);
	}

	/** True when `address` falls inside `network` (a single address or a CIDR range). */
	function networkHolds(network, address) {
		const [base, prefix] = network.split('/');
		const blockSize = 2 ** (32 - (prefix === undefined ? 32 : Number(prefix)));
		return Math.floor(addressNumber(base) / blockSize) === Math.floor(addressNumber(address) / blockSize);
	}

	function mountSecurity() {
		const everyone = pick('#cfg-2fa-all');
		const leaders = pick('#cfg-2fa-admin');
		function lockLeaders() {
			if (everyone.checked) leaders.checked = true;
			leaders.disabled = everyone.checked;
		}
		everyone.addEventListener('change', lockLeaders);
		lockLeaders();

		mountAllowList();
		mountDevices();
	}

	function mountAllowList() {
		const myAddress = '203.0.113.9';
		const networks = pick('[data-cfg-ips]', page);
		const message = pick('[data-cfg-ip-note]', page);

		networks.addEventListener('change', () => {
			const entered = networks.basaltTags.get();
			const rejected = entered.find((value) => !validNetwork(value));
			if (rejected !== undefined) {
				networks.basaltTags.set(entered.filter(validNetwork));
				message.textContent = `"${rejected}" isn't a network address. Use four numbers, like 203.0.113.9, or a range like 10.0.0.0/24.`;
				return;
			}
			if (!entered.length) message.textContent = 'The list is empty, so the admin works from any network.';
			else if (entered.some((network) => networkHolds(network, myAddress)))
				message.textContent = `Your address now is ${myAddress}, which is on the list.`;
			else
				message.textContent = `Careful: your address now, ${myAddress}, isn't on the list. Saving would sign you out.`;
		});
		networks.addEventListener('basalt:tags-duplicate', (event) => {
			message.textContent = `${event.detail.value} is on the list already.`;
		});
	}

	function drawSessions() {
		const sessionList = pick('[data-cfg-devices]', page);
		sessionList.innerHTML = shop.sessions
			.map((session, index) =>
				listRow({
					iconName: session.glyph,
					title: `${htmlSafe(session.device)}${session.current ? ` ${badge('success dot', 'This device')}` : ''}`,
					sub: `${htmlSafe(session.place)}${session.current ? '' : ` · ${htmlSafe(session.seen)}`}`,
					actions: session.current
						? ''
						: confirmButton(
								'btn-outline-secondary',
								`data-cfg-device-out="${index}"`,
								`Sign out${hiddenText(` ${htmlSafe(session.device)}`)}`,
							),
				}),
			)
			.join('');
		pick('[data-cfg-signout-all]', page).hidden = shop.sessions.length <= 1;
		enhanceButtons(sessionList);
	}

	function mountDevices() {
		shop.sessions = [
			{
				device: 'MacBook Pro, Chrome',
				place: 'Eugene',
				seen: 'This device',
				glyph: 'bi-laptop',
				current: true,
			},
			{ device: 'iPhone, Safari', place: 'Eugene', seen: '2 hours ago', glyph: 'bi-phone' },
			{
				device: 'iPad, Safari',
				place: 'Shared iPad at the packing bench',
				seen: 'Yesterday',
				glyph: 'bi-tablet',
			},
			{ device: 'Windows PC, Edge', place: 'Tacoma', seen: 'Sep 21', glyph: 'bi-pc-display' },
		];
		const sessionList = pick('[data-cfg-devices]', page);
		const signOutRest = pick('[data-cfg-signout-all]', page);
		const heading = pick('#cfg-devices-title');

		sessionList.addEventListener('basalt:confirm', (event) => {
			const button = event.target.closest('[data-cfg-device-out]');
			if (!button) return;
			const [session] = shop.sessions.splice(Number(button.getAttribute('data-cfg-device-out')), 1);
			drawSessions();
			const landing = pick('[data-cfg-device-out]', sessionList) || signOutRest;
			if (landing && !landing.hidden) landing.focus();
			notify({
				tone: 'info',
				icon: 'bi-box-arrow-right',
				title: `${session.device} signed out`,
				text: 'It needs the password and a code to get back in.',
			});
		});
		signOutRest.addEventListener('basalt:confirm', () => {
			const others = shop.sessions.length - 1;
			shop.sessions = shop.sessions.filter((session) => session.current);
			drawSessions();
			heading.focus();
			notify({
				tone: 'info',
				icon: 'bi-box-arrow-right',
				title: `${quantity(others, 'device')} signed out`,
				text: 'Only this one is still signed in.',
			});
		});
		heading.tabIndex = -1;
		drawSessions();
	}

	/* Data: nightly backups, backup on demand, restore, and the export. */

	const BACKUP_OUTCOMES = {
		failed: `${badge('danger', 'Failed', 'bi-x-circle-fill')}<span class="cfg-sub">Storage refused the upload</span>`,
		partial: `${badge('warning', 'Partial', 'bi-pie-chart-fill')}<span class="cfg-sub">Photos skipped, data complete</span>`,
		ok: badge('success', 'Complete', 'bi-check-circle-fill'),
	};

	function backupRow(snapshot, index) {
		const size = snapshot.gigabytes ? `${snapshot.gigabytes} GB` : '<span class="cfg-sub d-inline">No file</span>';
		const forWhen = hiddenText(` the backup from ${htmlSafe(snapshot.label)}`);
		const actions =
			snapshot.outcome === 'failed'
				? ''
				: '<div class="d-inline-flex gap-2">' +
					`<button type="button" class="btn btn-sm btn-outline-secondary" data-cfg-backup-dl="${index}">${iconTag('bi-download me-1')}Download${forWhen}</button>` +
					`<button type="button" class="btn btn-sm btn-outline-secondary" data-cfg-backup-restore="${index}">${iconTag('bi-clock-history me-1')}Restore${forWhen}</button></div>`;
		return (
			`<tr><td><span class="cfg-strong">${htmlSafe(snapshot.label)}</span><span class="cfg-sub">${htmlSafe(snapshot.origin)}</span></td>` +
			`<td class="cfg-mono">${size}</td><td>${BACKUP_OUTCOMES[snapshot.outcome]}</td><td>${actions}</td></tr>`
		);
	}

	function mountBackups() {
		for (let night = 0; night < 21; night += 1) {
			const started = new Date(Date.UTC(2026, 8, 28 - night, 6, 30));
			const outcome = night < 2 ? 'failed' : night === 7 ? 'partial' : 'ok';
			shop.snapshots.push({
				label: `${started.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}, 11:30 PM`,
				gigabytes: outcome === 'failed' ? null : (2.21 - night * 0.012 + random() * 0.03).toFixed(2),
				outcome,
				origin: 'Nightly',
			});
		}
		const rows = pick('[data-cfg-backup-rows]', page);
		const pagerBox = pick('[data-cfg-backup-pager]', page);
		const pageSize = 7;

		function drawBackups(fromRow, toRow) {
			rows.innerHTML = shop.snapshots
				.slice(fromRow - 1, toRow)
				.map((snapshot, offset) => backupRow(snapshot, fromRow - 1 + offset))
				.join('');
		}
		const pagerOptions = { total: shop.snapshots.length, perPage: pageSize, noun: 'backups', render: drawBackups };
		const pager = window.Basalt.pager(pagerBox, pagerOptions);

		const backUpNow = pick('[data-cfg-backup-now]', page);
		backUpNow.addEventListener('click', () => {
			if (backUpNow.classList.contains('is-loading')) return;
			buttonPhase(backUpNow, 'loading');
			let progress = 0;
			function advance() {
				progress = Math.min(1, progress + 0.08 + random() * 0.06);
				window.Basalt.buttonProgress(backUpNow, progress);
				if (progress < 1) {
					setTimeout(advance, prefersStill() ? 40 : 170);
					return;
				}
				shop.snapshots.unshift({
					label: 'Sep 29, 2:05 PM',
					gigabytes: '2.22',
					outcome: 'ok',
					origin: 'Made by you',
				});
				pagerOptions.total = shop.snapshots.length;
				pager.setTotal(Math.ceil(pagerOptions.total / pageSize));
				pager.set(1);
				drawBackups(1, pageSize);
				pick('[data-basalt-pager-range]', pagerBox).innerHTML =
					`<strong>1–${pageSize}</strong> of ${pagerOptions.total} backups`;
				buttonPhase(backUpNow, 'success');
				pick('[data-cfg-backup-sum]', page).textContent =
					'Backed up just now. The next nightly backup starts at 11:30 PM.';
				notify({ tone: 'success', title: 'Backup finished', text: '2.22 GB, kept for 90 days.' });
				setTimeout(() => buttonPhase(backUpNow, 'idle'), 1600);
			}
			setTimeout(advance, 200);
		});

		mountRestore(rows);
		mountExport();
	}

	function mountRestore(rows) {
		const dialog = pick('#cfg-restore');
		const content = pick('.modal-content', dialog);
		let chosenLabel;

		rows.addEventListener('click', (event) => {
			const download = event.target.closest('[data-cfg-backup-dl]');
			const restore = event.target.closest('[data-cfg-backup-restore]');
			if (download) {
				const snapshot = shop.snapshots[Number(download.getAttribute('data-cfg-backup-dl'))];
				const fileName = `basalt-backup-${snapshot.label.replace(/[, :]+/g, '-').toLowerCase()}.txt`;
				offerFile(
					fileName,
					`Marlo Clothing backup\nMade: ${snapshot.label}\nSize: ${snapshot.gigabytes} GB\n\nIn a live shop this downloads the full backup file.`,
				);
				notify({ tone: 'success', title: 'Download started', text: fileName, duration: 3000 });
			}
			if (restore) {
				chosenLabel = shop.snapshots[Number(restore.getAttribute('data-cfg-backup-restore'))].label;
				pick('[data-cfg-restore-when]', dialog).textContent = chosenLabel;
				window.Basalt.dialog?.clearDone(content);
				bootstrap.Modal.getOrCreateInstance(dialog).show(restore);
			}
		});
		pick('[data-cfg-restore-hold]', dialog).addEventListener('basalt:confirm', () => {
			window.Basalt.dialog.done(
				content,
				`Going back to ${chosenLabel}. We'll email you when the shop is open again.`,
			);
		});
		dialog.addEventListener('hidden.bs.modal', () => window.Basalt.dialog.clearDone(content));
	}

	/** Five sample rows of one kind of record for the export file. */
	function exportSample(kind, draw) {
		return Array.from({ length: 5 }, (_, row) => {
			if (kind === 'orders')
				return {
					order: `MO-${48210 - row}`,
					total: (18 + Math.floor(draw() * 60)).toFixed(2),
					status: anyOf(['Packed', 'Shipped', 'Delivered']),
				};
			if (kind === 'customers')
				return { name: `${GIVEN[row]} ${FAMILY[row + 3]}`, orders: 1 + Math.floor(draw() * 12) };
			if (kind === 'products')
				return {
					name: [
						'Sculpted Shoulder Blazer',
						'Draped Column Gown',
						'Tiered Organza Dress',
						'Two-Tone Oxfords',
						'Shield Sunglasses',
					][row],
					stock: Math.floor(draw() * 90),
				};
			return {
				plan: anyOf(['Aftercare Plan, 12 months', 'Aftercare Plan, 8 months', 'Express Delivery Pass']),
				customer: `${GIVEN[row + 5]} ${FAMILY[row]}`,
			};
		});
	}

	function asCsv(kinds, tables) {
		return kinds
			.map((kind) => {
				const records = tables[kind];
				const csvRows = records.map((record) => Object.values(record).join(','));
				return `# ${kind}\n${Object.keys(records[0]).join(',')}\n${csvRows.join('\n')}`;
			})
			.join('\n\n');
	}

	function mountExport() {
		const run = pick('[data-cfg-export]', page);
		const message = pick('[data-cfg-export-note]', page);
		run.addEventListener('click', () => {
			if (run.classList.contains('is-loading')) return;
			const kinds = pickAll('[data-cfg-export-what] input:checked', page).map((box) => box.value);
			if (!kinds.length) {
				message.textContent = 'Check at least one thing to export.';
				pick('[data-cfg-export-what] input', page).focus();
				return;
			}
			const asJson = pick('#cfg-export-json').checked;
			buttonPhase(run, 'loading');
			pause(1000).then(() => {
				const draw = seededRandom(29);
				const tables = {};
				for (const kind of kinds) tables[kind] = exportSample(kind, draw);
				const fileName = `basalt-export-2026-09-29.${asJson ? 'json' : 'csv'}`;
				const contents = asJson ? JSON.stringify(tables, null, 2) : asCsv(kinds, tables);
				const bytes = offerFile(fileName, contents, asJson ? 'application/json' : 'text/csv');
				buttonPhase(run, 'success');
				message.textContent = `${fileName}, ${readableSize(bytes)}. A live shop exports every row.`;
				setTimeout(() => buttonPhase(run, 'idle'), 1600);
			});
		});
		pick('[data-cfg-export-what]', page).addEventListener('change', () => {
			message.textContent = '';
		});
	}

	/* Advanced: the danger zone actions and the hand-over list of admins. */

	function fillNewOwnerList() {
		const select = pick('[data-cfg-transfer-to]');
		select.innerHTML = shop.members
			.filter(({ role }) => role === 'Admin')
			.map(({ name: adminName }) => `<option>${htmlSafe(adminName)}</option>`)
			.join('');
		window.Basalt.select?.refresh(select);
	}

	function mountAdvanced() {
		page.addEventListener('basalt:confirm', (event) => {
			if (!event.target.closest('[data-cfg-danger="cache"]')) return;
			notify({
				tone: 'success',
				title: 'Saved prices cleared',
				text: 'Pages may be a little slower for a few minutes.',
			});
		});

		const rebuild = pick('[data-cfg-danger="search"]', page);
		rebuild.addEventListener('click', () => {
			if (rebuild.classList.contains('is-loading')) return;
			buttonPhase(rebuild, 'loading');
			pause(1800).then(() => {
				buttonPhase(rebuild, 'success');
				notify({
					tone: 'success',
					title: 'Search rebuilt',
					text: '14 products and 2,140 customers are searchable again.',
				});
				setTimeout(() => buttonPhase(rebuild, 'idle'), 1600);
			});
		});

		fillNewOwnerList();
		const handOver = pick('#cfg-transfer');
		const handOverContent = pick('.modal-content', handOver);
		pick('[data-cfg-transfer-hold]', handOver).addEventListener('basalt:confirm', () => {
			const successor = pick('[data-cfg-transfer-to]').value;
			window.Basalt.dialog.done(
				handOverContent,
				`${successor} has two days to accept. Nothing changes until they do.`,
			);
		});
		handOver.addEventListener('hidden.bs.modal', () => window.Basalt.dialog.clearDone(handOverContent));

		const closing = pick('#cfg-close');
		const closingContent = pick('.modal-content', closing);
		pick('[data-cfg-close-go]', closing).addEventListener('click', () => window.Basalt.dialog.done(closingContent));
		closing.addEventListener('hidden.bs.modal', () => {
			window.Basalt.dialog.clearDone(closingContent);
			pick('[data-basalt-type-confirm]', closing).basaltTyped?.reset();
		});
	}

	/* "Download settings" writes every saved value, grouped by section, to a JSON file. */

	function mountSettingsDownload() {
		pick('[data-cfg-export-all]', page).addEventListener('click', () => {
			const bySection = {};
			for (const [field, saved] of baseline) {
				if (!field.isConnected || (field.type === 'radio' && !saved)) continue;
				const section = sectionTitle(sectionOf(field));
				const caption = describeField(field);
				const group = bySection[section] || (bySection[section] = {});
				if (field.type === 'radio') {
					group[caption] = field.value;
				} else if (field.type === 'checkbox' && !field.id) {
					group[caption] = group[caption] || [];
					if (saved) group[caption].push(field.value);
				} else {
					group[caption] = saved;
				}
			}
			const bytes = offerFile('basalt-settings.json', JSON.stringify(bySection, null, 2), 'application/json');
			notify({
				tone: 'success',
				title: 'Settings downloaded',
				text: `basalt-settings.json, ${readableSize(bytes)}. Saved values only.`,
			});
		});
	}

	document.addEventListener('DOMContentLoaded', start);
})();
