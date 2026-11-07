/**
 * Basalt - People at Companies (people-at-companies.html)
 * Everyone at your customer and prospect companies in one list: the
 * people you sell to and the people who sign in to Fieldline. Each row
 * shows their company, their role at the account, when they last
 * signed in and the deal they are on. A row opens their own page
 * (person-details.html?id=<key>), as do the name and the expand icon;
 * the panel icon opens a quick view that steps through the list. A second drawer adds a person.
 *
 * The people come from assets/basalt/js/data/multipurpose/members.js, which reads the
 * shared accounts and deals. To use your own data, return the same
 * shape from your backend.
 */
(() => {
	'use strict';
	const root = pick('[data-ct-root]');
	if (!root) return;

	function start() {
		root.addEventListener('auxclick', (e) => {
			if (e.button === 1) openRowPage(e);
		});
		root.addEventListener('click', (e) => {
			const open = e.target.closest('.ct-table [data-ct-open]');
			if (open) {
				openPerson(open.dataset.ctOpen);
				return;
			}
			if (openRowPage(e)) return;
			if (e.target.closest('[data-ct-more]')) {
				window.Basalt.slide(el.rows.closest('.ct-table-wrap'), () => {
					state.showAll = !state.showAll;
					render();
				});
				const again = pick('[data-ct-more]', el.foot);
				if (again) again.focus();
				return;
			}
			if (e.target.closest('[data-ct-reset]')) resetFilters();
			if (e.target.closest('[data-ct-export]')) downloadCsv();
		});

		showRoleNote();
		drawChips();
		drawSub();
		render();
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(s) {
		return String(s == null ? '' : s).replace(
			/[&<>"']/g,
			(c) =>
				({
					'&': '&amp;',
					'<': '&lt;',
					'>': '&gt;',
					'"': '&quot;',
					"'": '&#39;',
				})[c],
		);
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	/* Demo clock. "Signed in 2 hours ago" and local times are worked out
     from this moment so the demo always reads the same. In a live app
     use new Date(). */
	const NOW = new Date('2026-10-08T15:30:00Z');
	const DAY = 864e5;
	const TODAY = new Date(Date.UTC(2026, 9, 8));

	const BOOK = window.Basalt.data.accounts;
	const MEMBERS = window.Basalt.data.members;
	const SALES = window.Basalt.data.deals;
	const ROLES = MEMBERS.roles;
	const ROLE_ORDER = ['owner', 'billing', 'admin', 'member', 'contact'];
	const STAGE = {};
	SALES.stages.forEach((s) => {
		STAGE[s.id] = s.name;
	});
	const KIND = { customer: '', trial: 'On trial', new: 'New customer', prospect: 'Prospect' };
	const VIA = {
		call: { icon: 'bi-telephone', label: 'Call' },
		email: { icon: 'bi-envelope', label: 'Email' },
		meeting: { icon: 'bi-camera-video', label: 'Video call' },
	};

	/* Customer companies, for the company filter and the add form. */
	const ACCOUNTS = {};
	BOOK.list().forEach((a) => {
		ACCOUNTS[a.id] = {
			name: a.name,
			city: a.city,
			tz: a.tz,
			site: a.site,
			activity: a.activity,
			kind: a.status === 'trial' ? 'trial' : 'customer',
		};
	});

	/* A person's calls, emails and meetings, newest first: the account's
     log for customers, the deal's history for prospects. d is days
     before today. */
	function daysBefore(iso) {
		return Math.round(
			(TODAY - new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)))) / DAY,
		);
	}

	const DEAL_ICON = {
		envelope: 'email',
		chat: 'email',
		calendar: 'meeting',
		display: 'meeting',
		check: 'call',
		pen: 'email',
		eye: 'email',
		flag: 'call',
		note: 'call',
	};
	function logOf(p) {
		if (p.acct) {
			return ACCOUNTS[p.acct].activity
				.filter((e) => VIA[e[3]] && (e[4] || []).indexOf(p.key) >= 0)
				.map((e) => ({ d: daysBefore(e[0]), via: e[3], text: e[2], by: e[1] }));
		}
		const deal = p.deals.length ? SALES.find(p.deals[0].id) : null;
		return deal
			? deal.history.map((h) => ({ d: daysBefore(h[0]), via: DEAL_ICON[h[3]] || 'email', text: h[2], by: h[1] }))
			: [];
	}

	/* State */
	const PAGE_SIZE = 12;
	const people = MEMBERS.list().map((p, i) => Object.assign(p, { id: i + 1, log: logOf(p) }));
	const state = { q: '', show: 'all', role: 'all', acct: 'all', showAll: false, list: [] };

	const el = {
		rows: pick('[data-ct-rows]', root),
		empty: pick('[data-ct-empty]', root),
		foot: pick('[data-ct-foot]', root),
		status: pick('[data-ct-status]', root),
		chips: pick('[data-ct-chips]', root),
		search: pick('[data-ct-search]', root),
		acct: pick('[data-ct-acct]', root),
		role: pick('[data-ct-role-filter]', root),
		sub: pick('[data-ct-sub]', root),
		drawer: document.getElementById('ct-person'),
		add: document.getElementById('ct-add'),
		form: pick('[data-ct-form]'),
	};

	/* Links and words */
	function personUrl(p) {
		return `person-details.html?id=${encodeURIComponent(p.key)}`;
	}

	function companyUrl(acct) {
		return `company-details.html?id=${encodeURIComponent(acct)}`;
	}

	function dealUrl(id) {
		return `deal-details.html?id=${encodeURIComponent(id)}`;
	}

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	function dayMonth(iso) {
		return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
	}

	function shortDate(d) {
		const t = new Date(TODAY.getTime() - d * DAY);
		return `${MONTHS[t.getUTCMonth()]} ${t.getUTCDate()}`;
	}

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many}`;
	}

	function telHref(phone) {
		return `tel:${phone.replace(/[^+\d]/g, '')}`;
	}

	function avatar(name, size) {
		return `<span class="basalt-avatar ${size}" data-basalt-avatar data-name="${htmlSafe(name)}" aria-hidden="true"></span>`;
	}

	function rolePill(key) {
		return `<span class="ct-role ct-role-${key}">${htmlSafe(ROLES[key].label)}</span>`;
	}

	function signsIn(p) {
		return !!p.login;
	}

	/* When they last signed in, in words: "40 min ago", "3 hours ago",
     "Yesterday", "4 days ago", then the date. */
	function lastSeen(iso) {
		const t = new Date(`${iso.replace(' ', 'T')}:00Z`);
		const mins = Math.max(1, Math.round((NOW - t) / 6e4));
		if (mins < 60) return `${mins} min ago`;
		if (mins < 60 * 18) return `${plural(Math.round(mins / 60), 'hour', 'hours')} ago`;
		const days = Math.round((TODAY - Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())) / DAY);
		if (days <= 1) return 'Yesterday';
		if (days < 14) return `${days} days ago`;
		return dayMonth(iso);
	}
	/* The sign-in cell: [state, first line, quiet line]. */
	function signLine(p) {
		const l = p.login;
		if (!l) return ['none', 'No login', ''];
		if (!l.accepted) return ['invited', 'Invite sent', dayMonth(l.invited)];
		const recent = NOW - new Date(`${l.last.replace(' ', 'T')}:00Z`) < 3 * DAY;
		return [recent ? 'on' : 'away', lastSeen(l.last), l.how === 'sso' ? 'Company sign-in' : 'Password'];
	}

	function where(p) {
		return (KIND[p.kind] ? `${KIND[p.kind]} · ` : '') + p.city;
	}

	/* Each company once, A to Z, for the filter, prospects included. */
	const companies = Array.from(new Set(people.map((p) => p.company))).sort((x, y) => x.localeCompare(y));
	el.acct.insertAdjacentHTML(
		'beforeend',
		companies.map((c) => `<option value="${htmlSafe(c)}">${htmlSafe(c)}</option>`).join(''),
	);
	el.role.insertAdjacentHTML(
		'beforeend',
		ROLE_ORDER.map(
			(k) => `<option value="${k}" data-dot="series-${ROLES[k].tone}">${htmlSafe(ROLES[k].label)}</option>`,
		).join(''),
	);

	/* Chips and the card's sentence */
	const SHOW = [
		{ key: 'all', label: 'All', test: () => true },
		{ key: 'login', label: 'Signs in', test: signsIn },
		{ key: 'contact', label: 'Contacts only', test: (p) => !signsIn(p) },
	];
	function drawChips() {
		el.chips.innerHTML = SHOW.map(
			(c) =>
				`<button type="button" class="ct-chip" data-ct-show="${c.key}" aria-pressed="${state.show === c.key}">${c.label} <span class="ct-chip-n">${people.filter(c.test).length}</span></button>`,
		).join('');
	}
	function drawSub() {
		const cos = new Set(people.map((p) => p.company)).size;
		el.sub.textContent = `${plural(people.length, 'person', 'people')} at ${cos} companies. ${people.filter(signsIn).length} of them sign in to Fieldline.`;
	}

	/* List */
	function filtered() {
		const show = SHOW.find((c) => c.key === state.show);
		return people.filter((p) => {
			if (!show.test(p)) return false;
			if (state.role !== 'all' && p.role !== state.role) return false;
			if (state.acct !== 'all' && p.company !== state.acct) return false;
			if (
				state.q &&
				!Basalt.matchesQuery(
					[p.name, p.title, p.company, p.city, p.email, ROLES[p.role].label]
						.concat(p.deals.map((d) => d.title))
						.join(' '),
					state.q,
				)
			)
				return false;
			return true;
		});
	}

	function rowHtml(p) {
		const s = signLine(p);
		const deal = p.deals[0];
		const more = p.deals.length > 1 ? ` · +${p.deals.length - 1} more` : '';
		const dealLink = deal ? `<a class="ct-link" href="${dealUrl(deal.id)}">${htmlSafe(deal.title)}</a>` : '';
		const co = `<a class="ct-link ct-link-co" href="${companyUrl(p.companyId)}">${htmlSafe(p.company)}</a>`;
		return `<tr class="ct-row${current === p && el.drawer.classList.contains('show') ? ' is-open' : ''}" data-ct-id="${p.id}"><td class="ct-cell-who"><div class="ct-who">${avatar(p.name, 'basalt-avatar-sm')}<div class="ct-who-text"><a class="ct-line ct-line-name ct-link" href="${personUrl(p)}">${htmlSafe(p.name)}</a><span class="ct-sub">${htmlSafe(p.title)}</span></div></div></td><td class="ct-cell-co"><span class="ct-line">${co}</span><span class="ct-sub ct-sub-city">${htmlSafe(where(p))}</span>${deal ? `<span class="ct-sub ct-sub-deal">Deal: ${dealLink}</span>` : ''}</td><td class="ct-cell-role">${rolePill(p.role)}</td><td class="ct-cell-sign"><span class="ct-sign ct-sign-${s[0]}"><span class="ct-sign-dot" aria-hidden="true"></span><span class="ct-sign-when">${s[1]}</span></span>${s[2] ? `<span class="ct-cell-sub">${htmlSafe(s[2])}</span>` : ''}</td><td class="ct-cell-deal">${deal ? `<span class="ct-line">${dealLink}</span><span class="ct-sub">${htmlSafe(STAGE[deal.stage])}${more}</span>` : ''}</td><td class="ct-cell-open"><span class="basalt-row-actions ct-open"><button type="button" class="btn btn-icon btn-sm" data-ct-open="${p.id}" aria-label="Quick view: ${htmlSafe(p.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${personUrl(p)}" aria-label="Open full page: ${htmlSafe(p.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span></td></tr>`;
	}

	/* A search that finds nothing gets the shared state naming the term;
     filters with nobody in common say so, with a way back to everyone. */
	function emptyHtml() {
		if (state.q) return Basalt.emptyState({ query: state.q, noun: 'people' });
		return `<div class="basalt-empty" role="status"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-person-x"></i></span><p class="basalt-empty-title">Nobody matches these filters</p><p class="basalt-empty-text">Pick another company or role, or show everyone again.</p><button type="button" class="btn btn-sm btn-outline-secondary" data-ct-reset>Show everyone</button></div>`;
	}

	function render() {
		state.list = filtered();
		const total = state.list.length;
		const shown = state.showAll ? state.list : state.list.slice(0, PAGE_SIZE);
		el.rows.innerHTML = shown.map(rowHtml).join('');
		if (window.Basalt.avatars) window.Basalt.avatars(el.rows);
		if (window.Basalt.tips) window.Basalt.tips(el.rows);
		el.rows.closest('table').hidden = !total;
		el.empty.hidden = total > 0;
		el.empty.innerHTML = total ? '' : emptyHtml();
		if (total > PAGE_SIZE) {
			el.foot.hidden = false;
			el.foot.innerHTML = `<p class="ct-foot-text">Showing ${shown.length} of ${plural(total, 'person', 'people')}.</p><button type="button" class="btn btn-sm btn-outline-secondary" data-ct-more>${state.showAll ? 'Show fewer' : `Show all ${total}`}</button>`;
		} else {
			el.foot.hidden = true;
			el.foot.textContent = '';
		}
		el.status.textContent = total ? `${plural(total, 'person', 'people')} shown.` : 'Nobody matches.';
	}

	/* Quick view */
	let current = null;
	const sheetBody = pick('.offcanvas-body', el.drawer);

	function sheet() {
		return bootstrap.Offcanvas.getOrCreateInstance(el.drawer);
	}

	let navList = [];

	/* Their local time and how much of the working day is left. */
	function pad(n) {
		return String(n).padStart(2, '0');
	}

	function clock(mins) {
		const h = Math.floor(mins / 60) % 24;
		return `${h % 12 || 12}:${pad(Math.round(mins % 60))}${h < 12 ? ' am' : ' pm'}`;
	}
	function reach(p) {
		const parts = {};
		new Intl.DateTimeFormat('en-US', {
			timeZone: p.tz,
			weekday: 'short',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23',
		})
			.formatToParts(NOW)
			.forEach((x) => {
				parts[x.type] = x.value;
			});
		const mins = Number(parts.hour) * 60 + Number(parts.minute);
		const start = p.hours[0] * 60;
		const end = p.hours[1] * 60;
		const weekend = parts.weekday === 'Sat' || parts.weekday === 'Sun';
		if (!weekend && mins >= start && mins < end) {
			const left = end - mins;
			return {
				kind: left <= 60 ? 'soon' : 'on',
				time: clock(mins),
				text: left <= 60 ? `ends in ${left} min` : `until ${clock(end)}`,
			};
		}
		const nextDay = weekend || (parts.weekday === 'Fri' && mins >= end) ? 'Mon ' : '';
		return { kind: 'off', time: clock(mins), text: `back ${nextDay}${clock(start)}` };
	}

	function signFacts(p) {
		const l = p.login;
		if (!l) {
			return '<div class="ct-d-acts"><button type="button" class="btn btn-sm btn-outline-secondary" data-ct-invite><i class="bi bi-envelope-plus me-1" aria-hidden="true"></i>Invite to Fieldline</button></div>';
		}
		return `<dl class="ct-facts"><div><dt>Signs in with</dt><dd>${l.how === 'sso' ? 'Their company sign-in' : 'Email and password'}</dd></div><div><dt>Two-step</dt><dd>${l.how === 'sso' ? 'On, through their company' : l.twoStep ? 'On' : 'Off'}</dd></div><div><dt>Last signed in</dt><dd>${l.last ? lastSeen(l.last) : 'Not yet'}</dd></div><div><dt>Invited</dt><dd>${dayMonth(l.invited)}, ${l.invited.slice(0, 4)}${l.accepted ? `<span class="ct-facts-note">Accepted ${dayMonth(l.accepted)}, ${l.accepted.slice(0, 4)}</span>` : '<span class="ct-facts-note">Not accepted yet</span>'}</dd></div></dl>`;
	}

	function drawPerson(p) {
		current = p;
		const r = reach(p);
		const mates = people.filter((x) => x.company === p.company && x !== p);
		const face = pick('[data-ct-d="avatar"]', el.drawer);
		face.setAttribute('data-name', p.name);
		if (window.Basalt.avatar) window.Basalt.avatar(face);
		pick('[data-ct-d="name"]', el.drawer).textContent = p.name;
		pick('[data-ct-d="sub"]', el.drawer).textContent = `${p.title} · ${p.company}`;
		pick('[data-ct-d="page"]', el.drawer).setAttribute('href', personUrl(p));
		const at = navList.indexOf(p);
		pick('[data-basalt-record-pos]', el.drawer).textContent = at > -1 ? `${at + 1} of ${navList.length}` : '';

		for (const row of pickAll('.ct-row', el.rows)) {
			row.classList.toggle('is-open', Number(row.dataset.ctId) === p.id);
		}

		const log = p.log.length
			? `<ol class="ct-log">${p.log
					.slice(0, 4)
					.map(
						(e) =>
							`<li class="ct-log-item"><span class="ct-log-icon" aria-hidden="true"><i class="bi ${VIA[e.via].icon}"></i></span><div class="ct-log-body"><p class="ct-log-text">${htmlSafe(e.text)}</p><p class="ct-log-meta">${VIA[e.via].label} · ${htmlSafe(e.by)} · ${shortDate(e.d)}</p></div></li>`,
					)
					.join('')}</ol>`
			: '<p class="ct-d-muted">No calls or emails logged yet.</p>';

		sheetBody.innerHTML = `<section class="ct-d-sec" aria-labelledby="ct-d-reach"><h3 class="ct-d-title" id="ct-d-reach">Reach</h3><dl class="ct-facts"><div><dt>Local time</dt><dd><span class="ct-reach ct-reach-${r.kind}"><span class="ct-reach-dot" aria-hidden="true"></span><span><span class="ct-reach-time">${r.time}</span> in ${htmlSafe(p.city.split(',')[0])} <span class="ct-reach-note">· ${r.text}</span></span></span></dd></div><div><dt>Email</dt><dd><a href="mailto:${htmlSafe(p.email)}">${htmlSafe(p.email)}</a></dd></div><div><dt>Phone</dt><dd>${p.phone ? `<a href="${telHref(p.phone)}">${htmlSafe(p.phone)}</a>` : 'Not added yet'}</dd></div><div><dt>Company</dt><dd><a href="${companyUrl(p.companyId)}">${htmlSafe(p.company)}</a><span class="ct-facts-note">${htmlSafe(where(p))}</span></dd></div></dl></section><section class="ct-d-sec" aria-labelledby="ct-d-sign"><h3 class="ct-d-title" id="ct-d-sign">At the account</h3>${rolePill(p.role)}<p class="ct-d-lead">${htmlSafe(ROLES[p.role].about)}</p>${signFacts(p)}</section>${p.deals.length ? `<section class="ct-d-sec" aria-labelledby="ct-d-deals"><h3 class="ct-d-title" id="ct-d-deals">Deals</h3><ul class="ct-deals">${p.deals.map((d) => `<li><a href="${dealUrl(d.id)}">${htmlSafe(d.title)}</a><span class="ct-facts-note">${htmlSafe(STAGE[d.stage])} · ${htmlSafe(d.part)}${d.quote ? ` · <a href="quote-details.html?id=${encodeURIComponent(d.quote)}">${htmlSafe(d.quote)}</a>` : ''}</span></li>`).join('')}</ul></section>` : ''}<section class="ct-d-sec" aria-labelledby="ct-d-log"><h3 class="ct-d-title" id="ct-d-log">Recent contact</h3>${log}</section>${mates.length ? `<section class="ct-d-sec" aria-labelledby="ct-d-mates"><h3 class="ct-d-title" id="ct-d-mates">Also at ${htmlSafe(p.company)}</h3><ul class="ct-mates">${mates.map((m) => `<li><button type="button" class="ct-mate" data-ct-open="${m.id}">${avatar(m.name, 'basalt-avatar-sm')}<span class="ct-mate-who"><span class="ct-mate-name">${htmlSafe(m.name)}</span><span class="ct-mate-title">${htmlSafe(m.title)}</span></span>${rolePill(m.role)}</button></li>`).join('')}</ul></section>` : ''}`;
		if (window.Basalt.avatars) window.Basalt.avatars(sheetBody);
	}

	function openPerson(id) {
		const p = people.find((x) => x.id === Number(id));
		if (!p) return;
		navList = state.list.slice();
		drawPerson(p);
		sheet().show();
	}

	/* Previous and next step through the rows in their current order,
     with Alt+Up and Alt+Down as on the other record drawers. */
	function step(dir) {
		if (!navList.length) return;
		const at = Math.max(0, navList.indexOf(current));
		drawPerson(navList[(at + dir + navList.length) % navList.length]);
		el.drawer.classList.toggle('is-back', dir < 0);

		for (const n of pickAll(':scope > *', sheetBody)) {
			n.style.animation = 'none';
			void n.offsetWidth;
			n.style.animation = '';
		}
	}

	pick('[data-basalt-record-prev]', el.drawer).addEventListener('click', () => step(-1));
	pick('[data-basalt-record-next]', el.drawer).addEventListener('click', () => step(1));
	el.drawer.addEventListener('keydown', (e) => {
		if (!e.altKey) return;
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			step(-1);
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			step(1);
		}
	});
	el.drawer.addEventListener('hidden.bs.offcanvas', () => {
		for (const row of pickAll('.ct-row.is-open', el.rows)) {
			row.classList.remove('is-open');
		}
	});
	el.drawer.addEventListener('click', (e) => {
		const mate = e.target.closest('[data-ct-open]');
		if (mate) {
			drawPerson(people.find((x) => x.id === Number(mate.dataset.ctOpen)));
			/* The clicked button is gone with the old body; keep focus in the
         drawer so Escape and the keyboard still work. */
			el.drawer.focus({ preventScroll: true });
			return;
		}
		if (e.target.closest('[data-ct-invite]') && current) {
			invite(current);
			el.drawer.focus({ preventScroll: true });
		}
	});
	pick('[data-ct-log-call]', el.drawer).addEventListener('click', () => {
		if (!current) return;
		const p = current;
		const entry = { d: 0, via: 'call', by: 'John Armstrong', text: 'Quick call, no notes added.' };
		p.log.unshift(entry);
		drawPerson(p);
		toast({
			tone: 'success',
			icon: 'bi-telephone',
			title: 'Call logged',
			text: `Added to ${p.name.split(' ')[0]}’s history for today.`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						p.log.splice(p.log.indexOf(entry), 1);
						if (current === p) drawPerson(p);
					},
				},
			],
		});
	});

	/* A contact invited to Fieldline joins as a member, waiting to accept. */
	function invite(p) {
		p.role = 'member';
		p.login = { how: 'password', twoStep: false, last: null, invited: '2026-10-08', accepted: null };
		drawPerson(p);
		drawChips();
		drawSub();
		render();
		toast({
			tone: 'success',
			icon: 'bi-envelope-check',
			title: 'Invite sent',
			text: `${p.name} can sign in once they accept it.`,
		});
	}

	/* Add a person */
	function fieldError(input, show) {
		input.classList.toggle('is-invalid', show);
		input.setAttribute('aria-invalid', String(show));
	}

	const acctSel = pick('[data-ct-new-acct]', el.form);
	const roleField = pick('[data-ct-new-role]', el.form);
	const roleNote = pick('[data-ct-role-note]', el.form);
	acctSel.insertAdjacentHTML(
		'beforeend',
		Object.keys(ACCOUNTS)
			.sort((x, y) => ACCOUNTS[x].name.localeCompare(ACCOUNTS[y].name))
			.map((k) => `<option value="${k}">${htmlSafe(ACCOUNTS[k].name)}</option>`)
			.join(''),
	);

	function showRoleNote() {
		roleNote.textContent = !roleField.value
			? 'Everyone but a contact gets an email to sign in.'
			: roleField.value === 'contact'
				? 'Kept as a contact. You can invite them later.'
				: 'They get an email invite to sign in to Fieldline.';
	}

	acctSel.addEventListener('change', () => fieldError(acctSel, false));
	roleField.addEventListener('change', () => {
		fieldError(roleField, false);
		showRoleNote();
	});
	el.form.addEventListener('input', (e) => {
		if (e.target.classList.contains('is-invalid')) fieldError(e.target, false);
	});
	el.add.addEventListener('hidden.bs.offcanvas', () => {
		el.form.reset();

		for (const x of pickAll('.is-invalid', el.form)) {
			fieldError(x, false);
		}

		showRoleNote();
	});

	el.form.addEventListener('submit', (e) => {
		e.preventDefault();
		const f = el.form.elements;
		const bad = [];

		for (const id of ['ct-new-first', 'ct-new-last']) {
			const ok = f[id].value.trim() !== '';
			fieldError(f[id], !ok);
			if (!ok) bad.push(f[id]);
		}

		const mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.ctNewEmail.value.trim());
		fieldError(f.ctNewEmail, !mailOk);
		if (!mailOk) bad.push(f.ctNewEmail);

		for (const sel of [acctSel, roleField]) {
			fieldError(sel, !sel.value);
			if (!sel.value) bad.push(sel);
		}

		if (bad.length) {
			const first = bad[0];
			const trigger = first.tagName === 'SELECT' ? pick('.basalt-select-trigger', first.parentNode) : null;
			(trigger || first).focus();
			return;
		}
		const a = ACCOUNTS[acctSel.value];
		const name = `${f.ctNewFirst.value.trim()} ${f.ctNewLast.value.trim()}`;
		const p = {
			id: people.reduce((m, x) => Math.max(m, x.id), 0) + 1,
			key: BOOK.personKey(name),
			name,
			title: f.ctNewTitle.value.trim() || 'Job title not set',
			email: f.ctNewEmail.value.trim(),
			phone: f.ctNewPhone.value.trim(),
			mobile: '',
			hours: [8, 17],
			note: '',
			acct: acctSel.value,
			companyId: acctSel.value,
			company: a.name,
			city: a.city,
			tz: a.tz,
			kind: a.kind,
			role: roleField.value,
			login:
				roleField.value === 'contact'
					? null
					: { how: 'password', twoStep: false, last: null, invited: '2026-10-08', accepted: null },
			deals: [],
			log: [],
		};
		people.push(p);
		people.sort((x, y) => x.name.localeCompare(y.name));
		state.q = '';
		el.search.value = '';
		state.show = 'all';
		state.role = 'all';
		state.acct = 'all';
		el.acct.value = 'all';
		el.role.value = 'all';

		for (const s of [el.acct, el.role]) {
			if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(s);
		}

		state.showAll = true;
		drawChips();
		drawSub();
		render();
		bootstrap.Offcanvas.getOrCreateInstance(el.add).hide();
		const added = pick(`[data-ct-id="${p.id}"]`, el.rows);
		if (added) {
			added.classList.add('is-new');
			added.scrollIntoView({
				block: 'center',
				behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
			});
		}
		toast({
			tone: 'success',
			icon: 'bi-person-check',
			title: `${name} added`,
			text: p.login ? `Invite sent. Listed under ${a.name}.` : `Listed under ${a.name} as a contact.`,
		});
	});

	/* Export */
	function downloadCsv() {
		function cell(v) {
			return `"${String(v).replace(/"/g, '""')}"`;
		}

		const rows = [
			['Name', 'Job title', 'Company', 'City', 'Role', 'Signs in', 'Last signed in', 'Email', 'Phone', 'Deal'],
		].concat(
			state.list.map((p) => [
				p.name,
				p.title,
				p.company,
				p.city,
				ROLES[p.role].label,
				p.login ? (p.login.how === 'sso' ? 'Company sign-in' : 'Password') : 'No',
				p.login && p.login.last ? `${p.login.last} UTC` : '',
				p.email,
				p.phone,
				p.deals.map((d) => `${d.id} ${d.title}`).join('; '),
			]),
		);
		const blob = new Blob([rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = 'people-at-companies.csv';
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000);
		toast({
			tone: 'success',
			icon: 'bi-download',
			title: 'Export ready',
			text: `${plural(state.list.length, 'person', 'people')} saved to people-at-companies.csv.`,
		});
	}

	/* Wiring */
	function resetFilters() {
		state.q = '';
		el.search.value = '';
		state.show = 'all';
		state.role = 'all';
		state.acct = 'all';
		el.acct.value = 'all';
		el.role.value = 'all';

		for (const s of [el.acct, el.role]) {
			if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(s);
		}

		state.showAll = false;
		drawChips();
		render();
	}

	let typing;
	el.search.addEventListener('input', () => {
		clearTimeout(typing);
		typing = setTimeout(() => {
			state.q = el.search.value.trim();
			state.showAll = false;
			render();
		}, 120);
	});
	el.acct.addEventListener('change', () => {
		state.acct = el.acct.value;
		state.showAll = false;
		render();
	});
	el.role.addEventListener('change', () => {
		state.role = el.role.value;
		state.showAll = false;
		render();
	});
	el.chips.addEventListener('click', (e) => {
		const chip = e.target.closest('[data-ct-show]');
		if (!chip) return;
		state.show = chip.dataset.ctShow;
		state.showAll = false;

		for (const c of pickAll('[data-ct-show]', el.chips)) {
			c.setAttribute('aria-pressed', String(c === chip));
		}

		render();
	});
	/* The panel icon opens the drawer; a click on the row's empty space
     opens the person's page, like the name (Cmd/Ctrl or middle click: a
     new tab). Links and buttons keep their own job. */
	function openRowPage(e) {
		const row = e.target.closest('.ct-row');
		if (!row || e.target.closest('a, button')) return false;
		const href = pick('.ct-line-name', row).href;
		if (e.metaKey || e.ctrlKey || e.button === 1) window.open(href, '_blank', 'noopener');
		else location.href = href;
		return true;
	}
	start();
})();
