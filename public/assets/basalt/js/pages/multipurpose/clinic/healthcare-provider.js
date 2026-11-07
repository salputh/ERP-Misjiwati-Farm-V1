/**
 * Provider details, provider-details.html: one provider as a
 * person. The header says who they are and where they are now; the tiles carry today and this
 * month; their week sits on FullCalendar; then their next patients, what
 * waits on them (notes and results to sign), their hours and time off,
 * and their training and contact. ?id= picks the provider (Dr. Pearce by
 * default).
 *
 * Reads window.Basalt.data.clinic (clinic.js) for names, rooms and the
 * day's lanes, window.Basalt.data.clinicProviders (clinic-providers.js) for
 * the profile, and window.Basalt.data.clinicOrders (clinic-orders.js) for
 * what waits on them. Time off added here lives in memory with a toast.
 */
(() => {
	'use strict';

	const root = pick('[data-hpv-root]');
	const clinic = window.Basalt.data?.clinic;
	const profiles = window.Basalt.data?.clinicProviders;
	const orders = window.Basalt.data?.clinicOrders;
	if (!root || !clinic || !profiles) return;

	/* The demo's week, and minutes from 08:00 to now (11:20 on Friday). */
	const DAYS = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
	const NOW_MINUTES = 200;
	const CHART = 'patient-chart.html';
	const VISIT = 'appointment-details.html';
	const id = new URLSearchParams(location.search).get('id');
	const who = clinic.provider(id) || clinic.provider('ev');
	const profile = profiles[who.id];

	function start() {
		paintHeader();
		paintTiles();
		drawWeek();
		paintPatients();
		paintWaits();
		paintHours();
		paintAbout();
		wireTimeOff();
		window.Basalt.avatars?.(root);
		wearFaces(document);
	}

	/** Gives a provider with a headshot (`face` in clinic.js) their photo in
	 * place of the initials, wherever their avatar sits in scope. */
	function wearFaces(scope) {
		for (const face of scope.querySelectorAll('[data-basalt-avatar]')) {
			const name = (face.dataset.name || '').replace(/^Dr\.? /, '');
			const who = clinic.providers.find((p) => p.face && p.name.replace(/^Dr\.? /, '') === name);
			if (!who || face.querySelector('img')) continue;
			const photo = document.createElement('img');
			photo.src = who.face;
			photo.alt = '';
			photo.loading = 'lazy';
			face.replaceChildren(photo);
		}
	}

	/* Header and tiles */

	function paintHeader() {
		const dept = clinic.departments.find((d) => d.key === who.dept);
		const room = clinic.rooms.find((r) => r.who === who.id && r.state === 'busy');
		document.title = `${who.name} · Basalt`;
		part('avatar').dataset.name = bare(who.name);
		part('name').textContent = who.name;
		part('sub').textContent =
			`${who.role}${dept.name === who.role ? '' : ` · ${dept.name}`}${who.room ? ` · Room ${who.room}` : ''} · with Bayline since ${profile.since}`;
		part('chips').innerHTML = [
			room
				? `<span class="hc-pill hc-pill-ok">In ${room.id} with ${room.patient}</span>`
				: `<span class="hc-pill">${who.room ? 'Between patients' : 'Not in today'}</span>`,
			...profile.languages.map((l) => `<span class="hc-pill hc-pill-info">${l}</span>`),
		].join('');

		part('book').innerHTML =
			`<i aria-hidden="true" class="bi bi-calendar-plus me-1"></i>Book with ${clinic.short(who.id)}`;
	}

	/** Today and this month as figure cards, each counted up once: the
	 * figure, one line of trend and small bars, the latest one solid. */
	function paintTiles() {
		const lane = clinic.lanes[who.id] || [];
		const ahead = lane.filter(([from, , , kind]) => from >= NOW_MINUTES && kind !== 'break' && kind !== 'gone');
		const last = lane.at(-1);
		const m = profile.month;
		/* Visits in each hour of today, 8 am to 5 pm. */
		const perHour = Array.from(
			{ length: 10 },
			(_, h) => lane.filter(([from, , , kind]) => kind !== 'break' && Math.floor(from / 60) === h).length,
		);
		/* The hour it is now is the solid bar. */
		perHour.now = Math.floor(NOW_MINUTES / 60);
		/* The twenty working days to Oct 9: a steady shape (Mondays busy,
		   Fridays light) scaled to the month's figure. */
		const SHAPE = [1.12, 1.02, 0.98, 1, 0.88];
		const days = (total) => {
			const raw = Array.from({ length: 20 }, (_, i) => SHAPE[i % 5] * (0.94 + ((i * 7) % 5) * 0.03));
			const sum = raw.reduce((x, y) => x + y, 0);
			return raw.map((v) => Math.round((v / sum) * total));
		};
		const waits = Array.from({ length: 20 }, (_, i) => Math.max(1, m.wait + ((i * 5) % 7) - 3));
		waits[19] = m.wait;
		const tiles = [
			[
				1,
				'bi-calendar-day',
				'Left today',
				ahead.length,
				(n) => `${n}`,
				last ? `Done by ${clock(last[0] + last[1])}` : 'No visits today',
				VISIT,
				perHour,
				'Visits each hour today',
			],
			[
				4,
				'bi-people',
				'Seen this month',
				m.seen,
				(n) => `${n}`,
				`${m.onTime}% started on time`,
				null,
				days(m.seen),
				'Patients seen each working day',
			],
			[
				6,
				'bi-hourglass-split',
				'Average wait',
				m.wait,
				(n) => `${n} min`,
				m.wait > 10 ? 'Over the ten-minute target' : 'Within the target',
				null,
				waits,
				'Average minutes waited each working day',
			],
			[
				7,
				'bi-cash-stack',
				'Billed this month',
				m.revenue,
				(n) => `$${(n / 1000).toFixed(1)}k`,
				'Four weeks to Oct 9',
				'finance-dashboard.html',
				days(m.revenue),
				'Billed each working day',
			],
		];
		part('tiles').innerHTML = tiles
			.map(([tone, icon, label, value, show, sub, href, series, spoken]) => {
				const top = Math.max(...series) || 1;
				const bars = series
					.map(
						(v, i) =>
							`<span class="hc-tile-bar value-${Math.max(4, Math.round((v / top) * 100))}${i === (series.now ?? series.length - 1) ? ' is-now' : ''}"></span>`,
					)
					.join('');
				const rising = series.at(-1) > series.at(-2);
				const trend = `<i aria-hidden="true" class="bi ${rising ? 'bi-arrow-up-right' : series.at(-1) < series.at(-2) ? 'bi-arrow-down-right' : 'bi-dash'}"></i>`;
				return `<div class="hc-tile tone-series-${tone}"><dt><i aria-hidden="true" class="bi ${icon}"></i>${label}</dt><dd>${href ? `<a href="${href}" class="hc-tile-link" data-hpv-count="${value}">${show(0)}</a>` : `<span data-hpv-count="${value}">${show(0)}</span>`}</dd><dd class="hc-tile-sub">${trend}${sub}</dd><dd class="hc-tile-foot"><span role="img" aria-label="${spoken}: ${series.map((v) => show(v)).join(', ')}" class="hc-tile-bars">${bars}</span></dd></div>`;
			})
			.join('');
		pickAll('[data-hpv-count]', part('tiles')).forEach((node, i) => countUp(node, tiles[i][3], tiles[i][4]));
	}

	/* Their week */

	/** Their visits Monday to Friday on FullCalendar; a visit opens its page. */
	function drawWeek() {
		const host = part('calendar');
		const lane = clinic.lanes[who.id] || [];
		const events = [];
		DAYS.forEach((day, d) => {
			lane.forEach(([from, length, label, kind], i) => {
				if (kind === 'break' || (d < 4 && (i + d) % 5 === 0)) return;
				const start = new Date(`${day}T08:00:00`);
				start.setMinutes(start.getMinutes() + from);
				const seen = d < 4 || from + length <= NOW_MINUTES;
				/* Friday is today's list; the days before drew other patients. */
				const title =
					d < 4 && clinic.register[label] ? clinic.walkIns[(i * 5 + d * 7) % clinic.walkIns.length] : label;
				events.push({
					id: `${d}-${i}`,
					title,
					start,
					end: new Date(start.getTime() + length * 60000),
					url: VISIT,
					classNames: [
						'basalt-fc-tone-1',
						seen ? 'hc-visit-seen' : 'hc-visit-booked',
						kind === 'gone' ? 'hc-visit-gone' : '',
					],
				});
			});
		});
		part('week-sub').textContent = events.length
			? `${events.length} visits; a visit opens its page.`
			: 'No visits this week.';
		if (!window.Basalt.calendar || !host) return;
		const calendar = window.Basalt.calendar(host, {
			now: '2026-10-09T11:20:00',
			initialDate: '2026-10-09',
			initialView: window.matchMedia('(max-width: 767.98px)').matches ? 'listWeek' : 'timeGridWeek',
			headerToolbar: false,
			/* The card's title carries the week; the calendar keeps only its buttons. */
			datesSet: (info) => {
				part('week-title').textContent = info.view.title;
			},
			slotMinTime: '08:00:00',
			slotMaxTime: '18:30:00',
			allDaySlot: false,
			weekends: false,
			events,
		});
		root.addEventListener('click', (event) => {
			const go = event.target.closest('[data-hc-cal-go]');
			if (!go) return;
			calendar[go.dataset.hcCalGo]();
			go.blur();
		});
	}

	/* Patients and what waits */

	/** The next three on their list today: a name links to the chart, the rest
	 * of the day is counted under them. */
	function paintPatients() {
		const lane = (clinic.lanes[who.id] || []).filter(
			([from, , , kind]) => from >= NOW_MINUTES && kind !== 'break' && kind !== 'gone',
		);
		/* A lane names the patient, or only the kind of visit; then the
		   patient comes from the day's walk-ins, as on Appointments. */
		const named = (label) => clinic.register[label] !== undefined || /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(label);
		part('patients').innerHTML = lane
			.slice(0, 3)
			.map(([from, , label], i) => {
				const name = named(label) ? label : clinic.walkIns[i % clinic.walkIns.length];
				return `<tr><td>${clock(from)}</td><td>${personLink(name, CHART)}</td><td>${named(label) ? 'Follow-up' : label}</td></tr>`;
			})
			.join('');
		part('patients-sub').textContent = lane.length ? `${lane.length} still to come today.` : 'Nobody left today.';
		const more = lane.length - 3;
		part('patients-foot').innerHTML =
			more > 0
				? `${more} more after these. <a href="appointments.html">Everyone’s day</a>`
				: '<a href="appointments.html">Everyone’s day</a>';
	}

	/** Notes and results only they can sign, each a link to where it is signed. */
	function paintWaits() {
		const notes = (orders?.notes || []).filter((n) => n.with === who.id && n.status !== 'signed');
		const results = (orders?.labWork || []).filter((r) => r.with === who.id && r.stage === 'back');
		const rows = [
			...notes.map((n) => [
				'bi-journal-text',
				`${n.status === 'draft' ? 'Finish' : 'Sign'} the note for ${n.name}`,
				n.visit,
				'visit-notes.html',
			]),
			...results.map((r) => [
				'bi-droplet',
				`Look at ${r.test} for ${r.name}`,
				'Back and not seen',
				'lab-orders-and-results.html',
			]),
		];
		part('waits-sub').textContent = rows.length
			? `${rows.length} ${rows.length === 1 ? 'thing waits' : 'things wait'} on ${clinic.short(who.id)}.`
			: 'Nothing waits on them.';
		part('waits').innerHTML = rows.length
			? rows
					.map(
						([icon, what, line, href]) =>
							`<li><a href="${href}" class="hpv-wait"><span class="hpv-wait-icon" aria-hidden="true"><i class="bi ${icon}"></i></span><span class="hpv-wait-text"><b>${what}</b><span>${line}</span></span><i class="bi bi-chevron-right hpv-wait-go" aria-hidden="true"></i></a></li>`,
					)
					.join('')
			: '<li class="hpv-wait-none"><i class="bi bi-check2-circle" aria-hidden="true"></i>All signed</li>';
	}

	/* Hours, time off and training */

	function paintHours() {
		part('hours').textContent = profile.hours;
		part('off').innerHTML = profile.timeOff.length
			? profile.timeOff
					.map((t) => `<li><b>${t.from === t.to ? t.from : `${t.from} to ${t.to}`}</b> · ${t.why}</li>`)
					.join('')
			: '<li class="hpv-off-none">No time off booked.</li>';
	}

	function paintAbout() {
		const dept = clinic.departments.find((d) => d.key === who.dept);
		const [first, ...rest] = bare(who.name).toLowerCase().split(' ');
		const facts = [
			['Training', profile.school],
			['Board', profile.board],
			['Department', `<a href="providers.html">${dept.name}</a>`],
			['Sites', (who.sites || []).map(([site, days]) => `${site} ${days}`).join('; ')],
			['Phone', `<a href="tel:+14155550100,${profile.ext}">(415) 555-0100, ext. ${profile.ext}</a>`],
			[
				'Email',
				`<a href="mailto:${first}.${rest.join('')}@example.com">${first}.${rest.join('')}@example.com</a>`,
			],
		];
		part('about').innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
	}

	/** Add time off: a dialog with two dates and a reason; the row joins the list. */
	function wireTimeOff() {
		const form = pick('[data-hpv-off-form]');
		if (!form || !window.bootstrap) return;
		const modal = form.closest('.modal');
		part('off-add').addEventListener('click', () => window.bootstrap.Modal.getOrCreateInstance(modal).show());
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			form.classList.add('was-validated');
			if (!form.checkValidity()) return;
			const day = (name) =>
				new Date(`${form.elements[name].value}T12:00`).toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric',
				});
			const from = day('from');
			const to = form.elements.to.value ? day('to') : from;
			profile.timeOff.push({ from, to, why: form.elements.why.value });
			paintHours();
			window.bootstrap.Modal.getOrCreateInstance(modal).hide();
			window.Basalt.toasts?.push({
				tone: 'success',
				title: 'Time off added',
				text: `${clinic.short(who.id)} is off ${from === to ? from : `${from} to ${to}`}. Visits then go to the desk to move.`,
			});
		});
		modal.addEventListener('hidden.bs.modal', () => {
			form.reset();
			form.classList.remove('was-validated');
		});
	}

	/* Small helpers */

	function part(name) {
		return pick(`[data-hpv="${name}"]`, root);
	}

	function pickAll(selector, scope = root) {
		return [...scope.querySelectorAll(selector)];
	}

	function bare(name) {
		return name.replace(/^Dr\.? /, '');
	}

	/** Minutes from 08:00 as a clock time: 200 reads 11:20 am. */
	function clock(minutes) {
		const h = 8 + Math.floor(minutes / 60);
		return `${h % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
	}

	/** A person as the template shows people: a small avatar and the name, one link. */
	function personLink(name, href) {
		return `<a href="${href}" class="hc-person-link"><span data-basalt-avatar data-name="${bare(name)}" aria-hidden="true" class="basalt-avatar basalt-avatar-xs"></span><span>${name}</span></a>`;
	}

	function countUp(node, value, show) {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			node.textContent = show(value);
			return;
		}
		const begin = performance.now();
		const step = (now) => {
			const t = Math.min(1, (now - begin) / 500);
			node.textContent = show(Math.round(value * (1 - Math.pow(1 - t, 3))));
			if (t < 1) requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	}

	start();

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}
})();
