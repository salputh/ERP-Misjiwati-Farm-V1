/**
 * Basalt - Activities (activities.html)
 * One log of the sales team's calls, emails, meetings and notes with
 * leads and customers. What is due comes first (overdue, today, then
 * coming up), and everything done follows, newest first.
 *
 * A row opens the lead, deal or company the activity belongs to; the
 * panel icon opens a quick view. Marking one done stays on the row:
 * it moves to Done and a toast offers Undo.
 *
 * To use your own activities:
 *   Replace assets/basalt/js/data/multipurpose/activities.js with what your CRM returns,
 *   in the same shape. Records are looked up in accounts.js, deals.js
 *   and companies.js, so names and links match the CRM pages.
 * Built from shared parts in basalt.js: styled selects, segmented
 * controls, the datepicker, avatars, toasts with undo, the side panel
 * and tooltips.
 */
(() => {
	'use strict';
	const root = pick('[data-act-root]');
	const DATA = window.Basalt.data && window.Basalt.data.activities;
	const SALES = window.Basalt.data && window.Basalt.data.deals;
	const COS = window.Basalt.data && window.Basalt.data.companies;
	if (!root || !DATA || !SALES || !COS) return;

	function start() {
		modal.addEventListener('shown.bs.modal', () => {
			const t = pick('input[name="actFType"]:checked', form);
			if (t) t.focus();
		});
		f.time.addEventListener('change', updateState);
		f.date.addEventListener('change', updateState);

		form.addEventListener('submit', (e) => {
			e.preventDefault();
			f.title.value = f.title.value.trim();
			form.classList.add('was-validated');
			if (!form.checkValidity()) {
				const bad = pick(':invalid:not(fieldset)', form);
				if (bad) (bad.matches('select') ? pick('button', bad.closest('.act-field')) || bad : bad).focus();
				return;
			}
			const [kind, relId, person] = f.who.value.split('|');
			const at = formWhen();
			const type = typeValue();
			const nextNo = Math.max(...state.items.map((a) => Number(a.id.slice(3)))) + 1;
			const a = {
				id: `#${nextNo}`,
				type,
				title: f.title.value,
				at,
				done: parse(at) <= NOW,
				owner: DATA.me,
				with: person,
				rel: { kind, id: relId },
				minutes: type === 'call' ? 15 : type === 'meeting' ? 30 : 0,
				notes: f.notes.value.trim(),
			};
			state.items.push(a);
			bootstrap.Modal.getOrCreateInstance(modal).hide();
			render();
			say(`${a.title} logged.`);
			toast({
				tone: 'success',
				icon: 'bi-journal-check',
				title: 'Activity logged',
				text: a.title + (a.done ? ' is in Done.' : ` is on the list: ${whenText(a)}.`),
				actions: [
					{
						label: 'Undo',
						onClick() {
							const i = state.items.indexOf(a);
							if (i >= 0) state.items.splice(i, 1);
							render();
						},
					},
				],
			});
		});

		render();
		(window.Basalt.settled || Promise.resolve()).then(wave);
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

	/* Dates
	   Times are "YYYY-MM-DDTHH:MM" in the viewer's time zone. The demo's
	   clock is DATA.now; in your app, use new Date(). */
	function parse(s) {
		const [d, t] = s.split('T');
		const [y, m, dd] = d.split('-').map(Number);
		const [h, mi] = (t || '00:00').split(':').map(Number);
		return new Date(y, m - 1, dd, h, mi);
	}

	const NOW = parse(DATA.now);

	function dayStart(d) {
		return new Date(d.getFullYear(), d.getMonth(), d.getDate());
	}

	const TODAY = dayStart(NOW);
	const DAY = 864e5;

	function dayDiff(d) {
		return Math.round((dayStart(d) - TODAY) / DAY);
	}

	/* Monday of this week, for "done this week". */
	const WEEK_START = new Date(TODAY.getTime() - ((TODAY.getDay() + 6) % 7) * DAY);

	function time12(d) {
		return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	}

	function dayShort(d) {
		return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}

	function dayLong(d) {
		return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
	}

	function iso(d) {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function whenText(a, long) {
		const d = parse(a.at);
		const diff = dayDiff(d);
		const near = { '-1': 'Yesterday', 0: 'Today', 1: 'Tomorrow' }[diff];
		if (near) return `${near}, ${time12(d)}`;
		if (long) return `${dayLong(d)}, ${time12(d)}`;
		return `${a.done ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : dayShort(d)}, ${time12(d)}`;
	}

	/* Records
	   Each activity points at a lead, a deal or a company. */
	const KIND = { lead: 'Lead', deal: 'Deal', company: 'Company' };
	const recCache = {};
	function record(a) {
		const key = `${a.rel.kind}:${a.rel.id}`;
		if (recCache[key]) return recCache[key];
		let r = null;
		if (a.rel.kind === 'lead') {
			const l = SALES.lead(a.rel.id);
			if (l)
				r = {
					name: l.company,
					detail: `${l.name}, ${l.title}`,
					href: `lead-details.html?id=${encodeURIComponent(l.id)}`,
					people: [{ name: l.name, title: l.title, email: l.email, phone: l.phone }],
				};
		} else if (a.rel.kind === 'deal') {
			const d = SALES.find(a.rel.id);
			if (d)
				r = {
					name: d.company,
					detail: d.title,
					href: `deal-details.html?id=${encodeURIComponent(d.id)}`,
					people: d.people || [],
				};
		} else {
			const c = COS.find(a.rel.id);
			if (c)
				r = {
					name: c.name,
					detail: c.city || '',
					href: `company-details.html?id=${encodeURIComponent(c.id)}`,
					people: c.people || [],
				};
		}
		r = r || { name: a.rel.id, detail: '', href: 'leads.html', people: [] };
		r.kind = KIND[a.rel.kind];
		recCache[key] = r;
		return r;
	}

	function personOf(a) {
		return record(a).people.find((p) => p.name === a.with) || { name: a.with };
	}

	/* State */
	const DONE_ROWS = 8;
	const state = {
		items: DATA.list(),
		query: '',
		type: 'all',
		owner: 'all',
		expanded: false,
		open: null,
	};

	function nodeById(id) {
		return state.items.find((a) => a.id === id);
	}

	function groupFor(a) {
		if (a.done) return 'done';
		const d = parse(a.at);
		if (d < NOW) return 'late';
		if (dayDiff(d) === 0) return 'today';
		return 'week';
	}
	const GROUPS = {
		late: { name: 'Overdue', empty: 'Nothing overdue.' },
		today: { name: 'Later today', empty: 'Nothing else today.' },
		week: { name: 'Coming up', empty: 'Nothing planned yet.' },
		done: { name: 'Done', empty: 'Nothing done yet.' },
	};

	function matches(a) {
		if (state.type !== 'all' && a.type !== state.type) return false;
		if (state.owner !== 'all' && a.owner !== state.owner) return false;
		const q = state.query.trim().toLowerCase();
		if (!q) return true;
		const r = record(a);
		const hay = [a.title, a.with, r.name, r.detail, a.notes, a.owner, DATA.types[a.type].label]
			.join(' ')
			.toLowerCase();
		return q.split(/\s+/).every((w) => hay.includes(w));
	}
	function sorted(group, list) {
		function asc(x, y) {
			return parse(x.at) - parse(y.at);
		}

		return group === 'done' ? list.sort((x, y) => asc(y, x)) : list.sort(asc);
	}

	/* Elements */
	const el = {
		summary: pick('[data-act-summary]', root),
		search: pick('[data-act-search]', root),
		type: pick('[data-act-kind]', root),
		owner: pick('[data-act-owner]', root),
		table: pick('[data-act-table]', root),
		empty: pick('[data-act-empty]', root),
		foot: pick('[data-act-foot]', root),
		footNote: pick('[data-act-foot-note]', root),
		more: pick('[data-act-more]', root),
		live: pick('[data-act-live]', root),
		groups: {},
		figs: {},
	};

	for (const g of pickAll('[data-act-group]', root)) {
		el.groups[g.dataset.actGroup] = g;
	}

	for (const f of pickAll('[data-act-fig]', root)) {
		el.figs[f.dataset.actFig] = f;
	}

	function say(t) {
		el.live.textContent = '';
		setTimeout(() => {
			el.live.textContent = t;
		}, 30);
	}

	/* Owner filter: everyone who owns an activity, you first. */
	(function fillOwners() {
		const owners = [...new Set(state.items.map((a) => a.owner))].sort(
			(a, b) => (b === DATA.me) - (a === DATA.me) || a.localeCompare(b),
		);
		el.owner.insertAdjacentHTML(
			'beforeend',
			owners
				.map((o) => `<option value="${htmlSafe(o)}">${htmlSafe(o)}${o === DATA.me ? ' (you)' : ''}</option>`)
				.join(''),
		);
		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(el.owner);
	})();

	/* Rows */
	function avatar(name, size) {
		return `<span class="basalt-avatar ${size || 'basalt-avatar-xs'}" data-basalt-avatar data-name="${htmlSafe(name)}" aria-hidden="true"></span>`;
	}

	function chip(a) {
		const t = DATA.types[a.type];
		return `<span class="act-chip act-tone-${t.tone}" aria-hidden="true"><i class="bi ${t.icon}"></i></span>`;
	}
	function metaText(a) {
		const t = DATA.types[a.type];
		if (a.type === 'note') return `Note about ${a.with}`;
		if (a.type === 'email') return `Email to ${a.with}`;
		return `${t.label} with ${a.with}`;
	}

	function rowHtml(a) {
		const r = record(a);
		const g = groupFor(a);
		const open = a.id === state.open;
		return `<tr class="act-row${open ? ' is-open' : ''}" data-act-id="${htmlSafe(a.id)}"><td class="act-row-what"><div class="act-what">${chip(a)}<div class="act-what-text"><p class="act-row-title"><a class="act-row-link" href="${htmlSafe(r.href)}">${htmlSafe(a.title)}</a></p><p class="act-row-meta">${htmlSafe(metaText(a))}<span class="act-row-rel-inline"> · ${htmlSafe(r.name)}</span></p></div></div></td><td class="act-row-rel"><span class="act-rel"><span class="act-rel-kind">${r.kind}</span><span class="act-rel-name">${htmlSafe(r.name)}</span></span></td><td class="act-row-when"><span class="act-when-cell${g === 'late' ? ' is-late' : ''}">${g === 'late' ? '<span class="visually-hidden">Overdue: </span>' : ''}${htmlSafe(whenText(a))}</span></td><td class="act-row-owner"><span class="act-owner">${avatar(a.owner)}<span class="act-owner-name">${htmlSafe(a.owner)}</span></span></td><td class="act-row-open"><span class="basalt-row-actions">${a.done ? '<span class="act-spacer" aria-hidden="true"></span>' : `<button type="button" class="btn btn-icon btn-sm" data-act-done="${htmlSafe(a.id)}" aria-label="Mark done: ${htmlSafe(a.title)}"${tip('Mark done')}><i class="bi bi-check2-circle" aria-hidden="true"></i></button>`}<button type="button" class="btn btn-icon btn-sm" data-act-open="${htmlSafe(a.id)}" aria-label="Quick view: ${htmlSafe(a.title)}"${tip('Quick view')}><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${htmlSafe(r.href)}" aria-label="Open ${r.kind.toLowerCase()}: ${htmlSafe(r.name)}"${tip(`Open ${r.kind.toLowerCase()}`)}><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span></td></tr>`;
	}

	function headHtml(g, n) {
		/* One cell per column, so hiding a column at narrower widths hides it here too. */
		return `<tr class="act-group-head"><th scope="colgroup" class="act-group-cell"><span class="act-group-name">${GROUPS[g].name}</span><span class="act-group-count">${n}</span></th><td class="act-row-rel"></td><td class="act-row-when"></td><td class="act-row-owner"></td><td class="act-row-open"></td></tr>`;
	}

	function emptyHtml(kind) {
		const S =
			kind === 'search'
				? {
						icon: 'bi-search',
						title: `No activities match “${htmlSafe(state.query.trim())}”`,
						text: 'Search looks at titles, people, companies and notes.',
						btn: '<button type="button" class="btn btn-sm btn-outline-secondary" data-act-clear>Clear the search</button>',
					}
				: kind === 'filter'
					? {
							icon: 'bi-funnel',
							title: 'Nothing for these filters',
							text: 'Try another type or owner.',
							btn: '<button type="button" class="btn btn-sm btn-outline-secondary" data-act-clear-filters>Show everything</button>',
						}
					: {
							icon: 'bi-journal-text',
							title: 'No activities yet',
							text: 'Log a call, email, meeting or note, and it shows up here.',
							btn: '<button type="button" class="btn btn-sm btn-primary" data-act-log>Log activity</button>',
						};
		return `<div class="basalt-empty basalt-empty-compact act-empty"><span class="act-empty-icon" aria-hidden="true"><i class="bi ${S.icon}"></i></span><h3 class="basalt-empty-title">${S.title}</h3><p class="basalt-empty-text">${S.text}</p><div class="basalt-empty-actions">${S.btn}</div></div>`;
	}

	function render() {
		const shown = state.items.filter(matches);
		const by = { late: [], today: [], week: [], done: [] };

		for (const a of shown) {
			by[groupFor(a)].push(a);
		}

		for (const g of Object.keys(by)) {
			const list = sorted(g, by[g]);
			const rows = g === 'done' && !state.expanded ? list.slice(0, DONE_ROWS) : list;
			el.groups[g].innerHTML = list.length ? headHtml(g, list.length) + rows.map(rowHtml).join('') : '';
			el.groups[g].hidden = !list.length;
		}

		const none = !shown.length;
		el.table.hidden = none;
		el.empty.hidden = !none;
		el.empty.innerHTML = none
			? emptyHtml(!state.items.length ? 'none' : state.query.trim() ? 'search' : 'filter')
			: '';
		const doneN = by.done.length;
		el.foot.hidden = doneN <= DONE_ROWS;
		if (doneN > DONE_ROWS) {
			el.footNote.textContent = state.expanded
				? `Showing all ${doneN} done.`
				: `Showing the latest ${DONE_ROWS} of ${doneN} done.`;
			el.more.textContent = state.expanded ? 'Show fewer' : `Show all ${doneN}`;
			el.more.setAttribute('aria-expanded', String(state.expanded));
		}
		if (window.Basalt.avatars) window.Basalt.avatars(el.table);
		if (window.Basalt.tips) window.Basalt.tips(el.table);
		renderFigures();
	}

	/* Replays the tile ripple; the class comes off when the last tile ends. */
	function wave() {
		const band = pick('.act-band', root);
		if (!band || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		band.classList.remove('is-waving');
		void band.offsetWidth;
		band.classList.add('is-waving');
		band.lastElementChild.addEventListener('animationend', () => band.classList.remove('is-waving'), {
			once: true,
		});
	}

	function renderFigures() {
		const open = state.items.filter((a) => !a.done);
		const late = open.filter((a) => groupFor(a) === 'late').length;
		const today = open.filter((a) => groupFor(a) === 'today').length;
		const week = open.filter((a) => {
			const d = dayDiff(parse(a.at));
			return groupFor(a) === 'week' && d <= 7;
		}).length;
		const done = state.items.filter((a) => a.done && parse(a.at) >= WEEK_START).length;
		el.figs.late.textContent = late;
		el.figs.today.textContent = today;
		el.figs.week.textContent = week;
		el.figs.done.textContent = done;
		pick('[data-act-tile="late"]', root).classList.toggle('is-clear', !late);
		const parts = [];
		if (late) parts.push(`${late} overdue`);
		parts.push(today ? `${today} more today` : 'nothing else today');
		el.summary.textContent = `Due first, then done. ${parts.join(', ').replace(/^./, (c) => c.toUpperCase())}.`;
	}

	/* Marking done, with Undo */
	function setDone(id, done) {
		const a = nodeById(id);
		if (!a) return;
		a.done = done;
		render();
		wave();
		if (state.open === id) drawRecord(a);
	}
	function markDone(id) {
		const a = nodeById(id);
		if (!a || a.done) return;
		setDone(id, true);
		say(`${a.title} marked done.`);
		toast({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'Marked done',
			text: `${a.title} moved to Done.`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						setDone(id, false);
						say(`Back on the list: ${a.title}.`);
					},
				},
			],
		});
	}
	function reopen(id) {
		const a = nodeById(id);
		if (!a || !a.done) return;
		setDone(id, false);
		toast({
			tone: 'info',
			icon: 'bi-arrow-counterclockwise',
			title: 'Back on the list',
			text: `${a.title} is to do again.`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						setDone(id, true);
					},
				},
			],
		});
	}

	/* Opening a row
	   The row goes to the record it belongs to, like its title does (Cmd
	   or Ctrl click, or middle click, opens a new tab). Only the panel
	   icon opens the quick view. */
	function onRowClick(e) {
		const done = e.target.closest('[data-act-done]');
		if (done) {
			markDone(done.dataset.actDone);
			return;
		}
		const quick = e.target.closest('[data-act-open]');
		if (quick) {
			showSheet(quick.dataset.actOpen);
			return;
		}
		if (e.target.closest('a, button')) return;
		const link = e.target.closest('tr[data-act-id]')?.querySelector('.act-row-link');
		if (!link) return;
		if (e.metaKey || e.ctrlKey || e.button === 1) window.open(link.href, '_blank', 'noopener');
		else location.href = link.href;
	}
	el.table.addEventListener('click', onRowClick);
	el.table.addEventListener('auxclick', (e) => {
		if (e.button === 1 && !e.target.closest('a, button')) onRowClick(e);
	});

	/* Search and filters */
	let findDelay = 0;
	el.search.addEventListener('input', () => {
		clearTimeout(findDelay);
		findDelay = setTimeout(() => {
			state.query = el.search.value;
			render();
			if (state.query.trim())
				say(`${plural(state.items.filter(matches).length, 'activity', 'activities')} found`);
		}, 120);
	});
	el.search.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && el.search.value) {
			e.preventDefault();
			clearSearch();
		}
	});
	function clearSearch() {
		el.search.value = '';
		state.query = '';
		render();
		el.search.focus();
	}
	function setSelect(sel, v) {
		if (sel.value !== v) {
			sel.value = v;
			sel.dispatchEvent(new Event('change', { bubbles: true }));
		}
	}
	el.type.addEventListener('change', () => {
		state.type = el.type.value;
		render();
	});
	el.owner.addEventListener('change', () => {
		state.owner = el.owner.value;
		render();
	});
	el.more.addEventListener('click', () => {
		window.Basalt.slide(el.table, () => {
			state.expanded = !state.expanded;
			render();
		});
	});

	root.addEventListener('click', (e) => {
		if (e.target.closest('[data-act-clear]')) {
			clearSearch();
			return;
		}
		if (e.target.closest('[data-act-clear-filters]')) {
			setSelect(el.type, 'all');
			setSelect(el.owner, 'all');
			return;
		}
		if (e.target.closest('[data-act-log]')) {
			openLog();
			return;
		}
		if (e.target.closest('[data-act-export]')) downloadCsv();
	});

	function downloadCsv() {
		function q(v) {
			return `"${String(v).replace(/"/g, '""')}"`;
		}

		const rows = [
			['Number', 'Type', 'Activity', 'When', 'Status', 'With', 'Related to', 'Record', 'Owner', 'Notes'],
		];
		state.items.forEach((a) => {
			const r = record(a);
			rows.push([
				a.id,
				DATA.types[a.type].label,
				a.title,
				a.at.replace('T', ' '),
				a.done ? 'Done' : 'To do',
				a.with,
				r.kind,
				r.name,
				a.owner,
				a.notes,
			]);
		});
		const blob = new Blob([rows.map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = 'activities.csv';
		link.click();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000);
		toast({
			tone: 'success',
			icon: 'bi-download',
			title: 'Export ready',
			text: `activities.csv has all ${state.items.length} activities.`,
		});
	}

	/* The quick view */
	const drawer = pick('#act-drawer');
	const dEl = {
		title: pick('[data-act-d="title"]', drawer),
		sub: pick('[data-act-d="sub"]', drawer),
		full: pick('[data-act-d="full"]', drawer),
		fullLabel: pick('[data-act-d="full-label"]', drawer),
		body: pick('[data-act-d="body"]', drawer),
		foot: pick('[data-act-d="foot"]', drawer),
	};

	function panel() {
		return bootstrap.Offcanvas.getOrCreateInstance(drawer);
	}

	const STATUS = {
		late: ['danger', 'Overdue'],
		today: ['warning', 'Due today'],
		week: ['info', 'Coming up'],
		done: ['success', 'Done'],
	};

	function drawRecord(a) {
		const r = record(a);
		const p = personOf(a);
		const t = DATA.types[a.type];
		const st = STATUS[groupFor(a)];
		dEl.title.textContent = a.title;
		dEl.sub.textContent = `${t.label} · ${whenText(a)}`;
		dEl.full.href = r.href;
		dEl.fullLabel.textContent = `Open ${r.kind.toLowerCase()}`;

		function fact(k, v) {
			return `<div class="act-facts-row"><dt>${k}</dt><dd>${v}</dd></div>`;
		}

		dEl.body.innerHTML = `<div class="act-d-top">${chip(a)}<span class="basalt-status basalt-status-dot basalt-status-${st[0]}">${st[1]}</span></div><dl class="act-facts">${fact('When', htmlSafe(whenText(a, true)) + (a.minutes ? ` <span class="act-quiet">· ${a.minutes} min</span>` : ''))}${fact('With', htmlSafe(p.name) + (p.title ? ` <span class="act-quiet">· ${htmlSafe(p.title)}</span>` : ''))}${p.email ? fact('Email', `<a class="act-link" href="mailto:${htmlSafe(p.email)}">${htmlSafe(p.email)}</a>`) : ''}${p.phone ? fact('Phone', `<a class="act-link" href="tel:${htmlSafe(p.phone.replace(/\s+/g, ''))}">${htmlSafe(p.phone)}</a>`) : ''}${fact(r.kind, `<a class="act-link" href="${htmlSafe(r.href)}">${htmlSafe(r.name)}</a>${r.detail && a.rel.kind === 'deal' ? ` <span class="act-quiet">· ${htmlSafe(r.detail)}</span>` : ''}`)}${fact('Owner', `<span class="act-owner">${avatar(a.owner)}<span>${htmlSafe(a.owner)}</span></span>`)}</dl><h3 class="act-d-heading">Notes</h3><p class="act-d-notes">${a.notes ? htmlSafe(a.notes) : '<span class="act-quiet">No notes.</span>'}</p>`;
		dEl.foot.innerHTML = `<button type="button" class="btn btn-outline-secondary me-auto" data-bs-dismiss="offcanvas">Close</button>${a.done ? '<button type="button" class="btn btn-outline-secondary" data-act-d-reopen><i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Reopen</button>' : '<button type="button" class="btn btn-primary" data-act-d-done><i class="bi bi-check2-circle me-1" aria-hidden="true"></i>Mark done</button>'}`;
		if (window.Basalt.avatars) window.Basalt.avatars(drawer);
	}

	function showSheet(id) {
		const a = nodeById(id);
		if (!a) return;
		state.open = id;
		drawRecord(a);

		for (const r of pickAll('.act-row.is-open', root)) {
			r.classList.remove('is-open');
		}

		pick(`tr[data-act-id="${CSS.escape(id)}"]`, root)?.classList.add('is-open');
		panel().show();
	}
	drawer.addEventListener('shown.bs.offcanvas', () => dEl.title.focus());
	drawer.addEventListener('hidden.bs.offcanvas', () => {
		const id = state.open;
		state.open = null;

		for (const r of pickAll('.act-row.is-open', root)) {
			r.classList.remove('is-open');
		}

		pick(`[data-act-open="${CSS.escape(id || '')}"]`, root)?.focus();
	});
	drawer.addEventListener('click', (e) => {
		/* Acting from the quick view closes it; the toast keeps Undo. */
		const done = e.target.closest('[data-act-d-done]');
		const again = e.target.closest('[data-act-d-reopen]');
		if (!done && !again) return;
		if (done) markDone(state.open);
		else reopen(state.open);
		panel().hide();
	});

	/* Log activity */
	const modal = pick('#act-log');
	const form = pick('[data-act-form]', modal);
	const f = {
		who: pick('[data-act-f="who"]', form),
		title: pick('[data-act-f="title"]', form),
		time: pick('[data-act-f="time"]', form),
		notes: pick('[data-act-f="notes"]', form),
		date: pick('[data-act-day]', form),
		state: pick('[data-act-f-state]', form),
	};

	/* Who: open leads, people on open deals, and customers' main contacts. */
	(function fillWho() {
		function opt(v, label, hint) {
			return `<option value="${htmlSafe(v)}" data-hint="${htmlSafe(hint)}">${htmlSafe(label)}</option>`;
		}

		const leads = SALES.leads().filter((l) => l.stage !== 'converted' && l.stage !== 'notnow');
		const deals = SALES.list().filter((d) => d.stage !== 'signed' && d.stage !== 'lost');
		const cos = COS.list().filter((c) => c.stage === 'customer' && c.people && c.people.length);
		f.who.innerHTML = `<option value="">Pick a person</option><optgroup label="Leads">${leads.map((l) => opt(`lead|${l.id}|${l.name}`, l.name, l.company)).join('')}</optgroup><optgroup label="Deals">${deals.flatMap((d) => (d.people || []).map((p) => opt(`deal|${d.id}|${p.name}`, p.name, d.company))).join('')}</optgroup><optgroup label="Companies">${cos.map((c) => opt(`company|${c.id}|${c.people[0].name}`, c.people[0].name, c.name)).join('')}</optgroup>`;
		/* Times every half hour, 7:00 AM to 7:00 PM. */
		let html = '';
		for (let m = 7 * 60; m <= 19 * 60; m += 30) {
			const d = new Date(2026, 0, 1, Math.floor(m / 60), m % 60);
			const v = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
			html += `<option value="${v}">${time12(d)}</option>`;
		}
		f.time.innerHTML = html;
		if (window.Basalt.select && window.Basalt.select.refresh) {
			window.Basalt.select.refresh(f.who);
			window.Basalt.select.refresh(f.time);
		}
	})();

	function typeValue() {
		return (pick('input[name="actFType"]:checked', form) || {}).value || 'call';
	}

	function formWhen() {
		const day = (window.Basalt.datepicker && window.Basalt.datepicker.get(f.date)) || iso(TODAY);
		return `${day}T${f.time.value}`;
	}

	function updateState() {
		const future = parse(formWhen()) > NOW;
		f.state.textContent = future ? 'It goes on the list to do.' : 'It goes on the list as done.';
	}

	function openLog() {
		form.reset();
		form.classList.remove('was-validated');
		f.who.value = '';
		/* The next half hour from now. */
		const next = new Date(Math.ceil(NOW.getTime() / (30 * 6e4)) * 30 * 6e4);
		f.time.value = `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;
		if (window.Basalt.datepicker) window.Basalt.datepicker.set(f.date, iso(TODAY));
		updateState();
		bootstrap.Modal.getOrCreateInstance(modal).show();
	}
	start();

	/* DOM lookups, shared by every helper above. */
	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
