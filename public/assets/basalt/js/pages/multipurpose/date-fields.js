/**
 * Calendars for the date picker showcase (date-fields.html).
 *
 * A single grid factory, createCalendar(), serves every card: one day, a span
 * of days, a whole week or a loose handful of days. Each card then only sets
 * its own rules and decides what to do with the answer. The first card's
 * plain field belongs to basalt.js; this file just seeds its starting days.
 */
(() => {
	'use strict';

	/* A button at a limit says why in its tooltip instead of going dead. */
	const atLimit = (button, reason) => (window.Basalt?.limit || ((b, r) => (b.disabled = Boolean(r))))(button, reason);

	const pageRoot = pick('[data-dtp-root]', document);
	if (!pageRoot) return;

	/* Dates live at midday local time, so stepping by whole days can never
     land on the wrong side of a daylight saving switch. */
	const MS_PER_DAY = 864e5;
	const thisDay = atMidday(new Date());
	const MONTH_PREFIXES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

	/** Wires every card in page order, then the pills that filter them. */
	function start() {
		seedPlainFields();
		mountVisitBooking();
		mountReportPeriod();
		mountVisitPause();
		mountTrainingSessions();
		mountOnCallDays();
		mountPlanMonths();
		mountCrewWeek();
		mountServiceInterval();
		mountBirthday();
		mountNativeInputs();
		mountKindChips();
	}

	/* The shared field from basalt.js only needs a first value here: a day
     offset from today, or the coming Sunday to show the error state. */
	function seedPlainFields() {
		for (const field of pickAll('[data-dtp-simple-value]', pageRoot)) {
			const offset = field.getAttribute('data-dtp-simple-value');
			const target =
				offset === 'sunday'
					? shiftDays(thisDay, (7 - thisDay.getDay()) % 7 || 7)
					: shiftDays(thisDay, parseInt(offset, 10));
			window.Basalt.datepicker.set(field, isoKey(target));
		}
	}

	/* Date arithmetic. Every helper hands back a fresh midday Date. */

	function twoDigits(value) {
		return String(value).padStart(2, '0');
	}

	function atMidday(when) {
		return new Date(when.getFullYear(), when.getMonth(), when.getDate(), 12);
	}

	function shiftDays(when, count) {
		return new Date(when.getFullYear(), when.getMonth(), when.getDate() + count, 12);
	}

	function monthStart(when, monthOffset = 0) {
		return new Date(when.getFullYear(), when.getMonth() + monthOffset, 1, 12);
	}

	function isoKey(when) {
		return `${when.getFullYear()}-${twoDigits(when.getMonth() + 1)}-${twoDigits(when.getDate())}`;
	}

	/** Turns a "2026-10-02" key back into its midday Date. */
	function dateFromKey(key) {
		const [year, month, day] = key.split('-').map(Number);
		return new Date(year, month - 1, day, 12);
	}

	function daysApart(from, to) {
		return Math.round((atMidday(to) - atMidday(from)) / MS_PER_DAY);
	}

	function isSameDate(left, right) {
		return Boolean(left) && Boolean(right) && daysApart(left, right) === 0;
	}

	/** Length of a month, with the month counted from 1 (day 0 of the next one). */
	function monthLength(month, year) {
		return new Date(year, month, 0).getDate();
	}

	function weekBegin(when, firstWeekday) {
		return shiftDays(when, -((when.getDay() - firstWeekday + 7) % 7));
	}

	/** ISO 8601 week: week 1 is the one holding the year's first Thursday. */
	function isoWeekNumber(when) {
		const thursday = shiftDays(when, 3 - ((when.getDay() + 6) % 7));
		const newYear = new Date(thursday.getFullYear(), 0, 1, 12);
		return 1 + Math.floor(daysApart(newYear, thursday) / 7);
	}

	/** A repeatable fraction drawn from a date, so demo seat counts hold still between visits. */
	function stableFraction(when, salt = 0) {
		let hash = (when.getFullYear() * 400 + when.getMonth() * 31 + when.getDate() + salt * 977) | 0;
		hash = Math.imul(hash ^ (hash >>> 13), 0x5bd1e995);
		hash ^= hash >>> 15;
		return ((hash >>> 0) % 1000) / 1000;
	}

	/* Wording for dates and money, always in US English. */

	function formatDate(when, parts) {
		return when.toLocaleDateString('en-US', parts);
	}

	function shortDate(when) {
		return formatDate(when, { month: 'short', day: 'numeric' });
	}

	function shortDateWithYear(when) {
		return formatDate(when, { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function dayName(when) {
		return formatDate(when, { weekday: 'short', month: 'short', day: 'numeric' });
	}

	function longDate(when) {
		return formatDate(when, { weekday: 'long', month: 'long', day: 'numeric' });
	}

	function fullDate(when) {
		return formatDate(when, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
	}

	function monthYear(when) {
		return formatDate(when, { month: 'long', year: 'numeric' });
	}

	function dollars(amount) {
		return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	/** Picks "1 visit" or "3 visits" style wording; the caller supplies both suffixes. */
	function counted(total, one, many) {
		return `${total}${total === 1 ? one : many}`;
	}

	/**
	 * Understands what people tend to type: 2026-10-02, 10/2, 10/2/2026,
	 * Oct 2, 2 October, today and tomorrow. A day given without a year that
	 * has already gone by this year is read as next year's.
	 * @param {string} typed
	 * @returns {Date|null}
	 */
	function readTypedDate(typed) {
		const text = typed.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ');
		if (!text) return null;
		const words = { today: () => thisDay, tomorrow: () => shiftDays(thisDay, 1) };
		if (words[text]) return words[text]();

		const parts = splitTypedDate(text);
		if (!parts) return null;
		let { year } = parts;
		const { month, day } = parts;
		if (year !== null && year !== undefined && year < 100) year += 2000;
		if (!month || month > 12 || !day) return null;

		const yearWasGuessed = !year;
		if (yearWasGuessed) year = thisDay.getFullYear();
		if (day > monthLength(month, year)) return null;
		const result = new Date(year, month - 1, day, 12);
		return yearWasGuessed && result < thisDay ? new Date(year + 1, month - 1, day, 12) : result;
	}

	/** Tries each accepted layout in turn and returns its raw year, month and day. */
	function splitTypedDate(text) {
		const monthOf = (word) => MONTH_PREFIXES.indexOf(word.slice(0, 3)) + 1;
		const optionalYear = (raw) => (raw ? Number(raw) : null);
		const layouts = [
			[
				/^(\d{4})-(\d{1,2})-(\d{1,2})$/,
				(hit) => ({ year: Number(hit[1]), month: Number(hit[2]), day: Number(hit[3]) }),
			],
			[
				/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/,
				(hit) => ({ year: optionalYear(hit[3]), month: Number(hit[1]), day: Number(hit[2]) }),
			],
			[
				/^(?:[a-z]+ )?([a-z]{3,})\.? (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/,
				(hit) => ({ year: optionalYear(hit[3]), month: monthOf(hit[1]), day: Number(hit[2]) }),
			],
			[
				/^(?:[a-z]+ )?(\d{1,2})(?:st|nd|rd|th)? ([a-z]{3,})\.?(?: (\d{4}))?$/,
				(hit) => ({ year: optionalYear(hit[3]), month: monthOf(hit[2]), day: Number(hit[1]) }),
			],
		];
		for (const [pattern, toParts] of layouts) {
			const hit = pattern.exec(text);
			if (hit) return toParts(hit);
		}
		return null;
	}

	/**
	 * Draws a keyboard-driven month grid into `host` and keeps it in step.
	 *
	 * Settings: select ('single', 'range', 'multiple' or 'week'), columns
	 * (months side by side), firstWeekday (0 Sunday, 1 Monday),
	 * showWeekNumbers, earliest and latest (Dates), opensAt (first month to
	 * show), closedWhen(date), reason(date) for text read out with a day,
	 * marker(date) for a dot under it, longestSpan (days in a range),
	 * mostDays (cap for 'multiple'), onPick and onFull.
	 *
	 * Keys: arrows step a day or a week, Home and End reach the ends of the
	 * week, Page Up and Page Down change month (a year with Shift), and Enter
	 * or Space picks the focused day.
	 */
	function createCalendar(host, settings) {
		const rules = {
			select: 'single',
			columns: 1,
			firstWeekday: 0,
			showWeekNumbers: false,
			earliest: null,
			latest: null,
			closedWhen: null,
			reason: null,
			marker: null,
			longestSpan: 0,
			mostDays: 0,
			onPick: null,
			onFull: null,
			...settings,
		};
		const spans = rules.select === 'range' || rules.select === 'week';

		let single = null;
		let spanFrom = null;
		let spanTo = null;
		const loose = new Map();
		let hovered = null;
		let cursor = null;
		let shownMonth = monthStart(rules.opensAt || rules.earliest || thisDay);

		host.classList.add('dtp-cal');
		host.innerHTML = `<div class="dtp-cal-nav"><button type="button" class="dtp-cal-navbtn" data-dtp-nav="-1" aria-label="Previous month"><i class="bi bi-chevron-left" aria-hidden="true"></i></button><p class="dtp-cal-title" aria-live="polite"></p><button type="button" class="dtp-cal-navbtn" data-dtp-nav="1" aria-label="Next month"><i class="bi bi-chevron-right" aria-hidden="true"></i></button></div><div class="dtp-cal-months"></div>`;
		const heading = pick('.dtp-cal-title', host);
		const sheets = pick('.dtp-cal-months', host);
		const backward = pick('[data-dtp-nav="-1"]', host);
		const forward = pick('[data-dtp-nav="1"]', host);
		const headingId = `dtp-cal-${Math.random().toString(36).slice(2, 8)}`;
		heading.id = headingId;

		sheets.addEventListener('click', (event) => {
			const cell = event.target.closest('[data-dtp-day]');
			if (cell) choose(dateFromKey(cell.getAttribute('data-dtp-day')));
		});
		sheets.addEventListener('mouseover', (event) => {
			if (!spans) return;
			const key = event.target.closest('[data-dtp-day]')?.getAttribute('data-dtp-day') ?? null;
			if ((hovered ? isoKey(hovered) : null) === key) return;
			hovered = key ? dateFromKey(key) : null;
			repaint();
		});
		sheets.addEventListener('mouseleave', () => {
			if (!hovered) return;
			hovered = null;
			repaint();
		});
		sheets.addEventListener('focusin', (event) => {
			const cell = event.target.closest('[data-dtp-day]');
			if (!cell || !spans) return;
			hovered = dateFromKey(cell.getAttribute('data-dtp-day'));
			repaint();
		});
		sheets.addEventListener('keydown', onGridKey);

		for (const arrow of [backward, forward]) {
			arrow.addEventListener('click', () => {
				shownMonth = monthStart(shownMonth, Number(arrow.getAttribute('data-dtp-nav')));
				cursor = null;
				redraw(false);
			});
		}

		redraw(false);

		return {
			focusGrid() {
				redraw(true);
			},
			repaint,
			selectDay(when) {
				single = when ? atMidday(when) : null;
				cursor = single;
				if (single && !onScreen(single)) shownMonth = monthStart(single);
				redraw(false);
			},
			selectSpan(from, to) {
				spanFrom = from ? atMidday(from) : null;
				spanTo = to ? atMidday(to) : null;
				hovered = null;
				cursor = spanTo || spanFrom;
				if (spanTo && !onScreen(spanTo)) shownMonth = monthStart(spanTo, -(rules.columns - 1));
				else if (spanFrom && !onScreen(spanFrom)) shownMonth = monthStart(spanFrom);
				redraw(false);
			},
			span: () => ({ start: spanFrom, end: spanTo }),
			replaceDays(list) {
				loose.clear();
				for (const when of list) loose.set(isoKey(when), atMidday(when));
				redraw(false);
			},
			pickedDays: sortedLoose,
			dropDay(when) {
				loose.delete(isoKey(when));
				repaint();
			},
			setColumns(count) {
				if (count === rules.columns) return;
				rules.columns = count;
				redraw(false);
			},
			revealMonth(when) {
				shownMonth = monthStart(when);
				redraw(false);
			},
		};

		/* Which days can be chosen. */

		function beyondLimits(when) {
			return (
				(rules.earliest && when < atMidday(rules.earliest)) || (rules.latest && when > atMidday(rules.latest))
			);
		}

		/* Shut no matter what has been chosen so far. */
		function shut(when) {
			return beyondLimits(when) || (rules.closedWhen ? Boolean(rules.closedWhen(when)) : false);
		}

		/* Shut for the moment: with half a range chosen, days past the longest span close as well. */
		function unavailable(when) {
			if (shut(when)) return true;
			const halfway = rules.select === 'range' && rules.longestSpan && spanFrom && !spanTo && when >= spanFrom;
			return halfway ? daysApart(spanFrom, when) >= rules.longestSpan : false;
		}

		function finalMonth() {
			return monthStart(shownMonth, rules.columns - 1);
		}

		function onScreen(when) {
			return when >= shownMonth && when < monthStart(shownMonth, rules.columns);
		}

		/* Drawing the grid. */

		function redraw(takeFocus) {
			const tables = [];
			for (let index = 0; index < rules.columns; index++) tables.push(monthMarkup(monthStart(shownMonth, index)));
			sheets.innerHTML = tables.join('');
			sheets.style.setProperty('--dtp-months', String(rules.columns));
			heading.textContent = rules.columns > 1 ? spanHeading() : monthYear(shownMonth);
			atLimit(
				backward,
				rules.earliest && shownMonth <= monthStart(atMidday(rules.earliest))
					? 'No earlier dates can be picked'
					: '',
			);
			atLimit(
				forward,
				rules.latest && finalMonth() >= monthStart(atMidday(rules.latest))
					? 'No later dates can be picked'
					: '',
			);
			repaint();
			if (takeFocus) focusRoving();
		}

		function spanHeading() {
			const last = finalMonth();
			const yearSuffix = shownMonth.getFullYear() === last.getFullYear() ? '' : ` ${shownMonth.getFullYear()}`;
			return `${formatDate(shownMonth, { month: 'long' })}${yearSuffix} to ${monthYear(last)}`;
		}

		function weekdayRow() {
			const heads = rules.showWeekNumbers
				? ['<th scope="col" class="dtp-cal-wk"><abbr title="Week number">Wk</abbr></th>']
				: [];
			for (let step = 0; step < 7; step++) {
				/* January 1, 2023 fell on a Sunday, which makes it a handy anchor. */
				const sample = new Date(2023, 0, 1 + ((rules.firstWeekday + step) % 7), 12);
				heads.push(
					`<th scope="col"><abbr title="${formatDate(sample, { weekday: 'long' })}">${formatDate(sample, { weekday: 'short' }).slice(0, 2)}</abbr></th>`,
				);
			}
			return `<thead><tr>${heads.join('')}</tr></thead>`;
		}

		function monthMarkup(first) {
			const year = first.getFullYear();
			const month = first.getMonth();
			const blanks = (first.getDay() - rules.firstWeekday + 7) % 7;
			const length = monthLength(month + 1, year);
			const several = rules.columns > 1;
			const naming = several ? ` aria-label="${monthYear(first)}"` : ` aria-labelledby="${headingId}"`;
			const rows = [];
			for (let date = 1 - blanks; date <= length;) {
				let row = rules.showWeekNumbers
					? `<th scope="row" class="dtp-cal-wk">${isoWeekNumber(new Date(year, month, Math.max(date, 1), 12))}</th>`
					: '';
				for (let column = 0; column < 7; column++, date++) {
					row +=
						date < 1 || date > length
							? '<td></td>'
							: `<td><button type="button" class="dtp-day" tabindex="-1" data-dtp-day="${isoKey(new Date(year, month, date, 12))}"><span class="dtp-day-n">${date}</span></button></td>`;
				}
				rows.push(`<tr>${row}</tr>`);
			}
			const caption = several ? `<caption class="dtp-cal-caption">${monthYear(first)}</caption>` : '';
			return `<table class="dtp-cal-grid"${naming}>${caption}${weekdayRow()}<tbody>${rows.join('')}</tbody></table>`;
		}

		function previewed(when) {
			if (rules.select === 'range' && spanFrom && !spanTo && hovered && hovered > spanFrom) {
				return when > spanFrom && when <= hovered;
			}
			if (rules.select === 'week' && hovered) {
				const monday = weekBegin(hovered, rules.firstWeekday);
				return when >= monday && when <= shiftDays(monday, 6);
			}
			return false;
		}

		/** Works out how one day should look and read right now. */
		function dayState(when) {
			const state = { chosen: false, first: false, last: false, inside: false };
			if (rules.select === 'single') state.chosen = isSameDate(when, single);
			else if (rules.select === 'multiple') state.chosen = loose.has(isoKey(when));
			else if (spanFrom) {
				state.first = isSameDate(when, spanFrom);
				state.last = isSameDate(when, spanTo || spanFrom);
				state.inside = Boolean(spanTo) && when > spanFrom && when < spanTo;
				state.chosen = state.first || state.last || state.inside;
			}
			return state;
		}

		function repaint() {
			const realSpan = Boolean(spanTo) && !isSameDate(spanFrom, spanTo);
			for (const cell of pickAll('[data-dtp-day]', sheets)) {
				const when = dateFromKey(cell.getAttribute('data-dtp-day'));
				const closed = unavailable(when);
				const { chosen, first, last, inside } = dayState(when);
				const onToday = isSameDate(when, thisDay);
				const marker = rules.marker ? rules.marker(when) : '';
				const reason = rules.reason ? rules.reason(when) : '';
				const column = (when.getDay() - rules.firstWeekday + 7) % 7;
				const finalDate = monthLength(when.getMonth() + 1, when.getFullYear());
				const looks = [
					['is-selected', chosen && !inside],
					['is-start', first && realSpan],
					['is-end', last && realSpan],
					['is-between', inside],
					['is-preview', !chosen && previewed(when)],
					['is-today', onToday],
					['is-off', closed],
					/* A rule strikes its days through; days merely out of reach stay plain. */
					[
						'is-struck',
						closed && !beyondLimits(when) && Boolean(rules.closedWhen) && Boolean(rules.closedWhen(when)),
					],
					['has-dot', Boolean(marker)],
					/* The ends of each row round off the shaded band. */
					['is-row-first', column === 0 || when.getDate() === 1],
					['is-row-last', column === 6 || when.getDate() === finalDate],
				];
				for (const [name, on] of looks) cell.classList.toggle(name, on);

				cell.setAttribute('aria-pressed', String(chosen));
				setOrDrop(cell, 'aria-disabled', closed ? 'true' : null);
				setOrDrop(cell, 'aria-current', onToday ? 'date' : null);
				const extras = [onToday && 'today', reason || (closed && 'not available'), marker].filter(Boolean);
				cell.setAttribute('aria-label', [fullDate(when), ...extras].join(', '));
			}
			placeTabStop();
		}

		/* Focus. Only one day in the grid sits in the Tab order; the arrows reach the rest. */

		function rovingDay() {
			if (cursor && onScreen(cursor)) return cursor;
			for (const option of [single, spanTo, spanFrom, ...loose.values(), thisDay]) {
				if (option && onScreen(option) && !unavailable(option)) return option;
			}
			for (let when = shownMonth; onScreen(when); when = shiftDays(when, 1)) {
				if (!unavailable(when)) return when;
			}
			return shownMonth;
		}

		function placeTabStop() {
			const key = isoKey(rovingDay());
			for (const cell of pickAll('[data-dtp-day]', sheets)) {
				cell.tabIndex = cell.getAttribute('data-dtp-day') === key ? 0 : -1;
			}
		}

		function focusRoving() {
			pick('[tabindex="0"]', sheets)?.focus();
		}

		function moveTo(target, takeFocus) {
			let when = target;
			if (rules.earliest && when < atMidday(rules.earliest)) when = atMidday(rules.earliest);
			if (rules.latest && when > atMidday(rules.latest)) when = atMidday(rules.latest);
			cursor = when;
			if (onScreen(when)) {
				placeTabStop();
				if (takeFocus) focusRoving();
				return;
			}
			shownMonth = when < shownMonth ? monthStart(when) : monthStart(when, -(rules.columns - 1));
			redraw(takeFocus);
		}

		function onGridKey(event) {
			const cell = event.target.closest('[data-dtp-day]');
			if (!cell) return;
			const when = dateFromKey(cell.getAttribute('data-dtp-day'));
			const column = (when.getDay() - rules.firstWeekday + 7) % 7;
			const sameDateIn = (offset) => {
				const target = new Date(when.getFullYear(), when.getMonth() + offset, 1, 12);
				const fit = Math.min(when.getDate(), monthLength(target.getMonth() + 1, target.getFullYear()));
				return new Date(target.getFullYear(), target.getMonth(), fit, 12);
			};
			const steps = {
				ArrowLeft: () => shiftDays(when, -1),
				ArrowRight: () => shiftDays(when, 1),
				ArrowUp: () => shiftDays(when, -7),
				ArrowDown: () => shiftDays(when, 7),
				Home: () => shiftDays(when, -column),
				End: () => shiftDays(when, 6 - column),
				PageUp: () => sameDateIn(event.shiftKey ? -12 : -1),
				PageDown: () => sameDateIn(event.shiftKey ? 12 : 1),
			};
			const step = steps[event.key];
			if (!step) return;
			event.preventDefault();
			moveTo(step(), true);
		}

		/* Choosing. */

		function sortedLoose() {
			return [...loose.values()].sort((left, right) => left - right);
		}

		function choose(when) {
			if (unavailable(when)) return;
			cursor = when;
			const handlers = { single: chooseSingle, multiple: toggleLoose, week: chooseWeek, range: chooseRangeEnd };
			handlers[rules.select](when);
		}

		function chooseSingle(when) {
			single = when;
			repaint();
			rules.onPick?.(single);
		}

		function toggleLoose(when) {
			const key = isoKey(when);
			if (loose.has(key)) {
				loose.delete(key);
			} else if (rules.mostDays && loose.size >= rules.mostDays) {
				rules.onFull?.();
				return;
			} else {
				loose.set(key, when);
			}
			repaint();
			rules.onPick?.(sortedLoose());
		}

		function chooseWeek(when) {
			spanFrom = weekBegin(when, rules.firstWeekday);
			spanTo = shiftDays(spanFrom, 6);
			finishSpan();
		}

		function chooseRangeEnd(when) {
			if (spanFrom && !spanTo && when >= spanFrom) {
				spanTo = when;
			} else {
				spanFrom = when;
				spanTo = null;
			}
			finishSpan();
		}

		function finishSpan() {
			hovered = null;
			repaint();
			rules.onPick?.({ start: spanFrom, end: spanTo });
		}
	}

	/* Small DOM helpers shared by the factory and the cards. */

	function pick(selector, scope) {
		return scope.querySelector(selector);
	}

	function setOrDrop(element, name, value) {
		if (value === null) element.removeAttribute(name);
		else element.setAttribute(name, value);
	}

	/**
	 * Turns a [data-dtp-popup] wrapper into a calendar panel that drops under
	 * its field. Escape or a press anywhere outside shuts it; Escape also
	 * hands focus back to the button that opened it.
	 */
	function attachPanel(holder, { whenShown } = {}) {
		const opener = pick('[data-dtp-trigger]', holder);
		const sheet = pick('.dtp-pop', holder);
		const showing = () => !sheet.hidden;

		function show() {
			if (showing()) return;
			document.dispatchEvent(new CustomEvent('dp:closeall', { detail: holder }));
			sheet.hidden = false;
			opener.setAttribute('aria-expanded', 'true');
			holder.classList.add('is-open');
			whenShown?.();
		}

		function hide(refocus) {
			if (!showing()) return;
			sheet.hidden = true;
			opener.setAttribute('aria-expanded', 'false');
			holder.classList.remove('is-open');
			if (refocus) opener.focus();
		}

		opener.addEventListener('click', () => (showing() ? hide(false) : show()));
		sheet.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			hide(true);
		});
		document.addEventListener('pointerdown', (event) => {
			if (showing() && !holder.contains(event.target)) hide(false);
		});
		document.addEventListener('dp:closeall', (event) => {
			if (event.detail !== holder) hide(false);
		});
		holder.addEventListener('focusout', (event) => {
			if (showing() && event.relatedTarget && !holder.contains(event.relatedTarget)) hide(false);
		});
		return { show, hide };
	}

	/** Shows or clears the message under a field, and its invalid styling with it. */
	function flagField(field, messageNode, message) {
		messageNode.textContent = message || '';
		messageNode.hidden = !message;
		field.classList.toggle('is-invalid', Boolean(message));
		setOrDrop(field, 'aria-invalid', message ? 'true' : null);
	}

	/* A home visit: typed or picked, with closed days, a cutoff and a summary on submit. */
	function mountVisitBooking() {
		const booking = pick('[data-dtp-delivery]', pageRoot);
		if (!booking) return;
		const dayField = pick('#dtp-deliv', booking);
		const dayError = pick('#dtp-deliv-error', booking);
		const errorBox = pick('#dtp-deliv-errors', booking);
		const errorItems = pick('[data-dtp-errors-list]', booking);
		const shortcuts = pick('[data-dtp-quick]', booking);
		const holder = pick('[data-dtp-popup]', booking);
		const panelBody = booking.closest('.card-body');
		const readout = {
			day: pick('[data-dtp-deliv-date]', panelBody),
			window: pick('[data-dtp-deliv-slot]', panelBody),
			fee: pick('[data-dtp-deliv-fee]', panelBody),
			cutoff: pick('[data-dtp-cutoff]', panelBody),
			result: pick('[data-dtp-deliv-status]', panelBody),
		};
		const windowText = {
			morning: 'Morning, 8am to noon',
			afternoon: 'Afternoon, noon to 5pm',
			evening: 'Evening, 5pm to 8pm',
		};
		const eveningRadio = pick('input[value="evening"]', booking);
		const eveningHint = pick('.basalt-choice-hint', eveningRadio.closest('.basalt-choice'));

		const officeShut = officeClosures();
		const clock = new Date();
		const afterCutoff = clock.getHours() >= 14;
		let soonest = shiftDays(thisDay, afterCutoff ? 2 : 1);
		while (!openForVisits(soonest)) soonest = shiftDays(soonest, 1);
		const furthest = shiftDays(thisDay, 60);
		readout.cutoff.textContent = afterCutoff
			? 'Passed for today, 2pm tomorrow'
			: `2pm today, ${14 - clock.getHours() - (clock.getMinutes() ? 1 : 0)} h ${(60 - clock.getMinutes()) % 60} min left`;

		let picked = null;
		const calendar = createCalendar(pick('[data-dtp-cal]', holder), {
			earliest: soonest,
			latest: furthest,
			opensAt: soonest,
			closedWhen: (when) => !openForVisits(when),
			reason: closedReason,
			onPick: (when) => {
				applyDay(when, true);
				panel.hide(true);
			},
		});
		const panel = attachPanel(holder, { whenShown: () => calendar.focusGrid() });

		shortcuts.addEventListener('click', (event) => {
			const tile = event.target.closest('[data-dtp-quick-day]');
			if (!tile) return;
			const key = tile.getAttribute('data-dtp-quick-day');
			applyDay(dateFromKey(key));
			pick(`[data-dtp-quick-day="${key}"]`, shortcuts).focus();
		});
		dayField.addEventListener('change', readTypedDay);
		dayField.addEventListener('keydown', (event) => {
			if (event.key !== 'ArrowDown' || !event.altKey) return;
			event.preventDefault();
			panel.show();
		});
		booking.addEventListener('change', (event) => {
			if (event.target.name === 'dtp-slot') syncWindows();
		});
		booking.addEventListener('submit', (event) => {
			event.preventDefault();
			confirmBooking();
		});
		errorItems.addEventListener('click', (event) => {
			if (!event.target.closest('a')) return;
			event.preventDefault();
			dayField.focus();
		});
		booking.addEventListener('reset', () => {
			setTimeout(() => {
				errorBox.hidden = true;
				applyDay(null);
				calendar.selectDay(null);
			});
		});

		drawShortcuts();
		syncWindows();

		/* Public holidays, plus a team training day ten days out (moved off the weekend). */
		function officeClosures() {
			const shut = new Map();
			const nthWeekday = (year, month, weekday, nth) => {
				const first = new Date(year, month, 1, 12);
				return new Date(year, month, 1 + ((weekday - first.getDay() + 7) % 7) + (nth - 1) * 7, 12);
			};
			for (const year of [thisDay.getFullYear(), thisDay.getFullYear() + 1]) {
				shut.set(isoKey(new Date(year, 0, 1, 12)), "New Year's Day");
				shut.set(isoKey(new Date(year, 6, 4, 12)), 'Independence Day');
				shut.set(isoKey(nthWeekday(year, 8, 1, 1)), 'Labor Day');
				shut.set(isoKey(nthWeekday(year, 10, 4, 4)), 'Thanksgiving');
				shut.set(isoKey(new Date(year, 11, 25, 12)), 'Christmas Day');
			}
			let training = shiftDays(thisDay, 10);
			while (training.getDay() === 0 || training.getDay() === 6) training = shiftDays(training, 1);
			shut.set(isoKey(training), 'team training');
			return shut;
		}

		function openForVisits(when) {
			return when.getDay() !== 0 && !officeShut.has(isoKey(when));
		}

		function closedReason(when) {
			if (officeShut.has(isoKey(when))) return `closed for ${officeShut.get(isoKey(when))}`;
			return when.getDay() === 0 ? 'no Sunday visits' : '';
		}

		function problemWith(when) {
			if (!when) return 'Enter a date like Oct 2 or 10/2.';
			if (when.getDay() === 0) return 'No visits on Sundays. Saturday or Monday work.';
			if (officeShut.has(isoKey(when)))
				return `The office is closed that day for ${officeShut.get(isoKey(when))}.`;
			if (when < soonest) return `The soonest visit is ${dayName(soonest)}.`;
			if (when > furthest) return `We book visits up to 60 days ahead, until ${dayName(furthest)}.`;
			return '';
		}

		function chosenWindow() {
			return pick('input[name="dtp-slot"]:checked', booking).value;
		}

		/* Saturdays carry a fee and have no evening window. */
		function syncWindows() {
			const saturday = picked && picked.getDay() === 6;
			eveningRadio.disabled = Boolean(saturday);
			eveningHint.textContent = saturday ? 'Not on Saturdays' : '5pm to 8pm';
			if (saturday && eveningRadio.checked) pick('input[value="morning"]', booking).checked = true;
			readout.window.textContent = windowText[chosenWindow()];
			readout.fee.textContent = saturday ? '$45, Saturday' : 'Included';
		}

		function showEmptyDay() {
			readout.day.textContent = 'No day picked yet';
			readout.day.classList.add('is-empty');
		}

		function applyDay(when, cameFromCalendar) {
			picked = when;
			dayField.value = when ? dayName(when) : '';
			flagField(dayField, dayError, '');
			readout.day.textContent = when ? longDate(when) : 'No day picked yet';
			readout.day.classList.toggle('is-empty', !when);
			readout.result.textContent = '';
			if (when) errorBox.hidden = true;
			if (when && !cameFromCalendar) calendar.selectDay(when);
			drawShortcuts();
			syncWindows();
		}

		function readTypedDay() {
			if (!dayField.value.trim()) {
				applyDay(null);
				return;
			}
			const when = readTypedDate(dayField.value);
			const problem = problemWith(when);
			if (!problem) {
				applyDay(when);
				return;
			}
			picked = null;
			flagField(dayField, dayError, problem);
			showEmptyDay();
			drawShortcuts();
			syncWindows();
		}

		/* The next five open days, each a single tap away. */
		function drawShortcuts() {
			const open = [];
			for (let when = soonest; open.length < 5 && when <= furthest; when = shiftDays(when, 1)) {
				if (openForVisits(when)) open.push(when);
			}
			shortcuts.innerHTML = open
				.map(
					(when) =>
						`<button type="button" class="dtp-quick-day" aria-label="${fullDate(when)}" aria-pressed="${isSameDate(when, picked)}" data-dtp-quick-day="${isoKey(when)}"><span class="dtp-quick-wd">${formatDate(when, { weekday: 'short' })}</span><span class="dtp-quick-n">${when.getDate()}</span><span class="dtp-quick-m">${formatDate(when, { month: 'short' })}</span></button>`,
				)
				.join('');
		}

		function confirmBooking() {
			if (dayField.value.trim() && !picked) dayField.dispatchEvent(new Event('change'));
			let problem = '';
			if (!picked) problem = dayField.value.trim() ? dayError.textContent : 'Choose a visit day.';
			if (problem) {
				flagField(dayField, dayError, problem);
				errorItems.innerHTML = `<li><a href="#dtp-deliv">${problem}</a></li>`;
				errorBox.hidden = false;
				errorBox.focus();
				readout.result.textContent = '';
				return;
			}
			errorBox.hidden = true;
			readout.result.innerHTML = `<i class="bi bi-check-circle" aria-hidden="true"></i> Booked for ${longDate(picked)}, ${windowText[chosenWindow()].toLowerCase()}.`;
		}
	}

	/* A report period: presets or two ends, applied or dropped as a whole. */
	function mountReportPeriod() {
		const report = pick('[data-dtp-report]', pageRoot);
		if (!report) return;
		const holder = pick('[data-dtp-popup]', report);
		const appliedText = pick('[data-dtp-report-label]', report);
		const draftText = pick('[data-dtp-report-draft]', report);
		const presetButtons = [...pickAll('[data-dtp-preset]', report)];
		const confirmButton = pick('[data-dtp-apply]', report);

		const quarterStart = new Date(thisDay.getFullYear(), Math.floor(thisDay.getMonth() / 3) * 3, 1, 12);
		const presetTable = {
			7: { name: 'Last 7 days', span: () => [shiftDays(thisDay, -6), thisDay] },
			30: { name: 'Last 30 days', span: () => [shiftDays(thisDay, -29), thisDay] },
			90: { name: 'Last 90 days', span: () => [shiftDays(thisDay, -89), thisDay] },
			month: { name: 'This month', span: () => [monthStart(thisDay), thisDay] },
			'last-month': {
				name: 'Last month',
				span: () => [monthStart(thisDay, -1), shiftDays(monthStart(thisDay), -1)],
			},
			quarter: { name: 'Quarter to date', span: () => [quarterStart, thisDay] },
			year: { name: 'Year to date', span: () => [new Date(thisDay.getFullYear(), 0, 1, 12), thisDay] },
		};
		let current = { span: presetTable[30].span(), preset: '30' };

		const twoUp = window.matchMedia('(min-width: 768px)');
		const calendar = createCalendar(pick('[data-dtp-cal]', report), {
			select: 'range',
			columns: twoUp.matches ? 2 : 1,
			earliest: shiftDays(thisDay, -730),
			latest: thisDay,
			onPick: () => {
				pressPreset(null);
				describeDraft();
			},
		});
		twoUp.addEventListener('change', () => calendar.setColumns(twoUp.matches ? 2 : 1));

		const panel = attachPanel(holder, {
			whenShown: () => {
				calendar.selectSpan(...current.span);
				pressPreset(current.preset);
				describeDraft();
				calendar.focusGrid();
			},
		});

		for (const button of presetButtons) {
			button.addEventListener('click', () => {
				const key = button.getAttribute('data-dtp-preset');
				calendar.selectSpan(...presetTable[key].span());
				pressPreset(key);
				describeDraft();
			});
		}
		pick('[data-dtp-cancel]', report).addEventListener('click', () => panel.hide(true));
		confirmButton.addEventListener('click', applyDraft);
		showApplied();

		function spanText(from, to) {
			if (!to || isSameDate(from, to)) return shortDateWithYear(from);
			const opening = from.getFullYear() === to.getFullYear() ? shortDate(from) : shortDateWithYear(from);
			return `${opening} to ${shortDateWithYear(to)}`;
		}

		function pressPreset(key) {
			for (const button of presetButtons) {
				button.setAttribute('aria-pressed', String(button.getAttribute('data-dtp-preset') === key));
			}
		}

		function describeDraft() {
			const { start: from, end: to } = calendar.span();
			if (!from) draftText.textContent = 'Pick a start day';
			else if (!to) draftText.textContent = `From ${shortDate(from)}, now pick an end day`;
			else draftText.textContent = `${spanText(from, to)}, ${counted(daysApart(from, to) + 1, ' day', ' days')}`;
		}

		function applyDraft() {
			const { start: from, end: to } = calendar.span();
			if (!from || !to) {
				draftText.textContent = from ? 'Pick an end day to apply.' : 'Pick a start day to apply.';
				return;
			}
			const pressed = presetButtons.find((button) => button.getAttribute('aria-pressed') === 'true');
			current = { span: [from, to], preset: pressed ? pressed.getAttribute('data-dtp-preset') : null };
			panel.hide(true);
			showApplied();
		}

		function showApplied() {
			const text = spanText(...current.span);
			appliedText.textContent = current.preset ? `${presetTable[current.preset].name}, ${text}` : text;
		}
	}

	/* Pausing a repeating visit: up to eight weeks, with the skipped visits listed. */
	function mountVisitPause() {
		const pause = pick('[data-dtp-pause]', pageRoot);
		if (!pause) return;
		const everyField = pick('#dtp-cadence', pause);
		const visitList = pick('[data-dtp-deliveries]', pause);
		const verdict = pick('[data-dtp-pause-summary]', pause);
		const firstVisit = shiftDays(thisDay, (2 - thisDay.getDay() + 7) % 7 || 7);
		let visitKeys = new Set(upcomingVisits().map(isoKey));
		let confirmed = false;

		const calendar = createCalendar(pick('[data-dtp-cal]', pause), {
			select: 'range',
			earliest: shiftDays(thisDay, 1),
			latest: shiftDays(thisDay, 180),
			longestSpan: 56,
			marker: (when) => visitKeys.has(isoKey(when)) && 'visit day',
			onPick: () => {
				confirmed = false;
				refreshPause();
			},
		});

		everyField.addEventListener('change', () => {
			visitKeys = new Set(upcomingVisits().map(isoKey));
			calendar.repaint();
			refreshPause();
		});
		pick('[data-dtp-pause-save]', pause).addEventListener('click', () => {
			const { start: from, end: to } = calendar.span();
			if (from && to) {
				confirmed = true;
				refreshPause();
				return;
			}
			verdict.textContent = from
				? 'Pick the last day of the pause first.'
				: 'Pick the first and last day of the pause first.';
		});
		pick('[data-dtp-pause-clear]', pause).addEventListener('click', () => {
			confirmed = false;
			calendar.selectSpan(null, null);
			refreshPause();
		});
		refreshPause();

		function weeksApart() {
			return Math.min(4, Math.max(1, parseInt(everyField.value, 10) || 2));
		}

		function upcomingVisits() {
			const gap = 7 * weeksApart();
			return Array.from({ length: 16 }, (unused, index) => shiftDays(firstVisit, index * gap));
		}

		function refreshPause() {
			const { start: from, end: to } = calendar.span();
			const visits = upcomingVisits();
			const paused = (when) => from && to && when >= from && when <= to;

			visitList.innerHTML = visits
				.slice(0, 6)
				.map((when) => {
					const skipped = paused(when);
					return `<li class="dtp-deliveries-item${skipped ? ' is-skipped' : ''}"><span>${dayName(when)}</span><span class="dtp-deliveries-state">${skipped ? 'Skipped' : 'Scheduled'}</span></li>`;
				})
				.join('');

			if (!from) {
				verdict.textContent = 'Pick the first and last day of the pause. Up to eight weeks.';
				return;
			}
			if (!to) {
				verdict.textContent = `Paused from ${dayName(from)}. Now pick the last day.`;
				return;
			}
			const missed = visits.filter(paused).length;
			const resumes = visits.find((when) => when > to);
			const lead = confirmed ? 'Paused. ' : '';
			verdict.textContent = `${lead}${daysApart(from, to) + 1} days, skipping ${counted(missed, ' visit', ' visits')}. Visits start again ${dayName(resumes)}.`;
		}
	}

	/* Training sessions: busy days carry a dot, and a picked day lists its seats. */
	function mountTrainingSessions() {
		const sessions = pick('[data-dtp-classes]', pageRoot);
		if (!sessions) return;
		const dayHeading = pick('[data-dtp-classes-day]', sessions);
		const sessionList = pick('[data-dtp-classes-list]', sessions);
		const nextBlock = pick('[data-dtp-soon]', sessions);
		const nextList = pick('[data-dtp-soon-list]', sessions);
		const mySeats = new Set();
		const seatsGone = new Map();
		const horizon = shiftDays(thisDay, 120);

		/* Each session runs on one weekday, in the weeks of the month its rule allows. */
		const timetable = [
			{
				weekday: 6,
				runs: () => true,
				id: 'board',
				time: '10:00am',
				name: 'Schedule board basics',
				seats: 8,
				price: 45,
			},
			{
				weekday: 3,
				runs: (week) => week % 2 === 0,
				id: 'travel',
				time: '4:30pm',
				name: 'Travel planning workshop',
				seats: 12,
				price: 25,
			},
			{
				weekday: 4,
				runs: (week) => week === 1,
				id: 'safety',
				time: '3:00pm',
				name: 'Lifting and handling refresher',
				seats: 10,
				price: 30,
			},
			{
				weekday: 0,
				runs: (week) => week === 2,
				id: 'portal',
				time: '11:00am',
				name: 'Customer portal setup',
				seats: 6,
				price: 40,
			},
			{
				weekday: 6,
				runs: (week) => week === 3,
				id: 'shadow',
				time: '2:00pm',
				name: 'Shadow day for new schedulers',
				seats: 10,
				price: 15,
			},
		];

		let focusDay = null;
		const calendar = createCalendar(pick('[data-dtp-cal]', sessions), {
			earliest: thisDay,
			latest: horizon,
			marker: (when) => {
				const total = sessionsOn(when).length;
				return total && counted(total, ' session', ' sessions');
			},
			onPick: (when) => {
				focusDay = when;
				drawDay();
			},
		});

		sessionList.addEventListener('click', (event) => {
			const button = event.target.closest('[data-dtp-book]');
			if (!button) return;
			const key = button.getAttribute('data-dtp-book');
			if (mySeats.has(key)) mySeats.delete(key);
			else mySeats.add(key);
			drawDay();
			pick(`[data-dtp-book="${key}"]`, sessionList)?.focus();
		});
		nextList.addEventListener('click', (event) => {
			const button = event.target.closest('[data-dtp-jump]');
			if (!button) return;
			focusDay = dateFromKey(button.getAttribute('data-dtp-jump'));
			calendar.selectDay(focusDay);
			drawDay();
			dayHeading.focus();
		});

		let opening = thisDay;
		while (!sessionsOn(opening).length) opening = shiftDays(opening, 1);
		focusDay = opening;
		calendar.selectDay(opening);
		drawDay();

		function sessionsOn(when) {
			const weekOfMonth = Math.ceil(when.getDate() / 7);
			const running = timetable.filter((entry) => entry.weekday === when.getDay() && entry.runs(weekOfMonth));
			return running.map(({ id, time, name, seats, price }) => {
				const key = isoKey(when) + id;
				if (!seatsGone.has(key)) seatsGone.set(key, Math.floor(stableFraction(when, seats) * (seats - 1)));
				const left = seats - seatsGone.get(key) - (mySeats.has(key) ? 1 : 0);
				return { key, left, id, time, name, seats, price };
			});
		}

		/* The next few sessions after the chosen day, each one click away. */
		function drawUpcoming() {
			const upcoming = [];
			for (let when = shiftDays(focusDay, 1); upcoming.length < 3 && when <= horizon; when = shiftDays(when, 1)) {
				for (const session of sessionsOn(when)) {
					if (upcoming.length < 3) upcoming.push({ when, session });
				}
			}
			nextList.innerHTML = upcoming
				.map(
					({ when, session }) =>
						`<li><button type="button" class="dtp-soon-item" data-dtp-jump="${isoKey(when)}"><span class="dtp-soon-date">${dayName(when)}</span><span class="dtp-soon-name">${session.name}</span></button></li>`,
				)
				.join('');
			nextBlock.hidden = !upcoming.length;
		}

		function sessionMarkup(session) {
			const mine = mySeats.has(session.key);
			const seatText = session.left <= 0 ? 'fully booked' : counted(session.left, ' seat left', ' seats left');
			const action =
				session.left <= 0 && !mine
					? '<span class="dtp-events-full">Full</span>'
					: `<button type="button" class="btn btn-sm ${mine ? 'btn-outline-secondary' : 'btn-primary'}" aria-label="${mine ? 'Booked. Cancel seat at ' : 'Book a seat at '}${session.name}" aria-pressed="${mine}" data-dtp-book="${session.key}">${mine ? '<i class="bi bi-check-lg" aria-hidden="true"></i> Booked' : 'Book a seat'}</button>`;
			return `<li class="dtp-events-item"><p class="dtp-events-time">${session.time}</p><p class="dtp-events-name">${session.name}</p><p class="dtp-events-meta">$${session.price}, ${seatText}</p>${action}</li>`;
		}

		function drawDay() {
			const onTheDay = sessionsOn(focusDay);
			dayHeading.textContent = longDate(focusDay);
			drawUpcoming();
			sessionList.innerHTML = onTheDay.length
				? onTheDay.map(sessionMarkup).join('')
				: '<li class="dtp-events-empty">Nothing on this day. Days with a dot have sessions.</li>';
		}
	}

	/* Weekend on-call: a handful of loose days, capped at six. */
	function mountOnCallDays() {
		const onCall = pick('[data-dtp-market]', pageRoot);
		if (!onCall) return;
		const chosenList = pick('[data-dtp-market-list]', onCall);
		const tally = pick('[data-dtp-market-count]', onCall);
		const hint = pick('[data-dtp-market-note]', onCall);
		const clearAll = pick('[data-dtp-market-clear]', onCall);
		const CAP = 6;
		const onCallWeekdays = [0, 5, 6];

		const calendar = createCalendar(pick('[data-dtp-cal]', onCall), {
			select: 'multiple',
			mostDays: CAP,
			earliest: thisDay,
			latest: shiftDays(thisDay, 150),
			closedWhen: (when) => !onCallWeekdays.includes(when.getDay()),
			reason: (when) => (onCallWeekdays.includes(when.getDay()) ? '' : 'not an on-call day'),
			onPick: () => {
				hint.textContent = 'On-call runs Fridays, Saturdays and Sundays.';
				drawChosen();
			},
			onFull: () => {
				hint.textContent = 'Six days is the most for one quarter. Take one out to add another.';
			},
		});

		chosenList.addEventListener('click', (event) => {
			const button = event.target.closest('[data-dtp-unpick]');
			if (!button) return;
			const when = dateFromKey(button.getAttribute('data-dtp-unpick'));
			const position = [...pickAll('[data-dtp-unpick]', chosenList)].indexOf(button);
			calendar.dropDay(when);
			hint.textContent = `Removed ${dayName(when)}.`;
			drawChosen();
			const remaining = pickAll('[data-dtp-unpick]', chosenList);
			(remaining[Math.min(position, remaining.length - 1)] || clearAll).focus();
		});
		clearAll.addEventListener('click', () => {
			calendar.replaceDays([]);
			hint.textContent = 'All days cleared.';
			drawChosen();
		});

		/* Opens with the next two Saturdays already chosen. */
		const saturday = shiftDays(thisDay, (6 - thisDay.getDay() + 7) % 7 || 7);
		calendar.replaceDays([saturday, shiftDays(saturday, 14)]);
		calendar.revealMonth(saturday);
		drawChosen();

		function drawChosen() {
			const chosen = calendar.pickedDays();
			tally.textContent = `${chosen.length} of ${CAP}`;
			chosenList.innerHTML = chosen.length
				? chosen
						.map(
							(when) =>
								`<li class="dtp-picked-item"><span>${dayName(when)}</span><button type="button" class="dtp-picked-x" aria-label="Remove ${fullDate(when)}" data-dtp-unpick="${isoKey(when)}"><i class="bi bi-x" aria-hidden="true"></i></button></li>`,
						)
						.join('')
				: '<li class="dtp-picked-empty">No days yet. Pick them on the calendar.</li>';
		}
	}

	/* A maintenance plan that starts in a chosen month; the day of the month does not matter. */
	function mountPlanMonths() {
		const plan = pick('[data-dtp-gift]', pageRoot);
		if (!plan) return;
		const tiles = pick('[data-dtp-month-grid]', plan);
		const yearText = pick('[data-dtp-year-label]', plan);
		const lengthField = pick('#dtp-gift-len', plan);
		const firstText = pick('[data-dtp-gift-first]', plan);
		const lastText = pick('[data-dtp-gift-last]', plan);
		const priceText = pick('[data-dtp-gift-total]', plan);
		const earliestMonth = monthStart(thisDay, 1);
		const firstYear = earliestMonth.getFullYear();
		const finalYear = thisDay.getFullYear() + 1;
		let shownYear = firstYear;
		let startMonth = earliestMonth;
		let rovingIndex = null;

		tiles.addEventListener('click', (event) => {
			const tile = event.target.closest('[data-dtp-month]');
			if (!tile || tile.getAttribute('aria-disabled') === 'true') return;
			startMonth = new Date(shownYear, Number(tile.getAttribute('data-dtp-month')), 1, 12);
			rovingIndex = startMonth.getMonth();
			drawYear(true);
		});
		tiles.addEventListener('keydown', onTileKey);
		for (const arrow of pickAll('[data-dtp-year]', plan)) {
			arrow.addEventListener('click', () => {
				shownYear += Number(arrow.getAttribute('data-dtp-year'));
				rovingIndex = null;
				drawYear(false);
			});
		}
		lengthField.addEventListener('change', summarize);
		lengthField.addEventListener('input', summarize);
		drawYear(false);

		function firstTuesdayOf(year, month) {
			const first = new Date(year, month, 1, 12);
			return shiftDays(first, (2 - first.getDay() + 7) % 7);
		}

		function defaultIndex() {
			if (startMonth.getFullYear() === shownYear) return startMonth.getMonth();
			return shownYear === firstYear ? earliestMonth.getMonth() : 0;
		}

		function drawYear(takeFocus) {
			yearText.textContent = String(shownYear);
			atLimit(
				pick('[data-dtp-year="-1"]', plan),
				shownYear <= firstYear ? `${firstYear} is the earliest year` : '',
			);
			atLimit(pick('[data-dtp-year="1"]', plan), shownYear >= finalYear ? `${finalYear} is the latest year` : '');
			const tabIndex = rovingIndex ?? defaultIndex();
			const buttons = [];
			for (let month = 0; month < 12; month++) {
				const when = new Date(shownYear, month, 1, 12);
				const past = when < earliestMonth;
				const chosen = isSameDate(when, startMonth);
				const classes = `dtp-month${chosen ? ' is-selected' : ''}${past ? ' is-off' : ''}`;
				buttons.push(
					`<button type="button" class="${classes}" aria-label="${monthYear(when)}${past ? ', not available' : ''}" aria-pressed="${chosen}"${past ? ' aria-disabled="true"' : ''} data-dtp-month="${month}" tabindex="${month === tabIndex ? 0 : -1}">${formatDate(when, { month: 'short' })}</button>`,
				);
			}
			tiles.innerHTML = buttons.join('');
			if (takeFocus) pick('[tabindex="0"]', tiles).focus();
			summarize();
		}

		function summarize() {
			const months = Math.min(12, Math.max(3, parseInt(lengthField.value, 10) || 6));
			const finalMonth = monthStart(startMonth, months - 1);
			firstText.textContent = `${dayName(firstTuesdayOf(startMonth.getFullYear(), startMonth.getMonth()))}, ${startMonth.getFullYear()}`;
			lastText.textContent = `${dayName(firstTuesdayOf(finalMonth.getFullYear(), finalMonth.getMonth()))}, ${finalMonth.getFullYear()}`;
			priceText.textContent = `${dollars(months * 95)} for ${counted(months, ' visit', ' visits')}`;
		}

		/* Arrows walk the grid and roll into the next or previous year at its edges. */
		function onTileKey(event) {
			const tile = event.target.closest('[data-dtp-month]');
			if (!tile) return;
			const perRow = getComputedStyle(tiles).gridTemplateColumns.split(' ').length;
			const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -perRow, ArrowDown: perRow, Home: -99, End: 99 };
			if (!(event.key in offsets)) return;
			event.preventDefault();
			let index = Number(tile.getAttribute('data-dtp-month')) + offsets[event.key];
			if (index < 0) {
				if (event.key === 'Home' || shownYear <= firstYear) {
					index = 0;
				} else {
					shownYear -= 1;
					index += 12;
				}
			}
			if (index > 11) {
				if (event.key === 'End' || shownYear >= finalYear) {
					index = 11;
				} else {
					shownYear += 1;
					index -= 12;
				}
			}
			rovingIndex = index;
			drawYear(true);
		}
	}

	/* A crew booked by the whole week, Monday first, with ISO week numbers. */
	function mountCrewWeek() {
		const crew = pick('[data-dtp-week]', pageRoot);
		if (!crew) return;
		const headcount = pick('#dtp-week-techs', crew);
		const weekText = pick('[data-dtp-week-label]', crew);
		const startText = pick('[data-dtp-week-drop]', crew);
		const costText = pick('[data-dtp-week-total]', crew);
		const comingMonday = shiftDays(thisDay, (1 - thisDay.getDay() + 7) % 7 || 7);
		const calendar = createCalendar(pick('[data-dtp-cal]', crew), {
			select: 'week',
			firstWeekday: 1,
			showWeekNumbers: true,
			earliest: comingMonday,
			latest: shiftDays(comingMonday, 7 * 26 - 1),
			onPick: () => describeWeek(),
		});
		headcount.addEventListener('change', describeWeek);
		headcount.addEventListener('input', describeWeek);
		calendar.selectSpan(comingMonday, shiftDays(comingMonday, 6));
		describeWeek();

		function describeWeek() {
			const { start: monday, end: sunday } = calendar.span();
			const people = parseInt(headcount.value, 10) || 4;
			costText.textContent = `${dollars(people * 5 * 280)} for ${counted(people, ' person', ' people')}, 5 days`;
			if (!monday) return;
			weekText.textContent = `Week ${isoWeekNumber(monday)}, ${shortDate(monday)} to ${shortDate(sunday)}`;
			startText.textContent = longDate(monday);
		}
	}

	/* The last service date, picked from a calendar only, and when the next one falls due. */
	function mountServiceInterval() {
		const service = pick('[data-dtp-bestbefore]', pageRoot);
		if (!service) return;
		const servedField = pick('#dtp-served', service);
		const intervalField = pick('#dtp-keeps', service);
		const holder = pick('[data-dtp-popup]', service);
		const shown = {
			served: pick('[data-dtp-bb-served]', service),
			due: pick('[data-dtp-bb-date]', service),
			bar: pick('[data-dtp-bb-fill]', service),
			remaining: pick('[data-dtp-bb-left]', service),
		};
		let lastService = shiftDays(thisDay, -4);
		const calendar = createCalendar(pick('[data-dtp-cal]', holder), {
			earliest: shiftDays(thisDay, -30),
			latest: thisDay,
			onPick: (when) => {
				lastService = when;
				refreshDue();
				panel.hide(true);
			},
		});
		const panel = attachPanel(holder, { whenShown: () => calendar.focusGrid() });

		servedField.addEventListener('click', () => panel.show());
		servedField.addEventListener('keydown', (event) => {
			const opens = event.key === 'Enter' || (event.key === 'ArrowDown' && event.altKey);
			if (!opens) return;
			event.preventDefault();
			panel.show();
		});
		intervalField.addEventListener('change', refreshDue);
		intervalField.addEventListener('input', refreshDue);
		calendar.selectDay(lastService);
		refreshDue();

		function refreshDue() {
			const span = 7 * Math.min(26, Math.max(2, parseInt(intervalField.value, 10) || 8));
			const due = shiftDays(lastService, span);
			const daysLeft = daysApart(thisDay, due);
			const share = Math.max(0, Math.min(100, (daysLeft / span) * 100));
			servedField.value = fullDate(lastService);
			shown.served.textContent = shortDateWithYear(lastService);
			shown.due.textContent = shortDateWithYear(due);
			shown.bar.style.setProperty('--fill', `${share}%`);
			shown.remaining.textContent = `${daysLeft} of ${counted(span, ' day', ' days')} until the next service. Book it from ${shortDate(shiftDays(due, -7))}.`;
		}
	}

	/* A birthday in three fields, checked against the length of the month. */
	function mountBirthday() {
		const birthday = pick('[data-dtp-birthday]', pageRoot);
		if (!birthday) return;
		const monthSelect = pick('#dtp-dob-m', birthday);
		const dayInput = pick('#dtp-dob-d', birthday);
		const yearInput = pick('#dtp-dob-y', birthday);
		const problemText = pick('#dtp-dob-error', birthday);
		const savedText = pick('[data-dtp-dob-status]', birthday);
		const trio = [monthSelect, dayInput, yearInput];

		/* Numbers only; a second digit in the day jumps on to the year. */
		dayInput.addEventListener('input', () => {
			dayInput.value = dayInput.value.replace(/\D/g, '');
			if (dayInput.value.length === 2) yearInput.focus();
		});
		yearInput.addEventListener('input', () => {
			yearInput.value = yearInput.value.replace(/\D/g, '');
		});
		birthday.addEventListener('submit', (event) => {
			event.preventDefault();
			saveBirthday();
		});
		for (const field of trio) {
			field.addEventListener('change', () => {
				savedText.textContent = '';
			});
		}

		function markInvalid(field, message) {
			field.classList.add('is-invalid');
			field.setAttribute('aria-invalid', 'true');
			return { field, message };
		}

		/** Returns the first problem as { field, message }, or null when the date holds up. */
		function firstProblem() {
			for (const field of trio) {
				field.classList.remove('is-invalid');
				field.removeAttribute('aria-invalid');
			}
			const month = parseInt(monthSelect.value, 10);
			const day = parseInt(dayInput.value, 10);
			const year = yearInput.value ? parseInt(yearInput.value, 10) : null;
			if (!month) return markInvalid(monthSelect, 'Choose the month of the birthday.');
			if (!day) return markInvalid(dayInput, 'Enter the day of the month.');
			const yearIsWrong = yearInput.value.length !== 4 || year < 1900 || year > thisDay.getFullYear() - 13;
			if (year !== null && yearIsWrong)
				return markInvalid(yearInput, 'Enter a four-digit year, or leave it out.');
			const longest = monthLength(month, year || 2024);
			if (day >= 1 && day <= longest) return null;
			const monthName = monthSelect.options[monthSelect.selectedIndex].text;
			const leapNote = month === 2 && year ? ` in ${year}` : '';
			return markInvalid(dayInput, `${monthName} only has ${longest} days${leapNote}.`);
		}

		function saveBirthday() {
			const problem = firstProblem();
			problemText.textContent = problem ? problem.message : '';
			problemText.hidden = !problem;
			if (problem) {
				savedText.textContent = '';
				problem.field.focus();
				return;
			}
			const month = parseInt(monthSelect.value, 10);
			const day = parseInt(dayInput.value, 10);
			let upcoming = new Date(thisDay.getFullYear(), month - 1, day, 12);
			if (upcoming < thisDay) upcoming = new Date(thisDay.getFullYear() + 1, month - 1, day, 12);
			/* February 29 in a year without one rolls over to March 1. */
			if (upcoming.getMonth() !== month - 1) upcoming = new Date(upcoming.getFullYear(), 2, 1, 12);
			savedText.innerHTML = `<i class="bi bi-check-circle" aria-hidden="true"></i> Saved. It shows on the team calendar on ${formatDate(upcoming, { month: 'long', day: 'numeric', year: 'numeric' })}.`;
		}
	}

	/* The browser's own date and time inputs, with messages read from their validity state. */
	function mountNativeInputs() {
		const pickup = pick('[data-dtp-native]', pageRoot);
		if (!pickup) return;
		const dayInput = pick('#dtp-pickup-date', pickup);
		const timeInput = pick('#dtp-pickup-time', pickup);
		const storedText = pick('[data-dtp-native-iso]', pickup);
		const readableText = pick('[data-dtp-native-human]', pickup);
		const doneText = pick('[data-dtp-native-status]', pickup);
		const holdUntil = shiftDays(thisDay, 30);
		dayInput.min = isoKey(thisDay);
		dayInput.max = isoKey(holdUntil);

		/* Each input lists its validity flags in the order they are reported. */
		const checks = new Map([
			[
				dayInput,
				() => [
					['valueMissing', 'Choose a pickup day.'],
					['rangeUnderflow', 'That day has passed. Pick today or later.'],
					['rangeOverflow', `Supplies are held for 30 days, until ${dayName(holdUntil)}.`],
					['badInput', 'Enter a full date.'],
				],
			],
			[
				timeInput,
				() => [
					['valueMissing', 'Choose a time.'],
					['rangeUnderflow', 'The supplies desk is open 9am to 5pm.'],
					['rangeOverflow', 'The supplies desk is open 9am to 5pm.'],
					['stepMismatch', 'Pick a quarter hour, like 10:15 am or 10:30 am.'],
				],
			],
		]);

		for (const input of [dayInput, timeInput]) {
			input.addEventListener('input', () => {
				describePickup();
				doneText.textContent = '';
				if (input.classList.contains('is-invalid')) flagField(input, errorNodeFor(input), complaintFor(input));
			});
			input.addEventListener('change', describePickup);
		}
		pickup.addEventListener('submit', (event) => {
			event.preventDefault();
			const dayProblem = complaintFor(dayInput);
			const timeProblem = complaintFor(timeInput);
			flagField(dayInput, errorNodeFor(dayInput), dayProblem);
			flagField(timeInput, errorNodeFor(timeInput), timeProblem);
			if (dayProblem || timeProblem) {
				doneText.textContent = '';
				(dayProblem ? dayInput : timeInput).focus();
				return;
			}
			doneText.innerHTML = `<i class="bi bi-check-circle" aria-hidden="true"></i> Booked. Your supplies will be at the desk ${readableText.textContent}.`;
		});
		describePickup();

		function complaintFor(input) {
			const match = checks
				.get(input)()
				.find(([flag]) => input.validity[flag]);
			return match ? match[1] : '';
		}

		function errorNodeFor(input) {
			return pick(`#${input.id}-error`, pickup);
		}

		function describePickup() {
			if (!dayInput.value) {
				storedText.textContent = 'Nothing yet';
				readableText.textContent = 'Nothing yet';
				return;
			}
			storedText.textContent = timeInput.value ? `${dayInput.value}T${timeInput.value}` : dayInput.value;
			let clockText = '';
			if (timeInput.value) {
				const [hours, minutes] = timeInput.value.split(':').map(Number);
				clockText = ` at ${hours % 12 || 12}:${twoDigits(minutes)}${hours < 12 ? 'am' : 'pm'}`;
			}
			readableText.textContent = `${longDate(dateFromKey(dayInput.value))}${clockText}`;
		}
	}

	/* The kind pills hide the cards that do not match. */
	function mountKindChips() {
		const deck = pick('[data-dtp-grid]', pageRoot);
		const shownCount = pick('[data-dtp-count]', pageRoot);
		const allCards = [...pickAll('[data-dtp-kind]', deck)];
		const kindPills = pickAll('[data-dtp-filter]', pageRoot);

		for (const pill of kindPills) {
			pill.addEventListener('click', () => {
				for (const other of kindPills) other.setAttribute('aria-pressed', String(other === pill));
				showKind(pill.getAttribute('data-dtp-filter'));
			});
		}

		function showKind(kind) {
			const everything = kind === 'all';
			const visible = allCards.filter((card) => everything || card.getAttribute('data-dtp-kind') === kind);
			for (const card of allCards) {
				card.classList.toggle('is-hidden', !visible.includes(card));
				card.classList.remove('is-alone');
			}
			deck.classList.toggle('is-filtered', !everything);
			/* A half-width card left without a partner spans the row; full-width cards are not counted. */
			const halves = visible.filter((card) => !card.classList.contains('dtp-card-full'));
			if (!everything && halves.length % 2 === 1) halves[halves.length - 1].classList.add('is-alone');
			shownCount.textContent = counted(visible.length, ' date picker', ' date pickers');
		}
	}

	start();

	/* DOM lookups, shared by every helper above. */
	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
