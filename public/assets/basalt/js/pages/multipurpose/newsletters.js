/**
 * Basalt - Newsletters (newsletters.html)
 * Marlo's email newsletters: who is on the list, how the last emails
 * did, what goes out next, and every issue in one table. A row and
 * its expand icon open Newsletter Details; the panel icon opens a
 * quick view.
 * Uses the shared segmented control, status pills, empty states, the
 * record drawer, tooltips and toasts.
 */
(() => {
	'use strict';
	/* The issues, audiences and subscriber counts come from the shared
     newsletter data (assets/basalt/js/data/multipurpose/newsletters.js), which Newsletter
     Details reads too; products come from the catalog. */
	const NL = window.Basalt.data.newsletters;
	const CAT = window.Basalt.data.catalog;
	const TODAY = NL.today;
	const AUDIENCES = NL.audiences;
	const SUBS = NL.subscribers;

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

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function num(n) {
		return n.toLocaleString('en-US');
	}

	function money(n) {
		return `$${num(n)}`;
	}

	function pct(a, b) {
		return `${(b ? (a / b) * 100 : 0).toFixed(1)}%`;
	}

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	function dateOf(s) {
		const p = s.split(/[- :]/).map(Number);
		return new Date(p[0], p[1] - 1, p[2], p[3] || 12, p[4] || 0);
	}
	function day(s) {
		const d = dateOf(s);
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function weekday(s) {
		return `${DAYS[dateOf(s).getDay()]}, ${day(s)}`;
	}

	function clock(s) {
		const d = dateOf(s);
		const h = d.getHours() % 12 || 12;
		return `${h}:${String(d.getMinutes()).padStart(2, '0')}${d.getHours() < 12 ? ' AM' : ' PM'}`;
	}

	function daysLeft(s) {
		return Math.round((dateOf(s.slice(0, 10)) - dateOf(TODAY)) / 864e5);
	}

	function inDays(s) {
		const n = daysLeft(s);
		return n <= 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`;
	}

	function agoDays(s) {
		return Math.round((dateOf(TODAY) - dateOf(s.slice(0, 10))) / 864e5);
	}

	/* A draft made on this page is not in the shared data, so its address
     carries what Newsletter Details needs to draw it: the issue it was
     copied from, or the subject and audience typed into New newsletter. */
	function pageOf(n) {
		if (!n.fresh) return `newsletter-details.html?id=${encodeURIComponent(n.id)}`;
		return `newsletter-details.html?id=${encodeURIComponent(n.id)}${n.from ? `&copy=${encodeURIComponent(n.from)}` : `&subject=${encodeURIComponent(n.subject)}&audience=${n.audience}`}`;
	}

	function product(sku) {
		return CAT.find(sku);
	}

	function photo(id, w, h) {
		return window.Basalt.photo(id, w, h);
	}

	/* State */
	const issues = NL.issues();
	const state = { view: 'all', q: '', open: null };
	let freshId = 122;

	const el = {
		rows: pick('[data-nl="rows"]'),
		wrap: pick('.nl-table-wrap'),
		empty: pick('[data-nl="empty"]'),
		status: pick('[data-nl="status"]'),
		search: pick('[data-nl="search"]'),
		tabs: pick('[data-nl="tabs"]'),
		drawer: pick('#nl-record'),
		newModal: pick('#nl-new'),
		newForm: pick('[data-nl="new-form"]'),
	};

	function R(k) {
		return pick(`[data-nl-r="${k}"]`, el.drawer);
	}

	/* Order: what goes out next first, then drafts, then sent,
	   newest first */
	const RANK = { scheduled: 0, draft: 1, sent: 2 };
	function sorted(list) {
		return list.slice().sort((a, b) => {
			if (RANK[a.status] !== RANK[b.status]) return RANK[a.status] - RANK[b.status];
			if (a.status === 'scheduled') return a.at.localeCompare(b.at);
			if (a.status === 'draft') return b.edited[0].localeCompare(a.edited[0]);
			return b.at.localeCompare(a.at);
		});
	}
	function matches(n) {
		if (state.view !== 'all' && n.status !== state.view) return false;
		if (!state.q) return true;
		const hay = [n.subject, n.preheader, AUDIENCES[n.audience].label, n.author].join(' ');
		return window.Basalt && window.Basalt.matchesQuery
			? window.Basalt.matchesQuery(hay, state.q)
			: hay.toLowerCase().includes(state.q.toLowerCase());
	}

	function visible() {
		return sorted(issues.filter(matches));
	}

	/* The list at a glance */
	function paintPulse() {
		pick('[data-nl="growth"]').textContent = `+${num(SUBS.joined30 - SUBS.left30)}`;

		/* The subscriber count month by month; pointing along the line shows
		   that month's count in the figure. */
		const card = pick('[data-nl="spark"]').closest('.nl-pulse-fig');
		const figure = pick('.nl-pulse-value', card);
		const note = pick('.nl-pulse-note', card);
		window.Basalt.trendline?.(
			pick('[data-nl="spark"]'),
			SUBS.months.map((m) => m[1]),
			{
				labels: SUBS.months.map((m) => m[0]),
				format: num,
				name: 'Subscribers by month',
				onRead: (at, value, label) => {
					if (at === null) {
						figure.textContent = num(SUBS.now);
						note.innerHTML = `<span data-nl="growth" class="nl-up">+${num(SUBS.joined30 - SUBS.left30)}</span> in 30 days`;
						return;
					}
					figure.textContent = num(value);
					note.textContent = `End of ${label}`;
				},
			},
		);

		/* The last 30 days of sends. */
		const recent = issues.filter((n) => n.status === 'sent' && agoDays(n.at) <= 30);
		const sent = recent.reduce((s, n) => s + n.results.sent, 0);
		const opened = recent.reduce((s, n) => s + n.results.opened, 0);
		const revenue = recent.reduce((s, n) => s + n.results.revenue, 0);
		const orders = recent.reduce((s, n) => s + n.results.orders, 0);
		pick('[data-nl="open-rate"]').textContent = pct(opened, sent);
		pick('[data-nl="open-note"]').textContent = `Average of ${recent.length} sends, last 30 days`;
		pick('[data-nl="open-meter"]').style.setProperty('--nl-fill', `${((opened / sent) * 100).toFixed(1)}%`);
		pick('[data-nl="revenue"]').textContent = money(revenue);
		pick('[data-nl="revenue-note"]').textContent = `${orders} orders, last 30 days`;

		const next = sorted(issues.filter((n) => n.status === 'scheduled'))[0];
		const box = pick('[data-nl="next"]');
		box.hidden = !next;
		if (!next) return;
		box.setAttribute('data-id', next.id);
		box.setAttribute('aria-label', `Next send: ${next.subject}, ${weekday(next.at)}. Open quick view`);
		pick('[data-nl="next-when"]').textContent = `${weekday(next.at)}, ${clock(next.at)}`;
		pick('[data-nl="next-subject"]').textContent = next.subject;
		pick('[data-nl="next-to"]').textContent = `${AUDIENCES[next.audience].label} · ${inDays(next.at)}`;
	}

	/* Table */
	const STATUS = {
		sent: { label: 'Sent', tone: 'success', icon: 'bi-check2' },
		scheduled: { label: 'Scheduled', tone: 'primary', icon: 'bi-clock' },
		draft: { label: 'Draft', tone: '', icon: 'bi-pencil' },
	};
	function pill(n) {
		const s = STATUS[n.status];
		return `<span class="basalt-status${s.tone ? ` basalt-status-${s.tone}` : ''}"><i class="bi ${s.icon}" aria-hidden="true"></i>${s.label}</span>`;
	}
	function audience(n) {
		return `<span class="nl-aud" data-aud="${n.audience}">${AUDIENCES[n.audience].label}</span>`;
	}
	function reach(n) {
		return n.results ? `${num(n.results.sent)} people` : `${num(AUDIENCES[n.audience].size)} people`;
	}
	function pending(n) {
		if (n.status === 'scheduled') return `<i class="bi bi-send" aria-hidden="true"></i>Goes out ${inDays(n.at)}`;
		return `<i class="bi bi-pencil" aria-hidden="true"></i>Edited ${day(n.edited[0])} by ${htmlSafe(n.edited[1])}`;
	}
	function rowHtml(n) {
		const r = n.results;
		const open = r ? (r.opened / r.sent) * 100 : 0;
		const figures = r
			? `<td class="nl-num nl-col-open"><span class="nl-open"><span>${pct(r.opened, r.sent)}</span><span class="nl-open-bar" aria-hidden="true"><span style="--nl-fill:${open.toFixed(1)}%"></span></span></span></td><td class="nl-num nl-col-rev">${money(r.revenue)}</td>`
			: `<td class="nl-pending" colspan="2">${pending(n)}</td>`;
		return `<tr data-id="${n.id}" class="is-${n.status}"><td class="nl-col-name"><a class="nl-subject" href="${pageOf(n)}">${htmlSafe(n.subject)}</a><span class="nl-meta">${audience(n)}<span>${reach(n)}</span></span></td><td class="nl-col-status">${pill(n)}</td><td class="nl-col-date">${n.at ? `<span class="nl-date">${day(n.at)}</span><span class="nl-time">${clock(n.at)}</span>` : '<span class="nl-time">No date yet</span>'}</td>${figures}<td class="nl-col-act"><span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-nl-open="${n.id}" aria-label="Quick view: ${htmlSafe(n.subject)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${pageOf(n)}" aria-label="Open full page: ${htmlSafe(n.subject)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span></td></tr>`;
	}
	function emptyHtml() {
		const searching = !!state.q;
		return `<div class="basalt-empty basalt-empty-compact basalt-empty-muted nl-empty"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi ${searching ? 'bi-search' : 'bi-envelope'}"></i></span><h3 class="basalt-empty-title">${searching ? 'No newsletters match' : 'Nothing here yet'}</h3><p class="basalt-empty-text">${searching ? `No subject matches “${htmlSafe(state.q)}”. Try another word, or look in All.` : 'Newsletters with this status show up here.'}</p>${searching ? '<div class="basalt-empty-actions"><button type="button" class="btn btn-sm btn-outline-secondary" data-nl-reset>Clear the search</button></div>' : ''}</div>`;
	}
	const SAY = { all: 'upcoming first', sent: 'newest first', scheduled: 'soonest first', draft: 'last edited first' };
	const NOUN = { all: 'newsletter', sent: 'sent newsletter', scheduled: 'scheduled newsletter', draft: 'draft' };
	function paintTable() {
		const list = visible();
		el.rows.innerHTML = list.map(rowHtml).join('');
		if (window.Basalt.tips) window.Basalt.tips(el.rows);
		el.wrap.hidden = !list.length;
		el.empty.hidden = !!list.length;
		el.empty.innerHTML = list.length ? '' : emptyHtml();
		el.status.textContent = list.length
			? `${list.length} ${NOUN[state.view]}${list.length === 1 ? '' : 's'}, ${SAY[state.view]}.`
			: '';

		for (const v of ['all', 'sent', 'scheduled', 'draft']) {
			pick(`[data-nl-count="${v}"]`).textContent =
				v === 'all' ? issues.length : issues.filter((n) => n.status === v).length;
		}
	}

	/* Quick view */
	function drawerCtl() {
		return bootstrap.Offcanvas.getOrCreateInstance(el.drawer);
	}

	let drawerList = [];

	function previewHtml(n) {
		const p = product(n.hero);
		return `<div class="nl-mini" aria-hidden="true">${p ? `<img class="nl-mini-img" src="${photo(p.photo, 640, 300)}" alt="" width="640" height="300" loading="lazy">` : ''}<div class="nl-mini-text"><p class="nl-mini-head">${htmlSafe(n.headline)}</p><p class="nl-mini-pre">${htmlSafe(n.preheader)}</p></div></div>`;
	}
	function stateLine(n) {
		if (n.status === 'sent') return `Sent ${weekday(n.at)} at ${clock(n.at)} to ${num(n.results.sent)} people.`;
		if (n.status === 'scheduled') return `Goes out ${weekday(n.at)} at ${clock(n.at)}, ${inDays(n.at)}.`;
		return `Not scheduled yet. ${n.edited[1]} last changed it on ${day(n.edited[0])}.`;
	}
	function resultsHtml(n) {
		const r = n.results;
		const figs = [
			['Opened', pct(r.opened, r.sent), `${num(r.opened)} people`],
			['Clicked', pct(r.clicked, r.sent), `${num(r.clicked)} people`],
			['Orders', String(r.orders), 'within 5 days'],
			['Revenue', money(r.revenue), `${money(Math.round(r.revenue / r.orders))} an order`],
		];
		const top = n.links.slice(0, 3);
		const max = top[0][1];
		return `<section aria-labelledby="nl-r-results"><h3 class="nl-r-h" id="nl-r-results">Results</h3><dl class="nl-r-figs">${figs.map((f) => `<div><dt>${f[0]}</dt><dd><span class="nl-r-figs-value">${f[1]}</span><span class="nl-r-figs-note">${f[2]}</span></dd></div>`).join('')}</dl></section><section aria-labelledby="nl-r-links"><h3 class="nl-r-h" id="nl-r-links">Most clicked</h3><ul class="nl-r-links">${top.map((l) => `<li><span class="nl-r-links-name">${htmlSafe(linkName(n, l[0]))}</span><span class="nl-r-links-n">${num(l[1])}</span><span class="nl-r-links-bar" aria-hidden="true"><span style="--nl-fill:${((l[1] / max) * 100).toFixed(1)}%"></span></span></li>`).join('')}</ul></section>`;
	}
	function linkName(n, key) {
		if (key === 'cta') return `Button: ${n.cta}`;
		const p = product(key);
		return p ? p.name : key;
	}
	function factsHtml(n) {
		const a = AUDIENCES[n.audience];
		const rows = [
			['Send to', `${htmlSafe(a.label)} <span class="nl-r-quiet">· ${reach(n)}</span>`],
			['From', `${htmlSafe(NL.from.name)} <span class="nl-r-quiet">${htmlSafe(NL.from.email)}</span>`],
			['Preheader', htmlSafe(n.preheader)],
			['Written by', htmlSafe(n.author)],
			[
				'Unsubscribed',
				n.results
					? `${num(n.results.unsub)} <span class="nl-r-quiet">· ${pct(n.results.unsub, n.results.sent)}</span>`
					: '',
			],
			[
				'Last test',
				n.tests.length
					? `${htmlSafe(n.tests[n.tests.length - 1][0])} <span class="nl-r-quiet">· ${day(n.tests[n.tests.length - 1][1])}</span>`
					: n.status === 'sent'
						? ''
						: 'No test sent yet',
			],
		].filter((r) => r[1]);
		return `<section aria-labelledby="nl-r-details"><h3 class="nl-r-h" id="nl-r-details">Details</h3><dl class="nl-r-facts">${rows.map((r) => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl></section>`;
	}
	function paintDrawer() {
		const n = issues.find((x) => x.id === state.open);
		if (!n) return;
		const at = drawerList.findIndex((x) => x.id === n.id);
		R('title').textContent = n.subject;
		R('sub').textContent = AUDIENCES[n.audience].label + (n.at ? ` · ${weekday(n.at)}` : ' · Draft');
		R('full').href = pageOf(n);
		R('pos').textContent = at >= 0 ? `${at + 1} of ${drawerList.length}` : '';

		for (const b of pickAll('[data-nl-r-step]', el.drawer)) {
			b.disabled = at < 0 || drawerList.length < 2;
		}

		R('body').innerHTML =
			`<div class="nl-r-state">${pill(n)}<p class="nl-r-state-text">${htmlSafe(stateLine(n))}</p></div>${previewHtml(n)}${n.results ? resultsHtml(n) : ''}${factsHtml(n)}`;
		R('foot').innerHTML =
			`<button type="button" class="btn btn-outline-secondary me-auto" data-nl-act="duplicate"><i class="bi bi-copy me-1" aria-hidden="true"></i>Duplicate</button><button type="button" class="btn btn-outline-secondary" data-nl-act="test"><i class="bi bi-envelope-check me-1" aria-hidden="true"></i>Send test</button>`;
	}
	function openIssue(id, dir) {
		state.open = id;
		el.drawer.classList.toggle('is-back', dir < 0);
		paintDrawer();
		if (dir)
			for (const x of pickAll(':scope > *', R('body'))) {
				x.style.animation = 'none';
				void x.offsetWidth;
				x.style.animation = '';
			}
		drawerCtl().show();
	}
	function step(dir) {
		if (drawerList.length < 2) return;
		const at = drawerList.findIndex((x) => x.id === state.open);
		openIssue(drawerList[(at + dir + drawerList.length) % drawerList.length].id, dir);
	}

	/* Copies and new drafts */
	function addDraft(from, subject, aud) {
		const n = Object.assign({}, from || {}, {
			id: `nl-${freshId++}`,
			from: from ? from.id : '',
			status: 'draft',
			subject,
			audience: aud,
			at: '',
			fresh: true,
			edited: [TODAY, 'John Armstrong'],
			author: 'John Armstrong',
			tests: [],
		});
		delete n.results;
		delete n.links;
		if (!from) {
			Object.assign(n, {
				preheader: 'A line people read after the subject.',
				hero: 'ML-BLAZ',
				headline: 'Your headline here',
				body: 'Write a few lines about what’s new. Keep it short: most people read the first two lines and then decide.',
				cta: 'Shop now',
				tiles: ['ML-BLAZ', 'ML-SUIT', 'ML-OXFD', 'ML-CATE'],
			});
		}
		issues.push(n);
		return n;
	}
	function duplicate(n) {
		const copy = addDraft(n, `Copy of ${n.subject}`, n.audience);
		paintTable();
		toast({
			tone: 'success',
			icon: 'bi-copy',
			title: 'Copy saved as a draft',
			text: `“${copy.subject}” is at the top of Drafts.`,
			actions: [
				{
					label: 'Open it',
					onClick() {
						location.href = pageOf(copy);
					},
				},
			],
		});
	}

	/* Wiring */
	function start() {
		paintPulse();
		paintTable();

		el.tabs.addEventListener('change', (e) => {
			if (!e.target.matches('input[name="nlView"]')) return;
			state.view = e.target.value;
			paintTable();
		});
		let typing;
		el.search.addEventListener('input', () => {
			clearTimeout(typing);
			typing = setTimeout(() => {
				state.q = el.search.value.trim();
				paintTable();
			}, 150);
		});
		el.empty.addEventListener('click', (e) => {
			if (!e.target.closest('[data-nl-reset]')) return;
			el.search.value = '';
			state.q = '';
			paintTable();
			el.search.focus();
		});

		/* The panel icon opens the quick view; the rest of a row opens the
       issue's page, as its subject does, in a new tab with Cmd, Ctrl,
       Shift or the middle button. */
		function rowPage(e) {
			const tr = e.target.closest('tr[data-id]');
			return tr && !e.target.closest('a[href], button') ? pick('.nl-subject', tr).href : '';
		}

		el.rows.addEventListener('click', (e) => {
			const quick = e.target.closest('[data-nl-open]');
			if (quick) {
				drawerList = visible();
				openIssue(quick.getAttribute('data-nl-open'), 0);
				return;
			}
			const url = rowPage(e);
			if (!url) return;
			if (e.metaKey || e.ctrlKey || e.shiftKey) window.open(url, '_blank');
			else location.href = url;
		});
		el.rows.addEventListener('auxclick', (e) => {
			const url = e.button === 1 && rowPage(e);
			if (url) window.open(url, '_blank');
		});
		pick('[data-nl="next"]').addEventListener('click', (e) => {
			drawerList = visible();
			openIssue(e.currentTarget.getAttribute('data-id'), 0);
		});

		for (const b of pickAll('[data-nl-r-step]', el.drawer)) {
			b.addEventListener('click', () => step(+b.getAttribute('data-nl-r-step')));
		}

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
			state.open = null;
		});
		el.drawer.addEventListener('click', (e) => {
			const b = e.target.closest('[data-nl-act]');
			if (!b) return;
			const n = issues.find((x) => x.id === state.open);
			if (b.getAttribute('data-nl-act') === 'duplicate') {
				drawerCtl().hide();
				duplicate(n);
			} else {
				toast({
					tone: 'success',
					icon: 'bi-envelope-check',
					title: 'Test sent',
					text: `“${n.subject}” is on its way to john@marlo.shop.`,
				});
			}
		});

		/* A new draft, from the page head. */
		const subject = el.newForm.elements.subject;
		el.newForm.addEventListener('submit', (e) => {
			e.preventDefault();
			const text = subject.value.trim();
			subject.classList.toggle('is-invalid', !text);
			if (!text) {
				subject.focus();
				return;
			}
			const n = addDraft(null, text, el.newForm.elements.audience.value);
			bootstrap.Modal.getOrCreateInstance(el.newModal).hide();
			paintTable();
			toast({
				tone: 'success',
				icon: 'bi-envelope-paper-heart',
				title: 'Draft created',
				text: 'Add the products and schedule it when it’s ready.',
				actions: [
					{
						label: 'Open it',
						onClick() {
							location.href = pageOf(n);
						},
					},
				],
			});
			announce('Draft created. It’s at the top of Drafts.');
		});
		subject.addEventListener('input', () => {
			if (subject.value.trim()) subject.classList.remove('is-invalid');
		});
		el.newModal.addEventListener('shown.bs.modal', () => subject.focus());
		el.newModal.addEventListener('hidden.bs.modal', () => {
			el.newForm.reset();
			subject.classList.remove('is-invalid');
		});
	}
	function announce(t) {
		if (window.Basalt.announce) window.Basalt.announce(t);
	}

	document.addEventListener('DOMContentLoaded', start);
})();
