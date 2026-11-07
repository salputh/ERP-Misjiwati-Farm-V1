/**
 * Basalt - Landing Pages (landing-pages.html)
 * The campaign pages on the Marlo shop site: their address, status,
 * visits, orders, conversion and last edit. Draws the four figures,
 * the list with its search and status chips, the sources and best
 * converting cards, the side panel a row opens (laid out like the page
 * editor: a preview of the page, its sections in order and its
 * numbers) and the New page dialog.
 *
 * The pages are window.Basalt.data.shopSite (assets/js/data/
 * shop-site.js); product names come from the shop book (window.
 * Basalt.shopBook, assets/basalt/js/data/multipurpose/store.js) and photos from the
 * catalog. Changes stay on this page; in a real app each would be a
 * call to your site builder.
 */
(() => {
	'use strict';
	const root = pick('[data-lp-root]');
	const site = window.Basalt.data && window.Basalt.data.shopSite;
	const book = window.Basalt.shopBook;
	if (!root || !site || !book || typeof bootstrap === 'undefined') return;

	function start() {
		n('domain').textContent = `${DOMAIN}/`;
		let touched = false;
		newEl.addEventListener('show.bs.modal', () => {
			n('form').reset();
			touched = false;
			n('title').classList.remove('is-invalid');
			if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(n('layout'));
		});
		newEl.addEventListener('shown.bs.modal', () => n('title').focus());
		n('title').addEventListener('input', () => {
			n('title').classList.remove('is-invalid');
			if (!touched) n('path').value = slug(n('title').value);
		});
		n('path').addEventListener('input', () => {
			touched = true;
		});
		n('form').addEventListener('submit', (e) => {
			e.preventDefault();
			const title = n('title').value.trim();
			if (!title) {
				n('title').classList.add('is-invalid');
				n('title').focus();
				return;
			}
			const path = `/${slug(n('path').value) || slug(title)}`;
			const p = {
				id: `lp-${slug(title)}-${pages.length}`,
				title,
				path,
				state: 'draft',
				visits: 0,
				orders: 0,
				edited: NOW,
				by: 'John Armstrong',
				sku: 'ML-BLAZ',
				skus: ['ML-BLAZ', 'ML-GOWN', 'ML-TRCH'],
				sources: [],
				blocks: LAYOUTS[n('layout').value].map((b, i) => (i === 0 ? ['hero', title] : b)),
			};
			pages.push(p);
			bootstrap.Modal.getOrCreateInstance(newEl).hide();
			state.status = 'all';
			drawFigs();
			drawList();
			toast({
				tone: 'success',
				icon: 'bi-window-plus',
				title: `${title} created`,
				text: `A draft at ${DOMAIN}${path}.`,
				actions: [{ label: 'Open', onClick: () => openPage(p.id) }],
			});
		});

		drawFigs();
		drawList();
		drawSides();
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

	function pad(n) {
		return String(n).padStart(2, '0');
	}

	function day(s) {
		const [, m, d] = s.slice(0, 10).split('-').map(Number);
		return `${MONTHS[m - 1]} ${d}`;
	}
	function clock(s) {
		const [h, m] = s.slice(11, 16).split(':').map(Number);
		return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'am' : 'pm'}`;
	}

	function photo(id, w, h) {
		return window.Basalt.photo(id, w, h);
	}

	const { TODAY, DOMAIN, PHOTOS, BLOCKS } = site;
	const pages = JSON.parse(JSON.stringify(site.PAGES));
	const STATUS = {
		live: { label: 'Live', cls: 'basalt-status-dot basalt-status-success', order: 0 },
		scheduled: { label: 'Scheduled', cls: 'basalt-status-dot basalt-status-info', order: 1 },
		draft: { label: 'Draft', cls: 'basalt-status-dot', order: 2 },
		ended: { label: 'Ended', cls: 'basalt-status-dot', order: 3 },
	};
	const SOURCE_TONE = { Newsletter: 1, Instagram: 5, Search: 3, Direct: 8 };

	function pill(p) {
		return `<span class="basalt-status ${STATUS[p.state].cls}">${STATUS[p.state].label}</span>`;
	}

	function conv(p) {
		return p.visits ? (p.orders / p.visits) * 100 : 0;
	}

	function convText(p) {
		return p.visits ? `${conv(p).toFixed(1)}%` : '–';
	}

	function pic(sku, w, h, cls, lazy) {
		return `<img class="${cls}" src="${photo(PHOTOS[sku], w * 2, h * 2)}" alt="" width="${w}" height="${h}"${lazy ? ' loading="lazy"' : ''}>`;
	}

	/* Edits are stamped with the shop book's clock (October 9 at 10:40),
     not the visitor's, so they sort with the demo data. */
	const NOW = ((window.Basalt.shopBook && window.Basalt.shopBook.NOW) || `${TODAY}T10:40`).replace('T', ' ');

	function edited(p) {
		return p.edited.slice(0, 10) === TODAY ? `Today, ${clock(p.edited)}` : day(p.edited);
	}

	function sorted() {
		return pages
			.slice()
			.sort(
				(a, b) =>
					STATUS[a.state].order - STATUS[b.state].order ||
					b.visits - a.visits ||
					b.edited.localeCompare(a.edited),
			);
	}

	/* Figures */
	function fig(k) {
		return pick(`[data-lp-fig="${k}"]`, root);
	}

	function drawFigs() {
		const visits = pages.reduce((a, p) => a + p.visits, 0);
		const orders = pages.reduce((a, p) => a + p.orders, 0);
		const top = pages.slice().sort((a, b) => b.visits - a.visits)[0];
		fig('visits').textContent = visits.toLocaleString('en-US');
		fig('visits-note').textContent = `${top.title} brought ${Math.round((top.visits / visits) * 100)}%`;
		fig('orders').textContent = orders;
		fig('orders-note').textContent = 'Placed after landing on a campaign page';
		fig('rate').textContent = `${((orders / visits) * 100).toFixed(1)}%`;
		fig('rate-note').textContent = 'Of visits ended in an order';
		const live = pages.filter((p) => p.state === 'live').length;
		const coming = pages.filter((p) => p.state === 'scheduled' || p.state === 'draft').length;
		fig('live').textContent = live;
		fig('live-note').textContent = `${plural(coming, 'more page')} in the works`;
	}

	/* The list */
	const el = {
		rows: pick('[data-lp-rows]', root),
		wrap: pick('[data-lp-wrap]', root),
		empty: pick('[data-lp-empty]', root),
		search: pick('[data-lp-search]', root),
		chips: pick('[data-lp-chips]', root),
		live: pick('[data-lp-live]', root),
	};
	const state = { q: '', status: 'all' };
	let shown = [];
	function matches(p) {
		if (state.status !== 'all' && p.state !== state.status) return false;
		if (!state.q) return true;
		const hay = [p.title, p.path, p.by].concat(p.blocks.map((b) => b[1])).join(' ');
		return window.Basalt && window.Basalt.matchesQuery
			? window.Basalt.matchesQuery(hay, state.q)
			: hay.toLowerCase().includes(state.q.toLowerCase());
	}
	function drawList() {
		shown = sorted().filter(matches);

		for (const k of Object.keys(STATUS).concat('all')) {
			pick(`[data-lp-count="${k}"]`, root).textContent =
				k === 'all' ? pages.length : pages.filter((p) => p.state === k).length;
		}

		for (const b of pickAll('[data-lp-chip]', el.chips)) {
			b.setAttribute('aria-pressed', String(b.getAttribute('data-lp-chip') === state.status));
		}

		pick('[data-lp-summary]', root).textContent =
			shown.length === pages.length
				? `${plural(pages.length, 'page')} on ${DOMAIN}. Visits and orders cover the last 30 days.`
				: `${shown.length} of ${plural(pages.length, 'page')}`;
		el.rows.innerHTML = shown
			.map(
				(p) =>
					`<tr data-lp-id="${p.id}"><td class="lp-col-name"><span class="lp-name">${pic(p.sku, 40, 40, 'lp-thumb', true)}<span class="lp-name-text">${htmlSafe(p.title)}</span></span></td><td class="lp-col-path"><span class="lp-path">${htmlSafe(p.path)}</span></td><td class="lp-col-status">${pill(p)}</td><td class="lp-col-visits">${p.visits ? `${p.visits.toLocaleString('en-US')}<span class="lp-unit"> visits</span>` : '<span class="lp-quiet">None</span>'}</td><td class="lp-col-orders">${p.visits ? p.orders : '<span class="lp-quiet">None</span>'}</td><td class="lp-col-rate">${p.visits ? `<span class="lp-rate"><span class="lp-rate-track" aria-hidden="true"><span class="lp-rate-bar" style="width:${Math.min(100, (conv(p) / 3) * 100)}%"></span></span>${convText(p)}</span>` : '<span class="lp-quiet">–</span>'}</td><td class="lp-col-edited">${edited(p)}</td><td class="lp-col-act"><button type="button" class="btn btn-icon btn-sm" data-lp-open aria-label="Quick view: ${htmlSafe(p.title)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button></td></tr>`,
			)
			.join('');
		el.wrap.hidden = !shown.length;
		el.empty.hidden = !!shown.length;
		if (window.Basalt.tips) window.Basalt.tips(el.rows);
		el.empty.innerHTML = shown.length
			? ''
			: `<div class="basalt-empty lp-empty" role="status"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-search"></i></span><p class="basalt-empty-title">${state.q ? `No pages match “${htmlSafe(state.q)}”` : 'No pages here'}</p><p class="basalt-empty-text">Try a title, an address or a section.</p><button type="button" class="btn btn-sm btn-outline-secondary" data-lp-clear>Clear filters</button></div>`;
	}
	let typing;
	el.search.addEventListener('input', () => {
		clearTimeout(typing);
		typing = setTimeout(() => {
			state.q = el.search.value.trim();
			drawList();
			el.live.textContent = `${plural(shown.length, 'page')} shown`;
		}, 160);
	});
	el.chips.addEventListener('click', (e) => {
		const b = e.target.closest('[data-lp-chip]');
		if (!b) return;
		state.status = b.getAttribute('data-lp-chip');
		drawList();
		el.live.textContent = `${plural(shown.length, 'page')} shown`;
	});
	el.empty.addEventListener('click', (e) => {
		if (!e.target.closest('[data-lp-clear]')) return;
		state.q = '';
		state.status = 'all';
		el.search.value = '';
		drawList();
		el.search.focus();
	});
	/* There is no page of its own for a landing page here, so the whole
     row opens the side panel. */
	el.rows.addEventListener('click', (e) => {
		const tr = e.target.closest('tr[data-lp-id]');
		if (tr) openPage(tr.getAttribute('data-lp-id'));
	});

	/* Sources and best converting */
	function bar(name, value, pct, tone, note) {
		return `<li class="lp-bars-row"><span class="lp-bars-name">${name}</span><span class="lp-bars-count">${value}</span><span class="lp-bars-track" aria-hidden="true"><span class="lp-bars-bar lp-tone-${tone}" style="width:${Math.max(4, Math.round(pct))}%"></span></span><span class="lp-bars-note">${note}</span></li>`;
	}
	function drawSides() {
		const visits = {};
		let total = 0;
		/* Each page's split is rounded to whole visits, with the rounding
       left on its biggest source, so the sources add up to its visits. */
		pages.forEach((p) =>
			p.sources.forEach(([s, pct], i) => {
				const n =
					i === 0
						? p.visits - p.sources.slice(1).reduce((a, x) => a + Math.round((p.visits * x[1]) / 100), 0)
						: Math.round((p.visits * pct) / 100);
				visits[s] = (visits[s] || 0) + n;
				total += n;
			}),
		);
		const src = Object.keys(visits).sort((a, b) => visits[b] - visits[a]);
		pick('[data-lp-sources-sub]', root).textContent =
			'Visits to every campaign page in the last 30 days, by where they came from.';
		pick('[data-lp-sources]', root).innerHTML = src
			.map((s) =>
				bar(
					s,
					`${Math.round((visits[s] / total) * 100)}%`,
					(visits[s] / visits[src[0]]) * 100,
					SOURCE_TONE[s] || 2,
					`${visits[s].toLocaleString('en-US')} visits`,
				),
			)
			.join('');
		const best = pages
			.filter((p) => p.visits >= 100)
			.sort((a, b) => conv(b) - conv(a))
			.slice(0, 4);
		pick('[data-lp-best-sub]', root).textContent =
			'Share of visits that ended in an order, for pages with 100 visits or more.';
		const tones = [1, 5, 3, 8];
		pick('[data-lp-best]', root).innerHTML = best
			.map((p, i) =>
				bar(
					htmlSafe(p.title),
					convText(p),
					(conv(p) / conv(best[0])) * 100,
					tones[i],
					`${plural(p.orders, 'order')} from ${plural(p.visits, 'visit')}`,
				),
			)
			.join('');
	}

	/* Side panel, laid out like the page editor */
	const drawer = pick('#lp-page');
	const body = pick('[data-lp-r="body"]', drawer);
	const foot = pick('[data-lp-r="foot"]', drawer);
	let ids = [];
	let at = 0;
	/* One section of the page, drawn small the way the site shows it. */
	function block(p, [type, label]) {
		if (type === 'hero')
			return `<div class="lp-pv lp-pv-hero">${pic(p.sku, 360, 150, 'lp-pv-img')}<span class="lp-pv-title">${htmlSafe(label)}</span><span class="lp-pv-btn">Shop now</span></div>`;
		if (type === 'products')
			return `<div class="lp-pv"><span class="lp-pv-head">${htmlSafe(label)}</span><span class="lp-pv-grid">${p.skus
				.slice(0, 4)
				.map(
					(sku) =>
						`<span class="lp-pv-item">${pic(sku, 80, 80, 'lp-pv-thumb')}<span class="lp-pv-name">${htmlSafe(book.product(sku).name)}</span></span>`,
				)
				.join('')}</span></div>`;
		if (type === 'quote')
			return `<div class="lp-pv lp-pv-quote"><i class="bi bi-quote" aria-hidden="true"></i><span class="lp-pv-head">${htmlSafe(label)}</span></div>`;
		if (type === 'signup' || type === 'booking')
			return `<div class="lp-pv lp-pv-form"><span class="lp-pv-head">${htmlSafe(label)}</span><span class="lp-pv-field"></span><span class="lp-pv-btn">${type === 'booking' ? 'Book' : 'Sign up'}</span></div>`;
		return `<div class="lp-pv"><span class="lp-pv-head">${htmlSafe(label)}</span><span class="lp-pv-line"></span><span class="lp-pv-line lp-pv-line-short"></span></div>`;
	}
	function drawRecord(p) {
		pick('[data-lp-r="title"]', drawer).textContent = p.title;
		pick('[data-lp-r="sub"]', drawer).textContent = DOMAIN + p.path;
		const when =
			p.state === 'scheduled'
				? `Goes live ${day(p.publish)}`
				: p.state === 'ended'
					? `Ended ${day(p.ended)}`
					: `Edited ${edited(p)} by ${p.by}`;
		body.innerHTML = `<div class="lp-r-state">${pill(p)}<span class="lp-quiet">${htmlSafe(when)}</span></div><section class="basalt-drawer-section" aria-labelledby="lp-r-preview"><h3 class="basalt-drawer-legend" id="lp-r-preview">Preview</h3><div class="lp-frame"><div class="lp-frame-bar" aria-hidden="true"><span class="lp-frame-dots"><i></i><i></i><i></i></span><span class="lp-frame-url">${DOMAIN}${htmlSafe(p.path)}</span></div><div class="lp-frame-page">${p.blocks.map((b) => block(p, b)).join('')}</div></div></section><section class="basalt-drawer-section" aria-labelledby="lp-r-blocks"><h3 class="basalt-drawer-legend" id="lp-r-blocks">Sections</h3><ol class="lp-blocks">${p.blocks
			.map(
				([type, label], i) =>
					`<li class="lp-block"><span class="lp-block-n">${i + 1}</span><span class="lp-block-icon" aria-hidden="true"><i class="bi ${BLOCKS[type].icon}"></i></span><span class="lp-block-text"><span class="lp-block-type">${BLOCKS[type].name}</span><span class="lp-quiet">${htmlSafe(label)}</span></span></li>`,
			)
			.join(
				'',
			)}</ol></section>${p.visits ? `<section class="basalt-drawer-section" aria-labelledby="lp-r-stats"><h3 class="basalt-drawer-legend" id="lp-r-stats">Last 30 days</h3><dl class="lp-stats"><div><dt>Visits</dt><dd>${p.visits.toLocaleString('en-US')}</dd></div><div><dt>Orders</dt><dd>${p.orders}</dd></div><div><dt>Conversion</dt><dd>${convText(p)}</dd></div></dl><p class="lp-quiet lp-r-hint">From ${p.sources.map(([s, pct]) => `${s.toLowerCase()} ${pct}%`).join(', ')}.</p></section>` : ''}`;
		const act =
			p.state === 'live'
				? ['unpublish', 'Unpublish']
				: p.state === 'ended'
					? ['publish', 'Publish again']
					: ['publish', p.state === 'scheduled' ? 'Publish now' : 'Publish'];
		foot.innerHTML = `<button type="button" class="btn btn-outline-secondary" data-lp-do="copy"><i class="bi bi-link-45deg me-1" aria-hidden="true"></i>Copy link</button><button type="button" class="btn btn-primary" data-lp-do="${act[0]}">${act[1]}</button>`;
		body.scrollTop = 0;
	}
	function navTo(i, dir) {
		at = (i + ids.length) % ids.length;
		drawRecord(pages.find((p) => p.id === ids[at]));
		pick('[data-basalt-record-pos]', drawer).textContent = `${at + 1} of ${ids.length}`;
		drawer.classList.toggle('is-back', dir < 0);
	}
	function openPage(id) {
		ids = shown.map((p) => p.id);
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
	foot.addEventListener('click', (e) => {
		const b = e.target.closest('[data-lp-do]');
		if (!b) return;
		const p = pages.find((x) => x.id === ids[at]);
		const act = b.getAttribute('data-lp-do');
		if (act === 'copy') {
			if (window.Basalt.copyText) window.Basalt.copyText(`https://${DOMAIN}${p.path}`);
			toast({ tone: 'success', icon: 'bi-link-45deg', title: 'Link copied', text: DOMAIN + p.path });
			return;
		}
		p.state = act === 'publish' ? 'live' : 'draft';
		p.edited = NOW;
		p.by = 'John Armstrong';
		drawFigs();
		drawList();
		drawRecord(p);
		toast({
			tone: 'success',
			icon: act === 'publish' ? 'bi-broadcast' : 'bi-eye-slash',
			title: p.title + (act === 'publish' ? ' is live' : ' unpublished'),
			text: act === 'publish' ? `Shoppers can open ${DOMAIN}${p.path}.` : 'It is back to a draft.',
		});
	});

	/* New page */
	const newEl = pick('#lp-new');

	function n(k) {
		return pick(`[data-lp-n="${k}"]`, newEl);
	}

	const LAYOUTS = {
		sale: [
			['hero', 'A new campaign'],
			['products', 'Shop the edit'],
			['signup', 'Hear about it first'],
		],
		story: [
			['hero', 'A new campaign'],
			['text', 'The story'],
			['products', 'Shop the edit'],
			['quote', 'What shoppers say'],
		],
		booking: [
			['hero', 'A new campaign'],
			['text', 'How it works'],
			['booking', 'Book a time'],
		],
	};

	function slug(s) {
		return s
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	start();
})();
