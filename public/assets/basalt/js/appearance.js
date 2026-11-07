/**
 * Decides how every Basalt page looks before it paints: light or dark mode,
 * plus the appearance options (palette, surface tint, gradients, header
 * style, sticky header, menu style, menu width). SETTINGS below sets what a
 * first visit gets and which of these visitors may change. It also lends
 * page scripts the color helpers their charts are drawn with, and brings
 * charts that already exist back in line whenever any of this changes.
 * Every page loads it, ahead of the other scripts.
 */

(() => {
	'use strict';

	/* The site's appearance, in one place.
	 *
	 * `start` is what everyone sees on a first visit. `visitorsCanChange` lists
	 * the settings visitors may change from the Appearance panel, the light and
	 * dark switch and the menu width button. Leave a setting out of that list
	 * to fix it to its start value for everyone: a choice a visitor saved
	 * earlier is then ignored, and the control for it disappears. An empty
	 * list fixes every setting and removes the panel and the switch.
	 *
	 *   mode       'system' follows the device, or 'light', or 'dark'
	 *   palette    dusk, tide, scarlet, verdant, mono, electric, jewel,
	 *              duotone, pastelpop
	 *   surfaces   tinted, neutral, plain
	 *   gradients  on, off
	 *   header     hairline, floating, grouped
	 *   sticky     on (the top bar stays on top), off (it scrolls away)
	 *   sidebar    quiet, pop, ink, floating
	 *   menuWidth  wide, narrow (the strip of section icons)
	 */
	const SETTINGS = {
		start: {
			mode: 'system',
			palette: 'dusk',
			surfaces: 'tinted',
			gradients: 'on',
			header: 'hairline',
			sticky: 'on',
			sidebar: 'quiet',
			menuWidth: 'wide',
		},
		visitorsCanChange: ['mode', 'palette', 'surfaces', 'gradients', 'header', 'sticky', 'sidebar', 'menuWidth'],
	};

	const html = document.documentElement;
	const MODE_KEY = 'basalt-mode';
	const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

	/* One row per appearance option: the storage key that remembers it, the
	 * attribute on <html> that carries it, what a first visit gets, and which
	 * value is the stylesheet's untouched base and so needs no attribute. Dusk
	 * is both the palette pages ship in and the stylesheet's base, so a page
	 * wears it even before this script runs; choosing any other palette, Tide
	 * included, sets the attribute. Where a row lists
	 * its allowed looks, a stored value outside that list is ignored. The
	 * first-visit values are then taken from SETTINGS.start. */
	const OPTIONS = {
		palette: { stored: 'basalt-palette', attribute: 'data-basalt-palette', initial: 'dusk', bare: 'dusk' },
		surfaces: { stored: 'basalt-surfaces', attribute: 'data-basalt-surfaces', initial: 'tinted', bare: 'tinted' },
		gradients: { stored: 'basalt-gradients', attribute: 'data-basalt-gradients', initial: 'on', bare: 'on' },
		header: {
			stored: 'basalt-topbar',
			attribute: 'data-basalt-header',
			initial: 'hairline',
			bare: 'hairline',
			allowed: ['hairline', 'floating', 'grouped'],
		},
		sticky: { stored: 'basalt-header-sticky', attribute: 'data-basalt-header-sticky', initial: 'on', bare: 'on' },
		sidebar: {
			stored: 'basalt-mainmenu',
			attribute: 'data-basalt-menu-look',
			initial: 'quiet',
			bare: 'quiet',
			allowed: ['quiet', 'pop', 'ink', 'floating'],
		},
	};

	/* A page can ask for its own first-visit look with data-basalt-start-<option>
	 * on <html> (data-basalt-start-palette="tide"): a page or a whole demo can
	 * open in its own palette while sharing this file. It wins over
	 * SETTINGS.start, and a value the option does not allow falls back to
	 * SETTINGS.start; a visitor's saved choice still wins over both. */
	for (const [name, option] of Object.entries(OPTIONS)) {
		const fits = (value) => value && (!option.allowed || option.allowed.includes(value));
		const wanted = [html.getAttribute(`data-basalt-start-${name}`), SETTINGS.start[name]].find(fits);
		if (wanted) option.initial = wanted;
	}

	/* Chart.js cannot say whether a color came from the author or from its own
	 * defaults, so the value has to answer for it. These are the library's stock
	 * grays and the neutrals page scripts read from the tokens; only colors in
	 * this set, or the one about to be applied, get repainted. Anything else is
	 * taken as a deliberate choice. */
	const STOCK_COLORS = new Set([
		'#666',
		'#666666',
		'#6e6790',
		'#a39ac6',
		'rgba(0,0,0,0.1)',
		'rgba(0, 0, 0, 0.1)',
		'rgba(255,255,255,.06)',
		'rgba(255, 255, 255, 0.06)',
		'rgba(25,20,48,.06)',
		'rgba(25, 20, 48, 0.06)',
	]);

	/* What chart chrome falls back to in each mode when a token is missing.
	 * Gridlines always use these, since no token describes them. */
	const CHART_NEUTRALS = {
		light: { muted: '#6e6790', gridline: 'rgba(25,20,48,.06)', copy: '#191430', plane: '#ffffff', edge: '#e7e4f0' },
		dark: {
			muted: '#a39ac6',
			gridline: 'rgba(255,255,255,.06)',
			copy: '#f1eefb',
			plane: '#14102a',
			edge: '#332c52',
		},
	};

	/**
	 * Runs once, while the script is parsed rather than on DOMContentLoaded, so
	 * the window in which an unthemed page shows stays as short as possible.
	 * The appearance options follow the mode because the picker UI would apply
	 * them too late and flash the default palette first.
	 */
	function start() {
		document.addEventListener('basalt:appearance', retintCharts);
		showMode(savedMode() || firstMode());
		for (const name of Object.keys(OPTIONS)) wear(name, readOption(name));
		document.addEventListener('DOMContentLoaded', wireControls);

		/* Page scripts load after this file and draw with the active palette, so
		 * the helpers are published from here, the one script every page runs, on
		 * window.Basalt, the template's only global. */
		Object.assign((window.Basalt ||= {}), {
			token,
			shade,
			series,
			chartFill,
			appearance: {
				get: readOption,
				set: chooseOption,
				canChange,
				start: (name) => SETTINGS.start[name],
			},
			setTheme: (mode) => chooseMode(mode),
			getTheme: () => html.getAttribute('data-bs-theme'),
		});
	}

	/**
	 * Whether visitors may change a setting. Public as
	 * `Basalt.appearance.canChange`, so the panel and the switches can leave out
	 * what is fixed.
	 *
	 * @param {string} name 'mode', 'menuWidth' or a key of OPTIONS.
	 * @returns {boolean}
	 */
	function canChange(name) {
		return SETTINGS.visitorsCanChange.includes(name);
	}

	/* Light and dark mode. */

	/** @returns {?string} The mode saved on an earlier visit, or null. */
	function savedMode() {
		if (!canChange('mode')) return null;
		try {
			return localStorage.getItem(MODE_KEY);
		} catch {
			return null;
		}
	}

	/** The mode a visit starts in when nothing is saved: SETTINGS.start.mode. */
	function firstMode() {
		const wanted = SETTINGS.start.mode;
		if (wanted === 'light' || wanted === 'dark') return wanted;
		return systemDark.matches ? 'dark' : 'light';
	}

	/**
	 * Shows a mode without remembering it, retints the browser chrome from the
	 * palette now in force, and tells listeners. The event goes out on document
	 * but bubbles, because hr-dashboard.js and sales-dashboard.js listen on window.
	 *
	 * @param {'dark'|'light'} mode
	 * @fires basalt:appearance
	 */
	function showMode(mode) {
		html.setAttribute('data-bs-theme', mode);
		const themeColor = document.querySelector('meta[name="theme-color"]');
		if (themeColor) {
			const chrome = mode === 'dark' ? token('--basalt-canvas', '#101222') : token('--basalt-hue', '#6d3fe0');
			themeColor.setAttribute('content', chrome);
		}
		announce(mode);
	}

	/**
	 * Shows a mode and keeps it for later visits. Public as `Basalt.setTheme`.
	 *
	 * @param {'dark'|'light'} mode
	 */
	function chooseMode(mode) {
		showMode(mode);
		if (!canChange('mode')) return;
		try {
			localStorage.setItem(MODE_KEY, mode);
		} catch {
			/* Private windows may refuse storage; the mode still applies. */
		}
	}

	/**
	 * Hooks up every mode switch on the page, or hides them when the mode is
	 * fixed, and lets the system setting keep steering the mode until the
	 * visitor has made a choice of their own.
	 */
	function wireControls() {
		for (const control of document.querySelectorAll('[data-basalt-chrome="mode"]')) {
			if (canChange('mode')) control.addEventListener('click', flipMode);
			else control.hidden = true;
		}
		systemDark.addEventListener('change', followSystem);
	}

	function flipMode() {
		chooseMode(html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark');
	}

	function followSystem(change) {
		if (savedMode() || SETTINGS.start.mode !== 'system') return;
		showMode(change.matches ? 'dark' : 'light');
	}

	/** @param {?string} mode Passed on to listeners as `detail.theme`. */
	function announce(mode) {
		document.dispatchEvent(new CustomEvent('basalt:appearance', { bubbles: true, detail: { theme: mode } }));
	}

	/* Appearance options. */

	/**
	 * Reads one appearance option. Public as `Basalt.appearance.get`.
	 *
	 * @param {string} name A key of OPTIONS, such as 'palette' or 'sidebar', or
	 *   'mode' or 'menuWidth' for the value showing now.
	 * @returns {?string} The remembered value, or the first-visit value when
	 *   the option is fixed, nothing usable is stored or storage is unavailable.
	 */
	function readOption(name) {
		const option = OPTIONS[name];
		if (name === 'mode') return html.getAttribute('data-bs-theme');
		if (name === 'menuWidth') return document.body?.classList.contains('basalt-menu-narrow') ? 'narrow' : 'wide';
		if (!option) return null;
		if (!canChange(name)) return option.initial;
		try {
			const kept = localStorage.getItem(option.stored);
			if (!kept) return option.initial;
			return !option.allowed || option.allowed.includes(kept) ? kept : option.initial;
		} catch {
			return option.initial;
		}
	}

	/**
	 * Applies and remembers one appearance option, then sends the same event a
	 * mode flip does, since charts keep the colors they were built with.
	 * Public as `Basalt.appearance.set`.
	 *
	 * @param {string} name  A key of OPTIONS, or 'mode' (the same as setTheme).
	 *   The menu width is changed from the menu's own button.
	 * @param {string} value The look to switch to.
	 * @fires basalt:appearance
	 */
	function chooseOption(name, value) {
		/* Mode has its own setter, and the menu width belongs to the sidebar. */
		if (name === 'mode') return chooseMode(value);
		if (!OPTIONS[name]) return;
		wear(name, value);
		if (!canChange(name)) {
			announce(html.getAttribute('data-bs-theme'));
			return;
		}
		try {
			localStorage.setItem(OPTIONS[name].stored, value);
		} catch {
			/* Private windows may refuse storage; the look still applies. */
		}
		announce(html.getAttribute('data-bs-theme'));
	}

	function wear(name, value) {
		const { attribute, bare } = OPTIONS[name];
		if (value === bare) html.removeAttribute(attribute);
		else html.setAttribute(attribute, value);
	}

	/* Color helpers for page scripts. */

	/**
	 * Looks a color up in the stylesheet rather than hard-coding it, so a
	 * recolored palette reaches the charts too. Public as `Basalt.token`.
	 *
	 * @param {string} property Custom property name, e.g. '--basalt-copy'.
	 * @param {string} fallback Used when the property is missing or blank.
	 * @returns {string}
	 */
	function token(property, fallback) {
		return getComputedStyle(html).getPropertyValue(property).trim() || fallback;
	}

	/**
	 * Lightens or darkens a #rrggbb color by a fixed fraction, so a chart with
	 * more series than the palette's eight slots can still tell them apart, and
	 * the same series lands on the same color every load. The answer is hex
	 * again because page scripts parse it back for their own alpha math.
	 * Public as `Basalt.shade`.
	 *
	 * @param {string} color A #rrggbb color; anything else comes back as is.
	 * @param {number} shift Toward white when positive, black when negative.
	 * @returns {string}
	 */
	function shade(color, shift) {
		const digits = /^#([0-9a-f]{6})$/i.exec((color || '').trim());
		if (!digits || !shift) return color;
		const packed = parseInt(digits[1], 16);
		const goal = shift > 0 ? 255 : 0;
		const share = Math.abs(shift);
		const pairs = [16, 8, 0].map((offset) => {
			const channel = (packed >> offset) & 255;
			return Math.round(channel + (goal - channel) * share)
				.toString(16)
				.padStart(2, '0');
		});
		return `#${pairs.join('')}`;
	}

	/**
	 * One categorical palette slot, optionally shaded. Public as `Basalt.series`.
	 *
	 * @param {number} slot      Slot number in --basalt-series-N.
	 * @param {number} shift     Passed to shade(); 0 leaves the slot as is.
	 * @param {string} fallback  Used when the slot token is missing.
	 * @returns {string}
	 */
	function series(slot, shift, fallback) {
		return shade(token(`--basalt-series-${slot}`, fallback), shift);
	}

	/**
	 * A Chart.js fill that fades across the plot while gradients are on and is
	 * one plain color while they are off. It is a scriptable option, so Chart.js
	 * asks for it again on every update, and the update appearance.js runs on
	 * each `basalt:appearance` swaps the fade for the plain color live.
	 * Public as `Basalt.chartFill`.
	 *
	 * @param {Array<[number, string]>} stops Offsets from 0 to 1 with their colors,
	 *   from the top of the plot (or its left edge, with `across`).
	 * @param {object} [how]
	 * @param {string} [how.flat]    The color with gradients off; the first stop's by default.
	 * @param {boolean} [how.across] Fade left to right instead of top to bottom.
	 * @returns {function({chart: object}): (string|CanvasGradient)}
	 */
	function chartFill(stops, { flat = stops[0][1], across = false } = {}) {
		return ({ chart }) => {
			const area = chart.chartArea;
			if (!area || html.getAttribute('data-basalt-gradients') === 'off') return flat;
			const fade = across
				? chart.ctx.createLinearGradient(area.left, 0, area.right, 0)
				: chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
			for (const [offset, color] of stops) fade.addColorStop(offset, color);
			return fade;
		};
	}

	/* Chart retint. */

	/**
	 * Repaints the axes, legends and tooltips of charts already on the page.
	 * Page scripts build their charts once, so without this their light grays
	 * would stay unreadable on a dark background. Does nothing without Chart.js.
	 */
	function retintCharts() {
		if (typeof window.Chart?.getChart !== 'function') return;
		const neutrals = CHART_NEUTRALS[html.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light'];
		const copy = token('--basalt-copy', neutrals.copy);
		const look = {
			muted: token('--basalt-copy-muted', neutrals.muted),
			gridline: neutrals.gridline,
			tooltip: {
				backgroundColor: token('--basalt-plane', neutrals.plane),
				titleColor: copy,
				bodyColor: copy,
				borderColor: token('--basalt-edge', neutrals.edge),
			},
		};

		for (const canvas of document.querySelectorAll('canvas')) {
			const chart = Chart.getChart(canvas);
			if (chart) repaint(chart, look);
		}
	}

	function repaint(chart, look) {
		const options = chart.options || {};
		for (const axis of Object.values(options.scales || {})) {
			if (!axis) continue;
			reclaim(axis.ticks, look.muted);
			reclaim(axis.grid, look.gridline);
			/* Chart.js 4 gave the axis line its own color instead of grid.color. */
			reclaim(axis.border, look.gridline);
		}
		reclaim(options.plugins?.legend?.labels, look.muted);
		const tooltip = options.plugins?.tooltip;
		if (tooltip) Object.assign(tooltip, look.tooltip);
		chart.update('none');
	}

	/** Sets `part.color` unless it holds a color somebody chose on purpose. */
	function reclaim(part, color) {
		if (part && isStock(part.color, color)) part.color = color;
	}

	function isStock(current, replacement) {
		if (current == null) return true;
		const value = String(current).toLowerCase().trim();
		return value === String(replacement).toLowerCase().trim() || STOCK_COLORS.has(value);
	}

	start();
})();
