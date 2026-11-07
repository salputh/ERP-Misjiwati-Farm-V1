/**
 * Drives every color field on color-fields.html: the inline and popup
 * pickers, the photo sampler, the swatch radios, the contrast pair, the
 * token-colored tags, the gradient stop editor and the native inputs. All of
 * it lives under [data-cpick-root]; nothing here needs a library.
 */
(() => {
	'use strict';

	const host = slot(document, 'root');

	/* Fixed colors the picker offers and compares against. */
	const PURE_WHITE = { r: 255, g: 255, b: 255, a: 1 };
	const PURE_BLACK = { r: 0, g: 0, b: 0, a: 1 };
	const PRESET_SWATCHES = [
		['Moorings blue', '#1F4E79'],
		['Signal amber', '#E0A526'],
		['Pine', '#2F6B4F'],
		['Rust orange', '#D9622B'],
		['Brick', '#9C3D2E'],
		['Slate', '#3E5566'],
		['Concrete', '#D5D2CB'],
		['Asphalt', '#1E2430'],
	];
	const HUE_STRIP =
		'linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))';
	const HEX_DIGITS = /^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
	const canDropEye = 'EyeDropper' in window;

	/* The recent row is shared: a color committed in one picker shows in all. */
	const RECENT_STORE = 'basalt-cpick-recent';
	const RECENT_LIMIT = 8;
	let recentHexes = [];
	const livePickers = [];
	let pickerCount = 0;

	/* Cards that paint from theme tokens re-run these after a theme switch. */
	const themeRepaints = [];
	const noticeTimers = new WeakMap();
	let probe = null;

	/**
	 * Builds the page. The inline picker has to be made before the popup one,
	 * because their ids are numbered in the order they are created.
	 */
	function start() {
		probe = makeProbe();
		recentHexes = loadRecent();
		document.addEventListener('basalt:appearance', queueRepaints);

		mountInlinePicker();
		mountTintScale();
		mountCaseSwatches();
		mountSampler();
		mountTokenTags();
		mountContrastPair();
		mountGradient();
		mountNativeInputs();
		mountCopyButtons();
		mountKindFilter();
	}

	/** Waits a frame so the new theme's tokens have landed, then repaints. */
	function queueRepaints() {
		requestAnimationFrame(() => {
			for (const repaint of themeRepaints) repaint();
		});
	}

	/* One mount function per card, in the order the cards appear. */

	/** The inline picker, mirrored live onto the customer portal mock-up. */
	function mountInlinePicker() {
		const panel = slot(host, 'inline');
		const portal = slot(host, 'portal');
		if (!panel || !portal) return;

		const solidParts = pickAll('[data-cpick-portal-fill]', portal);
		const badge = slot(portal, 'portal-soft');
		const glyph = slot(portal, 'portal-icon');
		const inkReadout = slot(portal, 'portal-text');
		const pageReadout = slot(portal, 'portal-page');
		const cssReadout = slot(portal, 'portal-css');
		let painted = readHex(panel.getAttribute('data-value'));

		buildPicker(panel, { value: hexOf(painted, true), onInput: paintPortal });
		paintPortal(painted);
		themeRepaints.push(() => paintPortal(painted));

		function paintPortal(color) {
			painted = color;
			const flattened = layerOver(color, pageColor());
			const ink = inkFor(flattened);
			const asCss = cssValue(color);
			for (const part of solidParts) {
				part.style.backgroundColor = asCss;
				part.style.color = ink.hex;
			}
			badge.style.setProperty('--cpick-soft', hexOf(flattened));
			glyph.style.color = hexOf(flattened);
			inkReadout.textContent = `${ink.word}, ${ratioText(ink.ratio)}`;
			const againstPage = contrastRatio(flattened, pageColor());
			pageReadout.textContent = ratioText(againstPage) + pageVerdict(againstPage);
			cssReadout.textContent = asCss;
		}
	}

	/** What a brand color may be used for on the page, by its contrast. */
	function pageVerdict(ratio) {
		if (ratio >= 4.5) return ', fine for links';
		return ratio >= 3 ? ', fine for borders and icons' : ', too faint for borders';
	}

	/** The popup picker feeds a base color into a tint scale with export code. */
	function mountTintScale() {
		const section = slot(host, 'ramp');
		if (!section) return;

		const tileList = slot(section, 'ramp-tiles');
		const prefixInput = slot(section, 'ramp-name');
		const countInput = slot(section, 'ramp-steps');
		const exportBox = slot(section, 'ramp-code');
		const notice = slot(section, 'ramp-status');
		let seedColor = null;
		let scale = [];

		tileList.addEventListener('click', (event) => {
			const tile = event.target.closest('.cpick-tile');
			if (tile) copyHexWithNotice(tile.getAttribute('data-hex'), notice);
		});
		countInput.addEventListener('change', drawScale);
		prefixInput.addEventListener('input', drawScale);
		for (const radio of pickAll('[name="cpRampFmt"]', section)) radio.addEventListener('change', writeExport);

		attachPopup(slot(section, 'popup'), (color) => {
			seedColor = layerOver(color, PURE_WHITE);
			drawScale();
		});

		function prefix() {
			const slug = prefixInput.value
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '');
			return slug || 'brand';
		}

		function drawScale() {
			if (!seedColor) return;
			const total = within(+countInput.value || 9, 5, 11);
			const { h, s, l } = toHsl(seedColor);
			scale = Array.from({ length: total }, (_, index) => {
				const t = index / (total - 1);
				const lightness = 96 - t * 82;
				const color = fromHsl(h - (t - 0.5) * 8, s * (1 - Math.abs(t - 0.5) * 0.5), lightness);
				return { grade: (index + 1) * 100, hex: hexOf(color), color, lightness };
			});
			const closest = closestToSeed(l);
			tileList.innerHTML = '';
			for (const [index, entry] of scale.entries()) {
				const item = document.createElement('li');
				item.innerHTML = tileMarkup(entry, index === closest);
				tileList.appendChild(item);
			}
			tileList.style.setProperty('--cpick-tiles', String(total));
			writeExport();
		}

		/** Index of the step whose lightness sits nearest the base color's. */
		function closestToSeed(seedLightness) {
			let closest = 0;
			for (const [index, entry] of scale.entries()) {
				if (Math.abs(entry.lightness - seedLightness) < Math.abs(scale[closest].lightness - seedLightness))
					closest = index;
			}
			return closest;
		}

		function tileMarkup(entry, isSeed) {
			const ink = inkFor(entry.color);
			const spoken = `${prefix()} ${entry.grade}, ${entry.hex}${isSeed ? ', closest to the base' : ''}. Copy`;
			const marker = isSeed ? '<span class="cpick-tile-base">Base</span>' : '';
			return `<button class="cpick-tile" type="button" aria-label="${spoken}" data-hex="${entry.hex}" style="background:${entry.hex};color:${ink.hex}"><span class="cpick-tile-step">${entry.grade}</span>${marker}</button><span class="cpick-tile-hex">${entry.hex}</span>`;
		}

		function writeExport() {
			const asJson = pick('[name="cpRampFmt"]:checked', section).value !== 'css';
			const key = prefix();
			if (asJson) {
				const table = Object.fromEntries(scale.map((entry) => [entry.grade, entry.hex]));
				exportBox.textContent = JSON.stringify({ [key]: table }, null, 2);
				return;
			}
			const lines = scale.map((entry) => `  --${key}-${entry.grade}: ${entry.hex};`);
			exportBox.textContent = `:root {\n${lines.join('\n')}\n}`;
		}
	}

	/** Six fixed gift box colors as radios; the art and stock line follow. */
	function mountCaseSwatches() {
		const section = slot(host, 'case');
		if (!section) return;

		const ON_HAND = {
			'Chalk white': 32,
			'Slate blue': 14,
			'Moss green': 3,
			'Rust orange': 21,
			Charcoal: 9,
			'Mustard yellow': 0,
		};
		const chosenName = slot(section, 'case-name');
		const stockLine = slot(section, 'case-stock');

		for (const swatch of pickAll('.cpick-swatch', section)) {
			swatch.style.setProperty('--swatch', swatch.getAttribute('data-color'));
		}
		section.addEventListener('change', (event) => {
			if (event.target.name === 'cpCaseColor') showChoice();
		});
		showChoice();

		function showChoice() {
			const radio = pick('[name="cpCaseColor"]:checked', section);
			section.style.setProperty('--cpick-case-color', radio.closest('.cpick-swatch').getAttribute('data-color'));
			chosenName.textContent = radio.value;
			const left = ON_HAND[radio.value];
			stockLine.textContent = left < 5 ? `Only ${left} left` : `${left} in stock`;
		}
	}

	/** Samples colors from a drawn job photo, or from one the visitor loads. */
	function mountSampler() {
		const board = slot(host, 'canvas');
		if (!board) return;

		const pen = board.getContext('2d', { willReadFrequently: true });
		const width = board.width;
		const height = board.height;
		const ring = slot(host, 'reticle');
		const nowDot = slot(host, 'photo-dot');
		const nowHex = slot(host, 'photo-hex');
		const leadingRow = slot(host, 'photo-main');
		const savedRow = slot(host, 'photo-kept');
		const emptyNote = slot(host, 'photo-empty');
		const clearButton = slot(host, 'photo-clear');
		const upload = slot(host, 'photo-file');
		const uploadError = slot(host, 'photo-error');
		const notice = slot(host, 'photo-status');
		const screenButton = slot(host, 'photo-eye');
		const aim = { x: 0.5, y: 0.47 };
		const saved = [];

		board.addEventListener('pointermove', (event) => {
			aimAt(event);
			readAim();
		});
		board.addEventListener('click', (event) => {
			aimAt(event);
			save(hexOf(readAim()));
		});
		board.addEventListener('keydown', onBoardKey);
		for (const row of [leadingRow, savedRow]) {
			row.addEventListener('click', (event) => {
				const pressed = event.target.closest('.cpick-colorchip');
				if (pressed) copyHexWithNotice(pressed.getAttribute('data-hex'), notice);
			});
		}
		clearButton.addEventListener('click', () => {
			saved.length = 0;
			drawSaved();
			announce(notice, 'Cleared the kept colors.');
			board.focus();
		});
		upload.addEventListener('change', loadUpload);
		if (canDropEye) {
			screenButton.hidden = false;
			screenButton.addEventListener('click', () => {
				new window.EyeDropper()
					.open()
					.then((result) => save(result.sRGBHex.toUpperCase()))
					.catch(() => {
						/* Esc closed the eyedropper. */
					});
			});
		}

		paintJobSite(pen, width, height);
		drawLeading();
		readAim();
		drawSaved();

		function onBoardKey(event) {
			const jump = event.shiftKey ? 0.05 : 0.01;
			const nudges = { ArrowLeft: [-jump, 0], ArrowRight: [jump, 0], ArrowUp: [0, -jump], ArrowDown: [0, jump] };
			const nudge = nudges[event.key];
			if (nudge) {
				event.preventDefault();
				aim.x = within(aim.x + nudge[0], 0, 0.999);
				aim.y = within(aim.y + nudge[1], 0, 0.999);
				readAim();
				return;
			}
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			save(hexOf(readAim()));
		}

		function aimAt(event) {
			const box = board.getBoundingClientRect();
			aim.x = within((event.clientX - box.left) / box.width, 0, 0.999);
			aim.y = within((event.clientY - box.top) / box.height, 0, 0.999);
		}

		/** Moves the ring to the aim point and returns the pixel under it. */
		function readAim() {
			const column = within(Math.floor(aim.x * width), 0, width - 1);
			const line = within(Math.floor(aim.y * height), 0, height - 1);
			const [r, g, b] = pen.getImageData(column, line, 1, 1).data;
			const pixel = { r, g, b, a: 1 };
			const hex = hexOf(pixel);
			ring.style.left = `${aim.x * 100}%`;
			ring.style.top = `${aim.y * 100}%`;
			ring.style.setProperty('--swatch', hex);
			nowDot.style.setProperty('--swatch', hex);
			nowHex.textContent = hex;
			return pixel;
		}

		function save(hex) {
			if (!saved.includes(hex)) {
				saved.unshift(hex);
				if (saved.length > 6) saved.pop();
			}
			drawSaved();
			announce(notice, `Kept ${hex}.`);
		}

		function drawSaved() {
			savedRow.replaceChildren(...saved.map(colorChip));
			emptyNote.hidden = saved.length > 0;
			clearButton.hidden = saved.length === 0;
		}

		/**
		 * Groups every fourth pixel by its top four bits per channel, then keeps
		 * the six largest bins that are not too close to one already kept.
		 */
		function drawLeading() {
			const pixels = pen.getImageData(0, 0, width, height).data;
			const bins = new Map();
			for (let offset = 0; offset < pixels.length; offset += 16) {
				const r = pixels[offset];
				const g = pixels[offset + 1];
				const b = pixels[offset + 2];
				const bin = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
				const tally = bins.get(bin) || { n: 0, r: 0, g: 0, b: 0 };
				tally.n += 1;
				tally.r += r;
				tally.g += g;
				tally.b += b;
				bins.set(bin, tally);
			}
			const ranked = [...bins.values()]
				.sort((first, second) => second.n - first.n)
				.map((tally) => ({ r: tally.r / tally.n, g: tally.g / tally.n, b: tally.b / tally.n }));
			const distinct = [];
			for (const candidate of ranked) {
				const farEnough = distinct.every(
					(taken) => Math.hypot(taken.r - candidate.r, taken.g - candidate.g, taken.b - candidate.b) > 56,
				);
				if (farEnough) distinct.push(candidate);
				if (distinct.length === 6) break;
			}
			leadingRow.replaceChildren(...distinct.map((color) => colorChip(hexOf(color))));
		}

		function loadUpload() {
			const picked = upload.files?.[0];
			if (!picked) return;
			if (!picked.type.startsWith('image/')) {
				flagField(upload, uploadError, "That file isn't a picture. Try a JPG or PNG.");
				upload.value = '';
				return;
			}
			flagField(upload, uploadError, '');
			const fileReader = new FileReader();
			fileReader.onload = () => {
				const photo = new Image();
				photo.onload = () => {
					coverBoard(photo);
					board.setAttribute(
						'aria-label',
						`Your photo, ${picked.name}. Move the sampler with the arrow keys and press Enter to keep a color.`,
					);
					drawLeading();
					readAim();
					announce(notice, `Loaded ${picked.name}.`);
				};
				photo.onerror = () =>
					flagField(upload, uploadError, "That picture couldn't be opened. Try a JPG or PNG.");
				photo.src = fileReader.result;
			};
			fileReader.readAsDataURL(picked);
		}

		/** Draws a photo so it fills the board, cropping the overflow evenly. */
		function coverBoard(photo) {
			const zoom = Math.max(width / photo.width, height / photo.height);
			const drawnWidth = photo.width * zoom;
			const drawnHeight = photo.height * zoom;
			pen.clearRect(0, 0, width, height);
			pen.drawImage(photo, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
		}
	}

	/** A chip that copies its hex when pressed. */
	function colorChip(hex) {
		const pill = document.createElement('button');
		pill.className = 'cpick-colorchip';
		pill.type = 'button';
		pill.setAttribute('aria-label', `Copy ${hex}`);
		pill.setAttribute('data-hex', hex);
		pill.innerHTML = `<span class="cpick-dot" style="--swatch:${hex}"></span><span>${hex}</span>`;
		return pill;
	}

	/**
	 * Visit tags colored with chart tokens, so they follow the palette and dark
	 * mode; each tag's text picks black or white against its resolved fill.
	 */
	function mountTokenTags() {
		const section = slot(host, 'tags');
		if (!section) return;

		const TAG_LIMIT = 8;
		const tagList = slot(section, 'tags-list');
		const createForm = slot(section, 'tags-form');
		const labelInput = slot(section, 'tag-name');
		const labelError = pick('#cp-tag-error', section);
		const tally = slot(section, 'tags-count');
		const toneRow = slot(section, 'tone-list');
		const notice = slot(section, 'tags-status');
		const entries = [
			{ title: 'Key safe', tone: 7 },
			{ title: 'Gate code', tone: 3 },
			{ title: 'Monthly care plan', tone: 1 },
			{ title: 'Dog on site', tone: 6 },
		];

		for (let tone = 1; tone <= 8; tone += 1) toneRow.appendChild(toneOption(tone));
		tagList.addEventListener('click', onRemove);
		createForm.addEventListener('submit', onAdd);
		labelInput.addEventListener('input', () => {
			if (!labelError.hidden) flagField(labelInput, labelError, '');
		});
		drawTags();
		themeRepaints.push(drawTags);

		function toneOption(tone) {
			const option = document.createElement('label');
			option.className = 'cpick-swatch cpick-swatch-sm';
			option.style.setProperty('--swatch', `var(--basalt-series-${tone})`);
			const preset = tone === 2 ? ' checked' : '';
			option.innerHTML = `<input name="cpTagTone" type="radio" value="${tone}"${preset}><span class="cpick-swatch-dot"></span><span class="visually-hidden">Theme color ${tone}</span>`;
			return option;
		}

		function drawTags() {
			tagList.replaceChildren(...entries.map(tagItem));
			tally.textContent = `${entries.length} of ${TAG_LIMIT} tags`;
		}

		function tagItem({ title, tone }) {
			const token = `var(--basalt-series-${tone})`;
			const tagPill = document.createElement('span');
			tagPill.className = 'cpick-tag';
			tagPill.style.backgroundColor = token;
			tagPill.style.color = inkFor(measure(token)).hex;
			tagPill.append(title);

			const dismiss = document.createElement('button');
			dismiss.className = 'cpick-tag-remove';
			dismiss.type = 'button';
			dismiss.setAttribute('aria-label', `Remove ${title}`);
			dismiss.setAttribute('data-name', title);
			dismiss.innerHTML = '<i class="bi bi-x" aria-hidden="true"></i>';
			tagPill.appendChild(dismiss);

			const item = document.createElement('li');
			item.appendChild(tagPill);
			return item;
		}

		function onRemove(event) {
			const dismiss = event.target.closest('.cpick-tag-remove');
			if (!dismiss) return;
			const title = dismiss.getAttribute('data-name');
			const at = entries.findIndex((entry) => entry.title === title);
			if (at > -1) entries.splice(at, 1);
			drawTags();
			announce(notice, `Removed ${title}.`);
			const neighbor = pickAll('.cpick-tag-remove', tagList)[Math.min(at, entries.length - 1)];
			(neighbor || labelInput).focus();
		}

		function onAdd(event) {
			event.preventDefault();
			const title = labelInput.value.trim().replace(/\s+/g, ' ');
			const problem = tagProblem(title);
			flagField(labelInput, labelError, problem);
			if (problem) {
				labelInput.focus();
				return;
			}
			entries.push({ title, tone: +pick('[name="cpTagTone"]:checked', createForm).value });
			drawTags();
			labelInput.value = '';
			announce(notice, `Added ${title}.`);
		}

		/** The first reason a new tag cannot be added, or an empty string. */
		function tagProblem(title) {
			if (!title) return 'Give the tag a name.';
			const wanted = title.toLowerCase();
			if (entries.some((entry) => entry.title.toLowerCase() === wanted))
				return `There is already a tag called ${title}.`;
			if (entries.length >= TAG_LIMIT) return `You can have up to ${TAG_LIMIT} tags. Remove one first.`;
			return '';
		}
	}

	/** Ink on paper, rated against the WCAG levels, with a one-click fix. */
	function mountContrastPair() {
		const section = slot(host, 'contrast');
		if (!section) return;

		const inkWell = slot(section, 'ink-native');
		const inkText = slot(section, 'ink-hex');
		const paperWell = slot(section, 'paper-native');
		const paperText = slot(section, 'paper-hex');
		const sampleLabel = slot(section, 'label');
		const ratioReadout = slot(section, 'ratio');
		const levels = pickAll('[data-cpick-checks] li', section);
		const fixButton = slot(section, 'fix');
		const fixNotice = slot(section, 'fix-status');
		const pair = { ink: readHex(inkText.value), paper: readHex(paperText.value) };

		linkHexToNative(inkWell, inkText, pick('#cp-ink-error', section), (color) => {
			pair.ink = color;
			rate();
		});
		linkHexToNative(paperWell, paperText, pick('#cp-paper-error', section), (color) => {
			pair.paper = color;
			rate();
		});
		slot(section, 'swap').addEventListener('click', () => {
			[pair.ink, pair.paper] = [pair.paper, pair.ink];
			writePair();
			rate();
		});
		fixButton.addEventListener('click', () => {
			pair.ink = readHex(hexOf(passingInk()));
			inkText.value = hexOf(pair.ink);
			inkWell.value = hexOf(pair.ink).toLowerCase();
			rate();
			announce(fixNotice, `Ink changed to ${hexOf(pair.ink)}, keeping its hue.`);
			inkText.focus();
		});
		rate();

		function writePair() {
			inkText.value = hexOf(pair.ink);
			paperText.value = hexOf(pair.paper);
			inkWell.value = hexOf(pair.ink).toLowerCase();
			paperWell.value = hexOf(pair.paper).toLowerCase();
		}

		function rate() {
			sampleLabel.style.color = hexOf(pair.ink);
			sampleLabel.style.backgroundColor = hexOf(pair.paper);
			const ratio = contrastRatio(pair.ink, pair.paper);
			ratioReadout.textContent = ratioText(ratio);
			for (const level of levels) {
				const passes = ratio >= +level.getAttribute('data-need');
				const [mark, title, need] = level.children;
				level.classList.toggle('is-pass', passes);
				level.classList.toggle('is-fail', !passes);
				mark.className = `bi ${passes ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`;
				level.setAttribute(
					'aria-label',
					`${title.textContent}: ${passes ? 'passes' : 'fails'}, needs ${need.textContent}`,
				);
			}
			fixButton.hidden = ratio >= 4.5;
		}

		/**
		 * Walks the ink's lightness one point at a time, first toward the side
		 * away from the paper, until it clears 4.6:1 with the hue kept. Falls
		 * back to plain black or white when neither direction gets there.
		 */
		function passingInk() {
			const { h, s, l } = toHsl(pair.ink);
			const directions = relativeLuminance(pair.paper) > 0.18 ? [-1, 1] : [1, -1];
			for (const direction of directions) {
				for (let lightness = l; lightness >= 0 && lightness <= 100; lightness += direction) {
					const attempt = { ...fromHsl(h, s, lightness), a: 1 };
					if (contrastRatio(attempt, pair.paper) >= 4.6) return attempt;
				}
			}
			return inkFor(pair.paper).hex === '#FFFFFF' ? PURE_WHITE : PURE_BLACK;
		}
	}

	/** A gradient as a list of stops on a bar, previewed on a gift section. */
	function mountGradient() {
		const section = slot(host, 'grad');
		if (!section) return;

		const STARTERS = {
			copper: {
				angle: 135,
				stops: [
					[0, '#1E2430'],
					[55, '#B87333'],
					[100, '#F2D7B6'],
				],
			},
			pine: {
				angle: 160,
				stops: [
					[0, '#E3EFE6'],
					[45, '#6FA287'],
					[100, '#2F6B4F'],
				],
			},
			signal: {
				angle: 110,
				stops: [
					[0, '#FFE7A3'],
					[40, '#E0A526'],
					[75, '#D9622B'],
					[100, '#1F4E79'],
				],
			},
		};
		const track = slot(section, 'gbar');
		const trackFill = slot(section, 'gbar-fill');
		const giftCard = slot(section, 'gift');
		const stopWell = slot(section, 'grad-native');
		const stopHex = slot(section, 'grad-hex');
		const stopHexError = pick('#cp-grad-hex-error', section);
		const stopPosition = slot(section, 'grad-pos');
		const dropButton = slot(section, 'grad-remove');
		const angleSlider = slot(section, 'grad-angle');
		const angleReadout = slot(section, 'grad-angle-out');
		const angleBlock = slot(section, 'grad-angle-wrap');
		const cssBox = slot(section, 'grad-css');
		const notice = slot(section, 'copy-status');
		let stops = [];
		let active = 1;
		let shape = 'linear';

		track.addEventListener('pointerdown', onTrackPress);
		track.addEventListener('keydown', onStopKey);
		/* Only the selected stop is in the tab order; focusing another selects it. */
		track.addEventListener('focusin', (event) => {
			const handle = event.target.closest('.cpick-gstop');
			if (!handle || +handle.getAttribute('data-i') === active) return;
			active = +handle.getAttribute('data-i');
			drawStops(true);
		});
		stopWell.addEventListener('input', () => {
			stops[active].color = stopWell.value.toUpperCase();
			stopHex.value = stops[active].color;
			flagField(stopHex, stopHexError, '');
			drawStops(false);
		});
		stopHex.addEventListener('change', takeTypedHex);
		stopHex.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter') return;
			event.preventDefault();
			stopHex.dispatchEvent(new Event('change'));
		});
		stopPosition.addEventListener('change', () => {
			const percent = within(Math.round(+stopPosition.value || 0), 0, 100);
			if (percent === stops[active].pos) return;
			stops[active].pos = percent;
			drawStops(false);
		});
		dropButton.addEventListener('click', () => {
			if (!dropActive()) {
				announce(notice, 'A gradient needs at least two stops.');
				return;
			}
			drawStops(false);
		});
		angleSlider.addEventListener('input', () => drawStops(false));
		for (const radio of pickAll('[name="cpGradType"]', section)) {
			radio.addEventListener('change', () => {
				shape = radio.value;
				drawStops(false);
			});
		}
		for (const button of pickAll('[data-cpick-preset]', section)) {
			button.addEventListener('click', () => useStarter(button.getAttribute('data-cpick-preset')));
		}
		useStarter('copper');

		function byPosition() {
			return [...stops].sort((first, second) => first.pos - second.pos);
		}

		function stopList() {
			return byPosition()
				.map((stop) => `${stop.color} ${stop.pos}%`)
				.join(', ');
		}

		function gradientCss() {
			if (shape !== 'linear') return `radial-gradient(circle at 30% 30%, ${stopList()})`;
			return `linear-gradient(${angleSlider.value}deg, ${stopList()})`;
		}

		/** Paints the bar, the gift section and the code; leaves handles alone. */
		function paintOutputs() {
			trackFill.style.background = `linear-gradient(90deg, ${stopList()})`;
			giftCard.style.background = gradientCss();
			cssBox.textContent = `background: ${gradientCss()};`;
		}

		/** The color the gradient already shows at a percentage along the bar. */
		function colorAlong(percent) {
			const ordered = byPosition();
			if (percent <= ordered[0].pos) return ordered[0].color;
			const rightIndex = ordered.findIndex((stop, index) => index > 0 && percent <= stop.pos);
			if (rightIndex === -1) return ordered[ordered.length - 1].color;
			const left = ordered[rightIndex - 1];
			const right = ordered[rightIndex];
			const from = readHex(left.color);
			const to = readHex(right.color);
			const t = (percent - left.pos) / (right.pos - left.pos || 1);
			return hexOf({
				r: from.r + (to.r - from.r) * t,
				g: from.g + (to.g - from.g) * t,
				b: from.b + (to.b - from.b) * t,
			});
		}

		function drawStops(focusActive) {
			for (const handle of pickAll('.cpick-gstop', track)) handle.remove();
			for (const [index, stop] of stops.entries()) {
				const handle = stopHandle(stop, index);
				track.appendChild(handle);
				if (focusActive && index === active) handle.focus();
			}
			paintOutputs();
			const selected = stops[active];
			stopWell.value = selected.color.toLowerCase();
			if (document.activeElement !== stopHex) stopHex.value = selected.color;
			stopPosition.value = selected.pos;
			stopPosition.dispatchEvent(new Event('blur'));
			angleReadout.textContent = `${angleSlider.value}°`;
			angleSlider.setAttribute('aria-valuetext', `${angleSlider.value} degrees`);
			angleBlock.hidden = shape !== 'linear';
		}

		function stopHandle(stop, index) {
			const handle = document.createElement('div');
			const chosen = index === active;
			handle.className = chosen ? 'cpick-gstop is-selected' : 'cpick-gstop';
			handle.tabIndex = chosen ? 0 : -1;
			handle.style.left = `${stop.pos}%`;
			handle.style.setProperty('--swatch', stop.color);
			const attributes = {
				role: 'slider',
				'aria-label': `Stop ${index + 1}, ${stop.color}`,
				'aria-valuemin': '0',
				'aria-valuemax': '100',
				'aria-valuenow': String(stop.pos),
				'aria-valuetext': `${stop.pos}%`,
				'data-i': String(index),
			};
			for (const [attribute, text] of Object.entries(attributes)) handle.setAttribute(attribute, text);
			return handle;
		}

		function useStarter(key) {
			const starter = STARTERS[key];
			stops = starter.stops.map(([pos, color]) => ({ pos, color }));
			angleSlider.value = starter.angle;
			active = Math.min(1, stops.length - 1);
			flagField(stopHex, stopHexError, '');
			drawStops(false);
		}

		function percentAt(event) {
			const box = track.getBoundingClientRect();
			return Math.round(within(((event.clientX - box.left) / box.width) * 100, 0, 100));
		}

		/** Picks up a handle, or adds a stop where the bar was pressed, then drags it. */
		function onTrackPress(event) {
			const handle = event.target.closest('.cpick-gstop');
			if (handle) {
				active = +handle.getAttribute('data-i');
			} else {
				if (stops.length >= 8) return;
				const percent = percentAt(event);
				stops.push({ pos: percent, color: colorAlong(percent) });
				active = stops.length - 1;
			}
			drawStops(true);
			const dragged = pick('.cpick-gstop.is-selected', track);
			dragged.setPointerCapture(event.pointerId);
			dragged.addEventListener('pointermove', follow);
			dragged.addEventListener('pointerup', release);
			event.preventDefault();

			function follow(moveEvent) {
				const stop = stops[active];
				stop.pos = percentAt(moveEvent);
				dragged.style.left = `${stop.pos}%`;
				dragged.setAttribute('aria-valuenow', String(stop.pos));
				dragged.setAttribute('aria-valuetext', `${stop.pos}%`);
				paintOutputs();
				stopPosition.value = stop.pos;
			}

			function release() {
				dragged.removeEventListener('pointermove', follow);
				dragged.removeEventListener('pointerup', release);
				drawStops(true);
			}
		}

		function onStopKey(event) {
			if (!event.target.closest('.cpick-gstop')) return;
			const jump = event.shiftKey ? 10 : 1;
			const actions = {
				ArrowLeft: () => slide(-jump),
				ArrowDown: () => slide(-jump),
				ArrowRight: () => slide(jump),
				ArrowUp: () => slide(jump),
				Delete: dropActive,
				Backspace: dropActive,
				Home: () => select(0),
				End: () => select(stops.length - 1),
			};
			if (!Object.hasOwn(actions, event.key) || !actions[event.key]()) return;
			event.preventDefault();
			drawStops(true);
		}

		function slide(amount) {
			stops[active].pos = within(stops[active].pos + amount, 0, 100);
			return true;
		}

		function select(index) {
			active = index;
			return true;
		}

		/** Removes the selected stop unless only two are left; says whether it did. */
		function dropActive() {
			if (stops.length <= 2) return false;
			stops.splice(active, 1);
			active = Math.max(0, active - 1);
			return true;
		}

		function takeTypedHex() {
			const typed = readHex(stopHex.value);
			if (!typed || typed.a < 1) {
				flagField(stopHex, stopHexError, 'Use a six-digit hex code like #B87333.');
				return;
			}
			flagField(stopHex, stopHexError, '');
			stops[active].color = hexOf(typed);
			stopHex.value = stops[active].color;
			drawStops(false);
		}
	}

	/**
	 * The browser's own color input: a lone one with a readout, and a van
	 * livery form whose lettering must clear 3:1 against the van color.
	 */
	function mountNativeInputs() {
		const lone = slot(host, 'solo');
		const loneReadout = slot(host, 'solo-out');
		if (lone && loneReadout) {
			lone.addEventListener('input', () => {
				loneReadout.textContent = lone.value.toUpperCase();
			});
		}

		const liveryForm = slot(host, 'livery');
		if (!liveryForm) return;

		const SAMPLE_CODES = { main: '#1F4E79', text: '#FFFFFF' };
		const savedLine = slot(liveryForm, 'livery-done');
		const layout = liveryForm.closest('.cpick-livery');
		const stripe = slot(layout, 'livery-band');
		const ratioReadout = slot(layout, 'livery-ratio');
		const warning = slot(layout, 'livery-note');
		const wells = {};
		for (const well of pickAll('[data-cpick-livery-native]', liveryForm)) {
			wells[well.getAttribute('data-cpick-livery-native')] = well;
		}
		const livery = { main: readHex(hexBox('main').value), text: readHex(hexBox('text').value) };
		let submitted = false;

		for (const part of ['main', 'text']) {
			linkHexToNative(
				wells[part],
				hexBox(part),
				errorFor(hexBox(part)),
				(color) => {
					livery[part] = color;
					savedLine.textContent = '';
					drawVan();
					if (submitted) checkLivery();
				},
				`Use a six-digit hex code like ${SAMPLE_CODES[part]}.`,
			);
		}
		liveryForm.addEventListener('submit', (event) => {
			event.preventDefault();
			submitted = true;
			savedLine.textContent = '';
			const firstBad = checkLivery();
			if (firstBad) {
				firstBad.focus();
				return;
			}
			savedLine.textContent = `Saved: van ${hexOf(livery.main)}, lettering ${hexOf(livery.text)}, ${ratioText(contrastRatio(livery.main, livery.text))} contrast.`;
		});
		/* The browser restores the fields after the reset event, so read them a tick later. */
		liveryForm.addEventListener('reset', () => {
			setTimeout(() => {
				submitted = false;
				savedLine.textContent = '';
				for (const part of ['main', 'text']) {
					flagField(hexBox(part), errorFor(hexBox(part)), '');
					livery[part] = readHex(hexBox(part).value);
					wells[part].value = hexBox(part).value.toLowerCase();
				}
				drawVan();
			});
		});
		drawVan();

		function hexBox(part) {
			return pick(`[data-cpick-field="${part}"]`, liveryForm);
		}

		function errorFor(field) {
			return document.getElementById(`${field.id}-error`);
		}

		/** When the pair is too alike, the mock-up is lettered in black or white and says so. */
		function drawVan() {
			const ratio = contrastRatio(livery.main, livery.text);
			const legible = ratio >= 3;
			stripe.style.backgroundColor = hexOf(livery.main);
			stripe.style.color = legible ? hexOf(livery.text) : inkFor(livery.main).hex;
			warning.hidden = legible;
			warning.textContent = legible
				? ''
				: `Shown in ${inkFor(livery.main).word.toLowerCase()} here: your lettering color would barely show on this van.`;
			ratioReadout.textContent = ratioText(ratio);
		}

		/** Shows each field's problem and returns the first field that has one. */
		function checkLivery() {
			const body = readHex(hexBox('main').value);
			const lettering = readHex(hexBox('text').value);
			const bodyProblem = body && body.a === 1 ? '' : `Use a six-digit hex code like ${SAMPLE_CODES.main}.`;
			let letteringProblem =
				lettering && lettering.a === 1 ? '' : `Use a six-digit hex code like ${SAMPLE_CODES.text}.`;
			if (!bodyProblem && !letteringProblem && contrastRatio(body, lettering) < 3) {
				letteringProblem = `These two colors are too alike to read from the road (${ratioText(contrastRatio(body, lettering))}). Pick a lighter or darker lettering color.`;
			}
			flagField(hexBox('main'), errorFor(hexBox('main')), bodyProblem);
			flagField(hexBox('text'), errorFor(hexBox('text')), letteringProblem);
			if (bodyProblem) return hexBox('main');
			return letteringProblem ? hexBox('text') : null;
		}
	}

	/** Buttons that copy the text of the element their selector names. */
	function mountCopyButtons() {
		for (const button of pickAll('[data-cpick-copy]', host)) {
			button.addEventListener('click', () => {
				const source = pick(button.getAttribute('data-cpick-copy'), host);
				const notice = slot(button.parentElement, 'copy-status');
				writeClipboard(source ? source.textContent : '')
					.then(() => announce(notice, 'Copied'))
					.catch(() => announce(notice, 'Could not copy'));
			});
		}
	}

	/** The chip row above the grid shows one kind of field, or all of them. */
	function mountKindFilter() {
		const deck = slot(host, 'grid');
		const toggles = pickAll('[data-cpick-filter]', host);
		const summary = slot(host, 'count');
		const articles = [...pickAll('.cpick-card', deck)];

		for (const toggle of toggles) {
			toggle.addEventListener('click', () => {
				const wanted = toggle.getAttribute('data-cpick-filter');
				for (const other of toggles) other.setAttribute('aria-pressed', String(other === toggle));
				const visible = articles.filter((article) => {
					const keep = wanted === 'all' || article.getAttribute('data-cpick-kind') === wanted;
					article.classList.toggle('is-hidden', !keep);
					return keep;
				}).length;
				deck.classList.toggle('is-filtered', wanted !== 'all');
				summary.textContent = visible === 1 ? '1 field type' : `${visible} field types`;
			});
		}
	}

	/* The picker panel shared by the inline and popup fields. */

	/**
	 * Fills an empty panel with the full picker and wires it up.
	 * @param {HTMLElement} panel
	 * @param {{value: string, popup?: boolean, onInput?: Function, onCommit?: Function}} options
	 *   onInput runs on every change, onCommit when a change is let go of.
	 * @returns {{setColor: Function, focus: Function, refreshRecent: Function}}
	 */
	function buildPicker(panel, options) {
		pickerCount += 1;
		const uid = `cpk${pickerCount}`;
		const hsva = { h: 0, s: 0, v: 0, a: 1 };
		let mode = 'hex';

		panel.innerHTML = pickerMarkup(uid, Boolean(options.popup));
		const square = hook('sv');
		const knob = pick('.cpick-sv-thumb', square);
		const hueSlider = hook('h');
		const opacitySlider = hook('a');
		const opacityTrack = hook('a-wrap');
		const currentChip = hook('current');
		const fieldBox = hook('inputs');
		const errorLine = hook('err');
		const recentGrid = hook('recent');
		const recentBlock = hook('recent-wrap');
		const screenButton = hook('eye');
		const presetGrid = hook('brand');

		hueSlider.style.setProperty('--cpick-track', HUE_STRIP);
		for (const [title, hex] of PRESET_SWATCHES) presetGrid.appendChild(swatchButton(title, hex));

		square.addEventListener('pointerdown', onSquarePress);
		square.addEventListener('keydown', onSquareKey);
		square.addEventListener('keyup', (event) => {
			if (event.key.startsWith('Arrow')) report(true);
		});
		hueSlider.addEventListener('input', () => {
			hsva.h = +hueSlider.value;
			refresh();
			report(false);
		});
		opacitySlider.addEventListener('input', () => {
			hsva.a = +opacitySlider.value / 100;
			refresh();
			report(false);
		});
		for (const slider of [hueSlider, opacitySlider]) slider.addEventListener('change', () => report(true));
		for (const radio of pickAll(`[name="${uid}-fmt"]`, panel)) {
			radio.addEventListener('change', () => {
				mode = radio.value;
				flagField(null, errorLine, '');
				buildFields();
			});
		}
		fieldBox.addEventListener('change', commitFields);
		fieldBox.addEventListener('keydown', onFieldKey);
		panel.addEventListener('click', (event) => {
			const swatch = event.target.closest('.cpick-sw-btn');
			if (!swatch) return;
			applyColor(swatch.getAttribute('data-hex'), true);
			report(true);
		});
		if (screenButton && canDropEye) {
			screenButton.addEventListener('click', () => {
				new window.EyeDropper()
					.open()
					.then((result) => {
						applyColor(result.sRGBHex, true);
						report(true);
					})
					.catch(() => {
						/* Esc closed the eyedropper. */
					});
			});
		}

		buildFields();
		refreshRecent();
		applyColor(options.value, true);
		const handle = { setColor: applyColor, refreshRecent, focus: () => square.focus() };
		livePickers.push(handle);
		return handle;

		function hook(name) {
			return pick(`[data-${name}]`, panel);
		}

		function currentColor() {
			return { ...fromHsv(hsva.h, hsva.s, hsva.v), a: hsva.a };
		}

		/**
		 * Moves the picker to a color without echoing it back, unless asked to.
		 * Grays keep the old hue so the square does not jump to red.
		 */
		function applyColor(input, quiet) {
			const color = typeof input === 'string' ? readHex(input) : input;
			if (!color) return false;
			const hsv = toHsv(color);
			if (hsv.s > 0 && hsv.v > 0) hsva.h = hsv.h;
			hsva.s = hsv.s;
			hsva.v = hsv.v;
			hsva.a = color.a == null ? 1 : color.a;
			refresh();
			if (!quiet) report(false);
			return true;
		}

		/** Tells the owner about a change; a commit also goes into the recent row. */
		function report(isCommit) {
			const color = currentColor();
			options.onInput?.(color);
			if (!isCommit) return;
			options.onCommit?.(color);
			rememberColor(hexOf(color));
		}

		function refresh() {
			const color = currentColor();
			const hex = hexOf(color);
			const pureHue = hexOf(fromHsv(hsva.h, 100, 100));
			const saturation = Math.round(hsva.s);
			const opacity = Math.round(hsva.a * 100);
			square.style.background = `linear-gradient(to top, #000000, transparent), linear-gradient(to right, #FFFFFF, ${pureHue})`;
			knob.style.left = `${hsva.s}%`;
			knob.style.top = `${100 - hsva.v}%`;
			knob.style.setProperty('--swatch', hex);
			square.setAttribute('aria-valuenow', String(saturation));
			square.setAttribute(
				'aria-valuetext',
				`Saturation ${saturation}%, brightness ${Math.round(hsva.v)}%, ${hex}`,
			);
			hueSlider.value = Math.round(hsva.h);
			hueSlider.setAttribute('aria-valuetext', `${Math.round(hsva.h)} degrees`);
			opacitySlider.value = opacity;
			opacitySlider.setAttribute('aria-valuetext', `${opacity}%`);
			opacityTrack.style.setProperty('--cpick-track', `linear-gradient(to right, ${hex}00, ${hex})`);
			currentChip.style.background = cssValue(color);
			fillFields();
			markPressed();
		}

		function refreshRecent() {
			recentGrid.replaceChildren(...recentHexes.map((hex) => swatchButton('', hex)));
			recentBlock.hidden = recentHexes.length === 0;
			markPressed();
		}

		function markPressed() {
			const hex = hexOf(currentColor());
			for (const swatch of pickAll('.cpick-sw-btn', panel)) {
				swatch.setAttribute('aria-pressed', String(swatch.getAttribute('data-hex') === hex && hsva.a === 1));
			}
		}

		function onSquarePress(event) {
			square.setPointerCapture(event.pointerId);
			square.focus({ preventScroll: true });
			followPointer(event);
			square.addEventListener('pointermove', followPointer);
			square.addEventListener('pointerup', letGo);
			square.addEventListener('pointercancel', letGo);

			function letGo() {
				square.removeEventListener('pointermove', followPointer);
				square.removeEventListener('pointerup', letGo);
				square.removeEventListener('pointercancel', letGo);
				report(true);
			}
		}

		function followPointer(event) {
			const box = square.getBoundingClientRect();
			hsva.s = within(((event.clientX - box.left) / box.width) * 100, 0, 100);
			hsva.v = within(100 - ((event.clientY - box.top) / box.height) * 100, 0, 100);
			refresh();
			report(false);
		}

		function onSquareKey(event) {
			const amount = event.shiftKey ? 10 : 1;
			const axis = {
				ArrowLeft: ['s', -amount],
				ArrowRight: ['s', amount],
				ArrowUp: ['v', amount],
				ArrowDown: ['v', -amount],
			}[event.key];
			if (!axis) return;
			event.preventDefault();
			const [channel, delta] = axis;
			hsva[channel] = within(hsva[channel] + delta, 0, 100);
			refresh();
			report(false);
		}

		function buildFields() {
			fieldBox.className = `cpick-inputs cpick-inputs-${mode}`;
			fieldBox.replaceChildren(...FIELD_SETS[mode].map((key) => typedField(uid, key)));
			fillFields();
		}

		/** Writes the color into every typed field except the one being edited. */
		function fillFields() {
			const color = currentColor();
			const hsl = toHsl(color);
			const readings = {
				x: hexOf(color),
				a: Math.round(hsva.a * 100),
				r: Math.round(color.r),
				g: Math.round(color.g),
				b: Math.round(color.b),
				h: Math.round(hsl.h),
				s: Math.round(hsl.s),
				l: Math.round(hsl.l),
			};
			for (const field of pickAll('input', fieldBox)) {
				if (field !== document.activeElement) field.value = readings[field.getAttribute('data-key')];
			}
		}

		function commitFields() {
			const outcome = readFields();
			for (const field of pickAll('input', fieldBox)) {
				field.classList.remove('is-invalid');
				field.removeAttribute('aria-invalid');
			}
			if (outcome.field) {
				flagField(outcome.field, errorLine, outcome.message);
				return;
			}
			flagField(null, errorLine, '');
			applyColor(outcome.color, true);
			report(true);
		}

		/** Arrow keys step a number field (Shift for tens); Enter commits. */
		function onFieldKey(event) {
			const field = event.target.closest('input');
			if (!field) return;
			if (event.key === 'Enter') {
				event.preventDefault();
				commitFields();
				return;
			}
			const key = field.getAttribute('data-key');
			const direction = { ArrowUp: 1, ArrowDown: -1 }[event.key];
			if (!direction || key === 'x') return;
			event.preventDefault();
			const { low, high } = CHANNELS[key];
			field.value = within((parseFloat(field.value) || 0) + direction * (event.shiftKey ? 10 : 1), low, high);
			commitFields();
		}

		/**
		 * Checks the typed fields in order and turns them into a color.
		 * @returns {{field: HTMLInputElement, message: string} | {color: object}}
		 */
		function readFields() {
			for (const field of pickAll('input', fieldBox)) {
				const message = fieldProblem(field.getAttribute('data-key'), field.value);
				if (message) return { field, message };
			}
			const opacity = Number(raw('a').replace('%', '')) / 100;
			const readers = {
				hex: () => {
					const parsed = readHex(raw('x'));
					return { ...parsed, a: parsed.a < 1 ? parsed.a : opacity };
				},
				rgb: () => ({ r: +raw('r'), g: +raw('g'), b: +raw('b'), a: opacity }),
				hsl: () => ({
					...fromHsl(+raw('h'), +raw('s').replace('%', ''), +raw('l').replace('%', '')),
					a: opacity,
				}),
			};
			return { color: readers[mode]() };

			function raw(key) {
				return pick(`[data-key="${key}"]`, fieldBox)?.value.trim() ?? '';
			}
		}
	}

	/* Which typed fields each format shows, and how each one is labeled and bounded. */
	const FIELD_SETS = { hex: ['x', 'a'], rgb: ['r', 'g', 'b', 'a'], hsl: ['h', 's', 'l', 'a'] };
	const CHANNELS = {
		x: { caption: 'Hex', size: 9 },
		r: { caption: 'R', size: 3, noun: 'Red', low: 0, high: 255 },
		g: { caption: 'G', size: 3, noun: 'Green', low: 0, high: 255 },
		b: { caption: 'B', size: 3, noun: 'Blue', low: 0, high: 255 },
		h: { caption: 'H', size: 3, noun: 'Hue', low: 0, high: 360 },
		s: { caption: 'S %', size: 3, noun: 'Saturation', low: 0, high: 100 },
		l: { caption: 'L %', size: 3, noun: 'Lightness', low: 0, high: 100 },
		a: { caption: 'Opacity %', size: 3, noun: 'Opacity', low: 0, high: 100 },
	};

	/** The error for one typed field, or an empty string when it is fine. */
	function fieldProblem(key, text) {
		if (key === 'x') return readHex(text) ? '' : 'Use a hex code like #2F6B4F.';
		const trimmed = text.trim();
		const number = Number(trimmed.replace('%', ''));
		const { noun, low, high } = CHANNELS[key];
		const fits = trimmed !== '' && !Number.isNaN(number) && number >= low && number <= high;
		return fits ? '' : `${noun} goes from ${low} to ${high}.`;
	}

	function typedField(uid, key) {
		const { caption: text, size } = CHANNELS[key];
		const caption = document.createElement('label');
		caption.className = 'cpick-inputs-label';
		caption.htmlFor = `${uid}-${key}`;
		caption.textContent = text;

		const field = document.createElement('input');
		Object.assign(field, {
			className: 'form-control form-control-sm',
			id: `${uid}-${key}`,
			type: 'text',
			size,
			autocomplete: 'off',
			spellcheck: false,
		});
		if (key !== 'x') field.inputMode = 'numeric';
		field.setAttribute('aria-describedby', `${uid}-err`);
		field.setAttribute('data-key', key);

		const cell = document.createElement('div');
		cell.append(caption, field);
		return cell;
	}

	function swatchButton(title, hex) {
		const swatch = document.createElement('button');
		swatch.className = 'cpick-sw-btn';
		swatch.type = 'button';
		swatch.title = title ? `${title} ${hex}` : hex;
		swatch.style.setProperty('--swatch', hex);
		swatch.setAttribute('aria-label', title ? `${title}, ${hex}` : hex);
		swatch.setAttribute('aria-pressed', 'false');
		swatch.setAttribute('data-hex', hex);
		return swatch;
	}

	/** Static markup of one picker; ids hang off the picker's own uid. */
	function pickerMarkup(uid, withFooter) {
		const footer = withFooter
			? '<div class="cpick-panel-foot"><button class="btn btn-outline-secondary btn-sm" type="button" data-cancel>Cancel</button><button class="btn btn-primary btn-sm" type="button" data-done>Done</button></div>'
			: '';
		const formats = [
			['hex', 'HEX'],
			['rgb', 'RGB'],
			['hsl', 'HSL'],
		]
			.map(
				([format, caption]) =>
					`<label><input name="${uid}-fmt" type="radio" value="${format}"${format === 'hex' ? ' checked' : ''}><span>${caption}</span></label>`,
			)
			.join('\n          ');
		return `
      <div class="cpick-sv" data-sv role="slider" tabindex="0" aria-label="Saturation and brightness" aria-describedby="${uid}-svh" aria-valuemin="0" aria-valuemax="100">
        <span class="cpick-sv-thumb" aria-hidden="true"></span>
      </div>
      <p class="visually-hidden" id="${uid}-svh">Left and right change saturation, up and down change brightness. Hold Shift for bigger steps.</p>
      <div class="cpick-tracks">
        <div class="cpick-tracks-rows">
          <label class="visually-hidden" for="${uid}-hue">Hue</label>
          <input class="cpick-range cpick-range-hue" id="${uid}-hue" data-h type="range" min="0" max="359" step="1" value="0">
          <label class="visually-hidden" for="${uid}-alpha">Opacity</label>
          <div class="cpick-range-wrap" data-a-wrap><input class="cpick-range" id="${uid}-alpha" data-a type="range" min="0" max="100" step="1" value="100"></div>
        </div>
        <span class="cpick-current" aria-hidden="true"><span data-current></span></span>
      </div>
      <div class="cpick-format">
        <div class="cpick-seg" role="radiogroup" aria-label="Color format">
          ${formats}
        </div>
        <button class="btn btn-outline-secondary btn-sm cpick-eye" type="button" data-eye ${canDropEye ? '' : 'hidden'}><i class="bi bi-eyedropper" aria-hidden="true"></i><span class="visually-hidden">Pick a color from the screen</span></button>
      </div>
      <div class="cpick-inputs" data-inputs></div>
      <p class="cpick-error" id="${uid}-err" data-err hidden></p>
      <div class="cpick-sw">
        <p class="cpick-sw-label" id="${uid}-kl">Fieldline colors</p>
        <div class="cpick-sw-grid" data-brand role="group" aria-labelledby="${uid}-kl"></div>
      </div>
      <div class="cpick-sw" data-recent-wrap>
        <p class="cpick-sw-label" id="${uid}-rl">Recent</p>
        <div class="cpick-sw-grid" data-recent role="group" aria-labelledby="${uid}-rl"></div>
      </div>
      ${footer}`;
	}

	/* Fields that pair a picker or a native well with a typed hex. */

	/**
	 * Turns a swatch button, a hex box and an empty panel into a popup picker.
	 * Esc and Cancel put the old color back; Done, a click outside or tabbing
	 * away keep the new one, as most design tools do.
	 * @param {HTMLElement} field  the [data-cpick-popup] wrapper
	 * @param {Function} onChange  called with every color the field takes
	 */
	function attachPopup(field, onChange) {
		const opener = slot(field, 'open');
		const hexField = slot(field, 'field-hex');
		const panel = pick('.cpick-panel', field);
		const describedBy = (hexField.getAttribute('aria-describedby') || '').split(' ');
		const errorLine = document.getElementById(describedBy[describedBy.length - 1]);
		let held = readHex(field.getAttribute('data-value'));
		let beforeOpening = null;

		const inner = buildPicker(panel, { value: hexOf(held, true), popup: true, onInput: take });

		opener.addEventListener('click', () => (panel.hidden ? reveal() : dismiss(false, true)));
		panel.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') return;
			event.stopPropagation();
			dismiss(true, true);
		});
		pick('[data-cancel]', panel).addEventListener('click', () => dismiss(true, true));
		pick('[data-done]', panel).addEventListener('click', () => dismiss(false, true));
		document.addEventListener('pointerdown', (event) => {
			if (!panel.hidden && !field.contains(event.target)) dismiss(false, false);
		});
		field.addEventListener('focusout', (event) => {
			if (!panel.hidden && event.relatedTarget && !field.contains(event.relatedTarget)) dismiss(false, false);
		});
		hexField.addEventListener('change', takeTypedHex);
		hexField.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter') return;
			event.preventDefault();
			takeTypedHex();
		});
		take(held);

		function take(color) {
			held = color;
			opener.style.setProperty('--swatch', cssValue(color));
			if (document.activeElement !== hexField) hexField.value = hexOf(color, true);
			onChange(color);
		}

		function reveal() {
			beforeOpening = { ...held };
			panel.hidden = false;
			opener.setAttribute('aria-expanded', 'true');
			inner.focus();
		}

		function dismiss(revert, returnFocus) {
			if (panel.hidden) return;
			if (revert && beforeOpening) {
				inner.setColor(beforeOpening, true);
				take(beforeOpening);
			} else {
				rememberColor(hexOf(held));
			}
			panel.hidden = true;
			opener.setAttribute('aria-expanded', 'false');
			if (returnFocus) opener.focus();
		}

		function takeTypedHex() {
			const typed = readHex(hexField.value);
			if (!typed) {
				flagField(hexField, errorLine, 'Use a hex code like #1F4E79.');
				return;
			}
			flagField(hexField, errorLine, '');
			inner.setColor(typed, true);
			take(typed);
			hexField.value = hexOf(typed, true);
		}
	}

	/**
	 * Keeps a native color input and a hex text box in step. Typed values are
	 * checked on change or Enter; the browser's own input is always valid.
	 * @param {Function} onChange  receives the parsed color
	 * @param {string} [message]   error shown for a bad or see-through hex
	 */
	function linkHexToNative(well, hexField, errorLine, onChange, message) {
		well.addEventListener('input', () => {
			hexField.value = well.value.toUpperCase();
			flagField(hexField, errorLine, '');
			onChange(readHex(hexField.value));
		});
		hexField.addEventListener('change', acceptTyped);
		hexField.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter') return;
			event.preventDefault();
			acceptTyped();
		});

		function acceptTyped() {
			const typed = readHex(hexField.value);
			if (!typed || typed.a < 1) {
				flagField(hexField, errorLine, message || 'Use a six-digit hex code like #12355B.');
				return;
			}
			flagField(hexField, errorLine, '');
			hexField.value = hexOf(typed);
			well.value = hexOf(typed).toLowerCase();
			onChange(typed);
		}
	}

	/* Recent colors, error lines, announcements and the clipboard. */

	/** The element under scope that carries data-cpick-<name>. */
	function slot(scope, name) {
		return pick(`[data-cpick-${name}]`, scope);
	}

	function loadRecent() {
		try {
			const stored = JSON.parse(localStorage.getItem(RECENT_STORE) || '[]');
			return stored.filter((hex) => readHex(hex)).slice(0, RECENT_LIMIT);
		} catch {
			return [];
		}
	}

	/** Moves a color to the front of the recent row and redraws every picker. */
	function rememberColor(hex) {
		recentHexes = [hex, ...recentHexes.filter((other) => other !== hex)].slice(0, RECENT_LIMIT);
		try {
			localStorage.setItem(RECENT_STORE, JSON.stringify(recentHexes));
		} catch {
			/* Storage is off, as in a private window. */
		}
		for (const instance of livePickers) instance.refreshRecent();
	}

	/** A hidden element used to turn any CSS color, tokens included, into numbers. */
	function makeProbe() {
		const element = document.createElement('span');
		element.setAttribute('aria-hidden', 'true');
		element.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
		host.appendChild(element);
		return element;
	}

	function measure(cssColor) {
		probe.style.backgroundColor = '';
		probe.style.backgroundColor = cssColor;
		return readComputed(getComputedStyle(probe).backgroundColor) || PURE_WHITE;
	}

	function pageColor() {
		return measure('var(--basalt-plane)');
	}

	/** Shows a field's error under it, or clears it when the message is empty. */
	function flagField(field, errorLine, message) {
		if (!errorLine) return;
		errorLine.textContent = message || '';
		errorLine.hidden = !message;
		if (!field) return;
		field.classList.toggle('is-invalid', Boolean(message));
		if (message) field.setAttribute('aria-invalid', 'true');
		else field.removeAttribute('aria-invalid');
	}

	/** Puts a message in a live region and wipes it 3.2 seconds later. */
	function announce(region, message) {
		if (!region) return;
		region.textContent = message;
		clearTimeout(noticeTimers.get(region));
		noticeTimers.set(
			region,
			setTimeout(() => {
				region.textContent = '';
			}, 3200),
		);
	}

	function copyHexWithNotice(hex, region) {
		writeClipboard(hex)
			.then(() => announce(region, `Copied ${hex}.`))
			.catch(() => announce(region, `Could not copy. The hex is ${hex}.`));
	}

	/** Clipboard API where allowed, else a throwaway textarea and execCommand. */
	function writeClipboard(text) {
		if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
		return new Promise((settle, fail) => {
			try {
				const scratch = document.createElement('textarea');
				scratch.value = text;
				scratch.setAttribute('readonly', '');
				scratch.style.cssText = 'position:fixed;left:-9999px;top:0';
				document.body.appendChild(scratch);
				scratch.select();
				document.execCommand('copy');
				scratch.remove();
				settle();
			} catch (problem) {
				fail(problem);
			}
		});
	}

	/* The sample photo the sampler starts with. */

	/**
	 * Paints the sample site photo: siding, lawn, an outdoor light, a concrete
	 * pad, a hose, a raised planter, a tool bag and two flowers. The grass
	 * flecks come from a seeded sequence so every load looks the same.
	 */
	function paintJobSite(pen, width, height) {
		const noise = seededNoise(7);

		/* Siding, with a shadow line under every board. */
		block('#D8D3C8', 0, 0, width, 240);
		for (let top = 22; top < 240; top += 24) block('rgba(60,55,45,.14)', 0, top, width, 3);

		/* Lawn, then light and dark flecks; each fleck draws three numbers in order. */
		const lawn = pen.createLinearGradient(0, 240, 0, height);
		lawn.addColorStop(0, '#6E8F45');
		lawn.addColorStop(1, '#4F6E33');
		block(lawn, 0, 240, width, height - 240);
		for (let fleck = 0; fleck < 900; fleck += 1) {
			const tint = noise() > 0.5 ? 'rgba(200,230,140,.16)' : 'rgba(30,50,20,.18)';
			const x = noise() * width;
			const y = 240 + noise() * (height - 240);
			block(tint, x, y, 2, 5);
		}

		/* The outdoor light on the wall, then the concrete pad in front of it. */
		for (const [fill, x, y, w, h] of [
			['rgba(40,40,40,.18)', 484, 66, 64, 86],
			['#9AA0A6', 478, 60, 64, 86],
			['#7D838A', 478, 60, 64, 10],
			['#F4D35E', 490, 76, 40, 54],
			['rgba(30,30,25,.25)', 176, 262, 300, 70],
			['#B9B5AE', 166, 252, 300, 70],
			['#A4A099', 166, 312, 300, 10],
		])
			block(fill, x, y, w, h);

		/* The hose climbs the wall from behind the planter. */
		pen.lineCap = 'round';
		line('#3E6B35', 12, [
			[200, 196],
			[150, 196],
			[150, 30],
		]);
		line('#5A8F3E', 7, [
			[200, 214],
			[132, 214],
			[132, 30],
		]);

		/* Raised planter: box, planks, lip, soil mound and a blue label. */
		block('#9C6B3F', 200, 110, 240, 160);
		for (let top = 132; top < 262; top += 9) block('#7A5230', 214, top, 212, 4);
		block('#4A3526', 194, 98, 252, 16);
		pen.fillStyle = '#4F7A32';
		pen.beginPath();
		pen.ellipse(320, 104, 88, 8, 0, 0, Math.PI * 2);
		pen.fill();
		block('#1F4E79', 380, 236, 44, 16);

		/* Tool bag, tipped slightly, with its strap and handle. */
		pen.save();
		pen.translate(36, 300);
		pen.rotate(-0.05);
		block('rgba(20,30,10,.3)', 8, 10, 136, 82);
		block('#D9622B', 0, 0, 136, 82);
		block('#2B2B2B', 0, 22, 136, 8);
		pen.strokeStyle = '#3A2B22';
		pen.lineWidth = 6;
		pen.beginPath();
		pen.moveTo(34, 0);
		pen.quadraticCurveTo(68, -40, 102, 0);
		pen.stroke();
		pen.restore();

		/* A curling stem, then two flowers with straight stalks. */
		pen.strokeStyle = '#4F7A32';
		pen.lineWidth = 5;
		pen.beginPath();
		pen.moveTo(530, 360);
		pen.bezierCurveTo(500, 410, 430, 380, 420, 330);
		pen.stroke();
		for (const [x, y, petals] of [
			[530, 340, '#D9779B'],
			[598, 340, '#E0A526'],
		]) {
			disc(petals, x, y, 30);
			disc('#F4D35E', x, y, 12);
			line('#4F7A32', 3, [
				[x, y + 30],
				[x, y + 70],
			]);
		}

		function block(paint, x, y, w, h) {
			pen.fillStyle = paint;
			pen.fillRect(x, y, w, h);
		}

		function line(stroke, thickness, points) {
			pen.strokeStyle = stroke;
			pen.lineWidth = thickness;
			pen.beginPath();
			pen.moveTo(...points[0]);
			for (const point of points.slice(1)) pen.lineTo(...point);
			pen.stroke();
		}

		function disc(paint, x, y, radius) {
			pen.fillStyle = paint;
			pen.beginPath();
			pen.arc(x, y, radius, 0, Math.PI * 2);
			pen.fill();
		}
	}

	/** A Park-Miller sequence in [0, 1) that always starts from the same seed. */
	function seededNoise(start) {
		let state = start;
		return function draw() {
			state = (state * 16807) % 2147483647;
			return (state - 1) / 2147483646;
		};
	}

	/* Conversions between hex, RGB, HSV and HSL, plus WCAG contrast. */

	function within(number, low, high) {
		return Math.min(high, Math.max(low, number));
	}

	function roundTo(number, places = 0) {
		const factor = 10 ** places;
		return Math.round(number * factor) / factor;
	}

	/** Accepts 3, 4, 6 or 8 hex digits, with or without the #; null otherwise. */
	function readHex(text) {
		const digits = String(text || '')
			.trim()
			.replace(/^#/, '');
		if (!HEX_DIGITS.test(digits)) return null;
		const full = digits.length > 4 ? digits : [...digits].map((digit) => digit.repeat(2)).join('');
		const [r, g, b, opacityByte] = full.match(/../g).map((pair) => parseInt(pair, 16));
		return { r, g, b, a: opacityByte === undefined ? 1 : roundTo(opacityByte / 255, 2) };
	}

	/** Uppercase #RRGGBB, with an alpha byte only when asked and see-through. */
	function hexOf(color, keepAlpha) {
		const channels = [color.r, color.g, color.b];
		if (keepAlpha && color.a < 1) channels.push(color.a * 255);
		return `#${channels.map(byteHex).join('')}`.toUpperCase();
	}

	function byteHex(channel) {
		return Math.round(within(channel, 0, 255))
			.toString(16)
			.padStart(2, '0');
	}

	/* getComputedStyle answers in rgb()/rgba() or, for some mixes, color(srgb ...). */
	const COMPUTED_FORMS = [
		{ pattern: /rgba?\(([^)]+)\)/, separator: /[\s,/]+/, scale: 1 },
		{ pattern: /color\(srgb ([^)]+)\)/, separator: /[\s/]+/, scale: 255 },
	];

	function readComputed(text) {
		for (const { pattern, separator, scale } of COMPUTED_FORMS) {
			const found = pattern.exec(text);
			if (!found) continue;
			const parts = found[1].split(separator).filter(Boolean).map(Number);
			return {
				r: parts[0] * scale,
				g: parts[1] * scale,
				b: parts[2] * scale,
				a: parts.length > 3 ? parts[3] : 1,
			};
		}
		return null;
	}

	/** Channels scaled to 0-1 with their extremes and the hue in degrees. */
	function channelSpread({ r, g, b }) {
		const red = r / 255;
		const green = g / 255;
		const blue = b / 255;
		const top = Math.max(red, green, blue);
		const bottom = Math.min(red, green, blue);
		const spread = top - bottom;
		if (!spread) return { hue: 0, top, bottom, spread };
		const sector =
			top === red
				? ((green - blue) / spread) % 6
				: top === green
					? (blue - red) / spread + 2
					: (red - green) / spread + 4;
		const degrees = sector * 60;
		return { hue: degrees < 0 ? degrees + 360 : degrees, top, bottom, spread };
	}

	function toHsv(color) {
		const { hue, top, spread } = channelSpread(color);
		return { h: hue, s: top ? (spread / top) * 100 : 0, v: top * 100 };
	}

	function toHsl(color) {
		const { hue, top, bottom, spread } = channelSpread(color);
		const lightness = (top + bottom) / 2;
		const saturation = spread ? spread / (1 - Math.abs(2 * lightness - 1)) : 0;
		return { h: hue, s: saturation * 100, l: lightness * 100 };
	}

	function fromHsv(hue, saturation, brightness) {
		const s = saturation / 100;
		const v = brightness / 100;
		return { r: channel(5) * 255, g: channel(3) * 255, b: channel(1) * 255 };

		function channel(offset) {
			const k = (offset + hue / 60) % 6;
			return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
		}
	}

	function fromHsl(hue, saturation, lightness) {
		const h = ((hue % 360) + 360) % 360;
		const s = saturation / 100;
		const l = lightness / 100;
		const reach = s * Math.min(l, 1 - l);
		return { r: channel(0) * 255, g: channel(8) * 255, b: channel(4) * 255 };

		function channel(offset) {
			const k = (offset + h / 30) % 12;
			return l - reach * Math.max(-1, Math.min(k - 3, 9 - k, 1));
		}
	}

	function linearize(channel) {
		const unit = channel / 255;
		return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
	}

	function relativeLuminance({ r, g, b }) {
		return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
	}

	function contrastRatio(first, second) {
		const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((x, y) => y - x);
		return (lighter + 0.05) / (darker + 0.05);
	}

	/** The opaque color a see-through one makes on top of an opaque backdrop. */
	function layerOver(top, backdrop) {
		const opacity = top.a == null ? 1 : top.a;
		return { r: blend('r'), g: blend('g'), b: blend('b'), a: 1 };

		function blend(channel) {
			return top[channel] * opacity + backdrop[channel] * (1 - opacity);
		}
	}

	/** Black or white, whichever reads better on the fill; one always clears 4.5:1. */
	function inkFor(fill) {
		const onWhite = contrastRatio(fill, PURE_WHITE);
		const onBlack = contrastRatio(fill, PURE_BLACK);
		if (onWhite >= onBlack) return { hex: '#FFFFFF', word: 'White', ratio: onWhite };
		return { hex: '#000000', word: 'Black', ratio: onBlack };
	}

	/** A ratio rounded down to one decimal, as WCAG tools show it. */
	function ratioText(ratio) {
		return `${(Math.floor(ratio * 10) / 10).toFixed(1)}:1`;
	}

	/** Hex while opaque; space-separated rgb() with a slash alpha once see-through. */
	function cssValue(color) {
		if (!(color.a < 1)) return hexOf(color);
		return `rgb(${Math.round(color.r)} ${Math.round(color.g)} ${Math.round(color.b)} / ${roundTo(color.a, 2)})`;
	}

	if (host) start();

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
