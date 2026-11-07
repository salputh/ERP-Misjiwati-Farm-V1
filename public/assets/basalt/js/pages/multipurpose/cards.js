/**
 * Cards showcase (cards.html): the page's own wiring. The family chips
 * over the grid, the copy button under each snippet, and the small demos
 * that need a hand: the plan picker's running total, the favorite hearts,
 * the add-to-cart buttons, the widget's refreshed numbers, the stat
 * counters and the loading switch. The card behaviors on show, published
 * as window.Basalt.cards, live in basalt.js. No libraries.
 */
(() => {
	'use strict';

	const showcase = pick('[data-cd-root]', document);
	if (!showcase) return;

	const copyTimers = new Map();

	/* Figures for the stat cards: for each period, the comparison wording
     and, per card, the value, the change in percent and the sparkline. */
	const FIGURES = {
		7: {
			vs: 'on the week before',
			revenue: [18240, 12.4, [9, 11, 10, 14, 13, 17, 19]],
			orders: [412, 8.1, [52, 58, 55, 61, 57, 63, 66]],
			refunds: [9, -2.0, [3, 2, 2, 1, 1, 0, 0]],
		},
		30: {
			vs: 'on the month before',
			revenue: [74630, 6.8, [40, 44, 39, 47, 51, 48, 55, 58, 54, 61, 66, 63]],
			orders: [1702, 4.2, [48, 52, 50, 55, 53, 57, 60, 58, 62, 61, 64, 66]],
			refunds: [31, -11.5, [6, 5, 6, 4, 4, 3, 3, 2, 3, 2, 1, 1]],
		},
		365: {
			vs: 'on last year',
			revenue: [812400, 22.9, [30, 34, 38, 36, 44, 48, 52, 50, 58, 62, 70, 78]],
			orders: [19204, 17.3, [36, 38, 41, 40, 46, 49, 52, 51, 57, 60, 65, 71]],
			refunds: [402, 3.1, [4, 5, 4, 6, 5, 5, 6, 6, 5, 6, 7, 6]],
		},
	};
	const asCount = (value) => Math.round(value).toLocaleString('en-US');
	const FORMAT = { revenue: (value) => `$${asCount(value)}`, orders: asCount, refunds: asCount };

	function start() {
		wireChips();
		wireCopyButtons();
		wireRunningTotal();
		wireFavorites();
		wireCartButtons();
		wireWidgetRefresh();
		wireStatCards();
		wireLoadingCard();
	}

	function pick(selector, scope = showcase) {
		return scope.querySelector(selector);
	}
	function pickAll(selector, scope = showcase) {
		return [...scope.querySelectorAll(selector)];
	}
	function on(target, type, handler) {
		target.addEventListener(type, handler);
	}
	function stillMotion() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}
	function countOf(count, one, many) {
		return `${count} ${count === 1 ? one : many}`;
	}

	/* The chips narrow the grid to one family of card. Half-width cards pair
     up between the full-width ones, and an odd one left at the end of a
     run spreads across the whole row. */

	function wireChips() {
		const [gallery, tally] = [pick('[data-cd-grid]'), pick('[data-cd-count]')];
		if (!gallery) return;
		const panels = pickAll('.cd-card', gallery);
		const chips = pickAll('[data-cd-filter]');

		function showFamily(family) {
			const kept = [];
			for (const panel of panels) {
				const families = (panel.getAttribute('data-cd-groups') || '').split(/\s+/);
				const stays = family === 'all' || families.includes(family);
				panel.classList.toggle('is-hidden', !stays);
				panel.classList.remove('is-alone');
				if (stays) kept.push(panel);
			}
			let halfRun = [];
			const sealRun = () => {
				if (halfRun.length % 2) halfRun[halfRun.length - 1].classList.add('is-alone');
				halfRun = [];
			};
			for (const panel of kept) {
				if (panel.classList.contains('cd-card-full')) sealRun();
				else halfRun.push(panel);
			}
			sealRun();
			if (tally) tally.textContent = countOf(kept.length, 'card type', 'card types');
		}

		for (const chip of chips) {
			on(chip, 'click', () => {
				for (const other of chips) other.setAttribute('aria-pressed', String(other === chip));
				showFamily(chip.getAttribute('data-cd-filter'));
			});
		}
		showFamily('all');
	}

	/* Each snippet's copy button puts the <pre> text on the clipboard and
     says so for a moment. */

	function wireCopyButtons() {
		for (const button of pickAll('[data-cd-copy]')) {
			on(button, 'click', () => {
				const snippet = pick('pre', button.parentElement);
				if (!snippet) return;
				window.Basalt.copyText(snippet.textContent.trim()).then(() => confirmCopy(button));
			});
		}
	}

	function confirmCopy(button) {
		const glyph = pick('.bi', button);
		const say = (text, glyphClass) => {
			button.lastChild.textContent = text;
			if (glyph) glyph.className = glyphClass;
		};
		say(' Copied', 'bi bi-check2');
		clearTimeout(copyTimers.get(button));
		copyTimers.set(
			button,
			setTimeout(() => say(' Copy', 'bi bi-clipboard'), 1800),
		);
	}

	/* The selectable demo adds up the plan and the chosen add-ons. */

	function wireRunningTotal() {
		const planForm = pick('[data-cd-select]');
		if (!planForm) return;
		const totalLine = pick('[data-cd-select-sum]', planForm);
		on(planForm, 'submit', (event) => event.preventDefault());

		function tallyPlan() {
			const plan = pick('input[name="cd-size"]:checked', planForm);
			const addons = pickAll('input[name="cd-extra"]:checked', planForm);
			let monthly = parseFloat(plan.getAttribute('data-cd-price'));
			for (const addon of addons) monthly += parseFloat(addon.getAttribute('data-cd-price'));
			const picked = addons.map((addon) => addon.value);
			const joined =
				picked.length > 1 ? `${picked.slice(0, -1).join(', ')} and ${picked[picked.length - 1]}` : picked[0];
			const figure = document.createElement('strong');
			figure.textContent = `$${monthly.toFixed(2)}`;
			totalLine.replaceChildren(`${plan.value}${joined ? ` with ${joined}` : ''}: `, figure, ' a seat a month');
		}

		on(planForm, 'change', tallyPlan);
		tallyPlan();
	}

	/* Media cards: the heart fills and pops, the cart button confirms in place. */

	function wireFavorites() {
		for (const heart of pickAll('.basalt-media-card-fav')) {
			on(heart, 'click', () => {
				const saved = heart.getAttribute('aria-pressed') !== 'true';
				heart.setAttribute('aria-pressed', String(saved));
				pick('.bi', heart).className = `bi ${saved ? 'bi-heart-fill' : 'bi-heart'}`;
				heart.classList.remove('is-pop');
				if (!saved || stillMotion()) return;
				/* Reading the width restarts the animation on a second save. */
				void heart.offsetWidth;
				heart.classList.add('is-pop');
			});
		}
	}

	function wireCartButtons() {
		for (const button of pickAll('[data-cd-add]')) {
			const [caption, glyph] = [pick('span', button), pick('.bi', button)];
			on(button, 'click', () => {
				const inCart = !button.classList.contains('is-done');
				button.classList.toggle('is-done', inCart);
				caption.textContent = inCart ? 'In your cart' : 'Add to cart';
				glyph.className = `bi ${inCart ? 'bi-check2' : 'bi-bag-plus'}`;
			});
		}
	}

	/* The widget demo: a refresh nudges every seller's count and rescales
     the bars to the new leader, once the widget's own spinner has run. */

	function wireWidgetRefresh() {
		on(showcase, 'basalt:widget-refresh', (event) => {
			const sellerRows = pickAll('.cd-sellers-row', event.target);
			setTimeout(() => {
				const counts = sellerRows.map((row) => {
					const figure = pick('[data-cd-units]', row);
					const nudged = Math.max(
						20,
						parseInt(figure.textContent.trim(), 10) + Math.round((Math.random() - 0.35) * 24),
					);
					figure.textContent = String(nudged);
					return nudged;
				});
				const peak = Math.max(...counts);
				for (const [index, row] of sellerRows.entries())
					pick('.cd-sellers-bar span', row).style.width = `${Math.round((counts[index] / peak) * 100)}%`;
			}, 850);
		});
	}

	/* Stat cards: the period switch swaps every card's figures, redraws its
     sparkline and counts the value up to the new one. */

	function wireStatCards() {
		const statBoard = pick('[data-cd-stats]');
		if (!statBoard) return;

		function paintPeriod(period, animate) {
			const figures = FIGURES[period];
			for (const card of pickAll('[data-cd-stat]', statBoard)) {
				const key = card.getAttribute('data-cd-stat');
				const [value, pct, series] = figures[key];
				const [figure, change] = [pick('[data-cd-stat-value]', card), pick('[data-cd-stat-delta]', card)];
				/* Fewer refunds is the good direction; the color follows the news. */
				const welcome = key === 'refunds' ? pct < 0 : pct >= 0;
				change.classList.toggle('is-up', welcome);
				change.classList.toggle('is-down', !welcome);
				pick('.bi', change).className = `bi ${pct >= 0 ? 'bi-arrow-up-right' : 'bi-arrow-down-right'}`;
				pick('[data-cd-stat-pct]', card).textContent = `${Math.abs(pct).toFixed(1)}%`;
				pick('[data-cd-stat-vs]', card).textContent = figures.vs;
				const spark = sparkPaths(series);
				pick('.basalt-trend-card-line', card).setAttribute('d', spark.line);
				pick('.basalt-trend-card-area', card).setAttribute('d', spark.area);
				const startValue = parseFloat(figure.textContent.replace(/[^0-9.]/g, '')) || 0;
				if (animate && !stillMotion()) countUp(figure, startValue, value, FORMAT[key]);
				else figure.textContent = FORMAT[key](value);
			}
		}

		for (const option of pickAll('input[name="cd-period"]')) {
			on(option, 'change', () => {
				if (option.checked) paintPeriod(option.value, true);
			});
		}
		paintPeriod('7', false);
	}

	/** Builds the line and the filled area under it for a 120 by 40 sparkline. */
	function sparkPaths(series) {
		const [top, bottom] = [Math.max(...series), Math.min(...series)];
		const spread = top - bottom || 1;
		const points = series.map((value, i) => [
			(i / (series.length - 1)) * 120,
			34 - ((value - bottom) / spread) * 28,
		]);
		const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
		return { line, area: `${line} L120 40 L0 40 Z` };
	}

	/** Eases a figure from one value to another over 600ms. */
	function countUp(figure, from, to, format) {
		const began = performance.now();
		const frame = (now) => {
			const progress = Math.min(1, (now - began) / 500);
			const eased = 1 - Math.pow(1 - progress, 3);
			figure.textContent = format(from + (to - from) * eased);
			if (progress < 1) requestAnimationFrame(frame);
		};
		requestAnimationFrame(frame);
	}

	/* The loading demo swaps the card's content for its skeleton; the switch
     holds it there for as long as the reader wants to look. */

	function wireLoadingCard() {
		const sample = pick('[data-cd-loading]');
		if (!sample) return;
		const [content, bones] = [pick('[data-cd-real]', sample), pick('[data-cd-skel]', sample)];
		const [holdSwitch, reloadButton] = [pick('[data-cd-hold]'), pick('[data-cd-reload]')];
		let loadTimer = null;

		function setBusy(busy) {
			sample.setAttribute('aria-busy', String(busy));
			content.hidden = busy;
			bones.hidden = !busy;
		}

		on(reloadButton, 'click', () => {
			clearTimeout(loadTimer);
			setBusy(true);
			loadTimer = setTimeout(() => {
				if (!holdSwitch.checked) setBusy(false);
			}, 1400);
		});
		on(holdSwitch, 'change', () => {
			clearTimeout(loadTimer);
			setBusy(holdSwitch.checked);
		});
	}

	start();
})();
