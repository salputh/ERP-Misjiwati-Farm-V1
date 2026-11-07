/**
 * Segments index for segments.html.
 *
 * Every audience a send can target lives in one table, split by kind:
 * rule-driven segments that refresh hourly, hand-kept lists, and
 * suppressions that every send skips no matter what. The three kind
 * tiles above the table act as toggles. The panel button opens a short
 * summary in the side drawer; anything else on a row (or its name, the
 * expand button and the edit links) goes to segment-details.html,
 * where `&edit=rules` or `&edit=members` jumps straight into an editor.
 *
 * Records are read from assets/basalt/js/data/multipurpose/customer-groups.js and
 * assets/basalt/js/data/multipurpose/accounts.js; replace them with your API's payload in
 * the same shape and every figure follows. Spots that need a backend
 * call carry a "Server:" note. Selects, choice cards, avatars, the
 * drawer, two-click confirm, toasts and empty states come from basalt.js.
 */
(() => {
	'use strict';

	const page = pick('[data-cg-root]');
	if (!page) return;

	/* Source records. The data file pins "today" so relative times stay
     stable in the demo; a live app would read the clock instead. */
	const store = window.Basalt.data.customerGroups;
	const ledger = window.Basalt.data.accounts;
	const today = store.now;
	const tests = store.fields;
	const sizeFor = store.estimate;

	const KIND_NAMES = { segment: 'Segment', list: 'List', suppression: 'Suppression' };
	const KIND_ICONS = { segment: 'funnel', list: 'list-check', suppression: 'slash-circle' };
	const SEND_ICONS = {
		Email: 'envelope',
		'Automatic email': 'arrow-repeat',
		Announcement: 'megaphone',
		'Store offer': 'ticket-perforated',
	};
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const PALETTE_SLOTS = 8;
	const RULE_CAP = 5;
	const SORT_KEYS = {
		name: (segment) => segment.name.toLowerCase(),
		members: (segment) => segment.members,
		updated: (segment) => segment.updated,
	};

	/* Accounts keyed by id, reduced to what a member row prints. */
	const customers = Object.fromEntries(
		ledger.list().map((record) => [
			record.id,
			{
				name: record.name,
				place: record.city,
				plan: record.status === 'trial' ? 'Trial' : ledger.plans[record.plan].name,
				seats: record.seats,
				mrr: Math.round(ledger.mrr(record)),
			},
		]),
	);

	/* The working copy this page edits; nothing here writes back. */
	const segments = store
		.list()
		.map((segment) => ({ ...segment, rules: (segment.rules || []).map((rule) => ({ ...rule })) }));
	const view = { kind: 'all', query: '', sortKey: null, direction: 1, openId: null };
	let madeCount = 0;
	let awaitingDelete = null;
	let draftRules = [];

	const tableBody = pick('[data-cg-rows]', page);
	const tableShell = pick('.cg-table-wrap', page);
	const emptySlot = pick('[data-cg-empty]', page);
	const tally = pick('[data-cg-summary]', page);
	const searchBox = pick('[data-cg-search]', page);
	const kindTiles = [...pickAll('[data-cg-kind]', page)];
	const clearKind = pick('[data-cg-showall]', page);
	const panel = document.getElementById('cg-drawer');
	const panelBody = pick('[data-cg-d="body"]', panel);
	const createDialog = document.getElementById('cg-new');
	const deleteDialog = document.getElementById('cg-delete');
	const createForm = pick('[data-cg-new-form]', createDialog);
	const rulesFieldset = pick('[data-cg-new-rules-set]', createForm);
	const rulesSlot = pick('[data-cg-new-rules]', createForm);
	const titleInput = createForm.elements.name;

	function start() {
		wireTable();
		bindFilters();
		wirePanel();
		wireDeleteDialog();
		wireCreateDialog();
		rerender();
	}

	/* Each wire* function hooks one region of the page to its handlers. */

	/* Menu actions on a row run in place; a plain click elsewhere on the
     row navigates (modifier or middle click opens a tab instead). */
	function wireTable() {
		const actions = {
			open: (segment) => showPanel(segment.id),
			duplicate: cloneSegment,
			export: announceExport,
			delete: askRemove,
		};
		tableBody.addEventListener('click', (event) => {
			const trigger = event.target.closest('[data-cg-act]');
			if (!trigger) {
				followRow(event);
				return;
			}
			const owner = segmentById(trigger.closest('[data-cg-id]').getAttribute('data-cg-id'));
			actions[trigger.getAttribute('data-cg-act')]?.(owner);
		});
		tableBody.addEventListener('auxclick', (event) => {
			if (event.button === 1) followRow(event);
		});

		for (const header of pickAll('[data-cg-sort]', page)) {
			header.addEventListener('click', () => {
				const key = header.getAttribute('data-cg-sort');
				if (view.sortKey === key) {
					view.direction = -view.direction;
				} else {
					view.sortKey = key;
					view.direction = key === 'name' ? 1 : -1;
				}
				paintTable();
			});
		}
	}

	function bindFilters() {
		searchBox.addEventListener('input', () => {
			view.query = searchBox.value;
			paintTable();
		});
		for (const tile of kindTiles) {
			tile.addEventListener('click', () => {
				const picked = tile.getAttribute('data-cg-kind');
				pickKind(view.kind === picked ? 'all' : picked);
				paintTable();
			});
		}
		clearKind.addEventListener('click', () => {
			pickKind('all');
			paintTable();
			kindTiles[0].focus();
		});
	}

	/* The drawer's footer buttons act on whichever segment it shows. Delete
     waits for the second click, which basalt.js reports as basalt:confirm. */
	function wirePanel() {
		for (const button of pickAll('[data-cg-d-act]', panel)) {
			const isDelete = button.getAttribute('data-cg-d-act') === 'delete';
			button.addEventListener(isDelete ? 'basalt:confirm' : 'click', () => {
				const shown = segmentById(view.openId);
				if (!shown) return;
				if (isDelete) dropSegment(shown);
				else announceExport(shown);
			});
		}
		panel.addEventListener('hidden.bs.offcanvas', () => {
			view.openId = null;
		});
	}

	function wireDeleteDialog() {
		pick('[data-cg-del-go]', deleteDialog).addEventListener('click', () => {
			const target = awaitingDelete;
			awaitingDelete = null;
			bootstrap.Modal.getOrCreateInstance(deleteDialog).hide();
			if (target && segments.includes(target)) dropSegment(target);
		});
	}

	function wireCreateDialog() {
		pick('[data-cg-swatches]', createForm).innerHTML = Array.from({ length: PALETTE_SLOTS }, (_, slot) => {
			const tone = slot + 1;
			return `<label class="cg-swatch ${toneClass(tone)}"><input type="radio" name="tone" value="${tone}"${slot === 0 ? ' checked' : ''} aria-label="Palette color ${tone}"><span aria-hidden="true"></span></label>`;
		}).join('');

		rulesSlot.setAttribute('data-cg-build-host', '');
		wireRuleEditor();

		createForm.addEventListener('change', (event) => {
			if (event.target.name === 'kind') matchRulesToKind();
		});
		titleInput.addEventListener('input', () => titleInput.classList.remove('is-invalid'));

		pick('[data-cg-new]', page).addEventListener('click', () => {
			createForm.reset();
			titleInput.classList.remove('is-invalid');
			draftRules = [{ field: 'plan', op: 'is', value: 'Pro' }];
			rulesSlot.innerHTML = ruleEditorMarkup(draftRules);
			matchRulesToKind();
			bootstrap.Modal.getOrCreateInstance(createDialog).show();
		});
		createDialog.addEventListener('shown.bs.modal', () => titleInput.focus());
		createForm.addEventListener('submit', submitNewSegment);
	}

	/* The kind tiles and the table repaint together after any change. */

	function rerender(highlightId) {
		paintTiles();
		paintTable(highlightId);
		if (view.openId && !segmentById(view.openId)) hidePanel();
	}

	function paintTiles() {
		const skipped = segments.reduce(
			(sum, segment) => sum + (segment.kind === 'suppression' ? segment.members : 0),
			0,
		);
		pick('[data-cg-held]', page).textContent = countOf(skipped, 'customer');
		for (const badge of pickAll('[data-cg-count]', page)) {
			const kind = badge.getAttribute('data-cg-count');
			badge.textContent = segments.filter((segment) => segment.kind === kind).length;
		}
	}

	/* Only one tile can be pressed; "all" releases every tile. */
	function pickKind(kind) {
		view.kind = kind;
		for (const tile of kindTiles) {
			tile.setAttribute('aria-pressed', String(tile.getAttribute('data-cg-kind') === kind));
		}
		clearKind.hidden = kind === 'all';
	}

	function paintTable(highlightId) {
		const shown = visibleSegments();
		const largest = Math.max(1, ...segments.map((segment) => segment.members));
		tableBody.innerHTML = shown.map((segment) => rowMarkup(segment, largest, segment.id === highlightId)).join('');

		for (const fill of pickAll('[data-cg-share]', tableBody)) {
			fill.style.setProperty('--cg-share', `${fill.getAttribute('data-cg-share')}%`);
		}
		if (window.Basalt.tips) window.Basalt.tips(tableBody);

		const hasRows = shown.length > 0;
		const noun = view.kind === 'all' ? 'segment' : KIND_NAMES[view.kind].toLowerCase();
		tableShell.hidden = !hasRows;
		emptySlot.hidden = hasRows;
		if (!hasRows) emptySlot.innerHTML = emptyMarkup(`${noun}s`);
		tally.textContent = countOf(shown.length, noun);
		paintSortHeaders();
	}

	function emptyMarkup(nounPlural) {
		const query = view.query.trim();
		if (query) return window.Basalt.emptyState({ query, noun: nounPlural });
		return window.Basalt.emptyState({
			icon: 'layers',
			title: `No ${nounPlural} yet`,
			text: 'Make one with New segment.',
		});
	}

	function paintSortHeaders() {
		for (const header of pickAll('[data-cg-th]', page)) {
			const active = view.sortKey === header.getAttribute('data-cg-th');
			const rising = view.direction > 0;
			if (active) header.setAttribute('aria-sort', rising ? 'ascending' : 'descending');
			else header.removeAttribute('aria-sort');
			pick('.bi', header).className = active
				? `bi ${rising ? 'bi-arrow-up' : 'bi-arrow-down'}`
				: 'bi bi-arrow-down-up cg-sort-idle';
		}
	}

	/** Segments that pass the kind tile and the search box, in sort order. */
	function visibleSegments() {
		const query = view.query.trim();
		const matches = segments.filter((segment) => {
			if (view.kind !== 'all' && segment.kind !== view.kind) return false;
			return !query || window.Basalt.matchesQuery(haystack(segment), query);
		});
		const keyOf = SORT_KEYS[view.sortKey];
		if (!keyOf) return matches;
		return [...matches].sort((left, right) => {
			const a = keyOf(left);
			const b = keyOf(right);
			return view.direction * (a < b ? -1 : a > b ? 1 : 0);
		});
	}

	/* The search box looks through names, blurbs, the kind and rule values. */
	function haystack(segment) {
		const ruleWords = (segment.rules || []).map((rule) => {
			const words = describeRule(rule);
			return `${words.field} ${words.value}`;
		});
		return [segment.name, segment.desc, KIND_NAMES[segment.kind], ...ruleWords].join(' ');
	}

	function rowMarkup(segment, largest, isNew) {
		const share = Math.max(2, Math.round((segment.members / largest) * 100));
		const nameCell = `<div class="cg-group">${badgeIcon(segment)}<div class="cg-group-text"><a class="cg-group-name" href="${detailsLink(segment)}">${htmlSafe(segment.name)}</a><span class="cg-group-desc">${htmlSafe(segment.desc)}</span><span class="cg-fold">${kindChip(segment.kind)}<span class="cg-quiet">${countOf(segment.members, 'customer')}</span></span></div></div>`;
		const sizeCell = `<div class="cg-members"><span class="cg-members-n">${formatCount(segment.members)}</span><span class="cg-bar ${toneClass(segment.tone)}" aria-hidden="true"><span data-cg-share="${share}"></span></span></div>`;
		return (
			`<tr data-cg-id="${htmlSafe(segment.id)}" class="cg-row${isNew ? ' is-fresh' : ''}">` +
			`<td class="cg-col-group">${nameCell}</td>` +
			`<td class="cg-col-kind">${kindChip(segment.kind)}</td>` +
			`<td class="cg-col-members">${sizeCell}</td>` +
			`<td class="cg-col-used">${usageCell(segment)}</td>` +
			`<td class="cg-col-updated">${agoText(segment.updated)}</td>` +
			`<td class="cg-col-menu">${rowActions(segment)}</td>` +
			'</tr>'
		);
	}

	function usageCell(segment) {
		if (segment.kind === 'suppression') return '<span class="cg-quiet">Every send</span>';
		const [first, ...rest] = segment.uses;
		if (!first) return '<span class="cg-quiet">Not used yet</span>';
		const extra = rest.length ? `<span class="cg-quiet cg-used-more">and ${rest.length} more</span>` : '';
		return `<span class="cg-used">${htmlSafe(first.name)}</span>${extra}`;
	}

	function rowActions(segment) {
		const label = htmlSafe(segment.name);
		const editItem =
			segment.kind === 'segment'
				? `<a href="${editorLink(segment)}" class="dropdown-item"><i class="bi bi-funnel" aria-hidden="true"></i>Edit rules</a>`
				: `<a href="${editorLink(segment)}" class="dropdown-item"><i class="bi bi-person-plus" aria-hidden="true"></i>Add customers</a>`;
		const quick = `<button type="button" class="btn btn-icon btn-sm" data-cg-act="open" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view" aria-label="Quick view: ${label}"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>`;
		const full = `<a href="${detailsLink(segment)}" class="btn btn-icon btn-sm" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page" aria-label="Open full page: ${label}"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>`;
		const items = [
			`<li>${editItem}</li>`,
			'<li><button type="button" class="dropdown-item" data-cg-act="duplicate"><i class="bi bi-copy" aria-hidden="true"></i>Duplicate</button></li>',
			'<li><button type="button" class="dropdown-item" data-cg-act="export"><i class="bi bi-download" aria-hidden="true"></i>Export members</button></li>',
			'<li><hr class="dropdown-divider"></li>',
			'<li><button type="button" class="dropdown-item cg-danger-item" data-cg-act="delete"><i class="bi bi-trash3" aria-hidden="true"></i>Delete</button></li>',
		].join('');
		const toggle = `<button type="button" class="btn btn-icon cg-menu" aria-label="More actions for ${label}" aria-expanded="false" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}'><i class="bi bi-three-dots" aria-hidden="true"></i></button>`;
		return `<span class="basalt-row-actions">${quick}${full}</span><div class="dropdown">${toggle}<ul class="dropdown-menu dropdown-menu-end">${items}</ul></div>`;
	}

	/* Rows of segments created here have no page yet, so a plain click shows
     the drawer for them instead of navigating. */
	function followRow(event) {
		const row = event.target.closest('[data-cg-id]');
		if (!row || event.target.closest('.dropdown, a, button')) return;
		const segment = segmentById(row.getAttribute('data-cg-id'));
		if (!store.find(segment.id)) {
			if (event.button === 0) showPanel(segment.id);
			return;
		}
		const wantsTab = event.metaKey || event.ctrlKey || event.button === 1;
		if (wantsTab) window.open(detailsLink(segment), '_blank', 'noopener');
		else location.href = detailsLink(segment);
	}

	/* The side drawer is a read-only summary of one segment. */

	function offcanvas() {
		return bootstrap.Offcanvas.getOrCreateInstance(panel);
	}

	function showPanel(id) {
		if (!segmentById(id)) return;
		view.openId = id;
		paintPanel();
		offcanvas().show();
	}

	function hidePanel() {
		view.openId = null;
		offcanvas().hide();
	}

	function paintPanel() {
		const segment = segmentById(view.openId);
		if (!segment) return;
		const icon = pick('[data-cg-d="icon"]', panel);
		icon.className = `cg-icon cg-icon-lg ${toneClass(segment.tone)}`;
		icon.innerHTML = `<i class="bi bi-${htmlSafe(segment.icon)}"></i>`;
		pick('[data-cg-d="name"]', panel).textContent = segment.name;
		pick('[data-cg-d="page"]', panel).href = detailsLink(segment);
		pick('[data-cg-d="sub"]', panel).innerHTML = `${kindChip(segment.kind)}<span>${htmlSafe(segment.desc)}</span>`;
		panelBody.innerHTML = [membershipSection, sampleSection, usageSection]
			.map((section) => section(segment))
			.join('');
		for (const avatar of pickAll('[data-basalt-avatar]', panelBody)) {
			if (window.Basalt.avatar) window.Basalt.avatar(avatar);
		}
	}

	/* How a customer ends up in the segment, with the matching edit link. */
	function membershipSection(segment) {
		const ruled = segment.kind === 'segment';
		const intro = {
			segment: () =>
				`<p class="cg-d-text">Updates itself every hour. Last updated ${agoText(segment.updated).toLowerCase()}.</p>${rulesReadout(segment.rules)}`,
			suppression: () =>
				`<p class="cg-d-text">Every send skips these customers, even when another segment includes them. Invoices and other service emails still go out.</p><p class="cg-d-text cg-d-text-quiet">${htmlSafe(segment.how)}</p>`,
			list: () =>
				`<p class="cg-d-text">A fixed list: customers stay until someone removes them.</p><p class="cg-d-text cg-d-text-quiet">${htmlSafe(segment.how)}</p>`,
		}[segment.kind]();
		const editButton = `<a href="${editorLink(segment)}" class="btn btn-sm btn-outline-secondary"><i class="bi bi-${ruled ? 'pencil' : 'person-plus'} me-1" aria-hidden="true"></i>${ruled ? 'Edit rules' : 'Add customers'}</a>`;
		return `<section class="basalt-drawer-section" aria-labelledby="cg-d-who"><div class="cg-d-head"><h3 class="basalt-drawer-legend" id="cg-d-who">Who is in it</h3>${editButton}</div>${intro}</section>`;
	}

	function rulesReadout(rules) {
		const lines = rules.map((rule, index) => {
			const words = describeRule(rule);
			return `<li><span class="cg-rules-join">${index ? 'and' : 'Where'}</span><span class="cg-rules-what"><strong>${htmlSafe(words.field)}</strong> ${htmlSafe(words.op)} <strong>${htmlSafe(words.value)}</strong></span></li>`;
		});
		return `<ol class="cg-rules">${lines.join('')}</ol>`;
	}

	/* Up to five members, then a pointer to the rest. */
	function sampleSection(segment) {
		const preview = segment.sample.slice(0, 5);
		let lead = 'No customers yet.';
		if (segment.members) {
			lead =
				segment.mrr === null
					? `${countOf(segment.members, 'customer')}, all on a free trial.`
					: `${countOf(segment.members, 'customer')} paying ${dollars(segment.mrr)} a month.`;
		}
		const items = preview
			.map(([id, note]) => {
				const who = customers[id];
				return `<li class="cg-mem"><span class="basalt-avatar basalt-avatar-sm" aria-hidden="true" data-basalt-avatar data-name="${htmlSafe(who.name)}"></span><div class="cg-mem-who"><a href="company-details.html?id=${encodeURIComponent(id)}" class="cg-mem-name">${htmlSafe(who.name)}</a><span class="cg-mem-sub">${htmlSafe(who.plan)} · ${countOf(who.seats, 'seat')} · ${htmlSafe(who.place)}</span></div><span class="cg-mem-fact">${htmlSafe(note || billingNote(id))}</span></li>`;
			})
			.join('');
		const remaining = segment.members - preview.length;
		const tail =
			remaining > 0
				? `<span>and ${countOf(remaining, 'more customer')}</span>`
				: '<span>That is everyone.</span>';
		const footer = segment.members
			? `<p class="cg-mems-more">${tail}<a href="companies.html?stage=customer">Open in Companies<i class="bi bi-arrow-right ms-1" aria-hidden="true"></i></a></p>`
			: '';
		return `<section class="basalt-drawer-section" aria-labelledby="cg-d-members"><h3 class="basalt-drawer-legend" id="cg-d-members">Members</h3><p class="cg-d-text">${lead}</p>${items ? `<ul class="cg-mems">${items}</ul>` : ''}${footer}</section>`;
	}

	function usageSection(segment) {
		let content = `<ul class="cg-uses">${segment.uses.map(usageItem).join('')}</ul>`;
		if (segment.kind === 'suppression') {
			content =
				'<p class="cg-d-text">Every campaign, announcement and offer. A suppression is never picked; it always applies.</p>';
		} else if (!segment.uses.length) {
			content =
				'<p class="cg-d-text">No send uses this segment yet. Pick it as the audience when you write one.</p>';
		}
		return `<section class="basalt-drawer-section" aria-labelledby="cg-d-uses"><h3 class="basalt-drawer-legend" id="cg-d-uses">Used by</h3>${content}</section>`;
	}

	function usageItem(send) {
		const tone = send.tone ? ` basalt-status-${send.tone}` : '';
		return `<li class="cg-use"><span class="cg-use-icon" aria-hidden="true"><i class="bi bi-${SEND_ICONS[send.type] || 'send'}"></i></span><div class="cg-use-text"><a href="${htmlSafe(send.href)}" class="cg-use-name">${htmlSafe(send.name)}</a><span class="cg-mem-sub">${htmlSafe(send.type)}</span></div><span class="basalt-status${tone}">${htmlSafe(send.status)}</span></li>`;
	}

	function billingNote(id) {
		const who = customers[id];
		return who.plan === 'Trial' ? 'On trial' : `${dollars(who.mrr)}/mo`;
	}

	/* Copy, export and delete, reachable from a row menu or the drawer. */

	function cloneSegment(source) {
		madeCount += 1;
		const title = source.name.length > 32 ? `${source.name.slice(0, 32).trim()} copy` : `${source.name} copy`;
		const twin = {
			...source,
			id: `${source.id}-copy-${madeCount}`,
			name: title,
			rules: (source.rules || []).map((rule) => ({ ...rule })),
			sample: [...source.sample],
			uses: [],
			updated: isoMinute(today),
		};
		segments.splice(segments.indexOf(source) + 1, 0, twin);
		rerender(twin.id);
		notify({
			tone: 'success',
			icon: 'bi-copy',
			title: 'Segment duplicated',
			text: `${twin.name} has the same ${source.kind === 'segment' ? 'rules' : 'members'}. No send uses it yet.`,
		});
	}

	function announceExport(segment) {
		/* Server: ask for the CSV file at this point. */
		notify({
			tone: 'info',
			icon: 'bi-download',
			title: 'Export started',
			text: `${countOf(segment.members, 'customer')} from ${segment.name}, as a CSV. It downloads in a moment.`,
		});
	}

	function askRemove(segment) {
		awaitingDelete = segment;
		pick('[data-cg-del-sub]', deleteDialog).textContent = segment.name;
		pick('[data-cg-del-text]', deleteDialog).textContent = deleteConsequence(segment);
		bootstrap.Modal.getOrCreateInstance(deleteDialog).show();
	}

	/* Removes the segment and offers an undo that puts it back in place. */
	function dropSegment(segment) {
		const position = segments.indexOf(segment);
		segments.splice(position, 1);
		if (view.openId === segment.id) hidePanel();
		rerender();
		notify({
			tone: 'success',
			icon: 'bi-trash3',
			title: 'Segment deleted',
			text: `${segment.name} is gone. Its customers are unchanged.`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						segments.splice(position, 0, segment);
						rerender(segment.id);
					},
				},
			],
		});
	}

	function deleteConsequence(segment) {
		const people = countOf(segment.members, 'customer');
		if (segment.kind === 'suppression')
			return `Its ${people} will start getting campaigns, announcements and offers again.`;
		const { uses } = segment;
		if (!uses.length) return `No send uses it, so nothing else changes. The ${people} stay in your customer list.`;
		const verb = uses.length > 1 ? 'use' : 'uses';
		return `${uses.map((send) => send.name).join(' and ')} ${verb} this segment, and will stop reaching its ${people}. The customers themselves stay.`;
	}

	/* Creating a segment: validation first, then a record built from the form. */

	function matchRulesToKind() {
		rulesFieldset.hidden = createForm.elements.kind.value !== 'segment';
	}

	function submitNewSegment(event) {
		event.preventDefault();
		const title = titleInput.value.trim();
		const kind = createForm.elements.kind.value;
		const isRuled = kind === 'segment';
		const duplicate = segments.some((segment) => segment.name.toLowerCase() === title.toLowerCase());
		const nameProblem = !title || duplicate;

		pick('[data-cg-name-error]', createForm).textContent = title
			? 'There is already a segment with this name.'
			: 'Give the segment a name.';
		titleInput.classList.toggle('is-invalid', nameProblem);
		let firstProblem = nameProblem ? titleInput : null;
		if (isRuled) {
			const editor = pick('[data-cg-build]', rulesSlot);
			draftRules = collectRules(editor);
			const badRule = markBadRules(editor, draftRules);
			firstProblem = firstProblem || badRule;
		}
		if (firstProblem) {
			firstProblem.focus();
			return;
		}

		const planRule = isRuled && draftRules.find((rule) => rule.field === 'plan' && rule.op === 'is');
		const sample = isRuled
			? Object.keys(customers)
					.filter((id) => !planRule || customers[id].plan === planRule.value)
					.slice(0, 5)
					.map((id) => [id])
			: [];
		const members = isRuled ? sizeFor(draftRules, null) : 0;
		const averageMrr = sample.length ? sample.reduce((sum, [id]) => sum + customers[id].mrr, 0) / sample.length : 0;
		const fallbackBlurb = {
			segment: 'Customers that match its rules',
			list: 'Customers added by hand',
			suppression: 'Customers every send leaves out',
		}[kind];

		madeCount += 1;
		/* Server: create the record and adopt the id it hands back. */
		const created = {
			id: `new-${madeCount}`,
			kind,
			name: title,
			tone: Number(createForm.elements.tone.value),
			icon: KIND_ICONS[kind],
			desc: createForm.elements.desc.value.trim() || fallbackBlurb,
			members,
			mrr: planRule && planRule.value === 'Trial' ? null : Math.round((members * averageMrr) / 100) * 100,
			updated: isoMinute(today),
			rules: isRuled ? draftRules : [],
			sample,
			uses: [],
			how: 'Made by John Armstrong today.',
		};
		segments.unshift(created);
		if (view.kind !== 'all' && view.kind !== kind) pickKind('all');
		bootstrap.Modal.getOrCreateInstance(createDialog).hide();
		rerender(created.id);
		notify({
			tone: 'success',
			icon: 'bi-layers',
			title: 'Segment created',
			text: isRuled
				? `${title} starts with about ${countOf(members, 'customer')}.`
				: `${title} is ready for customers.`,
			actions: [{ label: 'Quick view', onClick: () => showPanel(created.id) }],
		});
	}

	/* The rule editor redraws as a whole whenever its row count or a field changes. */

	function wireRuleEditor() {
		rulesSlot.addEventListener('change', (event) => {
			const editor = event.target.closest('[data-cg-build]');
			if (!editor) return;
			const rules = collectRules(editor);
			if (event.target.getAttribute('data-cg-rule') === 'field') {
				const index = Number(event.target.closest('[data-cg-rule-index]').getAttribute('data-cg-rule-index'));
				rules[index] = freshRule(rules[index].field);
				draftRules = rules;
				rulesSlot.innerHTML = ruleEditorMarkup(rules);
				return;
			}
			draftRules = rules;
			markBadRules(editor, rules);
			refreshEstimate(rules);
		});

		rulesSlot.addEventListener('input', (event) => {
			const editor = event.target.closest('[data-cg-build]');
			if (!editor || event.target.tagName !== 'INPUT') return;
			const rules = collectRules(editor);
			draftRules = rules;
			if (event.target.classList.contains('is-invalid')) markBadRules(editor, rules);
			refreshEstimate(rules);
		});

		rulesSlot.addEventListener('click', (event) => {
			const adder = event.target.closest('[data-cg-rule-add]');
			const remover = event.target.closest('[data-cg-rule-remove]');
			if (!adder && !remover) return;
			const rules = collectRules(pick('[data-cg-build]', rulesSlot));
			if (adder) rules.push({ field: 'seats', op: 'at least', value: '10' });
			else rules.splice(Number(remover.closest('[data-cg-rule-index]').getAttribute('data-cg-rule-index')), 1);
			draftRules = rules;
			rulesSlot.innerHTML = ruleEditorMarkup(rules);
			if (adder) {
				const newest = [...pickAll('.cg-build-row', rulesSlot)].pop();
				if (newest) focusSelect(pick('[data-cg-rule="field"]', newest));
			} else {
				(pick('[data-cg-rule-add]', rulesSlot) || rulesSlot).focus();
			}
		});
	}

	/** A rule reset to the first comparison and a default value for its field. */
	function freshRule(field) {
		const spec = tests[field];
		return { field, op: spec.ops[0], value: spec.values ? spec.values[0] : '10' };
	}

	function ruleEditorMarkup(rules) {
		const addControl =
			rules.length < RULE_CAP
				? '<button type="button" class="btn btn-sm btn-outline-secondary" data-cg-rule-add><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add a rule</button>'
				: '<span class="cg-quiet">Five rules at most.</span>';
		const estimate = `<p class="cg-estimate" aria-live="polite"><i class="bi bi-people" aria-hidden="true"></i>About <strong>${formatCount(sizeFor(rules, null))}</strong> customers match today</p>`;
		return `<ol class="cg-build" data-cg-build="cgn">${rules.map(ruleRowMarkup).join('')}</ol><div class="cg-build-foot">${addControl}${estimate}</div>`;
	}

	/** One editable rule: field, comparison and value, plus its error line. */
	function ruleRowMarkup(rule, index) {
		const spec = tests[rule.field];
		const ordinal = index + 1;
		const stem = `cgn-${index}`;
		const choice = (value, label, picked) =>
			`<option${value === null ? '' : ` value="${value}"`}${picked ? ' selected' : ''}>${htmlSafe(label)}</option>`;
		const fieldPicker = `<select id="${stem}-f" class="form-select" data-cg-rule="field" aria-label="Rule ${ordinal}: what to test">${Object.entries(
			tests,
		)
			.map(([key, field]) => choice(key, field.label, key === rule.field))
			.join('')}</select>`;
		const opPicker = `<select class="form-select" data-cg-rule="op" aria-label="Rule ${ordinal}: how to compare">${spec.ops.map((op) => choice(null, op, op === rule.op)).join('')}</select>`;
		const valueControl = spec.values
			? `<select class="form-select" data-cg-rule="value" aria-label="Rule ${ordinal}: value">${spec.values.map((value) => choice(null, value, value === rule.value)).join('')}</select>`
			: `<div class="cg-num"><input type="text" class="form-control" inputmode="numeric" data-cg-rule="value" value="${htmlSafe(rule.value)}" aria-label="Rule ${ordinal}: number" aria-describedby="${stem}-err">${spec.unit ? `<span class="cg-num-unit">${htmlSafe(spec.unit)}</span>` : ''}</div>`;
		const hint = `Enter a whole number${spec.max ? ` up to ${spec.max}` : ''}.`;
		return `<li class="cg-build-row" data-cg-rule-index="${index}"><span class="cg-rules-join">${index ? 'and' : 'Where'}</span><div class="cg-build-fields">${fieldPicker}${opPicker}${valueControl}</div><button type="button" class="btn btn-icon cg-build-remove" aria-label="Remove rule ${ordinal}" data-cg-rule-remove><i class="bi bi-x-lg" aria-hidden="true"></i></button><p id="${stem}-err" class="cg-build-error" hidden>${hint}</p></li>`;
	}

	function collectRules(editor) {
		return [...pickAll('.cg-build-row', editor)].map((row) => ({
			field: pick('[data-cg-rule="field"]', row).value,
			op: pick('[data-cg-rule="op"]', row).value,
			value: pick('[data-cg-rule="value"]', row).value.trim(),
		}));
	}

	/** Flags rows whose number is not usable; returns the first bad input. */
	function markBadRules(editor, rules) {
		let firstBad = null;
		const rows = [...pickAll('.cg-build-row', editor)];
		for (const [index, row] of rows.entries()) {
			const fine = ruleIsUsable(rules[index]);
			const input = pick('input[data-cg-rule="value"]', row);
			input?.classList.toggle('is-invalid', !fine);
			pick('.cg-build-error', row).hidden = fine;
			if (!fine && !firstBad) firstBad = input;
		}
		return firstBad;
	}

	function ruleIsUsable(rule) {
		const spec = tests[rule.field];
		if (spec.values) return true;
		const amount = Number(rule.value);
		const wholeNumber = /^\d+$/.test(String(rule.value).trim());
		return wholeNumber && amount >= 0 && (!spec.max || amount <= spec.max);
	}

	function refreshEstimate(rules) {
		const figure = pick('.cg-estimate strong', rulesSlot);
		if (!figure) return;
		figure.textContent = rules.every(ruleIsUsable) ? formatCount(sizeFor(rules, null)) : '…';
	}

	/* basalt.js swaps each select for a styled button placed beside it, so
     focus has to go to that button once it exists. */
	function focusSelect(select) {
		if (!select) return;
		setTimeout(() => {
			const styled = [select.previousElementSibling, select.nextElementSibling].find((node) =>
				node?.classList.contains('basalt-select-trigger'),
			);
			(styled || select).focus();
		}, 0);
	}

	/* Formatting and lookup helpers used across the sections above. */

	function segmentById(id) {
		return segments.find((segment) => segment.id === id);
	}

	/** Link to a segment's page. Ones made here fall back to the first sample. */
	function detailsLink(segment, editor) {
		const target = store.find(segment.id) ? segment.id : store.list()[0].id;
		const suffix = editor ? `&edit=${editor}` : '';
		return `segment-details.html?id=${encodeURIComponent(target)}${suffix}`;
	}

	/* Segments edit their rules; lists and suppressions edit their people. */
	function editorLink(segment) {
		return detailsLink(segment, segment.kind === 'segment' ? 'rules' : 'members');
	}

	function describeRule(rule) {
		const spec = tests[rule.field];
		return { field: spec.label, op: rule.op, value: `${rule.value}${spec.unit ? ` ${spec.unit}` : ''}` };
	}

	function toneClass(tone) {
		return `cg-tone-${tone}`;
	}

	function badgeIcon(segment) {
		return `<span class="cg-icon ${toneClass(segment.tone)}" aria-hidden="true"><i class="bi bi-${htmlSafe(segment.icon)}"></i></span>`;
	}

	function kindChip(kind) {
		return `<span class="basalt-status basalt-status-dot cg-kind-${kind}">${KIND_NAMES[kind]}</span>`;
	}

	/** "Just now", "12 min ago", "3 h ago", "Yesterday" or "Sep 12". */
	function agoText(iso) {
		const moment = new Date(iso);
		const minutes = Math.max(0, Math.round((today - moment) / 60000));
		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes} min ago`;
		if (minutes < 1440 && moment.getDate() === today.getDate()) return `${Math.round(minutes / 60)} h ago`;
		const dayBefore = new Date(today);
		dayBefore.setDate(dayBefore.getDate() - 1);
		if (moment.toDateString() === dayBefore.toDateString()) return 'Yesterday';
		return `${MONTH_ABBR[moment.getMonth()]} ${moment.getDate()}`;
	}

	function isoMinute(date) {
		const two = (value) => String(value).padStart(2, '0');
		const day = [date.getFullYear(), two(date.getMonth() + 1), two(date.getDate())].join('-');
		return `${day}T${two(date.getHours())}:${two(date.getMinutes())}`;
	}

	function formatCount(value) {
		return value.toLocaleString('en-US');
	}

	function dollars(value) {
		return `$${formatCount(value)}`;
	}

	function countOf(value, singular) {
		return `${formatCount(value)} ${value === 1 ? singular : `${singular}s`}`;
	}

	function htmlSafe(text) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(text).replace(/[&<>"']/g, (character) => entities[character]);
	}

	function notify(options) {
		return window.Basalt.toasts?.push(options);
	}

	start();

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
