/**
 * Behavior for progress.html. The pills narrow the card grid and the
 * copy buttons lift each card's snippet; after that comes one block per
 * live demo: the upload list, the checkout steps, the nested rings, the
 * gauge, the setup checklist, the ring slider, the loyalty stamps, the
 * busy bar and the stripe switch. Every bar is Bootstrap's own markup;
 * this script only moves numbers and classes about. Plain ES6.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-pg-root]', document);
	if (!pageRoot) return;

	const stillness = window.matchMedia('(prefers-reduced-motion: reduce)');
	const canObserve = 'IntersectionObserver' in window;

	/* The demo bars grow with the rest of their card, and again on Replay,
	   so the shared grow-in in basalt.js leaves them alone. */
	for (const bar of pickAll('[data-pg-grow]')) bar.setAttribute('data-basalt-no-grow', '');
	let uploadDemo = null;

	/* What counts up and what follows in turn when a card is first seen.
	   The rings and the gauge count their own figures once they are drawn. */
	const COUNTED =
		'.pg-label-value, .pg-bar-text, .pg-legend strong, .pg-stamps-count, [data-pg-ring] .basalt-ring-value';
	const STAGGERED = [
		'.basalt-steps-item',
		'.basalt-checklist-item .form-check-input:checked',
		'.basalt-progress-goal-mark',
		'.basalt-gauge-zone',
		'.pg-legend li',
		'.pg-rings-legend li',
	];

	/** Wires the page controls, then builds each demo that is present. */
	function start() {
		hookUpChips();
		wireCopyButtons();
		wireFirstLook();
		uploadDemo = buildUploadList();
		buildSteps();
		buildRings();
		buildChecklist();
		buildGauge();
		buildRingSlider();
		buildStamps();
		buildBusyBar();
		buildStripeSwitch();
		pick('[data-pg-replay]', document)?.addEventListener('click', () => {
			uploadDemo?.restart();
			for (const card of pickAll('.pg-card:not(.is-waiting)')) playFirstLook(card);
		});
	}

	/* Lookups and small shared moves. */

	function pick(selector, scope = pageRoot) {
		return scope.querySelector(selector);
	}
	function pickAll(selector, scope = pageRoot) {
		return [...scope.querySelectorAll(selector)];
	}
	function countOf(amount, singular, pluralForm) {
		return `${amount} ${amount === 1 ? singular : pluralForm}`;
	}

	/** Sets a Bootstrap bar: the fill's width and the value on its track. */
	function fillBar(track, percent) {
		const clamped = Math.max(0, Math.min(100, percent));
		const fillNode = pick('.progress-bar', track);
		if (fillNode) fillNode.style.width = `${clamped}%`;
		track.setAttribute('aria-valuenow', String(Math.round(clamped)));
	}

	/** Lights the first `upTo` blocks of a segmented bar. */
	function lightBlocks(blocks, upTo) {
		for (const [index, block] of blocks.entries()) block.classList.toggle('is-on', index < upTo);
	}

	/** Looks up several parts of a demo at once: { name: selector } in, { name: element } out. */
	function partsOf(scope, selectors) {
		return Object.fromEntries(Object.entries(selectors).map(([name, selector]) => [name, pick(selector, scope)]));
	}

	/** Runs the callback the first time the target scrolls into view, then stops watching. */
	function onceInView(target, threshold, callback) {
		const watcher = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watcher.disconnect();
				callback();
			},
			{ threshold },
		);
		watcher.observe(target);
	}

	/* The pills show one kind of card at a time and keep the count honest. */
	function hookUpChips() {
		const cardGrid = pick('[data-pg-grid]');
		const tally = pick('[data-pg-count]');
		if (!cardGrid) return;
		const allCards = pickAll('.pg-card', cardGrid);
		const pills = pickAll('[data-pg-filter]');

		function show(kind) {
			const kept = allCards.filter((card) => {
				const wanted = kind === 'all' || card.getAttribute('data-pg-kind') === kind;
				card.classList.toggle('is-hidden', !wanted);
				card.classList.remove('is-alone');
				return wanted;
			});
			pairUp(kept);
			if (tally) tally.textContent = countOf(kept.length, 'progress type', 'progress types');
		}

		for (const pill of pills) {
			pill.addEventListener('click', () => {
				for (const sibling of pills) sibling.setAttribute('aria-pressed', String(sibling === pill));
				show(pill.getAttribute('data-pg-filter'));
			});
		}
		show('all');
	}

	/** Half-width cards pair between the full-width ones; an odd one left at the end of a run spans the row. */
	function pairUp(shownCards) {
		let runLength = 0;
		let lastInRun = null;
		for (const card of shownCards) {
			if (!card.classList.contains('pg-card-full')) {
				runLength += 1;
				lastInRun = card;
				continue;
			}
			if (runLength % 2) lastInRun.classList.add('is-alone');
			runLength = 0;
		}
		if (runLength % 2) lastInRun.classList.add('is-alone');
	}

	/* Each copy button lifts the <pre> beside it and says so for a moment. */
	function wireCopyButtons() {
		for (const button of pickAll('[data-pg-copy]')) {
			button.addEventListener('click', () => {
				const codeBlock = pick('pre', button.parentElement);
				if (!codeBlock) return;
				window.Basalt.copyText(codeBlock.textContent.trim()).then(() => flashCopied(button));
			});
		}
	}

	function flashCopied(button) {
		const glyph = pick('.bi', button);
		const show = (word, glyphClass) => {
			button.lastChild.textContent = ` ${word}`;
			if (glyph) glyph.className = `bi ${glyphClass}`;
		};
		show('Copied', 'bi-check2');
		clearTimeout(button._pgCopyTimer);
		button._pgCopyTimer = setTimeout(() => show('Copy', 'bi-clipboard'), 1800);
	}

	/* Each card's demo assembles itself the first time the card is seen;
	   the styles are in progress.css. */
	function wireFirstLook() {
		if (!canObserve || stillness.matches) return;
		for (const card of pickAll('.pg-card')) {
			card.classList.add('is-waiting');
			onceInView(card, 0.3, () => playFirstLook(card));
		}
	}

	/** Numbers the staggered pieces, counts the figures up, and tidies up once the run is over. */
	function playFirstLook(card) {
		if (stillness.matches) return;
		card.classList.remove('is-waiting', 'is-drawing');
		const pieces = STAGGERED.flatMap((selector) => {
			const group = pickAll(selector, card);
			group.forEach((piece, at) => piece.style.setProperty('--pg-at', at));
			return group;
		});
		void card.offsetWidth;
		card.classList.add('is-drawing');
		growBars(pickAll('[data-pg-grow]', card));
		const figures = pickAll(COUNTED, card).filter((figure) => !figure.closest('[data-pg-transfer]'));
		window.Basalt.countUp?.(figures);
		const runs = card
			.getAnimations({ subtree: true })
			.filter((run) => run.animationName?.startsWith('pg-look'))
			.map((run) => run.finished);
		Promise.allSettled(runs).then(() => {
			card.classList.remove('is-drawing');
			for (const piece of pieces) piece.style.removeProperty('--pg-at');
		});
	}

	/** Grows each bar out of its track, 40ms after the one before; a bar with its value written inside is uncovered rather than stretched. */
	function growBars(bars) {
		bars.forEach((bar, at) => {
			const frames = bar.classList.contains('pg-bar-text')
				? [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0)' }]
				: [
						{ transform: 'scaleX(0)', transformOrigin: 'left center' },
						{ transform: 'scaleX(1)', transformOrigin: 'left center' },
					];
			bar.animate(frames, {
				duration: 700,
				delay: Math.min(at, 12) * 40,
				easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
				fill: 'backwards',
			});
		});
	}

	/**
	 * The upload list: five files share three lanes, each one pausable,
	 * cancelable and retryable, while the ring adds up the batch. One file
	 * drops its connection on purpose. Returns { restart } for the Replay
	 * button, or null when the card is not on the page.
	 */
	function buildUploadList() {
		const demo = pick('[data-pg-transfer]');
		if (!demo) return null;
		const { queue, batchRing, headline, subline, announcer, holdAll, again } = partsOf(demo, {
			queue: '.basalt-file-queue-list',
			batchRing: '[data-pg-transfer-ring]',
			headline: '[data-pg-transfer-title]',
			subline: '[data-pg-transfer-sub]',
			announcer: '[data-pg-transfer-live]',
			holdAll: '[data-pg-transfer-pause]',
			again: '[data-pg-transfer-reset]',
		});
		const pristine = queue.innerHTML;
		const LANES = 3;
		const TICK_MS = 200;
		let uploads = [];
		let ticker = null;
		let everythingHeld = false;

		function megabytes(amount) {
			return amount.toFixed(1);
		}
		function seconds(amount) {
			return amount < 1 ? 'under a second' : `${Math.ceil(amount)} s`;
		}
		function say(text) {
			announcer.textContent = text;
		}
		function isMoving(upload) {
			return upload.state === 'moving';
		}
		function isWaiting(upload) {
			return upload.state === 'queued';
		}

		/* Reads the rows back into objects and hooks up their two buttons. */
		function collect() {
			uploads = pickAll('.basalt-file-queue-item', queue).map((row) => ({
				row,
				name: pick('.basalt-file-queue-name', row).textContent.trim(),
				size: parseFloat(row.getAttribute('data-size')),
				speed: parseFloat(row.getAttribute('data-speed')),
				failAt: parseFloat(row.getAttribute('data-fail-at')) || 0,
				sent: 0,
				state: 'queued',
				track: pick('.progress', row),
				metaNode: pick('[data-meta]', row),
				mainButton: pick('[data-act="main"]', row),
				closeButton: pick('[data-act="close"]', row),
			}));
			for (const upload of uploads) {
				upload.mainButton.addEventListener('click', () => onMainButton(upload));
				upload.closeButton.addEventListener('click', () => onCloseButton(upload));
			}
		}

		function setButton(button, glyphClass, label, hidden) {
			button.hidden = Boolean(hidden);
			button.setAttribute('aria-label', label);
			pick('.bi', button).className = `bi ${glyphClass}`;
		}

		function paintUpload(upload) {
			const percent = (upload.sent / upload.size) * 100;
			upload.row.className = `basalt-file-queue-item${isMoving(upload) ? '' : ` is-${upload.state}`}`;
			fillBar(upload.track, percent);
			const metaByState = {
				queued: `Waiting · ${megabytes(upload.size)} MB`,
				moving: `${megabytes(upload.sent)} of ${megabytes(upload.size)} MB · ${seconds((upload.size - upload.sent) / upload.speed)} left`,
				paused: `Paused at ${megabytes(upload.sent)} of ${megabytes(upload.size)} MB`,
				done: `${megabytes(upload.size)} MB · Uploaded`,
				error: `Connection dropped at ${Math.round(percent)}%`,
			};
			upload.metaNode.textContent = metaByState[upload.state];
			upload.track.setAttribute('aria-valuetext', upload.metaNode.textContent.trim());
			const hadFocus = document.activeElement === upload.mainButton;
			const mainByState = {
				queued: ['bi-pause-fill', `Pause ${upload.name}`, true],
				moving: ['bi-pause-fill', `Pause ${upload.name}`, false],
				paused: ['bi-play-fill', `Resume ${upload.name}`],
				error: ['bi-arrow-clockwise', `Retry ${upload.name}`],
				done: ['bi-check-lg', '', true],
			};
			setButton(upload.mainButton, ...mainByState[upload.state]);
			const closeVerb = upload.state === 'done' || upload.state === 'error' ? 'Remove ' : 'Cancel ';
			setButton(upload.closeButton, 'bi-x-lg', closeVerb + upload.name);
			/* When the button under the keyboard disappears, focus moves to its neighbor. */
			if (hadFocus && upload.mainButton.hidden) upload.closeButton.focus();
		}

		function paintSummary() {
			const batchSize = uploads.reduce((sum, upload) => sum + upload.size, 0);
			const sent = uploads.reduce((sum, upload) => sum + upload.sent, 0);
			const percent = batchSize ? Math.round((sent / batchSize) * 100) : 0;
			const finished = uploads.filter((upload) => upload.state === 'done').length;
			const failed = uploads.filter((upload) => upload.state === 'error').length;
			const moving = uploads.filter(isMoving);
			const throughput = moving.reduce((sum, upload) => sum + upload.speed, 0);
			batchRing.style.setProperty('--value', percent);
			pick('.basalt-ring-value', batchRing).textContent = `${percent}%`;
			batchRing.setAttribute('aria-label', `Batch ${percent}% uploaded`);

			const sentOfTotal = `${megabytes(sent)} of ${megabytes(batchSize)} MB`;
			let lines;
			if (!uploads.length) lines = ['Nothing left to upload', 'Start again to bring the files back'];
			else if (finished === uploads.length)
				lines = [`All ${countOf(uploads.length, 'file', 'files')} uploaded`, `${megabytes(batchSize)} MB sent`];
			else if (everythingHeld) lines = ['Paused', sentOfTotal];
			else if (failed && !moving.length && !uploads.some(isWaiting))
				lines = [
					`${finished} of ${uploads.length} uploaded, ${countOf(failed, 'file needs', 'files need')} a retry`,
					sentOfTotal,
				];
			else
				lines = [
					`Uploading ${countOf(uploads.length - finished, 'file', 'files')}`,
					`${sentOfTotal}${throughput ? ` · about ${seconds((batchSize - sent) / throughput)} left` : ''}`,
				];
			[headline.textContent, subline.textContent] = lines;

			holdAll.disabled = !uploads.some(
				(upload) => isMoving(upload) || isWaiting(upload) || (everythingHeld && upload.state === 'paused'),
			);
			pick('span', holdAll).textContent = everythingHeld ? 'Resume all' : 'Pause all';
			pick('.bi', holdAll).className = `bi me-1 ${everythingHeld ? 'bi-play-fill' : 'bi-pause-fill'}`;
		}

		/* On every tick the free lanes take the next queued files, and each moving file gains a little, at an uneven pace. */
		function advance() {
			if (document.hidden) return;
			if (!everythingHeld) {
				let busyLanes = uploads.filter(isMoving).length;
				for (const upload of uploads) {
					if (busyLanes >= LANES || !isWaiting(upload)) continue;
					upload.state = 'moving';
					busyLanes += 1;
					paintUpload(upload);
				}
			}
			for (const upload of uploads) {
				if (!isMoving(upload)) continue;
				upload.sent = Math.min(
					upload.size,
					upload.sent + ((upload.speed * TICK_MS) / 1000) * (0.75 + Math.random() * 0.5),
				);
				if (upload.failAt && (upload.sent / upload.size) * 100 >= upload.failAt) {
					upload.failAt = 0;
					upload.state = 'error';
					say(`${upload.name} stopped: connection dropped.`);
				} else if (upload.sent >= upload.size) {
					upload.state = 'done';
					say(`${upload.name} uploaded.`);
				}
				paintUpload(upload);
			}
			paintSummary();
			if (!uploads.some((upload) => isMoving(upload) || isWaiting(upload))) halt();
		}

		function run() {
			if (!ticker) ticker = setInterval(advance, TICK_MS);
		}
		function halt() {
			clearInterval(ticker);
			ticker = null;
		}

		function onMainButton(upload) {
			const moves = {
				moving() {
					upload.state = 'paused';
					say(`${upload.name} paused.`);
				},
				paused() {
					upload.state = 'queued';
					everythingHeld = false;
					say(`${upload.name} resumed.`);
					run();
				},
				error() {
					upload.state = 'queued';
					say(`Trying ${upload.name} again.`);
					run();
				},
			};
			moves[upload.state]?.();
			paintUpload(upload);
			paintSummary();
		}

		function onCloseButton(upload) {
			const at = uploads.indexOf(upload);
			const neighbor = uploads[at + 1] || uploads[at - 1];
			uploads.splice(at, 1);
			say(`${upload.name}${upload.state === 'done' ? ' removed from the list.' : ' canceled.'}`);
			upload.row.classList.add('is-leaving');
			setTimeout(
				() => {
					upload.row.remove();
					if (uploads.length || pick('.basalt-file-queue-empty', demo)) return;
					const notice = document.createElement('p');
					notice.className = 'basalt-file-queue-empty';
					notice.textContent = 'No files in the list.';
					queue.after(notice);
				},
				stillness.matches ? 0 : 200,
			);
			const landing = neighbor
				? neighbor.mainButton.hidden
					? neighbor.closeButton
					: neighbor.mainButton
				: again;
			landing.focus();
			paintSummary();
			run();
		}

		function holdOrRelease() {
			everythingHeld = !everythingHeld;
			for (const upload of uploads) {
				if (everythingHeld && isMoving(upload)) upload.state = 'paused';
				else if (!everythingHeld && upload.state === 'paused') upload.state = 'queued';
				paintUpload(upload);
			}
			say(everythingHeld ? 'All uploads paused.' : 'Uploads resumed.');
			paintSummary();
			if (!everythingHeld) run();
		}

		function restart() {
			halt();
			everythingHeld = false;
			pick('.basalt-file-queue-empty', demo)?.remove();
			queue.innerHTML = pristine;
			collect();
			for (const upload of uploads) paintUpload(upload);
			paintSummary();
			run();
		}

		holdAll.addEventListener('click', holdOrRelease);
		again.addEventListener('click', () => {
			restart();
			say('Upload started again.');
		});
		collect();
		paintSummary();
		/* The uploads begin once the card is on screen, so the movement is seen. */
		if (canObserve) onceInView(demo, 0.3, run);
		else run();
		return { restart };
	}

	/* Checkout steps with Back and Next, mirrored by a compact segmented bar. */
	function buildSteps() {
		const demo = pick('[data-pg-steps]');
		if (!demo) return;
		const rows = pickAll('.basalt-steps-item', demo);
		const { backButton, nextButton, statusLine, compactBar, compactText } = partsOf(demo, {
			backButton: '[data-pg-steps-back]',
			nextButton: '[data-pg-steps-next]',
			statusLine: '[data-pg-steps-status]',
			compactBar: '[data-pg-steps-bar]',
			compactText: '[data-pg-steps-short]',
		});
		const compactBlocks = pickAll('.basalt-segments-block', compactBar);
		const stepNames = rows.map((row) => pick('.basalt-steps-label', row).textContent.trim());
		const stepCount = rows.length;
		let stepAt = rows.findIndex((row) => row.classList.contains('is-current'));

		function paint() {
			for (const [index, row] of rows.entries()) {
				const finished = index < stepAt;
				const active = index === stepAt;
				row.classList.toggle('is-done', finished);
				row.classList.toggle('is-current', active);
				if (active) row.setAttribute('aria-current', 'step');
				else row.removeAttribute('aria-current');
				pick('[data-sr]', row).textContent = `, ${finished ? 'done' : active ? 'current step' : 'not started'}`;
			}
			lightBlocks(compactBlocks, stepAt);
			compactBar.setAttribute('aria-valuenow', String(stepAt));
			compactBar.setAttribute('aria-valuetext', `${stepAt} of ${stepCount} steps done`);
			const finishedAll = stepAt >= stepCount;
			statusLine.textContent = finishedAll
				? `All ${stepCount} steps done`
				: `Step ${stepAt + 1} of ${stepCount}: ${stepNames[stepAt]}`;
			compactText.innerHTML = finishedAll
				? '<strong>Done</strong> · Order placed'
				: `<strong>${stepAt + 1} of ${stepCount}</strong> · ${stepNames[stepAt]}`;
			backButton.disabled = stepAt <= 0;
			nextButton.disabled = finishedAll;
			/* A button that just went dead hands the keyboard to the other one. */
			if (document.activeElement === nextButton && nextButton.disabled) backButton.focus();
			if (document.activeElement === backButton && backButton.disabled) nextButton.focus();
		}

		backButton.addEventListener('click', () => {
			if (stepAt <= 0) return;
			stepAt -= 1;
			paint();
		});
		nextButton.addEventListener('click', () => {
			if (stepAt >= stepCount) return;
			stepAt += 1;
			paint();
		});
		paint();
	}

	/* Three goals as nested rings; the period radios redraw them and a legend button brings one forward. */
	function buildRings() {
		const demo = pick('[data-pg-rings]');
		if (!demo) return;
		const GOALS = {
			week: [
				[82, '$8.2k of $10k'],
				[64, '$3.2k of $5k'],
				[45, '18 of 40'],
			],
			month: [
				[71, '$31.2k of $44k'],
				[93, '$20.5k of $22k'],
				[110, '176 of 160'],
			],
		};
		const { figure, centerValue, centerCaption } = partsOf(demo, {
			figure: '[data-pg-rings-figure]',
			centerValue: '[data-pg-rings-value]',
			centerCaption: '[data-pg-rings-caption]',
		});
		const arcs = pickAll('[data-ring]', demo);
		const legendButtons = pickAll('[data-goal]', demo);
		let period = 'week';
		let picked = -1;

		function paintCenter() {
			const rows = GOALS[period];
			if (picked >= 0) {
				centerValue.textContent = `${rows[picked][0]}%`;
				centerCaption.textContent = pick('.pg-rings-legend-name', legendButtons[picked]).textContent.trim();
				return;
			}
			const average = Math.round(rows.reduce((sum, [percent]) => sum + Math.min(percent, 100), 0) / rows.length);
			centerValue.textContent = `${average}%`;
			centerCaption.textContent = 'on average';
		}

		function paint() {
			for (const [index, [percent, ofText]] of GOALS[period].entries()) {
				arcs[index].style.setProperty('--value', percent);
				pick('[data-pct]', legendButtons[index]).textContent = `${percent}%`;
				pick('[data-of]', legendButtons[index]).textContent = ofText;
			}
			paintCenter();
		}

		for (const radio of pickAll('input[name="pg-rings-period"]', demo)) {
			radio.addEventListener('change', () => {
				period = radio.value;
				paint();
			});
		}
		for (const [index, button] of legendButtons.entries()) {
			button.addEventListener('click', () => {
				picked = picked === index ? -1 : index;
				for (const [sibling, node] of legendButtons.entries())
					node.setAttribute('aria-pressed', String(sibling === picked));
				for (const [sibling, arc] of arcs.entries()) arc.classList.toggle('is-focus', sibling === picked);
				figure.classList.toggle('is-focus', picked >= 0);
				paintCenter();
			});
		}
		/* The rings sweep in from empty the first time they are seen. */
		if (canObserve && !stillness.matches) {
			for (const arc of arcs) arc.style.setProperty('--value', 0);
			onceInView(demo, 0.3, () =>
				requestAnimationFrame(() => {
					paint();
					window.Basalt.countUp?.([centerValue, ...pickAll('[data-pct]', demo)]);
				}),
			);
		} else {
			paint();
		}
	}

	/* A setup checklist: the bar and count follow the boxes. */
	function buildChecklist() {
		const demo = pick('[data-pg-checklist]');
		if (!demo) return;
		const ticks = pickAll('.form-check-input', demo);
		const tally = pick('[data-pg-checklist-count]', demo);
		const track = pick('.progress', demo);

		function paint() {
			const ticked = ticks.filter((box) => box.checked).length;
			for (const box of ticks) box.closest('.basalt-checklist-item').classList.toggle('is-done', box.checked);
			fillBar(track, (ticked / ticks.length) * 100);
			tally.textContent =
				ticked === ticks.length ? `All ${ticks.length} done` : `${ticked} of ${ticks.length} done`;
			demo.classList.toggle('is-complete', ticked === ticks.length);
		}

		for (const box of ticks) box.addEventListener('change', paint);
		paint();
	}

	/* The gauge needle swings to whichever weekday is picked. */
	function buildGauge() {
		const demo = pick('[data-pg-gauge]');
		if (!demo) return;
		const { dial, reading, readingCaption } = partsOf(demo, {
			dial: '[data-pg-gauge-figure]',
			reading: '[data-pg-gauge-value]',
			readingCaption: '[data-pg-gauge-caption]',
		});

		function mood(percent) {
			return percent >= 85 ? 'Nearly full' : percent >= 60 ? 'Busy' : 'Calm';
		}

		function show(radio) {
			const percent = parseInt(radio.value, 10);
			const dayName = pick(`label[for="${radio.id}"]`, demo).textContent.trim();
			dial.style.setProperty('--value', percent);
			reading.textContent = `${percent}%`;
			readingCaption.textContent = `of delivery slots booked on ${dayName} · ${mood(percent)}`;
		}

		for (const radio of pickAll('input[name="pg-gauge-day"]', demo))
			radio.addEventListener('change', () => show(radio));
		const chosen = pick('input[name="pg-gauge-day"]:checked', demo);
		/* The needle climbs from zero once the dial is on screen, so the swing is seen. */
		if (canObserve && !stillness.matches) {
			dial.style.setProperty('--value', 0);
			onceInView(dial, 0.4, () =>
				requestAnimationFrame(() => {
					show(chosen);
					countQuietly(reading);
				}),
			);
		} else {
			show(chosen);
		}
	}

	/** Counts a figure up inside a live region without reading out every step of it. */
	function countQuietly(figure) {
		const region = figure.closest('[aria-live]');
		region?.setAttribute('aria-live', 'off');
		window.Basalt.countUp?.([figure]);
		setTimeout(() => region?.setAttribute('aria-live', 'polite'), 600);
	}

	/* The big ring follows a range slider. */
	function buildRingSlider() {
		const demo = pick('[data-pg-ring]');
		if (!demo) return;
		const { bigRing, rangeInput, readout } = partsOf(demo, {
			bigRing: '[data-pg-ring-main]',
			rangeInput: '[data-pg-ring-range]',
			readout: '[data-pg-ring-note]',
		});
		rangeInput.addEventListener('input', () => {
			const percent = parseInt(rangeInput.value, 10);
			bigRing.style.setProperty('--value', percent);
			pick('.basalt-ring-value', bigRing).textContent = `${percent}%`;
			bigRing.setAttribute('aria-label', `${percent}% of the monthly tailoring sales goal`);
			rangeInput.setAttribute('aria-valuetext', `${percent}%`);
			readout.textContent = `${percent * 2} of 200 pieces sold`;
		});
	}

	/* The loyalty card: one stamp per press, a reward at ten, then a fresh card. */
	function buildStamps() {
		const demo = pick('[data-pg-stamps]');
		if (!demo) return;
		const { loyaltyCard, tally, addButton, prize } = partsOf(demo, {
			loyaltyCard: '[data-pg-stamps-bar]',
			tally: '[data-pg-stamps-count]',
			addButton: '[data-pg-stamps-add]',
			prize: '[data-pg-stamps-reward]',
		});
		const stampBlocks = pickAll('.basalt-segments-block', loyaltyCard);
		let stamped = stampBlocks.filter((block) => block.classList.contains('is-on')).length;

		function paint() {
			lightBlocks(stampBlocks, stamped);
			loyaltyCard.setAttribute('aria-valuenow', String(stamped));
			loyaltyCard.setAttribute('aria-valuetext', `${stamped} of ${stampBlocks.length} stamps`);
			tally.innerHTML = `${stamped} <small>of ${stampBlocks.length} stamps</small>`;
			const cardFull = stamped === stampBlocks.length;
			prize.hidden = !cardFull;
			pick('span', addButton).textContent = cardFull ? 'Start a new card' : 'Add a stamp';
			pick('.bi', addButton).className = `bi me-1 ${cardFull ? 'bi-arrow-counterclockwise' : 'bi-plus-lg'}`;
		}

		addButton.addEventListener('click', () => {
			stamped = stamped === stampBlocks.length ? 0 : stamped + 1;
			paint();
		});
		prize.setAttribute('role', 'status');
		paint();
	}

	/* The busy bar: sliding while a stock check runs, full and green once it is done. */
	function buildBusyBar() {
		const demo = pick('[data-pg-indet]');
		if (!demo) return;
		const { track, caption, button } = partsOf(demo, {
			track: '[data-pg-indet-bar]',
			caption: '[data-pg-indet-note]',
			button: '[data-pg-indet-toggle]',
		});
		const fillNode = pick('.progress-bar', track);
		let checking = true;
		button.addEventListener('click', () => {
			checking = !checking;
			track.classList.toggle('progress-indeterminate', checking);
			fillNode.classList.toggle('bg-success', !checking);
			if (checking) {
				track.removeAttribute('aria-valuenow');
				fillNode.style.width = '';
				caption.textContent = 'Checking stock in all three shops…';
				button.textContent = 'Finish the check';
				return;
			}
			fillBar(track, 100);
			caption.innerHTML =
				'<i class="bi bi-check-circle-fill" aria-hidden="true"></i>Stock checked: 212 items in three shops';
			button.textContent = 'Check again';
		});
	}

	/* The switch sets the stripes moving or stops them. */
	function buildStripeSwitch() {
		const demo = pick('[data-pg-stripes]');
		if (!demo) return;
		const stripeSwitch = pick('[data-pg-stripes-toggle]', demo);
		stripeSwitch.addEventListener('change', () => {
			for (const bar of pickAll('.progress-bar-striped', demo))
				bar.classList.toggle('progress-bar-animated', stripeSwitch.checked);
		});
	}

	start();
})();
