/**
 * Runs the sliders and rating page (sliders-and-rating.html). It paints
 * the filled track and value of every single slider, keeps the two handles
 * of a range apart, lights star radios, builds the 0 to 10 scale and the
 * follow-up choices under the faces, counts thumbs, and lets the chips at
 * the top show one kind of field at a time. A page without [data-sr-root]
 * is left alone.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-sr-root]', document);
	if (!pageRoot) return;

	/* Thumb widths in CSS pixels. A thumb's center stops half a thumb short
     of either end of the track, so anything placed over a value allows for
     that. The small slider has the smaller thumb. */
	const HANDLE = 20;
	const SMALL_HANDLE = 16;

	/* Demo prices behind the histogram, with the span they are counted over
     and the width of each bar. */
	const PRICE_SAMPLE = [
		14, 16, 17, 12, 15, 24, 21, 23, 26, 22, 19, 18, 17, 15, 13, 14, 22, 29, 58, 20, 25, 23, 49, 27, 31, 18, 11, 12,
		13, 34, 36, 52, 55, 16, 19, 18, 21, 42, 15, 24,
	];
	const PRICE_FLOOR = 8;
	const PRICE_CEILING = 60;
	const BIN_WIDTH = 4;

	/* What the 0 to 10 scale says once a score lands in a band. */
	const BAND_COPY = {
		promoter: { pill: 'Promoter', ask: 'What did you like most?' },
		passive: { pill: 'Passive', ask: 'What would make it a 10?' },
		detractor: { pill: 'Detractor', ask: 'What went wrong? We read every answer.' },
	};

	/* Follow-up choices under the faces, by how the visit went. */
	const MOOD_PROMPTS = {
		low: { ask: 'What went wrong?', picks: ['Arrived late', 'Visit cut short', 'Left a mess', 'Price changed'] },
		mid: {
			ask: 'What could be better?',
			picks: ['Tighter arrival time', 'Sorted on the first visit', 'Clearer estimate', 'More updates'],
		},
		high: { ask: 'What went well?', picks: ['On time', 'Sorted first time', 'Tidy work', 'Friendly carer'] },
	};

	/* The low-stock slider colors its track by band and says why. */
	const STOCK_BANDS = ['risky', 'tight', 'good'];
	const STOCK_WORDS = { risky: 'Too late to reorder.', tight: 'Tight.', good: 'Comfortable.' };

	/* Every hook on the page and the function that wires whatever carries
     it. The shared field types come first, so by the time a card runs,
     its sliders are painted, its handles paired and its stars lit; the
     stepped card in particular reads aria-valuetext the sliders wrote. */
	const WIRING = {
		'.sr-range': wireSlider,
		'[data-sr-dual]': wirePair,
		'[data-sr-stars]': wireStarSet,
		'[data-sr-thumbs]': wireThumbs,
		'[data-sr-grid]': wireFilter,
		'[data-sr-price]': wirePriceCard,
		'[data-sr-review]': wireReviewCard,
		'[data-sr-stepped]': wireSteppedCard,
		'[data-sr-nps]': wireScaleCard,
		'[data-sr-mood]': wireMoodCard,
		'[data-sr-whole]': wireSeatsCard,
		'[data-sr-window]': wireWindowCard,
		'[data-sr-toned]': wireStockCard,
	};

	function start() {
		for (const [selector, wire] of Object.entries(WIRING)) {
			for (const node of pickAll(selector)) wire(node);
		}
	}

	function pick(selector, scope = pageRoot) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = pageRoot) {
		return [...scope.querySelectorAll(selector)];
	}

	/** The first match of each selector inside scope, in the order asked. */
	function within(scope, ...selectors) {
		return selectors.map((selector) => pick(selector, scope));
	}

	function make(tag, props = {}) {
		return Object.assign(document.createElement(tag), props);
	}

	function emit(node, eventName) {
		node.dispatchEvent(new Event(eventName, { bubbles: true }));
	}

	/** Joins phrases as "a, b and c"; a single phrase comes back as it is. */
	function sentenceList(phrases) {
		if (phrases.length < 2) return phrases.join('');
		return `${phrases.slice(0, -1).join(', ')} and ${phrases.at(-1)}`;
	}

	/** How far along its track a slider reading sits, 0 to 100. */
	function along(rangeInput, reading = parseFloat(rangeInput.value)) {
		const floor = parseFloat(rangeInput.min) || 0;
		return ((reading - floor) / (parseFloat(rangeInput.max) - floor)) * 100;
	}

	/** The CSS left of a thumb's center when the track is this far along. */
	function centerAt(share, handle = HANDLE) {
		return `calc(${share}% + ${((0.5 - share / 100) * handle).toFixed(2)}px)`;
	}

	function handleOf(rangeInput) {
		return rangeInput.classList.contains('sr-range-sm') ? SMALL_HANDLE : HANDLE;
	}

	/**
	 * The reading of a single slider as words. data-sr-labels gives one word
	 * per step; data-sr-format gives "{v} visits|{v} visit", the second form
	 * for exactly one. Without either, the number itself.
	 */
	function spokenValue(rangeInput) {
		const reading = parseFloat(rangeInput.value);
		const wordList = rangeInput.getAttribute('data-sr-labels');
		if (wordList) {
			const index = Math.round(reading - (parseFloat(rangeInput.min) || 0));
			return wordList.split('|')[index] || String(reading);
		}
		const pattern = rangeInput.getAttribute('data-sr-format');
		if (!pattern) return String(reading);
		const [plural, singular] = pattern.split('|');
		return (reading === 1 && singular ? singular : plural).replace('{v}', reading);
	}

	/**
	 * Repaints one single slider: the filled share of the track, the spoken
	 * reading, the <output> named by data-sr-out, the bubble over the thumb
	 * and which tick label is lit.
	 */
	function refreshSlider(rangeInput) {
		const share = along(rangeInput);
		const said = spokenValue(rangeInput);
		rangeInput.style.setProperty('--sr-fill', `${share}%`);
		if (rangeInput.hasAttribute('data-sr-labels') || rangeInput.hasAttribute('data-sr-format')) {
			rangeInput.setAttribute('aria-valuetext', said);
		}
		const outputSelector = rangeInput.getAttribute('data-sr-out');
		const readout = outputSelector && pick(outputSelector);
		if (readout) readout.textContent = said;
		const housing = rangeInput.closest('.sr-slide');
		const bubble = housing?.querySelector('.sr-bubble');
		if (bubble) {
			bubble.textContent = said;
			bubble.style.left = centerAt(share, handleOf(rangeInput));
		}
		for (const tickLabel of housing?.querySelectorAll('.sr-ticks span') ?? []) {
			tickLabel.classList.toggle('is-on', tickLabel.dataset.v === rangeInput.value);
		}
	}

	/**
	 * Puts a label under every step of a slider. The first sits flush left,
	 * the last flush right, the rest under the thumb's center. More than
	 * four words get the dense class, which hides the middle ones on phones.
	 */
	function addTickRow(rangeInput) {
		const floor = parseFloat(rangeInput.min) || 0;
		const ceiling = parseFloat(rangeInput.max);
		const stride = parseFloat(rangeInput.step) || 1;
		const wordList = rangeInput.getAttribute('data-sr-labels');
		const words = wordList ? wordList.split('|') : null;
		const handle = handleOf(rangeInput);
		const row = make('div', { className: words && words.length > 4 ? 'sr-ticks sr-ticks-dense' : 'sr-ticks' });
		row.setAttribute('aria-hidden', 'true');
		let index = 0;
		for (let reading = floor; reading <= ceiling; reading += stride) {
			const tickLabel = make('span', { textContent: words ? words[index] : String(reading) });
			tickLabel.dataset.v = String(reading);
			if (reading === ceiling) tickLabel.style.left = '100%';
			else if (reading !== floor) tickLabel.style.left = centerAt(along(rangeInput, reading), handle);
			/* Clicking a label is a mouse shortcut; the keyboard path is the slider itself. */
			tickLabel.addEventListener('click', () => jumpTo(rangeInput, tickLabel.dataset.v));
			row.append(tickLabel);
			index += 1;
		}
		rangeInput.closest('.sr-slide').append(row);
	}

	/** Moves a slider to a value as if dragged there, so everything listening repaints. */
	function jumpTo(rangeInput, value) {
		if (rangeInput.disabled) return;
		rangeInput.value = value;
		for (const eventName of ['input', 'change']) emit(rangeInput, eventName);
	}

	function wireSlider(rangeInput) {
		if (rangeInput.hasAttribute('data-sr-ticks')) addTickRow(rangeInput);
		refreshSlider(rangeInput);
		rangeInput.addEventListener('input', () => refreshSlider(rangeInput));
		const housing = rangeInput.closest('.sr-slide');
		if (!housing) return;
		rangeInput.addEventListener('pointerdown', () => housing.classList.add('is-dragging'));
		document.addEventListener('pointerup', () => housing.classList.remove('is-dragging'));
	}

	/** Minutes from midnight as a clock time, "9:30 am". */
	function clockTime(minutes) {
		const hours = Math.floor(minutes / 60);
		const rest = minutes % 60;
		const face = ((hours + 11) % 12) + 1;
		const meridiem = hours < 12 || hours === 24 ? 'am' : 'pm';
		return `${face}:${String(rest).padStart(2, '0')} ${meridiem}`;
	}

	/**
	 * Two range inputs stacked on one track. data-gap is the least room the
	 * handles keep between them; with data-sr-time the values are minutes
	 * from midnight and read out as clock times. The pair gets an srSet
	 * method so typed values can go through the same gap rule.
	 */
	function wirePair(pair) {
		const [lower, upper, band] = within(pair, '[data-sr-end="lo"]', '[data-sr-end="hi"]', '.sr-dual-fill');
		const minimumGap = parseFloat(pair.getAttribute('data-gap')) || 0;
		const readsAsTime = pair.hasAttribute('data-sr-time');

		function drawBand() {
			const startShare = along(lower);
			const endShare = along(upper);
			band.style.left = centerAt(startShare);
			band.style.right = `calc(${100 - endShare}% - ${((0.5 - endShare / 100) * HANDLE).toFixed(2)}px)`;
			if (!readsAsTime) return;
			lower.setAttribute('aria-valuetext', clockTime(+lower.value));
			upper.setAttribute('aria-valuetext', clockTime(+upper.value));
		}

		function keepApart(handle, low = +lower.value, high = +upper.value) {
			if (handle === lower && low > high - minimumGap) lower.value = high - minimumGap;
			else if (handle === upper && high < low + minimumGap) upper.value = low + minimumGap;
		}

		/* The handle touched last goes on top, so two handles parked at the
       same end can still be pulled apart. */
		function bringForward(handle) {
			for (const end of [lower, upper]) end.classList.toggle('is-top', end === handle);
		}

		for (const handle of [lower, upper]) {
			handle.addEventListener('input', () => {
				keepApart(handle);
				drawBand();
			});
			for (const eventName of ['pointerdown', 'focus'])
				handle.addEventListener(eventName, () => bringForward(handle));
		}

		pair.srSet = (low, high) => {
			lower.value = low;
			upper.value = high;
			keepApart(upper);
			keepApart(lower);
			drawBand();
		};
		drawBand();
	}

	/**
	 * Five radios drawn as stars. Stars light up to the chosen one, hovering
	 * previews a score, and the word from data-sr-word on the chosen star
	 * replaces the resting caption. The set gets an srRepaint method for the
	 * form reset.
	 */
	function wireStarSet(set) {
		const stars = pickAll('label', set);
		const radios = pickAll('input', set);
		const caption = pick('[data-sr-stars-word]', set);
		const restingCaption = caption ? caption.textContent : '';

		function chosen() {
			const on = radios.find((radio) => radio.checked);
			return on ? +on.value : 0;
		}

		function light(upTo, previewing = false) {
			for (const [index, star] of stars.entries()) star.classList.toggle('is-lit', index < upTo);
			if (!caption) return;
			const meaning = upTo ? stars[upTo - 1].getAttribute('data-sr-word') : '';
			caption.textContent = meaning || restingCaption;
			caption.classList.toggle('is-set', upTo > 0 && !previewing);
		}

		for (const [index, star] of stars.entries()) star.addEventListener('mouseenter', () => light(index + 1, true));
		pick('.sr-stars-row', set).addEventListener('mouseleave', () => light(chosen()));
		for (const radio of radios) radio.addEventListener('change', () => light(chosen()));
		set.srRepaint = () => light(chosen());
		set.srRepaint();
	}

	/** One vote per group: the other thumb moves it, the same thumb takes it back. */
	function wireThumbs(voting) {
		const thumbButtons = pickAll('[data-sr-thumb]', voting);

		function setPressed(thumbButton, pressed) {
			thumbButton.setAttribute('aria-pressed', String(pressed));
			const countNode = pick('[data-sr-thumb-n]', thumbButton);
			if (countNode) countNode.textContent = +countNode.textContent + (pressed ? 1 : -1);
		}

		for (const thumbButton of thumbButtons) {
			thumbButton.addEventListener('click', () => {
				const alreadyPressed = thumbButton.getAttribute('aria-pressed') === 'true';
				for (const sibling of thumbButtons) {
					if (sibling.getAttribute('aria-pressed') === 'true') setPressed(sibling, false);
				}
				if (!alreadyPressed) setPressed(thumbButton, true);
			});
		}
	}

	/**
	 * The chips hide every card of another kind. Half-width cards pair up
	 * between full-width ones; the odd one at the end of a run takes the
	 * whole row rather than leaving a hole.
	 */
	function wireFilter(deck) {
		const tally = pick('[data-sr-count]');
		const tiles = pickAll('.sr-card', deck);
		const filterChips = pickAll('[data-sr-filter]');

		function showKind(kind) {
			const kept = tiles.filter((tile) => {
				const visible = kind === 'all' || tile.getAttribute('data-sr-kind') === kind;
				tile.classList.toggle('is-hidden', !visible);
				tile.classList.remove('is-alone');
				return visible;
			});
			let halves = 0;
			let lastHalf = null;
			const endRun = () => {
				if (halves % 2) lastHalf.classList.add('is-alone');
				halves = 0;
			};
			for (const tile of kept) {
				if (tile.classList.contains('sr-card-full')) {
					endRun();
					continue;
				}
				halves += 1;
				lastHalf = tile;
			}
			endRun();
			tally.textContent = `${kept.length} field type${kept.length === 1 ? '' : 's'}`;
		}

		for (const chipButton of filterChips) {
			chipButton.addEventListener('click', () => {
				for (const sibling of filterChips) sibling.setAttribute('aria-pressed', String(sibling === chipButton));
				showKind(chipButton.getAttribute('data-sr-filter'));
			});
		}
		showKind('all');
	}

	/**
	 * Range slider with histogram. Bars show how the sample prices spread,
	 * the handles pick a span, and the Min and Max boxes take typed whole
	 * dollars that are pulled back inside the track and apart.
	 */
	function wirePriceCard(demo) {
		const [pair, histogram, result] = within(demo, '[data-sr-dual]', '[data-sr-histo]', '[data-sr-price-result]');
		const [lowHandle, highHandle, lowField, highField] = within(
			pageRoot,
			'#sr-price-lo',
			'#sr-price-hi',
			'#sr-price-lo-box',
			'#sr-price-hi-box',
		);
		const minimumGap = parseFloat(pair.getAttribute('data-gap')) || 0;

		const bins = [];
		for (let edge = PRICE_FLOOR; edge < PRICE_CEILING; edge += BIN_WIDTH) {
			bins.push({ edge, size: PRICE_SAMPLE.filter((price) => price >= edge && price < edge + BIN_WIDTH).length });
		}
		bins.at(-1).size += PRICE_SAMPLE.filter((price) => price === PRICE_CEILING).length;
		const peak = Math.max(...bins.map((bin) => bin.size));
		const columns = bins.map((bin) => {
			const column = make('span');
			column.style.height = `${Math.max(4, (bin.size / peak) * 100)}%`;
			column.dataset.from = bin.edge;
			histogram.append(column);
			return column;
		});

		function reflect() {
			const low = +lowHandle.value;
			const high = +highHandle.value;
			lowField.value = low;
			highField.value = high;
			for (const column of columns) {
				const middle = +column.dataset.from + BIN_WIDTH / 2;
				column.classList.toggle('is-in', middle >= low && middle <= high);
			}
			const hitCount = PRICE_SAMPLE.filter((price) => price >= low && price <= high).length;
			result.textContent = `${hitCount} of ${PRICE_SAMPLE.length} items from $${low} to $${high}`;
		}

		function acceptTyped(box, end) {
			const typed = parseInt(String(box.value).replace(/[^\d]/g, ''), 10);
			if (!Number.isNaN(typed)) {
				const low = +lowHandle.value;
				const high = +highHandle.value;
				if (end === 'lo') pair.srSet(Math.min(Math.max(typed, PRICE_FLOOR), high - minimumGap), high);
				else pair.srSet(low, Math.max(Math.min(typed, PRICE_CEILING), low + minimumGap));
			}
			reflect();
		}

		lowField.addEventListener('change', () => acceptTyped(lowField, 'lo'));
		highField.addEventListener('change', () => acceptTyped(highField, 'hi'));
		for (const box of [lowField, highField]) {
			box.addEventListener('keydown', (event) => {
				if (event.key !== 'Enter') return;
				event.preventDefault();
				emit(box, 'change');
			});
		}
		pair.addEventListener('input', reflect);
		reflect();
	}

	/**
	 * Star rating input. The overall score is required; the three small sets
	 * are optional and are named in the saved message when they have a
	 * score. Save resets the form, so the message is held until the reset
	 * has cleared the fields.
	 */
	function wireReviewCard(review) {
		const [mainSet, warning, note] = within(review, '#sr-overall', '#sr-overall-error', '[data-sr-review-status]');
		let submitted = false;
		let pendingNote = '';

		function hasScore() {
			const scored = Boolean(pick('input[name="sr-overall"]:checked', review));
			mainSet.classList.toggle('is-invalid', !scored);
			warning.hidden = scored;
			return scored;
		}

		function scoredExtras() {
			return pickAll('.sr-stars-sm', review).flatMap((set) => {
				const on = pick('input:checked', set);
				return on ? [`${pick('legend', set).textContent} ${on.value}`] : [];
			});
		}

		review.addEventListener('change', () => {
			note.textContent = '';
			if (submitted) hasScore();
		});
		review.addEventListener('submit', (event) => {
			event.preventDefault();
			submitted = true;
			note.textContent = '';
			if (!hasScore()) {
				pick('#sr-overall-1').focus();
				return;
			}
			const picked = pick('input[name="sr-overall"]:checked', review);
			const meaning = picked.nextElementSibling.getAttribute('data-sr-word');
			const extras = scoredExtras();
			const tail = extras.length ? `. ${sentenceList(extras)}.` : '.';
			pendingNote = `Saved: ${picked.value} of 5, "${meaning}"${tail}`;
			review.reset();
		});
		review.addEventListener('reset', () => {
			/* The browser empties the fields after this event, so the repaint waits a tick. */
			setTimeout(() => {
				submitted = false;
				mainSet.classList.remove('is-invalid');
				warning.hidden = true;
				note.textContent = pendingNote;
				pendingNote = '';
				for (const set of pickAll('[data-sr-stars]', review)) set.srRepaint();
			});
		});
	}

	/* Stepped slider with labels: the "Read out as" box echoes each slider's
     number and the word a screen reader gets instead. */
	function wireSteppedCard(demo) {
		function echo() {
			for (const number of pickAll('[data-sr-said]', demo)) {
				const rangeInput = document.getElementById(number.getAttribute('data-sr-said'));
				number.textContent = rangeInput.value;
				pick(`[data-sr-said-text="${rangeInput.id}"]`, demo).textContent =
					`"${rangeInput.getAttribute('aria-valuetext')}"`;
			}
		}

		demo.addEventListener('input', echo);
		echo();
	}

	function bandOf(points) {
		if (points >= 9) return 'promoter';
		return points >= 7 ? 'passive' : 'detractor';
	}

	/**
	 * The 0 to 10 scale. The eleven radios are built here, each labeled with
	 * its band so the CSS can tint it. Picking one shows the follow-up with
	 * the question for that band; sending without a pick shows the error.
	 */
	function wireScaleCard(poll) {
		const [scaleRow, followUp, bandPill, prompt, note, warning] = within(
			poll,
			'[data-sr-nps-scale]',
			'[data-sr-nps-follow]',
			'[data-sr-nps-group]',
			'[data-sr-nps-question]',
			'[data-sr-nps-status]',
			'#sr-nps-error',
		);

		for (let points = 0; points <= 10; points += 1) {
			const radio = make('input', {
				type: 'radio',
				className: 'visually-hidden',
				name: 'sr-nps',
				id: `sr-nps-${points}`,
				value: String(points),
			});
			const choice = make('label', {
				htmlFor: radio.id,
				className: `sr-nps-n is-${bandOf(points)}`,
				textContent: String(points),
			});
			scaleRow.append(radio, choice);
		}

		poll.addEventListener('change', ({ target }) => {
			if (target.name !== 'sr-nps') return;
			const band = bandOf(+target.value);
			followUp.hidden = false;
			Object.assign(bandPill, { textContent: BAND_COPY[band].pill, className: `sr-tag is-${band}` });
			prompt.textContent = BAND_COPY[band].ask;
			warning.hidden = true;
			poll.classList.remove('is-invalid');
			note.textContent = '';
		});
		poll.addEventListener('submit', (event) => {
			event.preventDefault();
			const picked = pick('input[name="sr-nps"]:checked', poll);
			if (!picked) {
				warning.hidden = false;
				poll.classList.add('is-invalid');
				pick('#sr-nps-0').focus();
				return;
			}
			const promise = bandOf(+picked.value) === 'detractor' ? ' Someone from the team will read it today.' : '';
			note.textContent = `Thanks. We got your score of ${picked.value}.${promise}`;
		});
	}

	/**
	 * Face rating. A face reveals checkboxes that fit it (problems for a low
	 * score, praise for a high one); the set is rebuilt only when the band
	 * changes, so ticks survive a move between two faces in the same band.
	 */
	function wireMoodCard(demo) {
		const [reasonSet, reasonHeading, note] = within(
			demo,
			'[data-sr-reasons]',
			'[data-sr-reasons-title]',
			'[data-sr-mood-status]',
		);
		let activeMood = '';

		function moodOf(points) {
			if (points <= 2) return 'low';
			return points === 3 ? 'mid' : 'high';
		}

		function offerReasons(mood) {
			activeMood = mood;
			reasonHeading.textContent = MOOD_PROMPTS[mood].ask;
			for (const stale of pickAll('.basalt-choice', reasonSet)) stale.remove();
			for (const wording of MOOD_PROMPTS[mood].picks) {
				const choice = make('label', { className: 'basalt-choice' });
				choice.append(
					make('input', { type: 'checkbox', name: 'sr-reason', value: wording }),
					make('span', { textContent: wording }),
				);
				reasonSet.append(choice);
			}
		}

		const responses = {
			'sr-face': (face) => {
				const mood = moodOf(+face.value);
				if (mood !== activeMood) offerReasons(mood);
				reasonSet.hidden = false;
				note.textContent = `You picked "${face.nextElementSibling.textContent}".`;
			},
			'sr-reason': () => {
				const ticked = pickAll('input[name="sr-reason"]:checked', reasonSet).map((box) =>
					box.value.toLowerCase(),
				);
				note.textContent = ticked.length ? `Noted: ${sentenceList(ticked)}.` : '';
			},
		};
		demo.addEventListener('change', ({ target }) => responses[target.name]?.(target));
	}

	/**
	 * Slider with number field. The slider and the shared stepper hold one
	 * value; labeled marks under the track point out the volume discounts.
	 */
	function wireSeatsCard(demo) {
		const [rangeInput, seatBox] = within(pageRoot, '#sr-seats', '#sr-seats-box');
		const markRow = pick('[data-sr-marks]', demo);

		/* Only the last mark names the unit, so close marks stay apart on a phone. */
		const markList = markRow.getAttribute('data-sr-marks').split(',');
		for (const seats of markList) {
			const mark = make('span', { textContent: seats === markList.at(-1) ? `${seats} seats` : seats });
			mark.style.left = centerAt(along(rangeInput, +seats));
			markRow.append(mark);
		}

		rangeInput.addEventListener('input', () => {
			seatBox.value = rangeInput.value;
			/* A blur lets the shared stepper gray its buttons out at the ends. */
			seatBox.dispatchEvent(new Event('blur'));
		});
		seatBox.addEventListener('change', () => {
			rangeInput.value = seatBox.value;
			refreshSlider(rangeInput);
		});
	}

	/* Time range slider: the span reads as clock times and as hours apart. */
	function wireWindowCard(demo) {
		const [earliest, latest] = within(pageRoot, '#sr-win-lo', '#sr-win-hi');
		const [readout, length] = within(demo, '[data-sr-window-out]', '[data-sr-window-span]');

		function describe() {
			const opens = +earliest.value;
			const closes = +latest.value;
			const hours = (closes - opens) / 60;
			readout.textContent = `${clockTime(opens)} to ${clockTime(closes)}`;
			length.textContent = `Now ${Number.isInteger(hours) ? hours : hours.toFixed(1)} hour${hours === 1 ? '' : 's'}.`;
		}

		demo.addEventListener('input', describe);
		describe();
	}

	/* The low-stock slider on the sizes and states card: under 10 days the
     track turns amber, under 5 red, and the word beside the help follows. */
	function wireStockCard(rangeInput) {
		const verdict = pick('[data-sr-tone-word]');

		function recolor() {
			const daysLeft = +rangeInput.value;
			const band = daysLeft < 5 ? 'risky' : daysLeft < 10 ? 'tight' : 'good';
			for (const tone of STOCK_BANDS) rangeInput.classList.toggle(`is-${tone}`, band === tone);
			Object.assign(verdict, {
				className: band === 'good' ? 'sr-tone-word' : `sr-tone-word is-${band}`,
				textContent: STOCK_WORDS[band],
			});
		}

		rangeInput.addEventListener('input', recolor);
		recolor();
	}

	start();
})();
