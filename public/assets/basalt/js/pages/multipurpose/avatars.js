/**
 * Basalt - Avatars page
 * The page's filter chips, copy buttons and demos. The avatar
 * behavior it shows ([data-basalt-avatar],
 * [data-basalt-avatar-group], [data-basalt-avatar-edit],
 * [data-basalt-presence]) lives in basalt.js.
 * Plain ES6, no libraries.
 */
(() => {
	'use strict';
	function start() {
		for (const btn of pickAll('[data-avp-copy]')) {
			btn.addEventListener('click', () => {
				const pre = pick('pre', btn.parentElement);
				if (!pre) return;
				copyText(pre.textContent.trim()).then(() => {
					const icon = pick('.bi', btn);
					btn.lastChild.textContent = ' Copied';
					if (icon) icon.className = 'bi bi-check2';
					clearTimeout(btn._avpTimer);
					btn._avpTimer = setTimeout(() => {
						btn.lastChild.textContent = ' Copy';
						if (icon) icon.className = 'bi bi-clipboard';
					}, 1800);
				});
			});
		}

		/* Tooltips on the page's avatars */
		if (window.bootstrap && bootstrap.Tooltip) {
			for (const el of pickAll('[data-bs-toggle="tooltip"]')) {
				bootstrap.Tooltip.getOrCreateInstance(el);
			}
		}

		/* Overflow group controls */
		(function overflow() {
			const group = pick('[data-basalt-avatar-group]');
			const range = pick('[data-avp-max]');
			const out = pick('[data-avp-max-out]');
			const note = pick('[data-avp-group-note]');
			const spread = pick('[data-avp-spread]');
			if (!group || !group.basaltAvatarGroup) return;
			const total = pickAll(':scope > .basalt-avatar', group).length;
			function update() {
				const hidden = group.basaltAvatarGroup.set(range.value);
				if (out) out.textContent = range.value;
				if (note)
					note.textContent = hidden
						? `${total - hidden} shown, ${hidden} more in the list`
						: `All ${total} shown`;
			}
			if (range) range.addEventListener('input', update);

			for (const r of pickAll('input[name="avp-size"]')) {
				r.addEventListener('change', () => {
					const size = r.value;
					group.classList.toggle('basalt-avatar-group-sm', size === 'sm');
					group.classList.toggle('basalt-avatar-group-lg', size === 'lg');

					for (const a of pickAll('.basalt-avatar', group)) {
						a.classList.toggle('basalt-avatar-sm', size === 'sm');
						a.classList.toggle('basalt-avatar-lg', size === 'lg');
					}
				});
			}

			if (spread)
				spread.addEventListener('change', () =>
					group.classList.toggle('basalt-avatar-group-spread', spread.checked),
				);
			update();
		})();

		/* Generated avatar demo */
		(function generated() {
			const root = pick('[data-avp-gen]');
			if (!root) return;
			const input = pick('input', root);
			const preview = pick('[data-basalt-avatar]', root);
			const meta = pick('[data-avp-gen-meta]', root);
			input.addEventListener('input', () => {
				preview.setAttribute('data-name', input.value);
				const r = Basalt.avatar(preview);
				if (meta)
					meta.textContent = input.value.trim()
						? `Initials ${r.initials}, tone ${r.tone}`
						: 'Type a name to see its avatar';
			});
			input.dispatchEvent(new Event('input'));
		})();

		/* Person chips */
		(function chips() {
			const row = pick('[data-avp-chips]');
			const live = pick('[data-avp-chip-live]');
			if (!row) return;
			row.addEventListener('click', (e) => {
				const btn = e.target.closest('[data-avp-chip-remove]');
				if (!btn) return;
				const chip = btn.closest('.basalt-person-chip');
				const next = chip.nextElementSibling || chip.previousElementSibling;
				const name = btn.getAttribute('aria-label').replace(/^Remove\s+/, '');
				chip.remove();
				if (live) live.textContent = `Removed ${name} from the roster.`;
				if (next) pick('button', next).focus();
				else {
					const empty = document.createElement('span');
					empty.className = 'avp-note m-0';
					empty.textContent = 'Nobody picked yet.';
					row.appendChild(empty);
				}
			});
		})();
	}

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many}`;
	}

	/* Page only */
	const page = pick('[data-avp-root]', document);
	if (!page) return;
	/* The overflow controls below read the group's api straight away. */
	if (window.Basalt.avatars) window.Basalt.avatars(page);

	function pick(selector, scope = page) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = page) {
		return [...scope.querySelectorAll(selector)];
	}

	/* Filter chips */
	(function filters() {
		const grid = pick('[data-avp-grid]');
		const count = pick('[data-avp-count]');
		if (!grid) return;
		const cards = pickAll('.avp-card', grid);
		function apply(group) {
			const shown = [];

			for (const card of cards) {
				const groups = (card.getAttribute('data-avp-groups') || '').split(/\s+/);
				const on = group === 'all' || groups.includes(group);
				card.classList.toggle('is-hidden', !on);
				card.classList.remove('is-alone');
				if (on) shown.push(card);
			}

			/* Half-width cards pair up between the full-width ones; an odd one
         out at the end of a run takes the whole row. */
			let run = [];
			function close() {
				if (run.length % 2) run[run.length - 1].classList.add('is-alone');
				run = [];
			}

			for (const c of shown) {
				if (c.classList.contains('avp-card-full')) close();
				else run.push(c);
			}

			close();
			if (count) count.textContent = plural(shown.length, 'avatar type', 'avatar types');
		}

		for (const btn of pickAll('[data-avp-filter]')) {
			btn.addEventListener('click', () => {
				for (const b of pickAll('[data-avp-filter]')) {
					b.setAttribute('aria-pressed', String(b === btn));
				}

				apply(btn.getAttribute('data-avp-filter'));
			});
		}

		apply('all');
	})();

	/* Copy buttons */
	function copyText(text) {
		return window.Basalt.copyText(text);
	}

	start();
})();
