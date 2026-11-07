/**
 * Basalt - Newsletter Details (newsletter-details.html)
 * One newsletter in full, opened as newsletter-details.html?id=<id>
 * from Newsletters. Without an id, or with one that is not in the
 * data, it opens the latest sent issue. A new draft made on
 * Newsletters arrives with its subject and audience in the address,
 * and a copy with the id of the issue it was copied from (copy=).
 *
 * Top to bottom: how it did (or when it goes out), the email as
 * subscribers see it, clicks by link (or the test sends) and who it
 * goes to. Send test, Duplicate and Schedule work in place. Until an
 * issue is sent, its subject, preview text, headline, text and button
 * are edited right in the email, and each product photo has a Swap menu;
 * Save keeps the changes.
 */
(() => {
	'use strict';
	const NL = window.Basalt.data.newsletters;
	const CAT = window.Basalt.data.catalog;
	const TODAY = NL.today;
	const AUDIENCES = NL.audiences;

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

	function photo(id, w, h) {
		return window.Basalt.photo(id, w, h);
	}

	function productUrl(sku) {
		return `product-details.html?sku=${encodeURIComponent(sku)}`;
	}

	/* Which newsletter */
	const params = new URLSearchParams(location.search);
	const all = NL.issues();
	const latestSent = all.filter((x) => x.status === 'sent').sort((a, b) => b.at.localeCompare(a.at))[0];
	let n = NL.find(params.get('id') || '');
	const source = !n && params.get('copy') ? NL.find(params.get('copy')) : null;
	if (source) {
		/* A copy: the same email, back to a draft with nothing sent yet. */
		n = Object.assign(source, {
			id: params.get('id') || 'copy',
			status: 'draft',
			subject: `Copy of ${source.subject}`,
			at: '',
			edited: [TODAY, 'John Armstrong'],
			author: 'John Armstrong',
			tests: [],
		});
		delete n.results;
		delete n.links;
	}
	if (!n && params.get('subject')) {
		/* A draft just made on Newsletters: a starting layout to fill in. */
		const aud = AUDIENCES[params.get('audience')] ? params.get('audience') : 'all';
		n = {
			id: params.get('id') || 'new',
			status: 'draft',
			subject: params.get('subject').slice(0, 60),
			audience: aud,
			at: '',
			preheader: 'A line people read after the subject.',
			edited: [TODAY, 'John Armstrong'],
			author: 'John Armstrong',
			hero: 'ML-BLAZ',
			headline: 'Your headline here',
			body: 'Write a few lines about what’s new. Most people read the first two lines and then decide.',
			cta: 'Shop now',
			tiles: ['ML-BLAZ', 'ML-SUIT', 'ML-OXFD', 'ML-CATE'],
			tests: [],
		};
	}
	if (!n) n = latestSent;

	/* The average open rate over the last 30 days, for comparison. */
	const recent = all.filter((x) => x.status === 'sent' && (dateOf(TODAY) - dateOf(x.at.slice(0, 10))) / 864e5 <= 30);
	const avgOpen = recent.reduce((s, x) => s + x.results.opened, 0) / recent.reduce((s, x) => s + x.results.sent, 0);
	const avgClick = recent.reduce((s, x) => s + x.results.clicked, 0) / recent.reduce((s, x) => s + x.results.sent, 0);

	function D(k) {
		return pick(`[data-nd="${k}"]`);
	}

	/* Header */
	const STATUS = {
		sent: { label: 'Sent', tone: 'success', icon: 'bi-check2' },
		scheduled: { label: 'Scheduled', tone: 'primary', icon: 'bi-clock' },
		draft: { label: 'Draft', tone: '', icon: 'bi-pencil' },
	};
	function paintHead() {
		const s = STATUS[n.status];
		document.title = `${n.subject} · Basalt`;
		D('subject').textContent = n.subject;
		D('status').innerHTML =
			`<span class="basalt-status${s.tone ? ` basalt-status-${s.tone}` : ''}"><i class="bi ${s.icon}" aria-hidden="true"></i>${s.label}</span>`;
		D('when').textContent =
			n.status === 'sent'
				? `Sent ${weekday(n.at)} at ${clock(n.at)} to ${AUDIENCES[n.audience].label}`
				: n.status === 'scheduled'
					? `For ${AUDIENCES[n.audience].label}, written by ${n.author}`
					: `Last edited ${day(n.edited[0])} by ${n.edited[1]}`;
		D('schedule').hidden = n.status === 'sent';
		D('schedule-label').textContent = n.status === 'scheduled' ? 'Reschedule' : 'Schedule';
	}

	/* How it did, or when it goes out */
	function fig(label, value, note, extra) {
		return `<div class="nd-fig${extra || ''}"><dt>${label}</dt><dd><span class="nd-fig-value">${value}</span><span class="nd-fig-note">${note}</span></dd></div>`;
	}
	function compare(rate, avg) {
		const diff = (rate - avg) * 100;
		if (Math.abs(diff) < 0.5) return 'about average';
		return `<span class="${diff > 0 ? 'nd-up' : 'nd-down'}">${diff > 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)} pts</span> vs average`;
	}
	function paintBand() {
		const band = D('band');
		if (n.status === 'sent') {
			const r = n.results;
			band.innerHTML = `<h2 class="visually-hidden" id="nd-band-title">Results</h2><dl class="nd-figs">${fig('Opened', pct(r.opened, r.sent), compare(r.opened / r.sent, avgOpen), ' nd-fig-lead')}${fig('Clicked', pct(r.clicked, r.sent), compare(r.clicked / r.sent, avgClick))}${fig('Orders', String(r.orders), `${money(Math.round(r.revenue / r.orders))} an order`)}${fig('Revenue', money(r.revenue), 'within 5 days of a click')}${fig('Unsubscribed', num(r.unsub), `${pct(r.unsub, r.sent)} of recipients`)}</dl>`;
			const lead = pick('.nd-fig-lead', band);
			lead.style.setProperty('--nd-open', `${((r.opened / r.sent) * 100).toFixed(1)}%`);
			pick('dd', lead).insertAdjacentHTML('beforeend', '<span class="nd-ring" aria-hidden="true"></span>');
			return;
		}
		const size = AUDIENCES[n.audience].size;
		const scheduled = n.status === 'scheduled';
		band.innerHTML = `<div class="nd-wait"><span class="nd-wait-icon" aria-hidden="true"><i class="bi ${scheduled ? 'bi-send' : 'bi-pencil'}"></i></span><div class="nd-wait-text"><h2 class="nd-wait-title" id="nd-band-title">${scheduled ? `Goes out ${inDays(n.at)}` : 'Not scheduled yet'}</h2><p class="nd-wait-sub">${scheduled ? `${weekday(n.at)} at ${clock(n.at)}, to ${num(size)} people. Results show here once it’s out.` : 'Send yourself a test, then pick a day. Results show here once it’s out.'}</p></div><dl class="nd-expect"><dt>Opens to expect</dt><dd><span class="nd-expect-value">~${num(Math.round((size * avgOpen) / 100) * 100)}</span><span class="nd-expect-note">at the ${(avgOpen * 100).toFixed(1)}% average</span></dd></dl></div>`;
	}

	/* The email */
	function clicksOf(key) {
		const l = (n.links || []).find((x) => x[0] === key);
		return l ? l[1] : 0;
	}

	function hit(key) {
		const c = clicksOf(key);
		return c ? `<span class="nd-hit" aria-hidden="true">${num(c)}</span>` : '';
	}
	/* Until it is sent, the email is edited in place: its words straight
	   in the preview, its products from a menu on each photo. Each field
	   keeps to the length an inbox shows. */
	const FIELDS = {
		subject: { max: 60, label: 'Subject' },
		preheader: { max: 90, label: 'Preview text' },
		headline: { max: 60, label: 'Headline' },
		body: { max: 320, label: 'Text', lines: true },
		cta: { max: 24, label: 'Button' },
	};
	let unsaved = false;

	function editable() {
		return n.status !== 'sent';
	}

	function fieldAttrs(field) {
		if (!editable()) return '';
		return ` contenteditable="plaintext-only" spellcheck="true" role="textbox" aria-label="${FIELDS[field].label}" data-nd-field="${field}"`;
	}

	/** The product menu on a photo while the email can still change: slot is "hero" or a tile's place. */
	function swapMenu(slot, current) {
		if (!editable()) return '';
		const items = CAT.products()
			.filter((p) => p.photo)
			.map(
				(p) =>
					`<li><button type="button" class="dropdown-item${p.sku === current ? ' active' : ''}" data-nd-pick="${p.sku}" data-nd-slot="${slot}">${htmlSafe(p.name)}</button></li>`,
			)
			.join('');
		return `<div class="dropdown nd-swap"><button type="button" class="btn btn-sm nd-swap-btn" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="Swap this product"><i class="bi bi-arrow-left-right" aria-hidden="true"></i>Swap</button><ul class="dropdown-menu dropdown-menu-end nd-swap-menu">${items}</ul></div>`;
	}

	function tileHtml(sku, at) {
		const p = CAT.find(sku);
		if (!p) return '';
		const price = p.per ? `${money(p.price)} a month` : money(p.price);
		const inner = `<img class="nd-tile-img" src="${photo(p.photo, 400, 400)}" alt="${htmlSafe(p.name)}" width="400" height="400" loading="lazy"><span class="nd-tile-name">${htmlSafe(p.name)}</span><span class="nd-tile-price">${p.was ? `<s>${money(p.was)}</s> ` : ''}${price}</span>`;
		if (editable()) return `<div class="nd-tile">${inner}${swapMenu(at, sku)}</div>`;
		return `<a class="nd-tile" href="${productUrl(sku)}" data-link="${sku}">${inner}${hit(sku)}</a>`;
	}
	function paintMail() {
		D('from-name').textContent = NL.from.name;
		D('from-email').textContent = NL.from.email;
		for (const [key, field] of [
			['inbox-subject', 'subject'],
			['inbox-pre', 'preheader'],
		]) {
			const box = D(key);
			box.textContent = n[field];
			box.removeAttribute('contenteditable');
			if (editable()) {
				box.contentEditable = 'plaintext-only';
				box.spellcheck = true;
				box.setAttribute('role', 'textbox');
				box.setAttribute('aria-label', FIELDS[field].label);
				box.dataset.ndField = field;
			}
		}
		const hero = CAT.find(n.hero);
		const heroImg = hero
			? `<img src="${photo(hero.photo, 1200, 640)}" alt="${htmlSafe(hero.name)}" width="1200" height="640">`
			: '';
		const heroHtml = !hero
			? ''
			: editable()
				? `<div class="nd-sheet-hero">${heroImg}${swapMenu('hero', n.hero)}</div>`
				: `<a class="nd-sheet-hero" href="${productUrl(n.hero)}" data-link="${n.hero}-hero">${heroImg}</a>`;
		const cta = editable()
			? `<span class="nd-sheet-cta"${fieldAttrs('cta')}>${htmlSafe(n.cta)}</span>`
			: `<a class="nd-sheet-cta" href="storefront.html" data-link="cta">${htmlSafe(n.cta)}</a>${hit('cta')}`;
		D('mail').innerHTML =
			`<div class="nd-sheet${editable() ? ' is-editing' : ''}"><p class="nd-sheet-brand">Marlo</p>${heroHtml}<h3 class="nd-sheet-head"${fieldAttrs('headline')}>${htmlSafe(n.headline)}</h3><p class="nd-sheet-body"${fieldAttrs('body')}>${htmlSafe(n.body)}</p><span class="nd-sheet-cta-wrap">${cta}</span><div class="nd-tiles">${n.tiles.map(tileHtml).join('')}</div><p class="nd-sheet-foot">You get this because you signed up at marlo.shop.<br>Marlo, tailoring and eveningwear made in small runs. <span class="nd-sheet-unsub">Unsubscribe</span></p></div>`;
		D('clicks-switch').hidden = n.status !== 'sent';
		D('email-sub').textContent =
			n.status === 'sent' ? 'As subscribers saw it.' : 'Click any words to change them, or swap a product.';
		D('save').hidden = !editable();
		D('saved').hidden = !editable();
	}

	/* Clicks by link, or the test sends */
	function linkName(key) {
		if (key === 'cta') return `Button: ${n.cta}`;
		const p = CAT.find(key);
		return p ? p.name : key;
	}
	function paintLinks() {
		if (n.status === 'sent') {
			const total = n.links.reduce((s, l) => s + l[1], 0);
			const max = n.links[0][1];
			D('links-title').textContent = 'Clicks by link';
			D('links-sub').textContent = `${num(total)} clicks from ${num(n.results.clicked)} people.`;
			D('links').innerHTML = `<ul class="nd-links">${n.links
				.map(
					(l, i) =>
						`<li data-key="${l[0]}" style="--nd-tone: var(--basalt-series-${i + 1})"><span class="nd-links-name">${htmlSafe(linkName(l[0]))}</span><span class="nd-links-n">${num(l[1])}<span class="nd-links-pct">${Math.round((l[1] / total) * 100)}%</span></span><span class="nd-links-bar" aria-hidden="true"><span style="--nd-fill:${((l[1] / max) * 100).toFixed(1)}%"></span></span></li>`,
				)
				.join('')}</ul>`;
			return;
		}
		D('links-title').textContent = 'Test sends';
		D('links-sub').textContent = 'Check it on a phone before it goes out.';
		D('links').innerHTML = n.tests.length
			? `<ul class="nd-tests">${n.tests
					.slice()
					.reverse()
					.map(
						(t) =>
							`<li><span class="nd-tests-icon" aria-hidden="true"><i class="bi bi-envelope-check"></i></span><span class="nd-tests-to">${htmlSafe(t[0])}</span><span class="nd-tests-when">${day(t[1])}, ${clock(t[1])}</span></li>`,
					)
					.join('')}</ul>`
			: `<div class="basalt-empty basalt-empty-compact basalt-empty-muted nd-empty"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi bi-envelope"></i></span><p class="basalt-empty-title">No tests yet</p><p class="basalt-empty-text">Send one to yourself to see it in a real inbox.</p></div>`;
	}

	/* Audience and send time */
	function paintFacts() {
		const a = AUDIENCES[n.audience];
		D('send-sub').textContent = `${a.note}.`;
		const rows = [
			[
				'Send to',
				`${htmlSafe(a.label)}<span class="nd-facts-note">${num(n.results ? n.results.sent : a.size)} people</span>`,
			],
			[
				n.status === 'sent' ? 'Sent' : 'Goes out',
				n.at
					? `${weekday(n.at)}, 2026 at ${clock(n.at)}<span class="nd-facts-note">in each subscriber’s time zone</span>`
					: 'Not scheduled',
			],
			['From', `${htmlSafe(NL.from.name)}<span class="nd-facts-note">${htmlSafe(NL.from.email)}</span>`],
			['Written by', htmlSafe(n.author)],
			['Discount code', /SCULPT20/.test(n.preheader) ? '<span class="nd-code">SCULPT20</span>' : ''],
		].filter((r) => r[1]);
		D('facts').innerHTML = rows.map((r) => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('');
	}

	function paint() {
		paintHead();
		paintBand();
		paintMail();
		paintLinks();
		paintFacts();
	}

	/* Editing in place */
	function markUnsaved(on) {
		unsaved = on;
		D('save').disabled = !on;
		D('saved').classList.toggle('is-unsaved', on);
		D('saved-text').textContent = on ? 'Unsaved changes' : 'Saved';
	}

	function wireEditing() {
		const email = pick('.nd-email');
		email.addEventListener('beforeinput', (e) => {
			const box = e.target.closest?.('[data-nd-field]');
			if (!box) return;
			const rule = FIELDS[box.dataset.ndField];
			if (e.inputType === 'insertParagraph' || (e.inputType === 'insertLineBreak' && !rule.lines)) {
				e.preventDefault();
				return;
			}
			const adding = (e.data || '').length;
			const chosen = window.getSelection()?.toString().length || 0;
			if (e.inputType.startsWith('insert') && box.textContent.length - chosen + adding > rule.max)
				e.preventDefault();
		});
		email.addEventListener('input', (e) => {
			const box = e.target.closest?.('[data-nd-field]');
			if (!box) return;
			const field = box.dataset.ndField;
			n[field] = box.textContent.slice(0, FIELDS[field].max);
			if (field === 'subject') {
				D('subject').textContent = n.subject || 'Untitled';
				document.title = `${n.subject || 'Untitled'} · Basalt`;
			}
			markUnsaved(true);
		});
		email.addEventListener('click', (e) => {
			const choice = e.target.closest('[data-nd-pick]');
			if (!choice) return;
			const slot = choice.dataset.ndSlot;
			if (slot === 'hero') n.hero = choice.dataset.ndPick;
			else n.tiles[Number(slot)] = choice.dataset.ndPick;
			paintMail();
			markUnsaved(true);
		});
		D('save').addEventListener('click', () => {
			n.edited = [TODAY, 'John Armstrong'];
			paintHead();
			markUnsaved(false);
			toast({ tone: 'success', icon: 'bi-floppy', title: 'Saved', text: `“${n.subject}” is saved.` });
		});
		window.addEventListener('beforeunload', (e) => {
			if (unsaved) e.preventDefault();
		});
	}

	/* Actions */
	function start() {
		paint();
		wireEditing();

		/* Clicks on the email: numbers on each link, and the list lights up
       its link in the email on hover. */
		D('show-clicks').addEventListener('change', (e) => D('mail').classList.toggle('show-clicks', e.target.checked));
		D('links').addEventListener('mouseover', (e) => {
			const li = e.target.closest('li[data-key]');

			for (const x of pickAll('.is-lit', D('mail'))) {
				x.classList.remove('is-lit');
			}

			if (!li) return;
			const key = li.getAttribute('data-key');

			for (const x of pickAll(`[data-link="${key}"]`, D('mail'))) {
				x.classList.add('is-lit');
			}
		});
		D('links').addEventListener('mouseleave', () =>
			pickAll('.is-lit', D('mail')).forEach((x) => x.classList.remove('is-lit')),
		);

		/* Duplicate opens the copy, a draft of the same email. */
		D('duplicate').addEventListener('click', () => {
			location.href = `newsletter-details.html?id=nl-122&copy=${encodeURIComponent(source ? source.id : n.id)}`;
		});

		/* Send a test. */
		const testModal = pick('#nd-test');
		const testForm = D('test-form');
		const to = testForm.elements.to;
		testForm.addEventListener('submit', (e) => {
			e.preventDefault();
			const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.value.trim());
			to.classList.toggle('is-invalid', !ok);
			if (!ok) {
				to.focus();
				return;
			}
			n.tests.push([to.value.trim(), `${TODAY} ${new Date().toTimeString().slice(0, 5)}`]);
			bootstrap.Modal.getOrCreateInstance(testModal).hide();
			if (n.status !== 'sent') {
				paintBand();
				paintLinks();
			}
			toast({
				tone: 'success',
				icon: 'bi-envelope-check',
				title: 'Test sent',
				text: `It should be with ${to.value.trim()} within a minute.`,
			});
		});
		to.addEventListener('input', () => to.classList.remove('is-invalid'));
		testModal.addEventListener('shown.bs.modal', () => to.focus());

		/* Schedule, or move the send. */
		const schModal = pick('#nd-schedule');
		const schForm = D('schedule-form');
		const dayWrap = D('day');
		schModal.addEventListener('show.bs.modal', () => {
			D('audience').value = n.audience;
			D('audience').dispatchEvent(new Event('change', { bubbles: true }));
			const when = n.at && daysLeft(n.at) >= 0 ? n.at : '2026-10-13 09:00';
			if (window.Basalt.datepicker) window.Basalt.datepicker.set(dayWrap, when.slice(0, 10));
			D('time').value = when.slice(11, 16);
			D('time').dispatchEvent(new Event('change', { bubbles: true }));
		});
		schForm.addEventListener('submit', (e) => {
			e.preventDefault();
			const picked = window.Basalt.datepicker
				? window.Basalt.datepicker.get(dayWrap)
				: schForm.elements.day.value;
			const input = pick('#nd-day');
			if (!picked || picked < TODAY) {
				input.classList.add('is-invalid');
				input.focus();
				return;
			}
			input.classList.remove('is-invalid');
			const moved = n.status === 'scheduled';
			n.status = 'scheduled';
			n.at = `${picked} ${D('time').value}`;
			n.audience = D('audience').value;
			bootstrap.Modal.getOrCreateInstance(schModal).hide();
			paint();
			toast({
				tone: 'success',
				icon: 'bi-calendar-check',
				title: moved ? 'Send moved' : 'Scheduled',
				text: `Goes out ${weekday(n.at)} at ${clock(n.at)} to ${AUDIENCES[n.audience].label}.`,
			});
		});
	}

	document.addEventListener('DOMContentLoaded', start);
})();
