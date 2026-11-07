/**
 * Appointment board for the Marlo studios, loaded by bookings.html.
 * New requests from the website sit at the top until someone answers
 * them; below, the calendar shows one day by stylist, a whole week, or
 * a table. A row or a name goes to booking-details.html?id=<id>, while
 * the panel icon and the calendar blocks slide in a quick view that can
 * confirm, move or cancel the booking.
 *
 * The records live in window.Basalt.data.bookings (data/multipurpose/bookings.js) and
 * edits only last until reload; point the backend methods at your API.
 */
(() => {
	'use strict';

	const page = pick('[data-bk-root]');
	const store = window.Basalt.data && window.Basalt.data.bookings;
	if (!page || !store) return;
	const shopBook = window.Basalt.shopBook || null;

	/* Every save goes through here and resolves with what it was given. */
	const backend = {
		confirm: (booking) => Promise.resolve(booking),
		reschedule: (booking) => Promise.resolve(booking),
		cancel: (booking) => Promise.resolve(booking),
		add: (booking) => Promise.resolve(booking),
	};

	/* Label and status tone for each state a booking can be in. */
	const BADGES = {
		requested: { text: 'To confirm', tone: 'warning' },
		confirmed: { text: 'Confirmed', tone: 'success' },
		done: { text: 'Done', tone: '' },
		canceled: { text: 'Canceled', tone: 'danger' },
	};

	const OPEN_HOURS = (store.mins(store.OPEN.to) - store.mins(store.OPEN.from)) / 60;
	const VIEWS = ['day', 'week', 'list'];

	const view = { mode: 'day', day: store.TODAY, studio: 'all', showPast: false, openId: null };

	const ui = {
		board: pick('[data-bk-view]'),
		heading: pick('[data-bk-title]'),
		back: pick('[data-bk-prev]'),
		forward: pick('[data-bk-next]'),
		jumpToday: pick('[data-bk-today]'),
		studioPick: pick('[data-bk-studio]'),
		queue: pick('[data-bk-wait]'),
		queueNote: pick('[data-bk-wait-desc]'),
		counts: {
			week: pick('[data-bk-fig="week"]'),
			waiting: pick('[data-bk-fig="waiting"]'),
			today: pick('[data-bk-fig="today"]'),
		},
		status: pick('[data-bk-live]'),
	};

	const quickView = pick('#bk-booking');
	const peek = {
		heading: pick('[data-bk-d="title"]', quickView),
		summary: pick('[data-bk-d="sub"]', quickView),
		fullLink: pick('[data-bk-d="full"]', quickView),
		content: pick('[data-bk-d="body"]', quickView),
		footer: pick('[data-bk-d="foot"]', quickView),
	};
	/* Set when a dialog has to wait for the quick view to finish closing. */
	let afterPeekCloses = null;

	const slotDialog = pick('#bk-slot');
	const slotForm = pick('[data-bk-form]', slotDialog);
	const controls = {
		heading: pick('[data-bk-form-title]', slotForm),
		lead: pick('[data-bk-form-sub]', slotForm),
		glyph: pick('[data-bk-form-icon]', slotForm),
		customer: pick('[data-bk-f="customer"]', slotForm),
		service: pick('[data-bk-f="service"]', slotForm),
		stylist: pick('[data-bk-f="staff"]', slotForm),
		day: pick('[data-bk-date]', slotForm),
		times: pick('[data-bk-slots]', slotForm),
		timeError: pick('[data-bk-slot-error]', slotForm),
		notify: pick('[data-bk-f="tell"]', slotForm),
		send: pick('[data-bk-form-submit]', slotForm),
	};
	const draft = { purpose: 'new', booking: null, time: null };

	const cancelDialog = pick('#bk-cancel');
	const cancelParts = {
		message: pick('[data-bk-cancel-text]', cancelDialog),
		refundRow: pick('[data-bk-refund-wrap]', cancelDialog),
		refundSwitch: pick('[data-bk-refund]', cancelDialog),
		refundLabel: pick('[data-bk-refund-label]', cancelDialog),
		proceed: pick('[data-bk-cancel-go]', cancelDialog),
	};
	let pendingCancel = null;

	/** Wires every control, reads the address, then draws the page once. */
	function start() {
		bindToolbar();
		page.addEventListener('click', onPageClick);
		page.addEventListener('auxclick', (event) => {
			if (event.button !== 1 || event.target.closest('a, button')) return;
			followRow(event);
		});
		bindQuickView();
		bindSlotDialog();
		bindCancelDialog();

		/* ?view=week or ?view=list picks the view; #3125 opens that booking. */
		const requested = new URLSearchParams(location.search).get('view');
		if (VIEWS.includes(requested)) {
			view.mode = requested;
			const radio = pick(`#bk-view-${requested}`);
			if (radio) radio.checked = true;
		}
		redrawAll();
		const fromHash = decodeURIComponent(location.hash.slice(1));
		if (fromHash && store.recordWithId(fromHash)) showBooking(fromHash);
	}

	function redrawAll() {
		paintCounts();
		paintQueue();
		paintBoard();
	}

	/* DOM, text and plumbing shortcuts used all through the page. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (ch) => entities[ch]);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function countOf(amount, noun) {
		return `${amount} ${noun}${amount === 1 ? '' : 's'}`;
	}

	/** Clears the polite live region, then speaks the text a moment later. */
	function announce(text) {
		ui.status.textContent = '';
		setTimeout(() => {
			ui.status.textContent = text;
		}, 30);
	}

	function enhance(scope) {
		window.Basalt.avatars?.(scope);
		window.Basalt.tips?.(scope);
	}

	/**
	 * Tooltips about to be thrown away with their markup: a visible one is
	 * hidden and left to finish, the rest are disposed of right away.
	 */
	function dropTooltips(scope) {
		if (!window.bootstrap) return;
		for (const node of pickAll('[data-bs-toggle="tooltip"]', scope)) {
			const tooltip = bootstrap.Tooltip.getInstance(node);
			if (!tooltip) continue;
			if (!tooltip.tip) {
				tooltip.dispose();
				continue;
			}
			if (tooltip.tip.classList.contains('show')) tooltip.hide();
		}
	}

	function stampNow() {
		return store.NOW.replace('T', ' ');
	}

	/* Facts about one booking, phrased the way the page shows them. */

	function serviceOf(booking) {
		return store.service(booking.service);
	}

	function placeName(booking) {
		return store.place(booking.where).name;
	}

	function givenName(staffId) {
		const [first] = store.person(staffId).name.split(' ');
		return first;
	}

	function notCanceled(booking) {
		return booking.status !== 'canceled';
	}

	function pageFor(booking) {
		return `booking-details.html?id=${encodeURIComponent(booking.id)}`;
	}

	function relativeDay(iso) {
		const names = { [store.TODAY]: 'Today', [store.addDays(store.TODAY, 1)]: 'Tomorrow' };
		return names[iso] || store.fmtDay(iso);
	}

	function timeKey(booking) {
		return `${booking.date} ${booking.time}`;
	}

	function chronological(first, second) {
		const left = timeKey(first);
		const right = timeKey(second);
		if (left === right) return 0;
		return left < right ? -1 : 1;
	}

	function visibleStaff() {
		return store.staff.filter((member) => view.studio === 'all' || member.studio === view.studio);
	}

	function withinStudio(booking) {
		return visibleStaff().some((member) => member.id === booking.staff);
	}

	function badge(booking) {
		const { text, tone } = BADGES[booking.status];
		return `<span class="basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}">${text}</span>`;
	}

	/** Avatar placeholder; 'md' is the bare size, anything unset means 'sm'. */
	function avatarTag(name, size) {
		const sizeClass = size === 'md' ? '' : ` basalt-avatar-${size || 'sm'}`;
		return `<span class="basalt-avatar${sizeClass}" data-basalt-avatar data-name="${htmlSafe(name)}" aria-hidden="true"></span>`;
	}

	function emptyNote(text) {
		return `<p class="bk-empty"><i class="bi bi-calendar4" aria-hidden="true"></i>${htmlSafe(text)}</p>`;
	}

	/* The three numbers in the page header. */

	function paintCounts() {
		const active = store.bookings.filter(notCanceled);
		const weekFrom = store.weekStart(store.TODAY);
		const weekTo = store.addDays(weekFrom, 6);
		ui.counts.today.textContent = active.filter((booking) => booking.date === store.TODAY).length;
		ui.counts.waiting.textContent = active.filter((booking) => booking.status === 'requested').length;
		ui.counts.week.textContent = active.filter(
			(booking) => booking.date >= weekFrom && booking.date <= weekTo,
		).length;
	}

	/* Requests still waiting for an answer, soonest first. */

	function paintQueue() {
		const pending = store.bookings.filter((booking) => booking.status === 'requested').sort(chronological);
		dropTooltips(ui.queue);
		if (pending.length === 0) {
			ui.queueNote.textContent = 'Nothing waiting. New requests from the website show up here.';
			ui.queue.innerHTML =
				'<li class="bk-wait-done"><i class="bi bi-check2-circle" aria-hidden="true"></i>All caught up</li>';
			return;
		}
		const tomorrow = store.addDays(store.TODAY, 1);
		const urgent = pending.filter((booking) => booking.date <= tomorrow).length;
		ui.queueNote.textContent = `${countOf(pending.length, 'request')} from the website${urgent ? `, ${urgent} of them for tomorrow.` : '.'}`;
		ui.queue.innerHTML = pending.map(queueRow).join('');
		enhance(ui.queue);
	}

	function queueRow(booking) {
		const service = serviceOf(booking);
		const when = relativeDay(booking.date);
		const id = htmlSafe(booking.id);
		const person = `<div class="bk-wait-who">${avatarTag(booking.name, 'md')}<div class="bk-wait-text"><a class="bk-wait-name" href="${pageFor(booking)}">${htmlSafe(booking.name)}</a><span class="bk-wait-meta">${htmlSafe(service.short)} · ${htmlSafe(placeName(booking))}</span></div></div>`;
		const timing = `<div class="bk-wait-when"><span class="bk-wait-day${when === 'Tomorrow' ? ' is-soon' : ''}">${htmlSafe(when)}, ${htmlSafe(store.fmtTime(booking.time))}</span><span class="bk-wait-meta">With ${htmlSafe(givenName(booking.staff))}, ${htmlSafe(store.fmtMinutes(service.minutes))}</span></div>`;
		const buttons = `<div class="bk-wait-actions"><button type="button" class="btn btn-outline-secondary btn-sm" data-bk-act="move" data-id="${id}">Other time</button><button type="button" class="btn btn-primary btn-sm" data-bk-act="confirm" data-id="${id}"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Confirm</button></div>`;
		return `<li class="bk-wait-row bk-tone-${service.group}" data-bk-row="${id}">${person}${timing}${buttons}</li>`;
	}

	/* The calendar card: its heading, then whichever view is picked. */

	function paintBoard() {
		const renderers = { day: dayMarkup, week: weekMarkup, list: listMarkup };
		dropTooltips(ui.board);
		paintHeading();
		ui.board.dataset.view = view.mode;
		ui.board.innerHTML = (renderers[view.mode] || listMarkup)();
		enhance(ui.board);
	}

	function paintHeading() {
		const asList = view.mode === 'list';
		const span = view.mode === 'week' ? 'week' : 'day';
		for (const control of [ui.back, ui.forward, ui.jumpToday]) control.hidden = asList;
		ui.heading.classList.toggle('is-flush', asList);
		ui.back.setAttribute('aria-label', `Previous ${span}`);
		ui.forward.setAttribute('aria-label', `Next ${span}`);

		if (asList) {
			ui.heading.textContent = view.showPast ? 'Earlier bookings' : 'Coming up';
			return;
		}
		if (view.mode !== 'week') {
			ui.heading.textContent = store.fmtLong(view.day);
			ui.jumpToday.disabled = view.day === store.TODAY;
			return;
		}
		const monday = store.weekStart(view.day);
		ui.heading.textContent = `${store.fmtShort(monday)} to ${store.toDate(store.addDays(monday, 5)).getDate()}`;
		ui.jumpToday.disabled = monday === store.weekStart(store.TODAY);
	}

	/** One day: a column per stylist on an hour scale, plus a narrow agenda. */
	function dayMarkup() {
		const team = visibleStaff();
		const booked = store.bookings.filter(
			(booking) => booking.date === view.day && notCanceled(booking) && withinStudio(booking),
		);
		if (!store.isOpenDay(view.day)) return emptyNote('The studios are closed on Sundays.');

		const firstMinute = store.mins(store.OPEN.from);
		let scale = '';
		for (let hour = 0; hour <= OPEN_HOURS; hour += 1) {
			scale += `<span class="bk-day-hour" style="--bk-at:${hour}">${htmlSafe(store.fmtTime(store.hhmm(firstMinute + hour * 60)))}</span>`;
		}
		const mine = (member) => booked.filter((booking) => booking.staff === member.id);
		const heads = team
			.map((member) => {
				const total = mine(member).length;
				return `<div class="bk-day-who">${avatarTag(member.name, 'sm')}<span class="bk-day-who-text"><span class="bk-day-who-name">${htmlSafe(member.name)}</span><span class="bk-day-who-meta">${htmlSafe(member.role)} · ${total ? countOf(total, 'booking') : 'Free all day'}</span></span></div>`;
			})
			.join('');
		const columns = team
			.map(
				(member) =>
					`<div class="bk-day-col" role="group" aria-label="${htmlSafe(member.name)}">${mine(member).sort(chronological).map(blockMarkup).join('')}</div>`,
			)
			.join('');
		const grid = `<div class="bk-day" style="--bk-cols:${team.length};--bk-hours:${OPEN_HOURS}"><div class="bk-day-head"><span class="bk-day-corner" aria-hidden="true"></span>${heads}</div><div class="bk-day-body"><div class="bk-day-hours" aria-hidden="true">${scale}</div>${columns}</div></div>`;

		const agenda = booked.length
			? `<ol class="bk-agenda">${booked
					.sort(chronological)
					.map((booking) => agendaEntry(booking))
					.join('')}</ol>`
			: emptyNote('No bookings on this day.');
		return `${grid}<div class="bk-agenda-wrap">${agenda}</div>`;
	}

	/** A booking placed on the day grid; short ones squeeze onto one line. */
	function blockMarkup(booking) {
		const service = serviceOf(booking);
		const range = store.fmtRange(booking.time, store.endOf(booking));
		const startsAt = (store.mins(booking.time) - store.mins(store.OPEN.from)) / 60;
		const brief = service.minutes < 40;
		const flags = {
			'is-short': brief,
			'is-mid': !brief && service.minutes < 60,
			'is-wait': booking.status === 'requested',
			'is-done': booking.status === 'done',
			'is-open': view.openId === booking.id,
		};
		const classes = Object.entries(flags).reduce(
			(list, [name, on]) => (on ? `${list} ${name}` : list),
			`bk-block bk-tone-${service.group}`,
		);
		const geometry = `--bk-at:${startsAt.toFixed(3)};--bk-len:${(service.minutes / 60).toFixed(3)};--bk-buf:${(service.buffer / 60).toFixed(3)}`;
		const label = htmlSafe(
			`${booking.name}, ${service.short}, ${range}${flags['is-wait'] ? ', waiting for you' : ''}`,
		);
		const inside = brief
			? `<span class="bk-block-line"><span class="bk-block-time">${htmlSafe(store.fmtTime(booking.time))}</span> ${htmlSafe(booking.name)}</span>`
			: `<span class="bk-block-time">${htmlSafe(range)}</span><span class="bk-block-name">${htmlSafe(booking.name)}</span><span class="bk-block-what">${htmlSafe(service.short)}${booking.where === 'video' ? ' · Video' : ''}</span>`;
		return `<button type="button" class="${classes}" style="${geometry}" data-bk-open="${htmlSafe(booking.id)}" aria-label="${label}">${inside}</button>`;
	}

	function agendaEntry(booking) {
		const service = serviceOf(booking);
		const waiting = booking.status === 'requested';
		const flag = waiting
			? '<span class="basalt-status basalt-status-dot basalt-status-warning bk-agenda-pill">To confirm</span>'
			: '';
		const time = `<span class="bk-agenda-time">${htmlSafe(store.fmtTime(booking.time))}<span class="bk-agenda-len">${htmlSafe(store.fmtMinutes(service.minutes))}</span></span>`;
		const main = `<span class="bk-agenda-main"><span class="bk-agenda-name">${htmlSafe(booking.name)}</span><span class="bk-agenda-meta">${htmlSafe(service.short)} with ${htmlSafe(givenName(booking.staff))} · ${htmlSafe(placeName(booking))}</span>${flag}</span>`;
		return `<li><button type="button" class="bk-agenda-item bk-tone-${service.group}${waiting ? ' is-wait' : ''}" data-bk-open="${htmlSafe(booking.id)}">${time}${main}</button></li>`;
	}

	/** Monday to Saturday as a grid of stylists, plus an agenda per day. */
	function weekMarkup() {
		const team = visibleStaff();
		const monday = store.weekStart(view.day);
		const dates = Array.from({ length: 6 }, (_, offset) => store.addDays(monday, offset));
		const inWeek = store.bookings
			.filter(
				(booking) =>
					booking.date >= dates[0] &&
					booking.date <= dates[5] &&
					notCanceled(booking) &&
					withinStudio(booking),
			)
			.sort(chronological);
		const todayClass = (iso) => (iso === store.TODAY ? ' is-today' : '');

		const columnHeads = dates
			.map(
				(iso) =>
					`<span class="bk-week-day${todayClass(iso)}"><span class="bk-week-dow">${htmlSafe(store.fmtDay(iso).slice(0, 3))}</span><span class="bk-week-date">${store.toDate(iso).getDate()}</span></span>`,
			)
			.join('');
		const headRow = `<div class="bk-week-row bk-week-row-head"><span class="bk-week-corner" aria-hidden="true"></span>${columnHeads}</div>`;
		const chip = (booking, iso) => {
			const service = serviceOf(booking);
			const label = htmlSafe(
				`${booking.name}, ${service.short}, ${store.fmtDay(iso)} at ${store.fmtTime(booking.time)}`,
			);
			return `<button type="button" class="bk-chip bk-tone-${service.group}${booking.status === 'requested' ? ' is-wait' : ''}${booking.status === 'done' ? ' is-done' : ''}" data-bk-open="${htmlSafe(booking.id)}" aria-label="${label}"><span class="bk-chip-time">${htmlSafe(store.fmtTime(booking.time))}</span><span class="bk-chip-what">${htmlSafe(service.short)}</span></button>`;
		};
		const personRows = team
			.map((member) => {
				const cells = dates
					.map((iso) => {
						const chips = inWeek
							.filter((booking) => booking.staff === member.id && booking.date === iso)
							.map((booking) => chip(booking, iso))
							.join('');
						return `<div class="bk-week-cell${todayClass(iso)}">${chips}</div>`;
					})
					.join('');
				return `<div class="bk-week-row"><div class="bk-week-who">${avatarTag(member.name, 'sm')}<span class="bk-week-who-name">${htmlSafe(member.name)}</span></div>${cells}</div>`;
			})
			.join('');

		const agenda = dates
			.map((iso) => {
				const entries = inWeek.filter((booking) => booking.date === iso);
				if (entries.length === 0) return '';
				const named = relativeDay(iso);
				const title = named === store.fmtDay(iso) ? store.fmtDay(iso) : `${named}, ${store.fmtShort(iso)}`;
				return `<h3 class="bk-agenda-day">${htmlSafe(title)}</h3><ol class="bk-agenda">${entries.map((booking) => agendaEntry(booking)).join('')}</ol>`;
			})
			.join('');

		return `<div class="bk-week" style="--bk-cols:6">${headRow}${personRows}</div><div class="bk-agenda-wrap">${agenda || emptyNote('No bookings this week.')}</div>`;
	}

	/** Everything from today on, or everything before it, as a table. */
	function listMarkup() {
		const pool = store.bookings.filter(withinStudio);
		const rows = view.showPast
			? pool
					.filter((booking) => booking.date < store.TODAY)
					.sort(chronological)
					.reverse()
			: pool.filter((booking) => booking.date >= store.TODAY).sort(chronological);
		const total = countOf(rows.length, 'booking');
		const footer = `<div class="bk-list-foot"><p class="bk-list-foot-note">${view.showPast ? `${total} before today.` : `${total} from today on.`}</p><button type="button" class="btn btn-sm btn-outline-secondary" data-bk-past>${view.showPast ? 'Show upcoming' : 'Show earlier'}</button></div>`;
		if (rows.length === 0) {
			return `${emptyNote(view.showPast ? 'No earlier bookings here.' : 'Nothing booked from today on.')}${footer}`;
		}
		const caption = `<caption class="visually-hidden">${view.showPast ? 'Bookings before today, newest first' : 'Bookings from today on, soonest first'}. A row opens the booking’s full page; the panel icon opens a quick view.</caption>`;
		const head =
			'<thead><tr><th scope="col" class="bk-row-when">When</th><th scope="col">Customer</th><th scope="col" class="bk-row-svc">Service</th><th scope="col" class="bk-row-status">Status</th><th scope="col" class="bk-row-open"><span class="visually-hidden">Open</span></th></tr></thead>';
		return `<div class="bk-table-wrap"><table class="table bk-table mb-0">${caption}${head}<tbody>${rows.map(tableRow).join('')}</tbody></table></div>${footer}`;
	}

	function tableRow(booking) {
		const service = serviceOf(booking);
		const name = htmlSafe(booking.name);
		const href = pageFor(booking);
		const day = htmlSafe(relativeDay(booking.date));
		const flagged = booking.status === 'requested' || booking.status === 'canceled';
		const flag = flagged
			? `<span class="bk-row-flag bk-row-flag-${booking.status}">${BADGES[booking.status].text} · </span>`
			: '';
		const tip = (title) => `data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="${title}"`;

		const when = `<td class="bk-row-when"><span class="bk-row-main">${day}</span><span class="bk-row-sub">${htmlSafe(store.fmtRange(booking.time, store.endOf(booking)))}</span></td>`;
		const who = `<td class="bk-row-who"><div class="bk-row-person">${avatarTag(booking.name, 'sm')}<span class="bk-row-text"><a class="bk-row-link" href="${href}">${name}</a><span class="bk-row-sub bk-row-sub-wide">${htmlSafe(booking.city)}</span><span class="bk-row-sub bk-row-sub-narrow">${flag}${day}, ${htmlSafe(store.fmtTime(booking.time))} · ${htmlSafe(service.short)}</span></span></div></td>`;
		const what = `<td class="bk-row-svc"><span class="bk-row-main bk-row-svc-name bk-tone-${service.group}">${htmlSafe(service.short)}</span><span class="bk-row-sub">${htmlSafe(givenName(booking.staff))} · ${htmlSafe(placeName(booking))}</span></td>`;
		const state = `<td class="bk-row-status">${badge(booking)}</td>`;
		const open = `<td class="bk-row-open"><span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-bk-open="${htmlSafe(booking.id)}" aria-label="Quick view: ${name}" ${tip('Quick view')}><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="${href}" aria-label="Open full page: ${name}" ${tip('Open full page')}><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span></td>`;
		return `<tr class="bk-row${view.openId === booking.id ? ' is-open' : ''}" data-bk-row="${htmlSafe(booking.id)}">${when}${who}${what}${state}${open}</tr>`;
	}

	/* Toolbar and clicks on the page itself. */

	function bindToolbar() {
		for (const radio of pickAll('[data-bk-view-pick]')) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				view.mode = radio.value;
				paintBoard();
				/* The view rides in the address so Back from a booking lands on it. */
				try {
					history.replaceState(null, '', view.mode === 'day' ? location.pathname : `?view=${view.mode}`);
				} catch {
					/* Pages opened from file:// cannot rewrite their address. */
				}
			});
		}
		ui.studioPick.addEventListener('change', () => {
			view.studio = ui.studioPick.value;
			paintBoard();
		});
		ui.back.addEventListener('click', () => shiftDate(-1));
		ui.forward.addEventListener('click', () => shiftDate(1));
		ui.jumpToday.addEventListener('click', () => {
			view.day = store.TODAY;
			paintBoard();
			ui.back.focus();
		});
	}

	/** Moves a week at a time in week view; day view skips closed days. */
	function shiftDate(direction) {
		if (view.mode === 'week') {
			view.day = store.addDays(view.day, direction * 7);
		} else {
			const next = store.addDays(view.day, direction);
			view.day = store.isOpenDay(next) ? next : store.addDays(next, direction);
		}
		paintBoard();
	}

	/*
	 * A row behaves like its name link and opens the full page (with
	 * Cmd/Ctrl or the middle button, in a new tab). Anything carrying
	 * data-bk-open, so the panel icon and the calendar blocks, opens the
	 * quick view instead.
	 */
	function onPageClick(event) {
		const { target } = event;
		const action = target.closest('[data-bk-act]');
		if (action) {
			doAction(action.dataset.bkAct, action.dataset.id, event.detail > 0 ? action : null);
			return;
		}
		if (target.closest('[data-bk-new]')) {
			openScheduler('new');
			return;
		}
		if (target.closest('[data-bk-past]')) {
			view.showPast = !view.showPast;
			paintBoard();
			pick('[data-bk-past]', ui.board)?.focus();
			return;
		}
		if (target.closest('a')) return;
		const opener = target.closest('[data-bk-open]');
		if (opener) {
			showBooking(opener.dataset.bkOpen);
			return;
		}
		followRow(event);
	}

	function followRow(event) {
		const row = event.target.closest('[data-bk-row]');
		if (!row || event.target.closest('button')) return;
		const href = pageFor(store.recordWithId(row.dataset.bkRow));
		const newTab = event.metaKey || event.ctrlKey || event.button === 1;
		if (newTab) window.open(href, '_blank', 'noopener');
		else location.href = href;
	}

	/* The quick view drawer. */

	function drawerControl() {
		return bootstrap.Offcanvas.getOrCreateInstance(quickView);
	}

	function bindQuickView() {
		quickView.addEventListener('shown.bs.offcanvas', () => peek.heading.focus());
		quickView.addEventListener('click', (event) => {
			const action = event.target.closest('[data-bk-act]');
			if (action) doAction(action.dataset.bkAct, action.dataset.id, event.detail > 0 ? action : null);
		});
		quickView.addEventListener('hidden.bs.offcanvas', () => {
			if (afterPeekCloses) {
				const queued = afterPeekCloses;
				afterPeekCloses = null;
				queued();
				return;
			}
			const closedId = view.openId;
			view.openId = null;
			paintBoard();
			if (!closedId) return;
			const safe = CSS.escape(closedId);
			const returnTo =
				pick(`[data-bk-open="${safe}"]`, ui.board) || pick(`[data-bk-row="${safe}"] .bk-row-link`, ui.board);
			returnTo?.focus({ preventScroll: true });
		});
	}

	function showBooking(id) {
		if (!store.recordWithId(id)) return;
		view.openId = id;
		paintPeek();
		paintBoard();
		drawerControl().show();
	}

	function paintPeek() {
		const booking = store.recordWithId(view.openId);
		if (!booking) return;
		dropTooltips(quickView);
		peek.heading.textContent = booking.name;
		peek.summary.textContent = `${serviceOf(booking).name} · ${relativeDay(booking.date)}, ${store.fmtTime(booking.time)}`;
		peek.fullLink.href = pageFor(booking);
		peek.content.innerHTML = peekContent(booking);
		const buttons = peekButtons(booking);
		peek.footer.innerHTML = buttons;
		peek.footer.hidden = !buttons;
		enhance(quickView);
	}

	/** Same as paintPeek, but only when that booking is the one on show. */
	function repaintPeekFor(booking) {
		if (view.openId === booking.id) paintPeek();
	}

	/** Runs next right away, or once the open quick view has slid shut. */
	function passTo(next) {
		if (!quickView.classList.contains('show')) {
			next();
			return;
		}
		afterPeekCloses = next;
		drawerControl().hide();
	}

	function factList(rows) {
		const items = rows
			.map(([term, detail]) => `<div class="bk-facts-row"><dt>${term}</dt><dd>${detail}</dd></div>`)
			.join('');
		return `<dl class="bk-facts">${items}</dl>`;
	}

	function section(title, inner) {
		return `<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">${title}</h3>${inner}</section>`;
	}

	function peekContent(booking) {
		const service = serviceOf(booking);
		const stylist = store.person(booking.staff);
		const venue = store.place(booking.where);
		const timing = factList([
			['When', htmlSafe(`${store.fmtDay(booking.date)}, ${store.fmtRange(booking.time, store.endOf(booking))}`)],
			[
				'Length',
				`${htmlSafe(store.fmtMinutes(service.minutes))}<span class="bk-quiet">, then ${service.buffer} min to reset the room</span>`,
			],
			['Where', `${htmlSafe(venue.name)}<span class="bk-facts-sub">${htmlSafe(venue.address)}</span>`],
			[
				'With',
				`<span class="bk-inline-person">${avatarTag(stylist.name, 'xs')}${htmlSafe(stylist.name)}</span><span class="bk-facts-sub">${htmlSafe(stylist.role)}</span>`,
			],
		]);
		const shopper = `<div class="bk-cust">${avatarTag(booking.name, 'md')}<div><a class="bk-link bk-cust-name" href="shopper-details.html?id=${encodeURIComponent(booking.customer)}">${htmlSafe(booking.name)}</a><span class="bk-facts-sub">${htmlSafe(booking.city)}</span></div></div>`;
		const quote = booking.note ? `<blockquote class="bk-note">${htmlSafe(booking.note)}</blockquote>` : '';
		const header = `<div class="bk-status">${badge(booking)}<p class="bk-status-text">${htmlSafe(statusSentence(booking))}</p></div>`;
		return `${header}${section('When and where', timing)}${section('Customer', `${shopper}${quote}`)}${section('Payment', factList(paymentRows(booking)))}`;
	}

	function statusSentence(booking) {
		const latest = booking.log[booking.log.length - 1];
		const lines = {
			requested: () =>
				`Asked for on ${store.fmtShort(booking.log[0][0].slice(0, 10))}. Confirm it, or offer another time.`,
			canceled: () => booking.cancel || 'Canceled.',
			done: () => `Done. ${latest[1]}.`,
			confirmed: () => `${latest[1]} on ${store.fmtShort(latest[0].slice(0, 10))}.`,
		};
		return (lines[booking.status] || lines.confirmed)();
	}

	/** How the booking is paid for, as [label, html] pairs. */
	function paymentRows(booking) {
		const service = serviceOf(booking);
		const payment = booking.pay;
		const price = store.priceOf(booking);
		const priceRow = ['Price', store.money(price)];
		const orderLink = (number) =>
			`<a class="bk-link" href="order-details.html?id=${encodeURIComponent(number)}">${htmlSafe(number)}</a>`;

		switch (payment.kind) {
			case 'deposit':
				if (payment.refunded)
					return [
						priceRow,
						['Deposit', `${store.money(payment.amount)} refunded ${store.fmtShort(payment.refunded)}`],
					];
				if (booking.status === 'done')
					return [
						priceRow,
						[
							'Paid',
							`In full, ${store.money(payment.amount)} deposit and ${store.money(price - payment.amount)} in the studio`,
						],
					];
				return [
					priceRow,
					['Deposit paid', `${store.money(payment.amount)} on ${store.fmtShort(payment.paid)}`],
					['Due in the studio', `<strong>${store.money(price - payment.amount)}</strong>`],
				];
			case 'order':
				return [priceRow, ['Paid', `In full with order ${orderLink(payment.order)}`]];
			case 'coat':
				return [
					['Price', htmlSafe(service.included)],
					['Tailoring order', payment.order ? orderLink(payment.order) : 'Not linked yet'],
				];
			case 'studio':
				return [
					['Price', store.money(payment.amount)],
					['Paid', booking.status === 'done' ? 'In the studio' : 'In the studio, after the fitting'],
				];
			default:
				return [['Price', htmlSafe(service.included)]];
		}
	}

	function peekButtons(booking) {
		const id = htmlSafe(booking.id);
		if (booking.status === 'confirmed') {
			return `<button type="button" class="btn btn-outline-danger" data-bk-act="cancel" data-id="${id}">Cancel booking</button><button type="button" class="btn btn-primary" data-bk-act="move" data-id="${id}"><i class="bi bi-calendar-event me-1" aria-hidden="true"></i>Reschedule</button>`;
		}
		if (booking.status === 'requested') {
			return `<button type="button" class="btn btn-outline-secondary" data-bk-act="move" data-id="${id}">Other time</button><button type="button" class="btn btn-primary" data-bk-act="confirm" data-id="${id}"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Confirm</button>`;
		}
		return '';
	}

	/* Confirm, move and cancel, from the queue or the quick view. */

	/**
	 * @param {string} action  confirm, move or cancel
	 * @param {string} id      booking id
	 * @param {?HTMLElement} trigger  the clicked button when a pointer pressed it
	 */
	function doAction(action, id, trigger) {
		const booking = store.recordWithId(id);
		if (!booking) return;
		trigger?.blur();
		const handlers = {
			confirm: () => confirmRequest(booking),
			move: () => passTo(() => openScheduler('move', booking)),
			cancel: () => passTo(() => openCancelDialog(booking)),
		};
		if (Object.hasOwn(handlers, action)) handlers[action]();
	}

	/** Puts the saved fields back and redraws, for the toasts' Undo. */
	function restorer(booking, saved, alsoPeek) {
		return () => {
			Object.assign(booking, saved);
			redrawAll();
			if (alsoPeek) repaintPeekFor(booking);
		};
	}

	function confirmRequest(booking) {
		const saved = { status: booking.status, log: [...booking.log] };
		booking.status = 'confirmed';
		booking.log.push([stampNow(), 'You confirmed it']);
		redrawAll();
		repaintPeekFor(booking);
		backend.confirm(booking);
		announce(`Confirmed ${booking.name}`);
		notify({
			tone: 'success',
			title: 'Booking confirmed',
			text: `${booking.name} gets an email with the time and studio.`,
			actions: [{ label: 'Undo', onClick: restorer(booking, saved, true) }],
		});
	}

	/* The time picker dialog, both for a new booking and for moving one. */

	function bindSlotDialog() {
		controls.times.addEventListener('change', (event) => {
			if (event.target.name !== 'bkSlotTime') return;
			draft.time = event.target.value;
			controls.timeError.classList.remove('d-block');
		});
		controls.service.addEventListener('change', () => {
			listStylists(controls.stylist.value);
			paintTimes();
		});
		controls.stylist.addEventListener('change', paintTimes);
		controls.day.addEventListener('change', paintTimes);
		slotDialog.addEventListener('hidden.bs.modal', () => {
			if (draft.purpose === 'move' && draft.booking && view.openId === draft.booking.id) drawerControl().show();
		});
		slotForm.addEventListener('submit', onSlotSubmit);
	}

	function fillSelect(select, pairs, chosen) {
		select.innerHTML = pairs
			.map(([value, text]) => `<option value="${htmlSafe(value)}">${htmlSafe(text)}</option>`)
			.join('');
		select.value = chosen;
		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(select);
	}

	/** Customers as [id, name, city], from the shop book when it is loaded. */
	function customerList() {
		let entries;
		if (shopBook) {
			entries = shopBook.CUSTOMERS.map((person) => [person.id, person.name, person.city]);
		} else {
			const seen = new Map();
			for (const booking of store.bookings)
				seen.set(booking.customer, [booking.customer, booking.name, booking.city]);
			entries = [...seen.values()];
		}
		return entries.sort((a, b) => a[1].localeCompare(b[1]));
	}

	function firstOpenDay(iso) {
		let day = iso;
		while (!store.isOpenDay(day)) day = store.addDays(day, 1);
		return day;
	}

	function chosenDay() {
		return (window.Basalt.datepicker ? window.Basalt.datepicker.get(controls.day) : '') || '';
	}

	/** Lists who can do the picked service, keeping preferred when allowed. */
	function listStylists(preferred) {
		const service = store.service(controls.service.value);
		const allowed = service ? service.staff : [];
		const pairs = allowed.map((staffId) => {
			const member = store.person(staffId);
			return [staffId, `${member.name}, ${store.place(member.studio).name}`];
		});
		fillSelect(controls.stylist, pairs, allowed.includes(preferred) ? preferred : allowed[0]);
	}

	function paintTimes() {
		const iso = chosenDay();
		const skip = draft.purpose === 'move' ? draft.booking.id : null;
		const free = iso ? store.freeSlots(controls.stylist.value, iso, controls.service.value, skip) : [];
		if (draft.time && !free.includes(draft.time)) draft.time = null;
		controls.timeError.classList.remove('d-block');
		if (!iso) {
			controls.times.innerHTML = '<p class="bk-slots-note">Pick a day to see free times.</p>';
			return;
		}
		if (free.length === 0) {
			controls.times.innerHTML = `<p class="bk-slots-note">${htmlSafe(givenName(controls.stylist.value))} has no free time that day. Try another day.</p>`;
			return;
		}
		controls.times.innerHTML = free
			.map(
				(time, index) =>
					`<input type="radio" class="btn-check" name="bkSlotTime" id="bk-slot${index}" value="${time}"${time === draft.time ? ' checked' : ''}><label class="bk-slot" for="bk-slot${index}">${htmlSafe(store.fmtTime(time))}</label>`,
			)
			.join('');
	}

	/** Opens the dialog blank for 'new', or around a booking for 'move'. */
	function openScheduler(purpose, booking) {
		Object.assign(draft, { purpose, booking: booking || null, time: null });
		const fresh = purpose === 'new';
		for (const field of pickAll('[data-bk-new-only]', slotForm)) field.hidden = !fresh;
		const servicePairs = store.services.map((service) => [service.id, service.name]);

		if (fresh) {
			fillSelect(
				controls.customer,
				customerList().map(([id, name, city]) => [id, `${name}, ${city}`]),
				'#88041',
			);
			fillSelect(controls.service, servicePairs, 'styling');
			listStylists('dawn');
			controls.heading.textContent = 'New booking';
			controls.lead.textContent = 'Pick the service, who does it, and a free time.';
			controls.glyph.className = 'bi bi-calendar-plus';
			controls.send.textContent = 'Book it';
			controls.notify.nextElementSibling.textContent = 'Email the customer a confirmation';
		} else {
			fillSelect(controls.service, servicePairs, booking.service);
			listStylists(booking.staff);
			const answering = booking.status === 'requested';
			const spokenDay = relativeDay(booking.date).replace(/^[A-Z][a-z]+/, (word) =>
				word === 'Today' || word === 'Tomorrow' ? word.toLowerCase() : word,
			);
			controls.heading.textContent = answering ? 'Offer another time' : 'Reschedule';
			controls.lead.textContent = `${booking.name}, ${serviceOf(booking).short.toLowerCase()} now ${spokenDay} at ${store.fmtTime(booking.time)}.`;
			controls.glyph.className = 'bi bi-calendar-event';
			controls.send.textContent = answering ? 'Move and confirm' : 'Move booking';
			controls.notify.nextElementSibling.textContent = `Email ${booking.name.split(' ')[0]} the new time`;
		}
		controls.notify.checked = true;

		let opening;
		if (fresh) opening = firstOpenDay(store.addDays(store.TODAY, 1));
		else opening = booking.date < store.TODAY ? firstOpenDay(store.TODAY) : booking.date;
		if (window.Basalt.datepicker) window.Basalt.datepicker.set(controls.day, opening);
		paintTimes();
		bootstrap.Modal.getOrCreateInstance(slotDialog).show();
	}

	function paymentFor(service) {
		if (service.group === 'measure') return { kind: 'coat', order: null };
		if (service.id === 'care') return { kind: 'club' };
		return { kind: 'studio', amount: service.price };
	}

	function onSlotSubmit(event) {
		event.preventDefault();
		const iso = chosenDay();
		if (!iso || !draft.time) {
			controls.timeError.classList.add('d-block');
			(pick('input', controls.times) || pick('input', controls.day)).focus();
			return;
		}
		const stylist = store.person(controls.stylist.value);
		if (draft.purpose === 'new') addBooking(iso, stylist);
		else moveBooking(draft.booking, iso, stylist);
	}

	function addBooking(iso, stylist) {
		const service = store.service(controls.service.value);
		const [customerId, customerName, customerCity] = customerList().find(
			(entry) => entry[0] === controls.customer.value,
		);
		const highest = Math.max(...store.bookings.map((booking) => Number(booking.id.replace(/\D/g, ''))));
		const created = {
			id: `#${highest + 1}`,
			customer: customerId,
			name: customerName,
			city: customerCity,
			service: service.id,
			staff: stylist.id,
			where: stylist.studio,
			date: iso,
			time: draft.time,
			status: 'confirmed',
			pay: paymentFor(service),
			note: '',
			log: [
				[stampNow(), 'Booked by you'],
				[stampNow(), 'Confirmed'],
			],
		};
		store.bookings.push(created);
		backend.add(created);
		view.openId = null;
		view.day = iso;
		bootstrap.Modal.getOrCreateInstance(slotDialog).hide();
		redrawAll();
		notify({
			tone: 'success',
			title: 'Booked',
			text: `${customerName}, ${store.fmtDay(iso)} at ${store.fmtTime(draft.time)} with ${stylist.name.split(' ')[0]}.`,
			actions: [
				{
					label: 'Open',
					onClick: () => {
						showBooking(created.id);
					},
				},
			],
		});
	}

	function moveBooking(booking, iso, stylist) {
		const { date, time, staff, where, status } = booking;
		const saved = { date, time, staff, where, status, log: [...booking.log] };
		const answering = status === 'requested';
		Object.assign(booking, { date: iso, time: draft.time });
		if (booking.where !== 'video') booking.where = stylist.studio;
		booking.staff = stylist.id;
		booking.status = 'confirmed';
		booking.log.push([
			stampNow(),
			`Moved to ${store.fmtDay(iso)}, ${store.fmtTime(booking.time)}${answering ? ' and confirmed' : ''}`,
		]);
		backend.reschedule(booking);
		bootstrap.Modal.getOrCreateInstance(slotDialog).hide();
		redrawAll();
		repaintPeekFor(booking);
		notify({
			tone: 'success',
			title: answering ? 'Moved and confirmed' : 'Booking moved',
			text: `${booking.name}, ${store.fmtDay(iso)} at ${store.fmtTime(booking.time)}.${controls.notify.checked ? ' They get an email.' : ''}`,
			actions: [{ label: 'Undo', onClick: restorer(booking, saved, true) }],
		});
	}

	/* The cancel dialog, with an optional refund. */

	function bindCancelDialog() {
		cancelDialog.addEventListener('hidden.bs.modal', () => {
			pendingCancel = null;
			if (view.openId) drawerControl().show();
		});
		cancelParts.proceed.addEventListener('click', cancelPending);
	}

	/** Words for the money a cancellation would hand back, or ''. */
	function refundWording(booking) {
		const { kind, amount, order } = booking.pay;
		if (kind === 'deposit') return `${store.money(amount)} deposit`;
		if (kind === 'order') return `${store.money(store.priceOf(booking))} paid with ${order}`;
		return '';
	}

	function openCancelDialog(booking) {
		pendingCancel = booking;
		const refund = refundWording(booking);
		cancelParts.message.textContent = `${booking.name}, ${store.fmtDay(booking.date)} at ${store.fmtTime(booking.time)}. The time is freed and ${booking.name.split(' ')[0]} gets an email.`;
		cancelParts.refundRow.hidden = !refund;
		cancelParts.refundSwitch.checked = true;
		cancelParts.refundLabel.textContent = `Refund the ${refund}`;
		bootstrap.Modal.getOrCreateInstance(cancelDialog).show();
	}

	function cancelPending() {
		const booking = pendingCancel;
		if (!booking) return;
		const saved = {
			status: booking.status,
			log: [...booking.log],
			cancel: booking.cancel,
			pay: { ...booking.pay },
		};
		const refunding = !cancelParts.refundRow.hidden && cancelParts.refundSwitch.checked;
		booking.status = 'canceled';
		booking.cancel = refunding
			? `Canceled by the studio, ${refundWording(booking)} refunded.`
			: 'Canceled by the studio.';
		if (refunding && booking.pay.kind === 'deposit') booking.pay = { ...booking.pay, refunded: store.TODAY };
		booking.log.push([stampNow(), refunding ? 'Canceled by you, refunded' : 'Canceled by you']);
		backend.cancel(booking);
		bootstrap.Modal.getOrCreateInstance(cancelDialog).hide();
		redrawAll();
		repaintPeekFor(booking);
		notify({
			tone: 'info',
			icon: 'bi-calendar-x',
			title: 'Booking canceled',
			text: `${booking.name}${refunding ? ' is refunded and gets an email.' : ' gets an email.'}`,
			actions: [{ label: 'Undo', onClick: restorer(booking, saved, false) }],
		});
	}

	start();
})();
