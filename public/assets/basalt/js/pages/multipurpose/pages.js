/**
 * The Fieldline website's pages, for pages.html. One list shows every
 * page grouped under its site-menu section and in menu order, with status
 * tabs on top, and a second card lists pages that look wrong in search
 * results. Clicking a row opens the page in page-editor.html; the
 * panel icon opens a quick view drawer with the search preview, where
 * visitors went next and the latest edits. "New page" opens a dialog.
 *
 * Bringing your own pages:
 *   1. Swap the records in assets/basalt/js/data/multipurpose/site-pages.js for what your
 *      backend returns, keeping the same fields. Every number, row and
 *      panel here is drawn from them, and the editor reads the same list.
 *   2. Saving, moving, duplicating and deleting only change the list in
 *      memory. Those handlers are where your API calls belong.
 * Shared pieces from basalt.js do the rest: tabs, styled selects, status
 * pills, avatars, pagination, record stepping in the drawer, choice
 * tiles, copy buttons, empty states and toasts.
 */
(() => {
	'use strict';

	const shell = pick('[data-cp-root]');
	if (!shell) return;

	/* The frozen "today" of the demo; a live app reads the real date. */
	const NOW = '2026-10-08';
	const DOMAIN = 'fieldline.app';
	const EDITOR_NAME = 'John Armstrong';

	/* Pages, sections, layouts and owners come from
     assets/basalt/js/data/multipurpose/site-pages.js, which the page editor shares. Sections
     follow the site menu and layouts tell the tiles apart; both carry a
     chart-color number so they follow every palette. */
	const { sections: SECTIONS, layouts: LAYOUTS, people: OWNERS, pages: SITE_PAGES } = window.Basalt.data.sitePages;

	const STATUS_LOOK = {
		published: { label: 'Published', tone: 'success' },
		scheduled: { label: 'Scheduled', tone: 'primary' },
		review: { label: 'In review', tone: 'warning' },
		draft: { label: 'Draft', tone: '' },
	};
	const TAB_KEYS = ['all', 'published', 'review', 'scheduled', 'draft'];

	/* The next step for a page in each status, as the row menu and the
     drawer button offer it. */
	const NEXT_STEP = {
		published: { label: 'Unpublish', to: 'draft', icon: 'bi-eye-slash' },
		scheduled: { label: 'Publish now', to: 'published', icon: 'bi-send' },
		review: { label: 'Approve and publish', to: 'published', icon: 'bi-check2-circle' },
		draft: { label: 'Send for review', to: 'review', icon: 'bi-person-check' },
	};

	/* Search engines trim titles near 60 characters and descriptions near 160. */
	const SEARCH_LIMITS = { titleMax: 60, descMin: 70, descMax: 160 };
	const ROWS_PER_PAGE = 12;

	const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	/* order holds the ids of the list as currently filtered, so the drawer
     can step through it. */
	const view = { query: '', section: 'all', status: 'all', pageNo: 1, openId: null, order: [] };

	const ui = {
		rows: pick('[data-cp-rows]', shell),
		table: pick('.cp-table', shell),
		empty: pick('[data-cp-empty]', shell),
		pager: pick('[data-cp-pager]', shell),
		pageLinks: pick('[data-cp-pages]', shell),
		range: pick('[data-cp-range]', shell),
		listIntro: pick('[data-cp-list-desc]', shell),
		search: pick('[data-cp-search]', shell),
		sectionFilter: pick('[data-cp-section]', shell),
		tabPanel: document.getElementById('cp-list-panel'),
		fixList: pick('[data-cp-issues]', shell),
		fixIntro: pick('[data-cp-issues-desc]', shell),
		drawer: document.getElementById('cp-page'),
		dialog: document.getElementById('cp-editor'),
	};
	const findForm = {
		form: pick('[data-cp-seo-form]', ui.drawer),
		editButton: pick('[data-cp-seo-edit]', ui.drawer),
		title: pick('[data-cp-seo-title]', ui.drawer),
		desc: pick('[data-cp-seo-desc]', ui.drawer),
	};
	const positionLabel = pick('[data-basalt-record-pos]', ui.drawer);
	const stepButtons = Array.from(pickAll('[data-basalt-record-prev], [data-basalt-record-next]', ui.drawer));
	const newPageForm = pick('[data-cp-form]', ui.dialog);
	const newPage = {
		title: newPageField('title'),
		section: newPageField('section'),
		owner: newPageField('owner'),
		path: newPageField('path'),
		layouts: pick('[data-cp-layouts]', newPageForm),
	};

	let pagination = null;
	let pathEditedByHand = false;
	let searchDelay = 0;

	start();

	function start() {
		ui.sectionFilter.innerHTML = `<option value="all" selected>Every section</option>${sectionOptions()}`;
		wireDrawerStepping();
		fillNewPageChoices();
		wireNewPageDialog();
		bindFilters();
		shell.addEventListener('click', onShellClick);
		shell.addEventListener('auxclick', (event) => {
			if (event.button === 1) openRowInEditor(event);
		});
		wireDrawer();
		repaint();
	}

	function repaint() {
		paintList();
		paintSearchFixes();
		const open = view.openId && pageById(view.openId);
		if (open) fillDrawer(open);
	}

	/* Search, section and status tabs. Each change goes back to page one. */
	function bindFilters() {
		ui.search.addEventListener('input', () => {
			clearTimeout(searchDelay);
			searchDelay = setTimeout(() => {
				view.query = ui.search.value;
				view.pageNo = 1;
				paintList();
			}, 120);
		});
		ui.sectionFilter.addEventListener('change', () => {
			view.section = ui.sectionFilter.value;
			view.pageNo = 1;
			paintList();
		});
		for (const tab of pickAll('[data-cp-tab]', shell)) {
			tab.addEventListener('shown.bs.tab', () => {
				view.status = tab.getAttribute('data-cp-tab');
				view.pageNo = 1;
				ui.tabPanel.setAttribute('aria-labelledby', tab.id);
				paintList();
			});
		}
	}

	/* One listener on the page handles New page, Fix, the row menu, the
     quick view icon and, failing all of those, a plain row click. */
	function onShellClick(event) {
		const { target } = event;
		if (target.closest('[data-cp-new]')) {
			openNewPageDialog();
			return;
		}
		const fixButton = target.closest('[data-cp-fix]');
		if (fixButton) {
			showSheet(fixButton.getAttribute('data-cp-fix'), { fix: true });
			return;
		}
		const menuItem = target.closest('[data-cp-act]');
		if (menuItem) {
			const record = pageById(menuItem.closest('[data-cp-id]').getAttribute('data-cp-id'));
			const actions = { duplicate: duplicatePage, move: advancePage, delete: removePage };
			actions[menuItem.getAttribute('data-cp-act')]?.(record);
			return;
		}
		const quickView = target.closest('[data-cp-open]');
		if (quickView) {
			showSheet(quickView.getAttribute('data-cp-open'));
			return;
		}
		openRowInEditor(event);
	}

	/* Anywhere else on a row opens the editor, just as the page name does,
     in a new tab with Cmd or Ctrl or a middle click. */
	function openRowInEditor(event) {
		const row = event.target.closest('.cp-row');
		if (!row || event.target.closest('button, a, input, .dropdown')) return;
		const url = editorLink(pageById(row.getAttribute('data-cp-id')));
		if (event.metaKey || event.ctrlKey || event.button === 1) window.open(url, '_blank', 'noopener');
		else location.href = url;
	}

	/* The page list, grouped under section bands. */

	/**
	 * Pages that match the search box and section filter.
	 * @param {boolean} [ignoreStatus] skip the status tab too, which the tab counts need
	 */
	function matchingPages(ignoreStatus) {
		const query = view.query.trim();
		return SITE_PAGES.filter((record) => {
			if (view.section !== 'all' && record.section !== view.section) return false;
			if (!ignoreStatus && view.status !== 'all' && record.status !== view.status) return false;
			if (!query) return true;
			const haystack = [
				record.title,
				record.path,
				record.owner,
				sectionById(record.section).name,
				record.layout,
			].join(' ');
			return window.Basalt.matchesQuery(haystack, query);
		});
	}

	function paintTabCounts() {
		const candidates = matchingPages(true);
		for (const key of TAB_KEYS) {
			pick(`[data-cp-n="${key}"]`, shell).textContent =
				key === 'all' ? candidates.length : candidates.filter((record) => record.status === key).length;
		}
		ui.listIntro.textContent = `All ${counted(SITE_PAGES.length, 'page')} on ${DOMAIN}, section by section in the order of the site menu.`;
	}

	function paintList() {
		paintTabCounts();
		const results = matchingPages();
		view.order = results.map((record) => record.id);
		const pageCount = Math.max(1, Math.ceil(results.length / ROWS_PER_PAGE));
		view.pageNo = Math.min(view.pageNo, pageCount);
		const offset = (view.pageNo - 1) * ROWS_PER_PAGE;
		const visible = results.slice(offset, offset + ROWS_PER_PAGE);
		const busiest = Math.max(1, ...SITE_PAGES.filter(liveNow).map((record) => record.visits));

		let markup = '';
		let previousSection = null;
		for (const record of visible) {
			if (record.section !== previousSection) markup += sectionBand(sectionById(record.section), results);
			markup += pageRow(record, busiest);
			previousSection = record.section;
		}
		ui.rows.innerHTML = markup;
		ui.table.hidden = !visible.length;
		ui.empty.hidden = !!visible.length;
		if (!visible.length) ui.empty.innerHTML = emptyListMessage();

		ui.pager.hidden = results.length <= ROWS_PER_PAGE;
		ui.range.innerHTML = results.length
			? `<strong>${offset + 1}&ndash;${offset + visible.length}</strong> of ${counted(results.length, 'page')}`
			: '';
		syncPagination(pageCount);
		if (window.Basalt.avatars) window.Basalt.avatars(ui.rows);
		if (window.Basalt.tips) window.Basalt.tips(ui.rows);
	}

	function emptyListMessage() {
		const query = view.query.trim();
		if (!query) {
			return window.Basalt.emptyState({
				icon: 'window-stack',
				title: 'No pages like that',
				text: 'Pick another section or tab to see more pages.',
			});
		}
		const narrowed = view.section !== 'all' || view.status !== 'all';
		return window.Basalt.emptyState({
			query,
			noun: 'pages',
			text: narrowed ? 'Check the spelling, or look in every section and status.' : '',
		});
	}

	function syncPagination(pageCount) {
		if (!window.Basalt.pagination) return;
		if (!pagination) {
			pagination = window.Basalt.pagination(ui.pageLinks, {
				total: pageCount,
				current: view.pageNo,
				label: 'Page list page',
				onChange(chosen) {
					view.pageNo = chosen;
					paintList();
				},
			});
			return;
		}
		pagination.setTotal(pageCount);
		if (pagination.get() !== view.pageNo) pagination.set(view.pageNo);
	}

	/* The band that opens a menu section, counting that section's pages
     and live visits in the list as filtered right now. */
	function sectionBand(group, results) {
		const inGroup = results.filter((record) => record.section === group.id);
		const visitTotal = inGroup.filter(liveNow).reduce((sum, record) => sum + record.visits, 0);
		const summary = counted(inGroup.length, 'page') + (visitTotal ? ` · ${withCommas(visitTotal)} visits` : '');
		return `<tr class="cp-group cp-tone-${group.tone}"><th scope="colgroup" colspan="5"><span class="cp-group-band"><span class="cp-dot" aria-hidden="true"></span><span class="cp-group-name">${group.name}</span><span class="cp-group-facts">${summary}</span></span></th></tr>`;
	}

	function pageRow(record, busiest) {
		const group = sectionById(record.section);
		const caption = statusCaption(record);
		const lastEditor = record.changes[0][0];
		const updated = `Updated ${shortDay(record.edited)} by ${lastEditor}`;
		/* Narrow cards fold visits and the update into one line; medium cards
       fold only the update under the status. */
		const folded = [liveNow(record) ? `${withCommas(record.visits)} visits` : '', updated]
			.filter(Boolean)
			.join(' · ');
		const visitsCell = liveNow(record)
			? `<span class="cp-visits"><span class="cp-visits-bar" aria-hidden="true"><span style="width:${record.visits ? Math.max(3, Math.round((record.visits / busiest) * 100)) : 0}%"></span></span><span class="cp-visits-n">${withCommas(record.visits)}</span></span>`
			: '<span class="cp-quiet" title="Not live yet">&ndash;</span>';
		const safeTitle = htmlSafe(record.title);
		return (
			`<tr class="cp-row cp-tone-${group.tone}" data-cp-id="${record.id}">` +
			`<td class="cp-col-page">${pageIdentity(record)}</td>` +
			`<td class="cp-col-status" data-cp-facts="${htmlSafe(folded)}" data-cp-updated="${htmlSafe(updated)}">${stateTag(record.status)}${caption ? `<span class="cp-meta">${htmlSafe(caption)}</span>` : ''}</td>` +
			`<td class="cp-col-visits text-end">${visitsCell}</td>` +
			`<td class="cp-col-updated"><span class="cp-who">${avatarSlot(lastEditor)}<span><span class="cp-updated">${shortDay(record.edited)}</span><span class="cp-meta">${htmlSafe(lastEditor)}</span></span></span></td>` +
			'<td class="cp-col-act"><div class="basalt-row-actions">' +
			`<button type="button" class="btn btn-icon btn-sm" data-cp-open="${record.id}" aria-label="Quick view: ${safeTitle}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>` +
			`<a class="btn btn-icon btn-sm" href="${editorLink(record)}" aria-label="Open full page: ${safeTitle}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>` +
			`${rowMenu(record)}</div></td></tr>`
		);
	}

	/* A soft second line under the status, for the statuses that want one. */
	function statusCaption(record) {
		switch (record.status) {
			case 'scheduled':
				return `${shortDay(record.goLive)}, ${clockTime(record.time)}`;
			case 'review':
				return `With ${record.reviewer}`;
			case 'draft':
				return 'Not on the site';
			default:
				return '';
		}
	}

	function rowMenu(record) {
		const step = NEXT_STEP[record.status];
		const item = (action, icon, label, extraClass = '') =>
			`<li><button type="button" class="dropdown-item${extraClass}" data-cp-act="${action}"><i class="bi ${icon}" aria-hidden="true"></i>${label}</button></li>`;
		return (
			`<div class="dropdown">` +
			`<button type="button" class="btn btn-icon cp-more" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="More actions for ${htmlSafe(record.title)}"><i class="bi bi-three-dots" aria-hidden="true"></i></button>` +
			`<ul class="dropdown-menu dropdown-menu-end">${item('duplicate', 'bi-files', 'Duplicate')}${item(
				'move',
				step.icon,
				step.label,
			)}<li><hr class="dropdown-divider"></li>${item(
				'delete',
				'bi-trash3',
				'Delete',
				' cp-danger-item',
			)}</ul></div>`
		);
	}

	/* Name and address beside a tile that shows the page's layout. */
	function pageIdentity(record) {
		const layout = layoutById(record.layout);
		return (
			`<div class="cp-page-id"><span class="cp-kind cp-tone-${layout.tone}" title="${layout.id} layout" aria-hidden="true"><i class="bi ${layout.icon}"></i></span>` +
			`<div class="cp-page-id-text"><a class="cp-link cp-row-title" href="${editorLink(record)}" data-cp-title="${record.id}">${htmlSafe(record.title)}</a><span class="cp-path">${breakablePath(record.path)}</span></div></div>`
		);
	}

	/* Pages whose title or description will look poor in search results. */
	function paintSearchFixes() {
		const flagged = SITE_PAGES.filter((record) => searchProblem(record));
		const lead = 'How each page shows up on Google and Bing.';
		ui.fixIntro.textContent = flagged.length
			? `${lead} ${capitalize(spelledCount(flagged.length, 'page needs', 'pages need'))} a fix.`
			: lead;
		if (!flagged.length) {
			const { titleMax, descMin, descMax } = SEARCH_LIMITS;
			ui.fixList.innerHTML = `<li class="cp-issues-none">${window.Basalt.emptyState({ icon: 'check2-circle', title: 'Every page reads well in search results', text: `Titles fit in ${titleMax} characters and every description is ${descMin} to ${descMax}.` })}</li>`;
			return;
		}
		ui.fixList.innerHTML = flagged
			.map(
				(record) =>
					'<li class="cp-issue">' +
					`<div class="cp-issue-page">${pageIdentity(record)}</div>` +
					`<p class="cp-issue-text"><i class="bi bi-exclamation-circle" aria-hidden="true"></i>${htmlSafe(searchProblem(record))}</p>` +
					`<button type="button" class="btn btn-outline-secondary btn-sm cp-issue-fix" data-cp-fix="${record.id}" aria-label="Fix ${htmlSafe(record.title)}">Fix</button>` +
					'</li>',
			)
			.join('');
	}

	/** What, if anything, is wrong with a page's search title and description. */
	function searchProblem(record) {
		const titleLength = record.seo.title.length;
		const descLength = record.seo.desc.length;
		const { titleMax, descMin, descMax } = SEARCH_LIMITS;
		if (!descLength) return 'No description, so search engines make one up from the page.';
		if (titleLength > titleMax)
			return `The title is ${titleLength} characters, so search results cut it off at ${titleMax}.`;
		if (descLength < descMin)
			return `The description is only ${descLength} characters. Aim for ${descMin} to ${descMax}.`;
		if (descLength > descMax)
			return `The description is ${descLength} characters, so search results cut it off at ${descMax}.`;
		return '';
	}

	/* The quick view drawer for one page. */

	function wireDrawer() {
		ui.drawer.addEventListener('click', (event) => {
			const record = pageById(view.openId);
			if (!record) return;
			const hit = (selector) => event.target.closest(selector);
			if (hit('[data-cp-move]')) advancePage(record);
			else if (hit('[data-cp-delete]')) removePage(record);
			else if (hit('[data-cp-seo-edit]')) openSearchForm();
			else if (hit('[data-cp-seo-cancel]')) {
				closeSearchForm();
				findForm.editButton.focus();
			}
		});
		findForm.form.addEventListener('submit', saveSearchDetails);
		for (const input of [findForm.title, findForm.desc]) {
			input.addEventListener('input', () => {
				input.classList.remove('is-invalid');
				updateSearchPreview();
			});
		}
		ui.drawer.addEventListener('hidden.bs.offcanvas', () => {
			const closedId = view.openId;
			view.openId = null;
			if (ui.dialog.classList.contains('show')) return;
			const titleLink = closedId && pick(`[data-cp-title="${closedId}"]`, shell);
			if (titleLink) titleLink.focus({ preventScroll: true });
		});
	}

	/* Previous and next walk the list as filtered right now, with the same
     buttons and Alt+Up / Alt+Down as every other record drawer. */
	function wireDrawerStepping() {
		pick('[data-basalt-record-prev]', ui.drawer).addEventListener('click', () => stepDrawer(-1));
		pick('[data-basalt-record-next]', ui.drawer).addEventListener('click', () => stepDrawer(1));
		ui.drawer.addEventListener('keydown', (event) => {
			if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
			event.preventDefault();
			stepDrawer(event.key === 'ArrowUp' ? -1 : 1);
		});
	}

	function stepDrawer(direction) {
		const total = view.order.length;
		if (total < 2) return;
		const landing = (view.order.indexOf(view.openId) + direction + total) % total;
		view.openId = view.order[landing];
		fillDrawer(pageById(view.openId));
		positionLabel.textContent = `${landing + 1} of ${total}`;
		pick('.offcanvas-body', ui.drawer).scrollTop = 0;
	}

	/**
	 * Opens the quick view on one page.
	 * @param {{fix?: boolean}} [options] fix opens the search form straight away
	 */
	function showSheet(id, options) {
		const record = pageById(id);
		if (!record) return;
		if (!view.order.includes(id)) view.order = SITE_PAGES.map((each) => each.id);
		view.openId = id;
		fillDrawer(record);
		const total = view.order.length;
		positionLabel.textContent = `${view.order.indexOf(id) + 1} of ${total}`;
		positionLabel.hidden = total < 2;
		for (const button of stepButtons) button.hidden = total < 2;
		pick('.offcanvas-body', ui.drawer).scrollTop = 0;
		offcanvas().show();
		if (options && options.fix) openSearchForm();
	}

	function fillDrawer(record) {
		const group = sectionById(record.section);
		drawerSlot('title').textContent = record.title;
		drawerSlot('sub').innerHTML =
			`<span class="cp-section cp-tone-${group.tone}"><span class="cp-dot" aria-hidden="true"></span>${group.name}</span>`;
		drawerSlot('status').innerHTML =
			`${stateTag(record.status)}<p class="cp-sec-lead">${statusSentence(record)}</p>`;
		closeSearchForm();

		const problem = searchProblem(record);
		drawerSlot('flag').hidden = !problem;
		drawerSlot('flag').innerHTML = problem
			? `<i class="bi bi-exclamation-circle" aria-hidden="true"></i>${htmlSafe(problem)}`
			: '';

		/* A page that has only just gone live has no onward visits to rank. */
		const showNext = liveNow(record) && record.next && record.next.length > 0;
		drawerSlot('next-sec').hidden = !showNext;
		if (showNext) paintNextSteps(record);

		drawerSlot('facts').innerHTML = pageFacts(record)
			.map(([term, value]) => `<div class="cp-facts-row"><dt>${term}</dt><dd>${value}</dd></div>`)
			.join('');
		drawerSlot('changes').innerHTML = record.changes
			.slice(0, 3)
			.map(
				([who, what, when]) =>
					`<li class="cp-change">${avatarSlot(who)}<div><p class="cp-change-what">${htmlSafe(what)}</p><p class="cp-meta">${htmlSafe(who)} &middot; ${shortDay(when)}</p></div></li>`,
			)
			.join('');
		pick('[data-cp-move]', ui.drawer).textContent = NEXT_STEP[record.status].label;
		pick('[data-cp-full]', ui.drawer).href = editorLink(record);
		if (window.Basalt.avatars) window.Basalt.avatars(ui.drawer);
		if (window.Basalt.buttons) window.Basalt.buttons(drawerSlot('facts'));
	}

	function pageFacts(record) {
		const copyButton = `<button type="button" class="btn btn-icon btn-sm cp-copy" data-basalt-copy="https://${htmlSafe(DOMAIN + record.path)}" data-bs-title="Copy address" aria-label="Copy address"><i class="bi bi-copy" aria-hidden="true"></i></button>`;
		return [
			[
				'Address',
				`<span class="cp-address-line"><span class="cp-path">${breakablePath(record.path)}</span>${copyButton}</span>`,
			],
			['Layout', htmlSafe(record.layout)],
			[
				'Owner',
				`<a class="cp-link cp-link-strong" href="employee-user-details.html">${htmlSafe(record.owner)}</a><span class="cp-meta cp-meta-inline">${htmlSafe(OWNERS[record.owner] || '')}</span>`,
			],
			['Created', fullDate(record.created)],
		];
	}

	function statusSentence(record) {
		const editor = htmlSafe(record.changes[0][0]);
		switch (record.status) {
			case 'published':
				return `Live on the site. Last changed on ${dayWithWeekday(record.edited)} by ${editor}.`;
			case 'scheduled':
				return `Goes live on ${dayWithWeekday(record.goLive)} at ${clockTime(record.time)}. Until then only the team can see it.`;
			case 'review':
				return `${htmlSafe(record.reviewer)} has been reviewing it since ${dayWithWeekday(record.edited)}.`;
			default:
				return `Not on the site yet. Last edited on ${dayWithWeekday(record.edited)} by ${editor}.`;
		}
	}

	/* Where visitors went after this page, biggest share first. */
	function paintNextSteps(record) {
		const ranked = record.next.slice().sort((a, b) => b[1] - a[1]);
		const trend =
			record.change === 0
				? 'the same as the 30 days before.'
				: `${record.change > 0 ? 'up ' : 'down '}${Math.abs(record.change)}% on the 30 days before.`;
		drawerSlot('next-lead').innerHTML =
			`<strong>${withCommas(record.visits)}</strong> visits in the last 30 days, ${trend}`;
		drawerSlot('next').innerHTML = ranked
			.map(
				([destination, share], index) =>
					`<li class="cp-bars-row cp-src-${index + 1}"><span class="cp-bars-name">${htmlSafe(destination)}</span><span class="cp-bars-track" aria-hidden="true"><span style="width:${share}%"></span></span><span class="cp-bars-value">${share}%</span></li>`,
			)
			.join('');
	}

	/* The search title and description, edited as a pair inside the drawer. */

	function openSearchForm() {
		const record = pageById(view.openId);
		if (!record) return;
		findForm.title.value = record.seo.title;
		findForm.desc.value = record.seo.desc;
		findForm.title.classList.remove('is-invalid');
		findForm.desc.classList.remove('is-invalid');
		findForm.form.hidden = false;
		findForm.editButton.hidden = true;
		drawerSlot('flag').hidden = true;
		updateSearchPreview();
		const focusTarget = searchProblem(record).startsWith('The title') ? findForm.title : findForm.desc;
		if (ui.drawer.classList.contains('show')) focusTarget.focus();
		else ui.drawer.addEventListener('shown.bs.offcanvas', () => focusTarget.focus(), { once: true });
	}

	function closeSearchForm() {
		const record = pageById(view.openId);
		findForm.form.hidden = true;
		findForm.editButton.hidden = false;
		if (!record) return;
		drawerSlot('snippet').innerHTML = searchResultPreview(record, record.seo.title, record.seo.desc);
		drawerSlot('flag').hidden = !searchProblem(record);
	}

	/* Live character counts and a preview that redraws as the visitor types. */
	function updateSearchPreview() {
		const titleLength = findForm.title.value.trim().length;
		const descLength = findForm.desc.value.trim().length;
		const { titleMax, descMin, descMax } = SEARCH_LIMITS;
		const titleCount = pick('[data-cp-count="title"]', ui.drawer);
		const descCount = pick('[data-cp-count="desc"]', ui.drawer);
		titleCount.textContent = `${titleLength} / ${titleMax}`;
		descCount.textContent = `${descLength} / ${descMax}`;
		titleCount.classList.toggle('is-over', titleLength > titleMax);
		descCount.classList.toggle('is-over', descLength > descMax || (descLength > 0 && descLength < descMin));
		const record = pageById(view.openId);
		if (record)
			drawerSlot('snippet').innerHTML = searchResultPreview(
				record,
				findForm.title.value.trim(),
				findForm.desc.value.trim(),
			);
	}

	function saveSearchDetails(event) {
		event.preventDefault();
		const record = pageById(view.openId);
		if (!record) return;
		const title = findForm.title.value.trim();
		const desc = findForm.desc.value.trim();
		const titleBad = !title || title.length > SEARCH_LIMITS.titleMax;
		const descBad = desc.length < SEARCH_LIMITS.descMin || desc.length > SEARCH_LIMITS.descMax;
		findForm.title.classList.toggle('is-invalid', titleBad);
		findForm.desc.classList.toggle('is-invalid', descBad);
		if (titleBad || descBad) {
			(titleBad ? findForm.title : findForm.desc).focus();
			return;
		}
		record.seo = { title, desc };
		record.edited = NOW;
		record.changes.unshift([EDITOR_NAME, 'Rewrote the search title and description', NOW]);
		repaint();
		findForm.editButton.focus();
		notify({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'Search details saved',
			text: 'Search engines pick up the change on their next visit.',
		});
	}

	/**
	 * The search result as it would appear, title and description trimmed
	 * where search engines trim them.
	 */
	function searchResultPreview(record, title, desc) {
		const crumbs = record.path
			.split('/')
			.filter(Boolean)
			.map((part) => ` › ${part}`)
			.join('');
		const descText = desc ? trimAtWord(desc, SEARCH_LIMITS.descMax) : 'No description yet.';
		return (
			`<span class="cp-snippet-site"><span class="cp-snippet-icon" aria-hidden="true">F</span><span class="cp-snippet-name">Fieldline<span class="cp-snippet-url">${htmlSafe(DOMAIN + crumbs)}</span></span></span>` +
			`<span class="cp-snippet-title">${htmlSafe(trimAtWord(title || record.title, SEARCH_LIMITS.titleMax))}</span>` +
			`<span class="cp-snippet-desc${desc ? '' : ' cp-snippet-desc-none'}">${htmlSafe(descText)}</span>`
		);
	}

	function trimAtWord(text, limit) {
		return text.length > limit ? `${text.slice(0, limit - 1).replace(/\s+\S*$/, '')} …` : text;
	}

	/* Changing pages: move to the next status, duplicate, delete. */

	/* Publish, unpublish, approve or send for review, with an undo. */
	function advancePage(record) {
		const snapshot = {
			status: record.status,
			edited: record.edited,
			changes: record.changes.slice(),
			visits: record.visits,
			change: record.change,
			next: record.next,
			reviewer: record.reviewer,
		};
		const target = NEXT_STEP[record.status].to;
		/* The content lead reviews every page except her own. */
		const reviewer = record.owner === 'Paige Drake' ? 'Reid Hollis' : 'Paige Drake';
		const wording = {
			published: {
				log: 'Published the page',
				headline: 'is live',
				detail: `It is on ${DOMAIN}${record.path} now.`,
			},
			draft: {
				log: 'Took the page off the site',
				headline: 'unpublished',
				detail: 'It is off the site and back with the drafts.',
			},
			review: {
				log: `Sent to ${reviewer} for review`,
				headline: 'sent for review',
				detail: `${reviewer} gets a note to read it.`,
			},
		}[target];
		if (target === 'review') record.reviewer = reviewer;
		if (target === 'published' && !record.next) Object.assign(record, { visits: 0, change: 0, next: [] });
		record.status = target;
		record.edited = NOW;
		record.changes.unshift([EDITOR_NAME, wording.log, NOW]);
		repaint();
		notify({
			tone: 'success',
			icon: target === 'draft' ? 'bi-eye-slash' : 'bi-check2-circle',
			title: `“${record.title}” ${wording.headline}`,
			text: wording.detail,
			actions: [
				{
					label: 'Undo',
					onClick() {
						Object.assign(record, snapshot);
						repaint();
					},
				},
			],
		});
	}

	/* The copy lands right after the original as a draft at a free address. */
	function duplicatePage(record) {
		const stem = record.path === '/' ? '/home' : record.path;
		let address = `${stem}-copy`;
		for (let suffix = 2; SITE_PAGES.some((each) => each.path === address); suffix++)
			address = `${stem}-copy-${suffix}`;
		const clone = {
			id: freshId(),
			title: `${record.title} (copy)`,
			path: address,
			section: record.section,
			layout: record.layout,
			status: 'draft',
			owner: EDITOR_NAME,
			created: NOW,
			edited: NOW,
			visits: 0,
			seo: { ...record.seo },
			changes: [[EDITOR_NAME, `Copied from ${record.title}`, NOW]],
		};
		SITE_PAGES.splice(SITE_PAGES.indexOf(record) + 1, 0, clone);
		repaint();
		notify({
			tone: 'success',
			icon: 'bi-files',
			title: 'Page duplicated',
			text: `The copy is a draft at ${address}.`,
			actions: [
				{
					label: 'Open',
					ghost: true,
					onClick() {
						showSheet(clone.id);
					},
				},
			],
		});
	}

	function removePage(record) {
		const slot = SITE_PAGES.indexOf(record);
		if (slot < 0) return;
		SITE_PAGES.splice(slot, 1);
		const tooltip = window.bootstrap && bootstrap.Tooltip.getInstance(pick('[data-cp-delete]', ui.drawer));
		if (tooltip) tooltip.hide();
		if (view.openId === record.id) offcanvas().hide();
		repaint();
		notify({
			tone: 'success',
			icon: 'bi-trash3',
			title: 'Page deleted',
			text: `“${record.title}” is gone from the site.`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						SITE_PAGES.splice(slot, 0, record);
						repaint();
					},
				},
			],
		});
	}

	/* The New page dialog. */

	function fillNewPageChoices() {
		newPage.section.innerHTML = sectionOptions();
		newPage.owner.innerHTML = Object.keys(OWNERS)
			.map((owner) => `<option value="${htmlSafe(owner)}">${htmlSafe(owner)}</option>`)
			.join('');
		newPage.layouts.innerHTML = LAYOUTS.map(
			(layout, index) =>
				`<label class="basalt-choice-card cp-layout cp-tone-${layout.tone}">` +
				`<input class="basalt-choice-card-input" type="radio" name="layout" value="${layout.id}"${index ? '' : ' checked'}>` +
				'<span class="basalt-choice-card-mark" aria-hidden="true"><i class="bi bi-check-lg"></i></span>' +
				`<span class="basalt-choice-card-icon" aria-hidden="true"><i class="bi ${layout.icon}"></i></span>` +
				`<span class="basalt-choice-card-title">${layout.id}</span></label>`,
		).join('');
	}

	/* The address follows the title until someone types one by hand. */
	function wireNewPageDialog() {
		newPage.title.addEventListener('input', () => {
			newPage.title.classList.remove('is-invalid');
			if (!pathEditedByHand)
				newPage.path.value = newPage.title.value.trim() ? `/${toSlug(newPage.title.value)}` : '';
		});
		newPage.path.addEventListener('input', () => {
			pathEditedByHand = newPage.path.value.trim() !== '';
			newPage.path.classList.remove('is-invalid');
		});
		newPage.path.addEventListener('blur', () => {
			if (newPage.path.value.trim()) newPage.path.value = tidyPath(newPage.path.value);
		});
		newPageForm.addEventListener('submit', createPage);
		ui.dialog.addEventListener('shown.bs.modal', () => newPage.title.focus());
	}

	function openNewPageDialog() {
		newPageForm.reset();
		for (const marked of pickAll('.is-invalid', newPageForm)) marked.classList.remove('is-invalid');
		pathEditedByHand = false;
		chooseOption(newPage.section, SECTIONS[0].id);
		chooseOption(newPage.owner, EDITOR_NAME);
		for (const radio of pickAll('input[name="layout"]', newPageForm)) radio.checked = radio.value === LAYOUTS[0].id;
		if (view.openId) offcanvas().hide();
		dialog().show();
	}

	function createPage(event) {
		event.preventDefault();
		const title = newPage.title.value.trim();
		const address = tidyPath(newPage.path.value || title);
		const addressInUse = SITE_PAGES.some((each) => each.path === address);
		newPage.title.classList.toggle('is-invalid', !title);
		newPage.path.classList.toggle('is-invalid', !!title && addressInUse);
		if (!title) {
			newPage.title.focus();
			return;
		}
		if (addressInUse) {
			newPage.path.value = address;
			newPage.path.focus();
			return;
		}

		const pickedLayout = pick('input[name="layout"]:checked', newPageForm)?.value || LAYOUTS[0].id;
		const draft = {
			id: freshId(),
			title,
			path: address,
			section: newPage.section.value,
			layout: pickedLayout,
			status: 'draft',
			owner: newPage.owner.value,
			created: NOW,
			edited: NOW,
			visits: 0,
			seo: { title: `${title} | Fieldline`, desc: '' },
			changes: [[EDITOR_NAME, 'Started the page', NOW]],
		};
		/* New pages join the end of their section, as in the site menu. */
		const lastInSection = SITE_PAGES.map((each) => each.section).lastIndexOf(draft.section);
		SITE_PAGES.splice(lastInSection + 1, 0, draft);
		dialog().hide();
		repaint();
		notify({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'Draft created',
			text: `“${title}” is ready to fill in at ${address}.`,
			actions: [
				{
					label: 'Open',
					ghost: true,
					onClick() {
						window.location.href = editorLink(draft);
					},
				},
			],
		});
	}

	function newPageField(name) {
		return pick(`[data-cp-f="${name}"]`, newPageForm);
	}

	/* Lookups, Bootstrap handles and small formatting helpers. */

	function pageById(id) {
		return SITE_PAGES.find((record) => record.id === id);
	}

	function sectionById(id) {
		return SECTIONS.find((group) => group.id === id) || SECTIONS[0];
	}

	function layoutById(id) {
		return LAYOUTS.find((layout) => layout.id === id) || LAYOUTS[0];
	}

	function liveNow(record) {
		return record.status === 'published';
	}

	function editorLink(record) {
		return `page-editor.html?id=${encodeURIComponent(record.id)}`;
	}

	function freshId() {
		return `pg-${Date.now().toString(36)}`;
	}

	function sectionOptions() {
		return SECTIONS.map(
			(group) => `<option value="${group.id}" data-dot="series-${group.tone}">${group.name}</option>`,
		).join('');
	}

	function drawerSlot(name) {
		return pick(`[data-cp-d="${name}"]`, ui.drawer);
	}

	function offcanvas() {
		return bootstrap.Offcanvas.getOrCreateInstance(ui.drawer);
	}

	function dialog() {
		return bootstrap.Modal.getOrCreateInstance(ui.dialog);
	}

	function chooseOption(select, value) {
		select.value = value;
		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(select);
	}

	function stateTag(status) {
		const { tone, label } = STATUS_LOOK[status];
		return `<span class="basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}">${label}</span>`;
	}

	function avatarSlot(person) {
		return `<span class="basalt-avatar basalt-avatar-xs" aria-hidden="true" data-basalt-avatar data-name="${htmlSafe(person)}"></span>`;
	}

	/* Long addresses may wrap after a slash but never inside a word. */
	function breakablePath(path) {
		return htmlSafe(path).replace(/\//g, '/<wbr>');
	}

	function toSlug(text) {
		return String(text || '')
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/['’`"]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60);
	}

	/* An address is lowercase words joined by hyphens, in one or more parts. */
	function tidyPath(text) {
		return `/${String(text || '')
			.split('/')
			.map(toSlug)
			.filter(Boolean)
			.join('/')}`;
	}

	function calendarDay(iso) {
		return window.Basalt.toLocalDay(iso);
	}

	/* "Oct 8", with the year only when it differs from this one. */
	function shortDay(iso) {
		const date = calendarDay(iso);
		const year = iso.slice(0, 4) === NOW.slice(0, 4) ? '' : `, ${date.getFullYear()}`;
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}${year}`;
	}

	function dayWithWeekday(iso) {
		return `${WEEKDAY_ABBR[calendarDay(iso).getDay()]} ${shortDay(iso)}`;
	}

	function fullDate(iso) {
		const date = calendarDay(iso);
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
	}

	/* "14:30" becomes "2:30 pm"; a missing time reads as 9 am. */
	function clockTime(hhmm) {
		const [hours, minutes] = String(hhmm || '09:00')
			.split(':')
			.map(Number);
		return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'am' : 'pm'}`;
	}

	function withCommas(value) {
		return Number(value || 0).toLocaleString('en-US');
	}

	function counted(value, singular, pluralForm) {
		return `${value} ${value === 1 ? singular : pluralForm || `${singular}s`}`;
	}

	/* Like counted(), but small numbers come out as words: "two pages". */
	function spelledCount(value, singular, pluralForm) {
		return `${NUMBER_WORDS[value] || value} ${value === 1 ? singular : pluralForm || `${singular}s`}`;
	}

	function capitalize(text) {
		return text.replace(/^./, (first) => first.toUpperCase());
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => entities[char]);
	}

	function notify(message) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(message) : null;
	}

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
