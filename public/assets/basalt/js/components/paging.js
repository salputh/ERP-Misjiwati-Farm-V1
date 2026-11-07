/**
 * Component script for paging helpers. It loads after assets/basalt/js/basalt.js, and
 * only on the pages that use it; documentation.html#page-map lists them.
 */

/**
 * Paging helpers, demonstrated on pagination.html. The page that owns
 * the rows calls them, since only it knows how to fetch more.
 *   Basalt.pageWindow(current, total, around)  which page numbers to show,
 *     with 'gap' standing in for the runs left out
 *   Basalt.pagination(list, opts)  a Bootstrap .pagination with gaps and
 *     first, previous, next and last controls
 *   Basalt.pager(root, opts)  a .basalt-pager table footer: rows per page,
 *     the range in view, page buttons and a jump-to field
 *   Basalt.loadMore(root, opts)  a .basalt-loadmore button with a progress
 *     meter, placeholder rows and a finished state
 *   Basalt.infinite(root, opts)  a .basalt-infinite box that loads as its
 *     end scrolls into view, with a switch back to a button
 *   Basalt.dots(root, onChange)  .basalt-dots for slides and steps, driven
 *     by the arrow keys too
 */
(() => {
	'use strict';
	function quick() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/* Basalt.pageWindow and its siblings are published first; the function
     declarations below are hoisted, so the names are ready at this point. */
	Object.assign(window.Basalt, {
		pageWindow,
		pagination,
		pager,
		loadMore,
		infinite,
		dots,
	});

	/* Arrow keys step one dot at a time; Home and End are handled apart. */
	const DOT_STEPS = new Map([
		['ArrowRight', 1],
		['ArrowDown', 1],
		['ArrowLeft', -1],
		['ArrowUp', -1],
	]);

	/**
	 * Works out which page numbers a pager row should show.
	 * Page 1 and the last page always appear, as do `around` pages on each
	 * side of `current` (one when left out). Near either end the row is padded
	 * so its length holds steady. A hole of one page is filled with that page;
	 * a wider hole becomes the string 'gap'.
	 * @param {number} current  the page on screen
	 * @param {number} total    how many pages exist
	 * @param {number} [around] neighbors to keep beside `current`
	 * @returns {Array<number|'gap'>}
	 */
	function pageWindow(current, total, around) {
		const reach = around ?? 1;
		const wanted = new Set([1, total]);
		function keepSpan(from, to) {
			for (let page = Math.max(1, from); page <= Math.min(total, to); page += 1) wanted.add(page);
		}
		keepSpan(current - reach, current + reach);
		if (current <= reach + 2) keepSpan(1, reach * 2 + 3);
		if (current >= total - reach - 1) keepSpan(total - reach * 2 - 2, total);

		const ordered = [...wanted].sort((left, right) => left - right);
		return ordered.flatMap((page, at) => {
			const hole = at === 0 ? 1 : page - ordered[at - 1];
			if (hole === 2) return [page - 1, page];
			return hole > 2 ? ['gap', page] : [page];
		});
	}

	/**
	 * Renders numbered page buttons into a `<ul class="pagination">` and
	 * redraws it on every move, putting focus back on the control in use.
	 * Each real change calls `onChange(page)` and fires `basalt:pagechange`
	 * (bubbling, `detail.page`) on the list.
	 * @param {HTMLElement} list
	 * @param {{ total?: number, current?: number, around?: number,
	 *   label?: string, onChange?: function(number) }} opts
	 * @returns {{ set: function(number), setTotal: function(number),
	 *   get: function(): number, total: function(): number }}
	 */
	function pagination(list, opts) {
		const caption = opts.label || 'Page';
		let pageCount = Math.max(1, opts.total || 1);
		let page = Math.min(Math.max(1, opts.current || 1), pageCount);

		list.addEventListener('click', onPick);
		paint();

		return {
			set: (target) => goTo(target),
			setTotal(count) {
				pageCount = Math.max(1, count);
				page = Math.min(page, pageCount);
				paint();
			},
			get: () => page,
			total: () => pageCount,
		};

		/* Previous and Next keep focus on themselves; a number hands it to the
       page that was picked. */
		function onPick(event) {
			const control = event.target.closest('[data-page]');
			if (!control || control.disabled) return;
			const key = control.getAttribute('data-page');
			if (key === 'prev' || key === 'next') {
				goTo(key === 'prev' ? page - 1 : page + 1, key);
				return;
			}
			const target = parseInt(key, 10);
			goTo(target, String(target));
		}

		function goTo(target, focusKey) {
			const next = Math.min(Math.max(1, target), pageCount);
			const moved = next !== page;
			page = next;
			paint(focusKey);
			if (!moved) return;
			opts.onChange?.(page);
			list.dispatchEvent(new CustomEvent('basalt:pagechange', { bubbles: true, detail: { page } }));
		}

		function paint(focusKey) {
			const atFirst = page === 1;
			const atLast = page === pageCount;
			list.replaceChildren(
				pageCell({
					state: atFirst ? 'disabled' : '',
					html: '<i class="bi bi-chevron-left" aria-hidden="true"></i><span class="visually-hidden">Previous page</span>',
					attrs: { 'data-page': 'prev', ...(atFirst && { disabled: '' }) },
				}),
				...pageWindow(page, pageCount, opts.around).map(numberCell),
				pageCell({
					state: atLast ? 'disabled' : '',
					html: '<span class="visually-hidden">Next page</span><i class="bi bi-chevron-right" aria-hidden="true"></i>',
					attrs: { 'data-page': 'next', ...(atLast && { disabled: '' }) },
				}),
			);
			if (!focusKey) return;
			const landing =
				list.querySelector(`[data-page="${focusKey}"]:not(:disabled)`) ||
				list.querySelector('[aria-current="page"]');
			landing?.focus();
		}

		function numberCell(entry) {
			if (entry === 'gap') {
				return pageCell({
					tag: 'span',
					state: 'disabled is-gap',
					html: '<span aria-hidden="true">…</span><span class="visually-hidden">Pages left out</span>',
				});
			}
			const here = entry === page;
			return pageCell({
				state: here ? 'active' : '',
				text: String(entry),
				attrs: {
					'aria-label': `${caption} ${entry}`,
					'data-page': String(entry),
					...(here && { 'aria-current': 'page' }),
				},
			});
		}
	}

	/** One `li.page-item` holding a `.page-link` button, or a span for a gap. */
	function pageCell({ tag = 'button', state = '', html, text, attrs = {} }) {
		const control = document.createElement(tag);
		control.className = 'page-link';
		if (tag === 'button') control.type = 'button';
		for (const [name, value] of Object.entries(attrs)) control.setAttribute(name, value);
		if (html === undefined) control.textContent = text;
		else control.innerHTML = html;

		const cell = document.createElement('li');
		cell.className = state ? `page-item ${state}` : 'page-item';
		cell.append(control);
		return cell;
	}

	/**
	 * Turns a table footer into a working pager: a rows-per-page select,
	 * the "1–10 of 137" line, the page buttons and a jump-to form. It reads
	 * `opts.total` afresh on every draw, so a caller can change it in place.
	 * Hooks inside root: [data-basalt-pager-size], [data-basalt-pager-range],
	 * [data-basalt-pager-pages], [data-basalt-pager-jump] and
	 * [data-basalt-pager-error].
	 * @param {HTMLElement} root
	 * @param {{ total: number, perPage?: number, noun?: string,
	 *   render?: function(number, number) }} opts  render gets 1-based row bounds
	 * @returns the Basalt.pagination controller for the page buttons
	 */
	function pager(root, opts) {
		function hook(part) {
			return root.querySelector(`[data-basalt-pager-${part}]`);
		}
		const sizeSelect = hook('size');
		const rangeLine = hook('range');
		const pageList = hook('pages');
		const jumpForm = hook('jump');
		const errorNote = hook('error');
		const jumpField = jumpForm?.querySelector('input');
		let pageSize = parseInt(sizeSelect?.value || opts.perPage || 10, 10);

		const buttons = pagination(pageList, { total: pageTotal(), current: 1, label: 'Page', onChange: paintRange });
		sizeSelect?.addEventListener('change', onSize);
		if (jumpForm) {
			jumpForm.addEventListener('submit', onJump);
			jumpField.addEventListener('input', clearJumpError);
		}
		paintRange(1);
		return buttons;

		function pageTotal() {
			return Math.max(1, Math.ceil(opts.total / pageSize));
		}

		function paintRange(page) {
			const first = (page - 1) * pageSize + 1;
			const last = Math.min(opts.total, page * pageSize);
			if (rangeLine) {
				rangeLine.innerHTML = `<strong>${groupDigits(first)}–${groupDigits(last)}</strong> of ${groupDigits(opts.total)} ${opts.noun || 'rows'}`;
			}
			if (jumpField) jumpField.max = String(pageTotal());
			opts.render?.(first, last);
		}

		/* A new page size keeps the row that was at the top still in view. */
		function onSize() {
			const topRow = (buttons.get() - 1) * pageSize;
			pageSize = parseInt(sizeSelect.value, 10);
			buttons.setTotal(pageTotal());
			buttons.set(Math.floor(topRow / pageSize) + 1);
			paintRange(buttons.get());
		}

		function onJump(event) {
			event.preventDefault();
			const wanted = parseInt(jumpField.value, 10);
			const outside = !Number.isFinite(wanted) || wanted < 1 || wanted > pageTotal();
			jumpField.classList.toggle('is-invalid', outside);
			jumpField.setAttribute('aria-invalid', String(outside));
			if (errorNote) {
				errorNote.hidden = !outside;
				errorNote.textContent = outside ? `Pick a page from 1 to ${pageTotal()}.` : '';
			}
			if (outside) {
				jumpField.focus();
				return;
			}
			jumpField.value = '';
			buttons.set(wanted);
			pageList.querySelector('[aria-current="page"]')?.focus();
		}

		function clearJumpError() {
			if (!jumpField.matches('.is-invalid')) return;
			jumpField.classList.remove('is-invalid');
			jumpField.removeAttribute('aria-invalid');
			if (errorNote) errorNote.hidden = true;
		}
	}

	function groupDigits(value) {
		return value.toLocaleString('en-US');
	}

	/**
	 * A list that grows by one batch per press of its button, with a progress
	 * meter, placeholder rows while a batch is on its way, and a closing note
	 * once everything is in. Hooks: [data-basalt-loadmore-list],
	 * [data-basalt-loadmore-btn] with [data-basalt-loadmore-label] inside it,
	 * [data-basalt-loadmore-status], [data-basalt-loadmore-bar] and
	 * [data-basalt-loadmore-done].
	 * @param {HTMLElement} root
	 * @param {{ total: number, batch: number, noun: string,
	 *   fetch: function(number, number): Promise<Element[]> }} opts
	 * @returns {{ reset: function(number) }} reset trims the list to n rows
	 */
	function loadMore(root, opts) {
		function hook(part) {
			return root.querySelector(`[data-basalt-loadmore-${part}]`);
		}
		const feed = hook('list');
		const trigger = hook('btn');
		const caption = trigger.querySelector('[data-basalt-loadmore-label]');
		const counter = hook('status');
		const meter = hook('bar');
		const finishedNote = hook('done');
		let loaded = feed.children.length;
		let pending = false;

		trigger.addEventListener('click', fetchBatch);
		report();

		return {
			reset(keep) {
				while (feed.children.length > keep) feed.lastElementChild.remove();
				loaded = feed.children.length;
				report();
			},
		};

		function report() {
			const remaining = opts.total - loaded;
			counter.innerHTML = `Showing <strong>${loaded}</strong> of ${opts.total} ${opts.noun}`;
			meter?.parentElement.style.setProperty(
				'--basalt-loadmore-done',
				`${((loaded / opts.total) * 100).toFixed(1)}%`,
			);
			caption.textContent = `Load ${Math.min(opts.batch, remaining)} more`;
			trigger.hidden = remaining <= 0;
			if (finishedNote) finishedNote.hidden = remaining > 0;
		}

		function fetchBatch() {
			if (pending) return;
			pending = true;
			const size = Math.min(opts.batch, opts.total - loaded);
			trigger.classList.add('is-loading');
			trigger.setAttribute('aria-disabled', 'true');
			feed.setAttribute('aria-busy', 'true');
			caption.textContent = 'Loading';
			const standIns = addPlaceholders(feed, Math.min(size, 3));
			opts.fetch(loaded, size).then((rows) => {
				for (const stand of standIns) stand.remove();
				let order = 0;
				for (const row of rows) {
					row.classList.add('basalt-loadmore-new');
					if (!quick()) row.style.animationDelay = `${order * 40}ms`;
					feed.appendChild(row);
					order += 1;
				}
				loaded += rows.length;
				pending = false;
				trigger.classList.remove('is-loading');
				trigger.removeAttribute('aria-disabled');
				feed.removeAttribute('aria-busy');
				report();
				/* Focus lands on the first new row so the next Tab carries on there. */
				const lead = rows[0];
				if (lead) {
					lead.tabIndex = -1;
					lead.focus({ preventScroll: false });
				}
			});
		}
	}

	/**
	 * A scrolling box that fetches the next batch as its bottom comes near.
	 * A switch can turn that off, in which case a button does the loading.
	 * Hooks: [data-basalt-infinite-box], [data-basalt-infinite-list],
	 * [data-basalt-infinite-sentinel], [data-basalt-infinite-end],
	 * [data-basalt-infinite-status], [data-basalt-infinite-auto] and
	 * [data-basalt-infinite-more].
	 * @param {HTMLElement} root
	 * @param {{ total: number, batch: number, noun: string,
	 *   fetch: function(number, number): Promise<Element[]> }} opts
	 * @returns {{ load: function() }} load fetches the next batch now
	 */
	function infinite(root, opts) {
		function hook(part) {
			return root.querySelector(`[data-basalt-infinite-${part}]`);
		}
		const scroller = hook('box');
		const feed = hook('list');
		const tripwire = hook('sentinel');
		const endNote = hook('end');
		const counter = hook('status');
		const autoSwitch = hook('auto');
		const moreButton = hook('more');
		let loaded = feed.children.length;
		let pending = false;

		if (typeof window.IntersectionObserver === 'function') {
			const watcher = new IntersectionObserver(onApproach, { root: scroller, rootMargin: '0px 0px 120px 0px' });
			watcher.observe(tripwire);
		}
		autoSwitch?.addEventListener('change', report);
		moreButton?.addEventListener('click', fetchBatch);
		report();
		return { load: fetchBatch };

		function remaining() {
			return opts.total - loaded;
		}

		function onApproach(entries) {
			const near = entries.some((entry) => entry.isIntersecting);
			if (near && (!autoSwitch || autoSwitch.checked)) fetchBatch();
		}

		function report() {
			counter.textContent = `${loaded} of ${opts.total} ${opts.noun} loaded`;
			endNote.hidden = remaining() > 0;
			if (moreButton) moreButton.hidden = autoSwitch?.checked || remaining() <= 0;
		}

		function fetchBatch() {
			if (pending || remaining() <= 0) return;
			pending = true;
			feed.setAttribute('aria-busy', 'true');
			if (moreButton) moreButton.disabled = true;
			const standIns = addPlaceholders(feed, 2);
			opts.fetch(loaded, Math.min(opts.batch, remaining())).then((rows) => {
				for (const stand of standIns) stand.remove();
				for (const row of rows) {
					row.classList.add('basalt-loadmore-new');
					feed.appendChild(row);
				}
				loaded += rows.length;
				pending = false;
				feed.removeAttribute('aria-busy');
				if (moreButton) moreButton.disabled = false;
				report();
				/* While the box still has room below, keep filling it. */
				if (autoSwitch?.checked && scroller.scrollHeight <= scroller.clientHeight + 4) fetchBatch();
			});
		}
	}

	/** Appends `count` gray placeholder rows to `list` and hands them back. */
	function addPlaceholders(list, count) {
		return Array.from({ length: count }, () => {
			const row = document.createElement('li');
			row.className = 'basalt-skeleton-row';
			row.setAttribute('aria-hidden', 'true');
			row.innerHTML = '<span></span><span></span><span></span>';
			list.appendChild(row);
			return row;
		});
	}

	/**
	 * Roving dots for slides or steps: the `.basalt-dots-dot` buttons inside
	 * root. The chosen one carries aria-current="true" and the only tab stop;
	 * arrows, Home and End move the choice.
	 * @param {HTMLElement} root
	 * @param {function(number)} [onChange] gets the new index after each move
	 * @returns {{ set: function(number, boolean=), get: function(): number }}
	 */
	function dots(root, onChange) {
		const markers = Array.from(root.querySelectorAll('.basalt-dots-dot'));
		let chosen = Math.max(
			0,
			markers.findIndex((marker) => marker.getAttribute('aria-current') === 'true'),
		);

		for (const [index, marker] of markers.entries()) marker.addEventListener('click', () => choose(index));
		root.addEventListener('keydown', onKey);
		choose(chosen);
		return { set: choose, get: () => chosen };

		function choose(index, moveFocus) {
			chosen = (index + markers.length) % markers.length;
			for (const [position, marker] of markers.entries()) {
				const isChosen = position === chosen;
				if (isChosen) marker.setAttribute('aria-current', 'true');
				else marker.removeAttribute('aria-current');
				marker.tabIndex = isChosen ? 0 : -1;
			}
			if (moveFocus) markers[chosen].focus();
			onChange?.(chosen);
		}

		function onKey(event) {
			let target;
			if (event.key === 'Home') target = 0;
			else if (event.key === 'End') target = markers.length - 1;
			else if (DOT_STEPS.has(event.key)) target = chosen + DOT_STEPS.get(event.key);
			else return;
			event.preventDefault();
			choose(target, true);
		}
	}
})();
