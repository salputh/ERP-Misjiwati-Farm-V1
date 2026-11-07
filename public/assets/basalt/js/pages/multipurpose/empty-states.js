/**
 * Empty states (empty-states.html).
 *
 * Drives the showcase page only: the chips that filter the grid, the copy
 * buttons on the snippets, and the small pretend flows behind each demo
 * (searching, importing a file, retrying a failed load, going offline,
 * asking for access, adding notes). The empty state components themselves,
 * reached through window.Basalt.empty, are part of basalt.js.
 */
(() => {
	'use strict';

	const COPY_RESET_MS = 1800;
	const IMPORT_TICK_MS = 120;
	const RETRY_WAIT_MS = 1100;
	const ACCESS_WAIT_MS = 1000;
	const SAMPLE_FILE = 'price-list-sample.csv';
	const CATEGORY_NOUNS = {
		all: ['product', 'products'],
		devices: ['garment', 'garments'],
		accessories: ['accessory', 'accessories'],
		addons: ['extra', 'extras'],
	};

	/* The hooks each demo reads, by the role each element plays. */
	const PARTS = {
		search: {
			box: '[data-es-q]',
			tally: '[data-es-q-count]',
			results: '[data-es-results]',
			nothing: '[data-es-empty]',
			nothingTitle: '[data-es-empty-title]',
			nothingText: '[data-es-empty-text]',
			widenButton: '[data-es-widen]',
			clearButton: '[data-es-clear]',
		},
		importing: {
			meter: '[data-es-import-bar]',
			status: '[data-es-import-state]',
			fileName: '[data-es-file]',
			imported: '[data-es-import-list]',
			undoButton: '[data-es-undo-import]',
		},
		offline: {
			queueNote: '[data-basalt-offline-status]',
			heading: '[data-es-online-msg]',
			queueButton: '[data-es-queue]',
		},
		access: {
			askButton: '[data-es-access-ask]',
			askLabel: '[data-es-access-label]',
			cancelButton: '[data-es-access-cancel]',
			heading: '[data-es-access-title]',
			body: '[data-es-access-text]',
			announcer: '[data-es-access-live]',
		},
		notes: {
			nothingYet: '[data-es-notes-empty]',
			composer: '[data-es-notes-form]',
			notes: '[data-es-notes-list]',
			addButton: '[data-es-notes-add]',
			cancelButton: '[data-es-notes-cancel]',
		},
	};

	let showcase;

	/**
	 * Finds the page, lets basalt.js wire the empty states, then sets up each
	 * demo in the order it appears on the page.
	 */
	function start() {
		showcase = pick('[data-es-root]', document);
		if (!showcase) return;
		window.Basalt.empty?.init(showcase);

		wireFilterChips();
		wireCopyButtons();
		wireSearchDemo();
		wireImportDemo();
		wireChecklistDemo();
		wireRetryDemo();
		wireOfflineDemo();
		wireSamplesDemo();
		wireAccessDemo();
		wireNotesDemo();
		openMenuDemo();
	}

	/* Lookups scoped to the page, event wiring, and a couple of wording helpers. */

	function pick(selector, scope = showcase) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = showcase) {
		return [...scope.querySelectorAll(selector)];
	}

	function partsOf(scope, selectors) {
		const hits = {};
		for (const [role, selector] of Object.entries(selectors)) hits[role] = pick(selector, scope);
		return hits;
	}

	function on(target, type, handler) {
		target.addEventListener(type, handler);
	}

	function reveal(...elements) {
		for (const element of elements) element.toggleAttribute('hidden', false);
	}

	function conceal(...elements) {
		for (const element of elements) element.toggleAttribute('hidden', true);
	}

	function countOf(amount, singular, pluralForm) {
		return `${amount} ${amount === 1 ? singular : pluralForm}`;
	}

	function motionIsReduced() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function pressOnly(buttons, chosen) {
		for (const button of buttons) button.setAttribute('aria-pressed', String(button === chosen));
	}

	function markNew(listElement) {
		for (const row of pickAll('li', listElement)) row.classList.add('is-new');
	}

	/*
	 * Filter chips. Each card lists the families it belongs to; a chip shows
	 * the cards in its family. Half-width cards pair up between the full-width
	 * ones, and an odd card at the end of a run takes the whole row.
	 */

	function wireFilterChips() {
		const cardGrid = pick('[data-es-grid]');
		if (!cardGrid) return;
		const tally = pick('[data-es-count]');
		const showcaseCards = pickAll('.es-card', cardGrid);
		const choices = pickAll('[data-es-filter]');

		const showGroup = (group) => {
			const kept = showcaseCards.filter((card) => {
				const families = (card.getAttribute('data-es-groups') || '').split(/\s+/);
				const shown = group === 'all' || families.includes(group);
				card.classList.toggle('is-hidden', !shown);
				card.classList.remove('is-alone');
				return shown;
			});
			let run = [];
			const endRun = () => {
				if (run.length % 2) run[run.length - 1].classList.add('is-alone');
				run = [];
			};
			for (const card of kept) {
				if (card.classList.contains('es-card-full')) endRun();
				else run.push(card);
			}
			endRun();
			if (tally) tally.textContent = countOf(kept.length, 'empty state type', 'empty state types');
		};

		for (const choice of choices) {
			on(choice, 'click', () => {
				pressOnly(choices, choice);
				showGroup(choice.getAttribute('data-es-filter'));
			});
		}
		showGroup('all');
	}

	/* Copy buttons: copy the snippet beside them and say so for a moment. */

	function wireCopyButtons() {
		const resets = new Map();
		for (const button of pickAll('[data-es-copy]')) {
			on(button, 'click', () => {
				const codeBlock = pick('pre', button.parentElement);
				if (!codeBlock) return;
				window.Basalt.copyText(codeBlock.textContent.trim()).then(() => {
					const glyph = pick('.bi', button);
					button.lastChild.textContent = ' Copied';
					if (glyph) glyph.className = 'bi bi-check2';
					clearTimeout(resets.get(button));
					resets.set(
						button,
						setTimeout(() => {
							button.lastChild.textContent = ' Copy';
							if (glyph) glyph.className = 'bi bi-clipboard';
						}, COPY_RESET_MS),
					);
				});
			});
		}
	}

	/*
	 * No results demo: a search box over a short product list with category
	 * chips. When nothing matches, the empty state says what was searched,
	 * points to matches in other categories, or suggests a close spelling.
	 */

	function editDistance(a, b) {
		const table = Array.from({ length: a.length + 1 }, (_, row) => [row]);
		for (let column = 1; column <= b.length; column++) table[0][column] = column;
		for (let row = 1; row <= a.length; row++) {
			for (let column = 1; column <= b.length; column++) {
				const swap = a[row - 1] === b[column - 1] ? 0 : 1;
				table[row][column] = Math.min(
					table[row - 1][column] + 1,
					table[row][column - 1] + 1,
					table[row - 1][column - 1] + swap,
				);
			}
		}
		return table[a.length][b.length];
	}

	function capitalized(word) {
		return word.replace(/^./, (first) => first.toUpperCase());
	}

	function wireSearchDemo() {
		const demo = pick('[data-es-search]');
		if (!demo) return;
		const { box, tally, results, nothing, nothingTitle, nothingText, widenButton, clearButton } = partsOf(
			demo,
			PARTS.search,
		);
		const categoryChips = pickAll('[data-es-cat]', demo);
		const catalog = pickAll('[data-es-item]', demo).map((row) => {
			const nameNode = pick('.es-results-name', row);
			return { row, nameNode, name: nameNode.textContent.trim(), category: row.getAttribute('data-cat') };
		});
		const vocabulary = [...new Set(catalog.flatMap((entry) => entry.name.toLowerCase().split(/\s+/)))];
		let category = 'devices';

		const fits = (entry, needle) => !needle || entry.name.toLowerCase().includes(needle);

		const highlightIn = (entry, needle) => {
			entry.nameNode.textContent = entry.name;
			if (!needle) return;
			const at = entry.name.toLowerCase().indexOf(needle);
			if (at < 0) return;
			const hit = document.createElement('mark');
			hit.textContent = entry.name.slice(at, at + needle.length);
			entry.nameNode.textContent = '';
			entry.nameNode.append(entry.name.slice(0, at), hit, entry.name.slice(at + needle.length));
		};

		const closestWord = (needle) => {
			let nearest = null;
			for (const word of vocabulary) {
				const distance = editDistance(needle, word);
				if (distance <= 2 && (!nearest || distance < nearest.distance)) nearest = { word, distance };
			}
			return nearest?.word;
		};

		const explainNoResults = (typed, needle, singular) => {
			nothingTitle.textContent = `No ${singular} matches “${typed}”`;
			nothingText.textContent = '';
			conceal(widenButton);
			const elsewhere = category !== 'all' ? catalog.filter((entry) => fits(entry, needle)) : [];
			if (elsewhere.length) {
				const [first] = elsewhere;
				const where = pick('.es-results-cat', first.row).textContent.trim();
				const others = elsewhere.length > 1 ? ` and ${elsewhere.length - 1} more are` : ' is';
				nothingText.append(`${first.name}${others} in ${where}.`);
				reveal(widenButton);
				return;
			}
			const suggestion = closestWord(needle);
			if (!suggestion) {
				nothingText.append('Check the spelling, or try a shorter word.');
				return;
			}
			const tryIt = document.createElement('button');
			tryIt.type = 'button';
			tryIt.className = 'basalt-empty-suggest';
			tryIt.textContent = capitalized(suggestion);
			on(tryIt, 'click', () => searchFor(tryIt.textContent.trim()));
			nothingText.append('Did you mean ', tryIt, '?');
		};

		const rerun = () => {
			const typed = box.value.trim();
			const needle = typed.toLowerCase();
			let hits = 0;
			for (const entry of catalog) {
				const shown = (category === 'all' || entry.category === category) && fits(entry, needle);
				entry.row.toggleAttribute('hidden', !shown);
				if (!shown) continue;
				hits += 1;
				highlightIn(entry, needle);
			}
			results.toggleAttribute('hidden', !hits);
			nothing.toggleAttribute('hidden', !!hits);
			const [singular, pluralForm] = CATEGORY_NOUNS[category];
			tally.textContent = hits ? countOf(hits, singular, pluralForm) : `No ${singular} matches`;
			if (!hits) explainNoResults(typed, needle, singular);
		};

		const chooseCategory = (next) => {
			category = next;
			for (const choice of categoryChips)
				choice.setAttribute('aria-pressed', String(choice.getAttribute('data-es-cat') === next));
			rerun();
		};

		const searchFor = (term) => {
			box.value = term;
			chooseCategory('all');
			box.focus();
		};

		const clearSearch = () => {
			box.value = '';
			rerun();
		};

		on(box, 'input', rerun);
		on(box, 'keydown', (event) => {
			if (event.key === 'Escape' && box.value) clearSearch();
		});
		for (const choice of categoryChips)
			on(choice, 'click', () => chooseCategory(choice.getAttribute('data-es-cat')));
		on(widenButton, 'click', () => {
			chooseCategory('all');
			box.focus();
		});
		on(clearButton, 'click', () => {
			clearSearch();
			box.focus();
		});
		for (const example of pickAll('[data-es-try]', demo))
			on(example, 'click', () => searchFor(example.getAttribute('data-es-try')));
		rerun();
	}

	/*
	 * Drop zone demo: a dropped or sample file "imports" over a progress bar,
	 * then lists what came in. Undo puts the drop zone back.
	 */

	function wireImportDemo() {
		const dropPanel = pick('[data-basalt-drop]');
		const report = pick('[data-es-import]');
		if (!dropPanel || !report) return;
		const { meter, status, fileName, imported, undoButton } = partsOf(report, PARTS.importing);
		let ticker = null;

		const beginImport = (name) => {
			clearInterval(ticker);
			fileName.textContent = name;
			conceal(dropPanel);
			reveal(report);
			conceal(imported, undoButton);
			status.textContent = 'Importing';
			let percent = 0;
			const tick = () => {
				percent = Math.min(100, percent + (motionIsReduced() ? 100 : 12));
				meter.setAttribute('aria-valuenow', String(percent));
				meter.firstElementChild.style.width = `${percent}%`;
				if (percent < 100) return;
				clearInterval(ticker);
				status.textContent = '4 products imported';
				reveal(imported);
				markNew(imported);
				reveal(undoButton);
				undoButton.focus();
			};
			tick();
			ticker = setInterval(tick, IMPORT_TICK_MS);
		};

		on(dropPanel, 'basalt:files', (event) => beginImport(event.detail.files[0].name));
		on(pick('[data-es-sample]', dropPanel), 'click', () => beginImport(SAMPLE_FILE));
		on(undoButton, 'click', () => {
			clearInterval(ticker);
			conceal(report);
			reveal(dropPanel);
			meter.firstElementChild.style.width = '0%';
			pick('[data-basalt-drop-browse]', dropPanel).focus();
		});
	}

	/* Checklist demo: one button takes it back to the first step. */

	function wireChecklistDemo() {
		const checklist = pick('[data-basalt-checklist]');
		const restart = pick('[data-es-restart]');
		if (!checklist || !restart) return;
		on(restart, 'click', () => {
			checklist.basaltChecklistReset(1);
			pick('[data-basalt-checklist-do]', checklist)?.focus();
		});
	}

	/* Retry demo: the first attempt fails, the second loads the content. */

	function wireRetryDemo() {
		const failed = pick('[data-basalt-retry]');
		const loaded = pick('[data-es-loaded]');
		if (!failed || !loaded) return;
		on(failed, 'basalt:retry', (event) => {
			setTimeout(() => {
				if (event.detail.attempt < 2) {
					event.detail.done(false);
					return;
				}
				event.detail.done(true);
				conceal(failed);
				reveal(loaded);
				pick('[data-es-loaded-msg]', loaded).focus();
			}, RETRY_WAIT_MS);
		});
		on(pick('[data-es-fail-again]', loaded), 'click', () => {
			conceal(loaded);
			reveal(failed);
			failed.basaltRetryReset();
			pick('[data-basalt-retry-now]', failed).focus();
		});
	}

	/* Offline demo: a switch forces the offline state; changes queue up and
     are reported as sent when the connection comes back. */

	function wireOfflineDemo() {
		const demoRoot = pick('[data-basalt-offline]');
		const offlineSwitch = pick('[data-es-offline-switch]');
		if (!demoRoot || !offlineSwitch) return;
		const { queueNote, heading, queueButton } = partsOf(demoRoot, PARTS.offline);
		let waiting = 0;

		const describeQueue = () => {
			queueNote.textContent = waiting
				? `${countOf(waiting, 'change', 'changes')} waiting to send`
				: 'Nothing waiting to send';
		};
		const forceFromSwitch = () => demoRoot.basaltOffline.force(offlineSwitch.checked ? true : null);

		on(offlineSwitch, 'change', forceFromSwitch);
		on(queueButton, 'click', () => {
			waiting += 1;
			describeQueue();
		});
		on(demoRoot, 'basalt:online', () => {
			heading.lastChild.textContent = waiting
				? `Back online. ${countOf(waiting, 'change', 'changes')} sent.`
				: 'Connected. Today’s visits';
			waiting = 0;
			describeQueue();
		});
		on(demoRoot, 'basalt:offline', () => {
			heading.lastChild.textContent = 'Connected. Today’s visits';
		});
		forceFromSwitch();
	}

	/* First use demo: sample rows can be added and taken away again. */

	function wireSamplesDemo() {
		const firstUse = pick('[data-es-first]');
		const samples = pick('[data-es-samples-list]');
		if (!firstUse || !samples) return;
		const addButton = pick('[data-es-samples]', firstUse);
		const removeButton = pick('[data-es-samples-remove]', samples);
		on(addButton, 'click', () => {
			conceal(firstUse);
			reveal(samples);
			markNew(samples);
			removeButton.focus();
		});
		on(removeButton, 'click', () => {
			conceal(samples);
			reveal(firstUse);
			addButton.focus();
		});
	}

	/* No access demo: ask, wait for the pretend request, then offer to cancel. */

	function wireAccessDemo() {
		const demoRoot = pick('[data-es-access]');
		if (!demoRoot) return;
		const { askButton, askLabel, cancelButton, heading, body, announcer } = partsOf(demoRoot, PARTS.access);
		const spinner = pick('.spinner-border', askButton);
		const startingText = { heading: heading.textContent.trim(), body: body.textContent.trim() };

		on(askButton, 'click', () => {
			askButton.disabled = true;
			reveal(spinner);
			askLabel.textContent = 'Sending';
			setTimeout(() => {
				conceal(spinner, askButton);
				askButton.disabled = false;
				askLabel.textContent = 'Ask for access';
				reveal(cancelButton);
				heading.textContent = 'Request sent to Sharon Oakley';
				body.textContent = 'You’ll get an email when she answers. Most requests are answered the same day.';
				announcer.textContent = 'Request sent to Sharon Oakley';
				cancelButton.focus();
			}, ACCESS_WAIT_MS);
		});
		on(cancelButton, 'click', () => {
			conceal(cancelButton);
			reveal(askButton);
			heading.textContent = startingText.heading;
			body.textContent = startingText.body;
			announcer.textContent = 'Request canceled';
			askButton.focus();
		});
	}

	/* Notes demo: an empty card grows a form, then a list; deleting the last
     note brings the empty state back. */

	function wireNotesDemo() {
		const demoRoot = pick('[data-es-notes]');
		if (!demoRoot) return;
		const { nothingYet, composer, notes, addButton, cancelButton } = partsOf(demoRoot, PARTS.notes);
		const noteField = pick('textarea', composer);

		const backToEmpty = () => {
			reveal(nothingYet);
			addButton.focus();
		};

		const noteRow = (content) => {
			const row = document.createElement('li');
			const noteText = document.createElement('span');
			const removeButton = document.createElement('button');
			noteText.textContent = content;
			removeButton.type = 'button';
			removeButton.className = 'btn btn-sm btn-outline-secondary';
			removeButton.textContent = 'Delete';
			removeButton.setAttribute('aria-label', `Delete note: ${content}`);
			on(removeButton, 'click', () => {
				row.remove();
				if (notes.children.length) return;
				conceal(notes);
				backToEmpty();
			});
			row.append(noteText, removeButton);
			return { row, removeButton };
		};

		on(addButton, 'click', () => {
			conceal(nothingYet);
			reveal(composer);
			noteField.focus();
		});
		on(cancelButton, 'click', () => {
			conceal(composer);
			noteField.value = '';
			if (!notes.children.length) backToEmpty();
		});
		on(composer, 'submit', (event) => {
			event.preventDefault();
			const { row, removeButton } = noteRow(noteField.value.trim() || noteField.placeholder);
			notes.appendChild(row);
			reveal(notes);
			conceal(composer);
			noteField.value = '';
			removeButton.focus();
		});
	}

	/**
	 * Dropdown demo: opens on load so the empty menu is on show. Bootstrap
	 * focuses the toggle as it opens, which would scroll the reader down to
	 * this card, so the scroll position is put back.
	 */
	function openMenuDemo() {
		const menuToggle = pick('.es-stage-top [data-bs-toggle="dropdown"]');
		if (!menuToggle || !window.bootstrap) return;
		const scrollBefore = window.scrollY;
		bootstrap.Dropdown.getOrCreateInstance(menuToggle, { autoClose: 'outside', display: 'static' }).show();
		menuToggle.blur();
		window.scrollTo(0, scrollBefore);
	}

	start();
})();
