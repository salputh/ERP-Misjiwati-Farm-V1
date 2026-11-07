/**
 * One browser for four icon sets: bootstrap-icons.html, font-awesome.html,
 * lucide-icons.html and phosphor-icons.html. The [data-icx-page] wrapper
 * names its set in data-icx-lib, and the entries arrive from the matching
 * assets/js/data/icons-*-data.js file.
 *
 * Visitors narrow the set by words or meaning, by one of twelve shared
 * families, by style and by order; a slider scales every glyph and a row of
 * swatches tints them. Opening a glyph shows its snippets (HTML, class, SVG,
 * Unicode), sample sizes and its counterpart in the partner set. Glyphs can be
 * gathered into a kit that copies out as HTML or as one SVG sprite.
 *
 * Icon fonts carry no SVG source, so SVG snippets, sprites and partner glyphs
 * are requested from jsDelivr, which already serves the fonts. Offline, the
 * page explains that and the HTML snippet keeps working.
 */
(() => {
	'use strict';

	/* Where each set keeps one file per glyph, keyed by set. */
	const SVG_SOURCES = {
		bootstrap: (ref) => `https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/icons/${ref.name}.svg`,
		fontawesome: (ref) =>
			`https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@7.3.1/svgs/${ref.style}/${ref.name}.svg`,
		lucide: (ref) => `https://cdn.jsdelivr.net/npm/lucide-static@1.55.0/icons/${ref.name}.svg`,
		phosphor: (ref) => {
			const suffix = ref.style === 'regular' ? '' : `-${ref.style}`;
			return `https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/${ref.style}/${ref.name}${suffix}.svg`;
		},
	};

	const PHOSPHOR_WEIGHTS = ['regular', 'thin', 'light', 'bold', 'fill', 'duotone'];

	/* How to read each data file, how to spell a glyph's classes, and which set
     its twins live in. Lucide and Phosphor rows share one layout. */
	const LIBRARIES = {
		bootstrap: {
			label: 'Bootstrap',
			partner: 'fontawesome',
			href: 'bootstrap-icons.html',
			styles: [
				['outline', 'Outline'],
				['fill', 'Fill'],
				['all', 'All'],
			],
			parse: (data) =>
				data.icons.map(([name, cats, words, twin, unicode, similar]) => ({
					name,
					cats,
					words,
					unicode,
					twin,
					similar,
					styles: [name.endsWith('-fill') ? 'fill' : 'outline'],
				})),
			classFor: (entry) => `bi bi-${entry.name}`,
		},
		fontawesome: {
			label: 'Font Awesome',
			partner: 'bootstrap',
			href: 'font-awesome.html',
			styles: [
				['regular', 'Regular'],
				['solid', 'Solid'],
				['brands', 'Brands'],
				['all', 'All'],
			],
			parse: (data) =>
				data.icons.map(([name, mask, cats, words, unicode, twin, similar]) => ({
					name,
					cats,
					words,
					unicode,
					twin,
					similar,
					styles: [
						[1, 'solid'],
						[2, 'regular'],
						[4, 'brands'],
					]
						.filter(([bit]) => mask & bit)
						.map(([, style]) => style),
				})),
			classFor: (entry, style) => `fa-${style} fa-${entry.name}`,
		},
		lucide: {
			label: 'Lucide',
			partner: 'bootstrap',
			href: 'lucide-icons.html',
			styles: [['outline', 'Outline']],
			parse: (data) => readSharedRows(data, ['outline']),
			classFor: (entry) => `icon-${entry.name}`,
			/* Stroke-drawn, so sprite symbols inherit the root's paint settings. */
			keepPaint: true,
		},
		phosphor: {
			label: 'Phosphor',
			partner: 'bootstrap',
			href: 'phosphor-icons.html',
			styles: PHOSPHOR_WEIGHTS.map((weight) => [weight, weight[0].toUpperCase() + weight.slice(1)]),
			parse: (data) => readSharedRows(data, PHOSPHOR_WEIGHTS),
			classFor: (entry, style) => `${style === 'regular' ? 'ph' : `ph-${style}`} ph-${entry.name}`,
			keepPaint: true,
		},
	};

	/* Twelve families every set is sorted into. Each gathers a handful of the
     sets' own category names, and a glyph may belong to several. */
	const FAMILIES = [
		[
			'Interface',
			[
				'UI and keyboard',
				'Controls',
				'Layout',
				'Badges',
				'Sort and filter',
				'Apps',
				'Bootstrap',
				'Toggle',
				'Spinners',
				'Editing',
				'Coding',
				'Cursors',
				'System',
			],
		],
		['Arrows', ['Arrows', 'Box arrows', 'Carets', 'Chevrons', 'Shape arrows']],
		[
			'Alerts and status',
			[
				'Alerts, warnings, and signs',
				'Security',
				'Alert',
				'Punctuation + Symbols',
				'Notifications',
				'Security & warnings',
			],
		],
		[
			'Files and data',
			[
				'Files and folders',
				'Data',
				'Files',
				'Charts + Diagrams',
				'Connectivity',
				'File icons',
				'Charts',
				'Coding & development',
				'Technology & development',
			],
		],
		['Communication', ['Communications', 'Brand', 'Emoji', 'Love', 'Communication', 'Social', 'Brands', 'Mail']],
		[
			'Media and devices',
			[
				'Media',
				'Devices',
				'Entertainment',
				'Devices + Hardware',
				'Film + Video',
				'Music + Audio',
				'Photos + Images',
				'Media Playback',
				'Gaming',
				'Multimedia',
				'Photography',
				'Games',
			],
		],
		['Commerce', ['Commerce', 'Money', 'Shopping', 'Business', 'Marketing', 'Logistics', 'Finance', 'Finances']],
		[
			'People and health',
			[
				'People',
				'Hands',
				'Medical',
				'Users + People',
				'Accessibility',
				'Genders',
				'Childhood',
				'Medical + Health',
				'Humanitarian',
				'Charity',
				'Accounts & access',
				'Health & wellness',
			],
		],
		[
			'Places and travel',
			[
				'Buildings',
				'Geo',
				'Transportation',
				'Travel',
				'Maps',
				'Travel + Hotel',
				'Automotive',
				'Maritime',
				'Moving',
				'Camping',
				'Navigation & places',
				'Home',
				'Maps & travel',
			],
		],
		[
			'Time and weather',
			[
				'Date and time',
				'Weather',
				'Clouds',
				'Time',
				'Nature',
				'Astronomy',
				'Energy',
				'Disaster + Crisis',
				'Time & calendar',
				'Seasons',
				'Sustainability',
			],
		],
		[
			'Text and design',
			[
				'Typography',
				'Shapes',
				'Graphics',
				'Tools',
				'Text Formatting',
				'Writing',
				'Design',
				'Alphabet',
				'Mathematics',
				'Construction',
				'Formatting',
				'Editor',
				'Office',
			],
		],
		[
			'Everything else',
			[
				'Real world',
				'Miscellaneous',
				'Animals',
				'Clothing + Fashion',
				'Food + Beverage',
				'Fruits + Vegetables',
				'Halloween',
				'Holidays',
				'Household',
				'Religion',
				'Political',
				'Science',
				'Science Fiction',
				'Sports + Fitness',
				'Education',
				'Food & beverage',
				'Sports',
				'Objects',
			],
		],
	];

	/* Tints for the preview, shared by the toolbar and the dialog. */
	const SWATCHES = {
		text: { name: 'Text', paint: 'var(--basalt-copy)' },
		primary: { name: 'Primary', paint: 'var(--basalt-hue)' },
		'series-2': { name: 'Series 2', paint: 'var(--basalt-series-2)' },
		'series-3': { name: 'Series 3', paint: 'var(--basalt-series-3)' },
		'series-5': { name: 'Series 5', paint: 'var(--basalt-series-5)' },
		'series-6': { name: 'Series 6', paint: 'var(--basalt-series-6)' },
	};

	const BATCH = 168;
	const SAMPLE_SIZES = [16, 20, 24, 32, 48];
	const SNIPPET_NAMES = { html: 'HTML', class: 'Class', svg: 'SVG', unicode: 'Unicode' };
	const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
	const BLOCKED_COPY = 'Copying was blocked. Select the code and copy it instead.';

	const host = pick('[data-icx-page]');
	const libraryKey = host?.getAttribute('data-icx-lib');
	const library = LIBRARIES[libraryKey];
	const dataset = window.Basalt.icons?.[libraryKey];
	if (!host || !library || !dataset) return;

	const partnerKey = library.partner;
	const partner = LIBRARIES[partnerKey];
	const kitStorageKey = `basalt-icon-kit-${libraryKey}`;

	/* Every entry learns its families and one lowercase string to search in. */
	const catalog = library.parse(dataset);
	const entriesByName = new Map(catalog.map((entry) => [entry.name, entry]));
	const familyByCategory = dataset.categories.map((category) =>
		FAMILIES.findIndex(([, members]) => members.includes(category)),
	);
	for (const entry of catalog) {
		const familyHits = entry.cats.map((index) => familyByCategory[index]).filter((family) => family >= 0);
		const categoryNames = entry.cats.map((index) => dataset.categories[index]).join(' ');
		entry.groups = [...new Set(familyHits)];
		entry.hay = `${entry.name} ${entry.words} ${categoryNames}`.toLowerCase();
	}
	const scrambled = scrambleOnce(catalog);

	const ui = {
		board: pick('[data-icx-grid]'),
		moreButton: pick('[data-icx-more]'),
		tally: pick('[data-icx-count]'),
		families: pick('[data-icx-groups]'),
		styleSwitch: pick('[data-icx-styles]'),
		finder: pick('[data-icx-search]'),
		scale: pick('[data-icx-size]'),
		scaleReadout: pick('[data-icx-size-out]'),
		tray: pick('[data-icx-tray]'),
		trayGlyphs: pick('[data-icx-tray-icons]'),
		trayCaption: pick('[data-icx-tray-label]'),
		toast: pick('[data-icx-toast]'),
		dialog: pick('[data-icx-dialog]'),
	};
	Object.assign(ui, {
		stage: pick('[data-icx-stage]', ui.dialog),
		snippet: pick('[data-icx-code]', ui.dialog),
		snippetCopy: pick('[data-icx-copy]', ui.dialog),
		kitToggle: pick('[data-icx-kit]', ui.dialog),
		partnerSlot: pick('[data-icx-match]', ui.dialog),
	});

	const view = {
		query: '',
		family: -1,
		style: library.styles[0][0],
		order: 'az',
		scale: 28,
		swatch: 'text',
		limit: BATCH,
		kit: loadKit(),
		openName: null,
		snippet: 'html',
	};

	const svgRequests = new Map();
	let toastTimer = 0;
	let snippetTicket = 0;

	/* Toolbar actions in the order they are checked; the first attribute a
     clicked button carries decides what happens. */
	const TOOLBAR_ACTIONS = [
		['data-icx-style', chooseStyle],
		['data-icx-order', chooseOrder],
		['data-icx-group', chooseFamily],
		[
			'data-icx-ink',
			(key, button) => {
				if (!button.closest('[data-icx-dialog]')) applySwatch(key);
			},
		],
		['data-icx-more', revealNextBatch],
		['data-icx-add', toggleKit],
		['data-icx-open', openDetails],
	];

	start();

	function start() {
		paintStyleSwitch();
		paintSwatches();

		ui.finder.addEventListener('input', onFinderInput);
		ui.scale.addEventListener('input', onScaleInput);
		host.addEventListener('click', onToolbarClick);
		ui.tray.addEventListener('click', onTrayClick);
		ui.dialog.addEventListener('click', onDialogClick);
		ui.dialog.addEventListener('hidden.bs.modal', () => {
			view.openName = null;
		});

		redraw();
		drawTray();
		openFromAddress();
	}

	/* A link from the partner page carries ?icon=name; that glyph opens with
     every style showing so it is sure to be on the board. */
	function openFromAddress() {
		try {
			const requested = new URLSearchParams(window.location.search).get('icon');
			if (!requested || !entriesByName.has(requested)) return;
			view.style = 'all';
			for (const button of pickAll('[data-icx-style]')) {
				button.setAttribute('aria-pressed', String(button.getAttribute('data-icx-style') === 'all'));
			}
			redraw();
			if (document.readyState !== 'loading') {
				openDetails(requested);
				return;
			}
			document.addEventListener('DOMContentLoaded', () => openDetails(requested));
		} catch {
			/* A broken address simply leaves the page as it loaded. */
		}
	}

	/* The toolbar builds its own style and swatch buttons, then answers clicks. */
	function paintStyleSwitch() {
		ui.styleSwitch.innerHTML = library.styles
			.map(
				([key, name]) =>
					`<button type="button" class="icx-seg-btn" aria-pressed="${key === view.style}" data-icx-style="${key}">${name}</button>`,
			)
			.join('');
		/* With a single style there is nothing to switch between. */
		ui.styleSwitch.hidden = library.styles.length < 2;
	}

	function paintSwatches() {
		const buttons = Object.entries(SWATCHES)
			.map(
				([key, { name, paint }]) =>
					`<button type="button" class="icx-ink" title="${name}" aria-label="${name}" aria-pressed="${key === view.swatch}" data-icx-ink="${key}" style="--icx-ink:${paint}"></button>`,
			)
			.join('');
		for (const holder of pickAll('[data-icx-inks]')) holder.innerHTML = buttons;
	}

	function onFinderInput() {
		view.query = ui.finder.value.trim();
		view.limit = BATCH;
		drawBoard();
	}

	function onScaleInput() {
		view.scale = parseInt(ui.scale.value, 10);
		ui.scaleReadout.textContent = `${view.scale}px`;
		ui.board.style.setProperty('--icx-size', `${view.scale}px`);
	}

	function onToolbarClick(event) {
		const button = event.target.closest('button');
		if (!button || !host.contains(button)) return;
		const action = TOOLBAR_ACTIONS.find(([attribute]) => button.hasAttribute(attribute));
		if (!action) return;
		const [attribute, run] = action;
		run(button.getAttribute(attribute), button);
	}

	function chooseStyle(style, button) {
		view.style = style;
		view.limit = BATCH;
		markPressed('[data-icx-style]', button);
		redraw();
	}

	function chooseOrder(order, button) {
		view.order = order;
		view.limit = BATCH;
		markPressed('[data-icx-order]', button);
		drawBoard();
	}

	function chooseFamily(family, button) {
		view.family = parseInt(family, 10);
		view.limit = BATCH;
		markPressed('[data-icx-group]', button);
		drawBoard();
	}

	function revealNextBatch() {
		window.Basalt.slide(ui.board, () => {
			view.limit += BATCH;
			drawBoard();
		});
	}

	/** Presses `chosen` and releases every other button matching `selector`. */
	function markPressed(selector, chosen) {
		for (const button of pickAll(selector)) button.setAttribute('aria-pressed', String(button === chosen));
	}

	/** Tints the board and the dialog stage, and updates every swatch row. */
	function applySwatch(key) {
		view.swatch = key;
		for (const button of pickAll('[data-icx-ink]')) {
			button.setAttribute('aria-pressed', String(button.getAttribute('data-icx-ink') === key));
		}
		ui.board.style.setProperty('--icx-ink', SWATCHES[key].paint);
		ui.stage?.style.setProperty('--icx-ink', SWATCHES[key].paint);
	}

	/* The board shows one batch of matching glyphs at a time. */
	function redraw() {
		drawFamilies();
		drawBoard();
	}

	/* Family chips count only glyphs in the chosen style, and empty ones drop out. */
	function drawFamilies() {
		const inStyle = catalog.filter(hasChosenStyle);
		const chips = FAMILIES.map(([name], family) => {
			const total = inStyle.filter((entry) => entry.groups.includes(family)).length;
			return total ? familyChip(family, name, total) : '';
		});
		ui.families.innerHTML = familyChip(-1, 'All', inStyle.length) + chips.join('');
	}

	function familyChip(family, name, total) {
		return `<button type="button" class="icx-group" aria-pressed="${view.family === family}" data-icx-group="${family}">${name} <span>${total.toLocaleString()}</span></button>`;
	}

	function drawBoard() {
		const matches = currentMatches();
		const total = matches.length;
		ui.board.style.setProperty('--icx-size', `${view.scale}px`);
		ui.board.style.setProperty('--icx-ink', SWATCHES[view.swatch].paint);
		ui.board.innerHTML = total
			? matches.slice(0, view.limit).map(tileMarkup).join('')
			: `<p class="icx-empty">No icons match “${htmlSafe(view.query)}”. Try a shorter word, a different group, or All styles.</p>`;
		ui.moreButton.hidden = total <= view.limit;
		ui.moreButton.textContent = `Show ${Math.min(BATCH, total - view.limit).toLocaleString()} more of ${total.toLocaleString()}`;
		ui.tally.textContent = `${total.toLocaleString()} ${total === 1 ? 'icon' : 'icons'} shown`;
	}

	function currentMatches() {
		const terms = view.query.toLowerCase().split(/\s+/).filter(Boolean);
		const source = view.order === 'mixed' ? scrambled : catalog;
		return source.filter(
			(entry) =>
				hasChosenStyle(entry) &&
				(view.family < 0 || entry.groups.includes(view.family)) &&
				terms.every((term) => entry.hay.includes(term)),
		);
	}

	function tileMarkup(entry) {
		const collected = view.kit.includes(entry.name);
		const safeName = htmlSafe(entry.name);
		return [
			`<div class="icx-tile${collected ? ' is-in-kit' : ''}" data-icx-tile="${entry.name}">`,
			`<button type="button" class="icx-tile-open" aria-label="${safeName}, show details" data-icx-open="${entry.name}">${glyphMarkup(entry)}<span>${safeName}</span></button>`,
			`<button type="button" class="icx-tile-add" aria-label="${kitActionLabel(safeName, collected)}" aria-pressed="${collected}" data-icx-add="${entry.name}">${kitMarker(collected)}</button>`,
			'</div>',
		].join('');
	}

	function kitActionLabel(name, collected) {
		return collected ? `Remove ${name} from your kit` : `Add ${name} to your kit`;
	}

	function kitMarker(collected) {
		return `<i class="bi ${collected ? 'bi-check-lg' : 'bi-plus-lg'}" aria-hidden="true"></i>`;
	}

	function hasChosenStyle(entry) {
		return view.style === 'all' || entry.styles.includes(view.style);
	}

	/** The style a glyph is drawn in: the chosen one when it has it, else its first. */
	function styleFor(entry) {
		return view.style !== 'all' && entry.styles.includes(view.style) ? view.style : entry.styles[0];
	}

	function glyphMarkup(entry, style = styleFor(entry)) {
		return `<i class="${library.classFor(entry, style)}" aria-hidden="true"></i>`;
	}

	/** Lucide and Phosphor rows: [name, categories, words, unicode, twin, similar]. */
	function readSharedRows(data, styles) {
		return data.icons.map(([name, cats, words, unicode, twin, similar]) => ({
			name,
			cats,
			words,
			unicode,
			twin,
			similar,
			styles,
		}));
	}

	/* Seeded Fisher-Yates, so the Mixed order is identical on every visit. */
	function scrambleOnce(entries) {
		const deck = [...entries];
		let cursor = 7;
		function nextRandom() {
			cursor = (cursor * 16807) % 2147483647;
			return cursor / 2147483647;
		}
		for (let last = deck.length - 1; last > 0; last -= 1) {
			const swap = Math.floor(nextRandom() * (last + 1));
			[deck[last], deck[swap]] = [deck[swap], deck[last]];
		}
		return deck;
	}

	/* The kit is saved per set, so each page remembers its own picks. */
	function loadKit() {
		try {
			return JSON.parse(localStorage.getItem(kitStorageKey) || '[]').filter((name) => entriesByName.has(name));
		} catch {
			return [];
		}
	}

	function storeKit() {
		try {
			localStorage.setItem(kitStorageKey, JSON.stringify(view.kit));
		} catch {
			/* Private windows may refuse storage; the kit then lasts this visit. */
		}
	}

	function toggleKit(name) {
		const position = view.kit.indexOf(name);
		const collected = position === -1;
		if (collected) view.kit.push(name);
		else view.kit.splice(position, 1);
		storeKit();

		const tile = pick(`[data-icx-tile="${name}"]`, ui.board);
		if (tile) {
			const adder = pick('[data-icx-add]', tile);
			tile.classList.toggle('is-in-kit', collected);
			adder.setAttribute('aria-pressed', String(collected));
			adder.setAttribute('aria-label', kitActionLabel(name, collected));
			adder.innerHTML = kitMarker(collected);
		}
		drawTray();
		if (view.openName === name) drawKitToggle();
	}

	/* The tray and its export buttons stay out of sight while the kit is empty. */
	function drawTray() {
		const held = view.kit.length;
		ui.trayCaption.textContent = held ? `Your kit · ${held}` : 'Your kit is empty';
		ui.trayGlyphs.innerHTML = view.kit
			.map((name) => {
				const safeName = htmlSafe(name);
				return `<button type="button" class="icx-tray-icon" title="Remove ${safeName}" aria-label="Remove ${safeName} from your kit" data-icx-remove="${name}">${glyphMarkup(entriesByName.get(name))}</button>`;
			})
			.join('');
		ui.tray.hidden = !held;
		for (const button of pickAll('[data-icx-export]', ui.tray)) button.hidden = !held;
	}

	function onTrayClick(event) {
		const button = event.target.closest('button');
		if (!button) return;
		if (button.hasAttribute('data-icx-remove')) toggleKit(button.getAttribute('data-icx-remove'));
		const exporters = {
			html: () => copyText(kitAsHtml(), 'Kit HTML'),
			sprite: () => copyKitSprite(button),
		};
		exporters[button.getAttribute('data-icx-export')]?.();
	}

	function kitAsHtml() {
		return view.kit
			.map((name) => {
				const entry = entriesByName.get(name);
				return `<i class="${library.classFor(entry, styleFor(entry))}"></i>`;
			})
			.join('\n');
	}

	async function copyKitSprite(button) {
		button.disabled = true;
		let symbols;
		try {
			symbols = await Promise.all(
				view.kit.map((name) => {
					const entry = entriesByName.get(name);
					return loadSvg(libraryKey, { name, style: styleFor(entry) }).then((source) =>
						spriteSymbol(name, source),
					);
				}),
			);
		} catch {
			announce('The SVG sprite needs an internet connection. Copy the HTML instead.');
			button.disabled = false;
			return;
		}
		copyText(
			`<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n${symbols.join('\n')}\n</svg>`,
			'SVG sprite',
		);
		button.disabled = false;
	}

	/** Turns one glyph's SVG file into an indented `<symbol>` line for the sprite. */
	function spriteSymbol(name, source) {
		const viewBox = source.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 16 16';
		const uncommented = source.replace(/<!--[\s\S]*?-->/g, '');
		const body = uncommented
			.replace(/^[\s\S]*?<svg[^>]*>/, '')
			.replace(/<\/svg>\s*$/, '')
			.trim();
		/* Fill and stroke settings on the root element move onto the symbol. */
		const rootAttributes = uncommented.match(/<svg([^>]*)>/)?.[1] ?? '';
		const paint = library.keepPaint ? (rootAttributes.match(/\s(?:fill|stroke[a-z-]*)="[^"]*"/g) ?? []) : [];
		return `  <symbol id="${name}" viewBox="${viewBox}"${paint.join('')}>${body.replace(/\n\s*/g, '')}</symbol>`;
	}

	function openDetails(name) {
		const entry = entriesByName.get(name);
		if (!entry) return;
		const style = styleFor(entry);
		view.openName = name;

		ui.stage.innerHTML = glyphMarkup(entry, style);
		ui.stage.style.setProperty('--icx-ink', SWATCHES[view.swatch].paint);
		pick('[data-icx-name]', ui.dialog).textContent = entry.name;
		pick('[data-icx-tags]', ui.dialog).innerHTML = detailTags(entry, style);
		drawAlsoFoundBy(entry);
		pick('[data-icx-sizes]', ui.dialog).innerHTML = SAMPLE_SIZES.map(
			(px) =>
				`<span class="icx-dialog-size"><span style="font-size:${px}px">${glyphMarkup(entry, style)}</span>${px}</span>`,
		).join('');

		drawSnippet();
		drawKitToggle();
		drawPartner(entry);
		window.bootstrap.Modal.getOrCreateInstance(ui.dialog).show();
	}

	/* Category tags, plus the style shown when the set has more than one. */
	function detailTags(entry, style) {
		const tags = entry.cats.map((index) => dataset.categories[index]);
		if (library.styles.length > 1) {
			tags.push(library.styles.find(([key]) => key === style)?.[1] ?? style);
		}
		return tags.map((tag) => `<span class="icx-tag">${htmlSafe(tag)}</span>`).join('');
	}

	/* Search words that are not already part of the name, each listed once. */
	function drawAlsoFoundBy(entry) {
		const nameParts = entry.name.split('-');
		const extras = [...new Set(entry.words.split(' '))].filter((word) => word && !nameParts.includes(word));
		const line = pick('[data-icx-also]', ui.dialog);
		line.hidden = !extras.length;
		line.textContent = extras.length ? `Also found by: ${extras.slice(0, 10).join(', ')}` : '';
	}

	function onDialogClick(event) {
		const button = event.target.closest('button');
		if (!button) return;
		if (button.hasAttribute('data-icx-tab')) {
			view.snippet = button.getAttribute('data-icx-tab');
			drawSnippet();
		} else if (button.hasAttribute('data-icx-ink')) {
			applySwatch(button.getAttribute('data-icx-ink'));
		} else if (button === ui.snippetCopy) {
			copyText(ui.snippet.textContent.trim(), SNIPPET_NAMES[view.snippet]);
		} else if (button === ui.kitToggle) {
			toggleKit(view.openName);
		} else if (button.hasAttribute('data-icx-copy-ref')) {
			copyText(button.getAttribute('data-icx-copy-ref'), `${partner.label} HTML`);
		}
	}

	/* Text snippets are written at once; the SVG one is fetched, and a later
     tab or glyph wins over an answer that arrives late. */
	function drawSnippet() {
		const entry = entriesByName.get(view.openName);
		const style = styleFor(entry);
		const ticket = ++snippetTicket;

		for (const tab of pickAll('[data-icx-tab]', ui.dialog)) {
			const current = tab.getAttribute('data-icx-tab') === view.snippet;
			tab.classList.toggle('active', current);
			tab.setAttribute('aria-selected', String(current));
		}
		ui.snippetCopy.lastChild.textContent = `Copy ${SNIPPET_NAMES[view.snippet]}`;
		ui.snippetCopy.disabled = false;

		const writers = {
			html: () => `<i class="${library.classFor(entry, style)}"></i>`,
			class: () => library.classFor(entry, style),
			unicode: () => `\\${entry.unicode}    (CSS content: "\\${entry.unicode}")`,
		};
		const writer = writers[view.snippet];
		if (writer) {
			ui.snippet.textContent = writer();
			return;
		}

		ui.snippet.textContent = 'Loading the SVG…';
		ui.snippetCopy.disabled = true;
		loadSvg(libraryKey, { name: entry.name, style }).then(
			(source) => {
				if (ticket !== snippetTicket) return;
				ui.snippet.textContent = source.trim();
				ui.snippetCopy.disabled = false;
			},
			() => {
				if (ticket !== snippetTicket) return;
				ui.snippet.textContent =
					'The SVG could not be loaded. It comes from jsDelivr, so it needs an internet connection. The HTML snippet works offline.';
			},
		);
	}

	function drawKitToggle() {
		const collected = view.kit.includes(view.openName);
		const mark = collected ? 'bi-bookmark-check-fill' : 'bi-bookmark-plus';
		ui.kitToggle.innerHTML = `<i class="bi ${mark} me-1" aria-hidden="true"></i>${collected ? 'In your kit' : 'Add to kit'}`;
		ui.kitToggle.setAttribute('aria-pressed', String(collected));
	}

	/* The partner set's twin, else up to three look-alikes, else a plain note.
     Partner glyphs are drawn from that set's own SVG files. */
	function drawPartner(entry) {
		const refs = [];
		if (entry.twin) {
			const ref = readPartnerRef(entry.twin);
			refs.push(ref);
			ui.partnerSlot.innerHTML = [
				'<div class="icx-match">',
				`${partnerSlot(ref)}<div class="icx-match-text"><b>${htmlSafe(ref.name)}</b><span>Same icon in ${partner.label}</span></div>`,
				`<a class="btn btn-sm btn-outline-secondary" href="${partnerHref(ref)}">View</a>`,
				`<button type="button" class="btn btn-sm btn-outline-secondary" data-icx-copy-ref="${htmlSafe(partnerHtml(ref))}">Copy</button>`,
				'</div>',
			].join('');
		} else if (entry.similar.length) {
			const links = entry.similar.map((value) => {
				const ref = readPartnerRef(value);
				refs.push(ref);
				return `<a class="icx-similar-item" title="Open ${htmlSafe(ref.name)} on the ${partner.label} page" href="${partnerHref(ref)}">${partnerSlot(ref)}<span>${htmlSafe(ref.name)}</span></a>`;
			});
			ui.partnerSlot.innerHTML = `<p class="icx-similar-lead">No exact twin in ${partner.label}. Similar:</p><div class="icx-similar">${links.join('')}</div>`;
		} else {
			ui.partnerSlot.innerHTML = `<div class="icx-match"><span class="icx-match-glyph"><i class="bi bi-dash-circle" aria-hidden="true"></i></span><div class="icx-match-text"><b>Nothing similar</b><span>${partner.label} has no icon for this</span></div></div>`;
		}

		const slots = pickAll('[data-icx-glyph]', ui.partnerSlot);
		for (const [index, ref] of refs.entries()) fillPartnerGlyph(slots[index], ref);
	}

	function fillPartnerGlyph(slot, ref) {
		if (partnerKey === 'bootstrap') {
			slot.innerHTML = `<i class="bi bi-${ref.name}"></i>`;
			return;
		}
		loadSvg(partnerKey, ref).then(
			(source) => {
				slot.innerHTML = tintableSvg(source);
			},
			() => {
				slot.innerHTML = '<i class="bi bi-image" aria-hidden="true"></i>';
			},
		);
	}

	function partnerSlot(ref) {
		return `<span class="icx-match-glyph" aria-hidden="true" data-icx-glyph="${htmlSafe(`${ref.style}:${ref.name}`)}"></span>`;
	}

	function partnerHref(ref) {
		return `${partner.href}?icon=${encodeURIComponent(ref.name)}`;
	}

	function partnerHtml(ref) {
		return partnerKey === 'fontawesome'
			? `<i class="fa-${ref.style} fa-${ref.name}"></i>`
			: `<i class="bi bi-${ref.name}"></i>`;
	}

	/** Font Awesome references reach the Bootstrap page written as "style:name". */
	function readPartnerRef(value) {
		if (partnerKey !== 'fontawesome') return { style: 'outline', name: value };
		const [style, name] = value.split(':');
		return { style, name };
	}

	/** Fetches a glyph's SVG once; a failed request is forgotten so it can retry. */
	function loadSvg(key, ref) {
		const address = SVG_SOURCES[key](ref);
		let pending = svgRequests.get(address);
		if (pending) return pending;
		pending = fetch(address)
			.then((response) => {
				if (!response.ok) throw new Error(response.status);
				return response.text();
			})
			.catch((error) => {
				svgRequests.delete(address);
				throw error;
			});
		svgRequests.set(address, pending);
		return pending;
	}

	/* Comments go, and the root takes the text color so swatches apply. */
	function tintableSvg(source) {
		return source.replace(/<!--[\s\S]*?-->/g, '').replace('<svg ', '<svg fill="currentColor" aria-hidden="true" ');
	}

	function copyText(text, what) {
		if (!navigator.clipboard || !window.isSecureContext) {
			announce(BLOCKED_COPY);
			return;
		}
		navigator.clipboard.writeText(text).then(
			() => announce(`${what} copied.`),
			() => announce(BLOCKED_COPY),
		);
	}

	function announce(message) {
		if (!ui.toast) return;
		ui.toast.textContent = message;
		ui.toast.classList.add('is-on');
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => ui.toast.classList.remove('is-on'), 2200);
	}

	/* Small query and escaping helpers used throughout. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return String(value).replace(/[&<>"]/g, (character) => HTML_ENTITIES[character]);
	}
})();
