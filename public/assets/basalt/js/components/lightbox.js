/**
 * Component script for the image and video lightbox. It loads after assets/basalt/js/basalt.js, and
 * only on the pages that use it; documentation.html#page-map lists them.
 */

/* 
   Lightbox
   Markup is shown on lightbox.html. A link or button with
   [data-basalt-lightbox] opens its picture or video large in a dialog;
   the ones sharing a value form a group that the arrows, the ← → keys
   (Home and End too) and a sideways swipe step through, in page order.
     href or data-basalt-src          the full-size file
     data-basalt-type="video|embed"   a video file or an iframe (YouTube,
         Vimeo); pictures need nothing
     data-basalt-title, data-basalt-caption   the caption under it
     alt on the thumbnail's <img>     the picture's alt text
   The dialog is .basalt-viewer, built on first use. (The Modals page's
   [data-basalt-lightbox-set] is the simpler one you write the dialog for.)
   From code: window.Basalt.lightbox.open(items, index), where each item
   is { src, type, title, caption, alt }. Fires 'basalt:lightbox' on the
   dialog with { index, item } each time it shows a file.
    */
(() => {
	'use strict';
	if (!window.bootstrap) return;
	let dialog = null;
	let items = [];
	let index = 0;
	let opener = null;

	function htmlSafe(s) {
		return String(s == null ? '' : s).replace(
			/[&<>"]/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
		);
	}

	function build() {
		if (dialog) return dialog;
		const el = document.createElement('div');
		el.className = 'modal fade basalt-viewer';
		el.id = 'basalt-viewer';
		el.tabIndex = -1;
		el.setAttribute('role', 'dialog');
		el.setAttribute('aria-labelledby', 'basalt-viewer-title');
		el.setAttribute('aria-hidden', 'true');
		el.innerHTML = `<div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="basalt-viewer-bar"><p class="basalt-viewer-count" aria-live="polite" data-lb="count"></p><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="basalt-viewer-stage" data-lb="stage"><figure class="basalt-viewer-media" data-lb="media"></figure><button type="button" class="basalt-viewer-nav basalt-viewer-nav-prev" aria-label="Previous" data-lb-step="-1"><i class="bi bi-chevron-left" aria-hidden="true"></i></button><button type="button" class="basalt-viewer-nav basalt-viewer-nav-next" aria-label="Next" data-lb-step="1"><i class="bi bi-chevron-right" aria-hidden="true"></i></button></div><div class="basalt-viewer-caption" data-lb="caption"><h2 class="basalt-viewer-title" id="basalt-viewer-title" data-lb="title"></h2><p class="basalt-viewer-text" data-lb="text"></p></div></div></div>`;
		document.body.appendChild(el);

		function part(k) {
			return el.querySelector(`[data-lb="${k}"]`);
		}

		for (const b of el.querySelectorAll('[data-lb-step]')) {
			b.addEventListener('click', () => step(Number(b.getAttribute('data-lb-step'))));
		}

		el.addEventListener('keydown', (e) => {
			if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
			if (e.target.closest('input, textarea, select, video, iframe')) return;
			if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
				e.preventDefault();
				step(e.key === 'ArrowLeft' ? -1 : 1);
			} else if (e.key === 'Home' || e.key === 'End') {
				e.preventDefault();
				show(e.key === 'Home' ? 0 : items.length - 1, e.key === 'Home' ? -1 : 1);
			}
		});
		/* A sideways swipe on the stage steps too. */
		const stage = part('stage');
		let touch = null;
		stage.addEventListener(
			'touchstart',
			(e) => {
				touch = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
			},
			{ passive: true },
		);
		stage.addEventListener(
			'touchend',
			(e) => {
				if (!touch) return;
				const dx = e.changedTouches[0].clientX - touch.x;
				const dy = e.changedTouches[0].clientY - touch.y;
				touch = null;
				if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
			},
			{ passive: true },
		);
		/* Closing stops a video and puts the focus back where it was. */
		el.addEventListener('hidden.bs.modal', () => {
			part('media').innerHTML = '';
			if (opener && opener.isConnected) opener.focus();
			opener = null;
		});
		dialog = { el, part };
		return dialog;
	}

	function stageHtml(item) {
		if (item.type === 'video')
			return `<video src="${htmlSafe(item.src)}" controls playsinline preload="metadata"${item.poster ? ` poster="${htmlSafe(item.poster)}"` : ''}></video>`;
		if (item.type === 'embed')
			return `<iframe src="${htmlSafe(item.src)}" title="${htmlSafe(item.title || 'Video')}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
		return `<img src="${htmlSafe(item.src)}" alt="${htmlSafe(item.alt)}">`;
	}
	function preload(item) {
		if (item && (!item.type || item.type === 'image')) new Image().src = item.src;
	}

	function show(i, dir) {
		if (i < 0 || i >= items.length) return;
		index = i;
		const item = items[i];
		const { el, part } = dialog;
		const media = part('media');
		media.className = `basalt-viewer-media${dir ? ` is-stepping${dir < 0 ? ' is-back' : ''}` : ''}`;
		media.innerHTML = stageHtml(item);
		if (dir) {
			media.style.animation = 'none';
			void media.offsetWidth;
			media.style.animation = '';
		}
		part('count').textContent = items.length > 1 ? `${i + 1} of ${items.length}` : '';
		part('title').textContent = item.title || item.alt || '';
		part('text').textContent = item.caption || '';
		part('caption').hidden = !item.title && !item.alt && !item.caption;

		for (const b of el.querySelectorAll('[data-lb-step]')) {
			const to = i + Number(b.getAttribute('data-lb-step'));
			b.hidden = items.length < 2;
			b.disabled = to < 0 || to >= items.length;
		}

		/* Stepping onto either end disables the button under the focus. */
		if (document.activeElement && document.activeElement.disabled) {
			const other = el.querySelector('[data-lb-step]:not(:disabled)');
			(other || el.querySelector('.btn-close')).focus();
		}
		preload(items[i + 1]);
		preload(items[i - 1]);
		el.dispatchEvent(new CustomEvent('basalt:lightbox', { bubbles: true, detail: { index: i, item } }));
	}
	function step(by) {
		show(index + by, by);
	}

	function open(list, start, from) {
		if (!list || !list.length) return;
		build();
		items = list;
		opener = from || document.activeElement;
		show(Math.min(Math.max(0, start || 0), list.length - 1));
		bootstrap.Modal.getOrCreateInstance(dialog.el).show();
	}

	/* What a trigger opens, read from its attributes. */
	function itemOf(t) {
		const img = t.querySelector('img');
		return {
			src: t.getAttribute('data-basalt-src') || t.getAttribute('href'),
			type: t.getAttribute('data-basalt-type') || 'image',
			title: t.getAttribute('data-basalt-title') || '',
			caption: t.getAttribute('data-basalt-caption') || '',
			alt: t.getAttribute('data-basalt-alt') || (img ? img.getAttribute('alt') : '') || '',
			poster: t.getAttribute('data-basalt-poster') || '',
		};
	}
	document.addEventListener('click', (e) => {
		const t = e.target.closest && e.target.closest('[data-basalt-lightbox]');
		if (!t || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		e.preventDefault();
		const group = t.getAttribute('data-basalt-lightbox');
		const all = group
			? Array.from(document.querySelectorAll('[data-basalt-lightbox]')).filter(
					(x) => x.getAttribute('data-basalt-lightbox') === group,
				)
			: [t];
		open(all.map(itemOf), all.indexOf(t), t);
	});

	window.Basalt.lightbox = {
		open: (list, start) => open(list, start),
		close: () => {
			if (dialog) bootstrap.Modal.getOrCreateInstance(dialog.el).hide();
		},
		next: () => step(1),
		prev: () => step(-1),
	};
})();
