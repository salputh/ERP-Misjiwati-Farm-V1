/**
 * Basalt - Roles (roles.html)
 * One table, one row per role. Select a role's name or description to
 * change it in place. Edit access opens a row underneath with one
 * switch per area, a line saying what the save will change, and Save
 * and Cancel. New role adds an unsaved row at the top, Duplicate adds
 * a copy under the original, and Delete asks where the role's people
 * go first. Every save can be undone from its toast.
 *
 * Above the table, View as shows which sections of the menu a role can
 * open, each one tinted by the most it may do there, and follows the
 * access row while it is being edited. With more than one workspace
 * in access.js, roles.html?set=<id> opens another one.
 *
 * The roles, the areas and who holds what come from
 * assets/basalt/js/data/multipurpose/access.js, shared with Permissions, Employee Users and
 * Employee User Details. An area here is one group of the sidebar; a
 * level set on it covers every resource in that group, and the
 * Permissions page is where single resources are set apart.
 *
 * To use your own roles:
 *   1. Point access.js at what your backend returns, or have api.load()
 *      fetch it. Every row and count is drawn from it.
 *   2. Fill in the api object. Each method is where one action reaches
 *      the server. The page changes itself first and puts things back,
 *      with an error toast, if a call fails.
 * Demo switches: ?state=empty (no roles of your own yet),
 * ?state=error (the first load fails, Try again works) and
 * ?state=offline (every save fails, so you can watch the rollback).
 */
(() => {
	'use strict';
	const root = pick('[data-rl-root]');
	if (!root) return;

	/* DATA
	   Everything the page shows comes from assets/basalt/js/data/multipurpose/access.js. The
	   page keeps its own shape of it: levels lowest first, one area per
	   sidebar group with the warning it carries, roles with one level
	   per area, and the people who hold each role. */
	const ACCESS = window.Basalt.data.access;
	const WORKSPACES = ACCESS.sets();
	const LEVEL_IDS = ACCESS.levels.map((L) => L.id);

	function start() {
		load();
	}

	/* Which workspace the page opens on: ?set=<id>, else the first. */
	function workspaceFromUrl() {
		const asked = new URLSearchParams(location.search).get('set');
		return WORKSPACES.some((w) => w.id === asked) ? asked : WORKSPACES[0].id;
	}

	function dataFor(setId) {
		const ws = ACCESS.set(setId);
		const areas = ws.groups.map((g) => ({
			id: g.id,
			name: g.name,
			icon: g.icon,
			total: g.resources.length,
			risky: g.risk ? { from: ACCESS.levelRank(g.risk.from), why: g.risk.why } : null,
		}));
		return {
			id: ws.id,
			name: ws.name,
			fallbackRole: 'readonly',
			levels: ACCESS.levels.map((L) => ({ name: L.long, short: L.rank ? L.name : '' })),
			areas,
			/* levels: one per area, in the order above. reach: how many of
			   the area's resources the role can open, since the Permissions
			   page may have set some apart. */
			roles: ws.roles.map((r) => ({
				id: r.id,
				name: r.name,
				builtin: !!r.builtin,
				locked: !!r.locked,
				desc: r.about,
				people: r.people,
				levels: areas.map((a) => ACCESS.areaLevel(ws, ws.access, r.id, a.id)),
				reach: ws.groups.map(
					(g) =>
						g.resources.filter((res) => ACCESS.levelRank(ACCESS.levelOf(ws, ws.access, r.id, res.id)) > 0)
							.length,
				),
			})),
			/* [id, name, team, region, role id]. Everyone has exactly one role. */
			people:
				ws.id === 'general' ? ACCESS.people(ws.id).map((p) => [p.id, p.name, p.team, p.region, p.role]) : [],
		};
	}

	/* API
	   One function per action. In the demo they resolve after a short
	   wait. Swap each body for a fetch() and keep the return shape. */
	const demoState = new URLSearchParams(location.search).get('state');

	function wait(ms, value) {
		return new Promise((resolve) => setTimeout(() => resolve(value), ms));
	}

	let failNextLoad = demoState === 'error';

	/* ?state=offline: every save fails, so the rollback can be seen. */
	function save(ms) {
		return demoState === 'offline'
			? wait(ms + 250).then(() => {
					throw new Error('offline');
				})
			: wait(ms);
	}

	const api = {
		/* GET /api/roles: roles, access levels and the people in each */
		load() {
			if (failNextLoad) {
				failNextLoad = false;
				return wait(700).then(() => {
					throw new Error('The server did not answer');
				});
			}
			const data = dataFor(state.set);
			if (demoState === 'empty') {
				data.roles = data.roles.filter((r) => r.builtin);
				data.people.forEach((p) => {
					if (!data.roles.some((r) => r.id === p[4])) p[4] = data.fallbackRole;
				});
			}
			return wait(450, data);
		},
		createRole(role) {
			return save(450);
		} /* POST /api/roles { name, desc, permissions } */,
		updateRole(id, changes) {
			return save(400);
		} /* PATCH /api/roles/:id { name, desc, permissions } */,
		deleteRole(id, moveTo) {
			return save(400);
		} /* DELETE /api/roles/:id?moveTo=:roleId (moves its people first) */,
		restoreRole(role, people) {
			return save(300);
		} /* POST /api/roles/:id/restore (undo a delete) */,
		setMemberRole(personId, roleId) {
			return save(300);
		} /* PATCH /api/users/:id { role } (for a single move, on the Users page) */,
	};

	/* Helpers */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(s) {
		return String(s == null ? '' : s).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function announce(t) {
		if (window.Basalt.announce) window.Basalt.announce(t);
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many || `${one}s`}`;
	}

	/* "A, B and C". A comma goes before the last "and" when a name has its
     own "and" in it, as in "Billing and invoices, and Users". */
	function listText(arr) {
		return arr.length < 2
			? arr.join('')
			: arr.slice(0, -1).join(', ') +
					(arr.some((x) => x.includes(' and ')) ? ', and ' : ' and ') +
					arr[arr.length - 1];
	}

	function copy(o) {
		return JSON.parse(JSON.stringify(o));
	}

	const NEW = '__new';

	/* State */
	let D = null;
	const state = {
		set: workspaceFromUrl() /* which workspace is shown */,
		loading: true,
		error: false,
		roles: [],
		people: [],
		open: null /* id of the role whose access row is open (NEW for the unsaved one) */,
		draft: null /* the levels being edited in that row */,
		inline: null /* { id, field } while a name or description is an input */,
		fresh: null /* { name, desc } of the unsaved new role */,
		viewing: null /* id of the role shown in View as */,
	};
	const el = {
		body: pick('[data-rl-body]'),
		table: pick('[data-rl-table]'),
		msg: pick('[data-rl-msg]'),
		note: pick('[data-rl-note]'),
		view: pick('[data-rl-view]'),
		viewRole: pick('[data-rl-view-role]'),
		viewText: pick('[data-rl-view-text]'),
		viewMenu: pick('[data-rl-view-menu]'),
		ring: pick('[data-rl-ring]'),
		ringNum: pick('[data-rl-ring-num]'),
		ringLabel: pick('[data-rl-ring-label]'),
	};

	function build(data) {
		D = data;
		state.roles = data.roles.map((r) => {
			const perms = {};
			data.areas.forEach((a, n) => {
				perms[a.id] = r.levels[n] || 0;
			});
			return {
				id: r.id,
				name: r.name,
				desc: r.desc,
				builtin: !!r.builtin,
				locked: !!r.locked,
				perms,
				reach: r.reach.slice(),
			};
		});
		/* A workspace with no roster, only a headcount per role, gets
		   stand-ins with no names. */
		state.people = data.people.length
			? data.people.map((p) => ({ id: p[0], name: p[1], role: p[4] }))
			: data.roles.flatMap((r) =>
					Array.from({ length: r.people }, (_, n) => ({ id: `${r.id}-${n + 1}`, name: '', role: r.id })),
				);
		if (!state.roles.some((r) => r.id === state.viewing))
			state.viewing = (state.roles.find((r) => !r.builtin) || state.roles[0] || { id: null }).id;
	}

	/* Every resource in an area opens once the area has a level, so the
	   reach follows the level set here. */
	function reachFor(perms) {
		return D.areas.map((a) => (perms[a.id] ? a.total : 0));
	}

	function roleById(id) {
		return state.roles.find((r) => r.id === id) || null;
	}

	function membersOf(id) {
		return state.people.filter((p) => p.role === id);
	}

	function noAccess() {
		const p = {};
		D.areas.forEach((a) => {
			p[a.id] = 0;
		});
		return p;
	}

	function domId(id) {
		return `rl-${String(id).replace(/[^a-zA-Z0-9_-]/g, '')}`;
	}

	function nameError(name, id) {
		if (!name) return 'Give the role a name.';
		const clash = state.roles.find((r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase());
		return clash ? `There is already a role called ${clash.name}.` : '';
	}
	function uniqueName(base) {
		let name = base;
		for (let n = 2; state.roles.some((r) => r.name.toLowerCase() === name.toLowerCase()); n++)
			name = `${base} ${n}`;
		return name;
	}
	function makeId(name) {
		let id =
			name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '') || 'role';
		while (roleById(id) || id === NEW) id += '-2';
		return id;
	}

	/* The Access column: "Full: Finance · Edit: Analytics · View: 5 more".
	   With fifteen areas the names are listed only for full and edit, and
	   a long view-only list becomes a count; the View as band above the
	   table shows every area by name. */
	function accessText(perms) {
		function at(n) {
			return D.areas.filter((a) => perms[a.id] === n).map((a) => a.name);
		}

		const full = at(3),
			edit = at(2),
			view = at(1);
		if (full.length === D.areas.length) return 'Everything';
		if (!full.length && !edit.length && !view.length) return 'Nothing yet';
		if (!full.length && !edit.length)
			return view.length > 3
				? `View only: ${view.length} of ${D.areas.length} areas`
				: `View only: ${view.join(', ')}`;
		/* Nearly everything at full access reads better as the exceptions. */
		const most = full.length >= D.areas.length - 3 && full.length + edit.length + view.length === D.areas.length;
		const parts = [];
		if (full.length && !most) parts.push(`Full: ${full.join(', ')}`);
		if (edit.length) parts.push(`Edit: ${edit.join(', ')}`);
		if (view.length) parts.push(view.length > 2 ? `View: ${view.length} more` : `View: ${view.join(', ')}`);
		if (most) parts.push('Full: everything else');
		return parts.join(' · ');
	}

	/** The access column: one short bar per section of the menu, as deep
	 * as the role's level there, with the sentence for screen readers. */
	function accessStrip(perms) {
		const opened = D.areas.filter((a) => perms[a.id]).length;
		const bars = D.areas
			.map((a) => {
				const lv = perms[a.id] || 0;
				return `<i class="is-${LEVEL_IDS[lv]}" title="${htmlSafe(`${a.name}: ${lv ? D.levels[lv].short : 'Hidden'}`)}"></i>`;
			})
			.join('');
		return `<span class="rl-strip" role="img" aria-label="${htmlSafe(accessText(perms))}">${bars}</span><span class="rl-strip-count">${opened === D.areas.length ? 'Everything' : `${opened} of ${D.areas.length}`}</span>`;
	}

	/* What a save will change, as one sentence. */
	function changeText(name, before, after) {
		const groups = {};
		const order = ['full', 'edit', 'editonly', 'view', 'viewonly', 'none'];
		const PHRASE = {
			full: 'have full access to',
			edit: 'be able to edit',
			editonly: 'keep edit but lose full access to',
			view: 'be able to view',
			viewonly: 'only be able to view',
			none: 'lose access to',
		};
		D.areas.forEach((a) => {
			const from = before[a.id],
				to = after[a.id];
			if (from === to) return;
			const key =
				to === 3
					? 'full'
					: to === 2
						? from > 2
							? 'editonly'
							: 'edit'
						: to === 1
							? from > 1
								? 'viewonly'
								: 'view'
							: 'none';
			(groups[key] = groups[key] || []).push(a.name);
		});
		const bits = order.filter((k) => groups[k]).map((k) => `${PHRASE[k]} ${listText(groups[k])}`);
		if (!bits.length) return 'No changes yet.';
		return `${name || 'The new role'} will ${listText(bits)}.`;
	}

	function riskOf(a, level, before) {
		return a.risky && level >= a.risky.from && (before == null || before < a.risky.from);
	}

	/* Drawing the table */
	function lbl(t) {
		return `<span class="rl-lbl">${t}</span>`;
	}

	function inputHtml(field, value, label, err) {
		const max = field === 'name' ? 40 : 120;
		return `<input type="text" class="form-control form-control-sm rl-input${err ? ' is-invalid' : ''}" id="rl-input" value="${htmlSafe(value)}" maxlength="${max}" aria-label="${htmlSafe(label)}" aria-describedby="rl-input-help${field === 'name' ? ' rlInputErr' : ''}"${err ? ' aria-invalid="true"' : ''} data-rl-input="${field}">${field === 'name' ? `<div class="invalid-feedback" id="rl-input-err">${htmlSafe(err || '')}</div>` : ''}<span class="visually-hidden" id="rl-input-help">Enter saves, Escape cancels.</span>`;
	}

	function freshRow() {
		const f = state.fresh;
		return `<tr class="rl-row is-fresh" data-rl-row="${NEW}"><th scope="row" class="rl-c-name"><input type="text" class="form-control form-control-sm rl-input${f.err ? ' is-invalid' : ''}" id="rl-fresh-name" value="${htmlSafe(f.name)}" maxlength="40" placeholder="Role name" aria-label="New role name" aria-describedby="rl-fresh-err"${f.err ? ' aria-invalid="true"' : ''} data-rl-fresh="name"><div class="invalid-feedback" id="rl-fresh-err">${htmlSafe(f.err || '')}</div></th><td class="rl-c-desc">${lbl('For')}<input type="text" class="form-control form-control-sm rl-input" value="${htmlSafe(f.desc)}" maxlength="120" placeholder="What it’s for" aria-label="What the new role is for" data-rl-fresh="desc"></td><td class="rl-c-people">${lbl('People')}<span class="rl-quiet">0 people</span></td><td class="rl-c-access">${lbl('Access')}<span data-rl-access-text class="rl-reachline">${accessStrip(state.draft)}</span></td><td class="rl-c-actions"><span class="rl-quiet">Not saved yet</span></td></tr>`;
	}

	function roleRow(r) {
		const ed = state.inline && state.inline.id === r.id ? state.inline : null;
		const n = membersOf(r.id).length;
		const open = state.open === r.id;
		let name;
		if (r.locked) {
			const why = `${r.name} is locked. It always has full access and cannot be changed or deleted, so the workspace never loses its owner.`;
			name = `<span class="rl-name">${htmlSafe(r.name)}</span><button type="button" class="rl-lock" aria-label="${htmlSafe(why)}" data-bs-toggle="tooltip" data-bs-title="${htmlSafe(why)}"><i class="bi bi-lock-fill" aria-hidden="true"></i></button>`;
		} else if (ed && ed.field === 'name') {
			name = inputHtml('name', ed.value, 'Role name', ed.err);
		} else {
			name = `<button type="button" class="rl-text rl-name" aria-describedby="rl-edit-hint" data-rl-edit="name">${htmlSafe(r.name)}<i class="bi bi-pencil rl-text-pen" aria-hidden="true"></i></button>`;
		}
		let desc;
		/* The phone label sits inside the button so the text wraps after it. */
		if (r.locked) desc = `${lbl('For')}<span>${htmlSafe(r.desc)}</span>`;
		else if (ed && ed.field === 'desc') desc = lbl('For') + inputHtml('desc', ed.value, `What ${r.name} is for`);
		else
			desc = `<button type="button" class="rl-text" aria-describedby="rl-edit-hint" data-rl-edit="desc">${lbl('For')}${r.desc ? htmlSafe(r.desc) : '<span class="rl-quiet">Add a description</span>'}<i class="bi bi-pencil rl-text-pen" aria-hidden="true"></i></button>`;

		const actions = [];
		if (!r.locked)
			actions.push(
				`<button type="button" class="btn btn-sm btn-outline-secondary" aria-expanded="${open}"${open ? ` aria-controls="${domId(r.id)}-access"` : ''} data-rl-access>${open ? 'Close access' : 'Edit access'}</button>`,
			);
		/* Duplicate and Delete wait in a menu, so a row has one button. */
		const more = [
			`<li><button type="button" class="dropdown-item" data-rl-dup><i class="bi bi-copy" aria-hidden="true"></i>Duplicate</button></li>`,
		];
		if (!r.builtin)
			more.push(
				`<li><button type="button" class="dropdown-item text-danger" data-rl-del><i class="bi bi-trash3" aria-hidden="true"></i>Delete</button></li>`,
			);
		actions.push(
			`<div class="dropdown"><button type="button" class="btn btn-sm btn-outline-secondary rl-more" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="More for ${htmlSafe(r.name)}"><i class="bi bi-three-dots" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end">${more.join('')}</ul></div>`,
		);

		return `<tr class="rl-row${open ? ' is-open' : ''}" data-rl-row="${htmlSafe(r.id)}"><th scope="row" class="rl-c-name"><div class="rl-name-wrap">${name}${r.builtin ? '<span class="rl-tag">Built in</span>' : ''}</div></th><td class="rl-c-desc">${desc}</td><td class="rl-c-people">${lbl('People')}<a href="${peopleLink(r.id)}" aria-label="${htmlSafe(`${plural(n, 'person', 'people')} with ${r.name}`)}">${plural(n, 'person', 'people')}</a></td><td class="rl-c-access">${lbl('Access')}<span data-rl-access-text class="rl-reachline">${accessStrip(open ? state.draft : r.perms)}</span></td><td class="rl-c-actions"><div class="rl-actions">${actions.join('')}</div></td></tr>`;
	}

	/* The access editor under a role: one row per area, its level picked
     on a switch next to the name. Its saved levels are "before". */
	function accessRow(id, name, before) {
		const base = domId(id);
		const fresh = id === NEW;
		const grid = D.areas
			.map((a) => {
				const sid = `${base}-${a.id}`;
				const lv = state.draft[a.id];
				const risky = riskOf(a, lv, before ? before[a.id] : null);
				return `<div class="rl-area"><span class="rl-area-label" id="${sid}-name">${htmlSafe(a.name)}</span><div class="basalt-segmented basalt-segmented-sm" role="radiogroup" aria-labelledby="${sid}-name"${risky ? ` aria-describedby="${sid}-risk"` : ''} data-basalt-segmented>${D.levels.map((L, n) => `<input type="radio" class="btn-check" name="${sid}" id="${sid}-${n}" value="${n}" data-rl-level="${a.id}"${n === lv ? ' checked' : ''}><label class="basalt-segmented-option" for="${sid}-${n}">${htmlSafe(L.name)}</label>`).join('')}</div><p class="rl-risk" id="${sid}-risk"${risky ? '' : ' hidden'}><i class="bi bi-exclamation-triangle" aria-hidden="true"></i>${htmlSafe(a.risky ? a.risky.why : '')}</p></div>`;
			})
			.join('');
		return `<tr class="rl-xrow" id="${base}-access"><td colspan="5"><div class="rl-access" role="group" aria-labelledby="${base}-title"><h2 class="rl-access-title" id="${base}-title" tabindex="-1">${fresh ? 'Access for the new role' : `Access for ${htmlSafe(name)}`}</h2><div class="rl-access-grid">${grid}</div><div class="rl-access-foot"><p class="rl-access-summary" aria-live="polite" data-rl-summary>${htmlSafe(changeText(fresh ? state.fresh.name.trim() : name, before || noAccess(), state.draft))}</p><div class="rl-access-btns"><button type="button" class="btn btn-sm btn-primary" data-rl-save>${fresh ? 'Create role' : 'Save'}</button><button type="button" class="btn btn-sm btn-outline-secondary" data-rl-cancel>Cancel</button></div></div></div></td></tr>`;
	}

	/* Where a role's people are listed: the Employee Users page. */
	function peopleLink(roleId) {
		return `employee-users.html?role=${encodeURIComponent(roleId)}`;
	}

	function skeleton() {
		function bar(w) {
			return `<span class="placeholder col-${w} rounded"></span>`;
		}

		let h = '';
		for (let i = 0; i < 5; i++) {
			h += `<tr class="rl-row rl-skel placeholder-glow" aria-hidden="true"><th class="rl-c-name">${bar(8)}</th><td class="rl-c-desc">${bar(10)}</td><td class="rl-c-people">${bar(6)}</td><td class="rl-c-access">${bar(10)}</td><td class="rl-c-actions">${bar(8)}</td></tr>`;
		}
		return h;
	}

	function disposeTips() {
		for (const t of pickAll('[data-bs-toggle="tooltip"]', el.body)) {
			const i = bootstrap.Tooltip.getInstance(t);
			if (i) i.dispose();
		}
	}

	function render() {
		disposeTips();
		el.body.setAttribute('aria-busy', String(state.loading));
		el.table.hidden = state.error;
		el.msg.hidden = !state.error;
		el.view.hidden = state.error || state.loading;
		if (state.error) {
			el.note.hidden = true;
			el.msg.innerHTML = `<div class="basalt-empty basalt-empty-compact basalt-empty-danger rl-empty" role="alert"><h2 class="basalt-empty-title">Roles did not load</h2><p class="basalt-empty-text">The server did not answer. Nobody’s access has changed.</p><div class="basalt-empty-actions"><button type="button" class="btn btn-sm btn-primary" data-rl-retry>Try again</button></div></div>`;
			return;
		}
		if (state.loading) {
			el.body.innerHTML = skeleton();
			el.note.hidden = true;
			return;
		}
		let h = '';
		if (state.fresh) h += freshRow() + (state.open === NEW ? accessRow(NEW, '', null) : '');
		state.roles.forEach((r) => {
			h += roleRow(r);
			if (state.open === r.id) h += accessRow(r.id, r.name, r.perms);
		});
		el.body.innerHTML = h;
		if (window.Basalt.buttons) window.Basalt.buttons(el.body);
		el.note.hidden = state.roles.some((r) => !r.builtin) || !!state.fresh;

		for (const t of pickAll('[data-bs-toggle="tooltip"]', el.body)) {
			bootstrap.Tooltip.getOrCreateInstance(t);
		}
		paintView();
	}

	/* View as: the sections of the menu, each tinted by the most the
	   picked role can do there and dimmed where it has no way in. While
	   that role's access row is open, the band follows the draft. */
	function paintView() {
		const roles = state.roles;
		if (!roles.length || !state.viewing) {
			el.view.hidden = true;
			return;
		}
		el.view.hidden = false;
		el.viewRole.innerHTML = roles
			.map(
				(r) =>
					`<option value="${htmlSafe(r.id)}"${r.id === state.viewing ? ' selected' : ''}>${htmlSafe(r.name)}</option>`,
			)
			.join('');
		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(el.viewRole);
		const r = roleById(state.viewing);
		const live = state.open === r.id && !!state.draft;
		const perms = live ? state.draft : r.perms;
		const reach = live ? reachFor(perms) : r.reach;
		let opened = 0;
		el.viewMenu.innerHTML = D.areas
			.map((a, n) => {
				const lv = perms[a.id] || 0;
				if (lv) opened++;
				const partial = lv > 0 && reach[n] < a.total;
				const sub = lv ? `${D.levels[lv].short}${partial ? ` · ${reach[n]} of ${a.total}` : ''}` : 'Hidden';
				const speech = `${a.name}: ${lv ? D.levels[lv].name.toLowerCase() : 'no access'}${partial ? `, ${reach[n]} of ${a.total} parts` : ''}`;
				const href = `permissions.html?set=${encodeURIComponent(D.id)}&role=${encodeURIComponent(r.id)}&area=${encodeURIComponent(a.id)}`;
				return `<li><a href="${href}" class="rl-reach is-${LEVEL_IDS[lv]}" data-rl-area="${a.id}" aria-label="${htmlSafe(speech)}"><span class="rl-reach-dot" aria-hidden="true"></span><span class="rl-reach-name">${htmlSafe(a.name)}</span><span class="rl-reach-sub">${htmlSafe(sub)}</span></a></li>`;
			})
			.join('');
		drawRing(perms, opened, r.name);
		el.viewText.textContent = `${r.name} can open ${opened} of ${D.areas.length} sections of the menu${live ? ', counting the changes below' : ''}.`;
	}

	/** The ring beside the list: one arc per section of the menu, as deep
	 * as the role's level there; pointing at an arc or a row lights both. */
	function drawRing(perms, opened, name) {
		const count = D.areas.length;
		const step = 360 / count;
		const point = (angle, radius) => {
			const rad = ((angle - 90) * Math.PI) / 180;
			return `${(100 + radius * Math.cos(rad)).toFixed(2)} ${(100 + radius * Math.sin(rad)).toFixed(2)}`;
		};
		el.ring.innerHTML = D.areas
			.map((a, n) => {
				const lv = perms[a.id] || 0;
				const from = n * step + 1;
				const to = (n + 1) * step - 1;
				const outer = 94 - (3 - lv) * 4;
				const large = to - from > 180 ? 1 : 0;
				return `<path class="rl-arc is-${LEVEL_IDS[lv]}" data-rl-area="${a.id}" style="--i: ${n}" d="M ${point(from, outer)} A ${outer} ${outer} 0 ${large} 1 ${point(to, outer)} L ${point(to, 62)} A 62 62 0 ${large} 0 ${point(from, 62)} Z"><title>${htmlSafe(`${a.name}: ${lv ? D.levels[lv].short : 'Hidden'}`)}</title></path>`;
			})
			.join('');
		el.ringNum.textContent = `${opened} of ${count}`;
		el.ringLabel.textContent = name;
	}

	function lightArea(id) {
		for (const node of pickAll('[data-rl-area]', el.view)) {
			node.classList.toggle('is-lit', node.getAttribute('data-rl-area') === id);
		}
		el.view.classList.toggle('is-pointing', Boolean(id));
	}

	/* The switch in the header: another workspace, another set of roles. */
	function switchWorkspace(id) {
		if (id === state.set || !WORKSPACES.some((w) => w.id === id)) return;
		state.set = id;
		state.open = null;
		state.draft = null;
		state.inline = null;
		state.fresh = null;
		state.viewing = null;
		const url = new URL(location.href);
		if (id === WORKSPACES[0].id) url.searchParams.delete('set');
		else url.searchParams.set('set', id);
		history.replaceState(null, '', url);
		load();
		announce(`${WORKSPACES.find((w) => w.id === id).name} roles`);
	}

	function redrawRow(r) {
		const row = rowNode(r.id);
		if (!row) {
			render();
			return;
		}
		row.outerHTML = roleRow(r);
		const title = pick(`#${domId(r.id)}-title`);
		if (title) title.textContent = `Access for ${r.name}`;
	}

	function rowNode(id) {
		return pick(`[data-rl-row="${CSS.escape(id)}"]`, el.body);
	}

	function focusIn(id, sel) {
		const row = rowNode(id);
		const t = row && pick(sel, row);
		if (t) t.focus();
	}

	/* Saving with rollback */
	function failed(what, undo) {
		return () => {
			undo();
			render();
			toast({
				tone: 'danger',
				title: `Could not ${what}`,
				text: 'Nothing was changed. Check your connection and try again.',
				duration: 8000,
			});
			announce(`Could not ${what}. Nothing was changed.`);
		};
	}

	/* Name and description, in place */
	function startInline(id, field) {
		const r = roleById(id);
		if (!r || r.locked) return;
		state.inline = { id, field, value: r[field], err: '' };
		render();
		const input = pick('#rl-input');
		if (input) {
			input.focus();
			input.select();
		}
	}

	function cancelInline() {
		const ed = state.inline;
		if (!ed) return;
		state.inline = null;
		render();
		focusIn(ed.id, `[data-rl-edit="${ed.field}"]`);
	}

	function commitInline(fromBlur) {
		const ed = state.inline;
		const input = pick('#rl-input');
		if (!ed || !input) return;
		const r = roleById(ed.id);
		const value = input.value.trim();
		if (ed.field === 'name') {
			const err = nameError(value, r.id);
			if (err) {
				ed.value = input.value;
				ed.err = err;
				input.classList.add('is-invalid');
				input.setAttribute('aria-invalid', 'true');
				pick('#rl-input-err').textContent = err;
				if (!fromBlur) announce(err);
				return;
			}
		}
		state.inline = null;
		const before = r[ed.field];

		function redraw() {
			if (fromBlur) redrawRow(r);
			else {
				render();
				focusIn(r.id, `[data-rl-edit="${ed.field}"]`);
			}
		}

		if (value === before) {
			redraw();
			return;
		}
		r[ed.field] = value;
		redraw();
		const field = ed.field;

		function put(v) {
			return {
				[field]: v,
			};
		}

		api.updateRole(r.id, put(value)).catch(
			failed(`save ${r.name}`, () => {
				r[field] = before;
			}),
		);
		toast({
			tone: 'success',
			title: field === 'name' ? `Renamed to ${value}` : 'Description saved',
			text: field === 'name' ? `It was called ${before}.` : `For ${r.name}.`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						r[field] = before;
						render();
						api.updateRole(r.id, put(before)).catch(
							failed('undo the change', () => {
								r[field] = value;
							}),
						);
						announce('Change undone');
					},
				},
			],
		});
		announce(field === 'name' ? `Renamed to ${value}` : 'Description saved');
	}

	/* Access row */
	function openAccess(id) {
		const r = roleById(id);
		if (!r || r.locked) return;
		if (state.open === NEW) state.fresh = null;
		state.inline = null;
		if (state.open === id) {
			closeAccess();
			return;
		}
		state.open = id;
		state.draft = copy(r.perms);
		window.Basalt.slide(el.table, render);
		const first = pick(`#${domId(id)}-access input:checked`);
		if (first) first.focus();
		announce(`Access for ${r.name} opened below the row. ${D.areas.length} areas.`);
	}

	function closeAccess() {
		const id = state.open;
		state.open = null;
		state.draft = null;
		if (id === NEW) {
			state.fresh = null;
			window.Basalt.slide(el.table, render);
			pick('[data-rl-new]').focus();
			announce('New role discarded');
			return;
		}
		window.Basalt.slide(el.table, render);
		focusIn(id, '[data-rl-access]');
	}

	/* A level was picked: update the summary, warnings and Access cell in place. */
	function levelChanged(radio) {
		const area = D.areas.find((a) => a.id === radio.getAttribute('data-rl-level'));
		state.draft[area.id] = Number(radio.value);
		const fresh = state.open === NEW;
		const r = fresh ? null : roleById(state.open);
		const before = r ? r.perms : noAccess();
		const risk = pick(`#${radio.name}-risk`);
		const on = riskOf(area, state.draft[area.id], fresh ? null : before[area.id]);
		const group = radio.closest('[role="radiogroup"]');
		risk.hidden = !on;
		if (on) group.setAttribute('aria-describedby', risk.id);
		else group.removeAttribute('aria-describedby');
		pick('[data-rl-summary]', el.body).textContent = changeText(
			fresh ? state.fresh.name.trim() : r.name,
			before,
			state.draft,
		);
		const cell = pick('[data-rl-access-text]', rowNode(fresh ? NEW : r.id));
		if (cell) cell.innerHTML = accessStrip(state.draft);
		if (!fresh && state.viewing === r.id) paintView();
	}

	function saveAccess() {
		if (state.open === NEW) {
			createFresh();
			return;
		}
		const r = roleById(state.open);
		const before = copy(r.perms);
		const after = copy(state.draft);
		const summary = changeText(r.name, before, after);
		const changed = D.areas.some((a) => before[a.id] !== after[a.id]);
		state.open = null;
		state.draft = null;
		if (!changed) {
			window.Basalt.slide(el.table, render);
			focusIn(r.id, '[data-rl-access]');
			toast({ tone: 'info', title: 'Nothing to save', text: `${r.name} is unchanged.` });
			return;
		}
		const reachBefore = r.reach;
		r.perms = after;
		r.reach = D.areas.map((a, n) => (before[a.id] === after[a.id] ? reachBefore[n] : after[a.id] ? a.total : 0));
		window.Basalt.slide(el.table, render);
		focusIn(r.id, '[data-rl-access]');
		api.updateRole(r.id, { permissions: after }).catch(
			failed(`save ${r.name}`, () => {
				r.perms = before;
				r.reach = reachBefore;
			}),
		);
		toast({
			tone: 'success',
			title: `${r.name} saved`,
			text: `${summary} ${plural(membersOf(r.id).length, 'person has', 'people have')} this role.`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						r.perms = before;
						r.reach = reachBefore;
						if (state.open === r.id) state.draft = copy(before);
						render();
						api.updateRole(r.id, { permissions: before }).catch(
							failed('undo the change', () => {
								r.perms = after;
								r.reach = reachFor(after);
							}),
						);
						announce(`Change to ${r.name} undone`);
					},
				},
			],
		});
		announce(`${r.name} saved`);
	}

	/* New, duplicate and delete */
	function startNew() {
		if (state.loading || state.error) return;
		state.inline = null;
		if (state.open !== NEW) state.draft = noAccess();
		if (!state.fresh) state.fresh = { name: '', desc: '', err: '' };
		state.open = NEW;
		window.Basalt.slide(el.table, render);
		pick('#rl-fresh-name').focus();
		announce('New role added at the top of the table, with its access below it.');
	}

	function createFresh() {
		const f = state.fresh;
		const name = f.name.trim();
		const err = nameError(name, null);
		if (err) {
			f.err = err;
			const input = pick('#rl-fresh-name');
			input.classList.add('is-invalid');
			input.setAttribute('aria-invalid', 'true');
			pick('#rl-fresh-err').textContent = err;
			input.focus();
			announce(err);
			return;
		}
		const role = {
			id: makeId(name),
			name,
			desc: f.desc.trim(),
			builtin: false,
			locked: false,
			perms: copy(state.draft),
			reach: reachFor(state.draft),
		};
		state.fresh = null;
		state.open = null;
		state.draft = null;
		state.roles.unshift(role);
		window.Basalt.slide(el.table, render);
		focusIn(role.id, '[data-rl-edit="name"]');
		function remove() {
			state.roles = state.roles.filter((r) => r !== role);
		}
		api.createRole({ name, desc: role.desc, permissions: role.perms }).catch(failed(`create ${name}`, remove));
		toast({
			tone: 'success',
			title: `${name} created`,
			text: 'Give it to people on the Employee Users page.',
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						remove();
						render();
						api.deleteRole(role.id, null).catch(
							failed(`remove ${name}`, () => {
								state.roles.unshift(role);
							}),
						);
						announce(`${name} removed`);
					},
				},
			],
		});
		announce(`${name} created`);
	}

	function duplicate(id) {
		const src = roleById(id);
		if (!src) return;
		const name = uniqueName(`${src.name} copy`);
		const role = {
			id: makeId(name),
			name,
			desc: src.desc,
			builtin: false,
			locked: false,
			perms: copy(src.perms),
			reach: src.reach.slice(),
		};
		state.roles.splice(state.roles.indexOf(src) + 1, 0, role);
		function remove() {
			state.roles = state.roles.filter((r) => r !== role);
			if (state.open === role.id) state.open = null;
		}
		api.createRole({ name, desc: role.desc, permissions: role.perms, from: src.id }).catch(
			failed(`copy ${src.name}`, remove),
		);
		toast({
			tone: 'success',
			title: `${name} added`,
			text: `Same access as ${src.name}. Nobody has it yet.`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						remove();
						if (state.inline && state.inline.id === role.id) state.inline = null;
						render();
						api.deleteRole(role.id, null).catch(
							failed(`remove ${name}`, () => {
								state.roles.splice(state.roles.indexOf(src) + 1, 0, role);
							}),
						);
						announce(`${name} removed`);
					},
				},
			],
		});
		startInline(role.id, 'name');
		announce(`${name} added below ${src.name}. Type a new name and press Enter.`);
	}

	const del = {
		modal: pick('#rl-delete'),
		go: pick('[data-rl-delete-go]'),
		move: pick('[data-rl-move]'),
		to: pick('[data-rl-move-to]'),
		id: null,
		done: false,
	};

	function sum(p) {
		return Object.keys(p).reduce((a, k) => a + p[k], 0);
	}

	function openDelete(id) {
		const role = roleById(id);
		if (!role || role.builtin) return;
		del.id = id;
		del.done = false;
		const ms = membersOf(id);
		pick('[data-rl-delete-title]').textContent = `Delete ${role.name}?`;
		pick('[data-rl-delete-text]').textContent = ms.length
			? `${plural(ms.length, 'person has', 'people have')} this role. Choose the role they move to.`
			: 'Nobody has this role, so nobody else is affected.';
		del.move.hidden = !ms.length;
		if (ms.length) {
			pick('[data-rl-move-label]').textContent =
				`Move ${ms.length === 1 ? ms[0].name : `these ${ms.length} people`} to`;
			const targets = state.roles.filter((r) => r.id !== id && !r.locked);
			del.to.innerHTML = targets
				.map((r) => `<option value="${htmlSafe(r.id)}">${htmlSafe(r.name)}</option>`)
				.join('');
			/* The closest role with no more access, else the fallback role. */
			const safe = targets
				.filter((r) => D.areas.every((a) => r.perms[a.id] <= role.perms[a.id]))
				.sort((a, b) => sum(b.perms) - sum(a.perms))[0];
			del.to.value = (safe || roleById(D.fallbackRole) || targets[0]).id;
		}
		bootstrap.Modal.getOrCreateInstance(del.modal).show();
	}
	del.modal.addEventListener('shown.bs.modal', () => (del.move.hidden ? del.go : del.to).focus());
	del.go.addEventListener('click', () => {
		const role = roleById(del.id);
		if (!role) return;
		const moveTo = del.move.hidden ? null : del.to.value;
		const moved = membersOf(role.id);
		const at = state.roles.indexOf(role);
		const next = state.roles[at + 1] || state.roles[at - 1];

		function putBack() {
			if (!roleById(role.id)) state.roles.splice(at, 0, role);
			moved.forEach((p) => {
				p.role = role.id;
			});
		}

		del.done = next ? next.id : null;
		bootstrap.Modal.getInstance(del.modal).hide();
		state.roles.splice(at, 1);
		moved.forEach((p) => {
			p.role = moveTo;
		});
		if (state.open === role.id) {
			state.open = null;
			state.draft = null;
		}
		if (state.inline && state.inline.id === role.id) state.inline = null;
		render();
		api.deleteRole(role.id, moveTo).catch(failed(`delete ${role.name}`, putBack));
		const to = roleById(moveTo);
		toast({
			tone: 'success',
			title: `${role.name} deleted`,
			text: moved.length
				? `${plural(moved.length, 'person', 'people')} moved to ${to.name}.`
				: 'Nobody had this role.',
			duration: 9000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						putBack();
						render();
						api.restoreRole(
							role,
							moved.map((p) => p.id),
						).catch(
							failed(`bring back ${role.name}`, () => {
								state.roles = state.roles.filter((r) => r !== role);
								moved.forEach((p) => {
									p.role = moveTo;
								});
							}),
						);
						announce(`${role.name} is back`);
					},
				},
			],
		});
		announce(
			`${role.name} deleted${moved.length ? `. ${plural(moved.length, 'person', 'people')} moved to ${to.name}` : ''}`,
		);
	});
	del.modal.addEventListener('hidden.bs.modal', () => {
		const done = del.done;
		const id = del.id;
		del.id = null;
		if (done === false) {
			focusIn(id, '[data-rl-del]');
			return;
		}
		if (done) focusIn(done, '[data-rl-edit="name"], [data-rl-dup]');
		else pick('[data-rl-new]').focus();
	});

	/* Events */
	root.addEventListener('click', (e) => {
		const t = e.target.closest('button');
		if (!t) return;
		if (t.matches('[data-rl-new]')) {
			startNew();
			return;
		}
		if (t.matches('[data-rl-retry]')) {
			load();
			return;
		}
		if (t.matches('[data-rl-save]')) {
			saveAccess();
			return;
		}
		if (t.matches('[data-rl-cancel]')) {
			closeAccess();
			return;
		}
		const row = t.closest('[data-rl-row]');
		if (!row) return;
		const id = row.getAttribute('data-rl-row');
		if (t.matches('[data-rl-edit]')) startInline(id, t.getAttribute('data-rl-edit'));
		else if (t.matches('[data-rl-access]')) openAccess(id);
		else if (t.matches('[data-rl-dup]')) duplicate(id);
		else if (t.matches('[data-rl-del]')) openDelete(id);
	});

	el.body.addEventListener('keydown', (e) => {
		if (e.target.matches('[data-rl-input]')) {
			if (e.key === 'Enter') {
				e.preventDefault();
				commitInline(false);
			} else if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				cancelInline();
			}
			return;
		}
		if (e.target.matches('[data-rl-fresh]') && e.key === 'Enter') {
			e.preventDefault();
			createFresh();
			return;
		}
		if (e.key === 'Escape' && state.open && e.target.closest('.rl-xrow, [data-rl-fresh]')) {
			e.preventDefault();
			closeAccess();
		}
	});

	/* Leaving the input saves it. Only its own row is redrawn, so a click
     on another row still lands on the button that was pressed. */
	el.body.addEventListener('focusout', (e) => {
		if (!e.target.matches('[data-rl-input]') || !state.inline) return;
		const id = state.inline.id;
		const next = e.relatedTarget;
		const sameRow = next && next.closest('[data-rl-row]') === rowNode(id) && next.getAttribute('data-rl-edit');
		commitInline(true);
		if (sameRow && !state.inline) startInline(id, sameRow);
	});

	el.body.addEventListener('input', (e) => {
		const f = e.target.getAttribute('data-rl-fresh');
		if (f && state.fresh) {
			state.fresh[f] = e.target.value;
			if (f === 'name') {
				if (state.fresh.err) {
					state.fresh.err = '';
					e.target.classList.remove('is-invalid');
					e.target.removeAttribute('aria-invalid');
				}
				const s = pick('[data-rl-summary]', el.body);
				if (s) s.textContent = changeText(state.fresh.name.trim(), noAccess(), state.draft);
			}
		}
		if (e.target.matches('[data-rl-input]') && state.inline) state.inline.value = e.target.value;
	});

	el.body.addEventListener('change', (e) => {
		if (e.target.matches('[data-rl-level]')) levelChanged(e.target);
	});

	root.addEventListener('change', (e) => {
		if (e.target.matches('[data-rl-view-role]')) {
			state.viewing = e.target.value;
			paintView();
		} else if (e.target.matches('[data-rl-set]') && e.target.checked) {
			switchWorkspace(e.target.value);
		}
	});

	/* Pointing at an arc of the ring or a row of the list lights both. */
	el.view.addEventListener('pointerover', (e) => {
		const area = e.target.closest('[data-rl-area]');
		lightArea(area ? area.getAttribute('data-rl-area') : null);
	});
	el.view.addEventListener('pointerleave', () => lightArea(null));
	el.view.addEventListener('focusin', (e) => {
		const area = e.target.closest('[data-rl-area]');
		if (area) lightArea(area.getAttribute('data-rl-area'));
	});
	el.view.addEventListener('focusout', () => lightArea(null));

	/* The header switch starts on the workspace the address names. */
	for (const radio of pickAll('[data-rl-set]', root)) radio.checked = radio.value === state.set;

	/* Loading */
	function load() {
		state.loading = true;
		state.error = false;
		render();
		api.load()
			.then((data) => {
				build(data);
				state.loading = false;
				render();
			})
			.catch(() => {
				state.loading = false;
				state.error = true;
				render();
				announce('Roles did not load.');
			});
	}

	start();
})();
