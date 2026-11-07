/**
 * Basalt - Legal pages (privacy-policy.html, terms-of-service.html)
 * Lights the table of contents entry for the section being read,
 * works out the reading time from the text, so it stays right when
 * you paste in your own, and prints the page.
 * Edit turns the text into an editor: bold, italic, lists and new
 * sections. Publish asks when the new text takes effect, then
 * renumbers the sections, rebuilds the contents list and moves the
 * dates in the header.
 */
(() => {
	'use strict';
	const root = pick('[data-legal-root]', document);
	if (!root) return;

	function start() {
		toolbar.addEventListener('mousedown', (e) => {
			if (e.target.closest('.legal-tool')) e.preventDefault();
		});

		for (const b of pickAll('[data-legal-cmd]', toolbar)) {
			b.addEventListener('click', () => {
				restore();
				try {
					document.execCommand(b.getAttribute('data-legal-cmd'), false, null);
				} catch {
					/* unsupported command */
				}
				remember();
				syncTools();
			});
		}

		/* The contents list follows the headings as you type them. */
		let tocTimer = 0;
		prose.addEventListener('input', () => {
			remember();
			clearTimeout(tocTimer);
			tocTimer = setTimeout(rebuildToc, 300);
		});
		prose.addEventListener('keyup', () => {
			remember();
			syncTools();
		});
		prose.addEventListener('mouseup', () => {
			remember();
			syncTools();
		});
		/* Pasted text comes in plain, so it takes on the page's own styles. */
		prose.addEventListener('paste', (e) => {
			if (!editing || !e.clipboardData) return;
			e.preventDefault();
			document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
		});
		/* Links still work as links while the rest is being edited. */
		prose.addEventListener('click', (e) => {
			if (editing && e.target.closest('a')) e.preventDefault();
		});

		/* A new section goes after the one you are in; from the opening
	     paragraph it goes just before Contact us, which stays last. */
		pick('[data-legal-add]', toolbar).addEventListener('click', () => {
			const at = range && prose.contains(range.startContainer) ? range.startContainer : null;
			const here = at && (at.nodeType === 1 ? at : at.parentElement).closest('section[id]');
			const sections = sectionsOf();
			const last = sections[sections.length - 1];
			const s = document.createElement('section');
			s.id = `new-section-${sections.length + 1}`;
			s.setAttribute('data-legal-new', '');
			s.innerHTML = '<h2>New section</h2><p>Write this section here.</p>';
			if (here && here !== last) here.after(s);
			else if (last) last.before(s);
			else prose.appendChild(s);
			renumber();
			rebuildToc();
			const h = pick('h2', s);
			const r = document.createRange();
			r.selectNodeContents(h.lastChild);
			r.setStart(h.lastChild, h.textContent.indexOf('New'));
			const sel = window.getSelection();
			prose.focus({ preventScroll: true });
			sel.removeAllRanges();
			sel.addRange(r);
			remember();
			s.scrollIntoView({
				block: 'center',
				behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
			});
			if (window.Basalt.announce)
				window.Basalt.announce(`Section ${sectionsOf().indexOf(s) + 1} added. Type its heading.`);
		});

		/* Publishing */
		const dialog = window.bootstrap ? window.bootstrap.Modal.getOrCreateInstance(dialogEl) : null;
		const form = pick('[data-legal-publish-form]', dialogEl);
		const notify = pick('[data-legal-notify]', dialogEl);
		const noteWrap = pick('[data-legal-note-wrap]', dialogEl);
		const note = pick('[data-legal-note]', dialogEl);
		const effectInput = pick('[data-legal-effect-pick] input[type="hidden"]', dialogEl);
		notify.addEventListener('change', () => {
			window.Basalt.slide(noteWrap, () => {
				noteWrap.hidden = !notify.checked;
			});
		});

		publishBtn.addEventListener('click', () => {
			if (prose.innerHTML === saved) {
				toast({ tone: 'info', title: 'Nothing to publish', text: 'You haven’t changed the text yet.' });
				return;
			}
			if (dialog) dialog.show();
		});

		form.addEventListener('submit', (e) => {
			e.preventDefault();
			const effect = (effectInput && effectInput.value) || TODAY;
			fixIds();
			renumber();
			rebuildToc();
			readingTime();
			setDate(pick('[data-legal-updated]'), TODAY);
			setDate(pick('[data-legal-effect]'), effect);
			setMode(false);
			if (dialog) dialog.hide();
			toast({
				tone: 'success',
				title: `${title} published`,
				text: `Takes effect ${usDate(effect)}.${notify.checked ? ' Account owners get an email today.' : ''}`,
			});
			form.reset();
			note.value = '';
			noteWrap.hidden = false;
			editButton.focus();
		});
	}

	function pick(selector, scope = root) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = root) {
		return [...scope.querySelectorAll(selector)];
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	const prose = pick('[data-legal-prose]');
	const toc = pick('[data-legal-toc]');
	const title = (pick('.basalt-hero-title') || {}).textContent || 'This page';
	const TODAY = '2026-10-09';
	let editing = false;

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	function usDate(iso) {
		const [y, m, d] = iso.split('-').map(Number);
		return `${MONTHS[m - 1]} ${d}, ${y}`;
	}

	function setDate(el, iso) {
		if (el) el.innerHTML = `<time datetime="${iso}">${usDate(iso)}</time>`;
	}

	/* About 230 words a minute for careful reading. */
	const read = pick('[data-legal-read]');
	function readingTime() {
		if (!read || !prose) return;
		const words = prose.textContent.trim().split(/\s+/).length;
		read.textContent = `${Math.max(1, Math.round(words / 230))} min`;
	}
	readingTime();

	const print = pick('[data-legal-print]');
	if (print) print.addEventListener('click', () => window.print());

	if (!toc || !prose) return;

	function sectionsOf() {
		return pickAll('section[id]', prose);
	}

	function linksOf() {
		return pickAll('a[href^="#"]', toc);
	}

	function light(id) {
		linksOf().forEach((a) => {
			const on = a.getAttribute('href') === `#${id}`;
			a.classList.toggle('is-current', on);
			if (on) a.setAttribute('aria-current', 'location');
			else a.removeAttribute('aria-current');
		});
	}

	/* The current section is the last one whose top has passed a line a
     third of the way down the window. */
	let ticking = false;
	function update() {
		ticking = false;
		const sections = sectionsOf();
		const line = window.innerHeight / 3;
		let current = sections[0];
		sections.forEach((s) => {
			if (s.getBoundingClientRect().top <= line) current = s;
		});
		const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
		if (atEnd) current = sections[sections.length - 1];
		if (current) light(current.id);
	}
	window.addEventListener(
		'scroll',
		() => {
			if (!ticking) {
				ticking = true;
				requestAnimationFrame(update);
			}
		},
		{ passive: true },
	);
	window.addEventListener('resize', update);

	/* A section opened from the list takes focus on its heading, so
     keyboard and screen reader users land where they asked to go. */
	toc.addEventListener('click', (e) => {
		const a = e.target.closest('a[href^="#"]');
		if (!a) return;
		const target = document.getElementById(a.getAttribute('href').slice(1));
		const heading = target && pick('h2', target);
		if (heading && !editing) {
			heading.setAttribute('tabindex', '-1');
			setTimeout(() => heading.focus({ preventScroll: true }), 0);
		}
	});

	update();

	/* Editing */
	const editButton = pick('[data-legal-edit]');
	const cancelBtn = pick('[data-legal-cancel]');
	const publishBtn = pick('[data-legal-publish]');
	const toolbar = pick('[data-legal-toolbar]');
	const dialogEl = document.getElementById('legal-publish');
	if (!editButton || !toolbar || !dialogEl) return;

	let saved = '';
	let range = null;

	function headingText(h) {
		return h.textContent.replace(/^\s*\d+\.\s*/, '').trim();
	}

	function slug(t) {
		return (
			t
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '') || 'section'
		);
	}

	/* Numbers the headings in order and lists them in the contents. */
	function renumber() {
		sectionsOf().forEach((s, i) => {
			const h = pick('h2', s);
			if (h) h.textContent = `${i + 1}. ${headingText(h)}`;
		});
	}
	function rebuildToc() {
		toc.innerHTML = sectionsOf()
			.map((s) => {
				const h = pick('h2', s);
				const a = document.createElement('a');
				a.href = `#${s.id}`;
				a.textContent = h ? headingText(h) : s.id;
				return `<li>${a.outerHTML}</li>`;
			})
			.join('');
		update();
	}
	/* A section a person added or emptied gets an id from its heading. */
	function fixIds() {
		const used = new Set();
		sectionsOf().forEach((s) => {
			const h = pick('h2', s);
			if (s.hasAttribute('data-legal-new') && h) {
				let id = slug(headingText(h));
				while (used.has(id) || (document.getElementById(id) && document.getElementById(id) !== s)) id += '-2';
				s.id = id;
				h.id = `${id}-h`;
				s.setAttribute('aria-labelledby', h.id);
				s.removeAttribute('data-legal-new');
			}
			used.add(s.id);
		});
	}

	function setMode(on) {
		editing = on;
		root.classList.toggle('is-editing', on);
		prose.contentEditable = on ? 'true' : 'false';
		if (on) {
			prose.setAttribute('role', 'textbox');
			prose.setAttribute('aria-multiline', 'true');
			prose.setAttribute('aria-label', `${title} text`);
		} else {
			for (const a of ['contenteditable', 'role', 'aria-multiline', 'aria-label']) {
				prose.removeAttribute(a);
			}
		}
		toolbar.hidden = !on;
		editButton.hidden = on;
		if (print) print.hidden = on;
		cancelBtn.hidden = !on;
		publishBtn.hidden = !on;
	}

	editButton.addEventListener('click', () => {
		saved = prose.innerHTML;
		try {
			document.execCommand('defaultParagraphSeparator', false, 'p');
		} catch {
			/* older engines */
		}
		setMode(true);
		const first = pick('p', prose);
		prose.focus({ preventScroll: true });
		if (first) {
			const r = document.createRange();
			r.selectNodeContents(first);
			r.collapse(true);
			const sel = window.getSelection();
			sel.removeAllRanges();
			sel.addRange(r);
		}
		if (window.Basalt.announce) window.Basalt.announce('Editing. Change any text, then publish.');
	});

	cancelBtn.addEventListener('click', () => {
		const changed = prose.innerHTML !== saved;
		prose.innerHTML = saved;
		setMode(false);
		rebuildToc();
		editButton.focus();
		if (changed) toast({ tone: 'info', title: 'Changes discarded', text: `${title} is as it was.` });
	});

	/* Formatting */
	function remember() {
		const sel = window.getSelection();
		if (sel.rangeCount && prose.contains(sel.anchorNode)) range = sel.getRangeAt(0).cloneRange();
	}
	function restore() {
		prose.focus({ preventScroll: true });
		if (!range || !prose.contains(range.startContainer)) return;
		const sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
	}
	function syncTools() {
		const sel = window.getSelection();
		if (!sel.rangeCount || !prose.contains(sel.anchorNode)) return;
		const node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
		const inHeading = !!(node && node.closest('h2') && !node.closest('strong, b'));

		for (const b of pickAll('[data-legal-cmd][aria-pressed]', toolbar)) {
			let on;
			try {
				on = document.queryCommandState(b.getAttribute('data-legal-cmd'));
			} catch {
				on = false;
			}
			/* Headings are bold by their own style, not by a format you applied. */
			if (on && b.getAttribute('data-legal-cmd') === 'bold' && inHeading) on = false;
			b.setAttribute('aria-pressed', String(on));
		}
	}
	start();
})();
