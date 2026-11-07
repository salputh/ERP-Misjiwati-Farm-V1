/**
 * Component script for the date picker. It loads after assets/basalt/js/basalt.js, and
 * only on the pages that use it; documentation.html#page-map lists them.
 */

/* 
   Date picker
     A text field with a calendar button. People pick a day from the
     calendar or type one: 11/20, Nov 20, November 20, 2026-11-20, today
     or tomorrow. A day with no year that has already gone means next year.
     Markup and options are shown on date-fields.html.
       <div class="basalt-datepicker" data-basalt-datepicker data-min="2026-10-08">
         <div class="input-group">
           <input type="text" class="form-control" id="due" placeholder="Pick a date">
           <button type="button" class="btn btn-outline-secondary basalt-datepicker-btn"
                   aria-label="Open calendar"><i class="bi bi-calendar3"></i></button>
         </div>
         <input type="hidden" name="due" value="2026-11-20">
       </div>
     data-min, data-max     earliest and latest day, as yyyy-mm-dd
     data-days="1-6"        weekdays that can be picked, 0 Sunday to 6
                            Saturday ("1-5" or "1,3,5"); the rest are struck
     data-days-message      what to say when one of those is typed
     data-today             the day the calendar treats as today (demos)
     data-week-start="1"    weeks start on Monday
     A plain <input type="date"> anywhere is turned into this field on
     load (and when a page adds one later), keeping the input as the value
     holder; data-native on it keeps the browser's own.
     data-years             a month and a year menu replace the title, for
                            days years away such as a birthday; the years
                            run from data-min (or a hundred years back) to
                            data-max (or ten years on)
     The day is kept as yyyy-mm-dd in the hidden input, so it goes with the
     form, and in data-value; the text field shows "Fri, Nov 20, 2026". A
     typed day that can't be used marks the field invalid (checkValidity()
     is false) and says why under it, in #<input id>-error if the page has
     one. Picking or typing a new day fires 'change' on the wrapper with
     detail { value, date }. Form reset puts the first day back.
     From code: window.Basalt.datepicker.init(el), .get(el) and
     .set(el, '2026-11-20') ('' clears it), where el is the wrapper or its
     text field.
    */
(() => {
	'use strict';
	/* Misjiwati Farm: bahasa halaman (<html lang>) dipakai untuk tampilan tanggal; singkatan bulan Indonesia ikut dikenali saat mengetik. */
	const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
	const BULAN = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];
	const monthNumber = (word) => Math.max(MONTHS.indexOf(word), BULAN.indexOf(word)) + 1;
	const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

	/* Every day is held at noon, so adding days never trips over a clock change. */
	function noon(y, m, d) {
		return new Date(y, m, d, 12);
	}

	function pad(n) {
		return String(n).padStart(2, '0');
	}

	function toISO(d) {
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}

	function fromISO(s) {
		const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
		if (!m) return null;
		const d = noon(+m[1], +m[2] - 1, +m[3]);
		return d.getDate() === +m[3] ? d : null;
	}

	function shiftDays(d, n) {
		return noon(d.getFullYear(), d.getMonth(), d.getDate() + n);
	}

	function firstOf(d, n) {
		return noon(d.getFullYear(), d.getMonth() + (n || 0), 1);
	}

	function daysIn(y, m) {
		return new Date(y, m + 1, 0).getDate();
	}

	function same(a, b) {
		return !!a && !!b && toISO(a) === toISO(b);
	}

	function fmt(d, o) {
		return d.toLocaleDateString(document.documentElement.lang || 'en-US', o);
	}

	function shown(d) {
		return fmt(d, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
	}

	function spoken(d) {
		return fmt(d, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
	}

	function parse(text, today) {
		const s = text.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ');
		if (s === 'today') return today;
		if (s === 'tomorrow') return shiftDays(today, 1);
		let y;
		let m;
		let d;
		let match;
		if ((match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) {
			y = +match[1];
			m = +match[2];
			d = +match[3];
		} else if ((match = /^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/.exec(s))) {
			m = +match[1];
			d = +match[2];
			y = match[3] ? +match[3] : null;
		} else if ((match = /^(?:[a-z]+ )?([a-z]{3,})\.? (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/.exec(s))) {
			m = monthNumber(match[1].slice(0, 3));
			d = +match[2];
			y = match[3] ? +match[3] : null;
		} else if ((match = /^(?:[a-z]+ )?(\d{1,2})(?:st|nd|rd|th)? ([a-z]{3,})\.?(?: (\d{4}))?$/.exec(s))) {
			m = monthNumber(match[2].slice(0, 3));
			d = +match[1];
			y = match[3] ? +match[3] : null;
		} else return null;
		if (y !== null && y < 100) y += 2000;
		if (!m || m > 12 || !d) return null;
		const guess = y === null;
		if (guess) y = today.getFullYear();
		if (d > daysIn(y, m - 1)) return null;
		const out = noon(y, m - 1, d);
		return guess && out < today ? noon(y + 1, m - 1, d) : out;
	}

	/* "1-6" or "1,3,5" to the set of weekdays that can be picked. */
	function weekdays(spec) {
		if (!spec) return null;
		const set = new Set();

		for (const part of spec.split(',')) {
			const [a, b] = part.split('-').map((n) => parseInt(n, 10));
			if (Number.isNaN(a)) continue;
			for (let i = a; i <= (Number.isNaN(b) || b === undefined ? a : b); i++) set.add(i % 7);
		}

		return set.size ? set : null;
	}

	const fields = new WeakMap();
	let openField = null;
	let uid = 0;

	function setup(wrap) {
		const input = wrap.querySelector('input:not([type="hidden"])');
		const btn = wrap.querySelector('button');
		if (!input || !btn) return null;
		const group = input.closest('.input-group') || input;
		const hidden = wrap.querySelector('input[type="hidden"]');
		if (!input.id) input.id = `basalt-date-${++uid}`;
		const id = input.id;

		const now = new Date();
		const today =
			fromISO(wrap.getAttribute('data-today')) || noon(now.getFullYear(), now.getMonth(), now.getDate());
		const min = fromISO(wrap.getAttribute('data-min'));
		const max = fromISO(wrap.getAttribute('data-max'));
		const allowed = weekdays(wrap.getAttribute('data-days'));
		const weekStart = wrap.getAttribute('data-week-start') === '1' ? 1 : 0;

		function outside(d) {
			return (min && d < min) || (max && d > max);
		}

		function struck(d) {
			return !!allowed && !allowed.has(d.getDay());
		}

		function problem(d) {
			if (!d) return 'Enter a date like Oct 14 or 10/14.';
			if (struck(d)) return wrap.getAttribute('data-days-message') || `Not available on ${WEEKDAYS[d.getDay()]}.`;
			if (min && d < min) return `Pick ${shown(min)} or later.`;
			if (max && d > max) return `Pick ${shown(max)} or earlier.`;
			return '';
		}

		/* The message under the field: the page's own #id-error, or one made here. */
		let err = document.getElementById(`${id}-error`);
		if (!err) {
			err = document.createElement('p');
			err.className = 'basalt-datepicker-error';
			err.id = `${id}-error`;
			err.hidden = true;
			wrap.appendChild(err);
		}
		const described = (input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
		if (!described.includes(err.id)) input.setAttribute('aria-describedby', described.concat(err.id).join(' '));

		const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
		const pop = document.createElement('div');
		pop.className = 'basalt-datepicker-pop';
		pop.id = `${id}-calendar`;
		pop.hidden = true;
		pop.setAttribute('role', 'dialog');
		pop.setAttribute('aria-label', label ? `Calendar for ${label.textContent.trim().toLowerCase()}` : 'Calendar');
		let head = '';
		for (let i = 0; i < 7; i++) {
			const d = noon(2023, 0, 1 + ((weekStart + i) % 7)); /* January 1, 2023 was a Sunday */
			head += `<th scope="col"><abbr title="${fmt(d, { weekday: 'long' })}">${fmt(d, { weekday: 'short' }).slice(0, 2)}</abbr></th>`;
		}
		const jumps = wrap.hasAttribute('data-years');
		let titleHtml = `<p class="basalt-datepicker-title" id="${id}-month" aria-live="polite"></p>`;
		if (jumps) {
			const first = min ? min.getFullYear() : today.getFullYear() - 100;
			const last = max ? max.getFullYear() : today.getFullYear() + 10;
			let months = '';
			for (let m = 0; m < 12; m++)
				months += `<option value="${m}">${fmt(noon(2023, m, 1), { month: 'long' })}</option>`;
			let years = '';
			for (let y = last; y >= first; y--) years += `<option value="${y}">${y}</option>`;
			titleHtml = `<div class="basalt-datepicker-title basalt-datepicker-jumps" id="${id}-month"><select class="form-select form-select-sm" data-jump="month" aria-label="Month">${months}</select><select class="form-select form-select-sm" data-jump="year" aria-label="Year">${years}</select></div>`;
		}
		pop.innerHTML = `<div class="basalt-datepicker-nav"><button type="button" class="basalt-datepicker-navbtn" data-nav="-1" aria-label="Previous month"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>${titleHtml}<button type="button" class="basalt-datepicker-navbtn" data-nav="1" aria-label="Next month"><i class="bi bi-chevron-right" aria-hidden="true"></i></button></div><table class="basalt-datepicker-grid" aria-labelledby="${id}-month"><thead><tr>${head}</tr></thead><tbody></tbody></table>`;
		wrap.appendChild(pop);
		const title = pop.querySelector('.basalt-datepicker-title');
		const body = pop.querySelector('tbody');
		const prev = pop.querySelector('[data-nav="-1"]');
		const next = pop.querySelector('[data-nav="1"]');

		btn.setAttribute('aria-haspopup', 'dialog');
		btn.setAttribute('aria-expanded', 'false');
		btn.setAttribute('aria-controls', pop.id);
		if (!btn.hasAttribute('aria-label')) btn.setAttribute('aria-label', 'Open calendar');
		input.setAttribute('autocomplete', 'off');
		if (input.disabled) btn.disabled = true;

		let value = null;
		let view = firstOf(today);
		let cursor = null; /* the day that takes Tab in the grid */
		let opener = btn; /* where focus goes back to on close */
		let shift = { x: 0, y: 0 };

		function inView(d) {
			return d.getFullYear() === view.getFullYear() && d.getMonth() === view.getMonth();
		}

		function tabDay() {
			function open(d) {
				return d && inView(d) && !outside(d) && !struck(d);
			}

			if (cursor && inView(cursor)) return cursor;
			if (open(value)) return value;
			if (open(today)) return today;
			for (let d = view; inView(d); d = shiftDays(d, 1)) if (open(d)) return d;
			return view;
		}

		function render(moveFocus) {
			if (jumps) {
				title.querySelector('[data-jump="month"]').value = view.getMonth();
				title.querySelector('[data-jump="year"]').value = view.getFullYear();
			} else {
				title.textContent = fmt(view, { month: 'long', year: 'numeric' });
			}
			prev.disabled = !!min && view <= firstOf(min);
			next.disabled = !!max && view >= firstOf(max);
			const year = view.getFullYear();
			const month = view.getMonth();
			const total = daysIn(year, month);
			const stop = toISO(tabDay());
			let html = '';
			for (let day = 1 - ((view.getDay() - weekStart + 7) % 7); day <= total;) {
				html += '<tr>';
				for (let i = 0; i < 7; i++, day++) {
					if (day < 1 || day > total) {
						html += '<td></td>';
						continue;
					}
					const d = noon(year, month, day);
					const off = outside(d) || struck(d);
					const onToday = same(d, today);
					const sel = same(d, value);
					html += `<td><button type="button" class="basalt-datepicker-day${sel ? ' is-selected' : ''}${onToday ? ' is-today' : ''}${off ? ' is-off' : ''}${off && !outside(d) ? ' is-struck' : ''}" data-day="${toISO(d)}" tabindex="${toISO(d) === stop ? 0 : -1}" aria-pressed="${sel}"${off ? ' aria-disabled="true"' : ''}${onToday ? ' aria-current="date"' : ''} aria-label="${spoken(d)}${onToday ? ', today' : ''}${off ? ', not available' : ''}">${day}</button></td>`;
				}
				html += '</tr>';
			}
			body.innerHTML = html;
			if (!pop.hidden) place();
			if (moveFocus) body.querySelector('[tabindex="0"]').focus({ preventScroll: true });
		}

		/* Under the field, or over it when there is more room above. Measured
       from the viewport, less any transformed parent (a dialog sliding in)
       that would move a fixed element. */
		function place() {
			const r = group.getBoundingClientRect();
			const vw = document.documentElement.clientWidth;
			const vh = window.innerHeight;
			const gap = 6;
			const edge = 8;
			pop.style.maxHeight = '';
			const natural = pop.offsetHeight;
			const below = vh - r.bottom - gap - edge;
			const above = r.top - gap - edge;
			const up = natural > below && above > below;
			const room = up ? above : below;
			if (natural > room) pop.style.maxHeight = `${Math.max(160, room)}px`;
			const left = Math.max(edge, Math.min(r.left, vw - edge - pop.offsetWidth));
			const top = up ? r.top - gap - pop.offsetHeight : r.bottom + gap;
			pop.classList.toggle('is-above', up);
			pop.style.left = `${left - shift.x}px`;
			pop.style.top = `${top - shift.y}px`;
		}
		let frame = 0;

		function follow() {
			if (!frame)
				frame = requestAnimationFrame(() => {
					frame = 0;
					if (!pop.hidden) place();
				});
		}

		function open(focusGrid, from) {
			if (input.disabled) return;
			opener = from || btn;
			if (pop.hidden) {
				if (openField && openField !== api) openField.close(false);
				openField = api;
				cursor = null;
				view = firstOf(value || (min && today < min ? min : today));
				pop.hidden = false;
				pop.classList.remove('is-open');
				pop.style.left = '0px';
				pop.style.top = '0px';
				const r = pop.getBoundingClientRect();
				shift = { x: r.left, y: r.top };
				btn.setAttribute('aria-expanded', 'true');
				wrap.classList.add('is-open');
				render(focusGrid);
				void pop.offsetWidth;
				pop.classList.add('is-open');
				window.addEventListener('scroll', follow, { capture: true, passive: true });
				window.addEventListener('resize', follow, { passive: true });
			} else if (focusGrid) {
				render(true);
			}
		}
		function close(returnFocus) {
			if (pop.hidden) return;
			pop.hidden = true;
			pop.classList.remove('is-open');
			btn.setAttribute('aria-expanded', 'false');
			wrap.classList.remove('is-open');
			if (openField === api) openField = null;
			window.removeEventListener('scroll', follow, { capture: true });
			window.removeEventListener('resize', follow);
			if (returnFocus) opener.focus();
		}

		function showError(msg) {
			err.textContent = msg;
			err.hidden = !msg;
			input.classList.toggle('is-invalid', !!msg);
			if (msg) input.setAttribute('aria-invalid', 'true');
			else input.removeAttribute('aria-invalid');
			input.setCustomValidity(msg);
		}

		function store(d, notify) {
			const before = value ? toISO(value) : '';
			value = d;
			const iso = d ? toISO(d) : '';
			if (hidden) hidden.value = iso;
			wrap.setAttribute('data-value', iso);
			if (d) input.value = shown(d);
			if (!pop.hidden) {
				view = d ? firstOf(d) : view;
				cursor = d;
				render(false);
			}
			if (notify && iso !== before) {
				wrap.dispatchEvent(
					new CustomEvent('change', { bubbles: true, detail: { value: iso, date: d ? new Date(d) : null } }),
				);
			}
		}

		/* Reads the text field: a usable day is kept and tidied, anything else
       stays as typed with the reason under it. */
		function commit(notify) {
			if (!input.value.trim()) {
				showError('');
				store(null, notify);
				return;
			}
			const d = parse(input.value, today);
			const msg = problem(d);
			showError(msg);
			store(msg ? null : d, notify);
		}

		function setISO(iso) {
			const d = fromISO(iso);
			input.value = d ? shown(d) : iso || '';
			commit(false);
		}

		function pick(d) {
			showError('');
			store(d, true);
			close(true);
		}

		function goTo(d) {
			if (min && d < min) d = min;
			if (max && d > max) d = max;
			cursor = d;
			if (!inView(d)) view = firstOf(d);
			render(true);
		}

		btn.addEventListener('click', () => (pop.hidden ? open(true, btn) : close(false)));
		input.addEventListener('click', () => open(false, input));
		input.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				open(true, input);
			} else if (e.key === 'Escape' && !pop.hidden) {
				e.preventDefault();
				e.stopPropagation();
				close(false);
			} else if (e.key === 'Enter') {
				commit(true);
				if (!pop.hidden) {
					e.preventDefault();
					close(false);
				}
			}
		});
		/* While typing, the calendar follows and a fixed mistake clears. */
		input.addEventListener('input', () => {
			const d = input.value.trim() ? parse(input.value, today) : null;
			if (d && !problem(d)) {
				if (input.classList.contains('is-invalid')) showError('');
				if (!pop.hidden && !inView(d)) {
					view = firstOf(d);
					cursor = d;
					render(false);
				}
			}
		});
		/* A required field left empty says so when the form is checked. */
		input.addEventListener('invalid', () => {
			if (!input.value.trim()) showError('Pick a date.');
		});
		/* The wrapper's own 'change' is the one to listen for. */
		input.addEventListener('change', (e) => {
			e.stopPropagation();
			commit(true);
		});

		prev.addEventListener('click', () => {
			view = firstOf(view, -1);
			cursor = null;
			render(false);
		});
		next.addEventListener('click', () => {
			view = firstOf(view, 1);
			cursor = null;
			render(false);
		});
		body.addEventListener('click', (e) => {
			const day = e.target.closest('[data-day]');
			if (day && !day.hasAttribute('aria-disabled')) pick(fromISO(day.getAttribute('data-day')));
		});
		body.addEventListener('keydown', (e) => {
			const day = e.target.closest('[data-day]');
			if (!day) return;
			const d = fromISO(day.getAttribute('data-day'));
			const col = (d.getDay() - weekStart + 7) % 7;

			function jump(n) {
				const t = firstOf(d, n);
				return noon(
					t.getFullYear(),
					t.getMonth(),
					Math.min(d.getDate(), daysIn(t.getFullYear(), t.getMonth())),
				);
			}

			const moves = {
				ArrowLeft: () => shiftDays(d, -1),
				ArrowRight: () => shiftDays(d, 1),
				ArrowUp: () => shiftDays(d, -7),
				ArrowDown: () => shiftDays(d, 7),
				Home: () => shiftDays(d, -col),
				End: () => shiftDays(d, 6 - col),
				PageUp: () => jump(e.shiftKey ? -12 : -1),
				PageDown: () => jump(e.shiftKey ? 12 : 1),
			};
			if (!moves[e.key]) return;
			e.preventDefault();
			goTo(moves[e.key]());
		});
		/* The month and year menus move the calendar straight there. */
		if (jumps) {
			title.addEventListener('change', () => {
				view = noon(
					+title.querySelector('[data-jump="year"]').value,
					+title.querySelector('[data-jump="month"]').value,
					1,
				);
				cursor = null;
				render(false);
			});
		}
		/* Escape closes the calendar only, not a dialog it sits in. */
		pop.addEventListener('keydown', (e) => {
			if (e.key !== 'Escape') return;
			e.preventDefault();
			e.stopPropagation();
			close(true);
		});
		wrap.addEventListener('focusout', (e) => {
			if (!pop.hidden && e.relatedTarget && !wrap.contains(e.relatedTarget)) close(false);
		});
		const form = input.form;
		const first = (hidden && hidden.value) || wrap.getAttribute('data-value') || '';
		if (form) form.addEventListener('reset', () => setTimeout(() => setISO(first)));

		const api = {
			close,
			owns: (t) => wrap.contains(t),
			get: () => (value ? toISO(value) : ''),
			set: setISO,
		};
		if (first) setISO(first);
		else if (input.value.trim()) commit(false);
		return api;
	}

	function init(el) {
		const wrap = el && el.closest('[data-basalt-datepicker]');
		if (!wrap) return null;
		if (!fields.has(wrap)) fields.set(wrap, setup(wrap));
		return fields.get(wrap);
	}

	document.addEventListener('pointerdown', (e) => {
		if (openField && !openField.owns(e.target)) openField.close(false);
	});

	window.Basalt.datepicker = {
		init: (el) => (init(el) ? el.closest('[data-basalt-datepicker]') : null),
		get: (el) => {
			const f = init(el);
			return f ? f.get() : '';
		},
		set: (el, iso) => {
			const f = init(el);
			if (f) f.set(iso);
		},
	};

	/**
	 * Turns the browser's own date field into this one, in place. The
	 * original input stays as the value holder (now hidden), so a page that
	 * reads or sets its value as yyyy-mm-dd, or listens for its input and
	 * change events, keeps working; the calendar follows a value set from
	 * code. min and max carry over; data-native on the input opts out.
	 */
	function upgradeNative(native) {
		if (native.hasAttribute('data-native') || native.closest('[data-basalt-datepicker]')) return;
		const wrap = document.createElement('div');
		wrap.className = 'basalt-datepicker';
		wrap.setAttribute('data-basalt-datepicker', '');
		if (native.min) wrap.setAttribute('data-min', native.min);
		if (native.max) wrap.setAttribute('data-max', native.max);
		const group = document.createElement('div');
		group.className = `input-group${native.classList.contains('form-control-sm') ? ' input-group-sm' : ''}`;
		const field = document.createElement('input');
		field.type = 'text';
		field.className = native.className;
		field.placeholder = native.getAttribute('placeholder') || 'Pick a date';
		field.spellcheck = false;
		field.required = native.required;
		field.disabled = native.disabled;
		field.id = `${native.id || `basalt-date-${++uid}`}-pick`;
		for (const name of ['aria-label', 'aria-describedby']) {
			if (native.hasAttribute(name)) field.setAttribute(name, native.getAttribute(name));
		}
		const label = native.labels && native.labels[0];
		for (const each of native.labels || []) each.htmlFor = field.id;
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'btn btn-outline-secondary basalt-datepicker-btn';
		btn.disabled = native.disabled;
		btn.setAttribute(
			'aria-label',
			label ? `Open calendar for ${label.textContent.trim().toLowerCase()}` : 'Open calendar',
		);
		btn.innerHTML = '<i class="bi bi-calendar3" aria-hidden="true"></i>';
		native.before(wrap);
		group.append(field, btn);
		wrap.append(group, native);
		native.type = 'hidden';

		const api = init(field);
		const own = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
		Object.defineProperty(native, 'value', {
			configurable: true,
			get: () => own.get.call(native),
			set: (iso) => {
				own.set.call(native, iso);
				if (api && api.get() !== iso) api.set(iso);
			},
		});
		/* A day picked or typed reaches the page as the input's own events. */
		wrap.addEventListener('change', (e) => {
			if (e.target !== wrap) return;
			native.dispatchEvent(new Event('input', { bubbles: true }));
			native.dispatchEvent(new Event('change', { bubbles: true }));
		});
	}

	function upgradeAll(scope) {
		for (const native of scope.querySelectorAll('input[type="date"]')) upgradeNative(native);
	}

	document.addEventListener('DOMContentLoaded', () => {
		upgradeAll(document);
		document.querySelectorAll('[data-basalt-datepicker]').forEach(init);
		/* Date fields a page draws later are upgraded as they arrive. */
		new MutationObserver((changes) => {
			for (const change of changes) {
				for (const node of change.addedNodes) {
					if (node.nodeType !== 1) continue;
					if (node.matches('input[type="date"]')) upgradeNative(node);
					else upgradeAll(node);
				}
			}
		}).observe(document.body, { childList: true, subtree: true });
	});
})();
