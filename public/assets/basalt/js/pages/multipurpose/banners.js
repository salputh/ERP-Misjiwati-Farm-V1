/**
 * Basalt - Banners (banners.html)
 * The banners on the Marlo shop site: hero banners on the home page,
 * the promo strip above the menu, collection headers and the cart
 * note. Draws a preview of what shoppers see today, the list of every
 * banner with its search and status chips, the schedule to the end
 * of the year, the side panel a row opens and the New banner dialog.
 *
 * The banners are window.Basalt.data.shopSite (assets/js/data/
 * shop-site.js); their photos are the catalog's product photos.
 * Changes stay on this page; in a real app each would be a call to
 * your site builder.
 */
(() => {
	'use strict';
	const root = pick('[data-bn-root]');
	const site = window.Basalt.data && window.Basalt.data.shopSite;
	if (!root || !site || typeof bootstrap === 'undefined') return;

	function start() {
		pick('[data-bn-new]', root).addEventListener('click', () => {
			editing = null;
			bootstrap.Modal.getOrCreateInstance(editEl).show();
		});
		editEl.addEventListener('show.bs.modal', () => {
			const b = editing;
			f('title').textContent = b ? 'Edit banner' : 'New banner';
			f('go').textContent = b ? 'Save changes' : 'Save banner';
			f('headline').value = b ? b.title : '';
			f('headline').classList.remove('is-invalid');
			f('text').value = b ? b.text : '';
			f('cta').value = b ? b.cta : 'Shop now';
			f('place').value = b ? b.placement : 'hero';
			if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(f('place'));
			if (dp) {
				dp.set(f('start'), b && b.start >= TODAY ? b.start : '');
				dp.set(f('end'), b && b.end && b.end >= TODAY ? b.end : '');
			}
		});
		editEl.addEventListener('shown.bs.modal', () => f('headline').focus());
		f('headline').addEventListener('input', () =>
			f('headline').classList.toggle('is-invalid', !f('headline').value.trim()),
		);
		f('form').addEventListener('submit', (e) => {
			e.preventDefault();
			const title = f('headline').value.trim();
			if (!title) {
				f('headline').classList.add('is-invalid');
				f('headline').focus();
				return;
			}
			const start = dp ? dp.get(f('start')) : '';
			const end = dp ? dp.get(f('end')) : '';
			const fields = {
				title,
				text: f('text').value.trim() || title,
				cta: f('cta').value.trim() || 'Shop now',
				placement: f('place').value,
			};
			let b = editing;
			if (b) {
				Object.assign(b, fields);
				if (start) b.start = start;
				if (end) b.end = end;
			} else {
				const n = Math.max(...banners.map((x) => Number(x.id.replace(/\D/g, '')))) + 1;
				b = Object.assign(
					{
						id: `#${n}`,
						link: '/',
						start: start || TODAY,
						end: end || null,
						sku: 'ML-BLAZ',
						views: 0,
						clicks: 0,
					},
					fields,
				);
				if (!start) b.state = 'draft';
				if (b.placement === 'collection') b.collection = 'Tailoring';
				banners.push(b);
			}
			bootstrap.Modal.getOrCreateInstance(editEl).hide();
			refresh();
			toast({
				tone: 'success',
				icon: 'bi-check2-circle',
				title: editing
					? `${b.title} saved`
					: b.title + (status(b) === 'draft' ? ' saved as a draft' : ' scheduled'),
				text:
					status(b) === 'draft'
						? 'Pick a start date to schedule it.'
						: `${runs(b)}, ${placeName(b).toLowerCase()}.`,
			});
			el.live.textContent = `${b.title} saved`;
		});

		refresh();
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
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function plural(n, word) {
		return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	function parse(s) {
		const [y, m, d] = s.split('-').map(Number);
		return new Date(y, m - 1, d);
	}
	function day(s) {
		const d = parse(s);
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function photo(id, w, h) {
		return window.Basalt.photo(id, w, h);
	}

	const { TODAY, DOMAIN, PHOTOS, PLACEMENTS } = site;
	const banners = JSON.parse(JSON.stringify(site.BANNERS));

	function status(b) {
		return b.state || (b.start > TODAY ? 'scheduled' : b.end && b.end < TODAY ? 'ended' : 'live');
	}

	const STATUS = {
		live: { label: 'Live', cls: 'basalt-status-dot basalt-status-success', order: 0 },
		scheduled: { label: 'Scheduled', cls: 'basalt-status-dot basalt-status-info', order: 1 },
		paused: { label: 'Paused', cls: 'basalt-status-dot basalt-status-warning', order: 2 },
		draft: { label: 'Draft', cls: 'basalt-status-dot', order: 3 },
		ended: { label: 'Ended', cls: 'basalt-status-dot', order: 4 },
	};

	function pill(b) {
		return `<span class="basalt-status ${STATUS[status(b)].cls}">${STATUS[status(b)].label}</span>`;
	}

	function runs(b) {
		return b.end ? `${day(b.start)} – ${day(b.end)}` : `From ${day(b.start)}`;
	}

	function rate(b) {
		return b.views ? `${((b.clicks / b.views) * 100).toFixed(1)}%` : '–';
	}

	const ICON = { hero: 'bi-window', strip: 'bi-distribute-vertical', collection: 'bi-collection', cart: 'bi-cart3' };

	function placeName(b) {
		return PLACEMENTS[b.placement].name;
	}

	function thumb(b, w, h, cls, lazy) {
		return `<img class="${cls}" src="${photo(b.photo || PHOTOS[b.sku], w * 2, h * 2)}" alt="" width="${w}" height="${h}"${lazy ? ' loading="lazy"' : ''}>`;
	}

	function sorted() {
		return banners
			.slice()
			.sort(
				(a, b) =>
					STATUS[status(a)].order - STATUS[status(b)].order ||
					(status(a) === 'ended' ? b.end.localeCompare(a.end) : a.start.localeCompare(b.start)),
			);
	}

	/* On the site now: the promo strip and home hero shoppers see */
	/* A banner drawn the way its placement shows it on the site. */
	function render(b, size) {
		if (!b) return '';
		if (b.placement === 'strip') {
			return `<div class="bn-strip"><span>${htmlSafe(b.text)}</span><span class="bn-strip-cta">${htmlSafe(b.cta)}</span></div>`;
		}
		if (b.placement === 'cart') {
			return `<div class="bn-cartnote">${thumb(b, 48, 48, 'bn-cartnote-img')}<span><span class="bn-hero-title">${htmlSafe(b.title)}</span><span class="bn-hero-text">${htmlSafe(b.text)}</span></span><span class="bn-hero-cta">${htmlSafe(b.cta)}</span></div>`;
		}
		return `<div class="bn-hero bn-hero-${b.placement}${size === 'small' ? ' bn-hero-small' : ''}"><div class="bn-hero-copy">${b.placement === 'collection' ? `<span class="bn-hero-eyebrow">${htmlSafe(b.collection)}</span>` : ''}<span class="bn-hero-title">${htmlSafe(b.title)}</span><span class="bn-hero-text">${htmlSafe(b.text)}</span><span class="bn-hero-cta">${htmlSafe(b.cta)}</span></div>${thumb(b, 480, 300, 'bn-hero-img')}</div>`;
	}
	function drawNow() {
		const live = sorted().filter((b) => status(b) === 'live');
		const strip = live.find((b) => b.placement === 'strip');
		const hero = live.find((b) => b.placement === 'hero');
		pick('[data-bn-now-sub]', root).textContent =
			`The home page as shoppers see it today, with ${plural(live.length, 'banner')} live across the site.`;
		pick('[data-bn-frame]', root).innerHTML =
			`<div class="bn-frame-bar" aria-hidden="true"><span class="bn-frame-dots"><i></i><i></i><i></i></span><span class="bn-frame-url">${DOMAIN}</span></div><div class="bn-frame-page">${render(strip)}<div class="bn-frame-nav" aria-hidden="true"><span class="bn-frame-brand">MARLO</span><span>Tailoring</span><span>Evening</span><span>Accessories</span><span>Gifts</span></div>${render(hero)}</div>`;
		pick('[data-bn-live-list]', root).innerHTML = live
			.map(
				(b) =>
					`<li><button type="button" class="bn-live-item" data-bn-open="${b.id}">${thumb(b, 40, 40, 'bn-live-img')}<span class="bn-live-text"><span class="bn-live-name">${htmlSafe(b.title)}</span><span class="bn-quiet">${placeName(b)} · ${b.end ? `until ${day(b.end)}` : 'no end date'}</span></span><i class="bi bi-chevron-right" aria-hidden="true"></i></button></li>`,
			)
			.join('');
	}

	/* All banners */
	const el = {
		rows: pick('[data-bn-rows]', root),
		wrap: pick('[data-bn-wrap]', root),
		empty: pick('[data-bn-empty]', root),
		search: pick('[data-bn-search]', root),
		chips: pick('[data-bn-chips]', root),
		live: pick('[data-bn-live]', root),
	};
	const state = { q: '', status: 'all' };
	let shown = [];
	function matches(b) {
		if (state.status !== 'all' && status(b) !== state.status) return false;
		if (!state.q) return true;
		const hay = [b.id, b.title, b.text, b.cta, placeName(b), b.collection || ''].join(' ');
		return window.Basalt && window.Basalt.matchesQuery
			? window.Basalt.matchesQuery(hay, state.q)
			: hay.toLowerCase().includes(state.q.toLowerCase());
	}
	function drawList() {
		shown = sorted().filter(matches);

		for (const k of Object.keys(STATUS).concat('all')) {
			pick(`[data-bn-count="${k}"]`, root).textContent =
				k === 'all' ? banners.length : banners.filter((b) => status(b) === k).length;
		}

		for (const b of pickAll('[data-bn-chip]', el.chips)) {
			b.setAttribute('aria-pressed', String(b.getAttribute('data-bn-chip') === state.status));
		}

		const clicks = banners.reduce((a, b) => a + b.clicks, 0);
		pick('[data-bn-summary]', root).textContent =
			shown.length === banners.length
				? `${plural(banners.length, 'banner')} in four places on the site, with ${plural(clicks, 'click')} since August.`
				: `${shown.length} of ${plural(banners.length, 'banner')}`;
		el.rows.innerHTML = shown
			.map((b) => {
				const P = PLACEMENTS[b.placement];
				return `<tr data-bn-id="${b.id}"><td class="bn-col-name"><span class="bn-name">${thumb(b, 56, 36, 'bn-thumb', true)}<span class="bn-name-text">${htmlSafe(b.title)}</span></span></td><td class="bn-col-place"><span class="bn-place"><span class="bn-dot bn-tone-${P.tone}" aria-hidden="true"></span>${P.name}</span></td><td class="bn-col-runs">${runs(b)}</td><td class="bn-col-views">${b.views ? b.views.toLocaleString('en-US') : '<span class="bn-quiet">None yet</span>'}</td><td class="bn-col-rate">${rate(b)}</td><td class="bn-col-status">${pill(b)}</td><td class="bn-col-act"><button type="button" class="btn btn-icon btn-sm" data-bn-open="${b.id}" aria-label="Quick view: ${htmlSafe(b.title)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button></td></tr>`;
			})
			.join('');
		el.wrap.hidden = !shown.length;
		el.empty.hidden = !!shown.length;
		if (window.Basalt.tips) window.Basalt.tips(el.rows);
		el.empty.innerHTML = shown.length
			? ''
			: `<div class="basalt-empty bn-empty" role="status"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-search"></i></span><p class="basalt-empty-title">${state.q ? `No banners match “${htmlSafe(state.q)}”` : 'No banners here'}</p><p class="basalt-empty-text">Try a headline, a placement or a button.</p><button type="button" class="btn btn-sm btn-outline-secondary" data-bn-clear>Clear filters</button></div>`;
	}
	let typing;
	el.search.addEventListener('input', () => {
		clearTimeout(typing);
		typing = setTimeout(() => {
			state.q = el.search.value.trim();
			drawList();
			el.live.textContent = `${plural(shown.length, 'banner')} shown`;
		}, 160);
	});
	el.chips.addEventListener('click', (e) => {
		const b = e.target.closest('[data-bn-chip]');
		if (!b) return;
		state.status = b.getAttribute('data-bn-chip');
		drawList();
		el.live.textContent = `${plural(shown.length, 'banner')} shown`;
	});
	el.empty.addEventListener('click', (e) => {
		if (!e.target.closest('[data-bn-clear]')) return;
		state.q = '';
		state.status = 'all';
		el.search.value = '';
		drawList();
		el.search.focus();
	});
	/* There is no page per banner, so the whole row opens the side panel. */
	root.addEventListener('click', (e) => {
		const open = e.target.closest('[data-bn-open]');
		const tr = e.target.closest('tr[data-bn-id]');
		if (open)
			openBanner(
				open.getAttribute('data-bn-open'),
				open.closest('[data-bn-live-list]') ? sorted().filter((b) => status(b) === 'live') : shown,
			);
		else if (tr) openBanner(tr.getAttribute('data-bn-id'), shown);
	});

	/* Schedule: October to December, one row per banner */
	const PLAN_FROM = '2026-10-01';
	const PLAN_TO = '2026-12-31';
	const span = (parse(PLAN_TO) - parse(PLAN_FROM)) / 864e5 + 1;

	function pos(s) {
		return Math.min(100, Math.max(0, ((parse(s) - parse(PLAN_FROM)) / 864e5 / span) * 100));
	}

	function drawPlan() {
		const rows = sorted().filter((b) => status(b) !== 'ended' && (!b.end || b.end >= PLAN_FROM));
		const months = [
			['Oct', '2026-10-01'],
			['Nov', '2026-11-01'],
			['Dec', '2026-12-01'],
		];
		pick('[data-bn-plan]', root).innerHTML =
			`<div class="bn-plan-row bn-plan-row-head" aria-hidden="true"><span class="bn-plan-label"></span><span class="bn-plan-track">${months.map(([m, d]) => `<span class="bn-plan-month" style="left:${pos(d)}%">${m}</span>`).join('')}</span></div><ol class="bn-plan-list">${rows
				.map((b) => {
					const from = pos(b.start < PLAN_FROM ? PLAN_FROM : b.start);
					const to = b.end ? pos(b.end) + 100 / span : 100;
					const st = status(b);
					return `<li class="bn-plan-row"><span class="bn-plan-label"><span class="bn-dot bn-tone-${PLACEMENTS[b.placement].tone}" aria-hidden="true"></span><span class="bn-plan-name">${htmlSafe(b.title)}</span></span><span class="bn-plan-track">${months.map(([, d]) => `<span class="bn-plan-grid" style="left:${pos(d)}%" aria-hidden="true"></span>`).join('')}<span class="bn-plan-today" style="left:${pos(TODAY)}%" aria-hidden="true"></span><span class="bn-plan-bar bn-tone-${PLACEMENTS[b.placement].tone} is-${st}" style="left:${from}%;width:${Math.max(1.5, to - from)}%"></span><span class="visually-hidden">${placeName(b)}, ${runs(b)}, ${STATUS[st].label}</span></span></li>`;
				})
				.join('')}</ol><ul class="bn-plan-key">${Object.keys(PLACEMENTS)
				.map(
					(k) =>
						`<li><span class="bn-dot bn-tone-${PLACEMENTS[k].tone}" aria-hidden="true"></span>${PLACEMENTS[k].name}</li>`,
				)
				.join('')}<li><span class="bn-key-dash" aria-hidden="true"></span>Paused or draft</li></ul>`;
	}

	/* Side panel */
	const drawer = pick('#bn-banner');
	const body = pick('[data-bn-r="body"]', drawer);
	const foot = pick('[data-bn-r="foot"]', drawer);
	let ids = [];
	let at = 0;
	function drawRecord(b) {
		const P = PLACEMENTS[b.placement];
		const t = pick('[data-bn-r="tile"]', drawer);
		t.className = `bn-tile bn-tone-${P.tone}`;
		t.innerHTML = `<i class="bi ${ICON[b.placement]}"></i>`;
		pick('[data-bn-r="title"]', drawer).textContent = b.title;
		pick('[data-bn-r="sub"]', drawer).textContent =
			`${P.name + (b.collection ? `, ${b.collection}` : '')} · ${b.id}`;
		const st = status(b);
		body.innerHTML = `<div class="bn-r-state">${pill(b)}<span class="bn-quiet">${runs(b)}</span></div><section class="basalt-drawer-section" aria-labelledby="bn-r-preview"><h3 class="basalt-drawer-legend" id="bn-r-preview">Preview</h3><div class="bn-r-preview">${render(b, 'small')}</div><p class="bn-quiet bn-r-hint">${htmlSafe(P.note)}.</p></section><section class="basalt-drawer-section" aria-labelledby="bn-r-stats"><h3 class="basalt-drawer-legend" id="bn-r-stats">Since it started</h3><dl class="bn-stats"><div><dt>Views</dt><dd>${b.views.toLocaleString('en-US')}</dd></div><div><dt>Clicks</dt><dd>${b.clicks.toLocaleString('en-US')}</dd></div><div><dt>Click rate</dt><dd>${rate(b)}</dd></div></dl></section><section class="basalt-drawer-section" aria-labelledby="bn-r-link"><h3 class="basalt-drawer-legend" id="bn-r-link">Button</h3><dl class="bn-facts"><div><dt>Text</dt><dd>${htmlSafe(b.cta)}</dd></div><div><dt>Opens</dt><dd>${DOMAIN}${htmlSafe(b.link)}</dd></div></dl></section>`;
		const toggle =
			st === 'live'
				? '<button type="button" class="btn btn-outline-secondary" data-bn-do="pause"><i class="bi bi-pause-circle me-1" aria-hidden="true"></i>Pause</button>'
				: st === 'paused'
					? '<button type="button" class="btn btn-outline-secondary" data-bn-do="resume"><i class="bi bi-play-circle me-1" aria-hidden="true"></i>Resume</button>'
					: st === 'draft'
						? '<button type="button" class="btn btn-outline-secondary" data-bn-do="schedule"><i class="bi bi-calendar-check me-1" aria-hidden="true"></i>Schedule</button>'
						: '';
		foot.innerHTML = `${toggle}<button type="button" class="btn btn-primary" data-bn-do="edit"><i class="bi bi-pencil me-1" aria-hidden="true"></i>Edit</button>`;
		body.scrollTop = 0;
	}
	function navTo(i, dir) {
		at = (i + ids.length) % ids.length;
		drawRecord(banners.find((b) => b.id === ids[at]));
		pick('[data-basalt-record-pos]', drawer).textContent = `${at + 1} of ${ids.length}`;
		drawer.classList.toggle('is-back', dir < 0);
	}
	function openBanner(id, list) {
		ids = list.map((b) => b.id);
		if (!ids.includes(id)) ids = [id];
		navTo(ids.indexOf(id));
		bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
	}
	pick('[data-basalt-record-prev]', drawer).addEventListener('click', () => navTo(at - 1, -1));
	pick('[data-basalt-record-next]', drawer).addEventListener('click', () => navTo(at + 1, 1));
	drawer.addEventListener('keydown', (e) => {
		if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
		e.preventDefault();
		navTo(at + (e.key === 'ArrowUp' ? -1 : 1), e.key === 'ArrowUp' ? -1 : 1);
	});
	function refresh() {
		drawNow();
		drawList();
		drawPlan();
	}
	foot.addEventListener('click', (e) => {
		const b = e.target.closest('[data-bn-do]');
		if (!b) return;
		const ban = banners.find((x) => x.id === ids[at]);
		const act = b.getAttribute('data-bn-do');
		if (act === 'edit') {
			editing = ban;
			bootstrap.Offcanvas.getOrCreateInstance(drawer).hide();
			bootstrap.Modal.getOrCreateInstance(editEl).show();
			return;
		}
		if (act === 'pause') ban.state = 'paused';
		else delete ban.state;
		refresh();
		drawRecord(ban);
		toast({
			tone: 'success',
			icon: act === 'pause' ? 'bi-pause-circle' : 'bi-play-circle',
			title: `${ban.title} ${act === 'pause' ? 'paused' : status(ban) === 'live' ? 'is live' : 'scheduled'}`,
			text:
				act === 'pause'
					? 'Hidden from the site until you resume it.'
					: `${runs(ban)}, ${placeName(ban).toLowerCase()}.`,
		});
	});

	/* New or edit banner */
	const editEl = pick('#bn-edit');

	function f(n) {
		return pick(`[data-bn-e="${n}"]`, editEl);
	}

	const dp = window.Basalt.datepicker;
	let editing = null;
	start();
})();
