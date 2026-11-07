/**
 * Basalt - Blog (blog.html)
 * The posts on the Fieldline blog: the next ones to go live, every
 * post by status, what people read and what they said. A row opens the
 * post's own page, where it is written and edited; the panel icon opens
 * a quick view in a side panel. New post starts a draft from a
 * title, a category and an author.
 *
 * To use your own posts:
 *   1. Replace the posts in assets/basalt/js/data/multipurpose/blog.js with what your
 *      backend returns, same shape. Every count, card and row on the
 *      page is drawn from them, and the post page reads the same list.
 *   2. The create, move and delete handlers change POSTS in memory.
 *      That is where your API calls go.
 *   3. postUrl() is the post's own page, e.g. post-editor.html?id=p224.
 * Built from shared parts in basalt.js: tabs, styled selects,
 * avatars, status pills, pagination, the drawer, empty states and
 * toasts.
 */
(() => {
	'use strict';
	const root = pick('[data-cb-root]');
	if (!root) return;

	/* DEMO DATA */
	/* The demo's "today". In your app, use the real date. */
	const TODAY = '2026-10-09';

	function start() {
		el.drawer.addEventListener('show.bs.offcanvas', () => toastsAt('top-center'));
		el.drawer.addEventListener('hidden.bs.offcanvas', () => {
			toastsAt('bottom-end');
			const id = state.open;
			state.open = null;
			const back = id && pick(`[data-cb-open="${id}"]`, root);
			if (back) back.focus({ preventScroll: true });
		});

		paintEverything();
	}

	function postUrl(p) {
		return `post-editor.html?id=${encodeURIComponent(p.id)}`;
	}

	/* The posts, their categories and authors, shared with the post's
     own page: assets/basalt/js/data/multipurpose/blog.js. Each category takes one chart
     color from the theme, by number. */
	const BLOG = window.Basalt.data.blog;
	const CATEGORIES = BLOG.categories;
	const AUTHORS = BLOG.authors;
	const POSTS = BLOG.posts;

	const SOURCES = ['Search', 'Newsletter', 'Social', 'Direct'];
	const STATUS = {
		published: { label: 'Published', tone: 'success' },
		scheduled: { label: 'Scheduled', tone: 'primary' },
		review: { label: 'In review', tone: 'warning' },
		draft: { label: 'Draft', tone: '' },
	};
	const PER_PAGE = 8;
	const UP_NEXT = 4;

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

	function num(n) {
		return Number(n || 0).toLocaleString('en-US');
	}

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many || `${one}s`}`;
	}

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	function day(iso) {
		return window.Basalt.toLocalDay(iso);
	}

	function sameYear(iso) {
		return iso.slice(0, 4) === TODAY.slice(0, 4);
	}

	function fmtDay(iso, withYear) {
		const d = day(iso);
		return `${MONTHS[d.getMonth()]} ${d.getDate()}${withYear ? `, ${d.getFullYear()}` : ''}`;
	}
	function fmtLong(iso) {
		const d = day(iso);
		return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function clockText(hhmm) {
		const [h, m] = String(hhmm || '09:00')
			.split(':')
			.map(Number);
		return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
	}

	function slugify(s) {
		return String(s || '')
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/['’`"]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 70);
	}

	function cat(name) {
		return CATEGORIES.find((c) => c.name === name) || CATEGORIES[0];
	}

	function nodeById(id) {
		return POSTS.find((p) => p.id === id);
	}

	function photo(p, w, h) {
		return p.cover ? window.Basalt.photo(p.cover, w, h) : '';
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function ago(days) {
		return days === 0 ? 'Earlier today' : days === 1 ? 'Yesterday' : `${days} days ago`;
	}

	/* A cover sits on a tile in its category's color with the category
     icon, which is what shows if the photo is missing or fails to load. */
	const SIZES = { sm: [160, 110], md: [640, 360], lg: [960, 540] };
	function thumb(p, size) {
		const c = cat(p.category);
		const [w, h] = SIZES[size || 'sm'];
		const src = photo(p, w, h);
		return `<span class="cb-thumb${size ? ` cb-thumb-${size}` : ''} cb-tone-${c.tone}" aria-hidden="true"><i class="bi ${c.icon}"></i>${src ? `<img src="${htmlSafe(src)}" alt="" loading="lazy" width="${w}" height="${h}">` : ''}</span>`;
	}
	document.addEventListener(
		'error',
		(e) => {
			const img = e.target;
			if (img && img.tagName === 'IMG' && img.parentElement && img.parentElement.classList.contains('cb-thumb'))
				img.remove();
		},
		true,
	);

	function pill(status) {
		const s = STATUS[status];
		return `<span class="basalt-status basalt-status-dot${s.tone ? ` basalt-status-${s.tone}` : ''}">${s.label}</span>`;
	}

	function avatar(name, cls) {
		return `<span class="basalt-avatar ${cls || 'basalt-avatar-xs'}" aria-hidden="true" data-basalt-avatar data-name="${htmlSafe(name)}"></span>`;
	}

	/* The post's title as a link to its own page. */
	function titleLink(p, cls) {
		return `<a class="cb-link ${cls}" href="${postUrl(p)}">${htmlSafe(p.title)}</a>`;
	}

	/* Quick view and Open full page, side by side at the end of a row or tile. */
	function rowActions(p) {
		return `<span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-cb-open="${p.id}" aria-label="Quick view: ${htmlSafe(p.title)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${postUrl(p)}" aria-label="Open full page: ${htmlSafe(p.title)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span>`;
	}

	/* The date that matters for each status, with a quiet word saying which. */
	function dateCell(p) {
		if (p.status === 'published') return { main: fmtDay(p.date, !sameYear(p.date)), note: 'Went live' };
		if (p.status === 'scheduled') return { main: fmtDay(p.date, !sameYear(p.date)), note: clockText(p.time) };
		if (p.status === 'review')
			return { main: p.date ? fmtDay(p.date) : 'No date', note: p.date ? 'Planned' : 'Not planned yet' };
		return { main: fmtDay(p.edited), note: 'Last edited' };
	}
	/* The same date as one phrase, for the stacked rows on narrow cards. */
	function shortDate(p) {
		if (p.status === 'published') return `Live since ${fmtDay(p.date, !sameYear(p.date))}`;
		if (p.status === 'scheduled') return `${fmtDay(p.date)}, ${clockText(p.time)}`;
		if (p.status === 'review') return p.date ? `Planned for ${fmtDay(p.date)}` : 'Not planned yet';
		return `Edited ${fmtDay(p.edited)}`;
	}

	/* Sort key: the day a post goes or went live; drafts by their last edit. */
	function when(p) {
		return p.date || p.edited || TODAY;
	}

	/* State and elements */
	const state = { tab: 'all', q: '', category: 'all', sort: 'newest', page: 1, open: null };
	const el = {
		rows: pick('[data-cb-rows]', root),
		table: pick('.cb-table', root),
		empty: pick('[data-cb-empty]', root),
		pager: pick('[data-cb-pager]', root),
		pages: pick('[data-cb-pages]', root),
		range: pick('[data-cb-range]', root),
		search: pick('[data-cb-search]', root),
		category: pick('[data-cb-category]', root),
		sort: pick('[data-cb-sort]', root),
		up: pick('[data-cb-up]', root),
		upFoot: pick('[data-cb-up-foot]', root),
		read: pick('[data-cb-read]', root),
		readFoot: pick('[data-cb-read-foot]', root),
		talk: pick('[data-cb-talk]', root),
		talkFoot: pick('[data-cb-talk-foot]', root),
		drawer: document.getElementById('cb-post'),
		dialog: document.getElementById('cb-new'),
	};
	let pagerCtl = null;

	function renderCounts() {
		function count(s) {
			return POSTS.filter((p) => p.status === s).length;
		}

		pick('[data-cb-count="all"]', root).textContent = POSTS.length;

		for (const s of ['published', 'scheduled', 'review', 'draft']) {
			pick(`[data-cb-count="${s}"]`, root).textContent = count(s);
		}
	}

	/* Up next: the dated posts that are not live yet, as cover tiles */
	function renderUp() {
		const dated = POSTS.filter((p) => (p.status === 'scheduled' || p.status === 'review') && p.date).sort((a, b) =>
			a.date.localeCompare(b.date),
		);
		const list = dated.slice(0, UP_NEXT);
		el.up.innerHTML = list.length
			? list
					.map((p) => {
						const c = cat(p.category);
						const d = day(p.date);
						const at = `${DAYS[d.getDay()]}, ${clockText(p.time)}`;
						return `<li class="cb-tile cb-tone-${c.tone}" data-cb-id="${p.id}"><div class="cb-tile-cover">${thumb(p, 'md')}<span class="cb-tile-date"><span class="visually-hidden">Goes live </span>${fmtDay(p.date)}</span></div><div class="cb-tile-body"><p class="cb-meta"><span class="cb-dot" aria-hidden="true"></span>${htmlSafe(p.category)} &middot; <span class="cb-nowrap">${at}</span></p><h3 class="cb-tile-title">${titleLink(p, 'cb-tile-link')}</h3><div class="cb-tile-foot"><span class="cb-author">${avatar(p.author)}<span>${htmlSafe(p.author)}</span></span><div class="cb-tile-row">${pill(p.status)}${rowActions(p)}</div></div></div></li>`;
					})
					.join('')
			: `<li class="cb-up-none">${window.Basalt.emptyState({ icon: 'calendar2-check', title: 'Nothing planned yet', text: 'Schedule a post and it shows here.' })}</li>`;

		const later = dated.length - list.length;
		const drafts = POSTS.filter((p) => p.status === 'draft').length;
		const bits = [];
		if (later) bits.push(`${plural(later, 'more post', 'more posts')} planned after these.`);
		if (drafts) bits.push(`${plural(drafts, 'draft has', 'drafts have')} no date yet.`);
		el.upFoot.innerHTML = bits.length
			? `<span>${bits.join(' ')}</span> <button type="button" class="cb-link cb-link-quiet" data-cb-goto="${drafts ? 'draft' : 'review'}">${drafts ? 'See drafts' : 'See posts in review'}</button>`
			: '';
		if (window.Basalt.avatars) window.Basalt.avatars(el.up);
		if (window.Basalt.tips) window.Basalt.tips(el.up);
	}

	/* Most read: views in the last 30 days */
	function renderRead() {
		const live = POSTS.filter((p) => p.status === 'published');
		const top = live
			.slice()
			.sort((a, b) => b.views30 - a.views30)
			.slice(0, 5);
		const max = top.length ? top[0].views30 : 1;
		el.read.innerHTML = top
			.map((p, i) => {
				const c = cat(p.category);
				return `<li class="cb-read-item cb-tone-${c.tone}"><span class="cb-read-rank" aria-hidden="true">${i + 1}</span><div class="cb-read-main"><div class="cb-read-line">${titleLink(p, 'cb-read-title')}<span class="cb-read-value">${num(p.views30)}<span class="visually-hidden"> views</span></span></div><span class="cb-read-bar" aria-hidden="true"><span style="width:${Math.max(4, Math.round((p.views30 / max) * 100))}%"></span></span><p class="cb-meta"><span class="cb-dot" aria-hidden="true"></span>${htmlSafe(p.category)} &middot; ${fmtDay(p.date)}</p></div></li>`;
			})
			.join('');
		el.readFoot.textContent = live.length
			? `${num(live.reduce((a, p) => a + p.views30, 0))} views across ${plural(live.length, 'published post')}.`
			: '';
	}

	/* Latest comments: the newest comment on each live post */
	function renderTalk() {
		const live = POSTS.filter((p) => p.status === 'published');
		const list = live
			.filter((p) => p.latest)
			.sort((a, b) => a.latest.days - b.latest.days)
			.slice(0, 4);
		el.talk.innerHTML = list.length
			? list
					.map((p) => {
						const c = p.latest;
						return `<li class="cb-talk-item">${avatar(c.who, 'basalt-avatar-sm')}<div class="cb-talk-main"><p class="cb-talk-who"><span>${htmlSafe(c.who)}</span><span class="cb-meta">${ago(c.days)}</span></p><p class="cb-talk-text">${htmlSafe(c.text)}</p><p class="cb-meta">On ${titleLink(p, 'cb-talk-post')}</p></div></li>`;
					})
					.join('')
			: `<li class="cb-up-none">${window.Basalt.emptyState({ icon: 'chat', title: 'No comments yet', text: 'Comments on live posts show here.' })}</li>`;
		const total = live.reduce((a, p) => a + (p.comments || 0), 0);
		el.talkFoot.innerHTML = `<span>${plural(total, 'comment')} on ${plural(live.length, 'live post')}.</span> <a class="cb-link cb-link-quiet" href="comments.html">Open comments</a>`;
		if (window.Basalt.avatars) window.Basalt.avatars(el.talk);
	}

	/* Insights: the past 30 days across the live posts, worked out again
     whenever a post goes live or comes down. Figures count up only the
     first time. */
	let insightsShown = false;

	function renderInsights() {
		const live = POSTS.filter((p) => p.status === 'published');
		if (!live.length) return;
		const topics = topicStats(live);
		renderFigures(live);
		renderIdeas(live, topics);
		renderTopics(topics);
		renderReaders(live);
		insightsShown = true;
	}

	/** Reads, comments and sources added up per category, busiest per post first. */
	function topicStats(live) {
		return CATEGORIES.map((c) => {
			const own = live.filter((p) => p.category === c.name);
			const reads = own.reduce((a, p) => a + p.views30, 0);
			const sources = SOURCES.map((_, i) => own.reduce((a, p) => a + p.views30 * p.sources[i], 0) / (reads || 1));
			return {
				name: c.name,
				tone: c.tone,
				posts: own.length,
				reads,
				average: own.length ? reads / own.length : 0,
				comments: own.reduce((a, p) => a + (p.comments || 0), 0),
				sources,
			};
		})
			.filter((t) => t.posts)
			.sort((a, b) => b.average - a.average);
	}

	function renderFigures(live) {
		const reads = live.reduce((a, p) => a + p.views30, 0);
		const comments = live.reduce((a, p) => a + (p.comments || 0), 0);
		const byDate = live
			.slice()
			.sort((a, b) => a.date.localeCompare(b.date))
			.slice(-10);
		const titles = byDate.map((p) => p.title);
		const months = [...new Set(live.map((p) => p.date.slice(0, 7)))].sort();
		const monthly = months.map((m) => meanReads(live.filter((p) => p.date.startsWith(m))));
		const { returning, finished } = BLOG.readers;
		const whole = (v) => num(Math.round(v));
		const share = (v) => `${Math.round(v)}%`;
		const figures = [
			{
				label: 'Reads, last 30 days',
				value: reads,
				show: whole,
				note: plural(live.length, 'live post'),
				trend: [byDate.map((p) => p.views30), titles, (v) => `${whole(v)} reads`],
			},
			{
				label: 'Reads per post',
				value: reads / live.length,
				show: whole,
				note: 'By month posted',
				trend: [
					monthly,
					months.map((m) => `Posts from ${MONTHS[Number(m.slice(5)) - 1]}`),
					(v) => `${whole(v)} a post`,
				],
			},
			{ label: 'Came back for more', value: returning, show: share, note: 'Read a second post' },
			{ label: 'Read to the end', value: finished, show: share, note: 'Finished the post' },
			{
				label: 'Comments',
				value: comments,
				show: whole,
				note: `${(comments / (reads / 1000)).toFixed(1)} per 1,000 reads`,
				trend: [byDate.map((p) => p.comments || 0), titles, (v) => plural(v, 'comment')],
			},
		];
		const box = pick('[data-cb-figs]', root);
		box.innerHTML = figures
			.map(
				(f) =>
					`<div class="cb-fig"><dt>${f.label}</dt><dd class="cb-fig-value">${f.show(insightsShown ? f.value : 0)}</dd><dd class="cb-fig-art">${f.trend ? '<div class="cb-fig-line"></div>' : meter(f.value)}</dd><dd class="cb-fig-note">${f.note}</dd></div>`,
			)
			.join('');
		pickAll('.cb-fig', box).forEach((tile, i) => {
			const f = figures[i];
			if (f.trend && window.Basalt.trendline) {
				const [values, labels, format] = f.trend;
				window.Basalt.trendline(pick('.cb-fig-line', tile), values, {
					labels,
					format,
					name: f.label,
					onRead: (point, reading, name) =>
						readOut(tile, point === null ? null : [f.show(reading), name], [f.show(f.value), f.note]),
				});
			}
			if (!insightsShown) countUp(pick('.cb-fig-value', tile), f.value, f.show);
		});
	}

	/** Shows a point's reading in a figure tile, or puts the tile's own figure back. */
	function readOut(tile, reading, resting) {
		const [figure, note] = reading || resting;
		tile.classList.toggle('is-reading', Boolean(reading));
		pick('.cb-fig-value', tile).textContent = figure;
		pick('.cb-fig-note', tile).textContent = note;
	}

	function meter(percent) {
		return `<span class="cb-meter" aria-hidden="true"><span style="--cb-w: ${percent}%"></span></span>`;
	}

	/** Eases a figure up from zero; with reduced motion it simply shows. */
	function countUp(cell, target, show) {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			cell.textContent = show(target);
			return;
		}
		const started = performance.now();
		const step = (now) => {
			const t = Math.min(1, (now - started) / 500);
			cell.textContent = show(target * (1 - (1 - t) ** 3));
			if (t < 1) requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	}

	/* Four suggestions, each worked out from the numbers and saying what it rests on. */
	function renderIdeas(live, topics) {
		const average = live.reduce((a, p) => a + p.views30, 0) / live.length;
		const [best] = topics;
		const low = topics.at(-1);
		const searched = topics.slice().sort((a, b) => b.sources[0] - a.sources[0])[0];
		const blogSearch =
			live.reduce((a, p) => a + p.views30 * p.sources[0], 0) / live.reduce((a, p) => a + p.views30, 0);
		const talked = topics.slice().sort((a, b) => b.comments / b.reads - a.comments / a.reads)[0];
		const long = live.filter((p) => wordsIn(p) >= 380);
		const short = live.filter((p) => wordsIn(p) < 380);
		const ideas = [
			{
				icon: 'bi-graph-up-arrow',
				title: `Write more ${best.name}`,
				why: `${best.name} posts average ${num(Math.round(best.average))} reads, ${(best.average / average).toFixed(1)}× the blog's ${num(Math.round(average))}.`,
				act: `<button type="button" class="btn btn-outline-secondary btn-sm" data-cb-idea-new="${htmlSafe(best.name)}">Start one</button>`,
			},
			{
				icon: 'bi-search',
				title: `Put a question in ${searched.name} titles`,
				why: `${Math.round(searched.sources[0])}% of ${searched.name} reads come from search, against ${Math.round(blogSearch)}% for the blog.`,
				act: `<button type="button" class="btn btn-outline-secondary btn-sm" data-cb-idea-topic="${htmlSafe(searched.name)}">See the posts</button>`,
			},
			long.length && short.length
				? {
						icon: 'bi-text-paragraph',
						title: 'Go past 380 words',
						why: `Posts that long average ${num(Math.round(meanReads(long)))} reads; shorter ones ${num(Math.round(meanReads(short)))}.`,
						act: '<button type="button" class="btn btn-outline-secondary btn-sm" data-cb-idea-new="">Start a long one</button>',
					}
				: null,
			{
				icon: 'bi-chat-heart',
				title: `End ${talked.name} posts with a question`,
				why: `They draw ${((talked.comments / talked.reads) * 1000).toFixed(1)} comments per 1,000 reads, the most of any topic.`,
				act: '<a class="btn btn-outline-secondary btn-sm" href="comments.html">Read the comments</a>',
			},
			{
				icon: 'bi-envelope-paper',
				title: `Send ${low.name} posts by newsletter`,
				why: `They average ${num(Math.round(low.average))} reads, and ${Math.round(low.sources[1])}% of those come from the newsletter.`,
				act: '<a class="btn btn-outline-secondary btn-sm" href="newsletters.html">Plan a newsletter</a>',
			},
		]
			.filter(Boolean)
			.slice(0, 4);
		pick('[data-cb-ideas]', root).innerHTML = ideas
			.map(
				(idea, i) =>
					`<li class="basalt-idea" style="--i: ${i}"><span class="basalt-idea-icon" aria-hidden="true"><i class="bi ${idea.icon}"></i></span><p class="basalt-idea-title">${htmlSafe(idea.title)}</p><p class="basalt-idea-why">${htmlSafe(idea.why)}</p>${idea.act}</li>`,
			)
			.join('');
	}

	function wordsIn(p) {
		return String(p.body || '')
			.replace(/<[^>]+>/g, ' ')
			.split(/\s+/)
			.filter(Boolean).length;
	}

	function meanReads(list) {
		return list.reduce((a, p) => a + p.views30, 0) / list.length;
	}

	/* What people read: reads per post by topic, the longest bar first. */
	function renderTopics(topics) {
		const top = topics[0].average;
		pick('[data-cb-topics]', root).innerHTML = topics
			.map(
				(t) =>
					`<li class="cb-topic cb-tone-${t.tone}"><span class="cb-topic-name"><span class="cb-dot" aria-hidden="true"></span>${htmlSafe(t.name)}</span><span class="cb-topic-bar" aria-hidden="true"><span style="--cb-w: ${((t.average / top) * 100).toFixed(1)}%"></span></span><span class="cb-topic-value">${num(Math.round(t.average))}<span class="visually-hidden"> reads per post</span></span><span class="cb-topic-posts">${plural(t.posts, 'post')}</span></li>`,
			)
			.join('');
	}

	/* Who reads: where the reads came from as one split bar, then who the readers are. */
	function renderReaders(live) {
		const reads = live.reduce((a, p) => a + p.views30, 0);
		const shares = SOURCES.map((name, i) => ({
			name,
			share: live.reduce((a, p) => a + p.views30 * p.sources[i], 0) / reads,
		}));
		const lead = shares.slice().sort((a, b) => b.share - a.share)[0];
		pick('[data-cb-from-desc]', root).textContent =
			`${lead.name} brings the most readers, ${Math.round(lead.share)}% of all reads.`;
		pick('[data-cb-from]', root).innerHTML = `<span class="cb-from-bar" aria-hidden="true">${shares
			.map(
				(s, i) =>
					`<span class="cb-from-part" style="--cb-w: ${s.share.toFixed(1)}%; --cb-tone: var(--basalt-series-${[1, 5, 2, 7][i]})"></span>`,
			)
			.join('')}</span><ul class="cb-from-key">${shares
			.map(
				(s, i) =>
					`<li style="--cb-tone: var(--basalt-series-${[1, 5, 2, 7][i]})"><span class="cb-from-dot" aria-hidden="true"></span>${s.name}<strong>${Math.round(s.share)}%</strong></li>`,
			)
			.join('')}</ul>`;
		pick('[data-cb-who]', root).innerHTML = BLOG.readers.roles
			.map(
				(r) =>
					`<li><span class="cb-who-role">${htmlSafe(r.role)}</span><span class="cb-who-bar" aria-hidden="true"><span style="--cb-w: ${r.share}%"></span></span><strong>${r.share}%</strong></li>`,
			)
			.join('');
	}

	root.addEventListener('click', (e) => {
		const start = e.target.closest('[data-cb-idea-new]');
		if (start) openNew(start.getAttribute('data-cb-idea-new'));
		const topic = e.target.closest('[data-cb-idea-topic]');
		if (!topic) return;
		setSelect(el.category, topic.getAttribute('data-cb-idea-topic'));
		el.category.dispatchEvent(new Event('change'));
		pick('[data-cb-list]', root).scrollIntoView({ behavior: 'smooth', block: 'start' });
	});

	/* All posts */
	function filtered() {
		const q = state.q.trim();
		const list = POSTS.filter((p) => {
			if (state.tab !== 'all' && p.status !== state.tab) return false;
			if (state.category !== 'all' && p.category !== state.category) return false;
			if (
				q &&
				!window.Basalt.matchesQuery(
					[
						p.title,
						p.summary,
						p.author,
						p.category,
						(p.tags || []).join(' '),
						p.customer ? p.customer[0] : '',
					].join(' '),
					q,
				)
			)
				return false;
			return true;
		});
		if (state.sort === 'views')
			list.sort((a, b) => (b.views || 0) - (a.views || 0) || when(b).localeCompare(when(a)));
		else if (state.sort === 'oldest') list.sort((a, b) => when(a).localeCompare(when(b)));
		else list.sort((a, b) => when(b).localeCompare(when(a)));
		return list;
	}

	function row(p) {
		const c = cat(p.category);
		const d = dateCell(p);
		return `<tr class="cb-row" data-cb-id="${p.id}"><td class="cb-col-post"><div class="cb-post cb-tone-${c.tone}">${thumb(p)}<div class="cb-post-text">${titleLink(p, 'cb-post-title')}<p class="cb-meta"><span class="cb-dot" aria-hidden="true"></span>${htmlSafe(p.category)} &middot; ${p.read} min read</p></div></div></td><td class="cb-col-author"><span class="cb-author">${avatar(p.author)}<span>${htmlSafe(p.author)}</span></span></td><td class="cb-col-status" data-cb-facts="${htmlSafe([p.author, shortDate(p), p.status === 'published' ? `${num(p.views)} views` : ''].filter(Boolean).join(' · '))}">${pill(p.status)}</td><td class="cb-col-date"><span class="cb-date-main">${d.main}</span>${d.note ? `<span class="cb-meta">${d.note}</span>` : ''}</td><td class="cb-col-views text-end">${p.status === 'published' ? `<span class="cb-views">${num(p.views)}</span>` : '<span class="cb-meta" title="Not live yet">&ndash;</span>'}</td><td class="cb-col-act">${rowActions(p)}</td></tr>`;
	}

	function paintList() {
		const list = filtered();
		const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
		state.page = Math.min(state.page, pages);
		const from = (state.page - 1) * PER_PAGE;
		const shown = list.slice(from, from + PER_PAGE);

		el.rows.innerHTML = shown.map(row).join('');
		el.table.hidden = !shown.length;
		el.empty.hidden = !!shown.length;
		if (!shown.length) {
			const q = state.q.trim();
			const tabName = {
				all: 'posts',
				published: 'published posts',
				scheduled: 'scheduled posts',
				review: 'posts in review',
				draft: 'drafts',
			}[state.tab];
			el.empty.innerHTML = q
				? window.Basalt.emptyState({
						query: q,
						noun: tabName,
						text: state.category !== 'all' ? 'Check the spelling, or look in every category.' : '',
					})
				: window.Basalt.emptyState({
						icon: 'journal',
						title: `No ${tabName}${state.category !== 'all' ? ` in ${htmlSafe(state.category)}` : ''}`,
						text:
							state.category !== 'all'
								? 'Pick another category, or look at every status.'
								: 'New posts show here as soon as they are saved.',
					});
		}

		el.pager.hidden = list.length <= PER_PAGE;
		el.range.innerHTML = list.length
			? `<strong>${from + 1}&ndash;${from + shown.length}</strong> of ${plural(list.length, 'post')}`
			: '';
		if (window.Basalt.pagination) {
			if (!pagerCtl)
				pagerCtl = window.Basalt.pagination(el.pages, {
					total: pages,
					current: state.page,
					label: 'Posts page',
					onChange(p) {
						state.page = p;
						paintList();
					},
				});
			else {
				pagerCtl.setTotal(pages);
				if (pagerCtl.get() !== state.page) pagerCtl.set(state.page);
			}
		}
		if (window.Basalt.avatars) window.Basalt.avatars(el.rows);
		if (window.Basalt.tips) window.Basalt.tips(el.rows);
	}

	function paintEverything() {
		renderCounts();
		renderUp();
		paintList();
		renderRead();
		renderTalk();
		renderInsights();
		if (state.open && nodeById(state.open)) fillDrawer(nodeById(state.open));
	}

	/* Quick view of one post, in the drawer */
	function D(k) {
		return pick(`[data-cb-d="${k}"]`, el.drawer);
	}

	function drawer() {
		return bootstrap.Offcanvas.getOrCreateInstance(el.drawer);
	}

	const MOVE = {
		published: { label: 'Unpublish', to: 'draft' },
		scheduled: { label: 'Publish now', to: 'published' },
		review: { label: 'Approve', to: 'scheduled' },
		draft: { label: 'Publish now', to: 'published' },
	};

	function statusLine(p) {
		if (p.status === 'published')
			return `Live since ${fmtLong(p.date)}${sameYear(p.date) ? '' : ` ${p.date.slice(0, 4)}`}. ${p.read} min read.`;
		if (p.status === 'scheduled') return `Goes live on ${fmtLong(p.date)} at ${clockText(p.time)}.`;
		if (p.status === 'review')
			return `${htmlSafe(p.reviewer || 'An editor')} has been reviewing it since ${fmtLong(p.edited)}.${p.date ? ` Planned for ${fmtLong(p.date)}.` : ''}`;
		return `Last edited on ${fmtLong(p.edited)}. It has no date yet.`;
	}

	function sourcesBlock(p) {
		const counts = p.sources.map((s) => Math.round((p.views * s) / 100));
		counts[counts.length - 1] = p.views - counts.slice(0, -1).reduce((a, b) => a + b, 0);
		/* Each source keeps its own chart color on every post. */
		const rows = SOURCES.map((name, i) => ({ name, n: counts[i], tone: i + 1 })).sort((a, b) => b.n - a.n);
		const max = rows[0].n || 1;
		return `<section class="cb-sec" aria-labelledby="cb-sec-readers"><h3 class="cb-sec-title" id="cb-sec-readers">Where readers came from</h3><p class="cb-sec-lead">${num(p.views)} views since it went live${p.views30 !== p.views ? `, ${num(p.views30)} of them in the last 30 days` : ''}.</p><ul class="cb-bars">${rows
			.map(
				(r) =>
					`<li class="cb-bars-row cb-src-${r.tone}"><span class="cb-bars-name">${r.name}</span><span class="cb-bars-track" aria-hidden="true"><span style="width:${Math.max(3, Math.round((r.n / max) * 100))}%"></span></span><span class="cb-bars-value">${num(r.n)}</span></li>`,
			)
			.join('')}</ul></section>`;
	}

	function commentsBlock(p) {
		if (!p.comments) return '';
		const c = p.latest;
		return `<section class="cb-sec" aria-labelledby="cb-sec-comments"><h3 class="cb-sec-title" id="cb-sec-comments">Comments</h3><p class="cb-sec-lead">${plural(p.comments, 'comment')} on this post.${c ? ' The latest:' : ''}</p>${c ? `<figure class="cb-quote">${avatar(c.who, 'basalt-avatar-sm')}<div><figcaption class="cb-quote-who">${htmlSafe(c.who)} <span class="cb-meta">${ago(c.days).toLowerCase()}</span></figcaption><blockquote class="cb-quote-text">${htmlSafe(c.text)}</blockquote></div></figure>` : ''}<a class="cb-link cb-link-quiet" href="comments.html">Open comments<i class="bi bi-arrow-right ms-1" aria-hidden="true"></i></a></section>`;
	}

	function fillDrawer(p) {
		D('title').textContent = p.title;
		D('sub').textContent = `${p.category} · by ${p.author}`;
		const facts = [
			[
				'Author',
				`<a class="cb-link" href="employee-user-details.html">${htmlSafe(p.author)}</a><span class="cb-meta">${htmlSafe(AUTHORS[p.author] || '')}</span>`,
			],
			p.customer
				? [
						'Customer',
						`<a class="cb-link" href="company-details.html?id=${encodeURIComponent(p.customer[1])}">${htmlSafe(p.customer[0])}</a>`,
					]
				: null,
			['Link', `<span class="cb-slug">/blog/${htmlSafe(p.slug || slugify(p.title))}</span>`],
			(p.tags || []).length
				? [
						'Tags',
						`<span class="cb-tags">${p.tags.map((t) => `<span class="cb-tag">${htmlSafe(t)}</span>`).join('')}</span>`,
					]
				: null,
		].filter(Boolean);
		D('body').innerHTML =
			`<figure class="cb-drawer-cover">${thumb(p, 'lg')}</figure><div class="cb-sec cb-sec-status">${pill(p.status)}<p class="cb-sec-lead">${statusLine(p)}</p></div>${p.summary ? `<p class="cb-drawer-summary">${htmlSafe(p.summary)}</p>` : ''}<dl class="cb-facts">${facts.map((f) => `<div class="cb-facts-row"><dt>${f[0]}</dt><dd>${f[1]}</dd></div>`).join('')}</dl>${p.status === 'published' && p.views && p.sources ? sourcesBlock(p) : ''}${p.status === 'published' ? commentsBlock(p) : ''}`;
		pick('[data-cb-move]', el.drawer).textContent = MOVE[p.status].label;
		pick('[data-cb-full]', el.drawer).href = postUrl(p);
		if (window.Basalt.avatars) window.Basalt.avatars(D('body'));
	}

	function openPost(id) {
		const p = nodeById(id);
		if (!p) return;
		state.open = id;
		fillDrawer(p);
		D('body').scrollTop = 0;
		drawer().show();
	}

	function movePost(p) {
		const before = {
			status: p.status,
			date: p.date,
			time: p.time,
			edited: p.edited,
			views: p.views,
			views30: p.views30,
		};
		const to = MOVE[p.status].to;
		let text;
		if (to === 'published') {
			p.date = TODAY;
			p.views = p.views || 0;
			p.views30 = p.views30 || 0;
			p.comments = p.comments || 0;
			p.sources = p.sources || [40, 30, 20, 10];
			text = 'It is live on the blog now.';
		} else if (to === 'scheduled') {
			if (!p.date || p.date < TODAY) p.date = TODAY;
			p.time = p.time || '09:00';
			text = `It goes live on ${fmtLong(p.date)} at ${clockText(p.time)}.`;
		} else {
			p.edited = TODAY;
			text = 'It is off the blog and back with the drafts.';
		}
		p.status = to;
		paintEverything();
		toast({
			tone: 'success',
			icon: to === 'draft' ? 'bi-eye-slash' : 'bi-check2-circle',
			title: `“${p.title}” ${{ published: 'published', scheduled: 'approved', draft: 'unpublished' }[to]}`,
			text,
			actions: [
				{
					label: 'Undo',
					onClick() {
						Object.assign(p, before);
						paintEverything();
					},
				},
			],
		});
	}

	function deletePost(p) {
		const at = POSTS.indexOf(p);
		if (at < 0) return;
		POSTS.splice(at, 1);
		const tip = window.bootstrap && bootstrap.Tooltip.getInstance(pick('[data-cb-delete]', el.drawer));
		if (tip) tip.hide();
		drawer().hide();
		paintEverything();
		toast({
			tone: 'success',
			icon: 'bi-trash3',
			title: 'Post deleted',
			text: `“${p.title}” is gone from the blog.`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						POSTS.splice(at, 0, p);
						paintEverything();
					},
				},
			],
		});
	}

	/* New post: a draft from a title, a category and an author */
	const form = pick('[data-cb-form]', el.dialog);
	const f = {
		title: pick('[data-cb-title]', form),
		slug: pick('[data-cb-slug]', form),
		category: pick('[data-cb-form-category]', form),
		author: pick('[data-cb-form-author]', form),
	};

	function modal() {
		return bootstrap.Modal.getOrCreateInstance(el.dialog);
	}

	function setSelect(sel, value) {
		sel.value = value;
		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(sel);
	}

	function showSlug() {
		f.slug.textContent = `It will live at /blog/${slugify(f.title.value) || 'your-title'}`;
	}

	/** @param {string} [topic] the category to start in; the first one when left out */
	function openNew(topic) {
		form.reset();
		f.title.classList.remove('is-invalid');
		setSelect(f.category, topic || CATEGORIES[0].name);
		setSelect(f.author, 'John Armstrong');
		showSlug();
		modal().show();
	}

	function createPost(e) {
		e.preventDefault();
		const title = f.title.value.trim();
		f.title.classList.toggle('is-invalid', !title);
		if (!title) {
			f.title.focus();
			return;
		}
		const p = {
			id: `p${Date.now().toString(36)}`,
			title,
			slug: slugify(title),
			summary: '',
			tags: [],
			category: f.category.value,
			author: f.author.value,
			status: 'draft',
			edited: TODAY,
			read: 1,
			views: 0,
			views30: 0,
			comments: 0,
			cover: '',
		};
		POSTS.unshift(p);
		modal().hide();
		paintEverything();
		toast({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'Draft created',
			text: 'Write the story on the post’s own page.',
			actions: [
				{
					label: 'Open post',
					onClick() {
						window.location.href = postUrl(p);
					},
				},
			],
		});
	}

	f.title.addEventListener('input', () => {
		f.title.classList.remove('is-invalid');
		showSlug();
	});
	form.addEventListener('submit', createPost);
	el.dialog.addEventListener('shown.bs.modal', () => f.title.focus());

	/* Events */
	let qTimer = 0;
	el.search.addEventListener('input', () => {
		clearTimeout(qTimer);
		qTimer = setTimeout(() => {
			state.q = el.search.value;
			state.page = 1;
			paintList();
		}, 120);
	});
	el.category.addEventListener('change', () => {
		state.category = el.category.value;
		state.page = 1;
		paintList();
	});
	el.sort.addEventListener('change', () => {
		state.sort = el.sort.value;
		state.page = 1;
		paintList();
	});

	for (const tab of pickAll('[data-cb-tab]', root)) {
		tab.addEventListener('shown.bs.tab', () => {
			state.tab = tab.getAttribute('data-cb-tab');
			state.page = 1;
			pick('#cb-list-panel').setAttribute('aria-labelledby', tab.id);
			paintList();
		});
	}

	/* A row or an Up next tile opens the post's own page, like its title
     (Cmd/Ctrl or middle click: a new tab); the panel icon a quick view. */
	function openItemPage(e) {
		const item = e.target.closest('.cb-row, .cb-tile');
		if (!item || e.target.closest('button, a, input')) return false;
		const href = postUrl(nodeById(item.getAttribute('data-cb-id')));
		if (e.metaKey || e.ctrlKey || e.button === 1) window.open(href, '_blank', 'noopener');
		else location.href = href;
		return true;
	}
	root.addEventListener('auxclick', (e) => {
		if (e.button === 1) openItemPage(e);
	});
	root.addEventListener('click', (e) => {
		const t = e.target;
		if (t.closest('[data-cb-new]')) {
			openNew();
			return;
		}
		const open = t.closest('[data-cb-open]');
		if (open) {
			openPost(open.getAttribute('data-cb-open'));
			return;
		}
		if (openItemPage(e)) return;
		const go = t.closest('[data-cb-goto]');
		if (go) {
			const tab = pick(`[data-cb-tab="${go.getAttribute('data-cb-goto')}"]`, root);
			bootstrap.Tab.getOrCreateInstance(tab).show();
			pick('[data-cb-list]', root).scrollIntoView({
				behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
				block: 'start',
			});
			tab.focus({ preventScroll: true });
		}
	});

	el.drawer.addEventListener('click', (e) => {
		const p = nodeById(state.open);
		if (!p) return;
		if (e.target.closest('[data-cb-move]')) movePost(p);
		else if (e.target.closest('[data-cb-delete]')) deletePost(p);
	});

	/* While the drawer is open its buttons sit where toasts usually stack,
     so toasts move to the top until it closes. */
	function toastsAt(where) {
		if (window.Basalt.toasts && window.Basalt.toasts.position) window.Basalt.toasts.position(where);
	}

	start();
})();
