/**
 * Basalt - Task Details (task-details.html)
 * One task in full: what needs doing, its checklist and files, who
 * has it and when it is due, the comments and everything that
 * happened to it. Complete and Reopen sit in the header.
 *
 * The task comes from the shared task list
 * (assets/basalt/js/data/multipurpose/tasks.js); ?id=t101 picks which one. Changes made
 * here live in memory for the demo; in your app, send them to the
 * server where the toasts are pushed.
 */
(() => {
	'use strict';
	const root = pick('[data-tkd-root]');
	if (!root) return;

	const DATA = window.Basalt.data.tasks;
	const ME = DATA.me;
	const DEFAULT_ID = 't101';

	/* Helpers */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function htmlSafe(s) {
		return String(s == null ? '' : s).replace(
			/[&<>"']/g,
			(ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
		);
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function announce(t) {
		if (window.Basalt.announce) window.Basalt.announce(t);
	}

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many || `${one}s`}`;
	}

	function pad(n) {
		return String(n).padStart(2, '0');
	}

	function isoDate(d) {
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}

	const TODAY = isoDate(new Date());
	function parseIso(s) {
		const p = s.slice(0, 10).split('-').map(Number);
		return new Date(p[0], p[1] - 1, p[2]);
	}

	function offsetDays(iso) {
		return Math.round((parseIso(iso) - parseIso(TODAY)) / 864e5);
	}

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	function day(iso) {
		const d = parseIso(iso);
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}
	function longDay(iso) {
		const d = parseIso(iso);
		return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
	}
	function relDay(iso) {
		const n = offsetDays(iso);
		return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : day(iso);
	}
	function clock(hhmm) {
		const h = +hhmm.slice(0, 2);
		return `${((h + 11) % 12) + 1}:${hhmm.slice(3, 5)}${h < 12 ? ' am' : ' pm'}`;
	}

	function stamp(at) {
		return `${relDay(at.slice(0, 10))}, ${clock(at.slice(11, 16))}`;
	}

	/* The clock for today's changes; in your app this is the server's time. */
	let seq = 0;
	function now() {
		const d = new Date();
		seq += 1;
		return `${TODAY}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(seq)}`;
	}

	const PRIORITY = {
		1: { name: 'Urgent', icon: 'bi-flag-fill' },
		2: { name: 'High', icon: 'bi-flag-fill' },
		3: { name: 'Normal', icon: 'bi-flag-fill' },
		4: { name: 'Low', icon: 'bi-flag' },
	};

	function person(id) {
		return DATA.people.find((p) => p.id === id) || null;
	}

	function list(id) {
		return DATA.lists.find((l) => l.id === id) || DATA.lists[0];
	}

	function nameOf(id) {
		const p = person(id);
		return p ? p.name : 'Nobody';
	}

	function nameOrYou(id) {
		return id === ME ? 'You' : nameOf(id);
	}

	function avatar(id, size) {
		const p = person(id);
		if (!p)
			return `<span class="basalt-avatar basalt-avatar-${size || 'sm'}" aria-hidden="true"><i class="bi bi-person"></i></span>`;
		return `<span class="basalt-avatar basalt-avatar-${size || 'sm'}" data-basalt-avatar data-name="${htmlSafe(p.name)}" aria-hidden="true"></span>`;
	}

	function pageOf(t) {
		return `task-details.html?id=${encodeURIComponent(t.id)}`;
	}

	/* The task */
	const asked = new URLSearchParams(window.location.search).get('id');
	const T = DATA.find(asked) || DATA.find(DEFAULT_ID);
	const X = DATA.extras[T.id] || {};
	T.steps = T.steps || [];
	T.created =
		X.created ||
		(function () {
			const d = parseIso(T.due || TODAY);
			d.setDate(d.getDate() - 6);
			return `${isoDate(d)}T09:30`;
		})();
	if (T.created.slice(0, 10) > TODAY) T.created = `${TODAY}T08:30`;
	T.createdBy = X.createdBy || ME;
	T.comments = (X.comments || []).slice();
	T.files = (X.files || []).slice();
	T.log = (X.activity || []).slice();
	if (T.done && !T.doneAt) T.doneAt = `${TODAY}T08:50`;
	const ui = { editing: false, editingDesc: false };

	/* Open tasks first, by due date (no date last), then done ones: the
     order of Everything on To Dos. */
	const ORDER = DATA.tasks
		.slice()
		.sort(
			(a, b) =>
				!!a.done - !!b.done ||
				(a.due || '9999').localeCompare(b.due || '9999') ||
				a.priority - b.priority ||
				a.id.localeCompare(b.id),
		);

	function statusOf(t) {
		if (t.done) return { word: 'Done', tone: 'success' };
		if (t.due && offsetDays(t.due) < 0) return { word: 'Overdue', tone: 'danger' };
		if (t.due && offsetDays(t.due) === 0) return { word: 'Due today', tone: 'warning' };
		return { word: 'Open', tone: 'info' };
	}
	function pill(t) {
		const s = statusOf(t);
		return `<span class="basalt-status basalt-status-dot basalt-status-${s.tone}">${s.word}</span>`;
	}

	function prio(t) {
		return `<span class="tkd-prio tkd-prio-${t.priority}"><i class="bi ${PRIORITY[t.priority].icon}" aria-hidden="true"></i>${PRIORITY[t.priority].name} priority</span>`;
	}

	function snapshot() {
		return JSON.stringify(T);
	}

	function restore(snap) {
		Object.assign(T, JSON.parse(snap));
		ui.editing = false;
		ui.editingDesc = false;
		render();
		announce('Undone.');
	}
	function logIt(what, icon, tone) {
		T.log.push({ at: now(), who: ME, what, icon, tone });
	}

	/* Header */
	function paintHead() {
		document.title = `${T.title} · Basalt`;
		pick('[data-tkd="title"]').textContent = T.title;
		const by = T.createdBy === ME ? 'you' : nameOf(T.createdBy);
		pick('[data-tkd="sub"]').textContent = `${list(T.list).name} · Added ${day(T.created)} by ${by}`;
		pick('[data-tkd="tags"]').innerHTML = pill(T) + (T.done ? '' : prio(T));
		const btn = pick('[data-tkd-toggle]');
		btn.className = `btn btn-sm ${T.done ? 'btn-outline-secondary' : 'btn-primary'}`;
		pick('.bi', btn).className = `bi me-1 ${T.done ? 'bi-arrow-counterclockwise' : 'bi-check2'}`;
		pick('[data-tkd="toggle-label"]').textContent = T.done ? 'Reopen' : 'Mark complete';
		const i = ORDER.indexOf(T);

		function link(el, to) {
			if (to) {
				el.href = pageOf(to);
				el.classList.remove('disabled');
				el.removeAttribute('aria-disabled');
				el.removeAttribute('tabindex');
			} else {
				el.removeAttribute('href');
				el.classList.add('disabled');
				el.setAttribute('aria-disabled', 'true');
				el.setAttribute('tabindex', '-1');
			}
		}

		link(pick('[data-tkd="prev"]'), ORDER[i - 1]);
		link(pick('[data-tkd="next"]'), ORDER[i + 1]);
	}

	/* Overview */
	function paintWork() {
		const done = T.steps.filter((s) => s.done).length;
		pick('[data-tkd="work-desc"]').textContent = T.steps.length
			? `${done} of ${plural(T.steps.length, 'step')} done${T.files.length ? `, ${plural(T.files.length, 'file')} attached.` : '.'}`
			: 'No steps yet. Break it down below if it helps.';
		const desc = pick('[data-tkd="desc"]');
		desc.hidden = ui.editingDesc;
		pick('[data-tkd-desc-form]').hidden = !ui.editingDesc;
		pick('[data-tkd-desc-edit]').hidden = ui.editingDesc;
		desc.innerHTML = T.notes ? htmlSafe(T.notes) : '<span class="tkd-desc-empty">No description yet.</span>';
		pick('[data-tkd-desc-edit]').textContent = T.notes ? 'Edit' : 'Add';

		pick('[data-tkd="steps-count"]').textContent = T.steps.length ? `${done} of ${T.steps.length}` : '';
		const bar = pick('[data-tkd="progress"]');
		bar.hidden = !T.steps.length;
		pick('span', bar).style.width = `${T.steps.length ? Math.round((done / T.steps.length) * 100) : 0}%`;
		pick('[data-tkd="steps"]').innerHTML = T.steps.length
			? T.steps
					.map(
						(s, i) =>
							`<li class="tkd-step${s.done ? ' is-done' : ''}"><input class="form-check-input" type="checkbox" id="tkd-step-${i}"${s.done ? ' checked' : ''} data-tkd-step="${i}"><label class="tkd-step-label" for="tkd-step-${i}">${htmlSafe(s.title)}</label><button type="button" class="btn btn-icon btn-sm tkd-step-remove" data-tkd-step-remove="${i}" aria-label="Remove step: ${htmlSafe(s.title)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Remove"><i class="bi bi-x-lg" aria-hidden="true"></i></button></li>`,
					)
					.join('')
			: '<li class="tkd-steps-empty">Nothing on the checklist.</li>';

		function icon(name) {
			return /\.pdf$/i.test(name)
				? 'bi-file-earmark-pdf'
				: /\.(png|jpe?g|gif|webp)$/i.test(name)
					? 'bi-file-earmark-image'
					: /\.(xlsx|csv)$/i.test(name)
						? 'bi-file-earmark-spreadsheet'
						: /\.zip$/i.test(name)
							? 'bi-file-earmark-zip'
							: /\.docx?$/i.test(name)
								? 'bi-file-earmark-word'
								: 'bi-file-earmark';
		}

		pick('[data-tkd="files"]').innerHTML = T.files
			.map(
				(f, i) =>
					`<li class="tkd-file"><span class="tkd-file-icon" aria-hidden="true"><i class="bi ${icon(f.name)}"></i></span><span class="tkd-file-text"><span class="tkd-file-name">${htmlSafe(f.name)}</span><span class="tkd-file-meta">${htmlSafe(f.size)} · ${htmlSafe(nameOrYou(f.who))}, ${stamp(f.at)}</span></span><button type="button" class="btn btn-icon btn-sm" data-tkd-file="${i}" aria-label="Download ${htmlSafe(f.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Download"><i class="bi bi-download" aria-hidden="true"></i></button></li>`,
			)
			.join('');
	}

	/* Details */
	function paintDetails() {
		const l = list(T.list);
		const s = statusOf(T);
		let state;
		if (T.done) {
			const r = relDay(T.doneAt);
			state = `Done ${/^(Today|Yesterday)$/.test(r) ? r.toLowerCase() : `on ${r}`} at ${clock(T.doneAt.slice(11, 16))}.`;
		} else if (!T.due) state = 'No due date. It waits in Someday.';
		else if (offsetDays(T.due) < 0) state = `${plural(-offsetDays(T.due), 'day')} late.`;
		else if (offsetDays(T.due) === 0) state = 'Due today.';
		else state = `Due in ${plural(offsetDays(T.due), 'day')}.`;
		pick('[data-tkd="details-desc"]').textContent = state;
		pick('[data-tkd-edit]').hidden = ui.editing;
		pick('[data-tkd="facts"]').hidden = ui.editing;
		pick('[data-tkd-form]').hidden = !ui.editing;
		const due = T.due
			? `<span class="${!T.done && offsetDays(T.due) < 0 ? 'tkd-late' : ''}">${longDay(T.due)}</span>`
			: 'No date';
		const facts = [
			['Status', `<span class="basalt-status basalt-status-dot basalt-status-${s.tone}">${s.word}</span>`],
			[
				'Assignee',
				`<span class="tkd-person">${avatar(T.assignee, 'xs')}${htmlSafe(T.assignee ? nameOf(T.assignee) + (T.assignee === ME ? ' (you)' : '') : 'Nobody yet')}</span>`,
			],
			['Due date', due],
			[
				'Project',
				`<a class="tkd-link" href="to-dos.html"><span class="tkd-dot tkd-c${l.color}" aria-hidden="true"></span>${htmlSafe(l.name)}</a>`,
			],
			['Priority', prio(T).replace(' priority', '')],
			['Added', `${longDay(T.created)} by ${htmlSafe(nameOrYou(T.createdBy).replace(/^You$/, 'you'))}`],
		];
		pick('[data-tkd="facts"]').innerHTML = facts.map((f) => `<div><dt>${f[0]}</dt><dd>${f[1]}</dd></div>`).join('');
		if (window.Basalt.avatars) window.Basalt.avatars(pick('[data-tkd="facts"]'));
	}
	function fillForm() {
		const who = pick('[data-tkd-f="who"]');
		const lst = pick('[data-tkd-f="list"]');
		const pr = pick('[data-tkd-f="priority"]');
		who.innerHTML = `<option value="">Nobody yet</option>${DATA.people.map((p) => `<option value="${p.id}">${htmlSafe(p.id === ME ? `${p.name} (you)` : p.name)}</option>`).join('')}`;
		lst.innerHTML = DATA.lists.map((l) => `<option value="${l.id}">${htmlSafe(l.name)}</option>`).join('');
		who.value = T.assignee || '';
		lst.value = T.list;
		pr.value = String(T.priority);

		for (const s of [who, lst, pr]) {
			if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(s);
		}

		if (window.Basalt.datepicker) window.Basalt.datepicker.set(pick('[data-tkd-due]'), T.due || '');
	}

	/* Comments */
	function paintComments() {
		const items = T.comments.slice().sort((a, b) => a.at.localeCompare(b.at));
		pick('[data-tkd="comments-desc"]').textContent = items.length
			? `${plural(items.length, 'comment')}, oldest first.`
			: 'Ask a question or leave an update for the team.';
		pick('[data-tkd="thread"]').innerHTML = items.length
			? items
					.map(
						(c) =>
							`<li class="tkd-msg">${avatar(c.who)}<div class="tkd-msg-body"><p class="tkd-msg-head"><span class="tkd-msg-who">${htmlSafe(nameOf(c.who))}</span><span class="tkd-msg-when">${stamp(c.at)}</span></p><p class="tkd-msg-text">${htmlSafe(c.text)}</p></div></li>`,
					)
					.join('')
			: '<li class="tkd-thread-empty">No comments yet.</li>';
		if (window.Basalt.avatars) window.Basalt.avatars(pick('[data-tkd="thread"]'));
	}

	/* Activity */
	function paintFeed() {
		const out = [{ at: T.created, who: T.createdBy, what: 'added the task', icon: 'bi-plus-lg', tone: 'primary' }];
		T.comments.forEach((c) => out.push({ at: c.at, who: c.who, what: 'commented', icon: 'bi-chat-left-text' }));
		T.files.forEach((f) => out.push({ at: f.at, who: f.who, what: `attached ${f.name}`, icon: 'bi-paperclip' }));
		T.log.forEach((e) => out.push(Object.assign({ icon: 'bi-pencil' }, e)));
		if (T.done && !T.log.some((e) => e.what === 'marked it complete'))
			out.push({
				at: T.doneAt,
				who: T.assignee || ME,
				what: 'marked it complete',
				icon: 'bi-check2-circle',
				tone: 'success',
			});
		out.sort((a, b) => b.at.localeCompare(a.at));
		pick('[data-tkd="feed"]').innerHTML = out
			.map(
				(e) =>
					`<li class="tkd-feed-item"${e.tone ? ` data-tone="${e.tone}"` : ''}><span class="tkd-feed-mark" aria-hidden="true"><i class="bi ${e.icon}"></i></span><div><p class="tkd-feed-what"><strong>${htmlSafe(nameOrYou(e.who))}</strong> ${htmlSafe(e.what)}</p><p class="tkd-feed-when">${stamp(e.at)}</p></div></li>`,
			)
			.join('');
	}

	function render() {
		paintHead();
		paintWork();
		paintDetails();
		paintComments();
		paintFeed();
		if (window.Basalt.tips) window.Basalt.tips(root);
	}

	/* Actions */
	function toggleDone() {
		const snap = snapshot();
		T.done = !T.done;
		if (T.done) {
			T.doneAt = now();
			logIt('marked it complete', 'bi-check2-circle', 'success');
		} else {
			T.doneAt = null;
			logIt('reopened it', 'bi-arrow-counterclockwise', 'warning');
		}
		render();
		pick('[data-tkd-toggle]').focus();
		toast({
			tone: T.done ? 'success' : 'info',
			icon: T.done ? 'bi-check2-circle' : 'bi-arrow-counterclockwise',
			title: T.done ? 'Task complete' : 'Task reopened',
			text: T.done
				? 'It moves to Done on To Dos.'
				: `It is back on the list${T.due ? `, due ${relDay(T.due).toLowerCase()}.` : '.'}`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						restore(snap);
					},
				},
			],
		});
	}

	function bind() {
		pick('[data-tkd-toggle]').addEventListener('click', toggleDone);

		root.addEventListener('change', (e) => {
			const box = e.target.closest('[data-tkd-step]');
			if (!box) return;
			const i = +box.getAttribute('data-tkd-step');
			const s = T.steps[i];
			s.done = box.checked;
			logIt(
				(s.done ? 'checked off a step: ' : 'unchecked a step: ') + s.title,
				s.done ? 'bi-check2-square' : 'bi-square',
			);
			paintWork();
			paintFeed();
			const again = pick(`[data-tkd-step="${i}"]`);
			if (again) again.focus();
			const left = T.steps.filter((x) => !x.done).length;
			announce(left ? `${plural(left, 'step')} left.` : 'Every step is done.');
			if (!left && !T.done) {
				toast({
					tone: 'success',
					icon: 'bi-list-check',
					title: 'Every step is done',
					text: 'Mark the task complete too?',
					actions: [
						{
							label: 'Mark complete',
							onClick() {
								toggleDone();
							},
						},
					],
				});
			}
		});

		root.addEventListener('click', (e) => {
			const rm = e.target.closest('[data-tkd-step-remove]');
			if (rm) {
				const snap = snapshot();
				const s = T.steps.splice(+rm.getAttribute('data-tkd-step-remove'), 1)[0];
				logIt(`removed a step: ${s.title}`, 'bi-dash-square');
				paintWork();
				paintFeed();
				pick('[data-tkd-step-new]').focus();
				toast({
					tone: 'info',
					icon: 'bi-trash3',
					title: 'Step removed',
					text: s.title,
					actions: [
						{
							label: 'Undo',
							onClick() {
								restore(snap);
							},
						},
					],
				});
				return;
			}
			const file = e.target.closest('[data-tkd-file]');
			if (file) {
				toast({
					tone: 'success',
					icon: 'bi-download',
					title: 'Downloading',
					text: T.files[+file.getAttribute('data-tkd-file')].name,
				});
				return;
			}
			if (e.target.closest('[data-tkd-desc-edit]')) {
				ui.editingDesc = true;
				pick('[data-tkd-desc-text]').value = T.notes || '';
				paintWork();
				pick('[data-tkd-desc-text]').focus();
				return;
			}
			if (e.target.closest('[data-tkd-desc-cancel]')) {
				ui.editingDesc = false;
				paintWork();
				pick('[data-tkd-desc-edit]').focus();
				return;
			}
			if (e.target.closest('[data-tkd-edit]')) {
				ui.editing = true;
				fillForm();
				paintDetails();
				pick('#tkd-who').focus();
				return;
			}
			if (e.target.closest('[data-tkd-cancel]')) {
				ui.editing = false;
				paintDetails();
				pick('[data-tkd-edit]').focus();
			}
		});

		pick('[data-tkd-desc-form]').addEventListener('submit', (e) => {
			e.preventDefault();
			const text = pick('[data-tkd-desc-text]').value.trim();
			ui.editingDesc = false;
			if (text !== (T.notes || '')) {
				T.notes = text;
				logIt(text ? 'edited the description' : 'cleared the description', 'bi-text-left');
				announce('Description saved.');
			}
			paintWork();
			paintFeed();
			pick('[data-tkd-desc-edit]').focus();
		});

		pick('[data-tkd-step-form]').addEventListener('submit', (e) => {
			e.preventDefault();
			const input = pick('[data-tkd-step-new]');
			const v = input.value.trim();
			if (!v) {
				input.focus();
				return;
			}
			T.steps.push({ id: `s${Date.now().toString(36)}`, title: v, done: false });
			logIt(`added a step: ${v}`, 'bi-plus-square');
			input.value = '';
			paintWork();
			paintFeed();
			if (window.Basalt.tips) window.Basalt.tips(pick('[data-tkd="steps"]'));
			input.focus();
			announce('Step added.');
		});

		pick('[data-tkd-form]').addEventListener('submit', (e) => {
			e.preventDefault();
			const snap = snapshot();
			const who = pick('[data-tkd-f="who"]').value || null;
			const lst = pick('[data-tkd-f="list"]').value;
			const pr = +pick('[data-tkd-f="priority"]').value;
			const due = window.Basalt.datepicker ? window.Basalt.datepicker.get(pick('[data-tkd-due]')) || null : T.due;
			const changes = [];
			if (who !== T.assignee) changes.push(who ? `assigned it to ${nameOf(who)}` : 'unassigned it');
			if (due !== T.due) changes.push(due ? `moved the due date to ${day(due)}` : 'removed the due date');
			if (lst !== T.list) changes.push(`moved it to ${list(lst).name}`);
			if (pr !== T.priority) changes.push(`set the priority to ${PRIORITY[pr].name}`);
			Object.assign(T, { assignee: who, due, list: lst, priority: pr });

			for (const c of changes) {
				logIt(c, 'bi-pencil');
			}

			ui.editing = false;
			render();
			pick('#tkd-details-title').focus();
			if (changes.length)
				toast({
					tone: 'success',
					icon: 'bi-check2-circle',
					title: 'Changes saved',
					text:
						changes[0].charAt(0).toUpperCase() +
						changes[0].slice(1) +
						(changes.length > 1 ? `, and ${plural(changes.length - 1, 'more change')}.` : '.'),
					actions: [
						{
							label: 'Undo',
							onClick() {
								restore(snap);
							},
						},
					],
				});
		});

		const reply = pick('[data-tkd-reply]');
		const text = pick('[data-tkd-reply-text]');
		reply.addEventListener('submit', (e) => {
			e.preventDefault();
			const v = text.value.trim();
			if (!v) {
				text.classList.add('is-invalid');
				text.focus();
				return;
			}
			T.comments.push({ at: now(), who: ME, text: v });
			text.value = '';
			paintComments();
			paintFeed();
			announce('Comment posted.');
		});
		text.addEventListener('input', () => {
			if (text.value.trim()) text.classList.remove('is-invalid');
		});

		pick('[data-tkd-drop]').addEventListener('basalt:files', (e) => {
			const snap = snapshot();
			const f = e.detail.files[0];
			const kb = Math.max(1, Math.round(f.size / 1024));
			T.files.push({
				name: f.name,
				size: kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`,
				at: now(),
				who: ME,
			});
			paintWork();
			paintFeed();
			if (window.Basalt.tips) window.Basalt.tips(pick('[data-tkd="files"]'));
			toast({
				tone: 'success',
				icon: 'bi-paperclip',
				title: 'File attached',
				text: f.name,
				actions: [
					{
						label: 'Undo',
						onClick() {
							restore(snap);
						},
					},
				],
			});
		});

		pick('[data-tkd-copy]').addEventListener('click', () => {
			if (window.Basalt.copyText) window.Basalt.copyText(new URL(pageOf(T), window.location.href).href);
			toast({
				tone: 'success',
				icon: 'bi-link-45deg',
				title: 'Link copied',
				text: 'It opens this task for anyone on the team.',
			});
		});
		pick('[data-tkd-print]').addEventListener('click', () => window.print());
	}

	function start() {
		render();
		bind();
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
	else start();
})();
