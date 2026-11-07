/**
 * Runs the nine upload fields on file-uploads.html. No byte leaves the
 * page: progress is driven by timers in fakeTransfer(), which is the one place
 * to hand files to fetch() or XMLHttpRequest when a real endpoint exists.
 */
(() => {
	'use strict';

	/* A button at a limit says why in its tooltip instead of going dead. */
	const atLimit = (button, reason) => (window.Basalt?.limit || ((b, r) => (b.disabled = Boolean(r))))(button, reason);

	const pageRoot = pick('[data-upload-root]', document);
	if (!pageRoot) return;

	const MEGABYTE = 1024 * 1024;
	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* Icon classes by file type, tested top to bottom; the plain sheet catches the rest. */
	const TYPE_GLYPHS = [
		[(type) => type.startsWith('image/'), 'bi-file-earmark-image'],
		[(type) => type === 'application/pdf', 'bi-file-earmark-pdf'],
		[(type) => type.startsWith('video/'), 'bi-file-earmark-play'],
		[(type) => /csv|sheet|excel/.test(type), 'bi-file-earmark-spreadsheet'],
	];

	/* The four photos behind "Add sample photos": artwork, file name, width, height. */
	const SAMPLE_GALLERY = [
		['fold', 'sculpted-blazer-front.jpg', 900, 900],
		['stack', 'silk-gowns-on-shelf.jpg', 900, 900],
		['stand', 'sunglasses-on-a-stand.jpg', 900, 900],
		['fold', 'sculpted-blazer-detail.jpg', 900, 900],
	];

	/* The fields a product import understands, the header words that point to
     each one, and how a cell proves it holds a usable value. */
	const IMPORT_COLUMNS = [
		{
			key: 'name',
			label: 'Product name',
			words: ['product', 'name', 'title'],
			check: (cell) => cell.trim() !== '',
			problem: 'no name',
		},
		{
			key: 'sku',
			label: 'SKU',
			words: ['sku', 'code', 'item'],
			check: (cell) => /^[A-Z0-9-]{4,}$/i.test(cell.trim()),
			problem: 'no SKU',
		},
		{
			key: 'price',
			label: 'Price',
			words: ['price', 'cost', 'retail'],
			check: looksLikeMoney,
			problem: 'price is not a number',
		},
		{
			key: 'stock',
			label: 'Stock',
			words: ['stock', 'qty', 'quantity', 'inventory'],
			check: (cell) => /^\d+$/.test(cell.trim()),
			problem: 'stock is not a whole number',
		},
	];

	const CATALOG_CSV = [
		'Product,SKU code,Retail price,In stock,Category,Brand',
		'"E-Gift Card, $250",ML-GIFT250,25.00,500,Extras,Marlo',
		'Sculpted Shoulder Blazer,ML-BLAZ,649.00,42,Clothing,Hollis Atelier',
		'Draped Column Gown,ML-GOWN,429.00,30,Clothing,Hollis Atelier',
		'Chalk-Stripe Suit,,189.00,12,Clothing,Willamette Tailors',
		'Tiered Organza Dress,ML-ORGZ,119.00,18,Clothing,Calder Couture',
		'Leather Trench Coat,ML-TRCH,149.00,55,Clothing,Willamette Tailors',
		'Two-Tone Oxfords,ML-OXFD,49.00,plenty,Accessories,Marlo',
		'Bar Loafers,ML-LOAF,59.00,64,Clothing,Marlo',
		'Shield Sunglasses,ML-SHLD,,40,Accessories,Fairhaven Optical',
		'Cat-Eye Sunglasses,ML-CATE,89.00,20,Accessories,Fairhaven Optical',
		'Made-to-Measure Tailoring,ML-MTM,1200.00,6,Services,',
		'Private Styling Session,ML-STYLE,350.00,8,Services,',
	].join('\n');

	start();

	/** Wires every field the page holds, in the order they appear on screen. */
	function start() {
		relayDropZones();
		setUpGallery(pick('[data-gal]'));
		setUpLogo(pick('[data-logo]'));
		setUpReply(pick('[data-dm-form]'));
		setUpAvatar(pick('[data-ava]'));
		setUpDocuments(pick('[data-docs]'));
		setUpClaim(pick('[data-claim]'));
		setUpChunks(pick('[data-chk]'));
		setUpImport(pick('[data-csv]'));
		setUpNativeRequired();
		setUpKindFilter();
	}

	/* Plumbing shared by every field. */

	/**
	 * Turns a drop on a [data-upload-drop] zone into an `upload:files` event on
	 * the zone's own input, so dropped and picked files take the same route.
	 */
	function relayDropZones() {
		for (const zone of pickAll('[data-upload-drop]')) {
			const field = pick('input[type="file"]', zone);
			acceptDrops(zone, (files) => field.dispatchEvent(new CustomEvent('upload:files', { detail: files })));
		}
	}

	/** Calls receive(files) for a pick through the dialog and for a relayed drop. */
	function whenFilesArrive(field, receive) {
		field.addEventListener('change', () => {
			receive(Array.from(field.files));
			field.value = '';
		});
		field.addEventListener('upload:files', (event) => receive(event.detail));
	}

	/**
	 * Lets files be dropped on any element: it wears overClass while files hover
	 * over it, and receive() gets the files once they land.
	 */
	function acceptDrops(zone, receive, overClass = 'is-over') {
		let layers = 0;

		zone.addEventListener('dragenter', (event) => {
			if (!carriesFiles(event)) return;
			event.preventDefault();
			layers += 1;
			zone.classList.add(overClass);
		});
		zone.addEventListener('dragover', (event) => {
			if (!carriesFiles(event)) return;
			event.preventDefault();
			event.dataTransfer.dropEffect = 'copy';
		});
		zone.addEventListener('dragleave', () => {
			layers = Math.max(0, layers - 1);
			if (layers === 0) zone.classList.remove(overClass);
		});
		zone.addEventListener('drop', (event) => {
			if (!carriesFiles(event)) return;
			event.preventDefault();
			layers = 0;
			zone.classList.remove(overClass);
			receive(Array.from(event.dataTransfer.files));
		});
	}

	function carriesFiles(event) {
		return Array.from(event.dataTransfer?.types ?? []).includes('Files');
	}

	/**
	 * Stands in for a network upload. onProgress hears 0 to 100 every 60 ms,
	 * onFinish fires once at the end, and the returned function cancels it.
	 */
	function fakeTransfer(bytes, onProgress, onFinish) {
		const duration = calmMotion ? 250 : Math.min(2200, 500 + bytes / 4000);
		const began = performance.now();
		let pending = 0;

		advance();
		return () => clearTimeout(pending);

		function advance() {
			const percent = Math.min(100, ((performance.now() - began) / duration) * 100);
			onProgress(percent);
			if (percent < 100) {
				pending = setTimeout(advance, 60);
				return;
			}
			onFinish();
		}
	}

	/* 1. Product gallery: several photos, reordered by drag or buttons. */

	function setUpGallery(host) {
		if (!host) return;
		const limit = Number.parseInt(host.dataset.max, 10);
		const byteCap = Number.parseFloat(host.dataset.maxMb) * MEGABYTE;
		const accepted = ['image/jpeg', 'image/png', 'image/webp'];
		const tray = pick('[data-gal-list]', host);
		const refusals = pick('[data-gal-errors]', host);
		const announcer = pick('[data-gal-status]', host);
		const field = pick('[data-gal-input]', host);
		const clearAll = pick('[data-gal-clear]', host);
		const addSamples = pick('[data-gal-sample]', host);
		let serial = 0;
		let carried = null;

		tray.addEventListener('click', onTrayClick);
		tray.addEventListener('dragstart', (event) => {
			const tile = event.target.closest('.upload-thumb');
			if (!tile || event.target.closest('input')) return;
			carried = tile;
			tile.classList.add('is-dragging');
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', tile.dataset.name);
		});
		tray.addEventListener('dragover', (event) => {
			if (!carried) return;
			event.preventDefault();
			const under = event.target.closest('.upload-thumb');
			for (const tile of tiles()) tile.classList.toggle('is-target', tile === under && tile !== carried);
		});
		tray.addEventListener('drop', (event) => {
			if (!carried) return;
			event.preventDefault();
			const under = event.target.closest('.upload-thumb');
			if (under && under !== carried) reposition(carried, tiles().indexOf(under));
		});
		tray.addEventListener('dragend', () => {
			carried?.classList.remove('is-dragging');
			for (const tile of tiles()) tile.classList.remove('is-target');
			carried = null;
		});
		/* Files from the desktop can land on the photos as well as the zone. */
		acceptDrops(tray, admit, 'is-over-list');

		whenFilesArrive(field, admit);
		clearAll.addEventListener('click', () => {
			for (const tile of tiles()) {
				URL.revokeObjectURL(pick('img', tile).src);
				tile.remove();
			}
			refusals.textContent = '';
			sync();
			announce('All photos removed.');
			field.focus();
		});
		addSamples.addEventListener('click', async () => {
			addSamples.disabled = true;
			admit(await Promise.all(SAMPLE_GALLERY.map((spec) => samplePhoto(...spec))));
		});
		sync();

		function tiles() {
			return pickAll('.upload-thumb', tray);
		}

		function announce(message) {
			announcer.textContent = message;
		}

		/** Adds the files that pass, and lists each refused one with its reason. */
		function admit(files) {
			refusals.textContent = '';
			let space = limit - tiles().length;
			let taken = 0;
			for (const file of files) {
				const reason = !accepted.includes(file.type)
					? `${extensionLabel(file)} files cannot go on the product page. Use JPG, PNG or WebP.`
					: file.size > byteCap
						? `At ${readableSize(file.size)} it is over the 5 MB limit.`
						: space <= 0
							? 'The gallery holds eight photos. Remove one to make space.'
							: null;
				if (reason) {
					refusals.appendChild(refusalRow(file, reason));
					continue;
				}
				space -= 1;
				taken += 1;
				tray.appendChild(buildTile(file));
			}
			sync();
			if (taken)
				announce(`${taken}${taken === 1 ? ' photo added.' : ' photos added.'} ${tiles().length} of ${limit}.`);
		}

		/** Brings the counter, buttons, cover badge and labels in line with the tiles. */
		function sync() {
			const current = tiles();
			const total = current.reduce((sum, tile) => sum + Number(tile.dataset.bytes), 0);
			pick('[data-gal-count]', host).textContent = current.length;
			pick('[data-gal-fill]', host).style.width = `${(current.length / limit) * 100}%`;
			pick('[data-gal-size]', host).textContent = current.length
				? `${readableSize(total)} in total`
				: 'Nothing uploaded yet';
			clearAll.disabled = !current.length;
			atLimit(addSamples, current.length >= limit ? `Holds up to ${limit} photos. Remove one to add more.` : '');
			for (const [place, tile] of current.entries()) {
				const title = tile.dataset.name;
				const badge = pick('.upload-thumb-cover', tile);
				const earlier = pick('[data-move="-1"]', tile);
				const later = pick('[data-move="1"]', tile);
				if (place === 0 && !badge) {
					const cover = make('span', 'upload-thumb-cover');
					cover.append(glyph('bi-star-fill'), 'Cover');
					pick('.upload-thumb-frame', tile).appendChild(cover);
				} else if (place > 0 && badge) {
					badge.remove();
				}
				atLimit(earlier, place === 0 ? 'Already the cover photo' : '');
				atLimit(later, place === current.length - 1 ? 'Already the last photo' : '');
				earlier.setAttribute('aria-label', `Move ${title} earlier`);
				later.setAttribute('aria-label', `Move ${title} later`);
				tile.setAttribute('aria-label', `${place === 0 ? 'Cover photo, ' : `Photo ${place + 1}, `}${title}`);
			}
		}

		function buildTile(file) {
			const fieldId = `gal-${++serial}`;
			const tile = make('li', 'upload-thumb');
			const frame = make('div', 'upload-thumb-frame');
			const preview = make('img');
			const loading = make('div', 'upload-thumb-busy');
			const toolbar = make('div', 'upload-thumb-tools');
			const details = make('div', 'upload-thumb-meta');
			const caption = make('label', 'visually-hidden', `Description of ${file.name}`);
			const altText = make('input', 'form-control form-control-sm');

			tile.draggable = true;
			tile.dataset.name = file.name;
			tile.dataset.bytes = file.size;
			preview.alt = '';
			preview.src = URL.createObjectURL(file);
			loading.appendChild(make('span'));
			toolbar.append(
				toolButton('bi-arrow-left', 'data-move', '-1'),
				toolButton('bi-arrow-right', 'data-move', '1'),
				toolButton('bi-star', 'data-cover', '', `Make ${file.name} the cover`),
				toolButton('bi-trash3', 'data-remove', '', `Remove ${file.name}`, 'upload-thumb-tool-bad'),
			);
			frame.append(preview, loading, toolbar);
			details.append(make('span', null, file.name), make('span', null, readableSize(file.size)));
			caption.htmlFor = fieldId;
			altText.id = fieldId;
			altText.type = 'text';
			altText.placeholder = 'Describe the photo';
			altText.addEventListener('input', () => {
				preview.alt = altText.value;
			});
			tile.append(frame, details, caption, altText);

			fakeTransfer(
				file.size,
				(percent) => {
					loading.firstElementChild.style.width = `${percent}%`;
				},
				() => loading.remove(),
			);
			return tile;
		}

		function toolButton(glyphName, hook, hookValue, label, variant) {
			const button = make('button', variant ? `upload-thumb-tool ${variant}` : 'upload-thumb-tool');
			button.type = 'button';
			button.appendChild(glyph(glyphName));
			button.setAttribute(hook, hookValue);
			if (label) button.setAttribute('aria-label', label);
			return button;
		}

		/** Answers a tile's move, cover and remove buttons, then puts focus somewhere useful. */
		function onTrayClick(event) {
			const button = event.target.closest('button');
			if (!button) return;
			const tile = button.closest('.upload-thumb');
			const place = tiles().indexOf(tile);

			if (button.hasAttribute('data-move')) {
				const step = button.dataset.move;
				reposition(tile, place + Number.parseInt(step, 10));
				const sameWay = pick(`[data-move="${step}"]`, tile);
				(sameWay.disabled ? pick('[data-cover]', tile) : sameWay).focus();
				return;
			}
			if (button.hasAttribute('data-cover')) {
				reposition(tile, 0);
				pick('[data-cover]', tile).focus();
				return;
			}
			if (!button.hasAttribute('data-remove')) return;
			const neighbor = tiles()[place + 1] || tiles()[place - 1];
			URL.revokeObjectURL(pick('img', tile).src);
			tile.remove();
			sync();
			announce(`${tile.dataset.name} removed.`);
			(neighbor ? pick('[data-remove]', neighbor) : field).focus();
		}

		function reposition(tile, target) {
			const current = tiles();
			const from = current.indexOf(tile);
			const to = Math.max(0, Math.min(current.length - 1, target));
			if (to === from) return;
			tray.insertBefore(tile, to > from ? current[to].nextSibling : current[to]);
			sync();
			announce(`${tile.dataset.name}${to === 0 ? ' is now the cover.' : ` moved to position ${to + 1}.`}`);
		}
	}

	/* 2. Logo: one image that replaces the last one. */

	function setUpLogo(host) {
		if (!host) return;
		const field = pick('[data-logo-input]', host);
		const thumb = pick('[data-logo-thumb]', host);
		const title = pick('[data-logo-name]', host);
		const facts = pick('[data-logo-meta]', host);
		const softWarning = pick('[data-logo-warn]', host);
		const problem = pick('[data-logo-error]', host);
		const discard = pick('[data-logo-remove]', host);
		let objectUrl = null;

		whenFilesArrive(field, ([file]) => use(file));
		acceptDrops(host, ([file]) => use(file), 'is-over');
		pick('[data-logo-small]', host).addEventListener('click', () =>
			samplePhoto('pin', 'small-mark.jpg', 200, 200).then(use),
		);
		discard.addEventListener('click', () => {
			if (objectUrl) URL.revokeObjectURL(objectUrl);
			objectUrl = null;
			thumb.textContent = '';
			thumb.appendChild(glyph('bi-image'));
			title.textContent = 'No logo';
			facts.textContent = 'Nothing uploaded';
			softWarning.hidden = true;
			report(problem, field, '');
			discard.hidden = true;
			field.focus();
		});

		async function use(file) {
			if (!file) return;
			if (!/^image\/(png|jpeg|svg\+xml)$/.test(file.type)) {
				report(problem, field, `${file.name} is a ${extensionLabel(file)} file. Use PNG, SVG or JPG.`);
				return;
			}
			if (file.size > 2 * MEGABYTE) {
				report(problem, field, `That logo is ${readableSize(file.size)}. Keep it under 2 MB.`);
				return;
			}
			try {
				const { picture, address } = await openImage(file);
				const { naturalWidth: wide, naturalHeight: tall } = picture;
				const tooSmall = file.type !== 'image/svg+xml' && wide < 300;
				report(problem, field, '');
				if (objectUrl) URL.revokeObjectURL(objectUrl);
				objectUrl = address;
				showOnly(thumb, address);
				title.textContent = file.name;
				facts.textContent = `${wide && tall ? `${wide} × ${tall} px, ` : ''}${readableSize(file.size)}`;
				softWarning.hidden = !tooSmall;
				softWarning.textContent = tooSmall
					? `At ${wide} px wide this will look soft. Use a file 300 px or wider.`
					: '';
				discard.hidden = false;
			} catch {
				report(problem, field, 'That file could not be opened as an image.');
			}
		}

		function showOnly(frame, source) {
			const image = make('img');
			image.alt = '';
			image.src = source;
			frame.textContent = '';
			frame.appendChild(image);
		}
	}

	/* 3. Reply box: text plus files from the paperclip, a drop or the clipboard. */

	function setUpReply(form) {
		if (!form) return;
		const shell = pick('[data-dm-box]', form);
		const message = pick('[data-dm-text]', form);
		const chips = pick('[data-dm-files]', form);
		const field = pick('[data-dm-input]', form);
		const problem = pick('[data-dm-error]', form);
		const announcer = pick('[data-dm-status]', form);
		const queued = [];
		let pasteCount = 0;

		message.addEventListener('paste', (event) => {
			const pasted = Array.from(event.clipboardData?.files || []);
			if (!pasted.length) return;
			event.preventDefault();
			/* Clipboard images arrive nameless or as "image.png"; number them instead. */
			attach(
				pasted.map((file) =>
					!file.name || /^image\.\w+$/.test(file.name)
						? new File([file], `pasted-image-${++pasteCount}.png`, { type: file.type })
						: file,
				),
			);
		});
		acceptDrops(shell, attach, 'is-over');
		whenFilesArrive(field, attach);
		message.addEventListener('input', () => {
			if (!problem.hidden) flag('');
		});
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const words = message.value.trim();
			const count = queued.length;
			if (!words && !count) {
				flag('Write a reply or attach something first.');
				message.focus();
				return;
			}
			for (const image of pickAll('img', chips)) URL.revokeObjectURL(image.src);
			message.value = '';
			chips.textContent = '';
			queued.length = 0;
			const parts = [
				words ? 'the text' : '',
				count ? `${count}${count === 1 ? ' attachment' : ' attachments'}` : '',
			];
			announcer.textContent = `Sent: ${parts.filter(Boolean).join(' and ')}.`;
			message.focus();
		});

		function flag(text) {
			problem.textContent = text;
			problem.hidden = !text;
			shell.classList.toggle('is-invalid', Boolean(text));
			if (text) message.setAttribute('aria-invalid', 'true');
			else message.removeAttribute('aria-invalid');
		}

		function attach(files) {
			flag('');
			for (const file of files) {
				if (file.size > 10 * MEGABYTE) {
					flag(`${file.name} is ${readableSize(file.size)}, over the 10 MB limit for replies.`);
					continue;
				}
				queued.push(file);
				chips.appendChild(buildChip(file));
				announcer.textContent = `${file.name} attached.`;
			}
		}

		function buildChip(file) {
			const chip = make('li');
			const drop = make('button');
			let preview;
			if (file.type.startsWith('image/')) {
				preview = make('img');
				preview.alt = '';
				preview.src = URL.createObjectURL(file);
			} else {
				preview = make('span', 'upload-compose-ficon');
				preview.appendChild(glyph(glyphForType(file)));
			}
			drop.type = 'button';
			drop.setAttribute('aria-label', `Remove ${file.name}`);
			drop.appendChild(glyph('bi-x'));
			drop.addEventListener('click', () => {
				queued.splice(queued.indexOf(file), 1);
				chip.remove();
				announcer.textContent = `${file.name} removed.`;
				message.focus();
			});
			chip.append(preview, make('span', 'upload-compose-fname', file.name), drop);
			return chip;
		}
	}

	/* 4. Avatar: a circular crop with zoom, drag, arrow keys and small previews. */

	function setUpAvatar(host) {
		if (!host) return;
		const circle = pick('[data-ava-frame]', host);
		const stage = pick('[data-ava-canvas]', host);
		const previews = pickAll('[data-ava-mini]', host);
		const zoom = pick('[data-ava-zoom]', host);
		const field = pick('[data-ava-input]', host);
		const problem = pick('[data-ava-error]', host);
		const keep = pick('[data-ava-save]', host);
		const discard = pick('[data-ava-remove]', host);
		const announcer = pick('[data-ava-status]', host);
		const SIDE = stage.width;
		const NUDGES = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
		/* Where the photo sits: its center's offset from the circle's center in
       canvas pixels, and the zoom on top of the cover fit. */
		const view = { image: null, objectUrl: null, shiftX: 0, shiftY: 0, zoom: 1 };
		let grab = null;

		whenFilesArrive(field, ([file]) => load(file));
		acceptDrops(circle, ([file]) => load(file), 'is-over');
		pick('[data-ava-sample]', host).addEventListener('click', () =>
			samplePhoto('face', 'elaine-portrait.jpg', 640, 800).then(load),
		);
		discard.addEventListener('click', () => {
			unload();
			field.focus();
			announcer.textContent = 'Photo removed. Your initials show instead.';
		});
		zoom.addEventListener('input', () => {
			view.zoom = zoom.value / 100;
			zoom.setAttribute('aria-valuetext', `${zoom.value}%`);
			paint();
			edited();
		});
		circle.addEventListener('pointerdown', (event) => {
			if (!view.image) return;
			grab = { x: event.clientX, y: event.clientY, shiftX: view.shiftX, shiftY: view.shiftY };
			circle.setPointerCapture(event.pointerId);
			circle.classList.add('is-dragging');
		});
		circle.addEventListener('pointermove', (event) => {
			if (!grab) return;
			const ratio = SIDE / circle.clientWidth;
			view.shiftX = grab.shiftX + (event.clientX - grab.x) * ratio;
			view.shiftY = grab.shiftY + (event.clientY - grab.y) * ratio;
			paint();
		});
		circle.addEventListener('pointerup', letGo);
		circle.addEventListener('pointercancel', letGo);
		circle.addEventListener('keydown', onKey);
		keep.addEventListener('click', () => {
			keep.disabled = true;
			announcer.textContent = 'Saving…';
			stage.toBlob(
				() => {
					setTimeout(
						() => {
							announcer.textContent = 'Saved. Customers will see it on your next reply.';
						},
						calmMotion ? 0 : 500,
					);
				},
				'image/jpeg',
				0.9,
			);
		});

		async function load(file) {
			if (!file) return;
			if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
				report(problem, field, `${file.name} is not a photo we can use. Pick a JPG, PNG or WebP.`);
				return;
			}
			if (file.size > 8 * MEGABYTE) {
				report(problem, field, `That photo is ${readableSize(file.size)}. Pick one under 8 MB.`);
				return;
			}
			try {
				const { picture, address } = await openImage(file);
				if (picture.naturalWidth < 200 || picture.naturalHeight < 200) {
					URL.revokeObjectURL(address);
					report(
						problem,
						field,
						`This photo is ${picture.naturalWidth} × ${picture.naturalHeight} px. Pick one at least 200 px across so it stays sharp.`,
					);
					return;
				}
				report(problem, field, '');
				if (view.objectUrl) URL.revokeObjectURL(view.objectUrl);
				Object.assign(view, { image: picture, objectUrl: address, shiftX: 0, shiftY: 0, zoom: 1 });
				zoom.value = 100;
				zoom.disabled = false;
				zoom.setAttribute('aria-valuetext', '100%');
				stage.hidden = false;
				pick('[data-ava-initials]', host).hidden = true;
				circle.classList.add('has-photo');
				circle.tabIndex = 0;
				circle.setAttribute('role', 'img');
				circle.setAttribute('aria-label', `Photo position, ${file.name}`);
				discard.hidden = false;
				pick('[data-ava-pick-text]', host).textContent = 'Choose another';
				paint();
				edited();
			} catch {
				report(problem, field, 'That file could not be opened as an image.');
			}
		}

		function unload() {
			if (view.objectUrl) URL.revokeObjectURL(view.objectUrl);
			view.image = null;
			view.objectUrl = null;
			stage.hidden = true;
			pick('[data-ava-initials]', host).hidden = false;
			for (const preview of previews) preview.getContext('2d').clearRect(0, 0, preview.width, preview.height);
			circle.classList.remove('has-photo');
			circle.tabIndex = -1;
			circle.removeAttribute('role');
			circle.removeAttribute('aria-label');
			zoom.value = 100;
			zoom.disabled = true;
			discard.hidden = true;
			pick('[data-ava-pick-text]', host).textContent = 'Choose photo';
			report(problem, field, '');
			edited();
		}

		/** The scale at which the photo just covers the circle, before any zoom. */
		function coverFit() {
			const { image } = view;
			return image ? Math.max(SIDE / image.naturalWidth, SIDE / image.naturalHeight) : 1;
		}

		function scaledSize() {
			return [
				view.image.naturalWidth * coverFit() * view.zoom,
				view.image.naturalHeight * coverFit() * view.zoom,
			];
		}

		/** Keeps the photo covering the circle, then redraws it and the previews. */
		function paint() {
			if (!view.image) return;
			let [width, height] = scaledSize();
			view.shiftX = Math.max(-(width - SIDE) / 2, Math.min((width - SIDE) / 2, view.shiftX));
			view.shiftY = Math.max(-(height - SIDE) / 2, Math.min((height - SIDE) / 2, view.shiftY));
			[width, height] = scaledSize();
			const left = (SIDE - width) / 2 + view.shiftX;
			const top = (SIDE - height) / 2 + view.shiftY;
			const pen = stage.getContext('2d');
			pen.clearRect(0, 0, SIDE, SIDE);
			pen.drawImage(view.image, left, top, width, height);
			for (const preview of previews) {
				const shrink = preview.width / SIDE;
				const small = preview.getContext('2d');
				small.clearRect(0, 0, preview.width, preview.height);
				small.drawImage(view.image, left * shrink, top * shrink, width * shrink, height * shrink);
			}
		}

		function edited() {
			keep.disabled = !view.image;
			announcer.textContent = '';
		}

		function letGo() {
			if (!grab) return;
			grab = null;
			circle.classList.remove('is-dragging');
			edited();
		}

		/** Arrow keys nudge the photo, Shift for bigger steps; + and - zoom. */
		function onKey(event) {
			if (!view.image) return;
			const direction = NUDGES[event.key];
			if (direction) {
				const step = event.shiftKey ? 40 : 10;
				event.preventDefault();
				view.shiftX += direction[0] * step;
				view.shiftY += direction[1] * step;
				paint();
				edited();
				return;
			}
			if (!['+', '=', '-'].includes(event.key)) return;
			event.preventDefault();
			zoom.value = Number(zoom.value) + (event.key === '-' ? -10 : 10);
			zoom.dispatchEvent(new Event('input'));
		}
	}

	/* 5. Required documents: named slots that change with the account type. */

	function setUpDocuments(form) {
		if (!form) return;
		const slots = pickAll('[data-slot]', form);
		const summary = pick('[data-docs-summary]', form);
		const finished = pick('[data-docs-done]', form);
		const MIME_GROUPS = { pdf: ['application/pdf'], image: ['image/jpeg', 'image/png'] };
		const BYTE_CAP = 10 * MEGABYTE;
		const MISSING_WORDS = ['', 'One document is', 'Two documents are', 'Three documents are', 'Four documents are'];
		const ACCOUNT_NAMES = { licensed: 'licensed care', reseller: 'reseller', general: 'service' };
		/* How each state shows: the pill's extra class and words, and whether the
       file line hides (left alone when undefined). */
		const LOOKS = {
			empty: (optional) => ({
				tone: optional ? 'upload-pill-quiet' : '',
				words: optional ? 'Optional' : 'Needed',
				hideFile: true,
			}),
			busy: () => ({ tone: 'upload-pill-busy', words: 'Uploading', hideFile: false }),
			done: () => ({ tone: 'upload-pill-ok', words: 'Ready' }),
			error: () => ({ tone: 'upload-pill-bad', words: 'Not accepted', hideFile: true }),
		};
		const cancels = new Map();

		for (const slot of slots) {
			const field = pick('input[type="file"]', slot);
			whenFilesArrive(field, ([file]) => receive(slot, file));
			acceptDrops(slot, ([file]) => receive(slot, file), 'is-over');
			pick('[data-slot-remove]', slot).addEventListener('click', () => {
				mark(slot, 'empty');
				field.focus();
			});
		}
		for (const choice of pickAll('input[name="docs-type"]', form)) choice.addEventListener('change', fitToAccount);
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			if (!check(true)) return;
			pick('[data-docs-done-text]', form).textContent =
				`${needed().length} documents for your ${ACCOUNT_NAMES[account()]} account are with our onboarding team. We reply within two working days.`;
			finished.hidden = false;
			pick('.upload-actions', form).hidden = true;
			pick('[data-docs-reset]', finished).focus();
		});
		pick('[data-docs-reset]', form).addEventListener('click', () => {
			for (const slot of slots) mark(slot, 'empty');
			finished.hidden = true;
			pick('.upload-actions', form).hidden = false;
			summary.hidden = true;
			pick('input[name="docs-type"]:checked', form).focus();
		});
		fitToAccount();

		function account() {
			return pick('input[name="docs-type"]:checked', form).value;
		}

		/** The slots on show for this account type that are not optional. */
		function needed() {
			return slots.filter((slot) => !slot.hidden && !slot.hasAttribute('data-optional'));
		}

		function fitToAccount() {
			const type = account();
			for (const slot of slots) slot.hidden = !slot.dataset.for.split(' ').includes(type);
			refreshCount();
			if (!summary.hidden) check(false);
		}

		function receive(slot, file) {
			if (!file) return;
			const allowed = slot.dataset.accept.split(' ').flatMap((group) => MIME_GROUPS[group]);
			const pdfOnly = slot.dataset.accept === 'pdf';
			cancels.get(slot)?.();
			if (!allowed.includes(file.type)) {
				mark(
					slot,
					'error',
					`${file.name} is a ${extensionLabel(file)} file. ${pdfOnly ? 'This one needs to be a PDF.' : 'Send a PDF, JPG or PNG.'}`,
				);
				return;
			}
			if (file.size > BYTE_CAP) {
				mark(
					slot,
					'error',
					`${file.name} is ${readableSize(file.size)}. The limit is 10 MB; a scan at 150 dpi is plenty.`,
				);
				return;
			}
			const fileLine = pick('[data-slot-file]', slot);
			fileLine.textContent = '';
			fileLine.append(glyph(glyphForType(file)), `${file.name}, ${readableSize(file.size)}`);
			mark(slot, 'busy');
			const fill = pick('[data-slot-bar] span', slot);
			cancels.set(
				slot,
				fakeTransfer(
					file.size,
					(percent) => {
						fill.style.width = `${percent}%`;
					},
					() => {
						cancels.delete(slot);
						mark(slot, 'done');
						if (!summary.hidden) check(false);
					},
				),
			);
		}

		/** Puts one slot into a state and redraws everything that state touches. */
		function mark(slot, state, reason) {
			const look = LOOKS[state](slot.hasAttribute('data-optional'));
			const pill = pick('[data-slot-status]', slot);
			const fileLine = pick('[data-slot-file]', slot);
			const note = pick('[data-slot-error]', slot);
			const field = pick('input[type="file"]', slot);

			slot.dataset.state = state;
			slot.classList.remove('is-flagged');
			pill.className = look.tone ? `upload-pill ${look.tone}` : 'upload-pill';
			pill.textContent = look.words;
			if (look.hideFile !== undefined) fileLine.hidden = look.hideFile;
			pick('[data-slot-bar]', slot).hidden = state !== 'busy';
			note.hidden = state !== 'error';
			if (state === 'error') {
				note.textContent = reason;
				field.setAttribute('aria-invalid', 'true');
			} else {
				field.removeAttribute('aria-invalid');
			}
			pick('[data-slot-remove]', slot).hidden = state !== 'done';
			pick('[data-slot-pick-text]', slot).textContent = state === 'done' ? 'Replace' : 'Choose file';
			refreshCount();
		}

		function refreshCount() {
			const required = needed();
			const ready = required.filter((slot) => slot.dataset.state === 'done').length;
			pick('[data-doc-tally]', form).textContent = `${ready} of ${required.length} ready`;
			pick('[data-docs-fill]', form).style.width = `${required.length ? (ready / required.length) * 100 : 0}%`;
		}

		/**
		 * Flags every needed slot without a finished file and lists them in the
		 * summary, with links that jump to each one. True when nothing is missing.
		 */
		function check(moveFocus) {
			const missing = needed().filter((slot) => slot.dataset.state !== 'done');
			const links = pick('[data-docs-summary-list]', form);
			links.textContent = '';
			for (const slot of slots) slot.classList.remove('is-flagged');
			if (!missing.length) {
				summary.hidden = true;
				return true;
			}
			pick('[data-docs-summary-title]', form).textContent =
				`${MISSING_WORDS[missing.length] || `${missing.length} documents are`} still missing`;
			for (const slot of missing) {
				const field = pick('input[type="file"]', slot);
				const refused = slot.dataset.state === 'error' ? ': the file was not accepted' : '';
				const jump = make('a', null, `${pick('.upload-slot-title', slot).textContent}${refused}`);
				const item = make('li');
				slot.classList.add('is-flagged');
				jump.href = `#${field.id}`;
				jump.addEventListener('click', (event) => {
					event.preventDefault();
					slot.scrollIntoView({ block: 'center', behavior: calmMotion ? 'auto' : 'smooth' });
					field.focus({ preventScroll: true });
				});
				item.appendChild(jump);
				links.appendChild(item);
			}
			summary.hidden = false;
			if (moveFocus) summary.focus();
			return false;
		}
	}

	/* 6. Damage claim: a required field that checks type, size and count. */

	function setUpClaim(form) {
		if (!form) return;
		const limit = Number.parseInt(form.dataset.max, 10);
		const byteCap = Number.parseFloat(form.dataset.maxMb) * MEGABYTE;
		const accepted = ['image/jpeg', 'image/png', 'application/pdf'];
		const field = pick('[data-claim-input]', form);
		const kept = pick('[data-claim-list]', form);
		const refusals = pick('[data-claim-rejects]', form);
		const problem = pick('[data-claim-error]', form);
		const summary = pick('[data-claim-summary]', form);
		const finished = pick('[data-claim-done]', form);

		whenFilesArrive(field, admit);
		pick('[data-claim-big]', form).addEventListener('click', () =>
			admit([blankFile('torn-seam-close-up.jpg', 'image/jpeg', 6 * MEGABYTE)]),
		);
		pick('[data-claim-heic]', form).addEventListener('click', () =>
			admit([blankFile('IMG_4471.HEIC', 'image/heic', 900 * 1024)]),
		);
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const count = rows().length;
			if (!count) {
				problem.hidden = false;
				field.setAttribute('aria-invalid', 'true');
				summary.hidden = false;
				summary.focus();
				return;
			}
			pick('[data-claim-done-text]', form).textContent =
				`${count === 1 ? 'One file' : `${count} files`} passed the type, size and count checks.`;
			finished.hidden = false;
			pick('.upload-actions', form).hidden = true;
			pick('[data-claim-reset]', form).focus();
		});
		pick('[data-claim-reset]', form).addEventListener('click', () => {
			kept.textContent = '';
			refusals.textContent = '';
			finished.hidden = true;
			pick('.upload-actions', form).hidden = false;
			field.focus();
		});

		function rows() {
			return pickAll('li', kept);
		}

		/** The reason a file is turned away, or null when it may stay. */
		function refusal(file, space) {
			if (!accepted.includes(file.type)) {
				if (/heic|heif/i.test(file.type + file.name)) {
					return 'HEIC photos are not accepted. On an iPhone, set Camera, Formats to Most Compatible, or send a screenshot.';
				}
				return `${extensionLabel(file)} files are not accepted. Send a JPG, PNG or PDF.`;
			}
			if (file.size > byteCap)
				return `At ${readableSize(file.size)} it is over the 2 MB limit. Try a screenshot of the photo instead.`;
			return space > 0 ? null : 'This field takes three photos at most.';
		}

		function admit(files) {
			refusals.textContent = '';
			let space = limit - rows().length;
			for (const file of files) {
				const reason = refusal(file, space);
				if (reason) {
					refusals.appendChild(refusalRow(file, reason));
					continue;
				}
				space -= 1;
				kept.appendChild(claimRow(file));
			}
			if (!rows().length) return;
			problem.hidden = true;
			field.removeAttribute('aria-invalid');
			summary.hidden = true;
		}

		function claimRow(file) {
			const row = make('li');
			const drop = make('button', 'btn btn-sm upload-slot-remove');
			let preview;
			if (file.type.startsWith('image/')) {
				preview = make('img', 'upload-files-thumb');
				preview.alt = '';
				preview.src = URL.createObjectURL(file);
			} else {
				preview = make('span', 'upload-files-thumb');
				preview.appendChild(glyph(glyphForType(file)));
			}
			drop.type = 'button';
			drop.append(glyph('bi-x-lg'), make('span', 'visually-hidden', `Remove ${file.name}`));
			drop.addEventListener('click', () => {
				const neighbor = row.nextElementSibling || row.previousElementSibling;
				if (preview.src) URL.revokeObjectURL(preview.src);
				row.remove();
				(neighbor ? pick('button', neighbor) : field).focus();
			});
			row.append(
				preview,
				make('span', 'upload-files-name', file.name),
				make('span', 'upload-files-size', readableSize(file.size)),
				drop,
			);
			return row;
		}
	}

	/* 7. Large video: sent piece by piece, with pause, a dropped line and resume. */

	function setUpChunks(host) {
		if (!host) return;
		const grid = pick('[data-chk-map]', host);
		const pieceInput = pick('[data-chk-size]', host);
		const go = pick('[data-chk-start]', host);
		const goLabel = pick('[data-chk-start-text]', host);
		const cutLine = pick('[data-chk-drop]', host);
		const abort = pick('[data-chk-cancel]', host);
		const announcer = pick('[data-chk-status]', host);
		const meter = pick('[data-chk-progress]', host);
		const field = pick('[data-chk-input]', host);
		const speedLine = pick('[data-chk-speed]', host);
		const stepperControls = pickAll('button, input', pieceInput.closest('[data-basalt-stepper]'));
		/* The map never draws more squares than this; each one may stand for several pieces. */
		const MAX_SQUARES = 60;
		/* The make-believe line speed, per second. */
		const BANDWIDTH = 16 * MEGABYTE;
		const job = { bytes: 480 * MEGABYTE, pieces: 0, sent: 0, sending: false, offline: false, timer: 0 };

		go.addEventListener('click', () => {
			if (job.sending) {
				halt();
				goLabel.textContent = 'Resume';
				announcer.textContent = `Paused at piece ${job.sent + 1} of ${job.pieces}. Nothing already sent is lost.`;
				speedLine.textContent = 'Paused';
				draw();
			} else if (!job.offline) {
				send();
			}
		});
		cutLine.addEventListener('click', loseConnection);
		abort.addEventListener('click', () => {
			job.offline = false;
			rewind();
			say('Canceled. The pieces already sent have been thrown away.');
			go.focus();
		});
		pieceInput.addEventListener('change', () => {
			countPieces();
			layOutSquares();
			draw();
		});
		whenFilesArrive(field, ([file]) => {
			if (!file) return;
			job.offline = false;
			job.bytes = Math.max(file.size, 1);
			pick('[data-chk-name]', host).textContent = file.name;
			pick('[data-chk-meta]', host).textContent = readableSize(file.size);
			rewind();
			say('Ready when you are.');
		});
		rewind();

		function say(text, trouble = false) {
			announcer.classList.toggle('is-bad', trouble);
			announcer.textContent = text;
		}

		function lockStepper(locked) {
			for (const control of stepperControls) control.disabled = locked;
		}

		function countPieces() {
			const pieceMegabytes = Number(pieceInput.value) || 10;
			job.pieces = Math.ceil(job.bytes / (pieceMegabytes * MEGABYTE));
			pick('[data-chk-pieces]', host).textContent =
				`${job.pieces}${job.pieces === 1 ? ' piece' : ' pieces'} of ${pieceMegabytes} MB`;
		}

		function layOutSquares() {
			grid.textContent = '';
			const squares = Math.min(MAX_SQUARES, job.pieces);
			for (let made = 0; made < squares; made += 1) grid.appendChild(make('span'));
		}

		/**
		 * Colors each square by the pieces it covers, then updates the percent,
		 * bytes sent and time left. brokenAt marks the piece that failed.
		 */
		function draw(brokenAt) {
			const { pieces, sent, bytes } = job;
			const squares = [...grid.children];
			for (const [index, square] of squares.entries()) {
				const first = Math.floor((index / squares.length) * pieces);
				const last = Math.floor(((index + 1) / squares.length) * pieces);
				const covers = (piece) => piece >= first && piece < last;
				if (sent >= last) square.className = 'is-done';
				else if (brokenAt != null && covers(brokenAt)) square.className = 'is-failed';
				else if (job.sending && covers(sent)) square.className = 'is-sending';
				else square.className = '';
			}
			const bytesSent = Math.min(bytes, (sent / pieces) * bytes);
			const percent = Math.floor((sent / pieces) * 100);
			const secondsLeft = (bytes - bytesSent) / BANDWIDTH;
			pick('[data-chk-pct]', host).textContent = percent;
			meter.firstElementChild.style.width = `${percent}%`;
			meter.setAttribute('aria-valuenow', percent);
			pick('[data-chk-sent]', host).textContent = `${readableSize(bytesSent)} of ${readableSize(bytes)}`;
			pick('[data-chk-eta]', host).textContent =
				sent >= pieces
					? 'Done'
					: secondsLeft < 60
						? `About ${Math.max(1, Math.round(secondsLeft))} s`
						: `About ${Math.round(secondsLeft / 60)} min`;
		}

		/** Back to piece one with the controls unlocked, as on first load. */
		function rewind() {
			halt();
			job.sent = 0;
			countPieces();
			layOutSquares();
			draw();
			speedLine.textContent = 'Not started';
			goLabel.textContent = 'Start upload';
			go.disabled = false;
			abort.disabled = true;
			lockStepper(false);
			pieceInput.dispatchEvent(new Event('blur'));
		}

		function halt() {
			job.sending = false;
			clearTimeout(job.timer);
			cutLine.disabled = true;
		}

		function send() {
			if (job.sent >= job.pieces) job.sent = 0;
			job.sending = true;
			job.offline = false;
			say(
				job.sent ? `Carrying on from piece ${job.sent + 1} of ${job.pieces}.` : `Sending ${job.pieces} pieces.`,
			);
			goLabel.textContent = 'Pause';
			cutLine.disabled = false;
			abort.disabled = false;
			lockStepper(true);
			draw();
			sendNext();
		}

		/** Sends one piece at a jittery speed and books the next until all are in. */
		function sendNext() {
			if (!job.sending) return;
			const rate = BANDWIDTH * (0.8 + Math.random() * 0.4);
			speedLine.textContent = `${readableSize(rate)}/s`;
			job.sent += 1;
			draw();
			if (job.sent >= job.pieces) {
				halt();
				goLabel.textContent = 'Upload again';
				abort.disabled = true;
				say('Uploaded. The video is being prepared for playback and will be ready in a few minutes.');
				speedLine.textContent = 'Finished';
				return;
			}
			/* Real time per piece, so the default file takes about half a minute. */
			const pause = calmMotion ? 20 : Math.max(40, (job.bytes / job.pieces / rate) * 1000);
			job.timer = setTimeout(sendNext, pause);
		}

		/** Fakes a dropped line, counts down three seconds and picks up where it stopped. */
		function loseConnection() {
			if (!job.sending) return;
			halt();
			job.offline = true;
			go.disabled = true;
			const failedPiece = job.sent;
			let secondsLeft = 3;
			draw(failedPiece);
			say(`Connection lost during piece ${failedPiece + 1}. Trying again in 3 seconds.`, true);
			speedLine.textContent = 'Offline';
			job.timer = setTimeout(countDown, calmMotion ? 50 : 1000);

			function countDown() {
				secondsLeft -= 1;
				if (!job.offline) return;
				if (secondsLeft === 0) {
					go.disabled = false;
					send();
					return;
				}
				announcer.textContent = `Connection lost during piece ${failedPiece + 1}. Trying again in ${secondsLeft}${secondsLeft === 1 ? ' second.' : ' seconds.'}`;
				job.timer = setTimeout(countDown, calmMotion ? 50 : 1000);
			}
		}
	}

	/* 8. Product import: a CSV, matched to fields, checked row by row. */

	function setUpImport(host) {
		if (!host) return;
		const panels = pickAll('[data-csv-panel]', host);
		const steps = pickAll('[data-csv-steps] li', host);
		const field = pick('[data-csv-input]', host);
		const problem = pick('[data-csv-error]', host);
		const table = pick('[data-csv-table]', host);
		const matchers = pick('[data-csv-map]', host);
		const skipFlawed = pick('[data-csv-skip]', host);
		const importButton = pick('[data-csv-import]', host);
		const footnote = pick('[data-csv-note]', host);
		const sheet = { name: '', header: [], records: [], columnOf: {} };

		whenFilesArrive(field, ([file]) => read(file));
		pick('[data-csv-sample]', host).addEventListener('click', () =>
			read(new File([CATALOG_CSV], 'store-catalog.csv', { type: 'text/csv' })),
		);
		skipFlawed.addEventListener('change', preview);
		pick('[data-csv-restart]', host).addEventListener('click', backToStart);
		pick('[data-csv-again]', host).addEventListener('click', backToStart);
		importButton.addEventListener('click', runImport);

		function backToStart() {
			showStep(1);
			field.focus();
		}

		function showStep(number) {
			for (const panel of panels) panel.hidden = panel.dataset.csvPanel !== String(number);
			for (const [index, step] of steps.entries()) {
				const here = index === number - 1;
				step.classList.toggle('is-current', here);
				step.classList.toggle('is-done', index < number - 1);
				if (here) step.setAttribute('aria-current', 'step');
				else step.removeAttribute('aria-current');
			}
		}

		function refuse(text) {
			problem.textContent = text;
			problem.hidden = false;
			field.setAttribute('aria-invalid', 'true');
		}

		async function read(file) {
			if (!file) return;
			if (file.type !== 'text/csv' && !/\.csv$/i.test(file.name)) {
				refuse(
					`${file.name} is not a CSV file. In your spreadsheet, choose File, then Download or Export as CSV.`,
				);
				return;
			}
			const lines = splitCsv(await file.text());
			if (lines.length < 2) {
				refuse(`${file.name} has no rows under the column names.`);
				return;
			}
			problem.hidden = true;
			field.removeAttribute('aria-invalid');
			const header = lines[0].map((title) => title.trim());
			Object.assign(sheet, {
				name: file.name,
				header,
				/* At most 500 rows, each padded or cut to the header's width. */
				records: lines.slice(1, 501).map((line) => header.map((_, at) => (line[at] || '').trim())),
				columnOf: Object.fromEntries(IMPORT_COLUMNS.map((column) => [column.key, guessColumn(header, column)])),
			});
			buildMatchers();
			preview();
			showStep(2);
			pick('[data-csv-restart]', host).focus();
		}

		function guessColumn(header, column) {
			return header.findIndex((title) => column.words.some((word) => title.toLowerCase().includes(word)));
		}

		/** One select per field, listing every column plus a way to leave it out. */
		function buildMatchers() {
			matchers.textContent = '';
			for (const column of IMPORT_COLUMNS) {
				const box = make('div');
				const selectId = `csv-map-${column.key}`;
				const caption = make('label', 'form-label', column.label);
				const select = make('select', 'form-select form-select-sm');
				const skip = make('option', null, 'Leave out');
				caption.htmlFor = selectId;
				select.id = selectId;
				skip.value = '-1';
				select.appendChild(skip);
				for (const [at, title] of sheet.header.entries()) {
					const option = make('option', null, title || `Column ${at + 1}`);
					option.value = String(at);
					select.appendChild(option);
				}
				select.value = String(sheet.columnOf[column.key]);
				select.addEventListener('change', () => {
					sheet.columnOf[column.key] = Number.parseInt(select.value, 10);
					preview();
				});
				box.append(caption, select);
				matchers.appendChild(box);
			}
		}

		/** Fields a record fails: a bad value where mapped, and name or SKU when unmapped. */
		function faultsIn(record) {
			return IMPORT_COLUMNS.filter((column) => {
				const at = sheet.columnOf[column.key];
				if (at >= 0) return !column.check(record[at]);
				return column.key === 'name' || column.key === 'sku';
			});
		}

		/** Redraws the preview table and the tallies, import button and note under it. */
		function preview() {
			const { header, records } = sheet;
			const skipping = skipFlawed.checked;
			const fieldAt = {};
			const notes = [];
			let clean = 0;
			let flawed = 0;

			pick('[data-csv-name]', host).textContent = sheet.name;
			pick('[data-csv-meta]', host).textContent = `${records.length} rows, ${header.length} columns`;
			table.tHead.textContent = '';
			table.tBodies[0].textContent = '';
			for (const column of IMPORT_COLUMNS) {
				const at = sheet.columnOf[column.key];
				if (at >= 0) fieldAt[at] = column;
			}

			const headRow = make('tr');
			headRow.appendChild(headCell(null, 'Row'));
			for (const [at, title] of header.entries()) {
				const column = fieldAt[at];
				headRow.appendChild(
					column ? headCell('is-mapped', column.label) : headCell(null, `${title} (left out)`),
				);
			}
			table.tHead.appendChild(headRow);

			for (const [index, record] of records.entries()) {
				const faults = faultsIn(record);
				const row = make('tr');
				const lineNumber = index + 2;
				if (faults.length) {
					flawed += 1;
					notes.push(`row ${lineNumber} ${faults.map((column) => column.problem).join(' and ')}`);
					if (skipping) row.classList.add('is-skipped');
				} else {
					clean += 1;
				}
				row.appendChild(make('td', 'upload-table-row', String(lineNumber)));
				for (const [at, value] of record.entries()) row.appendChild(bodyCell(value, fieldAt[at], faults));
				table.tBodies[0].appendChild(row);
			}

			const going = skipping ? clean : records.length;
			const flawedPill = pick('[data-csv-bad]', host);
			pick('[data-csv-ok]', host).textContent = `${clean} ready`;
			flawedPill.textContent = `${flawed}${flawed === 1 ? ' needs a look' : ' need a look'}`;
			flawedPill.hidden = !flawed;
			importButton.textContent = `Import ${going}${going === 1 ? ' product' : ' products'}`;
			importButton.disabled = !going;
			footnote.textContent =
				flawed && !skipping
					? 'Rows that need a look come in with the gaps left blank.'
					: 'They arrive as drafts, so nothing goes live yet.';
			Object.assign(host.dataset, { notes: notes.join('; '), count: going, skipped: skipping ? flawed : 0 });
		}

		function headCell(className, text) {
			const cell = make('th', className, text);
			cell.scope = 'col';
			return cell;
		}

		function bodyCell(value, column, faults) {
			const faulty = Boolean(column) && faults.includes(column);
			const cell = make('td', faulty ? 'is-bad' : null);
			if (!faulty) {
				cell.textContent = value;
				return cell;
			}
			cell.append(
				glyph('bi-exclamation-circle me-1'),
				value || 'Empty',
				make('span', 'visually-hidden', `, ${column.problem}`),
			);
			return cell;
		}

		/** Step three: a progress bar while the rows "upload", then the outcome. */
		function runImport() {
			showStep(3);
			const working = pick('[data-csv-run]', host);
			const outcome = pick('[data-csv-done]', host);
			const bar = pick('[data-csv-progress]', host);
			const total = Number(host.dataset.count);
			const skipped = Number(host.dataset.skipped);
			working.hidden = false;
			outcome.hidden = true;
			fakeTransfer(
				total * 90000,
				(percent) => {
					bar.firstElementChild.style.width = `${percent}%`;
					bar.setAttribute('aria-valuenow', Math.round(percent));
					pick('[data-csv-run-label]', host).textContent =
						`Adding products, ${Math.min(total, Math.round((percent / 100) * total))} of ${total}`;
				},
				() => {
					working.hidden = true;
					outcome.hidden = false;
					pick('[data-csv-done-title]', host).textContent =
						`${total}${total === 1 ? ' product' : ' products'} added as drafts`;
					pick('[data-csv-done-text]', host).textContent = skipped
						? `${skipped}${skipped === 1 ? ' row was' : ' rows were'} skipped: ${host.dataset.notes}.`
						: 'Open Products to check them over and publish.';
					pick('[data-csv-again]', host).focus();
				},
			);
		}
	}

	/**
	 * Reads CSV text into rows of cells. Quotes may wrap commas and line breaks,
	 * a doubled quote inside them is a literal one, and blank lines are dropped.
	 */
	function splitCsv(source) {
		const table = [];
		let record = [];
		let cell = '';
		let quoted = false;
		let at = 0;

		while (at < source.length) {
			const char = source[at];
			const next = source[at + 1];
			at += 1;
			if (quoted) {
				if (char !== '"') cell += char;
				else if (next === '"') {
					cell += '"';
					at += 1;
				} else quoted = false;
			} else if (char === '"') {
				quoted = true;
			} else if (char === ',') {
				endCell();
			} else if (char === '\n' || char === '\r') {
				if (char === '\r' && next === '\n') at += 1;
				endRecord();
			} else {
				cell += char;
			}
		}
		endRecord();
		return table;

		function endCell() {
			record.push(cell);
			cell = '';
		}

		function endRecord() {
			endCell();
			if (record.some(Boolean)) table.push(record);
			record = [];
		}
	}

	function looksLikeMoney(cell) {
		return /^\$?\d+(\.\d{1,2})?$/.test(cell.trim());
	}

	/* 9. Plain inputs: the required one turns valid as soon as it holds a file. */

	function setUpNativeRequired() {
		for (const field of pickAll('[data-nat-required]')) {
			const hint = document.getElementById(field.getAttribute('aria-describedby'));
			field.addEventListener('change', () => {
				const filled = field.files.length > 0;
				field.classList.toggle('is-invalid', !filled);
				field.classList.toggle('is-valid', filled);
				field.setAttribute('aria-invalid', String(!filled));
				hint.hidden = filled;
			});
		}
	}

	/* The chips above the grid show one kind of field at a time. */

	function setUpKindFilter() {
		const grid = pick('[data-upload-grid]');
		const cards = pickAll('.upload-card', grid);
		const chips = pickAll('[data-upload-filter]');
		const tally = pick('[data-upload-count]');

		for (const chip of chips) {
			chip.addEventListener('click', () => {
				const kind = chip.dataset.uploadFilter;
				const everything = kind === 'all';
				let visible = 0;
				for (const other of chips) other.setAttribute('aria-pressed', String(other === chip));
				for (const card of cards) {
					const match = everything || card.dataset.uploadKind === kind;
					card.classList.toggle('is-hidden', !match);
					if (match) visible += 1;
				}
				grid.classList.toggle('is-filtered', !everything);
				tally.textContent = `${visible}${visible === 1 ? ' field' : ' fields'}`;
			});
		}
	}

	/* Small builders and readers. */

	function pick(selector, scope = pageRoot) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = pageRoot) {
		return [...scope.querySelectorAll(selector)];
	}

	/** An element with an optional class list and text; null skips either. */
	function make(tag, className, text) {
		const node = document.createElement(tag);
		if (className) node.className = className;
		if (text != null) node.textContent = text;
		return node;
	}

	function glyph(name) {
		const mark = make('i', `bi ${name}`);
		mark.setAttribute('aria-hidden', 'true');
		return mark;
	}

	/** A refused file for the lists under a field: its name in bold, then why. */
	function refusalRow(file, reason) {
		const row = make('li');
		const words = make('span');
		words.append(make('strong', null, file.name), ' ', reason);
		row.append(glyph('bi-x-circle'), words);
		return row;
	}

	/** Shows or clears a field's error line and keeps aria-invalid in step with it. */
	function report(line, field, text) {
		line.textContent = text;
		line.hidden = !text;
		if (text) field.setAttribute('aria-invalid', 'true');
		else field.removeAttribute('aria-invalid');
	}

	function readableSize(bytes) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < MEGABYTE) return `${Math.round(bytes / 1024)} KB`;
		const megabytes = bytes / MEGABYTE;
		return `${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} MB`;
	}

	/** The upper-case extension for messages, or a stand-in when the name has none. */
	function extensionLabel(file) {
		const match = file.name.match(/\.([a-z0-9]+)$/i);
		return match ? match[1].toUpperCase() : 'This kind of';
	}

	function glyphForType(file) {
		const hit = TYPE_GLYPHS.find(([test]) => test(file.type));
		return hit ? hit[1] : 'bi-file-earmark';
	}

	function themeColor(name) {
		return getComputedStyle(pageRoot).getPropertyValue(name).trim() || '#888';
	}

	function blankFile(name, type, bytes) {
		return new File([new Uint8Array(bytes)], name, { type });
	}

	/** Resolves with the decoded picture and the object URL it was read from. */
	function openImage(file) {
		return new Promise((resolve, reject) => {
			const address = URL.createObjectURL(file);
			const picture = new Image();
			picture.onload = () => resolve({ picture, address });
			picture.onerror = () => {
				URL.revokeObjectURL(address);
				reject(new Error('unreadable'));
			};
			picture.src = address;
		});
	}

	/* Sample artwork, so the demos run without a folder of photos. */

	/** A drawn JPEG named like a real photo, for the "try it" buttons. */
	function samplePhoto(kind, name, width, height) {
		return new Promise((resolve) => {
			paintSample(kind, width, height).toBlob(
				(blob) => resolve(new File([blob], name, { type: 'image/jpeg' })),
				'image/jpeg',
				0.85,
			);
		});
	}

	/**
	 * Each sample: the two chart colors (1 to 6) of its backdrop gradient, and a
	 * scene drawn over it in the page color at 92% opacity.
	 */
	function sampleArt(kind) {
		const scenes = {
			/* A folded blazer from above: the body, then the front panel. */
			fold: [
				[1, 2],
				(pen, w, h, ramp) => {
					fillPath(pen, () => pen.roundRect(w * 0.16, h * 0.26, w * 0.68, h * 0.48, w * 0.05));
					pen.globalAlpha = 1;
					pen.fillStyle = ramp[0];
					pen.fillRect(w * 0.22, h * 0.32, w * 0.56, h * 0.36);
				},
			],
			/* Four folded shirts upright on a shelf. */
			stack: [
				[5, 6],
				(pen, w, h) => {
					fillPath(pen, () => pen.roundRect(w * 0.12, h * 0.6, w * 0.76, h * 0.14, w * 0.03));
					for (let shirt = 0; shirt < 4; shirt += 1) {
						fillPath(pen, () =>
							pen.roundRect(w * (0.16 + shirt * 0.18), h * 0.3, w * 0.14, h * 0.32, w * 0.02),
						);
					}
				},
			],
			/* A display stand: round foot, pole, and a piece on top. */
			stand: [
				[3, 1],
				(pen, w, h, ramp) => {
					fillPath(pen, () => pen.ellipse(w / 2, h * 0.8, w * 0.2, h * 0.07, 0, 0, Math.PI * 2));
					pen.fillRect(w * 0.47, h * 0.5, w * 0.06, h * 0.3);
					fillPath(pen, () => pen.roundRect(w * 0.24, h * 0.2, w * 0.52, h * 0.34, w * 0.04));
					pen.globalAlpha = 1;
					pen.fillStyle = ramp[1];
					pen.fillRect(w * 0.29, h * 0.25, w * 0.42, h * 0.24);
				},
			],
			/* A map pin that stands in for a logo. */
			pin: [
				[3, 4],
				(pen, w, h, ramp) => {
					fillPath(pen, () => {
						pen.arc(w / 2, h * 0.4, w * 0.2, Math.PI * 0.85, Math.PI * 2.15);
						pen.lineTo(w / 2, h * 0.82);
						pen.closePath();
					});
					pen.globalAlpha = 1;
					pen.fillStyle = ramp[0];
					fillPath(pen, () => pen.arc(w / 2, h * 0.4, w * 0.08, 0, Math.PI * 2));
				},
			],
			/* Head and shoulders, for the avatar. */
			face: [[4, 2], drawBust],
		};
		return scenes[kind] || [[1, 2], drawBust];

		function drawBust(pen, w, h) {
			fillPath(pen, () => pen.arc(w / 2, h * 0.42, w * 0.17, 0, Math.PI * 2));
			fillPath(pen, () => pen.ellipse(w / 2, h * 0.95, w * 0.34, h * 0.3, 0, 0, Math.PI * 2));
		}
	}

	function fillPath(pen, trace) {
		pen.beginPath();
		trace();
		pen.fill();
	}

	function paintSample(kind, width, height) {
		const canvas = document.createElement('canvas');
		const [stops, drawScene] = sampleArt(kind);
		const ramp = stops.map((slot) => themeColor(`--basalt-series-${slot}`));
		canvas.width = width;
		canvas.height = height;
		const pen = canvas.getContext('2d');
		const sweep = pen.createLinearGradient(0, 0, width, height);
		sweep.addColorStop(0, ramp[0]);
		sweep.addColorStop(1, ramp[1]);
		pen.fillStyle = sweep;
		pen.fillRect(0, 0, width, height);
		pen.fillStyle = themeColor('--basalt-plane');
		pen.globalAlpha = 0.92;
		drawScene(pen, width, height, ramp);
		pen.globalAlpha = 1;
		return canvas;
	}
})();
