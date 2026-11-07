/**
 * Page glue for tree-and-sortable.html: the kind filter over the demo
 * cards, the snippet copy buttons, the search shortcuts, the list group
 * tree's active row and a stand-in server for the lazy tree. The tree,
 * sortable and transfer components themselves (window.Basalt.tree,
 * Basalt.sortable, Basalt.transfer) live in basalt.js.
 */
(() => {
	'use strict';
	const shell = pick('[data-ts-root]');
	if (!shell) return;

	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const COPIED_FOR_MS = 1800;
	const LISTGROUP_ROW = '.ts-lgtree-group .list-group-item';

	/* Each lazy folder's contents as [icon, file name, date]. The fuel card
     folder fails its first request so the retry row can be seen. */
	const FOLDER_FILES = {
		parts: [
			['bi-filetype-pdf', 'Invoice 7716.pdf', 'Sep 12'],
			['bi-filetype-pdf', 'Invoice 7742.pdf', 'Sep 26'],
			['bi-file-earmark-spreadsheet', 'Supplies price agreement.xlsx', 'Aug 30'],
		],
		fuel: [
			['bi-filetype-pdf', 'Fuel statement, September.pdf', 'Sep 30'],
			['bi-filetype-pdf', 'Fuel statement, August.pdf', 'Aug 31'],
		],
		rental: [
			['bi-filetype-pdf', 'Floor polisher hire 3318.pdf', 'Sep 18'],
			['bi-filetype-pdf', 'Rental terms.pdf', 'Sep 04'],
		],
		ppe: [
			['bi-filetype-pdf', 'Tabards and aprons.pdf', 'Sep 09'],
			['bi-filetype-pdf', 'Work shoes.pdf', 'Aug 21'],
			['bi-filetype-pdf', 'Glove sizes.pdf', 'Aug 14'],
		],
	};
	const FAILS_FIRST = 'fuel';
	let failedOnce = false;

	/**
	 * Hooks up every behavior this page adds on top of the shared components.
	 */
	function start() {
		setUpKindFilter();
		for (const button of pickAll('[data-ts-copy]')) button.addEventListener('click', () => copySnippet(button));
		for (const button of pickAll('[data-ts-try]'))
			button.addEventListener('click', () => setSearch(button.dataset.tsTry, button.textContent.trim()));
		for (const button of pickAll('[data-ts-clear]'))
			button.addEventListener('click', () => setSearch(button.dataset.tsClear, ''));
		for (const listGroup of pickAll('[data-ts-lgtree]')) listGroup.addEventListener('click', markActiveRow);
		for (const lazyTree of pickAll('[data-ts-lazy-demo]'))
			lazyTree.addEventListener('basalt:tree-load', answerFolder);
	}

	function pickAll(selector, scope = shell) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(raw) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return raw.replace(/[&<>"']/g, (char) => entities[char]);
	}

	/* Kind filter: the chips narrow the grid to one kind of component. */

	function setUpKindFilter() {
		const cardGrid = pick('[data-ts-grid]', shell);
		if (!cardGrid) return;
		const tally = pick('[data-ts-count]', shell);
		const demoCards = pickAll('.ts-card', cardGrid);
		const kindChips = pickAll('[data-ts-filter]');

		const showKind = (kind) => {
			const matching = demoCards.filter((card) => kind === 'all' || card.dataset.tsKind === kind);
			for (const card of demoCards) {
				card.classList.toggle('is-hidden', !matching.includes(card));
				card.classList.remove('is-alone');
			}
			pairHalfCards(matching);
			if (tally)
				tally.textContent = `${matching.length} ${matching.length === 1 ? 'component type' : 'component types'}`;
		};

		for (const pressed of kindChips) {
			pressed.addEventListener('click', () => {
				for (const peer of kindChips) peer.setAttribute('aria-pressed', String(peer === pressed));
				showKind(pressed.dataset.tsFilter);
			});
		}
		showKind('all');
	}

	/**
	 * Half-width cards sit side by side between the full-width ones. When a
	 * stretch of half cards has an odd count, its last card spans the row.
	 */
	function pairHalfCards(matching) {
		let stretch = 0;
		for (const [index, card] of matching.entries()) {
			const spansRow = card.classList.contains('ts-card-full');
			if (!spansRow) stretch += 1;
			const stretchEnds = spansRow || index === matching.length - 1;
			if (!stretchEnds) continue;
			const lastHalf = spansRow ? matching[index - 1] : card;
			if (stretch % 2) lastHalf.classList.add('is-alone');
			stretch = 0;
		}
	}

	/* Snippet copy: the button says Copied with a check for a moment. */

	function copySnippet(button) {
		const codeBlock = pick('pre', button.parentElement);
		if (!codeBlock) return;
		window.Basalt.copyText(codeBlock.textContent.trim()).then(() => {
			const mark = pick('.bi', button);
			const showCopied = (copied) => {
				button.lastChild.textContent = copied ? ' Copied' : ' Copy';
				if (mark) mark.className = copied ? 'bi bi-check2' : 'bi bi-clipboard';
			};
			showCopied(true);
			clearTimeout(button._tsTimer);
			button._tsTimer = setTimeout(() => showCopied(false), COPIED_FOR_MS);
		});
	}

	/* Search shortcuts: the "Try" words fill the tree search, and the empty
     state's button clears it. Both fire input so the tree refilters. */

	function setSearch(target, value) {
		const searchBox = pick(target);
		if (!searchBox) return;
		searchBox.value = value;
		searchBox.dispatchEvent(new Event('input', { bubbles: true }));
		searchBox.focus();
	}

	/* List group tree: the clicked leaf row becomes the active one. */

	function markActiveRow(event) {
		const picked = event.target.closest(LISTGROUP_ROW);
		if (!picked) return;
		for (const row of pickAll(LISTGROUP_ROW, event.currentTarget)) {
			const isPicked = row === picked;
			row.classList.toggle('active', isPicked);
			if (isPicked) row.setAttribute('aria-current', 'true');
			else row.removeAttribute('aria-current');
		}
	}

	/* Lazy tree: a pretend server. A real app would fetch the folder in its
     basalt:tree-load handler; here each one answers after a short wait. */

	function answerFolder(event) {
		const { key, resolve, reject } = event.detail;
		const pause = calmMotion.matches ? 300 : 900;
		setTimeout(() => {
			if (key === FAILS_FIRST && !failedOnce) {
				failedOnce = true;
				reject('Could not reach the fuel card portal.');
				return;
			}
			resolve((FOLDER_FILES[key] || []).map(fileRow).join(''));
		}, pause);
	}

	function fileRow([icon, name, date]) {
		return `<li role="treeitem"><div class="basalt-tree-row"><i aria-hidden="true" class="bi ${icon} basalt-tree-icon"></i><span class="basalt-tree-label">${htmlSafe(name)}</span><span class="basalt-tree-meta">${date}</span></div></li>`;
	}

	start();

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}
})();
