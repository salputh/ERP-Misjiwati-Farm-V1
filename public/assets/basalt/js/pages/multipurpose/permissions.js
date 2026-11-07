/**
 * Permissions page (permissions.html), the page that has [data-acl-root].
 *
 * One grid of what every role may do: the resources down the side,
 * grouped the way the sidebar menu is, the roles across the top, and a
 * level in each cell (None, View, Edit or Full). Edits sit in a draft
 * and show in a review bar until someone saves them. With more than one
 * workspace in access.js, permissions.html?set=<id> opens another one,
 * each with its own draft, and
 * ?role=sales&area=crm opens one role on one area, which is how the
 * View as band on the Roles page links here.
 *
 * The roles, groups and saved access come from assets/basalt/js/data/multipurpose/access.js,
 * shared with Roles, Employee Users and Employee User Details. To hook
 * up a server, have server.load() fetch the same shape; the table, the
 * legend, the role filter and the hero figures are all drawn from it.
 * Then fill in the server object, one request per method. A save
 * updates the page first and puts the draft back, with an error toast,
 * if the request fails.
 *
 * On the grid: click a cell or press Enter for its level picker; N, V,
 * E and F set the focused cell outright; Delete returns it to the
 * inherited level; the arrow keys move around. Review opens a side sheet
 * of every change and who it reaches, each one undoable. Save asks for a
 * hold to confirm when a sensitive area gains access. Discard clears the
 * draft, with Undo. Export CSV writes the saved access, one row per
 * resource.
 *
 * Shared parts from basalt.js: toasts with undo, the drawer, the confirm
 * dialog with hold to confirm, the multi-select menu, the styled select,
 * the loading button, skeletons, empty states and the live region.
 */
(() => {
	'use strict';

	const page = pick('[data-acl-root]', document);
	if (!page) return;

	/* The data, from assets/basalt/js/data/multipurpose/access.js. A workspace holds:
     me         the person signed in.
     levels     lowest first; the order is what "more access" means.
     roles      people is how many teammates hold the role. locked fixes
                every cell at Full (the Owner). inherits names the role a
                blank cell falls back to. max caps how high the role goes.
     groups     the sections of the menu, each with its resources; a
                sensitive group or resource asks for a confirm when access
                to it rises, and a group with open set starts unfolded.
     access     the saved level per role and resource. A resource missing
                from a role that inherits shows the parent's level, marked
                as inherited.
     lastSaved  who saved the grid last, and when. */
	const ACCESS = window.Basalt.data.access;
	const WORKSPACES = ACCESS.sets();

	/* The demo's "today"; real data uses the real clock. */
	const NOW = '2026-10-09T15:40:00';

	/* What the address asks for: a workspace, and maybe one role on one
     area, the way the Roles page links here. */
	const ASKED = new URLSearchParams(location.search);

	function workspaceFromUrl() {
		const asked = ASKED.get('set');
		return WORKSPACES.some((workspace) => workspace.id === asked) ? asked : WORKSPACES[0].id;
	}

	/* A demo switch for the other states: permissions.html?state=empty,
     ?state=error (the first load fails and Try again works) or
     ?state=offline (saving fails, so the draft comes back). Drop it once a
     real server is in place. */
	const SCENARIO = new URLSearchParams(location.search).get('state') || '';

	const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	const narrowScreen = window.matchMedia('(max-width: 767.98px)');

	const ui = {
		card: pick('[data-acl-card]', page),
		toolbar: pick('[data-acl-toolbar]', page),
		search: pick('[data-acl-search]', page),
		roleSelect: pick('[data-acl-role-select]', page),
		rolesMenu: pick('[data-acl-roles]', page),
		rolesList: pick('[data-acl-roles-list]', page),
		differSwitch: pick('[data-acl-diff]', page),
		foldButton: pick('[data-acl-fold]', page),
		foldLabel: pick('[data-acl-fold-label]', page),
		skeleton: pick('[data-acl-skeleton]', page),
		notice: pick('[data-acl-note]', page),
		scroller: pick('[data-acl-wrap]', page),
		table: pick('[data-acl-table]', page),
		head: pick('[data-acl-head]', page),
		legend: pick('[data-acl-legend]', page),
		legendLevels: pick('[data-acl-legend-levels]', page),
		reviewBar: pick('[data-acl-review]', page),
		reviewText: pick('[data-acl-review-text]', page),
		picker: pick('[data-acl-menu]', page),
		sheet: pick('#acl-review', page),
		sheetSub: pick('[data-acl-drawer-sub]', page),
		sheetBody: pick('[data-acl-drawer-body]', page),
		confirmDialog: pick('#acl-confirm', page),
		confirmList: pick('[data-acl-confirm-list]', page),
		confirmHold: pick('[data-acl-confirm-hold]', page),
		exportButton: pick('[data-acl-export]', document),
	};

	/* Everything the page knows. onServer and working share one shape:
     role id -> { resource id -> level id }. visibleRoleIds is the Set
     shown on wide screens; phoneRole is the single role shown on phones. */
	const store = {
		set: workspaceFromUrl(),
		stash: {},
		model: null,
		onServer: {},
		working: {},
		search: '',
		differingOnly: false,
		visibleRoleIds: null,
		phoneRole: '',
		folded: new Set(),
		cursor: { res: '', role: '' },
		pickerCell: null,
		saveInFlight: false,
	};

	let loadCount = 0;
	let searchDebounce = 0;

	/* Each method is one request and returns a Promise. The demo answers
     from memory after a short wait; swap the bodies for fetch() calls and
     keep the shapes. */
	const server = {
		/* GET /api/permissions?set=:id -> { me, levels, roles, groups, access, lastSaved } */
		load(setId) {
			loadCount += 1;
			return settleAfter(500).then(() => {
				if (SCENARIO === 'error' && loadCount === 1) throw new Error('The server did not answer');
				const workspace = ACCESS.set(setId);
				const me = workspace.roles.find((role) => role.id === workspace.me.role);
				const payload = {
					id: workspace.id,
					name: workspace.name,
					me: { name: workspace.me.name, role: me ? me.name : workspace.me.role },
					levels: ACCESS.levels,
					roles: workspace.roles,
					groups: workspace.groups,
					access: workspace.access,
					lastSaved: workspace.lastSaved,
				};
				if (SCENARIO === 'empty') Object.assign(payload, { roles: [], groups: [], access: {} });
				return payload;
			});
		},
		/* PATCH /api/permissions with [{ role, resource, level }], where level
       is a level id or null for "back to the inherited level"
       -> { lastSaved: { by, at } } */
		saveChanges(edits) {
			return settleAfter(700).then(() => {
				if (SCENARIO === 'offline') throw new Error('The server did not answer');
				return { count: edits.length, lastSaved: { by: store.model.me.name, at: NOW } };
			});
		},
	};

	/**
	 * Wires the picker, the grid, the review bar and sheet, the export
	 * button and the toolbar, then asks the server for the access data.
	 */
	function start() {
		wirePicker();
		wireGrid();
		wireReview();
		wireSaving();
		wireExport();
		wireToolbar();
		wireWorkspaces();
		fetchAccess();
	}

	function pick(selector, scope) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(text) {
		return String(text ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
	}

	function notify(options) {
		if (!window.Basalt.toasts) return null;
		return window.Basalt.toasts.push(options);
	}

	function announce(text) {
		window.Basalt.announce?.(text);
	}

	function count(total, noun, nouns = `${noun}s`) {
		return `${total} ${total === 1 ? noun : nouns}`;
	}

	function joinNames(names) {
		if (names.length < 2) return names.join('');
		return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
	}

	function settleAfter(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	function deepCopy(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function dayAndMonth(iso) {
		const date = new Date(iso);
		return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
	}

	function onPhone() {
		return narrowScreen.matches;
	}

	/* Lookups into the model. */
	function levelRank(id) {
		return store.model.levels.findIndex((level) => level.id === id);
	}

	function levelById(id) {
		return store.model.levels.find((level) => level.id === id);
	}

	function roleById(id) {
		return store.model.roles.find((role) => role.id === id);
	}

	function everyResource() {
		return store.model.groups.flatMap((group) => group.resources.map((resource) => ({ group, ...resource })));
	}

	function resourceById(id) {
		return everyResource().find((resource) => resource.id === id);
	}

	/**
	 * The level a role ends up with on a resource in the given map, after
	 * following inheritance. A locked role is always at the top level.
	 */
	function levelIn(map, roleId, resourceId) {
		const role = roleById(roleId);
		if (!role) return 'none';
		if (role.locked) return store.model.levels.at(-1).id;
		const own = map[roleId]?.[resourceId];
		if (own) return own;
		return role.inherits ? levelIn(map, role.inherits, resourceId) : 'none';
	}

	function fallsBack(map, roleId, resourceId) {
		const role = roleById(roleId);
		return Boolean(role?.inherits) && !map[roleId]?.[resourceId];
	}

	/* Every edit someone made: a role and resource whose own setting now
     differs from the saved one. */
	function pendingEdits() {
		const edits = [];
		for (const role of store.model.roles) {
			if (role.locked) continue;
			for (const resource of everyResource()) {
				const was = store.onServer[role.id]?.[resource.id] || null;
				const now = store.working[role.id]?.[resource.id] || null;
				if (was === now) continue;
				edits.push({
					role: role.id,
					resource: resource.id,
					level: now,
					from: levelIn(store.onServer, role.id, resource.id),
					to: levelIn(store.working, role.id, resource.id),
				});
			}
		}
		return edits;
	}

	/* Whether a cell moves when the draft is saved, counting cells that
     inherit from a role that was edited. */
	function cellMoves(roleId, resourceId) {
		if (levelIn(store.onServer, roleId, resourceId) !== levelIn(store.working, roleId, resourceId)) return true;
		return (store.onServer[roleId]?.[resourceId] || null) !== (store.working[roleId]?.[resourceId] || null);
	}

	function rolesTouched() {
		return store.model.roles.filter((role) => everyResource().some((resource) => cellMoves(role.id, resource.id)));
	}

	function peopleIn(roles) {
		return roles.reduce((sum, role) => sum + role.people, 0);
	}

	/* Which columns and rows are on screen right now. */
	function rolesOnScreen() {
		if (onPhone()) return store.model.roles.filter((role) => role.id === store.phoneRole);
		return store.model.roles.filter((role) => store.visibleRoleIds.has(role.id));
	}

	function matchesSearch(resource, group) {
		if (!store.search) return true;
		const haystack = `${resource.name} ${resource.desc} ${group.name}`.toLowerCase();
		return haystack.includes(store.search.toLowerCase());
	}

	function levelsVary(resourceId, roles) {
		const levels = roles.map((role) => levelIn(store.working, role.id, resourceId));
		return levels.some((level) => level !== levels[0]);
	}

	function groupsOnScreen() {
		const roles = rolesOnScreen();
		const differing = store.differingOnly && !onPhone();
		return store.model.groups
			.map((group) => ({
				group,
				rows: group.resources.filter(
					(resource) => matchesSearch(resource, group) && (!differing || levelsVary(resource.id, roles)),
				),
			}))
			.filter((entry) => entry.rows.length);
	}

	function rowsOnScreen() {
		return groupsOnScreen().reduce((sum, entry) => sum + entry.rows.length, 0);
	}

	/* Markup for the pieces of the grid. */
	function chipHtml(levelId, modifiers) {
		const level = levelById(levelId);
		const icon = modifiers.includes('is-locked') ? 'bi-lock-fill' : level.icon;
		return `<span class="acl-chip acl-chip-${level.id}${modifiers}"><i class="bi ${icon}" aria-hidden="true"></i>${htmlSafe(level.name)}</span>`;
	}

	function cellSpeech(role, resource) {
		const level = levelById(levelIn(store.working, role.id, resource.id));
		let speech = `${resource.name}, ${role.name}: ${level.name}`;
		if (role.locked) speech += ', locked';
		else if (fallsBack(store.working, role.id, resource.id))
			speech += `, inherited from ${roleById(role.inherits).name}`;
		if (cellMoves(role.id, resource.id))
			speech += `, not saved, was ${levelById(levelIn(store.onServer, role.id, resource.id)).name}`;
		return speech;
	}

	function cellHtml(role, resource) {
		const level = levelIn(store.working, role.id, resource.id);
		const moved = cellMoves(role.id, resource.id);
		let modifiers = '';
		if (role.locked) modifiers += ' is-locked';
		else if (fallsBack(store.working, role.id, resource.id)) modifiers += ' is-inherited';
		if (moved) modifiers += ' is-pending';
		const underCursor = store.cursor.res === resource.id && store.cursor.role === role.id;
		return `<td class="acl-td${moved ? ' is-pending' : ''}"><button type="button" class="acl-cell" data-res="${resource.id}" data-role="${role.id}" tabindex="${underCursor ? '0' : '-1'}" aria-haspopup="menu" aria-expanded="false" aria-label="${htmlSafe(cellSpeech(role, resource))}">${chipHtml(level, modifiers)}</button></td>`;
	}

	function headerCellHtml(role) {
		const peopleText = count(role.people, 'person', 'people');
		/* Name and head count only; what the role inherits is in its tooltip. */
		const why = role.locked
			? 'Locked: always full access'
			: role.inherits
				? `Inherits ${roleById(role.inherits).name}`
				: '';
		const sub = role.locked ? `<i class="bi bi-lock-fill" aria-hidden="true"></i> ${peopleText}` : peopleText;
		return `<th scope="col" class="acl-th${role.locked ? ' acl-th-locked' : ''}"${why ? ` title="${htmlSafe(why)}"` : ''}><span class="acl-th-name">${htmlSafe(role.name)}</span><span class="acl-th-sub">${sub}</span></th>`;
	}

	function groupHeadHtml(group, rows, columns, open, searching) {
		const movedRows = group.resources.filter((resource) =>
			store.model.roles.some((role) => cellMoves(role.id, resource.id)),
		).length;
		const countText =
			rows.length === group.resources.length
				? count(rows.length, 'resource')
				: `${rows.length} of ${group.resources.length}`;
		const movedText = movedRows ? `<span class="acl-group-pending">${count(movedRows, 'row')} changed</span>` : '';
		const flag = group.sensitive ? '<span class="acl-res-flag">Sensitive</span>' : '';
		return `<tr class="acl-group-head"><th scope="colgroup" colspan="${columns}"><button type="button" class="acl-group-btn" data-acl-group="${group.id}" aria-expanded="${open}"${searching ? ' aria-disabled="true"' : ''}><i class="bi bi-chevron-down acl-group-chev" aria-hidden="true"></i><span class="acl-group-icon" aria-hidden="true"><i class="bi ${group.icon}"></i></span><span class="acl-group-name">${htmlSafe(group.name)}</span><span class="acl-group-count">${countText}</span>${flag}${movedText}</button></th></tr>`;
	}

	function resourceRowHtml(resource, roles) {
		const flag = resource.sensitive ? '<span class="acl-res-flag">Sensitive</span>' : '';
		const cells = roles.map((role) => cellHtml(role, resource)).join('');
		return `<tr class="acl-row"><th scope="row" class="acl-res"><span class="acl-res-name">${htmlSafe(resource.name)}${flag}</span><span class="acl-res-desc">${htmlSafe(resource.desc)}</span></th>${cells}</tr>`;
	}

	function emptyStateHtml(spec) {
		const tone = spec.tone ? ` basalt-empty-${spec.tone}` : '';
		const actions = spec.actions ? `<div class="basalt-empty-actions">${spec.actions}</div>` : '';
		return `<div class="basalt-empty basalt-empty-compact${tone}"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi ${spec.icon}"></i></span><h3 class="basalt-empty-title">${spec.title}</h3><p class="basalt-empty-text">${spec.text}</p>${actions}</div>`;
	}

	/**
	 * Redraws the whole grid from the store: the header row, one tbody per
	 * group so a group folds as a unit, the empty notice, the fold button
	 * and the review bar.
	 */
	function paintGrid() {
		const roles = rolesOnScreen();
		const groups = groupsOnScreen();
		const searching = Boolean(store.search);

		ui.head.innerHTML = `<tr><th scope="col" class="acl-th acl-th-res">Resource</th>${roles.map(headerCellHtml).join('')}</tr>`;

		for (const body of pickAll('tbody', ui.table)) body.remove();
		for (const { group, rows } of groups) {
			const open = searching || !store.folded.has(group.id);
			const body = document.createElement('tbody');
			body.className = `acl-group${open ? '' : ' is-collapsed'}`;
			body.dataset.group = group.id;
			body.innerHTML =
				groupHeadHtml(group, rows, roles.length + 1, open, searching) +
				(open ? rows.map((resource) => resourceRowHtml(resource, roles)).join('') : '');
			ui.table.appendChild(body);
		}

		/* Exactly one cell belongs in the tab order. */
		const cells = pickAll('.acl-cell', ui.table);
		if (cells.length && !cells.some((cell) => cell.tabIndex === 0)) cells[0].tabIndex = 0;

		const nothing = !groups.length;
		ui.scroller.hidden = nothing;
		if (nothing) {
			const text = store.search
				? `Nothing matches “${htmlSafe(store.search)}”${store.differingOnly && !onPhone() ? ' among the rows where roles differ.' : '.'}`
				: 'Every role shown has the same access on every resource.';
			showNotice(
				emptyStateHtml({
					icon: 'bi-search',
					title: 'No resources to show',
					text,
					actions:
						'<button type="button" class="btn btn-sm btn-outline-secondary" data-acl-clear>Clear search and filters</button>',
				}),
			);
		} else {
			clearNotice();
		}

		const allFolded = store.model.groups.every((group) => store.folded.has(group.id));
		ui.foldLabel.textContent = allFolded ? 'Expand all' : 'Collapse all';
		pick('i', ui.foldButton).className = `bi ${allFolded ? 'bi-arrows-expand' : 'bi-arrows-collapse'}`;
		ui.foldButton.setAttribute('aria-pressed', String(allFolded));
		ui.foldButton.disabled = searching;

		paintReviewBar();
	}

	function showNotice(html) {
		ui.notice.innerHTML = html;
		ui.notice.hidden = false;
	}

	function clearNotice() {
		ui.notice.hidden = true;
		ui.notice.innerHTML = '';
	}

	function paintReviewBar() {
		const total = pendingEdits().length;
		ui.reviewBar.hidden = !total;
		page.classList.toggle('has-review', total > 0);
		if (!total) return;
		const touched = rolesTouched();
		ui.reviewText.innerHTML = `<strong>${count(total, 'unsaved change')}</strong><span class="acl-review-reach">${count(touched.length, 'role')}, ${count(peopleIn(touched), 'person', 'people')}</span>`;
	}

	function paintFigures() {
		const { roles, lastSaved } = store.model;
		pick('[data-acl-fig="roles"]', page).textContent = roles.length;
		pick('[data-acl-fig="resources"]', page).textContent = everyResource().length;
		pick('[data-acl-fig="saved"]', page).textContent = lastSaved ? dayAndMonth(lastSaved.at) : '-';
		pick('[data-acl-fig="savedBy"]', page).textContent = lastSaved
			? `last saved by ${lastSaved.by}`
			: 'not saved yet';
	}

	function paintLegend() {
		ui.legendLevels.innerHTML = store.model.levels
			.map(
				(level) =>
					`<li><span class="acl-chip acl-chip-${level.id} acl-chip-sample" aria-hidden="true"><i class="bi ${level.icon}"></i>${htmlSafe(level.name)}</span>${htmlSafe(level.text)}</li>`,
			)
			.join('');
		const parentRole = store.model.roles.find((role) =>
			store.model.roles.some((other) => other.inherits === role.id),
		);
		const inheritedItem = pick('.acl-legend-marks li', ui.legend);
		if (inheritedItem && parentRole) inheritedItem.lastChild.textContent = `Inherited from ${parentRole.name}`;
	}

	function paintRoleControls() {
		const { roles } = store.model;
		ui.rolesList.innerHTML = roles
			.map(
				(role) =>
					`<li><label class="dropdown-item basalt-dd-multi-option" for="acl-role-${role.id}"><input class="form-check-input" type="checkbox" id="acl-role-${role.id}" value="${role.id}"${store.visibleRoleIds.has(role.id) ? ' checked' : ''}>${htmlSafe(role.name)}</label></li>`,
			)
			.join('');
		ui.rolesMenu.setAttribute('data-basalt-dd-multi', '');
		window.Basalt.menus?.(ui.rolesMenu.parentElement);
		ui.roleSelect.innerHTML = roles
			.map(
				(role) =>
					`<option value="${role.id}"${role.id === store.phoneRole ? ' selected' : ''}>${htmlSafe(role.name)}</option>`,
			)
			.join('');
		window.Basalt.select?.refresh?.(ui.roleSelect);
	}

	/**
	 * Puts a level on a cell of the draft, or 'inherit' to clear the cell's
	 * own setting. Returns whether anything was set; a role capped below
	 * the level is told so instead.
	 */
	function assignLevel(roleId, resourceId, levelId) {
		const role = roleById(roleId);
		const resource = resourceById(resourceId);
		if (!role || !resource || role.locked) return false;

		if (levelId === 'inherit') {
			if (!role.inherits) return false;
			delete store.working[roleId]?.[resourceId];
		} else {
			if (role.max && levelRank(levelId) > levelRank(role.max)) {
				announce(`${role.name} can’t go above ${levelById(role.max).name}`);
				return false;
			}
			store.working[roleId] ??= {};
			store.working[roleId][resourceId] = levelId;
		}

		paintGrid();
		const landed = levelById(levelIn(store.working, roleId, resourceId)).name;
		const inherited = fallsBack(store.working, roleId, resourceId) ? ', inherited' : '';
		announce(
			`${resource.name} for ${role.name} set to ${landed}${inherited}. ${count(pendingEdits().length, 'unsaved change')}.`,
		);
		return true;
	}

	function restoreSaved(roleId, resourceId) {
		const was = store.onServer[roleId]?.[resourceId];
		store.working[roleId] ??= {};
		if (was) store.working[roleId][resourceId] = was;
		else delete store.working[roleId][resourceId];
		paintGrid();
	}

	/* The level picker: one shared menu, filled for the cell that opened it. */
	function pickerHtml(role, resource) {
		const current = levelIn(store.working, role.id, resource.id);
		const inherited = fallsBack(store.working, role.id, resource.id);
		const parts = [`<p class="acl-menu-head"><span>${htmlSafe(resource.name)}</span>${htmlSafe(role.name)}</p>`];

		if (role.locked) {
			parts.push(
				`<p class="acl-menu-note"><i class="bi bi-lock-fill" aria-hidden="true"></i>${htmlSafe(role.note)}</p>`,
			);
			return parts.join('');
		}

		if (role.inherits) {
			const parent = roleById(role.inherits);
			const parentLevel = levelById(levelIn(store.working, parent.id, resource.id)).name;
			parts.push(
				`<button type="button" class="acl-menu-item" role="menuitemradio" aria-checked="${inherited}" data-level="inherit"><i class="bi bi-arrow-return-right" aria-hidden="true"></i><span class="acl-menu-text">Same as ${htmlSafe(parent.name)}<small>${htmlSafe(parentLevel)} today</small></span><i class="bi bi-check2 acl-menu-tick" aria-hidden="true"></i></button><hr class="acl-menu-rule">`,
			);
		}

		for (const level of store.model.levels) {
			const capped = role.max && levelRank(level.id) > levelRank(role.max);
			const checked = !inherited && level.id === current;
			parts.push(
				`<button type="button" class="acl-menu-item" role="menuitemradio" aria-checked="${checked}" data-level="${level.id}"${capped ? ' aria-disabled="true"' : ''}><i class="bi ${level.icon}" aria-hidden="true"></i><span class="acl-menu-text">${htmlSafe(level.name)}<small>${htmlSafe(level.text)}</small></span><kbd class="acl-menu-key" aria-hidden="true">${level.key.toUpperCase()}</kbd><i class="bi bi-check2 acl-menu-tick" aria-hidden="true"></i></button>`,
			);
		}

		if (role.max)
			parts.push(
				`<p class="acl-menu-note"><i class="bi bi-info-circle" aria-hidden="true"></i>${htmlSafe(role.note)}</p>`,
			);

		const ownSettingMoved =
			(store.onServer[role.id]?.[resource.id] || null) !== (store.working[role.id]?.[resource.id] || null);
		if (cellMoves(role.id, resource.id) && ownSettingMoved) {
			const savedLevel = levelById(levelIn(store.onServer, role.id, resource.id)).name;
			parts.push(
				`<hr class="acl-menu-rule"><button type="button" class="acl-menu-item acl-menu-item-undo" role="menuitem" data-level="revert"><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i><span class="acl-menu-text">Undo this change<small>Back to ${htmlSafe(savedLevel)}</small></span></button>`,
			);
		}
		return parts.join('');
	}

	function openPicker(cell) {
		const { role: roleId, res: resourceId } = cell.dataset;
		const role = roleById(roleId);
		const resource = resourceById(resourceId);
		ui.picker.innerHTML = pickerHtml(role, resource);
		ui.picker.setAttribute('aria-label', `Access to ${resource.name} for ${role.name}`);
		ui.picker.hidden = false;
		store.pickerCell = { res: resourceId, role: roleId };
		cell.setAttribute('aria-expanded', 'true');
		positionPicker(cell);

		const choices = pickerChoices();
		const first = choices.find((item) => item.getAttribute('aria-checked') === 'true') || choices[0];
		if (first) {
			first.focus();
		} else {
			ui.picker.tabIndex = -1;
			ui.picker.focus();
		}
	}

	/* Below the cell when there is room, above it otherwise, and never past
     the right edge of the window. */
	function positionPicker(cell) {
		const box = cell.getBoundingClientRect();
		const menu = ui.picker.getBoundingClientRect();
		const gap = 6;
		let top = box.bottom + gap;
		if (top + menu.height > window.innerHeight - 8) top = Math.max(8, box.top - menu.height - gap);
		let left = box.left;
		if (left + menu.width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - menu.width - 8);
		ui.picker.style.setProperty('--acl-menu-top', `${Math.round(top)}px`);
		ui.picker.style.setProperty('--acl-menu-left', `${Math.round(left)}px`);
	}

	function pickerChoices() {
		return pickAll('.acl-menu-item:not([aria-disabled="true"])', ui.picker);
	}

	function cellFor(target) {
		return target && pick(`.acl-cell[data-res="${target.res}"][data-role="${target.role}"]`, ui.table);
	}

	function closePicker(returnFocus) {
		if (ui.picker.hidden) return;
		ui.picker.hidden = true;
		const cell = cellFor(store.pickerCell);
		store.pickerCell = null;
		if (!cell) return;
		cell.setAttribute('aria-expanded', 'false');
		if (returnFocus) cell.focus();
	}

	function choose(item) {
		if (!item || item.getAttribute('aria-disabled') === 'true' || !store.pickerCell) return;
		const { res: resourceId, role: roleId } = store.pickerCell;
		const levelId = item.dataset.level;
		closePicker(false);
		if (levelId === 'revert') restoreSaved(roleId, resourceId);
		else assignLevel(roleId, resourceId, levelId);
		moveCursor(resourceId, roleId);
	}

	/* Keeps the picker beside its cell while the page or the grid scrolls,
     and closes it once the cell is out of sight. */
	function trackCell() {
		if (ui.picker.hidden || !store.pickerCell) return;
		const cell = cellFor(store.pickerCell);
		const box = cell?.getBoundingClientRect();
		if (!box || box.bottom < 0 || box.top > window.innerHeight) {
			closePicker(false);
			return;
		}
		positionPicker(cell);
	}

	function wirePicker() {
		ui.picker.addEventListener('click', (event) => choose(event.target.closest('.acl-menu-item')));

		ui.picker.addEventListener('keydown', (event) => {
			const choices = pickerChoices();
			const at = choices.indexOf(document.activeElement);
			const { key } = event;

			if (key === 'ArrowDown' || key === 'ArrowUp') {
				event.preventDefault();
				if (!choices.length) return;
				const step = key === 'ArrowDown' ? 1 : -1;
				choices[(at + step + choices.length) % choices.length].focus();
			} else if (key === 'Home' || key === 'End') {
				event.preventDefault();
				if (choices.length) choices[key === 'Home' ? 0 : choices.length - 1].focus();
			} else if (key === 'Escape' || key === 'Tab') {
				event.preventDefault();
				closePicker(true);
			} else if (key.length === 1) {
				const level = store.model.levels.find((candidate) => candidate.key === key.toLowerCase());
				if (!level) return;
				event.preventDefault();
				choose(pick(`.acl-menu-item[data-level="${level.id}"]`, ui.picker));
			}
		});

		document.addEventListener('pointerdown', (event) => {
			if (ui.picker.hidden) return;
			if (ui.picker.contains(event.target) || event.target.closest('.acl-cell')) return;
			closePicker(false);
		});

		window.addEventListener('resize', trackCell);
		ui.scroller.addEventListener('scroll', trackCell, { passive: true });
		window.addEventListener('scroll', trackCell, { passive: true });
	}

	/* Roving focus: one cell in the tab order, the rest reached by arrows. */
	function moveCursor(resourceId, roleId) {
		store.cursor = { res: resourceId, role: roleId };
		const cells = pickAll('.acl-cell', ui.table);
		const target =
			cells.find((cell) => cell.dataset.res === resourceId && cell.dataset.role === roleId) || cells[0];
		for (const cell of cells) cell.tabIndex = cell === target ? 0 : -1;
		target?.focus();
	}

	function wireGrid() {
		ui.table.addEventListener('click', (event) => {
			const groupButton = event.target.closest('[data-acl-group]');
			if (groupButton) {
				if (groupButton.getAttribute('aria-disabled') === 'true') return;
				const id = groupButton.dataset.aclGroup;
				window.Basalt.slide(ui.scroller, () => {
					if (!store.folded.delete(id)) store.folded.add(id);
					paintGrid();
				});
				pick(`[data-acl-group="${id}"]`, ui.table)?.focus();
				return;
			}

			const cell = event.target.closest('.acl-cell');
			if (!cell) return;
			const { res: resourceId, role: roleId } = cell.dataset;
			store.cursor = { res: resourceId, role: roleId };
			for (const other of pickAll('.acl-cell', ui.table)) other.tabIndex = other === cell ? 0 : -1;

			const sameCell =
				store.pickerCell && store.pickerCell.res === resourceId && store.pickerCell.role === roleId;
			if (sameCell) {
				closePicker(true);
			} else {
				closePicker(false);
				openPicker(cell);
			}
		});

		ui.table.addEventListener('keydown', (event) => {
			const cell = event.target.closest('.acl-cell');
			if (!cell) return;
			const { res: resourceId, role: roleId } = cell.dataset;
			const rows = pickAll('tr.acl-row', ui.table).map((row) => pickAll('.acl-cell', row));
			const r = rows.findIndex((row) => row.includes(cell));
			const c = rows[r].indexOf(cell);
			const { key } = event;

			const jumps = {
				ArrowRight: () => rows[r][c + 1],
				ArrowLeft: () => rows[r][c - 1],
				ArrowDown: () => rows[r + 1]?.[c],
				ArrowUp: () => rows[r - 1]?.[c],
				Home: () => (event.ctrlKey ? rows[0][0] : rows[r][0]),
				End: () => (event.ctrlKey ? rows.at(-1)[c] : rows[r].at(-1)),
			};

			if (jumps[key]) {
				const landing = jumps[key]();
				if (landing) {
					event.preventDefault();
					moveCursor(landing.dataset.res, landing.dataset.role);
				}
				return;
			}

			if (key === 'Delete' || key === 'Backspace') {
				event.preventDefault();
				if (assignLevel(roleId, resourceId, 'inherit')) moveCursor(resourceId, roleId);
				return;
			}

			if (key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
			const level = store.model.levels.find((candidate) => candidate.key === key.toLowerCase());
			if (!level) return;
			event.preventDefault();
			const role = roleById(roleId);
			if (role.locked) {
				announce(role.note);
				return;
			}
			if (assignLevel(roleId, resourceId, level.id)) moveCursor(resourceId, roleId);
		});
	}

	/* The review sheet: every pending edit grouped by role, each undoable. */
	function sheetItemHtml(edit, role, followers) {
		const resource = resourceById(edit.resource);
		const inheritedNote = edit.level ? '' : ' (inherited)';
		const flag = resource.sensitive ? '<span class="acl-res-flag">Sensitive</span>' : '';
		const alsoChanges =
			followers.length && edit.from !== edit.to
				? `<span class="acl-change-ripple"><i class="bi bi-arrow-return-right" aria-hidden="true"></i>Also changes ${htmlSafe(joinNames(followers))}, which use this level</span>`
				: '';
		return `<li class="acl-change-item"><div class="acl-change-what"><span class="acl-change-res">${htmlSafe(resource.name)}${flag}</span><span class="acl-change-levels">${chipHtml(edit.from, ' acl-chip-sample')}<i class="bi bi-arrow-right" aria-hidden="true"></i>${chipHtml(edit.to, ' acl-chip-sample')}<span class="visually-hidden">${htmlSafe(levelById(edit.from).name)} to ${htmlSafe(levelById(edit.to).name)}${inheritedNote}</span></span>${alsoChanges}</div><button type="button" class="btn btn-sm btn-outline-secondary" data-acl-revert data-role="${edit.role}" data-res="${edit.resource}" aria-label="Undo ${htmlSafe(resource.name)} for ${htmlSafe(role.name)}">Undo</button></li>`;
	}

	function paintSheet() {
		const edits = pendingEdits();
		const touched = rolesTouched();
		ui.sheetSub.textContent = edits.length
			? `${count(edits.length, 'change')} reaching ${count(peopleIn(touched), 'person', 'people')} in ${count(touched.length, 'role')}.`
			: 'Nothing waiting to be saved.';

		if (!edits.length) {
			ui.sheetBody.innerHTML = emptyStateHtml({
				icon: 'bi-check2-circle',
				title: 'All saved',
				text: 'Every cell matches what your team has right now.',
			});
			return;
		}

		const sections = [];
		for (const role of store.model.roles) {
			const own = edits.filter((edit) => edit.role === role.id);
			if (!own.length) continue;
			const dependents = store.model.roles.filter((other) => other.inherits === role.id);
			const items = own.map((edit) => {
				const followers = dependents
					.filter((other) => fallsBack(store.working, other.id, edit.resource))
					.map((other) => other.name);
				return sheetItemHtml(edit, role, followers);
			});
			sections.push(
				`<section class="acl-change"><h3 class="acl-change-role">${htmlSafe(role.name)}<span>${count(role.people, 'person', 'people')}</span></h3><ul class="acl-change-list">${items.join('')}</ul></section>`,
			);
		}
		ui.sheetBody.innerHTML = sections.join('');
	}

	function hideSheet() {
		const sheet = bootstrap.Offcanvas.getInstance(ui.sheet);
		if (sheet && ui.sheet.classList.contains('show')) sheet.hide();
	}

	function wireReview() {
		ui.sheetBody.addEventListener('click', (event) => {
			const undo = event.target.closest('[data-acl-revert]');
			if (!undo) return;
			const at = pickAll('[data-acl-revert]', ui.sheetBody).indexOf(undo);
			restoreSaved(undo.dataset.role, undo.dataset.res);
			paintSheet();
			announce(`Change undone. ${count(pendingEdits().length, 'unsaved change')} left.`);
			const remaining = pickAll('[data-acl-revert]', ui.sheetBody);
			(remaining[Math.min(at, remaining.length - 1)] || pick('.btn-close', ui.sheet)).focus();
		});

		pick('[data-acl-review-open]', page).addEventListener('click', () => {
			paintSheet();
			bootstrap.Offcanvas.getOrCreateInstance(ui.sheet).show();
		});

		pick('[data-acl-discard]', page).addEventListener('click', () => {
			const kept = deepCopy(store.working);
			const total = pendingEdits().length;
			store.working = deepCopy(store.onServer);
			paintGrid();
			announce(`${count(total, 'change')} discarded`);
			notify({
				tone: 'info',
				icon: 'bi-arrow-counterclockwise',
				title: `${count(total, 'change')} discarded`,
				text: 'The grid is back to the saved access.',
				actions: [
					{
						label: 'Undo',
						onClick() {
							store.working = kept;
							paintGrid();
							announce('Changes back');
						},
					},
				],
			});
			moveCursor(store.cursor.res, store.cursor.role);
		});
	}

	/* Saving. More access on a sensitive resource, for any role including
     the ones that pick it up through inheritance, asks for a hold first. */
	function sensitiveGains() {
		const gains = [];
		for (const resource of everyResource()) {
			if (!resource.sensitive && !resource.group.sensitive) continue;
			for (const role of store.model.roles) {
				const from = levelIn(store.onServer, role.id, resource.id);
				const to = levelIn(store.working, role.id, resource.id);
				if (levelRank(to) > levelRank(from)) gains.push({ role, resource, from, to });
			}
		}
		return gains;
	}

	function beginSave() {
		if (store.saveInFlight || !pendingEdits().length) return;
		const gains = sensitiveGains();
		if (!gains.length) return commit();
		ui.confirmList.innerHTML = gains
			.map(
				(gain) =>
					`<li><i class="bi bi-arrow-up-circle" aria-hidden="true"></i>${htmlSafe(gain.resource.name)} for ${htmlSafe(gain.role.name)}: ${htmlSafe(levelById(gain.from).name)} to ${htmlSafe(levelById(gain.to).name)}</li>`,
			)
			.join('');
		hideSheet();
		bootstrap.Modal.getOrCreateInstance(ui.confirmDialog).show();
	}

	/* Shows the save as done straight away and puts the draft back if the
     server says no. */
	function commit() {
		const edits = pendingEdits();
		if (!edits.length) return;
		store.saveInFlight = true;
		const rollback = { onServer: store.onServer, lastSaved: store.model.lastSaved };
		const touched = rolesTouched();
		const people = peopleIn(touched);
		const changeCount = count(edits.length, 'change');

		store.onServer = deepCopy(store.working);
		store.model.lastSaved = { by: store.model.me.name, at: NOW };
		hideSheet();
		paintGrid();
		paintFigures();
		const progress = notify({ tone: 'loading', title: `Saving ${changeCount}…`, duration: 0 });

		server
			.saveChanges(edits.map(({ role, resource, level }) => ({ role, resource, level })))
			.then((reply) => {
				store.saveInFlight = false;
				store.model.lastSaved = reply.lastSaved;
				paintFigures();
				progress?.dismiss();
				notify({
					tone: 'success',
					icon: 'bi-check2-circle',
					title: `${changeCount} saved`,
					text: `${count(people, 'person', 'people')} in ${joinNames(touched.map((role) => role.name))} get the new access the next time they sign in.`,
				});
				announce(`${changeCount} saved`);
			})
			.catch(() => {
				store.saveInFlight = false;
				store.onServer = rollback.onServer;
				store.model.lastSaved = rollback.lastSaved;
				paintGrid();
				paintFigures();
				progress?.dismiss();
				notify({
					tone: 'danger',
					icon: 'bi-exclamation-octagon',
					title: 'Couldn’t save your changes',
					text: `The server didn’t answer. ${edits.length === 1 ? 'Your change is' : `Your ${edits.length} changes are`} still waiting in the review bar.`,
					duration: 0,
					actions: [
						{
							label: 'Try again',
							onClick() {
								beginSave();
							},
						},
					],
				});
				announce('Saving failed. Your changes are still waiting.');
			});
	}

	function wireSaving() {
		ui.confirmHold.addEventListener('basalt:confirm', () => {
			bootstrap.Modal.getOrCreateInstance(ui.confirmDialog).hide();
			commit();
		});

		for (const button of pickAll('[data-acl-save]', page)) button.addEventListener('click', beginSave);

		window.addEventListener('beforeunload', (event) => {
			if ((!store.model || !pendingEdits().length) && !unsavedElsewhere()) return;
			event.preventDefault();
			event.returnValue = '';
		});
	}

	/* Export: the saved access as CSV, one row per resource. */
	function csvField(value) {
		const text = String(value);
		return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
	}

	function csvText() {
		const { roles, groups } = store.model;
		const rows = [['Area', 'Resource', ...roles.map((role) => role.name)]];
		for (const group of groups) {
			for (const resource of group.resources) {
				rows.push([
					group.name,
					resource.name,
					...roles.map((role) => {
						const name = levelById(levelIn(store.onServer, role.id, resource.id)).name;
						if (role.locked) return `${name} (locked)`;
						return fallsBack(store.onServer, role.id, resource.id) ? `${name} (inherited)` : name;
					}),
				]);
			}
		}
		return `${rows.map((row) => row.map(csvField).join(',')).join('\r\n')}\r\n`;
	}

	function wireExport() {
		ui.exportButton.addEventListener('click', () => {
			if (!store.model || ui.exportButton.getAttribute('aria-busy') === 'true') return;

			function setExportState(stateName, label) {
				window.Basalt.buttonState?.(ui.exportButton, stateName, label);
			}

			setExportState('loading', 'Preparing');
			setTimeout(() => {
				const file = new Blob([csvText()], { type: 'text/csv;charset=utf-8' });
				const link = document.createElement('a');
				link.href = URL.createObjectURL(file);
				link.download = `${store.model.id}-permissions-${NOW.slice(0, 10)}.csv`;
				document.body.appendChild(link);
				link.click();
				link.remove();
				setTimeout(() => URL.revokeObjectURL(link.href), 1000);
				setExportState('success', 'Exported');
				const unsaved = pendingEdits().length;
				notify({
					tone: 'success',
					icon: 'bi-filetype-csv',
					title: 'Permissions exported',
					text: unsaved
						? `The file has the saved access. ${unsaved === 1 ? 'Your unsaved change isn’t' : `Your ${unsaved} unsaved changes aren’t`} in it.`
						: 'One row per resource, one column per role.',
				});
				setTimeout(() => setExportState('idle'), 1800);
			}, 400);
		});
	}

	/* The toolbar: search, the differ switch, the role filters, the fold
     button, and the Clear and Try again buttons inside notices. */
	function resetFilters() {
		ui.search.value = '';
		store.search = '';
		store.differingOnly = false;
		ui.differSwitch.checked = false;
		if (!onPhone()) {
			store.visibleRoleIds = new Set(store.model.roles.map((role) => role.id));
			for (const box of pickAll('input[type="checkbox"]', ui.rolesList)) box.checked = true;
			const allBox = pick('[data-basalt-dd-all]', ui.rolesMenu);
			if (allBox) {
				allBox.checked = true;
				allBox.indeterminate = false;
			}
			const badge = pick('[data-basalt-dd-count]', ui.rolesMenu);
			if (badge) {
				badge.textContent = store.visibleRoleIds.size;
				badge.hidden = false;
			}
		}
		paintGrid();
		ui.search.focus();
	}

	function wireToolbar() {
		ui.search.addEventListener('input', () => {
			clearTimeout(searchDebounce);
			searchDebounce = setTimeout(() => {
				store.search = ui.search.value.trim();
				paintGrid();
				announce(store.search ? `${count(rowsOnScreen(), 'resource')} match` : 'Showing every resource');
			}, 120);
		});
		ui.search.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape' || !ui.search.value) return;
			ui.search.value = '';
			store.search = '';
			paintGrid();
		});

		ui.differSwitch.addEventListener('change', () => {
			store.differingOnly = ui.differSwitch.checked;
			paintGrid();
			announce(
				store.differingOnly
					? `${count(rowsOnScreen(), 'row')} where the roles shown differ`
					: 'Showing every row',
			);
		});

		ui.rolesMenu.addEventListener('basalt:change', (event) => {
			if (!store.model) return;
			store.visibleRoleIds = new Set(event.detail.values);
			paintGrid();
		});

		ui.roleSelect.addEventListener('change', () => {
			store.phoneRole = ui.roleSelect.value;
			paintGrid();
		});

		narrowScreen.addEventListener('change', () => {
			if (!store.model) return;
			closePicker(false);
			paintGrid();
		});

		ui.foldButton.addEventListener('click', () => {
			const allFolded = store.model.groups.every((group) => store.folded.has(group.id));
			window.Basalt.slide(ui.scroller, () => {
				if (allFolded) store.folded.clear();
				else for (const group of store.model.groups) store.folded.add(group.id);
				paintGrid();
			});
			announce(allFolded ? 'Every area expanded' : 'Every area collapsed');
		});

		page.addEventListener('click', (event) => {
			if (event.target.closest('[data-acl-clear]')) resetFilters();
			if (event.target.closest('[data-acl-retry]')) fetchAccess();
		});
	}

	/* Loading: the skeleton shows until the server answers, then either the
     grid, the no-roles notice or the failed-to-load notice. */
	function showBusy(busy) {
		ui.card.setAttribute('aria-busy', String(busy));
		ui.skeleton.hidden = !busy;
	}

	function fetchAccess() {
		showBusy(true);
		clearNotice();
		ui.scroller.hidden = true;
		ui.legend.hidden = true;
		ui.toolbar.hidden = true;
		ui.exportButton.disabled = true;
		page.classList.remove('is-empty');
		ui.reviewBar.hidden = true;
		page.classList.remove('has-review');

		server
			.load(store.set)
			.then((payload) => {
				store.model = payload;
				store.onServer = deepCopy(payload.access);
				store.working = deepCopy(payload.access);
				store.visibleRoleIds = new Set(payload.roles.map((role) => role.id));
				store.folded = new Set(payload.groups.filter((group) => !group.open).map((group) => group.id));
				const firstOpen = payload.roles.find((role) => !role.locked) || payload.roles[0];
				store.phoneRole = firstOpen?.id ?? '';
				store.cursor = { res: '', role: '' };
				takeAsked();
				showWorkspace();
			})
			.catch(() => {
				showBusy(false);
				showNotice(
					'<div class="basalt-empty basalt-empty-framed basalt-empty-danger acl-start"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi bi-cloud-slash"></i></span><h3 class="basalt-empty-title">Permissions didn’t load</h3><p class="basalt-empty-text">The server didn’t answer. Nobody’s access has changed; this page just couldn’t read it.</p><div class="basalt-empty-actions"><button type="button" class="btn btn-sm btn-primary" data-acl-retry><i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Try again</button></div></div>',
				);
				announce('Permissions didn’t load');
			});
	}

	/* A role and area named in the address narrow the first view to that
     one column and that one open group. Used once, on the first load. */
	function takeAsked() {
		const roleId = ASKED.get('role');
		const areaId = ASKED.get('area');
		ASKED.delete('role');
		ASKED.delete('area');
		if (roleId && store.model.roles.some((role) => role.id === roleId)) {
			store.visibleRoleIds = new Set([roleId]);
			store.phoneRole = roleId;
		}
		if (areaId && store.model.groups.some((group) => group.id === areaId)) {
			store.folded = new Set(store.model.groups.filter((group) => group.id !== areaId).map((group) => group.id));
		}
	}

	/* Paints a loaded workspace: the figures, then either the grid with
     its toolbar and legend, or the no-roles notice. */
	function showWorkspace() {
		const payload = store.model;
		showBusy(false);
		paintFigures();

		if (!payload.roles.length || !payload.groups.length) {
			page.classList.add('is-empty');
			showNotice(
				'<div class="basalt-empty basalt-empty-framed acl-start"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi bi-person-badge"></i></span><h3 class="basalt-empty-title">No roles to set access for yet</h3><p class="basalt-empty-text">Access is set per role, not per person. Create a role such as Support agent or Store manager, then choose here what it can see and change.</p><div class="basalt-empty-actions"><a class="btn btn-sm btn-primary" href="roles.html"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Create a role</a></div></div>',
			);
			return;
		}

		ui.exportButton.disabled = false;
		ui.toolbar.hidden = false;
		ui.search.value = store.search;
		ui.differSwitch.checked = store.differingOnly;
		paintRoleControls();
		paintLegend();
		ui.legend.hidden = false;
		paintGrid();
	}

	/* The switch in the header. Each workspace keeps its own draft, so
     moving to another workspace and back loses nothing. */
	function stashWorkspace() {
		store.stash[store.set] = {
			model: store.model,
			onServer: store.onServer,
			working: store.working,
			folded: store.folded,
			visibleRoleIds: store.visibleRoleIds,
			phoneRole: store.phoneRole,
			cursor: store.cursor,
			search: store.search,
			differingOnly: store.differingOnly,
			pending: pendingEdits().length,
		};
	}

	function unsavedElsewhere() {
		return Object.values(store.stash).reduce((sum, kept) => sum + kept.pending, 0);
	}

	function switchWorkspace(id) {
		const workspace = WORKSPACES.find((candidate) => candidate.id === id);
		if (!workspace || id === store.set) return;
		closePicker(false);
		hideSheet();
		if (store.model) stashWorkspace();
		store.set = id;
		store.model = null;
		const url = new URL(location.href);
		if (id === WORKSPACES[0].id) url.searchParams.delete('set');
		else url.searchParams.set('set', id);
		url.searchParams.delete('role');
		url.searchParams.delete('area');
		history.replaceState(null, '', url);
		paintRolesLink();

		const kept = store.stash[id];
		if (kept) {
			delete store.stash[id];
			const { pending, ...fields } = kept;
			Object.assign(store, fields);
			clearNotice();
			showWorkspace();
			if (pending) announce(`${workspace.name} permissions, with ${count(pending, 'unsaved change')}`);
			else announce(`${workspace.name} permissions`);
			return;
		}
		fetchAccess();
		announce(`${workspace.name} permissions`);
	}

	/* The Manage roles link opens the same workspace on the Roles page. */
	function paintRolesLink() {
		const link = pick('[data-acl-roles-link]', page);
		if (!link) return;
		link.href = store.set === WORKSPACES[0].id ? 'roles.html' : `roles.html?set=${encodeURIComponent(store.set)}`;
	}

	function wireWorkspaces() {
		for (const radio of pickAll('[data-acl-set]', page)) {
			radio.checked = radio.value === store.set;
			radio.addEventListener('change', () => {
				if (radio.checked) switchWorkspace(radio.value);
			});
		}
		paintRolesLink();
	}

	start();
})();
