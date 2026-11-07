/**
 * Drives the eight time fields on time-fields.html: typed entry with a
 * popover, a clock dial, a scroll wheel, a visit length, a delivery window,
 * pickup slots, weekly opening hours and the browser's own time input.
 * Each field is found by its data hook and owns its card, so one card and
 * its mount function can travel to another page together. Inside, a time
 * of day is a count of minutes since midnight until it is printed.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-tp-root]');
	if (!pageRoot) return;

	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const NOON = 12 * 60;
	const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/* Words people type instead of digits, and the minute each one means. */
	const SPOKEN_TIMES = { noon: 720, midday: 720, midnight: 0 };

	/* Scroll wheels lose their position while their card is hidden, so each
     one leaves a callback here that the filter runs after it reflows. */
	const wheelRealigners = [];

	/* Each hook is mounted in this order; the filter chips come last. */
	const MOUNTS = {
		'[data-tp-window]': mountDeliveryWindow,
		'[data-tp-clock]': mountClockFace,
		'[data-tp-wheel]': mountScrollWheel,
		'[data-tp-slots]': mountPickupSlots,
		'[data-tp-typed]': mountTypedEntry,
		'[data-tp-duration]': mountVisitLength,
		'[data-tp-native]': mountNativeRange,
		'[data-tp-week]': mountWeeklyHours,
	};

	function start() {
		for (const [hook, mount] of Object.entries(MOUNTS)) {
			for (const host of pickAll(hook, pageRoot)) mount(host);
		}
		mountKindFilter();
	}

	/* Times arrive as "HH:MM" strings or as typed text, are worked on as minutes,
     and are printed in the 24-hour, 12-hour or short axis form. */
	function twoDigits(value) {
		return String(value).padStart(2, '0');
	}

	/** Turns a stored "HH:MM" string into minutes after midnight. */
	function minutesOf(clock) {
		const [hours, minutes] = String(clock).split(':').map(Number);
		return hours * 60 + (minutes || 0);
	}

	function hourOf(total) {
		return Math.floor(total / 60) % 24;
	}

	function dialHour(hour) {
		return hour % 12 || 12;
	}

	function halfOf(hour) {
		return hour < 12 ? 'AM' : 'PM';
	}

	/** The stored form: "07:30", "18:45". */
	function clock24(total) {
		return `${twoDigits(hourOf(total))}:${twoDigits(total % 60)}`;
	}

	/** The spoken form: "7:30 AM", "6:45 PM". */
	function clock12(total) {
		const hour = hourOf(total);
		return `${dialHour(hour)}:${twoDigits(total % 60)} ${halfOf(hour)}`;
	}

	/** A short axis label that leaves off ":00", as in "9 AM" or "12:30 PM". */
	function tickLabel(total) {
		const hour = hourOf(total);
		const minutes = total % 60;
		const tail = minutes ? `:${twoDigits(minutes)}` : '';
		return `${dialHour(hour)}${tail} ${halfOf(hour)}`;
	}

	/** "45 min", "1 hour", "3 hours" or "2 h 15 min". */
	function spanWords(total) {
		const hours = Math.floor(total / 60);
		const minutes = total % 60;
		if (!hours) return `${minutes} min`;
		if (minutes) return `${hours} h ${minutes} min`;
		return `${hours}${hours === 1 ? ' hour' : ' hours'}`;
	}

	function minutesNow() {
		const now = new Date();
		return now.getHours() * 60 + now.getMinutes();
	}

	/**
	 * Reads a time the way people tend to type one: 930, 9:30, 9.30pm, 7p,
	 * 18:45 or noon. Returns minutes after midnight, or null when the text
	 * is not a time of day.
	 */
	function readTyped(raw) {
		const text = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
		if (!text) return null;
		if (Object.hasOwn(SPOKEN_TIMES, text)) return SPOKEN_TIMES[text];

		const parts = text.match(
			/^(?<hour>\d{1,2})(?:\s?[:.h]?\s?(?<minute>\d{2}))?\s?(?:(?<half>[ap])(?:m|\.m\.)?)?$/,
		);
		if (!parts) return null;

		const { hour, minute, half } = parts.groups;
		const minutes = minute ? parseInt(minute, 10) : 0;
		let hours = parseInt(hour, 10);
		if (minutes > 59) return null;

		if (!half) return hours > 23 ? null : hours * 60 + minutes;
		if (hours < 1 || hours > 12) return null;
		hours = (hours % 12) + (half === 'p' ? 12 : 0);
		return hours * 60 + minutes;
	}

	/** Keeps a count inside 0..size-1, wrapping round in both directions. */
	function wrapAround(value, size) {
		return ((value % size) + size) % size;
	}

	function clamp(value, low, high) {
		return Math.min(high, Math.max(low, value));
	}

	/** Lower-cases the first letter so a message can follow a field name. */
	function lowerFirst(message) {
		return `${message.charAt(0).toLowerCase()}${message.slice(1)}`;
	}

	/* Feedback that every form on the page shares: the error summary and the
     success line. */

	/** Creates an element with its class and, when one is given, its text. */
	function make(tag, className, text) {
		const element = document.createElement(tag);
		if (className) element.className = className;
		if (text !== undefined) element.textContent = text;
		return element;
	}

	function iconNode(name) {
		const icon = make('i', `bi ${name}`);
		icon.setAttribute('aria-hidden', 'true');
		return icon;
	}

	/**
	 * Fills the summary box at the top of a form with a heading and one link
	 * per problem; each link scrolls to and focuses its field. An empty list
	 * clears and hides the box.
	 */
	function fillSummary(panel, heading, problems) {
		if (!panel) return;
		if (!problems.length) {
			panel.hidden = true;
			panel.innerHTML = '';
			return;
		}

		const title = make('p', 'tp-errors-title');
		title.append(iconNode('bi-exclamation-circle'), heading);

		const links = make('ul');
		for (const problem of problems) {
			const jump = make('a', '', problem.text);
			jump.href = `#${problem.id}`;
			jump.addEventListener('click', (event) => {
				event.preventDefault();
				focusField(problem.id);
			});
			const entry = make('li');
			entry.append(jump);
			links.append(entry);
		}

		panel.replaceChildren(title, links);
		panel.hidden = false;
		panel.focus();
	}

	function focusField(id) {
		const field = document.getElementById(id);
		if (!field) return;
		field.scrollIntoView({ block: 'center', behavior: calmMotion ? 'auto' : 'smooth' });
		field.focus({ preventScroll: true });
	}

	/** Writes a success line with a check mark in front of it. */
	function markDone(target, message) {
		target.replaceChildren(iconNode('bi-check-circle'), message);
		target.classList.add('tp-ok');
	}

	/* The delivery window has two handles on a half-hour track, with the hours
     already booked drawn above it. */
	function mountDeliveryWindow(card) {
		const STEP = 30;
		/* Deliveries already booked in each hour, out of ten places. */
		const BOOKED = [2, 4, 7, 9, 8, 6, 9, 10, 7, 5, 6, 9, 8, 4];

		const opens = minutesOf(card.getAttribute('data-start'));
		const closes = minutesOf(card.getAttribute('data-end'));
		const lastStep = (closes - opens) / STEP;
		const minGap = ((parseFloat(card.getAttribute('data-min')) || 2) * 60) / STEP;
		const track = pick('[data-tp-win-track]', card);
		const band = pick('[data-tp-win-fill]', card);
		const handles = {
			from: pick('[data-tp-win-thumb="from"]', card),
			to: pick('[data-tp-win-thumb="to"]', card),
		};
		const readouts = {
			from: pick('[data-tp-win-from]', card),
			to: pick('[data-tp-win-to]', card),
		};
		const lengthLine = pick('[data-tp-win-len]', card);
		const feeBadge = pick('[data-tp-win-fee]', card);
		const edges = {
			from: (minutesOf(card.getAttribute('data-from')) - opens) / STEP,
			to: (minutesOf(card.getAttribute('data-to')) - opens) / STEP,
		};
		let grabbed = null;

		nameTomorrow();
		const loadBars = drawLoad();
		drawTicks();

		for (const edge of Object.keys(handles)) {
			handles[edge].addEventListener('keydown', (event) => nudge(edge, event));
		}
		track.addEventListener('pointerdown', grab);
		track.addEventListener('pointermove', (event) => {
			if (grabbed) moveEdge(grabbed, stepAt(event.clientX));
		});
		track.addEventListener('pointerup', release);
		track.addEventListener('pointercancel', release);

		for (const preset of pickAll('[data-tp-win-preset]', card)) {
			preset.addEventListener('click', () => {
				const [from, to] = preset.getAttribute('data-tp-win-preset').split('-').map(minutesOf);
				edges.from = Math.max(0, (from - opens) / STEP);
				edges.to = Math.min(lastStep, (to - opens) / STEP);
				paint();
			});
		}

		paint();

		function nameTomorrow() {
			const label = pick('[data-tp-win-day]', card);
			if (!label) return;
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			label.textContent = WEEKDAYS[tomorrow.getDay()];
		}

		/** One bar per hour, as tall as that hour is booked (never below 8%). */
		function drawLoad() {
			const barRow = pick('[data-tp-win-load]', card);
			const hourCount = (closes - opens) / 60;
			const made = [];
			for (let hour = 0; hour < hourCount; hour++) {
				const bar = make('span', 'tp-window-bar');
				bar.style.height = `${Math.max(8, (BOOKED[hour % BOOKED.length] / 10) * 100)}%`;
				barRow.appendChild(bar);
				made.push(bar);
			}
			return made;
		}

		/** A label under the track every two hours. */
		function drawTicks() {
			const axis = pick('[data-tp-win-ticks]', card);
			for (let at = opens; at <= closes; at += 120) {
				const tick = make('span', 'tp-window-tick');
				tick.style.left = `calc(${((at - opens) / (closes - opens)) * 100}% + 0px)`;
				tick.textContent = tickLabel(at);
				axis.appendChild(tick);
			}
		}

		function paint() {
			const fromAt = opens + edges.from * STEP;
			const toAt = opens + edges.to * STEP;
			const fromPct = (edges.from / lastStep) * 100;
			const toPct = (edges.to / lastStep) * 100;

			handles.from.style.left = `${fromPct}%`;
			handles.to.style.left = `${toPct}%`;
			band.style.left = `${fromPct}%`;
			band.style.width = `${toPct - fromPct}%`;

			const limits = {
				from: [0, edges.to - minGap],
				to: [edges.from + minGap, lastStep],
			};
			for (const [edge, at] of [
				['from', fromAt],
				['to', toAt],
			]) {
				const handle = handles[edge];
				handle.setAttribute('aria-valuemin', limits[edge][0]);
				handle.setAttribute('aria-valuemax', limits[edge][1]);
				handle.setAttribute('aria-valuenow', edges[edge]);
				handle.setAttribute('aria-valuetext', clock12(at));
				readouts[edge].textContent = clock12(at);
			}

			const length = toAt - fromAt;
			const charged = length < 180;
			lengthLine.textContent = `${spanWords(length).replace(/^(\d+) hours?$/, '$1 hour')} window`;
			feeBadge.textContent = charged ? '$3.50 delivery' : 'Free delivery';
			feeBadge.classList.toggle('is-paid', charged);

			for (const [hour, bar] of loadBars.entries()) {
				const hourStart = opens + hour * 60;
				bar.classList.toggle('is-in', hourStart + 60 > fromAt && hourStart < toAt);
			}
		}

		/** Moves one edge, never past the far end or closer than the minimum. */
		function moveEdge(edge, step) {
			if (edge === 'from') edges.from = Math.max(0, Math.min(edges.to - minGap, step));
			else edges.to = clamp(step, edges.from + minGap, lastStep);
			paint();
		}

		function nudge(edge, event) {
			const jumps = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -4, PageUp: 4 };
			const ends = { Home: 0, End: lastStep };
			let target;
			if (event.key in jumps) target = edges[edge] + jumps[event.key];
			else if (event.key in ends) target = ends[event.key];
			else return;
			event.preventDefault();
			moveEdge(edge, target);
		}

		function stepAt(clientX) {
			const box = track.getBoundingClientRect();
			return Math.round(clamp((clientX - box.left) / box.width, 0, 1) * lastStep);
		}

		/**
		 * Decides which edge a press on the track should move: the handle under
		 * the pointer, otherwise the nearer one. When the window is at its
		 * narrowest, the side of the press decides.
		 */
		function edgeFor(event, step) {
			const handle = event.target.closest('[data-tp-win-thumb]');
			if (handle) return handle.getAttribute('data-tp-win-thumb');
			if (edges.from === edges.to - minGap) return step < edges.from ? 'from' : 'to';
			return Math.abs(step - edges.from) <= Math.abs(step - edges.to) ? 'from' : 'to';
		}

		function grab(event) {
			if (event.button !== 0) return;
			const step = stepAt(event.clientX);
			grabbed = edgeFor(event, step);
			event.preventDefault();
			track.setPointerCapture(event.pointerId);
			handles[grabbed].classList.add('is-dragging');
			handles[grabbed].focus({ preventScroll: true });
			moveEdge(grabbed, step);
		}

		function release() {
			if (grabbed) handles[grabbed].classList.remove('is-dragging');
			grabbed = null;
		}
	}

	/* The clock dial sets the hour first and then hands over to the minute. */
	function mountClockFace(card) {
		/* How far the numbers sit from the center, as a share of the dial. */
		const RING = 0.39;
		const dial = pick('[data-tp-clock-dial]', card);
		const numberLayer = pick('[data-tp-clock-nums]', card);
		const hand = pick('[data-tp-clock-hand]', card);
		const handTip = pick('[data-tp-clock-tip]', card);
		const hourDigits = pick('[data-tp-clock-h]', card);
		const minuteDigits = pick('[data-tp-clock-m]', card);
		const sentence = pick('[data-tp-clock-out]', card);
		const unitButtons = pickAll('[data-tp-clock-mode]', card);
		const halfRadios = pickAll('input[name="tp-clock-ap"]', card);

		const initial = minutesOf(card.getAttribute('data-value') || '07:30');
		let hour = dialHour(Math.floor(initial / 60) % 12);
		let minute = initial % 60;
		let afternoon = initial >= NOON;
		let unit = 'hour';
		let dragging = false;

		const marks = placeMarks();
		labelMarks();

		dial.addEventListener('pointerdown', (event) => {
			if (event.button !== 0) return;
			dragging = true;
			dial.classList.add('is-dragging');
			dial.setPointerCapture(event.pointerId);
			dial.focus({ preventScroll: true });
			event.preventDefault();
			aimAt(event);
		});
		dial.addEventListener('pointermove', (event) => {
			if (dragging) aimAt(event);
		});
		dial.addEventListener('pointerup', () => {
			if (!dragging) return;
			dragging = false;
			dial.classList.remove('is-dragging');
			if (unit === 'hour') switchUnit('minute');
		});
		dial.addEventListener('pointercancel', () => {
			dragging = false;
			dial.classList.remove('is-dragging');
		});
		dial.addEventListener('keydown', turnByKey);

		for (const button of unitButtons) {
			button.addEventListener('click', () => switchUnit(button.getAttribute('data-tp-clock-mode')));
		}
		for (const radio of halfRadios) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				afternoon = radio.value === 'PM';
				paint();
			});
		}

		paint();

		/** Twelve marks around the dial; only their labels change with the unit. */
		function placeMarks() {
			numberLayer.innerHTML = '';
			const made = [];
			for (let slot = 0; slot < 12; slot++) {
				const angle = (slot * 30 * Math.PI) / 180;
				const mark = make('span', 'tp-clock-num');
				mark.style.left = `${50 + RING * 100 * Math.sin(angle)}%`;
				mark.style.top = `${50 - RING * 100 * Math.cos(angle)}%`;
				mark.setAttribute('data-i', slot);
				numberLayer.appendChild(mark);
				made.push(mark);
			}
			return made;
		}

		function labelMarks() {
			for (const [slot, mark] of marks.entries()) {
				mark.textContent = unit === 'hour' ? String(slot === 0 ? 12 : slot) : twoDigits(slot * 5);
			}
		}

		function switchUnit(next) {
			if (next === unit) return;
			unit = next;
			labelMarks();
			paint();
		}

		function paint() {
			const total = ((hour % 12) + (afternoon ? 12 : 0)) * 60 + minute;
			const onHour = unit === 'hour';
			hourDigits.textContent = twoDigits(hour);
			minuteDigits.textContent = twoDigits(minute);

			for (const radio of halfRadios) radio.checked = (radio.value === 'PM') === afternoon;
			for (const button of unitButtons) {
				button.setAttribute('aria-pressed', String(button.getAttribute('data-tp-clock-mode') === unit));
			}

			let lit = hour % 12;
			if (!onHour) lit = minute % 5 === 0 ? minute / 5 : -1;
			for (const mark of marks) mark.classList.toggle('is-on', +mark.getAttribute('data-i') === lit);

			const radians = ((onHour ? (hour % 12) * 30 : minute * 6) * Math.PI) / 180;
			const reach = RING * 240;
			const tipX = (120 + reach * Math.sin(radians)).toFixed(2);
			const tipY = (120 - reach * Math.cos(radians)).toFixed(2);
			hand.setAttribute('x2', tipX);
			hand.setAttribute('y2', tipY);
			handTip.setAttribute('cx', tipX);
			handTip.setAttribute('cy', tipY);

			dial.setAttribute('aria-label', onHour ? 'Hour' : 'Minute');
			dial.setAttribute('aria-valuemin', onHour ? 1 : 0);
			dial.setAttribute('aria-valuemax', onHour ? 12 : 59);
			dial.setAttribute('aria-valuenow', onHour ? hour : minute);
			dial.setAttribute('aria-valuetext', clock12(total));
			sentence.textContent = `We'll send your schedule summary at ${clock12(total)} every day.`;
		}

		/** Points the hand at the pointer and snaps to the nearest mark or minute. */
		function aimAt(event) {
			const box = dial.getBoundingClientRect();
			const dx = event.clientX - (box.left + box.width / 2);
			const dy = event.clientY - (box.top + box.height / 2);
			let degrees = (Math.atan2(dx, -dy) * 180) / Math.PI;
			if (degrees < 0) degrees += 360;
			if (unit === 'hour') hour = Math.round(degrees / 30) % 12 || 12;
			else minute = Math.round(degrees / 6) % 60;
			paint();
		}

		function turnByKey(event) {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				switchUnit(unit === 'hour' ? 'minute' : 'hour');
				return;
			}
			const turns = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 };
			const turn = turns[event.key];
			if (!Object.hasOwn(turns, event.key)) return;
			event.preventDefault();
			if (unit === 'hour') hour = wrapAround((hour % 12) + Math.sign(turn), 12) || 12;
			else minute = wrapAround(minute + turn, 60);
			paint();
		}
	}

	/* The scroll wheel is three columns that snap to a row under the band. */
	function mountScrollWheel(card) {
		const readout = pick('[data-tp-wheel-out]', card) || pick('[data-tp-wheel-out]', pageRoot);
		const storedNote = pick('[data-tp-wheel-note]', card.closest('.tp-card'));
		const initial = minutesOf(card.getAttribute('data-value') || '14:30');
		const choices = {
			hour: Array.from({ length: 12 }, (_, slot) => String(slot + 1)),
			minute: Array.from({ length: 12 }, (_, slot) => twoDigits(slot * 5)),
			ap: ['AM', 'PM'],
		};
		const picked = {
			hour: dialHour(Math.floor(initial / 60) % 12) - 1,
			minute: Math.round((initial % 60) / 5) % 12,
			ap: initial >= NOON ? 1 : 0,
		};
		const columns = {};
		let rowHeight = 0;

		for (const column of pickAll('[data-tp-wheel-col]', card)) {
			fillColumn(column, column.getAttribute('data-tp-wheel-col'));
		}

		paint();
		requestAnimationFrame(realign);
		wheelRealigners.push(realign);

		/** Builds one column (padding, rows, padding) and wires scroll and keys. */
		function fillColumn(column, part) {
			const labels = choices[part];
			const spacer = make('div', 'tp-wheel-pad');
			columns[part] = column;
			column.replaceChildren(spacer);

			for (const [slot, label] of labels.entries()) {
				const row = make('div', 'tp-wheel-item', label);
				row.setAttribute('data-i', slot);
				row.setAttribute('aria-hidden', 'true');
				row.addEventListener('click', () => choose(part, slot, true));
				column.appendChild(row);
			}
			column.appendChild(spacer.cloneNode());

			if (part !== 'ap') {
				column.setAttribute('aria-valuemin', part === 'hour' ? 1 : 0);
				column.setAttribute('aria-valuemax', part === 'hour' ? 12 : 55);
			}

			/* Read the row under the band once scrolling has paused for 80ms. */
			let settle = null;
			column.addEventListener('scroll', () => {
				clearTimeout(settle);
				settle = setTimeout(() => {
					if (!rowHeight) return;
					const slot = clamp(Math.round(column.scrollTop / rowHeight), 0, labels.length - 1);
					if (slot === picked[part]) return;
					picked[part] = slot;
					paint();
				}, 80);
			});

			const moves = {
				ArrowDown: (slot) => slot + 1,
				ArrowUp: (slot) => slot - 1,
				PageDown: (slot) => slot + 3,
				PageUp: (slot) => slot - 3,
				Home: () => 0,
				End: () => labels.length - 1,
			};
			column.addEventListener('keydown', (event) => {
				const move = moves[event.key];
				if (!Object.hasOwn(moves, event.key)) return;
				event.preventDefault();
				choose(part, clamp(move(picked[part]), 0, labels.length - 1), true);
			});
		}

		function choose(part, slot, animate) {
			picked[part] = slot;
			if (rowHeight) {
				columns[part].scrollTo({ top: slot * rowHeight, behavior: animate && !calmMotion ? 'smooth' : 'auto' });
			}
			paint();
		}

		/** Measures a row and scrolls every column to its chosen value. */
		function realign() {
			const sample = pick('.tp-wheel-item', card);
			rowHeight = sample ? sample.getBoundingClientRect().height : 0;
			if (!rowHeight) return;
			for (const [part, column] of Object.entries(columns)) column.scrollTop = picked[part] * rowHeight;
		}

		function chosenMinutes() {
			const hours = ((picked.hour + 1) % 12) + (picked.ap ? 12 : 0);
			return hours * 60 + picked.minute * 5;
		}

		function paint() {
			for (const [part, column] of Object.entries(columns)) {
				for (const row of pickAll('.tp-wheel-item', column)) {
					row.classList.toggle('is-on', +row.getAttribute('data-i') === picked[part]);
				}
				const label = choices[part][picked[part]];
				column.setAttribute('aria-valuenow', part === 'ap' ? Number(label === 'PM') : +label);
				column.setAttribute('aria-valuetext', label);
			}

			const total = chosenMinutes();
			const stored = make('code', '', clock24(total));
			readout.textContent = clock12(total);
			storedNote.replaceChildren('Stored as ', stored, '.');
		}
	}

	/* Pickup slots ask for a day first, then for a quarter-hour on that day. */
	function mountPickupSlots(form) {
		const OPENING = 8 * 60;
		const CLOSING = 18 * 60;
		const SLOT_LENGTH = 15;
		const dayChoices = pick('[data-tp-slots-days]', form);
		const slotArea = pick('[data-tp-slots-groups]', form);
		const pickLine = pick('[data-tp-slots-pick]', form);
		const doneLine = pick('[data-tp-slots-done]', form);
		const summary = pick('[data-tp-slots-errors]', form);
		const openDays = upcomingDays();
		let shownDay = 0;

		for (const [slot, day] of openDays.entries()) dayChoices.appendChild(dayChoice(day, slot));

		dayChoices.addEventListener('change', (event) => {
			if (event.target.name !== 'tp-pickup-day') return;
			showDay(+event.target.value);
			doneLine.hidden = true;
			fillSummary(summary, '', []);
		});
		slotArea.addEventListener('change', () => {
			describePick();
			doneLine.hidden = true;
			slotArea.classList.remove('is-invalid');
			const notice = pick('#tp-slot-err', slotArea);
			if (notice) {
				notice.hidden = true;
				notice.textContent = '';
			}
			fillSummary(summary, '', []);
		});
		form.addEventListener('submit', book);

		/* Open on today, or on tomorrow when today has nothing left. */
		const firstDay = slotsFor(openDays[0]).some((slot) => slot.left) ? 0 : 1;
		pickAll('input', dayChoices)[firstDay].checked = true;
		showDay(firstDay);

		/** The next five days the shop opens; it stays shut on Sundays. */
		function upcomingDays() {
			const midnight = new Date();
			midnight.setHours(0, 0, 0, 0);
			const found = [];
			for (let ahead = 0; found.length < 5 && ahead < 10; ahead++) {
				const date = new Date(midnight);
				date.setDate(midnight.getDate() + ahead);
				if (date.getDay() !== 0) found.push({ date, ahead });
			}
			return found;
		}

		function shortDate(day) {
			return `${MONTH_ABBR[day.date.getMonth()]} ${day.date.getDate()}`;
		}

		function shortWeekday(day) {
			return WEEKDAYS[day.date.getDay()].slice(0, 3);
		}

		function dayWord(day) {
			return ['Today', 'Tomorrow'][day.ahead] || shortWeekday(day);
		}

		/** Places left in a slot: invented, but the same every time for a date. */
		function placesLeft(day, slot) {
			const seed = (day.date.getDate() * 131 + day.date.getMonth() * 17 + slot * 37) % 23;
			if (seed < 5) return 0;
			return { 5: 1, 6: 2 }[seed] || 4;
		}

		/** Every quarter-hour of a day, minus the next half hour when it is today. */
		function slotsFor(day) {
			const earliest = day.ahead === 0 ? minutesNow() + 30 : -1;
			const list = [];
			for (let at = OPENING, slot = 0; at < CLOSING; at += SLOT_LENGTH, slot++) {
				if (at >= earliest) list.push({ at, left: placesLeft(day, slot) });
			}
			return list;
		}

		function dayChoice(day, slot) {
			const choice = make('label', 'basalt-choice');
			choice.innerHTML = `<input type="radio" name="tp-pickup-day" id="tp-pickup-day-${slot}" value="${slot}">`;
			choice.append(dayWord(day), make('span', 'basalt-choice-hint', shortDate(day)));
			return choice;
		}

		function showDay(index) {
			shownDay = index;
			slotArea.innerHTML = '';
			slotArea.classList.remove('is-invalid');

			const slots = slotsFor(openDays[index]);
			if (!slots.length) {
				slotArea.append(
					make('p', 'tp-slots-empty', "Today's last pickup has gone. Tomorrow opens at 8:00 AM."),
				);
			}

			const halves = [
				['Morning', slots.filter((slot) => slot.at < NOON)],
				['Afternoon', slots.filter((slot) => slot.at >= NOON)],
			];
			for (const [name, part] of halves) {
				if (part.length) slotArea.appendChild(slotGroup(name, part));
			}

			const notice = make('p', 'tp-invalid-text');
			notice.id = 'tp-slot-err';
			notice.hidden = true;
			slotArea.appendChild(notice);
			describePick();
		}

		function slotGroup(name, slots) {
			const openCount = slots.filter((slot) => slot.left > 0).length;
			const group = make('fieldset', 'tp-slotgroup');
			group.setAttribute('aria-describedby', 'tp-slot-err');
			group.innerHTML = `<legend class="tp-legend">${name} <span class="tp-slotgroup-count">${openCount} of ${slots.length} open</span></legend>`;

			const grid = make('div', 'tp-slotgrid');
			for (const slot of slots) grid.appendChild(slotTile(slot));
			group.appendChild(grid);
			return group;
		}

		/** One tile: a hidden radio, the time, and a note when places run low. */
		function slotTile({ at, left }) {
			const stored = clock24(at);
			const hour = Math.floor(at / 60) % 24;
			const face = `${dialHour(hour)}:${twoDigits(at % 60)}`;
			const lock = left ? '' : ' disabled';
			let note = '';
			if (left === 0) note = '<span class="tp-slot-left">Full</span>';
			else if (left <= 2) note = `<span class="tp-slot-left">${left} left</span>`;

			const tile = make('label', left ? 'tp-slot' : 'tp-slot is-full');
			tile.innerHTML =
				`<input type="radio" name="tp-pickup" id="tp-slot-${stored.replace(':', '')}" value="${stored}"${lock}>` +
				`<span class="tp-slot-time">${face}<span class="visually-hidden"> ${at < NOON ? 'AM' : 'PM'}</span></span>${note}`;
			return tile;
		}

		function describePick() {
			const chosen = pick('input[name="tp-pickup"]:checked', form);
			pickLine.textContent = chosen ? pickupText(minutesOf(chosen.value)) : 'No slot chosen yet';
			pickLine.classList.toggle('is-empty', !chosen);
		}

		function pickupText(at) {
			const day = openDays[shownDay];
			return `${shortWeekday(day)}, ${shortDate(day)}, ${clock12(at)} to ${clock12(at + SLOT_LENGTH)}`;
		}

		function book(event) {
			event.preventDefault();
			if (pick('input[name="tp-pickup"]:checked', form)) {
				markDone(doneLine, 'Reserved. We will text you when the order is packed.');
				doneLine.hidden = false;
				return;
			}

			const firstFree = pick('input[name="tp-pickup"]:not(:disabled)', form);
			const message = firstFree ? 'Choose a pickup slot.' : 'Choose another day. This one has no slots left.';
			const notice = pick('#tp-slot-err', slotArea);
			if (notice) {
				notice.textContent = message;
				notice.hidden = false;
			}
			slotArea.classList.add('is-invalid');
			const target = firstFree ? firstFree.id : `tp-pickup-day-${(shownDay + 1) % openDays.length}`;
			fillSummary(summary, 'Your pickup is not booked yet', [{ id: target, text: message }]);
			doneLine.hidden = true;
		}
	}

	/* Typed entry accepts loose text and offers an hour and minute grid in a
     popover for people who would rather click. */
	function mountTypedEntry(card) {
		/* The popover opens on 6:00 PM when nothing usable has been typed. */
		const FALLBACK = 18 * 60;
		const GRID_COLUMNS = 6;
		const field = pick('[data-tp-typed-input]', card);
		const fieldError = pick('[data-tp-typed-err]', card);
		const storedValue = pick('[data-tp-typed-value]', card);
		const trigger = pick('[data-tp-typed-open]', card);
		const popover = pick('[data-tp-typed-pop]', card);
		const hourGrid = pick('[data-tp-pop-hours]', card);
		const minuteGrid = pick('[data-tp-pop-mins]', card);
		const confirm = pick('[data-tp-pop-done]', card);
		const formatRadios = pickAll('input[name="tp-typed-fmt"]', card);
		const earliest = minutesOf(card.getAttribute('data-min') || '00:00');
		const latest = minutesOf(card.getAttribute('data-max') || '23:59');
		let accepted = readTyped(field.value);
		let draft = accepted;
		let halfRow = null;

		moveFocusWithArrows(hourGrid);
		moveFocusWithArrows(minuteGrid);

		trigger.addEventListener('click', () => (popover.hidden ? showGrid() : hideGrid(true)));
		pick('[data-tp-pop-cancel]', card).addEventListener('click', () => hideGrid(true));
		confirm.addEventListener('click', () => {
			if (draft !== null) accept(format(draft));
			hideGrid(false);
			field.focus();
		});
		popover.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			hideGrid(true);
		});
		document.addEventListener('pointerdown', (event) => {
			const outside = !popover.contains(event.target) && !trigger.contains(event.target);
			if (!popover.hidden && outside) hideGrid(false);
		});

		field.addEventListener('change', () => accept(field.value));
		field.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				accept(field.value);
			}
			if (event.key === 'ArrowDown' && event.altKey) {
				event.preventDefault();
				showGrid();
			}
		});

		for (const radio of formatRadios) radio.addEventListener('change', reformat);

		if (accepted !== null) accept(format(accepted));

		function uses24Hour() {
			return Array.from(formatRadios).some((radio) => radio.checked && radio.value === '24');
		}

		function format(total) {
			return uses24Hour() ? clock24(total) : clock12(total);
		}

		function draftOrFallback() {
			return draft === null ? FALLBACK : draft;
		}

		/**
		 * Checks typed text against the allowed hours. A good time is rewritten
		 * in the chosen format and stored; anything else shows a message.
		 */
		function accept(raw) {
			const total = readTyped(raw);
			field.classList.remove('is-invalid');
			field.removeAttribute('aria-invalid');
			fieldError.textContent = '';

			let problem = '';
			if (!String(raw).trim()) problem = 'Enter a start time.';
			else if (total === null) problem = "That doesn't look like a time. Try 7:30 PM or 19:30.";
			else if (total < earliest || total > latest)
				problem = `Visits run from ${format(earliest)} to ${format(latest)}.`;
			if (problem) {
				flag(problem);
				return false;
			}

			accepted = total;
			field.value = format(total);
			storedValue.textContent = clock24(total);
			return true;
		}

		function flag(message) {
			field.classList.add('is-invalid');
			field.setAttribute('aria-invalid', 'true');
			fieldError.textContent = message;
		}

		function reformat() {
			const flagged = field.classList.contains('is-invalid');
			if (accepted !== null && !flagged) field.value = format(accepted);
			else if (flagged) accept(field.value);
			if (!popover.hidden) drawPopover();
		}

		function gridButton(label, pressed, onPick, spoken) {
			const button = make('button', 'tp-pop-btn', label);
			button.type = 'button';
			if (spoken) button.setAttribute('aria-label', spoken);
			button.setAttribute('aria-pressed', String(pressed));
			button.addEventListener('click', onPick);
			return button;
		}

		/** Rebuilds both grids, plus the AM/PM row in 12-hour mode, around the draft. */
		function drawPopover() {
			const current = draftOrFallback();
			const hour = Math.floor(current / 60);
			const minute = current % 60;
			const evening = hour >= 12;

			hourGrid.innerHTML = '';
			minuteGrid.innerHTML = '';
			halfRow?.remove();
			halfRow = null;

			if (uses24Hour()) {
				for (let h = 0; h < 24; h++)
					hourGrid.appendChild(gridButton(twoDigits(h), h === hour, () => pickHour(h)));
			} else {
				for (let face = 1; face <= 12; face++) {
					const h = (face % 12) + (evening ? 12 : 0);
					hourGrid.appendChild(
						gridButton(String(face), h === hour, () => pickHour(h), `${face}${evening ? ' PM' : ' AM'}`),
					);
				}
				halfRow = halfToggle(evening);
				hourGrid.after(halfRow);
			}

			for (let slot = 0; slot < 12; slot++) {
				const mins = slot * 5;
				minuteGrid.appendChild(
					gridButton(twoDigits(mins), mins === minute, () => pickMinute(mins), `${twoDigits(mins)} minutes`),
				);
			}

			keepOneTabStop(hourGrid);
			keepOneTabStop(minuteGrid);
		}

		function halfToggle(evening) {
			const row = make('div', 'tp-presets tp-pop-ap');
			row.setAttribute('role', 'group');
			row.setAttribute('aria-label', 'Morning or afternoon');
			for (const half of ['AM', 'PM']) {
				const button = gridButton(half, (half === 'PM') === evening, () => pickHalf(half));
				button.className = 'tp-chip tp-chip-sm';
				row.appendChild(button);
			}
			return row;
		}

		function pickHalf(half) {
			const current = draftOrFallback();
			const hour = (Math.floor(current / 60) % 12) + (half === 'PM' ? 12 : 0);
			draft = hour * 60 + (current % 60);
			drawPopover();
			pickAll('button', halfRow)[half === 'PM' ? 1 : 0].focus();
		}

		function pickHour(hour) {
			draft = hour * 60 + (draftOrFallback() % 60);
			drawPopover();
			pressedOrFirst(minuteGrid).focus();
		}

		function pickMinute(minute) {
			draft = Math.floor(draftOrFallback() / 60) * 60 + minute;
			drawPopover();
			confirm.focus();
		}

		function pressedOrFirst(grid) {
			return pick('[aria-pressed="true"]', grid) || pick('button', grid);
		}

		/** Leaves the pressed button (or the first) as the grid's only tab stop. */
		function keepOneTabStop(grid) {
			const buttons = Array.from(pickAll('button', grid));
			const stop = buttons.find((button) => button.getAttribute('aria-pressed') === 'true') || buttons[0];
			for (const button of buttons) button.tabIndex = button === stop ? 0 : -1;
		}

		/** Arrow keys walk a six-wide grid of buttons; Tab moves out of it. */
		function moveFocusWithArrows(grid) {
			const offsets = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: GRID_COLUMNS, ArrowUp: -GRID_COLUMNS };
			grid.addEventListener('keydown', (event) => {
				const buttons = Array.from(pickAll('button', grid));
				const from = buttons.indexOf(document.activeElement);
				if (from < 0) return;
				let to = null;
				if (event.key in offsets) to = from + offsets[event.key];
				else if (event.key === 'Home') to = 0;
				else if (event.key === 'End') to = buttons.length - 1;
				if (to === null || !buttons[to]) return;
				event.preventDefault();
				buttons[from].tabIndex = -1;
				buttons[to].tabIndex = 0;
				buttons[to].focus();
			});
		}

		function showGrid() {
			draft = readTyped(field.value);
			if (draft === null) draft = accepted;
			drawPopover();
			popover.hidden = false;
			trigger.setAttribute('aria-expanded', 'true');
			pressedOrFirst(hourGrid).focus();
		}

		function hideGrid(returnFocus) {
			if (popover.hidden) return;
			popover.hidden = true;
			trigger.setAttribute('aria-expanded', 'false');
			if (returnFocus) trigger.focus();
		}
	}

	/* Visit length is two steppers and a row of presets, with a 30-minute floor. */
	function mountVisitLength(card) {
		const SHORTEST = 30;
		const hoursField = pick('[data-tp-dur-h]', card);
		const minutesField = pick('[data-tp-dur-m]', card);
		const message = pick('[data-tp-dur-err]', card);
		const presets = pickAll('[data-tp-dur-preset]', card);
		const fields = [hoursField, minutesField];

		for (const field of fields) {
			field.addEventListener('change', refresh);
			field.addEventListener('input', refresh);
		}

		for (const preset of presets) {
			preset.addEventListener('click', () => {
				const total = +preset.getAttribute('data-tp-dur-preset');
				hoursField.value = Math.floor(total / 60);
				minutesField.value = total % 60;
				/* basalt.js redraws the stepper buttons on blur. */
				for (const field of fields) field.dispatchEvent(new Event('blur'));
				refresh();
			});
		}

		refresh();

		function totalMinutes() {
			return (parseInt(hoursField.value, 10) || 0) * 60 + (parseInt(minutesField.value, 10) || 0);
		}

		function refresh() {
			const total = totalMinutes();
			const tooShort = total < SHORTEST;

			for (const preset of presets) {
				preset.setAttribute('aria-pressed', String(+preset.getAttribute('data-tp-dur-preset') === total));
			}
			for (const field of fields) {
				field.toggleAttribute('aria-invalid', tooShort);
				field.closest('.basalt-stepper').classList.toggle('is-invalid', tooShort);
			}

			message.hidden = !tooShort;
			message.textContent = tooShort ? 'A visit needs at least 30 minutes.' : '';
		}
	}

	/* The browser's own time input does the picking; this checks it on save. */
	function mountNativeRange(form) {
		const earliest = pick('#tp-nat-from', form);
		const latest = pick('#tp-nat-to', form);
		const earliestEcho = pick('[data-tp-nat-value]', form);
		const latestEcho = pick('[data-tp-nat-value2]', form);
		const summary = pick('[data-tp-native-errors]', form);
		const savedLine = pick('[data-tp-native-saved]', form);
		const LABELS = { 'tp-nat-from': 'Earliest drop-off', 'tp-nat-to': 'Latest drop-off' };

		for (const field of [earliest, latest]) {
			field.addEventListener('input', () => {
				echoValues();
				savedLine.textContent = '';
				if (field.classList.contains('is-invalid')) showProblem(field, problemWith(field));
				if (field === earliest && latest.classList.contains('is-invalid'))
					showProblem(latest, problemWith(latest));
			});
		}
		form.addEventListener('submit', save);
		echoValues();

		/** Shows the raw value strings the browser hands back. */
		function echoValues() {
			earliestEcho.textContent = `"${earliest.value}"`;
			latestEcho.textContent = `"${latest.value}"`;
		}

		function problemWith(field) {
			const state = field.validity;
			if (state.valueMissing || state.badInput) return 'Enter a time.';
			if (state.rangeUnderflow || state.rangeOverflow) {
				return `Choose a time between ${clock12(minutesOf(field.min))} and ${clock12(minutesOf(field.max))}.`;
			}
			if (state.stepMismatch) return 'Use a quarter-hour, like 7:15 or 7:30.';
			const tooClose =
				field === latest && earliest.value && minutesOf(latest.value) - minutesOf(earliest.value) < 60;
			return tooClose ? 'Make it at least an hour after the earliest drop-off.' : '';
		}

		function showProblem(field, message) {
			field.classList.toggle('is-invalid', Boolean(message));
			if (message) field.setAttribute('aria-invalid', 'true');
			else field.removeAttribute('aria-invalid');
			document.getElementById(`${field.id}-err`).textContent = message;
		}

		function save(event) {
			event.preventDefault();
			const problems = [];
			for (const field of [earliest, latest]) {
				const message = problemWith(field);
				showProblem(field, message);
				if (message) problems.push({ id: field.id, text: `${LABELS[field.id]}: ${lowerFirst(message)}` });
			}

			fillSummary(summary, problems.length === 1 ? 'One thing to fix' : 'Two things to fix', problems);
			if (problems.length) {
				savedLine.textContent = '';
				savedLine.classList.remove('tp-ok');
				return;
			}
			markDone(
				savedLine,
				`Saved. Drivers will see ${clock12(minutesOf(earliest.value))} to ${clock12(minutesOf(latest.value))}.`,
			);
		}
	}

	/* Weekly hours get one row per day, each with a switch and two selects. */
	function mountWeeklyHours(form) {
		/* Day, open or shut, opening and closing time. */
		const SCHEDULE = [
			['Monday', true, '07:00', '16:00'],
			['Tuesday', true, '07:00', '16:00'],
			['Wednesday', true, '07:00', '16:00'],
			['Thursday', true, '07:00', '16:00'],
			['Friday', true, '07:00', '17:00'],
			['Saturday', true, '08:00', '14:00'],
			['Sunday', false, '09:00', '13:00'],
		];
		const list = pick('[data-tp-week-rows]', form);
		const summary = pick('[data-tp-week-errors]', form);
		const totalLine = pick('[data-tp-week-total]', form);
		const savedLine = pick('[data-tp-week-saved]', form);
		const halfHours = [];
		for (let at = 5 * 60; at <= 23 * 60; at += 30) halfHours.push(at);

		const days = SCHEDULE.map(([name, open, from, to]) => dayRow(name, open, from, to));

		list.addEventListener('change', () => {
			savedLine.textContent = '';
			refresh();
		});
		pick('[data-tp-week-copy]', form).addEventListener('click', copyMonday);
		form.addEventListener('submit', save);
		refresh();

		/** A labeled select of half-hours, returned with its hidden label. */
		function timeSelect(id, label, chosen) {
			const caption = make('label', 'visually-hidden', label);
			caption.htmlFor = id;

			const select = make('select', 'form-select');
			select.id = id;
			for (const at of halfHours) {
				const option = make('option', '', clock12(at));
				option.value = clock24(at);
				if (clock24(at) === chosen) option.selected = true;
				select.appendChild(option);
			}
			return { caption, select };
		}

		function dayRow(name, open, from, to) {
			const key = `tp-wk-${name.slice(0, 3).toLowerCase()}`;
			const row = make('div', 'tp-week-row');
			row.setAttribute('role', 'group');
			row.setAttribute('aria-labelledby', key);
			row.innerHTML = [
				`<span class="tp-week-day" id="${key}">${name}</span>`,
				'<div class="form-check form-switch tp-week-open">',
				`<input class="form-check-input" type="checkbox" role="switch" id="${key}-open"${open ? ' checked' : ''}>`,
				`<label class="form-check-label" for="${key}-open">Open</label>`,
				'</div>',
				'<div class="tp-week-times"></div>',
				`<p class="tp-invalid-text tp-week-err" id="${key}-err"></p>`,
			].join('');

			const opening = timeSelect(`${key}-from`, `${name} opens at`, from);
			const closing = timeSelect(`${key}-to`, `${name} closes at`, to);
			for (const { select } of [opening, closing]) select.setAttribute('aria-describedby', `${key}-err`);

			const day = {
				name,
				row,
				toggle: pick('input[type="checkbox"]', row),
				from: opening.select,
				to: closing.select,
				joiner: make('span', 'tp-week-sep', 'to'),
				length: make('span', 'tp-week-len'),
				shut: make('span', 'tp-week-closed', 'Closed, no deliveries'),
				error: pick('.tp-week-err', row),
			};
			pick('.tp-week-times', row).append(
				opening.caption,
				opening.select,
				day.joiner,
				closing.caption,
				closing.select,
				day.length,
				day.shut,
			);
			list.appendChild(row);
			return day;
		}

		function problemWith(day) {
			if (!day.toggle.checked) return '';
			return minutesOf(day.to.value) <= minutesOf(day.from.value)
				? 'Closing time has to be after opening time.'
				: '';
		}

		function showProblem(day, message) {
			day.error.textContent = message;
			for (const select of [day.from, day.to]) {
				select.classList.toggle('is-invalid', Boolean(message));
				if (message) select.setAttribute('aria-invalid', 'true');
				else select.removeAttribute('aria-invalid');
			}
		}

		/** Shows or hides each row's times and adds up the open days and hours. */
		function refresh() {
			let openDays = 0;
			let openMinutes = 0;

			for (const day of days) {
				const open = day.toggle.checked;
				const span = minutesOf(day.to.value) - minutesOf(day.from.value);
				day.row.classList.toggle('is-closed', !open);
				const timeParts = [
					day.from,
					day.to,
					day.joiner,
					day.length,
					day.from.previousElementSibling,
					day.to.previousElementSibling,
				];
				for (const part of timeParts) part.hidden = !open;
				day.shut.hidden = open;
				day.length.textContent = open && span > 0 ? spanWords(span) : '';

				if (open) {
					openDays += 1;
					if (span > 0) openMinutes += span;
				} else {
					showProblem(day, '');
				}
				if (day.error.textContent.trim()) showProblem(day, problemWith(day));
			}

			totalLine.innerHTML = openDays
				? `Open <strong>${openDays}${openDays === 1 ? ' day' : ' days'}</strong>, <strong>${Math.round(openMinutes / 30) / 2} hours</strong> a week`
				: 'No delivery days chosen';
		}

		/** Gives Tuesday to Friday the same hours as Monday. */
		function copyMonday() {
			const [monday, ...rest] = days;
			for (const day of rest.slice(0, 4)) {
				day.toggle.checked = monday.toggle.checked;
				day.from.value = monday.from.value;
				day.to.value = monday.to.value;
				if (day.error.textContent.trim()) showProblem(day, problemWith(day));
			}
			savedLine.textContent = '';
			refresh();
		}

		function save(event) {
			event.preventDefault();
			const problems = [];
			for (const day of days) {
				const message = problemWith(day);
				showProblem(day, message);
				if (message) problems.push({ id: day.to.id, text: `${day.name}: ${lowerFirst(message)}` });
			}
			if (!days.some((day) => day.toggle.checked)) {
				problems.push({ id: days[0].toggle.id, text: 'Turn on at least one day we can deliver.' });
			}

			const heading =
				problems.length === 1
					? 'One thing to fix before saving'
					: `${problems.length} things to fix before saving`;
			fillSummary(summary, heading, problems);
			if (problems.length) savedLine.textContent = '';
			else markDone(savedLine, 'Saved. Our drivers will only come when you are open.');
		}
	}

	/* The chips above the grid hide every card that is not of the chosen kind. */
	function mountKindFilter() {
		const grid = pick('[data-tp-grid]', pageRoot);
		const pickerCards = Array.from(pickAll('.tp-card', grid));
		const tally = pick('[data-tp-count]', pageRoot);
		const kindButtons = pickAll('[data-tp-filter]', pageRoot);

		for (const pressed of kindButtons) {
			pressed.addEventListener('click', () => {
				for (const chip of kindButtons) chip.setAttribute('aria-pressed', String(chip === pressed));
				showKind(pressed.getAttribute('data-tp-filter'));
			});
		}
		showKind('all');

		function showKind(kind) {
			const everything = kind === 'all';
			const visible = [];
			for (const card of pickerCards) {
				const match = everything || card.getAttribute('data-tp-kind') === kind;
				card.classList.toggle('is-hidden', !match);
				card.classList.remove('is-alone');
				if (match) visible.push(card);
			}
			grid.classList.toggle('is-filtered', !everything);

			/* A half-width card with no partner stretches across the row. */
			const halfCards = visible.filter((card) => !card.classList.contains('tp-card-full'));
			if (halfCards.length % 2) halfCards.at(-1).classList.add('is-alone');
			if (tally) tally.textContent = `${visible.length}${visible.length === 1 ? ' picker' : ' pickers'}`;

			requestAnimationFrame(realignWheels);
		}

		function realignWheels() {
			for (const realign of wheelRealigners) realign();
		}
	}

	start();

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
