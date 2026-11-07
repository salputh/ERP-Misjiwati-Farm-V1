/**
 * History Feed (history-feed.html).
 *
 * The program log of Project Lantern: a launch countdown in the header, type
 * filters with live counts, a search that highlights its matches, three ways
 * to read the log (timeline, feed, compact list) in either order, and an Add
 * entry dialog with a live preview. Entries live in memory; in a real app
 * they come from your API.
 */
(() => {
	'use strict';

	const DAY = 86400000;
	const MONTHS = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	];
	const SHORT_MONTHS = MONTHS.map((month) => month.slice(0, 3));

	const TYPES = [
		{ key: 'milestone', label: 'Milestone', icon: 'bi-flag-fill' },
		{ key: 'decision', label: 'Decision', icon: 'bi-signpost-split-fill' },
		{ key: 'deployment', label: 'Deployment', icon: 'bi-cloud-arrow-up' },
		{ key: 'migration', label: 'Migration', icon: 'bi-box-arrow-in-right' },
		{ key: 'review', label: 'Review', icon: 'bi-clipboard-check' },
		{ key: 'incident', label: 'Incident', icon: 'bi-exclamation-triangle-fill' },
		{ key: 'hire', label: 'Hire', icon: 'bi-person-plus-fill' },
	];

	/* Project Lantern, the rebuild of Fieldline's own subscription platform:
     seat billing, plan changes and the self-serve account area (Mar–Sep
     2026). The log keeps decisions, migrations, reviews and incidents. */
	const ENTRIES = [
		{
			id: '#104',
			type: 'decision',
			title: 'Lantern Charter Signed Off',
			summary: 'Budget approved to bring seat billing in-house.',
			who: 'John Armstrong',
			date: '2026-03-02T09:30:00',
		},
		{
			id: '#111',
			type: 'review',
			title: 'Plan Changes Traced End to End',
			summary: 'Found twelve manual steps in a plan upgrade.',
			who: 'Paige Drake',
			date: '2026-03-11T14:00:00',
		},
		{
			id: '#118',
			type: 'decision',
			title: 'Roadmap Cut to Three Releases',
			summary: 'Seat billing first, then plan changes, then contracts.',
			who: 'John Armstrong',
			date: '2026-03-24T09:15:00',
		},
		{
			id: '#125',
			type: 'hire',
			title: 'Billing and Account Seats Filled',
			summary: 'Abe Boone joins on billing, Cody Stark on the account area.',
			who: 'Martin Hull',
			date: '2026-04-06T11:00:00',
		},
		{
			id: '#133',
			type: 'milestone',
			title: 'Upgrade Flow Cut to One Screen',
			summary: 'Adding seats or changing plan now takes one screen.',
			who: 'Stacy Byrd',
			date: '2026-04-15T16:00:00',
		},
		{
			id: '#140',
			type: 'deployment',
			title: 'Seat Billing Engine Merged',
			summary: 'Monthly and annual plans run through one engine.',
			who: 'Jacob Vance',
			date: '2026-04-27T10:45:00',
		},
		{
			id: '#147',
			type: 'deployment',
			title: 'Nightly Account Sync Running',
			summary: 'Staging rebuilds nightly from masked live accounts.',
			who: 'Derek Haas',
			date: '2026-05-06T12:00:00',
		},
		{
			id: '#154',
			type: 'hire',
			title: 'Backend Seat Filled for Contracts',
			summary: 'Trent Franklin starts on Sales-led contracts.',
			who: 'Sandra Barlow',
			date: '2026-05-12T10:30:00',
		},
		{
			id: '#162',
			type: 'migration',
			title: 'Invoice History Migrated',
			summary: 'Three years of invoices moved for 2,140 accounts.',
			who: 'Paige Drake',
			date: '2026-05-18T09:30:00',
		},
		{
			id: '#169',
			type: 'incident',
			title: 'Mid-Cycle Upgrades Billed Twice',
			summary: 'Eleven accounts charged twice; all refunded the same day.',
			who: 'Jacob Vance',
			date: '2026-05-29T13:20:00',
		},
		{
			id: '#176',
			type: 'migration',
			title: 'Internal Accounts Moved First',
			summary: 'Our own demo accounts moved first, to catch bugs early.',
			who: 'Derek Haas',
			date: '2026-06-08T15:00:00',
		},
		{
			id: '#183',
			type: 'incident',
			title: 'Payment Webhooks Backed Up 37 Minutes',
			summary: 'A stuck worker held 23 payments; all replayed.',
			who: 'Derek Haas',
			date: '2026-06-19T11:15:00',
		},
		{
			id: '#190',
			type: 'decision',
			title: 'Switchover Set for September 30',
			summary: 'The old billing tool closes on September 30.',
			who: 'John Armstrong',
			date: '2026-06-30T10:00:00',
		},
		{
			id: '#198',
			type: 'deployment',
			title: 'Add-ons Billed Per Seat',
			summary: 'Add-ons can now be turned on for some seats only.',
			who: 'Abe Boone',
			date: '2026-07-09T14:00:00',
		},
		{
			id: '#205',
			type: 'review',
			title: 'Enterprise Customer Preview',
			summary: 'Six Max accounts tried the new contract view.',
			who: 'Reid Hollis',
			date: '2026-07-21T09:00:00',
		},
		{
			id: '#212',
			type: 'milestone',
			title: 'Beta Accounts Paying Through Lantern',
			summary: '320 beta accounts now pay through Lantern.',
			who: 'John Armstrong',
			date: '2026-07-30T16:30:00',
		},
		{
			id: '#219',
			type: 'incident',
			title: 'Renewal Dates Set in the Wrong Zone',
			summary: '140 invoices went out a day early in the West.',
			who: 'Cody Stark',
			date: '2026-08-11T11:45:00',
		},
		{
			id: '#226',
			type: 'review',
			title: 'Release Sign-Off Handed to QA',
			summary: 'Andrea Wood now signs off every release.',
			who: 'Martin Hull',
			date: '2026-08-20T10:15:00',
		},
		{
			id: '#233',
			type: 'decision',
			title: 'Usage-Based SMS Billing Deferred to 2027',
			summary: 'Per-message SMS billing moves to next year.',
			who: 'Paige Drake',
			date: '2026-08-27T15:20:00',
		},
		{
			id: '#241',
			type: 'deployment',
			title: 'Release Candidate in All Four Regions',
			summary: 'The candidate build now bills in all four regions.',
			who: 'Derek Haas',
			date: '2026-09-01T09:00:00',
		},
		{
			id: '#248',
			type: 'migration',
			title: 'Account Admin Emails Queued',
			summary: 'Admins get a week’s notice before their account moves.',
			who: 'Brittany Fenn',
			date: '2026-09-10T15:30:00',
		},
		{
			id: '#255',
			type: 'migration',
			title: 'Sales-Led Contracts Cut Over',
			summary: 'All 86 Sales-led contracts now bill through Lantern.',
			who: 'Reid Hollis',
			date: '2026-09-16T11:40:00',
		},
		{
			id: '#262',
			type: 'milestone',
			title: 'General Availability Date Locked',
			summary: 'Launch confirmed for October 15.',
			who: 'John Armstrong',
			date: '2026-09-18T13:00:00',
		},
	];

	const view = { layout: 'timeline', type: 'all', query: '', newestFirst: false };
	const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
	let root = null;
	let canvas = null;
	let launch = null;
	let reveal = null;

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function start() {
		root = pick('[data-xtr-page="timeline"]');
		if (!root) return;
		canvas = pick('[data-hst-canvas]', root);
		const head = pick('[data-hst-head]', root);
		launch = new Date(`${head?.dataset.hstLaunch}T00:00:00`);

		paintHead(head);
		paintAll();
		wireControls();
		wireAddDialog();
		window.addEventListener('scroll', onScroll, { passive: true });
	}

	/* Text and dates */

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (char) => entities[char]);
	}

	function count(n, one, many) {
		return `${n} ${n === 1 ? one : many}`;
	}

	function initials(name) {
		return name
			.split(/\s+/)
			.map((word) => word.charAt(0))
			.join('')
			.slice(0, 2)
			.toUpperCase();
	}

	function typeFor(key) {
		return TYPES.find((type) => type.key === key) ?? { key, label: key, icon: 'bi-circle' };
	}

	function longDate(value) {
		const date = new Date(value);
		return Number.isNaN(date.getTime())
			? '—'
			: `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
	}

	function clock(value) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '—';
		const hours = date.getHours() % 12 || 12;
		return `${hours}:${String(date.getMinutes()).padStart(2, '0')} ${date.getHours() >= 12 ? 'PM' : 'AM'}`;
	}

	function shortDate(date, month = 'short') {
		return date.toLocaleDateString('en-US', { month, day: 'numeric' });
	}

	/* Today in the viewer's own time zone; toISOString would give UTC, which is
     already tomorrow on a US evening. */
	function todayKey() {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
	}

	function daysToLaunch() {
		const now = new Date();
		return Math.round((launch - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / DAY);
	}

	function launchWords() {
		const days = daysToLaunch();
		if (days > 0) return `in ${count(days, 'day', 'days')}`;
		return days === 0 ? 'today' : 'launched';
	}

	function marked(text) {
		const safe = htmlSafe(text);
		if (!view.query) return safe;
		const pattern = htmlSafe(view.query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return safe.replace(new RegExp(`(${pattern})`, 'ig'), '<mark class="hst-hit">$1</mark>');
	}

	/* Header */

	function paintHead(head) {
		if (!head) return;
		const begin = new Date(`${head.dataset.hstStart}T00:00:00`);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const passed = Math.max(0, Math.min(100, Math.round(((today - begin) / (launch - begin)) * 100)));
		const write = (selector, text) => {
			const node = pick(selector, head);
			if (node) node.textContent = text;
		};
		write('[data-hst-launch-text]', shortDate(launch));
		write('[data-hst-launch-in]', launchWords());
		write('[data-hst-elapsed-text]', `${passed}% of the project window has passed`);
		const bar = pick('[data-hst-elapsed]', head);
		if (bar) {
			bar.setAttribute('aria-valuenow', passed);
			requestAnimationFrame(() => pick('span', bar).style.setProperty('--elapsed', `${passed}%`));
		}
	}

	/* Filters and order */

	function visibleEntries() {
		const ordered = [...ENTRIES].sort((a, b) =>
			view.newestFirst ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date),
		);
		return ordered.filter((entry) => {
			if (view.type !== 'all' && entry.type !== view.type) return false;
			if (!view.query) return true;
			return `${entry.title} ${entry.summary} ${entry.who} ${typeFor(entry.type).label}`
				.toLowerCase()
				.includes(view.query);
		});
	}

	/* One chip per type the log carries, each with its live count. */
	function paintChips() {
		const tally = new Map();
		for (const entry of ENTRIES) tally.set(entry.type, (tally.get(entry.type) ?? 0) + 1);
		const chips = [{ key: 'all', label: 'All', n: ENTRIES.length }];
		for (const type of TYPES) {
			if (tally.has(type.key))
				chips.push({
					key: type.key,
					label: type.key === 'hire' ? 'Hires' : `${type.label}s`,
					n: tally.get(type.key),
				});
		}
		pick('[data-hst-chips]', root).innerHTML = chips
			.map((chip) => {
				const tone = chip.key === 'all' ? '' : ` hst-type-${chip.key}`;
				const dot = chip.key === 'all' ? '' : '<i aria-hidden="true"></i>';
				return `<button type="button" class="hst-filter${tone}" data-hst-chip="${chip.key}" aria-pressed="${view.type === chip.key}">${dot}${chip.label} <span>${chip.n}</span></button>`;
			})
			.join('');
	}

	/* Views */

	function entryCard(entry) {
		const type = typeFor(entry.type);
		const description = entry.summary ? `<p class="hst-entry-desc">${marked(entry.summary)}</p>` : '';
		return `<article class="hst-entry hst-entry-${entry.type} hst-type-${entry.type}" id="hst-${entry.id}"><div class="hst-entry-meta"><span class="hst-entry-type"><i class="bi ${type.icon}"></i> ${type.label}</span><time datetime="${entry.date}">${longDate(entry.date)} · ${clock(entry.date)}</time></div><h3 class="hst-entry-title">${marked(entry.title)}</h3>${description}<p class="hst-entry-who"><span class="hst-avatar" aria-hidden="true">${initials(entry.who)}</span>${marked(entry.who)}</p></article>`;
	}

	function monthOf(date) {
		return `${date.getFullYear()}-${date.getMonth()}`;
	}

	function feedView(entries) {
		const months = [];
		for (const entry of entries) {
			const date = new Date(entry.date);
			const key = monthOf(date);
			if (months.at(-1)?.key !== key)
				months.push({ key, label: `${MONTHS[date.getMonth()]} ${date.getFullYear()}`, entries: [] });
			months.at(-1).entries.push(entry);
		}
		return months
			.map((month) => {
				const incidents = month.entries.filter((entry) => entry.type === 'incident').length;
				const note = incidents ? ` · ${count(incidents, 'incident', 'incidents')}` : '';
				return `<section class="hst-month" data-hst-month-group="${month.key}"><div class="hst-month-head"><h2 class="hst-month-name">${month.label}</h2><span class="hst-month-count">${count(month.entries.length, 'entry', 'entries')}${note}</span></div><ul class="hst-feed">${month.entries.map((entry) => `<li>${entryCard(entry)}</li>`).join('')}</ul></section>`;
			})
			.join('');
	}

	/* A spine down the middle, a node per entry, the card on one side and its
     date on the other. Month markers sit on the spine, today is marked between
     past and future entries, and the line runs on to launch. */
	function timelineView(entries) {
		const today = new Date();
		const todayRow = `<li class="hst-line-today"><span>Today · ${shortDate(today)}</span></li>`;
		const launchRow = `<li class="hst-line-launch"><span class="hst-line-node hst-line-node-launch"><i class="bi bi-rocket-takeoff"></i></span><div class="hst-line-launch-card"><strong>Launch</strong> ${shortDate(launch, 'long')}<span>${launchWords()}</span></div></li>`;
		const rows = [];
		let month = null;
		let todayPlaced = false;
		entries.forEach((entry, index) => {
			const date = new Date(entry.date);
			if (!todayPlaced && (view.newestFirst ? date <= today : date > today)) {
				rows.push(todayRow);
				todayPlaced = true;
			}
			if (monthOf(date) !== month) {
				month = monthOf(date);
				rows.push(
					`<li class="hst-line-month" data-hst-month-group="${month}"><h2 class="hst-line-month-name">${MONTHS[date.getMonth()]} ${date.getFullYear()}</h2></li>`,
				);
			}
			const side = index % 2 ? ' is-right' : ' is-left';
			const milestone = entry.type === 'milestone' ? ' is-milestone' : '';
			rows.push(
				`<li class="hst-line-item hst-type-${entry.type}${side}${milestone}"><div class="hst-line-date"><strong>${shortDate(date)}</strong><span>${clock(date)}</span></div><span class="hst-line-node" aria-hidden="true"><i class="bi ${typeFor(entry.type).icon}"></i></span><div class="hst-line-card">${entryCard(entry)}</div></li>`,
			);
		});
		if (!todayPlaced) rows.push(todayRow);
		if (view.newestFirst) rows.unshift(launchRow);
		else rows.push(launchRow);
		return `<ol class="hst-line${reduceMotion ? '' : ' is-animated'}" data-hst-line>${rows.join('')}</ol>`;
	}

	function compactView(entries) {
		return `<ul class="hst-compact">${entries.map((entry) => `<li class="hst-type-${entry.type}" id="hst-${entry.id}"><span class="hst-compact-date">${longDate(entry.date)}</span><span class="hst-compact-dot" title="${typeFor(entry.type).label}"></span><span class="hst-compact-title"><strong>${marked(entry.title)}</strong></span><span class="hst-compact-who">${marked(entry.who)}</span></li>`).join('')}</ul>`;
	}

	function paintCanvas() {
		const entries = visibleEntries();
		if (!entries.length) {
			canvas.innerHTML =
				'<div class="xtr-empty"><div class="xtr-empty-icon"><i class="bi bi-search"></i></div><h6>No entries match</h6><p class="small text-body-secondary mb-0">Try another type or a different search.</p></div>';
			return;
		}
		if (view.layout === 'timeline') {
			canvas.innerHTML = timelineView(entries);
			animateLine();
		} else {
			canvas.innerHTML = view.layout === 'compact' ? compactView(entries) : feedView(entries);
		}
	}

	function paintAll() {
		paintChips();
		paintCanvas();
	}

	/* The spine fills as the reader scrolls, and cards glide in from their side. */
	function animateLine() {
		const line = pick('[data-hst-line]', canvas);
		if (!line) return;
		fillSpine();
		const items = pickAll('.hst-line-item', line);
		if (reduceMotion || !('IntersectionObserver' in window)) {
			for (const item of items) item.classList.add('is-in');
			return;
		}
		reveal?.disconnect();
		reveal = new IntersectionObserver(
			(seen) => {
				for (const sighting of seen) {
					if (!sighting.isIntersecting) continue;
					sighting.target.classList.add('is-in');
					reveal.unobserve(sighting.target);
				}
			},
			{ rootMargin: '0px 0px -10% 0px' },
		);
		for (const item of items) reveal.observe(item);
	}

	function fillSpine() {
		const line = pick('[data-hst-line]', canvas);
		if (!line) return;
		const box = line.getBoundingClientRect();
		line.style.setProperty('--fill', `${Math.max(0, Math.min(box.height, window.innerHeight * 0.6 - box.top))}px`);
	}

	let spineQueued = false;
	function onScroll() {
		if (spineQueued) return;
		spineQueued = true;
		requestAnimationFrame(() => {
			spineQueued = false;
			fillSpine();
		});
	}

	/* Opens an entry, clearing the filters first when they hide it. */
	function showEntry(id) {
		let card = document.getElementById(`hst-${id}`);
		if (!card) {
			view.type = 'all';
			view.query = '';
			const search = pick('[data-hst-search]', root);
			if (search) search.value = '';
			paintAll();
			card = document.getElementById(`hst-${id}`);
		}
		if (!card) return;
		card.scrollIntoView({ behavior: 'smooth', block: 'start' });
		card.classList.add('is-flash');
		setTimeout(() => card.classList.remove('is-flash'), 1600);
	}

	/* Controls */

	function wireControls() {
		pick('[data-hst-chips]', root).addEventListener('click', (event) => {
			const chip = event.target.closest('[data-hst-chip]');
			if (!chip) return;
			view.type = chip.dataset.hstChip;
			paintAll();
		});

		pick('[data-hst-search]', root)?.addEventListener('input', (event) => {
			view.query = event.target.value.trim().toLowerCase();
			paintCanvas();
		});

		const order = pick('[data-hst-sort]', root);
		order?.addEventListener('click', () => {
			view.newestFirst = !view.newestFirst;
			pick('span', order).textContent = view.newestFirst ? 'Newest first' : 'Oldest first';
			pick('i', order).className = `bi ${view.newestFirst ? 'bi-sort-down' : 'bi-sort-up'}`;
			paintCanvas();
		});

		for (const option of pickAll('[data-hst-view]', root)) {
			option.addEventListener('change', () => {
				if (!option.checked) return;
				view.layout = option.value;
				paintCanvas();
			});
		}
	}

	/* Add entry */

	function wireAddDialog() {
		const form = document.getElementById('hst-add-form');
		if (!form) return;
		const dialog = document.getElementById('hst-add-modal');
		const preview = pick('[data-hst-preview]', form);
		const title = pick('[name="title"]', form);

		/* The type tiles come from the log's own types. */
		pick('[data-hst-type-grid]', form).innerHTML = TYPES.map(
			(type, index) =>
				`<label class="basalt-choice hst-type-${type.key}"><input type="radio" name="type" value="${type.key}"${index === 1 ? ' checked' : ''}><i class="bi ${type.icon}" aria-hidden="true"></i>${type.label}</label>`,
		).join('');

		function draft() {
			const fields = new FormData(form);
			const text = (name) => String(fields.get(name) ?? '').trim();
			return {
				id: 'preview',
				date: `${fields.get('date') || todayKey()}T${fields.get('time') || '10:00'}:00`,
				type: fields.get('type') || 'decision',
				title: text('title'),
				who: text('actor') || 'Someone',
				summary: text('description'),
			};
		}

		/* The preview ignores the search, and an empty title still reads as a card. */
		function paintPreview() {
			const query = view.query;
			view.query = '';
			const entry = draft();
			preview.innerHTML = entryCard({ ...entry, title: entry.title || 'Untitled entry' });
			view.query = query;
		}

		form.addEventListener('input', () => {
			if (title.value.trim()) title.classList.remove('is-invalid');
			paintPreview();
		});
		form.addEventListener('change', paintPreview);

		dialog?.addEventListener('show.bs.modal', () => {
			const names = [...new Set(ENTRIES.map((entry) => entry.who))].sort();
			pick('[data-hst-people]', form).innerHTML = names
				.map((name) => `<option value="${htmlSafe(name)}">`)
				.join('');
			const date = pick('[name="date"]', form);
			if (!date.value) date.value = todayKey();
			paintPreview();
		});
		dialog?.addEventListener('shown.bs.modal', () => title.focus());

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const entry = draft();
			if (!entry.title) {
				title.classList.add('is-invalid');
				title.focus();
				return;
			}
			entry.id = `#${262 + ENTRIES.length}`;
			ENTRIES.push(entry);
			window.bootstrap?.Modal.getInstance(dialog)?.hide();
			form.reset();
			view.type = 'all';
			paintAll();
			window.Basalt.toasts?.push({
				tone: 'success',
				title: 'Entry added',
				text: `“${entry.title}” is on the timeline.`,
			});
			setTimeout(() => showEntry(entry.id), 350);
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', start);
	} else {
		start();
	}
})();
