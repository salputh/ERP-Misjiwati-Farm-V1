/**
 * The Appearance popover beside the sun/moon switch in the top bar. It lets a
 * visitor pick the palette, light or dark, the page background, gradients,
 * the menu and header styles and whether the header sticks. Every page that
 * loads the shared chrome gets it, so the button and popover are built here
 * instead of being pasted into each page. Storing the choices is appearance.js's
 * job (it runs before first paint); this script only renders and reflects them.
 */
(() => {
	'use strict';

	const modeSwitch = document.querySelector('[data-basalt-chrome="mode"]');
	/* Full-screen apps have no top bar; a [data-basalt-appearance-open] item
	   in their workspace menu opens the same popover instead. */
	const menuItem = modeSwitch ? null : document.querySelector('[data-basalt-appearance-open]');
	const settings = window.Basalt.appearance;
	if ((!modeSwitch && !menuItem) || !settings) return;
	/* Settings fixed in appearance.js (SETTINGS.visitorsCanChange) get no row; with
	   nothing left to change, the panel and its button stay away. */
	const open = (hook) => (settings.canChange ? settings.canChange(hook) : true);

	/*
	 * Palettes in menu order, keyed by id, as [title, short hint]. The first is
	 * the house default, so it opens selected and leads the grid.
	 */
	const PALETTES = {
		dusk: ['Dusk', 'Violet'],
		tide: ['Tide', 'Blue'],
		scarlet: ['Scarlet', 'Red'],
		verdant: ['Verdant', 'Green'],
		mono: ['Mono', 'Black & white'],
		electric: ['Electric', 'High chroma'],
		jewel: ['Jewel', 'Deep tones'],
		duotone: ['Duotone', 'Two hues'],
		pastelpop: ['Pastel Pop', 'Soft tints'],
	};

	/* A swatch is the palette's first three chart colors in the active mode,
	   read from the tokens at run time, so every palette shows three. */
	const SWATCH_TOKENS = ['--basalt-series-1', '--basalt-series-2', '--basalt-series-3'];

	/*
	 * The segmented rows below the palette grid. `hook` names the data attribute
	 * on the row and, for every row except mode, the option it writes.
	 */
	const ROWS = [
		{
			hook: 'mode',
			title: 'Mode',
			choices: {
				light: '<i class="bi bi-brightness-high"></i> Light',
				dark: '<i class="bi bi-moon"></i> Dark',
			},
		},
		{ hook: 'surfaces', title: 'Background', choices: { tinted: 'Tinted', neutral: 'Neutral', plain: 'Plain' } },
		{ hook: 'gradients', title: 'Gradients', choices: { on: 'On', off: 'Flat' } },
		{ hook: 'sidebar', title: 'Menu', choices: { quiet: 'Quiet', pop: 'Pop', ink: 'Ink', floating: 'Floating' } },
		{
			hook: 'header',
			title: 'Header',
			choices: { hairline: 'Hairline', floating: 'Floating', grouped: 'Grouped' },
		},
		{ hook: 'sticky', title: 'Header position', choices: { on: 'Stays on top', off: 'Scrolls away' } },
	];

	/*
	 * Rows whose choice is not a plain appearance option. Neither moves the
	 * trigger, so neither needs the popover repositioned afterwards.
	 */
	const SPECIAL_WRITES = {
		pal: (value) => settings.set('palette', value),
		mode: (value) => window.Basalt.setTheme(value),
		device: (value) => {
			if (value !== 'desktop') setOpen(false);
			window.Basalt.devicePreview.show(value, button);
		},
	};

	/* The live demo's "Preview on" row, offered only when device-preview.js
	   has registered itself; the download leaves that script out. */
	const devices = window.Basalt.devicePreview;
	const DEVICE_ROW = {
		hook: 'device',
		title: 'Preview on',
		choices: {
			desktop: '<i class="bi bi-laptop"></i> Desktop',
			tablet: '<i class="bi bi-tablet"></i> Tablet',
			phone: '<i class="bi bi-phone"></i> Phone',
		},
	};

	/*
	 * The first-visit dot: until a visitor has opened the panel and closed it,
	 * the palette icon carries an unread dot, like the bell's.
	 *   'visit'  back on every refresh or new tab, gone while moving between pages
	 *   'once'   shown once per browser, then never again
	 *   'never'  no dot
	 */
	const INVITE = 'visit';
	const SEEN_KEY = 'basalt-appearance-seen';
	const inviting = !menuItem && INVITE !== 'never' && !hasSeen();
	const button =
		menuItem ||
		fromMarkup(`<button type="button" class="btn btn-icon basalt-appearance-trigger"
    aria-label="Customize appearance" aria-expanded="false"><i class="bi bi-palette" aria-hidden="true"></i>${
		inviting ? '<span data-basalt-appearance-pip aria-hidden="true" class="basalt-pip bg-danger"></span>' : ''
	}</button>`);
	/* What the popover hangs under: the button, or the menu's own toggle. */
	const anchorOf = () =>
		menuItem ? menuItem.closest('.dropdown')?.querySelector('[data-bs-toggle="dropdown"]') || menuItem : button;
	const popover = fromMarkup(popoverMarkup());
	if (!popover.querySelector('[data-pal], .basalt-appearance-seg')) return;
	const tokenReader = document.createElement('div');
	const rowHooks = new Map();

	start();

	/** Inserts the button and popover, wires every listener and shows the live state. */
	function start() {
		if (modeSwitch) modeSwitch.after(button);
		document.body.append(popover);

		tokenReader.style.display = 'none';
		document.body.append(tokenReader);

		const hooks = ['pal', ...ROWS.map((row) => row.hook), 'device'];
		for (const row of popover.querySelectorAll('[data-pal], .basalt-appearance-seg')) {
			rowHooks.set(
				row,
				hooks.find((name) => row.hasAttribute(`data-${name}`)),
			);
		}

		popover.addEventListener('click', onChoice);
		popover.querySelector('[data-pal]')?.addEventListener('keydown', onPaletteKey);
		popover.querySelector('.basalt-appearance-close').addEventListener('click', () => setOpen(false));
		button.addEventListener('click', () => setOpen(popover.hidden));

		/* The sun/moon switch changes the same setting, so any theme change re-reads it. */
		document.addEventListener('basalt:appearance', reflect);
		document.addEventListener('basalt:device-preview', reflect);
		document.addEventListener('click', ({ target }) => {
			const outside = !popover.contains(target) && !button.contains(target);
			if (!popover.hidden && outside) setOpen(false);
		});
		document.addEventListener('keydown', ({ key }) => {
			if (key === 'Escape' && !popover.hidden) setOpen(false);
		});

		window.addEventListener('resize', followButton);
		window.addEventListener('scroll', followButton, { passive: true });

		reflect();
	}

	/* Building the markup */

	/** Parses one HTML string and returns its first element. */
	function fromMarkup(html) {
		const scratch = document.createElement('template');
		scratch.innerHTML = html.trim();
		return scratch.content.firstElementChild;
	}

	/** The whole popover: heading, palette grid, then one segmented row per option. */
	function popoverMarkup() {
		/* The first palette is the default and says so under its name. */
		const tiles = Object.entries(PALETTES).map(
			([id, [title, hint]], index) =>
				`<button type="button" role="radio" aria-checked="false" tabindex="-1" class="basalt-appearance-chip" data-v="${id}" aria-label="${title}, ${hint.toLowerCase()}">` +
				'<span class="basalt-appearance-sw" aria-hidden="true"><i></i><i></i><i></i></span>' +
				`<span class="basalt-appearance-name" aria-hidden="true">${title}</span></button>`,
		);

		/* Rows only show for parts the page has: an app page, or a page like the
		   documentation without the sidebar menu and top bar, leaves those out. */
		const hasMenu = !menuItem && document.querySelector('.basalt-mainmenu');
		const hasTopbar = !menuItem && document.querySelector('.basalt-topbar');
		const shown = ROWS.filter(
			(row) =>
				open(row.hook) &&
				(row.hook !== 'sidebar' || hasMenu) &&
				(!['header', 'sticky'].includes(row.hook) || hasTopbar),
		);
		const rows = shown.map((row) => segmented(row));
		if (devices) rows.push(segmented(DEVICE_ROW, ' data-device-row'));

		return `<div class="basalt-appearance" hidden>
      <div class="basalt-appearance-head">
        <span class="basalt-appearance-title">Appearance</span>
        <button type="button" class="basalt-appearance-close" aria-label="Close"><i class="bi bi-x-lg"></i></button>
      </div>
      ${open('palette') ? block('Palette', `<div class="basalt-appearance-grid" data-pal role="radiogroup" aria-label="Palette">${tiles.join('')}</div>`) : ''}
      ${rows.join('\n')}
    </div>`;
	}

	/** One labeled row of segmented buttons, one button per choice. */
	function segmented({ hook, title, choices }, extra = '') {
		const buttons = Object.entries(choices).map(
			([value, label]) => `<button type="button" data-v="${value}">${label}</button>`,
		);
		return block(
			title,
			`<div class="basalt-appearance-seg" role="group" aria-label="${title}" data-${hook}>\n${buttons.join('\n')}\n</div>`,
			extra,
		);
	}

	/** One labeled block of the popover around the given control markup. */
	function block(title, control, extra = '') {
		return `<div class="basalt-appearance-section"${extra}>
      <span class="basalt-appearance-label">${title}</span>
      ${control}
    </div>`;
	}

	/* Reacting to choices */

	/**
	 * Handles a click anywhere in the popover; only option buttons act. Plain
	 * options may restyle the header, so the popover is moved to follow.
	 */
	function onChoice(event) {
		const option = event.target.closest('[data-v]');
		if (!option) return;

		const hook = rowHooks.get(option.parentElement);
		const { v: value } = option.dataset;
		const write = SPECIAL_WRITES[hook];
		if (write) {
			write(value);
			reflect();
			return;
		}

		settings.set(hook, value);
		/* Choosing the floating menu also floats the header. */
		if (hook === 'sidebar' && value === 'floating') settings.set('header', 'floating');
		reflect();
		pinUnderButton();
	}

	/** Opens or closes the popover and keeps the button's expanded state honest. */
	function setOpen(opened) {
		popover.hidden = !opened;
		button.setAttribute('aria-expanded', `${opened}`);
		if (!opened) {
			settleInvite();
			return;
		}
		reflect();
		pinUnderButton();
	}

	/* The first-visit invitation */

	/**
	 * Whether the dot was already cleared. 'visit' keeps the note for the tab
	 * and clears it on a reload; 'once' keeps it in the browser for good.
	 */
	function hasSeen() {
		try {
			if (INVITE === 'once') return localStorage.getItem(SEEN_KEY) === 'yes';
			if (performance.getEntriesByType('navigation')[0]?.type === 'reload') sessionStorage.removeItem(SEEN_KEY);
			return sessionStorage.getItem(SEEN_KEY) === 'yes';
		} catch {
			return false;
		}
	}

	/** Called on every close: the first one clears the dot. */
	function settleInvite() {
		const pip = button.querySelector('[data-basalt-appearance-pip]');
		if (!pip) return;
		pip.remove();
		try {
			(INVITE === 'once' ? localStorage : sessionStorage).setItem(SEEN_KEY, 'yes');
		} catch {
			/* Private windows may refuse storage; the dot still clears for this page. */
		}
	}

	/* Showing the live state */

	/** The active theme, treating "not chosen yet" as light. */
	function activeMode() {
		return window.Basalt.getTheme() || 'light';
	}

	/** Marks the pressed button in every row and recolors the swatches. */
	function reflect() {
		const live = { pal: settings.get('palette'), mode: activeMode(), device: devices?.current() };
		for (const { hook } of ROWS) if (hook !== 'mode') live[hook] = settings.get(hook);

		for (const [row, hook] of rowHooks) {
			for (const option of row.querySelectorAll('[data-v]')) {
				const on = option.dataset.v === live[hook];
				/* The palette grid is a radio group: one tab stop, on the choice. */
				if (hook === 'pal') {
					option.setAttribute('aria-checked', `${on}`);
					option.tabIndex = on ? 0 : -1;
				} else {
					option.setAttribute('aria-pressed', `${on}`);
				}
			}
		}

		tintSwatches(live.mode);
	}

	/**
	 * Fills each tile's marks with that palette's own colors, read from a hidden
	 * element dressed as the palette in the active mode, so none are hard-coded.
	 */
	function tintSwatches(mode) {
		for (const tile of popover.querySelectorAll('.basalt-appearance-chip')) {
			tokenReader.setAttribute('data-basalt-palette', tile.dataset.v);
			tokenReader.setAttribute('data-bs-theme', mode);
			const computed = getComputedStyle(tokenReader);
			const colors = SWATCH_TOKENS.map((token) => computed.getPropertyValue(token).trim());

			const marks = tile.querySelectorAll('.basalt-appearance-sw i');
			colors.forEach((color, index) => {
				if (color) marks[index].style.background = color;
			});
		}
	}

	/**
	 * Arrow keys move through the palette grid and choose as they go, as in any
	 * radio group; up and down jump a row. Home and End go to the ends.
	 */
	function onPaletteKey(event) {
		const tiles = [...event.currentTarget.querySelectorAll('[role="radio"]')];
		const at = tiles.indexOf(document.activeElement);
		if (at < 0) return;
		const columns = getComputedStyle(event.currentTarget).gridTemplateColumns.split(' ').length;
		const steps = { ArrowRight: 1, ArrowDown: columns, ArrowLeft: -1, ArrowUp: -columns };
		let next;
		if (event.key in steps) next = (at + steps[event.key] + tiles.length) % tiles.length;
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = tiles.length - 1;
		else return;
		event.preventDefault();
		tiles[next].focus();
		tiles[next].click();
	}

	/* Positioning */

	/** Keeps an open popover attached to the button on resize and scroll. */
	function followButton() {
		if (!popover.hidden) pinUnderButton();
	}

	/**
	 * Hangs the popover 8px under the button, wherever the header style has put
	 * it; on wide screens it also lines up with the button's right edge.
	 */
	function pinUnderButton() {
		const anchor = anchorOf().getBoundingClientRect();
		const { innerWidth: viewWidth, innerHeight: viewHeight } = window;
		const top = Math.max(anchor.bottom + 8, 8);

		popover.style.top = `${top}px`;
		popover.style.maxHeight = `${viewHeight - top - 16}px`;
		/* Under a top-bar button it lines up on the right; under an app's menu,
		   which sits at the left of the screen, on the left. */
		if (menuItem && viewWidth > 480) {
			popover.style.left = `${Math.max(anchor.left, 8)}px`;
			popover.style.right = 'auto';
		} else {
			popover.style.right = viewWidth > 480 ? `${Math.max(viewWidth - anchor.right, 8)}px` : '';
		}
	}
})();
