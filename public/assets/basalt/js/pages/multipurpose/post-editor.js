/**
 * The single-post editor behind post-editor.html, reached from every row of
 * the Blog list (blog.html). The wide column holds the writing and a
 * reader's-eye preview; the narrow one holds review, scheduling, filing,
 * search appearance, notes between writer and reviewer, and the change log.
 *
 * Wiring it to real content: the `?id=` in the address picks a record from
 * assets/basalt/js/data/multipurpose/blog.js (the same list the Blog page reads), falling back
 * to p228, which the static markup already shows. Swap that lookup for a
 * request to your backend; savePost(), moveTo() and the reply form only
 * touch memory, so those are where the API calls belong.
 * Formatting relies on document.execCommand, just like the Rich Text
 * Editor demo, and the shared basalt.js pieces supply the styled selects,
 * tag input, drop zone, avatars, status pills and toasts.
 */
(() => {
	'use strict';

	const page = pick('[data-cp-root]', document);
	if (!page) return;

	/* Fixed facts of the demo: its pretend calendar day, the signed-in
     person and where the blog lives. A real app reads the actual date. */
	const DEMO_DAY = '2026-10-09';
	const VIEWER = 'John Armstrong';
	const BLOG_HOST = 'fieldline.app/blog/';
	const WEEKDAY_ABBR = 'Sun Mon Tue Wed Thu Fri Sat'.split(' ');
	const MONTH_ABBR = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
	const MAX_CHARS = { title: 60, summary: 155 };
	const STEP_NAMES = ['Draft', 'In review', 'Scheduled', 'Live'];
	const STAGES = {
		draft: { name: 'Draft', pill: '', index: 0 },
		review: { name: 'In review', pill: 'warning', index: 1 },
		scheduled: { name: 'Scheduled', pill: 'primary', index: 2 },
		published: { name: 'Published', pill: 'success', index: 3 },
	};
	const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	const onApple = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

	/* The record comes from the shared blog list; an id it does not know
     falls back to p228. Category colors and icons match the Blog list. */
	const blogData = window.Basalt.data.blog;
	const requestedId = new URLSearchParams(window.location.search).get('id');
	const record =
		blogData.posts.find((entry) => entry.id === requestedId) || blogData.posts.find((entry) => entry.id === 'p228');
	const categoryLook = Object.fromEntries(blogData.categories.map((group) => [group.name, group]));
	const authorRoles = blogData.authors;

	/* Live workflow state. Without a named reviewer, the administrator
     reviews, unless the administrator wrote it, in which case Paige does. */
	const post = {
		status: record.status,
		writer: record.author,
		reviewer: record.reviewer || (record.author === VIEWER ? 'Paige Drake' : VIEWER),
		sentOn: record.edited,
		liveSince: record.status === 'published' ? record.date : null,
		savedLabel: `Saved on ${dayName(record.edited || record.date)}`,
		returnedBecause: null,
	};

	/* What the writer says when handing a post over, per category, for
     records that carry no notes of their own. */
	const HANDOFF_LINES = {
		'Field Tips': 'Ready for you. I kept it to what an office can try this week.',
		'Product Updates': 'Ready for you. The screens match the current release.',
		'Customer Stories': `Ready for you. ${record.customer ? `${record.customer[0]} has read it and is happy with the quotes.` : 'The quotes are checked.'}`,
		Engineering: 'Ready for you. The numbers are checked with the team.',
		Company: 'Ready for you. Short on purpose.',
	};
	const notes = seedNotes();
	const events = seedHistory();

	/* The page's moving parts, looked up once. */
	const fields = Object.fromEntries(pickAll('[data-cp-f]').map((node) => [node.getAttribute('data-cp-f'), node]));
	const story = pick('[data-cp-body]');
	const tagField = pick('[data-cp-tags]');
	const coverPhoto = pick('[data-cp-cover-img]');
	const photoFrame = pick('[data-cp-cover-frame]');
	const dropArea = pick('[data-cp-cover-drop]');
	const altRow = pick('[data-cp-alt-field]');
	const saveState = pick('[data-cp-saved]');
	const saveStateText = pick('[data-cp-saved-text]');
	const editorShell = pick('[data-cp-editor]');
	const tools = pick('.cp-toolbar', editorShell);
	const linkToggle = pick('[data-cp-link]', tools);
	const linkPanel = pick('[data-cp-linkform]', editorShell);
	const linkInput = pick('input', linkPanel);
	const linkMessage = pick('.cp-error', linkPanel);
	const expandToggle = pick('[data-cp-full]', tools);
	const askDialog = document.getElementById('cp-changes');

	/* Pasted or generated markup keeps only what a blog post uses; some
     tags go with their content, a few are renamed to the nearest kept one. */
	const ALLOWED_TAGS = new Set([
		'P',
		'H3',
		'H4',
		'STRONG',
		'B',
		'EM',
		'I',
		'UL',
		'OL',
		'LI',
		'BLOCKQUOTE',
		'A',
		'BR',
	]);
	const STRIPPED_TAGS = new Set([
		'SCRIPT',
		'STYLE',
		'IFRAME',
		'OBJECT',
		'EMBED',
		'LINK',
		'META',
		'TEMPLATE',
		'SVG',
		'svg',
		'IMG',
		'VIDEO',
		'AUDIO',
		'FORM',
		'INPUT',
		'BUTTON',
		'TEXTAREA',
		'SELECT',
	]);
	const RENAMED_TAGS = new Map([
		['H1', 'h3'],
		['H2', 'h3'],
		['DIV', 'p'],
		['H5', 'p'],
		['H6', 'p'],
	]);

	const SIDE_STORE = 'basalt-cp-side';

	let coverUrl = '';
	let savedPrint = '';
	let savedRange = null;
	let slugEdited = false;
	let deleting = false;

	start();

	/**
	 * Fills the form from the record, wires every control, then paints the
	 * page once and records what "saved" looks like.
	 */
	function start() {
		loadPost();
		coverUrl = coverPhoto.getAttribute('src');
		wireReview();
		wireNotes();
		wireCover();
		wireViews();
		wireEditor();
		wireLinkPanel();
		wireExpand();
		wireSidePanel();
		wireFields();

		story.innerHTML = sanitize(story.innerHTML);
		growSummary();
		drawNotes();
		drawHistory();
		applyCategoryTone();
		/* The styled selects and the tag input build themselves on load, so
       the saved state is taken now and again once they are in place. */
		savedPrint = fingerprint();
		refresh();
		drawTrail(pick('[data-cp-steps]'));
		window.addEventListener('load', () => {
			savedPrint = fingerprint();
			paintSaveState();
		});
	}

	/* Lookups and small formatters. */

	function pick(selector, scope = page) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = page) {
		return [...scope.querySelectorAll(selector)];
	}

	function slot(name) {
		return pick(`[data-cp-out="${name}"]`, document);
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (mark) => HTML_ENTITIES[mark]);
	}

	function givenName(wholeName) {
		return String(wholeName).split(' ')[0];
	}

	function bold(name) {
		return `<strong>${htmlSafe(name)}</strong>`;
	}

	function avatarMarkup(name) {
		return `<span data-basalt-avatar data-name="${htmlSafe(name)}" aria-hidden="true" class="basalt-avatar basalt-avatar-sm"></span>`;
	}

	function notify(options) {
		return window.Basalt.toasts?.push(options) ?? null;
	}

	/** "Fri, Oct 9" for an ISO day. */
	function dayName(isoDay) {
		const day = window.Basalt.toLocalDay(isoDay);
		return `${WEEKDAY_ABBR[day.getDay()]}, ${MONTH_ABBR[day.getMonth()]} ${day.getDate()}`;
	}

	/** "4:10 pm" for "16:10"; a missing time reads as 9 in the morning. */
	function clockLabel(hoursMinutes) {
		const [hours, minutes] = String(hoursMinutes || '09:00')
			.split(':')
			.map(Number);
		const suffix = hours < 12 ? 'am' : 'pm';
		return `${hours % 12 || 12}:${String(minutes || 0).padStart(2, '0')} ${suffix}`;
	}

	function when(isoDay, hoursMinutes) {
		return `${dayName(isoDay)}, ${clockLabel(hoursMinutes)}`;
	}

	function timeNow() {
		const now = new Date();
		return clockLabel(`${now.getHours()}:${now.getMinutes()}`);
	}

	function stampNow() {
		return `Today, ${timeNow()}`;
	}

	/** The ISO day a number of days away from another one. */
	function moveDays(isoDay, offset) {
		const day = window.Basalt.toLocalDay(isoDay);
		day.setDate(day.getDate() + offset);
		const pad = (part) => String(part).padStart(2, '0');
		return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
	}

	/** Lowercase, accent-free, dash-joined and at most 70 characters. */
	function toSlug(text) {
		return String(text || '')
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/['’`"]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 70);
	}

	function clip(text, limit) {
		if (text.length <= limit) return text;
		return `${text.slice(0, limit - 1).trimEnd()}…`;
	}

	/* Seed notes and history, used when the record brings none. */

	/** The notes a post at this stage would have collected so far. */
	function seedNotes() {
		if (record.notes) return record.notes.map((note) => ({ ...note }));
		if (post.status === 'draft') return [];

		const liveNow = record.status === 'published';
		const handedOver =
			post.status === 'review' ? record.edited : moveDays(liveNow ? record.date : record.edited, -3);
		const seeded = [{ who: post.writer, when: when(handedOver, '16:10'), text: HANDOFF_LINES[record.category] }];
		if (post.status === 'review') return seeded;

		const approvedOn = post.status === 'published' ? moveDays(record.date, -2) : record.edited;
		seeded.push({
			who: post.reviewer,
			when: when(approvedOn, '10:25'),
			text:
				post.status === 'published'
					? 'Approved. Thanks, this one reads well.'
					: `Approved for ${dayName(record.date)}. Nice and clear.`,
		});
		return seeded;
	}

	/** The change log, newest first; `tone` picks the icon's chart color. */
	function seedHistory() {
		if (record.history) return record.history.map((item) => ({ ...item }));

		const author = bold(post.writer);
		const checker = bold(post.reviewer);
		const entry = (icon, tone, html, isoDay, hoursMinutes) => ({
			icon,
			tone,
			html,
			when: when(isoDay, hoursMinutes),
		});
		const edited = record.edited;

		if (post.status === 'draft') {
			return [
				entry('pencil', 1, `${author} edited the draft`, edited, '15:40'),
				entry('image', 5, `${author} picked the cover photo`, moveDays(edited, -2), '11:05'),
				entry('file-earmark-plus', 3, `${author} started the draft`, moveDays(edited, -6), '09:30'),
			];
		}
		if (post.status === 'review') {
			return [
				entry('send', 2, `${author} sent it to ${checker} for review`, edited, '16:05'),
				entry(
					'calendar-event',
					4,
					`${author} planned it for ${htmlSafe(dayName(record.date))}`,
					moveDays(edited, -1),
					'14:15',
				),
				entry('image', 5, `${author} picked the cover photo`, moveDays(edited, -4), '11:20'),
				entry('file-earmark-plus', 3, `${author} started the draft`, moveDays(edited, -9), '09:30'),
			];
		}

		const approvedOn = post.status === 'published' ? moveDays(record.date, -2) : edited;
		const trail = [
			entry(
				'check2-circle',
				2,
				`${checker} approved it for ${htmlSafe(dayName(record.date))}`,
				approvedOn,
				'10:30',
			),
			entry('send', 2, `${author} sent it to ${checker} for review`, moveDays(approvedOn, -1), '16:10'),
			entry('image', 5, `${author} picked the cover photo`, moveDays(approvedOn, -4), '11:20'),
			entry('file-earmark-plus', 3, `${author} started the draft`, moveDays(approvedOn, -10), '09:30'),
		];
		if (post.status === 'published')
			trail.unshift(entry('broadcast', 4, 'It went live on the blog', record.date, record.time));
		return trail;
	}

	/* Loading the record into the form. */

	/** Writes the record into the fields before basalt.js enhances them. */
	function loadPost() {
		fields.title.value = record.title;
		fields.summary.value = record.summary;
		fields.slug.value = toSlug(record.title);
		fields.alt.value = record.alt || '';
		fields.date.value = record.date || '';
		fields.time.value = record.time || '09:00';
		if (post.status === 'published') fields.date.removeAttribute('min');
		else fields.date.min = DEMO_DAY;
		fields.category.value = record.category;
		fields.author.value = record.author;
		fields.feature.checked = record.id === 'p224';
		fields.newsletter.checked = post.status !== 'draft';

		const typing = pick('.basalt-tags-input', tagField);
		for (const stale of pickAll('.basalt-tags-tag', tagField)) stale.remove();
		for (const word of record.tags || []) {
			const chip = document.createElement('span');
			chip.className = 'basalt-tags-tag';
			chip.setAttribute('data-value', word);
			chip.textContent = word;
			tagField.insertBefore(chip, typing);
		}

		coverPhoto.src = window.Basalt.photo(record.cover, 1200, 520);
		story.innerHTML = record.body;

		const customerRow = pick('[data-cp-customer]');
		customerRow.hidden = !record.customer;
		if (record.customer) {
			const [customerName, customerId] = record.customer;
			const customerLink = pick('a', customerRow);
			customerLink.href = `company-details.html?id=${encodeURIComponent(customerId)}`;
			customerLink.textContent = customerName;
		}

		/* Notes go to the other person on the post; changes go to the writer. */
		const counterpart = givenName(post.writer === VIEWER ? post.reviewer : post.writer);
		for (const label of pickAll('[data-cp-out="partner"]', document)) label.textContent = counterpart;
		for (const label of pickAll('[data-cp-out="writer"]', document)) label.textContent = givenName(post.writer);
		pick('[data-cp-note]').placeholder = `Write a note to ${counterpart}`;
	}

	function currentTags() {
		if (tagField.basaltTags) return tagField.basaltTags.get();
		return pickAll('.basalt-tags-tag', tagField).map((chip) => chip.getAttribute('data-value'));
	}

	function wordTotal() {
		const text = (story.innerText || '').trim();
		return text ? text.split(/\s+/).length : 0;
	}

	function minutesToRead() {
		return Math.max(1, Math.round(wordTotal() / 200));
	}

	/* Saving and the unsaved-changes marker. */

	/** Everything a save would keep, as one comparable string. */
	function fingerprint() {
		return JSON.stringify({
			title: fields.title.value,
			summary: fields.summary.value,
			alt: fields.alt.value,
			slug: fields.slug.value,
			date: fields.date.value,
			time: fields.time.value,
			feature: fields.feature.checked,
			newsletter: fields.newsletter.checked,
			category: fields.category.value,
			author: fields.author.value,
			tags: currentTags(),
			cover: coverUrl,
			body: story.innerHTML,
		});
	}

	function hasEdits() {
		return fingerprint() !== savedPrint;
	}

	function paintSaveState() {
		const edited = hasEdits();
		saveState.classList.toggle('is-dirty', edited);
		saveStateText.textContent = edited ? 'Unsaved changes' : post.savedLabel;
	}

	/**
	 * Keeps the current fields. A missing title stops the save and sends the
	 * cursor there; `silent` skips the toasts when another action saves first.
	 * @returns {boolean} whether the post is now saved
	 */
	function savePost(silent) {
		if (!fields.title.value.trim()) {
			fields.title.classList.add('is-invalid');
			switchView('write');
			fields.title.focus();
			return false;
		}
		if (!hasEdits()) {
			if (!silent)
				notify({
					tone: 'info',
					icon: 'bi-check2',
					title: 'Nothing to save',
					text: 'Every change is already saved.',
				});
			return true;
		}

		story.innerHTML = sanitize(story.innerHTML);
		savedPrint = fingerprint();
		post.savedLabel = `Saved at ${timeNow()}`;
		logEvent({ icon: 'pencil', tone: 1, html: `${bold(VIEWER)} edited the post` });
		paintSaveState();
		if (!silent) {
			const reach =
				post.writer === VIEWER
					? 'Everyone on the post sees them now.'
					: `${givenName(post.writer)} sees them next time the post is opened.`;
			notify({ tone: 'success', icon: 'bi-check2-circle', title: 'Changes saved', text: reach });
		}
		return true;
	}

	/* Redrawing whatever depends on the fields. */

	/** Redraws every part that reads from the fields. */
	function refresh() {
		drawHeader();
		drawCounters();
		drawSearchPreview();
		drawReview();
		paintSaveState();
	}

	/** As refresh(), plus the category color and an open preview. */
	function refreshEverything() {
		applyCategoryTone();
		refresh();
		if (!pick('[data-cp-view="preview"]').hidden) drawReader();
	}

	/** One line on when the post goes, or went, live. */
	function scheduleLine() {
		if (post.status === 'published') return `Live since ${dayName(post.liveSince || DEMO_DAY)}`;
		const planned = fields.date.value ? `${dayName(fields.date.value)}, ${clockLabel(fields.time.value)}` : '';
		if (post.status === 'scheduled') return planned ? `Goes live ${planned}` : 'No date yet';
		return planned ? `Planned for ${planned}` : 'Not planned yet';
	}

	function drawHeader() {
		const heading = fields.title.value.trim() || 'Untitled post';
		const stage = STAGES[post.status];
		const pillTone = stage.pill ? ` basalt-status-${stage.pill}` : '';
		slot('title').textContent = heading;
		slot('delete-title').textContent = heading;
		document.title = `${heading} · Basalt`;
		slot('sub').textContent = `${fields.category.value} · by ${fields.author.value} · ${minutesToRead()} min read`;
		slot('tags').innerHTML =
			`<span class="basalt-status basalt-status-dot${pillTone}">${stage.name}</span><span class="cp-tags-when">${htmlSafe(scheduleLine())}</span>`;
	}

	function drawCounters() {
		for (const key of ['title', 'summary']) {
			const length = fields[key].value.length;
			const counter = pick(`[data-cp-count="${key}"]`);
			counter.textContent = `${length} / ${MAX_CHARS[key]}`;
			counter.classList.toggle('is-over', length > MAX_CHARS[key]);
		}
		const total = wordTotal();
		pick('[data-cp-words]').textContent = `${total} ${total === 1 ? 'word' : 'words'}`;
		pick('[data-cp-read]').textContent = `${minutesToRead()} min read`;
	}

	function drawSearchPreview() {
		const heading = fields.title.value.trim();
		const summary = fields.summary.value.trim();
		slot('url').textContent = BLOG_HOST + (fields.slug.value || toSlug(fields.title.value) || 'your-title');
		slot('serp-title').textContent = clip(`${heading || 'Untitled post'} | Fieldline`, 64);
		slot('serp-text').textContent = summary
			? clip(summary, 160)
			: 'Write a summary and it shows here, under the link.';
	}

	/** Recolors every tinted part and the cover fallback icon to the category. */
	function applyCategoryTone() {
		const look = categoryLook[fields.category.value];
		const tone = look?.tone || 1;
		for (const tinted of pickAll('[data-cp-tone]', document)) {
			tinted.className = `${tinted.className.replace(/\bcp-tone-\d\b/g, '').trim()} cp-tone-${tone}`;
		}
		pick('.cp-cover-fallback i').className = `bi ${look?.icon || 'bi-tools'}`;
	}

	/* The review card: progress steps, readiness checks and the decision. */

	/** What still stands between the post and going live. */
	function readinessList() {
		const heading = fields.title.value.trim();
		const summary = fields.summary.value.trim();
		const described = fields.alt.value.trim().length > 0;
		const liveNow = post.status === 'published';
		const ahead = fields.date.value && fields.date.value >= DEMO_DAY;

		let coverDetail = 'Add a cover description';
		if (!coverUrl) coverDetail = 'No cover photo';
		else if (described) coverDetail = 'Read out by screen readers';

		let dateDetail = 'Pick a date';
		if (ahead || liveNow) dateDetail = scheduleLine();
		else if (fields.date.value) dateDetail = 'The date has passed';

		return [
			{
				title: 'Title fits in search results',
				passed: heading.length > 0 && heading.length <= MAX_CHARS.title,
				detail: heading ? `${heading.length} of ${MAX_CHARS.title} characters` : 'No title yet',
				target: fields.title,
			},
			{
				title: 'Summary written',
				passed: summary.length >= 50 && summary.length <= MAX_CHARS.summary,
				detail:
					summary.length < 50
						? 'At least 50 characters'
						: `${summary.length} of ${MAX_CHARS.summary} characters`,
				target: fields.summary,
			},
			{
				title: 'Cover photo described',
				passed: !!coverUrl && described,
				detail: coverDetail,
				target: coverUrl ? fields.alt : pick('[data-basalt-drop-browse]', dropArea),
			},
			{ title: 'Go-live date set', passed: liveNow || !!ahead, detail: dateDetail, target: fields.date },
		];
	}

	/**
	 * Grows the green lines behind finished steps the first time the steps
	 * are on screen. Later repaints show them already drawn.
	 */
	function drawTrail(trail) {
		const lines = pickAll('.cp-step.is-done + .cp-step', trail);
		if (!lines.length || !window.IntersectionObserver || matchMedia('(prefers-reduced-motion: reduce)').matches)
			return;
		lines.forEach((line, at) => line.style.setProperty('--cp-trail-at', at));
		let left = lines.length;
		trail.classList.add('is-waiting');
		trail.addEventListener('animationend', function done(event) {
			if (event.animationName !== 'cp-trail-grow' || --left) return;
			trail.classList.remove('is-drawing');
			trail.removeEventListener('animationend', done);
		});
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				trail.classList.replace('is-waiting', 'is-drawing');
			},
			{ threshold: 0.5 },
		);
		watch.observe(trail);
	}

	function drawReview() {
		const liveNow = post.status === 'published';
		const current = STAGES[post.status].index;
		const tick = '<i class="bi bi-check-lg" aria-hidden="true"></i>';

		pick('[data-cp-steps]').innerHTML = STEP_NAMES.map((stepName, position) => {
			const phase = position < current ? 'done' : position === current ? 'now' : 'later';
			const look = {
				done: { extra: ' is-done', mark: tick, spoken: 'done' },
				now: {
					extra: ` is-now${liveNow ? ' is-live' : ''}`,
					mark: liveNow ? tick : String(position + 1),
					spoken: 'current step',
				},
				later: { extra: '', mark: String(position + 1), spoken: 'not yet' },
			}[phase];
			const currentFlag = phase === 'now' ? ' aria-current="step"' : '';
			return `<li class="cp-step${look.extra}"${currentFlag}><span class="cp-step-mark">${look.mark}</span>${stepName}<span class="visually-hidden">, ${look.spoken}</span></li>`;
		}).join('');

		pick('[data-cp-checks]').innerHTML = readinessList()
			.map(({ title, passed, detail }) => {
				const icon = passed ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill';
				return `<li class="cp-check ${passed ? 'is-ok' : 'is-todo'}"><i class="bi ${icon}" aria-hidden="true"></i><span>${title}<span class="visually-hidden">: ${passed ? 'done' : 'to do'}.</span><span class="cp-check-note">${htmlSafe(detail)}</span></span></li>`;
			})
			.join('');

		slot('review-desc').textContent = reviewSummary();
		pick('[data-cp-review-actions]').innerHTML = reviewButtons(post.status);
		slot('when-desc').textContent = publishingNote();
		flagPastDate();
	}

	function reviewSummary() {
		const writer = givenName(post.writer);
		if (post.status === 'review') {
			return post.reviewer === VIEWER
				? `Sent to you by ${writer} on ${dayName(post.sentOn)}.`
				: `With ${givenName(post.reviewer)} for review since ${dayName(post.sentOn)}.`;
		}
		if (post.status === 'scheduled') return `Approved. ${scheduleLine()}.`;
		if (post.status === 'published') return 'Live on the blog. Saved edits go live.';
		if (post.returnedBecause === 'changes') return `Back with ${writer} for changes.`;
		if (post.returnedBecause === 'unpublished') return 'Off the blog and back with the drafts.';
		return post.writer === VIEWER
			? 'Your draft. Move it to review when it is ready.'
			: `${writer} is still writing it.`;
	}

	/** The decision buttons offered at each stage. */
	function reviewButtons(status) {
		const plain = 'type="button" class="btn btn-outline-secondary"';
		const main = 'type="button" class="btn btn-primary"';
		const icon = (name) => `<i class="bi bi-${name} me-1" aria-hidden="true"></i>`;
		return {
			draft: `<button data-cp-do="review" ${plain}>Move to review</button>`,
			review: `<button data-cp-do="approve" ${main}>${icon('check2-circle')}Approve</button><button data-bs-toggle="modal" data-bs-target="#cp-changes" ${plain}>Ask for changes</button>`,
			scheduled: `<button data-cp-do="publish" ${main}>${icon('send')}Publish now</button><button data-cp-do="review" ${plain}>Back to review</button>`,
			published: `<button data-cp-do="unpublish" ${plain}>${icon('eye-slash')}Unpublish</button>`,
		}[status];
	}

	function publishingNote() {
		if (post.status === 'review') return 'It goes live at this time once you approve it.';
		if (post.status === 'scheduled') return 'It goes live at this time on its own.';
		if (post.status === 'published') return `It went live on ${dayName(post.liveSince || DEMO_DAY)}.`;
		if (!fields.date.value) return 'Pick a date once it is ready for review.';
		const whoEdits = post.writer === VIEWER ? 'you edit' : `${givenName(post.writer)} edits`;
		return `The date stays in place while ${whoEdits}.`;
	}

	/** A past go-live day is an error until the post is already live. */
	function flagPastDate() {
		const message = pick('[data-cp-date-error]');
		const past = post.status !== 'published' && fields.date.value && fields.date.value < DEMO_DAY;
		message.textContent = past ? 'Pick today or a later date.' : '';
		message.hidden = !past;
		fields.date.classList.toggle('is-invalid', !!past);
		fields.date.setAttribute('aria-invalid', past ? 'true' : 'false');
	}

	/**
	 * Moves the post to another stage, logs it and offers an undo.
	 * @param {string} stage one of the STAGES keys
	 * @param {{event: object, toast: object, reason?: string}} change
	 *   the history entry, the toast's icon, title and text, and for a draft
	 *   why it came back
	 */
	function moveTo(stage, change) {
		const previous = { status: post.status, liveSince: post.liveSince, returnedBecause: post.returnedBecause };
		post.status = stage;
		post.returnedBecause = stage === 'draft' ? change.reason : null;
		if (stage === 'published') post.liveSince = DEMO_DAY;
		const logged = logEvent(change.event);
		refreshEverything();
		notify({
			...change.toast,
			tone: 'success',
			actions: [
				{
					label: 'Undo',
					onClick() {
						Object.assign(post, previous);
						unlogEvent(logged);
						refreshEverything();
					},
				},
			],
		});
	}

	function tryApprove() {
		const open = readinessList().filter((item) => !item.passed);
		if (open.length) {
			notify({
				tone: 'warning',
				icon: 'bi-exclamation-circle',
				title: 'Not ready yet',
				text: `${open.map((item) => item.title).join(', ')} still to do.`,
			});
			switchView('write');
			open[0].target?.focus();
			return;
		}
		savePost(true);
		const goLive = dayName(fields.date.value);
		moveTo('scheduled', {
			event: { icon: 'check2-circle', tone: 2, html: `${bold(VIEWER)} approved it for ${htmlSafe(goLive)}` },
			toast: {
				icon: 'bi-check2-circle',
				title: 'Approved',
				text: `It goes live on ${goLive} at ${clockLabel(fields.time.value)}.`,
			},
		});
	}

	function wireReview() {
		const moves = {
			approve: tryApprove,
			publish() {
				savePost(true);
				moveTo('published', {
					event: { icon: 'broadcast', tone: 4, html: `${bold(VIEWER)} published it` },
					toast: { icon: 'bi-broadcast', title: 'Published', text: 'It is live on the blog now.' },
				});
			},
			unpublish() {
				moveTo('draft', {
					reason: 'unpublished',
					event: { icon: 'eye-slash', tone: 3, html: `${bold(VIEWER)} took it off the blog` },
					toast: {
						icon: 'bi-eye-slash',
						title: 'Unpublished',
						text: 'It is off the blog and back with the drafts.',
					},
				});
			},
			review() {
				moveTo('review', {
					event: { icon: 'arrow-counterclockwise', tone: 2, html: `${bold(VIEWER)} moved it back to review` },
					toast: {
						icon: 'bi-arrow-counterclockwise',
						title: 'Back in review',
						text: 'It waits for approval again.',
					},
				});
			},
		};
		pick('[data-cp-review]').addEventListener('click', (event) => {
			const verb = event.target.closest('[data-cp-do]')?.getAttribute('data-cp-do');
			if (verb && Object.hasOwn(moves, verb)) moves[verb]();
		});

		/* Asking for changes returns the post to its writer as a draft, with
       the reviewer's note attached. */
		const askForm = pick('[data-cp-changes-form]', askDialog);
		const askNote = pick('[data-cp-changes-note]', askDialog);
		askDialog.addEventListener('show.bs.modal', () => {
			askForm.reset();
			askNote.classList.remove('is-invalid');
		});
		askDialog.addEventListener('shown.bs.modal', () => askNote.focus());
		askNote.addEventListener('input', () => askNote.classList.remove('is-invalid'));
		askForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const request = askNote.value.trim();
			askNote.classList.toggle('is-invalid', !request);
			if (!request) {
				askNote.focus();
				return;
			}
			bootstrap.Modal.getOrCreateInstance(askDialog).hide();
			notes.push({ who: VIEWER, when: stampNow(), text: request, ask: true });
			const writer = givenName(post.writer);
			moveTo('draft', {
				reason: 'changes',
				event: {
					icon: 'arrow-return-left',
					tone: 3,
					html: `${bold(VIEWER)} asked ${htmlSafe(writer)} for changes`,
				},
				toast: {
					icon: 'bi-arrow-return-left',
					title: `Sent back to ${writer}`,
					text: 'Your note is with the post.',
				},
			});
			drawNotes();
		});
	}

	/* Notes between writer and reviewer, and the change log. */

	function drawNotes() {
		const list = pick('[data-cp-notes]');
		const flag =
			'<span class="cp-note-flag"><i class="bi bi-arrow-return-left" aria-hidden="true"></i>Asked for changes</span>';
		list.innerHTML = notes.length
			? notes
					.map(
						({ who, when: posted, text, ask }) =>
							`<li class="cp-note${ask ? ' is-ask' : ''}">${avatarMarkup(who)}<div><p class="cp-note-who"><span class="cp-note-name">${htmlSafe(who)}</span><span class="cp-note-when">${htmlSafe(posted)}</span>${ask ? flag : ''}</p><p class="cp-note-text">${htmlSafe(text)}</p></div></li>`,
					)
					.join('')
			: `<li class="cp-notes-none">${window.Basalt.emptyState({ icon: 'chat-left-text', title: 'No notes yet', text: 'Notes from the review show here.' })}</li>`;
		window.Basalt.avatars?.(list);
	}

	function wireNotes() {
		const replyForm = pick('[data-cp-note-form]');
		const replyBox = pick('[data-cp-note]');
		pick('[data-cp-kbd-hint]').textContent = `${onApple ? '⌘' : 'Ctrl'} + Enter sends`;

		replyForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const text = replyBox.value.trim();
			if (!text) {
				replyBox.focus();
				return;
			}
			notes.push({ who: VIEWER, when: stampNow(), text });
			replyBox.value = '';
			drawNotes();
			notify({
				tone: 'success',
				icon: 'bi-chat-left-text',
				title: 'Note added',
				text: `${givenName(post.writer)} gets an email with it.`,
			});
		});
		replyBox.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
			event.preventDefault();
			replyForm.requestSubmit();
		});
	}

	/** Adds an entry, stamped now, to the top of the log. */
	function logEvent(details) {
		const logged = { when: stampNow(), ...details };
		events.unshift(logged);
		drawHistory();
		return logged;
	}

	function unlogEvent(logged) {
		const position = events.indexOf(logged);
		if (position >= 0) events.splice(position, 1);
		drawHistory();
	}

	function drawHistory() {
		pick('[data-cp-history]').innerHTML = events
			.slice(0, 6)
			.map(
				({ icon, tone, html, when: stamped }) =>
					`<li class="cp-event cp-ev-${tone}"><span class="cp-event-icon" aria-hidden="true"><i class="bi bi-${icon}"></i></span><div><p class="cp-event-text">${html}</p><p class="cp-event-when">${htmlSafe(stamped)}</p></div></li>`,
			)
			.join('');
	}

	/* The cover photo: replace, remove, or drop a new one in. */

	/** Shows a photo (or the drop zone when `url` is empty). */
	function showCover(url) {
		coverUrl = url || '';
		const hasPhoto = coverUrl !== '';
		photoFrame.hidden = !hasPhoto;
		dropArea.hidden = hasPhoto;
		altRow.hidden = !hasPhoto;
		if (hasPhoto) {
			if (!coverPhoto.isConnected) pick('.cp-cover-fallback', photoFrame).after(coverPhoto);
			coverPhoto.src = coverUrl;
		}
		refresh();
	}

	function wireCover() {
		coverPhoto.addEventListener('error', () => coverPhoto.remove());
		pick('[data-cp-cover-pick]').addEventListener('click', () => pick('[data-cp-cover-input]').click());
		pick('[data-cp-cover-remove]').addEventListener('click', () => {
			const removed = coverUrl;
			showCover('');
			pick('[data-basalt-drop-browse]', dropArea).focus();
			notify({
				tone: 'success',
				icon: 'bi-image',
				title: 'Cover removed',
				actions: [
					{
						label: 'Undo',
						onClick() {
							showCover(removed);
						},
					},
				],
			});
		});
		dropArea.addEventListener('basalt:files', (event) => {
			const photo = event.detail.files.find((file) => /^image\/(jpeg|png|webp)$/.test(file.type));
			if (!photo) {
				notify({
					tone: 'warning',
					icon: 'bi-exclamation-circle',
					title: 'That is not a photo',
					text: 'Use a JPG, PNG or WebP file.',
				});
				return;
			}
			/* A real app uploads the file here and keeps the address it returns. */
			showCover(URL.createObjectURL(photo));
			fields.alt.value = '';
			fields.alt.focus();
			refresh();
		});
	}

	/* Write and Preview, and the preview's width. */

	/** Shows the "write" or "preview" side of the story card. */
	function switchView(view) {
		const choice = pick(`[data-cp-mode][value="${view}"]`);
		if (!choice.checked) choice.checked = true;
		for (const panel of pickAll('[data-cp-view]')) panel.hidden = panel.getAttribute('data-cp-view') !== view;

		const previewing = view === 'preview';
		slot('mode-desc').textContent = previewing
			? 'The post as readers will see it on the blog.'
			: 'Write and edit the post. Preview shows it as readers will see it.';
		if (previewing) drawReader();
		else growSummary();
	}

	function wireViews() {
		for (const choice of pickAll('[data-cp-mode]')) {
			choice.addEventListener('change', () => switchView(choice.value));
		}
		for (const choice of pickAll('[data-cp-width]')) {
			choice.addEventListener('change', () => {
				pick('[data-cp-stage]').classList.toggle('is-phone', choice.value === 'phone' && choice.checked);
			});
		}
	}

	/** Renders the post the way the blog would show it. */
	function drawReader() {
		const look = categoryLook[fields.category.value];
		const showsPhoto = coverUrl && coverPhoto.isConnected;
		pick('[data-cp-read-cover]').innerHTML = showsPhoto
			? `<img src="${htmlSafe(coverUrl)}" alt="${htmlSafe(fields.alt.value)}">`
			: `<i class="bi ${look?.icon || 'bi-tools'}" aria-hidden="true"></i>`;

		slot('category').textContent = fields.category.value;
		slot('read-title').textContent = fields.title.value.trim() || 'Untitled post';
		slot('read-summary').textContent = fields.summary.value.trim();
		slot('author').textContent = fields.author.value;

		const shownDay = post.status === 'published' ? post.liveSince || DEMO_DAY : fields.date.value;
		const byline = [
			authorRoles[fields.author.value],
			shownDay ? dayName(shownDay) : '',
			`${minutesToRead()} min read`,
		];
		slot('read-meta').textContent = byline.filter(Boolean).join(' · ');

		const portrait = pick('[data-cp-read-avatar]');
		portrait.setAttribute('data-name', fields.author.value);
		portrait.textContent = '';
		window.Basalt.avatars?.(portrait.parentElement);

		pick('[data-cp-read-body]').innerHTML = sanitize(story.innerHTML) || '<p>Nothing written yet.</p>';
		pick('[data-cp-read-tags]').innerHTML = currentTags()
			.map((word) => `<span class="cp-read-tag">${htmlSafe(word)}</span>`)
			.join('');
	}

	/* The rich text editor, built the same way as the Rich Text Editor page. */

	function isSafeLink(address) {
		return /^(https?:\/\/|mailto:|\/|#)/i.test((address || '').trim());
	}

	/** Returns the markup with only blog-safe tags and attributes left. */
	function sanitize(markup) {
		const holder = document.createElement('template');
		holder.innerHTML = markup;
		scrub(holder.content);
		const wrapper = document.createElement('div');
		wrapper.appendChild(holder.content);
		return wrapper.innerHTML.trim();
	}

	/** Walks a node's children in place: drops, unwraps or renames them. */
	function scrub(parent) {
		const isListOrRoot = parent.nodeType === Node.DOCUMENT_FRAGMENT_NODE || /^(UL|OL)$/.test(parent.nodeName);
		for (const child of [...parent.childNodes]) {
			if (child.nodeType === Node.TEXT_NODE) {
				if (isListOrRoot && !child.data.trim()) child.remove();
				continue;
			}
			if (child.nodeType !== Node.ELEMENT_NODE || STRIPPED_TAGS.has(child.nodeName)) {
				child.remove();
				continue;
			}

			scrub(child);

			if (ALLOWED_TAGS.has(child.nodeName)) {
				const keepsHref = child.nodeName === 'A';
				for (const { name, value } of [...child.attributes]) {
					if (keepsHref && name === 'href' && isSafeLink(value)) continue;
					child.removeAttribute(name);
				}
				continue;
			}

			const renamed = RENAMED_TAGS.get(child.nodeName);
			if (!renamed) {
				child.replaceWith(...child.childNodes);
				continue;
			}
			const swap = document.createElement(renamed);
			while (child.firstChild) swap.appendChild(child.firstChild);
			child.replaceWith(swap);
		}
	}

	function keepSelection() {
		const selection = window.getSelection();
		if (selection.rangeCount && story.contains(selection.anchorNode))
			savedRange = selection.getRangeAt(0).cloneRange();
	}

	function bringBackSelection() {
		story.focus();
		if (!savedRange || !story.contains(savedRange.startContainer)) return;
		const selection = window.getSelection();
		selection.removeAllRanges();
		selection.addRange(savedRange);
	}

	/** Runs one editing command on the remembered selection. */
	function runCommand(command, argument) {
		bringBackSelection();
		try {
			document.execCommand(command, false, argument || null);
		} catch {
			/* Some engines reject commands they do not know. */
		}
		keepSelection();
		reflectFormatting();
		refresh();
	}

	/** Lights the toolbar buttons and the style select to match the caret. */
	function reflectFormatting() {
		const selection = window.getSelection();
		if (!selection.rangeCount || !story.contains(selection.anchorNode)) return;

		for (const button of pickAll('[data-cp-cmd][aria-pressed]', tools)) {
			let active;
			try {
				active = document.queryCommandState(button.getAttribute('data-cp-cmd'));
			} catch {
				active = false;
			}
			button.setAttribute('aria-pressed', String(active));
		}

		let blockName;
		try {
			blockName = String(document.queryCommandValue('formatBlock') || '').toLowerCase();
		} catch {
			blockName = '';
		}
		const styleSelect = pick('[data-cp-block]', tools);
		const wanted = ['h3', 'h4', 'blockquote'].includes(blockName) ? blockName : 'p';
		if (styleSelect.value !== wanted) styleSelect.value = wanted;
	}

	function wireEditor() {
		try {
			document.execCommand('defaultParagraphSeparator', false, 'p');
		} catch {
			/* Older engines have no such setting. */
		}

		/* Pressing a tool must not take the selection away from the text. */
		tools.addEventListener('mousedown', (event) => {
			if (event.target.closest('.cp-tool')) event.preventDefault();
		});
		for (const button of pickAll('[data-cp-cmd]', tools)) {
			button.addEventListener('click', () => runCommand(button.getAttribute('data-cp-cmd')));
		}
		pick('[data-cp-block]', tools).addEventListener('change', (event) =>
			runCommand('formatBlock', event.target.value),
		);

		story.addEventListener('input', () => {
			keepSelection();
			refresh();
		});
		for (const type of ['keyup', 'mouseup']) {
			story.addEventListener(type, () => {
				keepSelection();
				reflectFormatting();
			});
		}
		story.addEventListener('paste', (event) => {
			const clipboard = event.clipboardData;
			if (!clipboard) return;
			event.preventDefault();
			const pastedHtml = clipboard.getData('text/html');
			if (pastedHtml) document.execCommand('insertHTML', false, sanitize(pastedHtml));
			else document.execCommand('insertText', false, clipboard.getData('text/plain'));
		});
		document.addEventListener('selectionchange', () => {
			if (document.activeElement !== story) return;
			keepSelection();
			reflectFormatting();
		});
		pick('[data-cp-focus]').addEventListener('click', () => story.focus());

		wireToolbarKeys();
	}

	/** The toolbar is one Tab stop; arrows, Home and End move inside it. */
	function wireToolbarKeys() {
		const stops = () =>
			pickAll('button, select', tools).filter((control) => !control.classList.contains('basalt-select-native'));
		const makeCurrent = (list, chosen) => {
			for (const control of list) control.setAttribute('tabindex', control === chosen ? '0' : '-1');
		};

		const initial = stops();
		makeCurrent(initial, initial[0]);

		tools.addEventListener('focusin', (event) => {
			const list = stops();
			if (list.includes(event.target)) makeCurrent(list, event.target);
		});
		tools.addEventListener('keydown', (event) => {
			if (event.defaultPrevented) return;
			const list = stops().filter((control) => !control.disabled);
			const here = list.indexOf(document.activeElement);
			if (here < 0) return;
			const count = list.length;
			const offsets = { ArrowRight: here + 1, ArrowLeft: here - 1 + count, Home: 0, End: count - 1 };
			if (!Object.hasOwn(offsets, event.key)) return;
			event.preventDefault();
			list[offsets[event.key] % count].focus();
		});
	}

	/* The link panel that opens under the toolbar. */

	function flagLink(problem) {
		linkMessage.textContent = problem;
		linkMessage.hidden = !problem;
		linkInput.classList.toggle('is-invalid', !!problem);
		linkInput.setAttribute('aria-invalid', problem ? 'true' : 'false');
	}

	/** The link the caret sits in, if it is inside the story. */
	function linkUnderCaret() {
		const anchor = window.getSelection().anchorNode?.parentElement?.closest('a');
		return anchor && story.contains(anchor) ? anchor : null;
	}

	function openLinkPanel() {
		keepSelection();
		const anchor = linkUnderCaret();
		linkInput.value = anchor ? anchor.getAttribute('href') : '';
		flagLink('');
		linkPanel.hidden = false;
		linkPanel.style.top = `${tools.offsetHeight + 6}px`;
		linkToggle.setAttribute('aria-expanded', 'true');
		linkInput.focus();
	}

	/** Closes the panel; `returnTo` is "button", "text" or nothing. */
	function closeLinkPanel(returnTo) {
		if (linkPanel.hidden) return;
		linkPanel.hidden = true;
		linkToggle.setAttribute('aria-expanded', 'false');
		if (returnTo === 'button') linkToggle.focus();
		else if (returnTo === 'text') bringBackSelection();
	}

	function wireLinkPanel() {
		linkToggle.addEventListener('click', () => (linkPanel.hidden ? openLinkPanel() : closeLinkPanel('button')));
		story.addEventListener('keydown', (event) => {
			if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
			event.preventDefault();
			openLinkPanel();
		});

		linkPanel.addEventListener('submit', (event) => {
			event.preventDefault();
			let address = linkInput.value.trim();
			if (!address) {
				flagLink('Enter the address to link to.');
				linkInput.focus();
				return;
			}
			if (/^www\./i.test(address)) address = `https://${address}`;
			if (!isSafeLink(address) || /^https?:\/\/?$/i.test(address)) {
				flagLink('Start the address with https://, mailto: or a slash.');
				linkInput.focus();
				return;
			}

			closeLinkPanel('text');
			const collapsed = window.getSelection().isCollapsed;
			const anchor = linkUnderCaret();
			if (collapsed && anchor) {
				anchor.setAttribute('href', address);
			} else if (collapsed) {
				document.execCommand(
					'insertHTML',
					false,
					`<a href="${htmlSafe(address)}">${htmlSafe(address.replace(/^mailto:/, ''))}</a>`,
				);
			} else {
				document.execCommand('createLink', false, address);
			}
			keepSelection();
			refresh();
		});

		pick('[data-cp-unlink]', linkPanel).addEventListener('click', () => {
			closeLinkPanel('text');
			const selection = window.getSelection();
			const anchor = linkUnderCaret();
			if (selection.isCollapsed && anchor) {
				const whole = document.createRange();
				whole.selectNodeContents(anchor);
				selection.removeAllRanges();
				selection.addRange(whole);
			}
			document.execCommand('unlink');
			refresh();
		});

		linkPanel.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			closeLinkPanel('button');
		});
		linkInput.addEventListener('input', () => {
			if (!linkMessage.hidden) flagLink('');
		});
		document.addEventListener('click', (event) => {
			if (linkPanel.hidden || linkPanel.contains(event.target) || linkToggle.contains(event.target)) return;
			closeLinkPanel();
		});
	}

	/* Full screen writing; Escape leaves it unless the link panel is open. */

	function setExpanded(expanded) {
		editorShell.classList.toggle('is-full', expanded);
		expandToggle.setAttribute('aria-pressed', String(expanded));
		expandToggle.setAttribute('aria-label', expanded ? 'Leave full screen' : 'Full screen');
		pick('i', expandToggle).className = `bi ${expanded ? 'bi-fullscreen-exit' : 'bi-arrows-fullscreen'}`;
		document.documentElement.style.overflow = expanded ? 'hidden' : '';
	}

	function wireExpand() {
		expandToggle.addEventListener('click', () => setExpanded(!editorShell.classList.contains('is-full')));
		editorShell.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape' || !editorShell.classList.contains('is-full') || !linkPanel.hidden) return;
			setExpanded(false);
			expandToggle.focus();
		});
	}

	/* The side panel: every card beside the post folds away from 1200px,
     so the post can take the full width. The choice is kept for next time. */

	function wireSidePanel() {
		const toggle = pick('[data-cp-side-toggle]');
		const layout = pick('[data-cp-layout]');
		const show = (hidden) => {
			const words = hidden ? 'Show the side panel' : 'Hide the side panel';
			layout.classList.toggle('is-side-hidden', hidden);
			toggle.setAttribute('aria-pressed', String(hidden));
			toggle.setAttribute('aria-label', words);
			toggle.setAttribute('data-bs-title', words);
			window.bootstrap?.Tooltip.getInstance(toggle)?.setContent({ '.tooltip-inner': words });
		};
		show(remembered(SIDE_STORE) === 'hidden');
		toggle.addEventListener('click', () => {
			const hidden = !layout.classList.contains('is-side-hidden');
			show(hidden);
			remember(SIDE_STORE, hidden ? 'hidden' : 'shown');
		});
	}

	function remembered(key) {
		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	}

	function remember(key, value) {
		try {
			localStorage.setItem(key, value);
		} catch {
			/* A private window says no; the choice is simply not kept. */
		}
	}

	/* Form fields, the header actions and leaving the page. */

	/** Lets the summary box grow so its whole text stays visible. */
	function growSummary() {
		const box = fields.summary;
		if (!box.offsetParent) return;
		box.style.height = 'auto';
		box.style.height = `${box.scrollHeight + 2}px`;
	}

	function wireFields() {
		fields.title.addEventListener('input', () => {
			fields.title.classList.remove('is-invalid');
			if (!slugEdited && post.status !== 'published') fields.slug.value = toSlug(fields.title.value);
			refresh();
		});
		fields.slug.addEventListener('input', () => {
			slugEdited = true;
			refresh();
		});
		fields.slug.addEventListener('blur', () => {
			fields.slug.value = toSlug(fields.slug.value) || toSlug(fields.title.value);
			refresh();
		});
		for (const name of ['summary', 'alt', 'date', 'time']) fields[name].addEventListener('input', refresh);
		fields.summary.addEventListener('input', growSummary);
		window.addEventListener('resize', growSummary);
		for (const name of ['feature', 'newsletter', 'author', 'date', 'time'])
			fields[name].addEventListener('change', refresh);
		fields.category.addEventListener('change', refreshEverything);
		tagField.addEventListener('change', refresh);

		pick('[data-cp-save]', document).addEventListener('click', () => savePost(false));
		document.addEventListener('keydown', (event) => {
			if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
			event.preventDefault();
			savePost(false);
		});
		pick('.cp-hint', editorShell).textContent = `${onApple ? '⌘S' : 'Ctrl+S'} saves`;

		pick('[data-cp-copy-link]', document).addEventListener('click', () => {
			const address = `https://${BLOG_HOST}${fields.slug.value || toSlug(fields.title.value)}`;
			window.Basalt.copyText?.(address);
			notify({ tone: 'success', icon: 'bi-link-45deg', title: 'Link copied', text: address });
		});
		pick('[data-cp-duplicate]', document).addEventListener('click', () => {
			const copyName = `${fields.title.value.trim() || 'Untitled post'} (copy)`;
			notify({
				tone: 'success',
				icon: 'bi-copy',
				title: 'Copy saved as a draft',
				text: `“${copyName}” is with the drafts on the Blog list.`,
				actions: [
					{
						label: 'Open Blog',
						onClick() {
							window.location.href = 'blog.html';
						},
					},
				],
			});
		});

		/* Unsaved edits make the browser ask before leaving, except when the
       way out is the Delete button. */
		pick('[data-cp-delete]', document).addEventListener('click', () => {
			deleting = true;
		});
		window.addEventListener('beforeunload', (event) => {
			if (deleting || !hasEdits()) return;
			event.preventDefault();
			event.returnValue = '';
		});
	}
})();
