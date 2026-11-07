/**
 * Script for typography.html, active only where [data-ty-root] exists.
 * It drives the demos around the type helpers: the kind filter, snippet
 * copying, custom sample text and units for the scale, the weight slider,
 * the live totals and the breadcrumb note. The helpers themselves (scale
 * readouts, key combos, line clamp, folding breadcrumb) are basalt.js's
 * window.Basalt.text; no library is involved.
 */
(() => {
	'use strict';

	const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

	const typePage = pick('[data-ty-root]', document);
	if (!typePage) return;

	/* Named stops of the variable font, keyed by numeric weight. */
	const WEIGHT_LABELS = {
		400: 'Regular',
		500: 'Medium',
		600: 'Semibold',
		700: 'Bold',
		800: 'Extra bold',
		900: 'Black',
	};
	const TICK_EVERY_MS = 900;
	const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
	const copyResets = new WeakMap();

	/* Each demo binds itself and steps aside when its markup is absent. */
	function start() {
		wireKindFilter();
		wireSnippetCopy();
		wireScaleControls();
		wireWeightSlider();
		wireLiveTotals();
		wireCrumbNote();
	}

	/* The kind filter and the snippet copy buttons come first. */

	function wireKindFilter() {
		const deck = pick('[data-ty-grid]');
		const tally = pick('[data-ty-count]');
		if (!deck) return;
		const tiles = pickAll('.ty-card', deck);
		const chips = pickAll('[data-ty-filter]');
		for (const chip of chips) {
			chip.addEventListener('click', () => {
				for (const other of chips) other.setAttribute('aria-pressed', String(other === chip));
				revealKind(chip.getAttribute('data-ty-filter'), tiles, tally);
			});
		}
		revealKind('all', tiles, tally);
	}

	/** A card may belong to several kinds, listed space-separated in data-ty-groups. */
	function revealKind(kind, tiles, tally) {
		const matching = tiles.filter(
			(tile) => kind === 'all' || (tile.getAttribute('data-ty-groups') || '').split(/\s+/).includes(kind),
		);
		for (const tile of tiles) {
			tile.classList.toggle('is-hidden', !matching.includes(tile));
			tile.classList.remove('is-alone');
		}
		flagUnpaired(matching);
		if (tally) tally.textContent = countOf(matching.length, 'type', 'types');
	}

	/**
	 * Half-width cards pair up between the full-width ones; a stretch with an
	 * odd count marks its last card .is-alone so it spans the row.
	 */
	function flagUnpaired(matching) {
		let halves = 0;
		for (const [position, tile] of matching.entries()) {
			if (spansRow(tile)) {
				halves = 0;
				continue;
			}
			halves += 1;
			const following = matching[position + 1];
			if (following && !spansRow(following)) continue;
			if (halves % 2) tile.classList.add('is-alone');
			halves = 0;
		}
	}

	function spansRow(tile) {
		return tile.classList.contains('ty-card-full');
	}

	function wireSnippetCopy() {
		for (const button of pickAll('[data-ty-copy]')) {
			button.addEventListener('click', () => {
				const snippet = pick('pre', button.parentElement);
				if (!snippet) return;
				window.Basalt.copyText(snippet.textContent.trim()).then(() => confirmCopied(button));
			});
		}
	}

	/* The button says Copied for 1.8 seconds before going back to Copy. */
	function confirmCopied(button) {
		const glyph = pick('.bi', button);
		relabel(button, glyph, ' Copied', 'bi bi-check2');
		clearTimeout(copyResets.get(button));
		copyResets.set(
			button,
			setTimeout(() => relabel(button, glyph, ' Copy', 'bi bi-clipboard'), 1800),
		);
	}

	function relabel(button, glyph, wording, glyphClass) {
		button.lastChild.textContent = wording;
		if (glyph) glyph.className = glyphClass;
	}

	/* These two demos let the reader change the sample type. */

	/* Typed text replaces every scale sample; clearing the box restores each
     sample's own words. The unit radios hand off to basalt.js. */
	function wireScaleControls() {
		const textBox = pick('[data-ty-sample]');
		const specimens = pickAll('[data-basalt-type-sample]');
		const originals = specimens.map((specimen) => specimen.textContent.trim());
		textBox?.addEventListener('input', () => {
			const typed = textBox.value.trim();
			for (const [position, specimen] of specimens.entries()) specimen.textContent = typed || originals[position];
		});

		for (const unitRadio of pickAll('[data-ty-unit]')) {
			unitRadio.addEventListener('change', () => {
				if (unitRadio.checked) window.Basalt.typeScaleUnit(unitRadio.value);
			});
		}
	}

	function wireWeightSlider() {
		const slider = pick('[data-ty-weight]');
		const readout = pick('[data-ty-weight-out]');
		const specimen = pick('[data-ty-weight-sample]');
		const presets = pickAll('[data-ty-stop]');
		if (!slider || !specimen) return;

		/** Moves slider, specimen, readout and preset buttons to one weight. */
		function showWeight(weight) {
			const described = `${weight}${WEIGHT_LABELS[weight] ? ` ${WEIGHT_LABELS[weight]}` : ''}`;
			slider.value = weight;
			specimen.style.fontWeight = weight;
			if (readout) readout.textContent = described;
			slider.setAttribute('aria-valuetext', described);
			for (const preset of presets) {
				preset.setAttribute(
					'aria-pressed',
					String(Number(preset.getAttribute('data-ty-stop')) === Number(weight)),
				);
			}
		}

		slider.addEventListener('input', () => showWeight(slider.value));
		for (const preset of presets) {
			preset.addEventListener('click', () => showWeight(preset.getAttribute('data-ty-stop')));
		}
		showWeight(slider.value);
	}

	/* The live totals tick on a timer; the breadcrumb note only listens. */

	function wireLiveTotals() {
		const panel = pick('[data-ty-ticker]');
		if (!panel) return;
		const toggle = pick('[data-ty-tick-play]', panel);
		const lines = pickAll('[data-ty-tick]', panel).map((line) => ({
			amount: pick('[data-ty-tick-value]', line),
			change: pick('[data-ty-tick-delta]', line),
		}));
		let tickTimer = 0;

		function isRunning() {
			return toggle.getAttribute('aria-pressed') === 'true';
		}

		function advance() {
			for (const line of lines) bumpTotal(line);
		}

		function run(playing) {
			clearInterval(tickTimer);
			toggle.setAttribute('aria-pressed', String(playing));
			pick('span', toggle).textContent = playing ? 'Pause updates' : 'Play updates';
			pick('.bi', toggle).className = `bi ${playing ? 'bi-pause-fill' : 'bi-play-fill'} me-1`;
			if (!playing) return;
			advance();
			tickTimer = setInterval(advance, TICK_EVERY_MS);
		}

		toggle.addEventListener('click', () => run(!isRunning()));

		for (const figureRadio of pickAll('[data-ty-fig]', panel)) {
			figureRadio.addEventListener('change', () => {
				if (figureRadio.checked)
					panel.classList.toggle('is-proportional', figureRadio.value === 'proportional');
			});
		}

		/* Plays from the start unless reduced motion is asked for, and rests
       while the tab is out of sight. */
		if (!lessMotion.matches) run(true);
		document.addEventListener('visibilitychange', () => {
			if (!isRunning()) return;
			if (document.hidden) {
				clearInterval(tickTimer);
				tickTimer = 0;
			} else if (!tickTimer) {
				tickTimer = setInterval(advance, TICK_EVERY_MS);
			}
		});
	}

	/**
	 * Adds one sale to a total: usually a small one under $60, and about one
	 * time in five a larger shop order between $80 and $480.
	 */
	function bumpTotal({ amount, change }) {
		const before = Number(amount.getAttribute('data-ty-tick-value'));
		const sale = Math.random() < 0.2 ? 80 + Math.random() * 400 : Math.random() * 60;
		const after = before + sale;
		amount.setAttribute('data-ty-tick-value', after.toFixed(2));
		amount.textContent = usd.format(after);
		change.className = 'basalt-delta basalt-delta-up basalt-num';
		change.innerHTML = `<i class="bi bi-arrow-up-short" aria-hidden="true"></i>${((sale / before) * 100).toFixed(1)}%`;
	}

	function wireCrumbNote() {
		const note = pick('[data-ty-crumb-status]');
		if (!note) return;
		typePage.addEventListener('basalt:breadcrumbopen', (event) => {
			note.textContent = `Full path shown: ${countOf(event.detail.count, 'level', 'levels')} opened.`;
		});
	}

	/* Lookup and wording helpers the demos share. */

	function pick(selector, scope = typePage) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = typePage) {
		return [...scope.querySelectorAll(selector)];
	}

	function countOf(amount, singular, pluralForm) {
		return `${amount} ${amount === 1 ? singular : pluralForm}`;
	}

	start();
})();
