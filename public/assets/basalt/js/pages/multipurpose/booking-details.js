/**
 * Full page for a single studio appointment, loaded by booking-details.html.
 * It lays out the time, the room and the stylist's other bookings that
 * day, who the customer is, how the visit is paid for, the team's notes
 * and the history, and it can confirm, move or cancel the booking.
 *
 * ?id= picks the booking; a missing or unknown id falls back to #3125.
 * Records come from window.Basalt.data.bookings, contact details from
 * window.Basalt.shopBook. Nothing is saved past a reload until the backend
 * methods below call a real API.
 */
(() => {
	'use strict';

	const page = pick('[data-bd-root]');
	const store = window.Basalt.data && window.Basalt.data.bookings;
	if (!page || !store) return;
	const shopBook = window.Basalt.shopBook || null;

	/* Every save goes through here and resolves with what it was given. */
	const backend = {
		confirm: (booking) => Promise.resolve(booking),
		reschedule: (booking) => Promise.resolve(booking),
		cancel: (booking) => Promise.resolve(booking),
		addNote: (booking, note) => Promise.resolve(note),
	};

	const BADGES = {
		requested: { text: 'To confirm', tone: 'warning' },
		confirmed: { text: 'Confirmed', tone: 'success' },
		done: { text: 'Done', tone: '' },
		canceled: { text: 'Canceled', tone: 'danger' },
	};
	const MEMBERSHIP = { flagship: 'Insider member', partner: 'Member', trade: 'Standard' };

	const booking = store.recordWithId(new URLSearchParams(location.search).get('id')) || store.recordWithId('#3125');

	/* Notes the team left on this booking, as [stamp, author, text]. */
	const seededNotes = {
		'#3125': [
			'2026-10-08 16:20',
			'Dawn Middleton',
			'Pulled the violet and black blazers in M, and the Chalk-Stripe Suit to try with her coat.',
		],
		'#3121': ['2026-10-08 09:05', 'Theo Barlow', 'Basted suit is on the rail. Check the sleeve length first.'],
	};
	const teamNotes = seededNotes[booking.id] ? [seededNotes[booking.id]] : [];

	const composer = pick('[data-bd-note-form]', page);
	const noteInput = pick('[data-bd-note-text]', page);

	const slotDialog = pick('#bk-slot');
	const slotForm = pick('[data-bk-form]', slotDialog);
	const controls = {
		heading: pick('[data-bk-form-title]', slotForm),
		lead: pick('[data-bk-form-sub]', slotForm),
		stylist: pick('[data-bk-f="staff"]', slotForm),
		day: pick('[data-bk-date]', slotForm),
		times: pick('[data-bk-slots]', slotForm),
		timeError: pick('[data-bk-slot-error]', slotForm),
		notify: pick('[data-bk-f="tell"]', slotForm),
		send: pick('[data-bk-form-submit]', slotForm),
	};
	let pickedTime = null;

	const cancelDialog = pick('#bk-cancel');
	const cancelParts = {
		message: pick('[data-bk-cancel-text]', cancelDialog),
		refundRow: pick('[data-bk-refund-wrap]', cancelDialog),
		refundSwitch: pick('[data-bk-refund]', cancelDialog),
		refundLabel: pick('[data-bk-refund-label]', cancelDialog),
		proceed: pick('[data-bk-cancel-go]', cancelDialog),
	};

	/** Hooks up the note box, the header actions and both dialogs, then draws. */
	function start() {
		composer.addEventListener('submit', onNoteSubmit);
		noteInput.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
			event.preventDefault();
			composer.requestSubmit();
		});
		page.addEventListener('click', onActionClick);
		bindSlotDialog();
		cancelParts.proceed.addEventListener('click', cancelBooking);
		paint();
	}

	/** Redraws every card, retiring the old tooltips first. */
	function paint() {
		if (window.bootstrap) {
			for (const node of pickAll('[data-bs-toggle="tooltip"]', page))
				bootstrap.Tooltip.getInstance(node)?.dispose();
		}
		paintHeader();
		paintSchedule();
		paintCustomer();
		paintPayment();
		paintNotes();
		paintHistory();
		enhance(page);
	}

	/* DOM, text and plumbing shortcuts used all through the page. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function part(name) {
		return pick(`[data-bd="${name}"]`, page);
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

	function enhance(scope) {
		window.Basalt.avatars?.(scope);
		window.Basalt.tips?.(scope);
		window.Basalt.menus?.(scope);
	}

	function stampNow() {
		return store.NOW.replace('T', ' ');
	}

	/** "2026-10-08 16:20" read back as a short date and a clock time. */
	function readableStamp(stamp) {
		return `${store.fmtShort(stamp.slice(0, 10))}, ${store.fmtTime(stamp.slice(11, 16))}`;
	}

	function relativeDay(iso) {
		const names = { [store.TODAY]: 'Today', [store.addDays(store.TODAY, 1)]: 'Tomorrow' };
		return names[iso] || store.fmtDay(iso);
	}

	function serviceOf() {
		return store.service(booking.service);
	}

	function givenName(staffId) {
		return store.person(staffId).name.split(' ')[0];
	}

	function customerFirstName() {
		return booking.name.split(' ')[0];
	}

	function shopCustomer() {
		if (!shopBook || !shopBook.CUSTOMERS) return null;
		return shopBook.CUSTOMERS.find((person) => person.id === booking.customer);
	}

	/** Avatar placeholder; leaving size out gives the default size. */
	function avatarTag(name, size) {
		return `<span class="basalt-avatar${size ? ` basalt-avatar-${size}` : ''}" data-basalt-avatar data-name="${htmlSafe(name)}" aria-hidden="true"></span>`;
	}

	function factRows(rows) {
		return rows
			.map(([term, detail]) => `<div class="bk-facts-row"><dt>${term}</dt><dd>${detail}</dd></div>`)
			.join('');
	}

	function orderLink(number) {
		return `<a class="bk-link" href="order-details.html?id=${encodeURIComponent(number)}">${htmlSafe(number)}</a>`;
	}

	/* The header: service, summary line, status and the next move. */

	function paintHeader() {
		const service = serviceOf();
		const { text, tone } = BADGES[booking.status];
		document.title = `${booking.name}, ${service.short} · Basalt`;
		part('icon').className = `bd-who-icon bk-tone-${service.group}`;
		part('icon').innerHTML = `<i class="bi ${service.icon}"></i>`;
		part('title').textContent = service.name;
		part('sub').textContent =
			`${booking.name} · ${store.fmtDay(booking.date)}, ${store.fmtRange(booking.time, store.endOf(booking))} · ${store.place(booking.where).name}`;
		part('tags').innerHTML =
			`<span class="basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}">${text}</span><span class="bd-id">${htmlSafe(booking.id)}</span>`;
		part('actions').innerHTML = headerButtons();
	}

	function headerButtons() {
		const lead = {
			requested:
				'<button type="button" class="btn btn-outline-secondary btn-sm" data-bd-act="move">Other time</button><button type="button" class="btn btn-primary btn-sm" data-bd-act="confirm"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Confirm</button>',
			confirmed:
				'<button type="button" class="btn btn-primary btn-sm" data-bd-act="move"><i class="bi bi-calendar-event me-1" aria-hidden="true"></i>Reschedule</button>',
		}[booking.status];
		if (lead === undefined) {
			return '<a class="btn btn-outline-secondary btn-sm" href="bookings.html?view=list"><i class="bi bi-list-ul me-1" aria-hidden="true"></i>All bookings</a>';
		}
		const menu =
			'<ul class="dropdown-menu dropdown-menu-end"><li><button type="button" class="dropdown-item" data-bd-act="remind"><i class="bi bi-envelope" aria-hidden="true"></i>Send a reminder</button></li><li><hr class="dropdown-divider"></li><li><button type="button" class="dropdown-item bd-danger-item" data-bd-act="cancel"><i class="bi bi-calendar-x" aria-hidden="true"></i>Cancel booking</button></li></ul>';
		return `${lead}<div class="dropdown"><button type="button" class="btn btn-outline-secondary btn-sm btn-square" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="More for this booking"><i class="bi bi-three-dots" aria-hidden="true"></i></button>${menu}</div>`;
	}

	/* When and where, then the stylist's whole day as a strip. */

	function paintSchedule() {
		const service = serviceOf();
		const stylist = store.person(booking.staff);
		const venue = store.place(booking.where);
		const when = relativeDay(booking.date);
		const prefix = when === 'Today' || when === 'Tomorrow' ? `${when}, ` : '';
		part('when-desc').textContent = `${prefix}${store.fmtLong(booking.date)}.`;
		part('facts').innerHTML = factRows([
			['Time', htmlSafe(store.fmtRange(booking.time, store.endOf(booking)))],
			[
				'Length',
				`${htmlSafe(store.fmtMinutes(service.minutes))}<span class="bk-facts-sub">Then ${service.buffer} min to reset the room</span>`,
			],
			['Where', `${htmlSafe(venue.name)}<span class="bk-facts-sub">${htmlSafe(venue.address)}</span>`],
			[
				'With',
				`<span class="bk-inline-person">${avatarTag(stylist.name, 'xs')}${htmlSafe(stylist.name)}</span><span class="bk-facts-sub">${htmlSafe(stylist.role)}, ${htmlSafe(store.place(stylist.studio).name)}</span>`,
			],
		]);
		paintDayStrip(service);
	}

	/**
	 * The stylist's bookings that day placed along opening hours, this one
	 * highlighted and the others linking to their own pages.
	 */
	function paintDayStrip(service) {
		const opensAt = store.mins(store.OPEN.from);
		const length = store.mins(store.OPEN.to) - opensAt;
		const percent = (minutes) => ((minutes / length) * 100).toFixed(2);
		const dayMates = store.bookings
			.filter(
				(other) =>
					other.staff === booking.staff &&
					other.date === booking.date &&
					(other.status !== 'canceled' || other.id === booking.id),
			)
			.sort((a, b) => (a.time < b.time ? -1 : 1));
		const stylistName = htmlSafe(givenName(booking.staff));

		part('day-title').textContent = `${givenName(booking.staff)}’s day`;
		let marks = '';
		for (let offset = 0; offset <= length; offset += 120) {
			marks += `<span class="bd-strip-tick" style="--bd-x:${percent(offset)}%">${htmlSafe(store.fmtTime(store.hhmm(opensAt + offset)))}</span>`;
		}
		const blocks = dayMates
			.map((other) => {
				const kind = store.service(other.service);
				const geometry = `--bd-x:${percent(store.mins(other.time) - opensAt)}%;--bd-w:${percent(kind.minutes)}%;--bd-b:${percent(kind.buffer)}%`;
				if (other.id === booking.id) {
					return `<span class="bd-strip-slot is-me bk-tone-${kind.group}" style="${geometry}" role="img" aria-label="${htmlSafe(`This booking, ${store.fmtRange(other.time, store.endOf(other))}`)}"></span>`;
				}
				const tip = htmlSafe(`${other.name}, ${kind.short}, ${store.fmtTime(other.time)}`);
				return `<a class="bd-strip-slot" href="booking-details.html?id=${encodeURIComponent(other.id)}" style="${geometry}" aria-label="${tip}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="${tip}"></a>`;
			})
			.join('');
		part('strip').innerHTML =
			`<div class="bd-strip-track">${blocks}</div><div class="bd-strip-ticks" aria-hidden="true">${marks}</div>`;

		const others = dayMates.filter((other) => other.id !== booking.id && other.status !== 'canceled').length;
		const key = `<span class="bd-key bd-key-me bk-tone-${service.group}" aria-hidden="true"></span>`;
		part('strip-note').innerHTML = others
			? `${key}This booking, and ${countOf(others, 'other booking')} for ${stylistName} that day.`
			: `${key}The only booking ${stylistName} has that day.`;
	}

	/* The customer card and the note they left. */

	function paintCustomer() {
		const contact = shopCustomer();
		const profile = `shopper-details.html?id=${encodeURIComponent(booking.customer)}`;
		const visits = store.bookings.filter(
			(other) => other.customer === booking.customer && other.id !== booking.id && other.status === 'done',
		);
		const lastVisit = visits[visits.length - 1];
		part('cust-link').href = profile;
		part('cust-desc').textContent = visits.length
			? `${countOf(visits.length, 'earlier visit')} to the studio.`
			: 'Their first visit to the studio.';

		const rows = contact
			? [
					[
						'Email',
						`<a class="bk-link" href="mailto:${htmlSafe(contact.email)}">${htmlSafe(contact.email)}</a>`,
					],
					['Phone', htmlSafe(contact.phone)],
					[
						'Shops with us',
						`${htmlSafe(MEMBERSHIP[contact.tier] || 'Standard')}<span class="bk-facts-sub">${countOf(contact.orders, 'order')} since ${htmlSafe(store.fmtShort(contact.joinedOn))}, ${contact.joinedOn.slice(0, 4)}</span>`,
					],
				]
			: [];
		if (lastVisit)
			rows.push([
				'Last visit',
				`${htmlSafe(store.service(lastVisit.service).short)}, ${htmlSafe(store.fmtShort(lastVisit.date))}`,
			]);

		const who = `<div class="bd-person-who">${avatarTag(booking.name, 'lg')}<div><a class="bd-person-name" href="${profile}">${htmlSafe(booking.name)}</a><span class="bk-facts-sub">${htmlSafe(booking.city)}</span></div></div>`;
		part('person').innerHTML = rows.length ? `${who}<dl class="bk-facts bd-facts">${factRows(rows)}</dl>` : who;
		part('note').textContent = booking.note || 'No note left with the booking.';
		part('note').classList.toggle('is-empty', !booking.note);
	}

	/* Price, what has been paid and what is still due. */

	function paintPayment() {
		const { rows, summary } = paymentPlan();
		part('pay-desc').textContent = summary;
		part('pay').innerHTML = factRows(rows);
	}

	/** Rows for the payment card and the one-line summary above them. */
	function paymentPlan() {
		const service = serviceOf();
		const payment = booking.pay;
		const price = store.priceOf(booking);
		const priceRow = ['Price', store.money(price)];
		const isDone = booking.status === 'done';

		const byKind = {
			deposit() {
				if (payment.refunded) {
					return {
						summary: 'Nothing is owed.',
						rows: [
							priceRow,
							[
								'Deposit',
								`${store.money(payment.amount)} refunded on ${store.fmtShort(payment.refunded)}`,
							],
						],
					};
				}
				if (isDone) {
					return {
						summary: 'Paid in full.',
						rows: [
							priceRow,
							['Deposit', `${store.money(payment.amount)}, ${htmlSafe(payment.card)}`],
							['Paid in the studio', store.money(price - payment.amount)],
						],
					};
				}
				return {
					summary: 'The deposit counts toward the session.',
					rows: [
						priceRow,
						[
							'Deposit paid',
							`${store.money(payment.amount)} on ${store.fmtShort(payment.paid)}<span class="bk-facts-sub">${htmlSafe(payment.card)}</span>`,
						],
						['Due in the studio', `<strong class="bd-due">${store.money(price - payment.amount)}</strong>`],
					],
				};
			},
			order: () => ({
				summary: 'Bought in the shop, so nothing is due.',
				rows: [
					priceRow,
					['Paid', `In full<span class="bk-facts-sub">With order ${orderLink(payment.order)}</span>`],
				],
			}),
			coat: () => ({
				summary: 'Every fitting comes with the commission.',
				rows: [
					['Price', htmlSafe(service.included)],
					['Tailoring order', payment.order ? orderLink(payment.order) : 'Not linked yet'],
				],
			}),
			studio: () => ({
				summary: isDone ? 'Paid in full.' : 'Nothing is paid until the work is agreed.',
				rows: [
					[
						'Price',
						`${store.money(payment.amount)}<span class="bk-facts-sub">From ${store.money(service.price)}, by the work needed</span>`,
					],
					['Paid', isDone ? 'In the studio' : 'In the studio, after the fitting'],
				],
			}),
		};
		const chosen = Object.hasOwn(byKind, payment.kind) ? byKind[payment.kind] : null;
		return chosen
			? chosen()
			: { summary: 'Repairs are part of their membership.', rows: [['Price', htmlSafe(service.included)]] };
	}

	/* Team notes and the booking's own history, newest first. */

	function paintNotes() {
		const list = part('notes');
		const items = [...teamNotes]
			.reverse()
			.map(
				([stamp, author, text]) =>
					`<li class="bd-notes-item">${avatarTag(author, 'xs')}<div><p class="bd-notes-meta"><strong>${htmlSafe(author)}</strong> · ${htmlSafe(readableStamp(stamp))}</p><p class="bd-notes-text">${htmlSafe(text)}</p></div></li>`,
			);
		list.innerHTML = items.length ? items.join('') : '<li class="bd-notes-none">No notes yet.</li>';
		enhance(list);
	}

	function paintHistory() {
		part('log').innerHTML = [...booking.log]
			.reverse()
			.map(
				([stamp, what]) =>
					`<li class="bd-log-item"><span class="bd-log-text">${htmlSafe(what)}</span><span class="bd-log-when">${htmlSafe(readableStamp(stamp))}</span></li>`,
			)
			.join('');
	}

	function onNoteSubmit(event) {
		event.preventDefault();
		const text = noteInput.value.trim();
		if (!text) {
			noteInput.focus();
			return;
		}
		const note = [stampNow(), 'John Armstrong', text];
		teamNotes.push(note);
		backend.addNote(booking, note);
		noteInput.value = '';
		paintNotes();
		notify({ tone: 'success', title: 'Note added', text: 'The studio team can see it now.', duration: 3500 });
	}

	/* Header and menu actions. */

	function onActionClick(event) {
		const trigger = event.target.closest('[data-bd-act]');
		if (!trigger) return;
		/*
		 * A pointer press drops focus from the button; a key press keeps it,
		 * so focus can return here once a dialog it opened closes again.
		 */
		if (event.detail > 0) trigger.blur();
		const handlers = {
			confirm: confirmBooking,
			move: openScheduler,
			cancel: openCancelDialog,
			remind: sendReminder,
		};
		const action = trigger.dataset.bdAct;
		if (Object.hasOwn(handlers, action)) handlers[action]();
	}

	/** Puts the saved fields back and redraws, for the toasts' Undo. */
	function restorer(saved) {
		return () => {
			Object.assign(booking, saved);
			paint();
		};
	}

	function sendReminder() {
		booking.log.push([stampNow(), 'Reminder email sent']);
		paintHistory();
		notify({
			tone: 'success',
			icon: 'bi-envelope-check',
			title: 'Reminder sent',
			text: `${booking.name} gets the time, the studio and what to bring.`,
			duration: 4000,
		});
	}

	function confirmBooking() {
		const saved = { status: booking.status, log: [...booking.log] };
		booking.status = 'confirmed';
		booking.log.push([stampNow(), 'You confirmed it']);
		backend.confirm(booking);
		paint();
		notify({
			tone: 'success',
			title: 'Booking confirmed',
			text: `${booking.name} gets an email with the time and studio.`,
			actions: [{ label: 'Undo', onClick: restorer(saved) }],
		});
	}

	/* The dialog for picking a new day, stylist and time. */

	function bindSlotDialog() {
		controls.times.addEventListener('change', (event) => {
			if (event.target.name !== 'bkSlotTime') return;
			pickedTime = event.target.value;
			controls.timeError.classList.remove('d-block');
		});
		controls.stylist.addEventListener('change', paintTimes);
		controls.day.addEventListener('change', paintTimes);
		slotForm.addEventListener('submit', onSlotSubmit);
	}

	function chosenDay() {
		return (window.Basalt.datepicker ? window.Basalt.datepicker.get(controls.day) : '') || '';
	}

	function paintTimes() {
		const iso = chosenDay();
		const free = iso ? store.freeSlots(controls.stylist.value, iso, booking.service, booking.id) : [];
		if (pickedTime && !free.includes(pickedTime)) pickedTime = null;
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
					`<input type="radio" class="btn-check" name="bkSlotTime" id="bk-slot${index}" value="${time}"${time === pickedTime ? ' checked' : ''}><label class="bk-slot" for="bk-slot${index}">${htmlSafe(store.fmtTime(time))}</label>`,
			)
			.join('');
	}

	function openScheduler() {
		const answering = booking.status === 'requested';
		controls.stylist.innerHTML = serviceOf()
			.staff.map((staffId) => {
				const member = store.person(staffId);
				return `<option value="${staffId}">${htmlSafe(`${member.name}, ${store.place(member.studio).name}`)}</option>`;
			})
			.join('');
		controls.stylist.value = booking.staff;
		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(controls.stylist);
		controls.heading.textContent = answering ? 'Offer another time' : 'Reschedule';
		controls.lead.textContent = `${booking.name}, now ${store.fmtDay(booking.date)} at ${store.fmtTime(booking.time)}.`;
		controls.send.textContent = answering ? 'Move and confirm' : 'Move booking';
		controls.notify.nextElementSibling.textContent = `Email ${customerFirstName()} the new time`;
		controls.notify.checked = true;
		pickedTime = null;

		let opening = booking.date < store.TODAY ? store.TODAY : booking.date;
		while (!store.isOpenDay(opening)) opening = store.addDays(opening, 1);
		if (window.Basalt.datepicker) window.Basalt.datepicker.set(controls.day, opening);
		paintTimes();
		bootstrap.Modal.getOrCreateInstance(slotDialog).show();
	}

	function onSlotSubmit(event) {
		event.preventDefault();
		const iso = chosenDay();
		if (!iso || !pickedTime) {
			controls.timeError.classList.add('d-block');
			(pick('input', controls.times) || pick('input', controls.day)).focus();
			return;
		}
		const stylist = store.person(controls.stylist.value);
		const { date, time, staff, where, status } = booking;
		const saved = { date, time, staff, where, status, log: [...booking.log] };
		const answering = status === 'requested';
		Object.assign(booking, { date: iso, time: pickedTime });
		if (booking.where !== 'video') booking.where = stylist.studio;
		booking.staff = stylist.id;
		booking.status = 'confirmed';
		booking.log.push([
			stampNow(),
			`Moved to ${store.fmtDay(iso)}, ${store.fmtTime(booking.time)}${answering ? ' and confirmed' : ''}`,
		]);
		backend.reschedule(booking);
		bootstrap.Modal.getOrCreateInstance(slotDialog).hide();
		paint();
		const emailed = controls.notify.checked ? ` ${customerFirstName()} gets an email.` : '';
		notify({
			tone: 'success',
			title: answering ? 'Moved and confirmed' : 'Booking moved',
			text: `${store.fmtDay(iso)} at ${store.fmtTime(booking.time)} with ${stylist.name.split(' ')[0]}.${emailed}`,
			actions: [{ label: 'Undo', onClick: restorer(saved) }],
		});
	}

	/* The cancel dialog, with an optional refund. */

	/** Words for the money a cancellation would hand back, or ''. */
	function refundWording() {
		const { kind, amount, order } = booking.pay;
		if (kind === 'deposit') return `${store.money(amount)} deposit`;
		if (kind === 'order') return `${store.money(store.priceOf(booking))} paid with ${order}`;
		return '';
	}

	function openCancelDialog() {
		const refund = refundWording();
		cancelParts.message.textContent = `${store.fmtDay(booking.date)} at ${store.fmtTime(booking.time)}. The time is freed and ${customerFirstName()} gets an email.`;
		cancelParts.refundRow.hidden = !refund;
		cancelParts.refundSwitch.checked = true;
		cancelParts.refundLabel.textContent = `Refund the ${refund}`;
		bootstrap.Modal.getOrCreateInstance(cancelDialog).show();
	}

	function cancelBooking() {
		const saved = {
			status: booking.status,
			log: [...booking.log],
			cancel: booking.cancel,
			pay: { ...booking.pay },
		};
		const refunding = !cancelParts.refundRow.hidden && cancelParts.refundSwitch.checked;
		booking.status = 'canceled';
		booking.cancel = refunding ? `Canceled by the studio, ${refundWording()} refunded.` : 'Canceled by the studio.';
		if (refunding && booking.pay.kind === 'deposit') booking.pay = { ...booking.pay, refunded: store.TODAY };
		booking.log.push([stampNow(), refunding ? 'Canceled by you, refunded' : 'Canceled by you']);
		backend.cancel(booking);
		bootstrap.Modal.getOrCreateInstance(cancelDialog).hide();
		paint();
		notify({
			tone: 'info',
			icon: 'bi-calendar-x',
			title: 'Booking canceled',
			text: `${booking.name}${refunding ? ' is refunded and gets an email.' : ' gets an email.'}`,
			actions: [{ label: 'Undo', onClick: restorer(saved) }],
		});
	}

	start();
})();
