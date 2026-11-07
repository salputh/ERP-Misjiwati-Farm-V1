/**
 * Component script for tag fields and number steppers. It loads after assets/basalt/js/basalt.js, and
 * only on the pages that use it; documentation.html#page-map lists them.
 */

/**
 * Two form controls grown from plain inputs; field-types.html shows the
 * markup and every option.
 *
 * Tag field, [data-basalt-tags], with data-max="10" as an optional cap.
 *   Enter or a comma turns the typed text into a tag and Backspace in the
 *   empty box drops the last one. A sibling hidden [data-basalt-tags-value]
 *   input holds the list as "a,b,c" and [data-basalt-tags-count] shows the
 *   tally. Once full, the box is disabled and shows data-full-placeholder.
 *   Typing a tag that is already there fires 'basalt:tags-duplicate' with
 *   detail.value. Scripts read and replace the list through
 *   box.basaltTags.get() and box.basaltTags.set(['a', 'b']).
 *
 * Stepper, [data-basalt-stepper]. Minus and plus buttons, and the arrow
 *   keys, move a number input within its own min, max and step.
 *
 * Either one fires a bubbling 'change' on its input when the value moves.
 */
(() => {
	'use strict';

	const CHIP = 'basalt-tags-tag';
	/* A button at the edge of its range says why it can't go further. */
	const atLimit = (button, reason) => (window.Basalt?.limit || ((b, r) => (b.disabled = Boolean(r))))(button, reason);
	const ARROWS = new Map([
		['ArrowUp', 1],
		['ArrowDown', -1],
	]);

	/**
	 * Enhances a stepper added after the page loaded, such as one inside a
	 * freshly drawn table row. Calling it again on the same element does
	 * nothing, so it is safe to run over a whole container.
	 * @param {HTMLElement} wrap  the [data-basalt-stepper] element
	 */
	window.Basalt.stepper = (wrap) => {
		if (!wrap || wrap.hasAttribute('data-basalt-stepper-bound')) return;
		wrap.setAttribute('data-basalt-stepper-bound', '');
		makeStepper(wrap);
	};

	function mount() {
		for (const box of document.querySelectorAll('[data-basalt-tags]')) makeTagField(box);
		for (const wrap of document.querySelectorAll('[data-basalt-stepper]')) window.Basalt.stepper(wrap);
	}

	function makeTagField(box) {
		const typing = box.querySelector('.basalt-tags-input');
		if (!typing) return;
		const around = box.parentElement;
		const store = around.querySelector('[data-basalt-tags-value]');
		const tally = around.querySelector('[data-basalt-tags-count]');
		const limit = parseInt(box.getAttribute('data-max'), 10) || Infinity;
		const openHint = typing.getAttribute('placeholder') || '';
		const fullHint = box.getAttribute('data-full-placeholder') || 'Limit reached';

		function values() {
			return [...box.querySelectorAll(`.${CHIP}`)].map((chip) => chip.getAttribute('data-value'));
		}

		function alreadyThere(value) {
			const wanted = value.toLowerCase();
			return values().some((existing) => existing.toLowerCase() === wanted);
		}

		function refresh() {
			const chosen = values();
			const full = chosen.length >= limit;
			box.classList.toggle('is-full', full);
			typing.disabled = full;
			typing.placeholder = full ? fullHint : openHint;
			if (store) store.value = chosen.join(',');
			if (tally) tally.textContent = limit === Infinity ? `${chosen.length}` : `${chosen.length} / ${limit}`;
			typing.dispatchEvent(new Event('change', { bubbles: true }));
		}

		function addTag(raw) {
			const value = raw.trim().replace(/,+$/, '').trim();
			if (!value) return;
			if (alreadyThere(value)) {
				box.dispatchEvent(new CustomEvent('basalt:tags-duplicate', { bubbles: true, detail: { value } }));
				return;
			}
			if (values().length >= limit) return;
			box.insertBefore(buildChip(value), typing);
			refresh();
		}

		/* The box is emptied only after the tag is in, so listeners still see the text. */
		function takeTyped() {
			addTag(typing.value);
			typing.value = '';
		}

		function dropLast() {
			const last = box.querySelector(`.${CHIP}:last-of-type`);
			if (!last) return;
			last.remove();
			refresh();
		}

		/* Read or replace the tags from code, for instance to fill a form as it opens. */
		box.basaltTags = {
			get: values,
			set(list) {
				for (const chip of box.querySelectorAll(`.${CHIP}`)) chip.remove();
				for (const entry of (list || []).slice(0, limit)) {
					const value = String(entry).trim();
					if (value && !alreadyThere(value)) box.insertBefore(buildChip(value), typing);
				}
				refresh();
			},
		};

		/* Tags written into the markup get the same remove button as typed ones. */
		for (const chip of box.querySelectorAll(`.${CHIP}`)) {
			if (chip.querySelector('.basalt-tags-remove')) continue;
			chip.replaceWith(buildChip(chip.getAttribute('data-value') || chip.textContent.trim()));
		}

		typing.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ',') {
				event.preventDefault();
				takeTyped();
			} else if (event.key === 'Backspace' && !typing.value) {
				dropLast();
			}
		});
		typing.addEventListener('blur', takeTyped);
		box.addEventListener('click', (event) => {
			const remover = event.target.closest('.basalt-tags-remove');
			if (remover) {
				remover.closest(`.${CHIP}`).remove();
				refresh();
				typing.focus();
			} else if (event.target === box) {
				typing.focus();
			}
		});

		refresh();
	}

	function buildChip(value) {
		const chip = document.createElement('span');
		chip.className = CHIP;
		chip.setAttribute('data-value', value);
		const remover = document.createElement('button');
		remover.type = 'button';
		remover.className = 'basalt-tags-remove';
		remover.setAttribute('aria-label', `Remove ${value}`);
		remover.innerHTML = '<i class="bi bi-x" aria-hidden="true"></i>';
		chip.append(value, remover);
		return chip;
	}

	function makeStepper(wrap) {
		const field = wrap.querySelector('.basalt-stepper-input');
		if (!field) return;
		const less = wrap.querySelector('[data-basalt-step="-1"]');
		const more = wrap.querySelector('[data-basalt-step="1"]');
		const floor = boundOf('min', -Infinity);
		const ceiling = boundOf('max', Infinity);
		const increment = boundOf('step', 1);

		function boundOf(name, fallback) {
			return field.hasAttribute(name) ? parseFloat(field.getAttribute(name)) : fallback;
		}

		function settle(wanted) {
			const next = Math.min(ceiling, Math.max(floor, Number.isNaN(wanted) ? floor : wanted));
			const moved = String(next) !== field.value;
			field.value = next;
			if (less) atLimit(less, next <= floor ? `${floor} is the lowest` : '');
			if (more) atLimit(more, next >= ceiling ? `${ceiling} is the highest` : '');
			if (moved) field.dispatchEvent(new Event('change', { bubbles: true }));
		}

		function nudge(direction) {
			settle((parseFloat(field.value) || 0) + increment * direction);
		}

		for (const button of [less, more]) {
			button?.addEventListener('click', () => nudge(parseInt(button.getAttribute('data-basalt-step'), 10)));
		}
		field.addEventListener('keydown', (event) => {
			if (!ARROWS.has(event.key)) return;
			event.preventDefault();
			nudge(ARROWS.get(event.key));
		});
		field.addEventListener('blur', () => settle(parseFloat(field.value)));
		settle(parseFloat(field.value));
	}

	document.addEventListener('DOMContentLoaded', mount);
})();
