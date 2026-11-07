/**
 * Basalt - Approvals (approvals.html)
 * The queue of requests waiting for sign-off, and the rules that send
 * them there. Approve or decline on the row: the row leaves the
 * queue, a toast offers Undo, and nothing else opens. Tick several
 * rows to approve them together.
 *
 * A row opens the request's full page (approval-details.html?id=);
 * the panel icon opens a quick view.
 *
 * To use your own data, replace assets/basalt/js/data/multipurpose/approvals.js with what
 * your backend returns, in the same shape. People come from
 * assets/basalt/js/data/multipurpose/people.js.
 * Built from shared parts in basalt.js: styled selects, avatars,
 * status pills, toasts with undo, the side panel and tooltips.
 */
(() => {
	'use strict';
	const root = pick('[data-apv-root]');
	const DATA = window.Basalt.data && window.Basalt.data.approvals;
	const P = window.Basalt.data && window.Basalt.data.people;
	if (!root || !DATA || !P) return;

	function start() {
		drawer.addEventListener('shown.bs.offcanvas', () => dEl.title.focus());
		drawer.addEventListener('hidden.bs.offcanvas', () => {
			const id = state.open;
			state.open = null;

			for (const x of pickAll('.apv-row.is-open', root)) {
				x.classList.remove('is-open');
			}

			(pick(`[data-apv-open="${CSS.escape(id || '')}"]`, root) || el.search).focus();
		});
		drawer.addEventListener('click', (e) => {
			/* Deciding from the quick view closes it; the toast keeps Undo. */
			const ok = e.target.closest('[data-apv-d-approve]');
			const no = e.target.closest('[data-apv-d-decline]');
			if (!ok && !no) return;
			decideOne(state.open, ok ? 'approved' : 'declined');
			panel().hide();
		});

		paintList();
		renderRules();
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function htmlSafe(s) {
		return String(s == null ? '' : s).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many || `${one}s`}`;
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function tip(t) {
		return ` data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="${htmlSafe(t)}"`;
	}

	function money(n) {
		return `$${Math.round(n).toLocaleString('en-US')}`;
	}

	function parse(s) {
		const [d, t] = s.split('T');
		const [y, m, dd] = d.split('-').map(Number);
		const [h, mi] = (t || '12:00').split(':').map(Number);
		return new Date(y, m - 1, dd, h, mi);
	}
	const NOW = parse(DATA.now);

	function dayStart(d) {
		return new Date(d.getFullYear(), d.getMonth(), d.getDate());
	}

	function agoDays(s) {
		return Math.round((dayStart(NOW) - dayStart(parse(s))) / 864e5);
	}

	function time12(d) {
		return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	}

	function dayShort(s) {
		return parse(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function whenText(s) {
		const n = agoDays(s);
		const d = parse(s);
		if (n === 0) return `Today, ${time12(d)}`;
		if (n === 1) return `Yesterday, ${time12(d)}`;
		return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${time12(d)}`;
	}
	function waitText(s) {
		const n = agoDays(s);
		return n === 0 ? 'Asked today' : n === 1 ? 'Since yesterday' : `${plural(n, 'day')} waiting`;
	}

	function person(id) {
		return P.recordWithId(id);
	}

	function nameOf(id) {
		const p = person(id);
		return p ? P.nameOf(p) : id;
	}

	function avatar(id, size) {
		return `<span class="basalt-avatar ${size || 'basalt-avatar-xs'}" data-basalt-avatar data-name="${htmlSafe(nameOf(id))}" aria-hidden="true"></span>`;
	}

	/* State */
	const state = {
		items: DATA.list(),
		rules: DATA.rules.map((r) => Object.assign({}, r)),
		query: '',
		status: 'waiting',
		kind: 'all',
		picked: new Set(),
		open: null,
	};

	function nodeById(id) {
		return state.items.find((r) => r.id === id);
	}

	function ruleOf(req) {
		return state.rules.find((r) => r.id === req.rule) || DATA.rule(req.rule);
	}

	function approverOf(req) {
		return req.decidedBy || (ruleOf(req) || {}).approver;
	}

	function href(req) {
		return `approval-details.html?id=${encodeURIComponent(req.id)}`;
	}

	function amountText(req) {
		if (!req.amount) return 'No cost';
		return money(req.amount) + (req.pct ? ' off' : '');
	}

	function limitText(r) {
		return r.unit === 'usd' ? money(r.limit) : r.unit === 'pct' ? `${r.limit}%` : '';
	}

	function conditionText(r) {
		return r.when + (r.unit ? ` ${limitText(r)}` : '');
	}

	/* Elements */
	const el = {
		summary: pick('[data-apv-summary]', root),
		search: pick('[data-apv-search]', root),
		status: pick('[data-apv-status]', root),
		kind: pick('[data-apv-kind]', root),
		table: pick('[data-apv-table]', root),
		rows: pick('[data-apv-rows]', root),
		empty: pick('[data-apv-empty]', root),
		bulk: pick('[data-apv-bulk]', root),
		bulkCount: pick('[data-apv-bulk-count]', root),
		pickAll: pick('[data-apv-pick-all]', root),
		rules: pick('[data-apv-rules]', root),
		live: pick('[data-apv-live]', root),
	};
	function say(t) {
		el.live.textContent = '';
		setTimeout(() => {
			el.live.textContent = t;
		}, 30);
	}

	(function fillKinds() {
		el.kind.insertAdjacentHTML(
			'beforeend',
			DATA.rules
				.map((r) => `<option value="${r.id}" data-icon="${r.icon}">${htmlSafe(r.name)}</option>`)
				.join(''),
		);
		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(el.kind);
	})();

	/* The queue */
	function matches(req) {
		if (state.status !== 'all' && req.status !== state.status) return false;
		if (state.kind !== 'all' && req.rule !== state.kind) return false;
		const q = state.query.trim().toLowerCase();
		if (!q) return true;
		const hay = [req.id, req.title, nameOf(req.by), nameOf(approverOf(req)), (ruleOf(req) || {}).name, req.what]
			.join(' ')
			.toLowerCase();
		return q.split(/\s+/).every((w) => hay.includes(w));
	}

	/* Waiting first, oldest first; decided ones newest first. */
	function order(a, b) {
		return (
			(a.status === 'waiting' ? 0 : 1) - (b.status === 'waiting' ? 0 : 1) ||
			(a.status === 'waiting'
				? parse(a.at) - parse(b.at)
				: parse(b.decidedAt || b.at) - parse(a.decidedAt || a.at))
		);
	}

	function shown() {
		return state.items.filter(matches).sort(order);
	}

	const PILL = { approved: ['success', 'Approved'], declined: ['danger', 'Declined'] };
	function stateCell(req) {
		if (req.status !== 'waiting') {
			const p = PILL[req.status];
			return `<span class="basalt-status basalt-status-dot basalt-status-${p[0]}">${p[1]}</span>`;
		}
		return `<span class="apv-wait">${htmlSafe(waitText(req.at))}</span>`;
	}

	function rowHtml(req) {
		const r = ruleOf(req);
		const waiting = req.status === 'waiting';
		const picked = state.picked.has(req.id);
		const approver = approverOf(req);
		return `<tr class="apv-row${req.id === state.open ? ' is-open' : ''}${picked ? ' is-picked' : ''}" data-apv-id="${htmlSafe(req.id)}"><td class="apv-row-pick">${waiting ? `<input class="form-check-input" type="checkbox" aria-label="Select ${htmlSafe(req.title)}" data-apv-pick="${htmlSafe(req.id)}"${picked ? ' checked' : ''}>` : ''}</td><td class="apv-row-what"><div class="apv-what"><span class="apv-chip apv-tone-${r.tone}" aria-hidden="true"><i class="bi ${r.icon}"></i></span><div class="apv-what-text"><p class="apv-row-title"><a class="apv-row-link" href="${href(req)}">${htmlSafe(req.title)}</a></p><p class="apv-row-meta">${htmlSafe(nameOf(req.by))}<span class="apv-row-rule"> · ${htmlSafe(r.name)}</span><span class="apv-row-amount-inline"> · ${htmlSafe(amountText(req))}</span><span class="apv-row-state-inline"> · ${htmlSafe(waiting ? waitText(req.at) : PILL[req.status][1])}</span></p></div></div></td><td class="apv-row-amount">${req.amount ? htmlSafe(amountText(req)) : '<span class="apv-quiet">No cost</span>'}</td><td class="apv-row-who"><span class="apv-person">${avatar(approver)}<span class="apv-person-name">${htmlSafe(nameOf(approver))}</span></span></td><td class="apv-row-state">${stateCell(req)}</td><td class="apv-row-act"><span class="basalt-row-actions">${waiting ? `<button type="button" class="btn btn-outline-secondary btn-sm apv-btn" data-apv-decline="${htmlSafe(req.id)}" aria-label="Decline: ${htmlSafe(req.title)}">Decline</button><button type="button" class="btn btn-outline-primary btn-sm apv-btn" data-apv-approve="${htmlSafe(req.id)}" aria-label="Approve: ${htmlSafe(req.title)}">Approve</button>` : ''}<button type="button" class="btn btn-icon btn-sm" data-apv-open="${htmlSafe(req.id)}" aria-label="Quick view: ${htmlSafe(req.title)}"${tip('Quick view')}><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${href(req)}" aria-label="Open full page: ${htmlSafe(req.title)}"${tip('Open full page')}><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span></td></tr>`;
	}

	function emptyHtml() {
		const filtered = state.kind !== 'all' || state.query.trim();
		const S =
			!filtered && state.status === 'waiting'
				? {
						icon: 'bi-check2-all',
						title: 'Nothing waiting',
						text: 'Every request has an answer. New ones show up here.',
						btn: '',
					}
				: {
						icon: 'bi-search',
						title: 'No requests match',
						text: 'Try another search, kind or status.',
						btn: '<button type="button" class="btn btn-sm btn-outline-secondary" data-apv-clear>Show every request</button>',
					};
		return `<div class="basalt-empty basalt-empty-compact apv-empty"><span class="apv-empty-icon" aria-hidden="true"><i class="bi ${S.icon}"></i></span><h3 class="basalt-empty-title">${S.title}</h3><p class="basalt-empty-text">${S.text}</p>${S.btn ? `<div class="basalt-empty-actions">${S.btn}</div>` : ''}</div>`;
	}

	function paintSummary() {
		const waiting = state.items.filter((r) => r.status === 'waiting');
		if (!waiting.length) {
			el.summary.textContent = 'Nothing waiting for sign-off.';
			return;
		}
		const total = waiting.reduce((n, r) => n + (r.pct ? 0 : r.amount), 0);
		const oldest = waiting.reduce((a, b) => (parse(a.at) < parse(b.at) ? a : b));
		el.summary.textContent = `${plural(waiting.length, 'request')} waiting, ${money(total)} of spending and refunds. The oldest is from ${dayShort(oldest.at)}.`;
	}

	function paintBatch() {
		/* Only waiting rows that are on screen stay picked. */
		const visible = new Set(
			shown()
				.filter((r) => r.status === 'waiting')
				.map((r) => r.id),
		);

		for (const id of [...state.picked]) {
			if (!visible.has(id)) state.picked.delete(id);
		}

		const n = state.picked.size;
		el.bulk.hidden = !n;
		el.bulkCount.textContent = `${plural(n, 'request')} selected`;
		el.pickAll.checked = n > 0 && n === visible.size;
		el.pickAll.indeterminate = n > 0 && n < visible.size;
		el.pickAll.disabled = !visible.size;
	}

	function paintList() {
		const list = shown();
		paintBatch();
		el.rows.innerHTML = list.map(rowHtml).join('');
		el.table.hidden = !list.length;
		el.empty.hidden = !!list.length;
		el.empty.innerHTML = list.length ? '' : emptyHtml();
		paintSummary();
		if (window.Basalt.avatars) window.Basalt.avatars(el.rows);
		if (window.Basalt.tips) window.Basalt.tips(el.rows);
	}

	/* Deciding, with Undo */
	function decide(ids, status) {
		const prev = ids.map((id) => {
			const r = nodeById(id);
			return { r, status: r.status, by: r.decidedBy, at: r.decidedAt };
		});

		for (const { r } of prev) {
			r.status = status;
			r.decidedBy = DATA.me;
			r.decidedAt = DATA.now;
		}

		ids.forEach((id) => state.picked.delete(id));
		paintList();
		renderRules();
		if (state.open && ids.includes(state.open)) drawDrawer(nodeById(state.open));
		return () => {
			for (const { r, status: s, by, at } of prev) {
				r.status = s;
				r.decidedBy = by;
				r.decidedAt = at;
			}

			paintList();
			renderRules();
			if (state.open) drawDrawer(nodeById(state.open));
			say(
				ids.length === 1
					? `Back in the queue: ${prev[0].r.title}.`
					: `${plural(ids.length, 'request')} back in the queue.`,
			);
		};
	}
	function decideOne(id, status) {
		const req = nodeById(id);
		if (!req || req.status !== 'waiting') return;
		const undo = decide([id], status);
		const ok = status === 'approved';
		say(req.title + (ok ? ' approved.' : ' declined.'));
		toast({
			tone: ok ? 'success' : 'info',
			icon: ok ? 'bi-check2-circle' : 'bi-x-circle',
			title: ok ? 'Approved' : 'Declined',
			text: `${req.title + (req.amount ? `, ${amountText(req)}` : '')}. ${nameOf(req.by)} gets an email.`,
			actions: [{ label: 'Undo', onClick: undo }],
		});
	}
	function approvePicked() {
		const ids = [...state.picked];
		if (!ids.length) return;
		const undo = decide(ids, 'approved');
		say(`${plural(ids.length, 'request')} approved.`);
		toast({
			tone: 'success',
			icon: 'bi-check2-all',
			title: `${plural(ids.length, 'request')} approved`,
			text: 'Everyone who asked gets an email.',
			actions: [{ label: 'Undo', onClick: undo }],
		});
	}

	/* Clicks in the queue
	   A row opens the request's full page, like its title does (Cmd or
	   Ctrl click, or middle click, opens a new tab). */
	function onRowClick(e) {
		const a = e.target.closest('[data-apv-approve]');
		if (a) {
			decideOne(a.dataset.apvApprove, 'approved');
			return;
		}
		const d = e.target.closest('[data-apv-decline]');
		if (d) {
			decideOne(d.dataset.apvDecline, 'declined');
			return;
		}
		const q = e.target.closest('[data-apv-open]');
		if (q) {
			showSheet(q.dataset.apvOpen);
			return;
		}
		if (e.target.closest('a, button, input, .apv-row-pick')) return;
		const link = e.target.closest('tr[data-apv-id]')?.querySelector('.apv-row-link');
		if (!link) return;
		if (e.metaKey || e.ctrlKey || e.button === 1) window.open(link.href, '_blank', 'noopener');
		else location.href = link.href;
	}
	el.rows.addEventListener('click', onRowClick);
	el.rows.addEventListener('auxclick', (e) => {
		if (e.button === 1 && !e.target.closest('a, button, input')) onRowClick(e);
	});
	el.rows.addEventListener('change', (e) => {
		const box = e.target.closest('[data-apv-pick]');
		if (!box) return;
		if (box.checked) state.picked.add(box.dataset.apvPick);
		else state.picked.delete(box.dataset.apvPick);
		box.closest('tr').classList.toggle('is-picked', box.checked);
		paintBatch();
	});
	el.pickAll.addEventListener('change', () => {
		const ids = shown()
			.filter((r) => r.status === 'waiting')
			.map((r) => r.id);
		if (el.pickAll.checked)
			for (const id of ids) {
				state.picked.add(id);
			}
		else state.picked.clear();
		paintList();
	});
	pick('[data-apv-bulk-approve]', root).addEventListener('click', approvePicked);
	pick('[data-apv-bulk-clear]', root).addEventListener('click', () => {
		state.picked.clear();
		paintList();
		el.pickAll.focus();
	});

	/* Search and filters */
	let timer = 0;
	el.search.addEventListener('input', () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			state.query = el.search.value;
			paintList();
			if (state.query.trim()) say(`${plural(shown().length, 'request')} found`);
		}, 120);
	});
	el.search.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && el.search.value) {
			e.preventDefault();
			el.search.value = '';
			state.query = '';
			paintList();
		}
	});
	el.status.addEventListener('change', () => {
		state.status = el.status.value;
		paintList();
	});
	el.kind.addEventListener('change', () => {
		state.kind = el.kind.value;
		paintList();
	});
	function setSelect(sel, v) {
		if (sel.value !== v) {
			sel.value = v;
			sel.dispatchEvent(new Event('change', { bubbles: true }));
		}
	}
	root.addEventListener('click', (e) => {
		if (e.target.closest('[data-apv-clear]')) {
			el.search.value = '';
			state.query = '';
			setSelect(el.kind, 'all');
			setSelect(el.status, 'all');
			paintList();
		}
	});

	/* The rules */
	function ruleHtml(r) {
		const waiting = state.items.filter((x) => x.rule === r.id && x.status === 'waiting').length;
		const p = person(r.approver);
		return `<li class="apv-rule${r.on ? '' : ' is-off'}" data-apv-rule="${htmlSafe(r.id)}"><span class="apv-chip apv-tone-${r.tone}" aria-hidden="true"><i class="bi ${r.icon}"></i></span><div class="apv-rule-text"><h3 class="apv-rule-name">${htmlSafe(r.name)}</h3><p class="apv-rule-when">${htmlSafe(conditionText(r))}</p></div><div class="apv-rule-who"><span class="apv-person">${avatar(r.approver, 'basalt-avatar-sm')}<span class="apv-person-text"><span class="apv-person-name">${htmlSafe(nameOf(r.approver))}</span><span class="apv-person-title">${htmlSafe(p ? p.title : '')}</span></span></span></div><p class="apv-rule-count">${r.on ? (waiting ? `${plural(waiting, 'request')} waiting` : 'Nothing waiting') : 'Off'}</p><div class="apv-rule-tools"><div class="form-check form-switch mb-0"><input class="form-check-input" type="checkbox" role="switch" id="apv-on-${htmlSafe(r.id)}"${r.on ? ' checked' : ''} data-apv-rule-on="${htmlSafe(r.id)}"><label class="visually-hidden" for="apv-on-${htmlSafe(r.id)}">${htmlSafe(r.name)} is on</label></div><button type="button" class="btn btn-icon btn-sm" data-apv-rule-edit="${htmlSafe(r.id)}" aria-label="Change rule: ${htmlSafe(r.name)}"${tip('Change rule')}><i class="bi bi-pencil" aria-hidden="true"></i></button></div></li>`;
	}
	function renderRules() {
		el.rules.innerHTML = state.rules.map(ruleHtml).join('');
		if (window.Basalt.avatars) window.Basalt.avatars(el.rules);
		if (window.Basalt.tips) window.Basalt.tips(el.rules);
	}
	el.rules.addEventListener('change', (e) => {
		const sw = e.target.closest('[data-apv-rule-on]');
		if (!sw) return;
		const r = state.rules.find((x) => x.id === sw.dataset.apvRuleOn);
		function set(on) {
			r.on = on;
			renderRules();
		}
		set(sw.checked);
		document.getElementById(`apv-on-${r.id}`)?.focus();
		toast({
			tone: 'info',
			icon: sw.checked ? 'bi-toggle-on' : 'bi-toggle-off',
			title: r.name + (r.on ? ' is on' : ' is off'),
			text: r.on ? 'Matching requests need sign-off again.' : 'Matching requests go through without sign-off.',
			actions: [
				{
					label: 'Undo',
					onClick() {
						set(!r.on);
					},
				},
			],
		});
	});
	el.rules.addEventListener('click', (e) => {
		const b = e.target.closest('[data-apv-rule-edit]');
		if (b) openRule(b.dataset.apvRuleEdit);
	});

	/* Add or change a rule */
	const ruleModal = pick('#apv-rule');
	const rf = {};

	for (const x of pickAll('[data-apv-rf]', ruleModal)) {
		rf[x.dataset.apvRf] = x;
	}

	const form = pick('[data-apv-rule-form]', ruleModal);
	let editing = null;
	(function fillApprovers() {
		const staff = P.staff.slice().sort((a, b) => P.nameOf(a).localeCompare(P.nameOf(b)));
		rf.who.innerHTML = staff
			.map(
				(p) =>
					`<option value="${htmlSafe(p.id)}" data-hint="${htmlSafe(p.title)}">${htmlSafe(P.nameOf(p))}</option>`,
			)
			.join('');
		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(rf.who);
	})();
	function syncLimit() {
		const base = DATA.rule(rf.kind.value);
		const has = !!base.unit;
		rf['limit-field'].hidden = !has;
		rf.limit.required = has;
		rf.limit.disabled = !has;
		rf.pre.hidden = base.unit !== 'usd';
		rf.post.hidden = base.unit !== 'pct';
		rf['limit-label'].textContent = base.unit === 'pct' ? 'More off than' : 'Over';
		rf['limit-error'].textContent = base.unit === 'pct' ? 'Enter a percent from 1 to 100.' : 'Enter an amount.';
		rf.limit.max = base.unit === 'pct' ? '100' : '';
	}
	function openRule(id) {
		editing = id ? state.rules.find((r) => r.id === id) : null;
		form.classList.remove('was-validated');
		rf.heading.textContent = editing ? editing.name : 'Add rule';
		rf.submit.textContent = editing ? 'Save rule' : 'Add rule';
		rf['kind-field'].hidden = !!editing;
		rf.kind.value = editing ? editing.id.split('-')[0] : 'spend';
		syncLimit();
		const base = editing || DATA.rule(rf.kind.value);
		rf.limit.value = base.limit || '';
		rf.who.value = base.approver;
		bootstrap.Modal.getOrCreateInstance(ruleModal).show();
	}
	rf.kind.addEventListener('change', () => {
		syncLimit();
		const b = DATA.rule(rf.kind.value);
		rf.limit.value = b.limit || '';
		rf.who.value = b.approver;
	});
	ruleModal.addEventListener('shown.bs.modal', () =>
		(editing
			? rf.limit.disabled
				? null
				: rf.limit
			: pick('.basalt-select-button, [data-apv-rf="kind"]', ruleModal)
		)?.focus(),
	);
	pick('[data-apv-rule-new]', root).addEventListener('click', () => openRule(null));
	form.addEventListener('submit', (e) => {
		e.preventDefault();
		form.classList.add('was-validated');
		if (!form.checkValidity()) {
			rf.limit.focus();
			return;
		}
		const limit = rf.limit.disabled ? null : Number(rf.limit.value);
		if (editing) {
			const before = { limit: editing.limit, approver: editing.approver };
			editing.limit = limit;
			editing.approver = rf.who.value;
			const r = editing;
			renderRules();
			toast({
				tone: 'success',
				icon: 'bi-shield-check',
				title: 'Rule saved',
				text: `${r.name}: ${nameOf(r.approver)} approves.`,
				actions: [
					{
						label: 'Undo',
						onClick() {
							Object.assign(r, before);
							renderRules();
						},
					},
				],
			});
		} else {
			const base = DATA.rule(rf.kind.value);
			const n = state.rules.filter((r) => r.id.split('-')[0] === base.id).length + 1;
			const name =
				base.unit === 'usd'
					? base.name.replace('a limit', money(limit))
					: base.unit === 'pct'
						? `Discounts over ${limit}%`
						: base.name;
			const r = Object.assign({}, base, { id: `${base.id}-${n}`, name, limit, approver: rf.who.value, on: true });
			state.rules.push(r);
			renderRules();
			toast({
				tone: 'success',
				icon: 'bi-shield-check',
				title: 'Rule added',
				text: `${name}: ${nameOf(r.approver)} approves.`,
				actions: [
					{
						label: 'Undo',
						onClick() {
							state.rules.splice(state.rules.indexOf(r), 1);
							renderRules();
						},
					},
				],
			});
		}
		bootstrap.Modal.getOrCreateInstance(ruleModal).hide();
	});

	/* The quick view */
	const drawer = pick('#apv-drawer');
	const dEl = {};

	for (const x of pickAll('[data-apv-d]', drawer)) {
		dEl[x.dataset.apvD] = x;
	}

	function panel() {
		return bootstrap.Offcanvas.getOrCreateInstance(drawer);
	}

	function drawDrawer(req) {
		const r = ruleOf(req);
		const approver = approverOf(req);
		dEl.title.textContent = req.title;
		dEl.sub.textContent = `${req.id} · ${nameOf(req.by)}, ${whenText(req.at)}`;
		dEl.full.href = href(req);

		function fact(k, v) {
			return `<div class="apv-facts-row"><dt>${k}</dt><dd>${v}</dd></div>`;
		}

		const pill =
			req.status === 'waiting'
				? '<span class="basalt-status basalt-status-dot basalt-status-warning">Waiting</span>'
				: `<span class="basalt-status basalt-status-dot basalt-status-${PILL[req.status][0]}">${PILL[req.status][1]}</span>`;
		dEl.body.innerHTML = `<div class="apv-d-top"><span class="apv-chip apv-tone-${r.tone}" aria-hidden="true"><i class="bi ${r.icon}"></i></span>${pill}</div><p class="apv-d-what">${htmlSafe(req.what)}</p><dl class="apv-facts">${fact('Amount', htmlSafe(req.amount ? money(req.amount) + (req.pct ? ` off (${req.pct}%)` : '') : 'No cost'))}${fact('Rule', htmlSafe(r.name))}${req.facts.map((x) => fact(htmlSafe(x[0]), x[2] ? `<a class="apv-link" href="${htmlSafe(x[2])}">${htmlSafe(x[1])}</a>` : htmlSafe(x[1]))).join('')}${fact('Needed by', htmlSafe(parse(req.needBy).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })))}${fact(req.status === 'waiting' ? 'Approver' : 'Decided by', `<span class="apv-person">${avatar(approver)}<span>${htmlSafe(nameOf(approver))}</span></span>`)}</dl>${req.note ? `<p class="apv-d-note"><span class="apv-quiet">Note:</span> ${htmlSafe(req.note)}</p>` : ''}${req.comments.length ? `<p class="apv-d-more"><a class="apv-link" href="${href(req)}#apd-comments">${plural(req.comments.length, 'comment')}</a> on the full page.</p>` : ''}`;
		dEl.foot.innerHTML = `<button type="button" class="btn btn-outline-secondary me-auto" data-bs-dismiss="offcanvas">Close</button>${req.status === 'waiting' ? '<button type="button" class="btn btn-outline-secondary" data-apv-d-decline>Decline</button><button type="button" class="btn btn-primary" data-apv-d-approve><i class="bi bi-check2 me-1" aria-hidden="true"></i>Approve</button>' : ''}`;
		if (window.Basalt.avatars) window.Basalt.avatars(drawer);
	}
	function showSheet(id) {
		const req = nodeById(id);
		if (!req) return;
		state.open = id;
		drawDrawer(req);

		for (const x of pickAll('.apv-row.is-open', root)) {
			x.classList.remove('is-open');
		}

		pick(`tr[data-apv-id="${CSS.escape(id)}"]`, root)?.classList.add('is-open');
		panel().show();
	}
	start();

	/* DOM lookups, shared by every helper above. */
	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
