/**
 * Basalt - Social Post Details (social-post-details.html)
 * One Marlo social post: a preview as each of its channels shows it,
 * the post itself (editable until it goes out), how it did once it is
 * out, and who wrote and approved it.
 *
 * social-post-details.html?id=<id> opens that post; without one (or
 * with an id that doesn't exist) it opens "Through a week of frost".
 * ?new=1 starts a new draft. Data: assets/basalt/js/data/multipurpose/social.js, which
 * reads pictures from assets/basalt/js/data/multipurpose/catalog.js. Saving and
 * approving change the post in memory only; send them to your
 * scheduling service where noted.
 */
(() => {
	'use strict';
	const root = pick('[data-sd-root]');
	if (!root || !window.Basalt.data || !window.Basalt.data.social) return;

	const S = window.Basalt.data.social;
	const CAT = window.Basalt.data.catalog;

	function start() {
		el.form.addEventListener('submit', (e) => {
			e.preventDefault();
			let first = null;
			function fail(id, field, text, focus) {
				showError(id, field, text);
				if (!first) first = focus || field;
			}

			for (const id of ['sd-name-error', 'sd-channels-error', 'sd-caption-error', 'sd-when-error']) {
				hideError(id);
			}

			for (const x of [f.title, f.caption, f.time]) {
				x.classList.remove('is-invalid');
				x.removeAttribute('aria-invalid');
			}

			const name = f.title.value.trim();
			if (!name) fail('sd-name-error', f.title);
			if (!draft.channels.length) fail('sd-channels-error', null, null, f.chs[0]);
			if (!draft.caption.trim()) fail('sd-caption-error', f.caption, 'Write a caption.');
			else if (!renderCount()) fail('sd-caption-error', f.caption, `Too long for ${strictest().name}.`);
			const date = window.Basalt.datepicker ? window.Basalt.datepicker.get(f.date) : '';
			const at = date && f.time.value ? parse(`${date}T${f.time.value}`) : null;
			if (!at || at <= NOW) fail('sd-when-error', f.time, null, at ? f.time : pick('#sd-date'));
			if (first) {
				first.focus();
				return;
			}

			Object.assign(post, {
				title: name,
				caption: draft.caption.trim(),
				tags: draft.tags.slice(),
				channels: draft.channels.slice(),
				sku: draft.sku,
				photo: draft.photo,
				at: `${keyOf(at)}T${f.time.value}`,
			});
			if (!post.sku) delete post.sku;
			if (!post.photo) delete post.photo;
			const wasNew = !!post.fresh;
			if (wasNew) {
				delete post.fresh;
				post.waiting = S.now;
			}
			/* Send the post to your scheduling service here. */
			paintEverything();
			toast(
				wasNew
					? {
							tone: 'success',
							icon: 'bi-check2-circle',
							title: 'Draft saved',
							text: `It waits for approval, booked for ${when(at)}.`,
						}
					: {
							tone: 'success',
							icon: 'bi-check2-circle',
							title: 'Saved',
							text: `“${post.title}” goes out ${when(at)}.`,
						},
			);
		});

		/* Header actions */
		el.approve.addEventListener('click', () => {
			if (parse(post.at) <= NOW) {
				toast({
					tone: 'warning',
					icon: 'bi-clock-history',
					title: 'That time has passed',
					text: 'Pick a new time below, save, then approve it.',
				});
				return;
			}
			post.status = 'scheduled';
			post.approved = { by: S.me, on: keyOf(NOW) };
			delete post.waiting;
			/* Send the approval to your scheduling service here. */
			paintEverything();
			toast({
				tone: 'success',
				icon: 'bi-check2-circle',
				title: 'Approved',
				text: `It goes out ${when(parse(post.at))}.`,
			});
			el.title.setAttribute('tabindex', '-1');
			el.title.focus();
		});
		el.menu.addEventListener('click', (e) => {
			const act = e.target.closest('[data-sd-act]');
			if (!act) return;
			const a = act.dataset.sdAct;
			if (a === 'copy') {
				const url = `${location.origin + location.pathname}?id=${encodeURIComponent(post.id)}`;
				if (window.Basalt.copyText) window.Basalt.copyText(url);
				toast({
					tone: 'success',
					icon: 'bi-link-45deg',
					title: 'Link copied',
					text: 'Anyone on the team can open the post with it.',
				});
			} else if (a === 'unbook') {
				post.status = 'draft';
				delete post.approved;
				post.waiting = S.now;
				paintEverything();
				toast({
					tone: 'info',
					icon: 'bi-arrow-counterclockwise',
					title: 'Back in drafts',
					text: 'It won’t go out until it is approved again.',
				});
			}
		});

		paintEverything();
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

	const CH = {};
	S.channels.forEach((c) => {
		CH[c.id] = c;
	});
	const ORDER = S.channels.map((c) => c.id);

	/* Dates */
	function parse(iso) {
		const [d, t] = iso.split('T');
		const [y, m, day] = d.split('-').map(Number);
		const [h, min] = (t || '0:0').split(':').map(Number);
		return new Date(y, m - 1, day, h, min);
	}

	const NOW = parse(S.now);

	function pad(n) {
		return String(n).padStart(2, '0');
	}

	function keyOf(d) {
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}

	function dayStart(d) {
		return new Date(d.getFullYear(), d.getMonth(), d.getDate());
	}

	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	function time(d) {
		return `${d.getHours() % 12 || 12}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'am' : 'pm'}`;
	}

	function day(d) {
		return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function when(d) {
		return `${day(d)}, ${time(d)}`;
	}

	function shortDate(iso) {
		const d = parse(iso.length > 10 ? iso : `${iso}T00:00`);
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function until(d) {
		const mins = Math.round((d - NOW) / 6e4);
		if (mins < 60) return `in ${mins} min`;
		const days = Math.round((dayStart(d) - dayStart(NOW)) / 864e5);
		if (days === 0) {
			const h = Math.round(mins / 60);
			return `in ${h}${h === 1 ? ' hour' : ' hours'}`;
		}
		return days === 1 ? 'tomorrow' : `in ${days} days`;
	}

	function ago(d) {
		const days = Math.round((dayStart(NOW) - dayStart(d)) / 864e5);
		return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
	}

	function list(names) {
		return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
	}

	function fmt(n) {
		return n.toLocaleString('en-US');
	}

	/* The post */
	const params = new URLSearchParams(location.search);
	const isNew = params.has('new');
	const post = isNew
		? {
				id: 'new',
				title: 'New post',
				at: `${keyOf(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + 1))}T09:00`,
				status: 'draft',
				channels: ['instagram'],
				sku: 'ML-BLAZ',
				caption: '',
				tags: ['#marlo'],
				by: S.me,
				written: keyOf(NOW),
				fresh: true,
			}
		: S.find(params.get('id')) || S.find('sp-207');
	let channel = post.channels[0];

	const STATUS = {
		published: { label: 'Published', tone: 'success' },
		scheduled: { label: 'Scheduled', tone: 'primary' },
		draft: { label: 'Draft', tone: 'warning' },
	};

	function isOut() {
		return post.status === 'published';
	}

	function channelNames(ids) {
		return list(ids.map((c) => CH[c].name));
	}

	function nameOrYou(n) {
		return n === S.me ? 'you' : n;
	}

	function say(text) {
		const live = pick('[data-sd-live]', root);
		if (live) {
			live.textContent = '';
			setTimeout(() => {
				live.textContent = text;
			}, 30);
		}
	}
	function toast(o) {
		if (window.Basalt.toasts) window.Basalt.toasts.push(o);
		else say(`${o.title}. ${o.text || ''}`);
	}

	const el = {
		title: pick('[data-sd="title"]', root),
		sub: pick('[data-sd="sub"]', root),
		status: pick('[data-sd="status"]', root),
		approve: pick('[data-sd-approve]', root),
		menu: pick('[data-sd="menu"]', root),
		sw: pick('[data-sd="switch"]', root),
		preview: pick('[data-sd="preview"]', root),
		previewDesc: pick('[data-sd="preview-desc"]', root),
		resultsCard: pick('.sd-card-results', root),
		postDesc: pick('[data-sd="post-desc"]', root),
		read: pick('[data-sd-read]', root),
		form: pick('[data-sd-form]', root),
		results: pick('[data-sd="results"]', root),
		resultsDesc: pick('[data-sd="results-desc"]', root),
		who: pick('[data-sd="who"]', root),
	};
	const f = {
		title: pick('[data-sd-f="title"]', root),
		picture: pick('[data-sd-f="picture"]', root),
		caption: pick('[data-sd-f="caption"]', root),
		time: pick('[data-sd-f="time"]', root),
		date: pick('[data-sd-date]', root),
		tags: pick('[data-sd-tags]', root),
		tagInput: pick('[data-sd-tag-input]', root),
		count: pick('[data-sd-count]', root),
		chs: pickAll('[data-sd-ch]', root),
	};

	/* The post as it stands in the form, so the preview follows typing. */
	const draft = {
		title: post.title,
		caption: post.caption,
		tags: post.tags.slice(),
		channels: post.channels.slice(),
		sku: post.sku || null,
		photo: post.photo || null,
	};

	function photo(w, h) {
		return S.photoOf({ sku: draft.sku, photo: draft.photo }, w, h);
	}

	function textLength() {
		return draft.caption.trim().length + (draft.tags.length ? draft.tags.join(' ').length + 2 : 0);
	}

	function strictest() {
		return (
			draft.channels
				.map((c) => CH[c])
				.filter((c) => c.limit)
				.sort((a, b) => a.limit - b.limit)[0] || null
		);
	}

	/* Header */
	function paintHead() {
		const at = parse(post.at);
		document.title = `${post.title} · Basalt`;
		el.title.textContent = post.title;
		el.sub.textContent = `${channelNames(post.channels)} · ${when(at)}`;
		el.status.innerHTML = `<span class="basalt-status basalt-status-dot basalt-status-${STATUS[post.status].tone}">${STATUS[post.status].label}</span><span class="sd-status-note">${htmlSafe(isOut() ? `Went out ${ago(at)}` : post.status === 'scheduled' ? `Goes out ${until(at)}` : post.fresh ? 'Not saved yet' : 'Waiting for your OK')}</span>`;
		el.approve.hidden = post.status !== 'draft' || !!post.fresh;
		const items = [['copy', 'bi-link-45deg', 'Copy link']];
		if (post.status === 'scheduled') items.push(['unbook', 'bi-arrow-counterclockwise', 'Move back to drafts']);
		el.menu.innerHTML = items
			.map(
				(i) =>
					`<li><button type="button" class="dropdown-item" data-sd-act="${i[0]}"><i class="bi ${i[1]} me-2" aria-hidden="true"></i>${i[2]}</button></li>`,
			)
			.join('');
	}

	/* Preview */
	function renderSwitch() {
		if (!draft.channels.includes(channel)) channel = draft.channels[0] || 'instagram';
		const ids = ORDER.filter((c) => draft.channels.includes(c));
		el.previewDesc.textContent =
			ids.length === 1 ? `How it looks on ${CH[ids[0]].name}.` : 'How it looks on each channel.';
		el.sw.innerHTML =
			ids.length > 1
				? `<div class="basalt-segmented basalt-segmented-sm" role="radiogroup" aria-label="Preview on" data-basalt-segmented>${ids
						.map(
							(c) =>
								`<input type="radio" class="btn-check" name="sdChannel" id="sd-ch-${c}" value="${c}"${c === channel ? ' checked' : ''} data-sd-switch><label class="basalt-segmented-option" for="sd-ch-${c}"><i class="bi ${CH[c].icon} me-1" aria-hidden="true"></i>${CH[c].name}</label>`,
						)
						.join('')}</div>`
				: '';
		if (window.Basalt.buttons) window.Basalt.buttons(el.sw);
	}

	function tagsMarkup() {
		return draft.tags.map((t) => `<span class="sd-tag">${htmlSafe(t)}</span>`).join(' ');
	}

	function capHtml() {
		return htmlSafe(draft.caption.trim() || 'Your caption shows here.');
	}

	function resultsOf(c) {
		return (isOut() && post.results && post.results[c]) || null;
	}

	const brand = '<span class="sd-brand" aria-hidden="true">M</span>';

	function mock(c) {
		const at = parse(post.at);
		const r = resultsOf(c);
		const stamp = isOut() ? shortDate(post.at) : `Goes out ${day(at)}`;
		if (c === 'instagram') {
			return `<div class="sd-phone sd-ig"><div class="sd-ig-head">${brand}<span class="sd-who"><b>${htmlSafe(CH.instagram.handle)}</b><span>Marlo</span></span><i class="bi bi-three-dots ms-auto" aria-hidden="true"></i></div><div class="sd-pic sd-pic-portrait"><img src="${photo(680, 850)}" alt=""></div><div class="sd-ig-bar" aria-hidden="true"><i class="bi bi-heart"></i><i class="bi bi-chat"></i><i class="bi bi-send"></i><i class="bi bi-bookmark ms-auto"></i></div><div class="sd-ig-text">${r ? `<p class="sd-ig-likes">${fmt(r[1])} likes</p>` : ''}<p class="sd-ig-cap"><b>${htmlSafe(CH.instagram.handle)}</b> ${capHtml()} ${tagsMarkup()}</p><p class="sd-ig-time">${htmlSafe(stamp)}</p></div></div>`;
		}
		if (c === 'pinterest') {
			return `<div class="sd-phone sd-pin"><div class="sd-pic sd-pic-tall"><img src="${photo(680, 1020)}" alt=""><span class="sd-pin-save">Save</span></div><div class="sd-pin-text"><p class="sd-pin-title">${htmlSafe(draft.title)}</p><p class="sd-pin-cap">${capHtml()} ${tagsMarkup()}</p><p class="sd-pin-by">${brand}<b>Marlo</b>${r ? `<span>${fmt(r[2])} saves</span>` : ''}</p></div></div>`;
		}
		if (c === 'tiktok') {
			const side = [
				['bi-heart-fill', r ? short(r[1]) : 'Like'],
				['bi-chat-dots-fill', 'Chat'],
				['bi-bookmark-fill', r ? short(r[2]) : 'Save'],
				['bi-share-fill', 'Share'],
			];
			return `<div class="sd-phone sd-tt"><div class="sd-pic sd-pic-video"><img src="${photo(600, 1066)}" alt=""><ul class="sd-tt-side">${side.map((s) => `<li><i class="bi ${s[0]}" aria-hidden="true"></i><span>${htmlSafe(s[1])}</span></li>`).join('')}</ul><div class="sd-tt-text"><p class="sd-tt-name">@${htmlSafe(CH.tiktok.handle)}</p><p class="sd-tt-cap">${capHtml()} ${tagsMarkup()}</p></div></div></div>`;
		}
		return `<div class="sd-phone sd-fb"><div class="sd-ig-head">${brand}<span class="sd-who"><b>Marlo</b><span>${htmlSafe(stamp)} · <i class="bi bi-globe-americas" aria-hidden="true"></i><span class="visually-hidden">Public</span></span></span><i class="bi bi-three-dots ms-auto" aria-hidden="true"></i></div><p class="sd-fb-cap">${capHtml()} ${tagsMarkup()}</p><div class="sd-pic sd-pic-wide"><img src="${photo(760, 520)}" alt=""></div>${r ? `<p class="sd-fb-count"><i class="bi bi-hand-thumbs-up-fill" aria-hidden="true"></i>${fmt(r[1])}</p>` : ''}<div class="sd-fb-bar" aria-hidden="true"><span><i class="bi bi-hand-thumbs-up"></i>Like</span><span><i class="bi bi-chat"></i>Comment</span><span><i class="bi bi-share"></i>Share</span></div></div>`;
	}
	function short(n) {
		return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);
	}

	function paintPreview() {
		el.preview.innerHTML = draft.channels.length
			? `${mock(channel)}<p class="visually-hidden">Preview of the post on ${htmlSafe(CH[channel].name)}.</p>`
			: '<p class="sd-blank">Pick a channel to see the preview.</p>';
	}

	/* How it did */
	function renderResults() {
		const r = resultsOf(channel);
		/* Only a post that is out has numbers; before that the card stays away. */
		el.resultsCard.hidden = !r;
		if (!r) {
			el.results.innerHTML = '';
			return;
		}
		const usual = CH[channel].usual;
		el.resultsDesc.textContent = `On ${CH[channel].name}, against a usual post there.`;
		el.results.innerHTML = `<dl class="basalt-figs sd-figs">${['Reach', 'Likes', 'Saves', 'Clicks']
			.map((label, i) => {
				const change = Math.round((r[i] / usual[i] - 1) * 100);
				const up = change >= 0;
				const share = Math.min(100, Math.round((r[i] / Math.max(r[i], usual[i])) * 100));
				const mark = Math.min(100, Math.round((usual[i] / Math.max(r[i], usual[i])) * 100));
				return `<div class="basalt-fig"><dt class="basalt-fig-label">${label}</dt><dd class="basalt-fig-body"><span class="basalt-fig-value">${fmt(r[i])}</span><span class="sd-fig-bar" aria-hidden="true"><span style="width:${share}%"></span><i style="left:${mark}%"></i></span><span class="basalt-fig-note sd-fig-vs${up ? ' is-up' : ''}">${change === 0 ? 'Same as usual' : `${Math.abs(change)}% ${up ? 'above' : 'below'} usual`}</span></dd></div>`;
			})
			.join(
				'',
			)}</dl><p class="sd-note sd-figs-key"><span class="sd-key-line" aria-hidden="true"></span>The line marks a usual ${htmlSafe(CH[channel].name)} post: ${fmt(usual[0])} reach.</p>`;
	}

	/* Who and when */
	function renderWho() {
		const at = parse(post.at);
		const steps = [];

		function job(n) {
			return S.people[n] && n !== S.me ? ` · ${S.people[n]}` : '';
		}

		steps.push(['done', 'bi-pencil', `Written by ${nameOrYou(post.by)}`, shortDate(post.written) + job(post.by)]);
		if (post.approved)
			steps.push([
				'done',
				'bi-check2',
				`Approved by ${nameOrYou(post.approved.by)}`,
				shortDate(post.approved.on) + job(post.approved.by),
			]);
		else if (post.fresh) steps.push(['next', 'bi-hourglass', 'Approval', 'After you save it as a draft']);
		else steps.push(['wait', 'bi-hourglass-split', 'Waiting for your OK', `Sent ${when(parse(post.waiting))}`]);
		if (isOut()) steps.push(['done', 'bi-send-check', `Went out on ${channelNames(post.channels)}`, when(at)]);
		else
			steps.push([
				'next',
				'bi-clock',
				`Goes out on ${channelNames(post.channels)}`,
				when(at) + (post.status === 'scheduled' ? `, ${until(at)}` : ''),
			]);
		el.who.innerHTML = `<ol class="sd-steps">${steps.map((s) => `<li class="is-${s[0]}"><span class="sd-steps-mark" aria-hidden="true"><i class="bi ${s[1]}"></i></span><span><span class="sd-steps-title">${htmlSafe(s[2].charAt(0).toUpperCase() + s[2].slice(1))}</span><span class="sd-steps-meta">${htmlSafe(s[3])}</span></span></li>`).join('')}</ol>`;
	}

	/* The post: read-only once out, a form before */
	function renderRead() {
		el.postDesc.textContent = `Out since ${when(parse(post.at))}. Posts that are out can’t be changed here.`;
		el.read.innerHTML = `<dl class="sd-facts"><div><dt>Caption</dt><dd class="sd-facts-cap">${htmlSafe(post.caption)}</dd></div><div><dt>Hashtags</dt><dd class="sd-facts-tags">${post.tags.map(htmlSafe).join(' ')}</dd></div><div><dt>Picture</dt><dd>${htmlSafe(pictureName())}</dd></div></dl>`;
	}

	function pictureName() {
		const p = CAT && post.sku ? CAT.find(post.sku) : null;
		return p ? p.name : 'Studio photo';
	}

	function paintTags() {
		f.tags.innerHTML = draft.tags
			.map(
				(t, i) =>
					`<li class="sd-tags-chip">${htmlSafe(t)}<button type="button" class="sd-tags-x" data-sd-untag="${i}" aria-label="Remove ${htmlSafe(t)}"><i class="bi bi-x" aria-hidden="true"></i></button></li>`,
			)
			.join('');
	}

	function renderCount() {
		const n = textLength();
		const lim = strictest();
		const over = lim && n > lim.limit;
		f.count.classList.toggle('is-over', !!over);
		f.count.textContent = lim
			? `${fmt(n)} of ${fmt(lim.limit)} characters${draft.channels.length > 1 ? `, ${lim.name}’s limit` : ''}${over ? `. Shorten it by ${fmt(n - lim.limit)}.` : '.'}`
			: `${fmt(n)} characters.`;
		return !over;
	}

	function fillForm() {
		el.postDesc.textContent =
			post.status === 'draft'
				? 'Edit it here; it goes out once you approve it.'
				: 'Edit anything until it goes out.';
		f.title.value = draft.title === 'New post' && post.fresh ? '' : draft.title;
		f.caption.value = draft.caption;
		f.chs.forEach((c) => {
			c.checked = draft.channels.includes(c.value);
		});
		const products = CAT ? CAT.products() : [];
		f.picture.innerHTML =
			(draft.photo ? `<option value="photo:${htmlSafe(draft.photo)}">Studio photo</option>` : '') +
			products.map((p) => `<option value="${htmlSafe(p.sku)}">${htmlSafe(p.name)}</option>`).join('');
		f.picture.value = draft.photo ? `photo:${draft.photo}` : draft.sku;
		const at = parse(post.at);
		if (window.Basalt.datepicker) window.Basalt.datepicker.set(f.date, keyOf(at));
		f.time.value = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
		pick('[data-sd-save]', root).textContent = post.fresh ? 'Save draft' : 'Save changes';
		pick('[data-sd-save-note]', root).textContent = post.fresh ? 'It goes to you for approval.' : '';
		paintTags();
		renderCount();
	}

	function renderPost() {
		el.read.hidden = !isOut();
		el.form.hidden = isOut();
		if (isOut()) renderRead();
		else fillForm();
	}

	function paintEverything() {
		paintHead();
		renderSwitch();
		paintPreview();
		renderResults();
		renderWho();
		renderPost();
	}

	/* Live editing */
	el.sw.addEventListener('change', (e) => {
		const r = e.target.closest('[data-sd-switch]');
		if (!r) return;
		channel = r.value;
		paintPreview();
		renderResults();
	});
	f.title.addEventListener('input', () => {
		draft.title = f.title.value.trim() || 'New post';
		if (channel === 'pinterest') paintPreview();
	});
	f.caption.addEventListener('input', () => {
		draft.caption = f.caption.value;
		paintPreview();
		renderCount();
		hideError('sd-caption-error', f.caption);
	});
	f.picture.addEventListener('change', () => {
		const v = f.picture.value;
		if (v.indexOf('photo:') === 0) {
			draft.photo = v.slice(6);
			draft.sku = null;
		} else {
			draft.sku = v;
			draft.photo = null;
		}
		paintPreview();
	});
	f.chs.forEach((c) =>
		c.addEventListener('change', () => {
			draft.channels = ORDER.filter((id) => f.chs.some((x) => x.checked && x.value === id));
			if (c.checked) channel = c.value;
			renderSwitch();
			paintPreview();
			renderCount();
			if (draft.channels.length) hideError('sd-channels-error');
		}),
	);

	function addTag(raw) {
		const words = raw
			.split(/[\s,]+/)
			.map((w) => w.replace(/[^\p{L}\p{N}_]/gu, ''))
			.filter(Boolean);
		let added = 0;

		for (const w of words) {
			const tag = `#${w.toLowerCase()}`;
			if (!draft.tags.includes(tag) && draft.tags.length < 10) {
				draft.tags.push(tag);
				added += 1;
			}
		}

		if (added) {
			paintTags();
			paintPreview();
			renderCount();
			say(added === 1 ? `Added ${draft.tags[draft.tags.length - 1]}` : `${added} hashtags added`);
		}
	}
	f.tagInput.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addTag(f.tagInput.value);
			f.tagInput.value = '';
		} else if (e.key === 'Backspace' && !f.tagInput.value && draft.tags.length) {
			const gone = draft.tags.pop();
			paintTags();
			paintPreview();
			renderCount();
			say(`Removed ${gone}`);
		}
	});
	f.tagInput.addEventListener('blur', () => {
		if (f.tagInput.value.trim()) {
			addTag(f.tagInput.value);
			f.tagInput.value = '';
		}
	});
	f.tags.addEventListener('click', (e) => {
		const x = e.target.closest('[data-sd-untag]');
		if (!x) return;
		const gone = draft.tags.splice(Number(x.dataset.sdUntag), 1)[0];
		paintTags();
		paintPreview();
		renderCount();
		f.tagInput.focus();
		say(`Removed ${gone}`);
	});
	pick('[data-sd-tags-box]', root).addEventListener('click', (e) => {
		if (e.target === e.currentTarget || e.target === f.tags) f.tagInput.focus();
	});

	/* Saving */
	function showError(id, field, text) {
		const p = pick(`#${id}`);
		if (text) p.textContent = text;
		p.hidden = false;
		if (field) {
			field.classList.add('is-invalid');
			field.setAttribute('aria-invalid', 'true');
		}
	}
	function hideError(id, field) {
		pick(`#${id}`).hidden = true;
		if (field) {
			field.classList.remove('is-invalid');
			field.removeAttribute('aria-invalid');
		}
	}

	start();
})();
