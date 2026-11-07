/**
 * Basalt - Full Calendar (full-calendar.html)
 * FullCalendar 6 four ways, all reading one list of events:
 *   main   month, week, day and list; drag, resize, click to add/edit
 *   list   one week as a list
 *   mini   a small month with a dot per event; pick a day to see it
 *   hours  Monday to Friday; meetings only drop inside working hours
 * Each calendar is made with window.Basalt.calendar (basalt.js), which
 * brings Basalt's defaults; the colors come from basalt.css.
 *
 * To use your own calendar:
 *   1. Fill window.Basalt.data.teamCalendar (assets/js/data/
 *      team-calendar.js) from your server, or pass FullCalendar an
 *      events URL instead of the function below.
 *   2. NOW is fixed so the demo opens on a busy week. Use new Date().
 *   3. save(), remove() and moved() are where a change reaches the
 *      server.
 */
(() => {
	'use strict';
	const root = pick('[data-fcx-root]');
	if (!root || !window.Basalt.calendar || !window.Basalt.data || !window.Basalt.data.teamCalendar) return;

	function start() {
		for (const b of pickAll('[data-fcx-type]', root)) {
			b.addEventListener('click', () => {
				const t = b.getAttribute('data-fcx-type');
				if (hidden.has(t)) hidden.delete(t);
				else hidden.add(t);
				syncKey();
				refresh();
			});
		}

		pick('[data-fcx-new]', root).addEventListener('click', () => openForm(null, null));
		root.addEventListener('click', (e) => {
			const row = e.target.closest('[data-fcx-open]');
			if (row) openForm(row.getAttribute('data-fcx-open'));
		});
		f('allDay').addEventListener('change', syncAllDay);
		f('title').addEventListener('input', () => {
			if (f('title').value.trim()) f('title').classList.remove('is-invalid');
		});
		form.addEventListener('submit', save);
		pick('[data-fcx-delete]', dialog).addEventListener('click', remove);

		paintMini();
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(v) {
		return String(v == null ? '' : v).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	const DATA = window.Basalt.data.teamCalendar;
	const TYPES = DATA.types;
	const NOW = DATA.NOW;
	const EVENTS = DATA.events.map((e) => Object.assign({}, e));
	const hidden = new Set();
	let seq = EVENTS.length;

	/* Dates */
	function pad(n) {
		return String(n).padStart(2, '0');
	}

	function isoDay(d) {
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}

	function isoTime(d) {
		return `${isoDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function parse(s) {
		return s.length === 10 ? new Date(`${s}T00:00`) : new Date(s);
	}

	function shiftDays(d, n) {
		return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
	}

	const clock = window.Basalt.calendar.clock;

	function fmt(d, o) {
		return d.toLocaleDateString('en-US', o);
	}

	function longDay(d) {
		return fmt(d, { weekday: 'long', month: 'long', day: 'numeric' });
	}

	function shortDay(d) {
		return fmt(d, { weekday: 'short', month: 'short', day: 'numeric' });
	}

	const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());

	/* An event as FullCalendar reads it. */
	function toFc(e) {
		return {
			id: e.id,
			title: e.title.replace(/-/g, '\u2011') /* hyphens never split a title */,
			start: e.start,
			end: e.end,
			allDay: e.allDay,
			classNames: [`basalt-fc-tone-${TYPES[e.type].tone}`],
			extendedProps: { type: e.type },
		};
	}

	function shown() {
		return EVENTS.filter((e) => !hidden.has(e.type));
	}

	function source(keep) {
		return (info, ok) => ok((keep ? shown().filter(keep) : shown()).map(toFc));
	}

	/* Which events fall on a day (all-day spans included), earliest first. */
	function onDay(day) {
		const next = shiftDays(day, 1);
		return shown()
			.filter((e) => parse(e.start) < next && parse(e.end) > day)
			.sort((a, b) => (a.allDay === b.allDay ? parse(a.start) - parse(b.start) : a.allDay ? -1 : 1));
	}

	const cals = {};
	function refresh() {
		for (const k of Object.keys(cals)) {
			cals[k].refetchEvents();
		}

		paintMini();
		paintDots();
	}

	/* Shared options */
	const shared = {
		now: isoTime(NOW),
		initialDate: isoDay(NOW),
		listDayFormat: { weekday: 'long' },
		listDaySideFormat: { month: 'short', day: 'numeric' },
		eventClick: (info) => {
			info.jsEvent.preventDefault();
			openForm(info.event.id);
		},
		eventDidMount: (info) => {
			const e = EVENTS.find((x) => x.id === info.event.id);
			if (!e) return;
			const when = e.allDay ? 'all day' : `${clock(parse(e.start))} to ${clock(parse(e.end))}`;
			info.el.setAttribute('aria-label', `${e.title}, ${TYPES[e.type].label.toLowerCase()}, ${when}`);
		},
	};

	/* Drag and resize land here. */
	function moved(info, isResize) {
		const e = EVENTS.find((x) => x.id === info.event.id);
		if (!e) return;
		const before = { start: e.start, end: e.end, allDay: e.allDay };
		const ev = info.event;
		const end = ev.end || (ev.allDay ? shiftDays(ev.start, 1) : new Date(ev.start.getTime() + 3600000));
		e.allDay = ev.allDay;
		e.start = ev.allDay ? isoDay(ev.start) : isoTime(ev.start);
		e.end = ev.allDay ? isoDay(end) : isoTime(end);
		refresh();
		const when = ev.allDay ? shortDay(ev.start) : `${shortDay(ev.start)}, ${clock(ev.start)} to ${clock(end)}`;
		toast({
			tone: 'success',
			title: isResize ? 'Event length changed' : 'Event moved',
			text: `${e.title}, ${when}.`,
			duration: 4000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						Object.assign(e, before);
						refresh();
					},
				},
			],
		});
	}

	function dropped(info) {
		return moved(info, false);
	}

	function resized(info) {
		return moved(info, true);
	}

	/* Main calendar */
	const narrow = window.matchMedia('(max-width: 575.98px)');
	cals.main = window.Basalt.calendar(
		pick('[data-fcx-cal="main"]', root),
		Object.assign({}, shared, {
			initialView: 'dayGridMonth',
			fixedWeekCount: false,
			headerToolbar: {
				left: 'prev,next today',
				center: 'title',
				right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
			},
			events: source(),
			editable: true,
			selectable: true,
			selectMirror: true,
			dayMaxEvents: 3,
			slotMinTime: '08:00:00',
			slotMaxTime: '19:00:00',
			scrollTime: '08:00:00',
			select: (info) => {
				cals.main.unselect();
				if (narrow.matches && info.view.type === 'dayGridMonth')
					cals.main.changeView('timeGridDay', info.start);
				else openForm(null, info);
			},
			eventDrop: dropped,
			eventResize: resized,
		}),
	);

	/* Phones: the month shows a dot per event instead of titles, and there
     is no week view (seven columns are too narrow to read); a week opened
     on a wider screen turns into its day. */
	function views(phone) {
		return {
			left: 'prev,next today',
			center: 'title',
			right: phone ? 'dayGridMonth,timeGridDay,listWeek' : 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
		};
	}

	function phoneViews() {
		cals.main.setOption('headerToolbar', views(narrow.matches));
		if (narrow.matches && cals.main.view.type === 'timeGridWeek') cals.main.changeView('timeGridDay');
	}
	function phoneMonth() {
		const want = narrow.matches && cals.main.view.type === 'dayGridMonth' ? 'none' : 'auto';
		if (cals.main.getOption('eventDisplay') !== want) cals.main.setOption('eventDisplay', want);
		paintDots();
	}
	function paintDots() {
		const host = pick('[data-fcx-cal="main"]', root);

		for (const cell of pickAll('.fc-daygrid-day[data-date]', host)) {
			let dots = pick('.fcx-dots', cell);
			const top = pick('.fc-daygrid-day-top', cell);
			if (!narrow.matches || !top) {
				if (dots) dots.remove();
				continue;
			}
			if (!dots) {
				dots = document.createElement('span');
				dots.className = 'fcx-dots';
				dots.setAttribute('aria-hidden', 'true');
				pick('.fc-daygrid-day-frame', cell).appendChild(dots);
			}
			dots.innerHTML = onDay(parse(cell.getAttribute('data-date')))
				.slice(0, 4)
				.map((e) => `<span class="fcx-dot basalt-fc-tone-${TYPES[e.type].tone}"></span>`)
				.join('');
		}
	}
	cals.main.setOption('datesSet', () => phoneMonth());
	narrow.addEventListener('change', () => {
		phoneViews();
		phoneMonth();
	});
	phoneViews();
	phoneMonth();

	/* Week list */
	cals.list = window.Basalt.calendar(
		pick('[data-fcx-cal="list"]', root),
		Object.assign({}, shared, {
			initialView: 'listWeek',
			headerToolbar: { left: 'title', center: '', right: 'prev,next' },
			titleFormat: { month: 'short', day: 'numeric' },
			events: source(),
		}),
	);

	/* Mini month */
	let picked = new Date(TODAY);
	cals.mini = window.Basalt.calendar(
		pick('[data-fcx-cal="mini"]', root),
		Object.assign({}, shared, {
			initialView: 'dayGridMonth',
			headerToolbar: { left: 'title', center: '', right: 'prev,next' },
			dayHeaderFormat: { weekday: 'narrow' },
			fixedWeekCount: false,
			showNonCurrentDates: false,
			events: [],
			dayCellContent: (arg) => ({
				html: `<span class="fcx-mini-num">${arg.dayNumberText}</span><span class="fcx-mini-dots" aria-hidden="true"></span>`,
			}),
			dateClick: (info) => {
				picked = info.date;
				paintMini();
			},
			datesSet: () => paintMini(),
		}),
	);

	function paintMini() {
		const host = pick('[data-fcx-cal="mini"]', root);

		for (const cell of pickAll('.fc-daygrid-day[data-date]', host)) {
			const day = parse(cell.getAttribute('data-date'));
			const evs = onDay(day);
			const dots = pick('.fcx-mini-dots', cell);
			if (dots)
				dots.innerHTML = evs
					.slice(0, 3)
					.map((e) => `<span class="fcx-dot basalt-fc-tone-${TYPES[e.type].tone}"></span>`)
					.join('');
			cell.classList.toggle('is-picked', isoDay(day) === isoDay(picked));
			const num = pick('.fc-daygrid-day-number', cell);
			if (num)
				num.setAttribute(
					'aria-label',
					longDay(day) + (evs.length ? `, ${evs.length}${evs.length === 1 ? ' event' : ' events'}` : ''),
				);
		}

		const evs = onDay(picked);
		pick('[data-fcx-day-title]', root).textContent = longDay(picked);
		pick('[data-fcx-day-list]', root).innerHTML = evs.length
			? evs
					.map(
						(e) =>
							`<li><button type="button" class="fcx-day-row" data-fcx-open="${e.id}"><span class="fcx-day-time">${e.allDay ? 'All day' : clock(parse(e.start))}</span><span class="fcx-day-name"><span class="fcx-dot basalt-fc-tone-${TYPES[e.type].tone}" aria-hidden="true"></span><span>${htmlSafe(e.title)}</span></span></button></li>`,
					)
					.join('')
			: '<li><p class="fcx-day-free">Nothing booked.</p></li>';
	}

	/* Working hours */
	const HOURS = { daysOfWeek: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00' };
	cals.hours = window.Basalt.calendar(
		pick('[data-fcx-cal="hours"]', root),
		Object.assign({}, shared, {
			initialView: 'timeGridWeek',
			headerToolbar: { left: 'title', center: '', right: 'prev,next' },
			titleFormat: { month: 'short', day: 'numeric' },
			weekends: false,
			allDaySlot: false,
			slotMinTime: '08:00:00',
			slotMaxTime: '18:00:00',
			businessHours: HOURS,
			editable: true,
			eventConstraint: 'businessHours',
			eventSources: [
				source((e) => e.type === 'meeting' && !e.allDay),
				/* Lunch, kept free on every working day. */
				{
					events: [
						{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '12:00', endTime: '13:00', display: 'background' },
					],
				},
			],
			eventOverlap: (still) => still.display !== 'background',
			eventDrop: dropped,
			eventResize: resized,
		}),
	);

	/* A phone shows one working day at a time. */
	function hoursView() {
		return cals.hours.changeView(narrow.matches ? 'timeGridDay' : 'timeGridWeek');
	}

	narrow.addEventListener('change', hoursView);
	hoursView();

	/* Add and edit */
	const dialog = document.getElementById('fcx-event');
	const form = pick('[data-fcx-form]', dialog);

	function f(n) {
		return form.elements[n];
	}

	const dateWrap = pick('[data-fcx-date]', form);
	let editing = null;

	/* Start times every half hour, 7 am to 7 pm. */
	(function fillTimes() {
		let html = '';
		for (let m = 7 * 60; m <= 19 * 60; m += 30) {
			const v = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
			html += `<option value="${v}">${clock(new Date(2026, 0, 1, Math.floor(m / 60), m % 60))}</option>`;
		}
		f('start').innerHTML = html;
	})();

	function refreshSelect(sel) {
		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(sel);
	}

	/* A start or a length that is not on the list (after a drag or a
     resize) is added to it. */
	function lengthText(m) {
		return m < 60 ? `${m} minutes` : String(Math.round(m / 6) / 10) + (m === 60 ? ' hour' : ' hours');
	}

	function setSelect(sel, value) {
		if (!Array.from(sel.options).some((o) => o.value === value)) {
			const label = sel === f('minutes') ? lengthText(Number(value)) : clock(new Date(`2026-01-01T${value}`));
			sel.insertAdjacentHTML('beforeend', `<option value="${value}">${htmlSafe(label)}</option>`);
		}
		sel.value = value;
		refreshSelect(sel);
	}
	function syncAllDay() {
		pick('[data-fcx-timed]', form).hidden = f('allDay').checked;
	}

	function openForm(id, range) {
		const e = id ? EVENTS.find((x) => x.id === id) : null;
		editing = e ? e.id : null;

		for (const el of pickAll('.is-invalid', form)) {
			el.classList.remove('is-invalid');
		}

		pick('[data-fcx-form-title]', dialog).textContent = e ? e.title : 'New event';
		pick('[data-fcx-form-sub]', dialog).textContent = e
			? `${TYPES[e.type].label + (e.company ? ` with ${e.company}` : '')}, ${e.allDay ? shortDay(parse(e.start)) : `${shortDay(parse(e.start))}, ${clock(parse(e.start))}`}`
			: 'It shows on every calendar on this page.';
		pick('[data-fcx-form-icon]', dialog).className = `bi ${e ? 'bi-calendar-event' : 'bi-calendar-plus'}`;
		pick('[data-fcx-save]', dialog).textContent = e ? 'Save changes' : 'Add event';
		pick('[data-fcx-delete]', dialog).hidden = !e;

		let start;
		let mins = 60;
		let allDay = false;
		if (e) {
			start = parse(e.start);
			allDay = e.allDay;
			if (!allDay) mins = Math.round((parse(e.end) - start) / 60000);
		} else if (range) {
			start = range.start;
			allDay = range.allDay;
			if (!allDay) mins = Math.max(30, Math.round((range.end - range.start) / 60000));
			else start = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 10);
		} else {
			start = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate(), 14);
		}
		f('title').value = e ? e.title : '';
		f('type').value = e ? e.type : 'meeting';
		refreshSelect(f('type'));
		f('allDay').checked = allDay && !!e;
		if (window.Basalt.datepicker) window.Basalt.datepicker.set(dateWrap, isoDay(start));
		setSelect(f('start'), allDay ? '10:00' : `${pad(start.getHours())}:${pad(start.getMinutes())}`);
		setSelect(f('minutes'), String(mins));
		f('where').value = e ? e.where : '';
		f('note').value = e ? e.note : '';
		syncAllDay();
		bootstrap.Modal.getOrCreateInstance(dialog).show();
	}
	function save(ev) {
		ev.preventDefault();
		const day = window.Basalt.datepicker ? window.Basalt.datepicker.get(dateWrap) : f('date').value;
		const title = f('title').value.trim();
		f('title').classList.toggle('is-invalid', !title);
		if (!title) {
			f('title').focus();
			return;
		}
		if (!day) {
			pick('#fcx-date').focus();
			return;
		}
		const allDay = f('allDay').checked;
		const start = allDay ? parse(day) : new Date(`${day}T${f('start').value}`);
		const end = allDay ? shiftDays(start, 1) : new Date(start.getTime() + Number(f('minutes').value) * 60000);
		const data = {
			type: f('type').value,
			title,
			start: allDay ? isoDay(start) : isoTime(start),
			end: allDay ? isoDay(end) : isoTime(end),
			allDay,
			where: f('where').value.trim(),
			note: f('note').value.trim(),
		};
		let item = editing ? EVENTS.find((x) => x.id === editing) : null;
		if (item) Object.assign(item, data);
		else {
			item = Object.assign({ id: `tc-${2601 + seq++}`, account: '', company: '' }, data);
			EVENTS.push(item);
		}
		hidden.delete(item.type);
		syncKey();
		picked = parse(item.start.slice(0, 10));
		refresh();
		bootstrap.Modal.getInstance(dialog).hide();
		toast({
			tone: 'success',
			title: editing ? 'Event saved' : 'Event added',
			text: `${item.title}, ${shortDay(start)}.`,
			duration: 4000,
		});
	}

	function remove() {
		const i = EVENTS.findIndex((x) => x.id === editing);
		if (i < 0) return;
		const [gone] = EVENTS.splice(i, 1);
		refresh();
		bootstrap.Modal.getInstance(dialog).hide();
		toast({
			tone: 'primary',
			title: 'Event deleted',
			text: `${gone.title}, ${shortDay(parse(gone.start))}.`,
			duration: 6000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						EVENTS.splice(i, 0, gone);
						refresh();
					},
				},
			],
		});
	}

	/* Wiring */
	function syncKey() {
		for (const b of pickAll('[data-fcx-type]', root)) {
			b.setAttribute('aria-pressed', String(!hidden.has(b.getAttribute('data-fcx-type'))));
		}
	}

	start();
})();
